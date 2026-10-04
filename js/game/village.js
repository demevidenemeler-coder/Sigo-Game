// Leben im Dorf: Oma, Papa und das Kind spazieren über den Platz und winken, wenn der Zug vorbeikommt.
// Auf dem Spielplatz schaukelt der Teddy.

import * as THREE from 'three';
import { buildFigure } from './figures.js';
import { wave } from './trainModel.js';

const WAVE_DIST = 17;
const COOLDOWN = 18;

export class VillageLife {
  constructor(game) {
    this.game = game;
    this.land = game.land;
    const v = this.land.village;
    this.center = v.center;
    this.cooldown = 0;
    this.signature = '';
    this.enabled = true;

    // Spaziergänger: jeder auf seinem Kreis um den Brunnen
    this.walkers = [
      { id: 'oma', r: 3.2, speed: 0.11, a: 0.5, pause: 0 },
      { id: 'papa', r: 3.7, speed: -0.13, a: 2.6, pause: 0 },
      { id: 'kind', r: 2.6, speed: 0.24, a: 4.4, pause: 0, hop: true },
    ].map((w) => {
      const fig = buildFigure(w.id);
      fig.scale.setScalar(1.6);
      fig.userData.baseScale = 1.6;
      this.land.scene.add(fig);
      this.land.tappable.push(fig);
      return { ...w, fig };
    });

    // Schaukeln (zwei Sitze am Gestell, auf einem sitzt der Teddy)
    this.swings = [];
    const frame = v.swing;
    if (frame) {
      frame.updateMatrixWorld(true);
      for (const [x, rider] of [[-0.5, 'teddy'], [0.5, null]]) {
        const pivot = new THREE.Group();
        pivot.position.copy(new THREE.Vector3(x, 1.95, 0).applyMatrix4(frame.matrixWorld));
        pivot.rotation.y = frame.rotation.y;
        const swing = new THREE.Group();
        pivot.add(swing);
        const rope = new THREE.MeshStandardMaterial({ color: '#8a6a4a', roughness: 0.9 });
        for (const z of [-0.2, 0.2]) {
          const r = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 1.45, 5), rope);
          r.position.set(0, -0.72, z);
          swing.add(r);
        }
        const seat = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.05, 0.5), new THREE.MeshStandardMaterial({ color: x < 0 ? '#e5484d' : '#3b7cc9', roughness: 0.5 }));
        seat.position.y = -1.45;
        seat.castShadow = true;
        swing.add(seat);
        if (rider) {
          const t = buildFigure(rider);
          t.scale.setScalar(1.1);
          t.position.set(0, -1.45, 0);
          t.rotation.y = 0;
          swing.add(t);
        }
        this.land.scene.add(pivot);
        this.swings.push({ pivot, swing, phase: x < 0 ? 0 : 1.7, amp: rider ? 0.55 : 0.2, frame });
      }
    }
  }

  // Liegen Schienen mitten durchs Dorf, gehen die Leute nach Hause
  layout() {
    const track = this.land.track;
    const sig = track.length.toFixed(2);
    if (sig === this.signature) return;
    this.signature = sig;
    let d = Infinity;
    for (const [x, z] of track.samples) d = Math.min(d, Math.hypot(x - this.center.x, z - this.center.z));
    this.enabled = d > 5.5;
    for (const w of this.walkers) w.fig.visible = this.enabled;
  }

  update(dt, time) {
    this.layout();
    for (const s of this.swings) {
      s.pivot.visible = s.frame.visible && s.frame.scale.x > 0.5;
      s.swing.rotation.x = Math.sin(time * 1.6 + s.phase) * s.amp; // vor und zurück (quer zum Balken)
    }
    if (!this.enabled) return;
    const loco = this.game.train.loco;
    const lp = loco?.getWorldPosition(new THREE.Vector3());
    const near = lp && this.game.modeName === 'drive' && Math.hypot(lp.x - this.center.x, lp.z - this.center.z) < WAVE_DIST;
    this.cooldown -= dt;
    if (near && this.cooldown <= 0) {
      this.cooldown = COOLDOWN;
      for (const w of this.walkers) {
        w.pause = 2.6;
        w.fig.rotation.y = Math.atan2(lp.x - w.fig.position.x, lp.z - w.fig.position.z);
        if (w.fig.userData.waveArm) wave(w.fig, this.game);
        else this.game.hop(w.fig);
      }
    }
    for (const w of this.walkers) {
      if (w.pause > 0) {
        w.pause -= dt;
        continue;
      }
      w.a += w.speed * dt;
      const x = this.center.x + Math.cos(w.a) * w.r;
      const z = this.center.z + Math.sin(w.a) * w.r * 0.85;
      const dx = -Math.sin(w.a) * Math.sign(w.speed);
      const dz = Math.cos(w.a) * 0.85 * Math.sign(w.speed);
      w.fig.position.set(x, w.hop ? Math.abs(Math.sin(time * 7)) * 0.06 : Math.abs(Math.sin(time * 4 + w.r)) * 0.02, z);
      w.fig.rotation.y = Math.atan2(dx, dz);
      // ab und zu stehen bleiben und schauen
      if (Math.random() < dt * 0.05) w.pause = 1.5 + Math.random() * 2;
    }
  }
}
