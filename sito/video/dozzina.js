// Reel "dozzina" (reel 19): "su 25.000 case solo una dozzina brillano così" com as casas decoradas reais (Capri, Firenze,
// Sorrento), a cúpula do Presidente, a cascata dos sindaci com a faixa, a corrida da semana (Termoli × Malnate), as visitas
// por dia, uma casa sendo decorada e virando presente, a loja com o cartão e o WhatsApp, as vagas, link in bio e a chamada.
// O fim volta à casa da abertura (loop). window.preparar/quadro/suoni; tudo depende só de t.
import * as THREE from 'three';
import { carregar } from '../js/dati.js';
import { Mappa, COR_MAR } from '../js/mappa.js';
import { Citta, DIST_CIDADE, LOTE, posLote } from '../js/citta.js';
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

let D, mappa, citta, R, E, chaves, punti, nSind, etichette = [], deco = [], casas = {}, loja, corsa, demo;
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

// casa decorada de verdade (a mesma montagem do site): some do InstancedMesh da cidade e entra a versão decorada
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

// uma bolinha por comune com sindaco; acendem douradas em cascata, de norte a sul
function criarPontos() {
  const ids = new Set();
  for (const s of Object.values(D.snap.cariche.sindaci ?? {})) { const c = D.porConta.get(s.conta); if (c) ids.add(c.luogo); }
  const ls = [...ids].map(i => D.luoghi[i]);
  nSind = Object.keys(D.snap.cariche.sindaci ?? {}).length;
  const z0 = Math.min(...ls.map(l => l.z)), z1 = Math.max(...ls.map(l => l.z));
  const pos = new Float32Array(ls.length * 3), ord = new Float32Array(ls.length);
  ls.forEach((l, i) => { pos.set([l.x, mappa.altura(l.x, l.z) + 0.03, l.z], i * 3); ord[i] = clamp(0.85 * (l.z - z0) / (z1 - z0) + 0.15 * (((i * 7919) % 1000) / 1000)); });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('ord', new THREE.BufferAttribute(ord, 1));
  const mat = new THREE.ShaderMaterial({
    uniforms: { lim: { value: 0 }, escala: { value: 1920 / (2 * Math.tan(mappa.camera.fov * Math.PI / 360)) } },
    vertexShader: `
      attribute float ord; uniform float lim; uniform float escala; varying float vOro;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        float k = clamp((lim - ord) * 30.0, 0.0, 1.0);
        vOro = k;
        gl_PointSize = clamp(0.05 * escala / -mv.z, 10.0, 15.0) * (1.0 + 1.1 * sin(k * 3.1416) + 0.6 * k);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      varying float vOro;
      void main() {
        float d = length(gl_PointCoord - 0.5) * 2.0;
        if (d > 1.0) discard;
        gl_FragColor = vec4(d > 0.62 ? vec3(0.08, 0.13, 0.2) : mix(vec3(1.0), vec3(1.0, 0.79, 0.24), vOro), 1.0);
        #include <colorspace_fragment>
      }`,
  });
  const p = new THREE.Points(g, mat);
  p.frustumCulled = false; p.renderOrder = 5;
  mappa.scene.add(p);
  return p;
}

// cortes secos (flash + batida)
const TAGLI = () => [E.una2 - 0.1, E.una3 - 0.1, E.una4 - 0.1, E.e5 - 0.1, E.e7 - 0.1, E.fascia - 0.15, E.ma8 - 0.1, E.termoli - 0.1,
  E.ogni - 0.1, E.una11 - 0.1, E.e13 - 0.1, E.hai - 0.1, E.chi - 0.1, E.ma17 - 0.1, E.link - 0.1, E.scrivi - 0.1];
// noite nas cenas das casas que brilham (neon, fogos, cúpula); dia no resto
const notteIn = t => { const T = TAGLI(); return t < T[6] || (t >= T[9] && t < T[11]) || t >= T[15]; };

