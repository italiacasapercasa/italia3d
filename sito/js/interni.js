// Casa con interni: o cômodo 3D da casa (cena própria, por cima do mapa). O dono arruma (móveis numa grade, piso e
// paredes); qualquer um pode visitar só olhando. Servidor: api/interni.php (salvar/ler) e api/conto.php "compra" (loja).
// Grade: célula = 1 unidade; o cômodo tem W x D células (cresce com o nível da casa). Paredes ao fundo (z−) e à esquerda (x−).
import * as THREE from 'three';

const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const n = v => Number(v).toLocaleString('it-IT');
const LEGNO = '#9C6B3F', LEGNO2 = '#7B5233', BIANCO = '#F4F1EA', NERO = '#23262E', METAL = '#9AA3AE';
// pegada na grade [largura, profundidade] com rotação 0; 'piano' = no chão por baixo de tudo; 'muro' = na parede do fundo
const PEG = { divano: [2, 1], tavolo: [2, 1], sedia: [1, 1], letto: [2, 2], pianta: [1, 1], tappeto: [2, 2, 'piano'], comodino: [1, 1], quadro: [1, 1, 'muro'], lampada: [1, 1], tavolino: [1, 1], poltrona: [1, 1], orologio: [1, 1], armadio: [2, 1], libreria: [2, 1], scrivania: [2, 1], tv: [2, 1], frigo: [1, 1], chitarra: [1, 1], cucina: [3, 1], camino: [2, 1], acquario: [2, 1], pianoforte: [2, 2] };
export const dimensioni = livello => (livello <= 3 ? [6, 5] : livello <= 8 ? [7, 6] : [8, 7]);

