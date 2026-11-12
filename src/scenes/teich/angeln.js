// Teich, Seite 2: Angeln (hg_angeln, Querschnitt mit Steg)
// - Auf dem Steg sitzt die Katze mit der Angel; an der Schnur hängt der runde Magnet-Köder.
// - Finger irgendwo ins Wasser: der Köder folgt weich (bleibt unter der Wasserlinie); kurzes Antippen holt ihn
//   ebenfalls dorthin. Berührt er einen Fisch oder eine Überraschung, hängt sie dran (Plopp). Fische haben
//   Vorrang (Überraschungen nur, wenn kein Fisch nah ist). Loslassen oder Finger nach oben ziehen → hochziehen.
// - Jeder Fisch schwimmt auf seiner eigenen Tiefenbahn im sichtbaren Bereich; höchstens fünf sind frei.
// - Fische kommen in den Glaseimer (sichtbar darin); Eimer antippen → sie hüpfen zurück ins Wasser.
// - Überraschungen werden groß gezeigt, die Katze reagiert (Krone auf, Stiefel schütteln …), bei besonderen
//   Funden gibt es einen Sticker. Am Grund liegen immer drei Dinge, neue sinken nach. Die Flaschenpost treibt
//   nach einem Fund erst eine Weile später wieder herein. Ein Krebs läuft am Grund (zwischen den Dingen).

import {
  Actor, spr, meta, tap, drag, fx, sfx, voice, note, killTweensOf, rand, pick, clamp, PIXI,
} from '../../engine/index.js';
import { Seite, hgPunkt } from '../../gemeinsam/seiten.js';
import { belohne } from '../../gemeinsam/sticker.js';
import { ton, freue, naechsterSticker, Ringe, Vogel, Wolken } from './deko.js';

const FISCHE = ['fisch_blau', 'fisch_gelb', 'fisch_orange', 'fisch_rosa', 'fisch_streifen'];
const GRUND_DINGE = ['stiefel', 'schatzkiste_klein', 'krone', 'seestern', 'muschel', 'schluessel_gold'];
const BESONDERS = ['krone', 'schatzkiste_klein'];            // gibt einen Sticker
// nur Sticker, die keine andere Runde des Teichs vergibt (Fische: teich_fisch, Enten: tier_ente/teich_seerose,
// Frosch: tier_frosch) – sonst nähme ein Fund diesen Runden ihren „neu"-Moment
const STICKER_LISTE = ['tier_pinguin'];
const SLOTS = [-380, -50, 290, 620, 930];                  // Plätze am Grund (x)
const KREBS_PLAETZE = [-215, 120, 455, 775];                // Ruheplätze des Krebses: zwischen den Dingen
const GRUND_ANZAHL = 3;
const FISCH_ZAHL = 4;                                       // so viele schwimmen normalerweise
const FISCH_MAX = 5;                                        // mehr sind nie frei (überzählige schwimmen davon)
const BAHN_ABSTAND = 125;                                   // Tiefenbahnen der Fische: WL+190, +125, …
const EIMER_MAX = 4;
const FISCH_SKALA = 0.5;
const EIMER_SKALA = 0.21;                                   // Fische im Eimer
const KOEDER_X = [-500, 1150];
const FISCH_X = [-450, 980];                                // Wendepunkte: ganz im Kernbereich
const FANG_R = 120;
const FANG_R_DING = 90;                                     // Überraschungen: etwas kleiner …
const DING_NUR_OHNE_FISCH = 200;                            // … und nur, wenn kein Fisch so nah ist
const ZEIGE = { x: 200, y: 360 };                           // dort wird ein Fund groß gezeigt

export class Angeln extends Seite {
  static hg = 'teich/hg_angeln';

  aufbau() {
    this.WL = this.punkt('wasserlinie', { x: 0, y: 560 }).y;
    this.GRUND = this.punkt('grund', { x: 0, y: 1500 }).y;
    this.gefangen = 0;
    this._p = new PIXI.Point();
    this._q = new PIXI.Point();
    this.ringe = new Ringe(this, this.welt, { n: 6, z: 480 });

    this.baueKatze();
    this.baueEimer();
    this.baueKoeder();
    this.baueWasserfeld();
    this.fische = [];
    // gleich verteilt und in beide Richtungen, damit sie nicht im Schwarm ziehen
    mische([-330, 60, 450, 840]).slice(0, FISCH_ZAHL).forEach((x) => {
      const f = this.neuerFisch(x + rand(-60, 60));
      f.blick = Math.random() < 0.5 ? 1 : -1;
      f.sx = f.blick;
    });
    this.fischUhr = 3;
    this.baueDinge();
    this.baueKrebs();

    this.vogel = new Vogel(this, this.welt, { yBereich: [110, 280] });
    this.wolken = new Wolken(this, this.hinten, [
      { id: 'common/wolke2', x: 380, y: 150, breite: 340, tempo: 6 },
      { id: 'common/wolke1', x: -150, y: 200, breite: 220, tempo: 4 },
    ]);
  }

  betreten() {
    this.blasen = this.emitter('blasen', { x: -240, y: 1420, rate: 0.25 });
    // „Zieh den Köder durchs Wasser." kurz nach dem Hereingleiten anbieten (der Kern sagt ihn höchstens einmal am
    // Tag) – nur, wenn das Kind auf dieser Seite den Köder noch nicht geführt hat und die Seite noch zu sehen ist
    this.geangeltHier = false;
    this._hinweis?.kill();
    const passt = () => this.aktiv && !this.geangeltHier && !this.haken;
    this._hinweis = this.after(2.5, () => { if (passt()) voice('teich_angeln', { nurWenn: passt }); });
  }

