// Reel "elezione" (reel 16): suspense da 1ª eleição com dados reais. Relógio das 21 + duelo no 1º segundo, as duas torres
// (pontos do mandato), a cascata dos sindaci (uma bolinha por comune que acende), "vuoi essere tu?", comentários e o
// "si riparte da zero". O último quadro repete o primeiro (relógio + mesma câmera), para emendar em loop.
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

let D, mappa, citta, R, E, chaves, punti, nSind, etichette = [], c1, c2, p1, p2, cityTu;
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

// uma bolinha por comune com candidato (casa com pontos na semana); acendem douradas em cascata, de norte a sul
function criarPontos() {
  const ls = D.luoghi.filter(l => l.casas.some(i => (D.casas[i].sett ?? 0) > 0));
  nSind = ls.length;
  const z0 = Math.min(...ls.map(l => l.z)), z1 = Math.max(...ls.map(l => l.z));
  const pos = new Float32Array(ls.length * 3), ord = new Float32Array(ls.length);
  ls.forEach((l, i) => {
    pos.set([l.x, mappa.altura(l.x, l.z) + 0.03, l.z], i * 3);
    ord[i] = clamp(0.85 * (l.z - z0) / (z1 - z0) + 0.15 * (((i * 7919) % 1000) / 1000));
  });
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
        float pop = 1.0 + 1.1 * sin(k * 3.1416) + 0.6 * k;
        gl_PointSize = clamp(0.05 * escala / -mv.z, 10.0, 15.0) * pop;
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
// sindaci: acendem no "e alla stessa ora…" até "sindaco"; no "zero" voltam a apagar (nova semana)
const limite = t => (t < E.zero ? suave(fase(t, E.ora5, E.sindaco + 0.2 - E.ora5)) : 1 - fase(t, E.zero, 0.45));

// cortes secos (flash + batida)
const TAGLI = () => [E.intesta - 0.1, E.ma - 0.1, E.e5 - 0.1, E.vuoi - 0.1, E.commenta - 0.1, E.perche - 0.1, E.stasera2 - 0.2];

// ---------- câmera ----------
function montarChaves() {
  const b = D.geo.bbox, alt = b.z1 - b.z0, dP = mappa.distPais();
  const paese = { x: (b.x0 + b.x1) / 2, z: (b.z0 + b.z1) / 2 - alt * 0.07, dist: dP, az: 0, giu: 0 };
  const P = (o, k = {}) => ({ x: o.x, z: o.z, giu: 0, ...k });
  const [T1, T2, T3, T4, T5, T6, T7] = TAGLI();
  const cena = (ini, fim, a, c) => [[ini, a], [fim - 0.01, c]];
  const mid = { x: paese.x, z: paese.z + alt * 0.05 };
  const ABRE = { ...paese, dist: dP * 1.02, az: -0.1 };
  const lista = [
    ...cena(0, T1, ABRE, { ...paese, dist: dP * 0.92, az: 0.06 }),
    // torres altas: câmera mais longe e a casa mais baixa na tela, para o rótulo caber
    ...cena(T1, T2, P(p1, { dist: 1.15, az: -0.4, giu: 0.28 }), P(p1, { dist: 0.95, az: 0.2, giu: 0.28 })),
    ...cena(T2, T3, P(p2, { dist: 1.15, az: 0.6, giu: 0.28 }), P(p2, { dist: 0.95, az: 0.05, giu: 0.28 })),
    ...cena(T3, T4, { ...paese, dist: dP * 0.86, az: 0.12 }, { ...paese, dist: dP * 1.0, az: -0.06 }),
    ...cena(T4, T5, P(cityTu, { dist: 1.7, az: 0.4, giu: 0.16 }), P(cityTu, { dist: 1.2, az: 1.05, giu: 0.16 })),
    ...cena(T5, T6, P(mid, { dist: dP * 0.5, az: -0.25 }), P(mid, { dist: dP * 0.44, az: 0.1 })),
    ...cena(T6, T7, { ...paese, dist: dP * 0.8, az: 0.15 }, { ...paese, dist: dP * 0.95, az: -0.02 }),
    [T7, { ...paese, dist: dP * 1.1, az: -0.22 }],
    [R.durata, ABRE],
  ];
  chaves = lista.sort((a, c) => a[0] - c[0]).map(([t, k]) => ({ t, k }));
}
function camera(t) {
  let i = 0;
  while (i < chaves.length - 2 && t >= chaves[i + 1].t) i++;
  const a = chaves[i], b = chaves[Math.min(i + 1, chaves.length - 1)];
  const s = b.t > a.t ? suave(clamp((t - a.t) / (b.t - a.t))) : 1;
  const sl = a.t >= TAGLI()[6] - 0.01 ? clamp((t - a.t) / (b.t - a.t)) : s;   // volta ao começo sem freada (loop)
  const A = a.k, B = b.k, l = (p, q) => p + (q - p) * sl;
  const dist = Math.exp(l(Math.log(A.dist), Math.log(B.dist)));
  const tremor = [[E.presidente, 0.4], [E.settemila, 0.35], [E.insegue, 0.35], [E.sindaco, 0.4], [E.tu, 0.3], [E.punti, 0.3], [E.zero, 0.45]]
    .reduce((v, [ti, d]) => v + (t >= ti && t < ti + d ? 0.014 * (1 - (t - ti) / d) * Math.sin((t - ti) * 70) : 0), 0);
  const soco = [E.presidente, E.sindaco, E.zero].reduce((v, ti) => v + (t >= ti && t < ti + 0.5 ? 0.12 * Math.sin(Math.PI * (t - ti) / 0.5) : 0), 0);
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
const batida = (t, ti) => (t >= ti && t < ti + 0.35 ? 1 + 0.3 * Math.sin(Math.PI * (t - ti) / 0.35) : 1);
const CORES = ['#FFC93C', '#2E9B55', '#FFFFFF', '#E0473C', '#3FA9F5', '#8E5CF7'];
const CONF = Array.from({ length: 64 }, (_, i) => ({ x: (i * 157) % 1080, atraso: ((i * 37) % 30) / 60, vel: 700 + ((i * 53) % 500), giro: ((i * 91) % 720) - 360, dx: ((i * 29) % 160) - 80, cor: CORES[i % CORES.length] }));
const BURST = () => [E.presidente, E.sindaco + 0.2];
function coriandoli(t) {
  const t0 = BURST().filter(b => t >= b).at(-1);
  [...$('#coriandoli').children].forEach((el, i) => {
    const c = CONF[i], dt = t0 == null ? -1 : t - t0 - c.atraso, vis = dt > 0 && dt < 2.0;
    el.style.opacity = vis ? String(1 - fase(dt, 1.4, 0.6)) : '0';
    if (vis) el.style.transform = `translate(${c.x + c.dx * Math.sin(dt * 4)}px, ${-60 + c.vel * dt}px) rotate(${c.giro * dt}deg)`;
  });
}

function quadro(t) {
  const dist = camera(t);
  const [T1, T2, T3, T4, T5, T6, T7] = TAGLI();
  punti.visible = dist > DIST_CIDADE * 0.55;
  punti.material.uniforms.lim.value = limite(t);
  // noite no relógio (gancho e fim) e na cascata dos sindaci
  const kn = t < T1 || (t >= T3 && t < T4) || t >= T7 ? 1 : 0;
  ceu(kn);
  $('#vignetta').style.opacity = String(kn);
  const fl = Math.max(...TAGLI().map(tc => (t >= tc ? 0.75 * (1 - fase(t, tc, 0.22)) : 0)),
    ...[E.presidente, E.sindaco, E.zero].map(ti => (t >= ti ? 0.6 * (1 - fase(t, ti, 0.3)) : 0)));
  $('#velo').style.opacity = String(fl);
  $('#velo').style.background = t >= E.presidente && t < E.presidente + 0.3 ? '#FFC93C' : '#FFFFFF';
  // relógio + duelo: já na tela no quadro 0 (gancho) e de volta no fim
  const rel = $('#orologio'), du = $('#duello'), vis = t < T1 || t >= T7;
  rel.style.opacity = du.style.opacity = vis ? '1' : '0';
  const kr = t >= T7 ? ressalto(fase(t, T7, 0.3)) : 1;
  rel.style.transform = `scale(${(0.6 + 0.4 * kr) * batida(t, E.ventuno) * batida(t, E.ventuno3)})`;
  du.style.transform = `scale(${0.6 + 0.4 * kr})`;
  rel.querySelector('i').style.opacity = Math.floor(t * 2) % 2 ? '0.25' : '1';   // dois-pontos piscando
  rel.querySelector('.giu').style.transform = `scale(${batida(t, E.presidente)})`;
  // títulos por cena
  const tit = $('#titolo'), cenaT = t >= T1 && t < T2 ? ['👑 IN TESTA', ''] : t >= T2 && t < T3 ? ['🔥 LO INSEGUE', ''] : t >= T3 && t < T4 ? [`🏛️ ${num(nSind * limite(t))}`, 'SINDACI STASERA'] : null;
  if (cenaT) {
    const ini = t < T2 ? T1 : t < T3 ? T2 : T3;
    mostrar(tit, t, ini, t < T2 ? T2 : t < T3 ? T3 : T4, 20);
    if (tit.querySelector('.t1').textContent !== cenaT[0]) tit.querySelector('.t1').textContent = cenaT[0];
    tit.querySelector('.t2').textContent = cenaT[1];
    tit.querySelector('.t1').style.transform = `scale(${batida(t, E.sindaco)})`;
  } else tit.style.opacity = '0';
  for (const e of etichette) {
    const v = t >= e.ini && t < e.fim;
    if (!v) { e.el.style.opacity = '0'; continue; }
    const pos = e.pos(), p = projetar(pos.x, pos.y, pos.z);
    const s = ressalto(fase(t, e.ini, 0.32)) * (1 - fase(t, e.fim - 0.2, 0.2));
    e.el.style.opacity = p.ok ? '1' : '0';
    e.el.style.transform = `translate(${p.x - e.el.offsetWidth / 2}px, ${p.y - e.el.offsetHeight}px) scale(${s})`;
    e.el.querySelector('.n').textContent = `${num(conta(t, e.n0, e.n1 - e.n0, e.c.sett, 0))} PUNTI`;
    e.el.querySelector('.n').style.transform = `scale(${batida(t, e.n1)})`;
    const em = e.el.querySelector('em');
    em.style.display = t >= e.em ? 'block' : 'none'; em.style.transform = `scale(${t >= e.em ? 0.5 + 0.5 * ressalto(fase(t, e.em, 0.3)) : 0})`;
  }
  carimbo($('#stamp-sindaco'), t, E.forte - 0.05, T4, -3);
  // vuoi essere tu?
  const tu = $('#tu');
  mostrar(tu, t, E.tu - 0.1, T5, 40);
  tu.querySelector('.ic').style.transform = `rotate(${5 * Math.sin(t * 5)}deg) scale(${batida(t, E.sindaco2)})`;
  pulo(tu.querySelector('.fascia'), t, E.sindaco2 - 0.05, 'translateX(-50%) rotate(-8deg)');
  pulo(tu.querySelector('.q'), t, E.citta6 - 0.1);
  // comentários com a cidade
  mostrar($('#feed'), t, T5, T6);
  $('#feed').querySelectorAll('.riga').forEach((r, i) => {
    const ti = [E.commenta + 0.05, E.citta7, E.commento, E.punti - 0.1][i];
    pulo(r, t, ti);
    r.querySelector('.pt').style.transform = `scale(${t >= ti + 0.2 ? ressalto(fase(t, ti + 0.2, 0.3)) * batida(t, E.punti) : 0})`;
  });
  // si riparte da zero
  const rs = $('#reset');
  mostrar(rs, t, T6, T7, 40);
  const nz = t < E.riparte ? c1.sett : Math.round(c1.sett * (1 - suave(fase(t, E.riparte, E.zero + 0.1 - E.riparte))));
  rs.querySelector('.n').textContent = num(nz);
  rs.querySelector('.n').style.transform = `scale(${batida(t, E.zero + 0.1)})`;
  [...rs.querySelectorAll('.t')].forEach((el, i) => pulo(el, t, E.zero + 0.1 + i * 0.2));
  coriandoli(t);
  legenda(t);
  mappa.renderer.render(mappa.scene, mappa.camera);
  return true;
}

// efeitos sonoros: um por acontecimento na tela; impactos (presidente, sindaci, zero) mais fortes, com silêncio antes
function suoni() {
  const s = [], add = (t, tipo, extra = {}) => s.push({ t, tipo, vol: 0.8, ...extra });
  const entra = (t, forte = false) => { add(t - 0.03, 'pop', { vol: forte ? 0.75 : 0.5 }); if (forte) add(t + 0.02, 'whoosh', { vol: 0.35, dur: 0.4 }); };
  const [T1, T2, T3, T4, T5, T6, T7] = TAGLI();
  // 1. gancho: relógio das 21 já na tela (tique-taque) + duelo
  add(0, 'boom', { vol: 0.5 }); add(0.02, 'ding', { vol: 0.5, tono: 0.75 });
  for (let t = 0.25, k = 0; t < T1 - 0.1; t += 0.5, k++) add(t, 'tick', { vol: 0.4, tono: k % 2 ? 0.75 : 0.9 });
  add(E.ventuno - 0.02, 'stamp', { vol: 0.7 }); add(E.elegge, 'pop', { vol: 0.45, tono: 1.1 });
  add(E.presidente - 0.45, 'silenzio', { dur: 0.42 }); add(E.presidente - 0.42, 'riser', { dur: 0.4, vol: 0.55 });
  add(E.presidente - 0.02, 'boom', { vol: 0.9 }); add(E.presidente, 'stamp', { vol: 1 }); add(E.presidente + 0.05, 'fischio', { vol: 0.3, dur: 0.6 }); add(E.presidente + 0.1, 'scintilla', { vol: 0.5 });
  TAGLI().forEach(tc => { add(tc - 0.12, 'whoosh', { vol: 0.42, dur: 0.3 }); add(tc - 0.01, 'boom', { vol: 0.22 }); add(tc, 'pop', { vol: 0.34, tono: 0.7 }); });
  // 2. torre de Andrea: rótulo, contagem até o "settemila", coroa
  entra(T1 + 0.1, true); add(E.andrea, 'pop', { vol: 0.55, tono: 1.1 }); add(E.azzano, 'tick', { vol: 0.4 });
  for (let t = E.andrea, k = 0; t < E.settemila; t += 0.07, k++) add(t, 'tick', { vol: 0.18, tono: 0.9 + 0.6 * k * 0.07 / (E.settemila - E.andrea) });
  add(E.settemila - 0.02, 'stamp', { vol: 0.8 }); add(E.settemila, 'coin', { vol: 0.6 }); add(E.punti0, 'flap', { vol: 0.55 }); add(E.punti0 + 0.05, 'ding', { vol: 0.5, tono: 1.4 });
  // 3. torre de Simone: contagem e "lo insegue"
  entra(T2 + 0.1, true); add(E.simone, 'pop', { vol: 0.55 }); add(E.brescia, 'tick', { vol: 0.4 });
  for (let t = E.simone, k = 0; t < E.insegue; t += 0.07, k++) add(t, 'tick', { vol: 0.18, tono: 0.85 + 0.6 * k * 0.07 / (E.insegue - E.simone) });
  add(E.insegue - 0.02, 'stamp', { vol: 0.75 }); add(E.insegue + 0.05, 'fuoco', { vol: 0.45 }); add(E.insegue + 0.1, 'whoosh', { vol: 0.35, dur: 0.4 });
  // 4. cascata dos sindaci (noite): pipocar crescente + impacto
  add(T3 + 0.05, 'vento', { vol: 0.25, dur: 1.6 });
  for (let t = E.ora5, k = 0; t < E.sindaco + 0.15; t += 0.06, k++) add(t, 'pop', { vol: 0.12 + 0.12 * fase(t, E.ora5, E.sindaco - E.ora5), tono: 0.8 + ((k * 7) % 9) / 14 });
  add(E.cinquemila, 'tick', { vol: 0.5, tono: 1.2 }); add(E.citta5, 'scintilla', { vol: 0.4 });
  add(E.sindaco - 0.4, 'riser', { dur: 0.38, vol: 0.5 });
  add(E.sindaco - 0.02, 'boom', { vol: 0.9 }); add(E.sindaco, 'stamp', { vol: 0.95 }); add(E.sindaco + 0.2, 'coin', { vol: 0.55 });
  for (let k = 0; k < 6; k++) add(E.sindaco + 0.25 + k * 0.11, 'pop', { vol: 0.22, tono: 1 + ((k * 5) % 7) * 0.08 });
  add(E.forte - 0.05, 'stamp', { vol: 0.75 }); add(E.comune, 'ding', { vol: 0.45, tono: 1.2 });
  // 5. vuoi essere tu?
  add(E.vuoi - 0.05, 'whoosh', { vol: 0.5, dur: 0.5, giu: true }); entra(E.tu - 0.1, true);
  add(E.sindaco2 - 0.05, 'flap', { vol: 0.6 }); add(E.sindaco2, 'select', { tono: 1.1 }); add(E.citta6 - 0.1, 'pop', { vol: 0.55, tono: 1.15 });
  // 6. comentários: bolha + moeda em cada um
  entra(T5 + 0.05, true);
  [E.commenta + 0.05, E.citta7, E.commento, E.punti - 0.1].forEach((ti, i) => { add(ti - 0.02, 'bolla', { vol: 0.55, tono: 0.95 + i * 0.07 }); add(ti + 0.2, 'coin', { vol: 0.42, tono: 1 + i * 0.1 }); });
  add(E.punti, 'fuoco', { vol: 0.45, tono: 1.1 });
  // 7. si riparte da zero: contagem regressiva e impacto
  entra(T6 + 0.05, true);
  for (let t = E.riparte, k = 0; t < E.zero + 0.05; t += 0.06, k++) add(t, 'tick', { vol: 0.22, tono: 1.4 - 0.6 * k * 0.06 / (E.zero + 0.1 - E.riparte) });
  add(E.zero - 0.02, 'boom', { vol: 0.85 }); add(E.zero + 0.08, 'stamp', { vol: 0.95 }); add(E.zero + 0.1, 'whoosh', { vol: 0.4, dur: 0.6, giu: true });
  add(E.zero + 0.3, 'pop', { vol: 0.5 }); add(E.zero + 0.5, 'pop', { vol: 0.5, tono: 1.15 });
  // 8. volta ao relógio (loop)
  entra(T7 + 0.05); add(E.ventuno3 - 0.02, 'stamp', { vol: 0.65 });
  for (let t = T7 + 0.4, k = 0; t < R.durata - 0.1; t += 0.5, k++) add(t, 'tick', { vol: 0.38, tono: k % 2 ? 0.75 : 0.9 });
  return s.sort((a, b) => a.t - b.t);
}

async function preparar(roteiro) {
  R = roteiro; E = R.eventi;
  await Promise.all(['900 104px Nunito', '900 60px Nunito', '800 40px Nunito', '700 30px Nunito'].map(f => document.fonts.load(f)));
  await document.fonts.ready;
  citta = new Citta(mappa, D);
  c1 = D.porConta.get(R.primo); c2 = D.porConta.get(R.secondo);
  if (!c1 || !c2) throw new Error('casas do duelo não estão no mapa');
  p1 = citta.posCasa(c1); p2 = citta.posCasa(c2);
  const lt = D.luoghi.find(l => l.nome === R.citta_tu);
  if (!lt) throw new Error(`${R.citta_tu} não está no mapa`);
  cityTu = { x: lt.x, z: lt.z };
  punti = criarPontos();
  const nomeL = c => esc(D.luoghi[c.luogo].nome).toUpperCase();
  const topo = (p, c) => () => ({ x: p.x, y: p.y + (ALTURA_NIVEL[c.livello] + 0.3) * LOTE, z: p.z });
  const gap = c1.sett - c2.sett;
  const [T1, T2, T3] = TAGLI();
  etichette.push({ el: novaEtichetta(`<div class="box"><b>@${esc(c1.conta)}</b><span>📍 ${nomeL(c1)}</span><span class="n"></span><em>👑 IN TESTA</em></div><div class="freccia"></div>`), pos: topo(p1, c1), c: c1, ini: T1 + 0.1, fim: T2, n0: E.andrea, n1: E.settemila, em: E.punti0 });
  etichette.push({ el: novaEtichetta(`<div class="box bianco"><b>@${esc(c2.conta)}</b><span>📍 ${nomeL(c2)}</span><span class="n"></span><em>−${num(gap)} 🔥</em></div><div class="freccia"></div>`), pos: topo(p2, c2), c: c2, ini: T2 + 0.1, fim: T3, n0: E.simone, n1: E.insegue, em: E.insegue });
  const du = $('#duello').children;
  [[c1, '🥇'], [c2, '🥈']].forEach(([c, m], i) => { du[i].querySelector('b').textContent = `${m} @${c.conta}`; du[i].querySelector('span').textContent = num(c.sett); });
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
    if (cp.senza_orologio) $('#orologio').style.display = 'none';
    $('#fisso').style.display = 'none';
    $('#coriandoli').style.display = 'none';
  }
  console.log(`dati ${D.snap.dati_fino} · @${c1.conta} ${D.luoghi[c1.luogo].nome} ${c1.sett} liv ${c1.livello} · @${c2.conta} ${D.luoghi[c2.luogo].nome} ${c2.sett} liv ${c2.livello} · gap ${gap} · sindaci ${nSind}`);
  quadro(0);
  return { durata: R.durata, fps: 30 };
}

iniciar().catch(e => console.error('erro ao carregar', e));
