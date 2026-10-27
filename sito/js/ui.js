// Interface: busca, abas, painéis (casa, cidade, região, Palazzo, classifica, tabellone, senza padrone, come funziona).
import { REGOLE, NOMI_CARICHE, DESCR_CARICHE, FONTI, COME_GUADAGNARE, num, punti, dataBreve, dataLunga, ora } from './regole.js';
import { iconaLivello } from './icone.js';
import { Fotografo } from './foto.js';
import { immagineCasa, immagineFondazione, immagineCitta, PERFIL } from './storie.js';
import { tipoDi, linkWhatsapp } from './commerci.js';

const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const norm = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9._ ']/g, '').trim();
const ler = k => { try { return localStorage.getItem(k); } catch { return null; } };
const gravar = (k, v) => { try { localStorage.setItem(k, v); } catch { /* sem storage */ } };

export class UI {
  constructor(D, mappa, citta, etichette, festa = null, decori = null) {
    this.D = D; this.mappa = mappa; this.citta = citta; this.et = etichette; this.festa = festa; this.decori = decori;
    this.painel = $('#pannello');
    this.conteudo = $('#pannello-contenuto');
    this.minha = ler('minha_casa');
    if (this.minha && !D.porConta.has(this.minha)) this.minha = null;
    this.et.destaque = this.minha;
    this.mandatoFim = Date.parse(D.snap.mandato.fine);
    this.fot = new Fotografo(mappa, citta);

    this.ligarBusca();
    this.ligarAbas();
    this.ligarPainel();
    this.ligarChips();
    this.ligarControles();
    this.rodape();
    if (D.snap.demo) $('#avviso-demo').hidden = false;
    setInterval(() => { const c = $('#conto'); if (c) c.textContent = this.contagem(); }, 1000);
    this.rota(location.hash.slice(1));
    addEventListener('hashchange', () => this.rota(location.hash.slice(1)));
  }

  // voa deixando o ponto fora da área coberta pelo painel
  focar(x, z, dist, az) {
    const k = innerWidth >= 900 ? [-0.32, 0] : [0, 0.13];   // [lateral, para a câmera]
    const dx = Math.cos(az) * k[0] * dist + Math.sin(az) * k[1] * dist;
    const dz = -Math.sin(az) * k[0] * dist + Math.cos(az) * k[1] * dist;
    this.mappa.voar({ x: x + dx, z: z + dz, dist, az });
  }

  // ---------- painel ----------
  abrir(html, aba = null) {
    this.conteudo.innerHTML = html;
    this.painel.hidden = false;
    this.painel.classList.remove('mini');
    this.painel.scrollTop = 0;
    this.conteudo.scrollTop = 0;
    const atual = this.conteudo.querySelector('.scala .attuale');
    if (atual) atual.parentElement.scrollLeft = atual.offsetLeft - atual.parentElement.clientWidth / 2 + atual.clientWidth / 2;
    document.querySelectorAll('#schede button').forEach(b => b.classList.toggle('attiva', b.dataset.aba === (aba ?? '')));
  }
  fechar() {
    this.decori?.chiudi();
    this.painel.hidden = true;
    this.citta.evidenzia(null);
    document.querySelectorAll('#schede button').forEach(b => b.classList.toggle('attiva', b.dataset.aba === 'mappa'));
    if (location.hash) history.replaceState(null, '', location.pathname + location.search);
  }
  ligarPainel() {
    this.painel.querySelector('.chiudi').onclick = () => this.fechar();
    this.painel.querySelector('.maniglia').onclick = () => this.painel.classList.toggle('mini');
    // ações dentro dos painéis (delegadas)
    this.painel.addEventListener('click', e => {
      const t = e.target.closest('button, [data-casa], [data-luogo], [data-regione], [data-comune], [data-commercio]');
      if (!t) return;
      const d = t.dataset;
      if (d.casa) this.casa(this.D.porConta.get(d.casa));
      else if (d.luogo) this.luogo(this.D.luoghi[+d.luogo]);
      else if (d.regione) this.regione(this.D.regPorCod.get(d.regione));
      else if (d.comune) this.comuneVuoto(this.D.comunePorIstat.get(d.comune));
      else if (d.commercio) { const cm = this.D.commerci.find(x => x.id === d.commercio); if (cm) { const p = this.citta.posCommercio?.(cm); if (p) this.focar(p.x, p.z, 0.4, 0.6); this.commercio(cm); } }
      else if ('minha' in d) this.definirMinha(d.minha);
      else if (d.storia) this.storiaCasa(this.D.porConta.get(d.storia));
      else if (d.atto) this.attoFondazione(this.D.luoghi[+d.atto]);
      else if ('condividi' in d) this.condividir(d.condividi);
      else if ('copia' in d) this.copiarConvite(t);
      else if (d.dp) this.decori?.azione(t);
      else if (d.decora) this.decori?.apri(d.decora, d.modo);
      else if (d.ir) this.rota(d.ir);
    });
  }

  aviso(txt) {
    let t = $('#avviso');
    if (!t) { t = document.createElement('div'); t.id = 'avviso'; document.body.appendChild(t); }
    t.textContent = txt;
    t.classList.add('on');
    clearTimeout(this._av);
    this._av = setTimeout(() => t.classList.remove('on'), 2600);
  }

  rota(r) {
    const mapa = { palazzo: () => this.palazzo(), classifica: () => this.classifica(), tabellone: () => this.tabellone(), negozi: () => this.negozi(), senzapadrone: () => this.senzaPadrone(), fiamme: () => this.fiamme(), 'come-funziona': () => this.comeFunziona(), video: () => this.video(), decora: () => this.decori?.aperto && this.decori.home(), derby: () => this.derby(), meta: () => this.meta() };
    if (mapa[r]) mapa[r]();
  }