  verlassen() {
    this._hinweis?.kill();
    this._hinweis = null;
    this.blasen?.stop();
    this.blasen = null;
    this.finger = null;
    this.druck = null;
  }

  // ---------------------------------------------------------------- Katze mit Angel

  baueKatze() {
    const steg = this.punkt('steg', { x: -595, y: 455 });
    this.katze = new Actor('katze', { x: steg.x - 30, y: steg.y + 6, scale: 0.36, parent: this.welt, z: 50 });
    this.katze.onTap(() => freue(this, this.katze), { pad: 40 });

    // Angel in den Körper der Katze: hüpft und schüttelt mit
    const m = meta('teich/angel');
    const rute = new PIXI.Container({ label: 'angel' });
    const bild = spr('teich/angel', { parent: rute });
    const t = bild.texture;
    bild.anchor.set(m.pts.griff[0] / m.w, m.pts.griff[1] / m.h);
    rute.position.set(150, -175);
    rute.scale.set(0.55 / 0.36);
    this.ruteDreh = 0.42;
    rute.rotation = this.ruteDreh;
    this.spitzeLokal = {
      x: (m.pts.spitze[0] - m.pts.griff[0]) * (t.width / m.w),
      y: (m.pts.spitze[1] - m.pts.griff[1]) * (t.height / m.h),
    };
    this.katze.koerper.addChild(rute);
    this.rute = rute;
  }

  spitze() {
    this._p.set(this.spitzeLokal.x, this.spitzeLokal.y);
    this.rute.toGlobal(this._p, this._q);
    return this.welt.toLocal(this._q, undefined, this._p);
  }

  // ---------------------------------------------------------------- Eimer

  baueEimer() {
    const p = this.punkt('eimer', { x: -995, y: 455 });
    // Punkt liegt zu nah am Karten-Knopf: etwas nach rechts
    this.eimer = spr('teich/eimer_wasser_gross', { parent: this.welt, x: Math.max(p.x, -870), y: p.y + 4 });
    this.eimer.scale.set(0.46);
    this.eimer.zIndex = 40;
    this.innen = hgPunkt(this.eimer, 'innen') || { x: this.eimer.x, y: this.eimer.y - 75 };
    this.imEimer = [];
    tap(this.eimer, () => this.eimerGetippt(), { sound: null, pad: 45 });
  }

  eimerGetippt() {
    if (!this.imEimer.length) {
      fx.wobble(this.eimer, 0.06);
      ton('common/blubber', { vol: 0.5 });
      return;
    }
    ton('common/platsch', { vol: 0.4 }, 0.2);
    const liste = [...this.imEimer];
    this.imEimer = [];
    liste.forEach((f, i) => this.after(i * 0.28, () => this.fischZurueck(f)));
  }

  // ---------------------------------------------------------------- Köder, Schnur, Wasserfeld

  baueKoeder() {
    this.schnur = new PIXI.Graphics();
    this.schnur.zIndex = 690;
    this.welt.addChild(this.schnur);
    this.oberRing = spr('teich/wasserring', { parent: this.welt, anchor: 0.5 });
    this.oberRing.scale.set(0.24);
    this.oberRing.alpha = 0.5;
    this.oberRing.zIndex = 485;
    this.koeder = spr('teich/angelhaken', { parent: this.welt, anchor: 0.5 });
    this.koeder.scale.set(1.15);
    this.koeder.zIndex = 700;
    const sp = this.spitze();
    this.k = { x: sp.x + 140, y: this.WL + 230 };
    this.modus = 'frei';       // 'frei' | 'hoch'
    this.haken = null;         // was gerade dranhängt
    this.verweilen = 0;
    this.autoHoch = 0;
    this.hochHinweis = 0;      // Sekunden, bis „Jetzt nach oben ziehen!" kommt (nur, solange der Finger festhält)
    this.finger = null;
    this.fangBereit = false;   // darf der Köder gerade etwas fangen? (nur, wenn das Kind ihn geführt hat)
    this.rast = null;          // Ziel nach dem Loslassen (letzte Fingerstelle)
    this.buehne = null;        // Überraschung, die gerade groß gezeigt wird (solange keine neue fangen)
    this.warUnten = true;
    // zuletzt gezeichnete Schnur (neu zeichnen nur bei Bewegung). Unendlich statt NaN: |NaN - x| > 0,5 wäre immer
    // falsch, dann würde die Schnur nie gezeichnet.
    this.schnurAlt = { sx: Infinity, sy: Infinity, kx: Infinity, ky: Infinity, my: Infinity };
    this.durchhang = 45;
  }

