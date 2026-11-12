// Eisdiele – ein Ort mit zwei Bilderbuch-Seiten:
//   1. Eisdiele: Bestellung als Kette – Waffel oder Becher wählen, Kugeln, Toppings, servieren, Münze in die Kasse.
//   2. Saftbar: Obst in den Mixer, mixen, Eiswürfel, einschenken, Strohhalm, Deko, dem Tier geben.

import { ui } from '../../engine/index.js';
import { SeitenSzene } from '../../gemeinsam/seiten.js';
import { Theke } from './theke.js';
import { Saftbar } from './saftbar.js';

export default class Eisdiele extends SeitenSzene {
  static id = 'eisdiele';
  static packs = ['eisdiele', 'tiere'];
  // alle Tiere, deren Bilder dieser Ort zeigt (Kunden beider Seiten, auch ihre Kleinen und die Kunden-Wand)
  static tiere = [
    'hase', 'katze', 'hund', 'baer', 'fuchs', 'schwein', 'maus', 'igel', 'eichhoernchen', 'pinguin',
    'ente', 'frosch', 'affe', 'schaf', 'loewe', 'pferd', 'huhn', 'elefant', 'giraffe', 'kuh',
  ];
  static music = 'musik/atelier';
  static seiten = [Theke, Saftbar];

  vorbereiten() {
    ui.albumKnopf(this);   // Ziel der Belohnungs-Sterne (oben rechts)
  }
}
