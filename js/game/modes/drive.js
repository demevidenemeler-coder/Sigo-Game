// Fahren: Der eigene Zug fährt auf der selbst gebauten Strecke.
//
// Mechaniken:
// - Bahnhof: Zug hält, Wartende antippen → steigen ein; Mitfahrer antippen → steigen aus. ▶ = weiterfahren.
// - Waschanlage: Der Zug wird beim Fahren schmutzig (bei Regen schneller) und hier wieder sauber.
// - Tunnel: dunkel, Lampen an, Pfeife hallt. Brücke: Schienenstöße klingen hohl.
// - Bahnübergang: Schranke zu, Blinklicht, Glocke, Autos warten.
// - Knöpfe: Los/Halt, Pfeife, Kamera, Tag/Nacht, Wetter.

import * as THREE from 'three';
import { chuff, railJoint, RollingSound, NoiseLoop, setEcho, xyloNote } from '../../audio.js';
import { wave, applyDirt, slotWorldPosition } from '../trainModel.js';
import { partDef, pushCargo, spliceCargo } from '../../catalog.js';
import { addWaiting } from '../trackObjects.js';
import { buildFigure } from '../figures.js';

const JOINT = 5; // Abstand der Schienenstöße
const CHUFF = (2 * Math.PI * 0.36) / 4; // vier Dampfstöße pro Umdrehung des Treibrads
const ACCENT = [1, 0.55, 0.8, 0.55];
const BRAKE = 1.6; // Bremsverzögerung beim Halten
// Die Knöpfe zeigen immer den AKTUELLEN Zustand (nicht den nächsten)
const WEATHERS = [['sonne', '🌤️'], ['regen', '🌧️'], ['schnee', '❄️']];
const WAITING_IDS = ['kind', 'oma', 'papa', 'hund', 'katze', 'teddy', 'hase', 'pinguin', 'schaf', 'ente', 'pferd', 'huhn', 'kuh', 'frosch'];

