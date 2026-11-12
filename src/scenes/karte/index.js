// Landkarte: Von hier aus geht es zu allen Orten.
//
// - Die gemalte Spielzeug-Landkarte (rahmen/karte) füllt das Bild. Über jedem der 13 Orte liegt eine große
//   unsichtbare Tippfläche (der ganze gemalte Umriss des Orts plus ein Kreis mit Radius 190; jeder Punkt gehört
//   genau einem Ort) und am Fuß ein heller Ring (rahmen/ort_ring), der bei noch nie besuchten Orten sanft atmet.
// - Tipp auf einen Ort: der Ort federt (ausgeschnittenes Stück der Karte mit weichem Rand), der Ring leuchtet,
//   der kleine Zug (rahmen/zug_klein) fährt in einer weichen Kurve hin (höchstens 1,2 s), leiser Pfiff – dann
//   geht es in die Szene. Gibt es die Szene (noch) nicht, wackelt der Ort nur freundlich.
// - Tipp auf den kleinen Zug (nur wo er sichtbar ist): er dampft und fährt in den Ort, an dem er gerade steht.
//   Gepfiffen wird höchstens alle 1,6 s.
// - Der Zug steht beim nächsten Besuch dort, wo man zuletzt war (store 'karte.zug'); besuchte Orte merkt
//   sich 'karte.besucht'. Die Zeige-Hand zeigt auf einen noch nie besuchten Ort, zuerst auf den Bahnhof.
// - Kleine Lebendigkeit: Wolkenschatten ziehen langsam, ab und zu fliegt ein Vogel vorbei, Kuh, Schaf und Hase
//   stehen auf der Wiese, Tipp auf freie Wiese lässt ein Blümchen wachsen (manchmal fliegt ein Schmetterling auf);
//   auf dem Holzgleis und am Himmel funkelt es nur leise.

import {
  Scene, SceneManager, stage, spr, meta, sfx, voice, note, tap, Actor, fx, ui, store, rand, pick, clamp, PIXI,
} from '../../engine/index.js';
import { setzeHintergrund } from '../../gemeinsam/seiten.js';
import { blume, Schmetterling, Vogel, weicheMaskeTextur } from './natur.js';

const HG = 'rahmen/karte';
const TIPP_RADIUS = 190;
const ZUG_SKALA = 0.78;          // zug_klein ist 420 breit → ≈ 330 auf der Karte
const ZUG_ANKER_Y = 0.9;         // Unterkante der Räder im Bild zug_klein
const ZUG_SCHORNSTEIN = { x: 112, y: -143 };   // Bildpunkte relativ zum Anker (Schornstein oben)
const ECKE = 260;                // Ecken oben links/rechts frei (Album-Knopf), unten rechts 240
const MAX_BLUMEN = 14;
const PENTATONIK = [72, 74, 76, 79, 81, 84];

// Die 13 Orte. Alle Angaben in Bildpunkten der Karte (2829×1600), auf den Fotos nachgemessen
// (einige Punkte in pack.json liegen nicht mittig auf dem Ort, z. B. Garten, Spielplatz, Waschanlage):
//   box   = Umriss des gemalten Orts (links, oben, rechts, unten) – für das federnde Ausschnitt-Bild und den Ring
//   tipp  = Mitte der Tippfläche (Kreis, Radius 190; Abstände ≥ 385, also überschneidungsfrei)
//   zug   = wo der kleine Zug vor dem Ort hält (Unterkante der Räder)
//   ring  = Mitte und Breite des hellen Rings am Fuß des Orts
//   Ein Tipp gehört zu genau einem Ort (ortAn): zuerst zählt der Umriss (box) – wer auf das gemalte Haus tippt,
//   kommt immer hinein –, sonst der Kreis; bei Überschneidung gewinnt der nächste Mittelpunkt.
const ORTE = [
  { id: 'bauernhof', box: [180, 215, 665, 550], tipp: [437, 387], zug: [440, 590], ring: [430, 478, 330] },
  { id: 'baustelle', box: [725, 195, 1115, 548], tipp: [927, 370], zug: [930, 590], ring: [905, 470, 300] },
  { id: 'garten', box: [1185, 235, 1630, 532], tipp: [1407, 370], zug: [1400, 585], ring: [1405, 455, 340] },
  { id: 'feuerwehr', box: [1690, 165, 2140, 548], tipp: [1910, 362], zug: [1905, 590], ring: [1912, 482, 300] },
  { id: 'malhaus', box: [2200, 255, 2625, 540], tipp: [2405, 395], zug: [2400, 590], ring: [2400, 470, 300] },
  { id: 'teich', box: [95, 600, 625, 975], tipp: [357, 787], zug: [400, 980], ring: [350, 880, 380] },
  { id: 'musik', box: [665, 615, 1075, 930], tipp: [867, 772], zug: [870, 985], ring: [865, 862, 300] },
  { id: 'bahnhof', box: [1135, 525, 1690, 945], tipp: [1412, 760], zug: [1412, 958], ring: [1412, 885, 380] },
  { id: 'eisdiele', box: [1770, 565, 2120, 935], tipp: [1945, 750], zug: [1945, 985], ring: [1945, 880, 290] },
  { id: 'spielplatz', box: [2175, 600, 2720, 960], tipp: [2447, 780], zug: [2380, 1000], ring: [2450, 890, 390] },
  { id: 'wald', box: [295, 950, 1000, 1320], tipp: [647, 1135], zug: [650, 1395], ring: [640, 1262, 420] },
  { id: 'waschanlage', box: [1100, 975, 1645, 1370], tipp: [1372, 1172], zug: [1372, 1395], ring: [1372, 1300, 330] },
  { id: 'schlafen', box: [1825, 960, 2340, 1340], tipp: [2082, 1150], zug: [2080, 1395], ring: [2080, 1300, 360] },
];

