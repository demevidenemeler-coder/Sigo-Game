// Dinge, die über die Runden wachsen, und ein kleines Versteck:
//   KundenWand   – an einer Schnur an der Wand hängen kleine Bildkärtchen der zufriedenen Kunden (die letzten vier).
//   WimpelKette  – unter dem Sonnenschirm wächst eine Wimpelkette in den Farben der ausgeschenkten Säfte.
//   Marienkaefer – versteckt sich manchmal hinter einer Frucht; wird die Frucht genommen, krabbelt er hervor.
// Alles ruhig: weiches Einschweben, sanftes Pendeln, kein Blinken.

import { PIXI, spr, tap, fx, note, animal, rand, pick } from '../../engine/index.js';
import { belohne, stickerFuerOrt, gesammelt } from '../../gemeinsam/sticker.js';
import { bogenFlug, mische } from './deko.js';

// ---------------------------------------------------------------- Belohnung für ein volles Ziel

/**
 * Belohnung, wenn etwas, das über die Runden wächst, voll ist (Münzturm, Wimpelkette).
 * Gibt es den Wunsch-Sticker (wunschId) in der Sticker-Liste und fehlt er noch im Album, kommt er; sonst ein anderer
 * Sticker der Eisdiele, der noch fehlt. Sind alle schon gesammelt: ein ruhiger Freuden-Moment (ein paar Funkel und
 * drei helle Glockentöne) – kein Stern, denn es gibt nichts Neues fürs Album. → true, wenn ein Sticker kam
 */
export function belohneZiel(seite, wunschId, x, y) {
  const ids = stickerFuerOrt('eisdiele', { nurVorhandene: true }).map((s) => s.id);
  const schon = new Set(gesammelt());
  const id = [wunschId, ...ids].find((i) => ids.includes(i) && !schon.has(i));
  if (id) {
    belohne(seite, id, x, y);
    return true;
  }
  seite.burst('funkeln', x, y, { count: 6 });
  [84, 88, 91].forEach((m, i) => seite.after(i * 0.22, () => note('glocke', m, { vol: 0.28 })));
  return false;
}

// ---------------------------------------------------------------- Kunden-Wand

const KARTE_B = 112;
const KARTE_H = 122;

export class KundenWand {
  /**
   * @param seite  die Seite
   * @param opt    {von, bis, y (Höhe der Schnur an den Enden), durchhang, plaetze = 4, z}
   */
  constructor(seite, { von, bis, y, durchhang = 26, plaetze = 4, z = 3 }) {
    this.seite = seite;
    this.von = von;
    this.bis = bis;
    this.y = y;
    this.durchhang = durchhang;
    this.anzahl = plaetze;
    this.karten = [];
    this.z = z;
    const g = new PIXI.Graphics();
    // Schnur mit zwei Nägeln
    g.moveTo(von, y).quadraticCurveTo((von + bis) / 2, y + durchhang * 2, bis, y)
      .stroke({ width: 5, color: 0xc98a5a, cap: 'round' });
    for (const x of [von, bis]) g.circle(x, y, 9).fill(0xe0a878).stroke({ width: 3, color: 0xb07040 });
    g.eventMode = 'none';
    g.zIndex = z;
    seite.welt.addChild(g);
  }

  /** Höhe der Schnur bei x. */
  schnurY(x) {
    const k = (x - this.von) / (this.bis - this.von);
    return this.y + this.durchhang * 4 * k * (1 - k);
  }

  platz(i) {
    const schritt = (this.bis - this.von) / (this.anzahl + 1);
    const x = this.von + schritt * (i + 1);
    return { x, y: this.schnurY(x) };
  }

  /** Kärtchen erzeugen (Ursprung = Klammer an der Schnur). */
  karte(tier) {
    const c = new PIXI.Container({ label: 'kundenkarte' });
    const g = new PIXI.Graphics();
    g.roundRect(-KARTE_B / 2 + 4, 14, KARTE_B, KARTE_H, 16).fill({ color: 0x8a5a3a, alpha: 0.14 });
    g.roundRect(-KARTE_B / 2, 8, KARTE_B, KARTE_H, 16).fill(0xfff8ec).stroke({ width: 5, color: pick([0xf4a6b6, 0x9fd8c0, 0xf7cf7a, 0xb9c8f2]) });
    g.roundRect(-KARTE_B / 2 + 10, 18, KARTE_B - 20, KARTE_H - 22, 10).fill(pick([0xfde3ea, 0xe2f4ec, 0xfdf0cf, 0xe6ecfb]));
    // Klammer
    g.roundRect(-9, -6, 18, 26, 6).fill(0xe0a878).stroke({ width: 3, color: 0xb07040 });
    c.addChild(g);
    const s = spr(`tiere/${tier}_happy`, { parent: c });
    const k = Math.min((KARTE_B - 22) / s.texture.width, (KARTE_H - 26) / s.texture.height);
    s.scale.set(k);
    s.position.set(0, 8 + KARTE_H - 8);   // Anker unten Mitte: steht auf dem unteren Rand des Bildfelds
    c.hitArea = new PIXI.Rectangle(-100, -20, 200, 200);
    c.zIndex = this.z + 1;
    c.tier = tier;
    let zuletzt = 0;
    // antippbar erst, wenn es an der Schnur hängt (beim Herfliegen ist es noch klein)
    c.antippbar = () => tap(c, () => {
      fx.wobble(c, 0.1);
      const jetzt = performance.now();
      if (jetzt - zuletzt > 1200) { zuletzt = jetzt; animal(tier); }
    }, { sound: null, squash: false });
    c.eventMode = 'none';
    return c;
  }

