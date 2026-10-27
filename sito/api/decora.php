<?php
// Pedido de casa decorada (decori.js): confere as contas no mapa e os efeitos, guarda em CARTELLA/decori/<id>.json
// e devolve o id, que vai como "sck" no link da Hotmart. Só aparece no mapa depois que hotmart.php confirma o pagamento.
declare(strict_types=1);
require is_file(__DIR__ . '/../../privato/config.php') ? __DIR__ . '/../../privato/config.php' : __DIR__ . '/../privato/config.php';

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
function resposta(int $codigo, array $dados): void { http_response_code($codigo); echo json_encode($dados, JSON_UNESCAPED_UNICODE); exit; }
function erro(string $msg): void { resposta(400, ['ok' => false, 'erro' => $msg]); }
if ($_SERVER['REQUEST_METHOD'] !== 'POST') resposta(405, ['ok' => false]);

$pasta = CARTELLA . '/decori';
if (!is_dir($pasta)) mkdir($pasta, 0750, true);

// limite simples: 20 pedidos por hora por IP
$ip = hash('sha256', (string)($_SERVER['REMOTE_ADDR'] ?? '') . APP_SECRET);
$arqIp = $pasta . '/.limite-' . substr($ip, 0, 16);
$agora = time();
$tentativas = array_filter(is_file($arqIp) ? array_map('intval', file($arqIp, FILE_IGNORE_NEW_LINES)) : [], fn($t) => $t > $agora - 3600);
if (count($tentativas) >= 20) resposta(429, ['ok' => false, 'erro' => 'Troppe richieste. Riprova tra un’ora.']);
$tentativas[] = $agora;
file_put_contents($arqIp, implode("\n", $tentativas), LOCK_EX);

$d = json_decode((string)file_get_contents('php://input'), true);
if (!is_array($d)) erro('Richiesta non valida.');
$conta = strtolower(ltrim(trim((string)($d['conta'] ?? '')), '@'));
$modo = ($d['modo'] ?? '') === 'regalo' ? 'regalo' : 'mia';
$da = strtolower(ltrim(trim((string)($d['da'] ?? '')), '@'));
$squadra = (string)($d['squadra'] ?? '');
$extra = array_values(array_unique(array_map('strval', (array)($d['extra'] ?? []))));

// mesmas listas de decori.js (presente: só coisas positivas, sem cores de time nem tricolore)
$SQUADRE = ['bianconero', 'nerazzurro', 'rossonero', 'azzurro', 'giallorosso', 'biancoceleste', 'viola', 'granata', 'rossoblu'];
$EFFETTI = $modo === 'regalo' ? ['oro', 'neon', 'corona', 'fuochi', 'campione', 'palloncini', 'cornice'] : ['oro', 'neon', 'corona', 'fuochi', 'campione', 'tricolore', 'cornice'];
if ($squadra !== '' && ($modo === 'regalo' || !in_array($squadra, $SQUADRE, true))) erro('Colori non validi.');
if (array_diff($extra, $EFFETTI)) erro('Effetto non valido.');
if ($squadra === '' && !$extra) erro('Scegli almeno un effetto.');
if (in_array('oro', $extra, true) && $squadra !== '') erro('Scegli la casa d’oro o i colori della squadra, non tutti e due.');

// as contas precisam ter casa no mapa (o "da @" aparece em público: só @ de quem joga, nada de texto livre)
if (!preg_match('/^[a-z0-9._]{1,30}$/', $conta)) erro('Account non valido.');
if ($modo === 'regalo' && !preg_match('/^[a-z0-9._]{1,30}$/', $da)) erro('Scrivi il tuo @.');
if ($modo === 'regalo' && $da === $conta) erro('Non puoi fare un regalo a te stesso.');
$snap = json_decode((string)@file_get_contents(__DIR__ . '/../data/snapshot.json'), true);
$conte = array_flip(array_map(fn($c) => (string)$c[0], (array)($snap['case'] ?? [])));
if (!isset($conte[$conta])) erro("@$conta non ha ancora una casa sulla mappa.");
if ($modo === 'regalo' && !isset($conte[$da])) erro("@$da non ha ancora una casa sulla mappa.");

$id = date('ymd') . '-' . bin2hex(random_bytes(4));
$pedido = ['id' => $id, 'creato' => gmdate('c'), 'stato' => 'nuovo', 'modo' => $modo, 'conta' => $conta, 'da' => $modo === 'regalo' ? $da : '', 'squadra' => $squadra, 'extra' => $extra];
file_put_contents("$pasta/$id.json", json_encode($pedido, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT), LOCK_EX);
resposta(200, ['ok' => true, 'id' => $id]);
