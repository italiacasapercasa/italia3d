// Reel "ventimila" (reel 10) com dados reais: 20.000 casas, os traguardi delle città (fontana, scuola, stazione, campo
// em Roma), a corrida Roma × Napoli pelo primeiro ospedale, um herói real, a Vetrina, uma casa decorada paga,
// a presidência e o derby. window.preparar(roteiro), window.quadro(t), window.suoni(); tudo depende só de t.
import * as THREE from 'three';
import { carregar } from '../js/dati.js';
import { Mappa } from '../js/mappa.js';
import { Citta, DIST_CIDADE, LOTE, posEdificio } from '../js/citta.js';
import { ALTURA_NIVEL, geometriaEspecial } from '../js/modelli.js';
import { tipoDi } from '../js/commerci.js';
import { Decori } from '../js/decori.js';
import { inaugurazioni, sogliaDi, TRAGUARDI } from '../js/traguardi.js';

const $ = s => document.querySelector(s);
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const suave = s => (s < 0.5 ? 4 * s * s * s : 1 - Math.pow(-2 * s + 2, 3) / 2);
const ressalto = s => { const c = 1.9; return s <= 0 ? 0 : s >= 1 ? 1 : 1 + (c + 1) * Math.pow(s - 1, 3) + c * Math.pow(s - 1, 2); };
const fase = (t, ini, dur) => clamp((t - ini) / dur);
const esc = s => String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
const num = n => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
const conta = (t, ini, dur, v) => v * (1 - Math.pow(1 - fase(t, ini, dur), 3));

let D, mappa, citta, decori, R, E, chaves, punti, totale, scene, etichette = [], osp, roma, napoli, milano, ed = {}, eroe, emma, gianni, top3, derbyA, derbyB;

async function iniciar() {
  D = await carregar('video');
  totale = D.casas.length;
  mappa = new Mappa($('#mappa'), D.geo, D.rilievo, D.imagem, { gravacao: true });
  window.preparar = preparar;
  window.quadro = quadro;
  window.suoni = suoni;
}

