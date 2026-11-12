// Ort „Musik": zwei Bilderbuch-Seiten.
//   Seite 1 (Bühne):      ein Konzert der Tier-Band als Kette – Vorhang auf, Instrumente austeilen, Licht an,
//                         Tiere einsetzen, Applaus und Blumen vom Gast, Vorhang zu (band.js)
//   Seite 2 (Musikzimmer): Xylophon, Klavier, Trommeln selbst spielen; ein Lied aussuchen, anhören, nachspielen,
//                         dann kommt Besuch und eine Note kommt an die Girlande (instrumente.js)
// Keine Hintergrundmusik: der Ort macht seine Musik selbst (alle Töne über note()).

import { ui } from '../../engine/index.js';
import { SeitenSzene } from '../../gemeinsam/seiten.js';
import { Band } from './band.js';
import { Instrumente } from './instrumente.js';

export default class Musik extends SeitenSzene {
  static id = 'musik';
  static packs = ['musik', 'tiere'];
  // Alle Tiere, die dieser Ort zeigt: Band, Maus, Gäste der Bühne und Gäste der Lieder
  static tiere = ['baer', 'katze', 'elefant', 'hase', 'affe', 'maus', 'kuh', 'schaf', 'ente', 'frosch', 'igel', 'eule'];
  static seiten = [Band, Instrumente];

  vorbereiten() {
    ui.albumKnopf(this);
  }

  // Rückweg aus dem Stickerbuch: außer der Seite auch der Stand von Konzert und Lied-Kette (immer beide Felder,
  // auch null – sonst bliebe ein älterer Stand aus den Startwerten hängen).
  rückkehr() {
    const [band, zimmer] = this.seiten || [];
    // Eine Seite, die in diesem Besuch noch nicht gebaut wurde, behält den mitgebrachten Stand
    let konzert = this.params?.konzert ?? null;
    let liedkette = this.params?.liedkette ?? null;
    try {
      if (band?.gebaut) konzert = band.rueckweg();
      if (zimmer?.gebaut) liedkette = zimmer.rueckweg();
    } catch (e) {
      console.error('[sigo] musik: Stand nicht lesbar', e);
    }
    return { ...super.rückkehr(), konzert, liedkette };
  }

  exit() {
    super.exit();
    for (const s of this.seiten || []) s?.aufraeumen?.();
  }
}
