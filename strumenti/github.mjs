// Ferramentas do GitHub a partir do PC (token em config/github.json, nunca no repositório).
// Uso: node strumenti/github.mjs push       envia os commits para o GitHub
//      node strumenti/github.mjs segreti    cadastra/atualiza os Secrets do robô (criptografados)
//      node strumenti/github.mjs stato      mostra as últimas execuções do robô
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const RAIZ = path.resolve(import.meta.dirname, '..');
const GIT = path.join(RAIZ, '.tools', 'git', 'cmd', 'git.exe');
const gh = JSON.parse(fs.readFileSync(path.join(RAIZ, 'config', 'github.json'), 'utf8'));
if (!gh.token || gh.token.startsWith('COLE_')) { console.error('Preencha config/github.json'); process.exit(1); }
const REPO = `${gh.utente}/${gh.repo}`;

async function api(metodo, caminho, corpo) {
  const r = await fetch(`https://api.github.com/repos/${REPO}${caminho}`, {
    method: metodo,
    headers: { Authorization: `Bearer ${gh.token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'italia3d' },
    body: corpo ? JSON.stringify(corpo) : undefined,
  });
  const txt = await r.text();
  if (!r.ok) throw new Error(`GitHub ${r.status} ${metodo} ${caminho}: ${txt.slice(0, 200)}`);
  return txt ? JSON.parse(txt) : null;
}

const comando = process.argv[2];
if (comando === 'push') {
  // credencial só nesta execução, por variável de ambiente (não fica no .git/config)
  const basic = Buffer.from(`x-access-token:${gh.token}`).toString('base64');
  const env = { ...process.env, GIT_CONFIG_COUNT: '1', GIT_CONFIG_KEY_0: 'http.https://github.com/.extraheader', GIT_CONFIG_VALUE_0: `AUTHORIZATION: basic ${basic}`, GIT_TERMINAL_PROMPT: '0' };
  const git = (...a) => spawnSync(GIT, a, { cwd: RAIZ, env, encoding: 'utf8' });
  const remoto = `https://github.com/${REPO}.git`;
  if (git('remote', 'get-url', 'origin').status !== 0) git('remote', 'add', 'origin', remoto);
  else git('remote', 'set-url', 'origin', remoto);
  const r = git('push', '-u', 'origin', 'main');
  console.log((r.stdout + r.stderr).trim());
  process.exit(r.status);
} else if (comando === 'segreti') {
  const sodium = (await import(pathToUrl(path.join(RAIZ, '.tools', 'sodium', 'node_modules', 'libsodium-wrappers', 'dist', 'modules', 'libsodium-wrappers.js')))).default;
  await sodium.ready;
  const ig = JSON.parse(fs.readFileSync(path.join(RAIZ, 'config', 'instagram.json'), 'utf8'));
  const ftp = JSON.parse(fs.readFileSync(path.join(RAIZ, 'config', 'hostinger.json'), 'utf8'));
  const valores = {
    IG_TOKEN: ig.token, STORIE_URL: ig.webhook_storie,
    FTP_HOST: ftp.host.replace(/^\w+:\/\//, '').replace(/\/+$/, ''), FTP_USER: ftp.utente, FTP_PASSWORD: ftp.password,
  };
  const chave = await api('GET', '/actions/secrets/public-key');
  for (const [nome, valor] of Object.entries(valores)) {
    if (!valor) throw new Error(`valor vazio para ${nome}`);
    const cifrado = sodium.crypto_box_seal(sodium.from_string(valor), sodium.from_base64(chave.key, sodium.base64_variants.ORIGINAL));
    await api('PUT', `/actions/secrets/${nome}`, { encrypted_value: sodium.to_base64(cifrado, sodium.base64_variants.ORIGINAL), key_id: chave.key_id });
    console.log(`secret ${nome} ok`);
  }
} else if (comando === 'stato') {
  const r = await fetch(`https://api.github.com/repos/${REPO}/actions/runs?per_page=5`, { headers: { 'User-Agent': 'italia3d', Authorization: `Bearer ${gh.token}` } }).then(x => x.json());
  for (const x of r.workflow_runs ?? []) console.log(`${x.created_at} · ${x.event} · ${x.status} · ${x.conclusion ?? '…'} · ${x.html_url}`);
  if (!r.workflow_runs?.length) console.log('nenhuma execução ainda', r.message ?? '');
} else {
  console.log('uso: node strumenti/github.mjs push | segreti | stato');
}

function pathToUrl(p) { return 'file:///' + p.replace(/\\/g, '/'); }
