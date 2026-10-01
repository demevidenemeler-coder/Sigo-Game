// Dinge an der Strecke: Bahnhof, Tunnel, Brücke, Waschanlage, Tankstelle, Bahnübergang.
// Jedes Objekt sitzt an einer Stelle s der Strecke und dreht sich mit ihr.
// Lokale Koordinaten: x = entlang der Schienen, z = seitlich (Gleismitte bei z = 0).

import * as THREE from 'three';
import { RoundedBoxGeometry } from '../../vendor/RoundedBoxGeometry.js';
import { TRACK_OBJECTS } from '../catalog.js';
import { buildFigure } from './figures.js';
import { woodTexture, waterTexture } from './textures.js';
import { lamp } from './lamps.js';

const def = (type) => TRACK_OBJECTS.find((o) => o.id === type);

const matCache = new Map();
function mat(color, roughness = 0.7, metalness = 0) {
  const k = `${color}${roughness}${metalness}`;
  if (!matCache.has(k)) matCache.set(k, new THREE.MeshStandardMaterial({ color, roughness, metalness }));
  return matCache.get(k);
}

function add(parent, geometry, material, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geometry, material);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}

// Satteldach: Dreieck quer, First entlang x
function gableRoof(width, height, length) {
  const sh = new THREE.Shape();
  sh.moveTo(-width / 2, 0);
  sh.lineTo(width / 2, 0);
  sh.lineTo(0, height);
  sh.lineTo(-width / 2, 0);
  const geo = new THREE.ExtrudeGeometry(sh, { depth: length, bevelEnabled: false });
  geo.translate(0, 0, -length / 2);
  geo.rotateY(Math.PI / 2);
  return geo;
}

const rbox = (w, h, d, r = 0.06) => new RoundedBoxGeometry(w, h, d, 2, Math.min(r, w / 2, h / 2, d / 2));

function lampPost(parent, x, z, h = 2.2) {
  add(parent, new THREE.CylinderGeometry(0.05, 0.07, h, 8), mat('#3a3a3a', 0.4, 0.5), x, h / 2, z);
  const bulbMat = lamp(new THREE.MeshStandardMaterial({ color: '#fff6d8', emissive: '#ffd36b' }), 0.5, 3);
  add(parent, new THREE.SphereGeometry(0.16, 14, 10), bulbMat, x, h + 0.1, z);
  add(parent, new THREE.ConeGeometry(0.22, 0.18, 12), mat('#3a3a3a', 0.4, 0.5), x, h + 0.3, z);
}

