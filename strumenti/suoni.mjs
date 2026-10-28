// Sintetiza os efeitos sonoros de um reel (lista salva por cattura.mjs --suoni) e mistura com a narração.
// Sem arquivos de som externos: cada efeito é gerado aqui (tique, pop, clique, whoosh, bandeira, carimbo, ding).
// Uso: node strumenti/suoni.mjs <efeitos.json> <voz.mp3> <saida.wav> [--durata 25] [--volume 0.5] [--musica 112] [--vol-musica 0.16]
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
  // toque de dedo na tela
  tap: ({ vol = 1 }) => (t0) => { somar(t0, 0.012 * SR, t => ruido() * 0.5 * vol * Math.exp(-t / 0.003)); sino(t0, 1900, 0.04, 0.18 * vol, 0.01); },
  // moeda (+pontos): duas notas rápidas
  coin: ({ vol = 1 }) => (t0) => { sino(t0, 988, 0.08, 0.28 * vol, 0.05, [[1, 1], [3, 0.3]]); sino(t0 + 0.075, 1319, 0.5, 0.3 * vol, 0.16, [[1, 1], [3, 0.25]]); },
  // notificação de celular: duas notas limpas subindo
  notifica: ({ tono = 1, vol = 1 }) => (t0) => { sino(t0, 1175 * tono, 0.25, 0.26 * vol, 0.07, [[1, 1], [2, 0.15]]); sino(t0 + 0.1, 1760 * tono, 0.6, 0.28 * vol, 0.16, [[1, 1], [2, 0.12]]); },
  // apito de trem: dois tons juntos, com vibrato leve
  fischio: ({ vol = 1, dur = 0.9 }) => (t0) => {
    let f1 = 0, f2 = 0;
    somar(t0, dur * SR, t => { const v = 1 + 0.006 * Math.sin(t * 38), env = Math.min(1, t / 0.05) * Math.min(1, (dur - t) / 0.15);
      f1 += 2 * Math.PI * 740 * v / SR; f2 += 2 * Math.PI * 932 * v / SR; return (Math.sin(f1) + Math.sin(f2) + 0.3 * Math.sin(2 * f1)) * 0.13 * vol * env; });
  },
  // estrondo grave (a noite cai)
  boom: ({ vol = 1 }) => (t0) => {
    let fase = 0;
    somar(t0, 1.4 * SR, t => { const f = 38 + 30 * Math.exp(-t / 0.15); fase += 2 * Math.PI * f / SR; return Math.sin(fase) * 0.9 * vol * Math.min(1, t / 0.01) * Math.exp(-t / 0.45); });
    const bp = passaBanda();
    somar(t0, 0.6 * SR, t => bp(ruido(), 180, 1) * 0.5 * vol * Math.exp(-t / 0.2));
  },
  // vento que sobe e desce (Halloween)
  vento: ({ dur = 3, vol = 1 }) => (t0) => {
    const bp = passaBanda();
    somar(t0, dur * SR, t => { const s = t / dur; return bp(ruido(), 420 + 260 * Math.sin(t * 2.3) + 180 * Math.sin(t * 5.1), 3) * Math.sin(Math.PI * s) ** 1.5 * 0.55 * vol; });
  },
  // rufar de tambor que acelera e cresce (suspense)
  rullo: ({ dur = 3, vol = 1 }) => (t0) => {
    for (let t = 0, k = 0; t < dur; k++) {
      const s = t / dur, bp = passaBanda();
      somar(t0 + t, 0.05 * SR, x => bp(ruido(), 1800, 1.2) * (0.25 + 0.6 * s) * vol * Math.exp(-x / 0.018));
      t += 0.11 - 0.07 * s;
    }
  },
};
for (const e of efeitos) SINT[e.tipo](e)(e.t);

