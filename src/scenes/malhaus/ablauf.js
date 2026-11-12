// Gemeinsame Bausteine für den Ablauf „ein Bild für den Besuch" (alle drei Seiten des Malhauses):
//   - Besuch:  ein Tier kommt unten links herein, zeigt in einer Denkblase seinen Wunsch (bleibt sichtbar),
//              nickt, freut sich, geht wieder.
//   - Rahmen:  fünf Bilderrahmen (9-Slice, passen sich jeder Größe an) – fürs Blatt auf der Staffelei, für die
//              Auswahl-Reihe und für die kleinen Bilder an der Leine.
//   - Galerie: die fertigen Bilder hängen als kleine Bilder an einer Leine oben an der Wand (höchstens 8). Jedes Bild
//              hat seinen festen Platz; ein neuntes Bild ersetzt das älteste an dessen Platz (die anderen bleiben, wo
//              sie sind). Sie bleiben über Besuche hinweg (store 'malhaus.galerie').
// Alles ruhig: weiche Übergänge, höchstens eine Bewegung der Figur gleichzeitig.

import { tex, meta, hasTex, tap, fx, note, Actor, store, stage, pick, shuffle, clamp, PIXI } from '../../engine/index.js';

// ---------------------------------------------------------------- Rahmen

// innen = Abstand der Öffnung vom Bildrand (links, oben, rechts, unten) in Bildpunkten; ecke = 9-Slice-Ränder
export const RAHMEN = [
  { id: 'gold', tex: 'malhaus/bilderrahmen', ecke: 150, innen: [118, 118, 120, 111] },
  { id: 'herz', tex: 'malhaus/rahmen_herz', ecke: 100, innen: [64, 62, 63, 62] },
  { id: 'stern', tex: 'malhaus/rahmen_stern', ecke: 100, innen: [66, 62, 66, 64] },
  { id: 'blume', tex: 'malhaus/rahmen_blume', ecke: 100, innen: [62, 64, 62, 64] },
  { id: 'holz', tex: 'malhaus/rahmen_holz', ecke: 100, innen: [58, 55, 58, 58] },
];
const RAHMEN_NACH_ID = new Map(RAHMEN.map((r) => [r.id, r]));

/**
 * Rahmen um eine Öffnung w×h (Mitte = 0,0). dicke = wie breit die Leiste in Einheiten aussieht.
 * → NineSliceSprite (oder ein leerer Container, falls das Bild fehlt)
 */
export function baueRahmen(art, w, h, dicke) {
  const r = RAHMEN_NACH_ID.get(art) || RAHMEN[0];
  if (!hasTex(r.tex)) return new PIXI.Container();
  const [l, o, re, u] = r.innen;
  const k = dicke / ((l + o + re + u) / 4);
  const ns = new PIXI.NineSliceSprite({
    texture: tex(r.tex),
    leftWidth: r.ecke, topHeight: r.ecke, rightWidth: r.ecke, bottomHeight: r.ecke,
  });
  ns.width = Math.max(2 * r.ecke + 2, (w + (l + re) * k) / k);
  ns.height = Math.max(2 * r.ecke + 2, (h + (o + u) * k) / k);
  ns.scale.set(k);
  ns.position.set(-w / 2 - l * k, -h / 2 - o * k);
  ns.label = 'rahmen:' + r.id;
  return ns;
}

// ---------------------------------------------------------------- Galerie (Daten, bleiben über Besuche)

const MAX_BILDER = 8;
const KLEIN_W = 300;
const KLEIN_H = 193;
const POOL = [];                       // { canvas, ctx, texture, frei } – einmal je Modul angelegt (höchstens 9)
// liste: älteste zuerst; jeder Eintrag { klein, art, daten, platz } hat seinen festen Platz an der Leine (0 … 7).
// altKlein: das kleine Bild, das zuletzt ersetzt wurde – es bleibt bis zum nächsten neuen Bild unverändert, damit
// es an der Leine weich ausblenden kann, statt schlagartig das neue Bild zu zeigen.
const GAL = { liste: [], version: 0, geladen: false, altKlein: null };