// Tiere auf der Wiese (Bildpunkte der Karte, Fuß am Boden) – in Lücken zwischen den Tippflächen
const TIERE = [
  { id: 'kuh', bei: [700, 655], skala: 0.14, flip: false },
  { id: 'schaf', bei: [1742, 1300], skala: 0.13, flip: true },
  { id: 'hase', bei: [2545, 1270], skala: 0.13, flip: true },
];

// Mittellinie des gemalten Holzgleises (Bildpunkte der Karte, an den Farben der Karte gemessen; Lauffläche plus
// sichtbare Seitenkante). Dort wachsen keine Blumen.
const GLEIS = [
  [560, 175], [500, 191], [400, 214], [300, 240], [200, 275], [150, 315], [87, 415], [55, 515], [41, 615],
  [32, 715], [28, 815], [34, 915], [45, 1015], [73, 1115], [127, 1215], [218, 1315], [300, 1358], [400, 1394],
  [500, 1411], [1400, 1415], [2300, 1412], [2400, 1395], [2500, 1360], [2591, 1315], [2685, 1215], [2740, 1115],
  [2768, 1015], [2783, 915], [2777, 715], [2768, 615], [2754, 515], [2722, 415], [2630, 315], [2600, 272],
  [2500, 235], [2400, 205], [2300, 194], [2200, 177], [1400, 173], [560, 175],
];
const GLEIS_BREITE = 52;         // halbe Breite des Gleisbands (Bildpunkte)

// Tippfläche eines Orts: gehört(x, y) entscheidet (lokale Koordinaten). radius bleibt lesbar, damit die
// Prüfung der Mindestgröße des Kerns sie versteht (der Kreis ist das Kleinste, was ein Ort bekommt).
class OrtFlaeche {
  constructor(radius, gehoert) {
    this.radius = radius;
    this.gehoert = gehoert;
  }

  contains(x, y) {
    return this.gehoert(x, y);
  }
}

// Tippfläche nach dem sichtbaren Bild: ein grobes Raster der deckenden Bildpunkte, etwas aufgeweitet (kleine
// Finger treffen nicht genau). width/height für die Mindestgrößen-Prüfung des Kerns.
const ZELLE = 6;
const masken = new Map();   // Textur → { spalten, zeilen, voll: Uint8Array } (einmal pro Modul)
function bildMaske(textur, aufweiten = 3) {
  if (masken.has(textur)) return masken.get(textur);
  let m = null;
  try {
    const f = textur.frame;
    const c = document.createElement('canvas');
    c.width = Math.ceil(f.width);
    c.height = Math.ceil(f.height);
    const g = c.getContext('2d', { willReadFrequently: true });
    g.drawImage(textur.source.resource, f.x, f.y, f.width, f.height, 0, 0, f.width, f.height);
    const d = g.getImageData(0, 0, c.width, c.height).data;
    const spalten = Math.ceil(c.width / ZELLE);
    const zeilen = Math.ceil(c.height / ZELLE);
    const roh = new Uint8Array(spalten * zeilen);
    for (let y = 0; y < c.height; y += 2) {
      for (let x = 0; x < c.width; x += 2) {
        if (d[(y * c.width + x) * 4 + 3] > 90) roh[Math.floor(y / ZELLE) * spalten + Math.floor(x / ZELLE)] = 1;
      }
    }
    const voll = new Uint8Array(spalten * zeilen);
    for (let r = 0; r < zeilen; r++) {
      for (let s = 0; s < spalten; s++) {
        if (!roh[r * spalten + s]) continue;
        for (let rr = Math.max(0, r - aufweiten); rr <= Math.min(zeilen - 1, r + aufweiten); rr++) {
          for (let ss = Math.max(0, s - aufweiten); ss <= Math.min(spalten - 1, s + aufweiten); ss++) voll[rr * spalten + ss] = 1;
        }
      }
    }
    m = { spalten, zeilen, voll, w: c.width, h: c.height };
  } catch (e) {
    m = null;   // Bild nicht lesbar: dann gilt das ganze Rechteck
  }
  masken.set(textur, m);
  return m;
}

