// Reel dos negócios com dados reais: voo até a loja real (Shelby, Cesate), rua com 3 lojas de EXEMPLO em Napoli,
// comentário marcando a loja, o editor "su misura" montando a pizzaria e o cartão com WhatsApp.
// window.preparar(roteiro), window.quadro(t); tudo depende só de t.
import * as THREE from 'three';
import { carregar } from '../js/dati.js';
import { Mappa } from '../js/mappa.js';
import { Citta, posLote, LOTE } from '../js/citta.js';
import { creaNegozio3D } from '../js/negozio3d.js';

const $ = s => document.querySelector(s);
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const suave = s => (s < 0.5 ? 4 * s * s * s : 1 - Math.pow(-2 * s + 2, 3) / 2);
const ressalto = s => { const c = 1.9; return s <= 0 ? 0 : s >= 1 ? 1 : 1 + (c + 1) * Math.pow(s - 1, 3) + c * Math.pow(s - 1, 2); };
const fase = (t, ini, dur) => clamp((t - ini) / dur);
const esc = s => String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

let D, mappa, citta, R, E, chaves, lugarEx, hc, shelby, esempi = [], etichette = [];

async function iniciar() {
  D = await carregar('video');
  mappa = new Mappa($('#mappa'), D.geo, D.rilievo, D.imagem, { gravacao: true });
  window.preparar = preparar;
  window.quadro = quadro;
}

// lojas de exemplo: estilo final; a pizzaria muda durante o "editor"
const BAR = { nome: 'Bar Centrale', colore: '#2F7DD1', stile: { tenda: 'liscia', coloreTenda: '#2F7DD1', facciata: '#DDE8F2', porta: '#7A4B2A', bordo: '#152033', insegna: 'bandiera', oggetto: 'caffe', scala: 1.1, ornamenti: ['dehors', 'vasi'] } };
const BARBIERE = { nome: 'Barberia Toni', colore: '#152033', stile: { tenda: 'righe', coloreTenda: '#152033', coloreRighe: '#FFFFFF', facciata: '#F3E2C2', insegna: 'cassonetto', oggetto: 'barbiere', scala: 1.1, ornamenti: ['vasi'] } };
const PIZZA_FINALE = { tenda: 'righe', coloreTenda: '#3E8E4E', coloreRighe: '#FFFFFF', facciata: '#FFE08A', porta: '#152033', bordo: '#B0623A', piani: 2, vetrina: 'larga', insegna: 'neon', oggetto: 'pizza', scala: 1.15, ornamenti: ['dehors', 'luci', 'bandierine'] };
function pizzeria(t) {
  if (t < E.editor) return { nome: 'Pizzeria Da Mario', colore: '#E0473C', stile: PIZZA_FINALE };
  const st = { tenda: 'righe', coloreTenda: '#9AA3AE', coloreRighe: '#FFFFFF', facciata: '#F3E2C2', porta: '#7A4B2A', bordo: '#F6F3EC', piani: 1, vetrina: 'normale', insegna: 'facciata', oggetto: 'nessuno', scala: 1, ornamenti: [] };
  let colore = '#9AA3AE';
  if (t >= E.colori) {
    const giro = ['#2F7DD1', '#D94F8A', '#F28C28', '#3E8E4E'], k = Math.min(giro.length - 1, Math.floor((t - E.colori) / 0.18));
    st.coloreTenda = giro[k]; st.facciata = k >= 2 ? '#FFE08A' : '#F3E2C2'; colore = '#E0473C';
  }
  if (t >= E.insegna) { st.insegna = 'neon'; st.piani = 2; st.vetrina = 'larga'; st.porta = '#152033'; st.bordo = '#B0623A'; }
  if (t >= E.pizza) { st.oggetto = 'pizza'; st.scala = Math.round((0.3 + 0.85 * ressalto(fase(t, E.pizza, 0.6))) * 20) / 20; }
  if (t >= E.ornamenti) st.ornamenti = ['dehors', 'luci', 'bandierine'];
  return { nome: 'Pizzeria Da Mario', colore, stile: st };
}

function colocar(ex, dados) {
  const chave = JSON.stringify(dados);
  if (ex.chave === chave) return;
  if (ex.obj) { mappa.scene.remove(ex.obj); ex.obj.userData.descartar(); }
  ex.chave = chave;
  ex.obj = creaNegozio3D(dados, { aoMudar: () => {} });
  ex.obj.position.set(ex.x, hc + 0.0009, ex.z);
  ex.obj.rotation.y = ex.rot;
  ex.obj.scale.setScalar(LOTE);
  mappa.scene.add(ex.obj);
}

