// Fahren: Der eigene Zug fährt auf der selbst gemalten Strecke.
// Große Knöpfe: Los/Halt, Pfeife, Kamera (von oben / mitfahren).
// Geräusche: Dampfstöße im Takt der Räder, Schienenstöße je Achse, Rollen, Zischen beim Anhalten.

import * as THREE from 'three';
import { chuff, railJoint, RollingSound } from '../../audio.js';
import { wave } from '../trainModel.js';

const MAX_SPEED = 4.5;
const JOINT = 5; // Abstand der Schienenstöße
const CHUFF = (2 * Math.PI * 0.36) / 4; // vier Dampfstöße pro Umdrehung des Treibrads
const ACCENT = [1, 0.55, 0.8, 0.55];

class Steam {
  constructor(scene) {
    this.puffs = [];
    const geo = new THREE.IcosahedronGeometry(0.3, 1);
    for (let i = 0; i < 30; i++) {
      const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: '#ffffff', transparent: true, opacity: 0, roughness: 1, depthWrite: false }));
      m.visible = false;
      m.userData.life = 0;
      scene.add(m);
      this.puffs.push(m);
    }
    this.next = 0;
  }

  emit(pos, strength = 1) {
    const p = this.puffs[this.next++ % this.puffs.length];
    p.position.copy(pos);
    p.userData.life = 1;
    p.userData.strength = strength;
    p.userData.drift = new THREE.Vector3((Math.random() - 0.5) * 0.4, 1.3, (Math.random() - 0.5) * 0.4);
    p.visible = true;
  }

  update(dt) {
    for (const p of this.puffs) {
      if (p.userData.life <= 0) continue;
      p.userData.life -= dt / 1.8;
      const age = 1 - p.userData.life;
      p.position.addScaledVector(p.userData.drift, dt);
      p.scale.setScalar((0.5 + age * 2.4) * p.userData.strength);
      p.material.opacity = Math.max(0, p.userData.life) * 0.8;
      if (p.userData.life <= 0) p.visible = false;
    }
  }
}

