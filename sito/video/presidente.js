// Reel com dados reais do mapa (casas, cidades, classificação): window.preparar(roteiro), window.quadro(t).
// Usa as cidades 3D do site (Citta) e uma casa de EXEMPLO inserida só aqui. Tudo depende só de t (vídeo determinístico).
import * as THREE from 'three';
import { carregar } from '../js/dati.js';
import { Mappa } from '../js/mappa.js';
import { Citta, posLote, DIST_CIDADE, LOTE } from '../js/citta.js';
import { ALTURA_NIVEL } from '../js/modelli.js';

const $ = s => document.querySelector(s);
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const suave = s => (s < 0.5 ? 4 * s * s * s : 1 - Math.pow(-2 * s + 2, 3) / 2);
const ressalto = s => { const c = 1.9; return s <= 0 ? 0 : s >= 1 ? 1 : 1 + (c + 1) * Math.pow(s - 1, 3) + c * Math.pow(s - 1, 2); };
const fase = (t, ini, dur) => clamp((t - ini) / dur);
const esc = s => String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
// separador de milhar sempre (o it-IT do Chrome não separa números de 4 dígitos)
const num = n => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');

let D, mappa, citta, R, E, chaves, casaEx, luogoEx, totale, punti, etichette = [], estadoEx = '';

async function iniciar() {
  D = await carregar('video');
  totale = D.casas.length;
  mappa = new Mappa($('#mappa'), D.geo, D.rilievo, D.imagem, { gravacao: true });
  window.preparar = preparar;
  window.quadro = quadro;
}