  baueWasserfeld() {
    const feld = new PIXI.Container({ label: 'wasserfeld' });
    feld.zIndex = -50;
    this.welt.addChild(feld);
    this.feld = feld;
    // Eigener Zuhörer vor drag(): merkt sich, wo der Finger aufsetzt. drag() ruft onStart gleich danach im selben
    // pointerdown – darum genügt ein einziger Platz (der neueste Finger). Weitere Finger, die kein Ziehen beginnen
    // (ein Ding hängt an höchstens einem Finger), überschreiben ihn nur; nichts sammelt sich an.
    this.druck = null;
    feld.on('pointerdown', (e) => {
      const p = this.welt.toLocal(e.global, undefined, this._druckPunkt ??= new PIXI.Point());
      this.druck = { id: e.pointerId, x: p.x, y: p.y };
    });
    drag(feld, {
      // ganzes Wasser, außer der freien Ecke rechts unten (240×240) und 70 Einheiten Rand unten
      hitArea: new PIXI.Polygon([-620, this.WL - 40, 1480, this.WL - 40, 1480, 1350, 1030, 1350, 1030, 1530,
        -620, 1530]),
      lift: 1,
      back: false,
      onStart: (ctx) => {
        feld.zIndex = -50;   // bleibt hinten, damit Eimer, Katze und Krebs antippbar bleiben
        const d = this.druck;
        this.druck = null;
        const s = d && d.id === ctx.pointerId ? d : { x: this.k.x, y: this.k.y };
        this.finger = { x: s.x, y: s.y, sx: s.x, sy: s.y, ctx };
        this.geangeltHier = true;
        this.verweilen = 0;
        this.fangBereit = true;
      },
      onMove: (_, ctx) => {
        const f = this.finger;
        if (!f || f.ctx !== ctx) return;
        f.x = f.sx + (feld.x - ctx.startX);
        f.y = f.sy + (feld.y - ctx.startY);
        if (this.haken && this.modus === 'frei' && f.y < this.WL - 10) this.holeHoch();
      },
      onDrop: (_, ctx) => {
        killTweensOf(feld);
        feld.position.set(0, 0);
        if (this.finger && this.finger.ctx === ctx) {
          // die letzte Fingerstelle bleibt Ziel: auch ein kurzer Tipp holt den Köder ganz dorthin
          this.rast = { x: this.finger.x, y: this.finger.y };
          this.finger = null;
          this.verweilen = 1.8;
          if (this.haken && this.modus === 'frei') this.holeHoch();
        }
      },
    });
  }

  updateKoeder(dt, t) {
    const sp = this.spitze();
    if (this.modus === 'frei') {
      let zx;
      let zy;
      let weich = 1.4;
      if (this.finger) {
        zx = this.finger.x;
        zy = this.finger.y;
        weich = 7;
      } else if (this.verweilen > 0) {
        this.verweilen -= dt;
        zx = this.rast ? this.rast.x : this.k.x;
        zy = this.rast ? this.rast.y : this.k.y;
        weich = this.rast ? 5 : 1.4;
      } else {
        this.rast = null;
        // Ruheplatz knapp unter der Oberfläche, über der obersten Fischbahn
        zx = sp.x + 160 + Math.sin(t * 0.5) * 40;
        zy = this.WL + 100 + Math.sin(t * 0.8) * 12;
      }
      zx = clamp(zx, KOEDER_X[0], KOEDER_X[1]);
      zy = clamp(zy, this.WL + 55, this.GRUND - 75);
      const k = 1 - Math.exp(-dt * weich);
      this.k.x += (zx - this.k.x) * k;
      this.k.y += (zy - this.k.y) * k;
      if (this.haken) {
        this.autoHoch -= dt;
        if (!this.finger && this.autoHoch <= 0) this.holeHoch();
        // Hält der Finger das Ding eine Weile unten fest, ohne nach oben zu ziehen, hilft die Stimme
        if (this.finger && this.hochHinweis > 0) {
          this.hochHinweis -= dt;
          if (this.hochHinweis <= 0) this.sagHoch(this.haken);
        }
      } else if (this.finger || (this.verweilen > 0 && this.fangBereit)) {
        // Fangen nur, wenn das Kind den Köder führt (oder gerade losgelassen hat) – nie ganz von selbst
        this.pruefeFang();
      }
    }
    // Wieder ins Wasser getaucht: kleiner Ring, leises Platschen
    const unten = this.k.y > this.WL;
    if (unten && !this.warUnten) {
      this.ringe.ring(this.k.x, this.WL, 220);
      ton('common/platsch', { vol: 0.25, rate: 1.15 }, 0.5);
    }
    this.warUnten = unten;

    // Köder schaukelt leicht; Schnur von der Spitze zur Öse
    const ko = this.koeder;
    ko.position.set(this.k.x, this.k.y);
    ko.rotation = Math.sin(t * 1.4) * 0.08;
    const oseY = this.k.y - 70 * ko.scale.y + 6;
    const mx = (sp.x + this.k.x) / 2;
    // Durchhang: straff, solange der Finger zieht – weich übergeblendet
    this.durchhang += ((this.finger ? 10 : 45) - this.durchhang) * (1 - Math.exp(-dt * 4));
    const my = (sp.y + oseY) / 2 + this.durchhang;
    const alt = this.schnurAlt;
    if (Math.abs(alt.sx - sp.x) > 0.5 || Math.abs(alt.sy - sp.y) > 0.5 || Math.abs(alt.kx - this.k.x) > 0.5 ||
        Math.abs(alt.ky - oseY) > 0.5 || Math.abs(alt.my - my) > 0.5) {
      alt.sx = sp.x; alt.sy = sp.y; alt.kx = this.k.x; alt.ky = oseY; alt.my = my;
      this.schnur.clear()
        .moveTo(sp.x, sp.y)
        .quadraticCurveTo(mx, my, this.k.x, oseY)
        .stroke({ width: 4, color: 0xf8f3ea, alpha: 0.9 });
    }
    // Ring, wo die Schnur ins Wasser geht
    if (oseY > this.WL && sp.y < this.WL) {
      const a = (this.WL - sp.y) / (oseY - sp.y);
      this.oberRing.visible = true;
      this.oberRing.position.set(sp.x + (this.k.x - sp.x) * a, this.WL + 4);
      this.oberRing.alpha = 0.4 + Math.sin(t * 2) * 0.1;
    } else {
      this.oberRing.visible = false;
    }
    // Rute biegt sich ein wenig, wenn der Köder tief ist
    this.rute.rotation = this.ruteDreh + clamp((this.k.y - 800) / 4000, -0.04, 0.08);
  }

