// Flughafen – gemeinsame Kleinigkeiten aller drei Seiten: ruhige Flüge und Gleitwege, Reiseziele, Postkarten
// (die Pinnwand wächst über die Besuche), gezeichnete Vögel, ein weicher Ziel-Ring und die Gäste-Reihe.
// Alles ruhig: nichts rast (Flüge höchstens 1400 Einheiten/s an der schnellsten Stelle), Helligkeit ändert sich weich.

import { PIXI, spr, meta, tex, store, shuffle, clamp, Actor, fx, tap, note, animal } from '../../engine/index.js';

// ---------------------------------------------------------------- Bewegung

const BOGEN_V_MAX = 1300;

/** Kürzeste Dauer eines Bogens (sineInOut), bei der er nirgends schneller als BOGEN_V_MAX ist. */
function bogenMindestDauer(dx, dy, hoehe) {
  let spitze = 0;
  for (let i = 1; i < 40; i++) {
    const t = i / 40;
    const k = (1 - Math.cos(Math.PI * t)) / 2;
    const dk = (Math.PI / 2) * Math.sin(Math.PI * t);
    const vx = dx;
    const vy = dy - 4 * hoehe * (1 - 2 * k);
    spitze = Math.max(spitze, Math.hypot(vx, vy) * dk);
  }
  return spitze / BOGEN_V_MAX;
}

/**
 * Ding im Bogen zu (x, y) fliegen lassen (im selben Container). opt: {dauer, hoehe, skala, ziel: () => {x, y}}
 * → thenable der Seite (true = angekommen)
 */
export function bogenFlug(seite, obj, x, y, opt = {}) {
  const x0 = obj.x;
  const y0 = obj.y;
  const s0 = obj.scale.y;
  const s1 = opt.skala ?? s0;
  const hoehe = opt.hoehe ?? 150;
  const p = { k: 0 };
  let zx = x;
  let zy = y;
  const dauer = Math.max(opt.dauer ?? 0.55, bogenMindestDauer(x - x0, y - y0, hoehe));
  return seite.tween(p, { k: 1 }, dauer, {
    ease: 'sineInOut',
    onUpdate: () => {
      if (obj.destroyed) return;
      if (opt.ziel) {
        const z = opt.ziel();
        if (z) { zx = z.x; zy = z.y; }
      }
      const k = p.k;
      obj.x = x0 + (zx - x0) * k;
      obj.y = y0 + (zy - y0) * k - hoehe * 4 * k * (1 - k);
      if (s1 !== s0) obj.scale.set(Math.sign(obj.scale.x || 1) * (s0 + (s1 - s0) * k), s0 + (s1 - s0) * k);
    },
  });
}

/**
 * Gemächlich gleiten (Fahrzeuge): Dauer aus dem Weg und dem Tempo (Durchschnitt), sanft an- und abbremsen.
 * Bei sineInOut ist die Spitze π/2 × Durchschnitt – tempo 600 → höchstens etwa 940 Einheiten/s.
 */
export function gleite(seite, obj, x, y, tempo = 500, opt = {}) {
  const d = Math.hypot(x - obj.x, y - obj.y);
  const dauer = Math.max(opt.min ?? 0.4, d / tempo);
  return seite.tween(obj, { x, y }, dauer, { ease: opt.ease || 'sineInOut', onUpdate: opt.onUpdate });
}

/** Ding in einen anderen Container hängen, ohne dass es springt (Ort und Größe bleiben). */
export function umhaengen(obj, neu) {
  const alt = obj.parent;
  if (!alt || alt === neu) return;
  const g = alt.toGlobal(obj.position);
  const sa = Math.hypot(alt.worldTransform.a, alt.worldTransform.b) || 1;
  const sn = Math.hypot(neu.worldTransform.a, neu.worldTransform.b) || 1;
  const p = neu.toLocal(g);
  neu.addChild(obj);
  obj.position.set(p.x, p.y);
  obj.scale.set(obj.scale.x * (sa / sn), obj.scale.y * (sa / sn));
}

/** Zufällig aus der Liste, aber nie dasselbe wie zuletzt. */
export function andersAls(liste, letztes) {
  const rest = liste.filter((x) => x !== letztes);
  return rest[Math.floor(Math.random() * rest.length)] ?? liste[0];
}

/** Liegt ein Ziehen nur als Tipp vor (kaum bewegt)? */
export const kurz = (ctx) => Math.hypot(ctx.x - ctx.startX, ctx.y - ctx.startY) < 50;

// ---------------------------------------------------------------- Reiseziele und Postkarten

