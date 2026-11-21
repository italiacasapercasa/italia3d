// Giochi fase 2: "Torre di Pisa" (habilidade). O andar balança em cima da torre; toque para soltar: o que sobra para fora cai.
// Erra tudo = fim. A torre de verdade tem 8 andares: quem passa de 8 "batte la Torre" e ganha +punti (motore.mjs, igual ao Indovina).
// A 1ª partida do dia vale (api/missioni.php pisa_inizia/pisa_fine mede o tempo e limita os andares possíveis); depois é treino.
import { REGOLE, num } from './regole.js';
import { PERFIL } from './storie.js';

const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const W = 360, HH = 440, BH = 34, LARG = 200, SITO = 'https://italiacasapercasa.com';
export const PISA_PIANI = 8;   // andares da torre de verdade

export class GiocoPisa {
  constructor(ui, ms) { this.ui = ui; this.ms = ms; }

  // ---------- telas ----------
  async apri(treino = false) {
    this.treino = treino;
    if (!treino) {
      try { const r = await this.ms.api('pisa_inizia'); this.stato = r.pisa; } catch (e) { return this.ms.erroTela(e); }
      if (this.stato?.fine) return this.esito(this.stato);
    }
    this.ui.abrir(`<h2>🏛️ Torre di Pisa${treino ? ' · allenamento' : ''}</h2>
      <div class="pi-info"><span>🧱 <b id="pi-n">0</b> piani</span><span>📐 Pendenza <b id="pi-p">0,0°</b></span></div>
      <div class="pi-tela"><canvas width="${W}" height="${HH}"></canvas><div class="pi-msg">👆 Tocca per far cadere il piano</div></div>
      <p class="nota">${treino ? 'Allenamento: non vale punti.' : `La vera Torre ha <b>${PISA_PIANI} piani</b>: superala e ricevi <b>+${REGOLE.punti.missione} punti</b>. Solo la prima partita di oggi vale!`}</p>`, 'giochi');
    this.cv = this.ui.conteudo.querySelector('canvas');
    this.ctx = this.cv.getContext('2d');
    setTimeout(() => this.cv?.parentElement.scrollIntoView({ block: 'center', behavior: 'smooth' }), 80);
    this.nuova();
    const tocca = e => { e.preventDefault(); e.stopPropagation(); this.lascia(); };
    this.cv.addEventListener('pointerdown', tocca);
    this._tasto = e => { if (e.code === 'Space' && this.cv?.isConnected) { e.preventDefault(); this.lascia(); } };
    addEventListener('keydown', this._tasto);
    cancelAnimationFrame(this._raf);
    this._t = performance.now();
    const loop = t => { if (!this.cv?.isConnected) { removeEventListener('keydown', this._tasto); return; } this.passo(Math.min(0.05, (t - this._t) / 1000)); this._t = t; this.disegna(); this._raf = requestAnimationFrame(loop); };
    this._raf = requestAnimationFrame(loop);
  }
  nuova() {
    this.pila = [{ x: (W - LARG - 30) / 2, w: LARG + 30, base: true }];   // basamento
    this.cadute = []; this.fine = false; this.cam = 0; this.perfetti = 0; this.flash = 0;
    this.prossimo();
  }
  prossimo() {
    const n = this.pila.length - 1, top = this.pila[this.pila.length - 1];
    const w = top.base ? LARG : top.w;
    this.mob = { x: n % 2 ? W - w : 0, w, dir: n % 2 ? -1 : 1, v: 120 + Math.min(260, n * 14) };
  }
  passo(dt) {
    if (!this.fine && this.mob) {
      const m = this.mob; m.x += m.dir * m.v * dt;
      if (m.x < -m.w * 0.35) { m.x = -m.w * 0.35; m.dir = 1; } if (m.x > W - m.w * 0.65) { m.x = W - m.w * 0.65; m.dir = -1; }
    }
    for (const c of this.cadute) { c.vy += 900 * dt; c.y += c.vy * dt; c.r += c.vr * dt; }
    this.cadute = this.cadute.filter(c => c.y < HH + 200);
    const alvo = Math.max(0, this.pila.length * BH - HH * 0.55);
    this.cam += (alvo - this.cam) * Math.min(1, dt * 6);
    this.flash = Math.max(0, this.flash - dt * 2.5);
  }
  lascia() {
    if (this.fine) return;
    const m = this.mob, top = this.pila[this.pila.length - 1], tx = top.base ? (W - LARG) / 2 : top.x, tw = top.base ? LARG : top.w;
    const yLiv = this.pila.length;
    let l = Math.max(m.x, tx), r = Math.min(m.x + m.w, tx + tw);
    if (r - l <= 2) {   // errou tudo
      this.cadute.push({ x: m.x, w: m.w, y: this.yDi(yLiv), vy: 0, r: 0, vr: m.dir * 2 });
      this.mob = null; return this.termina();
    }
    if (Math.abs(m.x - tx) < 5 && !top.base) { l = tx; r = tx + tw; this.perfetti++; this.flash = 1; this.msg('✨ Perfetto!'); }
    else {
      const resto = m.x < l ? { x: m.x, w: l - m.x } : { x: r, w: m.x + m.w - r };
      if (resto.w > 0.5) this.cadute.push({ ...resto, y: this.yDi(yLiv), vy: 0, r: 0, vr: (resto.x < l ? -1 : 1) * 2.5 });
      this.msg('');
    }
    this.pila.push({ x: l, w: r - l });
    navigator.vibrate?.(12);
    const n = this.pila.length - 1;
    this.ui.conteudo.querySelector('#pi-n').textContent = n;
    this.ui.conteudo.querySelector('#pi-p').textContent = `${this.pendenza().toFixed(1).replace('.', ',')}°`;
    if (n === PISA_PIANI) this.msg(`🏆 Hai battuto la Torre di Pisa! Continua…`);
    if (n >= 80) return this.termina();
    this.prossimo();
  }
  pendenza() {
    const b = this.pila[0], t = this.pila[this.pila.length - 1], h = (this.pila.length - 1) * BH;
    return h ? Math.abs(Math.atan2((t.x + t.w / 2) - (b.x + b.w / 2), h) * 180 / Math.PI) : 0;
  }
  msg(t) { const e = this.ui.conteudo.querySelector('.pi-msg'); if (e) { e.textContent = t; e.style.opacity = t ? '1' : '0'; } }
  yDi(liv) { return HH - 40 - (liv + 1) * BH + this.cam; }

