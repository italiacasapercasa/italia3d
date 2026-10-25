// Modo gravação: desenha o reel quadro a quadro (window.preparar(roteiro), window.quadro(t)).
// Usado por strumenti/cattura.mjs. Todas as animações dependem só de t, para o vídeo sair igual sempre.
import * as THREE from 'three';
import { Mappa } from '../js/mappa.js';
import { geometriaCasa, Construtor } from '../js/modelli.js';

const $ = s => document.querySelector(s);
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const suave = s => (s < 0.5 ? 4 * s * s * s : 1 - Math.pow(-2 * s + 2, 3) / 2);
const ressalto = s => { const c = 1.9; return s <= 0 ? 0 : s >= 1 ? 1 : 1 + (c + 1) * Math.pow(s - 1, 3) + c * Math.pow(s - 1, 2); };
const fase = (t, ini, dur) => clamp((t - ini) / dur);
let semente = 7;
const rnd = () => { semente = (semente * 16807) % 2147483647; return semente / 2147483647; };
const esc = s => String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

let mappa, geo, comuni, R, cena, chaves;

async function carregar() {
  const img = new Image();
  const [g, ril, com] = await Promise.all([
    fetch('../data/geo.json').then(r => r.json()),
    fetch('../data/rilievo.bin').then(r => r.arrayBuffer()),
    fetch('../data/comuni.json').then(r => r.json()),
    new Promise((ok, erro) => { img.onload = ok; img.onerror = erro; img.src = '../data/terreno.png'; }),
  ]);
  geo = g; comuni = com.dados;
  mappa = new Mappa($('#cena'), geo, new Uint16Array(ril), img, { gravacao: true });
  window.preparar = preparar;
  window.quadro = quadro;
}

// ---------- objetos 3D ----------
function vulcano(V) {
  const g = new THREE.CylinderGeometry(0.7, 6.2, 5.2, 11, 5, false);
  const pos = g.attributes.position, desl = new Map();
  for (let i = 0; i < pos.count; i++) {
    const k = `${pos.getX(i).toFixed(3)},${pos.getY(i).toFixed(3)},${pos.getZ(i).toFixed(3)}`;
    if (!desl.has(k)) desl.set(k, [(rnd() - 0.5) * 0.8, (rnd() - 0.5) * 0.4, (rnd() - 0.5) * 0.8]);
    const [dx, dy, dz] = desl.get(k), topo = pos.getY(i) > 2.5 ? 0.25 : 1;
    pos.setXYZ(i, pos.getX(i) + dx * topo, pos.getY(i) + dy * topo, pos.getZ(i) + dz * topo);
  }
  const ng = g.toNonIndexed();
  ng.computeVertexNormals();
  const p = ng.attributes.position, n = ng.attributes.normal, cores = new Float32Array(p.count * 3), c = new THREE.Color();
  for (let i = 0; i < p.count; i += 3) {
    const y = (p.getY(i) + p.getY(i + 1) + p.getY(i + 2)) / 3;
    if (n.getY(i) > 0.95 && y > 2.3) c.set('#5E5148');
    else c.set(y < -1.6 ? '#7DAA58' : y < 0.2 ? '#8E8170' : y < 1.6 ? '#A99D90' : '#F2F2EF');
    for (let j = 0; j < 3; j++) c.toArray(cores, (i + j) * 3);
  }
  ng.setAttribute('color', new THREE.BufferAttribute(cores, 3));
  const m = new THREE.Mesh(ng, new THREE.MeshLambertMaterial({ vertexColors: true }));
  const h = mappa.altura(V.x, V.z);
  m.position.set(V.x, h + 2.3, V.z);
  mappa.scene.add(m);
  // fumaça
  const fumo = [];
  const geoF = new THREE.IcosahedronGeometry(1, 1);
  for (let i = 0; i < 10; i++) {
    const mf = new THREE.Mesh(geoF, new THREE.MeshLambertMaterial({ color: '#F4F4F2', transparent: true, depthWrite: false }));
    mappa.scene.add(mf);
    fumo.push(mf);
  }
  return { mesh: m, fumo, topo: h + 4.8, x: V.x, z: V.z };
}

