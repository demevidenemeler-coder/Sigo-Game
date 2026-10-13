// Selbsttest beim Start: Kann dieses Gerät bewegliche Figuren (Skelett-Animation) richtig zeichnen?
// Auf manchen Tablets rechnet der Grafikchip dabei falsch – die Tiere stecken dann im Boden oder schweben.
// Der Test zeichnet ein kleines Viereck, das von einem Knochen um zwei Einheiten verschoben wird, weit weg
// vom Ursprung (wie in der Landschaft) und prüft, ob es an der richtigen Stelle ankommt.
// Fällt er durch, bleiben die Tiere starr (animalLife.js: setLife(false)) – dann stehen sie überall richtig.

import * as THREE from 'three';

export function gpuInfo(gl) {
  try {
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    return String(ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER));
  } catch {
    return '?';
  }
}

// → { ok, gpu, detail }
export function checkSkinning() {
  const W = 64;
  const H = 16;
  const out = { ok: true, gpu: '?', detail: '' };
  let renderer = null;
  try {
    const canvas = document.createElement('canvas');
    renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, preserveDrawingBuffer: true });
    renderer.setPixelRatio(1);
    renderer.setSize(W, H, false);
    renderer.setClearColor('#000000');
    const gl = renderer.getContext();
    out.gpu = gpuInfo(gl);

    const geometry = new THREE.PlaneGeometry(1, 1);
    const n = geometry.attributes.position.count;
    const index = new Uint16Array(n * 4);
    const weight = new Float32Array(n * 4);
    for (let i = 0; i < n; i++) {
      index[i * 4] = 1; // alles hängt am zweiten Knochen
      weight[i * 4] = 1;
    }
    geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(index, 4));
    geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute(weight, 4));
    const mesh = new THREE.SkinnedMesh(geometry, new THREE.MeshBasicMaterial({ color: '#ffffff' }));
    mesh.frustumCulled = false;
    const root = new THREE.Bone();
    const bone = new THREE.Bone();
    root.add(bone);
    mesh.add(root);
    // wie bei den Tieren (animalLife.js): erst am Ursprung binden, dann an seinen Platz in der Welt setzen
    mesh.updateMatrixWorld(true);
    mesh.bind(new THREE.Skeleton([root, bone]), new THREE.Matrix4());
    const holder = new THREE.Group();
    holder.position.set(60, 0, -40);
    holder.add(mesh);
    const scene = new THREE.Scene();
    scene.add(holder);
    bone.position.x = 2; // nach dem Binden verschieben: das Viereck muss mitwandern

    // Blick von vorne: 4 Einheiten breit (59…63), 1 Einheit hoch → 16 Bildpunkte je Einheit
    const camera = new THREE.OrthographicCamera(-2, 2, 0.5, -0.5, 0.1, 20);
    camera.position.set(61, 0, -30);
    camera.lookAt(61, 0, -40);
    renderer.render(scene, camera);
    const px = new Uint8Array(W * 4);
    gl.readPixels(0, H / 2, W, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
    let first = -1;
    let last = -1;
    for (let x = 0; x < W; x++) {
      if (px[x * 4] > 127) {
        if (first < 0) first = x;
        last = x;
      }
    }
    // erwartet: Viereck von 61,5 bis 62,5 → Spalten 40 bis 55
    out.detail = `${first}-${last}`;
    out.ok = Math.abs(first - 40) <= 1 && Math.abs(last - 55) <= 1;
    geometry.dispose();
    mesh.material.dispose();
    mesh.skeleton.dispose();
  } catch (e) {
    // Test selbst nicht möglich: nichts ändern
    out.detail = `Fehler: ${e?.message ?? e}`;
  }
  try {
    renderer?.dispose();
    renderer?.forceContextLoss?.();
  } catch { /* egal */ }
  return out;
}
