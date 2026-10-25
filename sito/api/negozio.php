<?php
// Recebe o pedido de um comércio/outdoor (negozio.html) e guarda em CARTELLA/negozi/<id>.json (+ logo).
// Nada vai para o mapa sem aprovação manual (node strumenti/amministra.mjs negozi / approva).
declare(strict_types=1);
require is_file(__DIR__ . '/../../privato/config.php') ? __DIR__ . '/../../privato/config.php' : __DIR__ . '/../privato/config.php';

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
function resposta(int $codigo, array $dados): void { http_response_code($codigo); echo json_encode($dados, JSON_UNESCAPED_UNICODE); exit; }
// tamanho em caracteres sem depender da extensão mbstring
function tam(string $s): int { return (int)preg_match_all('/./us', $s); }
function erro(string $campo, string $msg): void { resposta(400, ['ok' => false, 'campo' => $campo, 'erro' => $msg]); }
if ($_SERVER['REQUEST_METHOD'] !== 'POST') resposta(405, ['ok' => false]);

$pasta = CARTELLA . '/negozi';
if (!is_dir($pasta)) mkdir($pasta, 0750, true);

// limite simples: 8 pedidos por hora por IP
$ip = hash('sha256', (string)($_SERVER['REMOTE_ADDR'] ?? '') . APP_SECRET);
$arqIp = $pasta . '/.limite-' . substr($ip, 0, 16);
$agora = time();
$tentativas = array_filter(is_file($arqIp) ? array_map('intval', file($arqIp, FILE_IGNORE_NEW_LINES)) : [], fn($t) => $t > $agora - 3600);
if (count($tentativas) >= 8) resposta(429, ['ok' => false, 'erro' => 'Troppe richieste. Riprova tra un’ora.']);
$tentativas[] = $agora;
file_put_contents($arqIp, implode("\n", $tentativas), LOCK_EX);

$d = json_decode((string)file_get_contents('php://input'), true);
if (!is_array($d)) erro('', 'Richiesta non valida.');
$txt = fn(string $k) => trim(preg_replace('/\s+/u', ' ', strip_tags((string)($d[$k] ?? ''))) ?? '');

$prodotto = in_array($d['prodotto'] ?? '', ['negozio', 'cartellone'], true) ? $d['prodotto'] : 'negozio';
$nome = $txt('nome');
if (tam($nome) < 2 || tam($nome) > 40) erro('nome', 'Scrivi il nome dell’attività (da 2 a 40 caratteri).');
$instagram = ltrim($txt('instagram'), '@');
if ($instagram !== '' && !preg_match('/^[A-Za-z0-9._]{1,30}$/', $instagram)) erro('instagram', 'Solo lettere, numeri, punto e trattino basso (fino a 30).');
$tipo = preg_match('/^[a-z]{2,20}$/', (string)($d['tipo'] ?? '')) ? $d['tipo'] : 'altro';
$istat = (string)($d['istat'] ?? '');
if (!preg_match('/^\d{6}$/', $istat)) erro('citta', 'Scegli la città dalla lista.');
$colore = preg_match('/^#[0-9A-Fa-f]{6}$/', (string)($d['colore'] ?? '')) ? strtoupper($d['colore']) : '#E0473C';
$descrizione = $txt('descrizione');
if (tam($descrizione) > 200) erro('descrizione', 'Massimo 200 caratteri.');
$testo = $txt('testo');
if (tam($testo) > 60) erro('testo', 'Massimo 60 caratteri.');
$whatsapp = preg_replace('/[^\d+]/', '', (string)($d['whatsapp'] ?? ''));
if (strlen(preg_replace('/\D/', '', $whatsapp)) < 8 || strlen(preg_replace('/\D/', '', $whatsapp)) > 15) erro('whatsapp', 'Scrivi il numero WhatsApp (con prefisso internazionale se non è italiano).');
$email = trim((string)($d['email'] ?? ''));
if (!filter_var($email, FILTER_VALIDATE_EMAIL) || strlen($email) > 120) erro('email', 'Controlla la tua email.');
if (empty($d['consenso'])) erro('consenso', 'Per continuare, accetta le condizioni.');

$id = date('ymd') . '-' . bin2hex(random_bytes(4));
$logo = '';
if (!empty($d['logo'])) {
    if (!preg_match('#^data:image/(png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$#', (string)$d['logo'], $m)) erro('logo', 'Il logo deve essere PNG, JPG o WebP.');
    $bin = base64_decode($m[2], true);
    if ($bin === false || strlen($bin) > 1048576) erro('logo', 'Il logo deve essere PNG, JPG o WebP fino a 1 MB.');
    $info = @getimagesizefromstring($bin);
    if (!$info || !in_array($info['mime'], ['image/png', 'image/jpeg', 'image/webp'], true)) erro('logo', 'Il logo deve essere PNG, JPG o WebP.');
    $ext = ['image/png' => 'png', 'image/jpeg' => 'jpg', 'image/webp' => 'webp'][$info['mime']];
    $logo = "$id.$ext";
    file_put_contents("$pasta/$logo", $bin, LOCK_EX);
}

$pedido = [
    'id' => $id, 'stato' => 'nuovo', 'creato' => gmdate('c'), 'prodotto' => $prodotto,
    'nome' => $nome, 'instagram' => $instagram, 'tipo' => $tipo, 'istat' => $istat, 'colore' => $colore,
    'descrizione' => $descrizione, 'testo' => $testo, 'whatsapp' => $whatsapp, 'email' => $email, 'logo' => $logo,
    'piano' => preg_match('/^[a-z]{2,20}$/', (string)($d['piano'] ?? '')) ? $d['piano'] : '',
];
file_put_contents("$pasta/$id.json", json_encode($pedido, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT), LOCK_EX);

// aviso por email ao dono do jogo (opcional: defina EMAIL_AVVISI no config.php)
if (defined('EMAIL_AVVISI') && EMAIL_AVVISI) {
    @mail(EMAIL_AVVISI, "Nuova richiesta: $nome ($prodotto)", "Pedido $id\n$nome · $prodotto · ISTAT $istat\nRode: node strumenti/amministra.mjs negozi", 'From: ' . EMAIL_AVVISI);
}
resposta(200, ['ok' => true, 'id' => $id]);
