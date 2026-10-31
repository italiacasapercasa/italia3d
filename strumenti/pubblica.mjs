// Publica o site na Hostinger por FTP (com TLS), usando o curl (curl.exe no Windows, curl no GitHub Actions).
// Uso: node strumenti/pubblica.mjs [--tutto] [--privato] [--config]
//   (sem opção)  só os dados do mapa: snapshot.json e versao.txt (o que muda a cada atualização)
//   --tutto      o site inteiro (depois de mudar código, imagens, textos)
//   --privato    a pasta privato (config.php do webhook + .htaccess que bloqueia o acesso)
//   --config     as configurações do jogo (correções, moderação, pontos em dobro, stories manuais) para o robô do GitHub
// Acesso FTP em config/hostinger.json: { "host", "utente", "password" } — nunca publicar esse arquivo.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { listarPasta } from './zip.mjs';

const RAIZ = path.resolve(import.meta.dirname, '..');
const CFG = path.join(RAIZ, 'config', 'hostinger.json');
const CURL = process.platform === 'win32' ? 'curl.exe' : 'curl';
export const CONFIG_GIOCO = ['correzioni.json', 'moderazione.json', 'doppi.json', 'speciali.json', 'storie-manuali.json', 'commerci.json'];

export function lerCfg() {
  const c = JSON.parse(fs.readFileSync(CFG, 'utf8'));
  if (!c.password || c.password.startsWith('COLE_')) throw new Error('Preencha config/hostinger.json com host, utente e password do FTP');
  c.host = c.host.replace(/^\w+:\/\//, '').replace(/\/+$/, '');   // aceita "ftp://1.2.3.4/"
  return c;
}
const aspas = s => `"${String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;

// roda o curl com a senha pelo stdin (não aparece na linha de comando)
// --ssl-reqd: só conecta com criptografia (a senha nunca trafega aberta)
// o FTP da Hostinger às vezes demora a responder: tenta de novo até 3 vezes antes de desistir
const espera = ms => { const fim = Date.now() + ms; while (Date.now() < fim) { /* espera síncrona curta entre tentativas */ } };
export function curl(cfg, args, inseguro = false) {
  const base = ['-K', '-', '--ssl-reqd', '--silent', '--show-error', '--connect-timeout', '30'];
  if (process.platform === 'win32') base.push('--ssl-no-revoke');
  if (inseguro) base.push('--insecure');
  let res;
  for (let t = 0; t < 3; t++) {
    const r = spawnSync(CURL, [...base, ...args], { input: `user = ${aspas(`${cfg.utente}:${cfg.password}`)}\n`, encoding: 'utf8', maxBuffer: 1 << 24 });
    const linhas = (r.stderr ?? '').split(/\r?\n/).filter(l => l.trim() && !/insecure option/i.test(l));
    res = { ok: r.status === 0, codigo: r.status, saida: r.stdout ?? '', erro: linhas.join(' | ').trim() };
    // não insiste em erro de certificado (tratado por quem chama) nem em senha errada (67)
    if (res.ok || [35, 51, 60, 67].includes(r.status)) break;
    espera(5000 * (t + 1));
  }
  return res;
}

// descobre onde ficam public_html e privato na conta FTP
export function conectar(log = console.log) {
  const cfg = lerCfg();
  let inseguro = false;
  let ls = curl(cfg, ['--list-only', `ftp://${cfg.host}/`]);
  if (!ls.ok && [35, 51, 60].includes(ls.codigo)) {
    log('  aviso: o certificado do FTP é *.hstgr.io e não confere com o IP; usando TLS sem verificar o nome');
    inseguro = true;
    ls = curl(cfg, ['--list-only', `ftp://${cfg.host}/`], true);
  }
  if (!ls.ok) throw new Error(`FTP: ${ls.erro || `erro ${ls.codigo}`}`);
  const nomes = s => s.split(/\r?\n/).map(x => x.trim()).filter(x => x && x !== '.' && x !== '..');
  const raiz = nomes(ls.saida);
  let web = '', priv = 'privato/';
  if (raiz.includes('public_html')) { web = 'public_html/'; priv = 'privato/'; }
  else if (raiz.includes('domains')) {
    const doms = nomes(curl(cfg, ['--list-only', `ftp://${cfg.host}/domains/`], inseguro).saida).filter(d => /\.[a-z]{2,}$/i.test(d));
    const dom = doms.find(d => d.startsWith('italiacasapercasa')) ?? doms[0];
    if (!dom) throw new Error('não achei a pasta do domínio em /domains');
    web = `domains/${dom}/public_html/`; priv = `domains/${dom}/privato/`;
  }   // senão a raiz do FTP já é a public_html: privato fica dentro, bloqueada pelo .htaccess
  const url = p => `ftp://${cfg.host}/${p.split('/').map(encodeURIComponent).join('/')}`;
  return {
    web, priv,
    enviar(arquivos) {   // [{ local, remoto }] em lotes de 10 por conexão
      for (let i = 0; i < arquivos.length; i += 10) {
        const lote = arquivos.slice(i, i + 10), args = ['--ftp-create-dirs'];
        for (const a of lote) args.push('-T', a.local, url(a.remoto));
        const r = curl(cfg, args, inseguro);
        if (!r.ok) throw new Error(`envio falhou (${lote.map(a => a.remoto).join(', ')}): ${r.erro}`);
      }
    },
    listar(remoto) {   // nomes dos arquivos de uma pasta ([] se não existe)
      const r = curl(cfg, ['--list-only', url(remoto.replace(/\/?$/, '/'))], inseguro);
      return r.ok ? nomes(r.saida) : [];
    },
    apagar(remoto) {   // remove um arquivo do servidor (o DELE vai antes do CWD: caminho a partir da raiz do FTP)
      return curl(cfg, ['-Q', `DELE ${remoto}`, '--list-only', `ftp://${cfg.host}/`], inseguro).ok;
    },
    baixar(remoto, local) {   // devolve false se o arquivo não existe no servidor
      fs.mkdirSync(path.dirname(local), { recursive: true });
      const r = curl(cfg, ['-o', `${local}.tmp`, url(remoto)], inseguro);
      if (!r.ok) { try { fs.unlinkSync(`${local}.tmp`); } catch { /* nada baixado */ } return false; }
      fs.renameSync(`${local}.tmp`, local);
      return true;
    },
  };
}

