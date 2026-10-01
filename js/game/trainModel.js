// 3D-Modelle im Spielzeug-Stil, nur aus einfachen Formen gebaut (keine Modelldateien nötig).
// Koordinaten eines Wagens: vorne = +x, Seite = z, oben = y. y = 0 ist die Schienenoberkante.

import * as THREE from 'three';
import { RoundedBoxGeometry } from '../../vendor/RoundedBoxGeometry.js';
import { partDef, isLoco, STATION_COLORS } from '../catalog.js';
import { buildFigure, setBubble } from './figures.js';
import { woodTexture } from './textures.js';
import { lamp } from './lamps.js';
import { wheelDecalMaterial } from './wheelStyles.js';

const WHEEL_Z = 0.47; // Radmitte seitlich (liegt über der Schiene)

const shared = {
  window: new THREE.MeshStandardMaterial({ color: '#233345', roughness: 0.1, metalness: 0.4 }),
  tire: new THREE.MeshStandardMaterial({ color: '#2a2a2a', roughness: 0.35, metalness: 0.6 }),
  metal: new THREE.MeshStandardMaterial({ color: '#c3beb5', roughness: 0.28, metalness: 0.85 }),
  dark: new THREE.MeshStandardMaterial({ color: '#2f2f2f', roughness: 0.5, metalness: 0.3 }),
  gold: new THREE.MeshStandardMaterial({ color: '#e3b341', roughness: 0.22, metalness: 0.9 }),
  lamp: lamp(new THREE.MeshStandardMaterial({ color: '#fff6d8', emissive: '#ffd36b' }), 1.4, 3.5),
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

// Rad; Achse entlang z. Dreht sich um seine z-Achse.
// Scheibe in der Radfarbe (anmalbar), darauf das Radmuster (Speichen, Stern, Herz …).
function wheel(car, x, r, mats, { spokes = 6, pin = 0 } = {}) {
  const w = new THREE.Group();
  w.position.set(x, r, 0);
  const width = 0.12;
  const style = car.userData.data?.wheelStyle ?? 'speichen';
  const decal = wheelDecalMaterial(style);
  for (const side of [1, -1]) {
    const wz = side * WHEEL_Z;
    w.add(mesh(cylZ(r, width), shared.tire, 0, 0, wz, 'wheel'));
    w.add(mesh(cylZ(r * 0.84, width + 0.02), mats.wheel, 0, 0, wz, 'wheel'));
    if (decal) {
      const d = mesh(cached(`wd${r}`, () => new THREE.CircleGeometry(r * 0.82, 32)), decal, 0, 0, wz + side * (width / 2 + 0.012), 'wheel');
      if (side < 0) d.rotation.y = Math.PI;
      d.castShadow = false;
      w.add(d);
    } else {
      for (let i = 0; i < spokes; i++) {
        const s = mesh(cached(`spoke${r}`, () => new THREE.BoxGeometry(r * 1.5, 0.045, width + 0.04)), shared.dark, 0, 0, wz, 'wheel');
        s.rotation.z = (i / spokes) * Math.PI;
        w.add(s);
      }
      w.add(mesh(cylZ(r * 0.22, width + 0.06), shared.metal, 0, 0, wz, 'wheel'));
    }
    if (pin) w.add(mesh(cylZ(0.04, 0.1), shared.metal, pin, 0, wz + side * 0.09));
  }
  w.userData.r = r;
  car.add(w);
  car.userData.wheels.push(w);
  return w;
}

// Ein einzelnes Rad als Vorschaubild für die Leiste
export function buildWheelPreview(style, color = '#e5484d') {
  const holder = new THREE.Group();
  holder.userData = { data: { wheelStyle: style }, wheels: [] };
  wheel(holder, 0, 0.5, { wheel: paintMaterial(color, 0.4) });
  holder.position.y = -0.5;
  return holder;
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
  car.userData.decorY = { side: 1.05, top: 2.02, sideZ: 0.59, sideX: [-0.9, 0.2, 0.75, -0.9], topX: [-0.9, 0.2, -0.9, 0.2], front: [1.47, 1.2] };
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
  car.userData.decorY = { side: 1.3, top: 2.0, sideZ: 0.6, sideX: [-0.55, 0.55, 0, -0.55], topX: [-1.0, 0.8, -1.0, 0.8], front: [1.42, 1.22] };
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

// Führerhaus aus Einzelteilen mit offenen Seitenfenstern und Lokführer
function openCab(car, mats, cx, w = 0.96, d = 1.16, y0 = 0.8) {
  for (const s of [1, -1]) {
    car.add(mesh(box(w, 0.55, 0.08, 0.03), mats.body, cx, y0 + 0.26, s * (d / 2 - 0.04), 'body'));
    for (const px of [cx + w / 2 - 0.05, cx - w / 2 + 0.05]) car.add(mesh(box(0.1, 0.56, 0.08, 0.03), mats.body, px, y0 + 0.8, s * (d / 2 - 0.04), 'body'));
  }
  for (const sx of [1, -1]) car.add(mesh(box(0.08, 1.12, d, 0.03), mats.body, cx + sx * (w / 2 - 0.01), y0 + 0.54, 0, 'body'));
  for (const z of [0.25, -0.25]) car.add(mesh(box(0.03, 0.3, 0.3, 0.04), shared.window, cx + w / 2 + 0.03, y0 + 0.85, z));
  car.add(mesh(box(w - 0.06, 0.05, d - 0.16, 0.02), shared.dark, cx, y0, 0));
  car.add(mesh(box(w + 0.28, 0.12, d + 0.2, 0.06), mats.roof, cx, y0 + 1.15, 0, 'roof'));
  const driver = buildFigure('fahrer');
  driver.scale.setScalar(0.95);
  driver.position.set(cx, y0 + 0.22, 0.12);
  driver.rotation.y = -Math.PI / 2;
  car.add(driver);
  car.userData.driver = driver;
  car.userData.driverY = y0 + 0.22;
}

function buildDiesel(car, mats) {
  const len = 3.0;
  car.add(mesh(box(2.9, 0.22, 1.05, 0.04), mats.trim, 0, 0.62, 0, 'trim'));
  couplers(car, len, 0.55);
  bogie(car, 0.85, mats, 0.24);
  bogie(car, -0.85, mats, 0.24);
  // Langer Vorbau mit Lüftungsgittern und Geländer
  car.add(mesh(box(1.75, 0.8, 0.8, 0.12), mats.body, 0.48, 1.13, 0, 'body'));
  car.add(mesh(box(1.6, 0.06, 0.6, 0.02), mats.roof, 0.48, 1.55, 0, 'roof'));
  for (const sd of [1, -1]) {
    for (let i = 0; i < 6; i++) car.add(mesh(box(0.05, 0.4, 0.02), shared.dark, -0.05 + i * 0.2, 1.15, sd * 0.405));
    car.add(mesh(cylX(0.016, 2.6, 6), shared.metal, 0.05, 1.18, sd * 0.56));
    for (const x of [-1.2, -0.3, 0.6, 1.3]) car.add(mesh(cyl(0.014, 0.014, 0.45, 6), shared.metal, x, 0.95, sd * 0.56));
  }
  // Warnstreifen vorne
  for (let i = 0; i < 4; i++) {
    const st = mesh(box(0.03, 0.08, 0.5), mats.roof, 1.36, 0.85 + i * 0.12, 0, 'roof');
    st.rotation.x = i % 2 ? 0.5 : -0.5;
    car.add(st);
  }
  car.add(mesh(cylX(0.07, 0.04, 16), shared.lamp, 1.37, 1.38, 0.25));
  car.add(mesh(cylX(0.07, 0.04, 16), shared.lamp, 1.37, 1.38, -0.25));
  car.add(mesh(cyl(0.07, 0.08, 0.25, 12), shared.dark, 0.75, 1.64, 0));
  openCab(car, mats, -0.85, 1.0, 1.16, 0.74);
  car.userData.exhaustPoint = new THREE.Vector3(0.75, 1.85, 0);
  car.userData.decorY = { side: 1.15, top: 1.95, sideZ: 0.6, sideX: [-0.85, 0.3, 0.9, -0.85], topX: [-0.85, 0.3, -0.85, 0.3], front: [1.38, 1.1] };
  return len;
}

function buildSchnell(car, mats) {
  const len = 3.4;
  car.add(mesh(box(3.0, 0.2, 0.95, 0.04), shared.dark, -0.1, 0.6, 0));
  couplers(car, len, 0.55);
  bogie(car, 0.9, mats, 0.22);
  bogie(car, -1.05, mats, 0.22);
  // Stromlinien-Körper mit langer Nase
  car.add(mesh(box(2.5, 1.12, 1.15, 0.3), mats.body, -0.45, 1.28, 0, 'body'));
  const nose = mesh(sph(0.575), mats.body, 0.7, 1.22, 0, 'body');
  nose.scale.set(1.75, 0.95, 1);
  car.add(nose);
  const shield = mesh(sph(0.4), shared.window, 1.02, 1.48, 0);
  shield.scale.set(1.3, 0.5, 1.2);
  car.add(shield);
  for (const sd of [1, -1]) {
    car.add(mesh(box(2.3, 0.22, 0.03, 0.05), shared.window, -0.45, 1.5, sd * 0.585));
    car.add(mesh(box(2.4, 0.09, 0.03, 0.03), mats.roof, -0.45, 1.02, sd * 0.585, 'roof'));
    car.add(mesh(box(2.7, 0.3, 0.05, 0.04), mats.body, -0.3, 0.72, sd * 0.5, 'body'));
  }
  const stripe = mesh(sph(0.58), mats.roof, 0.7, 1.05, 0, 'roof');
  stripe.scale.set(1.76, 0.1, 1.01);
  car.add(stripe);
  for (const z of [0.28, -0.28]) car.add(mesh(sph(0.06), shared.lamp, 1.55, 1.0, z));
  car.add(mesh(box(0.5, 0.1, 0.4, 0.03), shared.dark, -0.9, 1.88, 0));
  const arm = cached('pantoS', () => new THREE.BoxGeometry(0.45, 0.03, 0.03));
  for (const rz of [0.7, -0.7]) {
    const a = mesh(arm, shared.metal, -0.9, 2.0, 0);
    a.rotation.z = rz;
    car.add(a);
  }
  car.add(mesh(box(0.1, 0.03, 0.6, 0.01), shared.metal, -0.9, 2.16, 0));
  car.userData.decorY = { side: 1.3, top: 1.86, sideZ: 0.6, sideX: [-1.2, -0.3, 0.4, -1.2], topX: [-1.3, 0, -1.3, 0], front: [1.62, 1.12] };
  return len;
}

function buildZirkus(car, mats) {
  const len = 2.6;
  underframe(car, len, mats);
  floor(car, len, mats);
  // Käfig mit goldenen Stäben
  for (let i = 0; i < 9; i++) {
    for (const sd of [1, -1]) car.add(mesh(cyl(0.025, 0.025, 0.95, 8), shared.gold, -1.1 + i * 0.275, 1.33, sd * 0.52));
  }
  for (const sx of [1, -1]) car.add(mesh(box(0.1, 0.95, 1.1, 0.04), mats.body, sx * (len / 2 - 0.1), 1.33, 0, 'body'));
  car.add(mesh(box(len, 0.16, 1.25, 0.05), mats.body, 0, 1.86, 0, 'body'));
  car.add(mesh(box(len - 0.4, 0.14, 0.9, 0.07), mats.roof, 0, 1.98, 0, 'roof'));
  for (let i = 0; i < 9; i++) {
    for (const sd of [1, -1]) car.add(mesh(sph(0.06), mats.roof, -1.2 + i * 0.3, 1.74, sd * 0.62, 'roof'));
  }
  for (const sx of [1, -1]) {
    car.add(mesh(cyl(0.02, 0.02, 0.5, 6), shared.metal, sx * 1.1, 2.3, 0));
    const tri = new THREE.Shape();
    tri.moveTo(0, 0);
    tri.lineTo(0.3, -0.09);
    tri.lineTo(0, -0.18);
    const fl = mesh(cached('pennant', () => new THREE.ShapeGeometry(tri)), new THREE.MeshStandardMaterial({ color: sx > 0 ? '#3b7cc9' : '#4fa65a', side: THREE.DoubleSide }), sx * 1.1 + 0.01, 2.52, 0);
    car.add(fl);
  }
  car.userData.cargoY = 0.86;
  car.userData.slotX = [-0.5, 0.5];
  car.userData.decorY = { side: 1.86, top: 2.05, sideZ: 0.64, sideX: [-0.6, 0.6, 0, -0.6], topX: [-0.6, 0.6, 0, -0.6] };
  return len;
}

function buildSchluss(car, mats) {
  const len = 2.5;
  underframe(car, len, mats);
  car.add(mesh(box(len - 0.1, 0.12, 1.15, 0.04), shared.dark, 0, 0.76, 0));
  car.add(mesh(box(1.6, 1.0, 1.08, 0.08), mats.body, 0.1, 1.32, 0, 'body'));
  for (const sd of [1, -1]) {
    for (const x of [-0.35, 0.55]) car.add(mesh(box(0.32, 0.3, 0.03, 0.04), shared.window, x, 1.45, sd * 0.545));
  }
  car.add(mesh(box(1.95, 0.1, 1.3, 0.05), mats.roof, 0.1, 1.87, 0, 'roof'));
  // Kanzel auf dem Dach
  car.add(mesh(box(0.6, 0.4, 0.8, 0.05), mats.body, 0.1, 2.1, 0, 'body'));
  for (const sd of [1, -1]) car.add(mesh(box(0.35, 0.18, 0.03, 0.03), shared.window, 0.1, 2.14, sd * 0.405));
  car.add(mesh(box(0.75, 0.08, 0.95, 0.04), mats.roof, 0.1, 2.33, 0, 'roof'));
  // Plattformen mit Geländer an beiden Enden
  for (const sx of [1, -1]) {
    const x = sx * (len / 2 - 0.12);
    for (const z of [0.5, -0.5]) car.add(mesh(cyl(0.02, 0.02, 0.5, 6), shared.metal, x, 1.07, z));
    car.add(mesh(cylZ(0.02, 1.0, 6), shared.metal, x, 1.3, 0));
  }
  car.add(mesh(sph(0.09), new THREE.MeshStandardMaterial({ color: '#ff6b5a', emissive: '#ff2a1a', emissiveIntensity: 1.2 }), -len / 2 + 0.05, 1.55, 0.35));
  car.userData.cargoY = 0.82;
  car.userData.slotX = [-1.0];
  car.userData.decorY = { side: 1.15, top: 1.93, sideZ: 0.56, sideX: [0.1, -0.4, 0.6, 0.1], topX: [0.6, -0.4, 0.6, -0.4] };
  return len;
}

function buildHolz(car, mats) {
  const len = 2.6;
  underframe(car, len, mats);
  floor(car, len, mats);
  for (const x of [-1.15, -0.38, 0.38, 1.15]) {
    for (const z of [0.53, -0.53]) car.add(mesh(cyl(0.04, 0.045, 0.75, 8), mats.roof, x, 1.22, z, 'roof'));
  }
  const bark = new THREE.MeshStandardMaterial({ color: '#7a4b2a', roughness: 0.9 });
  const cut = new THREE.MeshStandardMaterial({ color: '#e3c18f', roughness: 0.8 });
  const logGeo = cached('log', () => new THREE.CylinderGeometry(0.16, 0.16, 2.3, 14).rotateZ(Math.PI / 2));
  for (const [y, z] of [[1.02, -0.33], [1.02, 0], [1.02, 0.33], [1.29, -0.17], [1.29, 0.17], [1.56, 0]]) {
    car.add(mesh(logGeo, [bark, cut, cut], 0, y, z));
  }
  car.userData.decorY = { side: 0.78, top: 1.72, sideZ: 0.6, sideX: [-0.75, 0, 0.75, -0.35], topX: [-0.8, 0.8, 0, -0.8] };
  return len;
}

function buildKohle(car, mats) {
  const len = 2.6;
  underframe(car, len, mats);
  floor(car, len, mats);
  walls(car, len, 0.55, mats);
  for (const x of [-0.8, 0, 0.8]) {
    for (const z of [0.58, -0.58]) car.add(mesh(box(0.06, 0.56, 0.04, 0.01), mats.trim, x, 1.13, z, 'trim'));
  }
  const coal = new THREE.MeshStandardMaterial({ color: '#25272b', roughness: 0.6, metalness: 0.2 });
  let seed = 3;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 26; i++) {
    const x = (rnd() - 0.5) * 2.0;
    const z = (rnd() - 0.5) * 0.85;
    const h = 1.3 + (1 - Math.abs(x) / 1.1) * 0.25 + rnd() * 0.08;
    const c = mesh(cached('coal', () => new THREE.IcosahedronGeometry(0.16, 0)), coal, x, h, z);
    c.rotation.set(rnd() * 3, rnd() * 3, 0);
    car.add(c);
  }
  car.userData.decorY = { side: 1.13, top: 1.45, sideZ: 0.6, sideX: [-0.4, 0.4, -1.0, 1.0], topX: [-1.1, 1.1, -1.1, 1.1] };
  return len;
}

const TOY_CAR_COLORS = ['#e5484d', '#4fa65a', '#f2c832', '#8b5bb5'];
// Spielzeugauto, fast so breit wie der Wagen (wie bei echten Autotransportern im Kinderzimmer)
function toyCar(color) {
  const g = new THREE.Group();
  const m = new THREE.MeshPhysicalMaterial({ color, roughness: 0.3, clearcoat: 1 });
  g.add(mesh(box(1.45, 0.3, 0.8, 0.12), m, 0, 0.27, 0));
  g.add(mesh(box(0.8, 0.3, 0.72, 0.12), m, -0.1, 0.55, 0));
  for (const z of [0.365, -0.365]) g.add(mesh(box(0.6, 0.18, 0.02, 0.03), shared.window, -0.1, 0.57, z));
  g.add(mesh(box(0.02, 0.2, 0.6, 0.03), shared.window, 0.31, 0.57, 0));
  for (const z of [0.25, -0.25]) g.add(mesh(sph(0.06), shared.lamp, 0.72, 0.3, z));
  for (const x of [0.45, -0.45]) {
    for (const z of [0.38, -0.38]) {
      g.add(mesh(cylZ(0.15, 0.1, 16), shared.tire, x, 0.15, z));
      g.add(mesh(cylZ(0.07, 0.11, 10), shared.metal, x, 0.15, z));
    }
  }
  return g;
}

function buildAuto(car, mats) {
  const len = 3.4;
  underframe(car, len, mats);
  car.add(mesh(box(len - 0.1, 0.08, 1.15, 0.03), mats.body, 0, 0.76, 0, 'body'));
  car.add(mesh(box(len - 0.1, 0.07, 1.15, 0.03), mats.body, 0, 1.52, 0, 'body'));
  for (const x of [-1.6, -0.55, 0.55, 1.6]) {
    for (const z of [0.55, -0.55]) car.add(mesh(box(0.07, 1.4, 0.07, 0.02), mats.roof, x, 1.5, z, 'roof'));
  }
  for (const z of [0.55, -0.55]) {
    car.add(mesh(cylX(0.025, len - 0.1, 6), mats.roof, 0, 1.15, z, 'roof'));
    car.add(mesh(cylX(0.025, len - 0.1, 6), mats.roof, 0, 2.18, z, 'roof'));
  }
  car.userData.toyCars = [];
  [[-0.82, 0.8], [0.82, 0.8], [-0.82, 1.56], [0.82, 1.56]].forEach(([x, y], i) => {
    const c = toyCar(TOY_CAR_COLORS[i]);
    c.position.set(x, y, 0);
    car.add(c);
    car.userData.toyCars.push(c);
  });
  car.userData.decorY = { side: 1.15, top: 2.2, sideZ: 0.6, sideX: [-1.1, 1.1, 0, -1.1], topX: [-1.6, 1.6, 0, -1.6] };
  return len;
}

function buildKran(car, mats) {
  const len = 3.2;
  underframe(car, len, mats);
  floor(car, len, mats);
  // Stützfüße an den Seiten
  for (const x of [-1.2, 1.2]) {
    for (const zs of [1, -1]) {
      car.add(mesh(box(0.18, 0.12, 0.5, 0.03), mats.body, x, 0.82, zs * 0.75, 'body'));
      car.add(mesh(box(0.2, 0.5, 0.2, 0.03), mats.trim, x, 0.6, zs * 0.95, 'trim'));
    }
  }
  const turret = new THREE.Group();
  turret.position.set(-0.6, 0.86, 0);
  turret.add(mesh(cyl(0.6, 0.65, 0.18, 28), mats.roof, 0, 0.09, 0, 'roof'));
  // Führerhaus und Gegengewicht
  turret.add(mesh(box(1.15, 0.95, 1.0, 0.08), mats.body, 0, 0.66, 0, 'body'));
  turret.add(mesh(box(1.25, 0.1, 1.08, 0.04), mats.roof, 0, 1.18, 0, 'roof'));
  for (const z of [0.505, -0.505]) turret.add(mesh(box(0.45, 0.4, 0.02, 0.04), shared.window, 0.25, 0.78, z));
  turret.add(mesh(box(0.02, 0.4, 0.7, 0.04), shared.window, 0.58, 0.78, 0));
  turret.add(mesh(box(0.5, 0.75, 1.0, 0.05), shared.dark, -0.75, 0.56, 0));
  for (let i = 0; i < 3; i++) turret.add(mesh(box(0.52, 0.04, 1.02, 0.01), mats.body, -0.75, 0.35 + i * 0.22, 0, 'body'));
  // Gitterausleger (vier Gurte mit Diagonalen)
  const BOOM = 2.4;
  const ANGLE = 0.85;
  const boom = new THREE.Group();
  boom.position.set(0.45, 1.0, 0);
  boom.rotation.z = ANGLE;
  for (const y of [0.13, -0.13]) {
    for (const z of [0.2, -0.2]) boom.add(mesh(box(BOOM, 0.07, 0.07, 0.02), mats.body, BOOM / 2, y, z, 'body'));
  }
  const diag = cached('craneDiag', () => new THREE.BoxGeometry(0.045, 0.37, 0.045));
  for (let i = 0; i < 8; i++) {
    const x = 0.15 + i * 0.29;
    for (const z of [0.2, -0.2]) {
      const dg = mesh(diag, mats.body, x, 0, z, 'body');
      dg.rotation.z = i % 2 ? 0.7 : -0.7;
      boom.add(dg);
    }
    const tb = mesh(cached('craneTop', () => new THREE.BoxGeometry(0.045, 0.045, 0.42)), mats.body, x, 0.13, 0, 'body');
    boom.add(tb);
  }
  boom.add(mesh(cylZ(0.12, 0.5, 16), shared.dark, BOOM, 0, 0));
  turret.add(boom);
  // Seil und Hakenblock hängen senkrecht von der Spitze
  const tip = new THREE.Vector3(0.45 + Math.cos(ANGLE) * BOOM, 1.0 + Math.sin(ANGLE) * BOOM, 0);
  const blockY = 1.45;
  const ropeLen = tip.y - blockY;
  turret.add(mesh(cyl(0.018, 0.018, ropeLen, 4), shared.dark, tip.x, tip.y - ropeLen / 2, 0.06));
  turret.add(mesh(cyl(0.018, 0.018, ropeLen, 4), shared.dark, tip.x, tip.y - ropeLen / 2, -0.06));
  turret.add(mesh(box(0.3, 0.32, 0.26, 0.05), mats.roof, tip.x, blockY, 0, 'roof'));
  const hook = mesh(cached('hookBig', () => new THREE.TorusGeometry(0.14, 0.045, 8, 16, Math.PI * 1.4)), shared.metal, tip.x, blockY - 0.3, 0);
  hook.rotation.z = Math.PI * 0.8;
  turret.add(hook);
  car.add(turret);
  car.userData.crane = turret;
  car.userData.decorY = { side: 0.78, top: 2.15, sideZ: 0.6, sideX: [0.6, -1.3, 1.3, 0.6], topX: [-0.6, -1.0, -0.6, -1.0] };
  return len;
}

const BUILDERS = {
  dampf: buildDampf,
  diesel: buildDiesel,
  elok: buildElok,
  schnell: buildSchnell,
  zirkus: buildZirkus,
  schluss: buildSchluss,
  holz: buildHolz,
  kohle: buildKohle,
  auto: buildAuto,
  kran: buildKran,
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
  bulb: lamp(new THREE.MeshStandardMaterial({ color: '#fff6d0', emissive: '#ffc94d' }), 1.4, 3.5),
  flag: new THREE.MeshStandardMaterial({ color: '#e5484d', side: THREE.DoubleSide }),
  string: new THREE.MeshBasicMaterial({ color: '#777777' }),
  eyeWhite: new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.3 }),
  cheek: new THREE.MeshStandardMaterial({ color: '#f59aa5', roughness: 0.6 }),
};

