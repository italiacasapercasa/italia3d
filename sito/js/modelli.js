// Modelos low-poly (cores por vértice). Casas em "unidades de lote" (1 = um lote), frente virada para +z.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export const T = {
  muri: ['#F2C98A', '#F3E2C2', '#EDB49A'],    // ocra, crema, rosa antico
  tetto: '#D9653B', tettoScuro: '#B84E2C', verde: '#3E8E4E', porta: '#7A4B2A', vetro: '#7FB7D9',
  pietra: '#D9C9A9', bianco: '#F6F3EC', oro: '#F2C230', acqua: '#4FC3E8', foglia: '#4E9A43', ulivo: '#8FA36A',
  cipresso: '#2F6B3A', tronco: '#7A4E2D', grigio: '#9AA3AE', siepe: '#5FA84B', scuro: '#3A3F4A',
};

function pintar(g, cor) {
  if (g.index) g = g.toNonIndexed();
  for (const k of Object.keys(g.attributes)) if (k !== 'position') g.deleteAttribute(k);
  const c = new THREE.Color(cor), n = g.attributes.position.count, a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(a, 3));
  return g;
}
function deTriangulos(v) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(v), 3));
  return g;
}

export class Construtor {
  constructor() { this.partes = []; }
  add(g, cor, x, y, z, ry = 0) {
    if (ry) g.rotateY(ry);
    g.translate(x, y, z);
    this.partes.push(pintar(g, cor));
    return this;
  }
  caixa(w, h, d, x, y, z, cor, ry = 0) { const g = new THREE.BoxGeometry(w, h, d); g.translate(0, h / 2, 0); return this.add(g, cor, x, y, z, ry); }
  // telhado de duas águas, cumeeira ao longo de x
  telhado(w, d, h, x, y, z, cor, ry = 0) {
    const a = w / 2, b = d / 2;
    return this.add(deTriangulos([
      -a, 0, b, a, 0, b, a, h, 0, -a, 0, b, a, h, 0, -a, h, 0,
      a, 0, -b, -a, 0, -b, -a, h, 0, a, 0, -b, -a, h, 0, a, h, 0,
      -a, 0, -b, -a, 0, b, -a, h, 0,
      a, 0, b, a, 0, -b, a, h, 0,
      -a, 0, -b, a, 0, -b, a, 0, b, -a, 0, -b, a, 0, b, -a, 0, b,
    ]), cor, x, y, z, ry);
  }
  piramide(w, d, h, x, y, z, cor) {
    const a = w / 2, b = d / 2;
    return this.add(deTriangulos([
      -a, 0, b, a, 0, b, 0, h, 0, a, 0, b, a, 0, -b, 0, h, 0,
      a, 0, -b, -a, 0, -b, 0, h, 0, -a, 0, -b, -a, 0, b, 0, h, 0,
    ]), cor, x, y, z);
  }
  cilindro(r, h, x, y, z, cor, seg = 8, rTopo = r) { const g = new THREE.CylinderGeometry(rTopo, r, h, seg); g.translate(0, h / 2, 0); return this.add(g, cor, x, y, z); }
  cone(r, h, x, y, z, cor, seg = 6) { const g = new THREE.ConeGeometry(r, h, seg); g.translate(0, h / 2, 0); return this.add(g, cor, x, y, z); }
  esfera(r, x, y, z, cor) { return this.add(new THREE.IcosahedronGeometry(r, 0), cor, x, y, z); }
  cupola(r, x, y, z, cor) { return this.add(new THREE.SphereGeometry(r, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2), cor, x, y, z); }
  quad(w, d, x, y, z, cor) { const g = new THREE.PlaneGeometry(w, d); g.rotateX(-Math.PI / 2); return this.add(g, cor, x, y, z); }
  geometria() {
    const g = mergeGeometries(this.partes);
    g.computeVertexNormals();
    g.computeBoundingSphere();
    return g;
  }
}

