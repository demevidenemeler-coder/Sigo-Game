import * as THREE from 'three';
import { buildCar, disposeCar, animateCar } from './trainModel.js';

const GAP = 0.3; // Abstand zwischen den Wagen
const BOGIE = 0.55; // Abstand der Achsen vom Wagenende

export class Train {
  constructor(data) {
    this.group = new THREE.Group();
    this.data = data;
    this.cars = [];
    this.time = 0;
    this.rebuild();
  }

  rebuild() {
    for (const c of this.cars) {
      this.group.remove(c);
      disposeCar(c);
    }
    this.cars = this.data.cars.map((d) => buildCar(d));
    this.cars.forEach((c) => this.group.add(c));
  }

  // Einen einzelnen Wagen neu bauen (nach Anmalen, Schmücken, Beladen)
  rebuildCar(index) {
    const old = this.cars[index];
    const car = buildCar(this.data.cars[index]);
    car.position.copy(old.position);
    car.quaternion.copy(old.quaternion);
    this.group.remove(old);
    disposeCar(old);
    this.group.add(car);
    this.cars[index] = car;
    return car;
  }

  get loco() {
    return this.cars[0];
  }

  get length() {
    return this.cars.reduce((s, c) => s + c.userData.length, 0) + GAP * (this.cars.length - 1);
  }

  // Gerade aufstellen, zentriert um x = 0, Lok vorne (+x)
  layoutStraight() {
    let x = this.length / 2;
    for (const c of this.cars) {
      const len = c.userData.length;
      c.position.set(x - len / 2, 0, 0);
      c.rotation.set(0, 0, 0);
      x -= len + GAP;
    }
  }

  // Auf eine geschlossene Kurve setzen. sHead = Position der Lokspitze auf der Strecke.
  placeOnCurve(curve, total, sHead, y = 0) {
    const wrap = (s) => ((s % total) + total) % total / total;
    const a = new THREE.Vector3();
    const b = new THREE.Vector3();
    let s = sHead;
    for (const c of this.cars) {
      const len = c.userData.length;
      curve.getPointAt(wrap(s - BOGIE), a);
      curve.getPointAt(wrap(s - len + BOGIE), b);
      c.position.set((a.x + b.x) / 2, y, (a.z + b.z) / 2);
      c.rotation.set(0, Math.atan2(-(a.z - b.z), a.x - b.x), 0);
      s -= len + GAP;
    }
  }

  animate(dt, distanceDelta, moving) {
    this.time += dt;
    for (const c of this.cars) animateCar(c, this.time, distanceDelta, moving);
  }

  carIndexOf(obj) {
    const car = obj?.userData?.car;
    return car ? this.cars.indexOf(car) : -1;
  }
}
