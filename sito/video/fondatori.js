// Reel "fondatori" com dados reais: contador de casas no mapa, mergulho em duas cidades disputadas
// (fundador x 2º a chegar, com a diferença em segundos), bandeira FONDATORE e chamada final.
// window.preparar(roteiro), window.quadro(t), window.suoni() -> lista de efeitos sonoros; tudo depende só de t.
import * as THREE from 'three';
import { carregar } from '../js/dati.js';
import { Mappa } from '../js/mappa.js';
import { Citta, posLote, DIST_CIDADE, LOTE } from '../js/citta.js';
import { ALTURA_NIVEL } from '../js/modelli.js';

const $ = s => document.querySelector(s);
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const suave = s => (s < 0.5 ? 4 * s * s * s : 1 - Math.pow(-2 * s + 2, 3) / 2);
const ressalto = s => { const c = 1.9; return s <= 0 ? 0 : s >= 1 ? 1 : 1 + (c + 1) * Math.pow(s - 1, 3) + c * Math.pow(s - 1, 2); };
const fase = (t, ini, dur) => clamp((t - ini) / dur);
const esc = s => String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
const num = n => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
const ora = ms => new Date(ms).toLocaleTimeString('it-IT', { timeZone: 'Europe/Rome', hour: '2-digit', minute: '2-digit', second: '2-digit' });

let D, mappa, citta, R, E, chaves, punti, totale, dispute, scene, etichette = [];

async function iniciar() {
  D = await carregar('video');
  totale = D.casas.length;
  mappa = new Mappa($('#mappa'), D.geo, D.rilievo, D.imagem, { gravacao: true });
  window.preparar = preparar;
  window.quadro = quadro;
  window.suoni = suoni;
}

// uma bolinha branca por cidade, que "pipoca" quando a cidade é fundada; "lim" (0 a 1) é a fração de casas já chegadas
function criarPontos() {
  const ordem = D.casas.map((c, i) => i).sort((a, b) => D.casas[a].ts - D.casas[b].ts);
  const rankCasa = new Float32Array(D.casas.length);
  ordem.forEach((i, k) => { rankCasa[i] = (k + 1) / ordem.length; });
  const rank = new Float32Array(D.luoghi.length), pos = new Float32Array(D.luoghi.length * 3);
  // só cidades com 3+ casas: o mapa não fica coberto de pontos
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
        gl_PointSize = ord > lim ? 0.0 : clamp(0.05 * escala / -mv.z, 15.0, 19.0) * pop;
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
  p.frustumCulled = false;
  p.renderOrder = 5;
  mappa.scene.add(p);
  return p;
}

// bandeira "FONDATORE" ao lado da casa do fundador: mastro + pano que ondula
function texturaBandiera() {
  const cv = document.createElement('canvas');
  cv.width = 512; cv.height = 200;
  const x = cv.getContext('2d');
  x.fillStyle = '#FFC93C'; x.fillRect(0, 0, 512, 200);
  x.strokeStyle = '#C8961E'; x.lineWidth = 14; x.strokeRect(7, 7, 498, 186);
  x.fillStyle = '#8A6A14'; x.font = '900 74px Nunito'; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.fillText('FONDATORE', 256, 108);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}
