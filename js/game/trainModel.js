// 3D-Modelle im Spielzeug-Stil, nur aus einfachen Formen gebaut (keine Modelldateien nötig).
// Koordinaten eines Wagens: vorne = +x, Seite = z, oben = y. y = 0 ist die Schienenoberkante.

import * as THREE from 'three';
import { RoundedBoxGeometry } from '../../vendor/RoundedBoxGeometry.js';
import { partDef, isLoco } from '../catalog.js';
import { buildFigure } from './figures.js';
import { woodTexture } from './textures.js';

const WHEEL_Z = 0.47; // Radmitte seitlich (liegt über der Schiene)

const shared = {
  window: new THREE.MeshStandardMaterial({ color: '#233345', roughness: 0.1, metalness: 0.4 }),
  tire: new THREE.MeshStandardMaterial({ color: '#2a2a2a', roughness: 0.35, metalness: 0.6 }),
  metal: new THREE.MeshStandardMaterial({ color: '#c3beb5', roughness: 0.28, metalness: 0.85 }),
  dark: new THREE.MeshStandardMaterial({ color: '#2f2f2f', roughness: 0.5, metalness: 0.3 }),
  gold: new THREE.MeshStandardMaterial({ color: '#e3b341', roughness: 0.22, metalness: 0.9 }),
  lamp: new THREE.MeshStandardMaterial({ color: '#fff6d8', emissive: '#ffd36b', emissiveIntensity: 1.4 }),
  hay: new THREE.MeshStandardMaterial({ color: '#e9c96b', roughness: 1 }),
  axle: new THREE.MeshStandardMaterial({ color: '#f2c832', roughness: 0.5 }),
};

const geoCache = new Map();
function cached(key, make) {
  if (!geoCache.has(key)) geoCache.set(key, make());
  return geoCache.get(key);
}
const box = (w, h, d, r = 0.06) => cached(`b${w},${h},${d},${r}`, () => new RoundedBoxGeometry(w, h, d, 3, Math.min(r, w / 2, h / 2, d / 2)));
const cyl = (rt, rb, h, seg = 24) => cached(`c${rt},${rb},${h},${seg}`, () => new THREE.CylinderGeometry(rt, rb, h, seg));
const cylX = (r, h, seg = 24) => cached(`cx${r},${h},${seg}`, () => new THREE.CylinderGeometry(r, r, h, seg).rotateZ(Math.PI / 2));
const cylZ = (r, h, seg = 24) => cached(`cz${r},${h},${seg}`, () => new THREE.CylinderGeometry(r, r, h, seg).rotateX(Math.PI / 2));
const sph = (r) => cached(`s${r}`, () => new THREE.SphereGeometry(r, 20, 14));

function mesh(geometry, material, x = 0, y = 0, z = 0, paint = null) {
  const m = new THREE.Mesh(geometry, material);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  if (paint) m.userData.paint = paint;
  return m;
}

// ---------- Räder, Drehgestelle, Kupplungen ----------

// Rad mit Speichen; Achse entlang z. Dreht sich um seine z-Achse.
function wheel(car, x, r, mats, { spokes = 6, pin = 0 } = {}) {
  const w = new THREE.Group();
  w.position.set(x, r, 0);
  const width = 0.12;
  for (const side of [1, -1]) {
    const wz = side * WHEEL_Z;
    w.add(mesh(cylZ(r, width), shared.tire, 0, 0, wz));
    w.add(mesh(cylZ(r * 0.8, width + 0.02), mats.roof, 0, 0, wz, 'roof'));
    for (let i = 0; i < spokes; i++) {
      const s = mesh(cached(`spoke${r}`, () => new THREE.BoxGeometry(r * 1.5, 0.045, width + 0.04)), shared.dark, 0, 0, wz);
      s.rotation.z = (i / spokes) * Math.PI;
      w.add(s);
    }
    w.add(mesh(cylZ(r * 0.22, width + 0.06), shared.metal, 0, 0, wz));
    if (pin) w.add(mesh(cylZ(0.04, 0.1), shared.metal, pin, 0, wz + side * 0.09));
  }
  w.userData.r = r;
  car.add(w);
  car.userData.wheels.push(w);
  return w;
}