// ---------- modelos (olham para +z, centro da pegada na origem, chão em y=0) ----------
function modello(tipo) {
  const g = new THREE.Group(), mats = new Map();
  const mat = (c, em = null) => { const k = c + (em ?? ''); if (!mats.has(k)) mats.set(k, new THREE.MeshLambertMaterial({ color: c, ...(em ? { emissive: em, emissiveIntensity: 0.9 } : {}) })); return mats.get(k); };
  const B = (w, h, d, c, x = 0, y = 0, z = 0, em) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(c, em)); m.position.set(x, y + h / 2, z); g.add(m); return m; };
  const C = (rt, rb, h, c, x = 0, y = 0, z = 0, seg = 12, em) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat(c, em)); m.position.set(x, y + h / 2, z); g.add(m); return m; };
  const S = (r, c, x, y, z, sx = 1, sy = 1, sz = 1) => { const m = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 8), mat(c)); m.position.set(x, y, z); m.scale.set(sx, sy, sz); g.add(m); return m; };
  const gambe = (w, d, h, c = LEGNO2) => { for (const sx of [-1, 1]) for (const sz of [-1, 1]) B(0.07, h, 0.07, c, sx * (w / 2 - 0.06), 0, sz * (d / 2 - 0.06)); };
  switch (tipo) {
    case 'divano': B(1.9, 0.38, 0.85, '#3F7FC1'); B(1.9, 0.55, 0.22, '#356CA6', 0, 0.3, -0.32); for (const s of [-1, 1]) B(0.2, 0.55, 0.85, '#356CA6', s * 0.85, 0, 0); for (const s of [-1, 1]) B(0.78, 0.12, 0.6, '#5B9BDB', s * 0.4, 0.38, 0.06); break;
    case 'poltrona': B(0.85, 0.38, 0.8, '#C25B4A'); B(0.85, 0.55, 0.2, '#A84A3B', 0, 0.3, -0.3); for (const s of [-1, 1]) B(0.16, 0.5, 0.8, '#A84A3B', s * 0.35, 0, 0); break;
    case 'tavolo': gambe(1.7, 0.85, 0.72); B(1.8, 0.07, 0.9, LEGNO, 0, 0.72, 0); break;
    case 'tavolino': gambe(0.75, 0.5, 0.36); B(0.8, 0.05, 0.55, LEGNO, 0, 0.36, 0); B(0.14, 0.1, 0.14, '#E0473C', 0.15, 0.41, 0); break;
    case 'sedia': gambe(0.42, 0.42, 0.45); B(0.46, 0.06, 0.46, LEGNO, 0, 0.45, 0); B(0.46, 0.5, 0.06, LEGNO, 0, 0.5, -0.2); break;
    case 'letto': B(1.8, 0.3, 1.9, LEGNO2); B(1.7, 0.18, 1.8, BIANCO, 0, 0.3, 0.02); B(1.72, 0.06, 1.15, '#E0473C', 0, 0.46, 0.35); for (const s of [-1, 1]) B(0.6, 0.12, 0.3, '#FFFFFF', s * 0.42, 0.48, -0.65); B(1.8, 0.95, 0.1, LEGNO2, 0, 0, -0.95); break;
    case 'pianta': C(0.2, 0.15, 0.36, '#C9714A'); S(0.28, '#3E9B4A', 0, 0.62, 0); S(0.2, '#4FB35C', 0.14, 0.82, 0.05); S(0.18, '#2E8B3E', -0.12, 0.85, -0.04); break;
    case 'tappeto': B(1.9, 0.02, 1.9, '#B83A3A'); B(1.6, 0.025, 1.6, '#E0A33C'); B(1.2, 0.03, 1.2, '#B83A3A'); break;
    case 'comodino': B(0.5, 0.5, 0.45, LEGNO); B(0.42, 0.02, 0.02, LEGNO2, 0, 0.32, 0.23); C(0.06, 0.09, 0.2, '#FFE08A', 0.1, 0.5, 0, 10, '#FFC93C'); break;
    case 'quadro': B(0.9, 0.7, 0.06, LEGNO2, 0, 1.2, 0); B(0.76, 0.56, 0.07, '#9ED1F2', 0, 1.27, 0.005); B(0.76, 0.2, 0.075, '#4FB35C', 0, 1.27, 0.008); S(0.07, '#FFC93C', 0.22, 1.7, 0.05); break;
    case 'lampada': C(0.18, 0.2, 0.05, METAL); C(0.025, 0.025, 1.3, METAL, 0, 0.05, 0); C(0.14, 0.25, 0.28, '#FFF1C2', 0, 1.3, 0, 14, '#FFD966'); break;
    case 'orologio': B(0.5, 1.8, 0.35, LEGNO2); C(0.17, 0.17, 0.04, BIANCO, 0, 1.4, 0.18).rotation.x = Math.PI / 2; B(0.05, 0.5, 0.03, '#E0A33C', 0, 0.4, 0.18); break;
    case 'armadio': B(1.8, 2.05, 0.6, LEGNO); B(0.02, 1.9, 0.02, LEGNO2, 0, 0.08, 0.31); for (const s of [-1, 1]) B(0.04, 0.2, 0.04, '#E0A33C', s * 0.1, 1.0, 0.32); break;
    case 'libreria': B(1.8, 1.9, 0.38, LEGNO2); for (let k = 0; k < 4; k++) { B(1.66, 0.04, 0.34, LEGNO, 0, 0.1 + k * 0.45, 0.02); for (let b = 0; b < 7; b++) B(0.15, 0.3 + ((b * 7 + k) % 3) * 0.04, 0.26, ['#E0473C', '#3FA9F5', '#2E9B55', '#FFC93C', '#8B5CF6', '#F97316', '#14B8A6'][(b + k) % 7], -0.68 + b * 0.22, 0.14 + k * 0.45, 0.04); } break;
    case 'scrivania': gambe(1.7, 0.7, 0.74); B(1.8, 0.06, 0.75, BIANCO, 0, 0.74, 0); B(0.8, 0.5, 0.05, NERO, 0, 0.85, -0.2); B(0.72, 0.42, 0.055, '#3FA9F5', 0, 0.89, -0.19, '#1C6FB0'); B(0.5, 0.03, 0.18, '#CCD3DB', 0, 0.8, 0.12); break;
    case 'tv': B(1.8, 0.45, 0.45, LEGNO2); B(1.45, 0.82, 0.07, NERO, 0, 0.5, -0.05); B(1.35, 0.72, 0.075, '#2E9B55', 0, 0.55, -0.045, '#1F6B3A'); break;
    case 'frigo': B(0.72, 1.85, 0.66, BIANCO); B(0.7, 0.02, 0.02, '#CCD3DB', 0, 1.2, 0.34); B(0.04, 0.4, 0.04, METAL, 0.28, 1.35, 0.35); B(0.04, 0.4, 0.04, METAL, 0.28, 0.7, 0.35); break;
    case 'chitarra': B(0.3, 0.06, 0.3, NERO); S(0.22, '#C9714A', 0, 0.42, 0, 1, 1.25, 0.35); S(0.17, '#C9714A', 0, 0.75, 0, 1, 1.1, 0.35); B(0.06, 0.6, 0.05, LEGNO2, 0, 0.85, 0); break;
    case 'cucina': B(2.8, 0.88, 0.62, BIANCO); B(2.86, 0.06, 0.66, '#5B6475', 0, 0.88, 0); for (const x of [-0.9, -0.55]) for (const z of [-0.12, 0.14]) C(0.11, 0.11, 0.015, NERO, x, 0.94, z); B(0.6, 0.04, 0.4, METAL, 0.6, 0.92, 0); B(2.8, 0.6, 0.35, LEGNO, 0, 1.55, -0.14); break;
    case 'camino': B(1.7, 1.25, 0.55, '#B9B2A6'); B(0.9, 0.7, 0.3, '#2A2420', 0, 0.1, 0.14); C(0.06, 0.22, 0.4, '#FF8A1F', -0.1, 0.12, 0.15, 8, '#FF6A00'); C(0.05, 0.18, 0.32, '#FFC93C', 0.12, 0.12, 0.18, 8, '#FFB300'); B(1.9, 0.1, 0.65, '#9A938A', 0, 1.25, 0); break;
    case 'acquario': B(1.7, 0.7, 0.55, LEGNO2); { const v = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.75, 0.5), new THREE.MeshLambertMaterial({ color: '#6EC6F0', transparent: true, opacity: 0.55 })); v.position.y = 1.08; g.add(v); } for (const [x, y] of [[-0.4, 1.0], [0.2, 1.2], [0.5, 0.95]]) S(0.07, '#FF8A1F', x, y, 0, 1.6, 1, 0.6); B(1.6, 0.06, 0.5, '#E8D8A8', 0, 0.71, 0); break;
    case 'pianoforte': B(1.6, 0.95, 1.4, NERO, 0, 0, -0.1); B(1.5, 0.06, 0.32, BIANCO, 0, 0.72, 0.62); for (let k = 0; k < 9; k++) B(0.06, 0.04, 0.18, NERO, -0.6 + k * 0.15, 0.76, 0.56); B(0.6, 0.45, 0.4, NERO, 0, 0, 0.9); break;
    default: B(0.6, 0.6, 0.6, '#CCCCCC');
  }
  return g;
}

