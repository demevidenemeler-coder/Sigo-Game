// Strecke bauen:
// - Nichts ausgewählt: ein Finger verschiebt die Ansicht, zwei Finger zoomen (Vogelperspektive).
// - ✏️ Stift auswählen und eine Linie malen → daraus werden Schienen (Kreis schließt sich von selbst).
//   Danach schaltet der Stift wieder ab, damit die Strecke nicht aus Versehen überschrieben wird.
// - Bahnhof, Tunnel, Brücke … aus der Leiste an die Strecke ziehen oder antippen.
// - Gesetzte Dinge entlang der Strecke verschieben; in die Leiste ziehen = wegnehmen.

import * as THREE from 'three';
import { ChalkLine, strokeToTrack } from '../track.js';
import { WORLD_BOUNDS } from '../world.js';
import { TRACK_OBJECTS } from '../../catalog.js';
import { renderThumbnails } from '../thumbs.js';
import { createTray } from '../tray.js';

const TAP_SOUND = { bahnhof: 'dingdong', tunnel: 'whistle', bruecke: 'clank', waschanlage: 'scrub', tankstelle: 'gurgle', uebergang: 'xbell' };
const VIEW_DIR = new THREE.Vector3(0, 1, 0.3); // fast senkrecht von oben
const MIN_HALF = 10;
const MAX_HALF = WORLD_BOUNDS.x + 8;

export function createDrawMode(game) {
  const { services, land, train } = game;
  const objects = land.objects;
  const chalk = new ChalkLine();
  land.scene.add(chalk.mesh);
  let drawing = false;
  let pencil = false;
  let lastScribble = 0;
  let active = false;
  let thumbs = null;
  let press = null; // ein gesetztes Objekt wird verschoben
  let pan = null; // Ansicht verschieben
  let pinch = null; // zoomen mit zwei Fingern
  const pointers = new Map();
  const view = { x: 0, z: 0, half: MAX_HALF };

  const hint = document.createElement('div');
  hint.className = 'draw-hint hidden';
  hint.innerHTML = '<span class="hand">👆</span>';
  game.ui.append(hint);

  // ---------- Leiste ----------
  const tray = createTray(game.ui, { extraClass: 'build-tray' });
  const overTray = (y) => !tray.hidden && y > tray.top() - 10;
  let pencilBtn = null;

  function setPencil(on) {
    pencil = on;
    pencilBtn?.classList.toggle('selected', on);
    if (on) {
      hint.classList.remove('hidden');
      setTimeout(() => hint.classList.add('hidden'), 3500);
    } else {
      hint.classList.add('hidden');
    }
  }

  function buildTray() {
    pencilBtn = document.createElement('button');
    pencilBtn.type = 'button';
    pencilBtn.className = 'tray-item build tool';
    pencilBtn.innerHTML = '<span class="tool-icon">✏️</span>';
    pencilBtn.addEventListener('click', () => {
      setPencil(!pencil);
      services.sfx('pop');
      if (pencil) services.say(services.t('tabPencil'));
    });
    tray.setItems([pencilBtn, ...TRACK_OBJECTS.map((o) => {
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
    })]);
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

  // ---------- Kamera: verschieben und zoomen ----------

  function applyView(instant) {
    view.half = THREE.MathUtils.clamp(view.half, MIN_HALF, MAX_HALF);
    const mx = WORLD_BOUNDS.x + 6;
    const mz = WORLD_BOUNDS.z + 6;
    view.x = THREE.MathUtils.clamp(view.x, -mx, mx);
    view.z = THREE.MathUtils.clamp(view.z, -mz, mz);
    game.fit(new THREE.Vector3(view.x, 0, view.z), view.half, view.half * 0.62, VIEW_DIR, instant);
    if (instant) game.applyCameraNow();
    // Kreidepunkte wachsen mit, damit die Linie auch weit weg gut sichtbar ist
    chalk.dotScale = Math.max(1, view.half / 22);
  }

  // Den Bodenpunkt unter dem Finger festhalten, während sich die Kamera bewegt
  function keepUnderFinger(anchor, x, y) {
    const p = game.groundPoint(x, y);
    if (!p) return;
    view.x += anchor.x - p.x;
    view.z += anchor.z - p.z;
    applyView(true);
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
    setPencil(false);
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

  function startPinch() {
    const [a, b] = [...pointers.values()];
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    pinch = { d0: Math.hypot(a.x - b.x, a.y - b.y), half0: view.half, anchor: game.groundPoint(mid.x, mid.y) };
    pan = null;
    if (drawing) {
      drawing = false;
      chalk.reset();
    }
    if (press) {
      press.item.obj.visible = true;
      press = null;
    }
  }

  return {
    multiTouch: true,
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
      tray.show();
      game.setBottomInset(tray.height());
      view.x = 0;
      view.z = 0;
      // Im Hochformat etwas näher starten (das breite Feld passt sonst nur winzig hinein)
      view.half = game.isPortrait() ? MAX_HALF * 0.6 : MAX_HALF;
      applyView(false);
      setPencil(false);
    },
    exit() {
      active = false;
      hint.classList.add('hidden');
      tray.hide();
      game.setBottomInset(0);
      pointers.clear();
      pan = null;
      pinch = null;
      if (drawing) finish();
    },
    onResize() {
      if (!active) return;
      game.setBottomInset(tray.height());
      applyView(true);
    },
    update(dt) {
      if (land.track.update(dt)) services.sfx('klack');
      train.animate(dt, 0, false);
    },
    wheel(e) {
      const anchor = game.groundPoint(e.clientX, e.clientY);
      view.half *= 1 + Math.sign(e.deltaY) * 0.12;
      applyView(true);
      if (anchor) keepUnderFinger(anchor, e.clientX, e.clientY);
    },
    pointerDown(e) {
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      hint.classList.add('hidden');
      if (pointers.size === 2) return startPinch();
      if (pointers.size > 2) return;
      const item = pickItem(e.clientX, e.clientY);
      if (item) {
        press = { item, x: e.clientX, y: e.clientY, moved: false };
        return;
      }
      const p = game.groundPoint(e.clientX, e.clientY);
      if (!p) return;
      if (pencil) {
        drawing = true;
        chalk.reset();
        clamp(p);
        chalk.add(p.x, p.z);
      } else {
        // Kamera erst „einrasten“ lassen, dann den Punkt unter dem Finger merken
        applyView(true);
        pan = { anchor: game.groundPoint(e.clientX, e.clientY) ?? p };
      }
    },
    pointerMove(e) {
      if (!pointers.has(e.pointerId)) return;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pinch && pointers.size >= 2) {
        const [a, b] = [...pointers.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        view.half = pinch.half0 * (pinch.d0 / Math.max(10, d));
        applyView(true);
        if (pinch.anchor) keepUnderFinger(pinch.anchor, (a.x + b.x) / 2, (a.y + b.y) / 2);
        return;
      }
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
      if (pan) {
        keepUnderFinger(pan.anchor, e.clientX, e.clientY);
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
      pointers.delete(e.pointerId);
      if (pinch) {
        if (pointers.size < 2) pinch = null;
        // verbleibender Finger verschiebt weiter
        if (pointers.size === 1) {
          const [p] = [...pointers.values()];
          const g = game.groundPoint(p.x, p.y);
          if (g) pan = { anchor: g };
        }
        return;
      }
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
      if (pan) {
        pan = null;
        return;
      }
      if (drawing) finish();
    },
  };
}
