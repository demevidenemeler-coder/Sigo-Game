// Ort „Feuerwehr": drei Bilderbuch-Seiten.
//   1. Wache      – Glocke, Rolltor, Fuchs rutscht die Stange hinunter, Auto fährt los; Helme für Hund, Katze, Bär
//   2. Einsatz    – Flämmchen in den Fenstern mit dem Wasserstrahl löschen, Katze mit der Leiter vom Ast holen
//   3. Waschplatz – Matsch wegwischen, einschäumen, abspülen; das Auto fährt hinaus und kommt schmutzig wieder
// Start direkt auf einer Seite: ?szene=feuerwehr&seite=1

import { ui } from '../../engine/index.js';
import { SeitenSzene } from '../../gemeinsam/seiten.js';
import { Wache } from './wache.js';
import { Einsatz } from './einsatz.js';
import { Waschplatz } from './waschplatz.js';

export default class Feuerwehr extends SeitenSzene {
  static id = 'feuerwehr';
  static packs = ['feuerwehr', 'tiere', 'waschanlage'];
  static tiere = ['fuchs', 'hund', 'katze', 'baer', 'hase', 'hahn'];
  static music = 'musik/bau';
  static seiten = [Wache, Einsatz, Waschplatz];

  vorbereiten() {
    this.autoKommt = false;   // Wache → Einsatz: das Auto fährt auf der Einsatz-Seite herein
    ui.albumKnopf(this);
  }
}