function freierPlatz() {
  for (let p = 0; p < MAX_BILDER; p++) if (!GAL.liste.some((e) => e.platz === p)) return p;
  return -1;
}

function kleinesBild() {
  let k = POOL.find((p) => p.frei);
  if (!k) {
    const canvas = document.createElement('canvas');
    canvas.width = KLEIN_W;
    canvas.height = KLEIN_H;
    const ctx = canvas.getContext('2d');
    k = { canvas, ctx, texture: PIXI.Texture.from(canvas), frei: true };
    POOL.push(k);
  }
  k.frei = false;
  k.ctx.fillStyle = '#ffffff';
  k.ctx.fillRect(0, 0, KLEIN_W, KLEIN_H);
  k.texture.source.update();
  return k;
}

function speichern() {
  try {
    store.set('malhaus.galerie', GAL.liste.map((e) => ({ bild: e.daten, art: e.art, platz: e.platz })));
  } catch { /* egal – dann eben nur für diesen Besuch */ }
}

/** Gespeicherte Bilder einmal laden (die Bilder erscheinen, sobald sie dekodiert sind). */
export function galerieLaden() {
  if (GAL.geladen) return;
  GAL.geladen = true;
  let roh = [];
  try { roh = store.get('malhaus.galerie', []); } catch { roh = []; }
  if (!Array.isArray(roh)) return;
  for (const e of roh.slice(-MAX_BILDER)) {
    if (!e || typeof e.bild !== 'string' || !e.bild.startsWith('data:image/')) continue;
    const k = kleinesBild();
    // gespeicherter Platz, wenn gültig und frei – sonst (ältere Speicherstände) der nächste freie
    const p = e.platz;
    const platz = Number.isInteger(p) && p >= 0 && p < MAX_BILDER && !GAL.liste.some((x) => x.platz === p)
      ? p : freierPlatz();
    const eintrag = { klein: k, art: RAHMEN_NACH_ID.has(e.art) ? e.art : 'gold', daten: e.bild, platz };
    GAL.liste.push(eintrag);
    const img = new Image();
    img.onload = () => {
      if (k.frei) return;
      k.ctx.drawImage(img, 0, 0, KLEIN_W, KLEIN_H);
      k.texture.source.update();
      GAL.version++;
    };
    img.src = e.bild;
  }
  GAL.version++;
}

/**
 * Ein neues Bild aus einer Leinwand in die Galerie. → { eintrag, index } (index = sein fester Platz an der Leine)
 * Ist die Leine voll, bekommt das neue Bild den Platz des ältesten; alle anderen bleiben, wo sie sind.
 */
export function galerieNeu(quelle, art) {
  galerieLaden();
  if (GAL.altKlein) {
    GAL.altKlein.frei = true;
    GAL.altKlein = null;
  }
  let platz = freierPlatz();
  if (GAL.liste.length >= MAX_BILDER || platz < 0) {
    const alt = GAL.liste.shift();
    platz = alt.platz;
    GAL.altKlein = alt.klein;   // erst beim nächsten neuen Bild wieder frei (blendet bis dahin weich aus)
  }
  const k = kleinesBild();
  k.ctx.drawImage(quelle, 0, 0, KLEIN_W, KLEIN_H);
  k.texture.source.update();
  let daten = '';
  try { daten = k.canvas.toDataURL('image/jpeg', 0.72); } catch { daten = ''; }
  const eintrag = { klein: k, art, daten, platz };
  GAL.liste.push(eintrag);
  if (daten) speichern();
  GAL.version++;
  return { eintrag, index: platz };
}

export function galerieAnzahl() {
  return GAL.liste.length;
}

// ---------------------------------------------------------------- Galerie-Leine (je Seite)

const BILD_W = 128;          // kleines Bild an der Leine (Einheiten)
const BILD_H = 82;
const LEINEN = [
  { x0: -990, x1: -215, y: 46, durchhang: 30 },
  { x0: 285, x1: 1000, y: 46, durchhang: 30 },
];
// von der Mitte nach außen gefüllt (weg von den Knöpfen in den oberen Ecken)
const PLATZ_X = [-340, 390, -520, 570, -700, 750, -880, 920];

