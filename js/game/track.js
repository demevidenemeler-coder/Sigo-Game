// Schienen: aus einer mit dem Finger gemalten Linie wird eine geschlossene, geglättete Strecke.

import * as THREE from 'three';
import { gravelTexture, woodTexture } from './textures.js';

export const RAIL_TOP = 0.27; // Höhe der Schienenoberkante über dem Boden
const GAUGE = 0.42; // halbe Spurweite

// ---------- Linie aufbereiten ----------

function polyLength(pts, closed) {
  let L = 0;
  for (let i = 1; i < pts.length; i++) L += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  if (closed && pts.length > 1) {
    const a = pts[pts.length - 1];
    L += Math.hypot(a[0] - pts[0][0], a[1] - pts[0][1]);
  }
  return L;
}

function resample(pts, step, closed) {
  const src = closed ? [...pts, pts[0]] : pts;
  const out = [src[0]];
  let carry = 0;
  for (let i = 1; i < src.length; i++) {
    const [x0, z0] = src[i - 1];
    const [x1, z1] = src[i];
    const seg = Math.hypot(x1 - x0, z1 - z0);
    let d = step - carry;
    while (d <= seg) {
      const t = d / seg;
      out.push([x0 + (x1 - x0) * t, z0 + (z1 - z0) * t]);
      d += step;
    }
    carry = seg - (d - step);
  }
  if (closed && out.length > 1) {
    const a = out[out.length - 1];
    if (Math.hypot(a[0] - out[0][0], a[1] - out[0][1]) < step * 0.5) out.pop();
  }
  return out;
}

// Chaikin-Glättung für einen geschlossenen Linienzug
function chaikin(pts) {
  const out = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    out.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25]);
    out.push([a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75]);
  }
  return out;
}

// ---------- Aufräumen: Schlaufen, Knäuel, Zacken ----------

export const MAX_TRACK_LENGTH = 320; // längere Striche werden abgeschnitten (sonst wird es zäh)
const LOOP_MIN = 45; // kleinere Schlaufen werden herausgeschnitten
const MAX_CROSSINGS = 1; // eine Acht ist erlaubt, mehr Kreuzungen nicht

function segHit(p1, p2, q1, q2) {
  const d = (p2[0] - p1[0]) * (q2[1] - q1[1]) - (p2[1] - p1[1]) * (q2[0] - q1[0]);
  if (Math.abs(d) < 1e-9) return null;
  const u = ((q1[0] - p1[0]) * (q2[1] - q1[1]) - (q1[1] - p1[1]) * (q2[0] - q1[0])) / d;
  const v = ((q1[0] - p1[0]) * (p2[1] - p1[1]) - (q1[1] - p1[1]) * (p2[0] - p1[0])) / d;
  if (u <= 0 || u >= 1 || v <= 0 || v >= 1) return null;
  return [p1[0] + (p2[0] - p1[0]) * u, p1[1] + (p2[1] - p1[1]) * u];
}

// Alle Selbstkreuzungen eines (geschlossenen) Linienzugs: [{ i, j, at, inner }] – inner = Länge der Schlaufe i→j
function selfCrossings(pts) {
  const n = pts.length;
  const out = [];
  const cum = [0];
  for (let k = 1; k <= n; k++) cum.push(cum[k - 1] + Math.hypot(pts[k % n][0] - pts[k - 1][0], pts[k % n][1] - pts[k - 1][1]));
  const total = cum[n];
  for (let i = 0; i < n; i++) {
    for (let j = i + 2; j < n; j++) {
      if (i === 0 && j === n - 1) continue;
      const at = segHit(pts[i], pts[(i + 1) % n], pts[j], pts[(j + 1) % n]);
      if (!at) continue;
      const inner = cum[j + 1] - cum[i + 1];
      out.push({ i, j, at, inner: Math.min(inner, total - inner), keepInside: inner > total - inner });
    }
  }
  return out;
}

// Schneidet die kleinste Schlaufe heraus, solange es zu kleine Schlaufen oder zu viele Kreuzungen gibt
function removeLoops(pts) {
  for (let guard = 0; guard < 60 && pts.length > 8; guard++) {
    const xs = selfCrossings(pts);
    if (!xs.length) break;
    xs.sort((a, b) => a.inner - b.inner);
    const c = xs[0];
    if (c.inner >= LOOP_MIN && xs.length <= MAX_CROSSINGS) break;
    // Schlaufe zwischen den beiden Kreuzungs-Segmenten entfernen, Kreuzungspunkt bleibt
    if (!c.keepInside) pts = [...pts.slice(0, c.i + 1), c.at, ...pts.slice(c.j + 1)];
    else pts = [c.at, ...pts.slice(c.i + 1, c.j + 1)];
  }
  return pts;
}

