// Malhaus – ein ruhiges Atelier mit Staffelei. Vier Bilderbuch-Seiten, alle vor hg_atelier (Seite 4, die Bastelecke
// mit Knete, Perlenkette, Ofen und Regal, steht in bastelecke.js);
// gemalt wird immer auf dem großen weißen Blatt (Punkte blatt_lo … blatt_ru), jede Seite hat ihre eigene Leinwand.
//
// Auf jeder Seite kommt ein Tier zu Besuch (unten links) und wünscht sich ein Bild (Denkblase bleibt sichtbar).
// Jede Runde führt in Schritten zu einem fertigen Bild, das der Besuch bekommt und an die Galerie-Leine oben hängt:
//   1. Ausmalen:  Besuch kommt → Ausmalbild aus der Reihe tippen → Lieblingsfarbe tippen → Flächen ausmalen
//                 → Rahmen aussuchen → Bild dem Besuch geben (es fliegt an die Leine).
//   2. Frei malen: Besuch wünscht sich eine Form (Herz, Stern, Fisch …) → Farbe tippen → die Punkte auf dem Umriss
//                 mit dem Finger nachfahren → in die Form tippen (sie füllt sich) → weiter malen → Rahmen → geben.
//   3. Stempeln:  Besuch wünscht sich ein Bild-Thema (Wiese, Meer, Nacht …) → mit dem Finger den Untergrund über das
//                 Blatt wischen → Stempel aussuchen → stempeln → Rahmen → geben.
// Nichts kann schiefgehen: jedes Bild, jede Farbe, jeder Stempel ist recht; die Zeige-Hand zeigt den nächsten
// Schritt. „Neues Blatt" (unten links) beginnt das Bild neu, der Rahmen-Knopf (unten rechts) führt zum Rahmen.
// Die Leine füllt sich über die Runden (höchstens 8 Bilder, bleiben über Besuche hinweg).

import { tex, meta, sfx, voice, note, tap, fx, ui, rand, shuffle, clamp, PIXI } from '../../engine/index.js';
import { Seite, SeitenSzene } from '../../gemeinsam/seiten.js';
import { belohne } from '../../gemeinsam/sticker.js';
import { Malflaeche, FingerVerteiler } from './leinwand.js';
import { zerlege, zerlegeSchritte, gibArbeitFrei, flaecheBei, punktIn, Malbild } from './ausmalen.js';
import { baueDeko } from './deko.js';
import {
  RAHMEN, baueRahmen, GalerieLeine, galerieNeu, galerieLaden, Besuch, naechsterWunsch, blasenKarte, farbKlecks,
} from './ablauf.js';
import { umrissPunkte, silhouette } from './formen.js';
import { Bastelecke } from './bastelecke.js';

const HG = 'malhaus/hg_atelier';

// zehn Farbtöpfe: links die warmen, rechts die kühlen
const FARBEN = [
  { id: 'rot', rgb: 0xe8453c },
  { id: 'orange', rgb: 0xf59a2c },
  { id: 'gelb', rgb: 0xffd83d },
  { id: 'hellgruen', rgb: 0x9ad25a },
  { id: 'dunkelgruen', rgb: 0x2e9a4e },
  { id: 'hellblau', rgb: 0x74ccf2 },
  { id: 'blau', rgb: 0x2f6bd3 },
  { id: 'lila', rgb: 0x9b5fd0 },
  { id: 'rosa', rgb: 0xf79bc6 },
  { id: 'braun', rgb: 0x9a6238 },
];
const TOPF_X = 905;                          // Spalten der Töpfe (±), gleich neben dem Blatt
const TOPF_Y = [340, 530, 720, 910, 1100];
const REIHE_Y = 1405;                        // Reihe unten auf dem Boden (Bilder, Werkzeuge, Stempel, Rahmen)
const REIHE_ABSTAND = 210;                   // 8 Dinge reichen bis x ±840 – „neues Blatt" und Rahmen passen daneben
const REIHE_X = (i, n, abstand = REIHE_ABSTAND) => (i - (n - 1) / 2) * abstand;
// beide Knöpfe an den Enden der Reihe, ganz im Kernbereich (x ±1066) und neben den Topf-Leisten
const NEU_ORT = { x: -950, y: 1414 };        // „neues Blatt" unten links
const RAHMEN_ORT = { x: 950, y: 1414 };      // Bilderrahmen unten rechts (frei von Pfeil und Katze)
const RAHMEN_GROESSE = 220;
const RAHMEN_AUF_BLATT = { einzug: 30, dicke: 70 };   // Rahmen auf der Staffelei: Öffnung 30 im Blatt, Leiste 70

const BILDER = ['mal_zug', 'mal_kuh', 'mal_feuerwehr', 'mal_haus', 'mal_schmetterling', 'mal_bagger', 'mal_fisch', 'mal_ente'];
const STEMPEL = ['stempel_stern', 'stempel_herz', 'stempel_blume', 'stempel_auto', 'stempel_katze', 'stempel_sonne', 'stempel_fisch', 'stempel_baum'];

// Rahmen-Bild: Innenöffnung in Bildpunkten von malhaus/bilderrahmen (900×612)
const RAHMEN_INNEN = { x0: 118, y0: 118, x1: 780, y1: 501 };

// Zerlegte Ausmalbilder (reine Daten, je ca. 1,6 MB, zusammen ca. 13 MB) – bleiben über Besuche hinweg, damit nie
// zweimal gerechnet wird. Der große Arbeitsspeicher fürs Zerlegen (gut 20 MB) wird dagegen freigegeben, sobald alle
// acht Bilder zerlegt sind, spätestens beim Verlassen des Ortes.
const ZERLEGT = new Map(); // 'mal_kuh:1574x1011' → daten
const ZEIT_JE_BILD = 3;    // ms Rechenzeit je Bild fürs Vorab-Zerlegen (das Tablet zeichnet alle 8,3 ms ein Bild)
const ZEIT_ANGEZEIGT = 5;  // ms je Bild für das Bild auf dem Blatt (es zeigt bis dahin nur seine Linien)

// ---------------------------------------------------------------- Wünsche der Besuche (je Seite)

// Seite 1: Ausmalbild und Lieblingsfarbe (Nummer in FARBEN)
const WUENSCHE_AUSMALEN = [
  { tier: 'kuh', bild: 'mal_kuh', farbe: 8 },
  { tier: 'baer', bild: 'mal_zug', farbe: 0 },
  { tier: 'hund', bild: 'mal_feuerwehr', farbe: 0 },
  { tier: 'eule', bild: 'mal_haus', farbe: 1 },
  { tier: 'hase', bild: 'mal_schmetterling', farbe: 7 },
  { tier: 'hund', bild: 'mal_bagger', farbe: 2 },
  { tier: 'pinguin', bild: 'mal_fisch', farbe: 5 },
  { tier: 'ente', bild: 'mal_ente', farbe: 2 },
  { tier: 'baer', bild: 'mal_haus', farbe: 3 },
  // neue Gäste (Runde 3)
  { tier: 'fuchs', bild: 'mal_bagger', farbe: 1 },
  { tier: 'maus', bild: 'mal_haus', farbe: 8 },
  { tier: 'schaf', bild: 'mal_schmetterling', farbe: 6 },
  { tier: 'maus', bild: 'mal_zug', farbe: 4 },
];

// Seite 2: Form zum Nachspuren und Farbe
const WUENSCHE_FREI = [
  { tier: 'hase', form: 'stempel_herz', farbe: 0 },
  { tier: 'pinguin', form: 'stempel_fisch', farbe: 5 },
  { tier: 'eule', form: 'stempel_stern', farbe: 2 },
  { tier: 'kuh', form: 'stempel_blume', farbe: 8 },
  { tier: 'ente', form: 'stempel_sonne', farbe: 1 },
  { tier: 'hund', form: 'stempel_auto', farbe: 6 },
  { tier: 'baer', form: 'stempel_baum', farbe: 3 },
  { tier: 'hund', form: 'stempel_katze', farbe: 1 },
  // neue Gäste (Runde 3)
  { tier: 'maus', form: 'stempel_herz', farbe: 8 },
  { tier: 'fuchs', form: 'stempel_stern', farbe: 1 },
  { tier: 'schaf', form: 'stempel_blume', farbe: 7 },
];

// Seite 3: Untergrund (oben/unten, Horizont als Anteil der Höhe) und Wunsch-Stempel
const WUENSCHE_STEMPEL = [
  { tier: 'kuh', oben: 0xc4e8fb, unten: 0x9fd46c, horizont: 0.6, stempel: ['stempel_blume', 'stempel_baum', 'stempel_sonne'] },
  { tier: 'pinguin', oben: 0xd6f1fd, unten: 0x6cbcec, horizont: 0.42, stempel: ['stempel_fisch', 'stempel_stern'] },
  { tier: 'eule', oben: 0x3f4d8e, unten: 0x5a5299, horizont: 0.74, stempel: ['stempel_stern', 'stempel_katze'] },
  { tier: 'hase', oben: 0xffe4ee, unten: 0xffc8de, horizont: 0.55, stempel: ['stempel_herz', 'stempel_blume'] },
  { tier: 'hund', oben: 0xd0ebff, unten: 0xdccba8, horizont: 0.62, stempel: ['stempel_auto', 'stempel_baum'] },
  { tier: 'ente', oben: 0xfff2b8, unten: 0xb6df80, horizont: 0.62, stempel: ['stempel_sonne', 'stempel_blume'] },
  { tier: 'baer', oben: 0xdaf2ff, unten: 0xaadb8e, horizont: 0.6, stempel: ['stempel_katze', 'stempel_baum'] },
  // neue Gäste (Runde 3)
  { tier: 'schaf', oben: 0xe6f6ff, unten: 0xc6e89a, horizont: 0.5, stempel: ['stempel_blume', 'stempel_sonne'] },
  { tier: 'fuchs', oben: 0xffd9b0, unten: 0xe9b97a, horizont: 0.66, stempel: ['stempel_baum', 'stempel_sonne'] },
  { tier: 'maus', oben: 0xf0e4ff, unten: 0xd8c4f2, horizont: 0.58, stempel: ['stempel_herz', 'stempel_stern'] },
];

// ---------------------------------------------------------------- kleine Hilfen

// Farbe zu Weiß hin aufhellen (k = 0 … 1)
function hell(rgb, k) {
  const r = (rgb >> 16) & 255;
  const g = (rgb >> 8) & 255;
  const b = rgb & 255;
  const m = (c) => Math.round(c + (255 - c) * k);
  return (m(r) << 16) | (m(g) << 8) | m(b);
}

function css(rgb) {
  return '#' + rgb.toString(16).padStart(6, '0');
}

// weicher Schatten am Boden
function bodenSchatten(w, h, alpha = 0.2) {
  return new PIXI.Graphics()
    .ellipse(0, 0, w / 2, h / 2).fill({ color: 0x5a3a1a, alpha: alpha * 0.6 })
    .ellipse(0, 0, w * 0.38, h * 0.36).fill({ color: 0x5a3a1a, alpha: alpha * 0.6 });
}

// weicher Lichtschein hinter einem gewählten Ding (kein Blinken, wird weich ein-/ausgeblendet)
function schein(w, h) {
  const g = new PIXI.Graphics();
  for (let i = 0; i < 4; i++) {
    const k = 1 - i * 0.18;
    g.ellipse(0, 0, (w / 2) * k, (h / 2) * k).fill({ color: 0xfff1a8, alpha: 0.22 });
  }
  g.alpha = 0;
  return g;
}

/**
 * Ein „Fach": Ding mit Schatten, Schein und Inhalt; markiere(an) hebt es weich an.
 * → Container (mit .inhalt, .schein, .markiere(an))
 */
function fach(seite, x, y, { breite = 240, hoehe = 200, schatten = null, scheinGroesse = null } = {}) {
  const parent = seite.welt;
  const c = new PIXI.Container({ label: 'fach' });
  c.position.set(x, y);
  c.zIndex = 30;
  if (schatten) {
    const s = bodenSchatten(schatten.w, schatten.h, schatten.alpha ?? 0.22);
    s.y = schatten.y;
    c.addChild(s);
  }
  const sg = scheinGroesse || { w: breite * 1.15, h: hoehe * 1.1 };
  c.schein = schein(sg.w, sg.h);
  c.addChild(c.schein);
  c.inhalt = new PIXI.Container();
  c.addChild(c.inhalt);
  c.gewaehlt = false;
  c.markiere = (an, sofort = false) => {
    c.gewaehlt = an;
    const ziel = { y: an ? -14 : 0, scale: an ? 1.12 : 1 };
    const sZiel = { alpha: an ? 1 : 0 };
    if (sofort) {
      c.inhalt.y = ziel.y;
      c.inhalt.scale.set(ziel.scale);
      c.schein.alpha = sZiel.alpha;
      return;
    }
    seite.tween(c.inhalt, ziel, 0.3, { ease: 'sineInOut' });
    seite.tween(c.schein, sZiel, 0.5, { ease: 'sineInOut' });
  };
  c.hitArea = new PIXI.Rectangle(-breite / 2, -hoehe / 2, breite, hoehe);
  parent.addChild(c);
  return c;
}