function bosco(C, chao) {
  const S = 0.06, grupo = new THREE.Group();
  const matChao = new THREE.MeshLambertMaterial({ color: '#9CCB6E', transparent: true });
  const disco = new THREE.Mesh(new THREE.CircleGeometry(9, 80), matChao);
  disco.rotation.x = -Math.PI / 2;
  disco.position.set(C.x, chao, C.z);
  grupo.add(disco);
  const tipos = [
    b => b.cilindro(0.06, 0.32, 0, 0, 0, '#7A4E2D', 5).esfera(0.34, 0, 0.6, 0, '#4E9A43'),
    b => b.cilindro(0.06, 0.32, 0, 0, 0, '#7A4E2D', 5).esfera(0.3, 0, 0.55, 0, '#5FAE4E'),
    b => b.cilindro(0.06, 0.2, 0, 0, 0, '#7A4E2D', 5).cone(0.3, 0.95, 0, 0.12, 0, '#2F6B3A', 6),
  ];
  const mats = [];
  for (const [k, tipo] of tipos.entries()) {
    const b = new Construtor(); tipo(b);
    const mat = new THREE.MeshLambertMaterial({ vertexColors: true, transparent: true });
    const n = k === 2 ? 3200 : 3600, im = new THREE.InstancedMesh(b.geometria(), mat, n);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), s = new THREE.Vector3(), y = new THREE.Vector3(0, 1, 0);
    let i = 0;
    while (i < n) {
      // clareira aberta com poucas árvores soltas; floresta densa logo depois, como no original
      const solta = i < 18;
      const r = solta ? 0.11 + rnd() * 0.2 : 0.33 + Math.pow(rnd(), 1.7) * 6.2, a = rnd() * Math.PI * 2;
      const e = S * (0.8 + rnd() * 0.6);
      m4.compose(v.set(C.x + Math.cos(a) * r, chao, C.z + Math.sin(a) * r), q.setFromAxisAngle(y, rnd() * 6.28), s.set(e, e, e));
      im.setMatrixAt(i++, m4);
    }
    im.frustumCulled = false;
    grupo.add(im);
    mats.push(mat);
  }
  mappa.scene.add(grupo);
  return { grupo, mats: [matChao, ...mats] };
}

function texturaBandiera(testo) {
  const c = document.createElement('canvas');
  c.width = 640; c.height = 240;
  const g = c.getContext('2d');
  g.fillStyle = '#FFC93C'; g.fillRect(0, 0, 640, 240);
  g.strokeStyle = '#B88A12'; g.lineWidth = 14; g.strokeRect(7, 7, 626, 226);
  g.fillStyle = '#152033'; g.font = '900 104px Nunito'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(testo, 320, 126, 590);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function casa(C, chao, az) {
  const grupo = new THREE.Group();
  grupo.position.set(C.x, chao, C.z);
  grupo.rotation.y = az;
  const matCasa = new THREE.MeshLambertMaterial({ vertexColors: true });
  const m = new THREE.Mesh(geometriaCasa(1, 2), matCasa);
  m.scale.setScalar(0.07);
  grupo.add(m);
  const matPalo = new THREE.MeshLambertMaterial({ color: '#5B4632' });
  const palo = (x, z, h) => { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.0016, 0.0019, h, 6), matPalo); p.geometry.translate(0, h / 2, 0); p.position.set(x, 0, z); grupo.add(p); return p; };
  const pE = palo(-0.036, -0.012, 0.056), pD = palo(0.04, 0.006, 0.064);
  const band = new THREE.Mesh(new THREE.PlaneGeometry(0.034, 0.0128), new THREE.MeshLambertMaterial({ map: texturaBandiera(R.fondatore), side: THREE.DoubleSide }));
  band.geometry.translate(0.017, -0.0064, 0);
  band.position.set(0.04, 0.0635, 0.006);
  band.rotation.y = 0.55 - az - 0.2;   // de frente para a câmera (az 0.55), levemente virada
  grupo.add(band);
  // bandeirinhas tricolores entre os postes
  const bandierine = [], A = new THREE.Vector3(-0.036, 0.055, -0.012), B = new THREE.Vector3(0.04, 0.061, 0.006);
  const cores = ['#2E9B55', '#FFFFFF', '#E0473C'];
  const N = 15;
  const linhaPts = [];
  for (let i = 0; i <= 30; i++) { const s = i / 30, p = A.clone().lerp(B, s); p.y -= 0.008 * 4 * s * (1 - s); linhaPts.push(p); }
  const linha = new THREE.Line(new THREE.BufferGeometry().setFromPoints(linhaPts), new THREE.LineBasicMaterial({ color: '#3A3F4A' }));
  grupo.add(linha);
  for (let i = 0; i < N; i++) {
    const s = (i + 0.5) / N, p = A.clone().lerp(B, s);
    p.y -= 0.008 * 4 * s * (1 - s);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-0.0022, 0, 0, 0.0022, 0, 0, 0, -0.0048, 0]), 3));
    g.computeVertexNormals();
    const tri = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ color: cores[i % 3], side: THREE.DoubleSide }));
    tri.position.copy(p);
    tri.rotation.y = Math.atan2(B.z - A.z, B.x - A.x) * -1;
    grupo.add(tri);
    bandierine.push(tri);
  }
  mappa.scene.add(grupo);
  return { grupo, casa: m, pali: [pE, pD], band, linha, bandierine };
}