// ---------- câmera ----------
function montarChaves() {
  const b = D.geo.bbox, alt = b.z1 - b.z0, dP = mappa.distPais();
  const paese = { x: (b.x0 + b.x1) / 2, z: (b.z0 + b.z1) / 2 - alt * 0.07, dist: dP, az: 0, giu: 0 };
  const P = (o, k = {}) => ({ x: o.p.x, z: o.p.z, giu: 0, ...k });
  // enquadramento pela altura da casa: torres de longe e com a casa mais baixa na tela (o rótulo cabe)
  const Q = (o, az, perto = 1) => P(o, { dist: clamp(0.45 + o.h * 0.075, 0.55, 1.2) * perto, az, giu: o.h > 1.5 ? 0.28 : 0.08 });
  const [T1, T2, T3, T4, T5, T6, T7, T8, T9, T10, T11, T12, T13, T14, T15, T16] = TAGLI();
  const cena = (ini, fim, a, c) => [[ini, a], [fim - 0.01, c]];
  const { ap: A, c1, c2, c3, pres, sind } = casas;
  const L = { p: loja.pos }, az = loja.az;
  const ABRE = Q(A, -0.55, 1.08);
  const lista = [
    ...cena(0, T1, ABRE, Q(A, -0.05, 0.9)),
    ...cena(T1, T2, Q(c1, 0.5, 1.15), Q(c1, 0.95, 0.95)),
    ...cena(T2, T3, Q(c2, -0.4, 1.15), Q(c2, 0.05, 0.95)),
    ...cena(T3, T4, Q(c3, 0.6, 1.15), Q(c3, 1.05, 0.95)),
    // cúpula e feixes: de mais longe e mais alto, para caber a torre e a luz
    ...cena(T4, T5, P(pres, { dist: 1.35, az: 1.1, giu: 0.22 }), P(pres, { dist: 1.15, az: 1.6, giu: 0.22 })),
    ...cena(T5, T6, { ...paese, dist: dP * 0.86, az: 0.12 }, { ...paese, dist: dP * 1.0, az: -0.06 }),
    ...cena(T6, T7, Q(sind, 0.9, 1.0), Q(sind, 1.5, 0.82)),
    ...cena(T7, T8, { ...paese, dist: dP * 1.05, az: -0.1, giu: -0.12 }, { ...paese, dist: dP * 0.95, az: 0.05, giu: -0.12 }),
    ...cena(T8, T9, { ...paese, dist: dP * 0.8, az: 0.15, giu: -0.12 }, { ...paese, dist: dP * 0.9, az: -0.02, giu: -0.12 }),
    ...cena(T9, T10, { ...paese, dist: dP * 1.1, az: 0.2, giu: -0.16 }, { ...paese, dist: dP * 0.98, az: -0.08, giu: -0.16 }),
    ...cena(T10, T11, Q(demo.v[0], -0.3, 0.95), Q(demo.v[0], 0.45, 0.8)),
    ...cena(T11, T12, Q(demo.v[0], 1.5, 1.05), Q(demo.v[0], 2.1, 0.92)),
    ...cena(T12, T13, P(L, { dist: 0.62, az: az - 0.35, giu: 0.06 }), P(L, { dist: 0.42, az: az + 0.2, giu: 0.06 })),
    // toque e cartão: a loja fica embaixo do cartão
    ...cena(T13, T14, P(L, { dist: 0.5, az: az + 0.1, giu: -0.14 }), P(L, { dist: 0.44, az: az + 0.45, giu: -0.14 })),
    ...cena(T14, T15, P(L, { dist: 1.3, az: az + 0.8, giu: 0.1 }), P(L, { dist: 0.9, az: az + 1.3, giu: 0.1 })),
    ...cena(T15, T16, { ...paese, dist: dP * 0.95, az: 0.1 }, { ...paese, dist: dP * 1.05, az: -0.05 }),
    [T16, Q(A, -1.1, 1.5)],
    [R.durata, ABRE],
  ];
  chaves = lista.sort((x, y) => x[0] - y[0]).map(([t, k]) => ({ t, k }));
}
function camera(t) {
  let i = 0;
  while (i < chaves.length - 2 && t >= chaves[i + 1].t) i++;
  const a = chaves[i], b = chaves[Math.min(i + 1, chaves.length - 1)];
  const s = b.t > a.t ? suave(clamp((t - a.t) / (b.t - a.t))) : 1;
  const sl = a.t >= TAGLI()[15] - 0.01 ? clamp((t - a.t) / (b.t - a.t)) : s;   // volta à casa da abertura sem freada (loop)
  const A = a.k, B = b.k, l = (p, q) => p + (q - p) * sl;
  const dist = Math.exp(l(Math.log(A.dist), Math.log(B.dist)));
  const tremor = [[E.dozzina, 0.4], [E.capri, 0.25], [E.firenze, 0.25], [E.sorrento, 0.25], [E.cupola, 0.3], [E.sindaci7, 0.4], [E.pari, 0.35], [E.settemila, 0.4], [E.decorata, 0.4], [E.pochi, 0.35]]
    .reduce((v, [ti, d]) => v + (t >= ti && t < ti + d ? 0.012 * (1 - (t - ti) / d) * Math.sin((t - ti) * 70) : 0), 0);
  const soco = [E.dozzina, E.sindaci7, E.decorata].reduce((v, ti) => v + (t >= ti && t < ti + 0.5 ? 0.1 * Math.sin(Math.PI * (t - ti) / 0.5) : 0), 0);
  const az = l(A.az, B.az) + tremor, giu = l(A.giu, B.giu), x = l(A.x, B.x), z = l(A.z, B.z);
  mappa.az = az; mappa.dist = dist * (1 + tremor - soco);
  mappa.alvo.x = x - Math.sin(az) * giu * dist;
  mappa.alvo.z = z - Math.cos(az) * giu * dist;
  mappa.atualizarCamera();
  return dist;
}

