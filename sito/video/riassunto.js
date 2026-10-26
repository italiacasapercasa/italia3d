// Reel "riassunto" com dados reais: capoluoghi fundados (o primeiro e o último), casas no país, cidades com mais casas,
// os comércios reais, painel de uma loja, loja su misura, outdoor, Halloween à noite com abóboras, a disputa pela
// presidência e a chamada final. window.preparar(roteiro), window.quadro(t), window.suoni(); tudo depende só de t.
// Abrir com ?halloween=1 (as abóboras só aparecem na cena de Halloween).
import * as THREE from 'three';
import { carregar } from '../js/dati.js';
import { Mappa, COR_MAR } from '../js/mappa.js';
import { Citta, posLote, DIST_CIDADE, LOTE } from '../js/citta.js';
import { ALTURA_NIVEL, OPZIONI_STILE, STILE_BASE } from '../js/modelli.js';
import { creaNegozio3D } from '../js/negozio3d.js';
import { tipoDi } from '../js/commerci.js';

const $ = s => document.querySelector(s);
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const suave = s => (s < 0.5 ? 4 * s * s * s : 1 - Math.pow(-2 * s + 2, 3) / 2);
const ressalto = s => { const c = 1.9; return s <= 0 ? 0 : s >= 1 ? 1 : 1 + (c + 1) * Math.pow(s - 1, 3) + c * Math.pow(s - 1, 2); };
const fase = (t, ini, dur) => clamp((t - ini) / dur);
const esc = s => String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
const num = n => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
const ora = ms => new Date(ms).toLocaleTimeString('it-IT', { timeZone: 'Europe/Rome', hour: '2-digit', minute: '2-digit', second: '2-digit' });

let D, mappa, citta, R, E, chaves, punti, totale, t0, caps, primo, ultimo, tour, vetrina, cartellone, luogoNotte, scene, etichette = [], mis;
const GIORNO = { mar: new THREE.Color(COR_MAR), terra: new THREE.Color('#ffffff'), ceu: 2.3, sol: 2.4, ceuC: new THREE.Color('#ffffff'), solC: new THREE.Color('#fff1dc') };
const NOTTE = { mar: new THREE.Color('#1E3560'), terra: new THREE.Color('#7C8BB0'), ceu: 1.15, sol: 0.75, ceuC: new THREE.Color('#B9C6FF'), solC: new THREE.Color('#A9BBFF') };

async function iniciar() {
  D = await carregar('video');
  totale = D.casas.length;
  mappa = new Mappa($('#mappa'), D.geo, D.rilievo, D.imagem, { gravacao: true });
  window.preparar = preparar;
  window.quadro = quadro;
  window.suoni = suoni;
}

// dia -> noite (k de 0 a 1)
function notte(k) {
  const c = GIORNO.mar.clone().lerp(NOTTE.mar, k);
  mappa.scene.background.copy(c); mappa.scene.fog.color.copy(c); mappa.mar.material.color.copy(c);
  mappa.matTerreno.color.copy(GIORNO.terra.clone().lerp(NOTTE.terra, k));
  mappa.ceu.intensity = GIORNO.ceu + (NOTTE.ceu - GIORNO.ceu) * k; mappa.ceu.color.copy(GIORNO.ceuC.clone().lerp(NOTTE.ceuC, k));
  mappa.sol.intensity = GIORNO.sol + (NOTTE.sol - GIORNO.sol) * k; mappa.sol.color.copy(GIORNO.solC.clone().lerp(NOTTE.solC, k));
  mappa.notte = k > 0.55;
  citta.grupoNotte.visible = k > 0.55;
}
function zucche(on) {
  for (const k of ['zucca', 'zuccaP', 'zuccaL', 'zuccaPL']) { const m = citta.camadas[k]?.mesh; if (m) m.visible = on; }
}

