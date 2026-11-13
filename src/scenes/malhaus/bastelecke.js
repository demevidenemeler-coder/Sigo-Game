// Seite 4 des Malhauses: die Bastelecke (vor hg_atelier; über dem Blatt der Staffelei hängt ein Brett mit zwei
// Regalbrettern, davor steht ein Basteltisch, rechts ein kleiner Brennofen). Alles ist gezeichnet (PIXI.Graphics),
// es braucht keine neuen großen Bilder.
//
// Ein Tier kommt zu Besuch und wünscht sich abwechselnd (nie zweimal hintereinander dasselbe):
//   Knete:  Knete in einer Farbe nehmen → hin und her rollen (Klumpen → Kugel → Wurst) → Form aussuchen (Schnecke,
//           Schale, Raupe, Blume) → bunte Knete-Punkte draufdrücken → in den Ofen (glänzt danach) → dem Besuch geben →
//           die Figur kommt ins Regal (bleibt über Besuche hinweg, store 'malhaus.regal', höchstens 12).
//   Kette:  Perlen aus den Schälchen auf die Schnur fädeln (10 Stück) → die Enden zusammenknoten (die Kette schließt
//           sich mit einer Schleife) → dem Besuch umhängen: er trägt sie, freut sich und geht damit nach Hause.
// Nichts kann schiefgehen: jede Farbe, jede Form, jede Perle ist recht. Die Zeige-Hand zeigt den nächsten Schritt.

import { sfx, voice, note, tap, fx, store, rand, pick, clamp, PIXI } from '../../engine/index.js';
import { Seite } from '../../gemeinsam/seiten.js';
import { belohne } from '../../gemeinsam/sticker.js';
import { baueDeko } from './deko.js';
import { GalerieLeine, galerieLaden, Besuch, naechsterWunsch } from './ablauf.js';

// ---------------------------------------------------------------- Farben, Formen, Wünsche

export const KNETE_FARBEN = [
  0xe8574a, // rot
  0xf59a2c, // orange
  0xffd23d, // gelb
  0x8fcf55, // grün
  0x4f8fe0, // blau
  0xf59cc4, // rosa
  0x9b6fd6, // lila
];
const ROT = 0; const ORANGE = 1; const GELB = 2; const GRUEN = 3; const BLAU = 4; const ROSA = 5; const LILA = 6;

const FORMEN = ['schnecke', 'schale', 'raupe', 'blume'];
// Perlen: jede Farbe hat ihre Form
const PERL_FORM = ['kugel', 'kugel', 'stern', 'wuerfel', 'kugel', 'herz', 'stern'];

const KNETE_WUENSCHE = [
  { art: 'knete', tier: 'maus', form: 'schnecke', farbe: ORANGE },
  { art: 'knete', tier: 'schaf', form: 'blume', farbe: ROSA },
  { art: 'knete', tier: 'fuchs', form: 'schale', farbe: BLAU },
  { art: 'knete', tier: 'hase', form: 'raupe', farbe: GRUEN },
  { art: 'knete', tier: 'baer', form: 'schale', farbe: GELB },
  { art: 'knete', tier: 'pinguin', form: 'schnecke', farbe: LILA },
  { art: 'knete', tier: 'kuh', form: 'raupe', farbe: ROT },
  { art: 'knete', tier: 'ente', form: 'blume', farbe: ORANGE },
];
const KETTE_WUENSCHE = [
  { art: 'kette', tier: 'schaf', farben: [ROT, GELB] },
  { art: 'kette', tier: 'fuchs', farben: [ORANGE, GRUEN] },
  { art: 'kette', tier: 'maus', farben: [ROSA, BLAU] },
  { art: 'kette', tier: 'eule', farben: [LILA, GELB] },
  { art: 'kette', tier: 'hund', farben: [BLAU, ROT] },
  { art: 'kette', tier: 'kuh', farben: [ROSA, GRUEN] },
  { art: 'kette', tier: 'hase', farben: [GELB, ROSA] },
];

// ---------------------------------------------------------------- Maße (Seiten-Koordinaten)

const BRETT = { x0: -808, y0: 176, x1: 790, y1: 760 };        // Brett über dem Blatt der Staffelei
const REGAL_Y = [430, 662];                                   // Oberkante der beiden Regalbretter
const REGAL_X = [-115, 115, -345, 345, -575, 575];            // Plätze je Brett, von der Mitte nach außen
const REGAL_MAX = 12;
const REGAL_SKALA = 0.5;
const TISCH_Y = 730;                                          // Hinterkante der Tischplatte
const WERK = { x: 0, y: 1035 };                               // Standpunkt der Knete-Figur auf dem Tisch
const ZONE = new PIXI.Rectangle(-640, 760, 1280, 420);        // Arbeitsfläche (Tippen, Rollen)
const REIHE_Y = 1405;
const OFEN = { x: 918, y: 930 };                              // Mitte des Ofenfensters (ganz im Kernbereich)
const ROLL_GENUG = 2600;                                      // so viel Weg (Einheiten) über der Knete → Wurst
const PUNKTE_GENUG = 4;                                       // so viele Punkte, dann lädt der Ofen ein
const PUNKTE_MAX = 14;
const PERLEN = 10;                                            // Perlen auf einer Kette
const SCHNUR = (t) => ({ x: -340 + 680 * t, y: 852 + 175 * Math.sin(Math.PI * t) });
const KREIS = { x: 0, y: 935, r: 158 };

// ---------------------------------------------------------------- kleine Hilfen

function misch(rgb, ziel, k) {
  const r = (rgb >> 16) & 255; const g = (rgb >> 8) & 255; const b = rgb & 255;
  const R = (ziel >> 16) & 255; const G = (ziel >> 8) & 255; const B = ziel & 255;
  const m = (a, c) => Math.round(a + (c - a) * k);
  return (m(r, R) << 16) | (m(g, G) << 8) | m(b, B);
}
const hell = (rgb, k) => misch(rgb, 0xffffff, k);
const dunkel = (rgb, k) => misch(rgb, 0x3a2216, k);

function handZiel(parent, x, y, label) {
  const g = new PIXI.Graphics().circle(0, 0, 30).fill({ color: 0xffffff, alpha: 0.01 });
  g.eventMode = 'none';
  g.label = label;
  g.position.set(x, y);
  g.zIndex = 6;
  parent.addChild(g);
  return g;
}

function augen(g, x, y, r = 8, abstand = 0) {
  for (const dx of abstand ? [-abstand, abstand] : [0]) {
    g.circle(x + dx, y, r).fill(0x2b2230).circle(x + dx + r * 0.35, y - r * 0.35, r * 0.34).fill(0xffffff);
  }
}

function backe(g, x, y, r = 9) {
  g.ellipse(x, y, r, r * 0.7).fill({ color: 0xff8a8a, alpha: 0.55 });
}

/** weicher Knete-Glanz und Schatten auf einer runden Fläche */
function kugelLicht(g, x, y, r) {
  g.ellipse(x + r * 0.12, y + r * 0.45, r * 0.75, r * 0.35).fill({ color: 0x3a2216, alpha: 0.12 });
  g.ellipse(x - r * 0.35, y - r * 0.4, r * 0.32, r * 0.2).fill({ color: 0xffffff, alpha: 0.35 });
}

/**
 * Knete zeichnen. form: 'klumpen' | 'kugel' | 'wurst_kurz' | 'wurst' | 'schnecke' | 'schale' | 'raupe' | 'blume'.
 * Unterkante bei y = 0, etwa 300 breit.
 */
