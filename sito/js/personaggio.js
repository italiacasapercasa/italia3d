// Personagem do jogador (boneco da passeggiata), estilo "avatar" de jogo: corpo em blocos, cabeça redonda com rosto,
// cabelo, roupa, sapatos e peças por espaço (testa, viso, sopra, sotto, scarpe, collo, schiena, pet, effetto, completo).
// Grátis: tudo o que está em OPZ (corpo, rosto, cabelos, cores). Pagos com 💰: itens de data/crediti.json "personaggio"
// (cada um com "slot") e os "outfit" (vários itens juntos com desconto, comprados como pgo_<id>).
// Provador: tocando num item que não tem, ele aparece no boneco antes de comprar.
// A MESMA lista de opções grátis está em api/conto.php (validação): mudou aqui, mude lá.
import * as THREE from 'three';

const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const nIt = v => Number(v).toLocaleString('it-IT');
export const OPZ = {
  pelle: ['#F5D6B8', '#F2C9A0', '#E0AC7E', '#C68A5C', '#8D5A3B'],
  colCap: ['#1B1B1B', '#2B1B10', '#5A3A1E', '#8B5A2B', '#D9A441', '#B84A2A', '#F4F1EA', '#F4A6C0', '#3FA9F5', '#8B5CF6'],
  maglia: ['#E0473C', '#3FA9F5', '#2E9B55', '#FFC93C', '#8B5CF6', '#F97316', '#14B8A6', '#FFFFFF', '#1F2430', '#EC4899', '#F4A6C0', '#A7D98B'],
  pant: ['#2D3A55', '#1F2430', '#6B7280', '#7A4A2A', '#E5E0D5', '#2E9B55', '#B91C1C', '#EC4899', '#5B7FB8', '#F4F1EA'],
  scarpe: ['#1F2430', '#FFFFFF', '#7A4A2A', '#E0473C', '#3FA9F5', '#EC4899'],
  facce: [['sorriso', 'Sorriso'], ['felice', 'Felice'], ['occhiolino', 'Occhiolino'], ['cool', 'Cool'], ['carino', 'Carino'], ['stupito', 'Stupito']],
  capelli: [['corti', 'Corti'], ['ciuffo', 'Ciuffo'], ['spettinati', 'Spettinati'], ['ricci', 'Ricci'], ['afro', 'Afro'], ['rasati', 'Rasati'], ['calvo', 'Calvo'],
    ['lunghi', 'Lunghi'], ['coda', 'Coda'], ['codini', 'Codini'], ['trecce', 'Trecce'], ['caschetto', 'Caschetto'], ['chignon', 'Chignon']],
};
const CAP_UOMO = ['corti', 'ciuffo', 'spettinati', 'ricci', 'rasati'], CAP_DONNA = ['lunghi', 'coda', 'codini', 'caschetto', 'chignon'];
// cores das maglie "tifoso" (mesmas cores de decori.js SQUADRE: só as cores, sem nome/escudo de clube)
export const SQUADRE_PG = [['Bianconero', '#F4F4F2', '#1C1C1C'], ['Nerazzurro', '#1F5BB8', '#151515'], ['Rossonero', '#D3252B', '#151515'], ['Azzurro', '#5BB8EC', '#F6F6F6'],
  ['Giallorosso', '#F2B33D', '#8E1F2F'], ['Biancoceleste', '#F6F6F6', '#86C8EE'], ['Viola', '#6B3FA0', '#F2F2F2'], ['Granata', '#8B1E2B', '#F2F2F2'], ['Rossoblù', '#C8102E', '#0B2C6B']];
// espaço de cada item pago (igual a data/crediti.json "slot"; usado se o catálogo ainda não carregou)
const SLOT = {
  cappello: 'testa', borsalino: 'testa', berretto: 'testa', cappello_rovescio: 'testa', corona: 'testa', cuffie: 'testa', aureola: 'testa', corna: 'testa', cerchietto: 'testa',
  occhiali: 'viso', occhiali_cuore: 'viso', visiera: 'viso', occhi_stelle: 'espressione', occhi_cuore: 'espressione',
  onde_lunghe: 'capelli', chignon_doppio: 'capelli', cresta: 'capelli', anime: 'capelli',
  tifoso: 'sopra', felpa: 'sopra', giacca_college: 'sopra', piumino: 'sopra', crop_top: 'sopra', corsetto: 'sopra', tuta: 'sopra', hawaiana: 'sopra',
  cargo: 'sotto', jeans_strappati: 'sotto', tutu: 'sotto', shorts: 'sotto', tuta_pant: 'sotto',
  sneakers: 'scarpe', stivali_pelosi: 'scarpe', anfibi: 'scarpe',
  catena: 'collo', sciarpa: 'collo', zaino: 'schiena', ali_angelo: 'schiena', ali_demone: 'schiena', mantello: 'schiena',
  cane: 'pet', gatto: 'pet', draghetto: 'pet', aura: 'effetto', cuori: 'effetto',
  elegante: 'completo', carnevale: 'completo', natale: 'completo', astronauta: 'completo', ninja: 'completo', supereroe: 'completo', principessa: 'completo',
};
// um item por espaço; "completo" ocupa também sopra e sotto (e o natale ainda a testa)
const OCUPA = { completo: ['completo', 'sopra', 'sotto'] };
const ocupa = (id, cat) => { const s = (cat ?? []).find(x => x.id === id)?.slot ?? SLOT[id] ?? id; return id === 'natale' ? ['completo', 'sopra', 'sotto', 'testa'] : (OCUPA[s] ?? [s]); };
export function accCompatibili(acc, novo, cat) {
  const usa = new Set(ocupa(novo, cat));
  return [...acc.filter(a => a !== novo && !ocupa(a, cat).some(s => usa.has(s))), novo];
}
const hash = s => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return Math.abs(h); };
// personagem padrão (antes de escolher): varia pelo @/e-mail
export function pgPadrao(seme = 'ospite') {
  const k = hash(seme), c = k % 2 ? 'donna' : 'uomo';
  return { c, pelle: k % 5, capelli: (c === 'uomo' ? CAP_UOMO : CAP_DONNA)[(k >> 3) % 5], colCap: (k >> 5) % 6, maglia: (k >> 7) % 8, pant: (k >> 9) % 3, gonna: false, acc: [], squadra: 0, faccia: (k >> 11) % 6, scarpe: (k >> 13) % 3 };
}
export function pgValido(pg) {
  if (!pg || !['uomo', 'donna'].includes(pg.c)) return null;
  const n = (v, max) => (Number.isInteger(v) && v >= 0 && v < max ? v : 0);
  const cap = OPZ.capelli.some(([id]) => id === pg.capelli) ? pg.capelli : (pg.c === 'uomo' ? 'corti' : 'lunghi');
  const acc = Array.isArray(pg.acc) ? pg.acc.filter(a => typeof a === 'string').slice(0, 12) : [];
  return { c: pg.c, pelle: n(pg.pelle, 5), capelli: cap, colCap: n(pg.colCap, OPZ.colCap.length), maglia: n(pg.maglia, OPZ.maglia.length), pant: n(pg.pant, OPZ.pant.length), gonna: pg.c === 'donna' && !!pg.gonna,
    acc, squadra: n(pg.squadra, 9), faccia: n(pg.faccia, OPZ.facce.length), scarpe: n(pg.scarpe, OPZ.scarpe.length) };
}

