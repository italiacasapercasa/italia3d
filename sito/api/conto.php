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
//   esci_tutti               fecha TODAS as sessões da conta (também pelo link GET ?esci_tutti=<token> do e-mail de acesso novo)
// Segurança: e-mail a cada acesso novo (conta já existente), recibo por e-mail a cada recarga/reembolso (_conti.php).
declare(strict_types=1);
require __DIR__ . '/_conti.php';

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
function resposta(array $d, int $c = 200): void { http_response_code($c); echo json_encode(['ok' => true] + $d, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES); exit; }
function erro(string $msg, int $c = 400, array $extra = []): void { http_response_code($c); echo json_encode(['ok' => false, 'erro' => $msg] + $extra, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES); exit; }
// responde já e só depois faz o trabalho lento (e-mail), para a pessoa não esperar o SMTP
function resposta_e_poi(array $d, callable $dopo): void {
    ignore_user_abort(true);
    echo json_encode(['ok' => true] + $d, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    if (function_exists('litespeed_finish_request')) litespeed_finish_request();
    elseif (function_exists('fastcgi_finish_request')) fastcgi_finish_request();
    else flush();
    $dopo();
    exit;
}

// link do e-mail «Non sei stato tu?»: sai de todos os dispositivos (GET, página simples)
if ($_SERVER['REQUEST_METHOD'] === 'GET' && isset($_GET['esci_tutti'])) {
    header('Content-Type: text/html; charset=utf-8');
    $tok = (string)$_GET['esci_tutti'];
    $id = substr($tok, 0, 16);
    $u = preg_match('/^[0-9a-f]{16}\.[0-9a-f]{24}$/', $tok) ? conti_leggi($id) : null;
    $ok = $u && hash_equals(conti_token_revoca($id, (int)($u['gen'] ?? 0)), $tok);
    if ($ok) conti_revoca_tutti($id);
    $msg = $ok ? '✅ Fatto: il tuo account è uscito da tutti i dispositivi.<br>Per rientrare serve un nuovo codice, che arriva solo sulla tua email.'
               : 'Questo link è già stato usato o non è più valido: se l’hai già toccato, i dispositivi sono già stati disconnessi.';
    echo '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Account · Italia Casa per Casa</title>'
        . '<body style="margin:0;background:#8EBFD2;font-family:system-ui,sans-serif;color:#152033"><main style="max-width:480px;margin:40px auto;background:#fff;border:4px solid #152033;border-radius:24px;padding:24px;font-weight:700;line-height:1.5">'
        . "<h1 style=\"font-size:22px\">🔒 Sicurezza dell’account</h1><p>$msg</p><p><a href=\"/#conto\" style=\"color:#152033\">Torna alla mappa</a></p></main>";
    exit;
}
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
        'pg' => $u['pg'] ?? null,
        'oggetti' => array_values((array)($u['oggetti'] ?? [])),
        'ricarica' => (bool)($cfg['ricarica_aperta'] ?? false),
        'proprietario' => !empty($u['proprietario']),
        'tesori' => (($u['tesori']['giorno'] ?? '') === $oggi) ? array_values((array)$u['tesori']['presi']) : [],
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
    if (conti_e_proprietario($email)) resposta(['inviato' => true]);   // dono: código fixo, nenhum e-mail
    $id = conti_id($email);
    $cod = (string)random_int(100000, 999999);
    file_put_contents(conti_dir('codici') . "/$id.json", json_encode(['h' => hash('sha256', $cod . '|' . $id . '|' . APP_SECRET), 'scade' => time() + 900, 'tent' => 0]), LOCK_EX);
    $corpo = "Ciao!\n\nIl tuo codice per entrare in Italia Casa per Casa è:\n\n    $cod\n\nVale 15 minuti. Se non l'hai chiesto tu, ignora questa email: nessuno può entrare senza il codice.\n\nItalia Casa per Casa\nhttps://italiacasapercasa.com";
    // no PC (localhost): nunca manda e-mail, devolve o código na resposta para testar
    if (conti_locale()) resposta(['inviato' => true, 'dev_codice' => $cod]);
    [$ok, $info] = conti_smtp($email, "Il tuo codice: $cod", $corpo);
    if (!$ok) { error_log("conto codice: $info"); erro('Non riusciamo a inviare l’email adesso. Riprova tra qualche minuto.', 503); }
    resposta(['inviato' => true]);
}

