// Garten am Bauplatz: ein Beet vor dem Gebäude mit sechs Plätzen (Bedienung: modes/build.js, Fach „Garten“).
//
// - Säen: Pflanze in der Leiste antippen → ein Keimling steht im nächsten freien Platz.
// - Gießen: Pflanze im Beet antippen → die Gießkanne kommt und gießt, die Pflanze wächst eine Stufe.
// - Ernten: reife Pflanze antippen → die Frucht hüpft in den Korb. Aus dem Korb kann man die Bewohner füttern.
// Gespeichert wird zusammen mit dem Bauplatz (buildSite.js): { beds: [{ id, st } | null], basket: { futter: anzahl } }.

import * as THREE from 'three';
import { buildFood } from './foods.js';
import { buildFigure } from './figures.js';

// Pflanze → was man erntet (Futter aus catalog.js)
export const PLANTS = {
  karotte: { food: 'karotte' },
  apfel: { food: 'apfel' },
  banane: { food: 'banane' },
  sonnenblume: { food: 'koerner' },
  salat: { food: 'blatt' },
  gras: { food: 'heu' },
};
export const PLANT_IDS = Object.keys(PLANTS);
export const SPOTS = 6;
// Tierstation: bis zu drei Tiere stehen vor dem Beet. Kuh und Huhn geben etwas (nach einer Pause).
export const STABLE_ANIMALS = ['kuh', 'schaf', 'schwein', 'pferd', 'hund', 'katze', 'huhn', 'hase', 'ente'];
export const ANIMAL_PRODUCTS = { kuh: 'milch', huhn: 'ei' };
const STABLE_MAX = 3;
const ANIMAL_X = [-1.3, 0, 1.3];
const ANIMAL_Z = [1.35, 1.35, 1.35]; // vor dem Beet, nicht mehr auf den Pflanzen
const READY_MS = 40_000; // so lange dauert es, bis das Tier wieder etwas gibt
export const RIPE = 3; // Stufen: 0 Keimling, 1 klein, 2 groß, 3 reif
const BASKET_MAX = 9;
const AT = [3.0, -0.4]; // rechts neben dem Haus (lokal zum Bauplatz), das Beet steht quer zur Strecke // Mitte des Beets, lokal zum Bauplatz
const SPOT_X = (i) => -1.5 + i * 0.6;
const BASKET_X = -2.5;
const CAN_X = 2.45;

const mats = {};
const mat = (color, roughness = 0.8, extra = {}) => (mats[color + roughness + (extra.side ?? '')] ??= new THREE.MeshStandardMaterial({ color, roughness, ...extra }));
const geos = {};
const geo = (key, make) => (geos[key] ??= make());
function add(parent, geometry, color, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geometry, typeof color === 'string' ? mat(color) : color);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}
const ball = (r) => geo(`s${r}`, () => new THREE.SphereGeometry(r, 14, 10));
const cyl = (rt, rb, h, seg = 10) => geo(`c${rt},${rb},${h},${seg}`, () => new THREE.CylinderGeometry(rt, rb, h, seg));
const cone = (r, h, seg = 8) => geo(`k${r},${h},${seg}`, () => new THREE.ConeGeometry(r, h, seg));
const boxG = (w, h, d) => geo(`b${w},${h},${d}`, () => new THREE.BoxGeometry(w, h, d));
// flaches, rundes Blatt (liegt in der x-y-Ebene, Stiel am Ursprung)
const leafG = (len, w) => geo(`l${len},${w}`, () => {
  const g = new THREE.SphereGeometry(0.5, 10, 6);
  g.scale(w, len, 0.12);
  g.translate(0, len / 2, 0);
  return g;
});

const GREEN = '#4fa65a';
const DARKGREEN = '#3c8a47';
const LIGHTGREEN = '#8fce5c';

// Blätter im Kreis um einen Punkt (nach außen geneigt)
function ring(parent, n, len, w, tilt, color, y = 0, r = 0) {
  for (let i = 0; i < n; i++) {
    const h = new THREE.Group();
    h.rotation.y = (i / n) * Math.PI * 2 + 0.3;
    h.position.y = y;
    const l = add(h, leafG(len, w), color, 0, 0, r);
    l.rotation.x = tilt;
    parent.add(h);
  }
}

