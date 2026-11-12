// Kleine lebendige Nebensachen für die Feuerwehr-Seiten: ein Vogel, ein Schmetterling, ziehende Wolken.
// Alles ruhig: langsame Bewegungen, weiche Flügelschläge, beim Antippen ein freundlicher Ton.
// Vogel und Schmetterling sind selbst gezeichnet (im Paket gibt es keine) – runde, weiche Formen im Stil der Bilder.

import { spr, tap, note, sfx, fx, rand, pick, clamp, PIXI } from '../../engine/index.js';

const { Container, Graphics, Circle } = PIXI;

const PIEP_ABSTAND = 0.6;   // Sekunden: so oft piept der Vogel beim Antippen höchstens (wie Tierlaute im Kern)

// ---------------------------------------------------------------- Vogel

function zeichneVogel() {
  const c = new Container({ label: 'vogel' });
  const schatten = new Graphics().ellipse(0, 4, 30, 7).fill({ color: 0x5a4630, alpha: 0.18 });
  const schwanz = new Graphics()
    .moveTo(-30, -26).quadraticCurveTo(-58, -40, -62, -22).quadraticCurveTo(-50, -14, -30, -16).fill(0x4d8fc4);
  const koerper = new Graphics()
    .ellipse(0, -30, 34, 28).fill(0x6fb3e0)
    .ellipse(4, -22, 22, 16).fill(0xf6e7c8)                   // heller Bauch
    .ellipse(-10, -40, 12, 8).fill({ color: 0xffffff, alpha: 0.35 }); // Glanz oben links
  const kopf = new Container();
  kopf.position.set(22, -52);
  kopf.addChild(new Graphics()
    .circle(0, 0, 20).fill(0x6fb3e0)
    .circle(-6, -7, 6).fill({ color: 0xffffff, alpha: 0.35 })
    .moveTo(17, -3).lineTo(31, 2).lineTo(17, 7).fill(0xf2a23a)  // Schnabel
    .circle(7, -3, 5).fill(0x2b2018)                              // Auge
    .circle(8.6, -4.8, 1.8).fill(0xffffff)
    .circle(3, 7, 4.5).fill({ color: 0xff8f9a, alpha: 0.75 }));   // Bäckchen
  const fluegel = new Graphics().ellipse(0, 0, 20, 12).fill(0x4d8fc4);
  fluegel.position.set(-6, -32);
  fluegel.rotation = -0.25;
  const beine = new Graphics()
    .rect(-6, -6, 3, 8).fill(0xe08a2e).rect(4, -6, 3, 8).fill(0xe08a2e);
  c.addChild(schatten, beine, schwanz, koerper, kopf, fluegel);
  c.teile = { kopf, fluegel, schatten, koerper };
  return c;
}

/**
 * Vogel sitzt an einem von mehreren Plätzen (Szenen-Koordinaten), pickt und schaut ab und zu, fliegt alle
 * 20–30 s gemächlich an einen anderen Platz. Antippen: kleiner Hüpfer, Piepen (Flöte), fliegt weiter.
 * plaetze = [{x, y, flip}], parent = Container der Seite.
 */
export class Vogel {
  constructor(seite, { plaetze, parent, scale = 1, z = 30 }) {
    this.seite = seite;
    this.plaetze = plaetze;
    this.platz = 0;
    this.c = zeichneVogel();
    this.c.scale.set(scale);
    this.c.zIndex = z;
    this.skala = scale;
    const p = plaetze[0];
    this.c.position.set(p.x, p.y);
    this.c.scale.x = scale * (p.flip ? -1 : 1);
    parent.addChild(this.c);
    this.c.hitArea = new Circle(0, -30, 110 / scale);
    tap(this.c, () => this.angetippt(), { sound: null, squash: false, hitArea: new Circle(0, -30, 115 / scale) });
    this.flug = null;        // { von, nach, t, dauer }
    this.uhr = rand(14, 22); // bis zum nächsten Flug
    this.pickUhr = rand(2, 4);
    this.zeit = rand(0, 10);
    this.piepZeit = -1e9;    // wann zuletzt gepiept (Sekunden, performance.now)
  }

