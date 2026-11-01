// Reel "collab" (reel 17, para lojistas, postado em colaboração com as lojas): 3 lojas reais em 3D (a 1ª já na tela no
// quadro 0), o toque que abre o cartão (descrição, Instagram, WhatsApp), os números reais (visualizações do Insights,
// pessoas, visitas ao site com barras por dia), o preço, as vagas e "link in bio". O fim volta à 1ª loja (loop).
// window.preparar/quadro/suoni; tudo depende só de t.
import * as THREE from 'three';
import { carregar } from '../js/dati.js';
import { Mappa } from '../js/mappa.js';
import { Citta, DIST_CIDADE, LOTE, posLote } from '../js/citta.js';

const $ = s => document.querySelector(s);
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const suave = s => (s < 0.5 ? 4 * s * s * s : 1 - Math.pow(-2 * s + 2, 3) / 2);
const ressalto = s => { const c = 1.9; return s <= 0 ? 0 : s >= 1 ? 1 : 1 + (c + 1) * Math.pow(s - 1, 3) + c * Math.pow(s - 1, 2); };
const fase = (t, ini, dur) => clamp((t - ini) / dur);
const esc = s => String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
const num = n => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
const conta = (t, ini, dur, v, de = 0) => de + (v - de) * (1 - Math.pow(1 - fase(t, ini, dur), 3));

let D, mappa, citta, R, E, chaves, punti, etichette = [], lojas;

async function iniciar() {
  D = await carregar('video');
  mappa = new Mappa($('#mappa'), D.geo, D.rilievo, D.imagem, { gravacao: true });
  window.preparar = preparar;
  window.quadro = quadro;
  window.suoni = suoni;
}

// uma bolinha por cidade com casa (planos do país)
function criarPontos() {
  const ls = D.luoghi.filter(l => l.casas.length);
  const pos = new Float32Array(ls.length * 3), loja = new Float32Array(ls.length);
  ls.forEach((l, i) => { pos.set([l.x, mappa.altura(l.x, l.z) + 0.03, l.z], i * 3); loja[i] = l.commerci?.length ? 1 : 0; });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('loja', new THREE.BufferAttribute(loja, 1));
  const mat = new THREE.ShaderMaterial({
    uniforms: { pulso: { value: 0 }, escala: { value: 1920 / (2 * Math.tan(mappa.camera.fov * Math.PI / 360)) } },
    vertexShader: `
      attribute float loja; uniform float escala; uniform float pulso; varying float vLoja;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vLoja = loja;
        float s = clamp(0.05 * escala / -mv.z, 10.0, 15.0);
        gl_PointSize = loja > 0.5 ? s * (2.4 + 0.4 * pulso) : s;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      varying float vLoja;
      void main() {
        float d = length(gl_PointCoord - 0.5) * 2.0;
        if (d > 1.0) discard;
        gl_FragColor = vec4(d > (vLoja > 0.5 ? 0.74 : 0.62) ? vec3(0.08, 0.13, 0.2) : (vLoja > 0.5 ? vec3(1.0, 0.79, 0.24) : vec3(1.0)), 1.0);
        #include <colorspace_fragment>
      }`,
  });
  const p = new THREE.Points(g, mat);
  p.frustumCulled = false; p.renderOrder = 5;
  mappa.scene.add(p);
  return p;
}

// cortes secos (flash + batida)
const TAGLI = () => [E.anche - 0.1, E.r3 - 0.1, E.e3 - 0.1, E.chi - 0.1, E.insette - 0.1, E.sito - 0.1, E.hai - 0.1, E.posti - 0.1, E.link - 0.1, E.prossima - 0.15];

