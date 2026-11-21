// Veículos da passeggiata (comprados com crediti: data/crediti.json "catalogo" com "velocita").
// Modelos low-poly em unidades da altura do boneco (H), frente para +z. bici/vespa: o boneco vai sentado em cima;
// auto/sportiva: o boneco some e o carro anda sozinho. userData.ruote giram com a distância (passeggio.js).
import * as THREE from 'three';

export const VEICOLI = ['bici', 'vespa', 'auto', 'sportiva'];
export const SEDUTO = { bici: { y: 0.42, z: -0.05, gambe: 'pedala' }, vespa: { y: 0.36, z: -0.12, gambe: 'ferme' } };   // onde o boneco senta

export function costruisciVeicolo(id, H) {
  const u = H, g = new THREE.Group(), ruote = [];
  const mats = new Map(), mat = c => { if (!mats.has(c)) mats.set(c, new THREE.MeshLambertMaterial({ color: c, flatShading: true })); return mats.get(c); };
  const caixa = (w, h, d, c, x, y, z) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w * u, h * u, d * u), mat(c)); m.position.set(x * u, y * u, z * u); g.add(m); return m; };
  const ruota = (r, w, x, y, z, c = '#1B1B1B') => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r * u, r * u, w * u, 14), mat(c)); m.rotation.z = Math.PI / 2;
    const p = new THREE.Group(); p.position.set(x * u, y * u, z * u); p.add(m);
    const raggio = new THREE.Mesh(new THREE.BoxGeometry(w * u * 1.05, r * u * 1.5, r * u * 0.25), mat('#BFC5CC')); p.add(raggio);
    g.add(p); ruote.push(p); return p;
  };
  if (id === 'bici') {
    ruota(0.2, 0.04, 0, 0.2, 0.36); ruota(0.2, 0.04, 0, 0.2, -0.36);
    const telaio = '#E0473C';
    caixa(0.035, 0.035, 0.62, telaio, 0, 0.36, 0); caixa(0.035, 0.3, 0.035, telaio, 0, 0.28, -0.08);
    const f = caixa(0.035, 0.32, 0.035, telaio, 0, 0.36, 0.3); f.rotation.x = 0.3;
    caixa(0.32, 0.03, 0.03, '#1B1B1B', 0, 0.55, 0.26); caixa(0.12, 0.035, 0.18, '#1B1B1B', 0, 0.45, -0.08);
  } else if (id === 'vespa') {
    const c = '#7FD1B9';
    ruota(0.13, 0.08, 0, 0.13, 0.38, '#222'); ruota(0.13, 0.08, 0, 0.13, -0.32, '#222');
    caixa(0.3, 0.2, 0.42, c, 0, 0.3, -0.2);                        // scocca posteriore
    caixa(0.24, 0.06, 0.4, '#5A3A22', 0, 0.42, -0.16);             // sella
    caixa(0.22, 0.08, 0.36, c, 0, 0.16, 0.12);                     // pedana
    caixa(0.26, 0.42, 0.1, c, 0, 0.18, 0.34);                      // scudo
    caixa(0.4, 0.04, 0.05, '#C0C0C0', 0, 0.66, 0.36); caixa(0.12, 0.08, 0.08, '#FFF6C4', 0, 0.56, 0.4);
  } else {
    const sport = id === 'sportiva', c = sport ? '#D3252B' : '#3FA9F5', L = sport ? 2.4 : 2.0, W = sport ? 1.0 : 0.95;
    const hb = sport ? 0.32 : 0.42, hc = sport ? 0.26 : 0.4;
    for (const s of [-1, 1]) for (const z of [L * 0.32, -L * 0.32]) ruota(0.2, 0.14, s * W * 0.46, 0.2, z);
    caixa(W, hb, L, c, 0, 0.2 + hb / 2, 0);                                            // carrozzeria
    caixa(W * 0.86, hc, L * (sport ? 0.4 : 0.55), c, 0, 0.2 + hb + hc / 2, sport ? -L * 0.06 : -L * 0.05);   // abitacolo
    caixa(W * 0.88, hc * 0.7, 0.02, '#9ED1F2', 0, 0.2 + hb + hc * 0.45, (sport ? L * 0.14 : L * 0.225) + 0.012);   // parabrezza
    for (const s of [-1, 1]) caixa(0.02, hc * 0.6, L * (sport ? 0.32 : 0.45), '#9ED1F2', s * (W * 0.43 + 0.012), 0.2 + hb + hc * 0.45, sport ? -L * 0.06 : -L * 0.05);
    for (const s of [-1, 1]) { caixa(0.16, 0.08, 0.02, '#FFF6C4', s * W * 0.32, 0.2 + hb * 0.6, L / 2 + 0.01); caixa(0.16, 0.07, 0.02, '#B91C1C', s * W * 0.32, 0.2 + hb * 0.6, -L / 2 - 0.01); }
    if (sport) { caixa(W * 0.9, 0.04, 0.16, '#1B1B1B', 0, 0.2 + hb + 0.16, -L / 2 + 0.1); for (const s of [-1, 1]) caixa(0.04, 0.14, 0.04, '#1B1B1B', s * W * 0.35, 0.2 + hb, -L / 2 + 0.1); }
    else caixa(W * 0.6, 0.03, L * 0.4, '#1F2A44', 0, 0.2 + hb + hc + 0.015, -L * 0.05);   // portapacchi
  }
  const sombra = new THREE.Mesh(new THREE.PlaneGeometry(u * (id === 'auto' || id === 'sportiva' ? 1.1 : 0.4), u * (id === 'sportiva' ? 2.5 : id === 'auto' ? 2.1 : 0.9)),
    new THREE.MeshBasicMaterial({ color: '#000', transparent: true, opacity: 0.22, depthWrite: false }));
  sombra.rotation.x = -Math.PI / 2; sombra.position.y = 0.004 * u; g.add(sombra);
  g.userData = { ruote, raggio: (id === 'vespa' ? 0.13 : 0.2) * u };
  return g;
}
