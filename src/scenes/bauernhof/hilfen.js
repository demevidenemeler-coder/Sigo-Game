// Kleine Helfer für den Bauernhof: entprellte Töne, Figuren aus Einzelbildern, Wolken, Vogel, Schmetterling,
// Flug im Bogen. Alles ruhig und langsam.

import { Actor, sfx, note, animal, tap, fx, spr, meta, hasTex, rand, pick, clamp, PIXI } from '../../engine/index.js';

// ---------------------------------------------------------------- Töne

const zuletzt = new Map();

/** Geräusch, aber höchstens alle `abstand` Sekunden (gleiche Geräusche stapeln sich nicht). */
export function ton(id, { abstand = 0.6, vol = 1, rate = 1 } = {}) {
  const jetzt = performance.now();
  if (jetzt - (zuletzt.get(id) ?? -1e9) < abstand * 1000) return;
  zuletzt.set(id, jetzt);
  sfx(id, { vol, rate });
}

/** Tierlaut, entprellt (z. B. Dauertippen auf ein Huhn). */
export function laut(tier, abstand = 0.9) {
  const id = 'tier:' + tier;
  const jetzt = performance.now();
  if (jetzt - (zuletzt.get(id) ?? -1e9) < abstand * 1000) return;
  zuletzt.set(id, jetzt);
  animal(tier);
}

// ---------------------------------------------------------------- Figur aus einem Einzelbild

const figurKlassen = new Map();

/**
 * Eine Figur (Actor: atmet, hüpft, freut sich, Denkblase, Tierlaut), deren Bild ein einzelnes Bild aus einem
 * Paket ist (z. B. 'bauernhof/kuh_melken'). Alle Posen zeigen dieses Bild.
 */
export function bildFigur(bild, tier, opt = {}) {
  let K = figurKlassen.get(bild);
  if (!K) {
    K = class extends Actor {
      _texId() { return bild; }
      // eigene Punkte (z. B. 'kopf' für Herzen und Denkblase), wenn das Bild sie nicht hat
      _bildPunkt(name) {
        const p = this.punkte?.[name];
        if (!p) return super._bildPunkt(name);
        const m = meta(bild);
        const w = m.w || this.sprite.texture.width;
        const h = m.h || this.sprite.texture.height;
        return { x: p[0] - this.sprite.anchor.x * w, y: p[1] - this.sprite.anchor.y * h };
      }
    };
    figurKlassen.set(bild, K);
  }
  const f = new K(tier, opt);
  f.punkte = opt.punkte || null;
  return f;
}

// ---------------------------------------------------------------- Flug im Bogen

/** obj fliegt im Bogen nach (x, y) (Koordinaten seines Eltern-Containers). → Promise */
export function bogenFlug(seite, obj, x, y, { dauer = 0.6, hoehe = 120, skala = null, drehung = 0 } = {}) {
  const von = { x: obj.x, y: obj.y, s: Math.abs(obj.scale.y), r: obj.rotation };
  const p = { k: 0 };
  return seite.tween(p, { k: 1 }, dauer, {
    ease: 'sineInOut',
    onUpdate: () => {
      if (obj.destroyed) return;
      const k = p.k;
      obj.x = von.x + (x - von.x) * k;
      obj.y = von.y + (y - von.y) * k - hoehe * 4 * k * (1 - k);
      if (skala !== null) obj.scale.set(von.s + (skala - von.s) * k);
      if (drehung) obj.rotation = von.r + drehung * k;
    },
  });
}

// ---------------------------------------------------------------- Wolken

/** Ein paar Wolken ziehen sehr langsam über den Himmel (in `eltern`, meist seite.hinten). */
export class Wolken {
  constructor(eltern, { anzahl = 2, yVon = 90, yBis = 260, skala = 0.32 } = {}) {
    this.liste = [];
    const bilder = ['common/wolke1', 'common/wolke2', 'common/wolke3'].filter((id) => hasTex(id));
    if (!bilder.length) return;
    for (let i = 0; i < anzahl; i++) {
      const w = spr(bilder[i % bilder.length], { parent: eltern, z: -900, alpha: 0.88 });
      w.anchor.set(0.5);
      w.scale.set(skala * rand(0.85, 1.15));
      w.position.set(-1500 + i * (3000 / anzahl) + rand(-200, 200), rand(yVon, yBis));
      w.tempo = rand(9, 15);
      w.eventMode = 'none';
      this.liste.push(w);
    }
  }

  update(dt) {
    for (const w of this.liste) {
      if (w.destroyed) continue;
      w.x += w.tempo * dt;
      if (w.x > 1650) w.x = -1650;
    }
  }
}

// ---------------------------------------------------------------- Vogel

