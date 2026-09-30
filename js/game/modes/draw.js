// Strecke malen: Mit dem Finger eine Linie ziehen – daraus werden Schienen.
// Der Kreis schließt sich von selbst; zu kleine Strecken werden automatisch vergrößert.

import * as THREE from 'three';
import { ChalkLine, strokeToTrack } from '../track.js';
import { WORLD_BOUNDS } from '../world.js';

export function createDrawMode(game) {
  const { services, land, train } = game;
  const chalk = new ChalkLine();
  land.scene.add(chalk.mesh);
  let drawing = false;
  let lastScribble = 0;
  let hintShown = false;

  const hint = document.createElement('div');
  hint.className = 'draw-hint hidden';
  hint.innerHTML = '<span class="hand">👆</span>';
  game.ui.append(hint);

  // Im Hochformat schaut die Kamera von der Seite, damit die breite Malfläche den Bildschirm füllt
  function camera(instant) {
    const bx = WORLD_BOUNDS.x + 1.5;
    const bz = WORLD_BOUNDS.z * 0.93 + 1.5;
    if (game.isPortrait()) game.fit(new THREE.Vector3(0.5, 0, 0), bz, bx * 0.93, new THREE.Vector3(0.42, 1, 0), instant);
    else game.fit(new THREE.Vector3(0, 0, 0.5), bx, bz, new THREE.Vector3(0, 1, 0.42), instant);
  }

  function clamp(p) {
    p.x = THREE.MathUtils.clamp(p.x, -WORLD_BOUNDS.x - 1, WORLD_BOUNDS.x + 1);
    p.z = THREE.MathUtils.clamp(p.z, -WORLD_BOUNDS.z - 1, WORLD_BOUNDS.z + 1);
    return p;
  }

  function finish() {
    drawing = false;
    const pts = strokeToTrack(chalk.points, { minLength: Math.max(28, train.length + 12), bounds: WORLD_BOUNDS });
    const fade = () => game.tween(0.6, (t) => { chalk.mesh.material.opacity = 0.9 * (1 - t); }, () => {
      chalk.reset();
      chalk.mesh.material.opacity = 0.9;
    });
    if (!pts) {
      fade();
      return;
    }
    land.track.setPoints(pts, true);
    land.clearAroundTrack();
    services.saveTrack(pts);
    game.drive.s = train.length + 1;
    game.drive.speed = 0;
    train.placeOnCurve(land.track.curve, land.track.length, game.drive.s);
    fade();
    services.sfx('chime');
    services.say(services.t('trackDone'));
    game.pulseMode('drive');
  }

  return {
    enter() {
      game.useScene('land');
      game.drive.target = 0;
      game.drive.speed = 0;
      train.placeOnCurve(land.track.curve, land.track.length, game.drive.s);
      camera(false);
      if (!hintShown) {
        hintShown = true;
        hint.classList.remove('hidden');
        setTimeout(() => hint.classList.add('hidden'), 4200);
      }
    },
    exit() {
      hint.classList.add('hidden');
      if (drawing) finish();
    },
    onResize() {
      camera(true);
    },
    update(dt) {
      if (land.track.update(dt)) services.sfx('klack');
      train.animate(dt, 0, false);
    },
    pointerDown(e) {
      const p = game.groundPoint(e.clientX, e.clientY);
      if (!p) return;
      hint.classList.add('hidden');
      drawing = true;
      chalk.reset();
      clamp(p);
      chalk.add(p.x, p.z);
    },
    pointerMove(e) {
      if (!drawing) return;
      const p = game.groundPoint(e.clientX, e.clientY);
      if (!p) return;
      clamp(p);
      if (chalk.add(p.x, p.z) && performance.now() - lastScribble > 90) {
        lastScribble = performance.now();
        services.sfx('scribble');
      }
    },
    pointerUp() {
      if (drawing) finish();
    },
  };
}
