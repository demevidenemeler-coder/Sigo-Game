// Seite 2: Im Musikzimmer selbst spielen.
//
// Groß in der Mitte eins von drei Instrumenten, gewählt mit drei großen Bild-Knöpfen rechts:
//   Xylophon  – 8 Regenbogen-Stäbe; antippen oder mit dem Finger darüberstreichen (jeder Finger zählt)
//   Klavier   – 8 große Tasten, ebenfalls zum Tippen und Streichen
//   Trommeln  – große Trommel, Becken, Triangel, Bongos, Tamburin, Rasseln zum Antippen
// Links steht ein Notenständer mit einem Entchen: Antippen spielt „Alle meine Entchen" langsam vor, die passenden
// Stäbe/Tasten leuchten dabei weich auf (≥ 0,5 s) – mitspielen geht, falsch gibt es nicht. Auf dem Notenständer
// sitzt ein kleiner Vogel, rechts tanzt eine Maus zur Musik.

import { stage, spr, meta, tap, Actor, fx, note, voice, animal, rand, clamp, ease, PIXI } from '../../engine/index.js';
import { Seite } from '../../gemeinsam/seiten.js';
import { belohne } from '../../gemeinsam/sticker.js';
import { Klangleiste } from './klangleiste.js';
import {
  REGENBOGEN, XYLO_TOENE, baueXylophon, xylophonIcon, klavierKoerper, vogel, entchenBild,
} from './deko.js';

const BODEN = 1300;            // hier stehen die großen Instrumente auf dem Holzboden (hg_instrumente)
const XYLO_SKALA = 1.42;       // Stäbe ≈ 185 breit, ≈ 700 hoch
const XYLO_ORT = { x: -20, y: 740 };
const TASTE_B = 186;           // Breite einer Klaviertaste (Einheiten)
const TASTE_A = 14;            // Abstand zwischen zwei Tasten (Feld je Taste = 200 breit, lückenlos)
const TASTE_H = 540;
const KLAVIER_ORT = { x: 0, y: 560 };   // Mitte oben der Tasten
const KLAVIER_TOENE = [60, 62, 64, 65, 67, 69, 71, 72];
const STICKER_AB = 30;         // so viele selbst gespielte Töne bis zum Sticker
const LIED_SCHLAG = 0.6;       // Sekunden pro Viertel beim Vorspielen (gemächlich)
const LICHT_ZEIT = 0.5;        // Sekunden für weiches Auf- und Abblenden der Leucht-Hilfe
const VORSCHAU_AB = 1.5;       // Sekunden Abstand zwischen zwei ganzen Vorschau-Grüßen (Töne nicht stapeln)
const EINZELTON_AB = 0.6;      // Sekunden Abstand zwischen zwei leisen Einzeltönen beim Wieder-Antippen
const UEBERBLENDEN = 0.5;      // Sekunden je Schritt beim Instrumenten-Wechsel (neues ein, dann altes aus)

// „Alle meine Entchen": [Stab/Taste 0…7, Länge in Vierteln]
const ENTCHEN = [
  [0, 1], [1, 1], [2, 1], [3, 1], [4, 2], [4, 2],
  [5, 1], [5, 1], [5, 1], [5, 1], [4, 4],
  [5, 1], [5, 1], [5, 1], [5, 1], [4, 4],
  [3, 1], [3, 1], [3, 1], [3, 1], [2, 2], [2, 2],
  [1, 1], [1, 1], [1, 1], [1, 1], [0, 4],
];

// Trommel-Ecke: Bild, Ort, Größe, Bewegung beim Antippen. Was steht, steht mit den Füßen bei (x, y) auf dem
// Holzboden; was hängt (haken), hängt an einem Holzknauf an der Wand und schwingt beim Antippen.
const TROMMELN = [
  { id: 'tamburin', bild: 'musik/tamburin', x: -470, y: 410, s: 0.62, bewegung: 'schwingen', haken: true, band: 46 },
  { id: 'triangel', bild: 'musik/triangel', x: 430, y: 400, s: 0.64, bewegung: 'schwingen', haken: true, band: 0, ax: 0.39 },
  { id: 'becken', bild: 'musik/becken', x: -700, y: 1300, s: 0.88, bewegung: 'wackeln' },
  { id: 'trommel', bild: 'musik/trommel_gross', x: -60, y: 1310, s: 0.74, bewegung: 'hopsen' },
  { id: 'bongos', bild: 'musik/bongos', x: 510, y: 1300, s: 0.86, bewegung: 'hopsen' },
  { id: 'rassel', bild: 'musik/rassel', x: -370, y: 1490, s: 0.6, bewegung: 'rasseln' },
];

