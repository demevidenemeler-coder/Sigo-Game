// Gestaltete Landschaft statt zufälliger Streuung: Dorf mit Platz und Kirche, Bauernhof mit Feldern,
// Waldstücke, Obstwiese, Blumenwiesen und Feldwege. Alles, was hier steht, verschwindet (wie bisher),
// sobald das Kind Schienen darüber malt.

import * as THREE from 'three';
import { RoundedBoxGeometry } from '../../vendor/RoundedBoxGeometry.js';
import { lamp } from './lamps.js';
import { makeGlowPool } from './beams.js';

// Lage der Bereiche (frei von Fluss, Straße, Bergen und der Start-Strecke)
export const LAYOUT = {
  village: { x: 14, z: 40, plaza: 4.6 },
  farm: { x: -42, z: 42, yard: 4.2 },
  fields: [
    { x: -63, z: 41, w: 12, d: 8, rot: 0.08, kind: 'korn' },
    { x: -22, z: 45, w: 10, d: 6, rot: -0.05, kind: 'kuerbis' },
    { x: 18, z: -43, w: 14, d: 6.5, rot: 0.04, kind: 'sonnenblume' },
    { x: -8, z: -42, w: 11, d: 7, rot: -0.06, kind: 'kohl' },
  ],
  forests: [
    { x: -68, z: -37, r: 9, n: 26 },
    { x: 71, z: -40, r: 8, n: 22 },
    { x: 72, z: 2, r: 6.5, n: 15 },
    { x: -33, z: -21, r: 6, n: 13 },
    { x: 46, z: 44, r: 6, n: 12 },
    { x: -74, z: 26, r: 5.5, n: 10 },
  ],
  orchard: { x: 50, z: -9, cols: 3, rows: 3, gap: 4.2 },
  meadows: [[-4, -27, 6], [38, -21, 5], [-50, -18, 5], [60, 22, 4.5], [-14, 32, 4], [-73, -4, 4], [33, 33, 4], [-58, 47, 3.5]],
};

export function zonePaint() {
  const v = LAYOUT.village;
  const f = LAYOUT.farm;
  return {
    plazas: [{ x: v.x, z: v.z, r: v.plaza, squash: 0.85 }, { x: f.x, z: f.z, r: f.yard, squash: 0.8 }],
    fields: LAYOUT.fields,
    paths: [
      { pts: [[v.x, v.z], [4, 45], [-10, 48], [-26, 49.5], [-36, 46], [f.x, f.z]] }, // Dorf → Hof
      { pts: [[v.x, v.z], [15.5, 33], [16.5, 27], [17, 21]], width: 2 }, // Dorf → Bahnhof → Landstraße
      { pts: [[f.x, f.z], [-52, 45], [-57, 43]], width: 1.8 }, // Hof → Kornfeld
      { pts: [[v.x, v.z], [26, 42], [36, 46], [44, 44]], width: 1.6 }, // Dorf → Wäldchen
    ],
    dark: [
      ...LAYOUT.forests.map((w) => ({ x: w.x, z: w.z, r: w.r * 1.25 })),
      { x: LAYOUT.orchard.x, z: LAYOUT.orchard.z, r: 8 },
    ],
  };
}

// ---------- kleine Helfer ----------

const matCache = new Map();
function mat(color, roughness = 0.8, extra = {}) {
  const k = color + roughness + JSON.stringify(extra);
  if (!matCache.has(k)) matCache.set(k, new THREE.MeshStandardMaterial({ color, roughness, ...extra }));
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

// Farbige Einzelteile zu einer Geometrie (mit Eckfarben) zusammenfügen – für Instanzen
export function colored(geo, hex, shade = null) {
  const g = geo.index ? geo.toNonIndexed() : geo.clone();
  const c = new THREE.Color(hex);
  const pos = g.attributes.position;
  const arr = new Float32Array(pos.count * 3);
  let minY = Infinity;
  let maxY = -Infinity;
  for (let i = 0; i < pos.count; i++) {
    minY = Math.min(minY, pos.getY(i));
    maxY = Math.max(maxY, pos.getY(i));
  }
  for (let i = 0; i < pos.count; i++) {
    // unten etwas dunkler (wirkt plastischer, wie Umgebungsschatten)
    const k = shade ? THREE.MathUtils.lerp(shade, 1, (pos.getY(i) - minY) / Math.max(1e-6, maxY - minY)) : 1;
    arr.set([c.r * k, c.g * k, c.b * k], i * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  g.deleteAttribute('uv');
  return g;
}

export function joinGeos(geos) {
  const count = geos.reduce((n, g) => n + g.attributes.position.count, 0);
  const out = new THREE.BufferGeometry();
  for (const name of ['position', 'normal', 'color']) {
    const arr = new Float32Array(count * 3);
    let off = 0;
    for (const g of geos) {
      arr.set(g.attributes[name].array, off);
      off += g.attributes[name].array.length;
    }
    out.setAttribute(name, new THREE.BufferAttribute(arr, 3));
  }
  out.computeBoundingSphere();
  return out;
}

const tr = (geo, x, y, z, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) =>
  geo.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(sx, sy, sz)));

// ---------- Pflanzen als Instanzen ----------

// Grasbüschel: mehrere schmale, leicht gebogene Halme, unten dunkler
export function tuftGeometry() {
  const parts = [];
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const blade = new THREE.ConeGeometry(0.05, 0.42 + (i % 2) * 0.12, 3, 1, true);
    tr(blade, Math.cos(a) * 0.06, 0.2, Math.sin(a) * 0.06, Math.sin(a) * 0.35, 0, -Math.cos(a) * 0.35);
    parts.push(colored(blade, i % 2 ? '#5c9e45' : '#73b552', 0.55));
  }
  return joinGeos(parts);
}

