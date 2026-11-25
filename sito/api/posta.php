<?php
// Caixa de entrada de privacy@ (SÓ LEITURA) para a rotina diária do PC (locale/direct/direct.mjs).
// IMAP com EXAMINE (abre a pasta em modo leitura: nada é apagado nem marcado como lido).
// Protegido pela chave CHIAVE_DOWNLOAD (cabeçalho X-Chiave, como backup.php e diag.php). ?desde=AAAA-MM-DD (padrão: ontem)
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
require __DIR__ . '/_conti.php';
$chave = (string)($_SERVER['HTTP_X_CHIAVE'] ?? '');
if (!defined('CHIAVE_DOWNLOAD') || CHIAVE_DOWNLOAD === '' || !hash_equals(CHIAVE_DOWNLOAD, $chave)) { http_response_code(404); exit; }
if (!defined('SMTP_PASSWORD') || SMTP_PASSWORD === '') { echo json_encode(['ok' => false, 'erro' => 'SMTP_PASSWORD ausente']); exit; }

$utente = 'privacy@italiacasapercasa.com';
$desde = preg_match('/^\d{4}-\d{2}-\d{2}$/', (string)($_GET['desde'] ?? '')) ? $_GET['desde'] : gmdate('Y-m-d', time() - 86400);
$max = 40;

$s = @stream_socket_client('ssl://imap.hostinger.com:993', $en, $es, 20);
if (!$s) { echo json_encode(['ok' => false, 'erro' => "IMAP: $es"]); exit; }
stream_set_timeout($s, 25);
$n = 0;
// lê a resposta inteira de um comando (com literais {N}) até a linha "tag OK/NO/BAD"
$cmd = function (string $c) use ($s, &$n): array {
    $tag = 'a' . (++$n);
    fwrite($s, "$tag $c\r\n");
    $out = []; $buf = '';
    while (($l = fgets($s)) !== false) {
        if (preg_match('/\{(\d+)\}\r\n$/', $l, $m)) { $buf .= $l; $lit = ''; $falta = (int)$m[1]; while ($falta > 0 && !feof($s)) { $p = fread($s, min(8192, $falta)); if ($p === false) break; $lit .= $p; $falta -= strlen($p); } $buf .= $lit; continue; }
        $buf .= $l;
        if (strncmp($l, "$tag ", strlen($tag) + 1) === 0) { $out[] = $buf; return ['ok' => (bool)preg_match("/^$tag OK/", $l), 'txt' => implode('', $out)]; }
        if ($buf !== '' && substr($buf, -2) === "\r\n" && !preg_match('/\{\d+\}\r\n$/', $buf)) { $out[] = $buf; $buf = ''; }
    }
    return ['ok' => false, 'txt' => implode('', $out) . $buf];
};
fgets($s);   // saudação
$q = fn($x) => '"' . addcslashes($x, "\"\\") . '"';
if (!$cmd('LOGIN ' . $q($utente) . ' ' . $q(SMTP_PASSWORD))['ok']) { echo json_encode(['ok' => false, 'erro' => 'login IMAP recusado']); exit; }
$cmd('EXAMINE INBOX');
$data = DateTime::createFromFormat('Y-m-d', $desde)->format('d-M-Y');
$r = $cmd("UID SEARCH SINCE $data");
preg_match('/\* SEARCH([\d ]*)/', $r['txt'], $m);
$uids = array_slice(array_filter(array_map('intval', preg_split('/\s+/', trim($m[1] ?? '')))), -$max);

// MIME: decodifica cabeçalhos, acha a parte text/plain (ou text/html sem tags)
$hdr = function (string $h, string $nome): string {
    if (!preg_match('/^' . preg_quote($nome, '/') . ':\s*((?:.*\r?\n(?:[ \t].*\r?\n)*))/mi', $h, $m)) return '';
    $v = preg_replace('/\r?\n[ \t]+/', ' ', trim($m[1]));
    return trim((string)@iconv_mime_decode($v, ICONV_MIME_DECODE_CONTINUE_ON_ERROR, 'UTF-8'));
};
$decodifica = function (string $corpo, string $cab) use ($hdr): string {
    $enc = strtolower($hdr($cab, 'Content-Transfer-Encoding'));
    if ($enc === 'base64') $corpo = (string)base64_decode(preg_replace('/\s+/', '', $corpo));
    elseif ($enc === 'quoted-printable') $corpo = quoted_printable_decode($corpo);
    if (preg_match('/charset="?([\w-]+)/i', $hdr($cab, 'Content-Type'), $c) && strtoupper($c[1]) !== 'UTF-8') $corpo = (string)@iconv($c[1], 'UTF-8//IGNORE', $corpo);
    return $corpo;
};
$testo = function (string $raw) use (&$testo, $hdr, $decodifica): string {
    $p = preg_split("/\r?\n\r?\n/", $raw, 2); $cab = $p[0]; $corpo = $p[1] ?? '';
    $ct = $hdr($cab, 'Content-Type');
    if (stripos($ct, 'multipart/') === 0 && preg_match('/boundary="?([^";]+)"?/i', $ct, $b)) {
        $html = '';
        foreach (explode('--' . $b[1], $corpo) as $parte) {
            $parte = ltrim($parte, "\r\n"); if ($parte === '' || str_starts_with($parte, '--')) continue;
            $t = $testo($parte);
            if ($t !== '' && !str_starts_with($t, "\x01")) return $t;
            if (str_starts_with($t, "\x01")) $html = $html ?: substr($t, 1);
        }
        return $html;
    }
    if (stripos($ct, 'text/html') === 0) return "\x01" . trim(html_entity_decode(strip_tags(preg_replace('/<(br|\/p|\/div)[^>]*>/i', "\n", $decodifica($corpo, $cab))), ENT_QUOTES, 'UTF-8'));
    if ($ct === '' || stripos($ct, 'text/plain') === 0) return trim($decodifica($corpo, $cab));
    return '';
};

$msgs = [];
foreach ($uids as $uid) {
    $r = $cmd("UID FETCH $uid (BODY.PEEK[]<0.40000>)");
    if (!preg_match('/\{(\d+)\}\r\n/', $r['txt'], $m, PREG_OFFSET_CAPTURE)) continue;
    $raw = substr($r['txt'], $m[0][1] + strlen($m[0][0]), (int)$m[1][0]);
    $cab = preg_split("/\r?\n\r?\n/", $raw, 2)[0];
    $t = $testo($raw); if (str_starts_with($t, "\x01")) $t = substr($t, 1);
    // tira a citação da nossa mensagem (respostas): para no "Il giorno ... ha scritto" / linhas com ">"
    $t = preg_split('/\n(?:>|Il giorno .{5,80}ha scritto|On .{5,80}wrote|-----Original|Da: )/u', $t)[0];
    $msgs[] = ['uid' => $uid, 'da' => $hdr($cab, 'From'), 'oggetto' => $hdr($cab, 'Subject'), 'data' => date('c', strtotime($hdr($cab, 'Date')) ?: time()),
        'testo' => mb_substr(trim(preg_replace("/\n{3,}/", "\n\n", $t)), 0, 1500)];
}
$cmd('LOGOUT');
echo json_encode(['ok' => true, 'desde' => $desde, 'n' => count($msgs), 'msgs' => $msgs], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
