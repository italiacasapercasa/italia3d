// Reel "derby" (reel 15): Roma × Napoli com dados reais. Placar no 1º segundo, as duas cidades em 3D, comentários que
// viram casas, pontos ×2 até a meia-noite, "chi vince?" e a chamada para mandar o vídeo a quem torce pelo outro lado.
// O último quadro repete o primeiro (placar + mesma câmera), para o reel emendar em loop.
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
const conta = (t, ini, dur, v, de = 0) => de + (v - de) * (1 - Math.pow(1 - fase(t, ini, dur), 3));

let D, mappa, citta, R, E, chaves, punti, etichette = [], ro, na;
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

// uma bolinha por cidade com casa; Roma e Napoli maiores, nas cores dos dois lados
function criarPontos() {
  const ls = D.luoghi.filter(l => l.casas.length);
  const pos = new Float32Array(ls.length * 3), lado = new Float32Array(ls.length);
  ls.forEach((l, i) => { pos.set([l.x, mappa.altura(l.x, l.z) + 0.03, l.z], i * 3); lado[i] = l === ro.l ? 1 : l === na.l ? 2 : 0; });
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
        vec3 c = vLado > 1.5 ? vec3(0.055, 0.545, 0.816) : vLado > 0.5 ? vec3(0.96, 0.72, 0.0) : vec3(1.0);
        float borda = vLado > 0.5 ? 0.78 : 0.62;
        gl_FragColor = vec4(d > borda ? (vLado > 0.5 && vLado < 1.5 ? vec3(0.54, 0.08, 0.22) : vec3(0.08, 0.13, 0.2)) : c, 1.0);
        #include <colorspace_fragment>
      }`,
  });
  const p = new THREE.Points(g, mat);
  p.frustumCulled = false; p.renderOrder = 5;
  mappa.scene.add(p);
  return p;
}

// cortes secos (flash + batida): cada cena nova entra de supetão
const TAGLI = () => [E.sulla - 0.1, E.roma - 0.1, E.napoli - 0.1, E.ogni - 0.1, E.e4 - 0.1, E.romani - 0.1, E.scrivi - 0.1, E.perche - 0.1];

// ---------- câmera ----------
function montarChaves() {
  const b = D.geo.bbox, alt = b.z1 - b.z0, dP = mappa.distPais();
  const paese = { x: (b.x0 + b.x1) / 2, z: (b.z0 + b.z1) / 2 - alt * 0.07, dist: dP, az: 0, giu: 0 };
  const P = (o, k = {}) => ({ x: o.x, z: o.z, giu: 0, ...k });
  const mid = { x: (ro.x + na.x) / 2, z: (ro.z + na.z) / 2 };
  const [T1, T2, T3, T4, T5, T6, T7, T8] = TAGLI();
  const cena = (ini, fim, a, c) => [[ini, a], [fim - 0.01, c]];
  // o começo e o fim são a mesma tomada: o fim chega exatamente onde o começo parte
  const ABRE = P(mid, { dist: dP * 0.37, az: -0.15, giu: 0.03 });
  const lista = [
    ...cena(0, T1, ABRE, P(mid, { dist: dP * 0.34, az: 0.02, giu: 0.03 })),
    ...cena(T1, T2, { ...paese, dist: dP * 1.02, az: 0.1 }, { ...paese, dist: dP * 0.86, az: -0.02 }),
    ...cena(T2, T3, P(ro, { dist: 1.7, az: 0.3, giu: 0.16 }), P(ro, { dist: 1.15, az: 1.0, giu: 0.16 })),
    ...cena(T3, T4, P(na, { dist: 1.7, az: -0.4, giu: 0.16 }), P(na, { dist: 1.15, az: -1.1, giu: 0.16 })),
    ...cena(T4, T5, P(mid, { dist: dP * 0.42, az: 0.35 }), P(mid, { dist: dP * 0.37, az: 0.5 })),
    ...cena(T5, T6, { ...paese, dist: dP * 0.8, az: -0.12 }, { ...paese, dist: dP * 0.9, az: 0.08 }),
    ...cena(T6, T7, P(mid, { dist: dP * 0.37, az: -0.45 }), P(mid, { dist: dP * 0.34, az: 0.15 })),
    ...cena(T7, T8, { ...paese, dist: dP * 0.86, az: 0.05 }, { ...paese, dist: dP * 1.0, az: -0.05 }),
    [T8, P(mid, { dist: dP * 0.41, az: -0.32, giu: 0.03 })],
    [R.durata, ABRE],
  ];
  chaves = lista.sort((a, c) => a[0] - c[0]).map(([t, k]) => ({ t, k }));
}
function camera(t) {
  let i = 0;
  while (i < chaves.length - 2 && t >= chaves[i + 1].t) i++;
  const a = chaves[i], b = chaves[Math.min(i + 1, chaves.length - 1)];
  const s = b.t > a.t ? suave(clamp((t - a.t) / (b.t - a.t))) : 1;
  // no fim (volta ao começo) o movimento é linear, para emendar sem freada no loop
  const sl = a.t >= E.perche - 0.11 ? clamp((t - a.t) / (b.t - a.t)) : s;
  const A = a.k, B = b.k, l = (p, q) => p + (q - p) * sl;
  const dist = Math.exp(l(Math.log(A.dist), Math.log(B.dist)));
  const tremor = [[E.venti, 0.35], [E.cinque, 0.35], [E.quattro, 0.35], [E.doppio, 0.5], [E.vince, 0.4], [E.manda, 0.3]]
    .reduce((v, [ti, d]) => v + (t >= ti && t < ti + d ? 0.014 * (1 - (t - ti) / d) * Math.sin((t - ti) * 70) : 0), 0);
  const soco = [E.venti, E.doppio, E.vince].reduce((v, ti) => v + (t >= ti && t < ti + 0.5 ? 0.12 * Math.sin(Math.PI * (t - ti) / 0.5) : 0), 0);
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
// batida num número que acabou de mudar
const batida = (t, ti) => (t >= ti && t < ti + 0.35 ? 1 + 0.3 * Math.sin(Math.PI * (t - ti) / 0.35) : 1);
const CORES = ['#8A1538', '#F5B700', '#0E8BD0', '#FFFFFF', '#6FD3FF', '#FFC93C'];
const CONF = Array.from({ length: 64 }, (_, i) => ({ x: (i * 157) % 1080, atraso: ((i * 37) % 30) / 60, vel: 700 + ((i * 53) % 500), giro: ((i * 91) % 720) - 360, dx: ((i * 29) % 160) - 80, cor: CORES[i % CORES.length] }));
const BURST = () => [E.doppio, E.vince];
function coriandoli(t) {
  const t0 = BURST().filter(b => t >= b).at(-1);
  [...$('#coriandoli').children].forEach((el, i) => {
    const c = CONF[i], dt = t0 == null ? -1 : t - t0 - c.atraso, vis = dt > 0 && dt < 2.0;
    el.style.opacity = vis ? String(1 - fase(dt, 1.4, 0.6)) : '0';
    if (vis) el.style.transform = `translate(${c.x + c.dx * Math.sin(dt * 4)}px, ${-60 + c.vel * dt}px) rotate(${c.giro * dt}deg)`;
  });
}

function placar(t) {
  const tab = $('#tab'), [T1, , , T4, T5, , , T8] = TAGLI();
  const cheio = t < T1 || t >= T8, mini = t >= T4 && t < T5;
  tab.style.opacity = cheio || mini ? '1' : '0';
  const ini = mini ? T4 : T8, k = t >= ini ? ressalto(fase(t, ini, 0.3)) : 1;
  // no começo o placar já está lá (gancho no 1º segundo); o gap pulsa no "venti"
  tab.style.transform = mini ? `translateY(-50px) scale(${0.72 * (0.6 + 0.4 * k)})` : `scale(${t >= T8 ? 0.6 + 0.4 * k : 1})`;
  let a = R.a.case, b = R.b.case, ba = 1, bb = 1;
  if (mini) {
    a += (t >= E.ogni) + (t >= E.citta); b += (t >= E.commento) + (t >= E.casa);
    ba = Math.max(batida(t, E.ogni + 0.2), batida(t, E.citta + 0.2)); bb = Math.max(batida(t, E.commento + 0.2), batida(t, E.casa + 0.2));
  }
  const n = tab.querySelectorAll('.n');
  n[0].textContent = a; n[1].textContent = b;
  n[0].style.transform = `scale(${ba})`; n[1].style.transform = `scale(${bb})`;
  const gap = tab.querySelector('.gap');
  gap.textContent = `SOLO ${Math.abs(a - b)} CASE DI DISTACCO`;
  gap.style.display = mini ? 'none' : '';
  gap.style.transform = `scale(${batida(t, E.venti) * (1 + 0.03 * Math.sin(t * 9))})`;
  tab.querySelector('.vs').style.transform = `rotate(${8 * Math.sin(t * 4)}deg) scale(${batida(t, E.roma0)})`;
}

function quadro(t) {
  const dist = camera(t);
  punti.visible = dist > DIST_CIDADE * 0.55;
  punti.material.uniforms.pulso.value = 0.5 + 0.5 * Math.sin(t * 7);
  const [T1, T2, T3, T4, T5, T6, T7, T8] = TAGLI();
  // noite só na cena "fino a mezzanotte"
  const kn = t >= T5 && t < T6 ? suave(fase(t, T5, 0.5)) : 0;
  ceu(kn);
  $('#vignetta').style.opacity = String(kn);
  $('#tinta').style.opacity = String(t >= T6 && t < T7 ? 0.9 * (1 - fase(t, T7 - 0.2, 0.2)) : 0);
  const fl = Math.max(...TAGLI().map(tc => (t >= tc ? 0.75 * (1 - fase(t, tc, 0.22)) : 0)),
    ...[E.doppio, E.vince].map(ti => (t >= ti ? 0.6 * (1 - fase(t, ti, 0.3)) : 0)));
  $('#velo').style.opacity = String(fl);
  $('#velo').style.background = t >= E.doppio && t < E.doppio + 0.3 ? '#FFC93C' : '#FFFFFF';
  placar(t);
  // cidades: nome + contagem até o número dito
  const cl = $('#clab'), naRoma = t >= T2 && t < T3, naNap = t >= T3 && t < T4;
  if (naRoma || naNap) {
    const c = naRoma ? { ...R.a, ic: '🐺', ini: T2, n0: E.roma, n1: E.cinque + 0.3, cls: 'rm' } : { ...R.b, ic: '🌋', ini: T3, n0: E.napoli + 0.1, n1: E.quattro + 0.5, cls: 'az' };
    mostrar(cl, t, c.ini, naRoma ? T3 : T4, 40);
    const nm = `${c.ic} <span class="${c.cls}">${esc(c.nome)}</span>`;
    if (cl.querySelector('.nm').innerHTML !== nm) cl.querySelector('.nm').innerHTML = nm;
    const v = Math.round(conta(t, c.n0, c.n1 - c.n0, c.case, 0));
    cl.querySelector('.n').textContent = t >= c.n0 ? v : '0';
    cl.querySelector('.n').style.transform = `scale(${batida(t, c.n1)})`;
  } else cl.style.opacity = '0';
  for (const e of etichette) {
    const vis = e.vis(t);
    if (!vis) { e.el.style.opacity = '0'; continue; }
    const p = projetar(e.p.x, e.p.y, e.p.z);
    const s = ressalto(fase(t, e.ini(t), 0.32));
    e.el.style.opacity = p.ok ? '1' : '0';
    e.el.style.transform = `translate(${p.x - e.el.offsetWidth / 2}px, ${p.y - e.el.offsetHeight - 30}px) scale(${s})`;
  }
  // comentários que viram casas
  mostrar($('#feed'), t, T4, T5);
  $('#feed').querySelectorAll('.riga').forEach((r, i) => {
    const ti = [E.ogni, E.commento, E.citta, E.casa][i];
    pulo(r, t, ti);
    r.querySelector('.pt').style.transform = `scale(${t >= ti + 0.2 ? ressalto(fase(t, ti + 0.2, 0.3)) : 0})`;
  });
  // ×2 até a meia-noite
  mostrar($('#notte'), t, E.e4 - 0.05, T6);
  $('#notte .orol').style.transform = `rotate(${t >= E.mezzanotte ? 360 * suave(fase(t, E.mezzanotte, 0.6)) : 0}deg) scale(${batida(t, E.mezzanotte)})`;
  carimbo($('#stamp-x2'), t, E.doppio - 0.05, T6);
  // romani × napoletani
  pulo($('#vs-a'), t, E.romani, `rotate(-4deg)`); pulo($('#vs-b'), t, E.napoletani, `rotate(4deg)`);
  if (t >= T7) { $('#vs-a').style.opacity = '0'; $('#vs-b').style.opacity = '0'; }
  carimbo($('#stamp-chi'), t, E.vince - 0.08, T7, 3);
  // chamada final
  const cta = $('#cta').children;
  mostrar(cta[0], t, E.scrivi - 0.05, T8, 20);
  pulo(cta[1], t, E.manda - 0.05);
  if (t >= E.manda) cta[1].style.transform = `translate(${t >= E.video ? 30 * Math.sin((t - E.video) * 9) : 0}px, 0) rotate(${10 * Math.sin(t * 6)}deg) scale(${batida(t, E.manda) * (t < E.manda + 0.3 ? 0.4 + 0.6 * ressalto(fase(t, E.manda - 0.05, 0.3)) : 1)})`;
  mostrar(cta[2], t, E.tifa - 0.1, T8, 20);
  if (t >= T8) for (const c of cta) c.style.opacity = '0';
  coriandoli(t);
  legenda(t);
  mappa.renderer.render(mappa.scene, mappa.camera);
  return true;
}

// efeitos sonoros: um por acontecimento na tela; os impactos (20, ×2, chi vince) são os mais fortes
function suoni() {
  const s = [], add = (t, tipo, extra = {}) => s.push({ t, tipo, vol: 0.8, ...extra });
  const entra = (t, forte = false) => { add(t - 0.03, 'pop', { vol: forte ? 0.75 : 0.5 }); if (forte) add(t + 0.02, 'whoosh', { vol: 0.35, dur: 0.4 }); };
  // 1. gancho: placar já na tela
  add(0, 'stamp', { vol: 0.85 }); add(0.02, 'boom', { vol: 0.55 }); add(0.05, 'fischio', { vol: 0.35, dur: 0.5 });
  add(E.venti - 0.3, 'rullo', { dur: 0.28, vol: 0.45 }); add(E.venti - 0.02, 'boom', { vol: 0.75 }); add(E.venti, 'stamp', { vol: 0.9 }); add(E.venti + 0.04, 'ding', { vol: 0.4, tono: 0.85 });
  add(E.roma0, 'pop', { vol: 0.55, tono: 0.9 }); add(E.roma0 + 0.05, 'tick', { vol: 0.4 });
  TAGLI().forEach(tc => { add(tc - 0.12, 'whoosh', { vol: 0.42, dur: 0.3 }); add(tc - 0.01, 'boom', { vol: 0.22 }); add(tc, 'pop', { vol: 0.34, tono: 0.7 }); });
  // 2. mapa 3D da Itália: as bolinhas de Roma e Napoli acendem
  add(E.mappa, 'scintilla', { vol: 0.45 }); entra(E.tred, true); add(E.italia + 0.1, 'pop', { vol: 0.5, tono: 1.1 }); add(E.italia + 0.25, 'pop', { vol: 0.5, tono: 0.95 });
  // 3. Roma: contagem
  add(E.roma - 0.05, 'whoosh', { vol: 0.5, dur: 0.5, giu: true }); entra(E.roma, true);
  for (let t = E.roma, k = 0; t < E.cinque + 0.25; t += 0.07, k++) add(t, 'tick', { vol: 0.2, tono: 0.9 + 0.5 * k * 0.07 / (E.cinque + 0.3 - E.roma) });
  add(E.cinque + 0.28, 'stamp', { vol: 0.75 }); add(E.cinque + 0.3, 'coin', { vol: 0.55 });
  // 4. Napoli: contagem
  add(E.napoli - 0.05, 'whoosh', { vol: 0.5, dur: 0.5, giu: true }); entra(E.napoli, true);
  for (let t = E.napoli + 0.1, k = 0; t < E.quattro + 0.45; t += 0.07, k++) add(t, 'tick', { vol: 0.2, tono: 0.85 + 0.5 * k * 0.07 / (E.quattro + 0.5 - E.napoli) });
  add(E.quattro + 0.48, 'stamp', { vol: 0.75 }); add(E.quattro + 0.5, 'coin', { vol: 0.55, tono: 0.9 });
  // 5. comentários: cada um vira +1 casa
  entra(E.ogni - 0.1, true);
  [E.ogni, E.commento, E.citta, E.casa].forEach((ti, i) => { add(ti - 0.02, 'bolla', { vol: 0.55, tono: 0.95 + i * 0.07 }); add(ti + 0.2, 'coin', { vol: 0.42, tono: 1 + i * 0.1 }); add(ti + 0.22, 'tick', { vol: 0.3, tono: i % 2 ? 0.8 : 1 }); });
  add(E.piu, 'ding', { vol: 0.45, tono: 1.2 });
  // 6. noite: ×2 até a meia-noite
  add(E.e4 - 0.1, 'whoosh', { vol: 0.55, dur: 1.0, giu: true }); add(E.e4 + 0.05, 'vento', { vol: 0.25, dur: 1.6 });
  entra(E.e4, true);
  for (let t = E.e4 + 0.2, k = 0; t < E.mezzanotte; t += 0.25, k++) add(t, 'tick', { vol: 0.35, tono: k % 2 ? 0.75 : 0.9 });
  add(E.mezzanotte, 'ding', { vol: 0.6, tono: 0.7 }); add(E.mezzanotte + 0.05, 'whoosh', { vol: 0.3, dur: 0.6 });
  add(E.doppio - 0.5, 'silenzio', { dur: 0.48 }); add(E.doppio - 0.48, 'riser', { dur: 0.46, vol: 0.6 });
  add(E.doppio - 0.02, 'boom', { vol: 0.95 }); add(E.doppio, 'stamp', { vol: 1 }); add(E.doppio + 0.03, 'coin', { vol: 0.6 }); add(E.doppio + 0.05, 'fuoco', { vol: 0.45 });
  for (let k = 0; k < 6; k++) add(E.doppio + 0.12 + k * 0.11, 'pop', { vol: 0.22, tono: 1 + ((k * 5) % 7) * 0.08 });
  // 7. romani × napoletani: apito de jogo e "chi vince?"
  add(E.romani - 0.05, 'fischio', { vol: 0.45, dur: 0.45 });
  add(E.romani, 'stamp', { vol: 0.7 }); add(E.napoletani, 'stamp', { vol: 0.7 }); add(E.napoletani + 0.03, 'pop', { vol: 0.5, tono: 1.15 });
  add(E.chi - 0.35, 'rullo', { dur: 0.33, vol: 0.55 });
  add(E.vince - 0.1, 'boom', { vol: 0.95 }); add(E.vince - 0.08, 'stamp', { vol: 1 }); add(E.vince, 'scintilla', { vol: 0.5 });
  // 8. chamada final
  add(E.scrivi - 0.05, 'pop', { tono: 0.9 }); add(E.citta2, 'tasto', { vol: 0.6 }); add(E.citta2 + 0.08, 'tasto', { vol: 0.5, tono: 1.1 }); add(E.citta2 + 0.16, 'tasto', { vol: 0.55 });
  add(E.manda - 0.05, 'pop', { vol: 0.7, tono: 1.1 }); add(E.manda, 'whoosh', { vol: 0.45, dur: 0.35 }); add(E.video, 'notifica', { vol: 0.55 });
  add(E.tifa - 0.1, 'pop', { tono: 1.05 }); add(E.altra, 'ding', { vol: 0.45, tono: 1.3 });
  // 9. volta ao placar (loop)
  add(E.perche - 0.05, 'riser', { dur: E.adesso - E.perche + 0.5, vol: 0.45 });
  add(E.adesso + 0.2, 'tick', { vol: 0.4 });
  return s.sort((a, b) => a.t - b.t);
}

async function preparar(roteiro) {
  R = roteiro; E = R.eventi;
  await Promise.all(['900 104px Nunito', '900 60px Nunito', '800 40px Nunito', '700 30px Nunito'].map(f => document.fonts.load(f)));
  await document.fonts.ready;
  citta = new Citta(mappa, D);
  const acha = nome => { const l = D.luoghi.find(x => x.nome === nome); if (!l) throw new Error(`${nome} não está no mapa`); return { l, x: l.x, z: l.z }; };
  ro = acha(R.a.nome); na = acha(R.b.nome);
  punti = criarPontos();
  const pino = (c, txt, cor) => ({ p: { x: c.x, y: mappa.altura(c.x, c.z) + 0.05, z: c.z }, el: novaEtichetta(`<div class="box" style="background:${cor}">${txt}</div><div class="freccia"></div>`) });
  const [, T2, , , , T6, T7] = TAGLI();
  // pinos no mapa: na tomada da Itália ("mappa 3D") e no "romani × napoletani"
  const pa = pino(ro, `🐺 <span style="color:#F5B700">ROMA</span>`, 'var(--roma)'), pb = pino(na, `🌋 <span style="color:#fff">NAPOLI</span>`, 'var(--napoli)');
  pa.el.querySelector('.box').style.color = '#F5B700'; pb.el.querySelector('.box').style.color = '#fff';
  // pinos também no gancho e no fim (já na tela no quadro 0, para o loop)
  const [T1, , , , , , , T8] = TAGLI();
  const cenaPino = d => t => (t < T1 ? -1 : t >= T8 ? T8 + d : t >= T6 && t < T7 ? T6 + d : E.italia + d);
  const visPino = d => t => t < T1 || t >= T8 || (t >= E.italia + d && t < T2) || (t >= T6 && t < T7);
  etichette.push({ ...pa, vis: visPino(0), ini: cenaPino(0) });
  etichette.push({ ...pb, vis: visPino(0.15), ini: cenaPino(0.15) });
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
  const real = l => l.casas.length;
  console.log(`dati ${D.snap.dati_fino} · Roma ${real(ro.l)} · Napoli ${real(na.l)} (narração: ${R.a.case} × ${R.b.case})`);
  quadro(0);
  return { durata: R.durata, fps: 30 };
}

iniciar().catch(e => console.error('erro ao carregar', e));