// ---------- câmera ----------
function montarChaves() {
  const b = D.geo.bbox, alt = b.z1 - b.z0, dP = mappa.distPais();
  const paese = { x: (b.x0 + b.x1) / 2, z: (b.z0 + b.z1) / 2 - alt * 0.07, dist: dP, az: 0, giu: 0 };
  const P = (o, k = {}) => ({ x: o.x, z: o.z, giu: 0.04, ...k });
  const [T1, T1b, T2, T3, T4, T4b, T5, T6, T7, T8] = TAGLI();
  const cena = (ini, fim, a, c) => [[ini, a], [fim - 0.01, c]];
  const [a, m, v, n] = lojas;
  const ABRE = P(a.pos, { dist: 0.62, az: a.az - 0.35, giu: 0.06 });
  const lista = [
    ...cena(0, T1, ABRE, P(a.pos, { dist: 0.4, az: a.az + 0.2, giu: 0.06 })),
    ...cena(T1, T1b, P(m.pos, { dist: 0.62, az: m.az - 0.3, giu: 0.06 }), P(m.pos, { dist: 0.4, az: m.az + 0.2, giu: 0.06 })),
    ...cena(T1b, T2, P(v.pos, { dist: 0.62, az: v.az + 0.4, giu: 0.06 }), P(v.pos, { dist: 0.4, az: v.az - 0.1, giu: 0.06 })),
    ...cena(T2, T3, P(n.pos, { dist: 0.62, az: n.az - 0.4, giu: 0.06 }), P(n.pos, { dist: 0.4, az: n.az + 0.1, giu: 0.06 })),
    // toque e cartão (Vistamare, a melhor descrição): a loja fica embaixo do cartão
    ...cena(T3, T4, P(v.pos, { dist: 0.5, az: v.az + 0.1, giu: -0.14 }), P(v.pos, { dist: 0.44, az: v.az + 0.45, giu: -0.14 })),
    ...cena(T4, T4b, { ...paese, dist: dP * 1.05, az: -0.12, giu: -0.05 }, { ...paese, dist: dP * 0.9, az: 0.08, giu: -0.05 }),
    ...cena(T4b, T5, { ...paese, dist: dP * 0.75, az: 0.2, giu: -0.08 }, { ...paese, dist: dP * 0.85, az: -0.05, giu: -0.08 }),
    // preço e vagas em cidades planas (Formia e Chiavari mostram o paredão do terreno do litoral)
    ...cena(T5, T6, P(m.pos, { dist: 1.3, az: m.az + 0.8, giu: 0.1 }), P(m.pos, { dist: 0.9, az: m.az + 1.3, giu: 0.1 })),
    ...cena(T6, T7, P(a.pos, { dist: 1.2, az: a.az - 0.9, giu: 0.1 }), P(a.pos, { dist: 0.95, az: a.az - 0.5, giu: 0.1 })),
    ...cena(T7, T8, { ...paese, dist: dP * 0.95, az: 0.1 }, { ...paese, dist: dP * 1.05, az: -0.05 }),
    [T8, P(a.pos, { dist: 0.75, az: a.az - 0.6, giu: 0.06 })],
    [R.durata, ABRE],
  ];
  chaves = lista.sort((x, y) => x[0] - y[0]).map(([t, k]) => ({ t, k }));
}
function camera(t) {
  let i = 0;
  while (i < chaves.length - 2 && t >= chaves[i + 1].t) i++;
  const a = chaves[i], b = chaves[Math.min(i + 1, chaves.length - 1)];
  const s = b.t > a.t ? suave(clamp((t - a.t) / (b.t - a.t))) : 1;
  const sl = a.t >= TAGLI()[9] - 0.01 ? clamp((t - a.t) / (b.t - a.t)) : s;   // volta à 1ª loja sem freada (loop)
  const A = a.k, B = b.k, l = (p, q) => p + (q - p) * sl;
  const dist = Math.exp(l(Math.log(A.dist), Math.log(B.dist)));
  const tremor = [[E.libreria, 0.3], [E.mobili, 0.3], [E.ristorante, 0.3], [E.texmex, 0.3], [E.milione, 0.4], [E.settantamila, 0.35], [E.nove, 0.4], [E.pochi, 0.35]]
    .reduce((v, [ti, d]) => v + (t >= ti && t < ti + d ? 0.012 * (1 - (t - ti) / d) * Math.sin((t - ti) * 70) : 0), 0);
  const soco = [E.milione, E.nove].reduce((v, ti) => v + (t >= ti && t < ti + 0.5 ? 0.1 * Math.sin(Math.PI * (t - ti) / 0.5) : 0), 0);
  const az = l(A.az, B.az) + tremor, giu = l(A.giu, B.giu), x = l(A.x, B.x), z = l(A.z, B.z);
  mappa.az = az; mappa.dist = dist * (1 + tremor - soco);
  mappa.alvo.x = x - Math.sin(az) * giu * dist;
  mappa.alvo.z = z - Math.cos(az) * giu * dist;
  mappa.atualizarCamera();
  return dist;
}

