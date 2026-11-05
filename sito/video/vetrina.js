// Reel 24 "vetrina" (04/11): venda de lojas. 7.000 pessoas na segunda → 27 mil casas e só 22 negócios (alfinetes reais),
// a loja Gabhub em Roma (toque, cartão, WhatsApp), vagas limitadas (6 num paese), preço "meno di un caffè", IVA 0 com
// Partita IVA, reembolso, 3 passos em 2 minutos e "mandagli questo video". O fim volta à primeira cena (loop).
// window.preparar/quadro/suoni; tudo depende só de t.
import * as THREE from 'three';
import { carregar } from '../js/dati.js';
import { Mappa } from '../js/mappa.js';
import { Citta, LOTE, posLote } from '../js/citta.js';

const $ = s => document.querySelector(s);
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const suave = s => (s < 0.5 ? 4 * s * s * s : 1 - Math.pow(-2 * s + 2, 3) / 2);
const ressalto = s => { const c = 1.9; return s <= 0 ? 0 : s >= 1 ? 1 : 1 + (c + 1) * Math.pow(s - 1, 3) + c * Math.pow(s - 1, 2); };
const fase = (t, ini, dur) => clamp((t - ini) / dur);
const esc = s => String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
const num = n => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
const conta = (t, ini, dur, v, de = 0) => de + (v - de) * (1 - Math.pow(1 - fase(t, ini, dur), 3));
const batida = (t, ti) => (t >= ti && t < ti + 0.35 ? 1 + 0.25 * Math.sin(Math.PI * (t - ti) / 0.35) : 1);

let D, mappa, citta, R, E, chaves, etichette = [], stampi = [], loja, borgo, pins = [];
const TIPI = { servizi: '🛠️ Servizi', ristorante: '🍝 Ristorante', bar: '☕ Bar', abbigliamento: '👕 Abbigliamento', altro: '🏪 Negozio' };

async function iniciar() {
  D = await carregar('video');
  mappa = new Mappa($('#mappa'), D.geo, D.rilievo, D.imagem, { gravacao: true });
  window.preparar = preparar;
  window.quadro = quadro;
  window.suoni = suoni;
}
const lojaDe = nome => { const c = D.commerci.find(x => x.nome === nome); if (!c) throw new Error(`${nome} não está no mapa`); return { c, p: citta.posCommercio(c), az: posLote(c.lote).rot === 0 ? 0 : Math.PI }; };

// cortes secos: início de cada cena
const TAGLI = () => [E.p2, E.p4, E.p9, E.p12, E.p15, E.p16, E.p18].map(x => x - 0.1);