// Zu enge Kurven (Zacken) weicher machen: nur dort glätten, wo der Knick zu stark ist
function easeSharpTurns(pts, step, minRadius) {
  const maxTurn = step / minRadius;
  for (let pass = 0; pass < 40; pass++) {
    let changed = false;
    const n = pts.length;
    const next = pts.map((p) => p.slice());
    for (let i = 0; i < n; i++) {
      const a = pts[(i - 1 + n) % n];
      const b = pts[i];
      const c = pts[(i + 1) % n];
      const a1 = Math.atan2(b[1] - a[1], b[0] - a[0]);
      const a2 = Math.atan2(c[1] - b[1], c[0] - b[0]);
      let turn = Math.abs(a2 - a1);
      if (turn > Math.PI) turn = 2 * Math.PI - turn;
      if (turn > maxTurn) {
        next[i] = [(a[0] + b[0] * 2 + c[0]) / 4, (a[1] + b[1] * 2 + c[1]) / 4];
        changed = true;
      }
    }
    pts = resample(next, step, true);
    if (!changed) break;
  }
  return pts;
}

// Umriss einer Punktwolke (konvexe Hülle) – Rückfallebene für ein wildes Knäuel
function hull(points) {
  const p = points.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower = [];
  for (const q of p) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], q) <= 0) lower.pop();
    lower.push(q);
  }
  const upper = [];
  for (const q of p.reverse()) {
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], q) <= 0) upper.pop();
    upper.push(q);
  }
  return [...lower.slice(0, -1), ...upper.slice(0, -1)];
}

function transform(pts, fn) {
  const cx = pts.reduce((s, p) => s + p[0], 0) / pts.length;
  const cz = pts.reduce((s, p) => s + p[1], 0) / pts.length;
  return pts.map(([x, z]) => fn(x - cx, z - cz, cx, cz));
}

/**
 * Macht aus einem Fingerstrich eine fahrbare Strecke.
 * Zu kleine Kreise werden vergrößert (damit der Zug passt), zu große verkleinert.
 * Gibt null zurück, wenn es nur ein Tippen war.
 */
export function strokeToTrack(stroke, { minLength, bounds }) {
  if (stroke.length < 2 || polyLength(stroke, false) < 3) return null;
  let pts = resample(stroke, 1.0, false);
  if (pts.length < 3) return null;
  // Viel zu lange Striche kürzen
  if (pts.length > MAX_TRACK_LENGTH) pts = pts.slice(0, MAX_TRACK_LENGTH);

  // Gerade Striche: zu einem schmalen Oval machen, damit ein Kreis entsteht
  const [x0, z0] = pts[0];
  const [x1, z1] = pts[pts.length - 1];
  const span = Math.hypot(x1 - x0, z1 - z0);
  const L0 = polyLength(pts, false);
  if (span > L0 * 0.8) {
    const nx = -(z1 - z0) / span;
    const nz = (x1 - x0) / span;
    const back = pts.slice().reverse().map(([x, z]) => [x + nx * 4, z + nz * 4]);
    pts = [...pts, ...back];
  }

  // Knäuel aufräumen: kleine Schlaufen raus, höchstens eine Kreuzung.
  // Bleibt davon zu wenig übrig (wildes Gekritzel), wird der Umriss des Gekritzels zur Strecke.
  const raw = pts;
  pts = resample(pts, 2.0, true);
  const before = polyLength(pts, true);
  pts = removeLoops(pts);
  if (pts.length < 8 || polyLength(pts, true) < Math.max(30, before * 0.25)) pts = resample(hull(raw), 2.0, true);
  pts = resample(pts, 1.5, true);
  for (let i = 0; i < 3; i++) pts = chaikin(pts);
  pts = resample(pts, 2.0, true);
  // keine zu engen Kurven (der Zug soll gut fahren können)
  pts = easeSharpTurns(pts, 2.0, 3.2);
  pts = removeLoops(pts);

  // Größe anpassen
  const L = polyLength(pts, true);
  if (L < minLength) {
    const k = minLength / L;
    pts = transform(pts, (x, z, cx, cz) => [cx + x * k, cz + z * k]);
  }
  const xs = pts.map((p) => p[0]);
  const zs = pts.map((p) => p[1]);
  const w = Math.max(...xs) - Math.min(...xs);
  const h = Math.max(...zs) - Math.min(...zs);
  const k = Math.min(1, (bounds.x * 2) / w, (bounds.z * 2) / h);
  if (k < 1) pts = transform(pts, (x, z, cx, cz) => [cx + x * k, cz + z * k]);
  // In den Spielbereich schieben
  const dx = Math.min(0, bounds.x - Math.max(...pts.map((p) => p[0]))) + Math.max(0, -bounds.x - Math.min(...pts.map((p) => p[0])));
  const dz = Math.min(0, bounds.z - Math.max(...pts.map((p) => p[1]))) + Math.max(0, -bounds.z - Math.min(...pts.map((p) => p[1])));
  pts = pts.map(([x, z]) => [+(x + dx).toFixed(2), +(z + dz).toFixed(2)]);
  return pts.length >= 4 ? pts : null;
}

