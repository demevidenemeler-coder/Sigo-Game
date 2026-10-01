// Schlafzimmer für den Zug: gemütlicher Schuppen bei Nacht – Fenster mit Mond und Sternen, warme Lampe,
// Teppich unter den Schienen. Hier wird der Zug zugedeckt (siehe modes/bed.js).

import * as THREE from 'three';
import { RoundedBoxGeometry } from '../../vendor/RoundedBoxGeometry.js';
import { woodTexture } from './textures.js';
import { RAIL_TOP } from './track.js';

const matCache = new Map();
function mat(color, roughness = 0.8, extra = {}) {
  const key = color + roughness + JSON.stringify(extra);
  if (!matCache.has(key)) matCache.set(key, new THREE.MeshStandardMaterial({ color, roughness, ...extra }));
  return matCache.get(key);
}

function add(parent, geometry, material, x = 0, y = 0, z = 0, shadow = true) {
  const m = new THREE.Mesh(geometry, material);
  m.position.set(x, y, z);
  m.castShadow = shadow;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}

export function createBedroom() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#141d36');

  // Mondlicht (kühl, schwach) – wirft weiche Schatten
  const hemi = new THREE.HemisphereLight('#7e93d6', '#2a2230', 0.5);
  scene.add(hemi);
  scene.userData.hemi = hemi;
  scene.userData.envIntensity = 0.16;
  const sun = new THREE.DirectionalLight('#9fb4ff', 0.7);
  sun.position.set(-8, 14, 10);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  const c = sun.shadow.camera;
  c.left = c.bottom = -14;
  c.right = c.top = 14;
  c.near = 1;
  c.far = 60;
  sun.shadow.bias = -0.0005;
  sun.shadow.normalBias = 0.05;
  scene.add(sun, sun.target);

  // Boden aus dunklem Holz
  const floorTex = woodTexture('#8a6a4a', 'bedfloor').clone();
  floorTex.repeat.set(10, 10);
  floorTex.needsUpdate = true;
  const floor = add(scene, new THREE.PlaneGeometry(80, 80), new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.75 }), 0, 0, 0, false);
  floor.rotation.x = -Math.PI / 2;

  // Teppich unter dem Zug (weicher Oval-Teppich)
  const rug = new THREE.Mesh(new THREE.CircleGeometry(1, 48), mat('#b4566b', 1));
  rug.rotation.x = -Math.PI / 2;
  rug.position.y = 0.012;
  rug.receiveShadow = true;
  scene.add(rug);
  const rugRing = new THREE.Mesh(new THREE.RingGeometry(0.86, 0.92, 48), mat('#f2d9a0', 1));
  rugRing.rotation.x = -Math.PI / 2;
  rugRing.position.y = 0.016;
  scene.add(rugRing);

  // Rückwand aus Holzbrettern
  const wallTex = woodTexture('#6c5a4a', 'bedwall').clone();
  wallTex.repeat.set(12, 3);
  wallTex.needsUpdate = true;
  const wall = add(scene, new THREE.PlaneGeometry(80, 16), new THREE.MeshStandardMaterial({ map: wallTex, roughness: 0.9 }), 0, 8, -7, false);
  wall.receiveShadow = true;
  add(scene, new THREE.BoxGeometry(80, 0.6, 0.3), mat('#4a3a2e'), 0, 0.3, -6.85);

  // Fenster mit Mond und Sternen (links hinten, damit man es neben dem Zug sieht)
  const win = new THREE.Group();
  win.position.set(-7.4, 4.3, -6.9);
  scene.add(win);
  const frame = mat('#d9c7a8', 0.6);
  add(win, new THREE.BoxGeometry(4.2, 4.4, 0.25), frame, 0, 0, 0, false);
  add(win, new THREE.BoxGeometry(3.7, 3.9, 0.1), new THREE.MeshBasicMaterial({ color: '#1f2f64' }), 0, 0, 0.12, false);
  const moon = new THREE.Mesh(new THREE.CircleGeometry(0.75, 32), new THREE.MeshBasicMaterial({ color: '#fff3c2' }));
  moon.position.set(0.7, 0.9, 0.2);
  win.add(moon);
  // Mondsichel: dunkle Scheibe schneidet ein Stück ab
  const bite = new THREE.Mesh(new THREE.CircleGeometry(0.7, 32), new THREE.MeshBasicMaterial({ color: '#1f2f64' }));
  bite.position.set(1.05, 1.02, 0.21);
  win.add(bite);
  const stars = new THREE.InstancedMesh(new THREE.OctahedronGeometry(0.07), new THREE.MeshBasicMaterial({ color: '#fffbe0' }), 22);
  const m4 = new THREE.Matrix4();
  let seed = 11;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 22; i++) {
    m4.makeScale(0.7 + rnd() * 1.1, 0.7 + rnd() * 1.1, 0.7 + rnd() * 1.1).setPosition(-1.6 + rnd() * 3.2, -1.6 + rnd() * 3.3, 0.2);
    stars.setMatrixAt(i, m4);
  }
  win.add(stars);
  add(win, new THREE.BoxGeometry(0.12, 3.9, 0.12), frame, 0, 0, 0.2, false);
  add(win, new THREE.BoxGeometry(3.7, 0.12, 0.12), frame, 0, 0, 0.2, false);
  add(win, new THREE.BoxGeometry(4.6, 0.2, 0.5), frame, 0, -2.3, 0.15, false);
  for (const s of [-1, 1]) {
    const cur = add(win, new RoundedBoxGeometry(0.9, 4.8, 0.3, 3, 0.14), mat('#c8606e', 1), s * 2.55, 0.1, 0.25, false);
    cur.rotation.z = s * 0.03;
  }
  // Mondschein fällt durchs Fenster
  const moonSpot = new THREE.SpotLight('#9fb8ff', 40, 30, 0.8, 0.7, 1.5);
  moonSpot.position.set(-7.4, 4.5, -6);
  moonSpot.target.position.set(-1, 0, 2);
  scene.add(moonSpot, moonSpot.target);

  // Gleisstück
  const sleeperMat = new THREE.MeshStandardMaterial({ map: woodTexture('#8a5a33', 'sleeper'), roughness: 0.9 });
  const railMat = new THREE.MeshStandardMaterial({ color: '#9aa0a6', roughness: 0.3, metalness: 0.85 });
  const count = 73;
  const sleepers = new THREE.InstancedMesh(new THREE.BoxGeometry(0.28, 0.12, 1.25), sleeperMat, count);
  for (let i = 0; i < count; i++) sleepers.setMatrixAt(i, m4.makeTranslation(-20 + i * 0.55, 0.1, 0));
  sleepers.receiveShadow = true;
  scene.add(sleepers);
  for (const z of [0.42, -0.42]) add(scene, new THREE.BoxGeometry(40, 0.1, 0.1), railMat, 0, RAIL_TOP - 0.05, z);

  // Hängelampe mit warmem Licht (wird gedimmt, wenn der Zug schläft)
  const lampGroup = new THREE.Group();
  lampGroup.position.set(1.5, 5.6, -1.2);
  add(lampGroup, new THREE.CylinderGeometry(0.02, 0.02, 6, 6), mat('#2a2a2a'), 0, 3, 0, false);
  const shade = add(lampGroup, new THREE.SphereGeometry(0.75, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#f5e6c8', roughness: 0.6, side: THREE.DoubleSide, emissive: '#ffb860', emissiveIntensity: 0.25 }), 0, 0, 0, false);
  const bulbMat = new THREE.MeshBasicMaterial({ color: '#fff0c0' });
  add(lampGroup, new THREE.SphereGeometry(0.2, 16, 12), bulbMat, 0, -0.05, 0, false);
  const light = new THREE.PointLight('#ffc27a', 80, 0, 2);
  light.position.set(0, -0.2, 0);
  lampGroup.add(light);
  scene.add(lampGroup);

  const trainAnchor = new THREE.Group();
  trainAnchor.position.y = RAIL_TOP;
  scene.add(trainAnchor);

  return { scene, sun, trainAnchor, rug, rugRing, light, bulbMat, shade, hemi, moonLight: sun };
}