export function zeichneKnete(g, form, rgb) {
  g.clear();
  const d = dunkel(rgb, 0.22);
  const h = hell(rgb, 0.35);
  if (form === 'klumpen') {
    g.circle(-42, -58, 58).fill(rgb).circle(40, -54, 54).fill(rgb).circle(2, -96, 50).fill(rgb).circle(-6, -44, 60).fill(rgb);
    g.circle(-30, -100, 18).fill({ color: 0xffffff, alpha: 0.25 });
    g.ellipse(0, -14, 80, 14).fill({ color: 0x3a2216, alpha: 0.1 });
  } else if (form === 'kugel') {
    g.circle(0, -76, 76).fill(rgb);
    kugelLicht(g, 0, -76, 76);
  } else if (form === 'wurst_kurz' || form === 'wurst') {
    const w = form === 'wurst' ? 175 : 115;
    const r = form === 'wurst' ? 30 : 42;
    g.roundRect(-w, -2 * r, 2 * w, 2 * r, r).fill(rgb);
    g.roundRect(-w + 18, -2 * r + 10, 2 * w - 60, r * 0.45, r * 0.22).fill({ color: 0xffffff, alpha: 0.3 });
    g.roundRect(-w + 10, -r * 0.55, 2 * w - 20, r * 0.45, r * 0.22).fill({ color: 0x3a2216, alpha: 0.1 });
  } else if (form === 'schnecke') {
    g.roundRect(-140, -44, 290, 44, 22).fill(h);                        // Körper
    g.circle(122, -66, 38).fill(h);                                     // Kopf
    g.moveTo(112, -98).lineTo(100, -142).stroke({ width: 8, color: h, cap: 'round' });
    g.moveTo(134, -98).lineTo(146, -140).stroke({ width: 8, color: h, cap: 'round' });
    g.circle(100, -146, 10).fill(d).circle(146, -144, 10).fill(d);
    g.circle(-14, -112, 82).fill(rgb);                                  // Haus
    const pts = [];
    for (let i = 0; i <= 40; i++) {
      const a = (i / 40) * Math.PI * 4.2;
      const r = 70 * (1 - i / 46);
      pts.push(-14 + Math.cos(a) * r * 0.92, -112 + Math.sin(a) * r);
    }
    g.moveTo(pts[0], pts[1]);
    for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]);
    g.stroke({ width: 10, color: d, cap: 'round', join: 'round' });
    kugelLicht(g, -14, -112, 82);
    augen(g, 132, -72, 8);
    backe(g, 146, -54);
  } else if (form === 'schale') {
    g.ellipse(0, -10, 70, 14).fill(d);                                  // Fuß
    g.moveTo(-150, -128).bezierCurveTo(-150, 20, 150, 20, 150, -128).closePath().fill(rgb);
    g.ellipse(0, -128, 150, 34).fill(rgb);
    g.ellipse(0, -126, 128, 24).fill(d);                                // Innenseite
    g.ellipse(-70, -80, 34, 18).fill({ color: 0xffffff, alpha: 0.28 });
    g.ellipse(0, -132, 150, 34).stroke({ width: 6, color: h, alpha: 0.8 });
  } else if (form === 'raupe') {
    for (let i = 0; i < 5; i++) {
      const x = -150 + i * 64;
      const y = -46 - (i % 2) * 16;
      g.circle(x, y, 44).fill(i % 2 ? h : rgb);
      g.circle(x - 14, y - 16, 10).fill({ color: 0xffffff, alpha: 0.25 });
      g.ellipse(x - 6, -6, 14, 7).fill(d);                              // Füßchen
    }
    g.circle(178, -84, 52).fill(rgb);
    kugelLicht(g, 178, -84, 52);
    g.moveTo(166, -130).lineTo(152, -168).stroke({ width: 7, color: d, cap: 'round' });
    g.moveTo(190, -130).lineTo(204, -166).stroke({ width: 7, color: d, cap: 'round' });
    g.circle(152, -172, 9).fill(d).circle(204, -170, 9).fill(d);
    augen(g, 180, -92, 9, 17);
    backe(g, 152, -70);
    backe(g, 208, -70);
  } else if (form === 'blume') {
    g.roundRect(-11, -96, 22, 96, 11).fill(0x6fbf4a);                   // Stiel
    g.ellipse(-44, -40, 38, 16).fill(0x7fcf58);
    g.ellipse(44, -54, 38, 16).fill(0x7fcf58);
    g.ellipse(0, -6, 64, 12).fill(0x6fbf4a);
    const mx = 0;
    const my = -168;
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 - Math.PI / 2;
      g.circle(mx + Math.cos(a) * 62, my + Math.sin(a) * 62, 46).fill(i % 2 ? rgb : h);
    }
    const mitte = rgb === KNETE_FARBEN[GELB] ? KNETE_FARBEN[ORANGE] : KNETE_FARBEN[GELB];
    g.circle(mx, my, 48).fill(mitte);
    kugelLicht(g, mx, my, 48);
    augen(g, mx, my - 6, 8, 15);
    g.moveTo(mx - 12, my + 16).quadraticCurveTo(mx, my + 26, mx + 12, my + 16).stroke({ width: 5, color: 0x6b3a2a, cap: 'round' });
  }
  return g;
}

/** Bereich der Form (zum Platzieren der Punkte und der Hand) – grob, in Figur-Koordinaten */
const FORM_BOX = {
  schnecke: { x0: -90, y0: -180, x1: 60, y1: -50 },
  schale: { x0: -120, y0: -110, x1: 120, y1: -30 },
  raupe: { x0: -175, y0: -84, x1: 130, y1: -22 },
  blume: { x0: -95, y0: -250, x1: 95, y1: -90 },
};

function zeichnePunkte(g, punkte) {
  g.clear();
  for (const [x, y, c] of punkte) {
    g.circle(x, y + 3, 16).fill({ color: 0x3a2216, alpha: 0.12 });
    g.circle(x, y, 16).fill(c);
    g.circle(x - 5, y - 5, 5).fill({ color: 0xffffff, alpha: 0.45 });
  }
}

function zeichneGlanz(g, form) {
  const b = FORM_BOX[form] || FORM_BOX.schale;
  g.clear();
  g.ellipse(b.x0 + (b.x1 - b.x0) * 0.3, b.y0 + (b.y1 - b.y0) * 0.25, (b.x1 - b.x0) * 0.18, 12)
    .fill({ color: 0xffffff, alpha: 0.45 });
  g.circle(b.x0 + (b.x1 - b.x0) * 0.55, b.y0 + (b.y1 - b.y0) * 0.18, 6).fill({ color: 0xffffff, alpha: 0.6 });
}

/** Eine fertige Knete-Figur (Körper, Punkte, Glanz) – für Tisch, Regal und Denkblase */
function baueFigur(form, rgb, punkte = [], glanz = false) {
  const c = new PIXI.Container({ label: 'knete' });
  c.koerper = zeichneKnete(new PIXI.Graphics(), form, rgb);
  c.punkte = new PIXI.Graphics();
  zeichnePunkte(c.punkte, punkte);
  c.glanz = new PIXI.Graphics();
  zeichneGlanz(c.glanz, form);
  c.glanz.alpha = glanz ? 1 : 0;
  c.addChild(c.koerper, c.punkte, c.glanz);
  c.eventMode = 'none';
  return c;
}

/** Perle zeichnen (Mitte 0,0, etwa 56 groß) */
function zeichnePerle(g, form, rgb) {
  g.clear();
  const d = dunkel(rgb, 0.2);
  if (form === 'stern') {
    const p = [];
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      const r = i % 2 ? 15 : 32;
      p.push(Math.cos(a) * r, Math.sin(a) * r);
    }
    g.poly(p).fill(rgb).stroke({ width: 3, color: d, join: 'round' });
  } else if (form === 'wuerfel') {
    g.roundRect(-25, -25, 50, 50, 12).fill(rgb).stroke({ width: 3, color: d });
  } else if (form === 'herz') {
    g.moveTo(0, 26).bezierCurveTo(-40, 0, -26, -32, 0, -14).bezierCurveTo(26, -32, 40, 0, 0, 26).closePath()
      .fill(rgb).stroke({ width: 3, color: d });
  } else {
    g.circle(0, 0, 27).fill(rgb).stroke({ width: 3, color: d });
  }
  g.circle(-9, -9, 7).fill({ color: 0xffffff, alpha: 0.45 });
  g.circle(0, 0, 4).fill({ color: 0x3a2216, alpha: 0.35 });   // Loch für die Schnur
  return g;
}

