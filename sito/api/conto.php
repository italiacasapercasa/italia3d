<?php
// Conta do site (js/conto.js). POST JSON {a: ação, ...}. Sessão por cookie httpOnly (icpc_s).
//   codice {email}           manda o código de 6 dígitos por e-mail (vale 15 min)
//   entra {email, codice}    confere o código, cria a conta se for nova e abre a sessão
//   io                       dados da conta (confere sozinho se o @ já foi confirmado)
//   premio                   prêmio do dia: 2 💰 (+20 no 7º dia seguido, +100 no 30º); precisa de @ confirmado com casa
//   collega {conta}          pede o código CASA-1234 para ligar o @ (comentar num post; o robô confere)
//   scollega                 desiste do @ pendente
//   ricarica {pacco}         link de pagamento do pacote (só com crediti.json ricarica_aperta e dentro do limite mensal)
//   esci                     fecha a sessão
declare(strict_types=1);
require __DIR__ . '/_conti.php';

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
function resposta(array $d, int $c = 200): void { http_response_code($c); echo json_encode(['ok' => true] + $d, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES); exit; }
function erro(string $msg, int $c = 400, array $extra = []): void { http_response_code($c); echo json_encode(['ok' => false, 'erro' => $msg] + $extra, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES); exit; }
if ($_SERVER['REQUEST_METHOD'] !== 'POST' || !str_contains((string)($_SERVER['CONTENT_TYPE'] ?? ''), 'json')) erro('Metodo non valido.', 405);

$ip = (string)($_SERVER['REMOTE_ADDR'] ?? '');
if (!conti_limite("ip|$ip", 240, 3600)) erro('Troppe richieste. Riprova tra un po’.', 429);
$d = json_decode((string)file_get_contents('php://input', false, null, 0, 4000), true);
if (!is_array($d)) erro('Richiesta non valida.');
$acao = (string)($d['a'] ?? '');
$cfg = conti_cfg();

// o que o navegador vê da conta
function profilo(array $u): array {
    $cfg = conti_cfg(); $oggi = conti_oggi();
    $serie = $u['serie'] ?? ['n' => 0, 'ultimo' => null];
    $viva = in_array($serie['ultimo'] ?? '', [$oggi, conti_ieri($oggi)], true) ? (int)$serie['n'] : 0;
    return [
        'email' => conti_maschera((string)$u['email']),
        'conta' => $u['conta'] ?? null,
        'attesa' => isset($u['attesa']) ? ['conta' => $u['attesa']['conta'], 'codice' => $u['attesa']['codice']] : null,
        'saldo' => (int)($u['saldo'] ?? 0),
        'serie' => $viva,
        'premio_oggi' => ($serie['ultimo'] ?? '') === $oggi,
        'ultimi' => array_slice((array)($u['ultimi'] ?? []), 0, 10),
        'ricarica' => (bool)($cfg['ricarica_aperta'] ?? false),
    ];
}
// @ pendente já confirmado pelo robô? liga na conta
function conferma_attesa(string $id): ?array {
    $u = conti_leggi($id);
    if (!$u) return null;
    $at = $u['attesa'] ?? null;
    if ($at && conti_vincolato((string)$at['conta'], $id)) {
        conti_assegna_conta((string)$at['conta'], $id);
        $u = conti_modifica($id, function (array &$u) use ($at) { $u['conta'] = $at['conta']; unset($u['attesa']); return $u; });
    }
    return $u;
}

// ---------- sem sessão ----------
if ($acao === 'codice') {
    $email = strtolower(trim((string)($d['email'] ?? '')));
    if (!conti_email_ok($email)) erro('Scrivi un’email valida.');
    if (!conti_limite("email|$email", 5, 3600) || !conti_limite("cod-ip|$ip", 15, 3600)) erro('Hai chiesto troppi codici. Riprova tra un’ora.', 429);
    if (!conti_limite('email-giorno', (int)($cfg['email_giorno_max'] ?? 400), 86400)) erro('Troppe richieste oggi. Riprova domani.', 503);
    $id = conti_id($email);
    $cod = (string)random_int(100000, 999999);
    file_put_contents(conti_dir('codici') . "/$id.json", json_encode(['h' => hash('sha256', $cod . '|' . $id . '|' . APP_SECRET), 'scade' => time() + 900, 'tent' => 0]), LOCK_EX);
    $corpo = "Ciao!\n\nIl tuo codice per entrare in Italia Casa per Casa è:\n\n    $cod\n\nVale 15 minuti. Se non l'hai chiesto tu, ignora questa email: nessuno può entrare senza il codice.\n\nItalia Casa per Casa\nhttps://italiacasapercasa.com";
    // no PC (localhost): nunca manda e-mail, devolve o código na resposta para testar
    if (in_array($ip, ['127.0.0.1', '::1'], true) && preg_match('/^localhost(:\d+)?$/', (string)($_SERVER['HTTP_HOST'] ?? ''))) resposta(['inviato' => true, 'dev_codice' => $cod]);
    [$ok, $info] = conti_smtp($email, "Il tuo codice: $cod", $corpo);
    if (!$ok) { error_log("conto codice: $info"); erro('Non riusciamo a inviare l’email adesso. Riprova tra qualche minuto.', 503); }
    resposta(['inviato' => true]);
}

