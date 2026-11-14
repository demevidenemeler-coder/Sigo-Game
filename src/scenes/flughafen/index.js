// Flughafen – ein Ort mit drei Bilderbuch-Seiten:
//   1. Gepäck: Gäste bringen Koffer, Surfbrett, Vogelkäfig …: aufs Band legen, Anhänger vom Schalter, Knopf drücken,
//      das Band fährt durch den Tunnel, auf den Gepäckwagen laden; ist der Wagen voll, zieht ihn der Schlepper zum
//      Flugzeug, ein Flieger hebt in der Ferne ab, und später kommt eine Postkarte an die Pinnwand (bleibt).
//   2. Startklar: Flugzeug, Hubschrauber, Doppeldecker oder Heißluftballon fertig machen – tanken (bzw. aufblasen),
//      Fenster putzen, Treppe, einsteigen, Tür zu, der Lotsen-Bär winkt, und der Flieger rollt gemächlich los.
//   3. Über den Wolken: den Flieger mit dem Finger führen, Regenwolke, Vögel und Ballon begegnen, an einem Ziel
//      landen (Meer, Berge, Schnee, Insel – jedes Mal ein anderes), Postkarte für die Pinnwand.
// Start direkt auf einer Seite: ?szene=flughafen&seite=2

import { ui } from '../../engine/index.js';
import { SeitenSzene } from '../../gemeinsam/seiten.js';
import { GAESTE } from './helfer.js';
import { Gepaeck } from './gepaeck.js';
import { Startklar } from './startklar.js';
import { Himmel } from './himmel.js';

export default class Flughafen extends SeitenSzene {
  static id = 'flughafen';
  static packs = ['flughafen', 'zug', 'tiere'];
  // alle Tiere, deren Bilder der Flughafen zeigen kann: die zufälligen Gäste und der Lotsen-Bär
  static tiere = [...GAESTE, 'baer'];
  static music = 'musik/fahrt';
  static seiten = [Gepaeck, Startklar, Himmel];

  vorbereiten() {
    ui.albumKnopf(this);
  }
}
