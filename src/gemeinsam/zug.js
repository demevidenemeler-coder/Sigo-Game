// Baustein „Zug und Fahrzeuge" – für alle Szenen, in denen etwas rollt (Bahnhof, Fahrt, Feuerwehr, Baustelle …).
//
//   Fahrzeug   ein Fahrzeug aus Körper-Bild + sich drehenden Rädern (Lok, Wagen, Feuerwehrauto, Kipper, Traktor)
//   Zug        Lok + bis zu 4 Wagen mit Gästen (Tiere, Menschen) und Ladung, fährt weich an und bremst weich
//   legeGleis  gekachelte Holzschiene, die unter einem „fahrenden" Zug wandern kann
//   STANDARD_ZUG, ladeZug(), speichereZug()   der Zug des Kindes im Speicher
//   LOKS, WAGEN, GAESTE_TIERE, GAESTE_MENSCHEN, LADUNGEN   Listen für Auswahl-Leisten
//
// Kurze Anleitung mit Beispielen: src/gemeinsam/zug.md
//
// Maße: Alle Angaben innerhalb eines Fahrzeugs sind Bildpunkte des Körper-Bildes (wie in pack.json).
// Der Ursprung eines Fahrzeugs liegt am Boden (Unterkante der Räder) unter dem Anker des Körper-Bildes.

import {
  tex, hasTex, meta, spr, tween, after, killTweensOf, sfx, animal, Actor, fx, store, clamp, lerp, rand, tierBedarf, PIXI,
} from '../engine/index.js';

const { Container, Graphics, Sprite, Texture, TilingSprite } = PIXI;

// ---------------------------------------------------------------- Listen (nur ids, die es als Bild gibt)

export const LOKS = ['lok_dampf', 'lok_diesel', 'lok_gruen', 'lok_schnell'];

export const WAGEN = [
  'wagen_offen_rot', 'wagen_offen_blau', 'wagen_offen_gelb', 'wagen_offen_gruen', 'wagen_offen_lila',
  'wagen_offen_orange', 'wagen_tier', 'wagen_flach', 'wagen_personen', 'wagen_tank', 'wagen_kran',
  'wagen_musik', 'wagen_schluss',
];

/** Wagen, in denen Gäste sitzen können (haben sitz_l/sitz_r und eine Vorderwand *_vorn). */
export const WAGEN_MIT_SITZ = [
  'wagen_offen_rot', 'wagen_offen_blau', 'wagen_offen_gelb', 'wagen_offen_gruen', 'wagen_offen_lila',
  'wagen_offen_orange', 'wagen_tier',
];

/** Wagen, die Ladung tragen (alle mit Sitz + der Flachwagen). */
export const WAGEN_MIT_LADUNG = [...WAGEN_MIT_SITZ, 'wagen_flach'];

export const GAESTE_TIERE = [
  'kuh', 'schaf', 'schwein', 'pferd', 'hund', 'katze', 'hase', 'huhn', 'ente', 'frosch', 'maus', 'igel',
  'baer', 'affe', 'loewe', 'elefant', 'giraffe', 'pinguin', 'fuchs', 'eule', 'eichhoernchen',
];

export const GAESTE_MENSCHEN = ['kind_m', 'kind_j', 'oma', 'papa'];

export const LADUNGEN = [
  'ladung_ball', 'ladung_kiste', 'ladung_geschenk', 'ladung_milchkanne', 'ladung_apfelkorb', 'ladung_fass',
  'ladung_koffer', 'ladung_heuballen', 'ladung_bausteine', 'ladung_teddy',
];

const MAX_WAGEN = 4;
const MENSCHEN = new Set(GAESTE_MENSCHEN);
const TIERE = new Set([...GAESTE_TIERE, 'hahn']); // der Hahn passt mit seinem Schwanz nur knapp, geht aber

// Größe der Gäste im Wagen (1 = normal). Alle Tierbilder sind gleich hoch – hier wird die Maus klein, der
// Elefant groß. Die Höhe begrenzt außerdem der Platz bis zum Wagenboden.
const GAST_GROESSE = {
  maus: 0.68, frosch: 0.72, igel: 0.74, ente: 0.78, huhn: 0.8, hahn: 0.84, eichhoernchen: 0.8, hase: 0.84,
  eule: 0.82, pinguin: 0.84, katze: 0.86, fuchs: 0.9, affe: 0.9, hund: 0.94, schaf: 0.98, schwein: 0.98,
  baer: 1, loewe: 1, kuh: 1.05, pferd: 1.08, giraffe: 1.12, elefant: 1.15,
  kind_m: 0.95, kind_j: 0.95, oma: 1, papa: 1.05,
};

// Welche Räder zu welcher Lok passen; Dampfloks haben Kuppelstange und Dampfwölkchen
const LOK_RAD = { lok_dampf: 'zug/rad_gross', lok_diesel: 'zug/rad_blau', lok_gruen: 'zug/rad_klein', lok_schnell: 'zug/rad_klein' };
const WAGEN_RAD = 'zug/rad_gruen';
const DAMPFLOKS = new Set(['lok_dampf', 'lok_gruen']);

const UEBERLAPP = 4;             // Kupplungen greifen so viele Bildpunkte ineinander (keine Lücke)
const ANNAEHERUNG = 3.5;         // wie flott Wagen zu ihrem neuen Platz rollen (1/s)
const BESCHLEUNIGUNG = 2.2;      // weiches Anfahren/Bremsen: nach ~1,5 s ist die Zielgeschwindigkeit erreicht
const JUBEL_PAUSE = 0.6;         // gaesteJubeln: frühestens so oft ein neuer Jubel-Ton / dieselbe Freude (s)

/** Lauffläche der Schiene: Bildzeile in zug/schiene, auf der die Räder stehen (Oberkante ist Zeile 1). */
export const SCHIENE_LAUFFLAECHE = 3;

// ---------------------------------------------------------------- Speicher

/** Der Zug am Anfang: rote Dampflok, zwei offene Wagen, im ersten sitzt die Kuh. */
export const STANDARD_ZUG = Object.freeze({
  lok: 'lok_dampf',
  wagen: Object.freeze([
    Object.freeze({ typ: 'wagen_offen_rot', gast: 'kuh', ladung: null }),
    Object.freeze({ typ: 'wagen_offen_gelb', gast: null, ladung: null }),
  ]),
});

