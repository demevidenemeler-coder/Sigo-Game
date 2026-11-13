// Das Feuerwehrauto (Fahrzeug-Baustein) mit Leiter, Blaulicht-Schein und Fahrer im Fenster,
// dazu Hilfen für Helme auf Tierköpfen und eine ruhige Freude ohne Posenwechsel.

import { spr, tex, meta, sfx, Actor, clamp, PIXI } from '../../engine/index.js';
import { Fahrzeug } from '../../gemeinsam/zug.js';
import { stickerFuerOrt, gesammelt } from '../../gemeinsam/sticker.js';

// Diese Sticker gibt es nur für ihren eigenen Einsatz (Laterne repariert, Blumenkübel gerettet) – nie als Ersatz für
// eine andere geschaffte Runde (sonst bekäme ein Kind mit altem Speicherstand die Laterne fürs Helme-Verteilen).
const NUR_EIGENER_EINSATZ = ['feuerwehr_laterne', 'feuerwehr_blumenkuebel'];

/** Sticker für eine geschaffte Runde: der gewünschte, falls schon im Album ein anderer noch fehlender des Ortes. */
export function feuerSticker(bevorzugt) {
  const schon = new Set(gesammelt());
  if (!schon.has(bevorzugt)) return bevorzugt;
  const frei = stickerFuerOrt('feuerwehr').find((s) => !schon.has(s.id) && !NUR_EIGENER_EINSATZ.includes(s.id));
  return frei ? frei.id : bevorzugt;
}

const KOERPER = 'feuerwehr/feuerwehrauto';

// Punkte im Körper-Bild (919×554). Die Punkte 'duese' und 'blaulicht' in pack.json liegen sichtbar daneben
// (Düse dort = Dach des Führerhauses, Blaulicht = Sockel) – hier selbst abgelesen.
export const AUTO_PUNKT = {
  duese: [474, 112],        // Mündung des Wasserwerfers
  blaulicht: [656, 40],     // Mitte der blauen Kuppel
  fenster: [636, 238],      // Mitte des Fahrerfensters
  leiter: [62, 176],        // Drehfuß der Leiter (hinten auf dem Dach)
  orden: [600, 284],       // Aufhängung des Ordens an der Fahrertür (unter dem Fenster, links vom Griff)
  schlauch: [520, 448],    // Anschluss des Schlauchs (unten zwischen hinterem Fach und Führerhaus)
  fach: [330, 330],        // Mitte der beiden Geräte-Fächer (Rollläden) – dort wird der Schlauch eingerollt
  heck: [120, 330],        // hinten: hier steigt die Mannschaft ein und aus
};

// Leiter liegt auf dem Dach (Bild 1000×148, Drehpunkt am roten Fuß, Holme y 20…105, Fuß-Unterkante y 130)
export const LEITER_LIEGT = 0.34;   // Länge der liegenden Leiter (Faktor auf das Leiter-Bild)
export const LEITER_DICKE = 0.5;
export const LEITER_SPITZE = { x: 915, y: 12 };   // Spitze (Mitte der Holme) relativ zum Drehpunkt, Bildpunkte

// Der Helm im Paket hat einen Nackenschutz, der im Gesicht hängen würde. Für Helme auf Köpfen (und die
// bereitliegenden, damit sie gleich aussehen) wird nur der obere Teil bis unter die Krempe benutzt.
const HELM_SCHNITT = 200;     // Bildzeilen 0…200 (Krempe endet bei ≈ 196)
const HELM_KREMPE = 186;      // Anker: Unterseite der Krempe
let helmCache = null;

/** Helm-Textur ohne Nackenschutz (Ausschnitt des Paket-Bilds, einmal je geladener Textur). */
export function helmTex() {
  const t = tex('feuerwehr/helm');
  if (helmCache && helmCache.quelle === t) return helmCache.t;
  const f = t.frame;
  const nt = new PIXI.Texture({
    source: t.source,
    frame: new PIXI.Rectangle(f.x, f.y, f.width, Math.round((f.height * HELM_SCHNITT) / 270)),
  });
  helmCache = { quelle: t, t: nt };
  return nt;
}

/** Sprite eines Helms (ohne Nackenschutz), Anker unter der Krempe. */
export function helmSprite(opt = {}) {
  const s = new PIXI.Sprite(helmTex());
  s.label = 'feuerwehr/helm';
  s.anchor.set(0.5, HELM_KREMPE / HELM_SCHNITT);
  if (opt.x !== undefined) s.position.set(opt.x, opt.y ?? 0);
  if (opt.scale !== undefined) s.scale.set(opt.scale);
  if (opt.z !== undefined) s.zIndex = opt.z;
  opt.parent?.addChild(s);
  return s;
}