// Schild mit Text (für Eltern lesbar; Kinder sehen das Zug-Symbol)
function signTexture(text, bg = '#2f5c9e') {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = bg;
  g.fillRect(0, 0, 512, 128);
  g.strokeStyle = '#ffffff';
  g.lineWidth = 8;
  g.strokeRect(8, 8, 496, 112);
  g.fillStyle = '#ffffff';
  g.font = 'bold 64px system-ui, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, 256, 68);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// ---------- Bahnhof ----------

const STATION_NAMES = ['Sigo-Stadt', 'Waldheim', 'Seeblick'];
const WAITING = ['kind', 'oma', 'papa', 'hund', 'katze', 'teddy', 'hase', 'pinguin', 'schaf', 'ente', 'pferd', 'huhn'];

function buildBahnhof(item, index) {
  const g = item.obj;
  const len = def('bahnhof').span - 1;
  // Bahnsteig mit gelber Kante
  add(g, rbox(len, 0.45, 1.8, 0.05), mat('#cfc6b6', 0.9), 0, 0.22, 1.75);
  add(g, new THREE.BoxGeometry(len, 0.02, 0.12), mat('#f2c832'), 0, 0.455, 1.0);
  // Schmales Dach hinten am Bahnsteig (die Wartenden bleiben von oben sichtbar)
  for (const x of [-len / 2 + 0.6, 0, len / 2 - 0.6]) add(g, new THREE.CylinderGeometry(0.06, 0.06, 2.3, 8), mat('#2f5c9e', 0.4), x, 1.6, 2.6);
  const roof = add(g, rbox(len - 0.4, 0.1, 0.9, 0.04), mat('#c8453a', 0.5), 0, 2.8, 2.55);
  roof.rotation.x = -0.15;
  // Bahnhofsgebäude mit Uhr und Schild
  add(g, rbox(3.6, 2.4, 2.2, 0.08), mat('#f7eedb'), 0, 1.2, 4.0);
  add(g, gableRoof(2.6, 1.0, 4.0), mat('#8a3b31', 0.6), 0, 2.4, 4.0);
  add(g, new THREE.BoxGeometry(0.7, 1.3, 0.06), mat('#8a5a33'), 0, 0.65, 2.88);
  for (const x of [-1.15, 1.15]) {
    add(g, new THREE.BoxGeometry(0.6, 0.6, 0.06), lamp(new THREE.MeshStandardMaterial({ color: '#9fc6e6', emissive: '#ffcf70', roughness: 0.2 }), 0, 1.2), x, 1.35, 2.88);
  }
  // Bahnhofsuhr auf einer Säule
  add(g, new THREE.CylinderGeometry(0.06, 0.08, 2.0, 8), mat('#2f5c9e', 0.4), 1.6, 1.45, 2.2);
  const clock = add(g, new THREE.CylinderGeometry(0.34, 0.34, 0.12, 24), mat('#ffffff', 0.4), 1.6, 2.7, 2.2);
  clock.rotation.x = Math.PI / 2;
  add(g, new THREE.TorusGeometry(0.34, 0.04, 8, 24), mat('#2f5c9e', 0.4), 1.6, 2.7, 2.2);
  add(g, new THREE.BoxGeometry(0.03, 0.2, 0.15), mat('#222222'), 1.6, 2.78, 2.2);
  const hand2 = add(g, new THREE.BoxGeometry(0.26, 0.03, 0.15), mat('#222222'), 1.6, 2.7, 2.2);
  hand2.geometry.translate(0.12, 0, 0);
  item.parts.clockHand = hand2;
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 0.55), new THREE.MeshStandardMaterial({ map: signTexture(`🚂 ${STATION_NAMES[index % 3]}`) }));
  sign.position.set(0, 2.05, 2.92);
  sign.rotation.y = 0;
  g.add(sign);
  // Bänke und Laternen
  for (const x of [-2.4, 2.4]) {
    add(g, rbox(1.0, 0.08, 0.35, 0.03), mat('#8a5a33'), x, 0.72, 2.3);
    add(g, rbox(1.0, 0.3, 0.06, 0.03), mat('#8a5a33'), x, 0.9, 2.47);
  }
  lampPost(g, -len / 2 + 0.3, 2.45);
  lampPost(g, len / 2 - 0.3, 2.45);
  item.waiting = [];
  item.slots = [-2.6, -1.3, 0, 1.3, 2.6];
  for (let i = 0; i < 2; i++) addWaiting(item, WAITING[Math.floor(Math.random() * WAITING.length)]);
}

export function addWaiting(item, id) {
  const free = item.slots.find((x) => !item.waiting.some((w) => w.userData.slot === x));
  if (free === undefined) return null;
  const f = buildFigure(id);
  f.scale.setScalar(1.35);
  f.position.set(free, 0.45, 1.75);
  f.rotation.y = id === 'kind' || id === 'oma' || id === 'papa' || id === 'teddy' ? -Math.PI / 2 : Math.PI / 2;
  f.userData.slot = free;
  f.userData.baseY = 0.45;
  f.userData.action = 'board';
  f.userData.item = item;
  f.traverse((o) => { o.userData.owner = f; });
  item.obj.add(f);
  item.waiting.push(f);
  return f;
}

// ---------- Tunnel ----------