  // ---------- abas, chips, controles ----------
  ligarAbas() {
    document.querySelectorAll('#schede button').forEach(b => b.addEventListener('click', () => {
      const a = b.dataset.aba;
      if (a === 'mappa') this.fechar();
      else this.rota(a);
    }));
    // no celular as abas rolam de lado: o degradê na direita some quando chega ao fim
    const sc = $('#schede'), fim = () => sc.classList.toggle('fine', sc.scrollLeft + sc.clientWidth >= sc.scrollWidth - 4);
    sc.addEventListener('scroll', fim, { passive: true }); addEventListener('resize', fim); fim();
    $('#aiuto').onclick = () => this.comeFunziona();
    $('#fai-video').onclick = () => this.video();
  }
  // chips sob a busca: um de cada vez, em rodízio
  ligarChips() {
    const D = this.D, agora = Date.now(), caixa = $('#chips'), lista = [];
    this.emFiamme = D.casas.filter(c => c.fiamme > agora / 1000).sort((a, b) => b.tot - a.tot);
    const add = (id, html, fn) => {
      let b = document.getElementById(id);
      if (!b) { b = document.createElement('button'); b.id = id; b.type = 'button'; b.className = 'chip'; caixa.appendChild(b); }
      b.innerHTML = html; b.onclick = fn; b.hidden = true;
      lista.push(b);
    };
    // festas do dia (padroeiro, eleição, Ferragosto...) vêm primeiro
    for (const [i, txt] of (this.festa?.avvisi ?? []).entries()) add(`chip-festa-${i}`, esc(txt), () => {
      const f = this.festa, pres = D.snap.cariche.presidente;
      if (txt.startsWith('🏛') && pres) return this.casa(D.porConta.get(pres.conta));
      if (f.patronoOggi && txt.includes(f.patronoOggi.nome)) return f.patronoOggi.luogo ? this.luogo(f.patronoOggi.luogo) : this.comuneVuoto(f.patronoOggi);
      this.mappa.verPais();
    });
    this.doppio = (D.snap.doppi ?? []).find(d => agora >= Date.parse(d.da) && agora < Date.parse(d.a)) ?? null;
    if (this.doppio) add('chip-doppi', `⚡ <b>Punti doppi</b> ${this.doppio.tipi.includes('storia') ? 'nelle storie ' : ''}fino alle ${ora(Date.parse(this.doppio.a))}`, () => this.comeFunziona());
    if (this.emFiamme.length) add('chip-fiamme', `🔥 <b>${num(this.emFiamme.length)}</b> ${this.emFiamme.length === 1 ? 'casa in fiamme' : 'case in fiamme'} ora`, () => this.fiamme());
    const dz = D.snap.derby;
    if (dz) add('chip-derby', `⚔️ ${esc(D.comunePorIstat.get(dz.a).nome)} <b>${num(dz.pts_a)}</b> – <b>${num(dz.pts_b)}</b> ${esc(D.comunePorIstat.get(dz.b).nome)}`, () => this.derby());
    const meta = this.metaCase();
    add('chip-meta', `🎯 <b>${num(D.casas.length)}</b> / ${num(meta)} case`, () => this.meta());
    // celular: um chip por vez, em rodízio; tela larga: até 3 juntos (rodando os seguintes)
    let i = 0;
    const girar = () => {
      const juntos = innerWidth >= 900 ? Math.min(3, lista.length) : 1;
      lista.forEach((b, k) => { b.hidden = !Array.from({ length: juntos }, (_, j) => (i + j) % lista.length).includes(k); });
      i = (i + juntos) % lista.length;
    };
    girar();
    clearInterval(this._chips);
    if (lista.length > 1) this._chips = setInterval(girar, 4500);
  }
  metaCase() { const p = REGOLE.meta_passo; return Math.ceil((this.D.casas.length + 1) / p) * p; }
  ligarControles() {
    $('#zoom-piu').onclick = () => this.mappa.zoom(0.45);
    $('#zoom-meno').onclick = () => this.mappa.zoom(2.2);
    $('#vedi-paese').onclick = () => { this.mappa.verPais(); };
    const ir = $('#vai-casa');
    ir.hidden = !this.minha;
    ir.onclick = () => this.minha && this.casa(this.D.porConta.get(this.minha));
  }
  rodape() {
    const s = this.D.snap, t = Date.parse(s.dati_fino);
    $('#versione').textContent = `Aggiornato: ${dataBreve(t)} ${new Date(t).getFullYear()}, ${ora(t)} (ora di Roma) · ${s.versao}`;
  }

  // ---------- busca ----------
  ligarBusca() {
    const D = this.D, q = $('#q'), res = $('#risultati');
    this.idxContas = D.casas.map(c => [c.conta.toLowerCase(), c]).sort((a, b) => b[1].tot - a[1].tot);
    this.idxComuni = D.comuni.map(c => [norm(c.nome), c]).sort((a, b) => (b[1].luogo?.case ?? -1) - (a[1].luogo?.case ?? -1) || b[1].pop - a[1].pop);
    this.idxReg = D.regioni.map(r => [norm(r.nome), r]);
    const mostrar = () => {
      const bruto = q.value.trim(), t = bruto.replace(/^@/, '');
      if (t.length < 2) { res.hidden = true; return; }
      res.innerHTML = this.sugestoes(t, bruto.startsWith('@')) || '<div class="vuoto">Nessun risultato. Hai già commentato la tua città?</div>';
      res.hidden = false;
    };
    q.addEventListener('input', mostrar);
    q.addEventListener('focus', mostrar);
    document.addEventListener('pointerdown', e => { if (!e.target.closest('#cerca, #risultati')) res.hidden = true; });
    $('#cerca').addEventListener('submit', e => {
      e.preventDefault();
      const primeiro = res.querySelector('[data-r]');
      if (primeiro) primeiro.click(); else mostrar();
    });
    res.addEventListener('click', e => {
      const t = e.target.closest('[data-r]');
      if (!t) return;
      const [tipo, id] = t.dataset.r.split(':');
      res.hidden = true; q.blur();
      if (tipo === 'c') this.casa(D.porConta.get(id));
      else if (tipo === 'm') { const c = D.comunePorIstat.get(id); c.luogo ? this.luogo(c.luogo) : this.comuneVuoto(c); }
      else if (tipo === 'r') this.regione(D.regPorCod.get(id));
    });
  }
  sugestoes(t, contaPrimeiro) {
    const lc = t.toLowerCase(), n = norm(t), out = [];
    for (const [k, c] of this.idxContas) { if (k.startsWith(lc)) out.push(c); if (out.length >= 5) break; }
    const com = [];
    for (const [k, c] of this.idxComuni) { if (k.startsWith(n)) com.push(c); if (com.length >= 5) break; }
    const reg = this.idxReg.filter(([k]) => k.startsWith(n)).map(([, r]) => r).slice(0, 2);
    const D = this.D;
    const contas = out.map(c => `<button data-r="c:${esc(c.conta)}"><b>@${esc(c.conta)}</b><small>${esc(D.luoghi[c.luogo].nome)} · ${punti(c.tot)}</small></button>`);
    const lugares = [
      ...reg.map(r => `<button data-r="r:${r.cod}"><b>🗺 ${esc(r.nome)}</b><small>${num(r.case)} case</small></button>`),
      ...com.map(c => `<button data-r="m:${c.istat}"><b>📍 ${esc(c.nome)}</b><small>${esc(D.regPorCod.get(c.reg).nome)} · ${c.luogo ? `${num(c.luogo.case)} case` : 'ancora nessuna casa'}</small></button>`),
    ];
    return (contaPrimeiro ? [...contas, ...lugares] : [...lugares, ...contas]).join('');
  }

  // ---------- helpers de conteúdo ----------
  cargoTexto(c) {
    if (!c?.carica) return '';
    const k = c.carica;
    if (k.tipo === 'presidente') return NOMI_CARICHE.presidente;
    if (k.regione) return `${NOMI_CARICHE[k.tipo]} · ${this.D.regPorCod.get(k.regione).nome}`;
    return `${NOMI_CARICHE[k.tipo]} di ${this.D.comunePorIstat.get(k.comune).nome}`;
  }
  linhaRank(c, i, extra = '') {
    const l = this.D.luoghi[c.luogo], fogo = c.fiamme > Date.now() / 1000;
    const TAG = { presidente: 'PRESIDENTE', senatore: 'SENATORE', presidente_regione: 'PRES. REGIONE', deputato: 'DEPUTATO', sindaco: 'SINDACO', consigliere: 'CONSIGLIERE' };
    const tag = c.carica ? `<span class="tag-carica c-${c.carica.tipo}">${TAG[c.carica.tipo] ?? ''}</span> · ` : '';
    return `<li data-casa="${esc(c.conta)}"${c.conta === this.minha ? ' class="mia"' : ''}><span class="pos">${i + 1}</span><span class="ico-liv">${iconaLivello(c.livello)}</span><span class="quem"><b>${fogo ? '🔥 ' : ''}@${esc(c.conta)}</b><small>${tag}${esc(l.nome)}${extra}</small></span><span class="pts">${num(c.sett)}</span></li>`;
  }
  contagem() {
    let s = Math.max(0, Math.floor((this.mandatoFim - Date.now()) / 1000));
    const g = Math.floor(s / 86400); s %= 86400;
    const h = Math.floor(s / 3600); s %= 3600;
    const m = Math.floor(s / 60); s %= 60;
    return `${g} g ${h} h ${String(m).padStart(2, '0')} min ${String(s).padStart(2, '0')} s`;
  }
  fimMandato() { return `${dataLunga(this.mandatoFim)}, ${ora(this.mandatoFim)}`; }

