// Gera os dados geográficos do mapa da Itália:
//   sito/data/geo.json      -> projeção, regiões, metadados
//   sito/data/comuni.json   -> todos os comuni (ISTAT) com posição e população
//   sito/data/rilievo.bin   -> grade de altitude (Uint16, metros) para a malha 3D
//   sito/data/terreno.png   -> textura do mapa (relevo sombreado + divisas)
// Uso: node strumenti/build-geo.mjs
import fs from 'node:fs';
import path from 'node:path';
import { proj, desproj, PROJ, BBOX } from './geo-comum.mjs';
import { lerPNG, gravarPNG } from './png.mjs';

const RAIZ = path.resolve(import.meta.dirname, '..');
const GREZZI = path.join(RAIZ, 'dati-grezzi');
const SAIDA = path.join(RAIZ, 'sito', 'data');
fs.mkdirSync(path.join(GREZZI, 'terrarium'), { recursive: true });
fs.mkdirSync(SAIDA, { recursive: true });

const FONTES = {
  regioni: 'https://raw.githubusercontent.com/openpolis/geojson-italy/master/geojson/limits_IT_regions.geojson',
  comuniGeo: 'https://raw.githubusercontent.com/openpolis/geojson-italy/master/geojson/limits_IT_municipalities.geojson',
  comuni: 'https://raw.githubusercontent.com/matteocontrini/comuni-json/master/comuni.json',
  coord: 'https://raw.githubusercontent.com/MatteoHenryChinaski/Comuni-Italiani-2018-Sql-Json-excel/master/italy_geo.json',
  terrarium: (z, x, y) => `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${z}/${x}/${y}.png`,
};

const SIGLE = {
  '01': 'PIEM.', '02': "VALLE D'AOSTA", '03': 'LOMB.', '04': 'TRENTINO-A.A.', '05': 'VENETO', '06': 'FRIULI-V.G.',
  '07': 'LIGURIA', '08': 'EMILIA-R.', '09': 'TOSCANA', '10': 'UMBRIA', '11': 'MARCHE', '12': 'LAZIO', '13': 'ABRUZZO',
  '14': 'MOLISE', '15': 'CAMPANIA', '16': 'PUGLIA', '17': 'BASILICATA', '18': 'CALABRIA', '19': 'SICILIA', '20': 'SARDEGNA',
};

async function baixar(url, arq) {
  if (fs.existsSync(arq)) return fs.readFileSync(arq);
  for (let t = 0; ; t++) {
    try {
      const r = await fetch(url);
      if (!r.ok) throw new Error(`HTTP ${r.status} ${url}`);
      const b = Buffer.from(await r.arrayBuffer());
      fs.writeFileSync(arq, b);
      return b;
    } catch (e) {
      if (t >= 3) throw e;
      await new Promise(ok => setTimeout(ok, 1000 * (t + 1)));
    }
  }
}

const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

// ---------- 1. fontes ----------
log('baixando fontes…');
const regioniGeo = JSON.parse(await baixar(FONTES.regioni, path.join(GREZZI, 'regioni.geojson')));
const comuniLista = JSON.parse(await baixar(FONTES.comuni, path.join(GREZZI, 'comuni.json')));
const coordLista = JSON.parse(await baixar(FONTES.coord, path.join(GREZZI, 'italy_geo.json')));
const comuniGeo = JSON.parse(await baixar(FONTES.comuniGeo, path.join(GREZZI, 'comuni.geojson')));

// ---------- 2. raster: grade da textura ----------
const RES = 0.5; // km por pixel
const W = Math.round((BBOX.x1 - BBOX.x0) / RES), H = Math.round((BBOX.z1 - BBOX.z0) / RES);
log(`textura ${W}x${H}`);

const aneisExternos = geom => (geom.type === 'Polygon' ? [geom.coordinates] : geom.coordinates).map(p => p[0]);

