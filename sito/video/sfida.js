// Reel "sfida" (reel 20): derby da semana Napoli × Torino com o placar real (snapshot.derby). Placar no 1º segundo,
// o Itália com as duas cidades, Napoli com "quase o dobro", Torino vazia ("dove siete?"), comentários que dão pontos,
// o calendário de domingo e a chamada (escreva a cidade, marque um amigo torinese). O fim repete o começo (loop).
// window.preparar/quadro/suoni; tudo depende só de t.
import * as THREE from 'three';
import { carregar } from '../js/dati.js';
import { Mappa, COR_MAR } from '../js/mappa.js';
import { Citta, DIST_CIDADE } from '../js/citta.js';

const $ = s => document.querySelector(s);
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const suave = s => (s < 0.5 ? 4 * s * s * s : 1 - Math.pow(-2 * s + 2, 3) / 2);
const ressalto = s => { const c = 1.9; return s <= 0 ? 0 : s >= 1 ? 1 : 1 + (c + 1) * Math.pow(s - 1, 3) + c * Math.pow(s - 1, 2); };
const fase = (t, ini, dur) => clamp((t - ini) / dur);
const esc = s => String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
const num = n => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
const conta = (t, ini, dur, v, de = 0) => de + (v - de) * (1 - Math.pow(1 - fase(t, ini, dur), 3));

let D, mappa, citta, R, E, chaves, punti, etichette = [], na, to, PA, PB;
const GIORNO = { mar: new THREE.Color(COR_MAR), terra: new THREE.Color('#ffffff'), ceu: 2.3, sol: 2.4, ceuC: new THREE.Color('#ffffff'), solC: new THREE.Color('#fff1dc') };
const NOTTE = { mar: new THREE.Color('#1B2E55'), terra: new THREE.Color('#7381A8'), ceu: 1.1, sol: 0.7, ceuC: new THREE.Color('#B9C6FF'), solC: new THREE.Color('#A9BBFF') };

async function iniciar() {
  D = await carregar('video');
  mappa = new Mappa($('#mappa'), D.geo, D.rilievo, D.imagem, { gravacao: true });
  window.preparar = preparar;
  window.quadro = quadro;
  window.suoni = suoni;
}

function ceu(k) {
  const c = GIORNO.mar.clone().lerp(NOTTE.mar, k);
  mappa.scene.background.copy(c); mappa.scene.fog.color.copy(c); mappa.mar.material.color.copy(c);
  mappa.matTerreno.color.copy(GIORNO.terra.clone().lerp(NOTTE.terra, k));
  mappa.ceu.intensity = GIORNO.ceu + (NOTTE.ceu - GIORNO.ceu) * k; mappa.ceu.color.copy(GIORNO.ceuC.clone().lerp(NOTTE.ceuC, k));
  mappa.sol.intensity = GIORNO.sol + (NOTTE.sol - GIORNO.sol) * k; mappa.sol.color.copy(GIORNO.solC.clone().lerp(NOTTE.solC, k));
  mappa.notte = k > 0.6;
  citta.grupoNotte.visible = k > 0.6;
}

// uma bolinha por cidade com casa; Napoli e Torino maiores, nas cores dos dois lados
function criarPontos() {
  const ls = D.luoghi.filter(l => l.casas.length);
  const pos = new Float32Array(ls.length * 3), lado = new Float32Array(ls.length);
  ls.forEach((l, i) => { pos.set([l.x, mappa.altura(l.x, l.z) + 0.03, l.z], i * 3); lado[i] = l === na.l ? 1 : l === to.l ? 2 : 0; });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('lado', new THREE.BufferAttribute(lado, 1));
  const mat = new THREE.ShaderMaterial({
    uniforms: { pulso: { value: 0 }, escala: { value: 1920 / (2 * Math.tan(mappa.camera.fov * Math.PI / 360)) } },
    vertexShader: `
      attribute float lado; uniform float escala; uniform float pulso; varying float vLado;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vLado = lado;
        float s = clamp(0.05 * escala / -mv.z, 11.0, 16.0);
        gl_PointSize = lado > 0.5 ? s * (3.2 + 0.5 * pulso) : s;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      varying float vLado;
      void main() {
        float d = length(gl_PointCoord - 0.5) * 2.0;
        if (d > 1.0) discard;
        vec3 c = vLado > 1.5 ? vec3(0.48, 0.12, 0.18) : vLado > 0.5 ? vec3(0.055, 0.545, 0.816) : vec3(1.0);
        gl_FragColor = vec4(d > (vLado > 0.5 ? 0.78 : 0.62) ? vec3(0.08, 0.13, 0.2) : c, 1.0);
        #include <colorspace_fragment>
      }`,
  });
  const p = new THREE.Points(g, mat);
  p.frustumCulled = false; p.renderOrder = 5;
  mappa.scene.add(p);
  return p;
}