// Freundliches Gesicht (schaut nach +x, also nach vorne)
function faceDecor() {
  const g = new THREE.Group();
  const white = decorMats.eyeWhite;
  for (const z of [0.16, -0.16]) {
    const e = mesh(sph(0.1), white, 0, 0.1, z);
    e.scale.x = 0.5;
    g.add(e, mesh(sph(0.05), shared.dark, 0.045, 0.09, z * 0.95));
    g.add(mesh(sph(0.018), white, 0.07, 0.11, z * 0.95 + 0.01));
    const cheek = mesh(sph(0.06), decorMats.cheek, 0, -0.06, z * 1.55);
    cheek.scale.set(0.3, 0.7, 1);
    g.add(cheek);
  }
  const smile = mesh(cached('smileBig', () => new THREE.TorusGeometry(0.13, 0.025, 8, 20, Math.PI)), shared.dark, 0.02, -0.04, 0);
  smile.rotation.set(Math.PI, Math.PI / 2, 0);
  g.add(smile);
  return g;
}

// Lichterkette: bunte Lämpchen, die funkeln
const BULB_COLORS = ['#ff5a5a', '#ffd34d', '#5ad1ff', '#7dff7a', '#ff8ce6'];
function lightString(len) {
  const g = new THREE.Group();
  const n = Math.max(4, Math.round(len / 0.3));
  g.add(mesh(cylX(0.008, len, 4), shared.dark, 0, 0, 0));
  g.userData.bulbs = [];
  for (let i = 0; i < n; i++) {
    const c = BULB_COLORS[i % BULB_COLORS.length];
    const b = mesh(sph(0.045), new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 1 }), -len / 2 + (i + 0.5) * (len / n), -0.05 - (i % 2) * 0.02, 0);
    g.add(b);
    g.userData.bulbs.push(b);
  }
  return g;
}

