// Reel "halloween" (reel 14) com dados reais: as casas de toda a Itália, a última noite de Halloween (noite + abóboras),
// a regra só de hoje (pontos ×2, cada amigo diferente sem casa +20 → +40, nome repetido não vale, story ×2), o relógio
// até a meia-noite de Roma e o dérbi de Brescia pela Presidência (as duas casas reais em 3D, pontos do mandato).
// window.preparar/quadro/suoni; tudo depende só de t.
import * as THREE from 'three';
import { carregar } from '../js/dati.js';
import { Mappa, COR_MAR } from '../js/mappa.js';
import { Citta, DIST_CIDADE, LOTE } from '../js/citta.js';
import { ALTURA_NIVEL } from '../js/modelli.js';

const $ = s => document.querySelector(s);
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const suave = s => (s < 0.5 ? 4 * s * s * s : 1 - Math.pow(-2 * s + 2, 3) / 2);
const ressalto = s => { const c = 1.9; return s <= 0 ? 0 : s >= 1 ? 1 : 1 + (c + 1) * Math.pow(s - 1, 3) + c * Math.pow(s - 1, 2); };
const fase = (t, ini, dur) => clamp((t - ini) / dur);
const esc = s => String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
const num = n => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
const conta = (t, ini, dur, v, de = 0) => de + (v - de) * (1 - Math.pow(1 - fase(t, ini, dur), 3));
const dd = n => String(n).padStart(2, '0');

let D, mappa, citta, R, E, chaves, punti, totale, lim0, scene, etichette = [], fine, mezzanotte;
let bs, c1, c2, p1, p2;
const GIORNO = { mar: new THREE.Color(COR_MAR), terra: new THREE.Color('#ffffff'), ceu: 2.3, sol: 2.4, ceuC: new THREE.Color('#ffffff'), solC: new THREE.Color('#fff1dc') };
const NOTTE = { mar: new THREE.Color('#1B2E55'), terra: new THREE.Color('#7381A8'), ceu: 1.1, sol: 0.7, ceuC: new THREE.Color('#B9C6FF'), solC: new THREE.Color('#A9BBFF') };
const TRAMONTO = { mar: new THREE.Color('#E58A5C'), terra: new THREE.Color('#FFD2B0'), ceu: 1.9, sol: 2.1, ceuC: new THREE.Color('#FFC6A0'), solC: new THREE.Color('#FF9A55') };

async function iniciar() {
  D = await carregar('video');
  totale = D.casas.length;
  mappa = new Mappa($('#mappa'), D.geo, D.rilievo, D.imagem, { gravacao: true });
  window.preparar = preparar;
  window.quadro = quadro;
  window.suoni = suoni;
}

// dia -> pôr do sol -> noite (k de 0 a 1)
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

