// Traguardi della città: a cada meta de casas a cidade ganha um prédio (REGOLE.traguardi).
// Data e herói saem das próprias casas: a meta de N casas foi batida pela N-ésima casa a chegar.
import { REGOLE } from './regole.js';

export const TRAGUARDI = REGOLE.traguardi.map(([id, casas, emoji, nome, art]) => ({ id, casas, emoji, nome, art }));
export const sogliaDi = id => TRAGUARDI.find(t => t.id === id).casas;

// quadras "palazzina" (a cada 9 do centro para fora): as primeiras viram estes prédios; depois, palazzine a 600, 700...
const SLOT = ['palazzina', 'scuola', 'stazione', 'campo'];
export const slotDi = k => (k < SLOT.length ? [SLOT[k], sogliaDi(SLOT[k])] : ['palazzina', sogliaDi('ospedale') + (k - SLOT.length + 1) * REGOLE.palazzinaOgni]);

// metas já batidas por uma cidade, em ordem: [{ t, ts, eroe }]
const feitos = new WeakMap();
export function raggiunti(D, l) {
  if (feitos.has(l)) return feitos.get(l);
  const fatti = TRAGUARDI.filter(t => l.case >= t.casas);
  let out = [];
  if (fatti.length) {
    const ord = l.casas.map(i => D.casas[i]).sort((a, b) => a.ts - b.ts || a.lote - b.lote);
    out = fatti.map(t => { const c = ord[Math.min(ord.length, t.casas) - 1]; return { t, l, ts: c?.ts ?? 0, eroe: c?.conta ?? null }; });
  }
  feitos.set(l, out);
  return out;
}

// próxima meta da cidade (depois do ospedale também entram as palazzine a cada 100)
export function prossimo(l) {
  const t = TRAGUARDI.find(x => l.case < x.casas);
  const pal = l.case >= sogliaDi('ospedale') ? { id: 'palazzina', emoji: '🏢', nome: 'Palazzina', art: 'una nuova palazzina', casas: Math.max(sogliaDi('ospedale') + REGOLE.palazzinaOgni, (Math.floor(l.case / 100) + 1) * 100) } : null;
  return [t, pal].filter(Boolean).sort((a, b) => a.casas - b.casas)[0] ?? null;
}

// todas as inaugurações do mapa, a mais recente primeiro (calculado uma vez por snapshot)
const todas = new WeakMap();
export function inaugurazioni(D) {
  if (todas.has(D)) return todas.get(D);
  const lista = D.luoghi.filter(l => l.case >= TRAGUARDI[0].casas).flatMap(l => raggiunti(D, l)).sort((a, b) => b.ts - a.ts);
  const porEroe = new Map();
  for (const x of lista) if (x.eroe) (porEroe.get(x.eroe) ?? porEroe.set(x.eroe, []).get(x.eroe)).push(x);
  const r = { lista, porEroe };
  todas.set(D, r);
  return r;
}
