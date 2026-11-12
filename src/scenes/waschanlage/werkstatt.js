// Werkstatt-Teile der Waschanlage (alle ruhig, alle groß genug für kleine Hände):
//   KUNDEN        Tiere, die ihr Fahrzeug bringen (fahren auf dem Dach mit, warten, freuen sich)
//   DEKO          Aufkleber, die das saubere Fahrzeug zum Schluss bekommt (vorhandene Bilder aus common)
//   SCHMUTZ       Arten von Schmutz (Matsch, Staub, Farbe, Blätter, gemischt)
//   FUNDE         kleine Überraschungen unter einem Fleck (Frosch, Wurm, Ball, Teddy)
//   Pumpe         Luftpumpe mit Griff, der beim Antippen hinuntergeht, und Schlauch zum platten Reifen
//   StickerBrett  Brett mit drei Aufklebern zum Aussuchen
//   Wimpelkette   wächst mit jedem fertigen Fahrzeug um einen Wimpel (gespeichert, bleibt über Besuche)
//   neuOhne(liste, alt)   zufällig, aber nie dasselbe wie zuletzt

import { spr, tex, meta, tap, store, rand, pick, lerp, PIXI } from '../../engine/index.js';

const { Container, Graphics, Circle, Rectangle } = PIXI;

/** Tiere, die ein Fahrzeug bringen; h = gewünschte Höhe in Einheiten (Bilder sind 900 hoch) */
export const KUNDEN = [
  { id: 'kuh', h: 285 }, { id: 'schaf', h: 260 }, { id: 'schwein', h: 250 }, { id: 'pferd', h: 300 },
  { id: 'hund', h: 255 }, { id: 'katze', h: 240 }, { id: 'hase', h: 255 }, { id: 'fuchs', h: 250 },
  { id: 'igel', h: 215 }, { id: 'baer', h: 290 }, { id: 'maus', h: 210 }, { id: 'pinguin', h: 245 },
  { id: 'eichhoernchen', h: 240 }, { id: 'huhn', h: 230 },
];

/** Aufkleber zum Aussuchen (alle aus common, also immer geladen) */
export const DEKO = [
  'common/p_stern', 'common/p_herz', 'common/icon_sonne', 'common/regenbogen', 'common/mond',
  'common/futter_erdbeere', 'common/icon_musik', 'common/wolke3', 'common/futter_apfel', 'common/p_schneeflocke',
];

export const SCHMUTZ = ['matsch', 'staub', 'farbe', 'blaetter', 'gemischt'];
export const FUNDE = ['frosch', 'wurm', 'ball', 'teddy'];

/** Farben für Farbkleckse (weich, nicht grell) und Staub */
export const FARBEN = [0xff8fb8, 0x7cc4ff, 0xffd24d, 0x8fd16a, 0xc39bff, 0x6fd6c8];
export const STAUB = [0xcdb79a, 0xc2b29b, 0xd6c3a4];

/** zufällig aus liste, aber nicht alt (bzw. nichts aus alt, wenn alt eine Liste ist) */
export function neuOhne(liste, alt) {
  const weg = Array.isArray(alt) ? alt : [alt];
  const frei = liste.filter((x) => !weg.includes(x));
  return pick(frei.length ? frei : liste);
}

// ---------------------------------------------------------------- Pumpe

export class Pumpe extends Container {
  /** seite = Seite (tween/after), welt = Ebene für den Schlauch */
  constructor(seite, { x, y, parent, z = 46, skala = 0.78, onPump }) {
    super({ label: 'pumpe' });
    this.seite = seite;
    this.position.set(x, y);
    this.scale.set(skala);
    this.zIndex = z;
    const m = meta('waschanlage/pumpe_koerper');
    const oben = m.pts?.griff || [115, 128];
    // Griff hinter dem Körper: die Stange verschwindet beim Pumpen im Körper
    this.griffY = oben[1] - m.ay * m.h;
    this.griff = spr('waschanlage/pumpe_griff', { x: oben[0] - m.ax * m.w, y: this.griffY, parent: this });
    this.koerper = spr('waschanlage/pumpe_koerper', { parent: this });
    for (const s of [this.griff, this.koerper]) s.eventMode = 'none';
    const sl = m.pts?.schlauch || [200, 382];
    this.schlauchLokal = { x: sl[0] - m.ax * m.w, y: sl[1] - m.ay * m.h };
    parent.addChild(this);

    // Schlauch (in der Ebene der Pumpe, über dem Fahrzeug, damit er sichtbar am Rad steckt)
    this.schlauch = new Graphics();
    this.schlauch.zIndex = 31;
    this.schlauch.eventMode = 'none';
    parent.addChild(this.schlauch);

    // Tippfläche: ganze Pumpe, unten nicht in den Rand der Systemgesten
    tap(this, () => onPump?.(), {
      sound: null, squash: false, hitArea: new Rectangle(-150, -m.ay * m.h - 40, 300, m.ay * m.h - 20),
    });
    this.alpha = 0;
    this.visible = false;
    this.schlauch.alpha = 0;
    this.schlauch.visible = false;
    this.eventMode = 'none';
  }

