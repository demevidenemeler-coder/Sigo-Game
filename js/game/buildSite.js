// Baustelle an der Strecke: Hier baut das Kind aus vielen Teilen ein eigenes Gebäude – Haus, Burg, Zirkuszelt,
// Rakete, Laden oder Märchenhaus, frei gemischt (Teile: buildParts.js, Bedienung: modes/build.js).
//
// Das Gebäude ist nur eine kleine Beschreibung (state): Stockwerke, Fenster, Tür, Dach, Spitze, Schmuck.
// Nach jeder Änderung wird das Modell daraus neu zusammengesetzt; das neue Teil fliegt vom Steinstapel heran.
// Teil antippen → andere Farbe. Bagger → alles wird abgerissen (es poltert und staubt).

import * as THREE from 'three';
import { LAYOUT, contactShadow } from './zones.js';
import {
  H, MAX_LEVELS, MAX_WINGS, THEMES, PAL, LEVELS, DOORS, ROOFS, TOPS, WINGS, FOLK, MAX_FOLK, catOf, themeOf, footprint, windowSlots, attachFront,
  levelModel, windowModel, doorModel, roofModel, topModel, decoModel, wingModel, PATTERNS, patternShell,
} from './buildParts.js';
import { buildFigure } from './figures.js';
import { wave } from './trainModel.js';
import { Garden } from './garden.js';
import './buildMore.js'; // weitere Themen tragen sich in die Verzeichnisse ein

const KEY = 'sigo.site.v3';
const SCALE = 1.15;
const EMPTY = () => ({ L: [], win: null, pat: null, door: null, roof: null, top: null, deco: [], wings: [], folk: [] });
const PEOPLE = ['kind', 'oma', 'papa', 'teddy']; // werden benannt, Tiere rufen
const STAY = ['x_ecktuerme', 'x_hai']; // Schmuck, der auch neben einem Anbau an seinem Platz bleibt
const DIGGER_AT = [-4.9, 1.2]; // Bagger und Steinstapel (lokal zum Bauplatz); rücken bei Anbauten nach außen
const PILE_AT = [4.1, 2.4]; // Steinstapel: vorne rechts, neben dem Beet (das liegt rechts hinten)
const DEFS = { door: DOORS, roof: ROOFS, top: TOPS };

function load(key) {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? {};
  } catch {
    return {};
  }
}

function box(parent, w, h, d, material, x, y, z, shadow = true) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  m.position.set(x, y, z);
  m.castShadow = shadow;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}

const std = (color, roughness = 0.8) => new THREE.MeshStandardMaterial({ color, roughness });

// Gespeicherten Stand prüfen: unbekannte Teile (z. B. aus einer älteren Fassung) fallen weg
function clean(s) {
  const out = EMPTY();
  if (!s || !Array.isArray(s.L)) return out;
  out.L = s.L.filter((l) => LEVELS[l?.id]).slice(0, MAX_LEVELS).map((l) => ({ id: l.id, c: l.c | 0 }));
  if (!out.L.length) return out;
  if (catOf(s.win ?? '') === 'windows') out.win = s.win;
  if (PATTERNS.includes(s.pat)) out.pat = s.pat;
  for (const k of ['door', 'roof', 'top']) if (s[k] && DEFS[k][s[k].id]) out[k] = { id: s[k].id, c: s[k].c | 0 };
  if (!out.roof) out.top = null;
  out.deco = (s.deco ?? []).filter((id) => Object.values(THEMES).some((t) => t.decos.includes(id)));
  out.wings = (s.wings ?? []).filter((w) => WINGS[w?.id]).slice(0, MAX_WINGS).map((w) => ({ id: w.id, c: w.c | 0, side: w.side < 0 ? -1 : 1 }));
  out.folk = (s.folk ?? []).filter((id) => FOLK.includes(id)).slice(0, MAX_FOLK);
  return out;
}

// Wie breit sind die Anbauten auf dieser Seite zusammen (-1 links, 1 rechts)? 0 = keiner
function wingWidth(state, side) {
  const ws = state.wings.filter((x) => x.side === side);
  return ws.length ? ws.reduce((sum, w) => sum + (WINGS[w.id].w ?? 1.4) + 0.05, 0.1) : 0;
}