// ---------- câmera ----------
function montarChaves() {
  const b = D.geo.bbox, alt = b.z1 - b.z0, dP = mappa.distPais();
  const paese = (dist, az, giu = 0.12) => ({ x: (b.x0 + b.x1) / 2, z: (b.z0 + b.z1) / 2 - alt * 0.07, dist: dP * dist, az, giu });
  const P = (o, dist, az, giu = 0.06) => ({ x: o.p.x, z: o.p.z, dist, az, giu });
  const [T1, T2, T3, T4, T5, T6, T7] = TAGLI(), az = loja.az, bz = borgo.az;
  const cena = (ini, fim, a, c) => [[ini, a], [fim - 0.01, c]];
  const ABRE = paese(1.05, -0.12);
  const lista = [
    ...cena(0, T1, ABRE, paese(0.92, 0.06)),
    ...cena(T1, T2, paese(0.98, 0.15, 0.1), paese(1.06, -0.04, 0.1)),
    // Gabhub: chega de longe; no toque a loja fica embaixo do cartão
    [T2, P(loja, 2.4, az - 0.6, 0.1)], [E.tocchi - 0.15, P(loja, 0.55, az - 0.15)],
    [E.tocchi + 0.25, P(loja, 0.5, az + 0.05, -0.14)], [T3 - 0.01, P(loja, 0.44, az + 0.5, -0.14)],
    ...cena(T3, T4, P(borgo, 1.4, bz + 0.5, 0.1), P(borgo, 1.0, bz + 1.1, 0.1)),
    ...cena(T4, T5, P(loja, 1.4, az + 0.9, 0.12), P(loja, 1.1, az + 1.4, 0.12)),
    ...cena(T5, T6, paese(0.85, 0.2, 0.15), paese(0.78, 0.05, 0.15)),
    ...cena(T6, T7, P(loja, 1.6, az - 1.0, 0.2), P(loja, 1.25, az - 0.5, 0.2)),
    [T7, paese(0.9, 0.2)],
    [R.durata - 0.01, ABRE],
  ];
  chaves = lista.sort((x, y) => x[0] - y[0]).map(([t, k]) => ({ t, k }));
}
function camera(t) {
  let i = 0;
  while (i < chaves.length - 2 && t >= chaves[i + 1].t) i++;
  const a = chaves[i], b = chaves[Math.min(i + 1, chaves.length - 1)];
  const s = b.t > a.t ? suave(clamp((t - a.t) / (b.t - a.t))) : 1;
  const A = a.k, B = b.k, l = (p, q) => p + (q - p) * s;
  const dist = Math.exp(l(Math.log(A.dist), Math.log(B.dist)));
  const imp = [E.persone, E.ventidue, E.tocchi, E.sei, E.prima, E.nove, E.azzera, E.rimborsiamo, E.manda];
  const tremor = imp.reduce((v, ti) => v + (t >= ti && t < ti + 0.35 ? 0.013 * (1 - (t - ti) / 0.35) * Math.sin((t - ti) * 70) : 0), 0);
  const soco = [E.ventidue, E.rimborsiamo].reduce((v, ti) => v + (t >= ti && t < ti + 0.5 ? 0.08 * Math.sin(Math.PI * (t - ti) / 0.5) : 0), 0);
  const az = l(A.az, B.az) + tremor, giu = l(A.giu, B.giu), x = l(A.x, B.x), z = l(A.z, B.z);
  mappa.az = az; mappa.dist = dist * (1 + tremor - soco);
  mappa.alvo.x = x - Math.sin(az) * giu * dist;
  mappa.alvo.z = z - Math.cos(az) * giu * dist;
  mappa.atualizarCamera();
}

// ---------- textos ----------
function projetar(x, y, z) { const p = new THREE.Vector3(x, y, z).project(mappa.camera); return { x: (p.x + 1) / 2 * 1080, y: (1 - p.y) / 2 * 1920, ok: p.z < 1 && p.z > -1 }; }
function novaEtichetta(html) { const el = document.createElement('div'); el.className = 'cartello'; el.innerHTML = html; $('#etichette').appendChild(el); return el; }
function legenda(t) {
  const f = R.frasi.find(x => t >= x.ini && t < x.fim);
  const html = f && !R.copertina ? f.linee.map(l => l.filter(w => t >= w[1] && w[0]).map(w => w[2] ? `<span class="g">${esc(w[0])}</span>` : esc(w[0])).join(' ')).filter(Boolean).join('<br>') : '';
  const el = $('#sott'); if (el.innerHTML !== html) el.innerHTML = html;
}
function mostrar(el, t, ini, fim, sobe = 30, base = '') {
  const ent = ressalto(fase(t, ini, 0.32)), sai = fase(t, fim - 0.2, 0.2), vis = t >= ini && t < fim;
  el.style.opacity = vis ? String(1 - sai) : '0';
  if (vis) el.style.transform = `${base} translateY(${(1 - Math.min(1, ent)) * sobe - sai * 40}px) scale(${0.85 + 0.15 * ent})`;
}
function pulo(el, t, ini, base = '') {
  const k = ressalto(fase(t, ini, 0.3));
  el.style.opacity = t >= ini ? '1' : '0';
  el.style.transform = `${base} translateY(${(1 - Math.min(1, k)) * 40}px) scale(${0.4 + 0.6 * k})`;
}
function carimbo(el, t, ini, fim, rot = -4) {
  const k = ressalto(fase(t, ini, 0.3)), vis = t >= ini && t < fim;
  el.style.opacity = vis ? String(1 - fase(t, fim - 0.2, 0.2)) : '0';
  if (vis) el.style.transform = `scale(${t < ini + 0.1 ? 1.6 - 0.6 * k : 1 + 0.035 * Math.sin((t - ini) * 10)}) rotate(${rot}deg)`;
}
function tocco(t, ini, alvo) {
  const tc = $('#tocco'), k = fase(t, ini, 0.45);
  if (k <= 0 || k >= 1) return false;
  tc.style.left = `${alvo.x}px`; tc.style.top = `${alvo.y}px`;
  tc.style.opacity = String(1 - k); tc.style.transform = `scale(${0.4 + k})`;
  return true;
}
const pinIni = i => E.ventidue - 0.05 + i * Math.min(0.06, 0.9 / pins.length);

