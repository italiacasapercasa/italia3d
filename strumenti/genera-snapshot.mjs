// Roda o motor de regras sobre um arquivo de eventos e grava sito/data/snapshot.json + versao.txt.
// Uso: node strumenti/genera-snapshot.mjs <eventi.json> [--demo]
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { calcolare } from './motore.mjs';
import { REGOLE, livelloDi } from '../sito/js/regole.js';

const RAIZ = path.resolve(import.meta.dirname, '..');
const DATA = path.join(RAIZ, 'sito', 'data');

export function gerarSnapshot(eventi, { agora = Date.now(), demo = false, follower = 0, pasta = DATA } = {}) {
  const { dados: comuni } = JSON.parse(fs.readFileSync(path.join(DATA, 'comuni.json'), 'utf8'));
  const geo = JSON.parse(fs.readFileSync(path.join(DATA, 'geo.json'), 'utf8'));
  const t0 = performance.now();
  const snap = calcolare({ eventi, comuni, regioni: geo.regioni, agora, demo, follower, versao: 'tmp' });
  // versão = hash do conteúdo (o site recarrega sozinho quando muda)
  const hash = createHash('sha1').update(JSON.stringify({ ...snap, gerado_em: 0 })).digest('hex').slice(0, 10);
  snap.versao = `${demo ? 'demo' : 'snap'}-${hash}`;
  fs.mkdirSync(pasta, { recursive: true });
  fs.writeFileSync(path.join(pasta, 'snapshot.json'), JSON.stringify(snap));
  fs.writeFileSync(path.join(pasta, 'versao.txt'), snap.versao);

  const niveis = new Array(REGOLE.livelli.length).fill(0);
  for (const c of snap.case) niveis[livelloDi(c[4])]++;
  const ct = snap.contatori;
  console.log(`${snap.versao} · ${(performance.now() - t0).toFixed(0)} ms · ${(fs.statSync(path.join(pasta, 'snapshot.json')).size / 1e6).toFixed(2)} MB`);
  console.log(`mandato ${snap.mandato.n} · ${ct.case} casas em ${ct.luoghi} comuni · ${ct.commenti} comentários (${ct.commenti_validi} válidos, ${ct.commenti_pendenti} pendentes, ${ct.commenti_rifiutati} rejeitados) · ${ct.storie} stories`);
  console.log(`níveis: ${niveis.join(' ')} · top ${snap.case.length ? Math.max(...snap.case.map(c => c[4])) : 0} pts · presidente ${snap.cariche.presidente?.conta ?? '—'} · líder ${snap.cariche.leader ? `${snap.cariche.leader.conta} (${snap.cariche.leader.pts})` : '—'}`);
  console.log(`derby: ${snap.derby ? `${snap.derby.a} ${snap.derby.pts_a} × ${snap.derby.pts_b} ${snap.derby.b}` : '—'} · eventos: ${snap.eventi.slice(0, 4).map(e => e.tipo).join(', ')}`);
  return snap;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const arq = process.argv[2];
  if (!arq) { console.error('uso: node strumenti/genera-snapshot.mjs <eventi.json> [--demo]'); process.exit(1); }
  gerarSnapshot(JSON.parse(fs.readFileSync(arq, 'utf8')), { demo: process.argv.includes('--demo') });
}