// ---------- textos ----------
function projetar(x, y, z) { const p = new THREE.Vector3(x, y, z).project(mappa.camera); return { x: (p.x + 1) / 2 * 1080, y: (1 - p.y) / 2 * 1920, ok: p.z < 1 && p.z > -1 }; }
function novaEtichetta(html) {
  const el = document.createElement('div');
  el.className = 'cartello'; el.innerHTML = html;
  $('#etichette').appendChild(el);
  return el;
}
function legenda(t) {
  const f = R.frasi.find(x => t >= x.ini && t < x.fim);
  const html = f && !R.copertina ? f.linee.map(l => l.filter(w => t >= w[1] && w[0]).map(w => w[2] ? `<span class="g">${esc(w[0])}</span>` : esc(w[0])).join(' ')).filter(Boolean).join('<br>') : '';
  const el = $('#sott'); if (el.innerHTML !== html) el.innerHTML = html;
}
function mostrar(el, t, ini, fim, sobe = 30) {
  const ent = ressalto(fase(t, ini, 0.32)), sai = fase(t, fim - 0.2, 0.2), vis = t >= ini && t < fim;
  el.style.opacity = vis ? String(1 - sai) : '0';
  if (vis) el.style.transform = `translateY(${(1 - Math.min(1, ent)) * sobe - sai * 40}px) scale(${0.85 + 0.15 * ent})`;
}
function pulo(el, t, ini, base = '') {
  const k = ressalto(fase(t, ini, 0.3));
  el.style.opacity = t >= ini ? '1' : '0';
  el.style.transform = `${base} translateY(${(1 - Math.min(1, k)) * 40}px) scale(${0.4 + 0.6 * k})`;
}
const batida = (t, ti) => (t >= ti && t < ti + 0.35 ? 1 + 0.25 * Math.sin(Math.PI * (t - ti) / 0.35) : 1);
// pontinho do toque: segue um elemento da tela (ou um ponto 3D)
function tocco(t, ini, alvo) {
  const tc = $('#tocco'), k = fase(t, ini, 0.45);
  if (k <= 0 || k >= 1) return false;
  tc.style.left = `${alvo.x}px`; tc.style.top = `${alvo.y}px`;
  tc.style.opacity = String(1 - k); tc.style.transform = `scale(${0.4 + k})`;
  return true;
}