class ZugFlaeche {
  // bildVon(x, y) → Bildpunkt im Zugbild (oder null); w/h = Größe auf der Bühne (für die Prüfung des Kerns)
  constructor(maske, bildVon, w, h) {
    this.maske = maske;
    this.bildVon = bildVon;
    this.width = w;
    this.height = h;
  }

  contains(x, y) {
    const p = this.bildVon(x, y);
    const m = this.maske;
    if (!m) return p.x >= -10 && p.x <= p.bw + 10 && p.y >= -10 && p.y <= p.bh + 10;
    const s = Math.floor(p.x / ZELLE);
    const r = Math.floor(p.y / ZELLE);
    if (s < 0 || r < 0 || s >= m.spalten || r >= m.zeilen) return false;
    return m.voll[r * m.spalten + s] === 1;
  }
}

function abstandZurStrecke(px, py, ax, ay, bx, by) {
  const vx = bx - ax;
  const vy = by - ay;
  const l2 = vx * vx + vy * vy;
  const u = l2 > 0 ? clamp(((px - ax) * vx + (py - ay) * vy) / l2, 0, 1) : 0;
  return Math.hypot(px - (ax + u * vx), py - (ay + u * vy));
}

// Gibt es die Szene als Modul (und lässt sie sich laden)? Läuft parallel zur Zugfahrt. Erfolg merkt sich der
// Browser selbst (Modul-Speicher); ein Fehlschlag wird nicht gemerkt – kommt die Szene später dazu, klappt es.
function szeneLaedt(id) {
  if (!SceneManager.has(id)) return Promise.resolve(false);
  return import(`../${id}/index.js`)
    .then((m) => typeof m?.default === 'function')
    .catch(() => false);
}

export default class Karte extends Scene {
  static id = 'karte';
  static packs = ['rahmen', 'zug', 'tiere'];
  static music = 'musik/karte';

  async enter() {
    this.besucht = new Set(liste(store.get('karte.besucht', [])));
    this.unterwegs = false;
    this.fehlt = new Set();     // Orte, deren Szene sich (noch) nicht laden ließ
    this.blumen = [];
    this.falter = [];
    this.wiesenTipps = 0;

    this.hg = setzeHintergrund(this, HG);
    this.baueOrte();
    this.baueZug();
    this.baueTiere();
    this.baueWolken();
    this.baueVogel();
    tap(this.hg, (e) => this.wieseGetippt(e.x, e.y), {
      sound: null, squash: false, hitArea: new PIXI.Rectangle(-3000, -1000, 6000, 3000),
    });
    ui.albumKnopf(this);

    this.after(0.9, () => voice('karte_hallo'));
    // Wer lange nichts tippt, bekommt den Hinweis angeboten – einmal je stiller Phase (nicht jede Sekunde neu).
    // Ob er wirklich erklingt, entscheidet der Kern: einmal am Tag, mit „bei jedem Besuch" einmal je Besuch, nach
    // langem Nichtstun höchstens eine Wiederholung. Die Zeige-Hand kommt ebenfalls vom Kern.
    this.tippAngeboten = false;
    this.every(1, () => {
      if (this.idle < 9) {
        this.tippAngeboten = false;
      } else if (!this.tippAngeboten && !this.unterwegs) {
        this.tippAngeboten = true;
        voice('karte_tipp');
      }
    });
  }

  // ---------------------------------------------------------------- Umrechnen

  /** Bildpunkt der Karte → Szenen-Koordinaten */
  bild(px, py) {
    const m = meta(HG);
    const hg = this.hg;
    const t = hg.texture;
    const s = hg.scale.y;
    return {
      x: hg.x + (px / m.w - hg.anchor.x) * t.width * s,
      y: hg.y + (py / m.h - hg.anchor.y) * t.height * s,
    };
  }

  /** Szenen-Koordinaten → Bildpunkt der Karte */
  karteVon(x, y) {
    const m = meta(HG);
    const hg = this.hg;
    const t = hg.texture;
    const s = hg.scale.y;
    return {
      x: ((x - hg.x) / (t.width * s) + hg.anchor.x) * m.w,
      y: ((y - hg.y) / (t.height * s) + hg.anchor.y) * m.h,
    };
  }

  /** Ecken der Knöpfe (oben links/rechts, unten rechts das Eltern-Zahnrad) – dort gehört nichts zur Karte. */
  inEcke(x, y) {
    const hx = x + stage.W / 2;   // hud-Koordinaten
    return (y < ECKE && (hx < ECKE || hx > stage.W - ECKE)) || (y > stage.H - 240 && hx > stage.W - 240);
  }

