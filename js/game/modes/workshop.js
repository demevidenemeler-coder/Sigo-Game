// Werkstatt: Lok wählen, Wagen anhängen, anmalen, schmücken, beladen.
//
// Bedienung (für kleine Finger gedacht):
// - Aus der Leiste auf den Zug ZIEHEN (ein Ring zeigt, wo es landet) – oder einfach ANTIPPEN.
// - Etwas vom Zug WEGZIEHEN (in die Leiste) = abnehmen. Auf einen anderen Wagen ziehen = umsetzen.
// - Antippen am Zug ist immer harmlos: Tiere machen ihr Geräusch, der Lokführer winkt und pfeift.
// - Eine Zeige-Hand zeigt, wie es geht, wenn eine Weile nichts passiert.

import * as THREE from 'three';
import { LOCOS, WAGONS, COLORS, DECOR, CARGO, ANIMALS, PASSENGERS, FOODS, LIKES, MAX_WAGONS, MAX_DECOR, newCar, partDef, isLoco, pushCargo, spliceCargo, isHomeWagon } from '../../catalog.js';
import { renderThumbnails } from '../thumbs.js';
import { createTray } from '../tray.js';
import { wave, applyDirt } from '../trainModel.js';
import { createFeeder } from '../feeding.js';
import { WHEEL_STYLES } from '../wheelStyles.js';

const TABS = [
  { id: 'locos', icon: '🚂', say: 'tabLocos' },
  { id: 'wagons', icon: '🚃', say: 'tabWagons' },
  { id: 'paint', icon: '🎨', say: 'tabPaint' },
  { id: 'decor', icon: '⭐', say: 'tabDecor' },
  { id: 'wheels', icon: '🛞', say: 'tabWheels' },
  { id: 'animals', icon: '🐄', say: 'tabAnimals' },
  { id: 'passengers', icon: '🧸', say: 'tabPassengers' },
  { id: 'food', icon: '🥕', say: 'tabFood' },
];
const LISTS = { locos: LOCOS, wagons: WAGONS, paint: COLORS, decor: DECOR, wheels: WHEEL_STYLES.map((id) => ({ id })), animals: ANIMALS, passengers: PASSENGERS, food: FOODS };
// Tiere und Mitfahrer sind beides „Ladung“
const kindOf = (tab) => {
  if (tab === 'animals' || tab === 'passengers') return 'cargo';
  if (tab === 'locos' || tab === 'wagons') return 'parts';
  if (tab === 'wheels') return 'wheel';
  return tab;
};
const IDLE_HINT_MS = 9000;

