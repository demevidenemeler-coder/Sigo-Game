// Vorschaubilder für die Werkstatt-Leiste, gerendert aus den echten 3D-Modellen.
import * as THREE from 'three';
import { buildCar } from './trainModel.js';
import { newCar } from '../catalog.js';

export function renderThumbnails(types) {
  const canvas = document.createElement('canvas');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setSize(220, 150, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight('#fff7ea', '#b7a88f', 1.8));
  const sun = new THREE.DirectionalLight('#ffffff', 2.2);
  sun.position.set(5, 10, 8);
  scene.add(sun);
  const camera = new THREE.PerspectiveCamera(30, 220 / 150, 0.1, 50);
  camera.position.set(2.6, 2.8, 6.2);
  camera.lookAt(0, 1.0, 0);

  const out = {};
  for (const type of types) {
    const car = buildCar(newCar(type));
    scene.add(car);
    renderer.render(scene, camera);
    out[type] = canvas.toDataURL('image/png');
    scene.remove(car);
  }
  renderer.dispose();
  renderer.forceContextLoss?.();
  return out;
}
