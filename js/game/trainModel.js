// 3D-Modelle im Spielzeug-Stil, nur aus einfachen Formen gebaut (keine Modelldateien nötig).
// Koordinaten eines Wagens: vorne = +x, Seite = z, oben = y. y = 0 ist die Schienenoberkante.

import * as THREE from 'three';
import { RoundedBoxGeometry } from '../../vendor/RoundedBoxGeometry.js';
import { partDef, isLoco, DECOR, CARGO } from '../catalog.js';

const WHEEL_R = 0.28;

const shared = {
  window: new THREE.MeshStandardMaterial({ color: '#2d3b4a', roughness: 0.25, metalness: 0.1 }),
  wheel: new THREE.MeshStandardMaterial({ color: '#2b2b2b', roughness: 0.7 }),
  metal: new THREE.MeshStandardMaterial({ color: '#b9b4ab', roughness: 0.4, metalness: 0.6 }),
  gold: new THREE.MeshStandardMaterial({ color: '#e0b23f', roughness: 0.35, metalness: 0.5 }),
  lamp: new THREE.MeshStandardMaterial({ color: '#fff3c4', emissive: '#ffd36b', emissiveIntensity: 0.9 }),
  wood: new THREE.MeshStandardMaterial({ color: '#b98553', roughness: 0.8 }),
};

const geo = {
  box: (w, h, d, r = 0.08) => new RoundedBoxGeometry(w, h, d, 3, Math.min(r, w / 2, h / 2, d / 2)),
  cyl: (rt, rb, h, seg = 24) => new THREE.CylinderGeometry(rt, rb, h, seg),
};

function mesh(geometry, material, x = 0, y = 0, z = 0, paint = null) {
  const m = new THREE.Mesh(geometry, material);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  if (paint) m.userData.paint = paint;
  return m;
}

// ---------- Fahrgestell ----------

function chassis(car, len, mats) {
  const g = car;
  g.add(mesh(geo.box(len - 0.15, 0.22, 1.0, 0.05), mats.trim, 0, 0.58, 0, 'trim'));
  const wheelGeo = geo.cyl(WHEEL_R, WHEEL_R, 0.14, 20);
  wheelGeo.rotateX(Math.PI / 2);
  const hubGeo = geo.cyl(0.11, 0.11, 0.16, 12);
  hubGeo.rotateX(Math.PI / 2);
  for (const x of [len / 2 - 0.5, -(len / 2 - 0.5)]) {
    for (const z of [0.5, -0.5]) {
      const w = new THREE.Group();
      w.position.set(x, WHEEL_R, z);
      w.add(mesh(wheelGeo, shared.wheel));
      const hub = mesh(hubGeo, mats.roof, 0, 0, 0, 'roof');
      w.add(hub);
      // Speiche, damit man das Drehen sieht
      w.add(mesh(new THREE.BoxGeometry(0.4, 0.06, 0.17), mats.roof, 0, 0, 0, 'roof'));
      g.add(w);
      car.userData.wheels.push(w);
    }
  }
  // Puffer vorne und hinten
  const bufGeo = geo.cyl(0.08, 0.08, 0.16, 10);
  bufGeo.rotateZ(Math.PI / 2);
  for (const sx of [1, -1]) {
    for (const z of [0.3, -0.3]) g.add(mesh(bufGeo, shared.metal, sx * (len / 2 - 0.02), 0.58, z));
  }
}

// ---------- Loks ----------

