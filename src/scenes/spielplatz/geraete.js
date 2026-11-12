// Seite 2 – Spielgeräte. Hauptsache: Ein Gast besucht den Spielplatz und möchte nacheinander drei Geräte
// ausprobieren (Denkblase zeigt das Gerät; jede Runde ein anderes Tier, andere Wünsche in anderer Reihenfolge).
//   1. Gast kommt und zeigt seinen Wunsch            (Denkblase mit dem Gerät)
//   2. Hinbringen        (ziehen – oder Gast/Gerät antippen) – lässt man ihn bei einem anderen Gerät los,
//                         spielt er eben dort (nichts ist falsch)
//   3. Spielen – jedes Gerät mit eigener Geste:
//        Schaukel   die Katze macht Platz, anschubsen (tippen), bis es hoch hinaus geht
//        Rutsche    hochklettern, dann oben antippen oder hinunterwischen
//        Wippe      das Schwein macht Platz, abwechselnd die hohe Seite antippen
//        Karussell  drehen (seitlich ziehen) oder antippen – der Gast schaut zu und freut sich
//        Federwippe aufsitzen, anstupsen
//   4. Drei Wünsche erfüllt: Der Gast freut sich, Sticker, ein Wimpel kommt an die Girlande über der Hecke
//      (sie wächst mit jedem Gast), der Gast winkt und geht; bald kommt der nächste.
//   Frei dazu (wie bisher): Schaukel, Rutsche mit drei wartenden Tieren, Wippe, Federwippe, Karussell, Bäume, Sand,
//   Schmetterling und Vogel reagieren immer.

import {
  spr, Actor, tap, drag, sfx, note, voice, fx, rand, pick, shuffle, clamp, store, ease, stage, PIXI,
} from '../../engine/index.js';
import { Seite, hgPunkt } from '../../gemeinsam/seiten.js';
import { belohne } from '../../gemeinsam/sticker.js';
import {
  freude, inVorn, bildPunkt, teilTextur, merker, wolken, Schmetterling, Vogel, andere, FARBEN,
} from './helfer.js';

const TIER_SKALA = 0.2;
const SEITEN = ['l', 'r'];
const TON_ABSTAND = 0.4;                    // gleiche Töne frühestens nach so vielen Sekunden wieder

// Gäste (zufällig, nie zweimal derselbe hintereinander) und Geräte, die sie sich wünschen
const GAESTE = ['pinguin', 'fuchs', 'eichhoernchen', 'maus', 'affe', 'huhn', 'baer', 'hund'];
const GERAETE = ['schaukel', 'rutsche', 'wippe', 'karussell', 'federwippe'];
const WUENSCHE_JE_GAST = 3;
const WARTE = { x: 190, y: 1455 };          // hier wartet der Gast auf den nächsten Wunsch
const AUSGANG = { x: 1480, y: 1468 };
const GAST_TEMPO = 240;

// Schaukel (x kommt aus dem Hintergrund-Punkt „schaukel")
const SCHAUKEL_SKALA = 0.55;
const SEIL_LAENGE = 222;                    // Aufhängung → Oberkante Brett (Einheiten)
const PENDEL_W = (2 * Math.PI) / 2.7;       // Eigenfrequenz (Periode 2,7 s)
const PENDEL_DAEMPFUNG = 0.17;
const PENDEL_MAX = 0.5;                     // größter Ausschlag (rad)
const SCHWUNG_ZEIT = 2.4;                   // so lange hoch schaukeln (s), dann ist der Wunsch erfüllt

// Rutsche: rechts neben der Schaukel (ihr rechtes Bein endet bei etwa −395), Leiter links ab etwa −340
const RUTSCHE_X = -40;
const RUTSCHE_SKALA = 0.6;
const RUTSCH_TIERE = ['ente', 'hase', 'frosch'];
// Bahn auf der Rutschfläche (Bildpunkte der Rutsche), von oben nach unten
const BAHN = [[528, 402], [600, 412], [680, 452], [760, 532], [840, 600], [930, 632], [1030, 644]];

// Wippe
const WIPPE_X = 690;
const WIPPE_SKALA = 0.55;
const WIPPE_MAX = 0.27;
const WIPP_ZIEL = 4;                        // so oft aufsetzen, dann ist der Wunsch erfüllt

// Karussell: Sitze (Ausschnitte im Bild, Mitte x), Kreisbahn um die Stange
const KARUSSELL_SITZE = [
  { x: 100, w: 195, winkel: -Math.PI / 2 },
  { x: 308, w: 196, winkel: 0 },
  { x: 535, w: 196, winkel: Math.PI / 2 },
];
const KARUSSELL_MITTE = 12;   // Stange liegt 12 Bildpunkte rechts der Bildmitte
const KARUSSELL_R = 218;
const KARUSSELL_SKALA = 0.46;              // Bild 788×900 → 362×414, nicht vergrößert
const KARUSSELL_ORT = { x: 620, y: 1528 }; // vorn im Gras zwischen Rutschen-Landung und Wippe
const REITER_SKALA = 0.1;                  // Igel auf dem vorderen Sitz (Welt-Größe)
const MELODIE = [72, 76, 79, 84, 81, 79, 76, 72];
const DREH_JE_EINHEIT = 0.0075;            // Drehung (rad) je Einheit, die der Finger seitlich zieht
const DREH_MAX = 3;                        // schneller dreht es nicht (rad/s) – ruhig

// Federwippe
const FW = { x: -760, y: 1488, skala: 0.5 };
const FEDER_ZIEL = 4;

// Girlande über der Hecke: ein Wimpel je zufriedenem Gast (bleibt für die ganze Spielzeit)
const GIRLANDE = { x0: -640, x1: 700, y: 642, durchhang: 70, plaetze: 12 };
let girlande = [];

// Bilder der Wünsche in der Denkblase
const WUNSCH_BILD = {
  schaukel: 'spielplatz/schaukel_sitz',
  rutsche: 'spielplatz/rutsche',
  karussell: 'spielplatz/karussell',
  federwippe: 'spielplatz/federwippe',
  wippe: null,                              // wird einmal aus Fuß und Balken zusammengesetzt (wippeBild)
};

export class Geraete extends Seite {
  static hg = 'spielplatz/hg_geraete';

  aufbau() {
    this.G = this.boden;
    this.zeit = 0;
    this.benutzt = false;   // schon ein Gerät angetippt (dann kein Hinweis mehr auf die Geräte)
    this._hinweise = [];
    this.tonZeit = {};
    this.gast = null;
    this.letzterGast = null;
    this.letzterWunsch = null;

    this.wolken = wolken(this, [
      { bild: 'wolke2', x: -200, y: 150, scale: 0.38, v: 8, alpha: 0.85 },
    ]);
    this.baueGirlande();
    this.baueSchaukel();
    this.baueRutsche();
    this.baueWippe();
    this.baueFederwippe();
    this.baueKarussell();
    // Der Schmetterling gaukelt über der Hecke – unten im Gras flog er vor dem wartenden Gast vorbei und fing
    // dessen Tipps ab
    this.falter = new Schmetterling(this, {
      x: 250, y: 700, farbe: 1, z: 320, scale: 0.9,
      bereich: { x0: -950, x1: 850, y0: 570, y1: 800 },
    });
    this.vogel = new Vogel(this, { y0: 200, y1: 420, z: 5, pause: [20, 36] });
    this.baueUmgebung();
    // Merkpunkte der Zeige-Hand
    this.wunschMerker = merker(this.welt);
    this.drehVon = merker(this.welt);
    this.drehNach = merker(this.welt);
    this.drehVon.position.set(KARUSSELL_ORT.x - 150, KARUSSELL_ORT.y - 200);
    this.drehNach.position.set(KARUSSELL_ORT.x + 160, KARUSSELL_ORT.y - 200);
    // Der wartende Gast zeigt seinen Wunsch immer wieder (nur auf der sichtbaren Seite)
    this.every(7, () => { if (this.aktiv) this.zeigeWunsch(); });
    this.after(1.2, () => this.neuerGast());
  }

