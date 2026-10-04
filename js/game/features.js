// Feste Landschaft: ein Fluss und eine Landstraße quer durchs ganze Gelände, zwei Berge.
// Malt das Kind eine Strecke darüber, entstehen automatisch Brücke, Bahnübergang oder Tunnel (siehe crossings.js).
// Auf der Straße fahren ständig Autos; an geschlossenen Schranken warten sie.

import * as THREE from 'three';
import { mergeStatic } from './merge.js';
import { RoundedBoxGeometry } from '../../vendor/RoundedBoxGeometry.js';
import { waterTexture } from './textures.js';
import { lamp } from './lamps.js';
import { makeBeam } from './beams.js';

const RIVER_WIDTH = 5;
const ROAD_WIDTH = 3.2;

const RIVER_PATH = [[-210, -51], [-120, -42], [-72, -14], [-30, -2], [6, 15], [39, 9], [69, 31], [111, 45], [210, 57]];
const ROAD_PATH = [[-225, 37], [-113, 40], [-57, 30], [-8, 24], [18, 20], [40, 17.5], [60, 9], [87, -12], [126, -39], [225, -51]];
// Koordinaten passend zur großen Karte (Spielfeld ±78 × ±50)
export const MOUNTAINS = [{ x: -40, z: -36, r: 11, h: 8 }, { x: 51, z: -33, r: 9.5, h: 7 }, { x: -58, z: 8, r: 10, h: 7.5 }];

function curveOf(path) {
  return new THREE.CatmullRomCurve3(path.map(([x, z]) => new THREE.Vector3(x, 0, z)), false, 'centripetal');
}

function samplesOf(curve, step = 1) {
  const L = curve.getLength();
  const n = Math.ceil(L / step);
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const p = curve.getPointAt(i / n);
    pts.push({ x: p.x, z: p.z, t: (i / n) * L });
  }
  return { pts, length: L };
}

// Flaches Band entlang einer Kurve (für Wasser, Ufer, Straße, Linien)
function ribbon(curve, width, y, material, offset = 0, uvLen = 4) {
  const L = curve.getLength();
  const n = Math.ceil(L / 0.8);
  const pos = [];
  const uv = [];
  const idx = [];
  for (let i = 0; i <= n; i++) {
    const u = i / n;
    const p = curve.getPointAt(u);
    const t = curve.getTangentAt(u);
    const nx = -t.z;
    const nz = t.x;
    const c = offset;
    pos.push(p.x + nx * (c + width / 2), y, p.z + nz * (c + width / 2), p.x + nx * (c - width / 2), y, p.z + nz * (c - width / 2));
    uv.push(0, (u * L) / uvLen, 1, (u * L) / uvLen);
    if (i < n) {
      const a = i * 2;
      idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, material);
  m.receiveShadow = true;
  return m;
}

function mountain(m) {
  const g = new THREE.Group();
  g.position.set(m.x, 0, m.z);
  // weicher, runder Berg (Zeichentrick-Stil): Wiese unten, Fels in der Mitte, Schneemütze oben
  const geo = new THREE.SphereGeometry(1, 56, 28, 0, Math.PI * 2, 0, Math.PI * 0.62);
  const pos = geo.attributes.position;
  const colors = [];
  const grass = new THREE.Color('#5c9946');
  const meadow = new THREE.Color('#6caa4f');
  const rock = new THREE.Color('#a8a093');
  const snow = new THREE.Color('#f7f7f4');
  for (let i = 0; i < pos.count; i++) {
    const v = new THREE.Vector3().fromBufferAttribute(pos, i);
    const n = 1 + 0.06 * Math.sin(v.x * 5 + m.x) * Math.cos(v.z * 4.5) + 0.04 * Math.sin(v.y * 7 + v.x * 3 + m.z);
    v.multiplyScalar(n);
    pos.setXYZ(i, v.x, v.y, v.z);
    // Schneegrenze leicht wellig
    const wave = 0.04 * Math.sin(Math.atan2(v.z, v.x) * 5 + m.x);
    let c = meadow.clone().lerp(grass, THREE.MathUtils.smoothstep(v.y, 0.1, 0.45));
    c = c.lerp(rock, THREE.MathUtils.smoothstep(v.y, 0.5 + wave, 0.66 + wave));
    c = c.lerp(snow, THREE.MathUtils.smoothstep(v.y, 0.9 + wave, 0.93 + wave));
    colors.push(c.r, c.g, c.b);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const hill = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 }));
  hill.scale.set(m.r, m.h, m.r);
  hill.position.y = -m.h * 0.12;
  hill.castShadow = true;
  hill.receiveShadow = true;
  g.add(hill);
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 + m.x;
    const k = i % 2 ? 0.62 : 0.76;
    const rr = m.r * k;
    const y = m.h * Math.sqrt(1 - k * k) - m.h * 0.12 - 0.1; // auf der Bergoberfläche
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 0.6, 6), new THREE.MeshStandardMaterial({ color: '#8a5a33' }));
    trunk.position.set(Math.cos(a) * rr, y, Math.sin(a) * rr);
    const crown = new THREE.Mesh(new THREE.ConeGeometry(0.6, 1.4, 8), new THREE.MeshStandardMaterial({ color: '#3f8a4a', roughness: 0.9 }));
    crown.position.set(Math.cos(a) * rr, y + 0.9, Math.sin(a) * rr);
    trunk.castShadow = crown.castShadow = true;
    g.add(trunk, crown);
  }
  return g;
}

