// Backup diário das contas (créditos, interiores, personagens), pedidos de lojas e decorações.
// Baixa o zip que api/backup.php monta no servidor e guarda em backup/ (fora do git: tem e-mails). Mantém 14 dias (~27 MB por dia, com os logos das lojas).
// Uso: node strumenti/backup-conti.mjs        (agendado no Windows: "Italia3D - backup conti", todo dia às 04:00)
// Restaurar: abrir o zip do dia, conferir e subir os arquivos para privato/dati/ pelo FTP (pedir OK antes).
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PASTA = path.join(RAIZ, 'backup'), DIAS = 14;
const cfg = fs.readFileSync(path.join(RAIZ, 'privato', 'config.php'), 'utf8');
const chave = cfg.match(/define\(\s*['"]CHIAVE_DOWNLOAD['"]\s*,\s*['"]([^'"]+)['"]/)?.[1];
if (!chave) { console.error('CHIAVE_DOWNLOAD não encontrada no privato/config.php'); process.exit(1); }
fs.mkdirSync(PASTA, { recursive: true });
const dia = new Date().toISOString().slice(0, 10), destino = path.join(PASTA, `backup-${dia}.zip`), tmp = `${destino}.parte`;
const log = msg => { const l = `${new Date().toISOString()} ${msg}`; console.log(l); fs.appendFileSync(path.join(PASTA, 'backup.log'), l + '\n'); };
try {
  const code = execFileSync('curl.exe', ['-s', '-S', '--max-time', '300', '-o', tmp, '-w', '%{http_code}', '-H', `X-Chiave: ${chave}`, 'https://italiacasapercasa.com/api/backup.php'], { encoding: 'utf8' }).trim();
  const buf = fs.existsSync(tmp) ? fs.readFileSync(tmp) : Buffer.alloc(0);
  if (code !== '200' || buf.length < 100 || buf.toString('latin1', 0, 2) !== 'PK') throw new Error(`resposta ${code}, ${buf.length} bytes`);
  fs.renameSync(tmp, destino);
  log(`ok ${path.basename(destino)} ${(buf.length / 1024).toFixed(0)} KB`);
} catch (e) {
  try { fs.unlinkSync(tmp); } catch { /* nada */ }
  log(`ERRO ${e.message}`);
  process.exit(1);
}
// apaga os backups com mais de 14 dias
const limite = Date.now() - DIAS * 86400000;
for (const n of fs.readdirSync(PASTA)) {
  const m = n.match(/^backup-(\d{4}-\d{2}-\d{2})\.zip$/);
  if (m && Date.parse(m[1]) < limite) { fs.unlinkSync(path.join(PASTA, n)); log(`apagado ${n}`); }
}
