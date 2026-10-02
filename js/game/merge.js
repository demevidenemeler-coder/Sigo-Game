// Leistung: Viele kleine Teile kosten je einen Zeichenaufruf (mit Schatten zwei) – das bremst Tablets am meisten.
// - mergeStatic(root, keep): fasst alle unbeweglichen Teile unter root je Material zu einem Mesh zusammen
//   (optional in Kacheln, damit Unsichtbares weiterhin weggelassen werden kann). keep(o) = Teil bleibt einzeln.
// - ProxyInstancer: Objekte, die einzeln bleiben müssen (Bäume zum Antippen, die bei Schienen verschwinden),
//   werden als Instanzen gezeichnet. Die Original-Objekte bleiben unsichtbar zum Antippen/Animieren erhalten.

import * as THREE from 'three';

export const PROXY_LAYER = 1; // Ebene der unsichtbaren Original-Objekte (die Kamera zeichnet nur Ebene 0)

const ATTRS = ['position', 'normal', 'uv', 'color'];

// Geometrien zusammenführen (alle bereits in gemeinsamen Koordinaten)
function concat(geos) {
  const names = ATTRS.filter((n) => geos.every((g) => g.attributes[n]));
  const count = geos.reduce((n, g) => n + g.attributes.position.count, 0);
  const out = new THREE.BufferGeometry();
  for (const name of names) {
    const size = geos[0].attributes[name].itemSize;
    const arr = new Float32Array(count * size);
    let off = 0;
    for (const g of geos) {
      const a = g.attributes[name];
      if (a.itemSize !== size) return null;
      arr.set(a.array, off);
      off += a.array.length;
    }
    out.setAttribute(name, new THREE.BufferAttribute(arr, size));
  }
  out.computeBoundingSphere();
  out.computeBoundingBox();
  return out;
}

function prepared(mesh, toRoot) {
  let g = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();
  // gruppierte Geometrien (mehrere Materialien) nicht anfassen
  g.applyMatrix4(toRoot);
  // Spiegelungen (negative Skalierung) drehen die Dreiecke um – dann Reihenfolge korrigieren
  if (toRoot.determinant() < 0) {
    const p = g.attributes.position;
    for (const name of ATTRS) {
      const a = g.attributes[name];
      if (!a) continue;
      const s = a.itemSize;
      for (let i = 0; i < p.count; i += 3) {
        for (let k = 0; k < s; k++) {
          const t = a.array[(i + 1) * s + k];
          a.array[(i + 1) * s + k] = a.array[(i + 2) * s + k];
          a.array[(i + 2) * s + k] = t;
        }
      }
    }
  }
  return g;
}

/**
 * Fasst unbewegliche Teile unter root zusammen. Ergebnis: neue Meshes direkt unter root.
 * keep(o): dieses Objekt (mit allem darunter) bleibt unverändert.
 * cell: Kachelgröße in Welt-Einheiten (0 = keine Kacheln).
 */
export function mergeStatic(root, keep = () => false, { cell = 0, minParts = 2, dedupe = false } = {}) {
  root.updateMatrixWorld(true);
  const rootInv = root.matrixWorld.clone().invert();
  const found = [];
  const walk = (o) => {
    for (const c of o.children) {
      if (keep(c)) continue;
      if (c.isMesh && !c.isInstancedMesh && !c.isSkinnedMesh && !Array.isArray(c.material) && c.visible
        && c.layers.mask === 1 && !c.userData.noMerge) found.push(c);
      if (c.visible) walk(c);
    }
  };
  walk(root);
  const groups = new Map();
  const wp = new THREE.Vector3();
  // Gleich aussehende Materialien wie eines behandeln (z. B. viele einzeln erzeugte „grüne Blätter“)
  const look = (mt) => {
    if (!dedupe) return mt.uuid;
    return [mt.type, mt.color?.getHexString(), mt.emissive?.getHexString(), mt.emissiveIntensity, mt.roughness, mt.metalness,
      mt.map?.uuid, mt.vertexColors, mt.transparent, mt.opacity, mt.side, mt.flatShading, mt.clearcoat].join('|');
  };
  const canonical = new Map();
  for (const m of found) {
    const lk = look(m.material);
    if (!canonical.has(lk)) canonical.set(lk, m.material);
    let key = lk + (m.castShadow ? 's' : '') + (m.receiveShadow ? 'r' : '') + (m.userData.paint ?? '');
    if (cell) {
      m.getWorldPosition(wp);
      key += `|${Math.floor(wp.x / cell)},${Math.floor(wp.z / cell)}`;
    }
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(m);
  }
  const added = [];
  for (const list of groups.values()) {
    if (list.length < minParts) continue;
    const geos = list.map((m) => prepared(m, rootInv.clone().multiply(m.matrixWorld)));
    const geo = concat(geos);
    geos.forEach((g) => g.dispose());
    if (!geo) continue;
    const first = list[0];
    const merged = new THREE.Mesh(geo, canonical.get(look(first.material)));
    merged.castShadow = first.castShadow;
    merged.receiveShadow = first.receiveShadow;
    merged.userData = { ...first.userData, merged: true };
    for (const m of list) m.parent.remove(m);
    root.add(merged);
    added.push(merged);
  }
  return added;
}

