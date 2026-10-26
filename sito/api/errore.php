<?php
// Recebe erros de carregamento do site (sendBeacon do index.html) e guarda em CARTELLA/errori.jsonl, para diagnosticar
// aparelhos onde a mapa não abre. Só mensagem, navegador e página: nada que identifique a pessoa.
declare(strict_types=1);
require is_file(__DIR__ . '/../../privato/config.php') ? __DIR__ . '/../../privato/config.php' : __DIR__ . '/../privato/config.php';
http_response_code(204);
if ($_SERVER['REQUEST_METHOD'] !== 'POST') exit;

// limite: 20 relatos por hora por IP
$pasta = CARTELLA;
$ip = substr(hash('sha256', (string)($_SERVER['REMOTE_ADDR'] ?? '') . APP_SECRET), 0, 16);
$arqIp = "$pasta/.errore-$ip";
$agora = time();
$t = array_filter(is_file($arqIp) ? array_map('intval', file($arqIp, FILE_IGNORE_NEW_LINES)) : [], fn($x) => $x > $agora - 3600);
if (count($t) >= 20) exit;
$t[] = $agora;
file_put_contents($arqIp, implode("\n", $t), LOCK_EX);

$d = json_decode((string)file_get_contents('php://input', false, null, 0, 4000), true);
if (!is_array($d)) exit;
$limpo = fn($k, $n) => substr(preg_replace('/[\x00-\x1F]/', ' ', (string)($d[$k] ?? '')) ?? '', 0, $n);
$riga = ['em' => gmdate('c'), 'msg' => $limpo('msg', 300), 'ua' => $limpo('ua', 250), 'url' => $limpo('url', 200)];
file_put_contents("$pasta/errori.jsonl", json_encode($riga, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . "\n", FILE_APPEND | LOCK_EX);
