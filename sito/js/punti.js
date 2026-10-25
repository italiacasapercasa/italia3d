// Bolinhas das cidades na visão de país/região (amarelas = cidades maiores, brancas = pequenas).
import * as THREE from 'three';
import { DIST_CIDADE } from './citta.js';

export function criarPunti(mappa, D) {
  const n = D.luoghi.length;
  const pos = new Float32Array(n * 3), tam = new Float32Array(n), cor = new Float32Array(n * 3), qtd = new Float32Array(n);
  const amarelo = new THREE.Color('#FFC93C'), branco = new THREE.Color('#FFFFFF');
  D.luoghi.forEach((l, i) => {
    pos.set([l.x, mappa.altura(l.x, l.z) + 0.05, l.z], i * 3);
    qtd[i] = l.case;
    const grande = l.case >= 25;
    tam[i] = grande ? 9 + Math.min(7, Math.log2(l.case / 25) * 1.6) : 4.5 + Math.min(2.5, l.case / 10);
    (grande ? amarelo : branco).toArray(cor, i * 3);
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('tam', new THREE.BufferAttribute(tam, 1));
  g.setAttribute('cor', new THREE.BufferAttribute(cor, 3));
  g.setAttribute('qtd', new THREE.BufferAttribute(qtd, 1));
  const mat = new THREE.ShaderMaterial({
    uniforms: { escala: { value: 1 }, pr: { value: mappa.renderer.getPixelRatio() }, minimo: { value: 1 } },
    vertexShader: `
      attribute float tam; attribute vec3 cor; attribute float qtd; uniform float escala; uniform float pr; uniform float minimo; varying vec3 vCor; varying float vTam;
      void main() {
        vCor = cor; vTam = qtd < minimo ? 0.0 : tam * escala * pr; gl_PointSize = vTam;
        gl_Position = qtd < minimo ? vec4(2.0, 2.0, 2.0, 1.0) : projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: `
      varying vec3 vCor; varying float vTam;
      void main() {
        float d = length(gl_PointCoord - 0.5) * 2.0;
        if (d > 1.0) discard;
        float borda = 1.0 - 2.2 / max(vTam, 1.0);
        vec3 c = d > borda ? vec3(0.0075, 0.014, 0.033) : vCor;
        gl_FragColor = vec4(c, 1.0);
        #include <colorspace_fragment>
      }`,
    depthTest: false, transparent: false,
  });
  const pts = new THREE.Points(g, mat);
  pts.renderOrder = 10;
  pts.frustumCulled = false;
  mappa.scene.add(pts);
  mappa.aoMover.push(() => {
    pts.visible = mappa.dist > DIST_CIDADE * 0.8;
    mat.uniforms.escala.value = mappa.dist > 900 ? 0.8 : mappa.dist > 200 ? 1 : 1.25;
    mat.uniforms.minimo.value = mappa.dist > 1200 ? 6 : mappa.dist > 500 ? 3 : 1;
  });
  return pts;
}