// Helm auf dem Kopf: Ort der Krempen-Unterseite (Bildpunkte der idle-Pose) und Breite des Helms (Bildpunkte)
const HELM_SITZ = {
  hund: { x: 470, y: 150, breite: 500, dreh: 0.08 },
  katze: { x: 400, y: 175, breite: 480, dreh: 0.1 },
  baer: { x: 365, y: 268, breite: 660, dreh: -0.04 },
  fuchs: { x: 505, y: 220, breite: 470, dreh: 0.08 },
  hase: { x: 330, y: 300, breite: 360, dreh: 0 },
  affe: { x: 470, y: 175, breite: 470, dreh: 0.05 },
  schwein: { x: 480, y: 175, breite: 470, dreh: 0.12 },
};

/** Bildpunkt der idle-Pose eines Tiers → Koordinaten in actor.atem (wie das Sprite: Anker an den Füßen). */
function tierPunkt(tier, px, py) {
  const m = meta(`tiere/${tier}_idle`);
  return { x: px - (m.ax ?? 0.5) * m.w, y: py - (m.ay ?? 0.97) * m.h };
}

/** Ort und Größe des Helms in actor.atem für ein Tier. → {x, y, scale, rotation} */
export function helmSitz(tierId) {
  const s = HELM_SITZ[tierId] || { x: 0, y: 0, breite: 380, dreh: 0 };
  const m = meta(`tiere/${tierId}_idle`);
  const p = HELM_SITZ[tierId] ? tierPunkt(tierId, s.x, s.y) : { x: 0, y: -m.h * 0.82 };
  return { x: p.x, y: p.y, scale: s.breite / meta('feuerwehr/helm').w, rotation: s.dreh };
}

/** Setzt einen (neuen oder vorhandenen) Helm-Sprite auf den Kopf der Figur. → Sprite */
export function setzeHelm(actor, sprite = null) {
  const sitz = helmSitz(actor.tierId);
  const h = sprite || helmSprite();
  actor.atem.addChild(h);
  // gespiegelte Figur: Helm mitspiegeln
  const spiegel = actor.flip ? -1 : 1;
  h.position.set(sitz.x * spiegel, sitz.y);
  h.scale.set(sitz.scale * spiegel, sitz.scale);
  h.rotation = sitz.rotation * spiegel;
  h.alpha = 1;
  actor.helm = h;
  return h;
}

/** Kopf-Mitte einer Figur (etwas unter der Helm-Krempe) in Koordinaten von `bezug`. */
export function kopfPunkt(actor, bezug) {
  const sitz = helmSitz(actor.tierId);
  return bezug.toLocal(actor.atem.toGlobal({ x: sitz.x, y: sitz.y + 60 }));
}

/**
 * Ruhige Freude: (optional) Pose 'happy', Laut, kleiner Hüpfer, ein paar Herzen in der Seite (gleiten mit).
 * Mit Helm bleibt die Pose idle (der Helm sitzt auf der idle-Pose richtig).
 */
export function freue(seite, actor, { herzen = 5, laut = true, hoehe = 70 } = {}) {
  if (!actor || actor.destroyed) return Promise.resolve(false);
  if (actor._feuerFreude) {
    if (laut) actor.sound();
    return actor._feuerFreude;
  }
  const mitPose = !actor.helm && actor.hasPose('happy');
  if (mitPose) actor.pose('happy');
  if (laut) actor.sound();
  const k = seite.vorn.toLocal(actor.sprite.toGlobal(kopfLokal(actor)));
  seite.burst('herzen', k.x, k.y - 20, { count: herzen });
  const f = actor.hop(hoehe).then(async (ok) => {
    await seite.wait(0.6);
    if (!actor.destroyed && mitPose && actor.poseName === 'happy') actor.pose('idle');
    actor._feuerFreude = null;
    return ok;
  });
  actor._feuerFreude = f;
  return f;
}

// Kopf (oben Mitte) in Sprite-Koordinaten
function kopfLokal(actor) {
  const t = actor.sprite.texture;
  return { x: (0.5 - actor.sprite.anchor.x) * t.width, y: -actor.sprite.anchor.y * t.height + t.height * 0.12 };
}

// ---------------------------------------------------------------- Feuerwehrauto

