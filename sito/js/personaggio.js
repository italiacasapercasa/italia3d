// Personagem do jogador (boneco da passeggiata): Uomo/Donna, pele, cabelo, cores. Salvo na conta (api/conto.php "personaggio").
// Grátis: tudo o que está em OPZ. Pagos com 💰 (fase 3): itens de data/crediti.json "personaggio" — aparecem com cadeado.
// A MESMA lista de opções grátis está em api/conto.php (validação): mudou aqui, mude lá.
import * as THREE from 'three';

const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const OPZ = {
  pelle: ['#F5D6B8', '#F2C9A0', '#E0AC7E', '#C68A5C', '#8D5A3B'],
  colCap: ['#1B1B1B', '#2B1B10', '#5A3A1E', '#8B5A2B', '#D9A441', '#B84A2A'],
  maglia: ['#E0473C', '#3FA9F5', '#2E9B55', '#FFC93C', '#8B5CF6', '#F97316', '#14B8A6', '#FFFFFF'],
  pant: ['#2D3A55', '#1F2430', '#6B7280', '#7A4A2A', '#E5E0D5', '#2E9B55', '#B91C1C', '#EC4899'],
  capelli: {
    uomo: [['corti', 'Corti'], ['ciuffo', 'Ciuffo'], ['ricci', 'Ricci'], ['rasati', 'Rasati'], ['calvo', 'Calvo']],
    donna: [['lunghi', 'Lunghi'], ['coda', 'Coda'], ['caschetto', 'Caschetto'], ['ricci', 'Ricci'], ['chignon', 'Chignon']],
  },
};
// cores das maglie "tifoso" (mesmas cores de decori.js SQUADRE: só as cores, sem nome/escudo de clube)
export const SQUADRE_PG = [['Bianconero', '#F4F4F2', '#1C1C1C'], ['Nerazzurro', '#1F5BB8', '#151515'], ['Rossonero', '#D3252B', '#151515'], ['Azzurro', '#5BB8EC', '#F6F6F6'],
  ['Giallorosso', '#F2B33D', '#8E1F2F'], ['Biancoceleste', '#F6F6F6', '#86C8EE'], ['Viola', '#6B3FA0', '#F2F2F2'], ['Granata', '#8B1E2B', '#F2F2F2'], ['Rossoblù', '#C8102E', '#0B2C6B']];
// itens pagos (data/crediti.json "personaggio"): 1 chapéu e 1 roupa especial de cada vez (igual a api/conto.php)
const GRUPPI = [['cappello', 'borsalino', 'natale'], ['tifoso', 'elegante', 'carnevale', 'natale']];
export function accCompatibili(acc, novo) {
  let out = acc.filter(a => a !== novo);
  for (const gr of GRUPPI) if (gr.includes(novo)) out = out.filter(a => !gr.includes(a));
  return [...out, novo];
}
const hash = s => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return Math.abs(h); };
// personagem padrão (antes de escolher): varia pelo @/e-mail
export function pgPadrao(seme = 'ospite') {
  const k = hash(seme), c = k % 2 ? 'donna' : 'uomo';
  return { c, pelle: k % 5, capelli: OPZ.capelli[c][(k >> 3) % 5][0], colCap: (k >> 5) % 6, maglia: (k >> 7) % 8, pant: (k >> 9) % 3, gonna: false, acc: [], squadra: 0 };
}
export function pgValido(pg) {
  if (!pg || !['uomo', 'donna'].includes(pg.c)) return null;
  const n = (v, max) => (Number.isInteger(v) && v >= 0 && v < max ? v : 0);
  const cap = OPZ.capelli[pg.c].some(([id]) => id === pg.capelli) ? pg.capelli : OPZ.capelli[pg.c][0][0];
  const acc = Array.isArray(pg.acc) ? pg.acc.filter(a => typeof a === 'string').slice(0, 6) : [];
  return { c: pg.c, pelle: n(pg.pelle, 5), capelli: cap, colCap: n(pg.colCap, 6), maglia: n(pg.maglia, 8), pant: n(pg.pant, 8), gonna: pg.c === 'donna' && !!pg.gonna,
    acc, squadra: n(pg.squadra, 9) };
}