  /**
   * Neues Kärtchen: fliegt von (x, y) an den nächsten Platz. Ist die Schnur voll, rutschen die anderen weiter und
   * das älteste schwebt sanft davon. → Promise
   */
  async dazu(tier, x, y) {
    const seite = this.seite;
    if (this.karten.length >= this.anzahl) {
      const alt = this.karten.shift();
      alt.eventMode = 'none';
      seite.tween(alt, { alpha: 0, y: alt.y + 40 }, 0.6, { ease: 'sineInOut' })
        .then(() => { if (!alt.destroyed) alt.destroy({ children: true }); });
      this.karten.forEach((k, i) => {
        const p = this.platz(i);
        seite.tween(k, { x: p.x, y: p.y }, 0.7, { ease: 'sineInOut' });
      });
      await seite.wait(0.4);
    }
    const c = this.karte(tier);
    c.position.set(x, y);
    c.scale.set(0.5);
    c.alpha = 0;
    seite.welt.addChild(c);
    seite.tween(c, { alpha: 1 }, 0.3, { ease: 'sineInOut' });
    const p = this.platz(this.karten.length);
    this.karten.push(c);
    await bogenFlug(seite, c, p.x, p.y, { dauer: 0.9, hoehe: 120, skala: 1 });
    if (c.destroyed) return;
    c.antippbar();
    note('pling', 84, { vol: 0.25 });
    // sanft auspendeln
    c.rotation = 0.12;
    await seite.tween(c, { rotation: -0.06 }, 0.5, { ease: 'sineInOut' });
    await seite.tween(c, { rotation: 0 }, 0.5, { ease: 'sineInOut' });
  }
}

// ---------------------------------------------------------------- Wimpelkette

export class WimpelKette {
  /**
   * Kette unter einem Bogen: y(x) = mitteY - hub·(x/halb)²  (folgt dem Rand des Sonnenschirms).
   * @param opt {von, bis, mitteY, hub, plaetze = 8, z}
   */
  constructor(seite, { von, bis, mitteY, hub, plaetze = 8, z = 3 }) {
    this.seite = seite;
    this.von = von;
    this.bis = bis;
    this.mitteY = mitteY;
    this.hub = hub;
    this.anzahl = plaetze;
    this.wimpel = [];
    this.z = z;
    const g = new PIXI.Graphics();
    g.moveTo(von, this.yBei(von));
    for (let i = 1; i <= 24; i++) {
      const x = von + ((bis - von) * i) / 24;
      g.lineTo(x, this.yBei(x) + Math.sin((i / 24) * Math.PI * 4) * 4);
    }
    g.stroke({ width: 7, color: 0xd9a066, cap: 'round', join: 'round' });
    g.eventMode = 'none';
    g.zIndex = z;
    seite.welt.addChild(g);
  }

  yBei(x) {
    const halb = (this.bis - this.von) / 2;
    const m = (x - (this.von + halb)) / halb;
    return this.mitteY - this.hub * m * m;
  }

  platz(i) {
    const schritt = (this.bis - this.von) / (this.anzahl + 1);
    const x = this.von + schritt * (i + 1);
    return { x, y: this.yBei(x) };
  }

  get voll() {
    return this.wimpel.length >= this.anzahl;
  }

  /** Ein Wimpel in Saftfarbe (Ursprung = oberer Rand an der Schnur). */
  baueWimpel(farbe) {
    const c = new PIXI.Container({ label: 'wimpel' });
    const g = new PIXI.Graphics();
    const rand = mische(farbe, 0x5a3a2a, 0.25);
    g.poly([-56, 4, 56, 4, 0, 122]).fill(farbe).stroke({ width: 6, color: rand, join: 'round' });
    g.roundRect(-58, -6, 116, 16, 8).fill(mische(farbe, 0xffffff, 0.45)).stroke({ width: 3, color: rand });
    g.circle(0, 44, 14).fill({ color: 0xffffff, alpha: 0.55 });
    c.addChild(g);
    c.hitArea = new PIXI.Rectangle(-100, -30, 200, 200);
    c.zIndex = this.z + 1;
    c.antippbar = () => tap(c, () => {
      fx.wobble(c, 0.14);
      note('glocke', pick([79, 81, 84, 86]), { vol: 0.25 });
    }, { sound: null, squash: false });
    c.eventMode = 'none';
    return c;
  }