function leinenY(l, x) {
  const t = (x - l.x0) / (l.x1 - l.x0);
  return l.y + 4 * l.durchhang * t * (1 - t);
}

export class GalerieLeine {
  constructor(seite) {
    this.seite = seite;
    this.version = -1;
    const welt = seite.welt;
    const g = new PIXI.Graphics();
    for (const l of LEINEN) {
      g.moveTo(l.x0, l.y).quadraticCurveTo((l.x0 + l.x1) / 2, l.y + 2 * l.durchhang, l.x1, l.y)
        .stroke({ width: 5, color: 0xb88b5c });
      g.circle(l.x0, l.y, 9).fill(0x9a6a3e).circle(l.x1, l.y, 9).fill(0x9a6a3e);
    }
    g.zIndex = 3;
    g.eventMode = 'none';
    welt.addChild(g);

    this.plaetze = PLATZ_X.map((x, i) => {
      const l = LEINEN[x < 0 ? 0 : 1];
      const y = leinenY(l, x);
      const c = new PIXI.Container({ label: 'galerie:' + i });
      c.position.set(x, y);
      c.zIndex = 4;
      c.eventMode = 'none';
      c.visible = false;
      // Bild hängt unter der Klammer (Drehpunkt = Klammer)
      const papier = new PIXI.Graphics().rect(-BILD_W / 2 - 3, 12, BILD_W + 6, BILD_H + 6).fill(0xffffff);
      const bild = new PIXI.Sprite(PIXI.Texture.WHITE);
      bild.width = BILD_W;
      bild.height = BILD_H;
      bild.position.set(-BILD_W / 2, 15);
      const rahmenC = new PIXI.Container();
      rahmenC.position.set(0, 15 + BILD_H / 2);
      const klammer = new PIXI.Graphics()
        .roundRect(-9, -12, 18, 34, 6).fill(0xe3b57e).stroke({ width: 3, color: 0xa8743f })
        .rect(-9, 4, 18, 3).fill(0xa8743f);
      c.addChild(papier, bild, rahmenC, klammer);
      c.bild = bild;
      c.rahmenC = rahmenC;
      c.art = null;
      welt.addChild(c);
      return c;
    });

    // Antippen: eine Fläche je Leine (die kleinen Bilder einzeln wären zu klein für kleine Finger)
    for (const [n, l] of LEINEN.entries()) {
      const z = new PIXI.Container({ label: 'galerieLeine' });
      z.zIndex = 2;
      welt.addChild(z);
      tap(z, (e) => this.getippt(n, e), {
        sound: null, squash: false, hitArea: new PIXI.Rectangle(l.x0, 70, l.x1 - l.x0, 200),
      });
    }
    this.ruhe = 0;
    this.sync();
  }

  /** Ort des Platzes i (Mitte des Bildes) in Seiten-Koordinaten */
  ort(i) {
    const c = this.plaetze[Math.max(0, Math.min(this.plaetze.length - 1, i))];
    return { x: c.x, y: c.y + 15 + BILD_H / 2 };
  }

  get bildGroesse() {
    return { w: BILD_W, h: BILD_H };
  }

  sync() {
    this.version = GAL.version;
    this.plaetze.forEach((c, i) => {
      const e = GAL.liste.find((x) => x.platz === i);
      if (c._versteckt) return;
      c.visible = !!e;
      if (!e) return;
      c.bild.texture = e.klein.texture;
      c.bild.width = BILD_W;
      c.bild.height = BILD_H;
      if (c.art !== e.art) {
        c.art = e.art;
        for (const k of c.rahmenC.removeChildren()) k.destroy();
        c.rahmenC.addChild(baueRahmen(e.art, BILD_W, BILD_H, 12));
      }
    });
  }

