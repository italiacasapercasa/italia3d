// Rótulos HTML sobre o mapa: cidades, regiões, presidente e, de perto, o @ das casas.
import { DIST_CIDADE, LOTE } from './citta.js';
import { ALTURA_NIVEL } from './modelli.js';
import { NOMI_CARICHE, num } from './regole.js';

const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export class Etichette {
  constructor(el, mappa, citta, D, aoClicar) {
    this.el = el; this.mappa = mappa; this.citta = citta; this.D = D; this.aoClicar = aoClicar;
    this.pool = new Map();      // chave -> { div, w, h }
    this.destaque = null;       // conta destacada (minha casa / busca)
    this.presCasa = D.porConta.get(D.snap.cariche.presidente?.conta);
    this.topLuoghi = [...D.luoghi].sort((a, b) => b.case - a.case);
    this.postos = [];
    mappa.aoFrame.push(() => this.atualizar());
  }

  // os rótulos não capturam toque (zoom, arrastar e pinça passam para o mapa); o clique é testado aqui
  emPonto(x, y) {
    for (let i = this.postos.length - 1; i >= 0; i--) {
      const { r, chave } = this.postos[i];
      if (x >= r.x0 && x <= r.x1 && y >= r.y0 && y <= r.y1) return chave;
    }
    return null;
  }

  item(chave, classe, html) {
    let it = this.pool.get(chave);
    if (!it) {
      const div = document.createElement('div');
      div.className = `et ${classe}`;
      div.dataset.k = chave;
      div.innerHTML = html;
      this.el.appendChild(div);
      it = { div, w: div.offsetWidth, h: div.offsetHeight, html };
      this.pool.set(chave, it);
    } else if (it.html !== html || it.classe !== classe) {
      it.div.hidden = false;
      it.div.className = `et ${classe}`;
      it.div.innerHTML = html; it.html = html; it.w = it.div.offsetWidth; it.h = it.div.offsetHeight;
    }
    it.classe = classe;
    return it;
  }

  atualizar() {
    const mp = this.mappa, D = this.D, cand = [];
    const add = (chave, classe, html, x, y, z, prio, fixo = false) => cand.push({ chave, classe, html, x, y, z, prio, fixo });
    if (mp.dist > DIST_CIDADE) {
      const p = this.presCasa;
      if (p) {
        const l = D.luoghi[p.luogo];
        add('pres', 'et-pres', `<b>★ @${esc(p.conta)}</b><small>${NOMI_CARICHE.presidente.toUpperCase()}</small>`, l.x, mp.altura(l.x, l.z), l.z, 0, true);
      }
      if (mp.dist > 120) for (const r of D.regioni) {
        const gov = r.carica?.presidente;
        add(`r:${r.cod}`, 'et-reg', `<span class="sig">${esc(r.sigla)}</span>${gov ? `<span class="gov">🏛 @${esc(gov.conta)}</span>` : ''}`, r.lx, mp.altura(r.lx, r.lz), r.lz, 1);
      }
      const lim = mp.dist > 900 ? 26 : mp.dist > 300 ? 60 : 140;
      for (let i = 0; i < Math.min(lim, this.topLuoghi.length); i++) {
        const l = this.topLuoghi[i];
        add(`l:${l.id}`, 'et-citta', `${esc(l.nome)} <b>${num(l.case)}</b>`, l.x, mp.altura(l.x, l.z), l.z, 2 + i);
      }
    } else {
      for (const l of this.citta.perto) {
        const hc = this.citta.dadosCidade(l).hc;
        add(`l:${l.id}`, 'et-citta grande', `${esc(l.nome)} <b>${num(l.case)}</b>`, l.x, hc + LOTE * 2.4, l.z, 1);
        if (l.fondatore) add(`f:${l.id}`, 'et-fond', `★ @${esc(l.fondatore)}<small>FONDATORE</small>`, l.x + 1.45 * LOTE, hc + LOTE * 1.05, l.z + 0.55 * LOTE, 3);
      }
      const casas = [];
      for (const l of this.citta.perto) for (const ci of this.citta.dadosCidade(l).casas) casas.push(D.casas[ci]);
      casas.sort((a, b) => b.tot - a.tot);
      const agora = Date.now() / 1000;
      const limite = mp.dist > 3 ? 40 : mp.dist > 1.2 ? 80 : 160;
      for (let i = 0; i < Math.min(casas.length, limite); i++) {
        const c = casas[i], fogo = c.fiamme > agora;
        const cls = c.carica ? `et-casa carica c-${c.carica.tipo}` : 'et-casa';
        add(`c:${c.conta}`, cls, `${fogo ? '🔥 ' : ''}@${esc(c.conta)}`, c.x, c.y + ALTURA_NIVEL[c.livello] * LOTE + LOTE * 0.25, c.z, 10 + i);
      }
      // casas decoradas (decori.js): rótulo próprio, acima da coroa/troféu, com prioridade sobre as outras casas
      for (const c of this.decori?.vicine(this.citta.perto) ?? []) {
        const e = this.decori.etichetta(c);
        if (e) add(`c:${c.conta}`, e.cls, e.html, c.x, e.y, c.z, 5);
      }
      if (this.destaque) {
        const c = D.porConta.get(this.destaque), e = c && this.decori?.etichetta(c);
        if (c && c.x !== undefined) add(`c:${c.conta}`, e ? e.cls : 'et-casa minha', e ? e.html : `🏠 @${esc(c.conta)}`, c.x, e ? e.y : c.y + ALTURA_NIVEL[c.livello] * LOTE + LOTE * 0.25, c.z, -1, true);
      }
    }
    // projeção + colisão gulosa
    cand.sort((a, b) => a.prio - b.prio);
    const postos = [], vistos = new Set(), W = innerWidth, H = innerHeight;
    for (const c of cand) {
      if (vistos.has(c.chave)) continue;
      const p = mp.projetar(c.x, c.y, c.z);
      if (!p.ok || p.x < -60 || p.y < -30 || p.x > W + 60 || p.y > H + 30) continue;
      const it = this.item(c.chave, c.classe, c.html);
      const r = { x0: p.x - it.w / 2 - 2, x1: p.x + it.w / 2 + 2, y0: p.y - it.h - 2, y1: p.y + 2 };
      if (!c.fixo && postos.some(q => r.x0 < q.x1 && r.x1 > q.x0 && r.y0 < q.y1 && r.y1 > q.y0)) continue;
      postos.push(r);
      r.chave = c.chave;
      vistos.add(c.chave);
      it.div.style.transform = `translate3d(${(p.x - it.w / 2).toFixed(1)}px, ${(p.y - it.h).toFixed(1)}px, 0)`;
      it.div.style.zIndex = String(1000 - Math.min(999, c.prio));
      if (it.div.hidden) it.div.hidden = false;
    }
    for (const [k, it] of this.pool) if (!vistos.has(k) && !it.div.hidden) it.div.hidden = true;
    // prioridade maior primeiro na lista de colisão; para o clique, o de maior prioridade deve ganhar
    this.postos = postos.map(r => ({ r, chave: r.chave })).reverse();
  }
}
