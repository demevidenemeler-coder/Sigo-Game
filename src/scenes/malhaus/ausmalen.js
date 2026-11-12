// Ausmalen: Flächen eines Linienbilds finden und färben.
//
// Ein Ausmalbild (schwarze Linien auf Weiß, Graustufen) wird EINMAL zerlegt:
//   - Linie = dunkle Bildpunkte (Helligkeit < SCHWELLE), alles andere gehört zu einer Fläche.
//   - Flächen werden mit dem Scanline-Verfahren nummeriert (zusammenhängend über die 4 Nachbarn).
//   - Danach wachsen die Flächen noch ein paar Bildpunkte in die Linie hinein (Linien-Rand), damit unter dem
//     grauen Kantenverlauf der Linie keine hellen Ränder bleiben. Dieser Schritt läuft nur über die Linienpunkte.
//   - Ergebnis ist eine Nummer je Bildpunkt (Uint8Array, bei sehr vielen Flächen Uint16Array) plus Größe und
//     Rechteck jeder Fläche – klein genug, dass alle acht Bilder im Vorrat bleiben (je ca. 1,6 MB).
// Gezeichnet wird: Farbpuffer (ImageData) → Leinwand, darüber das Linienbild „multiplizierend" (Linien bleiben
// schwarz, helle Kanten färben sich mit).

const SCHWELLE = 170;      // darunter gilt ein Bildpunkt als Linie
const RAND_SCHRITTE = 3;   // so viele Bildpunkte wächst jede Fläche in die Linie hinein
const MIN_FLAECHE = 150;   // kleinere Flächen (Krümel im Kantenverlauf) werden beim Tippen übersprungen
const LEER16 = 0xffff;     // „keine Fläche" im Arbeitsspeicher

// Arbeitsspeicher fürs Zerlegen: einmal angelegt und für jedes Bild wiederverwendet (nichts Großes pro Bild)
let arbeit = null;

function arbeitsSpeicher(w, h) {
  const N = w * h;
  if (!arbeit || arbeit.N < N) {
    const canvas = arbeit?.canvas || document.createElement('canvas');
    arbeit = {
      N,
      canvas,
      ctx: null,
      offen: new Uint8Array(N),
      label: new Uint16Array(N),
      linie: new Int32Array(N),
      randI: new Int32Array(N),
      randL: new Uint16Array(N),
      stapel: new Int32Array(8192),
    };
  }
  if (arbeit.canvas.width !== w || arbeit.canvas.height !== h || !arbeit.ctx) {
    arbeit.canvas.width = w;
    arbeit.canvas.height = h;
    arbeit.ctx = arbeit.canvas.getContext('2d', { willReadFrequently: true });
  }
  return arbeit;
}

/**
 * Arbeitsspeicher fürs Zerlegen freigeben (gut 20 MB plus Hilfs-Leinwand). Aufrufen, wenn alle Bilder zerlegt sind
 * oder der Ort verlassen wird – und nur, wenn gerade kein Zerlegen läuft (ein laufender Generator würde sonst auf
 * der geleerten Hilfs-Leinwand weiterrechnen). Ein späteres Zerlegen legt ihn einfach neu an.
 */
export function gibArbeitFrei() {
  if (!arbeit) return;
  arbeit.canvas.width = 0;
  arbeit.canvas.height = 0;
  arbeit = null;
}

/**
 * Linienbild zerlegen. quelle = ImageBitmap/Bild/Leinwand, w×h = Größe der Leinwand in Bildpunkten
 * (das Bild wird auf genau diese Größe gezogen).
 * → { w, h, label, leer, kern, bbox, anzahl, rand }
 */
export function zerlege(quelle, w, h) {
  const g = zerlegeSchritte(quelle, w, h);
  let r = g.next();
  while (!r.done) r = g.next();
  return r.value;
}

const SCHRITT = 1 << 16; // nach so vielen Bildpunkten gibt die schrittweise Fassung die Kontrolle ab

/**
 * Dasselbe in kleinen Schritten (Generator): jedes next() rechnet höchstens ein paar zehntausend Bildpunkte.
 * So kann die Szene Bilder in Ruhe vorab zerlegen, ohne dass ein einziges Bild stockt. Der Arbeitsspeicher wird
 * geteilt – es darf immer nur EIN Zerlegen gleichzeitig laufen (ein abgebrochener Generator wird einfach verworfen).
 */
