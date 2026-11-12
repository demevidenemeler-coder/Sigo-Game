// Malhaus – ein ruhiges Atelier mit Staffelei. Drei Bilderbuch-Seiten, alle vor hg_atelier;
// gemalt wird immer auf dem großen weißen Blatt (Punkte blatt_lo … blatt_ru), jede Seite hat ihre eigene Leinwand.
//   1. Ausmalen:   unten 8 Ausmalbilder zur Wahl, links/rechts 10 Farbtöpfe. Tipp in eine Fläche → sie füllt sich.
//   2. Frei malen: mit dem Finger malen (mehrere Finger gleichzeitig), Pinsel, Stift, Regenbogen-Stift, Schwamm.
//   3. Stempeln:   unten 8 Stempel; Tipp aufs Blatt setzt einen, Ziehen setzt in Abständen weitere.
// Auf jeder Seite: „neues Blatt" (links neben der Reihe) und der Bilderrahmen (rechts neben der Reihe) – zeigt das
// Bild kurz gerahmt (beim ersten Mal ein Sticker). Ist genug gemalt, lädt der Rahmen sanft ein (Ring, Atmen, Hand).
// Die Bilder bleiben beim Blättern erhalten, solange der Ort offen ist.

import { stage, tex, meta, sfx, voice, tap, fx, ui, rand, PIXI } from '../../engine/index.js';
import { Seite, SeitenSzene } from '../../gemeinsam/seiten.js';
import { belohne } from '../../gemeinsam/sticker.js';
import { Malflaeche, FingerVerteiler } from './leinwand.js';
import { zerlege, zerlegeSchritte, gibArbeitFrei, flaecheBei, punktIn, Malbild } from './ausmalen.js';
import { baueDeko } from './deko.js';

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
const REIHE_Y = 1405;                        // Reihe unten auf dem Boden (Bilder, Werkzeuge, Stempel)
const REIHE_ABSTAND = 210;                   // 8 Dinge reichen bis x ±840 – „neues Blatt" und Rahmen passen daneben
const REIHE_X = (i, n, abstand = REIHE_ABSTAND) => (i - (n - 1) / 2) * abstand;
// beide Knöpfe an den Enden der Reihe, ganz im Kernbereich (x ±1066) und neben den Topf-Leisten
const NEU_ORT = { x: -950, y: 1414 };        // „neues Blatt" unten links
const RAHMEN_ORT = { x: 950, y: 1414 };      // Bilderrahmen unten rechts (frei von Pfeil und Katze)
const RAHMEN_GROESSE = 220;

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

// ---------------------------------------------------------------- Grundseite (alle drei Seiten)

class MalSeite extends Seite {
  static hg = HG;

  /** Blatt in Seiten-Koordinaten (links oben + Größe) aus den Punkten des Hintergrunds */
  get blatt() {
    const lo = this.punkt('blatt_lo', { x: -796, y: 185 });
    const ru = this.punkt('blatt_ru', { x: 778, y: 1196 });
    return { x: lo.x, y: lo.y, w: ru.x - lo.x, h: ru.y - lo.y };
  }

  /** gemeinsamer Aufbau: Deko, „neues Blatt", Staffelei */
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