// unsichtbares Ziel für die Zeige-Hand (kein Sprite: sonst legt die Hand eine halb durchsichtige Kopie an).
// Die Füllung ist fast durchsichtig (nicht alpha 0 am Objekt), damit die Hand das Ziel als sichtbar erkennt.
function handZiel(parent, x, y, label) {
  const g = new PIXI.Graphics().circle(0, 0, 30).fill({ color: 0xffffff, alpha: 0.01 });
  g.eventMode = 'none';
  g.label = label;
  g.position.set(x, y);
  g.zIndex = 6;
  parent.addChild(g);
  return g;
}

// ---------------------------------------------------------------- Grundseite (alle drei Seiten)

class MalSeite extends Seite {
  static hg = HG;

  /** Blatt in Seiten-Koordinaten (links oben + Größe) aus den Punkten des Hintergrunds */
  get blatt() {
    const lo = this.punkt('blatt_lo', { x: -796, y: 185 });
    const ru = this.punkt('blatt_ru', { x: 778, y: 1196 });
    return { x: lo.x, y: lo.y, w: ru.x - lo.x, h: ru.y - lo.y };
  }

  /** gemeinsamer Aufbau: Deko, „neues Blatt", Staffelei, Galerie-Leine, Besuch */
  grundAufbau() {
    this.deko = baueDeko(this);
    this.neuKnopf = ui.button('malhaus/blatt_neu', {
      parent: this.welt, x: NEU_ORT.x, y: NEU_ORT.y, size: 210, z: 30,
      onTap: () => this.neuesBlattTippen(),
    });
    this.neuKnopf.label = 'neuesBlatt';
    this.rahmenBereit = false;   // genug gemalt → der Rahmen lädt ein (Hand zeigt zuerst dorthin)
    this.staffeleiRuhe = 0;
    // Staffelei: Ablage unter dem Blatt und die Beine – antippen lässt das Blatt sanft wackeln.
    // Die Fläche reicht unter die Reihe; dort haben die Dinge der Reihe Vorrang (liegen weiter oben).
    const ablage = new PIXI.Container({ label: 'staffelei' });
    ablage.zIndex = 4;
    this.welt.addChild(ablage);
    tap(ablage, () => this.staffeleiTippen(), {
      sound: null, squash: false, hitArea: new PIXI.Rectangle(-800, 1198, 1580, 300),
    });

    // Ablauf
    galerieLaden();
    this.leine = new GalerieLeine(this);
    this.besuch = new Besuch(this, { onTap: () => this.besuchGetippt() });
    this.phase = 'malen';        // 'malen' | 'rahmen' (Rahmen aussuchen) | 'geben' (Bild dem Besuch geben) | 'fertig'
    this.wunsch = null;
    this.rundenNr = 0;
    this.overlay = null;         // Rahmen auf dem Blatt
    this.rahmenArt = null;
    const b = this.blatt;
    this.blattMitte = handZiel(this.welt, b.x + b.w / 2, b.y + b.h / 2, 'blattMitte');
    this.blattLinks = handZiel(this.welt, b.x + b.w * 0.24, b.y + b.h * 0.5, 'blattLinks');
  }

  staffeleiTippen() {
    if (this.staffeleiRuhe > 0) return;
    this.staffeleiRuhe = 0.45;
    sfx('common/klack', { vol: 0.4, rate: rand(0.85, 0.95) });
    const sp = this.flaeche?.sprite;
    if (!sp) return;
    const y0 = this.flaeche.oy;
    this.tween(sp, { y: y0 + 7 }, 0.16, { ease: 'sineInOut' })
      .then((ok) => ok && this.tween(sp, { y: y0 - 3 }, 0.18, { ease: 'sineInOut' }))
      .then((ok) => ok && this.tween(sp, { y: y0 }, 0.2, { ease: 'sineInOut' }));
  }

  /** Rahmen-Knopf: zeigt eine kleine Vorschau des eigenen Bildes im Rahmen; dazu die Reihe der fünf Rahmen */
  baueRahmenKnopf() {
    const icon = new PIXI.Container();
    const bild = new PIXI.Sprite(this.flaeche.texture);
    const iw = RAHMEN_INNEN.x1 - RAHMEN_INNEN.x0 + 30;
    const ih = RAHMEN_INNEN.y1 - RAHMEN_INNEN.y0 + 30;
    const s = Math.max(iw / bild.texture.width, ih / bild.texture.height);
    bild.scale.set(s);
    bild.anchor.set(0.5);
    bild.position.set((RAHMEN_INNEN.x0 + RAHMEN_INNEN.x1) / 2 - 450, (RAHMEN_INNEN.y0 + RAHMEN_INNEN.y1) / 2 - 306);
    const rahmen = new PIXI.Sprite(tex('malhaus/bilderrahmen'));
    rahmen.anchor.set(0.5);
    icon.addChild(bild, rahmen);
    this.rahmenKnopf = ui.button(icon, {
      parent: this.welt, x: RAHMEN_ORT.x, y: RAHMEN_ORT.y, size: RAHMEN_GROESSE, z: 30,
      onTap: () => this.zuRahmen(),
    });
    // ui.button passt das Symbol auf 60 % ein – der Rahmen ist das Wichtigste am Knopf und darf fast bis zum Rand
    icon.scale.set(icon.scale.x * 1.4);
    this.rahmenKnopf.label = 'rahmen';

    // Rahmen-Auswahl: fünf Fächer, jedes zeigt das eigene Bild im jeweiligen Rahmen (unsichtbar bis zum Schritt)
    const pw = 172;
    const ph = Math.round(pw * (this.blatt.h / this.blatt.w));
    this.rahmenFaecher = RAHMEN.map((r, i) => {
      const f = fach(this, REIHE_X(i, RAHMEN.length, 250), REIHE_Y, {
        breite: 240, hoehe: 230, schatten: { w: 200, h: 38, y: 92 }, scheinGroesse: { w: 270, h: 220 },
      });
      const vorschau = new PIXI.Sprite(this.flaeche.texture);
      vorschau.width = pw;
      vorschau.height = ph;
      vorschau.position.set(-pw / 2, -ph / 2 - 6);
      const rahmenBild = baueRahmen(r.id, pw, ph, 16);
      const rc = new PIXI.Container();
      rc.y = -6;
      rc.addChild(rahmenBild);
      f.inhalt.addChild(vorschau, rc);
      f.label = 'rahmenWahl:' + r.id;
      f.art = r.id;
      tap(f, () => this.waehleRahmen(r.id), { sound: null });
      f.visible = false;
      f.alpha = 0;
      f.eventMode = 'none';
      f._heimY = REIHE_Y;
      f.y = REIHE_Y + 70;
      return f;
    });
  }

  /** Genug gemalt: der Rahmen-Knopf lädt einmal sanft ein (goldener Ring, ruhiges Atmen, leises Funkeln) */
  ladeZumRahmen() {
    if (this.rahmenBereit || !this.rahmenKnopf || this.phase !== 'malen') return;
    this.rahmenBereit = true;
    this.rahmenKnopf.markiere(true);
    this._rahmenAtmen?.stop();
    const atmen = fx.pulse(this.rahmenKnopf, { staerke: 0.07, periode: 1.6 });
    this._rahmenAtmen = atmen;
    this.after(4.8, () => { atmen.stop(); if (this._rahmenAtmen === atmen) this._rahmenAtmen = null; });
    this.after(0.4, () => { if (this.aktiv) sfx('common/funkeln', { vol: 0.25 }); });
  }

  /** Einladung zurücknehmen (nach dem Rahmen-Schritt oder auf leerem Blatt) */
  rahmenRuhig() {
    this.rahmenBereit = false;
    this._rahmenAtmen?.stop();
    this._rahmenAtmen = null;
    this.rahmenKnopf?.markiere(false);
  }

  /** ein Ding eine Weile sanft pulsieren lassen (Hinweis auf den nächsten Schritt) */
  pulsiere(obj, sek = 4) {
    if (!obj || obj.destroyed) return;
    obj._puls?.stop();
    const p = fx.pulse(obj, { staerke: 0.06, periode: 1.5 });
    obj._puls = p;
    this.after(sek, () => { p.stop(); if (obj._puls === p) obj._puls = null; });
  }

  // --- Farbtöpfe (Seite 1 und 2) ---

  baueToepfe(onWahl) {
    // zwei Holzleisten an der Staffelei, auf denen die Töpfe stehen
    for (const seite of [-1, 1]) {
      const x = seite * TOPF_X;
      const g = new PIXI.Graphics();
      g.roundRect(x - 92, 238, 184, 1050, 26).fill(0xe2ae76).stroke({ width: 6, color: 0xb98049 });
      g.roundRect(x - 70, 262, 140, 1000, 18).fill({ color: 0xffffff, alpha: 0.08 });
      for (const y of TOPF_Y) {
        g.roundRect(x - 98, y + 66, 196, 20, 10).fill(0xc78a50).stroke({ width: 3, color: 0xa86f3a });
      }
      // kleine Füße auf dem Boden
      g.roundRect(x - 80, 1282, 40, 26, 10).fill(0xb98049);
      g.roundRect(x + 40, 1282, 40, 26, 10).fill(0xb98049);
      g.zIndex = 10;
      this.welt.addChild(g);
    }
    this.toepfe = FARBEN.map((f, i) => {
      const seite = i < 5 ? -1 : 1;
      const x = seite * TOPF_X;
      const y = TOPF_Y[i % 5];
      const t = fach(this, x, y, { breite: 200, hoehe: 200, scheinGroesse: { w: 230, h: 200 } });
      const topf = new PIXI.Sprite(tex('malhaus/farbtopf'));
      topf.anchor.set(0.5);
      const s = 165 / 360;
      topf.scale.set(s);
      topf.tint = hell(f.rgb, 0.5);
      // Farbe im Topf (Oberfläche 152/110, Halbachsen 108/72 im Bild 360×334)
      const ox = (152 - 180) * s;
      const oy = (110 - 167) * s;
      const farbe = new PIXI.Graphics()
        .ellipse(ox, oy, 102 * s, 66 * s).fill(f.rgb)
        .ellipse(ox - 22 * s, oy - 18 * s, 44 * s, 20 * s).fill({ color: 0xffffff, alpha: 0.32 });
      t.inhalt.addChild(topf, farbe);
      t.label = 'topf:' + f.id;
      tap(t, () => onWahl(i), { sound: null, hitArea: new PIXI.Rectangle(-100, -100, 200, 200) });
      return t;
    });
  }

  zeigeFarbe(i, sofort = false) {
    this.toepfe?.forEach((t, k) => { if ((k === i) !== t.gewaehlt || sofort) t.markiere(k === i, sofort); });
  }

  /** Farbtopf gewählt (Seite 1 und 2 teilen sich die Wahl) */
  waehleFarbe(i) {
    this.tatHier = true;
    // im Rahmen-Schritt: ein Topf heißt „ich will noch weiter malen"
    if (this.phase === 'rahmen' || this.phase === 'geben') this.zurueckZumMalen();
    const neu = this.szene.farbe !== i;
    this.szene.farbe = i;
    this.zeigeFarbe(i);
    sfx('common/plopp', { vol: 0.55, rate: 0.9 + (i % 5) * 0.06 });
    if (!neu) fx.wobble(this.toepfe[i].inhalt, 0.06);
    this.farbeGewaehlt?.(i);
  }

  // --- neues Blatt: weich aus- und wieder einblenden (Ruhe-Regel: Helligkeit ändert sich nie schneller als 0,5 s) ---

  neuesBlattTippen() {
    // während das Blatt gerade ausgetauscht wird (Bildwechsel auf Seite 1, Bild fliegt zum Besuch) nur wackeln
    if (this._leert || this._wechselt || this.phase === 'fertig') {
      fx.wobble(this.neuKnopf, 0.05);
      return;
    }
    if (this.phase !== 'malen') this.zurueckZumMalen();
    this._leert = true;
    sfx('common/wusch', { vol: 0.5 });
    const sp = this.flaeche.sprite;
    this.tween(sp, { alpha: 0 }, 0.5, { ease: 'sineInOut' }).then(() => {
      this.leereBlatt();
      this.rahmenRuhig();
      this.gemacht = 0;
      this.tween(sp, { alpha: 1 }, 0.55, { ease: 'sineInOut' }).then(() => { this._leert = false; });
    });
  }

  leereBlatt() {
    this.flaeche.leere();
  }

  /** Mitzählen, was das Kind macht; ab `genug` lädt der Rahmen ein */
  mitzaehlen(n, genug) {
    this.gemacht = (this.gemacht || 0) + n;
    if (this.gemacht >= genug) this.ladeZumRahmen();
  }

  /** Ist schon etwas auf dem Blatt? (sonst gibt es nichts zu rahmen) */
  hatGemalt() {
    return (this.gemacht || 0) > 0;
  }

  // ---------------------------------------------------------------- Runden mit Besuch

  /** Neue Runde: Wunsch ziehen, Blatt vorbereiten, Besuch holen */
  starteRunde() {
    this.naechsteRunde();
    this.holeBesuch(0.5);
  }