if ($acao === 'entra') {
    $email = strtolower(trim((string)($d['email'] ?? '')));
    $cod = preg_replace('/\D/', '', (string)($d['codice'] ?? ''));
    if (!conti_email_ok($email) || strlen($cod) !== 6) erro('Codice non valido.');
    $id = conti_id($email);
    if (conti_e_proprietario($email)) {
        if (!conti_limite("prop-ip|$ip", 10, 3600) || !conti_limite('prop', 40, 3600)) erro('Troppi tentativi. Riprova tra un’ora.', 429);
        if (!password_verify($cod, conti_proprietario()['hash'])) erro('Codice sbagliato. Controlla l’email e riprova.');
        $gen = conti_modifica($id, function (array &$u) {
            $u['proprietario'] = true; $u['ultimo_accesso'] = gmdate('c');
            if ((int)($u['saldo'] ?? 0) < 500000) conti_movimento($u, 1000000 - (int)($u['saldo'] ?? 0), 'regalo', 'crediti di prova del proprietario');
            return (int)($u['gen'] ?? 0);
        }, $email);
        conti_sessione_crea($id, $gen);
        resposta(['nuovo' => false, 'profilo' => profilo(conti_leggi($id))]);
    }
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
    $gen = conti_modifica($id, function (array &$u) { $u['ultimo_accesso'] = gmdate('c'); return (int)($u['gen'] ?? 0); }, $email);
    conti_sessione_crea($id, $gen);
    $prof = profilo(conferma_attesa($id));
    if ($nuovo) resposta(['nuovo' => true, 'profilo' => $prof]);
    // conta que já existia: avisa por e-mail do acesso novo, com o link para sair de todos os dispositivos
    resposta_e_poi(['nuovo' => false, 'profilo' => $prof], function () use ($email, $id, $gen) {
        $link = 'https://italiacasapercasa.com/api/conto.php?esci_tutti=' . conti_token_revoca($id, $gen);
        $corpo = "Ciao!\n\nC'è stato un nuovo accesso al tuo account di Italia Casa per Casa:\n\n"
            . "• Quando: " . conti_ora_roma() . " (ora italiana)\n• Dispositivo: " . conti_dispositivo() . "\n\n"
            . "Se l'accesso è tuo, non devi fare niente.\n\n"
            . "Non riconosci questo accesso? Tocca qui per uscire da tutti i dispositivi:\n$link\n\n"
            . "Senza il codice che arriva su questa email nessuno può entrare nel tuo account.\n\nItalia Casa per Casa\nhttps://italiacasapercasa.com";
        conti_smtp($email, 'Nuovo accesso al tuo account', $corpo);
    });
}

// ---------- com sessão ----------
$id = conti_sessione_id();
if ($acao === 'io' && !$id) resposta(['profilo' => null]);
if (!$id) erro('Entra nel tuo account per continuare.', 401, ['uscito' => true]);
$u = conferma_attesa($id);
if (!$u) { conti_sessione_chiudi(); erro('Account non trovato. Entra di nuovo.', 401, ['uscito' => true]); }

if ($acao === 'io') resposta(['profilo' => profilo($u)]);

if ($acao === 'esci') { conti_sessione_chiudi(); resposta([]); }

if ($acao === 'esci_tutti') { conti_revoca_tutti($id); conti_sessione_chiudi(); resposta([]); }

if ($acao === 'collega') {
    $conta = strtolower(ltrim(trim((string)($d['conta'] ?? '')), '@'));
    if (!preg_match('/^[a-z0-9._]{1,30}$/', $conta)) erro('Scrivi il tuo nome Instagram, senza spazi.');
    if (!conti_tem_casa($conta)) erro("@$conta non ha ancora una casa sulla mappa. Commenta la tua città sotto un nostro post per averla, poi torna qui.");
    if (($u['conta'] ?? null) === $conta) resposta(['profilo' => profilo($u)]);
    // dono: usa qualquer casa para testar, na hora, SEM tirar o @ do jogador (não mexe em conte.json)
    if (!empty($u['proprietario'])) resposta(['profilo' => profilo(conti_modifica($id, function (array &$u) use ($conta) { $u['conta'] = $conta; unset($u['attesa']); return $u; }))]);
    $cod = conti_codice_collega($conta, $id);
    $u = conti_modifica($id, function (array &$u) use ($conta, $cod) { $u['attesa'] = ['conta' => $conta, 'codice' => $cod, 'em' => gmdate('c')]; return $u; });
    resposta(['profilo' => profilo(conferma_attesa($id) ?? $u)]);
}

