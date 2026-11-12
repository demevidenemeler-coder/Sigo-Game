// Ort „Bauernhof" – ein Bilderbuch mit vier Seiten:
//   1. Füttern   (futterplatz.js) – vier Hoftiere, Futter aus der Leiste zum Tier ziehen
//   2. Hühner    (huehner.js)     – Hühner legen Eier, Eier in den Korb, manchmal schlüpft ein Küken
//   3. Melken    (melken.js)      – Euter antippen/halten, vollen Eimer zur Kanne ziehen, Katze bekommt Milch
//   4. Waschen   (waschen.js)     – Matsch und Schaum vom Schwein, Schaf scheren
// Start direkt auf einer Seite: ?szene=bauernhof&seite=2

import { ui } from '../../engine/index.js';
import { SeitenSzene } from '../../gemeinsam/seiten.js';
import { Futterplatz } from './futterplatz.js';
import { Huehner } from './huehner.js';
import { Melken } from './melken.js';
import { Waschen } from './waschen.js';

export default class Bauernhof extends SeitenSzene {
  static id = 'bauernhof';
  static packs = ['bauernhof', 'tiere'];
  static music = 'musik/wiese';
  static seiten = [Futterplatz, Huehner, Melken, Waschen];

  vorbereiten() {
    ui.albumKnopf(this);
  }
}
