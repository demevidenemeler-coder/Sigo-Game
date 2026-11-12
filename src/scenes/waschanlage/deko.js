// Kleine lebendige Nebensachen der Waschanlage – alle ruhig:
//   Wolken   zwei kleine Wolken ziehen langsam über den Himmel
//   Vogel    ein kleiner blauer Vogel sitzt auf der Mauer, pickt, hüpft; antippen → piept, hüpft, fliegt um
//   Falter   ein Schmetterling gaukelt gemächlich umher; antippen → flattert woandershin
// Vogel und Falter sind mit PIXI.Graphics gezeichnet (im Paket gibt es keine), weich und rund im Stil.

import { spr, tap, note, rand, pick, clamp, lerp, PIXI } from '../../engine/index.js';

const { Container, Graphics, Circle } = PIXI;

// ---------------------------------------------------------------- Wolken

export class Wolken {
  /** parent = Ebene hinter allem (über dem Hintergrund); von/bis = Strecke, an deren Enden sie weich verblassen */
  constructor(parent, { von = -600, bis = 1350, z = -500 } = {}) {
    this.von = von;
    this.bis = bis;
    this.liste = [
      { id: 'common/wolke2', y: 92, skala: 0.3, v: 9, x: rand(von + 200, 300), alpha: 0.85 },
      { id: 'common/wolke3', y: 120, skala: 0.15, v: 6.5, x: rand(500, bis - 200), alpha: 0.8 },
    ].map((w) => {
      const s = spr(w.id, { x: w.x, y: w.y, scale: w.skala, parent, z });
      s.eventMode = 'none';
      return { ...w, s };
    });
  }

  update(dt) {
    for (const w of this.liste) {
      w.x += w.v * dt;
      if (w.x > this.bis) w.x = this.von;
      const rand1 = clamp((w.x - this.von) / 260, 0, 1);
      const rand2 = clamp((this.bis - w.x) / 260, 0, 1);
      w.s.x = w.x;
      w.s.alpha = w.alpha * Math.min(rand1, rand2);
    }
  }
}

// ---------------------------------------------------------------- Vogel

function zeichneVogel() {
  const blau = 0x6fb0e6;
  const dunkel = 0x4c8dcc;
  const k = new Container({ label: 'vogelKoerper' });
  const beine = new Graphics()
    .roundRect(-7, -12, 5, 13, 2).fill(0xe39a3e)
    .roundRect(5, -12, 5, 13, 2).fill(0xe39a3e);
  const schwanz = new Graphics()
    .ellipse(-36, -36, 22, 10).fill(dunkel);
  schwanz.rotation = -0.35;
  schwanz.pivot.set(-20, -34);
  schwanz.position.set(-20, -34);
  const rumpf = new Graphics()
    .ellipse(0, -34, 34, 27).fill(blau)
    .ellipse(8, -26, 22, 16).fill(0xfbe6c2)
    .ellipse(-6, -42, 12, 6).fill({ color: 0xffffff, alpha: 0.25 });
  const kopf = new Graphics()
    .circle(22, -58, 19).fill(blau)
    .circle(17, -66, 6).fill({ color: 0xffffff, alpha: 0.25 })
    .circle(31, -51, 5).fill({ color: 0xff9aa8, alpha: 0.75 })
    .circle(28, -61, 4.6).fill(0x2b2433)
    .circle(29.6, -62.6, 1.6).fill(0xffffff)
    .poly([38, -60, 51, -55, 38, -50]).fill(0xf5b03c);
  const fluegel = new Graphics().ellipse(0, 0, 19, 11).fill(dunkel);
  fluegel.position.set(-8, -36);
  fluegel.rotation = -0.25;
  k.addChild(schwanz, rumpf, fluegel, kopf);
  return { k, beine, fluegel, kopf };
}