  /** Wunsch ziehen und die Seite für ihn vorbereiten (das Blatt ist leer) */
  naechsteRunde() {
    const w = naechsterWunsch(this.constructor.WUENSCHE, this.wunsch, (this.beutel ||= []));
    this.wunsch = w;
    this.wunschDa = false;
    this.rundenNr++;
    this.rahmenRuhig();
    this.gemacht = 0;
    this.rundeVorbereiten(w);
  }

  /**
   * Der Besuch zur aktuellen Runde kommt herein und zeigt seinen Wunsch. Erst wenn er steht, geht es nach einer
   * Abgabe weiter (Phase 'fertig' → 'malen', die Reihe der Seite kommt wieder) – so wartet kein Bild auf einen Besuch,
   * der gerade geht.
   */
  holeBesuch(warte = 0.2) {
    const runde = this.rundenNr;
    const w = this.wunsch;
    this.after(warte, () => {
      if (runde !== this.rundenNr) return;
      this.besuch.komm(w.tier).then((ok) => {
        if (this.phase === 'fertig') this.weiterMalen();
        if (!ok || runde !== this.rundenNr) return;
        this.besuch.zeigeWunsch(this.wunschInhalt(w));
        this.wunschDa = true;
        this.rundeBeginnt(w);
        voice('malhaus_besuch', { nurWenn: () => this.aktiv && this.phase === 'malen' });
      });
    });
  }

  besuchGetippt() {
    this.tatHier = true;
    if (this.phase === 'geben') {
      this.gibBild();
      return;
    }
    if (this.wunschDa) this.wunschZeigen?.();
  }

  /** Was passiert mit einem Finger auf dem Blatt in den Schritten Rahmen/Geben? → true = erledigt */
  blattImAblauf() {
    if (this.phase === 'geben') {
      this.gibBild();
      return true;
    }
    if (this.phase === 'rahmen') {
      const f = this.rahmenFaecher.find((r) => r.visible);
      if (f) fx.wobble(f.inhalt, 0.05);
      sfx('common/tipp', { vol: 0.5 });
      return true;
    }
    if (this.phase === 'fertig') {
      // das Bild ist abgegeben, der nächste Besuch kommt gleich: das Blatt wackelt nur freundlich
      this.staffeleiTippen();
      return true;
    }
    return false;
  }

  // --- Reihen tauschen (Phasen auf derselben Seite) ---

  zeigeReihe(liste, an) {
    for (const c of liste || []) {
      if (c._heimY === undefined) c._heimY = c.y;
      if (an) {
        c.visible = true;
        c.eventMode = 'static';
        this.tween(c, { alpha: 1, y: c._heimY }, 0.45, { ease: 'sineInOut' });
      } else {
        c.eventMode = 'none';
        this.tween(c, { alpha: 0, y: c._heimY + 70 }, 0.4, { ease: 'sineInOut' }).then((ok) => {
          if (ok) c.visible = false;
        });
      }
    }
  }

  // --- Schritt: Rahmen aussuchen ---

  zuRahmen() {
    this.tatHier = true;
    if (this.phase === 'rahmen' || this.phase === 'geben') {
      // noch einmal: zurück zum Malen (nichts geht verloren)
      this.zurueckZumMalen();
      return;
    }
    if (this.phase !== 'malen' || this._leert || this._wechselt || !this.hatGemalt() || !this.wunschDa) {
      // leeres Blatt (oder der Besuch ist noch nicht da): freundlich wackeln, die Hand zeigt gleich, was zu tun ist
      fx.wobble(this.rahmenKnopf, 0.06);
      sfx('common/tipp', { vol: 0.5 });
      return;
    }
    this.phase = 'rahmen';
    this.rahmenRuhig();
    this.szene.finger?.allesLos(this);
    this.fingerWeg?.();
    this.rahmenKnopf.markiere(true);
    sfx('common/wusch', { vol: 0.45 });
    this.zeigeReihe(this.reihe, false);
    // jede Runde in anderer Reihenfolge
    const xs = RAHMEN.map((_, i) => REIHE_X(i, RAHMEN.length, 250));
    const reihenfolge = shuffle([...this.rahmenFaecher]);
    reihenfolge.forEach((f, i) => { f.x = xs[i]; f.markiere(false, true); });
    this.zeigeReihe(this.rahmenFaecher, true);
    voice('malhaus_rahmen_aussuchen', { nurWenn: () => this.aktiv && this.phase === 'rahmen' });
  }

  waehleRahmen(art) {
    this.tatHier = true;
    if (this.phase !== 'rahmen' && this.phase !== 'geben') return;
    const f = this.rahmenFaecher.find((r) => r.art === art);
    if (art === this.rahmenArt && this.phase === 'geben') {
      fx.wobble(f.inhalt, 0.06);
      sfx('common/tipp', { vol: 0.5 });
      return;
    }
    this.rahmenArt = art;
    this.rahmenFaecher.forEach((r) => { if ((r === f) !== r.gewaehlt) r.markiere(r === f); });
    this.setzeOverlay(art);
    sfx('common/plopp', { vol: 0.55 });
    const b = this.blatt;
    this.after(0.35, () => {
      if (this.aktiv) sfx('common/funkeln', { vol: 0.3 });
      this.burst('funkeln', b.x + 40, b.y + 40, { count: 3 });
      this.burst('funkeln', b.x + b.w - 40, b.y + b.h - 40, { count: 3 });
    });
    const erstes = this.phase === 'rahmen';
    this.phase = 'geben';
    if (erstes) {
      this.besuch.nicke();
      this.besuch.zeigeWunsch(blasenKarte('malhaus/stempel_herz', { breite: 120, hoehe: 110, rand: false }));
      const nurWenn = () => this.aktiv && this.phase === 'geben';
      if (!this.szene.gerahmt) voice('malhaus_rahmen', { nurWenn });
      this.after(this.szene.gerahmt ? 1.2 : 4.5, () => { if (nurWenn()) voice('malhaus_geben', { nurWenn }); });
    }
  }

  /** Rahmen auf das Blatt der Staffelei legen (weich ein, der alte weich aus) */
  setzeOverlay(art) {
    const b = this.blatt;
    const alt = this.overlay;
    if (alt) {
      this.tween(alt, { alpha: 0 }, 0.35, { ease: 'sineInOut' })
        .then(() => { if (!alt.destroyed && alt !== this.overlay) alt.destroy({ children: true }); });
    }
    const c = new PIXI.Container({ label: 'rahmenAufBlatt' });
    c.zIndex = 8;
    c.eventMode = 'none';
    c.position.set(b.x + b.w / 2, b.y + b.h / 2);
    const e = RAHMEN_AUF_BLATT.einzug;
    c.addChild(baueRahmen(art, b.w - 2 * e, b.h - 2 * e, RAHMEN_AUF_BLATT.dicke));
    c.alpha = 0;
    c.scale.set(1.03);
    this.welt.addChild(c);
    this.tween(c, { alpha: 1, scale: 1 }, 0.5, { ease: 'sineInOut' });
    this.overlay = c;
  }

  /** Zurück vom Rahmen-Schritt zum Malen: Rahmen weg, Reihe der Seite wieder da */
  zurueckZumMalen() {
    if (this.phase !== 'rahmen' && this.phase !== 'geben') return;
    this.phase = 'malen';
    this.rahmenArt = null;
    const alt = this.overlay;
    this.overlay = null;
    if (alt) {
      this.tween(alt, { alpha: 0 }, 0.4, { ease: 'sineInOut' })
        .then(() => { if (!alt.destroyed) alt.destroy({ children: true }); });
    }
    this.rahmenKnopf.markiere(false);
    this.zeigeReihe(this.rahmenFaecher, false);
    this.zeigeReihe(this.reihe, true);
    if (this.wunschDa) this.besuch.zeigeWunsch(this.wunschInhalt(this.wunsch));
    sfx('common/wusch', { vol: 0.4 });
  }

  // --- Schritt: Bild dem Besuch geben → es fliegt an die Galerie-Leine ---

  gibBild() {
    if (this.phase !== 'geben') return;
    // nur dem Besuch, der sich dieses Bild gewünscht hat und gerade dasteht
    if (!this.wunschDa || !this.besuch.da || this.besuch.tier !== this.wunsch?.tier) {
      if (this.overlay) fx.wobble(this.overlay, 0.03);
      return;
    }
    this.phase = 'fertig';
    this._fertigSeit = 0;
    const gast = this.besuch.actor;
    this.rahmenRuhig();
    this.rahmenKnopf.markiere(false);
    this.szene.finger?.allesLos(this);
    this.fingerWeg?.();
    const b = this.blatt;
    const art = this.rahmenArt || 'gold';
    this.rahmenArt = null;
    const { eintrag, index } = galerieNeu(this.flaeche.canvas, art);
    this.leine.verstecke(index, true);
    this._neuPlatz = index;

    // fliegendes Bild: zuerst mit der Leinwand selbst (scharf), unterwegs mit dem kleinen Galerie-Bild
    const flug = new PIXI.Container({ label: 'flug' });
    flug.zIndex = 90;
    flug.eventMode = 'none';
    flug.position.set(b.x + b.w / 2, b.y + b.h / 2);
    const e = RAHMEN_AUF_BLATT.einzug;
    const papier = new PIXI.Sprite(this.flaeche.texture);
    papier.anchor.set(0.5);
    papier.width = b.w;
    papier.height = b.h;
    flug.addChild(papier);
    const ov = this.overlay;
    this.overlay = null;
    if (ov) {
      ov.position.set(0, 0);
      ov.scale.set(1);
      ov.alpha = 1;
      flug.addChild(ov);
    } else {
      flug.addChild(baueRahmen(art, b.w - 2 * e, b.h - 2 * e, RAHMEN_AUF_BLATT.dicke));
    }
    this.welt.addChild(flug);
    this.flaeche.sprite.visible = false;   // darunter liegt das weiße Blatt des Hintergrunds
    this.zeigeReihe(this.rahmenFaecher, false);
    sfx('common/wusch', { vol: 0.5 });

    // Das Bild hält rechts neben dem Tier an (hinter den Herzen, das Tier bleibt beim Freuen ganz zu sehen).
    // 1,6 s für ~1100 Einheiten: höchstens ~1100 Einheiten/s in der Mitte des Flugs
    const h = this.besuch.zeigeOrt;
    const s1 = 250 / b.w;
    this.tween(flug, { x: h.x, y: h.y, scale: s1 }, 1.6, { ease: 'sineInOut' }).then((ok) => {
      if (!ok || flug.destroyed) return;
      papier.texture = eintrag.klein.texture;
      papier.width = b.w;
      papier.height = b.h;
      this.besuch.freu();
      this.besuch.wunschWeg();
      this.leeresBlattNachAbgabe();
      const runde = this.rundenNr;
      this.wait(1.1).then(() => {
        if (flug.destroyed) return;
        const ziel = this.leine.ort(index);
        const s2 = this.leine.bildGroesse.w / (b.w - 2 * e);
        const weg = Math.hypot(ziel.x - flug.x, ziel.y - flug.y);
        const dauer = clamp(weg / 820, 1.2, 3.2);
        sfx('common/wusch', { vol: 0.35, rate: 1.1 });
        this.tween(flug, { x: ziel.x, y: ziel.y, scale: s2 }, dauer, { ease: 'sineInOut' }).then((ok2) => {
          if (!ok2 || flug.destroyed) return;
          flug.destroy({ children: true });
          this.leine.verstecke(index, false);
          this.leine.schaukel(index, 0.1);
          sfx('common/klack', { vol: 0.5 });
          this.burst('funkeln', ziel.x, ziel.y, { count: 4 });
          this.szene.gerahmt = true;
          belohne(this, 'malhaus_regenbogen', clamp(ziel.x, -650, 650), 480);
          voice('malhaus_aufhaengen', { nurWenn: () => this.aktiv });
          this.ueberraschung(ziel);
          // Der Besuch geht (nur genau dieser), dann kommt der nächste – alles an diese Runde gebunden
          this.wait(1.2)
            .then(() => (runde === this.rundenNr ? this.besuch.geh(gast) : false))
            .then(() => this.wait(0.3))
            .then(() => { if (runde === this.rundenNr && this.phase === 'fertig') this.holeBesuch(0); });
        });
      });
    });
  }

  /**
   * Nach dem Abgeben: frisches Blatt und der nächste Wunsch sind vorbereitet. Die Seite bleibt in der Phase 'fertig'
   * (Reihe versteckt, Tipps aufs Blatt wackeln nur), bis der nächste Besuch steht (siehe holeBesuch).
   */
  leeresBlattNachAbgabe() {
    this.flaeche.leere();
    this.naechsteRunde();
    const sp = this.flaeche.sprite;
    sp.alpha = 0;
    sp.visible = true;
    this.tween(sp, { alpha: 1 }, 0.6, { ease: 'sineInOut' });
  }

  /** Der neue Besuch steht: weiter geht's mit Malen, die Reihe der Seite kommt wieder */
  weiterMalen() {
    if (this.phase !== 'fertig') return;
    this.phase = 'malen';
    this._fertigSeit = 0;
    this.zeigeReihe(this.reihe, true);
  }

