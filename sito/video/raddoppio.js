// Reel "raddoppio" (reel 13) com dados reais: 1 milhão de visualizações em menos de 7 dias, as casas novas das
// últimas 24 h (as cidades acendem), as casas decoradas de 3 para 8 (@ reais, duas em 3D), os pedidos por mais vagas,
// as vagas dobradas de uma cidade real, os jogos dentro da casa (prévia) e a contagem para a eleição.
// Usa o mesmo decori.js do site. window.preparar/quadro/suoni; tudo depende só de t.
import * as THREE from 'three';
import { carregar } from '../js/dati.js';
import { Mappa } from '../js/mappa.js';
import { Citta, DIST_CIDADE, LOTE, posLote } from '../js/citta.js';
import { ALTURA_NIVEL } from '../js/modelli.js';
import { Decori, SQUADRE } from '../js/decori.js';

const $ = s => document.querySelector(s);
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const suave = s => (s < 0.5 ? 4 * s * s * s : 1 - Math.pow(-2 * s + 2, 3) / 2);
const ressalto = s => { const c = 1.9; return s <= 0 ? 0 : s >= 1 ? 1 : 1 + (c + 1) * Math.pow(s - 1, 3) + c * Math.pow(s - 1, 2); };
const fase = (t, ini, dur) => clamp((t - ini) / dur);
const esc = s => String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
const num = n => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
const conta = (t, ini, dur, v, de = 0) => de + (v - de) * (1 - Math.pow(1 - fase(t, ini, dur), 3));

let D, mappa, citta, decori, R, E, chaves, punti, totale, nIeri, lim0, scene, etichette = [], fine, cfgNegozio;
let deco, casaGioco, posGioco, presi, tot;
// pedidos que chegaram por mensagem e comentário (sem @: são vários, resumidos)
const RICHIESTE = [
  ['Più posti a Napoli! 🙏', 0], ['A Roma è già tutto pieno 😭', 1], ['Voglio il mio negozio a Bari!', 0],
  ['Fate più spazio! 🏪', 1], ['Milano è piena… 😩', 0], ['Un cartellone a Palermo? 📣', 1],
];

async function iniciar() {
  D = await carregar('video');
  totale = D.casas.length;
  mappa = new Mappa($('#mappa'), D.geo, D.rilievo, D.imagem, { gravacao: true });
  window.preparar = preparar;
  window.quadro = quadro;
  window.suoni = suoni;
}

