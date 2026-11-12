// Kleine lebendige Nebensachen für die Baustelle: ziehende Wolken, ein Schmetterling, ein Spatz auf dem Zaun,
// Tiere mit Bauhelm und ein Ton-Helfer, der gleiche Geräusche entprellt. Alles ruhig und langsam.

import { spr, meta, sfx, note, animal, tap, fx, Actor, rand, pick, clamp, PIXI } from '../../engine/index.js';

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