// preenche um anel (em coordenadas de pixel) com scanline
function preencher(anel, raster, valor) {
  let ymin = Infinity, ymax = -Infinity;
  for (const [, y] of anel) { if (y < ymin) ymin = y; if (y > ymax) ymax = y; }
  const y0 = Math.max(0, Math.floor(ymin)), y1 = Math.min(H - 1, Math.ceil(ymax));
  const xs = [];
  for (let y = y0; y <= y1; y++) {
    const cy = y + 0.5;
    xs.length = 0;
    for (let i = 0, j = anel.length - 1; i < anel.length; j = i++) {
      const [xi, yi] = anel[i], [xj, yj] = anel[j];
      if ((yi > cy) !== (yj > cy)) xs.push(xi + (cy - yi) / (yj - yi) * (xj - xi));
    }
    xs.sort((a, b) => a - b);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      const a = Math.max(0, Math.ceil(xs[k] - 0.5)), b = Math.min(W - 1, Math.floor(xs[k + 1] - 0.5));
      for (let x = a; x <= b; x++) raster[y * W + x] = valor;
    }
  }
}
const paraPixel = ([lon, lat]) => { const [x, z] = proj(lon, lat); return [(x - BBOX.x0) / RES, (z - BBOX.z0) / RES]; };

const regioes = regioniGeo.features.map(f => ({
  cod: String(f.properties.reg_istat_code ?? f.properties.reg_istat_code_num).padStart(2, '0'),
  nome: f.properties.reg_name,
  geom: f.geometry,
})).sort((a, b) => a.cod.localeCompare(b.cod));
log(`${regioes.length} regiões`);

const idRegiao = new Uint8Array(W * H); // 0 = mar
regioes.forEach((r, i) => { for (const anel of aneisExternos(r.geom)) preencher(anel.map(paraPixel), idRegiao, i + 1); });

// ---------- 3. altitude (terrarium z8) ----------
const Z = 8, N = 2 ** Z;
const gx = lon => (lon + 180) / 360 * N * 256;
const gy = lat => { const r = lat * Math.PI / 180; return (1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2 * N * 256; };
const [lonA, latA] = desproj(BBOX.x0, BBOX.z0), [lonB, latB] = desproj(BBOX.x1, BBOX.z1);
const tx0 = Math.floor(gx(lonA) / 256), tx1 = Math.floor(gx(lonB) / 256);
const ty0 = Math.floor(gy(latA) / 256), ty1 = Math.floor(gy(latB) / 256);
const MW = (tx1 - tx0 + 1) * 256, MH = (ty1 - ty0 + 1) * 256;
const mosaico = new Float32Array(MW * MH);
const tiles = [];
for (let y = ty0; y <= ty1; y++) for (let x = tx0; x <= tx1; x++) tiles.push([x, y]);
log(`baixando ${tiles.length} tiles de relevo…`);
let feitos = 0;
async function trabalhador() {
  while (tiles.length) {
    const [x, y] = tiles.pop();
    const png = lerPNG(await baixar(FONTES.terrarium(Z, x, y), path.join(GREZZI, 'terrarium', `${Z}_${x}_${y}.png`)));
    for (let py = 0; py < 256; py++) for (let px = 0; px < 256; px++) {
      const o = (py * 256 + px) * png.bpp;
      mosaico[((y - ty0) * 256 + py) * MW + (x - tx0) * 256 + px] = png.px[o] * 256 + png.px[o + 1] + png.px[o + 2] / 256 - 32768;
    }
    if (++feitos % 20 === 0) log(`  ${feitos} tiles`);
  }
}
await Promise.all(Array.from({ length: 8 }, trabalhador));

function altitude(lon, lat) {
  const fx = gx(lon) - tx0 * 256 - 0.5, fy = gy(lat) - ty0 * 256 - 0.5;
  const x = Math.max(0, Math.min(MW - 2, Math.floor(fx))), y = Math.max(0, Math.min(MH - 2, Math.floor(fy)));
  const ax = fx - x, ay = fy - y, i = y * MW + x;
  return (mosaico[i] * (1 - ax) + mosaico[i + 1] * ax) * (1 - ay) + (mosaico[i + MW] * (1 - ax) + mosaico[i + MW + 1] * ax) * ay;
}

const alt = new Float32Array(W * H);
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  const i = y * W + x;
  if (!idRegiao[i]) continue;
  const [lon, lat] = desproj(BBOX.x0 + (x + 0.5) * RES, BBOX.z0 + (y + 0.5) * RES);
  alt[i] = Math.max(1, altitude(lon, lat));
}
log('altitude amostrada');

