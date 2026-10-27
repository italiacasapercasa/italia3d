// Reel "lancio" (reel 8) com dados reais: os 2 arranha-céus e as 2 torres do ranking, a eleição de domingo e o
// lançamento da casa decorada (cores de time, ouro, neon, coroa, fogos, presente). As casas decoradas da demonstração
// ficam numa quadra de Roma, sem nenhum @ na tela (ninguém comprou de verdade). Usa o mesmo decori.js do site.
// window.preparar(roteiro), window.quadro(t), window.suoni(); tudo depende só de t.
import * as THREE from 'three';
import { carregar } from '../js/dati.js';
import { Mappa, COR_MAR } from '../js/mappa.js';
import { Citta, DIST_CIDADE, LOTE, posLote } from '../js/citta.js';
import { ALTURA_NIVEL } from '../js/modelli.js';
import { REGOLE } from '../js/regole.js';
import { Decori, SQUADRE } from '../js/decori.js';

const $ = s => document.querySelector(s);
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const suave = s => (s < 0.5 ? 4 * s * s * s : 1 - Math.pow(-2 * s + 2, 3) / 2);
const ressalto = s => { const c = 1.9; return s <= 0 ? 0 : s >= 1 ? 1 : 1 + (c + 1) * Math.pow(s - 1, 3) + c * Math.pow(s - 1, 2); };
const fase = (t, ini, dur) => clamp((t - ini) / dur);
const esc = s => String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
const num = n => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');

let D, mappa, citta, decori, R, E, chaves, punti, scene, etichette = [];
let eddy, matteo, jaco, pietro, quadra;   // { casa, pos }
const GIORNO = { mar: new THREE.Color(COR_MAR), terra: new THREE.Color('#ffffff'), ceu: 2.3, sol: 2.4, ceuC: new THREE.Color('#ffffff'), solC: new THREE.Color('#fff1dc') };
const NOTTE = { mar: new THREE.Color('#1B2E55'), terra: new THREE.Color('#7381A8'), ceu: 1.1, sol: 0.7, ceuC: new THREE.Color('#B9C6FF'), solC: new THREE.Color('#A9BBFF') };
const TRAMONTO = { mar: new THREE.Color('#E58A5C'), terra: new THREE.Color('#FFD2B0'), ceu: 1.9, sol: 2.1, ceuC: new THREE.Color('#FFC6A0'), solC: new THREE.Color('#FF9A55') };

async function iniciar() {
  D = await carregar('video');
  mappa = new Mappa($('#mappa'), D.geo, D.rilievo, D.imagem, { gravacao: true });
  window.preparar = preparar;
  window.quadro = quadro;
  window.suoni = suoni;
}

// dia -> pôr do sol -> noite (k de 0 a 1)
function ceu(k) {
  const a = k < 0.5 ? GIORNO : TRAMONTO, b = k < 0.5 ? TRAMONTO : NOTTE, s = k < 0.5 ? k * 2 : (k - 0.5) * 2;
  const c = a.mar.clone().lerp(b.mar, s);
  mappa.scene.background.copy(c); mappa.scene.fog.color.copy(c); mappa.mar.material.color.copy(c);
  mappa.matTerreno.color.copy(a.terra.clone().lerp(b.terra, s));
  mappa.ceu.intensity = a.ceu + (b.ceu - a.ceu) * s; mappa.ceu.color.copy(a.ceuC.clone().lerp(b.ceuC, s));
  mappa.sol.intensity = a.sol + (b.sol - a.sol) * s; mappa.sol.color.copy(a.solC.clone().lerp(b.solC, s));
  mappa.notte = k > 0.6;
  citta.grupoNotte.visible = k > 0.6;
}

