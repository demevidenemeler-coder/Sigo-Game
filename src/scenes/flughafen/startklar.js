// Seite 2: Startklar. Auf dem Vorfeld wird ein Flieger fertig gemacht – jede Runde ein anderer, mit eigenen Schritten:
//   Flugzeug:     tanken → Fenster putzen → Treppe heranfahren → Gäste steigen ein → Tür zu → Lotse winkt → Start
//   Hubschrauber: tanken → Fenster putzen → Gäste steigen ein → Tür zu → Lotse winkt → der Rotor dreht, er steigt auf
//   Doppeldecker: tanken → Brille putzen → der Pilot steigt in den offenen Sitz → Propeller anwerfen → Lotse → Start
//   Ballon:       Feuer antippen, bis die Hülle groß ist → Gäste in den Korb → Leinen los → Lotse winkt → er schwebt
// Tanken: den Schlauch vom Tankwagen zum Flieger ziehen (oder die Düse antippen) – die Tankuhr füllt sich.
// Putzen: mit dem Schwamm über die Flecken am Fenster reiben (oder den Schwamm antippen – er putzt von selbst).
// Einsteigen: einen Gast (oder die Tür) antippen – einer nach dem anderen steigt ein und schaut aus dem Fenster.
// Der Lotsen-Bär winkt mit seinen Kellen, dann rollt der Flieger gemächlich los und hebt sanft ab (nichts rast).
// Sticker: erster Start (Flugzeug), erster Ballon. Der zuletzt gestartete Flieger fliegt auf Seite 3 weiter (store).

import { PIXI, spr, meta, tap, drag, fx, sfx, sfxSchleife, note, voice, store, rand, Actor } from '../../engine/index.js';
import { Seite, hgPunkt } from '../../gemeinsam/seiten.js';
import { belohne } from '../../gemeinsam/sticker.js';
import { bogenFlug, gleite, umhaengen, andersAls, kurz, GaesteReihe, tierKopf, leiserLaut, atme, zielRing } from './helfer.js';

const BODEN = 1430;
const FLIEGER_X = -60;
const GAST_SKALA = 0.36;
const REIHE = [{ x: -640, y: 1545 }, { x: -820, y: 1545 }, { x: -1000, y: 1545 }];
const DRAUSSEN = -1600;
const TANKWAGEN = { x: -830, y: 1500, s: 0.62 };
const EIMER = { x: 560, y: 1545 };
const TREPPE_WARTET = { x: 560, y: 1500 };
const BAER = { x: 870, y: 1575, s: 0.4 };

export const TYPEN = {
  flugzeug: {
    bild: 'flughafen/flugzeug', s: 1.05, gaeste: 3, fenster: ['f1', 'f2', 'f3'], fensterR: 26, tuer: [100, 205],
    schritte: ['tanken', 'putzen', 'treppe', 'einsteigen', 'tuer', 'lotse'],
  },
  hubschrauber: {
    bild: 'flughafen/hubschrauber', s: 0.95, gaeste: 2, fenster: ['f1', 'f2'], fensterR: 30, tuer: [105, 190],
    schritte: ['tanken', 'putzen', 'einsteigen', 'tuer', 'lotse'],
  },
  doppeldecker: {
    bild: 'flughafen/doppeldecker', s: 1.0, gaeste: 1, sitz: true,
    schritte: ['tanken', 'putzen', 'einsteigen', 'propeller', 'lotse'],
  },
  ballon: { gaeste: 2, schritte: ['aufblasen', 'einsteigen', 'leinen', 'lotse'] },
};
const TYP_IDS = Object.keys(TYPEN);
const SATZ = {
  tanken: 'flughafen_tanken', putzen: 'flughafen_putzen', einsteigen: 'flughafen_einsteigen', lotse: 'flughafen_lotse',
  aufblasen: 'flughafen_aufblasen',
};

export class Startklar extends Seite {
  static hg = 'flughafen/hg_vorfeld';

  aufbau() {
    this.runde = 0;
    this.typ = null;
    this.letzterTyp = null;
    this.schritt = 'leer';
    this.reihe = new GaesteReihe();
    this.gaeste = [];          // wartende Gäste (vorn = der nächste)
    this.drin = 0;             // eingestiegene Gäste
    this.unterwegs = 0;        // Gäste auf dem Weg hinein
    this.platzNr = 0;
    this.steigt = false;
    this.flecken = [];
    this.uhr = 0;
    this.baueBaer();
    this.baueEimer();
    this.baueTankwagen();
    this.baueTreppe();
    this.baueFlecken();
    this.ring = zielRing(70);
    this.ring.zIndex = 45;
    this.ring.alpha = 0;
    this.welt.addChild(this.ring);
  }

  betreten() {
    if (this.besuche === 1) this.after(0.3, () => this.naechsteRunde());
    else this.hinweis(1.0);
  }

  verlassen() {
    this._hinweis?.kill();
    this._hinweis = null;
    this.motor?.aus(0.3);
    this.tankTon?.aus(0.3);
  }

  update(dt, t) {
    this.uhr = t;
    if (this.schlauch) this.zeichneSchlauch();
    if (this.ring.alpha > 0) atme(this.ring, t);
    // Ballon: die Hülle wiegt sich sanft; schwebender Korb wippt
    const f = this.flieger;
    if (f && !f.destroyed) {
      if (f.huelle) f.huelle.rotation = 0.02 * Math.sin(t * 1.3);
      if (f.rotor && f.rotor.alpha > 0) f.rotor.scale.x = 1 + 0.05 * Math.sin(t * 9);
      if (f.prop && f.prop.alpha > 0) f.prop.scale.y = 1 + 0.06 * Math.sin(t * 9);
    }
  }

  // ---------------------------------------------------------------- Aufbau

