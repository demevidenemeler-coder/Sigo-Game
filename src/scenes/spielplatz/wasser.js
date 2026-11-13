// Seite 4 – Wasser und Matsch: zwei Stationen nebeneinander, beide laufen unabhängig (das Kind wechselt frei).
//
// Rechts: „Schiffchen-Fahrt" – ein Gast wünscht sich ein Schiffchen (Farbe in der Denkblase).
//   1. Rinne legen    (ziehen oder tippen) – drei Holzrinnen auf ihre Stützen (Umriss zeigt den Platz)
//   2. Pumpen         (viermal tippen)     – der Schwengel geht auf und ab, dann läuft das Wasser
//   3. Wasser fließt  (von selbst)         – durch die Rinne, über das Wasserrad (es dreht sich) ins Becken
//   4. Schiffchen     (ziehen oder tippen) – ein Schiffchen an den Anfang der Rinne; es fährt hinunter. Jedes darf
//                     fahren; die Wunschfarbe (Denkblase) freut den Gast nur ein bisschen mehr
//   5. Ankunft        – Platsch ins Becken, eine kleine Überraschung (Frosch, Ente, Fisch, Blasen, Regenbogen)
//   6. Der Gast freut sich, Sticker; das Schiffchen bleibt im Becken (die Flotte wächst über alle Besuche, store
//      'spielplatz.boote'). Die Rinne wird abgebaut, der Gast geht, der nächste kommt.
//
// Links: „Matschküche" – ein Gast wünscht sich einen Matschkuchen (Form in der Denkblase).
//   1. Wasser in die Schüssel (Eimer ziehen oder tippen)
//   2. Rühren         (dreimal tippen)
//   3. Füllen         (Schüssel oder Förmchen antippen)
//   4. Stürzen        (Förmchen antippen)
//   5. Verzieren      (drei Dinge ziehen oder tippen; jede Runde andere)
//   6. Servieren      (Kuchen zum Gast ziehen oder tippen) – der Gast tut, als ob er isst, freut sich, Sticker,
//      und eine kleine Überraschung (ein Freund kommt mit, ein Tänzchen oder ein Herzensgruß).
//
// Nichts kann schiefgehen: Was man irgendwo loslässt, findet seinen Platz von selbst; es gibt kein „falsch".

import {
  spr, tex, hasTex, Actor, tap, drag, sfx, sfxSchleife, note, voice, fx, killTweensOf, rand, pick, shuffle, clamp,
  store, PIXI,
} from '../../engine/index.js';
import { Seite } from '../../gemeinsam/seiten.js';
import { belohne } from '../../gemeinsam/sticker.js';
import { freude, stickerFuer, merker, Schmetterling, andere, bogenFlug } from './helfer.js';

const PENTA = [72, 74, 76, 79, 81, 84];

// ---------------------------------------------------------------- Schiffchen-Fahrt: Maße
const PUMPE = { x: -130, y: 1060, skala: 0.72 };
const HEBEL_RUHE = 0.42;          // Schwengel oben (Kugel zeigt nach links oben)
const HEBEL_UNTEN = -0.22;
const PUMP_ZIEL = 4;
const RINNE_SKALA = 0.5;          // Bild 600×124 → 300×62
const RINNE_L = 300;
const RINNE_DREH = 0.1;
// Plätze der drei Rinnen (Mitte, Drehung) – eine schräge Bahn vom Auslauf der Pumpe bis zum Wasserrad
const PLAETZE = [
  { x: 198, y: 900 }, { x: 496, y: 930 }, { x: 794, y: 960 },
];
// hier liegen die Rinnen (und später die Schiffchen) auf dem Boden
const LAGER = [
  { x: -150, y: 1300, r: -0.05 }, { x: 25, y: 1380, r: 0.04 }, { x: 200, y: 1300, r: -0.03 },
];
const RAD = { x: 942, y: 1062, skala: 0.45 };
const BECKEN = { x: 780, y: 1450, skala: 0.6 };
const BOOT_SKALA = 0.42;
const BOOT_START = { x: 70, y: 878 };   // Anfang der Rinne
const BOOT_FARBEN = [0xf26b6b, 0x5fa8f0, 0xffcf3f, 0x6fcf6a, 0xb88ae8];   // gut zu unterscheiden
const FLOTTE_MAX = 5;
// Plätze der Schiffchen im Becken (relativ zur Mitte der Wasserfläche)
const FLOTTE_ORTE = [[-135, -6], [40, 8], [-45, -28], [135, -22], [-55, 14]];
const BOOT_GAESTE = ['ente', 'frosch', 'pinguin', 'baer', 'schwein', 'fuchs', 'hund'];
const BOOT_WARTE = { x: 485, y: 1455 };
const BOOT_EINGANG = { x: 1480, y: 1470 };
const UEBERRASCHUNGEN = ['frosch', 'ente', 'fisch', 'blasen', 'regenbogen'];
const WASSER = 0x7cc8f0;

// ---------------------------------------------------------------- Matschküche: Maße
const KUECHE = { x: -750, y: 1080, skala: 0.68 };
const SCHUESSEL = { x: -845, y: 905, skala: 0.56 };
const TELLER = { x: -640, y: 902 };
const EIMER = { x: -410, y: 1235, skala: 0.42 };
const DEKO_ORTE = [{ x: -900, y: 1195 }, { x: -770, y: 1235 }, { x: -640, y: 1195 }];
const DEKO = [
  'spielplatz/ueberraschung_blume', 'spielplatz/ueberraschung_herz', 'spielplatz/ueberraschung_stern',
  'common/p_blatt', 'common/futter_erdbeere', 'common/futter_nuss', 'spielplatz/schatz_muschel',
];
const DEKO_GROESSE = 110;      // am Boden (längere Seite)
const DEKO_AUF = 62;           // auf dem Kuchen
const KUCHEN_SKALA = 0.42;
// Plätze der Verzierungen auf dem Kuchen (relativ zum Fuß des Kuchens)
const DEKO_PLAETZE = [{ x: -42, y: -92 }, { x: 4, y: -112 }, { x: 46, y: -90 }];
const SAND_FARBE = 0xe3c48a;
const MATSCH = [0xa77548, 0x8a5c36, 0x7a4e2c];   // nass – gerührt – fertig
const KUECHEN_GAESTE = ['igel', 'maus', 'eichhoernchen', 'schaf', 'katze', 'affe', 'huhn', 'hase'];
const KUECHEN_WARTE = { x: -1080, y: 1455 };
const KUECHEN_EINGANG = { x: -1480, y: 1470 };
const FORMEN = ['stern', 'fisch'];
const KUECHEN_ENDEN = ['freund', 'tanz', 'herz'];

const GAST_SKALA = 0.23;