// Gebäude aus seiner Beschreibung zusammensetzen: hängt die Teile in „house“ ein und gibt zurück, was die Baustelle
// zum Antippen und Bewegen braucht. Wird auch für die Bilder im Album benutzt.
export function assemble(s, house, glass) {
  const parts = new Map();
  const anims = [];
  let figures = [];
  const slot = (key, model) => {
    const o = new THREE.Group();
    o.userData.key = key;
    o.add(model);
    house.add(o);
    parts.set(key, o);
    if (model.userData.anim) anims.push(model.userData.anim);
    return o;
  };
  const color = (def, c) => PAL[def.pal][c % PAL[def.pal].length];
  let y = 0;
  const fps = [];
  s.L.forEach((L, i) => {
    const fp = footprint(L.id);
    fps.push(fp);
    const m = levelModel(L.id, color(LEVELS[L.id], L.c));
    m.position.y = y;
    if (s.win) for (const x of windowSlots(fp, i === 0)) attachFront(m, windowModel(s.win, glass), fp, x, i === 0 ? 0.74 : 0.62);
    if (s.pat) m.add(patternShell(s.pat, L.id));
    slot(`L${i}`, m);
    y += H;
  });
  const fp0 = fps[0];
  const fpTop = fps.at(-1);
  let apex = 0;
  if (fp0) {
    if (s.door) {
      const w = new THREE.Group();
      attachFront(w, doorModel(s.door.id, color(DOORS[s.door.id], s.door.c)), fp0, 0, 0, 0);
      slot('door', w);
    }
    let chimney = [0, 0, 0];
    if (s.roof) {
      const top = s.L.at(-1);
      const m = roofModel(s.roof.id, fpTop, color(ROOFS[s.roof.id], s.roof.c), color(LEVELS[top.id], top.c));
      m.position.y = y;
      apex = m.userData.apex;
      chimney = m.userData.chimney;
      slot('roof', m);
    }
    if (s.top && s.roof) {
      const def = TOPS[s.top.id];
      const m = topModel(s.top.id, def.pal ? color(def, s.top.c) : undefined);
      if (m.userData.onRoof) m.position.set(chimney[0], y + chimney[1], chimney[2]);
      else m.position.y = y + apex;
      slot('top', m);
    }
    const ctx = { fp0, fpTop, topY: y, apexY: y + apex, slots: windowSlots(fp0, true), glass: glass };
    const f0 = fp0.round ? fp0.r : fp0.d / 2;
    for (const id of s.deco) {
      const m = decoModel(id, ctx);
      // Bodenschmuck neben dem Haus rückt nach außen, wenn dort ein Anbau steht
      if (!STAY.includes(id)) {
        for (const n of m.children) {
          const side = Math.sign(n.position.x);
          if (!n.userData.ground || Math.abs(n.position.x) < fp0.half * 0.9 || n.position.z > f0 + 0.6) continue;
          n.position.x += side * wingWidth(s, side);
        }
      }
      slot(`x:${id}`, m);
    }
    // Anbauten links und rechts am untersten Stockwerk (links gespiegelt)
    const roofColor = s.roof ? color(ROOFS[s.roof.id], s.roof.c) : PAL.roof[0];
    const used = { 1: 0, [-1]: 0 }; // schon belegte Breite je Seite: der zweite Anbau steht außen neben dem ersten
    s.wings.forEach((w, i) => {
      const def = WINGS[w.id];
      const m = wingModel(w.id, def.pal ? color(def, w.c) : '#ffffff', roofColor, glass);
      const holder = new THREE.Group();
      holder.position.x = w.side * (fp0.half - 0.04 + used[w.side]);
      used[w.side] += (def.w ?? 1.4) + 0.05;
      holder.scale.x = w.side;
      holder.add(m);
      holder.userData.anim = m.userData.anim;
      slot(`w:${i}`, holder);
    });
    // Bewohner stehen vor dem Haus
    figures = s.folk.map((id, i) => {
      const fig = buildFigure(id);
      fig.scale.setScalar(1.1);
      const [px, pz] = [[0.85, 0.7], [-0.85, 0.75], [1.55, 1.4], [-1.6, 1.35], [2.35, 0.95], [-2.4, 1.0]][i];
      const holder = new THREE.Group();
      holder.position.set(px, 0, f0 + pz);
      holder.rotation.y = -px * 0.2;
      holder.add(fig);
      slot(`p:${i}`, holder);
      return fig;
    });
  }
  return { parts, anims, figures, height: y + apex + (s.top ? 0.9 : 0), front: fp0 ? (fp0.round ? fp0.r : fp0.d / 2) : 0.9 };
}