  disegna() {
    const c = this.ctx;
    const g = c.createLinearGradient(0, 0, 0, HH); g.addColorStop(0, '#8EC5E8'); g.addColorStop(1, '#DDF0FA'); c.fillStyle = g; c.fillRect(0, 0, W, HH);
    c.fillStyle = '#7FB55C'; c.fillRect(0, HH - 40 + this.cam, W, 400);
    c.fillStyle = '#E9DDC1'; c.fillRect(0, HH - 40 + this.cam, W, 8);
    this.pila.forEach((p, i) => this.piano(p.x, this.yDi(i), p.w, i === 0, i === this.pila.length - 1 && this.flash));
    if (this.mob) this.piano(this.mob.x, this.yDi(this.pila.length), this.mob.w, false, 0, true);
    for (const k of this.cadute) { c.save(); c.translate(k.x + k.w / 2, k.y + BH / 2); c.rotate(k.r); this.piano(-k.w / 2, -BH / 2, k.w, false, 0); c.restore(); }
    // linha da altura da torre de verdade
    const y8 = this.yDi(PISA_PIANI) + BH;
    if (y8 > -10 && y8 < HH) { c.setLineDash([6, 6]); c.strokeStyle = '#E0473C'; c.lineWidth = 2; c.beginPath(); c.moveTo(0, y8); c.lineTo(W, y8); c.stroke(); c.setLineDash([]); c.fillStyle = '#E0473C'; c.font = '900 12px Nunito, sans-serif'; c.fillText('🏛️ la vera Torre: 8 piani', 8, y8 - 6); }
  }
  piano(x, y, w, base, flash, mobile = false) {
    const c = this.ctx;
    c.fillStyle = flash ? '#FFF3C4' : base ? '#E7DCC6' : '#F6F1E6'; c.fillRect(x, y, w, BH);
    c.strokeStyle = '#B9A98A'; c.lineWidth = 2; c.strokeRect(x + 1, y + 1, w - 2, BH - 2);
    c.fillStyle = '#E3D7BF'; c.fillRect(x, y, w, 5); c.fillRect(x, y + BH - 5, w, 5);
    // archi del loggiato
    c.fillStyle = mobile ? '#9C8B70' : '#8C7B62';
    for (let ax = x + 9; ax + 12 <= x + w - 4; ax += 20) { c.beginPath(); c.moveTo(ax, y + BH - 6); c.lineTo(ax, y + 15); c.arc(ax + 6, y + 15, 6, Math.PI, 0); c.lineTo(ax + 12, y + BH - 6); c.fill(); }
  }

