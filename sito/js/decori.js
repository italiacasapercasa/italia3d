// Casa decorada: cores de time, ouro, neon, coroa, fogos... na própria casa ou de presente para um amigo.
// Só estética (não dá pontos). Compras pagas ficam em data/decori.json (reescrito pelo webhook da Hotmart a cada pagamento).
// Teste antes do lançamento: ?decora=1 mostra o botão mesmo com "decora.attivo": false em data/negozio.json.
import * as THREE from 'three';
import { geometriaCasa, ALTURA_NIVEL, stileRegione } from './modelli.js';
import { LOTE, posLote } from './citta.js';
import { PERFIL } from './storie.js';

const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const hash = s => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return Math.abs(h); };
const variante = s => hash(s) % 3;   // mesma variante de cor que citta.js usa
const eur = cent => `€${(cent / 100).toFixed(2).replace('.', ',')}`;
const ler = k => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } };
const gravar = (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, JSON.stringify(v)); } catch { /* sem storage */ } };
const dataCurta = ms => new Date(ms).toLocaleDateString('it-IT', { day: 'numeric', month: 'short', timeZone: 'Europe/Rome' });

// cores das camisas (só as cores: nome e escudo dos clubes são marcas registradas)
export const SQUADRE = [
  { id: 'bianconero', nome: 'Bianconero', muro: '#F4F4F2', tetto: '#1C1C1C' },
  { id: 'nerazzurro', nome: 'Nerazzurro', muro: '#1F5BB8', tetto: '#151515' },
  { id: 'rossonero', nome: 'Rossonero', muro: '#D3252B', tetto: '#151515' },
  { id: 'azzurro', nome: 'Azzurro', muro: '#5BB8EC', tetto: '#F6F6F6' },
  { id: 'giallorosso', nome: 'Giallorosso', muro: '#F2B33D', tetto: '#8E1F2F' },
  { id: 'biancoceleste', nome: 'Biancoceleste', muro: '#F6F6F6', tetto: '#86C8EE' },
  { id: 'viola', nome: 'Viola', muro: '#6B3FA0', tetto: '#F2F2F2' },
  { id: 'granata', nome: 'Granata', muro: '#8B1E2B', tetto: '#F2F2F2' },
  { id: 'rossoblu', nome: 'Rossoblù', muro: '#C8102E', tetto: '#0B2C6B' },
];
const ORO = { muro: '#F2C230', tetto: '#C99A1E' };
// efeitos; regalo = pode ser dado de presente (só coisas positivas: cores de time e tricolore ficam só para a própria casa)
// a lista igual está em api/decora.php
export const EFFETTI = [
  { id: 'oro', em: '✨', nome: 'Casa d’oro', mia: true, regalo: true },
  { id: 'neon', em: '🌈', nome: 'Neon', mia: true, regalo: true },
  { id: 'corona', em: '👑', nome: 'Corona', mia: true, regalo: true },
  { id: 'fuochi', em: '🎆', nome: 'Fuochi', mia: true, regalo: true },
  { id: 'campione', em: '🏆', nome: 'Campione', mia: true, regalo: true },
  { id: 'palloncini', em: '🎈', nome: 'Compleanno', mia: false, regalo: true },
  { id: 'tricolore', em: '🇮🇹', nome: 'Tricolore', mia: true, regalo: false },
  { id: 'cornice', em: '🖼', nome: 'Cornice @', mia: true, regalo: true },
];

// ---------- cores: troca parede, telhado e persianas da casa original pelas da paleta ----------
const MURI = ['#F2C98A', '#F3E2C2', '#EDB49A', '#F4A79D', '#F7C66E', '#F08A5D', '#D9C9A9', '#CDB894', '#E2D4B8', '#C9B48F', '#F7F4EC', '#F1E9DA', '#EDE2CC', '#EFE6D2', '#8B5A3C', '#7A4E2D', '#9C6B45', '#F2EDE4', '#F6F3EC', '#7FB7D9', '#F2C230'];
const TETTI = ['#D9653B', '#B84E2C', '#C9643E', '#C25A35', '#6B5A4E', '#5A4A40', '#8E8A80', '#9AA3AE', '#C99A1E', '#E4DED2', '#D9CFBF'];
const PERSIANE = ['#3E8E4E', '#3E6E4E', '#2F7DD1', '#B23A30'];
const lin = l => l.map(h => new THREE.Color(h));
const [cMuri, cTetti, cPers] = [lin(MURI), lin(TETTI), lin(PERSIANE)];
const vicino = (r, g, b, lista) => lista.some(c => Math.abs(c.r - r) + Math.abs(c.g - g) + Math.abs(c.b - b) < 0.02);
const geoCache = new Map();
function geoCasa(liv, v, stile) {
  const k = `${liv}_${v}_${stile}`;
  if (!geoCache.has(k)) geoCache.set(k, geometriaCasa(liv, v, stile));
  return geoCache.get(k);
}
function ricolora(geo, pal) {
  const g = geo.clone(), col = g.attributes.color.clone(), a = col.array;
  const m = new THREE.Color(pal.muro), t = new THREE.Color(pal.tetto);
  for (let i = 0; i < a.length; i += 3) {
    const [r, gg, b] = [a[i], a[i + 1], a[i + 2]];
    const novo = vicino(r, gg, b, cTetti) ? t : vicino(r, gg, b, cMuri) ? m : vicino(r, gg, b, cPers) ? t : null;
    if (novo) { a[i] = novo.r; a[i + 1] = novo.g; a[i + 2] = novo.b; }
  }
  g.setAttribute('color', col);
  return g;
}

