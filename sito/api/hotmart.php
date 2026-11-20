<?php
// Webhook da Hotmart (postback 2.0): marca o pedido como pago/reembolsado pelo "sck" do link de pagamento.
// No painel da Hotmart: Ferramentas > Webhook > URL https://italiacasapercasa.com/api/hotmart.php ; copie o "hottok" para HOTMART_HOTTOK no config.php.
declare(strict_types=1);
require_once is_file(__DIR__ . '/../../privato/config.php') ? __DIR__ . '/../../privato/config.php' : __DIR__ . '/../privato/config.php';

// a Hotmart testa a URL ao cadastrar o webhook: responde 200 sempre, mas só processa com o hottok certo
$valido = $_SERVER['REQUEST_METHOD'] === 'POST' && defined('HOTMART_HOTTOK') && HOTMART_HOTTOK
    && hash_equals(HOTMART_HOTTOK, (string)($_SERVER['HTTP_X_HOTMART_HOTTOK'] ?? ''));
if (!$valido) { http_response_code(200); echo 'ok'; exit; }

$corpo = (string)file_get_contents('php://input');
$d = json_decode($corpo, true) ?: [];
$pasta = CARTELLA . '/negozi';
if (!is_dir($pasta)) mkdir($pasta, 0750, true);

$evento = (string)($d['event'] ?? '');
$compra = $d['data']['purchase'] ?? [];
$sck = (string)($compra['origin']['sck'] ?? '');
$registro = [
    'em' => gmdate('c'), 'evento' => $evento, 'sck' => $sck,
    'transazione' => (string)($compra['transaction'] ?? ''), 'stato' => (string)($compra['status'] ?? ''),
    'valore' => $compra['price']['value'] ?? null, 'valuta' => (string)($compra['price']['currency_value'] ?? ''),
    'prodotto' => (string)($d['data']['product']['name'] ?? ''),
];
file_put_contents("$pasta/pagamenti.jsonl", json_encode($registro, JSON_UNESCAPED_UNICODE) . "\n", FILE_APPEND | LOCK_EX);

// recarga de créditos 💰 (produtos "… crediti" na Hotmart; sck = c<id da conta>, senão acha a conta pelo e-mail do comprador)
if (preg_match('/^c[0-9a-f]{16}$/', $sck) || stripos($registro['prodotto'], 'crediti') !== false) {
    require_once __DIR__ . '/_conti.php';
    $st = in_array($evento, ['PURCHASE_APPROVED', 'PURCHASE_COMPLETE'], true) ? 'pagato' : (in_array($evento, ['PURCHASE_REFUNDED', 'PURCHASE_CHARGEBACK'], true) ? 'rimborsato' : '');
    if ($st !== '' && $registro['transazione'] !== '') {
        $esito = conti_ricarica((string)($d['data']['buyer']['email'] ?? ''), $sck, (string)($d['data']['product']['id'] ?? ''), $registro['prodotto'], $registro['transazione'], $st, $registro['valore'], (string)($compra['offer']['code'] ?? ''));
        file_put_contents(conti_dir() . '/ricariche.log', gmdate('c') . " $evento {$registro['transazione']} $esito\n", FILE_APPEND | LOCK_EX);
    }
    http_response_code(200); echo 'ok'; exit;
}

// carrinho abandonado (o cliente abriu o pagamento e saiu): a Hotmart não manda o sck, então acha o pedido pelo e-mail
if ($evento === 'PURCHASE_OUT_OF_SHOPPING_CART') {
    $email = strtolower(trim((string)($d['data']['buyer']['email'] ?? '')));
    $alvo = null;
    if (preg_match('/^\d{6}-[0-9a-f]{8}$/', $sck) && is_file("$pasta/$sck.json")) $alvo = "$pasta/$sck.json";
    elseif ($email !== '') {
        $arqs = glob("$pasta/[0-9][0-9][0-9][0-9][0-9][0-9]-*.json") ?: [];
        rsort($arqs);   // o mais recente primeiro (o id começa pela data)
        foreach ($arqs as $a) {
            $p = json_decode((string)file_get_contents($a), true) ?: [];
            if (strtolower((string)($p['email'] ?? '')) === $email && ($p['pagamento'] ?? '') !== 'pagato') { $alvo = $a; break; }
        }
    }
    if ($alvo) {
        $p = json_decode((string)file_get_contents($alvo), true) ?: [];
        $p['checkout'] = 'abbandonato';
        $p['checkout_em'] = $registro['em'];
        file_put_contents($alvo, json_encode($p, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT), LOCK_EX);
    }
    http_response_code(200); echo 'ok'; exit;
}

