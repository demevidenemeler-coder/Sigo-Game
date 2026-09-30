// Die zwei Schauplätze: Werkstatt (Zug bauen) und Landschaft (malen und fahren).

import * as THREE from 'three';
import { RoundedBoxGeometry } from '../../vendor/RoundedBoxGeometry.js';
import { Track, RAIL_TOP } from './track.js';
import { buildFigure } from './figures.js';
import { woodTexture, grassTexture, waterTexture } from './textures.js';

// Spielfeld, auf dem gemalt werden kann (halbe Breite / halbe Tiefe)
export const WORLD_BOUNDS = { x: 26, z: 17 };
const FENCE = { x: WORLD_BOUNDS.x + 3, z: WORLD_BOUNDS.z + 3 };

function seeded(seed) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

const matCache = new Map();
function mat(color, roughness = 0.8) {
  const k = color + roughness;
  if (!matCache.has(k)) matCache.set(k, new THREE.MeshStandardMaterial({ color, roughness }));
  return matCache.get(k);
}

function add(parent, geometry, material, x, y, z, shadow = true) {
  const m = new THREE.Mesh(geometry, material);
  m.position.set(x, y, z);
  m.castShadow = shadow;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}

function sunLight(scene, size, mapSize = 2048) {
  scene.add(new THREE.HemisphereLight('#fff7ea', '#8fa877', 1.3));
  const sun = new THREE.DirectionalLight('#fff4e0', 2.6);
  sun.position.set(12, 24, 14);
  sun.castShadow = true;
  sun.shadow.mapSize.set(mapSize, mapSize);
  const c = sun.shadow.camera;
  c.left = c.bottom = -size;
  c.right = c.top = size;
  c.near = 1;
  c.far = 90;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.03;
  scene.add(sun, sun.target);
  return sun;
}

// ---------- Werkstatt ----------

export function createWorkshop() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#f1e6d3');
  const sun = sunLight(scene, 14);

  const floorTex = woodTexture('#dcc39c', 'floor').clone();
  floorTex.repeat.set(10, 10);
  floorTex.needsUpdate = true;
  const floor = add(scene, new THREE.PlaneGeometry(80, 80), new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.7 }), 0, 0, 0, false);
  floor.rotation.x = -Math.PI / 2;

  // Rückwand mit Fenstern, Regal und Farbdosen
  const wall = add(scene, new THREE.PlaneGeometry(80, 16), mat('#efe0c8', 1), 0, 8, -7, false);
  wall.receiveShadow = true;
  add(scene, new THREE.BoxGeometry(80, 0.6, 0.3), mat('#b98553'), 0, 0.3, -6.85);
  for (const x of [-14, 0, 14]) {
    add(scene, new THREE.BoxGeometry(6.4, 4.4, 0.2), mat('#b98553'), x, 7, -6.95, false);
    add(scene, new THREE.BoxGeometry(6, 4, 0.1), new THREE.MeshBasicMaterial({ color: '#bfe3f5' }), x, 7, -6.85, false);
    add(scene, new THREE.BoxGeometry(0.15, 4, 0.12), mat('#b98553'), x, 7, -6.8, false);
    add(scene, new THREE.BoxGeometry(6, 0.15, 0.12), mat('#b98553'), x, 7, -6.8, false);
  }
  add(scene, new THREE.BoxGeometry(9, 0.2, 1.2), mat('#a8703f'), -7, 3.2, -6.4);
  const canColors = ['#d9463b', '#f2c832', '#3b7cc9', '#4fa65a', '#8b5bb5', '#ee8a2b'];
  canColors.forEach((c, i) => {
    add(scene, new THREE.CylinderGeometry(0.35, 0.35, 0.7, 20), mat('#c3beb5', 0.3), -10.5 + i * 1.2, 3.65, -6.4);
    add(scene, new THREE.CylinderGeometry(0.36, 0.36, 0.25, 20), mat(c, 0.4), -10.5 + i * 1.2, 3.75, -6.4);
  });
  add(scene, new THREE.BoxGeometry(9, 0.2, 1.2), mat('#a8703f'), 8, 3.2, -6.4);
  for (let i = 0; i < 4; i++) {
    const b = add(scene, new RoundedBoxGeometry(0.9, 0.8, 0.8, 2, 0.05), new THREE.MeshStandardMaterial({ map: woodTexture('#c99a62', 'crate'), roughness: 0.8 }), 5.5 + i * 1.3, 3.7, -6.4);
    b.rotation.y = (i % 2) * 0.2;
  }

  // Gerades Gleisstück unter dem Zug
  const sleeperMat = new THREE.MeshStandardMaterial({ map: woodTexture('#8a5a33', 'sleeper'), roughness: 0.9 });
  const railMat = new THREE.MeshStandardMaterial({ color: '#9aa0a6', roughness: 0.3, metalness: 0.85 });
  const count = 73;
  const sleepers = new THREE.InstancedMesh(new THREE.BoxGeometry(0.28, 0.12, 1.25), sleeperMat, count);
  const m = new THREE.Matrix4();
  for (let i = 0; i < count; i++) sleepers.setMatrixAt(i, m.makeTranslation(-20 + i * 0.55, 0.1, 0));
  sleepers.receiveShadow = true;
  scene.add(sleepers);
  for (const z of [0.42, -0.42]) {
    const r = add(scene, new THREE.BoxGeometry(40, 0.1, 0.1), railMat, 0, RAIL_TOP - 0.05, z);
    r.castShadow = true;
  }

  const trainAnchor = new THREE.Group();
  trainAnchor.position.y = RAIL_TOP;
  scene.add(trainAnchor);

  // Leuchtender Ring unter dem Wagen, auf den gerade etwas gezogen wird
  const highlight = new THREE.Mesh(
    new THREE.RingGeometry(0.85, 1.0, 48),
    new THREE.MeshBasicMaterial({ color: '#ffd166', transparent: true, opacity: 0.9, depthWrite: false }),
  );
  highlight.rotation.x = -Math.PI / 2;
  highlight.position.y = 0.2;
  highlight.visible = false;
  scene.add(highlight);

  return { scene, trainAnchor, sun, highlight };
}

