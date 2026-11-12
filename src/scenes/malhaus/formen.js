// Formen zum Nachspuren (Seite 2): Aus einem Stempelbild (Herz, Stern, Fisch …) werden einmal Punkte auf dem
// Umriss gewonnen – gleichmäßig verteilt (der jeweils fernste Randpunkt kommt als Nächstes dazu), danach im Kreis
// um die Mitte geordnet (für die Zeige-Hand). Dazu eine einfarbige Silhouette zum Füllen (eine Leinwand je Modul).

import { tex, PIXI } from '../../engine/index.js';

const KLEIN = 128;                 // Rechengröße (längste Seite in Bildpunkten)
const CACHE = new Map();           // id → { punkte:[{x,y}] (0…1), seiten: w/h }
let rechen = null;                 // kleine Hilfs-Leinwand zum Auslesen

/** Punkte auf dem Umriss des Bildes id (Werte 0…1 im Bild-Rechteck), anzahl Stück. → { punkte, verhaeltnis } */
export function umrissPunkte(id, anzahl = 24) {
  const schluessel = id + ':' + anzahl;
  const fertig = CACHE.get(schluessel);
  if (fertig) return fertig;
  const t = tex(id);
  const quelle = t.source.resource;
  const f = KLEIN / Math.max(t.width, t.height);
  const w = Math.max(8, Math.round(t.width * f));
  const h = Math.max(8, Math.round(t.height * f));
  if (!rechen) {
    const c = document.createElement('canvas');
    rechen = { canvas: c, ctx: c.getContext('2d', { willReadFrequently: true }) };
  }
  rechen.canvas.width = w;
  rechen.canvas.height = h;
  const g = rechen.ctx;
  g.clearRect(0, 0, w, h);
  g.drawImage(quelle, 0, 0, w, h);
  const a = g.getImageData(0, 0, w, h).data;
  const innen = (x, y) => x >= 0 && y >= 0 && x < w && y < h && a[(y * w + x) * 4 + 3] >= 128;
  const rand = [];
  let sx = 0;
  let sy = 0;
  let n = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!innen(x, y)) continue;
      sx += x; sy += y; n++;
      if (!innen(x - 1, y) || !innen(x + 1, y) || !innen(x, y - 1) || !innen(x, y + 1)) rand.push([x, y]);
    }
  }
  rechen.canvas.width = 1;
  rechen.canvas.height = 1;
  const mx = n ? sx / n : w / 2;
  const my = n ? sy / n : h / 2;
  // gleichmäßig verteilen: Start oben, dann immer der Randpunkt, der am weitesten von allen gewählten weg ist
  const gewaehlt = [];
  if (rand.length) {
    let start = 0;
    for (let i = 1; i < rand.length; i++) if (rand[i][1] < rand[start][1]) start = i;
    gewaehlt.push(rand[start]);
    const abst = rand.map((p) => Math.hypot(p[0] - rand[start][0], p[1] - rand[start][1]));
    while (gewaehlt.length < Math.min(anzahl, rand.length)) {
      let best = 0;
      for (let i = 1; i < rand.length; i++) if (abst[i] > abst[best]) best = i;
      const p = rand[best];
      gewaehlt.push(p);
      for (let i = 0; i < rand.length; i++) {
        const d = Math.hypot(rand[i][0] - p[0], rand[i][1] - p[1]);
        if (d < abst[i]) abst[i] = d;
      }
    }
  }
  // im Kreis ordnen (oben beginnend, im Uhrzeigersinn)
  const winkel = (p) => (Math.atan2(p[1] - my, p[0] - mx) + Math.PI * 2.5) % (Math.PI * 2);
  gewaehlt.sort((p, q) => winkel(p) - winkel(q));
  const ergebnis = {
    punkte: gewaehlt.map(([x, y]) => ({ x: (x + 0.5) / w, y: (y + 0.5) / h })),
    verhaeltnis: t.width / t.height,
  };
  CACHE.set(schluessel, ergebnis);
  return ergebnis;
}

// ---------------------------------------------------------------- Silhouette (einfarbig) zum Füllen

const SIL_GROESSE = 512;
let sil = null;   // { canvas, ctx, texture } – einmal je Modul (Texture.from(canvas) behält Pixi für immer)

/**
 * Silhouette des Bildes id in Farbe rgb auf die quadratische Modul-Leinwand zeichnen (eingepasst, mittig – die
 * längste Seite füllt das Quadrat). → { canvas, texture }
 */
export function silhouette(id, rgb) {
  if (!sil) {
    const canvas = document.createElement('canvas');
    canvas.width = SIL_GROESSE;
    canvas.height = SIL_GROESSE;
    sil = { canvas, ctx: canvas.getContext('2d'), texture: PIXI.Texture.from(canvas) };
  }
  const t = tex(id);
  const f = SIL_GROESSE / Math.max(t.width, t.height);
  const w = Math.round(t.width * f);
  const h = Math.round(t.height * f);
  const c = sil.ctx;
  c.save();
  c.globalCompositeOperation = 'source-over';
  c.clearRect(0, 0, SIL_GROESSE, SIL_GROESSE);
  c.drawImage(t.source.resource, (SIL_GROESSE - w) / 2, (SIL_GROESSE - h) / 2, w, h);
  c.globalCompositeOperation = 'source-in';
  c.fillStyle = '#' + rgb.toString(16).padStart(6, '0');
  c.fillRect(0, 0, SIL_GROESSE, SIL_GROESSE);
  c.restore();
  sil.texture.source.update();
  return { canvas: sil.canvas, texture: sil.texture };
}