  // ---------- casa ----------
  casa(c, voar = true) {
    if (!c) return;
    if (this.decori?.ed) this.decori.chiudi();   // tocou outra casa no meio da prévia: desfaz
    const D = this.D, l = D.luoghi[c.luogo], r = l.regione, niv = REGOLE.livelli;
    if (voar) { const p = this.citta.posCasa(c); this.focar(p.x, p.z, 0.6, 0.62); }
    this.et.destaque = c.conta;
    this.citta.evidenzia(c);
    const agora = Date.now() / 1000, fogo = c.fiamme > agora;
    const prox = niv[c.livello + 1];
    const pct = prox ? Math.round(100 * (c.tot - niv[c.livello].min) / (prox.min - niv[c.livello].min)) : 100;
    const fondatore = l.fondatore === c.conta;
    const tot = c.fonti.reduce((a, b) => a + b, 0);
    const barra = FONTI.map(([k, , cor], i) => c.fonti[i] ? `<i style="width:${(100 * c.fonti[i] / tot).toFixed(2)}%;background:${cor}" title="${k}"></i>` : '').join('');
    const legenda = FONTI.map(([, nome, cor], i) => c.fonti[i] ? `<div class="leg"><i style="background:${cor}"></i><span>${nome}</span><b>+${num(c.fonti[i])}</b></div>` : '').join('');
    const eMinha = this.minha === c.conta;
    this.abrir(`
      <div class="tag-luogo" data-luogo="${l.id}">📍 ${esc(l.nome)} · ${esc(r.nome)}</div>
      <h2 class="conta">@${esc(c.conta)}</h2>
      <div class="sub">casa n. ${num(c.lote + 1)} di ${esc(l.nome)} · dal ${dataBreve(c.ts)}</div>
      <div class="badges">
        ${fondatore ? `<span class="badge fond">★ Fondatore/Fondatrice di ${esc(l.nome)}</span>` : ''}
        ${c.fonti[8] > 0 ? '<span class="badge mec">🏅 Mecenate · ha un’attività sulla mappa</span>' : ''}
        ${c.carica ? `<span class="badge car c-${c.carica.tipo}">🏛 ${esc(this.cargoTexto(c))}</span>` : ''}
        ${fogo ? `<span class="badge fuoco">🔥 in fiamme fino alle ${ora(c.fiamme * 1000)}</span>` : ''}
        ${this.decori?.badge(c) ?? ''}
      </div>
      <div class="cresce">
        <div class="cresce-topo"><b>La tua casa · livello ${c.livello + 1} di ${niv.length}</b><span>${esc(niv[c.livello].nome)}</span></div>
        <div class="scala">${niv.map((n, i) => `<div class="gradino ${i < c.livello ? 'passato' : i === c.livello ? 'attuale' : 'futuro'}">${iconaLivello(i)}<small>${esc(n.nome)}</small></div>`).join('')}</div>
        <div class="progresso"><i style="width:${pct}%"></i></div>
        <div class="prossimo">${prox ? `Mancano <b>${punti(prox.min - c.tot)}</b> per: ${esc(prox.nome)}` : 'Sei in cima alla mappa! 👑'}</div>
      </div>
      <h3>Da dove vengono i tuoi punti <small>(${num(tot)} in totale)</small></h3>
      <div class="pila">${barra}</div>
      <div class="legenda">${legenda}</div>
      <div class="linha"><span>Punti del mandato ${D.snap.mandato.n}</span><span><b>${num(c.sett)}</b> · n. ${num(c.pos)} in Italia</span></div>
      <div class="linha"><span>Carica</span><span>${c.carica ? esc(this.cargoTexto(c)) : '—'}</span></div>
      <div class="linha"><span>Serie</span><span>${c.serie ? `🔥 <b>${num(c.serie)}</b> ${c.serie === 1 ? 'giorno' : 'giorni di fila'}` : 'commenta oggi per iniziare'}</span></div>
      <button class="storia" data-storia="${esc(c.conta)}">📸 Carica la tua casa nella storia<small>tagga @${PERFIL}: +${REGOLE.punti.storia * (this.doppio?.tipi.includes('storia') ? 2 : 1)} punti${this.doppio ? ' (doppi oggi!)' : ''} (1 volta al giorno) e la tua casa in fiamme 24 h</small></button>
      <h3>Come guadagnare più punti</h3>
      <div class="azioni">${COME_GUADAGNARE(REGOLE.punti).filter(([k]) => k !== 'casa').map(([k, nome, txt]) => `<div class="azione"><i style="background:${FONTI.find(f => f[0] === k)[2]}"></i><div><b>${nome}</b><small>${txt}</small></div></div>`).join('')}</div>
      <div class="bottoni">
        <button class="sec" data-luogo="${l.id}">vedi ${esc(l.nome)}</button>
        ${eMinha ? '<button class="sec" data-minha="">non è la mia casa</button>' : `<button data-minha="${esc(c.conta)}">è la mia casa 🏠</button>`}
      </div>
      ${this.decori?.bottone(c, eMinha) ?? ''}`);
  }
  definirMinha(conta) {
    this.minha = conta || null;
    gravar('minha_casa', conta || '');
    this.et.destaque = this.minha;
    $('#vai-casa').hidden = !this.minha;
    if (conta) { this.aviso('Fatto! Il bottone 🏠 ti riporta qui.'); this.casa(this.D.porConta.get(conta), false); }
    else this.fechar();
  }

