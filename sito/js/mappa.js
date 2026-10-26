// Cena 3D: terreno da Itália, mar, câmera e controles (arrastar, pinça, roda, rotação).
import * as THREE from 'three';

export const ESAG = 0.003;          // km de altura por metro de altitude (relevo exagerado ~3x)
export const COR_MAR = '#8EBFD2';
const DIST_MIN = 0.22, DIST_MAX = 3600;

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const suave = t => t * t * (3 - 2 * t);
const facilitar = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

export class Mappa {
  constructor(canvas, geo, rilievo, imagemTerreno, opcoes = {}) {
    this.canvas = canvas;
    this.geo = geo;
    this.ril = rilievo;
    this.aoFrame = [];         // callbacks a cada frame renderizado
    this.aoClique = null;      // (x, y) clique/toque sem arrastar
    this.aoMover = [];         // callbacks quando a câmera muda
    this.sujo = true;
    this.animando = 0;         // >0 força render contínuo (chamas etc.)

    // opcoes.gravacao: renderização manual quadro a quadro (modo vídeo)
    const r = this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: !!opcoes.gravacao });
    r.setPixelRatio(opcoes.gravacao ? 1 : Math.min(devicePixelRatio, 2));
    this.gravacao = !!opcoes.gravacao;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(COR_MAR);
    this.scene.fog = new THREE.Fog(COR_MAR, 1e5, 2e5);
    this.camera = new THREE.PerspectiveCamera(35, 1, 0.1, 5000);

    this.ceu = new THREE.HemisphereLight(0xffffff, 0xb9c7a8, 2.3);
    this.scene.add(this.ceu);
    const sol = this.sol = new THREE.DirectionalLight(0xfff1dc, 2.4);
    sol.position.set(-0.55, 1, 0.4);
    this.scene.add(sol);
    this.animatori = new Set();   // quem precisa de render contínuo (fogos etc.), além de "animando"

    this.criarTerreno(imagemTerreno);

    // estado da câmera
    const b = geo.bbox;
    this.alvo = new THREE.Vector3((b.x0 + b.x1) / 2, 0, (b.z0 + b.z1) / 2 - 20);
    this.dist = 2200;
    this.az = 0;
    this.voo = null;
    this.raycaster = new THREE.Raycaster();
    this.ligarControles();
    this.redimensionar();
    addEventListener('resize', () => this.redimensionar());
    this.dist = this.distPais();
    this.atualizarCamera();
    requestAnimationFrame(t => this.loop(t));
  }

  criarTerreno(img) {
    const { w: GW, h: GH } = this.geo.rilievo, b = this.geo.bbox, ril = this.ril;
    const pos = new Float32Array(GW * GH * 3), uv = new Float32Array(GW * GH * 2);
    for (let j = 0; j < GH; j++) for (let i = 0; i < GW; i++) {
      const k = j * GW + i;
      pos[k * 3] = b.x0 + i / (GW - 1) * (b.x1 - b.x0);
      pos[k * 3 + 1] = ril[k] * ESAG;
      pos[k * 3 + 2] = b.z0 + j / (GH - 1) * (b.z1 - b.z0);
      uv[k * 2] = i / (GW - 1);
      uv[k * 2 + 1] = 1 - j / (GH - 1);
    }
    const tex = new THREE.Texture(img);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
    tex.needsUpdate = true;
    const mat = this.matTerreno = new THREE.MeshBasicMaterial({ map: tex });
    // blocos de 32x32 quadrados: a câmera de perto só desenha os blocos visíveis
    const posA = new THREE.BufferAttribute(pos, 3), uvA = new THREE.BufferAttribute(uv, 2), B = 32;
    this.terreno = new THREE.Group();
    for (let j0 = 0; j0 < GH - 1; j0 += B) for (let i0 = 0; i0 < GW - 1; i0 += B) {
      const j1 = Math.min(GH - 1, j0 + B), i1 = Math.min(GW - 1, i0 + B), idx = [];
      for (let j = j0; j < j1; j++) for (let i = i0; i < i1; i++) {
        const a = j * GW + i, bb = a + 1, c = a + GW, d = c + 1;
        idx.push(a, c, bb, bb, c, d);
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', posA);
      g.setAttribute('uv', uvA);
      g.setIndex(new THREE.BufferAttribute(new Uint32Array(idx), 1));
      // esfera de recorte só do bloco (a geometria compartilha os vértices da grade inteira)
      const cx = b.x0 + (i0 + i1) / 2 / (GW - 1) * (b.x1 - b.x0), cz = b.z0 + (j0 + j1) / 2 / (GH - 1) * (b.z1 - b.z0);
      let hmax = 0;
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) hmax = Math.max(hmax, ril[j * GW + i] * ESAG);
      const meio = Math.hypot((i1 - i0) / (GW - 1) * (b.x1 - b.x0), (j1 - j0) / (GH - 1) * (b.z1 - b.z0)) / 2;
      g.boundingSphere = new THREE.Sphere(new THREE.Vector3(cx, hmax / 2, cz), Math.hypot(meio, hmax / 2));
      this.terreno.add(new THREE.Mesh(g, mat));
    }
    this.scene.add(this.terreno);

    const mar = this.mar = new THREE.Mesh(new THREE.PlaneGeometry(40000, 40000), new THREE.MeshBasicMaterial({ color: COR_MAR }));
    mar.rotation.x = -Math.PI / 2;
    mar.position.y = -0.05;
    this.scene.add(mar);
  }

  // noite: mar e céu escuros, terreno azulado, luz de lua (as cores do dia voltam com notte=false)
  definirNotte(notte) {
    this.notte = notte;
    const corMar = new THREE.Color(notte ? '#1E3560' : COR_MAR);
    this.scene.background.copy(corMar);
    this.scene.fog.color.copy(corMar);
    this.mar.material.color.copy(corMar);
    this.matTerreno.color.set(notte ? '#7C8BB0' : '#ffffff');
    this.ceu.intensity = notte ? 1.15 : 2.3;
    this.ceu.color.set(notte ? '#B9C6FF' : '#ffffff');
    this.sol.intensity = notte ? 0.75 : 2.4;
    this.sol.color.set(notte ? '#A9BBFF' : '#fff1dc');
    document.documentElement.classList.toggle('notte', notte);
    this.sujo = true;
  }

  // altura do terreno (unidades do mundo) em x,z — mesma interpolação da malha
  altura(x, z) {
    const { w: GW, h: GH } = this.geo.rilievo, b = this.geo.bbox;
    const fx = clamp((x - b.x0) / (b.x1 - b.x0) * (GW - 1), 0, GW - 1.001);
    const fz = clamp((z - b.z0) / (b.z1 - b.z0) * (GH - 1), 0, GH - 1.001);
    const i = Math.floor(fx), j = Math.floor(fz), ax = fx - i, az = fz - j, k = j * GW + i, r = this.ril;
    return ((r[k] * (1 - ax) + r[k + 1] * ax) * (1 - az) + (r[k + GW] * (1 - ax) + r[k + GW + 1] * ax) * az) * ESAG;
  }

  // ângulo de elevação da câmera: quase de cima no país, inclinada na cidade
  elevacao(d) {
    const t = clamp((Math.log(d) - Math.log(2)) / (Math.log(900) - Math.log(2)), 0, 1);
    return (40 + 32 * suave(t)) * Math.PI / 180;
  }

  distPais() {
    const b = this.geo.bbox, asp = this.camera.aspect;
    const vf = this.camera.fov * Math.PI / 360, hf = Math.atan(Math.tan(vf) * asp);
    const W = (b.x1 - b.x0) * 0.9, H = (b.z1 - b.z0) * 0.86;
    return clamp(Math.max(W / 2 / Math.tan(hf), H / 2 / Math.tan(vf) * 0.95), 600, DIST_MAX);
  }

  atualizarCamera() {
    const b = this.geo.bbox;
    this.alvo.x = clamp(this.alvo.x, b.x0, b.x1);
    this.alvo.z = clamp(this.alvo.z, b.z0, b.z1);
    this.dist = clamp(this.dist, DIST_MIN, DIST_MAX);
    this.alvo.y = this.alturaAlvo ? this.alturaAlvo(this.alvo.x, this.alvo.z, this.dist) : this.altura(this.alvo.x, this.alvo.z);
    const el = this.elevacao(this.dist), d = this.dist, c = this.camera;
    c.position.set(
      this.alvo.x + Math.sin(this.az) * Math.cos(el) * d,
      this.alvo.y + Math.sin(el) * d,
      this.alvo.z + Math.cos(this.az) * Math.cos(el) * d,
    );
    c.lookAt(this.alvo);
    c.near = Math.max(0.004, d * 0.02);
    c.far = d * 12 + 400;
    c.updateProjectionMatrix();
    c.updateMatrixWorld(true);   // raios (zoom no ponto, arrastar, clique) usam a câmera já movida, não a do último quadro
    if (d < 60) { this.scene.fog.near = d * 2.2; this.scene.fog.far = d * 7; }
    else { this.scene.fog.near = 1e5; this.scene.fog.far = 2e5; }
    this.sujo = true;
    for (const f of this.aoMover) f();
  }

  redimensionar() {
    const w = innerWidth, h = innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    if (!this.tocou && !this.voo) this.dist = this.distPais();   // reenquadra até a primeira interação
    this.atualizarCamera();
  }

  // ---------- conversões ----------
  raio(sx, sy) {
    const r = this.canvas.getBoundingClientRect();
    this.raycaster.setFromCamera({ x: (sx - r.left) / r.width * 2 - 1, y: -(sy - r.top) / r.height * 2 + 1 }, this.camera);
    return this.raycaster.ray;
  }
  raioChao(sx, sy, y = this.alvo.y) {
    const ray = this.raio(sx, sy);
    if (Math.abs(ray.direction.y) < 1e-6) return null;
    const t = (y - ray.origin.y) / ray.direction.y;
    return t > 0 ? ray.origin.clone().addScaledVector(ray.direction, t) : null;
  }
  // ponto do relevo sob o cursor (o plano é ajustado à altura do terreno naquele ponto)
  pontoTerreno(sx, sy) {
    let p = this.raioChao(sx, sy, this.alvo.y);
    for (let i = 0; i < 4 && p; i++) {
      const y = this.altura(p.x, p.z);
      const q = this.raioChao(sx, sy, y);
      if (!q) break;
      p = q;
    }
    return p;
  }
  projetar(x, y, z) {
    const v = new THREE.Vector3(x, y, z).project(this.camera);
    return { x: (v.x + 1) / 2 * innerWidth, y: (1 - v.y) / 2 * innerHeight, ok: v.z < 1 && v.z > -1 };
  }

  // ---------- voos ----------
  voar({ x, z, dist, az = this.az }, ms = 1300) {
    const de = { x: this.alvo.x, z: this.alvo.z, d: this.dist, az: this.az };
    let daz = ((az - de.az) % (2 * Math.PI) + 3 * Math.PI) % (2 * Math.PI) - Math.PI;
    this.tocou = true;
    const percurso = Math.hypot(x - de.x, z - de.z);
    const pico = Math.max(de.d, dist, percurso * 1.1);
    const bump = Math.log(pico) - Math.max(Math.log(de.d), Math.log(dist));
    this.voo = { de, para: { x, z, d: dist, az: de.az + daz }, bump, t0: performance.now(), ms: percurso > 50 ? ms * 1.35 : ms };
  }
  passoVoo(agora) {
    const v = this.voo;
    const t = clamp((agora - v.t0) / v.ms, 0, 1), e = facilitar(t);
    this.alvo.x = v.de.x + (v.para.x - v.de.x) * e;
    this.alvo.z = v.de.z + (v.para.z - v.de.z) * e;
    this.dist = Math.exp(Math.log(v.de.d) * (1 - e) + Math.log(v.para.d) * e + v.bump * Math.sin(Math.PI * e));
    this.az = v.de.az + (v.para.az - v.de.az) * e;
    if (t >= 1) this.voo = null;
    this.atualizarCamera();
  }
  // zoom mantendo fixo o ponto do mapa sob o cursor/dedo (a inclinação da câmera muda com a distância,
  // então reposiciona depois de mudar a distância, como no arrastar)
  zoomNoPonto(sx, sy, f) {
    const antes = this.pontoTerreno(sx, sy);
    this.dist = clamp(this.dist * f, DIST_MIN, DIST_MAX);
    this.atualizarCamera();
    if (!antes) return;
    for (let i = 0; i < 3; i++) {   // alguns passos: a altura do alvo muda ao andar sobre o relevo
      const depois = this.raioChao(sx, sy, antes.y);
      if (!depois) return;
      this.alvo.x += antes.x - depois.x;
      this.alvo.z += antes.z - depois.z;
      this.atualizarCamera();
    }
  }

  zoom(f, ms = 350) {
    this.voar({ x: this.alvo.x, z: this.alvo.z, dist: clamp(this.dist * f, DIST_MIN, DIST_MAX) }, ms);
  }
  verPais() {
    const b = this.geo.bbox;
    this.voar({ x: (b.x0 + b.x1) / 2, z: (b.z0 + b.z1) / 2 - 20, dist: this.distPais(), az: 0 }, 1400);
  }

  // ---------- controles ----------
  ligarControles() {
    const cv = this.canvas, dedos = new Map();
    let arr = null, pinca = null;
    const iniciarArrasto = (e) => {
      // t0 = hora real do toque (e.timeStamp): com o processador ocupado o evento chega atrasado
      arr = { ponto: this.pontoTerreno(e.clientX, e.clientY), x0: e.clientX, y0: e.clientY, t0: e.timeStamp ?? performance.now(), moveu: false, girar: e.button === 2 || e.shiftKey, az0: this.az };
    };
    cv.addEventListener('pointerdown', e => {
      cv.setPointerCapture(e.pointerId);
      dedos.set(e.pointerId, { x: e.clientX, y: e.clientY });
      this.voo = null;
      this.tocou = true;
      if (dedos.size === 1) iniciarArrasto(e);
      else if (dedos.size === 2) {
        const [a, b] = [...dedos.values()];
        pinca = { d0: Math.hypot(a.x - b.x, a.y - b.y), ang0: Math.atan2(b.y - a.y, b.x - a.x), dist0: this.dist, az0: this.az, mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 };
        pinca.ponto = this.pontoTerreno(pinca.mx, pinca.my);
        arr = null;
      }
    });
    cv.addEventListener('pointermove', e => {
      if (!dedos.has(e.pointerId)) return;
      dedos.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pinca && dedos.size >= 2) {
        const [a, b] = [...dedos.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y), ang = Math.atan2(b.y - a.y, b.x - a.x);
        this.dist = clamp(pinca.dist0 * pinca.d0 / Math.max(d, 1), DIST_MIN, DIST_MAX);
        this.az = pinca.az0 - (ang - pinca.ang0);
        this.atualizarCamera();
        for (let i = 0; i < 2 && pinca.ponto; i++) {
          const p = this.raioChao((a.x + b.x) / 2, (a.y + b.y) / 2, pinca.ponto.y);
          if (!p) break;
          this.alvo.x += pinca.ponto.x - p.x; this.alvo.z += pinca.ponto.z - p.z; this.atualizarCamera();
        }
        return;
      }
      if (!arr) return;
      const dx = e.clientX - arr.x0, dy = e.clientY - arr.y0;
      if (Math.hypot(dx, dy) > 6) arr.moveu = true;
      if (!arr.moveu) return;
      if (arr.girar) { this.az = arr.az0 - dx * 0.006; this.atualizarCamera(); return; }
      for (let i = 0; i < 2 && arr.ponto; i++) {   // o ponto agarrado fica sob o dedo
        const p = this.raioChao(e.clientX, e.clientY, arr.ponto.y);
        if (!p) break;
        this.alvo.x += arr.ponto.x - p.x; this.alvo.z += arr.ponto.z - p.z; this.atualizarCamera();
      }
    });
    const fim = e => {
      if (!dedos.has(e.pointerId)) return;
      dedos.delete(e.pointerId);
      if (arr && !arr.moveu && (e.timeStamp ?? performance.now()) - arr.t0 < 500 && e.type === 'pointerup' && this.aoClique) this.aoClique(e.clientX, e.clientY);
      arr = null;
      if (dedos.size < 2) pinca = null;
      if (dedos.size === 1) { const [id, p] = [...dedos][0]; iniciarArrasto({ clientX: p.x, clientY: p.y, button: 0, pointerId: id }); arr.moveu = true; }
    };
    cv.addEventListener('pointerup', fim);
    cv.addEventListener('pointercancel', fim);
    cv.addEventListener('contextmenu', e => e.preventDefault());
    cv.addEventListener('wheel', e => {
      e.preventDefault();
      this.voo = null;
      this.tocou = true;
      this.zoomNoPonto(e.clientX, e.clientY, Math.exp(clamp(e.deltaY, -120, 120) * 0.0018));
    }, { passive: false });
  }

  loop(agora) {
    if (this.gravacao) return;
    requestAnimationFrame(t => this.loop(t));
    if (this.voo) this.passoVoo(agora);
    if (!this.sujo && !this.animando && !this.animatori.size) return;
    // só animações de fundo (fogos): 30 quadros por segundo bastam e poupam bateria
    if (!this.sujo && !this.animando && (this._pulo = !this._pulo)) return;
    for (const f of this.aoFrame) f(agora);
    this.renderer.render(this.scene, this.camera);
    this.sujo = false;
  }
}
