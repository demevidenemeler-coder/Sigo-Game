// Zugbegegnung: Auf einer kleinen Nebenstrecke fährt ein zweiter Zug im Kreis. Kommt der Zug des Kindes in seine Nähe,
// winken sich beide (Lokführer und Fahrgäste) und hupen. Die Nebenstrecke sucht sich selbst einen freien Platz in der
// Nähe der Strecke des Kindes – und verschwindet, wenn kein Platz da ist.

import * as THREE from 'three';
import { Track } from './track.js';
import { Train } from './train.js';
import { newCar } from '../catalog.js';
import { wave } from './trainModel.js';
import { WORLD_BOUNDS } from './world.js';
import { makeBeam } from './beams.js';

const RX = 8;
const RZ = 4.6;
const SPEED = 2.0;
const MEET_DIST = 8.5;
const MEET_COOLDOWN = 22; // Sekunden, bevor sich beide wieder zuwinken

function sideTrainData() {
  const loco = newCar('elok');
  loco.decor = ['gesicht'];
  const w1 = newCar('personen');
  w1.paint = { ...w1.paint, body: '#f08bb4', roof: '#8b5bb5', wheel: '#8b5bb5' };
  w1.cargo = ['hase', 'katze'];
  w1.dest = [null, null];
  const w2 = newCar('schluss');
  w2.paint = { ...w2.paint, body: '#3fb26b', roof: '#f5d33a', wheel: '#f5d33a' };
  return { cars: [loco, w1, w2] };
}

const loopPoints = (cx, cz, rot) => Array.from({ length: 20 }, (_, i) => {
  const a = (i / 20) * Math.PI * 2;
  const x = Math.cos(a) * RX;
  const z = Math.sin(a) * RZ;
  return [cx + x * Math.cos(rot) - z * Math.sin(rot), cz + x * Math.sin(rot) + z * Math.cos(rot)];
});

export class SideTrain {
  constructor(game) {
    this.game = game;
    this.land = game.land;
    this.group = new THREE.Group();
    this.land.scene.add(this.group);
    this.track = new Track();
    this.group.add(this.track.group);
    this.train = new Train(sideTrainData());
    this.group.add(this.train.group);
    this.train.group.position.y = 0.27; // Höhe der Schienenoberkante
    for (const c of this.train.cars) {
      c.userData.kind = 'sidecar';
      this.land.tappable.push(c);
    }
    // nachts Fernlicht auch beim zweiten Zug
    const beam = makeBeam({ length: 8, width: 2.8, height: 0.9 });
    beam.position.x = 1.5;
    this.train.loco.add(beam);
    this.placed = false;
    this.center = null;
    this.s = 0;
    this.signature = '';
    this.cooldown = 8;
    this.land.extraFootprints = [];
  }

  // Passenden freien Platz suchen (möglichst nah an der Strecke des Kindes)
  layout() {
    const land = this.land;
    const track = land.track;
    const stations = land.objects.items.map((i) => `${i.type}${i.s.toFixed(1)}`).join(',');
    const sig = `${track.length.toFixed(2)}|${stations}`;
    if (sig === this.signature) return;
    this.signature = sig;

    const fp = [...land.objects.footprints(), ...(land.crossings?.footprints() ?? [])];
    const marginX = WORLD_BOUNDS.x - RX - 3;
    const marginZ = WORLD_BOUNDS.z - RX - 2;
    let best = null;
    for (let cx = -marginX; cx <= marginX; cx += 6) {
      for (let cz = -marginZ; cz <= marginZ; cz += 5) {
        for (const rot of [0, Math.PI / 2]) {
          const pts = loopPoints(cx, cz, rot);
          let ok = true;
          let nearest = Infinity;
          for (const [x, z] of pts) {
            if (land.features.blocked(x, z, 3.2) || fp.some(([fx, fz, r]) => Math.hypot(fx - x, fz - z) < r + 3)) {
              ok = false;
              break;
            }
            for (const [sx, sz] of track.samples) nearest = Math.min(nearest, Math.hypot(sx - x, sz - z));
            if (nearest < 6.5) {
              ok = false;
              break;
            }
          }
          if (!ok) continue;
          // auch die Mitte der Schlaufe darf nicht von der Strecke des Kindes durchquert werden
          let centerDist = Infinity;
          for (const [sx, sz] of track.samples) centerDist = Math.min(centerDist, Math.hypot(sx - cx, sz - cz));
          if (centerDist < 6.5) continue;
          // je näher an der Strecke, desto besser (man soll sich begegnen), aber nicht direkt daneben
          const score = nearest + centerDist * 0.2;
          if (!best || score < best.score) best = { cx, cz, rot, score, pts };
        }
      }
    }
    if (!best) {
      this.placed = false;
      this.center = null;
      this.group.visible = false;
      land.extraFootprints = [];
      land.clearAroundTrack();
      return;
    }
    this.placed = true;
    this.center = [best.cx, best.cz];
    this.group.visible = true;
    this.track.setPoints(best.pts.map(([x, z]) => [+x.toFixed(2), +z.toFixed(2)]));
    land.extraFootprints = best.pts.flatMap(([x, z], i) => (i % 2 ? [] : [[x, z, 2.2]])).concat([[best.cx, best.cz, 3]]);
    land.clearAroundTrack();
    this.s = this.train.length + 1;
  }

  update(dt) {
    this.layout();
    if (!this.placed) return;
    const ds = SPEED * dt;
    this.s = (this.s + ds) % this.track.length;
    this.train.placeOnCurve(this.track.curve, this.track.length, this.s);
    this.train.animate(dt, ds, true);
    // Begegnung: Der Zug des Kindes ist nah
    this.cooldown -= dt;
    const mine = this.game.train.loco;
    if (this.cooldown <= 0 && mine && mine.parent) {
      const a = this.train.loco.getWorldPosition(new THREE.Vector3());
      const b = mine.getWorldPosition(new THREE.Vector3());
      if (a.distanceTo(b) < MEET_DIST) this.meet();
    }
  }

  // Beide winken und hupen
  meet() {
    this.cooldown = MEET_COOLDOWN;
    const g = this.game;
    this.waveAll(this.train.cars);
    this.waveAll(g.train.cars);
    g.services.sfx('elhorn');
    setTimeout(() => g.services.sfx('whistle'), 700);
  }

  waveAll(cars) {
    cars.forEach((c, i) => {
      setTimeout(() => {
        wave(c.userData.driver, this.game);
        for (const f of c.userData.cargoItems ?? []) wave(f, this.game);
      }, i * 140);
    });
  }

  // Antippen: winken und hupen
  tap() {
    this.cooldown = MEET_COOLDOWN;
    this.waveAll(this.train.cars);
    this.game.hop(this.train.loco);
    this.game.services.sfx('elhorn');
  }
}
