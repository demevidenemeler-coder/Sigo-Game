// Seite 1 – Himmel über der Wiese. Hauptsache: die Ballonfahrt eines Gastes (jede Runde ein anderes Tier):
//   1. Ein Gast kommt über die Wiese und denkt an Luftballons          (Denkblase)
//   2. Drei Ballons fangen       (antippen – der Ballon schwebt zum Gast, er hält sie hoch)
//   3. Fliegen                   (der Gast hebt ab; ziehen – er schwebt dem Finger träge nach; nur antippen –
//                                 er schwebt von selbst ein Stück hinüber)
//   4. Landen                    (die Ballons oder den Gast antippen: einer nach dem anderen fliegt davon, je eine Überraschung
//                                 schwebt herab, der Gast sinkt tiefer und gleitet zuletzt auf die Picknickdecke)
//   5. Picknick                  (aus dem Korb hüpft sein Lieblingsessen – zum Gast ziehen oder antippen)
//   6. Der Gast und die Maus freuen sich, Sticker; der Gast bleibt auf der Decke sitzen (die Runde wächst, höchstens
//      drei Gäste – dann geht der älteste nach Hause), bald kommt der nächste.
//   Frei dazu (wie bisher):
//   Luftballons steigen langsam auf (höchstens 6) – antippen: weiches Plopp, eine kleine Überraschung schwebt herab.
//   Seifenblasen-Stab unten im Gras: mit ihm durch die Luft ziehen → Seifenblasen (höchstens 25), antippen → plopp.
//   Drachen am Himmel: folgt dem ziehenden Finger träge, Schwanz weht nach.
//   Maus auf der Picknickdecke schaut zu und freut sich mit.

import {
  spr, tex, Actor, tap, drag, sfx, note, voice, fx, killTweensOf, rand, pick, clamp, PIXI,
} from '../../engine/index.js';
import { Seite } from '../../gemeinsam/seiten.js';
import { belohne } from '../../gemeinsam/sticker.js';
import { wunsch, fuettere } from '../../gemeinsam/futter.js';
import {
  freude, bildPunkt, teilTextur, stickerFuer, wolken, Schmetterling, Vogel, andere, bogenFlug, merker,
} from './helfer.js';

const FARBEN = ['rot', 'gelb', 'blau', 'gruen', 'orange', 'lila'];
const UEBERRASCHUNGEN = ['ueberraschung_stern', 'ueberraschung_herz', 'ueberraschung_blume'];
const MAX_BALLONS = 6;               // so viele schweben höchstens frei
const BALLON_VORRAT = 9;            // dazu bis zu drei im Bund des Gastes
const BALLON_SKALA = 0.78;
const MAX_BLASEN = 25;
const BLASEN_ABSTAND = 75;          // so weit muss der Ring wandern, bis eine neue Blase entsteht
const PENTA = [72, 74, 76, 79, 81, 84];

// Bereich für den Mittelpunkt des Drachens – samt Körper (≈ 120/140 Einheiten zur Seite, 135 nach oben), Schweben
// und Griff-Kreis frei von den Knopf-Ecken oben (je 260×260) und den Blätter-Pfeilen (±1105, y 690…910)
const DRACHEN_RAUM = { x0: -760, x1: 760, y0: 380, y1: 720 };
const BLASE_ZAHM = 1.2;             // so lange (s) ist eine frische Blase noch nicht antippbar (Stab/Drachen greifbar)

// Ballonfahrt
const GAESTE = ['hase', 'igel', 'ente', 'frosch', 'schaf', 'eichhoernchen', 'pinguin', 'fuchs'];
const GAST_SKALA = 0.22;
const EINGANG = { x: 1480, y: 1345 };
const TREFF = { x: -120, y: 1335 };         // hier wartet der Gast auf seine Ballons
const BUND_ZAHL = 3;
const BUND_SKALA = 0.62;
const BUND = [-0.4, 0, 0.4];                // Neigung der Ballons im Bund (die Schnüre treffen sich in der Pfote)
const SCHNUR = 0.67 * 360 * 0.92;           // Anker → Schnurende im Ballonbild (Bildpunkte)
const FLUG_RAUM = { x0: -760, x1: 760, y0: 780, y1: 1080 };   // Füße des fliegenden Gastes
const FLUG_WEG = 1200;                      // so weit fliegen (Einheiten), dann wird gelandet
const FLUG_MAX = 900;                       // schneller schwebt er nicht (Einheiten/s) – ruhig
const SITZE = [{ x: -960, y: 1300 }, { x: -515, y: 1318 }, { x: -820, y: 1398 }];
const KORB = { x: -330, y: 1405 };
let deckenGaeste = [];                      // wer schon auf der Decke sitzt (bleibt für die ganze Spielzeit)

export class Himmel extends Seite {
  static hg = 'spielplatz/hg_wiese';

  aufbau() {
    this.zeitBallon = 1.5;
    this.zeit = 0;
    this.geplatzt = 0;
    this.blasenGezogen = false;
    this.gast = null;
    this.letzterGast = null;
    this._hinweise = [];

    this.wolken = wolken(this, [
      { bild: 'wolke1', x: -300, y: 240, scale: 0.42, v: 9 },
      { bild: 'wolke3', x: 700, y: 560, scale: 0.3, v: 6, alpha: 0.85 },
    ]);

    this.baueMaus();
    this.baueBallons();
    this.baueUeberraschungen();
    this.baueDrachen();
    this.baueStab();
    this.baueBlasen();

    // hinter Gast, Korb, Essen und Maus (z 19): er fliegt durch ihr Gras und soll ihnen keinen Tipp wegnehmen
    this.falter = new Schmetterling(this, {
      x: -300, y: 1380, farbe: 0, z: 19,
      bereich: { x0: -950, x1: 100, y0: 1250, y1: 1450 },
    });
    this.vogel = new Vogel(this, { y0: 260, y1: 480, z: 22 });
    this.baueBaum();
    this.baueKorb();
    this.baueDeckenGaeste();
    this.flugMerker = merker(this.welt);
    this.after(1.5, () => this.neuerGast());
  }