  // ---------- cidade ----------
  proximoEdificio(n) {
    const M = REGOLE.marchi;
    if (n < M.chiesa) return ['⛪ Chiesa', M.chiesa];
    const pal = (Math.floor(n / M.palazzinaOgni) + 1) * M.palazzinaOgni;
    const opz = [['🏢 Palazzine', pal]];
    if (n < M.ospedale) opz.push(['🏥 Ospedale', M.ospedale]);
    if (n < M.stadio) opz.push(['🏟 Stadio', M.stadio]);
    return opz.sort((a, b) => a[1] - b[1])[0];
  }
  luogo(l, voar = true) {
    if (!l) return;
    const D = this.D, k = D.snap.cariche;
    if (voar) this.focar(l.x, l.z, Math.min(5, 0.9 + Math.sqrt(l.case) * 0.075), 0.55);
    const sindaco = k.sindaci[l.comune.istat], cons = k.consiglieri[l.comune.istat] ?? [];
    const casas = l.casas.map(i => D.casas[i]).sort((a, b) => b.sett - a.sett || a.ts - b.ts);
    const [ed, alvo] = this.proximoEdificio(l.case);
    const pct = Math.min(100, Math.round(100 * l.case / alvo));
    this.abrir(`
      <h2>⚑ ${esc(l.nome)}</h2>
      <div class="sub"><span data-regione="${l.regione.cod}" class="link">${esc(l.regione.nome)}</span> · ${num(l.case)} ${l.case === 1 ? 'casa' : 'case'} · ${num(l.comune.pop)} abitanti</div>
      <div class="carta fond" data-casa="${esc(l.fondatore)}">★ <b>Fondatore/Fondatrice: @${esc(l.fondatore)}</b><small>la prima casa di ${esc(l.nome)}, il ${dataBreve(l.fondatore_ts)} · per sempre</small></div>
      <h3>Governo di ${esc(l.nome)}</h3>
      <div class="linha"><span>Sindaco/a</span><span>${sindaco ? `<a data-casa="${esc(sindaco.conta)}">@${esc(sindaco.conta)}</a> · eletto/a domenica · ${num(sindaco.pts)} pt` : 'si elegge domenica alle 21'}</span></div>
      <div class="linha"><span>🏁 Prossima elezione</span><span>${casas[0]?.sett ? `in testa <a data-casa="${esc(casas[0].conta)}">@${esc(casas[0].conta)}</a> · ${punti(casas[0].sett)}` : 'nessuno ha ancora punti questa settimana'}</span></div>
      <div class="linha col"><span>Consiglieri comunali (${cons.length}/${REGOLE.posti.consiglieri})</span><span class="chips-mini">${cons.map(x => `<a data-casa="${esc(x.conta)}">@${esc(x.conta)}</a>`).join('') || '—'}</span></div>
      <h3>🏗️ Prossimo edificio</h3>
      <div class="carta"><b>${ed}</b> a ${num(alvo)} case · mancano <b>${num(alvo - l.case)}</b><div class="progresso"><i style="width:${pct}%"></i></div></div>
      <h3>Classifica di ${esc(l.nome)} <small>(punti del mandato)</small></h3>
      <ol class="ranking">${casas.slice(0, 10).map((c, i) => this.linhaRank(c, i)).join('')}</ol>
      <div class="bottoni"><button data-condividi="luogo:${l.id}">📸 Condividi ${esc(l.nome)}</button><button class="sec" data-atto="${l.id}">📜 Atto di fondazione</button></div>
      ${this.attivitaCitta(l)}`);
  }
  // comércios da cidade + convite para anunciar
  attivitaCitta(l) {
    const lista = l.commerci ?? [];
    return `
      <h3>🏪 Attività a ${esc(l.nome)}</h3>
      ${lista.length ? `<ol class="ranking citta">${lista.map(cm => { const [, e, t] = tipoDi(cm.tipo); return `<li data-commercio="${esc(cm.id)}"><span class="pos">${e}</span><span class="quem"><b>${esc(cm.nome)}</b><small>${esc(t)}${cm.prodotto === 'cartellone' ? ' · cartellone' : ''}</small></span></li>`; }).join('')}</ol>` : ''}
      <div class="carta meta"><b>${lista.length ? 'Vuoi esserci anche tu?' : `Ancora nessuna attività a ${esc(l.nome)}: la prima si vede di più!`}</b><small>Un negozio in 3D con il tuo nome, il tuo logo e il tuo WhatsApp, qui in città. Lo vede chi cerca la sua casa a ${esc(l.nome)}.</small>
      <div class="bottoni"><a class="botao" href="negozio.html?citta=${l.comune.istat}">🏪 Il tuo negozio a ${esc(l.nome)}</a><a class="botao sec" href="negozio.html?prodotto=cartellone&citta=${l.comune.istat}">📣 Cartellone</a></div></div>`;
  }
  comuneVuoto(c) {
    if (!c) return;
    if (c.luogo) return this.luogo(c.luogo);
    this.mappa.voar({ x: c.x, z: c.z, dist: 14, az: 0.3 });
    const r = this.D.regPorCod.get(c.reg);
    this.abrir(`
      <h2>🪧 Lotto libero a ${esc(c.nome)}</h2>
      <div class="sub">${esc(r.nome)} · ${num(c.pop)} abitanti · ancora nessuna casa</div>
      <div class="carta meta"><b>Diventa il fondatore o la fondatrice di ${esc(c.nome)}!</b><small>Commenta <b>${esc(c.nome)}, ${esc(r.nome)}</b> nell’ultimo post di @${PERFIL}: la prima casa della città sarà tua, per sempre.</small></div>
      <p class="nota">Conosci qualcuno di ${esc(c.nome)}? Taggalo nei commenti: se entra, guadagni +${REGOLE.punti.recluta} punti.</p>`);
  }

  // ---------- lote livre, outdoor e comércios ----------
  convite(l) {
    const url = `${location.origin}${location.pathname}?luogo=${encodeURIComponent(l.nome)}`;
    return `Vieni a vivere a ${l.nome}! 🏠 Commenta «${l.nome}, ${l.regione.nome}» nell’ultimo post di @${PERFIL} e ricevi la tua casa con il tuo @ sulla mappa 3D dell’Italia: ${url}`;
  }
  lotto(a) {
    const l = a.luogo;
    this.abrir(`
      <h2>🏡 Lotto libero a ${esc(l.nome)}</h2>
      <div class="sub">${esc(l.regione.nome)} · ${num(l.case)} ${l.case === 1 ? 'casa' : 'case'} · ${a.stato === 'lavori' ? 'lavori in corso' : 'in vendita'}</div>
      <div class="carta meta"><b>${a.ordem === 0 ? `Qui vivrà il prossimo vicino di ${esc(l.nome)}.` : 'Questo lotto aspetta il tuo amico.'}</b><small>Tagga un amico nei commenti dell’ultimo post di @${PERFIL}. Se commenta «${esc(l.nome)}, ${esc(l.regione.nome)}», la sua casa nasce qui e tu guadagni <b>+${REGOLE.punti.recluta} punti</b>.</small></div>
      <h3>Invito pronto da mandare</h3>
      <textarea class="convite" readonly rows="4">${esc(this.convite(l))}</textarea>
      <div class="bottoni"><button data-copia>📋 Copia l’invito</button><button class="sec" data-luogo="${l.id}">vedi ${esc(l.nome)}</button></div>
      <p class="nota">I lotti liberi sono solo un disegno: non contano come case e non hanno un proprietario finché qualcuno non commenta.</p>`);
  }
  copiarConvite(botao) {
    const ta = this.conteudo.querySelector('textarea.convite');
    if (!ta) return;
    const ok = () => { botao.textContent = '✅ Copiato! Incollalo in un commento o su WhatsApp'; };
    if (navigator.clipboard) navigator.clipboard.writeText(ta.value).then(ok, () => { ta.select(); });
    else { ta.select(); try { document.execCommand('copy'); ok(); } catch { /* seleção manual */ } }
  }
  pubblicita(l) {
    this.abrir(`
      <h2>📣 Spazio pubblicitario a ${esc(l.nome)}</h2>
      <div class="sub">${esc(l.regione.nome)} · ${num(l.case)} case · cartellone libero</div>
      <div class="carta meta"><b>Il tuo marchio qui, in 3D.</b><small>Questo cartellone lo vede chi cerca la sua casa a ${esc(l.nome)} e dintorni. Metti il tuo nome, un messaggio e il tuo logo: con un tocco i clienti ti scrivono su WhatsApp.</small></div>
      <div class="bottoni"><a class="botao" href="negozio.html?prodotto=cartellone&citta=${l.comune.istat}">Prenota il cartellone</a><a class="botao sec" href="negozio.html?citta=${l.comune.istat}">🏪 Un negozio in città</a></div>
      <p class="nota">Ogni attività viene controllata prima di andare sulla mappa.</p>`);
  }
  commercio(cm) {
    if (!cm) return;
    const l = cm.luogo, [, emoji, tipo] = tipoDi(cm.tipo);
    const wa = linkWhatsapp(cm.whatsapp, `Ciao! Vi ho trovato su Italia Casa per Casa 🏠`);
    const ig = cm.instagram ? `https://instagram.com/${encodeURIComponent(cm.instagram)}` : null;
    this.abrir(`
      <div class="tag-luogo" data-luogo="${l.id}">📍 ${esc(l.nome)} · ${esc(l.regione.nome)}</div>
      <h2>${emoji} ${esc(cm.nome)}</h2>
      <div class="sub">${esc(tipo)}${cm.prodotto === 'cartellone' ? ' · cartellone' : ''}</div>
      ${cm.logo ? `<img class="logo-commercio" src="${esc(cm.logo)}" alt="">` : ''}
      ${cm.descrizione ? `<p class="intro">${esc(cm.descrizione)}</p>` : ''}
      <div class="bottoni">
        ${wa ? `<a class="botao" href="${esc(wa)}" target="_blank" rel="noopener">💬 Scrivi su WhatsApp</a>` : ''}
        ${ig ? `<a class="botao sec" href="${esc(ig)}" target="_blank" rel="noopener">📸 @${esc(cm.instagram)}</a>` : ''}
      </div>
      ${cm.giocatore && this.D.porConta.get(cm.giocatore) ? `<div class="carta fond" data-casa="${esc(cm.giocatore)}">🏅 <b>Mecenate: @${esc(cm.giocatore)}</b><small>la casa di chi ha messo questa attività sulla mappa</small></div>` : ''}
      <p class="nota">Attività sulla mappa di ${esc(l.nome)}. <a href="negozio.html?citta=${l.comune.istat}">Vuoi anche tu la tua?</a></p>`);
  }