function criarBandiera(casa) {
  const g = new THREE.Group(), H = LOTE * 1.7, W = LOTE * 1.0, A = W * 0.39;
  const asta = new THREE.Mesh(new THREE.CylinderGeometry(LOTE * 0.025, LOTE * 0.03, H, 8), new THREE.MeshLambertMaterial({ color: '#5A3A22' }));
  asta.position.y = H / 2;
  const palla = new THREE.Mesh(new THREE.SphereGeometry(LOTE * 0.06, 12, 8), new THREE.MeshLambertMaterial({ color: '#E8B33A' }));
  palla.position.y = H + LOTE * 0.04;
  const geo = new THREE.PlaneGeometry(W, A, 24, 4);
  geo.translate(W / 2, 0, 0);
  const pano = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ map: texturaBandiera(), side: THREE.DoubleSide }));
  pano.userData.base = Float32Array.from(geo.attributes.position.array);
  g.add(asta, palla, pano);
  g.userData = { pano, H, A };
  const m = LOTE * 0.5;
  g.position.set(casa.x + m, casa.y, casa.z + m);
  g.visible = false;
  mappa.scene.add(g);
  return g;
}
function animarBandiera(b, t, ini, fim) {
  b.visible = t >= ini && t < fim;
  if (!b.visible) return;
  const s = ressalto(fase(t, ini, 0.4)), { pano, H, A } = b.userData;
  b.scale.set(1, Math.max(0.001, s), 1);
  // o pano sobe pelo mastro e ondula
  pano.position.y = H - A / 2 - (1 - suave(fase(t, ini + 0.15, 0.5))) * (H - A);
  const p = pano.geometry.attributes.position, base = pano.userData.base, W = LOTE * 1.0;
  for (let i = 0; i < p.count; i++) {
    const x = base[i * 3], k = x / W;
    p.setZ(i, Math.sin(x / W * 7 - t * 9) * LOTE * 0.09 * k);
    p.setY(i, base[i * 3 + 1] - k * k * LOTE * 0.05 * (1 + Math.sin(t * 5) * 0.3));
  }
  p.needsUpdate = true;
  pano.geometry.computeVertexNormals();
  b.rotation.y = mappa.az + 0.35;
}

// ---------- câmera: chaves (t, alvo, dist, az, giu) ----------
function montarChaves() {
  const b = D.geo.bbox, alt = b.z1 - b.z0, dP = mappa.distPais();
  const paese = { x: (b.x0 + b.x1) / 2, z: (b.z0 + b.z1) / 2 - alt * 0.07, dist: dP, az: 0, giu: 0 };
  const [f, l] = dispute;
  const meio = d => ({ x: (d.primo.x + d.secondo.x) / 2, z: (d.primo.z + d.secondo.z) / 2 });
  const P = d => ({ x: d.primo.x, z: d.primo.z }), S = d => ({ x: d.secondo.x, z: d.secondo.z });
  const lista = [
    [0, { ...paese, dist: dP * 1.04 }],
    [E.tuffo, { ...paese, dist: dP * 0.95 }],
    [E.tuffo + 1.5, { ...meio(f), dist: 0.62, az: 0.45, giu: 0.12 }],
    [E.secondo + 0.1, { ...S(f), dist: 0.6, az: 0.6, giu: 0.12 }],
    [E.pan, { ...S(f), dist: 0.58, az: 0.68 }],
    [E.pan + 0.9, { ...P(f), dist: 0.56, az: 0.8, giu: 0.14 }],
    [E.livorno, { dist: 0.54, az: 0.95 }],
    [E.livorno + 0.6, { x: (f.primo.x + l.primo.x) / 2, z: (f.primo.z + l.primo.z) / 2, dist: 160, az: 0.4, giu: 0 }],
    [E.livorno + 1.35, { ...meio(l), dist: 0.66, az: 0.35, giu: 0.12 }],
    [E.badge2 + 0.4, { ...P(l), dist: 0.58, az: 0.5, giu: 0.14 }],
    [E.segui, { ...P(l), dist: 0.56, az: 1.0 }],
    [E.prima, { dist: 0.8, az: 1.15, giu: 0.12 }],
    [E.prima + 0.9, { ...paese, dist: dP * 0.98 }],
    [R.durata, { ...paese, dist: dP * 1.02 }],
  ];
  let ant = {};
  chaves = lista.map(([t, k]) => { ant = { ...ant, ...k }; return { t, k: { ...ant } }; });
}
function camera(t) {
  let i = 0;
  while (i < chaves.length - 2 && t >= chaves[i + 1].t) i++;
  const a = chaves[i], b = chaves[Math.min(i + 1, chaves.length - 1)];
  const s = b.t > a.t ? suave(clamp((t - a.t) / (b.t - a.t))) : 1;
  const A = a.k, B = b.k, l = (p, q) => p + (q - p) * s;
  const dxz = Math.hypot(B.x - A.x, B.z - A.z);
  const dist = Math.exp(l(Math.log(A.dist), Math.log(B.dist)));
  // em voo longo o alvo chega antes do zoom: a cidade aparece no centro e vai crescendo
  const sxz = dxz > 20 ? suave(clamp((t - a.t) / ((b.t - a.t) * 0.55))) : s;
  const az = l(A.az, B.az), giu = l(A.giu, B.giu), x = A.x + (B.x - A.x) * sxz, z = A.z + (B.z - A.z) * sxz;
  mappa.az = az;
  mappa.dist = dist;
  mappa.alvo.x = x - Math.sin(az) * giu * dist;
  mappa.alvo.z = z - Math.cos(az) * giu * dist;
  mappa.atualizarCamera();
  return dist;
}

