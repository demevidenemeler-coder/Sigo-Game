// Waschen: Ein Wagen ganz nah – mit dem Finger (Schwamm) den Matsch wegwischen.
// - Wo der Finger wischt, schäumt es und die Matschflecken werden blasser, bis sie weg sind.
// - Ist alles weg: Wasser spült den Schaum ab, es glitzert – „Blitzsauber!“ – weiter zum nächsten schmutzigen Wagen.
// - Der Eimer macht den Wagen wieder matschig (zum Nochmal-Waschen).
// - ◀ ▶ wechseln den Wagen.

import * as THREE from 'three';
import { applyDirt } from '../trainModel.js';

const MAX_SPLATS = 22;
const RUB_RADIUS = 0.6;
const splatGeo = new THREE.SphereGeometry(0.2, 14, 10);
const foamGeo = new THREE.SphereGeometry(0.09, 10, 8);
const dropGeo = new THREE.SphereGeometry(0.06, 8, 6);
const starGeo = new THREE.OctahedronGeometry(0.12);
const MUD_COLORS = ['#5e4027', '#6b4a2b', '#4f3520', '#7a5634'];

export function createWashMode(game) {
  const { services } = game;
  const train = game.train;
  const ws = game.workshop;
  let index = 0;
  let active = false;
  let busy = false;
  let splats = [];
  let startDirt = 0;
  let rub = null;
  let lastSound = 0;
  let lastRub = performance.now();
  let hinted = false;
  const fx = []; // Schaum, Wassertropfen, Sterne: { mesh, life, kind, v }
  const raycaster = new THREE.Raycaster();

  // ---------- Bedienelemente ----------

  const controls = document.createElement('div');
  controls.className = 'wash-controls hidden';
  const btn = (cls, text, onClick) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = `drive-btn ${cls}`;
    b.textContent = text;
    b.addEventListener('click', onClick);
    controls.append(b);
    return b;
  };
  btn('prev', '◀', () => step(-1));
  const mudBtn = btn('mud', '🪣', () => throwMud());
  btn('next', '▶', () => step(1));
  game.ui.append(controls);

  const sponge = document.createElement('div');
  sponge.className = 'sponge hidden';
  sponge.textContent = '🧽';
  game.ui.append(sponge);

  const car = () => train.cars[index];
  const dirtOf = (i) => train.data.cars[i].dirt ?? 0;

  function moveSponge(x, y) {
    sponge.style.transform = `translate(${x}px, ${y}px)`;
  }

  function spongeHome() {
    const c = car();
    if (!c) return;
    const v = c.getWorldPosition(new THREE.Vector3());
    v.y += 1.0;
    v.project(game.camera);
    moveSponge(((v.x + 1) / 2) * window.innerWidth, ((1 - v.y) / 2) * window.innerHeight);
  }

  // ---------- Matschflecken ----------

  // Nur Wagenteile treffen (keine Mitfahrer, Sprechblasen, Flecken oder Schaum)
  function carHits(c, origin, dir) {
    raycaster.set(origin, dir);
    raycaster.camera = game.camera;
    return raycaster.intersectObject(c, true).filter((h) => {
      if (h.object.isSprite || !h.object.isMesh || !h.object.visible) return false;
      for (let o = h.object; o && o !== c; o = o.parent) {
        if (o.userData.washFx || c.userData.cargoItems.includes(o) || c.userData.mud.includes(o)) return false;
      }
      return true;
    });
  }

  function addSplat(c, pop) {
    c.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(c);
    for (let tries = 0; tries < 8; tries++) {
      const x = THREE.MathUtils.lerp(box.min.x + 0.2, box.max.x - 0.2, Math.random());
      const y = THREE.MathUtils.lerp(0.75, Math.min(box.max.y - 0.1, 2.3), Math.random());
      const hit = carHits(c, new THREE.Vector3(x, y, box.max.z + 3), new THREE.Vector3(0, 0, -1))[0];
      if (!hit) continue;
      const n = hit.face.normal.clone().transformDirection(hit.object.matrixWorld);
      if (n.z < 0.2) continue;
      const g = new THREE.Group();
      g.userData.washFx = true;
      const mat = new THREE.MeshStandardMaterial({ color: MUD_COLORS[Math.floor(Math.random() * MUD_COLORS.length)], roughness: 1, transparent: true });
      // ein großer Klecks und ein paar Spritzer
      const blob = new THREE.Mesh(splatGeo, mat);
      blob.scale.set(1 + Math.random() * 0.9, 0.7 + Math.random() * 0.6, 0.16);
      blob.rotation.z = Math.random() * Math.PI;
      g.add(blob);
      for (let k = 0; k < 3; k++) {
        const d = new THREE.Mesh(splatGeo, mat);
        const a = Math.random() * Math.PI * 2;
        d.position.set(Math.cos(a) * 0.38, Math.sin(a) * 0.3, 0);
        d.scale.set(0.3, 0.3, 0.12).multiplyScalar(0.7 + Math.random() * 0.6);
        g.add(d);
      }
      g.position.copy(hit.point).addScaledVector(n, 0.02);
      g.lookAt(hit.point.clone().add(n.multiplyScalar(2)));
      c.attach(g);
      g.userData.amount = 1;
      g.userData.base = g.scale.x;
      g.userData.mat = mat;
      splats.push(g);
      if (pop) game.popIn(g);
      return g;
    }
    return null;
  }

  function clearSplats() {
    for (const s of splats) s.parent?.remove(s);
    splats = [];
  }

  // Wie schmutzig ist der Wagen gerade (0..1)? Färbt den Lack entsprechend.
  function remaining() {
    if (!splats.length) return 0;
    return splats.reduce((a, s) => a + Math.max(0, s.userData.amount), 0) / splats.length;
  }

  function updateTint() {
    const c = car();
    c.userData.data.dirt = startDirt * remaining();
    applyDirt(c);
    for (const m of c.userData.mud) m.visible = false;
  }

  // ---------- Wagen auswählen ----------

  function leaveCar() {
    const c = car();
    if (!c) return;
    c.userData.data.dirt = startDirt * remaining();
    clearSplats();
    applyDirt(c);
    for (const f of fx) f.mesh.parent?.remove(f.mesh);
    fx.length = 0;
  }

  function focus(i, instant = false) {
    leaveCar();
    index = (i + train.cars.length) % train.cars.length;
    const c = car();
    startDirt = dirtOf(index);
    if (startDirt > 0.02) {
      const n = Math.round(6 + 14 * startDirt);
      for (let k = 0; k < n; k++) addSplat(c, false);
    }
    updateTint();
    const p = c.getWorldPosition(new THREE.Vector3());
    p.y += 1.0;
    game.fit(p, c.userData.length / 2 + 0.7, 1.5, new THREE.Vector3(0.12, 0.28, 1), instant);
    mudBtn.classList.toggle('pulse-soft', !splats.length);
    hinted = false;
    lastRub = performance.now();
  }

  function step(dir) {
    if (busy) return;
    services.sfx('pop');
    focus(index + dir);
    services.sayName(train.data.cars[index].type);
  }

  // ---------- Matsch werfen ----------

  function throwMud() {
    if (busy) return;
    const c = car();
    const before = remaining() * startDirt;
    startDirt = 1;
    // bisherige Flecken entsprechend ihres Restes behalten, neue dazu
    const target = Math.min(MAX_SPLATS, splats.filter((s) => s.userData.amount > 0).length + 8);
    let k = 0;
    const add = () => {
      if (!active || index !== train.cars.indexOf(c)) return;
      if (splats.filter((s) => s.userData.amount > 0).length >= target || k++ > 14) {
        updateTint();
        game.saveTrain();
        return;
      }
      if (addSplat(c, true)) services.sfx('splat');
      updateTint();
      setTimeout(add, 110);
    };
    // alte, fast weggewischte Flecken wieder auf voll
    if (before < 0.02) clearSplats();
    for (const s of splats) s.userData.amount = Math.max(s.userData.amount, 0.6);
    mudBtn.classList.remove('pulse-soft');
    game.hop(c);
    add();
    if (!hinted) setTimeout(() => active && services.say(services.t('washHint')), 1400);
    hinted = true;
  }

  // ---------- Wischen ----------

  function foamAt(point, normal) {
    const c = car();
    const m = new THREE.Mesh(foamGeo, new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.25, transparent: true, opacity: 0.95 }));
    m.userData.washFx = true;
    m.position.copy(point).addScaledVector(normal, 0.06).add(new THREE.Vector3((Math.random() - 0.5) * 0.25, (Math.random() - 0.5) * 0.25, 0));
    m.scale.setScalar(0.01);
    c.attach(m);
    fx.push({ mesh: m, life: 1, kind: 'foam', size: 0.7 + Math.random() * 0.9 });
    if (fx.filter((f) => f.kind === 'foam').length > 90) {
      const old = fx.find((f) => f.kind === 'foam');
      old.life = Math.min(old.life, 0.1);
    }
  }

  function rubAt(x, y, moved) {
    const c = car();
    game.raycaster.setFromCamera(game.ndc(x, y), game.camera);
    const hit = carHits(c, game.raycaster.ray.origin, game.raycaster.ray.direction)[0];
    if (!hit) return;
    lastRub = performance.now();
    const n = hit.face.normal.clone().transformDirection(hit.object.matrixWorld);
    rub.foamDist = (rub.foamDist ?? 0) + moved;
    while (rub.foamDist > 14) {
      rub.foamDist -= 14;
      foamAt(hit.point, n);
    }
    let cleaned = false;
    const wp = new THREE.Vector3();
    for (const s of splats) {
      if (s.userData.amount <= 0) continue;
      s.getWorldPosition(wp);
      const d = wp.distanceTo(hit.point);
      if (d > RUB_RADIUS) continue;
      s.userData.amount -= moved * 0.0045 * (1.2 - d / RUB_RADIUS);
      cleaned = true;
      // fast weg = ganz weg (kein mühsames Nachpolieren)
      if (s.userData.amount < 0.12) s.userData.amount = 0;
      const a = s.userData.amount;
      s.userData.mat.opacity = 0.3 + 0.7 * a;
      s.scale.setScalar(s.userData.base * (0.55 + 0.45 * a));
      if (a <= 0) {
        s.visible = false;
        services.sfx('pop');
      }
    }
    const now = performance.now();
    if (now - lastSound > 190) {
      lastSound = now;
      services.sfx(Math.random() < 0.6 ? 'squeak' : 'scrub');
    }
    if (cleaned) {
      updateTint();
      if (splats.length && splats.every((s) => s.userData.amount <= 0)) finish();
    }
  }

  // ---------- Fertig: spülen und glitzern ----------

  function finish() {
    busy = true;
    rub = null;
    const c = car();
    c.userData.data.dirt = 0;
    game.saveTrain();
    const box = new THREE.Box3().setFromObject(c);
    services.sfx('splash');
    setTimeout(() => services.sfx('splash'), 300);
    // Wasser von oben
    for (let k = 0; k < 45; k++) {
      const m = new THREE.Mesh(dropGeo, new THREE.MeshStandardMaterial({ color: '#7cc4f2', roughness: 0.1, transparent: true, opacity: 0.85 }));
      m.position.set(THREE.MathUtils.lerp(box.min.x, box.max.x, Math.random()), box.max.y + 0.5 + Math.random() * 2.5, box.max.z + 0.1 - Math.random() * 0.4);
      ws.scene.add(m);
      fx.push({ mesh: m, life: 1, kind: 'drop', v: new THREE.Vector3(0, -6 - Math.random() * 3, 0) });
    }
    // Schaum wird weggespült
    for (const f of fx) if (f.kind === 'foam') f.life = Math.min(f.life, 0.35);
    setTimeout(() => {
      if (!active) return;
      clearSplats();
      startDirt = 0;
      updateTint();
      // Glitzersterne
      const center = box.getCenter(new THREE.Vector3());
      for (let k = 0; k < 16; k++) {
        const m = new THREE.Mesh(starGeo, new THREE.MeshStandardMaterial({ color: '#ffe066', emissive: '#ffd23a', emissiveIntensity: 0.8 }));
        m.position.copy(center).add(new THREE.Vector3((Math.random() - 0.5) * 1.5, (Math.random() - 0.3) * 1.2, box.max.z - center.z));
        ws.scene.add(m);
        const a = Math.random() * Math.PI * 2;
        fx.push({ mesh: m, life: 1, kind: 'star', v: new THREE.Vector3(Math.cos(a) * 2.2, Math.sin(a) * 2.2 + 1, 0.5) });
      }
      services.sfx('sparkle');
      services.say(services.t('sparkling'));
      game.hop(c);
    }, 900);
    setTimeout(() => {
      busy = false;
      if (!active) return;
      const next = train.data.cars.findIndex((d, i) => i !== index && (d.dirt ?? 0) > 0.02);
      if (next >= 0) focus(next);
      else mudBtn.classList.add('pulse-soft');
    }, 2800);
  }

  // ---------- Modus ----------

  return {
    enter() {
      active = true;
      game.useScene('workshop');
      train.layoutStraight();
      controls.classList.remove('hidden');
      sponge.classList.remove('hidden', 'rubbing');
      game.setBottomInset(controls.offsetHeight + 24);
      const dirty = train.data.cars.findIndex((d) => (d.dirt ?? 0) > 0.02);
      focus(dirty >= 0 ? dirty : Math.min(1, train.cars.length - 1), true);
      setTimeout(() => {
        if (!active) return;
        services.say(services.t(splats.length ? 'washHint' : 'washClean'));
        hinted = true;
      }, 1300);
    },
    exit() {
      active = false;
      leaveCar();
      busy = false;
      rub = null;
      controls.classList.add('hidden');
      sponge.classList.add('hidden');
      game.saveTrain();
    },
    update(dt) {
      if (!active) return;
      // Alles sauber? Dann zeigt die Hand auf den Eimer (Matsch!)
      if (!splats.length && !busy && game.hint.due(5000)) game.hint.tapElement(mudBtn);
      // Schwamm zeigt, was zu tun ist: liegt er still, wackelt er über dem Wagen
      if (!rub) {
        spongeHome();
        sponge.classList.toggle('wiggle', splats.length > 0 && performance.now() - lastRub > 4000);
      }
      for (let i = fx.length - 1; i >= 0; i--) {
        const f = fx[i];
        if (f.kind === 'foam') {
          f.life -= dt / 6;
          const grow = Math.min(1, (1 - f.life) * 12);
          f.mesh.scale.setScalar(f.size * grow * (f.life < 0.2 ? f.life / 0.2 : 1) + 0.001);
        } else if (f.kind === 'drop') {
          f.life -= dt / 1.4;
          f.mesh.position.addScaledVector(f.v, dt);
          if (f.mesh.position.y < 0.05) f.life = 0;
        } else {
          f.life -= dt / 1.2;
          f.mesh.position.addScaledVector(f.v, dt);
          f.mesh.rotation.y += dt * 6;
          f.mesh.scale.setScalar(Math.sin(Math.min(1, f.life) * Math.PI) * 1.4 + 0.01);
        }
        if (f.life <= 0) {
          f.mesh.parent?.remove(f.mesh);
          f.mesh.material.dispose();
          fx.splice(i, 1);
        }
      }
    },
    pointerDown(e) {
      if (busy) return;
      rub = { x: e.clientX, y: e.clientY };
      sponge.classList.add('rubbing');
      sponge.classList.remove('wiggle');
      moveSponge(e.clientX, e.clientY);
      rubAt(e.clientX, e.clientY, 0);
    },
    pointerMove(e) {
      if (!rub || busy) return;
      moveSponge(e.clientX, e.clientY);
      const moved = Math.hypot(e.clientX - rub.x, e.clientY - rub.y);
      if (moved < 3) return;
      rub.x = e.clientX;
      rub.y = e.clientY;
      rubAt(e.clientX, e.clientY, Math.min(moved, 60));
    },
    pointerUp() {
      rub = null;
      sponge.classList.remove('rubbing');
      if (active) game.saveTrain();
    },
  };
}
