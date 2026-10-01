// Dinge an der Strecke: Bahnhof und Waschanlage (Brücke, Tunnel, Bahnübergang entstehen automatisch, siehe crossings.js).
// Jedes Objekt sitzt an einer Stelle s der Strecke und dreht sich mit ihr.
// Lokale Koordinaten: x = entlang der Schienen, z = seitlich (Gleismitte bei z = 0).

import * as THREE from 'three';
import { RoundedBoxGeometry } from '../../vendor/RoundedBoxGeometry.js';
import { TRACK_OBJECTS, STATION_COLORS } from '../catalog.js';
import { buildFigure, setBubble } from './figures.js';
import { woodTexture } from './textures.js';
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

const WAITING = ['kind', 'oma', 'papa', 'hund', 'katze', 'teddy', 'hase', 'pinguin', 'schaf', 'ente', 'pferd', 'huhn'];

// Jeder Bahnhof hat eine eigene Farbe (Dach, Säulen, Schild, Farbtafel)
function buildBahnhof(item, color) {
  const g = item.obj;
  item.color = color;
  const hex = STATION_COLORS[color].hex;
  const len = def('bahnhof').span - 1;
  // Bahnsteig mit gelber Kante
  add(g, rbox(len, 0.45, 1.8, 0.05), mat('#cfc6b6', 0.9), 0, 0.22, 1.75);
  add(g, new THREE.BoxGeometry(len, 0.02, 0.12), mat('#f2c832'), 0, 0.455, 1.0);
  // Schmales Dach hinten am Bahnsteig (die Wartenden bleiben von oben sichtbar)
  for (const x of [-len / 2 + 0.6, 0, len / 2 - 0.6]) add(g, new THREE.CylinderGeometry(0.06, 0.06, 2.3, 8), mat('#f5f1ea', 0.4), x, 1.6, 2.6);
  const roof = add(g, rbox(len - 0.4, 0.1, 0.9, 0.04), mat(hex, 0.5), 0, 2.8, 2.55);
  roof.rotation.x = -0.15;
  // Bahnhofsgebäude mit Uhr und Schild
  add(g, rbox(3.6, 2.4, 2.2, 0.08), mat('#f7eedb'), 0, 1.2, 4.0);
  add(g, gableRoof(2.6, 1.0, 4.0), mat(hex, 0.6), 0, 2.4, 4.0);
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
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 0.55), new THREE.MeshStandardMaterial({ map: signTexture('🚂', hex) }));
  sign.position.set(0, 2.05, 2.92);
  g.add(sign);
  // Große runde Farbtafel auf einem Mast – von oben und von weitem gut zu sehen
  add(g, new THREE.CylinderGeometry(0.07, 0.07, 3.2, 8), mat('#f5f1ea', 0.4), -1.6, 1.6, 2.2);
  const disc = add(g, new THREE.CylinderGeometry(0.75, 0.75, 0.12, 32), mat(hex, 0.4), -1.6, 3.6, 2.2);
  disc.rotation.x = Math.PI / 2;
  add(g, new THREE.TorusGeometry(0.75, 0.07, 8, 32), mat('#ffffff', 0.4), -1.6, 3.6, 2.2);
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

// Ziel für einen Fahrgast an diesem Bahnhof: ein anderer Bahnhof (nur wenn es mehrere gibt)
function pickDest(item) {
  const others = (item.owner?.items ?? []).filter((it) => it.type === 'bahnhof' && it !== item).map((it) => it.color);
  return others.length ? others[Math.floor(Math.random() * others.length)] : null;
}

export function setDest(fig, dest) {
  fig.userData.dest = dest;
  setBubble(fig, dest == null ? null : STATION_COLORS[dest].hex);
}

