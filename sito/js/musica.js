// Música ambiente italiana gerada no navegador (Web Audio): nenhum arquivo de áudio, só este código.
// Valzer original em lá menor (3/4): bandolim com trêmulo + acordeão musette no "um-pá-pá" + baixo.
// Acordeão canta a melodia; bandolim dobra (1ª volta) ou faz arpejo (2ª volta).
// O AudioContext vem pronto de fora: precisa nascer dentro do toque da pessoa (regra do iPhone/Chrome).

const BPM = 116, CROMA = 60 / BPM / 2;   // colcheia em segundos (compasso = 6 colcheias)
const hz = m => 440 * 2 ** ((m - 69) / 12);

// acordes por compasso: [baixo, acorde]
const AC = {
  Am: [45, [57, 60, 64]], Dm: [50, [57, 62, 65]], G: [43, [55, 59, 62]], C: [48, [55, 60, 64]],
  E7: [40, [56, 59, 62]], F: [41, [57, 60, 65]],
};
const HARM = ['Am', 'Am', 'Dm', 'Dm', 'G', 'G', 'C', 'E7', 'Am', 'Am', 'Dm', 'Dm', 'F', 'E7', 'Am', 'Am'];
// melodia: [nota MIDI, colcheias] (cada compasso soma 6)
const MEL = [
  [[69, 2], [72, 2], [76, 2]], [[74, 3], [72, 1], [71, 2]],
  [[69, 2], [74, 2], [77, 2]], [[76, 3], [74, 1], [72, 2]],
  [[71, 2], [74, 2], [79, 2]], [[77, 3], [76, 1], [74, 2]],
  [[76, 2], [79, 2], [72, 2]], [[71, 4], [68, 2]],
  [[69, 2], [72, 2], [76, 2]], [[81, 3], [79, 1], [77, 2]],
  [[81, 2], [77, 2], [74, 2]], [[77, 3], [76, 1], [74, 2]],
  [[72, 2], [77, 2], [81, 2]], [[80, 3], [77, 1], [76, 1], [74, 1]],
  [[72, 2], [71, 2], [69, 2]], [[69, 4], [64, 2]],
];

export class Musica {
  constructor(ctx) {
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = 0;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -18; comp.ratio.value = 3;
    this.master.connect(comp).connect(ctx.destination);
    // eco de praça (reverb curto feito de ruído que decai): dá o "ar" de rua de pedra
    this.seco = ctx.createGain();
    const rev = ctx.createConvolver(), molhado = ctx.createGain();
    rev.buffer = this.impulso(1.8);
    molhado.gain.value = 0.28;
    this.seco.connect(this.master);
    this.seco.connect(rev).connect(molhado).connect(this.master);
    this.compasso = 0; this.prox = 0; this.timer = null; this.ligada = false;
  }

