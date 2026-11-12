// Testszene für den Baustein src/gemeinsam/zug.js: Standardzug auf einem Gleis vor Himmel und Wiese.
// Knöpfe unten: Fahren/Halten, Lok wechseln, Wagen dazu, Wagen weg, Gast einsteigen, Ladung, Pfeife.
// Lok antippen = pfeifen, Wagen antippen = Gäste jubeln, Gast antippen = freut sich.
// Zum Fernsteuern in Tests: window.__sigo.scene.zug (siehe zug.md).

import { Scene, stage, tap, ui, fx, PIXI } from '../../engine/index.js';
import {
  Zug, legeGleis, STANDARD_ZUG, LOKS, WAGEN, GAESTE_TIERE, GAESTE_MENSCHEN, LADUNGEN,
} from '../../gemeinsam/zug.js';

const GLEIS_Y = 1150;       // Schienenhöhe (Lauffläche)
const SKALA = 0.5;
const TEMPO = 220;          // Einheiten pro Sekunde

// Gäste der Reihe nach: groß, klein, Mensch, mittel …
const GAST_FOLGE = ['schaf', 'maus', 'kind_m', 'elefant', 'hase', 'oma', 'giraffe', 'frosch', 'papa', 'pinguin', 'kind_j', 'loewe'];

export default class Zugtest extends Scene {
  static id = 'zugtest';
  static packs = ['zug', 'tiere'];

  async enter() {
    this.baueLandschaft();
    this.gleis = legeGleis(this.world, { y: GLEIS_Y, z: 1, scale: SKALA });
    this.baue(STANDARD_ZUG);
    this.lokNr = 0;
    this.wagenNr = 2;
    this.gastNr = 0;
    this.ladungNr = 0;
    this.tauschNr = 0;
    this.baueKnoepfe();
  }

  /** Zug (neu) aufbauen – auch für Tests: __sigo.scene.baue({ lok, wagen: [{ typ, gast, ladung }] }) */
  baue(konfig) {
    const geschw = this.zug?.geschwindigkeit ?? 0;
    this.zug?.destroy({ children: true });
    this.zug = new Zug({ konfig, x: 0, y: GLEIS_Y, scale: SKALA, parent: this.world, szene: this, z: 5 });
    this.zug.geschwindigkeit = geschw;
    // alles am Zug reagiert beim Antippen – auch Wagen und Gäste, die später dazukommen
    this.zug.on('lok', (lok) => tap(lok, () => this.zug.pfeife(), { sound: null }));
    this.zug.on('wagen', (w) => this.tippbarerWagen(w));
    this.zug.on('gast', (w) => this.tippbarerGast(w));
    tap(this.zug.lok, () => this.zug.pfeife(), { sound: null });
    for (const w of this.zug.wagen) {
      this.tippbarerWagen(w);
      if (w.gast) this.tippbarerGast(w);
    }
    return this.zug;
  }

  tippbarerGast(w) {
    w.gast.onTap(() => this.zug.gaesteJubeln(w.index), { pad: 100 });
  }

  tippbarerWagen(w) {
    tap(w.koerper, () => {
      w.fahrzeug.wackel();
      this.zug.gaesteJubeln();
    });
  }

  // ---------------------------------------------------------------- Himmel und Wiese (Graphics)

  baueLandschaft() {
    const g = new PIXI.Graphics();
    g.rect(-1500, 0, 3000, 1600).fill(0xbfe4f6);
    g.rect(-1500, 0, 3000, 500).fill({ color: 0xa8d8f2, alpha: 0.6 });
    g.circle(-900, 260, 110).fill(0xffe28a);
    for (const [x, y, r] of [[-300, 230, 70], [-220, 210, 90], [-140, 235, 65], [600, 330, 60], [680, 305, 80], [750, 330, 55]]) {
      g.circle(x, y, r).fill(0xffffff);
    }
    g.ellipse(-700, 1000, 900, 260).fill(0x9fd38a);
    g.ellipse(800, 1020, 1000, 300).fill(0x8fca7c);
    g.rect(-1500, 1010, 3000, 600).fill(0x86c46f);
    g.rect(-1500, 1180, 3000, 420).fill(0x7bbb64);
    this.bg.addChild(g);
  }

  // ---------------------------------------------------------------- Knöpfe

  baueKnoepfe() {
    const knopf = (icon, onTap) => ui.button(icon, { size: 200, onTap, parent: this.hud });
    this.knoepfe = [
      this.fahrKnopf = knopf('common/icon_los', () => this.fahrenHalten()),
      knopf('zug/lok_diesel', () => this.naechsteLok()),
      knopf('zug/wagen_offen_blau', () => this.wagenDazu()),
      knopf('common/icon_muelleimer', () => this.zug.wagenWeg()),
      knopf('tiere/schaf_idle', () => this.gastRein()),
      knopf('zug/ladung_ball', () => this.ladungRein()),
      knopf('common/icon_musik', () => this.zug.pfeife()),
    ];
    this.ordneKnoepfe();
  }

  resize() {
    this.ordneKnoepfe();
  }

  ordneKnoepfe() {
    const n = this.knoepfe?.length ?? 0;
    this.knoepfe?.forEach((k, i) => k.position.set(stage.W / 2 + (i - (n - 1) / 2) * 235, stage.H - 70 - 115));
  }

  fahrenHalten() {
    if (this.zug.zielGeschwindigkeit !== 0) this.zug.halte();
    else this.zug.fahre(TEMPO);
    this.fahrKnopf.markiere(this.zug.zielGeschwindigkeit !== 0);
  }

  naechsteLok() {
    const jetzt = LOKS.indexOf(this.zug.lok.typ);
    this.zug.setzeLok(LOKS[(jetzt + 1) % LOKS.length]);
  }

  wagenDazu() {
    const typ = WAGEN[this.wagenNr % WAGEN.length];
    if (this.zug.wagenDazu(typ)) this.wagenNr++;
    else fx.wobble(this.knoepfe[2]);
  }

  gastRein() {
    const id = GAST_FOLGE[this.gastNr++ % GAST_FOLGE.length];
    let i = this.zug.freierPlatz();
    if (i < 0) {
      // alle Plätze besetzt: reihum tauschen
      const mitSitz = this.zug.wagen.filter((w) => w.platz?.art === 'sitz');
      if (!mitSitz.length) { fx.wobble(this.knoepfe[4]); return; }
      i = mitSitz[this.tauschNr++ % mitSitz.length].index;
    }
    this.zug.setzeGast(i, id);
  }

  ladungRein() {
    const w = this.zug.wagen.find((x) => x.platz && !x.ladung);
    if (!w) { fx.wobble(this.knoepfe[5]); return; }
    this.zug.setzeLadung(w.index, LADUNGEN[this.ladungNr++ % LADUNGEN.length]);
  }

  // ---------------------------------------------------------------- Ablauf

  update(dt) {
    this.zug.update(dt);
    this.gleis.rolle(this.zug.dx);
  }

  hints() {
    return [this.knoepfe[0], this.zug.lok];
  }
}

// für Tests aus der Konsole erreichbar
Zugtest.listen = { LOKS, WAGEN, GAESTE_TIERE, GAESTE_MENSCHEN, LADUNGEN };
