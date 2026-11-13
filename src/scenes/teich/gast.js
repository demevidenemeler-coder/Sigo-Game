// Teich, Seite 1: ab und zu kommt ein Gast über das mittlere Wasser geschwommen – ein Schwan oder eine
// Schildkröte (immer abwechselnd). Ablauf:
//   1. Der Gast schwimmt herein und hält in der Mitte an; eine Denkblase zeigt Brotkrümel.
//   2. Krümel vom Brot zum Gast ziehen (oder das Brot antippen – der Krümel fliegt dann zu ihm).
//   3. Der Gast frisst und freut sich (Herzen, Hüpfer).
//   4. Abschied je Gast anders: Der Schwan schwimmt davon und lässt eine Feder auf dem Wasser zurück (antippen:
//      Funkeln). Die Schildkröte bedankt sich mit einem Sticker und taucht ab.
// Bekommt der Gast nichts, schwimmt er nach einer Weile freundlich weiter. Nichts kann schiefgehen.

import { spr, tap, fx, note, store, killTweensOf, rand, pick, PIXI } from '../../engine/index.js';
import { belohne } from '../../gemeinsam/sticker.js';
import { ton, naechsterSticker, flugDauer } from './deko.js';

const GY = 950;                       // Bahn der Gäste: zwischen den Enten (hinten) und den Seerosen (vorn)
const ARTEN = {
  schwan: { bild: 'teich/schwan', faktor: 1.15 },
  schildkroete: { bild: 'teich/schildkroete', faktor: 1.3 },
};
const WARTEN = 30;                    // so lange wartet ein Gast auf Krümel, dann schwimmt er weiter

export class Gast {
  constructor(seite) {
    this.seite = seite;
    this.zustand = 'weg';             // weg | kommt | wartet | frisst | geht
    this.uhr = rand(22, 32);
    this.letzter = store.get('teich.gastLetzter', null);
    this.erzwinge = null;             // nur zum Testen: 'schwan' | 'schildkroete'
    this.w = null;
    this.feder = null;
    this.besuche = 0;
  }

  get wartet() { return this.zustand === 'wartet'; }

  // ---------------------------------------------------------------- Kommen

  komm() {
    this.art = ARTEN[this.erzwinge] ? this.erzwinge
      : pick(Object.keys(ARTEN).filter((a) => a !== this.letzter));
    this.letzter = this.art;
    store.set('teich.gastLetzter', this.art);
    const a = ARTEN[this.art];
    const w = this.seite.schwimmer(a.bild, 1340, GY, a.faktor, -1);
    w.c.alpha = 0;
    this.seite.tween(w.c, { alpha: 1 }, 1.2, { ease: 'sineInOut' });
    tap(w.c, () => this.getippt(), { sound: null, squash: false, hitArea: new PIXI.Rectangle(-150, -240, 300, 270) });
    this.w = w;
    this.ziel = rand(10, 210);   // über dem mittleren, tiefer liegenden Seerosenblatt: nichts verdeckt den Gast
    this.zustand = 'kommt';
    this.besuche++;
  }

  getippt() {
    const w = this.w;
    if (!w) return;
    this.seite.ringe.ring(w.x, w.y, 300 * w.s);
    if (this.art === 'schwan') {
      note('floete', pick([79, 84]), { vol: 0.35 });
      this.seite.huepfer(w, 30);
    } else {
      // die Schildkröte zieht kurz den Kopf ein (duckt sich ins Wasser)
      ton('common/blubber', { vol: 0.45 }, 0.4);
      killTweensOf(w.hops);
      this.seite.tween(w.hops, { y: 26 }, 0.25, { ease: 'sineInOut' })
        .then((ok) => { if (ok) this.seite.tween(w.hops, { y: 0 }, 0.6, { ease: 'backOut' }); });
    }
    if (this.wartet) this.blase();
  }

  // ---------------------------------------------------------------- Krümel