// ---------- câmera ----------
function montarChaves() {
  const b = D.geo.bbox, alt = b.z1 - b.z0, dP = mappa.distPais();
  const paese = { x: (b.x0 + b.x1) / 2, z: (b.z0 + b.z1) / 2 - alt * 0.07, dist: dP, az: 0, giu: 0 };
  const sh = { x: shelby.x, z: shelby.z, az: shelby.rot + 0.5, giu: 0.06 };
  const [p, br, bb] = esempi, frente = r => r + 0.45;
  const lista = [
    [0, { ...paese, dist: dP * 1.05 }],
    [0.6, { ...paese }],
    [E.shelby - 0.3, { ...sh, dist: 0.34 }],
    [E.esempi - 0.02, { dist: 0.3, az: sh.az + 0.35 }],
    [E.esempi, { x: p.x, z: p.z, az: frente(p.rot), dist: 0.3, giu: 0.13 }, true],
    [E.bar, { x: br.x, z: br.z, az: frente(br.rot) + 0.1, dist: 0.3 }],
    [E.barbiere, { x: bb.x, z: bb.z, az: frente(bb.rot) + 0.15, dist: 0.3 }],
    [E.commento, { x: br.x, z: br.z, dist: 0.5, az: frente(br.rot) - 0.1, giu: 0.16 }],
    [E.editor - 0.05, { dist: 0.55, az: frente(br.rot) - 0.25 }],
    [E.editor, { x: p.x, z: p.z, dist: 0.27, az: frente(p.rot) - 0.5, giu: 0.1 }, true],
    [E.tocco, { dist: 0.3, az: frente(p.rot) + 0.55 }],
    [E.banner, { dist: 0.34, az: frente(p.rot) + 0.65, giu: -0.05 }],
    [R.durata, { dist: 1.2, az: frente(p.rot) + 0.9, giu: -0.2 }],
  ];
  let ant = {};
  chaves = lista.map(([t, k, corte]) => { ant = { ...ant, ...k }; return { t, k: { ...ant }, corte: !!corte }; });
}
function camera(t) {
  let i = 0;
  while (i < chaves.length - 2 && t >= chaves[i + 1].t) i++;
  const a = chaves[i], b = chaves[Math.min(i + 1, chaves.length - 1)];
  const s = b.corte ? (t >= b.t ? 1 : 0) : (b.t > a.t ? suave(clamp((t - a.t) / (b.t - a.t))) : 1);
  const A = b.corte ? a.k : a.k, B = b.k, l = (p, q) => p + (q - p) * s;
  const dxz = Math.hypot(B.x - A.x, B.z - A.z), bump = b.corte ? 0 : 0.35 * Math.max(0, Math.log(dxz / Math.max(A.dist, B.dist) + 1));
  const sxz = dxz > 20 && !b.corte ? suave(clamp((t - a.t) / ((b.t - a.t) * 0.55))) : s;
  const dist = Math.exp(l(Math.log(A.dist), Math.log(B.dist)) + bump * Math.sin(Math.PI * s));
  const az = l(A.az, B.az), giu = l(A.giu, B.giu), x = A.x + (B.x - A.x) * sxz, z = A.z + (B.z - A.z) * sxz;
  mappa.az = az; mappa.dist = dist;
  mappa.alvo.x = x - Math.sin(az) * giu * dist;
  mappa.alvo.z = z - Math.cos(az) * giu * dist;
  mappa.atualizarCamera();
}

// ---------- textos ----------
function projetar(x, y, z) {
  const p = new THREE.Vector3(x, y, z).project(mappa.camera);
  return { x: (p.x + 1) / 2 * 1080, y: (1 - p.y) / 2 * 1920, ok: p.z < 1 };
}
function criarEtichetta(classe, esempio, titolo, sotto) {
  const el = document.createElement('div');
  el.className = `etichetta ${classe}`;
  el.innerHTML = `${esempio ? `<div class="esempio">${esc(esempio)}</div>` : ''}<div class="pillola"><b>${esc(titolo)}</b><small>${esc(sotto)}</small></div><div class="freccia"></div>`;
  $('#etichette').appendChild(el);
  return el;
}
function legenda(t) {
  const f = R.frasi.find(x => t >= x.ini && t < x.fim);
  const html = f && !R.copertina ? f.linee.map(l => l.filter(w => t >= w[1]).map(w => w[2] ? `<span class="g">${esc(w[0])}</span>` : esc(w[0])).join(' ')).filter(Boolean).join('<br>') : '';
  const el = $('#sott');
  if (el.innerHTML !== html) el.innerHTML = html;
}
function mostrar(el, t, ini, fim) {
  const ent = ressalto(fase(t, ini, 0.3)), sai = fase(t, fim - 0.2, 0.2), vis = t >= ini && t < fim;
  el.style.opacity = vis ? String(1 - sai) : '0';
  if (vis) el.style.transform = `translateY(${(1 - Math.min(1, ent)) * 20 - sai * 40}px) scale(${0.85 + 0.15 * ent})`;
}