  /** kleine ruhige Überraschung nach dem Aufhängen (nicht jedes Mal) */
  ueberraschung(ziel) {
    const r = Math.random();
    const d = this.deko;
    if (r < 0.35 && d?.katze && !d.katze.destroyed) {
      // die Katze wacht auf und freut sich mit
      this.after(0.8, () => {
        d.katzeWach = 6;
        d.katze.pose('idle');
        d.katze.cheer({ parent: this.vorn });
      });
    } else if (r < 0.6 && d?.sm) {
      // der Schmetterling besucht das neue Bild (gemächlich)
      d.sm.ziel = { x: ziel.x + 20, y: ziel.y - 30, setzen: true };
      d.sm.sitzt = false;
      d.sm.tempo = 160;
    } else if (r < 0.82) {
      // der Besuch tanzt vor Freude: ein Hüpfer, ein paar Noten, eine kleine Melodie
      const a = this.besuch.actor;
      this.after(0.2, () => {
        if (!a || a.destroyed || a !== this.besuch.actor) return;
        a.hop(60);
        const k = a.point('kopf');
        this.burst('noten', k.x, k.y, { count: 3 });
      });
      [72, 76, 79].forEach((n, i) => this.after(0.25 + i * 0.3, () => { if (this.aktiv) note('glocke', n, { vol: 0.15 }); }));
    }
  }

  // --- Ablauf der Seite ---

  betreten() {
    this.zeigeFarbe(this.szene.farbe, true);
    // tatHier: das Kind hat auf dieser Seite seit dem Betreten schon etwas gewählt oder aufs Blatt gebracht –
    // dann braucht es den Hinweis der Seite nicht mehr
    this.tatHier = false;
    this.szene.sprich(this);
    this.leine.sync();
    if (!this.wunsch) this.starteRunde();
  }

  verlassen() {
    this._hinweis?.kill();
    this._hinweis = null;
    this.szene.finger?.allesLos(this);
    this.fingerWeg?.();
    // das Atmen endet beim Wegblättern; der goldene Ring bleibt als ruhige Einladung
    this._rahmenAtmen?.stop();
    this._rahmenAtmen = null;
  }

  update(dt, t) {
    this.flaeche?.auffrischen();
    this.deko?.update(dt, t);
    this.leine?.update(dt);
    this.besuch?.update(dt);
    this.staffeleiRuhe -= dt;
    // Notausgang (keine Sackgasse): hängt der Wechsel zum nächsten Besuch einmal, geht es nach 20 s trotzdem weiter
    if (this.phase === 'fertig') {
      this._fertigSeit = (this._fertigSeit || 0) + dt;
      if (this._fertigSeit > 20) {
        this._fertigSeit = 0;
        if (this.wunschDa) this.weiterMalen();
        else this.holeBesuch(0);
      }
    }
  }

  resize(W, H) {
    this.besuch?.anpassen();
  }

  /** Zeige-Hand: im Rahmen-Schritt und beim Geben gemeinsam, sonst je Seite (malHinweise) */
  hinweise() {
    if (this.phase === 'rahmen') {
      const f = [...this.rahmenFaecher].sort((a, b) => a.x - b.x);
      return [f[0], f[3]];
    }
    if (this.phase === 'geben') {
      const h = this.besuch.haende;
      if (!this.besuch.da) return [this.blattMitte];
      return [{ von: this.blattMitte, nach: { x: h.x + 60, y: h.y - 40 } }, this.besuch.actor];
    }
    if (this.phase === 'fertig') {
      // kurz warten, bis der nächste Besuch da ist: das neue Bild an der Leine darf schaukeln
      const c = this.leine.plaetze[this._neuPlatz];
      return c && c.visible ? [c] : [];
    }
    return this.malHinweise();
  }

  /** Seiten-Koordinaten eines Pixi-Ereignisses */
  ort(e) {
    return this.welt.toLocal(e.global);
  }
}

// ---------------------------------------------------------------- Seite 1: Ausmalen

class Ausmalen extends MalSeite {
  static WUENSCHE = WUENSCHE_AUSMALEN;
  satz = 'malhaus_ausmalen';

  aufbau() {
    this.grundAufbau();
    // Leinwand im Seitenverhältnis des Blatts: Farbe reicht bis an jeden Rand (das Linienbild wird minimal gestreckt)
    const b = this.blatt;
    this.flaeche = new Malflaeche(this, 'ausmalen', b, Math.round(b.w), Math.round(b.h));
    this.malbild = new Malbild(this.flaeche.ctx, this.flaeche.w, this.flaeche.h);
    this.baueRahmenKnopf();
    this.baueToepfe((i) => this.waehleFarbe(i));

    this.farbenJeBild = new Map();  // Bild → Map(Fläche → Farbe) – bleibt beim Bildwechsel erhalten
    this.belohnt = new Set();
    this.zug = 0;
    this.ploppRuhe = 0;
    this.getippt = 0;               // wie oft gefärbt (für die Zeige-Hand)
    this.schritt = 'motiv';         // 'motiv' → 'farbe' → 'malen'

    // Wellen beim Füllen (kleiner Vorrat, nichts entsteht pro Bild)
    this.wellen = [0, 1, 2, 3].map(() => {
      const g = new PIXI.Graphics().circle(0, 0, 40).stroke({ width: 10, color: 0xffffff });
      g.visible = false;
      g.zIndex = 50;
      g.eventMode = 'none';
      this.welt.addChild(g);
      return g;
    });
    this.welleNr = 0;

    // die acht Ausmalbilder unten als kleine Vorschau
    this.karten = BILDER.map((id, i) => {
      const k = fach(this, REIHE_X(i, BILDER.length), REIHE_Y, {
        breite: REIHE_ABSTAND, hoehe: 230, schatten: { w: 200, h: 38, y: 86 }, scheinGroesse: { w: 250, h: 210 },
      });
      const karte = new PIXI.Graphics()
        .roundRect(-99, -70, 198, 140, 15).fill(0xffffff).stroke({ width: 5, color: 0xd9c4a0 });
      const bild = new PIXI.Sprite(tex('malhaus/' + id));
      bild.anchor.set(0.5);
      bild.scale.set(186 / bild.texture.width);
      k.inhalt.addChild(karte, bild);
      k.label = 'bild:' + id;
      tap(k, () => this.waehleBild(i), { sound: null });
      return k;
    });
    this.reihe = this.karten;

    this.flaeche.sprite.on('pointerdown', (e) => this.tippe(e));
    // Alle Bilder werden in Ruhe stückweise zerlegt (siehe update) – auch das gewählte: Es zeigt bis dahin seine
    // Linien (sieht genauso aus), so verlängert das Rechnen weder das Laden noch das Blättern zu dieser Seite.
    this.vorarbeit = null;  // { id, schritte, ms } – das Bild, das gerade stückweise zerlegt wird
    this.angezeigt = null;  // Bild, das wirklich auf dem Blatt liegt (beim Bildwechsel erst nach dem Ausblenden neu)
    this.d = null;          // seine Flächen (null, solange es noch zerlegt wird)
    this.bildNr = -1;
    this.farben = null;
  }

  // --- Runde ---

  wunschInhalt(w) {
    const c = new PIXI.Container();
    const karte = blasenKarte('malhaus/' + w.bild, { breite: 150, hoehe: 100 });
    karte.y = -8;
    const klecks = farbKlecks(FARBEN[w.farbe].rgb, 24);
    klecks.position.set(64, 40);
    c.addChild(karte, klecks);
    return c;
  }

  /** Neues, leeres Blatt für den nächsten Wunsch (kein Bild gewählt) */
  rundeVorbereiten() {
    // alle Bilder wieder weiß (auch die, die das Kind in der Runde zuvor angemalt und dann gewechselt hat)
    this.farbenJeBild.clear();
    this.belohnt.clear();
    this.zug++;                // ein laufender Bildwechsel legt nichts mehr hin
    this._wechselt = false;
    this._tausch = false;
    this._nachholen = null;
    this.angezeigt = null;
    this.d = null;
    this.farben = null;
    this.bildNr = -1;
    this.getippt = 0;
    this.karten.forEach((k) => { if (k.gewaehlt) k.markiere(false); });
    this.flaeche.leere();
    this.schritt = 'motiv';
  }

  rundeBeginnt(w) {
    if (this.schritt === 'motiv') this.pulsiere(this.karten[BILDER.indexOf(w.bild)]?.inhalt, 4.5);
  }

  /** Besuch oder Blase angetippt: der Wunsch wird noch einmal gezeigt */
  wunschZeigen() {
    const w = this.wunsch;
    if (this.schritt === 'motiv') this.pulsiere(this.karten[BILDER.indexOf(w.bild)]?.inhalt, 3);
    else this.pulsiere(this.toepfe[w.farbe]?.inhalt, 3);
  }

  hatGemalt() {
    return !!this.farben && this.farben.size > 0;
  }

  schluessel(id) {
    return `${id}:${this.flaeche.w}x${this.flaeche.h}`;
  }

  /**
   * Zerlegen in kleinen Stücken, nie während des Blätterns: zuerst das Bild auf dem Blatt (je Bild höchstens
   * ZEIT_ANGEZEIGT ms), dann die übrigen (je Bild höchstens ZEIT_JE_BILD ms). Nach ein paar Sekunden liegen alle
   * acht Bilder bereit (und bleiben es über Besuche hinweg); dann wird der Arbeitsspeicher freigegeben.
   */
  zerlegeVorrat() {
    if (this.szene.gleitet) return;
    const vorne = this.angezeigt && !this.d ? this.angezeigt : null;
    if (vorne) {
      const fertig = ZERLEGT.get(this.schluessel(vorne));
      if (fertig) {
        this.datenDa(fertig);
        return;
      }
      // ein anderes Bild war in Arbeit: verwerfen (der Arbeitsspeicher wird geteilt), später neu beginnen
      if (this.vorarbeit && this.vorarbeit.id !== vorne) this.vorarbeit = null;
    }
    if (!this.vorarbeit) {
      // zuerst das Wunschbild des Besuchs, dann die übrigen
      const wunschId = this.wunsch?.bild;
      const id = vorne || (wunschId && !ZERLEGT.has(this.schluessel(wunschId)) ? wunschId : null) ||
        BILDER.find((b) => !ZERLEGT.has(this.schluessel(b)));
      if (!id) {
        gibArbeitFrei();
        return;
      }
      const quelle = tex('malhaus/' + id).source.resource;
      this.vorarbeit = { id, schritte: zerlegeSchritte(quelle, this.flaeche.w, this.flaeche.h), ms: 0 };
    }
    const v = this.vorarbeit;
    const zeit = v.id === vorne ? ZEIT_ANGEZEIGT : ZEIT_JE_BILD;
    const t0 = performance.now();
    let r;
    do {
      r = v.schritte.next();
    } while (!r.done && performance.now() - t0 < zeit);
    v.ms += performance.now() - t0;
    if (r.done) {
      r.value.ms = Math.round(v.ms);
      ZERLEGT.set(this.schluessel(v.id), r.value);
      this.vorarbeit = null;
      if (v.id === this.angezeigt && !this.d) this.datenDa(r.value);
    }
  }

  /** Die Flächen des Bildes auf dem Blatt sind da: ab jetzt lässt es sich färben (sichtbar ändert sich nichts) */
  datenDa(d) {
    this.d = d;
    this.malbild.setze(tex('malhaus/' + this.angezeigt).source.resource, d, this.farben);
    this.flaeche.schmutzig = true;
  }

  /** Bild zerlegen (oder aus dem Vorrat) */
  holeDaten(id) {
    const k = this.schluessel(id);
    let d = ZERLEGT.get(k);
    if (d) return d;
    const t0 = performance.now();
    const v = this.vorarbeit;
    this.vorarbeit = null;
    if (v && v.id === id) {
      // wird gerade vorab zerlegt: den Rest jetzt in einem Zug
      let r = v.schritte.next();
      while (!r.done) r = v.schritte.next();
      d = r.value;
    } else {
      // ein anderes Bild war in Arbeit: verwerfen (der Arbeitsspeicher wird geteilt), später neu beginnen
      d = zerlege(tex('malhaus/' + id).source.resource, this.flaeche.w, this.flaeche.h);
    }
    d.ms = Math.round(performance.now() - t0);
    ZERLEGT.set(k, d);
    return d;
  }