  // ---------------------------------------------------------------- Baum links (gemalt): raschelt beim Antippen

  baueBaum() {
    // Laubkrone des Baums am linken Bildrand (über dem Blätter-Pfeil, unter der Karten-Ecke)
    const krone = new PIXI.Container({ label: 'baumkrone' });
    krone.zIndex = 1;
    this.welt.addChild(krone);
    this.raschelZeit = 0;
    tap(krone, (e) => {
      if (this.zeit - this.raschelZeit < 0.5) return;
      this.raschelZeit = this.zeit;
      sfx('common/wusch', { vol: 0.25, rate: 0.8 });
      this.burst('blaetter', clamp(e.x, -1180, -960), clamp(e.y, 380, 640), { count: 3 });
    }, { sound: null, squash: false, hitArea: new PIXI.Rectangle(-1420, 330, 480, 350) });
  }

  // ---------------------------------------------------------------- Maus auf der Decke

  baueMaus() {
    const d = this.punkt('decke', { x: -724, y: 1290 });
    this.maus = new Actor('maus', { x: d.x + 30, y: d.y - 10, scale: 0.3, parent: this.welt, z: 20 });
    this.maus.onTap(() => freude(this, this.maus));
  }

  // Die Maus freut sich mit (nicht bei jedem Plopp – ruhig bleiben)
  mausKlatscht(x) {
    this.maus.lookAt(x);
    if (Math.random() < 0.5) freude(this, this.maus, { laut: Math.random() < 0.4, herzen: 3, hoehe: 45 });
  }

  // ---------------------------------------------------------------- Luftballons

  baueBallons() {
    this.ballons = [];
    for (let i = 0; i < BALLON_VORRAT; i++) {
      const b = spr('spielplatz/ballon_' + FARBEN[i % FARBEN.length], { anchor: [0.5, 0.33], scale: BALLON_SKALA, z: 30 });
      b.visible = false;
      b.zustand = { aktiv: false, x0: 0, v: 60, phase: rand(0, 6), weg: false, halt: 0, bund: -1 };
      this.welt.addChild(b);
      // Tippfläche: Ballon samt Schnur, gut 250 Einheiten breit
      tap(b, () => this.platze(b), {
        sound: null, squash: false, hitArea: new PIXI.Circle(0, 40, 175),
      });
      b.eventMode = 'none';
      this.ballons.push(b);
    }
    // Zu Beginn schweben schon drei in verschiedenen Höhen
    this.starteBallon(1250);
    this.starteBallon(850);
    this.starteBallon(480);
  }

  starteBallon(y = 1750) {
    const b = this.ballons.find((x) => !x.zustand.aktiv);
    if (!b) return;
    // Platz suchen: nicht zu nah an einem anderen Ballon in ähnlicher Höhe
    let x = 0;
    for (let i = 0; i < 10; i++) {
      x = rand(-900, 900);
      if (this.ballons.every((o) => !o.zustand.aktiv || Math.abs(o.x - x) > 260 || Math.abs(o.y - y) > 450)) break;
    }
    const z = b.zustand;
    const farbe = pick(FARBEN);
    b.texture = tex('spielplatz/ballon_' + farbe);
    b.label = 'spielplatz/ballon_' + farbe;
    z.aktiv = true;
    z.weg = false;
    z.halt = 0;
    z.x0 = x;
    z.v = rand(55, 72);
    z.phase = rand(0, Math.PI * 2);
    b.position.set(x, y);
    b.scale.set(BALLON_SKALA);
    b.alpha = 1;
    b.rotation = 0;
    b.visible = true;
    b.eventMode = 'static';
  }

  platze(b) {
    const z = b.zustand;
    if (!z.aktiv || z.weg) return;
    if (z.bund >= 0) { this.bundTipp(b); return; }
    if (this.fange(b)) return;
    z.weg = true;
    b.eventMode = 'none';
    sfx('common/ballon', { vol: 0.8 });
    this.burst('funkeln', b.x, b.y, { count: 4 });
    this.tween(b, { scale: BALLON_SKALA * 1.18, alpha: 0 }, 0.28, { ease: 'quadOut' }).then(() => {
      z.aktiv = false;
      b.visible = false;
    });
    this.lasseFallen(b.x, b.y + 40);
    this.mausKlatscht(b.x);
    this.geplatzt++;
  }

  // ---------------------------------------------------------------- Überraschungen

  baueUeberraschungen() {
    this.geschenke = [];
    for (let i = 0; i < 6; i++) {
      const s = spr('spielplatz/' + UEBERRASCHUNGEN[i % 3], { anchor: 0.5, z: 35 });
      s.visible = false;
      s.zustand = { aktiv: false, faellt: false, x0: 0, boden: 1300, t: 0, liegt: 0, basis: 1 };
      this.welt.addChild(s);
      tap(s, () => this.geschenkTipp(s), { sound: null, squash: true, hitArea: new PIXI.Circle(0, 0, 150) });
      s.eventMode = 'none';
      this.geschenke.push(s);
    }
  }

  lasseFallen(x, y) {
    let s = this.geschenke.find((g) => !g.zustand.aktiv);
    if (!s) {
      // alle unterwegs: das älteste liegende geht weich
      s = this.geschenke.reduce((a, g) => (g.zustand.t > a.zustand.t ? g : a));
    }
    killTweensOf(s, ['scale', 'alpha', 'y', 'rotation']);
    const art = pick(UEBERRASCHUNGEN);
    s.texture = tex('spielplatz/' + art);
    s.label = 'spielplatz/' + art;
    const z = s.zustand;
    z.aktiv = true;
    z.faellt = true;
    z.t = 0;
    z.liegt = 0;
    z.x0 = clamp(x, -950, 950);
    // Landeplatz in der Wiese (nicht in der freien Ecke unten rechts)
    z.boden = rand(1200, 1420);
    if (z.x0 > 850) z.boden = Math.min(z.boden, 1320);
    z.basis = 150 / Math.max(s.texture.width, s.texture.height);
    s.scale.set(z.basis * 0.4);
    s.position.set(z.x0, y);
    s.alpha = 1;
    s.visible = true;
    s.eventMode = 'static';
    this.tween(s, { scale: z.basis }, 0.5, { ease: 'backOut' });
  }