// Blüte: fünf Blütenblätter (Farbe je Instanz) und eine gelbe Mitte (eigenes Mesh)
export function flowerGeometries() {
  // flache Blütensterne (wenige Dreiecke – es sind tausende)
  const star = new THREE.Shape();
  for (let i = 0; i <= 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    const r = i % 2 ? 0.07 : 0.16;
    if (i === 0) star.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    else star.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  const petals = colored(tr(new THREE.ShapeGeometry(star), 0, 0.2, 0, -Math.PI / 2 + 0.25), '#ffffff');
  const center = colored(tr(new THREE.CircleGeometry(0.06, 6), 0, 0.215, 0, -Math.PI / 2 + 0.25), '#ffd23a');
  const stem = colored(tr(new THREE.PlaneGeometry(0.02, 0.2), 0, 0.1, 0), '#3f8a3a');
  return { petals: joinGeos([petals]), center: joinGeos([center, stem]) };
}

const CROPS = {
  // Kornbündel: viele Halme mit goldenen Ähren
  korn: () => {
    const p = [];
    for (let i = 0; i < 6; i++) {
      const a = i * 2.4;
      const x = Math.cos(a) * 0.09;
      const z = Math.sin(a) * 0.09;
      p.push(colored(tr(new THREE.CylinderGeometry(0.012, 0.015, 0.7, 3), x, 0.35, z, z * 0.8, 0, -x * 0.8), '#d9b54a'));
      p.push(colored(tr(new THREE.CapsuleGeometry(0.035, 0.12, 2, 5), x * 1.3, 0.76, z * 1.3, z * 0.8, 0, -x * 0.8), '#f0c95a', 0.85));
    }
    return joinGeos(p);
  },
  kohl: () => joinGeos([
    colored(tr(new THREE.IcosahedronGeometry(0.24, 1), 0, 0.2, 0, 0, 0, 0, 1, 0.8, 1), '#6fbf5a', 0.7),
    colored(tr(new THREE.IcosahedronGeometry(0.17, 1), 0, 0.3, 0), '#a5dd7a', 0.85),
  ]),
  kuerbis: () => joinGeos([
    colored(tr(new THREE.SphereGeometry(0.3, 12, 8), 0, 0.22, 0, 0, 0, 0, 1, 0.72, 1), '#f08a24', 0.75),
    colored(tr(new THREE.CylinderGeometry(0.03, 0.045, 0.14, 5), 0, 0.48, 0, 0.3), '#6b8f3e'),
    colored(tr(new THREE.SphereGeometry(0.12, 6, 4), 0.25, 0.06, 0.1, 0, 0, 0, 1, 0.25, 0.7), '#4f9a3f'),
  ]),
  sonnenblume: () => joinGeos([
    colored(tr(new THREE.CylinderGeometry(0.025, 0.03, 1.4, 5), 0, 0.7, 0), '#4f8f3a'),
    colored(tr(new THREE.SphereGeometry(0.12, 6, 4), 0.1, 0.6, 0, 0, 0, 0.6, 1.2, 0.25, 0.7), '#5fa548'),
    colored(tr(new THREE.CylinderGeometry(0.3, 0.3, 0.05, 12), 0, 1.45, 0.08, 1.15), '#ffcf2e'),
    colored(tr(new THREE.CylinderGeometry(0.15, 0.15, 0.07, 10), 0, 1.47, 0.11, 1.15), '#7a4b2a'),
  ]),
};

// Pflanzen-Instanzen: liefert { mesh, data } wie die Blumen in world.js (verschwinden an den Schienen)
export function cropProps(rand, blocked) {
  const out = [];
  for (const kind of Object.keys(CROPS)) {
    const fields = LAYOUT.fields.filter((f) => f.kind === kind);
    if (!fields.length) continue;
    const data = [];
    for (const f of fields) {
      const rows = Math.round(f.d / 1.4);
      const step = kind === 'kuerbis' ? 1.3 : kind === 'sonnenblume' ? 0.9 : 0.75;
      const cos = Math.cos(f.rot);
      const sin = Math.sin(f.rot);
      for (let i = 0; i < rows; i++) {
        const lz = -f.d / 2 + ((i + 0.5) / rows) * f.d;
        for (let lx = -f.w / 2 + 0.6; lx <= f.w / 2 - 0.6; lx += step) {
          if (kind === 'kuerbis' && rand() < 0.35) continue;
          const jx = lx + (rand() - 0.5) * 0.2;
          const x = f.x + jx * cos + lz * sin;
          const z = f.z - jx * sin + lz * cos;
          if (blocked(x, z)) continue;
          const sunflower = kind === 'sonnenblume';
          data.push({ x, z, y: 0, s: 0.85 + rand() * 0.35, r: sunflower ? f.rot + (rand() - 0.5) * 0.3 : rand() * Math.PI * 2 });
        }
      }
    }
    const mesh = new THREE.InstancedMesh(CROPS[kind](), mat('#ffffff', 0.75, { vertexColors: true }), data.length);
    mesh.castShadow = kind !== 'kohl';
    mesh.receiveShadow = true;
    out.push({ mesh, data });
  }
  return out;
}

// ---------- Gebäude und Dinge ----------

export function church() {
  const g = new THREE.Group();
  add(g, new RoundedBoxGeometry(3.2, 2.2, 2.2, 2, 0.06), mat('#f7f1e3'), 0, 1.1, 0);
  add(g, gableFill(3.2, 2.2, 1.3), mat('#f7f1e3'), 0, 2.2, 0);
  add(g, gableRoof(3.2, 2.2, 1.3), mat('#c8453a', 0.55), 0, 2.18, 0);
  // Turm mit Uhr und spitzem Dach
  add(g, new RoundedBoxGeometry(1.3, 4.2, 1.3, 2, 0.05), mat('#f7f1e3'), -1.9, 2.1, 0);
  add(g, new THREE.ConeGeometry(1.0, 2.0, 4), mat('#4f6d8a', 0.6), -1.9, 5.2, 0).rotation.y = Math.PI / 4;
  add(g, new THREE.CylinderGeometry(0.38, 0.38, 0.06, 20).rotateX(Math.PI / 2), mat('#ffffff', 0.5), -1.9, 3.4, 0.67);
  add(g, new THREE.BoxGeometry(0.05, 0.3, 0.04), mat('#333333'), -1.9, 3.48, 0.71);
  add(g, new THREE.BoxGeometry(0.22, 0.05, 0.04), mat('#333333'), -1.82, 3.4, 0.71);
  add(g, new THREE.SphereGeometry(0.1, 8, 6), mat('#f2c832', 0.3, { metalness: 0.6 }), -1.9, 6.25, 0);
  // Tür und runde Fenster
  add(g, new RoundedBoxGeometry(0.6, 1.0, 0.1, 2, 0.04), mat('#8a5a33'), 0.4, 0.5, 1.1);
  for (const x of [-0.6, 1.3]) add(g, new THREE.CylinderGeometry(0.22, 0.22, 0.06, 16).rotateX(Math.PI / 2), mat('#8fc3ea', 0.2), x, 1.35, 1.11);
  g.userData.kind = 'house';
  g.userData.clearR = 3.6;
  return g;
}

export function well() {
  const g = new THREE.Group();
  add(g, new THREE.CylinderGeometry(0.75, 0.8, 0.6, 16), mat('#b9b1a3', 0.9), 0, 0.3, 0);
  add(g, new THREE.CylinderGeometry(0.62, 0.62, 0.05, 16), mat('#6fb6e8', 0.15), 0, 0.56, 0);
  for (const x of [-0.65, 0.65]) add(g, new THREE.BoxGeometry(0.1, 1.4, 0.1), mat('#8a5a33'), x, 1.0, 0);
  add(g, gableRoof(1.4, 1.3, 0.6, 0.15), mat('#c8453a', 0.55), 0, 1.7, 0);
  add(g, new THREE.CylinderGeometry(0.06, 0.06, 1.3, 8).rotateZ(Math.PI / 2), mat('#8a5a33'), 0, 1.4, 0);
  add(g, new THREE.CylinderGeometry(0.13, 0.11, 0.2, 10), mat('#8a5a33'), 0.15, 1.05, 0);
  g.userData.kind = 'house';
  g.userData.clearR = 1.8;
  return g;
}

export function hayBale(rand) {
  const g = new THREE.Group();
  const b = add(g, new THREE.CylinderGeometry(0.55, 0.55, 0.9, 16).rotateZ(Math.PI / 2), mat('#e8c45a', 0.95), 0, 0.55, 0);
  b.rotation.y = rand() * Math.PI;
  add(g, new THREE.CylinderGeometry(0.4, 0.4, 0.92, 16).rotateZ(Math.PI / 2), mat('#d4a93d', 0.95), 0, 0.55, 0).rotation.y = b.rotation.y;
  g.userData.kind = 'tree';
  g.userData.clearR = 1.2;
  return g;
}

export function tractor() {
  const g = new THREE.Group();
  add(g, new RoundedBoxGeometry(1.5, 0.6, 0.9, 2, 0.1), mat('#d9463b', 0.5), 0.2, 0.75, 0);
  add(g, new RoundedBoxGeometry(0.75, 0.9, 0.9, 2, 0.08), mat('#d9463b', 0.5), -0.35, 1.25, 0);
  add(g, new RoundedBoxGeometry(0.6, 0.45, 0.92, 2, 0.04), mat('#bfe3f5', 0.2), -0.35, 1.45, 0);
  add(g, new THREE.CylinderGeometry(0.07, 0.07, 0.6, 8), mat('#333333'), 0.65, 1.3, 0.2);
  for (const z of [0.5, -0.5]) {
    add(g, new THREE.CylinderGeometry(0.55, 0.55, 0.32, 18).rotateX(Math.PI / 2), mat('#2a2a2a', 0.9), -0.45, 0.55, z);
    add(g, new THREE.CylinderGeometry(0.3, 0.3, 0.34, 14).rotateX(Math.PI / 2), mat('#f2c832', 0.5), -0.45, 0.55, z);
    add(g, new THREE.CylinderGeometry(0.32, 0.32, 0.26, 14).rotateX(Math.PI / 2), mat('#2a2a2a', 0.9), 0.75, 0.32, z);
    add(g, new THREE.CylinderGeometry(0.16, 0.16, 0.28, 12).rotateX(Math.PI / 2), mat('#f2c832', 0.5), 0.75, 0.32, z);
  }
  g.userData.kind = 'tree';
  g.userData.clearR = 1.8;
  g.userData.action = 'hupen';
  return g;
}

export function bench() {
  const g = new THREE.Group();
  add(g, new THREE.BoxGeometry(1.4, 0.08, 0.4), mat('#b98553'), 0, 0.45, 0);
  add(g, new THREE.BoxGeometry(1.4, 0.3, 0.06), mat('#b98553'), 0, 0.7, -0.2);
  for (const x of [-0.6, 0.6]) add(g, new THREE.BoxGeometry(0.08, 0.45, 0.4), mat('#5a4a42'), x, 0.22, 0);
  g.userData.kind = 'tree';
  g.userData.clearR = 1.0;
  return g;
}

// Laternenglas: tagsüber matt, nachts hell (gemeinsames Material, folgt der Tageszeit)
const lanternGlass = lamp(new THREE.MeshStandardMaterial({ color: '#fff3c4', roughness: 0.3, emissive: '#ffcf70' }), 0.2, 3.0);

export function lantern() {
  const g = new THREE.Group();
  add(g, new THREE.CylinderGeometry(0.05, 0.07, 2.2, 8), mat('#3a4a5a', 0.5), 0, 1.1, 0);
  add(g, new THREE.CylinderGeometry(0.16, 0.12, 0.35, 8), lanternGlass, 0, 2.35, 0);
  add(g, new THREE.ConeGeometry(0.24, 0.2, 8), mat('#3a4a5a', 0.5), 0, 2.62, 0);
  g.add(makeGlowPool(2.0));
  g.userData.kind = 'tree';
  g.userData.clearR = 0.8;
  return g;
}

// Kleiner weicher Kontaktschatten (dunkler Fleck am Boden) – macht, dass Dinge „stehen“ statt zu schweben
let blobTex = null;
const blobMats = new Map();
export function contactShadow(radius, strength = 0.38) {
  if (!blobTex) {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d');
    const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grd.addColorStop(0, 'rgba(0,0,0,1)');
    grd.addColorStop(0.45, 'rgba(0,0,0,0.6)');
    grd.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, 64, 64);
    blobTex = new THREE.CanvasTexture(c);
  }
  const key = strength.toFixed(2);
  if (!blobMats.has(key)) {
    blobMats.set(key, new THREE.MeshBasicMaterial({
      color: '#1d3a12', alphaMap: blobTex, transparent: true, opacity: strength, depthWrite: false,
      polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
    }));
  }
  const m = new THREE.Mesh(blobGeo, blobMats.get(key));
  m.scale.set(radius, 1, radius);
  m.position.y = 0.03;
  m.castShadow = false;
  m.receiveShadow = false;
  m.renderOrder = -1;
  m.userData.noMerge = true;
  return m;
}
const blobGeo = new THREE.PlaneGeometry(2, 2).rotateX(-Math.PI / 2);