const CAR_COLORS = ['#3b7cc9', '#e5484d', '#4fa65a', '#f2c832', '#8b5bb5', '#ee8a2b'];

function roadCar(color) {
  const c = new THREE.Group();
  const m = new THREE.MeshPhysicalMaterial({ color, roughness: 0.3, clearcoat: 1 });
  const add = (geo, mat, x, y, z) => {
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    c.add(mesh);
    return mesh;
  };
  add(new RoundedBoxGeometry(1.7, 0.36, 0.9, 2, 0.15), m, 0, 0.36, 0);
  add(new RoundedBoxGeometry(0.9, 0.34, 0.8, 2, 0.15), m, -0.1, 0.66, 0);
  add(new THREE.BoxGeometry(0.02, 0.25, 0.7), new THREE.MeshStandardMaterial({ color: '#233345', roughness: 0.1 }), 0.36, 0.68, 0);
  for (const x of [0.55, -0.55]) {
    for (const z of [0.42, -0.42]) add(new THREE.CylinderGeometry(0.18, 0.18, 0.14, 14).rotateX(Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#2a2a2a' }), x, 0.18, z);
  }
  for (const z of [0.25, -0.25]) add(new THREE.SphereGeometry(0.07, 8, 6), lamp(new THREE.MeshStandardMaterial({ color: '#fff6d8', emissive: '#ffd36b' }), 0.3, 2.5), 0.86, 0.4, z);
  // Rücklichter (nachts rot leuchtend)
  for (const z of [0.28, -0.28]) add(new THREE.BoxGeometry(0.04, 0.08, 0.16), lamp(new THREE.MeshStandardMaterial({ color: '#b3262b', emissive: '#ff3030' }), 0, 2.2), -0.86, 0.42, z);
  c.userData.action = 'hupen';
  c.traverse((o) => { o.userData.owner = c; });
  return c;
}

export function createFeatures(scene) {
  const river = curveOf(RIVER_PATH);
  const road = curveOf(ROAD_PATH);
  const riverS = samplesOf(river);
  const roadS = samplesOf(road);
  const group = new THREE.Group();
  scene.add(group);

  // Fluss mit Sandufer
  const water = waterTexture().clone();
  water.repeat.set(1, 1);
  water.needsUpdate = true;
  group.add(ribbon(river, RIVER_WIDTH + 1.6, 0.02, new THREE.MeshStandardMaterial({ color: '#d9c9a0', roughness: 1, polygonOffset: true, polygonOffsetFactor: 2, polygonOffsetUnits: 2 })));
  const waterMesh = ribbon(river, RIVER_WIDTH, 0.05, new THREE.MeshStandardMaterial({ map: water, roughness: 0.1, metalness: 0.1 }), 0, RIVER_WIDTH);
  group.add(waterMesh);

  // Straße mit Randlinien und Mittelstreifen
  group.add(ribbon(road, ROAD_WIDTH, 0.04, new THREE.MeshStandardMaterial({ color: '#6b6f75', roughness: 0.9, polygonOffset: true, polygonOffsetFactor: 2, polygonOffsetUnits: 2 })));
  const white = new THREE.MeshStandardMaterial({ color: '#f5f1ea', roughness: 0.8 });
  group.add(ribbon(road, 0.1, 0.055, white, 1.45), ribbon(road, 0.1, 0.055, white, -1.45));
  // Mittelstreifen als eine einzige Instanz-Gruppe (statt hunderter Einzelteile)
  const dashGeo = new THREE.PlaneGeometry(0.1, 1.0).rotateX(-Math.PI / 2);
  const dashCount = Math.floor(roadS.length / 2.2);
  const dashes = new THREE.InstancedMesh(dashGeo, white, dashCount);
  const dm = new THREE.Matrix4();
  const dq = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  const one = new THREE.Vector3(1, 1, 1);
  for (let i = 0; i < dashCount; i++) {
    const u = (i * 2.2) / roadS.length;
    const p = road.getPointAt(u);
    const tg = road.getTangentAt(u);
    dq.setFromAxisAngle(up, Math.atan2(tg.x, tg.z));
    dashes.setMatrixAt(i, dm.compose(new THREE.Vector3(p.x, 0.055, p.z), dq, one));
  }
  dashes.receiveShadow = true;
  group.add(dashes);

  // Straßenbrücke über den Fluss (Fluss und Straße liegen fest, also einmal berechnen)
  const rb = intersections(roadS.pts, riverS.pts, false)[0];
  if (rb) {
    const tg = road.getTangentAt(rb.ta / roadS.length);
    const ang = Math.atan2(-tg.z, tg.x);
    const bridge = new THREE.Group();
    bridge.position.set(rb.x, 0, rb.z);
    bridge.rotation.y = ang;
    const stone = new THREE.MeshStandardMaterial({ color: '#b9b1a3', roughness: 0.9 });
    const deck = new THREE.Mesh(new RoundedBoxGeometry(RIVER_WIDTH + 5, 0.2, ROAD_WIDTH + 0.8, 2, 0.05), stone);
    deck.position.y = 0.06;
    deck.receiveShadow = true;
    bridge.add(deck);
    for (const z of [ROAD_WIDTH / 2 + 0.3, -(ROAD_WIDTH / 2 + 0.3)]) {
      const rail = new THREE.Mesh(new RoundedBoxGeometry(RIVER_WIDTH + 5, 0.5, 0.25, 2, 0.06), stone);
      rail.position.set(0, 0.35, z);
      rail.castShadow = true;
      bridge.add(rail);
    }
    group.add(bridge);
  }

  // Berge
  for (const m of MOUNTAINS) group.add(mountain(m));

  // Autos auf der Straße (beide Richtungen)
  const cars = [];
  const CARS = 9;
  for (let i = 0; i < CARS; i++) {
    const c = roadCar(CAR_COLORS[i % CAR_COLORS.length]);
    c.userData.t = (i / CARS) * roadS.length;
    c.userData.dir = i % 2 ? 1 : -1;
    c.userData.speed = 3 + (i % 3) * 0.6;
    mergeStatic(c);
    const beam = makeBeam({ length: 6, width: 2.2, height: 0.4, kind: 'car' });
    beam.position.x = 0.86;
    c.add(beam);
    group.add(c);
    cars.push(c);
  }

  // Abstand eines Punktes zu Fluss, Straße, Bergen – damit Bäume und Blumen ausweichen
  function distTo(samples, x, z) {
    let best = Infinity;
    for (const p of samples) {
      const d = (p.x - x) ** 2 + (p.z - z) ** 2;
      if (d < best) best = d;
    }
    return Math.sqrt(best);
  }

  const riverDist = (x, z) => distTo(riverS.pts, x, z);
  // Nächste Stelle auf der Straße: { t (Länge entlang der Straße), d (Abstand) }
  function roadNearest(x, z) {
    let best = Infinity;
    let t = 0;
    for (const p of roadS.pts) {
      const d = (p.x - x) ** 2 + (p.z - z) ** 2;
      if (d < best) {
        best = d;
        t = p.t;
      }
    }
    return { t, d: Math.sqrt(best) };
  }

  function blocked(x, z, pad = 1) {
    if (distTo(riverS.pts, x, z) < RIVER_WIDTH / 2 + 0.8 + pad) return true;
    if (distTo(roadS.pts, x, z) < ROAD_WIDTH / 2 + 0.6 + pad) return true;
    return MOUNTAINS.some((m) => Math.hypot(m.x - x, m.z - z) < m.r + pad);
  }

  // Verkehr: Autos fahren die ganze Straße entlang; vor geschlossenen Schranken halten sie
  function updateTraffic(dt, crossings = []) {
    water.offset.y -= dt * 0.06;
    const L = roadS.length;
    const p = new THREE.Vector3();
    const tg = new THREE.Vector3();
    const em = api.emergency; // Feuerwehr im Einsatz: Autos in der Nähe fahren an den Rand und bremsen (Rettungsgasse)
    for (const c of cars) {
      const { dir } = c.userData;
      const near = em && Math.abs(em.t - c.userData.t) < 11;
      c.userData.aside = THREE.MathUtils.clamp((c.userData.aside ?? 0) + (near ? dt * 2 : -dt), 0, 1);
      let t = c.userData.t + dir * c.userData.speed * dt * (1 - 0.65 * c.userData.aside);
      for (const x of crossings) {
        if (!x.closed) continue;
        const stop = dir > 0 ? x.t0 - 1.4 : x.t1 + 1.4;
        const before = dir > 0 ? c.userData.t <= stop + 0.01 : c.userData.t >= stop - 0.01;
        if (before) t = dir > 0 ? Math.min(t, stop) : Math.max(t, stop);
      }
      for (const o of cars) {
        if (o === c || o.userData.dir !== dir) continue;
        const gap = (o.userData.t - t) * dir;
        if (gap > 0 && gap < 2.6) t = o.userData.t - dir * 2.6;
      }
      if (t > L) t = 0;
      if (t < 0) t = L;
      c.userData.t = t;
      road.getPointAt(t / L, p);
      road.getTangentAt(t / L, tg);
      const lane = (dir > 0 ? -1 : 1) * (0.8 + 0.75 * c.userData.aside);
      c.position.set(p.x - tg.z * lane, 0.05, p.z + tg.x * lane);
      c.rotation.y = Math.atan2(-tg.z * dir, tg.x * dir);
    }
  }

  const api = { group, river, road, riverS, roadS, cars, blocked, riverDist, roadNearest, updateTraffic, riverWidth: RIVER_WIDTH, roadWidth: ROAD_WIDTH, emergency: null };
  return api;
}

// Schnittpunkte zweier Linienzüge (a darf geschlossen sein). Liefert Position und Länge entlang a und b.
export function intersections(a, b, closedA = true) {
  const out = [];
  const na = closedA ? a.length : a.length - 1;
  for (let i = 0; i < na; i++) {
    const p1 = a[i];
    const p2 = a[(i + 1) % a.length];
    for (let j = 0; j < b.length - 1; j++) {
      const q1 = b[j];
      const q2 = b[j + 1];
      const d = (p2.x - p1.x) * (q2.z - q1.z) - (p2.z - p1.z) * (q2.x - q1.x);
      if (Math.abs(d) < 1e-9) continue;
      const u = ((q1.x - p1.x) * (q2.z - q1.z) - (q1.z - p1.z) * (q2.x - q1.x)) / d;
      const v = ((q1.x - p1.x) * (p2.z - p1.z) - (q1.z - p1.z) * (p2.x - p1.x)) / d;
      if (u >= 0 && u < 1 && v >= 0 && v < 1) {
        const p2t = i + 1 === a.length ? p1.t + Math.hypot(p2.x - p1.x, p2.z - p1.z) : p2.t;
        out.push({
          x: p1.x + (p2.x - p1.x) * u,
          z: p1.z + (p2.z - p1.z) * u,
          ta: p1.t + (p2t - p1.t) * u,
          tb: q1.t + (q2.t - q1.t) * v,
          i,
        });
      }
    }
  }
  return out;
}