function buildTunnel(item) {
  const g = item.obj;
  const half = def('tunnel').span / 2;
  // Berg: unregelmäßige Kugel, oben Wiese, unten Fels
  const geo = new THREE.IcosahedronGeometry(1, 4);
  const pos = geo.attributes.position;
  const colors = [];
  const grass = new THREE.Color('#6fae55');
  const rock = new THREE.Color('#9b9488');
  for (let i = 0; i < pos.count; i++) {
    const v = new THREE.Vector3().fromBufferAttribute(pos, i);
    const n = 1 + 0.08 * Math.sin(v.x * 9) * Math.cos(v.z * 7) + 0.06 * Math.sin(v.y * 11 + v.x * 3);
    v.multiplyScalar(n);
    pos.setXYZ(i, v.x, v.y, v.z);
    const c = rock.clone().lerp(grass, THREE.MathUtils.smoothstep(v.y, 0.15, 0.5));
    colors.push(c.r, c.g, c.b);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const hill = add(g, geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: true }), 0, -0.7, 0);
  hill.scale.set(half - 0.25, 4.2, 4.2);
  // Bäumchen und Steine oben
  for (const [x, z] of [[-1.5, 0.8], [1.2, -0.9], [0.2, 1.6]]) {
    add(g, new THREE.CylinderGeometry(0.1, 0.14, 0.6, 6), mat('#8a5a33'), x, 3.55, z);
    add(g, new THREE.ConeGeometry(0.55, 1.3, 8), mat('#3f8a4a', 0.9), x, 4.3, z);
  }
  // Portale aus Stein
  for (const sx of [1, -1]) {
    const p = new THREE.Group();
    p.position.x = sx * half;
    p.rotation.y = sx > 0 ? -Math.PI / 2 : Math.PI / 2;
    const stone = mat('#b9b1a3', 0.9);
    const arch = add(p, new THREE.TorusGeometry(1.3, 0.28, 10, 24, Math.PI), stone, 0, 1.2, 0);
    arch.scale.z = 1.6;
    for (const z of [1.3, -1.3]) add(p, new THREE.BoxGeometry(0.56, 1.25, 0.6), stone, z, 0.62, 0).rotation.y = Math.PI / 2;
    add(p, new THREE.CircleGeometry(1.03, 24, 0, Math.PI), new THREE.MeshBasicMaterial({ color: '#141414' }), 0, 1.2, -0.05);
    add(p, new THREE.PlaneGeometry(2.06, 1.2), new THREE.MeshBasicMaterial({ color: '#141414' }), 0, 0.6, -0.05);
    g.add(p);
  }
}

// ---------- Brücke über einen Fluss ----------

function buildBruecke(item) {
  const g = item.obj;
  const span = def('bruecke').span;
  const water = waterTexture().clone();
  water.repeat.set(1, 8);
  water.needsUpdate = true;
  item.parts.water = water;
  const river = add(g, new THREE.PlaneGeometry(3.6, 46), new THREE.MeshStandardMaterial({ map: water, roughness: 0.1, metalness: 0.1 }), 0, 0.025, 0);
  river.rotation.x = -Math.PI / 2;
  river.receiveShadow = true;
  river.castShadow = false;
  for (const x of [2.1, -2.1]) {
    const bank = add(g, new THREE.PlaneGeometry(0.7, 46), mat('#d9c9a0', 1), x, 0.022, 0);
    bank.rotation.x = -Math.PI / 2;
    bank.castShadow = false;
  }
  // Widerlager und Brückendeck
  for (const sx of [1, -1]) add(g, rbox(1.0, 0.5, 2.6, 0.05), mat('#b9b1a3', 0.9), sx * (span / 2 - 0.5), 0.15, 0);
  add(g, rbox(span - 1.0, 0.12, 2.3, 0.03), new THREE.MeshStandardMaterial({ map: woodTexture('#9a6b42', 'deck'), roughness: 0.8 }), 0, 0.02, 0);
  // Stahlfachwerk
  const steel = mat('#c8453a', 0.45, 0.4);
  const L = span - 1.4;
  for (const z of [1.15, -1.15]) {
    add(g, new THREE.BoxGeometry(L, 0.14, 0.14), steel, 0, 0.25, z);
    add(g, new THREE.BoxGeometry(L - 1.2, 0.14, 0.14), steel, 0, 2.45, z);
    const n = 5;
    for (let i = 0; i <= n; i++) {
      const x = -L / 2 + 0.6 + (i * (L - 1.2)) / n;
      add(g, new THREE.BoxGeometry(0.12, 2.2, 0.12), steel, x, 1.35, z);
      if (i < n) {
        const dlen = Math.hypot((L - 1.2) / n, 2.2);
        const d = add(g, new THREE.BoxGeometry(0.1, dlen, 0.1), steel, x + (L - 1.2) / n / 2, 1.35, z);
        d.rotation.z = (i % 2 ? 1 : -1) * Math.atan2((L - 1.2) / n, 2.2);
      }
    }
    for (const sx of [1, -1]) {
      const e = add(g, new THREE.BoxGeometry(0.12, Math.hypot(0.6, 2.2), 0.12), steel, sx * (L / 2 - 0.3), 1.35, z);
      e.rotation.z = sx * Math.atan2(0.6, 2.2);
    }
  }
  for (let i = 0; i < 4; i++) add(g, new THREE.BoxGeometry(0.12, 0.12, 2.4), steel, -L / 2 + 0.9 + i * ((L - 1.8) / 3), 2.45, 0);
  // Fisch, der ab und zu aus dem Wasser springt
  const fish = new THREE.Group();
  add(fish, new THREE.SphereGeometry(0.2, 12, 8), mat('#f08c2b', 0.4), 0, 0, 0).scale.set(1.5, 0.8, 0.6);
  add(fish, new THREE.ConeGeometry(0.16, 0.25, 4), mat('#f08c2b', 0.4), -0.35, 0, 0).rotation.z = Math.PI / 2;
  fish.visible = false;
  g.add(fish);
  item.parts.fish = fish;
  item.parts.fishTimer = 4 + Math.random() * 6;
}

