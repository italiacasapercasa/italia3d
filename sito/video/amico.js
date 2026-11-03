// Reels 21 e 22 do evento "porta un amico" (03/11): título fixo com contagem regressiva até a meia-noite e cenas por frase.
// R.variante = 'regola' (21: a regra +20/+50/+50 e o prêmio) ou 'perche' (22: o motivo — eleição de domingo, 70 pontos por
// amigo, desafiar o Presidente e a casa super decorada). O fim volta à primeira cena (loop). window.preparar/quadro/suoni.
import * as THREE from 'three';
import { carregar } from '../js/dati.js';
import { Mappa, COR_MAR } from '../js/mappa.js';
import { Citta, LOTE } from '../js/citta.js';
import { ALTURA_NIVEL } from '../js/modelli.js';
import { costruisci } from '../js/decori.js';

const $ = s => document.querySelector(s);
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const suave = s => (s < 0.5 ? 4 * s * s * s : 1 - Math.pow(-2 * s + 2, 3) / 2);
const ressalto = s => { const c = 1.9; return s <= 0 ? 0 : s >= 1 ? 1 : 1 + (c + 1) * Math.pow(s - 1, 3) + c * Math.pow(s - 1, 2); };
const fase = (t, ini, dur) => clamp((t - ini) / dur);
const esc = s => String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
const num = n => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
const conta = (t, ini, dur, v, de = 0) => de + (v - de) * (1 - Math.pow(1 - fase(t, ini, dur), 3));
const batida = (t, ti) => (t >= ti && t < ti + 0.35 ? 1 + 0.25 * Math.sin(Math.PI * (t - ti) / 0.35) : 1);
// relógio da tela: quanto falta para a meia-noite na hora da postagem (~10:20 na Itália), descendo com o vídeo
const CD0 = 13 * 3600 + 40 * 60;
const hms = s => [3600, 60, 1].map((u, i) => String(Math.floor(s / u) % (i ? 60 : 100)).padStart(2, '0')).join(':');

let D, mappa, citta, R, E, V, chaves, deco = [], etichette = [], stampi = [], casas = {}, PRES = 0;
const GIORNO = { mar: new THREE.Color(COR_MAR), terra: new THREE.Color('#ffffff'), ceu: 2.3, sol: 2.4, ceuC: new THREE.Color('#ffffff'), solC: new THREE.Color('#fff1dc') };
const NOTTE = { mar: new THREE.Color('#1B2E55'), terra: new THREE.Color('#7381A8'), ceu: 1.1, sol: 0.7, ceuC: new THREE.Color('#B9C6FF'), solC: new THREE.Color('#A9BBFF') };

async function iniciar() {
  D = await carregar('video');
  mappa = new Mappa($('#mappa'), D.geo, D.rilievo, D.imagem, { gravacao: true });
  window.preparar = preparar;
  window.quadro = quadro;
  window.suoni = suoni;
}
function ceu(k) {
  const c = GIORNO.mar.clone().lerp(NOTTE.mar, k);
  mappa.scene.background.copy(c); mappa.scene.fog.color.copy(c); mappa.mar.material.color.copy(c);
  mappa.matTerreno.color.copy(GIORNO.terra.clone().lerp(NOTTE.terra, k));
  mappa.ceu.intensity = GIORNO.ceu + (NOTTE.ceu - GIORNO.ceu) * k; mappa.ceu.color.copy(GIORNO.ceuC.clone().lerp(NOTTE.ceuC, k));
  mappa.sol.intensity = GIORNO.sol + (NOTTE.sol - GIORNO.sol) * k; mappa.sol.color.copy(GIORNO.solC.clone().lerp(NOTTE.solC, k));
  mappa.notte = k > 0.6;
  citta.grupoNotte.visible = k > 0.6;
}
function decorare(conta, extra) {
  const casa = D.porConta.get(conta);
  if (!casa) throw new Error(`@${conta} não está no mapa`);
  const l = D.luoghi[casa.luogo];
  citta.nascoste.add(conta); citta.cache.delete(l.id); citta.ultimo = null;
  const o = costruisci(D, citta, () => !!mappa.notte, casa, { squadra: null, extra: new Set(extra) });
  citta.grupo.add(o.g);
  deco.push(o);
  return { casa, l, o, p: citta.posCasa(casa), topo: casa.y + (o.pilha + 0.3) * LOTE, h: ALTURA_NIVEL[casa.livello] };
}
// casa média de uma cidade, sem cargo nem decoração (as casas de exemplo não mostram @ real)
function casaComum(cidade, cargos, nivel = [2, 4]) {
  const c = D.casas.filter(x => D.luoghi[x.luogo].nome === cidade && !cargos.has(x.conta) && x.livello >= nivel[0] && x.livello <= nivel[1]).sort((a, b) => b.tot - a.tot)[0];
  if (!c) throw new Error(`sem casa de exemplo em ${cidade}`);
  return c.conta;
}