function quadro(t) {
  camera(t);
  const [T1, T2, T3, T4, T5, T6, T7] = TAGLI();
  const impactos = [E.persone, E.ventidue, E.sei, E.nove, E.rimborsiamo, E.manda];
  const fl = Math.max(...TAGLI().map(tc => (t >= tc ? 0.75 * (1 - fase(t, tc, 0.22)) : 0)), ...impactos.map(ti => (t >= ti ? 0.45 * (1 - fase(t, ti, 0.28)) : 0)));
  $('#velo').style.opacity = String(fl);
  $('#velo').style.background = impactos.some(ti => t >= ti && t < ti + 0.3) ? '#FFC93C' : '#FFFFFF';
  // 1-2. contadores: pessoas na segunda → casas
  const ct = $('#contatore'), n = ct.querySelector('.n');
  mostrar(ct, t, 0, T2, 20);
  if (t < T1) {
    ct.querySelector('.ic').textContent = '👀';
    n.textContent = num(conta(t, E.settemila - 0.1, 0.7, R.visite, 0));
    ct.querySelector('.s').innerHTML = t >= E.persone - 0.05 ? 'PERSONE <span class="g">IN 1 GIORNO</span>' : '';
    n.style.transform = `scale(${batida(t, E.settemila + 0.6)})`;
  } else {
    ct.querySelector('.ic').textContent = '🏠';
    n.textContent = num(conta(t, E.ventisette - 0.1, 0.8, R.case, 20000));
    ct.querySelector('.s').innerHTML = 'CASE SULLA <span class="g">MAPPA</span>';
    n.style.transform = `scale(${batida(t, E.ventisette + 0.7)})`;
    ct.style.opacity = t >= E.solo3 - 0.1 ? String(1 - fase(t, E.solo3 - 0.1, 0.15)) : ct.style.opacity;
  }
  mostrar($('#giorno'), t, 0, T1, 20, 'translateX(-50%)');
  // alfinetes das 22 lojas
  pins.forEach((pn, i) => {
    const vis = t >= pinIni(i) && t < T2;
    if (!vis) { pn.el.style.opacity = '0'; return; }
    const p = projetar(pn.p.x, pn.p.y, pn.p.z), k = ressalto(fase(t, pinIni(i), 0.3));
    pn.el.style.opacity = p.ok ? '1' : '0';
    pn.el.style.transform = `translate(${p.x}px, ${p.y}px) rotate(-45deg) scale(${0.3 + 0.7 * k})`;
  });
  stampi.forEach(([el, ini, fim, rot]) => carimbo(el, t, ini, fim, rot));
  // títulos por cena
  const tit = $('#titolo');
  const cenas = [
    [T2, E.tocchi + 0.05, ['📍 ROMA', t >= E.gabhub - 0.05 ? '🏪 GABHUB' : '']],
    [T3, E.sei - 0.05, ['⚠️ POCHI POSTI', t >= E.paese - 0.05 ? 'IN UN PAESE PICCOLO…' : 'IN OGNI CITTÀ']],
  ];
  const cn = cenas.find(([a, b]) => t >= a && t < b);
  if (cn) {
    mostrar(tit, t, cn[0], cn[1], 20);
    if (tit.querySelector('.t1').textContent !== cn[2][0]) tit.querySelector('.t1').textContent = cn[2][0];
    tit.querySelector('.t2').textContent = cn[2][1];
  } else tit.style.opacity = '0';
  for (const e of etichette) {
    if (!e.vis(t)) { e.el.style.opacity = '0'; continue; }
    const p = projetar(e.p.x, e.y, e.p.z), s = ressalto(fase(t, e.ini, 0.32));
    e.el.style.opacity = p.ok ? '1' : '0';
    e.el.style.transform = `translate(${p.x - e.el.offsetWidth / 2}px, ${p.y - e.el.offsetHeight}px) scale(${s})`;
  }
  // 3. Gabhub: toque, cartão, WhatsApp
  const pL = projetar(loja.p.x, loja.p.y + LOTE * 0.4, loja.p.z);
  const tc1 = t >= E.tocchi - 0.1 && t < T3 && tocco(t, E.tocchi - 0.1, pL);
  const sc = $('#scheda');
  mostrar(sc, t, E.tocchi + 0.1, T3);
  sc.querySelector('.r1').classList.toggle('on', t >= E.cosa - 0.05 && t < E.dove - 0.05);
  sc.querySelector('.r2').classList.toggle('on', t >= E.dove - 0.05 && t < E.tasto - 0.05);
  const bw = sc.querySelector('.wa');
  bw.classList.toggle('lampo', t >= E.tasto - 0.05 && t < T3);
  bw.style.transform = `scale(${batida(t, E.whatsapp)})`;
  const tc2 = !tc1 && t >= E.whatsapp - 0.1 && t < T3 && tocco(t, E.whatsapp - 0.1, (() => { const r = bw.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })());
  if (!tc1 && !tc2) $('#tocco').style.opacity = '0';
  pulo(sc.querySelector('.msg'), t, E.whatsapp + 0.35);
  // 4. vagas: 6 no paese, as primeiras são pegas
  const po = $('#posti');
  mostrar(po, t, E.sei - 0.1, T4, 30);
  [...po.querySelectorAll('.slot i')].forEach((el, i) => {
    const preso = (i === 0 && t >= E.prima - 0.05) || (i === 1 && t >= E.prende - 0.05) || (i === 2 && t >= E.posto - 0.05);
    el.classList.toggle('preso', preso);
    el.innerHTML = preso ? `🏪<small>PRESO ✅</small>` : `🔓<small>LIBERO</small>`;
    pulo(el, t, E.sei - 0.05 + i * 0.08, preso && t < (i === 0 ? E.prima : i === 1 ? E.prende : E.posto) + 0.3 ? `scale(${batida(t, i === 0 ? E.prima : i === 1 ? E.prende : E.posto)})` : '');
  });
  // 5. preço
  const pr = $('#prezzo');
  mostrar(pr, t, T4 + 0.05, T5);
  pulo(pr.querySelector('.p'), t, E.nove - 0.05);
  pulo(pr.querySelector('.d'), t, E.trenta - 0.05);
  pulo(pr.querySelector('.iva'), t, E.partita - 0.05);
  pr.querySelector('.iva').style.transform += ` scale(${batida(t, E.azzera)})`;
  // 7. passos
  const pa = $('#passi');
  mostrar(pa, t, T6, T7, 30);
  const ps = pa.querySelectorAll('.p');
  pulo(ps[0], t, E.link - 0.05); pulo(ps[1], t, E.tocca - 0.05); pulo(ps[2], t, E.scegli - 0.05);
  pa.querySelector('.tempo').style.transform = `scale(${batida(t, E.minuti)})`;
  // 8. chamada final
  const ca = $('#cta').children;
  mostrar(ca[0], t, T7, R.durata - 0.3, 20);
  mostrar(ca[1], t, E.conosci - 0.05, R.durata - 0.3, 20);
  mostrar(ca[2], t, E.manda - 0.05, R.durata - 0.3, 20);
  if (t >= E.manda) ca[2].style.transform += ` scale(${1 + 0.04 * Math.sin((t - E.manda) * 9)})`;
  legenda(t);
  mappa.renderer.render(mappa.scene, mappa.camera);
  return true;
}

