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

// ---------- estilos regionais das casas ----------
// C = tema em uso enquanto uma casa é montada (geometriaCasa troca e depois volta ao padrão)
const TEMI = {
  base: { ...T, persiana: T.verde },
  ligure: { ...T, muri: ['#F4A79D', '#F7C66E', '#F08A5D'], persiana: '#3E8E4E', tetto: '#C9643E' },                 // casas pastel da Liguria
  toscano: { ...T, muri: ['#D9C9A9', '#CDB894', '#E2D4B8'], persiana: '#3E6E4E', tetto: '#C25A35', pietra: '#C9B48F' }, // pedra e terracota
  mediterraneo: { ...T, muri: ['#F7F4EC', '#F1E9DA', '#EDE2CC'], persiana: '#2F7DD1', pietra: '#EFE6D2', piatto: true }, // brancas, teto plano
  alpino: { ...T, muri: ['#8B5A3C', '#7A4E2D', '#9C6B45'], persiana: '#B23A30', tetto: '#6B5A4E', tettoScuro: '#5A4A40', ripido: true, legno: true },
};
TEMI.trullo = { ...TEMI.mediterraneo };
let C = TEMI.base;
// região (código ISTAT) -> estilo
export const stileRegione = cod => (cod === '16' ? 'trullo' : ['17', '18', '19', '20'].includes(cod) ? 'mediterraneo' : cod === '07' ? 'ligure'
  : ['09', '10'].includes(cod) ? 'toscano' : ['02', '04'].includes(cod) ? 'alpino' : 'base');

