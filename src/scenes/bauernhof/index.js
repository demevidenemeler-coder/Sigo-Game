// Ort „Bauernhof" – ein Bilderbuch mit vier Seiten:
// Jede Seite ist eine kleine Runde aus mehreren Schritten, die sich von Runde zu Runde etwas ändert, und auf jeder
// Seite wächst über die Runden etwas mit (bleibt gespeichert):
//   1. Füttern   (futterplatz.js) – Scheunentor öffnen, vier Tiere füttern, Wasser in den Trog gießen, Tiere
//                                   trinken lassen → sie ziehen auf die Weide (die Weide füllt sich)
//   2. Hühner    (huehner.js)     – Hahn weckt die Hennen, Eier in den Korb, versteckte Eier im Stroh suchen,
//                                   ein Ei ausbrüten → ein Küken schlüpft (die Kükenfamilie wächst)
//   3. Melken    (melken.js)      – Kuh füttern, melken, Eimer in die Kanne, Fläschchen füllen, ein Tierkind
//                                   trinken lassen → es schläft im Heu ein (bis zu drei Tierkinder)
//   4. Waschen   (waschen.js)     – Schwein: Matsch weg, einseifen, abspülen, abtrocknen, Handtuch an die Leine
//                                   (die Leine füllt sich); Schaf scheren, Wolle wächst bunt nach
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
  // alle Tiere, deren Bilder (tiere/<name>_*) der Bauernhof irgendwann zeigt – auch zufällige Gäste
  static tiere = ['kuh', 'schwein', 'schaf', 'pferd', 'huhn', 'hahn', 'hase', 'hund', 'katze', 'ente', 'maus'];
  static music = 'musik/wiese';
  static seiten = [Futterplatz, Huehner, Melken, Waschen];

  vorbereiten() {
    ui.albumKnopf(this);
  }
}