  /**
   * Zu welchem Ort gehört ein Punkt (Szenen-Koordinaten)? Wer auf das gemalte Haus tippt (Umriss), kommt immer
   * hinein; sonst zählt der Tippkreis. Liegt der Punkt in mehreren, gewinnt der nächste Mittelpunkt. → Ort | null
   */
  ortAn(x, y) {
    if (this.inEcke(x, y)) return null;
    const p = this.karteVon(x, y);
    let best = null;
    let bd = Infinity;
    for (const o of this.orte) {
      const [l, ob, r, u] = o.box;
      if (p.x < l || p.x > r || p.y < ob || p.y > u) continue;
      const d = Math.hypot(p.x - o.tipp[0], p.y - o.tipp[1]);
      if (d < bd) { bd = d; best = o; }
    }
    if (best) return best;
    for (const o of this.orte) {
      const d = Math.hypot(x - o.x, y - o.y);
      if (d <= TIPP_RADIUS && d < bd) { bd = d; best = o; }
    }
    return best;
  }

  /** Liegt der Punkt (Szenen-Koordinaten) auf dem gemalten Holzgleis? */
  aufGleis(x, y, rand0 = 0) {
    const p = this.karteVon(x, y);
    for (let i = 1; i < GLEIS.length; i++) {
      const a = GLEIS[i - 1];
      const b = GLEIS[i];
      if (abstandZurStrecke(p.x, p.y, a[0], a[1], b[0], b[1]) < GLEIS_BREITE + rand0) return true;
    }
    return false;
  }

  // ---------------------------------------------------------------- Orte

  baueOrte() {
    this.orte = [];
    ORTE.forEach((d, i) => {
      const mitte = this.bild(d.tipp[0], d.tipp[1]);
      const [l, o, r, u] = d.box;
      const fuss = this.bild(d.ring[0], d.ring[1]);
      const ecke1 = this.bild(l, o);
      const ecke2 = this.bild(r, u);
      const ort = {
        ...d,
        x: mitte.x,
        y: mitte.y,
        rahmen: { x: ecke1.x, y: ecke1.y, w: ecke2.x - ecke1.x, h: ecke2.y - ecke1.y },
        zugOrt: this.bild(d.zug[0], d.zug[1]),
        phase: i * 0.83,
        glanz: this.besucht.has(d.id) ? 0.4 : 0.8,
        leuchtet: false,
        kopie: null,
      };

      // heller Ring am Fuß des Orts
      const ring = spr('rahmen/ort_ring', { x: fuss.x, y: fuss.y, parent: this.world });
      ring.zIndex = 4;
      ring.eventMode = 'none';
      ring.ruhe = (d.ring[2] * this.hg.scale.x) / ring.texture.width;
      ring.scale.set(ring.ruhe);
      ring.alpha = ort.glanz;
      ort.ring = ring;

      // unsichtbare Tippfläche: Umriss des gemalten Orts und Kreis um die Mitte – jeder Punkt gehört genau
      // einem Ort (ortAn), die Ecken der Knöpfe sind ausgespart
      const f = new PIXI.Container({ label: 'ort:' + d.id });
      f.position.set(mitte.x, mitte.y);
      f.zIndex = 10;
      this.world.addChild(f);
      const gehoert = (lx, ly) => this.ortAn(mitte.x + lx, mitte.y + ly) === ort;
      tap(f, () => this.ortGetippt(ort), { sound: 'common/tipp', squash: false, hitArea: new OrtFlaeche(TIPP_RADIUS, gehoert) });
      ort.flaeche = f;
      this.orte.push(ort);
    });
    this.ortVon = Object.fromEntries(this.orte.map((o) => [o.id, o]));
  }

  // Ausschnitt des Orts aus der Karte (mit weichem Rand) – federt/wackelt statt des gemalten Hintergrunds.
  // Wird beim ersten Tipp angelegt und danach nur ein-/ausgeblendet (unsichtbar kostet es nichts).
  kopieVon(o) {
    if (o.kopie && !o.kopie.destroyed) return o.kopie;
    const m = meta(HG);
    const quelle = this.hg.texture;
    const k = quelle.frame.width / m.w;   // Bildpunkte der Textur je Bildpunkt der Karte
    const rand0 = 40;                       // etwas Wiese rundherum (verläuft weich)
    const [l, ob, r, u] = o.box;
    const fl = Math.max(0, l - rand0);
    const fo = Math.max(0, ob - rand0);
    const fr = Math.min(m.w, r + rand0);
    const fu = Math.min(m.h, u + rand0 * 0.6);
    const frame = new PIXI.Rectangle(quelle.frame.x + fl * k, quelle.frame.y + fo * k, (fr - fl) * k, (fu - fo) * k);
    const t = new PIXI.Texture({ source: quelle.source, frame });
    const s = new PIXI.Sprite(t);
    s.anchor.set(0.5, 1);
    const fuss = this.bild((fl + fr) / 2, fu);
    s.position.set(fuss.x, fuss.y);
    s.ruhe = this.hg.scale.x / k;
    s.scale.set(s.ruhe);
    s.zIndex = 3;
    s.eventMode = 'none';
    const maske = new PIXI.Sprite(weicheMaskeTextur());
    maske.anchor.set(0.5, 1);
    maske.width = t.width;
    maske.height = t.height;
    s.addChild(maske);
    s.mask = maske;
    s.visible = false;
    this.world.addChild(s);
    o.kopie = s;
    o.kopieMarke = 0;
    return s;
  }

