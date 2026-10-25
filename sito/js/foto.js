// Fotógrafo: renderiza a cena 3D vista de um ponto qualquer num renderer separado (para as imagens de story).
import * as THREE from 'three';

export class Fotografo {
  constructor(mappa, citta) { this.mappa = mappa; this.citta = citta; }

  foto({ x, z, y, dist, az = 0.62, el = 0.55, w = 960, h = 960, fov = 30 }) {
    clearTimeout(this.tLiberar);
    const r = this.r ??= new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    r.setPixelRatio(1);
    r.setSize(w, h, false);
    const mp = this.mappa, cit = this.citta, yy = y ?? mp.altura(x, z);
    const cam = new THREE.PerspectiveCamera(fov, w / h, Math.max(0.004, dist * 0.02), dist * 12 + 400);
    cam.position.set(x + Math.sin(az) * Math.cos(el) * dist, yy + Math.sin(el) * dist, z + Math.cos(az) * Math.cos(el) * dist);
    cam.lookAt(x, yy, z);

    // monta as cidades em volta do ponto, esconde as bolinhas, ajusta a névoa
    const vis = cit.grupo.visible, pts = mp.punti, pv = pts?.visible, fog = mp.scene.fog, fn = fog.near, ff = fog.far;
    cit.grupo.visible = true;
    cit.preencher(x, z, Math.max(2.5, dist * 3));
    cit.animar(performance.now());
    if (pts) pts.visible = false;
    fog.near = dist * 2.5; fog.far = dist * 9;
    r.render(mp.scene, cam);

    // devolve a cena principal como estava
    fog.near = fn; fog.far = ff;
    if (pts) pts.visible = pv;
    cit.grupo.visible = vis;
    cit.ultimo = null;
    cit.atualizar(true);
    mp.sujo = true;
    this.tLiberar = setTimeout(() => this.liberar(), 30000);
    return { canvas: r.domElement, cam, w, h };
  }

  projetar({ cam, w, h }, x, y, z) {
    const v = new THREE.Vector3(x, y, z).project(cam);
    return { x: (v.x + 1) / 2 * w, y: (1 - v.y) / 2 * h };
  }

  liberar() {
    if (!this.r) return;
    this.r.dispose();
    this.r.forceContextLoss();
    this.r = null;
  }
}