function buildDampf(car, mats) {
  const len = 2.9;
  chassis(car, len, mats);
  const boilerGeo = geo.cyl(0.5, 0.5, 1.75, 28);
  boilerGeo.rotateZ(Math.PI / 2);
  car.add(mesh(boilerGeo, mats.body, 0.45, 1.2, 0, 'body'));
  const frontGeo = geo.cyl(0.53, 0.53, 0.18, 28);
  frontGeo.rotateZ(Math.PI / 2);
  car.add(mesh(frontGeo, mats.trim, 1.3, 1.2, 0, 'trim'));
  // Schornstein
  car.add(mesh(geo.cyl(0.17, 0.2, 0.55, 16), mats.trim, 1.0, 1.9, 0, 'trim'));
  car.add(mesh(geo.cyl(0.26, 0.18, 0.16, 16), mats.trim, 1.0, 2.22, 0, 'trim'));
  // Dom und Ringe
  car.add(mesh(new THREE.SphereGeometry(0.22, 16, 12), shared.gold, 0.35, 1.68, 0));
  const ringGeo = new THREE.TorusGeometry(0.505, 0.035, 8, 28);
  ringGeo.rotateY(Math.PI / 2);
  for (const x of [0.0, 0.8]) car.add(mesh(ringGeo, shared.gold, x, 1.2, 0));
  // Führerhaus
  car.add(mesh(geo.box(1.0, 1.15, 1.15, 0.1), mats.body, -0.85, 1.28, 0, 'body'));
  for (const z of [0.58, -0.58]) car.add(mesh(new THREE.BoxGeometry(0.5, 0.42, 0.02), shared.window, -0.8, 1.5, z));
  car.add(mesh(new THREE.BoxGeometry(0.02, 0.35, 0.7), shared.window, -0.34, 1.55, 0));
  car.add(mesh(geo.box(1.25, 0.14, 1.35, 0.06), mats.roof, -0.85, 1.93, 0, 'roof'));
  // Schienenräumer und Lampe
  const cc = mesh(new THREE.BoxGeometry(0.3, 0.3, 0.9), mats.trim, 1.45, 0.35, 0, 'trim');
  cc.rotation.z = -0.5;
  car.add(cc);
  const lampGeo = geo.cyl(0.11, 0.11, 0.12, 14);
  lampGeo.rotateZ(Math.PI / 2);
  car.add(mesh(lampGeo, shared.lamp, 1.42, 1.62, 0));
  car.userData.steamPoint = new THREE.Vector3(1.0, 2.4, 0);
  car.userData.decorY = { side: 1.2, top: 1.93, sideZ: 0.52, sideX: [-0.85, 0.1, 0.6, -0.85] };
  return len;
}

function buildElok(car, mats) {
  const len = 2.9;
  chassis(car, len, mats);
  car.add(mesh(geo.box(2.7, 1.2, 1.15, 0.22), mats.body, 0, 1.28, 0, 'body'));
  // Zierstreifen
  for (const z of [0.585, -0.585]) car.add(mesh(new THREE.BoxGeometry(2.5, 0.1, 0.02), mats.roof, 0, 0.95, z, 'roof'));
  // Fenster vorne/hinten und Seiten
  for (const sx of [1, -1]) {
    car.add(mesh(new THREE.BoxGeometry(0.02, 0.38, 0.85), shared.window, sx * 1.355, 1.55, 0));
    for (const z of [0.4, -0.4]) car.add(mesh(new THREE.SphereGeometry(0.07, 10, 8), shared.lamp, sx * 1.36, 1.02, z));
  }
  for (const z of [0.58, -0.58]) {
    for (const x of [-0.7, 0, 0.7]) car.add(mesh(new THREE.BoxGeometry(0.38, 0.32, 0.02), shared.window, x, 1.55, z));
  }
  car.add(mesh(geo.box(2.3, 0.12, 0.95, 0.05), mats.roof, 0, 1.93, 0, 'roof'));
  // Stromabnehmer
  const armGeo = new THREE.BoxGeometry(0.7, 0.04, 0.04);
  const a1 = mesh(armGeo, shared.metal, 0.15, 2.18, 0);
  a1.rotation.z = 0.6;
  const a2 = mesh(armGeo, shared.metal, 0.15, 2.18, 0);
  a2.rotation.z = -0.6;
  car.add(a1, a2, mesh(new THREE.BoxGeometry(0.1, 0.04, 0.8), shared.metal, 0.15, 2.38, 0));
  car.userData.decorY = { side: 1.28, top: 1.99, sideZ: 0.6, sideX: [-0.9, 0.9, 0, -0.9] };
  return len;
}

// ---------- Wagen ----------

function floor(car, len, mats, y = 0.78) {
  car.add(mesh(geo.box(len - 0.1, 0.16, 1.15, 0.05), mats.body, 0, y, 0, 'body'));
}