// ---------- peças ----------
// FINESTRE != null: em vez de montar a casa, só coleta as janelas (acesas à noite), na mesma posição das persianas
let FINESTRE = null;
const LUCI = ['#FFD36B', '#FFC24A', '#FFE29A'];
function persiana(b, x, y, z, lado = 'frente') {
  if (FINESTRE) {
    const g = lado === 'frente' ? new THREE.BoxGeometry(0.085, 0.11, 0.024) : new THREE.BoxGeometry(0.024, 0.11, 0.085);
    g.translate(x, y + 0.065, z);
    FINESTRE.push(pintar(g, LUCI[FINESTRE.length % 3]));
    return;
  }
  if (lado === 'frente') b.caixa(0.1, 0.13, 0.02, x, y, z, C.persiana);
  else b.caixa(0.02, 0.13, 0.1, x, y, z, C.persiana);
}
function casaBase(b, w, h, d, x, z, muro, { piani = 1, tetto = true, porta = true, cor = muro } = {}) {
  if (C.legno && cor === muro) {
    // chalé alpino: térreo de alvenaria branca, andar de cima em madeira, sacada com flores
    b.caixa(w, h * 0.45, d, x, 0, z, '#F2EDE4').caixa(w, h * 0.55, d, x, h * 0.45, z, cor);
    b.caixa(w * 0.9, 0.03, 0.07, x, h * 0.5, z + d / 2 + 0.035, '#5A3A22');
    for (let k = -2; k <= 2; k++) b.esfera(0.025, x + k * w * 0.16, h * 0.5 + 0.04, z + d / 2 + 0.05, '#E0473C');
  } else b.caixa(w, h, d, x, 0, z, cor);
  if (tetto && C.piatto) b.caixa(w + 0.03, 0.05, d + 0.03, x, h, z, T.bianco).caixa(w - 0.06, 0.02, d - 0.06, x, h + 0.05, z, '#D9CFBF');
  else if (tetto) b.telhado(w + (C.ripido ? 0.12 : 0.08), d + (C.ripido ? 0.12 : 0.08), Math.min(w, d) * (C.ripido ? 0.58 : 0.42), x, h, z, C.tetto);
  if (porta) b.caixa(0.1, 0.19, 0.02, x, 0, z + d / 2 + 0.01, C.porta);
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
    b.caixa(0.3, 0.3, 0.46, 0.27, 0, 0.02, m).caixa(0.33, 0.03, 0.49, 0.27, 0.3, 0.02, C.tettoScuro).caixa(0.22, 0.22, 0.02, 0.27, 0, 0.26, T.grigio);
  },
  (b, m) => {
    casaBase(b, 0.74, 0.5, 0.5, 0.08, 0.06, m, { cor: C.pietra });
    b.caixa(0.24, 0.85, 0.24, -0.32, 0, -0.12, C.pietra).piramide(0.3, 0.3, 0.18, -0.32, 0.85, -0.12, C.tetto);
    persiana(b, -0.32, 0.6, 0.0);
    cipresso(b, -0.36, 0.3);
  },
  (b, m) => { casaBase(b, 0.56, 0.72, 0.42, 0, -0.2, m, { piani: 2 }); piscina(b, 0.62, 0.3, 0, 0.27); },
  (b, m) => {
    b.caixa(0.84, 0.8, 0.62, 0, 0, -0.04, m).piramide(0.94, 0.72, 0.22, 0, 0.8, -0.04, C.tetto).caixa(0.88, 0.03, 0.66, 0, 0.4, -0.04, T.bianco);
    b.caixa(0.12, 0.22, 0.02, 0, 0, 0.28, C.porta);
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
    b.caixa(0.3, 1.9, 0.3, -0.16, 0, -0.14, C.pietra);
    for (const [x, z] of [[-0.27, -0.25], [-0.05, -0.25], [-0.27, -0.03], [-0.05, -0.03]]) b.caixa(0.08, 0.09, 0.08, x, 1.9, z, C.pietra);
    for (const y of [0.55, 1.05, 1.5]) b.caixa(0.05, 0.13, 0.02, -0.16, y, 0.02, T.scuro);
  },
  (b) => {
    for (let k = 0; k < 11; k++) b.caixa(0.56, 0.18, 0.56, 0, k * 0.29, 0, T.vetro).caixa(0.58, 0.11, 0.58, 0, k * 0.29 + 0.18, 0, T.bianco);
    b.caixa(0.4, 0.12, 0.4, 0, 3.19, 0, T.grigio).cilindro(0.012, 0.42, 0, 3.31, 0, T.grigio, 4);
  },
  (b) => {
    b.caixa(0.9, 0.22, 0.05, 0, 0, 0.43, T.bianco).caixa(0.9, 0.22, 0.05, 0, 0, -0.43, T.bianco)
      .caixa(0.05, 0.22, 0.9, -0.43, 0, 0, T.bianco).caixa(0.05, 0.22, 0.9, 0.43, 0, 0, T.bianco)
      .caixa(0.17, 0.18, 0.07, 0, 0, 0.43, C.porta);
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
    b.cilindro(0.2, 0.16, 0, 0.95, -0.06, m, 10).cupola(0.2, 0, 1.11, -0.06, C.tetto).cilindro(0.04, 0.12, 0, 1.3, -0.06, T.bianco, 6);
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

// janelas acesas de uma casa (mesmo nível e estilo), para a camada da noite; null se a casa não tem janelas
export function geometriaFinestre(nivel, stile = 'base') {
  if (stile === 'trullo' && nivel < 3) return null;
  FINESTRE = [];
  C = TEMI[stile] ?? TEMI.base;
  try { NIVEIS[nivel](new Construtor(), C.muri[0]); } finally { C = TEMI.base; }
  const partes = FINESTRE; FINESTRE = null;
  if (!partes.length) return null;
  const g = mergeGeometries(partes); g.computeBoundingSphere();
  return g;
}

// poste de luz (de dia: só o poste; a lâmpada acesa é uma camada à parte, visível à noite)
export function geometriaLampione() {
  const b = new Construtor();
  b.cilindro(0.018, 0.62, 0, 0, 0, T.scuro, 6).caixa(0.12, 0.018, 0.018, 0.05, 0.6, 0, T.scuro).caixa(0.06, 0.03, 0.05, 0.1, 0.57, 0, T.scuro);
  return b.geometria();
}
export function geometriaLuceLampione() {
  const b = new Construtor();
  b.caixa(0.05, 0.012, 0.04, 0.1, 0.56, 0, '#FFF1C2');
  // poça de luz no chão: degradê do centro (quente) para a borda (preto = some, a mistura é aditiva)
  const alone = new THREE.CircleGeometry(0.17, 20).toNonIndexed();
  alone.rotateX(-Math.PI / 2); alone.translate(0.1, 0.004, 0);
  const p = alone.attributes.position, cor = new Float32Array(p.count * 3), quente = new THREE.Color('#8A6526');
  for (let i = 0; i < p.count; i++) { const k = Math.max(0, 1 - Math.hypot(p.getX(i) - 0.1, p.getZ(i)) / 0.17); quente.clone().multiplyScalar(k).toArray(cor, i * 3); }
  alone.deleteAttribute('normal'); alone.deleteAttribute('uv');
  alone.setAttribute('color', new THREE.BufferAttribute(cor, 3));
  b.partes.push(alone);
  return b.geometria();
}

// ---------- Halloween ----------
// abóbora (em lotes, base no chão, cara virada para +z); x/z/s posicionam dentro do lote da casa
function zuccaEm(b, x, z, s) {
  for (let k = 0; k < 6; k++) {
    const a = k / 6 * Math.PI * 2, g = new THREE.SphereGeometry(0.045 * s, 8, 6);
    g.scale(0.75, 1, 0.75); b.add(g, k % 2 ? '#E8751A' : '#F28C28', x + Math.cos(a) * 0.022 * s, 0.045 * s, z + Math.sin(a) * 0.022 * s);
  }
  b.cilindro(0.008 * s, 0.025 * s, x, 0.085 * s, z, '#4E7A2A', 5);
}
// cara da abóbora: olhos e boca (escuros de dia, acesos à noite)
function facciaZucca(b, x, z, s, cor) {
  const zz = z + 0.06 * s;
  for (const dx of [-0.022, 0.022]) b.caixa(0.016 * s, 0.016 * s, 0.006 * s, x + dx * s, 0.05 * s, zz, cor);
  b.caixa(0.05 * s, 0.012 * s, 0.006 * s, x, 0.025 * s, zz, cor);
}
// posições: uma ao lado da porta da casa; na piazza, uma gigante
const ZUCCA_CASA = [0.3, 0.4, 1.8], ZUCCA_PIAZZA = [-0.9, 0.25, 6];
export function geometriaZucca(dove = 'casa') {
  const [x, z, s] = dove === 'casa' ? ZUCCA_CASA : ZUCCA_PIAZZA, b = new Construtor();
  zuccaEm(b, x, z, s); facciaZucca(b, x, z, s, '#3A2410');
  if (dove === 'piazza') for (const [dx, dz, k] of [[0.35, 0.05, 0.7], [-0.32, 0.1, 0.55]]) { zuccaEm(b, x + dx, z + dz, k * s * 0.6); facciaZucca(b, x + dx, z + dz, k * s * 0.6, '#3A2410'); }
  return b.geometria();
}
export function geometriaZuccaLuce(dove = 'casa') {
  const [x, z, s] = dove === 'casa' ? ZUCCA_CASA : ZUCCA_PIAZZA, b = new Construtor();
  facciaZucca(b, x, z + 0.002, s, '#FFB437');
  if (dove === 'piazza') for (const [dx, dz, k] of [[0.35, 0.05, 0.7], [-0.32, 0.1, 0.55]]) facciaZucca(b, x + dx, z + dz + 0.002, k * s * 0.6, '#FFB437');
  return b.geometria();
}

// trulli de Alberobello (Puglia) para os três primeiros níveis
function trullo(b, r, x, z, cor = '#F7F4EC') {
  b.cilindro(r, r * 1.3, x, 0, z, cor, 12).cone(r * 1.15, r * 1.6, x, r * 1.3, z, '#8E8A80', 12).esfera(r * 0.18, x, r * 2.95, z, cor);
}
const TRULLI = [
  b => { trullo(b, 0.2, 0, 0); b.caixa(0.09, 0.16, 0.02, 0, 0, 0.2, C.porta); },
  b => { trullo(b, 0.24, -0.05, 0); trullo(b, 0.15, 0.28, -0.08); b.caixa(0.1, 0.19, 0.02, -0.05, 0, 0.24, C.porta); },
  b => {
    trullo(b, 0.22, -0.12, -0.14); trullo(b, 0.15, 0.22, -0.18); b.caixa(0.1, 0.18, 0.02, -0.12, 0, 0.08, C.porta);
    b.caixa(0.9, 0.08, 0.05, 0, 0, 0.42, '#E8E0CE').caixa(0.05, 0.08, 0.42, -0.43, 0, 0.2, '#E8E0CE').caixa(0.05, 0.08, 0.42, 0.43, 0, 0.2, '#E8E0CE');
    albero(b, 0.28, 0.2, 0.12, T.ulivo);
  },
];

export function geometriaCasa(nivel, variante, stile = 'base') {
  const b = new Construtor();
  C = TEMI[stile] ?? TEMI.base;
  try {
    if (stile === 'trullo' && nivel < TRULLI.length) TRULLI[nivel](b);
    else NIVEIS[nivel](b, C.muri[variante]);
  } finally { C = TEMI.base; }
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
  } else if (tipo === 'fontana') {
    // traguardo 50 case: a piazza ganha uma fontana monumentale (três bacias, estátua dourada, jatos d'água)
    b.cilindro(0.62, 0.12, 0, 0, 0, T.pietra, 16).cilindro(0.56, 0.13, 0, 0, 0, T.acqua, 16);
    b.cilindro(0.3, 0.32, 0, 0, 0, T.bianco, 12).cilindro(0.26, 0.33, 0, 0, 0, T.acqua, 12);
    b.cilindro(0.08, 0.32, 0, 0.3, 0, T.bianco, 8).cilindro(0.16, 0.05, 0, 0.6, 0, T.bianco, 10);
    b.cilindro(0.05, 0.18, 0, 0.65, 0, T.oro, 6).esfera(0.07, 0, 0.9, 0, T.oro);
    for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2; b.cilindro(0.016, 0.24, Math.cos(a) * 0.43, 0.12, Math.sin(a) * 0.43, '#BFEFFF', 5); }
    for (const [x, z] of [[-1.6, -0.7], [1.6, -0.7], [-1.6, 0.7]]) albero(b, x, z, 0.16);
    for (const [x, z] of [[-0.95, 0.65], [0.95, 0.65], [-0.95, -0.65], [0.95, -0.65]]) b.caixa(0.3, 0.06, 0.08, x, 0, z, T.tronco);
  } else if (tipo === 'scuola') {
    // traguardo 150: scuola gialla a due piani, ingresso con timpano e orologio, cortile, tricolore
    b.quad(3.7, 1.8, 0, 0.003, 0, '#D9C9A9');
    b.caixa(2.8, 0.95, 0.95, 0, 0, -0.3, '#F2C14E').caixa(2.86, 0.06, 1.01, 0, 0.95, -0.3, T.bianco).telhado(2.9, 1.05, 0.28, 0, 1.01, -0.3, T.tetto);
    b.caixa(0.7, 1.25, 0.1, 0, 0, 0.22, T.bianco).telhado(0.74, 0.12, 0.25, 0, 1.25, 0.22, T.bianco);
    b.caixa(0.22, 0.22, 0.02, 0, 0.92, 0.28, T.scuro).caixa(0.18, 0.18, 0.02, 0, 0.94, 0.29, T.bianco);
    b.caixa(0.28, 0.4, 0.02, 0, 0, 0.28, T.porta);
    for (let p = 0; p < 2; p++) for (const dx of [-1.15, -0.8, -0.48, 0.48, 0.8, 1.15]) b.caixa(0.17, 0.22, 0.02, dx, 0.14 + p * 0.42, 0.18, T.vetro);
    b.cilindro(0.02, 1.3, 1.55, 0, 0.55, T.grigio, 5);
    for (const [dx, cor] of [[0.07, '#2E9B55'], [0.19, T.bianco], [0.31, '#E0473C']]) b.caixa(0.12, 0.24, 0.02, 1.55 + dx, 1.02, 0.55, cor);
    albero(b, -1.55, 0.6, 0.15); albero(b, -1.1, 0.7, 0.13);
  } else if (tipo === 'stazione') {
    // traguardo 250: stazione con torre dell'orologio, pensilina sulla banchina, due binari e un treno rosso
    b.caixa(3.0, 0.75, 0.75, 0, 0, -0.58, '#E9C9A0').telhado(3.1, 0.85, 0.22, 0, 0.75, -0.58, T.tetto);
    b.caixa(0.5, 1.45, 0.5, 0, 0, -0.58, '#E3BD8F').piramide(0.6, 0.6, 0.32, 0, 1.45, -0.58, T.tettoScuro);
    b.caixa(0.28, 0.28, 0.02, 0, 1.1, -0.32, T.scuro).caixa(0.24, 0.24, 0.02, 0, 1.12, -0.31, T.bianco);
    for (const dx of [-1.2, -0.8, -0.4, 0.4, 0.8, 1.2]) b.caixa(0.18, 0.34, 0.02, dx, 0.1, -0.2, T.verde);
    b.caixa(3.3, 0.06, 0.38, 0, 0, 0.0, T.pietra);
    for (const x of [-1.3, -0.45, 0.45, 1.3]) b.caixa(0.04, 0.5, 0.04, x, 0.06, 0.05, T.scuro);
    b.caixa(3.0, 0.04, 0.42, 0, 0.56, 0.02, '#B84E2C');
    for (let k = -8; k <= 8; k++) for (const z of [0.5, 0.8]) b.caixa(0.05, 0.012, 0.22, k * 0.21, 0, z, '#7A5A3A');
    for (const z of [0.43, 0.57, 0.73, 0.87]) b.caixa(3.6, 0.025, 0.022, 0, 0.012, z, T.grigio);
    b.caixa(1.5, 0.26, 0.2, -0.45, 0.04, 0.5, '#C8102E').caixa(1.52, 0.07, 0.21, -0.45, 0.17, 0.5, T.scuro).caixa(1.5, 0.03, 0.2, -0.45, 0.3, 0.5, T.bianco);
    b.caixa(0.22, 0.2, 0.18, 0.4, 0.04, 0.5, '#C8102E').caixa(0.06, 0.07, 0.19, 0.5, 0.15, 0.5, T.scuro);
  } else if (tipo === 'campo') {
    // traguardo 400: campo da calcio a strisce, linee, due porte e una tribunetta
    for (let k = 0; k < 7; k++) b.caixa(0.5, 0.02, 1.7, -1.5 + k * 0.5, 0, 0.05, k % 2 ? '#43A047' : '#4CAF50');
    for (const z of [-0.7, 0.8]) b.caixa(3.1, 0.026, 0.025, 0, 0, z, T.bianco);
    for (const x of [-1.55, 0, 1.55]) b.caixa(0.025, 0.026, 1.5, x, 0, 0.05, T.bianco);
    for (const s of [-1, 1]) {
      b.caixa(0.025, 0.026, 0.7, s * 1.2, 0, 0.05, T.bianco).caixa(0.35, 0.026, 0.025, s * 1.375, 0, 0.4, T.bianco).caixa(0.35, 0.026, 0.025, s * 1.375, 0, -0.3, T.bianco);
      b.caixa(0.03, 0.22, 0.03, s * 1.57, 0, 0.27, T.bianco).caixa(0.03, 0.22, 0.03, s * 1.57, 0, -0.17, T.bianco).caixa(0.03, 0.03, 0.47, s * 1.57, 0.22, 0.05, T.bianco);
    }
    const g = new THREE.RingGeometry(0.2, 0.225, 20); g.rotateX(-Math.PI / 2); b.add(g, T.bianco, 0, 0.027, 0.05);
    b.caixa(2.4, 0.16, 0.16, 0, 0, -0.9, '#3B82C4').caixa(2.4, 0.12, 0.1, 0, 0.16, -0.95, '#2F6FB0').caixa(2.5, 0.03, 0.22, 0, 0.36, -0.92, T.grigio);
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
  } else if (tipo === 'liberoV' || tipo === 'liberoL') {
    // lote livre: estacas nos cantos + placa (a face com texto é um plano à parte, ver PLACCA)
    for (const [x, z] of [[-0.4, -0.4], [0.4, -0.4], [-0.4, 0.4], [0.4, 0.4]]) b.caixa(0.03, 0.07, 0.03, x, 0, z, T.bianco);
    if (tipo === 'liberoL') {
      b.quad(0.78, 0.78, 0, 0.002, 0, '#B98D5F');
      b.piramide(0.36, 0.3, 0.13, -0.16, 0, -0.14, '#9C7148');
      for (const [w, d, x, z] of [[0.6, 0.05, 0, -0.3], [0.05, 0.5, -0.3, -0.05], [0.05, 0.5, 0.3, -0.05]]) b.caixa(w, 0.06, d, x, 0, z, T.grigio);
      for (let k = 0; k < 4; k++) b.caixa(0.11, 0.07, 0.03, -0.27 + k * 0.11, 0.06, 0.4, k % 2 ? T.bianco : '#E0473C');
      for (const x of [-0.33, 0.06]) b.caixa(0.025, 0.13, 0.025, x, 0, 0.4, T.scuro);
      b.cone(0.04, 0.1, 0.3, 0, 0.2, '#FF7A1A', 6);
    }
    const p = PLACCA;
    b.cilindro(0.016, p.y + p.h, p.x, 0, p.z - 0.012, T.tronco, 5);
    b.caixa(p.w + 0.02, p.h + 0.02, 0.018, p.x, p.y - 0.01, p.z, T.bianco);
  } else if (tipo === 'cartellone') {
    // outdoor: dois postes e moldura; a face com texto é um plano à parte (CARTELLONE)
    const c = CARTELLONE;
    for (const x of [-c.w * 0.33, c.w * 0.33]) b.caixa(0.04, c.y + c.h * 0.5, 0.04, x, 0, c.z - 0.03, T.scuro);
    b.caixa(c.w + 0.05, c.h + 0.05, 0.03, 0, c.y - 0.025, c.z, T.scuro);
    b.caixa(c.w * 0.7, 0.02, 0.08, 0, c.y - 0.03, c.z + 0.03, T.grigio);
  } else if (tipo === 'alberoNatale') {
    b.cilindro(0.05, 0.14, 0, 0, 0, T.tronco, 6);
    for (const [r, h, y] of [[0.36, 0.42, 0.1], [0.28, 0.38, 0.38], [0.19, 0.34, 0.64]]) b.cone(r, h, 0, y, 0, '#2E7D45', 8);
    const pallina = ['#E0473C', '#F2C230', '#4FA3E8', '#F6F3EC'];
    for (let k = 0; k < 16; k++) {
      const a = k * 2.4, y = 0.16 + (k % 8) * 0.085, r = 0.33 - y * 0.32;
      b.esfera(0.028, Math.cos(a) * r, y, Math.sin(a) * r, pallina[k % 4]);
    }
    b.cilindro(0.17, 0.05, 0, 0, 0, '#B23A30', 10);
  } else if (tipo === 'pino') {          // pino domestico (a "umbrella" mediterrânea)
    b.cilindro(0.035, 0.55, 0, 0, 0, T.tronco, 5);
    const g = new THREE.IcosahedronGeometry(0.26, 0); g.scale(1.25, 0.45, 1.25); b.add(g, '#3F7A3A', 0, 0.62, 0);
  } else if (tipo === 'cipresso') {
    b.cilindro(0.025, 0.06, 0, 0, 0, T.tronco, 5).cone(0.085, 0.62, 0, 0.04, 0, T.cipresso, 6);
  } else if (tipo === 'ulivo') {
    b.cilindro(0.03, 0.18, 0, 0, 0, '#6E5B45', 5);
    const g = new THREE.IcosahedronGeometry(0.17, 0); g.scale(1.2, 0.8, 1.2); b.add(g, T.ulivo, 0, 0.3, 0);
  } else if (tipo === 'abete') {          // abete alpino
    b.cilindro(0.03, 0.1, 0, 0, 0, T.tronco, 5).cone(0.2, 0.36, 0, 0.08, 0, '#2C5E3A', 7).cone(0.15, 0.3, 0, 0.3, 0, '#2C5E3A', 7).cone(0.09, 0.22, 0, 0.5, 0, '#2C5E3A', 7);
  } else if (tipo === 'quercia') {        // latifoglia
    b.cilindro(0.03, 0.2, 0, 0, 0, T.tronco, 5).esfera(0.2, 0, 0.36, 0, '#4E9A43');
  } else if (tipo === 'palma') {
    b.cilindro(0.025, 0.6, 0, 0, 0, '#8A6A45', 5, 0.018);
    for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2, g = new THREE.BoxGeometry(0.3, 0.012, 0.06); g.translate(0.15, 0, 0); g.rotateZ(-0.35); g.rotateY(a); b.add(g, '#3E8E4E', 0, 0.6, 0); }
  } else if (tipo === 'anello') {         // anel de destaque da casa selecionada
    const g = new THREE.RingGeometry(0.5, 0.62, 32); g.rotateX(-Math.PI / 2); b.add(g, '#E0473C', 0, 0.01, 0);
  } else if (tipo === 'stellaNatale') {
    b.esfera(0.075, 0, 1.02, 0, T.oro);
  }
  return b.geometria();
}

