// Imagens 1080x1920 prontas para a story: a casa, o atto di fondazione e a cidade.
import { REGOLE, NOMI_CARICHE, num } from './regole.js';
import { LOTE } from './citta.js';
import { ALTURA_NIVEL } from './modelli.js';

export const PERFIL = 'italiacasapercasa';
const W = 1080, H = 1920, INK = '#152033', GIALLO = '#FFC93C', ROSSO = '#E0473C', VERDE = '#2E9B55', GRIGIO = '#5B6475';
const FUSO = { timeZone: 'Europe/Rome' };

let logoP = null;
const logo = () => (logoP ??= new Promise((ok, erro) => { const i = new Image(); i.onload = () => ok(i); i.onerror = erro; i.src = 'img/logo.png'; }));
const fontes = () => Promise.all(['900 80px Nunito', '800 40px Nunito', '700 30px Nunito'].map(f => document.fonts.load(f)));

function tela(fundo) {
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d');
  if (fundo === 'pergamena') {
    g.fillStyle = '#F5E6C0'; g.fillRect(0, 0, W, H);
    const v = g.createRadialGradient(W / 2, H / 2, H * 0.25, W / 2, H / 2, H * 0.75);
    v.addColorStop(0, 'rgba(255,255,255,0)'); v.addColorStop(1, 'rgba(140,90,40,0.35)');
    g.fillStyle = v; g.fillRect(0, 0, W, H);
  } else {
    const gr = g.createLinearGradient(0, 0, 0, H);
    gr.addColorStop(0, '#BFE3F5'); gr.addColorStop(0.55, '#E3F3FA'); gr.addColorStop(1, '#FFF6E6');
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
  }
  return [c, g];
}
function caminho(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r);
  g.closePath();
}
function contorno(g, txt, x, y, size, cor = '#fff', align = 'center') {
  g.font = `900 ${size}px Nunito`; g.textAlign = align; g.textBaseline = 'alphabetic'; g.lineJoin = 'round';
  g.lineWidth = size * 0.17; g.strokeStyle = INK; g.strokeText(txt, x, y);
  g.fillStyle = cor; g.fillText(txt, x, y);
}
function ajustar(g, txt, max, size, peso = 900) {
  g.font = `${peso} ${size}px Nunito`;
  while (g.measureText(txt).width > max && size > 24) { size -= 2; g.font = `${peso} ${size}px Nunito`; }
  return size;
}
// linha com partes de cores diferentes (ex.: "A " branco + "ROMA" amarelo), centralizada
function linhaMista(g, partes, cx, y, size, max = 980) {
  size = ajustar(g, partes.map(p => p[0]).join(''), max, size);
  g.font = `900 ${size}px Nunito`;
  let x = cx - partes.reduce((s, [t]) => s + g.measureText(t).width, 0) / 2;
  for (const [t, cor] of partes) { contorno(g, t, x, y, size, cor, 'left'); g.font = `900 ${size}px Nunito`; x += g.measureText(t).width; }
}
function texto(g, txt, x, y, size, cor = INK, peso = 800, align = 'center') {
  g.font = `${peso} ${size}px Nunito`; g.fillStyle = cor; g.textAlign = align; g.textBaseline = 'alphabetic'; g.fillText(txt, x, y);
}
function chip(g, txt, cx, yBase, { size = 36, fundo = '#fff', cor = INK } = {}) {
  g.font = `800 ${size}px Nunito`;
  const w = g.measureText(txt).width + 46, h = size + 26;
  caminho(g, cx - w / 2, yBase - h, w, h, h / 2);
  g.fillStyle = fundo; g.fill(); g.lineWidth = 6; g.strokeStyle = INK; g.stroke();
  g.fillStyle = cor; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(txt, cx, yBase - h / 2 + 2);
  g.textBaseline = 'alphabetic';
}
function moldura(g, src, x, y, w, h, r = 44, cor = INK) {
  g.save(); caminho(g, x, y, w, h, r); g.clip(); g.drawImage(src, x, y, w, h); g.restore();
  caminho(g, x, y, w, h, r); g.lineWidth = 10; g.strokeStyle = cor; g.stroke();
}
function cartao(g, x, y, w, h) {
  caminho(g, x, y, w, h, 40); g.fillStyle = '#fff'; g.fill(); g.lineWidth = 8; g.strokeStyle = INK; g.stroke();
}
function bandierine(g, y = 0) {
  const cores = ['#2E9B55', '#FFFFFF', '#E0473C', '#FFC93C', '#4FB6FF'], w = 72;
  for (let i = 0; i * w < W; i++) {
    const x = i * w;
    g.beginPath(); g.moveTo(x + 4, y); g.lineTo(x + w - 4, y); g.lineTo(x + w - 4, y + 46); g.lineTo(x + w / 2, y + 30); g.lineTo(x + 4, y + 46); g.closePath();
    g.fillStyle = cores[i % cores.length]; g.fill(); g.lineWidth = 3; g.strokeStyle = INK; g.stroke();
  }
}
function cabecalho(g, img, y) {
  const s = 100, size = 56;
  g.font = `900 ${size}px Nunito`;
  const tw = g.measureText('Italia Casa per Casa').width, x0 = (W - (s + 22 + tw)) / 2;
  g.save(); g.beginPath(); g.arc(x0 + s / 2, y - size * 0.36, s / 2, 0, Math.PI * 2); g.clip(); g.drawImage(img, x0, y - size * 0.36 - s / 2, s, s); g.restore();
  g.beginPath(); g.arc(x0 + s / 2, y - size * 0.36, s / 2, 0, Math.PI * 2); g.lineWidth = 6; g.strokeStyle = INK; g.stroke();
  contorno(g, 'Italia ', x0 + s + 22, y, size, '#fff', 'left');
  g.font = `900 ${size}px Nunito`;
  contorno(g, 'Casa per Casa', x0 + s + 22 + g.measureText('Italia ').width, y, size, GIALLO, 'left');
}
function quebrar(g, txt, max) {
  const linhas = [];
  let atual = '';
  for (const p of txt.split(' ')) {
    const t = atual ? `${atual} ${p}` : p;
    if (g.measureText(t).width > max && atual) { linhas.push(atual); atual = p; } else atual = t;
  }
  if (atual) linhas.push(atual);
  return linhas;
}
const cargo = (D, c) => {
  const k = c.carica;
  if (!k) return null;
  if (k.tipo === 'presidente') return NOMI_CARICHE.presidente;
  if (k.regione) return `${NOMI_CARICHE[k.tipo]} · ${D.regPorCod.get(k.regione).nome}`;
  return `${NOMI_CARICHE[k.tipo]} di ${D.comunePorIstat.get(k.comune).nome}`;
};

