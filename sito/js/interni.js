// Casa con interni (v2): a casa inteira com 5 cômodos (soggiorno, cucina, camera, bagno, studio), portas entre eles, janelas,
// porta de entrada. Cena própria por cima do mapa. Duas vistas:
//   • 🗺️ dall'alto: câmera 360° em volta da casa (arrasta = gira, 2 dedos/roda = zoom, botão direito/2 dedos = move);
//     as paredes do lado da câmera abaixam sozinhas (como uma casa de bonecas) para ver dentro;
//   • 🚶 dentro: na altura dos olhos, arrasta = olha em volta 360°, toca o chão = anda até lá, WASD/setas no PC.
// O dono arruma: móveis de chão numa grade (cada móvel fica inteiro dentro de um cômodo) e decorações de parede (quadro,
// specchio, mensola) em QUALQUER parede, dos dois lados das paredes internas. Piso e cor das paredes por cômodo.
// Qualquer um pode visitar só olhando. Servidor: api/interni.php (salvar/ler) e api/conto.php "compra" (loja).
// Grade: célula = 1 m; casa HW x HD. ogg = [tipo, x, z, r]: chão = canto da pegada + rotação; parede = célula + lado da parede
// (r 0 = parede ao norte/z−, 1 = oeste/x−, 2 = sul/z+, 3 = leste/x+; o objeto olha para dentro da célula).
import * as THREE from 'three';

const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const n = v => Number(v).toLocaleString('it-IT');
const LEGNO = '#9C6B3F', LEGNO2 = '#7B5233', BIANCO = '#F4F1EA', NERO = '#23262E', METAL = '#9AA3AE';
// pegada na grade [largura, profundidade] com rotação 0; 'piano' = no chão por baixo de tudo; 'muro' = pendurado numa parede
export const PEG = { divano: [2, 1], tavolo: [2, 1], sedia: [1, 1], letto: [2, 2], pianta: [1, 1], tappeto: [2, 2, 'piano'], comodino: [1, 1], quadro: [1, 1, 'muro'], lampada: [1, 1], tavolino: [1, 1], poltrona: [1, 1], orologio: [1, 1], armadio: [2, 1], libreria: [2, 1], scrivania: [2, 1], tv: [2, 1], frigo: [1, 1], chitarra: [1, 1], cucina: [3, 1], camino: [2, 1], acquario: [2, 1], pianoforte: [2, 2],
  wc: [1, 1], lavandino: [1, 1], vasca: [2, 1], doccia: [1, 1], specchio: [1, 1, 'muro'], mensola: [1, 1, 'muro'],
  // 25/11: catálogo grande
  divano_l: [3, 2], pouf: [1, 1], poltrona_relax: [1, 1], mobile_tv: [3, 1], credenza: [2, 1], tavolino_vetro: [2, 1], lampada_arco: [1, 1],
  isola: [2, 1], sgabello: [1, 1], tavolo_tondo: [2, 2], caffe: [1, 1], forno_pizza: [2, 1],
  letto_singolo: [1, 2], baldacchino: [2, 2], cassettiera: [1, 1], toeletta: [1, 1],
  postazione_gaming: [2, 1], sedia_gaming: [1, 1], arcade: [1, 1],
  lavatrice: [1, 1], mobile_bagno: [2, 1], jacuzzi: [2, 2],
  palma: [1, 1], cactus: [1, 1], bonsai: [1, 1], fiori: [1, 1], limone: [1, 1],
  neon: [1, 1, 'muro'], applique: [1, 1, 'muro'], tv_parete: [1, 1, 'muro'], poster: [1, 1, 'muro'], bandiera: [1, 1, 'muro'], orologio_parete: [1, 1, 'muro'], maglia: [1, 1, 'muro'],
  biliardo: [3, 2], calciobalilla: [2, 1], jukebox: [1, 1], batteria: [1, 1], dj: [2, 1], tapis: [2, 1], cyclette: [1, 1],
  albero_natale: [1, 1], regali: [1, 1], presepe: [1, 1], statua: [1, 1] };
// variantes de cor (o 5º número do objeto salvo): a cor principal do móvel
const TESSUTI = ['#3F7FC1', '#8A8F98', '#C25B4A', '#2E9B55', '#E8DCC8', '#2A2D34', '#E0A33C', '#B57EDC'];
const COPERTE = ['#E0473C', '#3F7FC1', '#2E9B55', '#F2C27B', '#8A8F98', '#F4A6C0'];
const LEGNI = ['#9C6B3F', '#F4F1EA', '#5B6475', '#7B5233', '#A7D98B', '#E8836B'];
const SQUADRE = [['#1E4FA0', '#111111'], ['#D2232A', '#111111'], ['#FFFFFF', '#111111'], ['#8E1F2F', '#F2A900'], ['#2E6FD8', '#FFFFFF'], ['#8FC8EB', '#FFFFFF'], ['#5B2A86', '#FFFFFF'], ['#7A1E2B', '#FFFFFF']];
export const VAR = {
  divano: TESSUTI, divano_l: TESSUTI, poltrona: TESSUTI, poltrona_relax: TESSUTI, pouf: TESSUTI,
  letto: COPERTE, letto_singolo: COPERTE, baldacchino: COPERTE, tappeto: ['#B83A3A', '#2F5D8A', '#7C8DB5', '#E0A33C', '#8A8F98', '#2E9B55'],
  armadio: LEGNI, credenza: LEGNI, isola: LEGNI, mobile_bagno: LEGNI, cassettiera: LEGNI,
  cucina: ['#F4F1EA', '#9C6B3F', '#5B6475', '#A7D98B', '#E8836B'], libreria: ['#7B5233', '#9C6B3F', '#F4F1EA', '#5B6475'],
  sedia_gaming: ['#E0473C', '#3F7FC1', '#2E9B55', '#8B5CF6', '#F4A6C0', '#23262E'], arcade: ['#3F2A8C', '#C0392B', '#1C6FB0', '#23262E'],
  neon: ['#FF4FB3', '#3FD0FF', '#7CFF6B', '#FFD23F', '#B57EDC'], poster: ['#FFC93C', '#3FA9F5', '#E0473C', '#2E9B55'], maglia: SQUADRE,
  sgabello: ['#E0473C', '#23262E', '#F4F1EA', '#3FA9F5'], fiori: ['#E0473C', '#F4A6C0', '#FFC93C', '#B57EDC'],
};
const CATS = [['tutti', '✨', 'Tutto'], ['nuovi', '🆕', 'Novità'], ['soggiorno', '🛋️', 'Soggiorno'], ['cucina', '🍳', 'Cucina'], ['camera', '🛏️', 'Camera'], ['bagno', '🛁', 'Bagno'],
  ['studio', '💻', 'Studio'], ['gaming', '🎮', 'Gaming'], ['hobby', '🎱', 'Hobby e sport'], ['luci', '💡', 'Luci'], ['piante', '🪴', 'Piante'], ['parete', '🖼️', 'Pareti'], ['natale', '🎄', 'Natale'], ['lusso', '💎', 'Lusso']];
const tono = (c, l) => { const k = new THREE.Color(c); k.offsetHSL(0, 0, l); return `#${k.getHexString()}`; };
export const dimensioni = () => [HW, HD];   // compatibilidade (gravadores antigos)

// ---------- a planta da casa ----------
const HW = 14, HD = 10, HP = 2.7, T = 0.06, BASSO = 0.32, OCCHI = 1.5;
export const STANZE = [
  { id: 'camera', nome: 'Camera', ic: '🛏️', x: 0, z: 0, w: 5, d: 4, pav: 'moquette', par: 4 },
  { id: 'bagno', nome: 'Bagno', ic: '🛁', x: 5, z: 0, w: 3, d: 4, pav: 'piastrelle', par: 7 },
  { id: 'studio', nome: 'Studio', ic: '💻', x: 8, z: 0, w: 6, d: 4, pav: 'noce', par: 5 },
  { id: 'soggiorno', nome: 'Soggiorno', ic: '🛋️', x: 0, z: 4, w: 8, d: 6, pav: 'legno', par: 0 },
  { id: 'cucina', nome: 'Cucina', ic: '🍳', x: 8, z: 4, w: 6, d: 6, pav: 'piastrelle', par: 1 },
];
const STANZA = Object.fromEntries(STANZE.map(s => [s.id, s]));
const stanzaDi = (x, z) => STANZE.find(s => x >= s.x && x < s.x + s.w && z >= s.z && z < s.z + s.d)?.id ?? null;
// arestas da grade: 'h:Z:x' = parede na linha z=Z entre x e x+1; 'v:X:z' = linha x=X entre z e z+1
// tipo: pieno | finestra | porta (passagem aberta) | portone (porta de entrada, fechada)
const EDGE = new Map();
(() => {
  const set = (k, tipo) => EDGE.set(k, tipo);
  for (let x = 0; x < HW; x++) { set(`h:0:${x}`, 'pieno'); set(`h:${HD}:${x}`, 'pieno'); set(`h:4:${x}`, 'pieno'); }
  for (let z = 0; z < HD; z++) { set(`v:0:${z}`, 'pieno'); set(`v:${HW}:${z}`, 'pieno'); set(`v:8:${z}`, 'pieno'); }
  for (let z = 0; z < 4; z++) set(`v:5:${z}`, 'pieno');
  for (const x of [2, 6, 10]) set(`h:4:${x}`, 'porta');                 // camera, bagno ↔ soggiorno; studio ↔ cucina
  for (const z of [6, 7]) set(`v:8:${z}`, 'porta');                     // soggiorno ↔ cucina (passagem larga)
  set(`h:${HD}:3`, 'portone');                                          // entrada
  for (const k of ['h:0:1', 'h:0:2', 'h:0:6', 'h:0:10', 'h:0:11', 'v:0:6', 'v:0:7', `v:${HW}:6`, `v:${HW}:7`, `h:${HD}:6`, `h:${HD}:10`, `h:${HD}:11`]) set(k, 'finestra');
})();
const chiave = (x, z, r) => (r === 0 ? `h:${z}:${x}` : r === 2 ? `h:${z + 1}:${x}` : r === 1 ? `v:${x}:${z}` : `v:${x + 1}:${z}`);
const DEF_PAV = ['legno', 'Legno', '#C8955C'], DEF_PAR = ['#FFF6E6', '#F5DDAE', '#F2C27B', '#E8836B', '#9ED1F2', '#A7D98B', '#C9A7F2', '#FFFFFF'];