function walls(car, len, h, mats, paint = 'body', y0 = 0.86) {
  const y = y0 + h / 2;
  car.add(mesh(geo.box(len - 0.1, h, 0.1, 0.04), mats[paint], 0, y, 0.52, paint));
  car.add(mesh(geo.box(len - 0.1, h, 0.1, 0.04), mats[paint], 0, y, -0.52, paint));
  car.add(mesh(geo.box(0.1, h, 1.1, 0.04), mats[paint], len / 2 - 0.1, y, 0, paint));
  car.add(mesh(geo.box(0.1, h, 1.1, 0.04), mats[paint], -(len / 2 - 0.1), y, 0, paint));
}

function buildPersonen(car, mats) {
  const len = 2.6;
  chassis(car, len, mats);
  floor(car, len, mats);
  walls(car, len, 0.42, mats);
  // Pfosten und Dach: offener Aussichtswagen, damit man die Fahrgäste sieht
  for (const x of [len / 2 - 0.15, -(len / 2 - 0.15)]) {
    for (const z of [0.5, -0.5]) car.add(mesh(geo.cyl(0.045, 0.045, 1.05, 8), mats.trim, x, 1.8, z, 'trim'));
  }
  car.add(mesh(geo.box(len + 0.1, 0.14, 1.35, 0.07), mats.roof, 0, 2.35, 0, 'roof'));
  car.userData.cargoY = 1.3;
  car.userData.decorY = { side: 1.07, top: 2.42, sideZ: 0.58, sideX: [-0.8, 0.8, 0, -0.8] };
  return len;
}

function buildGueter(car, mats) {
  const len = 2.6;
  chassis(car, len, mats);
  floor(car, len, mats);
  walls(car, len, 0.6, mats);
  for (const x of [-0.8, 0, 0.8]) {
    for (const z of [0.58, -0.58]) car.add(mesh(new THREE.BoxGeometry(0.06, 0.6, 0.04), mats.trim, x, 1.16, z, 'trim'));
  }
  car.userData.cargoY = 1.45;
  car.userData.decorY = { side: 1.16, top: 1.46, sideZ: 0.6, sideX: [-0.4, 0.4, -1.0, 1.0] };
  return len;
}

function buildTier(car, mats) {
  const len = 2.6;
  chassis(car, len, mats);
  floor(car, len, mats);
  // Latten mit Lücken – die Tiere schauen heraus
  for (const y of [0.98, 1.28]) {
    for (const z of [0.52, -0.52]) car.add(mesh(geo.box(len - 0.1, 0.13, 0.08, 0.04), mats.body, 0, y, z, 'body'));
  }
  for (const x of [len / 2 - 0.1, -(len / 2 - 0.1)]) car.add(mesh(geo.box(0.1, 0.55, 1.1, 0.04), mats.body, x, 1.13, 0, 'body'));
  for (const x of [-0.6, 0.6]) {
    for (const z of [0.55, -0.55]) car.add(mesh(new THREE.BoxGeometry(0.08, 0.6, 0.05), mats.roof, x, 1.13, z, 'roof'));
  }
  car.userData.cargoY = 1.4;
  car.userData.decorY = { side: 1.13, top: 1.42, sideZ: 0.6, sideX: [-1.0, 0, 1.0, -0.3] };
  return len;
}

function buildFlach(car, mats) {
  const len = 2.6;
  chassis(car, len, mats);
  floor(car, len, mats);
  for (const x of [-1.1, -0.37, 0.37, 1.1]) {
    for (const z of [0.53, -0.53]) car.add(mesh(geo.cyl(0.04, 0.04, 0.55, 8), mats.roof, x, 1.12, z, 'roof'));
  }
  car.userData.cargoY = 1.25;
  car.userData.decorY = { side: 0.78, top: 0.9, sideZ: 0.6, sideX: [-0.75, 0, 0.75, -0.35] };
  return len;
}