// ---------- peças 3D (em unidades de lote; o grupo é escalado por LOTE) ----------
const basico = cor => new THREE.MeshBasicMaterial({ color: cor });
const lambert = cor => new THREE.MeshLambertMaterial({ color: cor });
const matOro = new THREE.MeshLambertMaterial({ vertexColors: true, emissive: new THREE.Color('#4A3600') });
const oroMat = new THREE.MeshLambertMaterial({ color: '#F2C230', emissive: new THREE.Color('#5A4300') });

function corona() {
  const g = new THREE.Group();
  const anel = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.15, 0.12, 14, 1, true), oroMat);
  anel.material.side = THREE.DoubleSide;
  g.add(anel);
  for (let k = 0; k < 7; k++) {
    const a = k / 7 * Math.PI * 2, p = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.13, 4), oroMat);
    p.position.set(Math.cos(a) * 0.16, 0.12, Math.sin(a) * 0.16); g.add(p);
    const gem = new THREE.Mesh(new THREE.IcosahedronGeometry(0.025, 0), basico(k % 2 ? '#E0473C' : '#3FA7F5'));
    gem.position.set(Math.cos(a + 0.45) * 0.172, 0.0, Math.sin(a + 0.45) * 0.172); g.add(gem);
  }
  return g;
}
function trofeo() {
  const g = new THREE.Group();
  const add = (geo, m, y) => { const o = new THREE.Mesh(geo, m); o.position.y = y; g.add(o); return o; };
  add(new THREE.BoxGeometry(0.16, 0.06, 0.16), lambert('#3A3F4A'), 0.03);
  add(new THREE.CylinderGeometry(0.025, 0.04, 0.09, 8), oroMat, 0.105);
  add(new THREE.CylinderGeometry(0.11, 0.05, 0.16, 12), oroMat, 0.23);
  for (const s of [-1, 1]) { const m = add(new THREE.TorusGeometry(0.05, 0.014, 6, 12), oroMat, 0.25); m.position.x = s * 0.11; }
  return g;
}
function bandiera(colori) {
  const g = new THREE.Group(), w = 0.3 / colori.length;
  const asta = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 1, 6), lambert('#9AA3AE'));
  asta.position.y = 0.5; g.add(asta);
  const telo = new THREE.Group(); telo.position.y = 0.88; g.add(telo);
  colori.forEach((c, i) => { const s = new THREE.Mesh(new THREE.BoxGeometry(w, 0.2, 0.012), lambert(c)); s.position.x = 0.012 + w / 2 + i * w; telo.add(s); });
  g.userData.telo = telo;
  return g;
}
function palloncini(h) {
  const g = new THREE.Group(), cores = ['#E0473C', '#FFC93C', '#3FA7F5', '#2E9B55', '#FF7EB6'], base = new THREE.Vector3(0.32, 0.12, 0.3);
  const fili = [];
  cores.forEach((c, i) => {
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.085, 10, 8), lambert(c));
    b.scale.y = 1.2;
    const a = i / cores.length * Math.PI * 2;
    b.userData.casa = new THREE.Vector3(base.x + Math.cos(a) * 0.14, h * 0.75 + 0.35 + (i % 2) * 0.14, base.z + Math.sin(a) * 0.14);
    b.position.copy(b.userData.casa);
    g.add(b);
    const filo = new THREE.Line(new THREE.BufferGeometry().setFromPoints([base, b.position.clone()]), new THREE.LineBasicMaterial({ color: '#FFFFFF' }));
    g.add(filo); fili.push([filo, b]);
  });
  g.userData.anima = t => fili.forEach(([f, b], i) => {
    b.position.copy(b.userData.casa); b.position.y += Math.sin(t * 0.002 + i) * 0.03; b.position.x += Math.sin(t * 0.0013 + i * 2) * 0.02;
    const p = f.geometry.attributes.position; p.setXYZ(1, b.position.x, b.position.y - 0.1, b.position.z); p.needsUpdate = true;
  });
  return g;
}
function scintille() {
  const g = new THREE.Group(), geo = new THREE.OctahedronGeometry(0.035), m = basico('#FFF6C8');
  for (let k = 0; k < 10; k++) { const s = new THREE.Mesh(geo, m); s.userData.k = k; g.add(s); }
  return g;
}
function alone(cor) {
  const m = new THREE.Mesh(new THREE.CircleGeometry(0.75, 28), new THREE.MeshBasicMaterial({ color: cor, transparent: true, opacity: 0.45, blending: THREE.AdditiveBlending, depthWrite: false }));
  m.rotation.x = -Math.PI / 2; m.position.y = 0.012;
  return m;
}
// faísca redonda com brilho (as partículas sem textura saem quadradas)
let _bolinha = null;
function bolinha() {
  if (_bolinha) return _bolinha;
  const c = document.createElement('canvas'); c.width = c.height = 32;
  const g = c.getContext('2d'), r = g.createRadialGradient(16, 16, 0, 16, 16, 16);
  r.addColorStop(0, '#fff'); r.addColorStop(0.35, 'rgba(255,255,255,.8)'); r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r; g.fillRect(0, 0, 32, 32);
  return (_bolinha = new THREE.CanvasTexture(c));
}
// fogos: 3 explosões que se revezam acima da casa (partículas aditivas)
function fuochi(h) {
  const N = 48, E = 3, pos = new Float32Array(N * E * 3), col = new Float32Array(N * E * 3);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const pts = new THREE.Points(geo, new THREE.PointsMaterial({ size: 0.0075, map: bolinha(), vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  pts.frustumCulled = false;
  const dirs = Array.from({ length: N }, () => new THREE.Vector3().randomDirection());
  const palette = ['#FF5A5A', '#FFD34D', '#5AD1FF', '#7DFF8A', '#FF8AE2', '#FFFFFF'];
  const scoppi = Array.from({ length: E }, () => ({ t0: -1e9, c: new THREE.Vector3(), cor: new THREE.Color() }));
  pts.userData.anima = t => {
    scoppi.forEach((s, e) => {
      const vita = 1500;
      if (t - s.t0 > vita) {
        s.t0 = t + e * 120; s.c.set((Math.random() - 0.5) * 0.9, h + 1.0 + Math.random() * 0.7, (Math.random() - 0.5) * 0.9);
        s.cor.set(palette[Math.floor(Math.random() * palette.length)]);
      }
      const k = Math.max(0, Math.min(1, (t - s.t0) / vita)), r = 0.55 * (1 - Math.pow(1 - k, 3)), luz = k <= 0 ? 0 : Math.pow(1 - k, 1.5);
      for (let i = 0; i < N; i++) {
        const j = (e * N + i) * 3, d = dirs[i];
        pos[j] = s.c.x + d.x * r; pos[j + 1] = s.c.y + d.y * r - k * k * 0.25; pos[j + 2] = s.c.z + d.z * r;
        col[j] = s.cor.r * luz; col[j + 1] = s.cor.g * luz; col[j + 2] = s.cor.b * luz;
      }
    });
    geo.attributes.position.needsUpdate = true; geo.attributes.color.needsUpdate = true;
  };
  return pts;
}

// altura total com o que flutua e os fogos (em lotes; para enquadrar a câmera)
const topoDi = (casa, sel) => {
  const ex = sel.extra, h = ALTURA_NIVEL[casa.livello];
  const y = h + 0.25 + (ex.has('corona') ? 0.35 : 0) + (ex.has('campione') ? 0.42 : 0);
  return ex.has('fuochi') ? y + 0.9 : Math.max(y, ex.has('palloncini') ? h * 0.75 + 0.6 : 0);
};

// monta o grupo 3D da casa decorada: { g, anima, pilha } (pilha = topo do que flutua; o rótulo do @ fica acima)
function costruisci(D, citta, notte, casa, sel) {
  const l = D.luoghi[casa.luogo], stile = stileRegione(l.regione.cod), h = ALTURA_NIVEL[casa.livello];
  const g = new THREE.Group(), anim = [];
  const p = citta.posCasa(casa);
  g.position.set(p.x, p.y + 0.0009, p.z);
  g.rotation.y = posLote(casa.lote).rot;
  g.scale.setScalar(LOTE);
  const ex = sel.extra, oro = ex.has('oro'), squadra = SQUADRE.find(s => s.id === sel.squadra);
  const base = geoCasa(casa.livello, variante(casa.conta), stile);
  const pal = oro ? ORO : squadra;
  const corpo = new THREE.Mesh(pal ? ricolora(base, pal) : base, oro ? matOro : citta.mat);
  g.add(corpo);
  // bandeira: num mastro ao lado da casa; nas torres (casa alta), no terraço
  const pianta = (b, lado) => {
    if (h > 1.5) { b.position.set(lado * 0.12, h - 0.05, 0); b.scale.setScalar(0.8); }
    else { b.position.set(lado * 0.38, 0, 0.36); b.scale.setScalar(Math.max(1, h * 0.9)); }
    g.add(b);
  };
  if (squadra) { const b = bandiera([squadra.muro, squadra.tetto, squadra.muro, squadra.tetto]); pianta(b, -1); anim.push(t => { b.userData.telo.rotation.y = Math.sin(t * 0.004) * 0.35; }); }
  if (ex.has('tricolore')) { const b = bandiera(['#2E9B55', '#FFFFFF', '#E0473C']); pianta(b, 1); anim.push(t => { b.userData.telo.rotation.y = Math.sin(t * 0.004 + 1) * 0.35; }); }
  if (oro) {
    const s = scintille(); g.add(s); g.add(alone('#FFC93C'));
    anim.push(t => {
      matOro.emissive.set(notte() ? '#9C7608' : '#4A3600'); oroMat.emissive.set(notte() ? '#B38A10' : '#5A4300');
      s.children.forEach(c => { const k = c.userData.k, a = t * 0.0009 + k * 0.63; c.position.set(Math.cos(a) * 0.55, 0.15 + ((k * 0.37) % 1) * (h + 0.3), Math.sin(a) * 0.55); c.rotation.y = t * 0.004; c.scale.setScalar(0.5 + 0.6 * Math.abs(Math.sin(t * 0.005 + k))); });
    });
  }
  if (ex.has('neon')) {
    const m = new THREE.MeshBasicMaterial({ color: '#00E5FF', side: THREE.BackSide });
    const guscio = new THREE.Mesh(corpo.geometry, m);
    guscio.scale.set(1.07, 1.035, 1.07); guscio.position.y = -0.01; g.add(guscio);
    const a = alone('#00E5FF'); g.add(a);
    anim.push(t => { m.color.setHSL((t * 0.00012) % 1, 1, 0.55); a.material.color.copy(m.color); });
  }
  // coisas que flutuam em cima da casa, uma acima da outra
  let y = h + 0.25;
  if (ex.has('corona')) { const c = corona(); g.add(c); const y0 = y; anim.push(t => { c.position.set(0, y0 + Math.sin(t * 0.003) * 0.04, 0); c.rotation.y = t * 0.0012; }); y += 0.35; }
  if (ex.has('campione')) { const c = trofeo(); g.add(c); const y0 = y; anim.push(t => { c.position.set(0, y0 + Math.sin(t * 0.003 + 1) * 0.04, 0); c.rotation.y = -t * 0.001; }); y += 0.42; }
  if (ex.has('palloncini')) { const b = palloncini(h); g.add(b); anim.push(b.userData.anima); }
  if (ex.has('fuochi')) { const f = fuochi(y - 0.35); g.add(f); anim.push(f.userData.anima); }
  const anima = t => anim.forEach(f => f(t));
  anima(performance.now());   // posições iniciais (a foto da story pode sair antes do próximo quadro)
  return { g, anima, pilha: y - 0.25 > h ? y - 0.1 : h };
}

const vuota = () => ({ squadra: null, extra: new Set() });
const copia = s => ({ squadra: s.squadra, extra: new Set(s.extra) });
const quanti = s => (s.squadra ? 1 : 0) + s.extra.size;

export class Decori {
  constructor(D, mappa, citta, festa) {
    this.D = D; this.mappa = mappa; this.citta = citta; this.festa = festa;
    this.ui = null;              // ligado pelo main.js depois de criar a UI
    this.pagate = new Map();     // conta -> { id, conta, da, sel, scade } (data/decori.json)
    this.attive = new Map();     // conta -> { casa, sel, da, g, anima, pilha } (desenhadas agora: pagas + prévia)
    this.ed = null;              // edição aberta: { modo, casa, sel, da }
    this.giro = null;            // câmera girando em volta da casa
    this.cfg = { attivo: false, prezzo: 499, giorni: 10, checkout: '' };
    this.ANIM = {}; this.GIRO = {};
    mappa.aoFrame.push(t => this.quadro(t));
    mappa.aoMover.push(() => this.visibili());
    mappa.canvas.addEventListener('pointerdown', () => this.ferma());
    mappa.canvas.addEventListener('wheel', () => this.ferma());
  }

  get aperto() { return this.cfg.attivo || new URLSearchParams(location.search).has('decora'); }

  async iniciar() {
    try { Object.assign(this.cfg, (await (await fetch(`data/negozio.json?t=${Date.now()}`)).json()).decora ?? {}); } catch { /* sem config: fica desligado */ }
    if (this.aperto) this.ligarPillola();
    await this.ricarica();
    if (this.aperto && location.hash === '#decora') this.home();   // link da página do produto na Hotmart
    setInterval(() => this.ricarica(), 120e3);
    // voltou do pagamento: espera o webhook confirmar
    const at = ler('decora_attesa');
    if (at && Date.now() - at.t < 3 * 3600e3) this.aspetta(at);
    else gravar('decora_attesa', null);
  }

  // ---------- compras pagas (data/decori.json) ----------
  async ricarica() {
    let lista = [];
    try { const r = await fetch(`data/decori.json?t=${Date.now()}`, { cache: 'no-store' }); if (r.ok) lista = (await r.json()).decori ?? []; } catch { /* sem arquivo ainda */ }
    const agora = Date.now(), novas = new Map();
    for (const x of lista) {
      if (Date.parse(x.scade) <= agora || !this.D.porConta.has(x.conta)) continue;
      novas.set(x.conta, { id: x.id, conta: x.conta, da: x.da || null, scade: Date.parse(x.scade), sel: { squadra: x.squadra || null, extra: new Set(x.extra ?? []) } });
    }
    const chave = m => JSON.stringify([...m.values()].map(x => [x.id, x.conta]));
    if (chave(novas) === chave(this.pagate)) return;
    const vecchie = this.pagate;
    this.pagate = novas;
    for (const conta of new Set([...vecchie.keys(), ...novas.keys()])) {
      if (this.ed?.casa.conta === conta) continue;   // prévia aberta: não mexe
      const p = novas.get(conta);
      this.disegna(this.D.porConta.get(conta), p ? p.sel : vuota(), p?.da);
    }
    // painel dessa casa aberto (ex.: ?casa= no carregamento): refaz para mostrar o selo
    const aberta = !this.ed && !this.ui.painel.hidden && $('#pannello h2.conta')?.textContent.slice(1);
    if (aberta && (vecchie.has(aberta) || novas.has(aberta))) this.ui.casa(this.D.porConta.get(aberta), false);
  }
  pagata(conta) { const p = this.pagate.get(conta); return p && p.scade > Date.now() ? p : null; }

  // ---------- desenho ----------
  // tira a casa do InstancedMesh da cidade (a cidade é remontada) e desenha a versão decorada; sel vazia = casa normal
  disegna(casa, sel, da = null) {
    if (!casa) return;
    const c = this.citta, l = this.D.luoghi[casa.luogo], velha = this.attive.get(casa.conta);
    if (velha) c.grupo.remove(velha.g);
    const tinha = c.nascoste.has(casa.conta), vazia = !quanti(sel);
    if (vazia) { this.attive.delete(casa.conta); c.nascoste.delete(casa.conta); }
    else c.nascoste.add(casa.conta);
    if (tinha === vazia) { c.cache.delete(l.id); c.ultimo = null; c.atualizar(true); }   // muda quem está no InstancedMesh
    if (!vazia) {
      const o = costruisci(this.D, c, () => !!this.mappa.notte, casa, sel);
      c.grupo.add(o.g);
      this.attive.set(casa.conta, { casa, sel, da, ...o });
    }
    this.visibili();
    this.mappa.sujo = true;
  }
  // só as decorações das cidades perto da câmera aparecem e animam (longe não gasta bateria)
  visibili() {
    const perto = new Set(this.citta.grupo.visible ? this.citta.perto : []);
    let alguma = false;
    for (const a of this.attive.values()) { a.g.visible = perto.has(this.D.luoghi[a.casa.luogo]); alguma ||= a.g.visible; }
    if (alguma) this.mappa.animatori.add(this.ANIM); else this.mappa.animatori.delete(this.ANIM);
  }
  quadro(t) {
    for (const a of this.attive.values()) if (a.g.visible) a.anima(t);
    if (this.giro && !this.mappa.voo) { this.giro.az += 0.0022; this.inquadra(this.giro.casa, this.giro.az); }
  }

  // rótulo do @ das casas decoradas (etichette.js): moldura dourada e/ou "🎁 da @fulano"; null = casa normal
  etichetta(casa) {
    const a = this.attive.get(casa.conta);
    if (!a) return null;
    const fogo = casa.fiamme > Date.now() / 1000, base = `${fogo ? '🔥 ' : ''}@${esc(casa.conta)}`, cornice = a.sel.extra.has('cornice');
    const y = casa.y + (a.pilha + 0.25) * LOTE;
    if (a.da) return { cls: `et-casa ${cornice ? 'vip' : 'regalo'}`, html: `${cornice ? '✨ ' : ''}${base}<small>🎁 da @${esc(a.da)}</small>`, y };
    if (cornice) return { cls: 'et-casa vip', html: `✨ ${base}<small>CASA SPECIALE</small>`, y };
    return { cls: 'et-casa deco', html: `✨ ${base}`, y };
  }
  vicine(perto) {
    const s = new Set(perto), out = [];
    for (const a of this.attive.values()) if (s.has(this.D.luoghi[a.casa.luogo])) out.push(a.casa);
    return out;
  }

  // ---------- painel da casa (ui.js) ----------
  badge(casa) {
    const p = this.pagata(casa.conta);
    if (!p) return '';
    return p.da ? `<span class="badge regalo">🎁 Regalo da @${esc(p.da)} · fino al ${dataCurta(p.scade)}</span>` : `<span class="badge regalo">✨ Casa speciale fino al ${dataCurta(p.scade)}</span>`;
  }
  bottone(casa, eMinha) {
    if (!this.aperto) return '';
    return eMinha ? `<button class="decora-btn" data-decora="${esc(casa.conta)}" data-modo="mia">✨ Decora la tua casa</button>`
      : `<button class="decora-btn" data-decora="${esc(casa.conta)}">🎁 Fai un regalo a @${esc(casa.conta)}</button>`;
  }

  // ---------- câmera ----------
  enquadra(casa) {
    const sel = this.attive.get(casa.conta)?.sel ?? vuota(), topo = topoDi(casa, sel) * LOTE;
    return { d: 0.24 + topo * 3.4, k: innerWidth >= 900 ? [-0.32, 0] : [0, ALTURA_NIVEL[casa.livello] > 1.5 ? 0.05 : 0.2] };
  }
  inquadra(casa, az) {
    const alvo = this.enquadra(casa), g = this.giro, mp = this.mappa;
    // muda devagar quando a seleção muda a altura (ex.: ligou os fogos)
    g.d = g.d ? g.d + (alvo.d - g.d) * 0.06 : mp.dist;
    g.k = g.k ? g.k + (alvo.k[1] - g.k) * 0.06 : alvo.k[1];
    const d = g.d, k = [alvo.k[0], g.k];
    mp.alvo.x = casa.x + Math.cos(az) * k[0] * d + Math.sin(az) * k[1] * d;
    mp.alvo.z = casa.z - Math.sin(az) * k[0] * d + Math.cos(az) * k[1] * d;
    mp.dist = d; mp.az = az;
    mp.atualizarCamera();
  }
  vaiACasa(casa) {
    this.citta.posCasa(casa);
    const az = posLote(casa.lote).rot === 0 ? 0.5 : Math.PI + 0.5;   // de frente para a porta
    const { d, k } = this.enquadra(casa);
    document.body.classList.add('decora-edit');
    this.mappa.voar({ x: casa.x + Math.cos(az) * k[0] * d + Math.sin(az) * k[1] * d, z: casa.z - Math.sin(az) * k[0] * d + Math.cos(az) * k[1] * d, dist: d, az });
    this.giro = { casa, az };
    this.mappa.animatori.add(this.GIRO);
    this.ui.et.destaque = casa.conta;
  }
  ferma() { this.giro = null; this.mappa.animatori.delete(this.GIRO); }
  // fechou o painel: desfaz a prévia não paga (ui.fechar chama)
  chiudi() {
    this.annulla(); this.ferma();
    document.body.classList.remove('decora-edit');
  }
  annulla() {
    if (!this.ed) return;
    const casa = this.ed.casa, p = this.pagata(casa.conta);
    this.ed = null;
    this.disegna(casa, p ? copia(p.sel) : vuota(), p?.da);
  }

  // ---------- pílula ----------
  ligarPillola() {
    const b = $('#decora'), velho = $('#fai-video');
    if (!b) return;
    b.hidden = false;
    if (velho) velho.hidden = true;
    const testo = b.querySelector('.testo'), frasi = ['✨ Decora la tua casa', '🎁 Regala a un amico'];
    let i = 0;
    setInterval(() => { testo.classList.add('via'); setTimeout(() => { i = (i + 1) % frasi.length; testo.textContent = frasi[i]; testo.classList.remove('via'); }, 250); }, 3200);
    b.onclick = () => this.home();
  }

  // ---------- telas ----------
  azione(t) {
    const d = t.dataset, v = d.v, ed = this.ed;
    ({
      mia: () => (this.ui.minha && this.D.porConta.get(this.ui.minha) ? this.editor('mia', this.D.porConta.get(this.ui.minha)) : this.scegli('mia')),
      regalo: () => this.scegli('regalo'),
      scelto: () => this.editor(d.modo, this.D.porConta.get(v)),
      squadra: () => { ed.sel.squadra = ed.sel.squadra === v ? null : v; if (ed.sel.squadra) ed.sel.extra.delete('oro'); this.aggiorna(); },
      eff: () => { const s = ed.sel.extra; s.has(v) ? s.delete(v) : s.add(v); if (v === 'oro' && s.has('oro')) ed.sel.squadra = null; this.aggiorna(); },
      notte: () => { this.mappa.definirNotte(v === '1'); if (this.festa?.luci) this.festa.luci.visible = v === '1'; },
      checkout: () => this.checkout(),
      paga: () => this.paga(t),
      indietro: () => this.editor(ed.modo, ed.casa, true),
      home: () => this.home(),
    })[d.dp]?.();
  }

  home() {
    this.annulla(); this.ferma(); document.body.classList.remove('decora-edit');
    this.ui.abrir(`
      <h2>Rendi speciale una casa ✨</h2>
      <div class="sub">Provala <b>gratis</b> qui sulla mappa. Paghi solo se ti piace: <b>${eur(this.cfg.prezzo)}</b>, tutto incluso, per ${this.cfg.giorni} giorni.</div>
      <div class="scelta2">
        <button data-dp="mia"><span class="em">🏠</span><span><b>La mia casa</b><small>Colori della tua squadra, casa d’oro, neon, corona…</small></span></button>
        <button data-dp="regalo"><span class="em">🎁</span><span><b>Regala a un amico</b><small>Una sorpresa sulla sua casa, con il tuo nome sopra</small></span></button>
      </div>
      <div class="regola">✅ Solo estetica: non dà punti e non cambia la classifica. Vince sempre chi gioca.</div>`);
  }
  // botão do painel da casa: casa de outra pessoa = presente; a sua = decorar
  apri(conta, modo) {
    const casa = this.D.porConta.get(conta);
    if (casa) this.editor(modo === 'mia' || this.ui.minha === conta ? 'mia' : 'regalo', casa);
  }

  scegli(modo) {
    this.ui.abrir(`
      <h2>${modo === 'regalo' ? 'A chi vuoi fare il regalo? 🎁' : 'Qual è la tua casa? 🏠'}</h2>
      <div class="sub">${modo === 'regalo' ? 'Scrivi il suo @ di Instagram: deve avere già una casa sulla mappa.' : 'Scrivi il tuo @ di Instagram.'}</div>
      <div class="cerca-dec"><span>@</span><input id="dec-q" placeholder="${modo === 'regalo' ? 'il_suo_account' : 'il_tuo_account'}" autocomplete="off" autocapitalize="off" spellcheck="false"></div>
      <div class="sugg-dec" id="dec-sugg"></div>
      <div class="bottoni"><button class="sec" data-dp="home">← indietro</button></div>`);
    const q = $('#dec-q'), out = $('#dec-sugg');
    q.oninput = () => {
      const t = q.value.trim().replace(/^@/, '').toLowerCase();
      if (t.length < 2) { out.innerHTML = ''; return; }
      const res = [];
      for (const c of this.D.casas) { if (c.conta.startsWith(t)) res.push(c); if (res.length >= 6) break; }
      out.innerHTML = res.length ? res.map(c => `<button data-dp="scelto" data-modo="${modo}" data-v="${esc(c.conta)}">@${esc(c.conta)}<small>${esc(this.D.luoghi[c.luogo].nome)}</small></button>`).join('')
        : '<div class="nota">Nessuna casa con questo @. Per avere una casa basta commentare città e regione sotto un nostro post.</div>';
    };
    setTimeout(() => q.focus(), 50);
  }

  editor(modo, casa, manter = false) {
    if (!casa) return;
    if (!manter || !this.ed) {
      this.annulla();
      const p = this.pagata(casa.conta);
      this.ed = { modo, casa, sel: p && !p.da && modo === 'mia' ? copia(p.sel) : vuota(), da: modo === 'regalo' ? (this.ui.minha ?? '') : null };
    }
    const ed = this.ed;
    this.vaiACasa(casa);
    const l = this.D.luoghi[casa.luogo], regalo = modo === 'regalo';
    const eff = EFFETTI.filter(e => (regalo ? e.regalo : e.mia)), p = this.pagata(casa.conta);
    this.ui.abrir(`
      <div class="tag-luogo">📍 ${esc(l.nome)}</div>
      <h2 class="conta">${regalo ? '🎁 ' : ''}@${esc(casa.conta)}</h2>
      <div class="sub">${regalo ? 'Tocca un regalo: lo vedi subito sulla sua casa.' : 'Tocca e guarda la tua casa cambiare. È solo un’anteprima.'}</div>
      ${p ? `<div class="regola">${p.da ? `🎁 Ha già un regalo da @${esc(p.da)}` : '✨ È già decorata'} fino al ${dataCurta(p.scade)}: un nuovo acquisto la sostituisce.</div>` : ''}
      ${regalo ? `<div class="cerca-dec"><span>da @</span><input id="dec-da" placeholder="il_tuo_account" value="${esc(ed.da ?? '')}" autocomplete="off" autocapitalize="off" spellcheck="false"></div><div class="nota" id="dec-da-nota" style="margin-top:4px"></div>` : ''}
      ${regalo ? '' : `<div class="gruppo-dec">⚽ Colori della tua squadra</div>
      <div class="griglia-dec">${SQUADRE.map(s => `<button data-dp="squadra" data-v="${s.id}"><span class="sw" style="background:linear-gradient(90deg,${s.muro} 0 25%,${s.tetto} 25% 50%,${s.muro} 50% 75%,${s.tetto} 75%)"></span><b>${s.nome}</b></button>`).join('')}</div>`}
      <div class="gruppo-dec">${regalo ? '🎁 Scegli il regalo' : '✨ Effetti'} <small>· scegli quanti vuoi</small></div>
      <div class="griglia-dec">${eff.map(e => `<button data-dp="eff" data-v="${e.id}"><span class="em">${e.em}</span><b>${e.nome}</b></button>`).join('')}</div>
      <div class="riga-vista"><button data-dp="notte" data-v="0">☀️ Di giorno</button><button data-dp="notte" data-v="1">🌙 Di notte</button></div>
      <div class="conto-dec" id="dec-conto"></div>`);
    $('#dec-da')?.addEventListener('input', e => { ed.da = e.target.value.trim().replace(/^@/, '').toLowerCase(); this.aggiorna(false); });
    this.aggiorna();
  }

  okDa() { const e = this.ed; return e.modo !== 'regalo' || (!!e.da && this.D.porConta.has(e.da) && e.da !== e.casa.conta); }
  aggiorna(ridisegna = true) {
    const ed = this.ed;
    if (!ed) return;
    const painel = $('#pannello-contenuto');
    painel.querySelectorAll('[data-dp="squadra"]').forEach(b => b.classList.toggle('on', ed.sel.squadra === b.dataset.v));
    painel.querySelectorAll('[data-dp="eff"]').forEach(b => b.classList.toggle('on', ed.sel.extra.has(b.dataset.v)));
    const regalo = ed.modo === 'regalo', okDa = this.okDa();
    if (ridisegna) this.disegna(ed.casa, ed.sel, regalo ? (ed.da || '…') : null);
    else { const a = this.attive.get(ed.casa.conta); if (a) a.da = ed.da || '…'; }
    const nota = $('#dec-da-nota');
    if (nota) nota.textContent = !ed.da ? 'Il tuo @ apparirà sopra la casa: deve avere una casa sulla mappa.' : okDa ? `✓ Apparirà «🎁 da @${ed.da}»` : ed.da === ed.casa.conta ? 'Non puoi regalarlo a te stesso: usa «La mia casa».' : 'Questo @ non ha ancora una casa sulla mappa.';
    const n = quanti(ed.sel);
    $('#dec-conto').innerHTML = `
      <button class="paga-dec" data-dp="checkout" ${n && okDa ? '' : 'disabled'}>${n ? `${regalo ? '🎁 Regala' : '✨ Mostra a tutti'} · ${eur(this.cfg.prezzo)}` : 'Scegli almeno un effetto'}
        <small>${n && !okDa ? 'scrivi il tuo @ qui sopra' : `tutto incluso · visibile a tutti per ${this.cfg.giorni} giorni`}</small></button>`;
  }

  checkout() {
    const ed = this.ed, n = quanti(ed.sel);
    this.ferma();
    this.ui.abrir(`
      <h2>Quasi fatto! 🔒</h2>
      <div class="sub">${ed.modo === 'regalo' ? `Regalo per @${esc(ed.casa.conta)} da @${esc(ed.da)}` : `Casa di @${esc(ed.casa.conta)}`} · ${n} ${n === 1 ? 'effetto' : 'effetti'} · ${this.cfg.giorni} giorni · <b>${eur(this.cfg.prezzo)}</b></div>
      <label class="consenso-dec"><input type="checkbox" id="dec-ok"><span>Voglio che la decorazione si attivi subito dopo il pagamento. Ho letto la <a href="privacy.html#decorazioni" target="_blank" rel="noopener">privacy</a>.</span></label>
      <div class="regola">👨‍👩‍👧 Hai meno di 18 anni? Chiedi a un genitore prima di pagare.</div>
      <button class="paga-dec" data-dp="paga" style="margin-top:12px">Vai al pagamento sicuro · ${eur(this.cfg.prezzo)}<small>carta, PayPal, Google Pay · con Hotmart</small></button>
      <div class="bottoni"><button class="sec" data-dp="indietro">← torna</button></div>`);
  }

  async paga(botao) {
    const ed = this.ed;
    if (!$('#dec-ok')?.checked) return this.ui.aviso('Spunta la casella per continuare.');
    if (!this.cfg.checkout) return this.ui.aviso('Pagamento non ancora disponibile. Riprova più tardi.');
    botao.disabled = true;
    try {
      const r = await fetch('api/decora.php', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ conta: ed.casa.conta, modo: ed.modo, da: ed.modo === 'regalo' ? ed.da : '', squadra: ed.sel.squadra ?? '', extra: [...ed.sel.extra] }) });
      const j = await r.json().catch(() => ({}));
      if (!j.ok) throw new Error(j.erro || 'Non siamo riusciti a preparare il pagamento. Riprova.');
      gravar('decora_attesa', { id: j.id, conta: ed.casa.conta, modo: ed.modo, da: ed.da, sel: { squadra: ed.sel.squadra, extra: [...ed.sel.extra] }, t: Date.now() });
      location.href = `${this.cfg.checkout}${this.cfg.checkout.includes('?') ? '&' : '?'}sck=${j.id}`;
    } catch (e) {
      botao.disabled = false;
      this.ui.aviso(e.message);
    }
  }

  // de volta da Hotmart: confere o data/decori.json até o webhook confirmar (ou desistir em 3 h)
  aspetta(at) {
    let avisou = false;
    const tenta = async () => {
      await this.ricarica();
      if ([...this.pagate.values()].some(x => x.id === at.id)) { gravar('decora_attesa', null); return this.fatto(at); }
      if (Date.now() - at.t > 3 * 3600e3) return gravar('decora_attesa', null);
      if (!avisou) { avisou = true; this.ui.aviso('⏳ Aspettiamo la conferma del pagamento…'); }
      setTimeout(tenta, 15000);
    };
    tenta();
  }

  async fatto(at) {
    const casa = this.D.porConta.get(at.conta), p = this.pagate.get(at.conta);
    if (!casa || !p) return;
    this.coriandoli();
    this.vaiACasa(casa);
    const regalo = !!p.da, emoji = [...p.sel.extra].map(id => EFFETTI.find(e => e.id === id)?.em).filter(Boolean).join(' ');
    this.ui.abrir(`
      <h2>${regalo ? 'Regalo consegnato! 🎁' : 'Fatto! La tua casa brilla ✨'}</h2>
      <div class="sub">${regalo ? `@${esc(casa.conta)} lo vede appena apre la mappa. Mandagli la storia e taggalo! 👇` : `Ora la vedono tutti sulla mappa, fino al ${dataCurta(p.scade)}.`}</div>
      <div class="anteprima vuota" id="dec-img">preparo la storia…</div>
      <div class="bottoni"><button class="sec" data-dp="home">✨ Decora un’altra casa</button></div>`);
    await new Promise(r => setTimeout(r, 1800));   // espera o voo da câmera
    const url = await this.storia(casa, regalo ? '🎁 Un regalo per' : 'La mia casa è speciale ✨', `@${casa.conta}${regalo ? '!' : ''}`, regalo ? `${emoji} da @${p.da}` : `${emoji} ${this.D.luoghi[casa.luogo].nome}`.trim());
    const box = $('#dec-img');
    if (box) box.outerHTML = `<img class="anteprima" src="${url}" alt="storia"><a class="botao" download="${regalo ? 'regalo' : 'la-mia-casa'}.png" href="${url}">⬇️ Scarica la storia</a>`;
  }

  coriandoli() {
    const box = document.createElement('div'); box.className = 'coriandoli';
    const cores = ['#E0473C', '#FFC93C', '#3FA7F5', '#2E9B55', '#FF7EB6', '#7B2CBF'];
    for (let i = 0; i < 70; i++) { const c = document.createElement('i'); c.style.left = `${Math.random() * 100}%`; c.style.background = cores[i % cores.length]; c.style.animationDelay = `${Math.random() * 0.6}s`; box.appendChild(c); }
    document.body.appendChild(box);
    setTimeout(() => box.remove(), 3200);
  }

  // imagem de story 1080x1920: foto 3D da casa decorada + textos
  async storia(casa, t1, t2, t3) {
    await document.fonts.load('900 80px Nunito');
    const p = this.citta.posCasa(casa), topo = topoDi(casa, this.attive.get(casa.conta)?.sel ?? vuota()) * LOTE, notte = !!this.mappa.notte;
    const f = this.ui.fot.foto({ x: p.x, z: p.z, y: p.y + topo * 0.45, dist: 0.09 + topo * 2.6, az: this.mappa.az, el: 0.38, w: 1000, h: 1000 });
    const cv = document.createElement('canvas'); cv.width = 1080; cv.height = 1920;
    const g = cv.getContext('2d');
    const fundo = g.createLinearGradient(0, 0, 0, 1920); fundo.addColorStop(0, notte ? '#1E3560' : '#8EBFD2'); fundo.addColorStop(1, notte ? '#0E1A33' : '#5E9DB8');
    g.fillStyle = fundo; g.fillRect(0, 0, 1080, 1920);
    const testo = (s, y, size, cor) => {
      let sz = size; g.font = `900 ${sz}px Nunito`;
      while (g.measureText(s).width > 980 && sz > 40) { sz -= 4; g.font = `900 ${sz}px Nunito`; }
      g.textAlign = 'center'; g.lineJoin = 'round'; g.lineWidth = sz * 0.2; g.strokeStyle = '#152033'; g.strokeText(s, 540, y); g.fillStyle = cor; g.fillText(s, 540, y);
    };
    testo(t1, 260, 92, '#FFFFFF');
    testo(t2, 380, 100, '#FFC93C');
    g.save(); g.beginPath(); g.roundRect(40, 470, 1000, 1000, 48); g.clip(); g.drawImage(f.canvas, 40, 470, 1000, 1000); g.restore();
    g.lineWidth = 12; g.strokeStyle = '#152033'; g.beginPath(); g.roundRect(40, 470, 1000, 1000, 48); g.stroke();
    testo(t3, 1590, 70, '#FFFFFF');
    testo(`italiacasapercasa.com · @${PERFIL}`, 1760, 52, '#FFC93C');
    return cv.toDataURL('image/png');
  }
}