const kopie = (k) => ({ lok: k.lok, wagen: k.wagen.map((w) => ({ typ: w.typ, gast: w.gast ?? null, ladung: w.ladung ?? null })) });

/** Ist die Konfiguration in Ordnung (alle ids bekannt, Gäste/Ladung nur in passenden Wagen)? */
export function zugGueltig(k) {
  if (!k || typeof k !== 'object' || !LOKS.includes(k.lok) || !Array.isArray(k.wagen)) return false;
  if (k.wagen.length > MAX_WAGEN) return false;
  return k.wagen.every((w) => w && WAGEN.includes(w.typ)
    && (w.gast == null || (gastBekannt(w.gast) && WAGEN_MIT_SITZ.includes(w.typ)))
    && (w.ladung == null || (LADUNGEN.includes(w.ladung) && WAGEN_MIT_LADUNG.includes(w.typ))));
}

/** Gespeicherten Zug laden (Kopie); ist etwas kaputt oder unbekannt, kommt der Standardzug. */
export function ladeZug() {
  const k = store.get('zug', null);
  return kopie(zugGueltig(k) ? k : STANDARD_ZUG);
}

/** Zug speichern (z. B. zug.konfig). Ungültiges wird nicht gespeichert → false. */
export function speichereZug(konfig) {
  if (!zugGueltig(konfig)) return false;
  store.set('zug', kopie(konfig));
  return true;
}

function gastBekannt(id) {
  return TIERE.has(id) || MENSCHEN.has(id);
}

// Bild-id der Gast-Pose: Tiere in tiere/, Menschen in zug/
function gastBild(id, pose = 'idle') {
  return (MENSCHEN.has(id) ? 'zug/' : 'tiere/') + id + '_' + pose;
}

// Gäste im gespeicherten Zug: Szenen mit dem Zug-Paket laden deren Tierbilder gleich mit (zu `static tiere`)
tierBedarf((Klasse) => ((Klasse.packs || []).includes('zug')
  ? ladeZug().wagen.map((w) => w.gast).filter((g) => g && TIERE.has(g))
  : []));

// ---------------------------------------------------------------- Radkästen ausmessen

// Wie groß ein Rad sein muss, liest der Baustein am Körper-Bild selbst ab: Vom Rad-Punkt aus wird nach oben bis
// zum Bogen gemessen (Höhe) und in der Zeile knapp darüber nach links und rechts (halbe Breite). Ergebnis wird
// je Bild und Punkt gemerkt. Geht das nicht (Platzhalter), gibt es eine Schätzung aus der Bildgröße.
const messErgebnisse = new Map();
let messLeinwand = null;
let messKontext = null;
let messBildId = null;

function messeRadkasten(id, px, py) {
  const schluessel = id + '|' + px + '|' + py;
  if (messErgebnisse.has(schluessel)) return messErgebnisse.get(schluessel);
  let erg = null;
  try {
    const quelle = hasTex(id) ? tex(id).source?.resource : null;
    if (quelle) {
      const m = meta(id);
      const w = Math.round(m.w);
      const h = Math.round(m.h);
      if (!messLeinwand) {
        messLeinwand = document.createElement('canvas');
        messKontext = messLeinwand.getContext('2d', { willReadFrequently: true });
      }
      if (messBildId !== id) {
        messLeinwand.width = w;
        messLeinwand.height = h;
        messKontext.clearRect(0, 0, w, h);
        messKontext.drawImage(quelle, 0, 0, w, h);
        messBildId = id;
      }
      const x = clamp(Math.round(px), 0, w - 1);
      const y0 = clamp(Math.round(py), 0, h - 1);
      const spalte = messKontext.getImageData(x, 0, 1, y0 + 1).data;
      if (spalte[y0 * 4 + 3] <= 128) {   // der Punkt liegt in einer Lücke (Radbogen)
        let y = y0;
        while (y > 0 && spalte[y * 4 + 3] <= 128) y--;
        const hoehe = y0 - y;
        const zeile = messKontext.getImageData(0, Math.max(0, y0 - 4), w, 1).data;
        let l = x;
        while (l > 0 && zeile[l * 4 + 3] <= 128) l--;
        let r = x;
        while (r < w - 1 && zeile[r * 4 + 3] <= 128) r++;
        const halb = (r - l) / 2;
        // Rad etwas kleiner als der Bogen: oben bleibt ein schmaler Spalt, seitlich verschwindet der Rand hinter dem Bogen
        erg = { r: Math.max(12, Math.min(hoehe - 4, halb) * 0.97), oben: y };
      }
    }
  } catch (e) {
    console.warn(`[zug] Radkasten von '${id}' nicht messbar – nehme Schätzung.`, e?.message || e);
  }
  messErgebnisse.set(schluessel, erg);
  return erg;
}

// ---------------------------------------------------------------- Fahrzeug

const RAD_INHALT = 0.985;   // Räder füllen ihr Bild bis auf einen Rand von ~3 Bildpunkten

/**
 * Ein Fahrzeug: Körper-Bild mit Rädern an benannten Punkten.
 *
 *   new Fahrzeug({ koerper: 'zug/lok_dampf', raeder: [{ tex: 'zug/rad_gross', punkt: 'rad1' }, …],
 *                  x, y, scale, parent, flip, z, vorn, stange })
 *
 * y = Bodenhöhe (Unterkante der Räder). Aufbau:
 *   Fahrzeug (Ort, Größe)
 *     └─ huepfer (Hüpfen, Wackeln – Drehpunkt am Boden; flip spiegelt hier)
 *          ├─ radEbene (Räder, hinter dem Körper – nur unten und in den Radkästen zu sehen)
 *          ├─ rumpf (federt leicht)
 *          │    ├─ koerper (Sprite)
 *          │    ├─ innen   (Container für Gäste/Ladung – Koordinaten wie das Körper-Bild relativ zum Anker)
 *          │    └─ vorn    (Sprite '<koerper>_vorn', falls es das gibt: Vorderwand über den Gästen)
 *          └─ stange (Kuppelstange, falls angegeben)
 */