// placas de texto (em lotes): posição do centro da face, largura e altura
export const PLACCA = { x: 0.2, y: 0.24, z: 0.3, w: 0.44, h: 0.25 };
export const CARTELLONE = { y: 0.42, z: 0, w: 1.0, h: 0.48 };
// plano com UV para a face da placa, virado para +z, um pouco à frente da moldura
export function geometriaFaccia(p, dz = 0.011) {
  const g = new THREE.PlaneGeometry(p.w, p.h);
  g.translate(p.x ?? 0, p.y + p.h / 2, p.z + dz);
  return g;
}

// luminária de Natal sobre a rua: dois postes e um fio de lâmpadas (vão ao longo de x)
export function geometriaLuminaria(vao) {
  const postes = new Construtor(), luci = new Construtor(), a = vao / 2, cores = ['#FFE7A0', '#FFD23F', '#FF6B5A', '#FFF6DA'];
  for (const x of [-a, a]) postes.cilindro(0.014, 0.62, x, 0, 0, T.scuro, 5);
  const n = 13;
  for (let k = 0; k <= n; k++) {
    const t = k / n, x = -a + t * vao, y = 0.6 - Math.sin(t * Math.PI) * 0.12;
    luci.esfera(0.022, x, y, 0, cores[k % cores.length]);
  }
  // arco de estrelas no meio
  luci.esfera(0.05, 0, 0.66, 0, T.oro);
  return { postes: postes.geometria(), luci: luci.geometria() };
}

