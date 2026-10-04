// Schienen: aus den Streckenpunkten (route.js) wird eine geschlossene, geglättete Strecke.

import * as THREE from 'three';
import { gravelTexture, woodTexture } from './textures.js';

export const RAIL_TOP = 0.27; // Höhe der Schienenoberkante über dem Boden
const GAUGE = 0.42; // halbe Spurweite

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