  // aba Negozi: todos os comércios do mapa, com busca e "vicino a me" (pela casa marcada como minha)
  negozi(filtro = 'tutti', busca = '') {
    const D = this.D, minha = this.minha && D.porConta.get(this.minha), base = minha && D.luoghi[minha.luogo];
    let lista = [...D.commerci];
    if (filtro === 'vicino' && base) lista.sort((a, b) => Math.hypot(a.luogo.x - base.x, a.luogo.z - base.z) - Math.hypot(b.luogo.x - base.x, b.luogo.z - base.z));
    const n = norm(busca);
    if (n) lista = lista.filter(cm => norm(`${cm.nome} ${cm.luogo.nome} ${tipoDi(cm.tipo)[2]}`).includes(n));
    const riga = (cm, i) => {
      const [, e, t] = tipoDi(cm.tipo);
      const km = filtro === 'vicino' && base ? ` · ${num(Math.round(Math.hypot(cm.luogo.x - base.x, cm.luogo.z - base.z)))} km` : '';
      return `<li data-commercio="${esc(cm.id)}"><span class="pos">${i + 1}</span><span class="quem"><b>${e} ${esc(cm.nome)}</b><small>${esc(t)} · ${esc(cm.luogo.nome)}${km}</small></span><span class="visita">visita</span></li>`;
    };
    this.abrir(`
      <h2>🏪 Visita i negozi della mappa</h2>
      <div class="sub">${num(D.commerci.length)} ${D.commerci.length === 1 ? 'attività sulla mappa' : 'attività sulla mappa'}</div>
      <div class="filtri"><button data-filtro="tutti" class="${filtro === 'tutti' ? 'on' : ''}">tutti</button><button data-filtro="vicino" class="${filtro === 'vicino' ? 'on' : ''}">vicino a me</button></div>
      ${filtro === 'vicino' && !base ? '<p class="nota">Per vedere i negozi vicini, cerca la tua casa e tocca «è la mia casa».</p>' : ''}
      <input class="cerca-negozi" type="search" placeholder="cerca negozio, città o tipo" value="${esc(busca)}">
      ${lista.length ? `<ol class="ranking negozi">${lista.map(riga).join('')}</ol>` : `<p class="nota">${D.commerci.length ? 'Nessun negozio con questo nome.' : 'Ancora nessun negozio: il primo si vede di più!'}</p>`}
      <a class="botao tratteggiato" href="negozio.html">＋ metti il tuo negozio sulla mappa</a>
      <p class="nota">Pubblicità. I negozi sulla mappa sono simbolici: non indicano l’indirizzo reale di ogni attività.</p>`, 'negozi');
    this.conteudo.querySelectorAll('[data-filtro]').forEach(b => { b.onclick = () => this.negozi(b.dataset.filtro, this.conteudo.querySelector('.cerca-negozi').value); });
    const inp = this.conteudo.querySelector('.cerca-negozi');
    inp.oninput = () => {
      const v = inp.value, pos = inp.selectionStart;
      this.negozi(filtro, v);
      const novo = this.conteudo.querySelector('.cerca-negozi');
      novo.focus(); novo.setSelectionRange(pos, pos);
    };
  }

  // ---------- região ----------
  regione(r) {
    if (!r) return;
    const D = this.D, k = r.carica ?? {}, guerra = D.snap.cariche.guerra, pos = guerra.findIndex(g => g.cod === r.cod) + 1;
    const luoghi = D.luoghi.filter(l => l.regione === r).sort((a, b) => b.case - a.case);
    const ext = luoghi.length ? luoghi.reduce((m, l) => Math.max(m, Math.hypot(l.x - r.lx, l.z - r.lz)), 0) : 60;
    this.mappa.voar({ x: r.lx, z: r.lz, dist: Math.min(900, Math.max(140, ext * 3.2)), az: 0 });
    this.abrir(`
      <h2>🗺 ${esc(r.nome)}</h2>
      <div class="sub">${num(r.case)} case in ${num(r.luoghi)} di ${num(r.comuni)} comuni · n. ${pos} nella guerra delle regioni</div>
      <h3>Governo della regione</h3>
      <div class="linha"><span>${NOMI_CARICHE.presidente_regione}</span><span>${k.presidente ? `<a data-casa="${esc(k.presidente.conta)}">@${esc(k.presidente.conta)}</a> · ${num(k.presidente.pts)} pt` : '—'}</span></div>
      <div class="linha col"><span>Senatori/Senatrici (${(k.senatori ?? []).length}/${REGOLE.posti.senatoriPerRegione})</span><span class="chips-mini">${(k.senatori ?? []).map(x => `<a data-casa="${esc(x.conta)}">@${esc(x.conta)}</a>`).join('') || '—'}</span></div>
      <div class="linha col"><span>Deputati/e (${(k.deputati ?? []).length})</span><span class="chips-mini">${(k.deputati ?? []).map(x => `<a data-casa="${esc(x.conta)}">@${esc(x.conta)}</a>`).join('') || '—'}</span></div>
      <h3>Le città con più case</h3>
      <ol class="ranking citta">${luoghi.slice(0, 10).map((l, i) => `<li data-luogo="${l.id}"><span class="pos">${i + 1}</span><span class="quem"><b>${esc(l.nome)}</b><small>fondata da @${esc(l.fondatore)}</small></span><span class="pts">${num(l.case)}</span></li>`).join('')}</ol>`);
  }