// ---------- Waschanlage ----------

function brushGeometry(r, h) {
  const geo = new THREE.CylinderGeometry(r, r, h, 24, 8);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const k = 1 + (Math.random() - 0.5) * 0.25;
    pos.setX(i, x * k);
    pos.setZ(i, z * k);
  }
  geo.computeVertexNormals();
  return geo;
}

function buildWaschanlage(item) {
  const g = item.obj;
  const frame = mat('#3b7cc9', 0.4, 0.2);
  for (const z of [1.45, -1.45]) add(g, rbox(0.5, 3.0, 0.4, 0.06), frame, 0, 1.5, z);
  add(g, rbox(0.7, 0.4, 3.4, 0.06), frame, 0, 3.1, 0);
  add(g, rbox(1.6, 0.08, 3.6, 0.04), mat('#f5f1ea', 0.5), 0, 3.35, 0);
  for (let i = 0; i < 5; i++) add(g, new THREE.SphereGeometry(0.16 + (i % 2) * 0.08, 12, 8), new THREE.MeshPhysicalMaterial({ color: '#bfe7ff', roughness: 0.1, transmission: 0.3, clearcoat: 1 }), -0.1, 3.55, -1.2 + i * 0.6);
  const brushMat = new THREE.MeshStandardMaterial({ color: '#5aa7e8', roughness: 1 });
  item.parts.brushes = [];
  for (const z of [1.05, -1.05]) {
    const b = add(g, brushGeometry(0.38, 2.2), brushMat, 0, 1.4, z);
    item.parts.brushes.push({ mesh: b, axis: 'y' });
  }
  const top = add(g, brushGeometry(0.3, 2.0), brushMat, 0, 2.7, 0);
  top.rotation.x = Math.PI / 2;
  item.parts.brushes.push({ mesh: top, axis: 'top' });
  // Seifenblasen (werden beim Waschen ausgestoßen)
  item.parts.bubbles = [];
  const bubbleMat = new THREE.MeshStandardMaterial({ color: '#ffffff', transparent: true, opacity: 0.7, roughness: 0.1 });
  for (let i = 0; i < 24; i++) {
    const b = add(g, new THREE.SphereGeometry(0.12, 10, 8), bubbleMat, 0, 0, 0);
    b.castShadow = false;
    b.visible = false;
    b.userData.life = 0;
    item.parts.bubbles.push(b);
  }
}

// ---------- Tankstelle ----------

