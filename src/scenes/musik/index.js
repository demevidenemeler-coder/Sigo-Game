// Ort „Musik": zwei Bilderbuch-Seiten.
//   Seite 1 (Bühne):      die Tier-Band – Tiere antippen, sie spielen im gemeinsamen Takt (band.js)
//   Seite 2 (Musikzimmer): Xylophon, Klavier, Trommeln selbst spielen; „Alle meine Entchen" (instrumente.js)
// Keine Hintergrundmusik: der Ort macht seine Musik selbst (alle Töne über note()).

import { ui } from '../../engine/index.js';
import { SeitenSzene } from '../../gemeinsam/seiten.js';
import { Band } from './band.js';
import { Instrumente } from './instrumente.js';

export default class Musik extends SeitenSzene {
  static id = 'musik';
  static packs = ['musik', 'tiere'];
  static tiere = ['baer', 'katze', 'elefant', 'hase', 'affe', 'maus'];
  static seiten = [Band, Instrumente];

  vorbereiten() {
    ui.albumKnopf(this);
  }

  exit() {
    super.exit();
    for (const s of this.seiten || []) s?.aufraeumen?.();
  }
}