$novo = ['PURCHASE_APPROVED' => 'pagato', 'PURCHASE_COMPLETE' => 'pagato', 'PURCHASE_REFUNDED' => 'rimborsato', 'PURCHASE_CHARGEBACK' => 'rimborsato', 'PURCHASE_CANCELED' => 'annullato'][$evento] ?? null;

// casa decorada (api/decora.php): pago liga por N dias (data/negozio.json decora.giorni), somados ao fim da decoração
// ainda ativa da mesma casa (botão "Rinnova"); reembolso desliga na hora
$pastaDec = CARTELLA . '/decori';
if ($novo && preg_match('/^\d{6}-[0-9a-f]{8}$/', $sck) && is_file("$pastaDec/$sck.json")) {
    $p = json_decode((string)file_get_contents("$pastaDec/$sck.json"), true) ?: [];
    if ($novo === 'pagato' && empty($p['scade'])) {
        $cfg = json_decode((string)@file_get_contents(__DIR__ . '/../data/negozio.json'), true) ?: [];
        $giorni = max(1, (int)($cfg['decora']['giorni'] ?? 30));
        // renovação: se a casa ainda está decorada, os dias novos começam quando a decoração atual acaba
        $base = time();
        foreach (glob("$pastaDec/[0-9][0-9][0-9][0-9][0-9][0-9]-*.json") ?: [] as $a) {
            $q = json_decode((string)file_get_contents($a), true) ?: [];
            if (($q['id'] ?? '') === $sck || ($q['conta'] ?? '') !== ($p['conta'] ?? '') || !in_array($q['pagamento'] ?? '', ['pagato', 'omaggio'], true) || ($q['stato'] ?? '') === 'rimosso') continue;
            $base = max($base, (int)strtotime((string)($q['scade'] ?? '')));
        }
        $p['attivo_da'] = gmdate('c');
        $p['scade'] = gmdate('c', $base + $giorni * 86400);
        if ($base > time()) $p['rinnovo'] = true;
    }
    // PURCHASE_COMPLETE chega dias depois do APPROVED: não desfaz um reembolso
    if (!($novo === 'pagato' && ($p['pagamento'] ?? '') === 'rimborsato')) $p['pagamento'] = $novo;
    $p['transazione'] = $registro['transazione'];
    $p['valore'] = $registro['valore'];
    $p['pagamento_em'] = $registro['em'];
    file_put_contents("$pastaDec/$sck.json", json_encode($p, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT), LOCK_EX);
    rigeneraDecori($pastaDec, __DIR__ . '/../data/decori.json');
    http_response_code(200); echo 'ok'; exit;
}

if ($novo && preg_match('/^\d{6}-[0-9a-f]{8}$/', $sck) && is_file("$pasta/$sck.json")) {
    $p = json_decode((string)file_get_contents("$pasta/$sck.json"), true) ?: [];
    // o adicional "su misura" é um produto à parte na Hotmart, pago com o mesmo código do pedido
    $campo = stripos($registro['prodotto'], 'misura') !== false ? 'pagamento_su_misura' : 'pagamento';
    $p[$campo] = $novo;
    $p[$campo === 'pagamento' ? 'transazione' : 'transazione_su_misura'] = $registro['transazione'];
    $p[$campo . '_em'] = $registro['em'];
    file_put_contents("$pasta/$sck.json", json_encode($p, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT), LOCK_EX);
}
http_response_code(200);
echo 'ok';

// lista pública das decorações ativas (o site lê data/decori.json): a compra mais recente de cada conta vale
// (amministra.mjs "decori rimuovi" refaz a mesma lista no PC)
function rigeneraDecori(string $pasta, string $destino): void {
    $agora = time(); $por = [];
    foreach (glob("$pasta/[0-9][0-9][0-9][0-9][0-9][0-9]-*.json") ?: [] as $a) {
        $p = json_decode((string)file_get_contents($a), true) ?: [];
        if (!in_array($p['pagamento'] ?? '', ['pagato', 'omaggio'], true) || ($p['stato'] ?? '') === 'rimosso' || strtotime((string)($p['scade'] ?? '')) <= $agora) continue;
        $c = (string)$p['conta'];
        if (!isset($por[$c]) || strcmp((string)$p['attivo_da'], (string)$por[$c]['attivo_da']) > 0) $por[$c] = $p;
    }
    $lista = array_values(array_map(fn($p) => ['id' => $p['id'], 'conta' => $p['conta'], 'da' => $p['da'] ?? '', 'squadra' => $p['squadra'] ?? '', 'extra' => $p['extra'] ?? [], 'attivo_da' => $p['attivo_da'] ?? '', 'scade' => $p['scade']], $por));
    $tmp = "$destino.tmp";
    file_put_contents($tmp, json_encode(['agg' => gmdate('c'), 'decori' => $lista], JSON_UNESCAPED_UNICODE), LOCK_EX);
    rename($tmp, $destino);
}
