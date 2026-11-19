<?php
// Contador de visitas anônimo, sem cookies e sem guardar IP: só soma números por dia em CARTELLA/visite/AAAA-MM-DD.json.
// Visitantes únicos: hash de IP + navegador + um "sal" que muda todo dia e é apagado no dia seguinte (não dá para
// reconhecer a mesma pessoa em outro dia). Recebe sendBeacon do site: {t: 'v' (visita) | 'ok' (mapa carregou), p: página}.
declare(strict_types=1);
require is_file(__DIR__ . '/../../privato/config.php') ? __DIR__ . '/../../privato/config.php' : __DIR__ . '/../privato/config.php';
http_response_code(204);
if ($_SERVER['REQUEST_METHOD'] !== 'POST') exit;
$ua = (string)($_SERVER['HTTP_USER_AGENT'] ?? '');
if ($ua === '' || preg_match('/bot|crawl|spider|slurp|preview|headless|lighthouse|facebookexternalhit/i', $ua)) exit;

$d = json_decode((string)file_get_contents('php://input', false, null, 0, 2000), true);
if (!is_array($d)) exit;
$tipo = ($d['t'] ?? '') === 'ok' ? 'ok' : 'v';
// etiquetas ?da= aceitas: bio/storia/reel/post/dm = links que nós colocamos; gioco/invito/citta/tabellone = botões de compartilhar do site
const CANALI = ['bio', 'storia', 'reel', 'post', 'dm', 'gioco', 'invito', 'citta', 'tabellone'];
$pagina = preg_match('/^[a-z0-9_-]{1,30}$/', (string)($d['p'] ?? '')) ? $d['p'] : 'altro';

$pasta = CARTELLA . '/visite';
if (!is_dir($pasta)) mkdir($pasta, 0750, true);
date_default_timezone_set('Europe/Rome');
$dia = date('Y-m-d');
$ora = date('H');

// sal do dia (os de dias anteriores são apagados)
$arqSal = "$pasta/.sale-$dia";
if (!is_file($arqSal)) {
    foreach (glob("$pasta/.sale-*") ?: [] as $v) @unlink($v);
    foreach (glob("$pasta/.unici-*") ?: [] as $v) if ($v !== "$pasta/.unici-$dia") @unlink($v);
    file_put_contents($arqSal, bin2hex(random_bytes(16)), LOCK_EX);
}
$quem = substr(hash('sha256', file_get_contents($arqSal) . ($_SERVER['REMOTE_ADDR'] ?? '') . $ua), 0, 16);

$f = fopen("$pasta/$dia.json", 'c+');
if (!$f || !flock($f, LOCK_EX)) exit;
$s = json_decode((string)stream_get_contents($f), true) ?: ['visite' => 0, 'unici' => 0, 'caricate' => 0, 'ore' => [], 'pagine' => [], 'fonti' => [], 'dispositivi' => []];
$inc = function (string $grupo, string $k) use (&$s) { $s[$grupo][$k] = ($s[$grupo][$k] ?? 0) + 1; };
if ($tipo === 'ok') {
    $s['caricate']++;
} else {
    $s['visite']++;
    $inc('ore', $ora);
    $inc('pagine', $pagina);
    // origem: app do Instagram (o referrer vem vazio lá), outro site, ou direto
    $ref = (string)(parse_url((string)($d['ref'] ?? ''), PHP_URL_HOST) ?? '');
    $fonte = preg_match('/Instagram/i', $ua) ? 'instagram-app' : (preg_match('/FBAN|FBAV/i', $ua) ? 'facebook-app'
        : ($ref !== '' && !str_contains($ref, 'italiacasapercasa') ? substr(preg_replace('/^www\./', '', $ref), 0, 40) : 'diretto'));
    $inc('fonti', $fonte);
    // canal: etiqueta ?da= do link (bio do perfil, link compartilhado pelo site...). Sem etiqueta: app do IG ou o resto.
    $da = (string)($d['da'] ?? '');
    $canale = in_array($da, CANALI, true) ? $da : ($da !== '' ? 'altra-etichetta' : ($fonte === 'instagram-app' ? 'ig-senza-etichetta' : 'senza-etichetta'));
    $inc('canali', $canale);
    $so = preg_match('/iPhone|iPad/i', $ua) ? 'ios' : (preg_match('/Android/i', $ua) ? 'android' : 'computer');
    $inc('dispositivi', $so);
    // único do dia
    $arqU = "$pasta/.unici-$dia";
    $vistos = is_file($arqU) ? (string)file_get_contents($arqU) : '';
    $novo = '';
    if (!str_contains($vistos, "$quem\n")) { $novo .= "$quem\n"; $s['unici']++; }
    if (!str_contains($vistos, "$canale:$quem\n")) { $novo .= "$canale:$quem\n"; $inc('canali_unici', $canale); }
    if ($novo !== '') file_put_contents($arqU, $novo, FILE_APPEND | LOCK_EX);
}
ftruncate($f, 0); rewind($f);
fwrite($f, json_encode($s, JSON_UNESCAPED_SLASHES));
flock($f, LOCK_UN); fclose($f);