export function* zerlegeSchritte(quelle, w, h) {
  const A = arbeitsSpeicher(w, h);
  const g = A.ctx;
  g.globalCompositeOperation = 'source-over';
  g.fillStyle = '#fff';
  g.fillRect(0, 0, w, h);
  g.drawImage(quelle, 0, 0, w, h);
  yield;

  const N = w * h;
  const { offen, label, linie } = A;
  const grenze = SCHWELLE * 3;
  let nLinie = 0;
  // in Streifen lesen (jeder Streifen ist ein kurzes Kopieren)
  const streifen = Math.max(1, Math.floor(SCHRITT / w));
  for (let y0 = 0; y0 < h; y0 += streifen) {
    const zeilen = Math.min(streifen, h - y0);
    const rgba = g.getImageData(0, y0, w, zeilen).data;
    for (let i = y0 * w, e = (y0 + zeilen) * w, j = 0; i < e; i++, j += 4) {
      // Helligkeit (Bild ist grau – Summe der drei Kanäle ist robust)
      if (rgba[j] + rgba[j + 1] + rgba[j + 2] >= grenze) {
        offen[i] = 1;
      } else {
        offen[i] = 0;
        linie[nLinie++] = i;
      }
      label[i] = LEER16;
    }
    yield;
  }

  const kern = [];   // Bildpunkte der Fläche ohne Linien-Rand
  const bbox = [];   // [x0, y0, x1, y1]
  let anzahl = 0;
  let arbeitSeitPause = 0;

  // Scanline-Füllung: nummeriert die zusammenhängende Fläche ab Startpunkt s
  function* fuelle(s, nr) {
    let stapel = A.stapel;
    let sp = 0;
    stapel[sp++] = s;
    let menge = 0;
    let x0 = w, y0 = h, x1 = 0, y1 = 0;
    while (sp > 0) {
      const p = stapel[--sp];
      if (!offen[p]) continue;
      const y = (p / w) | 0;
      const zeile = y * w;
      let xl = p - zeile;
      while (xl > 0 && offen[zeile + xl - 1]) xl--;
      let xr = p - zeile;
      while (xr < w - 1 && offen[zeile + xr + 1]) xr++;
      if (xl < x0) x0 = xl;
      if (xr > x1) x1 = xr;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
      // Zeile nummerieren und Nachbarzeilen nach neuen Abschnitten absuchen
      let obenOffen = false;
      let untenOffen = false;
      for (let x = xl; x <= xr; x++) {
        const i = zeile + x;
        offen[i] = 0;
        label[i] = nr;
        menge++;
        if (y > 0) {
          if (offen[i - w]) {
            if (!obenOffen) {
              if (sp + 2 >= stapel.length) stapel = A.stapel = wachse(stapel);
              stapel[sp++] = i - w;
              obenOffen = true;
            }
          } else obenOffen = false;
        }
        if (y < h - 1) {
          if (offen[i + w]) {
            if (!untenOffen) {
              if (sp + 2 >= stapel.length) stapel = A.stapel = wachse(stapel);
              stapel[sp++] = i + w;
              untenOffen = true;
            }
          } else untenOffen = false;
        }
      }
      arbeitSeitPause += xr - xl + 1;
      if (arbeitSeitPause >= SCHRITT) {
        arbeitSeitPause = 0;
        yield;
      }
    }
    kern[nr] = menge;
    bbox[nr] = [x0, y0, x1, y1];
  }

  for (let y = 0; y < h; y++) {
    for (let i = y * w, e = i + w; i < e; i++) {
      if (offen[i] && anzahl < LEER16 - 1) yield* fuelle(i, anzahl++);
    }
    arbeitSeitPause += w;
    if (arbeitSeitPause >= SCHRITT) {
      arbeitSeitPause = 0;
      yield;
    }
  }

  // Linien-Rand: Linienpunkte bekommen die Nummer einer benachbarten Fläche (schrittweise, nicht in einem Zug).
  // Nur die Linienpunkte werden angesehen; wer eine Nummer bekommt, fällt aus der Liste.
  const { randI, randL } = A;
  for (let schritt = 0; schritt < RAND_SCHRITTE && nLinie > 0; schritt++) {
    let m = 0;
    let bleibt = 0;
    for (let k = 0; k < nLinie; k++) {
      const i = linie[k];
      const x = i % w;
      let l = LEER16;
      if (x > 0 && label[i - 1] !== LEER16) l = label[i - 1];
      else if (x < w - 1 && label[i + 1] !== LEER16) l = label[i + 1];
      else if (i >= w && label[i - w] !== LEER16) l = label[i - w];
      else if (i + w < N && label[i + w] !== LEER16) l = label[i + w];
      if (l !== LEER16) {
        randI[m] = i;
        randL[m] = l;
        m++;
      } else {
        linie[bleibt++] = i;
      }
      if ((k & (SCHRITT - 1)) === SCHRITT - 1) yield;
    }
    nLinie = bleibt;
    for (let k = 0; k < m; k++) {
      const i = randI[k];
      const l = randL[k];
      label[i] = l;
      const b = bbox[l];
      const x = i % w;
      const y = (i / w) | 0;
      if (x < b[0]) b[0] = x;
      if (x > b[2]) b[2] = x;
      if (y < b[1]) b[1] = y;
      if (y > b[3]) b[3] = y;
    }
    yield;
  }

  // Ergebnis kompakt ablegen (Uint8Array genügt fast immer)
  let ziel;
  let leer;
  if (anzahl < 255) {
    ziel = new Uint8Array(N);
    leer = 255;
    for (let a = 0; a < N; a += SCHRITT * 2) {
      for (let i = a, e = Math.min(N, a + SCHRITT * 2); i < e; i++) {
        const l = label[i];
        ziel[i] = l === LEER16 ? 255 : l;
      }
      yield;
    }
  } else {
    ziel = label.slice(0, N);
    leer = LEER16;
  }

  // Flächen, die den Bildrand berühren, sind „Hintergrund" (für die Zeige-Hand weniger spannend)
  const rand = new Uint8Array(anzahl);
  for (let l = 0; l < anzahl; l++) {
    const b = bbox[l];
    if (b[0] <= 0 || b[1] <= 0 || b[2] >= w - 1 || b[3] >= h - 1) rand[l] = 1;
  }

  return { w, h, label: ziel, leer, kern, bbox, anzahl, rand };
}

