// Minimapa da passeggiata (estilo GTA): círculo no canto que gira com a câmera (frente = para cima).
// Toque nele abre o mapa grande (norte para cima): arrastar move, roda/pinça/＋− dá zoom, toque marca o destino 📍.
// O destino vira rota: pelas estradas entre cidades (strade.percorso) e reta no fim; linha roxa nos dois mapas
// e a bússola da passeggiata (passeggio.aggiornaMeta) aponta o caminho.
import { LOTE, RUA, QW, QH } from './citta.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const distTxt = d => (d < 1 ? `${Math.max(10, Math.round(d * 100) * 10)} m` : `${(d < 10 ? d.toFixed(1) : Math.round(d)).toString().replace('.', ',')} km`);
const COR = { erba: '#A9D18E', mare: '#7DB4D6', strada: '#9AA1AC', bordo: '#FFFFFF', via: '#E9E4D8', blocco: '#F4D9B0', piazza: '#FFF1C9', rotta: '#8E44FF', citta: '#E07A4F', neg: '#FF8A3D', mia: '#FFC93C' };

export class Minimappa {
  constructor(ps) {
    this.ps = ps; this.D = ps.D; this.mappa = ps.mappa; this.strade = ps.strade; this.citta = ps.citta;
    const el = ps.el;
    el.insertAdjacentHTML('beforeend', `
      <button type="button" class="ps-mini" aria-label="Apri la mappa"><canvas></canvas><b class="ps-mini-n">N</b></button>
      <div class="ps-mappa" hidden>
        <canvas></canvas>
        <div class="ps-mappa-topo"><b>🗺️ Mappa</b><span>Tocca un punto per segnare dove vuoi andare</span><button type="button" data-a="chiudi" aria-label="Chiudi la mappa">✕</button></div>
        <div class="ps-mappa-zoom"><button type="button" data-a="piu" aria-label="Avvicina">＋</button><button type="button" data-a="meno" aria-label="Allontana">−</button><button type="button" data-a="io" aria-label="Centra su di me">◎</button></div>
        <div class="ps-mappa-meta" hidden></div>
      </div>`);
    this.mini = el.querySelector('.ps-mini');
    this.cvMini = this.mini.querySelector('canvas');
    this.big = el.querySelector('.ps-mappa');
    this.cvBig = this.big.querySelector('canvas');
    this.mini.onclick = () => this.apri();
    this.big.querySelector('.ps-mappa-topo').onclick = e => { if (e.target.dataset.a === 'chiudi') this.chiudi(); };
    this.big.querySelector('.ps-mappa-zoom').onclick = e => {
      const a = e.target.dataset.a;
      if (a === 'piu') this.zoomEm(innerWidth / 2, innerHeight / 2, 1.6);
      if (a === 'meno') this.zoomEm(innerWidth / 2, innerHeight / 2, 1 / 1.6);
      if (a === 'io') { this.vista.x = ps.pos.x; this.vista.z = ps.pos.z; this.disegnaBig(); }
    };
    this.big.querySelector('.ps-mappa-meta').onclick = e => {
      const a = e.target.closest('button')?.dataset.a;
      if (a === 'via') { ps.annullaMeta(); this.disegnaBig(); this.barraMeta(); }
      if (a === 'vai') this.chiudi();
      if (a === 'auto') { const l = this.ps.meta?.cittaDest; this.chiudi(); if (l) ps.parti(l, true); }
    };
    this.ligarBig();
    this.vista = { x: 0, z: 0, s: 300 };   // s = pixels por km
    this.mar = new Map();                  // cache de "é mar?" por célula de 100 m
  }

