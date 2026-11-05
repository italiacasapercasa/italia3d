// Reel 23 "sfidante" (04/11): resultado do "Porta un amico" — 286 amigos novos em um dia, o vencedor de Termoli com 15,
// o prêmio (a casa dele trocando de decoração), a 108 pontos do Presidente, domingo às 21, comentário = pontos,
// "commenta la tua città" (casa nova) e "decorala dal link in bio". O fim volta à primeira cena (loop).
// window.preparar/quadro/suoni; tudo depende só de t.
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

let D, mappa, citta, R, E, chaves, deco = [], etichette = [], stampi = [], casas = {}, vinc = [], demo = [];
const GIORNO = { mar: new THREE.Color(COR_MAR), terra: new THREE.Color('#ffffff'), ceu: 2.3, sol: 2.4, ceuC: new THREE.Color('#ffffff'), solC: new THREE.Color('#fff1dc') };
const NOTTE = { mar: new THREE.Color('#1B2E55'), terra: new THREE.Color('#7381A8'), ceu: 1.1, sol: 0.7, ceuC: new THREE.Color('#B9C6FF'), solC: new THREE.Color('#A9BBFF') };
// as decorações que a casa do vencedor "experimenta" no prêmio (troca a cada VEZ segundos)
const PROVA = [['oro', 'corona'], ['neon', 'fuochi'], ['tricolore', 'campione'], ['oro', 'neon', 'corona', 'fuochi', 'campione']];
const VEZ = 0.42;

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

// cortes secos: início de cada cena
const TAGLI = () => [E.p3, E.p4, E.p5, E.p8, E.p11, E.p13, E.p15, E.p17].map(x => x - 0.1);
// noite: prêmio (fogos/neon), Presidente (feixes) e a casa decorada do fim
const notteIn = t => { const T = TAGLI(); return (t >= T[2] && t < T[4]) || t >= T[7]; };

