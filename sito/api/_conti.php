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
    $u['saldo'] = (int)($u['saldo'] ?? 0) + $delta;
    $m = ['em' => gmdate('c'), 'tipo' => $tipo, 'delta' => $delta, 'saldo' => $u['saldo']] + ($rif !== '' ? ['rif' => $rif] : []);
    array_unshift($u['ultimi'], $m);
    $u['ultimi'] = array_slice($u['ultimi'], 0, 20);
    file_put_contents(conti_dir() . '/movimenti.jsonl', json_encode(['id' => $u['id']] + $m, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . "\n", FILE_APPEND | LOCK_EX);
}

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
function conti_smtp(string $para, string $assunto, string $corpo): array {
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

// ---------- recargas da Hotmart (chamado por hotmart.php) ----------
// acha o pacote pelo id do produto na Hotmart (crediti.json pacchi[].hotmart) ou pelo número de créditos no nome do produto
function conti_pacco_di(string $prodId, string $nome): ?array {
    $pacchi = (array)(conti_cfg()['pacchi'] ?? []);
    foreach ($pacchi as $p) if ($prodId !== '' && (string)($p['hotmart'] ?? '') === $prodId) return $p;
    $n = preg_replace('/(\d)\.(\d{3})/', '$1$2', $nome);
    foreach ($pacchi as $p) if (preg_match('/\b' . (int)$p['crediti'] . '\b/', $n)) return $p;
    return null;
}
// $stato: 'pagato' credita (uma vez por transação) · 'rimborsato' tira de volta (saldo pode ficar negativo)
function conti_ricarica(string $email, string $sck, string $prodId, string $nome, string $trans, string $stato, $valore): string {
    $p = conti_pacco_di($prodId, $nome);
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
function conti_ricevuta(array $u, int $delta, string $titolo, string $rif = ''): array {
    $fmt = fn(int $v) => ($v > 0 ? '+' : ($v < 0 ? '−' : '')) . number_format(abs($v), 0, ',', '.');
    $corpo = "Ciao!\n\n$titolo\n\n"
        . "• Crediti: " . $fmt($delta) . " 💰\n"
        . "• Saldo attuale: " . number_format((int)$u['saldo'], 0, ',', '.') . " 💰\n"
        . "• Quando: " . conti_ora_roma() . " (ora italiana)\n"
        . ($rif !== '' ? "• Riferimento: $rif\n" : '')
        . "\nTutti i movimenti sono nel tuo account: https://italiacasapercasa.com/#conto\n"
        . "Domande su questo movimento? Rispondi a questa email.\n\nItalia Casa per Casa\nhttps://italiacasapercasa.com";
    return conti_smtp((string)$u['email'], ($delta >= 0 ? 'Ricevuta: ' : 'Rimborso: ') . $fmt($delta) . ' crediti', $corpo);
}
// euros já recarregados nos últimos 30 dias (limite mensal, crediti.json limite_mese_euro)
function conti_euro_mese(string $id): float {
    $T = json_decode((string)@file_get_contents(conti_dir() . '/transazioni.json'), true) ?: [];
    $s = 0.0; $desde = time() - 30 * 86400;
    foreach ($T as $t) if (($t['id'] ?? '') === $id && $t['stato'] === 'accreditato' && strtotime((string)$t['em']) > $desde) $s += (float)($t['euro'] ?? 0);
    return $s;
}