// Album-Bild: ein ganzes Gebäude, auf gleiche Größe gebracht
export function housePreview(json) {
  const house = new THREE.Group();
  assemble(clean(JSON.parse(json)), house, new THREE.MeshStandardMaterial({ color: '#9fd0ee', roughness: 0.2 }));
  const g = new THREE.Group();
  const bb = new THREE.Box3().setFromObject(house);
  const size = bb.getSize(new THREE.Vector3());
  const k = 1 / Math.max(size.x, size.y, size.z, 0.01);
  const c = bb.getCenter(new THREE.Vector3()).multiplyScalar(k);
  house.scale.setScalar(k);
  house.position.set(-c.x, -c.y, -c.z);
  g.add(house);
  g.rotation.y = -0.45;
  return g;
}

export class BuildSite {
  // cfg: Lage des Bauplatzes ({ x, z, rot }), index: der wievielte Bauplatz (jeder hat seinen eigenen Speicherstand)
  constructor(game, cfg, index = 0) {
    this.game = game;
    this.land = game.land;
    this.index = index;
    this.key = index ? `${KEY}.${index}` : KEY;
    const saved = load(this.key);
    this.state = clean(saved.s);
    this.used = !!saved.used;
    this.history = [];
    this.busy = false;
    this.smoke = 0;
    this.greet = 0;
    this.figures = [];
    this.parts = new Map();
    this.anims = [];
    this.height = 0;
    this.glass = new THREE.MeshStandardMaterial({ color: '#9fd0ee', roughness: 0.2, emissive: '#f7d98a', emissiveIntensity: 0 });
    this.mats = { stone: std('#b9b1a3'), brick: std('#b9644a'), yellow: std('#f2b824', 0.5), dark: std('#3a3f47', 0.7) };

    const { x, z, rot } = cfg;
    this.rot = rot;
    this.center = new THREE.Vector3(x, 0, z);
    // Lokale Bauplatz-Koordinaten (x nach rechts, z nach vorne) → Welt
    this.at = (lx, lz, y = 0) => new THREE.Vector3(x + lx * Math.cos(rot) + lz * Math.sin(rot), y, z - lx * Math.sin(rot) + lz * Math.cos(rot));

    this.plot = this.makePlot();
    this.house = new THREE.Group();
    this.house.scale.setScalar(SCALE);
    this.digger = this.makeDigger();
    for (const [o, lx, lz, kind] of [[this.plot, 0, 0, 'plot'], [this.house, -0.2, -0.15, 'house'], [this.digger, ...DIGGER_AT, 'digger']]) {
      o.position.copy(this.at(lx, lz));
      o.rotation.y = rot;
      o.userData.site = kind;
      o.userData.siteRef = this;
      this.land.scene.add(o);
      this.land.tappable.push(o);
    }
    this.pileAt = new THREE.Vector3(PILE_AT[0], 0.3, PILE_AT[1]); // lokal zum Bauplatz
    this.garden = new Garden(this, saved.g); // Beet vor dem Gebäude (garden.js)
    this.rebuild();
  }

  save() {
    try {
      localStorage.setItem(this.key, JSON.stringify({ s: this.state, used: this.used, g: this.garden?.data }));
    } catch { /* ohne Speicher geht es trotzdem */ }
  }

  markUsed() {
    if (this.used) return;
    this.used = true;
    this.save();
  }

  get empty() {
    return this.state.L.length === 0;
  }

  // ---------- Regeln ----------

