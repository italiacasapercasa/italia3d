// Passeggiata: andar a pé pela Itália inteira, na própria cena do mapa (mesmas casas, lojas, outdoors e decorações).
// Câmera em 3ª pessoa atrás de um bonequinho; anda em qualquer lugar de terra: ruas, piazza, prados, morros e nas
// estradas que ligam cada cidade às vizinhas (js/strade.js). Bloqueia só o miolo das quadras (casas) e o mar.
// Celular: metade esquerda = joystick (aparece onde o dedo toca), metade direita = arrastar gira a câmera, toque abre o cartão.
// PC: WASD/setas andam (Shift corre), arrastar o mouse gira, clique abre o cartão, Esc sai.
// Grátis para quem tem conta (js/conto.js). Ligado em mappa.js (mappa.passeggio recebe os eventos e o passo de cada quadro).
import * as THREE from 'three';
import { LOTE, RUA, QW, QH, posLote, larguraScarpata, SCARPATA_MIN } from './citta.js';
import { ALTURA_NIVEL } from './modelli.js';
import { costruisci, animaAcc } from './personaggio.js';
import { VEICOLI, SEDUTO, costruisciVeicolo } from './veicoli.js';
import { Tesori } from './tesori.js';
import { Strade } from './strade.js';

const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const km = d => (d < 10 ? d.toFixed(1).replace('.', ',') : String(Math.round(d)));
const norm = s => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
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
    this.strade = new Strade(D, mappa, citta);
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
      <div class="ps-flash"></div>
      <div class="ps-topo"><span class="ps-titolo">🚶 <b></b></span><button type="button" class="ps-esci" aria-label="Esci dalla passeggiata">✕ Esci</button></div>
      <div class="ps-et"></div>
      <div class="ps-bussola ps-meta" hidden><i>⬆</i><span></span><button type="button" class="ps-meta-x" aria-label="Annulla percorso">✕</button></div>
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
    d.querySelector('.ps-menu').oninput = e => { if (e.target.classList.contains('ps-cerca')) this.cerca(e.target.value); };
    d.querySelector('.ps-meta-x').onclick = () => { this.meta = null; this.el.querySelector('.ps-meta').hidden = true; };
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
    if (id) this.dica(`${this.infoMezzo(id).icona} ${String(this.velocita()).replace('.', ',')}× più veloce · 🛣️ Strada ti porta da solo in qualsiasi città`, 4000);
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
      <p>Con un veicolo vai più veloce e con la 🛣️ strada ti porta da solo in qualsiasi città. Comprato una volta, è tuo per sempre.</p>`);
  }
  async cliqueMenu(e) {
    const b = e.target.closest('button'); if (!b) return;
    const { m, v } = b.dataset;
    if (m === 'chiudi') return this.chiudiMenu();
    if (m === 'usa') return this.scegliMezzo(v);
    if (m === 'compra') { const x = this.infoMezzo(v); if (await this.ui.conto.compra(v, x.nome, x.prezzo, `${String(x.velocita).replace('.', ',')}× più veloce e il pilota automatico sulle strade.`)) this.scegliMezzo(v); return; }
    if (m === 'vai') { const l = this.D.luoghi[+v]; if (l) this.parti(l); return; }
    if (m === 'guida') { const l = this.D.luoghi[+v]; if (l) this.guida(l); return; }
    if (m === 'salta' && this.viaggio) { this.viaggio.salta = true; return; }
    if (m === 'mezzi') return this.menuMezzi();
  }

  // ---------- estradas: cidades vizinhas, busca de qualquer cidade, guia a pé ou pilota automático ----------
  rigaCitta(o, d) {
    const auto = !!this.mezzoId;
    return `<button type="button" class="ps-opz" data-m="${auto ? 'vai' : 'guida'}" data-v="${o.id}"><span>${auto ? this.infoMezzo(this.mezzoId)?.icona ?? '🚗' : '🧭'}</span><b>${esc(o.nome)}</b><small>${d != null ? `${km(d)} km · ` : ''}${o.case} ${o.case === 1 ? 'casa' : 'case'}</small></button>`;
  }
  menuStrade() {
    if (this.viaggio) return;
    const l = this.l, v = this.strade.archi(l);
    const lista = v.map(([d, o]) => this.rigaCitta(o, d)).join('');
    const nota = this.mezzoId
      ? `<p>${this.infoMezzo(this.mezzoId)?.icona ?? '🚗'} Pilota automatico: ti porto io, anche dall'altra parte dell'Italia.</p>`
      : `<p>🧭 A piedi ti indico la strada (seguila o taglia per i prati). Con un veicolo il viaggio è automatico.</p><button type="button" class="ps-cta" data-m="mezzi">🚲 Scegli un veicolo</button>`;
    this.menu(`<h4>🛣️ Dove vuoi andare?</h4><input class="ps-cerca" type="search" placeholder="Cerca una città…" autocomplete="off"><div class="ps-trovate"></div>
      ${v.length ? `<p style="margin-top:4px">Città vicine a ${esc(l.nome)}</p>${lista}` : `<p>Da ${esc(l.nome)} non partono strade (isola?).</p>`}${nota}`);
  }
  cerca(q) {
    const box = this.el.querySelector('.ps-trovate'); if (!box) return;
    const t = norm(q.trim());
    if (t.length < 2) { box.innerHTML = ''; return; }
    const out = this.D.luoghi.filter(o => o !== this.l && norm(o.nome).startsWith(t)).sort((a, b) => b.case - a.case).slice(0, 6);
    box.innerHTML = out.map(o => this.rigaCitta(o, Math.hypot(o.x - this.pos.x, o.z - this.pos.z))).join('') || '<p>Nessuna città con case.</p>';
  }
  // percurso pela rede; null se não há estrada (ilha)
  rota(dest) {
    const r = this.strade.percorso(this.l, dest);
    if (!r) this.menu(`<h4>🌊 ${esc(dest.nome)}</h4><p>Non c'è una strada da ${esc(this.l.nome)} a ${esc(dest.nome)} (c'è il mare in mezzo).</p>`);
    return r;
  }
  // a pé: bússola até a próxima cidade da rota
  guida(dest) {
    const r = this.rota(dest); if (!r) return;
    this.meta = { rota: r, i: 1 };
    this.chiudiMenu();
    this.el.querySelector('.ps-meta').hidden = false;
    this.dica(`🧭 Segui la freccia in alto: ${km(Math.hypot(dest.x - this.pos.x, dest.z - this.pos.z))} km fino a ${dest.nome}`, 4500);
  }
  aggiornaMeta() {
    const m = this.meta; if (!m) return;
    let alvo = m.rota[m.i];
    while (alvo && m.i < m.rota.length - 1 && Math.hypot(alvo.x - this.pos.x, alvo.z - this.pos.z) < this.citta.raioCidade(alvo) + 0.05) alvo = m.rota[++m.i];
    const fim = m.rota[m.rota.length - 1], dFim = Math.hypot(fim.x - this.pos.x, fim.z - this.pos.z);
    if (dFim < this.citta.raioCidade(fim) * 0.7) { this.meta = null; this.el.querySelector('.ps-meta').hidden = true; this.ui.aviso(`🏁 Sei arrivato a ${fim.nome}!`); return; }
    // segue a estrada: aponta para o portão da cidade de destino do trecho, não para o centro
    const da = m.rota[m.i - 1], s = this.strade.strada(da, alvo), g = s.A === alvo ? s.gA : s.gB;
    const tx = g.x - this.pos.x, tz = g.z - this.pos.z, sy = Math.sin(this.yaw), cy = Math.cos(this.yaw);
    const f = -sy * tx - cy * tz, r = cy * tx - sy * tz, ang = Math.atan2(r, f);
    const el = this.el.querySelector('.ps-meta');
    el.querySelector('i').style.transform = `rotate(${ang.toFixed(2)}rad)`;
    el.querySelector('span').textContent = `${fim.nome} · ${km(dFim)} km${alvo !== fim ? ` · via ${alvo.nome}` : ''}`;
  }

  // com veículo: pilota automático pela rede, trecho por trecho
  parti(dest) {
    const r = this.rota(dest); if (!r) return;
    this.meta = null; this.el.querySelector('.ps-meta').hidden = true;
    const tratti = [];
    for (let i = 0; i < r.length - 1; i++) tratti.push([r[i], r[i + 1]]);
    this.viaggio = { tratti, n: 0, dest };
    this.iniziaTratto();
    this.el.classList.add('viaggio');
    this.el.querySelector('.ps-menu').classList.add('basso');
    this.menu(`<h4>🛣️ Verso ${esc(dest.nome)}</h4><p>${tratti.length > 1 ? `${tratti.length} strade · ` : ''}${this.infoMezzo(this.mezzoId)?.icona ?? '🚗'} pilota automatico</p><button type="button" class="ps-cta" data-m="salta">⏩ Arriva subito</button>`);
  }
  iniziaTratto() {
    const v = this.viaggio, [a, b] = v.tratti[v.n], s = this.strade.strada(a, b);
    this.strade.aggiorna(a.x, a.z); this.strade.aggiorna((a.x + b.x) / 2, (a.z + b.z) / 2, Math.hypot(a.x - b.x, a.z - b.z) / 2 + 3);
    const P = s.A === a ? s.P : s.P.slice().reverse().map(p => ({ ...p, s: s.tot - p.s, px: -p.px, pz: -p.pz, tx: -p.tx, tz: -p.tz }));
    const vel = VEL * this.velocita() * 3.2;   // na estrada vai mais rápido que na cidade
    Object.assign(v, { P, tot: s.tot, t0: performance.now(), dur: clamp(s.tot / vel, 5, 20), i: 0 });
    this.el.querySelector('.ps-titolo b').textContent = `${a.nome} → ${b.nome}`;
    if (v.n > 0) this.flash();
  }
  flash() { const f = this.el.querySelector('.ps-flash'); f.classList.add('on'); requestAnimationFrame(() => requestAnimationFrame(() => f.classList.remove('on'))); }
  passoViaggio(agora) {
    const v = this.viaggio, primo = v.n === 0, ultimo = v.n === v.tratti.length - 1;
    let k = clamp((agora - v.t0) / 1000 / v.dur, 0, 1);
    if (v.salta) k = 1;
    // acelera no começo do primeiro trecho e freia no fim do último
    const inn = x => 2 * x * x - x * x * x, out = x => 1 - inn(1 - x);
    const e = primo && ultimo ? (k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2) : primo ? inn(k) : ultimo ? out(k) : k;
    const alvo = clamp(e, 0, 1) * v.tot, P = v.P;
    while (v.i < P.length - 2 && P[v.i + 1].s < alvo) v.i++;
    const p = P[v.i], q = P[v.i + 1], t = clamp((alvo - p.s) / ((q.s - p.s) || 1), 0, 1);
    const pos = this.pos, px0 = pos.x, pz0 = pos.z, off = RUA * 0.18;   // corsia di destra
    const tx = q.x - p.x, tz = q.z - p.z, tl = Math.hypot(tx, tz) || 1, ux = tx / tl, uz = tz / tl;
    const y = p.y + (q.y - p.y) * t;
    pos.set(p.x + tx * t - uz * off, y, p.z + tz * t + ux * off);
    this.y = y;
    const passo = Math.hypot(pos.x - px0, pos.z - pz0);
    this.fase += passo / (H * 0.55);
    this.vel = 1;
    // corpo vira suave (curvas da estrada)
    const alvoDir = Math.atan2(ux, uz);
    this.dir += ((((alvoDir - this.dir) % (2 * Math.PI)) + 3 * Math.PI) % (2 * Math.PI) - Math.PI) * 0.2;
    this.yaw = this.dir + Math.PI;
    this.disegnaCorpo(passo);
    // câmera: atrás e um pouco mais alta para ver a paisagem
    const c = this.mappa.camera, sy = Math.sin(this.yaw), cy = Math.cos(this.yaw), d = LOTE * 3.2;
    const camY = Math.max(y + LOTE * 1.4, this.mappa.altura(pos.x + sy * d, pos.z + cy * d) + LOTE * 0.6);
    c.fov = 58; c.position.set(pos.x + sy * d, camY, pos.z + cy * d);
    c.lookAt(pos.x - sy * LOTE * 2, y + H * 0.5, pos.z - cy * LOTE * 2);
    c.near = 0.0015; c.far = 12; c.updateProjectionMatrix(); c.updateMatrixWorld(true);
    this.mappa.scene.fog.near = 0.8; this.mappa.scene.fog.far = 4.5;
    this.aggiornaCitta();
    this.el.querySelector('.ps-et').innerHTML = '';
    if (k < 1) return;
    if (!v.salta && v.n < v.tratti.length - 1) { v.n++; this.iniziaTratto(); return; }
    // chegou: fica no portão da cidade, já em cima da rua (sem pular para a piazza)
    const dest = v.dest, s = this.strade.strada(v.tratti[v.tratti.length - 1][0], dest), g = s.A === dest ? s.gA : s.gB;
    this.viaggio = null;
    this.el.classList.remove('viaggio');
    this.el.querySelector('.ps-menu').classList.remove('basso'); this.chiudiMenu();
    if (v.salta) this.flash();
    this.pos.set(g.x - g.dx * 0.02, 0, g.z - g.dz * 0.02);
    this.dir = Math.atan2(-g.dx, -g.dz); this.yaw = this.dir + Math.PI;
    this._cp = null;
    this.y = this.chao(this.pos.x, this.pos.z).y;
    this.entraCitta(dest);
    this.aggiornaCitta(true);
    this.ui.aviso(`🏘️ Benvenuto a ${dest.nome}!`);
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
    if (this.viaggio) { this.viaggio = null; this.el.classList.remove('viaggio'); this.el.querySelector('.ps-menu').classList.remove('basso'); }
    this.pos = new THREE.Vector3(x, 0, z);
    this._cp = null; this.l = null;
    this.entraCitta(l);
    this.y = this.citta.dadosCidade(l).hc;
    this.pos.y = this.y;
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
      this.strade.grupo.visible = true;
    }
    this.omino.visible = true;
    const mia = this.D.porConta.get(conto.p.conta);
    this.el.querySelector('.ps-casa').hidden = !mia;
    const toque = matchMedia('(pointer: coarse)').matches;
    this.dica(toque ? '👈 Trascina a sinistra per camminare · 👉 a destra per girarti · vai dove vuoi: prati, strade, altre città' : '⌨️ WASD o frecce per camminare (Shift corre) · trascina per girarti · vai dove vuoi: prati, strade, altre città', 6000);
    this.ultimoAgg = null;
    this.aggiornaCitta(true);
  }
  // cidade onde o bonequinho está agora (título, tesouros, rótulos das casas)
  entraCitta(l) {
    if (this.l === l) return;
    this.l = l;
    this.el.querySelector('.ps-titolo b').textContent = l.nome;
    this.tesori.entra(l);
  }
  esci() {
    if (!this.ativo) return;
    this.ativo = false;
    this.mappa.passeggio = null;
    this.omino.visible = false;
    if (this.mezzo) this.mezzo.visible = false;
    if (this.viaggio) { this.viaggio = null; this.el.querySelector('.ps-menu').classList.remove('basso'); this.el.classList.remove('viaggio'); }
    this.meta = null; this.el.querySelector('.ps-meta').hidden = true;
    this.chiudiMenu();
    this.tesori?.esci();
    this.strade.grupo.visible = false;
    document.body.classList.remove('passeggio');
    this.el.hidden = true;
    this.teclas.clear(); this.joy.id = null; this.giro = null;
    const m = this.mappa;
    m.mar.visible = true;
    m.camera.fov = this.camVecchia.fov;
    m.alvo.set(this.pos.x, this.y, this.pos.z);
    m.az = this.yaw;
    m.dist = 0.5;
    m.atualizarCamera();
    m.voar({ x: this.pos.x, z: this.pos.z, dist: 1.4, az: this.yaw }, 900);
  }

  // ---------- chão e onde se pode andar ----------
  // cidades a até 3 km (refeito quando o bonequinho anda 300 m)
  cidadesPerto() {
    const p = this.pos;
    if (!this._cp || Math.hypot(this._cp.x - p.x, this._cp.z - p.z) > 0.3) {
      const v = this.strade.perto(p.x, p.z, 3.5).map(([, l]) => l);
      for (const l of v) this.citta.dadosCidade(l);
      this._cp = { x: p.x, z: p.z, v };
    }
    return this._cp.v;
  }
  naCitta(x, z) {
    for (const l of this.cidadesPerto()) {
      if (Math.abs(x - l.x) > (l._raio ?? 9) + QW || Math.abs(z - l.z) > (l._raio ?? 9) + QW) continue;
      if (this.strade.cel(l).has(`${Math.round((x - l.x) / QW)},${Math.round((z - l.z) / QH)}`)) return l;
    }
    return null;
  }
  // altura do chão em x,z: platô da cidade, estrada (asfalto e aterro), barranco das cidades em encosta ou terreno
  chao(x, z) {
    const l = this.naCitta(x, z);
    if (l) return { y: this.citta.dadosCidade(l).hc, l };
    const mp = this.mappa;
    let y = mp.altura(x, z);
    for (const o of this.cidadesPerto()) {
      const c = this.citta.dadosCidade(o), queda = c.hc - y;
      if (queda <= 0 || Math.hypot(x - o.x, z - o.z) > c.raio + 1) continue;
      const w = queda > SCARPATA_MIN ? larguraScarpata(queda) : 0.006;
      let fora = Infinity;
      for (const k of this.strade.cel(o)) {
        const [i, j] = k.split(',').map(Number);
        fora = Math.min(fora, Math.hypot(Math.max(0, Math.abs(x - o.x - i * QW) - QW / 2), Math.max(0, Math.abs(z - o.z - j * QH) - QH / 2)));
        if (fora === 0) break;
      }
      if (fora < w) y = Math.max(y, c.hc - queda * fora / w);
    }
    const r = this.strade.altura(x, z);
    if (r) y = r.asfalto ? r.y : Math.max(y, r.y);
    return { y, strada: r, mar: !r && y < 0.002 };
  }
  livre(x, z) {
    const b = this.mappa.geo.bbox;
    if (x < b.x0 || x > b.x1 || z < b.z0 || z > b.z1) return false;
    const l = this.naCitta(x, z);
    if (!l) return !this.chao(x, z).mar;                                            // prado, morro, estrada: livre; mar não
    const i = Math.round((x - l.x) / QW), j = Math.round((z - l.z) / QH);
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

  // cidade, decorações e estradas carregam pelo alvo/dist do mapa: acompanha o bonequinho
  aggiornaCitta(forza = false) {
    const m = this.mappa, u = this.ultimoAgg;
    if (!forza && u && Math.hypot(u.x - this.pos.x, u.z - this.pos.z) < 0.25) return;
    this.ultimoAgg = { x: this.pos.x, z: this.pos.z };
    m.alvo.set(this.pos.x, this.y, this.pos.z);
    m.dist = 0.45;
    for (const f of m.aoMover) f();
    if (!this.viaggio) this.strade.aggiorna(this.pos.x, this.pos.z);
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
      else if (this.chao(p.x + mx * 8, p.z + mz * 8).mar && !this._avvBordo) { this._avvBordo = true; this.mostraBordo(); }
      this.fase += Math.hypot(mx, mz) / (H * 0.55) / (this.mezzoId ? this.velocita() * 0.6 : 1);
    }
    // chão: sobe/desce suave (degrau do platô, rampa da estrada, morro)
    const ch = this.chao(p.x, p.z);
    this.y = this.y == null ? ch.y : this.y + (ch.y - this.y) * Math.min(1, dt * 18);
    if (this.y < ch.y - 0.004) this.y = ch.y - 0.004;
    p.y = this.y;
    const lAqui = ch.l ?? null;
    if (lAqui) this.entraCitta(lAqui);
    if ((this._q ?? 0) % 15 === 0) {   // título: cidade, estrada ou campo (com a cidade mais perto)
      const tit = lAqui ? lAqui.nome : `${ch.strada ? '🛣️ Strada' : '🌾 Campagna'} · ${this.vicina().nome}`, b = this.el.querySelector('.ps-titolo b');
      if (b.textContent !== tit) b.textContent = tit;
    }
    this.vel += ((mag > 0.08 ? 1 : 0) - this.vel) * Math.min(1, dt * 10);
    this.disegnaCorpo(Math.hypot(p.x - x0, p.z - z0));
    this.tesori?.passo(p, agora);
    // câmera atrás, encolhendo se o ponto cair dentro de uma casa; nunca dentro do morro
    const m = this.mappa, c = m.camera, kc = carro ? 1.55 : this.mezzoId ? 1.2 : 1;
    const alt = CAM_ALT * kc + this.pitch * CAM_DIST * kc;
    let d = CAM_DIST * kc;
    for (let k = 0; k < 8; k++) { if (this.topoEm(p.x + sy * d, p.z + cy * d) < this.y + alt - LOTE * 0.08) break; d *= 0.8; }   // só prédio mais alto que a câmera empurra
    const camX = p.x + sy * d, camZ = p.z + cy * d, camY = Math.max(this.y + alt, this.chao(camX, camZ).y + LOTE * 0.25);
    c.fov = 58;
    c.position.set(camX, camY, camZ);
    c.lookAt(p.x - sy * LOTE * 0.45, this.y + H * 0.6, p.z - cy * LOTE * 0.45);
    c.near = 0.0015; c.far = 9;
    c.updateProjectionMatrix(); c.updateMatrixWorld(true);
    m.scene.fog.near = lAqui ? 0.35 : 0.6; m.scene.fog.far = lAqui ? 2.6 : 3.4;
    this.aggiornaCitta();
    this.etichette();
    if ((this._q ?? 0) % 3 === 0) this.aggiornaMeta();
  }
  vicina() {
    let best = this.l, bd = Infinity;
    for (const l of this.cidadesPerto()) { const d = Math.hypot(l.x - this.pos.x, l.z - this.pos.z); if (d < bd) { bd = d; best = l; } }
    return best;
  }

  // boneco a pé, na bici/Vespa (sentado) ou carro (o boneco some)
  disegnaCorpo(andou) {
    const p = this.pos, o = this.omino, a = o.userData, hc = this.y, mz = this.mezzo, id = this.mezzoId;
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
    b.innerHTML = '🌊 Qui c’è il mare.<br><small>Tocca 🛣️ Strada per scegliere dove andare</small>';
    b.classList.add('on');
    clearTimeout(this._bordo); this._bordo = setTimeout(() => { b.classList.remove('on'); this._avvBordo = false; }, 3200);
  }

  // altura absoluta do topo do que estiver em x,z (casa, loja, outdoor) ou do chão da cidade
  topoEm(x, z) {
    const m = LOTE * 0.5;
    if (!this._vicine || Math.hypot(this._vicine.x - this.pos.x, this._vicine.z - this.pos.z) > LOTE) {
      const v = [];
      for (const l of this.cidadesPerto()) {
        if (Math.hypot(l.x - this.pos.x, l.z - this.pos.z) > (l._raio ?? 1) + LOTE * 5) continue;
        for (const ci of l.casas) { const c = this.D.casas[ci]; if (Math.abs(c.x - this.pos.x) < LOTE * 4 && Math.abs(c.z - this.pos.z) < LOTE * 4) v.push([c.x, c.z, c.y + ((this.ui.decori?.attive.get(c.conta)?.pilha) ?? ALTURA_NIVEL[c.livello]) * LOTE]); }
        for (const cm of l.commerci ?? []) if (Math.abs(cm.x - this.pos.x) < LOTE * 4 && Math.abs(cm.z - this.pos.z) < LOTE * 4) v.push([cm.x, cm.z, cm.y + LOTE * (cm.prodotto === 'cartellone' ? 0.95 : 0.7)]);
      }
      this._vicine = { x: this.pos.x, z: this.pos.z, v };
    }
    let h = -Infinity;
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
      caixa.min.set(o.x - m, o.y, o.z - m); caixa.max.set(o.x + m, o.y + h, o.z + m);
      if (ray.intersectBox(caixa, hit) && cam.distanceTo(hit) < d - LOTE * 0.3) return true;
    }
    return false;
  }

  // @ das casas perto, flutuando em cima delas (no lugar dos rótulos do mapa, que somem na passeggiata)
  etichette() {
    if ((this._q = (this._q ?? 0) + 1) % 3) return;   // a cada 3 quadros basta
    const p = this.pos, cam = this.mappa.camera, v = new THREE.Vector3(), lista = [];
    if (this.l && Math.hypot(this.l.x - p.x, this.l.z - p.z) < this.citta.raioCidade(this.l) + LOTE * 4) {
      for (const ci of this.l.casas) {
        const c = this.D.casas[ci], d = Math.hypot(c.x - p.x, c.z - p.z);
        if (d < LOTE * 3.2) lista.push([d, c]);
      }
      for (const cm of this.l.commerci ?? []) { const d = Math.hypot(cm.x - p.x, cm.z - p.z); if (d < LOTE * 3.2) lista.push([d, null, cm]); }
    }
    lista.sort((a, b) => a[0] - b[0]);
    const out = [], usati = [];
    for (const [, c, cm] of lista.slice(0, 10)) {
      const x = c ? c.x : cm.x, z = c ? c.z : cm.z;
      const y = (c ?? cm).y + LOTE * (c ? (this.ui.decori?.attive.get(c.conta)?.pilha ?? ALTURA_NIVEL[c.livello]) + 0.12 : 0.85);   // no topo da casa
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