// personagem da passeggiata (opções grátis iguais às de js/personaggio.js OPZ; itens pagos virão da loja, fase 3)
if ($acao === 'personaggio') {
    $p = is_array($d['pg'] ?? null) ? $d['pg'] : [];
    $c = (string)($p['c'] ?? '');
    $CAP = ['uomo' => ['corti', 'ciuffo', 'ricci', 'rasati', 'calvo'], 'donna' => ['lunghi', 'coda', 'caschetto', 'ricci', 'chignon']];
    if (!isset($CAP[$c])) erro('Scegli Uomo o Donna.');
    $n = fn($k, $max) => (is_int($p[$k] ?? null) && $p[$k] >= 0 && $p[$k] < $max) ? $p[$k] : 0;
    $pg = ['c' => $c, 'pelle' => $n('pelle', 5), 'capelli' => in_array($p['capelli'] ?? '', $CAP[$c], true) ? $p['capelli'] : $CAP[$c][0],
        'colCap' => $n('colCap', 6), 'maglia' => $n('maglia', 8), 'pant' => $n('pant', 8), 'gonna' => $c === 'donna' && !empty($p['gonna'])];
    // itens pagos vestidos: só os que a conta comprou (pg_<id>); 1 chapéu e 1 roupa especial de cada vez
    $own = (array)($u['oggetti'] ?? []);
    $acc = array_values(array_filter(array_unique(array_map('strval', (array)($p['acc'] ?? []))), fn($a) => in_array("pg_$a", $own, true)));
    $GRUPPI = [['cappello', 'borsalino', 'natale'], ['tifoso', 'elegante', 'carnevale', 'natale']];
    foreach ($GRUPPI as $gr) { $dentro = array_values(array_intersect($acc, $gr)); if (count($dentro) > 1) $acc = array_values(array_diff($acc, array_slice($dentro, 1))); }
    if ($acc) $pg['acc'] = array_slice($acc, 0, 6);
    if (in_array('tifoso', $acc, true)) $pg['squadra'] = $n('squadra', 9);
    $u = conti_modifica($id, function (array &$u) use ($pg) { $u['pg'] = $pg; return $u; });
    resposta(['profilo' => profilo($u)]);
}

// loja: compra com créditos (preço do servidor, recibo por e-mail)
if ($acao === 'compra') {
    if ((int)$u['saldo'] < 0) erro('Il tuo saldo è negativo per un rimborso: ricarica per tornare a comprare.');
    [$nuovo, $e] = conti_compra($id, (string)($d['item'] ?? ''));
    if ($e) erro($e);
    resposta(['profilo' => profilo($nuovo)]);
}

if ($acao === 'scollega') {
    $u = conti_modifica($id, function (array &$u) { unset($u['attesa']); return $u; });
    resposta(['profilo' => profilo($u)]);
}

if ($acao === 'premio') {
    if (!empty($u['proprietario'])) erro('Account del proprietario: il premio del giorno resta ai giocatori.');
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

// caccia al tesoro (passeggiata): 1 baú por cidade por dia + 1 na frente de cada loja; no máximo N por dia (crediti.json "tesori")
if ($acao === 'tesoro') {
    $conta = (string)($u['conta'] ?? '');
    if ($conta === '') erro('Collega prima il tuo Instagram per raccogliere i tesori.');
    if (!conti_limite("tesoro|$id", 30, 3600)) erro('Troppi tesori in poco tempo. Riprova più tardi.', 429);
    $T = $cfg['tesori'] ?? ['citta' => 2, 'negozio' => 3, 'max' => 5];
    $tipo = (string)($d['tipo'] ?? ''); $rif = (string)($d['id'] ?? '');
    if ($tipo === 'citta' && preg_match('/^\d{1,6}$/', $rif)) $k = "c$rif";
    elseif ($tipo === 'negozio' && preg_match('/^[a-z0-9-]{4,40}$/i', $rif)) $k = "n$rif";
    else erro('Tesoro non valido.');
    $val = (int)($T[$tipo] ?? 2); $max = (int)($T['max'] ?? 5); $oggi = conti_oggi();
    $r = conti_modifica($id, function (array &$u) use ($k, $val, $max, $oggi) {
        $t = $u['tesori'] ?? [];
        if (($t['giorno'] ?? '') !== $oggi) $t = ['giorno' => $oggi, 'presi' => []];
        if (in_array($k, $t['presi'], true)) return ['gia' => true, 'n' => count($t['presi'])];
        if (count($t['presi']) >= $max) return ['pieno' => true, 'n' => count($t['presi'])];
        $t['presi'][] = $k; $u['tesori'] = $t;
        conti_movimento($u, $val, 'tesoro', "$k $oggi");
        return ['crediti' => $val, 'n' => count($t['presi'])];
    });
    resposta(['tesoro' => $r + ['max' => $max], 'profilo' => profilo(conti_leggi($id))]);
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