// ---------- modelos (olham para +z, centro da pegada na origem, chão em y=0; os de parede têm o fundo em z≈−0.03) ----------
export function modello(tipo, c = 0) {
  const g = new THREE.Group(), mats = new Map();
  const P = def => { const v = VAR[tipo]; return v ? v[((c % v.length) + v.length) % v.length] : def; };   // cor da variante
  const mat = (c, em = null, op = 1) => { const k = c + (em ?? '') + op; if (!mats.has(k)) mats.set(k, new THREE.MeshLambertMaterial({ color: c, ...(em ? { emissive: em, emissiveIntensity: 0.9 } : {}), ...(op < 1 ? { transparent: true, opacity: op } : {}) })); return mats.get(k); };
  const B = (w, h, d, c, x = 0, y = 0, z = 0, em, op) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(c, em, op)); m.position.set(x, y + h / 2, z); g.add(m); return m; };
  const C = (rt, rb, h, c, x = 0, y = 0, z = 0, seg = 12, em) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat(c, em)); m.position.set(x, y + h / 2, z); g.add(m); return m; };
  const S = (r, c, x, y, z, sx = 1, sy = 1, sz = 1) => { const m = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 8), mat(c)); m.position.set(x, y, z); m.scale.set(sx, sy, sz); g.add(m); return m; };
  const gambe = (w, d, h, c = LEGNO2) => { for (const sx of [-1, 1]) for (const sz of [-1, 1]) B(0.07, h, 0.07, c, sx * (w / 2 - 0.06), 0, sz * (d / 2 - 0.06)); };
  switch (tipo) {
    case 'divano': { const p = P('#3F7FC1'), sc = tono(p, -0.07), ch = tono(p, 0.08); B(1.9, 0.38, 0.85, p); B(1.9, 0.55, 0.22, sc, 0, 0.3, -0.32); for (const s of [-1, 1]) B(0.2, 0.55, 0.85, sc, s * 0.85, 0, 0); for (const s of [-1, 1]) B(0.78, 0.12, 0.6, ch, s * 0.4, 0.38, 0.06); B(0.35, 0.3, 0.12, '#FFC93C', -0.55, 0.48, -0.18).rotation.z = 0.2; break; }
    case 'poltrona': { const p = P('#C25B4A'), sc = tono(p, -0.07); B(0.85, 0.38, 0.8, p); B(0.85, 0.55, 0.2, sc, 0, 0.3, -0.3); for (const s of [-1, 1]) B(0.16, 0.5, 0.8, sc, s * 0.35, 0, 0); break; }
    case 'tavolo': gambe(1.7, 0.85, 0.72); B(1.8, 0.07, 0.9, LEGNO, 0, 0.72, 0); break;
    case 'tavolino': gambe(0.75, 0.5, 0.36); B(0.8, 0.05, 0.55, LEGNO, 0, 0.36, 0); B(0.14, 0.1, 0.14, '#E0473C', 0.15, 0.41, 0); break;
    case 'sedia': gambe(0.42, 0.42, 0.45); B(0.46, 0.06, 0.46, LEGNO, 0, 0.45, 0); B(0.46, 0.5, 0.06, LEGNO, 0, 0.5, -0.2); break;
    case 'letto': B(1.8, 0.3, 1.9, LEGNO2); B(1.7, 0.18, 1.8, BIANCO, 0, 0.3, 0.02); B(1.72, 0.06, 1.15, P('#E0473C'), 0, 0.46, 0.35); for (const s of [-1, 1]) B(0.6, 0.12, 0.3, '#FFFFFF', s * 0.42, 0.48, -0.65); B(1.8, 0.95, 0.1, LEGNO2, 0, 0, -0.95); break;
    case 'pianta': C(0.2, 0.15, 0.36, '#C9714A'); S(0.28, '#3E9B4A', 0, 0.62, 0); S(0.2, '#4FB35C', 0.14, 0.82, 0.05); S(0.18, '#2E8B3E', -0.12, 0.85, -0.04); break;
    case 'tappeto': { const p = P('#B83A3A'); B(1.9, 0.02, 1.9, p); B(1.6, 0.025, 1.6, '#E0A33C'); B(1.2, 0.03, 1.2, p); B(0.5, 0.035, 0.5, '#F4F1EA'); break; }
    case 'comodino': B(0.5, 0.5, 0.45, LEGNO); B(0.42, 0.02, 0.02, LEGNO2, 0, 0.32, 0.23); C(0.06, 0.09, 0.2, '#FFE08A', 0.1, 0.5, 0, 10, '#FFC93C'); break;
    case 'quadro': B(0.9, 0.7, 0.06, LEGNO2, 0, 1.2, 0); B(0.76, 0.56, 0.07, '#9ED1F2', 0, 1.27, 0.005); B(0.76, 0.2, 0.075, '#4FB35C', 0, 1.27, 0.008); S(0.07, '#FFC93C', 0.22, 1.7, 0.05); break;
    case 'lampada': C(0.18, 0.2, 0.05, METAL); C(0.025, 0.025, 1.3, METAL, 0, 0.05, 0); C(0.14, 0.25, 0.28, '#FFF1C2', 0, 1.3, 0, 14, '#FFD966'); break;
    case 'orologio': B(0.5, 1.8, 0.35, LEGNO2); C(0.17, 0.17, 0.04, BIANCO, 0, 1.4, 0.18).rotation.x = Math.PI / 2; B(0.05, 0.5, 0.03, '#E0A33C', 0, 0.4, 0.18); break;
    case 'armadio': B(1.8, 2.05, 0.6, P(LEGNO)); B(0.02, 1.9, 0.02, LEGNO2, 0, 0.08, 0.31); for (const s of [-1, 1]) B(0.04, 0.2, 0.04, '#E0A33C', s * 0.1, 1.0, 0.32); break;
    case 'libreria': B(1.8, 1.9, 0.38, P(LEGNO2)); for (let k = 0; k < 4; k++) { B(1.66, 0.04, 0.34, LEGNO, 0, 0.1 + k * 0.45, 0.02); for (let b = 0; b < 7; b++) B(0.15, 0.3 + ((b * 7 + k) % 3) * 0.04, 0.26, ['#E0473C', '#3FA9F5', '#2E9B55', '#FFC93C', '#8B5CF6', '#F97316', '#14B8A6'][(b + k) % 7], -0.68 + b * 0.22, 0.14 + k * 0.45, 0.04); } break;
    case 'scrivania': gambe(1.7, 0.7, 0.74); B(1.8, 0.06, 0.75, BIANCO, 0, 0.74, 0); B(0.8, 0.5, 0.05, NERO, 0, 0.85, -0.2); B(0.72, 0.42, 0.055, '#3FA9F5', 0, 0.89, -0.19, '#1C6FB0'); B(0.5, 0.03, 0.18, '#CCD3DB', 0, 0.8, 0.12); break;
    case 'tv': B(1.8, 0.45, 0.45, LEGNO2); B(1.45, 0.82, 0.07, NERO, 0, 0.5, -0.05); B(1.35, 0.72, 0.075, '#2E9B55', 0, 0.55, -0.045, '#1F6B3A'); break;
    case 'frigo': B(0.72, 1.85, 0.66, BIANCO); B(0.7, 0.02, 0.02, '#CCD3DB', 0, 1.2, 0.34); B(0.04, 0.4, 0.04, METAL, 0.28, 1.35, 0.35); B(0.04, 0.4, 0.04, METAL, 0.28, 0.7, 0.35); break;
    case 'chitarra': B(0.3, 0.06, 0.3, NERO); S(0.22, '#C9714A', 0, 0.42, 0, 1, 1.25, 0.35); S(0.17, '#C9714A', 0, 0.75, 0, 1, 1.1, 0.35); B(0.06, 0.6, 0.05, LEGNO2, 0, 0.85, 0); break;
    case 'cucina': B(2.8, 0.88, 0.62, P(BIANCO)); B(2.86, 0.06, 0.66, '#5B6475', 0, 0.88, 0); for (const x of [-0.9, -0.55]) for (const z of [-0.12, 0.14]) C(0.11, 0.11, 0.015, NERO, x, 0.94, z); B(0.6, 0.04, 0.4, METAL, 0.6, 0.92, 0); B(2.8, 0.6, 0.35, LEGNO, 0, 1.55, -0.14); break;
    case 'camino': B(1.7, 1.25, 0.55, '#B9B2A6'); B(0.9, 0.7, 0.3, '#2A2420', 0, 0.1, 0.14); C(0.06, 0.22, 0.4, '#FF8A1F', -0.1, 0.12, 0.15, 8, '#FF6A00'); C(0.05, 0.18, 0.32, '#FFC93C', 0.12, 0.12, 0.18, 8, '#FFB300'); B(1.9, 0.1, 0.65, '#9A938A', 0, 1.25, 0); break;
    case 'acquario': B(1.7, 0.7, 0.55, LEGNO2); B(1.6, 0.75, 0.5, '#6EC6F0', 0, 0.71, 0, null, 0.55); for (const [x, y] of [[-0.4, 1.0], [0.2, 1.2], [0.5, 0.95]]) S(0.07, '#FF8A1F', x, y, 0, 1.6, 1, 0.6); B(1.6, 0.06, 0.5, '#E8D8A8', 0, 0.71, 0); break;
    case 'pianoforte': B(1.6, 0.95, 1.4, NERO, 0, 0, -0.1); B(1.5, 0.06, 0.32, BIANCO, 0, 0.72, 0.62); for (let k = 0; k < 9; k++) B(0.06, 0.04, 0.18, NERO, -0.6 + k * 0.15, 0.76, 0.56); B(0.6, 0.45, 0.4, NERO, 0, 0, 0.9); break;
    // bagno
    case 'wc': B(0.42, 0.4, 0.5, '#FFFFFF', 0, 0, 0.04); B(0.44, 0.05, 0.54, '#E8E8E8', 0, 0.4, 0.05); B(0.46, 0.5, 0.2, '#FFFFFF', 0, 0.3, -0.3); B(0.1, 0.03, 0.06, METAL, 0.12, 0.8, -0.3); break;
    case 'lavandino': C(0.09, 0.12, 0.75, '#FFFFFF', 0, 0, -0.05); B(0.6, 0.16, 0.45, '#FFFFFF', 0, 0.75, -0.02); B(0.5, 0.04, 0.35, '#BFE3F7', 0, 0.88, 0); C(0.025, 0.025, 0.2, METAL, 0, 0.9, -0.2); B(0.04, 0.03, 0.14, METAL, 0, 1.08, -0.14); break;
    case 'vasca': B(1.8, 0.55, 0.8, '#FFFFFF'); B(1.6, 0.04, 0.6, '#9ED1F2', 0, 0.48, 0); for (const x of [-0.5, 0.1, 0.45]) S(0.08, '#FFFFFF', x, 0.55, 0.05, 1, 0.5, 1); C(0.025, 0.025, 0.25, METAL, -0.8, 0.55, 0); B(0.14, 0.03, 0.04, METAL, -0.75, 0.78, 0); break;
    case 'doccia': B(0.9, 0.08, 0.9, '#E8E2D6'); B(0.04, 2.0, 0.9, '#BFE3F7', 0.43, 0.08, 0, null, 0.35); B(0.9, 2.0, 0.04, '#BFE3F7', 0, 0.08, 0.43, null, 0.35); C(0.02, 0.02, 1.9, METAL, -0.38, 0.08, -0.38); C(0.12, 0.12, 0.03, METAL, -0.25, 1.95, -0.3); break;
    case 'specchio': B(0.72, 1.0, 0.05, '#C9A227', 0, 0.95, 0); B(0.6, 0.88, 0.055, '#D8EEF8', 0, 1.01, 0.004); B(0.12, 0.6, 0.06, '#FFFFFF', -0.15, 1.15, 0.006, null, 0.5); break;
    case 'mensola': B(0.9, 0.05, 0.26, LEGNO, 0, 1.35, 0.1); for (const [x, c] of [[-0.3, '#E0473C'], [-0.22, '#3FA9F5'], [-0.14, '#FFC93C']]) B(0.07, 0.26, 0.18, c, x, 1.4, 0.1); C(0.07, 0.06, 0.12, '#C9714A', 0.25, 1.4, 0.1); S(0.1, '#3E9B4A', 0.25, 1.6, 0.1); break;
    // ---- catálogo de 25/11 ----
    case 'divano_l': { const p = P('#8A8F98'), sc = tono(p, -0.07), ch = tono(p, 0.07);
      B(2.9, 0.4, 0.85, p, 0, 0, -0.55); B(2.9, 0.55, 0.22, sc, 0, 0.3, -0.89); B(0.85, 0.4, 1.12, p, 1.02, 0, 0.42); B(0.2, 0.55, 0.85, sc, -1.4, 0, -0.55);
      for (const x of [-0.95, -0.05]) B(0.85, 0.12, 0.6, ch, x, 0.4, -0.5); B(0.75, 0.12, 1.5, ch, 1.02, 0.4, 0.2);
      for (const [x, col] of [[-1.1, '#FFC93C'], [0.5, '#F4F1EA']]) B(0.38, 0.32, 0.12, col, x, 0.5, -0.7).rotation.z = 0.18; break; }
    case 'pouf': { const p = P('#E0A33C'); C(0.3, 0.32, 0.38, p); C(0.31, 0.31, 0.05, tono(p, 0.08), 0, 0.38, 0); break; }
    case 'poltrona_relax': { const p = P('#2A2D34'), sc = tono(p, 0.06); B(0.85, 0.4, 0.75, p, 0, 0, -0.05); const sch = B(0.85, 0.75, 0.2, sc, 0, 0.3, -0.38); sch.rotation.x = -0.25; for (const s of [-1, 1]) B(0.14, 0.55, 0.75, sc, s * 0.36, 0, -0.05); B(0.6, 0.3, 0.35, p, 0, 0, 0.38); break; }
    case 'mobile_tv': B(2.8, 0.45, 0.42, BIANCO, 0, 0.05, 0.05); B(2.6, 0.05, 0.04, LEGNO, 0, 0.18, 0.27); B(2.9, 2.1, 0.06, LEGNO, 0, 0, -0.45);
      B(1.6, 0.92, 0.06, NERO, 0, 1.0, -0.4); B(1.5, 0.84, 0.065, '#3FA9F5', 0, 1.04, -0.395, '#1C6FB0'); B(2.6, 0.03, 0.03, '#9AD8FF', 0, 2.0, -0.4, '#7FD3FF');
      for (const s of [-1, 1]) { B(0.5, 0.04, 0.25, LEGNO2, s * 1.15, 1.3, -0.33); B(0.08, 0.22, 0.16, s > 0 ? '#E0473C' : '#3FA9F5', s * 1.05, 1.34, -0.33); S(0.09, '#3E9B4A', s * 1.25, 1.45, -0.33); } break;
    case 'credenza': { const p = P(LEGNO); B(1.8, 0.85, 0.5, p, 0, 0.08, 0); for (const x of [-0.6, 0, 0.6]) { B(0.56, 0.7, 0.02, tono(p, 0.05), x, 0.15, 0.26); B(0.03, 0.12, 0.03, '#E0A33C', x + 0.2, 0.5, 0.28); } for (const x of [-0.8, 0.8]) B(0.05, 0.08, 0.05, METAL, x, 0, 0.2);
      C(0.08, 0.11, 0.32, '#3FA9F5', 0.55, 0.93, 0); for (const [x, y, col] of [[0.5, 1.32, '#E0473C'], [0.6, 1.3, '#FFC93C'], [0.55, 1.38, '#F4A6C0']]) S(0.06, col, x, y, 0); B(0.35, 0.45, 0.04, LEGNO2, -0.5, 0.93, -0.18); break; }
    case 'tavolino_vetro': for (const sx of [-1, 1]) for (const sz of [-1, 1]) C(0.02, 0.02, 0.4, METAL, sx * 0.6, 0, sz * 0.3); B(1.35, 0.03, 0.72, '#BFE3F7', 0, 0.4, 0, null, 0.5); B(1.25, 0.03, 0.62, LEGNO, 0, 0.12, 0);
      B(0.3, 0.05, 0.22, '#E0473C', -0.3, 0.43, 0.05); B(0.28, 0.05, 0.2, '#3FA9F5', -0.3, 0.48, 0.05); C(0.06, 0.05, 0.12, BIANCO, 0.3, 0.43, 0); break;
    case 'lampada_arco': C(0.2, 0.22, 0.06, NERO, -0.3, 0, 0); C(0.022, 0.022, 1.75, METAL, -0.3, 0.06, 0); { const a = B(0.75, 0.03, 0.03, METAL, 0.05, 1.82, 0); a.rotation.z = -0.25; } C(0.06, 0.24, 0.22, '#FFF1C2', 0.38, 1.5, 0, 14, '#FFD966'); break;
    case 'isola': { const p = P(LEGNO); B(1.8, 0.88, 0.85, p); B(1.9, 0.06, 0.95, '#E8E8E8', 0, 0.88, 0); for (const x of [-0.45, 0.45]) B(0.8, 0.02, 0.02, tono(p, -0.1), x, 0.6, 0.43); B(0.5, 0.03, 0.35, METAL, 0.4, 0.94, 0); C(0.12, 0.1, 0.18, '#C9714A', -0.4, 0.94, 0); S(0.1, '#FFC93C', -0.5, 1.15, 0.05); S(0.09, '#E0473C', -0.33, 1.13, -0.05); break; }
    case 'sgabello': { const p = P('#E0473C'); C(0.18, 0.18, 0.06, p, 0, 0.72, 0); C(0.03, 0.03, 0.72, METAL); C(0.2, 0.22, 0.03, METAL); break; }
    case 'tavolo_tondo': C(0.1, 0.25, 0.08, LEGNO2); C(0.07, 0.07, 0.68, LEGNO2, 0, 0.05, 0); C(0.78, 0.78, 0.05, LEGNO, 0, 0.72, 0, 28); C(0.08, 0.1, 0.22, '#F4F1EA', 0, 0.77, 0); for (const [x, z, col] of [[0, 0.04, '#E0473C'], [0.06, -0.03, '#FFC93C']]) S(0.06, col, x, 1.04, z);
      for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2 + 0.785, sd = new THREE.Group(); const m1 = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.05, 0.42), mat(LEGNO)); m1.position.y = 0.45; const m2 = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.45, 0.05), mat(LEGNO)); m2.position.set(0, 0.7, -0.19); sd.add(m1, m2); sd.position.set(Math.sin(a) * 0.72, 0, Math.cos(a) * 0.72); sd.rotation.y = a + Math.PI; g.add(sd); } break;
    case 'caffe': B(0.8, 0.9, 0.55, '#5B6475'); B(0.85, 0.05, 0.6, '#E8E8E8', 0, 0.9, 0); B(0.36, 0.38, 0.3, METAL, 0, 0.95, -0.08); B(0.3, 0.06, 0.04, NERO, 0, 1.1, 0.08); C(0.035, 0.03, 0.06, BIANCO, -0.06, 0.95, 0.12); C(0.035, 0.03, 0.06, BIANCO, 0.07, 0.95, 0.12); C(0.05, 0.06, 0.16, '#C9C9C9', 0.3, 0.95, 0.12, 8); break;
    case 'forno_pizza': B(1.6, 0.8, 0.9, '#B9B2A6'); S(0.62, '#C9714A', 0, 0.8, -0.04, 1.1, 0.8, 0.95); B(0.55, 0.36, 0.12, '#2A2420', 0, 0.82, 0.4); C(0.08, 0.2, 0.22, '#FF8A1F', 0, 0.84, 0.36, 8, '#FF6A00'); C(0.09, 0.09, 0.55, '#8A8F98', 0.25, 1.15, -0.25);
      for (let k = 0; k < 3; k++) { const l = C(0.05, 0.05, 0.5, LEGNO2, -0.55 + k * 0.1, 0.84, 0.32); l.rotation.z = Math.PI / 2; } B(0.45, 0.02, 0.45, '#E0A33C', 0.55, 0.8, 0.3); S(0.04, '#E0473C', 0.55, 0.83, 0.3); break;
    case 'letto_singolo': B(0.95, 0.3, 1.9, LEGNO2); B(0.88, 0.18, 1.8, BIANCO, 0, 0.3, 0.02); B(0.9, 0.06, 1.15, P('#3F7FC1'), 0, 0.46, 0.35); B(0.6, 0.12, 0.3, '#FFFFFF', 0, 0.48, -0.65); B(0.95, 0.85, 0.08, LEGNO2, 0, 0, -0.95); break;
    case 'baldacchino': B(1.8, 0.32, 1.9, '#6B3F2A'); B(1.7, 0.2, 1.8, BIANCO, 0, 0.32, 0.02); B(1.72, 0.07, 1.2, P('#C25B4A'), 0, 0.5, 0.32); for (const s of [-1, 1]) B(0.6, 0.14, 0.3, '#FFFFFF', s * 0.42, 0.52, -0.65);
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) C(0.04, 0.04, 2.35, '#6B3F2A', sx * 0.87, 0, sz * 0.92); for (const sz of [-1, 1]) B(1.8, 0.06, 0.06, '#6B3F2A', 0, 2.33, sz * 0.92); for (const sx of [-1, 1]) B(0.06, 0.06, 1.9, '#6B3F2A', sx * 0.87, 2.33, 0);
      for (const sx of [-1, 1]) B(0.02, 1.8, 1.85, '#FFF6E6', sx * 0.88, 0.55, 0, null, 0.35); B(1.75, 1.9, 0.08, '#6B3F2A', 0, 0, -0.93); break;
    case 'cassettiera': { const p = P(LEGNO); B(0.8, 0.9, 0.5, p); for (let k = 0; k < 3; k++) { B(0.74, 0.02, 0.02, tono(p, -0.1), 0, 0.3 + k * 0.28, 0.26); C(0.03, 0.03, 0.03, '#E0A33C', 0, 0.18 + k * 0.28, 0.27); } C(0.06, 0.09, 0.2, '#FFE08A', 0.2, 0.9, 0, 10, '#FFC93C'); break; }
    case 'toeletta': gambe(0.85, 0.42, 0.72, '#F4F1EA'); B(0.9, 0.05, 0.45, '#F4F1EA', 0, 0.72, 0); { const sp = C(0.3, 0.3, 0.03, '#D8EEF8', 0, 1.15, -0.2, 24); sp.rotation.x = Math.PI / 2; const fr = C(0.33, 0.33, 0.025, '#C9A227', 0, 1.15, -0.215, 24); fr.rotation.x = Math.PI / 2; }
      for (const [x, col] of [[-0.25, '#F4A6C0'], [-0.15, '#B57EDC'], [0.25, '#FFC93C']]) C(0.03, 0.035, 0.1, col, x, 0.77, 0.05); C(0.17, 0.17, 0.4, '#F4A6C0', 0, 0, 0.45); break;
    case 'postazione_gaming': gambe(1.7, 0.7, 0.74, NERO); B(1.8, 0.05, 0.75, NERO, 0, 0.74, 0); B(1.7, 0.02, 0.02, '#B57EDC', 0, 0.71, 0.37, '#B57EDC');
      for (const [x, col] of [[-0.34, '#8B5CF6'], [0.34, '#3FD0FF']]) { B(0.64, 0.4, 0.04, NERO, x, 0.92, -0.22); B(0.6, 0.35, 0.045, col, x, 0.945, -0.215, col); } B(0.08, 0.15, 0.08, NERO, 0, 0.79, -0.22);
      B(0.55, 0.025, 0.18, '#23262E', -0.1, 0.79, 0.12); B(0.5, 0.01, 0.15, '#FF4FB3', -0.1, 0.81, 0.12, '#FF4FB3'); B(0.24, 0.5, 0.46, '#23262E', 0.72, 0, 0); B(0.01, 0.4, 0.38, '#7CFF6B', 0.6, 0.05, 0, '#3FD0FF', 0.7); break;
    case 'sedia_gaming': { const p = P('#E0473C'); C(0.28, 0.28, 0.04, NERO, 0, 0.04, 0, 5); C(0.03, 0.03, 0.4, METAL, 0, 0.06, 0); B(0.55, 0.12, 0.55, p, 0, 0.45, 0); const sc = B(0.55, 0.85, 0.12, p, 0, 0.55, -0.25); sc.rotation.x = -0.12;
      for (const s of [-1, 1]) B(0.1, 0.86, 0.13, NERO, s * 0.2, 0.55, -0.26).rotation.x = -0.12; B(0.32, 0.14, 0.1, NERO, 0, 1.25, -0.3); for (const s of [-1, 1]) B(0.06, 0.06, 0.38, NERO, s * 0.3, 0.68, 0); break; }
    case 'arcade': { const p = P('#3F2A8C'); B(0.7, 1.75, 0.7, p); const sc = B(0.55, 0.45, 0.05, '#7CFF6B', 0, 1.12, 0.32, '#36C93A'); sc.rotation.x = -0.25; const pn = B(0.66, 0.06, 0.32, '#23262E', 0, 0.95, 0.42); pn.rotation.x = 0.2;
      C(0.02, 0.02, 0.1, NERO, -0.15, 1.0, 0.45); S(0.035, '#E0473C', -0.15, 1.11, 0.45); for (const x of [0.05, 0.15, 0.25]) C(0.03, 0.03, 0.03, ['#3FA9F5', '#FFC93C', '#E0473C'][Math.round(x * 10) % 3], x, 1.0, 0.45); B(0.7, 0.2, 0.08, '#FFC93C', 0, 1.6, 0.33, '#FFB300'); break; }
    case 'lavatrice': B(0.6, 0.85, 0.6, '#FFFFFF'); { const o = C(0.2, 0.2, 0.03, '#9ED1F2', 0, 0.42, 0.31, 24); o.rotation.x = Math.PI / 2; const r = C(0.23, 0.23, 0.02, '#C9C9C9', 0, 0.42, 0.305, 24); r.rotation.x = Math.PI / 2; } B(0.5, 0.08, 0.02, '#D8DDE3', 0, 0.74, 0.3); C(0.03, 0.03, 0.02, '#3FA9F5', 0.18, 0.76, 0.31); break;
    case 'mobile_bagno': { const p = P(LEGNO); B(1.7, 0.75, 0.5, p, 0, 0.05, 0); B(1.75, 0.05, 0.52, '#FFFFFF', 0, 0.8, 0); for (const x of [-0.45, 0.45]) { B(0.45, 0.04, 0.3, '#BFE3F7', x, 0.82, 0.02); C(0.02, 0.02, 0.18, METAL, x, 0.85, -0.17); } B(1.4, 0.8, 0.04, '#D8EEF8', 0, 1.15, -0.23); B(1.5, 0.06, 0.06, '#FFFFFF', 0, 1.97, -0.22, '#FFF6D0'); break; }
    case 'jacuzzi': B(1.9, 0.6, 1.9, '#FFFFFF'); B(1.6, 0.04, 1.6, '#6EC6F0', 0, 0.54, 0, '#3FA9F5', 0.85); for (const [x, z] of [[-0.4, 0.2], [0.3, -0.3], [0.1, 0.4], [-0.2, -0.4], [0.5, 0.2]]) S(0.05, '#FFFFFF', x, 0.6, z); B(1.9, 0.15, 0.4, '#E8E2D6', 0, 0, 1.1); for (const s of [-1, 1]) C(0.08, 0.08, 0.12, '#FFE08A', s * 0.85, 0.6, -0.85, 10, '#FFC93C'); break;
    case 'palma': C(0.22, 0.17, 0.38, '#E8E2D6'); C(0.05, 0.08, 1.3, '#8B6A45', 0, 0.38, 0, 7); for (let k = 0; k < 7; k++) { const a = k * 2 * Math.PI / 7, f = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.02, 0.2), mat(k % 2 ? '#3E9B4A' : '#4FB35C')); f.position.set(Math.cos(a) * 0.38, 1.62, -Math.sin(a) * 0.38); f.rotation.set(0, a, -0.45); g.add(f); } break;
    case 'cactus': C(0.2, 0.15, 0.3, '#C9714A'); C(0.12, 0.12, 0.7, '#4FB35C', 0, 0.3, 0, 10); S(0.12, '#4FB35C', 0, 1.0, 0); C(0.06, 0.06, 0.25, '#4FB35C', 0.16, 0.55, 0); C(0.06, 0.06, 0.2, '#4FB35C', -0.16, 0.7, 0); S(0.05, '#F4A6C0', 0, 1.12, 0); break;
    case 'bonsai': B(0.5, 0.15, 0.3, '#3A6EA5'); C(0.04, 0.06, 0.35, '#6B4A2A', 0, 0.15, 0, 6).rotation.z = 0.25; S(0.22, '#3E9B4A', 0.08, 0.55, 0, 1.4, 0.55, 1); S(0.15, '#4FB35C', -0.15, 0.45, 0.05, 1.3, 0.5, 1); break;
    case 'fiori': { const p = P('#E0473C'); C(0.12, 0.09, 0.4, '#F4F1EA'); for (let k = 0; k < 7; k++) { const a = k * 0.9; C(0.008, 0.008, 0.3, '#2E9B55', Math.cos(a) * 0.05, 0.4, Math.sin(a) * 0.05); S(0.06, k % 3 ? p : '#FFC93C', Math.cos(a) * 0.1, 0.72 + (k % 2) * 0.05, Math.sin(a) * 0.1); } break; }
    case 'limone': C(0.26, 0.2, 0.42, '#C9714A'); C(0.04, 0.05, 0.6, '#6B4A2A', 0, 0.42, 0, 6); S(0.38, '#3E9B4A', 0, 1.15, 0, 1, 0.9, 1); for (const [x, y, z] of [[0.25, 1.1, 0.25], [-0.3, 1.2, 0.1], [0.1, 1.38, -0.28], [-0.1, 0.95, 0.32], [0.32, 1.3, -0.1]]) S(0.06, '#FFE24A', x, y, z, 1, 1.25, 1); break;
    case 'neon': { const tex = texNeon(P('#FF4FB3')); const m = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.55), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false })); m.position.set(0, 1.55, 0.03); g.add(m); break; }
    case 'applique': B(0.12, 0.2, 0.06, METAL, 0, 1.6, 0.02); C(0.05, 0.12, 0.16, '#FFF1C2', 0, 1.72, 0.12, 12, '#FFD966'); break;
    case 'tv_parete': B(0.96, 0.58, 0.05, NERO, 0, 1.15, 0.02); B(0.9, 0.52, 0.055, '#3FA9F5', 0, 1.18, 0.025, '#1C6FB0'); B(0.2, 0.02, 0.06, '#E0473C', 0.3, 1.16, 0.05); break;
    case 'poster': { const p = P('#FFC93C'); B(0.62, 0.86, 0.02, '#FFFFFF', 0, 1.0, 0.01); B(0.56, 0.8, 0.025, p, 0, 1.03, 0.012); S(0.14, tono(p, -0.25), 0, 1.55, 0.03, 1, 1, 0.2); B(0.4, 0.06, 0.03, NERO, 0, 1.12, 0.02); B(0.3, 0.04, 0.03, NERO, 0, 1.22, 0.02); break; }
    case 'bandiera': C(0.015, 0.015, 0.9, METAL, -0.38, 1.0, 0.03); for (const [x, col] of [[-0.24, '#009246'], [0, '#FFFFFF'], [0.24, '#CE2B37']]) B(0.24, 0.55, 0.02, col, x, 1.3, 0.02); break;
    case 'orologio_parete': { const f = C(0.24, 0.24, 0.05, NERO, 0, 1.75, 0.03, 28); f.rotation.x = Math.PI / 2; const q = C(0.21, 0.21, 0.055, '#FFFFFF', 0, 1.75, 0.035, 28); q.rotation.x = Math.PI / 2; B(0.02, 0.15, 0.02, NERO, 0, 1.75 + 0.07, 0.07); B(0.12, 0.02, 0.02, NERO, 0.05, 1.75, 0.07); break; }
    case 'maglia': { const [c1, c2] = P(SQUADRE[0]); B(0.72, 0.9, 0.04, NERO, 0, 1.0, 0.02); B(0.64, 0.82, 0.045, '#F4F1EA', 0, 1.04, 0.022);
      B(0.36, 0.48, 0.02, c1, 0, 1.15, 0.05); for (const x of [-0.09, 0.09]) B(0.06, 0.48, 0.022, c2, x, 1.15, 0.051); for (const s of [-1, 1]) { const m = B(0.18, 0.12, 0.02, c1, s * 0.22, 1.5, 0.05); m.rotation.z = s * 0.5; } B(0.08, 0.1, 0.023, c2, 0, 1.36, 0.052); break; }
    case 'biliardo': for (const sx of [-1, 1]) for (const sz of [-1, 1]) B(0.14, 0.65, 0.14, '#6B4A2A', sx * 1.1, 0, sz * 0.55); B(2.55, 0.15, 1.45, '#6B4A2A', 0, 0.65, 0); B(2.35, 0.02, 1.25, '#2E8B57', 0, 0.8, 0);
      for (const [x, z, col] of [[0.6, 0, '#FFFFFF'], [-0.5, 0, '#FFC93C'], [-0.6, 0.07, '#E0473C'], [-0.6, -0.07, '#3F7FC1'], [-0.7, 0, '#111111'], [-0.7, 0.14, '#2E9B55'], [-0.7, -0.14, '#8B5CF6']]) S(0.03, col, x, 0.84, z);
      { const st = B(1.4, 0.02, 0.02, '#E0A33C', 0.9, 0.86, 0.3); st.rotation.y = 0.3; } break;
    case 'calciobalilla': for (const sx of [-1, 1]) for (const sz of [-1, 1]) B(0.08, 0.72, 0.08, NERO, sx * 0.55, 0, sz * 0.3); B(1.3, 0.25, 0.75, LEGNO, 0, 0.72, 0); B(1.18, 0.02, 0.62, '#2E9B55', 0, 0.8, 0);
      for (let k = 0; k < 6; k++) { const x = -0.5 + k * 0.2, rod = C(0.012, 0.012, 1.0, METAL, x, 0.95, -0.5); rod.rotation.x = Math.PI / 2; rod.position.set(x, 0.95, 0); const col = k % 2 ? '#E0473C' : '#3F7FC1'; for (const z of k === 0 || k === 5 ? [0] : [-0.18, 0.18]) B(0.04, 0.14, 0.05, col, x, 0.86, z); } break;
    case 'jukebox': B(0.75, 1.25, 0.5, '#C0392B'); { const t = C(0.375, 0.375, 0.5, '#E67E22', 0, 1.25 - 0.25, 0, 24); t.rotation.x = Math.PI / 2; t.position.set(0, 1.25, 0); } B(0.5, 0.4, 0.03, '#FFE08A', 0, 0.75, 0.26, '#FFC93C'); for (const s of [-1, 1]) B(0.05, 1.1, 0.05, '#FF4FB3', s * 0.34, 0.1, 0.24, '#FF4FB3'); B(0.55, 0.25, 0.03, '#23262E', 0, 0.3, 0.26); break;
    case 'batteria': { const gc = C(0.24, 0.24, 0.3, '#E0473C', 0, 0.26, 0, 18); gc.rotation.x = Math.PI / 2; gc.position.set(0, 0.26, 0.05); for (const [x, y] of [[-0.18, 0.62], [0.18, 0.62]]) C(0.12, 0.12, 0.12, '#E0473C', x, y, 0.1); C(0.15, 0.15, 0.14, '#E0473C', 0.32, 0.4, 0.2);
      for (const [x, z] of [[-0.38, 0.1], [0.4, -0.1]]) { C(0.01, 0.01, 0.95, METAL, x, 0, z); C(0.2, 0.2, 0.01, '#E0A33C', x, 0.95, z, 18); } C(0.15, 0.15, 0.45, NERO, 0, 0, -0.35); break; }
    case 'dj': B(1.6, 0.95, 0.6, NERO); B(1.5, 0.04, 0.02, '#3FD0FF', 0, 0.5, 0.31, '#3FD0FF'); B(1.5, 0.04, 0.02, '#FF4FB3', 0, 0.3, 0.31, '#FF4FB3'); for (const x of [-0.5, 0.5]) { C(0.17, 0.17, 0.03, '#23262E', x, 0.95, 0.02, 24); C(0.04, 0.04, 0.035, '#E0473C', x, 0.95, 0.02); }
      B(0.35, 0.05, 0.3, '#3A3F4B', 0, 0.95, 0.02); for (const x of [-0.1, 0, 0.1]) B(0.02, 0.02, 0.12, '#7CFF6B', x, 1.0, 0.02, '#7CFF6B'); break;
    case 'tapis': B(1.6, 0.14, 0.7, '#23262E'); B(1.45, 0.02, 0.5, '#555B66', 0, 0.14, 0); for (const s of [-1, 1]) B(0.05, 1.1, 0.05, METAL, -0.7, 0.14, s * 0.3); B(0.12, 0.25, 0.65, '#23262E', -0.72, 1.15, 0); B(0.02, 0.15, 0.4, '#3FD0FF', -0.65, 1.2, 0, '#3FD0FF'); break;
    case 'cyclette': B(0.7, 0.06, 0.4, NERO); { const w = C(0.22, 0.22, 0.08, '#3A3F4B', 0.25, 0.3, 0, 20); w.rotation.x = Math.PI / 2; } C(0.025, 0.025, 0.8, METAL, -0.15, 0.05, 0); B(0.3, 0.06, 0.18, NERO, -0.15, 0.85, 0); C(0.025, 0.025, 0.9, METAL, 0.3, 0.05, 0); B(0.06, 0.04, 0.5, '#E0473C', 0.3, 0.95, 0); break;
    case 'albero_natale': C(0.15, 0.18, 0.2, '#B83A3A'); C(0.05, 0.05, 0.3, '#6B4A2A', 0, 0.15, 0); for (const [r, y, h] of [[0.48, 0.35, 0.75], [0.38, 0.8, 0.65], [0.26, 1.2, 0.55]]) { const m = new THREE.Mesh(new THREE.ConeGeometry(r, h, 12), mat('#2E8B4A')); m.position.y = y + h / 2; g.add(m); }
      S(0.08, '#FFD23F', 0, 1.82, 0); g.children[g.children.length - 1].material = mat('#FFD23F', '#FFC000'); for (let k = 0; k < 14; k++) { const a = k * 2.4, y = 0.45 + (k / 14) * 1.15, r = 0.42 - (k / 14) * 0.3; S(0.04, ['#E0473C', '#FFD23F', '#3FA9F5', '#FFFFFF'][k % 4], Math.cos(a) * r, y, Math.sin(a) * r); g.children[g.children.length - 1].material = mat(['#E0473C', '#FFD23F', '#3FA9F5', '#FFFFFF'][k % 4], k % 2 ? '#FFB300' : null); } break;
    case 'regali': for (const [w, h, x, z, col, rib] of [[0.35, 0.3, -0.15, 0.1, '#E0473C', '#FFD23F'], [0.28, 0.22, 0.2, -0.1, '#3F7FC1', '#FFFFFF'], [0.22, 0.4, 0.15, 0.2, '#2E9B55', '#E0473C']]) { B(w, h, w, col, x, 0, z); B(w + 0.005, h + 0.005, 0.05, rib, x, 0, z); B(0.05, h + 0.005, w + 0.005, rib, x, 0, z); } break;
    case 'presepe': B(0.95, 0.08, 0.75, '#8B6A45'); for (const [x, z] of [[-0.35, -0.25], [0.35, -0.25], [-0.35, 0.15], [0.35, 0.15]]) B(0.04, 0.6, 0.04, LEGNO2, x, 0.08, z); for (const s of [-1, 1]) { const t = B(0.45, 0.03, 0.55, '#C9A66B', s * 0.2, 0.75, -0.05); t.rotation.z = s * -0.45; }
      for (const [x, z, col, h] of [[-0.15, 0.05, '#3F7FC1', 0.28], [0.15, 0.05, '#8B5A2B', 0.3], [0, 0.15, '#F2C27B', 0.06], [0.35, 0.3, '#B9B2A6', 0.18]]) { C(0.05, 0.07, h, col, x, 0.08, z); S(0.04, '#F2C9A0', x, 0.08 + h + 0.03, z); } S(0.05, '#FFD23F', 0, 1.0, -0.05); g.children[g.children.length - 1].material = mat('#FFD23F', '#FFC000'); break;
    case 'statua': B(0.5, 0.9, 0.5, '#E8E2D6'); B(0.56, 0.06, 0.56, '#D6CFC2', 0, 0.9, 0); C(0.12, 0.16, 0.6, '#F3F1EC', 0, 0.96, 0, 10); C(0.17, 0.12, 0.15, '#F3F1EC', 0, 1.5, 0, 10); S(0.1, '#F3F1EC', 0, 1.75, 0); { const b = C(0.035, 0.035, 0.4, '#F3F1EC', 0.2, 1.35, 0, 8); b.rotation.z = -0.6; } break;
    default: B(0.6, 0.6, 0.6, '#CCCCCC');
  }
  g.traverse(o => { if (o.isMesh && !o.material.transparent) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}

// ---------- texturas desenhadas (canvas 512 px = 2 x 2 m de chão) ----------
const _tex = new Map();
function texCanvas(k, desenha, rep) {
  let t = _tex.get(k);
  if (!t) {
    const cv = document.createElement('canvas'); cv.width = cv.height = 512;
    desenha(cv.getContext('2d'));
    t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4;
    _tex.set(k, t);
  }
  const c = t.clone(); c.repeat.set(rep[0], rep[1]); c.needsUpdate = true;
  return c;
}
const varia = (c, rnd, a = 0.06) => { const k = new THREE.Color(c); k.offsetHSL(0, 0, (rnd() - 0.5) * a); return `#${k.getHexString()}`; };
function rndDe(seme) { return () => { seme = (seme * 16807) % 2147483647; return seme / 2147483647; }; }
function texPavimento(tipo, cor, w, d) {
  return texCanvas(`${tipo}|${cor}`, x => {
    const rnd = rndDe(11), S = 512;
    x.fillStyle = cor; x.fillRect(0, 0, S, S);
    // retângulo que "dá a volta" na borda (textura repetida sem emenda)
    const ret = (px, py, w, h) => { for (const ox of [0, -S, S]) for (const oy of [0, -S, S]) x.fillRect(px + ox, py + oy, w, h); };
    if (tipo === 'spina') {   // spina di pesce (90°): escadinhas de tábua deitada + tábua em pé, período exato de 512 px
      const W = 32;
      x.fillStyle = tono(cor, -0.12); x.fillRect(0, 0, S, S);
      for (let b = -8; b <= 8; b++) for (let i = -16; i <= 32; i++) {
        const hx = i * W + 2 * W * b, hy = i * W - 2 * W * b;
        x.fillStyle = varia(cor, rnd, 0.12); ret(((hx % S) + S) % S, ((hy % S) + S) % S, 2 * W - 2, W - 2);
        x.fillStyle = varia(cor, rnd, 0.12); ret(((hx % S) + S) % S, (((hy + W) % S) + S) % S, W - 2, 2 * W - 2);
      }
    } else if (['legno', 'noce', 'rovere'].includes(tipo)) {   // tábuas corridas desencontradas
      const W = 32;
      x.fillStyle = tono(cor, -0.1); x.fillRect(0, 0, S, S);
      for (let r = 0; r * W < S; r++) { let px = (r * 97) % 200; const fim = px + S; while (px < fim) { const L = Math.min(150 + Math.floor(rnd() * 160), fim - px); x.fillStyle = varia(cor, rnd, 0.1); ret(px % S, r * W, L - 2, W - 2); x.strokeStyle = 'rgba(0,0,0,0.05)'; for (let v = 0; v < 2; v++) { const yy = r * W + 9 + v * 12; x.beginPath(); x.moveTo((px % S) + 6, yy); x.lineTo((px % S) + L - 10, yy + (rnd() - 0.5) * 4); x.stroke(); } px += L; } }
    } else if (tipo === 'scacchi') {
      const L = 128; for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { x.fillStyle = (i + j) % 2 ? '#22252B' : '#F4F1EA'; x.fillRect(i * L, j * L, L, L); }
      x.strokeStyle = 'rgba(120,120,120,0.5)'; x.lineWidth = 2; for (let k = 0; k <= 4; k++) { x.beginPath(); x.moveTo(k * L, 0); x.lineTo(k * L, S); x.moveTo(0, k * L); x.lineTo(S, k * L); x.stroke(); }
    } else if (['marmo', 'marmo_nero'].includes(tipo)) {   // venature
      const vena = tipo === 'marmo' ? 'rgba(120,120,130,0.35)' : 'rgba(230,230,235,0.45)';
      for (let v = 0; v < 14; v++) { x.strokeStyle = vena; x.lineWidth = 0.6 + rnd() * 1.8; x.beginPath(); let px = rnd() * S, py = rnd() * S; x.moveTo(px, py); for (let k = 0; k < 6; k++) { const nx = px + (rnd() - 0.3) * 160, ny = py + (rnd() - 0.5) * 120; x.quadraticCurveTo((px + nx) / 2 + (rnd() - 0.5) * 60, (py + ny) / 2 + (rnd() - 0.5) * 60, nx, ny); px = nx; py = ny; } x.stroke(); }
      x.strokeStyle = 'rgba(0,0,0,0.12)'; x.lineWidth = 2; for (const k of [0, 256]) { x.beginPath(); x.moveTo(k, 0); x.lineTo(k, S); x.moveTo(0, k); x.lineTo(S, k); x.stroke(); }
    } else if (['piastrelle', 'cotto'].includes(tipo)) {
      const L = tipo === 'cotto' ? 85.33 : 128;
      for (let i = 0; i * L < S - 1; i++) for (let j = 0; j * L < S - 1; j++) { x.fillStyle = varia(cor, rnd, tipo === 'cotto' ? 0.12 : 0.04); x.fillRect(i * L + 2, j * L + 2, L - 4, L - 4); }
    } else if (tipo === 'moquette' || tipo === 'cemento') {
      const img = x.getImageData(0, 0, S, S), dt = img.data;
      for (let p = 0; p < dt.length; p += 4) { const n = (rnd() - 0.5) * (tipo === 'moquette' ? 26 : 14); dt[p] += n; dt[p + 1] += n; dt[p + 2] += n; }
      x.putImageData(img, 0, 0);
      if (tipo === 'cemento') for (let k = 0; k < 18; k++) { x.fillStyle = `rgba(0,0,0,${0.02 + rnd() * 0.03})`; x.beginPath(); x.arc(rnd() * S, rnd() * S, 20 + rnd() * 60, 0, 7); x.fill(); }
    }
  }, [w / 2, d / 2]);
}
function texErba() {
  return texCanvas('erba', x => {
    const rnd = rndDe(5); x.fillStyle = '#8FCB6B'; x.fillRect(0, 0, 512, 512);
    for (let k = 0; k < 2600; k++) { x.fillStyle = ['#7DBE5A', '#9ED67A', '#86C463', '#A8DC85'][Math.floor(rnd() * 4)]; x.fillRect(rnd() * 512, rnd() * 512, 2 + rnd() * 3, 5 + rnd() * 6); }
  }, [40, 40]);
}

// letreiro neon: coração + "AMORE" com brilho, desenhado num canvas
const _neon = new Map();
function texNeon(cor) {
  if (_neon.has(cor)) return _neon.get(cor);
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = 160;
  const x = cv.getContext('2d');
  x.shadowColor = cor; x.shadowBlur = 18; x.strokeStyle = '#FFFFFF'; x.lineWidth = 5; x.lineJoin = 'round';
  x.beginPath(); x.moveTo(128, 92); x.bezierCurveTo(70, 50, 100, 10, 128, 38); x.bezierCurveTo(156, 10, 186, 50, 128, 92); x.stroke();
  x.strokeStyle = cor; x.lineWidth = 3; x.stroke();
  x.font = '900 38px Nunito, sans-serif'; x.textAlign = 'center'; x.fillStyle = '#FFFFFF'; x.shadowBlur = 16; x.fillText('AMORE', 128, 140);
  x.globalCompositeOperation = 'source-atop'; x.fillStyle = cor; x.globalAlpha = 0.35; x.fillRect(0, 0, 256, 160);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
  _neon.set(cor, t); return t;
}

// miniatura 3D de um móvel para o catálogo (renderer pequeno à parte, cache por tipo+cor)
const _mini = new Map();
let _miniR = null;
export function miniatura(tipo, c = 0) {
  const k = `${tipo}|${c}`;
  if (_mini.has(k)) return _mini.get(k);
  if (!_miniR) {
    const cv = document.createElement('canvas'); cv.width = cv.height = 160;
    const r = new THREE.WebGLRenderer({ canvas: cv, antialias: true, alpha: true, preserveDrawingBuffer: true });
    r.setPixelRatio(1); r.setSize(160, 160, false); r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.15;
    const s = new THREE.Scene(); s.add(new THREE.HemisphereLight(0xffffff, 0xb0a48c, 2.2)); const l = new THREE.DirectionalLight(0xffffff, 1.6); l.position.set(3, 5, 4); s.add(l);
    _miniR = { r, s, cam: new THREE.PerspectiveCamera(30, 1, 0.05, 50), cv };
  }
  const { r, s, cam, cv } = _miniR, m = modello(tipo, c);
  if (PEG[tipo]?.[2] === 'muro') m.position.z = 0;
  s.add(m);
  const box = new THREE.Box3().setFromObject(m), ctr = box.getCenter(new THREE.Vector3()), sz = box.getSize(new THREE.Vector3());
  const rad = Math.max(sz.x, sz.y, sz.z) * 0.62 + 0.05, dist = rad / Math.sin(15 * Math.PI / 180);
  const muro = PEG[tipo]?.[2] === 'muro';
  cam.position.set(ctr.x + (muro ? 0.25 : 0.62) * dist, ctr.y + (muro ? 0.12 : 0.5) * dist, ctr.z + (muro ? 0.96 : 0.62) * dist);
  cam.lookAt(ctr); cam.updateProjectionMatrix();
  r.setClearColor(0x000000, 0); r.render(s, cam);
  const url = cv.toDataURL('image/png');
  s.remove(m); m.traverse(o => { o.geometry?.dispose(); });
  _mini.set(k, url);
  return url;
}

export class Interni {
  constructor(D, ui) {
    this.D = D; this.ui = ui;
    this.elenco = new Set();
    this.aperto = false;
    this.W = HW; this.Dd = HD;
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
    if (await conto.compra('interni', 'la tua casa (dentro e fuori)', prezzo, 'Cinque stanze da arredare dentro e la facciata da decorare fuori, per sempre. Tutti potranno visitarla.')) this.apri(conta);
  }

  // ---------- abrir / fechar ----------
  async apri(conta) {
    const casa = this.D.porConta.get(conta); if (!casa) return;
    this.conta = conta; this.edita = this.mio(conta) && this.possiede('interni');
    let dati = null;
    const prova = this.edita && this.ui.conto?.p?.proprietario ? '&prova=1' : '';   // dono testando: interior de prova
    try { const j = await (await fetch(`api/interni.php?conta=${encodeURIComponent(conta)}${prova}&t=${Date.now()}`, { credentials: 'same-origin' })).json(); if (j.ok) dati = j.interno; } catch { /* offline */ }
    if (!dati && !this.edita) { this.ui.aviso('Questa casa non è ancora arredata.'); return; }
    const vecchio = dati && dati.v !== 2;
    this.dati = this.normalizza(dati);
    this.sujo = !dati || vecchio;   // casa nova (presentes) ou casa antiga convertida: salvar
    this.sel = null; this.stanza = null; this.vista = 'alto'; this.pareti = 'auto'; this.des = null; this.passo = null;
    this.storia = []; this.futuro = []; this.cerca = ''; this.cat = this.cat ?? 'tutti';
    this.montarDOM();
    this.seleziona(null);
    this.montarCena();
    if (vecchio) this.migra(dati);
    this.ui.fechar();
    this.aperto = true;
    this.el.hidden = false;
    document.body.classList.add('interni-on');
    this.desenharBarra(); this.desenharStanze();
    this._t = performance.now();
    this._raf = requestAnimationFrame(t => this.loop(t));
    if (this.sujo && this.edita) this.modificato();
  }
  // formato v2: { v: 2, pav, par (do soggiorno, para o servidor antigo), stanze: {id: {pav, par}}, ogg }
  normalizza(d) {
    const st = {};
    for (const s of STANZE) { const o = d?.stanze?.[s.id]; st[s.id] = { pav: o?.pav ?? (s.id === 'soggiorno' && d?.pav ? d.pav : s.pav), par: Number.isInteger(o?.par) ? o.par : (s.id === 'soggiorno' && Number.isInteger(d?.par) ? d.par : s.par) }; }
    if (!d) return { v: 2, stanze: st, ogg: [['divano', 0, 7, 1], ['pianta', 7, 4, 0], ['tavolo', 10, 7, 0], ['sedia', 10, 6, 0], ['sedia', 11, 8, 2], ['letto', 1, 0, 0], ['wc', 7, 0, 0], ['lavandino', 5, 0, 0], ['pianta', 13, 0, 0], ['sedia', 10, 1, 0]] };
    return { v: 2, stanze: st, ogg: d.v === 2 ? (d.ogg ?? []) : [] };
  }
  // casa do formato antigo (1 cômodo, paredes ao fundo e à esquerda): os móveis vão para o soggiorno (z + 4) e o bagno ganha os presentes
  migra(d) {
    const S = STANZA.soggiorno;
    for (const [t, x, z, r] of (d.ogg ?? []).filter(o => PEG[o[0]])) {
      if (PEG[t][2] === 'muro') { const p = this.postoMuro(t, 'soggiorno', x); if (p) this.ogg.push(this.nuovo(t, ...p)); continue; }
      const o = { t, x: 0, z: 0, r: 0 };
      if (this.cabe(o, x + S.x, z + S.z, r)) this.ogg.push(this.nuovo(t, x + S.x, z + S.z, r));
      else { const p = this.postoLibero(t, 'soggiorno') ?? this.postoLibero(t); if (p) this.ogg.push(this.nuovo(t, ...p)); }
    }
    for (const [t, x, z, r] of [['letto', 1, 0, 0], ['wc', 7, 0, 0], ['lavandino', 5, 0, 0]]) if (!this.ogg.some(o => o.t === t) && this.cabe({ t }, x, z, r)) this.ogg.push(this.nuovo(t, x, z, r));
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
        <div class="in-stanze"></div>
        <div class="in-ctrl"><button type="button" data-ctl="vista" title="Vista"></button><button type="button" data-ctl="pareti" title="Pareti"></button><button type="button" data-ctl="centra" title="Centra">🎯</button><button type="button" data-ctl="annulla" title="Annulla">↶</button><button type="button" data-ctl="ripeti" title="Ripeti">↷</button></div>
        <div class="in-sel" hidden><b class="in-sel-nome"></b><button type="button" data-in="ruota">↻ Ruota</button><button type="button" data-in="colore">🎨 Colore</button><button type="button" data-in="duplica">⧉ Duplica</button><button type="button" data-in="togli">🗑️</button><button type="button" data-in="ok">✓</button></div>
        <div class="in-dica"></div>
        <div class="in-barra"></div>`;
      document.body.appendChild(d);
      this.el = d; this.cv = d.querySelector('canvas');
      d.querySelector('.in-esci').onclick = () => this.chiudi();
      d.querySelector('.in-salva').onclick = () => this.salva();
      d.querySelector('.in-sel').addEventListener('click', e => { const b = e.target.closest('[data-in]'); if (b) this.azioneSel(b.dataset.in); });
      d.querySelector('.in-barra').addEventListener('click', e => this.cliqueBarra(e));
      d.querySelector('.in-barra').addEventListener('input', e => { if (e.target.classList.contains('in-cerca')) { this.cerca = e.target.value; this.desenharGriglia(); } });
      d.querySelector('.in-stanze').addEventListener('click', e => { const b = e.target.closest('[data-st]'); if (b) this.vaiStanza(b.dataset.st || null); });
      d.querySelector('.in-ctrl').addEventListener('click', e => { const b = e.target.closest('[data-ctl]'); if (b) this.controllo(b.dataset.ctl); });
      this.ligarPonteiro(); this.ligarTeclado();
      addEventListener('resize', () => { if (this.aperto) this.redimensionar(); });
      addEventListener('pagehide', () => { if (this.aperto) this.salvaSubito(); });
      document.addEventListener('visibilitychange', () => { if (document.hidden && this.aperto) this.salvaSubito(); });
    }
    this.el.querySelector('.in-titolo').textContent = `🏠 Casa di @${this.conta}`;
    this.el.querySelector('.in-salva').hidden = !this.edita;
    this.aggiornaCtrl();
  }
  aggiornaCtrl() {
    const c = this.el.querySelector('.in-ctrl');
    c.querySelector('[data-ctl="vista"]').textContent = this.vista === 'alto' ? '🚶' : '🗺️';
    c.querySelector('[data-ctl="vista"]').title = this.vista === 'alto' ? 'Entra e cammina' : 'Vista dall’alto';
    for (const k of ['annulla', 'ripeti']) { const b = c.querySelector(`[data-ctl="${k}"]`); b.hidden = !this.edita; b.disabled = !(k === 'annulla' ? this.storia : this.futuro)?.length; }
    const pb = c.querySelector('[data-ctl="pareti"]');
    pb.textContent = { auto: '🧱', basse: '⬇️', alte: '⬆️' }[this.pareti]; pb.hidden = this.vista !== 'alto';
    pb.title = { auto: 'Pareti: automatiche', basse: 'Pareti: basse', alte: 'Pareti: alte' }[this.pareti];
    this.el.querySelector('.in-dica').textContent = this.vista === 'dentro'
      ? 'Trascina per guardarti intorno · tocca il pavimento per camminare' + (matchMedia('(pointer: fine)').matches ? ' · WASD o frecce' : '')
      : (this.edita ? 'Tocca un mobile per spostarlo · trascina per girare a 360°' : 'Trascina per girare a 360° · due dita per lo zoom');
  }
  desenharStanze() {
    const b = this.el.querySelector('.in-stanze');
    b.innerHTML = `<button type="button" data-st="" class="${this.stanza ? '' : 'on'}">🏠 Tutta</button>` + STANZE.map(s => `<button type="button" data-st="${s.id}" class="${this.stanza === s.id ? 'on' : ''}">${s.ic} ${s.nome}</button>`).join('');
  }

  // ---------- cena ----------
  montarCena() {
    if (!this.r) {
      this.r = new THREE.WebGLRenderer({ canvas: this.cv, antialias: true });
      this.r.setPixelRatio(Math.min(devicePixelRatio, 2));
      this.r.toneMapping = THREE.ACESFilmicToneMapping; this.r.toneMappingExposure = 1.12;
      this.r.shadowMap.enabled = true; this.r.shadowMap.type = THREE.PCFSoftShadowMap;
      this.cam = new THREE.PerspectiveCamera(42, 1, 0.05, 300);
      this.ray = new THREE.Raycaster();
    }
    if (this.cena) this.cena.traverse(o => { o.geometry?.dispose(); if (o.material && !o.material.map) o.material.dispose?.(); });   // cena anterior (ricostruisci)
    const s = this.cena = new THREE.Scene();
    s.background = new THREE.Color('#BFE0FF');
    s.fog = new THREE.Fog('#BFE0FF', 60, 140);
    s.add(new THREE.HemisphereLight(0xffffff, 0xb0a48c, 1.9));
    s.add(new THREE.AmbientLight(0xffffff, 0.55));   // dentro da casa as paredes não ficam cinza
    // sol com sombra suave (luz de fim de tarde entrando pelas janelas)
    const sol = new THREE.DirectionalLight(0xfff1dc, 1.7); sol.position.set(9, 14, 7); sol.castShadow = true;
    Object.assign(sol.shadow.camera, { left: -13, right: 13, top: 13, bottom: -13, near: 1, far: 50 }); sol.shadow.mapSize.set(2048, 2048); sol.shadow.bias = -0.0006; sol.shadow.normalBias = 0.02;
    s.add(sol);
    const box = (w, h, d, c, x, y, z, op = 1, grupo = s) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshLambertMaterial({ color: c, ...(op < 1 ? { transparent: true, opacity: op, depthWrite: false } : {}) })); m.position.set(x, y, z); if (op === 1) { m.castShadow = true; m.receiveShadow = true; } grupo.add(m); return m; };
    const gx = x => x - HW / 2, gz = z => z - HD / 2;
    this.giardino(s, box, gx, gz);
    // pisos (um por cômodo), com textura desenhada (spina di pesce, piastrelle, marmo…)
    this.pisi = {};
    for (const st of STANZE) {
      const pv = this.pavDi(st.id), g = new THREE.Group(); s.add(g);
      const base = box(st.w, 0.12, st.d, pv[2], gx(st.x + st.w / 2), -0.06, gz(st.z + st.d / 2), 1, g); base.castShadow = false;
      const pl = new THREE.Mesh(new THREE.PlaneGeometry(st.w, st.d), new THREE.MeshLambertMaterial({ map: texPavimento(pv[0], pv[2], st.w, st.d) }));
      pl.rotation.x = -Math.PI / 2; pl.position.set(gx(st.x + st.w / 2), 0.001, gz(st.z + st.d / 2)); pl.receiveShadow = true; g.add(pl);
      this.pisi[st.id] = g;
    }
    // teto (só na vista de dentro)
    this.tetto = new THREE.Mesh(new THREE.PlaneGeometry(HW, HD), new THREE.MeshBasicMaterial({ color: '#F7F3EA', side: THREE.DoubleSide }));
    this.tetto.rotation.x = Math.PI / 2; this.tetto.position.y = HP; this.tetto.visible = false; s.add(this.tetto);
    // paredes: trechos contínuos (mesma linha, mesmo tipo, mesmos cômodos dos dois lados); cada lado com a cor do seu cômodo
    this.tratti = []; this.muriPick = [];
    const linee = [];
    for (let Z = 0; Z <= HD; Z++) linee.push({ or: 'h', L: Z, n: HW });
    for (let X = 0; X <= HW; X++) linee.push({ or: 'v', L: X, n: HD });
    for (const li of linee) {
      let run = null;
      const fecha = () => { if (run) this.tratti.push(this.costruisciTratto(run, box, gx, gz)); run = null; };
      for (let i = 0; i < li.n; i++) {
        const k = `${li.or}:${li.L}:${i}`, tipo = EDGE.get(k);
        if (!tipo) { fecha(); continue; }
        const [a, b] = li.or === 'h' ? [stanzaDi(i, li.L - 1), stanzaDi(i, li.L)] : [stanzaDi(li.L - 1, i), stanzaDi(li.L, i)];
        const sig = `${tipo}|${a}|${b}`;
        if (run && run.sig === sig) { run.b = i + 1; continue; }
        fecha(); run = { or: li.or, L: li.L, a: i, b: i + 1, tipo, neg: a, pos: b, sig };
      }
      fecha();
    }
    this.edgeTratto = new Map();
    for (const tr of this.tratti) for (let i = tr.a; i < tr.b; i++) this.edgeTratto.set(`${tr.or}:${tr.L}:${i}`, tr);
    // grade (só editando, só na vista de cima)
    const gp = [];
    for (const st of STANZE) { for (let k = 0; k <= st.w; k++) gp.push(gx(st.x + k), 0.01, gz(st.z), gx(st.x + k), 0.01, gz(st.z + st.d)); for (let k = 0; k <= st.d; k++) gp.push(gx(st.x), 0.01, gz(st.z + k), gx(st.x + st.w), 0.01, gz(st.z + k)); }
    const gg = new THREE.BufferGeometry(); gg.setAttribute('position', new THREE.Float32BufferAttribute(gp, 3));
    this.griglia = new THREE.LineSegments(gg, new THREE.LineBasicMaterial({ color: '#152033', transparent: true, opacity: 0.1 }));
    this.griglia.visible = this.edita; s.add(this.griglia);
    // marcador da seleção
    this.marca = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color: '#FFC93C', transparent: true, opacity: 0.55, depthWrite: false, side: THREE.DoubleSide }));
    this.marca.visible = false; s.add(this.marca);
    // móveis
    this.ogg = [];
    for (const [t, x, z, r, c] of this.dati.ogg.filter(o => PEG[o[0]])) { if (this.cabe({ t }, x, z, r)) this.ogg.push(this.nuovo(t, x, z, r, c)); }
    // câmera: valores desejados (des) e atuais (cur) — o atual persegue o desejado (movimento suave)
    if (!this.des) this.vistaIniziale();
    this.redimensionar();
  }
  // fora da casa: prato com textura, calçada, caminho até a porta, cerca viva, árvores, canteiros, poste e caixa de correio
  giardino(s, box, gx, gz) {
    const erba = new THREE.Mesh(new THREE.PlaneGeometry(160, 160), new THREE.MeshLambertMaterial({ map: texErba() }));
    erba.rotation.x = -Math.PI / 2; erba.position.y = -0.14; erba.receiveShadow = true; s.add(erba);
    box(HW + 1.2, 0.1, HD + 1.2, '#D9CFBF', 0, -0.1, 0).castShadow = false;            // calçada em volta da casa
    box(1.4, 0.04, 5.2, '#D9CFBF', gx(3.5), -0.12, gz(HD) + 3).castShadow = false;      // caminho até a porta
    const LX = HW / 2 + 5, LZ = HD / 2 + 5.5;                                              // lote
    // cerca viva: fundo, lados e frente (com o portão no caminho)
    const siepe = (w, d, x, z) => box(w, 0.9, d, '#3E8B47', x, 0.31, z);
    siepe(2 * LX, 0.6, 0, -LZ); siepe(0.6, 2 * LZ, -LX, 0); siepe(0.6, 2 * LZ, LX, 0);
    const porta = gx(3.5), e1 = porta - 0.9 - -LX, e2 = LX - (porta + 0.9);
    siepe(e1, 0.6, -LX + e1 / 2, LZ); siepe(e2, 0.6, LX - e2 / 2, LZ);
    for (const sgn of [-1, 1]) { box(0.25, 1.3, 0.25, '#E8E2D6', porta + sgn * 0.95, 0.5, LZ); box(0.3, 0.06, 0.3, '#D6CFC2', porta + sgn * 0.95, 1.18, LZ); }
    // strada davanti
    box(160, 0.02, 6, '#7E8794', 0, -0.13, LZ + 4.2).castShadow = false;
    for (let k = -14; k <= 14; k++) box(1.6, 0.025, 0.14, '#FFFFFF', k * 4, -0.12, LZ + 4.2).castShadow = false;
    box(160, 0.06, 1.4, '#E4E1DA', 0, -0.12, LZ + 0.9).castShadow = false;
    // árvores e canteiros (sempre iguais)
    let seme = 7;
    const rnd = () => { seme = (seme * 16807) % 2147483647; return seme / 2147483647; };
    const albero = (x, z, sc = 1) => {
      const t = new THREE.Mesh(new THREE.CylinderGeometry(0.12 * sc, 0.16 * sc, 1.4 * sc, 7), new THREE.MeshLambertMaterial({ color: '#6B4A2A' })); t.position.set(x, 0.56 * sc, z);
      const ch = new THREE.Mesh(new THREE.IcosahedronGeometry(1.1 * sc, 0), new THREE.MeshLambertMaterial({ color: rnd() < 0.5 ? '#3E9B4A' : '#5AA84F', flatShading: true })); ch.position.set(x, 1.9 * sc, z); ch.scale.y = 1.15;
      for (const m of [t, ch]) { m.castShadow = true; m.receiveShadow = true; s.add(m); }
    };
    for (const [x, z, sc] of [[-LX + 2, -LZ + 2, 1.2], [LX - 2, -LZ + 2.2, 1], [-LX + 2.2, LZ - 2.5, 0.9], [LX - 2.4, LZ - 2, 1.1], [LX - 2, 0, 0.85], [-LX + 1.8, 1, 0.95]]) albero(x, z, sc);
    for (const [x0, z0] of [[porta - 2.6, HD / 2 + 1.6], [porta + 2.6, HD / 2 + 1.6], [gx(10.5), HD / 2 + 1.6]]) {
      box(2.2, 0.18, 0.9, '#7B5233', x0, -0.05, z0).castShadow = false;
      for (let k = 0; k < 6; k++) { const f = new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 6), new THREE.MeshLambertMaterial({ color: ['#E0473C', '#FFC93C', '#F4A6C0', '#B57EDC'][Math.floor(rnd() * 4)] })); f.position.set(x0 - 0.9 + k * 0.36, 0.14, z0 + (rnd() - 0.5) * 0.4); s.add(f); }
    }
    // caixa de correio e poste
    box(0.08, 1.0, 0.08, '#23262E', porta + 1.6, 0.36, LZ - 0.6); box(0.4, 0.28, 0.25, '#CE2B37', porta + 1.6, 1.0, LZ - 0.6);
    box(0.1, 2.6, 0.1, '#23262E', porta - 1.7, 1.15, LZ - 0.6);
    const luce = new THREE.Mesh(new THREE.SphereGeometry(0.17, 10, 8), new THREE.MeshLambertMaterial({ color: '#FFF1C2', emissive: '#FFD966', emissiveIntensity: 0.8 })); luce.position.set(porta - 1.7, 2.55, LZ - 0.6); s.add(luce);
  }
  pavDi(id) { return (this.cfg.interni?.pavimenti ?? []).find(p => p[0] === this.dati.stanze[id].pav) ?? DEF_PAV; }
  parDi(id) { return id ? ((this.cfg.interni?.pareti ?? DEF_PAR)[this.dati.stanze[id].par] ?? '#FFF6E6') : '#F3E2C2'; }
  costruisciTratto(run, box, gx, gz) {
    const tr = { ...run, alto: new THREE.Group(), basso: new THREE.Group(), muri: [] };
    this.cena.add(tr.alto, tr.basso);
    const len = run.b - run.a, mid = (run.a + run.b) / 2;
    const lato = (sgn, stanza) => {   // sgn −1 = lado z−/x− ; +1 = lado z+/x+
      const cor = this.parDi(stanza), off = sgn * T / 2;
      const at = (w, h, y, c = cor, op = 1, g = tr.alto) => run.or === 'h'
        ? box(len - 0.002, h, T, c, gx(mid), y + h / 2, gz(run.L) + off, op, g)
        : box(T, h, len - 0.002, c, gx(run.L) + off, y + h / 2, gz(mid), op, g);
      const marca = m => { if (stanza) { m.userData.muro = { or: run.or, L: run.L, sgn }; tr.muri.push(m); this.muriPick.push(m); } return m; };
      if (run.tipo === 'pieno') marca(at(len, HP, 0));
      else if (run.tipo === 'finestra') { marca(at(len, 0.9, 0)); marca(at(len, HP - 2.0, 2.0)); at(len, 0.06, 0.9, '#FFFFFF'); }
      else if (run.tipo === 'porta') marca(at(len, HP - 2.15, 2.15));
      else if (run.tipo === 'portone') { marca(at(len, HP - 2.15, 2.15)); at(len, 2.15, 0, '#8B5A2B'); }
      if (run.tipo !== 'porta') at(len, BASSO, 0, cor, 1, tr.basso);
      if (stanza && run.tipo !== 'porta' && run.tipo !== 'portone') {   // battiscopa bianco (nas duas alturas da parede)
        for (const gr of [tr.alto, tr.basso]) { const bs = run.or === 'h' ? box(len - 0.002, 0.09, 0.02, '#FFFFFF', gx(mid), 0.045, gz(run.L) + sgn * (T / 2 + 0.01), 1, gr) : box(0.02, 0.09, len - 0.002, '#FFFFFF', gx(run.L) + sgn * (T / 2 + 0.01), 0.045, gz(mid), 1, gr); bs.castShadow = false; }
      }
    };
    lato(-1, run.neg); lato(1, run.pos);
    if (run.tipo === 'finestra') run.or === 'h' ? box(len - 0.1, 1.1, 0.03, '#BFE3F7', gx(mid), 1.45, gz(run.L), 0.35, tr.alto) : box(0.03, 1.1, len - 0.1, '#BFE3F7', gx(run.L), 1.45, gz(mid), 0.35, tr.alto);
    if (run.tipo === 'portone' && run.or === 'h') for (const sgn of [-1, 1]) box(0.08, 0.08, 0.04, '#FFC93C', gx(run.a + 0.8), 1.0, gz(run.L) + sgn * (T + 0.02), 1, tr.alto);   // maçaneta
    tr.cx = gx(mid); tr.cz = gz(run.L); if (run.or === 'v') { tr.cx = gx(run.L); tr.cz = gz(mid); }
    tr.basso.visible = false;
    return tr;
  }
  vistaIniziale() {
    this.des = { tx: 0, tz: 0, yaw: 0.6, pitch: 0.95, dist: this.distPer(HW), fov: 42, ex: STANZA.soggiorno.x + 4 - HW / 2, ez: STANZA.soggiorno.z + 4 - HD / 2, lyaw: Math.PI, lpitch: -0.05 };
    this.cur = { ...this.des, dist: 30 };
    this.vel = 0;
  }
  nuovo(t, x, z, r, c = 0) {
    const o = { t, x, z, r, c: Number.isInteger(c) && c > 0 ? c : 0, m: modello(t, c) };
    o.m.traverse(k => { k.userData.o = o; });
    this.cena.add(o.m); this.posiziona(o);
    return o;
  }
  muro(t) { return PEG[t][2] === 'muro'; }
  peg(o) { const [w, d] = PEG[o.t]; return this.muro(o.t) ? [1, 1] : o.r % 2 ? [d, w] : [w, d]; }
  posiziona(o) {
    if (this.muro(o.t)) {
      const p = [[0.5, 0.04], [0.04, 0.5], [0.5, 0.96], [0.96, 0.5]][o.r];
      o.m.position.set(o.x + p[0] - HW / 2, 0, o.z + p[1] - HD / 2); o.m.rotation.y = [0, Math.PI / 2, Math.PI, -Math.PI / 2][o.r];
      return;
    }
    const [w, d] = this.peg(o);
    o.m.position.set(o.x + w / 2 - HW / 2, PEG[o.t][2] === 'piano' ? 0 : 0.001, o.z + d / 2 - HD / 2);
    o.m.rotation.y = o.r * Math.PI / 2;   // r=1 olha para +x
  }
  // cabe? chão: dentro da casa, inteiro num cômodo só, sem bater em outro móvel. parede: parede cheia ali e lugar livre
  cabe(o, x, z, r) {
    if (!PEG[o.t] || !Number.isInteger(x) || !Number.isInteger(z) || r < 0 || r > 3) return false;
    if (this.muro(o.t)) {
      if (x < 0 || z < 0 || x >= HW || z >= HD || EDGE.get(chiave(x, z, r)) !== 'pieno') return false;
      return !this.ogg.some(p => p !== o && this.muro(p.t) && p.x === x && p.z === z && p.r === r);
    }
    const [w0, d0] = PEG[o.t], [w, d] = r % 2 ? [d0, w0] : [w0, d0];
    if (x < 0 || z < 0 || x + w > HW || z + d > HD) return false;
    const st = stanzaDi(x, z);
    for (let i = x; i < x + w; i++) for (let j = z; j < z + d; j++) if (stanzaDi(i, j) !== st) return false;
    if (PEG[o.t][2]) return true;   // tapete não ocupa lugar
    for (const p of this.ogg) {
      if (p === o || PEG[p.t][2]) continue;
      const [pw, pd] = this.peg(p);
      if (x < p.x + pw && x + w > p.x && z < p.z + pd && z + d > p.z) return false;
    }
    return true;
  }
  // primeiro lugar livre num cômodo (perto do centro); sem cômodo = em qualquer um
  postoLibero(t, sid = null) {
    const sts = sid ? [STANZA[sid]] : STANZE, o = { t };
    for (const st of sts) {
      const celle = [];
      for (let z = st.z; z < st.z + st.d; z++) for (let x = st.x; x < st.x + st.w; x++) celle.push([Math.hypot(x + 0.5 - st.x - st.w / 2, z + 0.5 - st.z - st.d / 2), x, z]);
      celle.sort((a, b) => a[0] - b[0]);
      for (const [, x, z] of celle) for (const r of [0, 1, 2, 3]) if (this.cabe(o, x, z, r)) return [x, z, r];
    }
    return null;
  }
  postoMuro(t, sid = null, pref = null) {
    const sts = sid ? [STANZA[sid]] : STANZE, o = { t };
    for (const st of sts) {
      const cand = [];
      for (let z = st.z; z < st.z + st.d; z++) for (let x = st.x; x < st.x + st.w; x++) for (const r of [0, 1, 2, 3]) if (this.cabe(o, x, z, r)) cand.push([x, z, r]);
      if (pref != null) cand.sort((a, b) => (a[2] - b[2]) || Math.abs(a[0] - st.x - pref) - Math.abs(b[0] - st.x - pref));
      if (cand.length) return cand[0];
    }
    return null;
  }
  redimensionar() {
    const w = innerWidth, h = innerHeight;
    this.r.setSize(w, h, false); this.cam.aspect = w / h; this.ritratto = w < h;
    // PC com o catálogo na lateral esquerda: o centro da imagem vai para o meio da área livre
    if (this.edita && w >= 900 && h >= 560) this.cam.setViewOffset(w, h, -195, 0, w, h); else this.cam.clearViewOffset();
    this.cam.updateProjectionMatrix();
  }

  // ---------- câmera ----------
  vaiStanza(id) {
    this.stanza = id; this.desenharStanze(); this.desenharBarra();
    const st = id ? STANZA[id] : null, d = this.des;
    if (this.vista === 'dentro') {
      const s = st ?? STANZA.soggiorno;
      d.ex = s.x + s.w / 2 - HW / 2; d.ez = s.z + s.d / 2 - HD / 2;
      return;
    }
    if (st) { d.tx = st.x + st.w / 2 - HW / 2; d.tz = st.z + st.d / 2 - HD / 2; d.dist = this.distPer(Math.max(st.w, st.d)); d.pitch = Math.max(d.pitch, 0.9); }
    else { d.tx = 0; d.tz = 0; d.dist = this.distPer(HW); }
  }
  // distância para caber um tamanho na tela (o lado mais estreito manda: no celular em pé, a largura)
  distPer(size) {
    const v = 42 * Math.PI / 180, asp = innerWidth / innerHeight, h = 2 * Math.atan(Math.tan(v / 2) * asp);
    return clamp((size / 2 + 0.6) / Math.tan(Math.min(v, h) / 2) * 0.95, 4, 45);
  }
  controllo(c) {
    if (c === 'vista') {
      this.vista = this.vista === 'alto' ? 'dentro' : 'alto';
      const d = this.des;
      if (this.vista === 'dentro') {   // entra no cômodo em foco (ou no soggiorno), olhando para o centro da casa
        const s = STANZA[this.stanza ?? 'soggiorno'];
        d.ex = s.x + s.w / 2 - HW / 2; d.ez = s.z + s.d / 2 - HD / 2; d.lyaw = Math.atan2(d.ex, d.ez); d.lpitch = -0.08; d.fov = 70;
        Object.assign(this.cur, { ex: d.ex, ez: d.ez, lyaw: d.lyaw, lpitch: d.lpitch, fov: d.fov });
        this.passo = null;
      } else { d.fov = 42; this.cur.fov = 42; }
      this.aggiornaCtrl();
      return;
    }
    if (c === 'pareti') { this.pareti = { auto: 'basse', basse: 'alte', alte: 'auto' }[this.pareti]; this.aggiornaCtrl(); return; }
    if (c === 'annulla' || c === 'ripeti') return this.annulla(c === 'annulla' ? -1 : 1);
    if (c === 'centra') this.vaiStanza(this.stanza);
  }
  loop(now) {
    if (!this.aperto) return;
    const dt = clamp((now - this._t) / 1000 || 0.016, 0, 0.05); this._t = now;
    const d = this.des, c = this.cur, k = 1 - Math.exp(-dt * 9);
    const cam = this.cam;
    // teclado
    const tk = this.tasti;
    if (tk.size) {
      if (this.vista === 'dentro') {
        const f = (tk.has('w') || tk.has('arrowup') ? 1 : 0) - (tk.has('s') || tk.has('arrowdown') ? 1 : 0), lat = (tk.has('d') ? 1 : 0) - (tk.has('a') ? 1 : 0);
        d.lyaw += ((tk.has('arrowleft') || tk.has('q') ? 1 : 0) - (tk.has('arrowright') || tk.has('e') ? 1 : 0)) * dt * 1.8;
        if (f || lat) {   // frente = para onde olha; direita = frente girada 90°
          this.passo = null;
          const v = 2.4 * dt, fx = -Math.sin(d.lyaw), fz = -Math.cos(d.lyaw), rx = -fz, rz = fx;
          this.muovi(d, (fx * f + rx * lat) * v, (fz * f + rz * lat) * v);
        }
      } else {
        d.yaw += ((tk.has('arrowleft') || tk.has('a') ? 1 : 0) - (tk.has('arrowright') || tk.has('d') ? 1 : 0)) * dt * 1.6;
        d.pitch = clamp(d.pitch + ((tk.has('arrowup') || tk.has('w') ? 1 : 0) - (tk.has('arrowdown') || tk.has('s') ? 1 : 0)) * dt * 1.0, 0.18, 1.45);
        if (tk.has('+') || tk.has('=')) d.dist = clamp(d.dist * (1 - dt * 1.5), 3, 70);
        if (tk.has('-')) d.dist = clamp(d.dist * (1 + dt * 1.5), 3, 70);
      }
    }
    // inércia do giro
    if (!this._giro && Math.abs(this.vel) > 0.0004) { if (this.vista === 'alto') d.yaw += this.vel; else d.lyaw += this.vel; this.vel *= Math.pow(0.04, dt); }
    // andar até o ponto tocado
    if (this.passo && this.vista === 'dentro') {
      const dx = this.passo.x - d.ex, dz = this.passo.z - d.ez, dist = Math.hypot(dx, dz);
      if (dist < 0.08) this.passo = null;
      else { const v = Math.min(dist, 2.6 * dt); const ox = d.ex, oz = d.ez; this.muovi(d, dx / dist * v, dz / dist * v); if (Math.hypot(d.ex - ox, d.ez - oz) < v * 0.3) this.passo = null; }
    }
    for (const key of ['tx', 'tz', 'pitch', 'dist', 'fov', 'ex', 'ez', 'lpitch']) c[key] += (d[key] - c[key]) * k;
    c.yaw += (d.yaw - c.yaw) * k; c.lyaw += (d.lyaw - c.lyaw) * k;
    if (cam.fov !== c.fov) { cam.fov = c.fov; cam.updateProjectionMatrix(); }
    const dentro = this.vista === 'dentro';
    if (dentro) {
      cam.position.set(c.ex, OCCHI, c.ez);
      cam.lookAt(c.ex - Math.sin(c.lyaw) * Math.cos(c.lpitch), OCCHI + Math.sin(c.lpitch), c.ez - Math.cos(c.lyaw) * Math.cos(c.lpitch));
    } else {
      // a barra de baixo cobre parte da tela: desloca o quadro para a casa ficar um pouco mais para cima
      const off = c.dist * 0.09, ox = Math.sin(c.yaw) * off, oz = Math.cos(c.yaw) * off;
      cam.position.set(c.tx + ox + Math.sin(c.yaw) * c.dist * Math.cos(c.pitch), c.dist * Math.sin(c.pitch), c.tz + oz + Math.cos(c.yaw) * c.dist * Math.cos(c.pitch));
      cam.lookAt(c.tx + ox, 0.4, c.tz + oz);
    }
    this.tetto.visible = dentro; this.griglia.visible = this.edita && !dentro;
    // paredes do lado da câmera abaixam (casa de bonecas); dentro, todas inteiras
    const ddx = cam.position.x - c.tx, ddz = cam.position.z - c.tz, dl = Math.hypot(ddx, ddz) || 1, ux = ddx / dl, uz = ddz / dl;
    for (const tr of this.tratti) {
      let giu = false;
      if (!dentro) {
        if (this.pareti === 'basse') giu = true;
        else if (this.pareti === 'auto') {
          const nx = tr.or === 'v' ? 1 : 0, nz = tr.or === 'h' ? 1 : 0, vx = tr.cx - c.tx, vz = tr.cz - c.tz;
          giu = (vx * ux + vz * uz) > -0.4 && Math.abs(nx * ux + nz * uz) > 0.3;
        }
      }
      tr.alto.visible = !giu; tr.basso.visible = giu; tr.giu = giu;
    }
    for (const o of this.ogg) o.m.visible = !this.muro(o.t) || !this.edgeTratto.get(chiave(o.x, o.z, o.r))?.giu;
    if (this.sel) {
      const m = this.marca, s = this.sel; m.visible = true;
      if (this.muro(s.t)) { const ry = s.m.rotation.y; m.scale.set(1, 1.25, 1); m.rotation.set(0, ry, 0); m.position.set(s.m.position.x - Math.sin(ry) * 0.012, 1.3, s.m.position.z - Math.cos(ry) * 0.012); }
      else { const [w, dd] = this.peg(s); m.scale.set(w, dd, 1); m.rotation.set(-Math.PI / 2, 0, 0); m.position.set(s.m.position.x, 0.015, s.m.position.z); }
    } else this.marca.visible = false;
    this.r.render(this.cena, cam);
    this._raf = requestAnimationFrame(t => this.loop(t));
  }
  // anda na vista de dentro sem atravessar paredes (portas abertas deixam passar)
  muovi(d, dx, dz) {
    const R = 0.28, bloc = k => { const t = EDGE.get(k); return t && t !== 'porta'; };
    let x = d.ex + HW / 2, z = d.ez + HD / 2;
    if (dx) {
      const nx = x + dx, row = Math.floor(z);
      if (dx > 0) { const X = Math.ceil(x + R - 1e-6); if (nx + R >= X && bloc(`v:${X}:${row}`)) x = Math.min(nx, X - R - 1e-3); else x = nx; }
      else { const X = Math.floor(x - R + 1e-6); if (nx - R <= X && bloc(`v:${X}:${row}`)) x = Math.max(nx, X + R + 1e-3); else x = nx; }
    }
    if (dz) {
      const nz = z + dz, col = Math.floor(x);
      if (dz > 0) { const Z = Math.ceil(z + R - 1e-6); if (nz + R >= Z && bloc(`h:${Z}:${col}`)) z = Math.min(nz, Z - R - 1e-3); else z = nz; }
      else { const Z = Math.floor(z - R + 1e-6); if (nz - R <= Z && bloc(`h:${Z}:${col}`)) z = Math.max(nz, Z + R + 1e-3); else z = nz; }
    }
    d.ex = clamp(x, R, HW - R) - HW / 2; d.ez = clamp(z, R, HD - R) - HD / 2;
  }

  // ---------- toque: escolher, arrastar, girar, zoom, mover ----------
  ligarTeclado() {
    this.tasti = new Set();
    addEventListener('keydown', e => { if (!this.aperto || /input|textarea|select/i.test(e.target.tagName)) return; const k = e.key.toLowerCase(); if (['w', 'a', 's', 'd', 'q', 'e', '+', '=', '-', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) { this.tasti.add(k); e.preventDefault(); } if (k === 'escape' && this.sel) this.seleziona(null); });
    addEventListener('keyup', e => this.tasti?.delete(e.key.toLowerCase()));
    addEventListener('blur', () => this.tasti?.clear());
  }
  ligarPonteiro() {
    const cv = this.cv, dedos = new Map();
    let arr = null, pinca = null;
    const ndc = (x, y) => ({ x: x / innerWidth * 2 - 1, y: -y / innerHeight * 2 + 1 });
    const visiveis = () => [...this.ogg.filter(o => o.m.visible).map(o => o.m), ...this.muriPick.filter(m => m.parent.visible)];
    const pick = (x, y) => {
      this.ray.setFromCamera(ndc(x, y), this.cam);
      const h = this.ray.intersectObjects(visiveis(), true)[0];
      return h?.object.userData.o ?? null;   // parede na frente: nada
    };
    const chao = (x, y) => { this.ray.setFromCamera(ndc(x, y), this.cam); const p = new THREE.Vector3(); return this.ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), p) ? p : null; };
    const parete = (x, y) => {   // parede tocada → [célula x, célula z, lado r]
      this.ray.setFromCamera(ndc(x, y), this.cam);
      const h = this.ray.intersectObjects(this.muriPick.filter(m => m.parent.visible), false)[0]; if (!h) return null;
      const { or, L, sgn } = h.object.userData.muro, gx = h.point.x + HW / 2, gz = h.point.z + HD / 2;
      return or === 'h' ? [Math.floor(gx), sgn > 0 ? L : L - 1, sgn > 0 ? 0 : 2] : [sgn > 0 ? L : L - 1, Math.floor(gz), sgn > 0 ? 1 : 3];
    };
    cv.addEventListener('contextmenu', e => e.preventDefault());
    cv.addEventListener('pointerdown', e => {
      cv.setPointerCapture(e.pointerId); dedos.set(e.pointerId, { x: e.clientX, y: e.clientY });
      this.vel = 0;
      if (dedos.size === 2) { const [a, b] = [...dedos.values()]; pinca = { d0: Math.hypot(a.x - b.x, a.y - b.y), r0: this.des.dist, f0: this.des.fov, cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2 }; arr = null; this._giro = false; return; }
      const o = this.edita ? pick(e.clientX, e.clientY) : null;
      arr = { x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY, t: performance.now(), mov: false, o, giro: !o && e.button !== 2, pan: !o && e.button === 2 };
      this._giro = arr.giro;
      if (o) {
        this.memo();
        this.seleziona(o);
        if (!this.muro(o.t)) { const [w, d] = this.peg(o); const p = chao(e.clientX, e.clientY); arr.off = p ? [p.x - (o.x - HW / 2 + w / 2), p.z - (o.z - HD / 2 + d / 2)] : [0, 0]; }
      }
    });
    cv.addEventListener('pointermove', e => {
      if (!dedos.has(e.pointerId)) return;
      const prev = dedos.get(e.pointerId);
      dedos.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const d = this.des;
      if (pinca && dedos.size >= 2) {
        const [a, b] = [...dedos.values()], dist = Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)), cx = (a.x + b.x) / 2, cy = (a.y + b.y) / 2;
        if (this.vista === 'alto') {
          d.dist = clamp(pinca.r0 * pinca.d0 / dist, 3, 70);
          this.panora(cx - pinca.cx, cy - pinca.cy);   // dois dedos arrastando juntos = mover
        } else d.fov = clamp(pinca.f0 * pinca.d0 / dist, 35, 85);
        pinca.cx = cx; pinca.cy = cy;
        return;
      }
      if (!arr) return;
      if (Math.hypot(e.clientX - arr.x0, e.clientY - arr.y0) > 6) arr.mov = true;
      const dx = e.clientX - arr.x, dy = e.clientY - arr.y; arr.x = e.clientX; arr.y = e.clientY; arr.ult = performance.now();
      if (arr.pan) { if (this.vista === 'alto') this.panora(dx, dy); return; }
      if (arr.giro) {
        if (this.vista === 'alto') { const v = -dx * 0.0065; d.yaw += v; this.vel = v; d.pitch = clamp(d.pitch + dy * 0.005, 0.18, 1.45); }
        else { const v = dx * 0.005; d.lyaw += v; this.vel = v; d.lpitch = clamp(d.lpitch + dy * 0.004, -1.1, 1.1); }
        return;
      }
      if (!arr.mov) return;
      const o = arr.o;
      if (this.muro(o.t)) { const p = parete(e.clientX, e.clientY); if (p && (p[0] !== o.x || p[1] !== o.z || p[2] !== o.r) && this.cabe(o, ...p)) { [o.x, o.z, o.r] = p; this.posiziona(o); this.modificato(); } return; }
      const p = chao(e.clientX, e.clientY); if (!p) return;
      const [w, dd] = this.peg(o);
      const x = Math.round(p.x - arr.off[0] + HW / 2 - w / 2), z = Math.round(p.z - arr.off[1] + HD / 2 - dd / 2);
      if ((x !== o.x || z !== o.z) && this.cabe(o, x, z, o.r)) { o.x = x; o.z = z; this.posiziona(o); this.modificato(); }
      void prev;
    });
    const fim = e => {
      if (!dedos.has(e.pointerId)) return;
      dedos.delete(e.pointerId);
      if (arr && !arr.mov && arr.giro) {
        if (this.edita && this.sel) this.seleziona(null);
        else if (this.vista === 'dentro') { const p = chao(e.clientX, e.clientY); if (p && Math.abs(p.x) < HW / 2 && Math.abs(p.z) < HD / 2) this.passo = { x: p.x, z: p.z }; }
      }
      if (arr && (!arr.mov || performance.now() - (arr.ult ?? 0) > 120)) this.vel = 0;   // soltou parado: sem inércia
      arr = null; this._giro = false; if (dedos.size < 2) pinca = null;
    };
    cv.addEventListener('pointerup', fim); cv.addEventListener('pointercancel', fim);
    cv.addEventListener('wheel', e => { e.preventDefault(); if (this.vista === 'alto') this.des.dist = clamp(this.des.dist * Math.exp(e.deltaY * 0.001), 3, 70); else this.des.fov = clamp(this.des.fov * Math.exp(e.deltaY * 0.0008), 35, 85); }, { passive: false });
  }
  // move o alvo da câmera no plano do chão, na direção do arraste
  panora(dx, dy) {
    const d = this.des, s = d.dist * 0.0016, cy = Math.cos(d.yaw), sy = Math.sin(d.yaw);
    d.tx = clamp(d.tx - (dx * cy - dy * sy) * s, -HW / 2 - 6, HW / 2 + 6);   // dá para passear pelo jardim
    d.tz = clamp(d.tz - (-dx * sy - dy * cy) * s, -HD / 2 - 6, HD / 2 + 9);
  }
  seleziona(o) {
    this.sel = o;
    const el = this.el.querySelector('.in-sel');
    el.hidden = !o;
    this.el.classList.toggle('con-sel', !!o);
    if (o) {
      const m = (this.cfg.mobili ?? []).find(x => x.id === o.t);
      el.querySelector('.in-sel-nome').textContent = m ? `${m.icona} ${m.nome}` : '';
      el.querySelector('[data-in="colore"]').hidden = !VAR[o.t];
    }
  }
  // desfazer / refazer: fotos do estado (móveis + pisos/paredes) antes de cada mudança
  stato() { return JSON.stringify({ ogg: this.pacote().ogg, stanze: this.dati.stanze }); }
  memo() {
    if (!this.edita) return;
    const s = this.stato();
    if (this.storia.at(-1) !== s) { this.storia.push(s); if (this.storia.length > 40) this.storia.shift(); }
    this.futuro = []; this.aggiornaCtrl();
  }
  annulla(dir) {
    const da = dir < 0 ? this.storia : this.futuro, para = dir < 0 ? this.futuro : this.storia;
    let s = da.pop();
    const atual = this.stato();
    while (s === atual && da.length) s = da.pop();   // foto igual à tela (toque sem mudar nada): pula
    if (!s || s === atual) { this.aggiornaCtrl(); return; }
    para.push(atual);
    const st = JSON.parse(s);
    this.dati.ogg = st.ogg; this.dati.stanze = st.stanze;
    this.seleziona(null); this.montarCena(); this.modificato(); this.desenharBarra(); this.aggiornaCtrl();
  }
  azioneSel(a) {
    const o = this.sel; if (!o) return;
    if (a === 'ok') return this.seleziona(null);
    this.memo();
    if (a === 'togli') { this.cena.remove(o.m); this.ogg = this.ogg.filter(p => p !== o); this.seleziona(null); this.modificato(); return; }
    if (a === 'colore') {   // próxima cor da variante: troca o modelo no mesmo lugar
      o.c = (o.c + 1) % VAR[o.t].length;
      this.cena.remove(o.m); o.m = modello(o.t, o.c); o.m.traverse(k => { k.userData.o = o; }); this.cena.add(o.m); this.posiziona(o); this.modificato();
      return;
    }
    if (a === 'duplica') {
      if (!this.libero(o.t)) return;
      const st = stanzaDi(o.x, o.z), p = this.muro(o.t) ? (this.postoMuro(o.t, st) ?? this.postoMuro(o.t)) : (this.postoLibero(o.t, st) ?? this.postoLibero(o.t));
      if (!p) return this.ui.aviso('Non c’è più posto per un altro uguale.');
      const novo = this.nuovo(o.t, ...p, o.c); this.ogg.push(novo); this.seleziona(novo); this.modificato();
      return;
    }
    if (a === 'ruota') {
      if (this.muro(o.t)) {   // decoração de parede: passa para outra parede da mesma célula, ou a parede livre mais perto
        for (let k = 1; k <= 3; k++) { const r = (o.r + k) % 4; if (this.cabe(o, o.x, o.z, r)) { o.r = r; this.posiziona(o); this.modificato(); return; } }
        return this.ui.aviso('Trascinalo su un’altra parete: qui c’è una sola parete libera.');
      }
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
  pacote() {
    const s = this.dati.stanze;
    return { v: 2, pav: s.soggiorno.pav, par: s.soggiorno.par, stanze: s, ogg: this.ogg.map(o => o.c ? [o.t, o.x, o.z, o.r, o.c] : [o.t, o.x, o.z, o.r]) };
  }
  // fechando a aba/o site com mudança pendente: envia na hora (sendBeacon sobrevive ao fechamento)
  salvaSubito() {
    if (!this.edita || !this.sujo) return;
    clearTimeout(this._auto);
    const corpo = new Blob([JSON.stringify({ a: 'salva', interno: this.pacote() })], { type: 'application/json' });
    if (navigator.sendBeacon?.('api/interni.php', corpo)) { this.sujo = false; this.elenco.add(this.conta); }
    else this.salva(true);
  }

  // ---------- barra de baixo: móveis e cores ----------
  desenharBarra() {
    const b = this.el.querySelector('.in-barra'), cfg = this.cfg;
    b.classList.toggle('visita', !this.edita);
    if (!this.edita) {
      const tem = this.possiede('interni');
      b.innerHTML = `<div class="in-visita">👀 Stai visitando la casa di <b>@${esc(this.conta)}</b>${tem ? '' : `<button type="button" data-in="miacasa">🔑 Arreda la tua · ${n(cfg.interni?.prezzo ?? 990)} 💰</button>`}</div>`;
      return;
    }
    const tab = this.tab ?? 'mobili', dove = this.stanza ? STANZA[this.stanza] : null;
    const usate = new Set((cfg.mobili ?? []).filter(m => PEG[m.id]).flatMap(m => [m.cat, m.nuovo ? 'nuovi' : null]));
    const cats = CATS.filter(([id]) => id === 'tutti' || usate.has(id));
    if (!cats.some(([id]) => id === this.cat)) this.cat = 'tutti';
    const chips = cats.map(([id, ic, nome]) => `<button type="button" data-cat="${id}" class="${this.cat === id ? 'on' : ''}">${ic} ${nome}</button>`).join('');
    const mob = `<div class="in-cerca-riga"><input class="in-cerca" type="search" placeholder="🔎 Cerca tra ${(cfg.mobili ?? []).length} oggetti…" value="${esc(this.cerca ?? '')}" autocomplete="off"></div><div class="in-cats">${chips}</div><div class="in-griglia"></div>`;
    const sid = this.stanza ?? 'soggiorno', cur = this.dati.stanze[sid];
    const pav = (cfg.interni?.pavimenti ?? []).map(([id, nome, c]) => `<button type="button" class="in-sw${cur.pav === id ? ' on' : ''}" data-pav="${id}" style="background:${c}" title="${esc(nome)}"></button>`).join('');
    const par = (cfg.interni?.pareti ?? DEF_PAR).map((c, i) => `<button type="button" class="in-sw${cur.par === i ? ' on' : ''}" data-par="${i}" style="background:${c}"></button>`).join('');
    const pac = (cfg.pacchetti ?? []).map(x => {
      const tutti = x.mobili.every(m => this.libero(m)), pieno = (cfg.mobili ?? []).filter(m => x.mobili.includes(m.id)).reduce((s, m) => s + m.prezzo, 0);
      const ic = x.mobili.map(id => (cfg.mobili ?? []).find(m => m.id === id)?.icona ?? '').join('');
      return `<button type="button" class="in-mob in-pac${tutti ? '' : ' lock'}" data-pac="${x.id}"${tutti ? ' disabled' : ''}><span>${x.icona}</span><b>${esc(x.nome.replace('Pacchetto ', ''))}</b><i>${ic}</i><em>${tutti ? '✅ Tuo' : `<s>${n(pieno)}</s> ${n(x.prezzo)} 💰`}</em></button>`;
    }).join('');
    const doveTx = `<small class="in-dove">${dove ? `${dove.ic} Va in: <b>${dove.nome}</b>` : '🏠 Scegli una stanza in alto, o va nel primo posto libero'}</small>`;
    const colTx = this.stanza ? `${STANZA[sid].ic} ${STANZA[sid].nome}` : '🏠 Tutte le stanze';
    b.classList.toggle('ridotta', !!this.ridotta);
    b.innerHTML = `<div class="in-tabs"><button type="button" data-tab="mobili" class="${tab === 'mobili' ? 'on' : ''}">🛋️ Arredi</button><button type="button" data-tab="pacchetti" class="${tab === 'pacchetti' ? 'on' : ''}">📦 Pacchetti</button><button type="button" data-tab="colori" class="${tab === 'colori' ? 'on' : ''}">🎨 Pavimenti e pareti</button><span class="in-saldo">💰 ${n(this.ui.conto?.p?.saldo ?? 0)}</span><button type="button" class="in-riduci" data-in="riduci" title="${this.ridotta ? 'Apri il catalogo' : 'Riduci'}">${this.ridotta ? '▴' : '▾'}</button></div>
      <div class="in-corpo">${tab === 'mobili' ? `${doveTx}${mob}` : tab === 'pacchetti' ? `<div class="in-lista">${pac}</div>` : `<div class="in-col"><small>Pavimento · ${colTx}</small><div>${pav}</div><small>Pareti · ${colTx}</small><div>${par}</div></div>`}</div>`;
    if (tab === 'mobili') this.desenharGriglia();
  }
  // grade do catálogo: categoria + busca; miniaturas 3D desenhadas aos poucos (sem travar a tela)
  desenharGriglia() {
    const g = this.el.querySelector('.in-griglia'); if (!g) return;
    const q = String(this.cerca ?? '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    const lista = (this.cfg.mobili ?? []).filter(m => PEG[m.id] && (q ? m.nome.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').includes(q) : this.cat === 'tutti' || (this.cat === 'nuovi' ? m.nuovo : m.cat === this.cat)));
    g.innerHTML = lista.map(m => {
      const ok = this.libero(m.id), parete = PEG[m.id]?.[2] === 'muro', varianti = VAR[m.id]?.length;
      const prezzo = ok ? (m.prezzo === 0 ? 'Gratis' : '✅ Tuo') : `🔒 ${n(m.prezzo)} 💰`;
      return `<button type="button" class="in-art${ok ? '' : ' lock'}" data-mob="${m.id}"><img alt="" data-mini="${m.id}" src="${_mini.get(`${m.id}|0`) ?? ''}"><b>${esc(m.nome)}</b><em>${prezzo}</em>${m.nuovo ? '<i class="in-nuovo">NUOVO</i>' : ''}${parete || varianti ? `<small>${parete ? '🧱' : ''}${varianti ? ` 🎨${varianti}` : ''}</small>` : ''}</button>`;
    }).join('') || '<p class="in-vuoto">Nessun oggetto trovato.</p>';
    cancelAnimationFrame(this._miniRaf);
    const vazias = [...g.querySelectorAll('img[data-mini]:not([src^="data"])')];
    const passo = () => { const t0 = performance.now(); while (vazias.length && performance.now() - t0 < 12) { const im = vazias.shift(); im.src = miniatura(im.dataset.mini); } if (vazias.length) this._miniRaf = requestAnimationFrame(passo); };
    this._miniRaf = requestAnimationFrame(passo);
  }
  async cliqueBarra(e) {
    const t = e.target.closest('button'); if (!t) return;
    const d = t.dataset;
    if (d.tab) { this.tab = d.tab; this.desenharBarra(); return; }
    if (d.in === 'miacasa') { const mia = this.ui.conto?.p?.conta; this.chiudi(true); if (mia) this.ui.casa(this.D.porConta.get(mia)); else this.ui.conto?.apri(); return; }
    if (d.pac) return this.compraPacchetto(d.pac);
    if (d.cat) { this.cat = d.cat; this.cerca = ''; this.desenharBarra(); return; }
    if (d.in === 'riduci') { this.ridotta = !this.ridotta; this.desenharBarra(); return; }
    const quali = this.stanza ? [this.stanza] : STANZE.map(s => s.id);   // "Tutta": a cor vale para todos os cômodos
    if (d.pav) { this.memo(); for (const id of quali) this.dati.stanze[id].pav = d.pav; this.ricostruisci(); return; }
    if (d.par) { this.memo(); for (const id of quali) this.dati.stanze[id].par = +d.par; this.ricostruisci(); return; }
    if (d.mob) {
      const m = (this.cfg.mobili ?? []).find(x => x.id === d.mob);
      if (!PEG[m.id]) return this.ui.aviso('Aggiorna la pagina per usare questo mobile.');
      if (!this.libero(m.id)) return this.compraMobile(m);
      const p = PEG[m.id]?.[2] === 'muro' ? (this.postoMuro(m.id, this.stanza) ?? this.postoMuro(m.id)) : (this.postoLibero(m.id, this.stanza) ?? this.postoLibero(m.id));
      if (!p) return this.ui.aviso(this.stanza ? `${STANZA[this.stanza].nome}: non c’è più posto. Togli qualcosa o scegli un’altra stanza.` : 'La casa è piena: togli qualcosa prima.');
      this.memo();
      const novo = this.nuovo(m.id, ...p); this.ogg.push(novo); this.seleziona(novo); this.modificato();
      const st = STANZA[stanzaDi(p[0], p[1])];
      if (!this.stanza && st) this.ui.aviso(`${m.icona} ${m.nome} → ${st.ic} ${st.nome}`);
    }
  }
  async compraMobile(m) {
    if (await this.ui.conto.compra(`mob_${m.id}`, m.nome, m.prezzo)) this.desenharBarra();
  }
  async compraPacchetto(id) {
    const x = (this.cfg.pacchetti ?? []).find(p => p.id === id);
    if (x && await this.ui.conto.compra(`pac_${id}`, x.nome, x.prezzo, `${x.mobili.length} mobili per la tua casa.`)) this.desenharBarra();
  }
  ricostruisci() {
    this.dati.ogg = this.pacote().ogg;
    const sel = this.sel ? this.ogg.indexOf(this.sel) : -1;
    this.montarCena();
    if (sel >= 0) this.seleziona(this.ogg[sel] ?? null);
    this.modificato(); this.desenharBarra();
  }
  async salva(auto = false) {
    clearTimeout(this._auto);
    if (this._salvando) { this._dinovo = true; return; }   // já tem um salvamento a caminho: salva de novo no fim
    this._salvando = true;
    const v = this._ver, bt = this.el.querySelector('.in-salva'), prima = !this.elenco.has(this.conta);
    bt.textContent = '⏳ Salvo…';
    try {
      const r = await fetch('api/interni.php', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ a: 'salva', interno: this.pacote() }) });
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