  /** Ton nur, wenn derselbe nicht gerade eben erst klang (kein Stapeln bei Dauertippen) */
  ton(id, opt, abstand = TON_ABSTAND) {
    if (this.zeit - (this.tonZeit[id] ?? -99) < abstand) return false;
    this.tonZeit[id] = this.zeit;
    sfx(id, opt);
    return true;
  }

  tierZ(y) {
    return 100 + Math.round((y - 900) / 5);
  }

  /** Ding aus seinem Container in einen anderen hängen, ohne dass es springt */
  umhaengen(obj, ziel) {
    if (!obj.parent || obj.parent === ziel) return;
    const p = ziel.toLocal(obj.parent.toGlobal(obj.position));
    obj.parent.removeChild(obj);
    ziel.addChild(obj);
    obj.position.set(p.x, p.y);
  }

  /** Warten, bis `fn()` gilt (höchstens `max` Sekunden) */
  async warteBis(fn, max = 10) {
    let t = 0;
    while (!fn() && t < max) {
      await this.wait(0.15);
      t += 0.15;
    }
  }

  // ---------------------------------------------------------------- Bäume, Hecke, Sand (gemalt): reagieren auch

  baueUmgebung() {
    // ganz unten in der Welt: alles, was davor steht, fängt seine Tipps selbst
    const flaeche = (label, rect, fn) => {
      const c = new PIXI.Container({ label });
      c.zIndex = -50;
      this.welt.addChild(c);
      tap(c, fn, { sound: null, squash: false, hitArea: rect });
    };
    // Baumkronen und Hecke: zwischen den Blätter-Pfeilen, unter den Knopf-Ecken
    flaeche('baeume', new PIXI.Rectangle(-980, 280, 1960, 680), (e) => {
      if (this.ton('common/wusch', { vol: 0.22, rate: 0.8 }, 0.5)) {
        this.burst('blaetter', e.x, Math.min(e.y, 900), { count: 3 });
        this.wackleGirlande();
      }
    });
    // Sandfläche: ein wenig Staub
    flaeche('sand', new PIXI.Rectangle(-1000, 960, 2000, 420), (e) => {
      if (this.ton('common/sand', { vol: 0.25 }, 0.5)) this.burst('staub', e.x, e.y, { count: 2 });
    });
  }

  // ---------------------------------------------------------------- Girlande (wächst mit jedem Gast)

  girlandenPunkt(t) {
    const g = GIRLANDE;
    return {
      x: g.x0 + (g.x1 - g.x0) * t,
      y: g.y + g.durchhang * 4 * t * (1 - t),
      winkel: Math.atan2(g.durchhang * 4 * (1 - 2 * t), g.x1 - g.x0),
    };
  }

  baueGirlande() {
    const g = GIRLANDE;
    this.girlande = new PIXI.Container({ label: 'girlande' });
    this.girlande.zIndex = 2;
    this.girlande.eventMode = 'none';
    this.welt.addChild(this.girlande);
    this.girlandenSchnur = new PIXI.Graphics()
      .moveTo(g.x0, g.y).quadraticCurveTo((g.x0 + g.x1) / 2, g.y + g.durchhang * 2, g.x1, g.y)
      .stroke({ width: 8, color: 0xfff4dc, alpha: 0.95 })
      .circle(g.x0, g.y, 9).fill(0xc98d55)
      .circle(g.x1, g.y, 9).fill(0xc98d55);
    this.girlandenSchnur.visible = girlande.length > 0;
    this.girlande.addChild(this.girlandenSchnur);
    this.wimpel = [];
    girlande.forEach((farbe, i) => this.setzeWimpel(farbe, i, false));
  }

  setzeWimpel(farbe, i, neu) {
    const p = this.girlandenPunkt((i + 0.5) / GIRLANDE.plaetze);
    const w = new PIXI.Graphics()
      .poly([-44, 0, 44, 0, 0, 104]).fill(farbe)
      .poly([-44, 0, 44, 0, 0, 22]).fill({ color: 0xffffff, alpha: 0.3 })
      .poly([-44, 0, 44, 0, 0, 104]).stroke({ width: 4, color: 0x000000, alpha: 0.08 });
    w.position.set(p.x, p.y);
    w.rotation = p.winkel;
    w.phase = rand(0, 6);
    w.ruhe = p.winkel;
    this.girlande.addChild(w);
    if (neu) {
      w.scale.set(0.2);
      this.tween(w, { scale: 1 }, 0.55, { ease: 'backOut' });
      this.burst('funkeln', p.x, p.y + 30, { count: 3 });
    }
    this.wimpel[i] = w;
  }

  neuerWimpel() {
    const farbe = pick(FARBEN.filter((f) => f !== girlande[girlande.length - 1]));
    if (!this.girlandenSchnur.visible) {
      this.girlandenSchnur.visible = true;
      this.girlandenSchnur.alpha = 0;
      this.tween(this.girlandenSchnur, { alpha: 1 }, 0.6, { ease: 'sineInOut' });
    }
    if (girlande.length >= GIRLANDE.plaetze) {
      // voll: alle Wimpel bekommen nacheinander neue Farben – die Girlande bleibt bunt und lebendig
      girlande.shift();
      const alt = this.wimpel.shift();
      if (alt) this.tween(alt, { alpha: 0 }, 0.5, { ease: 'sineInOut' }).then(() => { if (!alt.destroyed) alt.destroy(); });
      this.wimpel.forEach((w, i) => {
        const p = this.girlandenPunkt((i + 0.5) / GIRLANDE.plaetze);
        w.ruhe = p.winkel;
        this.tween(w, { x: p.x, y: p.y }, 0.8, { ease: 'sineInOut' });
      });
    }
    girlande.push(farbe);
    this.setzeWimpel(farbe, girlande.length - 1, true);
  }

  wackleGirlande() {
    for (const w of this.wimpel) if (w && !w.destroyed) w.schubs = 1;
  }

  girlandeUpdate(dt, t) {
    for (const w of this.wimpel) {
      if (!w || w.destroyed) continue;
      w.schubs = Math.max(0, (w.schubs || 0) - dt * 0.6);
      w.rotation = w.ruhe + Math.sin(t * 1.2 + w.phase) * (0.04 + 0.12 * w.schubs);
    }
  }

  // ---------------------------------------------------------------- Schaukel

