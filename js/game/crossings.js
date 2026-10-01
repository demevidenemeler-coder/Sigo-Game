// Automatische Bauwerke: Wo die gemalte Strecke den Fluss kreuzt, entsteht eine Brücke;
// wo sie die Straße kreuzt, ein Bahnübergang mit Schranken; wo sie durch einen Berg führt, ein Tunnel.

import * as THREE from 'three';
import { RoundedBoxGeometry } from '../../vendor/RoundedBoxGeometry.js';
import { MOUNTAINS } from './features.js';
import { woodTexture } from './textures.js';

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

const rbox = (w, h, d, r = 0.05) => new RoundedBoxGeometry(w, h, d, 2, Math.min(r, w / 2, h / 2, d / 2));

// ---------- Bauteile ----------

// Musik-Brücke, die der (auch gebogenen) Strecke von s0 bis s1 folgt:
// Die Bohlen sind bunte Xylophon-Stäbe (tief = rot und breit, hoch = lila und schmal, wie beim echten Xylophon).
// Fährt die Lok drüber, spielt jeder Stab seinen Ton; antippen geht auch.
const STEP = 1;
export const BAR_COLORS = ['#e5484d', '#ee7a2b', '#f5b731', '#f2d93a', '#8cc43f', '#3fb26b', '#2fb5b0', '#3b8fd9', '#5a63d6', '#9a5bd1'];
// Tonfolge hin und her: 0 1 2 … 9 8 7 … 1 0 1 …
const noteFor = (i) => {
  const k = i % 18;
  return k < 10 ? k : 18 - k;
};
const barGeo = new Map();
function barGeometry(len, width) {
  const k = `${len.toFixed(2)}:${width.toFixed(2)}`;
  if (!barGeo.has(k)) barGeo.set(k, new RoundedBoxGeometry(len, 0.09, width, 2, 0.035));
  return barGeo.get(k);
}

function bridge(track, s0, s1) {
  const g = new THREE.Group();
  g.userData.bridge = true;
  const deck = new THREE.MeshStandardMaterial({ map: woodTexture('#7a5232', 'deckDark'), roughness: 0.85 });
  const steel = mat('#c8453a', 0.45, 0.4);
  const stone = mat('#b9b1a3', 0.9);
  const pin = mat('#d9dde2', 0.3, 0.8);
  const n = Math.max(2, Math.ceil((s1 - s0) / STEP));
  const len = (s1 - s0) / n;
  const bars = [];
  for (let i = 0; i < n; i++) {
    const s = s0 + (i + 0.5) * len;
    const f = track.frameAt(s);
    const seg = new THREE.Group();
    seg.position.set(f.p.x, 0, f.p.z);
    seg.rotation.y = f.angle;
    add(seg, new THREE.BoxGeometry(len + 0.08, 0.12, 2.6), deck, 0, 0.03, 0);
    // Xylophon-Stab mit zwei silbernen Stiften
    const note = noteFor(i);
    const width = 2.45 - note * 0.07;
    const barMat = new THREE.MeshStandardMaterial({ color: BAR_COLORS[note], roughness: 0.35, emissive: BAR_COLORS[note], emissiveIntensity: 0 });
    const bar = add(seg, barGeometry(Math.max(0.3, len - 0.14), width), barMat, 0, 0.13, 0);
    for (const z of [width / 2 - 0.22, -width / 2 + 0.22]) add(seg, new THREE.SphereGeometry(0.05, 8, 6), pin, 0, 0.18, z);
    bar.userData.note = note;
    bar.userData.baseY = 0.13;
    bar.userData.flash = 0;
    bars.push({ mesh: bar, note, s });
    for (const z of [1.3, -1.3]) {
      add(seg, new THREE.BoxGeometry(len + 0.08, 0.42, 0.14), steel, 0, 0.12, z);
      add(seg, new THREE.BoxGeometry(len + 0.08, 0.08, 0.08), steel, 0, 0.95, z);
      if (i % 2 === 0) add(seg, new THREE.BoxGeometry(0.08, 0.7, 0.08), steel, 0, 0.62, z);
    }
    // Pfeiler im Wasser
    if (i % 4 === 2 && i < n - 1) add(seg, rbox(0.7, 0.6, 2.8, 0.08), stone, 0, -0.22, 0);
    g.add(seg);
  }
  g.userData.bars = bars;
  g.userData.barLen = len;
  // Widerlager an beiden Enden
  for (const s of [s0, s1]) {
    const f = track.frameAt(s);
    const w = add(g, rbox(0.8, 0.5, 2.9, 0.06), stone, f.p.x, 0.1, f.p.z);
    w.rotation.y = f.angle;
  }
  // Fisch, der ab und zu neben der Brücke aus dem Wasser springt
  const mid = track.frameAt((s0 + s1) / 2);
  const fishBase = new THREE.Group();
  fishBase.position.set(mid.p.x, 0, mid.p.z);
  fishBase.rotation.y = mid.angle;
  const fish = new THREE.Group();
  add(fish, new THREE.SphereGeometry(0.22, 12, 8), mat('#f08c2b', 0.4)).scale.set(1.5, 0.8, 0.6);
  add(fish, new THREE.ConeGeometry(0.17, 0.26, 4), mat('#f08c2b', 0.4), -0.38, 0, 0).rotation.z = Math.PI / 2;
  fish.visible = false;
  fishBase.add(fish);
  g.add(fishBase);
  g.userData.fish = fish;
  g.userData.fishTimer = 3 + Math.random() * 6;
  return g;
}