const WAHL = ['xylo', 'klavier', 'trommeln'];

export class Instrumente extends Seite {
  static hg = 'musik/hg_instrumente';

  aufbau() {
    this.gespielt = 0;
    this.stickerBei = STICKER_AB;
    this.energie = 0;
    this.tanzSchlag = 0;
    this.letzteNote = -1;    // Zeit der letzten aufsteigenden Note (nicht zu viele)
    this.letzterSprung = -1;
    this.lied = null;
    this.instrument = null;  // gewählt (Knopf, Eingabe, Lied)
    this.gezeigt = null;     // groß auf der Bühne (folgt der Wahl weich, siehe buehneNachfuehren)
    this.blende = null;      // laufende Überblendung {von, nach, k}
    this.vorschauZeit = [];  // Zeitgeber der laufenden Vorschau-Folge (beim neuen Tipp abbrechen)
    this.letzteVorschau = -99;
    this.letzterEinzelton = -99;
    this.blinzeln = rand(2, 4);

    this.buehne = new PIXI.Container({ label: 'instrumente' });
    this.buehne.zIndex = 10;
    this.buehne.sortableChildren = true;   // beim Wechsel liegt das neue Instrument oben (buehneNachfuehren)
    this.obenauf = 0;
    this.welt.addChild(this.buehne);

    this.baueXylophon();
    this.baueKlavier();
    this.baueTrommeln();
    this.baueWahl();
    this.baueNotenstaender();
    this.baueMaus();
    this.baueWandbilder();
    this.ordne();
    this.wahl('xylo', { sofort: true });
  }

  // ---------------------------------------------------------------- Xylophon

  baueXylophon() {
    const x = baueXylophon({ bodenY: (BODEN - XYLO_ORT.y) / XYLO_SKALA });
    x.c.position.set(XYLO_ORT.x, XYLO_ORT.y);
    x.c.scale.set(XYLO_SKALA);
    x.c.sortableChildren = true;
    this.buehne.addChild(x.c);
    this.xylo = x;
    this.xyloLeiste = new Klangleiste(x.c, {
      felder: x.felder, y0: x.y0, y1: x.y1,
      onSpiel: (i) => this.spielXylo(i, true),
      darf: () => this.aktiv && this.instrument === 'xylo',
    });
    // Schlegel: erscheint beim Vorspielen und tippt auf den Stab, der gerade dran ist
    const sch = spr('musik/schlegel', { anchor: [0.5, 0.12], parent: x.c, z: 20 });
    sch.scale.set(0.62);
    sch.rotation = -0.6;
    sch.alpha = 0;
    sch.eventMode = 'none';
    this.schlegel = { s: sch, x: x.staebe[0].x, y: x.staebe[0].y, anschlag: 0, sichtbar: 0 };
  }

  spielXylo(i, vomKind, vol = 0.9) {
    const st = this.xylo.staebe[i];
    note('xylo', XYLO_TOENE[i], { vol });
    fx.pop(st.c, 0.07);
    this.noteSteigt(this.xylo.c, st.x, st.y - st.h / 2 - 30);
    if (vomKind) this.kindSpielt();
  }

  // ---------------------------------------------------------------- Klavier