export class Interni {
  constructor(D, ui) {
    this.D = D; this.ui = ui;
    this.elenco = new Set();
    this.aperto = false;
    fetch('api/interni.php?elenco=1').then(r => r.json()).then(j => { if (j.ok) this.elenco = new Set(j.conte); }).catch(() => {});
  }
  ha(conta) { return this.elenco.has(conta); }
  get cfg() { return this.ui.conto?.cfg ?? {}; }
  mio(conta) { return this.ui.conto?.p?.conta === conta; }
  possiede(item) { return (this.ui.conto?.p?.oggetti ?? []).includes(item); }
  libero(t) { const m = (this.cfg.mobili ?? []).find(x => x.id === t); return m && (m.prezzo === 0 || this.possiede(`mob_${t}`)); }

  // ---------- comprar a casa con interni (cartão da casa em ui.js) ----------
  async compraCasa(conta) {
    const conto = this.ui.conto, prezzo = this.cfg.interni?.prezzo ?? 990;
    if (!conto?.p) { conto?.apri(); return; }
    if ((conto.p.saldo ?? 0) < prezzo) { this.ui.aviso(`Ti mancano ${n(prezzo - conto.p.saldo)} 💰 per la casa con interni.`); conto.apri(); return; }
    if (!confirm(`Comprare la casa con interni per ${n(prezzo)} 💰?\nPotrai arredarla e tutti potranno visitarla.`)) return;
    try { conto.p = (await conto.api('compra', { item: 'interni' })).profilo; conto.desenharBotao(); this.ui.aviso('🔑 Casa con interni sbloccata!'); this.apri(conta); }
    catch (e) { this.ui.aviso(e.message); }
  }