// Tunnelportal aus Stein (schaut entlang +x)
function portal() {
  const p = new THREE.Group();
  const inner = new THREE.Group();
  inner.rotation.y = -Math.PI / 2;
  const stone = mat('#b9b1a3', 0.9);
  const arch = add(inner, new THREE.TorusGeometry(1.35, 0.3, 10, 24, Math.PI), stone, 0, 1.25, 0);
  arch.scale.z = 1.8;
  for (const z of [1.35, -1.35]) add(inner, new THREE.BoxGeometry(0.6, 1.3, 0.7), stone, z, 0.65, 0).rotation.y = Math.PI / 2;
  add(inner, new THREE.BoxGeometry(3.6, 0.5, 0.7), stone, 0, 2.9, 0);
  add(inner, new THREE.CircleGeometry(1.06, 24, 0, Math.PI), new THREE.MeshBasicMaterial({ color: "#141414" }), 0, 1.25, 0.3);
  add(inner, new THREE.PlaneGeometry(2.12, 1.25), new THREE.MeshBasicMaterial({ color: "#141414" }), 0, 0.62, 0.3);
  p.add(inner);
  return p;
}

// Bahnübergang: Bohlen zwischen den Schienen, wo die Strecke auf der Straße liegt
function crossingPlanks(track, s0, s1) {
  const g = new THREE.Group();
  const n = Math.max(1, Math.ceil(s1 - s0));
  const len = (s1 - s0) / n;
  for (let i = 0; i < n; i++) {
    const f = track.frameAt(s0 + (i + 0.5) * len);
    const p = add(g, new THREE.BoxGeometry(len + 0.05, 0.08, 2.2), mat('#6b4a2b', 0.9), f.p.x, 0.05, f.p.z);
    p.rotation.y = f.angle;
  }
  return g;
}

// Schranke mit Andreaskreuz und Blinklicht am Straßenrand; der Arm reicht über die ganze Straße.
// side = +1: steht am rechten Rand (Blick in Fahrtrichtung der Straße), sonst links.
function barrier(roadWidth, side, lights) {
  const g = new THREE.Group();
  const edge = side * (roadWidth / 2 + 0.45);
  const post = new THREE.Group();
  post.position.set(0, 0, edge + side * 0.35);
  add(post, new THREE.CylinderGeometry(0.06, 0.06, 2.4, 8), mat('#f5f1ea', 0.5), 0, 1.2, 0);
  for (const r of [0.6, -0.6]) add(post, new THREE.BoxGeometry(0.04, 0.14, 0.9), mat('#e5484d', 0.5), 0, 2.15, 0).rotation.x = r;
  for (const z of [0.15, -0.15]) {
    lights.push(add(post, new THREE.SphereGeometry(0.09, 10, 8), new THREE.MeshStandardMaterial({ color: '#5a1a14', emissive: '#ff2a1a', emissiveIntensity: 0 }), 0.08, 1.6, z));
  }
  g.add(post);
  const pivot = new THREE.Group();
  pivot.position.set(0, 0.9, edge);
  add(pivot, rbox(0.3, 0.6, 0.3), mat('#d9d4c8', 0.6), 0, -0.4, 0);
  const arm = new THREE.Group();
  const n = Math.ceil((roadWidth + 0.4) / 0.5);
  for (let i = 0; i < n; i++) add(arm, new THREE.BoxGeometry(0.08, 0.1, 0.5), mat(i % 2 ? '#ffffff' : '#e5484d', 0.5), 0, 0, -side * (0.25 + i * 0.5));
  pivot.add(arm);
  arm.rotation.x = side * (Math.PI / 2);
  g.add(pivot);
  return { obj: g, arm, side };
}