// uma bolinha por cidade (3+ casas), que aparece quando a cidade nasce; "lim" = fração das casas já chegadas
function criarPontos() {
  const ordem = D.casas.map((c, i) => i).sort((a, b) => D.casas[a].ts - D.casas[b].ts);
  const rankCasa = new Float32Array(D.casas.length);
  ordem.forEach((i, k) => { rankCasa[i] = (k + 1) / ordem.length; });
  const rank = new Float32Array(D.luoghi.length), pos = new Float32Array(D.luoghi.length * 3);
  D.luoghi.forEach((l, i) => {
    rank[i] = l.casas.length >= 3 ? Math.min(...l.casas.map(c => rankCasa[c])) : 2;
    pos.set([l.x, mappa.altura(l.x, l.z) + 0.03, l.z], i * 3);
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('ord', new THREE.BufferAttribute(rank, 1));
  const mat = new THREE.ShaderMaterial({
    uniforms: { lim: { value: 1 }, escala: { value: 1920 / (2 * Math.tan(mappa.camera.fov * Math.PI / 360)) } },
    vertexShader: `
      attribute float ord; uniform float lim; uniform float escala; varying float vNovo;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        float k = clamp((lim - ord) * 40.0, 0.0, 1.0);
        float pop = k < 1.0 ? k * (1.0 + 0.6 * sin(k * 3.1416)) : 1.0;
        vNovo = 1.0 - k;
        gl_PointSize = ord > lim ? 0.0 : clamp(0.05 * escala / -mv.z, 13.0, 18.0) * pop;
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
const limite = t => clamp(0.002 + 0.998 * suave(fase(t, E.ce + 0.2, E.ventimila + 0.3 - E.ce)));

// ---------- câmera ----------
function montarChaves() {
  const b = D.geo.bbox, alt = b.z1 - b.z0, dP = mappa.distPais();
  const paese = { x: (b.x0 + b.x1) / 2, z: (b.z0 + b.z1) / 2 - alt * 0.07, dist: dP, az: 0, giu: 0 };
  const P = (o, k = {}) => ({ x: o.x, z: o.z, ...k });
  const meio = (a, c, k) => ({ x: (a.x + c.x) / 2, z: (a.z + c.z) / 2, ...k });
  const dRN = Math.hypot(roma.x - napoli.x, roma.z - napoli.z);
  const V = { dist: 0.46, giu: 0.06 };
  const lista = [
    [0, { ...paese, dist: dP * 1.1 }],
    [E.ventimila + 0.5, { ...paese, dist: dP * 0.97 }],
    [E.daoggi, { ...paese, dist: dP * 0.95 }],
    [E.crescono + 0.7, P(roma, { dist: 2.3, az: 0.4, giu: 0.12 })],
    [E.cinquanta + 0.5, P(ed.fontana, { ...V, az: 0.45 })],
    [E.centocinquanta - 0.35, P(ed.fontana, { ...V, az: 0.75 })],
    [E.centocinquanta + 0.45, P(ed.scuola, { ...V, az: 0.35 })],
    [E.duecento - 0.3, P(ed.scuola, { ...V, az: 0.55 })],
    [E.duecento + 0.5, P(ed.stazione, { ...V, az: 0.3 })],
    [E.quattrocento - 0.35, P(ed.stazione, { ...V, az: 0.6 })],
    [E.quattrocento + 0.5, P(ed.campo, { ...V, dist: 0.5, az: 0.35 })],
    [E.cinquecento - 0.1, P(ed.campo, { ...V, dist: 0.55, az: 0.7 })],
    [E.ospedale + 0.6, P(roma, { dist: 2.0, az: 0.9, giu: 0.15 })],
    [E.roma + 1.1, meio(roma, napoli, { dist: dRN * 4.4, az: 0.05, giu: 0 })],
    [E.chi + 0.8, meio(roma, napoli, { dist: dRN * 4.0, az: -0.05 })],
    [E.numero, P(eroe.pos, { dist: 0.6, az: 0.6, giu: -0.05 })],
    [E.sempre + 0.8, P(eroe.pos, { dist: 0.7, az: 1.1, giu: 0.05 })],
  ];
  const voo = (ini, fim, de, para, k) => {
    const d = Math.hypot(para.x - de.x, para.z - de.z);
    if (d > 5) lista.push([(ini + fim) / 2, { x: (de.x + para.x) / 2, z: (de.z + para.z) / 2, dist: Math.max(4, d * 0.75), giu: 0, az: k.az }]);
    lista.push([fim, { ...P(para), ...k }]);
  };
  voo(E.intanto - 0.1, E.quattordici + 0.2, eroe.pos, emma.pos, { dist: 0.45, giu: 0.08, az: 0.5 });
  lista.push([40.2, { ...P(emma.pos), dist: 0.5, giu: 0.08, az: 0.85 }]);
  voo(40.2, E.speciali + 0.3, emma.pos, gianni.pos, { dist: 0.44, giu: 0.16, az: 0.3 });
  lista.push([E.domenica - 0.2, { ...P(gianni.pos), dist: 0.48, giu: 0.16, az: 0.8 }]);
  lista.push([E.domenica + 1.4, { ...paese, dist: dP * 1.0, az: 0, giu: 0 }]);
  lista.push([E.derby, { ...paese, dist: dP * 0.97 }]);
  lista.push([E.milano + 0.5, meio(roma, milano, { dist: Math.hypot(roma.x - milano.x, roma.z - milano.z) * 1.7, az: 0 })]);
  lista.push([E.scrivi, meio(roma, milano, { dist: Math.hypot(roma.x - milano.x, roma.z - milano.z) * 1.6 })]);
  lista.push([E.scrivi + 1.3, { ...paese, dist: dP * 0.98, az: 0, giu: 0 }]);
  lista.push([R.durata, { ...paese, dist: dP * 1.05 }]);
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
  const tremor = [[E.ventimila, 0.5], [E.ospedale, 0.45], [E.doppio, 0.35], [E.cisei, 0.3]].reduce((v, [ti, d]) => v + (t >= ti && t < ti + d ? 0.012 * (1 - (t - ti) / d) * Math.sin((t - ti) * 70) : 0), 0);
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
// confete caindo na comemoração das 20.000
const CORES = ['#FFC93C', '#E0473C', '#2E9B55', '#3FA9F5', '#FF7EB6', '#FFFFFF'];
const CONF = Array.from({ length: 70 }, (_, i) => ({ x: (i * 157) % 1080, atraso: ((i * 37) % 30) / 60, vel: 700 + ((i * 53) % 500), giro: ((i * 91) % 720) - 360, dx: ((i * 29) % 160) - 80, cor: CORES[i % CORES.length] }));
function coriandoli(t) {
  const t0 = E.ventimila;
  [...$('#coriandoli').children].forEach((el, i) => {
    const c = CONF[i], dt = t - t0 - c.atraso, vis = dt > 0 && dt < 2.8;
    el.style.opacity = vis ? String(1 - fase(dt, 2.2, 0.6)) : '0';
    if (vis) el.style.transform = `translate(${c.x + c.dx * Math.sin(dt * 4)}px, ${-60 + c.vel * dt}px) rotate(${c.giro * dt}deg)`;
  });
}
// ospedale em 3D girando no cartão (renderer próprio)
function criarOsp() {
  const cv = $('#ospcard canvas'), r = new THREE.WebGLRenderer({ canvas: cv, antialias: true, alpha: true, preserveDrawingBuffer: true });
  r.setPixelRatio(1);
  const sc = new THREE.Scene(), cam = new THREE.PerspectiveCamera(30, cv.width / cv.height, 0.05, 60);
  sc.add(new THREE.HemisphereLight(0xffffff, 0xb9c7a8, 2.3));
  const sol = new THREE.DirectionalLight(0xfff1dc, 2.4); sol.position.set(-0.55, 1, 0.4); sc.add(sol);
  const chao = new THREE.Mesh(new THREE.CircleGeometry(2.6, 48), new THREE.MeshLambertMaterial({ color: '#A9D58A' }));
  chao.rotation.x = -Math.PI / 2; sc.add(chao);
  const perno = new THREE.Group(); sc.add(perno);
  perno.add(new THREE.Mesh(geometriaEspecial('ospedale'), new THREE.MeshLambertMaterial({ vertexColors: true })));
  return { r, sc, cam, perno };
}
function disegnaOsp(t) {
  const vis = t >= E.ospedale - 0.1 && t < E.roma;
  mostrar($('#ospcard'), t, E.ospedale - 0.1, E.roma);
  if (!vis) return;
  osp.perno.rotation.y = -0.5 + (t - E.ospedale) * 0.6;
  osp.perno.scale.setScalar(0.6 + 0.4 * ressalto(fase(t, E.ospedale - 0.05, 0.4)));
  osp.cam.position.set(0, 2.2, 4.6); osp.cam.lookAt(0, 0.5, 0);
  osp.r.render(osp.sc, osp.cam);
}

function quadro(t) {
  const dist = camera(t);
  punti.visible = dist > DIST_CIDADE * 0.55;
  punti.material.uniforms.lim.value = limite(t);
  const velo = $('#velo');
  velo.style.opacity = String(Math.max(t >= E.ventimila ? 0.8 * (1 - fase(t, E.ventimila, 0.35)) : 0, t >= E.ospedale ? 0.7 * (1 - fase(t, E.ospedale, 0.3)) : 0));
  for (const a of decori.attive.values()) a.anima(t * 1000);
  cabecalho(t);
  for (const e of etichette) {
    const vis = t >= e.ini && t < e.fim;
    if (!vis) { e.el.style.opacity = '0'; continue; }
    const pos = e.pos(), p = projetar(pos.x, pos.y, pos.z);
    const s = ressalto(fase(t, e.ini, e.dur ?? 0.32)) * (1 - fase(t, e.fim - 0.2, 0.2));
    e.el.style.opacity = p.ok ? '1' : '0';
    e.el.style.transform = `translate(${p.x - e.el.offsetWidth / 2}px, ${p.y - e.el.offsetHeight}px) scale(${s})`;
    if (e.lampo) e.el.querySelector('.box').classList.toggle('lampo', t >= e.lampo && t < e.lampo + 0.8);
    if (e.barra) e.el.querySelector('.mini i').style.width = `${e.barra * suave(fase(t, e.ini + 0.2, 0.9))}%`;
  }
  // 20.000: carimbo + confete
  const st = $('#stamp20'), ks = ressalto(fase(t, E.ventimila, 0.3));
  st.style.opacity = t >= E.ventimila && t < E.daoggi ? String(1 - fase(t, E.daoggi - 0.25, 0.25)) : '0';
  st.style.transform = `scale(${t < E.ventimila + 0.1 ? 1.5 - 0.5 * ks : 1 + 0.03 * Math.sin((t - E.ventimila) * 8)}) rotate(-5deg)`;
  coriandoli(t);
  disegnaOsp(t);
  chip($('#chip-chi'), t, E.chi - 0.05, E.eroe);
  chip($('#chip-sempre'), t, E.nome - 0.05, E.intanto);
  // presidência
  mostrar($('#pres'), t, E.domenica - 0.05, E.derby);
  const kp = suave(fase(t, E.domenica + 0.3, 0.9));
  $('#pres').querySelectorAll('.barra i').forEach(b => { b.style.width = `${b.dataset.pct * kp}%`; });
  $('#pres').querySelectorAll('.riga')[0].classList.toggle('lampo', t >= E.rimini && t < E.rimini + 0.9);
  $('#pres .quando').classList.toggle('lampo', t >= E.domenica + 0.2 && t < E.presidente + 0.5);
  chip($('#chip-aperto'), t, E.aperto - 0.05, E.derby);
  // derby
  mostrar($('#derby'), t, E.derby - 0.05, E.scrivi);
  const kd = suave(fase(t, E.roma2 - 0.2, 0.9));
  $('#derby').querySelectorAll('.barra i').forEach(b => { b.style.width = `${b.dataset.pct * kd}%`; });
  $('#derby').querySelectorAll('.pts').forEach(p => { p.textContent = num(p.dataset.v * kd); });
  chip($('#chip-doppio'), t, E.doppio - 0.05, E.cisei - 0.1);
  chip($('#chip-cisei'), t, E.cisei - 0.05, E.scrivi);
  // chamada final + ícones dos traguardi
  const cta = $('#cta').children;
  mostrar(cta[0], t, E.scrivi - 0.05, R.durata + 1, 20);
  mostrar(cta[1], t, E.regione - 0.3, R.durata + 1, 20);
  mostrar(cta[2], t, E.casa_f - 0.1, R.durata + 1, 20);
  cta[3].style.opacity = t >= E.casa_f + 1.2 ? '1' : '0';
  [...cta[3].children].forEach((c, i) => { c.style.transform = `scale(${ressalto(fase(t, E.casa_f + 1.2 + i * 0.22, 0.3))})`; });
  mostrar(cta[4], t, E.traguardo + 0.25, R.durata + 1, 20);
  legenda(t);
  mappa.renderer.render(mappa.scene, mappa.camera);
  return true;
}

// efeitos sonoros (o mixador strumenti/suoni.mjs sintetiza cada tipo)
function suoni() {
  const s = [], add = (t, tipo, extra = {}) => s.push({ t, tipo, vol: 0.8, ...extra });
  // contagem até 20.000 e festa
  add(0.02, 'whoosh', { vol: 0.6, dur: 1.2, giu: true });
  for (let t = E.ce + 0.2; t < E.ventimila; t += 0.08) add(t, 'tick', { vol: 0.3, tono: 1 + 0.6 * (t - E.ce) / (E.ventimila - E.ce) });
  add(E.ventimila - 0.3, 'rullo', { dur: 0.3 });
  add(E.ventimila - 0.04, 'boom', { vol: 0.8 }); add(E.ventimila, 'stamp', { vol: 1 }); add(E.ventimila + 0.05, 'coin', { vol: 0.6 });
  for (let k = 0; k < 12; k++) add(E.ventimila + 0.1 + k * 0.11, 'pop', { vol: 0.35, tono: 0.8 + ((k * 7) % 9) / 10 });
  add(E.ventimila + 0.4, 'ding', { vol: 0.5, tono: 1.3 });
  // as cidades crescem: um prédio por vez
  add(E.daoggi - 0.05, 'whoosh', { vol: 0.8, dur: 2.0, giu: true });
  add(E.crescono, 'select', { tono: 1.1 });
  const pred = [[E.cinquanta, E.fontana, 1.0], [E.centocinquanta, E.scuola, 1.1], [E.duecento, E.stazione, 1.2], [E.quattrocento, E.campo, 1.3]];
  pred.forEach(([n, ev, tono], i) => {
    if (i) add(n - 0.4, 'whoosh', { vol: 0.55, dur: 0.8 });
    add(n, 'pop', { tono: 0.9 + i * 0.08 }); add(n + 0.05, 'tick', { vol: 0.4, tono: 1.4 });
    add(ev, 'stamp', { vol: 0.75 }); add(ev + 0.06, 'ding', { vol: 0.45, tono });
  });
  add(E.fontana + 0.3, 'vento', { vol: 0.25, dur: 1.2 });
  add(E.scuola + 0.25, 'ding', { vol: 0.35, tono: 1.6 }); add(E.scuola + 0.45, 'ding', { vol: 0.35, tono: 1.35 });
  add(E.treno - 0.05, 'fischio', { vol: 0.9, dur: 0.9 });
  add(E.campo + 0.3, 'pop', { vol: 0.5, tono: 0.7 }); add(E.campo + 0.5, 'tap', { vol: 0.6 });
  // e a 500... l'ospedale!
  add(E.cinquecento - 0.1, 'rullo', { dur: E.ospedale - E.cinquecento + 0.1 });
  add(E.ospedale - 0.05, 'boom', { vol: 0.9 }); add(E.ospedale, 'stamp', { vol: 1 }); add(E.ospedale + 0.1, 'ding', { vol: 0.55, tono: 1.2 });
  // corrida Roma × Napoli
  add(E.roma - 0.25, 'whoosh', { vol: 0.85, dur: 1.4 }); add(E.roma + 0.1, 'select', { tono: 1.0 }); add(E.napoli + 0.1, 'select', { tono: 1.2 });
  for (let k = 0; k < 8; k++) add(E.cento + k * 0.1, 'tick', { vol: 0.3, tono: 1.2 + k * 0.05 });
  add(E.chi - 0.15, 'rullo', { dur: 0.6 }); add(E.chi + 0.5, 'stamp', { vol: 0.9 });
  // herói
  add(E.eroe - 0.1, 'whoosh', { vol: 0.75, dur: 1.4, giu: true });
  add(E.numero, 'select', { tono: 1.25 }); add(E.numero + 0.1, 'pop', { vol: 0.55 });
  add(E.costruisce, 'coin', { vol: 0.6 }); add(E.nome - 0.05, 'stamp', { vol: 0.8 }); add(E.sempre, 'ding', { vol: 0.55, tono: 1.4 });
  // Vetrina e casa decorada
  add(E.intanto - 0.1, 'whoosh', { vol: 0.85, dur: 2.0 }); add(E.quattordici, 'notifica', { vol: 0.7 });
  for (let k = 0; k < 14; k++) add(E.quattordici + k * 0.05, 'tick', { vol: 0.28, tono: 1.1 + k * 0.04 });
  add(E.quattordici + 0.3, 'select', { tono: 1.1 });
  add(40.2, 'whoosh', { vol: 0.85, dur: 1.8 }); add(E.speciali + 0.2, 'coin', { vol: 0.6 });
  for (let k = 0; k < 6; k++) add(E.speciali + 0.35 + k * 0.08, 'tick', { vol: 0.32, tono: 1.6 + k * 0.1 });
  add(E.colori, 'ding', { vol: 0.5, tono: 1.5 });
  // presidência
  add(E.domenica - 0.15, 'whoosh', { vol: 0.7, dur: 1.4 }); add(E.domenica, 'pop', { tono: 0.8 });
  add(E.presidente, 'flap', { vol: 0.7 }); add(E.rimini, 'select', { tono: 1.25 }); add(E.aperto - 0.1, 'rullo', { dur: 0.6 }); add(E.aperto + 0.5, 'stamp', { vol: 0.85 });
  // derby
  add(E.derby - 0.1, 'whoosh', { vol: 0.7, dur: 1.2 }); add(E.derby, 'pop', { tono: 0.85 });
  add(E.roma2 - 0.2, 'rullo', { dur: 0.95 }); add(E.doppio - 0.05, 'boom', { vol: 0.7 }); add(E.doppio, 'stamp', { vol: 1 });
  add(E.cisei - 0.05, 'pop', { tono: 1.2 }); add(E.cisei + 0.1, 'notifica', { vol: 0.6, tono: 0.9 });
  // chamada final
  add(E.scrivi - 0.1, 'whoosh', { vol: 0.7, dur: 1.2, giu: true }); add(E.scrivi, 'pop', { tono: 0.9 }); add(E.regione - 0.3, 'pop', { tono: 1.05 });
  add(E.casa_f - 0.1, 'pop', { tono: 1.15 });
  TRAGUARDI.forEach((_, i) => add(E.casa_f + 1.2 + i * 0.22, 'pop', { vol: 0.45, tono: 0.85 + i * 0.07 }));
  add(E.traguardo + 0.25, 'stamp', { vol: 0.75 }); add(E.traguardo + 0.45, 'ding', { vol: 0.5 });
  return s.sort((a, b) => a.t - b.t);
}

async function preparar(roteiro) {
  R = roteiro; E = R.eventi;
  await Promise.all(['900 104px Nunito', '900 60px Nunito', '800 40px Nunito', '700 30px Nunito'].map(f => document.fonts.load(f)));
  await document.fonts.ready;
  citta = new Citta(mappa, D);
  decori = new Decori(D, mappa, citta, null);
  punti = criarPontos();
  const luogo = n => D.luoghi.find(l => l.nome === n);
  [roma, napoli, milano] = [R.citta, R.rivale, 'Milano'].map(luogo);
  // prédios dos traguardi em Roma
  const hc = citta.dadosCidade(roma).hc;
  for (const t of ['fontana', 'scuola', 'stazione', 'campo']) ed[t] = posEdificio(roma, t);
  const rotulo = (tipo, ini, fim, alto) => {
    const tr = TRAGUARDI.find(x => x.id === tipo), f = inaugurazioni(D).lista.find(x => x.l === roma && x.t.id === tipo);
    etichette.push({
      el: novaEtichetta(`<div class="box"><b>${tr.emoji} ${num(tr.casas)} CASE</b><span>${esc(tr.nome.toUpperCase())}</span>${f?.eroe ? `<small>🏗️ costruita da @${esc(f.eroe)}</small>` : ''}</div><div class="freccia"></div>`),
      pos: () => ({ x: ed[tipo].x, y: hc + LOTE * alto, z: ed[tipo].z }), ini, fim,
    });
  };
  rotulo('fontana', E.fontana - 0.1, E.centocinquanta - 0.3, 0.9);
  rotulo('scuola', E.scuola - 0.1, E.duecento - 0.3, 1.45);
  rotulo('stazione', E.stazione - 0.1, E.quattrocento - 0.3, 1.9);
  rotulo('campo', E.campo - 0.1, E.cinquecento + 0.4, 0.9);
  osp = criarOsp();
  // corrida pelo ospedale: casas reais de Roma e Napoli rumo a 500
  const s500 = sogliaDi('ospedale');
  for (const [l, ev, cl] of [[roma, E.roma, ''], [napoli, E.napoli, ' bianco']]) {
    etichette.push({ el: novaEtichetta(`<div class="box${cl}"><b>${esc(l.nome)}</b><span>🏥 ${num(l.case)} / ${num(s500)}</span><div class="mini"><i></i></div></div><div class="freccia"></div>`), pos: () => ({ x: l.x, y: mappa.altura(l.x, l.z) + 3, z: l.z }), ini: ev, fim: E.eroe - 0.2, barra: 100 * l.case / s500, lampo: E.cento });
  }
  // herói real
  const c = D.porConta.get(R.eroe), fe = inaugurazioni(D).porEroe.get(R.eroe)?.[0];
  eroe = { casa: c, pos: citta.posCasa(c) };
  etichette.push({
    el: novaEtichetta(`<div class="box"><b>🏗️ @${esc(c.conta)}</b><span>HA COSTRUITO ${esc((fe?.t.art ?? '').toUpperCase())} DI ${esc(D.luoghi[c.luogo].nome.toUpperCase())}</span><small>LA ${num(fe?.t.casas ?? 0)}ª CASA DELLA CITTÀ</small></div><div class="freccia"></div>`),
    pos: () => ({ x: eroe.pos.x, y: eroe.pos.y + ALTURA_NIVEL[c.livello] * LOTE + LOTE * 0.35, z: eroe.pos.z }), ini: E.numero - 0.1, fim: E.intanto,
  });
  // Vetrina: o cartellone real
  const cm = D.commerci.find(x => x.id === R.attivita);
  citta.posCommercio(cm);
  emma = { cm, pos: { x: cm.x, y: cm.y, z: cm.z } };
  const [, emo] = tipoDi(cm.tipo);
  etichette.push({ el: novaEtichetta(`<div class="box">${cm.logo ? `<img src="${esc(cm.logo)}" alt="">` : ''}<b style="font-size:38px">${emo} ${esc(cm.nome)}</b><span>📣 CARTELLONE · ${esc(cm.luogo.nome)}</span></div><div class="freccia"></div>`), pos: () => ({ x: emma.pos.x, y: emma.pos.y + LOTE * 1.9, z: emma.pos.z }), ini: E.quattordici - 0.1, fim: 40.4 });
  // casa decorada paga (a mesma decoração que está no site)
  const gc = D.porConta.get(R.decorata);
  gianni = { casa: gc, pos: citta.posCasa(gc) };
  decori.disegna(gc, { squadra: null, extra: new Set(['oro', 'tricolore', 'cornice', 'fuochi']) }, null);
  etichette.push({ el: novaEtichetta(`<div class="box rosa"><b>✨ @${esc(gc.conta)}</b><span>CASA SPECIALE</span><small>${esc(D.luoghi[gc.luogo].nome.toUpperCase())}</small></div><div class="freccia"></div>`), pos: () => ({ x: gianni.pos.x, y: gianni.pos.y + (ALTURA_NIVEL[gc.livello] + 0.9) * LOTE, z: gianni.pos.z }), ini: E.speciali, fim: E.domenica - 0.1 });
  await Promise.all([...document.images].map(i => i.decode().catch(() => {})));
  // presidência e derby (pontos reais)
  top3 = D.ranking.slice(0, 3);
  $('#pres').innerHTML = `<h2>🏛️ PRIMO PRESIDENTE<br>DEL CONSIGLIO</h2><div class="quando">🗳️ domenica 1 novembre alle 21:00</div>
    ${top3.map((x, i) => `<div class="riga"><div class="pos"${i ? '' : ' style="background:var(--giallo)"'}>${i + 1}</div><div class="quem"><b>@${esc(x.conta)}</b><small>${esc(D.luoghi[x.luogo].nome)}</small><div class="barra"><i data-pct="${(100 * x.sett / top3[0].sett).toFixed(1)}"></i></div></div><div class="pts">${num(x.sett)}</div></div>`).join('')}`;
  const dz = D.snap.derby;
  [derbyA, derbyB] = [[dz.a, dz.pts_a], [dz.b, dz.pts_b]].map(([istat, pts]) => ({ nome: D.comunePorIstat.get(istat).nome, pts })).sort((a, b) => b.pts - a.pts);
  $('#derby').innerHTML = `<h2>⚔️ DERBY DELLA SETTIMANA</h2>${[derbyA, derbyB].map((x, i) => `<div class="riga"><div class="em" style="background:${i ? '#E3F2FF' : '#FFE3E0'}">${i ? '🔵' : '🔴'}</div><div class="quem"><b>${esc(x.nome)}</b><div class="barra"><i data-pct="${(100 * x.pts / derbyA.pts).toFixed(1)}"></i></div></div><div class="pts" data-v="${x.pts}">0</div></div>`).join('')}`;
  $('#coriandoli').innerHTML = CONF.map(c => `<i style="background:${c.cor}"></i>`).join('');
  $('#cta .icone').innerHTML = TRAGUARDI.map(x => `<span>${x.emoji}</span>`).join('');
  montarChaves();
  const nAtt = D.commerci.length;
  scene = [
    [0, t => `🏠 <span class="g">${num(totale * limite(t))}</span>`, 'CASE', 'grande'],
    [E.ventimila - 0.05, '', ''],
    [E.daoggi - 0.05, 'E DA OGGI…', ''],
    [E.crescono - 0.1, 'LE CITTÀ', '<span class="g">CRESCONO 🏗️</span>'],
    [E.cinquanta - 0.1, '⛲ <span class="g">50</span> CASE', 'FONTANA MONUMENTALE'],
    [E.centocinquanta - 0.1, '🏫 <span class="g">150</span> CASE', 'LA SCUOLA'],
    [E.duecento - 0.1, '🚉 <span class="g">250</span> CASE', 'LA STAZIONE'],
    [E.quattrocento - 0.1, '⚽ <span class="g">400</span> CASE', 'IL CAMPO DA CALCIO'],
    [E.cinquecento - 0.1, 'E A <span class="g">500</span>…', ''],
    [E.ospedale - 0.1, '', ''],
    [E.roma - 0.1, '🏥 CORSA', 'ALL’OSPEDALE'],
    [E.chi - 0.1, '', ''],
    [E.eroe - 0.1, '🏗️ LA <span class="g">500ª</span> CASA', 'COSTRUISCE L’OSPEDALE'],
    [E.intanto - 0.1, t => `🛍️ <span class="g">${num(conta(t, E.quattordici - 0.1, 0.7, nAtt))}</span> ATTIVITÀ`, '<span class="g">VERE SULLA MAPPA</span>'],
    [40.4, '✨ LE PRIME', '<span class="g">CASE SPECIALI</span>'],
    [E.domenica - 0.1, '', ''],
  ];
  if (R.copertina) {
    const cp = R.copertina;
    const el = document.createElement('div');
    el.className = 'forte';
    el.style.cssText = `position:absolute;left:30px;right:30px;top:${cp.titolo_top}px;text-align:center;line-height:1.05;`;
    el.innerHTML = cp.linee.map(([txt, cor, size]) => `<div style="font-size:${size}px;-webkit-text-stroke-width:${Math.round(size * 0.19)}px"${cor ? ` class="${cor === true ? 'g' : cor}"` : ''}>${esc(txt)}</div>`).join('');
    document.body.appendChild(el);
    if (cp.senza_testa) $('#testa').style.display = 'none';
  }
  console.log(`${totale} case · Roma ${roma.case} · Napoli ${napoli.case} · eroe @${c.conta} (${fe?.t.id}) · ${cm.nome} · decorata @${gc.conta} (${D.luoghi[gc.luogo].nome}) · ${nAtt} attività · top ${top3.map(x => `@${x.conta} ${x.sett}`).join(', ')} · derby ${derbyA.nome} ${derbyA.pts} x ${derbyB.nome} ${derbyB.pts}`);
  quadro(0);
  return { durata: R.durata, fps: 30 };
}

iniciar().catch(e => console.error('erro ao carregar', e));
