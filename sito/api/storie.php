<?php
// Entrega o storie.jsonl para o atualizador do mapa (protegido por chave).
declare(strict_types=1);
require is_file(__DIR__ . '/../../privato/config.php') ? __DIR__ . '/../../privato/config.php' : __DIR__ . '/../privato/config.php';

if (!hash_equals(CHIAVE_DOWNLOAD, (string)($_GET['chiave'] ?? ''))) {
    http_response_code(403);
    exit;
}
header('Content-Type: text/plain; charset=utf-8');
header('Cache-Control: no-store');
$arq = CARTELLA . '/storie.jsonl';
if (is_file($arq)) readfile($arq);
