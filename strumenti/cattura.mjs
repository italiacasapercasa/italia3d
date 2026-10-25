// Captura quadro a quadro uma página de vídeo (video/registra.html) no Chrome headless e monta o MP4 com ffmpeg.
// A página expõe window.preparar(roteiro) -> { durata, fps } e window.quadro(t) -> Promise (desenha o instante t em segundos).
// Uso: node strumenti/cattura.mjs <roteiro.json> <saida.mp4> [--audio voz.mp3] [--fps 30] [--ate 5] [--pagina video/presidente.html]
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const RAIZ = path.resolve(import.meta.dirname, '..');
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const [roteiroArq, saida] = args;
const audio = opt('--audio'), fps = +opt('--fps', 30), ate = opt('--ate') ? +opt('--ate') : null;
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const FFMPEG = path.join(RAIZ, '.tools', 'ffmpeg', 'bin', 'ffmpeg.exe');
const PORTA = 9334, W = 1080, H = 1920;
const espera = ms => new Promise(ok => setTimeout(ok, ms));

const perfil = fs.mkdtempSync(path.join(os.tmpdir(), 'cattura-'));
const pasta = fs.mkdtempSync(path.join(os.tmpdir(), 'quadri-'));
const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${PORTA}`, `--user-data-dir=${perfil}`, `--window-size=${W},${H}`,
  '--hide-scrollbars', '--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--force-device-scale-factor=1', 'about:blank'], { stdio: 'ignore' });

let ws, id = 0;
const pend = new Map();
async function conectar() {
  for (let t = 0; t < 50 && !ws; t++) {
    try { const l = await (await fetch(`http://127.0.0.1:${PORTA}/json/list`)).json(); const p = l.find(x => x.type === 'page'); if (p) ws = new WebSocket(p.webSocketDebuggerUrl); } catch { /* subindo */ }
    if (!ws) await espera(200);
  }
  await new Promise(ok => ws.addEventListener('open', ok));
  ws.addEventListener('message', ev => {
    const m = JSON.parse(ev.data);
    if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); }
    if (m.method === 'Runtime.exceptionThrown') console.error('erro na página:', m.params.exceptionDetails.exception?.description ?? m.params.exceptionDetails.text);
    if (m.method === 'Runtime.consoleAPICalled') console.log('página:', m.params.args.map(a => a.value ?? a.description).join(' '));
  });
}
const cdp = (method, params = {}) => new Promise(ok => { const i = ++id; pend.set(i, ok); ws.send(JSON.stringify({ id: i, method, params })); });
const avaliar = async expr => { const r = await cdp('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }); if (r.result?.exceptionDetails) throw new Error(r.result.exceptionDetails.exception?.description ?? 'erro'); return r.result?.result?.value; };

try {
  await conectar();
  await cdp('Runtime.enable'); await cdp('Page.enable');
  await cdp('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: false });
  // --pagina video/presidente.html: outro gravador (padrão: o do reel 1)
  await cdp('Page.navigate', { url: `http://localhost:5173/${opt('--pagina', 'video/registra.html')}` });
  for (let t = 0; t < 120 && !(await avaliar('!!window.quadro').catch(() => false)); t++) await espera(250);
  const roteiro = fs.readFileSync(roteiroArq, 'utf8');
  const info = await avaliar(`window.preparar(${roteiro})`);
  // --quadri 0,1.5,6: só salva esses instantes como JPG na pasta <saida> (pré-visualização)
  const soltos = opt('--quadri');
  if (soltos) {
    fs.mkdirSync(saida, { recursive: true });
    for (const t of soltos.split(',').map(Number)) {
      await avaliar(`window.quadro(${t})`);
      // --scala 1 --png: resolução cheia em PNG (capa do reel)
      const png = args.includes('--png'), scala = +opt('--scala', 0.5);
      const r = await cdp('Page.captureScreenshot', { format: png ? 'png' : 'jpeg', ...(png ? {} : { quality: 85 }), clip: { x: 0, y: 0, width: W, height: H, scale: scala } });
      fs.writeFileSync(path.join(saida, `t${t.toFixed(2)}.${png ? 'png' : 'jpg'}`), Buffer.from(r.result.data, 'base64'));
    }
    console.log(`${soltos.split(',').length} quadros em ${saida}`);
    throw Object.assign(new Error('ok'), { fim: true });
  }
  const durata = ate ?? info.durata, total = Math.ceil(durata * fps);
  console.log(`${durata.toFixed(1)} s · ${total} quadros a ${fps} fps`);
  const t0 = Date.now();
  for (let f = 0; f < total; f++) {
    await avaliar(`window.quadro(${(f / fps).toFixed(4)})`);
    const r = await cdp('Page.captureScreenshot', { format: 'jpeg', quality: 92, clip: { x: 0, y: 0, width: W, height: H, scale: 1 } });
    fs.writeFileSync(path.join(pasta, `q${String(f).padStart(5, '0')}.jpg`), Buffer.from(r.result.data, 'base64'));
    if (f % 60 === 0) console.log(`  quadro ${f}/${total} · ${((Date.now() - t0) / 1000).toFixed(0)} s`);
  }
  const ff = ['-y', '-framerate', String(fps), '-i', path.join(pasta, 'q%05d.jpg')];
  if (audio) ff.push('-i', audio);
  // JPG vem em faixa "de foto" (full range): converte para o padrão de vídeo, senão o Instagram desbota as cores
  ff.push('-vf', 'scale=out_range=tv,format=yuv420p', '-color_range', 'tv', '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709');
  ff.push('-c:v', 'libx264', '-profile:v', 'high', '-crf', '18', '-preset', 'medium', '-movflags', '+faststart');
  // áudio completado com silêncio até o fim do vídeo
  if (audio) ff.push('-af', 'apad', '-c:a', 'aac', '-b:a', '192k');
  ff.push('-t', durata.toFixed(3), saida);
  const r = spawnSync(FFMPEG, ff, { encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`ffmpeg: ${r.stderr.slice(-500)}`);
  console.log(`vídeo: ${saida} (${(fs.statSync(saida).size / 1e6).toFixed(1)} MB) em ${((Date.now() - t0) / 1000).toFixed(0)} s`);
} catch (e) {
  if (!e.fim) { console.error('falhou:', e.message); process.exitCode = 1; }
} finally {
  ws?.close();
  chrome.kill();
  await espera(500);
  for (const p of [perfil, pasta]) { try { fs.rmSync(p, { recursive: true, force: true }); } catch { /* em uso */ } }
}