  /**
   * Platz i verstecken (das fliegende Bild ist noch unterwegs) bzw. wieder zeigen. Hängt dort noch ein altes Bild
   * (volle Leine), blendet es weich aus (0,6 s) – nichts springt.
   */
  verstecke(i, an) {
    const c = this.plaetze[i];
    if (!c) return;
    c._versteckt = an;
    if (an) {
      if (c.visible && c.alpha > 0) {
        this.seite.tween(c, { alpha: 0 }, 0.6, { ease: 'sineInOut' })
          .then((ok) => { if (ok && c._versteckt) c.visible = false; });
      } else c.visible = false;
    } else {
      this.seite.tween(c, { alpha: 1 }, 0.01);   // ein laufendes Ausblenden ablösen
      c.alpha = 1;
      this.sync();
    }
  }

  /** Ein Bild sanft schaukeln lassen */
  schaukel(i, staerke = 0.12) {
    const c = this.plaetze[i];
    if (!c || !c.visible) return;
    const s = this.seite;
    s.tween(c, { rotation: staerke }, 0.35, { ease: 'sineOut' })
      .then((ok) => ok && s.tween(c, { rotation: -staerke * 0.6 }, 0.6, { ease: 'sineInOut' }))
      .then((ok) => ok && s.tween(c, { rotation: staerke * 0.25 }, 0.55, { ease: 'sineInOut' }))
      .then((ok) => ok && s.tween(c, { rotation: 0 }, 0.5, { ease: 'sineInOut' }));
  }

  getippt(n, e) {
    if (this.ruhe > 0) return;
    this.ruhe = 0.25;
    const p = this.seite.welt.toLocal(e.global);
    // nächstes sichtbares Bild auf dieser Leine
    let best = -1;
    let bestD = 1e9;
    this.plaetze.forEach((c, i) => {
      if ((c.x < 0 ? 0 : 1) !== n || !c.visible) return;
      const d = Math.abs(c.x - p.x);
      if (d < bestD) { bestD = d; best = i; }
    });
    if (best >= 0) {
      this.schaukel(best);
      note('glocke', pick([72, 74, 76, 79, 81]) + 12, { vol: 0.16 });
    } else {
      note('glocke', 79, { vol: 0.1 });
    }
  }

  update(dt) {
    this.ruhe -= dt;
    if (this.version !== GAL.version) this.sync();
  }
}

// ---------------------------------------------------------------- Besuch

const BESUCH_Y = 1522;
const BESUCH_GROESSE = 262;     // höchste Seite des Tierbilds in Einheiten
const BLASE_VERSATZ = -102;     // Schwanz der Denkblase links vom Tier (y kommt vom Kopf)
const BLASE_BREITE = 252;

/**
 * Wo steht der Besuch? Links neben „neues Blatt", vor dem Hocker mit den Blumen. Bewusste Ausnahme vom Kernbereich
 * (x ±1066): Auf dieser Höhe ist im Kernbereich kein Platz frei (Topf-Leiste, „neues Blatt", Reihe). Auf dem Tablet
 * (16:10, sichtbar x ±1280) steht das Tier ganz im Bild (x −1261 … −999, die Blase etwa −1242 … −990); auf
 * schmaleren Bildschirmen rückt es so weit herein, wie es geht (höchstens bis x −1000).
 */
function besuchX() {
  return clamp(-stage.W / 2 + 150, -1130, -1000);
}

/**
 * Ein Tier, das ein Bild bestellt. Lebt in seite.welt unten links (neben „neues Blatt").
 * onTap(fn): wird bei jedem Antippen des Tiers oder seiner Blase gerufen.
 */