// Start-Strecke: kreuzt zweimal den Fluss und einmal die Straße (Brücke und Schranke gleich zu sehen), mit Platz für 4 Bahnhöfe
export function defaultTrackPoints() {
  const pts = [];
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    pts.push([+(6 + Math.cos(a) * 27).toFixed(2), +(3 + Math.sin(a) * 19.5).toFixed(2)]);
  }
  return pts;
}

// ---------- 3D-Schienen ----------

const railMat = new THREE.MeshStandardMaterial({ color: '#a4aab0', roughness: 0.25, metalness: 0.9 });
const sleeperMat = new THREE.MeshStandardMaterial({ map: woodTexture('#8a5a33', 'sleeper'), roughness: 0.9 });
const bedMat = new THREE.MeshStandardMaterial({ map: gravelTexture(), roughness: 1, side: THREE.DoubleSide });

export class Track {
  constructor() {
    this.group = new THREE.Group();
    this.curve = null;
    this.length = 0;
    this.samples = [];
    this.appear = 1;
  }

  setPoints(points, animate = false) {
    this.clear();
    this.points = points;
    const v = points.map(([x, z]) => new THREE.Vector3(x, 0, z));
    this.curve = new THREE.CatmullRomCurve3(v, true, 'centripetal');
    this.length = this.curve.getLength();
    const n = Math.ceil(this.length / 0.25);

    const P = [];
    const T = [];
    for (let i = 0; i <= n; i++) {
      const u = i / n;
      P.push(this.curve.getPointAt(u % 1));
      T.push(this.curve.getTangentAt(u % 1));
    }
    this.samples = P.filter((_, i) => i % 4 === 0).map((p) => [p.x, p.z]);
    this.sampleS = this.samples.map((_, i) => (i * 4 * this.length) / n);

    // Schotterbett als flaches Band
    const bed = new THREE.BufferGeometry();
    const pos = [];
    const uv = [];
    const idx = [];
    P.forEach((p, i) => {
      const nx = -T[i].z;
      const nz = T[i].x;
      pos.push(p.x + nx * 0.9, 0.04, p.z + nz * 0.9, p.x - nx * 0.9, 0.04, p.z - nz * 0.9);
      uv.push(0, i * 0.25 / 1.8, 1, i * 0.25 / 1.8);
      if (i < n) {
        const a = i * 2;
        idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
    });
    bed.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    bed.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    bed.setIndex(idx);
    bed.computeVertexNormals();
    const bedMesh = new THREE.Mesh(bed, bedMat);
    bedMesh.receiveShadow = true;
    this.group.add(bedMesh);

    // Schwellen
    const count = Math.floor(this.length / 0.55);
    this.sleepers = new THREE.InstancedMesh(new THREE.BoxGeometry(0.28, 0.12, 1.25), sleeperMat, count);
    // Die Schwellen erscheinen nach und nach – ohne das würde three.js die Sichtbarkeits-Kugel
    // aus den ersten paar Schwellen berechnen und später alle auf einmal ausblenden.
    this.sleepers.frustumCulled = false;
    this.sleepers.receiveShadow = true;
    this.sleepers.castShadow = true;
    this.sleeperMatrices = [];
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const up = new THREE.Vector3(0, 1, 0);
    for (let i = 0; i < count; i++) {
      const u = i / count;
      const p = this.curve.getPointAt(u);
      const t = this.curve.getTangentAt(u);
      q.setFromAxisAngle(up, Math.atan2(-t.z, t.x));
      m.compose(new THREE.Vector3(p.x, 0.1, p.z), q, new THREE.Vector3(1, 1, 1));
      this.sleeperMatrices.push(m.clone());
      this.sleepers.setMatrixAt(i, m);
    }
    this.group.add(this.sleepers);

    // Zwei Schienen
    this.rails = [];
    for (const side of [1, -1]) {
      const off = P.slice(0, n).map((p, i) => new THREE.Vector3(p.x - T[i].z * GAUGE * side, RAIL_TOP - 0.06, p.z + T[i].x * GAUGE * side));
      const c = new THREE.CatmullRomCurve3(off, true);
      const rail = new THREE.Mesh(new THREE.TubeGeometry(c, n, 0.065, 6, true), railMat);
      rail.castShadow = true;
      this.group.add(rail);
      this.rails.push(rail);
    }

    if (animate) {
      this.appear = 0;
      this.rails.forEach((r) => { r.visible = false; });
      this.sleepers.count = 0;
    }
  }

  // Schienen „wachsen“ nach dem Malen der Reihe nach heraus
  update(dt) {
    if (this.appear >= 1 || !this.sleepers) return false;
    this.appear = Math.min(1, this.appear + dt / 1.2);
    this.sleepers.count = Math.floor(this.sleeperMatrices.length * this.appear);
    if (this.appear >= 1) this.rails.forEach((r) => { r.visible = true; });
    return this.appear >= 1;
  }

  // Nächster Punkt auf der Strecke: Position s entlang der Strecke und Abstand
  nearestS(x, z) {
    let best = Infinity;
    let bi = 0;
    this.samples.forEach(([sx, sz], i) => {
      const d = Math.hypot(sx - x, sz - z);
      if (d < best) {
        best = d;
        bi = i;
      }
    });
    // fein nachjustieren
    let s = this.sampleS[bi];
    const p = new THREE.Vector3();
    for (const step of [0.5, 0.25, 0.1]) {
      for (const ds of [-step, step]) {
        this.curve.getPointAt(this.u(s + ds), p);
        const d = Math.hypot(p.x - x, p.z - z);
        if (d < best) {
          best = d;
          s += ds;
        }
      }
    }
    return { s: this.wrap(s), dist: best };
  }

  wrap(s) {
    return ((s % this.length) + this.length) % this.length;
  }

  u(s) {
    return this.wrap(s) / this.length;
  }

  // Position und Richtung an Stelle s
  frameAt(s) {
    const p = this.curve.getPointAt(this.u(s));
    const t = this.curve.getTangentAt(this.u(s));
    return { p, t, angle: Math.atan2(-t.z, t.x) };
  }

  distanceTo(x, z) {
    let best = Infinity;
    for (const [sx, sz] of this.samples) best = Math.min(best, Math.hypot(sx - x, sz - z));
    return best;
  }

  clear() {
    for (const o of [...this.group.children]) {
      this.group.remove(o);
      o.geometry?.dispose();
    }
    this.sleepers = null;
  }
}

// Gemalte Linie während des Malens (Kreidepunkte)
export class ChalkLine {
  constructor(max = 3000) {
    this.mesh = new THREE.InstancedMesh(
      new THREE.CylinderGeometry(0.28, 0.28, 0.04, 12),
      new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.9 }),
      max,
    );
    this.mesh.count = 0;
    this.mesh.frustumCulled = false;
    this.max = max;
    this.last = null;
    this.points = [];
    this.length = 0;
    this.dotScale = 1; // größer, wenn weit herausgezoomt
  }

  reset() {
    this.mesh.count = 0;
    this.last = null;
    this.points = [];
    this.length = 0;
  }

  add(x, z) {
    const m = new THREE.Matrix4();
    const addDot = (px, pz) => {
      if (this.mesh.count >= this.max) return;
      m.makeScale(this.dotScale, 1, this.dotScale).setPosition(px, 0.08, pz);
      this.mesh.setMatrixAt(this.mesh.count++, m);
    };
    if (this.last) {
      const [lx, lz] = this.last;
      const d = Math.hypot(x - lx, z - lz);
      if (d < 0.2 * this.dotScale) return false;
      this.length += d;
      const steps = Math.ceil(d / (0.25 * this.dotScale));
      for (let i = 1; i <= steps; i++) addDot(lx + ((x - lx) * i) / steps, lz + ((z - lz) * i) / steps);
    } else {
      addDot(x, z);
    }
    this.last = [x, z];
    this.points.push([x, z]);
    this.mesh.instanceMatrix.needsUpdate = true;
    return true;
  }
}
