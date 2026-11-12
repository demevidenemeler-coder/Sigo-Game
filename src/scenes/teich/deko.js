// Teich: kleine Helfer und lebendige Nebensachen für beide Seiten.
//   ton()            Geräusch mit eigener Entprellung (gleiche Geräusche stapeln sich nicht)
//   Ringe            Vorrat an Wellenringen (teich/wasserring), die weich auseinanderlaufen
//   Vogel            gezeichneter kleiner Vogel, fliegt ab und zu ruhig über den Himmel
//   Schmetterling    gezeichneter Schmetterling, gaukelt um eine Stelle
//   Wolken           zwei Wolken, die langsam ziehen
//   naechsterSticker Sticker des Teichs, der noch fehlt (sonst der Wunsch)
//   freue()          wie actor.cheer(), aber die Herzen liegen in der Seite (gleiten beim Blättern mit)

import { sfx, note, animal, spr, tap, fx, killTweensOf, rand, pick, PIXI } from '../../engine/index.js';
import { gesammelt } from '../../gemeinsam/sticker.js';

// ---------------------------------------------------------------- Ton

const zuletzt = new Map();

/** Geräusch abspielen, aber dasselbe frühestens nach `abstand` Sekunden wieder. */
export function ton(id, opt = {}, abstand = 0.35) {
  const jetzt = performance.now();
  if (jetzt - (zuletzt.get(id) ?? -1e9) < abstand * 1000) return;
  zuletzt.set(id, jetzt);
  sfx(id, opt);
}

/** Tierlaut, entprellt (Tierlaute sind länger: 0,9 s). */
export function laut(tier, abstand = 0.9) {
  const jetzt = performance.now();
  const key = 'tier:' + tier;
  if (jetzt - (zuletzt.get(key) ?? -1e9) < abstand * 1000) return;
  zuletzt.set(key, jetzt);
  animal(tier);
}

// ---------------------------------------------------------------- Sticker

/** Der erste noch nicht gesammelte Sticker aus `liste`; sind alle da: `wunsch` (gibt dann nur Funkeln). */
export function naechsterSticker(wunsch, liste) {
  const da = new Set(gesammelt());
  return liste.find((id) => !da.has(id)) || wunsch;
}

// ---------------------------------------------------------------- Freude

/**
 * Figur freut sich (Pose happy, Hüpfer, Herzen, Laut) – wie actor.cheer(), nur dass die Herzen in seite.vorn
 * entstehen und beim Blättern mitgleiten. Erneut während der Freude: nur der Laut. → Promise<boolean>
 */
export function freue(seite, actor, { laut: mitLaut = true } = {}) {
  if (!actor || actor.destroyed) return Promise.resolve(false);
  if (actor._teichFreude) {
    if (mitLaut) laut(actor.laut, 0.6);
    return actor._teichFreude;
  }
  actor.pose('happy');
  if (mitLaut) laut(actor.laut, 0.6);
  const kopf = actor.point('kopf');
  // 'kopf' ist die Bildoberkante: die Herzen steigen über dem Kopf auf, das lachende Gesicht bleibt frei
  seite.burst('herzen', kopf.x, kopf.y - 40, { count: 5 });
  const freude = (async () => {
    const ok = await actor.hop(80);
    if (ok) await seite.wait(0.7);
    if (!actor.destroyed && actor.poseName === 'happy') actor.pose('idle');
    actor._teichFreude = null;
    return ok;
  })();
  actor._teichFreude = freude;
  return freude;
}

// ---------------------------------------------------------------- Wellenringe

export class Ringe {
  /** seite: für tween; parent: Container; n: Vorrat */
  constructor(seite, parent, { n = 8, z = 5 } = {}) {
    this.seite = seite;
    this.vorrat = [];
    this.naechster = 0;
    for (let i = 0; i < n; i++) {
      const s = spr('teich/wasserring', { parent, anchor: 0.5 });
      s.alpha = 0;
      s.visible = false;
      s.eventMode = 'none';
      s.zIndex = z;
      this.vorrat.push(s);
    }
  }

  /** Ring bei (x, y); groesse = Endbreite in Einheiten */
  ring(x, y, groesse = 260, { dauer = 1.6, alpha = 0.85, z } = {}) {
    const s = this.vorrat[this.naechster];
    this.naechster = (this.naechster + 1) % this.vorrat.length;
    killTweensOf(s);
    const basis = groesse / 400;
    s.position.set(x, y);
    if (z !== undefined) s.zIndex = z;
    s.scale.set(basis * 0.25);
    s.alpha = alpha;
    s.visible = true;
    this.seite.tween(s, { scale: basis }, dauer, { ease: 'cubicOut' });
    this.seite.tween(s, { alpha: 0 }, dauer, { ease: 'sineInOut' }).then((ok) => { if (ok) s.visible = false; });
  }
}