export class Besuch {
  constructor(seite, { onTap } = {}) {
    this.seite = seite;
    this.onTap = onTap;
    this.tier = null;
    this.actor = null;
    this.da = false;           // steht am Platz (nicht unterwegs)
    this.nickRuhe = 0;
    this.zeit = 0;
    this.x = besuchX();

    // Denkblase (bleibt, solange der Wunsch gilt)
    const b = new PIXI.Container({ label: 'wunschBlase' });
    b.zIndex = 70;
    b.visible = false;
    b.alpha = 0;
    const grund = new PIXI.Sprite(tex('common/blase_denk'));
    const m = meta('common/blase_denk');
    const schwanz = m.pts?.schwanz || [45, 540];
    const innen = m.pts?.innen || [330, 260];
    const s = BLASE_BREITE / grund.texture.width;
    grund.anchor.set(schwanz[0] / grund.texture.width, schwanz[1] / grund.texture.height);
    grund.scale.set(s);
    b.addChild(grund);
    b.inhalt = new PIXI.Container();
    b.inhalt.position.set((innen[0] - schwanz[0]) * s, (innen[1] - schwanz[1]) * s);
    b.addChild(b.inhalt);
    seite.welt.addChild(b);
    tap(b, () => this.getippt(), {
      sound: null, squash: false,
      hitArea: new PIXI.Rectangle(-10, -0.95 * BLASE_BREITE * (m.h / m.w), BLASE_BREITE, 0.95 * BLASE_BREITE * (m.h / m.w)),
    });
    this.blase = b;
  }

  /** Mitte der Blase (für Effekte) in Seiten-Koordinaten */
  get blasenMitte() {
    return { x: this.blase.x + this.blase.inhalt.x, y: this.blase.y + this.blase.inhalt.y };
  }

  /** Wo hält das Tier ein Bild? (vor dem Bauch) */
  get haende() {
    return { x: this.x + 30, y: BESUCH_Y - 120 };
  }

  get ort() {
    return { x: this.x, y: BESUCH_Y - 130 };
  }

  /** Wo das Bild beim Übergeben kurz anhält: rechts neben dem Tier (das Tier bleibt beim Freuen ganz zu sehen) */
  get zeigeOrt() {
    return { x: this.x + BESUCH_GROESSE / 2 + 150, y: BESUCH_Y - 125 };
  }

  /** Bildschirmbreite hat sich geändert: Platz neu ausrechnen */
  anpassen() {
    const x = besuchX();
    if (x === this.x) return;
    const dx = x - this.x;
    this.x = x;
    if (this.actor && !this.actor.destroyed && this.da) this.actor.x += dx;
    this.blase.x += dx;
  }

  /** Das Tier kommt von links herein. → Promise (wenn es steht) */
  async komm(tier) {
    this.weg();
    this.tier = tier;
    const m = meta(`tiere/${tier}_idle`);
    const scale = BESUCH_GROESSE / Math.max(m?.w || 900, m?.h || 900);
    const a = new Actor(tier, { x: this.x - 420, y: BESUCH_Y, scale, parent: this.seite.welt, z: 25 });
    this.actor = a;
    this.da = false;
    // schmale Tiere (Ente, Giraffe …) bekommen etwas mehr Rand, damit die Tippfläche mindestens ~240 breit ist
    const breite = (m?.w || 900) * scale;
    a.onTap(() => this.getippt(), { pad: Math.max(12, (240 - breite) / 2) });
    const ok = await a.walkTo(this.x, BESUCH_Y, { tempo: 300 });
    if (this.actor !== a || a.destroyed) return false;
    this.da = true;
    if (ok) {
      a.pose('idle');
      a.sound();
    }
    return true;
  }

  /** Wunsch zeigen: inhalt ist ein Container (wird in die Blase gesetzt, alter Inhalt abgebaut) */
  zeigeWunsch(inhalt) {
    const b = this.blase;
    for (const k of b.inhalt.removeChildren()) k.destroy({ children: true });
    if (inhalt) b.inhalt.addChild(inhalt);
    const kopf = this.actor && !this.actor.destroyed ? this.actor.point('kopf') : { y: BESUCH_Y - BESUCH_GROESSE };
    b.position.set(this.x + BLASE_VERSATZ, Math.min(BESUCH_Y - 200, kopf.y + 20));
    if (!b.visible || b.alpha < 1) {
      b.visible = true;
      b.scale.set(0.6);
      this.seite.tween(b, { alpha: 1 }, 0.4, { ease: 'sineInOut' });
      this.seite.tween(b, { scale: 1 }, 0.5, { ease: 'backOut' });
    } else {
      fx.pop(b);
    }
  }