  baueKlavier() {
    const k = new PIXI.Container({ label: 'klavier' });
    k.position.set(KLAVIER_ORT.x, KLAVIER_ORT.y);
    k.addChild(klavierKoerper(TASTE_B, TASTE_A, TASTE_H, BODEN - KLAVIER_ORT.y));
    const abstand = TASTE_B + TASTE_A;
    this.tasten = [];
    for (let i = 0; i < 8; i++) {
      const x = (i - 3.5) * abstand;
      const t = new PIXI.Container({ label: 'taste' + i });
      t.position.set(x, 0);
      const bild = spr('musik/klaviertaste', { anchor: [0.5, 0], parent: t });
      bild.scale.set(TASTE_B / 157, TASTE_H / 500);
      // farbiger Punkt unten (dieselbe Farbe wie der Xylophon-Stab gleicher Stelle)
      const punkt = new PIXI.Graphics()
        .circle(0, TASTE_H - 88, 32).fill(REGENBOGEN[i]).stroke({ width: 5, color: 0xffffff, alpha: 0.8 })
        .circle(-10, TASTE_H - 98, 9).fill({ color: 0xffffff, alpha: 0.55 });
      const glanz = new PIXI.Graphics()
        .roundRect(-TASTE_B / 2 - 10, -10, TASTE_B + 20, TASTE_H + 20, 34)
        .stroke({ width: 14, color: 0xfff1a8, alpha: 0.95 })
        .roundRect(-TASTE_B / 2 + 8, 8, TASTE_B - 16, TASTE_H - 16, 24)
        .fill({ color: 0xfff6c8, alpha: 0.4 });
      glanz.alpha = 0;
      t.addChild(punkt, glanz);
      k.addChild(t);
      this.tasten.push({ c: t, glanz, x, y: TASTE_H / 2, h: TASTE_H, licht: 0 });
    }
    const felder = this.tasten.map((t) => ({ x0: t.x - abstand / 2, x1: t.x + abstand / 2 }));
    this.buehne.addChild(k);
    this.klavier = k;
    this.klavierLeiste = new Klangleiste(k, {
      felder, y0: 0, y1: TASTE_H, rand: 40,
      onSpiel: (i) => this.spielKlavier(i, true),
      darf: () => this.aktiv && this.instrument === 'klavier',
    });
  }

  drueckeTaste(i) {
    const c = this.tasten[i].c;
    this.tween(c, { y: 14 }, 0.05, { ease: 'quadOut' })
      .then(() => this.tween(c, { y: 0 }, 0.3, { ease: 'sineOut' }));
  }

  spielKlavier(i, vomKind, vol = 0.85) {
    note('klavier', KLAVIER_TOENE[i], { vol, dauer: 0.55 });
    this.drueckeTaste(i);
    this.noteSteigt(this.klavier, this.tasten[i].x, -60);
    if (vomKind) this.kindSpielt();
  }

  // ---------------------------------------------------------------- Trommeln

  baueTrommeln() {
    const c = new PIXI.Container({ label: 'trommeln' });
    c.sortableChildren = true;
    this.buehne.addChild(c);
    this.trommeln = c;
    this.trommelTeile = TROMMELN.map((d) => {
      // Container mit Drehpunkt an den Füßen bzw. oben am Knauf (dort wackelt/schwingt es)
      const s = new PIXI.Container({ label: 'trommel:' + d.id });
      s.position.set(d.x, d.y);
      c.addChild(s);
      const b = meta(d.bild);
      let flaeche;
      if (d.haken) {
        s.zIndex = 1;
        if (d.band > 0) {
          s.addChild(new PIXI.Graphics()
            .moveTo(-30, d.band + 14).lineTo(0, 0).lineTo(30, d.band + 14)
            .stroke({ width: 9, color: 0xd9473f, cap: 'round', join: 'round' }));
        }
        const bild = spr(d.bild, { y: d.band, parent: s, anchor: [d.ax ?? 0.5, 0.02] });
        bild.scale.set(d.s);
        // Holzknauf an der Wand (bleibt beim Schwingen stehen)
        const knauf = new PIXI.Graphics()
          .ellipse(4, 12, 30, 14).fill({ color: 0x6a3d16, alpha: 0.18 })
          .circle(0, 0, 24).fill(0xd98e3a).stroke({ width: 5, color: 0xb06e26 })
          .circle(-7, -7, 7).fill({ color: 0xffffff, alpha: 0.35 });
        knauf.position.set(d.x, d.y);
        knauf.zIndex = 2;
        c.addChild(knauf);
        const links = -b.w * d.s * (d.ax ?? 0.5);
        flaeche = new PIXI.Rectangle(links - 20, -10, b.w * d.s + 40, d.band + b.h * d.s + 30);
      } else {
        s.zIndex = d.y;
        // weicher Schatten auf dem Boden
        s.addChild(new PIXI.Graphics().ellipse(0, -4, b.w * d.s * 0.45, 26).fill({ color: 0x5a3a1a, alpha: 0.16 }));
        const bild = spr(d.bild, { parent: s });
        bild.scale.set(d.s);
        flaeche = new PIXI.Rectangle(-b.w * d.s / 2 - 20, -b.h * d.s - 20, b.w * d.s + 40, b.h * d.s + 40);
      }
      tap(s, (e) => this.schlage(d, s, e), { sound: null, squash: false, hitArea: flaeche });
      return s;
    });
    this.grosseTrommel = this.trommelTeile[TROMMELN.findIndex((d) => d.id === 'trommel')];
  }