// Satteldach: First entlang x, Dachflächen nach vorne (+z) und hinten, mit Überstand und weichen Kanten
const roofCache = new Map();
export function gableRoof(w, d, h, overhang = 0.22) {
  const key = [w, d, h, overhang].join();
  if (!roofCache.has(key)) {
    const half = d / 2 + overhang;
    const shape = new THREE.Shape();
    shape.moveTo(-half, 0);
    shape.lineTo(0, h);
    shape.lineTo(half, 0);
    shape.lineTo(half - 0.16, 0);
    shape.lineTo(0, h - 0.2);
    shape.lineTo(-half + 0.16, 0);
    shape.closePath();
    const L = w + overhang * 2;
    const geo = new THREE.ExtrudeGeometry(shape, { depth: L, bevelEnabled: true, bevelSize: 0.035, bevelThickness: 0.035, bevelSegments: 2, curveSegments: 1 });
    geo.translate(0, 0, -L / 2);
    geo.rotateY(Math.PI / 2);
    geo.computeVertexNormals();
    roofCache.set(key, geo);
  }
  return roofCache.get(key);
}

// Giebelwand (Dreieck unter dem Dach, an beiden Seiten)
const gableCache = new Map();
export function gableFill(w, d, h) {
  const key = [w, d, h].join();
  if (!gableCache.has(key)) {
    const shape = new THREE.Shape();
    shape.moveTo(-d / 2, 0);
    shape.lineTo(0, h - 0.12);
    shape.lineTo(d / 2, 0);
    shape.closePath();
    const geo = new THREE.ExtrudeGeometry(shape, { depth: w - 0.02, bevelEnabled: false });
    geo.translate(0, 0, -(w - 0.02) / 2);
    geo.rotateY(Math.PI / 2);
    gableCache.set(key, geo);
  }
  return gableCache.get(key);
}

