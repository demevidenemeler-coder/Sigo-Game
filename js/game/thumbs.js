// Vorschaubilder für die Werkstatt-Leiste, gerendert aus den echten 3D-Modellen.
import * as THREE from 'three';
import { RoomEnvironment } from '../../vendor/RoomEnvironment.js';
import { buildCar, sideDecor, topDecor, isTopDecor } from './trainModel.js';
import { buildFigure } from './figures.js';
import { buildTrackObjectPreview } from './trackObjects.js';
import { newCar } from '../catalog.js';

const VIEWS = {
  car: { size: [240, 160], fov: 30, pos: [2.6, 2.8, 6.4], look: [0, 1.0, 0] },
  figure: { size: [160, 160], fov: 30, pos: [0.6, 0.75, 2.1], look: [0, 0.36, 0] },
  sideDecor: { size: [160, 160], fov: 30, pos: [0.2, 0.25, 1.3], look: [0, 0, 0] },
  topDecor: { size: [160, 160], fov: 30, pos: [0.4, 1.0, 3.4], look: [0.1, 0.9, 0] },
  build: { size: [200, 160], fov: 40, pos: [9, 10, 12], look: [0, 0.8, 1.2] },
};

function objectFor(kind, id) {
  if (kind === 'parts') return { obj: buildCar(newCar(id)), view: 'car' };
  if (kind === 'cargo') return { obj: buildFigure(id), view: 'figure' };
  if (kind === 'build') return { obj: buildTrackObjectPreview(id), view: 'build' };
  return isTopDecor(id) ? { obj: topDecor(id, 1), view: 'topDecor' } : { obj: sideDecor(id), view: 'sideDecor' };
}

const cache = {};

// items: [{ kind: 'parts'|'cargo'|'decor'|'build', id }] → { 'kind:id': dataURL } (zwischengespeichert)
export function renderThumbnails(items) {
  items = items.filter(({ kind, id }) => !cache[`${kind}:${id}`]);
  if (!items.length) return cache;
  const canvas = document.createElement('canvas');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NeutralToneMapping;
  const scene = new THREE.Scene();
  scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.55;
  scene.add(new THREE.HemisphereLight('#fff7ea', '#b7a88f', 1.5));
  const sun = new THREE.DirectionalLight('#ffffff', 2.4);
  sun.position.set(5, 10, 8);
  scene.add(sun);

  const out = cache;
  for (const { kind, id } of items) {
    const { obj, view } = objectFor(kind, id);
    const v = VIEWS[view];
    renderer.setSize(v.size[0], v.size[1], false);
    const camera = new THREE.PerspectiveCamera(v.fov, v.size[0] / v.size[1], 0.05, 50);
    camera.position.set(...v.pos);
    camera.lookAt(...v.look);
    scene.add(obj);
    renderer.render(scene, camera);
    out[`${kind}:${id}`] = canvas.toDataURL('image/png');
    scene.remove(obj);
  }
  renderer.dispose();
  renderer.forceContextLoss?.();
  return out;
}