  // Passt dieses Teil gerade? (Stockwerke nur ohne Dach, alles andere braucht eine Mauer, Spitzen ein Dach)
  can(id) {
    const s = this.state;
    const cat = catOf(id);
    if (cat === 'levels') return !s.roof && s.L.length < MAX_LEVELS;
    if (cat === 'tops') return !!s.roof;
    return s.L.length > 0;
  }

  // Wird dieses Teil gerade verwendet? (für die Markierung in der Leiste)
  has(id) {
    const s = this.state;
    return s.win === id || s.pat === id || s.door?.id === id || s.roof?.id === id || s.top?.id === id || s.deco.includes(id)
      || s.folk.includes(id) || s.wings.some((w) => w.id === id);
  }

  remember() {
    this.history.push(JSON.stringify(this.state));
    if (this.history.length > 60) this.history.shift();
  }

  // Teil einbauen. Gibt false zurück, wenn es gerade nicht passt.
  add(id) {
    if (this.busy || !this.can(id)) return false;
    const s = this.state;
    const cat = catOf(id);
    this.remember();
    let key = null;
    if (cat === 'levels') {
      s.L.push({ id, c: LEVELS[id].c });
      key = `L${s.L.length - 1}`;
    } else if (cat === 'windows') {
      s.win = s.win === id ? null : id;
    } else if (cat === 'paint') {
      s.pat = s.pat === id ? null : id;
    } else if (cat === 'decos') {
      if (s.deco.includes(id)) s.deco = s.deco.filter((d) => d !== id);
      else {
        s.deco.push(id);
        key = `x:${id}`;
      }
    } else if (cat === 'folk') {
      // Bewohner: antippen = einziehen oder wieder gehen; sind alle Plätze voll, geht der Erste
      if (s.folk.includes(id)) s.folk = s.folk.filter((f) => f !== id);
      else {
        if (s.folk.length >= MAX_FOLK) s.folk.shift();
        s.folk.push(id);
        key = `p:${s.folk.length - 1}`;
      }
    } else if (cat === 'wings') {
      // Anbau: abwechselnd rechts und links, bis zu zwei je Seite; ist alles voll, geht der älteste
      if (s.wings.some((w) => w.id === id)) s.wings = s.wings.filter((w) => w.id !== id);
      else {
        if (s.wings.length >= MAX_WINGS) s.wings.shift();
        const count = (sd) => s.wings.filter((w) => w.side === sd).length;
        const side = count(1) <= count(-1) ? 1 : -1;
        s.wings.push({ id, c: WINGS[id].c ?? 0, side });
        key = `w:${s.wings.length - 1}`;
      }
    } else {
      const slot = { doors: 'door', roofs: 'roof', tops: 'top' }[cat];
      s[slot] = { id, c: DEFS[slot][id].c ?? 0 };
      key = slot;
    }
    this.rebuild();
    this.save();
    if (key) this.flyIn(key);
    else {
      this.game.services.sfx((cat === 'windows' && s.win) || (cat === 'paint' && s.pat) ? 'hammer' : 'poof');
      this.squash(this.house, SCALE);
    }
    return true;
  }

  // Zustand als Text (für das Album)
  snapshot() {
    return JSON.stringify(this.state);
  }

  // Fertigen Entwurf (Vorlage oder eigenes Foto) auf diesen Bauplatz setzen
  loadDesign(json) {
    if (this.busy) return false;
    this.remember();
    this.state = clean(JSON.parse(json));
    this.rebuild();
    this.save();
    this.game.services.sfx('hammer');
    this.dust(new THREE.Vector3(0, this.height * 0.5 + 0.3, 0), 16);
    this.squash(this.house, SCALE);
    return true;
  }

  undo() {
    if (this.busy || !this.history.length) return false;
    this.state = JSON.parse(this.history.pop());
    this.rebuild();
    this.save();
    this.game.services.sfx('poof');
    this.dust(new THREE.Vector3(0, this.height * 0.6 + 0.4, 0), 10);
    this.squash(this.house, SCALE);
    return true;
  }

  // ---------- Modell aus der Beschreibung zusammensetzen ----------

