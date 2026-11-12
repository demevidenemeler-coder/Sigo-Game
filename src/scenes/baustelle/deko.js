// Kleine lebendige Nebensachen für die Baustelle: ziehende Wolken, ein Schmetterling, ein Spatz auf dem Zaun,
// Tiere mit Bauhelm und ein Ton-Helfer, der gleiche Geräusche entprellt. Alles ruhig und langsam.

import { spr, meta, sfx, note, animal, tap, fx, Actor, store, rand, pick, clamp, PIXI } from '../../engine/index.js';

// ---------------------------------------------------------------- Abwechslung

/**
 * Zieht Einträge zufällig, aber nie denselben zweimal hintereinander (auch nicht über das Neu-Mischen hinweg).
 * Jeder Eintrag kommt einmal dran, bevor sich etwas wiederholt.
 */
export class Beutel {
  constructor(liste) {
    this.liste = liste.slice();
    this.rest = [];
    this.zuletzt = null;
  }

  ziehe() {
    if (!this.rest.length) {
      this.rest = this.liste.slice();
      for (let i = this.rest.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [this.rest[i], this.rest[j]] = [this.rest[j], this.rest[i]];
      }
      // nicht mit dem Letzten der vorigen Runde anfangen
      if (this.rest.length > 1 && this.rest[this.rest.length - 1] === this.zuletzt) {
        this.rest.unshift(this.rest.pop());
      }
    }
    this.zuletzt = this.rest.pop();
    return this.zuletzt;
  }
}

/**
 * Farbfilter, der ein Bild in eine Farbe „umstreicht": Helligkeit bleibt (Ziegel-Fugen, Licht und Schatten),
 * die Farbe kommt aus `farbe`. k und b heben die Helligkeit (dunkle rote Ziegel brauchen mehr als helle gelbe).
 */
export function einfaerben(farbe, { k = 1.2, b = 0.22 } = {}) {
  const f = new PIXI.ColorMatrixFilter();
  const r = ((farbe >> 16) & 255) / 255;
  const g = ((farbe >> 8) & 255) / 255;
  const bl = (farbe & 255) / 255;
  const zeile = (c) => [c * 0.3 * k, c * 0.59 * k, c * 0.11 * k, 0, c * b];
  f.matrix = [...zeile(r), ...zeile(g), ...zeile(bl), 0, 0, 0, 1, 0];
  return f;
}

// ---------------------------------------------------------------- Wimpelkette

const WIMPEL_FARBEN = [0xf26b5b, 0xffc94a, 0x6cc3f0, 0x8fd16a, 0xc69af0, 0xff9f5a];

/**
 * Wimpelkette am Bauzaun, die über die Runden wächst (ein Wimpel je geschaffter Runde, gespeichert unter `key`).
 * punkte = Aufhänge-Punkte (Pfosten-Spitzen) in Seiten-Koordinaten; zwischen zwei Punkten hängt ein Bogen mit
 * je `jeBogen` Wimpeln. Die Wimpel schaukeln ganz leicht; antippen → sie schaukeln etwas mehr, ein Glöckchen.
 */
