// Die zwei Schauplätze: Werkstatt (Zug bauen) und Landschaft (malen und fahren).

import * as THREE from 'three';
import { RoundedBoxGeometry } from '../../vendor/RoundedBoxGeometry.js';
import { Track, RAIL_TOP } from './track.js';
import { buildFigure } from './figures.js';
import { TrackObjects } from './trackObjects.js';
import { Crossings } from './crossings.js';
import { createFeatures } from './features.js';
import { lamp } from './lamps.js';
import { mergeStatic, ProxyInstancer } from './merge.js';
import { decorateWorkshop } from './workshopDeco.js';
import { Ambient } from './ambient.js';
import { woodTexture, waterTexture } from './textures.js';
import { paintGround, groundMaterial } from './groundPaint.js';
import {
  LAYOUT, zonePaint, cropProps, church, well, hayBale, tractor, bench, lantern, contactShadow, tuftGeometry, flowerGeometries, colored,
  gableRoof, gableFill, marketStall, slide, swingFrame, sandbox, hedge, mailbox, bakeryExtras, bunting, laundry, doghouse, fireStation,
} from './zones.js';

// Spielfeld, auf dem gemalt werden kann (halbe Breite / halbe Tiefe)
export const WORLD_BOUNDS = { x: 78, z: 50 }; // groß, damit lange Strecken mit vielen Bahnhöfen Platz haben
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
  const hemi = new THREE.HemisphereLight('#fff7ea', '#8fa877', 1.3);
  scene.add(hemi);
  scene.userData.hemi = hemi;
  const sun = new THREE.DirectionalLight('#fff4e0', 2.6);
  sun.position.set(12, 24, 14);
  sun.castShadow = true;
  sun.shadow.mapSize.set(mapSize, mapSize);
  const c = sun.shadow.camera;
  c.left = c.bottom = -size;
  c.right = c.top = size;
  c.near = 1;
  c.far = 90;
  sun.shadow.bias = -0.0005;
  sun.shadow.normalBias = 0.05;
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

  decorateWorkshop(scene);

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

// Laub: Eckfarben machen es unten/innen dunkler (wirkt plastisch, ohne teure Nachbearbeitung)
// Jahreszeiten-Farben je Laub-Grundfarbe (Frühling frisch, Herbst bunt, Winter bereift)
const SEASON_LEAF = {
  '#5fae5a': { fruehling: '#7cc95e', herbst: '#e8902e', winter: '#c9d6cc' },
  '#4f9a4f': { fruehling: '#6bbf5a', herbst: '#d0582a', winter: '#bfcfc4' },
  '#76b95e': { fruehling: '#93d46a', herbst: '#f2c23a', winter: '#d2ddd2' },
  '#3f8a4a': { fruehling: '#5aaa52', herbst: '#b8462a', winter: '#b9cabe' },
  '#86c25a': { fruehling: '#9ed66a', herbst: '#e8b23a', winter: '#d6e0d4' },
};
const leafMats = new Map();
function leafMat(color, tag = '') {
  const key = color + tag;
  if (!leafMats.has(key)) {
    const m = new THREE.MeshStandardMaterial({ color, roughness: 0.85, vertexColors: true });
    const sc = { sommer: color, ...(SEASON_LEAF[color] ?? {}) };
    if (tag === 'tanne') Object.assign(sc, { fruehling: color, herbst: color, winter: color }); // Tannen bleiben grün
    if (tag === 'apfel') Object.assign(sc, { fruehling: ['#f7c3d6', '#fbe3ec', '#f4b0c8'][leafMats.size % 3] }); // Apfelblüte
    m.userData.seasonColors = sc;
    leafMats.set(key, m);
  }
  return leafMats.get(key);
}
const leafGeo = new Map();
function leaf(key, make) {
  if (!leafGeo.has(key)) leafGeo.set(key, colored(make(), '#ffffff', 0.62));
  return leafGeo.get(key);
}
const GREENS = ['#5fae5a', '#4f9a4f', '#76b95e', '#3f8a4a', '#86c25a'];
const appleMat = new THREE.MeshStandardMaterial({ color: '#e5484d', roughness: 0.4 });
appleMat.userData.seasonColors = { fruehling: '#ffffff', sommer: '#e5484d', herbst: '#e5484d', winter: '#e5484d' };

export function tree(kind, rand) {
  const g = new THREE.Group();
  const trunkColor = kind === 'birke' ? '#ece8df' : '#8a5a33';
  add(g, new THREE.CylinderGeometry(0.13, 0.2, 1, 8), mat(trunkColor), 0, 0.5, 0);
  if (kind === 'birke') {
    for (const y of [0.3, 0.55, 0.8]) add(g, new THREE.BoxGeometry(0.1, 0.04, 0.3), mat('#3a3a3a'), 0, y, 0, false);
  }
  const leafM = leafMat(GREENS[Math.floor(rand() * GREENS.length)], kind === 'apfel' ? 'apfel' : '');
  if (kind === 'tanne') {
    const dark = leafMat(rand() > 0.5 ? '#3f8a4a' : '#4a9450', 'tanne');
    for (let i = 0; i < 3; i++) add(g, leaf(`t${i}`, () => new THREE.ConeGeometry(0.95 - i * 0.24, 1.15, 9)), dark, 0, 1.2 + i * 0.62, 0);
  } else {
    add(g, leaf('r0', () => new THREE.SphereGeometry(0.88, 11, 8)), leafM, 0, 1.65, 0);
    add(g, leaf('r1', () => new THREE.SphereGeometry(0.62, 9, 6)), leafM, 0.48, 1.38, 0.22);
    add(g, leaf('r2', () => new THREE.SphereGeometry(0.56, 9, 6)), leafM, -0.42, 1.48, -0.22);
    add(g, leaf('r3', () => new THREE.SphereGeometry(0.5, 9, 6)), leafM, 0.05, 2.15, 0.1);
    if (kind === 'apfel') {
      const apple = new THREE.SphereGeometry(0.1, 8, 6);
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2 + rand() * 0.4;
        const y = 1.3 + rand() * 0.8;
        add(g, apple, appleMat, Math.cos(a) * 0.86, y, Math.sin(a) * 0.86, false);
      }
    }
  }
  g.add(contactShadow(kind === 'tanne' ? 1.15 : 1.3));
  g.scale.setScalar(0.85 + rand() * 0.5);
  g.userData.kind = 'tree';
  return g;
}