// uma bolinha por cidade (3+ casas); as que ganharam casa nas últimas 24 h dão um pulo e ficam douradas;
// "onda" acende todas as cidades de oeste para leste ("in ogni città")
function criarPontos() {
  const ordem = D.casas.map((c, i) => i).sort((a, b) => D.casas[a].ts - D.casas[b].ts);
  const rankCasa = new Float32Array(D.casas.length);
  ordem.forEach((i, k) => { rankCasa[i] = (k + 1) / ordem.length; });
  const n = D.luoghi.length, rank = new Float32Array(n), ult = new Float32Array(n), pos = new Float32Array(n * 3);
  const b = D.geo.bbox;
  D.luoghi.forEach((l, i) => {
    const rs = l.casas.map(c => rankCasa[c]).sort((a, c) => a - c);
    rank[i] = rs.length >= 3 ? rs[2] : 2;
    ult[i] = rs.at(-1) ?? 2;
    pos.set([l.x, mappa.altura(l.x, l.z) + 0.03, l.z], i * 3);
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('ord', new THREE.BufferAttribute(rank, 1));
  g.setAttribute('ult', new THREE.BufferAttribute(ult, 1));
  const mat = new THREE.ShaderMaterial({
    uniforms: { lim: { value: 0 }, lim0: { value: 0 }, oro: { value: 0 }, onda: { value: -1 }, x0: { value: b.x0 }, w: { value: b.x1 - b.x0 }, escala: { value: 1920 / (2 * Math.tan(mappa.camera.fov * Math.PI / 360)) } },
    vertexShader: `
      attribute float ord; attribute float ult; uniform float lim; uniform float lim0; uniform float oro; uniform float onda; uniform float x0; uniform float w; uniform float escala; varying float vNovo;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        float k = clamp((lim - ord) * 40.0, 0.0, 1.0);
        float pop = k < 1.0 ? k * (1.0 + 0.6 * sin(k * 3.1416)) : 1.0;
        float nuova = (ult > lim0 && lim >= ult) ? 1.0 : 0.0;
        float k2 = clamp((lim - ult) * 90.0, 0.0, 1.0);
        float pop2 = 1.0 + nuova * (1.3 * sin(k2 * 3.1416) + 0.45 * oro);
        float fo = onda < 0.0 ? 0.0 : clamp(onda * 2.2 - (position.x - x0) / w, 0.0, 1.0);
        float pop3 = 1.0 + 0.9 * sin(clamp(fo * 2.0, 0.0, 1.0) * 3.1416);
        vNovo = max(nuova * oro, fo > 0.0 ? 1.0 : 0.0);
        gl_PointSize = ord > lim ? 0.0 : clamp(0.05 * escala / -mv.z, 12.0, 17.0) * pop * pop2 * pop3;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      varying float vNovo;
      void main() {
        float d = length(gl_PointCoord - 0.5) * 2.0;
        if (d > 1.0) discard;
        gl_FragColor = vec4(d > 0.62 ? vec3(0.08, 0.13, 0.2) : mix(vec3(1.0), vec3(1.0, 0.79, 0.24), vNovo), 1.0);
        #include <colorspace_fragment>
      }`,
  });
  const p = new THREE.Points(g, mat);
  p.frustumCulled = false; p.renderOrder = 5;
  mappa.scene.add(p);
  return p;
}
const tRampa = () => E.nuove + 0.3;
const limite = t => (t < E.oltre ? lim0 : lim0 + (1 - lim0) * suave(fase(t, E.oltre, tRampa() - E.oltre)));
const nuoveOra = t => (totale - nIeri) * suave(fase(t, E.mille - 0.05, tRampa() - E.mille + 0.05));
const taglio1 = () => E.dec0 - 0.08, taglio2 = () => E.oggi - 0.05, taglio3 = () => E.presto - 0.12, taglio4 = () => E.ora - 0.1;
const TAGLI = () => [taglio1(), taglio2(), taglio4(), taglio3()];

// ---------- as casas decoradas em 3D ----------
const stato = new Map();
function decorazioni(t) {
  const [a, b] = R.vetrina3d.map(i => deco[i]), voglio = new Map();
  if (t >= E.dec0) voglio.set(a, { squadra: a.x.squadra, extra: t >= E.decorate ? a.x.extra : [] });
  if (t >= E.oggi) voglio.set(b, { squadra: b.x.squadra, extra: b.x.extra });
  for (const d of [a, b]) {
    const s = voglio.get(d) ?? { squadra: null, extra: [] }, k = JSON.stringify(s);
    if (stato.get(d) === k) continue;
    stato.set(d, k);
    decori.disegna(d.casa, { squadra: s.squadra, extra: new Set(s.extra) });
  }
  for (const x of decori.attive.values()) x.anima(t * 1000);
}

// ---------- câmera ----------
function montarChaves() {
  const b = D.geo.bbox, alt = b.z1 - b.z0, dP = mappa.distPais();
  const paese = { x: (b.x0 + b.x1) / 2, z: (b.z0 + b.z1) / 2 - alt * 0.07, dist: dP, az: 0, giu: 0 };
  const P = (o, k = {}) => ({ x: o.x, z: o.z, ...k });
  const azF = lote => (posLote(lote).rot === 0 ? 0 : Math.PI);   // de frente para a porta
  const [a, c] = R.vetrina3d.map(i => deco[i]), aa = azF(a.casa.lote), ac = azF(c.casa.lote), ag = azF(casaGioco.lote);
  const lista = [
    [0, { ...paese, dist: dP * 1.12 }],
    [E.milione, { ...paese, dist: dP * 1.02 }],
    [E.solo, { ...paese, dist: dP * 1.0 }],
    [tRampa() + 0.3, { ...paese, dist: dP * 0.93 }],
    // cortes secos entre lugares distantes (voar rente ao chão vira um borrão verde)
    [taglio1() - 0.01, { ...paese, dist: dP * 0.92 }],
    [taglio1(), P(a.pos, { dist: 0.62, az: aa + 0.2, giu: 0.06 })],
    [E.decorate, P(a.pos, { dist: 0.4, az: aa + 0.4, giu: 0.06 })],
    [taglio2() - 0.01, P(a.pos, { dist: 0.42, az: aa + 0.9, giu: -0.06 })],
    [taglio2(), P(c.pos, { dist: 0.5, az: ac - 0.3, giu: -0.08 })],
    [taglio4() - 0.01, P(c.pos, { dist: 0.44, az: ac + 0.25, giu: -0.08 })],
    [taglio4(), { ...paese, dist: dP * 0.9, az: 0, giu: 0 }],
    [E.tanti, { ...paese, dist: dP * 0.98 }],
    [E.deciso, { ...paese, dist: dP * 0.96 }],
    [E.ogni - 0.2, { ...paese, dist: dP * 0.95 }],
    [taglio3() - 0.01, { ...paese, dist: dP * 0.9 }],
    [taglio3(), P(posGioco, { dist: 0.75, az: ag - 0.4, giu: 0.04 })],
    [E.giochi, P(posGioco, { dist: 0.42, az: ag - 0.1, giu: 0.02 })],
    [E.casa, P(posGioco, { dist: 0.24, az: ag + 0.1, giu: 0 })],
    [E.punti + 0.5, P(posGioco, { dist: 0.21, az: ag + 0.3, giu: 0 })],
    [E.domenica + 0.3, { ...paese, dist: dP * 0.98, az: 0, giu: 0 }],
    [E.scrivi, { ...paese, dist: dP * 0.97 }],
    [R.durata, { ...paese, dist: dP * 1.05 }],
  ];
  let ant = {};
  chaves = lista.sort((x, y) => x[0] - y[0]).map(([t, k]) => { ant = { ...ant, ...k }; return { t, k: { ...ant } }; });
}
function camera(t) {
  let i = 0;
  while (i < chaves.length - 2 && t >= chaves[i + 1].t) i++;
  const a = chaves[i], b = chaves[Math.min(i + 1, chaves.length - 1)];
  const s = b.t > a.t ? suave(clamp((t - a.t) / (b.t - a.t))) : 1;
  const A = a.k, B = b.k, l = (p, q) => p + (q - p) * s;
  const dist = Math.exp(l(Math.log(A.dist), Math.log(B.dist)));
  const dxz = Math.hypot(B.x - A.x, B.z - A.z);
  const fecha = B.dist < A.dist;
  const sxz = dxz > 20 ? (fecha ? suave(clamp((t - a.t) / ((b.t - a.t) * 0.55))) : suave(clamp((t - a.t - (b.t - a.t) * 0.45) / ((b.t - a.t) * 0.55)))) : s;
  const tremor = [[E.milione, 0.45], [E.mille, 0.35], [E.otto, 0.3], [E.raddoppiamo, 0.45], [E.presto, 0.3]].reduce((v, [ti, dd]) => v + (t >= ti && t < ti + dd ? 0.013 * (1 - (t - ti) / dd) * Math.sin((t - ti) * 70) : 0), 0);
  const az = l(A.az, B.az) + tremor, giu = l(A.giu, B.giu), x = A.x + (B.x - A.x) * sxz, z = A.z + (B.z - A.z) * sxz;
  mappa.az = az; mappa.dist = dist * (1 + tremor);
  mappa.alvo.x = x - Math.sin(az) * giu * dist;
  mappa.alvo.z = z - Math.cos(az) * giu * dist;
  mappa.atualizarCamera();
  return dist;
}

// ---------- textos ----------
function projetar(x, y, z) { const p = new THREE.Vector3(x, y, z).project(mappa.camera); return { x: (p.x + 1) / 2 * 1080, y: (1 - p.y) / 2 * 1920, ok: p.z < 1 && p.z > -1 }; }
function novaEtichetta(html, cls = 'cartello') {
  const el = document.createElement('div');
  el.className = cls; el.innerHTML = html;
  $('#etichette').appendChild(el);
  return el;
}
function legenda(t) {
  const f = R.frasi.find(x => t >= x.ini && t < x.fim);
  const html = f && !R.copertina ? f.linee.map(l => l.filter(w => t >= w[1] && w[0]).map(w => w[2] ? `<span class="g">${esc(w[0])}</span>` : esc(w[0])).join(' ')).filter(Boolean).join('<br>') : '';
  const el = $('#sott'); if (el.innerHTML !== html) el.innerHTML = html;
}
function mostrar(el, t, ini, fim, sobe = 30) {
  const ent = ressalto(fase(t, ini, 0.32)), sai = fase(t, fim - 0.25, 0.25), vis = t >= ini && t < fim;
  el.style.opacity = vis ? String(1 - sai) : '0';
  if (vis) el.style.transform = `translateY(${(1 - Math.min(1, ent)) * sobe - sai * 40}px) scale(${0.85 + 0.15 * ent})`;
}
function chip(el, t, ini, fim) {
  const s = ressalto(fase(t, ini, 0.32)), sai = fase(t, fim - 0.25, 0.25);
  el.style.opacity = t >= ini && t < fim ? String(1 - sai) : '0';
  el.style.transform = `translateX(-50%) scale(${s}) rotate(${-3 + 3 * s}deg)`;
}
function pulo(el, t, ini, base = '') {
  const k = ressalto(fase(t, ini, 0.3));
  el.style.opacity = t >= ini ? '1' : '0';
  el.style.transform = `${base} translateY(${(1 - Math.min(1, k)) * 40}px) scale(${0.4 + 0.6 * k})`;
}
function cabecalho(t) {
  let k = 0;
  while (k < scene.length - 1 && t >= scene[k + 1][0]) k++;
  const [ini, r1, r2, c1, c2] = scene[k];
  const h1 = typeof r1 === 'function' ? r1(t) : r1, h2 = typeof r2 === 'function' ? r2(t) : r2;
  if ($('#r1').innerHTML !== h1) $('#r1').innerHTML = h1;
  if ($('#r2').innerHTML !== h2) $('#r2').innerHTML = h2;
  $('#r1').className = c1 ?? ''; $('#r2').className = c2 ?? '';
  $('#righe').style.transform = `scale(${ini > 0 ? 0.5 + 0.5 * ressalto(fase(t, ini, 0.3)) : 1})`;
  $('#righe').style.opacity = h1 || h2 ? '1' : '0';
}
const CORES = ['#FFC93C', '#E0473C', '#2E9B55', '#3FA9F5', '#FF7EB6', '#FFFFFF'];
const CONF = Array.from({ length: 60 }, (_, i) => ({ x: (i * 157) % 1080, atraso: ((i * 37) % 30) / 60, vel: 700 + ((i * 53) % 500), giro: ((i * 91) % 720) - 360, dx: ((i * 29) % 160) - 80, cor: CORES[i % CORES.length] }));
const BURST = () => [E.milione, tRampa(), E.raddoppiamo];
function coriandoli(t) {
  const t0 = BURST().filter(b => t >= b).at(-1);
  [...$('#coriandoli').children].forEach((el, i) => {
    const c = CONF[i], dt = t0 == null ? -1 : t - t0 - c.atraso, vis = dt > 0 && dt < 2.4;
    el.style.opacity = vis ? String(1 - fase(dt, 1.8, 0.6)) : '0';
    if (vis) el.style.transform = `translate(${c.x + c.dx * Math.sin(dt * 4)}px, ${-60 + c.vel * dt}px) rotate(${c.giro * dt}deg)`;
  });
}
// "+N PUNTI" sobem numa faixa abaixo do controle, sem cobrir o título
const PUNTI = [[0, 10, -250], [0.3, 25, 250], [0.6, 50, -250], [0.9, 15, 250], [1.1, 100, 0]];
const tPunti = () => E.valgono - 0.1;
function puntiSu(t) {
  [...$('#punti').children].forEach((el, i) => {
    const [dl, , dx] = PUNTI[i], dt = t - tPunti() - dl, vis = dt > 0 && dt < 1.6 && t < E.domenica;
    el.style.opacity = vis ? String(Math.min(1, dt * 6) * (1 - fase(dt, 1.2, 0.4))) : '0';
    if (vis) el.style.transform = `translate(${540 + dx - el.offsetWidth / 2}px, ${1230 - 230 * suave(clamp(dt / 1.4))}px) scale(${0.6 + 0.4 * ressalto(clamp(dt / 0.3))})`;
  });
}
// contagem regressiva até domingo 21h, a partir da hora dos dados
function cifre(t) {
  const resto = Math.max(0, fine - (Date.parse(D.snap.dati_fino) + t * 1000)) / 1000;
  const g = Math.floor(resto / 86400), h = Math.floor(resto % 86400 / 3600), m = Math.floor(resto % 3600 / 60), s = Math.floor(resto % 60);
  return [[g, 'giorni'], [h, 'ore'], [m, 'min'], [s, 'sec']];
}

function quadro(t) {
  const dist = camera(t);
  punti.visible = dist > DIST_CIDADE * 0.55;
  const u = punti.material.uniforms;
  u.lim.value = limite(t); u.lim0.value = lim0;
  u.oro.value = t < E.oltre ? 0 : 1 - fase(t, tRampa() + 0.8, 1.0);
  u.onda.value = t >= E.ogni - 0.1 && t < taglio3() ? t - (E.ogni - 0.1) : -1;
  decorazioni(t);
  const velo = $('#velo');
  const fl = Math.max(t >= E.milione ? 0.6 * (1 - fase(t, E.milione, 0.3)) : 0, t >= E.raddoppiamo ? 0.7 * (1 - fase(t, E.raddoppiamo, 0.3)) : 0,
    ...TAGLI().map(tc => (t >= tc ? 0.75 * (1 - fase(t, tc, 0.22)) : 0)));
  velo.style.opacity = String(fl);
  velo.style.background = t >= E.milione && t < E.milione + 0.3 ? '#FFE08A' : '#FFFFFF';
  cabecalho(t);
  for (const e of etichette) {
    const vis = t >= e.ini && t < e.fim;
    if (!vis) { e.el.style.opacity = '0'; continue; }
    const pos = e.pos(), p = projetar(pos.x, pos.y, pos.z);
    const s = ressalto(fase(t, e.ini, 0.32)) * (1 - fase(t, e.fim - 0.2, 0.2));
    e.el.style.opacity = p.ok ? '1' : '0';
    e.el.style.transform = `translate(${p.x - e.el.offsetWidth / 2}px, ${p.y - e.el.offsetHeight}px) scale(${s})`;
  }
  coriandoli(t);
  // 1 milhão
  const vw = $('#views');
  mostrar(vw, t, E.inizio, E.solo - 0.05);
  const v = conta(t, E.inizio + 0.15, E.milione - E.inizio - 0.15, R.views, 0);
  vw.querySelector('.n').textContent = num(v) + (t >= E.milione ? '+' : '');
  vw.querySelector('.n').style.transform = `scale(${t >= E.milione ? 1 + 0.25 * (1 - ressalto(fase(t, E.milione, 0.35))) + 0.03 * Math.sin((t - E.milione) * 8) : 1})`;
  chip($('#chip-7'), t, E.sette - 0.05, E.solo - 0.05);
  // 3 -> 8 casas decoradas
  mostrar($('#otto'), t, E.ieri - 0.05, E.ora);
  $('#otto .da').textContent = t >= E.otto ? '8' : '3';
  $('#otto .da').style.display = 'inline-block';
  $('#otto .da').style.transform = `scale(${t >= E.otto ? 1 + 0.6 * (1 - ressalto(fase(t, E.otto, 0.35))) : t >= E.tre ? 1 + 0.4 * (1 - ressalto(fase(t, E.tre, 0.3))) : 1})`;
  $('#otto .da').style.color = t >= E.otto ? 'var(--rosso)' : '';
  $('#otto').querySelectorAll('.s').forEach((el, i) => pulo(el, t, i < 3 ? E.ieri + 0.1 + i * 0.18 : E.oggi + 0.05 + (i - 3) * 0.13));
  // pedidos por mais vagas
  [...$('#richieste').children].forEach((el, i) => {
    const ini = E.tanti - 0.05 + i * 0.36, fim = E.deciso - 0.05 + i * 0.03, dx = RICHIESTE[i][1] ? 1 : -1;
    const k = ressalto(fase(t, ini, 0.3)), sai = suave(fase(t, fim, 0.3)), vis = t >= ini && t < fim + 0.3;
    el.style.opacity = vis ? String(1 - sai) : '0';
    if (vis) el.style.transform = `translateX(${dx * ((1 - Math.min(1, k)) * 300 + sai * 700)}px) scale(${0.6 + 0.4 * k})`;
  });
  // vagas dobradas
  mostrar($('#posti'), t, E.raddoppiamo - 0.05, taglio3());
  $('#posti h2 .n').textContent = t >= E.posti ? tot : tot / 2;
  $('#posti').querySelectorAll('.box div').forEach((el, i) => (i < tot / 2 ? pulo(el, t, E.raddoppiamo + 0.05 + i * 0.04) : pulo(el, t, E.posti + (i - tot / 2) * 0.08)));
  $('#posti').querySelectorAll('.riga2 div').forEach((el, i) => pulo(el, t, E.posti + 0.55 + i * 0.15));
  const sx = $('#stamp-x2'), ks = ressalto(fase(t, E.raddoppiamo, 0.3));
  sx.style.opacity = t >= E.raddoppiamo && t < taglio3() ? String(1 - fase(t, taglio3() - 0.25, 0.25)) : '0';
  sx.style.transform = `scale(${t < E.raddoppiamo + 0.1 ? 1.5 - 0.5 * ks : 1 + 0.04 * Math.sin((t - E.raddoppiamo) * 10)}) rotate(-4deg)`;
  chip($('#chip-ogni'), t, E.ogni - 0.05, taglio3());
  // jogos dentro da casa (prévia)
  chip($('#chip-presto'), t, E.presto - 0.05, E.domenica - 0.1);
  const gi = $('#giochi'), fimG = E.domenica - 0.1, saiG = 1 - fase(t, fimG - 0.25, 0.25);
  gi.style.opacity = t < fimG ? String(saiG) : '0';
  pulo(gi.querySelector('.pad'), t, E.giochi - 0.1);
  if (t >= E.giochi + 0.3) gi.querySelector('.pad').style.transform = `rotate(${6 * Math.sin((t - E.giochi) * 7)}deg) scale(${1 + 0.04 * Math.sin((t - E.giochi) * 14)})`;
  pulo(gi.querySelector('.t1'), t, E.giochi);
  pulo(gi.querySelector('.t2'), t, E.casa - 0.1);
  gi.querySelectorAll('.mini').forEach((el, i) => { pulo(el, t, E.giochi + 0.25 + i * 0.15); if (t >= E.giochi + 0.6 + i * 0.15) el.style.transform = `translateY(${10 * Math.sin((t + i) * 5)}px)`; });
  puntiSu(t);
  // contagem para domingo + chamada final
  mostrar($('#conto'), t, E.domenica - 0.05, E.scrivi);
  const cf = cifre(t).map(([n, l]) => `<div><b>${String(n).padStart(2, '0')}</b><small>${l}</small></div>`).join('');
  if ($('#conto .cifre').innerHTML !== cf) $('#conto .cifre').innerHTML = cf;
  $('#conto h2').classList.toggle('lampo', t >= E.presidente && t < E.presidente + 0.8);
  const cta = $('#cta').children;
  mostrar(cta[0], t, E.scrivi - 0.05, R.durata + 1, 20);
  mostrar(cta[1], t, E.commenti - 0.15, R.durata + 1, 20);
  mostrar(cta[2], t, E.commenti + 0.4, R.durata + 1, 20);
  legenda(t);
  mappa.renderer.render(mappa.scene, mappa.camera);
  return true;
}

// efeitos sonoros: um por acontecimento na tela (entrada, saída, movimento, contador), intensidade pela importância
function suoni() {
  const s = [], add = (t, tipo, extra = {}) => s.push({ t, tipo, vol: 0.8, ...extra });
  const entra = (t, forte = false) => { add(t - 0.03, 'pop', { vol: forte ? 0.75 : 0.5 }); if (forte) add(t + 0.02, 'whoosh', { vol: 0.35, dur: 0.4 }); };
  const sai = t => add(t - 0.25, 'whoosh', { vol: 0.22, dur: 0.35, giu: true });
  // 1. 1 milhão de visualizações
  add(0.0, 'riser', { dur: 0.35, vol: 0.35 }); entra(E.inizio + 0.05, true);
  for (let t = E.inizio + 0.2; t < E.milione - 0.05; t += 0.075) add(t, 'tick', { vol: 0.2, tono: 1 + 0.7 * (t - E.inizio) / (E.milione - E.inizio) });
  add(E.sette - 0.05, 'pop', { vol: 0.6, tono: 1.1 }); add(E.sette, 'whoosh', { vol: 0.3, dur: 0.35 });
  add(E.milione - 0.5, 'riser', { dur: 0.48, vol: 0.55 });
  add(E.milione - 0.02, 'boom', { vol: 0.85 }); add(E.milione, 'stamp', { vol: 0.9 }); add(E.milione + 0.03, 'coin', { vol: 0.6 });
  for (let k = 0; k < 8; k++) add(E.milione + 0.1 + k * 0.11, 'pop', { vol: 0.26, tono: 1.0 + ((k * 5) % 7) * 0.08 });   // confete
  add(E.visual, 'ding', { vol: 0.45, tono: 1.3 }); add(E.visual + 0.1, 'scintilla', { vol: 0.35 });
  // 2. +1.550 casas nas últimas 24 h
  sai(E.solo - 0.05); add(E.solo - 0.08, 'whoosh', { vol: 0.5, dur: 0.6, giu: true });
  add(E.solo - 0.02, 'pop', { vol: 0.55 }); add(E.ventiquattro, 'tick', { vol: 0.5, tono: 0.8 }); add(E.ventiquattro + 0.25, 'tick', { vol: 0.45, tono: 0.8 });
  add(E.mille - 0.35, 'riser', { dur: 0.33, vol: 0.45 }); add(E.mille - 0.05, 'stamp', { vol: 0.75 });
  for (let t = E.mille; t < tRampa(); t += 0.07) add(t, 'tick', { vol: 0.22, tono: 1 + 0.6 * (t - E.mille) / (tRampa() - E.mille) });
  for (let t = E.oltre + 0.1, k = 0; t < tRampa() - 0.1; t += 0.14, k++) add(t, 'pop', { vol: 0.18, tono: 0.8 + ((k * 37) % 9) / 12 });   // cidades acendem
  add(tRampa(), 'coin', { vol: 0.65 }); add(tRampa() + 0.05, 'ding', { vol: 0.45, tono: 1.3 });
  for (let k = 0; k < 6; k++) add(tRampa() + 0.12 + k * 0.12, 'pop', { vol: 0.24, tono: 1.0 + ((k * 3) % 5) * 0.1 });
  // 3. casas decoradas: 3 -> 8
  add(taglio1() - 0.3, 'silenzio', { dur: 0.3 });
  TAGLI().forEach(tc => { add(tc - 0.01, 'boom', { vol: 0.25 }); add(tc, 'pop', { vol: 0.38, tono: 0.7 }); add(tc - 0.12, 'whoosh', { vol: 0.45, dur: 0.3 }); });   // corte seco
  add(E.dec0 + 0.05, 'flap', { vol: 0.5 });   // cores do time
  add(E.decorate - 0.03, 'select', { tono: 1.3 }); add(E.decorate + 0.03, 'scintilla', { vol: 0.6 }); add(E.decorate + 0.1, 'ding', { vol: 0.4, tono: 1.7 });
  add(E.decorate + 0.05, 'pop', { vol: 0.5, tono: 1.0 });   // rótulo com @
  sai(E.ieri + 0.1);
  entra(E.ieri - 0.05, true);
  for (let i = 0; i < 3; i++) add(E.ieri + 0.1 + i * 0.18, 'pop', { vol: 0.5, tono: 0.9 + i * 0.1 });
  add(E.tre, 'tick', { vol: 0.5, tono: 0.9 });
  add(E.oggi + 0.02, 'scintilla', { vol: 0.55, tono: 1.1 });
  for (let i = 0; i < 5; i++) add(E.oggi + 0.05 + i * 0.13, 'pop', { vol: 0.55, tono: 1.1 + i * 0.09 });
  add(E.otto - 0.02, 'boom', { vol: 0.5 }); add(E.otto, 'stamp', { vol: 0.8 }); add(E.otto + 0.05, 'coin', { vol: 0.55 });
  // 4. a novidade: pedidos e vagas dobradas
  sai(E.ora);
  add(E.ora - 0.15, 'whoosh', { vol: 0.7, dur: 1.0, giu: true });
  add(E.novita - 0.45, 'silenzio', { dur: 0.4 }); add(E.novita - 0.4, 'rullo', { dur: 0.38, vol: 0.5 });
  add(E.novita - 0.05, 'stamp', { vol: 0.75 }); add(E.novita, 'ding', { vol: 0.5, tono: 1.2 });
  RICHIESTE.forEach((r, i) => { const ti = E.tanti - 0.05 + i * 0.36; add(ti, i % 2 ? 'notifica' : 'bolla', { vol: i % 2 ? 0.42 : 0.5, tono: 0.95 + (i % 3) * 0.08 }); add(ti + 0.02, 'whoosh', { vol: 0.14, dur: 0.3 }); });
  add(E.deciso - 0.1, 'whoosh', { vol: 0.6, dur: 0.5 });   // pedidos saem voando
  add(E.raddoppiamo - 0.4, 'silenzio', { dur: 0.38 }); add(E.raddoppiamo - 0.38, 'riser', { dur: 0.36, vol: 0.6 });
  add(E.raddoppiamo - 0.02, 'boom', { vol: 0.9 }); add(E.raddoppiamo, 'stamp', { vol: 1 }); entra(E.raddoppiamo - 0.05, true);
  for (let i = 0; i < 6; i++) add(E.raddoppiamo + 0.05 + i * 0.04, 'tick', { vol: 0.2, tono: 1.0 + i * 0.05 });
  for (let i = 0; i < 6; i++) add(E.posti + i * 0.08, 'pop', { vol: 0.5, tono: 1.0 + i * 0.1 });   // vagas novas
  add(E.posti + 0.5, 'coin', { vol: 0.55 }); add(E.posti + 0.55, 'pop', { vol: 0.4, tono: 1.2 }); add(E.posti + 0.7, 'pop', { vol: 0.4, tono: 1.3 });
  add(E.ogni - 0.05, 'pop', { vol: 0.6 }); add(E.ogni - 0.02, 'whoosh', { vol: 0.3, dur: 0.4 });
  add(E.ogni, 'scintilla', { vol: 0.6, tono: 0.9 }); for (let k = 0; k < 8; k++) add(E.ogni + k * 0.09, 'tick', { vol: 0.2, tono: 1.2 + k * 0.06 });   // onda de cidades
  // 5. jogos dentro da casa
  add(E.presto - 0.05, 'pop', { vol: 0.65, tono: 1.1 }); add(E.presto, 'ding', { vol: 0.4, tono: 1.5 });
  add(E.presto + 0.1, 'whoosh', { vol: 0.6, dur: E.casa - E.presto });   // câmera desce até a casa
  add(E.giochi - 0.1, 'boom', { vol: 0.45 }); add(E.giochi - 0.08, 'select', { tono: 1.0, vol: 0.85 }); add(E.giochi, 'pop', { vol: 0.6 });
  for (let i = 0; i < 4; i++) add(E.giochi + 0.25 + i * 0.15, 'tasto', { vol: 0.55, tono: 0.9 + i * 0.12 });   // mini ícones
  add(E.casa - 0.1, 'pop', { vol: 0.55, tono: 1.15 }); add(E.casa, 'scintilla', { vol: 0.4 });
  PUNTI.forEach(([dl], i) => add(tPunti() + dl, 'coin', { vol: 0.32 + i * 0.07, tono: 1.0 + i * 0.1 }));
  add(E.punti, 'ding', { vol: 0.55, tono: 1.4 });
  // 6. domingo + chamada final
  sai(E.domenica - 0.1);
  add(E.domenica - 0.15, 'whoosh', { vol: 0.7, dur: 0.9, giu: true }); entra(E.domenica, true);
  for (let t = E.domenica + 0.5; t < E.scrivi - 0.3; t += 1) add(t, 'tick', { vol: 0.38, tono: 0.8 });
  add(E.ventuno, 'ding', { vol: 0.45, tono: 1.2 }); add(E.presidente, 'flap', { vol: 0.7 }); add(E.presidente + 0.05, 'pop', { vol: 0.4 });
  sai(E.scrivi);
  add(E.scrivi - 0.1, 'whoosh', { vol: 0.6, dur: 0.8, giu: true }); add(E.scrivi, 'pop', { tono: 0.9 });
  add(E.commenti - 0.15, 'stamp', { vol: 0.7 }); add(E.commenti + 0.4, 'pop', { tono: 1.2 }); add(E.commenti + 0.5, 'ding', { vol: 0.5 });
  return s.sort((a, b) => a.t - b.t);
}

async function preparar(roteiro) {
  R = roteiro; E = R.eventi;
  await Promise.all(['900 104px Nunito', '900 60px Nunito', '800 40px Nunito', '700 30px Nunito'].map(f => document.fonts.load(f)));
  await document.fonts.ready;
  citta = new Citta(mappa, D);
  decori = new Decori(D, mappa, citta, null);
  const corte = Date.parse(D.snap.dati_fino) - 86400e3;
  nIeri = D.casas.filter(c => c.ts <= corte).length;
  lim0 = Math.min(1, nIeri / totale);
  punti = criarPontos();
  fine = Date.parse(D.snap.mandato.fine);
  try { cfgNegozio = await (await fetch(`data/negozio.json?t=${Date.now()}`)).json(); } catch { cfgNegozio = null; }
  // casas decoradas reais (as 8 no cartão; duas em 3D)
  deco = R.decorate.map(x => { const c = D.porConta.get(x.conta); if (!c) throw new Error(`@${x.conta} não está no mapa`); return { casa: c, pos: citta.posCasa(c), x }; });
  const nomeL = c => esc(D.luoghi[c.luogo].nome).toUpperCase();
  const [a] = R.vetrina3d.map(i => deco[i]);
  const topoD = (d, folga = 0.45) => () => { const x = decori.attive.get(d.casa.conta); return { x: d.pos.x, y: d.pos.y + ((x?.pilha ?? ALTURA_NIVEL[d.casa.livello]) + folga) * LOTE, z: d.pos.z }; };
  etichette.push({ el: novaEtichetta(`<div class="box${a.x.extra.includes('cornice') ? ' cornice' : ''}"><b>@${esc(a.casa.conta)}</b><span>📍 ${nomeL(a.casa)}</span><small>${a.x.squadra ? `${esc(a.x.squadra)} · ` : ''}${a.x.extra.map(esc).join(' · ')}</small></div><div class="freccia"></div>`), pos: topoD(a), ini: E.decorate + 0.05, fim: E.ieri + 0.1 });
  // cartão das 8: cores do time ou ouro, com o emoji do enfeite principal
  const sq = id => SQUADRE.find(s => s.id === id);
  const em = x => (x.extra.includes('corona') ? '👑' : x.extra.includes('oro') ? '✨' : x.extra.includes('campione') ? '🏆' : x.da ? '🎁' : x.extra.includes('neon') ? '🌈' : '🇮🇹');
  $('#otto .slot').innerHTML = deco.map((d, i) => {
    const o = d.x.extra.includes('oro'), s = d.x.squadra && sq(d.x.squadra);
    const muro = o ? '#F2C230' : s ? s.muro : '#FFFFFF', tetto = o ? '#C99A1E' : s ? s.tetto : '#E0473C';
    return `<div class="s"><div class="ic"><div class="tetto" style="border-bottom-color:${tetto}"></div><div class="muro" style="background:${muro}"></div><div class="em">${em(d.x)}</div></div><b>@${esc(d.casa.conta)}</b>${i >= 3 ? '<div class="nuova">NUOVA</div>' : ''}</div>`;
  }).join('');
  // pedidos
  $('#richieste').innerHTML = RICHIESTE.map(([txt, dx], i) => `<div class="${dx ? 'dx' : ''}" style="top:${400 + i * 128}px;${dx ? 'right:50px' : 'left:50px'}">${esc(txt)}</div>`).join('');
  // vagas reais da cidade (plano pelo tamanho do comune, como no site): metade antes, o total agora
  const lc = D.luoghi.find(l => l.nome === R.citta_posti);
  if (!lc) throw new Error(`${R.citta_posti} não está no mapa`);
  const piani = cfgNegozio?.piani ?? [], piano = piani.find(x => lc.comune.pop >= x.da) ?? piani.at(-1);
  tot = piano?.posti?.negozio ?? 12;
  presi = (lc.commerci ?? []).filter(c => c.prodotto === 'negozio').length;
  $('#posti h2').innerHTML = `🏪 NEGOZI A ${esc(lc.nome.toUpperCase())}: <span class="n"></span>`;
  $('#posti .box').innerHTML = Array.from({ length: tot }, (_, i) => (i < presi ? '<div class="preso">🏪<small>OCCUPATO</small></div>' : i < tot / 2 ? '<div class="libero">➕<small>LIBERO</small></div>' : '<div class="nuovo">✨<small>NUOVO</small></div>')).join('');
  // casa dos jogos: a casa mais alta do mapa, sem rótulo (é "la tua casa")
  casaGioco = D.porConta.get(R.casa_giochi) ?? [...D.casas].sort((x, y) => y.tot - x.tot)[0];
  posGioco = citta.posCasa(casaGioco);
  $('#punti').innerHTML = PUNTI.map(([, p]) => `<i class="forte g">+${p} PUNTI</i>`).join('');
  $('#coriandoli').innerHTML = CONF.map(c => `<i style="background:${c.cor}"></i>`).join('');
  montarChaves();
  scene = [
    [0, '', ''],
    [E.solo - 0.05, '⏱️ NELLE ULTIME', '<span class="g">24 ORE</span>'],
    [E.mille - 0.05, t => `🏠 <span class="g">+${num(nuoveOra(t))}</span>`, 'CASE NUOVE', 'grande'],
    [taglio1(), '', ''],
    [E.ora - 0.05, '📢 E ORA', '<span class="g">LA NOVITÀ…</span>', '', 'grande'],
    [E.tanti - 0.1, 'CI AVETE', '<span class="g">CHIESTO 🙏</span>'],
    [E.deciso - 0.05, '', ''],
  ];
  if (R.copertina) {
    const cp = R.copertina;
    if (cp.linee) {
      const el = document.createElement('div');
      el.className = 'forte';
      el.style.cssText = `position:absolute;left:30px;right:30px;top:${cp.titolo_top}px;text-align:center;line-height:1.05;`;
      el.innerHTML = cp.linee.map(([txt, cor, size]) => `<div style="font-size:${size}px;-webkit-text-stroke-width:${Math.round(size * 0.19)}px"${cor ? ` class="${cor === true ? 'g' : cor}"` : ''}>${esc(txt)}</div>`).join('');
      document.body.appendChild(el);
    }
    $('#etichette').style.display = 'none';
  }
  console.log(`${totale} case (24 h fa ${nIeri}, +${totale - nIeri}) · ${D.luoghi.length} città · deco ${deco.map(d => `@${d.casa.conta} ${D.luoghi[d.casa.luogo].nome}`).join(', ')} · ${lc.nome} ${presi}/${tot} · gioco @${casaGioco.conta} ${D.luoghi[casaGioco.luogo].nome} liv ${casaGioco.livello} · fine ${D.snap.dati_fino}`);
  quadro(0);
  return { durata: R.durata, fps: 30 };
}

iniciar().catch(e => console.error('erro ao carregar', e));