// ---------- peças ----------
function persiana(b, x, y, z, lado = 'frente') {
  if (lado === 'frente') b.caixa(0.1, 0.13, 0.02, x, y, z, T.verde);
  else b.caixa(0.02, 0.13, 0.1, x, y, z, T.verde);
}
function casaBase(b, w, h, d, x, z, muro, { piani = 1, tetto = true, porta = true, cor = muro } = {}) {
  b.caixa(w, h, d, x, 0, z, cor);
  if (tetto) b.telhado(w + 0.08, d + 0.08, Math.min(w, d) * 0.42, x, h, z, T.tetto);
  if (porta) b.caixa(0.1, 0.19, 0.02, x, 0, z + d / 2 + 0.01, T.porta);
  const ph = h / piani;
  for (let p = 0; p < piani; p++) {
    const y = p * ph + ph * 0.42;
    for (const s of [-1, 1]) persiana(b, x + s * w * 0.3, y, z + d / 2 + 0.01);
    persiana(b, x + w / 2 + 0.01, y, z, 'lado');
  }
}
function cipresso(b, x, z, h = 0.5) { b.cilindro(0.025, 0.06, x, 0, z, T.tronco, 5); b.cone(0.075, h, x, 0.04, z, T.cipresso); }
function albero(b, x, z, r = 0.13, cor = T.foglia) { b.cilindro(0.025, 0.14, x, 0, z, T.tronco, 5); b.esfera(r, x, 0.14 + r * 0.7, z, cor); }
function piscina(b, w, d, x, z) { b.caixa(w, 0.03, d, x, 0, z, T.bianco); b.caixa(w - 0.07, 0.035, d - 0.07, x, 0, z, T.acqua); }

