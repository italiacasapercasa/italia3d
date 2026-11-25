// Caccia al tesoro na passeggiata: todo dia (hora de Roma) cada cidade esconde 1 baú numa esquina, e cada loja tem
// 1 baú na frente ("Tappa del tesoro": leva gente até a loja). Chegou perto: abre sozinho e dá crediti (api/conto.php "tesoro",
// valores e limite por dia em data/crediti.json "tesori"). A bússola no topo aponta para o baú mais perto da cidade.
import * as THREE from 'three';
import { LOTE, RUA, QW, QH, posLote } from './citta.js';

const H = LOTE * 0.3;
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const oggi = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Rome' }).format(new Date());
const hash = s => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };

export function forziere() {
  const g = new THREE.Group(), L = c => new THREE.MeshLambertMaterial({ color: c, flatShading: true });
  const legno = L('#8B5A2B'), oro = new THREE.MeshLambertMaterial({ color: '#FFC93C', emissive: '#6B4E00' });
  const base = new THREE.Mesh(new THREE.BoxGeometry(0.62 * H, 0.36 * H, 0.42 * H), legno); base.position.y = 0.18 * H; g.add(base);
  for (const x of [-0.22, 0.22]) { const f = new THREE.Mesh(new THREE.BoxGeometry(0.06 * H, 0.38 * H, 0.44 * H), oro); f.position.set(x * H, 0.19 * H, 0); g.add(f); }
  const coperchio = new THREE.Group(); coperchio.position.set(0, 0.36 * H, -0.21 * H); g.add(coperchio);
  const c = new THREE.Mesh(new THREE.CylinderGeometry(0.21 * H, 0.21 * H, 0.62 * H, 10, 1, false, 0, Math.PI), legno);
  c.rotation.z = Math.PI / 2; c.rotation.y = Math.PI / 2; c.position.set(0, 0, 0.21 * H); coperchio.add(c);
  const serr = new THREE.Mesh(new THREE.BoxGeometry(0.1 * H, 0.12 * H, 0.04 * H), oro); serr.position.set(0, 0.32 * H, 0.22 * H); g.add(serr);
  // raggio di luce: si vede da lontano
  const raggio = new THREE.Mesh(new THREE.CylinderGeometry(0.12 * H, 0.3 * H, 4 * H, 12, 1, true),
    new THREE.MeshBasicMaterial({ color: '#FFE38A', transparent: true, opacity: 0.35, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }));
  raggio.position.y = 2 * H; g.add(raggio);
  g.userData = { coperchio, raggio };
  return g;
}

export class Tesori {
  constructor(ps) {
    this.ps = ps; this.D = ps.D; this.mappa = ps.mappa;
    this.lista = []; this.giorno = null;
    const d = document.createElement('div');
    d.className = 'ps-bussola'; d.hidden = true;
    d.innerHTML = '<i>➤</i><span></span>';
    ps.el.appendChild(d);
    this.el = d;
  }
  get cfg() { return this.ps.ui.conto?.cfg?.tesori ?? { citta: 2, negozio: 3, max: 5, negozi: 'tutti' }; }
  presi() { return new Set(this.ps.ui.conto?.p?.tesori ?? []); }

