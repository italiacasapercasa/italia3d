<?php
// Webhook da Hotmart (postback 2.0): marca o pedido como pago/reembolsado pelo "sck" do link de pagamento.
// No painel da Hotmart: Ferramentas > Webhook > URL https://italiacasapercasa.com/api/hotmart.php ; copie o "hottok" para HOTMART_HOTTOK no config.php.
declare(strict_types=1);
require is_file(__DIR__ . '/../../privato/config.php') ? __DIR__ . '/../../privato/config.php' : __DIR__ . '/../privato/config.php';

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

$novo = ['PURCHASE_APPROVED' => 'pagato', 'PURCHASE_COMPLETE' => 'pagato', 'PURCHASE_REFUNDED' => 'rimborsato', 'PURCHASE_CHARGEBACK' => 'rimborsato', 'PURCHASE_CANCELED' => 'annullato'][$evento] ?? null;
if ($novo && preg_match('/^\d{6}-[0-9a-f]{8}$/', $sck) && is_file("$pasta/$sck.json")) {
    $p = json_decode((string)file_get_contents("$pasta/$sck.json"), true) ?: [];
    $p['pagamento'] = $novo;
    $p['transazione'] = $registro['transazione'];
    $p['pagamento_em'] = $registro['em'];
    file_put_contents("$pasta/$sck.json", json_encode($p, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT), LOCK_EX);
}
http_response_code(200);
echo 'ok';