function bogie(car, x, mats, r = 0.22) {
  for (const side of [1, -1]) {
    car.add(mesh(box(0.95, 0.14, 0.06, 0.03), shared.dark, x, r + 0.02, side * (WHEEL_Z + 0.1)));
    for (const dx of [-0.3, 0.3]) car.add(mesh(box(0.12, 0.1, 0.07, 0.02), shared.axle, x + dx, r, side * (WHEEL_Z + 0.13)));
  }
  wheel(car, x - 0.3, r, mats, { spokes: 4 });
  wheel(car, x + 0.3, r, mats, { spokes: 4 });
}

function couplers(car, len, y = 0.55) {
  for (const s of [1, -1]) {
    car.add(mesh(box(0.2, 0.08, 0.12, 0.02), shared.metal, s * (len / 2 + 0.06), y, 0));
    for (const z of [0.32, -0.32]) {
      car.add(mesh(cylX(0.05, 0.12, 10), shared.dark, s * (len / 2 - 0.02), y, z));
      car.add(mesh(cylX(0.08, 0.03, 16), shared.metal, s * (len / 2 + 0.05), y, z));
    }
  }
}

// ---------- Loks ----------

function buildDampf(car, mats) {
  const len = 3.0;
  // Rahmen und Umlaufbleche
  car.add(mesh(box(2.9, 0.2, 0.9, 0.04), mats.trim, 0, 0.62, 0, 'trim'));
  for (const s of [1, -1]) car.add(mesh(box(2.1, 0.05, 0.2, 0.02), mats.trim, 0.35, 0.8, s * 0.56, 'trim'));
  couplers(car, len, 0.55);

  // Räder: Laufrad vorne, zwei große Treibräder, kleines Rad hinten
  wheel(car, 1.12, 0.2, mats, { spokes: 5 });
  const d1 = wheel(car, 0.3, 0.36, mats, { spokes: 8, pin: 0.16 });
  wheel(car, -0.5, 0.36, mats, { spokes: 8, pin: 0.16 });
  wheel(car, -1.15, 0.2, mats, { spokes: 5 });

  // Zylinder und Stangen (werden beim Fahren bewegt)
  const rods = { driver: d1, rc: 0.16, sides: [] };
  for (const s of [1, -1]) {
    const z = s * (WHEEL_Z + 0.16);
    car.add(mesh(cylX(0.15, 0.42), mats.trim, 1.3, 0.55, s * 0.6, 'trim'));
    car.add(mesh(cylX(0.17, 0.05), shared.metal, 1.1, 0.55, s * 0.6));
    const coupling = mesh(box(0.92, 0.07, 0.04, 0.02), shared.metal, -0.1, 0.36, z);
    const main = mesh(box(0.78, 0.06, 0.04, 0.02), shared.metal, 0.7, 0.45, z + s * 0.04);
    const piston = mesh(cylX(0.03, 0.4, 8), shared.metal, 1.1, 0.55, s * 0.6);
    car.add(coupling, main, piston);
    rods.sides.push({ coupling, main, piston, s });
  }
  car.userData.rods = rods;

  // Kessel mit Ringen
  car.add(mesh(cylX(0.45, 1.6, 32), mats.body, 0.35, 1.2, 0, 'body'));
  car.add(mesh(cylX(0.48, 0.36, 32), mats.trim, 1.25, 1.2, 0, 'trim'));
  car.add(mesh(cylX(0.36, 0.04, 32), shared.metal, 1.44, 1.2, 0));
  car.add(mesh(sph(0.05), shared.gold, 1.47, 1.2, 0));
  const ring = cached('ring', () => new THREE.TorusGeometry(0.455, 0.03, 8, 32).rotateY(Math.PI / 2));
  for (const x of [-0.25, 0.35, 0.95]) car.add(mesh(ring, shared.gold, x, 1.2, 0));
  // Griffstangen am Kessel
  for (const s of [1, -1]) car.add(mesh(cylX(0.018, 1.5, 6), shared.gold, 0.4, 1.38, s * 0.46));

  // Schornstein, Dome, Glocke, Pfeife
  car.add(mesh(cyl(0.14, 0.19, 0.45), mats.trim, 1.18, 1.82, 0, 'trim'));
  car.add(mesh(cyl(0.25, 0.15, 0.14), mats.trim, 1.18, 2.1, 0, 'trim'));
  car.add(mesh(sph(0.2), shared.gold, 0.55, 1.62, 0));
  car.add(mesh(cyl(0.19, 0.22, 0.2), mats.body, 0.0, 1.62, 0, 'body'));
  car.add(mesh(sph(0.12), shared.gold, 0.0, 1.74, 0));
  car.add(mesh(cyl(0.03, 0.03, 0.3, 8), shared.gold, -0.4, 1.78, 0));
  car.add(mesh(cyl(0.06, 0.04, 0.12, 12), shared.gold, -0.4, 1.95, 0));

  // Lampe vorne
  car.add(mesh(box(0.2, 0.2, 0.22, 0.04), shared.dark, 1.3, 1.56, 0));
  car.add(mesh(cylX(0.08, 0.04), shared.lamp, 1.41, 1.56, 0));

  // Schienenräumer (Keil)
  const wedge = new THREE.Shape();
  wedge.moveTo(0, 0);
  wedge.lineTo(0.3, 0);
  wedge.lineTo(0, 0.38);
  wedge.lineTo(0, 0);
  const wg = cached('wedge', () => new THREE.ExtrudeGeometry(wedge, { depth: 0.86, bevelEnabled: false }).translate(0, 0, -0.43));
  car.add(mesh(wg, mats.roof, 1.45, 0.08, 0, 'roof'));

  // Führerhaus aus Einzelteilen – mit offenen Seitenfenstern, damit man den Lokführer sieht
  const cx = -0.9;
  for (const s of [1, -1]) {
    car.add(mesh(box(0.96, 0.55, 0.08, 0.03), mats.body, cx, 1.06, s * 0.54, 'body'));
    for (const px of [cx + 0.43, cx - 0.43]) car.add(mesh(box(0.1, 0.56, 0.08, 0.03), mats.body, px, 1.6, s * 0.54, 'body'));
  }
  car.add(mesh(box(0.08, 1.12, 1.16, 0.03), mats.body, cx + 0.47, 1.34, 0, 'body'));
  car.add(mesh(box(0.08, 1.12, 1.16, 0.03), mats.body, cx - 0.47, 1.34, 0, 'body'));
  for (const z of [0.28, -0.28]) car.add(mesh(cylX(0.1, 0.02, 20), shared.window, cx + 0.52, 1.62, z));
  car.add(mesh(box(0.9, 0.05, 1.0, 0.02), shared.dark, cx, 0.8, 0));
  car.add(mesh(box(1.24, 0.12, 1.36, 0.06), mats.roof, cx, 1.95, 0, 'roof'));

  const driver = buildFigure('fahrer');
  driver.scale.setScalar(0.95);
  driver.position.set(cx, 1.02, 0.12);
  driver.rotation.y = -Math.PI / 2;
  car.add(driver);
  car.userData.driver = driver;

  car.userData.steamPoint = new THREE.Vector3(1.18, 2.3, 0);
  car.userData.decorY = { side: 1.05, top: 2.02, sideZ: 0.59, sideX: [-0.9, 0.2, 0.75, -0.9], topX: [-0.9, 0.2, -0.9, 0.2] };
  return len;
}