  // ---------- Palazzo ----------
  palazzo() {
    const D = this.D, k = D.snap.cariche, p = k.presidente, pc = p && D.porConta.get(p.conta);
    const max = k.guerra[0]?.pts || 1;
    this.abrir(`
      <h2>🏛 Palazzo Chigi</h2>
      <div class="sub">Mandato ${D.snap.mandato.n} · chiude ${this.fimMandato()} (ora di Roma)</div>
      <div class="conto"><span id="conto">${this.contagem()}</span><small>alla fine del mandato</small></div>
      <h3>${NOMI_CARICHE.presidente}</h3>
      ${pc ? `<div class="carta pres"><b class="grande">@${esc(pc.conta)}</b><small>${esc(D.luoghi[pc.luogo].nome)}, ${esc(D.luoghi[pc.luogo].regione.nome)} · eletto/a domenica (mandato ${p.eletto_nel_mandato}) con ${num(p.pts_elezione)} punti · ${num(pc.sett)} punti questa settimana</small><button data-casa="${esc(pc.conta)}">vedi casa</button></div>` : '<div class="carta meta"><b>Ancora nessun Presidente</b><small>Il primo Presidente del Consiglio sarà eletto domenica alle 21 con i punti di questa settimana.</small></div>'}
      <div class="elezione">🏁 Prossima elezione: ${k.leader ? `in testa <a data-casa="${esc(k.leader.conta)}">@${esc(k.leader.conta)}</a> con ${punti(k.leader.pts)}` : 'nessuno ha ancora punti'} · chiude ${this.fimMandato()}</div>
      <h3>Guerra delle regioni <small>(punti del mandato)</small></h3>
      <div class="guerra">${k.guerra.map((g, i) => `<div class="riga" data-regione="${g.cod}"><span>${i + 1}. ${esc(D.regPorCod.get(g.cod).nome)}</span><b>${num(g.pts)}</b><i style="width:${(100 * g.pts / max).toFixed(1)}%"></i></div>`).join('')}</div>
      <h3>Presidenti di Regione</h3>
      <ol class="ranking">${D.regioni.map((r, i) => r.carica?.presidente ? `<li data-casa="${esc(r.carica.presidente.conta)}"><span class="pos">🏛</span><span class="quem"><b>@${esc(r.carica.presidente.conta)}</b><small>${esc(r.nome)}</small></span><span class="pts">${num(r.carica.presidente.pts)}</span></li>` : '').join('')}</ol>
      <a class="botao segui" href="https://www.instagram.com/italiacasapercasa/" target="_blank" rel="noopener">📲 Segui @${PERFIL} per sapere chi vince domenica</a>
      <p class="nota">Gioco apartitico: le cariche sono di gioco.</p>`, 'palazzo');
  }

  // classificação com abas: cidade, região ou Itália inteira
  classifica(ambito = 'italia', id = null) {
    const D = this.D, mia = this.minha && D.porConta.get(this.minha);
    const top = [...D.luoghi].sort((a, b) => b.case - a.case);
    let lista = D.ranking, titolo = 'Italia', n = D.casas.length;
    if (ambito === 'citta') {
      const l = D.luoghi[id ?? (mia ? mia.luogo : top[0].id)];
      id = l.id; titolo = l.nome; n = l.case;
      lista = l.casas.map(i => D.casas[i]).sort((a, b) => b.sett - a.sett || a.ts - b.ts);
    } else if (ambito === 'regione') {
      const r = D.regPorCod.get(id ?? (mia ? D.luoghi[mia.luogo].regione.cod : D.regioni[0].cod));
      id = r.cod; titolo = r.nome; n = r.case;
      lista = D.ranking.filter(c => D.luoghi[c.luogo].regione === r);
    }
    const agora = Date.now() / 1000, fuoco = lista.filter(c => c.fiamme > agora).length;
    const scelta = ambito === 'citta'
      ? `<select class="scegli" data-ambito="citta">${(mia ? [D.luoghi[mia.luogo]] : []).concat(top.slice(0, 300)).filter((l, i, a) => a.indexOf(l) === i).map(l => `<option value="${l.id}"${l.id === id ? ' selected' : ''}>${esc(l.nome)} (${num(l.case)})</option>`).join('')}</select>`
      : ambito === 'regione' ? `<select class="scegli" data-ambito="regione">${D.regioni.map(r => `<option value="${r.cod}"${r.cod === id ? ' selected' : ''}>${esc(r.nome)}</option>`).join('')}</select>` : '';
    const posMia = mia ? lista.indexOf(mia) : -1;
    this.abrir(`
      <h2>🏆 Classifica</h2>
      <div class="sub">Mandato ${D.snap.mandato.n} · chiude ${this.fimMandato()} (ora di Roma)</div>
      <div class="ambiti">${[['citta', 'Città', 'scegli'], ['regione', 'Regione', 'scegli'], ['italia', 'Italia', 'tutto il paese']].map(([k, t, s]) => `<button data-ambito-tab="${k}" class="${k === ambito ? 'on' : ''}"><b>${t}</b><small>${s}</small></button>`).join('')}</div>
      ${scelta}
      <div class="rk-testa"><b>${esc(titolo)}</b> <small>${num(n)} case</small>${fuoco ? `<span class="rk-fuoco" data-ir="fiamme">🔥 ${num(fuoco)} in fiamme ora</span>` : ''}</div>
      <div class="rk-col"><span>posizione · @ · carica</span><span>punti del mandato</span></div>
      <ol class="ranking">${lista.slice(0, 100).map((c, i) => this.linhaRank(c, i)).join('') || '<p class="nota">Ancora nessuno ha punti qui.</p>'}</ol>
      <p class="nota">Punti del mandato ${D.snap.mandato.n} (da domenica alle 21 a domenica alle 21, ora di Roma). Parità: vince la casa più antica.</p>
      <div class="rk-piede">${mia ? (posMia >= 0 ? `<span data-casa="${esc(mia.conta)}">Tu: <b>n. ${num(posMia + 1)}</b> qui · ${punti(mia.sett)}</span>` : `<span data-casa="${esc(mia.conta)}">La tua casa non è in questa classifica</span>`) : 'E tu? <a data-ir="cerca">Cerca la tua casa</a> e tocca «è la mia casa» per vederti qui'}</div>`, 'classifica');
    this.conteudo.querySelectorAll('[data-ambito-tab]').forEach(b => { b.onclick = () => this.classifica(b.dataset.ambitoTab); });
    const sel = this.conteudo.querySelector('.scegli');
    if (sel) sel.onchange = () => this.classifica(sel.dataset.ambito, sel.dataset.ambito === 'citta' ? +sel.value : sel.value);
    const cerca = this.conteudo.querySelector('[data-ir="cerca"]');
    if (cerca) cerca.onclick = e => { e.stopPropagation(); this.fechar(); $('#q').focus(); };
  }

  tabellone() {
    const D = this.D, k = D.snap.contatori, top = [...D.luoghi].sort((a, b) => b.case - a.case).slice(0, 50);
    const popTot = D.comuni.reduce((s, c) => s + c.pop, 0), popCasa = D.luoghi.reduce((s, l) => s + l.comune.pop, 0);
    const regioniCasa = D.regioni.filter(r => r.case > 0).length, agora = Date.now() / 1000;
    const pct = v => `${(100 * v).toLocaleString('it-IT', { maximumFractionDigits: 1 })}%`;
    const conSindaco = Object.keys(D.snap.cariche.sindaci ?? {}).length;
    this.abrir(`
      <h2>📊 Tabellone</h2>
      <div class="sub">La mappa adesso · ${esc(D.snap.versao)}</div>
      <div class="segna"><b>${num(k.case)}</b><small>case sulla mappa</small></div>
      <div class="tessere">
        <div><b>${num(D.luoghi.length)}</b><small>città</small></div>
        <div><b>${regioniCasa}/${D.regioni.length}</b><small>regioni</small></div>
        <div><b>${pct(D.luoghi.length / D.comuni.length)}</b><small>dei comuni</small></div>
        <div><b>${pct(popCasa / popTot)}</b><small>della gente*</small></div>
      </div>
      <div class="bottoni"><button data-condividi="tabellone">📤 Condividi il tabellone</button></div>
      <div class="linha"><span>Commenti letti</span><span>${num(k.commenti)}</span></div>
      <div class="linha"><span>Account che hanno commentato</span><span>${num(k.contas)}</span></div>
      <div class="linha"><span>Fondatori e fondatrici</span><span>${num(D.luoghi.length)}</span></div>
      <div class="linha"><span>Follower</span><span>${num(k.follower)}</span></div>
      <div class="linha"><span>Case in fiamme ora 🔥</span><span>${num(D.casas.filter(c => c.fiamme > agora).length)}</span></div>
      <div class="linha"><span>Comuni con sindaco/a</span><span>${num(conSindaco)} di ${num(D.comuni.length)}</span></div>
      <h3>🏙 Le città con più case</h3>
      <ol class="ranking citta">${top.map((l, i) => `<li data-luogo="${l.id}"><span class="pos">${i + 1}</span><span class="quem"><b>${esc(l.nome)}</b><small>${esc(l.regione.nome)}</small></span><span class="pts">${num(l.case)}</span></li>`).join('')}</ol>
      <h3>📰 Ultime dalla mappa</h3>
      <div class="notizie">${this.notizie()}</div>
      <p class="nota">* vive in un comune che ha già almeno una casa (popolazione ISTAT). Una casa per account: ripetere il commento non conta.</p>`, 'tabellone');
  }