  rebuild() {
    const s = this.state;
    for (const o of [...this.house.children]) {
      this.house.remove(o);
      o.traverse((m) => {
        if (!m.isMesh) return;
        m.geometry.dispose();
        if (m.material !== this.glass) m.material.dispose();
      });
    }
    const built = assemble(s, this.house, this.glass);
    this.parts = built.parts;
    this.anims = built.anims;
    this.figures = built.figures;
    this.front = built.front;
    this.height = built.height;
    this.wide = Math.max(this.wingWidth(1), this.wingWidth(-1)); // so viel breiter ist das Gebäude je Seite
    // Bagger (links) und Steinstapel (rechts) machen einem Anbau Platz
    if (this.digger && this.pile) {
      // höchstens ein Stück zur Seite (sonst stünden sie auf Gleis oder Straße), der Rest nach vorne
      const L = this.wingWidth(-1) * SCALE;
      const R = this.wingWidth(1) * SCALE;
      this.digger.position.copy(this.at(DIGGER_AT[0] - Math.min(L, 1.6), DIGGER_AT[1] + Math.max(0, L - 1.6) * 0.5));
      this.pile.position.set(PILE_AT[0] + Math.min(R, 1.4), 0, PILE_AT[1] + Math.max(0, R - 1.4) * 0.25);
      this.pileAt.set(this.pile.position.x, 0.3, this.pile.position.z);
    }
  }

  // Wie breit ist der Anbau auf dieser Seite (-1 links, 1 rechts)? 0 = keiner
  wingWidth(side) {
    return wingWidth(this.state, side);
  }

  // ---------- Modelle: Bauplatz und Bagger ----------

  makePlot() {
    const g = new THREE.Group();
    const m = this.mats;
    box(g, 5.4, 0.12, 4.0, m.stone, -0.2, 0.06, 0.15, false);
    // Steinstapel und ein paar Bretter
    const pile = new THREE.Group();
    pile.position.set(PILE_AT[0], 0, PILE_AT[1]);
    this.pile = pile;
    [[0, 0.11, 0, 0], [0.5, 0.11, 0.05, 0.1], [-0.5, 0.11, -0.03, -0.08], [0.25, 0.33, 0, 0.05], [-0.25, 0.33, 0.02, -0.04], [0, 0.55, 0, 0.12]]
      .forEach(([bx, by, bz, r]) => { box(pile, 0.46, 0.2, 0.3, m.brick, bx, by, bz).rotation.y = r; });
    const wood = std('#d9b47a');
    for (const [bz, r] of [[0.55, 0.15], [0.72, -0.1]]) box(pile, 1.3, 0.07, 0.14, wood, 0, 0.04, bz).rotation.y = r;
    g.add(pile);
    // Absperrung: Hütchen
    const cone = new THREE.ConeGeometry(0.13, 0.36, 10);
    const orange = std('#f0662c', 0.6);
    for (const [cx, cz] of [[-3.3, 2.6], [4.2, 0.4], [2.9, -2.3]]) {
      const c = new THREE.Mesh(cone, orange);
      c.position.set(cx, 0.18, cz);
      c.castShadow = true;
      g.add(c);
      box(g, 0.3, 0.03, 0.3, orange, cx, 0.015, cz, false);
    }
    const cs = contactShadow(1, 0.3);
    cs.scale.set(3.4, 1, 2.6);
    cs.position.set(-0.2, 0, 0.15);
    g.add(cs);
    return g;
  }