// ---------- Landschaft: Bausteine ----------

function tree(kind, rand) {
  const g = new THREE.Group();
  const trunkColor = kind === 'birke' ? '#ece8df' : '#8a5a33';
  add(g, new THREE.CylinderGeometry(0.14, 0.2, 1, 8), mat(trunkColor), 0, 0.5, 0);
  const greens = ['#5fae5a', '#4f9a4f', '#76b95e', '#3f8a4a'];
  const leaf = mat(greens[Math.floor(rand() * greens.length)], 0.9);
  if (kind === 'tanne') {
    for (let i = 0; i < 3; i++) add(g, new THREE.ConeGeometry(0.9 - i * 0.22, 1.1, 10), leaf, 0, 1.2 + i * 0.6, 0);
  } else {
    add(g, new THREE.IcosahedronGeometry(0.85, 1), leaf, 0, 1.6, 0);
    add(g, new THREE.IcosahedronGeometry(0.6, 1), leaf, 0.45, 1.35, 0.2);
    add(g, new THREE.IcosahedronGeometry(0.55, 1), leaf, -0.4, 1.45, -0.2);
    if (kind === 'apfel') {
      for (let i = 0; i < 7; i++) {
        const a = rand() * Math.PI * 2;
        const y = 1.3 + rand() * 0.7;
        add(g, new THREE.SphereGeometry(0.09, 8, 6), mat('#e5484d', 0.4), Math.cos(a) * 0.82, y, Math.sin(a) * 0.82);
      }
    }
  }
  g.scale.setScalar(0.85 + rand() * 0.5);
  g.userData.kind = 'tree';
  return g;
}

function house(rand, big = false) {
  const g = new THREE.Group();
  const walls = ['#f2c7a5', '#f7f1e3', '#d8e6f0', '#f5d98b', '#f0c9c9'];
  const roofs = ['#c8453a', '#8a5a33', '#4f6d8a', '#6e8a4f'];
  const w = big ? 2.6 : 1.9;
  add(g, new RoundedBoxGeometry(w, 1.4, 1.6, 2, 0.06), mat(walls[Math.floor(rand() * walls.length)]), 0, 0.7, 0);
  const roof = add(g, new THREE.CylinderGeometry(0.01, 1.2, w + 0.3, 3, 1), mat(roofs[Math.floor(rand() * roofs.length)], 0.6), 0, 1.75, 0);
  roof.rotation.z = Math.PI / 2;
  roof.rotation.y = Math.PI / 2;
  roof.scale.set(0.95, 1, 0.6);
  add(g, new THREE.BoxGeometry(0.3, 0.6, 0.3), mat('#9a6b4a'), w * 0.25, 2.1, -0.2);
  add(g, new THREE.BoxGeometry(0.42, 0.7, 0.05), mat('#8a5a33'), 0, 0.35, 0.81);
  for (const x of [-w * 0.3, w * 0.3]) {
    add(g, new THREE.BoxGeometry(0.42, 0.38, 0.05), mat('#9fc6e6', 0.2), x, 0.9, 0.81);
    add(g, new THREE.BoxGeometry(0.5, 0.06, 0.08), mat('#ffffff'), x, 0.68, 0.83);
  }
  g.userData.kind = 'house';
  return g;
}