  baueBaer() {
    const b = new Actor('baer', { x: BAER.x, y: BAER.y, scale: BAER.s, parent: this.welt, z: 50 });
    b.lookAt(BAER.x - 100);
    b.onTap(() => this.baerTipp(), { pad: 30 });
    this.baer = b;
    // Kellen links und rechts (grüne Abfahrts-Kellen)
    this.kellen = [-1, 1].map((seite) => {
      const k = spr('common/icon_los', { scale: 0.42, parent: this.welt, z: 51 });
      k.anchor.set(0.5, 0.95);
      k.position.set(BAER.x + seite * 125, BAER.y - 130);
      k.rotation = seite * 0.35;
      k.ruhe = k.rotation;
      k.eventMode = 'none';
      return k;
    });
  }

  baueEimer() {
    this.eimer = spr('common/eimer_wasser', { scale: 0.5, x: EIMER.x, y: EIMER.y, parent: this.welt, z: 30 });
    this.eimer.anchor.set(0.5, 1);
    tap(this.eimer, () => { fx.wobble(this.eimer, 0.05); sfx('common/platsch', { vol: 0.3 }); },
      { sound: null, squash: false, hitArea: new PIXI.Rectangle(-200, -420, 400, 420) });
    this.eimer.alpha = 0;
    this.eimer.eventMode = 'none';
    this.schwamm = spr('common/schwamm', { scale: 0.36, x: EIMER.x, y: EIMER.y - 200, parent: this.welt, z: 46 });
    this.schwamm.alpha = 0;
    this.schwamm.eventMode = 'none';
    this.schwamm.ziehen = drag(this.schwamm, {
      hitArea: new PIXI.Circle(0, 0, 330),
      heim: { x: EIMER.x, y: EIMER.y - 200 },
      onMove: () => this.reibe(),
      onDrop: (z, ctx) => {
        if (kurz(ctx) && this.schritt === 'putzen') { ctx.erledigt = true; this.putztVonSelbst(); }
        return undefined;
      },
    });
  }

  baueTankwagen() {
    this.tankwagen = spr('flughafen/tankwagen', { x: DRAUSSEN, y: TANKWAGEN.y, scale: TANKWAGEN.s, parent: this.welt, z: 32 });
    tap(this.tankwagen, () => { fx.wobble(this.tankwagen, 0.04); note('xylo', 65, { vol: 0.3 }); },
      { sound: null, hitArea: new PIXI.Rectangle(-320, -460, 640, 470) });
    this.schlauchG = new PIXI.Graphics();
    this.schlauchG.zIndex = 33;
    this.schlauchG.eventMode = 'none';
    this.welt.addChild(this.schlauchG);
    // Zapfdüse (gezeichnet), Ursprung = Griff
    const d = new PIXI.Container({ label: 'duese' });
    const g = new PIXI.Graphics();
    g.roundRect(-30, -26, 60, 52, 18).fill(0x3d8fd0).stroke({ width: 5, color: 0x2a6ea8 });
    g.roundRect(22, -12, 46, 24, 10).fill(0xb9c3cf).stroke({ width: 4, color: 0x8d99a8 });
    g.roundRect(-18, -18, 22, 8, 4).fill({ color: 0xffffff, alpha: 0.45 });
    d.addChild(g);
    d.zIndex = 47;
    d.visible = false;
    this.welt.addChild(d);
    this.duese = d;
    d.ziehen = drag(d, {
      hitArea: new PIXI.Circle(0, 0, 130),
      targets: () => (this.schritt === 'tanken' && this.tankPunkt ? [{ id: 'tank', ...this.tankPunkt, radius: 280 }] : []),
      onDrop: (z, ctx) => {
        if (this.schritt !== 'tanken' || this.tankt) return false;
        if (z || kurz(ctx)) { ctx.erledigt = true; this.tanken(); return undefined; }
        return false;
      },
    });
  }

  baueTreppe() {
    this.treppe = spr('flughafen/treppe', { x: 1700, y: TREPPE_WARTET.y, scale: 0.6, parent: this.welt, z: 34 });
    this.treppe.ziehen = drag(this.treppe, {
      hitArea: new PIXI.Rectangle(-300, -500, 600, 500),
      targets: () => (this.schritt === 'treppe' ? [{ id: 'tuer', ...this.treppenZiel(), radius: 360 }] : []),
      onDrop: (z, ctx) => {
        if (this.schritt === 'treppe' && (z || kurz(ctx))) { ctx.erledigt = true; this.treppeAndocken(); return undefined; }
        if (kurz(ctx)) { fx.wobble(this.treppe, 0.04); note('xylo', 67, { vol: 0.3 }); }
        return false;
      },
    });
  }

  baueFlecken() {
    for (const f of [
      { x: -820, y: 520, w: 330, h: 300, ton: () => note('glocke', 77, { vol: 0.25 }) },   // Hangar
      { x: 1110, y: 420, w: 220, h: 380, ton: () => note('glocke', 86, { vol: 0.25 }) },   // Turm
    ]) {
      const c = new PIXI.Container({ label: 'fleck' });
      c.position.set(f.x, f.y);
      c.hitArea = new PIXI.Rectangle(-f.w / 2, -f.h / 2, f.w, f.h);
      c.zIndex = 1;
      let zuletzt = 0;
      tap(c, () => {
        const jetzt = performance.now();
        if (jetzt - zuletzt < 700) return;
        zuletzt = jetzt;
        f.ton();
        this.burst('funkeln', f.x, f.y - 30, { count: 4 });
      }, { sound: null, squash: false });
      this.welt.addChild(c);
    }
  }

  // ---------------------------------------------------------------- Flieger

  /** Punkt des Fliegers in Seiten-Koordinaten. */
  fp(name) {
    const f = this.flieger;
    if (!f || f.destroyed || !f.bild) return { x: FLIEGER_X, y: BODEN - 200 };
    const p = hgPunkt(f.bild, TYPEN[this.typ].bild, name);
    return p ? { x: f.x + p.x, y: f.y + p.y } : { x: f.x, y: f.y - 200 };
  }

