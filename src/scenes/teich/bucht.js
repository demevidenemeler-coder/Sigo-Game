// Teich, Seite 3: Froschbucht (hg_bucht – stille Bucht mit flachem Ufer und zwei Steinen links unten)
// - Links: die Kinderstube (kinderstube.js) – Froschlaich, Kaulquappen füttern, kleine Frösche zum Chor bringen.
// - Rechts: der Froschchor auf fünf Seerosenblättern und das Froschkonzert mit der Libelle (konzert.js).
//   Der Chor wächst über die Besuche (Frösche aus der Kinderstube, Blüten aus den Konzerten).
// - Sonst: Wasser antippen → Wellenring, Ufer → Blätter rascheln, Wolken, ab und zu ein Vogel.

import { tap, rand, PIXI } from '../../engine/index.js';
import { Seite } from '../../gemeinsam/seiten.js';
import { ton, Ringe, Vogel, Wolken } from './deko.js';
import { Konzert } from './konzert.js';
import { Kinderstube } from './kinderstube.js';

const WASSER_OBEN = 590;
// Ufer links unten (Gras, Sand und Steine); rechts unten bleibt eine Ecke von 240×240 frei
const UFER = [-1420, 1110, -1160, 1135, -930, 1225, -790, 1350, -720, 1530, -1420, 1530];
const WASSER = [-1420, WASSER_OBEN, 1420, WASSER_OBEN, 1420, 1350, 1030, 1350, 1030, 1530, -720, 1530,
  -790, 1350, -930, 1225, -1160, 1135, -1420, 1110];

export class Bucht extends Seite {
  static hg = 'teich/hg_bucht';

  aufbau() {
    this.ringe = new Ringe(this, this.welt, { n: 8, z: 4 });
    const wasser = new PIXI.Container({ label: 'wasser' });
    wasser.zIndex = -100;
    this.welt.addChild(wasser);
    tap(wasser, (e) => this.wasserGetippt(e), { sound: null, squash: false, hitArea: new PIXI.Polygon(WASSER) });
    const ufer = new PIXI.Container({ label: 'ufer' });
    ufer.zIndex = -100;
    this.welt.addChild(ufer);
    tap(ufer, (e) => {
      this.burst('blaetter', e.x, e.y - 20, { count: 3 });
      ton('common/rascheln', { vol: 0.45 }, 0.5);
    }, { sound: null, squash: false, hitArea: new PIXI.Polygon(UFER) });

    this.konzert = new Konzert(this);
    this.stube = new Kinderstube(this, this.konzert);
    this.vogel = new Vogel(this, this.welt, { yBereich: [150, 300] });
    this.wolken = new Wolken(this, this.hinten, [
      { id: 'common/wolke1', x: -200, y: 170, breite: 300, tempo: 5 },
    ]);
  }

  wasserGetippt(e) {
    // ein abgetauchter Frosch (Konzert) klettert auch wieder hinauf, wenn man neben sein Blatt tippt
    const f = this.konzert.tauchFrosch;
    if (f) {
      const p = this.konzert.pads[f.pad];
      if (Math.hypot(e.x - (p.basis.x + 150), e.y - (p.basis.y + 70)) < 230) { this.konzert.tauchAuf(f); return; }
    }
    this.ringe.ring(e.x, e.y, 240);
    ton('common/platsch', { vol: 0.3, rate: rand(0.95, 1.1) }, 0.4);
  }

  betreten() {
    this.konzert.betreten();
  }

  verlassen() {
    this.konzert.verlassen();
  }

  update(dt, t) {
    this.konzert.update(dt, t);
    this.stube.update(dt, t);
    this.vogel.update(dt);
    this.wolken.update(dt);
  }

  hinweise() {
    // Konzert läuft: sein nächster Schritt zuerst
    const k = this.konzert.hinweis();
    if (k) return [k, k];
    const s = this.stube.hinweis();
    const l = this.konzert.libelleHinweis();
    const liste = [];
    if (s) liste.push(s, s);
    if (l) liste.push(l);
    const f = this.konzert.froschHinweis();
    if (f) liste.push(f);
    return liste;
  }
}