  impulso(seg) {
    const sr = this.ctx.sampleRate, n = Math.floor(sr * seg), b = this.ctx.createBuffer(2, n, sr);
    for (let c = 0; c < 2; c++) {
      const d = b.getChannelData(c);
      for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n) ** 3;
    }
    return b;
  }

  // ---------- instrumentos ----------
  // bandolim: 2 cordas por nota levemente desafinadas, filtro que fecha rápido (som de palheta)
  pizzico(m, t, vel = 1, dur = 0.5) {
    const c = this.ctx, g = c.createGain(), f = c.createBiquadFilter();
    f.type = 'lowpass'; f.Q.value = 1;
    f.frequency.setValueAtTime(3800, t); f.frequency.exponentialRampToValueAtTime(1200, t + 0.15);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.2 * vel, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    for (const det of [-4, 4]) {
      const o = c.createOscillator();
      o.type = 'sawtooth'; o.frequency.value = hz(m); o.detune.value = det;
      o.connect(f); o.start(t); o.stop(t + dur + 0.05);
    }
    f.connect(g).connect(this.seco);
  }
  // trêmulo de bandolim: a mesma nota palhetada várias vezes (a marca do som napolitano)
  tremolo(m, t, dur, vel = 1) {
    const passo = 1 / 11;
    for (let k = 0, s = t; s < t + dur - 0.02; k++, s += passo) this.pizzico(m, s, vel * (k % 2 ? 0.65 : 0.85), 0.2);
  }
  // acordeão musette: 2 palhetas desafinadas (o "batimento" típico) + oitava de baixo bem leve
  fisarmonica(notas, t, dur, vel = 1, vibrato = false) {
    const c = this.ctx, g = c.createGain(), f = c.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = 2300; f.Q.value = 0.7;
    const pico = 0.08 * vel / Math.sqrt(notas.length);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(pico, t + 0.05);
    g.gain.setValueAtTime(pico, t + Math.max(0.06, dur - 0.08));
    g.gain.linearRampToValueAtTime(0.0001, t + dur);
    let lfo = null;
    if (vibrato) {
      lfo = c.createOscillator(); const lg = c.createGain();
      lfo.frequency.value = 5.5; lg.gain.value = 9; lfo.connect(lg);
      lfo.start(t); lfo.stop(t + dur + 0.05);
      lfo.lg = lg;
    }
    for (const m of notas) {
      for (const [tipo, det, mult] of [['sawtooth', -9, 1], ['sawtooth', 9, 1], ['square', 0, 0.5]]) {
        const o = c.createOscillator(), og = c.createGain();
        o.type = tipo; o.frequency.value = hz(m) * mult; o.detune.value = det;
        og.gain.value = mult < 1 ? 0.35 : 1;
        if (lfo) lfo.lg.connect(o.detune);
        o.connect(og).connect(f); o.start(t); o.stop(t + dur + 0.05);
      }
    }
    f.connect(g).connect(this.seco);
  }
  basso(m, t, dur) {
    const c = this.ctx, g = c.createGain(), o = c.createOscillator(), o2 = c.createOscillator();
    o.type = 'triangle'; o.frequency.value = hz(m);
    o2.type = 'sine'; o2.frequency.value = hz(m) / 2;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.32, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); o2.connect(g); g.connect(this.seco);
    for (const x of [o, o2]) { x.start(t); x.stop(t + dur + 0.05); }
  }
  // sino de igreja (parciais fora da série harmônica): toca ao entrar no jogo
  campana(t = this.ctx.currentTime + 0.02, m = 64) {
    const c = this.ctx;
    for (const [r, a, d] of [[0.5, 0.5, 4], [1, 0.4, 3.2], [1.19, 0.25, 2.4], [1.5, 0.2, 2], [2, 0.18, 1.6], [2.74, 0.1, 1.2], [3.76, 0.06, 0.9]]) {
      const o = c.createOscillator(), g = c.createGain();
      o.frequency.value = hz(m) * r;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.2 * a, t + 0.006);
      g.gain.exponentialRampToValueAtTime(0.0001, t + d);
      o.connect(g).connect(this.seco); o.start(t); o.stop(t + d + 0.05);
    }
  }

  // ---------- partitura ----------
  tocarCompasso(n, t) {
    const i = n % 16, volta = Math.floor(n / 16) % 2, [b, acc] = AC[HARM[i]];
    // um-pá-pá: baixo no 1º tempo, acorde curto no 2º e no 3º
    this.basso(b, t, CROMA * 2.2);
    this.fisarmonica(acc, t + CROMA * 2, CROMA * 1.1, 0.8);
    this.fisarmonica(acc, t + CROMA * 4, CROMA * 1.1, 0.7);
    // o acordeão canta a melodia sempre (é o que soa "música" desde o 1º compasso);
    // 1ª volta: bandolim dobra uma oitava acima, de leve; 2ª volta: bandolim faz arpejo do acorde
    let s = t;
    for (const [m, d] of MEL[i]) {
      const dur = d * CROMA;
      this.fisarmonica([m], s, dur * 0.95, 1.6, true);
      if (volta === 0) {
        if (d >= 3) this.tremolo(m + 12, s, dur * 0.9, 0.45);
        else this.pizzico(m + 12, s, 0.5, 0.3);
      }
      s += dur;
    }
    if (volta === 1) acc.concat(acc[1] + 12, acc[2] + 12).forEach((m, k) => this.pizzico(m + 12, t + k * CROMA, 0.4, 0.35));
  }
  agendar() {
    const ate = this.ctx.currentTime + 0.35;
    while (this.prox < ate) {
      this.tocarCompasso(this.compasso++, this.prox);
      this.prox += CROMA * 6;
    }
  }

  // ---------- controle ----------
  avvia(volume = 0.6, atraso = 0.6) {
    if (this.ligada) return;
    this.ligada = true;
    const t = this.ctx.currentTime;
    this.prox = Math.max(this.prox, t + atraso);
    this.master.gain.cancelScheduledValues(t);
    this.master.gain.setValueAtTime(this.master.gain.value, t);
    this.master.gain.linearRampToValueAtTime(volume, t + 1.5);
    this.agendar();
    this.timer = setInterval(() => this.agendar(), 120);
  }
  volume(v, seg = 2) {
    const t = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(t);
    this.master.gain.setValueAtTime(this.master.gain.value, t);
    this.master.gain.linearRampToValueAtTime(v, t + seg);
  }
  ferma(seg = 0.8) {
    if (!this.ligada) return;
    this.ligada = false;
    this.volume(0, seg);
    clearInterval(this.timer);
    // o que já foi agendado termina em silêncio; a próxima volta recomeça do início do compasso seguinte
    this.prox = this.ctx.currentTime + seg + 0.1;
  }
}
