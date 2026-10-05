// Lebendige Tiere: Jedes Blender-Tier bekommt ein kleines Skelett (Körper, Kopf, Hals, Schwanz, Beine, Ohren, Flügel …).
// Die Gewichte werden beim Laden aus der Lage der Ecken berechnet (Bereiche mit weichen Übergängen) – das Modell
// selbst bleibt unverändert. Ein kleiner Verhaltens-Automat bewegt die Knochen: atmen, umschauen, grasen, picken,
// Schwanz wedeln, Ohren zucken, laufen (Beine im Kreuzgang), watscheln, hoppeln …
//
// Koordinaten wie im Modell: x = vorne (Blickrichtung), y = oben, z = Seite. Boden y = 0.
// Bewegt wird nur, was gerade gezeichnet wird (onBeforeRender) – unsichtbare Tiere kosten nichts.
//
// Steuerung von außen (fig.userData.life):
//   life.speed = m/s          → Laufbewegung (wer das Tier verschiebt, setzt das)
//   life.play('shake' | 'hop' | 'look' | …) → eine Aktion sofort spielen
//   life.calm = true          → keine eigenen Aktionen (z. B. beim Füttern)

import * as THREE from 'three';

// Bereich: [Richtung, von, bis] – Gewicht steigt weich von 0 (bei „von“) auf 1 (bei „bis“).
// Richtung: 'x' | 'y' | '|z|' | [ax, ay] (= ax·x + ay·y)
const RIGS = {
  kuh: {
    kind: 'grazer', body: [0, 0.47],
    head: { p: [0.24, 0.6], w: [['x', 0.18, 0.3], ['y', 0.36, 0.46]] },
    ears: { p: [0.31, 0.74, 0.13], w: [['|z|', 0.13, 0.17], ['y', 0.66, 0.7]] },
    tail: { p: [-0.34, 0.56], w: [['x', -0.3, -0.36]] },
    legs: { xs: [0.17, -0.17], zs: [0.09, -0.09], y: [0.36, 0.27], r: [0.09, 0.12] },
    acts: ['graze', 'graze', 'look', 'tail', 'ear', 'step', 'lookCam'],
  },
  schwein: {
    kind: 'grazer', body: [0, 0.36],
    head: { p: [0.2, 0.42], w: [['x', 0.16, 0.26], ['y', 0.2, 0.28]] },
    ears: { p: [0.31, 0.56, 0.08], w: [['|z|', 0.06, 0.09], ['y', 0.53, 0.57]] },
    tail: { p: [-0.3, 0.44], w: [['x', -0.28, -0.33]] },
    legs: { xs: [0.15, -0.15], zs: [0.1, -0.1], y: [0.2, 0.12], r: [0.08, 0.11] },
    acts: ['root', 'root', 'look', 'tail', 'ear', 'lookCam', 'step'],
  },
  schaf: {
    kind: 'grazer', body: [0, 0.45],
    head: { p: [0.24, 0.56], w: [['x', 0.22, 0.31], ['y', 0.44, 0.52]] },
    ears: { p: [0.26, 0.62, 0.08], w: [['|z|', 0.09, 0.12], ['y', 0.56, 0.6]] },
    tail: { p: [-0.28, 0.5], w: [['x', -0.3, -0.34]] },
    legs: { xs: [0.13, -0.13], zs: [0.08, -0.08], y: [0.3, 0.22], r: [0.05, 0.08] },
    acts: ['graze', 'graze', 'look', 'ear', 'tail', 'lookCam', 'step'],
  },
  hund: {
    kind: 'dog', body: [0, 0.37],
    head: { p: [0.22, 0.5], w: [['x', 0.17, 0.25], ['y', 0.42, 0.5]] },
    tail: { p: [-0.22, 0.44], w: [['x', -0.21, -0.26]] },
    legs: { xs: [0.14, -0.14], zs: [0.075, -0.075], y: [0.3, 0.22], r: [0.065, 0.095] },
    acts: ['wag', 'sniff', 'look', 'lookCam', 'wag', 'step', 'scratch'],
  },
  katze: {
    kind: 'cat', body: [0, 0.3],
    head: { p: [0.15, 0.4], w: [['x', 0.12, 0.2], ['y', 0.36, 0.44]] },
    ears: { p: [0.2, 0.6, 0.06], w: [['y', 0.59, 0.62], ['|z|', 0.03, 0.05]] },
    tail: { p: [-0.08, 0.42], w: [['x', -0.03, -0.09], ['y', 0.39, 0.43]] },
    legs: { xs: [0.11, -0.11], zs: [0.06, -0.06], y: [0.22, 0.15], r: [0.05, 0.075] },
    acts: ['look', 'lookCam', 'ear', 'tail', 'stretch', 'lick'],
  },
  ente: {
    kind: 'bird', body: [0, 0.22],
    head: { p: [0.15, 0.32], w: [['y', 0.3, 0.37], ['x', 0.06, 0.12]] },
    tail: { p: [-0.18, 0.28], w: [['x', -0.17, -0.23]] },
    wings: { p: [0.04, 0.3, 0.15], w: [['|z|', 0.17, 0.2]] },
    acts: ['peck', 'look', 'flap', 'tail', 'lookCam', 'preen'],
  },
  pferd: {
    kind: 'grazer', body: [0, 0.6],
    neck: { p: [0.24, 0.72], w: [['x', 0.2, 0.28], ['y', 0.62, 0.72]] },
    head: { p: [0.42, 0.97], w: [['x', 0.37, 0.43]] },
    tail: { p: [-0.33, 0.64], w: [['x', -0.3, -0.36]] },
    legs: { xs: [0.21, -0.21], zs: [0.09, -0.09], y: [0.48, 0.38], r: [0.07, 0.1] },
    acts: ['graze', 'graze', 'look', 'tail', 'shake', 'step', 'lookCam', 'paw'],
  },
  huhn: {
    kind: 'bird', body: [0, 0.28],
    head: { p: [0.1, 0.36], w: [['y', 0.35, 0.41], ['x', 0.02, 0.08]] },
    tail: { p: [-0.14, 0.33], w: [['x', -0.13, -0.19]] },
    wings: { p: [0.06, 0.34, 0.12], w: [['|z|', 0.14, 0.165]] },
    legs: { xs: [0.02], zs: [0.05, -0.05], y: [0.14, 0.11], r: [0.035, 0.06] },
    acts: ['peck', 'peck', 'look', 'flap', 'lookCam', 'peck'],
  },
  hase: {
    kind: 'hopper', body: [0, 0.21],
    head: { p: [0.1, 0.31], w: [['y', 0.3, 0.36], ['x', 0.03, 0.09]] },
    ears: { p: [0.11, 0.5, 0.05], w: [['y', 0.49, 0.53], ['|z|', 0.005, 0.03]] },
    tail: { p: [-0.16, 0.24], w: [['x', -0.17, -0.21]] },
    acts: ['sniff', 'ear', 'look', 'hop', 'lookCam', 'ear'],
  },
  frosch: {
    kind: 'hopper', body: [0, 0.16],
    head: { p: [0.06, 0.2], w: [['y', 0.22, 0.27], ['x', -0.02, 0.04]] },
    hind: { p: [-0.02, 0.1, 0.14], w: [['|z|', 0.11, 0.15], ['x', -0.02, -0.06]] },
    acts: ['hop', 'look', 'croak', 'lookCam', 'hop'],
  },
  loewe: {
    kind: 'cat', body: [0, 0.42],
    head: { p: [0.2, 0.55], w: [['x', 0.13, 0.21], ['y', 0.4, 0.48]] },
    tail: { p: [-0.25, 0.47], w: [['x', -0.25, -0.3]] },
    legs: { xs: [0.16, -0.16], zs: [0.09, -0.09], y: [0.32, 0.24], r: [0.08, 0.11] },
    acts: ['look', 'yawn', 'tail', 'lookCam', 'shake', 'tail', 'step'],
  },
  elefant: {
    kind: 'grazer', body: [0, 0.5],
    head: { p: [0.3, 0.62], w: [[[1, 0.6], 0.56, 0.64]] },
    trunk: { p: [0.5, 0.52], w: [['x', 0.44, 0.5], ['y', 0.56, 0.5], ['|z|', 0.085, 0.06]] },
    ears: { p: [0.42, 0.62, 0.2], w: [['|z|', 0.198, 0.222]] },
    tail: { p: [-0.36, 0.52], w: [['x', -0.35, -0.4]] },
    legs: { xs: [0.19, -0.19], zs: [0.12, -0.12], y: [0.3, 0.21], r: [0.11, 0.14] },
    acts: ['earflap', 'trumpet', 'look', 'trunk', 'tail', 'lookCam', 'earflap', 'step'],
  },
  giraffe: {
    kind: 'grazer', body: [0, 0.66],
    neck: { p: [0.12, 0.76], w: [[[0.5, 1], 0.8, 0.88]] },
    head: { p: [0.3, 1.24], w: [['y', 1.2, 1.26]] },
    tail: { p: [-0.21, 0.68], w: [['x', -0.2, -0.25]] },
    legs: { xs: [0.13, -0.13], zs: [0.07, -0.07], y: [0.56, 0.47], r: [0.045, 0.07] },
    acts: ['browse', 'look', 'tail', 'lookCam', 'browse', 'shake', 'step'],
  },
  pinguin: {
    kind: 'waddler', body: [0, 0.29],
    head: { p: [0.02, 0.42], w: [['y', 0.4, 0.46]] },
    wings: { p: [0, 0.42, 0.15], w: [['|z|', 0.165, 0.185]] },
    acts: ['flap', 'look', 'lookCam', 'flap', 'hop', 'preen'],
  },
  affe: {
    kind: 'monkey', body: [0, 0.3],
    head: { p: [0.01, 0.46], w: [['y', 0.44, 0.49]] },
    arms: { p: [0.03, 0.42, 0.155], w: [['|z|', 0.119, 0.126], ['y', 0.1, 0.12]] },
    hind: { p: [0.02, 0.11, 0.075], w: [['y', 0.13, 0.09], ['x', 0.0, 0.05], ['|z|', 0.02, 0.05]] },
    tail: { p: [-0.11, 0.2], w: [['x', -0.1, -0.14]] },
    acts: ['scratch', 'clap', 'look', 'lookCam', 'hop', 'wave', 'tail', 'scratch'],
  },
  // Entdecker-Tiere
  fuchs: {
    kind: 'dog', body: [0, 0.3],
    head: { p: [0.15, 0.38], w: [['x', 0.11, 0.18], ['y', 0.3, 0.36]] },
    tail: { p: [-0.18, 0.34], w: [['x', -0.17, -0.22]] },
    legs: { xs: [0.12, -0.12], zs: [0.06, -0.06], y: [0.22, 0.15], r: [0.045, 0.07] },
    acts: ['sniff', 'look', 'tail', 'lookCam', 'ear'],
  },
  reh: {
    kind: 'grazer', body: [0, 0.45],
    neck: { p: [0.13, 0.52], w: [['x', 0.12, 0.18], ['y', 0.5, 0.56]] },
    ears: { p: [0.2, 0.76, 0.04], w: [['|z|', 0.05, 0.07], ['y', 0.74, 0.77]] },
    tail: { p: [-0.18, 0.5], w: [['x', -0.18, -0.22]] },
    legs: { xs: [0.12, -0.12], zs: [0.055, -0.055], y: [0.37, 0.3], r: [0.035, 0.055] },
    acts: ['graze', 'look', 'ear', 'lookCam', 'tail'],
  },
  igel: { kind: 'small', body: [0, 0.13], head: { p: [0.1, 0.1], w: [['x', 0.1, 0.15]] }, acts: ['sniff', 'look', 'lookCam'] },
  eichhoernchen: {
    kind: 'small', body: [0, 0.16],
    head: { p: [0.05, 0.24], w: [['y', 0.22, 0.27]] },
    tail: { p: [-0.08, 0.15], w: [['x', -0.08, -0.12]] },
    acts: ['nibble', 'look', 'tail', 'lookCam', 'hop'],
  },
  storch: {
    kind: 'bird', body: [0, 0.5],
    head: { p: [0.08, 0.6], w: [['y', 0.58, 0.64], ['x', 0.03, 0.08]] },
    wings: { p: [0.06, 0.55, 0.08], w: [['|z|', 0.09, 0.11]] },
    legs: { xs: [0], zs: [0.04, -0.04], y: [0.41, 0.39], r: [0.02, 0.035] },
    acts: ['look', 'clatter', 'flap', 'lookCam'],
  },
  fisch: { kind: 'fish', body: [0, 0], tail: { p: [-0.1, 0], w: [['x', -0.09, -0.14]] }, acts: [] },
  maulwurf: { kind: 'peek', body: [0, 0.09], bodyW: [['y', 0.08, 0.11]], acts: ['look', 'sniff', 'lookCam'] },
  eule: {
    kind: 'bird', body: [0, 0.17],
    head: { p: [0, 0.25], w: [['y', 0.24, 0.28]] },
    wings: { p: [0, 0.25, 0.1], w: [['|z|', 0.1, 0.125]] },
    acts: ['owl', 'look', 'flap', 'lookCam', 'owl'],
  },
  schnecke: { kind: 'small', body: [0, 0.04], head: { p: [0.1, 0.06], w: [['x', 0.08, 0.12]] }, acts: ['look', 'sniff'] },
  biber: {
    kind: 'small', body: [0, 0.15],
    head: { p: [0.1, 0.22], w: [['x', 0.07, 0.12], ['y', 0.17, 0.22]] },
    tail: { p: [-0.1, 0.05], w: [['x', -0.1, -0.14]] },
    acts: ['nibble', 'look', 'slap', 'lookCam'],
  },
};
RIGS.hahn = { ...RIGS.huhn, acts: ['peck', 'look', 'crow', 'flap', 'lookCam', 'peck'] };