  baueSchaukel() {
    const G = this.G;
    const S = SCHAUKEL_SKALA;
    const x = this.punkt('schaukel', { x: -694 }).x;
    this.gestell = spr('spielplatz/schaukel_gestell', { x, y: G, scale: S, z: 10, parent: this.welt });
    const haken = hgPunkt(this.gestell, 'aufhaengung') || bildPunkt(this.gestell, 555, 125);
    this.haken = haken;

    // Schatten unter der Schaukel (wandert mit)
    this.schaukelSchatten = new PIXI.Graphics().ellipse(0, 0, 120, 18).fill({ color: 0x5a4630, alpha: 0.16 });
    this.schaukelSchatten.position.set(haken.x, G - 6);
    this.schaukelSchatten.zIndex = 9;
    this.welt.addChild(this.schaukelSchatten);

    const p = new PIXI.Container({ label: 'schaukel' });
    p.position.set(haken.x, haken.y);
    p.zIndex = 12;
    // Seile (gestaucht, damit das Brett über dem Boden hängt) und Brett als eigene Ausschnitte
    const breite = S * 0.8;
    const seile = new PIXI.Sprite(teilTextur('spielplatz/schaukel_sitz', 0, 0, 469, 700));
    seile.anchor.set(0.5, 35 / 700);
    seile.scale.set(breite, SEIL_LAENGE / 665);
    const brett = new PIXI.Sprite(teilTextur('spielplatz/schaukel_sitz', 0, 690, 469, 110));
    brett.anchor.set(0.5, 10 / 110);
    brett.position.set(0, SEIL_LAENGE);
    brett.scale.set(breite);
    p.addChild(seile, brett);
    this.brett = brett;
    this.sitzSchaukel = { x: 8, y: SEIL_LAENGE + 10 };
    this.katze = new Actor('katze', { x: this.sitzSchaukel.x, y: this.sitzSchaukel.y, scale: TIER_SKALA, parent: p });
    this.katze.schatten.visible = false;
    this.katze.onTap(() => {
      if (this.katze.umsteigt) this.umsteigerTipp(this.katze);   // macht gerade Platz: kein Hüpfer dazwischen
      else if (this.schaukelReiter === this.katze) this.schaukelTipp();
      else freude(this, this.katze, { herzen: 3, hoehe: 40 });
    }, { pad: 60 });
    this.schaukelReiter = this.katze;
    this.welt.addChild(p);
    this.schaukel = p;
    this.pendel = { w: 0, v: 0, letzteV: 0, quietsch: -10, schubser: 0, zeit: 0, froh: false, bremse: false };

    tap(p, () => this.schaukelTipp(), { sound: null, squash: false, hitArea: new PIXI.Rectangle(-150, 60, 300, 300) });
    tap(this.gestell, () => this.schaukelTipp(), { sound: null, squash: false });
  }

  schaukelTipp() {
    this.geraetGetippt('schaukel');
    this.schubse();
  }

  schubse() {
    this.benutzt = true;   // ein Gerät angetippt: kein Hinweis mehr auf die Geräte
    const z = this.pendel;
    if (z.bremse) { fx.wobble(this.gestell, 0.015); return; }   // gerade steigt jemand um
    const amp = Math.hypot(z.w, z.v / PENDEL_W);
    const richtung = Math.abs(z.v) > 0.15 ? Math.sign(z.v) : (z.w > 0 ? -1 : 1);
    z.v += richtung * (amp < 0.1 ? 1.0 : 0.6);
    const neu = Math.hypot(z.w, z.v / PENDEL_W);
    if (neu > PENDEL_MAX) z.v *= PENDEL_MAX / neu;
    this.ton('common/wusch', { vol: 0.3 });
    z.schubser++;
    if (z.schubser % 3 === 1 && z.zeit - (z.laut ?? -10) > 3) {
      z.laut = z.zeit;
      this.schaukelReiter?.sound();
    }
  }

  schaukelUpdate(dt) {
    const z = this.pendel;
    z.zeit += dt;
    // in kleinen Schritten rechnen (stabil auch bei großem dt)
    const daempfung = z.bremse ? 2.2 : PENDEL_DAEMPFUNG;
    let rest = dt;
    while (rest > 0) {
      const h = Math.min(rest, 1 / 120);
      rest -= h;
      z.v += (-PENDEL_W * PENDEL_W * Math.sin(z.w) - daempfung * z.v) * h;
      z.w += z.v * h;
    }
    this.schaukel.rotation = z.w;
    this.schaukelSchatten.x = this.schaukel.x - Math.sin(z.w) * (SEIL_LAENGE + 40);
    this.schaukelSchatten.scale.x = 1 - Math.abs(z.w) * 0.4;
    const amp = Math.hypot(z.w, z.v / PENDEL_W);
    // Umkehrpunkt: ab und zu ein leises Quietschen
    if (Math.sign(z.v) !== Math.sign(z.letzteV) && amp > 0.25 && z.zeit - z.quietsch > 7) {
      z.quietsch = z.zeit;
      sfx('common/quietsch', { vol: 0.3 });
    }
    z.letzteV = z.v;
    // wer drauf sitzt, freut sich, wenn es hoch hinaus geht
    const r = this.schaukelReiter;
    if (r) {
      if (!z.froh && amp > 0.3) {
        z.froh = true;
        r.pose('happy');
      } else if (z.froh && amp < 0.12) {
        z.froh = false;
        r.pose('idle');
      }
    }
    // Wunsch des Gastes: eine Weile hoch schaukeln
    const g = this.gast;
    if (g && g.zustand === 'spielt' && g.aufgabe === 'schaukel' && amp > 0.27) {
      g.schwung = (g.schwung || 0) + dt;
      if (g.schwung >= SCHWUNG_ZEIT) this.aufgabeFertig();
    }
  }

  // ---------------------------------------------------------------- Rutsche

  baueRutsche() {
    const G = this.G;
    const S = RUTSCHE_SKALA;
    this.rutsche = spr('spielplatz/rutsche', { x: RUTSCHE_X, y: G, scale: S, z: 10, parent: this.welt });
    const r = this.rutsche;
    this.leiterFuss = hgPunkt(r, 'leiter_fuss') || bildPunkt(r, 150, 770);
    this.leiterFuss.x += 10;
    this.leiterOben = bildPunkt(r, 262, 408);
    this.obenPunkt = hgPunkt(r, 'oben') || bildPunkt(r, 520, 410);
    this.obenPunkt.y -= 4;
    this.bahn = BAHN.map(([x, y]) => bildPunkt(r, x, y));
    this.bahnLaengen = [0];
    for (let i = 1; i < this.bahn.length; i++) {
      const a = this.bahn[i - 1];
      const b = this.bahn[i];
      this.bahnLaengen.push(this.bahnLaengen[i - 1] + Math.hypot(b.x - a.x, b.y - a.y));
    }
    // Landung kurz hinter dem Rutschen-Ende (vor der Wippe, die erst bei etwa +390 beginnt)
    const ende = this.bahn[this.bahn.length - 1];
    this.landung = { x: ende.x + 45, y: G + 40 };
    // Warteplätze: schräg vor der Leiter, nach vorn hin (frei vom rechten Schaukelbein)
    this.plaetze = [
      { x: this.leiterFuss.x - 5, y: G + 35 },
      { x: this.leiterFuss.x + 115, y: G + 105 },
      { x: this.leiterFuss.x + 240, y: G + 165 },
    ];
    this.schlange = [];
    this.leiterFrei = true;
    RUTSCH_TIERE.forEach((id, i) => {
      const p = this.plaetze[i];
      const a = new Actor(id, { x: p.x, y: p.y, scale: TIER_SKALA, parent: this.welt, z: this.tierZ(p.y) });
      a.bereit = true;
      a._platz = i;
      a.onTap(() => this.rutschTierTipp(a), { pad: 70 });
      this.schlange.push(a);
    });
    tap(r, () => {
      this.geraetGetippt('rutsche');
      if (this.gast?.oben) this.gastRutscht();   // der Gast sitzt oben: los geht's
      else this.starteRutschen();
    }, {
      sound: null, squash: false,
      // ganze Rutsche (Bildpunkte, Anker unten Mitte)
      hitArea: new PIXI.Rectangle(-560, -800, 1120, 820),
    });
  }

  rutschTierTipp(a) {
    this.benutzt = true;
    // Jedes wartende Tier darf angetippt werden: ist die Leiter frei, klettert das vorderste los
    const vorn = this.schlange[0];
    if (vorn && vorn.bereit && this.leiterFrei && this.schlange.includes(a)) {
      this.starteRutschen();
      if (a !== vorn) a.nod();
    } else if (a.bereit && !a.unterwegs) {
      freude(this, a, { herzen: 3, hoehe: 50 });
    } else {
      a.sound();
    }
  }