// uma bolinha por cidade (3+ casas), acendendo na ordem em que as casas chegaram; as últimas ficam douradas
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
    uniforms: { lim: { value: 0 }, lim0: { value: 0 }, oro: { value: 0 }, zucca: { value: 0 }, escala: { value: 1920 / (2 * Math.tan(mappa.camera.fov * Math.PI / 360)) } },
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
      varying float vNovo; uniform float zucca;
      void main() {
        float d = length(gl_PointCoord - 0.5) * 2.0;
        if (d > 1.0) discard;
        vec3 base = mix(vec3(1.0), vec3(1.0, 0.55, 0.15), zucca);
        gl_FragColor = vec4(d > 0.62 ? vec3(0.08, 0.13, 0.2) : mix(base, vec3(1.0, 0.79, 0.24), vNovo), 1.0);
        #include <colorspace_fragment>
      }`,
  });
  const p = new THREE.Points(g, mat);
  p.frustumCulled = false; p.renderOrder = 5;
  mappa.scene.add(p);
  return p;
}
const tRampa = () => E.case + 0.5;
const limite = t => lim0 + (1 - lim0) * suave(fase(t, 0.1, tRampa() - 0.1));
const caseOra = t => R.da + (totale - R.da) * suave(fase(t, 0.1, tRampa() - 0.1));
// cortes secos (flash + batida): cada cena nova entra de supetão
const TAGLI = () => [E.halloween - 0.08, E.solo - 0.12, E.commenta - 0.1, E.ogni2 - 0.1, E.condividi - 0.1, E.sbrigati - 0.1, E.domani - 0.1, E.azzano - 0.1, E.brescia - 0.1, E.chi - 0.15];

// ---------- câmera: sempre em movimento (giro + zoom lento em cada cena) ----------
function montarChaves() {
  const b = D.geo.bbox, alt = b.z1 - b.z0, dP = mappa.distPais();
  const paese = { x: (b.x0 + b.x1) / 2, z: (b.z0 + b.z1) / 2 - alt * 0.07, dist: dP, az: 0, giu: 0 };
  const P = (o, k = {}) => ({ x: o.x, z: o.z, ...k });
  const lomb = { x: (p1.x + p2.x) / 2, z: (p1.z + p2.z) / 2 };
  const [T1, T2, T3, T4, T5, T6, T7, T8, T9, T10] = TAGLI();
  const cena = (ini, fim, a, b) => [[ini, a], [fim - 0.01, b]];
  const lista = [
    [0, { ...paese, dist: dP * 1.2, az: -0.12 }],
    [tRampa(), { ...paese, dist: dP * 0.98, az: 0 }],
    [E.stanotte, { ...paese, dist: dP * 0.95, az: 0.03 }],
    [T1 - 0.01, P(bs, { dist: dP * 0.45, az: 0.1, giu: 0 })],
    ...cena(T1, T2, P(bs, { dist: 1.3, az: 0.2, giu: 0.04 }), P(bs, { dist: 0.75, az: 0.9, giu: 0.06 })),
    ...cena(T2, T3, { ...paese, dist: dP * 0.86, az: 0.08, giu: 0 }, { ...paese, dist: dP * 0.95, az: -0.05, giu: 0 }),
    ...cena(T3, T4, P(bs, { dist: 0.85, az: -0.7, giu: -0.12 }), P(bs, { dist: 0.62, az: -0.1, giu: -0.12 })),
    ...cena(T4, T5, P(bs, { dist: 0.55, az: 2.0, giu: -0.15 }), P(bs, { dist: 0.48, az: 2.6, giu: -0.15 })),
    ...cena(T5, T6, { ...paese, dist: dP * 0.8, az: -0.1, giu: 0 }, { ...paese, dist: dP * 0.9, az: 0.1, giu: 0 }),
    ...cena(T6, T7, P(bs, { dist: 0.5, az: 3.6, giu: -0.12 }), P(bs, { dist: 0.38, az: 4.2, giu: -0.12 })),
    [T7, { ...paese, dist: dP * 0.9, az: 0, giu: 0 }],
    [E.derby - 0.1, { ...paese, dist: dP * 0.86, az: 0.05, giu: 0 }],
    // de cima (mapa da Lombardia), nunca rente ao chão: voo baixo vira um borrão verde
    [E.bresciano + 0.2, P(lomb, { dist: dP * 0.42, az: 0.1, giu: 0 })],
    [T8 - 0.01, P(lomb, { dist: dP * 0.34, az: 0.2, giu: 0 })],
    // torres altas: câmera mais longe e a casa mais baixa na tela, para o rótulo caber
    ...cena(T8, T9, P(p1, { dist: 1.15, az: -0.4, giu: 0.28 }), P(p1, { dist: 0.95, az: 0.15, giu: 0.28 })),
    ...cena(T9, T10, P(p2, { dist: 1.15, az: 0.6, giu: 0.28 }), P(p2, { dist: 0.95, az: 0.05, giu: 0.28 })),
    [T10, P(lomb, { dist: dP * 0.4, az: 0.15, giu: 0 })],
    [E.scrivi - 0.1, P(lomb, { dist: dP * 0.48, az: 0.05, giu: 0 })],
    [E.scrivi + 1.4, { ...paese, dist: dP * 0.98, az: 0, giu: 0 }],
    [R.durata, { ...paese, dist: dP * 1.05, az: 0.06 }],
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
  // tremidas nos impactos
  const tremor = [[E.case, 0.35], [E.tutto, 0.4], [E.doppio, 0.5], [E.nonvale, 0.4], [E.quaranta, 0.45], [E.raddoppiano, 0.35], [E.finisce, 0.35], [E.derby, 0.45], [E.testa, 0.3], [E.vincera, 0.35]]
    .reduce((v, [ti, d]) => v + (t >= ti && t < ti + d ? 0.014 * (1 - (t - ti) / d) * Math.sin((t - ti) * 70) : 0), 0);
  // "soco" de zoom nos impactos (a câmera avança e volta)
  const soco = [E.doppio, E.quaranta, E.derby].reduce((v, ti) => v + (t >= ti && t < ti + 0.5 ? 0.12 * Math.sin(Math.PI * (t - ti) / 0.5) : 0), 0);
  const az = l(A.az, B.az) + tremor, giu = l(A.giu, B.giu), x = A.x + (B.x - A.x) * sxz, z = A.z + (B.z - A.z) * sxz;
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
  const ent = ressalto(fase(t, ini, 0.32)), sai = fase(t, fim - 0.25, 0.25), vis = t >= ini && t < fim;
  el.style.opacity = vis ? String(1 - sai) : '0';
  if (vis) el.style.transform = `translateY(${(1 - Math.min(1, ent)) * sobe - sai * 40}px) scale(${0.85 + 0.15 * ent})`;
}
function pulo(el, t, ini, base = '') {
  const k = ressalto(fase(t, ini, 0.3));
  el.style.opacity = t >= ini ? '1' : '0';
  el.style.transform = `${base} translateY(${(1 - Math.min(1, k)) * 40}px) scale(${0.4 + 0.6 * k})`;
}
// carimbo: entra grande e assenta, com leve pulsação; some no fim
function carimbo(el, t, ini, fim, rot = -4) {
  const k = ressalto(fase(t, ini, 0.3)), vis = t >= ini && t < fim;
  el.style.opacity = vis ? String(1 - fase(t, fim - 0.25, 0.25)) : '0';
  if (vis) el.style.transform = `scale(${t < ini + 0.1 ? 1.6 - 0.6 * k : 1 + 0.035 * Math.sin((t - ini) * 10)}) rotate(${rot}deg)`;
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
const CORES = ['#FF7A1A', '#8E5CF7', '#FFC93C', '#151515', '#FFFFFF', '#2E9B55'];
const CONF = Array.from({ length: 64 }, (_, i) => ({ x: (i * 157) % 1080, atraso: ((i * 37) % 30) / 60, vel: 700 + ((i * 53) % 500), giro: ((i * 91) % 720) - 360, dx: ((i * 29) % 160) - 80, cor: CORES[i % CORES.length] }));
const BURST = () => [tRampa(), E.doppio, E.quaranta, E.vincera];
function coriandoli(t) {
  const t0 = BURST().filter(b => t >= b).at(-1);
  [...$('#coriandoli').children].forEach((el, i) => {
    const c = CONF[i], dt = t0 == null ? -1 : t - t0 - c.atraso, vis = dt > 0 && dt < 2.2;
    el.style.opacity = vis ? String(1 - fase(dt, 1.6, 0.6)) : '0';
    if (vis) el.style.transform = `translate(${c.x + c.dx * Math.sin(dt * 4)}px, ${-60 + c.vel * dt}px) rotate(${c.giro * dt}deg)`;
  });
}
// relógio: quanto falta para a meia-noite de Roma, a partir da hora dos dados
const resto = (alvo, t) => Math.max(0, alvo - (Date.parse(D.snap.dati_fino) + t * 1000)) / 1000;
function cifre(t) {
  const r = resto(fine, t);
  return [[Math.floor(r / 86400), 'giorni'], [Math.floor(r % 86400 / 3600), 'ore'], [Math.floor(r % 3600 / 60), 'min'], [Math.floor(r % 60), 'sec']];
}
const tZucche = i => E.spariscono + 0.05 + i * 0.12;

function quadro(t) {
  const dist = camera(t);
  punti.visible = dist > DIST_CIDADE * 0.55;
  const u = punti.material.uniforms;
  u.lim.value = limite(t); u.lim0.value = lim0;
  u.oro.value = 1 - fase(t, tRampa() + 0.6, 1.0);
  const kn = suave(fase(t, E.stanotte - 0.1, E.halloween - E.stanotte));
  u.zucca.value = kn;
  ceu(kn);
  $('#vignetta').style.opacity = String(kn);
  const velo = $('#velo');
  const fl = Math.max(...TAGLI().map(tc => (t >= tc ? 0.75 * (1 - fase(t, tc, 0.22)) : 0)),
    ...[E.doppio, E.quaranta, E.derby].map(ti => (t >= ti ? 0.6 * (1 - fase(t, ti, 0.3)) : 0)));
  velo.style.opacity = String(fl);
  velo.style.background = [E.doppio, E.quaranta].some(ti => t >= ti && t < ti + 0.3) ? '#FFB066' : '#FFFFFF';
  cabecalho(t);
  for (const e of etichette) {
    const vis = t >= e.ini && t < e.fim;
    if (!vis) { e.el.style.opacity = '0'; continue; }
    const pos = e.pos(), p = projetar(pos.x, pos.y, pos.z);
    const s = ressalto(fase(t, e.ini, 0.32)) * (1 - fase(t, e.fim - 0.2, 0.2));
    e.el.style.opacity = p.ok ? '1' : '0';
    e.el.style.transform = `translate(${p.x - e.el.offsetWidth / 2}px, ${p.y - e.el.offsetHeight}px) scale(${s})`;
    const em = e.el.querySelector('em');
    if (em) { em.style.display = t >= e.em ? 'block' : 'none'; em.style.transform = `scale(${t >= e.em ? 0.5 + 0.5 * ressalto(fase(t, e.em, 0.3)) : 0})`; }
  }
  coriandoli(t);
  // pontos ×2
  carimbo($('#stamp-x2'), t, E.doppio - 0.05, E.commenta - 0.1);
  // feed: comentários com amigos diferentes (+40) e o nome repetido (0)
  mostrar($('#feed'), t, E.commenta - 0.05, E.ogni2 - 0.1);
  const righe = $('#feed').querySelectorAll('.riga');
  [E.ogni, E.amico, E.diverso, E.ripetuto - 0.05].forEach((ti, i) => {
    pulo(righe[i], t, ti);
    const pt = righe[i].querySelector('.pt');
    pt.style.transform = `scale(${t >= ti + 0.25 ? ressalto(fase(t, ti + 0.25, 0.3)) : 0})`;
  });
  righe[3].classList.toggle('no', t >= E.nonvale - 0.05);
  carimbo($('#stamp-nonvale'), t, E.nonvale - 0.05, E.ogni2 - 0.1, 5);
  // amigo sem casa: +20 que vira +40
  const am = $('#amico'), fimA = E.condividi - 0.1;
  am.style.opacity = t < fimA ? String(1 - fase(t, fimA - 0.25, 0.25)) : '0';
  pulo(am.querySelector('.ic'), t, E.ogni2);
  am.querySelector('.q').textContent = t >= E.quaranta ? '✓' : '?';
  am.querySelector('.q').style.color = t >= E.quaranta ? 'var(--verde)' : '';
  pulo(am.querySelector('.l'), t, E.casa - 0.1);
  const n = am.querySelector('.n');
  n.textContent = t >= E.quaranta ? '+40' : '+20';
  n.style.opacity = t >= E.venti - 0.05 ? '1' : '0';
  n.style.transform = `scale(${t >= E.quaranta ? 1 + 0.5 * (1 - ressalto(fase(t, E.quaranta, 0.35))) : ressalto(fase(t, E.venti - 0.05, 0.3))})`;
  n.style.color = t >= E.quaranta ? 'var(--zucca)' : '';
  carimbo($('#x2'), t, E.quaranta + 0.1, fimA, 8);
  // story: +20 que dobra
  const st = $('#story'), fimS = E.sbrigati - 0.1;
  mostrar(st, t, E.condividi - 0.05, fimS, 60);
  st.querySelector('.barra i').style.width = `${100 * fase(t, E.condividi, fimS - E.condividi)}%`;
  const ps = st.querySelector('.pts');
  ps.textContent = t >= E.raddoppiano ? '+40 🔥' : '+20';
  ps.style.opacity = t >= E.storia ? '1' : '0';
  ps.style.transform = `scale(${t >= E.raddoppiano ? 1 + 0.5 * (1 - ressalto(fase(t, E.raddoppiano, 0.35))) : ressalto(fase(t, E.storia, 0.3))})`;
  st.querySelector('.casa').style.transform = `rotate(${4 * Math.sin(t * 5)}deg) scale(${1 + 0.04 * Math.sin(t * 9)})`;
  // relógio até meia-noite + abóboras que somem
  const ol = $('#orologio'), fimO = E.domani - 0.1;
  mostrar(ol, t, E.sbrigati - 0.05, fimO);
  const r = resto(mezzanotte, t);
  ol.querySelector('.c').textContent = `${dd(Math.floor(r / 3600))}:${dd(Math.floor(r % 3600 / 60))}:${dd(Math.floor(r % 60))}`;
  ol.querySelector('.c').style.color = t >= E.finisce && Math.floor((t - E.finisce) * 4) % 2 === 0 ? 'var(--rosso)' : '';
  $('#zucche').querySelectorAll('i').forEach((el, i) => {
    const ini = E.mezzanotte + 0.1 + i * 0.1, out = tZucche(i);
    const k = ressalto(fase(t, ini, 0.3)), ko = fase(t, out, 0.25);
    el.style.opacity = t >= ini && t < fimO ? String(1 - ko) : '0';
    el.style.transform = `translateY(${(1 - Math.min(1, k)) * 60 - ko * 60}px) scale(${(0.4 + 0.6 * k) * (1 + ko * 0.8)}) rotate(${6 * Math.sin(t * 6 + i)}deg)`;
  });
  [...$('#fumi').children].forEach((el, i) => {
    const k = fase(t, tZucche(i) + 0.1, 0.6);
    el.style.opacity = k > 0 && k < 1 && t < fimO ? String(1 - k) : '0';
    el.style.transform = `translateY(${-80 * k}px) scale(${0.6 + 0.8 * k})`;
  });
  // presidente: contagem, dérbi, rótulos das casas, placar
  mostrar($('#conto'), t, E.domani - 0.05, E.derby - 0.1);
  const cf = cifre(t).map(([v, l]) => `<div><b>${dd(v)}</b><small>${l}</small></div>`).join('');
  if ($('#conto .cifre').innerHTML !== cf) $('#conto .cifre').innerHTML = cf;
  $('#conto h2').classList.toggle('lampo', t >= E.presidente && t < E.presidente + 0.8);
  carimbo($('#stamp-derby'), t, E.derby - 0.05, E.azzano - 0.1);
  mostrar($('#derby'), t, E.chi - 0.1, E.scrivi - 0.05);
  const rr = $('#derby').querySelectorAll('.riga'), maxP = Math.max(c1.sett, c2.sett);
  [c1, c2].forEach((c, i) => {
    const ini = E.chi + 0.05 + i * 0.15;
    pulo(rr[i], t, ini);
    rr[i].querySelector('.pt').textContent = num(conta(t, ini, 0.8, c.sett, 0));
    rr[i].querySelector('.bar i').style.width = `${100 * (c.sett / maxP) * suave(fase(t, ini, 0.8))}%`;
  });
  $('#derby .gap').style.opacity = t >= E.vincera ? '1' : '0';
  const cta = $('#cta').children;
  mostrar(cta[0], t, E.scrivi - 0.05, R.durata + 1, 20);
  mostrar(cta[1], t, E.tagga - 0.1, R.durata + 1, 20);
  mostrar(cta[2], t, E.fai - 0.1, R.durata + 1, 20);
  mostrar(cta[3], t, E.tua + 0.3, R.durata + 1, 20);
  legenda(t);
  mappa.renderer.render(mappa.scene, mappa.camera);
  return true;
}

// efeitos sonoros: um por acontecimento na tela; os impactos (×2, +40, dérbi) são os mais fortes
function suoni() {
  const s = [], add = (t, tipo, extra = {}) => s.push({ t, tipo, vol: 0.8, ...extra });
  const entra = (t, forte = false) => { add(t - 0.03, 'pop', { vol: forte ? 0.75 : 0.5 }); if (forte) add(t + 0.02, 'whoosh', { vol: 0.35, dur: 0.4 }); };
  const sai = t => add(t - 0.25, 'whoosh', { vol: 0.22, dur: 0.35, giu: true });
  // 1. 24 mil casas
  add(0, 'riser', { dur: 0.3, vol: 0.35 }); add(0.05, 'stamp', { vol: 0.55 });
  for (let t = 0.12; t < tRampa(); t += 0.07) add(t, 'tick', { vol: 0.2, tono: 1 + 0.6 * t / tRampa() });
  for (let t = 0.2, k = 0; t < tRampa() - 0.1; t += 0.14, k++) add(t, 'pop', { vol: 0.17, tono: 0.8 + ((k * 37) % 9) / 12 });
  add(E.case - 0.02, 'boom', { vol: 0.6 }); add(E.case, 'stamp', { vol: 0.75 });
  add(tRampa(), 'coin', { vol: 0.65 }); add(tRampa() + 0.05, 'ding', { vol: 0.45, tono: 1.3 });
  for (let k = 0; k < 6; k++) add(tRampa() + 0.1 + k * 0.12, 'pop', { vol: 0.24, tono: 1 + ((k * 3) % 5) * 0.1 });
  // 2. cai a noite de Halloween
  add(E.stanotte - 0.1, 'whoosh', { vol: 0.6, dur: 1.4, giu: true }); add(E.stanotte + 0.1, 'vento', { vol: 0.35, dur: 2.0 });
  entra(E.stanotte - 0.05); add(E.ultima - 0.05, 'pop', { vol: 0.55, tono: 0.85 });
  TAGLI().forEach(tc => { add(tc - 0.12, 'whoosh', { vol: 0.42, dur: 0.3 }); add(tc - 0.01, 'boom', { vol: 0.25 }); add(tc, 'pop', { vol: 0.36, tono: 0.7 }); });
  add(E.halloween, 'scintilla', { vol: 0.5, tono: 0.8 }); add(E.halloween + 0.1, 'flap', { vol: 0.45 });
  add(E.cambia - 0.05, 'pop', { vol: 0.6 }); add(E.tutto - 0.35, 'rullo', { dur: 0.33, vol: 0.5 }); add(E.tutto, 'stamp', { vol: 0.8 });
  // 3. pontos ×2
  add(E.doppio - 0.5, 'silenzio', { dur: 0.48 }); add(E.doppio - 0.48, 'riser', { dur: 0.46, vol: 0.65 });
  add(E.doppio - 0.02, 'boom', { vol: 0.95 }); add(E.doppio, 'stamp', { vol: 1 }); add(E.doppio + 0.03, 'coin', { vol: 0.6 });
  add(E.doppio + 0.05, 'fuoco', { vol: 0.5, tono: 0.95 }); add(E.doppio + 0.35, 'fuoco', { vol: 0.4, tono: 1.15 });
  for (let k = 0; k < 8; k++) add(E.doppio + 0.12 + k * 0.11, 'pop', { vol: 0.24, tono: 1 + ((k * 5) % 7) * 0.08 });
  sai(E.commenta - 0.1);
  // 4. comentários livres, amigos diferentes
  entra(E.commenta - 0.05, true);
  [E.ogni, E.amico, E.diverso].forEach((ti, i) => { add(ti - 0.02, 'bolla', { vol: 0.55, tono: 0.95 + i * 0.08 }); add(ti + 0.25, 'coin', { vol: 0.45, tono: 1 + i * 0.12 }); });
  add(E.ripetuto - 0.07, 'bolla', { vol: 0.5, tono: 0.9 });
  add(E.nonvale - 0.4, 'silenzio', { dur: 0.35 });
  add(E.nonvale - 0.06, 'boom', { vol: 0.55 }); add(E.nonvale - 0.05, 'stamp', { vol: 0.9 }); add(E.nonvale, 'tick', { vol: 0.5, tono: 0.6 }); add(E.nonvale + 0.12, 'tick', { vol: 0.5, tono: 0.55 });
  sai(E.ogni2 - 0.1);
  // 5. amigo sem casa: +20 -> +40
  add(E.ogni2, 'pop', { vol: 0.65, tono: 0.9 }); add(E.ogni2 + 0.05, 'whoosh', { vol: 0.3, dur: 0.4 });
  add(E.casa - 0.1, 'pop', { vol: 0.5, tono: 1.1 });
  add(E.venti - 0.05, 'stamp', { vol: 0.65 }); add(E.venti, 'coin', { vol: 0.5 });
  add(E.quaranta - 0.45, 'silenzio', { dur: 0.42 }); add(E.quaranta - 0.42, 'riser', { dur: 0.4, vol: 0.6 });
  add(E.quaranta - 0.02, 'boom', { vol: 0.9 }); add(E.quaranta, 'stamp', { vol: 1 }); add(E.quaranta + 0.03, 'coin', { vol: 0.7, tono: 1.2 });
  add(E.quaranta + 0.05, 'scintilla', { vol: 0.55 }); add(E.quaranta + 0.1, 'pop', { vol: 0.6, tono: 1.2 });
  for (let k = 0; k < 6; k++) add(E.quaranta + 0.15 + k * 0.12, 'pop', { vol: 0.22, tono: 1 + ((k * 3) % 5) * 0.1 });
  sai(E.condividi - 0.1);
  // 6. story
  entra(E.condividi - 0.05, true); add(E.condividi + 0.1, 'select', { tono: 1.2 });
  add(E.storia - 0.02, 'notifica', { vol: 0.6 }); add(E.storia + 0.05, 'pop', { vol: 0.5 });
  add(E.raddoppiano - 0.02, 'stamp', { vol: 0.8 }); add(E.raddoppiano, 'fuoco', { vol: 0.5, tono: 1.0 }); add(E.raddoppiano + 0.05, 'coin', { vol: 0.55 });
  sai(E.sbrigati - 0.1);
  // 7. relógio e abóboras
  entra(E.sbrigati - 0.05, true);
  for (let t = E.sbrigati + 0.3, k = 0; t < E.domani - 0.4; t += 0.5, k++) add(t, 'tick', { vol: 0.42, tono: k % 2 ? 0.75 : 0.9 });   // tique-taque
  for (let i = 0; i < 6; i++) add(E.mezzanotte + 0.1 + i * 0.1, 'pop', { vol: 0.32, tono: 0.8 + i * 0.07 });
  add(E.finisce - 0.02, 'boom', { vol: 0.5 }); add(E.finisce, 'ding', { vol: 0.6, tono: 0.8 });
  for (let i = 0; i < 6; i++) { add(tZucche(i), 'whoosh', { vol: 0.25, dur: 0.25, giu: true }); add(tZucche(i) + 0.03, 'pop', { vol: 0.4, tono: 1.3 - i * 0.08 }); }
  sai(E.domani - 0.1);
  // 8. Presidente: contagem, dérbi, casas, placar
  entra(E.domani - 0.05, true);
  for (let t = E.domani + 0.5; t < E.derby - 0.4; t += 1) add(t, 'tick', { vol: 0.38, tono: 0.8 });
  add(E.ventuno, 'ding', { vol: 0.45, tono: 1.2 }); add(E.presidente, 'flap', { vol: 0.7 });
  sai(E.derby - 0.1);
  add(E.derby - 0.45, 'rullo', { dur: 0.43, vol: 0.6 });
  add(E.derby - 0.02, 'boom', { vol: 0.95 }); add(E.derby, 'stamp', { vol: 1 });
  add(E.bresciano - 0.1, 'whoosh', { vol: 0.75, dur: E.azzano - E.bresciano });   // voo até a Lombardia
  add(E.azzano + 0.15, 'pop', { vol: 0.6 }); add(E.testa - 0.02, 'flap', { vol: 0.55 }); add(E.testa, 'ding', { vol: 0.55, tono: 1.4 }); add(E.testa + 0.05, 'scintilla', { vol: 0.45 });
  add(E.brescia + 0.15, 'pop', { vol: 0.6, tono: 0.95 }); add(E.vicino, 'tick', { vol: 0.55, tono: 0.7 }); add(E.vicino + 0.1, 'whoosh', { vol: 0.35, dur: 0.4 });
  entra(E.chi - 0.1, true);
  for (let i = 0; i < 2; i++) for (let k = 0; k < 8; k++) add(E.chi + 0.05 + i * 0.15 + k * 0.09, 'tick', { vol: 0.18, tono: 1.1 + i * 0.15 + k * 0.04 });
  add(E.vincera - 0.02, 'boom', { vol: 0.55 }); add(E.vincera, 'stamp', { vol: 0.75 });
  // 9. chamada final
  sai(E.scrivi - 0.05);
  add(E.scrivi - 0.1, 'whoosh', { vol: 0.6, dur: 1.0, giu: true }); add(E.scrivi, 'pop', { tono: 0.9 });
  add(E.tagga - 0.1, 'pop', { tono: 1.05 }); add(E.fai - 0.1, 'stamp', { vol: 0.7 }); add(E.tua + 0.3, 'pop', { tono: 1.2 }); add(E.tua + 0.4, 'ding', { vol: 0.5 });
  return s.sort((a, b) => a.t - b.t);
}

async function preparar(roteiro) {
  R = roteiro; E = R.eventi;
  await Promise.all(['900 104px Nunito', '900 60px Nunito', '800 40px Nunito', '700 30px Nunito'].map(f => document.fonts.load(f)));
  await document.fonts.ready;
  citta = new Citta(mappa, D);
  lim0 = Math.min(1, R.da / totale);
  punti = criarPontos();
  fine = Date.parse(D.snap.mandato.fine);
  mezzanotte = Date.parse('2026-11-01T00:00:00+01:00');
  // cidade da noite de Halloween e as duas casas do dérbi (pontos do mandato)
  const lb = D.luoghi.find(l => l.nome === R.citta_notte);
  if (!lb) throw new Error(`${R.citta_notte} não está no mapa`);
  bs = { x: lb.x, z: lb.z };
  c1 = D.porConta.get(R.primo); c2 = D.porConta.get(R.secondo);
  if (!c1 || !c2) throw new Error('casas do dérbi não estão no mapa');
  p1 = citta.posCasa(c1); p2 = citta.posCasa(c2);
  const nomeL = c => esc(D.luoghi[c.luogo].nome).toUpperCase();
  const topo = (p, c) => () => ({ x: p.x, y: p.y + (ALTURA_NIVEL[c.livello] + 0.3) * LOTE, z: p.z });
  const gap = c1.sett - c2.sett;
  etichette.push({ el: novaEtichetta(`<div class="box"><b>@${esc(c1.conta)}</b><span>📍 ${nomeL(c1)} · ${num(c1.sett)} PUNTI</span><em>👑 IN TESTA</em></div><div class="freccia"></div>`), pos: topo(p1, c1), ini: E.azzano + 0.15, fim: E.brescia - 0.1, em: E.testa });
  etichette.push({ el: novaEtichetta(`<div class="box bianco"><b>@${esc(c2.conta)}</b><span>📍 ${nomeL(c2)} · ${num(c2.sett)} PUNTI</span><em>−${num(gap)} 🔥</em></div><div class="freccia"></div>`), pos: topo(p2, c2), ini: E.brescia + 0.15, fim: E.chi - 0.15, em: E.vicino });
  $('#derby .righe').innerHTML = [[c1, '🥇', '#FFC93C'], [c2, '🥈', '#3FA9F5']].map(([c, m, cor]) => `<div class="riga"><div class="pos">${m}</div><div class="who"><b>@${esc(c.conta)}</b><small>📍 ${nomeL(c)}</small><div class="bar"><i style="background:${cor}"></i></div></div><div class="pt"></div></div>`).join('');
  $('#derby .gap').textContent = `SOLO ${num(gap)} PUNTI DI DIFFERENZA`;
  $('#fumi').innerHTML = $('#zucche').querySelectorAll('i').length ? [...Array(6)].map((_, i) => `<i style="left:${60 + i * 165}px;top:880px">💨</i>`).join('') : '';
  $('#coriandoli').innerHTML = CONF.map(c => `<i style="background:${c.cor}"></i>`).join('');
  montarChaves();
  scene = [
    [0, t => `🏠 <span class="g">${num(caseOra(t))}</span>`, 'CASE IN ITALIA', 'grande'],
    [E.stanotte - 0.05, '🌙 STANOTTE…', ''],
    [E.ultima - 0.05, '🎃 ULTIMA NOTTE', '<span class="z">DI HALLOWEEN</span>'],
    [E.cambia - 0.05, 'E OGGI', '<span class="g">CAMBIA TUTTO!</span>'],
    [E.solo - 0.12, '', ''],
    [E.condividi - 0.05, '📲 CONDIVIDI', '<span class="g">NELLA STORIA</span>'],
    [E.sbrigati - 0.1, '⚡ SBRIGATI!', ''],
    [E.domani - 0.1, '', ''],
  ];
  if (R.copertina) {
    const cp = R.copertina;
    for (const b of [cp.alto, cp.basso].filter(Boolean)) {
      const el = document.createElement('div');
      el.className = 'forte';
      el.style.cssText = `position:absolute;left:20px;right:20px;top:${b.top}px;text-align:center;line-height:1.05;`;
      el.innerHTML = b.linee.map(([txt, cor, size]) => `<div style="font-size:${size}px;-webkit-text-stroke-width:${Math.round(size * 0.19)}px"${cor ? ` class="${cor === true ? 'g' : cor}"` : ''}>${esc(txt)}</div>`).join('');
      document.body.appendChild(el);
    }
    if (cp.senza_testa) $('#testa').style.display = 'none';
    $('#etichette').style.display = 'none';
  }
  console.log(`${totale} case · ${D.luoghi.length} città · @${c1.conta} ${D.luoghi[c1.luogo].nome} ${c1.sett} liv ${c1.livello} · @${c2.conta} ${D.luoghi[c2.luogo].nome} ${c2.sett} liv ${c2.livello} · gap ${gap} · dati ${D.snap.dati_fino} · commenti ${D.snap.contatori.commenti}`);
  quadro(0);
  return { durata: R.durata, fps: 30 };
}

iniciar().catch(e => console.error('erro ao carregar', e));