  waehleBild(i, sofort = false) {
    // Gleiches Bild – oder „neues Blatt" blendet gerade aus und ein: nur freundlich wackeln. (Sonst würde das
    // Leeren erst nach dem Wechsel greifen und das falsche Bild treffen.)
    if (!sofort) this.tatHier = true;
    if (i === this.bildNr || this._leert) {
      fx.wobble(this.karten[i].inhalt, 0.05);
      sfx('common/tipp', { vol: 0.6 });
      return;
    }
    this.bildNr = i;
    this.karten.forEach((k, n) => k.markiere(n === i, sofort));
    const zug = ++this.zug;
    const id = BILDER[i];
    // Schritt geschafft: jetzt die Lieblingsfarbe (der Besuch nickt, auch bei einem anderen Bild – alles ist recht)
    if (this.schritt === 'motiv') {
      this.schritt = 'farbe';
      if (this.wunschDa) {
        this.besuch.nicke();
        this.after(1.1, () => { if (this.schritt === 'farbe') this.pulsiere(this.toepfe[this.wunsch.farbe]?.inhalt, 4); });
      }
    }
    const lege = () => {
      if (zug !== this.zug || this.szene.alive === false) return;
      // Bild, Farben und Flächen wechseln immer gemeinsam – alles Weitere richtet sich nach this.angezeigt
      this.angezeigt = id;
      if (!this.farbenJeBild.has(id)) this.farbenJeBild.set(id, new Map());
      this.farben = this.farbenJeBild.get(id);
      const quelle = tex('malhaus/' + id).source.resource;
      const d = ZERLEGT.get(this.schluessel(id));
      if (d) {
        this.d = d;
        this.malbild.setze(quelle, d, this.farben);
      } else {
        // noch nicht zerlegt: erst die Linien, die Flächen kommen in den nächsten Bildern (siehe zerlegeVorrat)
        this.d = null;
        this.malbild.nurLinien(quelle);
      }
      this.flaeche.schmutzig = true;
      // fertig bemalt? Dann lädt der Rahmen wieder ein
      if (this.belohnt.has(id)) this.ladeZumRahmen();
      else this.rahmenRuhig();
      this.nachholen();
    };
    if (sofort) {
      lege();
      return;
    }
    sfx('common/wusch', { vol: 0.45 });
    const sp = this.flaeche.sprite;
    this._wechselt = true;
    this._tausch = true;   // Tipps bis zum Tausch gelten schon dem neuen Bild (siehe tippe)
    // weich: 0,5 s aus, 0,55 s ein (große helle Fläche – nie schneller)
    this.tween(sp, { alpha: 0 }, 0.5, { ease: 'sineInOut' }).then(() => {
      if (zug !== this.zug) return;
      lege();
      sfx('common/plopp', { vol: 0.45 });
      this.tween(sp, { alpha: 1 }, 0.55, { ease: 'sineInOut' }).then(() => {
        if (zug === this.zug) this._wechselt = false;
      });
    });
  }

  farbeGewaehlt(i) {
    if (this.schritt === 'farbe') this.schritt = 'malen';
    if (this.wunschDa && i === this.wunsch.farbe) this.besuch.nicke();
  }

  tippe(e) {
    this.tatHier = true;
    if (this.blattImAblauf()) return;
    const p = this.ort(e);
    if (!this.angezeigt && !this._tausch) {
      // noch kein Bild auf dem Blatt: ein weicher Ring als Antwort, das Wunschbild in der Reihe wackelt
      this.welle(p.x, p.y, FARBEN[this.szene.farbe].rgb);
      sfx('common/tipp', { vol: 0.5 });
      const k = this.karten[BILDER.indexOf(this.wunsch?.bild)] || this.karten[1];
      fx.wobble(k.inhalt, 0.06);
      return;
    }
    // Das Blatt wird gerade ausgetauscht (neues Bild oder „neues Blatt", noch vor dem Tausch): Der Tipp gilt dem
    // Blatt, das gleich kommt. Sofort ein weicher Ring als Antwort (kein Ton – das Wusch läuft schon), gefärbt wird,
    // sobald das neue Blatt liegt.
    if (this._tausch) {
      this.welle(p.x, p.y, FARBEN[this.szene.farbe].rgb);
      const n = (this._nachholen ||= []);
      if (n.length < 4) n.push({ x: p.x, y: p.y, farbe: this.szene.farbe });
      return;
    }
    if (this.schritt === 'farbe') this.schritt = 'malen';
    this.male(p, this.szene.farbe);
  }

  /** Die Fläche an der Stelle p (Seiten-Koordinaten) in Farbe Nr. farbe füllen. leise: ohne Ton und Ring (Nachholen) */
  male(p, farbe, leise = false) {
    if (!this.angezeigt) return;
    // Tippt das Kind, bevor das Bild fertig zerlegt ist (nur in der ersten Sekunde möglich): den Rest jetzt rechnen
    if (!this.d) this.datenDa(this.holeDaten(this.angezeigt));
    const q = this.flaeche.inLeinwand(p.x, p.y);
    const l = flaecheBei(this.d, q.x, q.y);
    if (l < 0) {
      if (!leise) sfx('common/tipp', { vol: 0.5 });
      return;
    }
    const f = FARBEN[farbe];
    const vorher = this.farben.get(l);
    this.farben.set(l, f.rgb);
    if (vorher !== f.rgb) {
      this.malbild.faerbe(l, f.rgb);
      this.flaeche.schmutzig = true;
      this.getippt++;
      if (this.wunschDa && farbe === this.wunsch.farbe) this.besuch.nicke();
    }
    if (!leise) {
      if (this.ploppRuhe <= 0) {
        this.ploppRuhe = 0.09;
        sfx('common/plopp', { vol: 0.6, rate: rand(0.92, 1.12) });
      }
      this.welle(p.x, p.y, f.rgb);
    }
    this.pruefeFertig();
  }

  /** Das neue Blatt liegt: die Tipps aus der Zwischenzeit jetzt ausführen (der Plopp des Blatts ist ihr Ton) */
  nachholen() {
    this._tausch = false;
    const n = this._nachholen;
    this._nachholen = null;
    if (!n || !this.aktiv) return;
    for (const t of n) this.male(t, t.farbe, true);
  }

  neuesBlattTippen() {
    const vorher = this._leert || this._wechselt;
    super.neuesBlattTippen();
    // Ab jetzt bis zum Leeren gelten Tipps dem leeren Blatt (sonst würden sie gleich wieder weggewischt)
    if (!vorher && this._leert && this.angezeigt) this._tausch = true;
  }

  verlassen() {
    super.verlassen();
    this._nachholen = null;   // wer weggeblättert hat, malt nicht mehr nachträglich
  }

  // kleiner weicher Ring an der Tippstelle (in der gewählten Farbe)
  welle(x, y, rgb) {
    const g = this.wellen[this.welleNr++ % this.wellen.length];
    g.visible = true;
    g.tint = hell(rgb, 0.25);
    g.position.set(x, y);
    g.scale.set(0.4);
    g.alpha = 0.8;
    this.tween(g, { scale: 1.6, alpha: 0 }, 0.6, { ease: 'quadOut' }).then((ok) => { if (ok) g.visible = false; });
  }

  // Sind genug große Flächen bunt? Dann ein freundlicher Moment (einmal pro Bild und Runde) – danach lädt der Rahmen ein
  pruefeFertig() {
    const id = this.angezeigt;
    if (!this.d || this.belohnt.has(id)) return;
    let gross = 0;
    let bunt = 0;
    for (let l = 0; l < this.d.anzahl; l++) {
      if (this.d.kern[l] < 2500) continue;
      gross++;
      if (this.farben.has(l)) bunt++;
    }
    if (bunt < Math.min(6, Math.max(1, gross - 1))) return;
    this.belohnt.add(id);
    this.after(0.5, () => {
      const b = this.blatt;
      this.burst('funkeln', b.x + b.w / 2, b.y + b.h / 2, { count: 8 });
      voice('malhaus_schoen', { nurWenn: () => this.aktiv });   // Lob nur, solange die Seite zu sehen ist
      if (this.wunschDa) this.besuch.freu();
      belohne(this, 'malhaus_stift', b.x + b.w / 2, b.y + b.h * 0.42);
      // nur, wenn das Bild noch daliegt und nicht inzwischen ein neues Blatt genommen wurde
      this.after(2.4, () => { if (this.angezeigt === id && this.belohnt.has(id)) this.ladeZumRahmen(); });
    });
  }

  // geleert wird das Bild, das wirklich auf dem Blatt liegt (dazu gehören this.farben)
  leereBlatt() {
    const id = this.angezeigt;
    this.farben?.clear();
    this.belohnt.delete(id);
    if (this.d) this.malbild.alles(this.farben || new Map());
    else if (!id) this.flaeche.leere();
    this.flaeche.schmutzig = true;
    this.nachholen();
  }

  update(dt, t) {
    super.update(dt, t);
    this.ploppRuhe -= dt;
    this.zerlegeVorrat();
  }

  // Zeige-Hand (nur die ersten zwei Hinweise kommen vor dem Pfeil zur nächsten Seite):
  //   noch kein Bild   → das Wunschbild in der Reihe
  //   Bild gewählt     → die Lieblingsfarbe des Besuchs
  //   fertig gemalt    → Rahmen, dann ein anderes Bild
  //   sonst            → eine große, noch weiße Fläche; dann ein anderer Topf (nach ein paar Farben: ein anderes Bild)
  malHinweise() {
    const wunschKarte = this.karten[BILDER.indexOf(this.wunsch?.bild)] || this.karten[1];
    const naechstesBild = this.karten[(this.bildNr + 1) % this.karten.length];
    if (!this.angezeigt) return [wunschKarte, this.karten[(BILDER.indexOf(this.wunsch?.bild) + 2) % BILDER.length]];
    if (!this.d) {
      // Flächen noch nicht bereit (nur ganz kurz nach dem Bildwechsel): mitten aufs Blatt tippen
      const b = this.blatt;
      return [{ x: b.x + b.w * 0.5, y: b.y + b.h * 0.5 }, naechstesBild];
    }
    const ziel = this.weisseFlaeche();
    if (this.rahmenBereit || !ziel) return [this.rahmenKnopf, ziel || naechstesBild];
    if (this.schritt === 'farbe' && this.wunsch) return [this.toepfe[this.wunsch.farbe], ziel];
    const zweites = this.getippt >= 4 ? this.rahmenKnopf : this.toepfe[(this.szene.farbe + 3) % FARBEN.length];
    return [ziel, zweites];
  }

  weisseFlaeche() {
    const d = this.d;
    if (!d || !this.farben) return null;
    let best = -1;
    let bestG = 0;
    for (let l = 0; l < d.anzahl; l++) {
      if (this.farben.has(l)) continue;
      // Innenflächen bevorzugen (der Hintergrund am Bildrand zählt weniger)
      const g = d.kern[l] * (d.rand[l] ? 0.25 : 1);
      if (d.kern[l] >= 3000 && g > bestG) { bestG = g; best = l; }
    }
    if (best < 0) return null;
    const p = punktIn(d, best);
    return this.flaeche.inSeite(p.x, p.y);
  }
}

// ---------------------------------------------------------------- Seite 2: Frei malen (mit Form zum Nachspuren)

const MAL_GENUG = 2500;        // so viele Einheiten Strich nach dem Füllen, dann lädt der Rahmen ein
const SPUR_PUNKTE = 22;        // Punkte auf dem Umriss
const SPUR_RADIUS = 88;        // so nah muss ein Strich einem Punkt kommen
const SPUR_GENUG = 0.85;       // Anteil der Punkte, dann gilt die Form als nachgespurt (der Rest folgt von selbst)
const SPUR_VON_SELBST = 3600;  // so viel Strich irgendwo, dann ist die Form auch fertig (kein Festhängen)
const PENTA = [72, 74, 76, 79, 81, 84, 86, 88];

const WERKZEUGE = [
  { id: 'pinsel', tex: 'malhaus/pinsel_dick', breite: 46, groesse: 230, spitze: true },
  { id: 'stift', tex: 'malhaus/stift_dick', breite: 22, groesse: 215, spitze: true },
  { id: 'regenbogen', tex: 'malhaus/icon_freimalen', breite: 40, groesse: 250 },
  { id: 'schwamm', tex: 'malhaus/radierschwamm', breite: 120, groesse: 215 },
];

class Freimalen extends MalSeite {
  static WUENSCHE = WUENSCHE_FREI;
  satz = 'malhaus_freimalen';

