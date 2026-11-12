// Ort „Feuerwehr": drei Bilderbuch-Seiten, die zusammen eine große Kette bilden (jede Seite geht auch für sich):
//   1. Wache      – Glocke läuten (der Fuchs zeigt, was los ist) → Fuchs die Stange hinunterziehen → Helme für die
//                   Mannschaft → alle steigen ein → Auto antippen: Tatü, hinaus. Zurück: Orden an die Wand.
//   2. Einsatz    – wechselnde Einsätze: Feuer im Fenster, Feuer im Mülleimer (Schlauch zum Hydranten ziehen,
//                   Hydrant aufdrehen, löschen, Schlauch einrollen) oder Katze im Baum, Ballon im Baum, Entenkind
//                   auf dem Dach (Leiter aufrichten, Korb hinaufziehen, Korb herunterziehen) → alle steigen ein, zurück.
//   3. Waschplatz – Schmutz wechselt (Matsch, Ruß, Laub, Sand): wischen → Schwamm in den Schaum-Eimer →
//                   einschäumen → abspülen → mit dem Tuch polieren → Auto antippen, es fährt heim. Wimpel wachsen.
// Start direkt auf einer Seite: ?szene=feuerwehr&seite=1

import { ui } from '../../engine/index.js';
import { SeitenSzene } from '../../gemeinsam/seiten.js';
import { Wache } from './wache.js';
import { Einsatz } from './einsatz.js';
import { Waschplatz } from './waschplatz.js';

export default class Feuerwehr extends SeitenSzene {
  static id = 'feuerwehr';
  static packs = ['feuerwehr', 'tiere'];
  // Alle Tiere, die dieser Ort irgendwann zeigt (Fahrer, Mannschaft, Gerettete, Gäste)
  static tiere = ['fuchs', 'hund', 'katze', 'baer', 'affe', 'schwein', 'hase', 'igel', 'maus', 'ente', 'frosch'];
  static music = 'musik/bau';
  static seiten = [Wache, Einsatz, Waschplatz];

  vorbereiten() {
    this.autoKommt = false;     // Wache → Einsatz: das Auto fährt auf der Einsatz-Seite herein
    this.waschKommt = false;    // Einsatz → Waschplatz: das schmutzige Auto fährt auf den Waschplatz
    this.einsatzWahl = null;    // beim Alarm gewählter Einsatz (die Einsatz-Seite übernimmt ihn)
    this.letzterEinsatz = null; // nie zweimal derselbe hintereinander
    this.mannschaft = null;     // wer mit Helm mitgefahren ist (Tier-ids)
    this.schmutz = null;        // wie schmutzig das Auto vom letzten Einsatz kommt
    this.ordenOffen = 0;        // geschaffte Einsätze, deren Orden noch nicht an der Wand der Wache hängt
    ui.albumKnopf(this);
  }
}