  /** Schlauch von der Pumpe zum Rad (ziel in Eltern-Koordinaten) */
  legeSchlauch(ziel) {
    const a = { x: this.x + this.schlauchLokal.x * this.scale.x, y: this.y + this.schlauchLokal.y * this.scale.y };
    const g = this.schlauch;
    g.clear();
    const weg = (dicke, farbe, alpha, dy = 0) => g
      .moveTo(a.x, a.y + dy)
      .bezierCurveTo(a.x + 120, a.y + 70 + dy, ziel.x - 140, ziel.y + 170 + dy, ziel.x, ziel.y + dy)
      .stroke({ width: dicke, color: farbe, alpha, cap: 'round' });
    weg(24, 0x3d4250, 1);
    weg(7, 0x7c8494, 0.7, -6);
    g.circle(ziel.x, ziel.y, 19).fill(0xf2c53d).stroke({ width: 3, color: 0xd6a22a });
    g.circle(a.x, a.y, 15).fill(0xf2c53d);
  }

  /** Griff hinunter und wieder hinauf */
  pumpe() {
    const s = this.seite;
    const g = this.griff;
    s.tween(g, { y: this.griffY + 44 }, 0.14, { ease: 'quadIn' })
      .then((ok) => { if (ok) s.tween(g, { y: this.griffY }, 0.32, { ease: 'sineOut' }); });
  }
}

// ---------------------------------------------------------------- Sticker-Brett

export class StickerBrett extends Container {
  constructor(seite, { x, y, parent, z = 47, onWahl }) {
    super({ label: 'stickerbrett' });
    this.seite = seite;
    this.position.set(x, y);
    this.zIndex = z;
    const brett = new Graphics()
      .roundRect(-318, -112, 636, 224, 46).fill(0xe9d3a6)
      .roundRect(-310, -116, 620, 214, 42).fill(0xfff3dc).stroke({ width: 5, color: 0xe3cfa8 })
      .roundRect(-290, -106, 580, 26, 13).fill({ color: 0xffffff, alpha: 0.5 });
    brett.eventMode = 'none';
    this.addChild(brett);
    this.plaetze = [-205, 0, 205].map((px, i) => {
      const c = new Container({ label: 'aufkleber' });
      c.position.set(px, -6);
      const teller = new Graphics()
        .circle(0, 6, 92).fill({ color: 0xd8c39a, alpha: 0.6 })
        .circle(0, 0, 92).fill(0xffffff).stroke({ width: 4, color: 0xf0e2c8 });
      teller.eventMode = 'none';
      const bild = spr('common/p_stern', { anchor: 0.5, parent: c });
      bild.eventMode = 'none';
      c.addChildAt(teller, 0);
      this.addChild(c);
      const platz = { c, bild, id: null, i };
      tap(c, () => onWahl?.(platz), { sound: null, hitArea: new Circle(0, 0, 108) });
      return platz;
    });
    parent.addChild(this);
    this.alpha = 0;
    this.visible = false;
    this.eventMode = 'none';
  }

  belege(ids) {
    this.plaetze.forEach((p, i) => {
      p.id = ids[i];
      p.bild.texture = tex(ids[i]);
      const t = p.bild.texture;
      p.bild.scale.set(132 / Math.max(t.width, t.height, 1));
      p.bild.visible = true;
      p.c.scale.set(1);
      p.c.rotation = 0;
    });
  }
}

// ---------------------------------------------------------------- Wimpelkette

const WIMPEL_FARBEN = [0xf26b6b, 0x4fa8e8, 0xf5b731, 0x6cc05a, 0xa77fe0, 0xf28a3c];
const PLAETZE = 12;
const SPEICHER = 'waschanlage.wimpel';

export class Wimpelkette extends Container {
  constructor(seite, { parent, z = 3, von = -960, bis = 960, y = 228, durchhang = 72 }) {
    super({ label: 'wimpelkette' });
    this.seite = seite;
    this.zIndex = z;
    this.von = von;
    this.bis = bis;
    this.y0 = y;
    this.durchhang = durchhang;
    const schnur = new Graphics();
    const n = 24;
    schnur.moveTo(von, this.hoehe(von));
    for (let i = 1; i <= n; i++) {
      const x = lerp(von, bis, i / n);
      schnur.lineTo(x, this.hoehe(x));
    }
    schnur.stroke({ width: 5, color: 0xf7f0e2 });
    schnur.circle(von, this.hoehe(von), 11).fill(0xf2c53d).circle(bis, this.hoehe(bis), 11).fill(0xf2c53d);
    schnur.eventMode = 'none';
    this.addChild(schnur);
    this.wimpel = new Array(PLAETZE).fill(null);
    this.zeit = 0;
    parent.addChild(this);

    const daten = store.get(SPEICHER, null);
    this.liste = Array.isArray(daten?.liste) ? daten.liste.slice(0, PLAETZE) : [];
    this.anzahl = Number.isFinite(daten?.anzahl) ? daten.anzahl : this.liste.length;
    this.liste.forEach((bild, i) => { if (bild) this._baue(i, bild, false); });
  }