function schleife(g) {
  g.clear();
  g.ellipse(-22, 0, 22, 13).fill(0xd9b27c).stroke({ width: 3, color: 0xa8743f });
  g.ellipse(22, 0, 22, 13).fill(0xd9b27c).stroke({ width: 3, color: 0xa8743f });
  g.moveTo(-4, 6).lineTo(-14, 30).stroke({ width: 5, color: 0xc9a46a, cap: 'round' });
  g.moveTo(4, 6).lineTo(14, 30).stroke({ width: 5, color: 0xc9a46a, cap: 'round' });
  g.circle(0, 0, 9).fill(0xc9a46a).stroke({ width: 3, color: 0xa8743f });
  return g;
}

// ---------------------------------------------------------------- Regal (Daten, bleiben über Besuche)

function regalLaden() {
  let roh = [];
  try { roh = store.get('malhaus.regal', []); } catch { roh = []; }
  if (!Array.isArray(roh)) return [];
  const belegt = new Set();
  const liste = [];
  // erst Unbrauchbares aussortieren, dann die neuesten 12 nehmen
  const gut = roh.filter((e) => e && FORMEN.includes(e.form) && typeof e.rgb === 'number');
  for (const e of gut.slice(-REGAL_MAX)) {
    let platz = Number.isInteger(e.platz) && e.platz >= 0 && e.platz < REGAL_MAX && !belegt.has(e.platz) ? e.platz : -1;
    if (platz < 0) for (let p = 0; p < REGAL_MAX; p++) if (!belegt.has(p)) { platz = p; break; }
    if (platz < 0) continue;
    belegt.add(platz);
    const punkte = Array.isArray(e.punkte) ? e.punkte.filter((p) => Array.isArray(p) && p.length === 3).slice(0, PUNKTE_MAX) : [];
    liste.push({ form: e.form, rgb: e.rgb, punkte, platz });
  }
  return liste;
}

function regalSpeichern(liste) {
  try {
    store.set('malhaus.regal', liste.map((e) => ({ form: e.form, rgb: e.rgb, punkte: e.punkte, platz: e.platz })));
  } catch { /* egal */ }
}

function regalOrt(platz) {
  const brett = platz < 6 ? 0 : 1;
  return { x: REGAL_X[platz % 6], y: REGAL_Y[brett] };
}

// ---------------------------------------------------------------- die Seite

export class Bastelecke extends Seite {
  static hg = 'malhaus/hg_atelier';

  get satz() {
    return this.wunsch?.art === 'kette' ? 'malhaus_perlen' : 'malhaus_knete';
  }

  aufbau() {
    this.deko = baueDeko(this);
    this.baueBrettUndTisch();
    this.baueOfen();
    this.baueRegal();
    galerieLaden();
    this.leine = new GalerieLeine(this);
    this.besuch = new Besuch(this, { onTap: () => this.besuchGetippt() });

    // Reihe 1: Knete in sieben Farben (auch für die Punkte)
    this.klumpen = KNETE_FARBEN.map((rgb, i) => {
      const f = this.fach((i - 3) * 222, REIHE_Y, 210, 230);
      const k = zeichneKnete(new PIXI.Graphics(), 'klumpen', rgb);
      k.scale.set(0.62);
      k.y = 52;
      f.inhalt.addChild(k);
      f.label = 'knete:' + i;
      tap(f, () => this.klumpenGetippt(i), { sound: null });
      return f;
    });
    // Reihe 2: vier Formen (zeigen die Form in der Farbe der Knete)
    this.formKarten = FORMEN.map((form, i) => {
      const f = this.fach((i - 1.5) * 280, REIHE_Y, 260, 240);
      const karte = new PIXI.Graphics().roundRect(-115, -95, 230, 190, 22).fill(0xfff8ec).stroke({ width: 6, color: 0xd9c4a0 });
      f.bild = new PIXI.Graphics();
      f.bild.scale.set(0.52);
      f.bild.y = form === 'blume' ? 74 : 52;
      f.inhalt.addChild(karte, f.bild);
      f.label = 'form:' + form;
      f.form = form;
      tap(f, () => this.formGetippt(form), { sound: null });
      return f;
    });
    // Reihe 3: Schälchen mit Perlen
    this.schalen = KNETE_FARBEN.map((rgb, i) => {
      const f = this.fach((i - 3) * 222, REIHE_Y, 210, 230);
      const sch = new PIXI.Graphics()
        .ellipse(0, 40, 92, 34).fill(0xd79a5c).stroke({ width: 5, color: 0xa86f3a })
        .ellipse(0, 22, 84, 22).fill(0xb97e45);
      f.inhalt.addChild(sch);
      for (const [x, y] of [[-34, 14], [30, 12], [0, -10]]) {
        const p = zeichnePerle(new PIXI.Graphics(), PERL_FORM[i], rgb);
        p.position.set(x, y);
        p.scale.set(0.85);
        f.inhalt.addChild(p);
      }
      f.label = 'perlen:' + i;
      tap(f, () => this.schaleGetippt(i), { sound: null });
      return f;
    });
    for (const r of [this.klumpen, this.formKarten, this.schalen]) this.zeigeReihe(r, false, true);

    // Arbeitsfläche auf dem Tisch (Tippen, Rollen, Geben)
    const zone = new PIXI.Container({ label: 'werkbank' });
    zone.zIndex = 35;
    zone.eventMode = 'static';
    zone.cursor = 'pointer';
    zone.hitArea = ZONE;
    zone.on('pointerdown', (e) => this.werkGetippt(e));
    this.welt.addChild(zone);

    // Ziele der Zeige-Hand
    this.zielLinks = handZiel(this.welt, -230, WERK.y - 60, 'rollenLinks');
    this.zielFigur = handZiel(this.welt, WERK.x, WERK.y - 90, 'figur');
    this.zielEnden = handZiel(this.welt, 0, 850, 'kettenEnden');
    this.zielKette = handZiel(this.welt, KREIS.x, KREIS.y, 'kette');

    this.figur = null;       // Knete auf dem Tisch
    this.kette = null;       // { c, schnur, perlen:[{g, i, farbe}], schleife }
    this.phase = 'warten';   // 'warten' | 'arbeit' | 'fertig'
    this.schritt = null;
    this.rundenNr = 0;
    this.wunsch = null;
    this.wunschDa = false;
    this.letzteArt = Math.random() < 0.5 ? 'knete' : 'kette';
    // nur zum Testen: ?test=1&bastel=knete|kette legt die erste Runde fest
    try {
      const q = new URLSearchParams(location.search);
      if (q.get('test') === '1' && ['knete', 'kette'].includes(q.get('bastel'))) {
        this.letzteArt = q.get('bastel') === 'knete' ? 'kette' : 'knete';
      }
    } catch { /* egal */ }
    this.beutel = { knete: [], kette: [] };
    this.ruhe = 0;
    this.rollRuhe = 0;
    this.tonRuhe = 0;
    this.punktFarbe = 0;
  }

  // ---------------------------------------------------------------- Bauteile