const BUILD = {
  karotte(g, fruit) {
    // Büschel aus Möhrengrün; reif schauen die orangen Köpfe aus der Erde
    for (const [x, z] of [[-0.12, 0.05], [0.12, -0.04], [0, 0.14]]) {
      const tuft = new THREE.Group();
      tuft.position.set(x, 0, z);
      ring(tuft, 5, 0.34, 0.1, 0.45, GREEN);
      add(tuft, cone(0.05, 0.3, 6), LIGHTGREEN, 0, 0.15, 0);
      g.add(tuft);
      add(fruit, cyl(0.07, 0.06, 0.08, 10), '#f07a1f', x, 0.03, z);
    }
  },
  apfel(g, fruit) {
    add(g, cyl(0.05, 0.075, 0.55, 8), '#8a5a33', 0, 0.27, 0);
    add(g, ball(0.34), GREEN, 0, 0.78, 0);
    add(g, ball(0.24), DARKGREEN, 0.2, 0.66, 0.08);
    add(g, ball(0.22), LIGHTGREEN, -0.18, 0.72, 0.1);
    for (const [x, y, z] of [[0.05, 0.7, 0.33], [-0.24, 0.84, 0.2], [0.27, 0.86, 0.15], [0.3, 0.58, 0.22], [-0.2, 0.6, 0.28]]) add(fruit, ball(0.075), mat('#e03a3e', 0.35), x, y, z);
  },
  banane(g, fruit) {
    for (let i = 0; i < 4; i++) add(g, cyl(0.055 - i * 0.006, 0.065 - i * 0.006, 0.17, 8), i % 2 ? '#9cae54' : '#86a04a', 0, 0.085 + i * 0.165, 0);
    ring(g, 6, 0.62, 0.26, 0.95, GREEN, 0.66);
    ring(g, 3, 0.4, 0.18, 0.3, LIGHTGREEN, 0.68);
    for (let i = 0; i < 5; i++) {
      const b = add(fruit, geo('banana', () => new THREE.TorusGeometry(0.11, 0.03, 6, 10, Math.PI * 0.75)), mat('#f5d33a', 0.5), 0.1, 0.5, 0.06);
      b.rotation.set(0, (i - 2) * 0.5, -1.9);
    }
  },
  sonnenblume(g, fruit) {
    add(g, cyl(0.025, 0.035, 0.95, 6), DARKGREEN, 0, 0.475, 0);
    for (const [y, a] of [[0.3, 0.4], [0.5, 2.6], [0.68, 4.6]]) {
      const h = new THREE.Group();
      h.position.y = y;
      h.rotation.y = a;
      add(h, leafG(0.26, 0.16), GREEN).rotation.x = 1.1;
      g.add(h);
    }
    add(g, ball(0.07), LIGHTGREEN, 0, 0.97, 0.02); // Knospe (bleibt hinter der Blüte)
    const head = new THREE.Group();
    head.position.set(0, 0.98, 0.05);
    head.rotation.x = -0.25;
    for (let i = 0; i < 12; i++) {
      const p = add(head, leafG(0.2, 0.09), mat('#f7c821', 0.5), 0, 0, 0);
      p.rotation.z = (i / 12) * Math.PI * 2;
      p.position.set(-Math.sin(p.rotation.z) * 0.1, Math.cos(p.rotation.z) * 0.1, 0);
    }
    add(head, geo('sunDisc', () => new THREE.CylinderGeometry(0.13, 0.13, 0.06, 16).rotateX(Math.PI / 2)), '#6b4423', 0, 0, 0.02);
    fruit.add(head);
  },
  salat(g, fruit) {
    ring(g, 7, 0.24, 0.2, 1.1, GREEN, 0.02);
    ring(g, 5, 0.2, 0.17, 0.6, LIGHTGREEN, 0.05);
    add(fruit, ball(0.11), mat('#b5e07a', 0.7), 0, 0.12, 0).scale.y = 0.85;
    ring(fruit, 6, 0.3, 0.24, 1.25, DARKGREEN, 0.01);
  },
  gras(g, fruit) {
    for (let i = 0; i < 9; i++) {
      const a = i * 2.4;
      const r = 0.05 + (i % 3) * 0.06;
      const b = add(g, cone(0.035, 0.42 + (i % 4) * 0.06, 5), i % 2 ? GREEN : LIGHTGREEN, Math.cos(a) * r, 0.22, Math.sin(a) * r);
      b.rotation.set(Math.sin(a) * 0.25, 0, -Math.cos(a) * 0.25);
    }
    // reif: goldene Ähren
    for (let i = 0; i < 5; i++) {
      const a = i * 1.3 + 0.4;
      add(fruit, cyl(0.012, 0.012, 0.62, 4), '#d9b84a', Math.cos(a) * 0.1, 0.31, Math.sin(a) * 0.1);
      add(fruit, ball(0.045), '#e9c96b', Math.cos(a) * 0.1, 0.64, Math.sin(a) * 0.1).scale.y = 1.9;
    }
  },
};