// ---------- rosto (textura da cabeça: canvas 512x256 = esfera inteira; a frente fica em x=128) ----------
const _facce = new Map();
function disegnaFaccia(x, pelle, faccia, espr, cx = 128, cy = 128, k = 1) {
  const nero = '#152033', S = v => v * k;
  x.lineCap = 'round'; x.lineJoin = 'round';
  const occhio = (ox, chiuso = false) => {
    if (espr === 'occhi_stelle') { x.fillStyle = '#FFC93C'; x.strokeStyle = '#B7791F'; x.lineWidth = S(1.5); x.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? S(5) : S(11); x.lineTo(cx + ox + Math.cos(a) * r, cy - S(10) + Math.sin(a) * r); } x.closePath(); x.fill(); x.stroke(); return; }
    if (espr === 'occhi_cuore') { x.fillStyle = '#E0473C'; x.beginPath(); const px = cx + ox, py = cy - S(12); x.moveTo(px, py + S(9)); x.bezierCurveTo(px - S(14), py - S(2), px - S(6), py - S(12), px, py - S(4)); x.bezierCurveTo(px + S(6), py - S(12), px + S(14), py - S(2), px, py + S(9)); x.fill(); return; }
    if (chiuso) { x.strokeStyle = nero; x.lineWidth = S(3.5); x.beginPath(); x.arc(cx + ox, cy - S(8), S(7), Math.PI * 1.1, Math.PI * 1.9); x.stroke(); return; }
    x.fillStyle = nero; x.beginPath(); x.ellipse(cx + ox, cy - S(10), S(6), S(8.5), 0, 0, 7); x.fill();
    x.fillStyle = '#FFFFFF'; x.beginPath(); x.arc(cx + ox + S(2), cy - S(13), S(2.4), 0, 7); x.fill();
  };
  occhio(-S(20), false); occhio(S(20), faccia === 'occhiolino' && !espr);
  // sopracciglia
  x.strokeStyle = nero; x.lineWidth = S(3);
  const sop = (ox, inc) => { x.beginPath(); x.moveTo(cx + ox - S(7), cy - S(26) + inc); x.lineTo(cx + ox + S(7), cy - S(26) - inc); x.stroke(); };
  if (faccia === 'cool') { sop(-S(20), S(2)); sop(S(20), -S(2)); } else if (faccia === 'stupito') { sop(-S(20), -S(2)); sop(S(20), S(2)); } else { sop(-S(20), 0); sop(S(20), 0); }
  // bocca
  x.strokeStyle = nero; x.lineWidth = S(3.5); x.fillStyle = '#7A1E2B';
  if (faccia === 'felice') { x.beginPath(); x.moveTo(cx - S(15), cy + S(8)); x.quadraticCurveTo(cx, cy + S(30), cx + S(15), cy + S(8)); x.closePath(); x.fill(); x.fillStyle = '#FFFFFF'; x.fillRect(cx - S(11), cy + S(8), S(22), S(4)); }
  else if (faccia === 'stupito') { x.beginPath(); x.ellipse(cx, cy + S(15), S(6), S(8), 0, 0, 7); x.fill(); }
  else if (faccia === 'cool') { x.beginPath(); x.moveTo(cx - S(10), cy + S(14)); x.quadraticCurveTo(cx + S(4), cy + S(20), cx + S(14), cy + S(9)); x.stroke(); }
  else if (faccia === 'carino') { x.beginPath(); x.moveTo(cx - S(9), cy + S(12)); x.quadraticCurveTo(cx - S(4.5), cy + S(18), cx, cy + S(12)); x.quadraticCurveTo(cx + S(4.5), cy + S(18), cx + S(9), cy + S(12)); x.stroke(); }
  else { x.beginPath(); x.arc(cx, cy + S(4), S(13), Math.PI * 0.2, Math.PI * 0.8); x.stroke(); }
  if (faccia === 'carino' || faccia === 'felice' || espr === 'occhi_cuore') { x.fillStyle = 'rgba(236,72,153,0.35)'; for (const s of [-1, 1]) { x.beginPath(); x.ellipse(cx + s * S(31), cy + S(6), S(8), S(5), 0, 0, 7); x.fill(); } }
  void pelle;
}
function texFaccia(pelle, faccia, espr) {
  const k = `${pelle}|${faccia}|${espr ?? ''}`;
  if (_facce.has(k)) return _facce.get(k);
  const cv = document.createElement('canvas'); cv.width = 512; cv.height = 256;
  const x = cv.getContext('2d'); x.fillStyle = pelle; x.fillRect(0, 0, 512, 256);
  x.save(); x.translate(128, 128); x.scale(0.62, 1); x.translate(-128, -128);   // a esfera estica na horizontal: compensa
  disegnaFaccia(x, pelle, faccia, espr);
  x.restore();
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
  _facce.set(k, t); return t;
}
// miniatura do rosto (botões do editor)
const _mf = new Map();
export function miniFaccia(pelle, faccia, espr) {
  const k = `${pelle}|${faccia}|${espr ?? ''}`;
  if (_mf.has(k)) return _mf.get(k);
  const cv = document.createElement('canvas'); cv.width = cv.height = 96;
  const x = cv.getContext('2d'); x.fillStyle = pelle; x.beginPath(); x.arc(48, 48, 46, 0, 7); x.fill();
  disegnaFaccia(x, pelle, faccia, espr, 48, 50, 1.05);
  const url = cv.toDataURL(); _mf.set(k, url); return url;
}
// coraçãozinho (efeito "cuori")
let _cuore = null;
function texCuore() {
  if (_cuore) return _cuore;
  const cv = document.createElement('canvas'); cv.width = cv.height = 64; const x = cv.getContext('2d');
  x.fillStyle = '#FF4F9A'; x.shadowColor = '#FF4F9A'; x.shadowBlur = 8; x.beginPath(); x.moveTo(32, 54); x.bezierCurveTo(4, 32, 14, 6, 32, 20); x.bezierCurveTo(50, 6, 60, 32, 32, 54); x.fill();
  _cuore = new THREE.CanvasTexture(cv); _cuore.colorSpace = THREE.SRGBColorSpace; return _cuore;
}