// ---------- textos ----------
function projetar(x, y, z) {
  const p = new THREE.Vector3(x, y, z).project(mappa.camera);
  return { x: (p.x + 1) / 2 * 1080, y: (1 - p.y) / 2 * 1920, ok: p.z < 1 };
}
function criarEtichetta(d, quem, fondatore) {
  const c = d[quem], l = d.luogo, el = document.createElement('div');
  el.className = 'etichetta';
  el.innerHTML = `${fondatore ? '' : `<div class="fumetto"><small>@${esc(c.conta)}</small><b>${esc(d.commento)}</b></div>`}
    <div class="card${fondatore ? ' oro' : ''}"><b>${fondatore ? '★ ' : ''}@${esc(c.conta)}</b><small>${esc(l.nome)}, ${esc(l.comune.sigla)}</small><small>ha commentato alle ${ora(c.ts)}</small>
    ${fondatore ? `<div class="badge">${d.diff} s PRIMA</div>` : ''}</div><div class="freccia"></div>`;
  $('#etichette').appendChild(el);
  return el;
}
function legenda(t) {
  const f = R.frasi.find(x => t >= x.ini && t < x.fim);
  const html = f && !R.copertina ? f.linee.map(l => l.filter(w => t >= w[1]).map(w => w[2] ? `<span class="g">${esc(w[0])}</span>` : esc(w[0])).join(' ')).filter(Boolean).join('<br>') : '';
  const el = $('#sott');
  if (el.innerHTML !== html) el.innerHTML = html;
}
function pop(el, t, ini, fim = Infinity) {
  const s = ressalto(fase(t, ini, 0.32)), sai = fase(t, fim - 0.2, 0.2);
  el.style.opacity = t >= ini && t < fim ? String(1 - sai) : '0';
  el.style.transform = `scale(${0.4 + 0.6 * s})`;
}

// cabeçalho por cena: [início, linha 1, linha 2, classe da linha 1]
function cabecalho(t) {
  let k = 0;
  while (k < scene.length - 1 && t >= scene[k + 1][0]) k++;
  const [ini, r1, r2, cls] = scene[k];
  const n = Math.round(totale * punti.material.uniforms.lim.value);
  const h1 = typeof r1 === 'function' ? r1(n) : r1;
  if ($('#r1').innerHTML !== h1) $('#r1').innerHTML = h1;
  if ($('#r2').innerHTML !== r2) $('#r2').innerHTML = r2;
  $('#r1').className = cls ?? '';
  const s = ressalto(fase(t, ini, 0.3));
  $('#righe').style.transform = `scale(${ini > 0 ? 0.5 + 0.5 * s : 1})`;
  $('#righe').style.opacity = r1 || r2 ? '1' : '0';
}