  /** Ort federt (art 'hupf') oder wackelt freundlich (art 'wackel'). */
  bewegeOrt(o, art = 'hupf') {
    const s = this.kopieVon(o);
    const marke = ++o.kopieMarke;
    s.visible = true;
    const fertig = (ok) => {
      if (ok && marke === o.kopieMarke && !s.destroyed) {
        s.visible = false;
        s.scale.set(s.ruhe);
        s.rotation = 0;
      }
    };
    const basis = s.ruhe;
    if (art === 'hupf') {
      // nur größer werden (nie kleiner – sonst schaute der gemalte Ort darunter hervor)
      this.tween(s, { scaleX: basis * 1.05, scaleY: basis * 1.1, rotation: 0 }, 0.14, { ease: 'quadOut' })
        .then((ok) => (ok ? this.tween(s, { scaleX: basis * 1.02, scaleY: basis * 1.03 }, 0.16, { ease: 'sineInOut' }) : false))
        .then((ok) => (ok ? this.tween(s, { scaleX: basis * 1.04, scaleY: basis * 1.06 }, 0.14, { ease: 'sineInOut' }) : false))
        .then((ok) => (ok ? this.tween(s, { scaleX: basis, scaleY: basis }, 0.35, { ease: 'sineInOut' }) : false))
        .then(fertig);
    } else {
      this.tween(s, { scaleX: basis * 1.04, scaleY: basis * 1.04 }, 0.12, { ease: 'quadOut' });
      const proxy = { p: 0 };
      this.tween(proxy, { p: 1 }, 0.9, {
        ease: 'linear',
        onUpdate: () => { if (!s.destroyed) s.rotation = Math.sin(proxy.p * Math.PI * 4) * 0.035 * (1 - proxy.p); },
      })
        .then((ok) => (ok ? this.tween(s, { scaleX: basis, scaleY: basis, rotation: 0 }, 0.25, { ease: 'sineInOut' }) : false))
        .then(fertig);
    }
  }

  async ortGetippt(o) {
    if (this.unterwegs) {
      // während der Fahrt: der Ort federt nur (nichts geht kaputt, kein zweites Ziel)
      if (o !== this.ziel) this.bewegeOrt(o, 'wackel');
      return;
    }
    if (!SceneManager.has(o.id)) {
      this.bewegeOrt(o, 'wackel');
      return;
    }
    this.unterwegs = true;
    this.ziel = o;
    ui.handWeg(0.2);
    o.leuchtet = true;
    const laedt = szeneLaedt(o.id);
    // kurz abwarten, ob es die Szene gibt (meist schon nach wenigen Millisekunden klar) – fehlt sie, fährt der
    // Zug gar nicht erst los, der Ort wackelt nur freundlich
    const frueh = await Promise.race([laedt, this.wait(0.12).then(() => null)]);
    if (frueh !== false) {
      this.bewegeOrt(o, 'hupf');
      await this.fahreZu(o);
    }
    const ok = frueh === false ? false : await laedt;
    if (!ok) {
      // Szene gibt es (noch) nicht: freundlich wackeln, der Zug bleibt stehen; die Hand zeigt nicht mehr hin
      this.fehlt.add(o.id);
      o.leuchtet = false;
      this.bewegeOrt(o, 'wackel');
      this.unterwegs = false;
      this.ziel = null;
      return;
    }
    this.besucht.add(o.id);
    store.set('karte.besucht', [...this.besucht]);
    store.set('karte.zug', o.id);
    this.go(o.id);
  }

  // ---------------------------------------------------------------- kleiner Zug

  baueZug() {
    const z = new PIXI.Container({ label: 'zugKlein' });
    z.zIndex = 50;
    const schatten = new PIXI.Graphics().ellipse(0, 0, 118, 20).fill({ color: 0x2b4a18, alpha: 0.2 });
    schatten.y = -4;
    const koerper = new PIXI.Container();   // Wippen, Drehen
    const bild = spr('rahmen/zug_klein', { parent: koerper });
    bild.anchor.set(0.5, ZUG_ANKER_Y);
    bild.scale.set(ZUG_SKALA);
    z.addChild(schatten, koerper);
    this.world.addChild(z);
    this.zug = z;
    this.zugKoerper = koerper;
    this.zugBild = bild;
    this.zugDreh = 0;        // Ziel-Drehung (wird weich nachgeführt)
    this.zugFaehrt = false;

    const start = this.ortVon[String(store.get('karte.zug', 'bahnhof'))] || this.ortVon.bahnhof;
    this.zugBeiOrt = start;
    z.position.set(start.zugOrt.x, start.zugOrt.y);
    // Blick: zur Kartenmitte (sieht freundlicher aus als an den Rand zu schauen)
    this.setzeBlick(start.zugOrt.x > 200);

    // Tippfläche = das sichtbare Zugbild (etwas aufgeweitet). Durchsichtige Stellen des Bilds gehören den Orten
    // darunter – wer neben dem Zug auf ein Haus tippt, kommt in dieses Haus.
    const bw = bild.texture.width;
    const bh = bild.texture.height;
    const bildVon = (lx, ly) => ({
      x: (lx / (ZUG_SKALA * (this.zugLinks ? -1 : 1))) + bw * 0.5,
      y: (ly - koerper.y) / ZUG_SKALA + bh * ZUG_ANKER_Y,
      bw,
      bh,
    });
    const aufweiten = 3;   // Zellen à 6 Bildpunkte ≈ 14 Einheiten Rand
    const rand0 = 2 * aufweiten * ZELLE * ZUG_SKALA;
    tap(z, () => this.zugGetippt(), {
      sound: null, squash: false,
      hitArea: new ZugFlaeche(bildMaske(bild.texture, aufweiten), bildVon, bw * ZUG_SKALA + rand0, bh * ZUG_SKALA + rand0),
    });
  }