// ---------- textos ----------
function projetar(x, y, z) { const p = new THREE.Vector3(x, y, z).project(mappa.camera); return { x: (p.x + 1) / 2 * 1080, y: (1 - p.y) / 2 * 1920, ok: p.z < 1 && p.z > -1 }; }
function novaEtichetta(html) {
  const el = document.createElement('div');
  el.className = 'cartello'; el.innerHTML = html;
  $('#etichette').appendChild(el);
  return el;
}
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
const batida = (t, ti) => (t >= ti && t < ti + 0.35 ? 1 + 0.25 * Math.sin(Math.PI * (t - ti) / 0.35) : 1);
// pontinho do toque: segue um elemento da tela (ou um ponto 3D)
function tocco(t, ini, alvo) {
  const tc = $('#tocco'), k = fase(t, ini, 0.45);
  if (k <= 0 || k >= 1) return false;
  tc.style.left = `${alvo.x}px`; tc.style.top = `${alvo.y}px`;
  tc.style.opacity = String(1 - k); tc.style.transform = `scale(${0.4 + k})`;
  return true;
}
// reações subindo da casa decorada ("la notano tutti")
const EMO = ['😍', '👀', '🔥', '❤️', '✨', '👏', '😮', '💛'];
const REAZ = Array.from({ length: 18 }, (_, i) => ({ atraso: (i * 0.09) % 1.1, dx: ((i * 137) % 520) - 260, sobe: 520 + ((i * 71) % 380), giro: ((i * 53) % 50) - 25 }));
function reazioni(t, base) {
  [...$('#reazioni').children].forEach((el, i) => {
    const r = REAZ[i], dt = t - E.notano - r.atraso, vis = base && dt > 0 && dt < 1.6 && t < TAGLI()[10];
    el.style.opacity = vis ? String(1 - fase(dt, 1.1, 0.5)) : '0';
    if (vis) el.style.transform = `translate(${base.x - 42 + r.dx * suave(fase(dt, 0, 0.6))}px, ${base.y - 60 - r.sobe * suave(fase(dt, 0, 1.6))}px) rotate(${r.giro}deg) scale(${0.6 + 0.6 * ressalto(fase(dt, 0, 0.3))})`;
  });
}