  /** Rahmen-Knopf: zeigt eine kleine Vorschau des eigenen Bildes im Rahmen */
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
      onTap: () => this.zeigeRahmen(),
    });
    // ui.button passt das Symbol auf 60 % ein – der Rahmen ist das Wichtigste am Knopf und darf fast bis zum Rand
    icon.scale.set(icon.scale.x * 1.4);
    this.rahmenKnopf.label = 'rahmen';
  }

  /** Genug gemalt: der Rahmen-Knopf lädt einmal sanft ein (goldener Ring, ruhiges Atmen, leises Funkeln) */
  ladeZumRahmen() {
    if (this.rahmenBereit || !this.rahmenKnopf) return;
    this.rahmenBereit = true;
    this.rahmenKnopf.markiere(true);
    this._rahmenAtmen?.stop();
    const atmen = fx.pulse(this.rahmenKnopf, { staerke: 0.07, periode: 1.6 });
    this._rahmenAtmen = atmen;
    this.after(4.8, () => { atmen.stop(); if (this._rahmenAtmen === atmen) this._rahmenAtmen = null; });
    this.after(0.4, () => { if (this.aktiv) sfx('common/funkeln', { vol: 0.25 }); });
  }

  /** Einladung zurücknehmen (nach dem Rahmen-Zeigen oder auf leerem Blatt) */
  rahmenRuhig() {
    this.rahmenBereit = false;
    this._rahmenAtmen?.stop();
    this._rahmenAtmen = null;
    this.rahmenKnopf?.markiere(false);
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
    const neu = this.szene.farbe !== i;
    this.szene.farbe = i;
    this.zeigeFarbe(i);
    sfx('common/plopp', { vol: 0.55, rate: 0.9 + (i % 5) * 0.06 });
    if (!neu) fx.wobble(this.toepfe[i].inhalt, 0.06);
    this.farbeGewaehlt?.(i);
  }

  // --- neues Blatt: weich aus- und wieder einblenden (Ruhe-Regel: Helligkeit ändert sich nie schneller als 0,5 s) ---

  neuesBlattTippen() {
    // während das Blatt gerade ausgetauscht wird (Bildwechsel auf Seite 1), wartet „neues Blatt" nicht dazwischen
    if (this._leert || this._wechselt) {
      fx.wobble(this.neuKnopf, 0.05);
      return;
    }
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

  // --- Bilderrahmen: das Bild kurz gerahmt zeigen ---

  zeigeRahmen() {
    if (this.rahmenAnsicht) {
      this.schliesseRahmen();
      return;
    }
    // die Einladung ist angenommen; erneut bereit, wenn wieder genug Neues gemalt ist
    this.rahmenRuhig();
    this.gemacht = 0;
    const v = new PIXI.Container({ label: 'rahmenAnsicht' });
    v.zIndex = 5000;
    const W = stage.W;
    const dunkel = new PIXI.Graphics().rect(-W / 2 - 100, -100, W + 200, 1800).fill(0x3a2614);
    dunkel.alpha = 0;
    dunkel.eventMode = 'static';
    dunkel.on('pointerdown', (e) => {
      e.stopPropagation();
      if (v._seit > 0.6) this.schliesseRahmen();
    });
    v.addChild(dunkel);

    // groß gerahmt: das ganze Bild ist zu sehen (eingepasst, weißes Passepartout füllt den Rest)
    const fs = 1.5;
    const bildC = new PIXI.Container();
    bildC.position.set(0, 760);
    const iw = (RAHMEN_INNEN.x1 - RAHMEN_INNEN.x0) * fs;
    const ih = (RAHMEN_INNEN.y1 - RAHMEN_INNEN.y0) * fs;
    const mitteX = ((RAHMEN_INNEN.x0 + RAHMEN_INNEN.x1) / 2 - 450) * fs;
    const mitteY = ((RAHMEN_INNEN.y0 + RAHMEN_INNEN.y1) / 2 - 306) * fs;
    const papier = new PIXI.Graphics().rect(mitteX - iw / 2 - 30, mitteY - ih / 2 - 30, iw + 60, ih + 60).fill(0xffffff);
    const bild = new PIXI.Sprite(this.flaeche.texture);
    bild.anchor.set(0.5);
    bild.scale.set(Math.min((iw - 16) / bild.texture.width, (ih - 16) / bild.texture.height));
    bild.position.set(mitteX, mitteY);
    const rahmen = new PIXI.Sprite(tex('malhaus/bilderrahmen'));
    rahmen.anchor.set(0.5);
    rahmen.scale.set(fs);
    const schatten = bodenSchatten(1250, 130, 0.3);
    schatten.y = 520;
    bildC.addChild(schatten, papier, bild, rahmen);
    bildC.alpha = 0;
    bildC.scale.set(0.9);
    v.addChild(bildC);
    v.bildC = bildC;
    v.dunkel = dunkel;
    v._seit = 0;
    this.vorn.addChild(v);
    this.rahmenAnsicht = v;

    this.tween(dunkel, { alpha: 0.38 }, 0.5, { ease: 'sineInOut' });
    this.tween(bildC, { alpha: 1, scale: 1 }, 0.6, { ease: 'sineInOut' }).then((ok) => {
      if (!ok || this.rahmenAnsicht !== v) return;
      sfx('common/funkeln', { vol: 0.45 });
      this.burst('funkeln', -420, 420, { count: 4 });
      this.burst('funkeln', 420, 1000, { count: 4 });
      if (!this.szene.gerahmt) {
        this.szene.gerahmt = true;
        belohne(this, 'malhaus_regenbogen', 0, 760);
      } else {
        voice('malhaus_rahmen', { nurWenn: () => this.aktiv && this.rahmenAnsicht === v });
      }
    });
    v._zu = this.after(4.8, () => { if (this.rahmenAnsicht === v) this.schliesseRahmen(); });
  }

  schliesseRahmen(sofort = false) {
    const v = this.rahmenAnsicht;
    if (!v) return;
    this.rahmenAnsicht = null;
    v._zu?.kill();
    v.dunkel.eventMode = 'none';
    if (sofort) {
      v.destroy({ children: true });
      return;
    }
    this.tween(v.bildC, { alpha: 0, scale: 0.94 }, 0.45, { ease: 'sineInOut' });
    this.tween(v.dunkel, { alpha: 0 }, 0.45, { ease: 'sineInOut' }).then(() => { if (!v.destroyed) v.destroy({ children: true }); });
  }

  // --- Ablauf ---

  betreten() {
    this.zeigeFarbe(this.szene.farbe, true);
    // tatHier: das Kind hat auf dieser Seite seit dem Betreten schon etwas gewählt oder aufs Blatt gebracht –
    // dann braucht es den Hinweis der Seite nicht mehr
    this.tatHier = false;
    this.szene.sprich(this);
  }

  verlassen() {
    this._hinweis?.kill();
    this._hinweis = null;
    this.szene.finger?.allesLos(this);
    this.schliesseRahmen(true);
    this.fingerWeg?.();
    // das Atmen endet beim Wegblättern; der goldene Ring bleibt als ruhige Einladung
    this._rahmenAtmen?.stop();
    this._rahmenAtmen = null;
  }

  update(dt, t) {
    this.flaeche?.auffrischen();
    this.deko?.update(dt, t);
    this.staffeleiRuhe -= dt;
    if (this.rahmenAnsicht) this.rahmenAnsicht._seit += dt;
  }

  /** Seiten-Koordinaten eines Pixi-Ereignisses */
  ort(e) {
    return this.welt.toLocal(e.global);
  }
}

