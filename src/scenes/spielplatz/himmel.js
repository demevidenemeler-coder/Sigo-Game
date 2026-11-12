// Seite 1 – Himmel über der Wiese:
//   Luftballons steigen langsam auf (höchstens 6) – antippen: weiches Plopp, eine kleine Überraschung schwebt herab.
//   Seifenblasen-Stab unten im Gras: mit ihm durch die Luft ziehen → Seifenblasen (höchstens 25), antippen → plopp.
//   Drachen am Himmel: folgt dem ziehenden Finger träge, Schwanz weht nach.
//   Maus auf der Picknickdecke schaut zu und freut sich mit.

import {
  spr, tex, Actor, tap, drag, sfx, note, voice, killTweensOf, rand, pick, clamp, PIXI,
} from '../../engine/index.js';
import { Seite } from '../../gemeinsam/seiten.js';
import { belohne } from '../../gemeinsam/sticker.js';
import { freude, bildPunkt, teilTextur, stickerFuer, wolken, Schmetterling, Vogel } from './helfer.js';

const FARBEN = ['rot', 'gelb', 'blau', 'gruen', 'orange', 'lila'];
const UEBERRASCHUNGEN = ['ueberraschung_stern', 'ueberraschung_herz', 'ueberraschung_blume'];
const MAX_BALLONS = 6;
const BALLON_SKALA = 0.78;
const MAX_BLASEN = 25;
const BLASEN_ABSTAND = 75;          // so weit muss der Ring wandern, bis eine neue Blase entsteht
const BALLONS_JE_STICKER = 8;       // eine Runde: so viele Ballons geplatzt → Sticker
const PENTA = [72, 74, 76, 79, 81, 84];

// Bereich für den Mittelpunkt des Drachens – samt Körper (≈ 120/140 Einheiten zur Seite, 135 nach oben), Schweben
// und Griff-Kreis frei von den Knopf-Ecken oben (je 260×260) und den Blätter-Pfeilen (±1105, y 690…910)
const DRACHEN_RAUM = { x0: -760, x1: 760, y0: 380, y1: 720 };
const BLASE_ZAHM = 1.2;             // so lange (s) ist eine frische Blase noch nicht antippbar (Stab/Drachen greifbar)

export class Himmel extends Seite {
  static hg = 'spielplatz/hg_wiese';

  aufbau() {
    this.zeitBallon = 1.5;
    this.zeit = 0;
    this.geplatzt = 0;
    this.blasenGezogen = false;

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

    this.falter = new Schmetterling(this, {
      x: -300, y: 1380, farbe: 0, z: 45,
      bereich: { x0: -950, x1: 100, y0: 1250, y1: 1450 },
    });
    this.vogel = new Vogel(this, { y0: 260, y1: 480, z: 22 });
    this.baueBaum();
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
    for (let i = 0; i < MAX_BALLONS; i++) {
      const b = spr('spielplatz/ballon_' + FARBEN[i], { anchor: [0.5, 0.33], scale: BALLON_SKALA, z: 30 });
      b.visible = false;
      b.zustand = { aktiv: false, x0: 0, v: 60, phase: rand(0, 6), weg: false, halt: 0 };
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
    if (this.geplatzt % BALLONS_JE_STICKER === 0) {
      this.after(1.2, () => belohne(this, stickerFuer('ballon'), b.x, clamp(b.y, 400, 1000)));
    }
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

  // ---------------------------------------------------------------- Ablauf

  betreten() {
    if (this.besuche === 1) this.after(0.6, () => voice('spielplatz_hallo'));
    // Hinweise bei jedem Betreten anmelden (der Kern sagt jeden höchstens einmal am Tag) – aber nur, solange die
    // Seite zu sehen ist und das Kind das noch nicht selbst tut (nurWenn: auch, wenn er erst später an die Reihe kommt)
    this.hinweiseAus();
    const erst = this.besuche === 1;
    const ballonNoch = () => this.aktiv && this.geplatzt === 0;
    const blasenNoch = () => this.aktiv && !this.blasenGezogen;
    this._hinweise = [
      this.after(erst ? 5 : 1.2, () => { if (ballonNoch()) voice('spielplatz_ballon', { nurWenn: ballonNoch }); }),
      this.after(erst ? 13 : 9, () => { if (blasenNoch()) voice('spielplatz_blasen', { nurWenn: blasenNoch }); }),
    ];
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
    for (const b of this.ballons) if (b.zustand.aktiv) aktiv++;
    if (this.zeitBallon <= 0) {
      if (aktiv < MAX_BALLONS) this.starteBallon();
      this.zeitBallon = rand(2.8, 4.6);
    }
    for (const b of this.ballons) {
      const z = b.zustand;
      if (!z.aktiv || z.weg) continue;
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
    const liste = [];
    const ballon = this.ballons.find((b) => b.zustand.aktiv && !b.zustand.weg && b.y > 450 && b.y < 1150 &&
      Math.abs(b.x) < 850);
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