// Busch: niedrig und rund, manchmal mit Beeren
function bush(rand) {
  const g = new THREE.Group();
  const leafM = leafMat(GREENS[Math.floor(rand() * GREENS.length)]);
  add(g, leaf('b0', () => new THREE.SphereGeometry(0.55, 9, 6)), leafM, 0, 0.42, 0);
  add(g, leaf('b1', () => new THREE.SphereGeometry(0.42, 8, 6)), leafM, 0.45, 0.32, 0.15);
  add(g, leaf('b2', () => new THREE.SphereGeometry(0.4, 8, 6)), leafM, -0.42, 0.3, -0.1);
  if (rand() < 0.4) {
    const berry = new THREE.SphereGeometry(0.06, 6, 4);
    const col = rand() < 0.5 ? '#e5484d' : '#8b5bb5';
    for (let i = 0; i < 7; i++) {
      const a = rand() * Math.PI * 2;
      add(g, berry, mat(col, 0.4), Math.cos(a) * 0.55, 0.35 + rand() * 0.35, Math.sin(a) * 0.5, false);
    }
  }
  g.add(contactShadow(0.95, 0.32));
  g.scale.setScalar(0.8 + rand() * 0.5);
  g.userData.kind = 'tree';
  g.userData.clearR = 1.4;
  return g;
}

const windowMat = lamp(new THREE.MeshStandardMaterial({ color: '#9fc6e6', emissive: '#ffcf70', roughness: 0.2 }), 0, 1.3);

function house(rand, big = false) {
  const g = new THREE.Group();
  const walls = ['#f2c7a5', '#f7f1e3', '#d8e6f0', '#f5d98b', '#f0c9c9', '#cfe5c4'];
  const roofs = ['#c8453a', '#d9663b', '#4f6d8a', '#8b5bb5', '#3f8a6a'];
  const w = big ? 2.6 : 1.9;
  const d = 1.6;
  const wallM = mat(walls[Math.floor(rand() * walls.length)]);
  add(g, new RoundedBoxGeometry(w, 1.4, d, 2, 0.06), wallM, 0, 0.7, 0);
  add(g, gableFill(w, d, 0.95), wallM, 0, 1.4, 0);
  add(g, gableRoof(w, d, 0.95), mat(roofs[Math.floor(rand() * roofs.length)], 0.55), 0, 1.38, 0);
  add(g, new RoundedBoxGeometry(0.3, 0.7, 0.3, 2, 0.04), mat('#b07a5a'), w * 0.26, 2.0, -0.28);
  // Tür mit Stufe und Klinke
  add(g, new RoundedBoxGeometry(0.46, 0.76, 0.08, 2, 0.03), mat(rand() > 0.5 ? '#8a5a33' : '#3b7cc9', 0.6), 0, 0.4, d / 2 + 0.01);
  add(g, new THREE.SphereGeometry(0.035, 6, 4), mat('#f2c832', 0.3), 0.14, 0.4, d / 2 + 0.06, false);
  add(g, new THREE.BoxGeometry(0.62, 0.08, 0.22), mat('#b9b1a3'), 0, 0.04, d / 2 + 0.1, false);
  const box = ['#e5484d', '#f08bb4', '#f5c53a', '#b58ad6'][Math.floor(rand() * 4)];
  for (const x of [-w * 0.3, w * 0.3]) {
    add(g, new THREE.BoxGeometry(0.5, 0.46, 0.05), mat('#ffffff', 0.6), x, 0.92, d / 2 + 0.005, false);
    add(g, new THREE.BoxGeometry(0.4, 0.36, 0.05), windowMat, x, 0.92, d / 2 + 0.02, false);
    // Blumenkasten
    add(g, new THREE.BoxGeometry(0.48, 0.1, 0.14), mat('#8a5a33'), x, 0.66, d / 2 + 0.08, false);
    add(g, new THREE.BoxGeometry(0.44, 0.08, 0.1), mat(box, 0.6), x, 0.74, d / 2 + 0.08, false);
  }
  const cs = contactShadow(1, 0.32);
  cs.scale.set(w * 0.75, 1, 1.25);
  g.add(cs);
  g.userData.kind = 'house';
  return g;
}

