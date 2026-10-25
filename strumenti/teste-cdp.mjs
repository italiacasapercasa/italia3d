// Teste de interação no Chrome headless via DevTools Protocol (busca, cliques, abas, erros de console).
// Uso: node strumenti/teste-cdp.mjs [url] [pasta-saida]
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const URL_SITE = process.argv[2] ?? 'http://localhost:5173/';
const SAIDA = process.argv[3] ?? os.tmpdir();
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORTA = 9333;
const perfil = fs.mkdtempSync(path.join(os.tmpdir(), 'cdp-'));
const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${PORTA}`, `--user-data-dir=${perfil}`, '--window-size=500,940',
  '--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--hide-scrollbars', 'about:blank'], { stdio: 'ignore' });
const espera = ms => new Promise(ok => setTimeout(ok, ms));

let ws, id = 0;
const pend = new Map(), erros = [];
async function conectar() {
  for (let t = 0; t < 50; t++) {
    try {
      const lista = await (await fetch(`http://127.0.0.1:${PORTA}/json/list`)).json();
      const pag = lista.find(p => p.type === 'page');
      if (pag) { ws = new WebSocket(pag.webSocketDebuggerUrl); break; }
    } catch { /* ainda subindo */ }
    await espera(200);
  }
  await new Promise(ok => ws.addEventListener('open', ok));
  ws.addEventListener('message', ev => {
    const m = JSON.parse(ev.data);
    if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); }
    if (m.method === 'Runtime.exceptionThrown') erros.push(m.params.exceptionDetails.exception?.description ?? m.params.exceptionDetails.text);
    if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') erros.push(m.params.args.map(a => a.value ?? a.description).join(' '));
  });
}
const cdp = (method, params = {}) => new Promise(ok => { const i = ++id; pend.set(i, ok); ws.send(JSON.stringify({ id: i, method, params })); });
const avaliar = async expr => (await cdp('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true })).result?.result?.value;
const clicar = async (x, y) => {
  for (const type of ['mousePressed', 'mouseReleased']) await cdp('Input.dispatchMouseEvent', { type, x, y, button: 'left', clickCount: 1 });
};
const foto = async nome => {
  const r = await cdp('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(SAIDA, nome), Buffer.from(r.result.data, 'base64'));
};
const ok = (cond, msg) => console.log(`${cond ? '✔' : '✘'} ${msg}`);

try {
  await conectar();
  await cdp('Runtime.enable'); await cdp('Page.enable');
  await cdp('Page.navigate', { url: URL_SITE });
  for (let t = 0; t < 60 && !(await avaliar('!!window.__italia')); t++) await espera(250);
  ok(await avaliar('!!window.__italia'), 'site carregou');

  // busca
  await avaliar(`(() => { const q = document.querySelector('#q'); q.value = 'milan'; q.dispatchEvent(new Event('input')); })()`);
  const sug = await avaliar(`[...document.querySelectorAll('#risultati [data-r]')].map(b => b.innerText.replace(/\\n/g, ' | '))`);
  ok(sug?.length > 0, `busca "milan": ${sug?.slice(0, 3).join(' ; ')}`);
  await avaliar(`document.querySelector('#risultati [data-r^="m:"]').click()`);
  await espera(2500);
  ok((await avaliar(`document.querySelector('#pannello h2')?.innerText`))?.includes('Milano'), 'resultado abre o painel de Milano');
  await foto('cdp-1-milano.png');

  // clique numa casa no mapa (fecha painel, clica no centro da tela)
  await avaliar(`__italia.ui.fechar(); __italia.mappa.voar({ x: __italia.D.luoghi.find(l => l.nome === 'Milano').x, z: __italia.D.luoghi.find(l => l.nome === 'Milano').z, dist: 0.8, az: 0.6 }, 10)`);
  await espera(800);
  let achou = false;
  for (const [x, y] of [[250, 470], [230, 500], [280, 440], [250, 540], [200, 470]]) {
    await clicar(x, y); await espera(400);
    const h = await avaliar(`document.querySelector('#pannello:not([hidden]) h2')?.innerText`);
    if (h) { achou = true; ok(true, `clique no mapa abre: ${h}`); break; }
  }
  if (!achou) ok(false, 'clique no mapa não abriu painel');
  await foto('cdp-2-clique.png');

  // rótulo de casa clicável
  const rot = await avaliar(`(() => { const e = [...document.querySelectorAll('.et-casa:not([hidden])')][0]; if (!e) return null; e.click(); return e.innerText; })()`);
  await espera(600);
  ok(rot && (await avaliar(`document.querySelector('#pannello h2')?.innerText`))?.includes(rot.replace(/^[^@]*/, '')), `clique no rótulo ${rot}`);

  // "è la mia casa" + botão casa
  await avaliar(`document.querySelector('[data-minha]:not([data-minha=""])')?.click()`);
  await espera(300);
  ok(await avaliar(`!document.querySelector('#vai-casa').hidden`), 'botão 🏠 aparece depois de "è la mia casa"');

  // abas
  for (const aba of ['palazzo', 'classifica', 'tabellone', 'senzapadrone']) {
    await avaliar(`document.querySelector('#schede [data-aba="${aba}"]').click()`);
    await espera(250);
    ok(!!(await avaliar(`document.querySelector('#pannello h2')?.innerText`)), `aba ${aba}: ${await avaliar(`document.querySelector('#pannello h2')?.innerText`)}`);
  }
  await avaliar(`document.querySelector('#schede [data-aba="mappa"]').click()`);
  ok(await avaliar(`document.querySelector('#pannello').hidden`), 'aba mappa fecha o painel');

  // ver país
  await avaliar(`document.querySelector('#vedi-paese').click()`);
  await espera(2600);
  ok((await avaliar('__italia.mappa.dist')) > 600, `ver país: dist ${(await avaliar('__italia.mappa.dist'))?.toFixed(0)}`);
  await foto('cdp-3-pais.png');

  // painéis da fase 2
  for (const [rota, esperado] of [['derby', 'Derby'], ['meta', 'traguardo']]) {
    await avaliar(`__italia.ui.rota('${rota}')`);
    await espera(200);
    ok((await avaliar(`document.querySelector('#pannello h2')?.innerText`))?.includes(esperado), `painel ${rota}`);
  }
  await avaliar(`__italia.ui.tabellone()`);
  ok((await avaliar(`document.querySelectorAll('.notizia').length`)) > 0, `notícias no tabellone: ${await avaliar(`document.querySelectorAll('.notizia').length`)}`);
  ok((await avaliar(`[...document.querySelectorAll('#chips .chip')].filter(b => !b.hidden).length`)) === 1, `chips em rodízio: ${await avaliar(`[...document.querySelectorAll('#chips .chip')].map(b => b.innerText).join(' | ')`)}`);

  // imagens de story
  const salvarImagem = async (expr, nome) => {
    await avaliar(expr);
    for (let t = 0; t < 40 && !(await avaliar(`!!document.querySelector('img.anteprima')`)); t++) await espera(250);
    const b64 = await avaliar(`(async () => { const r = await fetch(document.querySelector('img.anteprima').src); const b = await r.blob(); return await new Promise(ok => { const f = new FileReader(); f.onload = () => ok(f.result.split(',')[1]); f.readAsDataURL(b); }); })()`);
    if (b64) fs.writeFileSync(path.join(SAIDA, nome), Buffer.from(b64, 'base64'));
    ok(!!b64, `imagem ${nome} (${b64 ? Math.round(b64.length * 0.75 / 1024) : 0} KB)`);
  };
  const top = await avaliar(`__italia.D.ranking.find(c => c.carica && c.livello >= 9)?.conta ?? __italia.D.ranking[0].conta`);
  await salvarImagem(`__italia.ui.storiaCasa(__italia.D.porConta.get('${top}'))`, 'story-casa.png');
  await salvarImagem(`__italia.ui.attoFondazione(__italia.D.luoghi.find(l => l.nome === 'Bologna'))`, 'story-fondazione.png');
  await salvarImagem(`__italia.ui.condividir('luogo:' + __italia.D.luoghi.find(l => l.nome === 'Napoli').id)`, 'story-citta.png');

  ok(erros.length === 0, `erros de console: ${erros.length ? erros.join(' || ') : 'nenhum'}`);
} catch (e) {
  console.error('falhou:', e);
} finally {
  ws?.close();
  chrome.kill();
  await espera(500);
  try { fs.rmSync(perfil, { recursive: true, force: true }); } catch { /* chrome ainda segurando */ }
}