export class Wimpelkette {
  constructor(seite, { punkte, durchhang = 42, jeBogen = 3, key, z = 3 }) {
    this.seite = seite;
    this.key = key;
    this.c = new PIXI.Container({ label: 'wimpelkette' });
    this.c.zIndex = z;
    seite.welt.addChild(this.c);
    const schnur = new PIXI.Graphics();
    this.orte = [];
    for (let i = 0; i + 1 < punkte.length; i++) {
      const a = punkte[i];
      const e = punkte[i + 1];
      const k = { x: (a.x + e.x) / 2, y: (a.y + e.y) / 2 + durchhang * 2 };
      schnur.moveTo(a.x, a.y).quadraticCurveTo(k.x, k.y, e.x, e.y);
      for (let j = 1; j <= jeBogen; j++) {
        const t = j / (jeBogen + 1);
        const u = 1 - t;
        this.orte.push({ x: u * u * a.x + 2 * u * t * k.x + t * t * e.x, y: u * u * a.y + 2 * u * t * k.y + t * t * e.y });
      }
    }
    schnur.stroke({ width: 6, color: 0x8a6a4a, cap: 'round' });
    this.c.addChild(schnur);
    for (const p of punkte) this.c.addChild(new PIXI.Graphics().circle(p.x, p.y, 8).fill(0x8a6a4a));
    this.max = this.orte.length;
    this.wimpel = [];
    this.schwung = 0;
    this.t = 0;
    const n = clamp(Number(store.get(key, 0)) || 0, 0, this.max);
    for (let i = 0; i < n; i++) this.neuerWimpel(false);
    // Tippfläche: ein Band um die Schnur (Rechtecke je Bogen)
    const minX = Math.min(...punkte.map((p) => p.x)) - 40;
    const maxX = Math.max(...punkte.map((p) => p.x)) + 40;
    const minY = Math.min(...punkte.map((p) => p.y)) - 40;
    const maxY = Math.max(...punkte.map((p) => p.y)) + durchhang + 130;
    this.c.hitArea = new PIXI.Rectangle(minX, minY, maxX - minX, maxY - minY);
    tap(this.c, () => {
      this.schwung = 1;
      note('glocke', pick([79, 83, 86]), { vol: 0.22 });
    }, { sound: null, squash: false });
  }

  get anzahl() { return this.wimpel.length; }

  neuerWimpel(weich = true) {
    if (this.wimpel.length >= this.max) {
      // Kette ist voll: sie schaukelt vor Freude
      this.schwung = 1;
      return null;
    }
    const i = this.wimpel.length;
    const o = this.orte[i];
    const farbe = WIMPEL_FARBEN[i % WIMPEL_FARBEN.length];
    const g = new PIXI.Graphics()
      .poly([-36, 0, 36, 0, 0, 78]).fill(farbe).stroke({ width: 10, color: farbe, join: 'round' })
      .circle(-8, 18, 8).fill({ color: 0xffffff, alpha: 0.35 });
    g.position.set(o.x, o.y - 2);
    g.phase = i * 0.9;
    this.c.addChild(g);
    this.wimpel.push(g);
    if (weich) {
      g.scale.set(0.01);
      this.seite.tween(g, { scale: 1 }, 0.5, { ease: 'backOut' });
      store.set(this.key, this.wimpel.length);
    }
    return g;
  }

  /** Ort des nächsten (bzw. letzten) Wimpels – für Funkeln. */
  ortNeu() {
    return this.orte[Math.max(0, Math.min(this.wimpel.length, this.max) - 1)];
  }

  update(dt) {
    this.t += dt;
    this.schwung = Math.max(0, this.schwung - dt * 0.4);
    const a = 0.05 + 0.12 * this.schwung;
    for (const w of this.wimpel) w.rotation = a * Math.sin(this.t * 1.4 + w.phase);
  }
}

// ---------------------------------------------------------------- Startpunkt für Zieh-Hinweise

/**
 * Unsichtbarer Startpunkt für eine Zeige-Hand, die eine Wisch- oder Schiebe-Bewegung zeigt. Der Kern zeigt einen
 * Zieh-Hinweis ({von, nach}) nur, wenn `von` ein sichtbares Anzeige-Objekt im Baum ist – ein reiner Punkt {x, y}
 * fällt durch. Diese Marke ist ein winziges, fast durchsichtiges Feld (kein Sprite: die Hand trägt dann keine
 * Bild-Kopie mit sich), das die Seite an die gewünschte Stelle setzt: `marke.bei(x, y)` → Anzeige-Objekt.
 */
