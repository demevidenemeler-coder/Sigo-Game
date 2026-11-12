// Ort „Teich": zwei Bilderbuch-Seiten
//   1. Am Teich  – Frosch hüpft über Seerosenblätter, Enten mit Küken fressen Brotkrümel, Libelle, Papierboot
//   2. Angeln    – Katze auf dem Steg angelt mit dem Magnet-Köder Fische und Überraschungen
// Start direkt auf einer Seite: ?szene=teich&seite=1

import { ui } from '../../engine/index.js';
import { SeitenSzene } from '../../gemeinsam/seiten.js';
import { AmTeich } from './amteich.js';
import { Angeln } from './angeln.js';

export default class Teich extends SeitenSzene {
  static id = 'teich';
  static packs = ['teich', 'tiere'];
  static music = 'musik/wiese';
  static seiten = [AmTeich, Angeln];

  vorbereiten() {
    ui.albumKnopf(this);
  }
}
