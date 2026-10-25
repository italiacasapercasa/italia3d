// Simula a atividade do Instagram (posts, comentários, marcações, votos, stories) com dados FICTÍCIOS
// e passa tudo pelo motor de regras: dati-grezzi/eventi-demo.json -> sito/data/snapshot.json.
// Uso: node strumenti/demo-dati.mjs [semente]
import fs from 'node:fs';
import path from 'node:path';
import { gerarSnapshot } from './genera-snapshot.mjs';
import { daRoma, partiRoma } from '../sito/js/tempo.js';

const RAIZ = path.resolve(import.meta.dirname, '..');
const DATA = path.join(RAIZ, 'sito', 'data');
const { dados: comuni } = JSON.parse(fs.readFileSync(path.join(DATA, 'comuni.json'), 'utf8'));

// ---------- aleatório com semente ----------
let semente = +(process.argv[2] ?? 2026);
const rnd = () => { semente |= 0; semente = semente + 0x6D2B79F5 | 0; let t = Math.imul(semente ^ semente >>> 15, 1 | semente); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
const gauss = () => Math.sqrt(-2 * Math.log(rnd() || 1e-9)) * Math.cos(2 * Math.PI * rnd());
const poisson = l => { let k = 0, p = 1; const e = Math.exp(-Math.min(l, 30)); do { k++; p *= rnd(); } while (p > e); return k - 1; };
const escolher = a => a[Math.floor(rnd() * a.length)];
const expo = media => -Math.log(1 - rnd()) * media;

// ---------- tempo ----------
const INICIO = Date.parse('2026-10-15T12:00:00Z');   // jogo começou numa quinta, 14h em Roma
const AGORA = Date.parse('2026-10-24T10:30:00Z');
const H = 3600e3;

// ---------- nomes de conta ----------
const NOMI = 'giulia marco luca chiara sofia matteo ale fra giorgia lorenzo martina andrea davide sara simone elena fede vale gabri ste nico anna paolo laura dario irene enzo rosa tony carmen vito pino salvo ciro gennaro mario bea noemi aurora leo tommy edo mattia greta alice ginevra pietro riccardo emma rebecca diego manu cate peppe totti'.split(' ');
const COGNOMI = 'rossi russo ferrari esposito bianchi romano colombo ricci marino greco bruno gallo conti deluca mancini costa giordano rizzo lombardi moretti barbieri fontana santoro mariani rinaldi caruso ferrara galli martini leone longo gentile martinelli vitale serra coppola desantis'.split(' ');
const PAROLE = 'pizza calcio mare sole amore forza vibes daje boh official real the_ og 3d napoli roma milano sud nord bella dolce vita'.split(' ');
const usados = new Set();
function nomeConta() {
  for (;;) {
    const n = escolher(NOMI), c = escolher(COGNOMI), num = Math.floor(rnd() * 100), anno = 90 + Math.floor(rnd() * 19);
    const s = [
      `${n}_${c}`, `${n}.${c}`, `${n}${c}${num}`, `${n}_${anno % 100}`, `${n}.${escolher(PAROLE)}`, `its${n}`, `${n}__${c[0]}`,
      `${escolher(PAROLE)}_${n}`, `${n}${c[0]}${c[1]}_`, `x${n}x`, `${n}_${c}_${num}`, `il.${n}`, `la_${n}${num}`,
    ][Math.floor(rnd() * 13)].replace(/[^a-z0-9._]/g, '').slice(0, 30);
    if (!usados.has(s)) { usados.add(s); return s; }
  }
}

// ---------- posts: a cada ~8 h ----------
const posts = [];
for (let t = INICIO, i = 1; t < AGORA; t += 8 * H + (rnd() - 0.5) * 3 * H, i++) posts.push({ id: `p${i}`, ts: Math.round(t) });
const postEm = ts => { let p = posts[0]; for (const x of posts) if (x.ts <= ts) p = x; return p; };

// ---------- contas: cidade sorteada por população ----------
const pesoCom = comuni.map(c => Math.pow(Math.max(c[6], 50), 1.12) * Math.exp(0.35 * gauss()));
const acum = []; let s = 0;
for (const p of pesoCom) acum.push(s += p);
const sortearComune = () => { const r = rnd() * s; let a = 0, b = acum.length - 1; while (a < b) { const m = (a + b) >> 1; if (acum[m] < r) a = m + 1; else b = m; } return comuni[a][0]; };

const N = 27000;
const contas = Array.from({ length: N }, () => ({
  conta: nomeConta(), entra: INICIO + Math.pow(rnd(), 1.7) * (AGORA - INICIO - H), luogo: sortearComune(), atv: Math.exp(1.05 * gauss()),
})).sort((a, b) => a.entra - b.entra);
const candidatos = [...contas].sort((a, b) => b.atv - a.atv).slice(0, 800);
const futuraApos = ts => { let a = 0, b = N; while (a < b) { const m = (a + b) >> 1; if (contas[m].entra <= ts) a = m + 1; else b = m; } return a < N ? contas[a + Math.floor(rnd() * Math.min(400, N - a))] : null; };
const jaEntrou = ts => { let a = 0, b = N; while (a < b) { const m = (a + b) >> 1; if (contas[m].entra <= ts) a = m + 1; else b = m; } return a > 0 ? contas[Math.floor(rnd() * a)] : null; };

// ---------- comentários ----------
const commenti = [], storie = [];
function comentar(c, post, ts, primeiro) {
  const tags = [];
  for (let k = Math.min(12, poisson(0.35 * c.atv)); k > 0; k--) {
    const alvo = rnd() < 0.25 ? futuraApos(ts) : jaEntrou(ts);
    if (alvo && alvo !== c) tags.push(alvo.conta);
  }
  const voto = rnd() < Math.min(0.4, 0.03 * c.atv) ? escolher(candidatos).conta : null;
  commenti.push({ post: post.id, conta: c.conta, ts: Math.round(ts), luogo: primeiro ? c.luogo : null, tags, voto, stato: 'valido' });
}
for (const c of contas) {
  // primeiro comentário (8% esquece a cidade e só completa depois)
  const p0 = postEm(c.entra);
  const esquece = rnd() < 0.08;
  commenti.push({ post: p0.id, conta: c.conta, ts: Math.round(c.entra), luogo: esquece ? null : c.luogo, tags: [], voto: null, stato: 'valido' });
  if (esquece) { const t = c.entra + expo(6 * H); if (t < AGORA) comentar(c, postEm(t), t, true); }
  else comentar(c, p0, c.entra + 20e3, false);
  for (const p of posts) {
    if (p.ts <= c.entra || rnd() > Math.min(0.8, 0.075 * c.atv)) continue;
    const t = p.ts + expo(2 * H);
    if (t >= AGORA) continue;
    comentar(c, p, t, false);
    for (let k = poisson(0.25 * c.atv); k > 0; k--) commenti.push({ post: p.id, conta: c.conta, ts: Math.round(t + expo(H)), luogo: null, tags: [], voto: null, stato: 'valido' });
  }
  // stories: por dia, depois de entrar
  for (let d = c.entra; d < AGORA; d += 24 * H) {
    if (rnd() < Math.min(0.2, 0.004 * c.atv)) { const t = d + rnd() * 24 * H; if (t < AGORA) storie.push({ conta: c.conta, ts: Math.round(t) }); }
  }
}
// spam e comentários sem cidade reconhecível
for (let k = 0; k < N * 0.8; k++) { const t = INICIO + rnd() * (AGORA - INICIO); commenti.push({ post: postEm(t).id, conta: `bot_${k}`, ts: Math.round(t), luogo: null, tags: [], voto: null, stato: 'rifiutato' }); }
for (let k = 0; k < N * 0.25; k++) { const t = AGORA - rnd() * 6 * H; commenti.push({ post: postEm(t).id, conta: nomeConta(), ts: Math.round(t), luogo: null, tags: [], voto: null, stato: 'pendente' }); }

// pontos em dobro nas stories: domingo passado e hoje até as 21h (Roma)
const hoje = partiRoma(AGORA);
const doppi = [
  { da: daRoma(2026, 10, 18, 10), a: daRoma(2026, 10, 18, 21), tipi: ['storia'] },
  { da: daRoma(hoje.ano, hoje.mes, hoje.dia, 8), a: daRoma(hoje.ano, hoje.mes, hoje.dia, 21), tipi: ['storia'] },
];

const eventi = { inizio: INICIO, posts, commenti, storie, bloccati: [contas[500].conta, contas[9000].conta], doppi };
fs.mkdirSync(path.join(RAIZ, 'dati-grezzi'), { recursive: true });
fs.writeFileSync(path.join(RAIZ, 'dati-grezzi', 'eventi-demo.json'), JSON.stringify(eventi));
console.log(`${posts.length} posts · ${commenti.length} comentários · ${storie.length} stories`);
gerarSnapshot(eventi, { agora: AGORA, demo: true, follower: 11870 });
