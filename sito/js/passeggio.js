// Passeggiata: andar a pé pela cidade, na própria cena do mapa (mesmas casas, lojas, outdoors e decorações).
// Câmera em 3ª pessoa atrás de um bonequinho; anda só nas ruas e calçadas (o miolo das quadras é bloqueado, a piazza é livre).
// Celular: metade esquerda = joystick (aparece onde o dedo toca), metade direita = arrastar gira a câmera, toque abre o cartão.
// PC: WASD/setas andam (Shift corre), arrastar o mouse gira, clique abre o cartão, Esc sai.
// Grátis para quem tem conta (js/conto.js). Ligado em mappa.js (mappa.passeggio recebe os eventos e o passo de cada quadro).
import * as THREE from 'three';
import { LOTE, RUA, QW, QH, posLote } from './citta.js';
import { ALTURA_NIVEL } from './modelli.js';
import { costruisci } from './personaggio.js';

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
      <div class="ps-azioni"><button type="button" class="ps-pg">🧍 Personaggio</button><button type="button" class="ps-casa" hidden>🏠 La mia casa</button></div>`;
    document.body.appendChild(d);
    this.el = d;
    d.querySelector('.ps-esci').onclick = () => this.esci();
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
  }
  esci() {
    if (!this.ativo) return;
    this.ativo = false;
    this.mappa.passeggio = null;
    this.omino.visible = false;
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
    m.alvo.set(this.pos.x, this.hc, this.pos.z);
    m.dist = 0.45;
    for (const f of m.aoMover) f();
  }

  // ---------- cada quadro (mappa.loop) ----------
  passo(agora) {
    const dt = Math.min(0.05, (agora - (this._t ?? agora)) / 1000); this._t = agora;
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
      const v = VEL * mag * (t.has('shift') ? 1.9 : 1);
      mx = vx / n * v * dt; mz = vz / n * v * dt;
      // vira o corpo suavemente para onde anda
      const alvoDir = Math.atan2(vx, vz);
      let dd = ((alvoDir - this.dir) % (2 * Math.PI) + 3 * Math.PI) % (2 * Math.PI) - Math.PI;
      this.dir += dd * Math.min(1, dt * 12);
    }
    // colisão: tenta andar; se bater, desliza no eixo que dá
    const p = this.pos, r = H * 0.25;
    const ok = (x, z) => this.livre(x + Math.sign(mx) * r, z + Math.sign(mz) * r) && this.livre(x, z);
    if (mx || mz) {
      if (ok(p.x + mx, p.z + mz)) { p.x += mx; p.z += mz; }
      else if (ok(p.x + mx, p.z)) p.x += mx;
      else if (ok(p.x, p.z + mz)) p.z += mz;
      else if (!this.cel.has(`${Math.round((p.x + mx * 8 - this.l.x) / QW)},${Math.round((p.z + mz * 8 - this.l.z) / QH)}`) && !this._avvBordo) {
        this._avvBordo = true; this.mostraBordo();
      }
      this.fase += Math.hypot(mx, mz) / (H * 0.55);
    }
    this.vel += ((mag > 0.08 ? 1 : 0) - this.vel) * Math.min(1, dt * 10);
    // bonequinho
    const o = this.omino, a = o.userData, sw = Math.sin(this.fase * Math.PI) * 0.7 * this.vel;
    o.position.set(p.x, this.hc + 0.0009 + Math.abs(Math.sin(this.fase * Math.PI)) * H * 0.04 * this.vel, p.z);
    o.rotation.y = this.dir;
    a.pe.rotation.x = sw; a.pd.rotation.x = -sw; a.be.rotation.x = -sw * 0.8; a.bd.rotation.x = sw * 0.8;
    // câmera atrás, encolhendo se o ponto cair dentro de uma casa
    const m = this.mappa, c = m.camera;
    const alt = CAM_ALT + this.pitch * CAM_DIST;
    let d = CAM_DIST;
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

  mostraBordo() {
    const b = this.el.querySelector('.ps-bordo');
    b.innerHTML = '🚧 Qui finisce la città.<br><small>Presto potrai prendere la strada per la città vicina 🚗</small>';
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
