// Reel "crescita" (reel 12) com dados reais: de 21.000 para quase 23.000 casas (as cidades que ganharam casa acendem),
// as 3 primeiras casas decoradas pagas (@ reais, decorações montadas no ritmo da fala, noite com fogos), as 17 atividades
// da Vetrina, as visitas do site, o caminho de quem descobre uma loja (toca na insegna e manda WhatsApp), as vagas
// da cidade e os números do jogo. Usa o mesmo decori.js do site. window.preparar/quadro/suoni; tudo depende só de t.
import * as THREE from 'three';
import { carregar } from '../js/dati.js';
import { Mappa, COR_MAR } from '../js/mappa.js';
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

let D, mappa, citta, decori, R, E, chaves, punti, totale, scene, etichette = [], fine, cfgNegozio;
let deco, shop, bill, lim0, persone;   // deco: [{ casa, pos, sel }] na ordem moscoz, gianni, raideen
const GIORNO = { mar: new THREE.Color(COR_MAR), terra: new THREE.Color('#ffffff'), ceu: 2.3, sol: 2.4, ceuC: new THREE.Color('#ffffff'), solC: new THREE.Color('#fff1dc') };
const NOTTE = { mar: new THREE.Color('#1B2E55'), terra: new THREE.Color('#7381A8'), ceu: 1.1, sol: 0.7, ceuC: new THREE.Color('#B9C6FF'), solC: new THREE.Color('#A9BBFF') };
const TRAMONTO = { mar: new THREE.Color('#E58A5C'), terra: new THREE.Color('#FFD2B0'), ceu: 1.9, sol: 2.1, ceuC: new THREE.Color('#FFC6A0'), solC: new THREE.Color('#FF9A55') };
const MSG = 'Ciao! Vi ho trovati sulla mappa di Italia Casa per Casa 😍';

async function iniciar() {
  D = await carregar('video');
  totale = D.casas.length;
  mappa = new Mappa($('#mappa'), D.geo, D.rilievo, D.imagem, { gravacao: true });
  window.preparar = preparar;
  window.quadro = quadro;
  window.suoni = suoni;
}

// dia -> pôr do sol -> noite (k de 0 a 1), como no reel 8
function ceu(k) {
  const a = k < 0.5 ? GIORNO : TRAMONTO, b = k < 0.5 ? TRAMONTO : NOTTE, s = k < 0.5 ? k * 2 : (k - 0.5) * 2;
  const c = a.mar.clone().lerp(b.mar, s);
  mappa.scene.background.copy(c); mappa.scene.fog.color.copy(c); mappa.mar.material.color.copy(c);
  mappa.matTerreno.color.copy(a.terra.clone().lerp(b.terra, s));
  mappa.ceu.intensity = a.ceu + (b.ceu - a.ceu) * s; mappa.ceu.color.copy(a.ceuC.clone().lerp(b.ceuC, s));
  mappa.sol.intensity = a.sol + (b.sol - a.sol) * s; mappa.sol.color.copy(a.solC.clone().lerp(b.solC, s));
  mappa.notte = k > 0.6;
  citta.grupoNotte.visible = k > 0.6;
}