// ---------- loja de um comércio ("su misura": todas as opções do editor) ----------
// Em lotes, frente para +z. Devolve a geometria e as faces de texto (letreiros), que são planos à parte com textura.
export const STILE_BASE = {
  tenda: 'righe', coloreTenda: null, coloreRighe: '#FFFFFF', facciata: T.muri[1], porta: T.porta, bordo: T.bianco,
  piani: 1, vetrina: 'normale', serranda: false, insegna: 'facciata', tetto: false, oggetto: 'nessuno', scala: 1, ornamenti: ['vasi'],
};
export const OPZIONI_STILE = {
  tenda: [['righe', 'A righe'], ['liscia', 'Liscia'], ['nessuna', 'Senza tenda']],
  coloreTenda: ['#E0473C', '#F28C28', '#FFC93C', '#3E8E4E', '#1F9E89', '#2F7DD1', '#6C4FD3', '#D94F8A', '#152033', '#FFFFFF'],
  coloreRighe: ['#FFFFFF', '#152033', '#FFC93C', '#E0473C', '#3E8E4E', '#2F7DD1'],
  facciata: ['#F3E2C2', '#F2C98A', '#EDB49A', '#F7D7DC', '#DDE8F2', '#E3EFD9', '#FFE08A', '#FFFFFF', '#9AA3AE', '#3A3F4A'],
  porta: ['#7A4B2A', '#E0473C', '#2F7DD1', '#3E8E4E', '#152033', '#FFFFFF'],
  bordo: ['#F6F3EC', '#9AA3AE', '#B0623A', '#FFC93C', '#152033', '#2F7DD1'],
  piani: [[1, '1 piano'], [2, '2 piani']],
  vetrina: [['normale', 'Normale'], ['larga', 'Larga'], ['finestre', 'Finestre']],
  serranda: [[false, 'No'], [true, 'Sì']],
  insegna: [['facciata', 'Sulla facciata'], ['cassonetto', 'Cassonetto'], ['neon', 'Neon'], ['bandiera', 'A bandiera']],
  tetto: [[false, 'No'], [true, 'Sì']],
  oggetto: [['pizza', '🍕 Pizza'], ['gelato', '🍦 Gelato'], ['caffe', '☕ Caffè'], ['cornetto', '🥐 Cornetto'], ['pane', '🥖 Pane'], ['torta', '🎂 Torta'],
    ['ciambella', '🍩 Ciambella'], ['maglietta', '👕 Maglietta'], ['scarpa', '👟 Scarpa'], ['barbiere', '💈 Barbiere'], ['fiore', '🌸 Fiore'],
    ['manubrio', '🏋️ Manubrio'], ['smartphone', '📱 Smartphone'], ['chiave', '🔧 Chiave inglese'], ['libro', '📚 Libro'], ['zampa', '🐾 Zampa'], ['nessuno', 'Nessuno']],
  ornamenti: [['vasi', '🪴 Vasi'], ['dehors', '⛱️ Tavolini'], ['luci', '💡 Luci'], ['bandierine', '🇮🇹 Bandierine']],
};
const scuro = (c, k = 0.72) => '#' + new THREE.Color(c).multiplyScalar(k).getHexString();

