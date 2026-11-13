// Kleine Hilfen für die Zugfahrt: große Tippflächen, Grund-Klasse für alles, was vorbeizieht.

import { tap, PIXI } from '../../engine/index.js';

const { Container, Rectangle } = PIXI;

/**
 * tap() mit einer Tippfläche, die mindestens `min` Bühnen-Einheiten groß ist (Regel für kleine Hände).
 * Rechnet mit der Größe des Dings (obj.scale) – die Eltern-Container der Zugfahrt sind nicht skaliert.
 */
export function tippbar(obj, fn, { min = 240, pad = 30, sound = null, squash = false, skala } = {}) {
  return tap(obj, fn, { hitArea: flaeche(obj, { min, pad, skala }), sound, squash });
}

/**
 * Große Tippfläche (lokale Koordinaten) für obj nach seiner jetzigen Größe – auch zum Neuberechnen, wenn sich
 * Bild oder Größe ändern (Wolke bekommt ein anderes Bild). Setzt obj.hitArea und gibt sie zurück.
 */
export function flaeche(obj, { min = 240, pad = 30, skala } = {}) {
  const b = obj.getLocalBounds();
  const s = skala ?? (Math.abs(obj.scale?.x || 1) || 1);
  const minL = min / s;
  const p = pad / s;
  const w = Math.max(b.width + 2 * p, minL);
  const h = Math.max(b.height + 2 * p, minL);
  const cx = b.x + b.width / 2;
  const cy = b.y + b.height / 2;
  const r = new Rectangle(cx - w / 2, cy - h / 2, w, h);
  obj.hitArea = r;
  return r;
}

/**
 * Ruhe-Sperre je Ding: true, wenn `obj` jetzt wieder Ton und Teilchen auslösen darf (dann für `sek` Sekunden
 * gesperrt). Bei Dauertippen wackelt das Ding weiter, aber Rascheln, Blätter und Tropfen stapeln sich nicht.
 */
export function ruhig(obj, sek = 0.7) {
  const jetzt = performance.now();
  if (jetzt < (obj._ruheBis || 0)) return false;
  obj._ruheBis = jetzt + sek * 1000;
  return true;
}

function stoppeFiguren(c) {
  if (c.isActor) {
    c.stop();
    return;
  }
  for (const k of c.children) stoppeFiguren(k);
}

/**
 * Etwas, das an der Strecke steht und vorbeizieht (Baum, Station …).
 * wx = Ort in der Landschaft; die Teile (Container in verschiedenen Ebenen) stehen bei x = wx − strecke.
 */
export class Ding {
  constructor(szene, wx) {
    this.s = szene;
    this.wx = wx;
    this.teile = [];
    this.links = -200;      // Ausdehnung relativ zu wx (für Planung und Aufräumen)
    this.rechts = 200;
    this.vorneBelegt = false; // belegt die vordere Reihe (dann keine Blumen davor)
    this.tot = false;
    this.art = 'deko';
  }

  /** Neuer Teil-Container in einer Ebene; z = zIndex (in sortierten Ebenen: Standlinie). */
  teil(ebene, z = 0) {
    const c = new Container({ label: 'teil:' + this.art });
    c.zIndex = z;
    ebene.addChild(c);
    this.teile.push(c);
    return c;
  }

  /** Bildschirm-x setzen (jedes Bild). */
  setze(sx) {
    for (const c of this.teile) c.x = sx;
  }

  update(dt, sx) {}

  /** Streckenwert, bei dem der Zug halten soll (oder null). */
  haltBei() {
    return null;
  }

  /** Der Zug steht jetzt hier. */
  angekommen() {}

  /** Weiterfahren erlaubt (Hebel, Lok …). */
  weiter() {}

  /** Ziele der Zeige-Hand. */
  hinweise() {
    return [];
  }

  zerstoere() {
    if (this.tot) return;
    this.tot = true;
    // Figuren erst anhalten: ein laufender Hüpfer (hopTo/walkTo) schriebe sonst noch in die abgebaute Figur
    for (const c of this.teile) if (!c.destroyed) stoppeFiguren(c);
    for (const c of this.teile) if (!c.destroyed) c.destroy({ children: true, context: true });
    this.teile.length = 0;
  }
}