// ---------------------------------------------------------------- Seite 1: Ausmalen

class Ausmalen extends MalSeite {
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

    this.flaeche.sprite.on('pointerdown', (e) => this.tippe(e));
    // Alle Bilder werden in Ruhe stückweise zerlegt (siehe update) – auch das erste: Es zeigt bis dahin seine Linien
    // (sieht genauso aus), so verlängert das Rechnen weder das Laden noch das Blättern zu dieser Seite.
    this.vorarbeit = null;  // { id, schritte, ms } – das Bild, das gerade stückweise zerlegt wird
    this.angezeigt = null;  // Bild, das wirklich auf dem Blatt liegt (beim Bildwechsel erst nach dem Ausblenden neu)
    this.d = null;          // seine Flächen (null, solange es noch zerlegt wird)
    this.bildNr = -1;
    this.waehleBild(1, true); // die Kuh liegt schon bereit
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
      const id = vorne || BILDER.find((b) => !ZERLEGT.has(this.schluessel(b)));
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
      // fertig bemalt und noch nicht gerahmt? Dann lädt der Rahmen wieder ein
      if (this.belohnt.has(id) && !this.gerahmteBilder?.has(id)) this.ladeZumRahmen();
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

  tippe(e) {
    this.tatHier = true;
    if (!this.angezeigt) return;
    const p = this.ort(e);
    // Das Blatt wird gerade ausgetauscht (neues Bild oder „neues Blatt", noch vor dem Tausch): Der Tipp gilt dem
    // Blatt, das gleich kommt. Sofort ein weicher Ring als Antwort (kein Ton – das Wusch läuft schon), gefärbt wird,
    // sobald das neue Blatt liegt.
    if (this._tausch) {
      this.welle(p.x, p.y, FARBEN[this.szene.farbe].rgb);
      const n = (this._nachholen ||= []);
      if (n.length < 4) n.push({ x: p.x, y: p.y, farbe: this.szene.farbe });
      return;
    }
    this.male(p, this.szene.farbe);
  }