class Puffs {
  constructor(scene) {
    this.puffs = [];
    const geo = new THREE.IcosahedronGeometry(0.3, 1);
    for (let i = 0; i < 36; i++) {
      const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: '#ffffff', transparent: true, opacity: 0, roughness: 1, depthWrite: false }));
      m.visible = false;
      m.userData.life = 0;
      scene.add(m);
      this.puffs.push(m);
    }
    this.next = 0;
  }

  emit(pos, strength = 1, color = '#ffffff') {
    const p = this.puffs[this.next++ % this.puffs.length];
    p.position.copy(pos);
    p.material.color.set(color);
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
  const { services, land, train, env } = game;
  const objects = land.objects;
  const track = land.track;
  const d = game.drive;
  const puffs = new Puffs(land.scene);
  const rolling = new RollingSound();
  const washLoop = new NoiseLoop('bandpass', 1300, 0.6);
  let follow = false;
  let chuffAcc = 0;
  let chuffBeat = 0;
  let exhaustAcc = 0;
  let wasMoving = false;
  let down = null;
  let braking = null;
  let stoppedAt = null;
  let washedSome = false;
  let saveTimer = 0;
  let weather = 0;
  let timeOfDay = 0;
  const crossingBell = new Map();
  const tmp = new THREE.Vector3();
  const fwd = new THREE.Vector3();
  const side = new THREE.Vector3();

  const locoDef = () => partDef(train.data.cars[0].type);
  const signed = (a, b) => {
    const L = track.length;
    return ((((a - b) % L) + L * 1.5) % L) - L / 2;
  };

  // ---------- Knöpfe ----------
  const controls = document.createElement('div');
  controls.className = 'drive-controls hidden';
  const envControls = document.createElement('div');
  envControls.className = 'env-controls hidden';

  const btn = (parent, cls, icon, onTap) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = `drive-btn ${cls}`;
    b.textContent = icon;
    b.addEventListener('click', onTap);
    parent.append(b);
    return b;
  };
  const camBtn = btn(controls, 'cam', '🎥', () => {
    follow = !follow;
    camBtn.classList.toggle('active', follow);
    services.sfx('pop');
  });
  btn(controls, 'horn', '📯', horn);
  const goBtn = btn(controls, 'go', '▶', () => {
    if (d.target > 0) {
      d.target = 0;
    } else {
      d.target = 1;
      if (stoppedAt) depart();
      horn();
      services.sfx('bell');
    }
    updateGo();
  });
  // Tageszeit: 🌞 Tag → 🌇 Abend → 🌙 Nacht → wieder Tag (weicher Übergang im Himmel)
  const TIMES = [['tag', '🌞'], ['abend', '🌇'], ['nacht', '🌙']];
  const nightBtn = btn(envControls, 'env', '🌞', () => {
    timeOfDay = (timeOfDay + 1) % TIMES.length;
    env.setTime(TIMES[timeOfDay][0]);
    nightBtn.textContent = TIMES[timeOfDay][1];
    services.sayName(TIMES[timeOfDay][0]);
  });
  const weatherBtn = btn(envControls, 'env', WEATHERS[0][1], () => {
    weather = (weather + 1) % WEATHERS.length;
    env.setWeather(WEATHERS[weather][0]);
    weatherBtn.textContent = WEATHERS[weather][1];
    services.sayName(WEATHERS[weather][0]);
  });
  game.ui.append(controls, envControls);

  function updateGo() {
    goBtn.textContent = d.target > 0 ? '⏸' : '▶';
    goBtn.classList.toggle('stop', d.target > 0);
    goBtn.classList.toggle('waiting', !!stoppedAt && d.target === 0);
  }

  function horn() {
    game.hop(train.loco);
    wave(train.loco.userData.driver, game);
    services.sfx(locoDef().horn);
  }

  // ---------- Kamera ----------

  function overviewCamera() {
    const pts = track.points;
    const xs = pts.map((p) => p[0]);
    const zs = pts.map((p) => p[1]);
    const cx = (Math.max(...xs) + Math.min(...xs)) / 2;
    const cz = (Math.max(...zs) + Math.min(...zs)) / 2;
    const hw = (Math.max(...xs) - Math.min(...xs)) / 2 + 5;
    const hh = (Math.max(...zs) - Math.min(...zs)) / 2 + 5;
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
    // Am Bahnhof schwenkt die Kamera auf die andere Seite: Zug vorne, Bahnsteig dahinter
    const dist = stoppedAt?.type === 'bahnhof' ? (stoppedAt.flipped ? 11 : -11) : 9;
    game.cam.tPos.copy(tmp).addScaledVector(fwd, 3).addScaledVector(side, dist).add(new THREE.Vector3(0, stoppedAt ? 6 : 4.5, 0));
    game.cam.tLook.copy(tmp).addScaledVector(fwd, -2).add(new THREE.Vector3(0, 1, 0));
  }

  // ---------- Zug-Geometrie entlang der Strecke ----------

  function carOffsets() {
    const out = [];
    let f = 0;
    for (const c of train.cars) {
      const len = c.userData.length;
      out.push({ car: c, center: f + len / 2, axles: [f + 0.3, f + 0.9, f + len - 0.9, f + len - 0.3] });
      f += len + 0.3;
    }
    return out;
  }

  // ---------- Halten ----------

  function stopPointFor(item) {
    if (item.type === 'bahnhof') return item.s + 3;
    return null;
  }

  function wantsStop(item) {
    if (item.type === 'bahnhof') return true;
    return false;
  }

  function arrive(item) {
    braking = null;
    stoppedAt = item;
    d.speed = 0;
    d.target = 0;
    updateGo();
    if (item.type === 'bahnhof') {
      services.sfx('dingdong');
      // Wer zu diesem Bahnhof (dieser Farbe) wollte, steigt von selbst aus
      if (hasArrivals(item)) setTimeout(() => deliverNext(item, 0), 700);
      else setTimeout(() => services.say(services.t('station')), 600);
    }
  }

  function depart() {
    if (stoppedAt?.type === 'bahnhof') stoppedAt.refillIn = 6;
    d.s += 0.05;
    stoppedAt = null;
  }

  // ---------- Ein- und Aussteigen ----------

  function fly(obj, fromWorld, toWorld, dur, done) {
    land.scene.attach(obj);
    obj.position.copy(fromWorld);
    game.tween(dur, (t) => {
      obj.position.lerpVectors(fromWorld, toWorld, t);
      obj.position.y += Math.sin(t * Math.PI) * 1.6;
      obj.rotation.y += 0.15;
    }, done);
  }

  function board(fig, item) {
    const id = fig.userData.figure;
    if (stoppedAt !== item) {
      game.hop(fig);
      services.sayName(id);
      return;
    }
    // freien Platz suchen, am liebsten im nächsten Wagen
    const idx = train.data.cars.findIndex((c, i) => i > 0 && c.cargo.length < (partDef(c.type).slots ?? 0));
    if (idx < 0) {
      game.hop(fig);
      services.sfx('boing');
      services.say(services.t('full'));
      return;
    }
    item.waiting = item.waiting.filter((w) => w !== fig);
    const car = train.cars[idx];
    const from = fig.getWorldPosition(new THREE.Vector3());
    const to = slotWorldPosition(car, train.data.cars[idx].cargo.length);
    pushCargo(train.data.cars[idx], id, fig.userData.dest ?? null);
    services.sfx('whoosh');
    fly(fig, from, to, 0.75, () => {
      land.scene.remove(fig);
      const c = train.rebuildCar(idx);
      game.popIn(c.userData.cargoItems[c.userData.cargoItems.length - 1]);
      train.placeOnCurve(track.curve, track.length, d.s);
      services.sfx('pop');
      services.sayName(id);
      game.saveTrain();
    });
  }

  function hasArrivals(item) {
    return train.data.cars.some((c, i) => i > 0 && (c.dest ?? []).includes(item.color));
  }

  // Ein Fahrgast ist am Ziel: hüpft aus dem Zug zur Bahnhofstür und geht hinein
  function deliver(carIndex, slot, item) {
    const car = train.cars[carIndex];
    const old = car.userData.cargoItems[slot];
    const from = old ? old.getWorldPosition(new THREE.Vector3()) : slotWorldPosition(car, slot);
    const { id } = spliceCargo(train.data.cars[carIndex], slot);
    train.rebuildCar(carIndex);
    train.placeOnCurve(track.curve, track.length, d.s);
    const fig = buildFigure(id);
    fig.scale.setScalar(1.2);
    land.scene.add(fig);
    const door = item.obj.localToWorld(new THREE.Vector3(0, 0.45, 2.75));
    services.sfx('whoosh');
    fly(fig, from, door, 0.8, () => {
      services.sfx('pop');
      services.animalCall?.(id);
      game.tween(0.5, (t) => fig.scale.setScalar(1.2 * (1 - t)), () => land.scene.remove(fig));
    });
    game.saveTrain();
  }

  function deliverNext(item, count) {
    if (stoppedAt !== item) return;
    const ci = train.data.cars.findIndex((c, i) => i > 0 && (c.dest ?? []).includes(item.color));
    if (ci < 0) {
      if (count) {
        services.sfx('chime');
        services.say(`${services.t('thanks')} ${services.t('station')}`);
      }
      return;
    }
    deliver(ci, train.data.cars[ci].dest.indexOf(item.color), item);
    setTimeout(() => deliverNext(item, count + 1), 650);
  }

  function alight(carIndex, removable, obj) {
    const item = stoppedAt;
    const id = removable.id;
    const dest = train.data.cars[carIndex].dest?.[removable.index] ?? null;
    if (dest === item.color) return deliver(carIndex, removable.index, item);
    const fig = addWaiting(item, id, dest ?? undefined);
    if (!fig) {
      services.sfx('boing');
      return;
    }
    const from = obj.getWorldPosition(new THREE.Vector3());
    const target = fig.getWorldPosition(new THREE.Vector3());
    spliceCargo(train.data.cars[carIndex], removable.index);
    train.rebuildCar(carIndex);
    train.placeOnCurve(track.curve, track.length, d.s);
    const local = fig.position.clone();
    services.sfx('whoosh');
    fly(fig, from, target, 0.75, () => {
      item.obj.attach(fig);
      fig.position.copy(local);
      services.sfx('pop');
      services.sayName(id);
    });
    item.waiting = item.waiting.filter((w) => w !== fig);
    item.waiting.push(fig);
    game.saveTrain();
  }

  function screenDist(o, x, y) {
    const v = o.getWorldPosition(new THREE.Vector3());
    v.y += 0.6;
    v.project(game.camera);
    return Math.hypot(((v.x + 1) / 2) * window.innerWidth - x, ((1 - v.y) / 2) * window.innerHeight - y);
  }

  function nearestOnScreen(list, x, y) {
    let best = list[0];
    let bestD = Infinity;
    for (const o of list) {
      const v = o.getWorldPosition(new THREE.Vector3());
      v.y += 0.6;
      v.project(game.camera);
      const dd = Math.hypot(((v.x + 1) / 2) * window.innerWidth - x, ((1 - v.y) / 2) * window.innerHeight - y);
      if (dd < bestD) {
        bestD = dd;
        best = o;
      }
    }
    return best;
  }

  // ---------- Zeige-Hand ----------
  // Steht der Zug: auf ▶ zeigen. Am Bahnhof: erst auf einen Wartenden (einsteigen), dann auf ▶.
  // Beim Fahren nach einer Weile: Wetter, Tag/Nacht oder Pfeife zeigen.
  let hintStep = 0;
  function showHint() {
    const step = hintStep++;
    if (stoppedAt?.type === 'bahnhof' && stoppedAt.waiting.length && step % 2 === 0) {
      const v = stoppedAt.waiting[0].getWorldPosition(new THREE.Vector3());
      v.y += 0.6;
      v.project(game.camera);
      const x = ((v.x + 1) / 2) * window.innerWidth;
      const y = ((1 - v.y) / 2) * window.innerHeight;
      if (x > 0 && x < window.innerWidth && y > 0 && y < window.innerHeight) return game.hint.tap(x, y);
    }
    if (d.target === 0) return game.hint.tapElement(goBtn);
    game.hint.tapElement([weatherBtn, nightBtn, controls.querySelector('.horn')][step % 3]);
  }

  // ---------- Pro Bild ----------

  let lastSplash = 0;
  function updateObjects(dt, offsets, moving) {
    const head = d.s;
    // Tunnel: Lok drin?
    const cross = land.crossings;
    const inTunnel = cross.tunnels.some((tn) => objects.ahead(tn.s0, head - 1.5) < tn.s1 - tn.s0);
    env.setTunnel(inTunnel);
    setEcho(inTunnel);

    // Pfützen auf der Strecke: Jeder Wagen spritzt beim Durchfahren – und wird ein bisschen schmutzig
    if (moving) {
      for (const p of game.weatherFx.trackPuddles()) {
        for (const o of offsets) {
          const before = signed(head - o.center - d.lastDs, p.s);
          const now = signed(head - o.center, p.s);
          if (before < 0 && now >= 0) {
            game.weatherFx.splash(p.mesh.position, 0.6 + Math.min(1, d.speed / 4));
            if (performance.now() - lastSplash > 140) {
              lastSplash = performance.now();
              services.sfx('splash');
            }
            const data = o.car.userData.data;
            data.dirt = Math.min(1, (data.dirt ?? 0) + 0.08);
            applyDirt(o.car);
          }
        }
      }
    }

    // Musik-Brücke: Die Lok spielt jeden Xylophon-Stab, über den sie fährt
    for (const br of cross.bridges) {
      const rel = objects.ahead(br.s0, head - 0.3);
      const idx = moving && rel < br.s1 - br.s0 ? Math.floor(rel / br.barLen) : -1;
      if (idx !== br.last && idx >= 0 && idx < br.bars.length) {
        const bar = br.bars[idx];
        cross.flashBar(bar);
        xyloNote(bar.note, 0.28);
      }
      br.last = idx;
    }

    // Bahnübergang: Schranke zu, wenn der Zug kommt oder drüberfährt – die Autos warten
    for (const it of cross.crossings) {
      const aheadDist = objects.ahead(head, it.s0);
      const covered = objects.ahead(it.s0, head) < it.s1 - it.s0 + train.length + 2;
      it.closed = (d.speed > 0.05 && aheadDist < 16) || covered;
      if (it.closed) {
        const t = (crossingBell.get(it) ?? 0) - dt;
        crossingBell.set(it, t <= 0 ? 0.55 : t);
        if (t <= 0 && services.soundsOn()) services.sfx('xbell');
      }
    }

    // Waschanlage
    let washing = false;
    for (const it of objects.items) {
      if (it.type !== 'waschanlage') continue;
      it.washing = offsets.some((o) => Math.abs(signed(head - o.center, it.s)) < 2.5);
      washing ||= it.washing;
      for (const o of offsets) {
        const before = signed(head - o.center - d.lastDs, it.s);
        const now = signed(head - o.center, it.s);
        if (before < 0 && now >= 0 && (o.car.userData.data.dirt ?? 0) > 0.05) {
          o.car.userData.data.dirt = 0;
          applyDirt(o.car);
          services.sfx('sparkle');
          washedSome = true;
        }
      }
    }
    washLoop.set(washing && services.soundsOn() ? 0.22 : 0);
    if (!washing && washedSome && train.data.cars.every((c) => (c.dirt ?? 0) < 0.05)) {
      washedSome = false;
      services.say(services.t('sparkling'));
    }

    // Bahnhof: neue Wartende kommen nach einer Weile
    for (const it of objects.items) {
      if (it.type !== 'bahnhof' || it.refillIn == null) continue;
      it.refillIn -= dt;
      if (it.refillIn <= 0) {
        it.refillIn = it.waiting.length < 2 ? 8 : null;
        if (it.waiting.length < 3) {
          const f = addWaiting(it, WAITING_IDS[Math.floor(Math.random() * WAITING_IDS.length)]);
          if (f) game.popIn(f);
        }
      }
    }
    return { inTunnel, moving };
  }

  function speedCap() {
    let cap = locoDef().speed;
    for (const it of objects.items) {
      if (it.type !== 'waschanlage') continue;
      const rel = signed(d.s, it.s);
      if (rel > -4 && rel < train.length + 3) cap = Math.min(cap, 1.3);
    }
    return cap;
  }

  function railSounds(sBefore, sAfter, offsets) {
    let hits = 0;
    const bridges = land.crossings.bridges;
    for (const o of offsets) {
      for (const off of o.axles) {
        const a = Math.floor((sBefore - off) / JOINT);
        const b = Math.floor((sAfter - off) / JOINT);
        if (a !== b && hits < 3) {
          const axleS = sAfter - off;
          const hollow = bridges.some((br) => objects.ahead(br.s0, axleS) < br.s1 - br.s0);
          railJoint(0.5 + Math.min(1, d.speed / 5) * 0.5, hollow);
          hits++;
        }
      }
    }
  }

  return {
    enter() {
      game.useScene('land');
      controls.classList.remove('hidden');
      envControls.classList.remove('hidden');
      train.placeOnCurve(track.curve, track.length, d.s);
      const t = train.data.cars[0].type;
      rolling.start(t === 'dampf' ? 'steam' : t === 'diesel' ? 'diesel' : 'electric');
      stoppedAt = null;
      braking = null;
      updateGo();
      if (follow) followCamera();
      else overviewCamera();
    },
    exit() {
      controls.classList.add('hidden');
      envControls.classList.add('hidden');
      d.target = 0;
      d.speed = 0;
      wasMoving = false;
      stoppedAt = null;
      braking = null;
      rolling.stop();
      washLoop.set(0);
      env.setTunnel(false);
      setEcho(false);
      for (const it of objects.items) {
        it.closed = 0;
        it.washing = false;
      }
      updateGo();
      game.saveTrain();
    },
    onResize() {
      if (!follow) overviewCamera();
    },
    update(dt) {
      track.update(dt); // falls die Schienen noch „wachsen“
      if (game.hint.due(d.target === 0 ? 6000 : 18000)) showHint();
      const cap = speedCap();
      const want = d.target > 0 && !stoppedAt ? cap : 0;

      if (braking) {
        const dist = objects.ahead(d.s, braking.sp);
        if (dist > track.length / 2) {
          braking = null; // schon vorbei
        } else {
          const vmax = Math.sqrt(2 * BRAKE * dist);
          d.speed = Math.min(d.speed + 1.6 * dt, vmax, cap);
          if (dist < 0.04 || (d.speed < 0.05 && dist < 0.6)) arrive(braking.item);
        }
      } else {
        const acc = want > d.speed ? 1.6 : 2.4;
        d.speed += Math.sign(want - d.speed) * Math.min(Math.abs(want - d.speed), acc * dt);
        if (d.target > 0 && d.speed > 0.2) {
          for (const it of objects.items) {
            const sp = stopPointFor(it);
            if (sp == null || !wantsStop(it)) continue;
            const dist = objects.ahead(d.s, sp);
            if (dist < (d.speed * d.speed) / (2 * BRAKE) + 0.4 && dist < track.length / 2) {
              braking = { item: it, sp };
              break;
            }
          }
        }
      }

      const ds = d.speed * dt;
      d.lastDs = ds;
      const before = d.s;
      d.s += ds;
      train.placeOnCurve(track.curve, track.length, d.s);
      const moving = d.speed > 0.05;
      const speed01 = Math.min(1, d.speed / 5);
      train.animate(dt, ds, moving);
      const offsets = carOffsets();
      updateObjects(dt, offsets, moving);

      // Geräusche
      rolling.set(services.soundsOn() ? speed01 : 0);
      if (services.soundsOn() && moving) railSounds(before, d.s, offsets);
      const loco = train.loco;
      const type = train.data.cars[0].type;
      if (moving && type === 'dampf') {
        chuffAcc += ds;
        if (chuffAcc >= CHUFF) {
          chuffAcc -= CHUFF;
          const accent = ACCENT[chuffBeat++ % 4];
          if (services.soundsOn()) chuff(accent, speed01);
          if (accent > 0.7) puffs.emit(loco.localToWorld(loco.userData.steamPoint.clone()), 0.8 + (1 - speed01) * 0.4);
        }
      }
      if (moving && type === 'diesel') {
        exhaustAcc += ds;
        if (exhaustAcc > 1.2) {
          exhaustAcc = 0;
          puffs.emit(loco.localToWorld(loco.userData.exhaustPoint.clone()), 0.45, '#8a8f96');
        }
      }
      if (wasMoving && !moving && type === 'dampf') {
        services.sfx('hiss');
        for (let i = 0; i < 4; i++) puffs.emit(loco.localToWorld(new THREE.Vector3(1.2 - i * 0.3, 0.5, 0.7)), 0.7);
      }
      wasMoving = moving;
      puffs.update(dt);

      // Schmutz
      if (moving) {
        const dirtRate = (env.weather === 'regen' ? 2.2 : env.weather === 'schnee' ? 1.5 : 1) / 450;
        for (const c of train.cars) {
          const data = c.userData.data;
          const old = Math.floor((data.dirt ?? 0) * 8);
          data.dirt = Math.min(1, (data.dirt ?? 0) + ds * dirtRate);
          if (Math.floor(data.dirt * 8) !== old) applyDirt(c);
        }
        saveTimer += dt;
        if (saveTimer > 6) {
          saveTimer = 0;
          game.saveTrain();
        }
      }

      if (follow) followCamera();
      else overviewCamera();
    },
    pointerDown(e) {
      down = { x: e.clientX, y: e.clientY };
    },
    pointerUp(e, cancelled) {
      if (cancelled || !down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 18) return;
      down = null;
      const targets = [objects.group, land.crossings.group, ...train.cars, ...land.tappable.filter((o) => o.visible)];
      const hit = game.pick(e.clientX, e.clientY, targets)[0];
      const hitOwner = hit?.object.userData.owner;
      // Mitfahrer im Zug antippen hat Vorrang (Aussteigen am Bahnhof)
      const hitCargo = hitOwner?.userData.removable?.list === 'cargo' && train.carIndexOf(hit.object) >= 0;
      // Am Bahnhof: Tipp auf einen Wagen mit Fahrgästen (z. B. aufs Dach) = einer steigt aus
      const hitIndex = hit ? train.carIndexOf(hit.object) : -1;
      if (stoppedAt?.type === 'bahnhof' && !hitCargo && hitIndex > 0) {
        const car = train.cars[hitIndex];
        const n = car.userData.cargoItems.length;
        if (n) {
          const fig = car.userData.cargoItems[n - 1];
          return alight(hitIndex, fig.userData.removable, fig);
        }
      }
      // Steht der Zug am Bahnhof: Tipp in der Nähe einer wartenden Figur zählt (für kleine Finger)
      if (stoppedAt?.type === 'bahnhof' && !hitCargo && stoppedAt.waiting.length) {
        const near = nearestOnScreen(stoppedAt.waiting, e.clientX, e.clientY);
        if (near && screenDist(near, e.clientX, e.clientY) < 130) return board(near, stoppedAt);
      }
      if (!hit) {
        if (game.pickCar(e.clientX, e.clientY)) horn();
        return;
      }
      const obj = hit.object;
      const owner = obj.userData.owner;
      // 0) Musik-Brücke: Stab antippen spielt seinen Ton
      const bar = land.crossings.barNear(obj, hit.point);
      if (bar) {
        land.crossings.flashBar(bar);
        xyloNote(bar.note);
        return;
      }
      // Andere Bauwerke (Tunnelportal, Bahnübergang): kleines Geräusch, sonst nichts
      let anc = obj;
      while (anc && anc !== land.crossings.group) anc = anc.parent;
      if (anc) {
        services.sfx('pling');
        return;
      }
      // 1) Dinge an der Strecke
      const item = obj.userData.trackItem ?? owner?.userData.item;
      if (item) {
        const action = owner?.userData.action;
        if (action === 'board') return board(owner, owner.userData.item);
        if (action === 'hupen') {
          game.hop(owner);
          return services.sfx('carhonk');
        }
        // Großzügig für kleine Finger: Tipp irgendwo auf den Bahnhof → nächste wartende Figur steigt ein
        if (item.type === 'bahnhof' && stoppedAt === item && item.waiting.length) {
          const fig = nearestOnScreen(item.waiting, e.clientX, e.clientY);
          return board(fig, item);
        }
        game.hop(item.obj);
        services.sayName(item.type);
        return;
      }
      // 2) Der Zug
      const carIndex = train.carIndexOf(obj);
      if (carIndex >= 0) {
        const removable = owner?.userData.removable;
        if (removable?.list === 'cargo') {
          if (stoppedAt?.type === 'bahnhof') return alight(carIndex, removable, owner);
          game.hop(owner);
          return services.sayName(removable.id);
        }
        return horn();
      }
      // 3) Landschaft: Tiere rufen, Bäume wackeln
      let o = obj;
      while (o.parent && !land.tappable.includes(o)) o = o.parent;
      if (o.userData.kind === 'snowman') return game.weatherFx.tapSnowman(o);
      if (o.userData.kind === 'puddle') return game.weatherFx.tapPuddle(o);
      if (!land.tappable.includes(o)) return;
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