// ---------- Dorf: Marktstand, Spielplatz, Gärten ----------

// Marktstand mit gestreiftem Dach, Obst- und Gemüsekisten
export function marketStall() {
  const g = new THREE.Group();
  const wood = mat('#b98553');
  for (const x of [-0.9, 0.9]) for (const z of [-0.45, 0.45]) add(g, new THREE.BoxGeometry(0.08, 1.7, 0.08), wood, x, 0.85, z);
  add(g, new RoundedBoxGeometry(2.0, 0.12, 1.0, 2, 0.03), wood, 0, 0.75, 0.05);
  add(g, new THREE.BoxGeometry(1.95, 0.7, 0.06), mat('#a8703f'), 0, 0.37, 0.52);
  // Streifendach
  const cols = ['#e5484d', '#ffffff'];
  for (let i = 0; i < 6; i++) {
    const s = add(g, new THREE.BoxGeometry(0.36, 0.05, 1.3), mat(cols[i % 2], 0.6), -0.9 + i * 0.36 + 0.18, 1.78, 0.1);
    s.rotation.x = 0.18;
  }
  for (let i = 0; i < 6; i++) add(g, new THREE.ConeGeometry(0.18, 0.22, 3), mat(cols[i % 2], 0.6), -0.9 + i * 0.36 + 0.18, 1.6, 0.76).rotation.x = Math.PI;
  // Kisten mit Äpfeln, Möhren, Kürbissen
  const crate = new RoundedBoxGeometry(0.55, 0.18, 0.4, 2, 0.02);
  const goods = [['#e5484d', 0.07], ['#f08a24', 0.06], ['#f2c832', 0.07]];
  goods.forEach(([c, r], i) => {
    const x = -0.62 + i * 0.62;
    add(g, crate, mat('#c99a62'), x, 0.9, 0.08);
    for (let k = 0; k < 6; k++) add(g, new THREE.SphereGeometry(r, 8, 6), mat(c, 0.45), x - 0.18 + (k % 3) * 0.18, 1.02, -0.02 + Math.floor(k / 3) * 0.16, false);
  });
  g.add(contactShadow(1.4, 0.3));
  g.userData.kind = 'house';
  g.userData.clearR = 1.8;
  return g;
}

