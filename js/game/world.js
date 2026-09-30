// Die zwei Schauplätze: Werkstatt (Zug bauen) und Landschaft (malen und fahren).

import * as THREE from 'three';
import { Track, RAIL_TOP } from './track.js';

export const WORLD_BOUNDS = { x: 19, z: 12 };

function lights(scene, shadowSize) {
  scene.add(new THREE.HemisphereLight('#fff7ea', '#b7a88f', 1.6));
  const sun = new THREE.DirectionalLight('#ffffff', 2.2);
  sun.position.set(8, 18, 10);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  const c = sun.shadow.camera;
  c.left = c.bottom = -shadowSize;
  c.right = c.top = shadowSize;
  c.near = 1;
  c.far = 60;
  sun.shadow.bias = -0.0005;
  sun.shadow.normalBias = 0.03;
  scene.add(sun);
  return sun;
}

// ---------- Werkstatt ----------

export function createWorkshop() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#f4ecdf');
  lights(scene, 12);

  const floor = new THREE.Mesh(
    new THREE.CircleGeometry(40, 48),
    new THREE.MeshStandardMaterial({ color: '#e9dcc3', roughness: 1 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  // Gerades Gleisstück unter dem Zug
  const sleeperMat = new THREE.MeshStandardMaterial({ color: '#8a5a33', roughness: 0.9 });
  const railMat = new THREE.MeshStandardMaterial({ color: '#9aa0a6', roughness: 0.35, metalness: 0.7 });
  const sleeperGeo = new THREE.BoxGeometry(0.28, 0.12, 1.25);
  for (let x = -20; x <= 20; x += 0.55) {
    const s = new THREE.Mesh(sleeperGeo, sleeperMat);
    s.position.set(x, 0.1, 0);
    s.receiveShadow = true;
    scene.add(s);
  }
  for (const z of [0.42, -0.42]) {
    const r = new THREE.Mesh(new THREE.BoxGeometry(40, 0.1, 0.1), railMat);
    r.position.set(0, RAIL_TOP - 0.05, z);
    r.castShadow = true;
    scene.add(r);
  }

  const trainAnchor = new THREE.Group();
  trainAnchor.position.y = RAIL_TOP;
  scene.add(trainAnchor);
  return { scene, trainAnchor };
}

// ---------- Landschaft ----------

const leafColors = ['#5fae5a', '#4f9a4f', '#76b95e'];
const houseColors = ['#f2c7a5', '#e9e1d0', '#d8e6f0', '#f5d98b'];
const roofColors = ['#c8453a', '#8a5a33', '#4f6d8a'];

function tree(rand) {
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.2, 0.8, 8),
    new THREE.MeshStandardMaterial({ color: '#8a5a33' }));
  trunk.position.y = 0.4;
  const round = rand() > 0.4;
  const leafMat = new THREE.MeshStandardMaterial({ color: leafColors[Math.floor(rand() * 3)], roughness: 0.9 });
  const crown = round
    ? new THREE.Mesh(new THREE.SphereGeometry(0.85, 14, 10), leafMat)
    : new THREE.Mesh(new THREE.ConeGeometry(0.8, 1.9, 12), leafMat);
  crown.position.y = round ? 1.45 : 1.6;
  g.add(trunk, crown);
  g.traverse((o) => { o.castShadow = true; o.receiveShadow = true; });
  const s = 0.8 + rand() * 0.6;
  g.scale.setScalar(s);
  g.userData.kind = 'tree';
  return g;
}

function house(rand) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.3, 1.5),
    new THREE.MeshStandardMaterial({ color: houseColors[Math.floor(rand() * houseColors.length)] }));
  body.position.y = 0.65;
  const roof = new THREE.Mesh(new THREE.ConeGeometry(1.45, 0.9, 4),
    new THREE.MeshStandardMaterial({ color: roofColors[Math.floor(rand() * roofColors.length)] }));
  roof.position.y = 1.75;
  roof.rotation.y = Math.PI / 4;
  roof.scale.set(1, 1, 0.85);
  const door = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.65, 0.04), new THREE.MeshStandardMaterial({ color: '#8a5a33' }));
  door.position.set(0, 0.33, 0.76);
  const win = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.35, 0.04), new THREE.MeshStandardMaterial({ color: '#9fc6e6' }));
  win.position.set(0.55, 0.85, 0.76);
  const win2 = win.clone();
  win2.position.x = -0.55;
  g.add(body, roof, door, win, win2);
  g.traverse((o) => { o.castShadow = true; o.receiveShadow = true; });
  g.userData.kind = 'house';
  return g;
}

function seeded(seed) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

export function createLandscape() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#cfe6f2');
  scene.fog = new THREE.Fog('#cfe6f2', 45, 90);
  lights(scene, 26);

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(160, 160),
    new THREE.MeshStandardMaterial({ color: '#9ccc72', roughness: 1 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  ground.userData.ground = true;
  scene.add(ground);

  // Ein heller Spielteppich zeigt, wo man malen kann
  const mat = new THREE.Mesh(
    new THREE.PlaneGeometry(WORLD_BOUNDS.x * 2 + 4, WORLD_BOUNDS.z * 2 + 4),
    new THREE.MeshStandardMaterial({ color: '#abd682', roughness: 1 }),
  );
  mat.rotation.x = -Math.PI / 2;
  mat.position.y = 0.01;
  mat.receiveShadow = true;
  scene.add(mat);

  // Landschaft: Bäume und Häuser, auf und um den Spielteppich
  const rand = seeded(7);
  const scenery = [];
  for (let i = 0; i < 70; i++) {
    const x = (rand() * 2 - 1) * (WORLD_BOUNDS.x + 12);
    const z = (rand() * 2 - 1) * (WORLD_BOUNDS.z + 10);
    const obj = rand() > 0.85 ? house(rand) : tree(rand);
    obj.position.set(x, 0, z);
    obj.rotation.y = rand() * Math.PI * 2;
    obj.userData.baseScale = obj.scale.x;
    scene.add(obj);
    scenery.push(obj);
  }

  const track = new Track();
  scene.add(track.group);

  const trainAnchor = new THREE.Group();
  trainAnchor.position.y = RAIL_TOP;
  scene.add(trainAnchor);

  // Alles, was im Weg der Schienen steht, verschwindet
  function clearAroundTrack() {
    for (const o of scenery) {
      const r = o.userData.kind === 'house' ? 2.6 : 1.8;
      o.visible = track.distanceTo(o.position.x, o.position.z) > r;
    }
  }

  return { scene, ground, track, trainAnchor, scenery, clearAroundTrack };
}
