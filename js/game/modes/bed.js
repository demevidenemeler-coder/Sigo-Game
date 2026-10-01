// Schlafenszeit: Wenn die Spielzeit um ist, wird der Zug nicht einfach „abgeschaltet“ –
// das Kind bringt ihn ins Bett: Die Decke liegt bereit; irgendwo antippen oder ziehen,
// dann wird der Zug zugedeckt. Die Lampe wird dunkel, es schnarcht leise, ein Wiegenlied spielt
// und kleine „Z“ steigen auf. Danach folgt der Ruhe-Bildschirm.
// Tippt das Kind nichts an, deckt sich der Zug nach einer Weile von selbst zu.

import * as THREE from 'three';

const smooth = THREE.MathUtils.smoothstep;
const GRID_X = 56;
const GRID_Z = 30;
const HOLD_Y = 2.7; // Höhe der Decke in der Hand
const FLOOR = 0.07;
const WAIT_AUTO_MS = 38000;
const SLEEP_MS = 9500;

function quiltTexture() {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 256;
  const g = c.getContext('2d');
  const colors = ['#8fc1ee', '#f6b6c8', '#ffe08a', '#b6e3b0'];
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, 512, 256);
  const cols = 8;
  const rows = 4;
  const cw = 512 / cols;
  const ch = 256 / rows;
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      g.fillStyle = colors[(i + j * 2) % colors.length];
      g.fillRect(i * cw + 5, j * ch + 5, cw - 10, ch - 10);
      // Stern oder Herz in jedem Feld
      g.fillStyle = 'rgba(255,255,255,0.85)';
      const cx = i * cw + cw / 2;
      const cy = j * ch + ch / 2;
      g.beginPath();
      if ((i + j) % 2) {
        for (let k = 0; k < 10; k++) {
          const r = k % 2 ? 7 : 17;
          const a = -Math.PI / 2 + (k * Math.PI) / 5;
          g.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
        }
      } else {
        g.moveTo(cx, cy + 12);
        g.bezierCurveTo(cx - 24, cy - 2, cx - 12, cy - 18, cx, cy - 7);
        g.bezierCurveTo(cx + 12, cy - 18, cx + 24, cy - 2, cx, cy + 12);
      }
      g.fill();
    }
  }
  // Nähte
  g.strokeStyle = 'rgba(120,120,160,0.35)';
  g.setLineDash([6, 6]);
  g.lineWidth = 2;
  g.strokeRect(10, 10, 492, 236);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function zTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  g.font = 'bold 100px system-ui, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.lineWidth = 12;
  g.strokeStyle = '#5a6fb8';
  g.strokeText('Z', 64, 70);
  g.fillStyle = '#ffffff';
  g.fillText('Z', 64, 70);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function createBedMode(game) {
  const { services } = game;
  const train = game.train;
  const room = game.bedroom;
  const quilt = quiltTexture();
  const quiltMat = new THREE.MeshStandardMaterial({ map: quilt, roughness: 1, side: THREE.DoubleSide });
  const zMat = new THREE.SpriteMaterial({ map: zTexture(), transparent: true, depthWrite: false });
  const raycaster = new THREE.Raycaster();
  const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -HOLD_Y);

  let active = false;
  let phase = 'waiting'; // waiting → dragging → covering → sleeping → done
  let blanket = null;
  let bundle = null;
  let W = 8;
  let D = 3.6;
  let profile = [];
  let hold = { x: 0, z: 2 };
  let cover = 0; // 0 = in der Hand, 1 = auf dem Zug
  let unfold = 0; // 0 = gefaltet (Bündel), 1 = ausgebreitet
  let t0 = 0;
  let sleepAt = 0;
  let down = null;
  let lastSnore = 0;
  const zs = [];
  let lastZ = 0;

  // ---------- Decke ----------

  function buildBlanket() {
    W = Math.max(7, train.length + 2.2);
    const geo = new THREE.PlaneGeometry(W, D, GRID_X, GRID_Z).rotateX(-Math.PI / 2);
    geo.userData.base = geo.attributes.position.array.slice();
    blanket = new THREE.Mesh(geo, quiltMat);
    blanket.castShadow = true;
    blanket.receiveShadow = true;
    blanket.frustumCulled = false;
    blanket.visible = false;
    room.scene.add(blanket);

    bundle = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.55, 1.4), quiltMat);
    // Gefaltetes Bündel: abgerundet wirkt es weicher
    bundle.geometry.dispose();
    bundle.geometry = roundedBundle();
    bundle.castShadow = true;
    bundle.position.set(bundlePos().x, 0.3, bundlePos().z);
    bundle.rotation.y = 0.15;
    room.scene.add(bundle);
  }

  function roundedBundle() {
    const g = new THREE.SphereGeometry(1, 28, 18);
    g.scale(1.1, 0.3, 0.8);
    return g;
  }

  const bundlePos = () => ({ x: Math.min(train.length * 0.2, 3.2), z: 3.5 });

  // Höhenprofil der zugedeckten Wagen entlang x
  function computeProfile() {
    const samples = GRID_X * 2 + 1;
    profile = new Array(samples).fill(FLOOR);
    for (const car of train.cars) {
      const box = new THREE.Box3().setFromObject(car);
      // Schornstein, Fahnen und Ballons ragen durch die Decke
      const top = Math.min(box.max.y, car.userData.isLoco ? 2.2 : 2.4);
      const cx = (box.min.x + box.max.x) / 2;
      const half = (box.max.x - box.min.x) / 2;
      for (let i = 0; i < samples; i++) {
        const x = -W / 2 + (i / (samples - 1)) * W;
        const v = FLOOR + (top - FLOOR) * (1 - smooth(Math.abs(x - cx), half - 0.15, half + 0.45));
        if (v > profile[i]) profile[i] = v;
      }
    }
  }

  function heightAt(x) {
    const f = ((x + W / 2) / W) * (profile.length - 1);
    const i = THREE.MathUtils.clamp(Math.floor(f), 0, profile.length - 2);
    return THREE.MathUtils.lerp(profile[i], profile[i + 1], f - i);
  }

  // Form der Decke: zwischen „in der Hand“ (hold) und „liegt auf dem Zug“ (cover)
  function shapeBlanket(time) {
    const pos = blanket.geometry.attributes.position;
    const base = blanket.geometry.userData.base;
    const breathe = phase === 'sleeping' || phase === 'done' ? 1 + Math.sin(time * 1.5) * 0.018 : 1;
    for (let k = 0; k < pos.count; k++) {
      const u = base[k * 3];
      const w = base[k * 3 + 2];
      const nu = u / (W / 2);
      const nw = w / (D / 2);
      // in der Hand: Zipfel hängen herunter, leichtes Wehen
      const hx = hold.x + u * (0.55 + 0.45 * unfold);
      const hz = hold.z + w * (0.55 + 0.45 * unfold);
      const hy = HOLD_Y - 0.55 * (nu * nu * 0.5 + nw * nw * 0.9) + Math.sin(u * 1.3 + time * 3.2 + w) * 0.14 * (1 - cover);
      // auf dem Zug
      const dx = u * 0.97;
      const dz = w * 0.82;
      const side = 1 - smooth(Math.abs(dz), 0.55, 1.55);
      const dy = FLOOR + 0.03 + (heightAt(dx) - FLOOR) * side * breathe + Math.sin(u * 3.1 + w * 2.3) * 0.025 * side;
      pos.setXYZ(k, hx + (dx - hx) * cover, hy + (dy - hy) * cover, hz + (dz - hz) * cover);
    }
    pos.needsUpdate = true;
    blanket.geometry.computeVertexNormals();
  }

  // ---------- Ablauf ----------

  function easeOutBack(x) {
    const c1 = 1.4;
    const c3 = c1 + 1;
    return 1 + c3 * (x - 1) ** 3 + c1 * (x - 1) ** 2;
  }

  function screenOf(world) {
    const v = world.clone().project(game.camera);
    return { x: ((v.x + 1) / 2) * window.innerWidth, y: ((1 - v.y) / 2) * window.innerHeight };
  }

  function fingerToHold(x, y) {
    raycaster.setFromCamera(game.ndc(x, y), game.camera);
    const hit = raycaster.ray.intersectPlane(plane, new THREE.Vector3());
    if (hit) {
      hold.x = THREE.MathUtils.clamp(hit.x, -W / 2, W / 2);
      hold.z = THREE.MathUtils.clamp(hit.z, -1.5, 5);
    }
  }

  function pickUp(x, y) {
    if (phase !== 'waiting') return;
    phase = 'dragging';
    bundle.visible = false;
    blanket.visible = true;
    // fliegt vom Bündel in die Hand
    hold.x = bundlePos().x;
    hold.z = bundlePos().z;
    unfold = 0;
    const from = { x: hold.x, z: hold.z };
    fingerToHold(x, y);
    const to = { x: hold.x, z: hold.z };
    game.tween(0.35, (t) => {
      unfold = t;
      if (phase === 'dragging' && down && !down.moved) {
        hold.x = from.x + (to.x - from.x) * t;
        hold.z = from.z + (to.z - from.z) * t;
      }
    });
    services.sfx('whoosh');
    game.hint.hide();
  }

  function startCover() {
    if (phase === 'covering' || phase === 'sleeping' || phase === 'done') return;
    if (phase === 'waiting') {
      // von selbst (Kind hat nichts getan): Decke hebt vom Bündel ab
      bundle.visible = false;
      blanket.visible = true;
      hold.x = bundlePos().x;
      hold.z = bundlePos().z;
      unfold = 1;
    }
    phase = 'covering';
    game.hint.hide();
    const from = { x: hold.x, z: hold.z };
    services.sfx('whoosh');
    game.tween(1.1, (t) => {
      cover = easeOutBack(Math.min(1, t));
      const m = Math.min(1, t * 1.6);
      hold.x = from.x * (1 - m);
      hold.z = from.z * (1 - m);
    }, () => {
      cover = 1;
      fallAsleep();
    });
  }

  function fallAsleep() {
    phase = 'sleeping';
    sleepAt = performance.now();
    services.sfx('pop');
    services.sfx('lullaby');
    setTimeout(() => active && phase === 'sleeping' && services.say(services.t('goodNight')), 700);
    // Licht wird dunkel, Mond leuchtet weiter
    const l0 = room.light.intensity;
    const h0 = room.hemi.intensity;
    game.tween(3.2, (t) => {
      room.light.intensity = l0 * (1 - t * 0.93);
      room.hemi.intensity = h0 * (1 - t * 0.35);
      room.bulbMat.color.set('#fff0c0').lerp(new THREE.Color('#5a4a3a'), t);
      room.shade.material.emissiveIntensity = 0.25 * (1 - t);
    });
  }

  function spawnZ(now) {
    const head = train.loco?.getWorldPosition(new THREE.Vector3()) ?? new THREE.Vector3(0, 0, 0);
    const s = new THREE.Sprite(zMat);
    s.position.set(head.x + 0.2 + Math.random() * 0.3, 2.9, head.z + 0.3);
    s.scale.setScalar(0.1);
    s.userData = { born: now, size: 0.38 + Math.random() * 0.25, sway: Math.random() * 6 };
    room.scene.add(s);
    zs.push(s);
  }

  function finish() {
    if (phase === 'done') return;
    phase = 'done';
    services.bedDone?.();
  }

  // ---------- Modus ----------

  function showDemo() {
    if (!active || phase !== 'waiting') return;
    const from = screenOf(new THREE.Vector3(bundlePos().x, 0.5, bundlePos().z));
    const to = screenOf(new THREE.Vector3(0, 1.4, 0));
    game.hint.drag(from.x, from.y, to.x, to.y);
  }

  return {
    enter() {
      active = true;
      phase = 'waiting';
      cover = 0;
      unfold = 0;
      down = null;
      lastSnore = 0;
      lastZ = 0;
      game.useScene('bed');
      train.layoutStraight();
      const L = train.length;
      for (const o of [room.rug, room.rugRing]) o.scale.set(L / 2 + 2.6, 3.4, 1);
      room.light.intensity = 80;
      room.hemi.intensity = 0.5;
      room.bulbMat.color.set('#fff0c0');
      room.shade.material.emissiveIntensity = 0.25;
      game.setBottomInset(0);
      game.fit(new THREE.Vector3(0, 1.2, 0.8), L / 2 + 2.4, 3.0, new THREE.Vector3(0.22, 0.5, 1), true);
      game.applyCameraNow();
      game.modeBar.classList.add('hidden');
      room.scene.updateMatrixWorld(true);
      buildBlanket();
      computeProfile();
      shapeBlanket(0);
      t0 = performance.now();
      services.say(services.t('bedtime'));
      setTimeout(showDemo, 3500);
    },
    exit() {
      active = false;
      game.hint.hide();
      game.modeBar.classList.remove('hidden');
      for (const o of [blanket, bundle]) {
        if (!o) continue;
        room.scene.remove(o);
        o.geometry.dispose();
      }
      blanket = bundle = null;
      for (const s of zs) room.scene.remove(s);
      zs.length = 0;
    },
    update(dt) {
      if (!active || !blanket) return;
      const now = performance.now();
      train.animate(dt, 0, false);
      if (phase !== 'waiting' || blanket.visible) shapeBlanket(game.time);
      // Wartet das Kind zu lange, zeigt die Hand die Bewegung – und später deckt sich der Zug von selbst zu
      if (phase === 'waiting') {
        if (game.hint.due(7000)) showDemo();
        if (now - t0 > WAIT_AUTO_MS) startCover();
        bundle.position.y = 0.3 + Math.sin(game.time * 2.2) * 0.03;
      }
      if (phase === 'sleeping' || phase === 'done') {
        // leises Schnarchen und aufsteigende Z
        if (now - lastSnore > 3300) {
          lastSnore = now;
          services.sfx('snore');
        }
        if (now - lastZ > 1500) {
          lastZ = now;
          spawnZ(now);
        }
        if (phase === 'sleeping' && now - sleepAt > SLEEP_MS) finish();
      }
      for (let i = zs.length - 1; i >= 0; i--) {
        const s = zs[i];
        const age = (now - s.userData.born) / 1000;
        s.position.y = 2.9 + age * 0.75;
        s.position.x += Math.sin(age * 2 + s.userData.sway) * dt * 0.25;
        s.scale.setScalar(s.userData.size * Math.min(1, age * 3) * (1 + age * 0.25));
        s.material.opacity = Math.max(0, 1 - age / 3.2);
        if (age > 3.2) {
          room.scene.remove(s);
          zs.splice(i, 1);
        }
      }
    },
    pointerDown(e) {
      if (phase !== 'waiting') return;
      down = { x: e.clientX, y: e.clientY, moved: false };
      pickUp(e.clientX, e.clientY);
    },
    pointerMove(e) {
      if (phase !== 'dragging' || !down) return;
      if (Math.hypot(e.clientX - down.x, e.clientY - down.y) > 14) down.moved = true;
      if (down.moved) fingerToHold(e.clientX, e.clientY);
    },
    pointerUp() {
      if (phase === 'dragging') {
        down = null;
        startCover();
      }
    },
  };
}