  fach(x, y, breite, hoehe) {
    const c = new PIXI.Container({ label: 'fach' });
    c.position.set(x, y);
    c.zIndex = 30;
    const s = new PIXI.Graphics()
      .ellipse(0, 92, breite * 0.42, 18).fill({ color: 0x5a3a1a, alpha: 0.12 })
      .ellipse(0, 92, breite * 0.32, 13).fill({ color: 0x5a3a1a, alpha: 0.12 });
    c.schein = new PIXI.Graphics();
    for (let i = 0; i < 4; i++) {
      const k = 1 - i * 0.18;
      c.schein.ellipse(0, 0, breite * 0.58 * k, hoehe * 0.5 * k).fill({ color: 0xfff1a8, alpha: 0.22 });
    }
    c.schein.alpha = 0;
    c.inhalt = new PIXI.Container();
    c.addChild(s, c.schein, c.inhalt);
    c.gewaehlt = false;
    c.markiere = (an) => {
      if (an === c.gewaehlt) return;
      c.gewaehlt = an;
      this.tween(c.inhalt, { y: an ? -14 : 0, scale: an ? 1.1 : 1 }, 0.3, { ease: 'sineInOut' });
      this.tween(c.schein, { alpha: an ? 1 : 0 }, 0.5, { ease: 'sineInOut' });
    };
    c.hitArea = new PIXI.Rectangle(-breite / 2, -hoehe / 2, breite, hoehe);
    c._heimY = y;
    this.welt.addChild(c);
    return c;
  }

  zeigeReihe(liste, an, sofort = false) {
    for (const c of liste) {
      if (an) {
        c.visible = true;
        c.eventMode = 'static';
        if (sofort) { c.alpha = 1; c.y = c._heimY; } else this.tween(c, { alpha: 1, y: c._heimY }, 0.45, { ease: 'sineInOut' });
      } else {
        c.eventMode = 'none';
        if (sofort) { c.alpha = 0; c.y = c._heimY + 70; c.visible = false; continue; }
        this.tween(c, { alpha: 0, y: c._heimY + 70 }, 0.4, { ease: 'sineInOut' }).then((ok) => { if (ok) c.visible = false; });
      }
    }
  }

  /** nur diese Reihe zeigen (oder keine) */
  reihe(r) {
    for (const x of [this.klumpen, this.formKarten, this.schalen]) {
      const sichtbar = x[0].visible && x[0].eventMode !== 'none';
      if (x === r && !sichtbar) this.zeigeReihe(x, true);
      if (x !== r && sichtbar) this.zeigeReihe(x, false);
    }
  }

  baueBrettUndTisch() {
    const { x0, y0, x1, y1 } = BRETT;
    const g = new PIXI.Graphics();
    // Brett (warmes helles Holz) mit Rahmen
    g.roundRect(x0, y0, x1 - x0, y1 - y0, 18).fill(0xeac393).stroke({ width: 14, color: 0xc48a52 });
    // senkrechte Bretter mit weicher Maserung
    for (let i = 0; i < 8; i++) {
      const x = x0 + ((x1 - x0) / 8) * i;
      if (i) g.moveTo(x, y0 + 8).lineTo(x, y1 - 8).stroke({ width: 4, color: 0xd2a26c, alpha: 0.8 });
      g.roundRect(x + 30, y0 + 40 + (i % 3) * 60, 10, 120, 5).fill({ color: 0xd9ad78, alpha: 0.5 });
      g.roundRect(x + 120, y0 + 330 - (i % 2) * 80, 8, 90, 4).fill({ color: 0xd9ad78, alpha: 0.45 });
    }
    g.roundRect(x0 + 10, y0 + 8, x1 - x0 - 20, 18, 9).fill({ color: 0xffffff, alpha: 0.18 });
    // zwei Regalbretter mit Stützen
    for (const y of REGAL_Y) {
      for (const x of [-640, 0, 640]) g.poly([x - 16, y + 20, x + 16, y + 20, x, y + 58]).fill(0xb98049);
      g.roundRect(-740, y, 1480, 24, 10).fill(0xc78a50).stroke({ width: 3, color: 0xa86f3a });
      g.roundRect(-730, y + 3, 1460, 6, 3).fill({ color: 0xffffff, alpha: 0.2 });
    }
    g.zIndex = 3;
    g.eventMode = 'none';
    this.welt.addChild(g);

    // Basteltisch
    const t = new PIXI.Graphics();
    t.roundRect(-800, 1180, 60, 150, 14).fill(0xb98049).roundRect(740, 1180, 60, 150, 14).fill(0xb98049);
    t.poly([-790, TISCH_Y, 790, TISCH_Y, 860, 1165, -860, 1165]).fill(0xe8b77f).stroke({ width: 6, color: 0xb98049, join: 'round' });
    t.poly([-760, TISCH_Y + 10, 760, TISCH_Y + 10, 770, TISCH_Y + 40, -770, TISCH_Y + 40]).fill({ color: 0xffffff, alpha: 0.14 });
    t.roundRect(-866, 1160, 1732, 66, 16).fill(0xc78a50).stroke({ width: 5, color: 0xa86f3a });
    // grüne Bastelunterlage
    t.roundRect(-600, 790, 1200, 350, 34).fill(0xa8d8c0).stroke({ width: 6, color: 0x7fbf9f });
    t.roundRect(-570, 812, 1140, 304, 26).stroke({ width: 3, color: 0xffffff, alpha: 0.35 });
    t.zIndex = 6;
    t.eventMode = 'none';
    this.welt.addChild(t);

    // Antippen des Bretts (ohne die Regalplätze): leises Klopfen
    const brettZone = new PIXI.Container({ label: 'brett' });
    brettZone.zIndex = 2;
    this.welt.addChild(brettZone);
    tap(brettZone, () => {
      if (this.ruhe > 0) return;
      this.ruhe = 0.3;
      sfx('common/klack', { vol: 0.35, rate: rand(0.8, 0.9) });
    }, { sound: null, squash: false, hitArea: new PIXI.Rectangle(x0, 270, x1 - x0, y1 - 270) });
  }

  baueOfen() {
    const o = new PIXI.Container({ label: 'ofen' });
    o.position.set(OFEN.x, OFEN.y);
    o.zIndex = 30;
    const g = new PIXI.Graphics();
    g.roundRect(-100, 150, 26, 130, 10).fill(0x8a5a3a).roundRect(74, 150, 26, 130, 10).fill(0x8a5a3a);
    g.ellipse(0, 290, 120, 18).fill({ color: 0x5a3a1a, alpha: 0.15 });
    g.roundRect(-118, -170, 236, 330, 56).fill(0xd98a5f).stroke({ width: 7, color: 0xa65c3a });
    g.roundRect(-96, -150, 70, 26, 13).fill({ color: 0xffffff, alpha: 0.2 });
    g.roundRect(-30, -205, 60, 44, 12).fill(0xa65c3a);                  // Schornstein
    g.circle(0, 0, 76).fill(0xf3d8b8).stroke({ width: 6, color: 0xa65c3a });
    g.circle(0, 0, 62).fill(0x5a3a2a);
    g.roundRect(-60, 110, 120, 24, 12).fill(0xa65c3a);
    for (const x of [-34, 0, 34]) g.circle(x, 122, 7).fill(0xf3d8b8);
    o.glut = new PIXI.Graphics().circle(0, 0, 60).fill({ color: 0xff9a3a, alpha: 0.6 }).circle(0, 0, 40).fill({ color: 0xffd070, alpha: 0.6 });
    o.glut.alpha = 0;
    o.tuer = new PIXI.Graphics()
      .circle(0, 0, 62).fill({ color: 0xe9a070, alpha: 0.82 })
      .ellipse(-22, -24, 20, 12).fill({ color: 0xffffff, alpha: 0.3 })
      .roundRect(40, -12, 26, 24, 10).fill(0xa65c3a);
    o.tuer.alpha = 0;
    o.addChild(g, o.tuer, o.glut);
    // Tippfläche: Ofen ohne die Beine (darunter schläft die Katze – deren Tippfläche bleibt frei)
    o.hitArea = new PIXI.Rectangle(-125, -210, 250, 380);
    tap(o, () => this.ofenGetippt(), { sound: null });
    this.welt.addChild(o);
    this.ofen = o;
  }