  /** Neuer Wimpel fliegt von (x, y) an seinen Platz. → Promise<boolean> (true = die Kette ist jetzt voll) */
  async dazu(farbe, x, y) {
    const seite = this.seite;
    const w = this.baueWimpel(farbe);
    w.position.set(x, y);
    w.scale.set(0.4);
    w.alpha = 0;
    seite.welt.addChild(w);
    seite.tween(w, { alpha: 1 }, 0.3, { ease: 'sineInOut' });
    const p = this.platz(this.wimpel.length);
    this.wimpel.push(w);
    await bogenFlug(seite, w, p.x, p.y, { dauer: 0.9, hoehe: 140, skala: 1 });
    if (w.destroyed) return false;
    w.antippbar();
    note('pling', 86, { vol: 0.25 });
    w.rotation = 0.14;
    seite.tween(w, { rotation: -0.07 }, 0.5, { ease: 'sineInOut' })
      .then((ok) => ok && seite.tween(w, { rotation: 0 }, 0.5, { ease: 'sineInOut' }));
    return this.voll;
  }

  /** Volle Kette: alle Wimpel wiegen nacheinander sanft (ein ruhiger Freuden-Moment). */
  async freuen() {
    for (const w of this.wimpel) {
      if (w.destroyed) continue;
      this.seite.tween(w, { rotation: 0.12 }, 0.3, { ease: 'sineInOut' })
        .then((ok) => ok && this.seite.tween(w, { rotation: 0 }, 0.45, { ease: 'sineInOut' }));
      await this.seite.wait(0.12);
    }
  }

  /** Alles weich abnehmen (danach beginnt eine neue Kette). */
  leeren() {
    const alle = this.wimpel;
    this.wimpel = [];
    alle.forEach((w, i) => {
      w.eventMode = 'none';
      this.seite.tween(w, { alpha: 0, y: w.y + 30 }, 0.6, { ease: 'sineInOut', delay: i * 0.06 })
        .then(() => { if (!w.destroyed) w.destroy({ children: true }); });
    });
  }
}

// ---------------------------------------------------------------- Marienkäfer

/** Kleiner Marienkäfer (gezeichnet). Antippen: er krabbelt/fliegt gemächlich ein Stück weiter. */
export class Marienkaefer extends PIXI.Container {
  constructor(seite, { parent, z = 6 } = {}) {
    super({ label: 'marienkaefer' });
    this.seite = seite;
    this.zIndex = z;
    const g = new PIXI.Graphics();
    g.ellipse(0, 4, 30, 8).fill({ color: 0x5a3a1a, alpha: 0.15 });
    g.circle(0, -30, 16).fill(0x2f2a33);                                  // Kopf
    g.circle(-6, -34, 4).fill(0xffffff);
    g.circle(6, -34, 4).fill(0xffffff);
    g.circle(-6, -34, 2).fill(0x2f2a33);
    g.circle(6, -34, 2).fill(0x2f2a33);
    g.ellipse(0, -8, 30, 26).fill(0xe8433f).stroke({ width: 3, color: 0xb02a2a });   // Panzer
    g.moveTo(0, -32).lineTo(0, 16).stroke({ width: 3, color: 0x7a1a1a });
    for (const [x, y, r] of [[-14, -14, 6], [13, -16, 5], [-11, 4, 5], [12, 3, 6]]) g.circle(x, y, r).fill(0x2f2a33);
    g.ellipse(-12, -22, 8, 4).fill({ color: 0xffffff, alpha: 0.45 });
    this.addChild(g);
    this.scale.set(0.9);
    this.hitArea = new PIXI.Circle(0, -10, 115);
    (parent || seite.welt).addChild(this);
    this.letzterTon = 0;
    tap(this, () => this.weiter(), { sound: null, squash: false });
  }

  /** Langsam zu einem Ort schweben (höchstens ~350 Einheiten/s). → Promise */
  fliegeZu(x, y) {
    const d = Math.hypot(x - this.x, y - this.y);
    return bogenFlug(this.seite, this, x, y, { dauer: Math.max(1.2, d / 350), hoehe: 90 });
  }

  weiter() {
    const jetzt = performance.now();
    if (jetzt - this.letzterTon > 700) {
      this.letzterTon = jetzt;
      note('pling', pick([86, 88, 91]), { vol: 0.3 });
    }
    fx.wobble(this, 0.15);
    if (this.orte?.length) {
      const neu = pick(this.orte.filter((o) => Math.hypot(o.x - this.x, o.y - this.y) > 60)) || this.orte[0];
      this.fliegeZu(neu.x + rand(-20, 20), neu.y);
    }
  }
}
