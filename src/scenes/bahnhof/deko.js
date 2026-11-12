// Kleine lebendige Nebensachen am Bahnhof: Vogel, Schmetterling, Bahnhofsuhr mit drehbaren Zeigern, ziehende Wolken.
// Alles ruhig: langsame Bewegungen, weiche Formen (gezeichnet mit PIXI.Graphics, weil es dafür kein Bild gibt).

import { tex, meta, spr, tap, animal, note, sfx, fx, ease, killTweensOf, rand, clamp, PIXI } from '../../engine/index.js';

const { Container, Graphics, Sprite, Texture, Rectangle, Circle } = PIXI;

// ---------------------------------------------------------------- Vogel

/**
 * Kleiner runder Vogel (Füße bei y = 0, schaut nach rechts). Sitzt auf einer von mehreren Stangen, hüpft ab und zu
 * ein wenig, beim Antippen zwitschert er und fliegt in einem weichen Bogen zur nächsten Stange.
 */
export class Vogel extends Container {
  constructor(szene, sitze, { parent, z = 6, skala = 1 } = {}) {
    super({ label: 'vogel' });
    this.szene = szene;
    this.sitze = sitze;
    this.nr = 0;
    this.fliegt = false;
    this._zeit = 0;
    this._ruhe = rand(4, 7);
    this._letzterLaut = -10;

    this.figur = new Container();
    this.addChild(this.figur);
    const g = new Graphics();
    // Schwanz, Körper, Bauch, Kopf
    g.poly([-26, -30, -50, -44, -46, -22]).fill(0x4f86bd);
    g.ellipse(0, -28, 34, 27).fill(0x6fa8dc);
    g.ellipse(9, -22, 21, 16).fill(0xf6e7c8);
    g.circle(24, -50, 19).fill(0x6fa8dc);
    // Schnabel, Auge mit Glanz, Bäckchen
    g.poly([40, -53, 54, -48, 40, -43]).fill(0xf2b33d);
    g.circle(30, -54, 4.8).fill(0x2b1d14);
    g.circle(31.6, -55.8, 1.7).fill(0xffffff);
    g.circle(31, -43, 4.5).fill({ color: 0xf29a9a, alpha: 0.75 });
    // Beinchen
    g.roundRect(-5, -6, 4, 8, 2).fill(0xe0a040);
    g.roundRect(6, -6, 4, 8, 2).fill(0xe0a040);
    this.figur.addChild(g);
    // Flügel (eigenes Teil, damit er schlagen kann)
    this.fluegel = new Graphics().ellipse(0, 0, 21, 13).fill(0x4f86bd);
    this.fluegel.position.set(-6, -30);
    this.figur.addChild(this.fluegel);

    const p = sitze[0];
    this.position.set(p.x, p.y);
    this.scale.set(skala);
    this.zIndex = z;
    parent?.addChild(this);
    tap(this, () => this.tipp(), { sound: null, squash: false, hitArea: new Circle(0, -30, 140 / skala) });
  }

  /** Antippen: zwitschern und zur nächsten Stange fliegen. */
  tipp() {
    if (this._zeit - this._letzterLaut > 1.5) {
      this._letzterLaut = this._zeit;
      animal('vogel');
    }
    if (!this.fliegt) this.fliegeZu((this.nr + 1) % this.sitze.length);
  }

  async fliegeZu(nr) {
    const ziel = this.sitze[nr];
    if (!ziel || this.destroyed) return;
    this.fliegt = true;
    this.nr = nr;
    const x0 = this.x;
    const y0 = this.y;
    const dx = ziel.x - x0;
    this.figur.scale.x = dx < 0 ? -1 : 1;
    const hoehe = 140 + Math.abs(dx) * 0.12;
    const p = { t: 0 };
    const ok = await this.szene.tween(p, { t: 1 }, clamp(Math.abs(dx) / 420, 1.2, 3.2), {
      ease: 'linear',
      onUpdate: () => {
        if (this.destroyed) return;
        const e = ease.sineInOut(p.t);
        this.x = x0 + dx * e;
        this.y = y0 + (ziel.y - y0) * e - hoehe * 4 * p.t * (1 - p.t);
      },
    });
    if (this.destroyed) return;
    this.fliegt = false;
    this.fluegel.scale.y = 1;
    if (ok) fx.pop(this.figur, 0.08);
  }

  update(dt) {
    if (this.destroyed) return;
    this._zeit += dt;
    if (this.fliegt) {
      // Flügelschlag: gemütlich, nicht zappelig
      this.fluegel.scale.y = 0.35 + 0.65 * Math.abs(Math.sin(this._zeit * Math.PI * 2.4));
      return;
    }
    // ab und zu ein kleiner Hüpfer auf der Stelle, manchmal mit Umdrehen
    this._ruhe -= dt;
    if (this._ruhe <= 0) {
      this._ruhe = rand(5, 9);
      const f = this.figur;
      killTweensOf(f, ['y']);
      this.szene.tween(f, { y: -16 }, 0.16, { ease: 'quadOut' })
        .then((ok) => { if (ok && !f.destroyed) this.szene.tween(f, { y: 0 }, 0.2, { ease: 'quadIn' }); });
      if (Math.random() < 0.4) this.figur.scale.x *= -1;
    }
  }
}