function buildTankstelle(item) {
  const g = item.obj;
  // Wasserturm
  const tower = new THREE.Group();
  tower.position.set(-1.2, 0, 2.7);
  for (const [x, z] of [[0.6, 0.6], [-0.6, 0.6], [0.6, -0.6], [-0.6, -0.6]]) add(tower, new THREE.CylinderGeometry(0.07, 0.09, 2.4, 8), mat('#5c3b22'), x, 1.2, z);
  add(tower, new THREE.CylinderGeometry(1.0, 1.0, 1.4, 20), new THREE.MeshStandardMaterial({ map: woodTexture('#b98553', 'tower'), roughness: 0.8 }), 0, 3.1, 0);
  add(tower, new THREE.ConeGeometry(1.15, 0.7, 20), mat('#8a3b31', 0.6), 0, 4.15, 0);
  const spout = new THREE.Group();
  spout.position.set(0, 2.8, -0.9);
  add(spout, new THREE.CylinderGeometry(0.1, 0.1, 1.6, 10), mat('#3a3a3a', 0.4, 0.5), 0, 0, -0.7).rotation.x = Math.PI / 2;
  const stream = add(spout, new THREE.CylinderGeometry(0.08, 0.1, 1.6, 10), new THREE.MeshStandardMaterial({ color: '#6bb6d9', transparent: true, opacity: 0.8 }), 0, -0.8, -1.45);
  stream.visible = false;
  spout.rotation.y = 0.9;
  tower.add(spout);
  tower.userData.action = 'wasser';
  tower.traverse((o) => { o.userData.owner = tower; });
  g.add(tower);
  item.parts.spout = spout;
  item.parts.stream = stream;
  item.parts.tower = tower;
  // Kohlebunker mit Rutsche
  const bunker = new THREE.Group();
  bunker.position.set(1.2, 0, -2.6);
  add(bunker, rbox(1.8, 1.8, 1.6, 0.05), new THREE.MeshStandardMaterial({ map: woodTexture('#8a5a33', 'bunker'), roughness: 0.9 }), 0, 0.9, 0);
  const coal = mat('#25272b', 0.6, 0.2);
  for (let i = 0; i < 10; i++) add(bunker, new THREE.IcosahedronGeometry(0.2, 0), coal, (Math.random() - 0.5) * 1.3, 1.85 + Math.random() * 0.15, (Math.random() - 0.5) * 1.1);
  const chute = add(bunker, new THREE.BoxGeometry(0.6, 0.08, 1.4), mat('#6b6f75', 0.4, 0.5), 0, 1.6, 1.2);
  chute.rotation.x = 0.5;
  item.parts.coalBits = [];
  for (let i = 0; i < 10; i++) {
    const c = add(bunker, new THREE.IcosahedronGeometry(0.1, 0), coal, 0, 0, 0);
    c.visible = false;
    item.parts.coalBits.push(c);
  }
  bunker.userData.action = 'kohle';
  bunker.traverse((o) => { o.userData.owner = bunker; });
  g.add(bunker);
  item.parts.bunker = bunker;
  // Dieselzapfsäule
  const pump = new THREE.Group();
  pump.position.set(1.6, 0, 2.3);
  add(pump, rbox(0.6, 1.4, 0.45, 0.08), mat('#d9463b', 0.4), 0, 0.7, 0);
  add(pump, new THREE.BoxGeometry(0.4, 0.3, 0.02), lamp(new THREE.MeshStandardMaterial({ color: '#e8f4ff', emissive: '#9fd0ff' }), 0.4, 1.5), 0, 1.05, -0.23);
  add(pump, new THREE.TorusGeometry(0.25, 0.03, 6, 16, Math.PI), mat('#2b2b2b'), 0.32, 0.8, 0).rotation.z = -Math.PI / 2;
  pump.userData.action = 'diesel';
  pump.traverse((o) => { o.userData.owner = pump; });
  g.add(pump);
  item.parts.pump = pump;
}

// ---------- Bahnübergang ----------

const CAR_COLORS = ['#3b7cc9', '#e5484d', '#4fa65a', '#f2c832', '#8b5bb5'];

function roadCar(color) {
  const c = new THREE.Group();
  const m = new THREE.MeshPhysicalMaterial({ color, roughness: 0.3, clearcoat: 1 });
  add(c, rbox(0.9, 0.35, 1.7, 0.15), m, 0, 0.35, 0);
  add(c, rbox(0.8, 0.35, 0.9, 0.15), m, 0, 0.65, -0.1);
  add(c, new THREE.BoxGeometry(0.72, 0.25, 0.02), mat('#233345', 0.1), 0, 0.68, 0.36);
  for (const x of [0.42, -0.42]) {
    for (const z of [0.55, -0.55]) add(c, new THREE.CylinderGeometry(0.18, 0.18, 0.14, 14).rotateZ(Math.PI / 2), mat('#2a2a2a', 0.5), x, 0.18, z);
  }
  for (const x of [0.25, -0.25]) add(c, new THREE.SphereGeometry(0.07, 8, 6), lamp(new THREE.MeshStandardMaterial({ color: '#fff6d8', emissive: '#ffd36b' }), 0.3, 2.5), x, 0.4, 0.86);
  c.userData.action = 'hupen';
  c.traverse((o) => { o.userData.owner = c; });
  return c;
}