  notizie() {
    const D = this.D, nomeCom = ist => esc(D.comunePorIstat.get(ist)?.nome ?? '?'), quem = c => `<a data-casa="${esc(c)}">@${esc(c)}</a>`;
    const fa = ts => { const m = Math.round((Date.parse(D.snap.dati_fino) - Date.parse(ts)) / 60000); return m < 60 ? `${Math.max(1, m)} min fa` : m < 1440 ? `${Math.round(m / 60)} h fa` : `${Math.round(m / 1440)} g fa`; };
    const txt = e => ({
      citta_fondata: () => `🏁 ${quem(e.fondatore)} ha fondato <b>${nomeCom(e.luogo)}</b>`,
      disputa: () => `⚔️ Fondazione contesa a <b>${nomeCom(e.luogo)}</b>: ${quem(e.fondatore)} ha battuto ${quem(e.secondo)} per ${e.differenza_s} secondi`,
      livello: () => `🏗️ La casa di ${quem(e.conta)} è diventata: <b>${esc(REGOLE.livelli[e.livello].nome)}</b>`,
      presidente_eletto: () => `🏛 ${quem(e.conta)} è stato/a eletto/a ${NOMI_CARICHE.presidente} con ${punti(e.pts)}`,
    }[e.tipo]?.() ?? '');
    return (D.snap.eventi ?? []).slice(0, 20).map(e => `<div class="notizia"><span>${txt(e)}</span><small>${fa(e.ts)}</small></div>`).join('') || '<p class="nota">Ancora nessuna notizia.</p>';
  }

  derby() {
    const D = this.D, dz = D.snap.derby;
    if (!dz) return;
    const [a, b] = [D.comunePorIstat.get(dz.a), D.comunePorIstat.get(dz.b)];
    const tot = dz.pts_a + dz.pts_b || 1, pa = Math.round(100 * dz.pts_a / tot);
    const top = c => (c.luogo?.casas ?? []).map(i => D.casas[i]).sort((x, y) => y.sett - x.sett).slice(0, 5);
    const lado = c => `<h3>Chi spinge ${esc(c.nome)}</h3><ol class="ranking">${top(c).map((x, i) => this.linhaRank(x, i)).join('')}</ol>`;
    this.abrir(`
      <h2>⚔️ Derby della settimana</h2>
      <div class="sub">Mandato ${D.snap.mandato.n} · chiude ${this.fimMandato()} (ora di Roma)</div>
      <div class="derby">
        <div data-luogo="${a.luogo?.id}"><b>${esc(a.nome)}</b><span>${num(dz.pts_a)}</span></div>
        <em>VS</em>
        <div data-luogo="${b.luogo?.id}"><b>${esc(b.nome)}</b><span>${num(dz.pts_b)}</span></div>
      </div>
      <div class="barra-derby"><i style="width:${pa}%"></i></div>
      <div class="carta meta"><b>Sei di ${esc(a.nome)} o di ${esc(b.nome)}?</b><small>Commenta nell’ultimo post di @${PERFIL}: ogni punto che fai questa settimana va alla tua città.</small></div>
      ${lado(a)}${lado(b)}`);
  }

  meta() {
    const D = this.D, alvo = this.metaCase(), n = D.casas.length, pct = Math.round(100 * n / alvo);
    const com = D.luoghi.length, ital = 58_900_000;
    this.abrir(`
      <h2>🎯 Prossimo traguardo</h2>
      <div class="sub">Tutti insieme: ogni commento con città e regione è una casa in più</div>
      <div class="conto"><span>${num(n)} / ${num(alvo)}</span><small>case sulla mappa</small></div>
      <div class="progresso grande"><i style="width:${pct}%"></i></div>
      <p class="intro">Mancano <b>${num(alvo - n)}</b> case. Tagga un amico che non ha ancora casa: quando entra guadagni <b>+${REGOLE.punti.recluta} punti</b>.</p>
      <div class="linha"><span>Città con almeno una casa</span><span><b>${num(com)}</b> di ${num(D.comuni.length)}</span></div>
      <div class="linha"><span>Una casa per ogni italiano</span><span>siamo allo <b>${(100 * n / ital).toLocaleString('it-IT', { maximumFractionDigits: 2 })} %</b> 😅</span></div>
      <div class="bottoni"><button data-ir="senzapadrone">🏚 Vedi le città senza padrone</button></div>`);
  }

  // ---------- imagens para a story ----------
  async mostrarImagem(titulo, nome, gerar, texto) {
    this.abrir(`<h2>📸 ${esc(titulo)}</h2><div class="sub">Preparo l’immagine…</div><div class="anteprima vuota"><div class="palla"></div></div>`);
    let blob;
    try {
      await new Promise(ok => requestAnimationFrame(() => setTimeout(ok, 30)));
      const canvas = await gerar();
      blob = await new Promise(ok => canvas.toBlob(ok, 'image/png'));
    } catch (e) {
      console.error(e);
      this.abrir(`<h2>📸 ${esc(titulo)}</h2><div class="sub">Ops, non sono riuscito a creare l’immagine. Riprova.</div>`);
      return;
    }
    const url = URL.createObjectURL(blob), file = new File([blob], nome, { type: 'image/png' });
    const podeCompartilhar = !!navigator.canShare?.({ files: [file] });
    this.abrir(`
      <h2>📸 ${esc(titulo)}</h2>
      <div class="sub">Condividila nella tua storia e tagga <b>@${PERFIL}</b></div>
      <img class="anteprima" src="${url}" alt="${esc(titulo)}">
      <div class="bottoni">
        ${podeCompartilhar ? '<button id="img-condividi">📤 Condividi</button>' : ''}
        <a class="botao ${podeCompartilhar ? 'sec' : ''}" href="${url}" download="${esc(nome)}">⬇️ Scarica</a>
      </div>
      <p class="nota">Nella storia, aggiungi il link alla mappa e tagga @${PERFIL}: ti diamo i punti al prossimo aggiornamento.</p>`);
    $('#img-condividi')?.addEventListener('click', () => navigator.share({ files: [file], text: texto }).catch(() => {}));
  }
  storiaCasa(c) {
    if (!c) return;
    this.mostrarImagem('La tua casa nella storia', `casa-${c.conta}.png`, () => immagineCasa(this.fot, this.citta, this.D, c), `La mia casa su Italia Casa per Casa! @${PERFIL}`);
  }
  attoFondazione(l) {
    if (!l) return;
    this.mostrarImagem(`Atto di fondazione di ${l.nome}`, `fondazione-${l.nome}.png`, () => immagineFondazione(this.fot, this.citta, this.D, l), `${l.nome} è stata fondata da @${l.fondatore} su Italia Casa per Casa! @${PERFIL}`);
  }