function quadro(t) {
  const dist = camera(t);
  const [T1, T1b, T2, T3, T4, T4b, T5, T6, T7, T8] = TAGLI();
  punti.visible = dist > DIST_CIDADE * 0.55;
  punti.material.uniforms.pulso.value = 0.5 + 0.5 * Math.sin(t * 7);
  const fl = Math.max(...TAGLI().map(tc => (t >= tc ? 0.75 * (1 - fase(t, tc, 0.22)) : 0)), ...[E.milione, E.nove].map(ti => (t >= ti ? 0.5 * (1 - fase(t, ti, 0.3)) : 0)));
  $('#velo').style.opacity = String(fl);
  // títulos
  const tit = $('#titolo'), cenaT = t < T1 || t >= T8 ? ['📍 SULLA MAPPA 3D', "DELL'ITALIA"] : t < T1b ? ['🏪 A TEGGIANO', ''] : t < T2 ? ['🍽️ A FORMIA', ''] : t < T3 ? ['🌮 A CHIAVARI', ''] : t >= T5 && t < T6 ? ["HAI UN'ATTIVITÀ?", ''] : null;
  if (cenaT) {
    const ini = t < T1 ? -1 : t < T1b ? T1 : t < T2 ? T1b : t < T3 ? T2 : t >= T8 ? T8 : T5;
    const fim = t < T1 ? T1 : t < T1b ? T1b : t < T2 ? T2 : t < T3 ? T3 : t >= T8 ? R.durata + 1 : E.mettila - 0.05;
    mostrar(tit, t, ini, fim, 20);
    if (tit.querySelector('.t1').textContent !== cenaT[0]) tit.querySelector('.t1').textContent = cenaT[0];
    tit.querySelector('.t2').textContent = cenaT[1];
  } else tit.style.opacity = '0';
  for (const e of etichette) {
    const v = e.vis(t);
    if (!v) { e.el.style.opacity = '0'; continue; }
    const pos = e.pos, p = projetar(pos.x, pos.y, pos.z);
    const s = e.ini(t) < 0 ? 1 : ressalto(fase(t, e.ini(t), 0.32));
    e.el.style.opacity = p.ok ? '1' : '0';
    e.el.style.transform = `translate(${p.x - e.el.offsetWidth / 2}px, ${p.y - e.el.offsetHeight}px) scale(${s * batida(t, e.bat)})`;
  }
  // toque na loja e o cartão
  const a = lojas[2];
  const pLoja = projetar(a.pos.x, a.pos.y + LOTE * 0.4, a.pos.z);
  const tc1 = t >= T3 && tocco(t, E.tocca - 0.05, pLoja);
  const sc = $('#scheda');
  mostrar(sc, t, E.negozio - 0.05, T4);
  sc.querySelector('.corpo p').classList.toggle('acceso', t >= E.descrizione - 0.05 && t < E.instagram - 0.05);
  sc.querySelector('.ig').classList.toggle('acceso', t >= E.instagram - 0.05 && t < E.pulsante);
  const bw = sc.querySelector('.wa');
  bw.classList.toggle('lampo', t >= E.pulsante && t < T4);
  bw.style.transform = `scale(${batida(t, E.whatsapp)})`;
  const tc2 = !tc1 && t >= E.whatsapp - 0.1 && t < T4 && tocco(t, E.whatsapp - 0.1, (() => { const r = bw.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })());
  if (!tc1 && !tc2) $('#tocco').style.opacity = '0';
  // números reais
  const tiles = $('#numeri').querySelectorAll('.tile'), N = R.numeri;
  [[E.insette + 0.1, E.milione + 0.3, N.views, '+'], [E.quasi - 0.1, E.persone + 0.2, N.persone, ''], [E.sito - 0.05, E.settantamila + 0.2, N.visite, '+']].forEach(([ini, fim, v, suf], i) => {
    const vis = t >= T4 && t < T5;
    if (!vis) { tiles[i].style.opacity = '0'; return; }
    pulo(tiles[i], t, ini);
    tiles[i].querySelector('b').textContent = num(conta(t, ini, fim - ini, v, 0)) + (t >= fim ? suf : '');
    tiles[i].querySelector('b').style.transform = `scale(${batida(t, fim)})`;
    tiles[i].style.opacity = t >= ini ? String(1 - fase(t, T5 - 0.2, 0.2)) : '0';
  });
  const maxG = Math.max(...N.giorni.map(g => g[1]));
  [...$('#barre').children].forEach((el, i) => { el.querySelector('i').style.height = `${130 * (N.giorni[i][1] / maxG) * suave(fase(t, E.sito + 0.1 + i * 0.12, 0.4))}px`; });
  // preço, vagas, chamada
  const pz = $('#prezzo');
  mostrar(pz, t, E.mettila - 0.05, T6, 40);
  pz.querySelector('.p').style.transform = `scale(${t >= E.nove - 0.05 ? (t < E.nove + 0.1 ? 1.5 - 0.5 * ressalto(fase(t, E.nove - 0.05, 0.3)) : batida(t, E.novanta)) : 0})`;
  pulo(pz.querySelector('.iva'), t, E.iva - 0.1);
  pulo(pz.querySelector('.bt'), t, E.iva + 0.25);
  pz.querySelector('.bt').classList.toggle('lampo', t >= E.iva + 0.5 && Math.floor((t - E.iva) * 4) % 2 === 0);
  mostrar($('#posti'), t, T6, T7, 40);
  [...$('#posti .slot').children].forEach((el, i) => pulo(el, t, E.posti + 0.1 + i * 0.12, i === 5 ? `rotate(${6 * Math.sin(t * 10)}deg)` : ''));
  const cta = $('#cta');
  mostrar(cta, t, T7, T8, 40);
  pulo(cta.querySelector('.b'), t, E.bio + 0.1);
  legenda(t);
  mappa.renderer.render(mappa.scene, mappa.camera);
  return true;
}