// Rutsche
export function slide() {
  const g = new THREE.Group();
  const metal = mat('#3b7cc9', 0.4);
  for (const z of [-0.35, 0.35]) {
    add(g, new THREE.CylinderGeometry(0.05, 0.05, 1.6, 8), metal, -0.8, 0.8, z);
    add(g, new THREE.CylinderGeometry(0.05, 0.05, 1.6, 8), metal, -0.3, 0.8, z);
  }
  add(g, new RoundedBoxGeometry(0.6, 0.08, 0.8, 2, 0.03), mat('#f2c832', 0.5), -0.55, 1.55, 0);
  for (let i = 0; i < 4; i++) add(g, new THREE.BoxGeometry(0.06, 0.05, 0.7), mat('#f2c832'), -0.95, 0.3 + i * 0.38, 0);
  const chute = add(g, new RoundedBoxGeometry(1.9, 0.06, 0.6, 2, 0.03), mat('#e5484d', 0.35), 0.45, 0.85, 0);
  chute.rotation.z = -0.62;
  for (const z of [-0.3, 0.3]) {
    const rail = add(g, new THREE.BoxGeometry(1.9, 0.12, 0.05), mat('#e5484d', 0.35), 0.45, 0.93, z);
    rail.rotation.z = -0.62;
  }
  g.add(contactShadow(1.4, 0.28));
  g.userData.kind = 'tree';
  g.userData.clearR = 1.8;
  return g;
}

// Schaukelgestell (die Sitze schwingen: eigene Teile in village.js)
export function swingFrame() {
  const g = new THREE.Group();
  const wood = mat('#c99a62');
  for (const x of [-1.1, 1.1]) {
    for (const z of [-0.5, 0.5]) {
      const p = add(g, new THREE.CylinderGeometry(0.06, 0.07, 2.1, 8), wood, x, 0.98, z * 0.6);
      p.rotation.x = z > 0 ? -0.28 : 0.28;
    }
  }
  add(g, new THREE.CylinderGeometry(0.07, 0.07, 2.4, 8).rotateZ(Math.PI / 2), wood, 0, 1.98, 0);
  g.add(contactShadow(1.5, 0.25));
  g.userData.kind = 'tree';
  g.userData.clearR = 1.9;
  return g;
}

