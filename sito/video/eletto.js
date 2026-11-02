// Reel "eletto" (reel 18): resultado da 1ª eleição com dados reais e as decorações reais dos eleitos (decori.js):
// "È ufficiale" na torre do Presidente (cúpula, feixes de luz, fogos), Simone vira sindaco di Brescia, a cascata dos
// 4.803 sindaci, os sindaci de Roma/Napoli/Milano, a faixa tricolor, a busca "chi è il sindaco?", a nova semana do
// zero, o calendário de domingo e a chamada final, voltando à torre do Presidente (loop).
// window.preparar/quadro/suoni; tudo depende só de t.
import * as THREE from 'three';
import { carregar } from '../js/dati.js';
import { Mappa, COR_MAR } from '../js/mappa.js';
import { Citta, DIST_CIDADE, LOTE } from '../js/citta.js';
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

let D, mappa, citta, R, E, chaves, punti, nSind, etichette = [], deco = [], casas = {}, esempio;
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

// casa decorada de verdade (a mesma montagem do site): some do InstancedMesh da cidade e entra a versão do cargo
function decorare(conta, extra) {
  const casa = D.porConta.get(conta);
  if (!casa) throw new Error(`@${conta} não está no mapa`);
  const l = D.luoghi[casa.luogo];
  citta.nascoste.add(conta); citta.cache.delete(l.id); citta.ultimo = null;
  const o = costruisci(D, citta, () => !!mappa.notte, casa, { squadra: null, extra: new Set(extra) });
  citta.grupo.add(o.g);
  deco.push(o);
  return { casa, l, p: citta.posCasa(casa), topo: casa.y + (o.pilha + 0.3) * LOTE, h: ALTURA_NIVEL[casa.livello] };
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
const TAGLI = () => [E.piu - 0.1, E.simone - 0.1, E.e4 - 0.1, E.roma - 0.15, E.napoli - 0.15, E.milano - 0.15, E.daoggi - 0.1, E.e7 - 0.1, E.e8 - 0.1, E.attenzione - 0.15, E.domenica - 0.1, E.scrivi - 0.1];

// ---------- câmera ----------
function montarChaves() {
  const b = D.geo.bbox, alt = b.z1 - b.z0, dP = mappa.distPais();
  const paese = { x: (b.x0 + b.x1) / 2, z: (b.z0 + b.z1) / 2 - alt * 0.07, dist: dP, az: 0, giu: 0 };
  const P = (o, k = {}) => ({ x: o.p.x, z: o.p.z, giu: 0, ...k });
  // enquadramento pela altura da casa: torres de longe e com a casa mais baixa na tela (o rótulo cabe)
  const Q = (o, az, perto = 1) => P(o, { dist: clamp(0.45 + o.h * 0.075, 0.55, 1.2) * perto, az, giu: o.h > 1.5 ? 0.28 : 0.08 });
  const [T1, T2, T3, T4, T5, T6, T7, T8, T9, T10, T11, T12] = TAGLI();
  const cena = (ini, fim, a, c) => [[ini, a], [fim - 0.01, c]];
  const { pres: A, sec: S, j: J, e: Ed, le: L } = casas;
  const ABRE = Q(A, -0.55, 1.25);
  const lista = [
    ...cena(0, T1, ABRE, Q(A, -0.05, 1.08)),
    ...cena(T1, T2, Q(A, 0.4, 0.9), Q(A, 0.85, 0.82)),
    ...cena(T2, T3, Q(S, 0.6, 1.1), Q(S, 0.0, 0.95)),
    ...cena(T3, T4, { ...paese, dist: dP * 0.86, az: 0.12 }, { ...paese, dist: dP * 1.0, az: -0.06 }),
    ...cena(T4, T5, Q(J, -0.4, 1.1), Q(J, 0.1, 0.95)),
    ...cena(T5, T6, Q(Ed, 0.5, 1.1), Q(Ed, 0.0, 0.95)),
    ...cena(T6, T7, Q(L, -0.3, 1.1), Q(L, 0.25, 0.95)),
    ...cena(T7, T8, Q(esempio, 0.9, 1.0), Q(esempio, 1.7, 0.8)),
    // cúpula e feixes: de mais longe e mais alto, para caber a torre e a luz
    ...cena(T8, T9, P(A, { dist: 1.35, az: 1.1, giu: 0.22 }), P(A, { dist: 1.15, az: 1.6, giu: 0.22 })),
    ...cena(T9, T10, { ...paese, dist: dP * 0.55, az: -0.2 }, { ...paese, dist: dP * 0.5, az: 0.1 }),
    ...cena(T10, T11, { ...paese, dist: dP * 0.8, az: 0.15 }, { ...paese, dist: dP * 0.95, az: -0.02 }),
    ...cena(T11, T12, { ...paese, dist: dP * 1.0, az: -0.1 }, { ...paese, dist: dP * 0.9, az: 0.08 }),
    [T12, Q(A, -1.0, 1.45)],
    [R.durata, ABRE],
  ];
  chaves = lista.sort((x, y) => x[0] - y[0]).map(([t, k]) => ({ t, k }));
}
function camera(t) {
  let i = 0;
  while (i < chaves.length - 2 && t >= chaves[i + 1].t) i++;
  const a = chaves[i], b = chaves[Math.min(i + 1, chaves.length - 1)];
  const s = b.t > a.t ? suave(clamp((t - a.t) / (b.t - a.t))) : 1;
  const sl = a.t >= TAGLI()[11] - 0.01 ? clamp((t - a.t) / (b.t - a.t)) : s;   // volta à torre do Presidente sem freada (loop)
  const A = a.k, B = b.k, l = (p, q) => p + (q - p) * sl;
  const dist = Math.exp(l(Math.log(A.dist), Math.log(B.dist)));
  const tremor = [[E.ufficiale, 0.4], [E.seimila, 0.35], [E.mille, 0.3], [E.brescia, 0.35], [E.sindaci4, 0.4], [E.jacopo, 0.25], [E.eddy, 0.25], [E.leone, 0.25], [E.cupola, 0.3], [E.zero, 0.45], [E.ventuno, 0.35]]
    .reduce((v, [ti, d]) => v + (t >= ti && t < ti + d ? 0.012 * (1 - (t - ti) / d) * Math.sin((t - ti) * 70) : 0), 0);
  const soco = [E.ufficiale, E.sindaci4, E.zero].reduce((v, ti) => v + (t >= ti && t < ti + 0.5 ? 0.1 * Math.sin(Math.PI * (t - ti) / 0.5) : 0), 0);
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
const CORES = ['#FFC93C', '#2E9B55', '#FFFFFF', '#E0473C', '#3FA9F5', '#8E5CF7'];
const CONF = Array.from({ length: 64 }, (_, i) => ({ x: (i * 157) % 1080, atraso: ((i * 37) % 30) / 60, vel: 700 + ((i * 53) % 500), giro: ((i * 91) % 720) - 360, dx: ((i * 29) % 160) - 80, cor: CORES[i % CORES.length] }));
const BURST = () => [E.ufficiale, E.sindaci4 + 0.1];
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
  const [T1, T2, T3, T4, T5, T6, T7, T8, T9, T10, T11, T12] = TAGLI();
  punti.visible = dist > DIST_CIDADE * 0.55;
  punti.material.uniforms.lim.value = t < T3 ? 0 : suave(fase(t, E.e4, E.sindaci4 + 0.2 - E.e4));
  const kn = t < T2 || (t >= T3 && t < T4) || t >= T12 ? 1 : 0;
  ceu(kn);
  $('#vignetta').style.opacity = String(kn);
  for (const o of deco) o.anima(t * 1000);
  const fl = Math.max(...TAGLI().map(tc => (t >= tc ? 0.75 * (1 - fase(t, tc, 0.22)) : 0)), ...[E.ufficiale, E.sindaci4, E.zero].map(ti => (t >= ti ? 0.6 * (1 - fase(t, ti, 0.3)) : 0)));
  $('#velo').style.opacity = String(fl);
  $('#velo').style.background = t >= E.ufficiale && t < E.ufficiale + 0.3 ? '#FFC93C' : '#FFFFFF';
  carimbo($('#stamp-uff'), t, E.ufficiale - 0.05, T1);
  // títulos por cena
  const tit = $('#titolo');
  const cenas = [
    [T3, T4, () => [`🏛️ ${num(nSind * punti.material.uniforms.lim.value)}`, 'SINDACI ELETTI']],
    [T4, T5, () => ['ROMA', '']], [T5, T6, () => ['NAPOLI', '']], [T6, T7, () => ['MILANO', '']],
    [T7, T8, () => ['🇮🇹 FASCIA TRICOLORE', t >= E.casa6 ? 'PER OGNI SINDACO' : '']],
    [T8, T9, () => ["👑 CUPOLA D'ORO", t >= E.fasci - 0.05 ? '✨ E FASCI DI LUCE' : '']],
  ];
  const cn = cenas.find(([a, b]) => t >= a && t < b);
  if (cn) {
    mostrar(tit, t, cn[0], cn[1], 20);
    const [t1, t2] = cn[2]();
    if (tit.querySelector('.t1').textContent !== t1) tit.querySelector('.t1').textContent = t1;
    tit.querySelector('.t2').textContent = t2;
    tit.querySelector('.t1').style.transform = `scale(${batida(t, E.sindaci4)})`;
  } else tit.style.opacity = '0';
  // rótulos das casas
  for (const e of etichette) {
    const v = e.vis(t);
    if (!v) { e.el.style.opacity = '0'; continue; }
    const p = projetar(e.p.x, e.y, e.p.z);
    const s = e.ini(t) < 0 ? 1 : ressalto(fase(t, e.ini(t), 0.32));
    e.el.style.opacity = p.ok ? '1' : '0';
    e.el.style.transform = `translate(${p.x - e.el.offsetWidth / 2}px, ${p.y - e.el.offsetHeight}px) scale(${s})`;
    e.agg?.(t, e.el);
  }
  carimbo($('#stamp-sind'), t, E.diventa - 0.05, T3, 3);
  // busca: "chi è il sindaco della tua città?"
  const ce = $('#cerca');
  mostrar(ce, t, T9 + 0.05, T10);
  const parola = esempioBusca.citta, nTx = Math.floor(parola.length * fase(t, E.citta8, 0.6));
  ce.querySelector('.tx').textContent = t >= E.citta8 ? parola.slice(0, nTx) + (nTx < parola.length ? '|' : '') : '@ il_tuo_account, città…';
  ce.querySelector('.tx').style.color = t >= E.citta8 ? '' : '#9AA3AE';
  ce.querySelector('.bt').style.transform = `scale(${batida(t, E.cercalo)})`;
  pulo(ce.querySelector('.ris'), t, E.cercalo + 0.1);
  // nova semana
  const rs = $('#reset');
  mostrar(rs, t, T10, T11, 40);
  const P0 = D.snap.cariche.presidente.pts_elezione;
  rs.querySelector('.n').textContent = num(t < E.tutti ? P0 : Math.round(P0 * (1 - suave(fase(t, E.tutti, E.zero + 0.1 - E.tutti)))));
  rs.querySelector('.n').style.transform = `scale(${batida(t, E.zero + 0.1)})`;
  pulo(rs.querySelector('.t'), t, E.nuova - 0.05);
  pulo(rs.querySelector('.lead'), t, E.zero + 0.3);
  // calendário
  const ca = $('#calendario');
  mostrar(ca, t, T11, T12, 40);
  ca.querySelector('.cal').style.transform = `rotate(${-3 + 3 * Math.sin(t * 3)}deg) scale(${batida(t, E.domenica)})`;
  pulo(ca.querySelector('.ora'), t, E.ventuno - 0.1);
  // chamada final
  const cta = $('#cta').children;
  mostrar(cta[0], t, E.scrivi - 0.05, R.durata + 1, 20);
  mostrar(cta[1], t, E.prossimo - 0.1, R.durata + 1, 20);
  coriandoli(t);
  legenda(t);
  mappa.renderer.render(mappa.scene, mappa.camera);
  return true;
}

// efeitos sonoros: um por acontecimento na tela; impactos com silêncio antes
function suoni() {
  const s = [], add = (t, tipo, extra = {}) => s.push({ t, tipo, vol: 0.8, ...extra });
  const entra = (t, forte = false) => { add(t - 0.03, 'pop', { vol: forte ? 0.75 : 0.5 }); if (forte) add(t + 0.02, 'whoosh', { vol: 0.35, dur: 0.4 }); };
  const [T1, T2, T3, T4, T5, T6, T7, T8, T9, T10, T11, T12] = TAGLI();
  // 1. È ufficiale: rufar, impacto, fogos e confete
  add(0, 'rullo', { dur: 0.28, vol: 0.5 });
  add(E.ufficiale - 0.02, 'boom', { vol: 0.95 }); add(E.ufficiale, 'stamp', { vol: 1 }); add(E.ufficiale + 0.05, 'fischio', { vol: 0.3, dur: 0.6 });
  for (let k = 0; k < 5; k++) add(E.ufficiale + 0.3 + k * 0.55, 'fuoco', { vol: 0.4, tono: 0.9 + (k % 3) * 0.12 });
  add(E.presidente, 'flap', { vol: 0.6 }); add(E.andrea, 'ding', { vol: 0.5, tono: 1.3 }); add(E.azzano, 'scintilla', { vol: 0.45 });
  TAGLI().forEach(tc => { add(tc - 0.12, 'whoosh', { vol: 0.42, dur: 0.3 }); add(tc - 0.01, 'boom', { vol: 0.2 }); add(tc, 'pop', { vol: 0.34, tono: 0.7 }); });
  // 2. contagem dos pontos
  for (let t = E.piu, k = 0; t < E.punti1; t += 0.07, k++) add(t, 'tick', { vol: 0.18, tono: 0.9 + 0.6 * k * 0.07 / (E.punti1 - E.piu) });
  add(E.punti1 - 0.02, 'stamp', { vol: 0.8 }); add(E.punti1, 'coin', { vol: 0.6 });
  // 3. Simone: perdeu… mas vira sindaco
  entra(T2 + 0.1, true); add(E.perso, 'tick', { vol: 0.45, tono: 0.6 }); add(E.mille, 'pop', { vol: 0.5, tono: 0.8 });
  add(E.diventa - 0.4, 'silenzio', { dur: 0.36 }); add(E.diventa - 0.36, 'riser', { dur: 0.32, vol: 0.5 });
  add(E.diventa - 0.05, 'stamp', { vol: 0.9 }); add(E.sindaco3, 'flap', { vol: 0.55 }); add(E.brescia, 'ding', { vol: 0.5, tono: 1.2 }); add(E.brescia + 0.05, 'coin', { vol: 0.5 });
  // 4. cascata dos sindaci
  add(T3 + 0.05, 'vento', { vol: 0.25, dur: 1.6 });
  for (let t = E.e4, k = 0; t < E.sindaci4 + 0.15; t += 0.06, k++) add(t, 'pop', { vol: 0.12 + 0.12 * fase(t, E.e4, E.sindaci4 - E.e4), tono: 0.8 + ((k * 7) % 9) / 14 });
  add(E.sindaci4 - 0.35, 'riser', { dur: 0.33, vol: 0.5 }); add(E.sindaci4 - 0.02, 'boom', { vol: 0.85 }); add(E.sindaci4, 'stamp', { vol: 0.95 });
  // 5. Roma, Napoli, Milano
  [[T4, E.jacopo], [T5, E.eddy], [T6, E.leone]].forEach(([tc, tn], i) => { entra(tc + 0.08, true); add(tn, 'ding', { vol: 0.5, tono: 1.0 + i * 0.15 }); add(tn + 0.05, 'flap', { vol: 0.4 }); });
  // 6. faixa tricolor e 7. cúpula + luz
  entra(T7 + 0.08, true); add(E.fascia, 'select', { tono: 1.0 }); add(E.tricolore, 'flap', { vol: 0.6 }); add(E.casa6, 'pop', { vol: 0.5, tono: 1.15 });
  entra(T8 + 0.08, true); add(E.cupola - 0.02, 'stamp', { vol: 0.8 }); add(E.oro, 'scintilla', { vol: 0.55 }); add(E.fasci - 0.1, 'riser', { dur: 0.9, vol: 0.4 }); add(E.cielo, 'ding', { vol: 0.5, tono: 1.4 });
  // 8. busca
  entra(T9 + 0.08, true);
  for (let k = 0; k < esempioBusca.citta.length; k++) add(E.citta8 + 0.6 * k / esempioBusca.citta.length, 'tasto', { vol: 0.55, tono: 0.9 + (k % 3) * 0.08 });
  add(E.cercalo, 'tap', { vol: 0.8 }); add(E.cercalo + 0.1, 'pop', { vol: 0.6, tono: 1.1 }); add(E.mappa8, 'ding', { vol: 0.45, tono: 1.2 });
  // 9. nova semana: contagem regressiva até zero
  entra(T10 + 0.08, true); add(E.attenzione, 'tick', { vol: 0.5, tono: 0.7 });
  for (let t = E.tutti, k = 0; t < E.zero + 0.05; t += 0.06, k++) add(t, 'tick', { vol: 0.22, tono: 1.4 - 0.6 * k * 0.06 / (E.zero + 0.1 - E.tutti) });
  add(E.zero - 0.02, 'boom', { vol: 0.85 }); add(E.zero + 0.08, 'stamp', { vol: 0.95 }); add(E.zero + 0.3, 'pop', { vol: 0.5, tono: 1.15 });
  // 10. calendário e 11. chamada final
  entra(T11 + 0.08, true); add(E.domenica, 'stamp', { vol: 0.7 }); add(E.ventuno - 0.1, 'ding', { vol: 0.55, tono: 1.1 }); add(E.vota, 'fischio', { vol: 0.3, dur: 0.4 });
  add(E.scrivi - 0.05, 'pop', { tono: 0.9 }); add(E.citta11, 'tasto', { vol: 0.6 }); add(E.prossimo - 0.1, 'whoosh', { vol: 0.4, dur: 0.5 }); add(E.tu, 'stamp', { vol: 0.8 }); add(E.tu + 0.05, 'scintilla', { vol: 0.45 });
  return s.sort((a, b) => a.t - b.t);
}

let esempioBusca;
async function preparar(roteiro) {
  R = roteiro; E = R.eventi;
  await Promise.all(['900 104px Nunito', '900 60px Nunito', '800 40px Nunito', '700 30px Nunito'].map(f => document.fonts.load(f)));
  await document.fonts.ready;
  citta = new Citta(mappa, D);
  const k = D.snap.cariche;
  const sindacoDe = nome => Object.values(k.sindaci).map(s => D.porConta.get(s.conta)).find(c => c && D.luoghi[c.luogo].nome === nome);
  casas.pres = decorare(R.presidente, ['presidenza', 'fascia', 'fuochi']);
  casas.sec = decorare(R.secondo, ['fascia']);
  [casas.j, casas.e, casas.le] = R.sindaci.map(([, c]) => decorare(c, ['fascia']));
  esempio = decorare(R.fascia_esempio, ['fascia']);
  citta.atualizar?.(true);
  punti = criarPontos();
  const bari = sindacoDe('Bari');
  esempioBusca = { citta: 'Bari', conta: bari?.conta ?? '' };
  $('#cerca .ris b').textContent = '🏛️ Sindaco di Bari';
  $('#cerca .ris span').textContent = `@${esempioBusca.conta}`;
  $('#reset .lead').textContent = `👑 Ora in testa: @${k.leader.conta} · ${num(k.leader.pts)} punti`;
  const [T1, T2, T3, T4, T5, T6, T7, T8, T9, , , T12] = TAGLI();
  const nomeL = c => esc(c.l.nome).toUpperCase();
  const rot = (o, html, vis, ini, agg) => etichette.push({ el: novaEtichetta(html), p: o.p, y: o.topo, vis, ini, agg });
  const P0 = k.presidente.pts_elezione;
  rot(casas.pres, `<div class="box oro"><b>👑 @${esc(R.presidente)}</b><span>📍 ${nomeL(casas.pres)}</span><span class="n"></span><em>PRESIDENTE DEL CONSIGLIO</em></div><div class="freccia"></div>`,
    t => t < T2 || (t >= T8 && t < T9) || t >= E.tu + 0.15, t => (t < T1 ? -1 : t < T2 ? T1 : t < T9 ? T8 : E.tu + 0.15),
    (t, el) => { const n = el.querySelector('.n'); n.style.display = t >= T1 && t < T2 ? 'block' : 'none'; n.textContent = `${num(conta(t, E.piu, E.punti1 - E.piu, P0, 0))} PUNTI`; n.style.transform = `scale(${batida(t, E.punti1)})`; });
  rot(casas.sec, `<div class="box"><b>🥈 @${esc(R.secondo)}</b><span>📍 ${nomeL(casas.sec)}</span><em></em></div><div class="freccia"></div>`,
    t => t >= T2 && t < T3, () => T2 + 0.1,
    (t, el) => { const em = el.querySelector('em'); em.textContent = t >= E.diventa - 0.05 ? '🏛️ SINDACO DI BRESCIA' : t >= E.mille - 0.05 ? '−MENO DI 1.000 PUNTI' : ''; em.style.color = t >= E.diventa - 0.05 ? 'var(--verde)' : ''; el.querySelector('.box').classList.toggle('oro', t >= E.diventa - 0.05); });
  [[casas.j, T4, T5], [casas.e, T5, T6], [casas.le, T6, T7], [esempio, T7, T8]].forEach(([o, a, b]) => rot(o, `<div class="box oro"><b>🏛️ @${esc(o.casa.conta)}</b><span>SINDACO DI ${nomeL(o)}</span></div><div class="freccia"></div>`, t => t >= a && t < b, () => a + 0.1));
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
    if (cp.senza_stamp) $('#stamp-uff').style.display = 'none';
    $('#titolo').style.display = 'none';
    $('#fisso').style.display = 'none';
    $('#coriandoli').style.display = 'none';
  }
  console.log(`dati ${D.snap.dati_fino} · presidente @${R.presidente} ${P0} liv ${casas.pres.casa.livello} · sindaci ${nSind} · Roma @${casas.j.casa.conta} liv ${casas.j.casa.livello} · Napoli @${casas.e.casa.conta} liv ${casas.e.casa.livello} · Milano @${casas.le.casa.conta} liv ${casas.le.casa.livello} · esempio @${esempio.casa.conta} liv ${esempio.casa.livello} · Bari @${esempioBusca.conta} · leader @${k.leader.conta} ${k.leader.pts}`);
  quadro(0);
  return { durata: R.durata, fps: 30 };
}

iniciar().catch(e => console.error('erro ao carregar', e));
