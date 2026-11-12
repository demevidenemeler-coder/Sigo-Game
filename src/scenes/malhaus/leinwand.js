// Malflächen: je Seite ein eigenes HTML-Canvas (2D) als Pixi-Textur.
//
// - Die Leinwände entstehen EINMAL pro Modul (Texture.from(canvas) behält Pixi für immer – siehe ENTWICKLUNG.md)
//   und werden beim Öffnen des Ortes geleert. Solange der Ort offen ist, bleiben die Bilder erhalten.
// - Die Textur wird nur hochgeladen, wenn sich etwas geändert hat (schmutzig → einmal pro Bild).
// - Finger: Die Szene verteilt Bewegungen/Loslassen über einen eigenen Verteiler (Fenster-Listener, in exit()
//   wieder abgebaut). Jeder Finger zählt einzeln – mehrere Finger malen gleichzeitig.

import { PIXI, stage } from '../../engine/index.js';

const LEINWAENDE = new Map(); // name → { canvas, ctx, texture }

/** Leinwand holen (einmal pro Modul angelegt). opt.lesen: Canvas mit häufigem Zurücklesen */
export function leinwand(name, w, h) {
  let l = LEINWAENDE.get(name);
  if (l && (l.canvas.width !== w || l.canvas.height !== h)) {
    l.canvas.width = w;
    l.canvas.height = h;
    l.texture.source.resize?.(w, h);
  }
  if (!l) {
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    const texture = PIXI.Texture.from(canvas);
    l = { canvas, ctx, texture };
    LEINWAENDE.set(name, l);
  }
  return l;
}

/**
 * Eine Malfläche auf dem Blatt: Sprite mit der Leinwand-Textur, genau über dem weißen Blatt des Hintergrunds.
 * blatt = {x, y, w, h} in Seiten-Koordinaten (links oben, Größe). breite×hoehe = Leinwand in Bildpunkten.
 */
export class Malflaeche {
  constructor(seite, name, blatt, breite, hoehe) {
    this.seite = seite;
    this.blatt = blatt;
    const l = leinwand(name, breite, hoehe);
    this.canvas = l.canvas;
    this.ctx = l.ctx;
    this.texture = l.texture;
    this.w = breite;
    this.h = hoehe;
    // Leinwand passend ins Blatt (gleichmäßig, mittig)
    this.skala = Math.min(blatt.w / breite, blatt.h / hoehe);
    this.sprite = new PIXI.Sprite(this.texture);
    this.sprite.label = 'malflaeche:' + name;
    this.sprite.scale.set(this.skala);
    // Ruhe-Ort merken: Umrechnungen gelten auch, während das Blatt kurz wackelt
    this.ox = blatt.x + (blatt.w - breite * this.skala) / 2;
    this.oy = blatt.y + (blatt.h - hoehe * this.skala) / 2;
    this.sprite.position.set(this.ox, this.oy);
    this.sprite.zIndex = 5;
    seite.welt.addChild(this.sprite);
    // Tippfläche = ganzes Blatt (in Leinwand-Bildpunkten)
    this.sprite.eventMode = 'static';
    this.sprite.cursor = 'pointer';
    this.sprite.hitArea = new PIXI.Rectangle(
      (blatt.x - this.ox) / this.skala, (blatt.y - this.oy) / this.skala,
      blatt.w / this.skala, blatt.h / this.skala,
    );
    this.schmutzig = true;
    this.leere();
  }

  /** ganz weiß machen */
  leere() {
    const c = this.ctx;
    c.save();
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.globalCompositeOperation = 'source-over';
    c.globalAlpha = 1;
    c.fillStyle = '#ffffff';
    c.fillRect(0, 0, this.w, this.h);
    c.restore();
    this.schmutzig = true;
  }

  /** Seiten-Koordinaten → Leinwand-Bildpunkte */
  inLeinwand(x, y) {
    return { x: (x - this.ox) / this.skala, y: (y - this.oy) / this.skala };
  }

  /** Leinwand-Bildpunkte → Seiten-Koordinaten */
  inSeite(x, y) {
    return { x: this.ox + x * this.skala, y: this.oy + y * this.skala };
  }

  /** Liegt der Seiten-Punkt auf dem Blatt? */
  aufBlatt(x, y, rand = 0) {
    const b = this.blatt;
    return x >= b.x - rand && x <= b.x + b.w + rand && y >= b.y - rand && y <= b.y + b.h + rand;
  }

  /** jedes Bild: Textur hochladen, wenn sich etwas geändert hat */
  auffrischen() {
    if (!this.schmutzig) return;
    this.schmutzig = false;
    this.texture.source.update();
  }
}

/**
 * Finger-Verteiler der Szene: pointerdown kommt über Pixi (auf der Malfläche), Bewegen und Loslassen über
 * Fenster-Listener (auch außerhalb der Fläche, auch pointercancel). Jede Seite meldet Finger mit
 * verteiler.halte(pointerId, {move(global), end(abgebrochen)}) an.
 */
export class FingerVerteiler {
  constructor() {
    this.finger = new Map();
    this.punkt = new PIXI.Point();
    this._move = (ev) => {
      const f = this.finger.get(ev.pointerId);
      if (!f) return;
      // zusammengefasste Ereignisse: bei schnellen Strichen mehr Zwischenpunkte (weichere Linie)
      const liste = typeof ev.getCoalescedEvents === 'function' ? ev.getCoalescedEvents() : null;
      if (liste && liste.length > 1) {
        for (const e of liste) f.move(this._global(e));
      } else {
        f.move(this._global(ev));
      }
    };
    this._ende = (abgebrochen) => (ev) => {
      const f = this.finger.get(ev.pointerId);
      if (!f) return;
      this.finger.delete(ev.pointerId);
      if (!abgebrochen) f.move(this._global(ev));
      f.end(abgebrochen);
    };
    this._up = this._ende(false);
    this._cancel = this._ende(true);
    this._blur = () => this.allesLos();
    window.addEventListener('pointermove', this._move, { passive: true });
    window.addEventListener('pointerup', this._up, { passive: true });
    window.addEventListener('pointercancel', this._cancel, { passive: true });
    window.addEventListener('blur', this._blur);
  }

  _global(ev) {
    const p = this.punkt;
    stage.app.renderer.events.mapPositionToPoint(p, ev.clientX, ev.clientY);
    return p;
  }

  halte(pointerId, f) {
    const alt = this.finger.get(pointerId);
    if (alt) {
      this.finger.delete(pointerId);
      alt.end(true);
    }
    this.finger.set(pointerId, f);
  }

  /** alle Finger (einer Seite oder alle) beenden */
  allesLos(nurVon = null) {
    for (const [id, f] of [...this.finger]) {
      if (nurVon && f.von !== nurVon) continue;
      this.finger.delete(id);
      f.end(true);
    }
  }

  abbauen() {
    this.allesLos();
    window.removeEventListener('pointermove', this._move);
    window.removeEventListener('pointerup', this._up);
    window.removeEventListener('pointercancel', this._cancel);
    window.removeEventListener('blur', this._blur);
  }
}