export class Fahrzeug extends Container {
  constructor(opt = {}) {
    super({ label: 'fahrzeug:' + (opt.koerper || '?') });
    this.koerperId = opt.koerper;
    this.typ = String(opt.koerper || '').split('/').pop();
    this._zeit = rand(0, 10);
    this._phase = rand(0, Math.PI * 2);
    this._weg = 0;            // seit dem letzten update gerollte Strecke (Eltern-Einheiten)
    this._v = 0;              // geglättete Geschwindigkeit (Eltern-Einheiten/s)
    this._flip = !!opt.flip;

    this.huepfer = new Container({ label: 'huepfer' });
    this.radEbene = new Container({ label: 'raeder' });
    this.rumpf = new Container({ label: 'rumpf' });
    this.koerper = spr(this.koerperId);
    this.innen = new Container({ label: 'innen', sortableChildren: true });
    const vornId = opt.vorn !== undefined ? opt.vorn : (hasTex(this.koerperId + '_vorn') ? this.koerperId + '_vorn' : null);
    this.vorn = vornId ? spr(vornId) : null;
    this.rumpf.addChild(this.koerper, this.innen);
    if (this.vorn) this.rumpf.addChild(this.vorn);
    this.huepfer.addChild(this.radEbene, this.rumpf);
    this.addChild(this.huepfer);
    if (this._flip) this.huepfer.scale.x = -1;

    // Räder: Mitte auf dem Punkt, Größe aus dem Radkasten (oder durchmesser in Bildpunkten des Körpers)
    const m = meta(this.koerperId);
    this.raeder = [];
    let boden = (1 - m.ay) * m.h;   // ohne Räder: Unterkante des Bildes
    let erstes = true;
    for (const r of opt.raeder || []) {
      const p = this._lokal(r.punkt);
      if (!p) {
        console.warn(`[zug] '${this.koerperId}' hat keinen Punkt '${r.punkt}' – Rad fehlt.`);
        continue;
      }
      const roh = m.pts[r.punkt];
      const gemessen = messeRadkasten(this.koerperId, roh[0], roh[1]);
      const radius = r.durchmesser ? r.durchmesser / 2 : gemessen ? gemessen.r : Math.min(m.h * 0.2, m.w * 0.09);
      const obenBild = gemessen ? gemessen.oben : roh[1] - radius * 1.15;
      const s = spr(r.tex, { anchor: 0.5, x: p.x, y: p.y, parent: this.radEbene });
      s.scale.set((2 * radius) / (s.texture.width * RAD_INHALT));
      s.rotation = rand(0, Math.PI * 2);
      this.raeder.push({ sprite: s, r: radius, punkt: r.punkt, oben: obenBild - m.ay * m.h });
      boden = erstes ? p.y + radius : Math.max(boden, p.y + radius);
      erstes = false;
    }
    // alles so verschieben, dass die Unterkante der Räder bei y = 0 liegt
    this._boden = boden;
    this.radEbene.y = -boden;
    this.rumpf.y = -boden;

    // Kuppelstange: verbindet zwei Räder, bleibt waagrecht und kreist mit der Kurbel
    this.stange = null;
    if (opt.stange) this._baueStange(opt.stange);

    this.position.set(opt.x ?? 0, opt.y ?? 0);
    if (opt.scale !== undefined) this.scale.set(opt.scale);
    if (opt.z !== undefined) this.zIndex = opt.z;
    opt.parent?.addChild(this);
  }

  // Punkt des Körper-Bildes relativ zum Anker (Koordinaten von koerper/innen)
  _lokal(name) {
    const m = meta(this.koerperId);
    const p = m.pts?.[name];
    if (!p) return null;
    return { x: p[0] - m.ax * m.w, y: p[1] - m.ay * m.h };
  }

  /** Punkt des Körper-Bildes in Koordinaten dieses Fahrzeugs (Ruhelage, ohne Hüpfen/Federn) – zum Ausrichten. */
  ruhePunkt(name) {
    const p = this._lokal(name);
    if (!p) return null;
    return { x: this._flip ? -p.x : p.x, y: p.y - this._boden };
  }

  /** Punkt des Körper-Bildes (pts aus pack.json) in Koordinaten des Eltern-Containers (oder von `bezug`). */
  punkt(name, bezug = this.parent) {
    const p = this._lokal(name);
    if (!p) return null;
    return bezug ? bezug.toLocal(p, this.koerper) : this.koerper.toGlobal(p);
  }

  get flip() {
    return this._flip;
  }

  set flip(an) {
    this._flip = !!an;
    this.huepfer.scale.x = this._flip ? -1 : 1;
  }

  _baueStange({ tex: stangeTex = 'zug/kuppelstange', von = 'rad1', bis = 'rad2', kurbel = 0.42 } = {}) {
    const a = this.raeder.find((r) => r.punkt === von);
    const b = this.raeder.find((r) => r.punkt === bis);
    if (!a || !b) return;
    const s = spr(stangeTex, { anchor: 0.5, parent: this.huepfer });
    const m = meta(stangeTex);
    const augen = m.pts?.auge_l && m.pts?.auge_r ? m.pts.auge_r[0] - m.pts.auge_l[0] : s.texture.width * 0.74;
    const abstand = Math.hypot(b.sprite.x - a.sprite.x, b.sprite.y - a.sprite.y);
    s.scale.set(abstand / augen, (abstand / augen) * 0.8);   // etwas schlanker, sonst wirkt sie klobig
    this.stange = { sprite: s, a, b, kurbel: Math.min(a.r, b.r) * kurbel };
    this._stelleStange();
  }

  _stelleStange() {
    const st = this.stange;
    if (!st) return;
    const w = st.a.sprite.rotation;
    st.sprite.x = (st.a.sprite.x + st.b.sprite.x) / 2 + Math.cos(w) * st.kurbel;
    st.sprite.y = (st.a.sprite.y + st.b.sprite.y) / 2 - this._boden + Math.sin(w) * st.kurbel;
  }

