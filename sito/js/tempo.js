// Datas no fuso de Roma (com horário de verão). Compartilhado entre o site e o motor.
import { REGOLE } from './regole.js';

const FMT = new Intl.DateTimeFormat('en-US', {
  timeZone: 'Europe/Rome', hourCycle: 'h23', weekday: 'short',
  year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
});
const DIAS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function partiRoma(ts) {
  const p = {};
  for (const x of FMT.formatToParts(new Date(ts))) p[x.type] = x.value;
  return { ano: +p.year, mes: +p.month, dia: +p.day, hora: +p.hour, min: +p.minute, seg: +p.second, sem: DIAS.indexOf(p.weekday) };
}
const offset = ts => { const p = partiRoma(ts); return Date.UTC(p.ano, p.mes - 1, p.dia, p.hora, p.min, p.seg) - Math.floor(ts / 1000) * 1000; };

// timestamp UTC de uma hora local de Roma (dia pode estourar o mês: Date.UTC normaliza)
export function daRoma(ano, mes, dia, hora = 0, min = 0) {
  const chute = Date.UTC(ano, mes - 1, dia, hora, min);
  let t = chute - offset(chute);
  const o2 = offset(t);
  if (chute - o2 !== t) t = chute - o2;
  return t;
}

// o fuso só muda em hora cheia: cache por hora UTC
const cacheDia = new Map();
export function giornoRoma(ts) {
  const h = Math.floor(ts / 3600e3);
  let d = cacheDia.get(h);
  if (!d) { const p = partiRoma(h * 3600e3); d = `${p.ano}-${String(p.mes).padStart(2, '0')}-${String(p.dia).padStart(2, '0')}`; cacheDia.set(h, d); }
  return d;
}

// início do mandato que contém ts: o último domingo 21:00 (Roma) <= ts
export function inizioMandato(ts) {
  const { giorno, ora } = REGOLE.mandato, p = partiRoma(ts);
  const recua = (p.sem - giorno + 7) % 7;
  let t = daRoma(p.ano, p.mes, p.dia - recua, ora);
  if (t > ts) t = daRoma(p.ano, p.mes, p.dia - recua - 7, ora);
  return t;
}
export const fineMandato = ts => inizioMandato(inizioMandato(ts) + 8 * 86400e3);

// limites dos mandatos desde o início do jogo: mandato k (1..) = [lim[k-1], lim[k])
export function limitiMandati(inizioGioco, ate) {
  const lim = [inizioMandato(inizioGioco)];
  while (lim[lim.length - 1] <= ate) lim.push(fineMandato(lim[lim.length - 1]));
  lim[0] = Math.min(lim[0], inizioGioco);
  return lim;
}
export function mandatoDi(lim, ts) {
  for (let k = 1; k < lim.length; k++) if (ts < lim[k]) return k;
  return lim.length - 1;
}