export class Vogel extends Container {
  /**
   * seite = Seite (für tween/after der Szene); stangen = [[x0, x1, y], …] – Strecken, auf denen er sitzen darf
   */
  constructor(seite, { stangen, parent, z = 5, scale = 1.1 }) {
    super({ label: 'vogel' });
    this.seite = seite;
    this.stangen = stangen;
    this.stange = 0;
    const [x0, x1, y] = stangen[0];
    this.position.set(lerp(x0, x1, 0.6), y);
    this.basis = scale;
    this.scale.set(scale);
    this.zIndex = z;
    const v = zeichneVogel();
    this.koerper = v.k;
    this.fluegel = v.fluegel;
    this.kopf = v.kopf;
    this.addChild(v.beine, v.k);
    parent.addChild(this);
    this.zeit = rand(0, 10);
    this.naechstes = rand(4, 7);
    this.fliegt = false;
    this.tipps = 0;
    tap(this, () => this.angetippt(), { sound: null, squash: false, hitArea: new Circle(0, -40, 120 / scale) });
  }

  zwitschern() {
    note('floete', 96, { dauer: 0.09, vol: 0.32 });
    this.seite.after(0.13, () => note('floete', 93, { dauer: 0.12, vol: 0.28 }));
  }

  angetippt() {
    this.zwitschern();
    this.tipps++;
    if (this.fliegt) return;
    if (this.tipps % 3 === 0 && this.stangen.length > 1) this.fliegeUm();
    else this.huepf(0);
  }

  // kleiner Hüpfer, dx = Weg zur Seite
  huepf(dx) {
    if (this.fliegt || this._huepft) return;
    this._huepft = true;
    const [x0, x1] = this.stangen[this.stange];
    const ziel = clamp(this.x + dx, x0, x1);
    if (dx) this.schaue(dx);
    const p = { t: 0 };
    const sx = this.x;
    const sy = this.stangen[this.stange][2];
    this.seite.tween(p, { t: 1 }, 0.36, {
      ease: 'linear',
      onUpdate: () => {
        this.x = lerp(sx, ziel, p.t);
        this.y = sy - Math.sin(p.t * Math.PI) * 26;
      },
    }).then(() => { this._huepft = false; this.y = sy; });
  }

  schaue(richtung) {
    this.scale.x = this.basis * (richtung < 0 ? -1 : 1);
  }

  picken() {
    const k = this.koerper;
    this.seite.tween(k, { rotation: this.scale.x > 0 ? 0.35 : 0.35 }, 0.18, { ease: 'sineInOut' })
      .then(() => this.seite.tween(k, { rotation: 0 }, 0.25, { ease: 'sineInOut' }));
  }

  // zur anderen Mauer-Strecke fliegen (ruhiger Bogen, Flügel schlagen gemächlich)
  fliegeUm() {
    this.fliegt = true;
    this.stange = (this.stange + 1) % this.stangen.length;
    const [x0, x1, y] = this.stangen[this.stange];
    const zx = rand(x0 + 40, x1 - 40);
    const sx = this.x;
    const sy = this.y;
    this.schaue(zx - sx);
    const p = { t: 0 };
    const hoehe = 180;
    this.seite.tween(p, { t: 1 }, 2.2, {
      ease: 'sineInOut',
      onUpdate: () => {
        this.x = lerp(sx, zx, p.t);
        this.y = lerp(sy, y, p.t) - Math.sin(p.t * Math.PI) * hoehe;
      },
    }).then(() => {
      this.fliegt = false;
      this.y = y;
      this.fluegel.rotation = -0.25;
    });
  }

  update(dt) {
    this.zeit += dt;
    // Atmen
    this.koerper.scale.y = 1 + Math.sin(this.zeit * 2.4) * 0.025;
    if (this.fliegt) {
      this.fluegel.rotation = -0.25 + Math.sin(this.zeit * 11) * 0.7;
      return;
    }
    this.naechstes -= dt;
    if (this.naechstes <= 0) {
      this.naechstes = rand(5, 10);
      const was = Math.random();
      if (was < 0.4) this.picken();
      else if (was < 0.8) this.huepf(pick([-1, 1]) * rand(40, 80));
      else this.schaue(-Math.sign(this.scale.x));
    }
  }
}