  wunschWeg() {
    const b = this.blase;
    if (!b.visible) return;
    this.seite.tween(b, { alpha: 0, scale: 0.85 }, 0.4, { ease: 'sineInOut' }).then((ok) => {
      if (ok) b.visible = false;
    });
  }

  /** freundlich nicken (entprellt) */
  nicke() {
    if (!this.da || this.nickRuhe > 0) return;
    this.nickRuhe = 2.2;
    this.actor.nod();
  }

  freu() {
    if (!this.actor || this.actor.destroyed) return;
    this.actor.cheer({ parent: this.seite.vorn });
  }

  /**
   * Das Tier geht nach links hinaus. nur: genau dieses Tier (Actor) soll gehen – steht inzwischen ein anderes da,
   * passiert nichts (ein später Aufruf schickt nie einen neuen Besuch weg). → Promise
   */
  async geh(nur = this.actor) {
    const a = this.actor;
    if (!a || a.destroyed || a !== nur) return true;
    this.wunschWeg();
    this.da = false;
    const ok = await a.walkTo(this.x - 440, BESUCH_Y, { tempo: 300 });
    if (this.actor === a) this.actor = null;
    if (!a.destroyed) a.destroy({ children: true });
    return ok;
  }

  /** sofort weg (ohne Gang) */
  weg() {
    if (this.actor && !this.actor.destroyed) this.actor.destroy({ children: true });
    this.actor = null;
    this.da = false;
  }

  getippt() {
    if (this.actor && !this.actor.destroyed) {
      fx.wobble(this.actor, 0.06);
      if (this.da) this.actor.sound();
    }
    if (this.blase.visible) fx.wobble(this.blase.inhalt, 0.05);
    this.onTap?.();
  }

  update(dt) {
    this.zeit += dt;
    this.nickRuhe -= dt;
    const b = this.blase;
    // die Blase atmet ganz leicht (nur, solange sie ganz da ist)
    if (b.visible && b.alpha >= 1) b.inhalt.scale.set(1 + 0.025 * Math.sin(this.zeit * 1.9));
  }
}

// ---------------------------------------------------------------- Wünsche ziehen

/**
 * Nächster Wunsch aus einem gemischten Beutel: erst wenn alle Wünsche dran waren, wird neu gemischt – und nie
 * kommt dasselbe Tier zweimal hintereinander. beutel = Array der Seite (wird verändert).
 */
export function naechsterWunsch(liste, letzt, beutel) {
  if (!beutel.length) beutel.push(...shuffle(liste.filter((w) => w !== letzt)));
  let i = beutel.findIndex((w) => !letzt || w.tier !== letzt.tier);
  if (i < 0) {
    // im Beutel nur noch dasselbe Tier: eines aus der ganzen Liste nehmen
    const anders = liste.filter((w) => !letzt || w.tier !== letzt.tier);
    return pick(anders.length ? anders : liste);
  }
  return beutel.splice(i, 1)[0];
}

// ---------------------------------------------------------------- kleine Bilder für Denkblasen

/** Kärtchen mit einem Bild (Ausmalbild, Stempel …), passend in die Blase */
export function blasenKarte(bildId, { breite = 150, hoehe = 100, rand = true } = {}) {
  const c = new PIXI.Container();
  if (rand) {
    c.addChild(new PIXI.Graphics()
      .roundRect(-breite / 2, -hoehe / 2, breite, hoehe, 12).fill(0xffffff).stroke({ width: 4, color: 0xd9c4a0 }));
  }
  if (hasTex(bildId)) {
    const s = new PIXI.Sprite(tex(bildId));
    s.anchor.set(0.5);
    const f = Math.min((breite - 14) / s.texture.width, (hoehe - 12) / s.texture.height);
    s.scale.set(f);
    c.addChild(s);
  }
  return c;
}

/** Farbklecks (für die Blase) */
export function farbKlecks(rgb, r = 30) {
  return new PIXI.Graphics()
    .circle(0, 0, r + 5).fill(0xffffff)
    .circle(0, 0, r).fill(rgb)
    .ellipse(-r * 0.3, -r * 0.35, r * 0.4, r * 0.22).fill({ color: 0xffffff, alpha: 0.4 });
}