  // Fische haben Vorrang: der nächste Fisch im Fangradius; eine Überraschung nur, wenn kein Fisch nah ist
  // und gerade keine andere groß gezeigt wird
  pruefeFang() {
    let bester = null;
    let nd = Infinity;
    for (const f of this.fische) {
      if (f.zustand !== 'schwimmt' && f.zustand !== 'geht') continue;
      const d = Math.hypot(f.x - this.k.x, f.y - this.k.y);
      if (d < nd) { nd = d; bester = f; }
    }
    if (bester && nd < FANG_R) { this.haenge(bester); return; }
    if (this.buehne && this.buehne.zustand !== 'zeigt') this.buehne = null;   // Sicherheitsnetz
    if (nd < DING_NUR_OHNE_FISCH || this.buehne) return;
    for (const d of this.dinge) {
      if (d.zustand !== 'liegt' && d.zustand !== 'treibt') continue;
      if (Math.hypot(d.x - this.k.x, d.y - this.k.y) < FANG_R_DING) { this.haenge(d); return; }
    }
  }

  haenge(o) {
    this.haken = o;
    o.zustand = 'haengt';
    o.c.zIndex = 680;
    this.autoHoch = 1.0;
    // „Jetzt nach oben ziehen!" erst, wenn der Finger das Ding so lange unten hält (siehe updateKoeder). Lässt das
    // Kind los, geht der Fang ohnehin von selbst hoch – dann passte der Satz nicht mehr zum Geschehen.
    this.hochHinweis = 1.0;    // so lange, wie der Fang ohne Finger bis zum Hochgehen braucht (autoHoch)
    sfx('common/plopp', { vol: 0.7 });
    this.burst('blasen', this.k.x, this.k.y, { count: 4 });
  }

  // nur, solange genau dieses Ding noch am Haken unten im Wasser hängt und der Finger noch aufliegt (auch, wenn der
  // Satz erst nach einer Pause der Stimme an die Reihe kommt)
  sagHoch(o) {
    voice('teich_hoch', { nurWenn: () => this.aktiv && this.haken === o && this.modus === 'frei' && !!this.finger });
  }

  holeHoch() {
    if (this.modus === 'hoch') return;
    this.modus = 'hoch';
    const o = this.haken;
    ton('common/angel', { vol: 0.6 }, 0.5);
    const sp = this.spitze();
    this.tween(this.k, { x: sp.x + 170, y: this.WL - 210 }, 0.9, { ease: 'sineInOut' }).then(() => {
      this.haken = null;
      this.modus = 'frei';
      this.verweilen = 0.6;
      this.rast = null;
      if (!this.finger) this.fangBereit = false; // nach dem Hochziehen fängt er erst wieder mit dem Finger
      if (!o) return;
      if (o.fisch) this.fischInEimer(o);
      else this.zeigeDing(o);
    });
  }

  // ---------------------------------------------------------------- Fische

  // Tiefenbahn i (0 = oben) → y
  bahnY(i) {
    return this.WL + 190 + i * BAHN_ABSTAND;
  }

  // freie Bahn (keine andere Fisch hat sie gerade), sonst irgendeine
  freieBahn() {
    const belegt = new Set();
    for (const f of this.fische) {
      if (f.zustand === 'schwimmt' || f.zustand === 'haengt' || (f.zustand === 'fliegt' && f.insWasser)) belegt.add(f.bahn);
    }
    const frei = [0, 1, 2, 3, 4].filter((i) => !belegt.has(i));
    return frei.length ? pick(frei) : Math.floor(rand(0, 5));
  }

  neuerFisch(x = 1480) {
    const id = pick(FISCHE);
    const bahn = this.freieBahn();
    const f = this.figur('teich/' + id, x, this.bahnY(bahn), FISCH_SKALA);
    f.fisch = true;
    f.zustand = 'schwimmt';
    f.bahn = bahn;
    f.off = 0;              // Ausweichen (weich, ±60)
    f.neu = 0;              // Neugier zum Köder (weich, ±110)
    f.blick = x > 600 ? -1 : 1;
    f.sx = f.blick;
    f.tempo = rand(40, 65);
    this.neueWende(f);
    f.basisY = f.y;
    f.c.zIndex = 450;
    this.fische.push(f);
    return f;
  }

  // Jeder Fisch wendet an eigenen Stellen (immer wieder neu gewürfelt) – so ziehen sie nie im Gleichschritt
  neueWende(f) {
    f.wl = rand(FISCH_X[0], FISCH_X[0] + 280);
    f.wr = rand(FISCH_X[1] - 330, FISCH_X[1]);
  }

  // Ein bewegliches Ding: Container (Ort) + Bild (Größe, Blickrichtung)
  figur(id, x, y, s) {
    const c = new PIXI.Container({ label: 'ding:' + id });
    const bild = spr(id, { parent: c, anchor: 0.5 });
    c.position.set(x, y);
    this.welt.addChild(c);
    return { c, bild, id, x, y, s, sx: 1, phase: rand(0, 6), dreh: 0 };
  }

  sync(o) {
    o.c.position.set(o.x, o.y);
    o.bild.scale.set(o.s * o.sx, o.s);
    o.bild.rotation = o.dreh;
  }

