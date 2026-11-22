// Conta do site (botão no topo à esquerda): entrar com e-mail + código (sem senha), ligar o Instagram com o código
// CASA-1234, crediti 💰 do dia (pegos sozinhos ao abrir o site) e vitrine do que vai estar à venda.
// Servidor: api/conto.php (sessão por cookie httpOnly). Preços e pacotes: data/crediti.json.
import { PERFIL } from './storie.js';
import { EditorPersonaggio } from './personaggio.js';

const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const n = v => Number(v).toLocaleString('it-IT');
const ler = k => { try { return localStorage.getItem(k); } catch { return null; } };
const gravar = (k, v) => { try { localStorage.setItem(k, v); } catch { /* sem storage */ } };
const NOVITA = 'conto-v1';
const TIPI = { giornaliero: '🎁 Crediti del giorno', serie: '🔥 Bonus giorni di fila', ricarica: '💳 Ricarica', bonus_ricarica: '🎁 Bonus prima ricarica', rimborso: '↩️ Rimborso', regalo: '🎁 Regalo', acquisto: '🛍️ Acquisto', tesoro: '🧭 Tesoro trovato', regalo_deco: '🎁 Decorazione regalata' };

export class Conto {
  constructor(D, ui) {
    this.D = D; this.ui = ui;
    this.p = null;              // perfil (null = fora)
    this.cfg = null;            // data/crediti.json
    this.email = '';            // e-mail digitado (passo do código)
    this.passo = 'email';
    this.editor = new EditorPersonaggio(ui, this);
    this.bt = $('#mio-conto');
    this.bt.onclick = () => this.apri();
    this.bt.classList.toggle('novita', ler('conto_visto') !== NOVITA);
    this.desenharBotao();
    this.iniciar();
  }

  async iniciar() {
    const v = document.querySelector('meta[name="versione"]')?.content ?? '';
    fetch(`data/crediti.json?v=${v}`).then(r => r.json()).then(j => { this.cfg = j; }).catch(() => {});
    try { this.p = (await this.api('io')).profilo; } catch { this.p = null; }
    await this.depoisDeEntrar(location.hash === '#conto');
  }

