// Dankesbilder: Wer gerettet wurde, malt der Feuerwehr ein Bild (sich selbst und das, was passiert ist).
// Die Bilder kleben mit zwei Klebestreifen am Rolltor der Wache – je Einsatz-Art eines, die Sammlung wächst über
// die Besuche (gespeichert in einsaetze.js: dankListe/dankDazu).
// Gezeichnet mit weichen Formen (Papier, Buntstift-Rand), darauf das fröhliche Tier und ein kleines Bild des Einsatzes.

import { spr, PIXI } from '../../engine/index.js';
import { EINSAETZE } from './einsaetze.js';

const { Container, Graphics } = PIXI;

export const DANK_B = 196;    // Breite des Papiers (Einheiten, bei Größe 1)
export const DANK_H = 164;

// Buntstift-Farbe des Randes je Einsatz
const RAND = {
  fenster: 0xe8705f, muell: 0x7fb069, katze: 0xf0a05a, ballon: 0xe86f8a,
  kueken: 0xf2bd55, drachen: 0x74b6e2, laterne: 0xd9a52b, kuebel: 0xc8a6e8,
};

/** Ein Dankesbild als Container (Mitte = Mitte des Papiers). */
export function dankBild(id) {
  const e = EINSAETZE[id];
  const c = new Container({ label: 'dankbild' });
  const b = DANK_B;
  const h = DANK_H;
  const farbe = RAND[id] ?? 0xe8705f;
  const papier = new Graphics()
    .roundRect(-b / 2 + 5, -h / 2 + 7, b, h, 12).fill({ color: 0x5a3020, alpha: 0.18 })   // weicher Schatten
    .roundRect(-b / 2, -h / 2, b, h, 12).fill(0xfff8ec)
    .roundRect(-b / 2 + 10, -h / 2 + 10, b - 20, h - 20, 10).stroke({ width: 6, color: farbe, alpha: 0.85 })
    // ein bisschen gemalte Wiese und Sonne
    .roundRect(-b / 2 + 16, h / 2 - 34, b - 32, 14, 7).fill({ color: 0x93c86f, alpha: 0.75 })
    .circle(b / 2 - 34, -h / 2 + 32, 13).fill({ color: 0xf5d36a, alpha: 0.9 });
  c.addChild(papier);
  if (e) {
    const tier = spr(`tiere/${e.retter}_happy`, { parent: c });
    tier.anchor.set(0.5, 1);
    tier.scale.set(104 / Math.max(tier.texture.height, 1));
    tier.position.set(-30, h / 2 - 22);
    const ding = spr(e.icon, { parent: c });
    ding.anchor.set(0.5);
    ding.scale.set(58 / Math.max(ding.texture.width, ding.texture.height, 1));
    if (id === 'ballon') ding.tint = 0xff7d7d;
    ding.position.set(48, 6);
  }
  // zwei Klebestreifen oben
  // jeder Streifen wird eigens gezeichnet (kein clone(): der würde die Zeichendaten teilen, siehe stage.js)
  const streifenNeu = () => new Graphics().rect(-22, -9, 44, 18).fill({ color: 0xf6efd2, alpha: 0.8 });
  const streifen = streifenNeu();
  const s2 = streifenNeu();
  streifen.position.set(-b / 2 + 22, -h / 2 + 2);
  streifen.rotation = -0.5;
  s2.position.set(b / 2 - 22, -h / 2 + 2);
  s2.rotation = 0.5;
  c.addChild(streifen, s2);
  return c;
}