function buildUebergang(item) {
  const g = item.obj;
  const road = add(g, new THREE.PlaneGeometry(3.0, 34), mat('#6b6f75', 0.9), 0, 0.03, 0);
  road.rotation.x = -Math.PI / 2;
  road.castShadow = false;
  for (const x of [1.4, -1.4]) {
    const line = add(g, new THREE.PlaneGeometry(0.1, 34), mat('#f5f1ea', 0.8), x, 0.035, 0);
    line.rotation.x = -Math.PI / 2;
    line.castShadow = false;
  }
  for (let z = -16; z < 16; z += 2) {
    if (Math.abs(z) < 2) continue;
    const dash = add(g, new THREE.PlaneGeometry(0.1, 1.0), mat('#f5f1ea', 0.8), 0, 0.036, z);
    dash.rotation.x = -Math.PI / 2;
    dash.castShadow = false;
  }
  add(g, new THREE.BoxGeometry(3.0, 0.08, 2.0), mat('#5c3b22', 0.9), 0, 0.12, 0);
  // Andreaskreuze mit Blinklicht und Schranken
  item.parts.lights = [];
  item.parts.barriers = [];
  for (const sz of [1, -1]) {
    const post = new THREE.Group();
    post.position.set(sz * 1.9, 0, sz * 2.6);
    add(post, new THREE.CylinderGeometry(0.06, 0.06, 2.4, 8), mat('#f5f1ea', 0.5), 0, 1.2, 0);
    for (const r of [0.6, -0.6]) {
      const bar = add(post, new THREE.BoxGeometry(0.9, 0.14, 0.04), mat('#e5484d', 0.5), 0, 2.15, 0.05);
      bar.rotation.z = r;
    }
    for (const x of [0.15, -0.15]) {
      const l = add(post, new THREE.SphereGeometry(0.09, 10, 8), new THREE.MeshStandardMaterial({ color: '#5a1a14', emissive: '#ff2a1a', emissiveIntensity: 0 }), x, 1.6, 0.08);
      item.parts.lights.push(l);
    }
    g.add(post);
    // Schranke: dreht sich von senkrecht (offen) nach waagerecht (zu)
    const pivot = new THREE.Group();
    pivot.position.set(sz * 1.7, 0.9, sz * 3.4);
    add(pivot, rbox(0.3, 0.6, 0.3, 0.05), mat('#d9d4c8', 0.6), 0, -0.4, 0);
    const arm = new THREE.Group();
    for (let i = 0; i < 6; i++) add(arm, new THREE.BoxGeometry(0.5, 0.1, 0.08), mat(i % 2 ? '#ffffff' : '#e5484d', 0.5), -sz * (0.25 + i * 0.5), 0, 0);
    pivot.add(arm);
    arm.rotation.z = (-sz * Math.PI) / 2; // offen = senkrecht
    g.add(pivot);
    item.parts.barriers.push({ arm, sz });
  }
  // Autos auf der Straße
  item.parts.cars = [];
  [[0.7, 1], [-0.7, -1]].forEach(([x, dir], i) => {
    const c = roadCar(CAR_COLORS[(i * 2 + Math.floor(Math.random() * 3)) % CAR_COLORS.length]);
    c.position.set(x, 0, -dir * (6 + i * 7));
    c.rotation.y = dir > 0 ? 0 : Math.PI;
    c.userData.dir = dir;
    c.userData.speed = 2.2 + Math.random();
    g.add(c);
    item.parts.cars.push(c);
  });
  item.closed = 0;
}

const BUILDERS = {
  bahnhof: buildBahnhof,
  tunnel: buildTunnel,
  bruecke: buildBruecke,
  waschanlage: buildWaschanlage,
  tankstelle: buildTankstelle,
  uebergang: buildUebergang,
};

// Freizuhaltende Bereiche (für Bäume/Blumen), in lokalen Koordinaten: [x, z, Radius]
const FOOTPRINTS = {
  bahnhof: [[0, 2.5, 5]],
  tunnel: [[0, 0, 5.5]],
  bruecke: Array.from({ length: 13 }, (_, i) => [0, -18 + i * 3, 2.6]),
  waschanlage: [[0, 0, 3]],
  tankstelle: [[-1.2, 2.7, 2.5], [1.2, -2.6, 2.5], [1.6, 2.3, 1.5]],
  uebergang: Array.from({ length: 12 }, (_, i) => [0, -16.5 + i * 3, 2.4]),
};