  aufbau() {
    this.grundAufbau();
    const b = this.blatt;
    this.flaeche = new Malflaeche(this, 'frei', b, Math.round(b.w), Math.round(b.h));
    this.baueRahmenKnopf();
    this.baueToepfe((i) => this.waehleFarbe(i));
    this.werkzeug = 0;
    this.farbWerkzeug = 0;   // Pinsel oder Stift – dahin geht es zurück, wenn ein Topf gewählt wird
    this.hue = rand(0, 360);
    this.striche = new Map(); // pointerId → Strich
    this.tonRuhe = 0;
    this.plingRuhe = 0;
    this.plingNr = 0;
    this.schritt = 'warten';   // 'warten' → 'farbe' → 'spuren' → 'fuellen' → 'frei'
    this.spur = null;          // { form, punkte:[Graphics], geist, box }

    this.werkzeugFaecher = WERKZEUGE.map((w, i) => {
      const f = fach(this, REIHE_X(i, WERKZEUGE.length, 300), REIHE_Y - 5, {
        breite: 270, hoehe: 230, schatten: { w: 230, h: 42, y: 90 }, scheinGroesse: { w: 300, h: 230 },
      });
      const s = new PIXI.Sprite(tex(w.tex));
      s.anchor.set(0.5);
      s.scale.set(w.groesse / Math.max(s.texture.width, s.texture.height));
      f.inhalt.addChild(s);
      if (w.spitze) {
        // Die Spitze trägt die gewählte Farbe: beim Pinsel ein Farbklecks auf den Borsten,
        // beim Stift eine eingefärbte Mine (weiß gezeichnet, per tint gefärbt)
        const m = meta(w.tex);
        const k = new PIXI.Graphics();
        const P = (x, y) => [(x - m.w / 2) * s.scale.x, (y - m.h / 2) * s.scale.y];
        if (w.id === 'pinsel') {
          const [cx, cy] = P(62, 418);
          const r = s.scale.x;
          k.ellipse(0, 0, 66 * r, 44 * r).fill(0xffffff)
            .ellipse(-12 * r, -14 * r, 26 * r, 12 * r).fill({ color: 0xffffff, alpha: 0.5 });
          k.position.set(cx, cy);
          k.rotation = -0.9;
        } else {
          // Mine des Wachsmalstifts (Bildpunkte: Spitze 12/487, Ansatz 50/350 … 140/440)
          const [ax, ay] = P(14, 484);
          const [bx, by] = P(46, 352);
          const [cx, cy] = P(142, 446);
          const [mx, my] = P(110, 370);
          k.moveTo(bx, by).quadraticCurveTo(mx, my, cx, cy)
            .quadraticCurveTo(ax + 22 * s.scale.x, ay - 4 * s.scale.y, ax, ay)
            .quadraticCurveTo(ax - 2 * s.scale.x, ay - 30 * s.scale.y, bx, by)
            .fill(0xffffff);
        }
        f.inhalt.addChild(k);
        f.klecks = k;
      }
      f.label = 'werkzeug:' + w.id;
      tap(f, () => this.waehleWerkzeug(i), { sound: null });
      return f;
    });
    this.reihe = this.werkzeugFaecher;
    this.zeigeWerkzeug(true);

    // Werkzeug unter dem Finger (kleiner Vorrat für mehrere Finger)
    this.zeiger = [0, 1, 2, 3, 4].map(() => {
      const s = new PIXI.Sprite(tex('malhaus/pinsel_dick'));
      s.visible = false;
      s.eventMode = 'none';
      s.zIndex = 60;
      this.vorn.addChild(s);
      return s;
    });

    // Ziel der Zeige-Hand „mal mit dem Finger": ein unsichtbarer Punkt auf dem Blatt
    this.malZiel = handZiel(this.welt, b.x + b.w * 0.3, b.y + b.h * 0.62, 'malZiel');

    this.flaeche.sprite.on('pointerdown', (e) => this.beginne(e));
  }

  // --- Runde: Form zum Nachspuren ---

  wunschInhalt(w) {
    return blasenKarte('malhaus/' + w.form, { breite: 140, hoehe: 125, rand: false });
  }

  rundeVorbereiten() {
    this.entferneSpur();
    this.flaeche.leere();
    this.schritt = 'warten';
    this.gemachtSeitSpur = 0;
  }

  rundeBeginnt(w) {
    this.schritt = 'farbe';
    this.baueSpur(w.form);
    this.pulsiere(this.toepfe[w.farbe]?.inhalt, 4);
    voice('malhaus_punkte', { nurWenn: () => this.aktiv && (this.schritt === 'farbe' || this.schritt === 'spuren') });
  }

  wunschZeigen() {
    if (this.schritt === 'farbe') this.pulsiere(this.toepfe[this.wunsch.farbe]?.inhalt, 3);
    else if (this.spur?.geist) this.pulsiere(this.spur.geist, 2.5);
  }

  hatGemalt() {
    return (this.gemacht || 0) > 0 || this.schritt === 'frei';
  }

  /** Rechteck der Form auf dem Blatt (Seiten-Koordinaten) */
  formBox(form) {
    const b = this.blatt;
    const { verhaeltnis } = umrissPunkte('malhaus/' + form, SPUR_PUNKTE);
    let h = 720;
    let w = h * verhaeltnis;
    if (w > 980) { w = 980; h = w / verhaeltnis; }
    return { cx: b.x + b.w / 2, cy: b.y + b.h / 2 + 10, w, h };
  }

  baueSpur(form) {
    this.entferneSpur();
    const id = 'malhaus/' + form;
    const box = this.formBox(form);
    // blasse Form als Vorlage
    const geist = new PIXI.Sprite(tex(id));
    geist.anchor.set(0.5);
    geist.position.set(box.cx, box.cy);
    geist.scale.set(box.w / geist.texture.width);
    geist.alpha = 0;
    geist.zIndex = 6;
    geist.eventMode = 'none';
    this.welt.addChild(geist);
    this.tween(geist, { alpha: 0.17 }, 0.8, { ease: 'sineInOut' });
    const rgb = FARBEN[this.wunsch.farbe].rgb;
    const { punkte } = umrissPunkte(id, SPUR_PUNKTE);
    const pkte = punkte.map((p, i) => {
      const g = new PIXI.Graphics()
        .circle(0, 0, 25).fill(0xffffff).stroke({ width: 8, color: hell(rgb, 0.15) })
        .circle(0, 0, 8).fill(hell(rgb, 0.35));
      g.position.set(box.cx + (p.x - 0.5) * box.w, box.cy + (p.y - 0.5) * box.h);
      g.zIndex = 7;
      g.eventMode = 'none';
      g.alpha = 0;
      g.scale.set(0.5);
      g.label = 'spurPunkt';
      this.welt.addChild(g);
      this.tween(g, { alpha: 1, scale: 1 }, 0.45, { ease: 'backOut', delay: 0.3 + i * 0.05 });
      return g;
    });
    this.spur = { form, id, punkte: pkte, geist, box, gesammelt: 0, fertig: false };
  }

  entferneSpur() {
    const s = this.spur;
    this.spur = null;
    if (!s) return;
    for (const g of [...s.punkte, s.geist]) {
      if (!g || g.destroyed) continue;
      g._puls?.stop();
      this.tween(g, { alpha: 0 }, 0.4, { ease: 'sineInOut' }).then(() => { if (!g.destroyed) g.destroy(); });
    }
  }

  /** Strich bei p (Seiten-Koordinaten): Punkte in der Nähe sammeln */
  sammle(p) {
    const s = this.spur;
    if (!s || s.fertig) return;
    for (const g of s.punkte) {
      if (g._weg) continue;
      if (Math.hypot(g.x - p.x, g.y - p.y) > SPUR_RADIUS) continue;
      this.sammlePunkt(g, true);
    }
    if (s.gesammelt >= Math.ceil(s.punkte.length * SPUR_GENUG)) this.spurFertig();
  }

  sammlePunkt(g, ton) {
    g._weg = true;
    this.spur.gesammelt++;
    this.tween(g, { alpha: 0, scale: 1.8 }, 0.45, { ease: 'sineOut' });
    if (ton && this.plingRuhe <= 0) {
      this.plingRuhe = 0.11;
      sfx('common/plopp', { vol: 0.25, rate: 1.2 + (this.plingNr % 8) * 0.04 });
      this.plingNr++;
    }
  }

  /** Form nachgespurt: der Rest der Punkte geht weich, die Vorlage lädt zum Füllen ein */
  spurFertig() {
    const s = this.spur;
    if (!s || s.fertig) return;
    s.fertig = true;
    let k = 0;
    for (const g of s.punkte) {
      if (g._weg) continue;
      const n = k++;
      this.after(n * 0.08, () => { if (!g.destroyed && !g._weg) this.sammlePunkt(g, false); });
    }
    this.schritt = 'fuellen';
    this.gemachtSeitSpur = 0;
    sfx('common/funkeln', { vol: 0.35 });
    this.burst('funkeln', s.box.cx, s.box.cy, { count: 5 });
    if (this.wunschDa) this.besuch.nicke();
    this.tween(s.geist, { alpha: 0.3 }, 0.7, { ease: 'sineInOut' }).then((ok) => {
      if (ok && this.spur === s && this.schritt === 'fuellen') this.pulsiere(s.geist, 5);
    });
  }

  inFormBox(p) {
    const s = this.spur;
    if (!s) return false;
    const { cx, cy, w, h } = s.box;
    return Math.abs(p.x - cx) <= w / 2 + 60 && Math.abs(p.y - cy) <= h / 2 + 60;
  }

  /** In die Form getippt: sie füllt sich weich mit der Farbe (über die Striche gelegt, „multiplizierend") */
  fuelle() {
    const s = this.spur;
    if (!s || this.schritt !== 'fuellen') return;
    this.schritt = 'frei';
    const w = WERKZEUGE[this.werkzeug];
    const farbe = w.id === 'pinsel' || w.id === 'stift' ? this.szene.farbe : this.wunsch.farbe;
    const rgb = FARBEN[farbe].rgb;
    const sil = silhouette(s.id, rgb);
    const seite = Math.max(s.box.w, s.box.h);
    const bild = new PIXI.Sprite(sil.texture);
    bild.anchor.set(0.5);
    bild.width = seite;
    bild.height = seite;
    bild.position.set(s.box.cx, s.box.cy);
    bild.blendMode = 'multiply';
    bild.alpha = 0;
    bild.zIndex = 6;
    bild.eventMode = 'none';
    this.welt.addChild(bild);
    s.geist._puls?.stop();
    this.tween(s.geist, { alpha: 0 }, 0.6, { ease: 'sineInOut' });
    sfx('common/plopp', { vol: 0.6, rate: 0.85 });
    this.tween(bild, { alpha: 0.88 }, 0.7, { ease: 'sineInOut' }).then(() => {
      // jetzt wirklich auf die Leinwand
      const c = this.flaeche.ctx;
      const q = this.flaeche.inLeinwand(s.box.cx - seite / 2, s.box.cy - seite / 2);
      const g = seite / this.flaeche.skala;
      c.save();
      c.globalCompositeOperation = 'multiply';
      c.globalAlpha = 0.88;
      c.drawImage(sil.canvas, q.x, q.y, g, g);
      c.restore();
      this.flaeche.schmutzig = true;
      this.flaeche.auffrischen();
      if (!bild.destroyed) bild.destroy();
      this.entferneSpur();
      if (this.aktiv) sfx('common/funkeln', { vol: 0.4 });
      this.burst('funkeln', s.box.cx, s.box.cy, { count: 7 });
      if (this.wunschDa) this.besuch.freu();
      belohne(this, 'malhaus_stift', s.box.cx, s.box.cy);
      this.after(2.2, () => this.ladeZumRahmen());
    });
  }

  mitzaehlen(n) {
    this.gemacht = (this.gemacht || 0) + n;
    this.gemachtSeitSpur = (this.gemachtSeitSpur || 0) + n;
    if ((this.schritt === 'spuren' || this.schritt === 'farbe') && this.gemacht > SPUR_VON_SELBST) this.spurFertig();
    // Nach dem Füllen lädt der Rahmen ein. Wer nicht füllen mag und lange weitermalt, bekommt die Einladung
    // trotzdem (kein Festhängen) – aber erst viel später, damit der Schritt „in die Form tippen" nicht untergeht.
    const genug = this.schritt === 'frei' ? MAL_GENUG : this.schritt === 'fuellen' ? MAL_GENUG * 3 : Infinity;
    if (this.gemachtSeitSpur >= genug) this.ladeZumRahmen();
  }

  leereBlatt() {
    super.leereBlatt();
    // neues Blatt mitten in der Runde: die Form kommt wieder
    if (this.wunschDa && this.schritt !== 'warten') {
      this.baueSpur(this.wunsch.form);
      this.schritt = 'spuren';
      this.gemachtSeitSpur = 0;
    }
  }

  waehleWerkzeug(i) {
    this.tatHier = true;
    if (this.werkzeug === i) {
      fx.wobble(this.werkzeugFaecher[i].inhalt, 0.06);
    }
    this.werkzeug = i;
    if (i <= 1) this.farbWerkzeug = i;
    sfx(WERKZEUGE[i].id === 'schwamm' ? 'common/wisch' : 'common/plopp', { vol: 0.5 });
    this.zeigeWerkzeug();
  }

  farbeGewaehlt(i) {
    if (this.schritt === 'farbe') this.schritt = 'spuren';
    if (this.wunschDa && i === this.wunsch.farbe) this.besuch.nicke();
    // Topf gewählt: zurück zu Pinsel/Stift, wenn gerade Regenbogen oder Schwamm in der Hand ist
    if (this.werkzeug > 1) {
      this.werkzeug = this.farbWerkzeug;
      this.zeigeWerkzeug();
    } else this.faerbeKleckse();
  }

  zeigeWerkzeug(sofort = false) {
    this.werkzeugFaecher.forEach((f, k) => {
      if ((k === this.werkzeug) !== f.gewaehlt || sofort) f.markiere(k === this.werkzeug, sofort);
    });
    this.faerbeKleckse();
  }

  faerbeKleckse() {
    const rgb = FARBEN[this.szene.farbe ?? 0].rgb;
    for (const f of this.werkzeugFaecher) if (f.klecks) f.klecks.tint = rgb;
  }

  betreten() {
    super.betreten();
    this.faerbeKleckse();
  }

  // --- Malen mit dem Finger ---