function oggettoGigante(b, tipo, y0, s) {
  const S = v => v * s;
  if (tipo === 'pizza') {
    // fatia de pé, ponta para baixo, de frente para a rua
    const forma = new THREE.Shape([new THREE.Vector2(-S(0.26), S(0.58)), new THREE.Vector2(S(0.26), S(0.58)), new THREE.Vector2(0, S(0.04))]);
    const g = new THREE.ExtrudeGeometry(forma, { depth: S(0.05), bevelEnabled: false });
    g.translate(0, 0, -S(0.025));
    b.add(g, '#F5C04A', 0, y0, 0);
    b.caixa(S(0.58), S(0.07), S(0.07), 0, y0 + S(0.56), 0, '#C98A3A');
    for (const [x, y] of [[-0.08, 0.44], [0.08, 0.42], [0, 0.28], [0.03, 0.15]]) { const p = new THREE.CylinderGeometry(S(0.04), S(0.04), S(0.012), 10); p.rotateX(Math.PI / 2); b.add(p, '#C8402E', S(x), y0 + S(y), S(0.03)); }
  } else if (tipo === 'gelato') {
    const g = new THREE.ConeGeometry(S(0.11), S(0.36), 8); g.rotateX(Math.PI); g.translate(0, y0 + S(0.18), 0); b.add(g, '#D9A35A', 0, 0, 0);
    b.esfera(S(0.12), 0, y0 + S(0.42), 0, '#F7B6C8').esfera(S(0.1), 0, y0 + S(0.56), 0, '#FFF3D6');
  } else if (tipo === 'caffe') {
    b.cilindro(S(0.2), S(0.025), 0, y0, 0, T.bianco, 16).cilindro(S(0.12), S(0.2), 0, y0 + S(0.025), 0, T.bianco, 16, S(0.15));
    b.cilindro(S(0.135), S(0.01), 0, y0 + S(0.22), 0, '#5A3A22', 16);
    const h = new THREE.TorusGeometry(S(0.06), S(0.018), 6, 12); b.add(h, T.bianco, S(0.17), y0 + S(0.13), 0);
  } else if (tipo === 'cornetto') {
    for (let k = -2; k <= 2; k++) { const r = S(0.09 - Math.abs(k) * 0.02); b.esfera(r, S(k * 0.09), y0 + S(0.12) + Math.abs(k) * S(0.03), 0, k % 2 ? '#D99A45' : '#E8AE5A'); }
  } else if (tipo === 'pane') {
    const g = new THREE.SphereGeometry(S(0.1), 10, 6); g.scale(3, 1, 1); b.add(g, '#D9A35A', 0, y0 + S(0.1), 0);
    for (const x of [-0.12, 0, 0.12]) b.caixa(S(0.02), S(0.02), S(0.12), S(x), y0 + S(0.19), 0, '#F2D49A');
  } else if (tipo === 'torta') {
    b.cilindro(S(0.24), S(0.12), 0, y0, 0, '#F7B6C8', 16).cilindro(S(0.17), S(0.1), 0, y0 + S(0.12), 0, '#FFF3D6', 16).cilindro(S(0.1), S(0.08), 0, y0 + S(0.22), 0, '#F7B6C8', 16);
    b.cilindro(S(0.012), S(0.1), 0, y0 + S(0.3), 0, '#2F7DD1', 6).esfera(S(0.02), 0, y0 + S(0.42), 0, '#FFC93C');
  } else if (tipo === 'ciambella') {
    const g = new THREE.TorusGeometry(S(0.17), S(0.08), 8, 18); b.add(g, '#E8AE5A', 0, y0 + S(0.26), 0);
    const gl = new THREE.TorusGeometry(S(0.17), S(0.07), 8, 18, Math.PI * 2); gl.translate(0, 0, S(0.025)); b.add(gl, '#F27FA8', 0, y0 + S(0.26), 0);
  } else if (tipo === 'maglietta') {
    b.caixa(S(0.3), S(0.36), S(0.06), 0, y0, 0, '#2F7DD1').caixa(S(0.5), S(0.11), S(0.06), 0, y0 + S(0.25), 0, '#2F7DD1').caixa(S(0.1), S(0.03), S(0.065), 0, y0 + S(0.34), 0, T.bianco);
  } else if (tipo === 'scarpa') {
    b.caixa(S(0.44), S(0.06), S(0.16), 0, y0, 0, T.bianco).caixa(S(0.4), S(0.1), S(0.15), S(-0.01), y0 + S(0.06), 0, '#E0473C').caixa(S(0.18), S(0.12), S(0.15), S(-0.11), y0 + S(0.16), 0, '#E0473C');
  } else if (tipo === 'barbiere') {
    for (let k = 0; k < 6; k++) b.cilindro(S(0.08), S(0.09), 0, y0 + S(k * 0.09), 0, ['#E0473C', T.bianco, '#2F7DD1'][k % 3], 12);
    b.esfera(S(0.09), 0, y0 + S(0.58), 0, '#DDE1E8');
  } else if (tipo === 'fiore') {
    b.cilindro(S(0.02), S(0.34), 0, y0, 0, T.foglia, 6);
    for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2; b.esfera(S(0.08), Math.cos(a) * S(0.11), y0 + S(0.42), Math.sin(a) * S(0.04), '#F27FA8'); }
    b.esfera(S(0.07), 0, y0 + S(0.42), S(0.04), '#FFC93C');
  } else if (tipo === 'manubrio') {
    const g = new THREE.CylinderGeometry(S(0.025), S(0.025), S(0.5), 8); g.rotateZ(Math.PI / 2); b.add(g, T.grigio, 0, y0 + S(0.16), 0);
    for (const x of [-0.2, 0.2]) { const d = new THREE.CylinderGeometry(S(0.14), S(0.14), S(0.07), 14); d.rotateZ(Math.PI / 2); b.add(d, T.scuro, S(x), y0 + S(0.16), 0); }
  } else if (tipo === 'smartphone') {
    b.caixa(S(0.24), S(0.46), S(0.04), 0, y0, 0, T.scuro).caixa(S(0.2), S(0.38), S(0.01), 0, y0 + S(0.04), S(0.022), '#4FA3E8');
  } else if (tipo === 'chiave') {
    // chave inglesa inclinada: cabo + boca aberta
    const cabo = new THREE.BoxGeometry(S(0.09), S(0.5), S(0.05)); cabo.rotateZ(-0.6); b.add(cabo, '#B8BEC6', 0, y0 + S(0.3), 0);
    for (const dx of [-0.07, 0.07]) { const d = new THREE.BoxGeometry(S(0.06), S(0.14), S(0.05)); d.rotateZ(-0.6); b.add(d, '#9AA3AE', S(0.16 + dx * 0.8), y0 + S(0.52 + dx * 0.55), 0); }
    const base = new THREE.CylinderGeometry(S(0.08), S(0.08), S(0.05), 12); base.rotateX(Math.PI / 2); b.add(base, '#9AA3AE', S(-0.14), y0 + S(0.1), 0);
  } else if (tipo === 'libro') {
    for (const s0 of [-1, 1]) { const g = new THREE.BoxGeometry(S(0.24), S(0.03), S(0.32)); g.rotateZ(s0 * -0.35); b.add(g, s0 < 0 ? '#2F7DD1' : '#E0473C', s0 * S(0.12), y0 + S(0.08), 0); }
    for (const s0 of [-1, 1]) { const g = new THREE.BoxGeometry(S(0.22), S(0.02), S(0.29)); g.rotateZ(s0 * -0.35); b.add(g, T.bianco, s0 * S(0.115), y0 + S(0.1), 0); }
  } else if (tipo === 'zampa') {
    b.esfera(S(0.13), 0, y0 + S(0.13), 0, '#7A4B2A');
    for (const [x, y] of [[-0.14, 0.3], [-0.05, 0.36], [0.05, 0.36], [0.14, 0.3]]) b.esfera(S(0.055), S(x), y0 + S(y), 0, '#7A4B2A');
  }
}