  angetippt() {
    const t = this.c.teile;
    // Piepen (zwei weiche Flötentöne) höchstens alle PIEP_ABSTAND Sekunden – Dauertippen klingt sonst schrill;
    // dazwischen nur das kleine Stauchen.
    const jetzt = performance.now() / 1000;
    if (jetzt - this.piepZeit >= PIEP_ABSTAND) {
      this.piepZeit = jetzt;
      note('floete', pick([86, 88, 91]), { dauer: 0.12, vol: 0.45 });
      this.seite.after(0.16, () => note('floete', pick([91, 93]), { dauer: 0.12, vol: 0.4 }));
    }
    fx.pop(t.koerper, 0.12);
    if (!this.flug) this.seite.after(0.5, () => this.fliege());
  }

  fliege() {
    if (this.flug || this.plaetze.length < 2) return;
    let n = this.platz;
    while (n === this.platz) n = Math.floor(Math.random() * this.plaetze.length);
    const von = { x: this.c.x, y: this.c.y };
    const nach = this.plaetze[n];
    const d = Math.hypot(nach.x - von.x, nach.y - von.y);
    this.flug = { von, nach, t: 0, dauer: clamp(d / 260, 1.4, 4) };
    this.platz = n;
    this.c.scale.x = this.skala * (nach.x < von.x ? -1 : 1);
  }

  update(dt) {
    this.zeit += dt;
    const t = this.c.teile;
    if (this.flug) {
      const f = this.flug;
      f.t += dt;
      const p = clamp(f.t / f.dauer, 0, 1);
      const e = p * p * (3 - 2 * p);
      const hoehe = Math.min(160, Math.abs(f.nach.x - f.von.x) * 0.25 + 60);
      this.c.x = f.von.x + (f.nach.x - f.von.x) * e;
      this.c.y = f.von.y + (f.nach.y - f.von.y) * e - Math.sin(Math.PI * p) * hoehe;
      t.fluegel.rotation = -0.25 + Math.sin(this.zeit * Math.PI * 2 * 2.2) * 0.7; // gemächlicher Flügelschlag
      t.schatten.alpha = 0;
      if (p >= 1) {
        this.flug = null;
        this.uhr = rand(18, 30);
        this.c.scale.x = this.skala * (f.nach.flip ? -1 : 1);
        t.fluegel.rotation = -0.25;
        t.schatten.alpha = 1;
      }
      return;
    }
    // sitzt: atmet, schaut, pickt ab und zu
    t.koerper.scale.y = 1 + Math.sin(this.zeit * 2.2) * 0.025;
    this.pickUhr -= dt;
    if (this.pickUhr <= 0) {
      this.pickUhr = rand(2.5, 5);
      const k = t.kopf;
      this.seite.tween(k, { rotation: 0.35 }, 0.25, { ease: 'sineInOut' })
        .then(() => this.seite.tween(k, { rotation: 0 }, 0.35, { ease: 'sineInOut' }));
    }
    this.uhr -= dt;
    if (this.uhr <= 0) this.fliege();
  }
}

// ---------------------------------------------------------------- Schmetterling

function zeichneSchmetterling(farbe) {
  const c = new Container({ label: 'schmetterling' });
  const links = new Graphics()
    .ellipse(-22, -14, 22, 18).fill(farbe).ellipse(-16, 12, 14, 12).fill(farbe)
    .circle(-24, -16, 7).fill({ color: 0xffffff, alpha: 0.55 });
  const rechts = new Graphics()
    .ellipse(22, -14, 22, 18).fill(farbe).ellipse(16, 12, 14, 12).fill(farbe)
    .circle(24, -16, 7).fill({ color: 0xffffff, alpha: 0.55 });
  const leib = new Graphics()
    .roundRect(-5, -24, 10, 46, 5).fill(0x5a3e2b)
    .moveTo(-2, -24).quadraticCurveTo(-10, -40, -14, -42).stroke({ width: 3, color: 0x5a3e2b })
    .moveTo(2, -24).quadraticCurveTo(10, -40, 14, -42).stroke({ width: 3, color: 0x5a3e2b });
  c.addChild(links, rechts, leib);
  c.fluegel = [links, rechts];
  return c;
}