  beginne(e) {
    const id = e.pointerId;
    const p = this.ort(e);
    if (!this.flaeche.aufBlatt(p.x, p.y)) return;
    this.tatHier = true;
    if (this.blattImAblauf()) return;
    if (this.schritt === 'fuellen' && this.inFormBox(p)) {
      this.fuelle();
      return;
    }
    if (this.schritt === 'farbe') this.schritt = 'spuren';
    // Hängt noch ein Strich mit derselben Finger-Nummer (Loslassen ging verloren, z. B. Systemgeste):
    // erst sauber beenden, sonst bliebe sein Werkzeug-Zeiger für immer auf dem Blatt stehen.
    const alt = this.striche.get(id);
    if (alt) this.ende(alt);
    const w = WERKZEUGE[this.werkzeug];
    const q = this.flaeche.inLeinwand(p.x, p.y);
    const zeiger = this.zeiger.find((z) => !z._belegt) || null;
    const strich = { id, w, letzt: q, mitte: { x: q.x, y: q.y }, weg: 0, zeiger };
    if (zeiger) {
      zeiger._belegt = true;
      this.stelleZeiger(zeiger, w);
      zeiger.visible = true;
      zeiger.alpha = 0.95;
      zeiger.position.set(p.x, p.y);
    }
    this.striche.set(id, strich);
    // Punkt setzen (sofortige Antwort beim Berühren)
    const c = this.flaeche.ctx;
    c.fillStyle = this.farbe(w, 0);
    c.beginPath();
    c.arc(q.x, q.y, w.breite / 2, 0, Math.PI * 2);
    c.fill();
    this.flaeche.schmutzig = true;
    if (w.id !== 'schwamm') this.sammle(p);
    this.ton(w, true);
    this.szene.finger.halte(id, {
      von: this,
      move: (g) => this.ziehe(strich, g),
      end: () => this.ende(strich),
    });
  }

  ziehe(s, g) {
    if (this.striche.get(s.id) !== s) return;
    const p = this.welt.toLocal(g);
    const q = this.flaeche.inLeinwand(p.x, p.y);
    const dx = q.x - s.letzt.x;
    const dy = q.y - s.letzt.y;
    const d = Math.hypot(dx, dy);
    if (s.zeiger) s.zeiger.position.set(p.x, p.y);
    if (d < 2.5) return;
    const m = { x: (s.letzt.x + q.x) / 2, y: (s.letzt.y + q.y) / 2 };
    const c = this.flaeche.ctx;
    c.lineCap = 'round';
    c.lineJoin = 'round';
    c.lineWidth = s.w.breite;
    c.strokeStyle = this.farbe(s.w, d);
    c.beginPath();
    c.moveTo(s.mitte.x, s.mitte.y);
    c.quadraticCurveTo(s.letzt.x, s.letzt.y, m.x, m.y);
    c.stroke();
    s.mitte = m;
    s.letzt = q;
    s.weg += d;
    this.flaeche.schmutzig = true;
    if (s.w.id !== 'schwamm') {
      this.sammle(p);
      this.mitzaehlen(d * this.flaeche.skala, MAL_GENUG);
    }
    if (s.weg > 40) {
      s.weg = 0;
      this.ton(s.w, false);
    }
  }

  ende(s) {
    if (this.striche.get(s.id) !== s) return;
    this.striche.delete(s.id);
    const c = this.flaeche.ctx;
    c.lineCap = 'round';
    c.lineWidth = s.w.breite;
    c.strokeStyle = this.farbe(s.w, 0);
    c.beginPath();
    c.moveTo(s.mitte.x, s.mitte.y);
    c.lineTo(s.letzt.x, s.letzt.y);
    c.stroke();
    this.flaeche.schmutzig = true;
    const z = s.zeiger;
    if (z) {
      this.tween(z, { alpha: 0 }, 0.3, { ease: 'sineInOut' }).then(() => {
        z.visible = false;
        z._belegt = false;
      });
    }
  }

  fingerWeg() {
    for (const s of [...this.striche.values()]) this.ende(s);
    this.striche.clear();
    for (const z of this.zeiger || []) { z.visible = false; z._belegt = false; }
  }

  // Farbe eines Stücks Strich (Regenbogen: wandert langsam mit dem Weg weiter – ein ganzer Farbkreis erst nach
  // etwa 4500 Bildpunkten). Der Farbton springt in kleinen Stufen von 6°: so liegen die runden Enden der vielen
  // kurzen Stücke meist in derselben Farbe übereinander und es entstehen keine „Schuppen", sondern weiche Bänder.
  farbe(w, weg) {
    if (w.id === 'schwamm') return '#ffffff';
    if (w.id === 'regenbogen') {
      this.hue = (this.hue + weg * 0.08) % 360;
      return `hsl(${Math.round(this.hue / 6) * 6}, 82%, 58%)`;
    }
    return css(FARBEN[this.szene.farbe ?? 0].rgb);
  }

  // Werkzeug-Bild unter dem Finger: Spitze genau am Finger
  stelleZeiger(z, w) {
    const bild = w.id === 'schwamm' ? 'malhaus/radierschwamm' : w.id === 'stift' ? 'malhaus/stift_dick' : 'malhaus/pinsel_dick';
    z.texture = tex(bild);
    const m = meta(bild);
    const sp = m.pts?.spitze;
    if (sp && w.id !== 'schwamm') z.anchor.set(sp[0] / m.w, sp[1] / m.h);
    else z.anchor.set(0.5, 0.5);
    z.scale.set((w.id === 'schwamm' ? 150 : 170) / Math.max(m.w, m.h));
    z.tint = w.id === 'regenbogen' ? 0xfff0f8 : 0xffffff;
  }

  // leiser Malton, entprellt (nicht übereinander)
  ton(w, sofort) {
    if (this.tonRuhe > 0) return;
    this.tonRuhe = sofort ? 0.25 : 0.5;
    if (w.id === 'schwamm') sfx('common/wisch', { vol: 0.32 });
    else sfx('common/pinsel', { vol: 0.3, rate: rand(0.95, 1.08) });
  }

  update(dt, t) {
    super.update(dt, t);
    this.tonRuhe -= dt;
    this.plingRuhe -= dt;
    if (this.striche.size === 0) this.hue = (this.hue + dt * 6) % 360;
  }

  // Zeige-Hand (nur die ersten zwei Hinweise kommen vor dem Pfeil zur nächsten Seite):
  //   Farbe       → Topf der Wunschfarbe, dann die Punkte nachfahren
  //   Spuren      → von einem offenen Punkt zum übernächsten fahren
  //   Füllen      → in die Form tippen
  //   frei/bereit → Rahmen, dann weiter malen
  malHinweise() {
    const b = this.blatt;
    const malen = { von: this.malZiel, nach: { x: b.x + b.w * 0.72, y: b.y + b.h * 0.34 } };
    const s = this.spur;
    let spuren = null;
    if (s && !s.fertig) {
      const offen = s.punkte.filter((g) => !g._weg);
      if (offen.length >= 2) spuren = { von: offen[0], nach: { x: offen[Math.min(3, offen.length - 1)].x, y: offen[Math.min(3, offen.length - 1)].y } };
      else if (offen.length === 1) spuren = offen[0];
    }
    // „in die Form tippen" geht vor dem Rahmen (auch wenn der schon einlädt, weil lange gekritzelt wurde)
    if (this.schritt === 'fuellen' && s) return [{ x: s.box.cx, y: s.box.cy }, this.rahmenBereit ? this.rahmenKnopf : malen];
    if (this.rahmenBereit) return [this.rahmenKnopf, malen];
    if (this.schritt === 'farbe' && this.wunsch) return [this.toepfe[this.wunsch.farbe], spuren || malen];
    if (this.schritt === 'spuren' && spuren) return [spuren, this.toepfe[this.wunsch.farbe]];
    if (this.schritt === 'frei') return [this.rahmenKnopf, malen];
    const zweites = (this.gemacht || 0) > 500 && this.werkzeug !== 2
      ? this.werkzeugFaecher[2]
      : this.toepfe[(this.szene.farbe + 5) % FARBEN.length];
    return [malen, zweites];
  }
}

// ---------------------------------------------------------------- Seite 3: Stempeln (mit gewischtem Untergrund)

const STEMPEL_GROESSE = 215;   // Größe eines Abdrucks auf dem Blatt (± 15 %)
const STEMPEL_ABSTAND = 195;   // beim Ziehen: so weit auseinander
const STEMPEL_GENUG = 8;       // so viele Abdrücke, dann lädt der Rahmen ein
const WISCH_BREITE = 250;      // Pinselbreite des Untergrunds (Leinwand-Bildpunkte)
const GITTER = { x: 10, y: 7 };   // Zellen fürs Mitzählen, wie viel schon gewischt ist
const WISCH_GENUG = 0.7;       // Anteil, dann füllt sich der Rest von selbst
const FUELL_DAUER = 1.0;       // so lange füllt sich der Rest (weich – große Helligkeitswechsel nie schneller)

class Stempeln extends MalSeite {
  static WUENSCHE = WUENSCHE_STEMPEL;
  satz = 'malhaus_stempel';

  aufbau() {
    this.grundAufbau();
    const b = this.blatt;
    this.flaeche = new Malflaeche(this, 'stempel', b, Math.round(b.w), Math.round(b.h));
    this.baueRahmenKnopf();
    this.stempelNr = 0;
    this.klackRuhe = 0;
    this.druckRuhe = 0;
    this.wischRuhe = 0;
    this.schritt = 'warten';   // 'warten'/'grund' (wischen) → 'fuellt' → 'stempel' (aussuchen) → 'stempeln'
    this.gitter = new Uint8Array(GITTER.x * GITTER.y);
    this.verlauf = null;
    this.fuellAnim = null;

    this.stempel = STEMPEL.map((id, i) => {
      const f = fach(this, REIHE_X(i, STEMPEL.length), REIHE_Y, {
        breite: REIHE_ABSTAND, hoehe: 230, schatten: { w: 180, h: 40, y: 92 }, scheinGroesse: { w: 240, h: 240 },
      });
      // kleiner Holzklotz unter dem Stempelbild (sieht aus wie ein Stempel)
      const klotz = new PIXI.Graphics()
        .roundRect(-72, 40, 144, 46, 16).fill(0xd79a5c).stroke({ width: 4, color: 0xa86f3a })
        .roundRect(-57, 48, 114, 12, 6).fill({ color: 0xffffff, alpha: 0.18 });
      const s = new PIXI.Sprite(tex('malhaus/' + id));
      s.anchor.set(0.5);
      s.scale.set(168 / Math.max(s.texture.width, s.texture.height));
      s.y = -22;
      f.inhalt.addChild(klotz, s);
      f.label = 'stempel:' + id;
      tap(f, () => this.waehleStempel(i), { sound: null });
      return f;
    });
    this.reihe = this.stempel;
    this.stempel.forEach((f, k) => f.markiere(k === 0, true));

    // Druck-Effekt: kurz größerer, verblassender Abdruck (Vorrat)
    this.druecke = [0, 1, 2, 3, 4, 5].map(() => {
      const s = new PIXI.Sprite(tex('malhaus/' + STEMPEL[0]));
      s.anchor.set(0.5);
      s.visible = false;
      s.eventMode = 'none';
      s.zIndex = 50;
      this.welt.addChild(s);
      return s;
    });
    this.druckNr = 0;

    this.flaeche.sprite.on('pointerdown', (e) => this.beginne(e));
  }

  // --- Runde: Untergrund und Wunsch-Stempel ---

  wunschInhalt(w) {
    const c = new PIXI.Container();
    const bw = 150;
    const bh = 104;
    const hy = -bh / 2 + bh * w.horizont;
    const g = new PIXI.Graphics()
      .roundRect(-bw / 2, -bh / 2, bw, bh, 14).fill(w.oben)
      .rect(-bw / 2, hy, bw, bh / 2 - hy - 14).fill(w.unten)
      .roundRect(-bw / 2, bh / 2 - 28, bw, 28, 14).fill(w.unten)
      .roundRect(-bw / 2, -bh / 2, bw, bh, 14).stroke({ width: 4, color: 0xffffff });
    c.addChild(g);
    const n = w.stempel.length;
    w.stempel.slice(0, 3).forEach((id, i) => {
      const s = new PIXI.Sprite(tex('malhaus/' + id));
      s.anchor.set(0.5);
      s.scale.set((n > 2 ? 46 : 58) / Math.max(s.texture.width, s.texture.height));
      s.position.set((i - (Math.min(n, 3) - 1) / 2) * (n > 2 ? 46 : 60), i % 2 ? 14 : 4);
      c.addChild(s);
    });
    return c;
  }