  ordneSchlange() {
    this.schlange.forEach((t, i) => {
      if (t._platz === i) return;
      t._platz = i;
      t.bereit = false;
      const p = this.plaetze[Math.min(i, this.plaetze.length - 1)];
      t.zIndex = this.tierZ(Math.max(t.y, p.y));
      t.walkTo(p.x, p.y, { tempo: 210 }).then((ok) => {
        if (t._platz !== i) return;
        if (ok) {
          t.bereit = true;
          t.zIndex = this.tierZ(p.y);
          t.lookAt(this.leiterFuss.x + 400);
        } else {
          // unterbrochen: kurz danach noch einmal
          t._platz = -1;
          this.after(0.4, () => this.ordneSchlange());
        }
      });
    });
  }

  /** Leiter hinauf bis oben auf die Rutsche → Promise<boolean> */
  async klettere(a) {
    a.zIndex = 230;
    sfx('common/hupf', { vol: 0.35 });
    let ok = await a.walkTo(this.leiterFuss.x, this.leiterFuss.y, { tempo: 240 });
    if (ok) ok = await a.walkTo(this.leiterOben.x, this.leiterOben.y, { tempo: 140 });
    if (ok) ok = await a.walkTo(this.obenPunkt.x, this.obenPunkt.y, { tempo: 170 });
    if (ok) {
      a.pose('idle');
      a.lookAt(this.obenPunkt.x + 300);
    }
    return ok;
  }

  /** Von oben hinunterrutschen und unten landen → Promise */
  async rutschHinunter(a) {
    this.leiterFrei = true;
    // hinunter: erst langsam, dann schneller, unten weich auslaufen
    sfx('common/rutsch', { vol: 0.6 });
    const gesamt = this.bahnLaengen[this.bahnLaengen.length - 1];
    const proxy = { p: 0 };
    const k = a.koerper;
    await this.tween(proxy, { p: 1 }, 1.5, {
      ease: (t) => (t < 0.7 ? 0.7 * ease.quadIn(t / 0.7) * 0.85 : 0.595 + 0.405 * ease.quadOut((t - 0.7) / 0.3)),
      onUpdate: () => {
        if (a.destroyed) return;
        const s = proxy.p * gesamt;
        let i = 1;
        while (i < this.bahn.length - 1 && this.bahnLaengen[i] < s) i++;
        const p0 = this.bahn[i - 1];
        const p1 = this.bahn[i];
        const l0 = this.bahnLaengen[i - 1];
        const t = clamp((s - l0) / Math.max(1, this.bahnLaengen[i] - l0), 0, 1);
        a.x = p0.x + (p1.x - p0.x) * t;
        a.y = p0.y + (p1.y - p0.y) * t;
        k.rotation = Math.atan2(p1.y - p0.y, p1.x - p0.x) * 0.45;
      },
    });
    this.tween(k, { rotation: 0 }, 0.2, { ease: 'sineOut' });
    a.zIndex = this.tierZ(this.landung.y);
    await a.hopTo(this.landung.x, this.landung.y, { hoehe: 55, dauer: 0.5 });
  }

  async starteRutschen() {
    this.benutzt = true;
    const a = this.schlange[0];
    if (!this.leiterFrei || !a || !a.bereit) {
      fx.wobble(this.rutsche, 0.02);
      return;
    }
    this.leiterFrei = false;
    this.schlange.shift();
    a.unterwegs = true;
    a.bereit = false;
    a._platz = -1;
    this.ordneSchlange();
    const ok = await this.klettere(a);
    if (!ok) { this.leiterFrei = true; this.zurueck(a); return; }
    await this.wait(0.35);
    await this.rutschHinunter(a);
    await freude(this, a);
    this.zurueck(a);
  }

  zurueck(a) {
    a.unterwegs = false;
    a._platz = -1;
    this.schlange.push(a);
    this.ordneSchlange();
  }

  // ---------------------------------------------------------------- Wippe

  baueWippe() {
    const G = this.G;
    const S = WIPPE_SKALA;
    this.wippeFuss = spr('spielplatz/wippe_fuss', { x: WIPPE_X, y: G, scale: S, z: 12, parent: this.welt });
    const lager = hgPunkt(this.wippeFuss, 'lager') || bildPunkt(this.wippeFuss, 250, 110);
    const b = new PIXI.Container({ label: 'wippe' });
    b.position.set(lager.x, lager.y - 2);
    b.zIndex = 11;
    spr('spielplatz/wippe_balken', { anchor: [550 / 1100, 185 / 189], scale: S, parent: b });
    this.welt.addChild(b);
    this.wippe = b;
    this.sitze = {
      l: { x: (160 - 550) * S, y: (96 - 185) * S },
      r: { x: (960 - 550) * S, y: (96 - 185) * S },
    };
    this.schwein = new Actor('schwein', { scale: TIER_SKALA, parent: this.welt, z: 14, flip: true });
    this.wippeTiere = {
      l: new Actor('schaf', { scale: TIER_SKALA, parent: this.welt, z: 14 }),
      r: this.schwein,
    };
    for (const seite of SEITEN) {
      const t = this.wippeTiere[seite];
      t.schatten.visible = false;
      t.onTap(() => {
        if (t.umsteigt) this.umsteigerTipp(t);   // macht gerade Platz: kein Hüpfer dazwischen
        else if (this.wippeTiere.l === t || this.wippeTiere.r === t) this.wippeTipp(this.wippeTiere.l === t ? 'l' : 'r');
        else freude(this, t, { herzen: 3, hoehe: 40 });
      }, { pad: 60 });
    }
    this.wz = { w: WIPPE_MAX * 0.7, v: 0, ziel: WIPPE_MAX, unten: 'r', aufgesetzt: true, zaehler: 0 };
    tap(b, (e) => this.wippeTipp(e.x < WIPPE_X ? 'l' : 'r'), {
      sound: null, squash: false, hitArea: new PIXI.Rectangle(-340, -150, 680, 200),
    });
    tap(this.wippeFuss, () => this.wippeTipp(this.wz.unten === 'l' ? 'r' : 'l'), { sound: null, squash: false });
    this.wippeUpdate(0);
  }

  wippeTipp(seite) {
    this.geraetGetippt('wippe');
    this.wippen(seite);
  }

  sitzWelt(seite) {
    const p = this.sitze[seite];
    const c = Math.cos(this.wz.w);
    const s = Math.sin(this.wz.w);
    return { x: this.wippe.x + p.x * c - p.y * s, y: this.wippe.y + p.x * s + p.y * c + 4 };
  }

  wippen(seite) {
    this.benutzt = true;
    const z = this.wz;
    if (z.halt) return;   // gerade steigt jemand um
    if (z.unten === seite && z.aufgesetzt) {
      // schon unten: kleiner Hopser mit derselben Seite
      z.v += (seite === 'l' ? 1 : -1) * 0.9;
      z.aufgesetzt = false;
      if (this.wippeTiere[seite]) freude(this, this.wippeTiere[seite], { laut: false, herzen: 2, hoehe: 30 });
      return;
    }
    z.unten = seite;
    z.ziel = seite === 'l' ? -WIPPE_MAX : WIPPE_MAX;
    z.aufgesetzt = false;
    this.ton('common/wusch', { vol: 0.25, rate: 0.9 });
  }