  // ---------- fim ----------
  async termina() {
    this.fine = true;
    const n = this.pila.length - 1;
    await new Promise(r => setTimeout(r, 900));
    if (this.treino) return this.esito({ piani: n, treino: true });
    try { const r = await this.ms.api('pisa_fine', { piani: n }); this.stato = r.pisa; this.esito(r.pisa); }
    catch (e) { this.ms.erroTela(e); }
  }
  esito(p) {
    const s = this.ms.stato, ok = p.piani >= PISA_PIANI, conta = this.ms.conta;
    this.ultimo = p;
    const punti = p.treino ? '' : !ok ? '' : s?.vincolato
      ? `<div class="ms-ok">⭐ <b>+${REGOLE.punti.missione} punti</b> alla casa di @${esc(conta)}: arrivano sulla mappa entro un'ora.</div>`
      : `<div class="ms-codice">⭐ <b>+${REGOLE.punti.missione} punti in attesa.</b> Per riceverli commenta <b class="cod">${esc(s?.codice ?? '')}</b> sotto un post di @${PERFIL}.</div>`;
    this.ui.abrir(`<h2>${ok ? '🏆 Hai battuto la Torre!' : '🧱 La torre è caduta!'}</h2>
      <div class="ms-esito"><b>${p.piani}</b> ${p.piani === 1 ? 'piano' : 'piani'}${ok ? ` · la vera Torre ne ha ${PISA_PIANI}` : ` · la vera Torre ne ha ${PISA_PIANI}: ci sei quasi!`}</div>
      ${p.treino ? '<p class="nota">Allenamento: non vale punti.</p>' : `<div class="ms-pt"><b>${num(p.punteggio ?? 0)}</b> punti in classifica<small>la prima partita di oggi</small></div>`}
      ${punti}
      <div class="bottoni"><button data-ms="pisa_treno">🔁 Allenati</button><button class="sec" data-ms="pisa_condividi">📤 Sfida un amico</button></div>
      <p class="nota">Domani una nuova partita che vale. <button class="link" data-ms="home">Torna ai giochi</button></p>`, 'giochi');
  }
  async condividi() {
    const p = this.ultimo ?? { piani: 0 };
    const txt = `🏛️ Torre di Pisa: ho costruito ${p.piani} piani${p.piani >= PISA_PIANI ? ' e ho battuto la Torre vera!' : ''}\nTu quanti ne fai? 👇`;
    const url = `${SITO}/?da=gioco#giochi`;
    try { if (navigator.share) { await navigator.share({ text: txt, url }); return; } } catch (e) { if (e?.name === 'AbortError') return; }
    try { await navigator.clipboard.writeText(`${txt}\n${url}`); this.ui.aviso('Copiato! Incollalo dove vuoi.'); } catch { this.ui.aviso(url); }
  }
}