function buildElok(car, mats) {
  const len = 3.0;
  car.add(mesh(box(2.9, 0.22, 1.0, 0.04), mats.trim, 0, 0.62, 0, 'trim'));
  couplers(car, len, 0.55);
  bogie(car, 0.85, mats, 0.24);
  bogie(car, -0.85, mats, 0.24);

  car.add(mesh(box(2.8, 1.15, 1.15, 0.24), mats.body, 0, 1.31, 0, 'body'));
  // Zierstreifen und Kühlergitter
  for (const s of [1, -1]) {
    car.add(mesh(box(2.6, 0.1, 0.03, 0.02), mats.roof, 0, 0.98, s * 0.58, 'roof'));
    for (let i = 0; i < 5; i++) car.add(mesh(box(0.05, 0.3, 0.02), shared.dark, -0.3 + i * 0.12, 1.3, s * 0.585));
    for (const x of [-1.05, 1.05]) car.add(mesh(box(0.34, 0.6, 0.02, 0.03), shared.dark, x, 1.3, s * 0.583));
    for (const x of [-1.05, 1.05]) car.add(mesh(box(0.28, 0.25, 0.02, 0.03), shared.window, x, 1.46, s * 0.59));
    car.add(mesh(cylX(0.015, 1.8, 6), shared.metal, 0, 1.15, s * 0.61));
  }
  // Stirnseiten: Fenster und Lampen
  for (const sx of [1, -1]) {
    car.add(mesh(box(0.03, 0.36, 0.42, 0.04), shared.window, sx * 1.405, 1.55, 0.24));
    car.add(mesh(box(0.03, 0.36, 0.42, 0.04), shared.window, sx * 1.405, 1.55, -0.24));
    for (const z of [0.38, -0.38]) {
      car.add(mesh(cylX(0.07, 0.04, 16), shared.lamp, sx * 1.41, 1.0, z));
    }
    car.add(mesh(cylX(0.06, 0.04, 16), shared.lamp, sx * 1.41, 1.84, 0));
  }
  // Dach mit Aufbauten und Stromabnehmer
  car.add(mesh(box(2.4, 0.12, 0.95, 0.05), mats.roof, 0, 1.94, 0, 'roof'));
  car.add(mesh(box(0.6, 0.14, 0.5, 0.04), shared.dark, -0.7, 2.06, 0));
  for (const z of [0.2, -0.2]) car.add(mesh(cyl(0.05, 0.05, 0.12, 10), shared.metal, 0.9, 2.06, z));
  const panto = new THREE.Group();
  panto.position.set(0.1, 2.0, 0);
  const arm = cached('panto', () => new THREE.BoxGeometry(0.62, 0.035, 0.035));
  for (const [x, rz] of [[-0.12, 0.7], [0.12, -0.7]]) {
    for (const z of [0.2, -0.2]) {
      const a = mesh(arm, shared.metal, x, 0.2, z);
      a.rotation.z = rz;
      panto.add(a);
    }
  }
  panto.add(mesh(box(0.14, 0.04, 0.9, 0.01), shared.metal, 0, 0.42, 0));
  car.add(panto);
  car.userData.decorY = { side: 1.3, top: 2.0, sideZ: 0.6, sideX: [-0.55, 0.55, 0, -0.55], topX: [-1.0, 0.8, -1.0, 0.8] };
  return len;
}