export class FeuerAuto {
  /**
   * new FeuerAuto({ x, y, scale, parent, z, fahrer: 'fuchs' | null, fahrerSichtbar })
   * auto.f = das Fahrzeug (Container). Jedes Bild auto.update(dt) aufrufen.
   */
  constructor(opt = {}) {
    this.f = new Fahrzeug({
      koerper: KOERPER,
      raeder: [{ tex: 'feuerwehr/rad_auto', punkt: 'rad1' }, { tex: 'feuerwehr/rad_auto', punkt: 'rad2' }],
      x: opt.x ?? 0, y: opt.y ?? 1300, scale: opt.scale ?? 0.8, parent: opt.parent, z: opt.z,
    });
    const rumpf = this.f.rumpf;

    // Fahrer hinter dem Körper (durch das Fenster zu sehen)
    this.fahrer = null;
    if (opt.fahrer) {
      const a = new Actor(opt.fahrer, { scale: 0.25 });
      a.schatten.visible = false;
      const fen = this.lokal('fenster');
      const m = meta(`tiere/${opt.fahrer}_idle`);
      // Kopf (ca. 30 % der Bildhöhe von oben) in die Fenstermitte: Füße liegen ≈ 68 % der Bildhöhe darunter
      a.position.set(fen.x - 6, fen.y + m.h * 0.25 * 0.68);
      rumpf.addChildAt(a, 0);   // hinter dem Körper
      setzeHelm(a);
      a.visible = opt.fahrerSichtbar ?? true;
      this.fahrer = a;
    }

    // Leiter liegt sichtbar auf dem Dach (vor dem Körper, hinter dem Wasserwerfer-Sockel kaum zu merken)
    const pl = this.lokal('leiter');
    this.leiter = spr('feuerwehr/leiter', { x: pl.x, y: pl.y });
    this.leiter.scale.set(LEITER_LIEGT, LEITER_DICKE);
    this.leiter.rotation = 0;
    rumpf.addChildAt(this.leiter, rumpf.getChildIndex(this.f.koerper) + 1);

    // weicher blauer Schein über der Kuppel (glimmt langsam auf und ab, nie blinken)
    const pb = this.lokal('blaulicht');
    this.schein = spr('feuerwehr/blaulicht_schein', { x: pb.x, y: pb.y, parent: rumpf });
    this.schein.scale.set(0.7);
    this.schein.alpha = 0;
    this.schein.eventMode = 'none';
    this.blau = false;      // soll das Blaulicht glimmen?
    this._huelle = 0;       // 0…1 weiches Ein-/Ausblenden
    this._phase = 0;
    this._tatueZeit = -1e9;
  }

  /** Bildpunkt des Körpers (AUTO_PUNKT) → Koordinaten im Rumpf (= Körper-Sprite). Einmal je Name berechnet. */
  lokal(name) {
    this._lokal ??= new Map();
    let l = this._lokal.get(name);
    if (!l) {
      const m = meta(KOERPER);
      const p = AUTO_PUNKT[name] || m.pts?.[name] || [m.w / 2, m.h / 2];
      l = Object.freeze({ x: p[0] - m.ax * m.w, y: p[1] - m.ay * m.h });
      this._lokal.set(name, l);
    }
    return l;
  }

  /**
   * Punkt des Autos in Koordinaten von `bezug` (mit Federn, Hüpfen, Fahrt).
   * Mit `aus` (z. B. ein PIXI.Point, der wiederverwendet wird) entsteht kein neues Objekt – für jedes Bild.
   */
  punkt(name, bezug, aus) {
    this._global ??= new PIXI.Point();
    const g = this.f.koerper.toGlobal(this.lokal(name), this._global);
    return bezug.toLocal(g, undefined, aus);
  }

  /** Freundliches Tatü-Tata (höchstens alle 3,2 s) und Blaulicht für `sek` Sekunden. → true, wenn es erklang */
  tatue(seite, sek = 4) {
    const jetzt = performance.now() / 1000;
    this.blaulicht(true);
    this._aus?.kill();
    if (sek) this._aus = seite.after(sek, () => this.blaulicht(false));
    if (jetzt - this._tatueZeit < 3.2) return false;
    this._tatueZeit = jetzt;
    sfx('common/tatue', { vol: 0.65 });
    return true;
  }

  blaulicht(an) {
    this.blau = !!an;
    if (an) this._aus?.kill();
  }

  /** Weich nach (x, y) mit neuer Größe fahren; Räder drehen passend zur waagrechten Strecke. → thenable */
  fahre(seite, ziel, dauer, kurve = 'sineInOut') {
    const f = this.f;
    let letztes = f.x;
    const props = { x: ziel.x ?? f.x, y: ziel.y ?? f.y };
    if (ziel.scale !== undefined) props.scale = ziel.scale;
    return seite.tween(f, props, dauer, {
      ease: kurve,
      onUpdate: () => {
        f.rolle(f.x - letztes);
        letztes = f.x;
      },
    });
  }

  update(dt) {
    this.f.update(dt);
    const k = 1 - Math.exp(-dt * 2.2);  // ≈0,5 s weiches Ein- und Ausblenden
    this._huelle += ((this.blau ? 1 : 0) - this._huelle) * k;
    if (this._huelle < 0.002 && !this.blau) {
      this._huelle = 0;
      this._phase = 0;
      this.schein.alpha = 0;
      return;
    }
    this._phase += dt;
    const welle = 0.5 - 0.5 * Math.cos((this._phase / 1.6) * Math.PI * 2);   // Periode 1,6 s
    this.schein.alpha = clamp(this._huelle * (0.2 + 0.6 * welle), 0, 1);
    this.schein.scale.set(0.64 + 0.08 * welle);
  }
}
