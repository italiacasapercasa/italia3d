<?php
// Diagnóstico dos e-mails de login (só leitura). Protegido pela chave CHIAVE_DOWNLOAD (cabeçalho X-Chiave, como o backup.php).
// Mostra: pedidos de código por hora (limite do dia), códigos pendentes e contas criadas por hora, teste de login no SMTP
// (conecta e autentica, NÃO manda e-mail) e o fim do registro de envios (conti/email.log: hora, ok/erro, domínio do destino).
declare(strict_types=1);
require __DIR__ . '/_conti.php';
$chave = (string)($_SERVER['HTTP_X_CHIAVE'] ?? '');
if (!defined('CHIAVE_DOWNLOAD') || CHIAVE_DOWNLOAD === '' || !hash_equals(CHIAVE_DOWNLOAD, $chave)) { http_response_code(404); exit; }
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
$agora = time();
// teste da reserva: X-Teste-Brevo: <email> → manda 1 e-mail só pelo Brevo e mostra a resposta
$tb = strtolower(trim((string)($_SERVER['HTTP_X_TESTE_BREVO'] ?? '')));
if ($tb !== '') {
    if (!conti_email_ok($tb)) { echo json_encode(['brevo_teste' => 'email inválido']); exit; }
    if (!defined('BREVO_API_KEY') || BREVO_API_KEY === '') { echo json_encode(['brevo_teste' => 'BREVO_API_KEY não está no config.php']); exit; }
    $r = conti_brevo_invia($tb, 'Prova Brevo · Italia Casa per Casa', "Ciao!\n\nQuesta è una prova del sistema di riserva delle email.\n\nItalia Casa per Casa");
    echo json_encode(['brevo_teste' => $r[0] ? 'ok' : 'erro', 'resposta' => $r[1]], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT);
    exit;
}
$hora = fn(int $t) => gmdate('m-d H', $t) . 'h';
$hist = function (array $ts, int $janela) use ($agora, $hora) { $h = []; foreach ($ts as $t) if ($t > $agora - $janela) { $k = $hora($t); $h[$k] = ($h[$k] ?? 0) + 1; } ksort($h); return $h; };