// ---------- 4. textura ----------
const PALETA = [
  [0, [166, 207, 124]], [150, [154, 199, 113]], [400, [141, 187, 104]], [800, [128, 171, 95]],
  [1200, [150, 163, 104]], [1700, [176, 160, 126]], [2300, [198, 189, 175]], [2800, [236, 236, 234]], [4500, [252, 252, 252]],
];
function corAlt(h) {
  for (let k = 1; k < PALETA.length; k++) if (h <= PALETA[k][0]) {
    const [h0, c0] = PALETA[k - 1], [h1, c1] = PALETA[k], t = (h - h0) / (h1 - h0);
    return [c0[0] + (c1[0] - c0[0]) * t, c0[1] + (c1[1] - c0[1]) * t, c0[2] + (c1[2] - c0[2]) * t];
  }
  return PALETA[PALETA.length - 1][1];
}

// halo de água rasa perto da costa: máscara borrada
let halo = new Float32Array(W * H);
for (let i = 0; i < W * H; i++) halo[i] = idRegiao[i] ? 1 : 0;
function borrar(src, r) {
  const tmp = new Float32Array(W * H), dst = new Float32Array(W * H), k = 1 / (2 * r + 1);
  for (let y = 0; y < H; y++) { let s = 0; for (let x = -r; x <= r; x++) s += src[y * W + Math.min(W - 1, Math.max(0, x))]; for (let x = 0; x < W; x++) { tmp[y * W + x] = s * k; s += src[y * W + Math.min(W - 1, x + r + 1)] - src[y * W + Math.max(0, x - r)]; } }
  for (let x = 0; x < W; x++) { let s = 0; for (let y = -r; y <= r; y++) s += tmp[Math.min(H - 1, Math.max(0, y)) * W + x]; for (let y = 0; y < H; y++) { dst[y * W + x] = s * k; s += tmp[Math.min(H - 1, y + r + 1) * W + x] - tmp[Math.max(0, y - r) * W + x]; } }
  return dst;
}
halo = borrar(borrar(halo, 7), 7);

const MAR = [142, 191, 210], RASO = [170, 211, 225];
const ALT_SOL = 50 * Math.PI / 180, ZF = 2.2, PLANO = Math.sin(ALT_SOL);
const L = [-Math.cos(ALT_SOL) * Math.SQRT1_2, -Math.cos(ALT_SOL) * Math.SQRT1_2, Math.sin(ALT_SOL)]; // luz do noroeste
const rgb = Buffer.alloc(W * H * 3);
const A = (x, y) => alt[Math.min(H - 1, Math.max(0, y)) * W + Math.min(W - 1, Math.max(0, x))];
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  const i = y * W + x;
  let c;
  if (!idRegiao[i]) {
    const t = Math.min(1, halo[i] * 2.4);
    c = [MAR[0] + (RASO[0] - MAR[0]) * t, MAR[1] + (RASO[1] - MAR[1]) * t, MAR[2] + (RASO[2] - MAR[2]) * t];
  } else {
    const dx = (A(x + 1, y) - A(x - 1, y)) / (2 * RES * 1000) * ZF;
    const dy = (A(x, y + 1) - A(x, y - 1)) / (2 * RES * 1000) * ZF;
    const n = 1 / Math.hypot(dx, dy, 1);
    const luz = Math.max(0, (-dx * L[0] - dy * L[1] + L[2]) * n);
    const m = Math.min(1.28, Math.max(0.58, 1 + (luz - PLANO) * 0.9));
    c = corAlt(alt[i]).map(v => v * m);
    // divisa entre regiões
    const r = idRegiao[i];
    const viz = [x > 0 && idRegiao[i - 1], x < W - 1 && idRegiao[i + 1], y > 0 && idRegiao[i - W], y < H - 1 && idRegiao[i + W]];
    if (viz.some(v => v && v !== r)) c = c.map(v => v * 0.35 + 255 * 0.65);
  }
  rgb[i * 3] = Math.min(255, c[0]); rgb[i * 3 + 1] = Math.min(255, c[1]); rgb[i * 3 + 2] = Math.min(255, c[2]);
}
gravarPNG(path.join(SAIDA, 'terreno.png'), W, H, rgb);
log(`terreno.png ${(fs.statSync(path.join(SAIDA, 'terreno.png')).size / 1e6).toFixed(1)} MB`);