// ---------------------------------------------------------------- Vogel

function zeichneVogel() {
  const c = new PIXI.Container({ label: 'vogel' });
  const blau = 0x74b6e2;
  const dunkel = 0x4d8fc4;
  const schwanz = new PIXI.Graphics()
    .poly([-44, -8, -92, -30, -86, 4, -44, 12]).fill(dunkel);
  const koerper = new PIXI.Graphics()
    .ellipse(0, 0, 58, 42).fill(blau)
    .ellipse(10, 14, 36, 24).fill(0xfff0c8)
    .circle(42, -24, 32).fill(blau)
    .ellipse(30, -40, 16, 9).fill({ color: 0xffffff, alpha: 0.35 })
    .poly([70, -28, 94, -20, 70, -12]).fill(0xf3a23c)
    .circle(52, -30, 7).fill(0x2b2320)
    .circle(54, -32, 2.4).fill(0xffffff)
    .circle(46, -14, 7).fill({ color: 0xff8f9a, alpha: 0.55 });
  const fluegel = new PIXI.Graphics().ellipse(0, -22, 40, 24).fill(dunkel);
  fluegel.position.set(-6, -8);
  c.addChild(schwanz, koerper, fluegel);
  c.fluegel = fluegel;
  return c;
}

/**
 * Kleiner Vogel, der selten (alle `pause` s, Standard 40–60) ruhig quer über den Himmel fliegt. Antippen: zwitschert und macht einen
 * kleinen Bogen nach oben. update(dt) aufrufen.
 */
export class Vogel {
  constructor(seite, parent, { yBereich = [140, 330], z = 2900, pause = [40, 60], erster = [8, 16] } = {}) {
    this.seite = seite;
    this.yBereich = yBereich;
    this.pause = pause;
    this.c = zeichneVogel();
    this.c.zIndex = z;
    this.c.scale.set(0.8);
    this.c.visible = false;
    parent.addChild(this.c);
    this.t = 0;
    this.warte = rand(...erster);
    this.fliegt = false;
    this.bogen = { y: 0 };
    tap(this.c, () => {
      laut('vogel', 2.5);
      fx.pop(this.c, 0.12);
      killTweensOf(this.bogen);
      this.seite.tween(this.bogen, { y: -90 }, 0.5, { ease: 'sineInOut' })
        .then((ok) => { if (ok) this.seite.tween(this.bogen, { y: 0 }, 0.9, { ease: 'sineInOut' }); });
    }, { sound: null, squash: false, hitArea: new PIXI.Circle(0, 0, 150) });
  }

  start() {
    this.richtung = Math.random() < 0.5 ? 1 : -1;
    this.x = -1500 * this.richtung;
    this.y0 = rand(...this.yBereich);
    this.tempo = rand(110, 140);
    this.c.scale.x = 0.8 * this.richtung;
    this.c.visible = true;
    this.fliegt = true;
  }

  update(dt) {
    this.t += dt;
    if (!this.fliegt) {
      this.warte -= dt;
      if (this.warte <= 0) this.start();
      return;
    }
    this.x += this.richtung * this.tempo * dt;
    this.c.position.set(this.x, this.y0 + Math.sin(this.t * 1.3) * 18 + this.bogen.y);
    this.c.fluegel.scale.y = Math.sin(this.t * Math.PI * 2 * 1.4);
    if (Math.abs(this.x) > 1550) {
      this.fliegt = false;
      this.c.visible = false;
      this.warte = rand(...this.pause);
    }
  }
}

// ---------------------------------------------------------------- Schmetterling