// ---------- Verwaltung ----------

export class Crossings {
  constructor(scene, features, track) {
    this.features = features;
    this.track = track;
    this.group = new THREE.Group();
    scene.add(this.group);
    this.bridges = []; // { s0, s1, s, obj }
    this.tunnels = []; // { s0, s1 }
    this.crossings = []; // { s, roadT, obj, closed }
  }

  // Strecke als Punktliste mit Länge entlang der Strecke
  trackPoints() {
    const t = this.track;
    return t.samples.map(([x, z], i) => ({ x, z, t: t.sampleS[i] }));
  }

  // Zusammenhängende Abschnitte der (geschlossenen) Strecke, für die test() gilt: [{ s0, s1 }], s1 kann > Länge sein
  runs(pts, test) {
    const n = pts.length;
    const L = this.track.length;
    const inside = pts.map(test);
    if (!inside.some(Boolean) || inside.every(Boolean)) return [];
    const out = [];
    const start = inside.findIndex((v) => !v);
    for (let k = 1; k <= n; k++) {
      const i = (start + k) % n;
      if (!inside[i] || inside[(i - 1 + n) % n]) continue;
      let j = i;
      while (inside[(j + 1) % n]) j = (j + 1) % n;
      out.push({ s0: pts[i].t, s1: j >= i ? pts[j].t : pts[j].t + L });
    }
    return out;
  }

  clear() {
    for (const o of [...this.group.children]) this.group.remove(o);
    this.bridges = [];
    this.tunnels = [];
    this.crossings = [];
  }

  // Neu berechnen (nach dem Malen und beim Laden). Liefert, welche Arten es gibt (für die Ansage).
  rebuild() {
    this.clear();
    const f = this.features;
    const tr = this.track;
    const pts = this.trackPoints();

    // Brücken über den Fluss: jeder Abschnitt der Strecke über dem Wasser
    for (const r of this.runs(pts, (p) => f.riverDist(p.x, p.z) < f.riverWidth / 2 + 1.2)) {
      const s0 = r.s0 - 1.2;
      const s1 = r.s1 + 1.2;
      const obj = bridge(tr, s0, s1);
      this.group.add(obj);
      this.bridges.push({ s0, s1, s: (s0 + s1) / 2, obj, bars: obj.userData.bars, barLen: obj.userData.barLen, last: -1 });
    }

    // Bahnübergänge: jeder Abschnitt der Strecke auf der Straße
    const RL = f.roadS.length;
    for (const r of this.runs(pts, (p) => f.roadNearest(p.x, p.z).d < f.roadWidth / 2 + 0.5)) {
      const s0 = r.s0 - 0.6;
      const s1 = r.s1 + 0.6;
      // Bereich auf der Straße, den die Schienen belegen
      let t0 = Infinity;
      let t1 = -Infinity;
      for (let s = s0; s <= s1 + 0.01; s += 0.5) {
        const p = tr.frameAt(s).p;
        const t = f.roadNearest(p.x, p.z).t;
        t0 = Math.min(t0, t);
        t1 = Math.max(t1, t);
      }
      t0 -= 1.6;
      t1 += 1.6;
      const obj = crossingPlanks(tr, s0, s1);
      const lights = [];
      const barriers = [];
      // Vor jeder Fahrtrichtung eine Schranke (Autos fahren rechts)
      for (const [t, side] of [[t0, -1], [t1, 1]]) {
        const b = barrier(f.roadWidth, side, lights);
        const p = f.road.getPointAt(THREE.MathUtils.clamp(t / RL, 0, 1));
        const tg = f.road.getTangentAt(THREE.MathUtils.clamp(t / RL, 0, 1));
        b.obj.position.set(p.x, 0, p.z);
        b.obj.rotation.y = Math.atan2(-tg.z, tg.x);
        obj.add(b.obj);
        barriers.push(b);
      }
      obj.userData.parts = { lights, barriers };
      this.group.add(obj);
      this.crossings.push({ s0, s1, s: s0, t0, t1, obj, closed: false });
    }

    // Tunnel durch die Berge: jeder Abschnitt der Strecke im Berg
    for (const m of MOUNTAINS) {
      for (const r of this.runs(pts, (p) => Math.hypot(p.x - m.x, p.z - m.z) < m.r * 0.93)) {
        // Portale stehen vor dem Fuß des Berges
        const out = (s, dir) => {
          for (let k = 0; k < 30; k++, s += dir * 0.25) {
            const p = tr.frameAt(s).p;
            if (Math.hypot(p.x - m.x, p.z - m.z) >= m.r * 1.02) break;
          }
          return s;
        };
        const s0 = out(r.s0, -1);
        const s1 = out(r.s1, 1);
        for (const [s, flip] of [[s0, true], [s1, false]]) {
          const fr = tr.frameAt(s);
          const p = portal();
          p.position.set(fr.p.x, 0, fr.p.z);
          p.rotation.y = fr.angle + (flip ? Math.PI : 0);
          this.group.add(p);
        }
        this.tunnels.push({ s0, s1 });
      }
    }

    return {
      bridge: this.bridges.length > 0,
      tunnel: this.tunnels.length > 0,
      crossing: this.crossings.length > 0,
    };
  }

