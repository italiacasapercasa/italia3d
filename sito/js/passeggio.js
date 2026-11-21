// Passeggiata: andar a pé pela cidade, na própria cena do mapa (mesmas casas, lojas, outdoors e decorações).
// Câmera em 3ª pessoa atrás de um bonequinho; anda só nas ruas e calçadas (o miolo das quadras é bloqueado, a piazza é livre).
// Celular: metade esquerda = joystick (aparece onde o dedo toca), metade direita = arrastar gira a câmera, toque abre o cartão.
// PC: WASD/setas andam (Shift corre), arrastar o mouse gira, clique abre o cartão, Esc sai.
// Grátis para quem tem conta (js/conto.js). Ligado em mappa.js (mappa.passeggio recebe os eventos e o passo de cada quadro).
import * as THREE from 'three';
import { LOTE, RUA, QW, QH, posLote } from './citta.js';
import { ALTURA_NIVEL } from './modelli.js';
import { costruisci, animaAcc } from './personaggio.js';
import { VEICOLI, SEDUTO, costruisciVeicolo } from './veicoli.js';
import { Tesori } from './tesori.js';

const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const CALCADA = 0.006;
const H = LOTE * 0.3;                 // altura do bonequinho
const VEL = LOTE * 1.7;               // km/s andando (correndo: x1,9)
const CAM_DIST = LOTE * 1.8, CAM_ALT = LOTE * 0.7;
export class Passeggio {
  constructor(D, mappa, citta, ui) {
    this.D = D; this.mappa = mappa; this.citta = citta; this.ui = ui;
    this.ativo = false;
    this.teclas = new Set();
    this.joy = { id: null, x0: 0, y0: 0, x: 0, y: 0 };
    this.giro = null;            // dedo/mouse girando a câmera
    this.montarUI();
    this.tesori = new Tesori(this);
    addEventListener('keydown', e => {
      if (!this.ativo || /input|textarea/i.test(e.target.tagName)) return;
      const k = e.key.toLowerCase();
      if (k === 'escape') return this.esci();
      if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'shift'].includes(k)) { this.teclas.add(k); e.preventDefault(); }
    });
    addEventListener('keyup', e => this.teclas.delete(e.key.toLowerCase()));
    addEventListener('blur', () => this.teclas.clear());
  }

  montarUI() {
    const d = document.createElement('div');
    d.id = 'passeggio';
    d.hidden = true;
    d.innerHTML = `
      <div class="ps-topo"><span class="ps-titolo">🚶 <b></b></span><button type="button" class="ps-esci" aria-label="Esci dalla passeggiata">✕ Esci</button></div>
      <div class="ps-et"></div>
      <div class="ps-joy"><i></i></div>
      <div class="ps-dica"></div>
      <div class="ps-bordo"></div>
      <div class="ps-menu"></div>
      <div class="ps-azioni"><button type="button" class="ps-strada">🛣️ Strada</button><button type="button" class="ps-mezzo">🚶 A piedi</button><button type="button" class="ps-pg">🧍 Personaggio</button><button type="button" class="ps-casa" hidden>🏠 La mia casa</button></div>`;
    document.body.appendChild(d);
    this.el = d;
    d.querySelector('.ps-esci').onclick = () => this.esci();
    d.querySelector('.ps-mezzo').onclick = () => this.menuMezzi();
    d.querySelector('.ps-strada').onclick = () => this.menuStrade();
    d.querySelector('.ps-menu').onclick = e => this.cliqueMenu(e);
    d.querySelector('.ps-pg').onclick = () => this.ui.conto?.editor.apri();
    d.querySelector('.ps-casa').onclick = () => { const c = this.D.porConta.get(this.ui.conto?.p?.conta); if (c) this.avvia(`casa:${c.conta}`); };
  }

  // (re)monta o bonequinho com o personagem salvo na conta
  aggiornaOmino() {
    const pg = this.ui.conto?.p?.pg, k = JSON.stringify(pg ?? null);
    if (this.omino && this._pgk === k) { if (this.ativo) this.omino.visible = true; return; }
    if (this.omino) { this.mappa.scene.remove(this.omino); this.omino.traverse(o => o.geometry?.dispose()); }
    this._pgk = k;
    this.omino = costruisci(pg, H);
    this.omino.visible = this.ativo;
    if (this.pos) { this.omino.position.copy(this.pos); this.omino.rotation.y = this.dir; }
    this.mappa.scene.add(this.omino);
    this.aggiornaMezzo();
  }

  // ---------- veículos (bici/Vespa/auto comprados com crediti) ----------
  posseduti() { const o = this.ui.conto?.p?.oggetti ?? []; return VEICOLI.filter(v => o.includes(v)); }
  infoMezzo(id) { return (this.ui.conto?.cfg?.catalogo ?? []).find(x => x.id === id); }
  velocita() { return this.mezzoId ? (this.infoMezzo(this.mezzoId)?.velocita ?? 2) : 1; }
  aggiornaMezzo() {
    let id = this.mezzoId ?? (() => { try { return localStorage.getItem('ps_mezzo'); } catch { return null; } })();
    if (!this.posseduti().includes(id)) id = null;
    if (this.mezzo && this._mezzoK !== id) { this.mappa.scene.remove(this.mezzo); this.mezzo.traverse(o => o.geometry?.dispose()); this.mezzo = null; }
    this.mezzoId = id;
    if (id && !this.mezzo) { this._mezzoK = id; this.mezzo = costruisciVeicolo(id, H); this.mappa.scene.add(this.mezzo); }
    if (this.mezzo) this.mezzo.visible = this.ativo;
    const info = id && this.infoMezzo(id), bt = this.el.querySelector('.ps-mezzo');
    bt.textContent = info ? `${info.icona} ${info.nome.split(' ')[0]}` : '🚶 A piedi';
  }
  scegliMezzo(id) {
    this.mezzoId = id || null;
    try { localStorage.setItem('ps_mezzo', id || ''); } catch { /* sem storage */ }
    this.aggiornaMezzo();
    this.chiudiMenu();
    if (id) this.dica(`${this.infoMezzo(id).icona} ${String(this.velocita()).replace('.', ',')}× più veloce · 🛣️ Strada per andare nelle città vicine`, 4000);
  }
  menu(html) { const m = this.el.querySelector('.ps-menu'); m.innerHTML = `<button type="button" class="ps-menu-x" data-m="chiudi">✕</button>${html}`; m.classList.add('on'); }
  chiudiMenu() { this.el.querySelector('.ps-menu').classList.remove('on'); }
  menuMezzi() {
    const own = this.posseduti(), n = v => Number(v).toLocaleString('it-IT');
    const righe = VEICOLI.map(id => {
      const x = this.infoMezzo(id); if (!x) return '';
      const ho = own.includes(id);
      return `<button type="button" class="ps-opz${this.mezzoId === id ? ' on' : ''}" data-m="${ho ? 'usa' : 'compra'}" data-v="${id}"><span>${x.icona}</span><b>${x.nome}</b><small>${String(x.velocita).replace('.', ',')}× · ${ho ? (this.mezzoId === id ? '✅ in uso' : 'tuo') : `${n(x.prezzo)} 💰`}</small></button>`;
    }).join('');
    this.menu(`<h4>Come ti muovi?</h4><button type="button" class="ps-opz${!this.mezzoId ? ' on' : ''}" data-m="usa" data-v=""><span>🚶</span><b>A piedi</b><small>gratis</small></button>${righe}
      <p>Con un veicolo vai più veloce e prendi la 🛣️ strada per le città vicine. Comprato una volta, è tuo per sempre.</p>`);
  }
  async cliqueMenu(e) {
    const b = e.target.closest('button'); if (!b) return;
    const { m, v } = b.dataset;
    if (m === 'chiudi') return this.chiudiMenu();
    if (m === 'usa') return this.scegliMezzo(v);
    if (m === 'compra') { const x = this.infoMezzo(v); if (await this.ui.conto.compra(v, x.nome, x.prezzo, `${String(x.velocita).replace('.', ',')}× più veloce e la strada per le città vicine.`)) this.scegliMezzo(v); return; }
    if (m === 'vai') { const l = this.D.luoghi[+v]; if (l) this.parti(l); return; }
    if (m === 'salta' && this.viaggio) { this.viaggio.t0 -= this.viaggio.dur * 1000; return; }
    if (m === 'mezzi') return this.menuMezzi();
  }

  // ---------- estradas para as cidades vizinhas ----------
  vicine(l, max = 5) {
    const mp = this.mappa, out = [];
    for (const o of this.D.luoghi) {
      if (o === l) continue;
      const d = Math.hypot(o.x - l.x, o.z - l.z);
      if (d < 0.8 || d > 45) continue;
      out.push([d, o]);
    }
    out.sort((a, b) => a[0] - b[0]);
    const ok = [];
    for (const [d, o] of out) {   // sem atravessar o mar
      let mar = 0;
      for (let k = 1; k < 12; k++) { const t = k / 12; if (mp.altura(l.x + (o.x - l.x) * t, l.z + (o.z - l.z) * t) < 0.002) mar++; }
      if (mar <= 1) ok.push([d, o]);
      if (ok.length >= max) break;
    }
    return ok;
  }
  menuStrade() {
    if (this.viaggio) return;
    const v = this.vicine(this.l);
    if (!v.length) return this.menu(`<h4>🛣️ Strade</h4><p>Da ${esc(this.l.nome)} non ci sono città vicine raggiungibili in strada.</p>`);
    const lista = v.map(([d, o]) => `<button type="button" class="ps-opz" data-m="vai" data-v="${o.id}"><span>🏘️</span><b>${esc(o.nome)}</b><small>${d < 10 ? d.toFixed(1).replace('.', ',') : Math.round(d)} km · ${o.case} ${o.case === 1 ? 'casa' : 'case'}</small></button>`).join('');
    if (!this.mezzoId) return this.menu(`<h4>🛣️ Strade da ${esc(this.l.nome)}</h4>${lista.replace(/data-m="vai"/g, 'data-m="mezzi" disabled')}
      <p>🚲 Per prendere la strada ti serve un veicolo (la bici costa ${this.infoMezzo('bici')?.prezzo ?? 190} 💰).</p><button type="button" class="ps-cta" data-m="mezzi">🚲 Scegli un veicolo</button>`);
    this.menu(`<h4>🛣️ Strade da ${esc(this.l.nome)}</h4>${lista}`);
  }
  parti(dest) {
    const A = this.l, mp = this.mappa, dx = dest.x - A.x, dz = dest.z - A.z, D = Math.hypot(dx, dz), ux = dx / D, uz = dz / D;
    const rA = this.citta.raioCidade(A), rB = this.citta.raioCidade(dest), hA = this.hc, hB = this.citta.dadosCidade(dest).hc;
    const p0 = { x: A.x + ux * rA * 0.9, z: A.z + uz * rA * 0.9 }, p1 = { x: dest.x - ux * rB * 0.9, z: dest.z - uz * rB * 0.9 };
    const L = Math.max(0.2, Math.hypot(p1.x - p0.x, p1.z - p0.z)), N = Math.max(24, Math.ceil(L / 0.03));
    const ys = [];
    for (let i = 0; i <= N; i++) {
      const t = i / N, x = p0.x + (p1.x - p0.x) * t, z = p0.z + (p1.z - p0.z) * t, h = mp.altura(x, z);
      const wA = clamp(1 - t * L / 0.7, 0, 1), wB = clamp(1 - (1 - t) * L / 0.7, 0, 1);
      ys.push(Math.max(h, h + (hA - h) * wA + (hB - h) * wB) + 0.0012);
    }
    // nastro della strada (asfalto + linea tratteggiata)
    const px = -uz, pz = ux, w = RUA * 0.42, pos = [], col = [], c1 = new THREE.Color('#7E8794'), c2 = new THREE.Color('#FFFFFF');
    const quad = (i, a, b, c, dy) => { const t0 = i / N, t1 = (i + 1) / N; const P = (t, s, y) => [p0.x + (p1.x - p0.x) * t + px * s, y + dy, p0.z + (p1.z - p0.z) * t + pz * s];
      const v = [P(t0, -a, ys[i]), P(t0, a, ys[i]), P(t1, a, ys[i + 1]), P(t0, -a, ys[i]), P(t1, a, ys[i + 1]), P(t1, -a, ys[i + 1])];
      for (const q of v) { pos.push(...q); col.push(c.r, c.g, c.b); } };
    for (let i = 0; i < N; i++) { quad(i, w, 0, c1, 0); if (i % 2 === 0) quad(i, w * 0.06, 0, c2, 0.0004); }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pos), 3));
    geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(col), 3));
    geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }));
    // alberi e cipressi lungo la strada (sempre uguali per la stessa strada)
    let seme = Math.abs(Math.round(A.x * 1000 + dest.z * 777)) || 1;
    const rnd = () => { seme = (seme * 16807) % 2147483647; return seme / 2147483647; };
    const geoC = new THREE.ConeGeometry(LOTE * 0.16, LOTE * 0.75, 7); geoC.translate(0, LOTE * 0.375 + LOTE * 0.05, 0);
    const geoT = new THREE.CylinderGeometry(LOTE * 0.03, LOTE * 0.03, LOTE * 0.1, 5); geoT.translate(0, LOTE * 0.05, 0);
    const geoO = new THREE.IcosahedronGeometry(LOTE * 0.22, 0); geoO.translate(0, LOTE * 0.3, 0);
    const M = Math.min(900, Math.ceil(L / 0.025));
    const ic = new THREE.InstancedMesh(geoC, new THREE.MeshLambertMaterial({ color: '#2F6B3A', flatShading: true }), M);
    const io = new THREE.InstancedMesh(geoO, new THREE.MeshLambertMaterial({ color: '#7A9A4A', flatShading: true }), M);
    const it = new THREE.InstancedMesh(geoT, new THREE.MeshLambertMaterial({ color: '#6B4A2A' }), M * 2);
    const mt = new THREE.Matrix4(); let nc = 0, no = 0, nt = 0;
    for (let k = 0; k < M; k++) {
      const t = (k + rnd()) / M, lato = rnd() < 0.5 ? -1 : 1, off = lato * (RUA * 0.9 + rnd() * LOTE * 3);
      const x = p0.x + (p1.x - p0.x) * t + px * off, z = p0.z + (p1.z - p0.z) * t + pz * off, h = mp.altura(x, z);
      if (h < 0.002 || t * L < 0.4 || (1 - t) * L < 0.4) continue;
      const s = 0.8 + rnd() * 0.6; mt.makeScale(s, s, s).setPosition(x, Math.max(h, ys[Math.round(t * N)] - 0.0015), z);
      if (rnd() < 0.55) ic.setMatrixAt(nc++, mt); else io.setMatrixAt(no++, mt);
      it.setMatrixAt(nt++, mt);
    }
    ic.count = nc; io.count = no; it.count = nt;
    for (const x of [ic, io, it]) { x.frustumCulled = false; mesh.add(x); }
    mp.scene.add(mesh);
    const vel = VEL * this.velocita() * 3.2;   // na estrada vai mais rápido que na cidade
    this.viaggio = { p0, p1, ys, N, L, ux, uz, dest, mesh, t0: performance.now(), dur: clamp(L / vel, 6, 22), fatto: 0 };
    this.dir = Math.atan2(ux, uz); this.yaw = this.dir + Math.PI;
    this.menu(`<h4>🛣️ Verso ${esc(dest.nome)}</h4><p>${L < 10 ? L.toFixed(1).replace('.', ',') : Math.round(L)} km in ${this.infoMezzo(this.mezzoId).icona}</p><button type="button" class="ps-cta" data-m="salta">⏩ Arriva subito</button>`);
    this.el.querySelector('.ps-menu').classList.add('basso');
    this.el.classList.add('viaggio');
    this.el.querySelector('.ps-titolo b').textContent = `${A.nome} → ${dest.nome}`;
  }
  passoViaggio(agora) {
    const v = this.viaggio, k = clamp((agora - v.t0) / 1000 / v.dur, 0, 1), s = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
    const f = s * v.N, i = Math.min(v.N - 1, Math.floor(f)), y = v.ys[i] + (v.ys[i + 1] - v.ys[i]) * (f - i);
    const p = this.pos, px = p.x, pz = p.z;
    p.set(v.p0.x + (v.p1.x - v.p0.x) * s + -v.uz * RUA * 0.18, y, v.p0.z + (v.p1.z - v.p0.z) * s + v.ux * RUA * 0.18);   // corsia di destra
    this.hcViaggio = y;
    const passo = Math.hypot(p.x - px, p.z - pz);
    this.fase += passo / (H * 0.55);
    this.vel = 1;
    this.disegnaCorpo(passo);
    // câmera: atrás e um pouco mais alta para ver a paisagem
    const c = this.mappa.camera, sy = -v.ux, cy = -v.uz, d = LOTE * 3.2;
    c.fov = 58; c.position.set(p.x + sy * d, y + LOTE * 1.4, p.z + cy * d);
    c.lookAt(p.x - sy * LOTE * 2, y + H * 0.5, p.z - cy * LOTE * 2);
    c.near = 0.0015; c.far = 12; c.updateProjectionMatrix(); c.updateMatrixWorld(true);
    this.mappa.scene.fog.near = 0.8; this.mappa.scene.fog.far = 4.5;
    this.aggiornaCitta();
    this.el.querySelector('.ps-et').innerHTML = '';
    if (k >= 1) {
      this.mappa.scene.remove(v.mesh); v.mesh.traverse(o => o.geometry?.dispose());
      this.viaggio = null; this.hcViaggio = null; this.el.classList.remove('viaggio');
      this.el.querySelector('.ps-menu').classList.remove('basso'); this.chiudiMenu();
      this.avvia(`luogo:${v.dest.id}`);
      this.ui.aviso(`🏘️ Benvenuto a ${v.dest.nome}!`);
    }
  }

  // ---------- entrar / sair ----------  // alvo: "casa:<conta>" ou "luogo:<id>"
  avvia(alvo) {
    const conto = this.ui.conto;
    if (!conto?.p) { this.ui.aviso('🚶 Entra nel tuo account (è gratis) per passeggiare nella città.'); conto?.apri(); return; }
    if (!conto.p.pg) { conto.editor.apri(() => this.avvia(alvo)); return; }                // 1ª vez: escolhe o personagem
    const [tipo, v] = [alvo.slice(0, alvo.indexOf(':')), alvo.slice(alvo.indexOf(':') + 1)];
    let l, x, z, yaw;
    if (tipo === 'casa') {
      const c = this.D.porConta.get(v); if (!c) return;
      l = this.D.luoghi[c.luogo];
      const p = this.citta.posCasa(c), rot = posLote(c.lote).rot, lado = rot === 0 ? 1 : -1;
      x = p.x; z = p.z + lado * (LOTE * 0.5 + RUA / 2);                                      // na rua, em frente à casa
      yaw = Math.PI / 2 - lado * 0.45; this._dirIni = lado > 0 ? Math.PI : 0;                 // câmera ao longo da rua, casa ao lado
    } else {
      l = this.D.luoghi[+v]; if (!l) return;
      this.citta.dadosCidade(l);
      x = l.x; z = l.z - QH / 2; yaw = Math.PI / 2 + 0.45; this._dirIni = Math.PI;        // na rua da piazza
    }
    this.l = l;
    this.cel = this.celle(l);
    this.hc = this.citta.dadosCidade(l).hc;
    this.pos = new THREE.Vector3(x, this.hc, z);
    this.yaw = yaw; this.pitch = 0.32; this.dir = this._dirIni; this.fase = 0; this.vel = 0;
    this.aggiornaOmino();
    this.ui.fechar();
    if (!this.ativo) {
      this.ativo = true;
      this.camVecchia = { fov: this.mappa.camera.fov, az: this.mappa.az };
      this.mappa.passeggio = this;
      this.mappa.voo = null;
      this.mappa.mar.visible = false;   // o plano gigante do mar perde precisão de perto e cobre a rua (o fundo já tem a cor do mar)
      document.body.classList.add('passeggio');
      this.el.hidden = false;
    }
    this.omino.visible = true;
    this.el.querySelector('.ps-titolo b').textContent = l.nome;
    const mia = this.D.porConta.get(conto.p.conta);
    this.el.querySelector('.ps-casa').hidden = !mia;
    const toque = matchMedia('(pointer: coarse)').matches;
    this.dica(toque ? '👈 Trascina a sinistra per camminare · 👉 a destra per girarti · tocca una casa per vederla' : '⌨️ WASD o frecce per camminare (Shift corre) · trascina per girarti · clicca una casa', 6000);
    this.ultimoAgg = null;
    this.aggiornaCitta(true);
    this.tesori.entra(l);
  }
  esci() {
    if (!this.ativo) return;
    this.ativo = false;
    this.mappa.passeggio = null;
    this.omino.visible = false;
    if (this.mezzo) this.mezzo.visible = false;
    if (this.viaggio) { this.mappa.scene.remove(this.viaggio.mesh); this.viaggio = null; this.hcViaggio = null; this.el.querySelector('.ps-menu').classList.remove('basso'); this.el.classList.remove('viaggio'); }
    this.chiudiMenu();
    this.tesori?.esci();
    document.body.classList.remove('passeggio');
    this.el.hidden = true;
    this.teclas.clear(); this.joy.id = null; this.giro = null;
    const m = this.mappa;
    m.mar.visible = true;
    m.camera.fov = this.camVecchia.fov;
    m.alvo.set(this.pos.x, this.hc, this.pos.z);
    m.az = this.yaw;
    m.dist = 0.5;
    m.atualizarCamera();
    m.voar({ x: this.pos.x, z: this.pos.z, dist: 1.4, az: this.yaw }, 900);
  }

  // ---------- onde se pode andar ----------
  // quadras da cidade (igual citta.js: ruas entre as quadras, meia rua de cada lado)
  celle(l) {
    const s = new Set();
    for (const [i, j] of this.citta.quadreDi(l)) s.add(`${i},${j}`);
    return s;
  }
  livre(x, z) {
    const l = this.l, i = Math.round((x - l.x) / QW), j = Math.round((z - l.z) / QH);
    if (!this.cel.has(`${i},${j}`)) return false;                                  // fora da cidade
    if (i === 0 && j === 0) return true;                                           // piazza
    const dx = Math.abs(x - l.x - i * QW), dz = Math.abs(z - l.z - j * QH);
    const mx = (QW - RUA) / 2 - CALCADA * 0.2, mz = (QH - RUA) / 2 - CALCADA * 0.2;
    return !(dx < mx && dz < mz);                                                  // miolo da quadra (casas)
  }

  // ---------- eventos (mappa.js repassa pointer/wheel do canvas) ----------
  evento(e) {
    if (e.type === 'wheel') { e.preventDefault(); this.pitch = clamp(this.pitch + e.deltaY * 0.0008, -0.05, 0.6); return; }
    const cv = this.mappa.canvas;
    if (e.type === 'pointerdown') {
      cv.setPointerCapture(e.pointerId);
      const toque = e.pointerType !== 'mouse';
      if (toque && e.clientX < innerWidth * 0.45 && this.joy.id === null) {
        Object.assign(this.joy, { id: e.pointerId, x0: e.clientX, y0: e.clientY, x: 0, y: 0 });
        const j = this.el.querySelector('.ps-joy'); j.style.left = `${e.clientX}px`; j.style.top = `${e.clientY}px`; j.classList.add('on');
        return;
      }
      if (!this.giro) this.giro = { id: e.pointerId, x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY, t0: performance.now(), moveu: false };
      return;
    }
    if (e.type === 'pointermove') {
      if (e.pointerId === this.joy.id) {
        const R = 60, dx = e.clientX - this.joy.x0, dy = e.clientY - this.joy.y0, m = Math.hypot(dx, dy), k = m > R ? R / m : 1;
        this.joy.x = dx * k / R; this.joy.y = dy * k / R;
        this.el.querySelector('.ps-joy i').style.transform = `translate(${dx * k}px, ${dy * k}px)`;
        return;
      }
      const g = this.giro;
      if (g && e.pointerId === g.id) {
        if (Math.hypot(e.clientX - g.x0, e.clientY - g.y0) > 8) g.moveu = true;
        this.yaw -= (e.clientX - g.x) * 0.0065;
        this.pitch = clamp(this.pitch + (e.clientY - g.y) * 0.003, -0.05, 0.6);
        g.x = e.clientX; g.y = e.clientY;
      }
      return;
    }
    if (e.type === 'pointerup' || e.type === 'pointercancel') {
      if (e.pointerId === this.joy.id) {
        this.joy.id = null; this.joy.x = this.joy.y = 0;
        const j = this.el.querySelector('.ps-joy'); j.classList.remove('on'); j.querySelector('i').style.transform = '';
        return;
      }
      const g = this.giro;
      if (g && e.pointerId === g.id) {
        this.giro = null;
        if (!g.moveu && e.type === 'pointerup' && performance.now() - g.t0 < 450) this.mappa.aoClique?.(e.clientX, e.clientY);
      }
    }
  }

  dica(txt, ms = 3500) {
    const d = this.el.querySelector('.ps-dica');
    d.textContent = txt; d.classList.add('on');
    clearTimeout(this._dica); this._dica = setTimeout(() => d.classList.remove('on'), ms);
  }

  // cidade e decorações carregam pelo alvo/dist do mapa: acompanha o bonequinho
  aggiornaCitta(forza = false) {
    const m = this.mappa, u = this.ultimoAgg;
    if (!forza && u && Math.hypot(u.x - this.pos.x, u.z - this.pos.z) < 0.25) return;
    this.ultimoAgg = { x: this.pos.x, z: this.pos.z };
    m.alvo.set(this.pos.x, this.hcViaggio ?? this.hc, this.pos.z);
    m.dist = 0.45;
    for (const f of m.aoMover) f();
  }

  // ---------- cada quadro (mappa.loop) ----------
  passo(agora) {
    const dt = Math.min(0.05, (agora - (this._t ?? agora)) / 1000); this._t = agora;
    animaAcc(this.omino, agora);
    if (this.viaggio) return this.passoViaggio(agora);
    // vontade de andar: joystick (y para cima = frente) ou teclado
    let fx = -this.joy.y, rx = this.joy.x;
    const t = this.teclas;
    if (t.has('w') || t.has('arrowup')) fx += 1;
    if (t.has('s') || t.has('arrowdown')) fx -= 1;
    if (t.has('d') || t.has('arrowright')) rx += 1;
    if (t.has('a') || t.has('arrowleft')) rx -= 1;
    const mag = Math.min(1, Math.hypot(fx, rx));
    const sy = Math.sin(this.yaw), cy = Math.cos(this.yaw);
    let mx = 0, mz = 0;
    if (mag > 0.08) {
      const fwx = -sy, fwz = -cy, rgx = cy, rgz = -sy;
      const vx = fwx * fx + rgx * rx, vz = fwz * fx + rgz * rx, n = Math.hypot(vx, vz) || 1;
      const v = VEL * mag * (t.has('shift') ? 1.9 : 1) * this.velocita();
      mx = vx / n * v * dt; mz = vz / n * v * dt;
      // vira o corpo suavemente para onde anda
      const alvoDir = Math.atan2(vx, vz);
      let dd = ((alvoDir - this.dir) % (2 * Math.PI) + 3 * Math.PI) % (2 * Math.PI) - Math.PI;
      this.dir += dd * Math.min(1, dt * 12);
    }
    // colisão: tenta andar; se bater, desliza no eixo que dá
    const p = this.pos, carro = this.mezzoId === 'auto' || this.mezzoId === 'sportiva', r = H * (carro ? 0.55 : this.mezzoId ? 0.35 : 0.25);
    const x0 = p.x, z0 = p.z;
    const ok = (x, z) => this.livre(x + Math.sign(mx) * r, z + Math.sign(mz) * r) && this.livre(x, z);
    if (mx || mz) {
      if (ok(p.x + mx, p.z + mz)) { p.x += mx; p.z += mz; }
      else if (ok(p.x + mx, p.z)) p.x += mx;
      else if (ok(p.x, p.z + mz)) p.z += mz;
      else if (!this.cel.has(`${Math.round((p.x + mx * 8 - this.l.x) / QW)},${Math.round((p.z + mz * 8 - this.l.z) / QH)}`) && !this._avvBordo) {
        this._avvBordo = true; this.mostraBordo();
      }
      this.fase += Math.hypot(mx, mz) / (H * 0.55) / (this.mezzoId ? this.velocita() * 0.6 : 1);
    }
    this.vel += ((mag > 0.08 ? 1 : 0) - this.vel) * Math.min(1, dt * 10);
    this.disegnaCorpo(Math.hypot(p.x - x0, p.z - z0));
    this.tesori?.passo(p, agora);
    // câmera atrás, encolhendo se o ponto cair dentro de uma casa
    const m = this.mappa, c = m.camera, km = carro ? 1.55 : this.mezzoId ? 1.2 : 1;
    const alt = CAM_ALT * km + this.pitch * CAM_DIST * km;
    let d = CAM_DIST * km;
    for (let k = 0; k < 8; k++) { if (this.alturaEm(p.x + sy * d, p.z + cy * d) < alt - LOTE * 0.08) break; d *= 0.8; }   // só prédio mais alto que a câmera empurra
    c.fov = 58;
    c.position.set(p.x + sy * d, this.hc + alt, p.z + cy * d);
    c.lookAt(p.x - sy * LOTE * 0.45, this.hc + H * 0.6, p.z - cy * LOTE * 0.45);
    c.near = 0.0015; c.far = 9;
    c.updateProjectionMatrix(); c.updateMatrixWorld(true);
    m.scene.fog.near = 0.35; m.scene.fog.far = 2.6;
    this.aggiornaCitta();
    this.etichette();
  }

  // boneco a pé, na bici/Vespa (sentado) ou carro (o boneco some)
  disegnaCorpo(andou) {
    const p = this.pos, o = this.omino, a = o.userData, hc = this.hcViaggio ?? this.hc, mz = this.mezzo, id = this.mezzoId;
    o.rotation.y = this.dir;
    if (!mz) {
      const sw = Math.sin(this.fase * Math.PI) * 0.7 * this.vel;
      o.visible = true;
      o.position.set(p.x, hc + 0.0009 + Math.abs(Math.sin(this.fase * Math.PI)) * H * 0.04 * this.vel, p.z);
      a.pe.rotation.x = sw; a.pd.rotation.x = -sw; a.be.rotation.x = -sw * 0.8; a.bd.rotation.x = sw * 0.8;
      return;
    }
    mz.visible = true;
    mz.position.set(p.x, hc + 0.0009, p.z); mz.rotation.y = this.dir;
    for (const r of mz.userData.ruote) r.rotation.x += andou / mz.userData.raggio;
    const sed = SEDUTO[id];
    o.visible = !!sed;
    if (sed) {
      o.position.set(p.x + Math.sin(this.dir) * sed.z * H, hc + 0.0009 + sed.y * H, p.z + Math.cos(this.dir) * sed.z * H);
      const ped = sed.gambe === 'pedala' ? Math.sin(this.fase * Math.PI) * 0.5 * this.vel : 0;
      a.pe.rotation.x = -1.25 + ped; a.pd.rotation.x = -1.25 - ped; a.be.rotation.x = -1.1; a.bd.rotation.x = -1.1;
    }
  }

  mostraBordo() {
    const b = this.el.querySelector('.ps-bordo');
    b.innerHTML = this.mezzoId ? '🚧 Qui finisce la città.<br><small>Tocca 🛣️ Strada per andare in una città vicina</small>'
      : '🚧 Qui finisce la città.<br><small>Con la bici, la Vespa o l’auto prendi la 🛣️ strada per le città vicine</small>';
    b.classList.add('on');
    clearTimeout(this._bordo); this._bordo = setTimeout(() => { b.classList.remove('on'); this._avvBordo = false; }, 3200);
  }

  // altura (acima do chão da cidade) do que estiver em x,z: casa, loja ou outdoor; 0 na rua
  alturaEm(x, z) {
    const m = LOTE * 0.5;
    if (!this._vicine || Math.hypot(this._vicine.x - this.pos.x, this._vicine.z - this.pos.z) > LOTE) {
      const v = [];
      for (const ci of this.l.casas) { const c = this.D.casas[ci]; if (Math.abs(c.x - this.pos.x) < LOTE * 4 && Math.abs(c.z - this.pos.z) < LOTE * 4) v.push([c.x, c.z, ((this.ui.decori?.attive.get(c.conta)?.pilha) ?? ALTURA_NIVEL[c.livello]) * LOTE]); }
      for (const cm of this.l.commerci ?? []) if (Math.abs(cm.x - this.pos.x) < LOTE * 4 && Math.abs(cm.z - this.pos.z) < LOTE * 4) v.push([cm.x, cm.z, LOTE * (cm.prodotto === 'cartellone' ? 0.95 : 0.7)]);
      this._vicine = { x: this.pos.x, z: this.pos.z, v };
    }
    let h = 0;
    for (const [cx, cz, ch] of this._vicine.v) if (Math.abs(x - cx) < m && Math.abs(z - cz) < m) h = Math.max(h, ch);
    return h;
  }

  // o ponto (x,y,z) está atrás de alguma casa mais perto da câmera?
  coperto(x, y, z, lista, eu) {
    const cam = this.mappa.camera.position, dir = new THREE.Vector3(x - cam.x, y - cam.y, z - cam.z), d = dir.length();
    const ray = new THREE.Ray(cam.clone(), dir.normalize()), caixa = new THREE.Box3(), hit = new THREE.Vector3(), m = LOTE * 0.46;
    for (const [, c, cm] of lista) {
      const o = c ?? cm; if (o === eu) continue;
      const h = c ? ALTURA_NIVEL[c.livello] * LOTE : LOTE * 0.66;
      caixa.min.set(o.x - m, this.hc, o.z - m); caixa.max.set(o.x + m, this.hc + h, o.z + m);
      if (ray.intersectBox(caixa, hit) && cam.distanceTo(hit) < d - LOTE * 0.3) return true;
    }
    return false;
  }

  // @ das casas perto, flutuando em cima delas (no lugar dos rótulos do mapa, que somem na passeggiata)
  etichette() {
    if ((this._q = (this._q ?? 0) + 1) % 3) return;   // a cada 3 quadros basta
    const p = this.pos, cam = this.mappa.camera, v = new THREE.Vector3(), lista = [];
    for (const ci of this.l.casas) {
      const c = this.D.casas[ci], d = Math.hypot(c.x - p.x, c.z - p.z);
      if (d < LOTE * 3.2) lista.push([d, c]);
    }
    for (const cm of this.l.commerci ?? []) { const d = Math.hypot(cm.x - p.x, cm.z - p.z); if (d < LOTE * 3.2) lista.push([d, null, cm]); }
    lista.sort((a, b) => a[0] - b[0]);
    const out = [], usati = [];
    for (const [, c, cm] of lista.slice(0, 10)) {
      const x = c ? c.x : cm.x, z = c ? c.z : cm.z;
      const y = this.hc + LOTE * (c ? (this.ui.decori?.attive.get(c.conta)?.pilha ?? ALTURA_NIVEL[c.livello]) + 0.12 : 0.85);   // no topo da casa
      v.set(x, y, z).project(cam);
      if (v.z > 1 || v.z < -1 || Math.abs(v.x) > 1.05 || v.y > 0.95 || v.y < -0.7) continue;
      const sx = (v.x + 1) / 2 * innerWidth, sy = (1 - v.y) / 2 * innerHeight;
      if (usati.some(([ux, uy]) => Math.abs(ux - sx) < 110 && Math.abs(uy - sy) < 30)) continue;   // não empilha rótulos
      if (this.coperto(x, y, z, lista, c ?? cm)) continue;                                           // escondida atrás de outra casa
      usati.push([sx, sy]);
      if (out.length >= 6) break;
      out.push(c ? `<button class="ps-tag${c.conta === this.ui.conto?.p?.conta ? ' mia' : ''}" data-ps-casa="${esc(c.conta)}" style="left:${sx.toFixed(0)}px;top:${sy.toFixed(0)}px">@${esc(c.conta)}</button>`
        : `<button class="ps-tag neg" data-ps-neg="${esc(cm.id)}" style="left:${sx.toFixed(0)}px;top:${sy.toFixed(0)}px">🏪 ${esc(cm.nome)}</button>`);
    }
    const html = out.join(''), et = this.el.querySelector('.ps-et');
    if (et.innerHTML !== html) {
      et.innerHTML = html;
      et.querySelectorAll('[data-ps-casa]').forEach(b => b.onclick = () => this.ui.casa(this.D.porConta.get(b.dataset.psCasa), false));
      et.querySelectorAll('[data-ps-neg]').forEach(b => b.onclick = () => { const cm = this.D.commerci.find(x => x.id === b.dataset.psNeg); if (cm) this.ui.commercio(cm); });
    }
  }
}
