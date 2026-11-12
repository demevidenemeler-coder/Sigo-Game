// Ort „Garten": ein Bilderbuch mit drei Seiten.
//   1. Beet       – säen, gießen, ernten (Korb und Hase), kleine Gäste
//   2. Blumenwiese – Blumen öffnen und klingen lassen, Schmetterlinge, Regenbogen
//   3. Obstbaum   – Baum schütteln, Obst in die passenden Körbe sortieren, der Igel kommt
// Start direkt auf einer Seite: ?szene=garten&seite=2

import { ui } from '../../engine/index.js';
import { SeitenSzene } from '../../gemeinsam/seiten.js';
import { Beet } from './beet.js';
import { Wiese } from './wiese.js';
import { Obst } from './obst.js';

export default class Garten extends SeitenSzene {
  static id = 'garten';
  static packs = ['garten', 'tiere'];
  static music = 'musik/wiese';
  static seiten = [Beet, Wiese, Obst];

  vorbereiten() {
    ui.albumKnopf(this);
  }
}