function quadro(t) {
  const dist = camera(t);
  const [T1, T2, T3, T4, T5, T6, T7, T8, T9, T10, T11, T12, T13, T14, T15, T16] = TAGLI();
  punti.visible = dist > DIST_CIDADE * 0.55 && t >= T5 && t < T10;
  punti.material.uniforms.lim.value = suave(fase(t, E.quattromila - 0.1, E.sindaci7 + 0.2 - E.quattromila));
  const kn = notteIn(t) ? 1 : 0;
  ceu(kn);
  $('#vignetta').style.opacity = String(kn);
  // a casa de demonstração: normal → decorada → presente
  const [vN, vD, vR] = demo.v;
  vN.o.g.visible = t < E.decorata - 0.03; vD.o.g.visible = t >= E.decorata - 0.03 && t < T11; vR.o.g.visible = t >= T11;
  for (const o of deco) o.anima(t * 1000);
  const fl = Math.max(...TAGLI().map(tc => (t >= tc ? 0.75 * (1 - fase(t, tc, 0.22)) : 0)), ...[E.dozzina, E.sindaci7, E.decorata].map(ti => (t >= ti ? 0.6 * (1 - fase(t, ti, 0.3)) : 0)));
  $('#velo').style.opacity = String(fl);
  $('#velo').style.background = (t >= E.dozzina && t < E.dozzina + 0.3) || (t >= E.decorata && t < E.decorata + 0.3) ? '#FFC93C' : '#FFFFFF';
  // abertura: contador de casas, depois "solo 12"
  const ab = $('#apertura'), nCase = D.snap.case.length;
  ab.style.opacity = t < E.dozzina - 0.05 || t >= E.perche - 0.05 ? '1' : '0';
  ab.querySelector('.n').textContent = `🏠 ${num(t >= E.perche - 0.05 ? nCase : conta(t, E.venticinque, E.italia + 0.3 - E.venticinque, nCase, 20000))}`;
  ab.querySelector('.n').style.transform = `scale(${batida(t, E.italia + 0.3)})`;
  carimbo($('#solo'), t, E.dozzina - 0.05, T1, -3);
  $('#solo .s').style.opacity = t >= E.brillano - 0.05 ? '1' : '0';
  // títulos por cena
  const tit = $('#titolo');
  const cenas = [
    [T1, T2, () => ['📍 CAPRI', '']], [T2, T3, () => ['📍 FIRENZE', '']], [T3, T4, () => ['📍 SORRENTO', '']],
    [T4, T5, () => (t < E.cupola - 0.05 ? ['🏛️ DA IERI…', ''] : ["👑 CUPOLA D'ORO", 'PER IL PRESIDENTE'])],
    [T5, T6, () => [`🏛️ ${num(nSind * punti.material.uniforms.lim.value)}`, 'SINDACI ELETTI']],
    [T6, T7, () => ['FASCIA TRICOLORE', 'PER OGNI SINDACO']],
    [T10, T11, () => (t < E.decorata - 0.05 ? ['🏠 UNA CASA…', ''] : ['✨ CASA DECORATA', t >= E.notano - 0.05 ? 'LA NOTANO TUTTI 👀' : ''])],
    [T11, T12, () => ['🎁 REGALALA', 'A UN AMICO']],
    [T12, T13, () => ['🏪 HAI UN NEGOZIO?', t >= E.mettilo - 0.05 ? 'METTILO SULLA MAPPA' : '']],
  ];
  const cn = cenas.find(([a, b]) => t >= a && t < b);
  if (cn) {
    const [t1, t2] = cn[2]();
    const ini = cn[0] === T10 && t >= E.decorata - 0.05 ? E.decorata - 0.05 : cn[0];
    mostrar(tit, t, ini, cn[0] === T10 && t < E.decorata - 0.05 ? E.decorata - 0.05 : cn[1], 20);
    if (tit.querySelector('.t1').textContent !== t1) tit.querySelector('.t1').textContent = t1;
    tit.querySelector('.t2').textContent = t2;
    tit.querySelector('.t1').style.transform = `scale(${batida(t, E.sindaci7)})`;
  } else tit.style.opacity = '0';
  // rótulos das casas
  for (const e of etichette) {
    const v = e.vis(t);
    if (!v) { e.el.style.opacity = '0'; continue; }
    const p = projetar(e.p.x, e.y, e.p.z);
    const s = e.ini(t) < 0 ? 1 : ressalto(fase(t, e.ini(t), 0.32));
    e.el.style.opacity = p.ok ? '1' : '0';
    e.el.style.transform = `translate(${p.x - e.el.offsetWidth / 2}px, ${p.y - e.el.offsetHeight}px) scale(${s})`;
  }
  // corrida da semana
  const cl = $('#classifica');
  mostrar(cl, t, T7, T9);
  const righe = cl.querySelectorAll('.riga');
  righe.forEach((el, i) => { pulo(el, t, E.corsa + i * 0.18); el.classList.toggle('su', i > 0 && t >= E.termoli - 0.05); });
  righe.forEach((el, i) => { if (i > 0) el.style.transform += ` scale(${batida(t, i === 1 ? E.termoli : E.malnate)})`; });
  pulo(cl.querySelector('.diff'), t, E.quasi - 0.05);
  pulo(cl.querySelector('.quando'), t, E.pari + 0.15);
  // visitas
  const vi = $('#visite');
  mostrar(vi, t, T9, T10, 40);
  vi.querySelector('.n').textContent = `${num(conta(t, E.settemila - 0.1, 0.6, R.visite_giorno, 0))}+`;
  vi.querySelector('.n').style.transform = `scale(${batida(t, E.settemila + 0.5)})`;
  pulo(vi.querySelector('.s'), t, E.persone - 0.05);
  // reações e preço da decoração
  const pD = projetar(vD.p.x, vD.topo, vD.p.z);
  reazioni(t, t >= T10 && t < T11 ? pD : null);
  mostrar($('#chip'), t, E.sopra - 0.05, T12, 20);
  // loja: toque, cartão e WhatsApp
  const pL = projetar(loja.pos.x, loja.pos.y + LOTE * 0.4, loja.pos.z);
  const tc1 = t >= T13 && tocco(t, T13 + 0.05, pL);
  const sc = $('#scheda');
  mostrar(sc, t, E.trova - 0.05, T14);
  const bw = sc.querySelector('.wa');
  bw.classList.toggle('lampo', t >= E.scrive && t < T14);
  bw.style.transform = `scale(${batida(t, E.whatsapp)})`;
  const tc2 = !tc1 && t >= E.whatsapp - 0.1 && t < T14 && tocco(t, E.whatsapp - 0.1, (() => { const r = bw.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })());
  if (!tc1 && !tc2) $('#tocco').style.opacity = '0';
  pulo(sc.querySelector('.msg'), t, E.tocco - 0.05);
  // vagas, link, chamada final
  mostrar($('#posti'), t, T14, T15, 40);
  [...$('#posti .slot').children].forEach((el, i) => pulo(el, t, E.posti + 0.1 + i * 0.12, t >= E.pochi ? `rotate(${5 * Math.sin(t * 12 + i)}deg)` : ''));
  pulo($('#posti .s'), t, E.pochi - 0.05);
  mostrar($('#link'), t, T15, T16, 40);
  pulo($('#link .b'), t, E.bio + 0.1);
  const cta = $('#cta').children;
  mostrar(cta[0], t, T16, E.perche - 0.05, 20);
  mostrar(cta[1], t, E.manda - 0.1, E.perche - 0.05, 20);
  legenda(t);
  mappa.renderer.render(mappa.scene, mappa.camera);
  return true;
}