export const ZIELE = {
  meer: { bild: 'flughafen/ziel_meer', farbe: 0x4cc3c8, ton: () => note('xylo', 72, { vol: 0.3 }) },
  berge: { bild: 'flughafen/ziel_berge', farbe: 0x7cc35a, ton: () => note('floete', 74, { vol: 0.3 }) },
  schnee: { bild: 'flughafen/ziel_schnee', farbe: 0xa9d6f2, ton: () => note('glocke', 84, { vol: 0.28 }) },
  insel: { bild: 'flughafen/ziel_insel', farbe: 0xf6c444, ton: () => note('xylo', 79, { vol: 0.3 }) },
};
export const ZIEL_IDS = Object.keys(ZIELE);

const POST_KEY = 'flughafen.postkarten';
export const PINNWAND_PLAETZE = 9;

/** Gesammelte Postkarten (älteste zuerst, höchstens 30 gemerkt). */
export function postkarten() {
  const l = store.get(POST_KEY, []);
  return Array.isArray(l) ? l.filter((z) => ZIELE[z]) : [];
}

/** Eine Postkarte mehr (bleibt über die Besuche). → neue Anzahl */
export function postkarteDazu(ziel) {
  const l = postkarten();
  l.push(ziel);
  while (l.length > 30) l.shift();
  store.set(POST_KEY, l);
  return l.length;
}

/**
 * Postkarte als Container (Mitte = Kartenmitte): cremefarbene Karte, darin das Bild des Ziels, eine Briefmarke.
 * breite = Kartenbreite in Einheiten.
 */
export function postkarte(ziel, breite = 200) {
  const z = ZIELE[ziel] || ZIELE.meer;
  const h = breite * 0.68;
  const c = new PIXI.Container({ label: 'postkarte:' + ziel });
  const g = new PIXI.Graphics();
  g.roundRect(-breite / 2 + 4, -h / 2 + 7, breite, h, breite * 0.07).fill({ color: 0x5a4630, alpha: 0.18 });
  g.roundRect(-breite / 2, -h / 2, breite, h, breite * 0.07).fill(0xfff8ea).stroke({ width: breite * 0.025, color: 0xe9d7b8 });
  c.addChild(g);
  // Bildfeld: Himmel in der Farbe des Ziels, darunter das Ziel
  const bw = breite * 0.86;
  const bh = h * 0.8;
  const feld = new PIXI.Container();
  const himmel = new PIXI.Graphics();
  himmel.roundRect(-bw / 2, -bh / 2, bw, bh, breite * 0.04).fill(0xbfe3f7);
  himmel.circle(-bw * 0.32, -bh * 0.22, bh * 0.13).fill({ color: 0xffe9a0, alpha: 0.9 });
  feld.addChild(himmel);
  const m = meta(z.bild);
  const b = spr(z.bild, { parent: feld });
  b.anchor.set(0.5, 1);
  const s = (bw * 1.02) / (m?.w || 1300);
  b.scale.set(Math.max(s, (bh * 0.62) / (m?.h || 400)));
  b.y = bh / 2 + 2;
  const maske = new PIXI.Graphics().roundRect(-bw / 2, -bh / 2, bw, bh, breite * 0.04).fill(0xffffff);
  feld.addChild(maske);
  b.mask = maske;
  c.addChild(feld);
  // Briefmarke oben rechts (gezackt angedeutet)
  const marke = new PIXI.Graphics();
  const mw = breite * 0.17;
  marke.roundRect(-mw / 2, -mw * 0.6, mw, mw * 1.2, mw * 0.12).fill(0xffffff).stroke({ width: breite * 0.012, color: z.farbe });
  marke.roundRect(-mw * 0.34, -mw * 0.42, mw * 0.68, mw * 0.84, mw * 0.08).fill(z.farbe);
  marke.circle(-mw * 0.1, -mw * 0.05, mw * 0.14).fill(0xff8fa0);
  marke.circle(mw * 0.1, -mw * 0.05, mw * 0.14).fill(0xff8fa0);
  marke.roundPoly(0, mw * 0.08, mw * 0.17, 3, mw * 0.04, Math.PI).fill(0xff8fa0);
  marke.position.set(bw / 2 - mw * 0.55, -bh / 2 + mw * 0.55);
  marke.rotation = 0.08;
  c.addChild(marke);
  c.ziel = ziel;
  return c;
}

// ---------------------------------------------------------------- Pinnwand (Seite 1)

/**
 * Die Postkarten an der Korkwand. Plätze im Raster 3 × 3; kommt eine zehnte, rutscht die älteste weich hinaus.
 * bereich = {x, y, w, h} (Mitte und Größe der Korkfläche in Seiten-Koordinaten).
 */
