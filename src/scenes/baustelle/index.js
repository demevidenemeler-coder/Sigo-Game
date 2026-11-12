// Ort „Baustelle" – drei Bilderbuch-Seiten:
//   1. Baggern:  Bagger schaufelt Sand vom Sandberg in den Kipper; voll → Kipper fährt hinaus und kommt leer zurück
//   2. Hausbau:  Kran setzt Hausteile auf das Fundament (antippen oder selbst ziehen); fertig → ein Tier zieht ein
//   3. Straße:   Walze folgt dem Finger und walzt die Holperdecke glatt, dann weiße Striche, dann fahren alle darüber
// Start direkt auf einer Seite: ?szene=baustelle&seite=1&test=1

import { ui, voice } from '../../engine/index.js';
import { SeitenSzene } from '../../gemeinsam/seiten.js';
import { Grube } from './grube.js';
import { Hausbau } from './hausbau.js';
import { Strasse } from './strasse.js';

export default class Baustelle extends SeitenSzene {
  static id = 'baustelle';
  // (Ball, Teddy und Geschenk der Grube-Besucher liegen im Zug-Paket. Es steht absichtlich NICHT hier: 3 MB nur
  // dafür wären zu viel Ladezeit. Ist es geladen – im Spiel über die Karte –, kommen alle 8 Besucher; jeder Besuch
  // prüft das neu, sonst kommen die 5 Futter-Besucher.)
  static packs = ['baustelle', 'tiere'];
  // alle Tiere, die hier je zu sehen sind (auch Besucher, Bewohner, Gäste und Zuschauer, die zufällig kommen)
  static tiere = ['affe', 'pinguin', 'hund', 'eichhoernchen', 'maus', 'hase', 'baer', 'katze', 'schaf', 'frosch', 'igel', 'ente', 'fuchs', 'schwein'];
  static music = 'musik/bau';
  static seiten = [Grube, Hausbau, Strasse];

  vorbereiten() {
    ui.albumKnopf(this);
    voice('baustelle_hallo');
  }

  exit() {
    super.exit();
    for (const s of this.seiten || []) {
      try { s?.aufraeumen?.(); } catch (e) { console.error('[baustelle] aufraeumen:', e); }
    }
  }
}