export function pubblicare({ tutto = false, privato = false, config = false, log = console.log } = {}) {
  const ftp = conectar(log);
  log(`FTP ok · site em "/${ftp.web}" · privato em "/${ftp.priv}"`);
  let arquivos;
  if (config) {
    arquivos = CONFIG_GIOCO.filter(n => fs.existsSync(path.join(RAIZ, 'config', n))).map(n => ({ local: path.join(RAIZ, 'config', n), remoto: `${ftp.priv}config-gioco/${n}` }));
  } else if (privato) {
    arquivos = listarPasta(path.join(RAIZ, 'privato'), '', rel => rel.startsWith('dati') || rel.startsWith('config-gioco') || rel.endsWith('.esempio.php') || rel === 'ig-token.json').map(a => ({ local: path.join(RAIZ, 'privato', a.nome), remoto: ftp.priv + a.nome }));
  } else if (tutto) {
    // dados por último: quem abrir o site no meio do envio não pega código novo com dado velho
    // fora do site no ar: gravador de vídeo e dados de demonstração (só para testes no PC);
    // data/decori.json é escrito no servidor pelo webhook da Hotmart: nunca sobrescrever com a cópia do PC
    const todos = listarPasta(path.join(RAIZ, 'sito'), '', rel => rel.startsWith('video') || rel.startsWith('data/demo') || rel === 'data/decori.json').map(a => ({ local: path.join(RAIZ, 'sito', a.nome), remoto: ftp.web + a.nome }));
    arquivos = [...todos.filter(a => !a.remoto.includes('data/')), ...todos.filter(a => a.remoto.includes('data/') && !a.remoto.endsWith('versao.txt')), ...todos.filter(a => a.remoto.endsWith('versao.txt'))];
  } else {
    arquivos = ['data/snapshot.json', 'data/versao.txt'].map(n => ({ local: path.join(RAIZ, 'sito', n), remoto: ftp.web + n }));
  }
  const t0 = Date.now();
  ftp.enviar(arquivos);
  log(`publicado: ${arquivos.length} arquivo(s) em ${((Date.now() - t0) / 1000).toFixed(1)} s`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const arg = k => process.argv.includes(k);
  try { pubblicare({ tutto: arg('--tutto'), privato: arg('--privato'), config: arg('--config') }); }
  catch (e) { console.error(`ERRO: ${e.message}`); process.exit(1); }
}
