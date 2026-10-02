// Tiere füttern (Werkstatt-Fach „Futter“):
// Futter auf ein Tier im Zug ziehen (oder antippen). Mag es das Futter, mampft es es in drei Bissen,
// Herzchen steigen auf und es macht sein Geräusch. Mag es das Futter nicht, schüttelt es den Kopf,
// das Futter fällt herunter – und in einer Denkblase zeigt das Tier, was es lieber mag.

import * as THREE from 'three';
import { LIKES, isEater } from '../catalog.js';
import { buildFood, FOOD_COLOR } from './foods.js';

const HUMANS = ['kind', 'papa', 'oma', 'teddy'];

function heartTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = '#ff5a7a';
  g.beginPath();
  g.moveTo(32, 56);
  g.bezierCurveTo(4, 36, 4, 10, 20, 10);
  g.bezierCurveTo(28, 10, 32, 18, 32, 22);
  g.bezierCurveTo(32, 18, 36, 10, 44, 10);
  g.bezierCurveTo(60, 10, 60, 36, 32, 56);
  g.fill();
  g.fillStyle = 'rgba(255,255,255,0.6)';
  g.beginPath();
  g.ellipse(21, 20, 5, 3.5, -0.6, 0, Math.PI * 2);
  g.fill();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Denkblase mit dem Bild des Lieblingsfutters
function thoughtSprite(src, done) {
  const img = new Image();
  img.onload = () => {
    const c = document.createElement('canvas');
    c.width = c.height = 160;
    const g = c.getContext('2d');
    g.fillStyle = '#ffffff';
    g.strokeStyle = 'rgba(0,0,0,0.2)';
    g.lineWidth = 4;
    for (const [x, y, r] of [[80, 70, 64], [34, 146, 9], [50, 128, 13]]) {
      g.beginPath();
      g.arc(x, y, r, 0, Math.PI * 2);
      g.fill();
      g.stroke();
    }
    g.drawImage(img, 26, 16, 108, 108);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthWrite: false, transparent: true }));
    s.center.set(0.25, 0.05);
    s.renderOrder = 6;
    done(s);
  };
  img.src = src;
}