// efeitos sonoros: um por acontecimento na tela
function suoni() {
  const s = [], add = (t, tipo, extra = {}) => s.push({ t, tipo, vol: 0.8, ...extra });
  const entra = (t, forte = false) => { add(t - 0.03, 'pop', { vol: forte ? 0.75 : 0.5 }); if (forte) add(t + 0.02, 'whoosh', { vol: 0.35, dur: 0.4 }); };
  const [T1, T1b, T2, T3, T4, T4b, T5, T6, T7, T8] = TAGLI();
  // 1. 1ª loja já na tela + as outras três
  add(0, 'stamp', { vol: 0.6 }); add(0.03, 'scintilla', { vol: 0.4 });
  add(E.libreria, 'ding', { vol: 0.45, tono: 1.2 }); add(E.spezia, 'pop', { vol: 0.5 }); add(E.mappa0, 'whoosh', { vol: 0.3, dur: 0.4 }); add(E.italia0, 'pop', { vol: 0.45, tono: 1.1 });
  TAGLI().forEach(tc => { add(tc - 0.12, 'whoosh', { vol: 0.42, dur: 0.3 }); add(tc - 0.01, 'boom', { vol: 0.2 }); add(tc, 'pop', { vol: 0.34, tono: 0.7 }); });
  entra(T1 + 0.08, true); add(E.mobili, 'ding', { vol: 0.45, tono: 0.9 }); add(E.teggiano, 'pop', { vol: 0.5, tono: 1.05 });
  entra(T1b + 0.08, true); add(E.ristorante, 'ding', { vol: 0.45, tono: 1.0 }); add(E.formia, 'pop', { vol: 0.5, tono: 1.1 });
  entra(T2 + 0.08, true); add(E.texmex, 'ding', { vol: 0.45, tono: 1.35 }); add(E.chiavari, 'pop', { vol: 0.5, tono: 1.2 });
  // 2. toque e cartão: descrição, Instagram, WhatsApp
  add(E.tocca - 0.05, 'tap', { vol: 0.8 }); add(E.negozio - 0.05, 'pop', { vol: 0.65 }); add(E.negozio, 'whoosh', { vol: 0.3, dur: 0.35 });
  add(E.descrizione - 0.05, 'select', { tono: 1.0 }); add(E.instagram - 0.05, 'select', { tono: 1.2 });
  add(E.pulsante, 'pop', { vol: 0.5, tono: 1.1 }); add(E.whatsapp - 0.1, 'tap', { vol: 0.8 }); add(E.whatsapp, 'notifica', { vol: 0.65 });
  // 3. números reais: contagens rápidas, impactos e as barras subindo
  add(T4 + 0.1, 'vento', { vol: 0.2, dur: 1.4 }); entra(E.insette + 0.1, true);
  for (let t = E.insette + 0.1, k = 0; t < E.milione + 0.3; t += 0.08, k++) add(t, 'tick', { vol: 0.16, tono: 0.9 + 0.6 * k * 0.08 / (E.milione + 0.3 - E.insette) });
  add(E.milione - 0.4, 'riser', { dur: 0.38, vol: 0.45 }); add(E.milione - 0.02, 'boom', { vol: 0.8 }); add(E.milione + 0.3, 'stamp', { vol: 0.85 }); add(E.milione + 0.33, 'coin', { vol: 0.55 });
  add(E.visual, 'scintilla', { vol: 0.4 });
  entra(E.quasi - 0.1);
  for (let t = E.quasi - 0.1, k = 0; t < E.persone + 0.2; t += 0.08, k++) add(t, 'tick', { vol: 0.16, tono: 0.85 + 0.5 * k * 0.08 / (E.persone + 0.3 - E.quasi) });
  add(E.persone + 0.2, 'stamp', { vol: 0.75 }); add(E.persone + 0.25, 'pop', { vol: 0.5, tono: 1.2 });
  entra(E.sito - 0.05, true);
  for (let i = 0; i < 6; i++) add(E.sito + 0.1 + i * 0.12, 'pop', { vol: 0.35, tono: 0.85 + i * 0.08 });
  add(E.settantamila + 0.2, 'stamp', { vol: 0.85 }); add(E.settantamila + 0.25, 'coin', { vol: 0.55, tono: 1.2 }); add(E.visite, 'ding', { vol: 0.4, tono: 1.3 });
  // 4. "hai un'attività?" e o preço
  add(E.hai - 0.05, 'pop', { vol: 0.7, tono: 0.95 }); add(E.attivita, 'tick', { vol: 0.4 });
  entra(E.mettila - 0.05, true); add(E.citta6, 'pop', { vol: 0.45, tono: 1.1 });
  add(E.nove - 0.45, 'silenzio', { dur: 0.4 }); add(E.nove - 0.42, 'riser', { dur: 0.38, vol: 0.5 });
  add(E.nove - 0.06, 'boom', { vol: 0.85 }); add(E.nove - 0.05, 'stamp', { vol: 1 }); add(E.nove + 0.02, 'coin', { vol: 0.6 });
  add(E.novanta, 'ding', { vol: 0.4, tono: 1.25 }); add(E.iva - 0.1, 'pop', { vol: 0.5 }); add(E.iva + 0.25, 'pop', { vol: 0.55, tono: 1.15 }); add(E.iva + 0.5, 'select', { tono: 1.2 });
  // 5. vagas: 5 ocupadas e 1 livre
  entra(T6 + 0.05, true);
  for (let i = 0; i < 6; i++) add(E.posti + 0.1 + i * 0.12, i === 5 ? 'ding' : 'tick', i === 5 ? { vol: 0.55, tono: 1.3 } : { vol: 0.45, tono: 0.8 + i * 0.05 });
  add(E.pochi, 'stamp', { vol: 0.75 });
  // 6. link in bio e volta à 1ª loja (loop)
  entra(T7 + 0.05, true); add(E.bio, 'stamp', { vol: 0.7 }); add(E.bio + 0.1, 'pop', { vol: 0.5, tono: 1.2 });
  add(T8, 'riser', { dur: R.durata - T8, vol: 0.4 }); add(E.mappa9, 'scintilla', { vol: 0.35 });
  return s.sort((a, b) => a.t - b.t);
}