  /** Ein Krümel wurde bei (x, y) losgelassen: trifft er den wartenden Gast, frisst er ihn. → true */
  nimmKruemel(k, x, y) {
    const w = this.w;
    if (!this.wartet || !w) return false;
    if (Math.abs(x - w.x) > 230 || y < w.y - 330 || y > w.y + 90) return false;
    this.friss(k);
    return true;
  }

  /** Brot nur angetippt: wartet ein Gast, fliegt der Krümel zu ihm. → true */
  wirfZu(k) {
    if (!this.wartet) return false;
    this.friss(k);
    return true;
  }

  maul() {
    const w = this.w;
    return this.art === 'schwan'
      ? { x: w.x - 130 * w.s, y: w.y - 290 * w.s }
      : { x: w.x - 150 * w.s, y: w.y - 150 * w.s };
  }

  friss(k) {
    this.zustand = 'frisst';
    this.blaseWeg();
    const z = this.maul();
    const x0 = k.x;
    const y0 = k.y;
    const p = { t: 0 };
    killTweensOf(k);
    k.zIndex = 5000;
    this.seite.tween(p, { t: 1 }, flugDauer(z.x - x0, z.y - y0, { hoehe: 160, min: 0.6, v: 1000 }), {
      ease: 'linear',
      onUpdate: () => {
        if (k.destroyed) return;
        k.x = x0 + (z.x - x0) * p.t;
        k.y = y0 + (z.y - y0) * p.t - 160 * 4 * p.t * (1 - p.t);
      },
    }).then(() => {
      if (!k.destroyed) {
        this.seite.tween(k, { alpha: 0 }, 0.3, { ease: 'sineInOut' }).then(() => { if (!k.destroyed) k.destroy(); });
      }
      ton('common/mampf', { vol: 0.65 }, 0.2);
      const w = this.w;
      if (!w) return;
      this.seite.after(0.5, () => {
        this.seite.burst('herzen', w.x, w.y - 260 * w.s, { count: 5 });
        this.seite.huepfer(w, 30);
        note('glocke', 84, { vol: 0.35 });
      });
      this.seite.after(1.8, () => this.abschied());
    });
  }

  abschied() {
    const w = this.w;
    if (!w) return;
    if (this.art === 'schwan') {
      // eine Feder bleibt auf dem Wasser zurück
      this.legeFeder(w.x + 40, w.y + 10);
      this.zustand = 'geht';
    } else {
      belohne(this.seite, naechsterSticker('teich_schildkroete', ['teich_schildkroete']), 0, 400);
      // die Schildkröte taucht ab
      this.zustand = 'taucht';
      this.seite.after(1.2, () => {
        ton('common/blubber', { vol: 0.5 }, 0.3);
        this.seite.burst('blasen', w.x, w.y - 40, { count: 5 });
        this.seite.ringe.ring(w.x, w.y, 320 * w.s / 0.5);
        this.seite.tween(w.hops, { y: 60 }, 1.4, { ease: 'sineInOut' });
        this.seite.tween(w.c, { alpha: 0 }, 1.4, { ease: 'sineInOut' }).then(() => this.fort());
      });
    }
  }

  legeFeder(x, y) {
    if (this.feder && !this.feder.destroyed) this.feder.destroy();
    const f = spr('teich/feder', { parent: this.seite.welt, anchor: 0.5, x, y });
    f.scale.set(0.42);
    f.zIndex = y + 2;
    f.alpha = 0;
    f.basis = { x, y };
    this.seite.tween(f, { alpha: 1 }, 0.8, { ease: 'sineInOut' });
    tap(f, () => {
      fx.wobble(f, 0.15);
      note('glocke', pick([88, 91, 96]), { vol: 0.3 });
      this.seite.burst('funkeln', f.x, f.y - 20, { count: 4 });
    }, { sound: null, squash: false, hitArea: new PIXI.Rectangle(-260, -260, 520, 520) });
    this.feder = f;
    // nach einer Weile treibt sie davon
    this.seite.after(25, () => {
      if (f.destroyed) return;
      this.seite.tween(f, { alpha: 0 }, 1.5, { ease: 'sineInOut' }).then(() => { if (!f.destroyed) f.destroy(); });
    });
  }