  // ---------- abrir / fechar ----------
  async apri(conta) {
    const casa = this.D.porConta.get(conta); if (!casa) return;
    this.conta = conta; this.edita = this.mio(conta) && this.possiede('interni');
    [this.W, this.Dd] = dimensioni(casa.livello);
    let dati = null;
    try { const j = await (await fetch(`api/interni.php?conta=${encodeURIComponent(conta)}&t=${Date.now()}`)).json(); if (j.ok) dati = j.interno; } catch { /* offline */ }
    if (!dati && !this.edita) { this.ui.aviso('Questa casa non è ancora arredata.'); return; }
    this.dati = dati ?? this.primaVolta();
    this.sujo = !dati;   // casa nova: já tem móveis de presente para salvar
    this.sel = null;
    this.montarDOM();
    this.seleziona(null);
    this.montarCena();
    this.ui.fechar();
    this.aperto = true;
    this.el.hidden = false;
    document.body.classList.add('interni-on');
    this.desenharBarra();
    this._raf = requestAnimationFrame(t => this.loop(t));
  }
  primaVolta() {
    const W = this.W, D = this.Dd;
    return { pav: 'legno', par: 0, ogg: [['pianta', 0, 0, 0], ['letto', W - 2, 0, 0], ['divano', 0, 2, 1], ['tavolo', 2, D - 2, 0], ['sedia', 2, D - 1, 2]] };
  }
  chiudi(forza = false) {
    if (this.sujo && this.edita && !forza) this.salvaSubito();   // salva o que faltar antes de sair (não perde nada)
    clearTimeout(this._auto);
    this.aperto = false;
    cancelAnimationFrame(this._raf);
    this.el.hidden = true;
    document.body.classList.remove('interni-on');
  }

  montarDOM() {
    if (!this.el) {
      const d = document.createElement('div');
      d.id = 'interni'; d.hidden = true;
      d.innerHTML = `<canvas></canvas>
        <div class="in-topo"><span class="in-titolo"></span><button type="button" class="in-salva" hidden>💾 Salva</button><button type="button" class="in-esci">✕</button></div>
        <div class="in-sel" hidden><button type="button" data-in="ruota">↻ Ruota</button><button type="button" data-in="togli">🗑️ Togli</button><button type="button" data-in="ok">✓</button></div>
        <div class="in-dica"></div>
        <div class="in-barra"></div>`;
      document.body.appendChild(d);
      this.el = d; this.cv = d.querySelector('canvas');
      d.querySelector('.in-esci').onclick = () => this.chiudi();
      d.querySelector('.in-salva').onclick = () => this.salva();
      d.querySelector('.in-sel').addEventListener('click', e => { const b = e.target.closest('[data-in]'); if (b) this.azioneSel(b.dataset.in); });
      d.querySelector('.in-barra').addEventListener('click', e => this.cliqueBarra(e));
      this.ligarPonteiro();
      addEventListener('resize', () => { if (this.aperto) this.redimensionar(); });
      addEventListener('pagehide', () => { if (this.aperto) this.salvaSubito(); });
      document.addEventListener('visibilitychange', () => { if (document.hidden && this.aperto) this.salvaSubito(); });
    }
    this.el.querySelector('.in-titolo').textContent = `🏠 Casa di @${this.conta}`;
    this.el.querySelector('.in-salva').hidden = !this.edita;
    this.el.querySelector('.in-dica').textContent = this.edita ? 'Tocca un mobile per spostarlo · trascina il vuoto per girare la stanza' : 'Trascina per girare la stanza';
  }