// Schmuck für die Wagenseite (wird auf beiden Seiten angebracht)
export function sideDecor(kind) {
  const g = new THREE.Group();
  if (kind === 'gesicht') {
    const f = faceDecor();
    f.rotation.y = -Math.PI / 2;
    g.add(f);
    return g;
  }
  if (kind === 'lichterkette') {
    g.add(lightString(0.9));
    return g;
  }
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
  } else if (kind === 'glocke') {
    g.add(mesh(cyl(0.02, 0.02, 0.35, 6), shared.metal, 0, 0.17, 0));
    const bell = new THREE.Group();
    bell.position.y = 0.42;
    bell.add(mesh(cyl(0.06, 0.17, 0.22, 20), shared.gold, 0, -0.08, 0));
    bell.add(mesh(sph(0.04), shared.gold, 0, -0.22, 0));
    g.add(bell);
    g.userData.bell = bell;
  } else if (kind === 'regenbogen') {
    ['#e5484d', '#ee8a2b', '#f2c832', '#4fa65a', '#3b7cc9', '#8b5bb5'].forEach((c, i) => {
      g.add(mesh(cached(`rb${i}`, () => new THREE.TorusGeometry(0.55 - i * 0.06, 0.03, 8, 24, Math.PI)),
        new THREE.MeshStandardMaterial({ color: c, roughness: 0.4 }), 0, 0.02, 0));
    });
  } else if (kind === 'ballon') {
    const color = BALLOON_COLORS[index % BALLOON_COLORS.length];
    const b = mesh(sph(0.28), new THREE.MeshPhysicalMaterial({ color, roughness: 0.2, clearcoat: 1 }), 0, 1.35, 0);
    b.scale.set(1, 1.2, 1);
    g.add(b, mesh(cyl(0.008, 0.008, 1.0, 4), decorMats.string, 0, 0.55, 0));
    g.userData.balloon = b;
  }
  return g;
}