function barn() {
  const g = new THREE.Group();
  add(g, new RoundedBoxGeometry(4.5, 3, 3.5, 2, 0.08), mat('#c8453a'), 0, 1.5, 0);
  const roof = add(g, new THREE.CylinderGeometry(0.01, 2.4, 4.8, 3, 1), mat('#5a4a42', 0.6), 0, 3.6, 0);
  roof.rotation.z = Math.PI / 2;
  roof.scale.set(0.95, 1, 0.7);
  roof.rotation.y = Math.PI / 2;
  add(g, new THREE.BoxGeometry(1.6, 2, 0.1), mat('#f7f1e3'), 0, 1, 1.76);
  add(g, new THREE.BoxGeometry(1.4, 1.8, 0.12), mat('#a33a31'), 0, 0.95, 1.77);
  // Silo
  add(g, new THREE.CylinderGeometry(0.9, 0.9, 5, 20), mat('#d9d4c8', 0.5), 3.2, 2.5, -0.4);
  add(g, new THREE.SphereGeometry(0.9, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), mat('#4f6d8a', 0.5), 3.2, 5, -0.4);
  return g;
}

function windmill() {
  const g = new THREE.Group();
  add(g, new THREE.CylinderGeometry(1.0, 1.6, 5, 8), mat('#f7f1e3'), 0, 2.5, 0);
  add(g, new THREE.ConeGeometry(1.25, 1.4, 8), mat('#8a5a33', 0.6), 0, 5.7, 0);
  add(g, new THREE.BoxGeometry(0.6, 1.0, 0.1), mat('#8a5a33'), 0, 0.5, 1.45);
  const rotor = new THREE.Group();
  rotor.position.set(0, 4.8, 1.35);
  add(rotor, new THREE.CylinderGeometry(0.2, 0.2, 0.4, 12).rotateX(Math.PI / 2), mat('#5a4a42'), 0, 0, 0);
  for (let i = 0; i < 4; i++) {
    const blade = new THREE.Group();
    blade.rotation.z = (i / 4) * Math.PI * 2;
    add(blade, new THREE.BoxGeometry(0.12, 3.2, 0.06), mat('#8a5a33'), 0, 1.7, 0.1);
    add(blade, new THREE.BoxGeometry(0.7, 2.6, 0.03), mat('#f7f1e3', 1), 0.4, 1.9, 0.12);
    rotor.add(blade);
  }
  g.add(rotor);
  g.userData.rotor = rotor;
  return g;
}

function fenceLine(parent, x1, z1, x2, z2, rand) {
  const len = Math.hypot(x2 - x1, z2 - z1);
  const n = Math.max(1, Math.round(len / 1.6));
  const postGeo = new THREE.BoxGeometry(0.14, 0.9, 0.14);
  const wood = mat('#c9a06b');
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const p = add(parent, postGeo, wood, x1 + (x2 - x1) * t, 0.45, z1 + (z2 - z1) * t);
    p.rotation.y = (rand() - 0.5) * 0.1;
  }
  for (const y of [0.35, 0.7]) {
    const rail = add(parent, new THREE.BoxGeometry(len, 0.1, 0.06), wood, (x1 + x2) / 2, y, (z1 + z2) / 2);
    rail.rotation.y = -Math.atan2(z2 - z1, x2 - x1);
  }
}

function cloud(rand) {
  const g = new THREE.Group();
  const m = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 1, emissive: '#ffffff', emissiveIntensity: 0.25 });
  for (let i = 0; i < 5; i++) {
    const s = new THREE.Mesh(new THREE.IcosahedronGeometry(1.4 + rand() * 1.2, 1), m);
    s.position.set((i - 2) * 1.6 + rand(), rand() * 0.8, rand() * 1.2);
    g.add(s);
  }
  g.scale.set(1.4, 0.8, 1);
  return g;
}

