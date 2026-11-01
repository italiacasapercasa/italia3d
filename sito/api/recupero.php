<?php
// Recuperação de carrinho: e-mail em italiano (1 vez por pedido) para quem foi ao pagamento da Hotmart e não pagou.
// Chamado pelo robô do GitHub (strumenti/ci.mjs) a cada execução, com a CHIAVE_DOWNLOAD.
// ?prova=1 só lista quem receberia, sem enviar. Envia só das 08 às 21 de Roma, 1 h a 72 h depois do abandono/clique,
// e só para pedidos com cara de negócio real (pula e-mail falso, de criança, de escola e nomes de brincadeira).
// Quem já recebeu (este e-mail ou um lembrete manual) fica em negozi/lembretes-inviati.txt.
declare(strict_types=1);
require is_file(__DIR__ . '/../../privato/config.php') ? __DIR__ . '/../../privato/config.php' : __DIR__ . '/../privato/config.php';
header('Content-Type: application/json; charset=utf-8');
if (!hash_equals(CHIAVE_DOWNLOAD, (string)($_GET['chiave'] ?? ''))) { http_response_code(403); exit; }
$prova = !empty($_GET['prova']);

$pasta = CARTELLA . '/negozi';
$arqLembretes = "$pasta/lembretes-inviati.txt";
$cfg = json_decode((string)@file_get_contents(__DIR__ . '/../data/negozio.json'), true) ?: [];
$comuni = json_decode((string)@file_get_contents(__DIR__ . '/../data/comuni.json'), true)['dados'] ?? [];
$nomeComune = [];
foreach ($comuni as $c) $nomeComune[$c[0]] = $c[1];

$agora = time();
$roma = (int)(new DateTimeImmutable('now', new DateTimeZone('Europe/Rome')))->format('G');
$horaOk = $roma >= 8 && $roma < 21;

$pedidos = [];
foreach (glob("$pasta/[0-9][0-9][0-9][0-9][0-9][0-9]-*.json") ?: [] as $a) {
    $p = json_decode((string)file_get_contents($a), true) ?: [];
    if (!empty($p['id'])) $pedidos[$a] = $p;
}
$jaAvisados = array_flip(array_filter(array_map('trim', @file($arqLembretes) ?: [])));
$emailPago = $emailAvisado = $ocupados = [];
foreach ($pedidos as $p) {
    $e = strtolower((string)($p['email'] ?? ''));
    if (($p['pagamento'] ?? '') === 'pagato') $emailPago[$e] = true;
    if (isset($jaAvisados[$p['id']]) || !empty($p['recupero_em'])) $emailAvisado[$e] = true;
    if (($p['stato'] ?? '') === 'approvato') { $k = ($p['istat'] ?? '') . '|' . ($p['prodotto'] ?? ''); $ocupados[$k] = ($ocupados[$k] ?? 0) + 1; }
}

// pedido com cara de negócio real (o mesmo filtro dos lembretes manuais)
function sembraReale(array $p): bool {
    $email = strtolower((string)($p['email'] ?? ''));
    $nome = trim((string)($p['nome'] ?? ''));
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) return false;
    [$local, $dominio] = explode('@', $email, 2);
    if (preg_match('/(esempio|example|test|prova|mailinator|yopmail)/', $dominio)) return false;
    if (preg_match('/^(com|net|org|it|co|eu)\./', $dominio)) return false;     // "barbiere@com.it": domínio inventado
    if (preg_match('/(scuol|collegio|istitut|liceo|\.edu|^iis|^itis|^ipsia)/', $dominio)) return false;
    if (preg_match('/^(nome|test|prova|calcio|giovanni|mario|esempio|example|asd|aaa|ciao|boh)\d*$/', $local)) return false;
    if (preg_match('/(200[5-9]|201\d|0909|1010|1111|1212)/', $local) || preg_match('/\D(0[89]|1[0-6])$/', $local)) return false;   // ano/idade de criança
    if (mb_strlen($nome) < 3 || preg_match('/(.)\1{2,}/iu', $nome)) return false;   // "Us", "Bhoooo", "Ghhhjkjf"
    if (!preg_match('/[aeiouàèéìòù]/iu', $nome)) return false;
    if (preg_match('/(merd|cazz|fig[ao]|sbocc|porc|stronz|culo|troi|puttan|coglion)/iu', $nome . ' ' . $local)) return false;
    if (preg_match('/(burger king|mc ?donald|amazon|esselunga|ikea|coca[- ]?cola|agip|birra raffo|peroni|nike|adidas|blue lock|palestra di riky|così perché)/iu', $nome)) return false;
    $wa = preg_replace('/\D/', '', (string)($p['whatsapp'] ?? ''));
    if ($wa !== '' && (preg_match('/(\d)\1{5,}/', $wa) || preg_match('/(67){3,}|1234567/', $wa))) return false;
    // precisa de um sinal positivo de negócio: domínio próprio ou palavra de atividade no nome/e-mail
    $gratis = '/^(gmail|googlemail|hotmail|outlook|live|msn|libero|icloud|me|yahoo|virgilio|tiscali|alice|tim|tin|email|fastwebnet|inwind|aruba|pec)\./';
    if (!preg_match($gratis, $dominio)) return true;
    return (bool)preg_match('/(srls?|snc|sas|s\.r\.l|pizzeri|ristorant|trattori|osteri|bar\b|caff[eè]|pasticceri|panific|forno|macelleri|salumeri|alimentar|gelateri|aziend|agricol|agrituris|hotel|b&b|bnb|affittacamer|parrucch|barber|estetic|cartoleri|cartolibreri|librer|tabacch|farmaci|ottic|officin|carrozzeri|ferrament|fiorist|studio|bottega|enoteca|birrifici|boutique|abbigliament|edizioni|tipografi|lavanderi|panific|rosticceri|friggitori|kebab|sushi|pub\b|vineria|cantina|negozio)/iu', $nome . ' ' . $local);
}

