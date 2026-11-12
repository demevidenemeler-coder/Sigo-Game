// Spielplatz – drei Bilderbuch-Seiten:
//   1. Himmel (Wiese):      Ballonfahrt eines Gastes (fangen, fliegen, landen, Picknick); Luftballons, Seifenblasen,
//                            Drachen
//   2. Spielgeräte:          ein Gast wünscht sich drei Geräte nacheinander (Schaukel, Rutsche, Wippe, Federwippe,
//                            Karussell); Girlande wächst mit jedem Gast
//   3. Sandkasten:           Sandburg (Eimer füllen, stürzen, klopfen, Schätze ausgraben, Fahnen, Wassergraben);
//                            Sandkuchen backen
// Start direkt auf einer Seite: ?szene=spielplatz&seite=2

import { ui } from '../../engine/index.js';
import { SeitenSzene } from '../../gemeinsam/seiten.js';
import { Himmel } from './himmel.js';
import { Geraete } from './geraete.js';
import { Sandkasten, sandkastenVorbereiten } from './sandkasten.js';

export default class Spielplatz extends SeitenSzene {
  static id = 'spielplatz';
  static packs = ['spielplatz', 'tiere'];
  // alle Tiere, die der Spielplatz zeigt (auch zufällige Gäste) – der Kern lädt nur diese
  static tiere = [
    'maus', 'hase', 'igel', 'ente', 'frosch', 'schaf', 'eichhoernchen', 'pinguin', 'fuchs',   // Himmel (Maus + Gäste)
    'katze', 'schwein', 'affe', 'baer', 'huhn', 'hund',                                         // Geräte (+ Gäste), Sand
  ];
  static music = 'musik/bau';
  static seiten = [Himmel, Geraete, Sandkasten];

  vorbereiten() {
    ui.albumKnopf(this); // Ziel der Belohnungs-Sterne
    sandkastenVorbereiten(); // Hilfsbilder der Sanddecke zeichnen, solange die Blende zu ist (einmal je Sitzung)
  }
}