// ---------- câmera ----------
function montarChaves() {
  const b = D.geo.bbox, alt = b.z1 - b.z0, dP = mappa.distPais();
  const paese = (dist, az, giu = 0.12) => ({ x: (b.x0 + b.x1) / 2, z: (b.z0 + b.z1) / 2 - alt * 0.07, dist: dP * dist, az, giu });
  const Q = (o, az, perto = 1) => ({ x: o.p.x, z: o.p.z, dist: clamp(0.45 + o.h * 0.075, 0.55, 1.2) * perto, az, giu: o.h > 1.5 ? 0.28 : 0.08 });
  const P = (o, dist, az, giu = 0.22) => ({ x: o.p.x, z: o.p.z, dist, az, giu });
  const [T1, T2, T3, T4, T5, T6, T7, T8] = TAGLI();
  const V = vinc[0], Pr = casas.pres, N = demo[0];
  const cena = (ini, fim, a, c) => [[ini, a], [fim - 0.01, c]];
  const ABRE = paese(1.08, -0.1);
  const lista = [
    ...cena(0, T1, ABRE, paese(0.92, 0.06)),
    ...cena(T1, T2, paese(0.8, 0.22, 0.15), paese(0.72, 0.08, 0.15)),
    // mergulho em Termoli: de longe até a casa
    ...cena(T2, T3, P(V, 2.6, -0.6, 0.1), Q(V, -0.1, 1.0)),
    ...cena(T3, T4, Q(V, 0.3, 1.2), Q(V, 1.3, 0.95)),
    ...cena(T4, T5, P(Pr, 1.5, 1.0), P(Pr, 1.25, 1.6)),
    ...cena(T5, T6, paese(1.0, -0.15), paese(0.9, 0.05)),
    ...cena(T6, T7, paese(0.85, 0.2, 0.15), paese(0.8, 0.05, 0.15)),
    ...cena(T7, T8, Q(N, -0.5, 1.2), Q(N, 0.2, 0.95)),
    [T8, Q(N, 0.6, 1.15)],
    [R.durata - 1.2, Q(N, 1.3, 0.95)],
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
  const imp = [E.duecento + 0.6, E.quindici, E.decorata, E.cento, E.quattro, E.casa16, E.brilli];
  const tremor = imp.reduce((v, ti) => v + (t >= ti && t < ti + 0.35 ? 0.013 * (1 - (t - ti) / 0.35) * Math.sin((t - ti) * 70) : 0), 0);
  const soco = [E.quindici, E.decorata, E.brilli].reduce((v, ti) => v + (t >= ti && t < ti + 0.5 ? 0.1 * Math.sin(Math.PI * (t - ti) / 0.5) : 0), 0);
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
const FACCE = ['😎', '🤩', '😄', '🥳', '😍', '🤠', '😁', '🙌', '🔥', '💪', '😜', '🤗', '😺', '🦁', '🐯', '👻', '🤓', '😇', '🥰', '🤙', '👋', '🌟', '🎉', '💛'];
// qual variante do prêmio aparece no instante t (troca a cada VEZ s a partir do "decorata"; a última fica)
const provaDi = t => (t < E.decorata - 0.03 ? -1 : Math.min(PROVA.length - 1, Math.floor((t - E.decorata + 0.03) / VEZ)));

function quadro(t) {
  camera(t);
  const [T1, T2, T3, T4, T5, T6, T7, T8] = TAGLI();
  const kn = notteIn(t) ? 1 : 0;
  ceu(kn);
  $('#vignetta').style.opacity = String(kn);
  // casa do vencedor: normal → troca de decoração (prêmio)
  const pv = provaDi(t);
  vinc.forEach((v, i) => { v.o.g.visible = i === pv + 1; });
  // casa nova do fim: nasce no "casa", depois fica decorada no "brilli"
  const kN = t < E.casa16 - 0.1 ? 0.001 : ressalto(fase(t, E.casa16 - 0.1, 0.45));
  demo[0].o.g.visible = t < E.brilli - 0.03; demo[1].o.g.visible = t >= E.brilli - 0.03;
  demo[0].o.g.scale.setScalar(LOTE * Math.max(0.001, t < T6 ? 1 : kN));
  for (const o of deco) o.anima(t * 1000);
  const impactos = [E.duecento + 0.6, E.quindici, E.decorata, E.cento, E.brilli];
  const fl = Math.max(...TAGLI().map(tc => (t >= tc ? 0.75 * (1 - fase(t, tc, 0.22)) : 0)), ...impactos.map(ti => (t >= ti ? 0.5 * (1 - fase(t, ti, 0.28)) : 0)));
  $('#velo').style.opacity = String(fl);
  $('#velo').style.background = impactos.some(ti => t >= ti && t < ti + 0.3) ? '#FFC93C' : '#FFFFFF';
  // 1. abertura: contador 0 → 286 e as carinhas
  const ab = $('#apertura');
  mostrar(ab, t, 0, T1, 20);
  ab.querySelector('.n').textContent = `+${num(conta(t, E.duecento - 0.2, 0.8, R.entrati, 0))}`;
  ab.querySelector('.n').style.transform = `scale(${batida(t, E.duecento + 0.6)})`;
  [...$('#facce').children].forEach((el, i) => { if (t >= T1) { el.style.opacity = '0'; return; } pulo(el, t, E.p1 + i * ((E.duecento + 0.6 - E.p1) / FACCE.length)); });
  // 2. "uno solo… quindici": ranking real
  const rk = $('#rank');
  mostrar(rk, t, T1, T2);
  rk.querySelectorAll('.riga').forEach((r, i) => pulo(r, t, T1 + 0.15 + (i ? 0.25 * (4 - i) : 0.25 * 4 + 0.1), i === 0 ? `scale(${batida(t, E.quindici)})` : ''));
  // carimbos
  stampi.forEach(([el, ini, fim, rot]) => carimbo(el, t, ini, fim, rot));
  // títulos por cena
  const tit = $('#titolo');
  const cenas = [
    [T2, T3, ['📍 TERMOLI', t >= E.termoli - 0.05 ? '🏆 IL VINCITORE' : '']],
    [T3, T4, t < E.decorata - 0.05 ? ['🎁 IL PREMIO?', ''] : ['🎨 LA SUA CASA', t >= E.vuole - 0.05 ? 'COME VUOLE LUI' : '']],
    [T4, T5, t < E.p9 - 0.05 ? ['⚠️ MA NON', 'È FINITA QUI'] : null],
    [T6, T7, ['💬 OGNI COMMENTO', t >= E.punti13 - 0.05 ? 'VALE PUNTI' : '']],
  ];
  const cn = cenas.find(([a, b, x]) => t >= a && t < b && x);
  if (cn) {
    mostrar(tit, t, cn[0] === T3 && t >= E.decorata - 0.05 ? E.decorata - 0.05 : cn[0], cn[0] === T3 && t < E.decorata - 0.05 ? E.decorata - 0.05 : cn[0] === T4 ? E.p9 - 0.05 : cn[1], 20);
    if (tit.querySelector('.t1').textContent !== cn[2][0]) tit.querySelector('.t1').textContent = cn[2][0];
    tit.querySelector('.t2').textContent = cn[2][1];
  } else tit.style.opacity = '0';
  // rótulos das casas
  for (const e of etichette) {
    const v = e.vis(t);
    if (!v) { e.el.style.opacity = '0'; continue; }
    const p = projetar(e.p.x, e.y(t), e.p.z), s = ressalto(fase(t, e.ini, 0.32));
    e.el.style.opacity = p.ok ? '1' : '0';
    e.el.style.transform = `translate(${p.x - e.el.offsetWidth / 2}px, ${p.y - e.el.offsetHeight}px) scale(${s})`;
  }
  // 4. a 108 pontos do Presidente
  const sf = $('#sfida');
  mostrar(sf, t, E.p9 - 0.05, T5);
  const n = sf.querySelectorAll('.n');
  n[0].textContent = num(conta(t, E.p9, 0.9, R.sfidante_pts, 0)); n[1].textContent = num(conta(t, E.p9, 0.9, R.presidente_pts, 0));
  sf.querySelector('.vs').style.transform = `rotate(${10 * Math.sin(t * 5)}deg) scale(${batida(t, E.pres10)})`;
  pulo(sf.querySelector('.diff'), t, E.cento - 0.05);
  // 5. domenica alle 21 · 4 giorni
  const or = $('#orologio');
  mostrar(or, t, T5, T6, 40);
  or.querySelector('.ore').style.transform = `scale(${batida(t, E.ventuno)})`;
  pulo(or.querySelector('.g4'), t, E.quattro - 0.05);
  pulo(or.querySelector('.t'), t, E.giorni12 - 0.05);
  // 6. comentário vale pontos; amigo vale mais
  const cm = $('#comm');
  mostrar(cm, t, T6 + 0.05, T7);
  pulo(cm.querySelector('.pt'), t, E.punti13 - 0.05, 'rotate(6deg)');
  pulo(cm.querySelector('.tag'), t, E.amico14 - 0.05);
  // 7. comenta a cidade; 8. link in bio
  mostrar($('#cta').children[0], t, T7, T8, 20);
  const lk = $('#link');
  mostrar(lk, t, E.link - 0.1, R.durata - 0.35, 30);
  pulo(lk.querySelector('.b'), t, E.bio + 0.05);
  coriandoli(t, [E.quindici, E.decorata, E.brilli]);
  legenda(t);
  mappa.renderer.render(mappa.scene, mappa.camera);
  return true;
}

// efeitos sonoros: um por acontecimento na tela; impactos com silêncio antes
function suoni() {
  const s = [], add = (t, tipo, extra = {}) => s.push({ t, tipo, vol: 0.8, ...extra });
  const T = TAGLI();
  add(0, 'stamp', { vol: 0.6 }); add(0.03, 'scintilla', { vol: 0.4 });
  T.forEach(tc => { add(tc - 0.12, 'whoosh', { vol: 0.42, dur: 0.3 }); add(tc - 0.01, 'boom', { vol: 0.2 }); add(tc, 'pop', { vol: 0.34, tono: 0.7 }); });
  // 1. carinhas e contador
  FACCE.forEach((_, i) => add(E.p1 + i * ((E.duecento + 0.6 - E.p1) / FACCE.length), 'pop', { vol: 0.22, tono: 0.85 + (i % 6) * 0.07 }));
  for (let t = E.duecento - 0.2, k = 0; t < E.duecento + 0.6; t += 0.06, k++) add(t, 'tick', { vol: 0.18, tono: 0.9 + k * 0.04 });
  add(E.duecento + 0.58, 'boom', { vol: 0.8 }); add(E.duecento + 0.6, 'stamp', { vol: 0.85 }); add(E.nuove, 'ding', { vol: 0.45, tono: 1.3 });
  // 2. ranking e "15"
  for (let i = 0; i < 3; i++) add(T[0] + 0.15 + 0.25 * (3 - i - 1 + 1), 'pop', { vol: 0.45, tono: 0.9 + i * 0.1 });
  add(E.quindici - 0.4, 'silenzio', { dur: 0.36 }); add(E.quindici - 0.38, 'riser', { dur: 0.34, vol: 0.5 });
  add(E.quindici - 0.04, 'boom', { vol: 0.9 }); add(E.quindici - 0.03, 'stamp', { vol: 1 }); add(E.quindici + 0.05, 'coin', { vol: 0.55 });
  // 3. Termoli: mergulho e rótulo
  add(T[1] + 0.05, 'vento', { vol: 0.3, dur: 1.0 }); add(E.termoli, 'ding', { vol: 0.55, tono: 1.1 }); add(E.termoli + 0.05, 'flap', { vol: 0.4 });
  // 4. prêmio: a casa troca de decoração
  add(E.premio, 'select', { tono: 1.0 });
  add(E.decorata - 0.42, 'silenzio', { dur: 0.38 }); add(E.decorata - 0.4, 'riser', { dur: 0.37, vol: 0.55 });
  PROVA.forEach((_, i) => { const ti = E.decorata - 0.03 + i * VEZ; add(ti, i === PROVA.length - 1 ? 'stamp' : 'pop', { vol: i === PROVA.length - 1 ? 0.9 : 0.6, tono: 1 + i * 0.12 }); add(ti + 0.02, 'scintilla', { vol: 0.4 }); });
  add(E.decorata - 0.04, 'boom', { vol: 0.85 });
  for (let k = 0; k < 3; k++) add(E.dieci + 0.2 + k * 0.45, 'fuoco', { vol: 0.32, tono: 0.95 + k * 0.1 });
  add(E.dieci - 0.02, 'boom', { vol: 0.7 }); add(E.dieci, 'coin', { vol: 0.55 });
  // 5. Presidente: placar sobe, -108
  add(E.finita, 'fischio', { vol: 0.3, dur: 0.4 });
  for (let t = E.p9, k = 0; t < E.p9 + 0.9; t += 0.07, k++) add(t, 'tick', { vol: 0.2, tono: 0.9 + k * 0.05 });
  add(E.cento - 0.4, 'silenzio', { dur: 0.35 }); add(E.cento - 0.38, 'riser', { dur: 0.33, vol: 0.5 });
  add(E.cento - 0.04, 'boom', { vol: 0.85 }); add(E.cento - 0.03, 'stamp', { vol: 0.95 }); add(E.pres10, 'flap', { vol: 0.5 });
  // 6. domenica, 4 giorni
  add(E.domenica, 'ding', { vol: 0.5, tono: 1.0 }); add(E.ventuno, 'ding', { vol: 0.5, tono: 1.25 }); add(E.prossimo, 'flap', { vol: 0.4 });
  add(E.quattro - 0.04, 'boom', { vol: 0.75 }); add(E.quattro - 0.03, 'stamp', { vol: 0.85 });
  for (let k = 0; k < 4; k++) add(E.quattro + 0.25 + k * 0.25, 'tick', { vol: 0.4, tono: 0.8 });
  // 7. comentário e amigo
  add(T[5] + 0.08, 'tasto', { vol: 0.55 }); add(T[5] + 0.16, 'tasto', { vol: 0.45, tono: 1.1 });
  add(E.punti13 - 0.05, 'coin', { vol: 0.7 }); add(E.amico14 - 0.05, 'notifica', { vol: 0.5 });
  add(E.ancora - 0.07, 'stamp', { vol: 0.8 }); add(E.piu, 'coin', { vol: 0.55, tono: 1.2 });
  // 8. cidade → casa nova
  add(E.citta15, 'tasto', { vol: 0.6 }); add(E.casa16 - 0.1, 'pop', { vol: 0.8, tono: 0.8 }); add(E.casa16, 'scintilla', { vol: 0.5 }); add(E.mappa16, 'ding', { vol: 0.45, tono: 1.2 });
  // 9. casa brilha, link in bio, volta ao início (loop)
  add(E.brilli - 0.42, 'silenzio', { dur: 0.38 }); add(E.brilli - 0.4, 'riser', { dur: 0.37, vol: 0.55 });
  add(E.brilli - 0.04, 'boom', { vol: 0.9 }); add(E.brilli - 0.03, 'stamp', { vol: 0.95 }); add(E.brilli, 'scintilla', { vol: 0.6 }); add(E.brilli + 0.05, 'fischio', { vol: 0.3, dur: 0.6 });
  for (let k = 0; k < 2; k++) add(E.brilli + 0.4 + k * 0.5, 'fuoco', { vol: 0.3, tono: 1 + k * 0.1 });
  add(E.link - 0.1, 'pop', { vol: 0.6 }); add(E.bio, 'stamp', { vol: 0.7 }); add(E.bio + 0.1, 'pop', { vol: 0.5, tono: 1.2 });
  add(R.durata - 0.9, 'riser', { dur: 0.85, vol: 0.4 });
  return s.sort((a, b) => a.t - b.t);
}

async function preparar(roteiro) {
  R = roteiro; E = R.eventi;
  await Promise.all(['900 104px Nunito', '900 60px Nunito', '800 40px Nunito', '700 30px Nunito'].map(f => document.fonts.load(f)));
  await document.fonts.ready;
  citta = new Citta(mappa, D);
  const k = D.snap.cariche;
  casas.pres = decorare(k.presidente.conta, ['presidenza', 'fascia']);
  vinc = [decorare(R.vincitore, []), ...PROVA.map(p => decorare(R.vincitore, p))];
  // casa de exemplo do fim (sem @ real na tela): casa média da cidade, sem cargo nem decoração
  const cargos = new Set([k.presidente?.conta, ...Object.values(k.sindaci ?? {}).map(s => s.conta)]);
  const c = D.casas.filter(x => D.luoghi[x.luogo].nome === R.demo_citta && !cargos.has(x.conta) && x.livello >= 2 && x.livello <= 4).sort((a, b) => b.tot - a.tot)[0];
  if (!c) throw new Error(`sem casa de exemplo em ${R.demo_citta}`);
  demo = [decorare(c.conta, []), decorare(c.conta, ['oro', 'neon', 'corona', 'fuochi'])];
  citta.atualizar?.(true);
  // ranking real do evento
  const sp = (D.snap.speciali ?? []).find(x => x.classifica?.length);
  const cl = sp ? sp.classifica.slice(0, 4) : [];
  R.entrati = R.entrati ?? sp?.entrati ?? 0;
  $('#rank .righe').innerHTML = cl.map((x, i) => { const cs = D.porConta.get(x.conta); return `<div class="riga${i ? '' : ' primo'}"><i>${i ? i + 1 : '🏆'}</i><div><b>@${esc(x.conta)}</b><small>📍 ${esc(cs ? D.luoghi[cs.luogo].nome : '')}</small></div><span>${x.n}</span></div>`; }).join('');
  $('#facce').innerHTML = FACCE.map(e => `<i>${e}</i>`).join('');
  $('#coriandoli').innerHTML = CONF.map(c => `<i style="background:${c.cor}"></i>`).join('');
  // carimbos
  const T = TAGLI();
  stampi = [
    ['☝️ UNO <span class="g">SOLO</span>', 1040, 120, E.solo - 0.05, E.quindici - 0.05, -3],
    ['🔥 15 <span class="g">AMICI</span>', 1040, 140, E.quindici - 0.03, T[1], 3],
    ['🏆 10 GIORNI<br><span class="g">GRATIS</span>', 960, 120, E.dieci - 0.03, T[2] + (E.p8 - T[2]), -3],
    ['🔥 AMICO =<br><span class="g">ANCORA DI PIÙ</span>', 800, 100, E.ancora - 0.05, T[6], 3],
  ].map(([html, top, size, ini, fim, rot]) => {
    const el = document.createElement('div');
    el.className = 'stamp forte';
    el.style.cssText = `top:${top}px;font-size:${size}px;-webkit-text-stroke-width:${Math.round(size * 0.18)}px`;
    el.innerHTML = html;
    $('#stampi').appendChild(el);
    return [el, ini, fim, rot];
  });
  $('#piu').remove();
  // rótulos
  const V = vinc[0], topoV = t => { const pv = provaDi(t); return (pv < 0 ? V : vinc[pv + 1]).topo; };
  etichette.push({ el: novaEtichetta(`<div class="box oro"><b>🏆 @${esc(R.vincitore)}</b><em>15 AMICI PORTATI</em></div><div class="freccia"></div>`), p: V.p, y: topoV, vis: t => t >= E.termoli - 0.05 && t < T[2], ini: E.termoli - 0.05 });
  etichette.push({ el: novaEtichetta(`<div class="box oro"><b>👑 @${esc(k.presidente.conta)}</b><em>PRESIDENTE</em></div><div class="freccia"></div>`), p: casas.pres.p, y: () => casas.pres.topo, vis: t => t >= T[3] + 0.15 && t < E.p9 - 0.05, ini: T[3] + 0.15 });
  etichette.push({ el: novaEtichetta('<div class="box"><b>🏠 LA TUA CASA</b><em>NELLA TUA CITTÀ</em></div><div class="freccia"></div>'), p: demo[0].p, y: () => demo[0].topo, vis: t => t >= E.casa16 + 0.2 && t < T[7], ini: E.casa16 + 0.2 });
  etichette.push({ el: novaEtichetta('<div class="box oro"><b>✨ LA TUA CASA</b><em>COME IL VINCITORE</em></div><div class="freccia"></div>'), p: demo[1].p, y: () => demo[1].topo, vis: t => t >= E.brilli + 0.3 && t < E.link - 0.1, ini: E.brilli + 0.3 });
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
    for (const s of ['#stampi', '#fisso', '#coriandoli', '#apertura', '#facce', '#titolo', '#etichette']) $(s).style.display = 'none';
  }
  console.log(`dati ${D.snap.dati_fino} · vincitore @${R.vincitore} (${V.l.nome}, liv ${V.casa.livello}, sett ${V.casa.sett}) · presidente @${k.presidente.conta} ${k.presidente.pts} · demo @${c.conta} (${R.demo_citta}) · entrati ${R.entrati} · ranking ${cl.map(x => x.conta + ' ' + x.n).join(' / ')}`);
  quadro(0);
  return { durata: R.durata, fps: 30 };
}

iniciar().catch(e => console.error('erro ao carregar', e));