// ---------------------------------------------------------------- Schmetterling

/** Schmetterling, der langsam eine weite Schleife fliegt. Antippen: flattert kurz höher, leiser Glockenton. */
export class Schmetterling extends Container {
  constructor(szene, { x, y, breite = 360, hoehe = 70, parent, z = 7 }) {
    super({ label: 'schmetterling' });
    this.szene = szene;
    this.mitte = { x, y };
    this.weite = { x: breite, y: hoehe };
    this._zeit = rand(0, 20);
    this.hoch = { y: 0 };
    this._letzterTon = -10;

    const fluegel = (seite) => {
      const g = new Graphics();
      g.ellipse(seite * 20, -12, 22, 18).fill(0xf4a3c4).stroke({ width: 3, color: 0xe07fa8 });
      g.ellipse(seite * 15, 12, 14, 12).fill(0xffd36b).stroke({ width: 3, color: 0xe8b445 });
      g.circle(seite * 22, -14, 5).fill({ color: 0xffffff, alpha: 0.6 });
      return g;
    };
    this.links = fluegel(-1);
    this.rechts = fluegel(1);
    const koerper = new Graphics().ellipse(0, 0, 5, 17).fill(0x6b4a3a);
    koerper.circle(0, -18, 6).fill(0x6b4a3a);
    this.addChild(this.links, this.rechts, koerper);
    this.zIndex = z;
    parent?.addChild(this);
    tap(this, () => this.tipp(), { sound: null, squash: false, hitArea: new Circle(0, 0, 130) });
    this.update(0);
  }

  tipp() {
    if (this._zeit - this._letzterTon > 0.8) {
      this._letzterTon = this._zeit;
      note('glocke', 84 + Math.floor(rand(0, 3)) * 2, { vol: 0.25 });
    }
    killTweensOf(this.hoch, ['y']);
    this.szene.tween(this.hoch, { y: -130 }, 0.7, { ease: 'sineOut' })
      .then((ok) => { if (ok) this.szene.tween(this.hoch, { y: 0 }, 1.6, { ease: 'sineInOut' }); });
  }

  update(dt) {
    if (this.destroyed) return;
    this._zeit += dt;
    const t = this._zeit;
    const x = this.mitte.x + Math.sin(t * 0.11 * Math.PI * 2) * this.weite.x;
    const y = this.mitte.y + Math.sin(t * 0.23 * Math.PI * 2) * this.weite.y + this.hoch.y;
    // Blickrichtung nach der Flugrichtung
    const vx = Math.cos(t * 0.11 * Math.PI * 2);
    this.scale.x = vx >= 0 ? 1 : -1;
    this.position.set(x, y);
    // Flügelschlag gemächlich
    const s = 0.3 + 0.7 * Math.abs(Math.cos(t * Math.PI * 1.6));
    this.links.scale.x = s;
    this.rechts.scale.x = s;
    this.rotation = Math.sin(t * 0.9) * 0.08;
  }
}

// ---------------------------------------------------------------- Uhr

/**
 * Drehbare Zeiger über der gemalten Turmuhr. Die gemalten Zeiger werden mit der gespiegelten unteren Hälfte des
 * Zifferblatts überdeckt (gleiche Farbe, gleiches Licht), darüber liegen eigene Zeiger.
 *   mitte = Mitte des Zifferblatts in Koordinaten von parent, bildMitte = dieselbe Stelle in Bildpunkten des Hintergrunds,
 *   radius = Radius des hellen Zifferblatts in Bildpunkten, skala = Größe des Hintergrund-Sprites
 */
