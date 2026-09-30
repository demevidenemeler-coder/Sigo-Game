// Werkstatt: Lok wählen, Wagen anhängen, anmalen, schmücken, beladen.
//
// Bedienung (für kleine Finger gedacht):
// - Aus der Leiste auf den Zug ZIEHEN (ein Ring zeigt, wo es landet) – oder einfach ANTIPPEN.
// - Etwas vom Zug WEGZIEHEN (in die Leiste) = abnehmen. Auf einen anderen Wagen ziehen = umsetzen.
// - Antippen am Zug ist immer harmlos: Tiere machen ihr Geräusch, der Lokführer winkt und pfeift.
// - Eine Zeige-Hand zeigt, wie es geht, wenn eine Weile nichts passiert.

import * as THREE from 'three';
import { LOCOS, WAGONS, COLORS, DECOR, CARGO, MAX_WAGONS, MAX_DECOR, newCar, partDef, isLoco } from '../../catalog.js';
import { renderThumbnails } from '../thumbs.js';
import { wave } from '../trainModel.js';

const TABS = [
  { id: 'parts', icon: '🚃', say: 'tabParts' },
  { id: 'paint', icon: '🎨', say: 'tabPaint' },
  { id: 'decor', icon: '⭐', say: 'tabDecor' },
  { id: 'cargo', icon: '🐄', say: 'tabCargo' },
];
const LISTS = { parts: [...LOCOS, ...WAGONS], paint: COLORS, decor: DECOR, cargo: CARGO };
const IDLE_HINT_MS = 12000;