// ---------- Wagen ----------

function underframe(car, len, mats) {
  car.add(mesh(box(len - 0.1, 0.18, 0.95, 0.04), mats.trim, 0, 0.6, 0, 'trim'));
  couplers(car, len, 0.55);
  bogie(car, len / 2 - 0.62, mats);
  bogie(car, -(len / 2 - 0.62), mats);
}

function floor(car, len, mats, y = 0.78) {
  car.add(mesh(box(len - 0.1, 0.16, 1.15, 0.05), mats.body, 0, y, 0, 'body'));
}

function walls(car, len, h, mats, y0 = 0.86) {
  const y = y0 + h / 2;
  for (const s of [1, -1]) car.add(mesh(box(len - 0.1, h, 0.1, 0.04), mats.body, 0, y, s * 0.52, 'body'));
  for (const s of [1, -1]) car.add(mesh(box(0.1, h, 1.1, 0.04), mats.body, s * (len / 2 - 0.1), y, 0, 'body'));
}

function buildPersonen(car, mats) {
  const len = 2.6;
  underframe(car, len, mats);
  floor(car, len, mats);
  walls(car, len, 0.4, mats);
  // Handlauf oben auf der Brüstung
  for (const s of [1, -1]) car.add(mesh(cylX(0.035, len - 0.1, 10), mats.trim, 0, 1.28, s * 0.52, 'trim'));
  // Pfosten und geschwungenes Dach
  for (const x of [len / 2 - 0.15, 0, -(len / 2 - 0.15)]) {
    for (const z of [0.5, -0.5]) car.add(mesh(cyl(0.04, 0.04, 1.05, 10), mats.trim, x, 1.8, z, 'trim'));
  }
  car.add(mesh(box(len + 0.15, 0.1, 1.4, 0.05), mats.roof, 0, 2.33, 0, 'roof'));
  car.add(mesh(box(len - 0.3, 0.12, 1.0, 0.06), mats.roof, 0, 2.42, 0, 'roof'));
  // Laternen an den Ecken
  for (const x of [len / 2 - 0.15, -(len / 2 - 0.15)]) car.add(mesh(sph(0.06), shared.lamp, x, 2.2, 0.5));
  car.userData.cargoY = 0.86;
  car.userData.decorY = { side: 1.07, top: 2.48, sideZ: 0.58, sideX: [-0.8, 0.8, 0, -0.8], topX: [-0.7, 0.7, 0, -0.7] };
  return len;
}