function buildTank(car, mats) {
  const len = 2.6;
  chassis(car, len, mats);
  const tankGeo = geo.cyl(0.55, 0.55, 2.1, 28);
  tankGeo.rotateZ(Math.PI / 2);
  car.add(mesh(tankGeo, mats.body, 0, 1.3, 0, 'body'));
  for (const sx of [1, -1]) {
    const cap = mesh(new THREE.SphereGeometry(0.55, 24, 16), mats.body, sx * 1.05, 1.3, 0, 'body');
    cap.scale.set(0.35, 1, 1);
    car.add(cap);
  }
  car.add(mesh(geo.cyl(0.22, 0.25, 0.3, 16), mats.roof, 0, 1.9, 0, 'roof'));
  for (const x of [-0.7, 0.7]) {
    const band = new THREE.TorusGeometry(0.56, 0.03, 8, 28);
    band.rotateY(Math.PI / 2);
    car.add(mesh(band, mats.roof, x, 1.3, 0, 'roof'));
  }
  car.userData.decorY = { side: 1.3, top: 2.05, sideZ: 0.56, sideX: [-0.35, 0.35, -1.0, 1.0] };
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
    const x = Math.cos(a) * r;
    const y = Math.sin(a) * r;
    if (i === 0) s.moveTo(x, y);
    else s.lineTo(x, y);
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

const DECOR_GEO = {};
function decorGeo(key, make) {
  DECOR_GEO[key] ??= make();
  return DECOR_GEO[key];
}

const BALLOON_COLORS = ['#e8453c', '#3b7cc9', '#f2c832', '#4fa65a', '#f08bb4'];

// Seitenschmuck wird auf beiden Seiten angebracht
function sideDecor(kind) {
  const g = new THREE.Group();
  if (kind === 'stern') {
    g.add(mesh(decorGeo('stern', () => extrude(starShape(0.24, 0.1))),
      new THREE.MeshStandardMaterial({ color: '#f5c53a', roughness: 0.4, metalness: 0.2 })));
  } else if (kind === 'herz') {
    g.add(mesh(decorGeo('herz', () => extrude(heartShape(0.2))),
      new THREE.MeshStandardMaterial({ color: '#e5484d', roughness: 0.4 })));
  } else if (kind === 'blume') {
    const petal = decorGeo('petal', () => new THREE.SphereGeometry(0.09, 12, 8));
    const pm = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.6 });
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const p = mesh(petal, pm, Math.cos(a) * 0.13, Math.sin(a) * 0.13, 0);
      p.scale.z = 0.4;
      g.add(p);
    }
    const c = mesh(petal, new THREE.MeshStandardMaterial({ color: '#f2b705' }), 0, 0, 0.02);
    c.scale.set(0.9, 0.9, 0.5);
    g.add(c);
  } else if (kind === 'lampe') {
    const bulb = mesh(decorGeo('bulb', () => new THREE.SphereGeometry(0.13, 16, 12)),
      new THREE.MeshStandardMaterial({ color: '#fff6d0', emissive: '#ffc94d', emissiveIntensity: 1.2 }), 0, 0, 0.08);
    g.add(bulb, mesh(decorGeo('lampbase', () => geo.cyl(0.08, 0.08, 0.1, 12).rotateX(Math.PI / 2)), shared.metal, 0, 0, 0));
    g.userData.glow = bulb;
  }
  return g;
}

function topDecor(kind, index) {
  const g = new THREE.Group();
  if (kind === 'fahne') {
    g.add(mesh(decorGeo('pole', () => geo.cyl(0.025, 0.025, 0.8, 8)), shared.metal, 0, 0.4, 0));
    const tri = new THREE.Shape();
    tri.moveTo(0, 0);
    tri.lineTo(0.5, -0.15);
    tri.lineTo(0, -0.3);
    const flag = mesh(decorGeo('flag', () => new THREE.ShapeGeometry(tri)),
      new THREE.MeshStandardMaterial({ color: '#e5484d', side: THREE.DoubleSide }), 0.02, 0.78, 0);
    g.add(flag);
    g.userData.flag = flag;
  } else if (kind === 'ballon') {
    const color = BALLOON_COLORS[index % BALLOON_COLORS.length];
    const b = mesh(decorGeo('balloon', () => new THREE.SphereGeometry(0.28, 20, 16)),
      new THREE.MeshStandardMaterial({ color, roughness: 0.3 }), 0, 1.35, 0);
    b.scale.set(1, 1.2, 1);
    const string = mesh(decorGeo('string', () => geo.cyl(0.008, 0.008, 1.0, 4)),
      new THREE.MeshBasicMaterial({ color: '#666' }), 0, 0.55, 0);
    g.add(b, string);
    g.userData.balloon = b;
  }
  return g;
}