// Pflanze in einer Wachstumsstufe (steht auf y = 0)
export function plantModel(id, stage = RIPE) {
  const g = new THREE.Group();
  if (stage <= 0) {
    // Keimling: Stiel mit zwei Blättchen (bei allen gleich)
    add(g, cyl(0.015, 0.02, 0.14, 5), LIGHTGREEN, 0, 0.07, 0);
    for (const s of [1, -1]) {
      const l = add(g, leafG(0.13, 0.09), LIGHTGREEN, 0, 0.13, 0);
      l.rotation.z = s * 1.0;
    }
    return g;
  }
  const body = new THREE.Group();
  const fruit = new THREE.Group();
  BUILD[id](body, fruit);
  if (stage >= RIPE) body.add(fruit);
  body.scale.setScalar([0, 0.45, 0.78, 1][Math.min(stage, RIPE)]);
  g.add(body);
  return g;
}

// Für die Vorschaubilder: reife Pflanze, auf gleiche Bildgröße gebracht
export function plantPreview(id) {
  const p = plantModel(id, RIPE);
  const bb = new THREE.Box3().setFromObject(p);
  const size = bb.getSize(new THREE.Vector3());
  const k = 1 / Math.max(size.x, size.y, size.z, 0.01);
  const c = bb.getCenter(new THREE.Vector3()).multiplyScalar(k);
  p.scale.setScalar(k);
  p.position.set(-c.x, -c.y, -c.z);
  const g = new THREE.Group();
  g.add(p);
  return g;
}

function cleanData(d) {
  const animals = (d?.animals ?? []).filter((a) => STABLE_ANIMALS.includes(a?.id)).slice(0, STABLE_MAX)
    .map((a) => ({ id: a.id, ready: +a.ready || 0 }));
  const products = {};
  for (const p of Object.values(ANIMAL_PRODUCTS)) products[p] = Math.max(0, Math.min(9, d?.products?.[p] | 0));
  const beds = Array.from({ length: SPOTS }, (_, i) => {
    const b = d?.beds?.[i];
    return b && PLANTS[b.id] ? { id: b.id, st: Math.max(0, Math.min(RIPE, b.st | 0)) } : null;
  });
  const basket = {};
  for (const id of PLANT_IDS) {
    const food = PLANTS[id].food;
    const n = Math.max(0, Math.min(BASKET_MAX, d?.basket?.[food] | 0));
    if (n) basket[food] = n;
  }
  return { beds, basket, animals, products };
}

export class Garden {
  constructor(site, saved) {
    this.site = site;
    this.game = site.game;
    this.data = cleanData(saved);
    this.busy = false;
    this.drops = [];
    this.plants = Array(SPOTS).fill(null);
    this.onChange = null;
    this.figs = []; // Tiere im Stall (nur zum Anzeigen, nicht gespeichert)

    const g = new THREE.Group();
    g.position.copy(site.at(...AT));
    g.rotation.y = site.rot + Math.PI / 2;
    g.userData.site = 'garden';
    g.userData.siteRef = site;
    this.group = g;
    // Beet: Holzrahmen, dunkle Erde, sechs kleine Hügel
    const wood = mat('#b98a56', 0.9);
    add(g, boxG(3.9, 0.16, 1.0), wood, 0, 0.08, 0);
    add(g, boxG(3.74, 0.06, 0.84), mat('#6b4a32', 1), 0, 0.15, 0);
    this.spots = [];
    for (let i = 0; i < SPOTS; i++) {
      const spot = new THREE.Group();
      spot.position.set(SPOT_X(i), 0.17, 0);
      spot.userData.spot = i;
      const mound = add(spot, ball(0.2), mat('#7a5539', 1), 0, -0.02, 0);
      mound.scale.set(1.2, 0.35, 1.2);
      mound.castShadow = false;
      g.add(spot);
      this.spots.push(spot);
    }
    // Korb links
    const basket = new THREE.Group();
    basket.position.set(BASKET_X, 0, 0.05);
    add(basket, cyl(0.34, 0.26, 0.3, 14), mat('#c9a36b', 0.9), 0, 0.15, 0);
    add(basket, geo('rim', () => new THREE.TorusGeometry(0.34, 0.035, 6, 18).rotateX(Math.PI / 2)), mat('#a9824f', 0.9), 0, 0.3, 0);
    add(basket, cyl(0.3, 0.3, 0.02, 14), mat('#8a6a42', 1), 0, 0.2, 0);
    this.basketItems = new THREE.Group();
    basket.add(this.basketItems);
    g.add(basket);
    this.basket = basket;
    this.animalGroup = new THREE.Group();
    g.add(this.animalGroup);
    // Gießkanne rechts
    const can = new THREE.Group();
    const blue = mat('#3b9ad9', 0.35);
    add(can, cyl(0.17, 0.19, 0.3, 14), blue, 0, 0.15, 0);
    const spout = add(can, cyl(0.03, 0.045, 0.36, 8), blue, -0.27, 0.22, 0);
    spout.rotation.z = 0.95;
    const rose = add(can, cyl(0.07, 0.03, 0.06, 10), mat('#f2c832', 0.4), -0.43, 0.33, 0);
    rose.rotation.z = 0.95;
    const handle = add(can, geo('handle', () => new THREE.TorusGeometry(0.13, 0.025, 6, 12, Math.PI)), blue, 0.18, 0.17, 0);
    handle.rotation.z = -Math.PI / 2;
    this.canHome = new THREE.Vector3(CAN_X, 0, 0.05);
    can.position.copy(this.canHome);
    g.add(can);
    this.can = can;

    site.land.scene.add(g);
    site.land.tappable.push(g);
    for (let i = 0; i < SPOTS; i++) this.showPlant(i);
    this.showBasket();
    this.showAnimals();
  }