  updateFische(dt, t) {
    let frei = 0;
    let heim = 0;
    // Neugier: nur der Fisch, der dem geführten Köder am nächsten ist
    let neugierig = null;
    if (this.finger && !this.haken && this.modus === 'frei') {
      let nd = 380;
      for (const f of this.fische) {
        if (f.zustand !== 'schwimmt') continue;
        const d = Math.hypot(this.k.x - f.x, this.k.y - f.y);
        if (d < nd) { nd = d; neugierig = f; }
      }
    }
    const weich = 1 - Math.exp(-dt * 1.2);
    for (const f of this.fische) {
      if (f.zustand === 'schwimmt' || f.zustand === 'geht') {
        if (f.zustand === 'schwimmt') frei++;
        const nah = f === neugierig;
        if (nah) {
          const dx = this.k.x - f.x;
          if (Math.abs(dx) > 30) f.blick = Math.sign(dx);
          f.neu += (clamp(this.k.y - this.bahnY(f.bahn), -110, 110) - f.neu) * weich;
        } else {
          f.neu -= f.neu * weich;
        }
        // Abstand zu anderen Fischen: sanft auseinander (nur in der Tiefe, die Bahn bleibt)
        let schub = 0;
        for (const g of this.fische) {
          if (g === f || (g.zustand !== 'schwimmt' && g.zustand !== 'geht')) continue;
          const ax = Math.abs(f.x - g.x);
          const ay = f.y - g.y;
          if (ax < 220 && Math.abs(ay) < 190) schub += (ay >= 0 ? 1 : -1) * (1 - ax / 220);
        }
        // auch der treibenden Flaschenpost weichen sie aus
        const post = this.post;
        if (post.zustand === 'treibt') {
          const ax = Math.abs(f.x - post.x);
          const ay = f.y - post.y;
          if (ax < 230 && Math.abs(ay) < 170) schub += (ay >= 0 ? 1.5 : -1.5) * (1 - ax / 230);
        }
        // … und dem ruhenden Köder (sonst sähe es aus, als hinge schon ein Fisch dran)
        if (!this.finger && this.verweilen <= 0 && !this.haken) {
          const ax = Math.abs(f.x - this.k.x);
          const ay = f.y - this.k.y;
          if (ax < 200 && Math.abs(ay) < 150) schub += (ay >= 0 ? 1.5 : -1.5) * (1 - ax / 200);
        }
        f.off = clamp(f.off + schub * 70 * dt - f.off * 0.5 * dt, -60, 60);
        f.x += f.blick * f.tempo * (nah ? 1.25 : 1) * dt;
        if (f.zustand === 'schwimmt') {
          if (f.x > f.wr && f.blick > 0) { f.blick = -1; this.neueWende(f); }
          if (f.x < f.wl && f.blick < 0) { f.blick = 1; this.neueWende(f); }
        }
        const zielY = clamp(this.bahnY(f.bahn) + f.off + f.neu, this.WL + 110, this.GRUND - 180);
        f.basisY += (zielY - f.basisY) * (1 - Math.exp(-dt * 1.5));   // weich (auch nach dem Platschen)
        f.y = f.basisY + Math.sin(t * 1.1 + f.phase) * 12;
        f.dreh = Math.sin(t * 2.2 + f.phase) * 0.05;
      } else if (f.zustand === 'haengt') {
        const halb = 380 * f.s * 0.4;
        f.x = this.k.x - f.blick * halb;
        f.y = this.k.y + 40;
        f.dreh = -f.blick * 0.35 + Math.sin(t * 7) * 0.12;
      } else if (f.zustand === 'eimer') {
        f.ex += f.blick * 22 * dt;
        if (f.ex > 40) f.blick = -1;
        if (f.ex < -40) f.blick = 1;
        f.x = this.innen.x + f.ex;
        f.y = this.innen.y + f.ey + Math.sin(t * 1.6 + f.phase) * 4;
        f.dreh = Math.sin(t * 2 + f.phase) * 0.06;
      } else if (f.zustand === 'fliegt' && f.insWasser) {
        heim++;
      }
      if (f.zustand !== 'fliegt') f.sx += (f.blick - f.sx) * (1 - Math.exp(-dt * 6));
      this.sync(f);
    }
    // Zu viele frei (z. B. nach dem Leeren des Eimers): die überzähligen ganz rechts schwimmen gemütlich davon
    for (let n = frei - FISCH_MAX; n > 0; n--) {
      let rechts = null;
      for (const f of this.fische) if (f.zustand === 'schwimmt' && (!rechts || f.x > rechts.x)) rechts = f;
      rechts.zustand = 'geht';
      rechts.blick = 1;
      rechts.tempo = 90;
    }
    // Davongeschwommen (rechts aus dem Bild): weg damit
    for (let i = this.fische.length - 1; i >= 0; i--) {
      const f = this.fische[i];
      if (f.zustand === 'geht' && f.x > 1460) {
        this.fische.splice(i, 1);
        f.c.destroy({ children: true });
      }
    }
    // immer wieder neue Fische (sie schwimmen von rechts herein)
    this.fischUhr -= dt;
    if (frei + heim < FISCH_ZAHL && this.fischUhr <= 0) {
      this.neuerFisch(1480);
      this.fischUhr = rand(3, 6);
    }
  }

  // Bogen von (o.x, o.y) nach (zx, zy) mit neuer Größe → Promise
  bogen(o, zx, zy, { hoehe = 220, dauer = 0.7, s = o.s } = {}) {
    const x0 = o.x;
    const y0 = o.y;
    const s0 = o.s;
    const p = { t: 0 };
    return this.tween(p, { t: 1 }, dauer, {
      ease: 'linear',
      onUpdate: () => {
        const e = p.t;
        o.x = x0 + (zx - x0) * e;
        o.y = y0 + (zy - y0) * e - hoehe * 4 * e * (1 - e);
        o.s = s0 + (s - s0) * e;
      },
    });
  }