// ---------- câmera ----------
function montarChaves() {
  const E = R.eventi, V = R.vulcano, C = R.luogo, hv = mappa.altura(V.x, V.z), hc = cena.chao;
  // mapa da Itália ocupando ~45% da altura da tela (como o México no original); no fim ~37%, abaixo do banner
  const b = geo.bbox, tg = Math.tan(mappa.camera.fov * Math.PI / 360), altItalia = 1300, cz = (b.z0 + b.z1) / 2;
  const dPaese = altItalia / (0.45 * 2 * tg), dFim = altItalia / (0.37 * 2 * tg);
  const paese = { x: (b.x0 + b.x1) / 2, z: cz - 0.02 * dPaese * 2 * tg, y: 0, dist: dPaese, az: 0, el: 89 };
  const L = { x: C.x, z: C.z, y: hc + 0.016 };
  // tempos presos aos eventos (que o sincronizador ajusta à narração)
  const P = E.paese ?? 1.5, Z = E.zoom, Zf = E.casa - 0.2, zi = f => Z + (Zf - Z) * f;
  const lista = [
    [0.0, { x: V.x, z: V.z, y: hv + 2.3, dist: 24, az: 0.32, el: 8 }],
    [P - 0.6, { dist: 22, az: 0.4, el: 9 }],
    [P - 0.28, { y: hv, dist: 110, az: 0.15, el: 58 }],
    [P + 0.1, paese],
    [Z, {}],
    [zi(0.2), { x: C.x, z: C.z, y: hc, dist: 260, az: 0.2, el: 80 }],
    [zi(0.43), { dist: 32, az: 0.35, el: 66 }],
    [zi(0.68), { dist: 4.5, az: 0.45, el: 54 }],
    [Zf, { ...L, dist: 0.42, az: 0.55, el: 40 }],
    [E.casa + 0.35, { dist: 0.3, el: 38 }],
    [E.pali, { dist: 0.31 }],
    [E.pali + 0.5, { dist: 0.37, el: 37 }],
    [E.zoomout, { dist: 0.39 }],
    [E.zoomout + 0.45, { y: hc, dist: 6, az: 0.5, el: 60 }],
    [E.zoomout + 0.85, { dist: 300, az: 0.2, el: 82 }],
    [E.zoomout + 1.15, paese],
    [E.banner, {}],
    [E.banner + 0.6, { z: cz - 0.01 * dFim * 2 * tg, dist: dFim }],
  ];
  let ant = {}, tAnt = -1;
  chaves = lista.map(([t, k]) => { ant = { ...ant, ...k }; tAnt = Math.max(t, tAnt + 0.05); return [tAnt, { ...ant }]; });
}