  /** Leiser Pfiff – höchstens alle 1,6 s (der Pfiff klingt 2 s, nichts stapelt sich zu Lärm). */
  pfeife(vol = 0.42) {
    if (this.t - (this.pfiffZeit ?? -9) < 1.6) return false;
    this.pfiffZeit = this.t;
    sfx('common/pfiff', { vol });
    return true;
  }

  setzeBlick(links) {
    this.zugLinks = links;
    this.zugBild.scale.x = Math.abs(this.zugBild.scale.x) * (links ? -1 : 1);
  }

  schornstein() {
    const p = { x: ZUG_SCHORNSTEIN.x * ZUG_SKALA * (this.zugLinks ? -1 : 1), y: ZUG_SCHORNSTEIN.y * ZUG_SKALA };
    return this.front.toLocal(p, this.zugKoerper);
  }

  dampf(n = 2) {
    const p = this.schornstein();
    fx.burst('rauch', p.x, p.y, { count: n, groesse: 0.55 });
  }

  zugGetippt() {
    if (this.unterwegs) return;
    fx.pop(this.zugKoerper, 0.08);
    this.dampf(2);
    // der Zug steht an einem Ort: Tipp auf ihn heißt „hier hinein" (den Pfiff gibt es dann bei der Abfahrt)
    const o = this.zugBeiOrt;
    if (o && SceneManager.has(o.id) && !this.fehlt.has(o.id)) {
      sfx('common/tipp', { vol: 0.6 });
      this.after(0.3, () => { if (!this.unterwegs) this.ortGetippt(o); });
    } else {
      this.pfeife(0.5);
    }
  }

  /** Fährt in einer weichen Kurve zum Ort (höchstens 1,2 s, weite Wege schneller). → Promise */
  async fahreZu(o) {
    const z = this.zug;
    const a = { x: z.x, y: z.y };
    const b = o.zugOrt;
    const d = Math.hypot(b.x - a.x, b.y - a.y);
    this.pfeife(0.42);
    this.dampf(2);
    if (d < 30) {
      fx.pop(this.zugKoerper, 0.08);
      await this.wait(0.45);
      this.zugBeiOrt = o;
      return;
    }
    const dauer = clamp(0.5 + d / 1700, 0.6, 1.2);
    // Kontrollpunkt seitlich der Strecke: weicher Bogen (Seite so, dass er nicht über den Rand hinaus schwingt)
    const mx = (a.x + b.x) / 2;
    const my = (a.y + b.y) / 2;
    const nx = -(b.y - a.y) / d;
    const ny = (b.x - a.x) / d;
    const bogen = Math.min(d * 0.22, 180);
    // von den zwei möglichen Seiten die zur Kartenmitte hin (schwingt nie über den Rand)
    const k1 = { x: mx + nx * bogen, y: my + ny * bogen };
    const k2 = { x: mx - nx * bogen, y: my - ny * bogen };
    const k = Math.hypot(k1.x, k1.y - 800) <= Math.hypot(k2.x, k2.y - 800) ? k1 : k2;
    const proxy = { p: 0 };
    this.zugFaehrt = true;
    // Blickrichtung einmal je Fahrt (nie mitten auf dem Weg spiegeln); bei fast senkrechten Wegen bleibt sie
    if (Math.abs(b.x - a.x) >= 80) this.setzeBlick(b.x < a.x);
    const zeichen = () => (this.zugLinks ? -1 : 1);
    const ok = await this.tween(proxy, { p: 1 }, dauer, {
      ease: 'sineInOut',
      onUpdate: () => {
        const p = proxy.p;
        const q = 1 - p;
        z.x = q * q * a.x + 2 * q * p * k.x + p * p * b.x;
        z.y = q * q * a.y + 2 * q * p * k.y + p * p * b.y;
        // Neigung aus der Ableitung der Kurve: bergab Nase runter, bergauf Nase hoch (stetig, ohne Sprung)
        const dx = 2 * q * (k.x - a.x) + 2 * p * (b.x - k.x);
        const dy = 2 * q * (k.y - a.y) + 2 * p * (b.y - k.y);
        const w = Math.atan2(dy, Math.abs(dx) + 60) * zeichen();
        this.zugDreh = clamp(w, -0.3, 0.3) * clamp(Math.hypot(dx, dy) / 300, 0, 1);
      },
    });
    this.zugFaehrt = false;
    this.zugDreh = 0;
    if (ok) {
      this.zugBeiOrt = o;
      fx.pop(this.zugKoerper, 0.07);
      await this.wait(0.25);
    }
  }

