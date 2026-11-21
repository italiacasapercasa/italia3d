<?php
// Missioni del sito: "Indovina del giorno" (missioni.js). Um enigma por dia (fuso de Roma), uma partida por conta e por celular.
// As respostas ficam em privato/enigmi.json (nunca no site). O tempo é medido aqui (início -> resposta), não no navegador.
// Partidas terminadas: CARTELLA/missioni/giocate.jsonl (o robô do GitHub baixa e o motor dá os pontos).
// Vínculo conta+celular: código CASA-1234 por par em CARTELLA/missioni/codici.json; o robô procura o código nos
// comentários da própria conta e devolve os pares confirmados em CARTELLA/missioni/vincolati.json.
// Celular = id aleatório do navegador; aqui só se guarda o hash dele (com APP_SECRET).
declare(strict_types=1);
require is_file(__DIR__ . '/../../privato/config.php') ? __DIR__ . '/../../privato/config.php' : __DIR__ . '/../privato/config.php';

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
function resposta(int $codigo, array $dados): void { http_response_code($codigo); echo json_encode($dados, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES); exit; }
function erro(string $msg, int $codigo = 400): void { resposta($codigo, ['ok' => false, 'erro' => $msg]); }
if ($_SERVER['REQUEST_METHOD'] !== 'POST') resposta(405, ['ok' => false]);

$pasta = CARTELLA . '/missioni';
if (!is_dir($pasta)) mkdir($pasta, 0750, true);
date_default_timezone_set('Europe/Rome');
$agora = (int)round(microtime(true) * 1000);

// limite por IP: 150 pedidos por hora
$ip = hash('sha256', (string)($_SERVER['REMOTE_ADDR'] ?? '') . APP_SECRET);
$arqIp = $pasta . '/.limite-' . substr($ip, 0, 16);
$seg = time();
$tent = array_filter(is_file($arqIp) ? array_map('intval', file($arqIp, FILE_IGNORE_NEW_LINES)) : [], fn($t) => $t > $seg - 3600);
if (count($tent) >= 150) erro('Troppe richieste. Riprova tra un po’.', 429);
$tent[] = $seg;
file_put_contents($arqIp, implode("\n", $tent), LOCK_EX);
foreach (glob("$pasta/.limite-*") ?: [] as $v) if (filemtime($v) < $seg - 7200) @unlink($v);

$d = json_decode((string)file_get_contents('php://input', false, null, 0, 4000), true);
if (!is_array($d)) erro('Richiesta non valida.');
$acao = (string)($d['a'] ?? '');
$conta = strtolower(ltrim(trim((string)($d['conta'] ?? '')), '@'));
$dev = (string)($d['dev'] ?? '');
if (!preg_match('/^[a-z0-9._]{1,30}$/', $conta)) erro('Account non valido.');
if (!preg_match('/^[a-f0-9]{32}$/', $dev)) erro('Ricarica la pagina e riprova.');
$devh = substr(hash('sha256', $dev . APP_SECRET), 0, 16);
$ipDia = substr($ip, 0, 12);

// a conta precisa ter casa no mapa: lista de contas em cache (refeita quando o snapshot muda)
function temCasa(string $pasta, string $conta): bool {
    $snap = __DIR__ . '/../data/snapshot.json';
    $cache = "$pasta/.conte.txt";
    if (!is_file($cache) || filemtime($cache) < @filemtime($snap)) {
        $s = json_decode((string)@file_get_contents($snap), true);
        $lista = array_map(fn($c) => (string)$c[0], (array)($s['case'] ?? []));
        if (!$lista) return true;   // snapshot ilegível: não bloqueia o jogo
        file_put_contents($cache, "\n" . implode("\n", $lista) . "\n", LOCK_EX);
    }
    return str_contains((string)file_get_contents($cache), "\n$conta\n");
}
if (!temCasa($pasta, $conta)) erro("@$conta non ha ancora una casa sulla mappa. Commenta la tua città sotto un post per averla!");

// enigma do dia
$arqE = is_file(__DIR__ . '/../../privato/enigmi.json') ? __DIR__ . '/../../privato/enigmi.json' : __DIR__ . '/../privato/enigmi.json';
$E = json_decode((string)@file_get_contents($arqE), true);
if (!is_array($E) || empty($E['enigmi'])) erro('Le missioni tornano presto.', 503);
$oggi = date('Y-m-d');
$dias = (int)round((strtotime("$oggi 12:00") - strtotime("{$E['inizio']} 12:00")) / 86400);
if ($dias < 0) erro('Le missioni iniziano presto!', 503);
$enigma = $E['enigmi'][$dias % count($E['enigmi'])];
$numero = $dias + 1;

