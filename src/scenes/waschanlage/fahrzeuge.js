// Die drei Fahrzeuge der Waschanlage und Hilfen, um Matsch und Schaum auf ihren Körper zu setzen.
//
//   plan('zug' | 'auto' | 'traktor')   → was gebaut wird (Körper, Räder, Größe, Töne)
//   baueFahrzeug(plan, opt)            → Fahrzeug (Baustein zug.js) mit weichem Schatten
//   innenPunkte(bildId)                → Punkte, die sicher auf dem Körper liegen (Bildpunkte relativ zum Anker)
//   ohneGesicht(plan, punkte, r)       → Punkte ohne die Gegend um Augen und Mund
//   verteile(punkte, n), streue(punkte, abstand, max)

import { tex, meta, fx, pick, shuffle, PIXI } from '../../engine/index.js';
import { Fahrzeug, ladeZug } from '../../gemeinsam/zug.js';

export const TYPEN = ['zug', 'auto', 'traktor'];

// wie im Zug-Baustein: welche Räder zu welcher Lok gehören, welche Loks dampfen
const LOK_RAD = { lok_dampf: 'zug/rad_gross', lok_diesel: 'zug/rad_blau', lok_gruen: 'zug/rad_klein', lok_schnell: 'zug/rad_klein' };
const DAMPFLOKS = new Set(['lok_dampf', 'lok_gruen']);

/** Bauplan eines Fahrzeugs. Die Lok ist die eigene Lok des Kindes (gespeicherter Zug). */
export function plan(typ) {
  // Auto und Traktor: Die Radkästen sind als dunkle (undurchsichtige) Höhlen gemalt – die Räder gehören davor,
  // sonst sähe man nur einen schmalen Streifen darunter. Größen und kleine Verschiebungen am Raster abgelesen
  // (art/waschanlage/raster/*.jpg), in Bildpunkten des Körpers.
  if (typ === 'auto') {
    return {
      typ,
      koerper: 'waschanlage/auto_klein',
      raeder: [
        { tex: 'waschanlage/rad_klein_auto', punkt: 'rad1', durchmesser: 196 },
        { tex: 'waschanlage/rad_klein_auto', punkt: 'rad2', durchmesser: 196 },
      ],
      raederVorn: true,
      gesicht: [725, 290],   // Mitte von Augen und Mund (am Raster und im Spielfoto abgelesen) – dort kein Matsch
      scale: 1.0,
      gruss: { id: 'common/hupe', vol: 0.75 },
      fahrTon: 'common/motor',
    };
  }
  if (typ === 'traktor') {
    return {
      typ,
      koerper: 'waschanlage/traktor_ohne',
      raeder: [
        // der Punkt liegt etwas links der Bogenmitte; das Vorderrad sitzt tiefer, damit beide auf dem Boden stehen
        { tex: 'waschanlage/rad_traktor_gross', punkt: 'rad_gross', durchmesser: 318, dx: 32 },
        { tex: 'waschanlage/rad_traktor_klein', punkt: 'rad_klein', durchmesser: 212, dy: 27 },
      ],
      raederVorn: true,
      gesicht: [800, 335],
      scale: 0.98,
      gruss: { id: 'common/hupe', vol: 0.7, rate: 0.8 },
      fahrTon: 'common/traktor',
    };
  }
  const lok = ladeZug().lok;
  return {
    typ: 'zug',
    lok,
    koerper: 'zug/' + lok,
    raeder: [{ tex: LOK_RAD[lok] || 'zug/rad_gross', punkt: 'rad1' }, { tex: LOK_RAD[lok] || 'zug/rad_gross', punkt: 'rad2' }],
    stange: DAMPFLOKS.has(lok) ? { tex: 'zug/kuppelstange' } : null,
    dampf: DAMPFLOKS.has(lok),
    gesicht: meta('zug/' + lok).pts?.gesicht || null,
    scale: 0.92,
    gruss: { id: 'common/pfiff', vol: 0.6 },
    fahrTon: 'common/zug_fahren',
  };
}

