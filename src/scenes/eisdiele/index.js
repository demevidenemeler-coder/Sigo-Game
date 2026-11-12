// Eisdiele – ein Ort mit zwei Bilderbuch-Seiten:
//   1. Eisdiele: Tier-Kunden wünschen sich ein Eis (Denkblase), das Kind füllt die Waffel und gibt sie ihnen.
//   2. Saftbar: Obst in den Mixer, Knopf drücken, Saft ins Glas gießen und dem Tier geben.

import { ui } from '../../engine/index.js';
import { SeitenSzene } from '../../gemeinsam/seiten.js';
import { Theke } from './theke.js';
import { Saftbar } from './saftbar.js';

export default class Eisdiele extends SeitenSzene {
  static id = 'eisdiele';
  static packs = ['eisdiele', 'tiere'];
  static tiere = ['hase', 'katze', 'hund', 'baer', 'fuchs', 'schwein', 'maus', 'igel', 'eichhoernchen', 'pinguin', 'ente', 'frosch', 'affe', 'schaf', 'loewe', 'pferd', 'huhn', 'elefant', 'giraffe', 'kuh'];
  static music = 'musik/atelier';
  static seiten = [Theke, Saftbar];

  vorbereiten() {
    ui.albumKnopf(this);   // Ziel der Belohnungs-Sterne (oben rechts)
  }
}