function buildGueter(car, mats) {
  const len = 2.6;
  mats.body.map = woodTexture('#f3e7d6', 'wagon');
  underframe(car, len, mats);
  floor(car, len, mats);
  walls(car, len, 0.62, mats);
  for (const x of [-1.2, -0.4, 0.4, 1.2]) {
    for (const z of [0.58, -0.58]) car.add(mesh(box(0.07, 0.64, 0.04, 0.01), mats.trim, x, 1.17, z, 'trim'));
  }
  for (const z of [0.58, -0.58]) car.add(mesh(box(len - 0.1, 0.06, 0.04, 0.01), mats.trim, 0, 1.47, z, 'trim'));
  car.userData.cargoY = 1.22;
  car.userData.decorY = { side: 1.17, top: 1.5, sideZ: 0.6, sideX: [-0.8, 0, 0.8, -0.8], topX: [-1.0, 1.0, -1.0, 1.0] };
  return len;
}

function buildTier(car, mats) {
  const len = 2.6;
  underframe(car, len, mats);
  floor(car, len, mats);
  car.add(mesh(box(len - 0.3, 0.06, 0.95, 0.03), shared.hay, 0, 0.88, 0));
  // Latten mit Lücken – die Tiere schauen heraus
  for (const y of [0.98, 1.24]) {
    for (const s of [1, -1]) car.add(mesh(box(len - 0.1, 0.12, 0.08, 0.04), mats.body, 0, y, s * 0.52, 'body'));
  }
  for (const x of [len / 2 - 0.1, -(len / 2 - 0.1)]) car.add(mesh(box(0.1, 0.5, 1.1, 0.04), mats.body, x, 1.1, 0, 'body'));
  for (const x of [-0.65, 0, 0.65]) {
    for (const s of [1, -1]) car.add(mesh(box(0.08, 0.56, 0.05, 0.02), mats.roof, x, 1.1, s * 0.56, 'roof'));
  }
  car.userData.cargoY = 0.9;
  car.userData.decorY = { side: 1.11, top: 1.36, sideZ: 0.6, sideX: [-0.33, 0.33, -1.0, 1.0], topX: [-1.1, 1.1, -1.1, 1.1] };
  return len;
}