// ---------------------------------------------------------------- Schmetterling

function fluegelPaar(farbe, farbe2) {
  const g = new Graphics()
    .ellipse(-22, -14, 22, 17).fill(farbe)
    .ellipse(22, -14, 22, 17).fill(farbe)
    .ellipse(-16, 12, 15, 12).fill(farbe2)
    .ellipse(16, 12, 15, 12).fill(farbe2)
    .circle(-24, -16, 6).fill({ color: 0xffffff, alpha: 0.55 })
    .circle(24, -16, 6).fill({ color: 0xffffff, alpha: 0.55 });
  return g;
}

export class Falter extends Container {
  /** bereich = {x0, x1, y0, y1}: dort gaukelt er herum */
  constructor(seite, { bereich, parent, z = 70, scale = 1.25 }) {
    super({ label: 'falter' });
    this.seite = seite;
    this.bereich = bereich;
    this.fluegel = fluegelPaar(0xffb0c4, 0xffd59e);
    const rumpf = new Graphics()
      .ellipse(0, 0, 5, 20).fill(0x5a4660)
      .circle(0, -22, 6).fill(0x5a4660);
    const fuehler = new Graphics()
      .moveTo(-2, -26).quadraticCurveTo(-8, -40, -13, -42)
      .moveTo(2, -26).quadraticCurveTo(8, -40, 13, -42)
      .stroke({ width: 2.5, color: 0x5a4660 });
    this.addChild(this.fluegel, rumpf, fuehler);
    this.scale.set(scale);
    this.zIndex = z;
    this.position.set(rand(bereich.x0, bereich.x1), rand(bereich.y0, bereich.y1));
    this.ziel = this.neuesZiel();
    this.tempo = 55;
    this.eile = 0;
    this.rast = 0;
    this.zeit = rand(0, 10);
    parent.addChild(this);
    tap(this, () => this.angetippt(), { sound: null, squash: false, hitArea: new Circle(0, 0, 115 / scale) });
  }

  neuesZiel(weit = false) {
    const b = this.bereich;
    for (let i = 0; i < 8; i++) {
      const z = { x: rand(b.x0, b.x1), y: rand(b.y0, b.y1) };
      if (!weit || Math.hypot(z.x - this.x, z.y - this.y) > 400) return z;
    }
    return { x: rand(b.x0, b.x1), y: rand(b.y0, b.y1) };
  }

  angetippt() {
    note('pling', pick([84, 86, 88]), { vol: 0.25 });
    this.ziel = this.neuesZiel(true);
    this.rast = 0;
    this.eile = 1.6;
  }

  update(dt) {
    this.zeit += dt;
    this.eile = Math.max(0, this.eile - dt);
    const flattern = this.rast > 0 ? 3.2 : 6.5;
    this.fluegel.scale.x = 0.35 + 0.65 * Math.abs(Math.cos(this.zeit * flattern));
    if (this.rast > 0) {
      this.rast -= dt;
      return;
    }
    const dx = this.ziel.x - this.x;
    const dy = this.ziel.y - this.y;
    const d = Math.hypot(dx, dy);
    if (d < 12) {
      this.ziel = this.neuesZiel();
      this.rast = Math.random() < 0.5 ? rand(1.5, 4) : 0;
      return;
    }
    const v = this.tempo * (this.eile > 0 ? 2.2 : 1);
    const s = Math.min(d, v * dt);
    this.x += (dx / d) * s;
    this.y += (dy / d) * s + Math.sin(this.zeit * 3.1) * 22 * dt;
    this.rotation = clamp(dx / d, -1, 1) * 0.18;
  }
}
