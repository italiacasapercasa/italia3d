// Giochi del sito (aba 🎮 Giochi). Fase 1: "Indovina del giorno": 3 indizi, uma tentativa por dia, o comune na lista.
// O servidor (api/missioni.php) guarda a resposta e mede o tempo; aqui só se mostra. Pontos: motore.mjs (regole.missioni).
// Quem joga: o @ digitado (precisa ter casa). Para os pontos contarem, o celular é vinculado comentando o código
// CASA-1234 num post (uma vez por celular); até lá as partidas ficam "in attesa" e contam depois, retroativamente.
import { REGOLE, num, ora } from './regole.js';
import { PERFIL } from './storie.js';

const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const norm = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9 ']/g, ' ').replace(/\s+/g, ' ').trim();
const ler = k => { try { return localStorage.getItem(k); } catch { return null; } };
const gravar = (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch { /* sem storage */ } };
const tempo = ms => { const s = Math.max(0, Math.round(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
const SITO = 'https://italiacasapercasa.com';
const NOVITA = 'giochi-v1';

export class Missioni {
  constructor(D, ui) {
    this.D = D; this.ui = ui;
    this.cfg = REGOLE.missioni;
    this.ms = D.snap.missioni ?? { classifica: [], serie: {}, campione: null, giocatori: 0 };
    let dev = ler('ms_dev');
    if (!/^[a-f0-9]{32}$/.test(dev ?? '')) {
      dev = [...crypto.getRandomValues(new Uint8Array(16))].map(b => b.toString(16).padStart(2, '0')).join('');
      gravar('ms_dev', dev);
    }
    this.dev = dev;
    const c = ler('ms_conta') || ui.minha;
    this.conta = c && D.porConta.has(c) ? c : null;
    this.stato = null;            // última resposta de "stato" (código, vínculo, partida de hoje)
    this.tela = null;             // 'home' | 'gioco' | 'esito'
    this.idxComuni = D.comuni.map(c => [norm(c.nome), c]).sort((a, b) => b[1].pop - a[1].pop);
    // selo NOVITÀ na aba até a pessoa abrir uma vez
    const aba = $('#schede [data-aba="giochi"]');
    if (aba) { aba.hidden = !this.cfg?.attive; aba.classList.toggle('novita', ler('ms_vista') !== NOVITA); }
  }

  // ---------- servidor ----------
  async api(a, extra = {}) {
    let j = null;
    try {
      const r = await fetch('api/missioni.php', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ a, conta: this.conta, dev: this.dev, ...extra }) });
      j = await r.json();
    } catch { throw new Error('Connessione assente. Riprova tra un attimo.'); }
    if (!j?.ok) throw new Error(j?.erro || 'Qualcosa è andato storto. Riprova.');
    return j;
  }
  erroTela(e) {
    this.ui.abrir(`<h2>🎮 Giochi</h2><div class="ms-avviso">${esc(e.message)}</div><div class="bottoni"><button data-ms="home">↩ Torna ai giochi</button></div>`, 'giochi');
  }

  // ---------- painel da casa (ui.js) ----------
  badge(casa) {
    const out = [];
    if (casa.conta === this.ms.campione?.conta) out.push(`<span class="badge ms">🏆 Campione dei giochi · ${num(this.ms.campione.punti)} punti</span>`);
    const n = this.ms.serie?.[casa.conta] ?? 0, premi = (this.cfg?.serie ?? []).filter(([min]) => n >= min);
    if (premi.length) out.push(`<span class="badge ms">🎮 ${n} giorni di giochi di fila ${premi.map(p => p[2]).join('')}</span>`);
    return out.join('');
  }

  // ---------- telas ----------
  async home() {
    this.tela = 'home';
    this.pararRelogio();
    gravar('ms_vista', NOVITA);
    $('#schede [data-aba="giochi"]')?.classList.remove('novita');
    if (this.conta) {
      this.ui.abrir('<h2>🎮 Giochi</h2><p class="nota">Caricamento…</p>', 'giochi');
      try { this.stato = await this.api('stato'); } catch (e) { this.stato = null; this.erroStato = e.message; }
      if (this.tela !== 'home') return;
    }
    this.ui.abrir(this.htmlHome(), 'giochi');
    this.ligarChi();
  }

  htmlHome() {
    const c = this.cfg, s = this.stato, p = s?.partita;
    const premi = c.premi.map(x => `+${x}`).join('/');
    let quem;
    if (!this.conta) {
      quem = `<div class="ms-chi"><label for="ms-conta">Chi sei? Scrivi il tuo @ di Instagram</label>
        <div class="ms-campo"><span>@</span><input id="ms-conta" type="text" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="il_tuo_account"></div>
        <div id="ms-sug" class="ms-sug"></div></div>`;
    } else quem = `<div class="ms-io">Giochi come <b>@${esc(this.conta)}</b> · <button class="link" data-ms="cambia">cambia</button></div>`;
    let stato = '';
    if (this.conta && s) {
      if (s.avviso) stato += `<div class="ms-avviso">${esc(s.avviso)}</div>`;
      stato += s.vincolato
        ? `<div class="ms-ok">✔ Telefono collegato: i punti arrivano sulla casa di @${esc(this.conta)}</div>`
        : `<div class="ms-codice">⏳ <b>Per ricevere i punti</b> commenta <b class="cod">${esc(s.codice)}</b> sotto un post qualsiasi di @${PERFIL} (dal profilo di @${esc(this.conta)}). Basta una volta per telefono: anche le partite di oggi contano.
          <button data-ms="copia" data-v="${esc(s.codice)}">📋 Copia il codice e apri Instagram</button></div>`;
    } else if (this.conta && this.erroStato) stato = `<div class="ms-avviso">${esc(this.erroStato)}</div>`;
    const btn = !this.conta ? '<button disabled>Gioca</button>'
      : p?.fine ? `<button class="sec" data-ms="esito">${p.ok ? '✅' : '❌'} Fatto · vedi</button>`
      : p ? '<button data-ms="gioca">⏳ Continua</button>' : `<button data-ms="gioca"${s?.avviso ? ' disabled' : ''}>▶ Gioca</button>`;
    const n = this.conta ? this.ms.serie?.[this.conta] ?? 0 : 0;
    const prox = c.serie.find(([min]) => n < min);
    const serie = this.conta ? `<div class="ms-serie">🔥 Serie: <b>${n} ${n === 1 ? 'giorno' : 'giorni'}</b> di fila${prox ? ` · a ${prox[0]}: ${prox[2]} ${esc(prox[3])} sulla tua casa` : ' · hai tutti i premi! 🏅'}</div>` : '';
    const fim = Date.parse(this.D.snap.mandato.fine);
    const rk = this.ms.classifica ?? [];
    const lista = rk.slice(0, 10).map((r, i) => `<li class="${r.conta === this.conta ? 'io' : ''}" data-casa="${esc(r.conta)}"><span class="pos">${i < 3 ? ['🥇', '🥈', '🥉'][i] : `${i + 1}.`}</span><span class="chi">@${esc(r.conta)}</span><b>${num(r.p)}</b></li>`).join('');
    const mio = this.conta ? rk.findIndex(r => r.conta === this.conta) : -1;
    const camp = this.ms.campione;
    return `<h2>🎮 Giochi</h2>
      <div class="sub">Gioca ogni giorno e fai crescere la tua casa</div>
      ${quem}
      <div class="ms-card"><span class="ms-ic">🗺️</span><div class="ms-tx"><b>Indovina del giorno</b><small>${s?.numero ? `#${s.numero} · ` : ''}3 indizi · 1 tentativo al giorno · +${REGOLE.punti.missione} punti se indovini</small></div>${btn}</div>
      ${stato}${serie}
      <h3>🏆 Classifica della settimana</h3>
      <p class="nota">Chiude ${ora(fim) === '21:00' ? 'domenica alle 21' : `il ${new Date(fim).toLocaleDateString('it-IT', { timeZone: 'Europe/Rome', day: 'numeric', month: 'long' })}`} · top 3: ${premi} punti alla casa, il 1° diventa <b>Campione dei giochi</b> per una settimana.</p>
      ${lista ? `<ol class="ms-rank">${lista}</ol>` : '<p class="nota">Nessuno ancora questa settimana: sii il primo!</p>'}
      ${mio >= 10 ? `<p class="nota">Tu sei <b>#${mio + 1}</b> con ${num(rk[mio].p)} punti.</p>` : ''}
      ${camp ? `<p class="ms-camp" data-casa="${esc(camp.conta)}">🏆 Campione della settimana scorsa: <b>@${esc(camp.conta)}</b> (${num(camp.punti)} punti)</p>` : ''}
      <h3>Come funziona</h3>
      <ul class="ms-regole">
        <li>Ogni giorno un comune misterioso: leggi l'indizio e scegli il comune. Un solo tentativo!</li>
        <li>Meno indizi usi e più sei veloce, più punti fai in classifica (fino a 400).</li>
        <li>Se indovini: <b>+${REGOLE.punti.missione} punti</b> alla tua casa. Per le elezioni contano al massimo ${c.tetto_mandato} punti al giorno dai giochi.</li>
        <li>Gioca tutti i giorni: ${c.serie.map(([d, , em, nome]) => `${d} giorni = ${em} ${esc(nome)}`).join(', ')} sulla tua casa (finché non salti un giorno).</li>
        <li>I punti arrivano sulla mappa entro un'ora.</li>
      </ul>`;
  }

  // escolha do @: só contas com casa
  ligarChi() {
    const q = $('#ms-conta'), sug = $('#ms-sug');
    if (!q) return;
    const mostrar = () => {
      const t = q.value.trim().replace(/^@/, '').toLowerCase();
      if (t.length < 2) { sug.innerHTML = ''; return; }
      const exatos = this.D.casas.filter(c => c.conta.startsWith(t)).sort((a, b) => b.tot - a.tot).slice(0, 5);
      sug.innerHTML = exatos.length
        ? exatos.map(c => `<button data-ms="sono" data-v="${esc(c.conta)}">@${esc(c.conta)} <small>${esc(this.D.luoghi[c.luogo].nome)}</small></button>`).join('')
        : '<div class="vuoto">Nessuna casa con questo @. Commenta la tua città sotto un post per averla!</div>';
    };
    q.addEventListener('input', mostrar);
    setTimeout(() => q.focus(), 50);
  }

  async gioca() {
    try { const r = await this.api('inizia'); this.partita = r.partita; } catch (e) { return this.erroTela(e); }
    if (this.partita.fine) return this.esito();
    this.telaGioco();
  }

  telaGioco() {
    const p = this.partita;
    this.tela = 'gioco';
    this.ui.abrir(`<h2>🗺️ Indovina del giorno #${p.numero}</h2>
      <div class="ms-tempo">⏱ <span id="ms-tempo">${tempo(p.trascorsi)}</span></div>
      <ol class="ms-indizi">${p.indizi.map((t, i) => `<li><small>Indizio ${i + 1}</small>${esc(t)}</li>`).join('')}</ol>
      ${p.n < 3 ? '<button class="sec ms-altro" data-ms="indizio">💡 Un altro indizio <small>(−100 punti)</small></button>' : ''}
      <div class="ms-risp">
        <div class="ms-campo"><span>📍</span><input id="ms-comune" type="text" autocomplete="off" spellcheck="false" placeholder="Scrivi il nome del comune…"></div>
        <div id="ms-com-sug" class="ms-sug"></div>
      </div>
      <button id="ms-invia" class="ms-invia" data-ms="rispondi" disabled>Rispondi</button>
      <p class="nota">Un solo tentativo: scegli bene! Il tempo conta per la classifica.</p>`, 'giochi');
    const q = $('#ms-comune'), sug = $('#ms-com-sug'), invia = $('#ms-invia');
    this.scelto = null;
    q.addEventListener('input', () => {
      this.scelto = null; invia.disabled = true; invia.textContent = 'Rispondi';
      const t = norm(q.value);
      if (t.length < 2) { sug.innerHTML = ''; return; }
      const ini = [], meio = [];
      for (const [k, c] of this.idxComuni) {
        if (k.startsWith(t)) ini.push(c); else if (meio.length < 6 && k.includes(t)) meio.push(c);
        if (ini.length >= 6) break;
      }
      const lista = [...ini, ...meio].slice(0, 6);
      sug.innerHTML = lista.length ? lista.map(c => `<button data-ms="comune" data-v="${c.istat}">${esc(c.nome)} <small>${esc(c.sigla)} · ${esc(this.D.regPorCod.get(c.reg)?.nome ?? '')}</small></button>`).join('') : '<div class="vuoto">Nessun comune con questo nome.</div>';
    });
    setTimeout(() => q.focus(), 50);
    this.ligarRelogio(p.trascorsi);
  }
  ligarRelogio(base) {
    this.pararRelogio();
    const t0 = Date.now() - base;
    this._rel = setInterval(() => { const e = $('#ms-tempo'); if (!e || this.tela !== 'gioco') return this.pararRelogio(); e.textContent = tempo(Date.now() - t0); }, 500);
  }
  pararRelogio() { clearInterval(this._rel); this._rel = null; }

  esito() {
    const p = this.partita, c = this.D.comunePorIstat.get(p.risposta), t = this.D.comunePorIstat.get(p.tentativo);
    this.tela = 'esito';
    this.pararRelogio();
    const s = this.stato;
    const punti = !p.ok ? '' : s?.vincolato
      ? `<div class="ms-ok">⭐ <b>+${REGOLE.punti.missione} punti</b> alla casa di @${esc(this.conta)}: arrivano sulla mappa entro un'ora.</div>`
      : `<div class="ms-codice">⭐ <b>+${REGOLE.punti.missione} punti in attesa.</b> Per riceverli commenta <b class="cod">${esc(s?.codice ?? '')}</b> sotto un post di @${PERFIL}. Basta una volta per telefono.
          <button data-ms="copia" data-v="${esc(s?.codice ?? '')}">📋 Copia il codice e apri Instagram</button></div>`;
    const n = (this.ms.serie?.[this.conta] ?? 0);
    this.ui.abrir(`<h2>${p.ok ? '✅ Esatto!' : '❌ Peccato!'}</h2>
      <div class="ms-esito">Il comune era <b>${esc(c?.nome ?? '?')}</b>${c ? ` <small>(${esc(c.sigla)})</small>` : ''}${!p.ok && t ? `<br><small>Hai scelto ${esc(t.nome)}</small>` : ''}</div>
      <div class="ms-quadri">${this.quadri(p)}</div>
      <div class="ms-pt"><b>${num(p.punteggio)}</b> punti in classifica<small>⏱ ${tempo(p.ms)} · ${p.n} ${p.n === 1 ? 'indizio' : 'indizi'}</small></div>
      ${punti}
      <div class="bottoni">
        ${c ? `<button class="sec" data-ms="vedi" data-v="${c.istat}">📍 Vedi sulla mappa</button>` : ''}
        <button data-ms="condividi">📤 Sfida un amico</button>
      </div>
      <p class="nota">Domani un nuovo comune${n ? ` · 🔥 serie: ${n} ${n === 1 ? 'giorno' : 'giorni'}` : ''}. <button class="link" data-ms="home">Torna ai giochi</button></p>`, 'giochi');
  }
  // 🟨 indizio usado, 🟩 o que acertou, 🟥 errou, ⬛ não usado
  quadri(p) { return [0, 1, 2].map(i => (i >= p.n ? '⬛' : !p.ok ? '🟥' : i === p.n - 1 ? '🟩' : '🟨')).join(''); }

  async condividi() {
    const p = this.partita;
    const txt = `🗺️ Indovina del giorno #${p.numero}\n${p.ok ? `✅ in ${tempo(p.ms)}` : '❌'} ${this.quadri(p)}\nRiesci a fare meglio? 👇`;
    const url = `${SITO}/?da=gioco#giochi`;
    try {
      if (navigator.share) { await navigator.share({ text: txt, url }); return; }
    } catch (e) { if (e?.name === 'AbortError') return; }
    try { await navigator.clipboard.writeText(`${txt}\n${url}`); this.ui.aviso('Copiato! Incollalo dove vuoi.'); } catch { this.ui.aviso(url); }
  }

  // ---------- ações (botões data-ms dentro do painel, delegados pelo ui.js) ----------
  async azione(t) {
    const d = t.dataset, v = d.v;
    if (d.ms === 'home') return this.home();
    if (d.ms === 'sono') { this.conta = v; gravar('ms_conta', v); this.stato = null; this.erroStato = null; return this.home(); }
    if (d.ms === 'cambia') { this.conta = null; gravar('ms_conta', null); this.stato = null; return this.home(); }
    if (d.ms === 'gioca') { t.disabled = true; return this.gioca(); }
    if (d.ms === 'esito') { this.partita = this.stato?.partita; return this.partita ? this.esito() : this.home(); }
    if (d.ms === 'indizio') {
      t.disabled = true;
      try { this.partita = (await this.api('indizio')).partita; } catch (e) { return this.erroTela(e); }
      const val = $('#ms-comune')?.value ?? '';
      this.telaGioco();
      if (val) { const q = $('#ms-comune'); q.value = val; q.dispatchEvent(new Event('input')); }
      return;
    }
    if (d.ms === 'comune') {
      const c = this.D.comunePorIstat.get(v);
      if (!c) return;
      this.scelto = v;
      $('#ms-comune').value = c.nome;
      $('#ms-com-sug').innerHTML = '';
      const b = $('#ms-invia'); b.disabled = false; b.textContent = `Rispondi: ${c.nome}`;
      return;
    }
    if (d.ms === 'rispondi') {
      if (!this.scelto) return;
      t.disabled = true; t.textContent = '…';
      try { this.partita = (await this.api('rispondi', { istat: this.scelto })).partita; } catch (e) { return this.erroTela(e); }
      if (this.stato) this.stato.partita = this.partita;
      this.esito();
      return;
    }
    if (d.ms === 'vedi') {
      const c = this.D.comunePorIstat.get(v);
      if (c) { this.ui.focar(c.x, c.z, c.luogo ? 1.4 : 2.2, 0.55); this.ui.painel.classList.add('mini'); }
      return;
    }
    if (d.ms === 'condividi') return this.condividi();
    if (d.ms === 'copia') {
      try { await navigator.clipboard.writeText(v); } catch { /* sem permissão: a pessoa copia à mão */ }
      this.ui.aviso(`Copiato ${v}: incollalo in un commento`);
      setTimeout(() => { location.href = `https://www.instagram.com/${PERFIL}/`; }, 900);
    }
  }
}
