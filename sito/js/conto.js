// Conta do site (botão no topo à esquerda): entrar com e-mail + código (sem senha), ligar o Instagram com o código
// CASA-1234, crediti 💰 do dia (pegos sozinhos ao abrir o site) e vitrine do que vai estar à venda.
// Servidor: api/conto.php (sessão por cookie httpOnly). Preços e pacotes: data/crediti.json.
import { PERFIL } from './storie.js';

const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const n = v => Number(v).toLocaleString('it-IT');
const ler = k => { try { return localStorage.getItem(k); } catch { return null; } };
const gravar = (k, v) => { try { localStorage.setItem(k, v); } catch { /* sem storage */ } };
const NOVITA = 'conto-v1';
const TIPI = { giornaliero: '🎁 Crediti del giorno', serie: '🔥 Bonus giorni di fila', ricarica: '💳 Ricarica', rimborso: '↩️ Rimborso', regalo: '🎁 Regalo', acquisto: '🛍️ Acquisto' };

export class Conto {
  constructor(D, ui) {
    this.D = D; this.ui = ui;
    this.p = null;              // perfil (null = fora)
    this.cfg = null;            // data/crediti.json
    this.email = '';            // e-mail digitado (passo do código)
    this.passo = 'email';
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
    const vantaggi = `<div class="ct-vantaggi"><div>💰 <b>Crediti gratis</b> ogni giorno che entri</div><div>🔥 <b>Bonus</b> se entri tutti i giorni (+20 al 7° giorno, +100 al 30°)</div><div>🚶 <b>Passeggia</b> per le strade della tua città</div><div>🔑 Presto: <b>entra nella tua casa</b> e arredala</div></div>`;
    if (this.passo === 'codice') return `<h2>📩 Controlla l’email</h2>
      <div class="sub">Abbiamo mandato un codice di 6 cifre a <b>${esc(this.email)}</b></div>
      <div class="ms-campo ct-cod"><input id="ct-cod" inputmode="numeric" autocomplete="one-time-code" maxlength="7" placeholder="123456" aria-label="Codice"></div>
      <div class="bottoni"><button data-ct="entra">✅ Entra</button><button class="sec" data-ct="indietro">✏️ Cambia email</button></div>
      <p class="nota">Non arriva? Guarda nella cartella spam o promozioni. <button class="ct-link" data-ct="codice">Mandamelo di nuovo</button></p>`;
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
    if (!p.conta) premio = '';
    else if (p.premio_oggi) premio = `<div class="ms-serie">✅ Crediti di oggi presi · 🔥 <b>${p.serie} ${p.serie === 1 ? 'giorno' : 'giorni di fila'}</b>${prox ? `<br><small>Torna domani: al ${prox.giorno}° giorno di fila ricevi <b>+${prox.extra} 💰</b> in più.</small>` : ''}</div>`;
    else premio = `<div class="ms-card"><span class="ms-ic">🎁</span><div class="ms-tx"><b>Crediti di oggi</b><small>+${g.base} 💰 ogni giorno che entri</small></div><button data-ct="premio">Prendi</button></div>`;
    let ig;
    if (p.conta) ig = `<div class="ms-ok">📸 Instagram collegato: <b>@${esc(p.conta)}</b></div>`;
    else if (p.attesa) ig = `<div class="ms-codice">📸 Per collegare <b>@${esc(p.attesa.conta)}</b> commenta questo codice sotto un nostro post su Instagram:<br>
        <span class="cod">${esc(p.attesa.codice)}</span><br><small>Entro circa 30 minuti il tuo account si collega da solo e ricevi i crediti del giorno.</small>
        <button data-ct="copia">📋 Copia il codice e apri Instagram</button></div>
        <div class="bottoni"><button class="sec" data-ct="io">🔄 Controlla</button><button class="sec" data-ct="scollega">✏️ Cambia @</button></div>`;
    else ig = `<div class="ms-chi"><label for="ct-conta">📸 Collega il tuo Instagram per ricevere i crediti ogni giorno</label>
        <div class="ms-campo"><span>@</span><input id="ct-conta" autocomplete="off" autocapitalize="none" spellcheck="false" placeholder="il_tuo_nome" value="${esc(this.ui.minha ?? '')}"></div>
        <div class="bottoni"><button data-ct="collega">Collega</button></div><small class="ct-mini">Serve una casa sulla mappa con quel nome.</small></div>`;
    const cat = (this.cfg?.catalogo ?? []).map(x => `<div class="ct-item"><span>${x.icona}</span><b>${esc(x.nome)}</b><em>${n(x.prezzo)} 💰</em>${x.nota ? `<small>${esc(x.nota)}</small>` : ''}</div>`).join('');
    const pacchi = p.ricarica ? `<h3 class="ct-h">💳 Ricarica</h3><div class="ct-pacchi">${(this.cfg?.pacchi ?? []).filter(x => x.checkout).map(x => `<button data-ct="ricarica" data-pacco="${x.id}">${x.etichetta ? `<i>${esc(x.etichetta)}</i>` : ''}<b>${n(x.crediti)} 💰</b><span>${String(x.prezzo).replace('.', ',')} €</span>${x.bonus ? `<small>+${x.bonus}%</small>` : ''}</button>`).join('')}</div>` : '';
    const mov = (p.ultimi ?? []).map(m => `<li><span>${TIPI[m.tipo] ?? esc(m.tipo)}</span><small>${new Date(m.em).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' })}</small><b class="${m.delta < 0 ? 'neg' : ''}">${m.delta > 0 ? '+' : ''}${n(m.delta)}</b></li>`).join('');
    return `<h2>💰 Il tuo account</h2><div class="sub">${esc(p.email)}</div>
      <div class="ct-saldo"><b>${n(p.saldo)}</b><span>💰 crediti</span></div>
      ${premio}${ig}${pacchi}
      <h3 class="ct-h">🛍️ Presto nel negozio</h3><p class="ct-mini">Metti da parte i crediti: le prime cose arrivano presto. 100 💰 = 1 €.</p>
      <div class="ct-cat">${cat}</div>
      ${mov ? `<h3 class="ct-h">📒 Movimenti</h3><ul class="ct-mov">${mov}</ul>` : ''}
      <div class="ct-sicuro">🔒 Ti mandiamo un’email a ogni nuovo accesso e una ricevuta per ogni ricarica o acquisto.</div>
      <div class="bottoni"><button class="sec" data-ct="esci">Esci</button><button class="sec" data-ct="esci_tutti">🔒 Esci da tutti i dispositivi</button></div>
      <p class="nota">I crediti non si possono comprare punti, voti o cariche. <a href="termini.html" class="link">Regole dei crediti</a></p>`;
  }

