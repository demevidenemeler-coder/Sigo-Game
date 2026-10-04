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

    // Glühwürmchen: nachts leuchtende Pünktchen über den Wiesen (gleiche Plätze wie die Schmetterlinge)
    this.fireflies = new THREE.InstancedMesh(new THREE.SphereGeometry(0.05, 6, 4),
      new THREE.MeshBasicMaterial({ color: '#fff27a', transparent: true, opacity: 0.95, fog: false }), this.flies.length * 2);
    this.fireflies.frustumCulled = false;
    this.fireflies.visible = false;
    scene.add(this.fireflies);

    // Vögel: drei kleine Schwärme kreisen hoch oben
    this.flocks = [0, 1, 2].map((k) => ({ cx: (k - 1) * 45, cz: -10 + k * 12, r: 30 + k * 12, a: k * 2, speed: 0.05 + k * 0.015, h: 16 + k * 3 }));
    this.birdCount = this.flocks.length * 5;
    this.birds = new THREE.InstancedMesh(birdGeometry(), new THREE.MeshStandardMaterial({ color: '#4a4f5a', side: THREE.DoubleSide, roughness: 0.8 }), this.birdCount);
    this.birds.frustumCulled = false;
    scene.add(this.birds);

    // Fallendes Laub (Herbst) bzw. Blütenblätter (Frühling): rund um den Blickpunkt
    this.season = 'sommer';
    this.look = new THREE.Vector3();
    this.leafCount = 140;
    const leafGeo = new THREE.PlaneGeometry(0.22, 0.16);
    this.leaves = new THREE.InstancedMesh(leafGeo, new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, roughness: 0.8 }), this.leafCount);
    this.leaves.frustumCulled = false;
    this.leaves.visible = false;
    this.leafData = Array.from({ length: this.leafCount }, () => ({
      x: (rand() - 0.5) * 50, y: rand() * 12, z: (rand() - 0.5) * 40, spin: rand() * 6, sway: rand() * 6, speed: 0.5 + rand() * 0.5,
    }));
    this.leafPalette = null;
    scene.add(this.leaves);

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

    // Glühwürmchen
    const glow = 1 - awake;
    this.fireflies.visible = glow > 0.05;
    if (this.fireflies.visible) {
      this.flies.forEach((f, i) => {
        for (let k = 0; k < 2; k++) {
          const ph = f.phase + k * 3.7;
          const x = f.cx + Math.cos(f.a * 0.6 + ph) * f.r * 1.1 + Math.sin(time * 0.7 + ph) * 0.8;
          const z = f.cz + Math.sin(f.a * 0.6 + ph) * f.r * 0.9 + Math.cos(time * 0.5 + ph) * 0.8;
          const y = 0.5 + f.h * 0.6 + Math.sin(time * 1.3 + ph) * 0.3;
          const blink = Math.max(0, Math.sin(time * 2.2 + ph * 2)) * glow;
          s.setScalar(0.4 + blink);
          this.fireflies.setMatrixAt(i * 2 + k, m.compose(p.set(x, y, z), q.identity(), s));
        }
      });
      this.fireflies.instanceMatrix.needsUpdate = true;
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

    // Fallendes Laub / Blüten
    const falling = this.season === 'herbst' || this.season === 'fruehling';
    this.leaves.visible = falling;
    if (falling) {
      if (this.leafPalette !== this.season) {
        this.leafPalette = this.season;
        const cols = this.season === 'herbst' ? ['#e8902e', '#d0582a', '#f2c23a', '#b8462a', '#a8703f'] : ['#f7c3d6', '#ffffff', '#fbe3ec', '#f4b0c8'];
        this.leafData.forEach((_, i) => this.leaves.setColorAt(i, new THREE.Color(cols[i % cols.length])));
        this.leaves.instanceColor.needsUpdate = true;
      }
      const L = this.look;
      this.leafData.forEach((d, i) => {
        d.y -= dt * d.speed;
        if (d.y < 0.05) {
          d.y = 9 + Math.random() * 4;
          d.x = (Math.random() - 0.5) * 50;
          d.z = (Math.random() - 0.5) * 40;
        }
        const x = L.x + d.x + Math.sin(time * 0.9 + d.sway) * 0.8;
        const z = L.z + d.z + Math.cos(time * 0.7 + d.sway) * 0.5;
        q.setFromEuler(e.set(time * 1.3 + d.spin, d.spin, Math.sin(time * 2 + d.sway) * 0.8));
        this.leaves.setMatrixAt(i, m.compose(p.set(x, d.y, z), q, s.set(1, 1, 1)));
      });
      this.leaves.instanceMatrix.needsUpdate = true;
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
