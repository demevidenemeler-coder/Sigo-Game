// Zoo – ein Ort mit drei Bilderbuch-Seiten:
//   1. Fütterung: Futter aus der Kiste in den Wagen, Wagen zum Gehege, füttern (jedes Tier anders: Korb am Seil,
//      Futter werfen, Fisch ins Becken …), Wasser pumpen, das Tier freut sich.
//   2. Tierpflege: abwechselnd den Elefanten waschen, dem Löwen die Mähne machen oder dem Bären ein Strohbett bauen.
//   3. Tierkinder: ein Tierkind fährt mit der Zoo-Bahn zu seiner Mama, das Tor geht auf, ein Foto kommt an die
//      Fotowand – die Fotowand wächst über alle Besuche (gespeichert unter zoo.fotos).
// Start direkt auf einer Seite: ?szene=zoo&seite=2

import { ui } from '../../engine/index.js';
import { SeitenSzene } from '../../gemeinsam/seiten.js';
import { Fuetterung } from './futter.js';
import { Pflege } from './pflege.js';
import { Tierkinder } from './kinder.js';

export default class Zoo extends SeitenSzene {
  static id = 'zoo';
  static packs = ['zoo', 'tiere', 'zug'];
  // alle Tiere, die der Zoo zeigen kann (Zootiere, Mamas und Kinder, Mitfahrer der Zoo-Bahn)
  static tiere = ['giraffe', 'loewe', 'elefant', 'affe', 'pinguin', 'baer', 'hase', 'schaf', 'ente', 'schwein'];
  static music = 'musik/wiese';
  static seiten = [Fuetterung, Pflege, Tierkinder];

  vorbereiten() {
    ui.albumKnopf(this);   // Ziel der Belohnungs-Sterne (oben rechts)
  }
}