  baueFlieger(typ) {
    this.flieger?.destroy({ children: true });
    const T = TYPEN[typ];
    const f = new PIXI.Container({ label: 'flieger:' + typ, sortableChildren: true });
    f.position.set(FLIEGER_X, BODEN);
    f.zIndex = 20;
    this.welt.addChild(f);
    this.flieger = f;
    if (typ === 'ballon') return this.baueBallon(f);
    const b = spr(T.bild, { scale: T.s, parent: f, z: 5 });
    f.bild = b;
    tap(b, () => this.fliegerTipp(), { sound: null, squash: false });
    const lokal = (name) => hgPunkt(b, T.bild, name) || { x: 0, y: -200 };
    // Tür: dunkle Öffnung, die beim Öffnen weich erscheint
    if (T.tuer) {
      const p = lokal('tuer');
      const [w, h] = T.tuer.map((v) => v * T.s);
      const g = new PIXI.Graphics();
      g.roundRect(-w / 2, -h / 2, w, h, w * 0.38).fill(0x4a3a3a);
      g.roundRect(-w / 2 + 8, -h / 2 + 8, w - 16, 18, 9).fill({ color: 0xffffff, alpha: 0.12 });
      g.position.set(p.x, p.y);
      g.alpha = 0;
      g.zIndex = 6;
      g.eventMode = 'none';
      f.addChild(g);
      f.tuer = g;
    }
    // Rotor bzw. Propeller: weiche Scheibe, die beim Drehen erscheint
    if (typ === 'hubschrauber') {
      const p = lokal('rotor');
      const g = new PIXI.Graphics().ellipse(0, 0, 430 * T.s, 26).fill({ color: 0xffffff, alpha: 0.55 });
      g.position.set(p.x, p.y);
      g.alpha = 0;
      g.zIndex = 7;
      g.eventMode = 'none';
      f.addChild(g);
      f.rotor = g;
    }
    if (typ === 'doppeldecker') {
      const p = lokal('propeller');
      const g = new PIXI.Graphics().ellipse(0, 0, 26, 160 * T.s).fill({ color: 0xffffff, alpha: 0.55 });
      g.position.set(p.x + 6, p.y);
      g.alpha = 0;
      g.zIndex = 7;
      g.eventMode = 'none';
      f.addChild(g);
      f.prop = g;
      // Tippfläche am Propeller (nur zum Anwerfen)
      const t = new PIXI.Container({ label: 'propeller' });
      t.position.set(p.x - 20, p.y);
      t.hitArea = new PIXI.Rectangle(-130, -170, 260, 340);
      t.zIndex = 9;
      tap(t, () => this.propellerTipp(), { sound: null, squash: false });
      f.addChild(t);
      f.propTipp = t;
    }
    return f;
  }

  baueBallon(f) {
    const korbS = 0.9;
    const korb = spr('flughafen/korb', { scale: korbS, parent: f, z: 5 });
    const mk = meta('flughafen/korb');
    const korbOben = -mk.h * mk.ay * korbS + 30;
    const huelle = spr('flughafen/ballon', { y: korbOben + 20, scale: 1, parent: f, z: 1 });
    huelle.groesse = 0.3;
    huelle.scale.set(0.45, 0.3);
    f.huelle = huelle;
    f.bild = korb;
    f.korbOben = korbOben;
    tap(korb, () => this.fliegerTipp(), { sound: null, squash: false, hitArea: new PIXI.Rectangle(-230, -300, 460, 310) });
    tap(huelle, () => this.brennerTipp(), { sound: null, squash: false });
    // Brenner: kleine Flamme über dem Korb
    const flamme = new PIXI.Graphics();
    flamme.ellipse(0, -30, 30, 46).fill({ color: 0xffb347, alpha: 0.9 });
    flamme.ellipse(0, -22, 16, 28).fill({ color: 0xfff1a8, alpha: 0.95 });
    flamme.position.set(0, korbOben - 6);
    flamme.scale.set(0.5);
    flamme.zIndex = 3;
    flamme.eventMode = 'none';
    f.addChild(flamme);
    f.flamme = flamme;
    const brenner = new PIXI.Container({ label: 'brenner' });
    brenner.position.set(0, korbOben - 60);
    brenner.hitArea = new PIXI.Rectangle(-140, -140, 280, 220);
    brenner.zIndex = 8;
    tap(brenner, () => this.brennerTipp(), { sound: null, squash: false });
    f.addChild(brenner);
    f.brenner = brenner;
    return f;
  }

  fliegerTipp() {
    const f = this.flieger;
    if (!f) return;
    if (this.schritt === 'putzen') { this.fleckWeg(); return; }
    if (this.schritt === 'einsteigen') { this.einsteigenTipp(); return; }
    if (this.schritt === 'tuer') { this.tuerZu(); return; }
    if (this.schritt === 'aufblasen') { this.brennerTipp(); return; }
    fx.wobble(f.bild, 0.03);
    note('xylo', 60, { vol: 0.3 });
  }

  // ---------------------------------------------------------------- Ablauf

  waehleTyp() {
    if (this.runde === 0) return 'flugzeug';
    // spätestens in der dritten Runde kommt der Ballon
    if (this.runde === 2 && !this.ballonGesehen) return 'ballon';
    return andersAls(TYP_IDS, this.letzterTyp);
  }

  async naechsteRunde() {
    this.schritt = 'kommt';
    const typ = this.waehleTyp();
    this.typ = typ;
    this.letzterTyp = typ;
    if (typ === 'ballon') this.ballonGesehen = true;
    const f = this.baueFlieger(typ);
    this.drin = 0;
    this.unterwegs = 0;
    this.platzNr = 0;
    await this.ankunft(f, typ);
    if (f !== this.flieger) return;
    this.schritte = TYPEN[typ].schritte.slice();
    this.weiter();
  }