// Der Schmetterling bleibt (samt Schaukeln) im Kernbereich, der auf jedem Bildschirm zu sehen ist.
const FALTER_RAND = 1000;

/** Schmetterling schaukelt langsam um einen Ort herum. Antippen: Pling, er flattert ein Stück weiter. */
export class Schmetterling {
  constructor(seite, { x, y, parent, farbe = 0xf7a8c8, z = 40, weite = 120 }) {
    this.seite = seite;
    this.weite = weite;
    this.heim = { x: this._klemme(x), y };
    this.mitte = { x: this.heim.x, y };
    this.ziel = { x: this.heim.x, y };
    this.c = zeichneSchmetterling(farbe);
    this.c.zIndex = z;
    this.c.position.set(this.heim.x, y);
    parent.addChild(this.c);
    tap(this.c, () => {
      note('pling', pick([84, 88, 91]), { vol: 0.35 });
      // ein Stück weiter, aber nie weit weg von seinem Platz (sonst wandert er mit der Zeit aus dem Bild)
      this.ziel.x = this._klemme(this.heim.x + rand(-200, 200));
      this.ziel.y = this.heim.y + rand(-120, 60);
    }, { sound: null, squash: false, hitArea: new Circle(0, 0, 110) });
    this.zeit = rand(0, 20);
  }

  _klemme(x) {
    const r = FALTER_RAND - this.weite;
    return clamp(x, -r, r);
  }

  update(dt) {
    this.zeit += dt;
    const z = this.zeit;
    // Mittelpunkt gleitet weich zum Ziel, darum herum ein langsames Achter-Schweben
    const k = 1 - Math.exp(-dt * 0.6);
    this.mitte.x += (this.ziel.x - this.mitte.x) * k;
    this.mitte.y += (this.ziel.y - this.mitte.y) * k;
    const x = this.mitte.x + Math.sin(z * 0.45) * this.weite;
    const y = this.mitte.y + Math.sin(z * 0.9) * this.weite * 0.35;
    const dx = x - this.c.x;
    this.c.position.set(x, y);
    this.c.rotation = clamp(dx * 0.6, -0.25, 0.25);
    const schlag = 0.35 + 0.65 * Math.abs(Math.sin(z * Math.PI * 2 * 1.4));   // 1,4 Schläge pro Sekunde
    this.c.fluegel[0].scale.x = schlag;
    this.c.fluegel[1].scale.x = schlag;
  }
}

// ---------------------------------------------------------------- Wolken

/** Zwei, drei weiße Wolken ziehen ganz langsam über den Himmel (in `parent`, über dem Hintergrund). */
export class Wolken {
  constructor({ parent, liste, z = -900 }) {
    this.wolken = liste.map((w) => {
      const s = spr(w.tex, { x: w.x, y: w.y, scale: w.scale ?? 0.4, parent, z });
      s.alpha = w.alpha ?? 0.85;
      s.eventMode = 'none';
      s.v = w.v ?? 8;
      return s;
    });
  }

  update(dt) {
    for (const s of this.wolken) {
      s.x += s.v * dt;
      if (s.x > 1700) s.x = -1700;
    }
  }
}

// ---------------------------------------------------------------- Kleinkram

/**
 * Unsichtbare Tippfläche an einer Stelle des Hintergrunds: Kreis mit Radius r oder – mit opt.breite/opt.hoehe –
 * ein Rechteck um (x, y). → Container
 */