export function sandbox() {
  const g = new THREE.Group();
  const wood = mat('#b98553');
  for (const [x, z, w, d] of [[0, 0.7, 1.6, 0.14], [0, -0.7, 1.6, 0.14], [0.73, 0, 0.14, 1.3], [-0.73, 0, 0.14, 1.3]]) add(g, new THREE.BoxGeometry(w, 0.2, d), wood, x, 0.1, z);
  add(g, new THREE.BoxGeometry(1.32, 0.12, 1.26), mat('#f0dca0', 1), 0, 0.06, 0, false);
  add(g, new THREE.ConeGeometry(0.25, 0.25, 12), mat('#e8cf8c', 1), 0.2, 0.22, -0.1);
  add(g, new THREE.CylinderGeometry(0.1, 0.08, 0.14, 10), mat('#e5484d', 0.4), -0.3, 0.2, 0.2); // Eimer
  add(g, new THREE.BoxGeometry(0.06, 0.03, 0.3), mat('#3b7cc9', 0.4), -0.1, 0.15, 0.35).rotation.y = 0.5; // Schaufel
  g.userData.kind = 'tree';
  g.userData.clearR = 1.2;
  return g;
}

// Hecke (Gartenzaun aus Grün)
export function hedge(len) {
  const g = new THREE.Group();
  add(g, new RoundedBoxGeometry(len, 0.55, 0.42, 2, 0.15), mat('#4f9a4f', 0.9), 0, 0.28, 0);
  g.userData.kind = 'tree';
  g.userData.clearR = len / 2 + 0.3;
  return g;
}

export function mailbox() {
  const g = new THREE.Group();
  add(g, new THREE.CylinderGeometry(0.04, 0.04, 0.9, 6), mat('#5a4a42'), 0, 0.45, 0);
  add(g, new RoundedBoxGeometry(0.36, 0.26, 0.24, 2, 0.06), mat('#f2c832', 0.45), 0, 1.0, 0);
  add(g, new THREE.BoxGeometry(0.2, 0.03, 0.02), mat('#3a3a3a'), 0, 1.05, 0.125);
  g.userData.kind = 'tree';
  g.userData.clearR = 0.6;
  return g;
}

// Bäckerei-Schmuck (wird an ein Haus gehängt): gestreifte Markise, Brezel-Schild, Brote im Fenster
export function bakeryExtras(w, d) {
  const g = new THREE.Group();
  const cols = ['#f2c832', '#ffffff'];
  for (let i = 0; i < 6; i++) {
    const s = add(g, new THREE.BoxGeometry(w / 6, 0.04, 0.55), mat(cols[i % 2], 0.6), -w / 2 + (i + 0.5) * (w / 6), 1.25, d / 2 + 0.25);
    s.rotation.x = 0.35;
  }
  // Schild mit Brezel an einem Arm
  add(g, new THREE.BoxGeometry(0.05, 0.05, 0.5), mat('#3a3a3a'), w / 2 - 0.1, 1.55, d / 2 + 0.25);
  const pretzel = add(g, new THREE.TorusGeometry(0.16, 0.045, 8, 20), mat('#b8743a', 0.5), w / 2 - 0.1, 1.35, d / 2 + 0.45);
  pretzel.rotation.y = Math.PI / 2;
  add(g, new THREE.TorusGeometry(0.08, 0.04, 8, 16), mat('#b8743a', 0.5), w / 2 - 0.1, 1.38, d / 2 + 0.38).rotation.y = Math.PI / 2;
  add(g, new THREE.TorusGeometry(0.08, 0.04, 8, 16), mat('#b8743a', 0.5), w / 2 - 0.1, 1.38, d / 2 + 0.52).rotation.y = Math.PI / 2;
  // Brote auf dem Fensterbrett
  for (const x of [-w * 0.3, w * 0.3]) {
    for (let k = 0; k < 3; k++) add(g, new THREE.CapsuleGeometry(0.04, 0.08, 3, 8).rotateZ(Math.PI / 2), mat('#c98a45', 0.6), x - 0.12 + k * 0.12, 0.79, d / 2 + 0.1, false);
  }
  return g;
}

// Wimpelkette zwischen zwei Punkten (lokal: von (0,h,0) nach (len,h,0)), leicht durchhängend
export function bunting(len, h = 2.4) {
  const g = new THREE.Group();
  const pts = [];
  for (let i = 0; i <= 12; i++) {
    const t = i / 12;
    pts.push(new THREE.Vector3(t * len, h - Math.sin(t * Math.PI) * 0.45, 0));
  }
  const curve = new THREE.CatmullRomCurve3(pts);
  add(g, new THREE.TubeGeometry(curve, 24, 0.012, 4, false), mat('#ffffff'), 0, 0, 0, false);
  const cols = ['#e5484d', '#f2c832', '#3b7cc9', '#4fa65a', '#f08bb4', '#ee8a2b'];
  const flag = new THREE.ConeGeometry(0.13, 0.32, 3);
  const n = Math.max(4, Math.round(len / 0.45));
  for (let i = 1; i < n; i++) {
    const p = curve.getPoint(i / n);
    const f = add(g, flag, mat(cols[i % cols.length], 0.6), p.x, p.y - 0.16, p.z, false);
    f.rotation.x = Math.PI;
    f.scale.z = 0.25;
  }
  g.userData.kind = 'tree';
  g.userData.clearR = len / 2;
  return g;
}