// ---------- a minha casa ----------
export async function immagineCasa(fot, citta, D, casa) {
  const [img] = await Promise.all([logo(), fontes()]);
  const [c, g] = tela();
  const l = D.luoghi[casa.luogo], p = citta.posCasa(casa), alt = ALTURA_NIVEL[casa.livello] * LOTE;
  const fogo = casa.fiamme > Date.now() / 1000;
  bandierine(g);
  cabecalho(g, img, 160);
  linhaMista(g, [['LA MIA CASA', '#fff']], W / 2, 300, 100);
  linhaMista(g, [['A ', '#fff'], [l.nome.toUpperCase(), GIALLO]], W / 2, 410, 100);

  const f = fot.foto({ x: p.x, z: p.z, y: p.y + alt * 0.4, dist: 0.3 + alt * 2.6, az: 0.62, el: 0.5 });
  moldura(g, f.canvas, 60, 450, 960, 960);
  const q = fot.projetar(f, p.x, p.y + alt + LOTE * 0.3, p.z);
  chip(g, `${fogo ? '🔥 ' : '🏠 '}@${casa.conta}`, 60 + q.x, 450 + Math.max(90, q.y - 24), { fundo: VERDE, cor: '#fff', size: 40 });
  if (fogo) chip(g, '🔥 IN FIAMME', 870, 530, { fundo: '#FFE2C7', size: 32 });

  const niv = REGOLE.livelli[casa.livello], k = cargo(D, casa);
  cartao(g, 60, 1450, 960, 270);
  texto(g, `@${casa.conta}`, W / 2, 1535, ajustar(g, `@${casa.conta}`, 880, 66, 900), INK, 900);
  texto(g, `${niv.nome} · livello ${casa.livello + 1} di ${REGOLE.livelli.length}`, W / 2, 1600, 40, GRIGIO, 800);
  if (k) chip(g, `🏛 ${k}`, W / 2, 1690, { fundo: casa.carica.tipo === 'presidente' ? ROSSO : GIALLO, cor: casa.carica.tipo === 'presidente' ? '#fff' : INK, size: 34 });
  else texto(g, `${num(casa.tot)} punti · n. ${num(casa.pos)} della settimana`, W / 2, 1675, 38, INK, 800);

  texto(g, 'Commenta la tua città e regione:', W / 2, 1795, 40, INK, 800);
  texto(g, 'avrai una casa con il tuo @', W / 2, 1845, 40, INK, 800);
  contorno(g, `@${PERFIL}`, W / 2, 1900, 44, ROSSO);
  return c;
}