  geschenkTipp(s) {
    note('glocke', pick(PENTA), { vol: 0.35 });
    this.burst('funkeln', s.x, s.y, { count: 3 });
    if (!s.zustand.faellt) {
      // liegt schon: hüpft einmal und bleibt etwas länger
      s.zustand.liegt = Math.min(s.zustand.liegt, 2);
      this.tween(s, { y: s.y - 60 }, 0.22, { ease: 'quadOut' })
        .then((ok) => ok && this.tween(s, { y: s.zustand.boden }, 0.3, { ease: 'bounceOut' }));
    }
  }

  // ---------------------------------------------------------------- Drachen

  baueDrachen() {
    const id = 'spielplatz/drachen';
    const s = 0.78;
    this.drachen = new PIXI.Container({ label: 'drachen' });
    this.drachen.zIndex = 26;
    this.drachen.position.set(420, 470);
    this._pg = new PIXI.Point();     // wiederverwendete Punkte für die Schnur (keine Objekte pro Bild)
    this._pl = new PIXI.Point();
    this._schnurAlt = { x: NaN, y: NaN };
    // Körper (oben) und zwei Schwanzstücke als eigene Ausschnitte – der Schwanz pendelt nach
    const koerper = new PIXI.Sprite(teilTextur(id, 0, 0, 330, 345));
    koerper.anchor.set(150 / 330, 170 / 345);
    koerper.scale.set(s);
    this.schwanz1 = new PIXI.Sprite(teilTextur(id, 0, 330, 330, 140));
    this.schwanz1.anchor.set(148 / 330, 5 / 140);
    this.schwanz1.position.set(-2, 165);
    this.schwanz2 = new PIXI.Sprite(teilTextur(id, 0, 465, 330, 135));
    this.schwanz2.anchor.set(95 / 330, 2 / 135);
    this.schwanz2.position.set(-53, 133);
    this.schwanz1.addChild(this.schwanz2);
    koerper.addChild(this.schwanz1);
    this.drachen.addChild(koerper);
    this.drachenKoerper = koerper;
    this.welt.addChild(this.drachen);
    this.dz = { vx: 0, vy: 0, heim: { x: 420, y: 470 }, zeit: 0, r1: 0, r2: 0 };

    // Schnur bis zu einem kleinen Pflock im Gras
    this.pflock = { x: 700, y: 1235 };
    const pflock = new PIXI.Graphics()
      .roundRect(-9, -46, 18, 56, 8).fill(0x9b6b43)
      .circle(0, -46, 12).fill(0xc98d55);
    pflock.position.set(this.pflock.x, this.pflock.y);
    pflock.zIndex = 23;
    this.welt.addChild(pflock);
    this.schnur = new PIXI.Graphics();
    this.schnur.zIndex = 24;
    this.schnur.eventMode = 'none';
    this.welt.addChild(this.schnur);

    // Griff: unsichtbare Fläche über dem Drachen – an ihr zieht der Finger, der Drachen folgt träge
    this.griff = new PIXI.Container({ label: 'drachenGriff' });
    this.griff.zIndex = 27;
    this.griff.position.copyFrom(this.drachen.position);
    this.welt.addChild(this.griff);
    this.drachenZug = drag(this.griff, {
      back: false,
      lift: 1,
      hitArea: new PIXI.Circle(0, 30, 190),
      onStart: () => {
        sfx('common/wusch', { vol: 0.35 });
      },
      onDrop: () => {
        const g = this.griff;
        this.dz.heim = {
          x: clamp(g.x, DRACHEN_RAUM.x0, DRACHEN_RAUM.x1),
          y: clamp(g.y, DRACHEN_RAUM.y0, DRACHEN_RAUM.y1),
        };
      },
    });
  }

  drachenUpdate(dt) {
    const d = this.drachen;
    const z = this.dz;
    z.zeit += dt;
    let zx;
    let zy;
    if (this.drachenZug.isDragging()) {
      zx = clamp(this.griff.x, DRACHEN_RAUM.x0, DRACHEN_RAUM.x1);
      zy = clamp(this.griff.y, DRACHEN_RAUM.y0, DRACHEN_RAUM.y1);
    } else {
      // ruhiges Schweben um den Heimatpunkt – auch das Schweben bleibt im erlaubten Raum
      zx = clamp(z.heim.x + Math.sin(z.zeit * 0.31) * 70, DRACHEN_RAUM.x0, DRACHEN_RAUM.x1);
      zy = clamp(z.heim.y + Math.sin(z.zeit * 0.47) * 40, DRACHEN_RAUM.y0, DRACHEN_RAUM.y1);
      this.griff.position.set(d.x, d.y);
    }
    // träge folgen (weiche Feder mit Dämpfung)
    const k = 5;
    const daempf = 3.6;
    z.vx += ((zx - d.x) * k - z.vx * daempf) * dt;
    z.vy += ((zy - d.y) * k - z.vy * daempf) * dt;
    d.x += z.vx * dt;
    d.y += z.vy * dt;
    // Neigung und wehender Schwanz
    const neigung = clamp(z.vx * 0.0007, -0.3, 0.3) + Math.sin(z.zeit * 0.9) * 0.05;
    this.drachenKoerper.rotation += (neigung - this.drachenKoerper.rotation) * Math.min(1, dt * 3);
    const ziel1 = clamp(-z.vx * 0.0016, -0.6, 0.6) + Math.sin(z.zeit * 2.0) * 0.12 - this.drachenKoerper.rotation * 0.6;
    z.r1 += (ziel1 - z.r1) * Math.min(1, dt * 2.5);
    const ziel2 = clamp(-z.vx * 0.0012, -0.5, 0.5) + Math.sin(z.zeit * 2.0 - 0.9) * 0.18;
    z.r2 += (ziel2 - z.r2) * Math.min(1, dt * 2);
    this.schwanz1.rotation = z.r1;
    this.schwanz2.rotation = z.r2;
    // Schnur: vom Kreuz des Drachens leicht durchhängend zum Pflock (nur neu zeichnen, wenn er sich bewegt hat)
    this._pg.set(0, 0);
    this.drachenKoerper.toGlobal(this._pg, this._pg);
    const a = this.welt.toLocal(this._pg, undefined, this._pl);
    const alt = this._schnurAlt;
    if (Math.abs(a.x - alt.x) < 0.5 && Math.abs(a.y - alt.y) < 0.5) return;
    alt.x = a.x;
    alt.y = a.y;
    const p = this.pflock;
    const mx = (a.x + p.x) / 2 + 40;
    const my = (a.y + p.y) / 2 + 90;
    this.schnur.clear()
      .moveTo(a.x, a.y)
      .quadraticCurveTo(mx, my, p.x, p.y - 44)
      .stroke({ width: 3, color: 0xfffaf0, alpha: 0.85 });
  }