  schlage(d, s, e) {
    switch (d.id) {
      case 'trommel':
        note('trommel', 36, { vol: 0.95 });
        break;
      case 'becken':
        note('trommel', 42, { vol: 0.75 });
        note('glocke', 84, { vol: 0.22 });
        break;
      case 'triangel':
        note('glocke', 88, { vol: 0.4 });
        break;
      case 'bongos': {
        // linke (große) Bongo tiefer, rechte höher
        const links = e && e.x < s.x;
        note('xylo', links ? 55 : 62, { vol: 1, dauer: 0.35 });
        note('trommel', 37, { vol: 0.25 });
        break;
      }
      case 'tamburin':
        note('trommel', 42, { vol: 0.8 });
        this.after(0.11, () => note('trommel', 42, { vol: 0.4 }));
        break;
      case 'rassel':
        note('trommel', 42, { vol: 0.6 });
        this.after(0.15, () => note('trommel', 42, { vol: 0.45 }));
        break;
      default:
    }
    if (d.bewegung === 'hopsen') fx.pop(s, 0.09);
    else if (d.bewegung === 'rasseln') fx.wobble(s, 0.14);
    else if (d.bewegung === 'schwingen') fx.wobble(s, 0.12);   // pendelt am Knauf
    else fx.wobble(s, 0.06);
    const b = s.getLocalBounds();
    // Note steigt über dem Instrument auf (beim Hängenden neben dem Knauf)
    if (d.haken) this.noteSteigt(this.trommeln, s.x + 150, s.y + 40);
    else this.noteSteigt(this.trommeln, s.x, s.y + b.y - 20);
    this.kindSpielt();
  }

  // ---------------------------------------------------------------- Wahl-Knöpfe

  baueWahl() {
    const icons = { xylo: xylophonIcon(), klavier: 'musik/klavier_klein', trommeln: 'musik/trommel' };
    this.wahlKnopf = {};
    for (const name of WAHL) {
      this.wahlKnopf[name] = this.knopf(icons[name], { size: 240, onTap: () => this.wahl(name) });
    }
  }

  teile() {
    return { xylo: this.xylo.c, klavier: this.klavier, trommeln: this.trommeln };
  }

  // Knopf-Markierung, Eingabe und Ton folgen der Wahl sofort; die Bühne folgt weich (buehneNachfuehren).
  wahl(name, { sofort = false } = {}) {
    const teile = this.teile();
    for (const n of WAHL) this.wahlKnopf[n].markiere(n === name);
    this.xyloLeiste.loslassen();
    this.klavierLeiste.loslassen();
    if (this.instrument === name) {
      // Schon gewählt: kein neuer Gruß, höchstens ein einzelner leiser Ton (der Knopf staucht von selbst)
      if (!sofort) this.vorschau(name, { klein: true });
      return;
    }
    this.instrument = name;
    if (name === 'trommeln') this.liedEnde(false);
    for (const [n, c] of Object.entries(teile)) {
      c.eventMode = n !== name ? 'none' : n === 'trommeln' ? 'passive' : 'static';
    }
    if (sofort) {
      this.blende = null;
      this.gezeigt = name;
      for (const n of WAHL) this.deckkraft(n, n === name ? 1 : 0);
      return;
    }
    this.buehneNachfuehren(0);   // beginnt die Überblendung gleich in diesem Bild (wenn keine läuft)
    this.vorschau(name);
  }