function zeichneVogel(farbe = 0x86b9e6) {
  const c = new PIXI.Container({ label: 'vogel' });
  const koerper = new PIXI.Graphics()
    // Schwanz
    .poly([-34, -10, -66, -30, -62, -2, -34, 6]).fill(0x5f93c4)
    // Körper und Bauch
    .ellipse(0, -2, 42, 34).fill(farbe)
    .ellipse(8, 8, 28, 20).fill(0xf3e6cf)
    // Kopf
    .circle(30, -34, 27).fill(farbe)
    // Schnabel
    .poly([52, -38, 72, -31, 52, -25]).fill(0xf2a640)
    // Auge mit Glanz, Bäckchen
    .circle(38, -40, 6).fill(0x2d2320)
    .circle(40, -42, 2).fill(0xffffff)
    .circle(30, -27, 6).fill({ color: 0xf59aa0, alpha: 0.75 })
    // Beinchen
    .rect(-6, 30, 4, 12).fill(0xd9893a)
    .rect(8, 30, 4, 12).fill(0xd9893a);
  const fluegel = new PIXI.Graphics().ellipse(0, 0, 30, 16).fill(0x5f93c4);
  fluegel.position.set(-6, -6);
  fluegel.pivot.set(-18, 0);
  fluegel.rotation = 0.35;
  c.addChild(koerper, fluegel);
  c.fluegel = fluegel;
  c.koerper = koerper;
  return c;
}

/**
 * Ein kleiner Vogel sitzt auf `sitz` ({x, y}), nickt ab und zu. Antippen: zwitschert und fliegt im Bogen davon,
 * kommt nach einer Weile wieder. update(dt) aus der Seite aufrufen.
 */
export class Vogel {
  constructor(seite, sitz, { skala = 0.8, z = 5, farbe } = {}) {
    this.seite = seite;
    this.sitz = sitz;
    this.c = zeichneVogel(farbe);
    this.c.scale.set(skala);
    this.c.position.set(sitz.x, sitz.y);
    this.c.zIndex = z;
    seite.welt.addChild(this.c);
    this.skala = skala;
    this.zustand = 'sitzt';
    this.t = rand(0, 5);
    this.flug = 0;
    tap(this.c, () => this.antippen(), { sound: null, squash: false, hitArea: new PIXI.Circle(0, -10, 140 / skala) });
  }

  antippen() {
    if (this.zustand !== 'sitzt') return;
    laut('vogel', 1.5);
    this.zustand = 'fliegt';
    const s = this.seite;
    const c = this.c;
    const richtung = this.sitz.x > 0 ? 1 : -1;
    c.scale.x = this.skala * richtung;
    bogenFlug(s, c, this.sitz.x + richtung * 1600, this.sitz.y - 650, { dauer: 3.2, hoehe: 160 }).then((ok) => {
      if (!ok || c.destroyed) return;
      s.after(rand(10, 16), () => this.zurueck());
    });
  }

  zurueck() {
    const s = this.seite;
    const c = this.c;
    if (c.destroyed) return;
    const richtung = this.sitz.x > 0 ? -1 : 1;
    c.position.set(this.sitz.x - richtung * 1600, this.sitz.y - 650);
    c.scale.x = this.skala * richtung;
    bogenFlug(s, c, this.sitz.x, this.sitz.y, { dauer: 3.6, hoehe: -120 }).then((ok) => {
      if (!ok || c.destroyed) return;
      c.scale.x = this.skala * (this.sitz.x > 0 ? -1 : 1);
      this.zustand = 'sitzt';
    });
  }

  update(dt) {
    if (this.c.destroyed) return;
    this.t += dt;
    const f = this.c.fluegel;
    if (this.zustand === 'fliegt') {
      f.rotation = 0.2 + Math.sin(this.t * 9) * 0.6;
    } else {
      f.rotation = 0.35;
      // ab und zu ein kleines Nicken (Körper neigt sich weich)
      const zyklus = this.t % 5;
      this.c.koerper.rotation = zyklus < 0.6 ? Math.sin((zyklus / 0.6) * Math.PI) * 0.12 : 0;
    }
  }
}

// ---------------------------------------------------------------- Schmetterling

const FALTER_FARBEN = [[0xffb36b, 0xffd9a8], [0xf59ac0, 0xffd3e4], [0xa9c8f5, 0xdbe8ff], [0xf7d35c, 0xfff0b0]];

function zeichneFalter() {
  const [a, b] = pick(FALTER_FARBEN);
  const c = new PIXI.Container({ label: 'schmetterling' });
  const fluegel = (seite) => {
    const g = new PIXI.Graphics()
      .ellipse(seite * 26, -16, 28, 24).fill(a)
      .ellipse(seite * 20, 16, 20, 17).fill(a)
      .circle(seite * 28, -18, 9).fill(b)
      .circle(seite * 20, 16, 6).fill(b);
    return g;
  };
  const links = fluegel(-1);
  const rechts = fluegel(1);
  const leib = new PIXI.Graphics()
    .ellipse(0, 2, 6, 24).fill(0x5a4636)
    .circle(0, -24, 7).fill(0x5a4636)
    .moveTo(-2, -28).lineTo(-10, -42).stroke({ width: 3, color: 0x5a4636 })
    .moveTo(2, -28).lineTo(10, -42).stroke({ width: 3, color: 0x5a4636 });
  c.addChild(links, rechts, leib);
  c.links = links;
  c.rechts = rechts;
  return c;
}