export const hasLife = (id) => id in RIGS;

// ---------- Skelett und Gewichte ----------

const smooth = (a, b, v) => {
  const t = Math.min(1, Math.max(0, (v - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

function rampValue(dir, x, y, z) {
  if (dir === 'x') return x;
  if (dir === 'y') return y;
  if (dir === '|z|') return Math.abs(z);
  return dir[0] * x + dir[1] * y;
}

function regionWeight(w, x, y, z) {
  let k = 1;
  for (const [dir, a, b] of w) {
    k *= smooth(a, b, rampValue(dir, x, y, z));
    if (k === 0) return 0;
  }
  return k;
}

// Knochenliste: [Name, Eltern, Drehpunkt, Gewichtsfunktion(x,y,z) → 0..1]
function boneList(rig) {
  const L = [];
  const [bx, by] = rig.body;
  L.push(['root', null, [0, 0, 0], null]);
  L.push(['body', 'root', [bx, by, 0], rig.bodyW ? (x, y, z) => regionWeight(rig.bodyW, x, y, z) : () => 1]);
  const region = (name, parent, spec) => L.push([name, parent, [spec.p[0], spec.p[1], spec.p[2] ?? 0], (x, y, z) => regionWeight(spec.w, x, y, z)]);
  // paarig: links (z > 0) und rechts (z < 0)
  const pair = (base, parent, spec) => {
    for (const s of [1, -1]) {
      L.push([base + (s > 0 ? 'L' : 'R'), parent, [spec.p[0], spec.p[1], s * spec.p[2]], (x, y, z) => (z * s > 0 ? regionWeight(spec.w, x, y, z) : 0)]);
    }
  };
  if (rig.neck) region('neck', 'body', rig.neck);
  if (rig.head) region('head', rig.neck ? 'neck' : 'body', rig.head);
  else if (rig.neck) L.push(['head', 'neck', [rig.neck.p[0], rig.neck.p[1], 0], () => 0]);
  if (rig.trunk) region('trunk', 'head', rig.trunk);
  if (rig.ears) pair('ear', rig.head || rig.neck ? 'head' : 'body', rig.ears);
  if (rig.tail) region('tail', 'body', rig.tail);
  if (rig.wings) pair('wing', 'body', rig.wings);
  if (rig.arms) pair('arm', 'body', rig.arms);
  if (rig.hind) pair('hind', 'body', rig.hind);
  if (rig.legs) {
    const { xs, zs, y: [y0, y1], r: [r0, r1] } = rig.legs;
    for (const lx of xs) {
      for (const lz of zs) {
        const name = `leg${lx >= 0 ? 'F' : 'B'}${lz > 0 ? 'L' : 'R'}`;
        L.push([name, 'body', [lx, y0, lz], (x, y, z) => {
          // nur das nächste Bein bekommt die Ecke
          const nx = xs.length > 1 ? (Math.abs(x - xs[0]) < Math.abs(x - xs[1]) ? xs[0] : xs[1]) : xs[0];
          const nz = Math.abs(z - zs[0]) < Math.abs(z - zs[1]) ? zs[0] : zs[1];
          if (nx !== lx || nz !== lz) return 0;
          return smooth(y0, y1, y) * smooth(r1, r0, Math.hypot(x - lx, z - lz));
        }]);
      }
    }
  }
  return L;
}

const skinCache = new Map();

// Gewichte je Modell einmal berechnen (die Geometrie wird von allen Figuren desselben Tiers geteilt)
function skinGeometry(id, geometry, list) {
  if (skinCache.has(id)) return skinCache.get(id);
  const pos = geometry.attributes.position;
  const n = pos.count;
  const nb = list.length;
  const index = new Uint16Array(n * 4);
  const weight = new Float32Array(n * 4);
  const W = new Float32Array(nb);
  const parentIdx = list.map(([, parent]) => list.findIndex(([name]) => name === parent));
  for (let i = 0; i < n; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    W.fill(0);
    W[0] = 1;
    for (let b = 1; b < nb; b++) {
      const w = list[b][3](x, y, z);
      if (w <= 0) continue;
      const p = parentIdx[b];
      const moved = W[p] * w;
      W[p] -= moved;
      W[b] += moved;
    }
    // die vier stärksten Knochen
    const top = [...W.keys()].sort((a, b) => W[b] - W[a]).slice(0, 4);
    let sum = 0;
    for (const b of top) sum += W[b];
    top.forEach((b, k) => {
      index[i * 4 + k] = b;
      weight[i * 4 + k] = W[b] / sum;
    });
  }
  geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(index, 4));
  geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute(weight, 4));
  skinCache.set(id, true);
  return true;
}

// Ersetzt das starre Mesh durch ein bewegliches. Gibt das neue Mesh zurück.
export function makeSkinned(id, geometry, material) {
  const rig = RIGS[id];
  const list = boneList(rig);
  skinGeometry(id, geometry, list);
  const mesh = new THREE.SkinnedMesh(geometry, material);
  const bones = {};
  const all = list.map(([name, parent, p]) => {
    const b = new THREE.Bone();
    b.name = name;
    bones[name] = b;
    b.userData.pivot = p;
    return b;
  });
  list.forEach(([, parent], i) => {
    const b = all[i];
    const p = b.userData.pivot;
    if (parent) {
      const pp = bones[parent].userData.pivot;
      b.position.set(p[0] - pp[0], p[1] - pp[1], p[2] - pp[2]);
      bones[parent].add(b);
    } else {
      b.position.set(...p);
      mesh.add(b);
    }
    b.userData.rest = b.position.clone();
  });
  mesh.updateMatrixWorld(true);
  mesh.bind(new THREE.Skeleton(all), new THREE.Matrix4());
  // Kugel großzügig (Bewegung), damit nichts zu früh weggelassen wird und Antippen weiter klappt
  geometry.computeBoundingBox();
  mesh.boundingBox = geometry.boundingBox.clone();
  mesh.boundingSphere = geometry.boundingSphere.clone();
  mesh.boundingSphere.radius *= 1.35;
  mesh.castShadow = true;
  mesh.userData.bones = bones;
  return mesh;
}

// ---------- Verhalten ----------

export const lifeClock = { time: 0 };

const env = (u, a = 0.2) => smooth(0, a, u) * smooth(1, 1 - a, u);
const rnd = (a, b) => a + Math.random() * (b - a);

// Aktionen: Dauer [min, max] und Wirkung auf die Pose (u = 0..1 Fortschritt, t = Sekunden seit Beginn)
const ACTS = {
  look: { dur: [1.6, 3], start: (L) => { L.aim = [rnd(-0.75, 0.75), rnd(-0.15, 0.25)]; }, fn: (P, u, t, L) => { P.headYaw += L.aim[0] * env(u); P.headPitch += L.aim[1] * env(u); } },
  lookCam: { dur: [1.8, 3], fn: (P, u, t, L) => { P.headYaw += L.camYaw * env(u); P.headPitch += L.camPitch * env(u); P.earFlick += 0.15 * env(u); } },
  graze: { dur: [3, 6], fn: (P, u, t, L) => {
    const e = env(u, 0.15);
    P.neckPitch -= 0.95 * e; P.headPitch -= (L.rig.neck ? 0.35 : 1.2) * e;
    P.headPitch += Math.sin(t * 11) * 0.04 * e; P.headYaw += Math.sin(t * 0.9) * 0.15 * e;
    P.bodyPitch -= 0.07 * e;
  } },
  root: { dur: [2, 4], fn: (P, u, t) => { const e = env(u, 0.15); P.headPitch -= (0.7 + Math.sin(t * 9) * 0.15) * e; P.headYaw += Math.sin(t * 3) * 0.2 * e; } },
  browse: { dur: [2.5, 4], fn: (P, u, t) => { const e = env(u); P.neckPitch += 0.25 * e; P.headPitch += 0.2 * e + Math.sin(t * 10) * 0.04 * e; P.headYaw += Math.sin(t * 1.3) * 0.3 * e; } },
  tail: { dur: [1, 1.8], fn: (P, u, t) => { P.tailYaw += Math.sin(t * 9) * 0.7 * env(u); P.tailLift += 0.2 * env(u); } },
  wag: { dur: [1.5, 3], fn: (P, u, t) => { P.tailYaw += Math.sin(t * 22) * 0.6 * env(u, 0.1); P.tailLift += 0.5 * env(u, 0.1); P.bodyRoll += Math.sin(t * 22) * 0.03 * env(u); } },
  ear: { dur: [0.5, 0.7], start: (L) => { L.earSide = Math.random() < 0.5 ? 1 : -1; }, fn: (P, u, t, L) => { const k = Math.sin(u * Math.PI * 4) * 0.5 * env(u, 0.1); if (L.earSide > 0) P.earL += k; else P.earR += k; } },
  shake: { dur: [0.7, 0.9], fn: (P, u, t) => { P.headRoll += Math.sin(t * 28) * 0.45 * env(u, 0.15); P.headYaw += Math.sin(t * 28) * 0.25 * env(u, 0.15); P.earFlick += 0.4 * env(u); } },
  nope: { dur: [0.8, 0.8], fn: (P, u, t) => { P.headYaw += Math.sin(t * 20) * 0.6 * env(u, 0.1); P.headPitch -= 0.1 * env(u); } },
  sniff: { dur: [1.2, 2], fn: (P, u, t) => { const e = env(u); P.headPitch -= 0.45 * e + Math.abs(Math.sin(t * 14)) * 0.06 * e; P.headYaw += Math.sin(t * 2.5) * 0.25 * e; } },
  peck: { dur: [0.9, 1.6], fn: (P, u, t) => { P.headPitch -= Math.max(0, Math.sin(t * 13)) * 1.0 * env(u, 0.05); P.bodyPitch -= 0.18 * env(u); } },
  flap: { dur: [0.8, 1.2], fn: (P, u, t) => { P.wings += Math.abs(Math.sin(t * 20)) * 1.1 * env(u, 0.1); P.lift += Math.abs(Math.sin(t * 20)) * 0.02 * env(u); } },
  preen: { dur: [1.2, 2], start: (L) => { L.earSide = Math.random() < 0.5 ? 1 : -1; }, fn: (P, u, t, L) => { const e = env(u); P.headYaw += L.earSide * 1.6 * e; P.headPitch -= 0.4 * e + Math.sin(t * 16) * 0.08 * e; } },
  hop: { dur: [0.55, 0.55], fn: (P, u) => { P.lift += Math.sin(u * Math.PI) * 0.16; P.bodyPitch += Math.sin(u * Math.PI * 2) * 0.15; P.hind += Math.sin(u * Math.PI) * 0.9; P.arms += Math.sin(u * Math.PI) * 1.2; } },
  croak: { dur: [1, 1.4], fn: (P, u, t, L) => { L.mouth = Math.max(0, Math.sin(t * 14)) * 0.7 * env(u); P.headPitch += 0.15 * env(u); P.breathe += Math.max(0, Math.sin(t * 14)) * 0.02; } },
  crow: { dur: [1.6, 1.6], fn: (P, u, t, L) => { const e = env(u, 0.25); P.headPitch += 0.7 * e; P.bodyPitch += 0.15 * e; P.wings += 0.5 * e; L.mouth = e * 0.9; } },
  yawn: { dur: [2, 2.4], fn: (P, u, t, L) => { const e = env(u, 0.3); P.headPitch += 0.55 * e; L.mouth = e * 0.75; P.earFlick -= 0.3 * e; } },
  trumpet: { dur: [1.6, 1.6], fn: (P, u, t, L) => { const e = env(u, 0.25); P.trunk += 1.6 * e; P.headPitch += 0.35 * e; P.earFlap += Math.sin(t * 9) * 0.25 * e + 0.2 * e; L.mouth = e * 0.6; } },
  trunk: { dur: [2, 3], fn: (P, u, t) => { const e = env(u); P.trunk += (0.4 + Math.sin(t * 4) * 0.4) * e; P.trunkSide += Math.sin(t * 2.5) * 0.4 * e; } },
  earflap: { dur: [1.5, 2.5], fn: (P, u, t) => { P.earFlap += (0.25 + Math.sin(t * 7) * 0.25) * env(u); } },
  step: { dur: [0.8, 1], start: (L) => { L.stepLeg = Math.floor(Math.random() * 4); }, fn: (P, u, t, L) => { P.legs[L.stepLeg] += Math.sin(u * Math.PI) * 0.5; P.legLift[L.stepLeg] += Math.sin(u * Math.PI); } },
  paw: { dur: [1.2, 1.2], fn: (P, u) => { P.legs[0] += Math.max(0, Math.sin(u * Math.PI * 3)) * 0.7; P.headPitch -= 0.2 * env(u); } },
  scratch: { dur: [1.4, 2], fn: (P, u, t, L) => {
    const e = env(u);
    if (L.rig.arms) { P.armL += 2.4 * e; P.armLTwist += Math.sin(t * 18) * 0.2 * e; P.headRoll -= 0.25 * e; } else { P.legs[3] += (0.6 + Math.sin(t * 20) * 0.35) * e; P.legLift[3] += e; P.headRoll += 0.3 * e; P.headYaw += 0.4 * e; }
  } },
  stretch: { dur: [2, 2.6], fn: (P, u) => { const e = env(u, 0.3); P.legs[0] += 0.7 * e; P.legs[1] += 0.7 * e; P.bodyPitch -= 0.25 * e; P.headPitch += 0.3 * e; P.tailLift += 0.6 * e; } },
  lick: { dur: [1.5, 2], fn: (P, u, t, L) => { const e = env(u); P.legs[0] += 0.9 * e; P.legLift[0] += e * 0.5; P.headPitch -= 0.35 * e; P.headYaw += 0.3 * e; L.mouth = Math.max(0, Math.sin(t * 12)) * 0.4 * e; } },
  clap: { dur: [1.2, 1.6], fn: (P, u, t) => { const e = env(u, 0.15); P.armL += 1.3 * e; P.armR += 1.3 * e; P.armIn += (0.25 + Math.sin(t * 22) * 0.25) * e; P.lift += Math.abs(Math.sin(t * 11)) * 0.02 * e; } },
  wave: { dur: [1.4, 1.4], fn: (P, u, t) => { const e = env(u, 0.15); P.armR += 2.6 * e; P.armRTwist += Math.sin(t * 16) * 0.4 * e; P.headRoll += 0.15 * e; } },
  owl: { dur: [2, 3], start: (L) => { L.earSide = Math.random() < 0.5 ? 1 : -1; }, fn: (P, u, t, L) => { P.headYaw += L.earSide * 2.2 * env(u, 0.2); } },
  clatter: { dur: [1.4, 1.4], fn: (P, u, t, L) => { const e = env(u, 0.2); P.headPitch += 0.9 * e; L.mouth = Math.max(0, Math.sin(t * 30)) * e; } },
  nibble: { dur: [1.5, 2.5], fn: (P, u, t) => { const e = env(u); P.headPitch -= 0.3 * e + Math.abs(Math.sin(t * 18)) * 0.06 * e; P.arms += 0.6 * e; } },
  slap: { dur: [0.8, 0.8], fn: (P, u) => { P.tailLift += Math.sin(u * Math.PI) * 1.0; } },
  // Rufen: Kopf hoch, Maul auf und zu (Muh, Mäh, Wau …)
  call: { dur: [1.1, 1.1], fn: (P, u, t, L) => {
    const e = env(u, 0.15);
    P.headPitch += 0.4 * e; P.neckPitch += 0.2 * e; L.mouth = (0.55 + 0.45 * Math.sin(t * 9)) * e;
    P.tailLift += 0.3 * e; P.tailYaw += Math.sin(t * 16) * 0.4 * e; P.earFlick += 0.3 * e; P.earFlap += 0.3 * e; P.wings += 0.4 * e;
  } },
  happy: { dur: [1.2, 1.2], fn: (P, u, t, L) => {
    P.lift += Math.abs(Math.sin(u * Math.PI * 2)) * 0.07; P.headPitch += 0.25 * env(u); P.tailYaw += Math.sin(t * 22) * 0.6 * env(u);
    P.tailLift += 0.4 * env(u); P.earFlick += 0.3 * env(u); P.wings += Math.abs(Math.sin(t * 18)) * 0.6 * env(u); P.arms += 1.5 * env(u);
  } },
};

function blankPose(P) {
  P.headYaw = P.headPitch = P.headRoll = P.neckPitch = 0;
  P.tailYaw = P.tailLift = 0;
  P.earL = P.earR = P.earFlick = P.earFlap = 0;
  P.trunk = P.trunkSide = 0;
  P.wings = 0;
  P.arms = P.armL = P.armR = P.armIn = P.armLTwist = P.armRTwist = 0;
  P.hind = 0;
  P.lift = P.bodyPitch = P.bodyRoll = P.breathe = 0;
  P.legs[0] = P.legs[1] = P.legs[2] = P.legs[3] = 0;
  P.legLift[0] = P.legLift[1] = P.legLift[2] = P.legLift[3] = 0;
  return P;
}

const LEG_ORDER = ['legFL', 'legFR', 'legBL', 'legBR'];
const _v = new THREE.Vector3();
const _m = new THREE.Matrix4();

export class Life {
  constructor(id, mesh, fig) {
    this.id = id;
    this.rig = RIGS[id];
    this.mesh = mesh;
    this.fig = fig;
    this.bones = mesh.userData.bones;
    this.speed = 0;
    this.calm = false;
    this.phase = Math.random() * 10;
    this.seed = Math.random() * 100;
    this.wait = rnd(0.5, 3);
    this.act = null;
    this.camYaw = 0;
    this.camPitch = 0;
    this.mouth = 0;
    this.last = null;
    this.P = blankPose({ legs: [0, 0, 0, 0], legLift: [0, 0, 0, 0] });
    mesh.onBeforeRender = (renderer, scene, camera) => this.frame(camera);
  }

  // Antippen / Rufen: passende Bewegung zum Tierlaut
  cheer() {
    const special = { elefant: 'trumpet', hahn: 'crow', frosch: 'croak', storch: 'clatter', affe: 'clap', hund: 'wag', fisch: 'happy' };
    this.play(special[this.id] ?? 'call');
  }

  play(name) {
    const a = ACTS[name];
    if (!a) return;
    this.act = { name, a, t: 0, dur: rnd(...a.dur) };
    a.start?.(this);
  }

  pickAction() {
    const acts = this.rig.acts;
    if (!acts?.length) return;
    let name = acts[Math.floor(Math.random() * acts.length)];
    if (this.speed > 0.05 && !['look', 'lookCam', 'tail', 'ear', 'wag', 'flap'].includes(name)) name = 'look';
    this.play(name);
  }

  frame(camera) {
    const now = lifeClock.time;
    if (this.last === null) this.last = now;
    const dt = Math.min(0.1, now - this.last);
    this.last = now;
    if (dt <= 0) return;
    this.update(dt, now, camera);
  }

  update(dt, time, camera) {
    const P = blankPose(this.P);
    const rig = this.rig;
    const S = this.fig.scale.x || 1;
    // Wohin ist die Kamera? (für „schaut mich an“)
    if (camera) {
      this.mesh.updateWorldMatrix(true, false);
      _v.copy(camera.position).applyMatrix4(_m.copy(this.mesh.matrixWorld).invert());
      const hp = rig.head?.p ?? rig.body;
      const dx = _v.x - hp[0];
      const dz = _v.z;
      this.camYaw = THREE.MathUtils.clamp(Math.atan2(-dz, dx), -1.1, 1.1);
      this.camPitch = THREE.MathUtils.clamp(Math.atan2(_v.y - hp[1], Math.hypot(dx, dz)) * 0.5, -0.3, 0.45);
    }
    // eigene Aktionen
    this.mouth = 0;
    if (this.fig.userData.eating) this.act = null; // beim Füttern still halten: das Futter fliegt zum Maul
    if (this.act) {
      this.act.t += dt;
      const u = Math.min(1, this.act.t / this.act.dur);
      this.act.a.fn(P, u, this.act.t, this);
      if (u >= 1) {
        this.act = null;
        this.wait = rnd(1.2, 4.5);
      }
    } else if (!this.calm && !this.fig.userData.eating) {
      this.wait -= dt;
      if (this.wait <= 0) this.pickAction();
    }
    // immer: atmen, kleine Kopfbewegungen, Schwanz pendelt, Elefantenrüssel schwingt
    const s = this.seed;
    P.breathe += Math.sin(time * 1.9 + s) * 0.006;
    P.headYaw += Math.sin(time * 0.37 + s) * 0.06;
    P.headPitch += Math.sin(time * 0.53 + s * 2) * 0.04;
    P.tailYaw += Math.sin(time * 1.3 + s) * (rig.kind === 'dog' ? 0.25 : 0.12);
    P.trunk += Math.sin(time * 0.8 + s) * 0.12;
    P.trunkSide += Math.sin(time * 0.6 + s) * 0.12;
    P.earFlap += Math.max(0, Math.sin(time * 0.9 + s)) * 0.12;
    if (rig.kind === 'fish') P.tailYaw += Math.sin(time * 5 + s) * 0.35;
    if (rig.kind === 'monkey') P.tailLift += Math.sin(time * 0.7 + s) * 0.15;
    // laufen
    const v = this.speed / S;
    if (v > 0.02) {
      const quad = !!rig.legs && rig.legs.xs.length > 1;
      const stride = quad ? 0.24 : 0.14;
      this.phase += dt * (v / stride) * Math.PI;
      const ph = this.phase;
      const amp = Math.min(1, v / 0.5);
      if (quad) {
        // Kreuzgang: vorne links + hinten rechts gleichzeitig
        const a = Math.sin(ph) * 0.55 * amp;
        P.legs[0] += a; P.legs[3] += a; P.legs[1] -= a; P.legs[2] -= a;
        P.lift += Math.abs(Math.cos(ph)) * 0.012 * amp;
        P.headPitch += Math.sin(ph * 2) * 0.05 * amp;
      } else if (rig.kind === 'hopper' || rig.kind === 'monkey') {
        const k = Math.max(0, Math.sin(ph * 0.5));
        P.lift += k * 0.1 * amp;
        P.bodyPitch += Math.sin(ph) * 0.12 * amp;
        P.hind += k * 0.8 * amp;
        P.arms += k * 0.6 * amp;
      } else {
        // watscheln (Vögel, Pinguin, kleine Tiere)
        P.bodyRoll += Math.sin(ph) * 0.14 * amp;
        P.lift += Math.abs(Math.sin(ph)) * 0.012 * amp;
        P.legs[0] += Math.sin(ph) * 0.5 * amp;
        P.legs[1] -= Math.sin(ph) * 0.5 * amp;
        P.headPitch += Math.sin(ph * 2) * 0.12 * amp;
      }
    }
    this.apply(P);
    if (this.mouth > 0 || this.mouthShown) {
      this.fig.userData.setMouth?.(Math.max(this.mouth, this.fig.userData.mouthV ?? 0));
      this.mouthShown = this.mouth > 0;
    }
  }

  apply(P) {
    const B = this.bones;
    const rest = (b) => b.position.copy(b.userData.rest);
    rest(B.body);
    B.body.position.y += P.lift + P.breathe;
    B.body.rotation.set(P.bodyRoll, 0, P.bodyPitch);
    if (B.neck) B.neck.rotation.set(0, P.headYaw * 0.4, P.neckPitch);
    if (B.head) {
      const k = B.neck ? 0.6 : 1;
      B.head.rotation.set(P.headRoll, P.headYaw * k, P.headPitch);
    }
    if (B.trunk) B.trunk.rotation.set(P.trunkSide, 0, P.trunk);
    if (B.earL) {
      if (this.id === 'elefant') {
        B.earL.rotation.set(0, P.earFlap, 0);
        B.earR.rotation.set(0, -P.earFlap, 0);
      } else {
        B.earL.rotation.set(-(P.earL + P.earFlick), 0, 0);
        B.earR.rotation.set(P.earR + P.earFlick, 0, 0);
      }
    }
    if (B.tail) B.tail.rotation.set(0, P.tailYaw, -P.tailLift);
    if (B.wingL) {
      B.wingL.rotation.set(-P.wings, 0, 0);
      B.wingR.rotation.set(P.wings, 0, 0);
    }
    if (B.armL) {
      B.armL.rotation.set(-P.armIn, P.armLTwist, P.arms + P.armL);
      B.armR.rotation.set(P.armIn, P.armRTwist, P.arms + P.armR);
    }
    if (B.hindL) {
      B.hindL.rotation.set(0, 0, P.hind);
      B.hindR.rotation.set(0, 0, P.hind);
    }
    LEG_ORDER.forEach((name, i) => {
      const b = B[name];
      if (!b) return;
      b.rotation.set(0, 0, P.legs[i]);
      rest(b);
      b.position.y += P.legLift[i] * 0.03;
    });
  }
}
