<?php
// Lista de espera do "Crea video così": guarda email (+ Instagram opcional) em CARTELLA/lista-attesa.jsonl.
// Ver com: node strumenti/amministra.mjs lista
declare(strict_types=1);
require is_file(__DIR__ . '/../../privato/config.php') ? __DIR__ . '/../../privato/config.php' : __DIR__ . '/../privato/config.php';

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
function resposta(int $codigo, array $dados): void { http_response_code($codigo); echo json_encode($dados, JSON_UNESCAPED_UNICODE); exit; }
if ($_SERVER['REQUEST_METHOD'] !== 'POST') resposta(405, ['ok' => false]);
if (!is_dir(CARTELLA)) mkdir(CARTELLA, 0750, true);

// limite simples: 5 inscrições por hora por IP
$ip = hash('sha256', (string)($_SERVER['REMOTE_ADDR'] ?? '') . APP_SECRET);
$arqIp = CARTELLA . '/.lista-' . substr($ip, 0, 16);
$agora = time();
$tentativas = array_filter(is_file($arqIp) ? array_map('intval', file($arqIp, FILE_IGNORE_NEW_LINES)) : [], fn($t) => $t > $agora - 3600);
if (count($tentativas) >= 5) resposta(429, ['ok' => false, 'erro' => 'Troppe richieste. Riprova tra un’ora.']);
$tentativas[] = $agora;
file_put_contents($arqIp, implode("\n", $tentativas), LOCK_EX);

$d = json_decode((string)file_get_contents('php://input'), true);
if (!is_array($d)) resposta(400, ['ok' => false, 'erro' => 'Richiesta non valida.']);
$email = strtolower(trim((string)($d['email'] ?? '')));
if (!filter_var($email, FILTER_VALIDATE_EMAIL) || strlen($email) > 120) resposta(400, ['ok' => false, 'erro' => 'Controlla la tua email.']);
$conta = ltrim(trim((string)($d['conta'] ?? '')), '@');
if ($conta !== '' && !preg_match('/^[A-Za-z0-9._]{1,30}$/', $conta)) resposta(400, ['ok' => false, 'erro' => 'Instagram: solo lettere, numeri, punto e trattino basso.']);
$origem = preg_match('/^[a-z]{2,20}$/', (string)($d['origem'] ?? '')) ? $d['origem'] : 'video';

// não repete o mesmo email
$arq = CARTELLA . '/lista-attesa.jsonl';
if (is_file($arq) && str_contains((string)file_get_contents($arq), '"email":' . json_encode($email))) resposta(200, ['ok' => true, 'gia' => true]);
file_put_contents($arq, json_encode(['em' => gmdate('c'), 'email' => $email, 'conta' => strtolower($conta), 'origem' => $origem], JSON_UNESCAPED_UNICODE) . "\n", FILE_APPEND | LOCK_EX);
resposta(200, ['ok' => true]);