function quadro(t) {
  const dist = camera(t);
  punti.visible = dist > DIST_CIDADE * 0.55;
  punti.material.uniforms.lim.value = t < 0.15 ? 0.004 : clamp(0.004 + 0.996 * suave(fase(t, 0.15, E.contatore_a - 0.15)));
  cabecalho(t);
  const [f, l] = dispute;
  const fimF = E.livorno + 0.25, fimL = E.prima + 0.2;
  for (const e of etichette) {
    const vis = t >= e.ini && t < e.fim;
    if (!vis) { e.el.style.opacity = '0'; continue; }
    const c = e.casa, p = projetar(c.x, c.y + ALTURA_NIVEL[c.livello] * LOTE + (e.alto ?? 0.004), c.z);
    // o rótulo do 2º recua quando o fundador aparece
    const atras = e.recua ? 1 - 0.25 * fase(t, e.recua, 0.3) : 1;
    const s = ressalto(fase(t, e.ini, 0.32)) * (1 - fase(t, e.fim - 0.2, 0.2)) * atras;
    e.el.style.opacity = p.ok ? String(e.recua ? 1 - 0.35 * fase(t, e.recua, 0.3) : 1) : '0';
    e.el.style.zIndex = e.recua ? '1' : '2';
    e.el.style.transform = `translate(${p.x + (e.dx ?? 0) - e.el.offsetWidth / 2}px, ${p.y - e.el.offsetHeight}px) scale(${s})`;
    const bd = e.el.querySelector('.badge');
    if (bd) bd.style.transform = `rotate(${8 - 14 * (1 - ressalto(fase(t, e.badge, 0.3)))}deg) scale(${ressalto(fase(t, e.badge, 0.3)) * (t >= e.badge ? 1 : 0)})`;
  }
  animarBandiera(f.bandiera, t, E.fondatore + 0.1, fimF);
  animarBandiera(l.bandiera, t, E.livorno_lbl + 0.35, fimL);
  const cta = $('#cta').children;
  pop(cta[0], t, E.segui);
  pop(cta[1], t, E.commenta);
  pop(cta[2], t, E.prima + 0.2);
  legenda(t);
  mappa.renderer.render(mappa.scene, mappa.camera);
  return true;
}

// efeitos sonoros (tempo em s, tipo, volume, tom): o mixador (strumenti/suoni.mjs) sintetiza cada um
function suoni() {
  const s = [];
  for (let t = 0.2, k = 0; t < E.contatore_a; t += 0.075, k++) s.push({ t, tipo: 'tick', vol: 0.5, tono: 1 + 0.5 * t / E.contatore_a });
  for (let t = 0.25, k = 0; t < E.contatore_a + 0.2; t += 0.11, k++) s.push({ t, tipo: 'pop', vol: 0.35, tono: 0.8 + ((k * 37) % 9) / 12 });
  s.push({ t: E.contatore_a, tipo: 'ding', vol: 0.45, tono: 1.2 });
  s.push({ t: E.tuffo - 0.05, tipo: 'whoosh', vol: 0.9, dur: 1.4, giu: true });
  s.push({ t: E.tuffo, tipo: 'pop', vol: 0.7, tono: 0.7 });
  s.push({ t: E.secondo, tipo: 'select', vol: 0.8 });
  s.push({ t: E.pan, tipo: 'whoosh', vol: 0.55, dur: 0.8 });
  s.push({ t: E.fondatore, tipo: 'select', vol: 0.8, tono: 1.25 });
  s.push({ t: E.fondatore + 0.12, tipo: 'flap', vol: 0.7 });
  s.push({ t: E.badge, tipo: 'stamp', vol: 1 });
  s.push({ t: E.livorno - 0.05, tipo: 'whoosh', vol: 0.7, dur: 0.7 });
  s.push({ t: E.livorno, tipo: 'pop', vol: 0.7, tono: 0.75 });
  s.push({ t: E.livorno + 0.55, tipo: 'whoosh', vol: 0.85, dur: 0.9, giu: true });
  s.push({ t: E.livorno_lbl, tipo: 'select', vol: 0.8 });
  s.push({ t: E.livorno_lbl + 0.25, tipo: 'select', vol: 0.8, tono: 1.25 });
  s.push({ t: E.livorno_lbl + 0.4, tipo: 'flap', vol: 0.7 });
  s.push({ t: E.badge2, tipo: 'stamp', vol: 1 });
  s.push({ t: E.regola, tipo: 'pop', vol: 0.75, tono: 0.7 });
  s.push({ t: E.segui, tipo: 'pop', vol: 0.8, tono: 0.9 });
  s.push({ t: E.commenta, tipo: 'pop', vol: 0.8, tono: 1.05 });
  s.push({ t: E.prima - 0.05, tipo: 'whoosh', vol: 0.7, dur: 1.3 });
  s.push({ t: E.prima + 0.2, tipo: 'pop', vol: 0.85, tono: 1.2 });
  s.push({ t: E.prima + 1.4, tipo: 'ding', vol: 0.5, tono: 1 });
  return s;
}

