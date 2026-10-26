// Ajusta o roteiro do reel ao áudio da narração: acha as pausas entre as frases (ffmpeg silencedetect),
// distribui as palavras de cada frase pelas sílabas e recalcula legendas e eventos (campo "sincro" do roteiro).
// Uso: node strumenti/sincronizza.mjs <roteiro.json> <audio.mp3> <saida.json> [--ruido -38]
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const RAIZ = path.resolve(import.meta.dirname, '..');
const FFMPEG = path.join(RAIZ, '.tools', 'ffmpeg', 'bin', 'ffmpeg.exe');
const [entrada, audio, saida] = process.argv.slice(2);
const iRuido = process.argv.indexOf('--ruido'), ruido = iRuido > 0 ? process.argv[iRuido + 1] : '-38';
const R = JSON.parse(fs.readFileSync(entrada, 'utf8'));

// duração e silêncios
const r = spawnSync(FFMPEG, ['-hide_banner', '-i', audio, '-af', `silencedetect=noise=${ruido}dB:d=0.08`, '-f', 'null', '-'], { encoding: 'utf8' });
const log = r.stderr;
const durAudio = (() => { const m = log.match(/time=(\d+):(\d+):([\d.]+)/g)?.pop()?.match(/(\d+):(\d+):([\d.]+)/); return m ? +m[1] * 3600 + +m[2] * 60 + +m[3] : 0; })();
const silencios = [];
for (const m of log.matchAll(/silence_start: ([\d.]+)[\s\S]*?silence_end: ([\d.]+)/g)) {
  const a = +m[1], b = +m[2], u = silencios.at(-1);
  if (u && a - u[1] < 0.06) u[1] = b;   // estalo curto no meio de uma pausa: é a mesma pausa
  else silencios.push([a, b]);
}
const nFrasi = R.parlato.length;
const silabas = w => Math.max(1, (w.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').match(/[aeiouy]+/g) ?? []).length);
const silFrase = R.parlato.map(f => f.replace(/[.,!?]/g, '').split(/\s+/).filter(Boolean).reduce((n, w) => n + silabas(w) + 0.35, 0));
const inicioFala = silencios.find(([a]) => a <= 0.05)?.[1] ?? 0.03;
const fimFala = silencios.find(([a, b]) => b >= durAudio - 0.1)?.[0] ?? durAudio;
const cand = silencios.filter(([a, b]) => a > inicioFala + 0.1 && b < fimFala - 0.05);
if (cand.length < nFrasi - 1) throw new Error(`achei ${cand.length} pausas, preciso de ${nFrasi - 1} (uma entre cada frase)`);
// pausas entre as frases: escolha que junta pausas longas e trechos com duração proporcional às sílabas da frase
// (programação dinâmica; só "as maiores pausas" erra quando há uma vírgula longa e um fim de frase curto)
const pausaTot = [...cand].map(([a, b]) => b - a).sort((x, y) => y - x).slice(0, nFrasi - 1).reduce((s, d) => s + d, 0);
const ritmo = (fimFala - inicioFala - pausaTot) / silFrase.reduce((s, n) => s + n, 0);
const custoTrecho = (i, a, b) => Math.log(Math.max(0.05, b - a) / (silFrase[i] * ritmo)) ** 2;
const C = cand.length, dp = Array.from({ length: nFrasi - 1 }, () => new Float64Array(C).fill(Infinity)), de = dp.map(() => new Int32Array(C).fill(-1));
for (let k = 0; k < C; k++) dp[0][k] = custoTrecho(0, inicioFala, cand[k][0]) - 2 * (cand[k][1] - cand[k][0]);
for (let i = 1; i < nFrasi - 1; i++) for (let k = i; k < C; k++) for (let j = i - 1; j < k; j++) {
  if (dp[i - 1][j] === Infinity) continue;
  const v = dp[i - 1][j] + custoTrecho(i, cand[j][1], cand[k][0]) - 2 * (cand[k][1] - cand[k][0]);
  if (v < dp[i][k]) { dp[i][k] = v; de[i][k] = j; }
}
let fim = -1, melhor = Infinity;
for (let k = 0; k < C && nFrasi > 1; k++) { const v = dp[nFrasi - 2][k] + custoTrecho(nFrasi - 1, cand[k][1], fimFala); if (v < melhor) { melhor = v; fim = k; } }
const internos = [];
for (let i = nFrasi - 2, k = fim; i >= 0; k = de[i][k], i--) internos.unshift(cand[k]);
const trechos = [];
for (let i = 0; i < nFrasi; i++) trechos.push([i === 0 ? inicioFala : internos[i - 1][1], i === nFrasi - 1 ? fimFala : internos[i][0]]);

// palavras de cada frase: tempo proporcional às sílabas (grupos de vogais)
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
