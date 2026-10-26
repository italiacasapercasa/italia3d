// Reel "L'Italia di notte" com dados reais: o dia vira noite, as casas acendem, cidade de perto com janelas e postes,
// voo de Bolzano a Palermo, uma região "al buio", a casa de EXEMPLO acendendo e as regiões mais acesas.
// window.preparar(roteiro), window.quadro(t); tudo depende só de t.
import * as THREE from 'three';
import { carregar } from '../js/dati.js';
import { Mappa, COR_MAR } from '../js/mappa.js';
import { Citta, posLote, DIST_CIDADE, LOTE } from '../js/citta.js';
import { ALTURA_NIVEL } from '../js/modelli.js';

const $ = s => document.querySelector(s);
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const suave = s => (s < 0.5 ? 4 * s * s * s : 1 - Math.pow(-2 * s + 2, 3) / 2);
const ressalto = s => { const c = 1.9; return s <= 0 ? 0 : s >= 1 ? 1 : 1 + (c + 1) * Math.pow(s - 1, 3) + c * Math.pow(s - 1, 2); };
const fase = (t, ini, dur) => clamp((t - ini) / dur);
const esc = s => String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
const num = n => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');

let D, mappa, citta, R, E, chaves, luci, casaEx, luogoEx, regBuio, centroPersone, etichette = [];
const GIORNO = { mar: new THREE.Color(COR_MAR), terra: new THREE.Color('#ffffff'), ceu: 2.3, sol: 2.4, ceuC: new THREE.Color('#ffffff'), solC: new THREE.Color('#fff1dc') };
const NOTTE = { mar: new THREE.Color('#1E3560'), terra: new THREE.Color('#7C8BB0'), ceu: 1.15, sol: 0.75, ceuC: new THREE.Color('#B9C6FF'), solC: new THREE.Color('#A9BBFF') };

async function iniciar() {
  D = await carregar('video');
  mappa = new Mappa($('#mappa'), D.geo, D.rilievo, D.imagem, { gravacao: true });
  window.preparar = preparar;
  window.quadro = quadro;
}

// mistura dia -> noite (k de 0 a 1)
function notte(k) {
  const c = GIORNO.mar.clone().lerp(NOTTE.mar, k);
  mappa.scene.background.copy(c); mappa.scene.fog.color.copy(c); mappa.mar.material.color.copy(c);
  mappa.matTerreno.color.copy(GIORNO.terra.clone().lerp(NOTTE.terra, k));
  mappa.ceu.intensity = GIORNO.ceu + (NOTTE.ceu - GIORNO.ceu) * k; mappa.ceu.color.copy(GIORNO.ceuC.clone().lerp(NOTTE.ceuC, k));
  mappa.sol.intensity = GIORNO.sol + (NOTTE.sol - GIORNO.sol) * k; mappa.sol.color.copy(GIORNO.solC.clone().lerp(NOTTE.solC, k));
  citta.grupoNotte.visible = k > 0.55;
}