// Gibt die zusammengefassten Geometrien frei (z. B. beim Neubauen eines Wagens)
export function disposeMerged(root) {
  root.traverse((o) => {
    if (o.userData?.merged) o.geometry.dispose();
  });
}

// ---------- Instanzen für viele gleichartige Objekte ----------

// Fingerabdruck einer Geometrie (gleich gebaute Geometrien teilen sich eine Instanz-Gruppe)
function geoKey(g) {
  if (!g.boundingBox) g.computeBoundingBox();
  const b = g.boundingBox;
  const r = (v) => v.toFixed(3);
  return `${g.type}:${g.attributes.position.count}:${r(b.min.x)},${r(b.min.y)},${r(b.min.z)},${r(b.max.x)},${r(b.max.y)},${r(b.max.z)}`;
}

const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);

export class ProxyInstancer {
  constructor(scene, objects) {
    this.objects = objects;
    this.entries = new Map(); // obj → { parts: [{ im, index, local }], sig }
    const byKey = new Map();
    for (const obj of objects) {
      obj.updateMatrixWorld(true);
      const inv = obj.matrixWorld.clone().invert();
      const parts = [];
      obj.traverse((m) => {
        if (!m.isMesh || Array.isArray(m.material)) return;
        const key = `${geoKey(m.geometry)}|${m.material.uuid}|${m.castShadow}`;
        if (!byKey.has(key)) byKey.set(key, { geometry: m.geometry, material: m.material, cast: m.castShadow, list: [] });
        const slot = byKey.get(key);
        parts.push({ slot, index: slot.list.length, local: inv.clone().multiply(m.matrixWorld) });
        slot.list.push(obj);
        m.layers.set(PROXY_LAYER); // nicht mehr selbst zeichnen, aber antippbar
      });
      this.entries.set(obj, { parts, state: null });
    }
    this.meshes = [];
    for (const slot of byKey.values()) {
      const im = new THREE.InstancedMesh(slot.geometry, slot.material, slot.list.length);
      im.castShadow = slot.cast;
      im.receiveShadow = true;
      slot.im = im;
      scene.add(im);
      this.meshes.push(im);
    }
    for (const e of this.entries.values()) for (const p of e.parts) p.im = p.slot.im;
    this.update(true);
    for (const im of this.meshes) im.computeBoundingSphere();
  }

  // Nur Objekte neu eintragen, die sich bewegt haben, versteckt/gezeigt wurden oder wackeln
  // (Vergleich über Zahlen statt Text: kein Speicher-Müll pro Bild)
  update(force = false) {
    const m = this.tmp ?? (this.tmp = new THREE.Matrix4());
    const dirty = this.dirty ?? (this.dirty = new Set());
    dirty.clear();
    for (const [obj, e] of this.entries) {
      const s = e.state ?? (e.state = new Float64Array(9).fill(NaN));
      const p = obj.position;
      const sc = obj.scale;
      const v = obj.visible ? 1 : 0;
      if (!force && s[0] === v && s[1] === p.x && s[2] === p.y && s[3] === p.z && s[4] === sc.x && s[5] === sc.y && s[6] === sc.z
        && s[7] === obj.rotation.y && s[8] === obj.rotation.z) continue;
      s[0] = v; s[1] = p.x; s[2] = p.y; s[3] = p.z; s[4] = sc.x; s[5] = sc.y; s[6] = sc.z; s[7] = obj.rotation.y; s[8] = obj.rotation.z;
      obj.updateMatrixWorld(true);
      for (const part of e.parts) {
        part.im.setMatrixAt(part.index, v ? m.multiplyMatrices(obj.matrixWorld, part.local) : ZERO);
        dirty.add(part.im);
      }
    }
    for (const im of dirty) im.instanceMatrix.needsUpdate = true;
  }
}