  // Bagger: Raupen, Oberteil mit Führerhaus, Ausleger, Stiel und Schaufel (zeigt nach +x zum Haus)
  makeDigger() {
    const g = new THREE.Group();
    const m = this.mats;
    for (const z of [-0.42, 0.42]) box(g, 1.5, 0.3, 0.3, m.dark, 0, 0.15, z);
    const top = new THREE.Group();
    top.position.y = 0.3;
    box(top, 1.15, 0.42, 0.85, m.yellow, -0.05, 0.25, 0);
    box(top, 0.52, 0.56, 0.5, m.yellow, -0.05, 0.74, 0.15);
    box(top, 0.42, 0.34, 0.52, std('#9fd0ee', 0.2), 0.02, 0.78, 0.15, false);
    box(top, 0.3, 0.3, 0.6, m.dark, -0.5, 0.56, -0.05);
    const boom = new THREE.Group();
    boom.position.set(0.4, 0.4, -0.2);
    box(boom, 1.35, 0.17, 0.17, m.yellow, 0.67, 0, 0);
    const stick = new THREE.Group();
    stick.position.set(1.3, 0, 0);
    box(stick, 0.95, 0.13, 0.13, m.yellow, 0.47, 0, 0);
    const bucket = box(stick, 0.34, 0.3, 0.36, m.dark, 0.98, -0.06, 0);
    bucket.rotation.z = 0.5;
    boom.add(stick);
    top.add(boom);
    g.add(top);
    const cs = contactShadow(1, 0.3);
    cs.scale.set(1.1, 1, 0.8);
    g.add(cs);
    g.scale.setScalar(1.25);
    Object.assign(this, { boom, stick });
    this.poseDigger(0);
    return g;
  }

  // k = 0: Arm ruht · k = 1: Arm weit ausgestreckt zum Haus
  poseDigger(k) {
    this.boom.rotation.z = 0.95 - k * 0.45;
    this.stick.rotation.z = -2.0 + k * 0.9;
  }

  // ---------- Antippen, Farben ----------

  // Welches Teil des Gebäudes wurde getroffen?
  keyOf(hit) {
    for (let n = hit; n && n !== this.house; n = n.parent) if (n.userData.key) return n.userData.key;
    return null;
  }

  // Teil antippen: nächste Farbe (Schmuck und feste Teile hüpfen nur)
  tapPart(key) {
    if (this.busy) return;
    const s = this.state;
    const g = this.game;
    let item = null;
    let def = null;
    if (key[0] === 'p') {
      // Bewohner: hüpft und ruft (Menschen werden benannt)
      const id = s.folk[+key.slice(2)];
      const fig = this.figures[+key.slice(2)];
      if (!id || !fig) return;
      g.hop(fig);
      if (fig.userData.waveArm) wave(fig, g);
      if (PEOPLE.includes(id)) g.services.sayName(id);
      else g.services.animalCall?.(id);
      return;
    }
    if (key[0] === 'L') {
      item = s.L[+key.slice(1)];
      def = LEVELS[item?.id];
    } else if (key[0] === 'w') {
      item = s.wings[+key.slice(2)];
      def = WINGS[item?.id];
    } else if (DEFS[key]) {
      item = s[key];
      def = DEFS[key][item?.id];
    }
    if (!item || !def?.pal) {
      g.services.sfx('pop');
      this.squash(this.parts.get(key), 1);
      return;
    }
    this.remember();
    item.c = (item.c + 1) % PAL[def.pal].length;
    this.rebuild();
    this.save();
    g.services.sfx('plop');
    this.squash(this.parts.get(key), 1);
  }

  squash(obj, s0) {
    if (!obj) return;
    this.game.tween(0.35, (t) => {
      const k = Math.sin(t * Math.PI);
      obj.scale.set(s0 * (1 + k * 0.06), s0 * (1 - k * 0.08), s0 * (1 + k * 0.06));
    }, () => obj.scale.setScalar(s0));
  }

  dust(local, n = 8, color = '#d8cdb8') {
    this.house.updateMatrixWorld(true);
    this.game.village.droplets(local.clone().applyMatrix4(this.house.matrixWorld), color, n);
  }

  centreOf(p) {
    this.house.updateMatrixWorld(true);
    return this.house.worldToLocal(new THREE.Box3().setFromObject(p).getCenter(new THREE.Vector3()));
  }

