// Ort „Bäckerei": ein Bilderbuch mit drei Seiten.
//   1. Backstube        – Zutaten in die Schüssel, rühren, kneten, formen (Brezel, Brötchen, Hörnchen, Brot),
//                          in den warmen Ofen, herausholen, in den Korb
//   2. Zuckerbäckerei   – abwechselnd Kekse (ausrollen, ausstechen, backen, Zuckerguss, Streusel, einem Gast
//                          schenken, ins Keksglas) und eine Geburtstagstorte (Böden, Creme, Früchte, Kerzen, pusten)
//   3. Laden            – Gäste kommen mit Wünschen (Tüte packen, zufalten, geben, Kasse) oder das Lieferrad wird
//                          beladen; das Wandregal füllt sich mit allem, was in der Backstube gebacken wurde
// Start direkt auf einer Seite: ?szene=baeckerei&seite=2

import { ui } from '../../engine/index.js';
import { SeitenSzene } from '../../gemeinsam/seiten.js';
import { Backstube } from './backstube.js';
import { Zuckerbaeckerei } from './zuckerbaeckerei.js';
import { Laden } from './laden.js';

export default class Baeckerei extends SeitenSzene {
  static id = 'baeckerei';
  static packs = ['baeckerei', 'tiere'];
  // alle Tiere, deren Bilder dieser Ort zeigt: Bäcker-Tiere, die Maus im Korb, Geburtstags- und Keks-Gäste,
  // Kundschaft im Laden und die Boten am Lieferrad
  static tiere = [
    'baer', 'schwein', 'hund', 'katze', 'schaf', 'maus',
    'hase', 'igel', 'eichhoernchen', 'fuchs', 'ente', 'pinguin', 'kuh', 'pferd', 'elefant', 'giraffe', 'affe',
    'loewe', 'huhn', 'frosch',
  ];
  static music = 'musik/atelier';
  static seiten = [Backstube, Zuckerbaeckerei, Laden];

  vorbereiten() {
    ui.albumKnopf(this);
  }
}