  // Tiere vor dem Beet aufstellen (gespeichert wird nur die Art, nicht das Modell)
  showAnimals() {
    this.animalGroup.clear();
    this.figs = this.data.animals.map((a, i) => {
      const f = buildFigure(a.id);
      f.userData.animal = i;
      f.position.set(ANIMAL_X[i], 0, ANIMAL_Z[i]);
      this.animalGroup.add(f);
      return f;
    });
  }

  // Welches Tier (Nummer) steckt hinter diesem Objekt? -1 = keins
  animalAt(obj) {
    let o = obj;
    while (o && o.userData.animal === undefined) o = o.parent;
    return o ? o.userData.animal : -1;
  }

  addAnimal(id) {
    if (this.busy || !STABLE_ANIMALS.includes(id) || this.data.animals.length >= STABLE_MAX) return false;
    this.data.animals.push({ id, ready: 0 });
    this.showAnimals();
    this.game.popIn(this.figs[this.figs.length - 1]);
    this.game.services.sfx('plop');
    this.changed();
    return true;
  }

  // Kuh gibt Milch, Huhn ein Ei – aber nur einmal alle 40 Sekunden. Gibt das Produkt zurück oder null.
  produce(i) {
    const a = this.data.animals[i];
    const p = a && ANIMAL_PRODUCTS[a.id];
    if (!p || Date.now() < a.ready) return null;
    a.ready = Date.now() + READY_MS;
    this.data.products[p] = Math.min(9, this.data.products[p] + 1);
    this.changed();
    return p;
  }

  get full() {
    return this.data.beds.every(Boolean);
  }

  get centre() {
    return this.group.position;
  }

  changed() {
    this.site.save();
    this.onChange?.();
  }

  showPlant(i, pop = false) {
    const spot = this.spots[i];
    if (this.plants[i]) spot.remove(this.plants[i]);
    const b = this.data.beds[i];
    this.plants[i] = b ? plantModel(b.id, b.st) : null;
    if (!b) return;
    spot.add(this.plants[i]);
    if (pop) this.game.popIn(this.plants[i]);
  }

  // Korb: bis zu sieben Früchte liegen sichtbar obenauf
  showBasket() {
    this.basketItems.clear();
    const all = Object.entries(this.data.basket).flatMap(([food, n]) => Array(n).fill(food)).slice(0, 7);
    all.forEach((food, i) => {
      const f = buildFood(food);
      const a = i * 2.4;
      const r = i ? 0.17 : 0;
      f.scale.setScalar(0.55);
      f.position.set(Math.cos(a) * r, 0.22 + (i > 3 ? 0.09 : 0), Math.sin(a) * r);
      f.rotation.y = a;
      this.basketItems.add(f);
    });
  }

  // Säen: Keimling in den nächsten freien Platz. false = Beet ist voll
  sow(id) {
    if (this.busy || !PLANTS[id]) return false;
    const i = this.data.beds.findIndex((b) => !b);
    if (i < 0) return false;
    this.data.beds[i] = { id, st: 0 };
    this.showPlant(i, true);
    this.game.services.sfx('plop');
    this.changed();
    return true;
  }