// ---------- modelo 3D (olha para +z; pernas e braços em grupos para a animação de andar) ----------
export function costruisci(pg, H) {
  pg = pgValido(pg) ?? pgPadrao();
  const u = H, donna = pg.c === 'donna';
  const mats = new Map(), mat = c => { if (!mats.has(c)) mats.set(c, new THREE.MeshLambertMaterial({ color: c })); return mats.get(c); };
  const acc = new Set(pg.acc ?? []), sq = SQUADRE_PG[pg.squadra ?? 0];
  const pelle = OPZ.pelle[pg.pelle], cap = OPZ.colCap[pg.colCap];
  let magl = OPZ.maglia[pg.maglia], pant = OPZ.pant[pg.pant];
  if (acc.has('tifoso')) magl = sq[1];
  if (acc.has('elegante')) { magl = '#1F2A44'; pant = '#1F2A44'; }
  if (acc.has('natale')) { magl = '#C8102E'; pant = '#C8102E'; }
  if (acc.has('carnevale')) { magl = '#E0473C'; pant = '#2E9B55'; }
  const g = new THREE.Group();
  const caixa = (w, h, d, c, x, y, z) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w * u, h * u, d * u), mat(c)); m.position.set(x * u, y * u, z * u); return m; };
  const esfera = (r, c, x, y, z, sx = 1, sy = 1, sz = 1) => { const m = new THREE.Mesh(new THREE.SphereGeometry(r * u, 14, 10), mat(c)); m.position.set(x * u, y * u, z * u); m.scale.set(sx, sy, sz); return m; };
  const largo = donna ? 0.31 : 0.36;
  const perna = s => {
    const p = new THREE.Group(); p.position.set(s * 0.085 * u, 0.42 * u, 0);
    p.add(caixa(0.12, 0.42, 0.14, pg.gonna ? pelle : pant, 0, -0.21, 0));
    p.add(caixa(0.13, 0.07, 0.21, donna ? '#7A2E3B' : '#1F2430', 0, -0.4, 0.03));
    return p;
  };
  const braco = s => {
    const b = new THREE.Group(); b.position.set(s * (largo / 2 + 0.04) * u, 0.78 * u, 0);
    b.add(caixa(0.085, 0.34, 0.1, magl, 0, -0.15, 0)); b.add(caixa(0.075, 0.08, 0.085, pelle, 0, -0.34, 0));
    return b;
  };
  const pe = perna(-1), pd = perna(1), be = braco(-1), bd = braco(1);
  g.add(pe, pd, be, bd);
  g.add(caixa(largo, 0.4, 0.2, magl, 0, 0.62, 0));                                   // tronco
  if (donna) g.add(caixa(largo * 0.86, 0.1, 0.21, magl, 0, 0.47, 0));                 // cintura
  if (pg.gonna) { const s = new THREE.Mesh(new THREE.CylinderGeometry(0.15 * u, 0.24 * u, 0.24 * u, 12), mat(pant)); s.position.y = 0.36 * u; g.add(s); }
  else g.add(caixa(largo * 0.95, 0.08, 0.19, pant, 0, 0.44, 0));                      // quadril
  g.add(caixa(0.09, 0.06, 0.09, pelle, 0, 0.84, 0));                                  // pescoço
  g.add(esfera(0.15, pelle, 0, 0.97, 0));                                             // cabeça
  for (const s of [-1, 1]) g.add(esfera(0.022, '#152033', s * 0.055, 0.99, 0.137));   // olhos
  if (donna) for (const s of [-1, 1]) g.add(esfera(0.012, '#E0473C', s * 0.03, 0.915, 0.142, 1.6, 0.8, 0.6)); // boca
  // cabelo
  const calotta = (cobre = 0.55, esc_ = 1.04, rx = -0.25) => { const m = new THREE.Mesh(new THREE.SphereGeometry(0.15 * u * esc_, 14, 8, 0, Math.PI * 2, 0, Math.PI * cobre), mat(cap)); m.position.y = 0.99 * u; m.rotation.x = rx; return m; };
  switch (pg.capelli) {
    case 'corti': g.add(calotta()); break;
    case 'ciuffo': g.add(calotta()); g.add(caixa(0.14, 0.07, 0.1, cap, 0, 1.11, 0.08)); break;
    case 'ricci': for (const [x, y, z] of [[0, 1.12, 0], [-0.09, 1.08, 0.02], [0.09, 1.08, 0.02], [-0.06, 1.09, -0.08], [0.06, 1.09, -0.08], [0, 1.06, 0.1], [-0.12, 1.0, -0.04], [0.12, 1.0, -0.04]]) g.add(esfera(0.065, cap, x, y, z)); if (donna) for (const s of [-1, 1]) g.add(esfera(0.07, cap, s * 0.12, 0.88, -0.05)); break;
    case 'rasati': g.add(calotta(0.45, 1.01, -0.15)); break;
    case 'calvo': break;
    case 'lunghi': g.add(calotta(0.6)); g.add(caixa(0.3, 0.42, 0.08, cap, 0, 0.82, -0.11)); for (const s of [-1, 1]) g.add(caixa(0.05, 0.3, 0.12, cap, s * 0.14, 0.88, -0.04)); break;
    case 'coda': g.add(calotta(0.6)); g.add(esfera(0.06, cap, 0, 1.02, -0.16)); g.add(caixa(0.08, 0.26, 0.08, cap, 0, 0.86, -0.19)); break;
    case 'caschetto': g.add(calotta(0.62, 1.12, -0.1)); for (const s of [-1, 1]) g.add(caixa(0.05, 0.16, 0.2, cap, s * 0.155, 0.92, -0.02)); g.add(caixa(0.3, 0.16, 0.06, cap, 0, 0.92, -0.13)); break;
    case 'chignon': g.add(calotta(0.6)); g.add(esfera(0.085, cap, 0, 1.13, -0.08)); break;
  }
  // ---------- itens pagos ----------
  const cil = (rt, rb, h, c, x, y, z, seg = 14) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(rt * u, rb * u, h * u, seg), mat(c)); m.position.set(x * u, y * u, z * u); return m; };
  if (acc.has('tifoso')) { for (const x of [-0.09, 0, 0.09]) g.add(caixa(0.035, 0.4, 0.012, sq[2], x * (largo / 0.36), 0.62, 0.103)); g.add(caixa(0.1, 0.1, 0.012, sq[2], 0, 0.68, -0.104)); }
  if (acc.has('elegante')) { g.add(caixa(0.11, 0.3, 0.012, '#FFFFFF', 0, 0.67, 0.102)); g.add(caixa(0.04, 0.24, 0.016, '#B91C1C', 0, 0.66, 0.108)); }
  if (acc.has('carnevale')) {   // rombi di Arlecchino + mascherina
    const C = ['#E0473C', '#2E9B55', '#FFC93C', '#3FA9F5'];
    for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) g.add(caixa(largo / 2 - 0.004, 0.2 - 0.004, 0.012, C[(i + j * 2) % 4], (i - 0.5) * largo / 2, 0.52 + j * 0.2, 0.103));
    g.add(caixa(0.26, 0.06, 0.03, '#111111', 0, 0.995, 0.135));
  }
  if (acc.has('natale')) {
    g.add(caixa(largo + 0.01, 0.05, 0.21, '#1B1B1B', 0, 0.47, 0)); g.add(caixa(0.06, 0.05, 0.012, '#FFC93C', 0, 0.47, 0.11));
    g.add(esfera(0.1, '#FFFFFF', 0, 0.9, 0.08, 1.1, 1, 0.7));                                        // barba
    g.add(cil(0.165, 0.165, 0.05, '#FFFFFF', 0, 1.08, 0));                                          // cappello di Babbo Natale
    const cono = cil(0.001, 0.15, 0.26, '#C8102E', 0, 1.22, -0.02); cono.rotation.x = -0.35; g.add(cono);
    g.add(esfera(0.04, '#FFFFFF', 0, 1.31, -0.1));
  }
  if (acc.has('cappello')) { const cp = new THREE.Mesh(new THREE.SphereGeometry(0.162 * u, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.5), mat('#E0473C')); cp.position.y = 1.0 * u; g.add(cp); g.add(caixa(0.2, 0.02, 0.14, '#E0473C', 0, 1.01, 0.17)); }
  if (acc.has('borsalino')) { g.add(cil(0.26, 0.26, 0.02, '#2B2B2B', 0, 1.09, 0, 18)); g.add(cil(0.13, 0.145, 0.15, '#2B2B2B', 0, 1.17, 0)); g.add(cil(0.147, 0.147, 0.035, '#8B1E2B', 0, 1.115, 0)); }
  if (acc.has('occhiali')) { for (const s of [-1, 1]) g.add(caixa(0.085, 0.05, 0.02, '#111111', s * 0.06, 0.995, 0.145)); g.add(caixa(0.05, 0.015, 0.015, '#111111', 0, 1.005, 0.148)); }
  let cane = null, aura = null;
  if (acc.has('cane')) {   // cagnolino: sta dietro a destra e scodinzola (passeggio.js anima la coda)
    cane = new THREE.Group(); cane.position.set(0.32 * u, 0, -0.3 * u);
    const pel = '#C8955C', sc = '#7A4A2A';
    cane.add(caixa(0.12, 0.1, 0.24, pel, 0, 0.16, 0)); cane.add(caixa(0.11, 0.1, 0.11, pel, 0, 0.25, 0.14)); cane.add(caixa(0.06, 0.04, 0.06, sc, 0, 0.23, 0.21));
    for (const s of [-1, 1]) { cane.add(caixa(0.03, 0.06, 0.04, sc, s * 0.045, 0.32, 0.12)); for (const z of [-0.08, 0.08]) cane.add(caixa(0.035, 0.11, 0.035, pel, s * 0.04, 0.055, z)); }
    const coda = new THREE.Group(); coda.position.set(0, 0.2 * u, -0.12 * u); coda.add(caixa(0.025, 0.1, 0.025, pel, 0, 0.05, 0)); coda.rotation.x = -0.6; cane.add(coda);
    cane.userData.coda = coda;
    g.add(cane);
  }
  if (acc.has('aura')) {   // stelline che girano intorno
    aura = new THREE.Group();
    const m = new THREE.MeshBasicMaterial({ color: '#FFD34D' });
    for (let i = 0; i < 8; i++) { const s = new THREE.Mesh(new THREE.OctahedronGeometry(0.035 * u), m); const a = i / 8 * Math.PI * 2; s.position.set(Math.cos(a) * 0.32 * u, (0.25 + (i % 3) * 0.3) * u, Math.sin(a) * 0.32 * u); aura.add(s); }
    g.add(aura);
  }
  const sombra = new THREE.Mesh(new THREE.CircleGeometry(0.22 * u, 16), new THREE.MeshBasicMaterial({ color: '#000', transparent: true, opacity: 0.22, depthWrite: false }));
  sombra.rotation.x = -Math.PI / 2; sombra.position.y = 0.003 * u; g.add(sombra);
  g.userData = { pe, pd, be, bd, cane, aura };
  return g;
}
// anima cagnolino e stelline (passeggio.js e prévia do editor chamam a cada quadro)
export function animaAcc(o, t) {
  const a = o.userData;
  if (a.cane) a.cane.userData.coda.rotation.z = Math.sin(t * 0.02) * 0.6;
  if (a.aura) { a.aura.rotation.y = t * 0.002; a.aura.children.forEach((s, i) => { s.rotation.y = t * 0.006; s.scale.setScalar(0.7 + 0.4 * Math.abs(Math.sin(t * 0.004 + i))); }); }
}