  hoehe(x) {
    const u = (x - (this.von + this.bis) / 2) / ((this.bis - this.von) / 2);
    return this.y0 + this.durchhang * (1 - u * u);
  }

  platzX(i) {
    return lerp(this.von + 85, this.bis - 85, i / (PLAETZE - 1));
  }

  /** Mitte des Wimpels i (für den Flug des Aufklebers) */
  platzMitte(i) {
    const x = this.platzX(i);
    return { x, y: this.hoehe(x) + 30 };
  }

  /** Nächster Platz, an den ein Wimpel kommt */
  naechsterPlatz() {
    return this.anzahl % PLAETZE;
  }

  _baue(i, bild, neu) {
    const x = this.platzX(i);
    const c = new Container({ label: 'wimpel' });
    c.position.set(x, this.hoehe(x));
    const farbe = WIMPEL_FARBEN[i % WIMPEL_FARBEN.length];
    const g = new Graphics()
      .roundPoly(0, 52, 80, 3, 16, Math.PI).fill(farbe).stroke({ width: 5, color: 0xffffff, alpha: 0.85 })
      .circle(0, 30, 33).fill({ color: 0xffffff, alpha: 0.9 })
      .circle(0, 3, 9).fill(0xf7f0e2);
    g.eventMode = 'none';
    c.addChild(g);
    const s = spr(bild, { anchor: 0.5, y: 30, parent: c });
    s.scale.set(54 / Math.max(s.texture.width, s.texture.height, 1));
    s.eventMode = 'none';
    // Neigung der Schnur an dieser Stelle
    const d = 10;
    c.basisDreh = Math.atan2(this.hoehe(x + d) - this.hoehe(x - d), 2 * d) * 0.6;
    c.rotation = c.basisDreh;
    c.phase = rand(0, Math.PI * 2);
    c.extra = 0;
    this.addChild(c);
    this.wimpel[i] = c;
    if (neu) {
      c.scale.set(0.2);
      c.alpha = 0;
      this.seite.tween(c, { alpha: 1 }, 0.4, { ease: 'sineInOut' });
      this.seite.tween(c, { scale: 1 }, 0.55, { ease: 'backOut' });
    }
    // antippen: wippt und klingt leise (die Kette ist hoch oben, darum großzügige Fläche)
    tap(c, () => { c.extra = 1; }, { sound: 'common/tipp', squash: false, hitArea: new Circle(0, 45, 100) });
    return c;
  }

  /** Neuer Wimpel mit diesem Bild. → true, wenn die Kette damit ganz voll wurde (erstes Mal oder je 12) */
  dazu(bild) {
    const i = this.naechsterPlatz();
    const alt = this.wimpel[i];
    if (alt) {
      this.wimpel[i] = null;
      this.seite.tween(alt, { alpha: 0 }, 0.4, { ease: 'sineInOut' }).then(() => { if (!alt.destroyed) alt.destroy({ children: true }); });
    }
    this._baue(i, bild, true);
    this.liste[i] = bild;
    this.anzahl++;
    store.set(SPEICHER, { liste: this.liste, anzahl: this.anzahl });
    return this.anzahl % PLAETZE === 0;
  }

  /** alle Wimpel wippen einmal sanft (Kette voll) */
  freuen() {
    for (const c of this.wimpel) if (c) c.extra = 1;
  }

  update(dt) {
    this.zeit += dt;
    for (const c of this.wimpel) {
      if (!c || c.destroyed) continue;
      c.extra = Math.max(0, c.extra - dt * 0.6);
      c.rotation = c.basisDreh + Math.sin(this.zeit * 1.3 + c.phase) * (0.035 + 0.12 * c.extra);
    }
  }
}

/** Punkt auf dem Dach eines Fahrzeugs (Bildpunkte relativ zum Anker): oben, eher links (Führerhaus) */
export function dachPunkt(punkte, maxX = Infinity) {
  let oben = Infinity;
  for (const p of punkte) oben = Math.min(oben, p.y);
  const top = punkte.filter((p) => p.y < oben + 45);
  let mx = 0;
  for (const p of top) mx += p.x;
  mx /= Math.max(1, top.length);
  // nicht weiter rechts als maxX; dort die oberste Stelle suchen (das Dach an genau dieser Stelle)
  const x = Math.min(mx, maxX);
  const nah = punkte.filter((p) => Math.abs(p.x - x) < 50);
  let y = Infinity;
  for (const p of nah.length ? nah : punkte) y = Math.min(y, p.y);
  return { x, y: y - 70 };
}

