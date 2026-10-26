// Loja 3D completa de um comércio (prédio + letreiros com nome/logo), usada no mapa e na prévia do editor.
import * as THREE from 'three';
import { costruisciNegozio } from './modelli.js';
import { texturaFaccia, carregarImagem, fontePronta } from './insegne.js';

const matLoja = new THREE.MeshLambertMaterial({ vertexColors: true });

// cm: { nome, colore, logo, stile }. aoMudar(): chamado quando as texturas ficam prontas (para redesenhar)
export function creaNegozio3D(cm, { aoMudar = () => {}, material = matLoja } = {}) {
  const g = new THREE.Group();
  const { geo, facce } = costruisciNegozio(cm.colore, cm.stile ?? {});
  g.add(new THREE.Mesh(geo, material));
  const malhas = facce.map(f => {
    const pg = new THREE.PlaneGeometry(f.p.w, f.p.h);
    if (f.ry) { pg.rotateY(f.ry); pg.translate(f.dx ?? 0, f.p.y + f.p.h / 2, f.dz ?? 0); }
    else pg.translate(f.p.x ?? 0, f.p.y + f.p.h / 2, f.p.z);
    const m = new THREE.Mesh(pg, new THREE.MeshBasicMaterial({ transparent: f.tipo === 'neon' }));
    m.userData.tipo = f.tipo;
    g.add(m);
    return m;
  });
  const pintar = logo => {
    for (const m of malhas) { m.material.map?.dispose(); m.material.map = texturaFaccia(m.userData.tipo, cm, logo); m.material.needsUpdate = true; }
    aoMudar();
  };
  pintar(null);
  Promise.all([carregarImagem(cm.logo), fontePronta]).then(([logo]) => pintar(logo));
  g.userData.descartar = () => g.traverse(o => { if (o.isMesh) { o.geometry.dispose(); if (o.material !== material) { o.material.map?.dispose(); o.material.dispose(); } } });
  return g;
}