// código de vínculo (um por conta+celular)
function codice(string $pasta, string $conta, string $devh): string {
    $f = fopen("$pasta/codici.json", 'c+');
    if (!$f || !flock($f, LOCK_EX)) erro('Riprova tra un attimo.', 503);
    $c = json_decode((string)stream_get_contents($f), true) ?: [];
    $k = "$conta|$devh";
    if (!isset($c[$k])) {
        $usati = [];
        foreach ($c as $kk => $v) if (str_starts_with($kk, "$conta|")) $usati[$v] = 1;
        do { $novo = 'CASA-' . random_int(1000, 9999); } while (isset($usati[$novo]));
        $c[$k] = $novo;
        ftruncate($f, 0); rewind($f);
        fwrite($f, json_encode($c, JSON_UNESCAPED_SLASHES));
    }
    flock($f, LOCK_UN); fclose($f);
    return $c[$k];
}
function vincolato(string $pasta, string $conta, string $devh): bool {
    $v = json_decode((string)@file_get_contents("$pasta/vincolati.json"), true);
    return is_array($v) && in_array("$conta|$devh", (array)($v['coppie'] ?? []), true);
}

// estado do dia: { p: {conta: partida}, d: {devh: conta}, ip: {ip: [contas]} }
foreach (glob("$pasta/giorno-*.json") ?: [] as $v) if (filemtime($v) < $seg - 40 * 86400) @unlink($v);   // estados de dias antigos
$fd = fopen("$pasta/giorno-$oggi.json", 'c+');
if (!$fd || !flock($fd, LOCK_EX)) erro('Riprova tra un attimo.', 503);
$G = json_decode((string)stream_get_contents($fd), true) ?: ['p' => [], 'd' => [], 'ip' => []];
$mudou = false;
$salvar = function () use (&$G, $fd, &$mudou) { if ($mudou) { ftruncate($fd, 0); rewind($fd); fwrite($fd, json_encode($G, JSON_UNESCAPED_SLASHES)); } flock($fd, LOCK_UN); fclose($fd); };

// o que o navegador vê da partida (a resposta só depois de terminar)
$vista = function (?array $p) use ($enigma, $numero) {
    if (!$p) return null;
    $v = ['indizi' => array_slice($enigma['indizi'], 0, ($p['fine'] ?? false) ? 3 : $p['n']), 'n' => $p['n'], 'fine' => (bool)($p['fine'] ?? false), 'numero' => $numero];
    if ($v['fine']) $v += ['ok' => $p['ok'], 'punteggio' => $p['pt'], 'ms' => $p['ms'], 'risposta' => $enigma['istat'], 'tentativo' => $p['istat']];
    else $v['trascorsi'] = (int)round(microtime(true) * 1000) - $p['t0'];
    return $v;
};
// Torre di Pisa: a 1ª partida do dia vale; o servidor mede o tempo e não aceita mais andares do que dá para empilhar
$vistaPisa = fn(?array $p) => $p ? ['fine' => (bool)($p['fine'] ?? false), 'piani' => (int)($p['piani'] ?? 0), 'punteggio' => (int)($p['pt'] ?? 0)] : null;
$minha = function () use (&$G, $conta, $devh) {
    $p = $G['p'][$conta] ?? null;
    if ($p && $p['v'] !== $devh) { return 'altro_tel'; }
    return $p;
};

if ($acao === 'stato') {
    $p = $minha();
    $outra = $G['d'][$devh] ?? null;
    $r = ['ok' => true, 'numero' => $numero, 'codice' => codice($pasta, $conta, $devh), 'vincolato' => vincolato($pasta, $conta, $devh), 'partita' => is_array($p) ? $vista($p) : null,
        'pisa' => $vistaPisa($G['pisa'][$conta] ?? null)];
    if ($p === 'altro_tel') $r['avviso'] = "Oggi @$conta ha già giocato da un altro telefono.";
    elseif ($outra && $outra !== $conta) $r['avviso'] = "Da questo telefono oggi ha già giocato @$outra.";
    $salvar();
    resposta(200, $r);
}