function barn() {
  const g = new THREE.Group();
  const red = mat('#c8453a');
  add(g, new RoundedBoxGeometry(4.5, 3, 3.5, 2, 0.08), red, 0, 1.5, 0);
  // First quer (über die Breite), Tor vorne
  const rg = new THREE.Group();
  rg.rotation.y = Math.PI / 2;
  rg.position.y = 2.98;
  add(rg, gableFill(3.5, 4.5, 1.9), red, 0, 0, 0);
  add(rg, gableRoof(3.5, 4.5, 1.9, 0.3), mat('#5a4a42', 0.6), 0, -0.02, 0);
  g.add(rg);
  add(g, new THREE.BoxGeometry(1.8, 2.1, 0.1), mat('#f7f1e3'), 0, 1.05, 1.76);
  add(g, new THREE.BoxGeometry(1.55, 1.9, 0.12), mat('#a33a31'), 0, 0.95, 1.77);
  for (const r of [0.8, -0.8]) add(g, new THREE.BoxGeometry(0.1, 2.3, 0.13), mat('#f7f1e3'), 0, 0.95, 1.78).rotation.z = r;
  add(g, new THREE.CylinderGeometry(0.35, 0.35, 0.08, 16).rotateX(Math.PI / 2), mat('#f7f1e3'), 0, 3.6, 1.77);
  // Silo
  add(g, new THREE.CylinderGeometry(0.9, 0.9, 5, 20), mat('#d9d4c8', 0.5), 3.2, 2.5, -0.4);
  for (const y of [1.2, 2.5, 3.8]) add(g, new THREE.CylinderGeometry(0.92, 0.92, 0.08, 20), mat('#b9b1a3', 0.5), 3.2, y, -0.4, false);
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
  const geo = new THREE.SphereGeometry(420, 32, 16);
  const material = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: { top: { value: new THREE.Color('#6fb6e8') }, bottom: { value: new THREE.Color('#e3f1f6') } },
    vertexShader: 'varying float h; void main(){ h = normalize(position).y; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: 'uniform vec3 top; uniform vec3 bottom; varying float h; void main(){ gl_FragColor = vec4(mix(bottom, top, smoothstep(0.0, 0.5, h)), 1.0); }',
  });
  scene.add(new THREE.Mesh(geo, material));
  return material;
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
  const skyMat = sky(scene);
  const sun = sunLight(scene, 34);
  const rand = seeded(7);
  const animated = [];

  // Boden mit Hügeln und Grastextur
  const groundGeo = new THREE.PlaneGeometry(520, 520, 130, 130);
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
  // Fluss, Landstraße und Berge (fest in der Landschaft)
  const features = createFeatures(scene);

  // Gemalter Boden: Wiesenflecken, Feldwege, Dorfplatz, Felder (+ feine Halm-Struktur)
  // Der Boden wird beim Tiefentest leicht nach hinten geschoben, damit Fluss, Straße und Schotter
  // nie mit ihm „kämpfen“ (sonst flackert es oder Teile verschwinden – besonders auf Tablets).
  const ground = new THREE.Mesh(groundGeo, groundMaterial(paintGround(zonePaint(), features), { polygonOffset: true, polygonOffsetFactor: 4, polygonOffsetUnits: 4 }));
  ground.receiveShadow = true;
  scene.add(ground);

  // Zaun um das Spielfeld
  const fence = new THREE.Group();
  fenceLine(fence, -FENCE.x, -FENCE.z, FENCE.x, -FENCE.z, rand);
  fenceLine(fence, -FENCE.x, FENCE.z, FENCE.x, FENCE.z, rand);
  fenceLine(fence, -FENCE.x, -FENCE.z, -FENCE.x, FENCE.z, rand);
  fenceLine(fence, FENCE.x, -FENCE.z, FENCE.x, FENCE.z, rand);
  scene.add(fence);

  // Dorfteich mit Schilf, Seerosen, Steg und Enten (östlich vom Dorf, nah an der Strecke)
  const POND = { x: 27, z: 36 };
  const pond = new THREE.Group();
  pond.position.set(POND.x, 0, POND.z);
  const water = add(pond, new THREE.CircleGeometry(2.6, 40), new THREE.MeshStandardMaterial({ map: waterTexture(), roughness: 0.1, metalness: 0.1 }), 0, 0.06, 0, false);
  water.rotation.x = -Math.PI / 2;
  water.scale.set(1.3, 1, 1);
  const rim = add(pond, new THREE.RingGeometry(2.6, 3.1, 40), mat('#d9c9a0'), 0, 0.04, 0, false);
  rim.rotation.x = -Math.PI / 2;
  rim.scale.set(1.3, 1, 1);
  for (let i = 0; i < 10; i++) {
    const a = 3.6 + (i / 10) * 2.4 + rand() * 0.2; // Schilf nur auf der hinteren Seite
    add(pond, new THREE.CylinderGeometry(0.04, 0.05, 1.0, 5), mat('#6b8f3e'), Math.cos(a) * 3.6, 0.5, Math.sin(a) * 2.75);
    add(pond, new THREE.CapsuleGeometry(0.07, 0.25, 4, 8), mat('#7a4b2a'), Math.cos(a) * 3.6, 1.1, Math.sin(a) * 2.75);
  }
  for (const [x, z] of [[-1.6, 0.8], [1.2, 1.1], [0.4, -1.3], [-0.5, 1.6]]) add(pond, new THREE.CylinderGeometry(0.3, 0.3, 0.02, 14), mat('#4f9a45', 0.6), x, 0.08, z, false);
  add(pond, new THREE.SphereGeometry(0.09, 10, 8), mat('#f7a8c8', 0.5), 1.2, 0.13, 1.1, false);
  // Steg
  const jetty = add(pond, new THREE.BoxGeometry(0.8, 0.08, 2.0), mat('#b98553'), 2.7, 0.22, 0.6);
  jetty.rotation.y = -0.5;
  for (const [x, z] of [[2.4, 1.3], [3.0, 1.0], [2.4, -0.1], [3.0, -0.4]]) add(pond, new THREE.CylinderGeometry(0.06, 0.06, 0.4, 6), mat('#8a5a33'), x, 0.1, z);
  scene.add(pond);
  const pondDucks = [];
  for (let i = 0; i < 3; i++) {
    const duck = buildFigure('ente');
    duck.scale.setScalar(1.5);
    scene.add(duck);
    animated.push({ kind: 'swim', obj: duck, center: pond.position, r: 0.9 + i * 0.55, speed: 0.3 + i * 0.07, phase: i * 2 });
    pondDucks.push(duck);
  }

  // Bauernhof mit Weide (rechts)
  const farm = barn();
  farm.position.set(FENCE.x + 14, 0, -2);
  farm.rotation.y = -0.5;
  scene.add(farm);
  farm.userData.tap = 'barn';
  farm.userData.door = 2.4;
  const pasture = { x: FENCE.x + 8, z: 8, w: 5, d: 5 };
  fenceLine(scene, pasture.x - pasture.w, pasture.z - pasture.d, pasture.x + pasture.w, pasture.z - pasture.d, rand);
  fenceLine(scene, pasture.x - pasture.w, pasture.z + pasture.d, pasture.x + pasture.w, pasture.z + pasture.d, rand);
  fenceLine(scene, pasture.x - pasture.w, pasture.z - pasture.d, pasture.x - pasture.w, pasture.z + pasture.d, rand);
  fenceLine(scene, pasture.x + pasture.w, pasture.z - pasture.d, pasture.x + pasture.w, pasture.z + pasture.d, rand);
  const tappable = [...pondDucks];
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
  mill.position.set(-FENCE.x - 5, 0, 15);
  mill.rotation.y = 0.5;
  scene.add(mill);
  animated.push({ kind: 'spin', obj: mill.userData.rotor });
  mill.userData.tap = 'mill';
  tappable.push(farm, mill);
  for (let i = 0; i < 6; i++) {
    const h = house(rand, i % 3 === 0);
    h.position.set(-16 + i * 6.5 + rand() * 2, 0, -FENCE.z - 6 - rand() * 3);
    h.rotation.y = (rand() - 0.5) * 0.5;
    scene.add(h);
  }

  // Wald auf den Hügeln
  for (let i = 0; i < 220; i++) {
    const a = rand() * Math.PI * 2;
    const r = 105 + rand() * 75;
    const x = Math.cos(a) * r * 1.2;
    const z = Math.sin(a) * r * 0.9;
    if (features.blocked(x, z, 2)) continue;
    const t = tree(rand() > 0.5 ? 'tanne' : 'rund', rand);
    t.position.set(x, heightAt(x, z) - 0.1, z);
    t.scale.multiplyScalar(1.6);
    scene.add(t);
  }

  // ---- Gestaltete Bereiche auf dem Spielfeld (verschwinden, wo Schienen liegen) ----
  const scenery = [];
  const free = (x, z, pad = 2) => !features.blocked(x, z, pad);
  const put = (obj, x, z, rotY = 0) => {
    obj.position.set(x, 0, z);
    obj.rotation.y = rotY;
    obj.userData.baseScale = obj.scale.x;
    scene.add(obj);
    scenery.push(obj);
    tappable.push(obj);
    return obj;
  };
  const occupied = [[POND.x, POND.z, 4.2]]; // [x, z, r]: hier keine Einzelbäume oder Blumen
  const isFree = (x, z, r) => occupied.every(([ox, oz, or]) => Math.hypot(ox - x, oz - z) > or + r);

  // Dorf: Häuser im Kreis um den Platz (zum Platz gedreht), Kirche, Brunnen, Bänke, Laternen, Dorflinde
  const V = LAYOUT.village;
  const chimneys = [];
  let churchObj = null;
  const villageHouses = [];
  occupied.push([V.x, V.z, 13]);
  put(well(), V.x, V.z).userData.tap = 'well';
  const ring = [[-150, 9], [-118, 9.5], [-62, 9.2], [-28, 9], [8, 9.4], [150, 9], [118, 9.5]];
  ring.forEach(([deg, r], i) => {
    const a = THREE.MathUtils.degToRad(deg);
    const x = V.x + Math.cos(a) * r;
    const z = V.z + Math.sin(a) * r * 0.85;
    if (!free(x, z, 1.5)) return;
    const big = i % 3 === 1;
    const h = house(rand, big);
    h.scale.setScalar(1.05);
    if (i === 4) h.add(bakeryExtras(big ? 2.6 : 1.9, 1.6)); // Bäckerei
    h.userData.tap = 'house';
    // Haustür (lokal +z) zeigt zum Platz
    put(h, x, z, Math.atan2(V.x - x, V.z - z));
    villageHouses.push({ obj: h, w: big ? 2.6 : 1.9, i });
    if (i % 2 === 0) {
      h.updateMatrixWorld(true);
      chimneys.push({ obj: h, pos: new THREE.Vector3((big ? 2.6 : 1.9) * 0.26, 2.4, -0.28).applyMatrix4(h.matrixWorld), phase: rand() });
    }
  });
  {
    const x = V.x + 7;
    const z = V.z + 7.2;
    if (free(x, z, 2)) {
      churchObj = put(church(), x, z, -0.25);
      churchObj.userData.tap = 'church';
    }
  }
  {
    const linde = tree('rund', rand);
    linde.scale.setScalar(1.35);
    put(linde, V.x - 3.2, V.z - 2.6);
  }
  for (const [dx, dz, ry] of [[2.6, -3.4, 0.2], [-3.6, 2.8, 2.4]]) put(bench(), V.x + dx, V.z + dz, ry);
  // Marktstand am Platz (Theke zum Platz hin)
  {
    const x = V.x + 2.6;
    const z = V.z + 2.7;
    put(marketStall(), x, z, Math.atan2(V.x - x, V.z - z)).userData.tap = 'market';
  }
  // Gärten: Hecken hinter den Häusern, Briefkästen davor
  ring.forEach(([deg, r], i) => {
    const a = THREE.MathUtils.degToRad(deg);
    const hx = V.x + Math.cos(a) * (r + 2.3);
    const hz = V.z + Math.sin(a) * (r + 2.3) * 0.85;
    if (i % 2 === 0 && free(hx, hz, 1)) put(hedge(3.2), hx, hz, -Math.atan2(Math.cos(a) * 0.85, -Math.sin(a)));
    const mx = V.x + Math.cos(a + 0.2) * (r - 1.8);
    const mz = V.z + Math.sin(a + 0.2) * (r - 1.8) * 0.85;
    if (i % 3 === 0 && free(mx, mz, 0.5)) put(mailbox(), mx, mz, Math.atan2(V.x - mx, V.z - mz)).userData.tap = 'mailbox';
  });
  // Wimpelketten zwischen den Laternen über dem Platz
  {
    const L = [[4.6, 0.6], [0.4, 4.4], [-4.6, -0.6]].map(([dx, dz]) => [V.x + dx, V.z + dz]);
    for (const [[x1, z1], [x2, z2]] of [[L[0], L[1]], [L[1], L[2]]]) {
      const len = Math.hypot(x2 - x1, z2 - z1);
      put(bunting(len, 2.5), x1, z1, -Math.atan2(z2 - z1, x2 - x1)).userData.baseScale = 1;
    }
  }
  // Wäscheleine im Garten, Hundehütte
  let dogAt = null;
  {
    const [deg1, r1] = ring[1];
    const a1 = THREE.MathUtils.degToRad(deg1);
    const lx = V.x + Math.cos(a1) * (r1 + 3.6);
    const lz = V.z + Math.sin(a1) * (r1 + 3.6) * 0.85;
    if (free(lx, lz, 1)) put(laundry(), lx, lz, -a1 + Math.PI / 2);
    const [deg5, r5] = ring[5];
    const a5 = THREE.MathUtils.degToRad(deg5);
    const dx = V.x + Math.cos(a5 + 0.25) * (r5 + 1.2);
    const dz = V.z + Math.sin(a5 + 0.25) * (r5 + 1.2) * 0.85;
    if (free(dx, dz, 1)) {
      const dh = put(doghouse(), dx, dz, Math.atan2(V.x - dx, V.z - dz));
      dogAt = { obj: dh, x: dx + (V.x - dx) * 0.12, z: dz + (V.z - dz) * 0.12 };
    }
  }

  // Spielplatz westlich vom Dorf: Rutsche, Schaukel, Sandkasten
  const P = { x: V.x - 13, z: V.z - 1 };
  occupied.push([P.x, P.z, 4.5]);
  let swingFrameObj = null;
  if (free(P.x, P.z, 3)) {
    put(slide(), P.x - 0.5, P.z - 2.2, 0.3);
    swingFrameObj = put(swingFrame(), P.x + 0.3, P.z + 1.9, -0.15);
    put(sandbox(), P.x + 2.8, P.z - 0.4, 0.2);
  }
  for (const [dx, dz] of [[4.6, 0.6], [-4.6, -0.6], [0.4, 4.4]]) put(lantern(), V.x + dx, V.z + dz);

  // Feuerwache neben dem Dorfbahnhof (Tor zur Strecke hin, man sieht sie vom Zug aus)
  const fireObj = put(fireStation(), 28, 23.6, 0);
  fireObj.userData.tap = 'fire';
  occupied.push([27, 24.5, 4.5]);

  // Bauernhof: Scheune mit Silo, Heuballen, Traktor
  const F = LAYOUT.farm;
  occupied.push([F.x, F.z, 10]);
  const fb = barn();
  fb.scale.setScalar(0.72);
  fb.userData.kind = 'house';
  fb.userData.clearR = 4.2;
  const fbs = contactShadow(1, 0.3);
  fbs.scale.set(3.6, 1, 2.8);
  fb.add(fbs);
  put(fb, F.x - 1, F.z - 4.8, 0.12);
  fb.userData.tap = 'barn';
  fb.userData.door = 2.4;
  for (const [dx, dz] of [[4.5, -2.5], [5.3, -0.8], [4.8, 2.4]]) put(hayBale(rand), F.x + dx, F.z + dz, rand() * 3).userData.tap = 'hay';
  put(tractor(), F.x - 3.6, F.z + 2.4, 0.6).userData.tap = 'tractor';
  // Hühner und ein Hahn laufen auf dem Hof herum
  const yardAnimals = [];
  for (const id of ['huhn', 'huhn', 'hahn', 'huhn']) {
    const a = buildFigure(id);
    a.scale.setScalar(1.5);
    a.position.set(F.x + (rand() - 0.5) * 4, 0, F.z + (rand() - 0.5) * 3);
    scene.add(a);
    animated.push({ kind: 'graze', obj: a, area: { x: F.x + 0.5, z: F.z + 0.5, w: 3.2, d: 2.4 }, target: a.position.clone(), wait: rand() * 2, quick: true });
    tappable.push(a);
    yardAnimals.push(a);
  }

  // Kleine Weide neben dem Hof mit grasenden Tieren
  const paddockArea = { x: F.x + 10, z: F.z + 0.5, w: 3.2, d: 2.6 }; // nah an der Strecke: man sieht die Tiere vom Zug aus
  const paddock = new THREE.Group();
  {
    const { w, d } = paddockArea;
    fenceLine(paddock, -w, -d, w, -d, rand);
    fenceLine(paddock, -w, d, w, d, rand);
    fenceLine(paddock, -w, -d, -w, d, rand);
    fenceLine(paddock, w, -d, w, d, rand);
  }
  paddock.userData.kind = 'house';
  paddock.userData.clearR = 4.6;
  put(paddock, paddockArea.x, paddockArea.z);
  occupied.push([paddockArea.x, paddockArea.z, 5]);
  const farmAnimals = [];
  for (const id of ['kuh', 'schwein', 'schaf']) {
    const a = buildFigure(id);
    a.scale.setScalar(1.7);
    a.position.set(paddockArea.x + (rand() - 0.5) * 3, 0, paddockArea.z + (rand() - 0.5) * 2);
    scene.add(a);
    animated.push({ kind: 'graze', obj: a, area: { ...paddockArea, w: paddockArea.w - 0.6, d: paddockArea.d - 0.6 }, target: a.position.clone(), wait: rand() * 3 });
    tappable.push(a);
    farmAnimals.push(a);
  }

  // Felder (die Pflanzen kommen als Instanzen weiter unten)
  for (const f of LAYOUT.fields) occupied.push([f.x, f.z, Math.max(f.w, f.d) / 2 + 1]);

  // Waldstücke: dichte Gruppen, innen Tannen, außen Laubbäume
  for (const w of LAYOUT.forests) {
    occupied.push([w.x, w.z, w.r + 1]);
    for (let i = 0; i < w.n; i++) {
      const a = rand() * Math.PI * 2;
      const rr = Math.sqrt(rand()) * w.r;
      const x = w.x + Math.cos(a) * rr;
      const z = w.z + Math.sin(a) * rr * 0.85;
      if (!free(x, z, 1.2)) continue;
      const inner = rr < w.r * 0.55;
      const t = tree(inner ? 'tanne' : rand() > 0.3 ? 'rund' : 'birke', rand);
      t.scale.multiplyScalar(inner ? 1.25 : 1.05);
      put(t, x, z, rand() * Math.PI * 2);
    }
  }

  // Obstwiese: Apfelbäume in Reihen
  const O = LAYOUT.orchard;
  occupied.push([O.x, O.z, 8]);
  for (let i = 0; i < O.cols; i++) {
    for (let j = 0; j < O.rows; j++) {
      const x = O.x + (i - (O.cols - 1) / 2) * O.gap + (rand() - 0.5) * 0.4;
      const z = O.z + (j - (O.rows - 1) / 2) * O.gap + (rand() - 0.5) * 0.4;
      if (free(x, z, 1.5)) put(tree('apfel', rand), x, z, rand() * Math.PI * 2);
    }
  }

  // Kleine Baumgruppen (3–5 Bäume) und Büsche – füllen freie Wiesen, ohne unruhig zu wirken
  for (let i = 0; i < 40; i++) {
    const cx = (rand() * 2 - 1) * (FENCE.x - 5);
    const cz = (rand() * 2 - 1) * (FENCE.z - 5);
    if (!free(cx, cz, 4) || !isFree(cx, cz, 5)) continue;
    occupied.push([cx, cz, 4.5]);
    const n = 2 + Math.floor(rand() * 3);
    const kind = rand() < 0.5 ? 'rund' : rand() < 0.5 ? 'tanne' : 'birke';
    for (let k = 0; k < n; k++) {
      const x = cx + (rand() - 0.5) * 4.5;
      const z = cz + (rand() - 0.5) * 4.0;
      if (free(x, z, 1.5)) put(tree(rand() < 0.75 ? kind : 'rund', rand), x, z, rand() * Math.PI * 2);
    }
    for (let k = 0; k < 2; k++) {
      const x = cx + (rand() - 0.5) * 6;
      const z = cz + (rand() - 0.5) * 6;
      if (free(x, z, 1)) put(bush(rand), x, z, rand() * Math.PI * 2);
    }
  }
  for (let i = 0; i < 60; i++) {
    const x = (rand() * 2 - 1) * (FENCE.x - 2);
    const z = (rand() * 2 - 1) * (FENCE.z - 2);
    if (!free(x, z, 1.5) || !isFree(x, z, 1.5)) continue;
    put(bush(rand), x, z, rand() * Math.PI * 2);
    occupied.push([x, z, 1.5]);
  }

  // Ein paar einzelne Bäume verteilt (nicht zu viele: Ruhe im Bild)
  for (let i = 0; i < 70; i++) {
    const x = (rand() * 2 - 1) * (FENCE.x - 2);
    const z = (rand() * 2 - 1) * (FENCE.z - 2);
    if (!free(x, z, 2.5) || !isFree(x, z, 3)) continue;
    const k = rand();
    put(tree(k < 0.45 ? 'rund' : k < 0.7 ? 'tanne' : k < 0.85 ? 'birke' : 'apfel', rand), x, z, rand() * Math.PI * 2);
    occupied.push([x, z, 2.5]);
  }

  // Blumen in Gruppen (Blumenwiesen) – als Instanzen
  const fg = flowerGeometries();
  const flowerData = [];
  const flowerColors = ['#ffffff', '#f5c53a', '#f08bb4', '#b58ad6', '#e5484d', '#7fb2f0'].map((c) => new THREE.Color(c));
  const flowerTint = [];
  const cluster = (cx, cz, rad, n, colorIdx) => {
    for (let i = 0; i < n; i++) {
      const a = rand() * Math.PI * 2;
      const rr = Math.sqrt(rand()) * rad;
      const x = cx + Math.cos(a) * rr;
      const z = cz + Math.sin(a) * rr;
      if (features.blocked(x, z, 0.4)) continue;
      flowerData.push({ x, z, y: 0, s: 0.9 + rand() * 0.6, r: rand() * Math.PI * 2 });
      flowerTint.push(flowerColors[rand() < 0.93 ? colorIdx : Math.floor(rand() * flowerColors.length)]);
    }
  };
  const anyColor = () => Math.floor(rand() * flowerColors.length);
  for (const [x, z, r] of LAYOUT.meadows) {
    for (let k = 0; k < 5; k++) cluster(x + (rand() - 0.5) * r * 1.2, z + (rand() - 0.5) * r * 1.2, r * 0.4, Math.round(r * 9), anyColor());
  }
  for (let i = 0; i < 90; i++) {
    const x = (rand() * 2 - 1) * (FENCE.x + 8);
    const z = (rand() * 2 - 1) * (FENCE.z + 6);
    if (isFree(x, z, 1)) cluster(x, z, 0.8 + rand() * 0.9, 8 + Math.floor(rand() * 10), anyColor());
  }
  for (const [deg] of ring) {
    const a = THREE.MathUtils.degToRad(deg);
    cluster(V.x + Math.cos(a) * 6.6, V.z + Math.sin(a) * 6.6 * 0.85, 0.8, 7, anyColor()); // Vorgärten
  }
  const petals = new THREE.InstancedMesh(fg.petals, new THREE.MeshStandardMaterial({ roughness: 0.7, vertexColors: true, side: THREE.DoubleSide }), flowerData.length);
  const centers = new THREE.InstancedMesh(fg.center, new THREE.MeshStandardMaterial({ roughness: 0.7, vertexColors: true, side: THREE.DoubleSide }), flowerData.length);
  flowerTint.forEach((c, i) => petals.setColorAt(i, c));
  petals.receiveShadow = centers.receiveShadow = true;

  // Grasbüschel: an Ufern, Straßenrand, Zaun, um Bäume und Felder; dazu locker verteilt
  const tuftData = [];
  const tuftAt = (x, z, sc = 1) => {
    if (features.blocked(x, z, 0.2)) return;
    tuftData.push({ x, z, y: 0, s: (0.7 + rand() * 0.7) * sc, r: rand() * Math.PI });
  };
  for (const [pts, off] of [[features.riverS.pts, features.riverWidth / 2 + 1.6], [features.roadS.pts, features.roadWidth / 2 + 1.0]]) {
    for (let i = 1; i < pts.length - 1; i++) {
      const { x, z } = pts[i];
      const dx = pts[i + 1].x - pts[i - 1].x;
      const dz = pts[i + 1].z - pts[i - 1].z;
      const L = Math.hypot(dx, dz) || 1;
      for (const sd of [1, -1]) {
        if (rand() < 0.45) continue;
        const o = off + rand() * 1.2;
        tuftAt(x + (-dz / L) * o * sd, z + (dx / L) * o * sd, 1.1);
      }
    }
  }
  for (const o of scenery) for (let k = 0; k < 4; k++) tuftAt(o.position.x + (rand() - 0.5) * 3.2, o.position.z + (rand() - 0.5) * 3.2);
  for (const f of LAYOUT.fields) {
    for (let k = 0; k < 24; k++) {
      const a = rand() * Math.PI * 2;
      tuftAt(f.x + Math.cos(a) * (f.w / 2 + 0.9), f.z + Math.sin(a) * (f.d / 2 + 0.9));
    }
  }
  for (const [x1, z1, x2, z2] of [[-FENCE.x, -FENCE.z, FENCE.x, -FENCE.z], [-FENCE.x, FENCE.z, FENCE.x, FENCE.z], [-FENCE.x, -FENCE.z, -FENCE.x, FENCE.z], [FENCE.x, -FENCE.z, FENCE.x, FENCE.z]]) {
    const L = Math.hypot(x2 - x1, z2 - z1);
    for (let d = 0; d < L; d += 0.9) {
      const t = d / L;
      tuftAt(x1 + (x2 - x1) * t + (rand() - 0.5) * 1.2, z1 + (z2 - z1) * t + (rand() - 0.5) * 1.2, 1.2);
    }
  }
  for (let i = 0; i < 1800; i++) tuftAt((rand() * 2 - 1) * (FENCE.x + 10), (rand() * 2 - 1) * (FENCE.z + 8));
  const tufts = new THREE.InstancedMesh(tuftGeometry(), new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 1, vertexColors: true }), tuftData.length);
  tufts.receiveShadow = true;

  const props = [{ mesh: petals, data: flowerData, thinnable: true }, { mesh: centers, data: flowerData, thinnable: true }, { mesh: tufts, data: tuftData, thinnable: true },
    ...cropProps(rand, (x, z) => features.blocked(x, z, 0.3))];
  for (const { mesh } of props) scene.add(mesh);
  const m4 = new THREE.Matrix4();
  const ambient = new Ambient(scene, { meadows: LAYOUT.meadows, chimneys, rand });

  // Wolken
  for (let i = 0; i < 18; i++) {
    const c = cloud(rand);
    c.position.set((rand() - 0.5) * 300, 34 + rand() * 12, -70 - rand() * 90);
    scene.add(c);
    animated.push({ kind: 'cloud', obj: c, speed: 0.4 + rand() * 0.5 });
  }

  for (const c of features.cars) tappable.push(c);

  const track = new Track();
  scene.add(track.group);
  const objects = new TrackObjects(scene, track);
  // Brücken, Tunnel, Bahnübergänge entstehen automatisch, wo die Strecke Fluss, Berg oder Straße kreuzt
  let landRef = null; // wird am Ende gesetzt (für Zusatz-Freiflächen, z. B. die Nebenstrecke)
  const crossings = new Crossings(scene, features, track);
  objects.reserved = () => crossings.zones();
  objects.blocked = (x, z) => features.blocked(x, z, 0.5);

  const trainAnchor = new THREE.Group();
  trainAnchor.position.y = RAIL_TOP;
  scene.add(trainAnchor);

  // Alles, was im Weg der Schienen (und der Bahnhöfe, Tunnel …) steht, verschwindet
  // Alles, was im Weg der Schienen (und der Bahnhöfe, Brücken …) steht, verschwindet.
  // Schnell über ein Raster: pro Zelle der Abstand zur Strecke bzw. zum nächsten belegten Bereich.
  const GRID = { x0: -110, z0: -85, w: 220, h: 170 };
  function distanceGrid(stamps) {
    const g = new Float32Array(GRID.w * GRID.h).fill(99);
    for (const [x, z, r, reach] of stamps) {
      const ci = Math.round(x - GRID.x0);
      const cj = Math.round(z - GRID.z0);
      const R = Math.ceil(r + reach);
      for (let j = Math.max(0, cj - R); j <= Math.min(GRID.h - 1, cj + R); j++) {
        for (let i = Math.max(0, ci - R); i <= Math.min(GRID.w - 1, ci + R); i++) {
          const d = Math.hypot(i + GRID.x0 - x, j + GRID.z0 - z) - r;
          const k = j * GRID.w + i;
          if (d < g[k]) g[k] = d;
        }
      }
    }
    return (px, pz) => {
      const i = Math.round(px - GRID.x0);
      const j = Math.round(pz - GRID.z0);
      if (i < 0 || j < 0 || i >= GRID.w || j >= GRID.h) return 99;
      return g[j * GRID.w + i];
    };
  }

  // Schwache Geräte: jede zweite Blume / jedes zweite Grasbüschel weglassen
  let thin = false;
  function setThin(on) {
    if (thin === on) return;
    thin = on;
    clearAroundTrack();
  }

  function clearAroundTrack() {
    const trackDist = distanceGrid(track.samples.map(([x, z]) => [x, z, 0, 4]));
    const fpDist = distanceGrid([...objects.footprints(), ...crossings.footprints(), ...(landRef?.extraFootprints ?? [])].map(([x, z, r]) => [x, z, r, 2]));
    for (const o of scenery) {
      const r = o.userData.clearR ?? (o.userData.kind === 'house' ? 2.8 : 2.0);
      o.visible = trackDist(o.position.x, o.position.z) > r && fpDist(o.position.x, o.position.z) > 1;
    }
    for (const a of farmAnimals) a.visible = paddock.visible;
    for (const a of yardAnimals) a.visible = fb.visible;
    for (const { mesh, data, thinnable } of props) {
      data.forEach((d, i) => {
        const s = trackDist(d.x, d.z) > 1.3 && fpDist(d.x, d.z) > 0 && !(thin && thinnable && i % 2) ? d.s : 0;
        m4.makeRotationY(d.r).scale(new THREE.Vector3(s, s, s)).setPosition(d.x, d.y * s, d.z);
        mesh.setMatrixAt(i, m4);
      });
      mesh.instanceMatrix.needsUpdate = true;
    }
  }

  // Tiere grasen, Enten schwimmen, Windmühle dreht sich, Wolken ziehen
  const tmp = new THREE.Vector3();
  function animate(dt, time) {
    landRef.proxies.update();
    ambient.update(dt, time);
    objects.animate(dt, time);
    crossings.animate(dt, time);
    features.updateTraffic(dt, crossings.crossings);
    for (const a of animated) {
      if (a.kind === 'spin') a.obj.rotation.z -= dt * 0.6 * (a.obj.userData.boost ?? 1);
      else if (a.kind === 'cloud') {
        a.obj.position.x += a.speed * dt;
        if (a.obj.position.x > 220) a.obj.position.x = -220;
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
          a.wait = a.quick ? 0.6 + Math.random() * 2 : 2 + Math.random() * 5;
          a.target.set(a.area.x + (Math.random() - 0.5) * (a.area.w * 2 - 2), 0, a.area.z + (Math.random() - 0.5) * (a.area.d * 2 - 2));
          continue;
        }
        const step = Math.min(d, dt * (a.quick ? 1.1 : 0.6));
        a.obj.position.addScaledVector(tmp.normalize(), step);
        const want = Math.atan2(-tmp.z, tmp.x);
        let diff = want - a.obj.rotation.y;
        diff = Math.atan2(Math.sin(diff), Math.cos(diff));
        a.obj.rotation.y += diff * Math.min(1, dt * 3);
        a.obj.position.y = Math.abs(Math.sin(time * 6)) * 0.05;
      }
    }
  }

  // Was bei Schnee weiß wird
  ground.material.userData.seasonColors = { fruehling: '#f2fff0', sommer: '#ffffff', herbst: '#f3e3bb', winter: '#e9eef0' };
  tufts.material.userData.seasonColors = { fruehling: '#ffffff', sommer: '#ffffff', herbst: '#e8d391', winter: '#d9e2da' };
  const snowables = [ground.material, tufts.material, ...leafMats.values(), appleMat];

  // ---- Leistung: unbewegliche Teile zusammenfassen, Bäume auf dem Spielfeld als Instanzen zeichnen ----
  for (const a of animated) if (a.kind === 'cloud') mergeStatic(a.obj);
  const proxies = new ProxyInstancer(scene, scenery);
  const keepSet = new Set([...scenery, ...tappable, ...animated.map((a) => a.obj), ...features.cars,
    track.group, objects.group, crossings.group, trainAnchor, ground]);
  mergeStatic(scene, (o) => keepSet.has(o) || o.isLight || o.isInstancedMesh, { cell: 90, dedupe: true });
  landRef = { proxies, scene, sun, hemi: scene.userData.hemi, sky: skyMat, snowables, track, objects, features, crossings, trainAnchor, scenery, tappable, clearAroundTrack, setThin, animate, ground, animated, ambient, church: churchObj,
    village: { center: V, plaza: V.plaza, swing: swingFrameObj, houses: villageHouses, dogAt, fire: fireObj }, extraFootprints: [] };
  return landRef;
}