// uma bolinha por cidade (3+ casas), que aparece quando a cidade é fundada; "lim" = fração de casas já chegadas
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
      attribute float ord; uniform float lim; uniform float escala;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        float k = clamp((lim - ord) * 40.0, 0.0, 1.0);
        float pop = k < 1.0 ? k * (1.0 + 0.6 * sin(k * 3.1416)) : 1.0;
        gl_PointSize = ord > lim ? 0.0 : clamp(0.05 * escala / -mv.z, 14.0, 18.0) * pop;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      void main() {
        float d = length(gl_PointCoord - 0.5) * 2.0;
        if (d > 1.0) discard;
        gl_FragColor = vec4(d > 0.62 ? vec3(0.08, 0.13, 0.2) : vec3(1.0), 1.0);
        #include <colorspace_fragment>
      }`,
  });
  const p = new THREE.Points(g, mat);
  p.frustumCulled = false; p.renderOrder = 5;
  mappa.scene.add(p);
  return p;
}

// ---------- câmera ----------
function montarChaves() {
  const b = D.geo.bbox, alt = b.z1 - b.z0, dP = mappa.distPais();
  const paese = { x: (b.x0 + b.x1) / 2, z: (b.z0 + b.z1) / 2 - alt * 0.07, dist: dP, az: 0, giu: 0 };
  const P = (o, k = {}) => ({ x: o.x, z: o.z, ...k });
  const roma = D.luoghi.find(l => l.nome === 'Roma'), nap = D.luoghi.find(l => l.nome === 'Napoli');
  const lista = [
    [0, { ...paese, dist: dP * 1.04 }],
    [E.primo, { ...paese, dist: dP * 0.97 }],
    [E.primo + 1.5, P(primo.l, { dist: 70, az: 0, giu: 0.05 })],
    [E.ultimo - 0.05, P(primo.l, { dist: 58 })],
    [E.ultimo + 1.4, P(ultimo.l, { dist: 70 })],
    [E.case - 0.05, P(ultimo.l, { dist: 60 })],
    [E.case + 1.3, { ...paese, giu: 0 }],
    [E.roma, { ...paese, dist: dP * 0.97 }],
    [E.roma + 1.1, { x: (roma.x + nap.x) / 2, z: (roma.z + nap.z) / 2, dist: 900, az: 0, giu: 0 }],
    [E.negozi, { dist: 860 }],
  ];
  // voo de loja em loja: ponto alto no meio do caminho quando é longe
  const voo = (ini, fim, de, para, k) => {
    const d = Math.hypot(para.x - de.x, para.z - de.z);
    if (d > 5) lista.push([(ini + fim) / 2, { x: (de.x + para.x) / 2, z: (de.z + para.z) / 2, dist: Math.max(4, d * 0.75), giu: 0 }]);
    lista.push([fim, { ...P(para), ...k }]);
  };
  const V = { dist: 0.42, giu: 0.1 };
  voo(E.negozi, E.n1 + 0.2, { x: (roma.x + nap.x) / 2, z: (roma.z + nap.z) / 2 }, tour[0].pos, { ...V, az: 0.5 });
  for (let i = 1; i < 4; i++) {
    const ev = [E.n1, E.n2, E.n3, E.n4][i];
    lista.push([ev - 0.55, { ...P(tour[i - 1].pos), ...V, az: 0.5 + i * 0.12 }]);
    voo(ev - 0.55, ev + 0.45, tour[i - 1].pos, tour[i].pos, { ...V, az: 0.5 + i * 0.15 });
  }
  lista.push([E.tuo, { ...P(tour[3].pos), ...V, az: 1.0 }]);
  voo(E.tuo, E.tuo + 1.6, tour[3].pos, vetrina.pos, { dist: 0.4, giu: 0.06, az: 0.45 });
  lista.push([E.card, { ...P(vetrina.pos), dist: 0.38, az: 0.5, giu: 0.06 }]);
  lista.push([E.cartellone - 0.1, { ...P(vetrina.pos), dist: 0.42, az: 0.9, giu: 0.06 }]);
  lista.push([E.cartellone + 0.9, { ...P(cartellone), dist: 0.36, az: cartellone.az, giu: 0.08 }]);
  lista.push([E.posti, { ...P(cartellone), dist: 0.38, az: cartellone.az + 0.2 }]);
  lista.push([E.halloween, { ...P(vetrina.luogo), dist: 1.1, az: cartellone.az + 0.4, giu: 0.1 }]);
  voo(E.halloween, E.halloween + 1.9, vetrina.luogo, luogoNotte, { dist: 0.75, az: 0.6, giu: 0.12 });
  lista.push([E.presidente, { ...P(luogoNotte), dist: 0.62, az: 1.1, giu: 0.12 }]);
  lista.push([E.presidente + 1.8, { ...paese, giu: 0 }]);
  lista.push([R.durata, { ...paese, dist: dP * 1.05 }]);
  let ant = {};
  chaves = lista.sort((a, b) => a[0] - b[0]).map(([t, k]) => { ant = { ...ant, ...k }; return { t, k: { ...ant } }; });
}
function camera(t) {
  let i = 0;
  while (i < chaves.length - 2 && t >= chaves[i + 1].t) i++;
  const a = chaves[i], b = chaves[Math.min(i + 1, chaves.length - 1)];
  const s = b.t > a.t ? suave(clamp((t - a.t) / (b.t - a.t))) : 1;
  const A = a.k, B = b.k, l = (p, q) => p + (q - p) * s;
  const dist = Math.exp(l(Math.log(A.dist), Math.log(B.dist)));
  const dxz = Math.hypot(B.x - A.x, B.z - A.z);
  // aproximando: o alvo chega antes do zoom (a cidade cresce no centro); afastando: o zoom vem antes
  const fecha = B.dist < A.dist;
  const sxz = dxz > 20 ? (fecha ? suave(clamp((t - a.t) / ((b.t - a.t) * 0.55))) : suave(clamp((t - a.t - (b.t - a.t) * 0.45) / ((b.t - a.t) * 0.55)))) : s;
  const az = l(A.az, B.az), giu = l(A.giu, B.giu), x = A.x + (B.x - A.x) * sxz, z = A.z + (B.z - A.z) * sxz;
  mappa.az = az; mappa.dist = dist;
  mappa.alvo.x = x - Math.sin(az) * giu * dist;
  mappa.alvo.z = z - Math.cos(az) * giu * dist;
  mappa.atualizarCamera();
  return dist;
}

// ---------- textos ----------
function projetar(x, y, z) { const p = new THREE.Vector3(x, y, z).project(mappa.camera); return { x: (p.x + 1) / 2 * 1080, y: (1 - p.y) / 2 * 1920, ok: p.z < 1 && p.z > -1 }; }
function novaEtichetta(html, cls = '') {
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
  el.style.transform = `translateX(-50%) scale(${s})`;
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

// loja su misura: renderer próprio no cartão, trocando de visual
function criarMisura() {
  const cv = $('#misura canvas'), r = new THREE.WebGLRenderer({ canvas: cv, antialias: true, alpha: true, preserveDrawingBuffer: true });
  r.setPixelRatio(1);
  const scene3 = new THREE.Scene(), cam = new THREE.PerspectiveCamera(30, cv.width / cv.height, 0.05, 50);
  scene3.add(new THREE.HemisphereLight(0xffffff, 0xb9c7a8, 2.3));
  const sol = new THREE.DirectionalLight(0xfff1dc, 2.4); sol.position.set(-0.55, 1, 0.4); scene3.add(sol);
  const chao = new THREE.Mesh(new THREE.CircleGeometry(1.4, 48), new THREE.MeshLambertMaterial({ color: '#A9D58A' }));
  chao.rotation.x = -Math.PI / 2; scene3.add(chao);
  const perno = new THREE.Group(); scene3.add(perno);
  const O = OPZIONI_STILE, ogg = O.oggetto.map(o => o[0]).filter(o => o !== 'nessuno');
  const pick = (a, k) => a[k % a.length];
  const varianti = ogg.map((o, k) => ({
    ...STILE_BASE, oggetto: o, scala: 1.15,
    tenda: pick(O.tenda, k)[0], coloreTenda: pick(O.coloreTenda, k * 3 + 1), coloreRighe: pick(O.coloreRighe, k + 2), facciata: pick(O.facciata, k * 7 + 2),
    porta: pick(O.porta, k * 5 + 1), bordo: pick(O.bordo, k * 3), piani: k % 3 === 2 ? 2 : 1, vetrina: pick(O.vetrina, k)[0], insegna: pick(O.insegna, k)[0],
    tetto: k % 4 === 1, ornamenti: [['vasi', 'luci'], ['dehors'], ['bandierine', 'vasi'], ['luci', 'dehors', 'bandierine']][k % 4],
  }));
  return { r, scene3, cam, perno, varianti, atual: -1, obj: null };
}
function disegnaMisura(t) {
  const vis = t >= E.misura && t < E.cartellone;
  mostrar($('#misura'), t, E.misura, E.cartellone);
  if (!vis) return;
  const k = Math.min(mis.varianti.length - 1, Math.floor((t - E.misura) / 0.42));
  if (k !== mis.atual) {
    mis.atual = k;
    if (mis.obj) { mis.perno.remove(mis.obj); mis.obj.userData.descartar?.(); }
    mis.obj = creaNegozio3D({ nome: 'Il tuo negozio', colore: mis.varianti[k].coloreTenda, stile: mis.varianti[k], logo: null });
    mis.obj.position.set(0, 0, 0);
    mis.perno.add(mis.obj);
  }
  const s = 1 + 0.08 * Math.sin(Math.min(1, (t - E.misura - k * 0.42) / 0.12) * Math.PI);   // "pulo" a cada troca
  mis.obj.scale.setScalar(s);
  mis.perno.rotation.y = -0.6 + (t - E.misura) * 0.5;
  mis.cam.position.set(0, 1.25, 2.55); mis.cam.lookAt(0, 0.5, 0);
  mis.r.render(mis.scene3, mis.cam);
}

function quadro(t) {
  const dist = camera(t);
  punti.visible = dist > DIST_CIDADE * 0.55;
  // pontos: crescem no começo e de novo no contador de casas
  punti.material.uniforms.lim.value = t < E.case ? 0 : clamp(0.004 + 0.996 * suave(fase(t, E.case + 0.3, E.case_a - E.case - 0.3)));
  const kn = suave(fase(t, E.halloween, 1.2)) * (1 - suave(fase(t, E.presidente + 0.3, 1.4)));
  notte(kn);
  zucche(t >= E.halloween && t < E.presidente + 1.5);
  cabecalho(t);
  for (const e of etichette) {
    const vis = t >= e.ini && t < e.fim;
    if (!vis) { e.el.style.opacity = '0'; continue; }
    const pos = e.pos(), p = projetar(pos.x, pos.y, pos.z);
    const s = ressalto(fase(t, e.ini, e.dur ?? 0.32)) * (1 - fase(t, e.fim - 0.2, 0.2));
    e.el.style.opacity = p.ok ? '1' : '0';
    e.el.style.transform = `translate(${p.x - e.el.offsetWidth / 2}px, ${p.y - e.el.offsetHeight}px) scale(${s})`;
  }
  // toque no negócio e painel
  const tc = $('#tocco'), pv = projetar(vetrina.pos.x, vetrina.pos.y + LOTE * 0.4, vetrina.pos.z), kt = fase(t, E.card - 0.35, 0.45);
  tc.style.opacity = kt > 0 && kt < 1 ? String(1 - kt) : '0';
  tc.style.left = `${pv.x}px`; tc.style.top = `${pv.y}px`; tc.style.transform = `scale(${0.4 + kt})`;
  mostrar($('#scheda'), t, E.card, E.misura);
  for (const [sel, ev] of [['h2', E.nome], ['img', E.logo], ['.wa', E.wa]]) $('#scheda').querySelector(sel)?.classList.toggle('lampo', t >= ev && t < ev + 0.7);
  disegnaMisura(t);
  chip($('#chip-posti'), t, E.pochi - 0.1, E.halloween);
  chip($('#chip-punti'), t, E.cento - 0.1, E.halloween);
  chip($('#chip-prezzo'), t, E.cento + 0.6, E.halloween);
  // duelo pela presidência
  mostrar($('#duello'), t, E.presidente + 0.4, E.cta);
  const kb = suave(fase(t, E.presidente + 0.8, 1.2));
  document.querySelectorAll('#duello .barra i').forEach(b => { b.style.width = `${b.dataset.pct * kb}%`; });
  const vs = $('#vs'), kv = fase(t, E.testa, 0.3);
  vs.style.transform = `translate(-50%, -50%) scale(${t >= E.testa ? ressalto(kv) * (1 + 0.08 * Math.sin((t - E.testa) * 9)) : 0})`;
  const cta = $('#cta').children;
  mostrar(cta[0], t, E.commenta - 0.05, R.durata + 1, 20);
  mostrar(cta[1], t, E.commenta + 0.9, R.durata + 1, 20);
  mostrar(cta[2], t, E.sito + 0.3, R.durata + 1, 20);
  legenda(t);
  mappa.renderer.render(mappa.scene, mappa.camera);
  return true;
}

// efeitos sonoros (o mixador strumenti/suoni.mjs sintetiza cada tipo)
function suoni() {
  const s = [], add = (t, tipo, extra = {}) => s.push({ t, tipo, vol: 0.8, ...extra });
  caps.forEach((c, i) => { add(c.tv, 'pop', { vol: 0.45, tono: 0.8 + i * 0.03 }); add(c.tv, 'tick', { vol: 0.35, tono: 1 + i * 0.03 }); });
  add(E.cap_a + 0.05, 'ding', { vol: 0.5, tono: 1.2 });
  add(E.primo - 0.05, 'whoosh', { vol: 0.8, dur: 1.4, giu: true });
  add(E.primo + 1.2, 'select', { tono: 1.2 });
  add(E.ultimo - 0.05, 'whoosh', { vol: 0.7, dur: 1.3 });
  add(E.ultimo + 1.15, 'select', { tono: 1.0 });
  add(E.case - 0.05, 'whoosh', { vol: 0.7, dur: 1.2 });
  for (let t = E.case + 0.3; t < E.case_a; t += 0.075) add(t, 'tick', { vol: 0.4, tono: 1 + 0.5 * (t - E.case) / (E.case_a - E.case) });
  for (let t = E.case + 0.35, k = 0; t < E.case_a; t += 0.12, k++) add(t, 'pop', { vol: 0.3, tono: 0.8 + ((k * 37) % 9) / 12 });
  add(E.case_a, 'ding', { vol: 0.5, tono: 1.1 });
  add(E.roma + 1.0, 'select', { tono: 1.0 }); add(E.napoli + 0.1, 'select', { tono: 1.2 });
  add(E.negozi - 0.05, 'whoosh', { vol: 0.9, dur: 2.6, giu: true });
  [E.n1, E.n2, E.n3, E.n4].forEach((ev, i) => { if (i) add(ev - 0.55, 'whoosh', { vol: 0.65, dur: 1.0 }); add(ev + 0.35, 'select', { tono: 1 + i * 0.08 }); });
  add(E.tuo, 'whoosh', { vol: 0.75, dur: 1.6, giu: true });
  add(E.card - 0.35, 'tap'); add(E.card, 'pop', { tono: 0.8 });
  for (const ev of [E.nome, E.logo, E.wa]) add(ev, 'pop', { vol: 0.6, tono: 1.2 });
  for (let k = 0; E.misura + k * 0.42 < E.cartellone - 0.1; k++) add(E.misura + k * 0.42, 'pop', { vol: 0.55, tono: 0.85 + (k % 5) * 0.08 });
  add(E.cartellone - 0.05, 'whoosh', { vol: 0.6, dur: 0.9 }); add(E.cartellone + 0.85, 'select');
  add(E.pochi - 0.1, 'stamp', { vol: 0.9 }); add(E.cento - 0.1, 'coin'); add(E.cento + 0.6, 'pop', { vol: 0.6 });
  add(E.halloween - 0.05, 'boom'); add(E.halloween, 'vento', { dur: 3.6 }); add(E.zucche, 'pop', { vol: 0.6, tono: 0.7 }); add(E.zucche + 0.25, 'pop', { vol: 0.6, tono: 0.9 });
  add(E.presidente - 0.05, 'whoosh', { vol: 0.7, dur: 1.8 }); add(E.presidente + 0.4, 'pop', { tono: 0.8 });
  add(E.presidente + 0.8, 'rullo', { dur: E.testa - E.presidente - 0.8 }); add(E.testa, 'stamp', { vol: 1 });
  add(E.cta - 0.05, 'whoosh', { vol: 0.5, dur: 1.0 });
  add(E.commenta - 0.05, 'pop', { tono: 0.9 }); add(E.commenta + 0.9, 'pop', { tono: 1.05 }); add(E.sito + 0.3, 'pop', { tono: 1.2 });
  add(E.sito + 2.6, 'ding', { vol: 0.45 });
  return s.sort((a, b) => a.t - b.t);
}

const durata = sec => sec < 3600 ? `IN ${Math.round(sec / 60)} MINUTI` : (sec / 3600) % 1 >= 0.7 ? `DOPO QUASI ${Math.ceil(sec / 3600)} ORE` : `DOPO PIÙ DI ${Math.floor(sec / 3600)} ORE`;

async function preparar(roteiro) {
  R = roteiro; E = R.eventi;
  await Promise.all(['900 104px Nunito', '900 60px Nunito', '800 40px Nunito', '700 30px Nunito'].map(f => document.fonts.load(f)));
  await document.fonts.ready;
  citta = new Citta(mappa, D);
  punti = criarPontos();
  t0 = Math.min(...D.casas.map(c => c.ts));
  // capoluoghi di regione: fundador e hora; aparecem em ordem de fundação até o fim da 1ª frase
  caps = R.capoluoghi.map(n => D.luoghi.find(l => l.nome === n)).filter(Boolean).sort((a, b) => a.fondatore_ts - b.fondatore_ts).map(l => ({ l }));
  caps.forEach((c, i) => { c.tv = 0.35 + (E.cap_a - 0.45) * i / Math.max(1, caps.length - 1); });
  primo = caps[0]; ultimo = caps.at(-1);
  const pos = l => () => ({ x: l.x, y: mappa.altura(l.x, l.z), z: l.z });
  for (const c of caps) etichette.push({ el: novaEtichetta('<i></i><b></b>', `bandierina${c === primo || c === ultimo ? ' rossa' : ''}`), pos: pos(c.l), ini: c.tv, fim: E.case + 0.3 });
  const cartello = (c, tit, sub) => novaEtichetta(`<div class="box"><b>${esc(c.l.nome)}</b><span>@${esc(c.l.fondatore)}</span><small>${tit} · ${ora(c.l.fondatore_ts)}</small></div><div class="freccia"></div>`, 'cartello');
  const ap = l => () => ({ x: l.x, y: mappa.altura(l.x, l.z) + 2.5, z: l.z });
  etichette.push({ el: cartello(primo, '1° capoluogo'), pos: ap(primo.l), ini: E.primo + 1.1, fim: E.ultimo + 0.2 });
  etichette.push({ el: cartello(ultimo, 'ultimo capoluogo'), pos: ap(ultimo.l), ini: E.ultimo + 1.05, fim: E.case + 0.2 });
  // Roma e Napoli com número de casas
  for (const [nome, ev, cl] of [['Roma', E.roma + 0.9, ''], ['Napoli', E.napoli, ' bianco']]) {
    const l = D.luoghi.find(x => x.nome === nome);
    etichette.push({ el: novaEtichetta(`<div class="box${cl}"><b>${esc(nome)}</b><span>🏠 ${num(l.case)} case</span></div><div class="freccia"></div>`, 'cartello'), pos: () => ({ x: l.x, y: mappa.altura(l.x, l.z) + 3, z: l.z }), ini: ev, fim: E.negozi + 0.4 });
  }
  // comércios reais
  const porId = id => D.commerci.find(c => c.id === id);
  const posCm = cm => { citta.posCommercio(cm); return { x: cm.x, y: cm.y, z: cm.z }; };
  tour = R.tour.map(porId).filter(Boolean).map(cm => ({ cm, pos: posCm(cm) }));
  const vcm = porId(R.vetrina);
  vetrina = { cm: vcm, pos: posCm(vcm), luogo: vcm.luogo };
  const evs = [E.n1, E.n2, E.n3, E.n4, E.tuo];
  tour.forEach((x, i) => {
    const [, emoji] = tipoDi(x.cm.tipo);
    const el = novaEtichetta(`<div class="box"><b style="font-size:38px">${emoji} ${esc(x.cm.nome.length > 22 ? x.cm.nome.split('?')[0] + '?' : x.cm.nome)}</b><span>${esc(x.cm.luogo.nome)} (${esc(x.cm.luogo.comune.sigla)})</span></div><div class="freccia"></div>`, 'cartello');
    etichette.push({ el, pos: () => ({ x: x.pos.x, y: x.pos.y + LOTE * 1.15, z: x.pos.z }), ini: evs[i] + 0.3, fim: evs[i + 1] - 0.3 });
    if (x.cm.id === R.vetrina) etichette.push({ el: el.cloneNode(true), pos: () => ({ x: x.pos.x, y: x.pos.y + LOTE * 1.15, z: x.pos.z }), ini: E.tuo + 1.5, fim: E.card });
  });
  for (const e of etichette) if (!e.el.parentNode) $('#etichette').appendChild(e.el);
  // outdoor à venda na cidade da vitrine (ou na maior cidade perto)
  const comOutdoor = [vetrina.luogo, ...D.luoghi.filter(l => l.case >= 15).sort((a, b) => Math.hypot(a.x - vetrina.luogo.x, a.z - vetrina.luogo.z) - Math.hypot(b.x - vetrina.luogo.x, b.z - vetrina.luogo.z))];
  for (const l of comOutdoor) { const a = citta.dadosCidade(l).alvos.find(x => x.tipo === 'pubblicita'); if (a) { cartellone = { x: a.x, z: a.z, az: a.rot + 0.3 }; break; } }   // câmera de frente para o outdoor
  luogoNotte = D.luoghi.find(l => l.nome === R.notte_citta);
  // painel da loja (como no site)
  const [, emo, tipoNome] = tipoDi(vcm.tipo);
  $('#scheda').innerHTML = `<div class="luogo">📍 ${esc(vcm.luogo.nome)} · ${esc(vcm.luogo.regione.nome)}</div><h2>${emo} ${esc(vcm.nome)}</h2><div class="sub">${esc(tipoNome)}</div>
    ${vcm.logo ? `<img src="${esc(vcm.logo)}" alt="">` : ''}<p>${esc(vcm.descrizione)}</p><span class="wa">💬 Scrivi su WhatsApp</span>`;
  await Promise.all([...document.images].map(i => i.decode().catch(() => {})));
  mis = criarMisura();
  // duelo: os dois primeiros da semana (pontos reais)
  const [a, b] = D.ranking.slice(0, 2), max = a.sett;
  $('#duello').innerHTML = `<h2>🏛️ PRIMO PRESIDENTE D'ITALIA</h2><div class="quando">si elegge domenica 1 novembre alle 21</div>
    ${[a, b].map((c, i) => `<div class="riga"><div class="pos">${i + 1}</div><div class="quem"><b>@${esc(c.conta)}</b><small>${esc(D.luoghi[c.luogo].nome)}</small><div class="barra"><i data-pct="${(100 * c.sett / max).toFixed(1)}"></i></div></div><div class="pts">${num(c.sett)}</div></div>`).join('')}
    <div id="vs" class="forte g" style="top:62%">VS</div>`;
  $('#duello').style.position = 'absolute';
  montarChaves();
  scene = [
    [0, 'CAPOLUOGHI', t => `${caps.filter(c => t >= c.tv).length}/20`, '', 'g grande'],
    [E.primo, `IL PRIMO: <span class="g">${esc(primo.l.nome)}</span>`, `<span class="g">${durata((primo.l.fondatore_ts - t0) / 1000)}</span>`],
    [E.ultimo, `L'ULTIMO: <span class="g">${esc(ultimo.l.nome)}</span>`, `<span class="g">${durata((ultimo.l.fondatore_ts - t0) / 1000)}</span>`],
    [E.case, t => `<span class="g">+${num(Math.round(totale * punti.material.uniforms.lim.value))}</span>`, `CASE ${esc(R.periodo)}`, 'grande'],
    [E.roma, 'LE CITTÀ', '<span class="g">CON PIÙ CASE</span>'],
    [E.negozi, 'I PRIMI', '<span class="g">NEGOZI VERI</span> 🏪'],
    [E.tuo, 'IL TUO NEGOZIO', '<span class="g">SULLA MAPPA</span>'],
    [E.misura, 'SU MISURA', '<span class="g">COME VUOI TU</span>'],
    [E.cartellone, 'O UN CARTELLONE', '<span class="g">NELLA TUA CITTÀ</span>'],
    [E.posti, '', ''],
    [E.halloween, '🎃 HALLOWEEN', '<span class="g">DAL 27 AL 31 OTTOBRE</span>'],
    [E.presidente, 'DOMENICA ORE 21', '<span class="g">SI ELEGGE</span>'],
    [E.cta, 'E LA TUA', '<span class="g">CITTÀ?</span>', '', 'grande'],
    [E.commenta - 0.05, '', ''],
  ];
  // capa: título grande no lugar da legenda
  if (R.copertina) {
    const cp = R.copertina;
    $('#testa').style.display = 'none';
    const el = document.createElement('div');
    el.className = 'forte';
    el.style.cssText = `position:absolute;left:30px;right:30px;top:${cp.titolo_top}px;text-align:center;line-height:1.05;`;
    el.innerHTML = cp.linee.map(([txt, giallo, size]) => `<div style="font-size:${size}px;-webkit-text-stroke-width:${Math.round(size * 0.19)}px"${giallo ? ' class="g"' : ''}>${esc(txt)}</div>`).join('');
    document.body.appendChild(el);
  }
  console.log(`primo ${primo.l.nome} @${primo.l.fondatore} · ultimo ${ultimo.l.nome} @${ultimo.l.fondatore} · tour ${tour.map(x => x.cm.nome).join(', ')} · duelo @${a.conta} ${a.sett} x @${b.conta} ${b.sett}`);
  quadro(0);
  return { durata: R.durata, fps: 30 };
}

iniciar().catch(e => console.error('erro ao carregar', e));