  baueRegal() {
    this.regal = regalLaden();
    this.regalPlaetze = [];
    for (let p = 0; p < REGAL_MAX; p++) {
      const ort = regalOrt(p);
      const c = new PIXI.Container({ label: 'regal:' + p });
      c.position.set(ort.x, ort.y);
      c.zIndex = 4;
      c.visible = false;
      this.welt.addChild(c);
      this.regalPlaetze.push(c);
      tap(c, () => this.regalGetippt(p), { sound: null, squash: false, hitArea: new PIXI.Rectangle(-112, -200, 224, 205) });
    }
    for (const e of this.regal) this.stelleInsRegal(e);
  }

  stelleInsRegal(e) {
    const c = this.regalPlaetze[e.platz];
    for (const k of c.removeChildren()) k.destroy({ children: true });
    const f = baueFigur(e.form, e.rgb, e.punkte, true);
    f.scale.set(REGAL_SKALA);
    c.addChild(f);
    c.visible = true;
    c.alpha = 1;
  }

  regalGetippt(p) {
    const c = this.regalPlaetze[p];
    if (!c.visible || c.children.length === 0) return;
    const f = c.children[0];
    fx.wobble(f, 0.08);
    note('glocke', pick([72, 74, 76, 79, 81]) + 12, { vol: 0.16 });
  }

  // ---------------------------------------------------------------- Runden

  betreten() {
    this.tatHier = false;
    if (!this.wunsch) this.starteRunde(0.5);   // zuerst: der Hinweis-Satz richtet sich nach der Art der Runde
    this.szene.sprich(this);
    this.leine.sync();
  }

  verlassen() {
    this._hinweis?.kill();
    this._hinweis = null;
    this.szene.finger?.allesLos(this);
  }

  starteRunde(warte = 0.2) {
    const art = this.letzteArt === 'knete' ? 'kette' : 'knete';
    this.letzteArt = art;
    const liste = art === 'knete' ? KNETE_WUENSCHE : KETTE_WUENSCHE;
    // nie dasselbe Tier zweimal hintereinander (auch über beide Arten hinweg)
    const letzt = this.wunsch;
    let w = naechsterWunsch(liste, letzt, this.beutel[art]);
    if (letzt && w.tier === letzt.tier) w = pick(liste.filter((x) => x.tier !== letzt.tier));
    this.wunsch = w;
    this.wunschDa = false;
    this.rundenNr++;
    this.phase = 'warten';
    this.schritt = art === 'knete' ? 'k_nehmen' : 'p_faedeln';
    this.punkte = [];
    this.rollWeg = 0;
    this.reihe(null);
    if (art === 'kette') this.legeSchnur();
    const runde = this.rundenNr;
    this.after(warte, () => {
      if (runde !== this.rundenNr) return;
      this.besuch.komm(w.tier).then((ok) => {
        if (runde !== this.rundenNr) return;
        this.phase = 'arbeit';
        this.reihe(art === 'knete' ? this.klumpen : this.schalen);
        if (art === 'knete') this.markiereKlumpen(-1);
        if (!ok) return;
        this.besuch.zeigeWunsch(this.wunschInhalt(w));
        this.wunschDa = true;
        if (art === 'knete') this.pulsiere(this.klumpen[w.farbe].inhalt, 4.5);
        else for (const f of w.farben) this.pulsiere(this.schalen[f].inhalt, 4.5);
        voice('malhaus_besuch', { nurWenn: () => this.aktiv && this.phase === 'arbeit' });
      });
    });
  }

  wunschInhalt(w) {
    const c = new PIXI.Container();
    if (w.art === 'knete') {
      const f = baueFigur(w.form, KNETE_FARBEN[w.farbe]);
      f.scale.set(w.form === 'blume' ? 0.36 : 0.42);
      f.y = w.form === 'blume' ? 52 : 34;
      c.addChild(f);
    } else {
      const g = new PIXI.Graphics().circle(0, 0, 40).stroke({ width: 4, color: 0xc9a46a });
      c.addChild(g);
      for (let i = 0; i < 8; i++) {
        const a = -Math.PI / 2 + (i + 0.5) * (Math.PI / 4);
        const f = w.farben[i % 2];
        const p = zeichnePerle(new PIXI.Graphics(), PERL_FORM[f], KNETE_FARBEN[f]);
        p.scale.set(0.42);
        p.position.set(Math.cos(a) * 40, Math.sin(a) * 40);
        c.addChild(p);
      }
      const s = schleife(new PIXI.Graphics());
      s.scale.set(0.5);
      s.y = -42;
      c.addChild(s);
    }
    return c;
  }

  pulsiere(obj, sek = 4) {
    if (!obj || obj.destroyed) return;
    obj._puls?.stop();
    const p = fx.pulse(obj, { staerke: 0.06, periode: 1.5 });
    obj._puls = p;
    this.after(sek, () => { p.stop(); if (obj._puls === p) obj._puls = null; });
  }

  besuchGetippt() {
    this.tatHier = true;
    if (this.schritt === 'k_fertig' || this.schritt === 'p_geben') {
      this.gib();
      return;
    }
    if (!this.wunschDa) return;
    const w = this.wunsch;
    if (w.art === 'knete') {
      if (this.schritt === 'k_nehmen') this.pulsiere(this.klumpen[w.farbe].inhalt, 3);
      else if (this.schritt === 'k_formen') this.pulsiere(this.formKarten[FORMEN.indexOf(w.form)].inhalt, 3);
    } else if (this.schritt === 'p_faedeln') {
      for (const f of w.farben) this.pulsiere(this.schalen[f].inhalt, 3);
    }
  }

  // ---------------------------------------------------------------- Knete

  markiereKlumpen(i) {
    this.klumpen.forEach((k, n) => k.markiere(n === i));
  }

  klumpenGetippt(i) {
    this.tatHier = true;
    if (this.phase !== 'arbeit') return;
    if (this.schritt === 'k_nehmen') {
      // Schritt 1: ein Stück Knete auf den Tisch
      this.schritt = 'k_rollen';
      this.farbe = i;
      this.punktFarbe = (i + 2) % KNETE_FARBEN.length;
      this.markiereKlumpen(i);
      sfx('common/rupf', { vol: 0.5 });
      const rgb = KNETE_FARBEN[i];
      const f = baueFigur('klumpen', rgb);
      f.form = 'klumpen';
      f.position.set(this.klumpen[i].x, REIHE_Y + 40);
      f.scale.set(0.62);
      f.zIndex = 40;
      this.welt.addChild(f);
      this.figur = f;
      this.tween(f, { x: WERK.x, y: WERK.y, scale: 1 }, 0.8, { ease: 'sineInOut' }).then((ok) => {
        if (!ok || f.destroyed) return;
        sfx('common/landen', { vol: 0.45 });
        fx.pop(f);
        this.reihe(null);
        const runde = this.rundenNr;
        this.after(0.4, () => {
          if (runde === this.rundenNr && this.schritt === 'k_rollen') {
            voice('malhaus_rollen', { nurWenn: () => this.aktiv && this.schritt === 'k_rollen' });
          }
        });
      });
      if (this.wunschDa && i === this.wunsch.farbe) this.besuch.nicke();
      return;
    }
    if (this.schritt === 'k_punkte') {
      // Farbe für die Punkte
      this.punktFarbe = i;
      this.markiereKlumpen(i);
      sfx('common/plopp', { vol: 0.5, rate: 0.9 + i * 0.04 });
      return;
    }
    fx.wobble(this.klumpen[i].inhalt, 0.05);
  }