function quadro(t) {
  colocar(esempi[0], pizzeria(t));
  camera(t);
  for (const e of etichette) {
    const vis = t >= e.ini && t < e.fim;
    if (!vis) { e.el.style.opacity = '0'; continue; }
    const p = projetar(e.x, e.y, e.z), s = ressalto(fase(t, e.ini, 0.32)) * (1 - fase(t, e.fim - 0.2, 0.2));
    e.el.style.opacity = p.ok ? '1' : '0';
    e.el.style.transform = `translate(${p.x - e.el.offsetWidth / 2}px, ${p.y - e.el.offsetHeight}px) scale(${s})`;
  }
  // comentário marcando a loja
  const cm = $('#commento');
  mostrar(cm, t, E.commento, E.editor - 0.1);
  if (t >= E.commento && t < E.editor) {
    const txt = R.commento.testo, n = Math.round(clamp((t - E.commento - 0.25) / (E.scrivi_a - E.commento - 0.25)) * [...txt].length);
    const parte = esc([...txt].slice(0, n).join('')).replace(/(@[\w.-]+)/g, '<span class="at">$1</span>');
    cm.querySelector('.testo').innerHTML = parte + ((t * 2.4) % 1 < 0.55 || n < [...txt].length ? '<span class="cursore"></span>' : '');
  }
  const s3 = ressalto(fase(t, E.piu3, 0.3)), out3 = fase(t, E.piu3 + 0.9, 0.25);
  $('#piu3').style.opacity = t >= E.piu3 && t < E.piu3 + 1.15 ? String(1 - out3) : '0';
  $('#piu3').style.transform = `translateX(-50%) translateY(${-out3 * 80}px) scale(${s3})`;
  // toque na loja e cartão com WhatsApp
  const p = esempi[0], q = projetar(p.x, hc + LOTE * 0.45, p.z), tc = $('#tocco');
  const ft = fase(t, E.tocco + 0.1, 0.5);
  tc.style.opacity = t >= E.tocco + 0.1 && ft < 1 ? String(1 - ft) : '0';
  tc.style.left = `${q.x}px`; tc.style.top = `${q.y}px`; tc.style.transform = `scale(${0.5 + ft * 0.9})`;
  mostrar($('#carta'), t, E.carta - 0.4, E.banner + 0.2);
  const sb = fase(t, E.banner, 0.3);
  $('#banner').style.opacity = String(sb);
  $('#banner').style.transform = `translateY(${(1 - sb) * 20}px)`;
  legenda(t);
  mappa.renderer.render(mappa.scene, mappa.camera);
  return true;
}

async function preparar(roteiro) {
  R = roteiro; E = R.eventi;
  await Promise.all(['900 104px Nunito', '800 40px Nunito', '700 30px Nunito'].map(f => document.fonts.load(f)));
  await document.fonts.ready;
  // 3 lotes livres de Napoli viram as lojas de exemplo (as placas "in vendita" passam para os lotes seguintes)
  lugarEx = D.luoghi.find(l => l.nome === R.citta_esempi);
  const base = lugarEx.lotti;
  lugarEx.lotti += 3;
  citta = new Citta(mappa, D);
  hc = citta.dadosCidade(lugarEx).hc;
  esempi = [0, 1, 2].map(k => { const q = posLote(base + k); return { x: lugarEx.x + q.x, z: lugarEx.z + q.z, rot: q.rot }; });
  colocar(esempi[1], BAR); colocar(esempi[2], BARBIERE);
  // loja real
  const cs = D.commerci.find(c => c.nome.startsWith('Shelby')) ?? D.commerci[0];
  const ps = citta.posCommercio(cs);
  shelby = { ...ps, rot: posLote(cs.lote).rot, cm: cs };
  montarChaves();
  $('#titolo').textContent = R.titolo;
  $('#sotto-titolo').innerHTML = `<span class="g">${esc(R.sottotitolo)}</span>`;
  $('#commento .chi').innerHTML = `${esc(R.commento.utente)} <span>· ora</span>`;
  $('#banner').textContent = R.banner;
  const alto = hc + LOTE * 1.35;
  etichette = [
    { el: criarEtichetta('vero', '', cs.nome, cs.luogo.nome), x: shelby.x, y: shelby.y + LOTE * 1.0, z: shelby.z, ini: E.shelby - 0.1, fim: E.esempi },
    ...esempi.map((e, i) => ({ el: criarEtichetta('', 'ESEMPIO', ['Pizzeria Da Mario', BAR.nome, BARBIERE.nome][i], R.citta_esempi), x: e.x, y: alto, z: e.z, ini: [E.esempi, E.bar, E.barbiere][i], fim: E.commento })),
  ];
  // capa: título grande no lugar da legenda; sem balões nem cartão
  if (R.copertina) {
    const cp = R.copertina;
    $('#testa').style.top = `${cp.testa_top ?? 120}px`;
    for (const id of ['#carta', '#banner', '#commento', '#piu3', '#tocco']) $(id).style.display = 'none';
    const el = document.createElement('div');
    el.className = 'forte';
    el.style.cssText = `position:absolute;left:30px;right:30px;top:${cp.titolo_top}px;text-align:center;line-height:1.05;`;
    el.innerHTML = cp.linee.map(([txt, giallo, size]) => `<div style="font-size:${size}px;-webkit-text-stroke-width:${Math.round(size * 0.19)}px"${giallo ? ' class="g"' : ''}>${esc(txt)}</div>`).join('');
    document.body.appendChild(el);
  }
  quadro(0);
  return { durata: R.durata, fps: 30 };
}

iniciar().catch(e => console.error('erro ao carregar', e));
