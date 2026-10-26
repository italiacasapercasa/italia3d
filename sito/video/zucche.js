// Reel "zucche" (reel 7) com dados reais: Halloween começou (abóboras em Roma, pôr do sol, luzes), a casa mais nova,
// Itália à noite enchendo de casas, as lojas reais, a loja de perto, "tocca Negozi", contagem regressiva e o top 3 da
// semana para a eleição. window.preparar(roteiro), window.quadro(t), window.suoni(); tudo depende só de t.
// Abrir com ?halloween=1 (as abóboras aparecem a partir da palavra "Halloween").
import * as THREE from 'three';
import { carregar } from '../js/dati.js';
import { Mappa, COR_MAR } from '../js/mappa.js';
import { Citta, DIST_CIDADE, LOTE } from '../js/citta.js';
import { ALTURA_NIVEL } from '../js/modelli.js';
import { tipoDi } from '../js/commerci.js';

const $ = s => document.querySelector(s);
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const suave = s => (s < 0.5 ? 4 * s * s * s : 1 - Math.pow(-2 * s + 2, 3) / 2);
const ressalto = s => { const c = 1.9; return s <= 0 ? 0 : s >= 1 ? 1 : 1 + (c + 1) * Math.pow(s - 1, 3) + c * Math.pow(s - 1, 2); };
const fase = (t, ini, dur) => clamp((t - ini) / dur);
const esc = s => String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
const num = n => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
const ora = ms => new Date(ms).toLocaleTimeString('it-IT', { timeZone: 'Europe/Rome', hour: '2-digit', minute: '2-digit' });

let D, mappa, citta, R, E, chaves, punti, totale, roma, nuova, vetrina, scene, etichette = [], righeLista = [];
const GIORNO = { mar: new THREE.Color(COR_MAR), terra: new THREE.Color('#ffffff'), ceu: 2.3, sol: 2.4, ceuC: new THREE.Color('#ffffff'), solC: new THREE.Color('#fff1dc') };
const NOTTE = { mar: new THREE.Color('#1B2E55'), terra: new THREE.Color('#7381A8'), ceu: 1.1, sol: 0.7, ceuC: new THREE.Color('#B9C6FF'), solC: new THREE.Color('#A9BBFF') };
const TRAMONTO = { mar: new THREE.Color('#E58A5C'), terra: new THREE.Color('#FFD2B0'), ceu: 1.9, sol: 2.1, ceuC: new THREE.Color('#FFC6A0'), solC: new THREE.Color('#FF9A55') };

async function iniciar() {
  D = await carregar('video');
  totale = D.casas.length;
  mappa = new Mappa($('#mappa'), D.geo, D.rilievo, D.imagem, { gravacao: true });
  window.preparar = preparar;
  window.quadro = quadro;
  window.suoni = suoni;
}

// dia -> pôr do sol -> noite (k de 0 a 1, passando pelo laranja no meio); luzes à parte
function ceu(k, luci) {
  const a = k < 0.5 ? GIORNO : TRAMONTO, b = k < 0.5 ? TRAMONTO : NOTTE, s = k < 0.5 ? k * 2 : (k - 0.5) * 2;
  const c = a.mar.clone().lerp(b.mar, s);
  mappa.scene.background.copy(c); mappa.scene.fog.color.copy(c); mappa.mar.material.color.copy(c);
  mappa.matTerreno.color.copy(a.terra.clone().lerp(b.terra, s));
  mappa.ceu.intensity = a.ceu + (b.ceu - a.ceu) * s; mappa.ceu.color.copy(a.ceuC.clone().lerp(b.ceuC, s));
  mappa.sol.intensity = a.sol + (b.sol - a.sol) * s; mappa.sol.color.copy(a.solC.clone().lerp(b.solC, s));
  mappa.notte = luci;
  citta.grupoNotte.visible = luci;
}
function zucche(on) {
  for (const k of ['zucca', 'zuccaP', 'zuccaL', 'zuccaPL']) { const m = citta.camadas[k]?.mesh; if (m) m.visible = on; }
}