// ---------- 5. grade de altitude para a malha ----------
const GW = 401, GH = 520;
const grade = new Uint16Array(GW * GH);
for (let j = 0; j < GH; j++) for (let i = 0; i < GW; i++) {
  const cx = i / (GW - 1) * W, cy = j / (GH - 1) * H;
  let s = 0, n = 0;
  for (let y = Math.round(cy) - 2; y <= Math.round(cy) + 2; y++) for (let x = Math.round(cx) - 2; x <= Math.round(cx) + 2; x++) {
    if (x < 0 || y < 0 || x >= W || y >= H) continue;
    s += alt[y * W + x]; n++;
  }
  grade[j * GW + i] = Math.round(n ? s / n : 0);
}
fs.writeFileSync(path.join(SAIDA, 'rilievo.bin'), Buffer.from(grade.buffer));
log('rilievo.bin');

// ---------- 6. comuni ----------
const coordPorIstat = new Map(coordLista.map(c => [String(c.istat).padStart(6, '0'), [+c.lng, +c.lat]]));
// centróide do maior polígono (reserva para comuni sem coordenada)
function centroide(geom) {
  let melhor = null, maior = 0;
  for (const anel of aneisExternos(geom)) {
    let a = 0, cx = 0, cy = 0;
    for (let i = 0, j = anel.length - 1; i < anel.length; j = i++) {
      const f = anel[j][0] * anel[i][1] - anel[i][0] * anel[j][1];
      a += f; cx += (anel[j][0] + anel[i][0]) * f; cy += (anel[j][1] + anel[i][1]) * f;
    }
    if (Math.abs(a) > maior) { maior = Math.abs(a); melhor = [cx / (3 * a), cy / (3 * a)]; }
  }
  return melhor;
}
const geoPorIstat = new Map(comuniGeo.features.map(f => [String(f.properties.com_istat_code ?? f.properties.com_istat_code_num).padStart(6, '0'), f.geometry]));

const regIdx = new Map(regioes.map((r, i) => [r.cod, i]));
const comuni = [];
let semCoord = 0;
for (const c of comuniLista) {
  const istat = String(c.codice).padStart(6, '0');
  let ll = coordPorIstat.get(istat);
  if (!ll) { const g = geoPorIstat.get(istat); if (g) ll = centroide(g); }
  if (!ll) { semCoord++; continue; }
  const [x, z] = proj(ll[0], ll[1]);
  comuni.push([istat, c.nome, c.sigla, c.regione.codice.padStart(2, '0'), +x.toFixed(2), +z.toFixed(2), c.popolazione || 0]);
}
log(`${comuni.length} comuni (${semCoord} sem coordenada)`);
fs.writeFileSync(path.join(SAIDA, 'comuni.json'), JSON.stringify({ campi: ['istat', 'nome', 'sigla', 'regione', 'x', 'z', 'pop'], dados: comuni }));

// ---------- 7. regiões: ponto do rótulo (polo de inacessibilidade aproximado) ----------
function pontoRotulo(r, idx) {
  let melhor = null, dist = -1;
  // pixel dentro da região mais distante do mar/outra região, numa grade grossa
  for (let y = 0; y < H; y += 4) for (let x = 0; x < W; x += 4) {
    if (idRegiao[y * W + x] !== idx + 1) continue;
    let d = 0;
    busca: for (d = 1; d < 120; d++) {
      for (const [ox, oy] of [[d, 0], [-d, 0], [0, d], [0, -d], [d, d], [-d, -d], [d, -d], [-d, d]]) {
        const xx = x + ox, yy = y + oy;
        if (xx < 0 || yy < 0 || xx >= W || yy >= H || idRegiao[yy * W + xx] !== idx + 1) break busca;
      }
    }
    if (d > dist) { dist = d; melhor = [x, y]; }
  }
  return [+(BBOX.x0 + melhor[0] * RES).toFixed(1), +(BBOX.z0 + melhor[1] * RES).toFixed(1)];
}
const popReg = new Map();
for (const c of comuni) popReg.set(c[3], (popReg.get(c[3]) || 0) + c[6]);
const regioni = regioes.map((r, i) => {
  const [lx, lz] = pontoRotulo(r, i);
  return { cod: r.cod, nome: r.nome, sigla: SIGLE[r.cod] ?? r.nome.toUpperCase(), lx, lz, pop: popReg.get(r.cod) || 0, comuni: comuni.filter(c => c[3] === r.cod).length };
});

fs.writeFileSync(path.join(SAIDA, 'geo.json'), JSON.stringify({
  proj: PROJ, bbox: BBOX,
  terreno: { arquivo: 'terreno.png', w: W, h: H },
  rilievo: { arquivo: 'rilievo.bin', w: GW, h: GH },
  regioni,
}, null, 1));
log('geo.json — pronto');