  wippeUpdate(dt) {
    const z = this.wz;
    if (dt > 0) {
      const vorher = z.w;
      z.v += ((z.ziel - z.w) * 20 - z.v * 5.5) * dt;
      z.w += z.v * dt;
      // Boden: weiter als bis zum Aufsetzen geht es nicht
      if (Math.abs(z.w) > WIPPE_MAX) {
        z.w = Math.sign(z.w) * WIPPE_MAX;
        z.v *= -0.25;
      }
      // Aufsetzen auf der Zielseite: weiches Tock, das obere Tier hüpft leicht
      const zielSeite = Math.sign(z.ziel);
      if (!z.aufgesetzt && Math.sign(z.w) === zielSeite && Math.abs(z.w) >= WIPPE_MAX - 0.01 &&
          Math.abs(vorher) < WIPPE_MAX - 0.001) {
        z.aufgesetzt = true;
        sfx('common/landen', { vol: 0.45 });
        const oben = this.wippeTiere[z.unten === 'l' ? 'r' : 'l'];
        z.zaehler++;
        if (oben) {
          oben.hop(40);
          if (z.zaehler % 3 === 0) oben.sound();
        }
        const g = this.gast;
        if (g && g.zustand === 'spielt' && g.aufgabe === 'wippe' && z.zaehler - g.wippStart >= WIPP_ZIEL) {
          this.aufgabeFertig();
        }
      } else if (!z.aufgesetzt && Math.abs(z.v) < 0.02 && Math.abs(z.ziel - z.w) < 0.01) {
        z.aufgesetzt = true;
      }
    }
    this.wippe.rotation = z.w;
    for (const seite of SEITEN) {
      const t = this.wippeTiere[seite];
      if (!t) continue;
      const p = this.sitzWelt(seite);
      t.position.set(p.x, p.y);
    }
  }

  // ---------------------------------------------------------------- Federwippe

  baueFederwippe() {
    // Container um das Pferdchen: es neigt sich samt Reiter um den Fuß der Feder
    const box = new PIXI.Container({ label: 'federwippe' });
    box.position.set(FW.x, FW.y);
    box.zIndex = 300;
    box.sortableChildren = true;
    this.welt.addChild(box);
    const f = spr('spielplatz/federwippe', { scale: FW.skala, parent: box, z: 0 });
    this.federwippe = f;
    this.fwBox = box;
    this.fwSattel = hgPunkt(f, 'sattel') || { x: -20, y: -135 };
    this.fw = { w: 0, v: 0, richtung: 1 };
    tap(box, () => this.federTipp(), { sound: null, squash: false, hitArea: new PIXI.Rectangle(-125, -262, 250, 272) });
  }

  federTipp() {
    this.benutzt = true;
    this.geraetGetippt('federwippe');
    this.fw.v += this.fw.richtung * 1.6;
    this.fw.richtung *= -1;
    this.ton('common/hupf', { vol: 0.45 });
    const g = this.gast;
    if (g && g.zustand === 'spielt' && g.aufgabe === 'federwippe') {
      g.feder = (g.feder || 0) + 1;
      if (g.feder % 2 === 0) g.a.pose('happy');
      if (g.feder >= FEDER_ZIEL) this.after(0.8, () => this.aufgabeFertig());
    }
  }

  federUpdate(dt) {
    const z = this.fw;
    z.v += (-55 * z.w - 2.2 * z.v) * dt;
    z.w = clamp(z.w + z.v * dt, -0.28, 0.28);
    this.fwBox.rotation = z.w;
  }

  // ---------------------------------------------------------------- Karussell

  baueKarussell() {
    const id = 'spielplatz/karussell';
    const k = new PIXI.Container({ label: 'karussell', sortableChildren: true });
    k.position.set(KARUSSELL_ORT.x, KARUSSELL_ORT.y);
    k.scale.set(KARUSSELL_SKALA);
    k.zIndex = 300;
    const AX = 394;      // Anker (unten Mitte) im Bild
    const AY = 885;
    const teil = (x, y, w, h, z) => {
      const s = new PIXI.Sprite(teilTextur(id, x, y, w, h));
      s.position.set(x - AX, y - AY);
      s.zIndex = z;
      k.addChild(s);
      return s;
    };
    teil(0, 0, 788, 503, 4);          // Dach mit oberer Stange
    teil(0, 655, 788, 245, 0);        // Drehteller und Fuß
    // Stange zwischen Dach und Teller (im Bild hinter dem gelben Sitz verborgen) – selbst gezeichnet
    const stange = new PIXI.Graphics()
      .roundRect(KARUSSELL_MITTE - 30, 495 - AY, 60, 180, 14).fill(0xf0b030)
      .roundRect(KARUSSELL_MITTE - 18, 495 - AY, 14, 180, 7).fill({ color: 0xffd877, alpha: 0.8 });
    stange.zIndex = 2;
    k.addChild(stange);
    this.karussellSitze = KARUSSELL_SITZE.map((o) => {
      const s = new PIXI.Sprite(teilTextur(id, o.x, 505, o.w, 152));
      s.anchor.set(0.5, 1);
      s.basis = o.winkel;
      k.addChild(s);
      return s;
    });
    // ein Igel fährt auf dem vorderen Sitz mit (dreht sich mit ihm, ist hinten hinter der Stange)
    this.reiter = new Actor('igel', { x: 0, y: 0, scale: REITER_SKALA / KARUSSELL_SKALA, parent: k });
    this.reiter.schatten.visible = false;
    this.reiter.eventMode = 'none';
    this.welt.addChild(k);
    this.karussell = k;
    // phi = Drehwinkel, omega = Schwung nach dem Loslassen, summe = insgesamt gedreht (für den Wunsch des Gastes)
    this.kz = { dreht: false, phi: 0, omega: 0, summe: 0, abschnitt: 0, gezeigt: NaN };
    this.stelleSitze(0);

    // Griff über dem Karussell: seitlich ziehen dreht es, kurz antippen dreht eine ganze Runde
    const griff = new PIXI.Container({ label: 'karussellGriff' });
    griff.position.set(KARUSSELL_ORT.x, KARUSSELL_ORT.y);
    griff.zIndex = 305;
    this.welt.addChild(griff);
    this.karussellGriff = griff;
    this.karussellZug = drag(griff, {
      back: false,
      lift: 1,
      // Umriss des Karussells (Teller, Sitze, Dach mit Spitze): oben schmaler, damit Fuß und Lager der Wippe
      // dahinter ihre Tipps selbst bekommen
      hitArea: new PIXI.Polygon([-200, 0, 200, 0, 200, -225, 175, -262, 70, -350, 25, -410, -25, -410, -70, -350, -175, -262, -200, -225]),
      onStart: (ctx) => {
        this.benutzt = true;
        this.geraetGetippt('karussell');
        this.killDrehung();
        ctx.letzteX = griff.x;
        ctx.weg = 0;
        fx.pop(k, 0.03);
      },
      onMove: (ziel, ctx) => {
        const dx = griff.x - ctx.letzteX;
        ctx.letzteX = griff.x;
        ctx.weg += Math.abs(dx);
        const d = clamp(dx * DREH_JE_EINHEIT, -0.06, 0.06);
        this.dreheUm(d);
        this.kz.omega = clamp(this.kz.omega * 0.6 + (d / (1 / 60)) * 0.4, -DREH_MAX, DREH_MAX);
      },
      onDrop: (ziel, ctx) => {
        griff.position.set(KARUSSELL_ORT.x, KARUSSELL_ORT.y);
        if ((ctx.weg || 0) < 30) this.dreheKarussell();
      },
    });
  }

  killDrehung() {
    this.kzTween?.stop();
    this.kzTween = null;
    this.kz.dreht = false;
  }

  dreheUm(d) {
    this.kz.phi += d;
    this.kz.summe += Math.abs(d);
  }

  stelleSitze(phi) {
    for (const s of this.karussellSitze) {
      const w = s.basis + phi;
      const c = Math.cos(w);
      s.x = KARUSSELL_MITTE + Math.sin(w) * KARUSSELL_R;
      s.y = 657 - 885 - 16 * (1 - c);
      s.scale.set(1 - 0.09 * (1 - c));
      s.zIndex = c < -0.05 ? 1 : 3;
    }
    // der Reiter sitzt auf dem vorderen Sitz (Ruhe-Winkel 0)
    const sitz = this.karussellSitze[1];
    const r = this.reiter;
    if (r && sitz) {
      r.position.set(sitz.x + 4, sitz.y - 40 * sitz.scale.y);
      r.scale.set((REITER_SKALA / KARUSSELL_SKALA) * sitz.scale.y);
      // vorn vor Stange und Dachrand, seitlich zwischen Sitz und Dach, hinten hinter der Stange
      const c = Math.cos(sitz.basis + phi);
      r.zIndex = c > 0.3 ? 5 : sitz.zIndex + 0.5;
    }
  }