export class Uhr extends Container {
  constructor(szene, { hgId, mitte, bildMitte, radius = 100, skala = 1, parent, z = 1 }) {
    super({ label: 'uhr' });
    this.szene = szene;
    this.minute = Math.PI / 3;   // wie gemalt: zehn nach zehn
    this.dreht = false;
    this.position.set(mitte.x, mitte.y);
    this.zIndex = z;

    // Abdeckung: untere Hälfte des Zifferblatts, nach oben gespiegelt, rund maskiert
    const t = tex(hgId);
    const m = meta(hgId);
    const k = t.width / (m.w || t.width);     // Textur-Einheiten je Bildpunkt (falls die Textur kleiner ist)
    const r = radius * k;
    const unten = new Texture({
      source: t.source,
      frame: new Rectangle(t.frame.x + bildMitte.x * k - r, t.frame.y + bildMitte.y * k, 2 * r, r),
    });
    const deckel = new Sprite(unten);
    // Die Ausschnitt-Textur gehört nur dieser Uhr: mit ihr wegräumen (die Quelle – der Hintergrund – bleibt)
    deckel.once('destroyed', () => unten.destroy(false));
    deckel.anchor.set(0.5, 0);
    deckel.scale.set(skala / k, -skala / k);
    const maske = new Graphics().circle(0, 0, radius * skala - 3).fill(0xffffff);
    deckel.mask = maske;
    this.addChild(deckel, maske);

    // Zeiger: dunkles Holz, runde Enden, kleiner Knauf in der Mitte
    const s = skala;
    this.stunde = new Graphics()
      .roundRect(-9 * s, -54 * s, 18 * s, 66 * s, 9 * s).fill(0x6b3d24)
      .roundRect(-4 * s, -50 * s, 5 * s, 44 * s, 2.5 * s).fill({ color: 0x9a6440, alpha: 0.6 });
    this.min = new Graphics()
      .roundRect(-7 * s, -82 * s, 14 * s, 92 * s, 7 * s).fill(0x6b3d24)
      .roundRect(-3 * s, -78 * s, 4 * s, 68 * s, 2 * s).fill({ color: 0x9a6440, alpha: 0.6 });
    const knauf = new Graphics().circle(0, 0, 19 * s).fill(0x6e4128).circle(-5 * s, -6 * s, 7 * s).fill({ color: 0xb07a52, alpha: 0.7 });
    this.addChild(this.stunde, this.min, knauf);
    this._stelle();

    parent?.addChild(this);
    this._tipp = tap(this, () => this.tipp(), { sound: null, squash: false, hitArea: new Circle(0, 0, Math.max(140, radius * skala + 40)) });
    this._letzterRuf = -10;
    this._zeit = 0;
  }

  _stelle() {
    this.min.rotation = this.minute;
    // Stundenzeiger: zehn Uhr plus ein Zwölftel der Minutenrunde
    this.stunde.rotation = -Math.PI / 3 + (this.minute - Math.PI / 3) / 12;
  }

  /** Kuckuck ruft, die Zeiger drehen eine schnelle, weiche Runde. */
  tipp() {
    if (this._zeit - this._letzterRuf > 1.6) {
      this._letzterRuf = this._zeit;
      sfx('common/kuckuck', { vol: 0.8 });
    }
    fx.pop(this.min, 0.05);
    if (this.dreht) return;
    this.dreht = true;
    const start = this.minute;
    const p = { t: 0 };
    this.szene.tween(p, { t: 1 }, 1.8, {
      ease: 'sineInOut',
      onUpdate: () => {
        this.minute = start + Math.PI * 2 * p.t;
        this._stelle();
      },
    }).then(() => { this.dreht = false; });
  }

  update(dt) {
    this._zeit += dt;
    if (this.dreht) return;
    // ganz langsam weiter (eine Runde in drei Minuten)
    this.minute += (dt * Math.PI * 2) / 180;
    this._stelle();
  }
}

// ---------------------------------------------------------------- Wolken

/**
 * Zwei, drei kleine Wolken ziehen sehr langsam von links nach rechts über den Himmel und blenden an den Enden
 * weich ein und aus. Antippen: kleines Wackeln und ein leises Wusch.
 */
export class Wolken {
  // Die Bahn endet vor der Album-Ecke oben rechts; die Wolken bleiben unter dem oberen 70er-Rand.
  constructor(szene, { parent, von = -260, bis = 860, z = -500 }) {
    this.szene = szene;
    this.von = von;
    this.bis = bis;
    this._letzterTon = -10;
    this._zeit = 0;
    this.liste = [
      { id: 'common/wolke2', y: 250, skala: 0.3, tempo: 11, x: 120 },
      { id: 'common/wolke3', y: 190, skala: 0.2, tempo: 8, x: 640 },
    ].map((w) => {
      const s = spr(w.id, { anchor: 0.5, x: w.x, y: w.y, scale: w.skala, parent, z });
      s.alpha = 0;
      s._tempo = w.tempo;
      tap(s, () => {
        fx.wobble(s, 0.03);
        // Wusch höchstens alle 0,8 s (Dauertippen stapelt keine Töne)
        if (this._zeit - this._letzterTon > 0.8) {
          this._letzterTon = this._zeit;
          sfx('common/wusch', { vol: 0.35 });
        }
      }, { sound: null, pad: 70 });
      return s;
    });
  }

  update(dt) {
    this._zeit += dt;
    const rand = 160;
    for (const s of this.liste) {
      if (s.destroyed) continue;
      s.x += s._tempo * dt;
      if (s.x > this.bis) s.x = this.von;
      // weich ein- und ausblenden an den Enden der Bahn
      s.alpha = 0.92 * clamp(Math.min(s.x - this.von, this.bis - s.x) / rand, 0, 1);
    }
  }
}
