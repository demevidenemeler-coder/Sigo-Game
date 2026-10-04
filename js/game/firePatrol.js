// Einsatzfahrt: Ab und zu rückt das Feuerwehrauto mit Tatütata aus – aus der Wache über die Zufahrt auf die
// Landstraße, ein Stück die Straße entlang (hält an geschlossenen Schranken), wendet und kommt wieder zurück.
// Die Autos fahren dabei an den Rand (Rettungsgasse).

import * as THREE from 'three';

const SPEED = 6.5; // schneller als die Autos
const FIRST = 50; // erste Fahrt nach so vielen Sekunden Fahren
const EVERY = [150, 220]; // danach alle 2,5–3,5 Minuten
const RANGE = 75; // so weit fährt das Auto die Straße entlang, dann wendet es

export class FirePatrol {
  constructor(village) {
    this.v = village;
    this.game = village.game;
    this.land = village.land;
    this.timer = FIRST;
    this.active = null;
    this.tmp = new THREE.Vector3();
    this.tg = new THREE.Vector3();
    if (village.fire) this.paveDriveway();
  }

  // Gepflasterte Zufahrt von der Wache zur Straße (flache Platten entlang der Fahrlinie)
  paveDriveway() {
    const f = this.v.fire;
    f.root.updateMatrixWorld(true);
    const { curve } = this.driveway();
    const mat = new THREE.MeshStandardMaterial({ color: '#b8b2a6', roughness: 0.95, polygonOffset: true, polygonOffsetFactor: -1 });
    const L = curve.getLength();
    const n = Math.ceil(L / 0.6);
    const geo = new THREE.BoxGeometry(1.7, 0.03, 0.7);
    const im = new THREE.InstancedMesh(geo, mat, n);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const p = new THREE.Vector3();
    const tg = new THREE.Vector3();
    for (let i = 0; i < n; i++) {
      const u = 0.32 + (i / (n - 1)) * 0.66; // erst ab dem Vorplatz, bis kurz vor die Straße
      curve.getPointAt(u, p);
      curve.getTangentAt(u, tg);
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.atan2(tg.x, tg.z));
      m.compose(p.setY(0.025), q, new THREE.Vector3(1, 1, 1));
      im.setMatrixAt(i, m);
    }
    im.receiveShadow = true;
    this.land.scene.add(im);
    this.pave = im;
  }

  // Zufahrt (Weltkoordinaten): von drinnen nach vorne, rechts um die Wache herum zur Straße
  driveway() {
    const f = this.v.fire;
    const m = f.root.matrixWorld;
    const L = (x, z) => new THREE.Vector3(x, 0, z).applyMatrix4(m);
    const join = this.land.features.roadNearest(L(3.6, -3.4).x, L(3.6, -3.4).z);
    const road = this.land.features.road;
    const len = this.land.features.roadS.length;
    const rp = road.getPointAt(join.t / len);
    const pts = [L(0.35, f.home), L(0.35, 2.6), L(1.6, 3.0), L(3.2, 2.4), L(3.6, 0), L(3.6, -2.2), new THREE.Vector3(rp.x, 0, rp.z)];
    return { curve: new THREE.CatmullRomCurve3(pts, false, 'centripetal'), joinT: join.t };
  }

  start() {
    const f = this.v.fire;
    if (!f || f.busy || f.patrol) return false;
    f.busy = true;
    f.patrol = true;
    f.used = true;
    const g = this.game;
    f.root.updateMatrixWorld(true);
    const { curve, joinT } = this.driveway();
    // Richtung: dorthin, wo mehr Straße ist (meist nach Westen ins Land hinein)
    const len = this.land.features.roadS.length;
    const dir = joinT - RANGE > 0 ? -1 : 1;
    this.active = { phase: 'door', t: 0, curve, joinT, dir, roadT: joinT, far: THREE.MathUtils.clamp(joinT + dir * RANGE, 2, len - 2), lane: 0, sirenAt: 0 };
    g.services.sfx('siren');
    f.flash = 999;
    g.tween(0.7, (t) => { f.door.position.y = t * 2.0; f.door.scale.y = 1 - t * 0.85; }, () => {
      this.land.scene.attach(f.truck);
      this.active.phase = 'out';
    });
    return true;
  }

  // Straßenposition für das Auto (Fahrspur je nach Richtung)
  placeOnRoad(t, dir, laneBlend = 1) {
    const { road, roadS } = this.land.features;
    const L = roadS.length;
    road.getPointAt(THREE.MathUtils.clamp(t / L, 0, 1), this.tmp);
    road.getTangentAt(THREE.MathUtils.clamp(t / L, 0, 1), this.tg);
    const lane = (dir > 0 ? -0.8 : 0.8) * laneBlend;
    const truck = this.v.fire.truck;
    truck.position.set(this.tmp.x - this.tg.z * lane, 0, this.tmp.z + this.tg.x * lane);
    truck.rotation.set(0, Math.atan2(this.tg.x * dir, this.tg.z * dir), 0); // Auto schaut nach +z
  }

  faceAlong(curve, u, sign = 1) {
    const truck = this.v.fire.truck;
    curve.getPointAt(u, this.tmp);
    curve.getTangentAt(u, this.tg);
    truck.position.set(this.tmp.x, 0, this.tmp.z);
    truck.rotation.set(0, Math.atan2(this.tg.x * sign, this.tg.z * sign), 0);
  }

  // Schranken: vor geschlossenen Übergängen anhalten
  stopBefore(tFrom, tTo, dir) {
    let t = tTo;
    for (const x of this.land.crossings.crossings) {
      if (!x.closed) continue;
      const stop = dir > 0 ? x.t0 - 1.6 : x.t1 + 1.6;
      const before = dir > 0 ? tFrom <= stop + 0.01 : tFrom >= stop - 0.01;
      if (before) t = dir > 0 ? Math.min(t, stop) : Math.max(t, stop);
    }
    return t;
  }

  update(dt) {
    const g = this.game;
    const f = this.v.fire;
    if (!f) return;
    if (this.pave) this.pave.visible = f.root.visible;
    if (!this.active) {
      if (g.modeName !== 'drive' || f.busy || this.v.cat?.state === 'rescue') return;
      this.timer -= dt;
      if (this.timer <= 0) {
        this.timer = EVERY[0] + Math.random() * (EVERY[1] - EVERY[0]);
        this.start();
      }
      this.land.features.emergency = null;
      return;
    }
    const a = this.active;
    const ddL = a.curve.getLength();
    // Sirene ab und zu, wenn der Zug in der Nähe ist
    a.sirenAt -= dt;
    const lp = g.train.loco?.getWorldPosition(new THREE.Vector3());
    if (a.sirenAt <= 0 && lp && lp.distanceTo(f.truck.position) < 22 && a.phase !== 'door') {
      a.sirenAt = 7;
      g.services.sfx('siren');
    }
    if (a.phase === 'out') {
      a.t = Math.min(1, a.t + (SPEED * 0.6 * dt) / ddL);
      this.faceAlong(a.curve, a.t);
      if (a.t >= 1) {
        a.phase = 'road';
        // Tor wieder zu, solange das Auto unterwegs ist
        g.tween(0.7, (t) => { f.door.position.y = (1 - t) * 2.0; f.door.scale.y = 0.15 + t * 0.85; });
      }
    } else if (a.phase === 'road' || a.phase === 'back') {
      const goal = a.phase === 'road' ? a.far : a.joinT;
      const dir = Math.sign(goal - a.roadT) || a.dir;
      let t = a.roadT + dir * SPEED * dt;
      t = this.stopBefore(a.roadT, t, dir);
      if ((goal - t) * dir <= 0) t = goal;
      a.roadT = t;
      a.lane = Math.min(1, a.lane + dt * 1.5);
      this.placeOnRoad(t, dir, a.lane);
      this.land.features.emergency = { t, dir };
      if (t === goal) {
        if (a.phase === 'road') {
          a.phase = 'back'; // wenden
          g.services.sfx('siren');
        } else {
          a.phase = 'in';
          a.t = 1;
          this.land.features.emergency = null;
          g.tween(0.7, (tt) => { f.door.position.y = tt * 2.0; f.door.scale.y = 1 - tt * 0.85; });
        }
      }
    } else if (a.phase === 'in') {
      // Zufahrt zurück (vorwärts), zuletzt rückwärts in die Halle
      a.t = Math.max(0, a.t - (SPEED * 0.6 * dt) / ddL);
      this.faceAlong(a.curve, a.t, -1);
      if (a.t <= 0.3) {
        a.phase = 'park';
        const truck = f.truck;
        f.root.attach(truck);
        const from = truck.position.clone();
        const rot0 = truck.rotation.y;
        const turn = Math.atan2(Math.sin(-rot0), Math.cos(-rot0)); // kürzeste Drehung auf „nach vorne“
        const front = new THREE.Vector3(0.35, 0, 3.3);
        g.tween(1.1, (t) => {
          const k = t * t * (3 - 2 * t);
          truck.position.lerpVectors(from, front, k);
          truck.rotation.y = rot0 + turn * k;
        }, () => g.tween(1.6, (t) => {
          // rückwärts in die Halle
          truck.position.lerpVectors(front, new THREE.Vector3(0.35, 0, f.home), t * t * (3 - 2 * t));
          truck.rotation.y = 0;
        }, () => {
          truck.position.set(0.35, 0, f.home);
          truck.rotation.set(0, 0, 0);
          g.tween(0.7, (tt) => { f.door.position.y = (1 - tt) * 2.0; f.door.scale.y = 0.15 + tt * 0.85; }, () => {
            f.busy = false;
            f.patrol = false;
            f.flash = 0;
            this.active = null;
          });
        }));
      }
    }
  }
}