// uma luz quente por casa, acendendo em ordem aleatória (uniform "lim")
function criarLuci() {
  const n = D.casas.length, pos = new Float32Array(n * 3), ord = new Float32Array(n);
  D.casas.forEach((casa, i) => {
    const l = D.luoghi[casa.luogo], q = posLote(casa.lote), x = l.x + q.x, z = l.z + q.z;
    pos.set([x, mappa.altura(x, z) + 0.05, z], i * 3);
    const s = Math.sin(i * 91.7 + 3.1) * 43758.5453; ord[i] = s - Math.floor(s);
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('ord', new THREE.BufferAttribute(ord, 1));
  const mat = new THREE.ShaderMaterial({
    uniforms: { lim: { value: 0 }, escala: { value: 1920 / (2 * Math.tan(mappa.camera.fov * Math.PI / 360)) } },
    vertexShader: `attribute float ord; uniform float lim; uniform float escala;
      void main() { vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = ord > lim ? 0.0 : clamp(0.3 * escala / -mv.z, 11.0, 26.0); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `void main() { float d = length(gl_PointCoord - 0.5) * 2.0; if (d > 1.0) discard; float k = smoothstep(1.0, 0.0, d); gl_FragColor = vec4(vec3(1.0, 0.78, 0.38) * (k * k * 1.6 + smoothstep(0.35, 0.0, d)), 1.0); }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const p = new THREE.Points(g, mat);
  p.frustumCulled = false; p.renderOrder = 6;
  mappa.scene.add(p);
  return p;
}

// casa de exemplo (não existe no jogo): ocupa o próximo lote livre só neste vídeo
function inserirExemplo() {
  luogoEx = D.luoghi.find(l => l.nome === R.esempio.citta);
  const i = D.casas.length;
  casaEx = { i, conta: R.esempio.conta, luogo: luogoEx.id, lote: luogoEx.lotti, ts: Date.now(), tot: 15, sett: 15, fiamme: 0, fonti: [10, 5, 0, 0, 0, 0, 0], serie: 1, livello: 3, carica: null };
  D.casas.push(casaEx); luogoEx.casas.push(i); luogoEx.lotti += 1;
}

// ---------- câmera ----------
const LL = (lat, lon) => { const P = D.geo.proj; return { x: (lon - P.LON0) * P.KX, z: (P.LAT0 - lat) * P.KZ }; };
function montarChaves() {
  const b = D.geo.bbox, alt = b.z1 - b.z0, dP = mappa.distPais();
  const paese = { x: (b.x0 + b.x1) / 2, z: (b.z0 + b.z1) / 2 - alt * 0.07, dist: dP, az: 0, giu: 0 };
  const nap = { x: luogoEx.x, z: luogoEx.z, giu: 0.12 }, pe = citta.posCasa(casaEx);
  const bz = LL(46.5, 11.35), pa = LL(38.12, 13.36);
  const lista = [
    [0, { ...paese, dist: dP * 1.03 }],
    [E.accende + 1.2, { ...paese, dist: dP * 0.96 }],
    [E.citta + 1.7, { ...nap, dist: 1.5, az: 0.55 }],
    [E.persona - 0.2, { ...centroPersone, dist: 0.5, az: 0.8, giu: 0.05 }],
    [E.paese - 0.05, { dist: 0.46, az: 0.9 }],
    [E.paese + 1.0, { ...paese, dist: dP * 0.9 }],
    [E.bolzano + 0.2, { ...bz, dist: 330, az: 0, giu: 0 }],
    [E.palermo + 0.6, { ...pa, dist: 330, az: 0 }],
    [E.buio + 1.3, { x: regBuio.lx, z: regBuio.lz, dist: Math.max(140, regBuio.ext * 2.6), az: 0.2, giu: 0.1 }],
    [E.accendi - 0.1, { dist: Math.max(140, regBuio.ext * 2.6) * 0.92, az: 0.25 }],
    [E.commento + 1.4, { x: pe.x, z: pe.z, dist: 0.42, az: 0.7, giu: 0.24 }],
    [E.regioni - 0.1, { dist: 0.46, az: 0.85 }],
    [E.regioni + 1.6, { ...paese, giu: -0.05 }],
    [R.durata, { ...paese, dist: dP * 1.06, giu: -0.05 }],
  ];
  let ant = {};
  chaves = lista.map(([t, k]) => { ant = { ...ant, ...k }; return { t, k: { ...ant } }; });
}
function camera(t) {
  let i = 0;
  while (i < chaves.length - 2 && t >= chaves[i + 1].t) i++;
  const a = chaves[i], b = chaves[Math.min(i + 1, chaves.length - 1)];
  const s = b.t > a.t ? suave(clamp((t - a.t) / (b.t - a.t))) : 1;
  const A = a.k, B = b.k, l = (p, q) => p + (q - p) * s;
  const dxz = Math.hypot(B.x - A.x, B.z - A.z), bump = 0.35 * Math.max(0, Math.log(dxz / Math.max(A.dist, B.dist) + 1));
  const sxz = dxz > 20 ? suave(clamp((t - a.t) / ((b.t - a.t) * 0.55))) : s;
  const dist = Math.exp(l(Math.log(A.dist), Math.log(B.dist)) + bump * Math.sin(Math.PI * s));
  const az = l(A.az, B.az), giu = l(A.giu, B.giu), x = A.x + (B.x - A.x) * sxz, z = A.z + (B.z - A.z) * sxz;
  mappa.az = az; mappa.dist = dist;
  mappa.alvo.x = x - Math.sin(az) * giu * dist; mappa.alvo.z = z - Math.cos(az) * giu * dist;
  mappa.atualizarCamera();
  return dist;
}

// ---------- textos ----------
function projetar(x, y, z) { const p = new THREE.Vector3(x, y, z).project(mappa.camera); return { x: (p.x + 1) / 2 * 1080, y: (1 - p.y) / 2 * 1920, ok: p.z < 1 }; }
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
  const el = $('#sott'); if (el.innerHTML !== html) el.innerHTML = html;
}
function mostrar(el, t, ini, fim) {
  const ent = ressalto(fase(t, ini, 0.3)), sai = fase(t, fim - 0.2, 0.2), vis = t >= ini && t < fim;
  el.style.opacity = vis ? String(1 - sai) : '0';
  if (vis) el.style.transform = `translateY(${(1 - Math.min(1, ent)) * 20 - sai * 40}px) scale(${0.85 + 0.15 * ent})`;
}

function quadro(t) {
  const k = suave(fase(t, E.notte, 1.4));
  notte(k);
  const dist = camera(t);
  luci.visible = dist > DIST_CIDADE * 0.55 && k > 0.3;
  luci.material.uniforms.lim.value = clamp((t - (E.accende - 0.4)) / 1.9);
  // contador de luzes no cabeçalho, durante o voo pelo país
  const lc = $('#luci'), cl = fase(t, E.paese, 0.3) * (1 - fase(t, E.buio - 0.2, 0.2));
  lc.style.opacity = String(cl);
  lc.innerHTML = `✨ <span class="g">${num(D.casas.length - 1)}</span> LUCI`;
  for (const e of etichette) {
    const vis = t >= e.ini && t < e.fim;
    if (!vis) { e.el.style.opacity = '0'; continue; }
    const c = e.casa, p = projetar(c.x, c.y + ALTURA_NIVEL[c.livello] * LOTE + 0.004, c.z), s = ressalto(fase(t, e.ini, 0.32)) * (1 - fase(t, e.fim - 0.2, 0.2));
    e.el.style.opacity = p.ok ? '1' : '0';
    e.el.style.transform = `translate(${p.x - e.el.offsetWidth / 2}px, ${p.y - e.el.offsetHeight}px) scale(${s})`;
  }
  mostrar($('#buio'), t, E.buio + 0.4, E.commento - 0.2);
  const cm = $('#commento');
  mostrar(cm, t, E.commento, E.regioni - 0.1);
  if (t >= E.commento && t < E.regioni) {
    const txt = R.commento.testo, n = Math.round(clamp((t - E.commento - 0.2) / (E.scrivi_a - E.commento - 0.2)) * txt.length);
    cm.querySelector('.testo').innerHTML = esc(txt.slice(0, n)) + ((t * 2.4) % 1 < 0.55 || n < txt.length ? '<span class="cursore"></span>' : '');
  }
  mostrar($('#regioni'), t, E.regioni + 0.4, R.durata + 1);
  document.querySelectorAll('#regioni .riga').forEach((r, i) => {
    const s = fase(t, E.regioni + 0.7 + i * 0.28, 0.3);
    r.style.opacity = String(s);
    r.querySelector('.barra i').style.width = `${r.dataset.pct * suave(fase(t, E.regioni + 0.8 + i * 0.28, 0.7))}%`;
  });
  const sb = fase(t, E.regioni + 1.3, 0.3);
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
  inserirExemplo();
  citta = new Citta(mappa, D);
  citta.dadosCidade(luogoEx);
  luci = criarLuci();
  // região "al buio": a de menor fração de comuni com casas (entre as com 40+ comuni)
  for (const r of D.regioni) {
    const ls = D.luoghi.filter(l => l.regione === r);
    r.ext = ls.length ? ls.reduce((m, l) => Math.max(m, Math.hypot(l.x - r.lx, l.z - r.lz)), 0) : 50;
  }
  regBuio = D.regioni.filter(r => r.comuni >= 40).sort((a, b) => a.luoghi / a.comuni - b.luoghi / b.comuni)[0];
  // as 3 primeiras casas da cidade (em volta da piazza); @ já públicos no site. A câmera mira no meio delas
  const topNap = luogoEx.casas.map(i => D.casas[i]).filter(c => c !== casaEx).sort((a, b) => a.lote - b.lote).slice(0, 3);
  for (const c of [...topNap, casaEx]) citta.posCasa(c);
  centroPersone = { x: topNap.reduce((s, c) => s + c.x, 0) / topNap.length, z: topNap.reduce((s, c) => s + c.z, 0) / topNap.length };
  montarChaves();
  $('#titolo').textContent = R.titolo;
  $('#sotto-titolo').innerHTML = `<span class="g">${esc(R.sottotitolo)}</span>`;
  $('#commento .chi').innerHTML = `${esc(R.commento.utente)} <span>· ora</span>`;
  $('#banner').textContent = R.banner;
  $('#buio b').textContent = num(regBuio.comuni - regBuio.luoghi);
  $('#buio small').textContent = `comuni ancora al buio in ${regBuio.nome}`;
  const top = [...D.regioni].sort((a, b) => b.case - a.case).slice(0, 3), max = top[0].case;
  $('#regioni').insertAdjacentHTML('beforeend', top.map((r, i) => `<div class="riga" data-pct="${(100 * r.case / max).toFixed(1)}"><div class="pos">${i + 1}</div><div style="flex:1"><div class="nome">${esc(r.nome)}</div><div class="barra"><i></i></div></div><div class="num">${num(r.case)}</div></div>`).join(''));
  // @ reais das 3 casas com mais pontos de Napoli (públicos no site) e a casa de exemplo
  etichette = [
    ...topNap.map((c, i) => ({ el: criarEtichetta('', '', `@${c.conta}`, luogoEx.nome), casa: c, ini: E.persona + i * 0.25, fim: E.paese })),
    { el: criarEtichetta('vero', 'ESEMPIO', R.esempio.conta, R.esempio.luogo), casa: casaEx, ini: E.lucemia, fim: E.regioni + 0.4 },
  ];
  // capa: título grande no lugar da legenda
  if (R.copertina) {
    const cp = R.copertina;
    $('#testa').style.top = `${cp.testa_top ?? 120}px`;
    for (const id of ['#buio', '#regioni', '#banner', '#commento']) $(id).style.display = 'none';
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
