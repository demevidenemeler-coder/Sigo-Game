// Ort „Musik": drei Bilderbuch-Seiten.
//   Seite 1 (Bühne):      ein Konzert der Tier-Band als Kette – Vorhang auf, Instrumente austeilen, Licht an,
//                         Tiere einsetzen, Applaus und Blumen vom Gast, Vorhang zu (band.js)
//   Seite 2 (Werkstatt):  Rassel, Trommel oder Zupfkasten bauen, ins Regal stellen; Echo-Spiel mit drei Glocken
//                         (werkstatt.js)
//   Seite 3 (Musikzimmer): Xylophon, Klavier, Trommeln selbst spielen; ein Lied aussuchen, anhören, nachspielen,
//                         dann kommt Besuch und eine Note kommt an die Girlande (instrumente.js)
// Keine Hintergrundmusik: der Ort macht seine Musik selbst (alle Töne über note()).

import { ui } from '../../engine/index.js';
import { SeitenSzene } from '../../gemeinsam/seiten.js';
import { Band } from './band.js';
import { Instrumente } from './instrumente.js';
import { Werkstatt } from './werkstatt.js';

export default class Musik extends SeitenSzene {
  static id = 'musik';
  static packs = ['musik', 'tiere'];
  // Alle Tiere, die dieser Ort zeigt: Band, Maus, Gäste der Bühne und Gäste der Lieder
  // (Fuchs und Pinguin sind nur Gäste: nur die Posen, die sie hier zeigen)
  static tiere = ['baer', 'katze', 'elefant', 'hase', 'affe', 'maus', 'kuh', 'schaf', 'ente', 'frosch', 'igel', 'eule',
    'fuchs_idle', 'fuchs_happy', 'fuchs_seite', 'pinguin_idle', 'pinguin_happy', 'pinguin_seite'];
  // Die Werkstatt liegt in der Mitte: am Ende hätte das Musikzimmer einen Pfeil nach rechts bekommen, der auf
  // seinen Instrument-Knöpfen läge.
  static seiten = [Band, Werkstatt, Instrumente];

  vorbereiten() {
    ui.albumKnopf(this);
  }

  // Rückweg aus dem Stickerbuch: außer der Seite auch der Stand von Konzert, halb gebautem Instrument und Lied-Kette
  // (immer alle Felder, auch null – sonst bliebe ein älterer Stand aus den Startwerten hängen).
  rückkehr() {
    const band = (this.seiten || []).find((s) => s instanceof Band);
    const zimmer = (this.seiten || []).find((s) => s instanceof Instrumente);
    const werkstatt = (this.seiten || []).find((s) => s instanceof Werkstatt);
    // Eine Seite, die in diesem Besuch noch nicht gebaut wurde, behält den mitgebrachten Stand
    let konzert = this.params?.konzert ?? null;
    let liedkette = this.params?.liedkette ?? null;
    let werkbau = this.params?.werkbau ?? null;
    try {
      if (band?.gebaut) konzert = band.rueckweg();
      if (zimmer?.gebaut) liedkette = zimmer.rueckweg();
      if (werkstatt?.gebaut) werkbau = werkstatt.rueckweg();
    } catch (e) {
      console.error('[sigo] musik: Stand nicht lesbar', e);
    }
    return { ...super.rückkehr(), konzert, liedkette, werkbau };
  }

  exit() {
    super.exit();
    for (const s of this.seiten || []) s?.aufraeumen?.();
  }
}