  async ankunft(f, typ) {
    if (typ === 'flugzeug' || typ === 'doppeldecker') {
      f.x = -1900;
      const m = this.motorAn();
      await this.tween(f, { x: FLIEGER_X }, 3.4, { ease: 'sineOut' });
      this.motorAus(m, 0.6);
    } else if (typ === 'hubschrauber') {
      f.position.set(FLIEGER_X + 500, -500);
      f.rotor.alpha = 1;
      const m = this.motorAn();
      await this.tween(f, { x: FLIEGER_X, y: BODEN }, 3.6, { ease: 'sineOut' });
      this.motorAus(m, 0.8);
      this.tween(f.rotor, { alpha: 0 }, 1.2, { ease: 'sineInOut' });
    } else {
      f.alpha = 0;
      this.tween(f, { alpha: 1 }, 0.8, { ease: 'sineInOut' });
      sfx('common/plopp', { vol: 0.4 });
      await this.wait(0.9);
    }
    if (!f.destroyed) fx.pop(f.bild, 0.04);
  }

  weiter() {
    this.ring.alpha = 0;
    const s = this.schritte.shift();
    this.schritt = s || 'leer';
    if (!s) return;
    this['beginne_' + s]?.();
    this.hinweis(0.9);
  }

  /** Schritt fertig (nur, wenn er wirklich dran war). */
  fertig(s) {
    if (this.schritt !== s) return;
    this.schritt = 'zwischen';
    this.after(0.4, () => this.weiter());
  }

  sag(id, schritt, sek) {
    this._hinweis?.kill();
    const passt = () => this.aktiv && this.schritt === schritt;
    this._hinweis = this.after(sek, () => { if (passt()) voice(id, { nurWenn: passt }); });
  }

  hinweis(sek) {
    const id = SATZ[this.schritt];
    if (id) this.sag(id, this.schritt, sek);
  }

  // ---------------------------------------------------------------- Tanken

  async beginne_tanken() {
    this.tankwagen.x = DRAUSSEN;
    const m = this.motorAn();
    await gleite(this, this.tankwagen, TANKWAGEN.x, TANKWAGEN.y, 420);
    this.motorAus(m);
    if (this.schritt !== 'tanken') return;
    fx.pop(this.tankwagen, 0.04);
    // Düse hängt an der Schlauchrolle
    this.schlauchStart = this.tankwagenPunkt();
    this.duese.position.set(this.schlauchStart.x + 20, this.schlauchStart.y + 60);
    this.duese.heim = { x: this.duese.x, y: this.duese.y };
    this.duese.visible = true;
    this.duese.alpha = 0;
    this.tween(this.duese, { alpha: 1 }, 0.4, { ease: 'sineInOut' });
    this.schlauch = true;
    this.tankPunkt = this.fp('tank');
    this.ring.position.set(this.tankPunkt.x, this.tankPunkt.y);
    this.tween(this.ring, { alpha: 0.8 }, 0.6, { ease: 'sineInOut' });
  }

  tankwagenPunkt() {
    const p = hgPunkt(this.tankwagen, 'flughafen/tankwagen', 'schlauch') || { x: TANKWAGEN.x - 140, y: TANKWAGEN.y - 160 };
    return p;
  }

  zeichneSchlauch() {
    const g = this.schlauchG;
    g.clear();
    if (!this.duese.visible) return;
    const a = this.schlauchStart;
    const b = this.duese;
    const mx = (a.x + b.x) / 2;
    const my = Math.max(a.y, b.y) + 90;
    g.moveTo(a.x, a.y).quadraticCurveTo(mx, my, b.x - 24, b.y).stroke({ width: 18, color: 0x4a9ad0, cap: 'round' });
    g.moveTo(a.x, a.y - 4).quadraticCurveTo(mx, my - 6, b.x - 24, b.y - 5).stroke({ width: 5, color: 0xffffff, alpha: 0.3, cap: 'round' });
  }

  async tanken() {
    if (this.tankt) return;
    this.tankt = true;
    const d = this.duese;
    d.eventMode = 'none';
    const t = this.tankPunkt;
    await bogenFlug(this, d, t.x - 40, t.y + 10, { dauer: 0.5, hoehe: 60 });
    this.tween(this.ring, { alpha: 0 }, 0.4, { ease: 'sineInOut' });
    sfx('common/klack', { vol: 0.4 });
    // Tankuhr: der Zeiger wandert von links nach rechts
    const uhr = tankUhr();
    uhr.position.set(t.x, t.y - 150);
    uhr.zIndex = 48;
    uhr.scale.set(0.5);
    this.welt.addChild(uhr);
    this.tween(uhr, { scale: 1 }, 0.4, { ease: 'backOut' });
    if (!this.tankTon) this.tankTon = sfxSchleife('common/giessen', { vol: 0.3 });
    if (this.aktiv) this.tankTon.an(0.3);
    await this.tween(uhr.zeiger, { rotation: 1.2 }, 2.6, { ease: 'sineInOut' });
    this.tankTon.aus(0.4);
    note('glocke', 84, { vol: 0.3 });
    this.after(0.16, () => note('glocke', 88, { vol: 0.3 }));
    this.burst('funkeln', uhr.x, uhr.y, { count: 4 });
    await this.wait(0.6);
    this.tween(uhr, { alpha: 0, scale: 0.8 }, 0.4, { ease: 'sineInOut' }).then(() => { if (!uhr.destroyed) uhr.destroy({ children: true }); });
    // Düse zurück, Tankwagen fährt weg
    await bogenFlug(this, d, d.heim.x, d.heim.y, { dauer: 0.6, hoehe: 80 });
    this.tween(d, { alpha: 0 }, 0.3, { ease: 'sineInOut' });
    await this.wait(0.3);
    d.visible = false;
    this.schlauch = false;
    this.schlauchG.clear();
    d.eventMode = 'static';
    this.tankt = false;
    fx.pop(this.tankwagen, 0.05);
    sfx('common/hupe', { vol: 0.2 });
    const m = this.motorAn();
    gleite(this, this.tankwagen, DRAUSSEN, TANKWAGEN.y, 450).then(() => this.motorAus(m));
    this.fertig('tanken');
  }

  // ---------------------------------------------------------------- Putzen