  fischInEimer(f) {
    f.zustand = 'fliegt';
    f.insWasser = false;
    f.c.zIndex = 41;
    f.ex = rand(-30, 30);
    f.ey = rand(-30, 30);
    f.dreh = 0;
    this.bogen(f, this.innen.x + f.ex, this.innen.y + f.ey, { hoehe: 180, dauer: 0.75, s: EIMER_SKALA }).then((ok) => {
      if (!ok) return;
      f.zustand = 'eimer';
      f.c.alpha = 0.92;
      this.imEimer.push(f);
      ton('common/platsch', { vol: 0.45 }, 0.2);
      this.burst('tropfen', this.innen.x, this.innen.y - 120, { count: 6 });
      fx.pop(this.eimer, 0.05);
      freue(this, this.katze);
      this.gefangen++;
      if (this.gefangen % 3 === 0) {
        this.after(0.6, () => belohne(this, 'teich_fisch', ZEIGE.x, ZEIGE.y));
      }
      // „Tipp auf den Eimer …" nur, solange Fische drin sind und die Seite zu sehen ist
      const eimer = () => this.aktiv && this.imEimer.length > 0;
      if (this.gefangen === 2) this.after(2, () => { if (eimer()) voice('teich_eimer', { nurWenn: eimer }); });
      // Eimer voll: der älteste Fisch hüpft zurück ins Wasser
      if (this.imEimer.length > EIMER_MAX) {
        const alt = this.imEimer.shift();
        this.after(0.8, () => this.fischZurueck(alt));
      }
    });
  }

  fischZurueck(f) {
    this.imEimer = this.imEimer.filter((x) => x !== f);
    f.zustand = 'fliegt';
    f.insWasser = true;
    f.c.alpha = 1;
    f.c.zIndex = 450;
    const zx = rand(-350, 750);
    f.blick = Math.random() < 0.5 ? 1 : -1;
    this.bogen(f, zx, this.WL + 70, { hoehe: 260, dauer: 0.85, s: FISCH_SKALA }).then((ok) => {
      if (!ok) return;
      this.ringe.ring(zx, this.WL, 300);
      ton('common/platsch', { vol: 0.4 }, 0.25);
      f.zustand = 'schwimmt';
      f.insWasser = false;
      f.bahn = this.freieBahn();
      f.basisY = f.y;            // gleitet weich in seine Bahn hinab
      f.off = 0;
      f.neu = 0;
      f.tempo = rand(45, 70);
    });
  }

  // ---------------------------------------------------------------- Überraschungen

  baueDinge() {
    this.dinge = [];
    for (const id of GRUND_DINGE) {
      const d = this.ding(id, 170);
      d.art = 'grund';
      d.zustand = 'weg';
      d.c.visible = false;
    }
    // Gummiente treibt oben, Flaschenpost schwebt im Wasser
    const ente = this.ding('gummiente', 150);
    ente.art = 'oben';
    ente.zustand = 'treibt';
    ente.x = 700;
    ente.richtung = -1;
    const post = this.ding('flaschenpost', 180);
    this.post = post;
    post.art = 'mitte';
    post.zustand = 'treibt';
    post.x = 200;
    post.richtung = 1;
    // drei Dinge liegen schon am Grund
    for (const id of mische(GRUND_DINGE).slice(0, GRUND_ANZAHL)) {
      const d = this.dinge.find((x) => x.name === id);
      d.slot = this.freierSlot();
      d.x = SLOTS[d.slot];
      d.y = this.grundY(d);
      d.zustand = 'liegt';
      d.c.visible = true;
    }
  }

  ding(name, groesse) {
    const id = 'teich/' + name;
    const m = meta(id);
    const s = groesse / Math.max(m.w || 300, m.h || 300);
    const d = this.figur(id, 0, 0, s);
    d.name = name;
    d.basisS = s;
    d.c.zIndex = 420;
    d.slot = -1;
    this.dinge.push(d);
    return d;
  }

  grundY(d) {
    const m = meta(d.id);
    return this.GRUND - (m.h || 300) * d.s * 0.5 + 12;
  }

  freierSlot() {
    const belegt = new Set(this.dinge.filter((d) => d.art === 'grund' && d.zustand !== 'weg').map((d) => d.slot));
    const frei = SLOTS.map((_, i) => i).filter((i) => !belegt.has(i));
    return frei.length ? pick(frei) : 0;
  }

  updateDinge(dt, t) {
    let da = 0;
    for (const d of this.dinge) {
      if (d.zustand === 'treibt') {
        d.x += d.richtung * (d.art === 'oben' ? 24 : 16) * dt;
        if (d.x > FISCH_X[1] && d.richtung > 0) d.richtung = -1;
        if (d.x < FISCH_X[0] && d.richtung < 0) d.richtung = 1;
        // Höhe weich nachführen (nach dem Platschen sinkt die Flaschenpost sanft, statt zu springen)
        const zielY = d.art === 'oben'
          ? this.WL + 8 + Math.sin(t * 1.5 + d.phase) * 5
          : 960 + Math.sin(t * 0.7 + d.phase) * 40;
        d.y += (zielY - d.y) * (1 - Math.exp(-dt * (d.art === 'oben' ? 6 : 1.5)));
        if (d.art === 'oben') {
          d.dreh = Math.sin(t * 1.2 + d.phase) * 0.08;
          d.sx += (d.richtung - d.sx) * (1 - Math.exp(-dt * 4));
        } else {
          d.dreh = Math.sin(t * 0.9 + d.phase) * 0.18;
        }
      } else if (d.zustand === 'liegt') {
        d.dreh = Math.sin(t * 0.8 + d.phase) * 0.03;
      } else if (d.zustand === 'haengt') {
        d.x = this.k.x;
        d.y = this.k.y + (meta(d.id).h || 300) * d.s * 0.45 + 30;
        d.dreh = Math.sin(t * 5) * 0.1;
      } else if (d.zustand === 'krone') {
        const kopf = this.katze.point('kopf');
        d.x = kopf.x + 6;
        d.y = kopf.y + 40;
        d.dreh = -0.08;
      }
      if (d.c.visible) this.sync(d);
      if (d.art === 'grund' && d.zustand !== 'weg') da++;
    }
    // Am Grund liegen immer drei Dinge – fehlt eins, sinkt bald ein neues herab
    if (da < GRUND_ANZAHL) {
      this.nachUhr = (this.nachUhr ?? 2.5) - dt;
      if (this.nachUhr <= 0) {
        this.nachUhr = 2.5;
        this.lassSinken();
      }
    }
  }