function zeichneSchmetterling(farbe1, farbe2) {
  const c = new PIXI.Container({ label: 'schmetterling' });
  const fluegel = new PIXI.Container();
  const links = new PIXI.Graphics()
    .ellipse(-34, -18, 34, 28).fill(farbe1)
    .ellipse(-26, 20, 22, 18).fill(farbe2)
    .circle(-38, -22, 9).fill({ color: 0xffffff, alpha: 0.55 });
  const rechts = new PIXI.Graphics()
    .ellipse(34, -18, 34, 28).fill(farbe1)
    .ellipse(26, 20, 22, 18).fill(farbe2)
    .circle(38, -22, 9).fill({ color: 0xffffff, alpha: 0.55 });
  fluegel.addChild(links, rechts);
  const koerper = new PIXI.Graphics()
    .roundRect(-6, -30, 12, 62, 6).fill(0x6b4a3a)
    .circle(0, -34, 9).fill(0x6b4a3a)
    .moveTo(-3, -40).quadraticCurveTo(-12, -58, -18, -60).stroke({ width: 3, color: 0x6b4a3a })
    .moveTo(3, -40).quadraticCurveTo(12, -58, 18, -60).stroke({ width: 3, color: 0x6b4a3a });
  c.addChild(fluegel, koerper);
  c.fluegel = fluegel;
  return c;
}

/**
 * Schmetterling sitzt meist still auf seinem Platz (heim) und klappt langsam die Flügel; alle 10–16 s gaukelt er
 * ruhig zu einem anderen Platz aus `plaetze`. Antippen: leiser Glockenton, er fliegt gleich weiter.
 * update(dt) aufrufen.
 */
export class Schmetterling {
  constructor(seite, parent, plaetze, { z = 3000, farben = [0xffb3c8, 0xffd98a] } = {}) {
    this.seite = seite;
    this.plaetze = plaetze;
    this.heim = { ...plaetze[0] };
    this.c = zeichneSchmetterling(...farben);
    this.c.zIndex = z;
    this.c.scale.set(0.9);
    parent.addChild(this.c);
    this.t = rand(0, 10);
    this.weiter = rand(6, 12);
    this.flug = { a: 0 };     // 0 = sitzt still, 1 = fliegt (Gaukeln und schnelles Flattern)
    tap(this.c, () => {
      note('glocke', pick([84, 88, 91]), { vol: 0.3 });
      this.fliegeWeiter();
    }, { sound: null, squash: false, hitArea: new PIXI.Circle(0, 0, 140) });
  }

  fliegeWeiter() {
    const andere = this.plaetze.filter((p) => Math.hypot(p.x - this.heim.x, p.y - this.heim.y) > 50);
    const ziel = pick(andere.length ? andere : this.plaetze);
    killTweensOf(this.heim);
    killTweensOf(this.flug);
    this.seite.tween(this.flug, { a: 1 }, 0.4, { ease: 'sineInOut' });
    this.seite.tween(this.heim, { x: ziel.x, y: ziel.y }, 3, { ease: 'sineInOut' }).then((ok) => {
      if (ok) this.seite.tween(this.flug, { a: 0 }, 0.8, { ease: 'sineInOut' });
    });
    this.weiter = rand(10, 16);
  }

  update(dt) {
    this.t += dt;
    this.weiter -= dt;
    if (this.weiter <= 0) this.fliegeWeiter();
    const a = this.flug.a;
    const x = this.heim.x + Math.sin(this.t * 0.6) * 50 * a;
    const y = this.heim.y + Math.sin(this.t * 1.1) * 24 * a;
    const vx = Math.cos(this.t * 0.6);
    this.c.position.set(x, y);
    this.c.rotation = vx * 0.15 * a;
    // im Flug flattern, im Sitzen nur langsam auf- und zuklappen
    const flattern = 0.35 + 0.65 * Math.abs(Math.sin(this.t * Math.PI * 1.6));
    const klappen = 0.6 + 0.4 * Math.abs(Math.cos(this.t * 0.7));
    this.c.fluegel.scale.x = klappen + (flattern - klappen) * a;
  }
}

// ---------------------------------------------------------------- Wolken

/** Zwei Wolken ziehen langsam durch den Himmel (Antippen: kleines Plustern). update(dt) aufrufen. */
export class Wolken {
  constructor(seite, parent, liste, { z = -900 } = {}) {
    this.wolken = liste.map(({ id, x, y, breite, tempo }) => {
      const s = spr(id, { parent, x, y, anchor: 0.5 });
      s.scale.set(breite / s.texture.width);
      s.zIndex = z;
      s.alpha = 0.92;
      s.tempo = tempo;
      tap(s, () => {
        fx.pop(s, 0.08);
        ton('common/wusch', { vol: 0.25 }, 0.8);
      }, { sound: null, squash: false, pad: 60 });
      return s;
    });
  }

  update(dt) {
    for (const s of this.wolken) {
      s.x += s.tempo * dt;
      if (s.x > 1700) s.x = -1700;
    }
  }
}