export function createDriveMode(game) {
  const { services, land, train } = game;
  const d = game.drive;
  const steam = new Steam(land.scene);
  const rolling = new RollingSound();
  let follow = false;
  let chuffAcc = 0;
  let chuffBeat = 0;
  let wasMoving = false;
  let down = null;
  const tmp = new THREE.Vector3();
  const fwd = new THREE.Vector3();
  const side = new THREE.Vector3();

  // ---------- Knöpfe ----------
  const controls = document.createElement('div');
  controls.className = 'drive-controls hidden';
  const btn = (cls, icon, onTap) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = `drive-btn ${cls}`;
    b.textContent = icon;
    b.addEventListener('click', onTap);
    controls.append(b);
    return b;
  };
  const camBtn = btn('cam', '🎥', () => {
    follow = !follow;
    camBtn.classList.toggle('active', follow);
    services.sfx('pop');
  });
  btn('horn', '📯', horn);
  const goBtn = btn('go', '▶', () => {
    d.target = d.target > 0 ? 0 : MAX_SPEED;
    updateGo();
    if (d.target > 0) {
      horn();
      services.sfx('bell');
    }
  });
  game.ui.append(controls);

  function updateGo() {
    goBtn.textContent = d.target > 0 ? '⏸' : '▶';
    goBtn.classList.toggle('stop', d.target > 0);
  }

  const isSteam = () => train.data.cars[0].type === 'dampf';

  function horn() {
    game.hop(train.loco);
    wave(train.loco.userData.driver, game);
    services.sfx(isSteam() ? 'whistle' : 'elhorn');
  }

  function overviewCamera() {
    const pts = land.track.points;
    const xs = pts.map((p) => p[0]);
    const zs = pts.map((p) => p[1]);
    const cx = (Math.max(...xs) + Math.min(...xs)) / 2;
    const cz = (Math.max(...zs) + Math.min(...zs)) / 2;
    const hw = (Math.max(...xs) - Math.min(...xs)) / 2 + 4;
    const hh = (Math.max(...zs) - Math.min(...zs)) / 2 + 4;
    if (game.isPortrait()) {
      game.fit(new THREE.Vector3(cx + 0.8, 0, cz), Math.max(hh, 7), Math.max(hw * 0.8, 11), new THREE.Vector3(0.75, 1, 0));
    } else {
      game.fit(new THREE.Vector3(cx, 0, cz + 0.8), Math.max(hw, 11), Math.max(hh * 0.8, 7), new THREE.Vector3(0, 1, 0.75));
    }
  }

  // Mitfahren: von schräg vorne-seitlich, wie aus einem Hubschrauber neben dem Zug
  function followCamera() {
    const loco = train.loco;
    fwd.set(1, 0, 0).applyQuaternion(loco.quaternion);
    side.set(0, 0, 1).applyQuaternion(loco.quaternion);
    loco.getWorldPosition(tmp);
    game.cam.tPos.copy(tmp).addScaledVector(fwd, 3).addScaledVector(side, 9).add(new THREE.Vector3(0, 4.5, 0));
    game.cam.tLook.copy(tmp).addScaledVector(fwd, -2).add(new THREE.Vector3(0, 1, 0));
  }

  // Positionen aller Achsen hinter der Lokspitze (für die Schienenstöße)
  function axleOffsets() {
    const out = [];
    let f = 0;
    for (const c of train.cars) {
      const len = c.userData.length;
      out.push(f + 0.3, f + 0.9, f + len - 0.9, f + len - 0.3);
      f += len + 0.3;
    }
    return out;
  }

  function railSounds(sBefore, sAfter) {
    let hits = 0;
    for (const off of axleOffsets()) {
      const a = Math.floor((sBefore - off) / JOINT);
      const b = Math.floor((sAfter - off) / JOINT);
      if (a !== b && hits < 3) {
        railJoint(0.5 + Math.min(1, d.speed / MAX_SPEED) * 0.5);
        hits++;
      }
    }
  }

  return {
    enter() {
      game.useScene('land');
      controls.classList.remove('hidden');
      train.placeOnCurve(land.track.curve, land.track.length, d.s);
      updateGo();
      rolling.start(!isSteam());
      if (follow) followCamera();
      else overviewCamera();
    },
    exit() {
      controls.classList.add('hidden');
      d.target = 0;
      d.speed = 0;
      wasMoving = false;
      rolling.stop();
      updateGo();
    },
    onResize() {
      if (!follow) overviewCamera();
    },
    update(dt) {
      land.track.update(dt); // falls die Schienen noch „wachsen“
      // sanft beschleunigen und bremsen
      const acc = d.target > d.speed ? 1.6 : 2.4;
      d.speed += Math.sign(d.target - d.speed) * Math.min(Math.abs(d.target - d.speed), acc * dt);
      const ds = d.speed * dt;
      const before = d.s;
      d.s += ds;
      train.placeOnCurve(land.track.curve, land.track.length, d.s);
      const moving = d.speed > 0.05;
      const speed01 = Math.min(1, d.speed / MAX_SPEED);
      train.animate(dt, ds, moving);
      rolling.set(services.soundsOn() ? speed01 : 0);
      if (services.soundsOn() && moving) railSounds(before, d.s);

      // Dampflok: tschu-tschu im Takt der Räder, dazu Dampfwolken
      const loco = train.loco;
      if (moving && isSteam()) {
        chuffAcc += ds;
        if (chuffAcc >= CHUFF) {
          chuffAcc -= CHUFF;
          const accent = ACCENT[chuffBeat++ % 4];
          if (services.soundsOn()) chuff(accent, speed01);
          if (accent > 0.7) steam.emit(loco.localToWorld(loco.userData.steamPoint.clone()), 0.8 + (1 - speed01) * 0.4);
        }
      }
      if (wasMoving && !moving && isSteam()) {
        services.sfx('hiss');
        for (let i = 0; i < 4; i++) steam.emit(loco.localToWorld(new THREE.Vector3(1.2 - i * 0.3, 0.5, 0.7)), 0.7);
      }
      wasMoving = moving;
      steam.update(dt);
      if (follow) followCamera();
      else overviewCamera();
    },
    pointerDown(e) {
      down = { x: e.clientX, y: e.clientY };
    },
    pointerUp(e, cancelled) {
      if (cancelled || !down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 18) return;
      down = null;
      // Zug antippen = pfeifen; Tiere antippen = sie rufen; Bäume/Häuser wackeln
      if (game.pickCar(e.clientX, e.clientY)) return horn();
      const hits = game.pick(e.clientX, e.clientY, land.tappable.filter((o) => o.visible));
      if (!hits.length) return;
      let o = hits[0].object;
      while (o.parent && !land.tappable.includes(o)) o = o.parent;
      if (o.userData.figure) {
        game.hop(o);
        services.sayName(o.userData.figure);
        return;
      }
      const s0 = o.userData.baseScale ?? o.scale.x;
      game.tween(0.4, (t) => {
        const k = Math.sin(t * Math.PI);
        o.scale.set(s0 * (1 - k * 0.15), s0 * (1 + k * 0.25), s0 * (1 - k * 0.15));
      });
      services.sfx('boing');
    },
  };
}