  rundeVorbereiten(w) {
    this.fuellAnim = null;
    this.flaeche.leere();
    this.gitter.fill(0);
    this.stempelZahl = 0;
    this.schritt = 'warten';
    // Verlauf oben → unten mit weichem Horizont (eine Farbe je Pinselstrich wäre streifig)
    const h = this.flaeche.h;
    const v = this.flaeche.ctx.createLinearGradient(0, 0, 0, h);
    v.addColorStop(0, css(w.oben));
    v.addColorStop(Math.max(0, w.horizont - 0.05), css(w.oben));
    v.addColorStop(Math.min(1, w.horizont + 0.05), css(w.unten));
    v.addColorStop(1, css(w.unten));
    this.verlauf = v;
    // erster Wunsch-Stempel liegt schon bereit
    const i = STEMPEL.indexOf(w.stempel[0]);
    if (i >= 0 && i !== this.stempelNr) {
      this.stempelNr = i;
      this.stempel.forEach((f, k) => { if ((k === i) !== f.gewaehlt) f.markiere(k === i); });
    }
  }

  rundeBeginnt() {
    if (this.schritt === 'warten') this.schritt = 'grund';
    voice('malhaus_wischen', { nurWenn: () => this.aktiv && (this.schritt === 'grund' || this.schritt === 'warten') });
  }

  wunschZeigen() {
    if (this.schritt === 'stempel' || this.schritt === 'stempeln') {
      for (const id of this.wunsch.stempel) this.pulsiere(this.stempel[STEMPEL.indexOf(id)]?.inhalt, 3);
    } else {
      fx.wobble(this.flaeche.sprite, 0.01);
    }
  }

  hatGemalt() {
    return (this.gemacht || 0) > 0 || this.gitter.some((z) => z);
  }

  wunschIndex(id) {
    return this.wunsch ? this.wunsch.stempel.indexOf(STEMPEL[id]) : -1;
  }

  waehleStempel(i) {
    this.tatHier = true;
    if (this.stempelNr === i) fx.wobble(this.stempel[i].inhalt, 0.06);
    this.stempelNr = i;
    this.stempel.forEach((f, k) => { if ((k === i) !== f.gewaehlt) f.markiere(k === i); });
    sfx('common/plopp', { vol: 0.5, rate: 0.9 + i * 0.03 });
    // wer schon stempeln will, bekommt den Untergrund passend dazu (nichts ist falsch)
    if (this.schritt === 'warten' || this.schritt === 'grund') this.grundFertig();
    if (this.schritt === 'stempel') this.schritt = 'stempeln';
    if (this.wunschDa && this.wunschIndex(i) >= 0) this.besuch.nicke();
  }

  beginne(e) {
    const p = this.ort(e);
    if (!this.flaeche.aufBlatt(p.x, p.y)) return;
    this.tatHier = true;
    if (this.blattImAblauf()) return;
    if (this.schritt === 'warten' || this.schritt === 'grund') {
      this.wischeBeginn(e, p);
      return;
    }
    if (this.schritt === 'fuellt') return;   // füllt sich gerade (1 s)
    if (this.schritt === 'stempel') this.schritt = 'stempeln';
    const zug = { letzt: { x: p.x, y: p.y } };
    this.stemple(p.x, p.y, true);
    this.szene.finger.halte(e.pointerId, {
      von: this,
      move: (g) => {
        const q = this.welt.toLocal(g);
        if (!this.flaeche.aufBlatt(q.x, q.y, -30)) return;
        if (Math.hypot(q.x - zug.letzt.x, q.y - zug.letzt.y) < STEMPEL_ABSTAND) return;
        zug.letzt = { x: q.x, y: q.y };
        this.stemple(q.x, q.y, false);
      },
      end: () => {},
    });
  }

  // --- Untergrund wischen ---

  wischeBeginn(e, p) {
    if (this.schritt === 'warten') this.schritt = 'grund';
    const q = this.flaeche.inLeinwand(p.x, p.y);
    const strich = { letzt: q };
    const c = this.flaeche.ctx;
    c.save();
    c.fillStyle = this.verlauf;
    c.beginPath();
    c.arc(q.x, q.y, WISCH_BREITE / 2, 0, Math.PI * 2);
    c.fill();
    c.restore();
    this.flaeche.schmutzig = true;
    this.markiereGitter(q);
    this.wischTon();
    this.szene.finger.halte(e.pointerId, {
      von: this,
      move: (g) => {
        if (this.schritt !== 'grund') return;
        const pp = this.welt.toLocal(g);
        const qq = this.flaeche.inLeinwand(pp.x, pp.y);
        if (Math.hypot(qq.x - strich.letzt.x, qq.y - strich.letzt.y) < 4) return;
        const cc = this.flaeche.ctx;
        cc.save();
        cc.lineCap = 'round';
        cc.lineJoin = 'round';
        cc.lineWidth = WISCH_BREITE;
        cc.strokeStyle = this.verlauf;
        cc.beginPath();
        cc.moveTo(strich.letzt.x, strich.letzt.y);
        cc.lineTo(qq.x, qq.y);
        cc.stroke();
        cc.restore();
        strich.letzt = qq;
        this.flaeche.schmutzig = true;
        this.markiereGitter(qq);
        this.wischTon();
      },
      end: () => {},
    });
  }

  markiereGitter(q) {
    const w = this.flaeche.w;
    const h = this.flaeche.h;
    const r = WISCH_BREITE * 0.6;
    for (let gy = 0; gy < GITTER.y; gy++) {
      for (let gx = 0; gx < GITTER.x; gx++) {
        const cx = ((gx + 0.5) / GITTER.x) * w;
        const cy = ((gy + 0.5) / GITTER.y) * h;
        if (Math.hypot(cx - q.x, cy - q.y) <= r) this.gitter[gy * GITTER.x + gx] = 1;
      }
    }
    let n = 0;
    for (const z of this.gitter) n += z;
    if (n >= this.gitter.length * WISCH_GENUG) this.grundFertig();
  }

  wischTon() {
    if (this.wischRuhe > 0) return;
    this.wischRuhe = 0.45;
    sfx('common/wisch', { vol: 0.35, rate: rand(0.95, 1.05) });
  }

  /** Untergrund fast fertig (oder ein Stempel gewählt): der Rest füllt sich weich in 1 s */
  grundFertig() {
    if (this.schritt !== 'warten' && this.schritt !== 'grund') return;
    if (!this.verlauf) return;
    this.schritt = 'fuellt';
    this.szene.finger?.allesLos(this);
    this.fuellAnim = { t: 0 };
    sfx('common/funkeln', { vol: 0.3 });
  }

  fuellSchritt(dt) {
    const a = this.fuellAnim;
    a.t += dt;
    const c = this.flaeche.ctx;
    c.save();
    c.globalAlpha = a.t >= FUELL_DAUER ? 1 : 1 - Math.exp(-dt * 3.6);
    c.fillStyle = this.verlauf;
    c.fillRect(0, 0, this.flaeche.w, this.flaeche.h);
    c.restore();
    this.flaeche.schmutzig = true;
    if (a.t < FUELL_DAUER) return;
    this.fuellAnim = null;
    this.gitter.fill(1);
    this.schritt = 'stempel';
    const b = this.blatt;
    this.burst('funkeln', b.x + b.w / 2, b.y + b.h / 2, { count: 5 });
    if (this.wunschDa) {
      this.besuch.nicke();
      for (const id of this.wunsch.stempel) this.pulsiere(this.stempel[STEMPEL.indexOf(id)]?.inhalt, 4);
    }
  }

  // --- Stempeln ---

  stemple(x, y, tipp) {
    const id = 'malhaus/' + STEMPEL[this.stempelNr];
    const t = tex(id);
    const quelle = t.source.resource;
    const groesse = STEMPEL_GROESSE * rand(0.85, 1.15);
    const dreh = rand(-0.3, 0.3);
    const s = groesse / Math.max(t.width, t.height);
    const q = this.flaeche.inLeinwand(x, y);
    const c = this.flaeche.ctx;
    c.save();
    c.translate(q.x, q.y);
    c.rotate(dreh);
    c.globalAlpha = 0.96;
    if (quelle) c.drawImage(quelle, (-t.width * s) / 2, (-t.height * s) / 2, t.width * s, t.height * s);
    c.restore();
    this.flaeche.schmutzig = true;

    const warBereit = this.rahmenBereit;
    this.mitzaehlen(1, STEMPEL_GENUG);
    if (!warBereit && this.rahmenBereit) {
      voice('malhaus_schoen', { nurWenn: () => this.aktiv });
      if (this.wunschDa) this.besuch.freu();
      const b = this.blatt;
      belohne(this, 'malhaus_stempel', b.x + b.w / 2, b.y + b.h * 0.42);
    } else if (this.wunschDa && this.wunschIndex(this.stempelNr) >= 0) {
      this.besuch.nicke();
    }

    // Drücken: Abdruck erscheint etwas größer und sinkt weich aufs Papier (0,42 s). Beim Ziehen höchstens alle
    // 0,3 s einer – so laufen nie viele Druck-Bewegungen gleichzeitig.
    if (tipp || this.druckRuhe <= 0) {
      this.druckRuhe = 0.3;
      const d = this.druecke[this.druckNr++ % this.druecke.length];
      d.texture = t;
      d.visible = true;
      d.position.set(x, y);
      d.rotation = dreh;
      d.scale.set(s * 1.18);
      d.alpha = 0.6;
      this.tween(d, { scale: s, alpha: 0 }, 0.42, { ease: 'sineOut' }).then((ok) => { if (ok) d.visible = false; });
    }

    if (this.klackRuhe <= 0) {
      this.klackRuhe = tipp ? 0.08 : 0.14;
      sfx('common/klack', { vol: tipp ? 0.6 : 0.42, rate: rand(0.92, 1.1) });
    }
  }

  leereBlatt() {
    super.leereBlatt();
    this.fuellAnim = null;
    this.gitter.fill(0);
    // neues Blatt mitten in der Runde: der Untergrund wird wieder gewischt
    if (this.schritt !== 'warten') this.schritt = 'grund';
  }

  update(dt, t) {
    super.update(dt, t);
    this.klackRuhe -= dt;
    this.druckRuhe -= dt;
    this.wischRuhe -= dt;
    if (this.fuellAnim) this.fuellSchritt(dt);
  }

  // Zeige-Hand: Untergrund wischen → Wunsch-Stempel → aufs Blatt tippen; genug gestempelt → Rahmen
  malHinweise() {
    const b = this.blatt;
    const wunsch = (this.wunsch?.stempel || []).map((id) => this.stempel[STEMPEL.indexOf(id)]).filter(Boolean);
    const anderer = wunsch.find((f) => !f.gewaehlt) || this.stempel[(this.stempelNr + 2) % this.stempel.length];
    const aufsBlatt = { x: b.x + b.w * rand(0.3, 0.7), y: b.y + b.h * rand(0.3, 0.6) };
    if (this.schritt === 'grund' || (this.schritt === 'warten' && this.wunschDa)) {
      return [{ von: this.blattLinks, nach: { x: b.x + b.w * 0.78, y: b.y + b.h * 0.55 } }, anderer];
    }
    if (this.rahmenBereit) return [this.rahmenKnopf, anderer];
    if (this.schritt === 'stempel') return [wunsch[0] || anderer, aufsBlatt];
    return [aufsBlatt, anderer];
  }
}

// ---------------------------------------------------------------- Szene

export default class Malhaus extends SeitenSzene {
  static id = 'malhaus';
  static packs = ['malhaus', 'tiere'];
  // alle Tiere, deren Bilder der Ort zeigt (Besuche und die Katze vor dem Regal)
  // Besuche brauchen nur stehen, gehen und freuen (idle, seite, happy) – die Katze auch schlafen (alle Posen)
  static tiere = ['katze', ...['kuh', 'baer', 'hund', 'eule', 'hase', 'pinguin', 'ente', 'fuchs', 'maus', 'schaf']
    .flatMap((t) => [t + '_idle', t + '_seite', t + '_happy'])];
  static music = 'musik/atelier';
  static seiten = [Ausmalen, Freimalen, Stempeln, Bastelecke];

  vorbereiten() {
    ui.albumKnopf(this);
    this.finger = new FingerVerteiler();
    this.farbe = 0;
    this.gerahmt = false;
    this.hallo = false;
  }

  /**
   * Beim Betreten einer Seite: beim ersten Mal die Begrüßung, dann (bei jedem Betreten) der Hinweis der Seite – der
   * Kern sagt ihn höchstens einmal am Tag. Der Hinweis kommt nur, solange genau diese Seite zu sehen ist und das
   * Kind dort noch nichts gewählt oder gemalt hat; nurWenn wird auch gefragt, wenn er erst später an die Reihe kommt.
   */
  sprich(seite) {
    let warte = 2.5;
    if (!this.hallo) {
      this.hallo = true;
      voice('malhaus_hallo');
      warte = 4;
    }
    seite._hinweis?.kill();
    seite._hinweis = null;
    const satz = seite.satz;
    if (!satz) return;
    const passt = () => seite.aktiv && !seite.tatHier;
    seite._hinweis = this.after(warte, () => { if (passt()) voice(satz, { nurWenn: passt }); });
  }

  exit() {
    super.exit();
    this.finger?.abbauen();
    // halb zerlegte Bilder verwerfen und den Arbeitsspeicher fürs Zerlegen freigeben (die fertigen bleiben in ZERLEGT)
    for (const s of this.seiten || []) if (s) s.vorarbeit = null;
    gibArbeitFrei();
  }
}