  /** Räder drehen passend zu einer Strecke dx (Einheiten des Eltern-Containers; + = nach rechts). Bewegt nicht. */
  rolle(dx) {
    if (!dx) return;
    this._weg += dx;
    const skala = Math.abs(this.scale.y) || 1;
    const richtung = this._flip ? -1 : 1;
    for (const r of this.raeder) {
      r.sprite.rotation = (r.sprite.rotation + (dx / (r.r * skala)) * richtung) % (Math.PI * 2);
    }
    if (this.stange) this._stelleStange();
  }

  /** Jedes Bild aufrufen: leichtes Federn im Stand, etwas mehr bei Fahrt (sehr dezent). */
  update(dt) {
    if (dt <= 0) return;
    this._zeit += dt;
    const vJetzt = this._weg / dt;
    this._weg = 0;
    this._v += (vJetzt - this._v) * (1 - Math.exp(-dt * 4));
    const skala = Math.abs(this.scale.y) || 1;
    const fahrt = clamp(Math.abs(this._v) / skala / 400, 0, 1);   // 0 = Stand, 1 = flotte Fahrt
    const t = this._zeit;
    const ruhe = Math.sin((t / 2.8) * Math.PI * 2 + this._phase) * 1.3;
    const rattern = Math.sin(t * Math.PI * 2 * 2.1 + this._phase) * 2.2 + Math.sin(t * Math.PI * 2 * 0.9) * 1.2;
    this.rumpf.y = -this._boden + ruhe + rattern * fahrt;
    this.rumpf.rotation = Math.sin(t * Math.PI * 2 * 0.7 + this._phase) * 0.004 * fahrt;
  }

  /** Weich zu x fahren (Eltern-Koordinaten), Räder drehen mit. → thenable (Tween) */
  fahreZu(x, dauer = 1.6, { ease: kurve = 'sineInOut' } = {}) {
    killTweensOf(this, ['x']);
    let letztes = this.x;
    return tween(this, { x }, dauer, {
      ease: kurve,
      onUpdate: () => {
        this.rolle(this.x - letztes);
        letztes = this.x;
      },
    });
  }

  /** Kleiner Hüpfer (alle Räder heben ab), danach weiches Einfedern. → thenable */
  hupf(hoehe = 24) {
    const h = this.huepfer;
    killTweensOf(h, ['y']);
    return tween(h, { y: -hoehe }, 0.15, { ease: 'quadOut' })
      .then(() => tween(h, { y: 0 }, 0.2, { ease: 'quadIn' }))
      .then(() => fx.pop(this.rumpf, 0.05));
  }

  /** Sanftes Schaukeln um die Bodenmitte. → thenable */
  wackel(staerke = 0.035) {
    return fx.wobble(this.huepfer, staerke);
  }
}

// ---------------------------------------------------------------- Gleis

/**
 * Holzschiene über die Breite kacheln: legeGleis(parent, { y, von = -1420, bis = 1420, z, scale = 0.5 }).
 * y = Lauffläche (dort stehen die Räder, also gleiches y wie beim Zug). Die Oberkante der Schiene liegt im Bild in
 * Zeile 1, als Lauffläche gilt Zeile SCHIENE_LAUFFLAECHE (3) – die weichen Räder sinken so kaum sichtbar ein.
 * → { sprite, y, rolle(dx) }  rolle(dx): Schiene wandert um dx nach links (der Zug „fährt" dx nach rechts).
 */
export function legeGleis(parent, { y = 1200, von = -1420, bis = 1420, z, scale = 0.5 } = {}) {
  const t = tex('zug/schiene');
  const sprite = new TilingSprite({ texture: t, width: Math.max(1, bis - von), height: t.height * scale });
  sprite.label = 'gleis';
  sprite.tileScale.set(scale);
  sprite.position.set(von, y - SCHIENE_LAUFFLAECHE * scale);
  if (z !== undefined) sprite.zIndex = z;
  parent?.addChild(sprite);
  const periode = t.width * scale;
  return {
    sprite,
    y,
    rolle(dx) {
      if (!dx || sprite.destroyed) return;
      sprite.tilePosition.x = (sprite.tilePosition.x - dx) % periode;
    },
  };
}

// ---------------------------------------------------------------- Kupplungsbügel

// Die Kupplungsknäufe der Bilder sitzen nicht alle gleich hoch über den Schienen. Ein kurzer Messingbügel
// hinter den Knäufen verbindet sie, damit die Wagen sichtbar aneinanderhängen.
let buegelTex = null;
function buegelTextur() {
  if (buegelTex) return buegelTex;
  const c = document.createElement('canvas');
  c.width = 96;
  c.height = 32;
  const g = c.getContext('2d');
  const v = g.createLinearGradient(0, 0, 0, 32);
  v.addColorStop(0, '#f6cf6a');
  v.addColorStop(0.55, '#dca23a');
  v.addColorStop(1, '#a8701c');
  g.fillStyle = v;
  g.strokeStyle = '#8f5d17';
  g.lineWidth = 3;
  g.beginPath();
  g.roundRect(2, 3, 92, 26, 13);
  g.fill();
  g.stroke();
  buegelTex = Texture.from(c);
  return buegelTex;
}

const BUEGEL_DICKE = 22;   // Bildpunkte der Fahrzeuge
const BUEGEL_INNEN = 24;   // so weit reicht der Bügel in jeden Knauf hinein

// ---------------------------------------------------------------- Zug

/**
 * Ein ganzer Zug: Lok vorn rechts (fährt nach rechts), Wagen dahinter.
 *
 *   const zug = new Zug({ konfig: ladeZug(), x: 0, y: 1200, scale: 0.5, parent: this.world, szene: this,
 *                         bezug: 'mitte' | 'lok', bewegt: false, z });
 *   update(dt) { this.zug.update(dt); this.gleis.rolle(this.zug.dx); }
 *
 * x ist die Mitte des Zugs (bezug 'mitte') oder die Vorderkante der Lok (bezug 'lok'); y = Schienenhöhe.
 * bewegt = true: der Zug fährt wirklich (x ändert sich mit der Geschwindigkeit); sonst steht er und nur die
 * Räder drehen – die Szene lässt dann Gleis/Landschaft um zug.dx wandern.
 * Ereignisse (zug.on(…)): 'lok' (lok), 'wagen' (w), 'gast' (w), 'ladung' (w) – wenn etwas Neues entsteht.
 */
