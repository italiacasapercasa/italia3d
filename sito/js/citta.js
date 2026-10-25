// Cidades 3D: quadras em espiral ao redor da piazza, casas por nível e prédios especiais.
// Só as cidades perto da câmera entram nos InstancedMesh (atualizado quando a câmera anda).
import * as THREE from 'three';
import { geometriaCasa, geometriaEspecial, ALTURA_NIVEL, Construtor } from './modelli.js';
import { REGOLE } from './regole.js';

export const LOTE = 0.05, RUA = 0.035;                 // km
export const QW = 4 * LOTE + RUA, QH = 2 * LOTE + RUA; // quadra: 4 x 2 lotes + meia rua de cada lado
export const DIST_CIDADE = 32;                          // abaixo disso (km) a cidade aparece

// ordem das quadras: da piazza para fora
const ORDEM = (() => {
  const a = [];
  for (let j = -48; j <= 48; j++) for (let i = -30; i <= 30; i++) a.push([i, j, Math.hypot(i * QW, j * QH), Math.atan2(j, i)]);
  a.sort((p, q) => p[2] - q[2] || p[3] - q[3]);
  return a.map(p => [p[0], p[1]]);
})();
const M = REGOLE.marchi;
const RANK_OSPEDALE = 60, RANK_STADIO = 120;
const papel = r => {
  const [i, j] = ORDEM[r];
  if (r === 0) return 'piazza';
  if (i === 0 && j === -1) return 'chiesa';
  if (r === RANK_OSPEDALE) return 'ospedale';
  if (r === RANK_STADIO) return 'stadio';
  if (r >= 7 && (r - 7) % 9 === 0) return 'palazzina';
  return 'case';
};
const BLOCOS_CASAS = ORDEM.map((_, r) => r).filter(r => papel(r) === 'case');
const palazzinaN = r => (r - 7) / 9;

// posição local (em km, relativa à piazza) e rotação do lote n
export function posLote(n) {
  const [i, j] = ORDEM[BLOCOS_CASAS[Math.floor(n / 8)]], s = n % 8, linha = s < 4 ? 0 : 1, col = s % 4;
  return { x: i * QW + (col - 1.5) * LOTE, z: j * QH + (linha - 0.5) * LOTE, rot: linha === 0 ? Math.PI : 0 };
}

const variante = s => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return Math.abs(h) % 3; };

// ---------- geometrias do chão ----------
function geometriaCela(piazza) {
  const b = new Construtor();
  b.quad(QW, QH, 0, 0, 0, '#8C95A1');
  b.quad(QW - RUA, QH - RUA, 0, 0.0007, 0, piazza ? '#E9DDC1' : '#B6DC8F');
  if (piazza) b.quad(QW - RUA - 0.03, QH - RUA - 0.03, 0, 0.0009, 0, '#F1E8D3');
  for (const x of [-QW / 4, QW / 4]) b.quad(0.032, 0.0035, x, 0.0003, -QH / 2, '#FFFFFF');
  b.quad(0.0035, 0.032, -QW / 2, 0.0003, 0, '#FFFFFF');
  return b.geometria();
}
function geometriaBorda() {
  // parede vertical de largura 1 e altura 1 (para baixo), virada para +z; grama no topo, terra embaixo
  const g = new THREE.BufferGeometry();
  const p = [-0.5, 0, 0, -0.5, -1, 0, 0.5, -1, 0, -0.5, 0, 0, 0.5, -1, 0, 0.5, 0, 0];
  const topo = new THREE.Color('#7FB55C'), base = new THREE.Color('#9A7650');
  const c = [];
  for (let i = 0; i < 6; i++) { const t = p[i * 3 + 1] === 0 ? topo : base; c.push(t.r, t.g, t.b); }
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(p), 3));
  g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(c), 3));
  g.computeVertexNormals();
  return g;
}