  // ---------------------------------------------------------------- Seifenblasen

  baueStab() {
    // Ruheplatz im Gras: Griff und Tippfläche bleiben über dem 70er-Rand unten (Unterkante ≤ 1505)
    this.stabRuhe = { x: 260, y: 1330, rotation: -0.55 };
    const s = spr('spielplatz/seifenblasen_stab', { scale: 0.72, z: 55 });
    s.position.set(this.stabRuhe.x, this.stabRuhe.y);
    s.rotation = this.stabRuhe.rotation;
    this.welt.addChild(s);
    this.stab = s;
    this.ringLetzt = null;
    // Tippfläche gut 280 breit (in Bildpunkten des Stabs, Skala 0.72)
    drag(s, {
      back: true,
      lift: 1.08,
      hitArea: new PIXI.Rectangle(-200, -260, 400, 420),
      onStart: () => {
        this.blasenGezogen = true;
        this.tween(s, { rotation: -0.12 }, 0.25, { ease: 'sineInOut', overwrite: true });
        this.ringLetzt = this.ringOrt();
        sfx('common/blubber', { vol: 0.3 });
      },
      onMove: () => {
        const r = this.ringOrt();
        const l = this.ringLetzt;
        if (!l) { this.ringLetzt = r; return; }
        const d = Math.hypot(r.x - l.x, r.y - l.y);
        if (d >= BLASEN_ABSTAND) {
          this.neueBlase(r.x, r.y, (r.x - l.x) / d, (r.y - l.y) / d);
          this.ringLetzt = r;
        }
      },
      onDrop: () => {
        this.ringLetzt = null;
        this.tween(s, { rotation: this.stabRuhe.rotation }, 0.45, { ease: 'sineInOut', overwrite: true });
      },
    });
  }

  ringOrt() {
    return bildPunkt(this.stab, 102, 105);
  }

  baueBlasen() {
    this.blasen = [];
    for (let i = 0; i < MAX_BLASEN; i++) {
      const b = new PIXI.Sprite(tex('common/p_blase'));
      b.anchor.set(0.5);
      b.label = 'seifenblase';
      b.visible = false;
      b.zIndex = 50;
      b.zustand = { aktiv: false, alter: 0, leben: 10, vx: 0, vy: 0, phase: 0, groesse: 100, nr: 0, weg: false, zahm: false };
      b.scale.set(0.8);
      b.hitArea = new PIXI.Circle(0, 0, 135);
      this.welt.addChild(b);
      tap(b, () => this.platzeBlase(b, true), { sound: null, squash: false, hitArea: b.hitArea });
      b.eventMode = 'none';
      this.blasen.push(b);
    }
    this.blasenNr = 0;
  }

  neueBlase(x, y, rx, ry) {
    const b = this.blasen.find((o) => !o.zustand.aktiv);
    if (!b) {
      // alle unterwegs: die älteste noch schwebende platzt leise (weich ausgeblendet) und macht so Platz –
      // diesmal entsteht keine neue
      let alt = null;
      for (const o of this.blasen) if (!o.zustand.weg && (!alt || o.zustand.nr < alt.zustand.nr)) alt = o;
      if (alt) this.platzeBlase(alt, false);
      return;
    }
    const z = b.zustand;
    z.aktiv = true;
    z.weg = false;
    z.alter = 0;
    z.leben = rand(7, 11);
    z.groesse = rand(55, 150);
    z.phase = rand(0, Math.PI * 2);
    z.nr = ++this.blasenNr;
    // treibt etwas hinter dem Ring her, dann langsam nach oben
    z.vx = -rx * rand(10, 30) + rand(-15, 15);
    z.vy = -ry * rand(10, 30) - rand(5, 20);
    const s = z.groesse / 160;
    killBlase(this, b);
    b.position.set(x + rand(-20, 20), y + rand(-20, 20));
    b.scale.set(s * 0.3);
    b.alpha = 0.92;
    b.rotation = rand(-0.4, 0.4);
    b.hitArea.radius = Math.max(z.groesse / 2, 110) / s;
    b.visible = true;
    // frisch am Ring noch nicht antippbar: sonst fängt sie den nächsten Griff zum Stab oder zum Drachen ab
    z.zahm = true;
    b.eventMode = 'none';
    this.tween(b, { scale: s }, 0.45, { ease: 'backOut' });
  }

  platzeBlase(b, getippt) {
    const z = b.zustand;
    if (!z.aktiv || z.weg) return;
    z.weg = true;
    b.eventMode = 'none';
    if (getippt) sfx('common/plopp', { vol: 0.4, rate: clamp(1.6 - z.groesse / 200, 0.9, 1.4) });
    const s = b.scale.x;
    killBlase(this, b);
    this.tween(b, { scale: s * 1.25, alpha: 0 }, getippt ? 0.22 : 0.6, { ease: 'quadOut' }).then((ok) => {
      if (ok && z.weg) {
        z.aktiv = false;
        b.visible = false;
      }
    });
  }