// dest: undefined = selbst aussuchen, null = kein Ziel
export function addWaiting(item, id, dest) {
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
  setDest(f, dest === undefined ? pickDest(item) : dest);
  return f;
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

const BUILDERS = {
  bahnhof: buildBahnhof,
  waschanlage: buildWaschanlage,
};

// Freizuhaltende Bereiche (für Bäume/Blumen), in lokalen Koordinaten: [x, z, Radius]
const FOOTPRINTS = {
  bahnhof: [[0, 2.5, 5]],
  waschanlage: [[0, 0, 3]],
};

// Vorschau-Modell für die Leiste (ohne Strecke)
export function buildTrackObjectPreview(type) {
  const item = { type, s: 0, obj: new THREE.Group(), parts: {} };
  BUILDERS[type](item, 0);
  for (const w of item.waiting ?? []) setDest(w, null);
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
  // Gebäude-Seite an Stelle s: +1 links, -1 rechts der Fahrtrichtung, 0 = beide Seiten belegt (Fluss, Straße, Berg)
  sideAt(s) {
    if (!this.blocked) return 1;
    for (const side of [1, -1]) {
      let ok = true;
      for (const ds of [-3.5, 0, 3.5]) {
        const f = this.track.frameAt(s + ds);
        for (const off of [1.5, 2.8, 4.2, 5.3]) {
          if (this.blocked(f.p.x - f.t.z * off * side, f.p.z + f.t.x * off * side)) ok = false;
        }
      }
      if (ok) return side;
    }
    return 0;
  }

  isFree(s, span, except = null, type = null) {
    const L = this.track.length;
    if (type === 'bahnhof' && this.sideAt(s) === 0) return false;
    const dist = (a, b) => Math.abs(((a - b + L / 2) % L + L) % L - L / 2);
    if ((this.reserved?.() ?? []).some((z) => dist(s, z.s) < (span + z.span) / 2 + 0.5)) return false;
    return this.items.every((it) => {
      if (it === except) return true;
      const d = Math.abs(((s - it.s + L / 2) % L + L) % L - L / 2);
      return d > (span + def(it.type).span) / 2 + 0.5;
    });
  }

  // Nächste freie Stelle in der Nähe von s
  freeSpotNear(s, span, except = null, type = null) {
    for (let k = 0; k < 120; k++) {
      for (const sign of [1, -1]) {
        const c = s + sign * k * 0.75;
        if (this.isFree(c, span, except, type)) return this.track.wrap(c);
      }
    }
    return null;
  }

  add(type, x, z) {
    const d = def(type);
    if (this.count(type) >= d.max) return null;
    const near = this.track.nearestS(x, z);
    const s = this.freeSpotNear(near.s, d.span, null, type);
    if (s == null) return null;
    const item = { type, s, obj: new THREE.Group(), parts: {}, owner: this };
    item.obj.userData.item = item;
    const used = this.items.map((it) => it.color);
    BUILDERS[type](item, type === 'bahnhof' ? STATION_COLORS.findIndex((_, c) => !used.includes(c)) : 0);
    item.obj.traverse((o) => { o.userData.trackItem ??= item; });
    this.group.add(item.obj);
    this.items.push(item);
    this.place(item);
    this.refreshDestinations();
    return item;
  }

  // Wartende ohne (gültiges) Ziel bekommen eins, sobald es einen zweiten Bahnhof gibt
  refreshDestinations() {
    const stations = this.items.filter((it) => it.type === 'bahnhof');
    for (const st of stations) {
      for (const w of st.waiting) {
        const d = w.userData.dest;
        const valid = d != null && d !== st.color && stations.some((o) => o.color === d);
        if (!valid) setDest(w, pickDest(st));
      }
    }
  }

  // Gute freie Stelle: möglichst weit weg von den anderen Objekten
  bestSpot(type) {
    const d = def(type);
    const L = this.track.length;
    let best = null;
    let bestScore = -1;
    for (let s = 0; s < L; s += 1.5) {
      if (!this.isFree(s, d.span, null, type)) continue;
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
    this.refreshDestinations();
  }

  moveTo(item, x, z) {
    const d = def(item.type);
    const near = this.track.nearestS(x, z);
    const s = this.freeSpotNear(near.s, d.span, item, item.type);
    if (s == null) return false;
    item.s = s;
    this.place(item);
    return true;
  }

  place(item) {
    const f = this.track.frameAt(item.s);
    item.obj.position.set(f.p.x, 0, f.p.z);
    // Stünde das Gebäude (links der Fahrtrichtung) im Fluss, auf der Straße oder im Berg → auf die andere Seite
    item.flipped = this.sideAt(item.s) === -1;
    item.obj.rotation.set(0, f.angle + (item.flipped ? Math.PI : 0), 0);
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
      const s = this.freeSpotNear(near.s, d.span, null, it.type);
      if (s == null) {
        this.group.remove(it.obj);
        continue;
      }
      it.s = s;
      this.items.push(it);
      this.place(it);
    }
    this.refreshDestinations();
  }

  serialize() {
    return this.items.map((i) => ({ type: i.type, x: +i.x.toFixed(2), z: +i.z.toFixed(2) }));
  }

  load(list) {
    for (const o of list ?? []) if (BUILDERS[o.type]) this.add(o.type, o.x, o.z);
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
      }
    }
  }
}