export class Zug extends Container {
  constructor(opt = {}) {
    super({ label: 'zug', sortableChildren: true });
    this.szene = opt.szene || null;
    this.bezug = opt.bezug === 'lok' ? 'lok' : 'mitte';
    this.bewegt = !!opt.bewegt;
    this.lok = null;
    this.wagen = [];
    this.laenge = 0;
    this.dx = 0;                 // im letzten update gefahrene Strecke (Eltern-Einheiten)
    this._v = 0;
    this._vZiel = 0;
    this._dampf = 0.6;
    this._pfiffZeit = 0;
    this._gehen = [];            // Fahrzeuge, die gerade abkuppeln oder ausgetauscht werden
    this._fahrzeuge = [];        // Lok + Wagen (für update, ohne neue Listen pro Bild)
    this._buegel = [];           // Kupplungsbügel: _buegel[i] hängt Wagen i an seinen Vordermann

    this.position.set(opt.x ?? 0, opt.y ?? 0);
    this.scale.set(opt.scale ?? 0.5);
    if (opt.z !== undefined) this.zIndex = opt.z;
    opt.parent?.addChild(this);

    const k = zugGueltig(opt.konfig) ? opt.konfig : STANDARD_ZUG;
    if (opt.konfig && !zugGueltig(opt.konfig)) console.warn('[zug] Konfiguration ungültig – nehme den Standardzug.', opt.konfig);
    this.setzeLok(k.lok, { sofort: true });
    for (const w of k.wagen) {
      const neu = this._neuerWagen(w.typ);
      if (w.gast) this.setzeGast(neu.index, w.gast, { sofort: true });
      if (w.ladung) this.setzeLadung(neu.index, w.ladung, { sofort: true });
    }
    this._ordne(true);
  }

  // ---------- Geschwindigkeit

  /** Momentane Geschwindigkeit in Einheiten/s (Eltern-Koordinaten). Setzen = sofort, ohne Anfahren. */
  get geschwindigkeit() {
    return this._v;
  }

  set geschwindigkeit(v) {
    this._v = Number(v) || 0;
    this._vZiel = this._v;
  }

  /** Geschwindigkeit, auf die der Zug gerade beschleunigt oder bremst (0 = er hält an). */
  get zielGeschwindigkeit() {
    return this._vZiel;
  }

  /** Fährt der Zug (oder rollt er noch aus)? */
  get faehrt() {
    return Math.abs(this._v) > 1;
  }

  /** Weich auf Geschwindigkeit v beschleunigen (≈1,5 s). Negativ = rückwärts. */
  fahre(v = 160) {
    this._vZiel = Number(v) || 0;
  }

  /** Weich bremsen bis zum Stand (≈1,5 s). */
  halte() {
    this._vZiel = 0;
  }

  // ---------- Aufbau

  get konfig() {
    return {
      lok: this.lok?.typ ?? STANDARD_ZUG.lok,
      wagen: this.wagen.map((w) => ({ typ: w.typ, gast: w.gastId, ladung: w.ladungId })),
    };
  }

  /** Lok austauschen (mit kleinem Hüpfer). → true, wenn sich etwas geändert hat */
  setzeLok(id, { sofort = false } = {}) {
    if (!LOKS.includes(id) && !hasTex('zug/' + id)) {
      console.warn(`[zug] Lok '${id}' gibt es nicht.`);
      return false;
    }
    if (this.lok?.typ === id) return false;
    const neu = new Fahrzeug({
      koerper: 'zug/' + id,
      raeder: [{ tex: LOK_RAD[id] || 'zug/rad_gross', punkt: 'rad1' }, { tex: LOK_RAD[id] || 'zug/rad_gross', punkt: 'rad2' }],
      stange: DAMPFLOKS.has(id) ? { tex: 'zug/kuppelstange' } : null,
      z: 20,
    });
    const alt = this.lok;
    this.lok = neu;
    this.addChild(neu);
    if (alt) {
      neu.x = alt.x;
      this._weg(alt, 0, 0.25);
    }
    this._ordne(sofort || !alt);
    if (!sofort && alt) {
      neu.alpha = 0;
      tween(neu, { alpha: 1 }, 0.3, { ease: 'sineInOut' });
      neu.hupf(30);
      sfx('common/plopp');
    }
    this.emit('lok', neu);
    return true;
  }

  /** Wagen hinten ankuppeln (rollt heran, kleiner Hüpfer, Klonk). → der neue Wagen oder false (schon 4 Wagen) */
  wagenDazu(typ) {
    if (this.wagen.length >= MAX_WAGEN) return false;
    if (!WAGEN.includes(typ) && !hasTex('zug/' + typ)) {
      console.warn(`[zug] Wagen '${typ}' gibt es nicht.`);
      return false;
    }
    const w = this._neuerWagen(typ);
    this._ordne(false);
    const f = w.fahrzeug;
    f.x = f._zielX - 200;
    f.alpha = 0;
    tween(f, { alpha: 1 }, 0.35, { ease: 'sineInOut' });
    w._kuppelt = true;
    return w;
  }

  /** Wagen abkuppeln (rollt nach hinten weg und verblasst). index fehlt = letzter. → true/false */
  wagenWeg(index = this.wagen.length - 1) {
    const w = this.wagen[index];
    if (!w) return false;
    this.wagen.splice(index, 1);
    this.wagen.forEach((x, i) => { x.index = i; });
    this._weg(w.fahrzeug, -230, 0.7);
    sfx('common/rupf', { vol: 0.7 });
    this._ordne(false);
    return true;
  }

  // Fahrzeug weich verabschieden: rollt um dx, blendet aus, wird zerstört
  _weg(f, dx, dauer) {
    f._zielX = f.x + dx;
    this._gehen.push(f);
    tween(f, { alpha: 0 }, dauer, { ease: 'sineInOut' }).then(() => {
      const i = this._gehen.indexOf(f);
      if (i >= 0) this._gehen.splice(i, 1);
      if (!f.destroyed) f.destroy({ children: true });
    });
  }

