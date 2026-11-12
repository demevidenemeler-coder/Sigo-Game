// Kundschaft: Tiere kommen von links (bzw. rechts) herein, warten an ihrem Platz, freuen sich und gehen winkend wieder.
// Immer nur ein wartender Kunde je Seite. Der nächste macht sich schon auf den Weg, wenn der vorige fast draußen
// ist – sie begegnen sich außerhalb des Bildes, und das Kind wartet nicht lange.
// Überraschung: Ab und zu bringt ein Kunde sein Kleines mit (dasselbe Tier, kleiner) – es läuft hinterher,
// steht daneben, freut sich mit und geht mit hinaus.

import { Actor, fx, shuffle } from '../../engine/index.js';

export const TIERE = [
  'hase', 'katze', 'hund', 'baer', 'fuchs', 'schwein', 'maus', 'igel', 'eichhoernchen', 'pinguin',
  'ente', 'frosch', 'affe', 'schaf', 'loewe', 'pferd', 'huhn', 'elefant', 'giraffe', 'kuh',
];

const DRAUSSEN = -1560;   // Standard: hier beginnen und enden die Wege (links außerhalb des Bildes)

export class Kundschaft {
  /**
   * @param seite  die Seite (für Zeit und Ebenen)
   * @param opt    {x, y, scale, z, tempo, draussen = -1560 (wo die Wege beginnen/enden), onTipp(actor),
   *                kleinDx (wo das Kleine neben dem Kunden steht, Standard -200),
   *                kleinPad (Rand der Tippfläche des Kleinen, Standard 70 – kleiner, wenn daneben etwas Antippbares liegt)}
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
    this.kleinDx = opt.kleinDx ?? -200;
    this.kleinPad = opt.kleinPad ?? 70;
    this.actor = null;
    this.klein = null;        // das mitgebrachte Kleine (oder null)
    this.bereit = false;      // steht am Platz und wartet
    this.reihe = [];
    this.letzter = null;
    this.letzterLaut = 0;
    this.besuche = 0;
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
    this.besuche++;
    const a = new Actor(id, { x: this.draussen, y: this.y, scale: this.scale, parent: this.seite.welt, z: this.z });
    a.onTap(() => this.tipp(a), { pad: 30 });
    this.actor = a;
    this.bereit = false;
    // ab dem dritten Kunden ab und zu mit Kleinem (nie zweimal hintereinander)
    this.klein = null;
    if (this.besuche >= 3 && !this.letztesMalKlein && Math.random() < 0.3) {
      const richtung = Math.sign(this.x - this.draussen) || 1;
      const k = new Actor(id, {
        x: this.draussen - richtung * 220, y: this.y, scale: this.scale * 0.55, parent: this.seite.welt, z: this.z + 1,
      });
      k.onTap(() => this.tipp(k), { pad: this.kleinPad });
      this.klein = k;
      k.walkTo(this.x + this.kleinDx, this.y, { tempo: this.tempo * 1.1 });
    }
    this.letztesMalKlein = !!this.klein;
    a.kleines = this.klein;     // das Kleine gehört zu diesem Tier (auch, wenn schon das nächste kommt)
    let ok = await a.walkTo(this.x, this.y, { tempo: this.tempo });
    // Unterbrochen (etwa von einem Hüpfer)? Dann nach einem Augenblick weiterlaufen – nie auf halbem Weg stehen bleiben.
    for (let i = 0; !ok && i < 8 && !a.destroyed && this.actor === a; i++) {
      await this.seite.wait(0.4);
      if (a.destroyed || this.actor !== a) break;
      ok = await a.walkTo(this.x, this.y, { tempo: this.tempo });
    }
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
   * gross = besonders große Freude (mehr Herzen, höherer Hüpfer). Das Kleine hüpft mit.
   * a = das Tier, das sich freut (Standard: der jetzige Kunde) – so hüpft nie aus Versehen schon der nächste.
   */
  async freut(gross = false, a = this.actor) {
    if (!a || a.destroyed) return;
    a.pose('happy');
    this.letzterLaut = 0;
    this.laut(a);
    const kopf = a.point('kopf');
    this.seite.burst('herzen', kopf.x, kopf.y + 40, { count: gross ? 8 : 5 });
    const k = a.kleines;
    if (k && !k.destroyed) {
      k.pose('happy');
      this.seite.after(0.25, () => { if (!k.destroyed) k.hop(50); });
    }
    await a.hop(gross ? 95 : 70);
    if (gross) {
      await this.seite.wait(0.15);
      await a.hop(60);
    }
    await this.seite.wait(0.5);
    if (!a.destroyed && a.poseName === 'happy') a.pose('idle');
    if (k && !k.destroyed && k.poseName === 'happy') k.pose('idle');
  }

  /**
   * Winkt (fröhliches Wiegen) und geht wieder hinaus (dorthin, wo es herkam).
   * → Promise, sobald der Kunde fast draußen ist (dann darf der nächste kommen); er läuft allein zu Ende.
   */
  async geht() {
    const a = this.actor;
    const k = this.klein;
    this.actor = null;
    this.klein = null;
    this.bereit = false;
    if (!a || a.destroyed) return;
    a.pose('happy');
    // Winken: einmal sanft hin und her wiegen
    const h = a.huelle;
    await this.seite.tween(h, { rotation: 0.08 }, 0.22, { ease: 'sineInOut' });
    await this.seite.tween(h, { rotation: -0.07 }, 0.34, { ease: 'sineInOut' });
    await this.seite.tween(h, { rotation: 0 }, 0.22, { ease: 'sineInOut' });
    if (a.destroyed) return;
    a.pose('idle');
    if (k && !k.destroyed) {
      k.pose('idle');
      k.walkTo(this.draussen, k.y, { tempo: this.tempo }).then(() => { if (!k.destroyed) k.destroy({ children: true }); });
    }
    const weg = a.walkTo(this.draussen, a.y, { tempo: this.tempo })
      .then(() => { if (!a.destroyed) a.destroy({ children: true }); });
    // Fast draußen (noch gut 110 Einheiten): Der Neue startet ganz außen – beide sind dann außerhalb des Bildes.
    const rest = Math.max(0, Math.abs(this.draussen - a.x) - 110);
    await Promise.race([weg, this.seite.wait(rest / this.tempo)]);
  }
}