  // Ruhe-Regel beim schnellen Trommeln auf die Wahl-Knöpfe: Die Bühne wechselt in zwei weichen Schritten von je
  // UEBERBLENDEN Sekunden – erst blendet das neue Instrument OBEN auf dem alten ein, dann blendet das alte darunter
  // aus (sichtbar nur noch, wo das neue es nicht verdeckt). So ändert jeder Bildpunkt seine Helligkeit nur in eine
  // Richtung; zwei halb durchsichtige Instrumente übereinander (das ließ die Helligkeit mittendrin absacken)
  // gibt es nicht. Ein Wechsel kehrt nie mittendrin um: Wird währenddessen neu gewählt, folgt die Bühne danach dem
  // zuletzt gewählten Instrument. Nichts verschwindet hart (unsichtbar erst, wenn es ganz ausgeblendet ist).
  // Bild für Bild statt mit Tweens: Tweens auf denselben Wert ersetzen sich nicht und liefen gegeneinander.
  buehneNachfuehren(dt) {
    const teile = this.teile();
    if (!this.blende && this.gezeigt !== this.instrument) {
      this.blende = { von: this.gezeigt, nach: this.instrument, k: 0 };
      this.gezeigt = this.instrument;
      this.deckkraft(this.gezeigt, 0);   // war ganz ausgeblendet
      teile[this.gezeigt].zIndex = ++this.obenauf;   // über das alte legen
    }
    const b = this.blende;
    if (!b) return;
    const schritte = b.von ? 2 : 1;
    b.k = Math.min(schritte, b.k + dt / UEBERBLENDEN);
    this.deckkraft(b.nach, ease.sineInOut(Math.min(1, b.k)));
    if (b.von) this.deckkraft(b.von, 1 - ease.sineInOut(Math.max(0, b.k - 1)));
    if (b.k >= schritte) {
      if (b.von) this.deckkraft(b.von, 0);
      this.deckkraft(b.nach, 1);
      this.blende = null;
    }
  }

  // Deckkraft eines Instruments. Halb durchsichtig blendet ein AlphaFilter das Instrument als EIN Bild – ein
  // Container-Alpha wirkte auf jedes Teil einzeln, dann schiene z. B. der dunkle Klavier-Körper durch die hellen
  // Tasten, und die Helligkeit sackte mitten im Einblenden ab. Ganz sichtbar oder ganz weg: ohne Filter.
  // Zum Nachmessen: c.deckkraft hält den Wert (c.alpha ist während des Blendens 1).
  deckkraft(name, a) {
    const c = this.teile()[name];
    c.deckkraft = a;
    if (a > 0 && a < 1) {
      this.alphaFilter ??= {};
      const f = (this.alphaFilter[name] ??= new PIXI.AlphaFilter({ alpha: 1, resolution: 'inherit', antialias: 'inherit' }));
      f.alpha = a;
      if (c.filters?.[0] !== f) c.filters = [f];
      c.alpha = 1;
      c.visible = true;
    } else {
      if (c.filters) c.filters = null;
      c.alpha = a;
      c.visible = a > 0;
    }
  }

  // Kleiner Gruß des gewählten Instruments (zählt nicht als selbst gespielt).
  // Ruhe-Regel „Töne nicht stapeln": Eine noch laufende Vorschau-Folge endet beim neuen Tipp; der ganze Gruß
  // (vier Töne) kommt höchstens alle VORSCHAU_AB Sekunden, sonst – und beim Wieder-Antippen des schon gewählten
  // Instruments – nur ein einzelner leiser Ton, und auch der höchstens alle EINZELTON_AB Sekunden.
  vorschau(name, { klein = false } = {}) {
    for (const z of this.vorschauZeit) z.kill();
    this.vorschauZeit = [];
    const t = this.szene.t;
    const spaeter = (sek, fn) => this.vorschauZeit.push(this.after(sek, fn));
    if (!klein && t - this.letzteVorschau >= VORSCHAU_AB) {
      this.letzteVorschau = t;
      this.letzterEinzelton = t;
      if (name === 'xylo') {
        // etwas leiser als das eigene Spielen des Kindes: ein Gruß, kein Auftritt
        [0, 2, 4, 7].forEach((i, k) => spaeter(0.14 * k + 0.1, () => this.spielXylo(i, false, 0.6)));
      } else if (name === 'klavier') {
        [0, 2, 4, 7].forEach((i, k) => spaeter(0.16 * k + 0.1, () => this.spielKlavier(i, false, 0.55)));
      } else {
        spaeter(0.1, () => note('trommel', 36, { vol: 0.6 }));
        spaeter(0.4, () => note('trommel', 42, { vol: 0.4 }));
        fx.pop(this.grosseTrommel, 0.06);
      }
      return;
    }
    // Läuft gerade das Lied, klingt es schon – dann kein Einzelton obendrauf
    if (this.lied?.laeuft || t - this.letzterEinzelton < EINZELTON_AB) return;
    this.letzterEinzelton = t;
    if (name === 'xylo') {
      note('xylo', XYLO_TOENE[4], { vol: 0.4 });
      fx.pop(this.xylo.staebe[4].c, 0.05);
    } else if (name === 'klavier') {
      note('klavier', KLAVIER_TOENE[4], { vol: 0.4, dauer: 0.45 });
      this.drueckeTaste(4);
    } else {
      note('trommel', 36, { vol: 0.4 });
      fx.pop(this.grosseTrommel, 0.05);
    }
  }