// ---------- os 15 níveis ----------
const NIVEIS = [
  (b, m) => casaBase(b, 0.42, 0.36, 0.42, 0, 0, m),
  (b, m) => casaBase(b, 0.56, 0.42, 0.5, 0, 0, m),
  (b, m) => {
    casaBase(b, 0.5, 0.42, 0.44, -0.05, -0.16, m);
    b.caixa(0.9, 0.08, 0.05, 0, 0, 0.42, T.siepe).caixa(0.05, 0.08, 0.42, -0.43, 0, 0.2, T.siepe).caixa(0.05, 0.08, 0.42, 0.43, 0, 0.2, T.siepe);
    albero(b, 0.28, 0.2);
  },
  (b, m) => casaBase(b, 0.56, 0.72, 0.5, 0, 0, m, { piani: 2 }),
  (b, m) => {
    casaBase(b, 0.5, 0.72, 0.5, -0.17, 0, m, { piani: 2 });
    b.caixa(0.3, 0.3, 0.46, 0.27, 0, 0.02, m).caixa(0.33, 0.03, 0.49, 0.27, 0.3, 0.02, T.tettoScuro).caixa(0.22, 0.22, 0.02, 0.27, 0, 0.26, T.grigio);
  },
  (b, m) => {
    casaBase(b, 0.74, 0.5, 0.5, 0.08, 0.06, m, { cor: T.pietra });
    b.caixa(0.24, 0.85, 0.24, -0.32, 0, -0.12, T.pietra).piramide(0.3, 0.3, 0.18, -0.32, 0.85, -0.12, T.tetto);
    persiana(b, -0.32, 0.6, 0.0);
    cipresso(b, -0.36, 0.3);
  },
  (b, m) => { casaBase(b, 0.56, 0.72, 0.42, 0, -0.2, m, { piani: 2 }); piscina(b, 0.62, 0.3, 0, 0.27); },
  (b, m) => {
    b.caixa(0.84, 0.8, 0.62, 0, 0, -0.04, m).piramide(0.94, 0.72, 0.22, 0, 0.8, -0.04, T.tetto).caixa(0.88, 0.03, 0.66, 0, 0.4, -0.04, T.bianco);
    b.caixa(0.12, 0.22, 0.02, 0, 0, 0.28, T.porta);
    for (const y of [0.2, 0.58]) for (const x of [-0.28, 0.28, ...(y > 0.4 ? [0] : [])]) persiana(b, x, y, 0.28);
    for (const y of [0.2, 0.58]) persiana(b, 0.43, y, -0.04, 'lado');
    albero(b, 0.38, 0.38, 0.09);
  },
  (b, m) => {
    casaBase(b, 0.62, 0.78, 0.5, -0.1, -0.12, m, { piani: 2 });
    casaBase(b, 0.32, 0.48, 0.44, 0.3, 0.12, m, { porta: false });
    cipresso(b, -0.42, 0.32); cipresso(b, 0.42, -0.36, 0.42);
  },
  (b, m) => {
    casaBase(b, 0.74, 1.02, 0.5, 0, -0.18, m, { piani: 3 });
    for (const x of [-0.27, -0.09, 0.09, 0.27]) b.cilindro(0.025, 0.32, x, 0, 0.12, T.bianco, 6);
    b.caixa(0.74, 0.04, 0.16, 0, 0.32, 0.12, T.bianco);
    piscina(b, 0.56, 0.18, 0, 0.36);
    cipresso(b, -0.44, -0.3); cipresso(b, 0.44, -0.3);
  },
  (b, m) => {
    casaBase(b, 0.38, 0.36, 0.36, 0.2, 0.22, m);
    b.caixa(0.3, 1.9, 0.3, -0.16, 0, -0.14, T.pietra);
    for (const [x, z] of [[-0.27, -0.25], [-0.05, -0.25], [-0.27, -0.03], [-0.05, -0.03]]) b.caixa(0.08, 0.09, 0.08, x, 1.9, z, T.pietra);
    for (const y of [0.55, 1.05, 1.5]) b.caixa(0.05, 0.13, 0.02, -0.16, y, 0.02, T.scuro);
  },
  (b) => {
    for (let k = 0; k < 11; k++) b.caixa(0.56, 0.18, 0.56, 0, k * 0.29, 0, T.vetro).caixa(0.58, 0.11, 0.58, 0, k * 0.29 + 0.18, 0, T.bianco);
    b.caixa(0.4, 0.12, 0.4, 0, 3.19, 0, T.grigio).cilindro(0.012, 0.42, 0, 3.31, 0, T.grigio, 4);
  },
  (b) => {
    b.caixa(0.9, 0.22, 0.05, 0, 0, 0.43, T.bianco).caixa(0.9, 0.22, 0.05, 0, 0, -0.43, T.bianco)
      .caixa(0.05, 0.22, 0.9, -0.43, 0, 0, T.bianco).caixa(0.05, 0.22, 0.9, 0.43, 0, 0, T.bianco)
      .caixa(0.17, 0.18, 0.07, 0, 0, 0.43, T.porta);
    b.caixa(0.55, 0.5, 0.42, -0.1, 0, -0.16, T.bianco).caixa(0.58, 0.03, 0.45, -0.1, 0.5, -0.16, '#E4DED2');
    b.caixa(0.2, 0.78, 0.2, 0.25, 0, -0.24, T.bianco).cupola(0.09, 0.25, 0.78, -0.24, T.bianco);
    for (const x of [-0.26, 0.06]) persiana(b, x, 0.25, 0.06);
    albero(b, 0.24, 0.2, 0.1, T.ulivo); albero(b, -0.26, 0.24, 0.1, T.ulivo);
  },
  (b, m) => {
    b.caixa(0.9, 0.9, 0.74, 0, 0, -0.06, m).caixa(0.96, 0.05, 0.8, 0, 0.9, -0.06, T.bianco);
    for (const y of [0.25, 0.6]) for (const x of [-0.33, -0.11, 0.11, 0.33]) persiana(b, x, y, 0.32);
    for (const x of [-0.24, -0.08, 0.08, 0.24]) b.cilindro(0.03, 0.42, x, 0, 0.38, T.bianco, 6);
    b.caixa(0.6, 0.05, 0.12, 0, 0.42, 0.38, T.bianco).telhado(0.6, 0.14, 0.1, 0, 0.47, 0.38, T.bianco);
    b.cilindro(0.2, 0.16, 0, 0.95, -0.06, m, 10).cupola(0.2, 0, 1.11, -0.06, T.tetto).cilindro(0.04, 0.12, 0, 1.3, -0.06, T.bianco, 6);
  },
  (b) => {
    for (let k = 0; k < 9; k++) b.caixa(0.5, 0.26, 0.5, 0, k * 0.38, 0, T.oro).caixa(0.52, 0.12, 0.52, 0, k * 0.38 + 0.26, 0, '#C99A1E');
    b.cilindro(0.26, 0.12, 0, 3.42, 0, T.oro, 10);
    for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2; b.cone(0.06, 0.24, Math.cos(a) * 0.2, 3.54, Math.sin(a) * 0.2, T.oro, 4); }
    b.esfera(0.08, 0, 3.66, 0, '#E0473C');
  },
];

// altura aproximada (lotes) de cada nível — usada para clique e posição de rótulos/chamas
export const ALTURA_NIVEL = [0.55, 0.62, 0.6, 0.95, 0.95, 1.05, 0.95, 1.02, 1.0, 1.25, 2.0, 3.75, 0.8, 1.4, 3.75];

export function geometriaCasa(nivel, variante) {
  const b = new Construtor();
  NIVEIS[nivel](b, T.muri[variante]);
  return b.geometria();
}