export function createFeeder(game, services) {
  const train = game.train;
  const heartMat = new THREE.SpriteMaterial({ map: heartTexture(), depthWrite: false, transparent: true });
  const fx = []; // { obj, life, v, kind }
  let target = null;

  // Alle Figuren im Zug, die etwas fressen (Tiere, Kind, Oma, Papa, Teddy)
  function eaters() {
    const out = [];
    for (const car of train.cars) for (const f of car.userData.cargoItems) if (isEater(f.userData.figure)) out.push(f);
    return out;
  }

  function screenOf(fig) {
    const v = mouthOf(fig).project(game.camera);
    return { x: ((v.x + 1) / 2) * window.innerWidth, y: ((1 - v.y) / 2) * window.innerHeight };
  }

  function nearestEater(x, y, maxDist = 170) {
    let best = null;
    let bestD = maxDist;
    for (const f of eaters()) {
      const p = screenOf(f);
      const d = Math.hypot(p.x - x, p.y - y);
      if (d < bestD) {
        bestD = d;
        best = f;
      }
    }
    return best;
  }

  // Mundposition in der Welt (dort fliegt das Futter hin)
  function mouthOf(fig) {
    if (fig.userData.mouthHolder) return fig.userData.mouthHolder.getWorldPosition(new THREE.Vector3());
    const b = fig.userData.box;
    const id = fig.userData.figure;
    const local = HUMANS.includes(id)
      ? new THREE.Vector3(0, b.max.y * 0.72, b.max.z)
      : new THREE.Vector3(b.max.x * 0.8, b.min.y + (b.max.y - b.min.y) * 0.78, b.max.z * 0.5);
    return fig.localToWorld(local);
  }

  // Beim Ziehen: das Tier, das gleich gefüttert wird, wird etwas größer („Oh, für mich?“)
  function setMouth(fig, v) {
    fig.userData.mouthV = v;
    fig.userData.setMouth?.(v);
  }

  function setTarget(fig) {
    if (fig === target) return;
    const old = target;
    target = fig;
    for (const f of [old, fig]) {
      if (!f) continue;
      const base = f.userData.feedBase ?? (f.userData.feedBase = f.scale.x);
      const to = f === fig ? base * 1.25 : base;
      const from = f.scale.x;
      game.tween(0.18, (t) => f.scale.setScalar(from + (to - from) * t));
    }
    if (fig) services.sfx('pop');
  }

  function crumbs(pos, color) {
    for (let i = 0; i < 6; i++) {
      const m = new THREE.Mesh(new THREE.SphereGeometry(0.025, 6, 5), new THREE.MeshStandardMaterial({ color, roughness: 0.8 }));
      m.position.copy(pos);
      game.scene.add(m);
      fx.push({ obj: m, life: 1, kind: 'crumb', v: new THREE.Vector3((Math.random() - 0.5) * 1.2, 0.8 + Math.random(), 0.4 + Math.random() * 0.6) });
    }
  }

  function hearts(pos) {
    for (let i = 0; i < 4; i++) {
      const s = new THREE.Sprite(heartMat);
      s.position.copy(pos).add(new THREE.Vector3((Math.random() - 0.5) * 0.4, 0.1, 0.2));
      s.scale.setScalar(0.01);
      s.renderOrder = 6;
      game.scene.add(s);
      fx.push({ obj: s, life: 1 + i * 0.15, kind: 'heart', v: new THREE.Vector3((Math.random() - 0.5) * 0.4, 0.9 + Math.random() * 0.4, 0) });
    }
  }

  // fig füttern. thumbs: Vorschaubilder (für die Denkblase). onRefuse(lieblingsfutter) z. B. für einen Hinweis in der Leiste
  function feed(fig, foodId, { thumbs, from, onRefuse, onDone } = {}) {
    if (!fig || fig.userData.eating) return;
    setTarget(null);
    const id = fig.userData.figure;
    const likes = (LIKES[id] ?? []).includes(foodId);
    fig.userData.eating = true;
    const mouth = mouthOf(fig);
    const food = buildFood(foodId);
    food.scale.setScalar(0.9);
    const start = from ?? mouth.clone().add(new THREE.Vector3(0.2, 1.4, 0.8));
    food.position.copy(start);
    game.scene.add(food);
    services.sfx('whoosh');
    // Futter fliegt zum Mund
    game.tween(0.45, (t) => {
      setMouth(fig, Math.max(fig.userData.mouthV ?? 0, Math.min(1, t * 2.2))); // Mund geht weit auf, das Futter kommt
      food.position.lerpVectors(start, mouth, t);
      food.position.y += Math.sin(t * Math.PI) * 0.5 - 0.12 * t;
      food.rotation.y = t * 3;
    }, () => (likes ? eat(fig, food, foodId, onDone) : refuse(fig, food, foodId, thumbs, onRefuse, onDone)));
  }

  function eat(fig, food, foodId, onDone) {
    const id = fig.userData.figure;
    const base = fig.userData.feedBase ?? fig.scale.x;
    let bite = 0;
    const nextBite = () => {
      bite++;
      services.sfx('munch');
      crumbs(food.getWorldPosition(new THREE.Vector3()), FOOD_COLOR[foodId]);
      const s0 = food.scale.x;
      // Kauen: Figur wird kurz breiter und flacher
      game.tween(0.34, (t) => {
        const k = Math.sin(t * Math.PI);
        // Mampf: Mund klappt auf und zu (Biss 1: schließt sich um das Futter, Biss 3: lächelt)
        setMouth(fig, 0.15 + 0.85 * Math.abs(Math.cos(t * Math.PI * 1.5)) * (1 - t * 0.5));
        fig.scale.set(base * (1 + k * 0.08), base * (1 - k * 0.08), base * (1 + k * 0.08));
        food.scale.setScalar(Math.max(0.001, s0 - (0.9 / 3) * t));
      }, () => {
        if (bite < 3) return nextBite();
        game.scene.remove(food);
        fig.scale.setScalar(base);
        game.tween(0.4, (t) => setMouth(fig, (fig.userData.mouthV ?? 0) * (1 - t)));
        hearts(mouthOf(fig).add(new THREE.Vector3(0, 0.3, 0)));
        game.hop(fig);
        services.sfx('chime');
        services.animalCall(id);
        setTimeout(() => services.say(services.t('yummy')), 900);
        fig.userData.eating = false;
        setTimeout(() => onDone?.(), 1400);
      });
    };
    nextBite();
  }

  function refuse(fig, food, foodId, thumbs, onRefuse, onDone) {
    const id = fig.userData.figure;
    const fav = LIKES[id][0];
    const r0 = fig.rotation.y;
    services.sfx('nope');
    services.say(services.t('noThanks'));
    // Mund presst sich zu, Kopfschütteln
    game.tween(0.3, (t) => setMouth(fig, (fig.userData.mouthV ?? 0) * (1 - t)));
    game.tween(0.8, (t) => { fig.rotation.y = r0 + Math.sin(t * Math.PI * 4) * 0.45 * (1 - t); }, () => { fig.rotation.y = r0; });
    // Futter fällt herunter und verschwindet
    const p0 = food.position.clone();
    game.tween(0.7, (t) => {
      food.position.set(p0.x + t * 0.5, p0.y + Math.sin(t * Math.PI) * 0.3 - t * 1.2, p0.z + t * 0.6);
      food.rotation.z = t * 4;
      food.scale.setScalar(0.9 * (1 - t * 0.7));
    }, () => {
      game.scene.remove(food);
      services.sfx('poof');
    });
    // Denkblase: Das mag ich lieber!
    const src = thumbs?.[`food:${fav}`];
    if (src) {
      thoughtSprite(src, (s) => {
        const top = fig.userData.box.max.y;
        s.position.set(0, top + 0.15, 0);
        s.scale.setScalar(0.01);
        fig.add(s);
        const size = 1.1 / (fig.scale.x || 1);
        game.tween(0.3, (t) => s.scale.setScalar(size * t));
        setTimeout(() => game.tween(0.3, (t) => s.scale.setScalar(size * (1 - t) + 0.001), () => fig.remove(s)), 3000);
      });
    }
    onRefuse?.(fav);
    setTimeout(() => { fig.userData.eating = false; }, 900);
    setTimeout(() => onDone?.(), 2200);
  }

  // hungry = true (Futter-Fach): alle Tiere sperren abwechselnd den Mund auf – „Gib mir Futter!“.
  // Das Tier unter dem Finger macht den Mund ganz weit auf.
  function update(dt, hungry = false) {
    const time = game.time;
    for (const f of eaters()) {
      const u = f.userData;
      if (u.eating) continue;
      u.hungerPhase ??= Math.random() * 6.3;
      let goal = 0;
      if (f === target) goal = 0.85 + 0.15 * Math.sin(time * 9);
      else if (hungry) goal = Math.max(0, Math.min(1, Math.sin(time * 3.3 + u.hungerPhase) * 1.9));
      const cur = u.mouthV ?? 0;
      if (cur !== goal) setMouth(f, cur + (goal - cur) * Math.min(1, dt * 16));
    }
    for (let i = fx.length - 1; i >= 0; i--) {
      const f = fx[i];
      f.life -= dt / (f.kind === 'heart' ? 1.6 : 0.9);
      f.obj.position.addScaledVector(f.v, dt);
      if (f.kind === 'crumb') f.v.y -= dt * 5;
      else f.obj.scale.setScalar(0.32 * Math.min(1, (1.6 - f.life) * 4) * Math.min(1, f.life * 3) + 0.001);
      if (f.life <= 0) {
        f.obj.parent?.remove(f.obj);
        fx.splice(i, 1);
      }
    }
  }

  function clear() {
    setTarget(null);
    for (const f of fx) f.obj.parent?.remove(f.obj);
    fx.length = 0;
  }

  return { eaters, nearestEater, setTarget, feed, update, clear, screenOf };
}