  _neuerWagen(typ) {
    const f = new Fahrzeug({
      koerper: 'zug/' + typ,
      raeder: [{ tex: WAGEN_RAD, punkt: 'rad1' }, { tex: WAGEN_RAD, punkt: 'rad2' }],
    });
    this.addChild(f);
    const w = {
      typ, fahrzeug: f, koerper: f, index: this.wagen.length,
      gast: null, gastId: null, ladung: null, ladungId: null,
      platz: platzVon(f), _kuppelt: false,
    };
    this.wagen.push(w);
    this.emit('wagen', w);
    return w;
  }

  // Plätze ausrechnen: Lok bei 0, jeder Wagen mit seiner vorderen Kupplung an der hinteren des Vordermanns
  _ordne(sofort) {
    const lok = this.lok;
    if (!lok) return;
    const vorn = lok.ruhePunkt('kupplung_v')?.x ?? 0;
    let hinten = lok.ruhePunkt('kupplung_h')?.x ?? 0;
    const ziele = [0];
    for (const w of this.wagen) {
      const f = w.fahrzeug;
      const kv = f.ruhePunkt('kupplung_v')?.x ?? 0;
      const kh = f.ruhePunkt('kupplung_h')?.x ?? 0;
      const x = hinten - kv + UEBERLAPP;
      ziele.push(x);
      hinten = x + kh;
    }
    const versatz = this.bezug === 'lok' ? -vorn : -(vorn + hinten) / 2;
    this.laenge = (vorn - hinten) * Math.abs(this.scale.x);
    this._fahrzeuge.length = 0;
    this._fahrzeuge.push(lok);
    lok._zielX = ziele[0] + versatz;
    this.wagen.forEach((w, i) => {
      w.fahrzeug._zielX = ziele[i + 1] + versatz;
      w.fahrzeug.zIndex = 10 - i;
      this._fahrzeuge.push(w.fahrzeug);
    });
    for (const f of this._fahrzeuge) {
      f._kv = f.ruhePunkt('kupplung_v');
      f._kh = f.ruhePunkt('kupplung_h');
    }
    while (this._buegel.length < this.wagen.length) {
      const b = new Sprite(buegelTextur());
      b.anchor.set(0, 0.5);
      b.zIndex = 0;            // hinter allen Fahrzeugen
      b.scale.y = BUEGEL_DICKE / 32;
      this.addChild(b);
      this._buegel.push(b);
    }
    if (sofort) for (const f of this._fahrzeuge) f.x = f._zielX;
    this._stelleBuegel();
  }

  // Bügel zwischen den Knäufen nachführen (Federn, Hüpfen, Heranrollen)
  _stelleBuegel() {
    for (let i = 0; i < this._buegel.length; i++) {
      const b = this._buegel[i];
      const w = this.wagen[i];
      const vorn = i === 0 ? this.lok : this.wagen[i - 1]?.fahrzeug;
      const hinten = w?.fahrzeug;
      if (!w || w._kuppelt || !vorn?._kh || !hinten?._kv) {
        b.visible = false;
        continue;
      }
      const ax = vorn.x + vorn._kh.x + BUEGEL_INNEN;
      const ay = vorn._kh.y + vorn.rumpf.y + vorn._boden + vorn.huepfer.y;
      const bx = hinten.x + hinten._kv.x - BUEGEL_INNEN;
      const by = hinten._kv.y + hinten.rumpf.y + hinten._boden + hinten.huepfer.y;
      const dx = bx - ax;
      const dy = by - ay;
      b.visible = true;
      b.alpha = Math.min(vorn.alpha, hinten.alpha);
      b.position.set(ax, ay);
      b.rotation = Math.atan2(dy, dx);
      b.scale.x = Math.hypot(dx, dy) / 96;
    }
  }

  // ---------- Gäste und Ladung

  /** Index des ersten Wagens mit Sitzplatz ohne Gast, sonst -1. */
  freierPlatz() {
    return this.wagen.findIndex((w) => w.platz?.art === 'sitz' && !w.gast);
  }

  /** Gast (Tier-id oder Mensch-id) in Wagen index setzen, null = aussteigen. Hüpft hinein/heraus. → true/false */
  setzeGast(index, id, { sofort = false } = {}) {
    const w = this.wagen[index];
    if (!w || w.platz?.art !== 'sitz') return false;
    if (id != null && !gastBekannt(id)) {
      console.warn(`[zug] Gast '${id}' gibt es nicht.`);
      return false;
    }
    if ((id ?? null) === w.gastId) return false;
    const alt = w.gast;
    if (alt) {
      w.gast = null;
      w.gastId = null;
      const raus = index % 2 ? -1 : 1;
      killTweensOf(alt);
      tween(alt, { y: alt.y - 330, x: alt.x + raus * 120, alpha: 0 }, 0.45, { ease: 'sineOut' })
        .then(() => {
          if (!alt.destroyed) alt.destroy({ children: true });
          if (alt._maske && !alt._maske.destroyed) alt._maske.destroy();
        });
      if (!sofort) sfx('common/hupf', { vol: 0.7 });
    }
    if (id != null) {
      const g = gastMasse(id, w.platz);
      const a = new Actor(id, { pack: MENSCHEN.has(id) ? 'zug' : 'tiere', scale: g.skala, parent: w.fahrzeug.innen, z: 2 });
      a.schatten.visible = false;
      // Maske: unterhalb des Wagenbodens ist der Gast abgeschnitten (sonst schaut er durch die Radbögen)
      const maske = new Graphics()
        .rect(w.platz.mitte - w.platz.breite, w.platz.boden - 4000, w.platz.breite * 2, 4000)
        .fill(0xffffff);
      w.fahrzeug.innen.addChild(maske);
      a.mask = maske;
      a._maske = maske;
      a.gastId = id;
      a.mensch = MENSCHEN.has(id);
      a._fuss = g.fuss;
      w.gast = a;
      w.gastId = id;
      this._ordneInnen(w, a, sofort);
      if (!sofort) {
        const fuss = a.y;
        a.y = w.platz.rand - 40;        // erst über dem Wagen …
        a.alpha = 0;
        const verz = alt ? 0.25 : 0;
        tween(a, { alpha: 1 }, 0.18, { ease: 'sineInOut', delay: verz });
        tween(a, { y: fuss }, 0.42, { ease: 'quadIn', delay: verz })   // … dann hinein plumpsen
          .then(() => {
            fx.pop(a, 0.08);
            if (a.mensch) sfx('common/landen');
            else animal(id);
          });
        if (!alt) sfx('common/hupf', { vol: 0.7 });
      }
      this.emit('gast', w);
    } else if (w.ladung) {
      this._ordneInnen(w, null, sofort);
    }
    return true;
  }