export function createWorkshopMode(game) {
  const { services } = game;
  const train = game.train;
  const ws = game.workshop;
  let tab = 'wagons';
  const selected = { paint: COLORS[0], wheelpaint: COLORS[0], decor: DECOR[0], cargo: CARGO[0], food: FOODS[0], wheel: { id: 'speichen' } };
  const feeder = createFeeder(game, services);
  let lastCar = 0;
  let thumbs = null;
  let busy = false;
  let active = false;
  let highlighted = null;
  let lastInteraction = performance.now();

  // ---------- Leiste unten ----------

  const tray = createTray(game.ui, {
    tabs: TABS.map((t) => ({ id: t.id, icon: t.icon, label: services.t(t.say) })),
    onTab(id) {
      services.sfx('pop');
      services.say(services.t(TABS.find((t) => t.id === id).say));
      showTab(id);
    },
  });
  const items = tray.items;


  const thumbKey = (kind, id) => `${kind}:${id}`;

  function itemButton(kind, entry) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = `tray-item ${kind}`;
    if (kind === 'paint' || kind === 'wheelpaint') {
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
    feedFocus = null;
    lastEaterCount = -1;
    tray.setActiveTab(id);
    const buttons = LISTS[id].map((e) => itemButton(kindOf(id), e));
    // Im Räder-Fach gibt es auch Farbtöpfe – die malen nur die Räder an
    if (id === 'wheels') buttons.push(...COLORS.map((c) => itemButton('wheelpaint', c)));
    tray.setItems(buttons);
    items.dataset.kind = id;
    hideHint();
    visited.add(id);
    // Neues Fach: einmal kurz vormachen, wie es geht
    if (active && !demoShown.has(id)) setTimeout(() => { if (tab === id && !game.hint.playing) demo(); }, 1300);
    requestAnimationFrame(updateInset);
  }

  function updateInset() {
    if (!active) return;
    game.setBottomInset(tray.height());
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
  const overTray = (y) => y > tray.top() - 10;

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
          ghost = makeGhost(kind === 'paint' || kind === 'wheelpaint' ? entry.hex : thumbs[thumbKey(kind, entry.id)]);
          if (kind !== 'parts') select(kind, entry, button);
        }
        if (!ghost) return;
        moveGhost(ghost, ev.clientX, ev.clientY);
        if (kind === 'food') feeder.setTarget(overTray(ev.clientY) ? null : feeder.nearestEater(ev.clientX, ev.clientY));
        else setHighlight(targetFor(targetKind, ev.clientX, ev.clientY));
      };
      const up = (ev) => {
        button.removeEventListener('pointermove', move);
        button.removeEventListener('pointerup', up);
        button.removeEventListener('pointercancel', up);
        const target = highlighted;
        setHighlight(null);
        if (ghost && kind === 'food') {
          ghost.remove();
          const fig = overTray(ev.clientY) ? null : feeder.nearestEater(ev.clientX, ev.clientY);
          feeder.setTarget(null);
          if (ev.type === 'pointerup' && fig) feedFig(fig, entry.id, ev.clientX, ev.clientY);
          else if (ev.type === 'pointerup' && !overTray(ev.clientY)) noEaterHere();
        } else if (ghost) {
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
    } else if (kind === 'wheelpaint') {
      paintWheels(Math.min(lastCar, train.cars.length - 1), entry.hex, entry.id);
    } else if (kind === 'decor') {
      addDecor(Math.min(lastCar, train.cars.length - 1), entry.id);
    } else if (kind === 'wheel') {
      setWheels(Math.min(lastCar, train.cars.length - 1), entry.id);
    } else if (kind === 'food') {
      // Antippen: das erste Tier, das es mag – sonst das erste Tier (das zeigt dann, was es lieber mag)
      const list = feeder.eaters();
      if (!list.length) return noEaters();
      const fig = list.find((f) => (LIKES[f.userData.figure] ?? []).includes(entry.id)) ?? list[0];
      feedFig(fig, entry.id);
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
    if (kind === 'wheel') return setWheels(target, entry.id);
    if (kind === 'wheelpaint') return paintWheels(target, entry.hex, entry.id);
    if (kind === 'cargo') return addCargo(target, entry.id);
  }

  // ---------- Ziehen am Zug (abnehmen, umsetzen, umsortieren) ----------

  let press = null;

  // Mitfahrer in Fingernähe (Bildschirm-Abstand) – damit man ein Tier greift und nicht den ganzen Wagen
  function cargoNear(x, y, maxDist = 75) {
    let best = null;
    let bestD = maxDist;
    const v = new THREE.Vector3();
    train.cars.forEach((car, index) => {
      for (const fig of car.userData.cargoItems) {
        fig.getWorldPosition(v);
        v.y += 0.35;
        v.project(game.camera);
        const d = Math.hypot(((v.x + 1) / 2) * window.innerWidth - x, ((1 - v.y) / 2) * window.innerHeight - y);
        if (d < bestD) {
          bestD = d;
          best = { fig, index };
        }
      }
    });
    return best;
  }

  function startTrainDrag(e) {
    const hit = game.pickCar(e.clientX, e.clientY);
    if (!hit) return null;
    const owner = hit.object?.userData.owner;
    if (!owner?.userData.removable) {
      const near = cargoNear(e.clientX, e.clientY);
      if (near) return { what: 'item', car: near.index, removable: near.fig.userData.removable, obj: near.fig, hit };
    }
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
      data.cars[0] = { ...newCar(type), decor: old.decor, wheelStyle: old.wheelStyle, paint: old.type === type ? old.paint : { ...partDef(type).paint } };
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
    if (group === 'trim') train.cars[index].userData.mats.trim.color.set(hex);
    else if (group === 'wheel') train.cars[index].userData.mats.wheel.color.set(hex);
    else applyDirt(train.cars[index]);
    game.hop(train.cars[index]);
    game.saveTrain();
    services.sfx('splash');
    services.sayName(selected.paint.id);
  }

  // Radmuster für alle Räder eines Wagens; die Räder drehen sich zur Freude einmal schnell
  function setWheels(index, style) {
    train.data.cars[index].wheelStyle = style;
    const car = train.rebuildCar(index);
    lastCar = index;
    game.tween(0.9, (t) => { for (const w of car.userData.wheels) w.rotation.z = -t * Math.PI * 4; });
    game.hop(car);
    game.saveTrain();
    services.sfx('pling');
    services.sayName(style);
  }

  function paintWheels(index, hex, id) {
    train.data.cars[index].paint.wheel = hex;
    const car = train.cars[index];
    car.userData.mats.wheel.color.set(hex);
    lastCar = index;
    game.tween(0.6, (t) => { for (const w of car.userData.wheels) w.rotation.z = -t * Math.PI * 2; });
    game.saveTrain();
    services.sfx('splash');
    services.sayName(id);
  }

  function addDecor(index, kind) {
    const list = train.data.cars[index].decor;
    // Gesicht, Lichterkette und Regenbogen gibt es nur einmal pro Wagen
    if (['gesicht', 'lichterkette', 'regenbogen'].includes(kind) && list.includes(kind)) {
      game.hop(train.cars[index]);
      services.sfx('pling');
      return;
    }
    list.push(kind);
    if (list.length > MAX_DECOR) list.shift();
    const car = train.rebuildCar(index);
    game.popIn(car.userData.decorItems[car.userData.decorItems.length - 1]);
    lastCar = index;
    game.saveTrain();
    services.sfx('pling');
    services.sayName(kind);
  }

  function addCargo(index, id, dest = null) {
    if (!hasRoom(index)) {
      // Passt nicht (Lok, Tankwagen oder voll) – Wagen hüpft, sonst nichts
      game.hop(train.cars[index]);
      services.sfx('boing');
      return false;
    }
    pushCargo(train.data.cars[index], id, dest);
    const car = train.rebuildCar(index);
    const fig = car.userData.cargoItems[car.userData.cargoItems.length - 1];
    game.popIn(fig);
    lastCar = index;
    game.saveTrain();
    services.sfx('pop');
    services.sayName(id);
    // Im Lieblingswagen freut sich das Tier: Herzchen und ein Hüpfer
    if (fig && isHomeWagon(train.data.cars[index].type, id)) {
      setTimeout(() => {
        feeder.hearts(fig.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, 0.9, 0)));
        game.hop(fig);
        services.sfx('sparkle');
      }, 450);
    }
    return true;
  }

  function removeItem(index, removable) {
    if (removable.list === 'cargo') spliceCargo(train.data.cars[index], removable.index);
    else train.data.cars[index][removable.list].splice(removable.index, 1);
    train.rebuildCar(index);
    game.saveTrain();
    services.sfx('poof');
    if (removable.list === 'cargo') services.say(services.t('bye'));
  }

  function moveItem(from, removable, to) {
    const list = removable.list;
    if (list === 'cargo' && !hasRoom(to)) return false;
    const { id, dest } = list === 'cargo' ? spliceCargo(train.data.cars[from], removable.index) : { id: train.data.cars[from][list].splice(removable.index, 1)[0] };
    train.rebuildCar(from);
    if (list === 'cargo') addCargo(to, id, dest);
    else addDecor(to, id);
    return true;
  }

  // ---------- Füttern ----------

  function feedFig(fig, foodId, x, y) {
    let from = null;
    if (x != null) {
      // Das Futter startet dort, wo der Finger losgelassen hat
      game.raycaster.setFromCamera(game.ndc(x, y), game.camera);
      const p = fig.getWorldPosition(new THREE.Vector3());
      from = game.raycaster.ray.at(game.raycaster.ray.origin.distanceTo(p) * 0.85, new THREE.Vector3());
    }
    // Beim Füttern fährt die Kamera noch näher an das Tier heran und danach wieder zurück
    feedFocus = fig;
    fitTrain(false);
    feeder.feed(fig, foodId, {
      thumbs,
      from,
      onRefuse: hintFood,
      onDone: () => {
        if (feedFocus === fig) feedFocus = null;
        if (active) fitTrain(false);
      },
    });
  }

  // Lieblingsfutter in der Leiste wackelt kurz (und wird sichtbar gescrollt)
  function hintFood(fav) {
    if (tab !== 'food') return;
    const btn = items.children[FOODS.findIndex((f) => f.id === fav)];
    if (!btn) return;
    btn.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    btn.classList.remove('wiggle-hint');
    void btn.offsetWidth;
    btn.classList.add('wiggle-hint');
    setTimeout(() => btn.classList.remove('wiggle-hint'), 3200);
  }

  function noEaters() {
    services.sfx('boing');
    services.say(services.t('noEaters'));
    const b = tray.root.querySelector('.tab[data-tab="animals"]');
    b?.classList.remove('wiggle-hint');
    void b?.offsetWidth;
    b?.classList.add('wiggle-hint');
    setTimeout(() => b?.classList.remove('wiggle-hint'), 3200);
  }

  function noEaterHere() {
    if (!feeder.eaters().length) return noEaters();
    services.sfx('poof');
  }

  function full() {
    services.sfx('boing');
    services.say(services.t('full'));
  }

  function horn() {
    game.hop(train.loco);
    wave(train.loco.userData.driver, game);
    services.sfx(partDef(train.data.cars[0].type).horn);
  }

  // Antippen am Zug
  function tapTrain(d) {
    if (!d) return;
    lastCar = d.car;
    if (d.what === 'item') {
      const obj = d.obj;
      wave(obj, game);
      if (d.removable.list === 'cargo' && tab === 'food' && LIKES[d.removable.id]) {
        // Im Futter-Fach: Tier antippen = mit dem gewählten Futter füttern
        feedFig(obj, selected.food.id);
      } else if (d.removable.list === 'cargo') {
        game.hop(obj);
        services.sayName(d.removable.id);
      } else if (obj.userData.bell) {
        // Glocke läuten
        const b = obj.userData.bell;
        game.tween(1.0, (t) => { b.rotation.z = Math.sin(t * Math.PI * 6) * 0.5 * (1 - t); });
        services.sfx('bell');
      } else {
        game.hop(obj);
        services.sfx('pling');
      }
      return;
    }
    if (tab === 'paint') return paint(d.car, d.hit.object?.userData.paint ?? 'body');
    if (tab === 'decor') return addDecor(d.car, selected.decor.id);
    if (tab === 'wheels') return setWheels(d.car, selected.wheel.id);
    if (kindOf(tab) === 'cargo') return addCargo(d.car, selected.cargo.id);
    if (tab === 'food' && d.what === 'wagon') {
      const fig = train.cars[d.car].userData.cargoItems.find((f) => LIKES[f.userData.figure]);
      if (fig) return feedFig(fig, selected.food.id);
    }
    if (d.what === 'loco') return horn();
    const car = train.cars[d.car];
    if (car.userData.crane) {
      // Kran schwenkt einmal herum
      const c = car.userData.crane;
      const r0 = c.rotation.y;
      game.tween(1.6, (t) => { c.rotation.y = r0 + Math.sin(t * Math.PI) * 1.4; });
      services.sfx('creak');
      return;
    }
    if (car.userData.toyCars) {
      car.userData.toyCars.forEach((tc, i) => setTimeout(() => game.hop(tc), i * 120));
      services.sfx('carhonk');
      return;
    }
    game.hop(car);
    services.sfx('klack');
    services.sayName(train.data.cars[d.car].type);
  }

  // ---------- Zeige-Hand ----------
  // Reihenfolge, wenn eine Weile nichts passiert: vormachen (im offenen Fach) → ein noch nicht
  // besuchtes Fach zeigen → (später) zum Fahren-Knopf zeigen. Neues Fach: einmal sofort vormachen.

  const visited = new Set();
  const demoShown = new Set();
  let hintStep = 0;

  function touched() {
    lastInteraction = performance.now();
  }

  function hideHint() {
    game.hint.hide();
  }

  function demo() {
    if (!active || busy) return;
    const list = LISTS[tab];
    const entry = list[0];
    const btn = items.children[0];
    if (!btn) return;
    let target = tab === 'wagons' ? train.cars.length - 1 : 0;
    if (kindOf(tab) === 'cargo') target = Math.max(0, train.data.cars.findIndex((_, i) => hasRoom(i)));
    if (tab === 'food') target = Math.max(0, train.data.cars.findIndex((c) => c.cargo.some((id) => LIKES[id])));
    if (tab === 'wheels' || tab === 'decor') target = Math.min(1, train.cars.length - 1);
    btn.scrollIntoView({ inline: 'nearest', block: 'nearest' });
    const from = btn.getBoundingClientRect();
    const to = screenPos(train.cars[target]);
    const img = tab === 'paint' ? entry.hex : thumbs[thumbKey(kindOf(tab), entry.id)];
    game.hint.drag(from.left + from.width / 2, from.top + from.height / 2, to.x, to.y, img);
    demoShown.add(tab);
  }

  function showHint() {
    if (!active || busy) return;
    const step = hintStep++ % 3;
    if (step === 1) {
      const next = TABS.find((t) => !visited.has(t.id));
      if (next) return game.hint.tapElement(tray.root.querySelector(`.tab[data-tab="${next.id}"]`));
    }
    if (step === 2 && hintStep > 4) return game.hint.tapElement(game.modeBar.querySelector('[data-mode="drive"]'));
    demo();
  }

  // ---------- Kamera ----------

  // Futter-Fach: die Kamera fährt dicht an die Tiere heran (damit man die Münder sieht).
  // focus = ein Tier, das gerade gefüttert wird: noch näher.
  let feedFocus = null;
  let lastEaterCount = -1;
  function fitFood(instant) {
    const figs = feeder.eaters();
    if (!figs.length) return false;
    const v = new THREE.Vector3();
    const box = new THREE.Box3();
    for (const f of figs) box.expandByPoint(f.getWorldPosition(v));
    let center = box.getCenter(new THREE.Vector3());
    let half = Math.max(2.7, (box.max.x - box.min.x) / 2 + 1.6);
    if (feedFocus) {
      center = feedFocus.getWorldPosition(new THREE.Vector3());
      half = 1.9;
    }
    game.fit(new THREE.Vector3(center.x, 1.35, 0), half, 1.55, new THREE.Vector3(0.18, 0.3, 1), instant);
    return true;
  }

  function fitTrain(instant) {
    if (tab === 'food' && fitFood(instant)) return;
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
          ...FOODS.map((f) => ({ kind: 'food', id: f.id })),
          ...WHEEL_STYLES.map((id) => ({ kind: 'wheel', id })),
        ]);
      }
      active = true;
      game.useScene('workshop');
      train.layoutStraight();
      tray.setLabels(Object.fromEntries(TABS.map((t) => [t.id, services.t(t.say)])));
      tray.show();
      showTab(tab);
      game.setBottomInset(tray.height());
      fitTrain(!game.cam.initialized);
      game.cam.initialized = true;

    },
    exit() {
      active = false;
      tray.hide();
      hideHint();
      setHighlight(null);
      feeder.clear();
      game.setBottomInset(0);
    },
    update(dt) {
      train.animate(dt, 0, false);
      feeder.update(dt, tab === 'food');
      // Tiere kommen dazu oder gehen: Kamera im Futter-Fach neu ausrichten
      const eaterCount = tab === 'food' ? feeder.eaters().length : -1;
      if (eaterCount !== lastEaterCount) {
        lastEaterCount = eaterCount;
        if (tab === 'food') fitTrain(false);
      }
      if (ws.highlight.visible) ws.highlight.material.opacity = 0.6 + Math.sin(game.time * 8) * 0.3;
      if (game.hint.due(IDLE_HINT_MS)) showHint();
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
