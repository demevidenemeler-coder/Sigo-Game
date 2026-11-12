// Wasserstrahl im Bogen: eine Kette aus Stücken (feuerwehr/wasserstrahl_stueck) entlang einer Kurve von der
// Düse zum Ziel. Die Stücke gleiten langsam die Kurve entlang (fließendes Wasser). Ein- und Ausschalten weich:
// beim Einschalten wächst der Strahl aus der Düse, beim Ausschalten löst sich sein Anfang von der Düse und
// das Ende fliegt davon, dabei wird er blasser.
// Keine Objekte pro Bild: alle Stücke entstehen einmal.

import { spr, clamp, lerp, PIXI } from '../../engine/index.js';

const STUECKE = 28;

export class Wasserstrahl {
  constructor({ parent, z = 60, dicke = 70, bogen = 0.28 }) {
    this.c = new PIXI.Container({ label: 'wasserstrahl' });
    this.c.zIndex = z;
    this.c.eventMode = 'none';
    parent.addChild(this.c);
    this.dicke = dicke;
    this.bogen = bogen;
    this.teile = [];
    for (let i = 0; i < STUECKE; i++) {
      const s = spr('feuerwehr/wasserstrahl_stueck', { parent: this.c });
      s.anchor.set(0.5);
      s.visible = false;
      this.teile.push(s);
    }
    // fester Ansatz an der Düse, damit der Strahl sichtbar aus ihr herauskommt
    this.ansatz = spr('feuerwehr/wasserstrahl_stueck', { parent: this.c });
    this.ansatz.anchor.set(0.15, 0.5);
    this.ansatz.visible = false;
    this.start = { x: 0, y: 0 };
    this.ziel = { x: 0, y: 0 };
    this.an = false;
    this.vorn = 0;    // 0…1: so weit reicht der Strahl (Einschalten)
    this.hinten = 0;  // 0…1: ab hier beginnt er (Ausschalten: das Ende fliegt davon)
    this.fluss = 0;
    this._p = { x: 0, y: 0 };
    this._q = { x: 0, y: 0 };
  }

  /** Strahl ein/aus (weich). */
  setze(an) {
    if (an && !this.an) {
      this.vorn = this.hinten >= 1 ? 0 : Math.min(this.vorn, 0.05);
      this.hinten = 0;
    }
    this.an = an;
  }

  /** Ist (noch) etwas vom Strahl zu sehen? */
  get sichtbar() {
    return this.an || this.hinten < 1;
  }

  /** Erreicht der Strahl schon das Ziel? */
  get trifft() {
    return this.an && this.vorn > 0.97;
  }

  /** Erreicht der Strahl (fast) den Punkt p? (Ziel folgt dem Finger weich nach) */
  nahe(p, abstand = 60) {
    return Math.hypot(this.ziel.x - p.x, this.ziel.y - p.y) < abstand;
  }

  // Punkt auf der Kurve (quadratisch, Kontrollpunkt über der Mitte)
  _kurve(t, aus) {
    const a = this.start;
    const b = this.ziel;
    const d = Math.hypot(b.x - a.x, b.y - a.y);
    const kx = (a.x + b.x) / 2;
    const ky = Math.min(a.y, b.y) - d * this.bogen - 40;
    const q = 1 - t;
    aus.x = q * q * a.x + 2 * q * t * kx + t * t * b.x;
    aus.y = q * q * a.y + 2 * q * t * ky + t * t * b.y;
    return aus;
  }

  update(dt) {
    if (this.an) {
      // ≈ 0,17 s bis zum Ziel: schnell genug, dass schon ein kurzes Antippen trifft, aber sichtbar wachsend
      this.vorn = Math.min(1, this.vorn + dt * 6);
      this.hinten = 0;
    } else if (this.hinten < 1) {
      this.vorn = Math.min(1, this.vorn + dt * 4.5);
      this.hinten = Math.min(1, this.hinten + dt * 3.2);
    }
    const sichtbar = this.sichtbar && this.vorn > 0.001;
    this.c.visible = sichtbar;
    if (!sichtbar) return;
    this.fluss = (this.fluss + dt * 1.4) % 1;
    const von = this.hinten;
    const bis = this.vorn;
    const n = this.teile.length;
    const p = this._p;
    const q = this._q;
    const laenge = Math.hypot(this.ziel.x - this.start.x, this.ziel.y - this.start.y) * (1 + this.bogen) / n;
    const blass = this.an ? 1 : 1 - this.hinten * 0.6;
    for (let i = 0; i < n; i++) {
      const s = this.teile[i];
      // gleichmäßig verteilte Stücke, die langsam zum Ziel hin wandern
      const t = (i + this.fluss) / n;
      if (t < von || t > bis) {
        s.visible = false;
        continue;
      }
      this._kurve(t, p);
      this._kurve(Math.min(1, t + 0.02), q);
      s.visible = true;
      s.position.set(p.x, p.y);
      s.rotation = Math.atan2(q.y - p.y, q.x - p.x);
      const dick = this.dicke * lerp(0.8, 1.15, t);
      s.scale.set(Math.max(0.05, (laenge * 1.9) / 500), dick / 195);
      // Ende weich; der Anfang nur weich, wenn er sich beim Ausschalten von der Düse löst
      const anfang = von > 0 ? (t - von) / 0.06 : 1;
      const rand = clamp(Math.min(anfang, (bis - t) / 0.05, 1), 0, 1);
      s.alpha = 0.92 * rand * blass;
    }
    // Ansatz an der Düse (nur solange der Strahl noch an der Düse hängt)
    const a = this.ansatz;
    if (von > 0.02 || bis < 0.04) {
      a.visible = false;
      return;
    }
    this._kurve(0.035, q);
    a.visible = true;
    a.position.set(this.start.x, this.start.y);
    a.rotation = Math.atan2(q.y - this.start.y, q.x - this.start.x);
    const l = Math.hypot(q.x - this.start.x, q.y - this.start.y);
    a.scale.set(Math.max(0.08, (l * 1.6) / 500), (this.dicke * 0.8) / 195);
    a.alpha = 0.92 * blass;
  }
}