  // ---------- cena ----------
  montarCena() {
    if (!this.r) {
      this.r = new THREE.WebGLRenderer({ canvas: this.cv, antialias: true });
      this.r.setPixelRatio(Math.min(devicePixelRatio, 2));
      this.cam = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
      this.ray = new THREE.Raycaster();
    }
    const s = this.cena = new THREE.Scene();
    s.background = new THREE.Color('#DCEBFF');
    s.add(new THREE.HemisphereLight(0xffffff, 0xb0a48c, 2.2));
    const sol = new THREE.DirectionalLight(0xfff1dc, 1.6); sol.position.set(4, 8, 5); s.add(sol);
    const W = this.W, D = this.Dd;
    const pav = (this.cfg.interni?.pavimenti ?? []).find(p => p[0] === this.dati.pav) ?? ['legno', '', '#C8955C'];
    const par = (this.cfg.interni?.pareti ?? ['#FFF6E6'])[this.dati.par] ?? '#FFF6E6';
    const box = (w, h, d, c, x, y, z) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshLambertMaterial({ color: c })); m.position.set(x, y, z); s.add(m); return m; };
    this.pavimento = box(W, 0.12, D, pav[2], 0, -0.06, 0);
    // listras do piso de madeira / quadrados dos ladrilhos
    if (['legno', 'noce'].includes(pav[0])) for (let k = 1; k < D * 2; k++) box(W, 0.005, 0.015, new THREE.Color(pav[2]).multiplyScalar(0.88).getStyle(), 0, 0.002, -D / 2 + k * 0.5);
    else if (['piastrelle', 'marmo', 'cotto'].includes(pav[0])) { for (let k = 1; k < W; k++) box(0.02, 0.005, D, new THREE.Color(pav[2]).multiplyScalar(0.85).getStyle(), -W / 2 + k, 0.002, 0); for (let k = 1; k < D; k++) box(W, 0.005, 0.02, new THREE.Color(pav[2]).multiplyScalar(0.85).getStyle(), 0, 0.002, -D / 2 + k); }
    const HP = 2.7;
    this.muri = [box(W + 0.15, HP, 0.15, par, -0.075, HP / 2, -D / 2 - 0.075), box(0.15, HP, D, par, -W / 2 - 0.075, HP / 2, 0)];
    box(W, 0.12, 0.04, '#FFFFFF', 0, 0.06, -D / 2 + 0.02); box(0.04, 0.12, D, '#FFFFFF', -W / 2 + 0.02, 0.06, 0);   // rodapé
    // janela no fundo, porta à esquerda
    box(1.4, 1.1, 0.04, '#FFFFFF', W / 2 - 1.4, 1.55, -D / 2 + 0.01); box(1.24, 0.94, 0.05, '#9ED1F2', W / 2 - 1.4, 1.55, -D / 2 + 0.012);
    box(0.04, 2.0, 0.95, '#7A4A2A', -W / 2 + 0.01, 1.0, D / 2 - 1.0); box(0.06, 0.08, 0.08, '#FFC93C', -W / 2 + 0.04, 1.0, D / 2 - 0.65);
    // grade (só editando)
    const gp = []; for (let k = 0; k <= W; k++) gp.push(-W / 2 + k, 0.01, -D / 2, -W / 2 + k, 0.01, D / 2); for (let k = 0; k <= D; k++) gp.push(-W / 2, 0.01, -D / 2 + k, W / 2, 0.01, -D / 2 + k);
    const gg = new THREE.BufferGeometry(); gg.setAttribute('position', new THREE.Float32BufferAttribute(gp, 3));
    this.griglia = new THREE.LineSegments(gg, new THREE.LineBasicMaterial({ color: '#152033', transparent: true, opacity: 0.12 }));
    this.griglia.visible = this.edita; s.add(this.griglia);
    // marcador da seleção
    this.marca = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color: '#FFC93C', transparent: true, opacity: 0.55, depthWrite: false }));
    this.marca.rotation.x = -Math.PI / 2; this.marca.position.y = 0.015; this.marca.visible = false; s.add(this.marca);
    // móveis
    this.ogg = this.dati.ogg.filter(o => PEG[o[0]]).map(([t, x, z, r]) => this.nuovo(t, x, z, r));
    this.yaw = 0.72; this.alt = 0.8;
    this.redimensionar();
  }
  nuovo(t, x, z, r) {
    const o = { t, x, z, r, m: modello(t) };
    o.m.traverse(k => { k.userData.o = o; });
    this.cena.add(o.m); this.posiziona(o);
    return o;
  }
  peg(o) { const [w, d] = PEG[o.t]; return o.r % 2 ? [d, w] : [w, d]; }
  posiziona(o) {
    const [w, d] = this.peg(o), W = this.W, D = this.Dd;
    if (PEG[o.t][2] === 'muro') { o.z = 0; o.r = 0; o.m.position.set(o.x + 0.5 - W / 2, 0, -D / 2 + 0.05); o.m.rotation.y = 0; return; }
    o.m.position.set(o.x + w / 2 - W / 2, PEG[o.t][2] === 'piano' ? 0 : 0.001, o.z + d / 2 - D / 2);
    o.m.rotation.y = o.r * Math.PI / 2;   // r=1 olha para +x (para dentro, encostado na parede da esquerda)
  }
  cabe(o, x, z, r) {
    const [w0, d0] = PEG[o.t], [w, d] = r % 2 ? [d0, w0] : [w0, d0];
    if (x < 0 || z < 0 || x + w > this.W || z + d > this.Dd) return false;
    if (PEG[o.t][2]) return true;   // tapete e quadro não ocupam lugar
    for (const p of this.ogg) {
      if (p === o || PEG[p.t][2]) continue;
      const [pw, pd] = this.peg(p);
      if (x < p.x + pw && x + w > p.x && z < p.z + pd && z + d > p.z) return false;
    }
    return true;
  }
  redimensionar() {
    const w = innerWidth, h = innerHeight;
    this.r.setSize(w, h, false); this.cam.aspect = w / h;
    this.raggio = Math.max(this.W, this.Dd) * (w < h ? 2.75 : 1.9);
    this.cam.updateProjectionMatrix();
  }
  loop() {
    if (!this.aperto) return;
    const c = this.cam, R = this.raggio;
    c.position.set(Math.sin(this.yaw) * R * Math.cos(this.alt), R * Math.sin(this.alt), Math.cos(this.yaw) * R * Math.cos(this.alt));
    c.lookAt(0, 0.6, w0(this.Dd));
    if (this.sel) { const [w, d] = this.peg(this.sel); this.marca.visible = true; this.marca.scale.set(w, d, 1); this.marca.position.x = this.sel.m.position.x; this.marca.position.z = PEG[this.sel.t][2] === 'muro' ? -this.Dd / 2 + 0.5 : this.sel.m.position.z; }
    else this.marca.visible = false;
    this.r.render(this.cena, c);
    this._raf = requestAnimationFrame(t => this.loop(t));
  }

  // ---------- toque: escolher, arrastar, girar ----------
  ligarPonteiro() {
    const cv = this.cv, dedos = new Map();
    let arr = null, pinca = null;
    const pick = (x, y) => {
      this.ray.setFromCamera({ x: x / innerWidth * 2 - 1, y: -y / innerHeight * 2 + 1 }, this.cam);
      const hs = this.ray.intersectObjects(this.ogg.map(o => o.m), true);
      return hs.length ? hs[0].object.userData.o : null;
    };
    const chao = (x, y) => {
      this.ray.setFromCamera({ x: x / innerWidth * 2 - 1, y: -y / innerHeight * 2 + 1 }, this.cam);
      const p = new THREE.Vector3(); return this.ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), p) ? p : null;
    };
    cv.addEventListener('pointerdown', e => {
      cv.setPointerCapture(e.pointerId); dedos.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (dedos.size === 2) { const [a, b] = [...dedos.values()]; pinca = { d0: Math.hypot(a.x - b.x, a.y - b.y), r0: this.raggio }; arr = null; return; }
      const o = this.edita ? pick(e.clientX, e.clientY) : null;
      arr = { x0: e.clientX, y0: e.clientY, x: e.clientX, mov: false, o, giro: !o };
      if (o) { this.seleziona(o); const [w, d] = this.peg(o); const p = chao(e.clientX, e.clientY); arr.off = p ? [p.x - (o.x - this.W / 2 + w / 2), p.z - (o.z - this.Dd / 2 + d / 2)] : [0, 0]; }
    });
    cv.addEventListener('pointermove', e => {
      if (!dedos.has(e.pointerId)) return;
      dedos.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pinca && dedos.size >= 2) { const [a, b] = [...dedos.values()]; this.raggio = clamp(pinca.r0 * pinca.d0 / Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)), 3, 30); return; }
      if (!arr) return;
      if (Math.hypot(e.clientX - arr.x0, e.clientY - arr.y0) > 6) arr.mov = true;
      if (arr.giro) { this.yaw = clamp(this.yaw - (e.clientX - arr.x) * 0.006, 0.12, 1.45); arr.x = e.clientX; return; }
      const p = chao(e.clientX, e.clientY); if (!p || !arr.mov) return;
      const o = arr.o, [w, d] = this.peg(o);
      const x = Math.round(p.x - arr.off[0] + this.W / 2 - w / 2), z = Math.round(p.z - arr.off[1] + this.Dd / 2 - d / 2);
      if ((x !== o.x || z !== o.z) && this.cabe(o, x, z, o.r)) { o.x = x; o.z = z; this.posiziona(o); this.modificato(); }
    });
    const fim = e => {
      if (!dedos.has(e.pointerId)) return;
      dedos.delete(e.pointerId);
      if (arr && !arr.mov && arr.giro && this.edita) this.seleziona(null);
      arr = null; if (dedos.size < 2) pinca = null;
    };
    cv.addEventListener('pointerup', fim); cv.addEventListener('pointercancel', fim);
    cv.addEventListener('wheel', e => { e.preventDefault(); this.raggio = clamp(this.raggio * Math.exp(e.deltaY * 0.001), 3, 30); }, { passive: false });
  }
  seleziona(o) {
    this.sel = o;
    this.el.querySelector('.in-sel').hidden = !o;
  }
  azioneSel(a) {
    const o = this.sel; if (!o) return;
    if (a === 'ok') return this.seleziona(null);
    if (a === 'togli') { this.cena.remove(o.m); this.ogg = this.ogg.filter(p => p !== o); this.seleziona(null); this.modificato(); return; }
    if (a === 'ruota') {
      for (let k = 1; k <= 4; k++) { const r = (o.r + k) % 4; if (this.cabe(o, o.x, o.z, r)) { o.r = r; this.posiziona(o); this.modificato(); return; } }
      this.ui.aviso('Non c’è spazio per girarlo qui.');
    }
  }
  // salvar sozinho: 2 s depois da última mudança (o botão 💾 continua para quem quiser)
  modificato() {
    this.sujo = true; this._ver = (this._ver ?? 0) + 1;
    this.el.querySelector('.in-salva').classList.add('on');
    clearTimeout(this._auto);
    if (this.edita) this._auto = setTimeout(() => this.salva(true), 2000);
  }
  // fechando a aba/o site com mudança pendente: envia na hora (sendBeacon sobrevive ao fechamento)
  salvaSubito() {
    if (!this.edita || !this.sujo) return;
    clearTimeout(this._auto);
    this.dati.ogg = this.ogg.map(o => [o.t, o.x, o.z, o.r]);
    const corpo = new Blob([JSON.stringify({ a: 'salva', interno: this.dati })], { type: 'application/json' });
    if (navigator.sendBeacon?.('api/interni.php', corpo)) { this.sujo = false; this.elenco.add(this.conta); }
    else this.salva(true);
  }

  // ---------- barra de baixo: móveis e cores ----------
  desenharBarra() {
    const b = this.el.querySelector('.in-barra'), cfg = this.cfg;
    if (!this.edita) {
      const tem = this.possiede('interni');
      b.innerHTML = `<div class="in-visita">👀 Stai visitando la casa di <b>@${esc(this.conta)}</b>${tem ? '' : `<button type="button" data-in="miacasa">🔑 Arreda la tua · ${n(cfg.interni?.prezzo ?? 990)} 💰</button>`}</div>`;
      return;
    }
    const tab = this.tab ?? 'mobili';
    const mob = (cfg.mobili ?? []).map(m => {
      const ok = this.libero(m.id);
      return `<button type="button" class="in-mob${ok ? '' : ' lock'}" data-mob="${m.id}"><span>${m.icona}</span><b>${esc(m.nome)}</b>${ok ? '' : `<em>🔒 ${n(m.prezzo)} 💰</em>`}</button>`;
    }).join('');
    const pav = (cfg.interni?.pavimenti ?? []).map(([id, nome, c]) => `<button type="button" class="in-sw${this.dati.pav === id ? ' on' : ''}" data-pav="${id}" style="background:${c}" title="${esc(nome)}"></button>`).join('');
    const par = (cfg.interni?.pareti ?? []).map((c, i) => `<button type="button" class="in-sw${this.dati.par === i ? ' on' : ''}" data-par="${i}" style="background:${c}"></button>`).join('');
    b.innerHTML = `<div class="in-tabs"><button type="button" data-tab="mobili" class="${tab === 'mobili' ? 'on' : ''}">🛋️ Mobili</button><button type="button" data-tab="colori" class="${tab === 'colori' ? 'on' : ''}">🎨 Pavimento e pareti</button><span class="in-saldo">💰 ${n(this.ui.conto?.p?.saldo ?? 0)}</span></div>
      ${tab === 'mobili' ? `<div class="in-lista">${mob}</div>` : `<div class="in-col"><small>Pavimento</small><div>${pav}</div><small>Pareti</small><div>${par}</div></div>`}`;
  }
  async cliqueBarra(e) {
    const t = e.target.closest('button'); if (!t) return;
    const d = t.dataset;
    if (d.tab) { this.tab = d.tab; this.desenharBarra(); return; }
    if (d.in === 'miacasa') { const mia = this.ui.conto?.p?.conta; this.chiudi(true); if (mia) this.ui.casa(this.D.porConta.get(mia)); else this.ui.conto?.apri(); return; }
    if (d.pav) { this.dati.pav = d.pav; this.ricostruisci(); return; }
    if (d.par) { this.dati.par = +d.par; this.ricostruisci(); return; }
    if (d.mob) {
      const m = (this.cfg.mobili ?? []).find(x => x.id === d.mob);
      if (!this.libero(m.id)) return this.compraMobile(m);
      // coloca no primeiro lugar livre perto do meio
      const o = { t: m.id, x: 0, z: 0, r: 0 };
      const celle = []; for (let z = 0; z < this.Dd; z++) for (let x = 0; x < this.W; x++) celle.push([Math.hypot(x - this.W / 2, z - this.Dd / 2), x, z]);
      celle.sort((a, b) => a[0] - b[0]);
      const c = celle.find(([, x, z]) => this.cabe(o, x, z, 0) || this.cabe(o, x, z, 1));
      if (!c) return this.ui.aviso('La stanza è piena: togli qualcosa prima.');
      const r = this.cabe(o, c[1], c[2], 0) ? 0 : 1;
      const novo = this.nuovo(m.id, c[1], c[2], r); this.ogg.push(novo); this.seleziona(novo); this.modificato();
    }
  }
  async compraMobile(m) {
    const conto = this.ui.conto;
    if ((conto.p.saldo ?? 0) < m.prezzo) return this.ui.aviso(`Ti mancano ${n(m.prezzo - conto.p.saldo)} 💰 per ${m.nome}.`);
    if (!confirm(`Comprare ${m.nome} per ${n(m.prezzo)} 💰?`)) return;
    try { conto.p = (await conto.api('compra', { item: `mob_${m.id}` })).profilo; conto.desenharBotao(); this.ui.aviso(`${m.icona} ${m.nome} è tuo!`); this.desenharBarra(); }
    catch (e) { this.ui.aviso(e.message); }
  }
  ricostruisci() {
    this.dati.ogg = this.ogg.map(o => [o.t, o.x, o.z, o.r]);
    const sel = this.sel ? this.ogg.indexOf(this.sel) : -1, yaw = this.yaw, rg = this.raggio;
    this.montarCena(); this.yaw = yaw; this.raggio = rg;
    if (sel >= 0) this.seleziona(this.ogg[sel]);
    this.modificato(); this.desenharBarra();
  }
  async salva(auto = false) {
    clearTimeout(this._auto);
    if (this._salvando) { this._dinovo = true; return; }   // já tem um salvamento a caminho: salva de novo no fim
    this._salvando = true;
    const v = this._ver, bt = this.el.querySelector('.in-salva'), prima = !this.elenco.has(this.conta);
    this.dati.ogg = this.ogg.map(o => [o.t, o.x, o.z, o.r]);
    bt.textContent = '⏳ Salvo…';
    try {
      const r = await fetch('api/interni.php', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ a: 'salva', interno: this.dati }) });
      const j = await r.json();
      if (!j.ok) throw new Error(j.erro || 'Errore nel salvataggio.');
      if (this._ver === v) { this.sujo = false; bt.classList.remove('on'); }
      this.elenco.add(this.conta);
      bt.textContent = '✅ Salvata';
      clearTimeout(this._bt); this._bt = setTimeout(() => { bt.textContent = '💾 Salva'; }, 1800);
      if (!auto || prima) this.ui.aviso('💾 Casa salvata! Ora tutti possono visitarla.');
    } catch (e) { bt.textContent = '💾 Salva'; this.ui.aviso(e.message || 'Connessione assente.'); }
    this._salvando = false;
    if (this._dinovo) { this._dinovo = false; if (this.sujo) this.salva(true); }
  }
}
const w0 = D => 0;   // centro do olhar (fica aqui para ajustar se o cômodo crescer para trás)