  // ---------------------------------------------------------------- Ballonfahrt: Korb und Gäste auf der Decke

  baueKorb() {
    this.korb = spr('common/icon_korb', { x: KORB.x, y: KORB.y, anchor: [0.5, 0.92], scale: 0.48, z: 21 });
    this.welt.addChild(this.korb);
    tap(this.korb, () => {
      const g = this.gast;
      if (g && g.zustand === 'picknick' && g.essen && !g.essen.destroyed && g.essen.eventMode === 'static') {
        this.essenZumGast();
      } else if (this.zeit - (this.korbZeit ?? -9) > 0.5) {
        this.korbZeit = this.zeit;
        sfx('common/hupf', { vol: 0.3 });
        this.burst('funkeln', this.korb.x, this.korb.y - 120, { count: 2 });
      }
    }, { sound: null, squash: true, hitArea: new PIXI.Rectangle(-250, -440, 500, 480) });
  }

  baueDeckenGaeste() {
    this.sitzende = [];
    for (const d of deckenGaeste) this.setzeAufDecke(d.id, d.sitz);
  }

  setzeAufDecke(id, sitz, a = null) {
    const p = SITZE[sitz];
    if (!a) a = new Actor(id, { x: p.x, y: p.y, scale: GAST_SKALA, parent: this.welt, z: 20 });
    a.zIndex = 20 + (p.y > 1350 ? 2 : 0);
    a.lookAt(this.maus.x);
    a.onTap(() => freude(this, a, { herzen: 3, hoehe: 45 }), { pad: 60 });
    this.sitzende.push({ id, sitz, a });
    return a;
  }

  freierSitz() {
    for (let i = 0; i < SITZE.length; i++) if (!this.sitzende.some((s) => s.sitz === i)) return i;
    return -1;
  }

  // ---------------------------------------------------------------- Ballonfahrt: Ablauf

  neuerGast() {
    if (this.gast) return;
    // Decke voll: der älteste Gast geht nach Hause
    if (this.freierSitz() < 0) {
      const alt = this.sitzende.shift();
      deckenGaeste = deckenGaeste.filter((d) => d.sitz !== alt.sitz);
      alt.a._tap?.off();
      alt.a.zIndex = 41;
      alt.a.walkTo(EINGANG.x, EINGANG.y, { tempo: 230 }).then(() => {
        if (!alt.a.destroyed) alt.a.destroy({ children: true });
      });
    }
    const da = this.sitzende.map((s) => s.id);
    const id = andere(GAESTE.filter((x) => !da.includes(x)), this.letzterGast);
    this.letzterGast = id;
    const a = new Actor(id, { x: EINGANG.x, y: EINGANG.y, scale: GAST_SKALA, parent: this.welt, z: 40 });
    const g = {
      a, id, zustand: 'kommt', bund: [], weg: 0, vx: 0, vy: 0, heim: { x: 0, y: 0 }, essen: null, blaseZeit: -99,
      farbe: pick(FARBEN), gelandet: 0, zeit: 0,
    };
    this.gast = g;
    a.onTap(() => this.gastTipp(), { pad: 60 });   // unterwegs: nur ein Laut
    a.walkTo(TREFF.x, TREFF.y, { tempo: 230 }).then((ok) => {
      if (this.gast !== g) return;
      if (!ok) a.position.set(TREFF.x, TREFF.y);
      g.zustand = 'sammelt';
      a.lookAt(0);
      this.zeigeWunsch();
      this.sageFahrt(g, 0.8);
    });
  }

  zeigeWunsch() {
    const g = this.gast;
    if (!g || g.zustand !== 'sammelt' || g.bund.length > 0 || this.zeit - g.blaseZeit < 6) return;
    g.blaseZeit = this.zeit;
    g.a.bubble('spielplatz/ballon_' + g.farbe, 2.6);
  }

  gastTipp() {
    const g = this.gast;
    if (!g) return;
    const a = g.a;
    if (g.zustand === 'sammelt') {
      if (g.bund.length === 0) {
        g.blaseZeit = -99;
        this.zeigeWunsch();
      }
      fx.wobble(a);
      a.sound();
    } else if (g.zustand === 'picknick') {
      this.essenZumGast();
    } else if (g.zustand === 'landen') {
      // beim Landen darf man auch den Gast antippen: der nächste Ballon fliegt davon
      const b = g.bund.find((x) => x.zustand.imBund);
      if (b) this.bundTipp(b);
    } else if (this.zeit - (g.lautZeit ?? -9) > 0.8) {
      // unterwegs (kommt, hebt ab, gleitet): nur ein Laut – kein Hüpfer, der die Bewegung ablösen würde
      g.lautZeit = this.zeit;
      a.sound();
    }
  }

  /** Ballon antippen, während der Gast sammelt: Er schwebt in den Bund statt zu platzen → true */
  fange(b) {
    const g = this.gast;
    if (!g || g.zustand !== 'sammelt' || g.bund.length >= BUND_ZAHL) return false;
    const z = b.zustand;
    const i = g.bund.length;
    if (i === 0) {
      // Pfoten hoch: ab jetzt hält er die Ballons
      g.a.pose('happy');
      const k = g.a.point('kopf');
      g.handDx = (k.x - g.a.x) * 0.6;
      g.handDy = k.y - g.a.y + 20;
      if (g.a._blase && !g.a._blase.destroyed) g.a._blase.visible = false;
    }
    z.bund = i;
    z.imBund = false;
    z.halt = 0;
    g.bund.push(b);
    b.eventMode = 'none';
    b.zIndex = i === 1 ? 31 : 32;
    b.hitArea = new PIXI.Circle(0, 30, 230);
    note('glocke', PENTA[(i * 2) % PENTA.length], { vol: 0.35 });
    this.burst('funkeln', b.x, b.y, { count: 2 });
    const r = BUND[i];
    const l = SCHNUR * BUND_SKALA * (i === 1 ? 1.12 : 1);
    const zx = g.a.x + g.handDx + Math.sin(r) * l;
    const zy = g.a.y + g.handDy - Math.cos(r) * l;
    bogenFlug(this, b, zx, zy, { hoehe: 70, min: 0.7, skala: BUND_SKALA, drehung: r }).then(() => {
      if (this.gast !== g || z.bund < 0) return;
      z.imBund = true;
      if (g.bund.length === BUND_ZAHL && g.bund.every((x) => x.zustand.imBund)) this.hebeAb();
    });
    this.maus.lookAt(g.a.x);
    return true;
  }