  /** Finger auf der Arbeitsfläche */
  werkGetippt(e) {
    this.tatHier = true;
    if (this.phase !== 'arbeit') {
      if (this.figur && !this.figur.destroyed && this.schritt !== 'k_ofen') fx.wobble(this.figur, 0.03);
      return;
    }
    const p = this.welt.toLocal(e.global);
    const s = this.schritt;
    if (s === 'k_fertig' || s === 'p_geben') { this.gib(); return; }
    if (s === 'k_rollen') { this.rollBeginn(e, p); return; }
    if (s === 'k_punkte') { this.setzePunkt(p); return; }
    if (s === 'p_knoten') { this.knoten(); return; }
    if (s === 'k_formen' && this.figur) {
      fx.wobble(this.figur, 0.04);
      this.pulsiere(this.formKarten[FORMEN.indexOf(this.wunsch.form)].inhalt, 2.5);
      return;
    }
    if (s === 'p_faedeln') {
      for (const f of this.wunsch.farben) this.pulsiere(this.schalen[f].inhalt, 2.5);
      sfx('common/tipp', { vol: 0.4 });
      return;
    }
    if (s === 'k_nehmen') {
      this.pulsiere(this.klumpen[this.wunsch.farbe].inhalt, 2.5);
      sfx('common/tipp', { vol: 0.4 });
    }
  }

  // Schritt 2: rollen – Klumpen → Kugel → kurze Wurst → lange Wurst
  rollBeginn(e, p) {
    const strich = { letzt: { x: p.x, y: p.y } };
    this.rolle(150);
    this.szene.finger.halte(e.pointerId, {
      von: this,
      move: (g) => {
        if (this.schritt !== 'k_rollen') return;
        const q = this.welt.toLocal(g);
        const d = Math.hypot(q.x - strich.letzt.x, q.y - strich.letzt.y);
        if (d < 3) return;
        strich.letzt = { x: q.x, y: q.y };
        this.rolle(Math.min(d, 120));
      },
      end: () => {},
    });
  }

  rolle(d) {
    const f = this.figur;
    if (!f || f.destroyed) return;
    this.rollWeg += d;
    const k = this.rollWeg / ROLL_GENUG;
    const form = k >= 1 ? 'wurst' : k >= 0.66 ? 'wurst_kurz' : k >= 0.33 ? 'kugel' : 'klumpen';
    if (this.rollRuhe <= 0) {
      this.rollRuhe = 0.22;
      // Knete gibt nach: kurz breit und flach, dann zurück
      this.tween(f.koerper, { scaleX: 1.06, scaleY: 0.94 }, 0.1, { ease: 'sineOut' })
        .then((ok) => ok && this.tween(f.koerper, { scaleX: 1, scaleY: 1 }, 0.16, { ease: 'sineInOut' }));
    }
    if (this.tonRuhe <= 0) {
      this.tonRuhe = 0.5;
      sfx('common/wisch', { vol: 0.3, rate: rand(0.85, 0.95) });
    }
    if (form !== f.form) {
      f.form = form;
      zeichneKnete(f.koerper, form, KNETE_FARBEN[this.farbe]);
      sfx('common/plopp', { vol: 0.4, rate: 0.8 + k * 0.2 });
      fx.pop(f);
      if (form === 'wurst') this.gerollt();
    }
  }

  gerollt() {
    this.schritt = 'k_formen';
    this.szene.finger?.allesLos(this);
    this.burst('funkeln', WERK.x, WERK.y - 40, { count: 4 });
    if (this.wunschDa) this.besuch.nicke();
    const rgb = KNETE_FARBEN[this.farbe];
    for (const f of this.formKarten) {
      zeichneKnete(f.bild, f.form, rgb);
      f.markiere(false);
    }
    this.reihe(this.formKarten);
    this.after(0.6, () => {
      if (this.schritt === 'k_formen' && this.wunschDa) this.pulsiere(this.formKarten[FORMEN.indexOf(this.wunsch.form)].inhalt, 4);
    });
  }

  // Schritt 3: Form wählen – die Wurst wird zur Figur
  formGetippt(form) {
    this.tatHier = true;
    if (this.schritt !== 'k_formen' || !this.figur) return;
    this.schritt = 'k_punkte';
    this.formKarten.forEach((f) => f.markiere(f.form === form));
    const f = this.figur;
    f.form = form;
    sfx('common/wachsen', { vol: 0.5 });
    this.tween(f, { scaleX: 0.6, scaleY: 1.25 }, 0.25, { ease: 'sineIn' }).then((ok) => {
      if (!ok || f.destroyed) return;
      zeichneKnete(f.koerper, form, KNETE_FARBEN[this.farbe]);
      this.tween(f, { scaleX: 1, scaleY: 1 }, 0.45, { ease: 'backOut' });
      this.burst('funkeln', WERK.x, WERK.y - 100, { count: 4 });
      const b = FORM_BOX[form];
      this.zielFigur.position.set(WERK.x + (b.x0 + b.x1) / 2, WERK.y + (b.y0 + b.y1) / 2);
    });
    if (this.wunschDa && form === this.wunsch.form) this.besuch.nicke();
    this.after(0.7, () => {
      if (this.schritt !== 'k_punkte') return;
      this.reihe(this.klumpen);
      this.markiereKlumpen(this.punktFarbe);
    });
  }

  // Schritt 4: bunte Punkte draufdrücken
  setzePunkt(p) {
    const f = this.figur;
    if (!f || f.destroyed) return;
    if (this.punkte.length >= PUNKTE_MAX) {
      fx.wobble(f, 0.04);
      this.pulsiere(this.ofen, 3);
      return;
    }
    const b = FORM_BOX[f.form] || FORM_BOX.schale;
    // Punkt dort, wo getippt wurde – liegt dort (oder am Rand, wohin ein Tipp daneben rutscht) schon einer, ein
    // freier Platz in der Nähe, damit sich die Punkte nicht stapeln (vor allem auf der schmalen Raupe)
    const frei = (x, y) => this.punkte.reduce((m, q) => Math.min(m, Math.hypot(q[0] - x, q[1] - y)), 1e9);
    let lx = clamp(p.x - f.x, b.x0, b.x1);
    let ly = clamp(p.y - f.y, b.y0, b.y1);
    let best = frei(lx, ly);
    for (let n = 0; n < 16 && best < 34; n++) {
      const x = clamp(lx + rand(-110, 110), b.x0, b.x1);
      const y = clamp(ly + rand(-70, 70), b.y0, b.y1);
      const d = frei(x, y);
      if (d > best) { best = d; lx = x; ly = y; }
    }
    this.punkte.push([Math.round(lx), Math.round(ly), KNETE_FARBEN[this.punktFarbe]]);
    zeichnePunkte(f.punkte, this.punkte);
    sfx('common/plopp', { vol: 0.5, rate: rand(1.0, 1.2) });
    if (this.wunschDa && this.punkte.length % 3 === 1) this.besuch.nicke();
    if (this.punkte.length === PUNKTE_GENUG) {
      this.pulsiere(this.ofen, 5);
      sfx('common/funkeln', { vol: 0.3 });
      voice('malhaus_ofen', { nurWenn: () => this.aktiv && this.schritt === 'k_punkte' });
    }
  }

  // Schritt 5: in den Ofen
  ofenGetippt() {
    this.tatHier = true;
    const f = this.figur;
    if (this.schritt === 'k_punkte' && f && this.punkte.length > 0) {
      this.backe();
      return;
    }
    fx.wobble(this.ofen, 0.04);
    if (this.ruhe <= 0) {
      this.ruhe = 0.3;
      sfx('common/klack', { vol: 0.35 });
    }
  }