// --musica [bpm]: trilha pop sintetizada (Am–F–C–G): pad, arpejo, baixo e bateria leve; entra baixa e abaixa sob a voz
function musica(bpm) {
  const m = new Float32Array(buf.length), batida = 60 / bpm, compasso = batida * 4;
  const hz = n => 440 * Math.pow(2, (n - 69) / 12);
  const ACORDES = [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]];   // Am F C G
  const nota = (t0, f, dur, amp, tau, forma = 'sin') => {
    const i0 = Math.round(t0 * SR), n = Math.round(dur * SR); let fase = 0;
    for (let i = 0; i < n && i0 + i < m.length; i++) {
      const t = i / SR; fase += 2 * Math.PI * f / SR;
      const o = forma === 'tri' ? (2 / Math.PI) * Math.asin(Math.sin(fase)) : Math.sin(fase) + 0.25 * Math.sin(2 * fase);
      m[i0 + i] += o * amp * Math.min(1, t / 0.008) * Math.exp(-t / tau);
    }
  };
  const ruidoM = (t0, dur, amp, fc) => { const bp = passaBanda(), i0 = Math.round(t0 * SR); for (let i = 0; i < dur * SR && i0 + i < m.length; i++) m[i0 + i] += bp(ruido(), fc, 1.2) * amp * Math.exp(-i / SR / (dur / 3)); };
  for (let c = 0; c * compasso < durata; c++) {
    const t0 = c * compasso, ac = ACORDES[c % 4];
    for (const n of ac) nota(t0, hz(n), compasso, 0.05, compasso * 0.9, 'tri');                       // pad
    nota(t0, hz(ac[0] - 24), batida * 1.6, 0.22, 0.5); nota(t0 + batida * 2, hz(ac[0] - 24), batida * 1.6, 0.2, 0.5);   // baixo
    nota(t0 + batida * 1.5, hz(ac[0] - 12), batida * 0.4, 0.1, 0.12);
    for (let k = 0; k < 8; k++) nota(t0 + k * batida / 2, hz(ac[k % 3] + 12 + (k >= 6 ? 12 : 0)), batida / 2, 0.06, 0.09);   // arpejo
    for (let b = 0; b < 4; b++) {
      const tb = t0 + b * batida; let fase = 0, i0 = Math.round(tb * SR);
      for (let i = 0; i < 0.16 * SR && i0 + i < m.length; i++) { const t = i / SR; fase += 2 * Math.PI * (48 + 90 * Math.exp(-t / 0.03)) / SR; m[i0 + i] += Math.sin(fase) * 0.35 * Math.exp(-t / 0.07); }   // bumbo
      if (b % 2) ruidoM(tb, 0.14, 0.22, 1600);                                                          // palma
      ruidoM(tb + batida / 2, 0.04, 0.08, 7000);                                                        // chimbal
    }
  }
  const pico = m.reduce((a, v) => Math.max(a, Math.abs(v)), 0) || 1, fim = durata;
  for (let i = 0; i < m.length; i++) { const t = i / SR; m[i] = m[i] / pico * Math.min(1, t / 1.2) * Math.min(1, (fim - t) / 1.8); }
  return m;
}

const raw = (dados, ganho) => {
  const pcm = Buffer.alloc(dados.length * 2);
  dados.forEach((v, i) => pcm.writeInt16LE(Math.max(-32767, Math.min(32767, Math.round(v * ganho * 32767))), i * 2));
  const arq = path.join(os.tmpdir(), `suoni-${process.pid}-${Math.random().toString(36).slice(2)}.raw`);
  fs.writeFileSync(arq, pcm);
  return arq;
};
// pico dos efeitos em -9 dB; a narração fica por cima
const pico = buf.reduce((m, v) => Math.max(m, Math.abs(v)), 0) || 1;
const tmp = raw(buf, 0.35 * +opt('--volume', 1) / pico);
const iMus = args.indexOf('--musica'), bpm = iMus >= 0 ? (+args[iMus + 1] || 112) : 0;
const tmpM = bpm ? raw(musica(bpm), +opt('--vol-musica', 0.16)) : null;
const ent = ['-i', voz, '-f', 's16le', '-ar', String(SR), '-ac', '1', '-i', tmp, ...(tmpM ? ['-f', 's16le', '-ar', String(SR), '-ac', '1', '-i', tmpM] : [])];
// tudo em mono e só no fim duplicado nos 2 canais (o upmix automático do ffmpeg baixa 3 dB); a música abaixa quando a voz fala
const filtro = tmpM
  ? '[0:a]aresample=48000,aformat=channel_layouts=mono,apad,asplit=2[v][vc];[1:a]aresample=48000[s];[2:a]aresample=48000[m];[m][vc]sidechaincompress=threshold=0.03:ratio=5:attack=15:release=350:makeup=1[md];[v][s][md]amix=inputs=3:normalize=0:duration=longest,alimiter=limit=0.95:level=false,pan=stereo|c0=c0|c1=c0'
  : '[0:a]aresample=48000,aformat=channel_layouts=mono,apad[v];[1:a]aresample=48000[s];[v][s]amix=inputs=2:normalize=0:duration=longest,alimiter=limit=0.95:level=false,pan=stereo|c0=c0|c1=c0';
const r = spawnSync(FFMPEG, ['-y', '-loglevel', 'error', ...ent, '-filter_complex', filtro, '-t', durata.toFixed(3), '-ar', '48000', saida], { encoding: 'utf8' });
for (const f of [tmp, tmpM]) if (f) fs.rmSync(f, { force: true });
if (r.status !== 0) throw new Error(r.stderr);
console.log(`${efeitos.length} efeitos${bpm ? ` · música ${bpm} bpm` : ''} · ${durata.toFixed(2)} s → ${saida}`);