export function createWorkshopMode(game) {
  const { services } = game;
  const train = game.train;
  const ws = game.workshop;
  let tab = 'parts';
  const selected = { paint: COLORS[0], decor: DECOR[0], cargo: CARGO[0] };
  let lastCar = 0;
  let thumbs = null;
  let busy = false;
  let active = false;
  let highlighted = null;
  let lastInteraction = performance.now();
  let hintsShown = 0;

  // ---------- Leiste unten ----------

  const tray = document.createElement('div');
  tray.className = 'tray hidden';
  const tabBar = document.createElement('div');
  tabBar.className = 'tabs';
  const items = document.createElement('div');
  items.className = 'tray-items';
  tray.append(tabBar, items);
  game.ui.append(tray);

  const hint = document.createElement('div');
  hint.className = 'hint-hand hidden';
  hint.innerHTML = '<img alt=""><span class="hand">👆</span>';
  game.ui.append(hint);

  for (const t of TABS) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'tab';
    b.dataset.tab = t.id;
    b.textContent = t.icon;
    b.addEventListener('click', () => {
      services.sfx('pop');
      services.say(services.t(t.say));
      showTab(t.id);
    });
    tabBar.append(b);
  }

  const thumbKey = (kind, id) => `${kind}:${id}`;

  function itemButton(kind, entry) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = `tray-item ${kind}`;
    if (kind === 'paint') {
      const pot = document.createElement('span');
      pot.className = 'pot';
      pot.style.background = entry.hex;
      b.append(pot);
    } else {
      const img = document.createElement('img');
      img.src = thumbs[thumbKey(kind, entry.id)];
      img.alt = '';
      img.draggable = false;
      b.append(img);
    }
    if (selected[kind] === entry) b.classList.add('selected');
    bindTrayDrag(b, kind, entry);
    return b;
  }

  function showTab(id) {
    tab = id;
    tabBar.querySelectorAll('.tab').forEach((b) => b.classList.toggle('active', b.dataset.tab === id));
    items.replaceChildren(...LISTS[id].map((e) => itemButton(id, e)));
    items.dataset.kind = id;
    hideHint();
    requestAnimationFrame(updateInset);
  }

  function updateInset() {
    if (!active) return;
    game.setBottomInset(tray.getBoundingClientRect().height);
    fitTrain(false);
  }

  function select(kind, entry, button) {
    if (!selected[kind]) return;
    selected[kind] = entry;
    items.querySelectorAll('.tray-item').forEach((b) => b.classList.remove('selected'));
    button?.classList.add('selected');
  }

  // ---------- Ziele finden ----------

  function screenPos(car) {
    const v = new THREE.Vector3();
    car.getWorldPosition(v);
    v.y += 1.1;
    v.project(game.camera);
    return { x: ((v.x + 1) / 2) * window.innerWidth, y: ((1 - v.y) / 2) * window.innerHeight };
  }

  const slotsOf = (i) => partDef(train.data.cars[i].type).slots ?? 0;
  const hasRoom = (i) => train.data.cars[i].cargo.length < slotsOf(i);
  const overTray = (y) => y > tray.getBoundingClientRect().top - 10;

  // Nächster passender Wagen zum Finger – ohne genau treffen zu müssen
  function targetFor(kind, x, y, sourceIndex = -1) {
    if (overTray(y)) return null;
    if (kind === 'loco') return 0;
    let best = -1;
    let bestD = Infinity;
    train.cars.forEach((c, i) => {
      if (kind === 'cargo' && i !== sourceIndex && !hasRoom(i)) return;
      const p = screenPos(c);
      const d = Math.hypot(p.x - x, p.y - y);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    });
    return best;
  }

  function setHighlight(index) {
    if (index === highlighted) return;
    highlighted = index;
    const h = ws.highlight;
    if (index == null || index < 0) {
      h.visible = false;
      return;
    }
    const car = train.cars[index];
    h.visible = true;
    h.position.x = car.position.x;
    h.scale.set(car.userData.length / 1.8, 0.9, 1);
    services.sfx('pop');
  }

  // ---------- Ziehen aus der Leiste ----------

  function makeGhost(src) {
    const g = document.createElement('div');
    g.className = 'ghost';
    if (src.startsWith('#')) {
      g.innerHTML = '<span class="pot"></span>';
      g.firstChild.style.background = src;
    } else {
      g.innerHTML = `<img src="${src}" alt="">`;
    }
    document.body.append(g);
    return g;
  }

  function moveGhost(g, x, y, removing = false) {
    g.style.left = `${x}px`;
    g.style.top = `${y}px`;
    g.classList.toggle('removing', removing);
  }

  function bindTrayDrag(button, kind, entry) {
    button.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      if (busy) return;
      touched();
      button.setPointerCapture(e.pointerId);
      const sx = e.clientX;
      const sy = e.clientY;
      let ghost = null;
      const targetKind = kind === 'parts' ? (isLoco(entry.id) ? 'loco' : 'wagon-add') : kind;
      const move = (ev) => {
        if (!ghost && Math.hypot(ev.clientX - sx, ev.clientY - sy) > 10) {
          ghost = makeGhost(kind === 'paint' ? entry.hex : thumbs[thumbKey(kind, entry.id)]);
          if (kind !== 'parts') select(kind, entry, button);
        }
        if (!ghost) return;
        moveGhost(ghost, ev.clientX, ev.clientY);
        setHighlight(targetFor(targetKind, ev.clientX, ev.clientY));
      };
      const up = (ev) => {
        button.removeEventListener('pointermove', move);
        button.removeEventListener('pointerup', up);
        button.removeEventListener('pointercancel', up);
        const target = highlighted;
        setHighlight(null);
        if (ghost) {
          ghost.remove();
          if (ev.type === 'pointerup' && target != null && target >= 0) dropFromTray(kind, entry, target, ev);
        } else if (ev.type === 'pointerup') {
          tapTrayItem(kind, entry, button);
        }
      };
      button.addEventListener('pointermove', move);
      button.addEventListener('pointerup', up);
      button.addEventListener('pointercancel', up);
    });
  }

  function tapTrayItem(kind, entry, button) {
    if (kind === 'parts') return addPart(entry.id);
    select(kind, entry, button);
    if (kind === 'paint') {
      services.sfx('plop');
      services.sayName(entry.id);
    } else if (kind === 'decor') {
      addDecor(Math.min(lastCar, train.cars.length - 1), entry.id);
    } else if (kind === 'cargo') {
      const target = hasRoom(lastCar) ? lastCar : train.data.cars.findIndex((_, i) => hasRoom(i));
      if (target < 0) full();
      else addCargo(target, entry.id);
    }
  }

  function dropFromTray(kind, entry, target, ev) {
    lastCar = target;
    if (kind === 'parts') return addPart(entry.id, target + 1);
    if (kind === 'paint') {
      // Genau getroffenes Teil anmalen, sonst den Wagenkasten
      const hit = game.pickCar(ev.clientX, ev.clientY);
      const group = hit?.index === target ? hit.object?.userData.paint ?? 'body' : 'body';
      return paint(target, group);
    }
    if (kind === 'decor') return addDecor(target, entry.id);
    if (kind === 'cargo') return addCargo(target, entry.id);
  }

  // ---------- Ziehen am Zug (abnehmen, umsetzen, umsortieren) ----------

  let press = null;

  function startTrainDrag(e) {
    const hit = game.pickCar(e.clientX, e.clientY);
    if (!hit) return null;
    const owner = hit.object?.userData.owner;
    const removable = owner?.userData.removable;
    if (removable) return { what: 'item', car: hit.index, removable, obj: owner, hit };
    if (hit.index > 0) return { what: 'wagon', car: hit.index, obj: train.cars[hit.index], hit };
    return { what: 'loco', car: 0, hit };
  }

  function thumbForDrag(d) {
    if (d.what === 'wagon') return thumbs[thumbKey('parts', train.data.cars[d.car].type)];
    return thumbs[thumbKey(d.removable.list, d.removable.id)];
  }

  // ---------- Aktionen ----------

  function relayout() {
    train.layoutStraight();
    fitTrain(false);
    game.saveTrain();
  }

  function addPart(type, insertAt = null) {
    const data = train.data;
    if (isLoco(type)) {
      const old = data.cars[0];
      data.cars[0] = { ...newCar(type), decor: old.decor, paint: old.type === type ? old.paint : { ...partDef(type).paint } };
      train.rebuild();
      relayout();
      game.popIn(train.cars[0]);
      lastCar = 0;
    } else {
      if (data.cars.length - 1 >= MAX_WAGONS) return full();
      const at = insertAt == null ? data.cars.length : Math.max(1, Math.min(insertAt, data.cars.length));
      data.cars.splice(at, 0, newCar(type));
      train.rebuild();
      relayout();
      game.popIn(train.cars[at]);
      lastCar = at;
    }
    services.sfx('klack');
    services.sayName(type);
  }

  function removeWagon(index) {
    if (index <= 0) return;
    busy = true;
    train.data.cars.splice(index, 1);
    const car = train.cars[index];
    car.visible = true;
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

  function moveWagon(from, afterIndex) {
    const [w] = train.data.cars.splice(from, 1);
    const at = Math.max(1, afterIndex + (afterIndex < from ? 1 : 0));
    train.data.cars.splice(at, 0, w);
    train.rebuild();
    relayout();
    game.popIn(train.cars[at]);
    lastCar = at;
    services.sfx('klack');
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

  function addCargo(index, id) {
    if (!hasRoom(index)) {
      // Passt nicht (Lok, Tankwagen oder voll) – Wagen hüpft, sonst nichts
      game.hop(train.cars[index]);
      services.sfx('boing');
      return false;
    }
    train.data.cars[index].cargo.push(id);
    const car = train.rebuildCar(index);
    game.popIn(car.userData.cargoItems[car.userData.cargoItems.length - 1]);
    lastCar = index;
    game.saveTrain();
    services.sfx('pop');
    services.sayName(id);
    return true;
  }

  function removeItem(index, removable) {
    train.data.cars[index][removable.list].splice(removable.index, 1);
    train.rebuildCar(index);
    game.saveTrain();
    services.sfx('poof');
    if (removable.list === 'cargo') services.say(services.t('bye'));
  }

  function moveItem(from, removable, to) {
    const list = removable.list;
    if (list === 'cargo' && !hasRoom(to)) return false;
    const [id] = train.data.cars[from][list].splice(removable.index, 1);
    train.rebuildCar(from);
    if (list === 'cargo') addCargo(to, id);
    else addDecor(to, id);
    return true;
  }

  function full() {
    services.sfx('boing');
    services.say(services.t('full'));
  }

  function horn() {
    game.hop(train.loco);
    wave(train.loco.userData.driver, game);
    services.sfx(train.data.cars[0].type === 'dampf' ? 'whistle' : 'elhorn');
  }

  // Antippen am Zug
  function tapTrain(d) {
    if (!d) return;
    lastCar = d.car;
    if (d.what === 'item') {
      const obj = d.obj;
      game.hop(obj);
      wave(obj, game);
      if (d.removable.list === 'cargo') services.sayName(d.removable.id);
      else services.sfx('pling');
      return;
    }
    if (tab === 'paint') return paint(d.car, d.hit.object?.userData.paint ?? 'body');
    if (tab === 'decor') return addDecor(d.car, selected.decor.id);
    if (tab === 'cargo') return addCargo(d.car, selected.cargo.id);
    if (d.what === 'loco') return horn();
    game.hop(train.cars[d.car]);
    services.sfx('klack');
    services.sayName(train.data.cars[d.car].type);
  }

  // ---------- Zeige-Hand ----------

  function touched() {
    lastInteraction = performance.now();
    hideHint();
  }

  function hideHint() {
    hint.classList.add('hidden');
    hint.classList.remove('play');
  }

  function showHint() {
    if (!active || busy) return;
    const list = LISTS[tab];
    const entry = tab === 'parts' ? list[LOCOS.length] : list[0];
    const btn = items.children[list.indexOf(entry)];
    if (!btn) return;
    let target = tab === 'parts' ? train.cars.length - 1 : 0;
    if (tab === 'cargo') target = Math.max(0, train.data.cars.findIndex((_, i) => hasRoom(i)));
    const from = btn.getBoundingClientRect();
    const to = screenPos(train.cars[target]);
    hint.style.setProperty('--x0', `${from.left + from.width / 2}px`);
    hint.style.setProperty('--y0', `${from.top + from.height / 2}px`);
    hint.style.setProperty('--x1', `${to.x}px`);
    hint.style.setProperty('--y1', `${to.y}px`);
    const img = hint.querySelector('img');
    if (tab === 'paint') {
      img.removeAttribute('src');
      img.style.background = entry.hex;
      img.classList.add('pot');
    } else {
      img.src = thumbs[thumbKey(tab, entry.id)];
      img.style.background = '';
      img.classList.remove('pot');
    }
    hint.classList.remove('hidden', 'play');
    void hint.offsetWidth;
    hint.classList.add('play');
    hintsShown++;
  }

  // ---------- Kamera ----------

  function fitTrain(instant) {
    const L = train.length;
    game.fit(new THREE.Vector3(0, 1.15, 0), L / 2 + 1.6, 2.0, new THREE.Vector3(0.3, 0.45, 1), instant);
  }

  // ---------- Modus ----------

  return {
    enter() {
      if (!thumbs) {
        thumbs = renderThumbnails([
          ...[...LOCOS, ...WAGONS].map((p) => ({ kind: 'parts', id: p.id })),
          ...DECOR.map((d) => ({ kind: 'decor', id: d.id })),
          ...CARGO.map((c) => ({ kind: 'cargo', id: c.id })),
        ]);
      }
      active = true;
      game.useScene('workshop');
      train.layoutStraight();
      tray.classList.remove('hidden');
      showTab(tab);
      game.setBottomInset(tray.getBoundingClientRect().height);
      fitTrain(!game.cam.initialized);
      game.cam.initialized = true;
      lastInteraction = performance.now() - (hintsShown === 0 ? IDLE_HINT_MS - 2500 : 0);
    },
    exit() {
      active = false;
      tray.classList.add('hidden');
      hideHint();
      setHighlight(null);
      game.setBottomInset(0);
    },
    update(dt) {
      train.animate(dt, 0, false);
      if (ws.highlight.visible) ws.highlight.material.opacity = 0.6 + Math.sin(game.time * 8) * 0.3;
      if (performance.now() - lastInteraction > IDLE_HINT_MS) {
        lastInteraction = performance.now();
        showHint();
      }
    },
    onResize() {
      requestAnimationFrame(updateInset);
    },
    pointerDown(e) {
      touched();
      if (busy) return;
      press = { x: e.clientX, y: e.clientY, drag: startTrainDrag(e), ghost: null };
    },
    pointerMove(e) {
      const p = press;
      if (!p?.drag || p.drag.what === 'loco') return;
      if (!p.ghost && Math.hypot(e.clientX - p.x, e.clientY - p.y) > 22) {
        p.ghost = makeGhost(thumbForDrag(p.drag));
        p.drag.obj.visible = false;
        services.sfx('whoosh');
      }
      if (!p.ghost) return;
      const kind = p.drag.what === 'wagon' ? 'wagon' : p.drag.removable.list;
      const target = targetFor(kind, e.clientX, e.clientY, p.drag.car);
      moveGhost(p.ghost, e.clientX, e.clientY, target == null || target < 0);
      setHighlight(target);
    },
    pointerUp(e, cancelled) {
      const p = press;
      press = null;
      if (!p) return;
      const target = highlighted;
      setHighlight(null);
      if (!p.ghost) {
        if (!cancelled && Math.hypot(e.clientX - p.x, e.clientY - p.y) < 22) tapTrain(p.drag);
        return;
      }
      p.ghost.remove();
      const d = p.drag;
      if (cancelled) {
        d.obj.visible = true;
        return;
      }
      const remove = target == null || target < 0;
      if (d.what === 'wagon') {
        if (remove) removeWagon(d.car);
        else if (target !== d.car) moveWagon(d.car, target);
        else d.obj.visible = true;
      } else if (remove) {
        removeItem(d.car, d.removable);
      } else if (target !== d.car) {
        if (!moveItem(d.car, d.removable, target)) d.obj.visible = true;
      } else {
        d.obj.visible = true;
      }
    },
  };
}
