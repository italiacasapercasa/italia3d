<?php
// Webhook do Instagram: recebe as menções em stories (campo "messages") e guarda em storie.jsonl.
// Não guarda a imagem da story (regra da Meta): só o id da mensagem, o IGSID de quem marcou e a hora.
declare(strict_types=1);
// APP_SECRET, VERIFY_TOKEN, CHIAVE_DOWNLOAD, CARTELLA — fora da public_html ou em public_html/privato (bloqueada no .htaccess)
require is_file(__DIR__ . '/../../privato/config.php') ? __DIR__ . '/../../privato/config.php' : __DIR__ . '/../privato/config.php';

// verificação da assinatura do webhook (GET com hub.challenge); o PHP troca "." por "_" nos nomes
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    if (($_GET['hub_mode'] ?? '') === 'subscribe' && hash_equals(VERIFY_TOKEN, (string)($_GET['hub_verify_token'] ?? ''))) {
        header('Content-Type: text/plain');
        echo (string)($_GET['hub_challenge'] ?? '');
        exit;
    }
    http_response_code(403);
    exit;
}

$corpo = (string)file_get_contents('php://input');
$assinatura = (string)($_SERVER['HTTP_X_HUB_SIGNATURE_256'] ?? '');
if (!hash_equals('sha256=' . hash_hmac('sha256', $corpo, APP_SECRET), $assinatura)) {
    http_response_code(403);
    exit;
}

$dados = json_decode($corpo, true) ?: [];
$linhas = '';
foreach ($dados['entry'] ?? [] as $entrada) {
    foreach ($entrada['messaging'] ?? [] as $m) {
        foreach ($m['message']['attachments'] ?? [] as $anexo) {
            if (($anexo['type'] ?? '') !== 'story_mention') continue;
            $linhas .= json_encode([
                'mid' => (string)($m['message']['mid'] ?? ''),
                'igsid' => (string)($m['sender']['id'] ?? ''),
                'ts' => (int)($m['timestamp'] ?? round(microtime(true) * 1000)),
            ]) . "\n";
        }
    }
}
if ($linhas !== '') {
    if (!is_dir(CARTELLA)) mkdir(CARTELLA, 0750, true);
    file_put_contents(CARTELLA . '/storie.jsonl', $linhas, FILE_APPEND | LOCK_EX);
}
http_response_code(200);
echo 'ok';
