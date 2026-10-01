// Strecke bauen:
// - Mit dem Finger eine Linie malen → daraus werden Schienen (Kreis schließt sich von selbst).
// - Aus der Leiste Bahnhof, Tunnel, Brücke … an die Strecke ziehen oder antippen (setzt sich an eine freie Stelle).
// - Gesetzte Dinge entlang der Strecke verschieben; in die Leiste ziehen = wegnehmen.

import * as THREE from 'three';
import { ChalkLine, strokeToTrack } from '../track.js';
import { WORLD_BOUNDS } from '../world.js';
import { TRACK_OBJECTS } from '../../catalog.js';
import { renderThumbnails } from '../thumbs.js';

const TAP_SOUND = { bahnhof: 'dingdong', tunnel: 'whistle', bruecke: 'clank', waschanlage: 'scrub', tankstelle: 'gurgle', uebergang: 'xbell' };

export function createDrawMode(game) {
  const { services, land, train } = game;
  const objects = land.objects;
  const chalk = new ChalkLine();
  land.scene.add(chalk.mesh);
  let drawing = false;
  let lastScribble = 0;
  let hintShown = false;
  let active = false;
  let thumbs = null;
  let press = null;

  const hint = document.createElement('div');
  hint.className = 'draw-hint hidden';
  hint.innerHTML = '<span class="hand">👆</span>';
  game.ui.append(hint);

  // ---------- Leiste ----------
  const tray = document.createElement('div');
  tray.className = 'tray build-tray hidden';
  const items = document.createElement('div');
  items.className = 'tray-items';
  tray.append(items);
  game.ui.append(tray);

  const overTray = (y) => !tray.classList.contains('hidden') && y > tray.getBoundingClientRect().top - 10;

  function buildTray() {
    items.replaceChildren(...TRACK_OBJECTS.map((o) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'tray-item build';
      const img = document.createElement('img');
      img.src = thumbs[`build:${o.id}`];
      img.alt = '';
      img.draggable = false;
      b.append(img);
      bindTrayItem(b, o.id);
      return b;
    }));
  }

  function makeGhost(src) {
    const g = document.createElement('div');
    g.className = 'ghost';
    g.innerHTML = `<img src="${src}" alt="">`;
    document.body.append(g);
    return g;
  }

  function bindTrayItem(button, type) {
    button.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      button.setPointerCapture(e.pointerId);
      const sx = e.clientX;
      const sy = e.clientY;
      let ghost = null;
      const move = (ev) => {
        if (!ghost && Math.hypot(ev.clientX - sx, ev.clientY - sy) > 10) ghost = makeGhost(thumbs[`build:${type}`]);
        if (!ghost) return;
        ghost.style.left = `${ev.clientX}px`;
        ghost.style.top = `${ev.clientY}px`;
        ghost.classList.toggle('removing', overTray(ev.clientY));
      };
      const up = (ev) => {
        button.removeEventListener('pointermove', move);
        button.removeEventListener('pointerup', up);
        button.removeEventListener('pointercancel', up);
        if (ghost) {
          ghost.remove();
          if (ev.type !== 'pointerup' || overTray(ev.clientY)) return;
          const p = game.groundPoint(ev.clientX, ev.clientY);
          if (p) place(type, p.x, p.z);
        } else if (ev.type === 'pointerup') {
          const spot = objects.bestSpot(type);
          if (spot) place(type, spot.x, spot.z);
          else full();
        }
      };
      button.addEventListener('pointermove', move);
      button.addEventListener('pointerup', up);
      button.addEventListener('pointercancel', up);
    });
  }

  function full() {
    services.sfx('boing');
    services.say(services.t('full'));
  }

  function place(type, x, z) {
    const item = objects.add(type, x, z);
    if (!item) return full();
    game.popIn(item.obj);
    land.clearAroundTrack();
    game.saveTrack();
    services.sfx('klack');
    services.sayName(type);
    return item;
  }

  // ---------- Kamera ----------

  // Im Hochformat schaut die Kamera von der Seite, damit die breite Malfläche den Bildschirm füllt
  function camera(instant) {
    const bx = WORLD_BOUNDS.x + 4;
    const bz = WORLD_BOUNDS.z * 0.93 + 4;
    if (game.isPortrait()) game.fit(new THREE.Vector3(0.5, 0, 0), bz, bx * 0.93, new THREE.Vector3(0.42, 1, 0), instant);
    else game.fit(new THREE.Vector3(0, 0, 0.5), bx, bz, new THREE.Vector3(0, 1, 0.42), instant);
  }

  function clamp(p) {
    p.x = THREE.MathUtils.clamp(p.x, -WORLD_BOUNDS.x - 1, WORLD_BOUNDS.x + 1);
    p.z = THREE.MathUtils.clamp(p.z, -WORLD_BOUNDS.z - 1, WORLD_BOUNDS.z + 1);
    return p;
  }

  // ---------- Malen ----------

  function finish() {
    drawing = false;
    const pts = strokeToTrack(chalk.points, { minLength: Math.max(30, train.length + 14), bounds: WORLD_BOUNDS });
    const fade = () => game.tween(0.6, (t) => { chalk.mesh.material.opacity = 0.9 * (1 - t); }, () => {
      chalk.reset();
      chalk.mesh.material.opacity = 0.9;
    });
    if (!pts) {
      fade();
      return;
    }
    land.track.setPoints(pts, true);
    objects.resnap();
    land.clearAroundTrack();
    game.saveTrack();
    game.drive.s = train.length + 1;
    game.drive.speed = 0;
    train.placeOnCurve(land.track.curve, land.track.length, game.drive.s);
    fade();
    services.sfx('chime');
    services.say(services.t('trackDone'));
    game.pulseMode('drive');
  }

  function pickItem(x, y) {
    const hits = game.pick(x, y, [objects.group]);
    for (const h of hits) {
      let o = h.object;
      while (o && !o.userData.item?.type) o = o.parent;
      if (o) return o.userData.item;
    }
    return null;
  }

  return {
    enter() {
      active = true;
      if (!thumbs) {
        thumbs = renderThumbnails(TRACK_OBJECTS.map((o) => ({ kind: 'build', id: o.id })));
        buildTray();
      }
      game.useScene('land');
      game.drive.target = 0;
      game.drive.speed = 0;
      train.placeOnCurve(land.track.curve, land.track.length, game.drive.s);
      tray.classList.remove('hidden');
      game.setBottomInset(tray.getBoundingClientRect().height);
      camera(false);
      if (!hintShown) {
        hintShown = true;
        hint.classList.remove('hidden');
        setTimeout(() => hint.classList.add('hidden'), 4200);
      }
    },
    exit() {
      active = false;
      hint.classList.add('hidden');
      tray.classList.add('hidden');
      game.setBottomInset(0);
      if (drawing) finish();
    },
    onResize() {
      if (!active) return;
      game.setBottomInset(tray.getBoundingClientRect().height);
      camera(true);
    },
    update(dt) {
      if (land.track.update(dt)) services.sfx('klack');
      train.animate(dt, 0, false);
    },
    pointerDown(e) {
      hint.classList.add('hidden');
      const item = pickItem(e.clientX, e.clientY);
      if (item) {
        press = { item, x: e.clientX, y: e.clientY, moved: false };
        return;
      }
      const p = game.groundPoint(e.clientX, e.clientY);
      if (!p) return;
      drawing = true;
      chalk.reset();
      clamp(p);
      chalk.add(p.x, p.z);
    },
    pointerMove(e) {
      if (press) {
        if (!press.moved && Math.hypot(e.clientX - press.x, e.clientY - press.y) < 15) return;
        press.moved = true;
        const removing = overTray(e.clientY);
        press.item.obj.visible = !removing;
        if (!removing) {
          const p = game.groundPoint(e.clientX, e.clientY);
          if (p) objects.moveTo(press.item, p.x, p.z);
        }
        return;
      }
      if (!drawing) return;
      const p = game.groundPoint(e.clientX, e.clientY);
      if (!p) return;
      clamp(p);
      if (chalk.add(p.x, p.z) && performance.now() - lastScribble > 90) {
        lastScribble = performance.now();
        services.sfx('scribble');
      }
    },
    pointerUp(e, cancelled) {
      if (press) {
        const { item, moved } = press;
        press = null;
        if (!moved && !cancelled) {
          game.hop(item.obj);
          services.sfx(TAP_SOUND[item.type]);
          services.sayName(item.type);
          return;
        }
        if (!cancelled && overTray(e.clientY)) {
          objects.remove(item);
          services.sfx('poof');
        } else {
          item.obj.visible = true;
          services.sfx('klack');
        }
        land.clearAroundTrack();
        game.saveTrack();
        return;
      }
      if (drawing) finish();
    },
  };
}
