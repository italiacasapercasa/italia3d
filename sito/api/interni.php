<?php
// Interni delle case (js/interni.js). Dados em CARTELLA/conti/interni/<conta>.json + _elenco.json (contas que têm interior).
//   GET  ?elenco=1           lista dos @ com casa arredata (botão «👀 Guarda dentro» nos cartões)
//   GET  ?conta=<@>          o interior de uma casa (público: qualquer um pode visitar)
//   POST {a:'salva', interno} salva o interior da PRÓPRIA casa (sessão; precisa ter comprado "interni" e saldo >= 0)
// interno = {pav: id do piso, par: índice da cor das paredes, ogg: [[tipo, x, z, rot], ...]} (x/z em casas da grade, rot 0..3)
declare(strict_types=1);
require __DIR__ . '/_conti.php';
header('Content-Type: application/json; charset=utf-8');
function resposta(array $d, int $c = 200): void { http_response_code($c); echo json_encode(['ok' => true] + $d, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES); exit; }
function erro(string $msg, int $c = 400): void { http_response_code($c); echo json_encode(['ok' => false, 'erro' => $msg], JSON_UNESCAPED_UNICODE); exit; }
$pasta = conti_dir('interni');
$valida = fn(string $c) => preg_match('/^[a-z0-9._]{1,30}$/', $c) === 1;

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    header('Cache-Control: public, max-age=60');
    if (isset($_GET['elenco'])) resposta(['conte' => array_values(json_decode((string)@file_get_contents("$pasta/_elenco.json"), true) ?: [])]);
    $conta = strtolower((string)($_GET['conta'] ?? ''));
    if (!$valida($conta) || !is_file("$pasta/$conta.json")) erro('Questa casa non è ancora arredata.', 404);
    resposta(['conta' => $conta, 'interno' => json_decode((string)file_get_contents("$pasta/$conta.json"), true)]);
}

header('Cache-Control: no-store');
if ($_SERVER['REQUEST_METHOD'] !== 'POST' || !str_contains((string)($_SERVER['CONTENT_TYPE'] ?? ''), 'json')) erro('Metodo non valido.', 405);
if (!conti_limite('interni|' . ($_SERVER['REMOTE_ADDR'] ?? ''), 120, 3600)) erro('Troppe richieste. Riprova tra un po’.', 429);
$id = conti_sessione_id();
if (!$id) erro('Entra nel tuo account per continuare.', 401);
$u = conti_leggi($id);
$d = json_decode((string)file_get_contents('php://input', false, null, 0, 20000), true);
if (!is_array($d) || ($d['a'] ?? '') !== 'salva') erro('Richiesta non valida.');
$conta = (string)($u['conta'] ?? '');
if ($conta === '') erro('Collega prima il tuo Instagram.');
$own = (array)($u['oggetti'] ?? []);
if (!in_array('interni', $own, true)) erro('Ti serve la casa con interni.');
if ((int)$u['saldo'] < 0) erro('Il tuo saldo è negativo per un rimborso: la casa resta bloccata finché non torna positivo.');

$cfg = conti_cfg();
$pav = array_column((array)($cfg['interni']['pavimenti'] ?? []), 0);
$mob = [];
foreach ((array)($cfg['mobili'] ?? []) as $m) $mob[$m['id']] = (int)$m['prezzo'] === 0 || in_array('mob_' . $m['id'], $own, true);
$i = is_array($d['interno'] ?? null) ? $d['interno'] : [];
$ogg = [];
foreach (array_slice((array)($i['ogg'] ?? []), 0, 80) as $o) {
    if (!is_array($o) || count($o) < 4) continue;
    [$t, $x, $z, $r] = $o;
    if (!is_string($t) || empty($mob[$t]) || !is_int($x) || !is_int($z) || !is_int($r) || $x < 0 || $x > 9 || $z < 0 || $z > 9 || $r < 0 || $r > 3) continue;
    $ogg[] = [$t, $x, $z, $r];
}
$interno = ['pav' => in_array($i['pav'] ?? '', $pav, true) ? $i['pav'] : ($pav[0] ?? 'legno'), 'par' => (is_int($i['par'] ?? null) && $i['par'] >= 0 && $i['par'] < 8) ? $i['par'] : 0, 'ogg' => $ogg, 'agg' => gmdate('c')];
file_put_contents("$pasta/$conta.json", json_encode($interno, JSON_UNESCAPED_SLASHES), LOCK_EX);
// lista dos @ arredati
$f = fopen("$pasta/_elenco.json", 'c+');
if ($f && flock($f, LOCK_EX)) {
    $el = json_decode((string)stream_get_contents($f), true) ?: [];
    if (!in_array($conta, $el, true)) { $el[] = $conta; ftruncate($f, 0); rewind($f); fwrite($f, json_encode($el, JSON_UNESCAPED_SLASHES)); }
    flock($f, LOCK_UN); fclose($f);
}
resposta(['interno' => $interno]);
