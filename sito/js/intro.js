// Introdução: quando a mapa fica pronta, mostra "Entra"; o toque liga a música (precisa de gesto da pessoa),
// toca o sino e a câmera desce sobre a Itália. Botão 🎵 nos controles liga/desliga (fica lembrado no aparelho).
import { Musica } from './musica.js';

const CHAVE = 'icpc_musica';
const ler = () => { try { return localStorage.getItem(CHAVE) !== '0'; } catch { return true; } };
const gravar = v => { try { localStorage.setItem(CHAVE, v ? '1' : '0'); } catch { /* aba anônima */ } };

export function intro(D, mappa) {
  const el = document.getElementById('caricamento'), qs = new URLSearchParams(location.search);
  const botaoMusica = document.getElementById('musica');
  let musica = null, ligada = ler();

  const criar = () => {
    if (musica) return musica;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    musica = new Musica(new AC());
    return musica;
  };
  const marcar = () => { botaoMusica.textContent = ligada ? '🎵' : '🔇'; botaoMusica.setAttribute('aria-pressed', ligada); };
  const tocar = (comSino = false) => {
    const m = criar();
    if (!m) return;
    m.ctx.resume();
    if (comSino) m.campana();
    m.avvia(0.75, comSino ? 1.1 : 0.3);
    // depois da abertura vira música de fundo
    setTimeout(() => { if (m.ligada) m.volume(0.4, 4); }, 20000);
  };
  botaoMusica.hidden = false;
  marcar();
  botaoMusica.onclick = () => {
    ligada = !ligada; gravar(ligada); marcar();
    if (ligada) { tocar(); musica?.volume(0.4, 1.5); } else musica?.ferma();
  };
  // aba escondida / celular bloqueado: silêncio (e não gasta bateria)
  document.addEventListener('visibilitychange', () => {
    if (!musica) return;
    if (document.hidden) musica.ctx.suspend();
    else if (ligada && musica.ligada) musica.ctx.resume();
  });

  const fechar = () => { el.classList.add('fora'); setTimeout(() => el.remove(), 800); };
  // robôs de teste, gravação de vídeo e ?nointro: entra direto, sem música
  if ((navigator.webdriver && !qs.has('intro')) || qs.has('nointro')) { window.__intro?.fim(); fechar(); return; }

  // números do jogo (chamam atenção para quem chega pela 1ª vez)
  const fmt = n => String(n).replace(/\B(?=(\d{3})+$)/g, '.');   // 5.270 (o it-IT não separa 4 dígitos)
  window.__intro?.pronto(`🏠 ${fmt(D.casas.length)} case · 🏙️ ${fmt(D.luoghi.length)} città · 🏛️ ${fmt(Object.keys(D.snap.cariche.sindaci ?? {}).length)} sindaci`);

  const entra = document.getElementById('intro-entra'), audio = document.getElementById('intro-audio');
  const marcarAudio = () => { audio.textContent = ligada ? '🔊 Musica: sì' : '🔇 Musica: no'; };
  marcarAudio();
  audio.onclick = () => { ligada = !ligada; gravar(ligada); marcarAudio(); marcar(); };

  const profundo = qs.has('cam') || qs.has('casa') || qs.has('luogo') || qs.has('storia') || location.hash;
  const entrar = () => {
    document.removeEventListener('keydown', tecla);
    if (ligada) tocar(true);
    fechar();
    if (profundo || mappa.tocou) return;
    // a câmera desce girando sobre a Itália (2,6 s); se a pessoa mexer no meio, ela assume
    const b = mappa.geo.bbox, alvo = { x: (b.x0 + b.x1) / 2, z: (b.z0 + b.z1) / 2 - 20, dist: mappa.distPais(), az: 0 };
    mappa.az = -0.55; mappa.dist = alvo.dist * 1.7; mappa.atualizarCamera();
    let mexeu = false;
    const toque = () => { mexeu = true; };
    mappa.canvas.addEventListener('pointerdown', toque, { once: true });
    mappa.canvas.addEventListener('wheel', toque, { once: true, passive: true });
    mappa.voar(alvo, 2600);
    setTimeout(() => { if (!mexeu && !mappa.voo) mappa.tocou = false; }, 3000);   // volta a reenquadrar ao girar o celular
  };
  const tecla = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); entrar(); } };
  entra.onclick = entrar;
  document.addEventListener('keydown', tecla);
}