export class HandStart {
  constructor(parent) {
    const g = new PIXI.Graphics().rect(-20, -20, 40, 40).fill({ color: 0xffffff, alpha: 0.001 });
    g.label = 'handStart';
    g.eventMode = 'none';
    g.zIndex = -1000;
    parent.addChild(g);
    this.g = g;
  }

  bei(x, y) {
    this.g.position.set(x, y);
    return this.g;
  }
}

// ---------------------------------------------------------------- Töne entprellen

const zuletzt = new Map();

/** Geräusch abspielen, aber dasselbe frühestens nach `abstand` Sekunden wieder (nichts stapelt sich). */
export function ton(id, { abstand = 0.3, vol = 1, rate = 1 } = {}) {
  const jetzt = performance.now();
  if (jetzt - (zuletzt.get(id) ?? -1e9) < abstand * 1000) return false;
  zuletzt.set(id, jetzt);
  sfx(id, { vol, rate });
  return true;
}

/** Tierlaut, je Tier höchstens alle 0,7 s. */
export function laut(tierId) {
  const id = 'tier:' + tierId;
  const jetzt = performance.now();
  if (jetzt - (zuletzt.get(id) ?? -1e9) < 700) return;
  zuletzt.set(id, jetzt);
  animal(tierId);
}

// ---------------------------------------------------------------- Wolken

/** Zwei, drei Wolken ziehen langsam über den Himmel (in seite.hinten, vor dem Hintergrundbild). */
export class Wolken {
  constructor(seite, { anzahl = 2, y = [120, 330] } = {}) {
    this.liste = [];
    const bilder = ['common/wolke1', 'common/wolke2', 'common/wolke3'];
    for (let i = 0; i < anzahl; i++) {
      const id = bilder[i % bilder.length];
      const breite = rand(300, 420);
      const w = spr(id, { anchor: 0.5, parent: seite.hinten });
      w.scale.set(breite / meta(id).w);
      w.alpha = 0.92;
      w.zIndex = -500;
      w.position.set(-1100 + i * 1300 + rand(-200, 200), rand(y[0], y[1]));
      w.v = rand(9, 16);
      tap(w, () => {
        fx.wobble(w, 0.05);
        note('glocke', pick([79, 84]), { vol: 0.25 });
      }, { sound: null, pad: 80 });
      this.liste.push(w);
    }
  }

  update(dt) {
    for (const w of this.liste) {
      if (w.destroyed) continue;
      w.x += w.v * dt;
      if (w.x > 1700) w.x = -1700;
    }
  }
}

// ---------------------------------------------------------------- Schmetterling

/** Ein Schmetterling schaukelt gemächlich durch einen Bereich; antippen → er flattert ein Stück höher. */
export class Schmetterling {
  constructor(seite, { bereich = { x: -400, y: 520, w: 900, h: 300 }, farbe = 0xf2a7c8, z = 60 } = {}) {
    this.seite = seite;
    this.bereich = bereich;
    this.c = new PIXI.Container({ label: 'schmetterling' });
    this.c.zIndex = z;
    const fluegel = (seite_) => {
      const g = new PIXI.Graphics();
      g.ellipse(seite_ * 26, -14, 28, 22).fill(farbe).stroke({ width: 3, color: 0xffffff, alpha: 0.7 });
      g.ellipse(seite_ * 20, 16, 18, 15).fill(0xffd76a).stroke({ width: 3, color: 0xffffff, alpha: 0.7 });
      g.circle(seite_ * 28, -16, 6).fill({ color: 0xffffff, alpha: 0.75 });
      return g;
    };
    this.links = fluegel(-1);
    this.rechts = fluegel(1);
    const leib = new PIXI.Graphics()
      .roundRect(-6, -24, 12, 48, 6).fill(0x5a4030)
      .moveTo(-2, -24).lineTo(-10, -40).moveTo(2, -24).lineTo(10, -40).stroke({ width: 3, color: 0x5a4030 })
      .circle(-10, -40, 3.5).fill(0x5a4030).circle(10, -40, 3.5).fill(0x5a4030);
    this.c.addChild(this.links, this.rechts, leib);
    this.c.hitArea = new PIXI.Circle(0, 0, 115);
    seite.welt.addChild(this.c);
    this.t = rand(0, 20);
    this.hoch = 0;           // Auftrieb nach dem Antippen (klingt ab)
    this.c.position.set(bereich.x + bereich.w / 2, bereich.y + bereich.h / 2);
    tap(this.c, () => {
      this.hoch = 1;
      note('pling', pick([84, 86, 88]), { vol: 0.35 });
    }, { sound: null, squash: false });
  }