// ---------- modelo 3D (olha para +z; pernas e braços em grupos para a animação de andar) ----------
export function costruisci(pg, H) {
  pg = pgValido(pg) ?? pgPadrao();
  const u = H, donna = pg.c === 'donna';
  const mats = new Map(), mat = (c, em = null, op = 1) => { const k = `${c}|${em}|${op}`; if (!mats.has(k)) mats.set(k, new THREE.MeshLambertMaterial({ color: c, ...(em ? { emissive: em, emissiveIntensity: 0.8 } : {}), ...(op < 1 ? { transparent: true, opacity: op, depthWrite: false } : {}) })); return mats.get(k); };
  const acc = new Set(pg.acc ?? []), sq = SQUADRE_PG[pg.squadra ?? 0], tem = id => acc.has(id);
  const pelle = OPZ.pelle[pg.pelle], cap = OPZ.colCap[pg.colCap];
  let magl = OPZ.maglia[pg.maglia], pant = OPZ.pant[pg.pant], scarpa = OPZ.scarpe[pg.scarpe], manica = null, gonna = pg.gonna;
  // completos trocam as cores do corpo
  const comp = ['elegante', 'natale', 'carnevale', 'astronauta', 'ninja', 'supereroe', 'principessa'].find(tem);
  if (tem('tifoso')) magl = sq[1];
  if (tem('jeans_strappati')) pant = '#5B7FB8';
  if (tem('corsetto')) { magl = '#6FA3D6'; manica = pelle; }
  if (tem('crop_top')) manica = pelle;
  if (tem('giacca_college')) manica = '#F4F1EA';
  if (tem('tutu')) gonna = true;
  if (comp === 'elegante') { magl = '#1F2A44'; pant = '#1F2A44'; scarpa = '#111111'; }
  if (comp === 'natale') { magl = '#C8102E'; pant = '#C8102E'; scarpa = '#1B1B1B'; }
  if (comp === 'carnevale') { magl = '#E0473C'; pant = '#2E9B55'; }
  if (comp === 'astronauta') { magl = '#F4F4F2'; pant = '#F4F4F2'; scarpa = '#D8DDE3'; manica = '#F4F4F2'; }
  if (comp === 'ninja') { magl = '#1B1B1B'; pant = '#1B1B1B'; scarpa = '#1B1B1B'; manica = '#1B1B1B'; }
  if (comp === 'supereroe') { magl = '#1F5BB8'; pant = '#1F5BB8'; scarpa = '#D3252B'; manica = '#1F5BB8'; }
  if (comp === 'principessa') { magl = '#F4A6C0'; pant = '#F4A6C0'; manica = pelle; gonna = 'principessa'; }
  if (tem('sneakers')) scarpa = '#FFFFFF';
  if (tem('anfibi')) scarpa = '#1B1B1B';
  manica ??= magl;
  const g = new THREE.Group();
  const caixa = (w, h, d, c, x, y, z, par = g, em, op) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w * u, h * u, d * u), mat(c, em, op)); m.position.set(x * u, y * u, z * u); par.add(m); return m; };
  const esfera = (r, c, x, y, z, sx = 1, sy = 1, sz = 1, par = g, em, op) => { const m = new THREE.Mesh(new THREE.SphereGeometry(r * u, 14, 10), mat(c, em, op)); m.position.set(x * u, y * u, z * u); m.scale.set(sx, sy, sz); par.add(m); return m; };
  const cil = (rt, rb, h, c, x, y, z, seg = 14, par = g, em, op) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(rt * u, rb * u, h * u, seg), mat(c, em, op)); m.position.set(x * u, y * u, z * u); par.add(m); return m; };
  const anel = (r, t, c, x, y, z, rx = Math.PI / 2, par = g, em) => { const m = new THREE.Mesh(new THREE.TorusGeometry(r * u, t * u, 8, 24), mat(c, em)); m.position.set(x * u, y * u, z * u); m.rotation.x = rx; par.add(m); return m; };
  const largo = donna ? 0.30 : 0.34;
  // ---- pernas (com sapato) ----
  const lg = tem('cargo') ? 0.15 : 0.13;
  const perna = s => {
    const p = new THREE.Group(); p.position.set(s * 0.078 * u, 0.46 * u, 0);
    const corPerna = gonna && gonna !== 'principessa' ? pelle : pant;
    if (tem('shorts') && !comp) { caixa(lg, 0.17, 0.15, pant, 0, -0.085, 0, p); caixa(lg - 0.01, 0.23, 0.14, pelle, 0, -0.285, 0, p); }
    else caixa(lg, 0.4, 0.15, corPerna, 0, -0.2, 0, p);
    if (tem('cargo') && !comp) caixa(0.03, 0.1, 0.08, tono(pant, -0.08), s * (lg / 2 + 0.01), -0.2, 0, p);   // bolsos laterais
    if (tem('jeans_strappati') && !comp) for (const y of [-0.16, -0.27]) caixa(0.07, 0.025, 0.01, pelle, 0.01 * s, y, 0.076, p);
    if (tem('tuta_pant') && !comp) caixa(0.012, 0.4, 0.152, '#FFFFFF', s * (lg / 2), -0.2, 0, p);
    if (comp === 'carnevale') caixa(lg + 0.002, 0.2, 0.152, '#FFC93C', 0, -0.3, 0, p);
    // sapatos
    if (tem('stivali_pelosi')) { cil(0.085, 0.09, 0.2, '#F4F1EA', 0, -0.33, 0.01, 10, p); for (const yy of [-0.25, -0.33, -0.41]) esfera(0.08, '#FFFFFF', 0, yy, 0.01, 1.1, 0.5, 1.1, p); caixa(0.14, 0.05, 0.22, '#F4F1EA', 0, -0.435, 0.035, p); }
    else if (tem('anfibi')) { caixa(0.145, 0.16, 0.17, '#1B1B1B', 0, -0.38, 0.01, p); caixa(0.15, 0.06, 0.23, '#1B1B1B', 0, -0.43, 0.035, p); caixa(0.152, 0.02, 0.235, '#3A3F4B', 0, -0.455, 0.035, p); }
    else if (tem('sneakers')) { caixa(0.145, 0.08, 0.24, '#FFFFFF', 0, -0.42, 0.04, p); caixa(0.15, 0.03, 0.25, OPZ.scarpe[pg.scarpe] === '#FFFFFF' ? '#E0473C' : OPZ.scarpe[pg.scarpe], 0, -0.448, 0.04, p); caixa(0.02, 0.03, 0.12, '#3FA9F5', s * 0.074, -0.41, 0.03, p); }
    else { caixa(0.14, 0.07, 0.22, scarpa, 0, -0.425, 0.035, p); if (comp === 'supereroe') caixa(0.142, 0.14, 0.16, '#D3252B', 0, -0.36, 0, p); }
    return p;
  };
  // ---- braços (com mão) ----
  const braco = s => {
    const b = new THREE.Group(); b.position.set(s * (largo / 2 + 0.05) * u, 0.84 * u, 0);
    const gr = tem('piumino') && !comp ? 0.13 : 0.095;
    caixa(gr, 0.34, gr + 0.01, manica, 0, -0.16, 0, b);
    if (tem('tuta') && !comp) caixa(0.012, 0.34, 0.107, '#FFFFFF', s * 0.048, -0.16, 0, b);
    if (tem('giacca_college') && !comp) caixa(gr + 0.004, 0.03, gr + 0.014, magl, 0, -0.31, 0, b);
    if (tem('piumino') && !comp) for (const y of [-0.07, -0.18]) caixa(gr + 0.006, 0.012, gr + 0.016, tono(magl, -0.1), 0, y, 0, b);
    if (comp === 'astronauta' || comp === 'ninja') caixa(0.1, 0.07, 0.11, comp === 'ninja' ? '#1B1B1B' : '#D8DDE3', 0, -0.33, 0, b);
    esfera(0.048, comp === 'astronauta' ? '#D8DDE3' : pelle, 0, -0.37, 0, 1, 1, 1, b);
    return b;
  };
  const pe = perna(-1), pd = perna(1), be = braco(-1), bd = braco(1);
  g.add(pe, pd, be, bd);
  // ---- tronco ----
  const tW = tem('piumino') && !comp ? largo + 0.04 : tem('felpa') && !comp ? largo + 0.02 : largo, tD = tem('piumino') && !comp ? 0.22 : 0.18;
  if (tem('crop_top') && !comp) { caixa(tW, 0.22, tD, magl, 0, 0.76, 0); caixa(tW - 0.02, 0.16, tD - 0.01, pelle, 0, 0.57, 0); }
  else caixa(tW, 0.38, tD, magl, 0, 0.68, 0);
  if (donna && !tem('piumino')) caixa(tW * 0.88, 0.06, tD + 0.004, tem('crop_top') && !comp ? pelle : magl, 0, 0.5, 0);
  // quadril / saia
  if (gonna === 'principessa') { cil(0.12, 0.36, 0.5, '#F4A6C0', 0, 0.27, 0, 18); cil(0.13, 0.38, 0.08, '#FFFFFF', 0, 0.06, 0, 18); }
  else if (tem('tutu') && !comp) { for (const [r, y, c] of [[0.27, 0.42, '#FFFFFF'], [0.24, 0.39, '#F4A6C0'], [0.22, 0.36, '#FFFFFF']]) cil(r * 0.7, r, 0.07, c, 0, y, 0, 18); }
  else if (gonna) cil(0.15, 0.24, 0.24, pant, 0, 0.36, 0, 12);
  else caixa(largo * 0.95, 0.09, 0.17, pant, 0, 0.46, 0);
  caixa(0.08, 0.05, 0.08, comp === 'astronauta' ? '#F4F4F2' : pelle, 0, 0.895, 0);                     // pescoço
  // ---- cabeça redonda com rosto ----
  const testa = new THREE.Mesh(new THREE.SphereGeometry(0.16 * u, 28, 18), new THREE.MeshLambertMaterial({ map: texFaccia(pelle, OPZ.facce[pg.faccia][0], ['occhi_stelle', 'occhi_cuore'].find(tem)) }));
  testa.position.y = 1.04 * u; testa.scale.set(1, 0.96, 0.96); g.add(testa);
  // ---- cabelo ----
  const Y = 1.04, cs = ['onde_lunghe', 'chignon_doppio', 'cresta', 'anime'].find(tem) ?? pg.capelli;
  const coperto = tem('aureola') ? false : ['astronauta'].includes(comp);
  const calotta = (cobre = 0.55, k = 1.05, rx = -0.25, c = cap) => { const m = new THREE.Mesh(new THREE.SphereGeometry(0.16 * u * k, 18, 10, 0, Math.PI * 2, 0, Math.PI * cobre), mat(c)); m.position.y = Y * u; m.rotation.x = rx; g.add(m); return m; };
  if (!coperto) switch (cs) {
    case 'corti': calotta(); break;
    case 'ciuffo': calotta(); caixa(0.15, 0.07, 0.11, cap, 0, Y + 0.13, 0.08).rotation.x = -0.3; break;
    case 'spettinati': calotta(); for (let i = 0; i < 7; i++) { const a = i / 7 * Math.PI * 2, m = caixa(0.06, 0.09, 0.06, cap, Math.cos(a) * 0.1, Y + 0.14, Math.sin(a) * 0.09 - 0.01); m.rotation.set(Math.sin(a) * 0.5, a, Math.cos(a) * 0.5); } break;
    case 'ricci': for (const [x, y, z] of [[0, 0.15, 0], [-0.1, 0.11, 0.02], [0.1, 0.11, 0.02], [-0.07, 0.12, -0.08], [0.07, 0.12, -0.08], [0, 0.09, 0.1], [-0.13, 0.03, -0.04], [0.13, 0.03, -0.04], [0, 0.07, -0.13]]) esfera(0.068, cap, x, Y + y, z); if (donna) for (const s of [-1, 1]) esfera(0.075, cap, s * 0.13, Y - 0.12, -0.05); break;
    case 'afro': esfera(0.25, cap, 0, Y + 0.06, -0.03, 1, 0.9, 1); break;
    case 'rasati': calotta(0.45, 1.01, -0.15); break;
    case 'calvo': break;
    case 'lunghi': calotta(0.6); caixa(0.32, 0.44, 0.08, cap, 0, Y - 0.17, -0.12); for (const s of [-1, 1]) caixa(0.05, 0.32, 0.13, cap, s * 0.15, Y - 0.12, -0.04); break;
    case 'coda': calotta(0.6); esfera(0.06, cap, 0, Y + 0.05, -0.17); caixa(0.08, 0.28, 0.08, cap, 0, Y - 0.12, -0.2); break;
    case 'codini': calotta(0.6); for (const s of [-1, 1]) { esfera(0.05, cap, s * 0.15, Y + 0.04, -0.06); caixa(0.07, 0.24, 0.07, cap, s * 0.19, Y - 0.1, -0.06).rotation.z = s * 0.15; } break;
    case 'trecce': calotta(0.6); for (const s of [-1, 1]) for (let k = 0; k < 5; k++) esfera(0.04, cap, s * 0.12, Y - 0.08 - k * 0.07, 0.03 - k * 0.01); break;
    case 'caschetto': calotta(0.62, 1.12, -0.1); for (const s of [-1, 1]) caixa(0.05, 0.17, 0.21, cap, s * 0.165, Y - 0.1, -0.02); caixa(0.32, 0.17, 0.06, cap, 0, Y - 0.1, -0.14); break;
    case 'chignon': calotta(0.6); esfera(0.09, cap, 0, Y + 0.17, -0.08); break;
    // cabelos pagos
    case 'onde_lunghe': {   // longos ondulados até a cintura, pontas rosa (duas cores)
      calotta(0.62, 1.07); const ponta = cap === '#F4A6C0' ? '#8B5CF6' : '#F4A6C0';
      for (let k = 0; k < 7; k++) { const y = Y - 0.06 - k * 0.075, w = 0.34 - k * 0.012; caixa(w, 0.08, 0.08, k >= 5 ? ponta : cap, Math.sin(k * 1.4) * 0.012, y, -0.13); }
      for (const s of [-1, 1]) for (let k = 0; k < 5; k++) caixa(0.06, 0.08, 0.1, k >= 3 ? ponta : cap, s * (0.16 + Math.sin(k * 1.6) * 0.012), Y - 0.07 - k * 0.075, -0.02);
      caixa(0.22, 0.05, 0.05, cap, -0.03, Y + 0.12, 0.12).rotation.z = 0.25; break;
    }
    case 'chignon_doppio': calotta(0.6); for (const s of [-1, 1]) esfera(0.08, cap, s * 0.11, Y + 0.16, -0.02); break;
    case 'cresta': calotta(0.42, 1.0, -0.1, '#3A3F4B'); for (let k = 0; k < 5; k++) caixa(0.04, 0.1 + (k === 2 ? 0.03 : 0), 0.06, OPZ.colCap[pg.colCap] === '#1B1B1B' ? '#E0473C' : cap, 0, Y + 0.17, 0.1 - k * 0.055); break;
    case 'anime': calotta(0.6, 1.06); for (let i = 0; i < 9; i++) { const a = i / 9 * Math.PI * 2, m = new THREE.Mesh(new THREE.ConeGeometry(0.045 * u, 0.16 * u, 6), mat(cap)); m.position.set(Math.cos(a) * 0.11 * u, (Y + 0.12 + Math.sin(i) * 0.02) * u, (Math.sin(a) * 0.1 - 0.02) * u); m.rotation.set(Math.sin(a) * 0.9, 0, -Math.cos(a) * 0.9); g.add(m); } break;
  }
  // ---------- roupas pagas ----------
  if (tem('tifoso')) { for (const x of [-0.09, 0, 0.09]) caixa(0.035, 0.38, 0.012, sq[2], x * (largo / 0.36), 0.68, 0.093); caixa(0.1, 0.1, 0.012, sq[2], 0, 0.72, -0.094); }
  if (tem('felpa')) { caixa(0.16, 0.08, 0.02, tono(magl, -0.08), 0, 0.58, tD / 2 + 0.008); caixa(0.26, 0.12, 0.09, tono(magl, -0.05), 0, 0.88, -0.11); for (const s of [-1, 1]) caixa(0.012, 0.09, 0.012, '#FFFFFF', s * 0.04, 0.8, tD / 2 + 0.01); }
  if (tem('giacca_college')) { caixa(0.02, 0.38, 0.01, '#F4F1EA', 0, 0.68, tD / 2 + 0.004); caixa(0.07, 0.08, 0.012, '#FFC93C', -0.08, 0.74, tD / 2 + 0.006); caixa(tW + 0.004, 0.03, tD + 0.004, '#F4F1EA', 0, 0.505, 0); }
  if (tem('piumino')) for (const y of [0.58, 0.7, 0.82]) caixa(tW + 0.008, 0.012, tD + 0.008, tono(magl, -0.12), 0, y, 0);
  if (tem('corsetto')) { for (let k = 0; k < 4; k++) { const m = caixa(0.09, 0.008, 0.01, '#FFFFFF', 0, 0.56 + k * 0.06, tD / 2 + 0.006); m.rotation.z = k % 2 ? 0.5 : -0.5; } for (const s of [-1, 1]) caixa(0.03, 0.08, tD + 0.004, '#FFFFFF', s * 0.1, 0.84, 0); caixa(tW + 0.004, 0.05, tD + 0.004, '#FFFFFF', 0, 0.84, 0); }
  if (tem('tuta')) for (const s of [-1, 1]) caixa(0.012, 0.38, tD + 0.004, '#FFFFFF', s * tW / 2, 0.68, 0);
  if (tem('hawaiana')) for (const [x, y, c] of [[-0.08, 0.78, '#FFC93C'], [0.07, 0.72, '#FFFFFF'], [-0.04, 0.6, '#F4A6C0'], [0.09, 0.56, '#FFC93C'], [0, 0.68, '#FFFFFF']]) esfera(0.022, c, x, y, tD / 2 + 0.004, 1, 1, 0.3);
  if (comp === 'elegante') { caixa(0.11, 0.3, 0.012, '#FFFFFF', 0, 0.72, 0.093); caixa(0.04, 0.24, 0.016, '#B91C1C', 0, 0.71, 0.099); }
  if (comp === 'carnevale') { const C = ['#E0473C', '#2E9B55', '#FFC93C', '#3FA9F5']; for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) caixa(largo / 2 - 0.004, 0.19 - 0.004, 0.012, C[(i + j * 2) % 4], (i - 0.5) * largo / 2, 0.585 + j * 0.19, 0.093); caixa(0.27, 0.06, 0.03, '#111111', 0, Y + 0.01, 0.145); }
  if (comp === 'natale') { caixa(largo + 0.01, 0.05, 0.19, '#1B1B1B', 0, 0.51, 0); caixa(0.06, 0.05, 0.012, '#FFC93C', 0, 0.51, 0.1); esfera(0.11, '#FFFFFF', 0, Y - 0.1, 0.08, 1.1, 1, 0.7); cil(0.17, 0.17, 0.05, '#FFFFFF', 0, Y + 0.11, 0); const cono = cil(0.001, 0.15, 0.26, '#C8102E', 0, Y + 0.25, -0.02); cono.rotation.x = -0.35; esfera(0.04, '#FFFFFF', 0, Y + 0.34, -0.1); }
  if (comp === 'astronauta') { esfera(0.21, '#BFE3F7', 0, Y, 0, 1, 1, 1, g, null, 0.35); anel(0.17, 0.025, '#D8DDE3', 0, 0.9, 0); caixa(0.24, 0.3, 0.12, '#D8DDE3', 0, 0.7, -0.15); for (const [x, c] of [[-0.03, '#009246'], [0, '#FFFFFF'], [0.03, '#CE2B37']]) caixa(0.03, 0.05, 0.01, c, x - 0.07, 0.78, 0.095); }
  if (comp === 'ninja') { caixa(0.3, 0.08, 0.17, '#1B1B1B', 0, Y - 0.07, 0.03); caixa(0.34, 0.035, 0.34, '#D3252B', 0, Y + 0.07, 0).scale.set(1, 1, 0.98); for (const s of [-1, 1]) caixa(0.03, 0.12, 0.012, '#D3252B', s * 0.03, Y + 0.0, -0.17).rotation.z = s * 0.3; }
  if (comp === 'supereroe') { caixa(0.1, 0.1, 0.012, '#FFC93C', 0, 0.74, 0.093).rotation.z = Math.PI / 4; caixa(largo + 0.01, 0.04, 0.19, '#FFC93C', 0, 0.51, 0); }
  if (comp === 'principessa') { caixa(tW + 0.004, 0.04, tD + 0.004, '#FFFFFF', 0, 0.86, 0); }
  // ---------- testa / viso / collo / schiena ----------
  if (tem('cappello')) { const cp = new THREE.Mesh(new THREE.SphereGeometry(0.17 * u, 16, 8, 0, Math.PI * 2, 0, Math.PI * 0.5), mat('#E0473C')); cp.position.y = (Y + 0.02) * u; g.add(cp); caixa(0.2, 0.02, 0.14, '#E0473C', 0, Y + 0.03, 0.17); }
  if (tem('cappello_rovescio')) { const cp = new THREE.Mesh(new THREE.SphereGeometry(0.17 * u, 16, 8, 0, Math.PI * 2, 0, Math.PI * 0.5), mat('#1F2430')); cp.position.y = (Y + 0.02) * u; g.add(cp); caixa(0.2, 0.02, 0.14, '#1F2430', 0, Y + 0.03, -0.17); caixa(0.06, 0.04, 0.01, '#FFFFFF', 0, Y + 0.1, 0.15); }
  if (tem('borsalino')) { cil(0.27, 0.27, 0.02, '#2B2B2B', 0, Y + 0.12, 0, 18); cil(0.135, 0.15, 0.15, '#2B2B2B', 0, Y + 0.2, 0); cil(0.152, 0.152, 0.035, '#8B1E2B', 0, Y + 0.145, 0); }
  if (tem('berretto')) { const b = new THREE.Mesh(new THREE.SphereGeometry(0.175 * u, 16, 8, 0, Math.PI * 2, 0, Math.PI * 0.55), mat('#3FA9F5')); b.position.y = (Y + 0.01) * u; g.add(b); cil(0.17, 0.17, 0.05, '#F4F1EA', 0, Y + 0.02, 0, 18); esfera(0.05, '#F4F1EA', 0, Y + 0.19, 0); }
  if (tem('corona')) { cil(0.15, 0.15, 0.06, '#FFC93C', 0, Y + 0.17, 0, 18, g, '#B7791F'); for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2, m = new THREE.Mesh(new THREE.ConeGeometry(0.03 * u, 0.08 * u, 4), mat('#FFC93C', '#B7791F')); m.position.set(Math.cos(a) * 0.14 * u, (Y + 0.24) * u, Math.sin(a) * 0.14 * u); g.add(m); esfera(0.018, ['#E0473C', '#3FA9F5', '#2E9B55'][i % 3], Math.cos(a) * 0.152, Y + 0.17, Math.sin(a) * 0.152); } }
  if (tem('cuffie')) { anel(0.17, 0.018, '#23262E', 0, Y + 0.02, 0, 0); for (const s of [-1, 1]) { const c = cil(0.06, 0.06, 0.05, '#23262E', s * 0.17, Y, 0); c.rotation.z = Math.PI / 2; const l = cil(0.045, 0.045, 0.052, '#FF4FB3', s * 0.17, Y, 0, 14, g, '#FF4FB3'); l.rotation.z = Math.PI / 2; } }
  if (tem('aureola')) anel(0.12, 0.018, '#FFE58A', 0, Y + 0.27, 0, Math.PI / 2, g, '#FFD34D');
  if (tem('corna')) for (const s of [-1, 1]) { const m = new THREE.Mesh(new THREE.ConeGeometry(0.035 * u, 0.12 * u, 8), mat('#C8102E')); m.position.set(s * 0.08 * u, (Y + 0.17) * u, 0.02 * u); m.rotation.z = -s * 0.35; g.add(m); }
  if (tem('cerchietto')) { anel(0.165, 0.012, '#F4A6C0', 0, Y + 0.06, -0.01, 0.35); for (const s of [-1, 1]) esfera(0.04, '#EC4899', 0.1 + s * 0.035, Y + 0.14, 0.03, 1, 0.7, 0.5); }
  if (tem('occhiali')) { for (const s of [-1, 1]) caixa(0.085, 0.05, 0.02, '#111111', s * 0.062, Y + 0.025, 0.15); caixa(0.05, 0.015, 0.015, '#111111', 0, Y + 0.035, 0.153); }
  if (tem('occhiali_cuore')) { for (const s of [-1, 1]) { esfera(0.03, '#FF4F9A', s * 0.062 - 0.018, Y + 0.035, 0.15, 1, 1, 0.4); esfera(0.03, '#FF4F9A', s * 0.062 + 0.018, Y + 0.035, 0.15, 1, 1, 0.4); const p = caixa(0.04, 0.04, 0.012, '#FF4F9A', s * 0.062, Y + 0.012, 0.152); p.rotation.z = Math.PI / 4; } caixa(0.04, 0.012, 0.012, '#FF4F9A', 0, Y + 0.04, 0.155); }
  if (tem('visiera')) caixa(0.3, 0.06, 0.04, '#3FD0FF', 0, Y + 0.025, 0.135, g, '#3FD0FF', 0.85);
  if (tem('catena')) { anel(0.08, 0.009, '#FFC93C', 0, 0.84, 0.05, -1.15, g, '#B7791F'); esfera(0.022, '#FFC93C', 0, 0.78, 0.098, 1, 1, 0.5, g, '#B7791F'); }
  if (tem('sciarpa')) { anel(0.07, 0.03, '#C8102E', 0, 0.89, 0); caixa(0.06, 0.18, 0.025, '#C8102E', 0.05, 0.78, 0.1); for (const y of [0.72, 0.8]) caixa(0.062, 0.02, 0.027, '#FFFFFF', 0.05, y, 0.1); }
  if (tem('zaino')) { caixa(0.24, 0.28, 0.1, '#E0473C', 0, 0.7, -0.14); caixa(0.18, 0.1, 0.03, '#C23A30', 0, 0.62, -0.2); for (const s of [-1, 1]) caixa(0.025, 0.3, 0.012, '#23262E', s * 0.08, 0.7, 0.094); }
  let ali = null;
  if (tem('ali_angelo') || tem('ali_demone')) {
    ali = new THREE.Group(); ali.position.set(0, 0.76 * u, -0.11 * u); g.add(ali);
    const ang = tem('ali_angelo'), col = ang ? '#FFFFFF' : '#3A0E14', col2 = ang ? '#E8EEF8' : '#8E1F2F';
    for (const s of [-1, 1]) {
      const w = new THREE.Group(); w.rotation.y = s * 0.45; ali.add(w);
      for (let k = 0; k < 4; k++) { const m = esfera(ang ? 0.09 : 0.08, k % 2 ? col2 : col, s * (0.1 + k * 0.08), 0.06 - k * 0.04, 0, 1.3, ang ? 0.55 : 0.4, 0.18, w); m.rotation.z = s * (0.5 + k * 0.15); }
      if (!ang) for (let k = 0; k < 3; k++) { const m = new THREE.Mesh(new THREE.ConeGeometry(0.03 * u, 0.12 * u, 4), mat(col)); m.position.set(s * (0.14 + k * 0.09) * u, (-0.05 - k * 0.03) * u, 0); m.rotation.z = Math.PI; w.add(m); }
    }
  }
  let mantello = null;
  if (tem('mantello') || comp === 'supereroe') { mantello = new THREE.Group(); mantello.position.set(0, 0.87 * u, -0.1 * u); g.add(mantello); caixa(0.36, 0.62, 0.02, '#D3252B', 0, -0.31, 0, mantello); mantello.rotation.x = 0.12; }
  // ---------- animais e efeitos ----------
  let cane = null, gatto = null, drago = null, aura = null, cuori = null;
  if (tem('cane')) {   // cagnolino: sta dietro a destra e scodinzola
    cane = new THREE.Group(); cane.position.set(0.32 * u, 0, -0.3 * u);
    const pel = '#C8955C', sc = '#7A4A2A';
    caixa(0.12, 0.1, 0.24, pel, 0, 0.16, 0, cane); caixa(0.11, 0.1, 0.11, pel, 0, 0.25, 0.14, cane); caixa(0.06, 0.04, 0.06, sc, 0, 0.23, 0.21, cane);
    for (const s of [-1, 1]) { caixa(0.03, 0.06, 0.04, sc, s * 0.045, 0.32, 0.12, cane); for (const z of [-0.08, 0.08]) caixa(0.035, 0.11, 0.035, pel, s * 0.04, 0.055, z, cane); }
    const coda = new THREE.Group(); coda.position.set(0, 0.2 * u, -0.12 * u); caixa(0.025, 0.1, 0.025, pel, 0, 0.05, 0, coda); coda.rotation.x = -0.6; cane.add(coda);
    cane.userData.coda = coda; g.add(cane);
  }
  if (tem('gatto')) {   // gattino: dietro a sinistra, coda dritta
    gatto = new THREE.Group(); gatto.position.set(-0.32 * u, 0, -0.28 * u);
    const pel = '#E9A25B', sc = '#B86B2E';
    caixa(0.1, 0.09, 0.2, pel, 0, 0.13, 0, gatto); caixa(0.1, 0.09, 0.09, pel, 0, 0.22, 0.12, gatto);
    for (const s of [-1, 1]) { const o = new THREE.Mesh(new THREE.ConeGeometry(0.025 * u, 0.05 * u, 4), mat(sc)); o.position.set(s * 0.03 * u, 0.29 * u, 0.12 * u); gatto.add(o); for (const z of [-0.06, 0.06]) caixa(0.03, 0.09, 0.03, pel, s * 0.035, 0.045, z, gatto); }
    for (const z of [-0.04, 0.04]) caixa(0.102, 0.015, 0.03, sc, 0, 0.17, z, gatto);
    const coda = new THREE.Group(); coda.position.set(0, 0.16 * u, -0.1 * u); caixa(0.022, 0.16, 0.022, pel, 0, 0.08, 0, coda); coda.rotation.x = -0.3; gatto.add(coda);
    gatto.userData.coda = coda; g.add(gatto);
  }
  if (tem('draghetto')) {   // draghetto che vola vicino alla spalla
    drago = new THREE.Group(); drago.position.set(0.34 * u, 1.0 * u, -0.12 * u);
    const v = '#2E9B55', vc = '#A7D98B';
    esfera(0.07, v, 0, 0, 0, 1, 0.85, 1.3, drago); esfera(0.05, v, 0, 0.05, 0.09, 1, 1, 1, drago); esfera(0.03, vc, 0, 0.0, 0.03, 1, 1, 1.4, drago);
    for (const s of [-1, 1]) { esfera(0.012, '#152033', s * 0.025, 0.07, 0.13, 1, 1, 1, drago); const o = new THREE.Mesh(new THREE.ConeGeometry(0.012 * u, 0.04 * u, 4), mat(vc)); o.position.set(s * 0.025 * u, 0.1 * u, 0.08 * u); drago.add(o); }
    const ala = s => { const w = new THREE.Group(); w.position.set(s * 0.05 * u, 0.04 * u, 0); caixa(0.12, 0.008, 0.08, vc, s * 0.06, 0, 0, w); drago.add(w); return w; };
    drago.userData.ali = [ala(-1), ala(1)];
    g.add(drago);
  }
  if (tem('aura')) {   // stelline che girano intorno
    aura = new THREE.Group();
    const m = new THREE.MeshBasicMaterial({ color: '#FFD34D' });
    for (let i = 0; i < 8; i++) { const s = new THREE.Mesh(new THREE.OctahedronGeometry(0.035 * u), m); const a = i / 8 * Math.PI * 2; s.position.set(Math.cos(a) * 0.32 * u, (0.25 + (i % 3) * 0.3) * u, Math.sin(a) * 0.32 * u); aura.add(s); }
    g.add(aura);
  }
  if (tem('cuori')) {   // cuoricini che salgono
    cuori = new THREE.Group();
    const m = new THREE.SpriteMaterial({ map: texCuore(), transparent: true, depthWrite: false });
    for (let i = 0; i < 6; i++) { const s = new THREE.Sprite(m.clone()); s.scale.setScalar(0.1 * u); s.userData.f = i / 6; s.userData.a = i * 1.7; cuori.add(s); }
    g.add(cuori);
  }
  const sombra = new THREE.Mesh(new THREE.CircleGeometry(0.22 * u, 16), new THREE.MeshBasicMaterial({ color: '#000', transparent: true, opacity: 0.22, depthWrite: false }));
  sombra.rotation.x = -Math.PI / 2; sombra.position.y = 0.003 * u; g.add(sombra);
  g.userData = { pe, pd, be, bd, cane, gatto, drago, aura, cuori, ali, mantello, u };
  return g;
}
function tono(c, l) { const k = new THREE.Color(c); k.offsetHSL(0, 0, l); return `#${k.getHexString()}`; }
// anima animais, asas, capa e efeitos (passeggio.js e prévia do editor chamam a cada quadro)
export function animaAcc(o, t) {
  const a = o.userData;
  if (a.cane) a.cane.userData.coda.rotation.z = Math.sin(t * 0.02) * 0.6;
  if (a.gatto) a.gatto.userData.coda.rotation.z = Math.sin(t * 0.004) * 0.35;
  if (a.drago) { a.drago.position.y = (1.0 + Math.sin(t * 0.004) * 0.04) * a.u; a.drago.userData.ali.forEach((w, i) => { w.rotation.z = (i ? -1 : 1) * Math.sin(t * 0.025) * 0.7; }); }
  if (a.ali) a.ali.children.forEach((w, i) => { w.rotation.y = (i ? 1 : -1) * (0.45 + Math.sin(t * 0.003) * 0.12); });
  if (a.mantello) a.mantello.rotation.x = 0.12 + Math.abs(Math.sin(t * 0.004)) * 0.12;
  if (a.aura) { a.aura.rotation.y = t * 0.002; a.aura.children.forEach((s, i) => { s.rotation.y = t * 0.006; s.scale.setScalar(0.7 + 0.4 * Math.abs(Math.sin(t * 0.004 + i))); }); }
  if (a.cuori) a.cuori.children.forEach(s => { const f = (t * 0.0003 + s.userData.f) % 1; s.position.set(Math.cos(s.userData.a + f * 3) * 0.28 * a.u, (0.3 + f * 1.0) * a.u, Math.sin(s.userData.a + f * 3) * 0.28 * a.u); s.material.opacity = Math.sin(f * Math.PI); });
}