  backe() {
    const f = this.figur;
    const o = this.ofen;
    this.schritt = 'k_ofen';
    this.reihe(null);
    o._puls?.stop();
    sfx('common/wusch', { vol: 0.4 });
    const runde = this.rundenNr;
    const weiter = () => runde === this.rundenNr && !f.destroyed;
    // ~1000 Einheiten in 1,4 s (höchstens ~1100 Einheiten/s)
    this.tween(f, { x: OFEN.x, y: OFEN.y + 40, scale: 0.36 }, 1.4, { ease: 'sineInOut' })
      .then((ok) => {
        if (!ok || !weiter()) return false;
        sfx('common/tuer', { vol: 0.4 });
        this.tween(f, { alpha: 0 }, 0.3);
        return this.tween(o.tuer, { alpha: 1 }, 0.5, { ease: 'sineInOut' });
      })
      .then((ok) => {
        if (!ok || !weiter()) return false;
        this.burst('rauch', OFEN.x, OFEN.y - 220, { count: 2 });
        return this.tween(o.glut, { alpha: 0.75 }, 0.9, { ease: 'sineInOut' });
      })
      .then((ok) => (ok && weiter() ? this.wait(1.2).then(() => true) : false))
      .then((ok) => {
        if (!ok || !weiter()) return false;
        sfx('common/klingel', { vol: 0.45 });
        f.glanz.alpha = 1;
        this.tween(o.glut, { alpha: 0 }, 0.8, { ease: 'sineInOut' });
        return this.tween(o.tuer, { alpha: 0 }, 0.6, { ease: 'sineInOut' });
      })
      .then((ok) => {
        if (!ok || !weiter()) return false;
        this.tween(f, { alpha: 1 }, 0.3);
        return this.tween(f, { x: WERK.x, y: WERK.y, scale: 1 }, 1.4, { ease: 'sineInOut' });
      })
      .then((ok) => {
        if (!ok || !weiter()) return;
        this.schritt = 'k_fertig';
        sfx('common/funkeln', { vol: 0.4 });
        this.burst('funkeln', WERK.x, WERK.y - 100, { count: 6 });
        if (this.wunschDa) this.besuch.freu();
        this.zielFigur.position.set(WERK.x, WERK.y - 100);
        voice('malhaus_geben', { nurWenn: () => this.aktiv && this.schritt === 'k_fertig' });
      });
  }

  // ---------------------------------------------------------------- Kette

  legeSchnur() {
    this.entferneKette();
    const c = new PIXI.Container({ label: 'kette' });
    c.zIndex = 40;
    c.eventMode = 'none';
    const schnur = new PIXI.Graphics();
    const p0 = SCHNUR(0);
    schnur.moveTo(p0.x, p0.y);
    for (let i = 1; i <= 30; i++) { const p = SCHNUR(i / 30); schnur.lineTo(p.x, p.y); }
    schnur.stroke({ width: 8, color: 0xc9a46a, cap: 'round', join: 'round' });
    const p1 = SCHNUR(1);
    schnur.circle(p0.x, p0.y, 11).fill(0xb98049);
    // Fädelnadel am rechten Ende (stumpf, aus Holz)
    schnur.roundRect(p1.x - 6, p1.y - 64, 12, 64, 6).fill(0xd9b27c).stroke({ width: 3, color: 0xa8743f });
    const ring = new PIXI.Graphics().circle(0, 0, KREIS.r).stroke({ width: 8, color: 0xc9a46a });
    ring.position.set(KREIS.x, KREIS.y);
    ring.alpha = 0;
    const sl = schleife(new PIXI.Graphics());
    sl.position.set(KREIS.x, KREIS.y - KREIS.r - 4);
    sl.alpha = 0;
    c.addChild(schnur, ring);
    c.alpha = 0;
    this.welt.addChild(c);
    this.tween(c, { alpha: 1 }, 0.6, { ease: 'sineInOut' });
    this.kette = { c, schnur, ring, schleife: sl, perlen: [], unterwegs: 0, zu: false };
    c.addChild(sl);
  }

  entferneKette() {
    const k = this.kette;
    this.kette = null;
    if (!k || k.c.destroyed) return;
    this.tween(k.c, { alpha: 0 }, 0.4, { ease: 'sineInOut' }).then(() => { if (!k.c.destroyed) k.c.destroy({ children: true }); });
  }

  slotOrt(i) {
    return SCHNUR((i + 0.5) / PERLEN);
  }

  kreisOrt(i) {
    const a = -Math.PI / 2 - (2 * Math.PI * (i + 0.5)) / PERLEN;
    return { x: KREIS.x + Math.cos(a) * KREIS.r, y: KREIS.y + Math.sin(a) * KREIS.r };
  }

  schaleGetippt(i) {
    this.tatHier = true;
    const k = this.kette;
    if (this.schritt !== 'p_faedeln' || !k) {
      fx.wobble(this.schalen[i].inhalt, 0.05);
      return;
    }
    // höchstens zwei Perlen gleichzeitig unterwegs (ruhig), mehr als zehn gehen nicht auf die Schnur
    if (k.perlen.length >= PERLEN || k.unterwegs >= 2) {
      fx.wobble(this.schalen[i].inhalt, 0.05);
      return;
    }
    const nr = k.perlen.length;
    const g = zeichnePerle(new PIXI.Graphics(), PERL_FORM[i], KNETE_FARBEN[i]);
    const start = this.schalen[i];
    g.position.set(start.x, start.y - 10);
    g.scale.set(0.85);
    k.c.addChild(g);
    k.perlen.push({ g, farbe: i });
    k.unterwegs++;
    this.schalen.forEach((s, n) => s.markiere(n === i));
    sfx('common/plopp', { vol: 0.45, rate: 0.9 + i * 0.04 });
    if (this.wunschDa && this.wunsch.farben.includes(i)) this.besuch.nicke();
    const ziel = this.slotOrt(nr);
    const kette = k;
    // ~600 Einheiten in 0,8 s
    this.tween(g, { x: ziel.x, y: ziel.y, scale: 1 }, 0.8, { ease: 'sineInOut' }).then((ok) => {
      kette.unterwegs--;
      if (!ok || g.destroyed) return;
      note('xylo', [72, 74, 76, 79, 81, 84, 86, 88, 91, 93][nr], { vol: 0.2 });
      if (kette === this.kette && kette.perlen.length >= PERLEN && kette.unterwegs === 0) this.voll();
    });
  }

  voll() {
    if (this.schritt !== 'p_faedeln') return;
    this.schritt = 'p_knoten';
    this.reihe(null);
    this.schalen.forEach((s) => s.markiere(false));
    sfx('common/funkeln', { vol: 0.35 });
    const a = SCHNUR(0);
    const b = SCHNUR(1);
    this.burst('funkeln', a.x, a.y, { count: 3 });
    this.burst('funkeln', b.x, b.y, { count: 3 });
    if (this.wunschDa) this.besuch.nicke();
  }

  // Schritt: Enden zusammenknoten – die Kette schließt sich
  knoten() {
    const k = this.kette;
    if (!k || k.zu) return;
    k.zu = true;
    this.schritt = 'p_zu';
    sfx('common/wusch', { vol: 0.4 });
    this.tween(k.schnur, { alpha: 0 }, 0.6, { ease: 'sineInOut' });
    this.tween(k.ring, { alpha: 1 }, 0.8, { ease: 'sineInOut' });
    k.perlen.forEach((p, i) => {
      const z = this.kreisOrt(i);
      this.tween(p.g, { x: z.x, y: z.y }, 1.0, { ease: 'sineInOut' });
    });
    this.after(0.9, () => {
      if (this.kette !== k) return;
      this.tween(k.schleife, { alpha: 1 }, 0.5, { ease: 'sineInOut' });
      fx.pop(k.schleife);
      sfx('common/plopp', { vol: 0.5 });
      this.burst('funkeln', KREIS.x, KREIS.y, { count: 6 });
      this.schritt = 'p_geben';
      if (this.wunschDa) this.besuch.freu();
      voice('malhaus_kette', { nurWenn: () => this.aktiv && this.schritt === 'p_geben' });
    });
  }

  // ---------------------------------------------------------------- Geben

  gib() {
    if (!this.wunschDa || !this.besuch.da || this.besuch.tier !== this.wunsch.tier) return;
    if (this.schritt === 'k_fertig' && this.figur) this.gibFigur();
    else if (this.schritt === 'p_geben' && this.kette) this.gibKette();
  }