  // Neues Teil: fliegt vom Steinstapel im Bogen an seinen Platz und wird festgehämmert
  flyIn(key) {
    const g = this.game;
    const p = this.parts.get(key);
    if (!p) return;
    this.busy = true;
    this.plot.updateMatrixWorld(true);
    const centre = this.centreOf(p);
    const from = this.house.worldToLocal(this.pileAt.clone().applyMatrix4(this.plot.matrixWorld)).sub(centre);
    g.services.sfx('whoosh');
    g.tween(0.55, (t) => {
      const e = t * t * (3 - 2 * t);
      p.position.copy(from).multiplyScalar(1 - e);
      p.position.y += Math.sin(t * Math.PI) * 1.4;
      p.scale.setScalar(0.25 + 0.75 * e);
      p.rotation.y = (1 - e) * 2.5;
    }, () => {
      p.position.set(0, 0, 0);
      p.rotation.y = 0;
      g.services.sfx('hammer');
      this.dust(centre, 6);
      g.tween(0.28, (t) => {
        const k = Math.sin(t * Math.PI);
        p.scale.set(1 + k * 0.08, 1 - k * 0.1, 1 + k * 0.08);
      }, () => {
        p.scale.setScalar(1);
        this.busy = false;
      });
    });
  }

  // Richtfest: Glitzern, Sterne – und jemand zieht ein
  celebrate() {
    if (this.busy || this.empty) return false;
    const g = this.game;
    g.services.sfx('chime');
    setTimeout(() => g.services.sfx('sparkle'), 350);
    for (const [dy, n] of [[0.5, 18], [-0.6, 10]]) this.dust(new THREE.Vector3(0, Math.max(0.8, this.height + dy), 0), n, '#f7d64a');
    this.squash(this.house, SCALE);
    const ids = THEMES[themeOf(this.state.L[0].id)].visitors;
    // wohnt schon jemand hier, jubeln die Bewohner – sonst zieht jemand ein
    if (this.figures.length) {
      this.figures.forEach((fig, i) => setTimeout(() => {
        if (!fig.parent) return;
        g.hop(fig);
        if (fig.userData.waveArm) wave(fig, g);
      }, 300 + i * 160));
    } else {
      setTimeout(() => g.village.visitor(this.house, { id: ids[Math.floor(Math.random() * ids.length)], door: this.front + 0.55, scale: 1.5, sound: null }), 700);
    }
    this.fireworks();
    return true;
  }