  /** Ladung (id aus LADUNGEN) auf/in Wagen index, null = abladen. → true/false */
  setzeLadung(index, id, { sofort = false } = {}) {
    const w = this.wagen[index];
    if (!w || !w.platz) return false;
    if (id != null && !LADUNGEN.includes(id) && !hasTex('zug/' + id)) {
      console.warn(`[zug] Ladung '${id}' gibt es nicht.`);
      return false;
    }
    if ((id ?? null) === w.ladungId) return false;
    const alt = w.ladung;
    if (alt) {
      w.ladung = null;
      w.ladungId = null;
      killTweensOf(alt);
      tween(alt, { y: alt.y - 260, alpha: 0 }, 0.4, { ease: 'sineOut' })
        .then(() => { if (!alt.destroyed) alt.destroy(); });
    }
    if (id != null) {
      const l = ladungMasse('zug/' + id, w.platz);
      const s = spr('zug/' + id, { scale: l.skala, parent: w.fahrzeug.innen, z: 1 });
      s._fuss = l.fuss;
      w.ladung = s;
      w.ladungId = id;
      this._ordneInnen(w, s, sofort);
      if (!sofort) {
        const fuss = s.y;
        s.y = fuss - 280;
        s.alpha = 0;
        tween(s, { alpha: 1 }, 0.18, { ease: 'sineInOut' });
        tween(s, { y: fuss }, 0.38, { ease: 'quadIn' }).then(() => {
          fx.pop(s, 0.08);
          sfx('common/klack', { vol: 0.8 });
        });
      }
      this.emit('ladung', w);
    } else if (w.gast) {
      this._ordneInnen(w, null, sofort);
    }
    return true;
  }

  // Gast und Ladung nebeneinander: allein = Mitte; zu zweit = Gast links, Ladung rechts.
  // neu = das gerade entstandene Ding (wird sofort hingesetzt), das andere rutscht weich zur Seite.
  _ordneInnen(w, neu, sofort) {
    const p = w.platz;
    const beide = w.gast && w.ladung && p.art === 'sitz';
    const setze = (obj, x) => {
      if (!obj) return;
      if (sofort || obj === neu) {
        obj.x = x;
        obj.y = obj._fuss;
      } else {
        killTweensOf(obj, ['x']);
        tween(obj, { x }, 0.35, { ease: 'sineInOut' });
      }
    };
    setze(w.gast, beide ? p.mitte - p.breite * 0.16 : p.mitte);
    setze(w.ladung, beide ? p.mitte + p.breite * 0.27 : p.mitte);
  }

  /**
   * Alle Gäste freuen sich (nacheinander, kleine Hüpfer, ein paar Herzen, ein Laut). nur = nur dieser Wagen.
   * Ruhe bei Dauertippen: Ein Gast, der sich vor weniger als 0,6 s gefreut hat, freut sich nicht neu, und der
   * Jubel-Ton (Tierlaut bzw. Freude-Klang) kommt höchstens alle 0,6 s – nichts stapelt sich.
   * → true, wenn sich (gerade oder eben noch) mindestens ein Gast freut.
   */
  gaesteJubeln(nur = null) {
    const jetzt = performance.now();
    const tonFrei = jetzt - (this._jubelTon ?? -1e9) >= JUBEL_PAUSE * 1000;
    let laut = !tonFrei;   // gebremst: kein neuer Ton
    let i = 0;
    let freutSichSchon = false;
    for (const w of this.wagen) {
      const a = w.gast;
      if (!a || (nur != null && w.index !== nur)) continue;
      if (Math.abs(a.y - a._fuss) > 1) continue;   // plumpst gerade noch hinein
      if (jetzt - (a._jubelZeit ?? -1e9) < JUBEL_PAUSE * 1000) {
        freutSichSchon = true;
        continue;
      }
      a._jubelZeit = jetzt;
      after(i++ * 0.18, () => {
        if (a.destroyed) return;
        a.pose('happy');
        a.hop(60);
        const kopf = this._inEbene(a.point('kopf'), a.parent);
        if (kopf) fx.burst('herzen', kopf.x, kopf.y + 20, { count: 3, parent: kopf.ebene });
        after(1.4, () => { if (!a.destroyed) a.pose('idle'); });
      });
      if (!laut && !a.mensch) {
        laut = true;
        this._jubelTon = jetzt;
        animal(a.gastId);
      }
    }
    if (i && !laut) {
      this._jubelTon = jetzt;
      sfx('common/freude', { vol: 0.8 });
    }
    return i > 0 || freutSichSchon;
  }

  // ---------- Lok

  /** Punkt der Lok (z. B. 'schornstein', 'gesicht') in Koordinaten des Eltern-Containers des Zugs. */
  punktLok(name) {
    return this.lok?.punkt(name, this.parent) ?? null;
  }

  /** Pfeifen: Pfiff und eine kleine Dampfwolke (höchstens alle 0,8 s). */
  pfeife() {
    if (this._pfiffZeit > 0) return false;
    this._pfiffZeit = 0.8;
    sfx('common/pfiff');
    const p = this._inEbene(this.punktLok('schornstein'), this.parent);
    if (p) fx.burst('rauch', p.x, p.y - 10, { count: 4, parent: p.ebene, groesse: this._rauchGroesse() });
    if (this.lok) fx.pop(this.lok.rumpf, 0.04);
    return true;
  }

  _rauchGroesse() {
    return clamp(Math.abs(this.scale.x) * 2.2, 0.6, 1.6);
  }