  beginne_putzen() {
    // Flecken auf dem Fenster (weiche, matte Kleckse)
    const c = this.fp('cockpit');
    const s = TYPEN[this.typ].s;
    const f = this.flieger;
    this.flecken = [];
    const orte = [[-50, -10], [30, -30], [10, 30], [-20, 55]];
    for (const [dx, dy] of orte) {
      const g = new PIXI.Graphics();
      const r = rand(24, 34);
      g.circle(0, 0, r).fill({ color: 0x9b7b55, alpha: 0.7 });
      g.circle(r * 0.5, -r * 0.3, r * 0.55).fill({ color: 0x9b7b55, alpha: 0.6 });
      g.position.set(c.x - f.x + dx * s, c.y - f.y + dy * s);
      g.zIndex = 8;
      g.eventMode = 'none';
      g.alpha = 0;
      f.addChild(g);
      this.tween(g, { alpha: 1 }, 0.6, { ease: 'sineInOut' });
      this.flecken.push(g);
    }
    // Eimer und Schwamm erscheinen
    this.tween(this.eimer, { alpha: 1 }, 0.5, { ease: 'sineInOut' });
    this.eimer.eventMode = 'static';
    this.schwamm.position.set(EIMER.x, EIMER.y - 200);
    this.tween(this.schwamm, { alpha: 1 }, 0.5, { ease: 'sineInOut' });
    this.schwamm.eventMode = 'static';
  }

  /** Schwamm wird über das Fenster gezogen: Flecken in der Nähe verschwinden. */
  reibe() {
    if (this.schritt !== 'putzen') return;
    const s = this.schwamm;
    const f = this.flieger;
    for (const g of this.flecken) {
      if (g.weg) continue;
      if (Math.hypot(f.x + g.x - s.x, f.y + g.y - s.y) < 110) this.fleckWeg(g);
    }
  }

  fleckWeg(g = this.flecken.find((x) => !x.weg)) {
    if (!g || g.weg || this.schritt !== 'putzen') return;
    g.weg = true;
    sfx('common/wisch', { vol: 0.35 });
    const f = this.flieger;
    this.burst('blasen', f.x + g.x, f.y + g.y, { count: 3 });
    this.tween(g, { alpha: 0 }, 0.5, { ease: 'sineInOut' }).then(() => { if (!g.destroyed) g.destroy(); });
    if (this.flecken.every((x) => x.weg)) this.sauber();
  }

  async putztVonSelbst() {
    const s = this.schwamm;
    s.eventMode = 'none';
    const c = this.fp('cockpit');
    await bogenFlug(this, s, c.x, c.y, { dauer: 0.6, hoehe: 120 });
    for (let i = 0; i < 4 && this.schritt === 'putzen'; i++) {
      await this.tween(s, { x: c.x + (i % 2 ? -45 : 45), y: c.y + (i < 2 ? -20 : 30) }, 0.3, { ease: 'sineInOut' });
      this.fleckWeg();
    }
    s.eventMode = 'static';
  }

  async sauber() {
    this.schritt = 'sauber';
    const c = this.fp('cockpit');
    this.burst('funkeln', c.x, c.y, { count: 6 });
    note('glocke', 88, { vol: 0.3 });
    const s = this.schwamm;
    s.eventMode = 'none';
    await this.wait(0.4);
    await bogenFlug(this, s, EIMER.x, EIMER.y - 200, { dauer: 0.6, hoehe: 100 });
    sfx('common/platsch', { vol: 0.3 });
    this.tween(s, { alpha: 0 }, 0.4, { ease: 'sineInOut' });
    this.eimer.eventMode = 'none';
    this.tween(this.eimer, { alpha: 0 }, 0.5, { ease: 'sineInOut', delay: 0.2 });
    this.schritt = 'putzen';
    this.fertig('putzen');
  }

  // ---------------------------------------------------------------- Treppe

  treppenZiel() {
    // Plattform der Treppe genau unter die Tür
    const tu = this.fp('tuer_unten');
    const m = meta('flughafen/treppe');
    const pl = m.pts.plattform;
    const s = (TREPPE_WARTET.y - tu.y) / (m.h * m.ay - pl[1]);
    return { x: tu.x - (pl[0] - m.w * m.ax) * s, y: TREPPE_WARTET.y, s };
  }

  async beginne_treppe() {
    const z = this.treppenZiel();
    this.treppe.scale.set(z.s);
    this.treppe.x = 1700;
    const m = this.motorAn();
    await gleite(this, this.treppe, TREPPE_WARTET.x, TREPPE_WARTET.y, 420);
    this.motorAus(m);
    fx.pop(this.treppe, 0.04);
  }

  async treppeAndocken() {
    if (this.schritt !== 'treppe') return;
    this.schritt = 'treppe_faehrt';
    const z = this.treppenZiel();
    this.treppe.eventMode = 'none';
    const m = this.motorAn();
    await gleite(this, this.treppe, z.x, z.y, 380);
    this.motorAus(m, 0.4);
    sfx('common/klack', { vol: 0.4 });
    fx.pop(this.treppe, 0.03);
    await this.wait(0.2);
    this.tuerAuf();
    this.treppe.eventMode = 'static';
    this.schritt = 'treppe';
    this.fertig('treppe');
  }

  tuerAuf() {
    const t = this.flieger?.tuer;
    if (!t) return;
    sfx('common/tuer', { vol: 0.35 });
    this.tween(t, { alpha: 0.9 }, 0.6, { ease: 'sineInOut' });
  }

  // ---------------------------------------------------------------- Einsteigen

  async beginne_einsteigen() {
    const T = TYPEN[this.typ];
    if (this.typ === 'hubschrauber') this.tuerAuf();
    this.gaeste = [];
    this.einsteigWunsch = 0;
    for (let i = 0; i < T.gaeste; i++) {
      const id = this.reihe.naechster(this.gaeste.map((g) => g.tierId));
      const p = REIHE[i];
      const a = new Actor(id, { x: DRAUSSEN - i * 200, y: p.y, scale: GAST_SKALA, parent: this.welt, z: 40 + i });
      a.onTap(() => this.einsteigenTipp(a), { pad: 30 });
      this.gaeste.push(a);
      a.walkTo(p.x, p.y, { tempo: 420 }).then((ok) => { if (ok && !a.destroyed) a.lookAt(p.x + 100); });
    }
    if (this.typ === 'ballon' && this.flieger.huelle) this.tween(this.flieger.huelle, { rotation: 0 }, 0.2);
  }