function addDecor(car) {
  const d = car.userData.decorY;
  car.userData.data.decor.forEach((kind, i) => {
    const x = d.sideX[i % d.sideX.length];
    let item;
    if (kind === 'fahne' || kind === 'ballon') {
      item = topDecor(kind, i);
      item.position.set(x * 0.8, d.top, 0);
    } else {
      item = new THREE.Group();
      for (const side of [1, -1]) {
        const s = sideDecor(kind);
        s.position.set(x, d.side, side * (d.sideZ + 0.03));
        if (side < 0) s.rotation.y = Math.PI;
        item.add(s);
      }
    }
    item.userData.removable = { list: 'decor', index: i };
    item.traverse((o) => { o.userData.owner = item; });
    car.userData.decorItems.push(item);
    car.add(item);
  });
}

// ---------- Ladung (Emoji-Bilder, die immer zur Kamera schauen) ----------

const emojiTextures = new Map();
export function emojiTexture(emoji) {
  if (!emojiTextures.has(emoji)) {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d');
    g.font = '104px "Noto Color Emoji", "Apple Color Emoji", "Segoe UI Emoji", sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(emoji, 64, 72);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    emojiTextures.set(emoji, tex);
  }
  return emojiTextures.get(emoji);
}

function addCargo(car) {
  const def = partDef(car.userData.data.type);
  const n = def.slots ?? 0;
  const xs = n === 3 ? [-0.75, 0, 0.75] : [];
  car.userData.data.cargo.forEach((id, i) => {
    const c = CARGO.find((k) => k.id === id);
    if (!c || i >= xs.length) return;
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: emojiTexture(c.emoji) }));
    sprite.scale.set(0.95, 0.95, 1);
    sprite.position.set(xs[i], car.userData.cargoY, 0);
    sprite.userData.baseY = car.userData.cargoY;
    sprite.userData.phase = i * 1.7;
    sprite.userData.removable = { list: 'cargo', index: i };
    sprite.userData.owner = sprite;
    car.userData.cargoItems.push(sprite);
    car.add(sprite);
  });
}

// ---------- Wagen bauen ----------

export function buildCar(data) {
  const car = new THREE.Group();
  car.userData = { data, wheels: [], decorItems: [], cargoItems: [], isLoco: isLoco(data.type) };
  const mats = {
    body: new THREE.MeshStandardMaterial({ color: data.paint.body, roughness: 0.55 }),
    roof: new THREE.MeshStandardMaterial({ color: data.paint.roof, roughness: 0.55 }),
    trim: new THREE.MeshStandardMaterial({ color: data.paint.trim, roughness: 0.6 }),
  };
  car.userData.mats = mats;
  const len = BUILDERS[data.type](car, mats);
  car.userData.length = len;
  addDecor(car);
  addCargo(car);
  car.traverse((o) => { o.userData.car ??= car; });
  car.userData.car = car;
  return car;
}

export function disposeCar(car) {
  Object.values(car.userData.mats ?? {}).forEach((m) => m.dispose());
}

// Animation pro Bild: Räder drehen, Ballons schweben, Fahnen flattern, Ladung wackelt
export function animateCar(car, time, distanceDelta, moving) {
  const rot = distanceDelta / WHEEL_R;
  for (const w of car.userData.wheels) w.rotation.z -= rot;
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
    const hop = moving ? Math.abs(Math.sin(time * 6 + s.userData.phase)) * 0.06 : Math.sin(time * 1.5 + s.userData.phase) * 0.02;
    s.position.y = s.userData.baseY + hop;
  }
}

export { DECOR };
