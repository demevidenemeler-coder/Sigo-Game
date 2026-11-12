// Spielplatz – drei Bilderbuch-Seiten:
//   1. Himmel (Wiese):      Luftballons ploppen, Seifenblasen ziehen, Drachen steigen lassen
//   2. Spielgeräte:          Schaukel anschubsen, Rutsche hinunter, Wippe, Federwippe und Karussell
//   3. Sandkasten:           nach Schätzen graben, Sandkuchen backen
// Start direkt auf einer Seite: ?szene=spielplatz&seite=2

import { ui } from '../../engine/index.js';
import { SeitenSzene } from '../../gemeinsam/seiten.js';
import { Himmel } from './himmel.js';
import { Geraete } from './geraete.js';
import { Sandkasten, sandkastenVorbereiten } from './sandkasten.js';

export default class Spielplatz extends SeitenSzene {
  static id = 'spielplatz';
  static packs = ['spielplatz', 'tiere'];
  static music = 'musik/bau';
  static seiten = [Himmel, Geraete, Sandkasten];

  vorbereiten() {
    ui.albumKnopf(this); // Ziel der Belohnungs-Sterne
    sandkastenVorbereiten(); // Hilfsbilder der Sanddecke zeichnen, solange die Blende zu ist (einmal je Sitzung)
  }
}