function wachse(a) {
  const b = new Int32Array(a.length * 2);
  b.set(a);
  return b;
}

/**
 * Welche Fläche liegt unter (x, y)? Auf einer Linie oder einem Krümel: die nächste brauchbare Fläche im Umkreis.
 * → Nummer oder -1
 */
export function flaecheBei(d, x, y, umkreis = 34) {
  const { w, h, label, kern, leer } = d;
  const px = Math.round(x);
  const py = Math.round(y);
  const gut = (xx, yy) => {
    if (xx < 0 || yy < 0 || xx >= w || yy >= h) return -1;
    const l = label[yy * w + xx];
    return l !== leer && kern[l] >= MIN_FLAECHE ? l : -1;
  };
  const direkt = gut(px, py);
  if (direkt >= 0) return direkt;
  for (let r = 2; r <= umkreis; r += 2) {
    const n = Math.max(8, Math.round(r * 1.6));
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2;
      const l = gut(px + Math.round(Math.cos(a) * r), py + Math.round(Math.sin(a) * r));
      if (l >= 0) return l;
    }
  }
  return -1;
}

/**
 * Ein Bildpunkt mitten in der Fläche (für die Zeige-Hand) → {x, y} in Bildpunkten.
 * Sucht in Zeilen um die Mitte des Rechtecks den längsten Abschnitt der Fläche und nimmt dessen Mitte.
 */
export function punktIn(d, l) {
  const { w, label, bbox } = d;
  const b = bbox[l];
  const my = Math.round((b[1] + b[3]) / 2);
  const hoehe = b[3] - b[1];
  let best = null;
  let bestLaenge = 0;
  for (let k = 0; k <= 12; k++) {
    const dy = Math.round(((k + 1) >> 1) * (hoehe / 26)) * (k % 2 ? -1 : 1);
    const y = my + dy;
    if (y < b[1] || y > b[3]) continue;
    const zeile = y * w;
    let lauf = 0;
    for (let x = b[0]; x <= b[2] + 1; x++) {
      if (x <= b[2] && label[zeile + x] === l) {
        lauf++;
      } else if (lauf > 0) {
        // etwas Vorrang für Zeilen nahe der Mitte
        const wert = lauf * (1 - Math.abs(dy) / (hoehe + 1) * 0.5);
        if (wert > bestLaenge) {
          bestLaenge = wert;
          best = { x: x - 1 - (lauf >> 1), y };
        }
        lauf = 0;
      }
    }
  }
  return best || { x: (b[0] + b[2]) >> 1, y: my };
}

