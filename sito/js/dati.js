// Carrega geo + comuni + snapshot e monta o modelo usado pelo site.
import { livelloDi } from './regole.js';

// baixa com até 3 tentativas (rede de celular cai no meio) e marca em window.__fasi o que já chegou (diagnóstico do index.html)
async function baixar(url, tipo, nome) {
  for (let t = 1; ; t++) {
    try {
      const r = await fetch(url);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const x = await r[tipo]();
      (window.__fasi ??= {})[nome] = 1;
      return x;
    } catch (e) {
      if (t >= 3) throw new Error(`${nome}: ${e.message}`);
      await new Promise(ok => setTimeout(ok, 800 * t));
    }
  }
}
const imagem = (src, t = 1) => new Promise((ok, erro) => {
  const i = new Image();
  i.onload = () => { (window.__fasi ??= {}).terreno = 1; ok(i); };
  i.onerror = () => (t >= 3 ? erro(new Error('terreno: load failed')) : setTimeout(() => imagem(src, t + 1).then(ok, erro), 800 * t));
  i.src = src;
});

export async function carregar(versao, demo = false) {
  const v = `?v=${versao}`;
  const [geo, comuniJ, snap, ril, img] = await Promise.all([
    baixar(`data/geo.json${v}`, 'json', 'geo'),
    baixar(`data/comuni.json${v}`, 'json', 'comuni'),
    // ?demo=1: dados fictícios (nomes com hífen, que não existem no Instagram)
    baixar(`data/${demo ? 'demo/' : ''}snapshot.json?t=${Date.now()}`, 'json', 'snapshot'),
    baixar(`data/rilievo.bin${v}`, 'arrayBuffer', 'rilievo'),
    imagem(`data/terreno.png${v}`),
  ]);

  const regioni = geo.regioni.map(r => ({ ...r, case: 0, luoghi: 0, carica: snap.cariche.regioni[r.cod] }));
  const regPorCod = new Map(regioni.map(r => [r.cod, r]));
  const comuni = comuniJ.dados.map(([istat, nome, sigla, reg, x, z, pop], i) => ({ i, istat, nome, sigla, reg, x, z, pop, luogo: null }));
  const comunePorIstat = new Map(comuni.map(c => [c.istat, c]));

  const luoghi = snap.luoghi.map(([ci, n, fondatore, fts, lotti], id) => {
    const c = comuni[ci];
    const l = { id, comune: c, nome: c.nome, x: c.x, z: c.z, case: n, lotti: lotti ?? n, fondatore, fondatore_ts: fts * 1000, casas: [], regione: regPorCod.get(c.reg) };
    c.luogo = l;
    l.regione.case += n;
    l.regione.luoghi++;
    return l;
  });

  const casas = snap.case.map(([conta, li, lote, ts, tot, sett, fiamme, fonti, serie], i) => {
    const casa = { i, conta, luogo: li, lote, ts: ts * 1000, tot, sett, fiamme, fonti, serie: serie ?? 0, livello: livelloDi(tot), carica: null };
    luoghi[li].casas.push(i);
    return casa;
  });
  const porConta = new Map(casas.map(c => [c.conta, c]));

  // comércios e outdoors aprovados, no lote que o motor reservou
  const commerci = (snap.commerci ?? []).filter(cm => luoghi[cm.li]).map(cm => {
    const x = { ...cm, luogo: luoghi[cm.li] };
    (x.luogo.commerci ??= []).push(x);
    return x;
  });

  // cargos: conta -> { tipo, regione?, comune? }
  const k = snap.cariche;
  const dar = (x, carica) => { const c = x && porConta.get(x.conta); if (c) c.carica = carica; };
  dar(k.presidente, { tipo: 'presidente' });
  for (const [cod, r] of Object.entries(k.regioni)) {
    r.senatori.forEach(x => dar(x, { tipo: 'senatore', regione: cod }));
    dar(r.presidente, { tipo: 'presidente_regione', regione: cod });
    r.deputati.forEach(x => dar(x, { tipo: 'deputato', regione: cod }));
  }
  for (const [istat, x] of Object.entries(k.sindaci)) dar(x, { tipo: 'sindaco', comune: istat });
  for (const [istat, lista] of Object.entries(k.consiglieri)) lista.forEach(x => dar(x, { tipo: 'consigliere', comune: istat }));

  // posição no ranking do mandato
  const ranking = [...casas].sort((a, b) => b.sett - a.sett || a.ts - b.ts);
  ranking.forEach((c, i) => { c.pos = i + 1; });

  return { geo, snap, regioni, regPorCod, comuni, comunePorIstat, luoghi, casas, porConta, ranking, commerci, rilievo: new Uint16Array(ril), imagem: img };
}