  dreheKarussell() {
    this.benutzt = true;
    if (this.kz.dreht) {
      // läuft schon: nur ein Wackeln, die Melodie spielt allein weiter (keine gestapelten Noten)
      fx.wobble(this.karussell, 0.02);
      return;
    }
    this.kz.dreht = true;
    this.kz.omega = 0;
    const dach = inVorn(this, this.welt, { x: this.karussell.x, y: this.karussell.y - 380 });
    if (dach) this.burst('noten', dach.x, dach.y, { count: 3 });
    const proxy = { p: 0, alt: 0 };
    this.kzTween = this.tween(proxy, { p: 1 }, 4.2, {
      ease: 'sineInOut',
      onUpdate: () => {
        this.dreheUm((proxy.p - proxy.alt) * Math.PI * 2);
        proxy.alt = proxy.p;
      },
    });
    this.kzTween.then((ok) => { if (ok) this.kz.dreht = false; });
  }

  karussellUpdate(dt) {
    const z = this.kz;
    if (!z.dreht && !this.karussellZug.isDragging() && Math.abs(z.omega) > 0.01) {
      this.dreheUm(z.omega * dt);
      z.omega *= Math.exp(-1.3 * dt);
    }
    if (z.phi !== z.gezeigt) {
      z.gezeigt = z.phi;
      this.stelleSitze(z.phi);
      // je Achtel-Runde ein Glöckchen der Melodie
      const abschnitt = Math.floor(z.phi / (Math.PI / 4));
      if (abschnitt !== z.abschnitt) {
        z.abschnitt = abschnitt;
        note('glocke', MELODIE[((abschnitt % 8) + 8) % 8], { vol: 0.28 });
      }
    }
    const dreht = z.dreht || Math.abs(z.omega) > 0.6 || this.karussellZug.isDragging();
    if (dreht !== z.froh) {
      z.froh = dreht;
      this.reiter.pose(dreht ? 'happy' : 'idle');
    }
    const g = this.gast;
    if (g && g.zustand === 'spielt' && g.aufgabe === 'karussell') {
      if (dreht && !g.jubelt) { g.jubelt = true; g.a.pose('happy'); }
      if (z.summe - g.drehStart >= Math.PI * 2 * 0.95) this.aufgabeFertig();
    }
  }

  // ---------------------------------------------------------------- Gast

  neuerGast() {
    if (this.gast) return;
    const id = andere(GAESTE, this.letzterGast);
    this.letzterGast = id;
    const wuensche = shuffle([...GERAETE]).slice(0, WUENSCHE_JE_GAST);
    if (wuensche[0] === this.letzterWunsch) wuensche.push(wuensche.shift());
    this.letzterWunsch = wuensche[0];
    const a = new Actor(id, { x: AUSGANG.x, y: AUSGANG.y, scale: TIER_SKALA, parent: this.welt, z: 320 });
    const g = { a, id, wuensche, zustand: 'kommt', aufgabe: null };
    this.gast = g;
    // unterwegs antippen: ein Laut (kein Hüpfer – der würde das Laufen ablösen)
    a.onTap(() => this.gastTipp(), { pad: 70 });
    a.walkTo(WARTE.x, WARTE.y, { tempo: GAST_TEMPO }).then((ok) => {
      if (this.gast !== g) return;
      if (!ok) { a.position.set(WARTE.x, WARTE.y); }
      this.gastWartet();
    });
  }

  gastWartet() {
    const g = this.gast;
    const a = g.a;
    g.zustand = 'wartet';
    g.aufgabe = null;
    g.jubelt = false;
    a.zIndex = 320;
    a.pose('idle');
    a.lookAt(-400);
    a._tap?.off();
    // Hinbringen: ziehen (zu irgendeinem Gerät) – oder nur antippen: dann geht er selbst zu seinem Wunsch
    g.zug = drag(a, {
      back: false,
      lift: 1.08,
      // Tippfläche um den ganzen Gast (Einheiten des Actors, Skala 0.2 → 280 × 240 in der Welt)
      hitArea: new PIXI.Rectangle(-700, -1100, 1400, 1200),
      onStart: () => sfx('common/hupf', { vol: 0.3 }),
      onDrop: (_, ctx) => {
        a.zIndex = 320;
        const weg = Math.hypot(ctx.x - ctx.startX, ctx.y - ctx.startY);
        // nur angetippt: er geht zu seinem Wunsch; gezogen: zum nächsten Gerät (der Körper zählt, nicht die Füße)
        const ziel = weg < 40 ? null : this.naechstesGeraet(a.x, a.y - 60);
        if (weg < 40) this.geheZu(g.wuensche[0]);
        else if (ziel) this.geheZu(ziel.id);
        else a.walkTo(WARTE.x, WARTE.y, { tempo: GAST_TEMPO }).then(() => a.lookAt(-400));
      },
    });
    g.blaseZeit = -99;
    this.zeigeWunsch();
    this.sage('spielplatz_besuch', () => this.gast === g && g.zustand === 'wartet', 1.0);
  }

  zeigeWunsch() {
    const g = this.gast;
    if (!g || g.zustand !== 'wartet' || g.zug?.isDragging() || this.zeit - g.blaseZeit < 5) return;
    const bild = WUNSCH_BILD[g.wuensche[0]] || wippeBild();
    if (!bild) return;
    g.blaseZeit = this.zeit;
    g.a.bubble(bild, 2.6, { seite: 'links' });
  }

  geraeteZiele() {
    const G = this.G;
    return [
      { id: 'schaukel', x: this.haken.x, y: G - 90, radius: 300 },
      { id: 'rutsche', x: this.leiterFuss.x + 140, y: G - 200, radius: 300 },
      { id: 'wippe', x: WIPPE_X + 60, y: G - 120, radius: 280 },
      { id: 'karussell', x: KARUSSELL_ORT.x, y: KARUSSELL_ORT.y - 160, radius: 240 },
      { id: 'federwippe', x: FW.x, y: FW.y - 130, radius: 240 },
    ];
  }

  /** Nächstes Gerät zum Punkt (x, y) innerhalb seines Radius → Ziel oder null */
  naechstesGeraet(x, y) {
    let bestes = null;
    let abstand = Infinity;
    for (const z of this.geraeteZiele()) {
      const d = Math.hypot(z.x - x, z.y - y);
      if (d <= z.radius && d < abstand) {
        abstand = d;
        bestes = z;
      }
    }
    return bestes;
  }

  /** Ein Gerät wurde angetippt: Wünscht es sich der wartende Gast, geht er hin */
  geraetGetippt(id) {
    const g = this.gast;
    if (g && g.zustand === 'wartet' && g.wuensche[0] === id && !g.zug?.isDragging()) this.geheZu(id);
  }

  async geheZu(id) {
    const g = this.gast;
    if (!g || g.zustand !== 'wartet') return;
    g.zug?.off();
    g.zug = null;
    g.zustand = 'geht';
    g.aufgabe = id;
    g.a.onTap(() => this.gastTipp(), { pad: 70 });   // unterwegs: nur ein Laut
    // Wunsch erfüllt sich – auch ein anderes Gerät ist recht (dann fällt der eigentliche Wunsch weg)
    const i = g.wuensche.indexOf(id);
    g.wuensche.splice(i >= 0 ? i : 0, 1);
    const a = g.a;
    if (a._blase && !a._blase.destroyed) a._blase.visible = false;   // die Blase räumt sich selbst weg
    a.nod();
    sfx('common/hupf', { vol: 0.35 });
    const ok = await this['steige_' + id](g);
    if (this.gast !== g) return;
    if (ok === false) {
      // kam nicht hin (z. B. abgelöst): zurück und weiter warten
      g.wuensche.unshift(id);
      await a.walkTo(WARTE.x, WARTE.y, { tempo: GAST_TEMPO });
      if (this.gast === g) this.gastWartet();
      return;
    }
    g.zustand = 'spielt';
  }