// cortes secos (flash + batida)
const TAGLI = () => [E.e1 - 0.1, E.e2 - 0.1, E.torinesi - 0.1, E.ogni - 0.1, E.domenica - 0.1, E.se - 0.1, E.e8 - 0.1, E.perche - 0.1];

// ---------- câmera ----------
function montarChaves() {
  const b = D.geo.bbox, alt = b.z1 - b.z0, dP = mappa.distPais();
  const paese = { x: (b.x0 + b.x1) / 2, z: (b.z0 + b.z1) / 2 - alt * 0.07, dist: dP, az: 0, giu: 0 };
  const P = (o, k = {}) => ({ x: o.x, z: o.z, giu: 0, ...k });
  const mid = { x: (na.x + to.x) / 2, z: (na.z + to.z) / 2 };
  const [T1, T2, T3, T4, T5, T6, T7, T8] = TAGLI();
  const cena = (ini, fim, a, c) => [[ini, a], [fim - 0.01, c]];
  // o começo e o fim são a mesma tomada: o fim chega exatamente onde o começo parte
  const ABRE = P(mid, { dist: dP * 1.45, az: -0.04, giu: 0.12 });
  const lista = [
    ...cena(0, T1, ABRE, P(mid, { dist: dP * 1.38, az: 0.02, giu: 0.12 })),
    ...cena(T1, T2, { ...paese, dist: dP * 1.5, az: 0.06, giu: 0.1 }, { ...paese, dist: dP * 1.4, az: -0.03, giu: 0.1 }),
    ...cena(T2, T3, P(na, { dist: 1.7, az: 0.3, giu: 0.16 }), P(na, { dist: 1.15, az: 1.0, giu: 0.16 })),
    ...cena(T3, T4, P(to, { dist: 1.8, az: -0.4, giu: 0.16 }), P(to, { dist: 1.25, az: -1.1, giu: 0.16 })),
    ...cena(T4, T5, P(mid, { dist: dP * 0.6, az: 0.35, giu: -0.1 }), P(mid, { dist: dP * 0.55, az: 0.5, giu: -0.1 })),
    ...cena(T5, T6, { ...paese, dist: dP * 0.8, az: -0.12 }, { ...paese, dist: dP * 0.9, az: 0.08 }),
    ...cena(T6, T7, P(na, { dist: 1.9, az: 1.6, giu: 0.16 }), P(na, { dist: 1.4, az: 2.2, giu: 0.16 })),
    ...cena(T7, T8, P(to, { dist: 1.9, az: 0.6, giu: 0.16 }), P(to, { dist: 1.4, az: 1.2, giu: 0.16 })),
    [T8, P(mid, { dist: dP * 1.5, az: -0.1, giu: 0.12 })],
    [R.durata, ABRE],
  ];
  chaves = lista.sort((a, c) => a[0] - c[0]).map(([t, k]) => ({ t, k }));
}
function camera(t) {
  let i = 0;
  while (i < chaves.length - 2 && t >= chaves[i + 1].t) i++;
  const a = chaves[i], b = chaves[Math.min(i + 1, chaves.length - 1)];
  const s = b.t > a.t ? suave(clamp((t - a.t) / (b.t - a.t))) : 1;
  const sl = a.t >= TAGLI()[7] - 0.01 ? clamp((t - a.t) / (b.t - a.t)) : s;   // volta ao começo sem freada (loop)
  const A = a.k, B = b.k, l = (p, q) => p + (q - p) * sl;
  const dist = Math.exp(l(Math.log(A.dist), Math.log(B.dist)));
  const tremor = [[E.distruggendo, 0.4], [E.derby, 0.3], [E.doppio, 0.45], [E.siete, 0.4], [E.ventuno, 0.35], [E.tagga, 0.3]]
    .reduce((v, [ti, d]) => v + (t >= ti && t < ti + d ? 0.014 * (1 - (t - ti) / d) * Math.sin((t - ti) * 70) : 0), 0);
  const soco = [E.distruggendo, E.doppio, E.siete].reduce((v, ti) => v + (t >= ti && t < ti + 0.5 ? 0.12 * Math.sin(Math.PI * (t - ti) / 0.5) : 0), 0);
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
function carimbo(el, t, ini, fim, rot = -4) {
  const k = ressalto(fase(t, ini, 0.3)), vis = t >= ini && t < fim;
  el.style.opacity = vis ? String(1 - fase(t, fim - 0.2, 0.2)) : '0';
  if (vis) el.style.transform = `scale(${t < ini + 0.1 ? 1.6 - 0.6 * k : 1 + 0.035 * Math.sin((t - ini) * 10)}) rotate(${rot}deg)`;
}
const batida = (t, ti) => (t >= ti && t < ti + 0.35 ? 1 + 0.3 * Math.sin(Math.PI * (t - ti) / 0.35) : 1);
const CORES = ['#0E8BD0', '#7A1E2E', '#FFFFFF', '#FFC93C', '#6FD3FF', '#FF8FA3'];
const CONF = Array.from({ length: 64 }, (_, i) => ({ x: (i * 157) % 1080, atraso: ((i * 37) % 30) / 60, vel: 700 + ((i * 53) % 500), giro: ((i * 91) % 720) - 360, dx: ((i * 29) % 160) - 80, cor: CORES[i % CORES.length] }));
const BURST = () => [E.distruggendo, E.doppio];
function coriandoli(t) {
  const t0 = BURST().filter(b => t >= b).at(-1);
  [...$('#coriandoli').children].forEach((el, i) => {
    const c = CONF[i], dt = t0 == null ? -1 : t - t0 - c.atraso, vis = dt > 0 && dt < 2.0;
    el.style.opacity = vis ? String(1 - fase(dt, 1.4, 0.6)) : '0';
    if (vis) el.style.transform = `translate(${c.x + c.dx * Math.sin(dt * 4)}px, ${-60 + c.vel * dt}px) rotate(${c.giro * dt}deg)`;
  });
}

function placar(t) {
  const tab = $('#tab'), [, T2, , T4, T5, , , T8] = TAGLI();
  const cheio = t < T2 || t >= T8, mini = t >= T4 && t < T5;
  tab.style.opacity = cheio || mini ? '1' : '0';
  const ini = mini ? T4 : T8, k = t >= ini ? ressalto(fase(t, ini, 0.3)) : 1;
  tab.style.transform = mini ? `translateY(-40px) scale(${0.72 * (0.6 + 0.4 * k)})` : `scale(${t >= T8 ? 0.6 + 0.4 * k : 1})`;
  const n = tab.querySelectorAll('.n');
  n[0].textContent = num(PA); n[1].textContent = num(PB);
  n[0].style.transform = `scale(${batida(t, E.distruggendo)})`;
  // a barra: Napoli empurra Torino (no começo cresce até o valor real)
  const pa = PA / (PA + PB || 1);
  tab.querySelector('.barra i').style.width = `${100 * (t < 1.4 ? 0.5 + (pa - 0.5) * suave(fase(t, 0.2, 1.1)) : pa)}%`;
  const gap = tab.querySelector('.gap');
  gap.textContent = `🌋 NAPOLI +${num(PA - PB)} PUNTI`;
  gap.style.display = mini ? 'none' : '';
  gap.style.transform = `scale(${batida(t, E.torino0) * (1 + 0.03 * Math.sin(t * 9))})`;
  tab.querySelector('.tit').style.transform = `scale(${batida(t, E.derby)})`;
  tab.querySelector('.vs').style.transform = `rotate(${10 * Math.sin(t * 4)}deg)`;
}

function quadro(t) {
  const dist = camera(t);
  punti.visible = dist > DIST_CIDADE * 0.55;
  punti.material.uniforms.pulso.value = 0.5 + 0.5 * Math.sin(t * 7);
  const [T1, T2, T3, T4, T5, T6, T7, T8] = TAGLI();
  // noite nas duas cidades (janelas acesas em Napoli, Torino "vazia")
  const kn = (t >= T2 && t < T4) || (t >= T6 && t < T8) ? 1 : 0;
  ceu(kn);
  $('#vignetta').style.opacity = String(kn);
  $('#tinta').style.opacity = String(t >= T6 && t < E.scrivilo - 0.05 ? 0.9 * (1 - fase(t, E.scrivilo - 0.25, 0.2)) : 0);
  const fl = Math.max(...TAGLI().map(tc => (t >= tc ? 0.75 * (1 - fase(t, tc, 0.22)) : 0)), ...[E.doppio, E.siete].map(ti => (t >= ti ? 0.6 * (1 - fase(t, ti, 0.3)) : 0)));
  $('#velo').style.opacity = String(fl);
  $('#velo').style.background = t >= E.doppio && t < E.doppio + 0.3 ? '#FFC93C' : '#FFFFFF';
  placar(t);
  // cidades: nome + contagem até os pontos da semana
  const cl = $('#clab'), naN = t >= T2 && t < T3, naT = t >= T3 && t < T4;
  if (naN || naT) {
    const c = naN ? { nome: 'NAPOLI', ic: '🌋', ini: T2, n0: E.napoli2, n1: E.doppio, v: PA, cls: 'az' } : { nome: 'TORINO', ic: '🐂', ini: T3, n0: E.torinesi, n1: E.dove, v: PB, cls: 'gr' };
    mostrar(cl, t, c.ini, naN ? T3 : T4, 40);
    const nm = `${c.ic} <span class="${c.cls}">${c.nome}</span>`;
    if (cl.querySelector('.nm').innerHTML !== nm) cl.querySelector('.nm').innerHTML = nm;
    cl.querySelector('.n').textContent = num(conta(t, c.n0, c.n1 - c.n0, c.v, 0));
    cl.querySelector('.n').style.transform = `scale(${batida(t, c.n1)})`;
  } else cl.style.opacity = '0';
  carimbo($('#stamp-doppio'), t, E.doppio - 0.05, T3);
  carimbo($('#stamp-dove'), t, E.dove - 0.05, T4, 3);
  for (const e of etichette) {
    const vis = e.vis(t);
    if (!vis) { e.el.style.opacity = '0'; continue; }
    const p = projetar(e.p.x, e.p.y, e.p.z);
    const s = e.ini(t) < 0 ? 1 : ressalto(fase(t, e.ini(t), 0.32));
    e.el.style.opacity = p.ok ? '1' : '0';
    e.el.style.transform = `translate(${p.x - e.el.offsetWidth / 2}px, ${p.y - e.el.offsetHeight - 30}px) scale(${s})`;
  }
  // comentários que dão pontos
  mostrar($('#feed'), t, T4, T5);
  $('#feed').querySelectorAll('.riga').forEach((r, i) => {
    const ti = [E.commento, E.citta5, E.punti5][i];
    pulo(r, t, ti);
    r.querySelector('.pt').style.transform = `scale(${t >= ti + 0.2 ? ressalto(fase(t, ti + 0.2, 0.3)) : 0})`;
  });
  // calendário
  const ca = $('#calendario');
  mostrar(ca, t, T5, T6, 40);
  ca.querySelector('.cal').style.transform = `rotate(${-3 + 3 * Math.sin(t * 3)}deg) scale(${batida(t, E.domenica)})`;
  pulo(ca.querySelector('.ora'), t, E.ventuno - 0.1);
  // napoletani × torinesi, depois a chamada
  pulo($('#vs-a'), t, E.napoli7 - 0.05, 'rotate(-4deg)'); pulo($('#vs-b'), t, E.torino7 - 0.05, 'rotate(4deg)');
  if (t < T6 || t >= E.scrivilo - 0.05) { $('#vs-a').style.opacity = '0'; $('#vs-b').style.opacity = '0'; }
  const cta = $('#cta').children;
  mostrar(cta[0], t, E.scrivilo - 0.05, T8, 20);
  mostrar(cta[1], t, E.tagga - 0.1, T8, 20);
  if (t >= E.torinese) cta[1].style.transform = `rotate(${4 * Math.sin(t * 8)}deg) scale(${batida(t, E.torinese)})`;
  coriandoli(t);
  legenda(t);
  mappa.renderer.render(mappa.scene, mappa.camera);
  return true;
}

// efeitos sonoros: um por acontecimento na tela
function suoni() {
  const s = [], add = (t, tipo, extra = {}) => s.push({ t, tipo, vol: 0.8, ...extra });
  const entra = (t, forte = false) => { add(t - 0.03, 'pop', { vol: forte ? 0.75 : 0.5 }); if (forte) add(t + 0.02, 'whoosh', { vol: 0.35, dur: 0.4 }); };
  const [T1, T2, T3, T4, T5, T6, T7, T8] = TAGLI();
  // 1. gancho: placar já na tela, a barra empurra
  add(0, 'stamp', { vol: 0.85 }); add(0.02, 'boom', { vol: 0.55 }); add(0.05, 'fischio', { vol: 0.35, dur: 0.5 });
  for (let t = 0.2, k = 0; t < 1.3; t += 0.1, k++) add(t, 'tick', { vol: 0.2, tono: 0.9 + k * 0.05 });
  add(E.distruggendo - 0.02, 'boom', { vol: 0.85 }); add(E.distruggendo, 'stamp', { vol: 0.9 });
  add(E.torino0, 'pop', { vol: 0.55, tono: 0.85 }); add(E.torino0 + 0.05, 'tick', { vol: 0.4, tono: 0.7 });
  TAGLI().forEach(tc => { add(tc - 0.12, 'whoosh', { vol: 0.42, dur: 0.3 }); add(tc - 0.01, 'boom', { vol: 0.22 }); add(tc, 'pop', { vol: 0.34, tono: 0.7 }); });
  // 2. derby da semana: as duas bolinhas acendem
  entra(T1 + 0.05, true); add(E.derby, 'flap', { vol: 0.55 }); add(E.settimana, 'ding', { vol: 0.45, tono: 1.1 });
  // 3. Napoli: contagem e "quase o dobro"
  entra(T2 + 0.08, true);
  for (let t = E.napoli2, k = 0; t < E.doppio; t += 0.07, k++) add(t, 'tick', { vol: 0.2, tono: 0.9 + 0.5 * k * 0.07 / (E.doppio - E.napoli2) });
  add(E.doppio - 0.42, 'silenzio', { dur: 0.36 }); add(E.doppio - 0.4, 'riser', { dur: 0.36, vol: 0.55 });
  add(E.doppio - 0.04, 'boom', { vol: 0.95 }); add(E.doppio - 0.03, 'stamp', { vol: 1 }); add(E.doppio, 'coin', { vol: 0.55 }); add(E.doppio + 0.05, 'fuoco', { vol: 0.4 });
  // 4. Torino: contagem curta, "dove siete?" com silêncio e tique de relógio
  entra(T3 + 0.08, true);
  for (let t = E.torinesi, k = 0; t < E.dove; t += 0.09, k++) add(t, 'tick', { vol: 0.16, tono: 0.8 - 0.2 * k * 0.09 / (E.dove - E.torinesi) });
  add(E.dove - 0.05, 'stamp', { vol: 0.85 }); add(E.siete, 'boom', { vol: 0.6 });
  for (let k = 0; k < 3; k++) add(E.siete + 0.3 + k * 0.18, 'tick', { vol: 0.3, tono: 1.6 });
  // 5. comentários: cada um dá pontos
  entra(T4 + 0.05, true);
  [E.commento, E.citta5, E.punti5].forEach((ti, i) => { add(ti - 0.02, 'bolla', { vol: 0.55, tono: 0.95 + i * 0.07 }); add(ti + 0.2, 'coin', { vol: 0.42, tono: 1 + i * 0.1 }); });
  add(E.citta5b, 'ding', { vol: 0.45, tono: 1.2 });
  // 6. calendário
  entra(T5 + 0.05, true); add(E.domenica, 'stamp', { vol: 0.7 }); add(E.ventuno - 0.1, 'ding', { vol: 0.55, tono: 1.1 }); add(E.chiude, 'fischio', { vol: 0.35, dur: 0.4 });
  // 7. napoletani × torinesi e a chamada
  add(T6 + 0.05, 'fischio', { vol: 0.45, dur: 0.45 }); add(E.napoli7 - 0.05, 'stamp', { vol: 0.7 }); add(E.torino7 - 0.05, 'stamp', { vol: 0.7 });
  add(E.scrivilo - 0.05, 'pop', { tono: 0.9 }); add(E.sotto, 'tasto', { vol: 0.6 }); add(E.sotto + 0.08, 'tasto', { vol: 0.5, tono: 1.1 });
  entra(T7 + 0.05); add(E.tagga - 0.1, 'pop', { vol: 0.7, tono: 1.1 }); add(E.amico, 'notifica', { vol: 0.55 }); add(E.torinese, 'ding', { vol: 0.45, tono: 1.3 });
  // 8. volta ao placar (loop)
  add(T8, 'riser', { dur: R.durata - T8, vol: 0.45 });
  return s.sort((a, b) => a.t - b.t);
}

async function preparar(roteiro) {
  R = roteiro; E = R.eventi;
  await Promise.all(['900 104px Nunito', '900 60px Nunito', '800 40px Nunito', '700 30px Nunito'].map(f => document.fonts.load(f)));
  await document.fonts.ready;
  citta = new Citta(mappa, D);
  const acha = nome => { const l = D.luoghi.find(x => x.nome === nome); if (!l) throw new Error(`${nome} não está no mapa`); return { l, x: l.x, z: l.z }; };
  na = acha(R.a.nome); to = acha(R.b.nome);
  // placar real do derby da semana (snapshot.derby: a = Napoli, b = Torino)
  const dz = D.snap.derby;
  const aE = D.comunePorIstat.get(dz.a)?.nome === R.a.nome;
  PA = aE ? dz.pts_a : dz.pts_b; PB = aE ? dz.pts_b : dz.pts_a;
  punti = criarPontos();
  const pino = (c, txt, cor) => ({ p: { x: c.x, y: mappa.altura(c.x, c.z) + 0.05, z: c.z }, el: novaEtichetta(`<div class="box" style="background:${cor}">${txt}</div><div class="freccia"></div>`) });
  const [T1, T2, , T4, T5, , , T8] = TAGLI();
  const pa = pino(na, `🌋 NAPOLI ${num(PA)}`, 'var(--na)'), pb = pino(to, `🐂 TORINO ${num(PB)}`, 'var(--to)');
  // pinos no gancho, no "derby della settimana", nos comentários e no fim (já na tela no quadro 0, para o loop)
  const vis = d => t => t < T2 || t >= T8;
  const ini = d => t => (t < T1 ? -1 : t >= T8 ? T8 + d : T1 + d);
  etichette.push({ ...pa, vis: vis(0), ini: ini(0) });
  etichette.push({ ...pb, vis: vis(0.15), ini: ini(0.15) });
  $('#coriandoli').innerHTML = CONF.map(c => `<i style="background:${c.cor}"></i>`).join('');
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
    if (cp.senza_tab) $('#tab').style.display = 'none';
    $('#fisso').style.display = 'none';
    $('#coriandoli').style.display = 'none';
  }
  console.log(`dati ${D.snap.dati_fino} · derby ${R.a.nome} ${PA} × ${R.b.nome} ${PB} · mandato ${D.snap.mandato.n} fim ${D.snap.mandato.fine}`);
  quadro(0);
  return { durata: R.durata, fps: 30 };
}

iniciar().catch(e => console.error('erro ao carregar', e));
