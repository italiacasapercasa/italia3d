// Monta os pacotes para subir na Hostinger:
//   pubblicare/public_html.zip  -> extrair dentro de public_html
//   pubblicare/privato.zip      -> extrair na pasta acima de public_html (fica fora da internet)
// Uso: node strumenti/pacchetto.mjs
import fs from 'node:fs';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { criarZip, listarPasta } from './zip.mjs';

const RAIZ = path.resolve(import.meta.dirname, '..');
const SAIDA = path.join(RAIZ, 'pubblicare');

const site = listarPasta(path.join(RAIZ, 'sito'));
criarZip(path.join(SAIDA, 'public_html.zip'), site);

// config.php do servidor: gera as senhas uma vez e reaproveita depois
const cfgLocal = path.join(RAIZ, 'privato', 'config.php');
if (!fs.existsSync(cfgLocal)) {
  const senha = () => randomBytes(24).toString('base64url');
  fs.writeFileSync(cfgLocal, `<?php
// Configuração do servidor (NÃO publicar). Fica fora de public_html.
define('APP_SECRET', 'COLE_AQUI_A_CHAVE_SECRETA_DO_APP_INSTAGRAM');
define('VERIFY_TOKEN', '${senha()}');
define('CHIAVE_DOWNLOAD', '${senha()}');
define('CARTELLA', __DIR__ . '/dati');
`);
}
criarZip(path.join(SAIDA, 'privato.zip'), [{ nome: 'privato/config.php', dados: fs.readFileSync(cfgLocal) }]);

const mb = f => (fs.statSync(path.join(SAIDA, f)).size / 1e6).toFixed(1);
console.log(`public_html.zip: ${site.length} arquivos, ${mb('public_html.zip')} MB`);
console.log(`privato.zip: ${mb('privato.zip')} MB`);
console.log(`pasta: ${SAIDA}`);
