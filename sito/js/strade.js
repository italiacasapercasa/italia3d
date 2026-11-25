// Rede de estradas entre cidades vizinhas (passeggiata).
// Grafo de vizinhança relativa (RNG) com arestas de até 45 km que não atravessam o mar: liga cada cidade às vizinhas
// "de verdade" (sem atalho por cima de outra) e, por conter a árvore geradora mínima, deixa ir de qualquer cidade a
// qualquer outra do mesmo pedaço de terra. A estrada sai da ponta de uma rua da cidade (portão na borda do platô),
// segue reta um trecho, desce até o terreno e entra pela rua da outra cidade. Aterro dos dois lados (sem buraco
// entre o asfalto e o chão) e altura consultável para o bonequinho andar em cima.
import * as THREE from 'three';
import { LOTE, RUA, QW, QH } from './citta.js';

const MAX_KM = 45, CELULA = 15;            // grade de busca (km)
const LARG = RUA * 0.42;                   // meia largura do asfalto
const RETO = 0.12;                         // trecho reto na saída da rua (km)
const PASSO = 0.025;                       // amostragem do perfil (km)
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const suave = t => t * t * (3 - 2 * t);

export class Strade {
  constructor(D, mappa, citta) {
    this.D = D; this.mappa = mappa; this.citta = citta;
    this.grupo = new THREE.Group();
    this.grupo.visible = false;
    mappa.scene.add(this.grupo);
    this.mat = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
    this.matC = new THREE.MeshLambertMaterial({ color: '#2F6B3A', flatShading: true });
    this.matO = new THREE.MeshLambertMaterial({ color: '#7A9A4A', flatShading: true });
    this.matT = new THREE.MeshLambertMaterial({ color: '#6B4A2A' });
    this.geoC = new THREE.ConeGeometry(LOTE * 0.16, LOTE * 0.75, 7); this.geoC.translate(0, LOTE * 0.425, 0);
    this.geoT = new THREE.CylinderGeometry(LOTE * 0.03, LOTE * 0.03, LOTE * 0.1, 5); this.geoT.translate(0, LOTE * 0.05, 0);
    this.geoO = new THREE.IcosahedronGeometry(LOTE * 0.22, 0); this.geoO.translate(0, LOTE * 0.3, 0);
    this.archiCache = new Map();   // id da cidade -> [[dist, cidade], ...]
    this.strade = new Map();       // "a-b" -> estrada montada (perfil + malha)
    this.celle = new Map();        // id -> Set "i,j" das quadras
    this.grade = null;
  }