  senzaPadrone() {
    const D = this.D, vuoti = D.comuni.filter(c => !c.luogo).sort((a, b) => b.pop - a.pop);
    this.abrir(`
      <h2>🏚 Città senza padrone</h2>
      <div class="sub"><b>${num(vuoti.length)}</b> comuni su ${num(D.comuni.length)} non hanno ancora nemmeno una casa</div>
      <div class="carta meta"><b>La prima casa di una città è del fondatore, per sempre.</b><small>Commenta la città e la regione nell’ultimo post di @${PERFIL}. Conosci qualcuno di lì? Taggalo: +${REGOLE.punti.recluta} punti se entra.</small></div>
      <h3>Le città più grandi ancora vuote</h3>
      <ol class="ranking citta">${vuoti.slice(0, 40).map((c, i) => `<li data-comune="${c.istat}"><span class="pos">${i + 1}</span><span class="quem"><b>${esc(c.nome)}</b><small>${esc(D.regPorCod.get(c.reg).nome)}</small></span><span class="pts">${num(c.pop)} ab.</span></li>`).join('')}</ol>`, 'senzapadrone');
  }

  fiamme() {
    this.abrir(`
      <h2>🔥 In fiamme ora</h2>
      <div class="sub">Case con una storia che tagga @${PERFIL} nelle ultime ${REGOLE.fiamme_h} ore</div>
      <ol class="ranking">${this.emFiamme.slice(0, 100).map((c, i) => this.linhaRank(c, i, ` · fino alle ${ora(c.fiamme * 1000)}`)).join('')}</ol>
      <p class="nota">Carica la tua casa nella storia e tagga @${PERFIL}: +${REGOLE.punti.storia} punti e la tua casa in fiamme per ${REGOLE.fiamme_h} ore.</p>`);
  }

  comeFunziona() {
    const P = REGOLE.punti;
    this.abrir(`
      <h2>Come funziona?</h2>
      <div class="sub">commenta la tua città e la regione in un post di @${PERFIL}: appare la tua casa con il tuo @</div>
      <h3>1. La tua casa cresce</h3>
      <p class="intro">Con i tuoi punti la tua casa cresce sulla mappa: da casetta a grattacielo. Ogni punto conta per sempre: la tua casa non si rimpicciolisce mai.</p>
      <div class="scala lista">${REGOLE.livelli.map((n, i) => `<div class="gradino">${iconaLivello(i)}<small>${esc(n.nome)}</small><b>${num(n.min)}+</b></div>`).join('')}</div>
      <h3>2. Le cariche</h3>
      <p class="intro">Le cariche si vincono ogni settimana con i punti del mandato (da domenica alle 21 a domenica alle 21, ora di Roma). Chi fa più punti governa, dall’alto verso il basso, una carica a persona. Il Presidente del Consiglio e i sindaci si eleggono la domenica alle 21 e governano tutta la settimana; le altre cariche si vincono in diretta.</p>
      <ol class="ranking cariche">${REGOLE.cariche.map(k => `<li><span class="quem"><b>${NOMI_CARICHE[k]}</b><small>${DESCR_CARICHE[k]}</small></span></li>`).join('')}</ol>
      <h3>3. Come guadagnare punti</h3>
      <div class="azioni">${COME_GUADAGNARE(P).map(([k, nome, txt]) => `<div class="azione"><i style="background:${FONTI.find(f => f[0] === k)[2]}"></i><div><b>${nome}</b><small>${txt}</small></div></div>`).join('')}</div>
      <h3>4. La storia</h3>
      <p class="intro">Carica la tua casa nella storia e tagga @${PERFIL}: +${P.storia} punti (1 volta al giorno) e la tua casa in fiamme per 24 ore. Sulla mappa cerca il tuo @ e tocca «Carica la tua casa nella storia»: ti diamo l’immagine pronta.</p>
      <div class="bottoni">${this.minha ? `<button data-casa="${esc(this.minha)}">vai alla mia casa</button>` : '<button data-ir="cerca">cerca la mia casa</button>'}</div>
      <a class="botao segui" href="https://www.instagram.com/italiacasapercasa/" target="_blank" rel="noopener">📲 Segui @${PERFIL} per non perderti elezioni e novità</a>
      <p class="nota">Il fondatore o la fondatrice di una città lo è per sempre; la carica si vince ogni settimana. Nessuno può comprare cariche: i punti di chi mette un’attività sulla mappa fanno crescere la casa, ma non contano per le elezioni. Gioco apartitico: le cariche sono di gioco. <a href="privacy.html" target="_blank" rel="noopener">Regole e privacy</a>.</p>`);
    const b = this.conteudo.querySelector('[data-ir="cerca"]');
    if (b) b.onclick = () => { this.fechar(); $('#q').focus(); };
  }

  video() {
    this.abrir(`
      <h2>Vuoi fare video così? 🎬</h2>
      <div class="sub">Mappe 3D, case che crescono, città che si riempiono: stiamo preparando uno strumento per creare video come i nostri.</div>
      <form id="lista-attesa" class="modulo">
        <label>La tua email<input type="email" name="email" required placeholder="nome@esempio.it"></label>
        <label>Il tuo Instagram (facoltativo)<input name="conta" placeholder="@il_tuo_account"></label>
        <button type="submit">Avvisami per primo</button>
      </form>
      <p class="nota">Usiamo la tua email solo per avvisarti. <a href="privacy.html#lista" target="_blank" rel="noopener">Privacy</a></p>`);
    $('#lista-attesa').onsubmit = async e => {
      e.preventDefault();
      const f = new FormData(e.target), b = e.target.querySelector('button');
      b.disabled = true;
      try {
        const r = await fetch('api/lista.php', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: f.get('email'), conta: f.get('conta'), origem: 'video' }) });
        const j = await r.json().catch(() => ({}));
        if (!j.ok) throw new Error(j.erro || 'Non siamo riusciti a salvare. Riprova.');
        gravar('lista_attesa', f.get('email'));
        this.abrir('<h2>Fatto! Ti avvisiamo per primo. 🎉</h2><div class="sub">Intanto, cerca la tua casa sulla mappa.</div>');
      } catch (err) {
        b.disabled = false;
        this.aviso(err.message);
      }
    };
  }

  condividir(o) {
    if (o.startsWith('luogo:')) {
      const l = this.D.luoghi[+o.split(':')[1]];
      return this.mostrarImagem(`Condividi ${l.nome}`, `citta-${l.nome}.png`, () => immagineCitta(this.fot, this.citta, this.D, l), `Guarda ${l.nome} su Italia Casa per Casa! @${PERFIL}`);
    }
    const url = location.origin + location.pathname;
    const txt = o === 'tabellone' ? `Le città con più case di Italia Casa per Casa. E la tua? ${url}#tabellone` : `Guarda ${this.D.luoghi[+o.split(':')[1]].nome} su Italia Casa per Casa: ${url}`;
    if (navigator.share) navigator.share({ text: txt }).catch(() => {});
    else navigator.clipboard?.writeText(txt).then(() => this.aviso('Link copiato!'), () => this.aviso(txt));
  }
}