/** Fahrzeug nach Plan bauen, mit weichem Bodenschatten. */
export function baueFahrzeug(p, { x, y, parent, z }) {
  const f = new Fahrzeug({
    koerper: p.koerper, raeder: p.raeder, stange: p.stange || null, x, y, scale: p.scale, parent, z,
  });
  if (p.raederVorn) {
    // Räder vor den Körper (huepfer: [radEbene, rumpf, …] → Räder ans Ende) und fein verschieben
    f.huepfer.addChild(f.radEbene);
    for (const r of f.raeder) {
      const wunsch = p.raeder.find((q) => q.punkt === r.punkt);
      if (wunsch?.dx) r.sprite.x += wunsch.dx;
      if (wunsch?.dy) r.sprite.y += wunsch.dy;
    }
  }
  const m = meta(p.koerper);
  const schatten = new PIXI.Sprite(fx.texture('rauch'));
  schatten.anchor.set(0.5);
  schatten.tint = 0x34405a;
  schatten.alpha = 0.32;
  schatten.width = m.w * 1.05;
  schatten.height = 90;
  schatten.position.set((0.5 - m.ax) * m.w, -4);
  schatten.eventMode = 'none';
  f.addChildAt(schatten, 0);
  return f;
}

// ---------------------------------------------------------------- Punkte auf dem Körper

const cache = new Map();
let leinwand = null;
let kontext = null;
const RASTER = 4;   // Bildpunkte je Messpunkt (verkleinert messen genügt)

/**
 * Punkte (alle ~40 Bildpunkte), die mindestens ~70 Bildpunkte tief im Körper-Bild liegen – dort halten Matsch
 * und Schaum, ohne neben dem Fahrzeug in der Luft zu hängen. Koordinaten relativ zum Anker (wie fahrzeug.innen).
 */
export function innenPunkte(id) {
  if (cache.has(id)) return cache.get(id);
  const m = meta(id);
  const w = Math.round(m.w);
  const h = Math.round(m.h);
  const pts = [];
  try {
    const quelle = tex(id).source?.resource;
    if (!quelle) throw new Error('keine Bildquelle');
    const cw = Math.ceil(w / RASTER);
    const ch = Math.ceil(h / RASTER);
    if (!leinwand) {
      leinwand = document.createElement('canvas');
      kontext = leinwand.getContext('2d', { willReadFrequently: true });
    }
    leinwand.width = cw;
    leinwand.height = ch;
    kontext.clearRect(0, 0, cw, ch);
    kontext.drawImage(quelle, 0, 0, cw, ch);
    const d = kontext.getImageData(0, 0, cw, ch).data;
    const a = (x, y) => (x < 0 || y < 0 || x >= cw || y >= ch ? 0 : d[(y * cw + x) * 4 + 3]);
    const e = Math.round(70 / RASTER);
    const f = Math.round(e * 0.7);
    const schritt = Math.round(40 / RASTER);
    for (let y = e; y < ch - e; y += schritt) {
      for (let x = e; x < cw - e; x += schritt) {
        if (a(x, y) > 200 && a(x - e, y) > 128 && a(x + e, y) > 128 && a(x, y - e) > 128 && a(x, y + e) > 128 &&
            a(x - f, y - f) > 128 && a(x + f, y - f) > 128 && a(x - f, y + f) > 128 && a(x + f, y + f) > 128) {
          pts.push({ x: x * RASTER - m.ax * w, y: y * RASTER - m.ay * h });
        }
      }
    }
  } catch (err) {
    console.warn(`[waschanlage] Körper '${id}' nicht messbar – nehme Ellipse.`, err?.message || err);
  }
  if (pts.length < 8) {
    // Ersatz: Ellipse in der Bildmitte
    pts.length = 0;
    for (let y = 0.2; y <= 0.75; y += 0.08) {
      for (let x = 0.15; x <= 0.85; x += 0.06) {
        const nx = (x - 0.5) / 0.35;
        const ny = (y - 0.48) / 0.3;
        if (nx * nx + ny * ny <= 1) pts.push({ x: (x - m.ax) * w, y: (y - m.ay) * h });
      }
    }
  }
  cache.set(id, pts);
  return pts;
}

/**
 * Oberkante des Körper-Bildes an der Stelle x (Bildpunkte relativ zum Anker): erster deckender Bildpunkt von oben
 * (Mittel über ±12 Bildpunkte). → y relativ zum Anker, oder null, wenn dort nichts ist.
 */
