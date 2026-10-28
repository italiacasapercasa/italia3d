// Reel "tre giorni" (reel 9) com dados reais: as casas surgindo dia a dia, os números do Instagram e do site,
// casas/cidades/regiões, Napoli × Roma, o derby da semana, a corrida à presidência (top 3 real), as atividades
// reais no mapa e a meta de 20.000 casas. window.preparar(roteiro), window.quadro(t), window.suoni(); tudo depende só de t.
import * as THREE from 'three';
import { carregar } from '../js/dati.js';
import { Mappa } from '../js/mappa.js';
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
// contador que gira de 0 até v entre ini e ini+dur
const conta = (t, ini, dur, v) => v * (1 - Math.pow(1 - fase(t, ini, dur), 3));

let D, mappa, citta, R, E, S, chaves, punti, totale, ordemTs, scene, etichette = [], tour, pietro, top3, derbyA, derbyB, roma, napoli, milano;

async function iniciar() {
  D = await carregar('video');
  totale = D.casas.length;
  mappa = new Mappa($('#mappa'), D.geo, D.rilievo, D.imagem, { gravacao: true });
  window.preparar = preparar;
  window.quadro = quadro;
  window.suoni = suoni;
}

// uma bolinha por cidade (3+ casas), que aparece quando a cidade nasce; "lim" = fração das casas já chegadas
function criarPontos() {
  const ordem = D.casas.map((c, i) => i).sort((a, b) => D.casas[a].ts - D.casas[b].ts);
  ordemTs = ordem.map(i => D.casas[i].ts);
  const rankCasa = new Float32Array(D.casas.length);
  ordem.forEach((i, k) => { rankCasa[i] = (k + 1) / ordem.length; });
  const rank = new Float32Array(D.luoghi.length), pos = new Float32Array(D.luoghi.length * 3);
  D.luoghi.forEach((l, i) => {
    rank[i] = l.casas.length >= 3 ? Math.min(...l.casas.map(c => rankCasa[c])) : 2;
    pos.set([l.x, mappa.altura(l.x, l.z) + 0.03, l.z], i * 3);
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('ord', new THREE.BufferAttribute(rank, 1));
  const mat = new THREE.ShaderMaterial({
    uniforms: { lim: { value: 1 }, giallo: { value: 0 }, escala: { value: 1920 / (2 * Math.tan(mappa.camera.fov * Math.PI / 360)) } },
    vertexShader: `
      attribute float ord; uniform float lim; uniform float escala; varying float vNovo;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        float k = clamp((lim - ord) * 40.0, 0.0, 1.0);
        float pop = k < 1.0 ? k * (1.0 + 0.6 * sin(k * 3.1416)) : 1.0;
        vNovo = 1.0 - k;
        gl_PointSize = ord > lim ? 0.0 : clamp(0.05 * escala / -mv.z, 13.0, 18.0) * pop;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      uniform float giallo; varying float vNovo;
      void main() {
        float d = length(gl_PointCoord - 0.5) * 2.0;
        if (d > 1.0) discard;
        vec3 dentro = mix(vec3(1.0), vec3(1.0, 0.79, 0.24), max(giallo, vNovo));
        gl_FragColor = vec4(d > 0.62 ? vec3(0.08, 0.13, 0.2) : dentro, 1.0);
        #include <colorspace_fragment>
      }`,
  });
  const p = new THREE.Points(g, mat);
  p.frustumCulled = false; p.renderOrder = 5;
  mappa.scene.add(p);
  return p;
}
// fração de casas já no mapa no instante t (cresce no começo e de novo na contagem de casas)
function limite(t) {
  if (t < E.mappa) return clamp(0.002 + 0.998 * suave(fase(t, E.tre + 0.25, E.arrivati + 0.5 - E.tre)));
  return clamp(0.002 + 0.998 * suave(fase(t, E.mappa + 0.15, E.case + 0.7 - E.mappa)));
}

// ---------- câmera ----------
function montarChaves() {
  const b = D.geo.bbox, alt = b.z1 - b.z0, dP = mappa.distPais();
  const paese = { x: (b.x0 + b.x1) / 2, z: (b.z0 + b.z1) / 2 - alt * 0.07, dist: dP, az: 0, giu: 0 };
  const P = (o, k = {}) => ({ x: o.x, z: o.z, ...k });
  const meio = (a, c, k) => ({ x: (a.x + c.x) / 2, z: (a.z + c.z) / 2, ...k });
  const dRN = Math.hypot(roma.x - napoli.x, roma.z - napoli.z), dRM = Math.hypot(roma.x - milano.x, roma.z - milano.z);
  const lista = [
    [0, { ...paese, dist: dP * 1.12 }],
    [E.arrivati + 0.6, { ...paese, dist: dP * 0.98 }],
    [E.mappa - 0.1, { ...paese, dist: dP * 0.96, az: 0.08 }],
    [E.regioni, { ...paese, dist: dP * 1.0, az: -0.06 }],
    [E.napoli - 0.2, { ...paese, dist: dP * 1.0, az: 0 }],
    [E.napoli + 1.1, meio(roma, napoli, { dist: dRN * 4.4, az: 0.05, giu: 0 })],
    [E.n354 + 0.6, meio(roma, napoli, { dist: dRN * 4.0, az: -0.05 })],
    [E.ma + 1.2, meio(roma, milano, { dist: dRM * 1.75, az: 0 })],
    [E.doppio + 0.8, meio(roma, milano, { dist: dRM * 1.6, az: 0.05 })],
  ];
  // voo de A para B: ponto alto no meio do caminho quando é longe
  const voo = (ini, fim, de, para, k) => {
    const d = Math.hypot(para.x - de.x, para.z - de.z);
    if (d > 5) lista.push([(ini + fim) / 2, { x: (de.x + para.x) / 2, z: (de.z + para.z) / 2, dist: Math.max(4, d * 0.75), giu: 0, az: k.az }]);
    lista.push([fim, { ...P(para), ...k }]);
  };
  lista.push([E.rimini - 0.1, { ...P(pietro.pos), dist: 0.62, az: 0.8, giu: -0.08 }]);   // Rimini fica entre Roma e Milano: mergulho direto
  lista.push([E.poi - 0.1, { ...P(pietro.pos), dist: 0.7, az: 1.2, giu: 0.1 }]);
  lista.push([E.poi + 1.2, { ...paese, dist: dP * 1.0, az: 0, giu: 0 }]);
  lista.push([E.cenovita, { ...paese, dist: dP * 0.97 }]);
  lista.push([E.novita + 0.4, { ...paese, dist: dP * 0.93 }]);
  const V = { dist: 0.42, giu: 0.08 };
  voo(E.tredici, E.mappa13 + 0.4, paese, tour[0].pos, { ...V, az: 0.5 });
  lista.push([E.psicologa + 0.35, { ...P(tour[0].pos), ...V, az: 0.75 }]);
  voo(E.psicologa + 0.35, E.ristorante + 0.15, tour[0].pos, tour[1].pos, { ...V, az: 0.6 });
  lista.push([E.distributore - 0.45, { ...P(tour[1].pos), ...V, az: 0.85 }]);
  voo(E.distributore - 0.45, E.distributore + 0.35, tour[1].pos, tour[2].pos, { ...V, az: 0.5 });
  lista.push([E.trovi, { ...P(tour[2].pos), dist: 0.5, az: 1.5, giu: 0.1 }]);
  lista.push([E.obiettivo - 0.1, { ...P(tour[2].pos), dist: 0.55, az: 1.7, giu: 0.1 }]);
  lista.push([E.obiettivo + 1.3, { ...paese, dist: dP * 1.0, az: 0, giu: 0 }]);
  lista.push([E.scrivi, { ...paese, dist: dP * 0.98 }]);
  lista.push([R.durata, { ...paese, dist: dP * 1.06 }]);
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
  // tremida nos impactos
  const tremor = [[E.novita, 0.45], [E.doppio, 0.35], [E.testa, 0.3]].reduce((v, [ti, d]) => v + (t >= ti && t < ti + d ? 0.012 * (1 - (t - ti) / d) * Math.sin((t - ti) * 70) : 0), 0);
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
// data do jogo que corresponde à fração de casas já chegadas
const MESI = ['GENNAIO', 'FEBBRAIO', 'MARZO', 'APRILE', 'MAGGIO', 'GIUGNO', 'LUGLIO', 'AGOSTO', 'SETTEMBRE', 'OTTOBRE', 'NOVEMBRE', 'DICEMBRE'];
function giorno(lim) {
  const ts = ordemTs[Math.min(ordemTs.length - 1, Math.floor(lim * (ordemTs.length - 1)))];
  const d = new Date(ts), oggi = new Date(ordemTs.at(-1));
  const f = x => new Intl.DateTimeFormat('it-IT', { timeZone: 'Europe/Rome', day: 'numeric', month: 'numeric' }).formatToParts(x);
  const [g, m] = ['day', 'month'].map(k => +f(d).find(p => p.type === k).value);
  const go = +f(oggi).find(p => p.type === 'day').value;
  return lim > 0.985 || g === go ? 'OGGI' : `${g} ${MESI[m - 1]}`;
}
// bolhas de corações e comentários subindo (cena do Instagram)
const BOLLE = Array.from({ length: 16 }, (_, i) => ({ em: ['❤️', '💬', '👍', '❤️', '🔥', '💬', '❤️', '😍'][i % 8], x: 60 + ((i * 397) % 900), ini: i * 0.36, vel: 380 + ((i * 131) % 200), dx: ((i * 53) % 80) - 40 }));
function bolle(t) {
  const t0 = E.views - 0.2, fim = E.mappa;
  [...$('#bolle').children].forEach((el, i) => {
    const b = BOLLE[i], dt = t - t0 - b.ini, vis = t < fim && dt > 0 && dt < 2.2;
    el.style.opacity = vis ? String(Math.min(1, dt * 4) * (1 - fase(dt, 1.6, 0.6))) : '0';
    if (vis) el.style.transform = `translate(${b.x + b.dx * Math.sin(dt * 3)}px, ${1700 - b.vel * dt}px) scale(${0.6 + 0.5 * ressalto(fase(dt, 0, 0.3))})`;
  });
}

function quadro(t) {
  const dist = camera(t);
  punti.visible = dist > DIST_CIDADE * 0.55;
  punti.material.uniforms.lim.value = limite(t);
  punti.material.uniforms.giallo.value = t >= E.meta && t < E.regioni ? 0.6 * (1 - fase(t, E.regioni - 0.5, 0.5)) : 0;
  const velo = $('#velo');
  velo.style.opacity = String(Math.max(t >= E.novita ? 0.85 * (1 - fase(t, E.novita, 0.35)) : 0, t >= E.tredici ? 0.4 * (1 - fase(t, E.tredici, 0.25)) : 0));
  cabecalho(t);
  for (const e of etichette) {
    const vis = t >= e.ini && t < e.fim;
    if (!vis) { e.el.style.opacity = '0'; continue; }
    const pos = e.pos(), p = projetar(pos.x, pos.y, pos.z);
    const s = ressalto(fase(t, e.ini, e.dur ?? 0.32)) * (1 - fase(t, e.fim - 0.2, 0.2));
    e.el.style.opacity = p.ok ? '1' : '0';
    e.el.style.transform = `translate(${p.x - e.el.offsetWidth / 2}px, ${p.y - e.el.offsetHeight}px) scale(${s})`;
    if (e.lampo) e.el.querySelector('.box').classList.toggle('lampo', t >= e.lampo && t < e.lampo + 0.8);
  }
  // Instagram: notificação, cartão com 3 contadores e bolhas
  const nt = $('#notifica');
  mostrar(nt, t, E.views - 0.3, E.mappa, -30);
  const msg = t < E.comm - 0.1 ? `👁️ ${num(S.views)} visualizzazioni` : t < E.follow - 0.1 ? `💬 ${num(S.comments)} commenti` : `❤️ ${num(S.likes)} Mi piace`;
  if (nt.querySelector('small').textContent !== msg) nt.querySelector('small').textContent = msg;
  mostrar($('#social'), t, E.views - 0.15, E.mappa);
  [[E.views, S.views], [E.comm, S.comments], [E.follow, S.follower]].forEach(([ev, v], i) => {
    const r = $('#social').querySelectorAll('.riga')[i];
    r.style.opacity = t >= ev - 0.1 ? '1' : '0';
    r.style.transform = `scale(${0.7 + 0.3 * ressalto(fase(t, ev - 0.1, 0.3))})`;
    r.querySelector('.num').textContent = num(conta(t, ev - 0.1, 0.9, v));
    r.classList.toggle('lampo', t >= ev + 0.8 && t < ev + 1.3);
  });
  bolle(t);
  chip($('#chip-meta'), t, E.meta - 0.05, E.regioni);
  chip($('#chip-regioni'), t, E.regioni - 0.05, E.sito);
  const cv = $('#chip-visite'); cv.innerHTML = `🌐 <span class="g">${num(conta(t, E.sito, E.visite + 0.4 - E.sito, S.visite))}</span><br>VISITE SUL SITO`;
  chip(cv, t, E.sito - 0.05, E.napoli);
  chip($('#chip-vs'), t, E.testa - 0.05, E.n361 - 0.05);
  // derby da semana
  mostrar($('#derby'), t, E.ma - 0.05, E.corsa);
  const kd = suave(fase(t, E.schiaccia - 0.2, 0.9));
  $('#derby').querySelectorAll('.barra i').forEach(b => { b.style.width = `${b.dataset.pct * kd}%`; });
  $('#derby').querySelectorAll('.pts').forEach(p => { p.textContent = num(p.dataset.v * kd); });
  chip($('#chip-doppio'), t, E.doppio - 0.05, E.corsa);
  // presidência: top 3 real
  mostrar($('#pres'), t, E.poi - 0.05, E.cenovita);
  const kp = suave(fase(t, E.poi + 0.1, 0.9));
  $('#pres').querySelectorAll('.barra i').forEach(b => { b.style.width = `${b.dataset.pct * kp}%`; });
  [E.poi, E.casarsa, E.melito].forEach((ev, i) => $('#pres').querySelectorAll('.riga')[i].classList.toggle('lampo', t >= ev && t < ev + 0.75));
  $('#pres .quando').classList.toggle('lampo', t >= E.domenica && t < E.primo + 0.6);
  chip($('#chip-aperto'), t, E.aperto - 0.05, E.cenovita);
  // NOVITÀ: carimbo
  const nv = $('#novita'), sn = ressalto(fase(t, E.novita, 0.3));
  nv.style.opacity = t >= E.novita && t < E.tredici ? String(1 - fase(t, E.tredici - 0.2, 0.2)) : '0';
  nv.style.transform = `scale(${t < E.novita + 0.1 ? 1.4 - 0.4 * sn : 1 + 0.03 * Math.sin((t - E.novita) * 8)}) rotate(-6deg)`;
  chip($('#chip-tua'), t, E.sehai - 0.05, E.trovi);
  // o site: pílula e toque
  const si = $('#sito'), ks = ressalto(fase(t, E.trovi - 0.05, 0.32));
  si.style.opacity = t >= E.trovi - 0.05 && t < E.obiettivo ? String(1 - fase(t, E.obiettivo - 0.25, 0.25)) : '0';
  si.style.transform = `translateX(-50%) scale(${ks * (t >= E.sito2 + 0.15 && t < E.sito2 + 0.35 ? 0.94 : 1)})`;
  const tc = $('#tocco'), kt = fase(t, E.sito2, 0.45);
  if (t >= E.trovi) { const r = si.getBoundingClientRect(); tc.style.left = `${r.left + r.width / 2}px`; tc.style.top = `${r.top + r.height / 2}px`; }
  tc.style.opacity = kt > 0 && kt < 1 ? String(1 - kt) : '0';
  tc.style.transform = `scale(${0.4 + kt})`;
  // meta de 20.000 casas
  mostrar($('#obiettivo'), t, E.obiettivo - 0.05, E.scrivi);
  const ko = suave(fase(t, E.ventimila, 1.0));
  $('#obiettivo .barra i').style.width = `${100 * Math.min(1, totale / 20000) * ko}%`;
  $('#obiettivo .ora').textContent = `ORA: ${num(totale * ko)} 🏠`;
  // chamada final
  const cta = $('#cta').children;
  mostrar(cta[0], t, E.scrivi - 0.05, R.durata + 1, 20);
  mostrar(cta[1], t, E.regione - 0.3, R.durata + 1, 20);
  mostrar(cta[2], t, E.casa - 0.1, R.durata + 1, 20);
  mostrar(cta[3], t, E.mappa_f + 0.2, R.durata + 1, 20);
  legenda(t);
  mappa.renderer.render(mappa.scene, mappa.camera);
  return true;
}

// efeitos sonoros (o mixador strumenti/suoni.mjs sintetiza cada tipo)
function suoni() {
  const s = [], add = (t, tipo, extra = {}) => s.push({ t, tipo, vol: 0.8, ...extra });
  // abertura: as casas brotam, dia a dia
  add(0.02, 'whoosh', { vol: 0.7, dur: 1.4, giu: true }); add(E.tre + 0.05, 'stamp', { vol: 0.7 });
  for (let t = E.tre + 0.3, k = 0; t < E.arrivati + 0.6; t += 0.09, k++) add(t, 'tick', { vol: 0.32, tono: 1 + 0.6 * (t - E.tre) / (E.arrivati + 0.6 - E.tre) });
  for (let t = E.tre + 0.35, k = 0; t < E.arrivati + 0.6; t += 0.16, k++) add(t, 'pop', { vol: 0.28, tono: 0.8 + ((k * 37) % 9) / 12 });
  add(E.guardate - 0.05, 'whoosh', { vol: 0.6, dur: 1.0 }); add(E.arrivati + 0.6, 'ding', { vol: 0.5, tono: 1.2 });
  // Instagram: notificação + contadores
  add(E.views - 0.32, 'notifica', { vol: 0.75 }); add(E.views - 0.15, 'pop', { tono: 0.85 });
  for (const ev of [E.views, E.comm, E.follow]) {
    if (ev !== E.views) add(ev - 0.12, 'notifica', { vol: 0.6, tono: ev === E.comm ? 1.12 : 1.25 });
    for (let k = 0; k < 9; k++) add(ev - 0.1 + k * 0.09, 'tick', { vol: 0.3, tono: 1.1 + k * 0.06 });
    add(ev + 0.8, 'coin', { vol: 0.55 });
  }
  BOLLE.forEach((b, i) => { if (E.views - 0.2 + b.ini < E.mappa - 0.3 && i % 2 === 0) add(E.views - 0.2 + b.ini, 'pop', { vol: 0.22, tono: 1.2 + (i % 5) * 0.1 }); });
  // casas e cidades
  add(E.mappa - 0.1, 'whoosh', { vol: 0.7, dur: 1.1, giu: true });
  for (let t = E.mappa + 0.2; t < E.case + 0.7; t += 0.075) add(t, 'tick', { vol: 0.33, tono: 1 + 0.5 * (t - E.mappa) / (E.case + 0.7 - E.mappa) });
  add(E.case + 0.7, 'stamp', { vol: 0.85 }); add(E.case + 0.75, 'ding', { vol: 0.45, tono: 1.1 });
  add(E.citta - 0.05, 'select', { tono: 1.1 }); for (let k = 0; k < 6; k++) add(E.citta + k * 0.09, 'tick', { vol: 0.3, tono: 1.3 + k * 0.05 });
  add(E.citta + 0.6, 'pop', { vol: 0.6, tono: 1.0 });
  add(E.meta - 0.05, 'stamp', { vol: 0.75 }); add(E.meta + 0.1, 'ding', { vol: 0.45, tono: 1.3 });
  // regiões e site
  add(E.regioni - 0.08, 'whoosh', { vol: 0.5, dur: 0.7 }); add(E.regioni, 'stamp', { vol: 0.85 }); add(E.regioni + 0.12, 'coin', { vol: 0.5 });
  add(E.sito - 0.08, 'pop', { tono: 0.9 }); add(E.sito - 0.02, 'tap', { vol: 0.6 });
  for (let t = E.sito; t < E.visite + 0.4; t += 0.1) add(t, 'tick', { vol: 0.26, tono: 1.2 + 0.4 * (t - E.sito) / (E.visite + 0.4 - E.sito) });
  add(E.visite + 0.4, 'ding', { vol: 0.5, tono: 1.25 });
  // Napoli × Roma
  add(E.napoli - 0.25, 'whoosh', { vol: 0.85, dur: 1.4 }); add(E.napoli + 0.25, 'select', { tono: 1.0 }); add(E.roma + 0.1, 'select', { tono: 1.2 });
  add(E.testa - 0.05, 'boom', { vol: 0.55 }); add(E.testa, 'stamp', { vol: 1 });
  add(E.n361, 'pop', { vol: 0.7, tono: 1.1 }); add(E.n361 + 0.05, 'ding', { vol: 0.4, tono: 1.2 });
  add(E.n354, 'pop', { vol: 0.7, tono: 0.95 }); add(E.n354 + 0.05, 'ding', { vol: 0.4, tono: 1.05 });
  // derby
  add(E.ma - 0.1, 'whoosh', { vol: 0.8, dur: 1.3 }); add(E.ma, 'pop', { tono: 0.8 });
  add(E.schiaccia - 0.2, 'rullo', { dur: 0.95 }); add(E.milano + 0.15, 'stamp', { vol: 0.7 });
  add(E.doppio - 0.05, 'boom', { vol: 0.7 }); add(E.doppio, 'stamp', { vol: 1 });
  // presidência
  add(E.corsa - 0.1, 'whoosh', { vol: 0.9, dur: 2.0, giu: true }); add(E.infuocata, 'flap', { vol: 0.6 });
  add(E.rimini - 0.05, 'select', { tono: 1.25 }); add(E.rimini + 0.05, 'pop', { vol: 0.55 }); add(E.pts1 + 0.1, 'coin', { vol: 0.55 });
  add(E.poi - 0.15, 'whoosh', { vol: 0.6, dur: 1.2 }); add(E.poi, 'pop', { tono: 0.85 });
  add(E.casarsa, 'select', { tono: 1.1 }); add(E.melito, 'select', { tono: 0.95 }); add(E.poche, 'tick', { vol: 0.4 });
  add(E.domenica - 0.05, 'ding', { vol: 0.55, tono: 1.3 }); add(E.primo, 'flap', { vol: 0.7 });
  add(E.aperto - 0.1, 'rullo', { dur: 0.7 }); add(E.aperto + 0.6, 'stamp', { vol: 0.85 });
  // novidade + atividades reais
  add(E.cenovita, 'whoosh', { vol: 0.5, dur: 0.6 });
  add(E.novita - 0.05, 'boom', { vol: 0.9 }); add(E.novita, 'stamp', { vol: 1 });
  add(E.tredici - 0.05, 'whoosh', { vol: 0.8, dur: 2.0, giu: true });
  for (let k = 0; k < 13; k++) add(E.tredici + k * 0.06, 'tick', { vol: 0.3, tono: 1.1 + k * 0.04 });
  add(E.tredici + 0.8, 'coin', { vol: 0.6 });
  [E.psicologa, E.ristorante, E.distributore].forEach((ev, i) => { if (i) add(ev - 0.45, 'whoosh', { vol: 0.6, dur: 0.8 }); add(ev + 0.05, 'select', { tono: 1 + i * 0.1 }); add(ev + 0.12, 'pop', { vol: 0.5, tono: 1.1 + i * 0.1 }); });
  add(E.sehai - 0.05, 'pop', { tono: 0.9 }); add(E.tuacitta, 'ding', { vol: 0.45, tono: 1.15 });
  add(E.trovi - 0.05, 'pop', { tono: 1.0 }); add(E.sito2, 'tap'); add(E.sito2 + 0.1, 'notifica', { vol: 0.55, tono: 1.1 });
  // meta + chamada final
  add(E.obiettivo - 0.1, 'whoosh', { vol: 0.75, dur: 1.4, giu: true }); add(E.obiettivo, 'pop', { tono: 0.85 });
  add(E.ventimila, 'rullo', { dur: 1.0 }); add(E.ventimila + 1.0, 'stamp', { vol: 0.8 }); add(E.ventimila + 1.05, 'ding', { vol: 0.5, tono: 1.2 });
  add(E.scrivi - 0.1, 'whoosh', { vol: 0.7, dur: 1.2, giu: true }); add(E.scrivi, 'pop', { tono: 0.9 }); add(E.regione - 0.3, 'pop', { tono: 1.05 });
  add(E.casa - 0.1, 'pop', { tono: 1.15 }); add(E.mappa_f + 0.2, 'stamp', { vol: 0.75 }); add(E.mappa_f + 0.45, 'ding', { vol: 0.5 });
  return s.sort((a, b) => a.t - b.t);
}

async function preparar(roteiro) {
  R = roteiro; E = R.eventi; S = R.stats;
  await Promise.all(['900 104px Nunito', '900 60px Nunito', '800 40px Nunito', '700 30px Nunito'].map(f => document.fonts.load(f)));
  await document.fonts.ready;
  citta = new Citta(mappa, D);
  punti = criarPontos();
  const luogo = n => D.luoghi.find(l => l.nome === n);
  [roma, napoli, milano] = ['Roma', 'Napoli', 'Milano'].map(luogo);
  // Instagram
  $('#social').innerHTML = `<h2>📱 @italiacasapercasa</h2>${[['👁️', 'visualizzazioni'], ['💬', 'commenti'], ['👥', 'follower']].map(([e, n]) => `<div class="riga"><div class="em">${e}</div><div class="quem"><b>${n}</b></div><div class="num">0</div></div>`).join('')}`;
  $('#bolle').innerHTML = BOLLE.map(b => `<span>${b.em}</span>`).join('');
  // Napoli e Roma com número de casas
  for (const [l, ev, cl, lp] of [[napoli, E.napoli, '', E.n361], [roma, E.roma, ' bianco', E.n354]]) {
    etichette.push({ el: novaEtichetta(`<div class="box${cl}"><b>${esc(l.nome)}</b><span>🏠 ${num(l.case)} case</span></div><div class="freccia"></div>`, 'cartello'), pos: () => ({ x: l.x, y: mappa.altura(l.x, l.z) + 3, z: l.z }), ini: ev, fim: E.ma, lampo: lp });
  }
  // derby da semana (pontos reais)
  const dz = D.snap.derby;
  [derbyA, derbyB] = [[dz.a, dz.pts_a], [dz.b, dz.pts_b]].map(([istat, pts]) => ({ nome: D.comunePorIstat.get(istat).nome, pts })).sort((a, c) => c.pts - a.pts);
  $('#derby').innerHTML = `<h2>⚔️ DERBY DELLA SETTIMANA</h2>${[derbyA, derbyB].map((c, i) => `<div class="riga"><div class="em" style="background:${i ? '#E3F2FF' : '#FFE3E0'}">${i ? '🔵' : '🔴'}</div><div class="quem"><b>${esc(c.nome)}</b><div class="barra"><i data-pct="${(100 * c.pts / derbyA.pts).toFixed(1)}"></i></div></div><div class="pts" data-v="${c.pts}">0</div></div>`).join('')}`;
  // presidência: top 3 do mandato
  top3 = D.ranking.slice(0, 3);
  const pc = top3[0];
  pietro = { casa: pc, pos: citta.posCasa(pc) };
  etichette.push({
    el: novaEtichetta(`<div class="box"><b>🥇 @${esc(pc.conta)}</b><span>${esc(D.luoghi[pc.luogo].nome).toUpperCase()} · ${num(pc.sett)} PUNTI</span><small>1° NELLA CORSA ALLA PRESIDENZA</small></div><div class="freccia"></div>`, 'cartello'),
    pos: () => ({ x: pietro.pos.x, y: pietro.pos.y + ALTURA_NIVEL[pc.livello] * LOTE + LOTE * 0.35, z: pietro.pos.z }), ini: E.rimini - 0.05, fim: E.poi + 0.3, lampo: E.pts1,
  });
  $('#pres').innerHTML = `<h2>🏛️ PRIMO PRESIDENTE<br>DEL CONSIGLIO</h2><div class="quando">🗳️ domenica 1 novembre alle 21:00</div>
    ${top3.map((c, i) => `<div class="riga"><div class="pos"${i ? '' : ' style="background:var(--giallo)"'}>${i + 1}</div><div class="quem"><b>@${esc(c.conta)}</b><small>${esc(D.luoghi[c.luogo].nome)}</small><div class="barra"><i data-pct="${(100 * c.sett / top3[0].sett).toFixed(1)}"></i></div></div><div class="pts">${num(c.sett)}</div></div>`).join('')}`;
  // atividades reais (psicologa, ristorante, distributore)
  const porId = id => D.commerci.find(c => c.id === id);
  tour = R.tour.map(porId).filter(Boolean).map(cm => { citta.posCommercio(cm); return { cm, pos: { x: cm.x, y: cm.y, z: cm.z } }; });
  if (tour.length < 3) throw new Error('faltam atividades do tour no mapa');
  const evs = [E.psicologa, E.ristorante, E.distributore];
  tour.forEach((x, i) => {
    const [, emoji] = tipoDi(x.cm.tipo), alto = x.cm.prodotto === 'cartellone' ? 1.9 : 1.2;
    const el = novaEtichetta(`<div class="box">${x.cm.logo ? `<img src="${esc(x.cm.logo)}" alt="">` : ''}<b style="font-size:38px">${emoji} ${esc(x.cm.nome.length > 24 ? x.cm.nome.slice(0, 22) + '…' : x.cm.nome)}</b><span>${esc(x.cm.luogo.nome)} (${esc(x.cm.luogo.comune.sigla)})</span></div><div class="freccia"></div>`, 'cartello');
    etichette.push({ el, pos: () => ({ x: x.pos.x, y: x.pos.y + LOTE * alto, z: x.pos.z }), ini: i ? evs[i] - 0.1 : E.mappa13, fim: E.obiettivo - 0.2 });   // longe da câmera, a placa sai da tela sozinha
  });
  await Promise.all([...document.images].map(i => i.decode().catch(() => {})));
  $('#obiettivo').innerHTML = `<h2>🎯 PROSSIMO OBIETTIVO</h2><div class="meta forte g" style="-webkit-text-stroke-width:18px">20.000 CASE</div><div class="barra"><i></i></div><div class="ora"></div>`;
  montarChaves();
  const nAtt = D.commerci.length;
  scene = [
    [0, '3 GIORNI FA…', t => `📅 <span class="g">${giorno(limite(t))}</span>`],
    [E.guardate, 'GUARDATE DOVE', '<span class="g">SIAMO ARRIVATI 🚀</span>'],
    [E.views - 0.3, '', ''],
    [E.mappa, t => `🏠 <span class="g">${num(totale * limite(t))}</span>`, 'CASE', 'grande'],
    [E.citta - 0.05, t => `📍 <span class="g">${num(conta(t, E.citta - 0.05, 0.6, D.luoghi.length))}</span>`, 'CITTÀ', 'grande'],
    [E.regioni - 0.1, '', ''],
    [E.napoli - 0.1, 'NAPOLI <span class="r">VS</span> ROMA', ''],
    [E.ma - 0.1, '', ''],
    [E.corsa - 0.1, '🏛️ LA CORSA ALLA', '<span class="g">PRESIDENZA 🔥</span>'],
    [E.poi - 0.1, '', ''],
    [E.domenica - 0.1, 'DOMENICA ORE 21', '<span class="g">SI ELEGGE 🗳️</span>'],
    [E.aperto - 0.1, '', ''],
    [E.cenovita - 0.05, "E C'È UNA…", ''],
    [E.novita, '', ''],
    [E.tredici - 0.05, t => `🏪 <span class="g">${num(conta(t, E.tredici, 0.8, nAtt))}</span> ATTIVITÀ`, '<span class="g">VERE SULLA MAPPA</span>'],
    [E.sehai - 0.1, '', ''],
    [E.scrivi - 0.1, '', ''],
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
  console.log(`${totale} case · ${D.luoghi.length} città · ${nAtt} attività · derby ${derbyA.nome} ${derbyA.pts} x ${derbyB.nome} ${derbyB.pts} · top ${top3.map(c => `@${c.conta} ${c.sett}`).join(', ')} · tour ${tour.map(x => `${x.cm.nome} (${x.pos.x.toFixed(1)},${x.pos.z.toFixed(1)})`).join(', ')}`);
  quadro(0);
  return { durata: R.durata, fps: 30 };
}

iniciar().catch(e => console.error('erro ao carregar', e));