  einsteigenTipp(a) {
    if (this.schritt !== 'einsteigen') {
      if (a) { fx.wobble(a, 0.06); leiserLaut(a); }
      return;
    }
    // Auch wer schon unterwegs ist, zählt: Antippen heißt „der Nächste, bitte!"
    if (a && !this.gaeste.includes(a)) fx.wobble(a, 0.04);
    this.einsteigWunsch = Math.min(this.einsteigWunsch + 1, this.gaeste.length);
    if (!this.steigt) this.naechsterSteigtEin();
  }

  async naechsterSteigtEin() {
    // Der nächste Gast darf los, sobald der vorige an der Treppe/Tür angekommen ist – so wartet niemand lange.
    while (this.einsteigWunsch > 0 && this.gaeste.length && this.schritt === 'einsteigen') {
      this.einsteigWunsch--;
      this.steigt = true;
      const a = this.gaeste.shift();
      this.unterwegs++;
      const rein = this.steigeEin(a, this.platzNr++);
      rein.then(() => { this.unterwegs--; this.einsteigenFertig(); });
      await rein.angekommen;
      // die anderen rücken auf
      this.gaeste.forEach((g, i) => g.walkTo(REIHE[i].x, REIHE[i].y, { tempo: 460 }));
    }
    this.steigt = false;
    this.einsteigWunsch = 0;
    this.einsteigenFertig();
  }

  einsteigenFertig() {
    if (!this.gaeste.length && !this.unterwegs && !this.steigt && this.schritt === 'einsteigen') this.fertig('einsteigen');
  }

  /** Ein Gast steigt ein. → Promise (fertig drin) mit .angekommen (Promise: an Treppe/Tür angekommen). */
  steigeEin(a, nr) {
    let angekommen;
    const da = new Promise((res) => { angekommen = res; });
    const lauf = this.steigeEinAblauf(a, nr, angekommen).finally(() => angekommen());
    lauf.angekommen = da;
    return lauf;
  }

  async steigeEinAblauf(a, nr, angekommen) {
    if (a.destroyed) return;
    const typ = this.typ;
    const f = this.flieger;
    leiserLaut(a);
    if (typ === 'flugzeug') {
      const tr = this.treppe;
      const s = tr.scale.x;
      const fuss = { x: tr.x + 175 * s, y: TREPPE_WARTET.y + 20 };
      await a.walkTo(fuss.x, fuss.y, { tempo: 520 });
      angekommen();
      const tu = this.fp('tuer_unten');
      await a.hopTo((fuss.x + tu.x) / 2 + 30, (fuss.y + tu.y) / 2 + 10, { hoehe: 60, dauer: 0.45 });
      await a.hopTo(tu.x + 30, tu.y + 6, { hoehe: 60, dauer: 0.45 });
      a.lookAt(tu.x - 100);
      await this.indieTuer(a);
    } else if (typ === 'hubschrauber') {
      const tu = this.fp('tuer_unten');
      await a.walkTo(tu.x + 110, BODEN + 90, { tempo: 520 });
      angekommen();
      await a.hopTo(tu.x, tu.y + 10, { hoehe: 90, dauer: 0.55 });
      await this.indieTuer(a);
    } else if (typ === 'doppeldecker') {
      const sitz = this.fp('tuer_unten');
      await a.walkTo(sitz.x - 230, BODEN + 90, { tempo: 520 });
      angekommen();
      await a.hopTo(sitz.x, sitz.y + 30, { hoehe: 140, dauer: 0.7 });
      if (a.destroyed || f.destroyed) return;
      umhaengen(a, f);
      a.zIndex = 2;   // sitzt im offenen Sitz (unten verdeckt)
      a.lookAt(a.x + 100);
      this.drin++;
    } else {
      // Ballon: in den Korb (zwischen Hülle und Korbwand)
      const platz = nr % 2 === 0 ? -62 : 62;
      await a.walkTo(f.x + platz * 4, BODEN + 90, { tempo: 520 });
      angekommen();
      await a.hopTo(f.x + platz, f.y + f.korbOben + 150, { hoehe: 130, dauer: 0.7 });
      if (a.destroyed || f.destroyed) return;
      umhaengen(a, f);
      a.zIndex = 2;
      this.tween(a.scale, { x: a.scale.x * 0.82, y: a.scale.y * 0.82 }, 0.4, { ease: 'sineOut' });
      this.drin++;
    }
    if (!a.destroyed) a.pose('happy');
    this.after(0.6, () => { if (!a.destroyed) a.pose('idle'); });
  }

  /** In die Tür: Gast wird kleiner und verschwindet, sein Kopf erscheint im Fenster. */
  async indieTuer(a) {
    const T = TYPEN[this.typ];
    const f = this.flieger;
    await this.tween(a, { alpha: 0 }, 0.35, { ease: 'sineInOut' });
    const id = a.tierId;
    if (!a.destroyed) a.destroy({ children: true });
    if (!f || f.destroyed) return;
    const name = T.fenster[this.drin];
    this.drin++;
    if (!name) return;
    const p = hgPunkt(f.bild, T.bild, name);
    const k = tierKopf(id, T.fensterR * T.s);
    k.position.set(p.x, p.y);
    k.zIndex = 6;
    k.scale.set(0.3);
    f.addChild(k);
    this.tween(k, { scale: 1 }, 0.4, { ease: 'backOut' });
    sfx('common/plopp', { vol: 0.4 });
  }

  // ---------------------------------------------------------------- Tür, Propeller, Leinen

