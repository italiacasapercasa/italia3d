// Texturas com texto (placas dos lotes livres, outdoors, letreiros dos comércios), desenhadas num canvas.
import * as THREE from 'three';

const FONTE = "'Nunito', system-ui, sans-serif";
const INK = '#152033';

function textura(w, h, desenhar) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  desenhar(g, w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

// escreve uma linha diminuindo a fonte até caber na largura
function linha(g, txt, x, y, maxW, px, peso = 900) {
  let s = px;
  do { g.font = `${peso} ${s}px ${FONTE}`; s -= 2; } while (g.measureText(txt).width > maxW && s > 10);
  g.fillText(txt, x, y);
}
function moldura(g, w, h, fundo, borda = INK, r = 18) {
  g.fillStyle = borda; g.beginPath(); g.roundRect(0, 0, w, h, r); g.fill();
  g.fillStyle = fundo; g.beginPath(); g.roundRect(10, 10, w - 20, h - 20, r - 6); g.fill();
}
const contraste = cor => { const c = new THREE.Color(cor); return (0.299 * c.r + 0.587 * c.g + 0.114 * c.b) > 0.6 ? INK : '#FFFFFF'; };

// a fonte do site precisa estar carregada antes de desenhar
export const fontePronta = (document.fonts?.load(`900 40px Nunito`) ?? Promise.resolve()).catch(() => {});

export const texturaVendita = () => textura(512, 290, (g, w, h) => {
  moldura(g, w, h, '#E0473C');
  g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle';
  linha(g, 'IN VENDITA', w / 2, h * 0.4, w - 60, 92);
  linha(g, 'tagga un amico', w / 2, h * 0.74, w - 80, 46, 800);
});

export const texturaLavori = () => textura(512, 290, (g, w, h) => {
  moldura(g, w, h, '#FFC93C');
  g.save(); g.beginPath(); g.rect(10, h - 64, w - 20, 54); g.clip();
  for (let x = -60; x < w + 60; x += 56) { g.fillStyle = INK; g.beginPath(); g.moveTo(x, h); g.lineTo(x + 28, h); g.lineTo(x + 70, h - 64); g.lineTo(x + 42, h - 64); g.fill(); }
  g.restore();
  g.fillStyle = INK; g.textAlign = 'center'; g.textBaseline = 'middle';
  linha(g, 'LAVORI', w / 2, h * 0.27, w - 60, 84);
  linha(g, 'IN CORSO', w / 2, h * 0.56, w - 60, 72);
});

export const texturaPubblicita = () => textura(1024, 492, (g, w, h) => {
  moldura(g, w, h, '#FFFFFF', INK, 26);
  g.fillStyle = '#FFC93C'; g.fillRect(10, 10, w - 20, 96);
  g.fillStyle = INK; g.textAlign = 'center'; g.textBaseline = 'middle';
  linha(g, 'SPAZIO DISPONIBILE', w / 2, 60, w - 120, 58);
  linha(g, 'LA TUA', w / 2, h * 0.42, w - 120, 120);
  g.fillStyle = '#E0473C';
  linha(g, 'PUBBLICITÀ QUI', w / 2, h * 0.68, w - 100, 112);
  g.fillStyle = '#5B6475';
  linha(g, 'italiacasapercasa.com', w / 2, h * 0.89, w - 200, 40, 800);
});

// logo opcional: imagem já carregada (HTMLImageElement) desenhada num quadrado à esquerda
function desenharLogo(g, img, x, y, lado) {
  if (!img) return 0;
  const k = Math.min(lado / img.width, lado / img.height), iw = img.width * k, ih = img.height * k;
  g.fillStyle = '#fff'; g.beginPath(); g.roundRect(x, y, lado, lado, 14); g.fill();
  g.drawImage(img, x + (lado - iw) / 2, y + (lado - ih) / 2, iw, ih);
  return lado + 24;
}

export const texturaInsegna = (nome, cor, logo) => textura(1024, 232, (g, w, h) => {
  moldura(g, w, h, cor, INK, 16);
  const off = desenharLogo(g, logo, 26, 26, h - 52);
  g.fillStyle = contraste(cor); g.textAlign = 'center'; g.textBaseline = 'middle';
  linha(g, nome, (w + off) / 2, h / 2 + 4, w - 70 - off, 132);
});

export const texturaCartellone = (titolo, sotto, cor, logo) => textura(1024, 492, (g, w, h) => {
  moldura(g, w, h, cor, INK, 26);
  const off = desenharLogo(g, logo, 40, (h - 220) / 2, 220);
  const cx = (w + off) / 2, larg = w - 100 - off;
  g.fillStyle = contraste(cor); g.textAlign = 'center'; g.textBaseline = 'middle';
  linha(g, titolo, cx, sotto ? h * 0.4 : h / 2, larg, 130);
  if (sotto) linha(g, sotto, cx, h * 0.68, larg, 54, 800);
});

// letreiro neon: fundo escuro e o nome brilhando na cor da marca
export const texturaNeon = (nome, cor) => textura(1024, 232, (g, w, h) => {
  g.fillStyle = '#14161F'; g.beginPath(); g.roundRect(0, 0, w, h, 16); g.fill();
  const c = new THREE.Color(cor), viva = `#${c.clone().lerp(new THREE.Color('#ffffff'), 0.35).getHexString()}`;
  g.textAlign = 'center'; g.textBaseline = 'middle';
  for (const [blur, cor2] of [[38, cor], [16, cor], [0, viva]]) { g.shadowColor = cor; g.shadowBlur = blur; g.fillStyle = cor2; linha(g, nome, w / 2, h / 2 + 4, w - 80, 128); }
  g.shadowBlur = 0; g.strokeStyle = cor; g.lineWidth = 6; g.beginPath(); g.roundRect(12, 12, w - 24, h - 24, 12); g.stroke();
});

// placa "a bandiera" (perpendicular à fachada): logo ou a inicial
export const texturaBandiera = (nome, cor, logo) => textura(256, 308, (g, w, h) => {
  moldura(g, w, h, cor, INK, 14);
  if (logo) { desenharLogo(g, logo, 28, 54, w - 56); return; }
  g.fillStyle = contraste(cor); g.textAlign = 'center'; g.textBaseline = 'middle';
  linha(g, (nome.trim()[0] ?? '?').toUpperCase(), w / 2, h / 2 + 6, w - 40, 190);
});

// textura de cada face do letreiro de um comércio
export function texturaFaccia(tipo, cm, logo) {
  if (tipo === 'neon') return texturaNeon(cm.nome, cm.colore);
  if (tipo === 'bandiera') return texturaBandiera(cm.nome, cm.colore, logo);
  if (tipo === 'tetto') return texturaCartellone(cm.nome, '', cm.colore, logo);
  return texturaInsegna(cm.nome, cm.colore, logo);
}

// carrega uma imagem (logo); devolve null se falhar
export const carregarImagem = src => new Promise(ok => {
  if (!src) return ok(null);
  const i = new Image();
  i.onload = () => ok(i); i.onerror = () => ok(null);
  i.src = src;
});