  // ---------------------------------------------------------------- Notenständer, Vogel, Maus

  baueNotenstaender() {
    const g = new PIXI.Container({ label: 'notenstaender' });
    g.zIndex = 20;
    this.welt.addChild(g);
    const s = spr('musik/notenstaender', { parent: g });
    s.scale.set(0.9);
    const ente = entchenBild();
    ente.position.set(2, -326);
    ente.scale.set(1.15);
    g.addChild(ente);
    this.stand = g;
    this.standBild = s;
    tap(g, () => this.standTipp(), {
      sound: null,
      squash: false,
      hitArea: new PIXI.Rectangle(-150, -400, 300, 420),
    });

    // Vogel oben auf dem Notenständer
    const v = vogel();
    v.c.position.set(62, -407);
    v.c.scale.set(0.82);
    g.addChild(v.c);
    this.vogel = { ...v, singen: 0 };
    tap(v.c, () => this.vogelTipp(), {
      sound: null, squash: false, hitArea: new PIXI.Circle(0, -55, 150),
    });
  }

  standTipp() {
    fx.wobble(this.standBild, 0.05);
    if (this.lied) return; // läuft schon: einfach weiterhören und mitspielen
    if (this.instrument === 'trommeln') this.wahl('xylo');
    const lied = { i: -1, rest: 0.9, laeuft: false };
    this.lied = lied;
    // Erst der kurze Satz (falls es ihn gibt), dann das Lied
    // (nicht mehr, wenn die Seite inzwischen verlassen wurde oder das Lied schon wieder vorbei ist)
    voice('musik_lied', { nurWenn: () => this.aktiv && this.lied === lied }).then(() => {
      if (this.lied === lied) lied.laeuft = true;
    });
  }

  vogelTipp() {
    const v = this.vogel;
    animal('vogel');
    this.tween(v.koerper, { y: -40 }, 0.18, { ease: 'quadOut' })
      .then(() => this.tween(v.koerper, { y: -6 }, 0.28, { ease: 'bounceOut' }));
    this.burst('noten', this.stand.x + 90, this.stand.y - 520, { count: 1 });
  }

  // Die zwei runden Bilder an der Wand (gemalt im Hintergrund) klingen beim Antippen wie kleine Glöckchen,
  // und es funkelt ein wenig davor.
  baueWandbilder() {
    const hg = this.hg;
    const t = hg.texture;
    const bild = (px, py) => ({
      x: hg.x + (px / 2829 - hg.anchor.x) * t.width * hg.scale.x,
      y: hg.y + (py / 1600 - hg.anchor.y) * t.height * hg.scale.y,
    });
    const BILDER = [
      { px: 570, py: 165, toene: [72, 76, 79] },   // Blume
      { px: 2140, py: 170, toene: [74, 79, 83] },  // Wolke
    ];
    for (const b of BILDER) {
      const p = bild(b.px, b.py);
      const c = new PIXI.Container({ label: 'wandbild' });
      c.position.set(p.x, p.y);
      c.zIndex = 1;
      this.welt.addChild(c);
      let zuletzt = -1;
      tap(c, () => {
        const jetzt = this.szene.t;
        if (jetzt - zuletzt < 0.8) return;
        zuletzt = jetzt;
        b.toene.forEach((m, k) => this.after(0.12 * k, () => note('glocke', m, { vol: 0.24 })));
        this.burst('funkeln', p.x, p.y, { count: 5 });
      }, { sound: null, squash: false, hitArea: new PIXI.Circle(0, 25, 112) });
    }
  }

  baueMaus() {
    const tanz = new PIXI.Container({ label: 'mausTanz' });
    tanz.zIndex = 30;
    this.welt.addChild(tanz);
    this.maus = new Actor('maus', { x: 0, y: 0, scale: 0.3, flip: true, parent: tanz });
    this.maus.onTap(() => this.maus.cheer());
    this.tanz = tanz;
  }

  // ---------------------------------------------------------------- gemeinsame Abläufe

  kindSpielt() {
    this.energie = Math.min(1, this.energie + 0.22);
    this.gespielt++;
    if (this.gespielt >= this.stickerBei) {
      this.stickerBei = this.gespielt + 60;
      this.after(0.4, () => {
        this.maus.cheer();
        belohne(this, 'musik_trommel', -40, 560);
      });
    }
    // Ab und zu hüpft die Maus vor Freude (nicht bei jedem Ton)
    const t = this.szene.t;
    if (this.gespielt % 9 === 0 && t - this.letzterSprung > 3) {
      this.letzterSprung = t;
      this.maus.hop(45);
    }
  }

