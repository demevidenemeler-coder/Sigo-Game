// Ort „Wald" – Bilderbuch mit drei Seiten, jede mit einem Ablauf aus mehreren Schritten:
//   1. Verstecken (Lichtung): Mama antippen → Spuren folgen → Versteck öffnen (tippen, Stein schieben, Laub
//      wegwischen) → Kind zur Mama ziehen; sind alle Familien zusammen: Foto für die Fotoleine
//   2. Waldnacht: müde Tiere mit der Taschenlampe finden → ins Bett bringen → mit einem Blatt zudecken → Gute Nacht;
//      dann Glühwürmchen ins Glas holen und freilassen – sie werden Sterne am Himmel
//   3. Picknick: Decke ausrollen → Gäste wünschen sich etwas → sammeln (Korb) → Teller decken → alle essen;
//      die Wimpelkette wächst mit jedem Picknick
//   4. Waldrand: Vogelhaus bauen (Dach, Nägel, aufhängen, Körner, Vögel singen) – die Häuser bleiben am Ast;
//      Eichhörnchen versteckt Nüsse, es schneit, es findet sie wieder, das Bäumchen wird gegossen und wächst
// Start direkt auf einer Seite: ?szene=wald&seite=1

import { music, ui } from '../../engine/index.js';
import { SeitenSzene } from '../../gemeinsam/seiten.js';
import { Verstecken } from './verstecken.js';
import { Nacht } from './nacht.js';
import { Sammeln } from './sammeln.js';
import { Waldrand } from './waldrand.js';

export default class Wald extends SeitenSzene {
  static id = 'wald';
  static packs = ['wald', 'tiere'];
  // alle Tiere, deren tiere/<name>_*-Bilder der Wald zeigt (das Reh kommt aus dem Wald-Paket)
  static tiere = ['fuchs', 'hase', 'eule', 'igel', 'baer', 'eichhoernchen'];
  static music = 'musik/wiese';
  static seiten = [Verstecken, Nacht, Sammeln, Waldrand];

  vorbereiten() {
    ui.albumKnopf(this);
  }

  // Nachts leise Nachtmusik, am Tag die Wiesenmusik – music() blendet weich über
  seiteGewechselt(neu) {
    if (neu instanceof Nacht) music('musik/nacht', { vol: 0.75 });
    else music('musik/wiese');
  }
}