  async hebeAb() {
    const g = this.gast;
    if (!g || g.zustand !== 'sammelt') return;
    g.zustand = 'hebtAb';
    const a = g.a;
    a.schatten.visible = false;
    freude(this, this.maus, { herzen: 3, hoehe: 45 });
    await this.wait(0.5);
    if (this.gast !== g) return;
    sfx('common/wusch', { vol: 0.35, rate: 0.8 });
    await this.tween(a, { y: 1000 }, 1.8, { ease: 'sineInOut' });
    if (this.gast !== g) return;
    g.heim.x = a.x;
    g.heim.y = a.y;
    g.vx = 0;
    g.vy = 0;
    g.weg = 0;
    g.zeit = 0;
    g.zustand = 'fliegt';
    g.schub = 0;
    // Griff: unsichtbare Fläche um den Gast – an ihr zieht der Finger, der Gast schwebt träge nach
    const griff = new PIXI.Container({ label: 'gastGriff' });
    griff.zIndex = 60;
    griff.position.set(a.x, a.y);
    this.welt.addChild(griff);
    this.gastGriff = griff;
    g.zug = drag(griff, {
      back: false,
      lift: 1,
      hitArea: new PIXI.Circle(0, -170, 250),
      onStart: () => sfx('common/wusch', { vol: 0.3 }),
      onDrop: (_, ctx) => {
        if (Math.hypot(ctx.x - ctx.startX, ctx.y - ctx.startY) < 40) {
          // nur angetippt: der Gast schwebt von selbst ein Stück hinüber zur anderen Seite (das zählt auch)
          g.heim.x = clamp(a.x + (a.x > 0 ? -480 : 480), FLUG_RAUM.x0, FLUG_RAUM.x1);
          g.heim.y = clamp(a.y + rand(-60, 60), FLUG_RAUM.y0, FLUG_RAUM.y1);
          g.schub = 2.2;
          note('glocke', pick(PENTA), { vol: 0.25 });
          return;
        }
        g.heim.x = clamp(griff.x, FLUG_RAUM.x0, FLUG_RAUM.x1);
        g.heim.y = clamp(griff.y, FLUG_RAUM.y0, FLUG_RAUM.y1);
      },
    });
  }

  gastUpdate(dt) {
    const g = this.gast;
    if (!g) return;
    const a = g.a;
    if (a.destroyed) return;
    if (g.zustand === 'sammelt' && this.aktiv) this.zeigeWunsch();
    if (g.zustand === 'fliegt') {
      g.zeit += dt;
      const griff = this.gastGriff;
      const zieht = !!g.zug?.isDragging();
      let zx;
      let zy;
      if (zieht) {
        zx = clamp(griff.x, FLUG_RAUM.x0, FLUG_RAUM.x1);
        zy = clamp(griff.y, FLUG_RAUM.y0, FLUG_RAUM.y1);
      } else {
        zx = clamp(g.heim.x + Math.sin(g.zeit * 0.5) * 40, FLUG_RAUM.x0, FLUG_RAUM.x1);
        zy = clamp(g.heim.y + Math.sin(g.zeit * 0.8) * 25, FLUG_RAUM.y0, FLUG_RAUM.y1);
        griff.position.set(a.x, a.y);
      }
      g.vx += ((zx - a.x) * 4 - g.vx * 3.4) * dt;
      g.vy += ((zy - a.y) * 4 - g.vy * 3.4) * dt;
      const v = Math.hypot(g.vx, g.vy);
      if (v > FLUG_MAX) {
        g.vx *= FLUG_MAX / v;
        g.vy *= FLUG_MAX / v;
      }
      a.x += g.vx * dt;
      a.y += g.vy * dt;
      a.rotation += (clamp(g.vx * 0.0004, -0.18, 0.18) - a.rotation) * Math.min(1, dt * 3);
      if (Math.abs(g.vx) > 60) a.lookAt(a.x + g.vx);
      g.schub = Math.max(0, (g.schub || 0) - dt);
      if (zieht || g.schub > 0) g.weg += Math.min(v, FLUG_MAX) * dt;
      if (g.weg >= FLUG_WEG) this.starteLanden();
    }
    // Ballons im Bund folgen dem Gast und wiegen sich leicht
    if (g.bund.length && g.handDy !== undefined) {
      for (let i = 0; i < g.bund.length; i++) {
        const b = g.bund[i];
        if (!b.zustand.imBund) continue;
        const r = BUND[i] + a.rotation;
        const l = SCHNUR * BUND_SKALA * (i === 1 ? 1.12 : 1);
        b.x = a.x + g.handDx + Math.sin(r) * l;
        b.y = a.y + g.handDy - Math.cos(r) * l;
        b.rotation = r + Math.sin(this.zeit * 1.1 + i) * 0.03;
      }
    }
  }

  starteLanden() {
    const g = this.gast;
    g.zustand = 'landen';
    g.zug?.off();
    g.zug = null;
    this.gastGriff?.destroy();
    this.gastGriff = null;
    this.tween(g.a, { rotation: 0 }, 0.5, { ease: 'sineInOut' });
    freude(this, this.maus, { herzen: 3, hoehe: 45 });
    for (const b of g.bund) b.eventMode = 'static';
    g.a.onTap(() => this.gastTipp(), { pad: 60 });
  }