  update(dt) {
    if (this.c.destroyed) return;
    this.t += dt;
    const b = this.bereich;
    const t = this.t;
    this.hoch = Math.max(0, this.hoch - dt * 0.35);
    const x = b.x + b.w * (0.5 + 0.45 * Math.sin(t * 0.21) * Math.cos(t * 0.07));
    const y = b.y + b.h * (0.5 + 0.4 * Math.sin(t * 0.37 + 1)) - 160 * Math.sin(this.hoch * Math.PI / 2);
    const vx = x - this.c.x;
    this.c.position.set(x, y);
    // Flügelschlag: ruhig, etwa zweimal pro Sekunde
    const f = 0.45 + 0.55 * Math.abs(Math.sin(t * Math.PI * 2.1));
    this.links.scale.x = f;
    this.rechts.scale.x = f;
    this.c.rotation = clamp(vx * 0.02, -0.25, 0.25);
  }
}

// ---------------------------------------------------------------- Spatz auf dem Zaun

/** Kleiner runder Vogel (gezeichnet), pickt ab und zu; antippen → hüpft und piept zweimal. */
export class Spatz {
  constructor(seite, { x = 0, y = 740, flip = false, z = 5 } = {}) {
    this.seite = seite;
    this.c = new PIXI.Container({ label: 'spatz' });
    this.c.position.set(x, y);
    this.c.zIndex = z;
    this.k = new PIXI.Container();
    const g = new PIXI.Graphics();
    // Schwanz, Körper, Bauch, Flügel, Kopf, Auge, Schnabel, Beinchen
    g.poly([-38, -28, -70, -46, -66, -20]).fill(0x8a5a3a);
    g.ellipse(0, -30, 40, 30).fill(0xa8714a);
    g.ellipse(8, -22, 26, 18).fill(0xf3dcc0);
    g.ellipse(-10, -34, 24, 15).fill(0x8a5a3a);
    g.circle(28, -58, 22).fill(0xa8714a);
    g.circle(36, -62, 5.5).fill(0x2a1c14).circle(38, -64, 1.8).fill(0xffffff);
    g.circle(30, -50, 5).fill({ color: 0xf29a8a, alpha: 0.8 });
    g.poly([48, -60, 64, -55, 48, -50]).fill(0xf0a030);
    g.moveTo(-6, -2).lineTo(-8, 4).moveTo(8, -2).lineTo(10, 4).stroke({ width: 4, color: 0xe08a30 });
    this.k.addChild(g);
    if (flip) this.k.scale.x = -1;
    this.c.addChild(this.k);
    this.c.hitArea = new PIXI.Circle(0, -40, 110);
    seite.welt.addChild(this.c);
    tap(this.c, () => this.piep(), { sound: null });
    // Ab und zu picken (nur wenn sichtbar) – eine kleine, ruhige Bewegung
    seite.every(rand(4.5, 6.5), () => {
      if (!seite.aktiv || this.c.destroyed) return;
      seite.tween(this.k, { rotation: 0.35 * (flip ? -1 : 1) }, 0.18, { ease: 'sineInOut' })
        .then(() => seite.tween(this.k, { rotation: 0 }, 0.25, { ease: 'sineInOut' }));
    });
  }

