// Ort „Wald" – Bilderbuch mit drei Seiten:
//   1. Verstecken (Lichtung): Tierkinder hinter Büschen finden und zur Mama bringen
//   2. Waldnacht: mit dem Finger als Taschenlampe schlafende Tiere sanft wecken, Glühwürmchen, Eule
//   3. Sammeln: Pilze, Beeren, Nüsse in den Korb; Eichhörnchen füttern; Specht klopft
// Start direkt auf einer Seite: ?szene=wald&seite=1

import { music, ui } from '../../engine/index.js';
import { SeitenSzene } from '../../gemeinsam/seiten.js';
import { Verstecken } from './verstecken.js';
import { Nacht } from './nacht.js';
import { Sammeln } from './sammeln.js';

export default class Wald extends SeitenSzene {
  static id = 'wald';
  static packs = ['wald', 'tiere'];
  static music = 'musik/wiese';
  static seiten = [Verstecken, Nacht, Sammeln];

  vorbereiten() {
    ui.albumKnopf(this);
  }

  // Nachts leise Nachtmusik, am Tag die Wiesenmusik – music() blendet weich über
  seiteGewechselt(neu) {
    if (neu instanceof Nacht) music('musik/nacht', { vol: 0.75 });
    else music('musik/wiese');
  }
}
