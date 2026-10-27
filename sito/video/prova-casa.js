// PROVA "casa speciale": decorar a própria casa ou dar um presente a um amigo (só estética: sem pontos, sem vantagem).
// Protótipo só para esta página de teste: o pagamento é simulado e nada vai para o servidor.
// Atalhos para testar/fotografar: ?p=mia|regalo&conta=<@>&sel=nerazzurro,neon,...&da=<@>&pagato=1
import * as THREE from 'three';
import { geometriaCasa, ALTURA_NIVEL, stileRegione } from '../js/modelli.js';
import { LOTE, posLote } from '../js/citta.js';

const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const hash = s => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return Math.abs(h); };
const variante = s => hash(s) % 3;   // mesma variante de cor que citta.js usa
const PREZZO = 1.99, PACCHETTO = 4.99, MIN_PACCHETTO = 3;
const eur = v => `€${v.toFixed(2).replace('.', ',')}`;

// cores das camisas (só as cores: nome e escudo dos clubes são marcas registradas)
const SQUADRE = [
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
// efeitos; regalo = pode ser dado de presente (só coisas positivas: cores de time ficam só para a própria casa)
const EFFETTI = [
  { id: 'oro', em: '✨', nome: 'Casa d’oro', mia: true, regalo: true },
  { id: 'neon', em: '🌈', nome: 'Neon', mia: true, regalo: true },
  { id: 'corona', em: '👑', nome: 'Corona', mia: true, regalo: true },
  { id: 'fuochi', em: '🎆', nome: 'Fuochi', mia: true, regalo: true },
  { id: 'campione', em: '🏆', nome: 'Campione', mia: true, regalo: true },
  { id: 'palloncini', em: '🎈', nome: 'Compleanno', mia: false, regalo: true },
  { id: 'tricolore', em: '🇮🇹', nome: 'Tricolore', mia: true, regalo: false },
  { id: 'cornice', em: '🖼', nome: 'Cornice @', mia: true, regalo: true },
];
const nomeEff = id => EFFETTI.find(e => e.id === id) ?? SQUADRE.find(s => s.id === id);

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
    const geo = new THREE.BufferGeometry().setFromPoints([base, b.position.clone()]);
    const filo = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: '#FFFFFF' }));
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
  const scoppi = Array.from({ length: E }, (_, e) => ({ t0: -1e9, c: new THREE.Vector3(), cor: new THREE.Color(), fase: e }));
  pts.userData.anima = t => {
    scoppi.forEach((s, e) => {
      const vita = 1500, idade = t - s.t0;
      if (idade > vita) {
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

// monta o grupo 3D da casa decorada; devolve { g, anima }
function costruisci(D, citta, casa, sel) {
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
      matOro.emissive.set(window.__italia.mappa.notte ? '#9C7608' : '#4A3600'); oroMat.emissive.set(window.__italia.mappa.notte ? '#B38A10' : '#5A4300');
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
  // pilha: topo do que flutua (o rótulo do @ fica acima); topo: altura total com os fogos (enquadramento)
  return { g, anima: t => anim.forEach(f => f(t)), pilha: y - 0.25 > h ? y - 0.1 : h };
}
// altura total com o que flutua e os fogos (para enquadrar a câmera)
const topoDi = (casa, sel) => {
  const ex = sel.extra, h = ALTURA_NIVEL[casa.livello];
  const y = h + 0.25 + (ex.has('corona') ? 0.35 : 0) + (ex.has('campione') ? 0.42 : 0);
  return ex.has('fuochi') ? y + 0.9 : Math.max(y, ex.has('palloncini') ? h * 0.75 + 0.6 : 0);
};

// ---------- página ----------
const pronto = () => new Promise(r => { const t = setInterval(() => { if (window.__italia) { clearInterval(t); r(window.__italia); } }, 100); });

pronto().then(({ D, mappa, citta, ui, et, festa }) => {
  et ??= ui.et;
  const attive = new Map();     // conta -> { casa, sel, da, g, anima } (comprado nesta prova)
  const nascoste = new Map();   // conta -> instância original escondida (para devolver)
  let ed = null;                // edição aberta: { modo, casa, sel, da }
  let giro = null;              // câmera girando em volta da casa

  const ricarica = () => { citta.ultimo = null; citta.atualizar(true); mappa.sujo = true; };
  function nascondi(casa) {
    if (nascoste.has(casa.conta)) return;
    const l = D.luoghi[casa.luogo], c = citta.dadosCidade(l), arr = c.partes[`c${casa.livello}_${variante(casa.conta)}_${stileRegione(l.regione.cod)}`];
    for (let i = 0; arr && i < arr.length; i += 16) if (Math.abs(arr[i + 12] - casa.x) < 1e-4 && Math.abs(arr[i + 14] - casa.z) < 1e-4) {
      nascoste.set(casa.conta, { arr, i, orig: arr.slice(i, i + 16) }); arr.fill(0, i, i + 16); break;
    }
    ricarica();
  }
  function mostra(conta) { const n = nascoste.get(conta); if (!n) return; n.arr.set(n.orig, n.i); nascoste.delete(conta); ricarica(); }

  const vuoto = s => !s.squadra && !s.extra.size;
  // mostra no mapa a casa com a seleção (sel vazia = casa normal)
  function disegna(casa, sel, da = null) {
    const vecchia = attive.get(casa.conta);
    if (vecchia) citta.grupo.remove(vecchia.g);
    if (vuoto(sel)) { attive.delete(casa.conta); mostra(casa.conta); }
    else {
      citta.posCasa(casa); nascondi(casa);
      const o = costruisci(D, citta, casa, sel);
      o.anima(performance.now());   // posições iniciais (a foto da story pode sair antes do próximo quadro)
      citta.grupo.add(o.g);
      attive.set(casa.conta, { casa, sel, da, ...o });
    }
    if (attive.size) mappa.animatori.add(ANIM); else mappa.animatori.delete(ANIM);
    mappa.sujo = true;
  }
  const ANIM = {};
  const comprate = new Map();   // conta -> { sel, da } (o que foi "pago" nesta prova)
  const copia = s => ({ squadra: s.squadra, extra: new Set(s.extra) });

  mappa.aoFrame.push(t => {
    for (const a of attive.values()) a.anima(t);
    if (giro && !mappa.voo) { giro.az += 0.0022; inquadra(giro.casa, giro.az); }
    etichette();
  });
  // rótulo da casa decorada: moldura dourada e/ou "🎁 da @fulano"
  function etichette() {
    for (const [conta, a] of attive) {
      const it = et.pool.get(`c:${conta}`);
      if (!it || it.div.hidden) continue;
      const fogo = a.casa.fiamme > Date.now() / 1000, base = `${fogo ? '🔥 ' : ''}@${esc(conta)}`, cornice = a.sel.extra.has('cornice');
      let cls = null, html = null;
      if (it.div.dataset.p && !it.div.querySelector('.p-m')) it._hb = undefined;   // etichette reescreveu o rótulo
      if (a.da) { cls = cornice ? 'vip' : 'regalo'; html = `${cornice ? '✨ ' : ''}${base}<small>🎁 da @${esc(a.da)}</small>`; }
      else if (cornice) { cls = 'vip'; html = `✨ ${base}<small>CASA SPECIALE</small>`; }
      if (!html && it.div.dataset.p) {   // tirou a moldura: devolve o rótulo normal
        delete it.div.dataset.p; it.div.className = `et et-casa${et.destaque === conta ? ' minha' : ''}`; it.html = ''; it._hb = undefined;
      }
      if (html) {
        html += '<i class="p-m" hidden></i>';
        if (!it.div.querySelector('.p-m') || it.div.dataset.p !== html) {
          it.div.className = `et et-casa ${cls}`; it.div.innerHTML = html; it.div.dataset.p = html;
          it.w = it.div.offsetWidth; it._hb = it.div.offsetHeight;
        }
      }
      // coroa/troféu em cima: o rótulo sobe para não tampar (etichette posiciona em y - it.h)
      it._hb ??= it.div.offsetHeight;
      const c = a.casa, h = ALTURA_NIVEL[c.livello];
      const sobe = a.pilha > h ? mappa.projetar(c.x, c.y + (h + 0.25) * LOTE, c.z).y - mappa.projetar(c.x, c.y + (a.pilha + 0.25) * LOTE, c.z).y : 0;
      it.h = it._hb + Math.max(0, sobe);
    }
  }

  // câmera: casa no alto da tela (o painel cobre a parte de baixo), girando devagar
  // distância e deslocamento: casa inteira (com coroa, fogos...) na metade de cima da tela
  function enquadra(casa) {
    const sel = attive.get(casa.conta)?.sel ?? { extra: new Set() }, topo = topoDi(casa, sel) * LOTE;
    return { d: 0.24 + topo * 3.4, k: innerWidth >= 900 ? [-0.32, 0] : [0, ALTURA_NIVEL[casa.livello] > 1.5 ? 0.05 : 0.2] };
  }
  function inquadra(casa, az) {
    const alvo = enquadra(casa);
    // muda devagar quando a seleção muda a altura (ex.: ligou os fogos)
    giro.d = giro.d ? giro.d + (alvo.d - giro.d) * 0.06 : mappa.dist;
    giro.k = giro.k ? giro.k + (alvo.k[1] - giro.k) * 0.06 : alvo.k[1];
    const d = giro.d, k = [alvo.k[0], giro.k];
    mappa.alvo.x = casa.x + Math.cos(az) * k[0] * d + Math.sin(az) * k[1] * d;
    mappa.alvo.z = casa.z - Math.sin(az) * k[0] * d + Math.cos(az) * k[1] * d;
    mappa.dist = d; mappa.az = az;
    mappa.atualizarCamera();
  }
  function vaiACasa(casa) {
    citta.posCasa(casa);
    const az = posLote(casa.lote).rot === 0 ? 0.5 : Math.PI + 0.5;   // de frente para a porta
    const { d, k } = enquadra(casa);
    document.body.classList.add('p-edit');
    mappa.voar({ x: casa.x + Math.cos(az) * k[0] * d + Math.sin(az) * k[1] * d, z: casa.z - Math.sin(az) * k[0] * d + Math.cos(az) * k[1] * d, dist: d, az });
    giro = { casa, az };
    mappa.animatori.add(GIRO);
    et.destaque = casa.conta;
  }
  const GIRO = {};
  const ferma = () => { giro = null; mappa.animatori.delete(GIRO); };
  mappa.canvas.addEventListener('pointerdown', ferma);
  mappa.canvas.addEventListener('wheel', ferma);

  // fechar o painel sem pagar desfaz a prévia
  const fecharOrig = ui.fechar.bind(ui);
  ui.fechar = () => { annulla(); ferma(); document.body.classList.remove('p-edit'); fecharOrig(); };
  function annulla() {
    if (!ed) return;
    const c = comprate.get(ed.casa.conta);
    disegna(ed.casa, c ? copia(c.sel) : { squadra: null, extra: new Set() }, c?.da);
    ed = null;
  }

  // ---------- pílula ----------
  const pill = $('#fai-video'), testo = pill.querySelector('.testo'), frasi = ['✨ Decora la tua casa', '🎁 Regala a un amico'];
  let fi = 0;
  setInterval(() => { testo.classList.add('via'); setTimeout(() => { fi = (fi + 1) % frasi.length; testo.textContent = frasi[fi]; testo.classList.remove('via'); }, 250); }, 3200);
  pill.onclick = () => home();

  // ---------- telas ----------
  const painel = $('#pannello-contenuto');
  painel.addEventListener('click', e => {
    const b = e.target.closest('[data-p]');
    if (!b) return;
    const v = b.dataset.v;
    ({
      mia: () => (ui.minha && D.porConta.get(ui.minha) ? editor('mia', D.porConta.get(ui.minha)) : scegli('mia')),
      regalo: () => scegli('regalo'),
      scelto: () => editor(b.dataset.modo, D.porConta.get(v)),
      squadra: () => { ed.sel.squadra = ed.sel.squadra === v ? null : v; if (ed.sel.squadra) ed.sel.extra.delete('oro'); aggiornaEditor(); },
      eff: () => { const s = ed.sel.extra; s.has(v) ? s.delete(v) : s.add(v); if (v === 'oro' && s.has('oro')) ed.sel.squadra = null; aggiornaEditor(); },
      notte: () => { mappa.definirNotte(v === '1'); if (festa?.luci) festa.luci.visible = v === '1'; },
      paga: () => checkout(),
      pagato: () => pagato(),
      indietro: () => editor(ed.modo, ed.casa, true),
      home: () => { annulla(); home(); },
    })[b.dataset.p]?.();
  });

  function home() {
    annulla(); ferma(); document.body.classList.remove('p-edit');
    ui.abrir(`
      <h2>Rendi speciale una casa ✨</h2>
      <div class="sub">Provala <b>gratis</b> qui sulla mappa. Paghi solo se ti piace.</div>
      <div class="scelta2">
        <button data-p="mia"><span class="em">🏠</span><span><b>La mia casa</b><small>Colori della tua squadra, casa d’oro, neon, corona…</small></span></button>
        <button data-p="regalo"><span class="em">🎁</span><span><b>Regala a un amico</b><small>Una sorpresa sulla sua casa, con il tuo nome sopra</small></span></button>
      </div>
      <div class="regola">✅ Solo estetica: non dà punti e non cambia la classifica. Vince sempre chi gioca.</div>`);
  }

  function scegli(modo) {
    ui.abrir(`
      <h2>${modo === 'regalo' ? 'A chi vuoi fare il regalo? 🎁' : 'Qual è la tua casa? 🏠'}</h2>
      <div class="sub">${modo === 'regalo' ? 'Scrivi il suo @ di Instagram: deve avere già una casa sulla mappa.' : 'Scrivi il tuo @ di Instagram.'}</div>
      <div class="cerca-p"><span>@</span><input id="p-q" placeholder="${modo === 'regalo' ? 'il_suo_account' : 'il_tuo_account'}" autocomplete="off" autocapitalize="off"></div>
      <div class="sugg" id="p-sugg"></div>
      <div class="bottoni"><button class="sec" data-p="home">← indietro</button></div>`);
    const q = $('#p-q'), out = $('#p-sugg');
    q.oninput = () => {
      const t = q.value.trim().replace(/^@/, '').toLowerCase();
      if (t.length < 2) { out.innerHTML = ''; return; }
      const res = [];
      for (const c of D.casas) { if (c.conta.startsWith(t)) res.push(c); if (res.length >= 6) break; }
      out.innerHTML = res.length ? res.map(c => `<button data-p="scelto" data-modo="${modo}" data-v="${esc(c.conta)}">@${esc(c.conta)}<small>${esc(D.luoghi[c.luogo].nome)}</small></button>`).join('')
        : '<div class="nota">Nessuna casa con questo @. Per avere una casa basta commentare città e regione sotto un nostro post.</div>';
    };
    setTimeout(() => q.focus(), 50);
  }

  function editor(modo, casa, manter = false) {
    if (!casa) return;
    if (!manter || !ed) {
      annulla();
      const c = comprate.get(casa.conta);
      ed = { modo, casa, sel: c ? copia(c.sel) : { squadra: null, extra: new Set() }, da: c?.da ?? (modo === 'regalo' ? (ui.minha ?? '') : null) };
    }
    vaiACasa(casa);
    const l = D.luoghi[casa.luogo], regalo = modo === 'regalo';
    const eff = EFFETTI.filter(e => (regalo ? e.regalo : e.mia));
    ui.abrir(`
      <div class="tag-luogo">📍 ${esc(l.nome)}</div>
      <h2 class="conta">${regalo ? '🎁 ' : ''}@${esc(casa.conta)}</h2>
      <div class="sub">${regalo ? 'Tocca un regalo: lo vedi subito sulla sua casa.' : 'Tocca e guarda la tua casa cambiare. È solo un’anteprima.'}</div>
      ${regalo ? `<div class="cerca-p"><span>da @</span><input id="p-da" placeholder="il_tuo_account" value="${esc(ed.da ?? '')}" autocomplete="off" autocapitalize="off"></div>` : ''}
      ${regalo ? '' : `<div class="gruppo">⚽ Colori della tua squadra</div>
      <div class="griglia">${SQUADRE.map(s => `<button data-p="squadra" data-v="${s.id}"><span class="sw" style="background:linear-gradient(90deg,${s.muro} 0 25%,${s.tetto} 25% 50%,${s.muro} 50% 75%,${s.tetto} 75%)"></span><b>${s.nome}</b><small>${eur(PREZZO)}</small></button>`).join('')}</div>`}
      <div class="gruppo">${regalo ? '🎁 Scegli il regalo' : '✨ Effetti'}</div>
      <div class="griglia">${eff.map(e => `<button data-p="eff" data-v="${e.id}"><span class="em">${e.em}</span><b>${e.nome}</b><small>${eur(PREZZO)}</small></button>`).join('')}</div>
      <div class="riga-vista"><button data-p="notte" data-v="0">☀️ Di giorno</button><button data-p="notte" data-v="1">🌙 Di notte</button></div>
      <div class="conto-p" id="p-conto"></div>`);
    $('#p-da')?.addEventListener('input', e => { ed.da = e.target.value.trim().replace(/^@/, ''); aggiornaEditor(false); });
    aggiornaEditor();
  }

  const quanti = s => (s.squadra ? 1 : 0) + s.extra.size;
  const prezzo = n => (n >= MIN_PACCHETTO ? PACCHETTO : n * PREZZO);
  function aggiornaEditor(ridisegna = true) {
    if (!ed) return;
    painel.querySelectorAll('[data-p="squadra"]').forEach(b => b.classList.toggle('on', ed.sel.squadra === b.dataset.v));
    painel.querySelectorAll('[data-p="eff"]').forEach(b => b.classList.toggle('on', ed.sel.extra.has(b.dataset.v)));
    if (ridisegna) disegna(ed.casa, ed.sel, ed.modo === 'regalo' ? (ed.da || '…') : null);
    else { const a = attive.get(ed.casa.conta); if (a) a.da = ed.da || '…'; }
    const n = quanti(ed.sel), regalo = ed.modo === 'regalo';
    const pac = n >= MIN_PACCHETTO
      ? `<div class="pacchetto on">🎉 <b>Pacchetto completo</b>: ${n} effetti a <b>${eur(PACCHETTO)}</b> invece di ${eur(n * PREZZO)}</div>`
      : `<div class="pacchetto">💡 Con ${MIN_PACCHETTO} o più effetti paghi solo <b>${eur(PACCHETTO)}</b> in tutto</div>`;
    const okDa = !regalo || /^[a-z0-9._]{2,30}$/i.test(ed.da ?? '');
    $('#p-conto').innerHTML = `${pac}
      <button class="paga" data-p="paga" ${n && okDa ? '' : 'disabled'}>${n ? `${regalo ? '🎁 Regala' : '✨ Mostra a tutti'} · ${eur(prezzo(n))}` : 'Scegli almeno un effetto'}
        <small>${n && !okDa ? 'scrivi il tuo @ qui sopra' : 'visibile a tutti per 30 giorni'}</small></button>`;
  }

  function checkout() {
    const n = quanti(ed.sel);
    ferma();
    ui.abrir(`
      <h2>Pagamento 🔒</h2>
      <div class="sub">${ed.modo === 'regalo' ? `Regalo per @${esc(ed.casa.conta)} da @${esc(ed.da)}` : `Casa di @${esc(ed.casa.conta)}`} · ${n} ${n === 1 ? 'effetto' : 'effetti'} · <b>${eur(prezzo(n))}</b></div>
      <div class="finto">🧪 Qui si aprirà il pagamento sicuro Hotmart (carta, PayPal, Google/Apple Pay).<br>In questa <b>PROVA</b> è simulato: nessun addebito.</div>
      <div class="regola">👨‍👩‍👧 Hai meno di 18 anni? Chiedi a un genitore prima di pagare.</div>
      <button class="paga" data-p="pagato" style="margin-top:12px">✓ Simula pagamento riuscito</button>
      <div class="bottoni"><button class="sec" data-p="indietro">← torna</button></div>`);
  }

  async function pagato() {
    const { casa, sel, da, modo } = ed;
    comprate.set(casa.conta, { sel: copia(sel), da: modo === 'regalo' ? da : null });
    disegna(casa, copia(sel), modo === 'regalo' ? da : null);
    ed = null;
    coriandoli();
    giro = { casa, az: mappa.az }; mappa.animatori.add(GIRO);
    const regalo = modo === 'regalo', emoji = [...sel.extra].map(id => nomeEff(id)?.em).filter(Boolean).join(' ');
    ui.abrir(`
      <h2>${regalo ? 'Regalo consegnato! 🎁' : 'Fatto! La tua casa brilla ✨'}</h2>
      <div class="sub">${regalo ? `@${esc(casa.conta)} lo vede appena apre la mappa. Mandagli la storia e taggalo! 👇` : 'Ora la vedono tutti sulla mappa, per 30 giorni.'}</div>
      <div class="anteprima vuota" id="p-img">preparo la storia…</div>
      <div class="bottoni"><button class="sec" data-p="home">✨ Decora un’altra casa</button></div>`);
    const url = await storia(casa, regalo ? '🎁 Un regalo per' : 'La mia casa è speciale ✨', `@${casa.conta}${regalo ? '!' : ''}`, regalo ? `${emoji} da @${da}` : `${emoji} ${D.luoghi[casa.luogo].nome}`.trim());
    const box = $('#p-img');
    if (box) box.outerHTML = `<img class="anteprima" src="${url}" alt="storia"><a class="botao" download="${regalo ? 'regalo' : 'la-mia-casa'}.png" href="${url}">⬇️ Scarica la storia</a>`;
  }

  function coriandoli() {
    const box = document.createElement('div'); box.className = 'coriandoli';
    const cores = ['#E0473C', '#FFC93C', '#3FA7F5', '#2E9B55', '#FF7EB6', '#7B2CBF'];
    for (let i = 0; i < 70; i++) { const c = document.createElement('i'); c.style.left = `${Math.random() * 100}%`; c.style.background = cores[i % cores.length]; c.style.animationDelay = `${Math.random() * 0.6}s`; box.appendChild(c); }
    document.body.appendChild(box);
    setTimeout(() => box.remove(), 3200);
  }

  // imagem de story 1080x1920: foto 3D da casa decorada + textos
  async function storia(casa, t1, t2, t3) {
    await document.fonts.load('900 80px Nunito');
    const p = citta.posCasa(casa), topo = topoDi(casa, attive.get(casa.conta)?.sel ?? { extra: new Set() }) * LOTE;
    const f = ui.fot.foto({ x: p.x, z: p.z, y: p.y + topo * 0.45, dist: 0.09 + topo * 2.6, az: mappa.az, el: 0.38, w: 1000, h: 1000 });
    const cv = document.createElement('canvas'); cv.width = 1080; cv.height = 1920;
    const g = cv.getContext('2d');
    const fundo = g.createLinearGradient(0, 0, 0, 1920); fundo.addColorStop(0, mappa.notte ? '#1E3560' : '#8EBFD2'); fundo.addColorStop(1, mappa.notte ? '#0E1A33' : '#5E9DB8');
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
    testo('italiacasapercasa.com', 1760, 60, '#FFC93C');
    return cv.toDataURL('image/png');
  }

  // atalhos de teste pela URL
  const qs = new URLSearchParams(location.search);
  if (qs.get('p') && qs.get('conta')) {
    const casa = D.porConta.get(qs.get('conta')), modo = qs.get('p');
    if (casa) {
      if (modo === 'regalo' && qs.get('da')) ui.minha = qs.get('da');
      editor(modo, casa);
      for (const v of (qs.get('sel') ?? '').split(',').filter(Boolean)) { if (SQUADRE.some(s => s.id === v)) ed.sel.squadra = v; else ed.sel.extra.add(v); }
      aggiornaEditor();
      if (qs.has('pagato')) pagato();
    }
  }
  window.__prova = {
    attive, pagato,
    editor(m, c, sel = [], da = null) {
      if (da) ui.minha = da;
      editor(m, D.porConta.get(c));
      for (const v of sel) { if (SQUADRE.some(s => s.id === v)) ed.sel.squadra = v; else ed.sel.extra.add(v); }
      aggiornaEditor();
    },
  };
});