  /** Ballon im Bund angetippt: beim Landen fliegt er davon (Überraschung), sonst klingt er nur leise */
  bundTipp(b) {
    const g = this.gast;
    const z = b.zustand;
    if (!g || g.zustand !== 'landen' || !z.imBund) {
      note('glocke', pick(PENTA), { vol: 0.25 });
      return;
    }
    z.imBund = false;
    z.weg = true;
    b.eventMode = 'none';
    note('glocke', PENTA[5 - Math.min(5, g.gelandet * 2)], { vol: 0.35 });
    this.lasseFallen(b.x, b.y + 40);
    this.tween(b, { y: b.y - 700, x: b.x + rand(-120, 120), alpha: 0 }, 3.2, { ease: 'sineIn' }).then(() => {
      z.aktiv = false;
      z.weg = false;
      z.bund = -1;
      z.imBund = false;
      b.visible = false;
      b.alpha = 1;
      b.rotation = 0;
      b.scale.set(BALLON_SKALA);
      b.zIndex = 30;
      b.hitArea = new PIXI.Circle(0, 40, 175);
    });
    g.gelandet++;
    const a = g.a;
    if (g.gelandet < BUND_ZAHL) {
      // etwas tiefer sinken
      this.tween(a, { y: Math.min(a.y + 110, 1180) }, 0.9, { ease: 'sineInOut' });
    } else {
      this.gleiteZurDecke();
    }
  }

  async gleiteZurDecke() {
    const g = this.gast;
    g.zustand = 'gleitet';
    const a = g.a;
    g.bund = [];
    let sitz = this.freierSitz();
    if (sitz < 0) sitz = 0;
    g.sitz = sitz;
    const p = SITZE[sitz];
    a.lookAt(p.x);
    await this.wait(0.3);
    await bogenFlug(this, a, p.x, p.y, { hoehe: -60, min: 1.4 });
    if (this.gast !== g) return;
    a.schatten.visible = true;
    a.pose('idle');
    a.zIndex = 20 + (p.y > 1350 ? 2 : 0);
    sfx('common/landen', { vol: 0.4 });
    this.burst('staub', p.x, p.y, { count: 3 });
    await this.wait(0.6);
    if (this.gast !== g) return;
    this.starteSnack();
  }

  starteSnack() {
    const g = this.gast;
    g.zustand = 'picknick';
    const a = g.a;
    a.lookAt(KORB.x);
    const id = wunsch(g.id);
    a.bubble(id, 2.6);
    a.onTap(() => this.gastTipp(), { pad: 60 });
    // Lieblingsessen hüpft aus dem Korb
    const e = spr(id, { x: KORB.x, y: KORB.y - 90, anchor: 0.5, z: 45 });
    const skala = 150 / Math.max(e.texture.width, e.texture.height);
    e.scale.set(skala * 0.4);
    e.futterId = id;
    e.eventMode = 'none';
    this.welt.addChild(e);
    g.essen = e;
    sfx('common/hupf', { vol: 0.4 });
    fx.wobble(this.korb, 0.03);
    bogenFlug(this, e, KORB.x + 40, KORB.y - 250, { hoehe: 90, min: 0.6, skala }).then(() => {
      if (e.destroyed || this.gast !== g) return;
      e.eventMode = 'static';
      g.essenZug = drag(e, {
        back: false,
        lift: 1.1,
        hitArea: new PIXI.Circle(0, 0, 150 / skala),
        targets: [{ obj: a, id: 'gast', radius: 320 }],
        onDrop: () => this.essenZumGast(),
      });
    });
  }

  async essenZumGast() {
    const g = this.gast;
    const e = g?.essen;
    if (!g || g.zustand !== 'picknick' || !e || e.destroyed || e.eventMode !== 'static') return;
    g.essenZug?.off();
    g.essenZug = null;
    const ok = await fuettere(this, g.a, e, { futter: e.futterId });
    if (this.gast !== g) return;
    if (!ok) {
      // (kommt kaum vor – er bekommt sein Lieblingsessen; isst er noch, hüpft es zurück) – nochmal anbieten
      if (!e.destroyed) {
        e.eventMode = 'static';
        g.essenZug = drag(e, { back: false, lift: 1.1, onDrop: () => this.essenZumGast() });
      }
      return;
    }
    this.fahrtFertig();
  }

  async fahrtFertig() {
    const g = this.gast;
    g.zustand = 'fertig';
    g.essen = null;
    g.a._tap?.off();
    freude(this, this.maus, { herzen: 5 });
    await this.wait(0.4);
    if (this.gast !== g) return;
    freude(this, g.a, { herzen: 5 });
    belohne(this, stickerFuer('ballon'), g.a.x + 220, g.a.y - 330);
    // bleibt auf der Decke sitzen – die Picknick-Runde wächst
    deckenGaeste.push({ id: g.id, sitz: g.sitz });
    this.setzeAufDecke(g.id, g.sitz, g.a);
    this.gast = null;
    this.after(5, () => this.neuerGast());
  }

  // ---------------------------------------------------------------- Ablauf

  betreten() {
    if (this.besuche === 1) this.after(0.6, () => voice('spielplatz_hallo'));
    // Hinweise bei jedem Betreten anmelden (der Kern sagt jeden höchstens einmal am Tag) – aber nur, solange die
    // Seite zu sehen ist und das Kind das noch nicht selbst tut (nurWenn: auch, wenn er erst später an die Reihe kommt)
    this.hinweiseAus();
    const erst = this.besuche === 1;
    const ballonNoch = () => this.aktiv && this.geplatzt === 0 && !this.gast;
    const blasenNoch = () => this.aktiv && !this.blasenGezogen;
    this._hinweise = [
      this.after(erst ? 5 : 1.2, () => { if (ballonNoch()) voice('spielplatz_ballon', { nurWenn: ballonNoch }); }),
      this.after(erst ? 13 : 9, () => { if (blasenNoch()) voice('spielplatz_blasen', { nurWenn: blasenNoch }); }),
    ];
    const g = this.gast;
    if (g && g.zustand === 'sammelt') {
      this.sageFahrt(g, erst ? 2.5 : 1.0);
      g.blaseZeit = -99;
    }
  }