  // ---------- desenho comum ----------
  // m = matriz mundo->tela: sx = ox + (a*x + b*z), sy = oy + (c*x + d*z) (já multiplicada pela escala)
  eMar(x, z) {
    const k = `${Math.round(x * 10)},${Math.round(z * 10)}`;
    let v = this.mar.get(k);
    if (v === undefined) {
      v = this.mappa.altura(x, z) < 0.002;
      if (this.mar.size > 60000) this.mar.clear();
      this.mar.set(k, v);
    }
    return v;
  }
  disegna(ctx, W, H, m, s, opz) {
    const inv = 1 / (m.a * m.d - m.b * m.c);
    const mundo = (sx, sy) => { const u = sx - m.ox, v = sy - m.oy; return [(m.d * u - m.b * v) * inv, (-m.c * u + m.a * v) * inv]; };
    const [cx, cz] = mundo(W / 2, H / 2), raio = Math.hypot(W, H) / 2 / s;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = COR.erba; ctx.fillRect(0, 0, W, H);
    // mar: amostra em grade de tela
    const passo = opz.passo, cache = s / opz.dpr < 150;   // de perto a célula de 100 m do cache ficaria quadrada demais
    ctx.fillStyle = COR.mare;
    for (let sy = 0; sy < H; sy += passo) for (let sx = 0; sx < W; sx += passo) {
      const [x, z] = mundo(sx + passo / 2, sy + passo / 2);
      if (cache ? this.eMar(x, z) : this.mappa.altura(x, z) < 0.002) ctx.fillRect(sx, sy, passo + 0.5, passo + 0.5);
    }
    ctx.setTransform(m.a, m.c, m.b, m.d, m.ox, m.oy);   // agora desenha em km
    const dpr = opz.dpr, ss = s / dpr;                   // ss = px de CSS por km (limiares iguais em qualquer tela)
    const px = p => p * dpr / s;                         // largura em px de CSS -> km
    const perto = this.strade.perto(cx, cz, raio + 3);
    const detalhe = ss > 25;                             // quadras visíveis (quadra ≥ ~6 px)
    // estradas entre cidades: as montadas (curvas reais) e, de longe, a ligação reta
    if (ss > 4) {
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      const feitas = new Set();
      const linha = (P, w, cor) => { ctx.beginPath(); ctx.moveTo(P[0].x, P[0].z); for (let i = 1; i < P.length; i += 2) ctx.lineTo(P[i].x, P[i].z); ctx.lineTo(P.at(-1).x, P.at(-1).z); ctx.lineWidth = w; ctx.strokeStyle = cor; ctx.stroke(); };
      for (const st of this.strade.vivas ?? []) { feitas.add(st.k); linha(st.P, Math.max(RUA * 0.84, px(4)) + px(2), COR.bordo); linha(st.P, Math.max(RUA * 0.84, px(4)), COR.strada); }
      if (perto.length < 400) {
        ctx.strokeStyle = COR.strada; ctx.lineWidth = px(opz.grande ? 3 : 4);
        ctx.beginPath();
        for (const [, l] of perto) for (const [, o] of this.strade.archi(l)) {
          if (o.id < l.id || feitas.has(this.strade.chave(l, o))) continue;
          ctx.moveTo(l.x, l.z); ctx.lineTo(o.x, o.z);
        }
        ctx.stroke();
      }
    }
    // cidades: quadras de perto, bolinha de longe
    const rotulos = [];
    for (const [, l] of perto) {
      if (detalhe && Math.hypot(l.x - cx, l.z - cz) < raio + 2) {
        this.citta.dadosCidade(l);
        for (const k of this.strade.cel(l)) {
          const [i, j] = k.split(',').map(Number), x = l.x + i * QW, z = l.z + j * QH;
          ctx.fillStyle = COR.via; ctx.fillRect(x - QW / 2, z - QH / 2, QW, QH);
          ctx.fillStyle = i === 0 && j === 0 ? COR.piazza : COR.blocco;
          ctx.fillRect(x - (QW - RUA) / 2, z - (QH - RUA) / 2, QW - RUA, QH - RUA);
        }
        if (ss > 120) {   // casas
          for (const ci of l.casas) { const c = this.D.casas[ci]; if (c.x == null) continue; ctx.fillStyle = c.conta === this.ps.ui.conto?.p?.conta ? COR.mia : '#E8B98A'; ctx.fillRect(c.x - LOTE * 0.36, c.z - LOTE * 0.36, LOTE * 0.72, LOTE * 0.72); }
        }
        for (const cm of l.commerci ?? []) if (cm.x != null) { ctx.fillStyle = COR.neg; ctx.beginPath(); ctx.arc(cm.x, cm.z, Math.max(LOTE * 0.4, px(3.5)), 0, 7); ctx.fill(); }
      } else {
        const r = Math.max(px(l.case > 50 ? 4.5 : 3), this.citta.raioCidade(l));
        ctx.fillStyle = COR.citta; ctx.beginPath(); ctx.arc(l.x, l.z, r, 0, 7); ctx.fill();
      }
      if (opz.grande) rotulos.push(l);
    }
    // minha casa (sempre visível como estrela)
    const mia = this.D.porConta.get(this.ps.ui.conto?.p?.conta);
    // rota até o destino (roxa, como no GTA) e o pino
    const meta = this.ps.meta;
    if (meta?.linea) {
      const L = meta.linea, p = this.ps.pos;
      let k = 0, bd = Infinity;
      for (let i = 0; i < L.length; i++) { const d = Math.abs(L[i][0] - p.x) + Math.abs(L[i][1] - p.z); if (d < bd) { bd = d; k = i; } }
      ctx.beginPath(); ctx.moveTo(p.x, p.z);
      for (let i = k + 1; i < L.length; i++) ctx.lineTo(L[i][0], L[i][1]);
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.strokeStyle = '#fff'; ctx.lineWidth = px(opz.grande ? 8 : 7); ctx.stroke();
      ctx.strokeStyle = COR.rotta; ctx.lineWidth = px(opz.grande ? 5 : 4.5); ctx.stroke();
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const tela = (x, z) => [m.ox + m.a * x + m.b * z, m.oy + m.c * x + m.d * z];
    // nomes das cidades (só no mapa grande; maiores primeiro, sem sobrepor)
    if (opz.grande) {
      ctx.font = `900 ${13 * dpr}px Nunito, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const usados = [];
      for (const l of rotulos.sort((a, b) => b.case - a.case)) {
        const [x, y] = tela(l.x, l.z), w = ctx.measureText(l.nome).width + 8 * dpr, yy = y - (detalhe ? 0 : 14 * dpr);
        if (x < -w || x > W + w || y < 0 || y > H) continue;
        if (usados.some(([ux, uy, uw]) => Math.abs(ux - x) < (uw + w) / 2 && Math.abs(uy - yy) < 18 * dpr)) continue;
        usados.push([x, yy, w]);
        if (usados.length > 60) break;
        ctx.lineWidth = 4 * dpr; ctx.strokeStyle = '#152033'; ctx.lineJoin = 'round'; ctx.strokeText(l.nome, x, yy);
        ctx.fillStyle = '#fff'; ctx.fillText(l.nome, x, yy);
      }
    }
    if (mia && mia.x != null) { const [x, y] = tela(mia.x, mia.z); this.icona(ctx, '🏠', x, y, (opz.grande ? 20 : 15) * dpr); }
    if (meta?.punto) { const [x, y] = tela(meta.punto.x, meta.punto.z); this.icona(ctx, '📍', x, y - (opz.grande ? 12 : 9) * dpr, (opz.grande ? 26 : 18) * dpr); }
  }
  icona(ctx, t, x, y, tam) { ctx.font = `${tam}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(t, x, y); }
  freccia(ctx, x, y, ang, tam) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
    ctx.beginPath(); ctx.moveTo(0, -tam); ctx.lineTo(tam * 0.7, tam * 0.75); ctx.lineTo(0, tam * 0.35); ctx.lineTo(-tam * 0.7, tam * 0.75); ctx.closePath();
    ctx.fillStyle = '#fff'; ctx.strokeStyle = '#152033'; ctx.lineWidth = 3; ctx.lineJoin = 'round'; ctx.stroke(); ctx.fill();
    ctx.restore();
  }
  tamanho(cv) {
    const r = cv.getBoundingClientRect(), dpr = Math.min(devicePixelRatio || 1, 2), W = Math.round(r.width * dpr), H = Math.round(r.height * dpr);
    if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
    return { W: r.width, H: r.height, dpr };
  }

  // ---------- minimapa (gira com a câmera) ----------
  aggiorna() {
    if (this.big.hidden === false || this.mini.hidden) return;
    const ps = this.ps, p = ps.pos; if (!p) return;
    const { W, H, dpr } = this.tamanho(this.cvMini), ctx = this.cvMini.getContext('2d');
    const s = (ps.viaggio ? 30 : ps.mezzoId ? 140 : 230);   // px por km (de veículo vê mais longe)
    const sy = Math.sin(ps.yaw), cy = Math.cos(ps.yaw);
    // frente (-sin yaw, -cos yaw) aponta para cima
    const m = { a: cy * s, b: -sy * s, c: sy * s, d: cy * s };
    m.ox = W / 2 - (m.a * p.x + m.b * p.z); m.oy = H / 2 - (m.c * p.x + m.d * p.z);
    ctx.save(); ctx.scale(dpr, dpr);
    const k = { ...m }; // a matriz é aplicada já com o dpr do contexto (scale acima não vale para setTransform)
    for (const n of ['a', 'b', 'c', 'd', 'ox', 'oy']) k[n] = m[n] * dpr;
    this.disegna(ctx, W * dpr, H * dpr, k, s * dpr, { grande: false, passo: 6 * dpr, dpr });
    ctx.restore();
    this.freccia(ctx, W * dpr / 2, H * dpr / 2, 0, 9 * dpr);
    // "N" na borda, onde fica o norte
    const n = this.mini.querySelector('.ps-mini-n'), R = W / 2 - 9;
    n.style.transform = `translate(${(sy * R).toFixed(1)}px, ${(-cy * R).toFixed(1)}px)`;
  }

  // ---------- mapa grande (norte para cima) ----------
  apri() {
    const ps = this.ps;
    document.exitPointerLock?.();
    ps.chiudiMenu();
    this.vista = { x: ps.pos.x, z: ps.pos.z, s: ps.mezzoId ? 90 : 260 };
    this.big.hidden = false;
    ps.teclas.clear();
    this.barraMeta();
    requestAnimationFrame(() => this.disegnaBig());
  }
  chiudi() { this.big.hidden = true; }
  aperta() { return !this.big.hidden; }
  matrizBig(W, H) {
    const v = this.vista, s = v.s;
    return { a: s, b: 0, c: 0, d: s, ox: W / 2 - v.x * s, oy: H / 2 - v.z * s };
  }
  disegnaBig() {
    if (this.big.hidden) return;
    const { W, H, dpr } = this.tamanho(this.cvBig), ctx = this.cvBig.getContext('2d');
    const m = this.matrizBig(W, H), k = {};
    for (const n of ['a', 'b', 'c', 'd', 'ox', 'oy']) k[n] = m[n] * dpr;
    this.disegna(ctx, W * dpr, H * dpr, k, this.vista.s * dpr, { grande: true, passo: 9 * dpr, dpr });
    // eu: seta na direção da câmera
    const p = this.ps.pos, x = (m.ox + m.a * p.x) * dpr, y = (m.oy + m.d * p.z) * dpr;
    this.freccia(ctx, x, y, -this.ps.yaw, 11 * dpr);   // frente = (-sin yaw, -cos yaw); norte para cima
  }
  zoomEm(sx, sy, f) {
    const v = this.vista, r = this.cvBig.getBoundingClientRect(), W = r.width, H = r.height;
    const wx = v.x + (sx - r.left - W / 2) / v.s, wz = v.z + (sy - r.top - H / 2) / v.s;
    v.s = clamp(v.s * f, 0.4, 900);
    v.x = wx - (sx - r.left - W / 2) / v.s; v.z = wz - (sy - r.top - H / 2) / v.s;
    this.disegnaBig();
  }
  ligarBig() {
    const cv = this.cvBig, dedos = new Map();
    let arr = null, pinca = null;
    cv.addEventListener('pointerdown', e => {
      cv.setPointerCapture(e.pointerId);
      dedos.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (dedos.size === 1) arr = { x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY, moveu: false };
      else if (dedos.size === 2) { const [a, b] = [...dedos.values()]; pinca = { d: Math.hypot(a.x - b.x, a.y - b.y) }; arr = null; }
    });
    cv.addEventListener('pointermove', e => {
      if (!dedos.has(e.pointerId)) return;
      dedos.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pinca && dedos.size >= 2) {
        const [a, b] = [...dedos.values()], d = Math.hypot(a.x - b.x, a.y - b.y);
        this.zoomEm((a.x + b.x) / 2, (a.y + b.y) / 2, d / (pinca.d || d)); pinca.d = d;
        return;
      }
      if (!arr) return;
      if (Math.hypot(e.clientX - arr.x0, e.clientY - arr.y0) > 7) arr.moveu = true;
      this.vista.x -= (e.clientX - arr.x) / this.vista.s; this.vista.z -= (e.clientY - arr.y) / this.vista.s;
      arr.x = e.clientX; arr.y = e.clientY;
      if (arr.moveu) this.disegnaBig();
    });
    const fim = e => {
      if (!dedos.has(e.pointerId)) return;
      dedos.delete(e.pointerId);
      if (arr && !arr.moveu && e.type === 'pointerup') {
        const r = cv.getBoundingClientRect(), v = this.vista;
        const x = v.x + (e.clientX - r.left - r.width / 2) / v.s, z = v.z + (e.clientY - r.top - r.height / 2) / v.s;
        this.marca(x, z);
      }
      arr = null;
      if (dedos.size < 2) pinca = null;
    };
    cv.addEventListener('pointerup', fim);
    cv.addEventListener('pointercancel', fim);
    cv.addEventListener('wheel', e => { e.preventDefault(); this.zoomEm(e.clientX, e.clientY, Math.exp(-clamp(e.deltaY, -120, 120) * 0.004)); }, { passive: false });
    addEventListener('resize', () => this.disegnaBig());
  }
  marca(x, z) {
    if (this.eMar(x, z)) { this.ps.ui.aviso('🌊 Lì c’è il mare: scegli un punto sulla terra.'); return; }
    this.ps.impostaMeta(x, z);
    this.disegnaBig();
    this.barraMeta();
  }
  barraMeta() {
    const b = this.big.querySelector('.ps-mappa-meta'), m = this.ps.meta;
    if (!m?.punto) { b.hidden = true; return; }
    const d = Math.hypot(m.punto.x - this.ps.pos.x, m.punto.z - this.ps.pos.z);
    const auto = this.ps.mezzoId && m.cittaDest && m.cittaDest !== this.ps.l && m.rota;
    b.innerHTML = `<div><b>📍 ${esc(m.punto.nome)}</b><small>${distTxt(d)}${m.rota ? ` · ${m.rota.length - 1} ${m.rota.length === 2 ? 'strada' : 'strade'}` : ''}${m.mare ? ' · c’è il mare in mezzo' : ''}</small></div>
      <button type="button" data-a="via" aria-label="Togli destinazione">✕</button>
      ${auto ? `<button type="button" class="ps-cta" data-a="auto">${this.ps.infoMezzo(this.ps.mezzoId)?.icona ?? '🚗'} Portami lì</button>` : ''}
      <button type="button" class="ps-cta" data-a="vai">🧭 Andiamo</button>`;
    b.hidden = false;
  }
}
