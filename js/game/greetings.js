// Tiere rufen sich zu: Fährt ein Tier im Zug an seinen Artgenossen in der Landschaft vorbei
// (Kuh an der Weide, Huhn am Hof, Ente am Teich, Hund im Dorf …), ruft erst das Tier draußen, dann antwortet das im Zug.

import * as THREE from 'three';

const NEAR = 15; // so nah muss der Wagen am Tier draußen vorbeikommen
const COOLDOWN = 30; // Sekunden, bis dieselbe Tierart wieder grüßt

export class AnimalGreetings {
  constructor(game) {
    this.game = game;
    this.land = game.land;
    this.cool = new Map(); // id → Restzeit
    this.tmp = new THREE.Vector3();
    this.tmp2 = new THREE.Vector3();
  }

  // Tiere draußen: alles Antippbare und alles Bewegte mit einer Figur (nicht die Wagen des Nebenzugs)
  outside() {
    if (!this.list) {
      const set = new Set();
      for (const o of this.land.tappable) if (o.userData.figure) set.add(o);
      for (const a of this.land.animated) if (a.obj.userData.figure) set.add(a.obj);
      this.list = [...set];
    }
    return this.list;
  }

  update(dt) {
    for (const [id, t] of this.cool) this.cool.set(id, t - dt);
    const g = this.game;
    if (g.modeName !== 'drive' || this.busy) return;
    const cars = g.train.cars;
    for (let i = 1; i < cars.length; i++) {
      for (const rider of cars[i].userData.cargoItems) {
        const id = rider.userData.figure;
        if (!id || (this.cool.get(id) ?? 0) > 0) continue;
        rider.getWorldPosition(this.tmp);
        const mate = this.outside().find((o) => o.userData.figure === id && o.visible && o.parent
          && o.getWorldPosition(this.tmp2).distanceTo(this.tmp) < NEAR);
        if (!mate) continue;
        this.greet(mate, rider, id);
        return;
      }
    }
  }

  greet(mate, rider, id) {
    const g = this.game;
    this.cool.set(id, COOLDOWN);
    this.busy = true;
    // das Tier draußen schaut zum Zug und ruft
    mate.getWorldPosition(this.tmp2);
    rider.getWorldPosition(this.tmp);
    const turn = Math.atan2(this.tmp.x - this.tmp2.x, this.tmp.z - this.tmp2.z) - Math.PI / 2;
    if (mate.parent === this.land.scene) mate.rotation.y = turn;
    g.hop(mate);
    g.services.animalCall(id);
    // … und das Tier im Zug antwortet
    setTimeout(() => {
      if (rider.parent) g.hop(rider);
      g.services.animalCall(id);
      setTimeout(() => { this.busy = false; }, 800);
    }, 1300);
  }
}