// efeitos sonoros: um por acontecimento na tela; impactos com silêncio antes
function suoni() {
  const s = [], add = (t, tipo, extra = {}) => s.push({ t, tipo, vol: 0.8, ...extra });
  const T = TAGLI();
  add(0, 'stamp', { vol: 0.55 }); add(0.03, 'scintilla', { vol: 0.4 }); add(E.p0 + 0.05, 'ding', { vol: 0.45, tono: 1.1 });
  T.forEach(tc => { add(tc - 0.12, 'whoosh', { vol: 0.42, dur: 0.3 }); add(tc - 0.01, 'boom', { vol: 0.2 }); add(tc, 'pop', { vol: 0.34, tono: 0.7 }); });
  // 1. pessoas
  for (let t = E.settemila - 0.1, k = 0; t < E.settemila + 0.6; t += 0.06, k++) add(t, 'tick', { vol: 0.18, tono: 0.9 + k * 0.05 });
  add(E.settemila + 0.58, 'boom', { vol: 0.75 }); add(E.settemila + 0.6, 'stamp', { vol: 0.8 }); add(E.mappa1, 'whoosh', { vol: 0.3, dur: 0.4 });
  // 2. casas e só 22
  for (let t = E.ventisette - 0.1, k = 0; t < E.ventisette + 0.7; t += 0.06, k++) add(t, 'tick', { vol: 0.16, tono: 0.85 + k * 0.04 });
  add(E.ventisette + 0.7, 'pop', { vol: 0.55, tono: 1.15 });
  add(E.solo3 - 0.38, 'silenzio', { dur: 0.34 }); add(E.solo3 - 0.36, 'riser', { dur: 0.32, vol: 0.45 });
  add(E.ventidue - 0.06, 'boom', { vol: 0.85 }); add(E.ventidue - 0.05, 'stamp', { vol: 0.95 });
  pins.forEach((_, i) => add(pinIni(i), 'pop', { vol: 0.22, tono: 0.9 + (i % 7) * 0.06 }));
  // 3. Gabhub
  add(T[1] + 0.05, 'vento', { vol: 0.3, dur: 1.0 }); add(E.gabhub, 'ding', { vol: 0.5, tono: 1.0 }); add(E.roma, 'flap', { vol: 0.4 });
  add(E.tocchi - 0.1, 'tap', { vol: 0.8 }); add(E.tocchi + 0.1, 'pop', { vol: 0.65 }); add(E.tocchi + 0.12, 'whoosh', { vol: 0.3, dur: 0.35 });
  add(E.cosa - 0.05, 'select', { tono: 1.0 }); add(E.dove - 0.05, 'select', { tono: 1.15 }); add(E.tasto - 0.05, 'ding', { vol: 0.45, tono: 1.3 });
  add(E.whatsapp - 0.1, 'tap', { vol: 0.8 }); add(E.whatsapp + 0.35, 'notifica', { vol: 0.65 });
  // 4. vagas
  add(E.pochi, 'ding', { vol: 0.45, tono: 0.9 }); add(E.paese, 'flap', { vol: 0.35 });
  add(E.sei - 0.36, 'silenzio', { dur: 0.3 });
  for (let i = 0; i < 6; i++) add(E.sei - 0.05 + i * 0.08, 'tick', { vol: 0.45, tono: 0.8 + i * 0.06 });
  add(E.sei + 0.45, 'stamp', { vol: 0.7 });
  [E.prima, E.prende, E.posto].forEach((ti, i) => { add(ti - 0.05, 'coin', { vol: 0.55, tono: 1 + i * 0.1 }); add(ti - 0.04, 'pop', { vol: 0.5 }); });
  // 5. preço
  add(E.caffe, 'ding', { vol: 0.45, tono: 1.2 });
  add(E.nove - 0.36, 'silenzio', { dur: 0.3 }); add(E.nove - 0.06, 'boom', { vol: 0.8 }); add(E.nove - 0.05, 'stamp', { vol: 0.9 }); add(E.nove + 0.05, 'coin', { vol: 0.6 });
  add(E.trenta - 0.05, 'pop', { vol: 0.55, tono: 1.1 });
  add(E.partita - 0.05, 'pop', { vol: 0.6 }); add(E.azzera, 'stamp', { vol: 0.8 }); add(E.azzera + 0.05, 'scintilla', { vol: 0.45 });
  // 6. reembolso
  add(E.rimborsiamo - 0.4, 'silenzio', { dur: 0.35 }); add(E.rimborsiamo - 0.38, 'riser', { dur: 0.33, vol: 0.5 });
  add(E.rimborsiamo - 0.06, 'boom', { vol: 0.85 }); add(E.rimborsiamo - 0.05, 'stamp', { vol: 0.95 }); add(E.tutto15, 'coin', { vol: 0.55 });
  // 7. passos
  add(E.due - 0.05, 'tick', { vol: 0.5 }); add(E.minuti, 'ding', { vol: 0.5, tono: 1.2 });
  [E.link, E.tocca, E.scegli].forEach((ti, i) => { add(ti - 0.05, 'tasto', { vol: 0.6, tono: 1 + i * 0.1 }); add(ti, 'pop', { vol: 0.45, tono: 1 + i * 0.12 }); });
  // 8. chamada
  add(E.hai, 'ding', { vol: 0.5, tono: 1.0 }); add(E.conosci - 0.05, 'pop', { vol: 0.5, tono: 1.1 });
  add(E.manda - 0.06, 'boom', { vol: 0.7 }); add(E.manda - 0.05, 'stamp', { vol: 0.85 }); add(E.video, 'notifica', { vol: 0.6 });
  add(R.durata - 0.7, 'riser', { dur: 0.65, vol: 0.35 });
  return s.sort((a, b) => a.t - b.t);
}