  // Punkt aus `von`-Koordinaten in die Effekt-Ebene (front der Szene, sonst Eltern-Container des Zugs)
  _inEbene(p, von) {
    if (!p || !von || this.destroyed) return null;
    const ebene = this.szene?.front && !this.szene.front.destroyed ? this.szene.front : this.parent;
    if (!ebene) return null;
    const q = ebene === von ? p : ebene.toLocal(p, von);
    return { x: q.x, y: q.y, ebene };
  }

  // ---------- Takt

  /** Jedes Bild aufrufen: Fahrt, Räder, Kuppelstange, Federn, Dampfwölkchen, Ankuppeln. */
  update(dt) {
    if (this.destroyed || !(dt > 0)) return;
    this._pfiffZeit = Math.max(0, this._pfiffZeit - dt);

    // weich anfahren und bremsen
    this._v += (this._vZiel - this._v) * (1 - Math.exp(-dt * BESCHLEUNIGUNG));
    if (Math.abs(this._vZiel - this._v) < 0.5) this._v = this._vZiel;
    this.dx = this._v * dt;
    if (this.bewegt) this.x += this.dx;
    const skala = Math.abs(this.scale.x) || 1;
    const strecke = this.dx / skala;          // in Bildpunkten der Fahrzeuge
    const k = 1 - Math.exp(-dt * ANNAEHERUNG);

    for (const f of this._fahrzeuge) this._schritt(f, strecke, k, dt);
    for (const f of this._gehen) this._schritt(f, strecke, k, dt);
    this._stelleBuegel();

    // Ankuppeln: sobald ein neuer Wagen angekommen ist – Hüpfer und Klonk
    for (const w of this.wagen) {
      if (w._kuppelt && Math.abs(w.fahrzeug.x - w.fahrzeug._zielX) < 6) {
        w._kuppelt = false;
        w.fahrzeug.hupf(16);
        sfx('common/kupplung');
        const vorn = w.index > 0 ? this.wagen[w.index - 1].fahrzeug : this.lok;
        vorn?.wackel(0.012);
      }
    }

    // Dampfwölkchen: nur Dampfloks, nur bei Fahrt, gemütlich einzeln
    if (this.lok && DAMPFLOKS.has(this.lok.typ) && Math.abs(this._v) / skala > 30) {
      this._dampf -= dt;
      if (this._dampf <= 0) {
        const tempo = clamp(Math.abs(this._v) / skala / 500, 0, 1);
        this._dampf = lerp(1.9, 0.9, tempo);
        const p = this._inEbene(this.punktLok('schornstein'), this.parent);
        if (p) fx.burst('rauch', p.x, p.y - 6, { count: 1, parent: p.ebene, groesse: this._rauchGroesse() * 0.85 });
      }
    } else {
      this._dampf = Math.min(this._dampf, 0.4);   // beim Anfahren kommt bald das erste Wölkchen
    }
  }

  // ein Fahrzeug: zu seinem Platz rollen + Fahrt → Räder drehen, federn
  _schritt(f, strecke, k, dt) {
    if (f.destroyed) return;
    const vorher = f.x;
    const ziel = f._zielX ?? f.x;
    f.x += (ziel - f.x) * k;
    if (Math.abs(ziel - f.x) < 0.2) f.x = ziel;
    f.rolle(strecke + (f.x - vorher));
    f.update(dt);
  }
}

// ---------------------------------------------------------------- Maße im Wagen

// Sitz- oder Ladeplatz eines Wagens in Koordinaten von fahrzeug.innen (= Körper-Bild relativ zum Anker)
function platzVon(f) {
  const m = meta(f.koerperId);
  const pts = m.pts || {};
  const lokal = (p) => ({ x: p[0] - m.ax * m.w, y: p[1] - m.ay * m.h });
  if (pts.sitz_l && pts.sitz_r) {
    const l = lokal(pts.sitz_l);
    const r = lokal(pts.sitz_r);
    const rand = Math.min(l.y, r.y);
    const unten = (1 - m.ay) * m.h;
    // Boden = knapp über den Radbögen: bis dorthin deckt die Vorderwand alles ab
    let boden = f.raeder.length ? Math.min(...f.raeder.map((x) => x.oben)) - 8 : rand + (unten - rand) * 0.6;
    if (!(boden > rand + 60)) boden = rand + (unten - rand) * 0.6;
    return { art: 'sitz', mitte: (l.x + r.x) / 2, rand, boden, breite: r.x - l.x };
  }
  if (pts.ladeflaeche_l && pts.ladeflaeche_r) {
    const l = lokal(pts.ladeflaeche_l);
    const r = lokal(pts.ladeflaeche_r);
    const flaeche = Math.max(l.y, r.y);
    return { art: 'flach', mitte: (l.x + r.x) / 2, rand: flaeche, boden: flaeche, breite: r.x - l.x };
  }
  return null;
}

// Größe und Fußhöhe eines Gasts: Kopf und Schultern schauen über die Vorderwand
function gastMasse(id, platz) {
  const mensch = MENSCHEN.has(id);
  const m = meta(gastBild(id));
  const anteil = mensch ? 0.55 : 0.6;             // so viel der Figur ist über dem Rand zu sehen
  let hoehe = platz.breite * (mensch ? 0.95 : 0.8) * (GAST_GROESSE[id] ?? 1);
  const breite = (m.w / m.h) * hoehe;
  if (breite > platz.breite * 0.9) hoehe *= (platz.breite * 0.9) / breite;
  // Was tiefer als der Wagenboden reicht, schneidet die Maske ab (siehe setzeGast)
  return { skala: hoehe / m.h, fuss: platz.rand + hoehe * (1 - anteil) };
}

// Größe und Standhöhe einer Ladung: auf dem Flachwagen oben drauf, im offenen Wagen schaut sie halb heraus
function ladungMasse(id, platz) {
  const m = meta(id);
  const breite = platz.breite * (platz.art === 'flach' ? 0.55 : 0.42);
  const skala = Math.min(breite / m.w, (breite * 1.1) / m.h);
  const hoehe = m.h * skala;
  const fuss = platz.art === 'flach' ? platz.boden : Math.min(platz.rand + hoehe * 0.55, platz.boden);
  return { skala, fuss };
}
