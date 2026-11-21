<?php
// Contas do site (entrar com e-mail + código de 6 dígitos, sem senha) e carteira de créditos 💰 (1 € = 100).
// Usado por api/conto.php (site) e api/hotmart.php (recargas). Não é chamado direto pelo navegador.
// Tudo em CARTELLA/conti/:
//   utenti/<id>.json        conta: e-mail, @ ligado, saldo, série do prêmio diário, últimos movimentos
//   movimenti.jsonl         TODOS os movimentos de crédito (livro-caixa; nunca apagar)
//   sessioni/<hash>.json    sessões abertas (cookie icpc_s; só o hash do token fica aqui)
//   codici/<id>.json        código de login pendente (só o hash; vale 15 min, 5 tentativas)
//   conte.json              índice @ -> id (um @ só pode estar ligado a uma conta)
//   premi-AAAA-MM-DD.txt    @ que já pegaram o prêmio do dia (bloqueia pegar 2 vezes trocando de conta)
//   transazioni.json        recargas da Hotmart já processadas (não credita 2 vezes)
//   .limite-*               limites por IP / por e-mail
// id da conta = hash do e-mail (com APP_SECRET): a Hotmart manda o e-mail do comprador e acha a conta sem cadastro extra.
declare(strict_types=1);
if (realpath((string)($_SERVER['SCRIPT_FILENAME'] ?? '')) === __FILE__) { http_response_code(404); exit; }
require_once is_file(__DIR__ . '/../../privato/config.php') ? __DIR__ . '/../../privato/config.php' : __DIR__ . '/../privato/config.php';

const CONTI_COOKIE = 'icpc_s';
const CONTI_SESSIONE_GIORNI = 180;

function conti_dir(string $sub = ''): string {
    $d = CARTELLA . '/conti' . ($sub !== '' ? "/$sub" : '');
    if (!is_dir($d)) mkdir($d, 0750, true);
    return $d;
}
function conti_cfg(): array {
    static $c = null;
    return $c ??= (json_decode((string)@file_get_contents(__DIR__ . '/../data/crediti.json'), true) ?: []);
}
function conti_oggi(): string { $t = new DateTime('now', new DateTimeZone('Europe/Rome')); return $t->format('Y-m-d'); }
function conti_ieri(string $d): string { return (new DateTime("$d 12:00", new DateTimeZone('Europe/Rome')))->modify('-1 day')->format('Y-m-d'); }

function conti_email_ok(string $e): bool { return strlen($e) <= 120 && (bool)filter_var($e, FILTER_VALIDATE_EMAIL); }
function conti_id(string $email): string { return substr(hash('sha256', strtolower(trim($email)) . '|' . APP_SECRET), 0, 16); }
function conti_maschera(string $e): string {
    [$u, $d] = explode('@', $e, 2) + ['', ''];
    return substr($u, 0, 2) . str_repeat('•', max(1, min(6, strlen($u) - 2))) . '@' . $d;
}

// ---------- limites simples por janela (arquivo com timestamps) ----------
function conti_limite(string $chave, int $max, int $janela): bool {
    $arq = conti_dir() . '/.limite-' . substr(hash('sha256', $chave . APP_SECRET), 0, 20);
    $agora = time();
    $f = fopen($arq, 'c+'); if (!$f || !flock($f, LOCK_EX)) return false;
    $ts = array_values(array_filter(array_map('intval', explode("\n", (string)stream_get_contents($f))), fn($t) => $t > $agora - $janela));
    $ok = count($ts) < $max;
    if ($ok) { $ts[] = $agora; ftruncate($f, 0); rewind($f); fwrite($f, implode("\n", $ts)); }
    flock($f, LOCK_UN); fclose($f);
    if (mt_rand(1, 50) === 1) foreach (glob(conti_dir() . '/.limite-*') ?: [] as $v) if (filemtime($v) < $agora - 86400 * 2) @unlink($v);
    return $ok;
}