/**
 * Malt Ausmalbilder auf eine Leinwand: Farbpuffer + Linien (multiplizierend). EINMAL je Seite anlegen.
 *   const m = new Malbild(ctx, w, h);
 *   m.setze(quelle, daten, farben)   // anderes Bild (Linienbild wird einmal auf Leinwandgröße umgezeichnet)
 *   m.alles(farben)                   // farben: Map Fläche → 0xRRGGBB (ganzes Bild neu)
 *   m.faerbe(l, 0xRRGGBB)             // eine Fläche färben (nur ihr Rechteck wird neu gezeichnet)
 */
export class Malbild {
  constructor(ctx, w, h) {
    this.ctx = ctx;
    this.w = w;
    this.h = h;
    this.bild = ctx.createImageData(w, h);
    this.puffer = new Uint32Array(this.bild.data.buffer);
    this.linien = document.createElement('canvas');
    this.linien.width = w;
    this.linien.height = h;
    this.lctx = this.linien.getContext('2d');
    this.tafel = new Uint32Array(256);
    this.d = null;
  }

  static farbe32(rgb) {
    const r = (rgb >> 16) & 255;
    const g = (rgb >> 8) & 255;
    const b = rgb & 255;
    // ImageData ist RGBA im Speicher – als Uint32 (little-endian) also ABGR
    return ((255 << 24) | (b << 16) | (g << 8) | r) >>> 0;
  }

  setze(quelle, daten, farben) {
    this.d = daten;
    const c = this.lctx;
    c.fillStyle = '#fff';
    c.fillRect(0, 0, this.w, this.h);
    c.drawImage(quelle, 0, 0, this.w, this.h);
    this.alles(farben);
  }

  /**
   * Nur das Linienbild zeigen, solange es noch zerlegt wird (sieht genauso aus wie ein ungefärbtes Bild –
   * kommen die Daten, ändert sich nichts Sichtbares). Färben geht erst nach setze().
   */
  nurLinien(quelle) {
    this.d = null;
    const c = this.lctx;
    c.fillStyle = '#fff';
    c.fillRect(0, 0, this.w, this.h);
    c.drawImage(quelle, 0, 0, this.w, this.h);
    const z = this.ctx;
    z.save();
    z.globalCompositeOperation = 'source-over';
    z.fillStyle = '#fff';
    z.fillRect(0, 0, this.w, this.h);
    z.drawImage(this.linien, 0, 0);
    z.restore();
  }

  alles(farben) {
    const d = this.d;
    if (!d) return;
    if (this.tafel.length < d.anzahl + 1) this.tafel = new Uint32Array(d.anzahl + 1);
    const tafel = this.tafel;
    tafel.fill(0xffffffff);
    for (const [l, rgb] of farben) if (l >= 0 && l < d.anzahl) tafel[l] = Malbild.farbe32(rgb);
    const { label, leer } = d;
    const p = this.puffer;
    for (let i = 0, n = p.length; i < n; i++) {
      const l = label[i];
      p[i] = l === leer ? 0xffffffff : tafel[l];
    }
    this._zeichne(0, 0, this.w, this.h);
  }

  faerbe(l, rgb) {
    const d = this.d;
    if (!d) return;
    const c32 = Malbild.farbe32(rgb);
    const [x0, y0, x1, y1] = d.bbox[l];
    const { label, w } = d;
    const p = this.puffer;
    for (let y = y0; y <= y1; y++) {
      const zeile = y * w;
      for (let i = zeile + x0, e = zeile + x1; i <= e; i++) if (label[i] === l) p[i] = c32;
    }
    this._zeichne(x0, y0, x1 - x0 + 1, y1 - y0 + 1);
  }

  _zeichne(x, y, w, h) {
    const c = this.ctx;
    c.putImageData(this.bild, 0, 0, x, y, w, h);
    c.save();
    c.globalCompositeOperation = 'multiply';
    c.drawImage(this.linien, x, y, w, h, x, y, w, h);
    c.restore();
  }
}