export function costruisciNegozio(cor, stileIn = {}) {
  const st = { ...STILE_BASE, coloreTenda: cor, ...stileIn };
  const b = new Construtor(), facce = [];
  const W = 0.72, D = 0.4, F = 0.2, hP = 0.62, H = st.piani === 2 ? 1.0 : hP;
  b.caixa(W, H, D, 0, 0, 0, st.facciata).caixa(W + 0.04, 0.04, D + 0.04, 0, H, 0, st.bordo);
  // vitrine e porta
  if (st.vetrina === 'larga') b.caixa(0.5, 0.26, 0.02, -0.08, 0.05, F, T.vetro);
  else if (st.vetrina === 'finestre') for (const x of [-0.25, -0.05]) b.caixa(0.13, 0.15, 0.02, x, 0.14, F, T.vetro).caixa(0.15, 0.02, 0.025, x, 0.13, F, T.bianco);
  else b.caixa(0.36, 0.24, 0.02, -0.12, 0.06, F, T.vetro);
  b.caixa(0.13, 0.26, 0.02, 0.22, 0, F, st.porta);
  if (st.serranda) {
    const larg = st.vetrina === 'larga' ? 0.5 : 0.36, x = st.vetrina === 'larga' ? -0.08 : -0.12;
    for (let k = 0; k < 4; k++) b.caixa(larg + 0.02, 0.022, 0.026, x, 0.31 - k * 0.026, F, k % 2 ? '#B8BEC6' : '#9AA3AE');
  }
  if (st.piani === 2) for (const x of [-0.22, 0, 0.22]) b.caixa(0.12, 0.14, 0.02, x, 0.74, F, T.vetro).caixa(0.14, 0.02, 0.03, x, 0.73, F, st.bordo);
  // toldo
  if (st.tenda === 'righe') for (let k = 0; k < 6; k++) { const g = new THREE.BoxGeometry(0.13, 0.015, 0.16); g.rotateX(0.45); b.add(g, k % 2 ? st.coloreRighe : st.coloreTenda, -0.325 + k * 0.13, 0.36, 0.27); }
  else if (st.tenda === 'liscia') { const g = new THREE.BoxGeometry(0.78, 0.015, 0.16); g.rotateX(0.45); b.add(g, st.coloreTenda, 0, 0.36, 0.27); }
  // letreiros (faces com o nome)
  if (st.insegna === 'cassonetto') {
    b.caixa(0.62, 0.17, 0.06, 0, H + 0.04, F - 0.04, scuro(cor)).cilindro(0.01, 0.04, -0.2, H + 0.02, F - 0.04, T.scuro, 4).cilindro(0.01, 0.04, 0.2, H + 0.02, F - 0.04, T.scuro, 4);
    facce.push({ tipo: 'insegna', p: { x: 0, y: H + 0.045, z: F - 0.04 + 0.031, w: 0.58, h: 0.15 } });
  } else if (st.insegna === 'bandiera') {
    b.caixa(0.03, 0.03, 0.18, 0.33, 0.5, F + 0.07, T.scuro).caixa(0.025, 0.2, 0.16, 0.33, 0.29, F + 0.1, T.scuro);
    facce.push({ tipo: 'bandiera', p: { x: 0, y: 0.3, z: 0, w: 0.15, h: 0.18 }, ry: Math.PI / 2, dx: 0.344, dz: F + 0.1 });
    facce.push({ tipo: 'bandiera', p: { x: 0, y: 0.3, z: 0, w: 0.15, h: 0.18 }, ry: -Math.PI / 2, dx: 0.316, dz: F + 0.1 });
  } else {
    const y = st.tenda === 'nessuna' ? 0.38 : 0.47;
    b.caixa(0.7, 0.17, 0.025, 0, y - 0.01, F, st.insegna === 'neon' ? '#14161F' : scuro(cor));
    facce.push({ tipo: st.insegna === 'neon' ? 'neon' : 'insegna', p: { x: 0, y, z: F + 0.014, w: 0.66, h: 0.15 } });
  }
  const conOggetto = st.oggetto && st.oggetto !== 'nessuno', zTetto = conOggetto ? -0.17 : -0.12;
  if (st.tetto) {
    for (const x of [-0.24, 0.24]) b.caixa(0.03, 0.12, 0.03, x, H + 0.04, zTetto, T.scuro);
    b.caixa(0.66, 0.3, 0.03, 0, H + 0.14, zTetto, T.scuro);
    facce.push({ tipo: 'tetto', p: { x: 0, y: H + 0.155, z: zTetto + 0.016, w: 0.62, h: 0.27 } });
  }
  // objeto gigante no telhado (à frente da insegna do telhado, quando as duas existem)
  if (conOggetto) {
    const ob = new Construtor();
    oggettoGigante(ob, st.oggetto, H + 0.04 + (st.insegna === 'cassonetto' ? 0.14 : 0), Math.max(0.5, Math.min(1.5, +st.scala || 1)));
    for (const p of ob.partes) { if (st.tetto) p.translate(0, 0, 0.07); b.partes.push(p); }
  }
  // enfeites
  const orn = new Set(st.ornamenti ?? []);
  if (orn.has('vasi')) for (const x of [-0.3, 0.33]) { b.caixa(0.06, 0.06, 0.06, x, 0, 0.32, '#B0623A'); b.esfera(0.05, x, 0.1, 0.32, '#E0473C'); b.esfera(0.04, x + 0.02, 0.12, 0.31, T.foglia); }
  if (orn.has('dehors')) for (const x of [-0.18, 0.12]) {
    b.cilindro(0.05, 0.004, x, 0.07, 0.41, T.bianco, 10).cilindro(0.006, 0.07, x, 0, 0.41, T.scuro, 4);
    b.cilindro(0.006, 0.22, x, 0, 0.41, T.grigio, 4).cone(0.11, 0.06, x, 0.2, 0.41, x < 0 ? st.coloreTenda : T.bianco, 8);
  }
  if (orn.has('luci')) for (let k = 0; k <= 10; k++) { const t = k / 10; b.esfera(0.014, -0.36 + t * 0.72, H - 0.04 - Math.sin(t * Math.PI) * 0.05, F + 0.03, ['#FFE7A0', '#FFD23F', '#FF6B5A'][k % 3]); }
  if (orn.has('bandierine')) for (let k = 0; k < 9; k++) {
    const t = (k + 0.5) / 9, g = new THREE.BufferGeometry();
    // ordem anti-horária vista da rua (+z), senão o triângulo fica de costas e some
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-0.025, 0, 0, 0, -0.05, 0, 0.025, 0, 0]), 3));
    b.add(g, ['#2E9B55', '#FFFFFF', '#E0473C'][k % 3], -0.36 + t * 0.72, H + 0.02 - Math.sin(t * Math.PI) * 0.04, F + 0.04);
  }
  return { geo: b.geometria(), facce, stile: st };
}
// compatibilidade: loja padrão (sem personalização) e posição do letreiro padrão
export const INSEGNA = { x: 0, y: 0.47, z: 0.215, w: 0.66, h: 0.15 };
export const geometriaNegozio = cor => costruisciNegozio(cor).geo;