// ---------- roteiro de cada variante: cenas (início, câmera, noite) e carimbos ----------
function variante() {
  const b = D.geo.bbox, alt = b.z1 - b.z0, dP = mappa.distPais();
  const paese = (dist, az, giu = 0.12) => ({ x: (b.x0 + b.x1) / 2, z: (b.z0 + b.z1) / 2 - alt * 0.07, dist: dP * dist, az, giu });
  const Q = (o, az, perto = 1) => ({ x: o.p.x, z: o.p.z, dist: clamp(0.45 + o.h * 0.075, 0.55, 1.2) * perto, az, giu: o.h > 1.5 ? 0.28 : 0.08 });
  const P = (o, dist, az, giu = 0.22) => ({ x: o.p.x, z: o.p.z, dist, az, giu });
  const { nuova: N, super: S, pres: Pr } = casas;
  if (R.variante === 'regola') return {
    cene: [
      [0, paese(1.05, -0.08), paese(0.95, 0.04), 0],
      [E.p2, paese(0.8, 0.2, 0.15), paese(0.72, 0.05, 0.15), 0],
      [E.p4, Q(N, -0.4, 1.15), Q(N, 0.2, 0.95), 0],
      [E.p5, Q(N, 1.2, 1.25), Q(N, 1.7, 1.1), 0],
      [E.p6, paese(0.9, -0.15), paese(1.0, 0.05), 0],
      [E.p7, Q(S, -0.5, 1.15), Q(S, 0.4, 0.95), 1],
      [E.p8, paese(1.1, 0.1), paese(1.0, -0.05), 0],
      [E.p9, Q(S, 1.4, 1.35), Q(S, 2.0, 1.2), 1],
      [E.p10, null, null, 0],
    ],
    stampi: [
      ['SOLO <span class="g">OGGI</span>', 330, 170, E.oggi, E.p2, -4],
      ['🤝 UNA REGOLA<br><span class="g">NUOVA</span>', 720, 96, E.nuova, E.p2, 3],
      ['🏠 NUOVA <span class="g">CASA!</span>', 430, 110, E.casa4, E.p5, -3],
      ['🎨 DECORATA<br><span class="g">COME VUOI</span>', 330, 100, E.decorata, E.dieci, -3],
      ['🏆 10 GIORNI<br><span class="g">GRATIS</span>', 330, 120, E.dieci, E.p8, 3],
    ],
  };
  return {
    cene: [
      [0, P(Pr, 1.35, 1.1), P(Pr, 1.2, 1.5), 1],
      [E.p1, paese(1.0, -0.1), paese(0.92, 0.05), 0],
      [E.p2, paese(0.85, 0.2, 0.15), paese(0.78, 0.05, 0.15), 0],
      [E.p5, paese(1.1, -0.15), paese(1.0, 0.05), 0],
      [E.p7, P(Pr, 1.5, 2.2), P(Pr, 1.3, 2.7), 1],
      [E.p8, Q(S, -0.5, 1.15), Q(S, 0.5, 0.95), 1],
      [E.p10, paese(1.1, 0.1), paese(1.0, -0.05), 0],
      [E.p11, Q(S, 1.4, 1.35), Q(S, 2.0, 1.2), 1],
      [E.p12, null, null, 1],
    ],
    stampi: [
      ['👑 PRESIDENTE<br><span class="g">DOMENICA?</span>', 430, 110, E.presidente, E.p1, -3],
      ['OGGI È<br><span class="g">IL GIORNO</span> 🔥', 560, 150, E.giorno - 0.4, E.p2, 3],
      ['🏆 CASA SUPER<br><span class="g">DECORATA</span>', 330, 100, E.super - 0.3, E.dieci9, -3],
      ['🏆 10 GIORNI<br><span class="g">GRATIS</span>', 330, 120, E.dieci9, E.p10, 3],
    ],
  };
}
const TAGLI = () => V.cene.slice(1).map(c => c[0] - 0.1);