// Wäscheleine mit bunter Wäsche
export function laundry() {
  const g = new THREE.Group();
  for (const x of [-1.1, 1.1]) add(g, new THREE.CylinderGeometry(0.04, 0.05, 1.5, 6), mat('#b98553'), x, 0.75, 0);
  add(g, new THREE.CylinderGeometry(0.01, 0.01, 2.2, 4).rotateZ(Math.PI / 2), mat('#ffffff'), 0, 1.42, 0, false);
  const items = [['#e5484d', 0.36, 0.42], ['#3b7cc9', 0.3, 0.5], ['#f2c832', 0.42, 0.34], ['#f08bb4', 0.28, 0.3]];
  items.forEach(([c, w, h], i) => add(g, new THREE.BoxGeometry(w, h, 0.02), mat(c, 0.8), -0.75 + i * 0.5, 1.42 - h / 2, 0));
  g.userData.kind = 'tree';
  g.userData.clearR = 1.4;
  return g;
}

// Hundehütte
export function doghouse() {
  const g = new THREE.Group();
  add(g, new RoundedBoxGeometry(0.8, 0.55, 0.7, 2, 0.04), mat('#c94a3a'), 0, 0.28, 0);
  add(g, gableRoof(0.8, 0.7, 0.35, 0.08), mat('#5a4a42', 0.6), 0, 0.55, 0);
  add(g, gableFill(0.8, 0.7, 0.35), mat('#c94a3a'), 0, 0.56, 0);
  add(g, new THREE.CircleGeometry(0.17, 14), mat('#2a1d14', 1), 0, 0.24, 0.355);
  add(g, new THREE.TorusGeometry(0.1, 0.03, 6, 12), mat('#c9ccd1', 0.4), 0.3, 0.03, 0.55).rotation.x = Math.PI / 2; // Napf
  g.userData.kind = 'tree';
  g.userData.clearR = 1.0;
  return g;
}

// ---------- Feuerwehr ----------

// Feuerwache: rote Halle mit großem Tor (vorne = +z), Schlauchturm mit Blaulicht, Vorplatz.
// Das Rolltor und das Feuerwehrauto baut village.js als eigene, bewegliche Teile.
export const FIRE = { w: 4.4, d: 3.2, h: 2.7, door: { x: 0.35, w: 2.5, h: 2.1 } };
const fireBlue = lamp(new THREE.MeshStandardMaterial({ color: '#4d8dff', emissive: '#2f6bff', roughness: 0.3 }), 0.3, 2.5);
export function fireStation() {
  const g = new THREE.Group();
  const { w, d, h, door } = FIRE;
  const red = mat('#d23c32', 0.6);
  const white = mat('#f7f1e3', 0.6);
  // Halle: Wände um die Toröffnung herum
  add(g, new RoundedBoxGeometry(w, h, d - 0.2, 2, 0.05), red, 0, h / 2, -0.1);
  add(g, new THREE.BoxGeometry(door.w + 0.1, door.h + 0.05, 0.3), mat('#2a2522', 0.9), door.x, door.h / 2, d / 2 - 0.25, false); // dunkles Inneres
  // Rahmen ums Tor, Zierband, Dach
  add(g, new THREE.BoxGeometry(door.w + 0.4, 0.18, 0.12), white, door.x, door.h + 0.09, d / 2 - 0.05);
  for (const s of [-1, 1]) add(g, new THREE.BoxGeometry(0.18, door.h, 0.12), white, door.x + s * (door.w / 2 + 0.11), door.h / 2, d / 2 - 0.05);
  add(g, new THREE.BoxGeometry(w + 0.04, 0.14, d - 0.16), white, 0, h - 0.07, -0.1);
  add(g, gableRoof(w, d, 0.75), mat('#4a4f5a', 0.6), 0, h, -0.1);
  add(g, gableFill(w, d - 0.2, 0.75), red, 0, h, -0.1);
  // Wappen über dem Tor (rundes Schild mit Flamme)
  add(g, new THREE.CylinderGeometry(0.28, 0.28, 0.06, 24).rotateX(Math.PI / 2), white, door.x, h + 0.32, d / 2 - 0.1);
  add(g, new THREE.ConeGeometry(0.12, 0.3, 10), mat('#f08a24', 0.5), door.x, h + 0.32, d / 2 - 0.05);
  // Fenster neben dem Tor
  add(g, new THREE.BoxGeometry(0.5, 0.6, 0.06), lamp(new THREE.MeshStandardMaterial({ color: '#9fc6e6', emissive: '#ffcf70', roughness: 0.2 }), 0, 1.2), -1.65, 1.5, d / 2 - 0.17);
  // Schlauchturm links mit Fenstern, Spitzdach und Blaulicht
  const tx = -w / 2 - 0.55;
  add(g, new RoundedBoxGeometry(1.2, 4.6, 1.2, 2, 0.05), red, tx, 2.3, -0.4);
  for (const y of [1.6, 2.6, 3.6]) add(g, new THREE.BoxGeometry(0.34, 0.44, 0.06), mat('#233345', 0.2), tx, y, 0.22);
  add(g, new THREE.BoxGeometry(1.3, 0.12, 1.3), white, tx, 4.62, -0.4);
  add(g, new THREE.ConeGeometry(0.95, 0.8, 4).rotateY(Math.PI / 4), mat('#4a4f5a', 0.6), tx, 5.08, -0.4);
  add(g, new THREE.SphereGeometry(0.16, 12, 8), fireBlue, tx, 5.55, -0.4);
  // Vorplatz
  add(g, new THREE.BoxGeometry(w + 0.4, 0.04, 2.4), mat('#b8b2a6', 0.95), door.x * 0.5, 0.02, d / 2 + 1.2, false);
  for (const s of [-1, 1]) add(g, new THREE.BoxGeometry(0.08, 0.02, 2.2), mat('#f2c832', 0.6), door.x + s * (door.w / 2 + 0.15), 0.045, d / 2 + 1.2, false);
  g.userData.kind = 'house';
  g.userData.clearR = 3.2;
  return g;
}