  beginne_tuer() {
    const t = this.fp('tuer');
    const c = new PIXI.Container({ label: 'tuer' });
    c.position.set(t.x, t.y);
    c.hitArea = new PIXI.Rectangle(-130, -150, 260, 300);
    c.zIndex = 44;
    tap(c, () => this.tuerZu(), { sound: null, squash: false });
    this.welt.addChild(c);
    this.tuerTipp = c;
    this.ring.position.set(t.x, t.y);
    this.tween(this.ring, { alpha: 0.7 }, 0.6, { ease: 'sineInOut' });
  }

  async tuerZu() {
    if (this.schritt !== 'tuer') return;
    this.schritt = 'tuer_zu';
    this.tuerTipp?.destroy();
    this.tuerTipp = null;
    this.ring.alpha = 0;
    const t = this.flieger?.tuer;
    sfx('common/tuer', { vol: 0.4 });
    if (t) await this.tween(t, { alpha: 0 }, 0.6, { ease: 'sineInOut' });
    if (this.typ === 'flugzeug') {
      const m = this.motorAn();
      gleite(this, this.treppe, 1700, TREPPE_WARTET.y, 420).then(() => this.motorAus(m, 0.4));
      await this.wait(0.8);
    }
    this.schritt = 'tuer';
    this.fertig('tuer');
  }

  beginne_propeller() {
    const p = this.fp('propeller');
    this.ring.position.set(p.x, p.y);
    this.tween(this.ring, { alpha: 0.7 }, 0.6, { ease: 'sineInOut' });
  }

  propellerTipp() {
    const f = this.flieger;
    if (this.schritt !== 'propeller') {
      fx.wobble(f.bild, 0.03);
      note('xylo', 64, { vol: 0.3 });
      return;
    }
    this.schritt = 'propeller_an';
    this.ring.alpha = 0;
    this.motorAn();
    this.tween(f.prop, { alpha: 1 }, 0.8, { ease: 'sineInOut' });
    this.after(1.0, () => { this.schritt = 'propeller'; this.fertig('propeller'); });
  }

  beginne_aufblasen() {
    this.blasen = 0;
    this.ring.position.set(this.flieger.x, this.flieger.y + this.flieger.korbOben - 40);
    this.tween(this.ring, { alpha: 0.7 }, 0.6, { ease: 'sineInOut' });
  }

  brennerTipp() {
    const f = this.flieger;
    if (!f?.flamme) return;
    // Flamme lodert sanft auf (ohne Blitzen)
    this.tween(f.flamme, { scale: 1.3 }, 0.25, { ease: 'sineOut' })
      .then((ok) => ok && this.tween(f.flamme, { scale: 0.5 }, 0.6, { ease: 'sineInOut' }));
    sfx('common/zisch', { vol: 0.3 });
    if (this.schritt !== 'aufblasen') return;
    this.blasen++;
    const g = Math.min(1, 0.3 + this.blasen * 0.24);
    this.tween(f.huelle, { scaleX: Math.min(1, 0.45 + this.blasen * 0.19), scaleY: g }, 0.8, { ease: 'backOut' });
    if (this.blasen >= 3) {
      this.schritt = 'aufgeblasen';
      this.ring.alpha = 0;
      this.after(0.9, () => {
        this.tween(f.huelle, { scaleX: 1, scaleY: 1 }, 0.4, { ease: 'sineInOut' });
        this.burst('funkeln', f.x, f.y - 650, { count: 5 });
        note('glocke', 84, { vol: 0.3 });
        this.schritt = 'aufblasen';
        this.fertig('aufblasen');
      });
    }
  }

  beginne_leinen() {
    const f = this.flieger;
    this.leinen = [-1, 1].map((seite) => {
      const c = new PIXI.Container({ label: 'leine' });
      const pflock = { x: f.x + seite * 330, y: BODEN + 40 };
      c.position.set(pflock.x, pflock.y);
      c.zIndex = 42;
      const g = new PIXI.Graphics();
      const oben = { x: seite * 150 - seite * 330, y: f.korbOben - 40 };
      g.moveTo(0, -30).quadraticCurveTo(oben.x * 0.5, oben.y * 0.4, oben.x, oben.y + 10)
        .stroke({ width: 11, color: 0xc89a5a, cap: 'round' });
      c.addChild(g);
      const p = new PIXI.Graphics();
      p.roundRect(-24, -80, 48, 92, 14).fill(0x9a7656).stroke({ width: 5, color: 0x7a5a40 });
      p.ellipse(0, -80, 28, 12).fill(0xb48e6a);
      c.addChild(p);
      c.seil = g;
      c.hitArea = new PIXI.Rectangle(-120, -230, 240, 260);
      tap(c, () => this.leineLos(c), { sound: null, squash: false });
      this.welt.addChild(c);
      c.alpha = 0;
      this.tween(c, { alpha: 1 }, 0.5, { ease: 'sineInOut' });
      return c;
    });
  }

  leineLos(c) {
    if (c.los || this.schritt !== 'leinen') return;
    c.los = true;
    sfx('common/rupf', { vol: 0.4 });
    this.tween(c.seil, { alpha: 0 }, 0.5, { ease: 'sineInOut' });
    fx.pop(c, 0.1);
    if (this.leinen.every((l) => l.los)) {
      this.schritt = 'leinen_los';
      const f = this.flieger;
      this.tween(f, { y: BODEN - 40 }, 1.2, { ease: 'sineInOut' });
      this.after(0.8, () => {
        for (const l of this.leinen) this.tween(l, { alpha: 0 }, 0.5).then(() => { if (!l.destroyed) l.destroy({ children: true }); });
        this.leinen = [];
      });
      this.after(1.3, () => { this.schritt = 'leinen'; this.fertig('leinen'); });
    }
  }

  // ---------------------------------------------------------------- Lotse und Start

  beginne_lotse() {
    fx.pulse(this.baer);
  }

  async baerTipp() {
    const b = this.baer;
    leiserLaut(b);
    this.winken();
    if (this.schritt !== 'lotse') return;
    this.schritt = 'start';
    this._hinweis?.kill();
    await this.wait(1.4);
    await this.start();
  }