  // Eine einzelne Note steigt auf – höchstens alle 0,6 s eine
  noteSteigt(container, x, y) {
    const t = this.szene.t;
    if (t - this.letzteNote < 0.6) return;
    this.letzteNote = t;
    const p = this.vorn.toLocal(container.toGlobal({ x, y }));
    this.burst('noten', p.x, p.y, { count: 1 });
  }

  liedEnde(fertig) {
    if (!this.lied) return;
    this.lied = null;
    if (fertig) {
      this.after(0.6, () => {
        this.maus.cheer();
        this.burst('herzen', this.stand.x + 40, this.stand.y - 480, { count: 4 });
      });
    }
  }

  // ---------------------------------------------------------------- Ablauf

  betreten() {
    if (this.besuche === 1) voice('musik_instrumente', { nurWenn: () => this.aktiv });
    // „Streich mit dem Finger über die Stäbe." bei jedem Betreten anbieten (der Kern sagt ihn höchstens einmal am
    // Tag) – nur, solange das Xylophon zu sehen ist, das Kind hier noch nichts gespielt hat und kein Lied läuft.
    // nurWenn wird auch gefragt, wenn der Satz erst nach der Begrüßung an die Reihe kommt.
    const vorher = this.gespielt;
    this._hinweis?.kill();
    const passt = () => this.aktiv && this.gespielt === vorher && this.instrument === 'xylo' && !this.lied;
    this._hinweis = this.after(this.besuche === 1 ? 4.5 : 2.5, () => {
      if (passt()) voice('musik_xylo', { nurWenn: passt });
    });
  }

  /** Beim Verlassen der Szene: eigene Fenster-Listener der Klangleisten abbauen */
  aufraeumen() {
    this.xyloLeiste?.abbauen();
    this.klavierLeiste?.abbauen();
  }

  verlassen() {
    this._hinweis?.kill();
    this._hinweis = null;
    this.xyloLeiste.loslassen();
    this.klavierLeiste.loslassen();
    this.lied = null;
    for (const z of this.vorschauZeit) z.kill();
    this.vorschauZeit = [];
  }

  update(dt, t) {
    this.buehneNachfuehren(dt);
    this.liedSchritt(dt);
    this.leuchten(dt);
    this.schlegelZiehen(dt);
    this.tanzen(dt);
    this.vogelLeben(dt, t);
  }

  liedSchritt(dt) {
    const l = this.lied;
    if (!l || !l.laeuft) return;
    l.rest -= dt;
    if (l.rest > 0) return;
    l.i++;
    if (l.i >= ENTCHEN.length) {
      this.liedEnde(true);
      return;
    }
    const [stab, laenge] = ENTCHEN[l.i];
    l.rest += laenge * LIED_SCHLAG;
    if (this.instrument === 'klavier') {
      note('klavier', KLAVIER_TOENE[stab], { vol: 0.7, dauer: Math.min(0.9, laenge * LIED_SCHLAG * 0.85) });
      this.drueckeTaste(stab);
    } else {
      note('xylo', XYLO_TOENE[stab], { vol: 0.75 });
      fx.pop(this.xylo.staebe[stab].c, 0.05);
      this.schlegel.anschlag = 1;
    }
    // Der Vogel singt mit (eine Note pro Takt)
    if (l.i % 4 === 0) this.vogel.singen = 1;
  }

  // Leucht-Hilfe: der Stab/die Taste, die gerade dran ist, und – kurz vorher – die folgende.
  // Linear in LICHT_ZEIT auf und ab: nie schneller als 0,5 s.
  leuchten(dt) {
    const l = this.lied && this.lied.laeuft ? this.lied : null;
    const jetzt = l && l.i >= 0 ? ENTCHEN[l.i][0] : -1;
    const folgende = l && l.i + 1 < ENTCHEN.length && l.rest <= LICHT_ZEIT + 0.05 ? ENTCHEN[l.i + 1][0] : -1;
    const schritt = dt / LICHT_ZEIT;
    const liste = this.instrument === 'klavier' ? this.tasten : this.xylo.staebe;
    const andere = this.instrument === 'klavier' ? this.xylo.staebe : this.tasten;
    for (let i = 0; i < 8; i++) {
      const e = liste[i];
      const ziel = i === jetzt || i === folgende ? 1 : 0;
      e.licht = clamp(e.licht + (ziel > e.licht ? schritt : -schritt), 0, 1);
      e.glanz.alpha = e.licht * e.licht * (3 - 2 * e.licht); // weich
      const o = andere[i];
      if (o.licht > 0) {
        o.licht = Math.max(0, o.licht - schritt);
        o.glanz.alpha = o.licht;
      }
    }
  }