// ---------- editor (painel) ----------
export class EditorPersonaggio {
  constructor(ui, conto) {
    this.ui = ui; this.conto = conto;
    this.pg = null; this.dopo = null;
  }
  // dopo: função chamada depois de salvar (ex.: começar a passeggiata)
  apri(dopo = null) {
    const p = this.conto.p;
    if (!p) { this.conto.apri(); return; }
    this.dopo = dopo;
    this.pg = pgValido(p.pg) ?? pgPadrao(p.conta ?? p.email);
    this.prima = !p.pg;
    this.render();
  }
  render() {
    const pg = this.pg, sw = (campo, cores) => `<div class="pg-sw">${cores.map((c, i) => `<button type="button" data-pg="${campo}" data-v="${i}" class="${pg[campo] === i ? 'on' : ''}" style="background:${c}" aria-label="${campo} ${i + 1}"></button>`).join('')}</div>`;
    const own = new Set(this.conto.p?.oggetti ?? []);
    const cat = (this.conto.cfg?.personaggio ?? []).map(x => {
      const ho = own.has(`pg_${x.id}`), on = pg.acc.includes(x.id);
      return `<div class="ct-item pg-acc${on ? ' on' : ''}"><span>${x.icona}</span><b>${esc(x.nome)}</b>${ho
        ? `<button type="button" data-pg="acc" data-v="${x.id}" class="${on ? 'on' : 'sec'}">${on ? '✅ Indossato' : '👕 Indossa'}</button>`
        : `<button type="button" data-pg="compra" data-v="${x.id}">${Number(x.prezzo).toLocaleString('it-IT')} 💰</button>`}</div>`;
    }).join('');
    const tifo = pg.acc.includes('tifoso') ? `<h3 class="ct-h">⚽ Colori della maglia</h3><div class="pg-sw">${SQUADRE_PG.map(([nome, a, b], i) => `<button type="button" data-pg="squadra" data-v="${i}" class="${pg.squadra === i ? 'on' : ''}" style="background:linear-gradient(90deg,${a} 50%,${b} 50%)" aria-label="${nome}"></button>`).join('')}</div>` : '';
    this.ui.abrir(`
      <h2>🧍 ${this.prima ? 'Crea il tuo personaggio' : 'Il tuo personaggio'}</h2>
      <div class="sub">${this.prima ? 'Così ti vedranno passeggiare per le città.' : 'Cambialo quando vuoi: è gratis.'}</div>
      <div class="pg-anteprima"><canvas width="240" height="260"></canvas></div>
      <div class="pg-seg"><button type="button" data-pg="c" data-v="uomo" class="${pg.c === 'uomo' ? 'on' : ''}">👨 Uomo</button><button type="button" data-pg="c" data-v="donna" class="${pg.c === 'donna' ? 'on' : ''}">👩 Donna</button></div>
      <h3 class="ct-h">Pelle</h3>${sw('pelle', OPZ.pelle)}
      <h3 class="ct-h">Capelli</h3><div class="pg-opz">${OPZ.capelli[pg.c].map(([id, nome]) => `<button type="button" data-pg="capelli" data-v="${id}" class="${pg.capelli === id ? 'on' : ''}">${nome}</button>`).join('')}</div>
      ${pg.capelli !== 'calvo' ? sw('colCap', OPZ.colCap) : ''}
      <h3 class="ct-h">Maglia</h3>${sw('maglia', OPZ.maglia)}
      <h3 class="ct-h">${pg.gonna ? 'Gonna' : 'Pantaloni'}</h3>${sw('pant', OPZ.pant)}
      ${pg.c === 'donna' ? `<div class="pg-opz"><button type="button" data-pg="gonna" data-v="0" class="${!pg.gonna ? 'on' : ''}">👖 Pantaloni</button><button type="button" data-pg="gonna" data-v="1" class="${pg.gonna ? 'on' : ''}">👗 Gonna</button></div>` : ''}
      <div class="bottoni"><button data-pg="salva">${this.dopo ? '✅ Salva e passeggia' : '✅ Salva'}</button>${this.prima && this.dopo ? '' : '<button class="sec" data-pg="annulla">Annulla</button>'}</div>
      ${cat ? `<h3 class="ct-h">🛍️ Accessori con i crediti</h3><p class="ct-mini">Comprati una volta, sono tuoi per sempre: li metti e li togli quando vuoi. Hai ${Number(this.conto.p?.saldo ?? 0).toLocaleString('it-IT')} 💰.</p><div class="ct-cat pg-cat">${cat}</div>${tifo}` : ''}`, null);
    this.anteprima();
    this.ui.conteudo.querySelectorAll('[data-pg]').forEach(b => b.addEventListener('click', ev => { ev.stopPropagation(); this.azione(b); }));
  }
  async azione(b) {
    const campo = b.dataset.pg, v = b.dataset.v;
    if (campo === 'salva') return this.salva();
    if (campo === 'annulla') { this.ferma(); this.ui.fechar(); return; }
    if (campo === 'c') { if (this.pg.c === v) return; this.pg.c = v; this.pg.capelli = OPZ.capelli[v][0][0]; this.pg.gonna = false; }
    else if (campo === 'capelli') this.pg.capelli = v;
    else if (campo === 'gonna') this.pg.gonna = v === '1';
    else if (campo === 'acc') this.pg.acc = this.pg.acc.includes(v) ? this.pg.acc.filter(a => a !== v) : accCompatibili(this.pg.acc, v);
    else if (campo === 'compra') {
      const x = (this.conto.cfg?.personaggio ?? []).find(i => i.id === v);
      if (!x || !(await this.conto.compra(`pg_${v}`, x.nome, x.prezzo))) return;
      this.pg.acc = accCompatibili(this.pg.acc, v);
    }
    else this.pg[campo] = +v;
    const scroll = this.ui.conteudo.scrollTop;
    this.render();
    this.ui.conteudo.scrollTop = scroll;
  }
  async salva() {
    try {
      const j = await this.conto.api('personaggio', { pg: this.pg });
      this.conto.p = j.profilo;
      this.ferma();
      this.ui.aviso('🧍 Personaggio salvato!');
      const dopo = this.dopo; this.dopo = null;
      this.ui.passeggio?.aggiornaOmino();
      if (dopo) dopo(); else this.ui.fechar();
    } catch (e) { this.ui.aviso(e.message); }
  }