function camera(t) {
  let i = 0;
  while (i < chaves.length - 2 && t >= chaves[i + 1][0]) i++;
  const [t0, a] = chaves[i], [t1, b] = chaves[Math.min(i + 1, chaves.length - 1)];
  const s = t1 > t0 ? suave(clamp((t - t0) / (t1 - t0))) : 1;
  const l = (p, q) => p + (q - p) * s;
  const k = { x: l(a.x, b.x), z: l(a.z, b.z), y: l(a.y, b.y), az: l(a.az, b.az), el: l(a.el, b.el), dist: Math.exp(l(Math.log(a.dist), Math.log(b.dist))) };
  const c = mappa.camera, el = k.el * Math.PI / 180, d = k.dist;
  c.position.set(k.x + Math.sin(k.az) * Math.cos(el) * d, k.y + Math.sin(el) * d, k.z + Math.cos(k.az) * Math.cos(el) * d);
  c.up.set(-Math.sin(k.az), 0, -Math.cos(k.az)).multiplyScalar(el > 1.5 ? 1 : 0).add(new THREE.Vector3(0, el > 1.5 ? 0 : 1, 0)).normalize();
  c.lookAt(k.x, k.y, k.z);
  c.near = Math.max(0.002, d * 0.02);
  c.far = d * 14 + 400;
  c.updateProjectionMatrix();
  // capa: desloca a cena para baixo, abrindo espaço para o título
  if (R.copertina?.giu) c.setViewOffset(1080, 1920, 0, -R.copertina.giu, 1080, 1920);
  c.updateMatrixWorld(true);   // rótulos projetados com a câmera deste quadro, não a do anterior
  const f = mappa.scene.fog;
  if (d < 60) { f.near = d * 2.4; f.far = d * 8; } else { f.near = 1e5; f.far = 2e5; }
  return k;
}

// ---------- quadros ----------
function projetar(v) {
  const p = v.clone().project(mappa.camera);
  return { x: (p.x + 1) / 2 * 1080, y: (1 - p.y) / 2 * 1920, ok: p.z < 1 };
}

function legenda(t) {
  const f = R.frasi.find(x => t >= x.ini && t < x.fim);
  const html = f ? f.linee.map(l => l.filter(w => t >= w[1]).map(w => w[2] ? `<span class="g">${esc(w[0])}</span>` : esc(w[0])).join(' ')).filter(Boolean).join('<br>') : '';
  const el = $('#sott');
  if (el.innerHTML !== html) el.innerHTML = html;
}

