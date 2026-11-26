// Natale sulla mappa (sito/data/natale.json): ver as compras, ajustar à mão e gerar os links de pagamento.
// A loja paga pela Hotmart com o link de "link" e o webhook (api/hotmart.php) JÁ ATIVA sozinho e manda e-mail; aqui é para ver e ajustar.
// Uso:
//   node strumenti/natale.mjs lista                       quem comprou o quê + dias do Avvento livres
//   node strumenti/natale.mjs link <id> [DD]               links de pagamento (Hotmart) para mandar à loja; DD = dia do Avvento (01–24)
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
const SITE = 'https://italiacasapercasa.com';
// o webhook da Hotmart ativa as compras direto no site: sempre parte da versão do site (a cópia do PC pode estar velha)
let nat;
try {
  const r = await fetch(`${SITE}/data/natale.json?t=${Date.now()}`, { cache: 'no-store' });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  nat = await r.json();
  fs.writeFileSync(ARQ, JSON.stringify(nat) + '\n');
} catch (e) {
  console.error(`ERRO: não baixei data/natale.json do site (${e.message}). Sem ele eu poderia apagar compras ativadas pelo webhook.`);
  process.exit(1);
}
nat.negozi ??= []; nat.avvento ??= {};
const commerci = JSON.parse(fs.readFileSync(path.join(RAIZ, 'config', 'commerci.json'), 'utf8'));
const nome = id => commerci.find(c => c.id === id)?.nome ?? `(id ${id} não está em commerci.json)`;
const [cmd, a, b] = process.argv.slice(2);
const exige = id => { if (!commerci.some(c => c.id === id)) { console.error(`ERRO: comércio ${id} não existe em config/commerci.json (aprove a loja antes)`); process.exit(1); } };
const DIAS = Array.from({ length: 24 }, (_, i) => `2026-12-${String(i + 1).padStart(2, '0')}`);
// links da Hotmart (locale/natale/links.json, fora do git): sck = id da loja (+ "-DD" no Avvento, é assim que o webhook sabe o dia)
const links = (id, dd) => {
  const L = JSON.parse(fs.readFileSync(path.join(RAIZ, 'locale', 'natale', 'links.json'), 'utf8'));
  let email = '';
  try { email = JSON.parse(fs.readFileSync(path.join(RAIZ, 'locale', 'natale', 'destinatari.json'), 'utf8')).find(d => d.id === id)?.email ?? ''; } catch { /* sem lista */ }
  const u = (base, sck) => `${base}&sck=${sck}${email ? `&email=${encodeURIComponent(email)}` : ''}`;
  const livre = DIAS.find(d => !nat.avvento[d] && d >= new Date().toISOString().slice(0, 10));
  const dia = dd ? `2026-12-${String(dd).padStart(2, '0')}` : livre;
  if (dd && !DIAS.includes(dia)) { console.error('ERRO: DD do Avvento é de 01 a 24'); process.exit(1); }
  const avv = !dia ? '(nenhum dia livre)' : nat.avvento[dia] && nat.avvento[dia] !== id ? `(${dia} já é de ${nome(nat.avvento[dia])})` : `${u(L.avvento, `${id}-${dia.slice(8)}`)}  ← dia ${dia.slice(8)}/12`;
  return [`🎄 Negozio di Natale 9,90 €:             ${u(L.negozio, id)}`, `🎄 Negozio di Natale (rinnovo) 7,90 €:   ${u(L.negozio_rinnovo, id)}`,
    `🎁 Avvento 19,90 €:                      ${avv}`, `⭐ Sponsor ufficiale 149 €:               ${nat.sponsor ? '(já vendido)' : u(L.sponsor, id)}`].join('\n') + (email ? '' : '\n(sem e-mail da loja em destinatari.json: o link vai sem &email=)');
};
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
else if (cmd === 'link') { muda = false; exige(a); console.log(`${nome(a)}\n${links(a, b)}`); }
else {
  muda = false;
  console.log(`⭐ Sponsor: ${nat.sponsor ? nome(nat.sponsor.id) : 'livre'}`);
  console.log(`🎄 Negozi di Natale (${nat.negozi.length}): ${nat.negozi.map(nome).join(' · ') || '—'}`);
  console.log(`🎁 Avvento: ${DIAS.map(d => `${d.slice(8)} ${nat.avvento[d] ? nome(nat.avvento[d]) : 'libero'}`).join('\n   ')}`);
  console.log('\nLinks de pagamento por loja: node strumenti/natale.mjs link <id> [DD]');
}
if (muda) {
  nat.avvento = Object.fromEntries(Object.entries(nat.avvento).sort());
  fs.writeFileSync(ARQ, JSON.stringify(nat) + '\n');
  const { conectar } = await import('./pubblica.mjs');
  const ftp = conectar(() => {});
  ftp.enviar([{ local: ARQ, remoto: `${ftp.web}data/natale.json` }]);
  console.log('natale.json enviado ao site (vale para quem abrir o site a partir de agora)');
}