  schlegelZiehen(dt) {
    const sch = this.schlegel;
    const l = this.lied && this.lied.laeuft && this.instrument === 'xylo' ? this.lied : null;
    sch.sichtbar = clamp(sch.sichtbar + (l ? dt : -dt) / LICHT_ZEIT, 0, 1);
    sch.s.alpha = sch.sichtbar;
    if (sch.sichtbar <= 0) return;
    let ziel = l && l.i >= 0 ? ENTCHEN[l.i][0] : 0;
    // kurz vor dem folgenden Ton schon hinüber
    if (l && l.i + 1 < ENTCHEN.length && l.rest < 0.22) ziel = ENTCHEN[l.i + 1][0];
    const st = this.xylo.staebe[ziel];
    const k = 1 - Math.exp(-dt * 14);
    sch.x += (st.x + 6 - sch.x) * k;
    sch.y += (st.y - 40 - sch.y) * k;
    sch.anschlag *= Math.exp(-dt * 10);
    // Ruhe: Kopf etwas angehoben; beim Anschlag unten auf dem Stab
    sch.s.position.set(sch.x, sch.y - 46 * (1 - sch.anschlag));
    sch.s.rotation = -0.6 - 0.25 * (1 - sch.anschlag);
  }

  tanzen(dt) {
    const singt = this.lied && this.lied.laeuft;
    if (singt) this.energie = Math.max(this.energie, 0.6);
    this.energie *= Math.exp(-dt * 0.5);
    this.tanzSchlag += (dt * 84) / 60;
    const e = this.energie;
    const b = this.tanzSchlag;
    const tief = 0.5 + 0.5 * Math.cos((b - Math.floor(b)) * Math.PI * 2);
    this.tanz.rotation = 0.08 * e * Math.sin(b * Math.PI);
    this.tanz.scale.set(1 + 0.015 * e * tief, 1 - 0.035 * e * tief);
  }

  vogelLeben(dt, t) {
    const v = this.vogel;
    // blinzeln
    this.blinzeln -= dt;
    if (this.blinzeln <= 0) {
      this.blinzeln = rand(2.5, 5.5);
      this.tween(v.auge, { scaleY: 0.15 }, 0.08).then(() => this.tween(v.auge, { scaleY: 1 }, 0.12));
    }
    // leichtes Kopfwiegen, beim Singen etwas mehr; Schnabel öffnet sich
    v.koerper.rotation = 0.04 * Math.sin(t * 1.3) + 0.08 * v.singen * Math.sin(t * 6);
    if (v.singen > 0.95) {
      this.burst('noten', this.stand.x + 100, this.stand.y - 530, { count: 1 });
      v.singen = 0.94;
    }
    v.schnabel.scale.y = 1 + 0.6 * v.singen;
    v.singen *= Math.exp(-dt * 2.5);
  }

  // ---------------------------------------------------------------- Lage (Bildschirmbreite)

  ordne() {
    const W = stage.W;
    const s = clamp((W - 620) / 1940, 0.72, 1);
    this.buehne.scale.set(s);
    this.buehne.position.set(0, 800 * (1 - s));
    WAHL.forEach((n, i) => this.wahlKnopf[n].position.set(W - 190, 500 + i * 280));
    this.stand.position.set(-W / 2 + 300, 1390);
    this.tanz.position.set(W / 2 - 420, 1440);
  }

  resize() {
    this.ordne();
  }

  // ---------------------------------------------------------------- Zeige-Hand

  hinweise() {
    let ziel;
    if (this.instrument === 'klavier') ziel = this.tasten[2].c;
    else if (this.instrument === 'trommeln') ziel = this.grosseTrommel;
    else ziel = this.xylo.staebe[2].c;
    const andere = this.instrument === 'xylo' ? this.wahlKnopf.klavier : this.wahlKnopf.xylo;
    if (this.gespielt < 4) return [ziel, this.stand, andere];
    return [this.stand, andere, ziel];
  }
}
