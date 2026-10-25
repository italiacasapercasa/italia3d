// Ajusta o roteiro do reel ao áudio da narração: acha as pausas entre as frases (ffmpeg silencedetect),
// distribui as palavras de cada frase pelas sílabas e recalcula legendas e eventos (campo "sincro" do roteiro).
// Uso: node strumenti/sincronizza.mjs <roteiro.json> <audio.mp3> <saida.json>
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const RAIZ = path.resolve(import.meta.dirname, '..');
const FFMPEG = path.join(RAIZ, '.tools', 'ffmpeg', 'bin', 'ffmpeg.exe');
const [entrada, audio, saida] = process.argv.slice(2);
const R = JSON.parse(fs.readFileSync(entrada, 'utf8'));

// duração e silêncios
const r = spawnSync(FFMPEG, ['-hide_banner', '-i', audio, '-af', 'silencedetect=noise=-38dB:d=0.12', '-f', 'null', '-'], { encoding: 'utf8' });
const log = r.stderr;
const durAudio = (() => { const m = log.match(/time=(\d+):(\d+):([\d.]+)/g)?.pop()?.match(/(\d+):(\d+):([\d.]+)/); return m ? +m[1] * 3600 + +m[2] * 60 + +m[3] : 0; })();
const silencios = [];
for (const m of log.matchAll(/silence_start: ([\d.]+)[\s\S]*?silence_end: ([\d.]+)/g)) silencios.push([+m[1], +m[2]]);
const nFrasi = R.parlato.length;
// trechos de fala = entre os (nFrasi-1) maiores silêncios internos
const internos = silencios.filter(([a, b]) => a > 0.15 && b < durAudio - 0.1).sort((x, y) => (y[1] - y[0]) - (x[1] - x[0])).slice(0, nFrasi - 1).sort((x, y) => x[0] - y[0]);
if (internos.length < nFrasi - 1) throw new Error(`achei ${internos.length} pausas, preciso de ${nFrasi - 1} (uma entre cada frase)`);
const inicioFala = silencios.find(([a]) => a <= 0.05)?.[1] ?? 0.03;
const fimFala = silencios.find(([a, b]) => b >= durAudio - 0.1 && a > internos[internos.length - 1][1])?.[0] ?? durAudio;
const trechos = [];
for (let i = 0; i < nFrasi; i++) trechos.push([i === 0 ? inicioFala : internos[i - 1][1], i === nFrasi - 1 ? fimFala : internos[i][0]]);

// palavras de cada frase: tempo proporcional às sílabas (grupos de vogais)
const silabas = w => Math.max(1, (w.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').match(/[aeiouy]+/g) ?? []).length);
const tempos = R.parlato.map((frase, i) => {
  const palavras = frase.replace(/[.,!?]/g, '').split(/\s+/).filter(Boolean);
  const pesos = palavras.map(w => silabas(w) + 0.35), total = pesos.reduce((a, b) => a + b, 0);
  const [a, b] = trechos[i];
  let acc = 0;
  return palavras.map((w, j) => { const t = a + (b - a) * acc / total; acc += pesos[j]; return +t.toFixed(3); });
});

// legendas: cada palavra da legenda segue, em ordem, a palavra falada da mesma frase
const usados = R.parlato.map(() => 0);
R.frasi.forEach((f, k) => {
  const s = R.frasi_parlato[k];
  for (const linha of f.linee) for (const w of linha) {
    const t = tempos[s][usados[s]++];
    if (t === undefined) throw new Error(`a frase ${s + 1} tem menos palavras faladas que na legenda`);
    w[1] = t;
  }
  f.ini = f.linee[0][0][1];
});
R.durata = +Math.max(durAudio + 0.5, (tempos[nFrasi - 1].at(-1) ?? 0) + 1.5).toFixed(2);
R.frasi.forEach((f, k) => { f.fim = k < R.frasi.length - 1 ? +(R.frasi[k + 1].ini - 0.03).toFixed(3) : +(R.durata - 0.3).toFixed(3); });

// eventos presos a palavras: "caminho": [frase, palavra, deslocamento]
for (const [caminho, [s, w, d]] of Object.entries(R.sincro ?? {})) {
  const partes = caminho.split('.');
  let o = R;
  for (const p of partes.slice(0, -1)) o = o[p];
  o[partes.at(-1)] = +(tempos[s][w] + d).toFixed(3);
}
R.audio = { arquivo: path.basename(audio), durata: +durAudio.toFixed(3) };
fs.writeFileSync(saida, JSON.stringify(R, null, 1));
console.log(`áudio ${durAudio.toFixed(2)} s · vídeo ${R.durata} s · frases: ${trechos.map(([a, b]) => `${a.toFixed(2)}–${b.toFixed(2)}`).join(' | ')}`);
console.log(`eventos: ${Object.entries(R.eventi).map(([k, v]) => `${k} ${v}`).join(' · ')}`);