  sageFahrt(g, nach) {
    const passt = () => this.aktiv && this.gast === g && g.zustand === 'sammelt' && g.bund.length === 0;
    this._hinweise.push(this.after(nach, () => {
      if (passt()) voice('spielplatz_ballonfahrt', { nurWenn: passt });
    }));
  }

  verlassen() {
    this.hinweiseAus();
  }

  hinweiseAus() {
    for (const h of this._hinweise || []) h?.kill();
    this._hinweise = [];
  }

  update(dt, t) {
    this.zeit = t;
    this.wolken.update(dt);
    this.falter.update(dt);
    this.vogel.update(dt);

    // Ballons
    this.zeitBallon -= dt;
    let aktiv = 0;
    for (const b of this.ballons) if (b.zustand.aktiv && b.zustand.bund < 0) aktiv++;
    if (this.zeitBallon <= 0) {
      if (aktiv < MAX_BALLONS) this.starteBallon();
      // sammelt ein Gast gerade, kommen sie etwas öfter
      this.zeitBallon = this.gast?.zustand === 'sammelt' ? rand(1.6, 2.6) : rand(2.8, 4.6);
    }
    this.gastUpdate(dt);
    for (const b of this.ballons) {
      const z = b.zustand;
      if (!z.aktiv || z.weg || z.bund >= 0) continue;
      // während die Zeige-Hand auf ihn zeigt, bleibt er stehen (wiegt nur)
      if (z.halt > 0) z.halt -= dt;
      else b.y -= z.v * dt;
      const w = t * 0.55 + z.phase;
      b.x = z.x0 + Math.sin(w) * 28;
      b.rotation = Math.cos(w) * 0.07;
      if (b.y < -260) {
        z.aktiv = false;
        b.visible = false;
        b.eventMode = 'none';
      }
    }

    // Überraschungen schweben wie Blätter herab, liegen kurz, gehen weich
    for (const s of this.geschenke) {
      const z = s.zustand;
      if (!z.aktiv) continue;
      z.t += dt;
      if (z.faellt) {
        s.y += 85 * dt;
        s.x = z.x0 + Math.sin(z.t * 1.7) * 45;
        s.rotation = Math.cos(z.t * 1.7) * 0.25;
        if (s.y >= z.boden) {
          s.y = z.boden;
          z.faellt = false;
          z.liegt = 7;
          this.tween(s, { rotation: 0 }, 0.4, { ease: 'sineInOut' });
        }
      } else if (z.liegt > 0) {
        z.liegt -= dt;
        if (z.liegt <= 0) {
          s.eventMode = 'none';
          this.tween(s, { alpha: 0 }, 0.8, { ease: 'sineInOut' }).then((ok) => {
            if (ok && z.liegt <= 0 && !z.faellt) {
              z.aktiv = false;
              s.visible = false;
            }
          });
        }
      }
    }

    // Seifenblasen treiben langsam nach oben, wackeln sanft, platzen irgendwann leise
    for (const b of this.blasen) {
      const z = b.zustand;
      if (!z.aktiv || z.weg) continue;
      z.alter += dt;
      if (z.zahm && z.alter > BLASE_ZAHM) {
        z.zahm = false;
        b.eventMode = 'static';
      }
      const br = Math.exp(-0.9 * dt);
      z.vx *= br;
      z.vy = z.vy * br - 14 * dt;
      b.x += z.vx * dt + Math.sin(z.alter * 1.3 + z.phase) * 12 * dt;
      b.y += z.vy * dt;
      if (z.alter > z.leben || b.y < -120) this.platzeBlase(b, false);
    }

    this.drachenUpdate(dt);
  }

  hinweise() {
    const g = this.gast;
    if (g) {
      if (g.zustand === 'fliegt') {
        // den Gast hinüber zur anderen Seite ziehen (die Hand beginnt am Gast selbst – der Griff ist unsichtbar
        // und hat keine Fläche, die Zeige-Hand nähme ihn nicht)
        this.flugMerker.position.set(g.a.x > 0 ? g.a.x - 650 : g.a.x + 650, g.a.y - 150);
        return [{ von: g.a, nach: this.flugMerker }];
      }
      if (g.zustand === 'landen') {
        const b = g.bund.find((x) => x.zustand.imBund);
        if (b) return [b];
      }
      if (g.zustand === 'picknick' && g.essen && !g.essen.destroyed && g.essen.eventMode === 'static') {
        return [{ von: g.essen, nach: g.a }];
      }
      if (g.zustand === 'sammelt') {
        // nur Ballons zeigen (bis zu zwei verschiedene) – nicht Stab und Drachen, die vom Ablauf weglocken
        const frei = this.ballons.filter((b) => b.zustand.aktiv && !b.zustand.weg && b.zustand.bund < 0 &&
          b.y > 420 && b.y < 1250 && Math.abs(b.x) < 900).slice(0, 2);
        for (const b of frei) b.zustand.halt = 3.2;
        return frei.length ? frei : [g.a];
      }
      // unterwegs (kommt, hebt ab, gleitet zur Decke): die Hand bleibt beim Gast
      if (g.zustand !== 'fertig') return [g.a];
    }
    const liste = [];
    const ballon = this.ballons.find((b) => b.zustand.aktiv && !b.zustand.weg && b.zustand.bund < 0 &&
      b.y > 450 && b.y < 1150 && Math.abs(b.x) < 850);
    if (ballon) {
      // anhalten, bis die Hand ihn erreicht und zweimal getippt hat (sonst zeigt sie ins Leere)
      ballon.zustand.halt = 3.2;
      liste.push(ballon);
    }
    liste.push({ von: this.stab, nach: { x: 0, y: 520 } });
    liste.push(this.drachenKoerper);
    return liste;
  }
}

// laufende Größen-/Deckkraft-Tweens einer Blase beenden (Wiederverwendung)
function killBlase(seite, b) {
  killTweensOf(b, ['scale', 'alpha']);
}