/**
 * Ein Schmetterling gaukelt langsam in einem Bereich {x0, y0, x1, y1} umher. Antippen: flattert weiter weg (ein
 * leises Pling). update(dt) aus der Seite aufrufen.
 */
export class Schmetterling {
  constructor(seite, bereich, { skala = 1, z = 900, eltern } = {}) {
    this.bereich = bereich;
    this.c = zeichneFalter();
    this.c.scale.set(skala);
    this.c.zIndex = z;
    (eltern || seite.welt).addChild(this.c);
    this.c.position.set(rand(bereich.x0, bereich.x1), rand(bereich.y0, bereich.y1));
    this.ziel = { x: this.c.x, y: this.c.y };
    this.tempo = 45;
    this.t = rand(0, 10);
    this.neuesZiel();
    tap(this.c, () => {
      note('pling', pick([84, 86, 88]), { vol: 0.3 });
      this.tempo = 120;
      this.neuesZiel(true);
    }, { sound: null, squash: false, hitArea: new PIXI.Circle(0, 0, 120 / skala) });
  }

  neuesZiel(weit = false) {
    const b = this.bereich;
    for (let i = 0; i < 6; i++) {
      const x = rand(b.x0, b.x1);
      const y = rand(b.y0, b.y1);
      if (!weit || Math.hypot(x - this.c.x, y - this.c.y) > 400) {
        this.ziel = { x, y };
        return;
      }
    }
    this.ziel = { x: rand(b.x0, b.x1), y: rand(b.y0, b.y1) };
  }

  update(dt) {
    const c = this.c;
    if (c.destroyed) return;
    this.t += dt;
    // Flügelschlag: ruhig (etwa 1,5 Schläge pro Sekunde)
    const schlag = 0.35 + 0.65 * Math.abs(Math.cos(this.t * 4.7));
    c.links.scale.x = schlag;
    c.rechts.scale.x = schlag;
    // zum Ziel gaukeln, mit leichtem Auf und Ab
    const dx = this.ziel.x - c.x;
    const dy = this.ziel.y - c.y;
    const d = Math.hypot(dx, dy);
    if (d < 20) {
      this.tempo = 45;
      this.neuesZiel();
      return;
    }
    const v = Math.min(d, this.tempo * dt);
    c.x += (dx / d) * v;
    c.y += (dy / d) * v + Math.sin(this.t * 2.3) * 18 * dt;
    c.rotation = clamp(dx / 600, -0.25, 0.25);
  }
}

// ---------------------------------------------------------------- Kleinkram

/**
 * Engere Tippfläche für eine Figur (nach actor.onTap aufrufen): Actor.onTap nimmt die ganze Bildbreite plus Zugabe –
 * damit verdecken große Tiere die Dinge hinter sich (Traktor, Vogel, Scheunentor). Hier: `breite` Anteil der
 * Bildbreite (mittig im Bild, nicht um den Anker), oben knapp über dem Kopf, unten `unten` Bühnen-Einheiten Zugabe.
 * Spiegelt mit der Figur mit (flip).
 */
export function engeTippflaeche(actor, { breite = 0.8, oben = 0.03, unten = 30 } = {}) {
  const t = actor.sprite.texture;
  const ax = actor.sprite.anchor.x;
  const ay = actor.sprite.anchor.y;
  const w = t.width;
  const h = t.height;
  const s = Math.max(0.05, Math.abs(actor.scale.x));
  const r = ((1 - breite) / 2) * w;
  const x0 = -ax * w + r;
  const x1 = (1 - ax) * w - r;
  const y0 = -ay * h + oben * h;
  const y1 = (1 - ay) * h + unten / s;
  actor.hitArea = {
    x: x0, y: y0, width: x1 - x0, height: y1 - y0,
    contains(x, y) {
      const lx = actor.flip ? -x : x;
      return lx >= x0 && lx <= x1 && y >= y0 && y <= y1;
    },
  };
  return actor.hitArea;
}

/** Ein Ding, das beim Antippen sanft wackelt und einen Ton macht. */
export function wackelDing(obj, { ton: id = 'common/plopp', vol = 0.7, abstand = 0.4, dazu, hitArea, pad = 40 } = {}) {
  return tap(obj, (e) => {
    fx.wobble(obj, 0.06);
    if (id) ton(id, { abstand, vol });
    dazu?.(e);
  }, { sound: null, hitArea, pad });
}