export class Pinnwand {
  constructor(seite, bereich, { z = 3 } = {}) {
    this.seite = seite;
    this.b = bereich;
    this.karten = [];
    this.c = new PIXI.Container({ label: 'pinnwand', sortableChildren: true });
    this.c.zIndex = z;
    seite.welt.addChild(this.c);
    this.breite = Math.min(170, (bereich.w - 40) / 3.05);
    // Leere Wand antippen: ein leises Klopfen, ein paar Funkel (die Karten haben eigene Tippflächen)
    const leer = new PIXI.Container({ label: 'pinnwand_flaeche' });
    leer.hitArea = new PIXI.Rectangle(bereich.x - bereich.w / 2, bereich.y - bereich.h / 2, bereich.w, bereich.h);
    leer.zIndex = 0;
    this.c.addChild(leer);
    tap(leer, () => {
      note('xylo', 67, { vol: 0.25 });
      for (const k of this.karten) fx.wobble(k, 0.05);
    }, { sound: null, squash: false });
    this.stand = 0;
    this.auffrischen(true);
  }

  platz(i) {
    const sp = i % 3;
    const ze = Math.floor(i / 3);
    const dx = (this.b.w - 40) / 3;
    const dy = (this.b.h - 40) / 3;
    return {
      x: this.b.x - this.b.w / 2 + 20 + dx * (sp + 0.5) + ((i * 37) % 17) - 8,
      y: this.b.y - this.b.h / 2 + 20 + dy * (ze + 0.5) + ((i * 53) % 13) - 6,
      r: (((i * 71) % 9) - 4) * 0.022,
    };
  }

  /** Karten aus dem Speicher zeigen (neue gleiten weich dazu). sofort = ohne Bewegung. */
  auffrischen(sofort = false) {
    const alle = postkarten();
    const n = alle.length;
    if (n === this.stand && !sofort) return;
    const neu = sofort ? 0 : Math.max(0, n - this.stand);
    this.stand = n;
    const sichtbar = alle.slice(-PINNWAND_PLAETZE);
    // vorhandene Karten abbauen und neu stecken (es sind höchstens neun)
    for (const k of this.karten) if (!k.destroyed) k.destroy({ children: true });
    this.karten = [];
    sichtbar.forEach((ziel, i) => {
      const k = postkarte(ziel, this.breite);
      const p = this.platz(i);
      k.position.set(p.x, p.y);
      k.rotation = p.r;
      k.zIndex = 2 + i;
      // Pin oben
      const pin = new PIXI.Graphics();
      pin.circle(0, 0, 11).fill(0xe8574e).stroke({ width: 3, color: 0xb83c36 });
      pin.circle(-3, -3, 4).fill({ color: 0xffffff, alpha: 0.6 });
      pin.y = -this.breite * 0.3;
      k.addChild(pin);
      const r = Math.max(110, this.breite * 0.62);
      k.hitArea = new PIXI.Rectangle(-r, -r, 2 * r, 2 * r);
      tap(k, () => this.kartenTipp(k), { sound: null });
      this.c.addChild(k);
      this.karten.push(k);
      const istNeu = i >= sichtbar.length - neu;
      if (istNeu) {
        k.alpha = 0;
        k.scale.set(0.6);
        this.seite.tween(k, { alpha: 1 }, 0.6, { ease: 'sineInOut', delay: 0.3 });
        this.seite.tween(k, { scale: 1 }, 0.7, { ease: 'backOut', delay: 0.3 });
      }
    });
  }

  kartenTipp(k) {
    fx.wobble(k, 0.08);
    ZIELE[k.ziel]?.ton();
    this.seite.burst('funkeln', k.x, k.y - 20, { count: 3 });
  }

  /** Ort des nächsten freien Platzes (für die ankommende Karte). */
  naechsterPlatz() {
    const i = Math.min(postkarten().length, PINNWAND_PLAETZE - 1);
    return this.platz(i);
  }
}

/**
 * Denkblase mit beliebigem Inhalt (z. B. einer Postkarte). Ursprung = kleinstes Bläschen (dorthin, wo der Kopf ist).
 * breite = Breite der Blase in Einheiten; inhalt wird in die Mitte der Fläche gesetzt.
 */
export function denkBlase(inhalt, breite = 360) {
  const b = new PIXI.Container({ label: 'denkblase' });
  const m = meta('common/blase_denk') || { w: 600, h: 562, pts: {} };
  const schwanz = m.pts?.schwanz || [45, 540];
  const innen = m.pts?.innen || [330, 262];
  const s = breite / m.w;
  spr('common/blase_denk', { anchor: [schwanz[0] / m.w, schwanz[1] / m.h], scale: s, parent: b });
  inhalt.position.set((innen[0] - schwanz[0]) * s, (innen[1] - schwanz[1]) * s);
  b.addChild(inhalt);
  b.innen = inhalt;
  return b;
}

// ---------------------------------------------------------------- Gezeichnetes