  // Stab leuchten und hüpfen lassen (der Ton kommt vom Aufrufer)
  flashBar(bar) {
    bar.mesh.userData.flash = 1;
  }

  // Getroffener Brückenteil → nächster Xylophon-Stab
  barNear(object, point) {
    let o = object;
    while (o && !o.userData.bridge) o = o.parent;
    if (!o) return null;
    let best = null;
    let bestD = Infinity;
    const wp = new THREE.Vector3();
    for (const bar of o.userData.bars) {
      const d = bar.mesh.getWorldPosition(wp).distanceTo(point);
      if (d < bestD) {
        bestD = d;
        best = bar;
      }
    }
    return best;
  }

  // Abschnitte der Strecke, auf die kein Bahnhof o. Ä. gesetzt werden kann: { s, span }
  zones() {
    return [
      ...this.bridges.map((b) => ({ s: b.s, span: b.s1 - b.s0 + 1 })),
      ...this.crossings.map((c) => ({ s: (c.s0 + c.s1) / 2, span: c.s1 - c.s0 + 3 })),
      ...this.tunnels.map((t) => ({ s: (t.s0 + t.s1) / 2, span: t.s1 - t.s0 + 2 })),
    ];
  }

  // Für Bäume/Blumen: Bereiche um Brücken und Bahnübergänge freihalten
  footprints() {
    const out = [];
    for (const b of this.bridges) {
      for (let s = b.s0; s <= b.s1; s += 2) {
        const f = this.track.frameAt(s);
        out.push([f.p.x, f.p.z, 2.2]);
      }
    }
    for (const c of this.crossings) for (const b of c.obj.userData.parts.barriers) out.push([b.obj.position.x, b.obj.position.z, 3]);
    return out;
  }

  animate(dt, time) {
    for (const c of this.crossings) {
      const parts = c.obj.userData.parts;
      for (const b of parts.barriers) {
        const target = c.closed ? 0 : b.sx * (Math.PI / 2);
        b.arm.rotation.x += (target - b.arm.rotation.x) * Math.min(1, dt * 3);
      }
      const blink = c.closed && Math.sin(time * 9) > 0;
      parts.lights.forEach((l, i) => { l.material.emissiveIntensity = c.closed ? ((i % 2 === 0) === blink ? 2.5 : 0) : 0; });
    }
    for (const b of this.bridges) {
      for (const { mesh } of b.bars) {
        const u = mesh.userData;
        if (u.flash <= 0) continue;
        u.flash = Math.max(0, u.flash - dt * 2.5);
        mesh.material.emissiveIntensity = u.flash * 0.9;
        mesh.position.y = u.baseY + Math.sin(u.flash * Math.PI) * 0.06;
      }
      const u = b.obj.userData;
      const f = u.fish;
      u.fishTimer -= dt;
      if (u.fishTimer <= 0) {
        u.fishTimer = 6 + Math.random() * 8;
        f.userData.t = 0;
        f.userData.side = Math.random() > 0.5 ? 1 : -1;
        f.visible = true;
      }
      if (f.visible) {
        f.userData.t += dt / 1.1;
        const t = f.userData.t;
        f.position.set(-1 + t * 2, Math.sin(t * Math.PI) * 1.4 - 0.1, f.userData.side * 3.5);
        f.rotation.z = Math.cos(t * Math.PI) * 0.9;
        if (t >= 1) f.visible = false;
      }
    }
  }
}