// casas como pontos que acendem em ordem de chegada (uniform "lim" de 0 a 1)
function criarPontos() {
  const ordem = D.casas.map((c, i) => i).sort((a, b) => D.casas[a].ts - D.casas[b].ts);
  const rank = new Float32Array(D.casas.length);
  ordem.forEach((i, k) => { rank[i] = (k + 1) / ordem.length; });
  const pos = new Float32Array(D.casas.length * 3), cor = new Float32Array(D.casas.length * 3), c = new THREE.Color();
  const CORES = ['#FFC93C', '#FF8A3D', '#FFFFFF', '#FFD86B', '#FF6B5A'];
  D.casas.forEach((casa, i) => {
    const l = D.luoghi[casa.luogo], q = posLote(casa.lote), x = l.x + q.x, z = l.z + q.z;
    pos.set([x, mappa.altura(x, z) + 0.03, z], i * 3);
    c.set(CORES[i % CORES.length]).toArray(cor, i * 3);
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('cor', new THREE.BufferAttribute(cor, 3));
  g.setAttribute('ord', new THREE.BufferAttribute(rank, 1));
  const mat = new THREE.ShaderMaterial({
    uniforms: { lim: { value: 1 }, escala: { value: 1920 / (2 * Math.tan(mappa.camera.fov * Math.PI / 360)) } },
    vertexShader: `
      attribute vec3 cor; attribute float ord; uniform float lim; uniform float escala; varying vec3 vCor;
      void main() {
        vCor = cor;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = ord > lim ? 0.0 : clamp(0.06 * escala / -mv.z, 13.0, 18.0);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      varying vec3 vCor;
      void main() {
        float d = length(gl_PointCoord - 0.5) * 2.0;
        if (d > 1.0) discard;
        gl_FragColor = vec4(d > 0.72 ? vec3(0.08, 0.13, 0.2) : vCor, 1.0);
        #include <colorspace_fragment>
      }`,
  });
  const p = new THREE.Points(g, mat);
  p.frustumCulled = false;
  p.renderOrder = 5;
  mappa.scene.add(p);
  return p;
}

// casa de exemplo (não existe no jogo): ocupa o próximo lote livre da cidade só neste vídeo
function inserirExemplo() {
  luogoEx = D.luoghi.find(l => l.nome === R.esempio.citta);
  const i = D.casas.length;
  casaEx = { i, conta: R.esempio.conta, luogo: luogoEx.id, lote: luogoEx.lotti, ts: Date.now(), tot: 15, sett: 15, fiamme: 0, fonti: [10, 5, 0, 0, 0, 0, 0], serie: 1, livello: 1, carica: null };
  D.casas.push(casaEx);
  luogoEx.casas.push(i);
  luogoEx.lotti += 1;
}
function estadoExemplo(t) {
  const livello = t < E.cresce ? 1 : t < E.livello2 ? 3 : t < E.livello3 ? 7 : t < E.livello4 ? 9 : 11;
  const fogo = t >= E.fiamme && t < E.cresce;
  const k = `${livello}:${fogo}`;
  if (k === estadoEx) return;
  estadoEx = k;
  casaEx.livello = livello;
  casaEx.fiamme = fogo ? 4e9 : 0;
  citta.cache.delete(luogoEx.id);
  citta.ultimo = null;
  citta.atualizar(true);
}

// ---------- câmera: chaves (t, alvo, dist, az, giu) ----------
function montarChaves() {
  const b = D.geo.bbox, alt = b.z1 - b.z0;
  const dP = mappa.distPais();
  const paese = { x: (b.x0 + b.x1) / 2, z: (b.z0 + b.z1) / 2 - alt * 0.07, dist: dP, az: 0, giu: 0 };
  const L = nome => { const l = D.luoghi.find(x => x.nome === nome); return { x: l.x, z: l.z, giu: 0.13 }; };
  const roma = L(R.roma), mil = L(R.sindaci[0]), nap = L(R.sindaci[1]);
  const pe = citta.posCasa(casaEx), ex = { x: pe.x, z: pe.z, giu: 0.1 };
  const lista = [
    [0, { ...paese, dist: dP * 1.04 }],
    [E.roma - 0.05, { ...paese, dist: dP * 0.97 }],
    [E.roma + 1.25, { ...roma, dist: 1.5, az: 0.5 }],
    [E.card, { dist: 1.35, az: 0.65 }],
    [E.sindaco - 0.02, { dist: 1.1, az: 0.95 }],
    [E.sindaco, { ...mil, dist: 1.0, az: 0.35 }, true],
    [E.sindaco2 - 0.02, { dist: 0.85, az: 0.6 }],
    [E.sindaco2, { ...nap, dist: 1.0, az: 0.3 }, true],
    [E.classifica - 0.02, { dist: 0.85, az: 0.5 }],
    [E.classifica + 1.3, { ...paese }],
    [E.commenta, { ...paese, dist: dP * 0.97 }],
    [E.commenta + 1.7, { ...ex, dist: 5, az: 0.35 }],
    [E.tagga, { dist: 3, az: 0.45 }],
    [E.storia, { dist: 1.6, az: 0.55 }],
    [E.storia + 1.0, { dist: 0.3, az: 0.65, giu: 0.04 }],
    [E.cresce, { dist: 0.34, az: 0.8 }],
    [E.livello4, { dist: 0.62, az: 1.0, giu: -0.05 }],
    [E.zoomout, { dist: 0.66, az: 1.05 }],
    [E.zoomout + 1.4, { ...paese }],
    [R.durata, { ...paese, dist: dP * 1.08 }],
  ];
  let ant = {};
  chaves = lista.map(([t, k, corte]) => { ant = { ...ant, ...k }; return { t, k: { ...ant }, corte: !!corte }; });
}

function camera(t) {
  let i = 0;
  while (i < chaves.length - 2 && t >= chaves[i + 1].t) i++;
  const a = chaves[i], b = chaves[Math.min(i + 1, chaves.length - 1)];
  const s = b.t > a.t ? suave(clamp((t - a.t) / (b.t - a.t))) : 1;
  const A = a.k, B = b.k, l = (p, q) => p + (q - p) * s;
  // voo longo: sobe no meio do caminho (como o mappa.voar do site)
  const dxz = Math.hypot(B.x - A.x, B.z - A.z), bump = 0.35 * Math.max(0, Math.log(dxz / Math.max(A.dist, B.dist) + 1));
  const dist = Math.exp(l(Math.log(A.dist), Math.log(B.dist)) + bump * Math.sin(Math.PI * s));
  // em voo longo o alvo chega antes do zoom: a cidade aparece no centro e vai crescendo (sem minutos de grama)
  const sxz = dxz > 20 ? suave(clamp((t - a.t) / ((b.t - a.t) * 0.55))) : s;
  const az = l(A.az, B.az), giu = l(A.giu, B.giu), x = A.x + (B.x - A.x) * sxz, z = A.z + (B.z - A.z) * sxz;
  mappa.az = az;
  mappa.dist = dist;
  // "giu": o ponto de interesse fica mais baixo na tela (alvo além dele, longe da câmera)
  mappa.alvo.x = x - Math.sin(az) * giu * dist;
  mappa.alvo.z = z - Math.cos(az) * giu * dist;
  mappa.atualizarCamera();
  return { dist };
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
function mostrar(el, t, ini, fim, { sobe = 20 } = {}) {
  const ent = ressalto(fase(t, ini, 0.3)), sai = fase(t, fim - 0.2, 0.2);
  const vis = t >= ini && t < fim;
  el.style.opacity = vis ? String(1 - sai) : '0';
  if (vis) el.style.transform = `translateY(${(1 - Math.min(1, ent)) * sobe - sai * 40}px) scale(${0.85 + 0.15 * ent})`;
}
function digitar(el, t, ini, fim, txt, de, ate) {
  mostrar(el, t, ini, fim);
  if (t < ini || t >= fim) return;
  const n = Math.round(clamp((t - de) / (ate - de)) * txt.length);
  const parte = esc(txt.slice(0, n)).replace(/(@[\w.]+)/g, '<span class="at">$1</span>');
  const cursor = (t * 2.4) % 1 < 0.55 || n < txt.length ? '<span class="cursore"></span>' : '';
  el.querySelector('.testo').innerHTML = parte + cursor;
}
function chip(el, t, ini, dur = 1.1) {
  const s = ressalto(fase(t, ini, 0.3)), sai = fase(t, ini + dur - 0.25, 0.25);
  el.style.opacity = t >= ini && t < ini + dur ? String(1 - sai) : '0';
  el.style.transform = `translateX(-50%) translateY(${-sai * 80}px) scale(${s})`;
}

function quadro(t) {
  estadoExemplo(t);
  const k = camera(t);
  punti.visible = k.dist > DIST_CIDADE * 0.55;
  punti.material.uniforms.lim.value = t < 0.2 ? 0.02 : clamp(0.02 + 0.98 * suave(fase(t, 0.2, E.contatore_a - 0.2)));
  if (citta.chamas.length) citta.animar(t * 1000);

  // cabeçalho com o contador subindo junto com os pontos
  const n = Math.round(totale * clamp(punti.material.uniforms.lim.value));
  $('#contatore').innerHTML = `<span class="g">${num(t < E.contatore_a ? n : totale)}</span> ${esc(R.unita)}`;

  // etiquetas sobre a praça (cargos ainda vazios) e sobre a casa de exemplo
  for (const e of etichette) {
    const vis = t >= e.ini && t < e.fim;
    if (!vis) { e.el.style.opacity = '0'; continue; }
    const h = e.casa ? casaEx.y + ALTURA_NIVEL[casaEx.livello] * LOTE + 0.004 : citta.dadosCidade(e.l).hc + LOTE * 1.15;
    const x = e.casa ? casaEx.x : e.l.x, z = e.casa ? casaEx.z : e.l.z;
    const p = projetar(x, h, z), s = ressalto(fase(t, e.ini, 0.32)) * (1 - fase(t, e.fim - 0.2, 0.2));
    e.el.style.opacity = p.ok ? '1' : '0';
    e.el.style.transform = `translate(${p.x - e.el.offsetWidth / 2}px, ${p.y - e.el.offsetHeight}px) scale(${s})`;
  }

  mostrar($('#card'), t, E.card, E.sindaco);
  mostrar($('#classifica'), t, E.classifica, E.commenta);
  document.querySelectorAll('#classifica .riga').forEach((r, i) => {
    const s = fase(t, E.classifica + 0.35 + i * 0.3, 0.3);
    r.style.opacity = String(s);
    r.style.transform = `translateX(${(1 - s) * 40}px)`;
    r.querySelector('.barra i').style.width = `${r.dataset.pct * suave(fase(t, E.classifica + 0.5 + i * 0.3, 0.8))}%`;
  });
  digitar($('#commento'), t, E.commenta, E.tagga, R.commento.testo, E.commenta + 0.25, E.piu5 - 0.15);
  digitar($('#tag'), t, E.tagga, E.storia, R.tag.testo, E.tagga + 0.2, E.piu3 - 0.1);
  chip($('#piu5'), t, E.piu5);
  chip($('#piu3'), t, E.piu3);
  chip($('#piu20'), t, E.piu20, 1.5);
  const sb = fase(t, E.banner, 0.3), bn = $('#banner');
  bn.style.opacity = String(sb);
  bn.style.transform = `translateY(${(1 - sb) * 20}px)`;
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
  punti = criarPontos();
  montarChaves();

  $('#titolo').textContent = R.titolo;
  $('#card .sopra').textContent = R.card.sopra;
  $('#card .grande').textContent = R.card.grande;
  $('#card .sotto').textContent = R.card.sotto;
  for (const id of ['commento', 'tag']) $(`#${id} .chi`).innerHTML = `${esc(R[id].utente)} <span>· ora</span>`;
  $('#banner').textContent = `📍 ${R.banner}`;
  // top 3 reais da semana
  const top = D.ranking.filter(c => c !== casaEx).slice(0, 3), max = top[0]?.sett || 1;
  $('#classifica').insertAdjacentHTML('beforeend', top.map((c, i) => `
    <div class="riga" data-pct="${(100 * c.sett / max).toFixed(1)}"><div class="pos">${i + 1}</div>
    <div class="quem"><b>@${esc(c.conta)}</b><small>${esc(D.luoghi[c.luogo].nome)}</small><div class="barra"><i></i></div></div>
    <div class="pts">${num(c.sett)}</div></div>`).join(''));
  const lu = nome => D.luoghi.find(l => l.nome === nome);
  etichette = [
    { el: criarEtichetta('carica', '', 'PRESIDENTE: ???', `si elegge domenica alle 21`), l: lu(R.roma), ini: E.capo, fim: E.sindaco },
    { el: criarEtichetta('carica', '', `SINDACO: ???`, R.sindaci[0]), l: lu(R.sindaci[0]), ini: E.sindaco + 0.15, fim: E.sindaco2 },
    { el: criarEtichetta('carica', '', `SINDACO: ???`, R.sindaci[1]), l: lu(R.sindaci[1]), ini: E.sindaco2 + 0.1, fim: E.classifica },
    { el: criarEtichetta('', 'ESEMPIO', R.esempio.conta, R.esempio.luogo), casa: true, ini: E.storia + 0.6, fim: E.zoomout + 0.3 },
  ];
  // capa: título grande no lugar da legenda
  if (R.copertina) {
    const cp = R.copertina;
    $('#testa').style.top = `${cp.testa_top ?? 120}px`;
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