// ---------- conta ----------
function conti_leggi(string $id): ?array {
    if (!preg_match('/^[0-9a-f]{16}$/', $id)) return null;
    $u = json_decode((string)@file_get_contents(conti_dir('utenti') . "/$id.json"), true);
    return is_array($u) ? $u : null;
}
// abre a conta com trava, deixa $fn mudar e grava; $cria = e-mail para criar se não existir
function conti_modifica(string $id, callable $fn, ?string $cria = null) {
    if (!preg_match('/^[0-9a-f]{16}$/', $id)) throw new RuntimeException('id');
    $f = fopen(conti_dir('utenti') . "/$id.json", 'c+');
    if (!$f || !flock($f, LOCK_EX)) throw new RuntimeException('lock');
    $u = json_decode((string)stream_get_contents($f), true);
    if (!is_array($u)) {
        if ($cria === null) { flock($f, LOCK_UN); fclose($f); @unlink(conti_dir('utenti') . "/$id.json"); return null; }
        $u = ['id' => $id, 'email' => strtolower(trim($cria)), 'creato' => gmdate('c'), 'conta' => null, 'saldo' => 0, 'serie' => ['n' => 0, 'ultimo' => null], 'ultimi' => []];
    }
    $r = $fn($u);
    ftruncate($f, 0); rewind($f);
    fwrite($f, json_encode($u, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
    flock($f, LOCK_UN); fclose($f);
    return $r;
}
// todo crédito entra e sai por aqui (dentro de conti_modifica): saldo + histórico curto + livro-caixa
function conti_movimento(array &$u, int $delta, string $tipo, string $rif = ''): void {
    if (!empty($u['proprietario']) && !str_starts_with($tipo, 'prova_')) $tipo = "prova_$tipo";   // conta do dono: fora das estatísticas
    $u['saldo'] = (int)($u['saldo'] ?? 0) + $delta;
    $m = ['em' => gmdate('c'), 'tipo' => $tipo, 'delta' => $delta, 'saldo' => $u['saldo']] + ($rif !== '' ? ['rif' => $rif] : []);
    array_unshift($u['ultimi'], $m);
    $u['ultimi'] = array_slice($u['ultimi'], 0, 20);
    file_put_contents(conti_dir() . '/movimenti.jsonl', json_encode(['id' => $u['id']] + $m, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . "\n", FILE_APPEND | LOCK_EX);
}

// ---------- conta do dono do jogo (testar tudo) ----------
// privato/proprietario.json = {email, hash} (hash = password_hash do código fixo; nunca no site nem no git).
// Entra com esse e-mail + código fixo; crediti de prova; liga qualquer @ sem tirar do jogador; villa/castello e interior
// ficam só para ele (não ocupam o castelo da região nem mexem na casa do jogador); sem prêmio do dia, sem e-mails.
function conti_proprietario(): ?array {
    static $p = false;
    if ($p === false) { $p = json_decode((string)@file_get_contents(dirname(CARTELLA) . '/proprietario.json'), true); if (!is_array($p) || empty($p['email']) || empty($p['hash'])) $p = null; }
    return $p;
}
function conti_e_proprietario(string $email): bool { $p = conti_proprietario(); return $p && strtolower(trim($email)) === strtolower($p['email']); }

// ---------- sessão ----------
function conti_https(): bool { return (($_SERVER['HTTPS'] ?? '') !== '' && $_SERVER['HTTPS'] !== 'off') || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https'); }
function conti_cookie(string $valor, int $scade): void {
    setcookie(CONTI_COOKIE, $valor, ['expires' => $scade, 'path' => '/', 'secure' => conti_https(), 'httponly' => true, 'samesite' => 'Lax']);
}
// cada sessão guarda a "geração" da conta; "esci da tutti i dispositivi" aumenta a geração e derruba todas
function conti_sessione_crea(string $id, int $gen = 0): void {
    $tok = bin2hex(random_bytes(32));
    $scade = time() + CONTI_SESSIONE_GIORNI * 86400;
    file_put_contents(conti_dir('sessioni') . '/' . substr(hash('sha256', $tok), 0, 40) . '.json', json_encode(['id' => $id, 'gen' => $gen, 'scade' => $scade, 'creata' => gmdate('c'), 'disp' => conti_dispositivo()]), LOCK_EX);
    conti_cookie($tok, $scade);
}
function conti_dispositivo(?string $ua = null): string {
    $ua ??= (string)($_SERVER['HTTP_USER_AGENT'] ?? '');
    $so = preg_match('/iPhone/i', $ua) ? 'iPhone' : (preg_match('/iPad/i', $ua) ? 'iPad' : (preg_match('/Android/i', $ua) ? 'Android' : (preg_match('/Windows/i', $ua) ? 'Windows' : (preg_match('/Macintosh|Mac OS/i', $ua) ? 'Mac' : (preg_match('/Linux/i', $ua) ? 'Linux' : 'dispositivo sconosciuto')))));
    $nav = preg_match('/Instagram/i', $ua) ? 'app di Instagram' : (preg_match('/FBAN|FBAV/i', $ua) ? 'app di Facebook' : (preg_match('/SamsungBrowser/i', $ua) ? 'Samsung Internet' : (preg_match('/Edg\//i', $ua) ? 'Edge' : (preg_match('/Firefox|FxiOS/i', $ua) ? 'Firefox' : (preg_match('/Chrome|CriOS/i', $ua) ? 'Chrome' : (preg_match('/Safari/i', $ua) ? 'Safari' : 'browser'))))));
    return "$so · $nav";
}
function conti_token_revoca(string $id, int $gen): string { return $id . '.' . substr(hash_hmac('sha256', "revoca|$id|$gen", APP_SECRET), 0, 24); }
// derruba todas as sessões da conta (botão no site ou link do e-mail "Non sei stato tu?")
function conti_revoca_tutti(string $id): void {
    conti_modifica($id, function (array &$u) { $u['gen'] = (int)($u['gen'] ?? 0) + 1; });
}
function conti_ora_roma(): string { return (new DateTime('now', new DateTimeZone('Europe/Rome')))->format('d/m/Y \a\l\l\e H:i'); }
function conti_sessione_arq(): ?string {
    $tok = (string)($_COOKIE[CONTI_COOKIE] ?? '');
    return preg_match('/^[0-9a-f]{64}$/', $tok) ? conti_dir('sessioni') . '/' . substr(hash('sha256', $tok), 0, 40) . '.json' : null;
}
function conti_sessione_id(): ?string {
    $arq = conti_sessione_arq();
    if (!$arq || !is_file($arq)) return null;
    $s = json_decode((string)file_get_contents($arq), true);
    if (!is_array($s) || (int)($s['scade'] ?? 0) < time()) { @unlink($arq); return null; }
    $u = conti_leggi((string)$s['id']);
    if (!$u || (int)($s['gen'] ?? 0) !== (int)($u['gen'] ?? 0)) { @unlink($arq); return null; }   // saiu de todos os dispositivos
    return (string)$s['id'];
}
function conti_sessione_chiudi(): void {
    $arq = conti_sessione_arq();
    if ($arq) @unlink($arq);
    conti_cookie('', time() - 3600);
}

// ---------- @ com casa no mapa (mesma lista que missioni.php usa) ----------
function conti_tem_casa(string $conta): bool {
    $snap = __DIR__ . '/../data/snapshot.json';
    $cache = conti_dir() . '/.conte.txt';
    if (!is_file($cache) || filemtime($cache) < @filemtime($snap)) {
        $s = json_decode((string)@file_get_contents($snap), true);
        $lista = array_map(fn($c) => (string)$c[0], (array)($s['case'] ?? []));
        if (!$lista) return true;   // snapshot ilegível: não bloqueia
        file_put_contents($cache, "\n" . implode("\n", $lista) . "\n", LOCK_EX);
    }
    return str_contains((string)file_get_contents($cache), "\n$conta\n");
}

// ---------- ligar o @: código CASA-1234 no mesmo arquivo dos jogos (o robô do GitHub confere os comentários) ----------
function conti_codice_collega(string $conta, string $id): string {
    $pasta = CARTELLA . '/missioni';
    if (!is_dir($pasta)) mkdir($pasta, 0750, true);
    $f = fopen("$pasta/codici.json", 'c+');
    if (!$f || !flock($f, LOCK_EX)) throw new RuntimeException('lock');
    $c = json_decode((string)stream_get_contents($f), true) ?: [];
    $k = "$conta|a$id";
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
function conti_vincolato(string $conta, string $id): bool {
    $v = json_decode((string)@file_get_contents(CARTELLA . '/missioni/vincolati.json'), true);
    return is_array($v) && in_array("$conta|a$id", (array)($v['coppie'] ?? []), true);
}
// o @ foi confirmado: liga nesta conta e tira de qualquer outra (quem comentou o código é o dono do Instagram)
function conti_assegna_conta(string $conta, string $id): void {
    $f = fopen(conti_dir() . '/conte.json', 'c+');
    if (!$f || !flock($f, LOCK_EX)) throw new RuntimeException('lock');
    $idx = json_decode((string)stream_get_contents($f), true) ?: [];
    $vecchio = $idx[$conta] ?? null;
    $idx[$conta] = $id;
    ftruncate($f, 0); rewind($f); fwrite($f, json_encode($idx, JSON_UNESCAPED_SLASHES));
    flock($f, LOCK_UN); fclose($f);
    if ($vecchio && $vecchio !== $id) conti_modifica($vecchio, function (array &$u) use ($conta) { if (($u['conta'] ?? null) === $conta) $u['conta'] = null; });
}

// ---------- e-mail (SMTP da Hostinger, igual ao recupero.php) ----------
// rodando no PC (linha de comando ou localhost): nenhum e-mail sai de verdade
function conti_locale(): bool {
    return PHP_SAPI === 'cli' || (in_array((string)($_SERVER['REMOTE_ADDR'] ?? ''), ['127.0.0.1', '::1'], true) && preg_match('/^localhost(:\d+)?$/', (string)($_SERVER['HTTP_HOST'] ?? '')));
}
// registro de envios (diagnóstico, api/diag.php): hora, ok/erro, domínio do destino (sem o endereço)
function conti_smtp(string $para, string $assunto, string $corpo): array {
    $r = conti_smtp_invia($para, $assunto, $corpo);
    $dom = strtolower(substr(strrchr($para, '@') ?: '@?', 1));
    $tipo = str_starts_with($assunto, 'Il tuo codice') ? 'codice' : (str_starts_with($assunto, 'Nuovo accesso') ? 'accesso' : 'altro');
    @file_put_contents(conti_dir() . '/email.log', gmdate('c') . " $tipo " . ($r[0] ? 'ok' : 'ERRO') . " $dom" . ($r[0] ? '' : ' ' . substr(str_replace(["\r", "\n"], ' ', (string)$r[1]), 0, 200)) . "\n", FILE_APPEND | LOCK_EX);
    return $r;
}
function conti_smtp_invia(string $para, string $assunto, string $corpo): array {
    if (conti_locale()) { file_put_contents(conti_dir() . '/email-dev.log', "=== " . gmdate('c') . " para $para | $assunto\n$corpo\n\n", FILE_APPEND | LOCK_EX); return [true, 'dev']; }
    $de = 'privacy@italiacasapercasa.com';
    if (!defined('SMTP_PASSWORD') || SMTP_PASSWORD === '') return [false, 'sem SMTP_PASSWORD'];
    $s = @stream_socket_client('ssl://smtp.hostinger.com:465', $en, $es, 20);
    if (!$s) return [false, "conexão: $es"];
    stream_set_timeout($s, 20);
    $ler = function () use ($s) { $r = ''; while (($l = fgets($s, 1024)) !== false) { $r .= $l; if (strlen($l) < 4 || $l[3] === ' ') break; } return $r; };
    $cmd = function (string $c, string $espera) use ($s, $ler) { fwrite($s, "$c\r\n"); $r = $ler(); if (strpos($r, $espera) !== 0) throw new RuntimeException(trim($r)); return $r; };
    try {
        $r = $ler(); if (strpos($r, '220') !== 0) throw new RuntimeException(trim($r));
        $cmd('EHLO italiacasapercasa.com', '250');
        $cmd('AUTH LOGIN', '334');
        $cmd(base64_encode($de), '334');
        $cmd(base64_encode(SMTP_PASSWORD), '235');
        $cmd("MAIL FROM:<$de>", '250');
        $cmd("RCPT TO:<$para>", '25');
        $cmd('DATA', '354');
        $cab = implode("\r\n", [
            "From: Italia Casa per Casa <$de>", "To: <$para>", 'Subject: =?UTF-8?B?' . base64_encode($assunto) . '?=',
            'Date: ' . date('r'), 'Message-ID: <' . bin2hex(random_bytes(12)) . '@italiacasapercasa.com>',
            'MIME-Version: 1.0', 'Content-Type: text/plain; charset=UTF-8', 'Content-Transfer-Encoding: base64',
        ]);
        $corpo = str_replace(["\r\n", "\n"], ["\n", "\r\n"], $corpo);
        $r = $cmd($cab . "\r\n\r\n" . rtrim(chunk_split(base64_encode($corpo), 76, "\r\n")) . "\r\n.", '250');
        fwrite($s, "QUIT\r\n");
        return [true, trim($r)];
    } catch (RuntimeException $e) {
        return [false, $e->getMessage()];
    } finally { fclose($s); }
}

// ---------- loja: o que se compra com créditos (preços SÓ do data/crediti.json, nunca do navegador) ----------
// à venda: "interni", "mob_<id>" (móveis), "pac_<id>" (pacote de móveis com desconto), "pg_<id>" (roupas/acessórios do boneco),
// villa e castello (a casa do @ vira villa/castelo no mapa, para sempre; castelo: 1 por região) e veículos da passeggiata.
// O que está em "catalogo" só entra aqui com "vendita": true.
function conti_listino(): array {
    $c = conti_cfg(); $out = [];
    if (isset($c['interni']['prezzo'])) $out['interni'] = ['nome' => 'La tua casa (dentro e fuori)', 'prezzo' => (int)$c['interni']['prezzo'], 'casa' => true];
    foreach ((array)($c['mobili'] ?? []) as $m) if ((int)$m['prezzo'] > 0) $out['mob_' . $m['id']] = ['nome' => (string)$m['nome'], 'prezzo' => (int)$m['prezzo'], 'serve' => 'interni'];
    foreach ((array)($c['pacchetti'] ?? []) as $p) $out['pac_' . $p['id']] = ['nome' => (string)$p['nome'], 'prezzo' => (int)$p['prezzo'], 'serve' => 'interni', 'mobili' => array_map(fn($m) => 'mob_' . $m, (array)$p['mobili'])];
    foreach ((array)($c['personaggio'] ?? []) as $p) $out['pg_' . $p['id']] = ['nome' => (string)$p['nome'], 'prezzo' => (int)$p['prezzo']];
    foreach ((array)($c['catalogo'] ?? []) as $x) {
        if (empty($x['vendita']) || isset($out[$x['id']])) continue;
        $out[$x['id']] = ['nome' => (string)$x['nome'], 'prezzo' => (int)$x['prezzo']] + (in_array($x['id'], ['villa', 'castello'], true) ? ['casa' => true] : []);
    }
    return $out;
}

// ---------- região da casa de um @ (castelo: 1 por região) ----------
function conti_regione_di(string $conta): ?array {
    $s = json_decode((string)@file_get_contents(__DIR__ . '/../data/snapshot.json'), true);
    $com = json_decode((string)@file_get_contents(__DIR__ . '/../data/comuni.json'), true);
    $geo = json_decode((string)@file_get_contents(__DIR__ . '/../data/geo.json'), true);
    if (!$s || !$com || !$geo) return null;
    $li = null;
    foreach ((array)$s['case'] as $c) if ((string)$c[0] === $conta) { $li = (int)$c[1]; break; }
    if ($li === null || !isset($s['luoghi'][$li])) return null;
    $ci = (int)$s['luoghi'][$li][0];
    $iR = array_search('regione', (array)$com['campi'], true);
    $cod = (string)($com['dados'][$ci][$iR] ?? '');
    foreach ((array)$geo['regioni'] as $r) if ((string)$r['cod'] === $cod) return ['cod' => $cod, 'nome' => explode('/', (string)$r['nome'])[0]];
    return $cod !== '' ? ['cod' => $cod, 'nome' => $cod] : null;
}
// ville e castelli comprados: registro privado + cópia pública (só os @) em data/proprieta.json, lida pelo mapa (decori.js)
function conti_proprieta_pubblica(array $reg): void {
    $pub = ['ville' => array_keys((array)($reg['ville'] ?? [])), 'castelli' => [], 'case' => array_keys((array)($reg['case'] ?? [])), 'decori' => []];
    foreach ((array)($reg['castelli'] ?? []) as $cod => $x) $pub['castelli'][(string)$cod] = ['conta' => $x['conta'], 'regione' => $x['regione'] ?? ''];
    foreach ((array)($reg['decori'] ?? []) as $conta => $x) $pub['decori'][(string)$conta] = ['squadra' => $x['squadra'] ?? '', 'extra' => array_values((array)($x['extra'] ?? [])), 'da' => $x['da'] ?? ''];
    $arq = __DIR__ . '/../data/proprieta.json';
    file_put_contents("$arq.tmp", json_encode($pub, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES), LOCK_EX);
    rename("$arq.tmp", $arq);
}

// ---------- decoração de fora (para sempre, só visual: NÃO dá pontos) ----------
// a própria casa: grátis para quem tem "la tua casa" (item interni); presente para a casa de outra pessoa:
// 490 💰 para quem tem a casa, 990 💰 para quem não tem (crediti.json "decora"). Casa que já é "la tua casa" de alguém
// não recebe presente (o dono decora). Dono do jogo: tudo de prova (u.deco_prova), fora do registro público.
const CONTI_SQUADRE = ['bianconero', 'nerazzurro', 'rossonero', 'azzurro', 'giallorosso', 'biancoceleste', 'viola', 'granata', 'rossoblu'];
function conti_decora(string $id, string $conta, string $squadra, array $extra): array {
    $u0 = conti_leggi($id);
    if (!$u0) return [null, 'Account non trovato.'];
    if (!preg_match('/^[a-z0-9._]{1,30}$/', $conta) || !conti_tem_casa($conta)) return [null, "@$conta non ha una casa sulla mappa."];
    $mio = ($u0['conta'] ?? '') === $conta; $prop = !empty($u0['proprietario']);
    $haCasa = in_array('interni', (array)($u0['oggetti'] ?? []), true);
    $extra = array_values(array_unique(array_map('strval', $extra)));
    $EFF = $mio ? ['oro', 'neon', 'corona', 'fuochi', 'campione', 'tricolore', 'cornice'] : ['oro', 'neon', 'corona', 'fuochi', 'campione', 'palloncini', 'cornice'];
    if ($squadra !== '' && (!$mio || !in_array($squadra, CONTI_SQUADRE, true))) return [null, 'Colori non validi.'];
    if (array_diff($extra, $EFF)) return [null, 'Effetto non valido.'];
    if (in_array('oro', $extra, true) && $squadra !== '') return [null, 'Scegli la casa d’oro o i colori della squadra, non tutti e due.'];
    if ($mio && !$haCasa) return [null, 'Prima sblocca la tua casa: poi la decori dentro e fuori quando vuoi, per sempre.'];
    $cd = conti_cfg()['decora'] ?? ['regalo_con_casa' => 490, 'regalo' => 990];
    $prezzo = $mio ? 0 : (int)($haCasa ? $cd['regalo_con_casa'] : $cd['regalo']);
    $sel = ['squadra' => $squadra, 'extra' => $extra, 'da' => $mio ? '' : (string)($u0['conta'] ?? ''), 'em' => gmdate('c')];
    if ($prop) return [conti_modifica($id, function (array &$u) use ($conta, $sel) { $u['deco_prova'][$conta] = $sel; return $u; }), null];
    $fr = fopen(conti_dir() . '/proprieta.json', 'c+');
    if (!$fr || !flock($fr, LOCK_EX)) return [null, 'Riprova tra un attimo.'];
    $reg = json_decode((string)stream_get_contents($fr), true) ?: [];
    $err = null; $u = null;
    if (!$mio && isset($reg['case'][$conta])) $err = "@$conta ha già la sua casa: la decora da solo/a.";
    if (!$err) $u = conti_modifica($id, function (array &$u) use ($prezzo, $conta, &$err) {
        if ($prezzo && (int)$u['saldo'] < $prezzo) { $err = 'Crediti insufficienti: ti mancano ' . number_format($prezzo - (int)$u['saldo'], 0, ',', '.') . ' 💰.'; return $u; }
        if ($prezzo) conti_movimento($u, -$prezzo, 'regalo_deco', $conta);
        return $u;
    });
    if (!$err) { $reg['decori'][$conta] = $sel; ftruncate($fr, 0); rewind($fr); fwrite($fr, json_encode($reg, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)); conti_proprieta_pubblica($reg); }
    flock($fr, LOCK_UN); fclose($fr);
    if ($err) return [null, $err];
    if ($prezzo) conti_ricevuta($u, -$prezzo, "Hai regalato una decorazione alla casa di @$conta, per sempre. 🎁", "deco $conta", "Ricevuta regalo per @$conta");
    return [$u, null];
}

// compra: tira os créditos, guarda o item na conta e manda o recibo. Devolve [conta atualizada, erro|null]
function conti_compra(string $id, string $item): array {
    $L = conti_listino();
    if (!isset($L[$item])) return [null, 'Questo oggetto non è in vendita.'];
    $x = $L[$item];
    $err = null;
    // villa/castello: o registro fica travado durante a compra (dois pedidos do mesmo castelo ao mesmo tempo: só o 1º leva)
    $fr = null; $reg = null; $regione = null;
    $prop = !empty(conti_leggi($id)['proprietario']);   // dono: villa/castello só de prova (fora do registro público)
    if (!empty($x['casa']) && !$prop) {
        $fr = fopen(conti_dir() . '/proprieta.json', 'c+');
        if (!$fr || !flock($fr, LOCK_EX)) return [null, 'Riprova tra un attimo.'];
        $reg = json_decode((string)stream_get_contents($fr), true) ?: ['ville' => [], 'castelli' => []];
    }
    $u = conti_modifica($id, function (array &$u) use ($item, $x, &$err, &$reg, &$regione, $prop) {
        $own = (array)($u['oggetti'] ?? []);
        $conta = (string)($u['conta'] ?? '');
        if (in_array($item, $own, true)) { $err = 'Ce l’hai già!'; return $u; }
        if (!empty($x['casa']) && $conta === '') { $err = 'Collega prima il tuo Instagram: è la casa del tuo @ sulla mappa.'; return $u; }
        if (!empty($x['casa']) && !conti_tem_casa($conta)) { $err = "@$conta non ha una casa sulla mappa."; return $u; }
        if (!empty($x['serve']) && !in_array($x['serve'], $own, true)) { $err = 'Prima ti serve la casa con interni.'; return $u; }
        $nuovi = [$item];
        if (!empty($x['mobili'])) {   // pacote: entram só os móveis que a pessoa ainda não tem
            $nuovi = array_values(array_diff($x['mobili'], $own));
            if (!$nuovi) { $err = 'Hai già tutti i mobili di questo pacchetto!'; return $u; }
        }
        if ($item === 'castello') {
            $regione = conti_regione_di($conta);
            if (!$regione) { $err = 'Non troviamo la regione della tua casa. Riprova più tardi.'; return $u; }
        }
        if ($item === 'castello' && !$prop) {
            $chi = $reg['castelli'][$regione['cod']]['conta'] ?? null;
            if ($chi) { $err = "Il castello della regione {$regione['nome']} è già di @$chi. Solo 1 per regione!"; return $u; }
            foreach ((array)$reg['castelli'] as $c) if (($c['conta'] ?? '') === $conta) { $err = 'Hai già un castello!'; return $u; }
        }
        if ((int)$u['saldo'] < $x['prezzo']) { $err = 'Crediti insufficienti: ti mancano ' . number_format($x['prezzo'] - (int)$u['saldo'], 0, ',', '.') . ' 💰.'; return $u; }
        conti_movimento($u, -$x['prezzo'], 'acquisto', $item);
        if (empty($x['mobili'])) $own[] = $item; else $own = array_merge($own, $nuovi);
        $u['oggetti'] = array_values(array_unique($own));
        if ($item === 'villa' && !$prop) $reg['ville'][$conta] = ['id' => $u['id'], 'em' => gmdate('c')];
        if ($item === 'interni' && !$prop) $reg['case'][$conta] = ['id' => $u['id'], 'em' => gmdate('c')];   // "la tua casa": decora dentro e fuori
        if ($item === 'castello' && !$prop) $reg['castelli'][$regione['cod']] = ['conta' => $conta, 'id' => $u['id'], 'regione' => $regione['nome'], 'em' => gmdate('c')];
        return $u;
    });
    if ($fr) {
        if ($u && !$err) { ftruncate($fr, 0); rewind($fr); fwrite($fr, json_encode($reg, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)); conti_proprieta_pubblica($reg); }
        flock($fr, LOCK_UN); fclose($fr);
    }
    if (!$u) return [null, 'Account non trovato.'];
    if ($err) return [null, $err];
    $nome = $item === 'castello' ? "Castello della regione {$regione['nome']}" : $x['nome'];
    conti_ricevuta($u, -$x['prezzo'], "Hai comprato: $nome. Buon divertimento! 🎉", $item, "Ricevuta acquisto: $nome");
    return [$u, null];
}

// ---------- recargas da Hotmart (chamado por hotmart.php) ----------
// acha o pacote pelo id do produto na Hotmart (crediti.json pacchi[].hotmart) ou pelo número de créditos no nome do produto
function conti_pacco_di(string $prodId, string $nome, string $offerta = ''): ?array {
    $pacchi = (array)(conti_cfg()['pacchi'] ?? []);
    foreach ($pacchi as $p) if ($offerta !== '' && (string)($p['offerta'] ?? '') === $offerta) return $p;   // 1 produto, 6 ofertas (código off=...)
    foreach ($pacchi as $p) if ($prodId !== '' && (string)($p['hotmart'] ?? '') === $prodId) return $p;
    $n = preg_replace('/(\d)\.(\d{3})/', '$1$2', $nome);
    foreach ($pacchi as $p) if (preg_match('/\b' . (int)$p['crediti'] . '\b/', $n)) return $p;
    return null;
}
// $stato: 'pagato' credita (uma vez por transação) · 'rimborsato' tira de volta (saldo pode ficar negativo)
function conti_ricarica(string $email, string $sck, string $prodId, string $nome, string $trans, string $stato, $valore, string $offerta = ''): string {
    $p = conti_pacco_di($prodId, $nome, $offerta);
    if (!$p && is_numeric($valore)) foreach ((array)(conti_cfg()['pacchi'] ?? []) as $x) if (abs((float)$valore - (float)$x['prezzo']) < 0.05) { $p = $x; break; }   // oferta padrão sem código: pelo valor pago
    if (!$p) return 'pacchetto sconosciuto';
    $id = preg_match('/^c([0-9a-f]{16})$/', $sck, $m) ? $m[1] : (conti_email_ok($email) ? conti_id($email) : '');
    if ($id === '') return 'conta sconosciuta';
    $f = fopen(conti_dir() . '/transazioni.json', 'c+');
    if (!$f || !flock($f, LOCK_EX)) return 'lock';
    $T = json_decode((string)stream_get_contents($f), true) ?: [];
    $t = $T[$trans] ?? null;
    $esito = 'nulla'; $ricevuta = null;
    if ($stato === 'pagato' && !$t) {
        $u = conti_modifica($id, function (array &$u) use ($p, $trans) { conti_movimento($u, (int)$p['crediti'], 'ricarica', $trans); return $u; }, conti_email_ok($email) ? $email : null);
        if ($u) {
            $T[$trans] = ['id' => $id, 'crediti' => (int)$p['crediti'], 'euro' => $valore, 'stato' => 'accreditato', 'em' => gmdate('c')];
            $esito = 'accreditato';
            $ricevuta = [$u, (int)$p['crediti'], 'Ricarica ricevuta, grazie! 🎉', $trans];
        } else $esito = 'conta inesistente';
    } elseif ($stato === 'rimborsato' && $t && $t['stato'] === 'accreditato') {
        $u = conti_modifica($t['id'], function (array &$u) use ($t, $trans) { conti_movimento($u, -(int)$t['crediti'], 'rimborso', $trans); return $u; });
        $T[$trans]['stato'] = 'stornato'; $T[$trans]['stornato_em'] = gmdate('c');
        $esito = 'stornato';
        if ($u) $ricevuta = [$u, -(int)$t['crediti'], 'Il pagamento è stato rimborsato: abbiamo tolto i crediti di quella ricarica.', $trans];
    }
    ftruncate($f, 0); rewind($f); fwrite($f, json_encode($T, JSON_UNESCAPED_SLASHES));
    flock($f, LOCK_UN); fclose($f);
    if ($ricevuta) conti_ricevuta(...$ricevuta);
    return $esito;
}
// recibo por e-mail de cada movimento pago (recarga, reembolso e, na fase 3, compras)
function conti_ricevuta(array $u, int $delta, string $titolo, string $rif = '', ?string $assunto = null): array {
    if (!empty($u['proprietario'])) return [true, 'conta do dono: sem e-mail'];
    $fmt = fn(int $v) => ($v > 0 ? '+' : ($v < 0 ? '−' : '')) . number_format(abs($v), 0, ',', '.');
    $corpo = "Ciao!\n\n$titolo\n\n"
        . "• Crediti: " . $fmt($delta) . " 💰\n"
        . "• Saldo attuale: " . number_format((int)$u['saldo'], 0, ',', '.') . " 💰\n"
        . "• Quando: " . conti_ora_roma() . " (ora italiana)\n"
        . ($rif !== '' ? "• Riferimento: $rif\n" : '')
        . "\nTutti i movimenti sono nel tuo account: https://italiacasapercasa.com/#conto\n"
        . "Domande su questo movimento? Rispondi a questa email.\n\nItalia Casa per Casa\nhttps://italiacasapercasa.com";
    return conti_smtp((string)$u['email'], $assunto ?? (($delta >= 0 ? 'Ricevuta: ' : 'Rimborso: ') . $fmt($delta) . ' crediti'), $corpo);
}
// euros já recarregados nos últimos 30 dias (limite mensal, crediti.json limite_mese_euro)
function conti_euro_mese(string $id): float {
    $T = json_decode((string)@file_get_contents(conti_dir() . '/transazioni.json'), true) ?: [];
    $s = 0.0; $desde = time() - 30 * 86400;
    foreach ($T as $t) if (($t['id'] ?? '') === $id && $t['stato'] === 'accreditato' && strtotime((string)$t['em']) > $desde) $s += (float)($t['euro'] ?? 0);
    return $s;
}