  lassSinken(d = null, startX = null) {
    if (!d) {
      const weg = this.dinge.filter((x) => x.art === 'grund' && x.zustand === 'weg');
      if (!weg.length) return;
      d = pick(weg);
    }
    d.zustand = 'sinkt';
    d.slot = this.freierSlot();
    d.c.visible = true;
    d.c.zIndex = 420;
    d.s = d.basisS;
    d.sx = 1;
    const x0 = startX ?? SLOTS[d.slot] + rand(-30, 30);
    const x1 = SLOTS[d.slot];
    d.x = x0;
    d.y = this.WL + 60;
    if (startX === null) {
      d.c.alpha = 0;
      this.tween(d.c, { alpha: 1 }, 0.8, { ease: 'sineInOut' });
    }
    const p = { t: 0 };
    const y0 = d.y;
    const y1 = this.grundY(d);
    this.tween(p, { t: 1 }, 3.2, {
      ease: 'sineInOut',
      onUpdate: () => {
        d.y = y0 + (y1 - y0) * p.t;
        d.x = x0 + (x1 - x0) * p.t + Math.sin(p.t * Math.PI * 2) * 30;
        d.dreh = Math.sin(p.t * Math.PI * 3) * 0.2 * (1 - p.t);
      },
    }).then((ok) => {
      if (!ok) return;
      d.zustand = 'liegt';
      this.burst('staub', d.x, this.GRUND - 10, { count: 3 });
    });
  }

  zeigeDing(d) {
    this.buehne = d;
    d.zustand = 'zeigt';
    d.c.zIndex = 2000;
    d.dreh = 0;
    const gross = 300 / Math.max(meta(d.id).w || 300, meta(d.id).h || 300);
    this.bogen(d, ZEIGE.x, ZEIGE.y, { hoehe: 60, dauer: 0.55, s: gross }).then((ok) => {
      if (!ok) return;
      this.burst('funkeln', ZEIGE.x, ZEIGE.y, { count: 7 });
      ton('common/funkeln', { vol: 0.5 }, 0.3);
      if (BESONDERS.includes(d.name)) {
        belohne(this, naechsterSticker('teich_seerose', STICKER_LISTE), ZEIGE.x + 330, ZEIGE.y - 40);
      }
      this.after(1.3, () => this.reagiere(d));
    });
  }

  reagiere(d) {
    const katze = this.katze;
    switch (d.name) {
      case 'krone': {
        // Krone auf den Kopf der Katze
        this.vonDerBuehne(d);
        const kopf = katze.point('kopf');
        this.bogen(d, kopf.x + 6, kopf.y + 40, { hoehe: 120, dauer: 0.7, s: d.basisS * 0.95 }).then((ok) => {
          if (!ok) return;
          d.zustand = 'krone';
          d.c.zIndex = 60;
          freue(this, katze);
          note('glocke', 84, { vol: 0.4 });
          this.after(7, () => this.blendeAus(d));
        });
        break;
      }
      case 'stiefel': {
        // Katze schüttelt den Kopf, der Stiefel baumelt und tropft – und plumps, zurück ins Wasser
        katze.shake();
        sfx('common/nein', { vol: 0.5 });
        const w = { r: 0 };
        this.tween(w, { r: 1 }, 1.4, { ease: 'linear', onUpdate: () => { d.dreh = Math.sin(w.r * Math.PI * 4) * 0.3 * (1 - w.r * 0.5); } });
        this.burst('tropfen', d.x, d.y + 80, { count: 8 });
        this.after(1.6, () => this.wirfZurueck(d));
        break;
      }
      case 'gummiente': {
        note('floete', 86, { vol: 0.5, dauer: 0.18 });
        this.after(0.25, () => note('floete', 91, { vol: 0.5, dauer: 0.22 }));
        fx.pop(d.c, 0.18);
        freue(this, katze);
        this.after(1.2, () => this.wirfZurueck(d));
        break;
      }
      case 'flaschenpost': {
        // Katze nickt, die Flaschenpost verschwindet und treibt erst viel später wieder herein
        // (sonst würde sie immer wieder statt der Fische gefangen)
        katze.nod();
        note('glocke', 79, { vol: 0.4 });
        this.burst('funkeln', d.x, d.y, { count: 5 });
        this.after(1.2, () => this.blendeAus(d));
        break;
      }
      case 'seestern': {
        freue(this, katze);
        this.tween(d, { dreh: Math.PI * 2 }, 1.2, { ease: 'sineInOut' });
        this.after(1.4, () => this.blendeAus(d));
        break;
      }
      case 'muschel':
      case 'schluessel_gold': {
        note('glocke', 88, { vol: 0.4 });
        this.after(0.3, () => note('glocke', 91, { vol: 0.35 }));
        katze.nod();
        this.burst('funkeln', d.x, d.y, { count: 5 });
        this.after(1.4, () => this.blendeAus(d));
        break;
      }
      default: {
        freue(this, katze);
        this.after(1.4, () => this.blendeAus(d));
      }
    }
  }

  vonDerBuehne(d) {
    if (this.buehne === d) this.buehne = null;
  }

