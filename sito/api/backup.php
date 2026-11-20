<?php
// Backup diário (strumenti/backup-conti.mjs no PC baixa daqui): zip com contas, créditos, interiores, pedidos e decorações.
// Protegido pela chave CHIAVE_DOWNLOAD (cabeçalho X-Chiave, só por HTTPS). Fica de fora o que é temporário:
// sessões, códigos de login, limites e prêmios do dia.
declare(strict_types=1);
require is_file(__DIR__ . '/../../privato/config.php') ? __DIR__ . '/../../privato/config.php' : __DIR__ . '/../privato/config.php';
$chave = (string)($_SERVER['HTTP_X_CHIAVE'] ?? '');
if (!defined('CHIAVE_DOWNLOAD') || CHIAVE_DOWNLOAD === '' || !hash_equals(CHIAVE_DOWNLOAD, $chave)) { http_response_code(404); exit; }
if (!class_exists('ZipArchive')) { http_response_code(500); header('Content-Type: text/plain'); echo 'sem ZipArchive'; exit; }

$base = realpath(CARTELLA);
$PASTAS = ['conti', 'negozi', 'decori', 'missioni'];
$FORA = '#^conti/(sessioni|codici)/|/\.limite-|^conti/premi-|/\.conte\.txt$#';
$tmp = tempnam(sys_get_temp_dir(), 'bk');
$z = new ZipArchive();
if ($z->open($tmp, ZipArchive::OVERWRITE) !== true) { http_response_code(500); exit; }
$n = 0;
foreach ($PASTAS as $p) {
    $dir = "$base/$p";
    if (!is_dir($dir)) continue;
    $it = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($dir, FilesystemIterator::SKIP_DOTS));
    foreach ($it as $f) {
        if (!$f->isFile()) continue;
        $rel = str_replace('\\', '/', substr($f->getPathname(), strlen($base) + 1));
        if (preg_match($FORA, '/' . $rel) || preg_match($FORA, $rel)) continue;
        $z->addFile($f->getPathname(), $rel); $n++;
    }
}
$z->addFromString('_info.json', json_encode(['em' => gmdate('c'), 'arquivos' => $n]));
$z->close();
header('Content-Type: application/zip');
header('Content-Disposition: attachment; filename="backup-' . gmdate('Y-m-d') . '.zip"');
header('Content-Length: ' . filesize($tmp));
header('Cache-Control: no-store');
readfile($tmp);
@unlink($tmp);