  gibFigur() {
    const f = this.figur;
    this.figur = null;
    this.schritt = 'abgabe';
    this.phase = 'fertig';
    const gast = this.besuch.actor;
    const runde = this.rundenNr;
    f.zIndex = 90;
    sfx('common/wusch', { vol: 0.45 });
    const h = this.besuch.zeigeOrt;
    this.tween(f, { x: h.x, y: h.y + 60, scale: 0.6 }, 1.4, { ease: 'sineInOut' }).then((ok) => {
      if (!ok || f.destroyed) return;
      this.besuch.freu();
      this.besuch.wunschWeg();
      // Platz im Regal: der nächste freie, sonst der des ältesten
      const belegt = new Set(this.regal.map((e) => e.platz));
      let platz = -1;
      for (let p = 0; p < REGAL_MAX; p++) if (!belegt.has(p)) { platz = p; break; }
      if (platz < 0) platz = this.regal.shift().platz;
      const eintrag = { form: f.form, rgb: KNETE_FARBEN[this.farbe], punkte: this.punkte.slice(), platz };
      this.wait(1.1).then(() => {
        if (f.destroyed) return;
        const alt = this.regalPlaetze[platz];
        if (alt.visible) this.tween(alt, { alpha: 0 }, 0.6, { ease: 'sineInOut' });
        const ziel = regalOrt(platz);
        const weg = Math.hypot(ziel.x - f.x, ziel.y - f.y);
        sfx('common/wusch', { vol: 0.35, rate: 1.1 });
        this.tween(f, { x: ziel.x, y: ziel.y, scale: REGAL_SKALA }, clamp(weg / 820, 1.2, 3), { ease: 'sineInOut' }).then((ok2) => {
          if (!ok2 || f.destroyed) return;
          f.destroy({ children: true });
          this.regal.push(eintrag);
          regalSpeichern(this.regal);
          this.stelleInsRegal(eintrag);
          this._neuPlatz = platz;
          sfx('common/klack', { vol: 0.5 });
          this.burst('funkeln', ziel.x, ziel.y - 60, { count: 4 });
          belohne(this, 'malhaus_knete', clamp(ziel.x, -600, 600), 480);
          voice('malhaus_regal', { nurWenn: () => this.aktiv });
          this.ueberraschung(ziel);
          this.wait(1.2)
            .then(() => (runde === this.rundenNr ? this.besuch.geh(gast) : false))
            .then(() => this.wait(0.3))
            .then(() => { if (runde === this.rundenNr) this.starteRunde(0); });
        });
      });
    });
  }

  gibKette() {
    const k = this.kette;
    this.kette = null;
    this.schritt = 'abgabe';
    this.phase = 'fertig';
    const gast = this.besuch.actor;
    const runde = this.rundenNr;
    // Kette als eigener Container (Mitte = Kreismitte), damit sie am Hals sitzen kann
    const c = k.c;
    c.pivot.set(KREIS.x, KREIS.y);
    c.position.set(KREIS.x, KREIS.y);
    c.zIndex = 90;
    sfx('common/wusch', { vol: 0.45 });
    // Hals: unter dem Maul, etwas zur Körpermitte hin
    const hals = () => {
      const m = gast.point('mouth');
      return { x: m.x + (gast.x - m.x) * 0.3, y: m.y + 58 };
    };
    const ziel = hals();
    const s = 108 / (KREIS.r * 2);
    this.tween(c, { x: ziel.x, y: ziel.y, scaleX: s, scaleY: s * 0.55 }, 1.4, { ease: 'sineInOut' }).then((ok) => {
      if (!ok || c.destroyed || gast.destroyed) {
        if (!c.destroyed) c.destroy({ children: true });
        return;
      }
      // an das Tier hängen (hüpft und geht mit ihm mit)
      const kc = gast.koerper;
      const lokal = kc.toLocal(this.welt.toGlobal({ x: c.x, y: c.y }));
      c.position.set(lokal.x, lokal.y);
      c.scale.set(c.scale.x / gast.scale.x, c.scale.y / gast.scale.y);
      kc.addChild(c);
      this._getragen = { c, gast, hx: lokal.x, flip: gast.flip };
      this._neuPlatz = -1;
      this.besuch.freu();
      this.besuch.wunschWeg();
      sfx('common/klack', { vol: 0.4 });
      belohne(this, 'malhaus_kette', -700, 1000);
      this.ueberraschung(null);
      this.wait(2.2)
        .then(() => (runde === this.rundenNr ? this.besuch.geh(gast) : false))
        .then(() => this.wait(0.3))
        .then(() => { if (runde === this.rundenNr) this.starteRunde(0); });
    });
  }

  /** kleine ruhige Überraschung (nicht jedes Mal) */
  ueberraschung(ziel) {
    const r = Math.random();
    const d = this.deko;
    if (r < 0.3 && d?.katze && !d.katze.destroyed) {
      this.after(0.8, () => {
        d.katzeWach = 6;
        d.katze.pose('idle');
        d.katze.cheer({ parent: this.vorn });
      });
    } else if (r < 0.6 && d?.sm && ziel) {
      d.sm.ziel = { x: ziel.x + 30, y: ziel.y - 150, setzen: true };
      d.sm.sitzt = false;
      d.sm.tempo = 160;
    } else if (r < 0.8) {
      // eine kleine Melodie zum Danke
      [76, 79, 84].forEach((n, i) => this.after(0.3 + i * 0.32, () => { if (this.aktiv) note('glocke', n, { vol: 0.16 }); }));
    }
  }

  // ---------------------------------------------------------------- jedes Bild

  update(dt) {
    this.deko?.update(dt);
    this.leine?.update(dt);
    this.besuch?.update(dt);
    this.ruhe -= dt;
    this.rollRuhe -= dt;
    this.tonRuhe -= dt;
    // die umgehängte Kette bleibt am Hals, auch wenn sich das Tier zum Gehen umdreht
    const g = this._getragen;
    if (g) {
      if (g.c.destroyed || g.gast.destroyed) this._getragen = null;
      else g.c.x = g.gast.flip === g.flip ? g.hx : -g.hx;
    }
    // Notausgang (keine Sackgasse): kommt nach einer Abgabe kein neuer Besuch, geht es nach 20 s trotzdem weiter
    if (this.phase === 'fertig' || (this.phase === 'warten' && this.wunsch)) {
      this._wartet = (this._wartet || 0) + dt;
      if (this._wartet > 20) {
        this._wartet = 0;
        this.besuch.weg();
        this.starteRunde(0);
      }
    } else this._wartet = 0;
  }

  resize() {
    this.besuch?.anpassen();
  }

  // ---------------------------------------------------------------- Zeige-Hand

  hinweise() {
    if (this.phase !== 'arbeit') {
      const c = this.regalPlaetze?.[this._neuPlatz];
      return this.phase === 'fertig' && c?.visible ? [c] : [];
    }
    const w = this.wunsch;
    const geben = { von: this.schritt === 'k_fertig' ? this.zielFigur : this.zielKette, nach: { x: this.besuch.haende.x + 60, y: this.besuch.haende.y - 40 } };
    switch (this.schritt) {
      case 'k_nehmen': return [this.klumpen[w.farbe], this.klumpen[(w.farbe + 3) % KNETE_FARBEN.length]];
      case 'k_rollen': return [{ von: this.zielLinks, nach: { x: 230, y: WERK.y - 60 } }];
      case 'k_formen': return [this.formKarten[FORMEN.indexOf(w.form)], this.formKarten[(FORMEN.indexOf(w.form) + 2) % 4]];
      case 'k_punkte':
        return this.punkte.length >= PUNKTE_GENUG
          ? [this.ofen, this.zielFigur]
          : [this.zielFigur, this.klumpen[(this.punktFarbe + 2) % KNETE_FARBEN.length]];
      case 'k_fertig':
      case 'p_geben':
        return this.besuch.da ? [geben, this.besuch.actor] : [];
      case 'p_faedeln': {
        const n = this.kette?.perlen.length || 0;
        return [this.schalen[w.farben[n % 2]], this.schalen[w.farben[(n + 1) % 2]]];
      }
      case 'p_knoten': return [this.zielEnden];
      case 'k_ofen': return [this.ofen];
      default: return [];
    }
  }
}