export const isTopDecor = (kind) => ['fahne', 'ballon', 'glocke', 'regenbogen'].includes(kind);

function addDecor(car) {
  const d = car.userData.decorY;
  car.userData.data.decor.forEach((kind, i) => {
    let item;
    const len = car.userData.length;
    if (kind === 'gesicht') {
      item = faceDecor();
      const [fx, fy] = d.front ?? [len / 2 + 0.03, d.side];
      item.position.set(fx, fy, 0);
    } else if (kind === 'lichterkette') {
      item = new THREE.Group();
      for (const side of [1, -1]) {
        const l = lightString(len - 0.3);
        l.position.set(0, d.top - 0.04, side * (d.sideZ + 0.04));
        item.add(l);
        item.userData.bulbs = [...(item.userData.bulbs ?? []), ...l.userData.bulbs];
      }
    } else if (isTopDecor(kind)) {
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

const SLOTS = { 3: [-0.72, 0, 0.72], 2: [-0.5, 0.5], 1: [0] };
// Mitfahrer stehen etwas erhöht und sind etwas größer – gut zu sehen und leicht mit dem Finger zu greifen
const CARGO_LIFT = 0.14;
const CARGO_SCALE = 1.12;

function addCargo(car) {
  const def = partDef(car.userData.data.type);
  if (!def.slots) return;
  const slotX = car.userData.slotX ?? SLOTS[def.slots];
  car.userData.data.cargo.forEach((id, i) => {
    if (i >= slotX.length) return;
    const fig = buildFigure(id);
    fig.scale.setScalar(CARGO_SCALE);
    fig.position.set(slotX[i], car.userData.cargoY + CARGO_LIFT, 0);
    fig.userData.baseY = car.userData.cargoY + CARGO_LIFT;
    fig.userData.phase = i * 1.7;
    fig.userData.removable = { list: 'cargo', index: i, id };
    const dest = car.userData.data.dest?.[i];
    if (dest != null && STATION_COLORS[dest]) setBubble(fig, STATION_COLORS[dest].hex);
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
    wheel: paintMaterial(data.paint.wheel ?? data.paint.roof, 0.4),
  };
  car.userData.mats = mats;
  car.userData.length = BUILDERS[data.type](car, mats);
  addDecor(car);
  addCargo(car);
  addMud(car);
  applyDirt(car);
  car.traverse((o) => { o.userData.car ??= car; });
  car.userData.car = car;
  return car;
}

// Weltposition von Sitzplatz Nr. index (für einsteigende Fahrgäste)
export function slotWorldPosition(car, index) {
  const def = partDef(car.userData.data.type);
  const slotX = car.userData.slotX ?? SLOTS[def.slots] ?? [0];
  return car.localToWorld(new THREE.Vector3(slotX[Math.min(index, slotX.length - 1)], (car.userData.cargoY ?? 0.9) + CARGO_LIFT, 0));
}

// ---------- Schmutz ----------

const MUD = new THREE.Color('#6b4a2b');
const mudMat = new THREE.MeshStandardMaterial({ color: '#5e4027', roughness: 1 });

function addMud(car) {
  const len = car.userData.length;
  const z = car.userData.decorY.sideZ + 0.02;
  const spots = [];
  let seed = len * 1000;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 8; i++) {
    const side = i % 2 ? 1 : -1;
    const m = mesh(sph(0.12), mudMat, (rnd() - 0.5) * (len - 0.6), 0.72 + rnd() * 0.35, side * z);
    m.scale.set(1 + rnd(), 0.6 + rnd() * 0.5, 0.25);
    m.visible = false;
    m.castShadow = false;
    car.add(m);
    spots.push(m);
  }
  car.userData.mud = spots;
}

// Farbe + Schmutzgrad anwenden (nach Anmalen, Fahren, Waschen)
export function applyDirt(car) {
  const data = car.userData.data;
  const d = Math.max(0, Math.min(1, data.dirt ?? 0));
  for (const g of ['body', 'roof']) car.userData.mats[g].color.set(data.paint[g]).lerp(MUD, d * 0.6);
  car.userData.mud.forEach((m, i) => { m.visible = i < Math.round(d * 8); });
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
    if (item.userData.bulbs) item.userData.bulbs.forEach((b, i) => { b.material.emissiveIntensity = 0.6 + Math.abs(Math.sin(time * 3 + i * 1.3)) * 1.2; });
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
  if (driver) driver.position.y = (car.userData.driverY ?? 1.02) + Math.sin(time * (moving ? 8 : 1.5)) * 0.012;
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
