// Seite 3: Im Musikzimmer selbst spielen.
//
// Groß in der Mitte eins von drei Instrumenten, gewählt mit drei großen Bild-Knöpfen rechts:
//   Xylophon  – 8 Regenbogen-Stäbe; antippen oder mit dem Finger darüberstreichen (jeder Finger zählt)
//   Klavier   – 8 große Tasten, ebenfalls zum Tippen und Streichen
//   Trommeln  – große Trommel, Becken, Triangel, Bongos, Tamburin, Rasseln zum Antippen
// Links steht ein Notenständer mit einem Liedbild. Daran hängt die Lied-Kette (jede Runde ein anderes Lied):
//   1. Lied aussuchen – Notenständer antippen: das Bild wechselt zum nächsten Lied (7 Lieder, keins der letzten drei;
//                       über die Besuche gemerkt, zurück aus dem Stickerbuch geht die Kette mit demselben Lied weiter).
//   2. Zuhören        – das Lied wird langsam vorgespielt, die passenden Stäbe/Tasten leuchten weich (≥ 0,5 s).
//   3. Nachspielen    – jetzt das Kind: der nächste Stab/die nächste Taste leuchtet, Antippen spielt den Ton und das
//                       Licht wandert weiter. Andere Stäbe klingen einfach (falsch gibt es nicht); wer mehrmals daneben
//                       tippt, bekommt die Zeige-Hand.
//   4. Besuch         – das Tier vom Liedbild kommt vorn herein und freut sich (antippen).
//   5. Note aufhängen – eine große Note erscheint; nach oben an die Leine zwischen den zwei Wandbildern ziehen
//                       (loslassen irgendwo genügt). Die Leine füllt sich über die Besuche hinweg (bis zu acht Noten,
//                       sie klingen beim Antippen). Sticker.
// Auf dem Notenständer sitzt ein kleiner Vogel, rechts tanzt eine Maus zur Musik.

import { stage, spr, meta, tap, drag, Actor, fx, ui, note, voice, animal, store, rand, pick, clamp, lerp, ease, PIXI }
  from '../../engine/index.js';
import { Seite } from '../../gemeinsam/seiten.js';
import { belohne } from '../../gemeinsam/sticker.js';
import { Klangleiste } from './klangleiste.js';
import { gemerkt, waehleFrisch, merke } from './abwechslung.js';
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

// Die Lieder der Lied-Kette: [Stab/Taste 0…7 (C-Dur c''…c'''), Länge in Vierteln]. Kurze, bekannte Anfänge
// (12–16 Töne), alle im Umfang der acht Stäbe. gast = wer zu Besuch kommt (auch das Bild auf dem Notenständer).
const STUECKE = [
  { id: 'entchen', gast: 'ente', noten: [   // Alle meine Entchen
    [0, 1], [1, 1], [2, 1], [3, 1], [4, 2], [4, 2], [5, 1], [5, 1], [5, 1], [5, 1], [4, 4],
    [5, 1], [5, 1], [5, 1], [5, 1], [4, 4]] },
  { id: 'jakob', gast: 'baer', noten: [     // Bruder Jakob
    [0, 1], [1, 1], [2, 1], [0, 1], [0, 1], [1, 1], [2, 1], [0, 1], [2, 1], [3, 1], [4, 2], [2, 1], [3, 1], [4, 2]] },
  { id: 'hans', gast: 'hase', noten: [      // Hänschen klein
    [4, 1], [2, 1], [2, 2], [3, 1], [1, 1], [1, 2], [0, 1], [1, 1], [2, 1], [3, 1], [4, 1], [4, 1], [4, 2]] },
  { id: 'stern', gast: 'eule', noten: [     // Funkel, funkel, kleiner Stern
    [0, 1], [0, 1], [4, 1], [4, 1], [5, 1], [5, 1], [4, 2], [3, 1], [3, 1], [2, 1], [2, 1], [1, 1], [1, 1], [0, 2]] },
  { id: 'lamm', gast: 'schaf', noten: [     // Ein kleines Lämmchen (Mary had a little lamb)
    [2, 1], [1, 1], [0, 1], [1, 1], [2, 1], [2, 1], [2, 2], [1, 1], [1, 1], [1, 2], [2, 1], [4, 1], [4, 2]] },
  { id: 'farm', gast: 'kuh', noten: [       // Old MacDonald (Anfang, in F)
    [3, 1], [3, 1], [3, 1], [0, 1], [1, 1], [1, 1], [0, 2], [5, 1], [5, 1], [4, 1], [4, 1], [3, 2]] },
  { id: 'kuckuck', gast: 'igel', noten: [   // Kuckuck, Kuckuck, ruft's aus dem Wald (3/4: G E G E D C D C,
    [4, 2], [2, 1], [4, 2], [2, 1], [1, 1], [0, 1], [1, 1], [0, 3],   //   „Lasset uns singen, tanzen und springen":
    [1, 1], [1, 1], [2, 1], [3, 2], [1, 1], [2, 1], [2, 1], [3, 1], [4, 2], [2, 1]] },   //   D D E F D E E F G E)
];