function quadro(t) {
  const k = camera(t), E = R.eventi;
  // vulcão e fumaça
  const vis = k.dist < 400 && t < E.zoom;   // o vulcão só aparece na abertura
  cena.vulcano.mesh.visible = vis;
  cena.vulcano.fumo.forEach((m, i) => {
    const p = (t * 0.32 + i / cena.vulcano.fumo.length) % 1;
    m.visible = vis;
    m.position.set(cena.vulcano.x + p * 3.2 + Math.sin(i * 1.7) * 0.4, cena.vulcano.topo + p * 6, cena.vulcano.z - p * 1.2 + Math.cos(i * 2.3) * 0.4);
    m.scale.setScalar(0.55 + p * 1.9);
    m.material.opacity = clamp((1 - p) * 1.1) * 0.92;
  });
  // floresta aparece na descida
  const op = clamp((9 - k.dist) / 4.5);
  cena.bosco.grupo.visible = op > 0.001;
  cena.bosco.mats.forEach(m => { m.opacity = op; m.depthWrite = op > 0.98; });
  // casa caindo, postes, bandeira, bandeirinhas
  const sc = ressalto(fase(t, E.casa, 0.42));
  cena.casa.casa.scale.set(0.07, 0.07 * Math.max(0.02, sc), 0.07);
  cena.casa.casa.visible = t >= E.casa;
  const sp = ressalto(fase(t, E.pali, 0.35));
  cena.casa.pali.forEach(p => { p.visible = sp > 0; p.scale.y = Math.max(0.01, sp); });
  cena.casa.band.visible = t >= E.pali + 0.15;
  cena.casa.band.scale.setScalar(Math.max(0.01, ressalto(fase(t, E.pali + 0.15, 0.3))));
  cena.casa.linha.visible = t >= E.bandierine;
  cena.casa.bandierine.forEach((b, i) => { const s = ressalto(fase(t, E.bandierine + i * 0.035, 0.22)); b.visible = s > 0; b.scale.setScalar(Math.max(0.01, s)); });
  cena.casa.grupo.visible = k.dist < 20;

  // textos fixos
  const ct = $('#contatore');
  const sct = ressalto(fase(t, R.testa.contatore_da, 0.3));
  ct.style.opacity = sct > 0 ? 1 : 0;
  ct.style.transform = `scale(${sct})`;
  const bn = $('#banner'), sb = fase(t, E.banner, 0.3);
  bn.style.opacity = sb;
  bn.style.transform = `translateY(${(1 - sb) * 20}px)`;
  legenda(t);
  if (R.copertina) { $('#sott').innerHTML = ''; ct.style.display = R.copertina.contatore ? 'block' : 'none'; }

  // balão do comentário digitando
  const cm = R.commento, cel = $('#commento');
  if (t >= cm.ini && t < cm.fim) {
    const ent = ressalto(fase(t, cm.ini, 0.25)), sai = fase(t, cm.fim - 0.25, 0.25);
    const n = Math.round(clamp((t - cm.scrivi_da) / (cm.scrivi_a - cm.scrivi_da)) * cm.testo.length);
    const cursor = (t * 2.4) % 1 < 0.55 || n < cm.testo.length ? '<span class="cursore"></span>' : '';
    cel.querySelector('.testo').innerHTML = esc(cm.testo.slice(0, n)) + cursor;
    cel.style.opacity = String(1 - sai);
    cel.style.transform = `translateY(${-sai * 60}px) scale(${(0.85 + 0.15 * ent) * (1 - 0.45 * sai)})`;
  } else cel.style.opacity = '0';

  // etiqueta sobre a casa
  const et = R.etichetta, eel = $('#etichetta');
  if (t >= et.ini && t < E.zoomout + 0.6) {
    const topo = projetar(new THREE.Vector3(R.luogo.x, cena.chao + 0.05, R.luogo.z));
    const s = ressalto(fase(t, et.ini, 0.32)) * (1 - fase(t, E.zoomout + 0.15, 0.4) * 0.7);
    const w = eel.offsetWidth, h = eel.offsetHeight;
    eel.style.opacity = String(1 - fase(t, E.zoomout + 0.35, 0.25));
    eel.style.transform = `translate(${topo.x - w / 2}px, ${topo.y - h}px) scale(${s})`;
    eel.querySelector('.fond').style.transform = `scale(${ressalto(fase(t, et.fondatore, 0.3))})`;
    eel.querySelector('.fond').style.display = t >= et.fondatore ? 'block' : 'none';
  } else eel.style.opacity = '0';

  // pontos das cidades no fim
  const pts = cena.pontos;
  for (const p of pts) {
    const ativo = t >= p.ini && k.dist > 150;
    if (!ativo) { if (p.el.style.transform !== 'scale(0)') { p.el.style.transform = 'scale(0)'; if (p.lab) p.lab.style.transform = 'translate(-50%, -150%) scale(0)'; } continue; }
    const q = projetar(p.v), s = ressalto(fase(t, p.ini, 0.25));
    p.el.style.left = `${q.x}px`; p.el.style.top = `${q.y}px`; p.el.style.transform = `scale(${s})`;
    if (p.lab) { p.lab.style.left = `${q.x}px`; p.lab.style.top = `${q.y}px`; p.lab.style.transform = `translate(-50%, -135%) scale(${s})`; }
  }

  mappa.renderer.render(mappa.scene, mappa.camera);
  return true;
}

// ---------- preparação ----------
const PICTO = `
<svg viewBox="0 0 92 70"><path d="M6 8 h68 a6 6 0 0 1 6 6 v34 a6 6 0 0 1 -6 6 h-38 l-14 12 v-12 h-16 a6 6 0 0 1 -6 -6 v-34 a6 6 0 0 1 6 -6z" fill="#fff" stroke="#152033" stroke-width="6" stroke-linejoin="round"/>
<circle cx="24" cy="31" r="5" fill="#152033"/><circle cx="40" cy="31" r="5" fill="#152033"/><circle cx="56" cy="31" r="5" fill="#152033"/></svg>
<svg viewBox="0 0 44 70"><rect x="4" y="22" width="36" height="9" rx="3" fill="#fff" stroke="#152033" stroke-width="5"/><rect x="4" y="40" width="36" height="9" rx="3" fill="#fff" stroke="#152033" stroke-width="5"/></svg>
<svg viewBox="0 0 92 70"><path d="M46 6 L86 22 L46 38 L6 22 Z" fill="#F2C98A" stroke="#152033" stroke-width="5" stroke-linejoin="round"/>
<path d="M6 22 L46 38 L46 64 L6 48 Z" fill="#E2703F" stroke="#152033" stroke-width="5" stroke-linejoin="round"/>
<path d="M86 22 L46 38 L46 64 L86 48 Z" fill="#B84E2C" stroke="#152033" stroke-width="5" stroke-linejoin="round"/></svg>`;