  gastTipp() {
    const g = this.gast;
    if (!g) return;
    if (g.zustand !== 'spielt') {
      // unterwegs, beim Umsteigen oder beim Abschied: nur ein Laut (höchstens alle 0,8 s)
      if (this.zeit - (g.lautZeit ?? -9) > 0.8) {
        g.lautZeit = this.zeit;
        g.a.sound();
      }
      fx.wobble(g.a, 0.04);
      return;
    }
    switch (g.aufgabe) {
      case 'schaukel': this.schubse(); break;
      case 'rutsche': this.gastRutscht(); break;
      case 'wippe': this.wippen(this.wz.unten === 'l' ? 'r' : 'l'); break;   // immer abwechselnd
      case 'karussell': this.dreheKarussell(); break;
      case 'federwippe': this.federTipp(); break;
      default: g.a.sound();
    }
  }

  async aufgabeFertig() {
    const g = this.gast;
    if (!g || g.zustand !== 'spielt') return;
    g.zustand = 'steigtAus';
    const id = g.aufgabe;
    freude(this, g.a, { herzen: 4, hoehe: 40 });
    await this.wait(1.3);
    if (this.gast !== g) return;
    await this['aus_' + id](g);
    if (this.gast !== g) return;
    g.aufgabe = null;
    if (g.wuensche.length) {
      await g.a.walkTo(WARTE.x, WARTE.y, { tempo: GAST_TEMPO });
      if (this.gast === g) this.gastWartet();
    } else {
      this.gastFertig();
    }
  }

  async gastFertig() {
    const g = this.gast;
    g.zustand = 'fertig';
    const a = g.a;
    a.zIndex = 320;
    await a.walkTo(WARTE.x, WARTE.y, { tempo: GAST_TEMPO });
    if (this.gast !== g) return;
    a.lookAt(0);
    a.onTap(() => this.umsteigerTipp(a), { pad: 70 });   // auch beim Abschied: wackeln und ein Laut
    freude(this, a, { herzen: 6 });
    const da = new Set(store.stickers?.() || []);
    const sticker = ['spielplatz_rutsche', 'spielplatz_karussell'].find((s) => !da.has(s)) || 'spielplatz_rutsche';
    belohne(this, sticker, a.x, a.y - 330);
    this.neuerWimpel();
    await this.wait(2.2);
    if (this.gast !== g) return;
    // winkt (Hüpfer) und geht nach Hause; bald kommt der nächste Gast
    await a.hop(40);
    this.gast = null;
    a.walkTo(AUSGANG.x, AUSGANG.y, { tempo: GAST_TEMPO }).then(() => { if (!a.destroyed) a.destroy({ children: true }); });
    this.after(4.5, () => this.neuerGast());
  }

  // --- Umsteigen: Katze bzw. Schwein machen dem Gast Platz (und bekommen ihn danach zurück) ---

  /**
   * Tier hüpft an seinen Platz. Solange es unterwegs ist, löst ein Antippen keinen eigenen Hüpfer aus (der würde
   * den Sprung ablösen), und am Ende steht es in jedem Fall genau dort – auch wenn der Sprung doch abgelöst wurde.
   */
  async huepfeUm(t, x, y, opt) {
    t.umsteigt = true;
    await t.hopTo(x, y, opt);
    t.umsteigt = false;
    if (t.destroyed) return;
    t.stop();
    t.position.set(x, y);
  }

  /** Antippen, während ein Tier Platz macht: nur wackeln und ein Laut */
  umsteigerTipp(t) {
    fx.wobble(t, 0.05);
    if (this.zeit - (t.lautZeit ?? -9) > 0.8) {
      t.lautZeit = this.zeit;
      t.sound();
    }
  }

  // --- Schaukel: die Katze macht Platz ---

  async steige_schaukel(g) {
    const a = g.a;
    const z = this.pendel;
    const h = this.haken;
    const G = this.G;
    z.bremse = true;
    if (!(await a.walkTo(h.x + 160, G + 120, { tempo: GAST_TEMPO }))) { z.bremse = false; return false; }
    await this.warteBis(() => Math.hypot(z.w, z.v / PENDEL_W) < 0.03, 4);
    z.w = 0;
    z.v = 0;
    // Katze steigt ab und setzt sich daneben
    const k = this.katze;
    this.umhaengen(k, this.welt);
    k.schatten.visible = true;
    k.pose('idle');
    k.zIndex = this.tierZ(G + 90);
    this.schaukelReiter = null;
    await this.huepfeUm(k, h.x - 165, G + 90, { hoehe: 60, dauer: 0.6 });
    k.lookAt(h.x);
    // Gast steigt auf
    const sitz = { x: h.x + this.sitzSchaukel.x, y: h.y + this.sitzSchaukel.y };
    a.zIndex = 13;
    await a.hopTo(sitz.x, sitz.y, { hoehe: 70, dauer: 0.55, staub: false });
    this.umhaengen(a, this.schaukel);
    a.position.set(this.sitzSchaukel.x, this.sitzSchaukel.y);
    a.schatten.visible = false;
    this.schaukelReiter = a;
    z.froh = false;
    z.bremse = false;
    g.schwung = 0;
    return true;
  }

  async aus_schaukel(g) {
    const a = g.a;
    const z = this.pendel;
    const h = this.haken;
    const G = this.G;
    z.bremse = true;
    await this.warteBis(() => Math.hypot(z.w, z.v / PENDEL_W) < 0.03, 5);
    z.w = 0;
    z.v = 0;
    this.schaukel.rotation = 0;
    this.umhaengen(a, this.welt);
    a.schatten.visible = true;
    a.pose('idle');
    this.schaukelReiter = null;
    a.zIndex = this.tierZ(G + 120);
    await a.hopTo(h.x + 160, G + 120, { hoehe: 60, dauer: 0.55 });
    // die Katze darf wieder
    const k = this.katze;
    k.zIndex = 13;
    await this.huepfeUm(k, h.x + this.sitzSchaukel.x, h.y + this.sitzSchaukel.y, { hoehe: 60, dauer: 0.55, staub: false });
    this.umhaengen(k, this.schaukel);
    k.position.set(this.sitzSchaukel.x, this.sitzSchaukel.y);
    k.schatten.visible = false;
    this.schaukelReiter = k;
    z.froh = false;
    z.bremse = false;
  }

  // --- Rutsche: hochklettern, oben antippen oder hinunterwischen ---

  async steige_rutsche(g) {
    const a = g.a;
    const G = this.G;
    if (!(await a.walkTo(this.leiterFuss.x + 90, G + 75, { tempo: GAST_TEMPO }))) return false;
    await this.warteBis(() => this.leiterFrei, 20);
    if (!this.leiterFrei) return false;
    this.leiterFrei = false;
    const ok = await this.klettere(a);
    if (!ok) { this.leiterFrei = true; return false; }
    g.oben = true;
    return true;
  }

  async gastRutscht() {
    const g = this.gast;
    if (!g || !g.oben || g.zustand !== 'spielt') return;
    g.oben = false;
    await this.rutschHinunter(g.a);
    if (this.gast === g) this.aufgabeFertig();
  }

  async aus_rutsche() {}

  // --- Wippe: das Schwein macht Platz ---