async function preparar(roteiro) {
  R = roteiro; E = R.eventi;
  await Promise.all(['900 104px Nunito', '900 92px Nunito', '800 40px Nunito', '700 30px Nunito'].map(f => document.fonts.load(f)));
  await document.fonts.ready;
  citta = new Citta(mappa, D);
  punti = criarPontos();
  // disputas reais: fundador (1ª casa) x 2º a chegar
  dispute = R.dispute.map(d => {
    const luogo = D.luoghi.find(l => l.nome === d.citta);
    const [primo, secondo] = luogo.casas.map(i => D.casas[i]).sort((a, b) => a.ts - b.ts);
    citta.posCasa(primo); citta.posCasa(secondo);
    return { ...d, luogo, primo, secondo, diff: Math.round((secondo.ts - primo.ts) / 1000) };
  });
  for (const d of dispute) d.bandiera = criarBandiera(d.primo);
  montarChaves();
  const [f, l] = dispute;
  scene = [
    [0, n => `<span class="g">+${num(n)}</span>`, esc(R.periodo), 'grande'],
    [E.tuffo, 'LOTTA PER FONDARE', `<span class="g">${esc(f.luogo.nome)}</span>`],
    [E.livorno, `E A <span class="g">${esc(l.luogo.nome)}</span>`, `<span class="g">${l.diff} SECONDI</span>`],
    [E.regola, 'IL PRIMO CHE COMMENTA', 'DIVENTA <span class="g">FONDATORE</span>'],
    [E.segui, '', ''],
  ];
  const fimF = E.livorno + 0.25, fimL = E.segui + 0.15;
  etichette = [
    { el: criarEtichetta(f, 'secondo', false), casa: f.secondo, ini: E.secondo, fim: fimF, recua: E.fondatore },
    { el: criarEtichetta(f, 'primo', true), casa: f.primo, ini: E.fondatore, fim: fimF, badge: E.badge, alto: LOTE * 0.95, dx: -60 },
    { el: criarEtichetta(l, 'secondo', false), casa: l.secondo, ini: E.livorno_lbl, fim: fimL, recua: E.livorno_lbl + 0.25 },
    { el: criarEtichetta(l, 'primo', true), casa: l.primo, ini: E.livorno_lbl + 0.25, fim: fimL, badge: E.badge2, alto: LOTE * 0.95, dx: -60 },
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
  console.log(dispute.map(d => `${d.luogo.nome}: @${d.primo.conta} ${ora(d.primo.ts)} x @${d.secondo.conta} ${ora(d.secondo.ts)} = ${d.diff} s`).join(' | '));
  quadro(0);
  return { durata: R.durata, fps: 30 };
}

iniciar().catch(e => console.error('erro ao carregar', e));