// Vorschau-Modell für die Leiste (ohne Strecke)
export function buildTrackObjectPreview(type) {
  const item = { type, s: 0, obj: new THREE.Group(), parts: {} };
  BUILDERS[type](item, 0);
  return item.obj;
}

// ---------- Verwaltung ----------

export class TrackObjects {
  constructor(scene, track) {
    this.track = track;
    this.group = new THREE.Group();
    scene.add(this.group);
    this.items = [];
  }

  count(type) {
    return this.items.filter((i) => i.type === type).length;
  }

  // Liegt Stelle s frei (kein anderes Objekt überlappt)?
  isFree(s, span, except = null) {
    const L = this.track.length;
    return this.items.every((it) => {
      if (it === except) return true;
      const d = Math.abs(((s - it.s + L / 2) % L + L) % L - L / 2);
      return d > (span + def(it.type).span) / 2 + 0.5;
    });
  }

  // Nächste freie Stelle in der Nähe von s
  freeSpotNear(s, span, except = null) {
    for (let k = 0; k < 120; k++) {
      for (const sign of [1, -1]) {
        const c = s + sign * k * 0.75;
        if (this.isFree(c, span, except)) return this.track.wrap(c);
      }
    }
    return null;
  }

  add(type, x, z) {
    const d = def(type);
    if (this.count(type) >= d.max) return null;
    const near = this.track.nearestS(x, z);
    const s = this.freeSpotNear(near.s, d.span);
    if (s == null) return null;
    const item = { type, s, obj: new THREE.Group(), parts: {} };
    item.obj.userData.item = item;
    BUILDERS[type](item, this.count(type));
    item.obj.traverse((o) => { o.userData.trackItem ??= item; });
    this.group.add(item.obj);
    this.items.push(item);
    this.place(item);
    return item;
  }

  // Gute freie Stelle: möglichst weit weg von den anderen Objekten
  bestSpot(type) {
    const d = def(type);
    const L = this.track.length;
    let best = null;
    let bestScore = -1;
    for (let s = 0; s < L; s += 1.5) {
      if (!this.isFree(s, d.span)) continue;
      const score = this.items.length ? Math.min(...this.items.map((it) => Math.abs(((s - it.s + L / 2) % L + L) % L - L / 2))) : L - s;
      if (score > bestScore) {
        bestScore = score;
        best = s;
      }
    }
    if (best == null) return null;
    const f = this.track.frameAt(best);
    return { x: f.p.x, z: f.p.z };
  }

  remove(item) {
    this.group.remove(item.obj);
    this.items = this.items.filter((i) => i !== item);
  }

  moveTo(item, x, z) {
    const d = def(item.type);
    const near = this.track.nearestS(x, z);
    const s = this.freeSpotNear(near.s, d.span, item);
    if (s == null) return false;
    item.s = s;
    this.place(item);
    return true;
  }

  place(item) {
    const f = this.track.frameAt(item.s);
    item.obj.position.set(f.p.x, 0, f.p.z);
    item.obj.rotation.set(0, f.angle, 0);
    item.x = f.p.x;
    item.z = f.p.z;
  }

  // Nach dem Neumalen der Strecke: alles an die neue Strecke setzen
  resnap() {
    const old = this.items;
    this.items = [];
    for (const it of old) {
      const d = def(it.type);
      const near = this.track.nearestS(it.x, it.z);
      const s = this.freeSpotNear(near.s, d.span);
      if (s == null) {
        this.group.remove(it.obj);
        continue;
      }
      it.s = s;
      this.items.push(it);
      this.place(it);
    }
  }

  serialize() {
    return this.items.map((i) => ({ type: i.type, x: +i.x.toFixed(2), z: +i.z.toFixed(2) }));
  }

  load(list) {
    for (const o of list ?? []) this.add(o.type, o.x, o.z);
  }