// efeitos sonoros: um por acontecimento na tela; impactos com silêncio antes
function suoni() {
  const s = [], add = (t, tipo, extra = {}) => s.push({ t, tipo, vol: 0.8, ...extra });
  const entra = (t, forte = false) => { add(t - 0.03, 'pop', { vol: forte ? 0.75 : 0.5 }); if (forte) add(t + 0.02, 'whoosh', { vol: 0.35, dur: 0.4 }); };
  const [T1, T2, T3, T4, T5, T6, T7, T8, T9, T10, T11, T12, T13, T14, T15, T16] = TAGLI();
  // 1. contador de casas e "solo 12"
  add(0, 'stamp', { vol: 0.55 }); add(0.03, 'scintilla', { vol: 0.4 });
  for (let t = E.venticinque, k = 0; t < E.italia + 0.3; t += 0.08, k++) add(t, 'tick', { vol: 0.16, tono: 0.9 + 0.5 * k * 0.08 / (E.italia + 0.3 - E.venticinque) });
  add(E.italia + 0.3, 'pop', { vol: 0.55, tono: 1.15 });
  add(E.dozzina - 0.4, 'silenzio', { dur: 0.36 }); add(E.dozzina - 0.38, 'riser', { dur: 0.34, vol: 0.5 });
  add(E.dozzina - 0.06, 'boom', { vol: 0.9 }); add(E.dozzina - 0.05, 'stamp', { vol: 1 }); add(E.brillano, 'scintilla', { vol: 0.55 }); add(E.cosi, 'ding', { vol: 0.45, tono: 1.3 });
  for (let k = 0; k < 4; k++) add(E.cosi + 0.2 + k * 0.5, 'fuoco', { vol: 0.32, tono: 0.9 + (k % 3) * 0.12 });
  TAGLI().forEach(tc => { add(tc - 0.12, 'whoosh', { vol: 0.42, dur: 0.3 }); add(tc - 0.01, 'boom', { vol: 0.2 }); add(tc, 'pop', { vol: 0.34, tono: 0.7 }); });
  // 2. Capri, Firenze, Sorrento
  [[T1, E.capri], [T2, E.firenze], [T3, E.sorrento]].forEach(([tc, tn], i) => { entra(tc + 0.08, true); add(tn, 'ding', { vol: 0.5, tono: 1.0 + i * 0.15 }); add(tn + 0.05, 'scintilla', { vol: 0.4 }); });
  // 3. Presidente: cúpula e luz; cascata dos sindaci; faixa
  entra(T4 + 0.08, true); add(E.presidente, 'flap', { vol: 0.55 }); add(E.cupola - 0.02, 'stamp', { vol: 0.8 }); add(E.oro, 'scintilla', { vol: 0.55 }); add(E.oro + 0.1, 'ding', { vol: 0.45, tono: 1.4 });
  add(T5 + 0.05, 'vento', { vol: 0.25, dur: 1.2 });
  for (let t = E.quattromila - 0.1, k = 0; t < E.sindaci7 + 0.15; t += 0.06, k++) add(t, 'pop', { vol: 0.12 + 0.12 * fase(t, E.quattromila, E.sindaci7 - E.quattromila), tono: 0.8 + ((k * 7) % 9) / 14 });
  add(E.sindaci7 - 0.02, 'boom', { vol: 0.8 }); add(E.sindaci7, 'stamp', { vol: 0.9 });
  entra(T6 + 0.08, true); add(E.tricolore, 'flap', { vol: 0.6 }); add(E.tricolore + 0.1, 'select', { tono: 1.0 });
  // 4. corrida da semana
  entra(T7 + 0.05, true);
  for (let i = 0; i < 3; i++) add(E.corsa + i * 0.18, 'pop', { vol: 0.5, tono: 0.9 + i * 0.12 });
  add(E.termoli, 'ding', { vol: 0.5, tono: 1.0 }); add(E.malnate, 'ding', { vol: 0.5, tono: 1.15 });
  add(E.quasi - 0.05, 'riser', { dur: 0.35, vol: 0.45 }); add(E.pari - 0.02, 'stamp', { vol: 0.85 }); add(E.pari + 0.15, 'tick', { vol: 0.45, tono: 0.8 });
  // 5. visitas
  entra(T9 + 0.05, true);
  for (let t = E.settemila - 0.1, k = 0; t < E.settemila + 0.5; t += 0.06, k++) add(t, 'tick', { vol: 0.18, tono: 0.9 + 0.6 * k / 10 });
  add(E.settemila + 0.5, 'stamp', { vol: 0.85 }); add(E.settemila + 0.52, 'coin', { vol: 0.5 }); add(E.persone - 0.05, 'pop', { vol: 0.5, tono: 1.1 }); add(E.mappa10, 'whoosh', { vol: 0.3, dur: 0.4 });
  // 6. casa normal → decorada → reações → presente
  entra(T10 + 0.08, true);
  add(E.decorata - 0.42, 'silenzio', { dur: 0.38 }); add(E.decorata - 0.4, 'riser', { dur: 0.37, vol: 0.55 });
  add(E.decorata - 0.04, 'boom', { vol: 0.9 }); add(E.decorata - 0.03, 'stamp', { vol: 0.95 }); add(E.decorata, 'scintilla', { vol: 0.6 }); add(E.decorata + 0.05, 'fischio', { vol: 0.3, dur: 0.6 });
  for (let k = 0; k < 3; k++) add(E.decorata + 0.4 + k * 0.5, 'fuoco', { vol: 0.35, tono: 0.95 + k * 0.1 });
  for (let i = 0; i < 9; i++) add(E.notano + i * 0.12, 'pop', { vol: 0.3, tono: 1.0 + (i % 4) * 0.12 });
  entra(T11 + 0.08, true); add(E.regalarla, 'flap', { vol: 0.5 }); add(E.amico, 'ding', { vol: 0.45, tono: 1.25 }); add(E.nome - 0.1, 'pop', { vol: 0.6, tono: 1.1 }); add(E.sopra - 0.05, 'coin', { vol: 0.55 });
  // 7. loja: toque, cartão, WhatsApp
  entra(T12 + 0.08, true); add(E.negozio14, 'ding', { vol: 0.45, tono: 1.0 }); add(E.mettilo - 0.05, 'pop', { vol: 0.5, tono: 1.15 });
  add(T13 + 0.05, 'tap', { vol: 0.8 }); add(E.trova - 0.05, 'pop', { vol: 0.65 }); add(E.trova, 'whoosh', { vol: 0.3, dur: 0.35 });
  add(E.scrive, 'select', { tono: 1.1 }); add(E.whatsapp - 0.1, 'tap', { vol: 0.8 }); add(E.tocco - 0.05, 'notifica', { vol: 0.65 });
  // 8. vagas
  entra(T14 + 0.05, true);
  for (let i = 0; i < 6; i++) add(E.posti + 0.1 + i * 0.12, 'tick', { vol: 0.45, tono: 0.8 + i * 0.05 });
  add(E.pochi - 0.05, 'stamp', { vol: 0.8 });
  // 9. link in bio, chamada e volta à abertura (loop)
  entra(T15 + 0.05, true); add(E.bio, 'stamp', { vol: 0.7 }); add(E.bio + 0.1, 'pop', { vol: 0.5, tono: 1.2 });
  entra(T16 + 0.05); add(E.citta19, 'tasto', { vol: 0.6 }); add(E.manda - 0.1, 'whoosh', { vol: 0.4, dur: 0.5 }); add(E.negozio20, 'notifica', { vol: 0.5 });
  add(E.perche - 0.3, 'riser', { dur: R.durata - E.perche + 0.3, vol: 0.4 });
  return s.sort((a, b) => a.t - b.t);
}