export function oberkante(id, x) {
  const schluessel = id + '@' + Math.round(x);
  if (cache.has(schluessel)) return cache.get(schluessel);
  const m = meta(id);
  let erg = null;
  try {
    const quelle = tex(id).source?.resource;
    if (!quelle) throw new Error('keine Bildquelle');
    const w = Math.round(m.w);
    const h = Math.round(m.h);
    const px = Math.round(x + m.ax * w);
    if (!leinwand) {
      leinwand = document.createElement('canvas');
      kontext = leinwand.getContext('2d', { willReadFrequently: true });
    }
    const breite = 25;
    leinwand.width = breite;
    leinwand.height = h;
    kontext.clearRect(0, 0, breite, h);
    // die Bildquelle kann anders groß sein als in pack.json (verkleinert geladen)
    const f = (quelle.width || w) / w;
    kontext.drawImage(quelle, (px - 12) * f, 0, breite * f, h * f, 0, 0, breite, h);
    const d = kontext.getImageData(0, 0, breite, h).data;
    let summe = 0;
    let n = 0;
    for (let sx = 0; sx < breite; sx += 4) {
      for (let y = 0; y < h; y++) {
        if (d[(y * breite + sx) * 4 + 3] > 200) { summe += y; n++; break; }
      }
    }
    if (n) erg = summe / n - m.ay * h;
  } catch (err) {
    console.warn(`[waschanlage] Oberkante von '${id}' nicht messbar.`, err?.message || err);
  }
  cache.set(schluessel, erg);
  return erg;
}

/**
 * Punkte auf dem sichtbaren Körper eines Plans: innenPunkte ohne die Stellen, die von Rädern vor dem Körper
 * verdeckt werden (dort hätte Matsch/Schaum keinen Sinn – man sähe ihn nicht).
 */
export function flaechenPunkte(p) {
  const alle = innenPunkte(p.koerper);
  if (!p.raederVorn) return alle;
  const m = meta(p.koerper);
  const kreise = p.raeder.map((r) => {
    const q = m.pts?.[r.punkt] || [0, 0];
    return { x: q[0] - m.ax * m.w + (r.dx || 0), y: q[1] - m.ay * m.h + (r.dy || 0), r: (r.durchmesser || 160) / 2 + 45 };
  });
  const frei = alle.filter((pt) => kreise.every((k) => (pt.x - k.x) ** 2 + (pt.y - k.y) ** 2 > k.r * k.r));
  return frei.length >= 8 ? frei : alle;
}

/**
 * Punkte ohne die Gegend um das Gesicht (Augen und Mund sollen sichtbar bleiben). r in Bildpunkten des Körpers.
 * Bleiben zu wenige übrig (unter min), gibt es die Punkte unverändert zurück.
 */
export function ohneGesicht(p, punkte, r, min = 8) {
  if (!p.gesicht) return punkte;
  const m = meta(p.koerper);
  const gx = p.gesicht[0] - m.ax * m.w;
  const gy = p.gesicht[1] - m.ay * m.h;
  const frei = punkte.filter((q) => (q.x - gx) ** 2 + (q.y - gy) ** 2 > r * r);
  return frei.length >= min ? frei : punkte;
}

/** n gut verteilte Punkte (jeweils möglichst weit von den schon gewählten). */
export function verteile(punkte, n) {
  if (!punkte.length) return [];
  const erg = [pick(punkte)];
  while (erg.length < n) {
    let bester = null;
    let besterAbstand = -1;
    for (const p of punkte) {
      let d = Infinity;
      for (const q of erg) d = Math.min(d, (p.x - q.x) ** 2 + (p.y - q.y) ** 2);
      if (d > besterAbstand) {
        besterAbstand = d;
        bester = p;
      }
    }
    if (!bester || besterAbstand <= 0) break;
    erg.push(bester);
  }
  return erg;
}

/** Punkte mit Mindestabstand (zufällige Reihenfolge), höchstens max. */
export function streue(punkte, abstand, max) {
  const erg = [];
  const a2 = abstand * abstand;
  for (const p of shuffle([...punkte])) {
    if (erg.every((q) => (p.x - q.x) ** 2 + (p.y - q.y) ** 2 >= a2)) erg.push(p);
    if (erg.length >= max) break;
  }
  return erg;
}