async function preparar(roteiro) {
  R = roteiro; E = R.eventi;
  await Promise.all(['900 104px Nunito', '900 60px Nunito', '800 40px Nunito', '700 30px Nunito'].map(f => document.fonts.load(f)));
  await document.fonts.ready;
  citta = new Citta(mappa, D);
  const azF = lote => (posLote(lote).rot === 0 ? 0 : Math.PI);   // de frente para a porta
  lojas = R.negozi.map(n => {
    const c = D.commerci.find(x => x.nome === n);
    if (!c) throw new Error(`${n} não está no mapa`);
    return { c, pos: citta.posCommercio(c), az: azF(c.lote) };
  });
  punti = criarPontos();
  const [T1, T1b, T2, T3, , , , , , T8] = TAGLI();
  // rótulo de cada loja (a 1ª já na tela no quadro 0 e de novo no fim)
  const janelas = [[t => t < T1 || t >= T8, t => (t < T1 ? -1 : T8), E.libreria], [t => t >= T1 && t < T1b, () => T1 + 0.1, E.mobili],
    [t => t >= T1b && t < T2, () => T1b + 0.1, E.ristorante], [t => t >= T2 && t < T3, () => T2 + 0.1, E.texmex]];
  lojas.forEach(({ c, pos }, i) => {
    const [vis, ini, bat] = janelas[i];
    etichette.push({ el: novaEtichetta(`<div class="box"><b>🏪 ${esc(c.nome)}</b><span>📍 ${esc(c.luogo.nome)}</span>${c.instagram ? `<em>@${esc(c.instagram)}</em>` : ''}</div><div class="freccia"></div>`), pos: { x: pos.x, y: pos.y + LOTE * 1.15, z: pos.z }, vis, ini, bat });
  });
  // cartão do Vistamare, com os dados reais do mapa
  const a = lojas[2].c, sc = $('#scheda');
  sc.querySelector('.logo').style.backgroundImage = a.logo ? `url('${a.logo}')` : '';
  sc.querySelector('.testa').style.background = a.colore;
  sc.querySelector('.testa b').textContent = a.nome;
  sc.querySelector('.corpo p').textContent = a.descrizione;
  sc.querySelector('.corpo small').textContent = `📍 ${a.luogo.nome}${a.tipo ? ` · ${a.tipo}` : ''}`;
  sc.querySelector('.ig').textContent = a.instagram ? `📸 @${a.instagram}` : '';
  $('#barre').innerHTML = R.numeri.giorni.map(([g]) => `<div><i></i><span>${g}</span></div>`).join('');
  montarChaves();
  if (R.copertina) {
    const cp = R.copertina;
    for (const b of [cp.alto, cp.basso].filter(Boolean)) {
      const el = document.createElement('div');
      el.className = 'forte';
      el.style.cssText = `position:absolute;left:20px;right:20px;top:${b.top}px;text-align:center;line-height:1.05;`;
      el.innerHTML = b.linee.map(([txt, cor, size]) => `<div style="font-size:${size}px;-webkit-text-stroke-width:${Math.round(size * 0.19)}px"${cor ? ` class="${cor === true ? 'g' : cor}"` : ''}>${esc(txt)}</div>`).join('');
      document.body.appendChild(el);
    }
    if (cp.senza_titolo) $('#titolo').style.display = 'none';
    $('#fisso').style.display = 'none';
  }
  console.log(`dati ${D.snap.dati_fino} · lojas ${lojas.map(l => `${l.c.nome} (${l.c.luogo.nome}, logo ${l.c.logo ? 'sim' : 'não'})`).join(' · ')}`);
  quadro(0);
  return { durata: R.durata, fps: 30 };
}

iniciar().catch(e => console.error('erro ao carregar', e));
