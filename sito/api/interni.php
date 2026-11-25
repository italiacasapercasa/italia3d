<?php
// Interni delle case (js/interni.js). Dados em CARTELLA/conti/interni/<conta>.json + _elenco.json (contas que têm interior).
//   GET  ?elenco=1           lista dos @ com casa arredata (botão «👀 Guarda dentro» nos cartões)
//   GET  ?conta=<@>          o interior de uma casa (público: qualquer um pode visitar)
//   POST {a:'salva', interno} salva o interior da PRÓPRIA casa (sessão; precisa ter comprado "interni" e saldo >= 0)
// interno = {v: 2, pav, par, stanze: {cômodo: {pav, par}}, ogg: [[tipo, x, z, rot], ...]} (x/z em casas da grade, rot 0..3;
// decoração de parede: rot = lado da célula onde está a parede). Formato antigo (sem v) = 1 cômodo: o js converte ao abrir.
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
    // dono do jogo testando: lê a versão de prova dele (a casa do jogador fica intacta)
    if ($valida($conta) && isset($_GET['prova'])) {
        header('Cache-Control: no-store');
        $sid = conti_sessione_id(); $su = $sid ? conti_leggi($sid) : null;
        if (!empty($su['proprietario']) && is_file("$pasta/_prova/$conta.json")) resposta(['conta' => $conta, 'interno' => json_decode((string)file_get_contents("$pasta/_prova/$conta.json"), true)]);
        // sem versão de prova ainda: começa do interior real do jogador (só leitura), se existir
    }
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
// v2 (22/11): casa inteira 14 x 10 com 5 cômodos; piso e paredes por cômodo (a geometria fica em js/interni.js)
$ogg = [];
foreach (array_slice((array)($i['ogg'] ?? []), 0, 160) as $o) {
    if (!is_array($o) || count($o) < 4) continue;
    [$t, $x, $z, $r] = $o;
    if (!is_string($t) || empty($mob[$t]) || !is_int($x) || !is_int($z) || !is_int($r) || $x < 0 || $x > 13 || $z < 0 || $z > 9 || $r < 0 || $r > 3) continue;
    $c = $o[4] ?? 0;   // 25/11: variante de cor do móvel (opcional)
    $ogg[] = is_int($c) && $c > 0 && $c < 16 ? [$t, $x, $z, $r, $c] : [$t, $x, $z, $r];
}
$okPav = fn($p) => in_array($p, $pav, true);
$nPar = max(8, count((array)($cfg['interni']['pareti'] ?? [])));
$okPar = fn($p) => is_int($p) && $p >= 0 && $p < $nPar;
$stanze = [];
foreach (['camera', 'bagno', 'studio', 'soggiorno', 'cucina'] as $s) {
    $x = (array)($i['stanze'][$s] ?? []);
    if ($okPav($x['pav'] ?? null) && $okPar($x['par'] ?? null)) $stanze[$s] = ['pav' => $x['pav'], 'par' => $x['par']];
}
$interno = ['v' => 2, 'pav' => $okPav($i['pav'] ?? null) ? $i['pav'] : ($pav[0] ?? 'legno'), 'par' => $okPar($i['par'] ?? null) ? $i['par'] : 0, 'stanze' => (object)$stanze, 'ogg' => $ogg, 'agg' => gmdate('c')];
if (!empty($u['proprietario'])) {   // dono testando: pasta de prova, fora da lista pública
    if (!is_dir("$pasta/_prova")) mkdir("$pasta/_prova", 0750, true);
    file_put_contents("$pasta/_prova/$conta.json", json_encode($interno, JSON_UNESCAPED_SLASHES), LOCK_EX);
    resposta(['interno' => $interno]);
}
file_put_contents("$pasta/$conta.json", json_encode($interno, JSON_UNESCAPED_SLASHES), LOCK_EX);
// lista dos @ arredati
$f = fopen("$pasta/_elenco.json", 'c+');
if ($f && flock($f, LOCK_EX)) {
    $el = json_decode((string)stream_get_contents($f), true) ?: [];
    if (!in_array($conta, $el, true)) { $el[] = $conta; ftruncate($f, 0); rewind($f); fwrite($f, json_encode($el, JSON_UNESCAPED_SLASHES)); }
    flock($f, LOCK_UN); fclose($f);
}
resposta(['interno' => $interno]);