// ---------- editor (painel): Corpo · Capelli · Vestiti · Negozio (com provador) ----------
const CATS_PG = [['outfit', '✨', 'Outfit'], ['testa', '👑', 'Testa'], ['viso', '🕶️', 'Viso'], ['capelli', '💇', 'Capelli'], ['espressione', '😍', 'Espressioni'], ['sopra', '👕', 'Sopra'], ['sotto', '👖', 'Sotto'],
  ['scarpe', '👟', 'Scarpe'], ['collo', '📿', 'Collo'], ['schiena', '🪽', 'Schiena'], ['completo', '🦸', 'Completi'], ['pet', '🐶', 'Animali'], ['effetto', '💫', 'Effetti']];
export class EditorPersonaggio {
  constructor(ui, conto) {
    this.ui = ui; this.conto = conto;
    this.pg = null; this.dopo = null;
    this.tab = 'corpo'; this.cat = 'outfit'; this.prova = null;
  }
  get catalogo() { return this.conto.cfg?.personaggio ?? []; }
  get outfit() { return this.conto.cfg?.outfit ?? []; }
  ho(id) { return (this.conto.p?.oggetti ?? []).includes(`pg_${id}`); }
  // dopo: função chamada depois de salvar (ex.: começar a passeggiata)
  apri(dopo = null, aba = null) {
    const p = this.conto.p;
    if (!p) { this.conto.apri(); return; }
    this.dopo = dopo;
    this.pg = pgValido(p.pg) ?? pgPadrao(p.conta ?? p.email);
    this.prima = !p.pg; this.prova = null;
    if (aba) this.tab = aba;
    this.render();
  }
  // o que aparece no boneco: o que está vestido + o que está provando
  pgVisto() {
    if (!this.prova) return this.pg;
    let acc = this.pg.acc;
    for (const id of this.prova.items) acc = accCompatibili(acc, id, this.catalogo);
    return { ...this.pg, acc };
  }
  render() {
    const pg = this.pg, tab = this.tab, sw = (campo, cores) => `<div class="pg-sw">${cores.map((c, i) => `<button type="button" data-pg="${campo}" data-v="${i}" class="${pg[campo] === i ? 'on' : ''}" style="background:${c}" aria-label="${campo} ${i + 1}"></button>`).join('')}</div>`;
    const tabs = [['corpo', '🧍 Corpo'], ['capelli', '💇 Capelli'], ['vestiti', '👕 Vestiti'], ['negozio', '🛍️ Negozio']].map(([id, t]) => `<button type="button" data-pg="tab" data-v="${id}" class="${tab === id ? 'on' : ''}">${t}${id === 'negozio' ? '<i class="ps-new">NEW</i>' : ''}</button>`).join('');
    let corpo = '';
    if (tab === 'corpo') corpo = `
      <div class="pg-seg"><button type="button" data-pg="c" data-v="uomo" class="${pg.c === 'uomo' ? 'on' : ''}">👨 Uomo</button><button type="button" data-pg="c" data-v="donna" class="${pg.c === 'donna' ? 'on' : ''}">👩 Donna</button></div>
      <h3 class="ct-h">Pelle</h3>${sw('pelle', OPZ.pelle)}
      <h3 class="ct-h">Faccia</h3><div class="pg-facce">${OPZ.facce.map(([id, nome], i) => `<button type="button" data-pg="faccia" data-v="${i}" class="${pg.faccia === i ? 'on' : ''}" title="${nome}"><img alt="${nome}" src="${miniFaccia(OPZ.pelle[pg.pelle], id)}"></button>`).join('')}</div>`;
    else if (tab === 'capelli') corpo = `<h3 class="ct-h">Capelli</h3><div class="pg-opz">${OPZ.capelli.map(([id, nome]) => `<button type="button" data-pg="capelli" data-v="${id}" class="${pg.capelli === id ? 'on' : ''}">${nome}</button>`).join('')}</div>
      ${pg.capelli !== 'calvo' ? `<h3 class="ct-h">Colore</h3>${sw('colCap', OPZ.colCap)}` : ''}<p class="ct-mini">💇 Altri capelli speciali nel 🛍️ Negozio.</p>`;
    else if (tab === 'vestiti') corpo = `<h3 class="ct-h">Maglia</h3>${sw('maglia', OPZ.maglia)}
      <h3 class="ct-h">${pg.gonna ? 'Gonna' : 'Pantaloni'}</h3>${sw('pant', OPZ.pant)}
      ${pg.c === 'donna' ? `<div class="pg-opz"><button type="button" data-pg="gonna" data-v="0" class="${!pg.gonna ? 'on' : ''}">👖 Pantaloni</button><button type="button" data-pg="gonna" data-v="1" class="${pg.gonna ? 'on' : ''}">👗 Gonna</button></div>` : ''}
      <h3 class="ct-h">Scarpe</h3>${sw('scarpe', OPZ.scarpe)}
      ${pg.acc.includes('tifoso') ? `<h3 class="ct-h">⚽ Colori della maglia</h3><div class="pg-sw">${SQUADRE_PG.map(([nome, a, b], i) => `<button type="button" data-pg="squadra" data-v="${i}" class="${pg.squadra === i ? 'on' : ''}" style="background:linear-gradient(90deg,${a} 50%,${b} 50%)" aria-label="${nome}"></button>`).join('')}</div>` : ''}
      <p class="ct-mini">I capi del 🛍️ Negozio prendono i colori che scegli qui.</p>`;
    else corpo = this.negozio();
    const barraProva = this.prova ? `<div class="pg-prova"><span>👀 Stai provando <b>${esc(this.prova.nome)}</b></span><button type="button" data-pg="compra">${nIt(this.prova.prezzo)} 💰</button><button type="button" class="sec" data-pg="noprova">✕</button></div>` : '';
    this.ui.abrir(`
      <h2>🧍 ${this.prima ? 'Crea il tuo personaggio' : 'Il tuo personaggio'}</h2>
      <div class="sub">${this.prima ? 'Così ti vedranno passeggiare per le città.' : 'Corpo, faccia, capelli e colori sono gratis. Nel negozio: outfit e accessori.'}</div>
      <div class="pg-anteprima"><canvas width="280" height="320"></canvas></div>
      ${barraProva}
      <div class="pg-tabs">${tabs}</div>
      ${corpo}
      <div class="bottoni"><button data-pg="salva">${this.dopo ? '✅ Salva e passeggia' : '✅ Salva'}</button>${this.prima && this.dopo ? '' : '<button class="sec" data-pg="annulla">Annulla</button>'}</div>`, null);
    this.anteprima();
    this.ui.conteudo.querySelectorAll('[data-pg]').forEach(b => b.addEventListener('click', ev => { ev.stopPropagation(); this.azione(b); }));
  }
  negozio() {
    const own = this.catalogo.filter(x => this.ho(x.id)).length;
    const chips = CATS_PG.filter(([id]) => id === 'outfit' ? this.outfit.length : this.catalogo.some(x => (x.slot ?? SLOT[x.id]) === id))
      .map(([id, ic, nome]) => `<button type="button" data-pg="cat" data-v="${id}" class="${this.cat === id ? 'on' : ''}">${ic} ${nome}</button>`).join('');
    let cards;
    if (this.cat === 'outfit') cards = this.outfit.map(o => {
      const items = o.items.map(i => this.catalogo.find(x => x.id === i)).filter(Boolean), tutti = items.every(x => this.ho(x.id)), pieno = items.reduce((s, x) => s + x.prezzo, 0);
      const prova = this.prova?.id === `pgo_${o.id}`;
      return `<button type="button" class="pg-card pg-outfit${prova ? ' prova' : ''}${tutti ? ' mio' : ''}" data-pg="${tutti ? 'veste' : 'prova'}" data-v="pgo_${o.id}"><span>${o.icona}</span><b>${esc(o.nome)}</b><i>${items.map(x => x.icona).join('')}</i><em>${tutti ? '✅ Tuo · indossa tutto' : `<s>${nIt(pieno)}</s> ${nIt(o.prezzo)} 💰`}</em></button>`;
    }).join('');
    else cards = this.catalogo.filter(x => (x.slot ?? SLOT[x.id]) === this.cat).map(x => {
      const ho = this.ho(x.id), on = this.pg.acc.includes(x.id), prova = this.prova?.id === `pg_${x.id}`;
      return `<button type="button" class="pg-card${on ? ' on' : ''}${prova ? ' prova' : ''}${ho ? ' mio' : ''}" data-pg="${ho ? 'acc' : 'prova'}" data-v="${x.id}"><span>${x.icona}</span><b>${esc(x.nome)}</b><em>${ho ? (on ? '✅ Indossato' : '👕 Indossa') : `${x.nuovo ? '<u>NEW</u> ' : ''}${nIt(x.prezzo)} 💰`}</em></button>`;
    }).join('');
    return `<p class="ct-mini">Tocca per provarlo addosso prima di comprarlo. Comprato una volta, è tuo per sempre. Hai ${nIt(this.conto.p?.saldo ?? 0)} 💰 · ${own} capi tuoi.</p>
      <div class="pg-cats">${chips}</div><div class="pg-griglia">${cards}</div>`;
  }
  async azione(b) {
    const campo = b.dataset.pg, v = b.dataset.v;
    if (campo === 'salva') return this.salva();
    if (campo === 'annulla') { this.ferma(); this.ui.fechar(); return; }
    if (campo === 'tab') { this.tab = v; }
    else if (campo === 'cat') { this.cat = v; }
    else if (campo === 'noprova') { this.prova = null; }
    else if (campo === 'c') { if (this.pg.c === v) return; this.pg.c = v; this.pg.capelli = v === 'uomo' ? 'corti' : 'lunghi'; this.pg.gonna = false; }
    else if (campo === 'capelli') { this.pg.capelli = v; this.pg.acc = this.pg.acc.filter(a => (this.catalogo.find(x => x.id === a)?.slot ?? SLOT[a]) !== 'capelli'); }
    else if (campo === 'gonna') this.pg.gonna = v === '1';
    else if (campo === 'acc') { this.prova = null; this.pg.acc = this.pg.acc.includes(v) ? this.pg.acc.filter(a => a !== v) : accCompatibili(this.pg.acc, v, this.catalogo); }
    else if (campo === 'veste') { const o = this.outfit.find(x => `pgo_${x.id}` === v); if (o) for (const i of o.items) this.pg.acc = accCompatibili(this.pg.acc, i, this.catalogo); this.prova = null; }
    else if (campo === 'prova') {
      if (v.startsWith('pgo_')) { const o = this.outfit.find(x => `pgo_${x.id}` === v); if (o) this.prova = { id: v, nome: o.nome, prezzo: o.prezzo, items: o.items }; }
      else { const x = this.catalogo.find(i => i.id === v); if (x) this.prova = { id: `pg_${v}`, nome: x.nome, prezzo: x.prezzo, items: [v] }; }
    }
    else if (campo === 'compra') {
      const p = this.prova; if (!p) return;
      const nota = p.items.length > 1 ? `${p.items.length} capi insieme, tuoi per sempre.` : 'Tuo per sempre: lo metti e lo togli quando vuoi.';
      if (!(await this.conto.compra(p.id, p.nome, p.prezzo, nota))) return;
      for (const i of p.items) this.pg.acc = accCompatibili(this.pg.acc, i, this.catalogo);
      this.prova = null;
    }
    else this.pg[campo] = +v;
    const scroll = this.ui.conteudo.scrollTop;
    this.render();
    this.ui.conteudo.scrollTop = scroll;
  }
  async salva() {
    try {
      const pg = { ...this.pg, acc: this.pg.acc.filter(a => this.ho(a)) };   // o que está só provando não vai
      const j = await this.conto.api('personaggio', { pg });
      this.conto.p = j.profilo;
      this.ferma();
      this.ui.aviso('🧍 Personaggio salvato!');
      const dopo = this.dopo; this.dopo = null; this.prova = null;
      this.ui.passeggio?.aggiornaOmino();
      if (dopo) dopo(); else this.ui.fechar();
    } catch (e) { this.ui.aviso(e.message); }
  }