  // Feuerwerk: Raketen steigen hinter dem Gebäude auf und zerplatzen in bunten Funken
  fireworks() {
    const g = this.game;
    const colors = ['#ff5a5f', '#ffd23f', '#4fc3f7', '#7ee081', '#c792ea', '#ff9f43'];
    const geo = this.sparkGeo ??= new THREE.SphereGeometry(0.09, 8, 6);
    for (let i = 0; i < 6; i++) {
      setTimeout(() => {
        if (g.scene !== this.land.scene) return;
        const col = colors[i % colors.length];
        this.house.updateMatrixWorld(true);
        const from = new THREE.Vector3((Math.random() - 0.5) * 5, 0.2, -0.9).applyMatrix4(this.house.matrixWorld);
        const top = this.height * SCALE + 0.3 + Math.random() * 1.1; // knapp über dem Dach: bleibt im Bild
        const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 2 }));
        this.land.scene.add(m);
        g.services.sfx('whoosh');
        g.tween(0.55, (t) => { m.position.set(from.x, from.y + top * (1 - (1 - t) ** 2), from.z); }, () => {
          this.land.scene.remove(m);
          m.material.dispose();
          g.services.sfx('pop');
          this.burst(m.position.clone(), col);
        });
      }, 500 + i * 380);
    }
  }

  // Eine Rakete zerplatzt: große leuchtende Funken fliegen kugelförmig auseinander, sinken und verglühen
  burst(at, col) {
    const g = this.game;
    const geo = this.sparkGeo;
    const mat = new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 2.5, transparent: true });
    const sparks = [];
    for (let i = 0; i < 26; i++) {
      const m = new THREE.Mesh(geo, mat);
      const u = Math.random() * 2 - 1;
      const a = Math.random() * Math.PI * 2;
      const r = Math.sqrt(1 - u * u);
      sparks.push([m, new THREE.Vector3(Math.cos(a) * r, u, Math.sin(a) * r).multiplyScalar(1.7 + Math.random() * 0.9)]);
      m.position.copy(at);
      this.land.scene.add(m);
    }
    g.tween(1.5, (t) => {
      const e = 1 - (1 - t) ** 3; // schnell hinaus, dann langsam
      for (const [m, v] of sparks) {
        m.position.set(at.x + v.x * e, at.y + v.y * e - t * t * 1.1, at.z + v.z * e);
        m.scale.setScalar(1.6 * (1 - t * 0.6));
      }
      mat.opacity = t < 0.55 ? 1 : (1 - t) / 0.45;
    }, () => {
      for (const [m] of sparks) this.land.scene.remove(m);
      mat.dispose();
    });
  }

  // Bagger: Arm schwingt, die Teile purzeln von oben nach unten herunter – danach ist Platz für etwas Neues
  demolish() {
    if (this.busy) return;
    const g = this.game;
    this.busy = true;
    const d = this.digger;
    // Reihenfolge: Schmuck, Spitze, Dach, Tür, dann die Stockwerke von oben
    const keys = [...this.parts.keys()];
    const order = keys.filter((k) => k[0] !== 'L').reverse().concat(keys.filter((k) => k[0] === 'L').reverse()).map((k) => this.parts.get(k));
    const empty = order.length === 0;
    g.services.sfx('tractor');
    const swings = empty ? 1 : Math.min(6, order.length);
    const dur = empty ? 0.9 : 0.5 + swings * 0.4;
    const per = Math.ceil(order.length / swings);
    let next = 0;
    g.tween(dur, (t) => {
      const ph = t * swings;
      this.poseDigger(Math.abs(Math.sin(ph * Math.PI)));
      d.position.y = Math.abs(Math.sin(t * 50)) * 0.025;
      // jeder Schwung haut die obersten Teile herunter
      if (!empty && ph >= next + 0.5) {
        next++;
        for (const p of order.splice(0, per)) this.knockOff(p);
      }
    }, () => {
      this.poseDigger(0);
      d.position.y = 0;
      for (const p of order.splice(0)) this.knockOff(p);
      if (!empty) this.remember();
      this.state = EMPTY();
      this.save();
      // die fallenden Teile dürfen noch zu Ende purzeln, dann wird aufgeräumt
      setTimeout(() => {
        this.rebuild();
        this.busy = false;
        this.onChange?.();
      }, 750);
    });
  }

  knockOff(p) {
    const g = this.game;
    g.services.sfx('rumble');
    const centre = this.centreOf(p);
    this.dust(centre, 8);
    const dir = new THREE.Vector3(0.8 + Math.random() * 0.8, 0, (Math.random() - 0.5) * 2.2);
    const spin = (Math.random() - 0.5) * 5;
    g.tween(0.7, (t) => {
      p.position.set(dir.x * t, Math.sin(t * Math.PI) * 0.7 - t * t * centre.y * 0.8, dir.z * t);
      p.rotation.set(spin * t * 0.4, spin * t, spin * t * 0.3);
      p.scale.setScalar(Math.max(0.001, 1 - t * t));
    });
  }

  update(dt) {
    const g = this.game;
    for (const fn of this.anims) fn(g.time);
    this.garden.update(dt);
    // Abends leuchten die Fenster; aus dem Schornstein steigt Rauch
    this.glass.emissiveIntensity = (g.env?.night ?? 0) * 1.4;
    // Kommt der Zug vorbei, winken und hüpfen die Bewohner
    this.greet -= dt;
    if (this.figures.length && this.greet <= 0 && g.modeName === 'drive' && !this.busy) {
      const lp = g.train.loco?.getWorldPosition(new THREE.Vector3());
      if (lp && Math.hypot(lp.x - this.center.x, lp.z - this.center.z) < 15) {
        this.greet = 14;
        this.figures.forEach((fig, i) => setTimeout(() => {
          if (!fig.parent) return;
          g.hop(fig);
          if (fig.userData.waveArm) wave(fig, g);
        }, i * 180));
      }
    }
    if (this.busy || this.state.top?.id !== 't_schornstein') return;
    this.smoke -= dt;
    if (this.smoke > 0) return;
    this.smoke = 1.3;
    const chimney = this.parts.get('top');
    if (!chimney) return;
    const at = new THREE.Box3().setFromObject(chimney).getCenter(new THREE.Vector3());
    at.y += 0.6;
    g.village.puff(at);
  }
}
