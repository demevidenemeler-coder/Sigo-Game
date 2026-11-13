// Ort „Garten": ein Bilderbuch mit drei Seiten.
//   1. Beet       – ein Gast wünscht sich Gemüse: Unkraut zupfen, säen, gießen, ernten, waschen, verschenken
//   2. Blumenwiese – Blumen öffnen und klingen lassen, einen Strauß pflücken, Schleife binden, verschenken
//   3. Obstbaum   – schütteln, sortieren, in die Saftpresse füllen, kurbeln, Saft an die Gäste verteilen
//   4. Gartenküche – abwechselnd Gemüsesuppe kochen (waschen, schneiden, rühren, schöpfen, servieren) oder
//                    Marmelade einmachen (Obst in den Topf, rühren, abfüllen, Deckel, ins Regal, Brot bestreichen)
// Start direkt auf einer Seite: ?szene=garten&seite=3

import { ui } from '../../engine/index.js';
import { SeitenSzene } from '../../gemeinsam/seiten.js';
import { Beet } from './beet.js';
import { Wiese } from './wiese.js';
import { Obst } from './obst.js';
import { Kueche } from './kueche.js';

export default class Garten extends SeitenSzene {
  static id = 'garten';
  static packs = ['garten', 'tiere'];
  // alle Tiere, deren Bilder (tiere/<name>_*) der Garten zeigt – auch die zufällig gewählten Gäste
  static tiere = ['hase', 'schwein', 'baer', 'eichhoernchen', 'pferd', 'ente', 'igel', 'maus', 'kuh', 'schaf',
    'katze', 'huhn', 'frosch', 'fuchs', 'hund'];
  static music = 'musik/wiese';
  static seiten = [Beet, Wiese, Obst, Kueche];

  vorbereiten() {
    ui.albumKnopf(this);
  }
}