async function preparar(roteiro) {
  R = roteiro;
  await Promise.all(['900 104px Nunito', '800 40px Nunito', '700 30px Nunito'].map(f => document.fonts.load(f)));
  await document.fonts.ready;
  const C = R.luogo;
  let chao = -Infinity;
  for (let a = -6; a <= 6; a += 1) for (let b = -6; b <= 6; b += 1) chao = Math.max(chao, mappa.altura(C.x + a, C.z + b));
  cena = { chao: chao + 0.003 };
  cena.vulcano = vulcano(R.vulcano);
  cena.bosco = bosco(C, cena.chao);
  cena.casa = casa(C, cena.chao, 0.55 - 0.75);   // girada ~45° em relação à câmera: vista de 3/4
  montarChaves();

  $('#giorno').textContent = R.testa.titolo;
  $('#picto').innerHTML = PICTO;
  $('#contatore').innerHTML = `<span class="g">${R.testa.contatore}</span> ${esc(R.testa.unita)}`;
  $('#banner').textContent = `📍 ${R.banner}`;
  $('#commento .chi').innerHTML = `${esc(R.commento.utente)} <span>· ora</span>`;
  $('#etichetta .esempio').textContent = R.etichetta.esempio;
  $('#etichetta .pillola b').textContent = R.etichetta.conta;
  $('#etichetta .pillola small').textContent = R.etichetta.luogo;
  $('#etichetta .fond').textContent = `★ ${R.fondatore}`;

  // pontos: 3 perguntas em amarelo e cidades em branco aparecendo aos poucos
  const box = $('#punti');
  box.innerHTML = '';
  const P = geo.proj, pontos = [];
  const v3 = (x, z) => new THREE.Vector3(x, mappa.altura(x, z) + 0.05, z);
  R.domande.forEach(([nome, lat, lon], i) => {
    const el = document.createElement('div'); el.className = 'p giallo'; box.appendChild(el);
    const lab = document.createElement('div'); lab.className = 'dom forte'; lab.textContent = nome; box.appendChild(lab);
    pontos.push({ el, lab, v: v3((lon - P.LON0) * P.KX, (P.LAT0 - lat) * P.KZ), ini: R.eventi.punti + i * 0.18 });
  });
  const grandi = [...comuni].sort((a, b) => b[6] - a[6]).slice(3, 220);
  for (let i = 0; i < 70; i++) {
    const c = grandi[Math.floor(rnd() * grandi.length)];
    const el = document.createElement('div'); el.className = 'p'; box.appendChild(el);
    pontos.push({ el, v: v3(c[4], c[5]), ini: R.eventi.punti + 0.5 + rnd() * 1.6 });
  }
  cena.pontos = pontos;
  // capa do reel: título grande no lugar da legenda, cabeçalho mais baixo (o perfil recorta a capa em 3:4)
  if (R.copertina) {
    const cp = R.copertina;
    $('#testa').style.top = `${cp.testa_top ?? 120}px`;
    const el = document.createElement('div');
    el.id = 'copertina'; el.className = 'forte';
    el.style.cssText = `position:absolute;left:30px;right:30px;top:${cp.titolo_top}px;text-align:center;line-height:1.05;`;
    el.innerHTML = cp.linee.map(([txt, giallo, size]) => `<div style="font-size:${size}px;-webkit-text-stroke-width:${Math.round(size * 0.19)}px"${giallo ? ' class="g"' : ''}>${esc(txt)}</div>`).join('');
    document.body.appendChild(el);
  }
  quadro(0);
  return { durata: R.durata, fps: 30 };
}

carregar().catch(e => console.error('erro ao carregar', e));