  // Fund verschwindet weich (Grund-Dinge kommen später wieder vom Grund, die Flaschenpost treibt nach 20–30 s
  // vom rechten Rand herein)
  blendeAus(d) {
    this.vonDerBuehne(d);
    this.burst('funkeln', d.x, d.y, { count: 4 });
    this.tween(d.c, { alpha: 0 }, 0.6, { ease: 'sineInOut' }).then(() => {
      d.zustand = 'weg';
      d.c.visible = false;
      d.c.alpha = 1;
      d.s = d.basisS;
      d.dreh = 0;
      if (d.art === 'mitte') this.after(rand(20, 30), () => this.treibHerein(d));
    });
  }

  treibHerein(d) {
    if (d.zustand !== 'weg') return;
    d.x = 1250;
    d.y = 980;
    d.s = d.basisS;
    d.sx = 1;
    d.richtung = -1;
    d.c.zIndex = 420;
    d.c.alpha = 0;
    d.c.visible = true;
    d.zustand = 'treibt';
    this.tween(d.c, { alpha: 1 }, 1.5, { ease: 'sineInOut' });
  }

  // Fund im Bogen zurück ins Wasser
  wirfZurueck(d) {
    this.vonDerBuehne(d);
    d.zustand = 'fliegt';
    d.c.zIndex = 420;
    d.dreh = 0;
    const zx = rand(-200, 800);
    ton('common/wusch', { vol: 0.3 }, 0.3);
    this.bogen(d, zx, this.WL + 10, { hoehe: 240, dauer: 0.8, s: d.basisS }).then((ok) => {
      if (!ok) return;
      this.ringe.ring(zx, this.WL, 320);
      ton('common/platsch', { vol: 0.45 }, 0.25);
      if (d.art === 'grund') this.lassSinken(d, zx);
      else {
        d.x = zx;
        d.zustand = 'treibt';
      }
    });
  }

  // ---------------------------------------------------------------- Krebs

  baueKrebs() {
    const c = new PIXI.Container({ label: 'krebs' });
    const bild = spr('teich/krebs', { parent: c });
    bild.scale.set(0.46);
    c.zIndex = 410;   // hinter den Dingen am Grund: läuft er vorbei, verdeckt er sie nicht
    this.welt.addChild(c);
    this.krebs = { c, bild, x: 455, ziel: 455, pause: 2, flucht: 0, hops: { y: 0 } };
    tap(c, () => {
      const kr = this.krebs;
      killTweensOf(kr.hops);
      this.tween(kr.hops, { y: -60 }, 0.22, { ease: 'quadOut' })
        .then((ok) => { if (ok) this.tween(kr.hops, { y: 0 }, 0.45, { ease: 'bounceOut' }); });
      fx.wobble(kr.bild, 0.12);
      note('xylo', pick([72, 76, 79]), { vol: 0.5 });
      this.burst('blasen', kr.x, this.GRUND - 120, { count: 3 });
    }, { sound: null, squash: false, hitArea: new PIXI.Rectangle(-150, -230, 300, 230) });   // endet am Grund (70er-Rand frei)
  }

  updateKrebs(dt, t) {
    const kr = this.krebs;
    let tempo = 42;
    // Kommt der Köder nah, flitzt der Krebs zur Seite (lustig, nicht hektisch)
    if (kr.flucht <= 0 && !this.haken && Math.abs(this.k.x - kr.x) < 200 && this.k.y > this.GRUND - 330) {
      kr.flucht = 1.4;
      // zum Ruheplatz (zwischen den Dingen) auf der vom Köder abgewandten Seite
      const wunsch = kr.x + (kr.x > this.k.x ? 380 : -380);
      let ziel = naechster(KREBS_PLAETZE, wunsch);
      if (Math.abs(ziel - kr.x) < 120) {
        ziel = KREBS_PLAETZE.reduce((a, b) => (Math.abs(b - this.k.x) > Math.abs(a - this.k.x) ? b : a));
      }
      kr.ziel = ziel;
    }
    if (kr.flucht > 0) { kr.flucht -= dt; tempo = 120; }
    const d = kr.ziel - kr.x;
    let unterwegs = false;
    if (Math.abs(d) > 4) {
      kr.x += Math.sign(d) * Math.min(Math.abs(d), tempo * dt);
      unterwegs = true;
    } else {
      kr.pause -= dt;
      if (kr.pause <= 0) {
        // nächster Ruheplatz: zwischen den Dingen am Grund, nie in der freien Ecke rechts unten
        kr.ziel = pick(KREBS_PLAETZE.filter((x) => Math.abs(x - kr.x) > 50));
        kr.pause = rand(4, 8);
      }
    }
    kr.c.position.set(kr.x, this.GRUND + 8 + kr.hops.y);
    kr.c.rotation = unterwegs ? Math.sin(t * 9) * 0.05 : 0;
  }

  // ---------------------------------------------------------------- Ablauf

  update(dt, t) {
    this.updateKoeder(dt, t);
    this.updateFische(dt, t);
    this.updateDinge(dt, t);
    this.updateKrebs(dt, t);
    this.vogel.update(dt);
    this.wolken.update(dt);
  }

  hinweise() {
    const frei = this.fische.filter((f) => f.zustand === 'schwimmt' && f.x > -400 && f.x < 1100);
    const liste = [];
    if (frei.length) {
      const f = frei.reduce((a, b) => (Math.hypot(a.x - this.k.x, a.y - this.k.y) <
        Math.hypot(b.x - this.k.x, b.y - this.k.y) ? a : b));
      liste.push({ von: this.koeder, nach: f.c });
    }
    if (this.imEimer.length >= 2) liste.push(this.eimer);
    liste.push(this.katze);
    return liste;
  }
}

function naechster(liste, x) {
  return liste.reduce((a, b) => (Math.abs(b - x) < Math.abs(a - x) ? b : a));
}

function mische(a) {
  const b = [...a];
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [b[i], b[j]] = [b[j], b[i]];
  }
  return b;
}