// ---------- atto di fondazione ----------
export async function immagineFondazione(fot, citta, D, l) {
  const [img] = await Promise.all([logo(), fontes()]);
  const [c, g] = tela('pergamena');
  const MARROM = '#8A5A2B';
  g.lineWidth = 6; g.strokeStyle = MARROM; g.strokeRect(36, 36, W - 72, H - 72);
  g.lineWidth = 3; g.strokeRect(54, 54, W - 108, H - 108);
  cabecalho(g, img, 170);
  texto(g, 'ATTO DI', W / 2, 300, 74, MARROM, 900);
  contorno(g, 'FONDAZIONE', W / 2, 410, ajustar(g, 'FONDAZIONE', 940, 124), ROSSO);
  texto(g, 'della città di', W / 2, 480, 42, MARROM, 800);
  contorno(g, l.nome.toUpperCase(), W / 2, 580, ajustar(g, l.nome.toUpperCase(), 920, 104), GIALLO);

  const dist = Math.min(5, 0.9 + Math.sqrt(l.case) * 0.075) * 0.85, hc = citta.dadosCidade(l).hc;
  const f = fot.foto({ x: l.x, z: l.z, y: hc, dist, az: 0.55, el: 0.72, w: 900, h: 760 });
  moldura(g, f.canvas, 90, 630, 900, 760, 28, MARROM);

  const quando = new Date(l.fondatore_ts).toLocaleDateString('it-IT', { ...FUSO, day: 'numeric', month: 'long', year: 'numeric' });
  g.font = '800 40px Nunito';
  const linhas = quebrar(g, `Il ${quando}, @${l.fondatore} ha costruito la prima casa di ${l.nome} e ha fondato la città. Oggi ${l.nome} ha ${num(l.case)} ${l.case === 1 ? 'casa' : 'case'}.`, 880);
  linhas.forEach((t, i) => texto(g, t, W / 2, 1470 + i * 54, 40, INK, 800));

  // firma e sigillo
  const yF = 1690;
  texto(g, `@${l.fondatore}`, 120, yF, ajustar(g, `@${l.fondatore}`, 520, 50, 900), INK, 900, 'left');
  g.beginPath(); g.moveTo(120, yF + 20); g.lineTo(640, yF + 20); g.lineWidth = 4; g.strokeStyle = MARROM; g.stroke();
  texto(g, 'Fondatore/Fondatrice · per sempre', 120, yF + 62, 30, MARROM, 800, 'left');
  g.beginPath(); g.arc(870, yF + 22, 96, 0, Math.PI * 2); g.fillStyle = '#C8352B'; g.fill(); g.lineWidth = 8; g.strokeStyle = '#8E2018'; g.stroke();
  g.beginPath(); g.arc(870, yF + 22, 74, 0, Math.PI * 2); g.lineWidth = 3; g.strokeStyle = '#F5C9A0'; g.stroke();
  texto(g, '★', 870, yF + 50, 84, '#FFD9A8', 900);
  texto(g, 'SIGILLO', 870, yF + 84, 20, '#FFD9A8', 900);
  texto(g, `@${PERFIL}`, W / 2, 1832, 34, MARROM, 900);
  return c;
}

// ---------- a cidade ----------
export async function immagineCitta(fot, citta, D, l) {
  const [img] = await Promise.all([logo(), fontes()]);
  const [c, g] = tela();
  bandierine(g);
  cabecalho(g, img, 160);
  contorno(g, l.nome.toUpperCase(), W / 2, 310, ajustar(g, l.nome.toUpperCase(), 960, 120), GIALLO);
  linhaMista(g, [[`${num(l.case)} `, '#fff'], [l.case === 1 ? 'CASA' : 'CASE', '#fff']], W / 2, 410, 90);

  const dist = Math.min(5, 0.9 + Math.sqrt(l.case) * 0.075), hc = citta.dadosCidade(l).hc;
  const f = fot.foto({ x: l.x, z: l.z, y: hc, dist, az: 0.55, el: 0.68, w: 960, h: 960 });
  moldura(g, f.canvas, 60, 450, 960, 960);

  const k = D.snap.cariche, sindaco = k.sindaci[l.comune.istat];
  cartao(g, 60, 1450, 960, 250);
  texto(g, `★ Fondatore/Fondatrice: @${l.fondatore}`, W / 2, 1530, ajustar(g, `★ Fondatore/Fondatrice: @${l.fondatore}`, 880, 40), INK, 800);
  texto(g, sindaco ? `🏛 Sindaco/a: @${sindaco.conta}` : '🏛 Sindaco/a: si elegge domenica alle 21', W / 2, 1595, 38, INK, 800);
  texto(g, `${l.regione.nome} · ${num(l.comune.pop)} abitanti`, W / 2, 1660, 34, GRIGIO, 800);

  texto(g, `Sei di ${l.nome}? Commenta città e regione:`, W / 2, 1795, ajustar(g, `Sei di ${l.nome}? Commenta città e regione:`, 960, 40), INK, 800);
  texto(g, 'avrai la tua casa sulla mappa', W / 2, 1845, 40, INK, 800);
  contorno(g, `@${PERFIL}`, W / 2, 1900, 44, ROSSO);
  return c;
}