// ---------- câmera ----------
function montarChaves() {
  const lista = [];
  V.cene.forEach(([ini, a, c], i) => {
    const fim = i + 1 < V.cene.length ? V.cene[i + 1][0] - 0.1 : R.durata;
    const t0 = i ? ini - 0.1 : 0;
    if (a) lista.push([t0, a], [fim - 0.01, c]);
  });
  // a última cena volta à primeira tomada (loop)
  const ult = V.cene.at(-1)[0] - 0.1, prim = V.cene[0];
  lista.push([ult, { ...prim[1], dist: prim[1].dist * 1.12, az: prim[1].az - 0.25 }], [R.durata, prim[1]]);
  chaves = lista.sort((x, y) => x[0] - y[0]).map(([t, k]) => ({ t, k }));
}
function camera(t) {
  let i = 0;
  while (i < chaves.length - 2 && t >= chaves[i + 1].t) i++;
  const a = chaves[i], b = chaves[Math.min(i + 1, chaves.length - 1)];
  const s = b.t > a.t ? suave(clamp((t - a.t) / (b.t - a.t))) : 1;
  const sl = a.t >= TAGLI().at(-1) - 0.01 ? clamp((t - a.t) / (b.t - a.t)) : s;
  const A = a.k, B = b.k, l = (p, q) => p + (q - p) * sl;
  const dist = Math.exp(l(Math.log(A.dist), Math.log(B.dist)));
  const imp = V.stampi.map(x => x[3]);
  const tremor = imp.reduce((v, ti) => v + (t >= ti && t < ti + 0.35 ? 0.013 * (1 - (t - ti) / 0.35) * Math.sin((t - ti) * 70) : 0), 0);
  const az = l(A.az, B.az) + tremor, giu = l(A.giu, B.giu), x = l(A.x, B.x), z = l(A.z, B.z);
  mappa.az = az; mappa.dist = dist * (1 + tremor);
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
function mostrar(el, t, ini, fim, sobe = 30) {
  const ent = ressalto(fase(t, ini, 0.32)), sai = fase(t, fim - 0.2, 0.2), vis = t >= ini && t < fim;
  el.style.opacity = vis ? String(1 - sai) : '0';
  if (vis) el.style.transform = `translateY(${(1 - Math.min(1, ent)) * sobe - sai * 40}px) scale(${0.85 + 0.15 * ent})`;
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
const CORES = ['#2E9B55', '#FFFFFF', '#E0473C', '#FFC93C', '#3FA9F5', '#8E5CF7'];
const CONF = Array.from({ length: 64 }, (_, i) => ({ x: (i * 157) % 1080, atraso: ((i * 37) % 30) / 60, vel: 700 + ((i * 53) % 500), giro: ((i * 91) % 720) - 360, dx: ((i * 29) % 160) - 80, cor: CORES[i % CORES.length] }));
function coriandoli(t, burst) {
  const t0 = burst.filter(b => t >= b).at(-1);
  [...$('#coriandoli').children].forEach((el, i) => {
    const c = CONF[i], dt = t0 == null ? -1 : t - t0 - c.atraso, vis = dt > 0 && dt < 2.0;
    el.style.opacity = vis ? String(1 - fase(dt, 1.4, 0.6)) : '0';
    if (vis) el.style.transform = `translate(${c.x + c.dx * Math.sin(dt * 4)}px, ${-60 + c.vel * dt}px) rotate(${c.giro * dt}deg)`;
  });
}
const cenaDe = t => { let i = 0; while (i + 1 < V.cene.length && t >= V.cene[i + 1][0] - 0.1) i++; return i; };

function quadro(t) {
  camera(t);
  const T = TAGLI(), ic = cenaDe(t), cena = V.cene[ic];
  const kn = (ic === V.cene.length - 1 ? V.cene[0][3] : cena[3]) ? 1 : 0;
  ceu(kn);
  $('#vignetta').style.opacity = String(kn);
  for (const o of deco) o.anima(t * 1000);
  const fl = Math.max(...T.map(tc => (t >= tc ? 0.75 * (1 - fase(t, tc, 0.22)) : 0)), ...V.stampi.map(x => (t >= x[3] ? 0.45 * (1 - fase(t, x[3], 0.25)) : 0)));
  $('#velo').style.opacity = String(fl);
  // título fixo com o relógio
  $('#testa span').textContent = `⏳ ${hms(Math.max(0, CD0 - Math.floor(t)))}`;
  $('#testa').style.transform = `scale(${1 + 0.015 * Math.sin(t * 6)})`;
  stampi.forEach(([el, , , ini, fim, rot]) => carimbo(el, t, ini, fim, rot));
  for (const e of etichette) {
    const v = e.vis(t);
    if (!v) { e.el.style.opacity = '0'; continue; }
    const p = projetar(e.p.x, e.y, e.p.z), s = ressalto(fase(t, e.ini, 0.32));
    e.el.style.opacity = p.ok ? '1' : '0';
    e.el.style.transform = `translate(${p.x - e.el.offsetWidth / 2}px, ${p.y - e.el.offsetHeight}px) scale(${s})`;
  }
  const relogio = (ini, fim) => {
    const o = $('#orologio');
    mostrar(o, t, ini, fim, 40);
    o.querySelector('.cd').textContent = `⏳ ${hms(Math.max(0, CD0 - Math.floor(t)))}`;
    o.querySelector('.cd').style.transform = `scale(${1 + 0.04 * Math.sin(t * 2 * Math.PI)})`;
  };
  const cta = (ini, fim) => { const c = $('#cta').children; mostrar(c[0], t, ini, fim, 20); mostrar(c[1], t, ini + 0.5, fim, 20); };
  if (R.variante === 'regola') {
    // nova casa do amigo: nasce com pulo no "casa"
    const N = casas.nuova.o.g, k = t < E.casa4 - 0.1 ? 0.001 : ressalto(fase(t, E.casa4 - 0.1, 0.45));
    N.scale.setScalar(LOTE * Math.max(0.001, k));
    mostrar($('#comm'), t, E.p2 - 0.05, T[1]);
    pulo($('#comm .pt'), t, E.venti - 0.05, 'rotate(6deg)');
    $('#comm .tag').style.boxShadow = t >= E.amico ? `0 0 0 ${4 + 3 * Math.sin(t * 10)}px #FFC93C` : '';
    const duo = $('#duo').children;
    if (t >= T[2] && t < T[3]) { pulo(duo[0], t, E.te - 0.1, 'rotate(-3deg)'); pulo(duo[1], t, E.lui - 0.1, 'rotate(3deg)'); }
    else { duo[0].style.opacity = '0'; duo[1].style.opacity = '0'; }
    const rk = $('#rank');
    mostrar(rk, t, T[3], T[4]);
    rk.querySelectorAll('.riga').forEach((r, i) => pulo(r, t, E.p6 + 0.15 + i * 0.25));
    rk.querySelector('.primo').style.transform += ` scale(${batida(t, E.tutti)})`;
    relogio(T[5], T[6]);
    cta(T[6], T[7]);
    coriandoli(t, [E.oggi, E.dieci]);
  } else {
    const so = $('#somma'), ln = so.querySelectorAll('.linha'), tot = so.querySelector('.tot');
    mostrar(so, t, T[1], T[2]);
    tot.textContent = '1 AMICO = +70';
    pulo(tot, t, E.settanta - 0.05); tot.style.fontSize = '120px';
    pulo(ln[0], t, E.p3); pulo(ln[1], t, E.p4);
    tot.style.transform += ` scale(${batida(t, E.p4 + 0.6)})`;
    const am = $('#amici').children, vis5 = t >= T[2] && t < T[3];
    [...am].forEach((el, i) => { if (!vis5) { el.style.opacity = '0'; return; } pulo(el, t, E.p5 + i * ((E.p6 - E.p5 - 0.1) / 10)); });
    const at = $('#amici-tot');
    carimbo(at, t, E.p6 - 0.05, T[3], -3);
    at.innerHTML = `10 AMICI = <span class="g">+700</span>`;
    const sf = $('#sfida');
    mostrar(sf, t, T[3], T[4]);
    const n = sf.querySelectorAll('.n');
    n[0].textContent = num(conta(t, E.p7, 0.8, 700)); n[1].textContent = num(PRES);
    n[0].style.transform = `scale(${batida(t, E.sfidare)})`;
    sf.querySelector('.vs').style.transform = `rotate(${10 * Math.sin(t * 5)}deg) scale(${batida(t, E.pres7)})`;
    relogio(T[5], T[6]);
    cta(T[6], T[7]);
    coriandoli(t, [E.p6, E.super]);
  }
  legenda(t);
  mappa.renderer.render(mappa.scene, mappa.camera);
  return true;
}

// efeitos sonoros: um por acontecimento na tela
function suoni() {
  const s = [], add = (t, tipo, extra = {}) => s.push({ t, tipo, vol: 0.8, ...extra });
  const T = TAGLI();
  add(0, 'stamp', { vol: 0.7 }); add(0.03, 'scintilla', { vol: 0.4 });
  T.forEach(tc => { add(tc - 0.12, 'whoosh', { vol: 0.42, dur: 0.3 }); add(tc - 0.01, 'boom', { vol: 0.2 }); add(tc, 'pop', { vol: 0.34, tono: 0.7 }); });
  V.stampi.forEach(([, , , ti], i) => { add(ti - 0.3, 'riser', { dur: 0.28, vol: 0.4 }); add(ti - 0.02, 'boom', { vol: 0.75 }); add(ti, 'stamp', { vol: 0.9 }); add(ti + 0.05, i % 2 ? 'coin' : 'scintilla', { vol: 0.5 }); });
  // relógio: tique a cada segundo, baixinho, o vídeo inteiro (pressa)
  for (let t = 1; t < R.durata; t += 1) add(t, 'tick', { vol: 0.1, tono: 1.5 });
  if (R.variante === 'regola') {
    add(E.amico, 'tasto', { vol: 0.6 }); add(E.amico + 0.08, 'tasto', { vol: 0.5, tono: 1.1 }); add(E.casa2, 'pop', { vol: 0.5 });
    add(E.venti - 0.05, 'coin', { vol: 0.7 }); add(E.venti, 'ding', { vol: 0.5, tono: 1.3 });
    add(E.casa4 - 0.1, 'pop', { vol: 0.8, tono: 0.8 }); add(E.casa4, 'scintilla', { vol: 0.5 });
    add(E.te - 0.1, 'coin', { vol: 0.65 }); add(E.lui - 0.1, 'coin', { vol: 0.65, tono: 1.2 });
    for (let i = 0; i < 3; i++) add(E.p6 + 0.15 + i * 0.25, 'pop', { vol: 0.5, tono: 1.2 - i * 0.1 });
    add(E.tutti, 'ding', { vol: 0.5, tono: 1.4 }); add(E.dieci + 0.1, 'fuoco', { vol: 0.45 });
    add(E.undici, 'ding', { vol: 0.5 }); add(E.mezzanotte, 'ding', { vol: 0.55, tono: 0.8 });
    add(E.amico9, 'notifica', { vol: 0.55 });
  } else {
    add(E.presidente, 'flap', { vol: 0.5 }); add(E.domenica, 'ding', { vol: 0.5, tono: 1.2 });
    add(E.settanta - 0.05, 'coin', { vol: 0.7 }); add(E.p3, 'pop', { vol: 0.6 }); add(E.p4, 'pop', { vol: 0.6, tono: 1.15 });
    for (let i = 0; i < 10; i++) add(E.p5 + i * ((E.p6 - E.p5 - 0.1) / 10), 'pop', { vol: 0.35, tono: 0.9 + i * 0.05 });
    for (let t = E.p7, k = 0; t < E.p7 + 0.8; t += 0.07, k++) add(t, 'tick', { vol: 0.2, tono: 0.9 + k * 0.05 });
    add(E.sfidare, 'stamp', { vol: 0.7 }); add(E.pres7, 'fischio', { vol: 0.35, dur: 0.4 });
    add(E.super + 0.2, 'fuoco', { vol: 0.45 }); add(E.mezzanotte, 'ding', { vol: 0.55, tono: 0.8 }); add(E.amico11, 'notifica', { vol: 0.55 });
  }
  const ult = T.at(-1);
  add(ult, 'riser', { dur: R.durata - ult, vol: 0.4 });
  return s.sort((a, b) => a.t - b.t);
}

async function preparar(roteiro) {
  R = roteiro; E = R.eventi;
  await Promise.all(['900 104px Nunito', '900 60px Nunito', '800 40px Nunito', '700 30px Nunito'].map(f => document.fonts.load(f)));
  await document.fonts.ready;
  citta = new Citta(mappa, D);
  const k = D.snap.cariche;
  const cargos = new Set([k.presidente?.conta, ...Object.values(k.sindaci ?? {}).map(s => s.conta)]);
  casas.nuova = decorare(casaComum(R.demo_citta, cargos), []);
  casas.super = decorare(casaComum(R.deco_citta, cargos, [3, 5]), ['oro', 'neon', 'corona', 'fuochi', 'campione']);
  casas.pres = decorare(k.presidente.conta, ['presidenza', 'fascia']);
  PRES = k.presidente.pts ?? 0;
  citta.atualizar?.(true);
  V = variante();
  // carimbos
  stampi = V.stampi.map(([html, top, size, ini, fim, rot]) => {
    const el = document.createElement('div');
    el.className = 'stamp forte';
    el.style.cssText = `top:${top}px;font-size:${size}px;-webkit-text-stroke-width:${Math.round(size * 0.18)}px`;
    el.innerHTML = html;
    $('#stampi').appendChild(el);
    return [el, top, size, ini, fim, rot];
  });
  // rótulos (sem @ real nas casas de exemplo)
  const rot = (o, html, vis, ini) => etichette.push({ el: novaEtichetta(html), p: o.p, y: o.topo, vis, ini });
  const T = TAGLI();
  if (R.variante === 'regola') {
    rot(casas.nuova, '<div class="box"><b>🏠 @il_tuo_amico</b><em>+50 PUNTI A TESTA</em></div><div class="freccia"></div>', t => t >= E.casa4 + 0.2 && t < T[3], E.casa4 + 0.2);
    rot(casas.super, '<div class="box oro"><b>🏆 LA TUA CASA</b><em>COME VUOI TU</em></div><div class="freccia"></div>', t => t >= T[4] + 0.3 && t < T[5], T[4] + 0.3);
  } else {
    rot(casas.pres, `<div class="box oro"><b>👑 @${esc(k.presidente.conta)}</b><em>${num(PRES)} PUNTI QUESTA SETTIMANA</em></div><div class="freccia"></div>`, t => t < E.presidente || (t >= T[3] && t < T[4]) || t >= T.at(-1), 0);
    rot(casas.super, '<div class="box oro"><b>🏆 LA TUA CASA</b><em>PER 10 GIORNI</em></div><div class="freccia"></div>', t => t >= T[4] + 0.3 && t < T[5], T[4] + 0.3);
    $('#amici').innerHTML = ['😎', '🤩', '😄', '🥳', '😍', '🤠', '😁', '🙌', '🔥', '💪'].map(e => `<i>${e}</i>`).join('');
  }
  $('#coriandoli').innerHTML = CONF.map(c => `<i style="background:${c.cor}"></i>`).join('');
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
    $('#stampi').style.display = 'none';
    $('#fisso').style.display = 'none';
    $('#coriandoli').style.display = 'none';
  }
  console.log(`dati ${D.snap.dati_fino} · ${R.variante} · nuova @${casas.nuova.casa.conta} (${casas.nuova.l.nome}) · super @${casas.super.casa.conta} (${casas.super.l.nome}) · presidente @${k.presidente.conta} ${PRES} pts semana`);
  quadro(0);
  return { durata: R.durata, fps: 30 };
}

iniciar().catch(e => console.error('erro ao carregar', e));