if ($acao === 'entra') {
    $email = strtolower(trim((string)($d['email'] ?? '')));
    $cod = preg_replace('/\D/', '', (string)($d['codice'] ?? ''));
    if (!conti_email_ok($email) || strlen($cod) !== 6) erro('Codice non valido.');
    $id = conti_id($email);
    $arq = conti_dir('codici') . "/$id.json";
    $c = json_decode((string)@file_get_contents($arq), true);
    if (!is_array($c) || $c['scade'] < time()) { @unlink($arq); erro('Il codice è scaduto. Chiedine uno nuovo.'); }
    if (!hash_equals($c['h'], hash('sha256', $cod . '|' . $id . '|' . APP_SECRET))) {
        $c['tent']++;
        if ($c['tent'] >= 5) { @unlink($arq); erro('Troppi tentativi. Chiedi un nuovo codice.'); }
        file_put_contents($arq, json_encode($c), LOCK_EX);
        erro('Codice sbagliato. Controlla l’email e riprova.');
    }
    @unlink($arq);
    $nuovo = !conti_leggi($id);
    conti_modifica($id, function (array &$u) { $u['ultimo_accesso'] = gmdate('c'); }, $email);
    conti_sessione_crea($id);
    resposta(['nuovo' => $nuovo, 'profilo' => profilo(conferma_attesa($id))]);
}

// ---------- com sessão ----------
$id = conti_sessione_id();
if ($acao === 'io' && !$id) resposta(['profilo' => null]);
if (!$id) erro('Entra nel tuo account per continuare.', 401, ['uscito' => true]);
$u = conferma_attesa($id);
if (!$u) { conti_sessione_chiudi(); erro('Account non trovato. Entra di nuovo.', 401, ['uscito' => true]); }

if ($acao === 'io') resposta(['profilo' => profilo($u)]);

if ($acao === 'esci') { conti_sessione_chiudi(); resposta([]); }

if ($acao === 'collega') {
    $conta = strtolower(ltrim(trim((string)($d['conta'] ?? '')), '@'));
    if (!preg_match('/^[a-z0-9._]{1,30}$/', $conta)) erro('Scrivi il tuo nome Instagram, senza spazi.');
    if (!conti_tem_casa($conta)) erro("@$conta non ha ancora una casa sulla mappa. Commenta la tua città sotto un nostro post per averla, poi torna qui.");
    if (($u['conta'] ?? null) === $conta) resposta(['profilo' => profilo($u)]);
    $cod = conti_codice_collega($conta, $id);
    $u = conti_modifica($id, function (array &$u) use ($conta, $cod) { $u['attesa'] = ['conta' => $conta, 'codice' => $cod, 'em' => gmdate('c')]; return $u; });
    resposta(['profilo' => profilo(conferma_attesa($id) ?? $u)]);
}

if ($acao === 'scollega') {
    $u = conti_modifica($id, function (array &$u) { unset($u['attesa']); return $u; });
    resposta(['profilo' => profilo($u)]);
}

if ($acao === 'premio') {
    $conta = (string)($u['conta'] ?? '');
    if ($conta === '') erro('Collega prima il tuo Instagram per ricevere i crediti del giorno.');
    if (!conti_tem_casa($conta)) erro("@$conta non ha più una casa sulla mappa.");
    $oggi = conti_oggi();
    // um prêmio por @ por dia, mesmo trocando de conta
    $arqDia = conti_dir() . "/premi-$oggi.txt";
    $f = fopen($arqDia, 'c+');
    if (!$f || !flock($f, LOCK_EX)) erro('Riprova tra un attimo.', 503);
    $ja = str_contains("\n" . stream_get_contents($f), "\n$conta\n");
    $r = null;
    if (!$ja) {
        $r = conti_modifica($id, function (array &$u) use ($oggi, $cfg, $conta) {
            $s = $u['serie'] ?? ['n' => 0, 'ultimo' => null];
            if (($s['ultimo'] ?? '') === $oggi) return null;
            $n = ($s['ultimo'] ?? '') === conti_ieri($oggi) ? (int)$s['n'] + 1 : 1;
            $g = $cfg['giornaliero'] ?? ['base' => 2, 'serie' => []];
            $bonus = 0;
            foreach ((array)($g['serie'] ?? []) as [$ogni, $extra]) if ($n % (int)$ogni === 0) { $bonus = (int)$extra; break; }
            $u['serie'] = ['n' => $n, 'ultimo' => $oggi];
            conti_movimento($u, (int)$g['base'] + $bonus, $bonus ? 'serie' : 'giornaliero', "$conta $oggi");
            return ['crediti' => (int)$g['base'] + $bonus, 'bonus' => $bonus, 'serie' => $n];
        });
        if ($r) fwrite($f, "$conta\n");
    }
    flock($f, LOCK_UN); fclose($f);
    if (mt_rand(1, 20) === 1) foreach (glob(conti_dir() . '/premi-*.txt') ?: [] as $v) if (filemtime($v) < time() - 5 * 86400) @unlink($v);
    resposta(['premio' => $r, 'profilo' => profilo(conti_leggi($id))]);
}

if ($acao === 'ricarica') {
    if (!($cfg['ricarica_aperta'] ?? false)) erro('Le ricariche aprono presto!');
    $p = null;
    foreach ((array)($cfg['pacchi'] ?? []) as $x) if ($x['id'] === ($d['pacco'] ?? '')) $p = $x;
    if (!$p || empty($p['checkout'])) erro('Pacchetto non disponibile.');
    $lim = (float)($cfg['limite_mese_euro'] ?? 150);
    if (conti_euro_mese($id) + (float)$p['prezzo'] > $lim) erro("Puoi ricaricare al massimo " . number_format($lim, 0, ',', '.') . " € ogni 30 giorni.");
    $url = $p['checkout'] . (str_contains($p['checkout'], '?') ? '&' : '?') . 'sck=c' . $id . '&email=' . rawurlencode((string)$u['email']);
    resposta(['url' => $url]);
}

erro('Azione sconosciuta.');