  footprints() {
    const out = [];
    for (const it of this.items) {
      for (const [lx, lz, r] of FOOTPRINTS[it.type]) {
        const v = new THREE.Vector3(lx, 0, lz).applyAxisAngle(new THREE.Vector3(0, 1, 0), it.obj.rotation.y).add(it.obj.position);
        out.push([v.x, v.z, r]);
      }
    }
    return out;
  }

  // Abstand von Stelle a nach vorne bis Stelle b (immer ≥ 0)
  ahead(a, b) {
    const L = this.track.length;
    return ((b - a) % L + L) % L;
  }

  // Ständige Animationen (unabhängig vom Zug)
  animate(dt, time) {
    for (const it of this.items) {
      if (it.type === 'bahnhof') {
        it.parts.clockHand.rotation.z = -time * 0.2;
        for (const w of it.waiting) w.position.y = w.userData.baseY + Math.max(0, Math.sin(time * 2 + w.userData.slot)) * 0.03;
      } else if (it.type === 'bruecke') {
        it.parts.water.offset.y -= dt * 0.15;
        const f = it.parts.fish;
        it.parts.fishTimer -= dt;
        if (it.parts.fishTimer <= 0) {
          it.parts.fishTimer = 6 + Math.random() * 8;
          f.userData.t = 0;
          f.userData.z = (Math.random() - 0.5) * 20;
          if (Math.abs(f.userData.z) < 2.5) f.userData.z += 5;
          f.visible = true;
        }
        if (f.visible) {
          f.userData.t += dt / 1.1;
          const t = f.userData.t;
          f.position.set(-1 + t * 2, Math.sin(t * Math.PI) * 1.4 - 0.1, f.userData.z);
          f.rotation.z = Math.cos(t * Math.PI) * 0.9;
          if (t >= 1) f.visible = false;
        }
      } else if (it.type === 'waschanlage') {
        const speed = it.washing ? 14 : 1;
        for (const b of it.parts.brushes) {
          if (b.axis === 'y') b.mesh.rotation.y += dt * speed;
          else b.mesh.rotation.y += dt * speed;
        }
        for (const b of it.parts.bubbles) {
          if (b.userData.life <= 0) continue;
          b.userData.life -= dt / 1.6;
          b.position.addScaledVector(b.userData.v, dt);
          b.scale.setScalar(0.6 + (1 - b.userData.life));
          if (b.userData.life <= 0) b.visible = false;
        }
        if (it.washing && Math.random() < dt * 20) {
          const b = it.parts.bubbles.find((x) => x.userData.life <= 0);
          if (b) {
            b.visible = true;
            b.userData.life = 1;
            b.position.set((Math.random() - 0.5) * 1.2, 0.8 + Math.random() * 2, (Math.random() - 0.5) * 2.2);
            b.userData.v = new THREE.Vector3((Math.random() - 0.5) * 2, 0.8 + Math.random(), (Math.random() - 0.5) * 2);
          }
        }
      } else if (it.type === 'uebergang') {
        this.animateCrossing(it, dt, time);
      }
    }
  }

  animateCrossing(it, dt, time) {
    const closed = it.closed > 0;
    // Schranken senken/heben
    for (const b of it.parts.barriers) {
      const target = closed ? 0 : (-b.sz * Math.PI) / 2;
      b.arm.rotation.z += (target - b.arm.rotation.z) * Math.min(1, dt * 3);
    }
    const blink = closed && Math.sin(time * 9) > 0;
    it.parts.lights.forEach((l, i) => { l.material.emissiveIntensity = closed ? ((i % 2 === 0) === blink ? 2.5 : 0) : 0; });
    // Autos fahren, halten vor geschlossener Schranke
    for (const c of it.parts.cars) {
      const dir = c.userData.dir;
      let z = c.position.z + dir * c.userData.speed * dt;
      const stopLine = -dir * 4.4;
      const before = dir > 0 ? c.position.z <= stopLine : c.position.z >= stopLine;
      if (closed && before) z = dir > 0 ? Math.min(z, stopLine) : Math.max(z, stopLine);
      // nicht auf das vordere Auto auffahren
      for (const o of it.parts.cars) {
        if (o !== c && o.userData.dir === dir) {
          const gap = (o.position.z - z) * dir;
          if (gap > 0 && gap < 2.4) z = o.position.z - dir * 2.4;
        }
      }
      c.position.z = z;
      if (Math.abs(z) > 16) c.position.z = -dir * 16;
    }
  }
}
