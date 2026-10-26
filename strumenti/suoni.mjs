// Sintetiza os efeitos sonoros de um reel (lista salva por cattura.mjs --suoni) e mistura com a narração.
// Sem arquivos de som externos: cada efeito é gerado aqui (tique, pop, clique, whoosh, bandeira, carimbo, ding).
// Uso: node strumenti/suoni.mjs <efeitos.json> <voz.mp3> <saida.wav> [--durata 25] [--volume 0.5]
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';

const RAIZ = path.resolve(import.meta.dirname, '..');
const FFMPEG = path.join(RAIZ, '.tools', 'ffmpeg', 'bin', 'ffmpeg.exe');
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const [efeitosArq, voz, saida] = args;
const SR = 48000, efeitos = JSON.parse(fs.readFileSync(efeitosArq, 'utf8'));
const durata = +opt('--durata', Math.max(...efeitos.map(e => e.t)) + 2);
const buf = new Float32Array(Math.ceil(durata * SR));

// ruído determinístico (o mesmo vídeo gera sempre o mesmo som)
let semente = 12345;
const ruido = () => { semente = (semente * 1103515245 + 12345) & 0x7fffffff; return semente / 0x3fffffff - 1; };
const somar = (t0, n, f) => { const i0 = Math.round(t0 * SR); for (let i = 0; i < n; i++) if (i0 + i >= 0 && i0 + i < buf.length) buf[i0 + i] += f(i / SR); };
const sino = (t0, freq, dur, amp, tau, parciais = [[1, 1]]) => {
  const fases = parciais.map(() => 0);
  somar(t0, dur * SR, t => {
    const ataque = Math.min(1, t / 0.002);
    return parciais.reduce((s, [m, a], k) => { fases[k] += 2 * Math.PI * freq * m / SR; return s + Math.sin(fases[k]) * a; }, 0) * amp * ataque * Math.exp(-t / tau);
  });
};
// filtro passa-banda (state variable) para o ruído
function passaBanda() {
  let low = 0, band = 0;
  return (x, fc, q = 2) => { const f = 2 * Math.sin(Math.PI * Math.min(fc, SR / 6) / SR); const high = x - low - band / q; band += f * high; low += f * band; return band; };
}

const SINT = {
  tick: ({ tono = 1, vol = 1 }) => (t0) => { sino(t0, 2300 * tono, 0.03, 0.22 * vol, 0.006); somar(t0, 0.004 * SR, () => ruido() * 0.08 * vol); },
  pop: ({ tono = 1, vol = 1 }) => (t0) => {
    let fase = 0;
    somar(t0, 0.09 * SR, t => { const f = (380 + 700 * Math.exp(-t / 0.018)) * tono; fase += 2 * Math.PI * f / SR; return Math.sin(fase) * 0.55 * vol * Math.min(1, t / 0.0015) * Math.exp(-t / 0.028); });
  },
  select: ({ tono = 1, vol = 1 }) => (t0) => {
    sino(t0, 988 * tono, 0.09, 0.3 * vol, 0.03, [[1, 1], [2, 0.25]]);
    sino(t0 + 0.055, 1480 * tono, 0.16, 0.3 * vol, 0.05, [[1, 1], [2, 0.2]]);
  },
  whoosh: ({ dur = 1, vol = 1, giu = false }) => (t0) => {
    const bp = passaBanda(), bp2 = passaBanda();
    somar(t0, dur * SR, t => {
      // sobe até 65% da duração e some
      const s = t / dur, env = s < 0.65 ? Math.sin(Math.PI / 2 * s / 0.65) ** 2 : Math.cos(Math.PI / 2 * (s - 0.65) / 0.35) ** 2;
      const fc = giu ? 2600 * Math.pow(250 / 2600, s) : 300 * Math.pow(2400 / 300, Math.sin(Math.PI * s * 0.5));
      const n = ruido();
      return (bp(n, fc, 1.6) * 0.8 + bp2(n, fc * 1.9, 3) * 0.35) * env * 0.55 * vol;
    });
  },
  flap: ({ vol = 1 }) => (t0) => {
    const bp = passaBanda();
    somar(t0, 0.55 * SR, t => bp(ruido(), 900, 0.8) * Math.pow(Math.abs(Math.sin(2 * Math.PI * 11 * t)), 3) * Math.exp(-t / 0.25) * 0.7 * vol);
  },
  stamp: ({ vol = 1 }) => (t0) => {
    let fase = 0;
    somar(t0, 0.25 * SR, t => { const f = 55 + 70 * Math.exp(-t / 0.04); fase += 2 * Math.PI * f / SR; return Math.sin(fase) * 0.85 * vol * Math.min(1, t / 0.002) * Math.exp(-t / 0.07); });
    somar(t0, 0.025 * SR, t => ruido() * 0.35 * vol * Math.exp(-t / 0.006));
    sino(t0 + 0.02, 1568, 0.9, 0.22 * vol, 0.28, [[1, 1], [2.01, 0.35], [3.02, 0.15]]);
  },
  ding: ({ tono = 1, vol = 1 }) => (t0) => sino(t0, 1318 * tono, 1.2, 0.3 * vol, 0.35, [[1, 1], [2.0, 0.4], [3.01, 0.18], [4.2, 0.08]]),
};
for (const e of efeitos) SINT[e.tipo](e)(e.t);

// pico dos efeitos em -9 dB; a narração fica por cima
const pico = buf.reduce((m, v) => Math.max(m, Math.abs(v)), 0) || 1, ganho = 0.35 * +opt('--volume', 1) / pico;
const pcm = Buffer.alloc(buf.length * 2);
buf.forEach((v, i) => pcm.writeInt16LE(Math.max(-32767, Math.min(32767, Math.round(v * ganho * 32767))), i * 2));
const tmp = path.join(os.tmpdir(), `suoni-${process.pid}.raw`);
fs.writeFileSync(tmp, pcm);
const r = spawnSync(FFMPEG, ['-y', '-loglevel', 'error', '-i', voz, '-f', 's16le', '-ar', String(SR), '-ac', '1', '-i', tmp,
  // tudo em mono e só no fim duplicado nos 2 canais (o upmix automático do ffmpeg baixa 3 dB)
  '-filter_complex', '[0:a]aresample=48000,aformat=channel_layouts=mono,apad[v];[1:a]aresample=48000[s];[v][s]amix=inputs=2:normalize=0:duration=longest,alimiter=limit=0.95:level=false,pan=stereo|c0=c0|c1=c0',
  '-t', durata.toFixed(3), '-ar', '48000', saida], { encoding: 'utf8' });
fs.rmSync(tmp, { force: true });
if (r.status !== 0) throw new Error(r.stderr);
console.log(`${efeitos.length} efeitos · ${durata.toFixed(2)} s → ${saida}`);