  fort() {
    if (this.w && !this.w.c.destroyed) this.w.c.destroy({ children: true });
    this.w = null;
    this.blaseWeg();
    this.zustand = 'weg';
    this.uhr = rand(40, 60);
  }

  // ---------------------------------------------------------------- Denkblase

  blase() {
    this.blaseWeg();
    const w = this.w;
    const c = new PIXI.Container({ label: 'gast:blase' });
    const grund = spr('common/blase_denk', { parent: c, anchor: { x: 0.1, y: 0.95 } });
    grund.scale.set(250 / grund.texture.width);
    const b = spr('teich/kruemel', { parent: c, anchor: 0.5 });
    b.scale.set(115 / Math.max(b.texture.width, b.texture.height));
    b.position.set(grund.width * 0.48, -grund.height * 0.52);
    c.position.set(w.x + 30, w.y - 300 * w.s / 0.5 * 0.55);
    c.zIndex = 3000;
    c.alpha = 0;
    c.scale.set(0.6);
    c.eventMode = 'none';
    this.seite.welt.addChild(c);
    this._blase = c;
    this.seite.tween(c, { alpha: 1 }, 0.35, { ease: 'sineInOut' });
    this.seite.tween(c, { scale: 1 }, 0.45, { ease: 'backOut' });
    this.seite.after(3.5, () => this.blaseWeg(c));
  }

  blaseWeg(nur = null) {
    const c = this._blase;
    if (!c || c.destroyed || (nur && nur !== c)) return;
    this._blase = null;
    this.seite.tween(c, { alpha: 0 }, 0.45, { ease: 'sineInOut' }).then(() => { if (!c.destroyed) c.destroy({ children: true }); });
  }

  // ---------------------------------------------------------------- Bild für Bild

  update(dt, t) {
    const s = this.seite;
    if (this.zustand === 'weg') {
      // nur, wenn die Seite zu sehen ist und gerade keine Nest-Runde Brot braucht
      if (s.aktiv) this.uhr -= dt;
      if (this.uhr <= 0 && s.nest.phase !== 'hunger') this.komm();
      return;
    }
    const w = this.w;
    if (!w) return;
    let vx = 0;
    if (this.zustand === 'kommt') {
      const d = this.ziel - w.x;
      vx = Math.sign(d) * Math.min(70, Math.abs(d) * 1.2);
      if (Math.abs(d) < 3) {
        this.zustand = 'wartet';
        this.wartezeit = 0;
        this.blasenUhr = 0;
      }
    } else if (this.zustand === 'wartet') {
      this.wartezeit += dt;
      this.blasenUhr -= dt;
      if (this.blasenUhr <= 0) { this.blasenUhr = 7; this.blase(); }
      if (this.wartezeit > WARTEN) this.zustand = 'geht';
    } else if (this.zustand === 'geht') {
      vx = -60;
      if (w.x < -1250 && !this.blendet) {
        this.blendet = true;
        s.tween(w.c, { alpha: 0 }, 1.2, { ease: 'sineInOut' }).then(() => { this.blendet = false; this.fort(); });
      }
    }
    w.x += vx * dt;
    s.dreheSchwimmer(w, vx === 0 ? -1 : vx, dt);
    s.setzeSchwimmer(w, t);
    if (this.feder && !this.feder.destroyed) {
      const f = this.feder;
      f.y = f.basis.y + Math.sin(t * 1.4) * 4;
      f.rotation = Math.sin(t * 0.9) * 0.15;
    }
    if (this._blase && !this._blase.destroyed) this._blase.x = w.x + 30;
  }

  /** Ziel der Zeige-Hand (Brot → Gast), solange er wartet */
  hinweis() {
    return this.wartet && this.w ? { von: this.seite.brot, nach: this.w.c } : null;
  }
}