  // posição do baú da cidade hoje: numa esquina (cruzamento de ruas), longe da piazza quando dá
  posCitta(l, g) {
    const q = this.ps.citta.quadreDi(l), h = hash(`${g}|${l.id}`);
    const cand = q.length > 2 ? q.slice(1) : q, [i, j] = cand[h % cand.length];
    const sx = h & 2 ? 1 : -1, sz = h & 4 ? 1 : -1;
    return { x: l.x + i * QW + sx * QW / 2, z: l.z + j * QH + sz * QH / 2 };
  }
  entra(l) {
    this.esci();
    const g = oggi(), cfg = this.cfg, presi = this.presi();
    this.giorno = g; this.l = l;
    const hc = this.ps.citta.dadosCidade(l).hc;
    const add = (tipo, id, x, z, nome) => {
      const k = `${tipo === 'citta' ? 'c' : 'n'}${id}`;
      const o = forziere(); o.position.set(x, hc + 0.0009, z); o.visible = !presi.has(k);
      this.mappa.scene.add(o);
      this.lista.push({ tipo, id, k, o, nome, preso: presi.has(k) });
    };
    const p = this.posCitta(l, g); add('citta', l.id, p.x, p.z, l.nome);
    if (cfg.negozi) for (const cm of l.commerci ?? []) {
      if (cm.prodotto === 'cartellone' || (Array.isArray(cfg.negozi) && !cfg.negozi.includes(cm.id))) continue;
      const lado = posLote(cm.lote).rot === 0 ? 1 : -1;
      add('negozio', cm.id, cm.x + LOTE * 0.3, cm.z + lado * (LOTE * 0.5 + RUA * 0.3), cm.nome);
    }
    this.el.hidden = false;
    this.aggiornaBussola();
  }
  esci() {
    for (const t of this.lista) { this.mappa.scene.remove(t.o); t.o.traverse(x => x.geometry?.dispose()); }
    this.lista = []; this.el.hidden = true;
  }
  passo(pos, agora) {
    if (!this.lista.length) return;
    if (oggi() !== this.giorno) return this.entra(this.l);   // virou o dia
    for (const t of this.lista) {
      const a = t.o.userData;
      if (t.aprendo) {
        const k = Math.min(1, (agora - t.aprendo) / 900);
        a.coperchio.rotation.x = -1.9 * Math.min(1, k * 2);
        t.o.scale.setScalar(1 + 0.25 * Math.sin(Math.PI * k));
        a.raggio.material.opacity = 0.6 * (1 - k);
        if (k >= 1) { t.o.visible = false; t.aprendo = null; }
        continue;
      }
      if (t.preso || !t.o.visible) continue;
      t.o.rotation.y = agora * 0.0012;
      a.raggio.material.opacity = 0.25 + 0.15 * Math.sin(agora * 0.004);
      if (Math.hypot(pos.x - t.o.position.x, pos.z - t.o.position.z) < LOTE * 0.45 && !t.chiesto) this.prendi(t);
    }
    if ((this._q = (this._q ?? 0) + 1) % 4 === 0) this.aggiornaBussola();
  }
  async prendi(t) {
    const conto = this.ps.ui.conto;
    t.chiesto = true;
    if (!conto?.p?.conta) { this.ps.dica('🧭 Collega il tuo Instagram nel tuo account per raccogliere i tesori!', 4000); setTimeout(() => { t.chiesto = false; }, 8000); return; }
    try {
      const j = await conto.api('tesoro', { tipo: t.tipo, id: String(t.id) });
      conto.p = j.profilo; conto.desenharBotao();
      const r = j.tesoro;
      if (r.pieno) { this.ps.dica(`🧭 Hai già trovato ${r.max} tesori oggi: torna domani!`, 4000); setTimeout(() => { t.chiesto = false; }, 15000); return; }
      t.preso = true; t.aprendo = performance.now();
      if (r.crediti) this.ps.ui.aviso(`${r.avvento ? '🎁 Tesoro dell’Avvento' : '🧭 Tesoro trovato'}! +${r.crediti} 💰 · ${r.n}/${r.max} oggi${t.tipo === 'negozio' ? ` · offerto da ${t.nome}` : ''}`);
      this.aggiornaBussola();
    } catch (e) { this.ps.dica(e.message, 3500); setTimeout(() => { t.chiesto = false; }, 8000); }
  }
  aggiornaBussola() {
    const p = this.ps.pos, n = (this.ps.ui.conto?.p?.tesori ?? []).length, max = this.cfg.max;
    const vivi = this.lista.filter(t => !t.preso && t.o.visible);
    const sp = this.el.querySelector('span'), fr = this.el.querySelector('i');
    if (n >= max) { sp.innerHTML = `🧭 <b>${n}/${max}</b> tesori oggi · torna domani`; fr.style.display = 'none'; return; }
    if (!vivi.length || !p) { sp.innerHTML = `🧭 <b>${n}/${max}</b> · qui li hai presi tutti: prova un'altra città`; fr.style.display = 'none'; return; }
    let best = null, md = Infinity;
    for (const t of vivi) { const d = Math.hypot(t.o.position.x - p.x, t.o.position.z - p.z); if (d < md) { md = d; best = t; } }
    // ângulo do baú em relação à direção da câmera (yaw: a câmera olha para -sin, -cos)
    const ang = Math.atan2(best.o.position.x - p.x, best.o.position.z - p.z), cam = Math.atan2(-Math.sin(this.ps.yaw), -Math.cos(this.ps.yaw));
    fr.style.display = '';
    fr.style.transform = `rotate(${((cam - ang) * 180 / Math.PI) - 90}deg)`;
    const m = Math.round(md * 1000);
    sp.innerHTML = `🧭 Tesoro${best.tipo === 'negozio' ? ` da ${esc(best.nome)}` : ''} a <b>${m < 1000 ? `${Math.max(1, Math.round(m / 10) * 10)} m` : `${(m / 1000).toFixed(1).replace('.', ',')} km`}</b> · ${n}/${max}`;
  }
}