// InstancedMesh que cresce sob demanda
class Camada {
  constructor(grupo, geo, mat, nome) { this.grupo = grupo; this.geo = geo; this.mat = mat; this.nome = nome; this.cap = 0; this.mesh = null; this.n = 0; this.buf = null; }
  iniciar() { this.n = 0; }
  push(arr) {
    if (!this.buf || this.n + arr.length / 16 > this.buf.length / 16) {
      const novo = new Float32Array(Math.max(64, (this.n + arr.length / 16) * 2) * 16);
      if (this.buf) novo.set(this.buf.subarray(0, this.n * 16));
      this.buf = novo;
    }
    this.buf.set(arr, this.n * 16);
    this.n += arr.length / 16;
  }
  finalizar() {
    if (this.n > this.cap) {
      if (this.mesh) { this.grupo.remove(this.mesh); this.mesh.dispose(); }
      this.cap = Math.ceil(this.n * 1.5);
      this.mesh = new THREE.InstancedMesh(this.geo, this.mat, this.cap);
      this.mesh.frustumCulled = false;
      this.mesh.name = this.nome;
      this.grupo.add(this.mesh);
    }
    if (!this.mesh) return;
    this.mesh.instanceMatrix.array.set(this.buf ? this.buf.subarray(0, this.n * 16) : []);
    this.mesh.count = this.n;
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _y = new THREE.Vector3(0, 1, 0);
function matriz(x, y, z, rot, sx, sy = sx, sz = sx) {
  _q.setFromAxisAngle(_y, rot); _p.set(x, y, z); _s.set(sx, sy, sz);
  return _m.compose(_p, _q, _s).elements;
}

export class Citta {
  constructor(mappa, D) {
    this.mappa = mappa;
    this.D = D;
    this.grupo = new THREE.Group();
    mappa.scene.add(this.grupo);
    this.cache = new Map();
    this.perto = [];
    this.ultimo = null;
    const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
    const add = (nome, geo, m = mat) => new Camada(this.grupo, geo, m, nome);
    this.camadas = {
      cela: add('cela', geometriaCela(false)),
      celaP: add('celaP', geometriaCela(true)),
      borda: add('borda', geometriaBorda()),
      fiamma: add('fiamma', geometriaEspecial('fiamma'), new THREE.MeshBasicMaterial({ vertexColors: true })),
    };
    for (const t of ['piazza', 'bandiera', 'chiesa', 'palazzina', 'ospedale', 'stadio', 'parco']) this.camadas[t] = add(t, geometriaEspecial(t));
    for (let n = 0; n < REGOLE.livelli.length; n++) for (let v = 0; v < 3; v++) this.camadas[`c${n}_${v}`] = add(`c${n}_${v}`, geometriaCasa(n, v));
    this.chamas = [];
    mappa.aoMover.push(() => this.atualizar());
    mappa.aoFrame.push(t => this.animar(t));
    // altura do alvo da câmera: chão da cidade quando perto
    mappa.alturaAlvo = (x, z, dist) => {
      const h = mappa.altura(x, z);
      if (dist > DIST_CIDADE) return h;
      const c = this.cidadeEm(x, z);
      return c ? Math.max(h, this.dadosCidade(c).hc) : h;
    };
  }

  cidadeEm(x, z) {
    let melhor = null, md = Infinity;
    for (const l of this.D.luoghi) {
      const d = Math.hypot(l.x - x, l.z - z);
      if (d < md && d < this.raioCidade(l) + 0.3) { md = d; melhor = l; }
    }
    return melhor;
  }
  raioCidade(l) {
    if (l._raio) return l._raio;
    const ultimo = BLOCOS_CASAS[Math.floor(Math.max(0, l.lotti - 1) / 8)];
    const [i, j] = ORDEM[ultimo];
    return (l._raio = Math.hypot(i * QW, j * QH) + QW);
  }

  // monta (uma vez) as matrizes de instância de uma cidade
  dadosCidade(l) {
    let c = this.cache.get(l.id);
    if (c) return c;
    const mp = this.mappa, ultimo = BLOCOS_CASAS[Math.floor(Math.max(0, l.lotti - 1) / 8)];
    const raio = this.raioCidade(l);
    let hmax = -Infinity, hmin = Infinity;
    for (let a = -1; a <= 1; a += 0.5) for (let b = -1; b <= 1; b += 0.5) {
      const h = mp.altura(l.x + a * raio, l.z + b * raio);
      hmax = Math.max(hmax, h); hmin = Math.min(hmin, h);
    }
    const hc = hmax + 0.004;
    c = { hc, raio, partes: {}, casas: [] };
    const push = (k, el) => { (c.partes[k] ??= []).push(...el); };
    const usados = new Set();
    for (let r = 0; r <= ultimo; r++) usados.add(ORDEM[r].join(','));
    const prof = hc - hmin + 0.03;
    for (let r = 0; r <= ultimo; r++) {
      const [i, j] = ORDEM[r], cx = l.x + i * QW, cz = l.z + j * QH, p = papel(r);
      push(p === 'piazza' ? 'celaP' : 'cela', matriz(cx, hc, cz, 0, 1));
      if (!usados.has(`${i},${j + 1}`)) push('borda', matriz(cx, hc, cz + QH / 2, 0, QW, prof, 1));
      if (!usados.has(`${i},${j - 1}`)) push('borda', matriz(cx, hc, cz - QH / 2, Math.PI, QW, prof, 1));
      if (!usados.has(`${i + 1},${j}`)) push('borda', matriz(cx + QW / 2, hc, cz, Math.PI / 2, QH, prof, 1));
      if (!usados.has(`${i - 1},${j}`)) push('borda', matriz(cx - QW / 2, hc, cz, -Math.PI / 2, QH, prof, 1));
      const esp = (t) => push(t, matriz(cx, hc + 0.001, cz, 0, LOTE));
      if (p === 'piazza') { esp('piazza'); push('bandiera', matriz(cx + 1.45 * LOTE, hc + 0.001, cz + 0.55 * LOTE, 0, LOTE)); }
      else if (p === 'chiesa') esp(l.case >= M.chiesa ? 'chiesa' : 'parco');
      else if (p === 'palazzina') esp(l.case >= (palazzinaN(r) + 1) * M.palazzinaOgni ? 'palazzina' : 'parco');
      else if (p === 'ospedale') esp(l.case >= M.ospedale ? 'ospedale' : 'parco');
      else if (p === 'stadio') esp(l.case >= M.stadio ? 'stadio' : 'parco');
    }
    for (const ci of l.casas) {
      const casa = this.D.casas[ci], q = posLote(casa.lote);
      const x = l.x + q.x, z = l.z + q.z;
      casa.x = x; casa.z = z; casa.y = hc;
      push(`c${casa.livello}_${variante(casa.conta)}`, matriz(x, hc + 0.0009, z, q.rot, LOTE));
      c.casas.push(ci);
    }
    for (const k of Object.keys(c.partes)) c.partes[k] = new Float32Array(c.partes[k]);
    this.cache.set(l.id, c);
    return c;
  }

  atualizar(forcar = false) {
    const mp = this.mappa, vis = mp.dist < DIST_CIDADE;
    this.grupo.visible = vis;
    if (!vis) { this.perto = []; this.chamas = []; mp.animando = 0; return; }
    const R = Math.max(2.5, mp.dist * 2.4);
    const u = this.ultimo;
    if (!forcar && u && Math.hypot(u.x - mp.alvo.x, u.z - mp.alvo.z) < R * 0.25 && mp.dist / u.d < 1.3 && u.d / mp.dist < 1.3) return;
    this.ultimo = { x: mp.alvo.x, z: mp.alvo.z, d: mp.dist };
    this.preencher(mp.alvo.x, mp.alvo.z, R);
    mp.animando = this.chamas.length ? 1 : 0;
    mp.sujo = true;
  }

  // coloca nos InstancedMesh as cidades a até R km de (cx, cz)
  preencher(cx, cz, R) {
    for (const c of Object.values(this.camadas)) c.iniciar();
    this.perto = [];
    this.chamas = [];
    const agora = Date.now() / 1000;
    for (const l of this.D.luoghi) {
      if (Math.hypot(l.x - cx, l.z - cz) - this.raioCidade(l) > R) continue;
      const c = this.dadosCidade(l);
      this.perto.push(l);
      for (const [k, arr] of Object.entries(c.partes)) if (arr.length) this.camadas[k].push(arr);
      for (const ci of c.casas) { const casa = this.D.casas[ci]; if (casa.fiamme > agora) this.chamas.push(casa); }
    }
    for (const c of Object.values(this.camadas)) c.finalizar();
  }

  animar(t) {
    if (!this.chamas.length) return;
    const cam = this.camadas.fiamma;
    cam.iniciar();
    for (const casa of this.chamas) {
      const s = 1 + Math.sin(t * 0.012 + casa.i) * 0.18;
      const topo = casa.y + ALTURA_NIVEL[casa.livello] * LOTE * 0.92;
      cam.push(matriz(casa.x, topo, casa.z, t * 0.002 + casa.i, LOTE * 0.9, LOTE * 0.9 * s, LOTE * 0.9));
    }
    cam.finalizar();
  }

  // clique: raio contra as caixas das casas próximas
  escolher(ray) {
    let melhor = null, md = Infinity;
    const caixa = new THREE.Box3(), ponto = new THREE.Vector3();
    for (const l of this.perto) {
      for (const ci of this.dadosCidade(l).casas) {
        const c = this.D.casas[ci], h = ALTURA_NIVEL[c.livello] * LOTE, m = LOTE * 0.46;
        caixa.min.set(c.x - m, c.y, c.z - m); caixa.max.set(c.x + m, c.y + h, c.z + m);
        if (ray.intersectBox(caixa, ponto)) { const d = ponto.distanceTo(ray.origin); if (d < md) { md = d; melhor = { tipo: 'casa', casa: c }; } }
      }
      // piazza / bandeira abrem a cidade
      const hc = this.dadosCidade(l).hc;
      caixa.min.set(l.x - QW / 2, hc, l.z - QH / 2); caixa.max.set(l.x + QW / 2, hc + LOTE * 1.1, l.z + QH / 2);
      if (ray.intersectBox(caixa, ponto)) { const d = ponto.distanceTo(ray.origin) + 0.01; if (d < md) { md = d; melhor = { tipo: 'luogo', luogo: l }; } }
    }
    return melhor;
  }

  posCasa(casa) {
    const l = this.D.luoghi[casa.luogo];
    this.dadosCidade(l);
    return { x: casa.x, y: casa.y, z: casa.z };
  }
}