$euro = fn(int $c) => '€' . number_format($c / 100, 2, ',', '.');
$risultato = [];
$inviati = 0;
foreach ($pedidos as $arq => $p) {
    if (($p['stato'] ?? '') !== 'nuovo' || !empty($p['pagamento']) || !empty($p['recupero_em']) || isset($jaAvisados[$p['id']])) continue;
    $quando = strtotime((string)($p['checkout_em'] ?? $p['clic_pagamento'] ?? '')) ?: 0;
    if (!$quando || $agora - $quando < 3600 || $agora - $quando > 72 * 3600) continue;
    $email = strtolower((string)$p['email']);
    if (isset($emailPago[$email]) || isset($emailAvisado[$email])) continue;
    if (!sembraReale($p)) { $risultato[] = ['id' => $p['id'], 'nome' => $p['nome'], 'saltato' => 'non sembra reale']; continue; }

    $piano = (string)($p['piano'] ?? ''); $prod = (string)($p['prodotto'] ?? 'negozio');
    $link = $cfg['checkout'][$piano][$prod] ?? '';
    if ($link === '') continue;
    $link .= (str_contains($link, '?') ? '&' : '?') . http_build_query(['sck' => $p['id'], 'email' => $p['email'], 'name' => $p['nome']]);
    $citta = $nomeComune[$p['istat'] ?? ''] ?? '';
    $posti = 0;
    foreach ($cfg['piani'] ?? [] as $pi) if ($pi['id'] === $piano) $posti = (int)($pi['posti'][$prod] ?? 0);
    $restano = max(1, $posti - ($ocupados[($p['istat'] ?? '') . '|' . $prod] ?? 0));

    $assunto = "La tua attività a $citta è quasi sulla mappa 📍";
    $corpo = "Ciao!\n\nHai iniziato a mettere «{$p['nome']}» sulla mappa 3D di Italia Casa per Casa, a $citta, ma il pagamento non è stato completato.\n\n"
        . 'I posti a ' . $citta . ' sono limitati: ' . ($restano === 1 ? 'ne resta 1' : "ne restano $restano") . ". Completa qui in 1 minuto:\n$link\n\n"
        . (!empty($p['su_misura']) ? '🎨 Hai scelto «su misura»: nella pagina di pagamento spunta la casella «Negozio su misura» (+' . $euro((int)($cfg['su_misura']['prezzo'] ?? 990)) . ").\n\n" : '')
        . "• Paghi con carta, PayPal (tocca «Mostra di più»), Klarna «paga in 30 giorni» o bonifico SEPA.\n"
        . "• Hai Partita IVA? Inseriscila nel pagamento: l'IVA viene azzerata.\n"
        . "• Controlliamo ogni attività prima di pubblicarla; se non la approviamo, ti restituiamo l'importo.\n\n"
        . "Se hai avuto un problema col pagamento, rispondi a questa e-mail e ti aiutiamo.\n\n"
        . "Italia Casa per Casa\nhttps://italiacasapercasa.com";

    if ($prova || !$horaOk || $inviati >= 15) { $risultato[] = ['id' => $p['id'], 'nome' => $p['nome'], 'citta' => $citta, 'email' => $p['email'], 'invio' => $prova ? 'prova' : 'dopo']; continue; }
    [$ok, $info] = smtp('privacy@italiacasapercasa.com', $p['email'], $assunto, $corpo);
    $risultato[] = ['id' => $p['id'], 'nome' => $p['nome'], 'citta' => $citta, 'ok' => $ok, 'info' => substr($info, 0, 120)];
    if ($ok) {
        $inviati++;
        $p['recupero_em'] = gmdate('c');
        file_put_contents($arq, json_encode($p, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT), LOCK_EX);
        file_put_contents($arqLembretes, $p['id'] . "\n", FILE_APPEND | LOCK_EX);
        $emailAvisado[$email] = true;
    }
}
echo json_encode(['ora_roma' => $roma, 'inviati' => $inviati, 'pedidos' => $risultato], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);

function smtp(string $de, string $para, string $assunto, string $corpo): array {
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
            "From: Italia Casa per Casa <$de>", "To: <$para>", "Reply-To: $de", 'Subject: =?UTF-8?B?' . base64_encode($assunto) . '?=',
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