  async steige_wippe(g) {
    const a = g.a;
    const G = this.G;
    const z = this.wz;
    // die rechte Seite geht hinunter, damit man gut aufsteigen kann
    z.unten = 'r';
    z.ziel = WIPPE_MAX;
    z.aufgesetzt = false;
    if (!(await a.walkTo(WIPPE_X + 210, G + 95, { tempo: GAST_TEMPO }))) return false;
    z.halt = true;
    await this.warteBis(() => Math.abs(z.w - WIPPE_MAX) < 0.02 && Math.abs(z.v) < 0.05, 3);
    const s = this.schwein;
    this.wippeTiere.r = null;
    s.schatten.visible = true;
    s.zIndex = this.tierZ(G + 60);
    await this.huepfeUm(s, WIPPE_X + 300, G + 60, { hoehe: 60, dauer: 0.6 });
    s.lookAt(WIPPE_X);
    const sitz = this.sitzWelt('r');
    a.zIndex = 14;
    await a.hopTo(sitz.x, sitz.y, { hoehe: 70, dauer: 0.55, staub: false });
    a.schatten.visible = false;
    a.lookAt(WIPPE_X - 500);
    this.wippeTiere.r = a;
    z.halt = false;
    g.wippStart = z.zaehler;
    return true;
  }

  async aus_wippe(g) {
    const a = g.a;
    const G = this.G;
    const z = this.wz;
    z.unten = 'r';
    z.ziel = WIPPE_MAX;
    z.halt = true;
    await this.warteBis(() => Math.abs(z.w - WIPPE_MAX) < 0.02 && Math.abs(z.v) < 0.05, 3);
    this.wippeTiere.r = null;
    a.schatten.visible = true;
    a.pose('idle');
    a.zIndex = this.tierZ(G + 95);
    await a.hopTo(WIPPE_X + 210, G + 95, { hoehe: 60, dauer: 0.55 });
    const s = this.schwein;
    const sitz = this.sitzWelt('r');
    s.zIndex = 14;
    await this.huepfeUm(s, sitz.x, sitz.y, { hoehe: 60, dauer: 0.55, staub: false });
    s.schatten.visible = false;
    s.lookAt(WIPPE_X - 500);
    this.wippeTiere.r = s;
    z.halt = false;
  }

  // --- Karussell: der Gast schaut zu, das Kind dreht ---

  async steige_karussell(g) {
    const a = g.a;
    if (!(await a.walkTo(KARUSSELL_ORT.x - 285, KARUSSELL_ORT.y - 50, { tempo: GAST_TEMPO }))) return false;
    a.zIndex = 320;
    a.lookAt(KARUSSELL_ORT.x);
    g.drehStart = this.kz.summe;
    g.jubelt = false;
    return true;
  }

  async aus_karussell(g) {
    g.a.pose('idle');
  }

  // --- Federwippe: aufsitzen, anstupsen ---

  async steige_federwippe(g) {
    const a = g.a;
    if (!(await a.walkTo(FW.x + 190, 1470, { tempo: GAST_TEMPO }))) return false;
    a.zIndex = 330;
    const sattel = this.fwBox.toGlobal(this.fwSattel);
    const ziel = this.welt.toLocal(sattel);
    await a.hopTo(ziel.x, ziel.y, { hoehe: 80, dauer: 0.6, staub: false });
    this.umhaengen(a, this.fwBox);
    a.position.set(this.fwSattel.x, this.fwSattel.y);
    a.zIndex = 1;
    a.schatten.visible = false;
    a.lookAt(1000);
    g.feder = 0;
    return true;
  }

  async aus_federwippe(g) {
    const a = g.a;
    await this.warteBis(() => Math.abs(this.fw.w) < 0.03, 2);
    this.umhaengen(a, this.welt);
    a.rotation = 0;
    a.zIndex = 330;
    a.schatten.visible = true;
    a.pose('idle');
    await a.hopTo(FW.x + 190, 1470, { hoehe: 60, dauer: 0.55 });
  }

  // ---------------------------------------------------------------- Ablauf

  sage(id, bedingung, nach = 1.2) {
    const passt = () => this.aktiv && bedingung();
    this._hinweise.push(this.after(nach, () => { if (passt()) voice(id, { nurWenn: passt }); }));
  }

  betreten() {
    // Hinweis bei jedem Betreten anmelden (der Kern sagt ihn höchstens einmal am Tag) – nur, solange die Seite zu
    // sehen ist und das Kind es noch nicht tut (nurWenn: auch, wenn er erst später an die Reihe kommt)
    this.hinweiseAus();
    const g = this.gast;
    if (g && g.zustand === 'wartet') {
      this.sage('spielplatz_besuch', () => this.gast === g && g.zustand === 'wartet', this.besuche === 1 ? 0.6 : 1.2);
      g.blaseZeit = -99;
      this.after(0.4, () => this.zeigeWunsch());
    } else if (!this.benutzt) {
      this.sage('spielplatz_geraete', () => !this.benutzt && !(this.gast && this.gast.zustand === 'wartet'),
        this.besuche === 1 ? 0.6 : 1.2);
    }
  }

  verlassen() {
    this.hinweiseAus();
  }

  hinweiseAus() {
    for (const h of this._hinweise || []) h?.kill();
    this._hinweise = [];
  }

  update(dt, t) {
    this.zeit += dt;
    this.wolken.update(dt);
    this.falter.update(dt);
    this.vogel.update(dt);
    this.schaukelUpdate(dt);
    this.wippeUpdate(dt);
    this.federUpdate(dt);
    this.karussellUpdate(dt);
    this.girlandeUpdate(dt, t);
  }

  hinweise() {
    const g = this.gast;
    if (g && g.zustand === 'wartet') {
      const ziel = this.geraeteZiele().find((z) => z.id === g.wuensche[0]);
      if (ziel) {
        this.wunschMerker.position.set(ziel.x, ziel.y);
        return [{ von: g.a, nach: this.wunschMerker }];
      }
    }
    if (g && g.zustand === 'spielt') {
      switch (g.aufgabe) {
        case 'schaukel': return [this.brett];
        case 'wippe': {
          const oben = this.wippeTiere[this.wz.unten === 'l' ? 'r' : 'l'];
          if (oben && !oben.umsteigt) return [oben];
          break;
        }
        case 'karussell': return [{ von: this.drehVon, nach: this.drehNach }];
        case 'federwippe': return [this.fwBox];
        default:
      }
    }
    // Der Gast ist unterwegs (kommt, geht hin, klettert, steigt um, rutscht, verabschiedet sich): die Hand bleibt
    // bei ihm – nicht bei den freien Geräten, die vom Ablauf weglocken (und z. B. ein anderes Tier auf die Leiter
    // schicken würden)
    if (g) return [g.a];
    const liste = [];
    const vorn = this.schlange[0];
    if (vorn && vorn.bereit && this.leiterFrei) liste.push(vorn);
    liste.push(this.brett, this.wippeTiere.l, this.karussell);
    return liste;
  }
}

// Bild der Wippe für die Denkblase (Fuß + schräger Balken), einmal je Modul gezeichnet
let wippeTex = null;
function wippeBild() {
  if (wippeTex && !wippeTex.destroyed) return wippeTex;
  try {
    const c = new PIXI.Container();
    const fuss = spr('spielplatz/wippe_fuss', { parent: c, scale: 0.8 });
    fuss.position.set(560, 470);
    const balken = spr('spielplatz/wippe_balken', { anchor: [0.5, 185 / 189], parent: c, scale: 0.8 });
    const lager = hgPunkt(fuss, 'lager') || { x: 560, y: 380 };
    balken.position.set(lager.x, lager.y);
    balken.rotation = -0.22;
    wippeTex = PIXI.RenderTexture.create({ width: 1120, height: 500, resolution: 0.5 });
    stage.app.renderer.render({ container: c, target: wippeTex, clear: true, clearColor: [0, 0, 0, 0] });
    c.destroy({ children: true });
    return wippeTex;
  } catch (err) {
    console.warn('[spielplatz] Wippen-Bild nicht möglich:', err);
    return 'spielplatz/wippe_balken';
  }
}