function buildFlach(car, mats) {
  const len = 2.6;
  mats.body.map = woodTexture('#f3e7d6', 'wagon');
  underframe(car, len, mats);
  floor(car, len, mats);
  for (const x of [-1.15, -0.38, 0.38, 1.15]) {
    for (const z of [0.53, -0.53]) car.add(mesh(cyl(0.04, 0.045, 0.55, 8), mats.roof, x, 1.12, z, 'roof'));
  }
  car.userData.cargoY = 0.86;
  car.userData.decorY = { side: 0.78, top: 0.9, sideZ: 0.6, sideX: [-0.75, 0, 0.75, -0.35], topX: [-0.75, 0.75, 0, -0.75] };
  return len;
}

function buildTank(car, mats) {
  const len = 2.6;
  underframe(car, len, mats);
  car.add(mesh(box(len - 0.1, 0.08, 1.1, 0.03), shared.dark, 0, 0.74, 0));
  car.add(mesh(cylX(0.55, 2.0, 32), mats.body, 0, 1.33, 0, 'body'));
  for (const sx of [1, -1]) {
    const cap = mesh(sph(0.55), mats.body, sx * 1.0, 1.33, 0, 'body');
    cap.scale.set(0.35, 1, 1);
    car.add(cap);
  }
  // Dom mit Deckel, Laufsteg, Leiter, Bänder
  car.add(mesh(cyl(0.22, 0.26, 0.3), mats.roof, 0, 1.93, 0, 'roof'));
  car.add(mesh(cyl(0.25, 0.25, 0.05), shared.metal, 0, 2.1, 0));
  car.add(mesh(box(1.4, 0.04, 0.35, 0.01), shared.dark, 0, 1.9, 0));
  const band = cached('band', () => new THREE.TorusGeometry(0.56, 0.03, 8, 32).rotateY(Math.PI / 2));
  for (const x of [-0.65, 0.65]) car.add(mesh(band, mats.roof, x, 1.33, 0, 'roof'));
  for (const s of [1, -1]) {
    for (const dz of [-0.12, 0.12]) car.add(mesh(cyl(0.015, 0.015, 1.1, 6), shared.metal, 0.35 + dz, 1.35, s * 0.6));
    for (let i = 0; i < 5; i++) car.add(mesh(cylX(0.012, 0.26, 6), shared.metal, 0.35, 0.9 + i * 0.22, s * 0.6));
  }
  car.userData.decorY = { side: 1.33, top: 2.12, sideZ: 0.57, sideX: [-0.35, -0.95, 0.9, -0.35], topX: [-0.9, 0.9, -0.9, 0.9] };
  return len;
}

const BUILDERS = {
  dampf: buildDampf,
  elok: buildElok,
  personen: buildPersonen,
  gueter: buildGueter,
  tier: buildTier,
  flach: buildFlach,
  tank: buildTank,
};

// ---------- Schmuck ----------

function starShape(r1, r2) {
  const s = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 ? r2 : r1;
    const a = (i / 10) * Math.PI * 2 + Math.PI / 2;
    if (i === 0) s.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    else s.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  s.closePath();
  return s;
}

function heartShape(k) {
  const s = new THREE.Shape();
  s.moveTo(0, -0.9 * k);
  s.bezierCurveTo(-0.15 * k, -0.7 * k, -1.0 * k, -0.25 * k, -0.95 * k, 0.3 * k);
  s.bezierCurveTo(-0.9 * k, 0.9 * k, -0.15 * k, 1.0 * k, 0, 0.45 * k);
  s.bezierCurveTo(0.15 * k, 1.0 * k, 0.9 * k, 0.9 * k, 0.95 * k, 0.3 * k);
  s.bezierCurveTo(1.0 * k, -0.25 * k, 0.15 * k, -0.7 * k, 0, -0.9 * k);
  return s;
}

const extrude = (shape) => new THREE.ExtrudeGeometry(shape, {
  depth: 0.05, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 2,
});