  async api(a, extra = {}) {
    let j = null;
    try {
      const r = await fetch('api/conto.php', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ a, ...extra }) });
      j = await r.json();
    } catch { throw new Error('Connessione assente. Riprova tra un attimo.'); }
    if (j?.uscito) { this.p = null; this.desenharBotao(); }
    if (!j?.ok) throw new Error(j?.erro || 'Qualcosa è andato storto. Riprova.');
    return j;
  }

  // entrou (ou abriu o site já logado): pega os créditos do dia sozinho e ajuda os jogos com o @
  async depoisDeEntrar(abrir) {
    this.desenharBotao();
    if (this.p?.proprietario) { await this.ui.decori?.ricaricaProprieta(); if (abrir) this.apri(); return; }   // dono: sem prêmio e sem @ automático nos jogos
    if (this.p?.conta && this.ui.missioni && !this.ui.missioni.conta && this.D.porConta.has(this.p.conta)) this.ui.missioni.conta = this.p.conta;
    if (this.p?.conta && !this.p.premio_oggi) await this.premio(true);
    if (abrir) this.apri();
  }
  async premio(silenzioso = false) {
    try {
      const j = await this.api('premio');
      this.p = j.profilo;
      this.desenharBotao();
      if (j.premio) this.ui.aviso(`🎁 +${j.premio.crediti} 💰${j.premio.bonus ? ' (bonus!)' : ''} · 🔥 ${j.premio.serie} ${j.premio.serie === 1 ? 'giorno' : 'giorni di fila'}`);
      if (!silenzioso) this.apri();
    } catch (e) { if (!silenzioso) this.ui.aviso(e.message); }
  }

  desenharBotao() {
    const p = this.p;
    this.bt.innerHTML = p ? `💰 <b>${n(p.saldo)}</b>` : '👤 <b>Accedi</b>';
    this.bt.setAttribute('aria-label', p ? `Il tuo account: ${p.saldo} crediti` : 'Accedi al tuo account');
    this.bt.classList.toggle('dentro', !!p);
  }

  // ---------- telas ----------
  apri() {
    gravar('conto_visto', NOVITA); this.bt.classList.remove('novita');
    if (location.hash !== '#conto') history.replaceState(null, '', '#conto');
    this.ui.abrir(this.p ? this.htmlConta() : this.htmlEntra(), null);
    const foco = $(this.p ? '#ct-conta' : this.passo === 'email' ? '#ct-email' : '#ct-cod');
    if (foco && !this.p) setTimeout(() => foco.focus(), 50);
    $('#ct-email')?.addEventListener('keydown', e => { if (e.key === 'Enter') this.azione({ dataset: { ct: 'codice' } }); });
    $('#ct-cod')?.addEventListener('input', e => { if (e.target.value.replace(/\D/g, '').length === 6) this.azione({ dataset: { ct: 'entra' } }); });
    $('#ct-conta')?.addEventListener('keydown', e => { if (e.key === 'Enter') this.azione({ dataset: { ct: 'collega' } }); });
  }

  htmlEntra() {
    const vantaggi = `<div class="ct-vantaggi"><div>💰 <b>Crediti gratis</b> ogni giorno che entri</div><div>🔥 <b>Bonus</b> se entri tutti i giorni (+20 al 7° giorno, +100 al 30°)</div><div>🚶 <b>Passeggia</b> per le strade della tua città</div><div>🔑 <b>Entra nella tua casa</b> e arredala</div><div>🏰 Ville, castelli, 🚲 bici, 🛵 Vespa e 🏎️ auto</div></div>`;
    if (this.passo === 'codice') return `<h2>📩 Controlla l’email</h2>
      <div class="sub">Abbiamo mandato un codice di 6 cifre a <b>${esc(this.email)}</b></div>
      <div class="ms-campo ct-cod"><input id="ct-cod" inputmode="numeric" autocomplete="one-time-code" maxlength="7" placeholder="123456" aria-label="Codice"></div>
      <div class="bottoni"><button data-ct="entra">✅ Entra</button><button class="sec" data-ct="indietro">✏️ Cambia email</button></div>
      <div class="ct-sicuro">⏳ Può arrivare dopo <b>1–2 minuti</b>. Guarda anche in <b>Spam</b> e <b>Promozioni</b>. Il codice vale 30 minuti: se ne arrivano due, funzionano tutti e due.</div>
      <p class="nota">Non arriva ancora? <button class="ct-link" data-ct="codice" id="ct-rimanda">Mandamelo di nuovo</button></p>`;
    return `<h2>👤 Il tuo account</h2>
      <div class="sub">Entra con la tua email: ti mandiamo un codice. Niente password da ricordare.</div>
      ${vantaggi}
      <div class="ms-campo"><input id="ct-email" type="email" autocomplete="email" inputmode="email" placeholder="la.tua@email.it" value="${esc(this.email)}" aria-label="Email"></div>
      <div class="bottoni"><button data-ct="codice">📩 Mandami il codice</button></div>
      <div class="ct-sicuro">🔒 <b>Accesso sicuro senza password:</b> nessuno può entrare senza il codice che arriva sulla tua email. Ti avvisiamo a ogni nuovo accesso.</div>
      <p class="nota">Usiamo l’email solo per farti entrare e per le ricevute. <a href="privacy.html#account" class="link">Privacy</a> · <a href="termini.html" class="link">Regole dei crediti</a></p>`;
  }

  htmlConta() {
    const p = this.p, g = this.cfg?.giornaliero ?? { base: 2, serie: [[30, 100], [7, 20]] };
    // próximo bônus de série
    const prox = (g.serie ?? []).map(([ogni, extra]) => ({ giorno: Math.ceil((p.serie + 1) / ogni) * ogni, extra })).sort((a, b) => a.giorno - b.giorno)[0];
    let premio;
    if (!p.conta || p.proprietario) premio = '';
    else if (p.premio_oggi) premio = `<div class="ms-serie">✅ Crediti di oggi presi · 🔥 <b>${p.serie} ${p.serie === 1 ? 'giorno' : 'giorni di fila'}</b>${prox ? `<br><small>Torna domani: al ${prox.giorno}° giorno di fila ricevi <b>+${prox.extra} 💰</b> in più.</small>` : ''}</div>`;
    else premio = `<div class="ms-card"><span class="ms-ic">🎁</span><div class="ms-tx"><b>Crediti di oggi</b><small>+${g.base} 💰 ogni giorno che entri</small></div><button data-ct="premio">Prendi</button></div>`;
    let ig;
    if (p.proprietario) ig = `<div class="ms-codice">🛠️ <b>Account del proprietario</b> (prova): crediti di prova, niente email, niente premio del giorno.
        Villa, castello e casa con interni restano solo tuoi: non occupano il castello della regione e non toccano la casa del giocatore.
        <br>Casa in prova: <b>${p.conta ? `@${esc(p.conta)}` : 'nessuna'}</b></div>
        <div class="ms-chi"><label for="ct-conta">Prova con la casa di qualsiasi @ (il giocatore non perde niente)</label>
        <div class="ms-campo"><span>@</span><input id="ct-conta" autocomplete="off" autocapitalize="none" spellcheck="false" placeholder="nome_instagram" value=""></div>
        <div class="bottoni"><button data-ct="collega">Usa questa casa</button></div></div>`;
    else if (p.conta) ig = `<div class="ms-ok">📸 Instagram collegato: <b>@${esc(p.conta)}</b></div>`;
    else if (p.attesa) ig = `<div class="ms-codice">📸 Per collegare <b>@${esc(p.attesa.conta)}</b> commenta questo codice sotto un nostro post su Instagram:<br>
        <span class="cod">${esc(p.attesa.codice)}</span><br><small>Entro circa 30 minuti il tuo account si collega da solo e ricevi i crediti del giorno.</small>
        <button data-ct="copia">📋 Copia il codice e apri Instagram</button></div>
        <div class="bottoni"><button class="sec" data-ct="io">🔄 Controlla</button><button class="sec" data-ct="scollega">✏️ Cambia @</button></div>`;
    else ig = `<div class="ms-chi"><label for="ct-conta">📸 Collega il tuo Instagram per ricevere i crediti ogni giorno</label>
        <div class="ms-campo"><span>@</span><input id="ct-conta" autocomplete="off" autocapitalize="none" spellcheck="false" placeholder="il_tuo_nome" value="${esc(this.ui.minha ?? '')}"></div>
        <div class="bottoni"><button data-ct="collega">Collega</button></div><small class="ct-mini">Serve una casa sulla mappa con quel nome.</small></div>`;
    // loja: o que tem "vendita" compra direto daqui; o resto aparece como "presto"
    const own = new Set(p.oggetti ?? []);
    const cast = this.castelloMio();
    const cat = (this.cfg?.catalogo ?? []).filter(x => x.id !== 'decora').map(x => {
      const tua = own.has(x.id), ora = !!x.vendita;
      let nota = x.nota ? esc(x.nota) : '', bt = '';
      if (x.id === 'castello' && ora && !tua) {
        if (!p.conta) nota = 'Collega il tuo Instagram: il castello va sulla tua casa';
        else if (cast?.chi) nota = `🔒 Il castello della regione ${esc(cast.regione)} è già di @${esc(cast.chi)}`;
        else if (cast) nota = `🔓 Il castello della regione ${esc(cast.regione)} è ancora libero!`;
      }
      if (ora && !tua && (!(x.id === 'castello' && cast?.chi) || p.proprietario)) bt = `<button data-ct="compra" data-item="${x.id}">Compra</button>`;
      if (x.id === 'interni' && tua) bt = `<button class="sec" data-ct="miacasa">Entra</button>`;
      return `<div class="ct-item${ora ? ' ora' : ''}${tua ? ' tua' : ''}"><span>${x.icona}</span><b>${esc(x.nome)}</b><em>${tua ? '✅ Tua' : `${n(x.prezzo)} 💰${ora ? '' : ' · presto'}`}</em>${nota ? `<small>${nota}</small>` : ''}${bt}</div>`;
    }).join('');
    const pac = (this.cfg?.pacchetti ?? []).map(x => {
      const pieno = (this.cfg?.mobili ?? []).filter(m => x.mobili.includes(m.id)).reduce((s, m) => s + m.prezzo, 0), tutti = x.mobili.every(m => own.has(`mob_${m}`));
      return `<div class="ct-item ora${tutti ? ' tua' : ''}"><span>${x.icona}</span><b>${esc(x.nome)}</b><em>${tutti ? '✅ Tuo' : `<s>${n(pieno)}</s> ${n(x.prezzo)} 💰`}</em><small>${x.mobili.length} mobili · per la casa con interni</small>${tutti ? '' : `<button data-ct="compra" data-item="pac_${x.id}">Compra</button>`}</div>`;
    }).join('');
    // primeira recarga: crediti em dobro (até o teto) — mostra quanto vem de presente em cada pacote
    const pr = p.prima_ricarica ? this.cfg?.prima_ricarica : null, regalo = x => (pr ? Math.min(pr.max ?? Infinity, Math.round(x.crediti * pr.bonus / 100)) : 0);
    const banner = pr ? `<div class="ct-prima">🎁 <b>Prima ricarica: crediti DOPPI</b><small>Solo la prima volta · fino a +${n(pr.max)} 💰 in regalo</small></div>` : '';
    const pacchi = p.ricarica ? `<h3 class="ct-h" id="ct-ricarica">💳 Ricarica crediti</h3>${banner}<div class="ct-pacchi">${(this.cfg?.pacchi ?? []).filter(x => x.checkout).map(x => `<button data-ct="ricarica" data-pacco="${x.id}">${x.etichetta ? `<i>${esc(x.etichetta)}</i>` : ''}<b>${n(x.crediti)} 💰</b>${regalo(x) ? `<em class="dono">+${n(regalo(x))} 🎁</em>` : ''}<span>${String(x.prezzo).replace('.', ',')} €</span>${x.bonus ? `<small>+${x.bonus}%</small>` : ''}</button>`).join('')}</div>` : '';
    const mov = (p.ultimi ?? []).map(m => `<li><span>${TIPI[m.tipo] ?? (TIPI[String(m.tipo).replace('prova_', '')] ? `🛠️ ${TIPI[m.tipo.replace('prova_', '')]}` : esc(m.tipo))}</span><small>${new Date(m.em).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' })}</small><b class="${m.delta < 0 ? 'neg' : ''}">${m.delta > 0 ? '+' : ''}${n(m.delta)}</b></li>`).join('');
    return `<h2>💰 Il tuo account</h2><div class="sub">${esc(p.email)}</div>
      <div class="ct-saldo"><b>${n(p.saldo)}</b><span>💰 crediti</span></div>
      ${premio}${ig}
      <div class="ms-card"><span class="ms-ic">🧍</span><div class="ms-tx"><b>Il tuo personaggio</b><small>${p.pg ? 'Cambia look quando vuoi: è gratis' : 'Crealo: è lui che passeggia per le città'}</small></div><button data-ct="personaggio">${p.pg ? 'Modifica' : 'Crea'}</button></div>
      ${pacchi}
      <h3 class="ct-h">🛍️ Negozio</h3><p class="ct-mini">Quello che compri è tuo per sempre. 100 💰 = 1 €. Vestiti e accessori: nel tuo personaggio.</p>
      <div class="ct-cat">${cat}</div>
      ${pac ? `<h3 class="ct-h">📦 Pacchetti di mobili</h3><div class="ct-cat">${pac}</div>` : ''}
      ${mov ? `<h3 class="ct-h">📒 Movimenti</h3><ul class="ct-mov">${mov}</ul>` : ''}
      <div class="ct-sicuro">🔒 Ti mandiamo un’email a ogni nuovo accesso e una ricevuta per ogni ricarica o acquisto.</div>
      <div class="bottoni"><button class="sec" data-ct="esci">Esci</button><button class="sec" data-ct="esci_tutti">🔒 Esci da tutti i dispositivi</button></div>
      <p class="nota">I crediti non si possono comprare punti, voti o cariche. <a href="termini.html" class="link">Regole dei crediti</a></p>`;
  }

  // castelo da região da casa do @: { regione, chi } (chi = dono, se já for de outra pessoa)
  castelloMio() {
    const c = this.D.porConta.get(this.p?.conta); if (!c) return null;
    const r = this.D.luoghi[c.luogo].regione, x = this.ui.decori?.prop?.castelli?.[r.cod];
    return { regione: r.nome.split('/')[0], chi: x?.conta && x.conta !== this.p.conta ? x.conta : null };
  }
  // abre a conta já na parte da recarga (pílula do mapa, "ti mancano N 💰")
  apriRicarica(msg = '', da = 'altro') {
    this._da = da; this.traccia('apre', '', da);
    if (!this.p) { this.ui.aviso(msg || '💰 Entra nel tuo account per ricaricare i crediti.'); this.apri(); return; }
    this.apri();
    setTimeout(() => $('#ct-ricarica')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 120);
    if (msg) this.ui.aviso(msg);
  }
  // contador do funil da recarga (api/conto.php "traccia"): nunca atrapalha o jogo se falhar
  traccia(ev, pacco = '', da = '') {
    try { fetch('api/conto.php', { method: 'POST', credentials: 'same-origin', keepalive: true, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ a: 'traccia', ev, pacco, da }) }).catch(() => {}); } catch { /* sem rede */ }
  }
  // compra com créditos (todas as lojas passam por aqui): confirma, compra e, se faltar saldo, oferece a recarga. true = comprou
  async compra(item, nome, prezzo, dopo = '') {
    if (!this.p) { this.ui.aviso('Entra nel tuo account per comprare.'); this.apri(); return false; }
    const manca = prezzo - (this.p.saldo ?? 0);
    if (manca > 0) {
      if (this.p.ricarica && confirm(`${nome} costa ${n(prezzo)} 💰: ti mancano ${n(manca)} 💰.\n\nVuoi ricaricare i crediti?`)) this.apriRicarica('', `manca_${String(item).slice(0, 8)}`);
      else if (!this.p.ricarica) this.ui.aviso(`Ti mancano ${n(manca)} 💰 per ${nome}.`);
      return false;
    }
    if (!confirm(`Comprare ${nome} per ${n(prezzo)} 💰?${dopo ? `\n${dopo}` : ''}\n\nTi restano ${n(-manca)} 💰.`)) return false;
    try {
      this.p = (await this.api('compra', { item })).profilo;
      this.desenharBotao();
      this.ui.aviso(`🎉 ${nome}: è tuo!`);
      if (item === 'villa' || item === 'castello') await this.ui.decori?.ricaricaProprieta();
      return true;
    } catch (e) { this.ui.aviso(e.message); return false; }
  }

  // ---------- ações (ui.js delega os cliques com data-ct) ----------
  async azione(t) {
    const a = t.dataset.ct;
    try {
      if (a === 'codice') {
        const e = ($('#ct-email')?.value ?? this.email).trim();
        if (!e) return this.ui.aviso('Scrivi la tua email.');
        if (this.passo === 'codice' && this._attesa && Date.now() < this._attesa) return this.ui.aviso(`⏳ Aspetta ancora ${Math.ceil((this._attesa - Date.now()) / 1000)} secondi e guarda anche nello spam.`);
        this.email = e;
        const j = await this.api('codice', { email: e });
        this.passo = 'codice';
        this._attesa = Date.now() + 60000;
        this.apri();
        if (j.dev_codice) { $('#ct-cod').value = j.dev_codice; console.log('codice di prova', j.dev_codice); }
        else this.ui.aviso(j.gia ? '📩 Ti abbiamo appena mandato il codice: aspetta un minuto e guarda anche nello spam.' : '📩 Codice inviato! Guarda anche nello spam.');
        // conta 60 s no botão "Mandamelo di nuovo"
        clearInterval(this._timer);
        this._timer = setInterval(() => {
          const b = $('#ct-rimanda'), s = Math.ceil((this._attesa - Date.now()) / 1000);
          if (!b) return clearInterval(this._timer);
          if (s > 0) { b.disabled = true; b.textContent = `Mandamelo di nuovo (${s})`; } else { b.disabled = false; b.textContent = 'Mandamelo di nuovo'; clearInterval(this._timer); }
        }, 1000);
      } else if (a === 'indietro') { this.passo = 'email'; this.apri(); }
      else if (a === 'entra') {
        const c = ($('#ct-cod')?.value ?? '').replace(/\D/g, '');
        if (c.length !== 6) return this.ui.aviso('Il codice ha 6 cifre.');
        if (this._entrando) return; this._entrando = true;
        try { const j = await this.api('entra', { email: this.email, codice: c }); this.p = j.profilo; this.passo = 'email'; } finally { this._entrando = false; }
        this.ui.aviso(this.p.saldo ? `Bentornato! 💰 ${n(this.p.saldo)}` : 'Benvenuto! 🎉');
        await this.depoisDeEntrar(true);
      } else if (a === 'io') { this.p = (await this.api('io')).profilo; await this.depoisDeEntrar(true); if (!this.p?.conta) this.ui.aviso('Non ancora: il robot controlla i commenti ogni mezz’ora circa.'); }
      else if (a === 'collega') {
        const c = ($('#ct-conta')?.value ?? '').trim().replace(/^@/, '').toLowerCase();
        if (!c) return this.ui.aviso('Scrivi il tuo nome Instagram.');
        this.p = (await this.api('collega', { conta: c })).profilo;
        await this.depoisDeEntrar(true);
      } else if (a === 'scollega') { this.p = (await this.api('scollega')).profilo; this.apri(); }
      else if (a === 'copia') {
        try { await navigator.clipboard.writeText(this.p.attesa.codice); this.ui.aviso('Codice copiato!'); } catch { this.ui.aviso(this.p.attesa.codice); }
        setTimeout(() => { location.href = `https://www.instagram.com/${PERFIL}/`; }, 900);
      } else if (a === 'premio') await this.premio(false);
      else if (a === 'personaggio') this.editor.apri();
      else if (a === 'accedi') this.apri();
      else if (a === 'prova' && this.p?.proprietario) {
        this.p = (await this.api('collega', { conta: t.dataset.v })).profilo;
        this.desenharBotao();
        await this.ui.decori?.ricaricaProprieta();
        const c = this.D.porConta.get(this.p.conta);
        if (c) this.ui.casa(c, false);
        this.ui.aviso(`🛠️ Ora provi la casa di @${this.p.conta}`);
      }
      else if (a === 'miacasa') { const c = this.D.porConta.get(this.p?.conta); if (c) this.ui.interni?.apri(c.conta); }
      else if (a === 'compra') {
        const id = t.dataset.item, pac = id.startsWith('pac_') ? (this.cfg?.pacchetti ?? []).find(x => `pac_${x.id}` === id) : null;
        const x = pac ?? (this.cfg?.catalogo ?? []).find(i => i.id === id);
        if (!x) return;
        const DOPO = { villa: 'La tua casa sulla mappa diventa una villa con piscina, per sempre.', castello: 'La tua casa diventa il castello della tua regione, per sempre. Solo 1 per regione!',
          interni: 'Potrai arredarla e tutti potranno visitarla.' };
        const veic = x.velocita ? `Lo trovi nella passeggiata: ${String(x.velocita).replace('.', ',')}× più veloce e la strada per le città vicine.` : '';
        const nome = id === 'castello' && this.castelloMio() ? `il Castello della regione ${this.castelloMio().regione}` : x.nome;
        if (await this.compra(id, nome, x.prezzo, DOPO[id] ?? veic)) {
          this.apri();
          if (id === 'villa' || id === 'castello') { const c = this.D.porConta.get(this.p.conta); if (c) setTimeout(() => this.ui.casa(c), 600); }
        }
      }
      else if (a === 'ricarica') {
        const pacco = t.dataset.pacco, da = this._da ?? 'conto';
        this.traccia('pacco', pacco, da);
        // consenso para entrega imediata (art. 59 Codice del Consumo): sem ele não abre o pagamento
        if (!confirm('I crediti arrivano subito sul tuo account.\n\nProseguendo acconsenti all’esecuzione immediata e prendi atto che, ricevuti i crediti, perdi il diritto di recesso. In caso di rimborso i crediti vengono tolti.\n\nContinuare con il pagamento?')) { this.traccia('annulla', pacco, da); return; }
        const j = await this.api('ricarica', { pacco, da }); location.href = j.url;
      }
      else if (a === 'esci_tutti') {
        if (!confirm('Vuoi uscire dal tuo account su tutti i telefoni e computer? Per rientrare servirà un nuovo codice via email.')) return;
        await this.api('esci_tutti'); this.p = null; this.desenharBotao(); this.ui.fechar(); this.ui.aviso('🔒 Uscito da tutti i dispositivi.');
      } else if (a === 'esci') { await this.api('esci'); this.p = null; this.desenharBotao(); this.ui.fechar(); this.ui.aviso('Sei uscito dal tuo account.'); }
    } catch (e) { this.ui.aviso(e.message); }
  }
}