// uma bolinha por cidade; no fim cada uma ganha as cores de um time ("colora l'Italia")
function criarPontos() {
  const n = D.luoghi.length, pos = new Float32Array(n * 3), col = new Float32Array(n * 3), cores = SQUADRE.map(s => new THREE.Color(s.muro));
  cores.push(new THREE.Color('#2E9B55'), new THREE.Color('#E0473C'));   // tricolore também
  D.luoghi.forEach((l, i) => {
    pos.set([l.x, mappa.altura(l.x, l.z) + 0.03, l.z], i * 3);
    let h = 0; for (const ch of l.comune.istat) h = (h * 31 + ch.charCodeAt(0)) | 0;
    cores[Math.abs(h) % cores.length].toArray(col, i * 3);
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('cor', new THREE.BufferAttribute(col, 3));
  const mat = new THREE.ShaderMaterial({
    uniforms: { colora: { value: 0 }, escala: { value: 1920 / (2 * Math.tan(mappa.camera.fov * Math.PI / 360)) } },
    vertexShader: `
      attribute vec3 cor; uniform float colora; uniform float escala; varying vec3 vCor;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vCor = cor;
        gl_PointSize = clamp(0.04 * escala / -mv.z, 9.0, 13.0) * (1.0 + 0.5 * colora);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      uniform float colora; varying vec3 vCor;
      void main() {
        float d = length(gl_PointCoord - 0.5) * 2.0;
        if (d > 1.0) discard;
        gl_FragColor = vec4(d > 0.62 ? vec3(0.08, 0.13, 0.2) : mix(vec3(1.0), vCor, colora), 1.0);
        #include <colorspace_fragment>
      }`,
  });
  const p = new THREE.Points(g, mat);
  p.frustumCulled = false; p.renderOrder = 5;
  mappa.scene.add(p);
  return p;
}

// ---------- quadra de demonstração (Roma): 5 casas de time, 1 de ouro, 1 de presente ----------
function scegliQuadra() {
  const l = D.luoghi.find(x => x.nome === R.vetrina), porLote = new Map(l.casas.map(i => [D.casas[i].lote, D.casas[i]]));
  for (let b = 2; b < 200; b++) {
    const cs = Array.from({ length: 8 }, (_, s) => porLote.get(b * 8 + s));
    if (cs.every(c => c && c.livello <= 7) && cs.filter(c => c.livello >= 1).length >= 4) {
      cs.forEach(c => citta.posCasa(c));
      const x = cs.reduce((a, c) => a + c.x, 0) / 8, z = cs.reduce((a, c) => a + c.z, 0) / 8;
      // fila 1 (s 4..7) virada para +z: as 4 primeiras cores; fila 0 (de costas): 5ª cor, ouro e presente
      return { l, cs, x, z, squadre: [cs[4], cs[5], cs[6], cs[7], cs[3]], oro: cs[1], regalo: cs[0] };
    }
  }
  throw new Error(`sem quadra completa em ${R.vetrina}`);
}
// o que cada casa da demonstração tem no instante t (a cena inteira depende só de t)
const stato = new Map();
function decorazioni(t) {
  const q = quadra, voglio = new Map();
  q.squadre.forEach((c, i) => { if (t >= E[`sq${i}`]) voglio.set(c, { squadra: SQUADRE[i].id, extra: [] }); });
  const ex = ['oro', 'neon', 'corona', 'fuochi'].filter(k => t >= E[k]);
  if (ex.length) voglio.set(q.oro, { squadra: null, extra: ex });
  if (t >= E.regalo) voglio.set(q.regalo, { squadra: null, extra: t >= E.appare ? ['palloncini', 'cornice'] : ['palloncini'] });
  for (const c of [...q.squadre, q.oro, q.regalo]) {
    const s = voglio.get(c) ?? { squadra: null, extra: [] }, k = JSON.stringify(s);
    if (stato.get(c) === k) continue;
    stato.set(c, k);
    decori.disegna(c, { squadra: s.squadra, extra: new Set(s.extra) }, c === q.regalo && s.extra.length ? 'il_tuo_nome' : null);
  }
  for (const a of decori.attive.values()) a.anima(t * 1000);
}

// ---------- câmera ----------
function montarChaves() {
  const b = D.geo.bbox, alt = b.z1 - b.z0, dP = mappa.distPais();
  const paese = { x: (b.x0 + b.x1) / 2, z: (b.z0 + b.z1) / 2 - alt * 0.07, dist: dP, az: 0, giu: 0 };
  const P = (o, k = {}) => ({ x: o.x, z: o.z, ...k });
  const meio = (a, c, k) => ({ x: (a.x + c.x) / 2, z: (a.z + c.z) / 2, ...k });
  const azF = c => (posLote(c.lote).rot === 0 ? 0 : Math.PI);   // de frente para a porta da casa
  const q = quadra, qa = azF(q.squadre[0]), qo = azF(q.oro);
  const sq = { x: q.squadre.reduce((a, c) => a + c.x, 0) / 5, z: q.squadre.reduce((a, c) => a + c.z, 0) / 5 };   // centro das 5 casas de time
  const lista = [
    [0, { ...paese, dist: dP * 1.08 }],
    [E.italia, { ...paese, dist: dP * 0.96 }],
    [E.gratta, P(eddy.pos, { dist: 1.0, az: 0.5, giu: 0.1 })],
    [E.eddy, P(eddy.pos, { dist: 0.88, az: 0.85, giu: 0.12 })],
    [E.masseria, P(eddy.pos, { dist: 0.95, az: 1.25, giu: 0.1 })],
    [E.secondo + 0.25, P(matteo.pos, { dist: 0.95, az: 1.5, giu: 0.1 })],
    [E.melito, P(matteo.pos, { dist: 0.85, az: 1.9, giu: 0.12 })],
    [E.dietro + 0.55, meio(matteo.pos, jaco.pos, { dist: 380, az: 1.0, giu: 0 })],
    [E.jaco, P(jaco.pos, { dist: 0.62, az: 0.4, giu: -0.08 })],
    [(E.jaco + E.pietro) / 2 + 0.2, meio(jaco.pos, pietro.pos, { dist: 90, az: 0.6, giu: 0 })],
    [E.pietro, P(pietro.pos, { dist: 0.62, az: 0.8, giu: -0.08 })],
    [E.separati, P(pietro.pos, { dist: 0.75, az: 1.1, giu: 0.15 })],
    [E.domenica, { ...paese, dist: dP * 0.98, az: 0, giu: 0 }],
    [E.ma, { ...paese, dist: dP * 0.94 }],
    [E.novita, P(q, { dist: 0.55, az: qa + 0.25, giu: 0.04 })],
    [E.sq0 - 0.2, P(sq, { dist: 0.6, az: qa + 0.25, giu: 0.06 })],
    [E.sq4 + 0.6, P(sq, { dist: 0.62, az: qa + 0.7, giu: 0.06 })],
    [E.oro, P(q.oro.pos, { dist: 0.3, az: qo + 0.35, giu: 0.06 })],
    [E.corona, P(q.oro.pos, { dist: 0.3, az: qo + 0.75, giu: 0.06 })],
    [E.fuochi, P(q.oro.pos, { dist: 0.42, az: qo + 1.0, giu: 0.16 })],
    [E.regalo, P(q.regalo.pos, { dist: 0.33, az: qo + 0.2, giu: 0.1 })],
    [E.nome, P(q.regalo.pos, { dist: 0.3, az: qo - 0.25, giu: 0.1 })],
    [E.provala, P(q, { dist: 0.6, az: qo - 0.45, giu: 0.25 })],
    [E.nonda, P(q, { dist: 0.65, az: qo - 0.6, giu: 0.2 })],
    [E.vince, P(eddy.pos, { dist: 1.05, az: 2.4, giu: 0.1 })],
    [E.scrivi, { ...paese, dist: dP * 0.98, az: 0, giu: 0 }],
    [E.vediamo, { ...paese, dist: dP * 0.96 }],
    [R.durata, { ...paese, dist: dP * 1.04 }],
  ];
  let ant = {};
  chaves = lista.sort((a, c) => a[0] - c[0]).map(([t, k]) => { ant = { ...ant, ...k }; return { t, k: { ...ant } }; });
}
function camera(t) {
  let i = 0;
  while (i < chaves.length - 2 && t >= chaves[i + 1].t) i++;
  const a = chaves[i], b = chaves[Math.min(i + 1, chaves.length - 1)];
  const s = b.t > a.t ? suave(clamp((t - a.t) / (b.t - a.t))) : 1;
  const A = a.k, B = b.k, l = (p, q) => p + (q - p) * s;
  const dist = Math.exp(l(Math.log(A.dist), Math.log(B.dist)));
  const dxz = Math.hypot(B.x - A.x, B.z - A.z);
  const fecha = B.dist < A.dist;
  const sxz = dxz > 20 ? (fecha ? suave(clamp((t - a.t) / ((b.t - a.t) * 0.55))) : suave(clamp((t - a.t - (b.t - a.t) * 0.45) / ((b.t - a.t) * 0.55)))) : s;
  // tremida nos impactos: grattacielo, novità, fuochi
  const tremor = [[E.gratta, 0.5], [E.novita, 0.45], [E.fuochi, 0.35]].reduce((v, [ti, d]) => v + (t >= ti && t < ti + d ? 0.012 * (1 - (t - ti) / d) * Math.sin((t - ti) * 70) : 0), 0);
  const az = l(A.az, B.az) + tremor, giu = l(A.giu, B.giu), x = A.x + (B.x - A.x) * sxz, z = A.z + (B.z - A.z) * sxz;
  mappa.az = az; mappa.dist = dist * (1 + tremor);
  mappa.alvo.x = x - Math.sin(az) * giu * dist;
  mappa.alvo.z = z - Math.cos(az) * giu * dist;
  mappa.atualizarCamera();
  return dist;
}

// ---------- textos ----------
function projetar(x, y, z) { const p = new THREE.Vector3(x, y, z).project(mappa.camera); return { x: (p.x + 1) / 2 * 1080, y: (1 - p.y) / 2 * 1920, ok: p.z < 1 && p.z > -1 }; }
function novaEtichetta(html, cls = '') {
  const el = document.createElement('div');
  el.className = cls; el.innerHTML = html;
  $('#etichette').appendChild(el);
  return el;
}
function legenda(t) {
  const f = R.frasi.find(x => t >= x.ini && t < x.fim);
  const html = f && !R.copertina ? f.linee.map(l => l.filter(w => t >= w[1] && w[0]).map(w => w[2] ? `<span class="g">${esc(w[0])}</span>` : esc(w[0])).join(' ')).filter(Boolean).join('<br>') : '';
  const el = $('#sott'); if (el.innerHTML !== html) el.innerHTML = html;
}
function mostrar(el, t, ini, fim, sobe = 30) {
  const ent = ressalto(fase(t, ini, 0.32)), sai = fase(t, fim - 0.25, 0.25), vis = t >= ini && t < fim;
  el.style.opacity = vis ? String(1 - sai) : '0';
  if (vis) el.style.transform = `translateY(${(1 - Math.min(1, ent)) * sobe - sai * 40}px) scale(${0.85 + 0.15 * ent})`;
}
function chip(el, t, ini, fim) {
  const s = ressalto(fase(t, ini, 0.32)), sai = fase(t, fim - 0.25, 0.25);
  el.style.opacity = t >= ini && t < fim ? String(1 - sai) : '0';
  el.style.transform = `translateX(-50%) scale(${s}) rotate(${-3 + 3 * s}deg)`;
}
function cabecalho(t) {
  let k = 0;
  while (k < scene.length - 1 && t >= scene[k + 1][0]) k++;
  const [ini, r1, r2, c1, c2] = scene[k];
  if ($('#r1').innerHTML !== r1) $('#r1').innerHTML = r1;
  if ($('#r2').innerHTML !== r2) $('#r2').innerHTML = r2;
  $('#r1').className = c1 ?? ''; $('#r2').className = c2 ?? '';
  $('#righe').style.transform = `scale(${ini > 0 ? 0.5 + 0.5 * ressalto(fase(t, ini, 0.3)) : 1})`;
  $('#righe').style.opacity = r1 || r2 ? '1' : '0';
}

function quadro(t) {
  const dist = camera(t);
  punti.visible = dist > DIST_CIDADE * 0.55;
  punti.material.uniforms.colora.value = suave(fase(t, E.colora - 0.2, 0.9));
  // ouro de dia; neon e coroa no pôr do sol; fogos de noite; amanhece no presente
  const k = suave(fase(t, E.neon - 0.1, E.fuochi - E.neon + 0.1)) * (1 - suave(fase(t, E.regalo - 0.3, 0.7)));
  ceu(k);
  decorazioni(t);
  const velo = $('#velo');
  const fl = Math.max(t >= E.gratta ? 0.7 * (1 - fase(t, E.gratta, 0.3)) : 0, t >= E.novita ? 0.85 * (1 - fase(t, E.novita, 0.35)) : 0, t >= E.oro ? 0.5 * (1 - fase(t, E.oro, 0.3)) : 0);
  velo.style.opacity = String(fl);
  velo.style.background = t >= E.oro ? '#FFE08A' : '#FFFFFF';
  cabecalho(t);
  for (const e of etichette) {
    const vis = t >= e.ini && t < e.fim;
    if (!vis) { e.el.style.opacity = '0'; continue; }
    const pos = e.pos(), p = projetar(pos.x, pos.y, pos.z);
    const s = ressalto(fase(t, e.ini, e.dur ?? 0.32)) * (1 - fase(t, e.fim - 0.2, 0.2));
    e.el.style.opacity = p.ok ? '1' : '0';
    e.el.style.transform = `translate(${p.x - e.el.offsetWidth / 2}px, ${p.y - e.el.offsetHeight}px) scale(${s})`;
  }
  chip($('#chip-passo'), t, E.passo - 0.05, E.secondo);
  // as duas torres: barras correm e o placar mostra a diferença
  mostrar($('#torri'), t, E.separati - 0.1, E.domenica);
  const kb = suave(fase(t, E.separati, 0.9));
  document.querySelectorAll('#torri .barra i').forEach(b => { b.style.width = `${b.dataset.pct * kb}%`; });
  chip($('#chip-pochi'), t, E.pochi, E.domenica);
  // eleição: top 3 real
  mostrar($('#pres'), t, E.domenica, E.ma);
  $('#pres .ore').classList.toggle('lampo', t >= E.nove && t < E.nove + 0.9);
  $('#pres h2').classList.toggle('lampo', t >= E.pres && t < E.pres + 0.8);
  const kp = suave(fase(t, E.classifica - 0.3, 0.9));
  document.querySelectorAll('#pres .barra i').forEach(b => { b.style.width = `${b.dataset.pct * kp}%`; });
  // NOVITÀ: carimbo
  const nv = $('#novita'), sn = ressalto(fase(t, E.novita, 0.3));
  nv.style.opacity = t >= E.novita && t < E.adesso ? String(1 - fase(t, E.adesso - 0.25, 0.25)) : '0';
  nv.style.transform = `scale(${t < E.novita + 0.1 ? 1.4 - 0.4 * sn : 1 + 0.03 * Math.sin((t - E.novita) * 8)}) rotate(-6deg)`;
  // o site: toque no botão, abre o painel
  const ui = $('#ui');
  mostrar(ui, t, E.provala - 0.1, E.nonda);
  const carta = ui.querySelector('.carta'), kc = ressalto(fase(t, E.provala + 0.45, 0.3));
  carta.style.opacity = t >= E.provala + 0.45 ? '1' : '0';
  carta.style.transform = `scale(${0.6 + 0.4 * kc})`;
  const tc = $('#tocco'), kt = fase(t, E.provala + 0.2, 0.45);
  if (t >= E.provala - 0.1) { const r = ui.querySelector('.pill').getBoundingClientRect(); tc.style.left = `${r.left + r.width / 2}px`; tc.style.top = `${r.top + r.height / 2}px`; }
  tc.style.opacity = kt > 0 && kt < 1 ? String(1 - kt) : '0';
  tc.style.transform = `scale(${0.4 + kt})`;
  chip($('#chip-gratis'), t, E.gratis - 0.05, E.nonda);
  chip($('#chip-piace'), t, E.paghi - 0.05, E.nonda);
  chip($('#chip-punti'), t, E.nonda - 0.05, E.scrivi);
  chip($('#chip-gioca'), t, E.vince - 0.05, E.scrivi);
  // chamada final + corações dos times
  const cta = $('#cta').children;
  mostrar(cta[0], t, E.scrivi - 0.05, E.vediamo, 20);
  mostrar(cta[1], t, E.cuori - 0.1, E.vediamo, 20);
  cta[2].style.opacity = t >= E.cuori && t < E.vediamo ? String(1 - fase(t, E.vediamo - 0.25, 0.25)) : '0';
  [...cta[2].children].forEach((c, i) => { c.style.transform = `scale(${ressalto(fase(t, E.cuori + 0.1 + i * 0.12, 0.3))})`; });
  mostrar(cta[3], t, E.litalia + 0.2, R.durata + 1, 20);
  legenda(t);
  mappa.renderer.render(mappa.scene, mappa.camera);
  return true;
}

// efeitos sonoros (o mixador strumenti/suoni.mjs sintetiza cada tipo)
function suoni() {
  const s = [], add = (t, tipo, extra = {}) => s.push({ t, tipo, vol: 0.8, ...extra });
  add(0.02, 'ding', { vol: 0.45, tono: 1.3 }); add(E.due, 'stamp', { vol: 0.8 });
  add(E.italia - 0.1, 'whoosh', { vol: 0.9, dur: 1.2, giu: true });
  add(E.gratta - 0.05, 'boom'); add(E.gratta + 0.05, 'stamp', { vol: 0.6 });
  add(E.eddy - 0.05, 'select', { tono: 1.1 }); add(E.eddy + 0.05, 'pop', { vol: 0.6 });
  add(E.passo - 0.05, 'pop', { tono: 0.9 }); add(E.masseria, 'ding', { vol: 0.5, tono: 1.2 });
  add(E.secondo, 'whoosh', { vol: 0.6, dur: 1.0 }); add(E.matteo - 0.05, 'select', { tono: 1.0 }); add(E.matteo + 0.05, 'pop', { vol: 0.6 });
  add(E.dietro, 'whoosh', { vol: 0.9, dur: 1.4 });
  add(E.jaco - 0.05, 'select', { tono: 1.15 }); add(E.jaco + 0.05, 'pop', { vol: 0.5 });
  add((E.jaco + E.pietro) / 2 - 0.3, 'whoosh', { vol: 0.6, dur: 1.0 });
  add(E.pietro - 0.05, 'select', { tono: 1.25 }); add(E.pietro + 0.05, 'pop', { vol: 0.5 });
  add(E.separati - 0.1, 'rullo', { dur: E.pochi - E.separati + 0.1 }); add(E.pochi, 'stamp', { vol: 1 });
  add(E.domenica - 0.1, 'whoosh', { vol: 0.8, dur: 1.4 }); add(E.domenica + 0.05, 'pop', { tono: 0.8 });
  add(E.nove, 'ding', { vol: 0.55, tono: 1.3 }); add(E.classifica - 0.2, 'tick', { vol: 0.4 }); add(E.pres, 'flap', { vol: 0.75 });
  add(E.ma - 0.05, 'whoosh', { vol: 0.5, dur: 1.0, giu: true });
  add(E.novita - 0.05, 'boom', { vol: 0.9 }); add(E.novita, 'stamp', { vol: 1 }); add(E.novita + 0.08, 'vento', { dur: 1.2 });
  add(E.adesso - 0.05, 'pop', { tono: 0.9 }); add(E.colori, 'pop', { tono: 1.05 }); add(E.squadra, 'ding', { vol: 0.5, tono: 1.15 });
  for (let i = 0; i < 5; i++) { add(E[`sq${i}`] - 0.02, 'select', { tono: 0.9 + i * 0.1 }); add(E[`sq${i}`] + 0.06, 'pop', { vol: 0.55, tono: 0.8 + i * 0.12 }); }
  add(E.oppure - 0.05, 'whoosh', { vol: 0.6, dur: 0.9 });
  add(E.oro - 0.03, 'coin'); add(E.oro + 0.05, 'ding', { vol: 0.55, tono: 1.5 });
  for (let k = 0; k < 5; k++) add(E.oro + 0.12 + k * 0.08, 'tick', { vol: 0.35, tono: 1.6 + k * 0.1 });
  add(E.neon - 0.03, 'select', { tono: 1.4 }); add(E.neon + 0.06, 'ding', { vol: 0.4, tono: 1.8 });
  add(E.corona - 0.03, 'flap', { vol: 0.6 }); add(E.corona + 0.05, 'ding', { vol: 0.5, tono: 1.3 });
  add(E.fuochi - 0.05, 'boom', { vol: 0.75 });
  for (let k = 0; k < 7; k++) add(E.fuochi + 0.15 + k * 0.22, 'pop', { vol: 0.45, tono: 0.7 + ((k * 3) % 5) * 0.12 });
  add(E.regalo - 0.1, 'whoosh', { vol: 0.6, dur: 1.0 });
  for (let k = 0; k < 5; k++) add(E.regalo + 0.05 + k * 0.1, 'pop', { vol: 0.4, tono: 1.0 + k * 0.1 });
  add(E.appare - 0.05, 'select', { tono: 1.2 }); add(E.nome, 'ding', { vol: 0.5, tono: 1.25 });
  add(E.provala - 0.1, 'pop', { tono: 0.95 }); add(E.provala + 0.2, 'tap'); add(E.provala + 0.45, 'pop', { tono: 1.1 });
  add(E.gratis - 0.05, 'stamp', { vol: 0.85 }); add(E.paghi - 0.05, 'pop', { tono: 1.0 }); add(E.piace, 'coin', { vol: 0.5 });
  add(E.nonda - 0.05, 'stamp', { vol: 0.8 }); add(E.vince - 0.05, 'whoosh', { vol: 0.5, dur: 0.8 }); add(E.vince + 0.05, 'ding', { vol: 0.55, tono: 1.2 });
  add(E.scrivi - 0.1, 'whoosh', { vol: 0.75, dur: 1.4, giu: true }); add(E.scrivi, 'pop', { tono: 0.9 }); add(E.cuori - 0.1, 'pop', { tono: 1.05 });
  for (let i = 0; i < 6; i++) add(E.cuori + 0.1 + i * 0.12, 'pop', { vol: 0.45, tono: 0.9 + i * 0.1 });
  add(E.vediamo - 0.05, 'whoosh', { vol: 0.5, dur: 1.2 });
  add(E.colora - 0.2, 'rullo', { dur: 0.6 });
  for (let k = 0; k < 8; k++) add(E.colora + k * 0.07, 'pop', { vol: 0.35, tono: 0.8 + k * 0.08 });
  add(E.litalia + 0.2, 'stamp', { vol: 0.8 }); add(E.litalia + 0.6, 'ding', { vol: 0.5 });
  return s.sort((a, b) => a.t - b.t);
}

async function preparar(roteiro) {
  R = roteiro; E = R.eventi;
  await Promise.all(['900 104px Nunito', '900 60px Nunito', '800 40px Nunito', '700 30px Nunito'].map(f => document.fonts.load(f)));
  await document.fonts.ready;
  citta = new Citta(mappa, D);
  decori = new Decori(D, mappa, citta, null);
  punti = criarPontos();
  const casa = conta => { const c = D.porConta.get(conta); if (!c) throw new Error(`@${conta} não está no mapa`); return { casa: c, pos: citta.posCasa(c) }; };
  [eddy, matteo, jaco, pietro] = ['eddy_napolitano', '_matteo.guerra_', 'jacolama_', 'pietrogagliardini_'].map(casa);
  quadra = scegliQuadra();
  quadra.oro.pos = citta.posCasa(quadra.oro); quadra.regalo.pos = citta.posCasa(quadra.regalo);
  const liv = REGOLE.livelli, nome = c => esc(D.luoghi[c.luogo].nome).toUpperCase();
  const topo = c => ({ x: c.pos.x, y: c.pos.y + ALTURA_NIVEL[c.casa.livello] * LOTE + LOTE * 0.35, z: c.pos.z });
  const cartello = (o, emo, ini, fim, extra = '') => etichette.push({
    el: novaEtichetta(`<div class="box"><b>${emo} @${esc(o.casa.conta)}</b><span>${nome(o.casa)} · ${num(o.casa.tot)} PUNTI</span>${extra}</div><div class="freccia"></div>`, 'cartello'),
    pos: () => topo(o), ini, fim,
  });
  cartello(eddy, '🏙', E.eddy - 0.05, E.secondo, `<small>${esc(liv[eddy.casa.livello].nome.toUpperCase())} · 1° IN CLASSIFICA</small>`);
  cartello(matteo, '🏙', E.matteo - 0.05, E.dietro + 0.3, `<small>${esc(liv[matteo.casa.livello].nome.toUpperCase())}</small>`);
  cartello(jaco, '🗼', E.jaco - 0.05, (E.jaco + E.pietro) / 2);
  cartello(pietro, '🗼', E.pietro - 0.05, E.separati - 0.1);
  const masseria = liv.findIndex(n => n.nome === 'Masseria'), manca = liv[masseria].min - eddy.casa.tot;
  $('#chip-passo').innerHTML = manca > 0 ? `A <span class="g">${num(manca)}</span> PUNTI DALLA MASSERIA` : '<span class="g">ARRIVA LA MASSERIA!</span>';
  // as duas torres, com a diferença real de pontos
  const [t1, t2] = [jaco, pietro].sort((a, c) => c.casa.tot - a.casa.tot), max = t1.casa.tot;
  $('#torri').innerHTML = `<h2>🗼 LE DUE TORRI</h2>${[t1, t2].map(o => `<div class="riga"><div class="em">🗼</div><div class="quem"><b>@${esc(o.casa.conta)}</b><small>${esc(D.luoghi[o.casa.luogo].nome)}</small><div class="barra"><i data-pct="${(100 * o.casa.tot / max).toFixed(1)}"></i></div></div><div class="pts">${num(o.casa.tot)}</div></div>`).join('')}`;
  $('#chip-pochi').innerHTML = `SOLO ${num(t1.casa.tot - t2.casa.tot)} PUNTI DI DISTANZA!`;
  // eleição: top 3 do mandato (pontos reais)
  const top = D.ranking.slice(0, 3), maxS = top[0].sett;
  $('#pres').innerHTML = `<h2>🏛️ PRIMO PRESIDENTE<br>DEL CONSIGLIO</h2><div class="quando">domenica 1 novembre alle <span class="ore">21:00</span></div>
    ${top.map((c, i) => `<div class="riga"><div class="pos">${i + 1}</div><div class="quem"><b>@${esc(c.conta)}</b><small>${esc(D.luoghi[c.luogo].nome)}</small><div class="barra"><i data-pct="${(100 * c.sett / maxS).toFixed(1)}"></i></div></div><div class="pts">${num(c.sett)}</div></div>`).join('')}`;
  // nome do time em cima de cada casa da demonstração (sem @)
  quadra.squadre.forEach((c, i) => {
    const sq = SQUADRE[i];
    etichette.push({
      el: novaEtichetta(`<div class="box" style="background:linear-gradient(90deg,${sq.muro} 0 50%,${sq.tetto} 50%)"><b>${esc(sq.nome.toUpperCase())}</b></div><div class="freccia"></div>`, 'cartello sq'),
      pos: () => ({ x: c.x, y: c.y + ALTURA_NIVEL[c.livello] * LOTE + LOTE * 0.5, z: c.z }), ini: E[`sq${i}`] - 0.02, fim: E.oppure,
    });
  });
  // presente: rótulo como no site, com nomes de exemplo
  const rg = quadra.regalo;
  etichette.push({
    el: novaEtichetta('<div class="box"><b>@il_tuo_amico</b><small>🎁 da @il_tuo_nome</small></div><div class="freccia"></div>', 'cartello regalo'),
    pos: () => ({ x: rg.x, y: rg.y + (ALTURA_NIVEL[rg.livello] * 0.75 + 0.75) * LOTE, z: rg.z }), ini: E.appare - 0.05, fim: E.provala,
  });
  montarChaves();
  scene = [
    [0, 'SOLO <span class="g">2 PERSONE</span>', 'IN TUTTA ITALIA…'],
    [E.gratta, '🏙 HANNO UN', '<span class="g">GRATTACIELO!</span>'],
    [E.primo, '', ''],
    [E.dietro, 'SUBITO DIETRO', '<span class="g">DUE TORRI 🗼</span>'],
    [E.jaco, '', ''],
    [E.domenica, '', ''],
    [E.ma, 'MA OGGI…', ''],
    [E.novita, '', ''],
    [E.adesso, 'DA ADESSO', '<span class="g">LA TUA CASA…</span>'],
    [E.colori, 'COI COLORI DELLA', '<span class="g">TUA SQUADRA ⚽</span>'],
    [E.sq0 - 0.05, '', ''],
    [E.oppure, 'OPPURE…', ''],
    [E.oro, '✨ TUTTA', '<span class="g">D’ORO</span>', '', 'grande'],
    [E.neon, '🌈 NEON', ''],
    [E.corona, '👑 CORONA', ''],
    [E.fuochi, '🎆 FUOCHI', '<span class="g">D’ARTIFICIO!</span>'],
    [E.regalo, '🎁 FAI UN REGALO', '<span class="r">A UN AMICO</span>'],
    [E.appare, 'SULLA SUA CASA', '<span class="g">IL TUO NOME</span>'],
    [E.provala, '', ''],
    [E.scrivi - 0.1, '', ''],
    [E.vediamo, 'VEDIAMO QUALE SQUADRA', '<span class="g">COLORA L’ITALIA!</span>'],
  ];
  // capa: título grande no lugar da legenda
  if (R.copertina) {
    const cp = R.copertina;
    const el = document.createElement('div');
    el.className = 'forte';
    el.style.cssText = `position:absolute;left:30px;right:30px;top:${cp.titolo_top}px;text-align:center;line-height:1.05;`;
    el.innerHTML = cp.linee.map(([txt, cor, size]) => `<div style="font-size:${size}px;-webkit-text-stroke-width:${Math.round(size * 0.19)}px"${cor ? ` class="${cor === true ? 'g' : cor}"` : ''}>${esc(txt)}</div>`).join('');
    document.body.appendChild(el);
    if (cp.senza_testa) $('#testa').style.display = 'none';
  }
  console.log(`${D.casas.length} case · eddy ${eddy.casa.tot} (${liv[eddy.casa.livello].nome}) · matteo ${matteo.casa.tot} · torri ${t1.casa.conta} ${t1.casa.tot} / ${t2.casa.conta} ${t2.casa.tot} · top ${top.map(c => `@${c.conta} ${c.sett}`).join(', ')} · quadra ${quadra.l.nome} lotti ${quadra.cs[0].lote}-${quadra.cs[7].lote}`);
  quadro(0);
  return { durata: R.durata, fps: 30 };
}

iniciar().catch(e => console.error('erro ao carregar', e));