  // ---------- ações (ui.js delega os cliques com data-ct) ----------
  async azione(t) {
    const a = t.dataset.ct;
    try {
      if (a === 'codice') {
        const e = ($('#ct-email')?.value ?? this.email).trim();
        if (!e) return this.ui.aviso('Scrivi la tua email.');
        this.email = e;
        const j = await this.api('codice', { email: e });
        this.passo = 'codice';
        this.apri();
        if (j.dev_codice) { $('#ct-cod').value = j.dev_codice; console.log('codice di prova', j.dev_codice); }
        else this.ui.aviso('📩 Codice inviato!');
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
      else if (a === 'ricarica') { const j = await this.api('ricarica', { pacco: t.dataset.pacco }); location.href = j.url; }
      else if (a === 'esci_tutti') {
        if (!confirm('Vuoi uscire dal tuo account su tutti i telefoni e computer? Per rientrare servirà un nuovo codice via email.')) return;
        await this.api('esci_tutti'); this.p = null; this.desenharBotao(); this.ui.fechar(); this.ui.aviso('🔒 Uscito da tutti i dispositivi.');
      } else if (a === 'esci') { await this.api('esci'); this.p = null; this.desenharBotao(); this.ui.fechar(); this.ui.aviso('Sei uscito dal tuo account.'); }
    } catch (e) { this.ui.aviso(e.message); }
  }
}
