// Kundschaft: Tiere kommen von links herein, warten an ihrem Platz, freuen sich und gehen winkend wieder.
// Immer nur ein wartender Kunde je Seite. Der nächste macht sich schon auf den Weg, wenn der vorige fast draußen
// ist – sie begegnen sich außerhalb des Bildes, und das Kind wartet nicht lange.

import { Actor, fx, shuffle } from '../../engine/index.js';

const TIERE = [
  'hase', 'katze', 'hund', 'baer', 'fuchs', 'schwein', 'maus', 'igel', 'eichhoernchen', 'pinguin',
  'ente', 'frosch', 'affe', 'schaf', 'loewe', 'pferd', 'huhn', 'elefant', 'giraffe', 'kuh',
];

const DRAUSSEN = -1560;   // Standard: hier beginnen und enden die Wege (links außerhalb des Bildes)

export class Kundschaft {
  /**
   * @param seite  die Seite (für Zeit und Ebenen)
   * @param opt    {x, y, scale, z, tempo, draussen = -1560 (wo die Wege beginnen/enden), onTipp(actor)}
   */
  constructor(seite, opt) {
    this.seite = seite;
    this.x = opt.x;
    this.y = opt.y;
    this.scale = opt.scale ?? 0.6;
    this.z = opt.z ?? 20;
    this.tempo = opt.tempo ?? 400;
    this.onTipp = opt.onTipp;
    this.draussen = opt.draussen ?? DRAUSSEN;
    this.actor = null;
    this.bereit = false;      // steht am Platz und wartet
    this.reihe = [];
    this.letzter = null;
    this.letzterLaut = 0;
  }

  naechstesTier() {
    if (!this.reihe.length) {
      this.reihe = shuffle(TIERE.slice());
      if (this.reihe[0] === this.letzter) this.reihe.push(this.reihe.shift());
    }
    this.letzter = this.reihe.shift();
    return this.letzter;
  }

  /** Neuer Kunde läuft herein. → Promise<boolean> (true = steht am Platz) */
  async kommt() {
    const id = this.naechstesTier();
    const a = new Actor(id, { x: this.draussen, y: this.y, scale: this.scale, parent: this.seite.welt, z: this.z });
    a.onTap(() => this.tipp(a), { pad: 30 });
    this.actor = a;
    this.bereit = false;
    const ok = await a.walkTo(this.x, this.y, { tempo: this.tempo });
    if (!ok || a.destroyed || this.actor !== a) return false;
    this.bereit = true;
    return true;
  }

  /** Tierlaut, aber nicht öfter als alle 1,2 s (kein Lärm bei Dauertippen). */
  laut(a = this.actor) {
    const jetzt = performance.now();
    if (!a || a.destroyed || jetzt - this.letzterLaut < 1200) return;
    this.letzterLaut = jetzt;
    a.sound();
  }

  tipp(a) {
    fx.wobble(a, 0.06);
    this.laut(a);
    this.onTipp?.(a);
  }

  /**
   * Freut sich: Pose happy, Hüpfer, ein paar Herzen (an der Seite, gleiten beim Blättern mit), Laut.
   * gross = besonders große Freude (mehr Herzen, höherer Hüpfer).
   */
  async freut(gross = false) {
    const a = this.actor;
    if (!a || a.destroyed) return;
    a.pose('happy');
    this.letzterLaut = 0;
    this.laut(a);
    const kopf = a.point('kopf');
    this.seite.burst('herzen', kopf.x, kopf.y + 40, { count: gross ? 8 : 5 });
    await a.hop(gross ? 95 : 70);
    if (gross) {
      await this.seite.wait(0.15);
      await a.hop(60);
    }
    await this.seite.wait(0.5);
    if (!a.destroyed && a.poseName === 'happy') a.pose('idle');
  }

  /**
   * Winkt (fröhliches Wiegen) und geht wieder hinaus (dorthin, wo es herkam).
   * → Promise, sobald der Kunde fast draußen ist (dann darf der nächste kommen); er läuft allein zu Ende.
   */
  async geht() {
    const a = this.actor;
    this.actor = null;
    this.bereit = false;
    if (!a || a.destroyed) return;
    a.pose('happy');
    // Winken: einmal sanft hin und her wiegen
    const k = a.huelle;
    await this.seite.tween(k, { rotation: 0.08 }, 0.22, { ease: 'sineInOut' });
    await this.seite.tween(k, { rotation: -0.07 }, 0.34, { ease: 'sineInOut' });
    await this.seite.tween(k, { rotation: 0 }, 0.22, { ease: 'sineInOut' });
    if (a.destroyed) return;
    a.pose('idle');
    const weg = a.walkTo(this.draussen, a.y, { tempo: this.tempo })
      .then(() => { if (!a.destroyed) a.destroy({ children: true }); });
    // Fast draußen (noch gut 110 Einheiten): Der Neue startet ganz außen – beide sind dann außerhalb des Bildes.
    const rest = Math.max(0, Math.abs(this.draussen - a.x) - 110);
    await Promise.race([weg, this.seite.wait(rest / this.tempo)]);
  }
}