  // prévia 3D girando (renderer próprio e pequeno, só enquanto o painel está aberto); arrastar gira o boneco
  anteprima() {
    const cv = this.ui.conteudo.querySelector('.pg-anteprima canvas');
    if (!cv) return;
    const W = 280, Hc = 320;
    if (!this.r) {
      this.r = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      this.r.setPixelRatio(Math.min(devicePixelRatio, 2));
      this.r.setSize(W, Hc, false);
      this.cena = new THREE.Scene();
      this.cena.add(new THREE.HemisphereLight(0xffffff, 0xb9c7a8, 2.3));
      const sol = new THREE.DirectionalLight(0xfff1dc, 2.0); sol.position.set(-0.6, 1, 0.9); this.cena.add(sol);
      this.cam = new THREE.PerspectiveCamera(30, W / Hc, 0.1, 20);
      this.cam.position.set(0, 0.95, 2.85); this.cam.lookAt(0, 0.74, 0);
      this.rot = 0.25;
    }
    // o canvas do painel é novo a cada render: desenha no renderer fixo e copia
    this.cv = cv; this.ctx = cv.getContext('2d');
    let arr = null;
    cv.style.touchAction = 'pan-y';
    cv.addEventListener('pointerdown', e => { arr = { x: e.clientX, r: this.rot }; cv.setPointerCapture(e.pointerId); this.mano = true; });
    cv.addEventListener('pointermove', e => { if (arr) this.rot = arr.r + (e.clientX - arr.x) * 0.012; });
    const fim = () => { arr = null; setTimeout(() => { this.mano = false; }, 1500); };
    cv.addEventListener('pointerup', fim); cv.addEventListener('pointercancel', fim);
    if (this.boneco) { this.cena.remove(this.boneco); this.boneco.traverse(o => o.geometry?.dispose()); }
    this.boneco = costruisci(this.pgVisto(), 1.2);
    this.cena.add(this.boneco);
    if (!this.giro) {
      let t0 = null;
      const passo = t => {
        if (!this.cv?.isConnected) { this.giro = null; return; }
        if (t0 != null && !this.mano) this.rot += (t - t0) * 0.0006;
        t0 = t;
        this.boneco.rotation.y = this.rot;
        animaAcc(this.boneco, t);
        this.r.render(this.cena, this.cam);
        this.ctx.clearRect(0, 0, W, Hc);
        this.ctx.drawImage(this.r.domElement, 0, 0, W, Hc);
        this.giro = requestAnimationFrame(passo);
      };
      this.giro = requestAnimationFrame(passo);
    }
  }
  ferma() { if (this.giro) cancelAnimationFrame(this.giro); this.giro = null; }
}
