// Lebendige Landschaft: Schmetterlinge über den Blumenwiesen, Vogelschwärme am Himmel, Rauch aus den Schornsteinen.
// Alles als wenige Instanz-Gruppen (billig zu zeichnen). Nachts schlafen Schmetterlinge und Vögel.

import * as THREE from 'three';

const BUTTERFLY_COLORS = ['#f5c53a', '#f08bb4', '#7fb2f0', '#ffffff', '#ee8a2b', '#b58ad6'];

function butterflyGeometry() {
  // zwei Flügelpaare (Dreiecke) in der x-z-Ebene; Flattern = Stauchen in z
  const v = [
    0, 0, 0, 0.12, 0, 0.16, -0.06, 0, 0.18,
    0, 0, 0, -0.1, 0, 0.12, -0.04, 0, 0.02,
    0, 0, 0, -0.06, 0, -0.18, 0.12, 0, -0.16,
    0, 0, 0, -0.04, 0, -0.02, -0.1, 0, -0.12,
  ];
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
  g.computeVertexNormals();
  return g;
}

function birdGeometry() {
  // flaches „V“ (Möwe), Spitze vorne (+x)
  const v = [
    0.1, 0, 0, -0.05, 0.08, 0.45, -0.1, 0, 0.05,
    0.1, 0, 0, -0.1, 0, -0.05, -0.05, 0.08, -0.45,
    0.15, 0, 0, -0.15, 0.02, 0.06, -0.15, 0.02, -0.06,
  ];
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
  g.computeVertexNormals();
  return g;
}

export class Ambient {
  constructor(scene, { meadows = [], chimneys = [], rand = Math.random } = {}) {
    this.night = 0;
    const m = new THREE.Matrix4();
    this.m = m;
    this.q = new THREE.Quaternion();
    this.s = new THREE.Vector3();
    this.p = new THREE.Vector3();
    this.e = new THREE.Euler();

    // Schmetterlinge: jeweils 3–5 pro Blumenwiese, flattern um ihren Platz
    this.flies = [];
    for (const [x, z, r] of meadows) {
      const n = 3 + Math.floor(rand() * 3);
      for (let i = 0; i < n; i++) {
        this.flies.push({ cx: x, cz: z, r: r * (0.4 + rand() * 0.6), a: rand() * Math.PI * 2, speed: (0.25 + rand() * 0.35) * (rand() < 0.5 ? 1 : -1),
          h: 0.6 + rand() * 0.8, phase: rand() * 10, wob: 0.6 + rand() * 0.8 });
      }
    }
    this.butterflies = new THREE.InstancedMesh(butterflyGeometry(), new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, roughness: 0.6 }), this.flies.length);
    this.flies.forEach((_, i) => this.butterflies.setColorAt(i, new THREE.Color(BUTTERFLY_COLORS[i % BUTTERFLY_COLORS.length])));
    this.butterflies.frustumCulled = false;
    scene.add(this.butterflies);

    // Vögel: drei kleine Schwärme kreisen hoch oben
    this.flocks = [0, 1, 2].map((k) => ({ cx: (k - 1) * 45, cz: -10 + k * 12, r: 30 + k * 12, a: k * 2, speed: 0.05 + k * 0.015, h: 16 + k * 3 }));
    this.birdCount = this.flocks.length * 5;
    this.birds = new THREE.InstancedMesh(birdGeometry(), new THREE.MeshStandardMaterial({ color: '#4a4f5a', side: THREE.DoubleSide, roughness: 0.8 }), this.birdCount);
    this.birds.frustumCulled = false;
    scene.add(this.birds);

    // Rauch aus Schornsteinen: Wölkchen steigen, wachsen und lösen sich auf
    this.chimneys = chimneys; // [{ obj, pos: Vector3 }]
    this.puffsPer = 4;
    this.smoke = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.2, 2),
      new THREE.MeshStandardMaterial({ color: '#f4f4f4', roughness: 1, transparent: true, opacity: 0.7, depthWrite: false }), Math.max(1, chimneys.length * this.puffsPer));
    this.smoke.frustumCulled = false;
    scene.add(this.smoke);
  }

  update(dt, time) {
    const { m, q, s, p, e } = this;
    const awake = 1 - THREE.MathUtils.smoothstep(this.night, 0.4, 0.8);

    // Schmetterlinge
    this.butterflies.visible = awake > 0.01;
    if (this.butterflies.visible) {
      this.flies.forEach((f, i) => {
        f.a += f.speed * dt;
        const x = f.cx + Math.cos(f.a) * f.r + Math.sin(time * f.wob + f.phase) * 0.6;
        const z = f.cz + Math.sin(f.a) * f.r * 0.8 + Math.cos(time * f.wob * 1.3 + f.phase) * 0.5;
        const y = f.h + Math.sin(time * 2.1 + f.phase) * 0.25;
        const heading = -f.a - (f.speed > 0 ? Math.PI / 2 : -Math.PI / 2);
        const flap = 0.25 + 0.75 * Math.abs(Math.cos(time * 14 + f.phase));
        q.setFromEuler(e.set(0, heading, Math.sin(time * 14 + f.phase) * 0.2));
        s.set(awake, awake, flap * awake);
        this.butterflies.setMatrixAt(i, m.compose(p.set(x, y, z), q, s));
      });
      this.butterflies.instanceMatrix.needsUpdate = true;
    }

    // Vögel (Formation: ein „V“ hinter dem Anführer)
    this.birds.visible = awake > 0.01;
    if (this.birds.visible) {
      let i = 0;
      for (const fl of this.flocks) {
        fl.a += fl.speed * dt;
        const dirA = fl.a + Math.PI / 2;
        const fx = -Math.sin(fl.a);
        const fz = Math.cos(fl.a);
        for (let k = 0; k < 5; k++) {
          const row = Math.ceil(k / 2);
          const sideK = k === 0 ? 0 : (k % 2 ? 1 : -1) * row;
          const x = fl.cx + Math.cos(fl.a) * fl.r - fx * row * 1.4 + fz * sideK * 1.2;
          const z = fl.cz + Math.sin(fl.a) * fl.r - fz * row * 1.4 - fx * sideK * 1.2;
          const y = fl.h + Math.sin(time * 0.7 + k) * 0.3;
          const flap = 0.4 + 0.6 * Math.abs(Math.sin(time * 5 + k * 0.7));
          q.setFromEuler(e.set(0, -dirA + Math.PI / 2, 0));
          s.set(2.2, 2.2 * flap, 2.2);
          this.birds.setMatrixAt(i++, m.compose(p.set(x, y, z), q, s.multiplyScalar(awake)));
        }
      }
      this.birds.instanceMatrix.needsUpdate = true;
    }

    // Schornsteinrauch
    if (this.chimneys.length) {
      let i = 0;
      for (const c of this.chimneys) {
        for (let k = 0; k < this.puffsPer; k++) {
          const t = ((time * 0.35 + k / this.puffsPer + c.phase) % 1);
          const visible = c.obj.visible && c.obj.scale.x > 0.5;
          const sc = visible ? Math.sin(t * Math.PI) * (0.45 + t * 0.9) : 0;
          p.copy(c.pos);
          p.x += t * 0.9 + Math.sin(time + k) * 0.08;
          p.y += t * 2.4;
          this.smoke.setMatrixAt(i++, m.compose(p, q.identity(), s.set(sc, sc, sc)));
        }
      }
      this.smoke.instanceMatrix.needsUpdate = true;
    }
  }
}
