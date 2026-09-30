// Fahren: Der eigene Zug fährt auf der selbst gemalten Strecke.
// Große Knöpfe: Los/Halt, Hupe, Kamera (von oben / mitfahren).

import * as THREE from 'three';

const MAX_SPEED = 4.5;

class Steam {
  constructor(scene) {
    this.puffs = [];
    const geo = new THREE.SphereGeometry(0.3, 10, 8);
    for (let i = 0; i < 24; i++) {
      const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: '#ffffff', transparent: true, opacity: 0, roughness: 1 }));
      m.visible = false;
      m.userData.life = 0;
      scene.add(m);
      this.puffs.push(m);
    }
    this.next = 0;
  }

  emit(pos) {
    const p = this.puffs[this.next++ % this.puffs.length];
    p.position.copy(pos);
    p.userData.life = 1;
    p.userData.drift = new THREE.Vector3((Math.random() - 0.5) * 0.4, 1.2, (Math.random() - 0.5) * 0.4);
    p.visible = true;
  }

  update(dt) {
    for (const p of this.puffs) {
      if (p.userData.life <= 0) continue;
      p.userData.life -= dt / 1.6;
      const age = 1 - p.userData.life;
      p.position.addScaledVector(p.userData.drift, dt);
      p.scale.setScalar(0.6 + age * 2.2);
      p.material.opacity = Math.max(0, p.userData.life) * 0.85;
      if (p.userData.life <= 0) p.visible = false;
    }
  }
}

export function createDriveMode(game) {
  const { services, land, train } = game;
  const d = game.drive;
  const steam = new Steam(land.scene);
  let follow = false;
  let sinceClack = 0;
  let sincePuff = 0;
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
    goBtn.textContent = d.target > 0 ? '⏸' : '▶';
    goBtn.classList.toggle('stop', d.target > 0);
    if (d.target > 0) horn();
  });
  game.ui.append(controls);

  function horn() {
    game.hop(train.loco);
    services.sfx(train.data.cars[0].type === 'dampf' ? 'whistle' : 'elhorn');
  }

  function overviewCamera() {
    const pts = land.track.points;
    const xs = pts.map((p) => p[0]);
    const zs = pts.map((p) => p[1]);
    const cx = (Math.max(...xs) + Math.min(...xs)) / 2;
    const cz = (Math.max(...zs) + Math.min(...zs)) / 2;
    const hw = (Math.max(...xs) - Math.min(...xs)) / 2 + 3;
    const hh = (Math.max(...zs) - Math.min(...zs)) / 2 + 3;
    if (game.isPortrait()) {
      game.fit(new THREE.Vector3(cx + 0.8, 0, cz), Math.max(hh, 6), Math.max(hw * 0.8, 10), new THREE.Vector3(0.75, 1, 0));
    } else {
      game.fit(new THREE.Vector3(cx, 0, cz + 0.8), Math.max(hw, 10), Math.max(hh * 0.8, 6), new THREE.Vector3(0, 1, 0.75));
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

  return {
    enter() {
      game.useScene('land');
      controls.classList.remove('hidden');
      train.placeOnCurve(land.track.curve, land.track.length, d.s);
      goBtn.textContent = d.target > 0 ? '⏸' : '▶';
      if (follow) followCamera();
      else overviewCamera();
    },
    exit() {
      controls.classList.add('hidden');
      d.target = 0;
      d.speed = 0;
      goBtn.classList.remove('stop');
    },
    onResize() {
      if (!follow) overviewCamera();
    },
    update(dt) {
      land.track.update(dt); // falls die Schienen noch „wachsen“
      // sanft beschleunigen und bremsen
      const acc = d.target > d.speed ? 1.8 : 2.6;
      d.speed += Math.sign(d.target - d.speed) * Math.min(Math.abs(d.target - d.speed), acc * dt);
      const ds = d.speed * dt;
      d.s = (d.s + ds) % (land.track.length * 1000);
      train.placeOnCurve(land.track.curve, land.track.length, d.s);
      const moving = d.speed > 0.05;
      train.animate(dt, ds, moving);

      sinceClack += ds;
      sincePuff += ds;
      if (sinceClack > 3) {
        sinceClack = 0;
        if (moving) services.sfx('clack');
      }
      const loco = train.loco;
      if (loco.userData.steamPoint && moving && sincePuff > 0.9) {
        sincePuff = 0;
        steam.emit(loco.localToWorld(loco.userData.steamPoint.clone()));
        services.sfx('puff');
      }
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
      // Zug antippen = hupen, Baum/Haus antippen = es hüpft
      if (game.pickCar(e.clientX, e.clientY)) return horn();
      const hits = game.pick(e.clientX, e.clientY, land.scenery.filter((o) => o.visible));
      if (hits.length) {
        let o = hits[0].object;
        while (o.parent && !land.scenery.includes(o)) o = o.parent;
        const s0 = o.userData.baseScale;
        game.tween(0.4, (t) => o.scale.set(s0 * (1 - Math.sin(t * Math.PI) * 0.15), s0 * (1 + Math.sin(t * Math.PI) * 0.25), s0 * (1 - Math.sin(t * Math.PI) * 0.15)));
        services.sfx('boing');
      }
    },
  };
}
