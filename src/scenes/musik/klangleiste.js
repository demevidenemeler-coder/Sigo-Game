// Klangleiste: eine Reihe nebeneinanderliegender Klang-Felder (Xylophon-Stäbe, Klaviertasten), die man antippen
// UND mit dem Finger überstreichen kann. Jeder Finger zählt für sich: Beim Berühren erklingt das Feld darunter,
// beim Streichen jedes Feld einmal beim Betreten. Felder grenzen lückenlos aneinander (kein toter Spalt).
//
//   const leiste = new Klangleiste(container, {
//     felder: [{x0, x1}, …],     // waagrechte Grenzen in lokalen Koordinaten von container (links → rechts)
//     y0, y1,                     // senkrechte Grenzen (gemeinsam für alle Felder)
//     onSpiel: (i, pointerId) => { … },
//     darf: () => true,           // ob die Leiste gerade spielbar ist (Seite sichtbar, Instrument gewählt)
//   });
//   leiste.loslassen();           // alle Finger vergessen (beim Wegblättern, Instrumentwechsel)
//   leiste.abbauen();             // Fenster-Listener entfernen (beim Verlassen der Szene – Pflicht!)
//
// Technik: Das Berühren kommt als Pixi-'pointerdown' auf dem Container (achtet auf Sperren und darüberliegende
// Dinge). Das Streichen kommt über eigene Fenster-Listener (pointermove/-up/-cancel), weil der Spielkern
// Pixis Bewegungs-Ereignisse abgeschaltet hat. Die Listener baut abbauen() wieder ab; wird der Container
// zerstört, bauen sie sich beim nächsten Ereignis selbst ab.

import { stage, PIXI } from '../../engine/index.js';

const NOCHMAL_AB = 0.07; // dasselbe Feld frühestens nach 70 ms erneut (zwei Finger zugleich)

export class Klangleiste {
  constructor(container, { felder, y0, y1, onSpiel, darf = () => true, rand = 30 }) {
    this.c = container;
    this.felder = felder;
    this.y0 = y0 - rand;
    this.y1 = y1 + rand;
    this.x0 = felder[0].x0 - rand;
    this.x1 = felder[felder.length - 1].x1 + rand;
    this.onSpiel = onSpiel;
    this.darf = darf;
    this.finger = new Map();     // pointerId → Feld (oder -1)
    this.zuletzt = felder.map(() => -1);
    this.p = new PIXI.Point();
    this.g = new PIXI.Point();

    container.eventMode = 'static';
    container.hitArea = new PIXI.Rectangle(this.x0, this.y0, this.x1 - this.x0, this.y1 - this.y0);

    this._unten = (e) => {
      if (!this.spielbar()) return;
      e.stopPropagation();
      const i = this.feldBei(e.global);
      this.finger.set(e.pointerId, i);
      if (i >= 0) this.spiel(i, e.pointerId);
    };
    this._bewegt = (ev) => {
      if (this.c.destroyed) {
        this.abbauen();
        return;
      }
      const gedrueckt = ev.pointerType === 'touch' || (ev.buttons & 1) === 1;
      const id = ev.pointerId;
      if (!gedrueckt) {
        this.finger.delete(id);
        return;
      }
      if (!this.spielbar()) return;
      const i = this.feldBei(this.global(ev));
      if (!this.finger.has(id)) {
        // Finger kam von außen hereingestrichen: zählt wie Betreten
        if (i < 0) return;
        if (this.finger.size > 10) this.finger.clear(); // verlorene Finger nicht ewig sammeln
      } else if (this.finger.get(id) === i) {
        return;
      }
      this.finger.set(id, i);
      if (i >= 0) this.spiel(i, id);
    };
    this._oben = (ev) => {
      this.finger.delete(ev.pointerId);
    };
    container.on('pointerdown', this._unten);
    window.addEventListener('pointermove', this._bewegt, { passive: true });
    window.addEventListener('pointerup', this._oben, { passive: true });
    window.addEventListener('pointercancel', this._oben, { passive: true });
    this.verbunden = true;
  }

  spielbar() {
    if (this.c.destroyed) return false;
    for (let o = this.c; o; o = o.parent) if (!o.visible) return false;
    try {
      return !!this.darf();
    } catch {
      return false;
    }
  }

  // Fenster-Koordinaten → Pixi-Bildschirm-Koordinaten
  global(ev) {
    stage.app.renderer.events.mapPositionToPoint(this.g, ev.clientX, ev.clientY);
    return this.g;
  }

  /** Index des Felds unter einem Bildschirm-Punkt, sonst -1 */
  feldBei(global) {
    if (this.c.destroyed) return -1;
    const l = this.c.toLocal(global, undefined, this.p);
    if (l.y < this.y0 || l.y > this.y1 || l.x < this.x0 || l.x > this.x1) return -1;
    const f = this.felder;
    for (let i = 0; i < f.length; i++) {
      const links = i === 0 ? this.x0 : f[i].x0;
      const rechts = i === f.length - 1 ? this.x1 : f[i].x1;
      if (l.x >= links && l.x < rechts) return i;
    }
    return -1;
  }

  spiel(i, pointerId) {
    const jetzt = performance.now() / 1000;
    if (jetzt - this.zuletzt[i] < NOCHMAL_AB) return;
    this.zuletzt[i] = jetzt;
    try {
      this.onSpiel?.(i, pointerId);
    } catch (e) {
      console.error('[musik] Fehler in Klangleiste:', e);
    }
  }

  loslassen() {
    this.finger.clear();
  }

  abbauen() {
    if (!this.verbunden) return;
    this.verbunden = false;
    window.removeEventListener('pointermove', this._bewegt);
    window.removeEventListener('pointerup', this._oben);
    window.removeEventListener('pointercancel', this._oben);
    if (!this.c.destroyed) this.c.off('pointerdown', this._unten);
    this.finger.clear();
  }
}
