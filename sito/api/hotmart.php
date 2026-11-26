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
    } elseif ($evento !== '') {   // carrinho abandonado, boleto/pendente etc.: só registra (funil da recarga)
        file_put_contents(conti_dir() . '/ricariche.log', gmdate('c') . " $evento {$registro['transazione']} {$registro['valore']}\n", FILE_APPEND | LOCK_EX);
    }
    http_response_code(200); echo 'ok'; exit;
}

// ---------- Natale sulla mappa (produto N108658925K): registra, ATIVA SOZINHO em data/natale.json e avisa por e-mail ----------
// link: pay.hotmart.com/N108658925K?off=<oferta>&sck=<id da loja>[-DD p/ Avvento] (node strumenti/natale.mjs link <id> [DD])
// reembolso/chargeback desativa só o que aquela compra ligou. Fica ANTES dos pedidos de loja: o sck é o id do mesmo pedido
// e, sem isto, o pagamento do Natal sobrescreveria o pagamento da loja. natale.json passa a ser "do servidor".
const NATALE_OFFERTE = ['v67dhxtb' => 'negozio', 'cg2s8ifg' => 'negozio', '18wqfhk0' => 'avvento', 'yy141hde' => 'sponsor'];
$offNat = NATALE_OFFERTE[(string)($compra['offer']['code'] ?? '')] ?? null;
if ($offNat || stripos($registro['prodotto'], 'natale') !== false) {
    $logNat = CARTELLA . '/natale-pagamenti.jsonl';
    $esito = in_array($evento, ['PURCHASE_APPROVED', 'PURCHASE_COMPLETE'], true) ? 'pagato' : (in_array($evento, ['PURCHASE_REFUNDED', 'PURCHASE_CHARGEBACK'], true) ? 'rimborsato' : '');
    if ($esito !== '') {
        preg_match('/^(\d{6}-[0-9a-f]{8})(?:-(\d{2}))?$/', $sck, $m);
        $neg = $m[1] ?? ''; $dia = isset($m[2]) ? "2026-12-{$m[2]}" : '';
        $ped = $neg !== '' && is_file("$pasta/$neg.json") ? (json_decode((string)file_get_contents("$pasta/$neg.json"), true) ?: []) : [];
        $com = array_values(array_filter(json_decode((string)@file_get_contents(CARTELLA . '/../config-gioco/commerci.json'), true) ?: [], fn($c) => ($c['id'] ?? '') === $neg));
        $nome = (string)($com[0]['nome'] ?? $ped['nome'] ?? $neg);
        // a mesma compra chega 2× (APPROVED e, dias depois, COMPLETE): não reativa o que foi reembolsado nem repete o e-mail
        $antes = []; $ligou = '';
        foreach (array_filter(explode("\n", (string)@file_get_contents($logNat))) as $l) {
            $x = json_decode($l, true); if (($x['transazione'] ?? '') !== $registro['transazione']) continue;
            $antes[] = $x['esito'] ?? ''; if (($x['esito'] ?? '') === 'pagato' && $ligou === '') $ligou = (string)($x['mapa'] ?? '');
        }
        // reembolso de Avvento/Sponsor que não ativou (ganhou só o Negozio di Natale): desliga o Negozio
        $offEf = $esito === 'rimborsato' && str_contains($ligou, 'Ganhou o Negozio') ? 'negozio' : $offNat;
        if ($esito === 'pagato' && in_array('rimborsato', $antes, true)) $ativ = 'IGNORADO: compra já reembolsada';
        elseif ($esito === 'pagato' && in_array('pagato', $antes, true)) $ativ = 'REPETIDO: já processado';
        elseif ($esito === 'rimborsato' && in_array('rimborsato', $antes, true)) $ativ = 'REPETIDO: reembolso já processado';
        elseif (!$offNat) $ativ = 'ERRO: oferta desconhecida (' . (string)($compra['offer']['code'] ?? '') . ')';
        elseif ($neg === '' || (!$com && !$ped)) $ativ = "ERRO: loja não encontrada (sck '$sck')";
        else $ativ = natale_aplica((string)$offEf, $neg, $dia, $esito === 'pagato');
        file_put_contents($logNat, json_encode(['em' => gmdate('c'), 'evento' => $evento, 'esito' => $esito, 'offerta' => $offNat, 'negozio' => $neg, 'nome' => $nome, 'giorno' => $dia,
            'transazione' => $registro['transazione'], 'valore' => $registro['valore'], 'email' => (string)($d['data']['buyer']['email'] ?? ''), 'mapa' => $ativ], JSON_UNESCAPED_UNICODE) . "\n", FILE_APPEND | LOCK_EX);
        if (defined('EMAIL_AVVISI') && EMAIL_AVVISI && !str_starts_with($ativ, 'REPETIDO')) {
            $falhou = !str_starts_with($ativ, 'ATIVADO') && !str_starts_with($ativ, 'DESATIVADO');
            @mail(EMAIL_AVVISI, ($falhou ? '⚠️ ' : '') . ($esito === 'pagato' ? 'PAGO Natale' : 'RIMBORSO Natale') . ": $nome ($offNat" . ($dia ? " $dia" : '') . ')',
                "Natale Italia: $offNat · negozio $neg · {$registro['valore']} {$registro['valuta']}\nMappa: $ativ\n(vedere tutto: node strumenti/natale.mjs lista)", 'From: ' . EMAIL_AVVISI);
        }
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

// liga/desliga uma compra do Natal em data/natale.json (com trava: dois pagamentos ao mesmo tempo não se apagam)
// Avvento num dia já vendido ou Sponsor já vendido: não toma o lugar de ninguém, liga só o Negozio di Natale e avisa
function natale_aplica(string $off, string $neg, string $dia, bool $liga): string {
    $arq = __DIR__ . '/../data/natale.json';
    $fh = @fopen($arq, 'c+'); if (!$fh) return 'ERRO: não abriu data/natale.json';
    flock($fh, LOCK_EX);
    $nat = json_decode((string)stream_get_contents($fh), true) ?: [];
    $nat += ['sponsor' => null, 'negozi' => [], 'avvento' => [], 'bonus' => 2];
    $nat['avvento'] = (array)$nat['avvento'];
    $addNeg = function () use (&$nat, $neg) { if (!in_array($neg, $nat['negozi'], true)) $nat['negozi'][] = $neg; };
    if ($liga) {
        if ($off === 'avvento') {
            $dono = (string)($nat['avvento'][$dia] ?? '');
            if (!preg_match('/^2026-12-(0[1-9]|1\d|2[0-4])$/', $dia)) { $addNeg(); $r = "NÃO ATIVOU o Avvento: sem dia válido no link ('$dia'). Ganhou o Negozio di Natale; ative o dia com natale.mjs avvento"; }
            elseif ($dono !== '' && $dono !== $neg) { $addNeg(); $r = "NÃO ATIVOU o Avvento: $dia já é de outra loja ($dono). Ganhou o Negozio di Natale; combine outro dia ou reembolse a diferença"; }
            else { $nat['avvento'][$dia] = $neg; ksort($nat['avvento']); $r = "ATIVADO: Avvento $dia"; }
        } elseif ($off === 'sponsor') {
            $sp = (string)($nat['sponsor']['id'] ?? '');
            if ($sp !== '' && $sp !== $neg) { $addNeg(); $r = "NÃO ATIVOU o sponsor: já é de outra loja ($sp). Ganhou o Negozio di Natale; reembolse a diferença"; }
            else { $nat['sponsor'] = ['id' => $neg]; $r = 'ATIVADO: sponsor ufficiale'; }
        } else { $addNeg(); $r = 'ATIVADO: Negozio di Natale'; }
    } else {
        if ($off === 'avvento') { if ($dia !== '' && ($nat['avvento'][$dia] ?? '') === $neg) unset($nat['avvento'][$dia]); }
        elseif ($off === 'sponsor') { if (($nat['sponsor']['id'] ?? '') === $neg) $nat['sponsor'] = null; }
        else $nat['negozi'] = array_values(array_filter($nat['negozi'], fn($x) => $x !== $neg));
        $r = 'DESATIVADO (rimborso/chargeback)';
    }
    if ($nat['avvento'] === []) $nat['avvento'] = new stdClass();   // continua {} no JSON
    ftruncate($fh, 0); rewind($fh);
    fwrite($fh, json_encode($nat, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . "\n");
    fflush($fh); flock($fh, LOCK_UN); fclose($fh);
    return $r;
}

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