  piep() {
    const s = this.seite;
    // Sperre: Piept oder hüpft er noch (0,6 s), gibt es keinen neuen Doppelton und keinen neuen Hüpfer – das
    // Stauchen beim Antippen (tap) ist dann die Antwort. Dauertippen stapelt so keine Töne.
    const jetzt = performance.now();
    if (jetzt < (this.ruhigBis ?? 0)) return;
    this.ruhigBis = jetzt + 600;
    note('floete', 91, { vol: 0.35, dauer: 0.12 });
    s.after(0.18, () => note('floete', 95, { vol: 0.3, dauer: 0.12 }));
    s.tween(this.k, { y: -40 }, 0.18, { ease: 'quadOut' })
      .then(() => s.tween(this.k, { y: 0 }, 0.2, { ease: 'quadIn' }));
  }
}

// ---------------------------------------------------------------- Tiere mit Bauhelm

// Wo der Helm auf dem Kopf sitzt: Bildpunkte des idle-Bildes (Mitte der Helmkante), Breite des Helms in Bildpunkten,
// leichte Neigung. Ausgemessen am Bild (oberster Rand des Kopfes) und auf Fotos geprüft.
const HELM = {
  pinguin: { x: 322, y: 150, b: 400, r: -0.05 },
  affe: { x: 405, y: 125, b: 330, r: -0.06 },
  hund: { x: 455, y: 120, b: 360, r: 0.05 },
  ente: { x: 292, y: 135, b: 330, r: -0.04 },
  schwein: { x: 520, y: 170, b: 420, r: 0.05 },
};
export const HELM_TIERE = Object.keys(HELM);

/**
 * Tier mit gelbem Bauhelm. Der Helm sitzt im Atem-Container (atmet mit). Das Tier bleibt in der idle-Pose
 * (die anderen Posen haben den Kopf woanders) – freuen() hüpft deshalb ohne Posenwechsel.
 */
export function helmTier(id, opt = {}) {
  const tier = new Actor(id, opt);
  const h = HELM[id];
  if (h) {
    const m = meta(`tiere/${id}_idle`);
    const helm = spr('baustelle/bauhelm');
    const hm = meta('baustelle/bauhelm');
    const s = h.b / hm.w;
    const richtung = opt.flip ? -1 : 1;
    helm.scale.set(s * richtung, s);
    // Helm-Anker liegt unten mittig (Krempe) – auf die Kopf-Linie setzen
    helm.position.set((h.x - m.ax * m.w) * richtung, h.y - m.ay * m.h + 30);
    helm.rotation = h.r * richtung;
    tier.atem.addChild(helm);
    tier.helm = helm;
  }
  return tier;
}

/**
 * Kopf eines Tiers in Koordinaten von seite.vorn (dort entstehen die Teilchen der Seite). point('kopf') liefert
 * Koordinaten des Eltern-Containers – sitzt das Tier in einem Haus oder einem Kipper, sind das nicht die der Seite.
 */
const _g = new PIXI.Point();
export function kopfAufSeite(seite, tier) {
  const p = tier.point('kopf');
  if (!tier.parent) return { x: p.x, y: p.y };
  tier.parent.toGlobal(p, _g);
  const k = seite.vorn.toLocal(_g);
  return { x: k.x, y: k.y };
}

/** Tier freut sich: Hüpfer, Laut, ein paar Herzen (an der Seite, gleiten mit). Kein Gezappel bei Dauertippen. */
export function freuen(seite, tier, { herzen = 4 } = {}) {
  if (!tier || tier.destroyed) return;
  laut(tier.tierId);
  if (tier._freutSich) return;
  tier._freutSich = true;
  const kopf = kopfAufSeite(seite, tier);
  seite.burst('herzen', kopf.x, kopf.y + 20, { count: herzen });
  tier.hop(60).then(() => { tier._freutSich = false; });
}