/** Kleiner runder Vogel (schaut nach rechts, Ursprung = Bauchmitte), Flügel einzeln (zum Flattern). */
export function zeichneVogel({ farbe = 0x6fa8dc, dunkel = 0x4c82bd, bauch = 0xfff1dc } = {}) {
  const c = new PIXI.Container({ label: 'vogel' });
  const g = new PIXI.Graphics();
  g.roundPoly(-60, 10, 24, 3, 9, Math.PI * 0.95).fill(dunkel);
  g.ellipse(0, 4, 58, 46).fill(farbe);
  g.circle(30, -30, 33).fill(farbe);
  g.ellipse(14, 16, 36, 26).fill(bauch);
  g.ellipse(18, -50, 13, 7).fill({ color: 0xffffff, alpha: 0.35 });
  g.roundPoly(64, -26, 12, 3, 4, 0).fill(0xf2a23a);
  g.circle(40, -36, 8.5).fill(0x2a2018);
  g.circle(43, -39, 3).fill(0xffffff);
  g.ellipse(40, -16, 8, 5.5).fill({ color: 0xff9aa6, alpha: 0.75 });
  c.addChild(g);
  const fluegel = new PIXI.Graphics();
  fluegel.ellipse(0, -14, 34, 20).fill(dunkel);
  fluegel.ellipse(4, -20, 20, 8).fill({ color: 0xffffff, alpha: 0.2 });
  fluegel.position.set(-14, 0);
  c.addChild(fluegel);
  c.fluegel = fluegel;
  return c;
}

/** Weicher Ziel-Ring (zeigt, wohin etwas gehört): atmet langsam. Ursprung = Mitte. */
export function zielRing(r = 80, farbe = 0xffffff) {
  const g = new PIXI.Graphics();
  g.circle(0, 0, r).stroke({ width: 10, color: farbe, alpha: 0.85 });
  g.circle(0, 0, r - 16).stroke({ width: 5, color: farbe, alpha: 0.45 });
  g.eventMode = 'none';
  return g;
}

/** Atmen eines Rings (in update aufrufen). */
export function atme(obj, t, basis = 1) {
  if (!obj || obj.destroyed) return;
  obj.scale.set(basis * (1 + 0.06 * Math.sin(t * 2.2)));
}

// ---------------------------------------------------------------- Gäste

export const GAESTE = [
  'hase', 'katze', 'hund', 'fuchs', 'schwein', 'maus', 'igel', 'eichhoernchen', 'pinguin', 'ente', 'frosch', 'affe',
  'schaf', 'loewe', 'elefant', 'giraffe', 'kuh', 'pferd', 'eule',
];

/** Gäste in gemischter Reihenfolge, ohne dass dasselbe Tier zweimal hintereinander kommt. */
export class GaesteReihe {
  constructor(liste = GAESTE) {
    this.liste = liste;
    this.reihe = [];
    this.letzter = null;
  }

  naechster(ausser = []) {
    for (let i = 0; i < 40; i++) {
      if (!this.reihe.length) {
        this.reihe = shuffle(this.liste.slice());
        if (this.reihe[0] === this.letzter) this.reihe.push(this.reihe.shift());
      }
      const id = this.reihe.shift();
      if (ausser.includes(id) && this.liste.length > ausser.length + 1) continue;
      this.letzter = id;
      return id;
    }
    return this.liste[0];
  }
}

/** Kopf eines Tieres als kleines rundes Bild (für die Fenster der Flieger). Ursprung = Mitte. */
export function tierKopf(id, r) {
  const c = new PIXI.Container({ label: 'kopf:' + id });
  const bild = `tiere/${id}_happy`;
  const m = meta(bild);
  const s = spr(bild, { parent: c });
  s.anchor.set(0.5, 0.3);
  s.scale.set((r * 3.6) / (m?.w || 700));
  s.y = r * 0.15;
  const maske = new PIXI.Graphics().circle(0, 0, r).fill(0xffffff);
  c.addChild(maske);
  s.mask = maske;
  c.eventMode = 'none';
  return c;
}

/** Ein Tier als Figur (kleine Hilfe, damit alle Seiten dieselben Einstellungen nutzen). */
export function neuesTier(seite, id, { x, y, scale, z = 20, parent }) {
  const a = new Actor(id, { x, y, scale, parent: parent || seite.welt, z });
  return a;
}

/** Tierlaut höchstens alle 1,2 s (Dauertippen macht keinen Lärm). */
let letzterLaut = 0;
export function leiserLaut(a) {
  const jetzt = performance.now();
  if (!a || a.destroyed || jetzt - letzterLaut < 1200) return;
  letzterLaut = jetzt;
  a.sound();
}

/** Vogel-Piepen höchstens alle 0,6 s. */
let letztesPiep = 0;
export function piep() {
  const jetzt = performance.now();
  if (jetzt - letztesPiep < 600) return;
  letztesPiep = jetzt;
  animal('vogel');
}

export { clamp, tex };