// ---------- prédios especiais (em lotes; uma quadra = 4 x 2 lotes) ----------
export function geometriaEspecial(tipo) {
  const b = new Construtor();
  if (tipo === 'piazza') {
    b.cilindro(0.38, 0.1, 0, 0, 0, T.bianco, 12).cilindro(0.32, 0.11, 0, 0, 0, T.acqua, 12)
      .cilindro(0.06, 0.38, 0, 0, 0, T.bianco, 6).esfera(0.09, 0, 0.42, 0, T.bianco);
    for (const [x, z] of [[-1.6, -0.7], [1.6, -0.7], [-1.6, 0.7]]) albero(b, x, z, 0.16);
    for (const [x, z] of [[-0.8, 0.6], [0.8, 0.6], [-0.8, -0.6], [0.8, -0.6]]) b.caixa(0.3, 0.06, 0.08, x, 0, z, T.tronco);
  } else if (tipo === 'bandiera') {
    b.cilindro(0.025, 1.0, 0, 0, 0, T.grigio, 5).caixa(0.46, 0.26, 0.025, 0.24, 0.72, 0, '#FFC93C');
  } else if (tipo === 'chiesa') {
    b.caixa(1.0, 0.78, 1.5, -0.45, 0, -0.1, T.bianco).telhado(1.58, 1.08, 0.36, -0.45, 0.78, -0.1, T.tetto, Math.PI / 2);
    b.caixa(1.1, 1.05, 0.1, -0.45, 0, 0.68, T.bianco).telhado(1.12, 0.12, 0.3, -0.45, 1.05, 0.68, T.bianco);
    b.caixa(0.24, 0.42, 0.02, -0.45, 0, 0.74, T.porta).cilindro(0.1, 0.02, -0.45, 0.7, 0.74, '#E0473C', 8);
    b.cilindro(0.26, 0.16, -0.45, 0.78, -0.45, T.bianco, 10).cupola(0.26, -0.45, 0.94, -0.45, T.tetto);
    b.caixa(0.34, 1.7, 0.34, 0.55, 0, 0.3, T.muri[0]).caixa(0.36, 0.05, 0.36, 0.55, 1.35, 0.3, T.bianco);
    b.caixa(0.12, 0.22, 0.02, 0.55, 1.42, 0.48, T.scuro).piramide(0.4, 0.4, 0.4, 0.55, 1.7, 0.3, T.tetto);
  } else if (tipo === 'palazzina') {
    for (const [x, cor] of [[-0.95, '#F5D78E'], [0.95, '#F0B9A6']]) {
      b.caixa(1.5, 1.45, 1.45, x, 0, 0, cor).caixa(1.56, 0.05, 1.51, x, 1.45, 0, T.bianco);
      for (let p = 0; p < 4; p++) for (const dx of [-0.5, -0.17, 0.17, 0.5]) b.caixa(0.16, 0.18, 0.02, x + dx, 0.16 + p * 0.33, 0.73, T.verde);
    }
  } else if (tipo === 'ospedale') {
    b.caixa(3.4, 1.15, 1.6, 0, 0, 0, T.bianco).caixa(3.42, 0.14, 1.62, 0, 0.45, 0, T.vetro).caixa(3.42, 0.14, 1.62, 0, 0.82, 0, T.vetro);
    b.caixa(0.7, 0.05, 0.2, 0, 1.15, 0, '#E0473C').caixa(0.2, 0.05, 0.7, 0, 1.15, 0, '#E0473C');
  } else if (tipo === 'stadio') {
    b.caixa(3.0, 0.03, 1.5, 0, 0, 0, '#4CAF50').caixa(2.6, 0.035, 0.03, 0, 0, 0, T.bianco);
    for (const [w, d, x, z] of [[3.6, 0.3, 0, 0.9], [3.6, 0.3, 0, -0.9], [0.3, 1.5, 1.65, 0], [0.3, 1.5, -1.65, 0]]) b.caixa(w, 0.45, d, x, 0, z, '#3B82C4').caixa(w, 0.08, d, x, 0.45, z, T.grigio);
  } else if (tipo === 'parco') {
    for (const [x, z] of [[-1.2, -0.3], [0, 0.35], [1.2, -0.2], [-0.5, 0.5]]) albero(b, x, z, 0.17);
  } else if (tipo === 'fiamma') {
    b.cone(0.13, 0.5, 0, 0, 0, '#FF8A00', 5).cone(0.08, 0.34, 0.07, 0, 0.04, '#FFD23F', 5).cone(0.07, 0.3, -0.07, 0, -0.03, '#FF5A1F', 5);
  }
  return b.geometria();
}