/** Farbe zwischen a und b (0…1) */
function mische(a, b, p) {
  const r = ((a >> 16) & 255) + (((b >> 16) & 255) - ((a >> 16) & 255)) * p;
  const g = ((a >> 8) & 255) + (((b >> 8) & 255) - ((a >> 8) & 255)) * p;
  const bl = (a & 255) + ((b & 255) - (a & 255)) * p;
  return (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(bl);
}

/** Skala, damit ein Bild an der längeren Seite `groesse` Einheiten hat */
function skalaFuer(id, groesse) {
  const t = tex(id);
  return groesse / Math.max(t.width, t.height, 1);
}

export class Wasser extends Seite {
  static hg = 'spielplatz/hg_wasser';

  aufbau() {
    this.zeit = 0;
    this._hinweise = [];
    this.fokus = 'wasser';       // welche Station das Kind zuletzt bespielt hat (Zeige-Hand zeigt zuerst dorthin)
    this.tonZeiten = new Map();
    this.w = { phase: 'leer', gast: null, pumpen: 0, gelegt: 0, boot: null, fliesst: false };
    this.k = { phase: 'leer', gast: null };

    this.baueStuetzen();
    this.bauePumpe();
    this.baueRinnen();
    this.baueStrom();
    this.baueRad();
    this.baueBecken();
    this.baueBoote();
    this.baueFlotte();

    this.baueKueche();
    this.baueSchuessel();
    this.baueEimer();
    this.baueTeller();

    this.falter = new Schmetterling(this, {
      x: 300, y: 600, farbe: 1, z: 400, scale: 0.8,
      bereich: { x0: -300, x1: 800, y0: 560, y1: 660 },
    });

    // Merkpunkte für die Zeige-Hand
    this.mRinne = merker(this.welt);
    this.mStart = merker(this.welt);
    this.mStart.position.set(BOOT_START.x + 30, BOOT_START.y - 20);
    this.mSchuessel = merker(this.welt);
    this.mSchuessel.position.set(SCHUESSEL.x, SCHUESSEL.y - 110);
    this.mKuchen = merker(this.welt);
    this.mKuchen.position.set(TELLER.x, TELLER.y - 70);
    this.mGast = merker(this.welt);

    this.stromTon = sfxSchleife('common/wasserstrahl', { vol: 0.28, rate: 1.1 });

    this.letzterBootGast = null;
    this.letzteFarbe = -1;
    this.letzteUeberraschung = null;
    this.letzterKuechenGast = null;
    this.letzteForm = null;
    this.letztesEnde = null;
    this.starteWasserRunde(true);
    this.starteKuechenRunde(true);
  }

  // ---------------------------------------------------------------- kleine Hilfen

  /** Ton höchstens alle `abstand` Sekunden (je Schlüssel) */
  ton(id, opt, abstand = 0.35) {
    const alt = this.tonZeiten.get(id) ?? -9;
    if (this.zeit - alt < abstand) return;
    this.tonZeiten.set(id, this.zeit);
    sfx(id, opt);
  }

  sage(id, bedingung, nach = 1.2) {
    const passt = () => this.aktiv && bedingung();
    this._hinweise.push(this.after(nach, () => { if (passt()) voice(id, { nurWenn: passt }); }));
  }

  hinweiseAus() {
    for (const h of this._hinweise) h?.kill();
    this._hinweise = [];
  }

  /** Neuer Gast einer Station: läuft vom Rand herein. → Actor */
  holeGast(liste, zuletzt, anderer, von, nach, z) {
    const frei = liste.filter((x) => x !== anderer);
    const id = andere(frei, zuletzt);
    const a = new Actor(id, { x: von.x, y: von.y, scale: GAST_SKALA, parent: this.welt, z });
    a.gastId = id;
    return a;
  }

  /** Gast geht hinaus und verschwindet */
  schickeWeg(a, ziel) {
    if (!a || a.destroyed) return;
    a._tap?.off();
    a.eventMode = 'none';
    a.walkTo(ziel.x, ziel.y, { tempo: 260 }).then(() => {
      if (!a.destroyed) this.tween(a, { alpha: 0 }, 0.4).then(() => { if (!a.destroyed) a.destroy({ children: true }); });
    });
  }

  // ================================================================ Schiffchen-Fahrt

  baueStuetzen() {
    // Holzstützen unter den Rinnen-Plätzen (zeigen, wohin die Rinne gehört) und ein Gestell für das Wasserrad
    const g = new PIXI.Graphics();
    for (const p of PLAETZE) {
      const fuss = p.y + 125;
      g.ellipse(p.x, fuss, 34, 9).fill({ color: 0x6b4a33, alpha: 0.22 });
      g.roundRect(p.x - 13, p.y + 14, 26, fuss - p.y - 14, 8).fill(0xc58a4a);
      g.roundRect(p.x - 13, p.y + 14, 9, fuss - p.y - 14, 4).fill({ color: 0xffffff, alpha: 0.18 });
    }
    g.zIndex = 20;
    g.eventMode = 'none';
    this.welt.addChild(g);
    // Umrisse: wohin die Rinnen gehören
    this.umrisse = PLAETZE.map((p) => {
      const u = spr('spielplatz/rinne', { x: p.x, y: p.y, scale: RINNE_SKALA, rotation: RINNE_DREH, z: 21, parent: this.welt });
      u.tint = 0x5a3c22;
      u.alpha = 0.26;
      u.eventMode = 'none';
      return u;
    });
  }

  bauePumpe() {
    const p = spr('spielplatz/pumpe', { x: PUMPE.x, y: PUMPE.y, scale: PUMPE.skala, z: 40, parent: this.welt });
    this.pumpe = p;
    // Punkte aus pack.json (Bildpunkte) → Seite
    const punkt = (px, py) => {
      const w = 416;
      const h = 600;
      return {
        x: PUMPE.x + (px - p.anchor.x * w) * PUMPE.skala,
        y: PUMPE.y + (py - p.anchor.y * h) * PUMPE.skala,
      };
    };
    this.lager = punkt(60, 162);
    this.auslauf = punkt(382, 300);
    const h = spr('spielplatz/pumpe_hebel', { x: this.lager.x, y: this.lager.y, z: 39, parent: this.welt });
    h.scale.set(-PUMPE.skala, PUMPE.skala);
    h.rotation = HEBEL_RUHE;
    this.hebel = h;
    // Merkpunkt an der Kugel des Schwengels (für die Zeige-Hand)
    this.mHebel = merker(this.welt);
    this.mHebel.position.set(this.lager.x - 230 * Math.cos(HEBEL_RUHE), this.lager.y - 230 * Math.sin(HEBEL_RUHE));
    // Tippflächen: Schwengel (oben links) und Pumpe
    const griff = new PIXI.Container({ label: 'pumpGriff' });
    griff.zIndex = 41;
    griff.hitArea = new PIXI.Rectangle(this.lager.x - 330, this.lager.y - 210, 400, 300);
    this.welt.addChild(griff);
    tap(griff, () => this.pumpTipp(), { sound: null, squash: false, hitArea: griff.hitArea });
    tap(p, () => this.pumpTipp(), { sound: null, squash: true, pad: 30 });
  }

  pumpTipp() {
    this.fokus = 'wasser';
    if (this.pumpt) return;
    this.pumpt = true;
    const w = this.w;
    const zaehlt = w.phase === 'pumpen';
    killTweensOf(this.hebel, ['rotation']);
    this.ton('common/klack', { vol: 0.22, rate: 1.4 }, 0.2);
    this.tween(this.hebel, { rotation: HEBEL_UNTEN }, 0.22, { ease: 'quadOut' }).then((ok) => {
      if (!ok) { this.pumpt = false; return; }
      // ein Schwall aus dem Auslauf
      this.ton('common/spritz', { vol: 0.4 }, 0.25);
      this.schwall();
      fx.pop(this.pumpe, 0.03);
      this.tween(this.hebel, { rotation: HEBEL_RUHE }, 0.3, { ease: 'sineInOut' }).then(() => { this.pumpt = false; });
      if (zaehlt && w.phase === 'pumpen') {
        w.pumpen++;
        note('xylo', PENTA[Math.min(w.pumpen, PENTA.length - 1)], { vol: 0.3 });
        if (w.pumpen >= PUMP_ZIEL) this.lasseFliessen();
      }
    });
  }

  /** Kurzer Wasserschwall aus dem Auslauf (fällt in die Rinne oder plätschert auf den Boden) */
  schwall() {
    const s = this.schwallG;
    killTweensOf(s);
    s.visible = true;
    s.alpha = 0.9;
    s.scale.y = 0.2;
    this.tween(s, { scaleY: 1 }, 0.15, { ease: 'quadOut' });
    this.tween(s, { alpha: 0 }, 0.5, { delay: 0.2, ease: 'sineInOut' }).then((ok) => { if (ok) s.visible = false; });
    const unten = this.w.gelegt >= 1 ? PLAETZE[0].y - 12 : 1060;
    this.burst('tropfen', this.auslauf.x + 6, unten, { count: 3 });
  }

  baueRinnen() {
    this.rinnen = LAGER.map((l, i) => {
      const r = spr('spielplatz/rinne', { x: l.x, y: l.y, scale: RINNE_SKALA, rotation: l.r, z: 60 + i, parent: this.welt });
      r.platz = -1;
      r.hitArea = new PIXI.Rectangle(-300, -220, 600, 440);
      r.ziehen = null;
      r.tippen = null;
      return r;
    });
  }

  /** Rinnen greifbar machen (Schritt 1) */
  rinnenGreifbar() {
    for (const r of this.rinnen) {
      r.tippen?.off();
      r.tippen = null;
      r.ziehen?.off();
      r.ziehen = drag(r, {
        back: false,
        lift: 1.06,
        hitArea: r.hitArea,
        targets: () => PLAETZE.map((p, i) => ({ x: p.x, y: p.y, radius: 230, platz: i,
          disabled: this.rinnen.some((x) => x.platz === i || x.reserviert === i) })),
        onStart: () => {
          this.fokus = 'wasser';
          this.ton('common/klack', { vol: 0.3, rate: 1.2 });
        },
        onDrop: (ziel) => {
          if (this.w.phase !== 'rinne' || r.platz >= 0) return;
          const frei = (i) => !this.rinnen.some((x) => x !== r && (x.platz === i || x.reserviert === i));
          let i = ziel ? ziel.platz : -1;
          if (i < 0 || !frei(i)) i = PLAETZE.findIndex((_, j) => frei(j));
          if (i >= 0) this.legeRinne(r, i);
        },
      });
    }
  }

  async legeRinne(r, i) {
    r.reserviert = i;
    r.ziehen?.off();
    r.ziehen = null;
    r.zIndex = 70;
    const p = PLAETZE[i];
    await bogenFlug(this, r, p.x, p.y, { hoehe: 110, min: 0.5, drehung: RINNE_DREH });
    r.reserviert = undefined;
    if (r.destroyed) return;
    r.platz = i;
    r.zIndex = 30;
    this.ton('common/klack', { vol: 0.55 }, 0.15);
    this.burst('funkeln', p.x, p.y - 30, { count: 2 });
    this.tween(this.umrisse[i], { alpha: 0 }, 0.5, { ease: 'sineInOut' });
    note('glocke', PENTA[i + 1], { vol: 0.28 });
    r.tippen = tap(r, () => {
      this.fokus = 'wasser';
      fx.wobble(r, 0.04);
      this.ton('common/klack', { vol: 0.3 });
    }, { sound: null, squash: false, hitArea: r.hitArea });
    this.w.gelegt = this.rinnen.filter((x) => x.platz >= 0).length;
    if (this.w.gelegt >= PLAETZE.length && this.w.phase === 'rinne') {
      this.w.phase = 'pumpen';
      this.w.pumpen = 0;
      this.sage('spielplatz_pumpen', () => this.w.phase === 'pumpen' && this.w.pumpen === 0, 0.8);
    }
  }

  baueStrom() {
    // Schwall aus dem Auslauf (kurz beim Pumpen), Wasserlauf in den Rinnen, Wasserfall über das Rad ins Becken
    const sch = new PIXI.Graphics().roundRect(-11, 0, 22, 60, 10).fill({ color: WASSER, alpha: 0.9 });
    sch.position.set(this.auslauf.x + 4, this.auslauf.y + 4);
    sch.zIndex = 38;
    sch.visible = false;
    sch.eventMode = 'none';
    this.welt.addChild(sch);
    this.schwallG = sch;

    const strahl = new PIXI.Graphics().roundRect(-10, 0, 20, PLAETZE[0].y - 8 - this.auslauf.y - 4, 9)
      .fill({ color: WASSER, alpha: 0.85 });
    strahl.position.set(this.auslauf.x + 4, this.auslauf.y + 4);
    strahl.zIndex = 38;
    this.strahl = strahl;

    this.laeufe = PLAETZE.map((p) => {
      const g = new PIXI.Graphics()
        .roundRect(0, -8, RINNE_L - 26, 15, 7).fill({ color: WASSER, alpha: 0.9 })
        .roundRect(10, -6, RINNE_L - 60, 4, 2).fill({ color: 0xffffff, alpha: 0.45 });
      const cx = Math.cos(RINNE_DREH);
      const sy = Math.sin(RINNE_DREH);
      g.position.set(p.x - (RINNE_L / 2 - 13) * cx, p.y - (RINNE_L / 2 - 13) * sy - 4);
      g.rotation = RINNE_DREH;
      g.zIndex = 31;
      return g;
    });
    // Ende der letzten Rinne → Rad → Becken
    const ende = this.rinnenEnde();
    const fall = new PIXI.Graphics().roundRect(-12, 0, 24, 1285 - ende.y, 11).fill({ color: WASSER, alpha: 0.8 });
    fall.position.set(ende.x + 4, ende.y);
    fall.zIndex = 48;
    this.fall = fall;
    for (const g of [strahl, ...this.laeufe, fall]) {
      g.eventMode = 'none';
      g.visible = false;
      this.welt.addChild(g);
    }
  }

  rinnenEnde() {
    const p = PLAETZE[PLAETZE.length - 1];
    return { x: p.x + (RINNE_L / 2 - 8) * Math.cos(RINNE_DREH), y: p.y + (RINNE_L / 2 - 8) * Math.sin(RINNE_DREH) };
  }

  async lasseFliessen() {
    const w = this.w;
    w.phase = 'fliesst';
    w.fliesst = true;
    if (this.aktiv) this.stromTon.an(0.6);
    const zeige = async (g, prop, dauer) => {
      g.visible = true;
      g.alpha = 1;
      g.scale.set(1);
      g.scale[prop] = 0.02;
      return this.tween(g.scale, { [prop]: 1 }, dauer, { ease: 'linear' });
    };
    await zeige(this.strahl, 'y', 0.25);
    for (const g of this.laeufe) {
      if (!(await zeige(g, 'x', 0.55))) return;
    }
    await zeige(this.fall, 'y', 0.45);
    this.ton('common/platsch', { vol: 0.35 }, 0.3);
    this.burst('tropfen', this.wasserMitte.x + 150, this.wasserMitte.y, { count: 4 });
    this.radZiel = 1.7;
    await this.wait(0.6);
    if (w.phase !== 'fliesst') return;
    this.zeigeBoote();
  }

  stoppeWasser() {
    this.w.fliesst = false;
    this.stromTon.aus(0.8);
    this.radZiel = 0;
    for (const g of [this.strahl, ...this.laeufe, this.fall]) {
      if (!g.visible) continue;
      this.tween(g, { alpha: 0 }, 0.8, { ease: 'sineInOut' }).then((ok) => { if (ok) g.visible = false; });
    }
  }

  baueRad() {
    // Gestell (hinter dem Becken) und das Rad
    const g = new PIXI.Graphics()
      .moveTo(RAD.x, RAD.y).lineTo(RAD.x - 60, 1300).stroke({ width: 20, color: 0xb57b40, cap: 'round' })
      .moveTo(RAD.x, RAD.y).lineTo(RAD.x + 60, 1300).stroke({ width: 20, color: 0xc58a4a, cap: 'round' });
    g.zIndex = 44;
    g.eventMode = 'none';
    this.welt.addChild(g);
    this.rad = spr('spielplatz/wasserrad', { x: RAD.x, y: RAD.y, scale: RAD.skala, z: 49, parent: this.welt });
    this.radTempo = 0;
    this.radZiel = 0;
    this.radSchub = 0;
    tap(this.rad, () => {
      this.fokus = 'wasser';
      this.radSchub = Math.min(2.2, this.radSchub + 1.2);
      this.ton('common/klack', { vol: 0.3, rate: 0.8 });
    }, { sound: null, squash: false, pad: 50 });
  }

  baueBecken() {
    const b = spr('spielplatz/becken', { x: BECKEN.x, y: BECKEN.y, scale: BECKEN.skala, z: 45, parent: this.welt });
    this.becken = b;
    // Mitte der Wasserfläche (Punkt wasser 400,170 im Bild 800×432)
    this.wasserMitte = {
      x: BECKEN.x + (400 - b.anchor.x * 800) * BECKEN.skala,
      y: BECKEN.y + (170 - b.anchor.y * 432) * BECKEN.skala,
    };
    tap(b, (e) => {
      this.fokus = 'wasser';
      this.ton('common/platsch', { vol: 0.25, rate: 1.2 }, 0.5);
      // e.x/e.y liegen schon in Seiten-Koordinaten (Eltern des Beckens = this.welt)
      this.burst('tropfen', e.x, Math.min(e.y, this.wasserMitte.y + 20), { count: 2 });
    }, { sound: null, squash: false, pad: 10 });
  }

  // ---------------------------------------------------------------- Schiffchen

  baueBoote() {
    this.boote = LAGER.map((l) => {
      const s = spr('spielplatz/schiffchen', { x: l.x, y: l.y, scale: BOOT_SKALA, z: 62, parent: this.welt });
      s.visible = false;
      s.hitArea = new PIXI.Rectangle(-260, -420, 520, 540);
      s.heim = { x: l.x, y: l.y };
      return s;
    });
  }

  zeigeBoote() {
    const w = this.w;
    w.phase = 'boot';
    const farben = shuffle([w.farbe, ...shuffle(BOOT_FARBEN.filter((f) => f !== w.farbe)).slice(0, 2)]);
    this.boote.forEach((s, i) => {
      killTweensOf(s);
      s.tint = farben[i];
      s.farbe = farben[i];
      s.position.set(s.heim.x, s.heim.y);
      s.rotation = 0;
      s.scale.set(BOOT_SKALA);
      s.alpha = 0;
      s.visible = true;
      s.eventMode = 'static';
      s.zIndex = 62;
      s.griff?.off();
      s.griff = drag(s, {
        back: true,
        lift: 1.08,
        hitArea: s.hitArea,
        heim: s.heim,
        targets: () => [{ x: BOOT_START.x, y: BOOT_START.y, radius: 300, start: true }],
        onStart: () => { this.fokus = 'wasser'; },
        onDrop: (ziel, ctx) => this.bootLos(s, ctx),
      });
      // weich erscheinen (nur Deckkraft: die Tippfläche ist sofort voll groß)
      s.y = s.heim.y - 40;
      this.tween(s, { alpha: 1 }, 0.4, { delay: i * 0.15, ease: 'sineInOut' });
      this.tween(s, { y: s.heim.y }, 0.5, { delay: i * 0.15, ease: 'bounceOut' });
    });
    sfx('common/plopp', { vol: 0.35 });
    this.zeigeBootWunsch(true);
    this.sage('spielplatz_schiffchen', () => this.w.phase === 'boot', 1.2);
  }

  zeigeBootWunsch(sofort = false) {
    const g = this.w.gast;
    if (!g || g.destroyed || !g.wartet) return;
    if (!sofort && this.zeit - (this.w.blaseZeit ?? -99) < 8) return;
    this.w.blaseZeit = this.zeit;
    g.bubble('spielplatz/schiffchen', 2.6);
    const bild = g._blase?.children?.[1];
    if (bild) bild.tint = this.w.farbe;
  }

  bootLos(s, ctx) {
    const w = this.w;
    if (w.phase !== 'boot') { ctx.back(); return; }
    // Jedes Schiffchen darf fahren – kein „falsch". Das gewünschte freut den Gast nur noch ein bisschen mehr.
    w.wunsch = s.farbe === w.farbe;
    ctx.snapTo(null);
    this.fahre(s);
  }

  async fahre(s) {
    const w = this.w;
    w.phase = 'faehrt';
    w.boot = s;
    s.griff?.off();
    s.griff = null;
    s.eventMode = 'none';
    // die anderen Schiffchen gehen leise weg
    for (const o of this.boote) {
      if (o === s || !o.visible) continue;
      o.eventMode = 'none';
      o.griff?.off();
      this.tween(o, { alpha: 0 }, 0.5, { ease: 'sineInOut' }).then((ok) => { if (ok) o.visible = false; });
    }
    s.zIndex = 34;
    sfx('common/hupf', { vol: 0.3 });
    await bogenFlug(this, s, BOOT_START.x, BOOT_START.y, { hoehe: 120, min: 0.55, drehung: RINNE_DREH });
    this.ton('common/platsch', { vol: 0.3, rate: 1.3 }, 0.2);
    this.burst('tropfen', s.x, s.y, { count: 3 });
    // die Rinne hinunter (ruhig, gut 300 Einheiten/s)
    const ende = this.rinnenEnde();
    const x0 = s.x;
    const y0 = s.y;
    const d = Math.hypot(ende.x - x0, ende.y - 14 - y0);
    const proxy = { p: 0 };
    const ok = await this.tween(proxy, { p: 1 }, d / 320, {
      ease: 'sineInOut',
      onUpdate: () => {
        if (s.destroyed) return;
        s.x = x0 + (ende.x - x0) * proxy.p;
        s.y = y0 + (ende.y - 14 - y0) * proxy.p + Math.sin(proxy.p * 18) * 3;
        s.rotation = RINNE_DREH + Math.sin(proxy.p * 14) * 0.05;
      },
    });
    if (!ok || s.destroyed) return;
    // hinunter ins Becken, an einen freien Platz der Flotte
    const o = FLOTTE_ORTE[this.flottePlatz()];
    s.zIndex = 50;
    await bogenFlug(this, s, this.wasserMitte.x + o[0], this.wasserMitte.y + o[1] + 8, { hoehe: 70, min: 0.6, drehung: 0 });
    if (s.destroyed) return;
    sfx('common/platsch', { vol: 0.45 });
    this.burst('tropfen', s.x, s.y - 10, { count: 5 });
    this.inFlotte(s.farbe, o, true);
    s.visible = false;
    s.position.set(s.heim.x, s.heim.y);
    this.ankunft();
  }

  async ankunft() {
    const w = this.w;
    w.phase = 'fertig';
    this.ueberrasche();
    await this.wait(0.5);
    const g = w.gast;
    if (g && !g.destroyed) {
      g.lookAt(this.wasserMitte.x);
      // Wunschfarbe: ein paar Herzen mehr und ein kleiner Glockenton – sonst freut er sich genauso
      freude(this, g, { herzen: w.wunsch ? 6 : 4 });
      if (w.wunsch) note('glocke', 84, { vol: 0.25 });
      belohne(this, stickerFuer('wasserrad'), BOOT_WARTE.x + 40, BOOT_WARTE.y - 420);
    }
    await this.wait(2.6);
    this.stoppeWasser();
    await this.wait(0.8);
    this.baueRinneAb();
    if (g && !g.destroyed) {
      g.wartet = false;
      this.schickeWeg(g, BOOT_EINGANG);
    }
    w.gast = null;
    // sobald die Rinnen wieder im Lager liegen, sind sie greifbar (nichts liegt tot herum), der Gast kommt gleich
    await this.wait(1.3);
    this.rinnenRunde();
    await this.wait(0.9);
    this.starteWasserRunde();
  }

  /** Schritt 1 beginnt: Rinnen greifbar */
  rinnenRunde() {
    const w = this.w;
    w.phase = 'rinne';
    w.pumpen = 0;
    w.gelegt = 0;
    w.boot = null;
    w.wunsch = false;
    this.rinnenGreifbar();
  }

  baueRinneAb() {
    const orte = shuffle(LAGER.slice());
    this.rinnen.forEach((r, i) => {
      r.tippen?.off();
      r.tippen = null;
      r.platz = -1;
      r.zIndex = 60 + i;
      const l = orte[i];
      this.after(i * 0.25, () => {
        bogenFlug(this, r, l.x, l.y, { hoehe: 90, min: 0.6, drehung: l.r });
        this.tween(this.umrisse[i], { alpha: 0.26 }, 0.6, { ease: 'sineInOut' });
      });
    });
    this.ton('common/klack', { vol: 0.3, rate: 0.9 });
    this.w.gelegt = 0;
  }

  starteWasserRunde(erst = false) {
    const w = this.w;
    // beim ersten Mal hier; sonst hat ankunft() die Rinnen schon greifbar gemacht (das Kind legt vielleicht schon)
    if (erst) this.rinnenRunde();
    let f = Math.floor(rand(0, BOOT_FARBEN.length));
    if (f === this.letzteFarbe) f = (f + 1 + Math.floor(rand(0, BOOT_FARBEN.length - 1))) % BOOT_FARBEN.length;
    this.letzteFarbe = f;
    w.farbe = BOOT_FARBEN[f];
    const a = this.holeGast(BOOT_GAESTE, this.letzterBootGast, this.k.gast?.gastId, BOOT_EINGANG, BOOT_WARTE, 70);
    this.letzterBootGast = a.gastId;
    w.gast = a;
    a.wartet = false;
    a.onTap(() => this.bootGastTipp(a), { pad: 60 });
    a.walkTo(BOOT_WARTE.x, BOOT_WARTE.y, { tempo: 240 }).then((ok) => {
      if (w.gast !== a || a.destroyed) return;
      if (!ok) a.position.set(BOOT_WARTE.x, BOOT_WARTE.y);
      a.wartet = true;
      a.lookAt(0);
      this.zeigeBootWunsch(true);
    });
    if (!erst || this.aktiv) {
      this.sage('spielplatz_rinne', () => this.w.phase === 'rinne' && this.w.gelegt === 0, erst ? 2.5 : 3);
    }
  }

  bootGastTipp(a) {
    this.fokus = 'wasser';
    if (!a.wartet) {
      if (this.zeit - (a.lautZeit ?? -9) > 0.8) { a.lautZeit = this.zeit; a.sound(); }
      return;
    }
    fx.wobble(a);
    a.sound();
    if (this.w.phase === 'boot' || this.w.phase === 'rinne' || this.w.phase === 'pumpen') this.zeigeBootWunsch(true);
  }

  // ---------------------------------------------------------------- Flotte im Becken (wächst über die Besuche)

  baueFlotte() {
    this.flotte = [];
    let gespeichert = store.get('spielplatz.boote', []);
    if (!Array.isArray(gespeichert)) gespeichert = [];
    gespeichert.slice(-FLOTTE_MAX).forEach((e) => {
      const f = BOOT_FARBEN[(e?.f | 0) % BOOT_FARBEN.length];
      const o = FLOTTE_ORTE[clamp(e?.p | 0, 0, FLOTTE_ORTE.length - 1)];
      if (this.flotte.some((b) => b.ort === o)) return;
      this.inFlotte(f, o, false);
    });
  }

  flottePlatz() {
    const frei = FLOTTE_ORTE.findIndex((o) => !this.flotte.some((b) => b.ort === o));
    if (frei >= 0) return frei;
    return FLOTTE_ORTE.indexOf(this.flotte[0].ort);
  }

  inFlotte(farbe, o, neu) {
    if (this.flotte.length >= FLOTTE_MAX || this.flotte.some((b) => b.ort === o)) {
      // der älteste fährt weich davon (verblasst), der neue nimmt seinen Platz
      const alt = this.flotte.find((b) => b.ort === o) || this.flotte[0];
      this.flotte = this.flotte.filter((b) => b !== alt);
      alt.eventMode = 'none';
      this.tween(alt, { alpha: 0, x: alt.x + 40 }, 0.9, { ease: 'sineInOut' }).then(() => { if (!alt.destroyed) alt.destroy(); });
    }
    const s = spr('spielplatz/schiffchen', {
      x: this.wasserMitte.x + o[0], y: this.wasserMitte.y + o[1] + 8, scale: BOOT_SKALA * 0.8, z: 47 + (o[1] > -10 ? 1 : 0),
      parent: this.welt,
    });
    s.tint = farbe;
    s.farbe = farbe;
    s.ort = o;
    s.basisY = s.y;
    s.phase = rand(0, 6);
    s.hitArea = new PIXI.Rectangle(-330, -480, 660, 640);
    tap(s, () => {
      this.fokus = 'wasser';
      s.hopser = 1;
      note('pling', pick(PENTA) + 12, { vol: 0.25 });
    }, { sound: null, squash: false, hitArea: s.hitArea });
    s.hopser = 0;
    if (neu) {
      s.scale.set(BOOT_SKALA * 0.8);
      this.burst('funkeln', s.x, s.y - 40, { count: 2 });
    }
    this.flotte.push(s);
    if (neu) {
      store.set('spielplatz.boote', this.flotte.map((b) => ({
        f: BOOT_FARBEN.indexOf(b.farbe), p: FLOTTE_ORTE.indexOf(b.ort),
      })));
    }
    return s;
  }

  // ---------------------------------------------------------------- Überraschung im Becken

  ueberrasche() {
    const art = andere(UEBERRASCHUNGEN, this.letzteUeberraschung);
    this.letzteUeberraschung = art;
    const m = this.wasserMitte;
    if (art === 'blasen') {
      this.burst('blasen', m.x, m.y + 10, { count: 6 });
      this.after(0.3, () => sfx('common/blubber', { vol: 0.35 }));
      return;
    }
    if (art === 'regenbogen') {
      const r = spr('common/regenbogen', { x: m.x, y: m.y - 150, scale: 0.42, z: 43, parent: this.welt });
      r.alpha = 0;
      r.eventMode = 'none';
      sfx('common/funkeln', { vol: 0.3 });
      this.tween(r, { alpha: 0.85 }, 1.2, { ease: 'sineInOut' }).then(() => this.wait(2.5))
        .then(() => this.tween(r, { alpha: 0 }, 1.2, { ease: 'sineInOut' }))
        .then(() => { if (!r.destroyed) r.destroy(); });
      return;
    }
    if (art === 'fisch') {
      const f = spr('common/futter_fisch', { x: m.x - 160, y: m.y + 20, scale: 0.28, z: 46, parent: this.welt });
      f.alpha = 0;
      f.eventMode = 'none';
      this.tween(f, { alpha: 1 }, 0.2);
      sfx('common/platsch', { vol: 0.3, rate: 1.2 });
      bogenFlug(this, f, m.x + 40, m.y + 20, { hoehe: 150, min: 1.1, drehung: 0.6 }).then(() => {
        sfx('common/platsch', { vol: 0.3, rate: 1.1 });
        this.burst('tropfen', f.x, f.y, { count: 4 });
        return this.tween(f, { alpha: 0 }, 0.3);
      }).then(() => { if (!f.destroyed) f.destroy(); });
      return;
    }
    // Frosch oder Ente: kommt vom Beckenrand, freut sich, geht wieder
    const a = new Actor(art, { x: m.x + 230, y: m.y - 30, scale: 0.15, parent: this.welt, z: 52 });
    a.alpha = 0;
    a.lookAt(m.x);
    a.onTap(() => freude(this, a, { herzen: 2, hoehe: 30 }), { pad: 80 });
    this.tween(a, { alpha: 1 }, 0.4, { ease: 'sineInOut' });
    a.hopTo(m.x + 120, m.y + 10, { hoehe: 80, dauer: 0.8 }).then((ok) => {
      if (!ok || a.destroyed) return;
      sfx('common/platsch', { vol: 0.3 });
      this.burst('tropfen', a.x, a.y, { count: 3 });
      freude(this, a, { herzen: 2, hoehe: 30 });
    });
    this.after(5, () => {
      if (a.destroyed) return;
      a._tap?.off();
      this.tween(a, { alpha: 0 }, 0.8, { ease: 'sineInOut' }).then(() => { if (!a.destroyed) a.destroy({ children: true }); });
    });
  }

  // ================================================================ Matschküche

  baueKueche() {
    const k = spr('spielplatz/matschkueche', { x: KUECHE.x, y: KUECHE.y, scale: KUECHE.skala, z: 10, parent: this.welt });
    this.kueche = k;
    tap(k, () => {
      this.fokus = 'kueche';
      fx.wobble(k, 0.02);
      this.ton('common/klack', { vol: 0.25, rate: 0.9 }, 0.5);
    }, { sound: null, squash: false, pad: 10 });
  }

  baueSchuessel() {
    const c = new PIXI.Container({ label: 'schuessel' });
    c.position.set(SCHUESSEL.x, SCHUESSEL.y);
    c.scale.set(SCHUESSEL.skala);
    c.zIndex = 15;
    const bild = spr('spielplatz/schuessel', { parent: c });
    // Inhalt: Sand / Matsch in der Öffnung (Punkt innen 187,105; Anker 0,52/0,82 von 360×336)
    const iy = (105 - 0.82 * 336);
    const inhalt = new PIXI.Graphics().ellipse(0, iy + 6, 132, 24).fill(0xffffff);
    inhalt.tint = SAND_FARBE;
    const glanz = new PIXI.Graphics().ellipse(-40, iy, 40, 7).fill({ color: 0xffffff, alpha: 0.35 });
    glanz.visible = false;
    // Holzlöffel steckt im Inhalt
    const loeffel = new PIXI.Container();
    loeffel.position.set(30, iy + 4);
    const lg = new PIXI.Graphics()
      .roundRect(-12, -230, 24, 240, 12).fill(0xc98a4b)
      .roundRect(-12, -230, 8, 230, 4).fill({ color: 0xffffff, alpha: 0.2 });
    loeffel.addChild(lg);
    loeffel.rotation = 0.35;
    c.addChild(loeffel, bild, inhalt, glanz);
    // Löffel hinter dem vorderen Rand: zuerst Löffel, dann Schüssel, dann Inhalt (deckt den Stiel unten ab)
    c.hitArea = new PIXI.Rectangle(-230, -460, 460, 500);
    this.welt.addChild(c);
    this.schuessel = c;
    this.inhalt = inhalt;
    this.glanz = glanz;
    this.loeffel = loeffel;
    void bild;
    tap(c, () => this.schuesselTipp(), { sound: null, squash: true, hitArea: c.hitArea });
  }

  setzeMatsch(farbe, dauer = 0.6) {
    const von = this.inhalt.tint;
    const p = { t: 0 };
    return this.tween(p, { t: 1 }, dauer, {
      ease: 'sineInOut',
      onUpdate: () => { if (!this.inhalt.destroyed) this.inhalt.tint = mische(von, farbe, p.t); },
    });
  }

  baueEimer() {
    const e = spr('common/eimer_wasser', { x: EIMER.x, y: EIMER.y, scale: EIMER.skala, z: 64, parent: this.welt });
    e.hitArea = new PIXI.Rectangle(-240, -260, 480, 520);
    this.eimer = e;
    this.eimerGriff = drag(e, {
      back: true,
      lift: 1.06,
      hitArea: e.hitArea,
      heim: EIMER,
      targets: () => [{ x: SCHUESSEL.x, y: SCHUESSEL.y - 100, radius: 320 }],
      onStart: () => { this.fokus = 'kueche'; },
      onDrop: (ziel, ctx) => {
        if (this.k.phase !== 'wasser' || this.giesst) {
          fx.wobble(e, 0.06);
          this.ton('common/platsch', { vol: 0.2, rate: 1.3 }, 0.6);
          return;
        }
        ctx.snapTo(null);
        this.giesseInSchuessel();
      },
    });
  }

  async giesseInSchuessel() {
    const e = this.eimer;
    this.giesst = true;
    e.eventMode = 'none';
    e.zIndex = 90;
    await bogenFlug(this, e, SCHUESSEL.x + 130, SCHUESSEL.y - 230, { hoehe: 100, min: 0.55 });
    await this.tween(e, { rotation: -1.1 }, 0.35, { ease: 'sineInOut' });
    sfx('common/giessen', { vol: 0.45 });
    this.burst('tropfen', SCHUESSEL.x + 20, SCHUESSEL.y - 120, { count: 6 });
    this.setzeMatsch(MATSCH[0], 0.9);
    this.glanz.visible = true;
    await this.wait(0.9);
    sfx('common/platsch', { vol: 0.3 });
    await this.tween(e, { rotation: 0 }, 0.3, { ease: 'sineInOut' });
    await bogenFlug(this, e, EIMER.x, EIMER.y, { hoehe: 80, min: 0.55 });
    e.zIndex = 64;
    e.eventMode = 'static';
    this.giesst = false;
    if (this.k.phase === 'wasser') {
      this.k.phase = 'ruehren';
      this.k.ruehrer = 0;
    }
  }

  schuesselTipp() {
    this.fokus = 'kueche';
    const k = this.k;
    if (k.phase === 'ruehren') { this.ruehre(); return; }
    if (k.phase === 'fuellen') { this.fuelle(); return; }
    fx.wobble(this.loeffel, 0.12);
    this.ton('common/klack', { vol: 0.25, rate: 1.3 }, 0.4);
  }

  async ruehre() {
    const k = this.k;
    if (this.ruehrt) return;
    this.ruehrt = true;
    k.ruehrer++;
    this.ton('common/schrubben', { vol: 0.3, rate: 0.8 }, 0.3);
    this.burst('blasen', SCHUESSEL.x + rand(-40, 40), SCHUESSEL.y - 110, { count: 2 });
    this.setzeMatsch(mische(MATSCH[0], MATSCH[2], Math.min(1, k.ruehrer / 3)), 0.5);
    const l = this.loeffel;
    killTweensOf(l, ['x', 'rotation']);
    await this.tween(l, { x: -40, rotation: -0.2 }, 0.2, { ease: 'sineInOut' });
    await this.tween(l, { x: 50, rotation: 0.5 }, 0.25, { ease: 'sineInOut' });
    await this.tween(l, { x: 30, rotation: 0.35 }, 0.15, { ease: 'sineInOut' });
    this.ruehrt = false;
    if (k.ruehrer >= 3 && k.phase === 'ruehren') {
      k.phase = 'fuellen';
      fx.pop(this.schuessel, 0.05);
      sfx('common/plopp', { vol: 0.3 });
    }
  }

  baueTeller() {
    const g = new PIXI.Graphics()
      .ellipse(0, 0, 112, 28).fill(0xb9824b)
      .ellipse(0, -4, 100, 22).fill(0xd9a46a)
      .ellipse(-30, -8, 40, 7).fill({ color: 0xffffff, alpha: 0.25 });
    g.position.set(TELLER.x, TELLER.y);
    g.zIndex = 12;
    g.eventMode = 'none';
    this.welt.addChild(g);
    this.teller = g;
  }

  async fuelle() {
    const k = this.k;
    if (this.fuellt || !k.form) return;
    this.fuellt = true;
    k.phase = 'fuelltGerade';
    const c = this.schuessel;
    c.zIndex = 30;
    await bogenFlug(this, c, TELLER.x - 60, TELLER.y - 150, { hoehe: 60, min: 0.5 });
    await this.tween(c, { rotation: 0.9 }, 0.35, { ease: 'sineInOut' });
    this.ton('common/platsch', { vol: 0.35, rate: 0.8 }, 0.2);
    this.burst('staub', TELLER.x, TELLER.y - 40, { count: 3 });
    // Matsch-Häubchen im Förmchen
    const h = k.haeubchen;
    h.visible = true;
    h.scale.set(0.3);
    this.tween(h, { scale: 1 }, 0.4, { ease: 'backOut' });
    this.setzeMatsch(SAND_FARBE, 0.5);
    this.glanz.visible = false;
    await this.wait(0.3);
    await this.tween(c, { rotation: 0 }, 0.3, { ease: 'sineInOut' });
    await bogenFlug(this, c, SCHUESSEL.x, SCHUESSEL.y, { hoehe: 60, min: 0.5 });
    c.zIndex = 15;
    this.fuellt = false;
    k.phase = 'stuerzen';
    fx.pop(k.form, 0.05);
  }

  async stuerze() {
    const k = this.k;
    if (k.phase !== 'stuerzen') return;
    k.phase = 'stuerztGerade';
    const f = k.form;
    const h = k.haeubchen;
    const s = f.scale.y;
    sfx('common/wusch', { vol: 0.3 });
    await this.tween(f, { y: TELLER.y - 120 }, 0.3, { ease: 'quadOut' });
    h.visible = false;
    await this.tween(f, { scaleY: -s }, 0.35, { ease: 'sineInOut' });
    await this.tween(f, { y: TELLER.y + 2 - 0 }, 0.25, { ease: 'quadIn' });
    sfx('common/landen', { vol: 0.5 });
    // klopf … und abheben: der Kuchen steht
    const t = k.torte;
    t.visible = true;
    t.alpha = 1;
    await this.wait(0.3);
    this.tween(f, { alpha: 0 }, 0.5, { delay: 0.2, ease: 'sineInOut' });
    await this.tween(f, { y: TELLER.y - 260 }, 0.7, { ease: 'sineOut' });
    f.visible = false;
    this.burst('funkeln', TELLER.x, TELLER.y - 80, { count: 3 });
    note('glocke', 79, { vol: 0.3 });
    this.zeigeDeko();
  }

  zeigeDeko() {
    const k = this.k;
    k.phase = 'verzieren';
    k.deko = [];
    const bilder = shuffle(DEKO.filter((d) => hasTex(d))).slice(0, 3);
    bilder.forEach((id, i) => {
      const o = DEKO_ORTE[i];
      const d = spr(id, { x: o.x, y: o.y, z: 66, parent: this.welt });
      d.anchor.set(0.5);
      d.skalaBoden = skalaFuer(id, DEKO_GROESSE);
      d.skalaAuf = skalaFuer(id, DEKO_AUF);
      d.scale.set(d.skalaBoden * 0.3);
      d.alpha = 0;
      const halb = 120 / d.skalaBoden;
      d.hitArea = new PIXI.Rectangle(-halb, -halb, 2 * halb, 2 * halb);
      d.heim = { x: o.x, y: o.y };
      this.tween(d, { alpha: 1 }, 0.35, { delay: i * 0.15 });
      this.tween(d, { scale: d.skalaBoden }, 0.45, { delay: i * 0.15, ease: 'backOut' });
      d.griff = drag(d, {
        back: true,
        lift: 1.1,
        hitArea: d.hitArea,
        heim: d.heim,
        targets: () => [{ x: TELLER.x, y: TELLER.y - 70, radius: 280 }],
        onStart: () => { this.fokus = 'kueche'; },
        onDrop: (ziel, ctx) => {
          if (k.phase !== 'verzieren' || d.drauf) return;
          ctx.snapTo(null);
          this.verziere(d);
        },
      });
      k.deko.push(d);
    });
    sfx('common/plopp', { vol: 0.3 });
    this.sage('spielplatz_verzieren', () => this.k.phase === 'verzieren' && this.k.deko.every((d) => !d.drauf), 1);
  }

  async verziere(d) {
    const k = this.k;
    const i = k.deko.filter((x) => x.drauf).length;
    d.drauf = true;
    d.griff?.off();
    d.eventMode = 'none';
    d.zIndex = 90;
    const p = DEKO_PLAETZE[i];
    const ziel = { x: TELLER.x + p.x, y: TELLER.y + p.y };
    await bogenFlug(this, d, ziel.x, ziel.y, { hoehe: 90, min: 0.5, skala: d.skalaAuf, drehung: rand(-0.2, 0.2) });
    if (d.destroyed || k.phase !== 'verzieren') return;
    // auf den Kuchen setzen (fliegt mit ihm zum Gast)
    const t = k.torte;
    const lx = d.x - t.x;
    const ly = d.y - t.y;
    t.addChild(d);
    d.position.set(lx, ly);
    d.zIndex = 0;
    this.ton('common/plopp', { vol: 0.35 }, 0.15);
    note('xylo', PENTA[i + 2], { vol: 0.3 });
    this.burst('funkeln', ziel.x, ziel.y, { count: 2 });
    if (k.deko.every((x) => x.drauf && x.parent === t)) this.servierBereit();
  }

  servierBereit() {
    const k = this.k;
    k.phase = 'servieren';
    const t = k.torte;
    t.hitArea = new PIXI.Rectangle(-150, -200, 300, 230);
    this.burst('funkeln', t.x, t.y - 60, { count: 3 });
    t.griff = drag(t, {
      back: true,
      lift: 1.08,
      hitArea: t.hitArea,
      heim: { x: TELLER.x, y: TELLER.y },
      targets: () => (k.gast && !k.gast.destroyed ? [{ obj: k.gast, radius: 340 }] : []),
      onStart: () => { this.fokus = 'kueche'; },
      onDrop: (ziel, ctx) => {
        if (k.phase !== 'servieren' || !k.gast?.wartet) return;   // zurück auf den Teller
        ctx.snapTo(null);
        this.serviere();
      },
    });
    this.sage('spielplatz_servieren', () => this.k.phase === 'servieren', 1.2);
  }

  async serviere() {
    const k = this.k;
    k.phase = 'isst';
    const t = k.torte;
    t.griff?.off();
    t.eventMode = 'none';
    t.zIndex = 95;
    const g = k.gast;
    const m = g.point('mouth');
    const ziel = { x: g.x + (m.x - g.x) * 0.6 + 70, y: g.y - 20 };
    await bogenFlug(this, t, ziel.x, ziel.y, { hoehe: 120, min: 0.6, skala: 0.85 });
    if (g.destroyed) return;
    // so tun, als ob: Happen nehmen
    g.pose('eat');
    for (let i = 0; i < 3; i++) {
      sfx('common/mampf', { vol: 0.4 });
      this.burst('staub', t.x, t.y - 50, { count: 2 });
      this.tween(t, { scaleX: t.scale.x * 0.8, scaleY: t.scale.y * 0.8 }, 0.4, { ease: 'sineInOut' });
      await this.wait(0.6);
    }
    this.tween(t, { alpha: 0 }, 0.4, { ease: 'sineInOut' }).then(() => {
      t.visible = false;
      for (const d of t.children.slice(1)) d.destroy();
    });
    if (g.destroyed) return;
    g.pose('idle');
    freude(this, g, { herzen: 5 });
    belohne(this, stickerFuer('matschkueche'), KUECHEN_WARTE.x + 240, KUECHEN_WARTE.y - 420);
    await this.wait(1.4);
    await this.kuechenEnde(g);
    g.wartet = false;
    this.schickeWeg(g, KUECHEN_EINGANG);
    k.gast = null;
    await this.wait(2.4);
    this.starteKuechenRunde();
  }

  /** Kleiner, jedes Mal anderer Ausklang */
  async kuechenEnde(g) {
    const art = andere(KUECHEN_ENDEN, this.letztesEnde);
    this.letztesEnde = art;
    if (art === 'tanz') {
      for (let i = 0; i < 2; i++) {
        this.burst('noten', g.x, g.y - 220, { count: 2 });
        note('xylo', PENTA[2 + i * 2], { vol: 0.3 });
        await g.hop(50);
        if (g.destroyed) return;
      }
      return;
    }
    if (art === 'herz') {
      this.burst('herzen', g.x + 60, g.y - 200, { count: 6 });
      note('glocke', 84, { vol: 0.28 });
      await this.wait(1.2);
      return;
    }
    // ein Freund kommt kurz dazu, beide freuen sich
    const frei = KUECHEN_GAESTE.filter((x) => x !== g.gastId && x !== this.w.gast?.gastId);
    const f = new Actor(pick(frei), { x: KUECHEN_EINGANG.x, y: KUECHEN_EINGANG.y + 10, scale: GAST_SKALA * 0.9, parent: this.welt, z: 69 });
    f.onTap(() => freude(this, f, { herzen: 2 }), { pad: 60 });
    await f.walkTo(g.x + 185, g.y + 15, { tempo: 260 });
    if (f.destroyed) return;
    f.lookAt(g.x);
    freude(this, f, { herzen: 3 });
    await this.wait(1.2);
    this.schickeWeg(f, KUECHEN_EINGANG);
  }

  starteKuechenRunde(erst = false) {
    const k = this.k;
    k.phase = 'wasser';
    k.ruehrer = 0;
    this.inhalt.tint = SAND_FARBE;
    this.glanz.visible = false;
    // Förmchen der Runde (die Wunsch-Form) und der Kuchen, der daraus wird
    const form = andere(FORMEN, this.letzteForm);
    this.letzteForm = form;
    k.formArt = form;
    const kuchenFarbe = pick(MATSCH.slice(1));
    k.form?.destroy();
    k.haeubchen?.destroy();
    k.torte?.destroy({ children: true });
    const f = spr('spielplatz/foermchen_' + form, { x: TELLER.x, y: TELLER.y + 2, scale: KUCHEN_SKALA, z: 14, parent: this.welt });
    f.alpha = 0;
    f.hitArea = new PIXI.Rectangle(-300, -480, 600, 560);
    this.tween(f, { alpha: 1 }, 0.5, { ease: 'sineInOut' });
    tap(f, () => {
      this.fokus = 'kueche';
      if (k.phase === 'stuerzen') this.stuerze();
      else if (k.phase === 'fuellen') this.fuelle();
      else { fx.wobble(f, 0.05); this.ton('common/klack', { vol: 0.2, rate: 1.4 }, 0.4); }
    }, { sound: null, squash: false, hitArea: f.hitArea });
    k.form = f;
    const h = new PIXI.Graphics().ellipse(0, 0, 58, 22).fill(kuchenFarbe)
      .ellipse(-16, -6, 18, 5).fill({ color: 0xffffff, alpha: 0.25 });
    h.position.set(TELLER.x + (form === 'fisch' ? 10 : 0), TELLER.y - (form === 'fisch' ? 52 : 68));
    h.zIndex = 15;
    h.visible = false;
    h.eventMode = 'none';
    this.welt.addChild(h);
    k.haeubchen = h;
    const t = new PIXI.Container({ label: 'matschkuchen' });
    t.position.set(TELLER.x, TELLER.y + 2);
    t.zIndex = 13;
    t.visible = false;
    const kuchen = spr('spielplatz/sandkuchen_' + form, { scale: KUCHEN_SKALA, parent: t });
    kuchen.tint = kuchenFarbe;
    this.welt.addChild(t);
    k.torte = t;

    const a = this.holeGast(KUECHEN_GAESTE, this.letzterKuechenGast, this.w.gast?.gastId, KUECHEN_EINGANG, KUECHEN_WARTE, 68);
    this.letzterKuechenGast = a.gastId;
    k.gast = a;
    a.wartet = false;
    a.onTap(() => this.kuechenGastTipp(a), { pad: 60 });
    a.walkTo(KUECHEN_WARTE.x, KUECHEN_WARTE.y, { tempo: 240 }).then((ok) => {
      if (k.gast !== a || a.destroyed) return;
      if (!ok) a.position.set(KUECHEN_WARTE.x, KUECHEN_WARTE.y);
      a.wartet = true;
      a.lookAt(0);
      this.zeigeKuchenWunsch(true);
    });
    k.kuchenFarbe = kuchenFarbe;
    if (!erst || this.aktiv) {
      this.sage('spielplatz_matsch', () => this.k.phase === 'wasser' && !this.giesst, erst ? 9 : 3);
    }
  }

  zeigeKuchenWunsch(sofort = false) {
    const g = this.k.gast;
    if (!g || g.destroyed || !g.wartet) return;
    if (!sofort && this.zeit - (this.k.blaseZeit ?? -99) < 8) return;
    this.k.blaseZeit = this.zeit;
    g.bubble('spielplatz/sandkuchen_' + this.k.formArt, 2.6, { seite: 'rechts' });
    const bild = g._blase?.children?.[1];
    if (bild) bild.tint = this.k.kuchenFarbe;
  }

  kuechenGastTipp(a) {
    this.fokus = 'kueche';
    if (!a.wartet) {
      if (this.zeit - (a.lautZeit ?? -9) > 0.8) { a.lautZeit = this.zeit; a.sound(); }
      return;
    }
    if (this.k.phase === 'servieren') { this.serviere(); return; }
    if (this.k.phase === 'isst') return;
    fx.wobble(a);
    a.sound();
    this.zeigeKuchenWunsch(true);
  }

  // ================================================================ Seite

  betreten() {
    this.hinweiseAus();
    if (this.w.fliesst) this.stromTon.an(0.6);
    const n = this.besuche === 1 ? 1.5 : 1.2;
    if (this.w.phase === 'rinne') this.sage('spielplatz_rinne', () => this.w.phase === 'rinne' && this.w.gelegt === 0, n);
    else if (this.w.phase === 'pumpen') this.sage('spielplatz_pumpen', () => this.w.phase === 'pumpen' && this.w.pumpen === 0, n);
    else if (this.w.phase === 'boot') this.sage('spielplatz_schiffchen', () => this.w.phase === 'boot', n);
    if (this.k.phase === 'wasser') this.sage('spielplatz_matsch', () => this.k.phase === 'wasser' && !this.giesst, n + 8);
  }

  verlassen() {
    this.hinweiseAus();
    this.stromTon.aus(0.4);
  }

  update(dt, t) {
    this.zeit = t;
    this.falter.update(dt);
    // Wasserrad: dreht sich weich an und aus (höchstens ~2 rad/s)
    this.radSchub = Math.max(0, this.radSchub - dt * 0.9);
    const ziel = Math.min(2.4, this.radZiel + this.radSchub);
    this.radTempo += (ziel - this.radTempo) * Math.min(1, dt * 1.2);
    this.rad.rotation += this.radTempo * dt;
    // fließendes Wasser glitzert leicht (langsam, ohne Blinken)
    if (this.w.fliesst) {
      const a = 0.85 + Math.sin(t * 2.2) * 0.08;
      for (const g of this.laeufe) if (g.visible && g.scale.x >= 1) g.alpha = a;
    }
    // Schiffchen im Becken schaukeln
    for (const s of this.flotte) {
      if (s.destroyed) continue;
      s.hopser = Math.max(0, (s.hopser || 0) - dt * 1.6);
      s.y = s.basisY + Math.sin(t * 1.3 + s.phase) * 3 - Math.sin(s.hopser * Math.PI) * 26;
      s.rotation = Math.sin(t * 1.1 + s.phase) * 0.05;
    }
    // Wünsche wieder zeigen, solange gewartet wird
    if (this.w.phase === 'boot') this.zeigeBootWunsch();
    if (this.k.phase === 'wasser' && this.zeit > 4) this.zeigeKuchenWunsch();
  }

  hinweiseWasser() {
    const w = this.w;
    switch (w.phase) {
      case 'rinne': {
        const r = this.rinnen.find((x) => x.platz < 0 && x.reserviert === undefined);
        const i = PLAETZE.findIndex((_, j) => !this.rinnen.some((x) => x.platz === j || x.reserviert === j));
        if (!r || i < 0 || r.ziehen?.isDragging()) return [];
        this.mRinne.position.set(PLAETZE[i].x, PLAETZE[i].y - 20);
        return [{ von: r, nach: this.mRinne }];
      }
      case 'pumpen':
        return this.pumpt ? [] : [this.mHebel];
      case 'boot': {
        const s = this.boote.find((b) => b.visible && b.farbe === w.farbe && b.griff);
        if (!s || s.griff.isDragging()) return [];
        return [{ von: s, nach: this.mStart }];
      }
      default:
        return [];
    }
  }

  hinweiseKueche() {
    const k = this.k;
    switch (k.phase) {
      case 'wasser':
        return this.giesst || this.eimerGriff.isDragging() ? [] : [{ von: this.eimer, nach: this.mSchuessel }];
      case 'ruehren':
      case 'fuellen':
        return this.ruehrt || this.fuellt ? [] : [this.schuessel];
      case 'stuerzen':
        return [k.form];
      case 'verzieren': {
        const d = k.deko.find((x) => !x.drauf);
        if (!d || d.griff?.isDragging()) return [];
        return [{ von: d, nach: this.mKuchen }];
      }
      case 'servieren': {
        const g = k.gast;
        if (!g || g.destroyed || k.torte.griff?.isDragging()) return [];
        this.mGast.position.set(g.x + 40, g.y - 100);
        return [{ von: k.torte, nach: this.mGast }];
      }
      default:
        return [];
    }
  }

  hinweise() {
    // Immer nur EIN nächster Schritt: der der Station, die das Kind zuletzt bespielt hat. Nur wenn dort gerade
    // nichts zu tun ist (Wasser fließt, Gast kommt …), zeigt die Hand den nächsten Schritt der anderen Station.
    // (Der Kern zeigt reihum aus der Liste – zwei Einträge ließen die Hand zwischen den Stationen springen.)
    const w = this.hinweiseWasser();
    const k = this.hinweiseKueche();
    const erst = this.fokus === 'kueche' ? k : w;
    const dann = this.fokus === 'kueche' ? w : k;
    return (erst.length ? erst : dann).slice(0, 1);
  }
}