  winken() {
    if (this.winkt) return;
    this.winkt = true;
    this.baer.pose('happy');
    for (const k of this.kellen) {
      const r = k.ruhe;
      this.tween(k, { rotation: r + Math.sign(r) * 0.45 }, 0.3, { ease: 'sineInOut', yoyo: true, repeat: 3 })
        .then(() => { k.rotation = r; });
    }
    this.after(1.4, () => { this.winkt = false; if (!this.baer.destroyed) this.baer.pose('idle'); });
  }

  async start() {
    const f = this.flieger;
    const typ = this.typ;
    const m = this.motorAn();
    // Alle verlassen das Bild rechts unterhalb der Ecke mit dem Album-Knopf (die bleibt frei).
    if (typ === 'flugzeug' || typ === 'doppeldecker') {
      if (f.prop) f.prop.alpha = 1;
      await this.tween(f, { x: 520 }, 3.2, { ease: 'quadIn' });
      this.tween(f, { rotation: -0.12 }, 1.4, { ease: 'sineInOut' });
      await this.tween(f, { x: 1950, y: 660 }, 4.2, { ease: 'sineIn' });
    } else if (typ === 'hubschrauber') {
      this.tween(f.rotor, { alpha: 1 }, 1.0, { ease: 'sineInOut' });
      await this.wait(1.2);
      await this.tween(f, { y: BODEN - 480 }, 2.6, { ease: 'sineInOut' });
      this.tween(f, { rotation: 0.08 }, 1.0, { ease: 'sineInOut' });
      await this.tween(f, { x: 1950, y: 760 }, 3.8, { ease: 'sineIn' });
    } else {
      this.tween(f.flamme, { scale: 1.1 }, 0.6, { ease: 'sineInOut' });
      sfx('common/zisch', { vol: 0.3 });
      await this.tween(f, { y: -700, x: f.x + 360 }, 8.0, { ease: 'sineIn' });
    }
    this.motorAus(m, 1.0);
    store.set('flughafen.flieger', typ);
    // Sticker: erster Start überhaupt, erster Ballon
    this.runde++;
    if (typ === 'ballon') belohne(this, 'flughafen_ballon', 300, 600);
    else if (!this.flugzeugSticker) { this.flugzeugSticker = true; belohne(this, 'flughafen_flugzeug', 300, 600); }
    await this.wait(1.2);
    this.naechsteRunde();
  }

  /**
   * Motorton an (eine ruhige Schleife für alle Fahrzeuge der Seite, fest leise). → Marke für motorAus: Ein späteres
   * „aus" eines älteren Ablaufs (z. B. die Treppe fährt noch weg) schaltet einen neueren Motor (Start) nicht ab.
   */
  motorAn() {
    if (!this.motor) this.motor = sfxSchleife('common/motor', { vol: 0.2, rate: 1.0 });
    this.motorNr = (this.motorNr || 0) + 1;
    if (this.aktiv) this.motor.an(0.4);
    return this.motorNr;
  }

  motorAus(nr, sek = 0.5) {
    if (nr === this.motorNr) this.motor?.aus(sek);
  }

  // ---------------------------------------------------------------- Zeige-Hand

  hinweise() {
    const f = this.flieger;
    switch (this.schritt) {
      case 'tanken':
        return this.duese.visible && this.tankPunkt ? [{ von: this.duese, nach: this.tankPunkt }] : [this.tankwagen];
      case 'putzen':
        return [{ von: this.schwamm, nach: this.fp('cockpit') }];
      case 'treppe': {
        const z = this.treppenZiel();
        return [{ von: this.treppe, nach: { x: z.x, y: z.y - 200 } }];
      }
      case 'einsteigen':
        return this.gaeste.length ? [this.gaeste[0]] : [];
      // Tür, Propeller und Brenner sind leere Tippflächen (ohne Bild, also ohne Größe) – die Hand bekommt den Punkt
      case 'tuer':
        return this.tuerTipp ? [{ x: this.tuerTipp.x, y: this.tuerTipp.y }] : [];
      case 'propeller':
        return f?.propTipp ? [this.fp('propeller')] : [];
      case 'aufblasen':
        return f?.brenner ? [{ x: f.x + f.brenner.x, y: f.y + f.brenner.y }] : [];
      case 'leinen':
        return (this.leinen || []).filter((l) => !l.los).slice(0, 1);
      case 'lotse':
        return [this.baer];
      case 'start':
        return [];   // der Flieger fliegt davon – die Hand zeigt auf den Pfeil: auf Seite 3 fliegt er weiter
      default:
        return f && !f.destroyed && f.bild ? [f.bild] : [this.baer];
    }
  }
}

/** Runde Tankuhr mit Zeiger (gezeichnet). Ursprung = Mitte. */
function tankUhr() {
  const c = new PIXI.Container({ label: 'tankuhr' });
  const g = new PIXI.Graphics();
  g.circle(0, 0, 78).fill(0xfff8ea).stroke({ width: 10, color: 0xf2a33c });
  // Skala: von rot (leer) über gelb zu grün (voll)
  g.arc(0, 0, 56, Math.PI * 1.1, Math.PI * 1.45).stroke({ width: 12, color: 0xf08a7a, cap: 'round' });
  g.arc(0, 0, 56, Math.PI * 1.55, Math.PI * 1.65).stroke({ width: 12, color: 0xf6d36b, cap: 'round' });
  g.arc(0, 0, 56, Math.PI * 1.75, Math.PI * 1.9).stroke({ width: 12, color: 0x7cc35a, cap: 'round' });
  c.addChild(g);
  const z = new PIXI.Graphics();
  z.roundRect(-5, -52, 10, 56, 5).fill(0x4a3a3a);
  z.rotation = -1.2;
  c.addChild(z);
  c.addChild(new PIXI.Graphics().circle(0, 0, 12).fill(0x4a3a3a));
  c.zeiger = z;
  c.eventMode = 'none';
  return c;
}
