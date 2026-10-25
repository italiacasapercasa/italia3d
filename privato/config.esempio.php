<?php
// Copie para config.php e preencha. Esta pasta fica FORA da pasta pública do site (public_html).
define('APP_SECRET', 'chave secreta do app do Instagram (painel da Meta)');
define('VERIFY_TOKEN', 'uma senha que você inventa e repete no painel de webhooks da Meta');
define('CHIAVE_DOWNLOAD', 'outra senha longa, usada pelo atualizador para baixar as stories');
define('CARTELLA', __DIR__ . '/dati');
// opcionais (lojas): hottok do webhook da Hotmart e email que recebe aviso de pedido novo
define('HOTMART_HOTTOK', '');
define('EMAIL_AVVISI', '');