  /** Die Fläche an der Stelle p (Seiten-Koordinaten) in Farbe Nr. farbe füllen. leise: ohne Ton und Ring (Nachholen) */
  male(p, farbe, leise = false) {
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
      this.gerahmteBilder?.delete(this.angezeigt);
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
    if (!vorher && this._leert) this._tausch = true;
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
      belohne(this, 'malhaus_stift', b.x + b.w / 2, b.y + b.h * 0.42);
      // nur, wenn das Bild noch daliegt und nicht inzwischen ein neues Blatt genommen wurde
      this.after(2.4, () => { if (this.angezeigt === id && this.belohnt.has(id)) this.ladeZumRahmen(); });
    });
  }

  zeigeRahmen() {
    const auf = !this.rahmenAnsicht;
    super.zeigeRahmen();
    if (auf && this.angezeigt) (this.gerahmteBilder ||= new Set()).add(this.angezeigt);
  }

  // geleert wird das Bild, das wirklich auf dem Blatt liegt (dazu gehören this.farben)
  leereBlatt() {
    const id = this.angezeigt;
    this.farben?.clear();
    this.belohnt.delete(id);
    this.gerahmteBilder?.delete(id);
    if (this.d) this.malbild.alles(this.farben || new Map());
    this.flaeche.schmutzig = true;
    this.nachholen();
  }

  update(dt, t) {
    super.update(dt, t);
    this.ploppRuhe -= dt;
    this.zerlegeVorrat();
  }

  // Zeige-Hand (nur die ersten zwei Hinweise kommen vor dem Pfeil zur nächsten Seite):
  //   fertig gemalt → Rahmen, dann ein anderes Bild
  //   sonst         → eine große, noch weiße Fläche; dann ein anderer Topf (nach ein paar Farben: ein anderes Bild)
  hinweise() {
    const naechstesBild = this.karten[(this.bildNr + 1) % this.karten.length];
    if (!this.d) {
      // Flächen noch nicht bereit (nur ganz kurz nach dem Bildwechsel): mitten aufs Blatt tippen
      const b = this.blatt;
      return [{ x: b.x + b.w * 0.5, y: b.y + b.h * 0.5 }, naechstesBild];
    }
    const ziel = this.weisseFlaeche();
    if (this.rahmenBereit || !ziel) return [this.rahmenKnopf, naechstesBild];
    const zweites = this.getippt >= 4 ? naechstesBild : this.toepfe[(this.szene.farbe + 3) % FARBEN.length];
    return [ziel, zweites];
  }

  weisseFlaeche() {
    const d = this.d;
    if (!d) return null;
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

// ---------------------------------------------------------------- Seite 2: Frei malen

const MAL_GENUG = 2500;        // so viele Einheiten Strich, dann lädt der Rahmen ein

const WERKZEUGE = [
  { id: 'pinsel', tex: 'malhaus/pinsel_dick', breite: 46, groesse: 230, spitze: true },
  { id: 'stift', tex: 'malhaus/stift_dick', breite: 22, groesse: 215, spitze: true },
  { id: 'regenbogen', tex: 'malhaus/icon_freimalen', breite: 40, groesse: 250 },
  { id: 'schwamm', tex: 'malhaus/radierschwamm', breite: 120, groesse: 215 },
];

class Freimalen extends MalSeite {
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

    // Ziel der Zeige-Hand „mal mit dem Finger": ein unsichtbarer Punkt auf dem Blatt. Bewusst kein Sprite –
    // bei einem Sprite legt die Hand eine halb durchsichtige Kopie davon an (beim Blatt ein großes weißes Rechteck).
    // Die Füllung ist fast durchsichtig (nicht alpha 0 am Objekt), damit die Hand das Ziel als sichtbar erkennt.
    this.malZiel = new PIXI.Graphics().circle(0, 0, 30).fill({ color: 0xffffff, alpha: 0.01 });
    this.malZiel.eventMode = 'none';
    this.malZiel.label = 'malZiel';
    this.malZiel.position.set(b.x + b.w * 0.3, b.y + b.h * 0.62);
    this.malZiel.zIndex = 6;
    this.welt.addChild(this.malZiel);

    this.flaeche.sprite.on('pointerdown', (e) => this.beginne(e));
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

  farbeGewaehlt() {
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
    if (s.w.id !== 'schwamm') this.mitzaehlen(d * this.flaeche.skala, MAL_GENUG);
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
    if (this.striche.size === 0) this.hue = (this.hue + dt * 6) % 360;
  }

  // Zeige-Hand (nur die ersten zwei Hinweise kommen vor dem Pfeil zur nächsten Seite):
  //   genug gemalt → Rahmen, dann „weiter malen"
  //   sonst        → mit dem Finger über das Blatt ziehen; dann ein anderer Topf (wer schon malt: der Regenbogen)
  hinweise() {
    const b = this.blatt;
    const malen = { von: this.malZiel, nach: { x: b.x + b.w * 0.72, y: b.y + b.h * 0.34 } };
    if (this.rahmenBereit) return [this.rahmenKnopf, malen];
    const zweites = (this.gemacht || 0) > 500 && this.werkzeug !== 2
      ? this.werkzeugFaecher[2]
      : this.toepfe[(this.szene.farbe + 5) % FARBEN.length];
    return [malen, zweites];
  }
}

// ---------------------------------------------------------------- Seite 3: Stempeln

const STEMPEL_GROESSE = 215;   // Größe eines Abdrucks auf dem Blatt (± 15 %)
const STEMPEL_ABSTAND = 195;   // beim Ziehen: so weit auseinander
const STEMPEL_GENUG = 10;      // so viele Abdrücke, dann lädt der Rahmen ein

class Stempeln extends MalSeite {
  satz = 'malhaus_stempel';

  aufbau() {
    this.grundAufbau();
    const b = this.blatt;
    this.flaeche = new Malflaeche(this, 'stempel', b, Math.round(b.w), Math.round(b.h));
    this.baueRahmenKnopf();
    this.stempelNr = 0;
    this.klackRuhe = 0;
    this.druckRuhe = 0;

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

  waehleStempel(i) {
    this.tatHier = true;
    if (this.stempelNr === i) fx.wobble(this.stempel[i].inhalt, 0.06);
    this.stempelNr = i;
    this.stempel.forEach((f, k) => { if ((k === i) !== f.gewaehlt) f.markiere(k === i); });
    sfx('common/plopp', { vol: 0.5, rate: 0.9 + i * 0.03 });
  }

  beginne(e) {
    const p = this.ort(e);
    if (!this.flaeche.aufBlatt(p.x, p.y)) return;
    this.tatHier = true;
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

    this.mitzaehlen(1, STEMPEL_GENUG);

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

  update(dt, t) {
    super.update(dt, t);
    this.klackRuhe -= dt;
    this.druckRuhe -= dt;
  }

  // Zeige-Hand: genug gestempelt → Rahmen, dann ein anderer Stempel; sonst aufs Blatt tippen, dann anderer Stempel
  hinweise() {
    const b = this.blatt;
    const anderer = this.stempel[(this.stempelNr + 2) % this.stempel.length];
    if (this.rahmenBereit) return [this.rahmenKnopf, anderer];
    return [{ x: b.x + b.w * rand(0.3, 0.7), y: b.y + b.h * rand(0.3, 0.6) }, anderer];
  }
}

// ---------------------------------------------------------------- Szene

export default class Malhaus extends SeitenSzene {
  static id = 'malhaus';
  static packs = ['malhaus', 'tiere'];
  static tiere = ['katze'];
  static music = 'musik/atelier';
  static seiten = [Ausmalen, Freimalen, Stempeln];

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