  // Welcher Platz wurde getroffen? Großzügig: der nächste Platz mit einer Pflanze zählt
  spotAt(point) {
    const local = this.group.worldToLocal(point.clone());
    let best = -1;
    let bestD = 0.7;
    this.data.beds.forEach((b, i) => {
      const d = Math.abs(SPOT_X(i) - local.x);
      if (b && d < bestD) {
        bestD = d;
        best = i;
      }
    });
    return best;
  }

  // Pflanze antippen: gießen (wächst) oder – wenn reif – ernten
  tap(i) {
    const b = this.data.beds[i];
    if (this.busy || !b) return false;
    if (b.st >= RIPE) this.harvest(i);
    else this.water(i);
    return true;
  }

  water(i) {
    const g = this.game;
    const b = this.data.beds[i];
    this.busy = true;
    const from = this.can.position.clone();
    const over = new THREE.Vector3(SPOT_X(i) + 0.5, 0.95, 0.05);
    g.services.sfx('whoosh');
    g.tween(0.4, (t) => {
      this.can.position.lerpVectors(from, over, t);
      this.can.position.y += Math.sin(t * Math.PI) * 0.3;
    }, () => {
      g.services.sfx('gurgle');
      g.tween(0.75, (t) => {
        this.can.rotation.z = Math.sin(Math.min(1, t * 3) * Math.PI / 2) * 0.6;
        if (Math.random() < 0.7) this.drop(i);
      }, () => {
        b.st += 1;
        this.showPlant(i, true);
        g.services.sfx(b.st >= RIPE ? 'chime' : 'pop');
        this.changed();
        g.tween(0.4, (t) => {
          this.can.rotation.z = 0.6 * (1 - t);
          this.can.position.lerpVectors(over, this.canHome, t);
          this.can.position.y += Math.sin(t * Math.PI) * 0.3;
        }, () => {
          this.busy = false;
          this.onChange?.();
        });
      });
    });
  }

  drop(i) {
    const m = new THREE.Mesh(ball(0.03), mat('#6cc3f5', 0.2));
    m.position.set(SPOT_X(i) + 0.08 + (Math.random() - 0.5) * 0.14, 1.0, 0.05 + (Math.random() - 0.5) * 0.14);
    this.group.add(m);
    this.drops.push({ m, v: -0.6 - Math.random() * 0.5 });
  }

  harvest(i) {
    const g = this.game;
    const b = this.data.beds[i];
    const food = PLANTS[b.id].food;
    this.busy = true;
    const plant = this.plants[i];
    const fruit = buildFood(food);
    const from = new THREE.Vector3(SPOT_X(i), 0.6, 0);
    const to = new THREE.Vector3(BASKET_X, 0.4, 0.05);
    fruit.position.copy(from);
    this.group.add(fruit);
    g.services.sfx('pop');
    g.services.sayName(food);
    g.tween(0.3, (t) => plant.scale.setScalar(Math.max(0.001, 1 - t)));
    g.tween(0.65, (t) => {
      fruit.position.lerpVectors(from, to, t);
      fruit.position.y += Math.sin(t * Math.PI) * 1.0;
      fruit.rotation.y = t * 6;
      fruit.scale.setScalar(1.2 - t * 0.6);
    }, () => {
      this.group.remove(fruit);
      this.data.beds[i] = null;
      this.showPlant(i);
      this.data.basket[food] = Math.min(BASKET_MAX, (this.data.basket[food] ?? 0) + 1);
      this.showBasket();
      g.services.sfx('pling');
      g.popIn(this.basketItems);
      this.busy = false;
      this.changed();
    });
  }

  // Eine Frucht aus dem Korb nehmen (zum Füttern). Gibt die Stelle des Korbs in der Welt zurück oder null
  take(food) {
    if (!this.data.basket[food]) return null;
    this.data.basket[food] -= 1;
    if (!this.data.basket[food]) delete this.data.basket[food];
    this.showBasket();
    this.changed();
    return this.basketWorld();
  }

  basketWorld() {
    return this.basket.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, 0.4, 0));
  }

  update(dt) {
    const t = this.game.time;
    // reife Pflanzen wippen: „Pflück mich!“
    this.data.beds.forEach((b, i) => {
      const p = this.plants[i];
      if (p) p.rotation.z = b.st >= RIPE ? Math.sin(t * 3 + i) * 0.07 : 0;
    });
    for (let k = this.drops.length - 1; k >= 0; k--) {
      const d = this.drops[k];
      d.v -= dt * 6;
      d.m.position.y += d.v * dt;
      if (d.m.position.y < 0.2) {
        this.group.remove(d.m);
        this.drops.splice(k, 1);
      }
    }
  }
}