if ($acao === 'inizia') {
    $p = $minha();
    if ($p === 'altro_tel') { $salvar(); erro("Oggi @$conta ha già giocato da un altro telefono."); }
    if (!$p) {
        $outra = $G['d'][$devh] ?? null;
        if ($outra && $outra !== $conta) { $salvar(); erro("Da questo telefono oggi ha già giocato @$outra. Una partita al giorno per telefono."); }
        $daIp = $G['ip'][$ipDia] ?? [];
        if (!in_array($conta, $daIp, true) && count($daIp) >= 8) { $salvar(); erro('Troppe partite da questa connessione oggi.', 429); }
        $G['p'][$conta] = $p = ['v' => $devh, 't0' => $agora, 'n' => 1];
        $G['d'][$devh] = $conta;
        $G['ip'][$ipDia] = array_values(array_unique([...$daIp, $conta]));
        $mudou = true;
    }
    $salvar();
    resposta(200, ['ok' => true, 'partita' => $vista($p)]);
}

if ($acao === 'indizio') {
    $p = $minha();
    if (!is_array($p) || ($p['fine'] ?? false)) { $salvar(); erro('Nessuna partita in corso.'); }
    if ($p['n'] < 3) { $G['p'][$conta]['n'] = ++$p['n']; $mudou = true; }
    $salvar();
    resposta(200, ['ok' => true, 'partita' => $vista($p)]);
}

if ($acao === 'rispondi') {
    $istat = (string)($d['istat'] ?? '');
    if (!preg_match('/^\d{6}$/', $istat)) { $salvar(); erro('Scegli un comune dalla lista.'); }
    $p = $minha();
    if (!is_array($p)) { $salvar(); erro('Nessuna partita in corso.'); }
    if (!($p['fine'] ?? false)) {
        $ok = $istat === $enigma['istat'];
        $ms = max(0, $agora - $p['t0']);
        // pontos do ranking: 300 com 1 indizio, 200 com 2, 100 com 3; + bônus de velocidade (até 100, zera em 200 s)
        $pt = $ok ? (400 - 100 * $p['n']) + max(0, 100 - intdiv($ms, 2000)) : 0;
        $p = $G['p'][$conta] = $p + ['fine' => true, 'ok' => $ok, 'istat' => $istat, 'ms' => $ms, 'pt' => $pt];
        $mudou = true;
        $linha = ['g' => 'indovina', 'd' => $oggi, 'c' => $conta, 'v' => $devh, 'ok' => $ok, 'p' => $pt, 'n' => $p['n'], 'ms' => $ms, 'ts' => $agora];
        file_put_contents("$pasta/giocate.jsonl", json_encode($linha, JSON_UNESCAPED_SLASHES) . "\n", FILE_APPEND | LOCK_EX);
    }
    $salvar();
    resposta(200, ['ok' => true, 'partita' => $vista($p)]);
}

if ($acao === 'pisa_inizia' || $acao === 'pisa_fine') {
    $P = $G['pisa'][$conta] ?? null;
    if ($P && $P['v'] !== $devh) { $salvar(); erro("Oggi @$conta ha già giocato alla Torre da un altro telefono."); }
    $outra = $G['d'][$devh] ?? null;
    if (!$P && $outra && $outra !== $conta) { $salvar(); erro("Da questo telefono oggi ha già giocato @$outra. Una partita al giorno per telefono."); }
    if ($acao === 'pisa_inizia') {
        if (!$P) { $G['pisa'][$conta] = $P = ['v' => $devh, 't0' => $agora]; $G['d'][$devh] = $conta; $mudou = true; }
        $salvar();
        resposta(200, ['ok' => true, 'pisa' => $vistaPisa($P)]);
    }
    if (!$P) { $salvar(); erro('Nessuna partita in corso.'); }
    if (!($P['fine'] ?? false)) {
        $ms = max(0, $agora - $P['t0']);
        $piani = max(0, min(80, (int)($d['piani'] ?? 0), intdiv($ms, 450) + 1));   // ~0,45 s por andar no mínimo
        $ok = $piani >= 8;
        $pt = min(400, $piani * 12);
        $P = $G['pisa'][$conta] = $P + ['fine' => true, 'piani' => $piani, 'pt' => $pt, 'ms' => $ms];
        $mudou = true;
        $linha = ['g' => 'pisa', 'd' => $oggi, 'c' => $conta, 'v' => $devh, 'ok' => $ok, 'p' => $pt, 'n' => $piani, 'ms' => $ms, 'ts' => $agora];
        file_put_contents("$pasta/giocate.jsonl", json_encode($linha, JSON_UNESCAPED_SLASHES) . "\n", FILE_APPEND | LOCK_EX);
    }
    $salvar();
    resposta(200, ['ok' => true, 'pisa' => $vistaPisa($P)]);
}

$salvar();
erro('Azione non valida.');