  // ---------- grafo ----------
  montarGrade() {
    const g = new Map();
    for (const l of this.D.luoghi) { const k = `${Math.floor(l.x / CELULA)},${Math.floor(l.z / CELULA)}`; (g.get(k) ?? g.set(k, []).get(k)).push(l); }
    this.grade = g;
  }
  perto(x, z, r) {
    if (!this.grade) this.montarGrade();
    const out = [], i0 = Math.floor((x - r) / CELULA), i1 = Math.floor((x + r) / CELULA), j0 = Math.floor((z - r) / CELULA), j1 = Math.floor((z + r) / CELULA);
    for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) for (const l of this.grade.get(`${i},${j}`) ?? []) {
      const d = Math.hypot(l.x - x, l.z - z);
      if (d <= r) out.push([d, l]);
    }
    return out.sort((a, b) => a[0] - b[0]);
  }
  semMar(a, b) {
    const d = Math.hypot(b.x - a.x, b.z - a.z), n = Math.max(12, Math.ceil(d / 0.8));
    let mar = 0;
    for (let k = 1; k < n; k++) { const t = k / n; if (this.mappa.altura(a.x + (b.x - a.x) * t, a.z + (b.z - a.z) * t) < 0.002) mar++; }
    return mar <= Math.max(1, Math.floor(n * 0.05));   // foz de rio / laguna pequena: ponte
  }
  // vizinhas ligadas por estrada (iguais vistas dos dois lados)
  archi(l) {
    let a = this.archiCache.get(l.id);
    if (a) return a;
    const cand = this.perto(l.x, l.z, MAX_KM).filter(([d, o]) => o !== l && d > 0.3);
    a = [];
    for (const [d, o] of cand) {
      // RNG: nenhuma outra cidade mais perto das duas pontas do que elas entre si
      let tapa = false;
      for (const [dc, c] of cand) {
        if (dc >= d) break;
        if (c !== o && Math.hypot(c.x - o.x, c.z - o.z) < d) { tapa = true; break; }
      }
      if (!tapa && this.semMar(l, o)) a.push([d, o]);
    }
    this.archiCache.set(l.id, a);
    return a;
  }
  // caminho mais curto pela rede (Dijkstra limitado), para "vai a…"
  percorso(da, a, maxNos = 9000) {
    const dist = new Map([[da.id, 0]]), prev = new Map(), fila = [[0, da]], h = l => Math.hypot(l.x - a.x, l.z - a.z);
    let visit = 0;
    while (fila.length && visit++ < maxNos) {
      let mi = 0; for (let i = 1; i < fila.length; i++) if (fila[i][0] < fila[mi][0]) mi = i;
      const [, u] = fila.splice(mi, 1)[0];
      if (u === a) { const out = [a]; let x = a; while (prev.has(x.id)) { x = prev.get(x.id); out.unshift(x); } return out; }
      const du = dist.get(u.id);
      for (const [d, v] of this.archi(u)) {
        const nd = du + d;
        if (nd < (dist.get(v.id) ?? Infinity)) { dist.set(v.id, nd); prev.set(v.id, u); fila.push([nd + h(v), v]); }
      }
    }
    return null;
  }

  // ---------- portão: ponta da rua da cidade virada para o destino ----------
  cel(l) {
    let s = this.celle.get(l.id);
    if (!s) { s = new Set(this.citta.quadreDi(l).map(([i, j]) => `${i},${j}`)); this.celle.set(l.id, s); }
    return s;
  }
  portao(l, ux, uz) {
    const cel = this.cel(l), emX = Math.abs(ux) >= Math.abs(uz);
    const s = emX ? Math.sign(ux) || 1 : Math.sign(uz) || 1, lado = emX ? (uz > 0 ? 0 : -1) : (ux > 0 ? 0 : -1);
    let k = 0;
    const tem = k => emX ? cel.has(`${k * s},${lado}`) || cel.has(`${k * s},${lado + 1}`) : cel.has(`${lado},${k * s}`) || cel.has(`${lado + 1},${k * s}`);
    while (k < 60 && tem(k + 1)) k++;
    return emX
      ? { x: l.x + s * (k * QW + QW / 2), z: l.z + (lado + 0.5) * QH, dx: s, dz: 0 }
      : { x: l.x + (lado + 0.5) * QW, z: l.z + s * (k * QH + QH / 2), dx: 0, dz: s };
  }

  // ---------- estrada montada ----------
  chave(a, b) { return a.id < b.id ? `${a.id}-${b.id}` : `${b.id}-${a.id}`; }
  strada(a, b) {
    const k = this.chave(a, b);
    let s = this.strade.get(k);
    if (s) return s;
    const [A, B] = a.id < b.id ? [a, b] : [b, a];
    const D = Math.hypot(B.x - A.x, B.z - A.z), ux = (B.x - A.x) / D, uz = (B.z - A.z) / D;
    const gA = this.portao(A, ux, uz), gB = this.portao(B, -ux, -uz);
    const hA = this.citta.dadosCidade(A).hc, hB = this.citta.dadosCidade(B).hc, mp = this.mappa;
    // polilinha: portão A → reta da rua → reta da rua → portão B
    const nos = [[gA.x, gA.z], [gA.x + gA.dx * RETO, gA.z + gA.dz * RETO], [gB.x + gB.dx * RETO, gB.z + gB.dz * RETO], [gB.x, gB.z]];
    const P = [];   // amostras: x, z, y, s (distância acumulada)
    let acc = 0;
    for (let n = 0; n < 3; n++) {
      const [x0, z0] = nos[n], [x1, z1] = nos[n + 1], L = Math.hypot(x1 - x0, z1 - z0), m = Math.max(1, Math.ceil(L / PASSO));
      for (let i = n === 0 ? 0 : 1; i <= m; i++) { const t = i / m; P.push({ x: x0 + (x1 - x0) * t, z: z0 + (z1 - z0) * t, s: acc + L * t }); }
      acc += L;
    }
    const tot = acc;
    // perfil: terreno, puxado para a altura da cidade perto das pontas (rampa com no máx. ~12% de inclinação real)
    const rampaA = clamp(Math.abs(hA - mp.altura(nos[1][0], nos[1][1])) * 9, 0.15, Math.min(0.9, tot * 0.45));
    const rampaB = clamp(Math.abs(hB - mp.altura(nos[2][0], nos[2][1])) * 9, 0.15, Math.min(0.9, tot * 0.45));
    for (const p of P) {
      const h = mp.altura(p.x, p.z);
      p.chao = h;
      const wA = p.s <= RETO ? 1 : suave(clamp(1 - (p.s - RETO) / rampaA, 0, 1));
      const wB = tot - p.s <= RETO ? 1 : suave(clamp(1 - (tot - p.s - RETO) / rampaB, 0, 1));
      let y = h + (hA - h) * wA + (hB - h) * wB;
      if (wA === 1) y = hA; else if (wB === 1) y = hB;
      p.y = Math.max(y, h < 0.002 ? 0.006 : h) + 0.0012;   // nunca enterrada; sobre a água vira ponte
    }
    // suaviza o perfil (terreno em triângulos de 2,5 km dá quinas) sem mexer nas pontas
    for (let it = 0; it < 3; it++) for (let i = 1; i < P.length - 1; i++) {
      if (P[i].s <= RETO || tot - P[i].s <= RETO) continue;
      P[i].y = Math.max(P[i].chao + 0.0012, (P[i - 1].y + P[i].y * 2 + P[i + 1].y) / 4);
    }
    // perpendicular por amostra (média dos dois trechos: sem fresta nas curvas)
    for (let i = 0; i < P.length; i++) {
      const a = P[Math.max(0, i - 1)], b = P[Math.min(P.length - 1, i + 1)], l = Math.hypot(b.x - a.x, b.z - a.z) || 1;
      P[i].tx = (b.x - a.x) / l; P[i].tz = (b.z - a.z) / l; P[i].px = -P[i].tz; P[i].pz = P[i].tx;
      // aterro: largura conforme a altura sobre o terreno de cada lado
      for (const lado of [-1, 1]) {
        const ex = P[i].x + P[i].px * LARG * lado, ez = P[i].z + P[i].pz * LARG * lado;
        const queda = Math.max(0, P[i].y - mp.altura(ex, ez)), w = clamp(queda * 2.2, 0.006, 0.6);
        const fx = ex + P[i].px * w * lado, fz = ez + P[i].pz * w * lado;
        P[i][lado < 0 ? 'ae' : 'ad'] = { w, x: fx, z: fz, y: Math.min(P[i].y - 0.0005, mp.altura(fx, fz) - 0.002) };
      }
    }
    s = { k, A, B, P, tot, gA, gB, mesh: null, x0: Infinity, x1: -Infinity, z0: Infinity, z1: -Infinity };
    for (const p of P) { s.x0 = Math.min(s.x0, p.x); s.x1 = Math.max(s.x1, p.x); s.z0 = Math.min(s.z0, p.z); s.z1 = Math.max(s.z1, p.z); }
    this.strade.set(k, s);
    return s;
  }
  malha(s) {
    if (s.mesh) return s.mesh;
    const P = s.P, pos = [], col = [];
    const asf = new THREE.Color('#7E8794'), riga = new THREE.Color('#FFFFFF'), bordo = new THREE.Color('#E4E1DA'), erba = new THREE.Color('#7FB55C'), terra = new THREE.Color('#6E8F48');
    const tri = (a, b, c, ca, cb, cc) => { pos.push(...a, ...b, ...c); col.push(ca.r, ca.g, ca.b, cb.r, cb.g, cb.b, cc.r, cc.g, cc.b); };
    const quad = (a, b, c, d, ca, cb = ca) => { tri(a, b, c, ca, ca, cb); tri(a, c, d, ca, cb, cb); };
    const L = (p, off, dy = 0) => [p.x + p.px * off, p.y + dy, p.z + p.pz * off];
    for (let i = 0; i < P.length - 1; i++) {
      const p = P[i], q = P[i + 1];
      quad(L(p, -LARG), L(q, -LARG), L(q, LARG), L(p, LARG), asf);
      // calçada fina na beira e linha tracejada no meio
      for (const sg of [-1, 1]) quad(L(p, sg * LARG), L(q, sg * LARG), L(q, sg * LARG * 0.9, 0.0003), L(p, sg * LARG * 0.9, 0.0003), bordo);
      if (i % 3 === 0) quad(L(p, -LARG * 0.05, 0.0004), L(q, -LARG * 0.05, 0.0004), L(q, LARG * 0.05, 0.0004), L(p, LARG * 0.05, 0.0004), riga);
      // aterro dos dois lados até o terreno
      for (const [k, sg] of [['ae', -1], ['ad', 1]]) {
        const a = L(p, sg * LARG), b = L(q, sg * LARG), c = [q[k].x, q[k].y, q[k].z], d = [p[k].x, p[k].y, p[k].z];
        quad(a, b, c, d, erba, terra);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pos), 3));
    geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(col), 3));
    geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, this.mat);
    // árvores dos dois lados (sempre iguais para a mesma estrada), fora do aterro e das pontas
    let seme = Math.abs(Math.round(s.A.x * 1000 + s.B.z * 777)) || 1;
    const rnd = () => { seme = (seme * 16807) % 2147483647; return seme / 2147483647; };
    const M = Math.min(500, Math.ceil(s.tot / 0.05)), mp = this.mappa;
    const ic = new THREE.InstancedMesh(this.geoC, this.matC, M), io = new THREE.InstancedMesh(this.geoO, this.matO, M), it = new THREE.InstancedMesh(this.geoT, this.matT, M);
    const mt = new THREE.Matrix4(); let nc = 0, no = 0, nt = 0;
    for (let k = 0; k < M; k++) {
      const i = Math.floor((k + rnd()) / M * (P.length - 1)), p = P[i], lado = rnd() < 0.5 ? -1 : 1;
      if (p.s < 0.4 || s.tot - p.s < 0.4) continue;
      const ater = p[lado < 0 ? 'ae' : 'ad'].w, off = lado * (LARG + ater + LOTE * 0.4 + rnd() * LOTE * 3);
      const x = p.x + p.px * off, z = p.z + p.pz * off, h = mp.altura(x, z);
      if (h < 0.002) continue;
      const e = 0.8 + rnd() * 0.6;
      mt.makeScale(e, e, e).setPosition(x, h, z);
      if (rnd() < 0.55) ic.setMatrixAt(nc++, mt); else io.setMatrixAt(no++, mt);
      it.setMatrixAt(nt++, mt);
    }
    ic.count = nc; io.count = no; it.count = nt;
    for (const x of [ic, io, it]) { x.frustumCulled = false; mesh.add(x); }
    return (s.mesh = mesh);
  }

  // estradas a até R km do ponto (as duas pontas perto o bastante): monta as que faltam, tira as longe
  aggiorna(x, z, R = 6) {
    const vivas = new Set();
    for (const [, l] of this.perto(x, z, R + MAX_KM / 2)) {
      for (const [, o] of this.archi(l)) {
        if (o.id < l.id && Math.hypot(o.x - x, o.z - z) <= R + MAX_KM / 2) continue;   // a outra ponta já cuida
        if (distSeg(x, z, l, o) > R + 0.5) continue;                                     // estrada passa longe
        vivas.add(this.strada(l, o).k);
      }
    }
    for (const m of [...this.grupo.children]) if (!vivas.has(m.userData.k)) this.grupo.remove(m);
    const tem = new Set(this.grupo.children.map(m => m.userData.k));
    for (const k of vivas) if (!tem.has(k)) { const s = this.strade.get(k), m = this.malha(s); m.userData.k = k; this.grupo.add(m); }
    this.vivas = [...vivas].map(k => this.strade.get(k));
    // não guarda malhas sem fim na memória
    if (this.strade.size > 400) for (const [k, s] of this.strade) { if (!vivas.has(k)) { if (s.mesh) { s.mesh.geometry.dispose(); s.mesh.children.forEach(c => c.dispose?.()); } this.strade.delete(k); } if (this.strade.size <= 250) break; }
  }

  // altura da estrada em (x,z): { y, d } se estiver no asfalto ou no aterro; senão null
  altura(x, z) {
    let melhor = null;
    for (const s of this.vivas ?? []) {
      const m = LARG + 0.62;
      if (x < s.x0 - m || x > s.x1 + m || z < s.z0 - m || z > s.z1 + m) continue;
      const P = s.P;
      for (let i = 0; i < P.length - 1; i++) {
        const p = P[i], q = P[i + 1];
        if (Math.abs(p.x - x) > 0.7 || Math.abs(p.z - z) > 0.7) continue;
        const sx = q.x - p.x, sz = q.z - p.z, L2 = sx * sx + sz * sz || 1e-9;
        const t = clamp(((x - p.x) * sx + (z - p.z) * sz) / L2, 0, 1);
        const cx = p.x + sx * t, cz = p.z + sz * t, d = Math.hypot(x - cx, z - cz), y = p.y + (q.y - p.y) * t;
        // lado do aterro
        const lado = (x - cx) * p.px + (z - cz) * p.pz < 0 ? 'ae' : 'ad', w = p[lado].w;
        if (d > LARG + w) continue;
        let yy = y;
        if (d > LARG) { const f = (d - LARG) / w; yy = y + (Math.max(p[lado].y, this.mappa.altura(x, z)) - y) * f; }
        if (!melhor || d < melhor.d) melhor = { y: yy, d, asfalto: d <= LARG, s, i, t };
      }
    }
    return melhor;
  }
}

function distSeg(x, z, a, b) {
  const sx = b.x - a.x, sz = b.z - a.z, L2 = sx * sx + sz * sz || 1e-9, t = clamp(((x - a.x) * sx + (z - a.z) * sz) / L2, 0, 1);
  return Math.hypot(x - a.x - sx * t, z - a.z - sz * t);
}