// uma bolinha por cidade, na ordem em que a cidade ganhou a 1ª casa; "lim" = fração de casas já chegadas;
// de noite as bolinhas viram luzes cor de abóbora
function criarPontos() {
  const ordem = D.casas.map((c, i) => i).sort((a, b) => D.casas[a].ts - D.casas[b].ts);
  const rankCasa = new Float32Array(D.casas.length);
  ordem.forEach((i, k) => { rankCasa[i] = (k + 1) / ordem.length; });
  const rank = new Float32Array(D.luoghi.length), pos = new Float32Array(D.luoghi.length * 3);
  D.luoghi.forEach((l, i) => {
    rank[i] = Math.min(...l.casas.map(c => rankCasa[c]));
    pos.set([l.x, mappa.altura(l.x, l.z) + 0.03, l.z], i * 3);
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('ord', new THREE.BufferAttribute(rank, 1));
  const mat = new THREE.ShaderMaterial({
    uniforms: { lim: { value: 1 }, notte: { value: 0 }, escala: { value: 1920 / (2 * Math.tan(mappa.camera.fov * Math.PI / 360)) } },
    vertexShader: `
      attribute float ord; uniform float lim; uniform float escala;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        float k = clamp((lim - ord) * 40.0, 0.0, 1.0);
        float pop = k < 1.0 ? k * (1.0 + 0.6 * sin(k * 3.1416)) : 1.0;
        gl_PointSize = ord > lim ? 0.0 : clamp(0.04 * escala / -mv.z, 9.0, 13.0) * pop;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      uniform float notte;
      void main() {
        float d = length(gl_PointCoord - 0.5) * 2.0;
        if (d > 1.0) discard;
        vec3 dentro = mix(vec3(1.0), vec3(1.0, 0.62, 0.16), notte), borda = mix(vec3(0.08, 0.13, 0.2), vec3(0.45, 0.16, 0.02), notte);
        gl_FragColor = vec4(d > 0.62 ? borda : dentro, 1.0);
        #include <colorspace_fragment>
      }`,
  });
  const p = new THREE.Points(g, mat);
  p.frustumCulled = false; p.renderOrder = 5;
  mappa.scene.add(p);
  return p;
}

// ---------- câmera ----------
function montarChaves() {
  const b = D.geo.bbox, alt = b.z1 - b.z0, dP = mappa.distPais();
  const paese = { x: (b.x0 + b.x1) / 2, z: (b.z0 + b.z1) / 2 - alt * 0.07, dist: dP, az: 0, giu: 0 };
  const P = (o, k = {}) => ({ x: o.x, z: o.z, ...k });
  const lista = [
    [0, { ...paese, dist: dP * 1.08 }],
    [E.stanotte, { ...paese, dist: dP * 0.98 }],
    [E.hallo, P(roma, { dist: 1.5, az: 0, giu: 0.06 })],
    [E.fino, P(roma, { dist: 1.05, az: 0.35 })],
    [E.zucca, P(roma, { dist: 0.62, az: 0.9, giu: 0.08 })],
    [E.sole, P(roma, { dist: 1.0, az: 1.25, giu: 0.06 })],
    [E.commenta, P(roma, { dist: 0.9, az: 1.4 })],
    [E.commenta + 1.3, P(nuova.pos, { dist: 0.3, az: 1.75, giu: 0.1 })],
    [E.guardate, P(nuova.pos, { dist: 0.34, az: 2.0 })],
    [E.guardate + 2.0, { ...paese, giu: 0 }],
    [E.att, { ...paese, dist: dP * 0.96, az: 0 }],
    [E.lazio - 0.1, { ...paese, dist: dP * 0.94 }],
    [E.treddi, P(vetrina.pos, { dist: 0.42, az: vetrina.az, giu: 0.1 })],
    [E.apri, P(vetrina.pos, { dist: 0.46, az: vetrina.az + 0.3 })],
    [E.sfida, P(vetrina.pos, { dist: 0.5, az: vetrina.az + 0.45 })],
    [E.sfida + 1.3, { ...paese, dist: dP * 0.98, az: 0, giu: 0 }],
    [E.ognic, { ...paese, dist: dP * 0.95 }],
    [R.durata, { ...paese, dist: dP * 1.06 }],
  ];
  let ant = {};
  chaves = lista.sort((a, b) => a[0] - b[0]).map(([t, k]) => { ant = { ...ant, ...k }; return { t, k: { ...ant } }; });
}
function camera(t) {
  let i = 0;
  while (i < chaves.length - 2 && t >= chaves[i + 1].t) i++;
  const a = chaves[i], b = chaves[Math.min(i + 1, chaves.length - 1)];
  const s = b.t > a.t ? suave(clamp((t - a.t) / (b.t - a.t))) : 1;
  const A = a.k, B = b.k, l = (p, q) => p + (q - p) * s;
  const dist = Math.exp(l(Math.log(A.dist), Math.log(B.dist)));
  const dxz = Math.hypot(B.x - A.x, B.z - A.z);
  // aproximando: o alvo chega antes do zoom (a cidade cresce no centro); afastando: o zoom vem antes
  const fecha = B.dist < A.dist;
  const sxz = dxz > 20 ? (fecha ? suave(clamp((t - a.t) / ((b.t - a.t) * 0.55))) : suave(clamp((t - a.t - (b.t - a.t) * 0.45) / ((b.t - a.t) * 0.55)))) : s;
  // tremida nos impactos (BOOM do Halloween e carimbo do "5")
  const tremor = [[E.hallo, 0.5], [E.cinque, 0.4]].reduce((v, [ti, d]) => v + (t >= ti && t < ti + d ? 0.012 * (1 - (t - ti) / d) * Math.sin((t - ti) * 70) : 0), 0);
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
  const h1 = typeof r1 === 'function' ? r1(t) : r1, h2 = typeof r2 === 'function' ? r2(t) : r2;
  if ($('#r1').innerHTML !== h1) $('#r1').innerHTML = h1;
  if ($('#r2').innerHTML !== h2) $('#r2').innerHTML = h2;
  $('#r1').className = c1 ?? ''; $('#r2').className = c2 ?? '';
  $('#righe').style.transform = `scale(${ini > 0 ? 0.5 + 0.5 * ressalto(fase(t, ini, 0.3)) : 1})`;
  $('#righe').style.opacity = h1 || h2 ? '1' : '0';
}

// contagem regressiva: 9, 8, 7, 6 até o 5 cair na palavra "cinque"
function conto(t) {
  const el = $('#conto');
  mostrar(el, t, E.mancano - 0.05, E.domenica - 0.05, 0);
  if (t < E.mancano) return;
  const passos = 4, k = Math.min(passos, Math.floor(fase(t, E.mancano + 0.1, E.cinque - E.mancano - 0.1) * passos));
  const n = el.querySelector('.n'), v = String(t >= E.cinque ? 5 : 9 - k);
  if (n.textContent !== v) n.textContent = v;
  const s = t >= E.cinque ? ressalto(fase(t, E.cinque, 0.3)) * (1 + 0.05 * Math.sin((t - E.cinque) * 6)) : 0.75;
  n.style.transform = `scale(${t >= E.cinque ? 0.6 + 0.4 * s + (t < E.cinque + 0.12 ? 0.25 : 0) : s})`;
}

function quadro(t) {
  const dist = camera(t);
  punti.visible = dist > DIST_CIDADE * 0.55;
  // bolinhas: Itália vazia de noite e as casas chegando no contador
  punti.material.uniforms.lim.value = t < E.case - 0.25 ? (t < E.guardate ? 1 : 0) : clamp(0.004 + 0.996 * suave(fase(t, E.case - 0.25, E.case_a - E.case + 0.35)));
  const k = suave(fase(t, E.stasera, E.sole - E.stasera + 0.4)) * (1 - suave(fase(t, E.att - 0.1, 1.1)));
  punti.material.uniforms.notte.value = k;
  // luzes: piscam ao acender ("si accendono") e apagam quando amanhece
  const dt = t - E.accendono, pisca = dt >= 0 && ((dt > 0.07 && dt < 0.13) || (dt > 0.2 && dt < 0.25));
  ceu(k, dt >= 0 && !pisca && t < E.att + 0.5);
  zucche(t >= E.hallo);
  const velo = $('#velo');
  const fl = Math.max(t >= E.hallo ? 0.75 * (1 - fase(t, E.hallo, 0.35)) : 0, t >= E.cinque ? 0.45 * (1 - fase(t, E.cinque, 0.3)) : 0);
  velo.style.opacity = String(fl);
  velo.style.background = t >= E.cinque ? '#FFC93C' : '#FFB25C';
  cabecalho(t);
  for (const e of etichette) {
    const vis = t >= e.ini && t < e.fim;
    if (!vis) { e.el.style.opacity = '0'; continue; }
    const pos = e.pos(), p = projetar(pos.x, pos.y, pos.z);
    const s = ressalto(fase(t, e.ini, e.dur ?? 0.32)) * (1 - fase(t, e.fim - 0.2, 0.2));
    e.el.style.opacity = p.ok ? '1' : '0';
    e.el.style.transform = `translate(${p.x - e.el.offsetWidth / 2}px, ${p.y - e.el.offsetHeight}px) scale(${s})`;
  }
  chip($('#chip-fino'), t, E.fino, E.stasera);
  chip($('#chip-zucca'), t, E.suazucca - 0.05, E.guardate + 0.2);
  // lojas reais, uma por linha
  mostrar($('#lista'), t, E.nove - 0.1, E.lazio + 0.25);
  righeLista.forEach((r, i) => { const ti = E.nove + 0.15 + i * r.passo, s = ressalto(fase(t, ti, 0.28)); r.el.style.opacity = t >= ti ? '1' : '0'; r.el.style.transform = `translateX(${(1 - s) * 80}px)`; });
  // site: toque em «Negozi»
  mostrar($('#sito'), t, E.apri - 0.05, E.sfida);
  const neg = $('#sito .neg'), tc = $('#tocco'), kt = fase(t, E.tocca, 0.45);
  neg.classList.toggle('lampo', t >= E.negozi && t < E.sfida);
  if (t >= E.apri) { const r = neg.getBoundingClientRect(); tc.style.left = `${r.left + r.width / 2}px`; tc.style.top = `${r.top + r.height / 2}px`; }
  tc.style.opacity = kt > 0 && kt < 1 ? String(1 - kt) : '0';
  tc.style.transform = `scale(${0.4 + kt})`;
  conto(t);
  // eleição: top 3 real da semana
  mostrar($('#pres'), t, E.domenica, E.ognic);
  $('#pres .ore').classList.toggle('lampo', t >= E.ore && t < E.ore + 0.8);
  $('#pres h2').classList.toggle('lampo', t >= E.pres && t < E.pres + 0.8);
  const kb = suave(fase(t, E.vince, 1.0));
  document.querySelectorAll('#pres .barra i').forEach(b => { b.style.width = `${b.dataset.pct * kb}%`; });
  const ta = $('#testa-a'); ta.style.transform = `rotate(8deg) scale(${t >= E.punti ? ressalto(fase(t, E.punti, 0.3)) : 0})`;
  chip($('#chip-comm'), t, E.ognic - 0.05, E.scrivi);
  const cta = $('#cta').children;
  mostrar(cta[0], t, E.scrivi - 0.05, R.durata + 1, 20);
  mostrar(cta[1], t, E.scrivi + 0.9, R.durata + 1, 20);
  mostrar(cta[2], t, E.amici - 0.05, R.durata + 1, 20);
  mostrar(cta[3], t, E.ci + 0.4, R.durata + 1, 20);
  legenda(t);
  mappa.renderer.render(mappa.scene, mappa.camera);
  return true;
}

// efeitos sonoros (o mixador strumenti/suoni.mjs sintetiza cada tipo)
function suoni() {
  const s = [], add = (t, tipo, extra = {}) => s.push({ t, tipo, vol: 0.8, ...extra });
  add(0.05, 'ding', { vol: 0.45, tono: 1.3 }); add(0.45, 'ding', { vol: 0.35, tono: 1.6 });
  add(E.stanotte - 0.05, 'whoosh', { vol: 0.85, dur: 1.8, giu: true });
  add(E.hallo - 0.05, 'boom'); add(E.hallo, 'vento', { dur: 4.2 });
  for (let k = 0; k < 4; k++) add(E.hallo + 0.1 + k * 0.09, 'pop', { vol: 0.5, tono: 0.6 + k * 0.08 });
  add(E.fino, 'stamp', { vol: 0.75 });
  for (let t = E.ogni, k = 0; t < E.zucca + 0.05; t += 0.12, k++) add(t, 'pop', { vol: 0.45, tono: 0.75 + k * 0.05 });
  add(E.zucca, 'ding', { vol: 0.4, tono: 1.1 });
  add(E.stasera, 'whoosh', { vol: 0.5, dur: 2.4 });
  add(E.accendono, 'tick', { vol: 0.6, tono: 1.4 }); add(E.accendono + 0.13, 'tick', { vol: 0.6, tono: 1.5 }); add(E.accendono + 0.25, 'ding', { vol: 0.6, tono: 1.25 });
  for (let k = 0; k < 6; k++) add(E.accendono + 0.3 + k * 0.08, 'pop', { vol: 0.3, tono: 1.1 + k * 0.07 });
  add(E.commenta - 0.05, 'whoosh', { vol: 0.75, dur: 1.4, giu: true });
  add(E.commenta + 1.25, 'select', { tono: 1.1 });
  add(E.suazucca - 0.05, 'pop', { tono: 0.9 }); add(E.suazucca + 0.1, 'ding', { vol: 0.45, tono: 1.4 });
  add(E.guardate, 'whoosh', { vol: 0.8, dur: 2.0 });
  for (let t = E.case - 0.2; t < E.case_a + 0.1; t += 0.07) add(t, 'tick', { vol: 0.38, tono: 1 + 0.5 * (t - E.case) / (E.case_a - E.case) });
  for (let t = E.case - 0.15, k = 0; t < E.case_a + 0.1; t += 0.11, k++) add(t, 'pop', { vol: 0.28, tono: 0.8 + ((k * 37) % 9) / 12 });
  add(E.case_a + 0.1, 'ding', { vol: 0.55, tono: 1.1 }); add(E.comuni, 'stamp', { vol: 0.7 });
  add(E.att - 0.1, 'whoosh', { vol: 0.45, dur: 1.2 });
  add(E.nove - 0.1, 'stamp', { vol: 0.85 });
  righeLista.forEach((r, i) => add(E.nove + 0.15 + i * r.passo, 'select', { vol: 0.5, tono: 0.9 + i * 0.05 }));
  add(E.lazio, 'whoosh', { vol: 0.85, dur: 1.6, giu: true });
  add(E.treddi - 0.05, 'select', { tono: 1.2 }); add(E.treddi + 0.05, 'pop', { vol: 0.6 });
  add(E.vuoi - 0.05, 'pop', { tono: 0.85 });
  add(E.apri - 0.05, 'pop', { tono: 1.0 }); add(E.tocca, 'tap'); add(E.negozi, 'ding', { vol: 0.55, tono: 1.2 });
  add(E.sfida, 'whoosh', { vol: 0.75, dur: 1.8 });
  for (let k = 0; k < 4; k++) add(E.mancano + 0.1 + k * (E.cinque - E.mancano - 0.1) / 4, 'tick', { vol: 0.7, tono: 0.9 + k * 0.1 });
  add(E.cinque - 0.03, 'boom', { vol: 0.8 }); add(E.cinque, 'stamp', { vol: 1 });
  add(E.domenica - 0.05, 'whoosh', { vol: 0.55, dur: 1.0 }); add(E.domenica + 0.05, 'pop', { tono: 0.8 });
  add(E.ore, 'ding', { vol: 0.5, tono: 1.3 }); add(E.pres, 'flap', { vol: 0.7 });
  add(E.vince, 'rullo', { dur: E.punti - E.vince }); add(E.punti, 'stamp', { vol: 1 });
  add(E.ognic - 0.05, 'coin');
  add(E.scrivi - 0.05, 'pop', { tono: 0.9 }); add(E.scrivi + 0.9, 'pop', { tono: 1.05 }); add(E.amici - 0.05, 'pop', { tono: 1.2 });
  add(E.ci, 'whoosh', { vol: 0.5, dur: 1.4 }); add(E.ci + 0.4, 'pop', { tono: 1.3 }); add(E.ci + 1.0, 'ding', { vol: 0.5 });
  return s.sort((a, b) => a.t - b.t);
}

async function preparar(roteiro) {
  R = roteiro; E = R.eventi;
  await Promise.all(['900 104px Nunito', '900 60px Nunito', '800 40px Nunito', '700 30px Nunito'].map(f => document.fonts.load(f)));
  await document.fonts.ready;
  citta = new Citta(mappa, D);
  punti = criarPontos();
  roma = D.luoghi.find(l => l.nome === R.citta);
  // a casa mais nova da cidade (real)
  const cn = roma.casas.map(i => D.casas[i]).sort((a, b) => b.ts - a.ts)[0];
  nuova = { casa: cn, pos: citta.posCasa(cn) };
  etichette.push({
    el: novaEtichetta(`<div class="box zucca"><b>🏠 @${esc(cn.conta)}</b><span>NUOVA CASA A ${esc(roma.nome.toUpperCase())}</span><small>arrivata alle ${ora(cn.ts)}</small></div><div class="freccia"></div>`, 'cartello'),
    pos: () => ({ x: nuova.pos.x, y: nuova.pos.y + ALTURA_NIVEL[cn.livello] * LOTE + LOTE * 0.4, z: nuova.pos.z }), ini: E.commenta + 1.25, fim: E.guardate + 0.4,
  });
  // loja de perto
  const vcm = D.commerci.find(c => c.id === R.vetrina) ?? D.commerci.at(-1);
  vetrina = { cm: vcm, pos: citta.posCommercio(vcm) };
  // câmera de frente para a vitrine (o lote pode estar virado para qualquer lado)
  const rot = citta.dadosCidade(vcm.luogo).alvos.find(a => a.commercio === vcm)?.rot ?? 0;
  vetrina.az = Math.atan2(Math.sin(rot + 0.3), Math.cos(rot + 0.3));
  const [, emoV] = tipoDi(vcm.tipo);
  etichette.push({
    el: novaEtichetta(`<div class="box"><b>${emoV} ${esc(vcm.nome)}</b><span>${esc(vcm.luogo.nome)} (${esc(vcm.luogo.comune.sigla)})</span></div><div class="freccia"></div>`, 'cartello'),
    pos: () => ({ x: vetrina.pos.x, y: vetrina.pos.y + LOTE * 1.15, z: vetrina.pos.z }), ini: E.treddi - 0.1, fim: E.apri,
  });
  // lista das lojas reais (ordem de aprovação)
  const lista = D.commerci;
  $('#lista').innerHTML = lista.map(cm => { const [, emo] = tipoDi(cm.tipo); return `<div class="riga"><div class="em">${emo}</div><div class="quem"><b>${esc(cm.nome)}</b><small>📍 ${esc(cm.luogo.nome)} (${esc(cm.luogo.comune.sigla)}) · ${esc(cm.luogo.regione.nome)}</small></div></div>`; }).join('');
  const passo = Math.min(0.34, (E.lazio - E.nove - 0.4) / Math.max(1, lista.length - 1));
  righeLista = [...document.querySelectorAll('#lista .riga')].map(el => ({ el, passo }));
  await Promise.all([...document.images].map(i => i.decode().catch(() => {})));
  // eleição: top 3 da semana (pontos reais)
  const top = D.ranking.slice(0, 3), max = top[0].sett;
  $('#pres').innerHTML = `<h2>🏛️ PRIMO PRESIDENTE<br>DEL CONSIGLIO</h2><div class="quando">si elegge domenica 1 novembre alle <span class="ore">21:00</span></div>
    ${top.map((c, i) => `<div class="riga"><div class="pos">${i + 1}</div><div class="quem"><b>@${esc(c.conta)}</b><small>${esc(D.luoghi[c.luogo].nome)}</small><div class="barra"><i data-pct="${(100 * c.sett / max).toFixed(1)}"></i></div></div><div class="pts">${num(c.sett)}</div>${i === 0 ? '<div id="testa-a" class="forte g">IN TESTA!</div>' : ''}</div>`).join('')}`;
  montarChaves();
  const nComuni = D.luoghi.length;
  scene = [
    [0, '☀️ BUONGIORNO', '<span class="g">ITALIA!</span>'],
    [E.stanotte, 'DA STANOTTE…', ''],
    [E.hallo, '🎃 HALLOWEEN', '<span class="z">È INIZIATO!</span>'],
    [E.ogni, 'OGNI CASA', '<span class="z">HA LA SUA ZUCCA</span>'],
    [E.stasera, 'STASERA', '<span class="g">AL TRAMONTO…</span>'],
    [E.accendono, 'SI ACCENDONO', '<span class="z">TUTTE! 🎃</span>'],
    [E.commenta, 'COMMENTA', '<span class="g">CITTÀ E REGIONE</span>'],
    [E.guardate, 'GUARDATE', '<span class="g">QUANTO È CRESCIUTA</span>'],
    [E.case, t => `<span class="g">${num(Math.round(totale * punti.material.uniforms.lim.value))}</span>`, t => t >= E.comuni ? `CASE IN <span class="g">${num(nComuni)}</span> COMUNI` : 'CASE', 'grande'],
    [E.att, 'E CI SONO GIÀ', ''],
    [E.nove, `<span class="g">${lista.length}</span> ATTIVITÀ`, '<span class="g">VERE</span> 🏪'],
    [E.neg3d, 'IL LORO NEGOZIO', '<span class="g">IN 3D</span>'],
    [E.vuoi, 'VUOI', '<span class="g">LA TUA?</span>', 'grande', 'grande'],
    [E.apri, 'APRI IL SITO', '<span class="g">E TOCCA «NEGOZI»</span>'],
    [E.sfida, 'MA LA SFIDA', '<span class="g">PIÙ GRANDE…</span>'],
    [E.mancano, '', ''],
    [E.domenica, 'DOMENICA 1 NOVEMBRE', '<span class="g">ORE 21</span>'],
    [E.vince, 'VINCE CHI FA', '<span class="g">PIÙ PUNTI</span>'],
    [E.ognic, 'OGNI COMMENTO', '<span class="g">CONTA</span>'],
    [E.scrivi - 0.05, '', ''],
    [E.ci, 'CI VEDIAMO', '<span class="g">SULLA MAPPA!</span>'],
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
  console.log(`${totale} case · ${nComuni} comuni · ${lista.length} attività · nuova @${cn.conta} ${ora(cn.ts)} · vetrina ${vcm.nome} · top ${top.map(c => `@${c.conta} ${c.sett}`).join(', ')}`);
  quadro(0);
  return { durata: R.durata, fps: 30 };
}

iniciar().catch(e => console.error('erro ao carregar', e));