// uma bolinha por cidade (3+ casas); as cidades que ganharam casa desde ontem dão um pulo e ficam douradas
function criarPontos() {
  const ordem = D.casas.map((c, i) => i).sort((a, b) => D.casas[a].ts - D.casas[b].ts);
  const rankCasa = new Float32Array(D.casas.length);
  ordem.forEach((i, k) => { rankCasa[i] = (k + 1) / ordem.length; });
  const n = D.luoghi.length, rank = new Float32Array(n), ult = new Float32Array(n), pos = new Float32Array(n * 3);
  D.luoghi.forEach((l, i) => {
    const rs = l.casas.map(c => rankCasa[c]).sort((a, b) => a - b);
    rank[i] = rs.length >= 3 ? rs[2] : 2;
    ult[i] = rs.at(-1) ?? 2;
    pos.set([l.x, mappa.altura(l.x, l.z) + 0.03, l.z], i * 3);
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('ord', new THREE.BufferAttribute(rank, 1));
  g.setAttribute('ult', new THREE.BufferAttribute(ult, 1));
  const mat = new THREE.ShaderMaterial({
    uniforms: { lim: { value: 0 }, lim0: { value: 0 }, oro: { value: 0 }, escala: { value: 1920 / (2 * Math.tan(mappa.camera.fov * Math.PI / 360)) } },
    vertexShader: `
      attribute float ord; attribute float ult; uniform float lim; uniform float lim0; uniform float oro; uniform float escala; varying float vNovo;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        float k = clamp((lim - ord) * 40.0, 0.0, 1.0);
        float pop = k < 1.0 ? k * (1.0 + 0.6 * sin(k * 3.1416)) : 1.0;
        float nuova = (ult > lim0 && lim >= ult) ? 1.0 : 0.0;
        float k2 = clamp((lim - ult) * 90.0, 0.0, 1.0);
        float pop2 = 1.0 + nuova * (1.3 * sin(k2 * 3.1416) + 0.45 * oro);
        vNovo = nuova * oro;
        gl_PointSize = ord > lim ? 0.0 : clamp(0.05 * escala / -mv.z, 12.0, 17.0) * pop * pop2;
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
const tRampa = () => E.ventitre + 0.6;
const taglio1 = () => E.una2 + 0.1, taglio2 = () => E.notte - 0.05, taglio3 = () => E.cartelloni - 0.05;
const TAGLI = () => [taglio1(), taglio2(), taglio3()];
// instantes em que cada explosão de fogos começa na casa de @raideen_21, imitando decori.js: 3 explosões que
// recomeçam no primeiro quadro depois de 1,5 s de vida, defasadas 120 ms (o som acompanha o que aparece)
function scoppi(fps = 30) {
  const f0 = Math.ceil(E.esplodono * fps) / fps, out = [];
  for (let e = 0; e < 3; e++) {
    let t0 = f0 + 0.12 * e;
    while (t0 < E.tre) { out.push(t0); t0 = (Math.floor((t0 + 1.5) * fps) + 1) / fps + 0.12 * e; }
  }
  return out.sort((a, b) => a - b);
}
const limite = t => (t < E.oggi ? lim0 : lim0 + (1 - lim0) * suave(fase(t, E.oggi + 0.1, tRampa() - E.oggi)));
const caseOra = t => (t < E.oggi ? R.ieri : R.ieri + (totale - R.ieri) * suave(fase(t, E.oggi + 0.1, tRampa() - E.oggi)));

// ---------- as casas decoradas: montadas peça a peça no ritmo da fala ----------
const stato = new Map();
function decorazioni(t) {
  const [mo, gi, ra] = deco, voglio = new Map(), notte = t >= E.esplodono;
  const exMo = [t >= E.corona && 'corona', t >= E.neon && 'neon', t >= E.neon + 0.45 && 'campione', t >= E.neon + 0.45 && 'tricolore', notte && 'fuochi'].filter(Boolean);
  if (t >= E.viola) voglio.set(mo, { squadra: 'viola', extra: exMo });
  if (t >= E.oro) voglio.set(gi, { squadra: null, extra: ['oro', t >= E.oro + 0.4 && 'tricolore', notte && 'fuochi'].filter(Boolean) });
  if (t >= E.notte) voglio.set(ra, { squadra: 'granata', extra: ['neon', notte && 'fuochi'].filter(Boolean) });
  for (const d of deco) {
    const s = voglio.get(d) ?? { squadra: null, extra: [] }, k = JSON.stringify(s);
    if (stato.get(d) === k) continue;
    stato.set(d, k);
    decori.disegna(d.casa, { squadra: s.squadra, extra: new Set(s.extra) });
    // fogos maiores que no site: no celular, em 1080x1920, as faíscas do tamanho normal somem
    decori.attive.get(d.casa.conta)?.g.traverse(o => { if (o.isPoints) o.material.size = 0.019; });
  }
  for (const a of decori.attive.values()) a.anima(t * 1000);
}

// ---------- câmera ----------
function montarChaves() {
  const b = D.geo.bbox, alt = b.z1 - b.z0, dP = mappa.distPais();
  const paese = { x: (b.x0 + b.x1) / 2, z: (b.z0 + b.z1) / 2 - alt * 0.07, dist: dP, az: 0, giu: 0 };
  const P = (o, k = {}) => ({ x: o.x, z: o.z, ...k });
  const azF = lote => (posLote(lote).rot === 0 ? 0 : Math.PI);   // de frente para a porta
  const [mo, gi, ra] = deco, am = azF(mo.casa.lote), ag = azF(gi.casa.lote), ar = azF(ra.casa.lote), as = azF(shop.lote), ab = azF(bill.lote);
  const lista = [
    [0, { ...paese, dist: dP * 1.1 }],
    [E.oggi, { ...paese, dist: dP * 1.06 }],
    [tRampa(), { ...paese, dist: dP * 0.95 }],
    [E.alcune, { ...paese, dist: dP * 0.93 }],
    [E.prime, P(mo.pos, { dist: 0.62, az: am + 0.2, giu: 0.08 })],
    [E.viola, P(mo.pos, { dist: 0.36, az: am + 0.35, giu: 0.06 })],
    [E.corona, P(mo.pos, { dist: 0.33, az: am + 0.7, giu: 0.08 })],
    [E.neon + 0.3, P(mo.pos, { dist: 0.38, az: am + 1.05, giu: 0.1 })],
    // cortes secos entre cidades distantes (voar rente ao chão vira um borrão verde)
    [taglio1() - 0.01, P(mo.pos, { dist: 0.39, az: am + 1.15, giu: 0.1 })],
    [taglio1(), P(gi.pos, { dist: 0.55, az: ag - 0.6, giu: 0.17 })],
    [E.una2 + 0.75, P(gi.pos, { dist: 0.36, az: ag - 0.2, giu: 0.17 })],
    [taglio2() - 0.01, P(gi.pos, { dist: 0.34, az: ag + 0.45, giu: 0.17 })],
    [taglio2(), P(ra.pos, { dist: 0.75, az: ar - 0.1, giu: 0.2 })],
    [E.esplodono + 0.2, P(ra.pos, { dist: 0.58, az: ar + 0.3, giu: 0.22 })],
    [E.per - 0.1, P(ra.pos, { dist: 0.62, az: ar + 0.75, giu: 0.22 })],
    [E.tre, P(ra.pos, { dist: 1.2, az: ar + 0.9, giu: 0.1 })],
    [E.nonsolo, { ...paese, dist: dP * 0.95, az: 0, giu: 0 }],
    [E.diciassette, P(shop.pos, { dist: 2.2, az: as + 0.2, giu: 0 })],
    [E.negozi - 0.3, P(shop.pos, { dist: 1.6, az: as + 0.5, giu: 0 })],
    [E.negozi + 0.25, P(shop.pos, { dist: 0.34, az: as + 0.25, giu: 0.04 })],
    [taglio3() - 0.01, P(shop.pos, { dist: 0.34, az: as + 0.35, giu: 0.04 })],
    [taglio3(), P(bill.pos, { dist: 0.5, az: ab - 0.2, giu: 0.06 })],
    [E.cartelloni + 0.35, P(bill.pos, { dist: 0.36, az: ab + 0.2, giu: 0.06 })],
    [E.quattro, P(bill.pos, { dist: 0.42, az: ab + 0.55, giu: 0.06 })],
    [E.sito + 0.2, { ...paese, dist: dP * 0.98, az: 0, giu: 0 }],
    [E.gente, { ...paese, dist: dP * 0.95 }],
    [E.conosce + 0.4, P(shop.pos, { dist: 0.7, az: as - 0.3, giu: 0.05 })],
    [E.scopre, P(shop.pos, { dist: 0.42, az: as + 0.1, giu: 0.05 })],
    [E.tocca, P(shop.pos, { dist: 0.38, az: as + 0.2, giu: 0.12 })],
    [E.posti, P(shop.pos, { dist: 0.45, az: as + 0.35, giu: 0.12 })],
    [E.pochi + 0.4, P(shop.pos, { dist: 0.7, az: as + 0.6, giu: 0.1 })],
    [E.intanto + 0.2, { ...paese, dist: dP * 1.0, az: 0, giu: 0 }],
    [E.domenica, { ...paese, dist: dP * 0.96 }],
    [E.scrivi, { ...paese, dist: dP * 0.98 }],
    [R.durata, { ...paese, dist: dP * 1.05 }],
  ];
  let ant = {};
  chaves = lista.sort((a, c) => a[0] - c[0]).map(([t, k]) => { ant = { ...ant, ...k }; return { t, k: { ...ant } }; });
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
  const tremor = [[E.oggi, 0.4], [E.prime, 0.4], [E.oro, 0.35], [E.esplodono, 0.4], [E.diciassette, 0.35], [E.pochi, 0.4]].reduce((v, [ti, dd]) => v + (t >= ti && t < ti + dd ? 0.013 * (1 - (t - ti) / dd) * Math.sin((t - ti) * 70) : 0), 0);
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
const tConf = () => tRampa();
function coriandoli(t) {
  [...$('#coriandoli').children].forEach((el, i) => {
    const c = CONF[i], dt = t - tConf() - c.atraso, vis = dt > 0 && dt < 2.6;
    el.style.opacity = vis ? String(1 - fase(dt, 2.0, 0.6)) : '0';
    if (vis) el.style.transform = `translate(${c.x + c.dx * Math.sin(dt * 4)}px, ${-60 + c.vel * dt}px) rotate(${c.giro * dt}deg)`;
  });
}
// visitantes: bolinhas com inicial que voam das bordas até a loja
const PERS = Array.from({ length: 16 }, (_, i) => ({ ini: i * 0.16, x0: i % 2 ? 1160 : -80, y0: 380 + ((i * 263) % 1100), cor: ['#3FA9F5', '#FF7EB6', '#2E9B55', '#E0473C', '#8E5CF7', '#F28C28'][i % 6], l: 'AMGLSFRCEPDVNBTI'[i] }));
const tPers = () => E.conosce + 0.3;
function volano(t) {
  const alvo = projetar(shop.pos.x, shop.pos.y + LOTE * 0.6, shop.pos.z);
  [...$('#persone').children].forEach((el, i) => {
    const p = PERS[i], dt = t - tPers() - p.ini, dur = 1.1, vis = dt > 0 && dt < dur + 0.25 && t < E.scopre + 0.2;
    el.style.opacity = vis ? String(dt > dur ? 1 - (dt - dur) / 0.25 : Math.min(1, dt * 6)) : '0';
    if (!vis) return;
    const k = suave(clamp(dt / dur)), arco = Math.sin(Math.PI * k) * -160;
    const x = p.x0 + (alvo.x - p.x0) * k, y = p.y0 + (alvo.y - p.y0) * k + arco;
    el.style.transform = `translate(${x - 32}px, ${y - 32}px) scale(${dt > dur ? 1 - (dt - dur) / 0.25 : 1})`;
  });
}
// contagem regressiva até domingo 21h, a partir da hora dos dados
function cifre(t) {
  const resto = Math.max(0, fine - (Date.parse(D.snap.dati_fino) + t * 1000)) / 1000;
  const g = Math.floor(resto / 86400), h = Math.floor(resto % 86400 / 3600), m = Math.floor(resto % 3600 / 60), s = Math.floor(resto % 60);
  return [[g, 'giorni'], [h, 'ore'], [m, 'min'], [s, 'sec']];
}
// pontinho do toque: segue um elemento da tela (ou um ponto 3D)
function tocco(t, ini, alvo) {
  const tc = $('#tocco'), k = fase(t, ini, 0.45);
  if (k <= 0 || k >= 1) return false;
  tc.style.left = `${alvo.x}px`; tc.style.top = `${alvo.y}px`;
  tc.style.opacity = String(1 - k); tc.style.transform = `scale(${0.4 + k})`;
  return true;
}

function quadro(t) {
  const dist = camera(t);
  punti.visible = dist > DIST_CIDADE * 0.55;
  const u = punti.material.uniforms;
  u.lim.value = limite(t); u.lim0.value = lim0;
  u.oro.value = t < E.oggi ? 0 : 1 - fase(t, tRampa() + 1.0, 1.2);
  ceu(suave(fase(t, E.notte - 0.15, 0.6)) * (1 - suave(fase(t, E.per - 0.1, 0.7))));
  decorazioni(t);
  const velo = $('#velo');
  const fl = Math.max(t >= E.oggi ? 0.6 * (1 - fase(t, E.oggi, 0.3)) : 0, t >= E.oro ? 0.55 * (1 - fase(t, E.oro, 0.3)) : 0, t >= E.diciassette ? 0.7 * (1 - fase(t, E.diciassette, 0.3)) : 0,
    ...TAGLI().map(tc => (t >= tc ? 0.75 * (1 - fase(t, tc, 0.22)) : 0)));
  velo.style.opacity = String(fl);
  velo.style.background = t >= E.diciassette ? '#FFFFFF' : t >= E.oro ? '#FFE08A' : '#FFFFFF';
  cabecalho(t);
  for (const e of etichette) {
    const vis = t >= e.ini && t < e.fim;
    if (!vis) { e.el.style.opacity = '0'; continue; }
    const pos = e.pos(), p = projetar(pos.x, pos.y, pos.z);
    const s = ressalto(fase(t, e.ini, e.dur ?? 0.32)) * (1 - fase(t, e.fim - 0.2, 0.2));
    e.el.style.opacity = p.ok ? '1' : '0';
    e.el.style.transform = `translate(${p.x - e.el.offsetWidth / 2}px, ${p.y - e.el.offsetHeight}px) scale(${s})`;
    if (e.lampo) e.el.querySelector('.box').classList.toggle('lampo', t >= e.lampo && t < e.lampo + 0.8);
  }
  coriandoli(t);
  chip($('#chip-prime'), t, E.decorate - 0.05, E.viola - 0.1);
  // 3 casas + a sua
  mostrar($('#tre'), t, E.per - 0.05, E.nonsolo);
  const slots = $('#tre').querySelectorAll('.s');
  slots.forEach((el, i) => {
    const ini = i < 3 ? E.per + 0.15 + i * 0.32 : E.tua - 0.05, k = ressalto(fase(t, ini, 0.3));
    el.style.opacity = t >= ini ? '1' : '0';
    el.style.transform = `translateY(${(1 - Math.min(1, k)) * 40}px) scale(${0.6 + 0.4 * k})`;
  });
  slots[3]?.classList.toggle('tua', t >= E.tua);
  if (slots[3] && t >= E.quarta) slots[3].style.transform = `scale(${1 + 0.06 * Math.sin((t - E.quarta) * 9)})`;
  chip($('#chip-decora'), t, E.quarta + 0.3, E.nonsolo);
  // Vetrina: a lista das atividades desce sozinha
  mostrar($('#vetrina'), t, E.diciassette - 0.05, E.negozi - 0.1);
  const sc = $('#vetrina .scorre'), alt = sc.scrollHeight - 720;
  sc.style.transform = `translateY(${-Math.max(0, alt) * suave(fase(t, E.diciassette + 0.6, E.negozi - E.diciassette - 1.0))}px)`;
  chip($('#chip-17'), t, E.diciassette, E.negozi - 0.1);
  // visitas
  const vs = $('#visite');
  mostrar(vs, t, E.quattro - 0.05, E.gente);
  vs.querySelector('.n').textContent = num(conta(t, E.quattro, E.cinquanta + 0.5 - E.quattro, R.visite, R.visite * 0.3));
  volano(t);
  chip($('#chip-trovato'), t, E.scopre, E.tocca + 0.1);
  // toque na loja -> ficha -> toque no WhatsApp -> mensagem
  const pLoja = projetar(shop.pos.x, shop.pos.y + LOTE * 0.4, shop.pos.z);
  const tc1 = tocco(t, E.tocca - 0.1, pLoja);
  mostrar($('#scheda'), t, E.tocca + 0.2, E.whatsapp);
  const bw = $('#scheda .wa');
  bw.classList.toggle('lampo', t >= E.scrive - 0.15 && t < E.whatsapp);
  const tc2 = !tc1 && t >= E.scrive - 0.15 && tocco(t, E.scrive - 0.15, (() => { const r = bw.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })());
  if (!tc1 && !tc2) $('#tocco').style.opacity = '0';
  mostrar($('#chat'), t, E.whatsapp - 0.05, E.posti);
  const nCh = Math.floor([...MSG].length * fase(t, E.whatsapp + 0.15, 0.9)), txt = [...MSG].slice(0, nCh).join('');
  const html = esc(txt) + (nCh < [...MSG].length && Math.floor(t * 3) % 2 === 0 ? '<span class="cur"></span>' : '');
  const tx = $('#chat .tx'); if (tx.innerHTML !== html) tx.innerHTML = html;
  $('#chat .ora').style.opacity = nCh >= [...MSG].length ? '1' : '0';
  // vagas na cidade da loja
  mostrar($('#posti'), t, E.posti - 0.05, E.intanto);
  $('#posti').querySelectorAll('.libero').forEach((el, i) => el.classList.toggle('lampo', t >= E.pochi && Math.floor((t - E.pochi) * 3 + i) % 2 === 0));
  const sp = $('#stamp-pochi'), ks = ressalto(fase(t, E.pochi, 0.3));
  sp.style.opacity = t >= E.pochi && t < E.intanto ? String(1 - fase(t, E.intanto - 0.25, 0.25)) : '0';
  sp.style.transform = `scale(${t < E.pochi + 0.1 ? 1.5 - 0.5 * ks : 1 + 0.04 * Math.sin((t - E.pochi) * 10)}) rotate(-4deg)`;
  // números do jogo
  const tiles = $('#stats').children;
  [[E.trenta, D.snap.contatori.contas], [E.ottanta, D.snap.contatori.commenti], [E.dieci, D.snap.contatori.follower]].forEach(([ev, v], i) => {
    mostrar(tiles[i], t, ev - 0.35, E.domenica, 40);
    tiles[i].querySelector('b').textContent = num(conta(t, ev - 0.35, 0.9, v, v * 0.6));
  });
  // contagem para domingo + chamada final
  mostrar($('#conto'), t, E.domenica - 0.05, E.scrivi);
  const cf = cifre(t).map(([v, n]) => `<div><b>${String(v).padStart(2, '0')}</b><small>${n}</small></div>`).join('');
  if ($('#conto .cifre').innerHTML !== cf) $('#conto .cifre').innerHTML = cf;
  $('#conto h2').classList.toggle('lampo', t >= E.presidente && t < E.presidente + 0.8);
  const cta = $('#cta').children;
  mostrar(cta[0], t, E.scrivi - 0.05, R.durata + 1, 20);
  mostrar(cta[1], t, E.regione - 0.3, R.durata + 1, 20);
  mostrar(cta[2], t, E.crescere - 0.1, R.durata + 1, 20);
  mostrar(cta[3], t, E.casa + 0.3, R.durata + 1, 20);
  legenda(t);
  mappa.renderer.render(mappa.scene, mappa.camera);
  return true;
}

// efeitos sonoros: um por acontecimento na tela (entrada, saída, movimento, contador), intensidade pela importância
function suoni() {
  const s = [], add = (t, tipo, extra = {}) => s.push({ t, tipo, vol: 0.8, ...extra });
  const entra = (t, forte = false) => { add(t - 0.03, 'pop', { vol: forte ? 0.75 : 0.5 }); if (forte) add(t + 0.02, 'whoosh', { vol: 0.35, dur: 0.4 }); };
  const sai = t => add(t - 0.25, 'whoosh', { vol: 0.22, dur: 0.35, giu: true });
  // 1. ontem 21.000 -> hoje quase 23.000: as cidades acendem
  add(0.02, 'stamp', { vol: 0.6 }); add(E.ventuno - 0.05, 'pop', { vol: 0.6, tono: 0.9 }); add(E.ventuno + 0.05, 'ding', { vol: 0.35, tono: 0.9 });
  add(E.oggi - 0.6, 'riser', { dur: 0.6, vol: 0.6 });
  add(E.oggi - 0.02, 'boom', { vol: 0.7 }); add(E.oggi, 'stamp', { vol: 0.75 });
  for (let t = E.oggi + 0.15; t < tRampa(); t += 0.07) add(t, 'tick', { vol: 0.24, tono: 1 + 0.6 * (t - E.oggi) / (tRampa() - E.oggi) });
  for (let t = E.oggi + 0.2, k = 0; t < tRampa() - 0.1; t += 0.13, k++) add(t, 'pop', { vol: 0.2, tono: 0.8 + ((k * 37) % 9) / 12 });
  add(tConf(), 'coin', { vol: 0.65 }); add(tConf() + 0.05, 'ding', { vol: 0.45, tono: 1.3 });
  for (let k = 0; k < 8; k++) add(tConf() + 0.1 + k * 0.12, 'pop', { vol: 0.28, tono: 1.0 + ((k * 5) % 7) * 0.08 });
  add(E.citta - 0.1, 'select', { tono: 1.05 }); for (let k = 0; k < 7; k++) add(E.citta + k * 0.08, 'tick', { vol: 0.22, tono: 1.3 + k * 0.05 });
  // 2. mergulho nas casas decoradas
  add(E.alcune - 0.1, 'whoosh', { vol: 0.85, dur: E.prime - E.alcune + 0.2 });
  add(E.notare - 0.05, 'scintilla', { vol: 0.6 });
  add(E.prime - 0.45, 'silenzio', { dur: 0.5 });
  add(E.prime - 0.03, 'boom', { vol: 0.6 }); add(E.prime, 'stamp', { vol: 0.85 });
  entra(E.decorate - 0.05); add(E.decorate + 0.1, 'scintilla', { vol: 0.45, tono: 1.2 });
  sai(E.viola - 0.1);
  add(E.viola - 0.03, 'select', { tono: 0.95 }); add(E.viola + 0.04, 'pop', { vol: 0.6, tono: 0.85 }); entra(E.viola);
  add(E.squadra, 'flap', { vol: 0.55 });   // a bandeira do time balança
  add(E.corona - 0.04, 'flap', { vol: 0.45 }); add(E.corona + 0.03, 'ding', { vol: 0.55, tono: 1.3 }); add(E.corona + 0.1, 'scintilla', { vol: 0.4 });
  add(E.neon - 0.03, 'select', { tono: 1.4 }); add(E.neon + 0.06, 'ding', { vol: 0.45, tono: 1.8 }); add(E.neon + 0.1, 'riser', { dur: 0.3, vol: 0.25 });
  add(E.neon + 0.45, 'pop', { vol: 0.45, tono: 1.1 }); add(E.neon + 0.55, 'pop', { vol: 0.4, tono: 1.25 });   // troféu e tricolore
  add(E.una2 - 0.05, 'whoosh', { vol: 0.75, dur: 0.95 });
  add(E.oro - 0.03, 'coin'); add(E.oro + 0.05, 'ding', { vol: 0.55, tono: 1.5 }); add(E.oro + 0.1, 'scintilla', { vol: 0.65, tono: 1.1 });
  for (let k = 0; k < 5; k++) add(E.oro + 0.12 + k * 0.08, 'tick', { vol: 0.32, tono: 1.6 + k * 0.1 });
  add(E.oro + 0.4, 'pop', { vol: 0.4, tono: 1.2 });
  TAGLI().forEach(tc => { add(tc - 0.01, 'boom', { vol: 0.22 }); add(tc, 'pop', { vol: 0.35, tono: 0.7 }); });   // corte seco
  // 3. a noite cai e os fogos explodem
  add(E.notte - 0.2, 'whoosh', { vol: 0.7, dur: 1.0, giu: true }); add(E.notte, 'boom', { vol: 0.45 }); add(E.notte + 0.05, 'vento', { vol: 0.25, dur: 1.2 });
  add(E.esplodono - 0.3, 'silenzio', { dur: 0.35 });
  // o assobio do 'fuoco' dura 0,32 s antes do estouro: começa antes para o estouro cair junto com a explosão
  scoppi().forEach((tb, k) => add(tb - 0.32, 'fuoco', { vol: (k < 3 ? 0.8 : 0.55) * (1 - 0.6 * fase(tb, E.per, E.tre - E.per)), tono: 0.85 + ((k * 3) % 5) * 0.1 }));
  add(E.esplodono + 0.02, 'boom', { vol: 0.6 });
  // 4. só três: a sua pode ser a quarta
  add(E.per - 0.2, 'whoosh', { vol: 0.6, dur: 0.8 }); entra(E.per - 0.05, true);
  for (let i = 0; i < 3; i++) add(E.per + 0.15 + i * 0.32, 'pop', { vol: 0.55, tono: 0.9 + i * 0.12 });
  add(E.tre, 'stamp', { vol: 0.6 });
  add(E.tua - 0.05, 'select', { tono: 1.2 }); add(E.tua + 0.05, 'scintilla', { vol: 0.5, tono: 1.3 });
  add(E.quarta, 'ding', { vol: 0.55, tono: 1.25 }); add(E.quarta + 0.3, 'pop', { vol: 0.6 }); add(E.quarta + 0.32, 'coin', { vol: 0.45 });
  // 5. atividades: Vetrina, loja, outdoor
  sai(E.nonsolo);
  add(E.nonsolo - 0.1, 'whoosh', { vol: 0.7, dur: 1.2, giu: true });
  add(E.diciassette - 0.35, 'riser', { dur: 0.33, vol: 0.5 }); add(E.diciassette - 0.02, 'boom', { vol: 0.55 }); add(E.diciassette, 'stamp', { vol: 0.9 }); entra(E.diciassette - 0.05, true);
  for (let t = E.diciassette + 0.6, k = 0; t < E.negozi - 0.4; t += 0.22, k++) add(t, 'tick', { vol: 0.26, tono: 1.0 + (k % 4) * 0.08 });   // a lista rola
  sai(E.negozi - 0.1);
  add(E.negozi - 0.25, 'whoosh', { vol: 0.75, dur: 0.6 }); add(E.negozi + 0.25, 'select', { tono: 1.0 }); add(E.negozi + 0.3, 'pop', { vol: 0.5 });
  add(E.cartelloni - 0.2, 'whoosh', { vol: 0.8, dur: 0.6 }); add(E.cartelloni + 0.35, 'stamp', { vol: 0.7 }); add(E.cartelloni + 0.4, 'pop', { vol: 0.5, tono: 1.2 });
  // 6. visitas
  add(E.quattro - 0.25, 'whoosh', { vol: 0.65, dur: 0.9, giu: true }); entra(E.quattro, true);
  for (let t = E.quattro + 0.1; t < E.cinquanta + 0.5; t += 0.08) add(t, 'tick', { vol: 0.22, tono: 1.1 + 0.5 * (t - E.quattro) / (E.cinquanta + 0.5 - E.quattro) });
  add(E.cinquanta + 0.5, 'coin', { vol: 0.7 }); add(E.visite, 'ding', { vol: 0.5, tono: 1.4 });
  // 7. gente que não te conhece chega até a loja
  sai(E.gente);
  add(E.gente - 0.1, 'whoosh', { vol: 0.6, dur: 0.8 });
  add(E.conosce, 'whoosh', { vol: 0.7, dur: 1.0 });
  PERS.forEach((p, i) => { add(tPers() + p.ini + 0.05, 'whoosh', { vol: 0.12, dur: 0.5 }); add(tPers() + p.ini + 1.1, 'bolla', { vol: 0.4, tono: 0.9 + (i % 5) * 0.08 }); });
  add(E.scopre, 'notifica', { vol: 0.6 }); entra(E.scopre);
  add(E.tocca - 0.1, 'tap', { vol: 0.9 }); add(E.tocca + 0.2, 'pop', { vol: 0.6, tono: 1.0 }); add(E.tocca + 0.25, 'whoosh', { vol: 0.3, dur: 0.4 });
  add(E.scrive - 0.15, 'tap', { vol: 0.9 }); add(E.scrive - 0.05, 'select', { tono: 1.3 });
  sai(E.whatsapp);
  add(E.whatsapp - 0.05, 'pop', { vol: 0.6, tono: 1.1 });
  const nCh = [...MSG].length;
  for (let k = 0; k < nCh; k += 2) add(E.whatsapp + 0.15 + 0.9 * k / nCh, 'tasto', { vol: 0.5, tono: 0.9 + ((k * 7) % 5) * 0.05 });
  add(E.whatsapp + 1.1, 'notifica', { vol: 0.75, tono: 1.1 });
  // 8. vagas poucas
  sai(E.posti);
  add(E.posti - 0.15, 'whoosh', { vol: 0.55, dur: 0.6 }); entra(E.posti);
  add(E.posti + 0.2, 'pop', { vol: 0.45, tono: 1.0 }); add(E.posti + 0.35, 'pop', { vol: 0.4, tono: 1.15 });
  add(E.pochi - 0.45, 'silenzio', { dur: 0.45 }); add(E.pochi - 0.4, 'rullo', { dur: 0.38, vol: 0.6 });
  add(E.pochi - 0.02, 'boom', { vol: 0.7 }); add(E.pochi, 'stamp', { vol: 1 });
  for (let k = 1; k <= 2; k++) add(E.pochi + k * 0.33, 'tick', { vol: 0.35, tono: 0.8 });
  // 9. o jogo não para: números
  sai(E.intanto);
  add(E.intanto - 0.1, 'whoosh', { vol: 0.85, dur: 1.3, giu: true }); add(E.ferma - 0.05, 'riser', { dur: 0.5, vol: 0.4 }); add(E.ferma + 0.3, 'pop', { vol: 0.5 });
  [E.trenta, E.ottanta, E.dieci].forEach((ev, i) => {
    add(ev - 0.4, 'whoosh', { vol: 0.4, dur: 0.45 }); add(ev - 0.35, 'pop', { vol: 0.6, tono: 0.95 + i * 0.1 });
    for (let k = 0; k < 9; k++) add(ev - 0.3 + k * 0.08, 'tick', { vol: 0.2, tono: 1.2 + i * 0.1 + k * 0.04 });
    add(ev + 0.55, i === 2 ? 'notifica' : 'coin', { vol: 0.6 });
  });
  // 10. domingo + chamada final
  sai(E.domenica);
  add(E.domenica - 0.1, 'whoosh', { vol: 0.6, dur: 0.8 }); entra(E.domenica, true);
  for (let t = E.domenica + 0.5; t < E.scrivi - 0.3; t += 1) add(t, 'tick', { vol: 0.38, tono: 0.8 });
  add(E.nove, 'ding', { vol: 0.45, tono: 1.2 }); add(E.presidente, 'flap', { vol: 0.7 });
  sai(E.scrivi);
  add(E.scrivi - 0.1, 'whoosh', { vol: 0.6, dur: 1.0, giu: true }); add(E.scrivi, 'pop', { tono: 0.9 }); add(E.regione - 0.3, 'pop', { tono: 1.05 });
  add(E.crescere - 0.1, 'stamp', { vol: 0.7 }); add(E.casa + 0.3, 'pop', { tono: 1.2 }); add(E.casa + 0.45, 'ding', { vol: 0.5 });
  return s.sort((a, b) => a.t - b.t);
}

async function preparar(roteiro) {
  R = roteiro; E = R.eventi;
  await Promise.all(['900 104px Nunito', '900 60px Nunito', '800 40px Nunito', '700 30px Nunito'].map(f => document.fonts.load(f)));
  await document.fonts.ready;
  citta = new Citta(mappa, D);
  decori = new Decori(D, mappa, citta, null);
  lim0 = Math.min(1, R.ieri / totale);
  punti = criarPontos();
  fine = Date.parse(D.snap.mandato.fine);
  try { cfgNegozio = await (await fetch(`data/negozio.json?t=${Date.now()}`)).json(); } catch { cfgNegozio = null; }
  // casas decoradas reais
  deco = R.decorate.map(x => { const c = D.porConta.get(x.conta); if (!c) throw new Error(`@${x.conta} não está no mapa`); return { casa: c, pos: citta.posCasa(c), x }; });
  const nomeL = c => esc(D.luoghi[c.luogo].nome).toUpperCase();
  const topoD = (d, folga = 0.45) => () => { const a = decori.attive.get(d.casa.conta); return { x: d.pos.x, y: d.pos.y + ((a?.pilha ?? ALTURA_NIVEL[d.casa.livello]) + folga) * LOTE, z: d.pos.z }; };
  const [mo, gi, ra] = deco;
  const rotulo = (d, extra, ini, fim, folga) => etichette.push({ el: novaEtichetta(`<div class="box${d.x.extra.includes('cornice') ? ' cornice' : ''}"><b>@${esc(d.casa.conta)}</b><span>📍 ${nomeL(d.casa)}</span><small>${extra}</small></div><div class="freccia"></div>`), pos: topoD(d, folga), ini, fim });
  rotulo(mo, '💜 VIOLA · 👑 CORONA · 🌈 NEON', E.viola, taglio1());
  rotulo(gi, '✨ CASA D’ORO · 🖼 CORNICE', E.oro + 0.1, taglio2());
  rotulo(ra, '❤️ GRANATA · 🌈 NEON · 🎆 FUOCHI', E.esplodono + 0.25, E.per, 0.15);   // baixo: os fogos ficam em cima
  // loja e outdoor em destaque
  shop = D.commerci.find(c => c.nome === R.negozio); bill = D.commerci.find(c => c.nome === R.cartellone);
  if (!shop || !bill) throw new Error('loja/outdoor do roteiro não está no snapshot');
  shop.pos = citta.posCommercio(shop); bill.pos = citta.posCommercio(bill);
  const cid = cm => esc(cm.luogo.nome).toUpperCase();
  etichette.push({ el: novaEtichetta(`<div class="box bianco"><b>🏪 ${esc(shop.nome)}</b><span>📍 ${cid(shop)}</span></div><div class="freccia"></div>`), pos: () => ({ x: shop.pos.x, y: shop.pos.y + LOTE * 1.15, z: shop.pos.z }), ini: E.negozi + 0.3, fim: E.cartelloni - 0.1 });
  etichette.push({ el: novaEtichetta(`<div class="box"><b>📣 ${esc(bill.nome)}</b><span>📍 ${cid(bill)}</span></div><div class="freccia"></div>`), pos: () => ({ x: bill.pos.x, y: bill.pos.y + LOTE * 1.45, z: bill.pos.z }), ini: E.cartelloni + 0.4, fim: E.quattro + 0.3 });
  etichette.push({ el: novaEtichetta(`<div class="box bianco"><b>🏪 ${esc(shop.nome)}</b><span>📍 ${cid(shop)}</span></div><div class="freccia"></div>`), pos: () => ({ x: shop.pos.x, y: shop.pos.y + LOTE * 1.15, z: shop.pos.z }), ini: E.scopre, fim: E.tocca + 0.2, lampo: E.scopre });
  // as 3 casas + a sua
  const casinha = (muro, tetto, em, d) => `<div class="s"><div class="ic"><div class="tetto" style="border-bottom-color:${tetto}"></div><div class="muro" style="background:${muro}"></div><div class="em">${em}</div></div><b>@${esc(d.casa.conta)}</b><small>${esc(D.luoghi[d.casa.luogo].nome)}</small></div>`;
  const sq = id => SQUADRE.find(s => s.id === id);
  $('#tre .slot').innerHTML = casinha(sq('viola').muro, sq('viola').tetto, '👑', mo) + casinha('#F2C230', '#C99A1E', '✨', gi) + casinha(sq('granata').muro, sq('granata').tetto, '🎆', ra) +
    '<div class="s vuoto"><div class="ic">?</div><b>LA TUA?</b><small>&nbsp;</small></div>';
  $('#chip-decora').innerHTML = `🎨 DECORA LA TUA · ${esc(R.prezzo_decora)}`;
  // Vetrina: as atividades reais (logo, nome, cidade)
  const lista = [...D.commerci].sort((a, c) => (a.prodotto === c.prodotto ? 0 : a.prodotto === 'cartellone' ? -1 : 1));
  $('#vetrina .scorre').innerHTML = lista.map(cm => `<div class="riga"><div class="logo" style="${cm.logo ? `background-image:url('${cm.logo}');` : `background-color:${cm.colore};`}">${cm.logo ? '' : esc(cm.nome[0].toUpperCase())}</div><div class="quem"><b>${esc(cm.nome)}</b><small>📍 ${esc(cm.luogo.nome)}${cm.tipo ? ` · ${esc(cm.tipo)}` : ''}</small></div><div class="tag${cm.prodotto === 'cartellone' ? ' c' : ''}">${cm.prodotto === 'cartellone' ? '📣 CARTELLONE' : '🏪 NEGOZIO'}</div></div>`).join('');
  await Promise.all(lista.filter(cm => cm.logo).map(cm => new Promise(ok => { const i = new Image(); i.onload = i.onerror = ok; i.src = cm.logo; })));
  // ficha da loja e WhatsApp
  for (const el of document.querySelectorAll('#scheda .logo, #chat .logo')) el.style.backgroundImage = shop.logo ? `url('${shop.logo}')` : '';
  $('#scheda .testa').style.background = shop.colore;
  $('#scheda .testa b').textContent = shop.nome;
  $('#scheda .corpo p').textContent = shop.descrizione;
  $('#scheda .corpo small').textContent = `📍 ${shop.luogo.nome}${shop.tipo ? ` · ${shop.tipo}` : ''}`;
  $('#chat .barra b').textContent = shop.nome;
  // vagas reais da cidade da loja (plano pelo tamanho do comune, como no site)
  const piani = cfgNegozio?.piani ?? [], pop = shop.luogo.comune.pop;
  const piano = piani.find(x => pop >= x.da) ?? piani.at(-1), tot = piano?.posti?.negozio ?? 3;
  const presi = shop.luogo.commerci.filter(c => c.prodotto === 'negozio').length;
  $('#posti h2').innerHTML = `🏪 NEGOZI A ${esc(shop.luogo.nome.toUpperCase())}`;
  $('#posti .box').innerHTML = Array.from({ length: tot }, (_, i) => (i < presi ? '<div class="preso">🏪<small>OCCUPATO</small></div>' : '<div class="libero">➕<small>LIBERO</small></div>')).join('');
  $('#posti .nota').textContent = `${tot - presi === 1 ? 'RESTA SOLO 1 POSTO' : `RESTANO SOLO ${tot - presi} POSTI`} · chi arriva prima resta`;
  // números do jogo
  $('#stats').innerHTML = [['👥', 'GIOCATORI'], ['💬', 'COMMENTI'], ['❤️', 'FOLLOWER']].map(([em, l]) => `<div class="t"><div class="em">${em}</div><div><b>0</b><small>${l}</small></div></div>`).join('');
  $('#coriandoli').innerHTML = CONF.map(c => `<i style="background:${c.cor}"></i>`).join('');
  $('#persone').innerHTML = PERS.map(p => `<i style="background:${p.cor}">${p.l}</i>`).join('');
  montarChaves();
  scene = [
    [0, 'IERI ERANO', '<span class="g">21.000</span>', '', 'grande'],
    [E.oggi - 0.05, t => `🏠 <span class="g">${num(caseOra(t))}</span>`, 'CASE OGGI', 'grande'],
    [E.citta - 0.1, t => `📍 <span class="g">${num(conta(t, E.citta - 0.1, 0.6, D.luoghi.length, 4400))}</span>`, 'CITTÀ', 'grande'],
    [E.alcune - 0.1, '', ''],
    [E.prime - 0.05, '✨ LE PRIME CASE', '<span class="g">DECORATE D’ITALIA</span>'],
    [E.viola - 0.1, '', ''],
    [E.oro - 0.05, '✨ TUTTA', '<span class="g">D’ORO</span>'],
    [E.notte - 0.1, '🌙 E DI NOTTE…', ''],
    [E.esplodono, '🎆 FUOCHI', '<span class="g">D’ARTIFICIO!</span>'],
    [E.per - 0.1, '', ''],
    [E.nonsolo - 0.05, 'E NON CI SONO', '<span class="g">SOLO CASE…</span>'],
    [E.diciassette - 0.1, '', ''],
    [E.negozi + 0.2, '🏪 NEGOZI', ''],
    [E.cartelloni + 0.3, '📣 CARTELLONI', '<span class="g">GIGANTI</span>'],
    [E.quattro - 0.1, '', ''],
    [E.gente - 0.05, 'GENTE CHE', '<span class="g">NON TI CONOSCE…</span>'],
    [E.scopre - 0.05, '', ''],
    [E.intanto - 0.05, 'IL GIOCO', '<span class="g">NON SI FERMA 🚀</span>'],
    [E.trenta - 0.45, '', ''],
  ];
  if (R.copertina) {
    const cp = R.copertina;
    const el = document.createElement('div');
    el.className = 'forte';
    el.style.cssText = `position:absolute;left:30px;right:30px;top:${cp.titolo_top}px;text-align:center;line-height:1.05;`;
    el.innerHTML = cp.linee.map(([txt, cor, size]) => `<div style="font-size:${size}px;-webkit-text-stroke-width:${Math.round(size * 0.19)}px"${cor ? ` class="${cor === true ? 'g' : cor}"` : ''}>${esc(txt)}</div>`).join('');
    document.body.appendChild(el);
    if (cp.senza_testa) $('#testa').style.display = 'none';
    $('#etichette').style.display = 'none';   // capa: uma ideia só, o título não disputa com rótulos
  }
  console.log(`${totale} case (ieri ${R.ieri}) · ${D.luoghi.length} città · deco ${deco.map(d => `@${d.casa.conta} ${D.luoghi[d.casa.luogo].nome} liv ${d.casa.livello}`).join(', ')} · loja ${shop.nome} (${shop.luogo.nome}, ${presi}/${tot}) · outdoor ${bill.nome} (${bill.luogo.nome}) · ${D.commerci.length} attività · contatori ${JSON.stringify(D.snap.contatori)}`);
  quadro(0);
  return { durata: R.durata, fps: 30 };
}

iniciar().catch(e => console.error('erro ao carregar', e));
