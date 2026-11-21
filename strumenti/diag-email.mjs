// Diagnóstico dos e-mails de login: chama api/diag.php com a chave CHIAVE_DOWNLOAD (lida do privato/config.php, nunca mostrada).
// Uso: node strumenti/diag-email.mjs
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cfg = fs.readFileSync(path.join(RAIZ, 'privato', 'config.php'), 'utf8');
const chave = cfg.match(/define\(\s*['"]CHIAVE_DOWNLOAD['"]\s*,\s*['"]([^'"]+)['"]/)?.[1];
if (!chave) { console.error('CHIAVE_DOWNLOAD não encontrada'); process.exit(1); }
const out = execFileSync('curl.exe', ['-s', '-S', '--max-time', '90', '-H', `X-Chiave: ${chave}`, 'https://italiacasapercasa.com/api/diag.php'], { encoding: 'utf8' });
console.log(out || '(vazio: diag.php ainda não está no servidor ou a chave não confere)');
