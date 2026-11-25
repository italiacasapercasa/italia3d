// Patrocínios de Natal (sito/data/natale.json): liga as compras e publica o arquivo no site.
// Uso:
//   node strumenti/natale.mjs lista                       quem comprou o quê + dias do Avvento livres
//   node strumenti/natale.mjs negozio <id>                 "Negozio di Natale" (loja decorada + Mercatino na Vetrina)
//   node strumenti/natale.mjs avvento <AAAA-MM-DD> <id>    um dia do Avvento (faixa no mapa + baú ×bonus)
//   node strumenti/natale.mjs sponsor <id>                 Sponsor ufficiale (faixa de Natal em todo o mapa)
//   node strumenti/natale.mjs togli <id>                   tira a loja de tudo (ex.: reembolso)
// <id> = id do comércio em config/commerci.json (o mesmo do pedido). Quem compra Avvento ou Sponsor já ganha a decoração.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ARQ = path.join(RAIZ, 'sito', 'data', 'natale.json');
const nat = JSON.parse(fs.readFileSync(ARQ, 'utf8'));
const commerci = JSON.parse(fs.readFileSync(path.join(RAIZ, 'config', 'commerci.json'), 'utf8'));
const nome = id => commerci.find(c => c.id === id)?.nome ?? `(id ${id} não está em commerci.json)`;
const [cmd, a, b] = process.argv.slice(2);
const exige = id => { if (!commerci.some(c => c.id === id)) { console.error(`ERRO: comércio ${id} não existe em config/commerci.json (aprove a loja antes)`); process.exit(1); } };
const DIAS = Array.from({ length: 24 }, (_, i) => `2026-12-${String(i + 1).padStart(2, '0')}`);
let muda = true;
if (cmd === 'negozio') { exige(a); if (!nat.negozi.includes(a)) nat.negozi.push(a); console.log(`ok: 🎄 Negozio di Natale → ${nome(a)}`); }
else if (cmd === 'avvento') {
  if (!DIAS.includes(a)) { console.error('ERRO: dia do Avvento é de 2026-12-01 a 2026-12-24'); process.exit(1); }
  exige(b);
  if (nat.avvento[a] && nat.avvento[a] !== b) { console.error(`ERRO: ${a} já é de ${nome(nat.avvento[a])}`); process.exit(1); }
  nat.avvento[a] = b; console.log(`ok: 🎁 Avvento ${a} → ${nome(b)}`);
}
else if (cmd === 'sponsor') {
  exige(a);
  if (nat.sponsor && nat.sponsor.id !== a) { console.error(`ERRO: o sponsor já é ${nome(nat.sponsor.id)} (só 1)`); process.exit(1); }
  nat.sponsor = { id: a }; console.log(`ok: ⭐ Sponsor ufficiale → ${nome(a)}`);
}
else if (cmd === 'togli') {
  nat.negozi = nat.negozi.filter(x => x !== a);
  for (const [d, id] of Object.entries(nat.avvento)) if (id === a) delete nat.avvento[d];
  if (nat.sponsor?.id === a) nat.sponsor = null;
  console.log(`ok: ${nome(a)} tirado do Natal`);
}
else {
  muda = false;
  console.log(`⭐ Sponsor: ${nat.sponsor ? nome(nat.sponsor.id) : 'livre'}`);
  console.log(`🎄 Negozi di Natale (${nat.negozi.length}): ${nat.negozi.map(nome).join(' · ') || '—'}`);
  console.log(`🎁 Avvento: ${DIAS.map(d => `${d.slice(8)} ${nat.avvento[d] ? nome(nat.avvento[d]) : 'libero'}`).join('\n   ')}`);
}
if (muda) {
  nat.avvento = Object.fromEntries(Object.entries(nat.avvento).sort());
  fs.writeFileSync(ARQ, JSON.stringify(nat) + '\n');
  const { conectar } = await import('./pubblica.mjs');
  const ftp = conectar(() => {});
  ftp.enviar([{ local: ARQ, remoto: `${ftp.web}data/natale.json` }]);
  console.log('natale.json enviado ao site (vale para quem abrir o site a partir de agora)');
}
