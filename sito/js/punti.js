// Bolinhas das cidades na visão de país/região (amarelas = cidades maiores, brancas = pequenas).
import * as THREE from 'three';
import { DIST_CIDADE, posLote } from './citta.js';

// Cada casa como um pontinho colorido: de longe as cidades viram manchas que crescem com o zoom
// (de perto as casas 3D assumem). Tamanho em pixels proporcional ao tamanho real, com mínimo visível.
const COR_NIVEL = { 10: '#D9C9A9', 11: '#7FB7D9', 12: '#FFFFFF', 13: '#F2C98A', 14: '#F2C230' };
const CORES = ['#E2703F', '#E2703F', '#D9653B', '#F2C98A', '#F3E2C2', '#EDB49A'];
export function criarPuntiCase(mappa, D) {
  const n = D.casas.length;
  const pos = new Float32Array(n * 3), cor = new Float32Array(n * 3), c = new THREE.Color();
  const agora = Date.now() / 1000;
  D.casas.forEach((casa, i) => {
    const l = D.luoghi[casa.luogo], q = posLote(casa.lote), x = l.x + q.x, z = l.z + q.z;
    pos.set([x, mappa.altura(x, z) + 0.03, z], i * 3);
    let h = 0;
    for (let k = 0; k < casa.conta.length; k++) h = (h * 31 + casa.conta.charCodeAt(k)) | 0;
    c.set(casa.fiamme > agora ? '#FF8A00' : COR_NIVEL[casa.livello] ?? CORES[Math.abs(h) % CORES.length]);
    c.toArray(cor, i * 3);
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('cor', new THREE.BufferAttribute(cor, 3));
  const mat = new THREE.ShaderMaterial({
    uniforms: { escala: { value: 1 }, pr: { value: mappa.renderer.getPixelRatio() } },
    vertexShader: `
      attribute vec3 cor; uniform float escala; uniform float pr; varying vec3 vCor;
      void main() {
        vCor = cor;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = clamp(0.055 * escala / -mv.z, 1.7, 9.0) * pr;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      varying vec3 vCor;
      void main() {
        if (length(gl_PointCoord - 0.5) > 0.5) discard;
        gl_FragColor = vec4(vCor, 1.0);
        #include <colorspace_fragment>
      }`,
  });
  const pts = new THREE.Points(g, mat);
  pts.frustumCulled = false;
  pts.renderOrder = 5;
  mappa.scene.add(pts);
  const atualizar = () => {
    pts.visible = mappa.dist > DIST_CIDADE * 0.55;
    // pixels por unidade de mundo a 1 km de profundidade
    mat.uniforms.escala.value = innerHeight / (2 * Math.tan(mappa.camera.fov * Math.PI / 360));
  };
  mappa.aoMover.push(atualizar);
  atualizar();
  return pts;
}

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
