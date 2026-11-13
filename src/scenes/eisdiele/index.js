// Eisdiele – ein Ort mit drei Bilderbuch-Seiten:
//   1. Eisdiele: Bestellung als Kette – Waffel oder Becher wählen, Kugeln, Toppings, servieren, Münze in die Kasse.
//   2. Saftbar: Obst in den Mixer, mixen, Eiswürfel, einschenken, Strohhalm, Deko, dem Tier geben.
//   3. Eisküche: Eis selber machen (Milch, Frucht, kurbeln, Sorte ins Regal – das Regal bleibt über die Besuche)
//      und Eis am Stiel für einen Gast (Saft in die Form, Stiel, Kühltruhe, Schokolade, Streusel, geben).

import { ui } from '../../engine/index.js';
import { SeitenSzene } from '../../gemeinsam/seiten.js';
import { Theke } from './theke.js';
import { Saftbar } from './saftbar.js';
import { Eiskueche } from './eiskueche.js';

export default class Eisdiele extends SeitenSzene {
  static id = 'eisdiele';
  static packs = ['eisdiele', 'tiere'];
  // alle Tiere, deren Bilder dieser Ort zeigt (Kunden beider Seiten, auch ihre Kleinen und die Kunden-Wand)
  static tiere = [
    'hase', 'katze', 'hund', 'baer', 'fuchs', 'schwein', 'maus', 'igel', 'eichhoernchen', 'pinguin',
    'ente', 'frosch', 'affe', 'schaf', 'loewe', 'pferd', 'huhn', 'elefant', 'giraffe', 'kuh', 'eule', 'hahn',
  ];
  static music = 'musik/atelier';
  static seiten = [Theke, Saftbar, Eiskueche];

  vorbereiten() {
    ui.albumKnopf(this);   // Ziel der Belohnungs-Sterne (oben rechts)
  }
}