const BALLOON_COLORS = ['#e8453c', '#3b7cc9', '#f2c832', '#4fa65a', '#f08bb4'];
const decorMats = {
  stern: new THREE.MeshStandardMaterial({ color: '#f5c53a', roughness: 0.25, metalness: 0.6 }),
  herz: new THREE.MeshPhysicalMaterial({ color: '#e5484d', roughness: 0.3, clearcoat: 1 }),
  petal: new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.6 }),
  center: new THREE.MeshStandardMaterial({ color: '#f2b705' }),
  bulb: new THREE.MeshStandardMaterial({ color: '#fff6d0', emissive: '#ffc94d', emissiveIntensity: 1.4 }),
  flag: new THREE.MeshStandardMaterial({ color: '#e5484d', side: THREE.DoubleSide }),
  string: new THREE.MeshBasicMaterial({ color: '#777777' }),
};

// Schmuck für die Wagenseite (wird auf beiden Seiten angebracht)
export function sideDecor(kind) {
  const g = new THREE.Group();
  if (kind === 'stern') {
    g.add(mesh(cached('stern', () => extrude(starShape(0.24, 0.1))), decorMats.stern));
  } else if (kind === 'herz') {
    g.add(mesh(cached('herz', () => extrude(heartShape(0.2))), decorMats.herz));
  } else if (kind === 'blume') {
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const p = mesh(sph(0.09), decorMats.petal, Math.cos(a) * 0.13, Math.sin(a) * 0.13, 0);
      p.scale.z = 0.4;
      g.add(p);
    }
    const c = mesh(sph(0.09), decorMats.center, 0, 0, 0.02);
    c.scale.set(0.9, 0.9, 0.5);
    g.add(c);
  } else if (kind === 'lampe') {
    g.add(mesh(sph(0.13), decorMats.bulb, 0, 0, 0.08), mesh(cylZ(0.08, 0.1, 12), shared.metal, 0, 0, 0));
  }
  return g;
}

// Schmuck oben auf dem Wagen
export function topDecor(kind, index = 0) {
  const g = new THREE.Group();
  if (kind === 'fahne') {
    g.add(mesh(cyl(0.025, 0.025, 0.8, 8), shared.metal, 0, 0.4, 0));
    const tri = new THREE.Shape();
    tri.moveTo(0, 0);
    tri.lineTo(0.5, -0.15);
    tri.lineTo(0, -0.3);
    const flag = mesh(cached('flag', () => new THREE.ShapeGeometry(tri)), decorMats.flag, 0.02, 0.78, 0);
    g.add(flag);
    g.userData.flag = flag;
  } else if (kind === 'ballon') {
    const color = BALLOON_COLORS[index % BALLOON_COLORS.length];
    const b = mesh(sph(0.28), new THREE.MeshPhysicalMaterial({ color, roughness: 0.2, clearcoat: 1 }), 0, 1.35, 0);
    b.scale.set(1, 1.2, 1);
    g.add(b, mesh(cyl(0.008, 0.008, 1.0, 4), decorMats.string, 0, 0.55, 0));
    g.userData.balloon = b;
  }
  return g;
}

export const isTopDecor = (kind) => kind === 'fahne' || kind === 'ballon';

function addDecor(car) {
  const d = car.userData.decorY;
  car.userData.data.decor.forEach((kind, i) => {
    let item;
    if (isTopDecor(kind)) {
      item = topDecor(kind, i);
      item.position.set(d.topX[i % d.topX.length], d.top, 0);
    } else {
      item = new THREE.Group();
      const x = d.sideX[i % d.sideX.length];
      for (const side of [1, -1]) {
        const s = sideDecor(kind);
        s.position.set(x, d.side, side * (d.sideZ + 0.03));
        if (side < 0) s.rotation.y = Math.PI;
        item.add(s);
      }
    }
    item.userData.removable = { list: 'decor', index: i, id: kind };
    item.traverse((o) => { o.userData.owner = item; });
    car.userData.decorItems.push(item);
    car.add(item);
  });
}

// ---------- Ladung: 3D-Figuren ----------

const SLOT_X = [-0.72, 0, 0.72];