  // ---------------------------------------------------------------- Tiere

  baueTiere() {
    this.tiere = TIERE.map((d) => {
      const p = this.bild(d.bei[0], d.bei[1]);
      const a = new Actor(d.id, { x: p.x, y: p.y, scale: d.skala, flip: d.flip, parent: this.world, z: 20 });
      const h = a.sprite.texture.height;
      // runde Tippfläche um den Körper: gut 200 Einheiten Durchmesser (Lücke zwischen den Orten ist knapp)
      tap(a, () => this.tierFreutSich(a), { sound: null, squash: false, hitArea: new PIXI.Circle(0, -h * 0.45, 102 / d.skala) });
      return a;
    });
  }

  // wie actor.cheer(), aber passend zur kleinen Figur auf der Karte: kleiner Hüpfer, drei kleine Herzen
  tierFreutSich(a) {
    a.sound();
    if (a.freut) return;   // während der Freude nur der Laut – nichts zappelt
    a.freut = true;
    a.pose('happy');
    const kopf = this.front.toLocal(a.point('kopf'), this.world);
    fx.burst('herzen', kopf.x, kopf.y, { count: 3, groesse: 0.5 });
    a.hop(45).then(() => this.wait(0.6)).then(() => {
      a.freut = false;
      if (!a.destroyed) a.pose('idle');
    });
  }

  // ---------------------------------------------------------------- Wolkenschatten

  baueWolken() {
    this.wolken = [0, 1, 2].map((i) => {
      const w = spr('rahmen/wolkenschatten', { parent: this.front });
      w.tint = 0x1d3512;
      w.alpha = 0.14;
      w.scale.set(rand(1.3, 1.7));
      w.zIndex = 0;
      w.eventMode = 'none';
      w.x = -1300 + i * 1000 + rand(-150, 150);
      w.y = [380, 1150, 760][i] + rand(-80, 80);
      w.tempo = rand(11, 18);
      return w;
    });
  }

  // ---------------------------------------------------------------- Vogel

  baueVogel() {
    const v = new Vogel({ farbe: pick([0x7fb6e6, 0xf2a65a, 0x9fd17a]) });
    v.zIndex = 900;
    v.scale.set(1.25);
    v.visible = false;
    this.front.addChild(v);
    this.vogel = v;
    this.vogelPause = rand(6, 10);
    this.vogelFlug = null;   // { richtung, y0, tempo, huepf }
    tap(v, () => this.vogelGetippt(), { sound: null, squash: false, hitArea: new PIXI.Circle(0, -5, 115) });
  }

  starteVogel() {
    const v = this.vogel;
    const richtung = Math.random() < 0.5 ? 1 : -1;
    const rand0 = stage.W / 2 + 150;
    v.x = -richtung * rand0;
    this.vogelFlug = { richtung, y0: rand(170, 320), tempo: rand(150, 190), huepf: 0, t: 0 };
    v.y = this.vogelFlug.y0;
    v.blickLinks = richtung < 0;
    v.visible = true;
  }

  vogelGetippt() {
    const f = this.vogelFlug;
    if (!f) return;
    sfx('common/kueken', { vol: 0.7 });
    fx.burst('herzen', this.vogel.x, this.vogel.y - 30, { count: 2, groesse: 0.6 });
    const proxy = { p: 0 };
    this.tween(proxy, { p: 1 }, 0.9, { ease: 'sineInOut', onUpdate: () => { f.huepf = Math.sin(proxy.p * Math.PI); } });
  }

  // ---------------------------------------------------------------- Wiese