// Feuerwehrauto (fährt nach +z). userData: ladder (Pivot hinten), lights (Blaulichter), tip (Leiterspitze, lokal)
export function fireTruck() {
  const g = new THREE.Group();
  const red = new THREE.MeshPhysicalMaterial({ color: '#e0322b', roughness: 0.35, clearcoat: 0.8 });
  const white = mat('#f7f1e3', 0.5);
  const dark = mat('#2a2a2a', 0.8);
  const metal = mat('#c3beb5', 0.35, { metalness: 0.7 });
  add(g, new RoundedBoxGeometry(1.2, 0.25, 2.6, 2, 0.05), dark, 0, 0.38, 0); // Fahrgestell
  add(g, new RoundedBoxGeometry(1.25, 0.85, 1.75, 2, 0.08), red, 0, 0.92, -0.35); // Aufbau
  add(g, new RoundedBoxGeometry(1.25, 0.5, 0.8, 2, 0.1), red, 0, 0.75, 0.9); // Fahrerhaus unten
  add(g, new RoundedBoxGeometry(1.25, 0.1, 0.8, 2, 0.04), red, 0, 1.42, 0.9); // Dach
  add(g, new THREE.BoxGeometry(1.2, 0.5, 0.06), red, 0, 1.15, 0.53); // Rückwand
  const glass = new THREE.MeshStandardMaterial({ color: '#bfe3f5', roughness: 0.1, transparent: true, opacity: 0.35, depthWrite: false });
  add(g, new RoundedBoxGeometry(1.1, 0.4, 0.05, 2, 0.02), glass, 0, 1.2, 1.31, false); // Frontscheibe
  for (const s of [-1, 1]) add(g, new RoundedBoxGeometry(0.05, 0.35, 0.5, 2, 0.02), glass, s * 0.63, 1.2, 0.95, false);
  for (const s of [-1, 1]) add(g, new THREE.BoxGeometry(0.02, 0.1, 1.7), white, s * 0.635, 0.75, -0.35); // weiße Streifen
  for (const s of [-1, 1]) for (let i = 0; i < 3; i++) add(g, new THREE.BoxGeometry(0.02, 0.5, 0.02), mat('#b02a24', 0.5), s * 0.635, 1.0, -1.05 + i * 0.45); // Rollläden
  for (const s of [-1, 1]) add(g, new THREE.SphereGeometry(0.07, 10, 8), mat('#fff6d8', 0.3, { emissive: '#ffd36b', emissiveIntensity: 0.6 }), s * 0.42, 0.75, 1.31);
  add(g, new THREE.BoxGeometry(1.0, 0.12, 0.06), metal, 0, 0.48, 1.32); // Stoßstange
  // Räder
  for (const z of [0.85, -0.85]) for (const s of [-1, 1]) {
    add(g, new THREE.CylinderGeometry(0.28, 0.28, 0.22, 16).rotateZ(Math.PI / 2), dark, s * 0.58, 0.28, z);
    add(g, new THREE.CylinderGeometry(0.13, 0.13, 0.24, 12).rotateZ(Math.PI / 2), metal, s * 0.58, 0.28, z);
  }
  // Blaulichter auf dem Fahrerhaus
  const lights = [];
  for (const s of [-1, 1]) {
    const m = new THREE.MeshStandardMaterial({ color: '#3d7bff', emissive: '#2f6bff', emissiveIntensity: 0.3, roughness: 0.3 });
    lights.push(add(g, new THREE.SphereGeometry(0.1, 12, 8), m, s * 0.35, 1.5, 0.95));
  }
  // Drehkranz mit Leiter (Pivot hinten oben), liegt flach nach vorne
  const turn = new THREE.Group();
  turn.position.set(0, 1.42, -1.1);
  g.add(turn);
  const ladder = new THREE.Group();
  add(ladder, new THREE.CylinderGeometry(0.16, 0.18, 0.16, 14), metal, 0, -0.04, 0);
  for (const s of [-1, 1]) add(ladder, new THREE.BoxGeometry(0.05, 0.06, 2.3), metal, s * 0.2, 0.06, 1.1);
  for (let i = 0; i < 8; i++) add(ladder, new THREE.BoxGeometry(0.4, 0.03, 0.03), metal, 0, 0.06, 0.1 + i * 0.29);
  add(ladder, new THREE.BoxGeometry(0.5, 0.25, 0.3), red, 0, 0.12, 2.25); // Korb
  turn.add(ladder);
  g.userData.turn = turn;
  g.userData.ladder = ladder;
  g.userData.lights = lights;
  g.userData.tip = new THREE.Vector3(0, 0.3, 2.35); // in Leiter-Koordinaten
  return g;
}