function addCargo(car) {
  const def = partDef(car.userData.data.type);
  if (!def.slots) return;
  car.userData.data.cargo.forEach((id, i) => {
    if (i >= SLOT_X.length) return;
    const fig = buildFigure(id);
    fig.scale.setScalar(0.95);
    fig.position.set(SLOT_X[i], car.userData.cargoY, 0);
    fig.userData.baseY = car.userData.cargoY;
    fig.userData.phase = i * 1.7;
    fig.userData.removable = { list: 'cargo', index: i, id };
    fig.traverse((o) => { o.userData.owner = fig; });
    car.userData.cargoItems.push(fig);
    car.add(fig);
  });
}

// ---------- Wagen bauen ----------

function paintMaterial(color, roughness) {
  return new THREE.MeshPhysicalMaterial({ color, roughness, clearcoat: 0.8, clearcoatRoughness: 0.2 });
}

export function buildCar(data) {
  const car = new THREE.Group();
  car.userData = { data, wheels: [], decorItems: [], cargoItems: [], isLoco: isLoco(data.type) };
  const mats = {
    body: paintMaterial(data.paint.body, 0.35),
    roof: paintMaterial(data.paint.roof, 0.45),
    trim: new THREE.MeshStandardMaterial({ color: data.paint.trim, roughness: 0.45, metalness: 0.3 }),
  };
  car.userData.mats = mats;
  car.userData.length = BUILDERS[data.type](car, mats);
  addDecor(car);
  addCargo(car);
  car.traverse((o) => { o.userData.car ??= car; });
  car.userData.car = car;
  return car;
}

export function disposeCar(car) {
  Object.values(car.userData.mats ?? {}).forEach((m) => m.dispose());
}

// Animation pro Bild: Räder, Stangen, Ballons, Fahnen, Mitfahrer
export function animateCar(car, time, distanceDelta, moving) {
  for (const w of car.userData.wheels) w.rotation.z -= distanceDelta / w.userData.r;

  const rods = car.userData.rods;
  if (rods) {
    const phi = rods.driver.rotation.z;
    const px = 0.3 + rods.rc * Math.cos(phi);
    const py = 0.36 + rods.rc * Math.sin(phi);
    const cy = 0.55;
    const L = 0.75;
    const cx = px + Math.sqrt(L * L - (cy - py) ** 2);
    for (const r of rods.sides) {
      r.coupling.position.set(-0.1 + rods.rc * Math.cos(phi), py, r.coupling.position.z);
      r.main.position.set((px + cx) / 2, (py + cy) / 2, r.main.position.z);
      r.main.rotation.z = Math.atan2(cy - py, cx - px);
      r.piston.position.x = cx + 0.2;
    }
  }

  for (const item of car.userData.decorItems) {
    const b = item.userData.balloon;
    if (b) {
      b.position.y = 1.35 + Math.sin(time * 2 + item.id) * 0.06;
      b.position.x = moving ? -0.15 : 0;
    }
    const f = item.userData.flag;
    if (f) f.rotation.y = Math.sin(time * (moving ? 12 : 3)) * (moving ? 0.35 : 0.15);
  }
  for (const s of car.userData.cargoItems) {
    const hop = moving
      ? Math.abs(Math.sin(time * 6 + s.userData.phase)) * 0.05
      : Math.max(0, Math.sin(time * 1.3 + s.userData.phase)) * 0.015;
    s.position.y = s.userData.baseY + hop;
  }
  const driver = car.userData.driver;
  if (driver) driver.position.y = 1.02 + Math.sin(time * (moving ? 8 : 1.5)) * 0.012;
}

// Winken (Lokführer, Kind) – für Rückmeldung beim Antippen
export function wave(figure, game) {
  const arm = figure?.userData.waveArm;
  if (!arm) return;
  const base = arm.rotation.clone();
  game.tween(1.2, (t) => {
    arm.rotation.z = base.z + Math.sin(t * Math.PI * 6) * 0.5 * Math.sin(t * Math.PI);
    arm.rotation.x = base.x - Math.sin(t * Math.PI) * 1.2;
  }, () => arm.rotation.copy(base));
}