async function preparar(roteiro) {
  R = roteiro; E = R.eventi;
  await Promise.all(['900 104px Nunito', '900 60px Nunito', '800 40px Nunito', '700 30px Nunito'].map(f => document.fonts.load(f)));
  await document.fonts.ready;
  citta = new Citta(mappa, D);
  const k = D.snap.cariche, extraDi = c => R.decori.find(d => d[0] === c)?.[1] ?? ['neon'];
  casas.ap = decorare(R.apertura, extraDi(R.apertura));
  [casas.c1, casas.c2, casas.c3] = R.citta.map(([, c]) => decorare(c, extraDi(c)));
  casas.pres = decorare(R.presidente, ['presidenza', 'fascia']);
  casas.sind = decorare(R.sindaco_esempio, ['fascia']);
  // casa de demonstração (sem @ na tela): casa média da cidade, sem cargo e sem decoração
  const cargos = new Set([k.presidente?.conta, ...Object.values(k.sindaci ?? {}).map(s => s.conta), ...R.decori.map(d => d[0])]);
  const cand = D.casas.filter(c => D.luoghi[c.luogo].nome === R.demo_citta && !cargos.has(c.conta) && c.livello >= 2 && c.livello <= 4).sort((a, b) => b.tot - a.tot);
  if (!cand.length) throw new Error(`sem casa de demonstração em ${R.demo_citta}`);
  const dc = cand[0].conta;
  demo = { conta: dc, v: [decorare(dc, []), decorare(dc, ['oro', 'neon', 'corona', 'fuochi']), decorare(dc, ['palloncini', 'neon', 'fuochi'])] };
  citta.atualizar?.(true);
  punti = criarPontos();
  // loja
  const c = D.commerci.find(x => x.nome === R.negozio);
  if (!c) throw new Error(`${R.negozio} não está no mapa`);
  loja = { c, pos: citta.posCommercio(c), az: posLote(c.lote).rot === 0 ? 0 : Math.PI };
  // corrida: os 3 primeiros da semana
  corsa = [...D.casas].sort((a, b) => b.sett - a.sett).slice(0, 3);
  const righe = corsa.map((x, i) => `<div class="riga"><i>${i + 1}</i><div><b>${x.conta === k.presidente?.conta ? '👑 ' : ''}@${esc(x.conta)}</b><small>📍 ${esc(D.luoghi[x.luogo].nome)}</small></div><span>${num(x.sett)}</span></div>`);
  righe.splice(3, 0, `<div class="diff"><b>⚔️ SOLO ${num(corsa[1].sett - corsa[2].sett)} PUNTI</b></div>`);
  $('#classifica .righe').innerHTML = righe.join('');
  R.visite_giorno = Math.floor(R.giorni.slice(-3).reduce((s, g) => s + g[1], 0) / 3 / 1000) * 1000;
  // rótulos
  const [T1, T2, T3, T4, T5, T6, T7, , , T10, T11, T12, T13, , , T16] = TAGLI();
  const nomeL = o => esc(o.l.nome).toUpperCase();
  const rot = (o, html, vis, ini) => etichette.push({ el: novaEtichetta(html), p: o.p, y: o.topo, vis, ini });
  const vip = o => `<div class="box oro"><b>✨ @${esc(o.casa.conta)}</b><span>📍 ${nomeL(o)}</span></div><div class="freccia"></div>`;
  rot(casas.ap, vip(casas.ap), t => t < T1 || t >= E.perche - 0.05, t => (t < T1 ? -1 : E.perche - 0.05));
  [[casas.c1, T1, T2], [casas.c2, T2, T3], [casas.c3, T3, T4]].forEach(([o, a, b]) => rot(o, vip(o), t => t >= a && t < b, () => a + 0.1));
  rot(casas.pres, `<div class="box oro"><b>👑 @${esc(R.presidente)}</b><em>PRESIDENTE DEL CONSIGLIO</em></div><div class="freccia"></div>`, t => t >= E.presidente - 0.05 && t < T5, () => E.presidente - 0.05);
  rot(casas.sind, `<div class="box oro"><b>🏛️ @${esc(R.sindaco_esempio)}</b><span>SINDACO DI ${nomeL(casas.sind)}</span></div><div class="freccia"></div>`, t => t >= T6 && t < T7, () => T6 + 0.1);
  const vR = demo.v[2];
  rot(vR, `<div class="box"><b>🏠 @il_tuo_amico</b><em>🎁 da @il_tuo_nome</em></div><div class="freccia"></div>`, t => t >= E.nome - 0.1 && t < T12, () => E.nome - 0.1);
  etichette.push({ el: novaEtichetta(`<div class="box"><b>🏪 ${esc(c.nome)}</b><span>📍 ${esc(c.luogo.nome)}</span></div><div class="freccia"></div>`), p: loja.pos, y: loja.pos.y + LOTE * 1.15, vis: t => t >= T12 && t < T13, ini: () => T12 + 0.1 });
  // cartão da loja, com os dados reais do mapa
  const sc = $('#scheda');
  sc.querySelector('.logo').style.backgroundImage = c.logo ? `url('${c.logo}')` : '';
  sc.querySelector('.testa').style.background = c.colore;
  sc.querySelector('.testa b').textContent = c.nome;
  sc.querySelector('.corpo p').textContent = c.descrizione;
  sc.querySelector('.corpo small').textContent = `📍 ${c.luogo.nome}${c.tipo ? ` · ${c.tipo}` : ''}`;
  $('#solo .n .g').textContent = String(R.decori.length);
  $('#reazioni').innerHTML = REAZ.map((_, i) => `<i>${EMO[i % EMO.length]}</i>`).join('');
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
    $('#apertura').style.display = 'none';
    $('#fisso').style.display = 'none';
  }
  console.log(`dati ${D.snap.dati_fino} · case ${D.snap.case.length} · decorate ${R.decori.length} · apertura @${R.apertura} (${casas.ap.l.nome}, liv ${casas.ap.casa.livello}) · ${R.citta.map(([n], i) => `${n} liv ${casas['c' + (i + 1)].casa.livello}`).join(' · ')} · presidente liv ${casas.pres.casa.livello} · sindaci ${nSind} · demo @${dc} liv ${demo.v[0].casa.livello} · corsa ${corsa.map(x => `${x.conta} ${x.sett}`).join(' / ')} · visite/g ${R.visite_giorno} · loja ${c.nome} (${c.luogo.nome})`);
  quadro(0);
  return { durata: R.durata, fps: 30 };
}

iniciar().catch(e => console.error('erro ao carregar', e));