// limite global de pedidos de código (mesmo arquivo do conti_limite('email-giorno'))
$arqLim = conti_dir() . '/.limite-' . substr(hash('sha256', 'email-giorno' . APP_SECRET), 0, 20);
$lim = array_map('intval', array_filter(explode("\n", (string)@file_get_contents($arqLim))));
// códigos pendentes (criado = scade - 900)
$cod = [];
foreach (glob(conti_dir('codici') . '/*.json') ?: [] as $f) { $c = json_decode((string)@file_get_contents($f), true); if (isset($c['scade'])) $cod[] = (int)$c['scade'] - 900; }
// contas criadas
$cri = [];
foreach (glob(conti_dir('utenti') . '/*.json') ?: [] as $f) { $u = json_decode((string)@file_get_contents($f), true); if (!empty($u['creato'])) $cri[] = strtotime((string)$u['creato']); }
// login no SMTP sem enviar nada
$smtp = 'não testado';
if (defined('SMTP_PASSWORD') && SMTP_PASSWORD !== '') {
    $s = @stream_socket_client('ssl://smtp.hostinger.com:465', $en, $es, 20);
    if (!$s) $smtp = "conexão falhou: $es";
    else {
        stream_set_timeout($s, 20);
        $ler = function () use ($s) { $r = ''; while (($l = fgets($s, 1024)) !== false) { $r .= $l; if (strlen($l) < 4 || $l[3] === ' ') break; } return trim($r); };
        $passo = [];
        $passo[] = $ler();
        foreach (['EHLO italiacasapercasa.com', 'AUTH LOGIN', base64_encode('privacy@italiacasapercasa.com'), base64_encode(SMTP_PASSWORD)] as $i => $c) {
            fwrite($s, "$c\r\n"); $r = $ler();
            $passo[] = ($i === 3 ? '[senha] → ' : ($i === 2 ? '[usuário] → ' : "$c → ")) . substr(str_replace("\r\n", ' / ', $r), 0, 160);
        }
        fwrite($s, "QUIT\r\n"); fclose($s);
        $smtp = $passo;
    }
}
$todas = array_filter(explode("\n", (string)@file_get_contents(conti_dir() . '/email.log')));
$log = array_slice($todas, -40);
// envios por hora (48 h): ok = Hostinger, ok-brevo = reserva, ERRO = não saiu
$porHora = [];
foreach ($todas as $l) {
    $p = explode(' ', $l, 4);
    if (count($p) < 3 || strtotime($p[0]) < $agora - 172800) continue;
    $h = gmdate('m-d H', strtotime($p[0])) . 'h';
    $porHora[$h][$p[2]] = ($porHora[$h][$p[2]] ?? 0) + 1;
}
$total = [];
foreach ($porHora as $x) foreach ($x as $k => $n) $total[$k] = ($total[$k] ?? 0) + $n;
// funil da recarga por dia (UTC): apre (de onde) → pacco → annulla / checkout (foi para a Hotmart); pessoas = contas diferentes
$funil = [];
foreach (array_filter(explode("\n", (string)@file_get_contents(conti_dir() . '/ricarica.log'))) as $l) {
    [$em, $ev, $pac, $da, $chi] = array_pad(explode(' ', $l), 5, '-');
    $g = substr($em, 0, 10); $f = &$funil[$g];
    $f[$ev]['n'] = ($f[$ev]['n'] ?? 0) + 1;
    if ($chi !== '-') $f[$ev]['pessoas'][$chi] = 1;
    if ($ev === 'apre') $f[$ev]['da'][$da] = ($f[$ev]['da'][$da] ?? 0) + 1;
    if ($pac !== '-') $f[$ev]['pacchi'][$pac] = ($f[$ev]['pacchi'][$pac] ?? 0) + 1;
    unset($f);
}
foreach ($funil as &$f) foreach ($f as &$e) if (isset($e['pessoas'])) $e['pessoas'] = count($e['pessoas']);
unset($f, $e);
// recargas de hoje (hora de Roma) e quem aceitou ser agradecido nas stories (@ só com consentimento)
$oggiR = conti_oggi(); $grazie = []; $ricOggi = 0;
foreach ((json_decode((string)@file_get_contents(conti_dir() . '/transazioni.json'), true) ?: []) as $t) {
    if (($t['stato'] ?? '') !== 'accreditato') continue;
    $dt = (new DateTime((string)$t['em']))->setTimezone(new DateTimeZone('Europe/Rome'))->format('Y-m-d');
    if ($dt !== $oggiR) continue;
    $ricOggi++;
    $u = conti_leggi((string)$t['id']);
    if ($u && !empty($u['grazie']) && !empty($u['conta'])) $grazie[] = ['conta' => $u['conta'], 'crediti' => $t['crediti'], 'euro' => $t['euro']];
}
$hot = array_slice(array_filter(explode("\n", (string)@file_get_contents(conti_dir() . '/ricariche.log'))), -15);
echo json_encode([
    'agora' => gmdate('c'),
    'pedidos_codigo_24h' => count(array_filter($lim, fn($t) => $t > $agora - 86400)),
    'pedidos_por_hora' => $hist($lim, 86400),
    'codigos_pendentes' => count($cod), 'pendentes_por_hora_48h' => $hist($cod, 172800),
    'contas' => count($cri), 'contas_por_hora_48h' => $hist($cri, 172800),
    'smtp_login' => $smtp,
    'brevo_configurado' => defined('BREVO_API_KEY') && BREVO_API_KEY !== '',
    'hostinger_pausado_ate' => ($pz = (int)@file_get_contents(conti_dir() . '/smtp-pausa')) > $agora ? gmdate('c', $pz) : null,
    'envios_48h' => $total, 'envios_por_hora_48h' => $porHora,
    'ricarica_funil' => $funil, 'hotmart_crediti' => $hot, 'ricariche_oggi' => $ricOggi, 'grazie_storie_oggi' => $grazie,
    'envios_recentes' => $log,
], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT);