export function tippStelle(parent, x, y, r, fn, opt = {}) {
  const c = new Container({ label: opt.label || 'tippStelle' });
  c.position.set(x, y);
  c.zIndex = opt.z ?? 1;
  parent.addChild(c);
  const flaeche = opt.breite
    ? new PIXI.Rectangle(-opt.breite / 2, -opt.hoehe / 2, opt.breite, opt.hoehe)
    : new Circle(0, 0, r);
  tap(c, fn, { sound: opt.sound ?? null, squash: false, hitArea: flaeche });
  return c;
}

/**
 * Denkblase mit Bild an einer festen Stelle (für Dinge, die keine Figur sind – z. B. das Auto „denkt" an den
 * nächsten Schritt). (x, y) = kleinstes Bläschen in Koordinaten von seite.vorn. Eine neue Blase derselben Seite
 * löst die alte weich ab. opt: {sek = 2.6, links = false, tint}. → Promise (wenn wieder weg)
 */
export async function zeigeBlase(seite, x, y, quelle, opt = {}) {
  const alt = seite._feuerBlase;
  if (alt && !alt.destroyed) {
    seite._feuerBlase = null;
    seite.tween(alt, { alpha: 0 }, 0.25, { ease: 'sineInOut' }).then(() => { if (!alt.destroyed) alt.destroy({ children: true }); });
  }
  const b = new Container({ label: 'blase' });
  b.eventMode = 'none';
  b.zIndex = 80;
  const grund = spr('common/blase_denk', { parent: b });
  const m = grund.texture;
  const schwanz = [m.width * 0.1, m.height * 0.95];
  const innen = [m.width * 0.55, m.height * 0.45];
  grund.anchor.set(schwanz[0] / m.width, schwanz[1] / m.height);
  const s = 330 / m.width;
  const richtung = opt.links ? -1 : 1;
  grund.scale.set(s * richtung, s);
  const bild = spr(quelle, { parent: b });
  bild.anchor.set(0.5);
  bild.scale.set(170 / Math.max(bild.texture.width, bild.texture.height, 1));
  if (opt.tint !== undefined) bild.tint = opt.tint;
  bild.position.set((innen[0] - schwanz[0]) * s * richtung, (innen[1] - schwanz[1]) * s);
  b.position.set(x, y);
  b.scale.set(0.6);
  b.alpha = 0;
  seite.vorn.addChild(b);
  seite._feuerBlase = b;
  seite.tween(b, { alpha: 1 }, 0.35, { ease: 'sineInOut' });
  const ok = await seite.tween(b, { scale: 1 }, 0.45, { ease: 'backOut' });
  if (ok) await seite.wait(Math.max(0.6, opt.sek ?? 2.6));
  if (!b.destroyed) await seite.tween(b, { alpha: 0, scale: 0.85 }, 0.45, { ease: 'sineInOut' });
  if (!b.destroyed) b.destroy({ children: true });
  if (seite._feuerBlase === b) seite._feuerBlase = null;
  return ok;
}

/**
 * Rand (pad) für actor.onTap, damit auch kleine Figuren (Entenkind, Frosch, Igel) eine Tippfläche von
 * mindestens `breite` Einheiten haben (Regel für kleine Hände: lieber 260+). Gerechnet wie Actor.onTap.
 */
export function tippRand(figur, breite = 270, mindestens = 45) {
  const s = figur.sprite;
  const halb = s.texture.width * Math.max(s.anchor.x, 1 - s.anchor.x) * Math.abs(figur.scale.x);
  return Math.max(mindestens, Math.ceil(breite / 2 - halb));
}

/** Ein kleines Geräusch, das sich nicht stapelt: höchstens alle `abstand` Sekunden. */
export function entprellt(abstand = 0.6) {
  let zuletzt = -1e9;
  return (id, opt) => {
    const jetzt = performance.now() / 1000;
    if (jetzt - zuletzt < abstand) return false;
    zuletzt = jetzt;
    sfx(id, opt);
    return true;
  };
}
