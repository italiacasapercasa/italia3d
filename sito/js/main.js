// Ponto de entrada: carrega dados, monta mapa, cidades, rótulos e interface.
import { carregar } from './dati.js';
import { Mappa } from './mappa.js';
import { Citta } from './citta.js';
import { criarPunti, criarPuntiCase } from './punti.js';
import { Etichette } from './etichette.js';
import { UI } from './ui.js';
import { Festa } from './festa.js';

const VERSAO = document.querySelector('meta[name="versione"]')?.content ?? 'dev';
const DEMO = new URLSearchParams(location.search).has('demo');   // ?demo=1: mapa de demonstração

// recarrega sozinho quando sai um snapshot novo
async function checarVersao(atual) {
  try {
    const t = (await (await fetch(`data/versao.txt?t=${Date.now()}`, { cache: 'no-store' })).text()).trim();
    if (t && t !== atual && !sessionStorage.getItem(`v_${t}`)) { sessionStorage.setItem(`v_${t}`, '1'); location.reload(); }
  } catch { /* offline */ }
}

async function iniciar() {
  const D = await carregar(VERSAO, DEMO);
  const mappa = new Mappa(document.getElementById('mappa'), D.geo, D.rilievo, D.imagem);
  const citta = new Citta(mappa, D);
  criarPuntiCase(mappa, D);
  mappa.punti = criarPunti(mappa, D);
  let ui = null;
  const abrirRotulo = k => {
    const [tipo, id] = [k.slice(0, k.indexOf(':')), k.slice(k.indexOf(':') + 1)];
    if (tipo === 'c') ui.casa(D.porConta.get(id));
    else if (tipo === 'l' || tipo === 'f') ui.luogo(D.luoghi[+id]);
    else if (tipo === 'r') ui.regione(D.regPorCod.get(id));
    else if (k === 'pres') ui.palazzo();
  };
  const et = new Etichette(document.getElementById('etichette'), mappa, citta, D, abrirRotulo);
  const festa = new Festa(mappa, D);
  ui = new UI(D, mappa, citta, et, festa);
  mappa.aoClique = (x, y) => {
    const rotulo = et.emPonto(x, y);   // toque em cima de um rótulo (@, cidade, região, presidente)
    if (rotulo) return abrirRotulo(rotulo);
    if (mappa.dist < 32) {
      const alvo = citta.escolher(mappa.raio(x, y));
      if (alvo?.tipo === 'casa') return ui.casa(alvo.casa, false);
      if (alvo?.tipo === 'luogo') return ui.luogo(alvo.luogo, false);
      if (alvo?.tipo === 'lotto') return ui.lotto(alvo);
      if (alvo?.tipo === 'pubblicita') return ui.pubblicita(alvo.luogo);
      if (alvo?.tipo === 'commercio') return ui.commercio(alvo.commercio);
    } else {
      // clique perto de uma bolinha: abre a cidade
      let melhor = null, md = 18;
      for (const l of D.luoghi) {
        const p = mappa.projetar(l.x, mappa.altura(l.x, l.z), l.z);
        const d = Math.hypot(p.x - x, p.y - y);
        if (d < md) { md = d; melhor = l; }
      }
      if (melhor) ui.luogo(melhor);
    }
  };
  // parâmetros de URL (testes e modo gravação): ?cam=x,z,dist,az  ?casa=conta  ?luogo=Nome
  const qs = new URLSearchParams(location.search);
  if (qs.get('cam')) { const [x, z, d, az] = qs.get('cam').split(',').map(Number); Object.assign(mappa.alvo, { x, z }); mappa.dist = d; mappa.az = az || 0; mappa.tocou = true; }
  mappa.atualizarCamera();
  if (qs.get('casa')) ui.casa(D.porConta.get(qs.get('casa')));
  if (qs.get('luogo')) { const c = D.comuni.find(c => c.nome === qs.get('luogo')); if (c) ui.comuneVuoto(c); }
  if (qs.get('storia')) ui.storiaCasa(D.porConta.get(qs.get('storia')));
  window.__italia = { D, mappa, citta, ui, festa };
  if (qs.has('debug')) {
    const v = document.getElementById('versione');
    setInterval(() => { const i = mappa.renderer.info.render; v.textContent = `dist ${mappa.dist.toFixed(2)} · ${i.calls} draw · ${(i.triangles / 1000).toFixed(0)}k tri · ${citta.perto.length} città`; }, 500);
  }
  document.getElementById('caricamento').classList.add('fora');
  setTimeout(() => document.getElementById('caricamento').remove(), 600);
  if (!DEMO) checarVersao(D.snap.versao);
}

iniciar().catch(e => {
  console.error(e);
  document.querySelector('#caricamento p').textContent = 'Ops! Qualcosa è andato storto. Ricarica la pagina.';
});
