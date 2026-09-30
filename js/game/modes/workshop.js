// Werkstatt: Lok wählen, Wagen anhängen, anmalen, schmücken, beladen.
// Alles geht durch Antippen ODER Ziehen – was dem Kind leichter fällt.

import * as THREE from 'three';
import { LOCOS, WAGONS, COLORS, DECOR, CARGO, MAX_WAGONS, MAX_DECOR, newCar, partDef, isLoco } from '../../catalog.js';
import { renderThumbnails } from '../thumbs.js';

const TABS = [
  { id: 'parts', icon: '🚃' },
  { id: 'paint', icon: '🎨' },
  { id: 'decor', icon: '⭐' },
  { id: 'cargo', icon: '🐄' },
];

export function createWorkshopMode(game) {
  const { services } = game;
  const train = game.train;
  let tab = 'parts';
  const selected = { paint: COLORS[0], decor: DECOR[0], cargo: CARGO[0] };
  let lastCar = 0;
  let thumbs = null;
  let down = null;
  let busy = false; // während ein Wagen abgekoppelt wird

  // ---------- Leiste unten ----------

  const tray = document.createElement('div');
  tray.className = 'tray hidden';
  const tabBar = document.createElement('div');
  tabBar.className = 'tabs';
  const items = document.createElement('div');
  items.className = 'tray-items';
  tray.append(tabBar, items);
  game.ui.append(tray);

  for (const t of TABS) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'tab';
    b.dataset.tab = t.id;
    b.textContent = t.icon;
    b.addEventListener('click', () => {
      services.sfx('pop');
      showTab(t.id);
    });
    tabBar.append(b);
  }

  function itemButton(kind, entry) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = `tray-item ${kind}`;
    if (kind === 'parts') {
      const img = document.createElement('img');
      img.src = thumbs[entry.id];
      img.alt = '';
      img.draggable = false;
      b.append(img);
    } else if (kind === 'paint') {
      const pot = document.createElement('span');
      pot.className = 'pot';
      pot.style.background = entry.hex;
      b.append(pot);
    } else {
      const e = document.createElement('span');
      e.className = 'emoji';
      e.textContent = entry.emoji;
      b.append(e);
    }
    if (selected[kind] === entry) b.classList.add('selected');
    bindDrag(b, kind, entry);
    return b;
  }

  function showTab(id) {
    tab = id;
    tabBar.querySelectorAll('.tab').forEach((b) => b.classList.toggle('active', b.dataset.tab === id));
    const list = { parts: [...LOCOS, ...WAGONS], paint: COLORS, decor: DECOR, cargo: CARGO }[id];
    items.replaceChildren(...list.map((e) => itemButton(id, e)));
    items.dataset.kind = id;
    requestAnimationFrame(updateInset);
  }

  function updateInset() {
    if (tray.classList.contains('hidden')) return;
    game.setBottomInset(tray.getBoundingClientRect().height);
    fitTrain(false);
  }

  function select(kind, entry, button) {
    selected[kind] = entry;
    items.querySelectorAll('.tray-item').forEach((b) => b.classList.remove('selected'));
    button.classList.add('selected');
  }

  // Ziehen aus der Leiste auf den Zug
  function bindDrag(button, kind, entry) {
    button.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      button.setPointerCapture(e.pointerId);
      const sx = e.clientX;
      const sy = e.clientY;
      let ghost = null;
      const move = (ev) => {
        if (!ghost && Math.hypot(ev.clientX - sx, ev.clientY - sy) > 12) {
          ghost = button.cloneNode(true);
          ghost.classList.add('ghost');
          document.body.append(ghost);
        }
        if (ghost) ghost.style.transform = `translate(${ev.clientX - 45}px, ${ev.clientY - 45}px) scale(1.15)`;
      };
      const up = (ev) => {
        button.removeEventListener('pointermove', move);
        button.removeEventListener('pointerup', up);
        button.removeEventListener('pointercancel', up);
        if (busy) {
          ghost?.remove();
        } else if (ghost) {
          ghost.remove();
          if (ev.type === 'pointerup') drop(kind, entry, ev.clientX, ev.clientY, button);
        } else if (ev.type === 'pointerup') {
          tapItem(kind, entry, button);
        }
      };
      button.addEventListener('pointermove', move);
      button.addEventListener('pointerup', up);
      button.addEventListener('pointercancel', up);
    });
  }

  function tapItem(kind, entry, button) {
    if (kind === 'parts') return addPart(entry.id);
    select(kind, entry, button);
    if (kind === 'paint') {
      services.sfx('plop');
      services.sayName(entry.id);
    } else if (kind === 'decor') {
      addDecor(Math.min(lastCar, train.cars.length - 1), entry.id);
    } else if (kind === 'cargo') {
      const target = cargoTarget();
      if (target < 0) full();
      else addCargo(target, entry.id);
    }
  }

  function drop(kind, entry, x, y, button) {
    if (kind === 'parts') return addPart(entry.id);
    select(kind, entry, button);
    const hit = game.pickCar(x, y);
    if (!hit) {
      services.sfx('boing');
      return;
    }
    applyToCar(kind, hit);
  }

  function applyToCar(kind, hit) {
    lastCar = hit.index;
    if (kind === 'paint') paint(hit.index, hit.object?.userData.paint ?? 'body');
    else if (kind === 'decor') addDecor(hit.index, selected.decor.id);
    else if (kind === 'cargo') addCargo(hit.index, selected.cargo.id);
  }

  // ---------- Aktionen ----------

  function relayout() {
    train.layoutStraight();
    fitTrain(false);
    game.saveTrain();
  }

  function addPart(type) {
    const data = train.data;
    if (isLoco(type)) {
      const old = data.cars[0];
      data.cars[0] = { ...newCar(type), decor: old.decor, paint: { ...old.paint, ...(old.type === type ? {} : partDef(type).paint) } };
      train.rebuild();
      relayout();
      game.popIn(train.cars[0]);
    } else {
      if (data.cars.length - 1 >= MAX_WAGONS) return full();
      data.cars.push(newCar(type));
      train.rebuild();
      relayout();
      game.popIn(train.cars[train.cars.length - 1]);
      lastCar = train.cars.length - 1;
    }
    services.sfx('klack');
    services.sayName(type);
  }

  function removeWagon(index) {
    if (index <= 0) return;
    busy = true;
    train.data.cars.splice(index, 1);
    const car = train.cars[index];
    game.tween(0.3, (t) => {
      car.position.y = t * 2;
      car.scale.setScalar(1 - t * 0.9);
    }, () => {
      train.rebuild();
      relayout();
      busy = false;
    });
    lastCar = Math.min(lastCar, train.data.cars.length - 1);
    services.sfx('poof');
    services.say(services.t('bye'));
  }

  function paint(index, group) {
    const hex = selected.paint.hex;
    train.data.cars[index].paint[group] = hex;
    train.cars[index].userData.mats[group].color.set(hex);
    game.hop(train.cars[index]);
    game.saveTrain();
    services.sfx('splash');
    services.sayName(selected.paint.id);
  }

  function addDecor(index, kind) {
    const list = train.data.cars[index].decor;
    list.push(kind);
    if (list.length > MAX_DECOR) list.shift();
    const car = train.rebuildCar(index);
    game.popIn(car.userData.decorItems[car.userData.decorItems.length - 1]);
    lastCar = index;
    game.saveTrain();
    services.sfx('pling');
    services.sayName(kind);
  }

  function slotsOf(index) {
    return partDef(train.data.cars[index].type).slots ?? 0;
  }

  function cargoTarget() {
    const free = (i) => i > 0 && train.data.cars[i].cargo.length < slotsOf(i);
    if (free(lastCar)) return lastCar;
    return train.data.cars.findIndex((_, i) => free(i));
  }

  function addCargo(index, id) {
    const data = train.data.cars[index];
    if (data.cargo.length >= slotsOf(index)) {
      // Passt nicht (Lok, Tankwagen oder voll) – Wagen hüpft, sonst nichts
      game.hop(train.cars[index]);
      services.sfx('boing');
      return;
    }
    data.cargo.push(id);
    const car = train.rebuildCar(index);
    game.popIn(car.userData.cargoItems[car.userData.cargoItems.length - 1]);
    lastCar = index;
    game.saveTrain();
    services.sfx('pop');
    services.sayName(id);
  }

  function removeItem(index, removable) {
    train.data.cars[index][removable.list].splice(removable.index, 1);
    train.rebuildCar(index);
    game.saveTrain();
    services.sfx('poof');
  }

  function full() {
    services.sfx('boing');
    services.say(services.t('full'));
  }

  function horn() {
    game.hop(train.loco);
    services.sfx(train.data.cars[0].type === 'dampf' ? 'whistle' : 'elhorn');
  }

  // ---------- Kamera ----------

  function fitTrain(instant) {
    const L = train.length;
    game.fit(new THREE.Vector3(0, 1.15, 0), L / 2 + 1.8, 2.0, new THREE.Vector3(0.3, 0.5, 1), instant);
  }

  // ---------- Modus ----------

  return {
    enter() {
      if (!thumbs) thumbs = renderThumbnails([...LOCOS, ...WAGONS].map((p) => p.id));
      game.useScene('workshop');
      train.layoutStraight();
      tray.classList.remove('hidden');
      showTab(tab);
      game.setBottomInset(tray.getBoundingClientRect().height);
      fitTrain(!game.cam.initialized);
      game.cam.initialized = true;
    },
    exit() {
      tray.classList.add('hidden');
      game.setBottomInset(0);
    },
    update(dt) {
      train.animate(dt, 0, false);
    },
    onResize() {
      requestAnimationFrame(updateInset);
    },
    pointerDown(e) {
      down = { x: e.clientX, y: e.clientY };
    },
    pointerUp(e, cancelled) {
      if (busy || cancelled || !down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 18) return;
      down = null;
      const hit = game.pickCar(e.clientX, e.clientY);
      if (!hit) return;
      const removable = hit.object?.userData.owner?.userData.removable;
      if (removable && (tab === 'decor' || tab === 'cargo')) return removeItem(hit.index, removable);
      if (tab === 'parts') return hit.index === 0 ? horn() : removeWagon(hit.index);
      if (tab === 'paint') return applyToCar('paint', hit);
      if (tab === 'decor') return applyToCar('decor', hit);
      if (tab === 'cargo') return applyToCar('cargo', hit);
    },
  };
}