async function preparar(roteiro) {
  R = roteiro; E = R.eventi;
  await Promise.all(['900 104px Nunito', '900 60px Nunito', '800 40px Nunito', '700 30px Nunito'].map(f => document.fonts.load(f)));
  await document.fonts.ready;
  citta = new Citta(mappa, D);
  citta.atualizar?.(true);
  loja = lojaDe(R.negozio);
  borgo = lojaDe(R.negozio_borgo);
  R.case = R.case ?? D.snap.case.length;
  // alfinetes: as lojas e cartelloni reais do mapa
  pins = D.commerci.map(c => { const p = citta.posCommercio(c); const el = document.createElement('div'); el.textContent = '🏪'; $('#pins').appendChild(el); return { p: { x: p.x, y: p.y + LOTE * 0.3, z: p.z }, el }; });
  const c = loja.c;
  const sc = $('#scheda');
  sc.querySelector('.testa').style.background = c.colore;
  sc.querySelector('.testa b').textContent = c.nome;
  sc.querySelector('.r1').textContent = c.descrizione || (TIPI[c.tipo] ?? '🏪 Negozio');
  sc.querySelector('.r2').textContent = `📍 ${c.luogo.nome}`;
  $('#posti .slot').innerHTML = '<i></i>'.repeat(6);
  const T = TAGLI();
  etichette.push({ el: novaEtichetta(`<div class="box oro"><b>🏪 ${esc(c.nome)}</b><span>📍 ${esc(c.luogo.nome)}</span></div><div class="freccia"></div>`), p: loja.p, y: loja.p.y + LOTE * 1.15, vis: t => t >= E.gabhub - 0.05 && t < E.tocchi + 0.1, ini: E.gabhub - 0.05 });
  stampi = [
    [`SOLO <span class="g">${D.commerci.length}</span><br>ATTIVITÀ 🏪`, 300, 130, E.solo3 - 0.05, T[1], -3],
    ['CHI ARRIVA<br><span class="g">PRIMA</span> 🏃', 900, 110, E.chi - 0.05, T[3], 3],
    ['🛡️ RIMBORSO<br><span class="g">100%</span>', 380, 130, E.rimborsiamo - 0.05, T[5], -3],
    ['SE NON<br><span class="g">APPROVIAMO</span>', 260, 80, E.approviamo - 0.05, E.rimborsiamo - 0.05, 2],
  ].map(([html, top, size, ini, fim, rot]) => {
    const el = document.createElement('div');
    el.className = 'stamp forte';
    el.style.cssText = `top:${top}px;font-size:${size}px;-webkit-text-stroke-width:${Math.round(size * 0.18)}px`;
    el.innerHTML = html;
    $('#stampi').appendChild(el);
    return [el, ini, fim, rot];
  });
  montarChaves();
  if (R.copertina) {
    const cp = R.copertina;
    for (const b of [cp.alto, cp.basso].filter(Boolean)) {
      const el = document.createElement('div');
      el.className = 'forte';
      el.style.cssText = `position:absolute;left:20px;right:20px;top:${b.top}px;text-align:center;line-height:1.05;`;
      el.innerHTML = b.linee.map(([txt, cor, size]) => `<div style="font-size:${size}px;-webkit-text-stroke-width:${Math.round(size * 0.19)}px"${cor ? ` class="${cor === true ? 'g' : cor}"` : ''}>${esc(txt)}</div>`).join('');
      document.body.appendChild(el);
    }
    for (const s of ['#stampi', '#fisso', '#titolo', '#etichette', '#contatore', '#giorno', '#scheda', '#tocco']) $(s).style.display = 'none';
  }
  console.log(`dati ${D.snap.dati_fino} · case ${R.case} · commerci ${D.commerci.length} · loja ${c.nome} (${c.luogo.nome}, ${c.tipo}) · borgo ${borgo.c.nome} (${borgo.c.luogo.nome}, ${borgo.c.luogo.case} case)`);
  quadro(0);
  return { durata: R.durata, fps: 30 };
}

iniciar().catch(e => console.error('erro ao carregar', e));