  // prévia 3D girando (renderer próprio e pequeno, só enquanto o painel está aberto)
  anteprima() {
    const cv = this.ui.conteudo.querySelector('.pg-anteprima canvas');
    if (!cv) return;
    if (!this.r) {
      this.r = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      this.r.setPixelRatio(Math.min(devicePixelRatio, 2));
      this.r.setSize(240, 260, false);
      this.cena = new THREE.Scene();
      this.cena.add(new THREE.HemisphereLight(0xffffff, 0xb9c7a8, 2.4));
      const sol = new THREE.DirectionalLight(0xfff1dc, 2.2); sol.position.set(-0.6, 1, 0.8); this.cena.add(sol);
      this.cam = new THREE.PerspectiveCamera(30, 240 / 260, 0.1, 20);
      this.cam.position.set(0, 0.86, 3.3); this.cam.lookAt(0, 0.72, 0);
    }
    // o canvas do painel é novo a cada render: desenha no renderer fixo e copia
    this.cv = cv; this.ctx = cv.getContext('2d');
    if (this.boneco) { this.cena.remove(this.boneco); this.boneco.traverse(o => o.geometry?.dispose()); }
    this.boneco = costruisci(this.pg, 1.2);
    this.cena.add(this.boneco);
    if (!this.giro) {
      const passo = t => {
        if (!this.cv?.isConnected) { this.giro = null; return; }
        this.boneco.rotation.y = Math.sin(t * 0.0009) * 0.8 + 0.25;
        animaAcc(this.boneco, t);
        this.r.render(this.cena, this.cam);
        this.ctx.clearRect(0, 0, 240, 260);
        this.ctx.drawImage(this.r.domElement, 0, 0, 240, 260);
        this.giro = requestAnimationFrame(passo);
      };
      this.giro = requestAnimationFrame(passo);
    }
  }
  ferma() { if (this.giro) cancelAnimationFrame(this.giro); this.giro = null; }
}