const GAST_Y = 1556;            // der Besuch steht vorn auf dem Holzboden
const GAST_SKALA = 0.3;
const NOTE_SKALA = 0.55;        // große Note zum Aufhängen
const LEINE_SKALA = 0.36;       // Note an der Leine
const LEINE_PLAETZE = 8;
const LEINE_TOENE = [72, 74, 76, 79, 81, 84, 86, 88];
const NACHSPIEL_DANEBEN = 3;    // so oft daneben, dann zeigt die Hand den leuchtenden Stab

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
    // Lied-Kette: auswahl → vorspielen → nachspielen → besuch → note → auswahl
    this.kette = { phase: 'auswahl', stueck: null, i: 0, daneben: 0, gast: null, note: null };
    this.letzteHand = -99;

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
    this.baueLeine();
    this.ordne();
    this.wahl('xylo', { sofort: true });
    this.fortsetzen(this.szene.params?.liedkette);
  }

  // ---------------------------------------------------------------- Stand (über Besuche und das Stickerbuch hinweg)

  /** Jetziger Stand der Lied-Kette für scene.rückkehr() – null, solange kein Lied gewählt ist. */
  rueckweg() {
    const k = this.kette;
    if (!k.stueck || k.phase === 'auswahl') return null;
    // Vorspielen/Nachspielen → wieder nachspielen; Besuch/Note → der Besuch kommt noch einmal
    return { lied: k.stueck.id, besuch: k.phase === 'besuch' || k.phase === 'note' };
  }

  // Das zuletzt gewählte Lied steht auf dem Notenständer (beim nächsten Antippen kommt ein anderes). Kommt das Kind
  // mitten in der Kette aus dem Stickerbuch zurück, geht es mit demselben Lied weiter.
  fortsetzen(stand) {
    const k = this.kette;
    this.liedZuletzt = gemerkt('musik.liederS2', STUECKE.map((s) => s.id));
    const zuletzt = STUECKE.find((s) => s.id === this.liedZuletzt[this.liedZuletzt.length - 1]);
    const fort = stand && typeof stand === 'object' ? STUECKE.find((s) => s.id === stand.lied) : null;
    const st = fort || zuletzt;
    if (st) {
      k.stueck = st;
      this.zeigeKarte(st);
    }
    if (!fort) return;
    if (stand.besuch) {
      k.phase = 'besuch';
      this.after(1.2, () => { if (k.phase === 'besuch' && !k.gast) this.gastKommt(); });
    } else {
      k.phase = 'nachspielen';
      k.i = 0;
      k.daneben = 0;
    }
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
    if (vomKind) {
      this.kindSpielt();
      this.nachspielTon(i);
    }
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
    if (vomKind) {
      this.kindSpielt();
      this.nachspielTon(i);
    }
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
    // Liedbild auf dem Blatt (wechselt mit dem Lied; zuerst das Entchen wie früher)
    const karte = new PIXI.Container({ label: 'liedbild' });
    karte.position.set(2, -326);
    g.addChild(karte);
    this.karte = karte;
    this.zeigeKarte(STUECKE[0]);
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

  // Bild auf dem Notenständer: Entchen (gezeichnet) oder das Besuchs-Tier des Liedes
  zeigeKarte(stueck) {
    const k = this.karte;
    for (const c of k.removeChildren()) c.destroy({ children: true });
    if (stueck.id === 'entchen') {
      const e = entchenBild();
      e.scale.set(1.15);
      k.addChild(e);
      return;
    }
    const b = spr(`tiere/${stueck.gast}_happy`, { anchor: 0.5, parent: k });
    const t = b.texture;
    b.scale.set(Math.min(130 / t.width, 112 / t.height));
    b.eventMode = 'none';
  }

  standTipp() {
    fx.wobble(this.standBild, 0.05);
    const k = this.kette;
    if (k.phase === 'besuch' || k.phase === 'note') {
      // gerade ist Besuch da: der Notenständer klingt nur kurz
      note('glocke', 79, { vol: 0.2 });
      return;
    }
    if (this.lied) return; // läuft schon: einfach weiterhören und mitspielen
    if (k.phase === 'auswahl') {
      // Schritt 1: ein neues Lied (das allererste ist das Entchen, danach keins der letzten drei – auch über die
      // Besuche hinweg: die zuletzt gewählten Lieder sind gemerkt)
      k.stueck = !this.liedZuletzt.length ? STUECKE[0] : waehleFrisch(STUECKE, this.liedZuletzt, 3, (s) => s.id);
      const st = k.stueck;
      this.liedZuletzt = merke('musik.liederS2', this.liedZuletzt, st.id);
      this.tween(this.karte.scale, { x: 0 }, 0.22, { ease: 'sineInOut' }).then(() => {
        this.zeigeKarte(st);
        this.tween(this.karte.scale, { x: 1 }, 0.28, { ease: 'sineOut' });
      });
    }
    // Schritt 2 (auch beim Nachspielen: noch einmal anhören, dann von vorn nachspielen)
    k.phase = 'vorspielen';
    k.i = 0;
    k.daneben = 0;
    if (this.instrument === 'trommeln') this.wahl('xylo');
    const lied = { i: -1, rest: 0.9, laeuft: false, noten: k.stueck.noten };
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
    if (this.kette.phase === 'vorspielen') this.after(fertig ? 1.2 : 0.3, () => this.starteNachspielen());
  }

  // ---------------------------------------------------------------- Lied-Kette

  // Schritt 3: das Kind spielt das Lied nach – der nächste Stab leuchtet
  starteNachspielen() {
    const k = this.kette;
    if (k.phase !== 'vorspielen' || this.lied) return;
    k.phase = 'nachspielen';
    k.i = 0;
    k.daneben = 0;
    voice('musik_nachspielen', { nurWenn: () => this.aktiv && k.phase === 'nachspielen' && k.i === 0 });
  }

  // Ein Ton des Kindes beim Nachspielen. Der leuchtende Stab bringt das Lied weiter, jeder andere klingt einfach.
  nachspielTon(i) {
    const k = this.kette;
    if (k.phase !== 'nachspielen') return;
    const noten = k.stueck.noten;
    if (i === noten[k.i][0]) {
      k.i++;
      k.daneben = 0;
      if (k.i >= noten.length) this.liedGeschafft();
      return;
    }
    if (++k.daneben >= NACHSPIEL_DANEBEN) {
      k.daneben = 0;
      const ziel = this.tasteFuer(noten[k.i][0]);
      fx.pulse(ziel);
      if (this.szene.t - this.letzteHand > 5) {
        this.letzteHand = this.szene.t;
        ui.hand(ziel);
      }
    }
  }

  tasteFuer(i) {
    return this.instrument === 'klavier' ? this.tasten[i].c : this.xylo.staebe[i].c;
  }

  // Das ganze Lied ist nachgespielt: Freude, dann kommt Besuch (Schritt 4)
  liedGeschafft() {
    const k = this.kette;
    k.phase = 'besuch';
    this.energie = 1;
    this.after(0.5, () => {
      this.maus.cheer();
      this.burst('herzen', this.stand.x + 40, this.stand.y - 480, { count: 4 });
    });
    this.after(1.6, () => this.gastKommt());
  }

  gastKommt() {
    const k = this.kette;
    const W = stage.W;
    const g = new Actor(k.stueck.gast, { x: W / 2 + 220, y: GAST_Y, scale: GAST_SKALA, parent: this.welt });
    g.zIndex = 35;
    g.da = false;
    k.gast = g;
    g.onTap(() => this.gastTipp(g));
    voice('musik_besuch', { nurWenn: () => this.aktiv && k.gast === g && k.phase === 'besuch' });
    g.walkTo(this.gastZielX(), GAST_Y, { tempo: 260 }).then(() => {
      if (g.destroyed || k.gast !== g) return;
      g.da = true;
      g.sound();
      if (k.phase === 'besuch') g.bubble('musik/note_gross_1', 3, { seite: 'links' });
    });
  }

  gastZielX() {
    return stage.W / 2 - 860;
  }

  gastTipp(g) {
    const k = this.kette;
    g.cheer({ parent: this.vorn });
    if (k.phase !== 'besuch' || k.gast !== g) return;
    k.phase = 'note';
    this.after(0.6, () => this.zeigeNote(g));
  }

  // Schritt 5: eine große Note erscheint über dem Gast und will an die Leine
  zeigeNote(g) {
    const k = this.kette;
    const bild = this.notenZahl % 2 === 0 ? 'musik/note_gross_1' : 'musik/note_gross_2';
    const n = spr(bild, { anchor: 0.5, x: g.x - 40, y: 1040, parent: this.welt, z: 60 });
    n.scale.set(0.05);
    k.note = n;
    note('glocke', 84, { vol: 0.22 });
    this.tween(n, { scale: NOTE_SKALA }, 0.5, { ease: 'backOut' });
    const platz = this.leinePlatz(this.notenZahl % LEINE_PLAETZE);
    n.zug = drag(n, {
      hitArea: new PIXI.Circle(0, 0, 270),
      back: false,
      targets: [{ x: platz.x, y: platz.y, radius: 600 }],
      onDrop: () => this.noteAnhaengen(n),
    });
    this.after(1.2, () => voice('musik_note', { nurWenn: () => this.aktiv && k.note === n && !n.haengt }));
  }

  noteAnhaengen(n) {
    const k = this.kette;
    if (n.haengt || n.destroyed) return;
    n.haengt = true;
    n.zug?.off();
    n.eventMode = 'none';
    n.zIndex = 60;
    const nr = this.notenZahl % LEINE_PLAETZE;
    const platz = this.leinePlatz(nr);
    const alt = this.leineNoten[nr];
    if (alt && !alt.destroyed) {
      alt.eventMode = 'none';
      this.tween(alt, { alpha: 0 }, 0.6, { ease: 'sineInOut' }).then(() => { if (!alt.destroyed) alt.destroy(); });
    }
    this.notenZahl++;
    store.set('musik.noten', this.notenZahl);
    // Ruhe-Regel: mit sineInOut ist die Spitze π/2-mal so schnell wie der Schnitt – auch sie bleibt ≤ 1000 Einheiten/s
    const d = Math.hypot(platz.x - n.x, platz.y - n.y);
    this.tween(n, { x: platz.x, y: platz.y, scale: LEINE_SKALA, rotation: rand(-0.12, 0.12) },
      Math.max(0.6, (d * Math.PI) / 2 / 1000), { ease: 'sineInOut' }).then(() => {
      if (n.destroyed) return;
      n.zIndex = 3;
      this.haengeAuf(n, nr);
      // kleiner Dreiklang, Freude, Sticker
      [0, 2, 4].forEach((s, j) => this.after(0.14 * j, () => note('glocke', LEINE_TOENE[(nr + s) % 8], { vol: 0.22 })));
      this.burst('funkeln', platz.x, platz.y, { count: 5 });
      fx.wobble(n, 0.1);
      this.maus.cheer();
      k.gast?.cheer({ parent: this.vorn });
      belohne(this, 'musik_trommel', 0, 560);
      k.note = null;
      // Der Besuch winkt und geht; dann wartet der Notenständer auf das nächste Lied
      const g = k.gast;
      this.after(3.2, () => {
        k.gast = null;
        k.phase = 'auswahl';
        if (g && !g.destroyed) {
          g.da = false;
          g.rotation = 0;
          g.walkTo(stage.W / 2 + 260, GAST_Y, { tempo: 260 }).then(() => { if (!g.destroyed) g.destroy(); });
        }
        fx.pulse(this.standBild);
      });
    });
  }

  // Note an der Leine: klingt beim Antippen
  haengeAuf(n, nr) {
    this.leineNoten[nr] = n;
    tap(n, () => {
      fx.wobble(n, 0.1);
      note('glocke', LEINE_TOENE[nr], { vol: 0.24 });
    }, { sound: null, squash: false, hitArea: new PIXI.Circle(0, 0, 360) });
    n.eventMode = 'static';
  }

  // Die Leine zwischen den zwei runden Wandbildern
  baueLeine() {
    const hg = this.hg;
    const t = hg.texture;
    const bild = (px, py) => ({
      x: hg.x + (px / 2829 - hg.anchor.x) * t.width * hg.scale.x,
      y: hg.y + (py / 1600 - hg.anchor.y) * t.height * hg.scale.y,
    });
    const a = bild(570, 165);
    const b = bild(2140, 170);
    this.leine = { x0: a.x + 98, y0: a.y - 10, x1: b.x - 98, y1: b.y - 10, durchhang: 46 };
    const L = this.leine;
    const g = new PIXI.Graphics();
    g.moveTo(L.x0, L.y0);
    for (let k = 1; k <= 24; k++) {
      const p = this.leinePunkt(k / 24);
      g.lineTo(p.x, p.y);
    }
    g.stroke({ width: 7, color: 0xc48a4e, cap: 'round', join: 'round' });
    for (let k = 0; k < LEINE_PLAETZE; k++) {
      const p = this.leinePunkt(this.leineT(k));
      g.roundRect(p.x - 7, p.y - 12, 14, 24, 5).fill(0xe9b45a).stroke({ width: 3, color: 0xb57b33 });
    }
    g.zIndex = 2;
    g.eventMode = 'none';
    this.welt.addChild(g);
    this.leineNoten = new Array(LEINE_PLAETZE).fill(null);
    this.notenZahl = clamp(Number(store.get('musik.noten', 0)) || 0, 0, 9999);
    const n = Math.min(this.notenZahl, LEINE_PLAETZE);
    for (let k = 0; k < n; k++) {
      const p = this.leinePlatz(k);
      const bild2 = k % 2 === 0 ? 'musik/note_gross_1' : 'musik/note_gross_2';
      const s = spr(bild2, { anchor: 0.5, x: p.x, y: p.y, parent: this.welt, z: 3 });
      s.scale.set(LEINE_SKALA);
      s.rotation = rand(-0.12, 0.12);
      this.haengeAuf(s, k);
    }
  }

  leineT(k) {
    return 0.07 + (0.86 * k) / (LEINE_PLAETZE - 1);
  }

  leinePunkt(t) {
    const L = this.leine;
    return { x: lerp(L.x0, L.x1, t), y: lerp(L.y0, L.y1, t) + L.durchhang * 4 * t * (1 - t) };
  }

  // Mitte einer Note, die am Platz k hängt
  leinePlatz(k) {
    const p = this.leinePunkt(this.leineT(k));
    return { x: p.x, y: p.y + 58 };
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
    // Wer beim Vorspielen wegblättert, findet beim Zurückkommen das Nachspielen (Notenständer spielt es noch mal vor)
    if (this.kette.phase === 'vorspielen') {
      this.kette.phase = 'nachspielen';
      this.kette.i = 0;
    }
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
    if (l.i >= l.noten.length) {
      this.liedEnde(true);
      return;
    }
    const [stab, laenge] = l.noten[l.i];
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

  // Leucht-Hilfe: beim Vorspielen der Stab/die Taste, die gerade dran ist, und – kurz vorher – die folgende;
  // beim Nachspielen der Stab, der als Nächstes dran ist. Linear in LICHT_ZEIT auf und ab: nie schneller als 0,5 s.
  leuchten(dt) {
    const l = this.lied && this.lied.laeuft ? this.lied : null;
    let jetzt = l && l.i >= 0 ? l.noten[l.i][0] : -1;
    const folgende = l && l.i + 1 < l.noten.length && l.rest <= LICHT_ZEIT + 0.05 ? l.noten[l.i + 1][0] : -1;
    const k = this.kette;
    if (!l && k.phase === 'nachspielen' && k.i < k.stueck.noten.length) jetzt = k.stueck.noten[k.i][0];
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
    let ziel = l && l.i >= 0 ? l.noten[l.i][0] : 0;
    // kurz vor dem folgenden Ton schon hinüber
    if (l && l.i + 1 < l.noten.length && l.rest < 0.22) ziel = l.noten[l.i + 1][0];
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
    // der Besuch wiegt sich mit (erst, wenn er angekommen ist)
    const g = this.kette.gast;
    if (g && g.da && !g.destroyed) g.rotation = 0.06 * Math.max(e, 0.4) * Math.sin(b * Math.PI);
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
    const k = this.kette;
    if (k.phase === 'vorspielen') {
      const l = this.lied;
      return l && l.laeuft && l.i >= 0 ? [this.tasteFuer(l.noten[l.i][0])] : [this.stand];
    }
    if (k.phase === 'nachspielen') {
      if (this.instrument === 'trommeln') return [this.wahlKnopf.xylo];
      return [this.tasteFuer(k.stueck.noten[k.i][0]), this.stand];
    }
    if (k.phase === 'besuch') return k.gast && !k.gast.destroyed ? [k.gast] : [this.maus];
    if (k.phase === 'note') {
      const n = k.note;
      if (n && !n.destroyed && !n.haengt) return [{ von: n, nach: this.leinePlatz(this.notenZahl % LEINE_PLAETZE) }];
      return [this.maus];
    }
    let ziel;
    if (this.instrument === 'klavier') ziel = this.tasten[2].c;
    else if (this.instrument === 'trommeln') ziel = this.grosseTrommel;
    else ziel = this.xylo.staebe[2].c;
    const andere = this.instrument === 'xylo' ? this.wahlKnopf.klavier : this.wahlKnopf.xylo;
    if (this.gespielt < 4) return [ziel, this.stand, andere];
    return [this.stand, andere, ziel];
  }
}