function sky(scene) {
  const geo = new THREE.SphereGeometry(180, 32, 16);
  const material = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: { top: { value: new THREE.Color('#6fb6e8') }, bottom: { value: new THREE.Color('#e3f1f6') } },
    vertexShader: 'varying float h; void main(){ h = normalize(position).y; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: 'uniform vec3 top; uniform vec3 bottom; varying float h; void main(){ gl_FragColor = vec4(mix(bottom, top, smoothstep(0.0, 0.5, h)), 1.0); }',
  });
  scene.add(new THREE.Mesh(geo, material));
}

// Hügel erst außerhalb des Spielfelds; innen ist alles flach
function heightAt(x, z) {
  const dx = Math.max(0, Math.abs(x) - (FENCE.x + 16));
  const dz = Math.max(0, Math.abs(z) - (FENCE.z + 12));
  const d = Math.hypot(dx, dz);
  const k = Math.min(1, d / 14);
  const n = 0.6 + 0.4 * Math.sin(x * 0.09 + 1.3) * Math.cos(z * 0.08) + 0.25 * Math.sin(x * 0.23 + z * 0.17);
  return k * k * n * 9;
}

// ---------- Landschaft ----------

export function createLandscape() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#e3f1f6');
  scene.fog = new THREE.Fog('#e3f1f6', 60, 160);
  sky(scene);
  const sun = sunLight(scene, 34);
  const rand = seeded(7);
  const animated = [];

  // Boden mit Hügeln und Grastextur
  const groundGeo = new THREE.PlaneGeometry(240, 240, 120, 120);
  groundGeo.rotateX(-Math.PI / 2);
  const pos = groundGeo.attributes.position;
  const colors = [];
  const cA = new THREE.Color('#ffffff');
  const cB = new THREE.Color('#cfe6b5');
  for (let i = 0; i < pos.count; i++) {
    const h = heightAt(pos.getX(i), pos.getZ(i));
    pos.setY(i, h);
    const c = cA.clone().lerp(cB, Math.min(1, h / 8));
    colors.push(c.r, c.g, c.b);
  }
  groundGeo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  groundGeo.computeVertexNormals();
  const grass = grassTexture().clone();
  grass.repeat.set(36, 36);
  grass.needsUpdate = true;
  const ground = new THREE.Mesh(groundGeo, new THREE.MeshStandardMaterial({ map: grass, color: '#d3e3c0', vertexColors: true, roughness: 1 }));
  ground.receiveShadow = true;
  scene.add(ground);

  // Zaun um das Spielfeld
  const fence = new THREE.Group();
  fenceLine(fence, -FENCE.x, -FENCE.z, FENCE.x, -FENCE.z, rand);
  fenceLine(fence, -FENCE.x, FENCE.z, FENCE.x, FENCE.z, rand);
  fenceLine(fence, -FENCE.x, -FENCE.z, -FENCE.x, FENCE.z, rand);
  fenceLine(fence, FENCE.x, -FENCE.z, FENCE.x, FENCE.z, rand);
  scene.add(fence);

  // Teich mit Schilf und Enten (links)
  const pond = new THREE.Group();
  pond.position.set(-FENCE.x - 9, 0, 6);
  const water = add(pond, new THREE.CircleGeometry(5, 40), new THREE.MeshStandardMaterial({ map: waterTexture(), roughness: 0.1, metalness: 0.1 }), 0, 0.06, 0, false);
  water.rotation.x = -Math.PI / 2;
  water.scale.set(1.3, 1, 1);
  const rim = add(pond, new THREE.RingGeometry(5, 5.8, 40), mat('#d9c9a0'), 0, 0.04, 0, false);
  rim.rotation.x = -Math.PI / 2;
  rim.scale.set(1.3, 1, 1);
  for (let i = 0; i < 14; i++) {
    const a = rand() * Math.PI * 2;
    add(pond, new THREE.CylinderGeometry(0.04, 0.05, 1.2, 5), mat('#6b8f3e'), Math.cos(a) * 6.3, 0.6, Math.sin(a) * 4.8);
    add(pond, new THREE.CapsuleGeometry(0.08, 0.3, 4, 8), mat('#7a4b2a'), Math.cos(a) * 6.3, 1.3, Math.sin(a) * 4.8);
  }
  scene.add(pond);
  for (let i = 0; i < 3; i++) {
    const duck = buildFigure('ente');
    duck.scale.setScalar(1.6);
    scene.add(duck);
    animated.push({ kind: 'swim', obj: duck, center: pond.position, r: 2 + i * 1.1, speed: 0.25 + i * 0.07, phase: i * 2 });
  }

  // Bauernhof mit Weide (rechts)
  const farm = barn();
  farm.position.set(FENCE.x + 10, 0, -9);
  farm.rotation.y = -0.5;
  scene.add(farm);
  const pasture = { x: FENCE.x + 8, z: 8, w: 5, d: 5 };
  fenceLine(scene, pasture.x - pasture.w, pasture.z - pasture.d, pasture.x + pasture.w, pasture.z - pasture.d, rand);
  fenceLine(scene, pasture.x - pasture.w, pasture.z + pasture.d, pasture.x + pasture.w, pasture.z + pasture.d, rand);
  fenceLine(scene, pasture.x - pasture.w, pasture.z - pasture.d, pasture.x - pasture.w, pasture.z + pasture.d, rand);
  fenceLine(scene, pasture.x + pasture.w, pasture.z - pasture.d, pasture.x + pasture.w, pasture.z + pasture.d, rand);
  const tappable = [];
  for (const id of ['kuh', 'kuh', 'schaf', 'schaf', 'schwein']) {
    const a = buildFigure(id);
    a.scale.setScalar(1.8);
    a.position.set(pasture.x + (rand() - 0.5) * 6, 0, pasture.z + (rand() - 0.5) * 6);
    scene.add(a);
    animated.push({ kind: 'graze', obj: a, area: pasture, target: a.position.clone(), wait: rand() * 3 });
    tappable.push(a);
  }

  // Windmühle (links hinten) und Dorf (hinten)
  const mill = windmill();
  mill.position.set(-FENCE.x - 7, 0, -12);
  mill.rotation.y = 0.5;
  scene.add(mill);
  animated.push({ kind: 'spin', obj: mill.userData.rotor });
  for (let i = 0; i < 6; i++) {
    const h = house(rand, i % 3 === 0);
    h.position.set(-16 + i * 6.5 + rand() * 2, 0, -FENCE.z - 6 - rand() * 3);
    h.rotation.y = (rand() - 0.5) * 0.5;
    scene.add(h);
  }

  // Wald auf den Hügeln
  for (let i = 0; i < 110; i++) {
    const a = rand() * Math.PI * 2;
    const r = 48 + rand() * 45;
    const x = Math.cos(a) * r * 1.2;
    const z = Math.sin(a) * r * 0.9;
    const t = tree(rand() > 0.5 ? 'tanne' : 'rund', rand);
    t.position.set(x, heightAt(x, z) - 0.1, z);
    t.scale.multiplyScalar(1.6);
    scene.add(t);
  }

  // Bäume und Büsche auf dem Spielfeld (verschwinden, wo Schienen liegen)
  const scenery = [];
  for (let i = 0; i < 46; i++) {
    const x = (rand() * 2 - 1) * (FENCE.x + 6);
    const z = (rand() * 2 - 1) * (FENCE.z + 4);
    if (Math.hypot(x - pond.position.x, (z - pond.position.z) * 1.2) < 8) continue;
    if (Math.abs(x - farm.position.x) < 7 && Math.abs(z - farm.position.z) < 6) continue;
    if (Math.abs(x - pasture.x) < 7 && Math.abs(z - pasture.z) < 7) continue;
    const kinds = ['rund', 'tanne', 'birke', 'apfel'];
    const obj = rand() > 0.9 ? house(rand) : tree(kinds[Math.floor(rand() * kinds.length)], rand);
    obj.position.set(x, 0, z);
    obj.rotation.y = rand() * Math.PI * 2;
    obj.userData.baseScale = obj.scale.x;
    scene.add(obj);
    scenery.push(obj);
    tappable.push(obj);
  }

  // Blumen und Grasbüschel (viele, deshalb als Instanzen)
  const flowerCount = 900;
  const flowers = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.12, 0), new THREE.MeshStandardMaterial({ roughness: 0.8 }), flowerCount);
  const tuftCount = 1600;
  const tufts = new THREE.InstancedMesh(new THREE.ConeGeometry(0.1, 0.45, 4), mat('#5d9e48', 1), tuftCount);
  const flowerColors = ['#ffffff', '#f5c53a', '#f08bb4', '#b58ad6', '#e5484d'].map((c) => new THREE.Color(c));
  const props = [];
  const m4 = new THREE.Matrix4();
  const place = (list, count, y, scaleMin, scaleRange) => {
    for (let i = 0; i < count; i++) {
      const x = (rand() * 2 - 1) * (FENCE.x + 10);
      const z = (rand() * 2 - 1) * (FENCE.z + 8);
      list.push({ x, z, y, s: scaleMin + rand() * scaleRange, r: rand() * Math.PI });
    }
  };
  const flowerData = [];
  const tuftData = [];
  place(flowerData, flowerCount, 0.12, 0.7, 0.8);
  place(tuftData, tuftCount, 0.2, 0.6, 1.0);
  flowerData.forEach((_, i) => flowers.setColorAt(i, flowerColors[i % flowerColors.length]));
  flowers.receiveShadow = true;
  tufts.receiveShadow = true;
  scene.add(flowers, tufts);
  props.push({ mesh: flowers, data: flowerData }, { mesh: tufts, data: tuftData });

  // Wolken
  for (let i = 0; i < 12; i++) {
    const c = cloud(rand);
    c.position.set((rand() - 0.5) * 160, 26 + rand() * 10, -40 - rand() * 60);
    scene.add(c);
    animated.push({ kind: 'cloud', obj: c, speed: 0.4 + rand() * 0.5 });
  }

  const track = new Track();
  scene.add(track.group);

  const trainAnchor = new THREE.Group();
  trainAnchor.position.y = RAIL_TOP;
  scene.add(trainAnchor);

  // Alles, was im Weg der Schienen steht, verschwindet
  function clearAroundTrack() {
    for (const o of scenery) {
      const r = o.userData.kind === 'house' ? 2.8 : 2.0;
      o.visible = track.distanceTo(o.position.x, o.position.z) > r;
    }
    for (const { mesh, data } of props) {
      data.forEach((d, i) => {
        const s = track.distanceTo(d.x, d.z) > 1.3 ? d.s : 0;
        m4.makeRotationY(d.r).scale(new THREE.Vector3(s, s, s)).setPosition(d.x, d.y * s, d.z);
        mesh.setMatrixAt(i, m4);
      });
      mesh.instanceMatrix.needsUpdate = true;
    }
  }

  // Tiere grasen, Enten schwimmen, Windmühle dreht sich, Wolken ziehen
  const tmp = new THREE.Vector3();
  function animate(dt, time) {
    for (const a of animated) {
      if (a.kind === 'spin') a.obj.rotation.z -= dt * 0.6;
      else if (a.kind === 'cloud') {
        a.obj.position.x += a.speed * dt;
        if (a.obj.position.x > 90) a.obj.position.x = -90;
      } else if (a.kind === 'swim') {
        const ang = time * a.speed + a.phase;
        a.obj.position.set(a.center.x + Math.cos(ang) * a.r * 1.2, 0.05 + Math.sin(time * 3 + a.phase) * 0.03, a.center.z + Math.sin(ang) * a.r * 0.8);
        a.obj.rotation.y = Math.atan2(-Math.cos(ang) * 0.8, -Math.sin(ang) * 1.2);
      } else if (a.kind === 'graze') {
        if (a.wait > 0) {
          a.wait -= dt;
          continue;
        }
        tmp.copy(a.target).sub(a.obj.position);
        const d = tmp.length();
        if (d < 0.1) {
          a.wait = 2 + Math.random() * 5;
          a.target.set(a.area.x + (Math.random() - 0.5) * (a.area.w * 2 - 2), 0, a.area.z + (Math.random() - 0.5) * (a.area.d * 2 - 2));
          continue;
        }
        const step = Math.min(d, dt * 0.6);
        a.obj.position.addScaledVector(tmp.normalize(), step);
        const want = Math.atan2(-tmp.z, tmp.x);
        let diff = want - a.obj.rotation.y;
        diff = Math.atan2(Math.sin(diff), Math.cos(diff));
        a.obj.rotation.y += diff * Math.min(1, dt * 3);
        a.obj.position.y = Math.abs(Math.sin(time * 6)) * 0.05;
      }
    }
  }

  return { scene, sun, track, trainAnchor, scenery, tappable, clearAroundTrack, animate };
}