  wieseGetippt(x, y) {
    // unten rechts sitzt das Eltern-Zahnrad: dort wächst nichts
    if (y > stage.H - 240 && x + stage.W / 2 > stage.W - 240) return;
    // ganz oben (Hügel, Himmel) und auf dem Holzgleis: ein leises Funkeln und ein Ton. Die Blume (Fuß bei y+30,
    // Blüte etwa 60 darüber) darf das Gleis nirgends berühren.
    if (y < 150 || this.aufGleis(x, y + 30) || this.aufGleis(x, y - 15) || this.aufGleis(x, y - 55)) {
      fx.burst('funkeln', x, y, { count: 3 });
      note('pling', pick(PENTATONIK), { vol: 0.35 });
      return;
    }
    // an einer vorhandenen Blume: sie wackelt
    const nah = this.blumen.find((b) => Math.hypot(b.x - x, b.y - 30 - y) < 70);
    if (nah) {
      fx.wobble(nah.kopf, 0.25);
      note('pling', pick(PENTATONIK), { vol: 0.35 });
      return;
    }
    this.wiesenTipps++;
    const b = blume(undefined, rand(1.15, 1.4));
    b.position.set(x, y + 30);
    b.zIndex = 5;
    const s = b.scale.x;
    b.scale.set(0);
    this.world.addChild(b);
    this.tween(b, { scale: s }, 0.55, { ease: 'backOut' });
    this.blumen.push(b);
    sfx('common/wachsen', { vol: 0.55 });
    // zu viele Blumen: die älteste verblasst weich
    if (this.blumen.length > MAX_BLUMEN) {
      const alt = this.blumen.shift();
      this.tween(alt, { alpha: 0 }, 1.2, { ease: 'sineInOut' }).then(() => { if (!alt.destroyed) alt.destroy({ children: true }); });
    }
    // jede dritte Blume: ein Schmetterling flattert auf und davon
    if (this.wiesenTipps % 3 === 0 && this.falter.length < 2) {
      this.after(0.5, () => {
        // flattert aus der Blüte auf (weich eingeblendet, taucht nicht plötzlich auf)
        const f = new Schmetterling({ x, y: y - 40, einblenden: 0.6 });
        f.zIndex = 60;
        f.scale.set(1.6);
        this.world.addChild(f);
        this.falter.push(f);
        f.fliegWeg(x > 0 ? -1 : 1, (weg) => {
          this.falter = this.falter.filter((q) => q !== weg);
          weg.destroy({ children: true });
        });
      });
    }
  }

  // ---------------------------------------------------------------- Ablauf

  update(dt, t) {
    // Ringe: unbesuchte atmen ganz sanft, besuchte ruhen; angetippt leuchtet der Ring weich auf
    const k = 1 - Math.exp(-dt * 3);
    for (const o of this.orte) {
      const r = o.ring;
      let ziel;
      let gross = 1;
      if (o.leuchtet) {
        ziel = 1;
        gross = 1.12;
      } else if (this.besucht.has(o.id)) {
        ziel = 0.4;
      } else {
        const w = Math.sin((t / 3.4) * Math.PI * 2 + o.phase);
        ziel = 0.78 + 0.2 * w;
        gross = 1 + 0.025 * w;
      }
      o.glanz += (ziel - o.glanz) * k;
      r.alpha = o.glanz;
      const s = r.ruhe * (r.gross = (r.gross ?? 1) + (gross - (r.gross ?? 1)) * k);
      r.scale.set(s);
    }

    // kleiner Zug: im Stand ganz leises Wippen, beim Fahren etwas Rattern; Drehung weich nachführen
    const zk = this.zugKoerper;
    zk.y = this.zugFaehrt ? Math.sin(t * 22) * 2.5 : Math.sin(t * 1.8) * 1.5;
    zk.rotation += (this.zugDreh - zk.rotation) * (1 - Math.exp(-dt * 10));
    if (!this.zugFaehrt && !this.unterwegs && t > 3) {
      this.dampfZeit = (this.dampfZeit ?? 4) - dt;
      if (this.dampfZeit <= 0) {
        this.dampfZeit = rand(6, 9);
        this.dampf(1);
      }
    }

    // Wolkenschatten ziehen sehr langsam von links nach rechts
    const rand0 = stage.W / 2 + 700;
    for (const w of this.wolken) {
      w.x += w.tempo * dt;
      if (w.x > rand0) {
        w.x = -rand0;
        w.y = rand(300, 1300);
      }
    }

    // Vogel
    const f = this.vogelFlug;
    if (f) {
      f.t += dt;
      const v = this.vogel;
      v.x += f.richtung * f.tempo * dt;
      v.y = f.y0 + Math.sin(f.t * 1.4) * 22 - f.huepf * 70;
      v.tick(dt);
      if (Math.abs(v.x) > stage.W / 2 + 200) {
        v.visible = false;
        this.vogelFlug = null;
        this.vogelPause = rand(16, 28);
      }
    } else {
      this.vogelPause -= dt;
      if (this.vogelPause <= 0) this.starteVogel();
    }

    for (const b of this.blumen) b.tick(dt);
    for (const s of this.falter) s.tick(dt);
  }

  hints() {
    if (this.unterwegs) return [];
    const da = this.orte.filter((o) => SceneManager.has(o.id) && !this.fehlt.has(o.id));
    const neu = da.filter((o) => !this.besucht.has(o.id));
    // zuerst der Bahnhof, dann die übrigen noch nie besuchten Orte (vom Zug aus nah zuerst)
    neu.sort((a, b) => {
      if (a.id === 'bahnhof') return -1;
      if (b.id === 'bahnhof') return 1;
      const z = this.zug;
      return Math.hypot(a.x - z.x, a.y - z.y) - Math.hypot(b.x - z.x, b.y - z.y);
    });
    const liste = (neu.length ? neu : da).slice(0, 3);
    return liste.map((o) => ({ x: o.x, y: o.y - 20 }));
  }
}

function liste(x) {
  return Array.isArray(x) ? x.filter((e) => typeof e === 'string') : [];
}
