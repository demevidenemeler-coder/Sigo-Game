// Sticker-Album: ein aufgeschlagenes Stickerbuch auf dem Holztisch.
// - Alle Sticker (STICKER aus gemeinsam/sticker.js) liegen in einem ruhigen Raster auf den beiden Buchseiten,
//   3×3 je Seite = 18 je Doppelseite. Weitere Doppelseiten über die Pfeile links/rechts (weiches Überblenden).
//   Die letzte Doppelseite hat meist weniger (60 Sticker: 18 + 18 + 18 + 6); ihre Sticker sitzen ruhig in der Mitte
//   jeder Buchseite (siehe REIHEN), die Zuordnung Sticker → Doppelseite bleibt dieselbe.
// - Gesammelte Sticker: farbig, mit weißem Sticker-Rand, leicht schräg aufgeklebt. Antippen → hüpft + passender Ton.
// - Fehlende: nur der leere Platz (rahmen/sticker_rahmen) mit ganz blasser Silhouette. Antippen → wackelt freundlich.
// - Neu gesammelte Sticker (seit dem letzten Besuch, gemerkt unter 'album.gesehen') werden beim Öffnen nacheinander
//   weich eingeklebt (kleines Plopp, ein paar Funken); liegen welche auf anderen Doppelseiten, blättert das Buch hin.
// - Nebenbei: ein Schmetterling besucht ab und zu einen Sticker, ein Marienkäfer krabbelt am unteren Rand der linken
//   Seite, gesammelte Sticker atmen ganz leicht. Ein Tipp aufs Buch raschelt (auf den Tisch: leises Klack).
// - Ruhe: derselbe Sticker klingt erst wieder, wenn sein Ton aus ist; höchstens zwei Sticker-Töne gleichzeitig.
// - Startet auf der Doppelseite mit neuen Stickern, sonst auf der zuletzt angesehenen (wenn dort etwas klebt), sonst
//   auf der ersten mit einem gesammelten Sticker – das Kind sieht beim Öffnen nie nur leere Plätze, wenn es schon
//   etwas gefunden hat.
// Oben links der Ausgang: von der Karte aus der Karten-Knopf des Kerns. Wurde das Album mitten in einem Ort geöffnet
// (Album-Knopf oben rechts), steht dort stattdessen ein Zurück-Knopf, der in diesen Ort zurückführt – bei Orten mit
// Seiten auf dieselbe Seite. Woher das Kind kam, gibt der Album-Knopf mit: go('album', {von, zurück}) (siehe
// herkunft). Einen Album-Knopf gibt es hier nicht.

import {
  Scene, SceneManager, stage, spr, tap, fx, ui, store, sfx, voice, note, animal, rand, pick, clamp, lerp, ease, PIXI,
} from '../../engine/index.js';
import { hgPunkt } from '../../gemeinsam/seiten.js';
import { STICKER, gesammelt } from '../../gemeinsam/sticker.js';
import {
  ladeStickerBilder, gibFrei, stickerRandFuer, BILD_PX, baueSchmetterling, baueMarienkaefer,
} from './bilder.js';

const { Container, Sprite, Circle } = PIXI;

const SPALTEN = 3;
const ZEILEN = 3;
const JE_BLATT = 2 * SPALTEN * ZEILEN; // 18 Sticker je Doppelseite
const PLATZ = 262;                       // Durchmesser des leeren Platzes
const BILD = 232;                        // längste Seite eines Stickerbilds
const TIPP_RADIUS = 145;                 // Tippfläche je Platz (290 Durchmesser)
const PFEIL_X = 1160;                    // Pfeile: so weit links/rechts der Mitte (wenn der Bildschirm es zulässt)
const PFEIL_TIPP = 125;                  // Tippkreis der Pfeile (ui.button, Größe 200)
const GLEIT = 150;                       // so weit gleiten die Seiten beim Umblättern
const GESEHEN = 'album.gesehen';         // ids, die schon einmal im Album eingeklebt wurden
const MAX_TOENE = 2;                     // so viele Sticker-Töne dürfen gleichzeitig klingen
const BUCH_PAUSE = 0.6;                  // Tipp aufs Buch/den Tisch: frühestens so oft eine Rückmeldung (s)
const SEITE = 'album.seite';             // zuletzt angesehene Doppelseite
// Wie die Sticker einer Buchseite in Reihen sitzen (von oben nach unten), je nach Anzahl. Voll: 3×3. Wenige
// (letzte Doppelseite) rücken in die Mitte, versetzt wie auf einem Würfel – ruhig und ausgewogen.
const REIHEN = {
  1: [1], 2: [2], 3: [2, 1], 4: [2, 2], 5: [2, 1, 2], 6: [3, 3], 7: [2, 3, 2], 8: [3, 2, 3], 9: [3, 3, 3],
};
// Lage in der Reihe (0 = links, 1 = rechts innerhalb der Spalten) und Höhe der Reihen (0 = oben, 1 = unten)
const SPALTEN_ANTEIL = { 1: [0.5], 2: [0.2, 0.8], 3: [0, 0.5, 1] };
const ZEILEN_ANTEIL = { 1: [0.5], 2: [0.28, 0.72], 3: [1 / 6, 0.5, 5 / 6] };
// Höchstens zwei je Reihe (bis 4 Sticker je Buchseite): Plätze etwas größer, damit die Seite nicht leer wirkt.
// Die Tippkreise wachsen mit und berühren sich trotzdem nicht (Spalten ≥ 369, Reihen ≥ 500 auseinander).
const GROSS_WENIGE = 1.2;
// Von hier aus geht es nicht in einen Ort zurück, sondern wie gewohnt über den Karten-Knopf
const OHNE_RÜCKWEG = new Set(['karte', 'start', 'album']);

// Woher kam das Kind? Der Album-Knopf des Kerns (ui.albumKnopf) sagt es beim Öffnen:
// go('album', {von: '<id>', zurück: {…Startwerte des Ortes, seite: n}}). Ohne `von` (Start über die Adresse,
// von der Karte) gibt es keinen Rückweg in einen Ort – dann bleibt der Karten-Knopf.
function herkunft(params) {
  const von = params && typeof params.von === 'string' ? params.von : null;
  if (!von || OHNE_RÜCKWEG.has(von) || !SceneManager.has(von)) return null;
  const z = params.zurück && typeof params.zurück === 'object' ? params.zurück : {};
  return { id: von, params: { ...z } };
}

// Passende Töne der Ding-Sticker (Tiere: Tierlaut, Loks: Pfiff, sonst Plopp/Funkeln im Wechsel)
const TOENE = {
  bahnhof_bahnhofsglocke: ['common/glocke', 0.5],
  bahnhof_bahnhofsuhr: ['common/kuckuck', 0.5],
  fahrt_muehle_turm: ['common/wusch', 0.7],
  fahrt_baum_apfel: ['common/rascheln', 0.7],
  fahrt_tunnel: ['common/pfiff', 0.45],
  bauernhof_traktor: ['common/traktor', 0.5],
  bauernhof_eierkorb: ['common/kueken', 0.6],
  feuerwehr_feuerwehrauto: ['common/tatue', 0.4],
  feuerwehr_helm: ['common/klack', 0.7],
  feuerwehr_schlauchrolle: ['common/spritz', 0.6],
  baustelle_kipper: ['common/kippen', 0.5],
  baustelle_kran: ['common/kran', 0.5],
  baustelle_walze: ['common/walze', 0.5],
  garten_sonnenblume: ['common/wachsen', 0.7],
  garten_blume: ['common/wachsen', 0.7],
  teich_seerose: ['common/platsch', 0.5],
  teich_fisch: ['common/blubber', 0.7],
  malhaus_stift: ['common/pinsel', 0.7],
  malhaus_regenbogen: ['common/funkeln', 0.6],
  eisdiele_eisbecher: ['common/klingel', 0.5],
  eisdiele_waffel: ['common/mampf', 0.6],
  spielplatz_ballon: ['common/ballon', 0.7],
  spielplatz_karussell: ['common/quietsch', 0.5],
  spielplatz_rutsche: ['common/rutsch', 0.6],
  spielplatz_schatz: ['common/funkeln', 0.6],
  wald_reh: ['common/rascheln', 0.7],
  wald_beeren: ['common/rascheln', 0.7],
  waschanlage_schwamm: ['common/schrubben', 0.6],
  waschanlage_buerste: ['common/wisch', 0.7],
};
// Instrumente klingen über den Ton-Erzeuger
const NOTEN = {
  musik_trommel: ['trommel', 48],
  musik_trompete: ['floete', 79],
  schlafen_mond: ['glocke', 84],
  schlafen_kuschelhase: ['xylo', 76],
  fahrt_bruecke: ['xylo', 72],
};

// Startseite: params.seite, sonst ?seite=n (nur bei direktem Start über die Adresse), sonst null
function wunschSeite(params) {
  if (params && params.seite !== undefined && params.seite !== null) return Number(params.seite) || 0;
  try {
    const suche = new URLSearchParams(location.search);
    if (suche.get('szene') === 'album' && suche.has('seite')) return Number(suche.get('seite')) || 0;
  } catch { /* egal */ }
  return null;
}

export default class Album extends Scene {
  static id = 'album';
  static packs = ['rahmen', 'tiere', 'zug'];
  static tiere = ['affe_happy', 'baer_happy', 'eichhoernchen_happy', 'elefant_happy', 'ente_happy', 'eule_happy', 'frosch_happy', 'fuchs_happy', 'giraffe_happy', 'hahn_happy', 'hase_happy', 'huhn_happy', 'hund_happy', 'igel_happy', 'katze_happy', 'kuh_happy', 'loewe_happy', 'maus_happy', 'pferd_happy', 'pinguin_happy', 'schaf_happy', 'schwein_happy'];
  static music = 'musik/karte';

  async enter(params) {
    this.geladen = [];      // eigene Bild-Namen (in exit freigeben)
    this.kacheln = [];
    this.blaetter = [];
    this.zuBauen = [];      // gesammelte Sticker anderer Doppelseiten: Rand entsteht nach und nach im Hintergrund
    this.bauUhr = 0;
    this.nr = 0;
    this.gleitet = false;
    this.klebt = false;
    this.klebeLauf = 0;     // erhöht sich bei jedem Umblättern → laufendes Einkleben endet
    this.frischGeklebt = 0;
    this.hinweisZaehler = 0;
    this.plopp = 0;
    this.toeneAn = 0;       // gerade klingende Sticker-Töne
    this.buchTipp = -1e9;

    // Ausgang oben links (vor allem anderen: die Herkunft gilt nur jetzt, gleich zu Beginn des Aufbaus)
    this.baueAusgang(herkunft(params));

    // Hintergrund: Buch mittig, Höhe 1600. Auch Buchseiten und Tisch antworten auf einen Tipp.
    this.hg = spr('rahmen/album_hg', { x: 0, y: 800, parent: this.bg });
    tap(this.hg, (e) => this.tippeBuch(e), { sound: null, squash: false });

    // Sticker-Bilder laden (fehlende werden übersprungen)
    const alle = STICKER;
    const bilder = await ladeStickerBilder(alle, this.geladen);
    if (!this.alive) return;
    const liste = alle.filter((s) => bilder.has(s.id));

    // Was ist gesammelt, was davon neu (noch nie im Album eingeklebt)?
    const gesehenRoh = store.get(GESEHEN, []);
    this.gesehen = new Set(Array.isArray(gesehenRoh) ? gesehenRoh : []);
    const hat = new Set(gesammelt());

    // Start-Doppelseite: Wunsch, sonst die erste mit neuen Stickern, sonst die zuletzt angesehene (wenn dort ein
    // gesammelter Sticker klebt), sonst die erste mit einem gesammelten Sticker, sonst die erste
    const anzahl = Math.max(1, Math.ceil(liste.length / JE_BLATT));
    const ersteNeue = liste.findIndex((s) => hat.has(s.id) && !this.gesehen.has(s.id));
    const ersteGesammelte = liste.findIndex((s) => hat.has(s.id));
    const mitSticker = (b) => liste.some((s, i) => Math.floor(i / JE_BLATT) === b && hat.has(s.id));
    const gemerkt = Number(store.get(SEITE, -1));
    let start = wunschSeite(params);
    if (start === null && ersteNeue >= 0) start = Math.floor(ersteNeue / JE_BLATT);
    if (start === null && Number.isInteger(gemerkt) && gemerkt >= 0 && gemerkt < anzahl && mitSticker(gemerkt)) {
      start = gemerkt;
    }
    if (start === null && ersteGesammelte >= 0) start = Math.floor(ersteGesammelte / JE_BLATT);
    this.nr = clamp(start ?? 0, 0, anzahl - 1);
    store.set(SEITE, this.nr);

    // Plätze und Doppelseiten
    this.berechneBuchSeiten();
    const plaetze = [];   // je Doppelseite: ihre Plätze (die letzte hat oft weniger als 18)
    for (let b = 0; b < anzahl; b++) {
      const blatt = new Container({ label: 'blatt' + b, sortableChildren: true });
      blatt.visible = false;
      this.world.addChild(blatt);
      this.blaetter.push(blatt);
      plaetze.push(this.berechnePlaetze(clamp(liste.length - b * JE_BLATT, 1, JE_BLATT)));
    }
    liste.forEach((s, i) => {
      const b = Math.floor(i / JE_BLATT);
      const p = plaetze[b][i % JE_BLATT];
      this.kacheln.push(this.baueKachel(s, bilder.get(s.id), b, p, i, hat.has(s.id), !this.gesehen.has(s.id)));
    });
    this.hatEtwas = this.kacheln.some((t) => t.geklebt || t.neu);

    // Pfeile
    this.pfeile = [-1, 1].map((r) => {
      const k = ui.button(r < 0 ? 'common/icon_pfeil_links' : 'common/icon_pfeil_rechts', {
        size: 200, parent: this.hud, z: 50, sound: null, onTap: () => this.blaettern(r),
      });
      k.richtung = r;
      return k;
    });
    this.setzePfeile();

    // Nebenfiguren
    this.baueSchmetterling();
    this.baueKaefer();

    const neue = this.kacheln.filter((t) => t.neu);
    this.blaetter[this.nr].visible = true;
    this.zeigePfeile(true);

    // Begrüßung (ein Satz, nur beim ersten Mal) und neue Sticker einkleben
    this.after(0.9, () => {
      if (neue.length) voice('album_neu');
      else if (!hat.size) voice('album_leer');
      else voice('album_hallo');
    });
    this.klebeNeue(0.9);

    // Gesammelte Sticker atmen ab und zu ganz leicht (immer nur einer)
    this.every(5.5, () => this.atmen());
  }

  // ---------------------------------------------------------------- Ausgang

  // Von der Karte (oder direkt gestartet): der Karten-Knopf des Kerns bleibt. Aus einem Ort: an seiner Stelle ein
  // gleich großer Zurück-Knopf in diesen Ort – „kurz ins Album schauen“ heißt dann nicht „das Spiel verlassen“.
  baueAusgang(von) {
    const karte = this.hud.children.find((c) => c.label === 'kartenKnopf') || null;
    this.ausgang = karte;
    if (!von) return;
    const knopf = ui.button('common/icon_zurueck', {
      size: 200, x: 170, y: 170, parent: this.hud, z: 9000,
      onTap: () => this.go(von.id, von.params),
    });
    knopf.label = 'zurückKnopf';
    this.ausgang = knopf;
    this.rückweg = von.id;
    if (karte) {
      karte.visible = false;
      karte.eventMode = 'none';
    }
  }

  // ---------------------------------------------------------------- Raster

  // freie Flächen der beiden Buchseiten (für die Plätze und den Tipp aufs Buch), Szenen-Koordinaten
  berechneBuchSeiten() {
    const P = (name, ersatz) => hgPunkt(this.hg, 'rahmen/album_hg', name) || ersatz;
    const ecken = [
      [P('seite_l_lo', { x: -1214, y: 170 }), P('seite_l_ru', { x: -74, y: 1450 })],
      [P('seite_r_lo', { x: 86, y: 170 }), P('seite_r_ru', { x: 1246, y: 1450 })],
    ];
    this.buchSeiten = ecken.map(([lo, ru]) => ({ x1: lo.x, x2: ru.x, y1: lo.y, y2: ru.y }));
  }

  // Plätze einer Doppelseite mit n Stickern (höchstens 18; erst die linke Buchseite, dann die rechte), Szenen-
  // Koordinaten. Volle Doppelseite: 3×3 je Buchseite. Hat die letzte Doppelseite weniger, sitzen ihre Sticker
  // ruhig und gleichmäßig in der Mitte jeder Buchseite (REIHEN) statt oben links gedrängt vor leeren Reihen.
  // Welcher Sticker auf welcher Doppelseite steht, ändert sich dadurch nicht (immer 18 je Doppelseite).
  berechnePlaetze(n = JE_BLATT) {
    // Außen bleibt Platz für die Pfeile: die Tippkreise von Pfeil und äußerem Platz berühren sich nicht
    // (10 Einheiten Luft für das leichte Zittern des Rasters). Gemessen als Abstand der Spalten-Mitte vom Falz.
    const fuerPfeil = this.pfeilAbstand() - PFEIL_TIPP - TIPP_RADIUS - 10;
    const proSeite = [Math.ceil(n / 2), Math.floor(n / 2)];
    if (n >= JE_BLATT) proSeite.fill(SPALTEN * ZEILEN);
    const plaetze = [];
    this.buchSeiten.forEach((b, s) => {
      const r = s === 0 ? -1 : 1;
      const falz = s === 0 ? -b.x2 : b.x1;   // Betrag: innerer Rand der Buchseite
      const rand = s === 0 ? -b.x1 : b.x2;   // Betrag: äußerer Rand der Buchseite
      const innen = falz + 60 + PLATZ / 2;
      // schmaler Bildschirm: die Plätze rücken nie enger zusammen als ihre Tippkreise (dann liegt der Pfeil knapp)
      const aussen = Math.max(Math.min(rand - 150 - PLATZ / 2, fuerPfeil), innen + (SPALTEN - 1) * 2 * TIPP_RADIUS);
      const y1 = b.y1 + 80;
      const y2 = b.y2 - 60;
      const reihen = REIHEN[proSeite[s]] || [];
      const gross = proSeite[s] <= 4 ? GROSS_WENIGE : 1;
      reihen.forEach((anzahl, z) => {
        for (let sp = 0; sp < anzahl; sp++) {
          const i = plaetze.length;
          // Spalten von links nach rechts: links außen→innen, rechts innen→außen
          const a = SPALTEN_ANTEIL[anzahl][sp];
          const betrag = s === 0 ? lerp(aussen, innen, a) : lerp(innen, aussen, a);
          // ganz leicht unregelmäßig – wie von Hand eingeklebt, aber ruhig
          plaetze.push({
            x: r * betrag + (((i * 37) % 11) - 5) * 1.5,
            y: lerp(y1, y2, ZEILEN_ANTEIL[reihen.length][z]) + (((i * 53) % 9) - 4) * 3,
            gross,
          });
        }
      });
    });
    return plaetze;
  }

  // ---------------------------------------------------------------- Kachel (ein Platz im Buch)

  baueKachel(s, textur, blatt, p, i, gesammeltJa, neu) {
    const k = new Container({ label: 'platz_' + s.id });
    k.position.set(p.x, p.y);
    k.scale.set(p.gross || 1);   // Platz samt Sticker und Tippfläche (wenige Sticker auf der Doppelseite: größer)
    this.blaetter[blatt].addChild(k);

    const rahmen = spr('rahmen/sticker_rahmen', { anchor: 0.5, parent: k, alpha: 0.95 });
    rahmen.scale.set(PLATZ / Math.max(rahmen.texture.width, rahmen.texture.height));

    // ganz blasse graue Silhouette: zeigt, was es noch zu finden gibt
    const silh = new Sprite(textur);
    silh.anchor.set(0.5);
    silh.scale.set((BILD * 0.82) / Math.max(textur.width, textur.height));
    silh.tint = 0x000000;
    silh.alpha = 0.1;
    k.addChild(silh);

    const t = {
      s, k, rahmen, silh, textur, blatt, i,
      neu: gesammeltJa && neu,
      geklebt: false,
      sticker: null,
      schraeg: (((i * 29) % 13) - 6) * 0.013 + (i % 2 ? 0.02 : -0.02),
      huepft: false,
      wackelt: 0,
    };

    if (gesammeltJa && !t.neu) {
      t.geklebt = true;
      rahmen.alpha = 0;
      silh.visible = false;
      // sichtbare Doppelseite sofort, die übrigen nach und nach (der weiße Rand kostet beim ersten Mal etwas Zeit)
      if (blatt === this.nr) this.zeigeSticker(t);
      else this.zuBauen.push(t);
    }

    tap(k, () => this.tippe(t), { sound: null, hitArea: new Circle(0, 0, TIPP_RADIUS) });
    return t;
  }

  // Sticker mit weißem Rand und weichem Schatten (wird erst gebaut, wenn er gebraucht wird)
  baueSticker(t) {
    if (t.sticker) return t.sticker;
    const c = new Container({ label: 'sticker' });
    c.rotation = t.schraeg;
    c.visible = false;
    const groesse = BILD / Math.max(t.textur.width, t.textur.height);
    const rand = stickerRandFuer(t.s.tex, t.textur);
    if (rand) {
      const s = BILD / BILD_PX; // Leinwand: längste Bildseite = BILD_PX Bildpunkte
      const schatten = new Sprite(rand.textur);
      schatten.anchor.set(0.5);
      schatten.scale.set(s);
      schatten.position.set(5, 8);
      schatten.tint = 0x5a4630;
      schatten.alpha = 0.3;
      const weiss = new Sprite(rand.textur);
      weiss.anchor.set(0.5);
      weiss.scale.set(s);
      c.addChild(schatten, weiss);
    }
    const bild = new Sprite(t.textur);
    bild.anchor.set(0.5);
    bild.scale.set(groesse);
    c.addChild(bild);
    t.k.addChild(c);
    t.sticker = c;
    return c;
  }

  // schon eingeklebter Sticker: fertig gebaut und sichtbar
  zeigeSticker(t) {
    this.baueSticker(t).visible = true;
  }

  // alle eingeklebten Sticker einer Doppelseite fertig bauen (vor dem Umblättern dorthin)
  baueBlatt(nr) {
    for (const t of this.zuBauen) if (t.blatt === nr) this.zeigeSticker(t);
    this.zuBauen = this.zuBauen.filter((t) => !t.sticker);
  }

  // ---------------------------------------------------------------- Antippen

  tippe(t) {
    // gleitet: Seite ist unterwegs; klebend: der Sticker kommt gerade an – das ist schon Rückmeldung genug
    if (this.gleitet || t.klebend) return;
    if (t.geklebt) {
      if (t.huepft) return; // hüpft schon – Dauertippen zappelt nicht
      this.huepfe(t);
      // Töne stapeln sich nicht: derselbe Sticker klingt erst wieder, wenn sein Ton vorbei ist (er hüpft trotzdem),
      // und mehr als zwei Sticker-Töne gleichzeitig gibt es nicht (dann nur ein leises Plopp).
      if (t.klingt) return;
      if (this.toeneAn >= MAX_TOENE) {
        sfx('common/plopp', { vol: 0.35 });
        return;
      }
      this.spieleKlang(t);
      const herzen = t.s.id.startsWith('tier_');
      fx.burst(herzen ? 'herzen' : 'funkeln', t.k.x, t.k.y - 90, { count: herzen ? 2 : 3, parent: this.blaetter[t.blatt], z: 40 });
    } else {
      // leerer Platz: wackelt freundlich
      fx.wobble(t.k, 0.12);
      sfx('common/tipp', { vol: 0.6 });
      voice('album_fehlt');
    }
  }

  async huepfe(t) {
    if (t.huepft || !t.sticker) return;
    t.huepft = true;
    t.k.zIndex = 5; // über die Nachbarn
    const hoch = await this.tween(t.sticker, { y: -60, rotation: t.schraeg - 0.06 }, 0.2, { ease: 'quadOut' });
    if (hoch) await this.tween(t.sticker, { y: 0, rotation: t.schraeg }, 0.26, { ease: 'quadIn' });
    t.sticker.y = 0;
    t.sticker.rotation = t.schraeg;
    fx.pop(t.sticker, 0.06);
    t.k.zIndex = 0;
    t.huepft = false;
  }

  // Ton eines Stickers spielen und merken, bis er verklungen ist (Geräusche melden ihr Ende, erzeugte Noten
  // nicht – dort zählt eine feste Zeit; die Notbremse nach 4 s hilft, falls ein Ende nie gemeldet wird).
  spieleKlang(t) {
    t.klingt = true;
    this.toeneAn++;
    const frei = () => {
      if (!t.klingt) return;
      t.klingt = false;
      this.toeneAn = Math.max(0, this.toeneAn - 1);
    };
    const ende = this.klang(t.s);
    let zeitUm = false;
    let tonUm = !(ende && typeof ende.then === 'function');
    const pruefe = () => { if (zeitUm && tonUm) frei(); };
    const mindestens = NOTEN[t.s.id] ? (NOTEN[t.s.id][0] === 'glocke' ? 1.4 : 0.7) : 0.6;
    this.after(mindestens, () => { zeitUm = true; pruefe(); });
    if (!tonUm) ende.then(() => { tonUm = true; pruefe(); }, () => { tonUm = true; pruefe(); });
    this.after(4, frei);
  }

  klang(s) {
    if (s.id.startsWith('tier_')) return animal(s.id.slice(5));
    if (s.id.startsWith('lok_')) return sfx('common/pfiff', { vol: 0.5 });
    if (NOTEN[s.id]) return note(NOTEN[s.id][0], NOTEN[s.id][1], { vol: 0.7 });
    if (TOENE[s.id]) return sfx(TOENE[s.id][0], { vol: TOENE[s.id][1] });
    this.plopp++;
    return sfx(this.plopp % 2 ? 'common/plopp' : 'common/funkeln', { vol: 0.6 });
  }

  // ---------------------------------------------------------------- neue Sticker einkleben

  async klebeNeue(verzoegerung = 0.5) {
    const lauf = ++this.klebeLauf;
    const blatt = this.nr;
    const liste = this.kacheln.filter((t) => t.blatt === blatt && t.neu && !t.geklebt && !t.klebend);
    if (!liste.length) return;
    this.klebt = true;
    await this.wait(verzoegerung);
    const abstand = liste.length > 6 ? 0.45 : 0.75;
    for (const t of liste) {
      if (lauf !== this.klebeLauf) return; // umgeblättert: der Rest klebt beim nächsten Besuch der Seite
      this.klebe(t);
      await this.wait(abstand);
    }
    if (lauf !== this.klebeLauf) return;
    this.klebt = false;
    await this.wait(0.6);
    if (lauf !== this.klebeLauf) return;

    // Liegen auf anderen Doppelseiten noch neue Sticker? Dann sanft dorthin blättern.
    const weiter = this.kacheln.find((t) => t.neu && !t.geklebt && !t.klebend);
    if (weiter) {
      await this.wait(0.8);
      if (lauf === this.klebeLauf && !this.gleitet) this.zeigeBlatt(weiter.blatt);
      return;
    }
    // Gerade voll geworden? Ein freundlicher Moment.
    if (this.frischGeklebt && this.kacheln.every((t) => t.geklebt)) this.feiern();
  }

  async klebe(t) {
    t.klebend = true;
    this.gesehen.add(t.s.id);
    store.set(GESEHEN, [...this.gesehen]);
    const c = this.baueSticker(t);
    c.visible = true;
    c.alpha = 0;
    c.scale.set(1.35);
    c.y = -70;
    c.rotation = t.schraeg + 0.3;
    t.k.zIndex = 5;
    this.tween(c, { alpha: 1 }, 0.25, { ease: 'sineInOut' });
    await this.tween(c, { scale: 1, y: 0, rotation: t.schraeg }, 0.55, { ease: 'backOut' });
    c.alpha = 1;
    t.k.zIndex = 0;
    t.geklebt = true;
    t.klebend = false;
    this.frischGeklebt++;
    // Wurde inzwischen weggeblättert, klebt der Sticker still fertig (kein Ton ohne sichtbaren Grund)
    if (t.blatt === this.nr) {
      sfx('common/plopp', { vol: 0.7 });
      fx.burst('funkeln', t.k.x, t.k.y, { count: 4, parent: this.blaetter[t.blatt], z: 40 });
    }
    this.tween(t.rahmen, { alpha: 0 }, 0.5, { ease: 'sineInOut' });
    this.tween(t.silh, { alpha: 0 }, 0.5, { ease: 'sineInOut' });
  }

  feiern() {
    voice('album_voll');
    sfx('common/freude', { vol: 0.7 });
    const blatt = this.blaetter[this.nr];
    fx.burst('sterne', -620, 760, { count: 6, parent: blatt, z: 40 });
    this.after(0.5, () => fx.burst('sterne', 620, 760, { count: 6, parent: blatt, z: 40 }));
  }

  // ---------------------------------------------------------------- Umblättern

  blaettern(r) {
    const ziel = this.nr + r;
    if (this.gleitet || ziel < 0 || ziel >= this.blaetter.length) return Promise.resolve(false);
    return this.zeigeBlatt(ziel);
  }

  async zeigeBlatt(ziel) {
    if (this.gleitet || ziel === this.nr || !this.blaetter[ziel]) return false;
    const r = ziel > this.nr ? 1 : -1;
    this.baueBlatt(ziel);
    this.klebeLauf++;
    this.klebt = false;
    this.gleitet = true;
    this.schmetterlingWeg();
    sfx('common/wusch', { vol: 0.6 });
    const alt = this.blaetter[this.nr];
    const neu = this.blaetter[ziel];
    this.nr = ziel;
    store.set(SEITE, ziel);
    this.zeigePfeile();
    alt.interactiveChildren = false;
    neu.interactiveChildren = false;
    neu.visible = true;
    neu.alpha = 0;
    neu.x = r * GLEIT;
    await Promise.all([
      this.tween(alt, { alpha: 0, x: -r * GLEIT }, 0.45, { ease: 'sineInOut' }),
      this.tween(neu, { alpha: 1, x: 0 }, 0.55, { ease: 'sineInOut', delay: 0.15 }),
    ]);
    alt.visible = false;
    alt.x = 0;
    alt.alpha = 1;
    alt.interactiveChildren = true;
    neu.interactiveChildren = true;
    neu.x = 0;
    neu.alpha = 1;
    this.gleitet = false;
    this.klebeNeue(0.3);
    return true;
  }

  // Pfeile an den Rand (so weit draußen wie möglich, ohne aus dem Bild zu fallen)
  setzePfeile() {
    const dx = this.pfeilAbstand();
    for (const k of this.pfeile) k.position.set(stage.W / 2 + k.richtung * dx, 800);
  }

  pfeilAbstand() {
    return Math.min(PFEIL_X, stage.W / 2 - 125);
  }

  // am ersten/letzten Blatt fehlt der Pfeil in diese Richtung (weich ein-/ausblenden)
  zeigePfeile(sofort = false) {
    for (const k of this.pfeile) {
      const ziel = this.nr + k.richtung;
      const an = ziel >= 0 && ziel < this.blaetter.length;
      k.eventMode = an ? 'static' : 'none';
      k.an = an;
      if (sofort) k.alpha = an ? 1 : 0;
      else this.tween(k, { alpha: an ? 1 : 0 }, 0.5, { ease: 'sineInOut' });
      k.visible = true;
    }
  }

  resize() {
    this.setzePfeile();
  }

  // ---------------------------------------------------------------- Atmen

  atmen() {
    if (this.gleitet || this.klebt || this.idle < 1) return;
    const kandidaten = this.kacheln.filter((t) => t.blatt === this.nr && t.geklebt && t.sticker && !t.huepft);
    if (!kandidaten.length) return;
    const t = pick(kandidaten);
    this.tween(t.sticker, { scale: 1.045 }, 0.9, { ease: 'sineInOut', yoyo: true, repeat: 1 });
  }

  // ---------------------------------------------------------------- Schmetterling

  baueSchmetterling() {
    const f = baueSchmetterling();
    f.scale.set(1.15);
    f.visible = false;
    f.zIndex = 60;
    this.front.addChild(f);
    tap(f, () => this.schmetterlingTipp(), { sound: null, squash: false, hitArea: new Circle(0, 0, 115) });
    this.falter = {
      c: f,
      modus: 'weg',      // 'weg' | 'fliegt' | 'sitzt'
      zeit: rand(5, 8),  // bis zum nächsten Auftritt / Rest des Sitzens
      ax: 0, ay: 0, zx: 0, zy: 0, p: 0, dauer: 1, gehen: false, phase: 0, ziel: null,
    };
  }

  schmetterlingStart(nachX, nachY, gehen) {
    const F = this.falter;
    F.ax = F.c.x;
    F.ay = F.c.y;
    F.zx = nachX;
    F.zy = nachY;
    F.p = 0;
    F.dauer = clamp(Math.hypot(nachX - F.ax, nachY - F.ay) / 280, 1.4, 5.5);
    F.gehen = gehen;
    F.modus = 'fliegt';
  }

  // fliegt zum Rand davon (oben hinaus)
  schmetterlingWeg() {
    const F = this.falter;
    if (!F || F.modus === 'weg' || F.gehen) return;
    const seite = F.c.x < 0 ? -1 : 1;
    this.schmetterlingStart(seite * 1500, rand(150, 500), true);
  }

  schmetterlingTipp() {
    const F = this.falter;
    if (F.modus === 'sitzt') {
      sfx('common/funkeln', { vol: 0.4 });
      fx.burst('funkeln', F.c.x, F.c.y, { count: 3, parent: this.front, z: 61 });
      this.schmetterlingWeg();
    } else {
      note('pling', pick([84, 86, 88]), { vol: 0.5 });
      fx.pop(F.c, 0.1);
    }
  }

  bewegeSchmetterling(dt, t) {
    const F = this.falter;
    const c = F.c;
    if (F.modus === 'weg') {
      F.zeit -= dt;
      if (F.zeit > 0 || this.gleitet || this.klebt) return;
      // von einer Seite herein, zu einem gesammelten Sticker der sichtbaren Doppelseite (sonst auf die Seite)
      const seite = Math.random() < 0.5 ? -1 : 1;
      c.position.set(seite * 1500, rand(250, 1100));
      c.visible = true;
      // lieber zu einem eingeklebten Sticker, sonst an einen leeren Platz – nie auf den Falz
      const hier = this.kacheln.filter((k) => k.blatt === this.nr);
      const kandidaten = hier.filter((k) => k.geklebt);
      const ziel = kandidaten.length ? pick(kandidaten) : hier.length ? pick(hier) : null;
      F.ziel = ziel;
      // setzt sich an den oberen Rand des Stickers (nicht aufs Gesicht)
      if (ziel) this.schmetterlingStart(ziel.k.x + 80, ziel.k.y - 100, false);
      else this.schmetterlingStart(-600, 500, false);
      return;
    }
    if (F.modus === 'fliegt') {
      F.p = Math.min(1, F.p + dt / F.dauer);
      const e = ease.sineInOut(F.p);
      const dx = F.zx - F.ax;
      const dy = F.zy - F.ay;
      const len = Math.hypot(dx, dy) || 1;
      // sanftes Auf und Ab quer zur Flugrichtung
      const welle = Math.sin(F.p * Math.PI * 3) * 45 * Math.sin(F.p * Math.PI);
      const x = F.ax + dx * e + (-dy / len) * welle;
      const y = F.ay + dy * e + (dx / len) * welle;
      const winkel = Math.atan2(y - c.y, x - c.x) + Math.PI / 2;
      if (Math.hypot(x - c.x, y - c.y) > 0.5) c.rotation += (clamp(winkel, -0.6, 0.6) - c.rotation) * Math.min(1, dt * 3);
      c.position.set(x, y);
      F.phase += dt * 2.4 * Math.PI * 2; // 2,4 Flügelschläge pro Sekunde
      const offen = 0.3 + 0.7 * Math.abs(Math.cos(F.phase));
      c.fluegel[0].scale.x = offen;
      c.fluegel[1].scale.x = offen;
      if (F.p >= 1) {
        if (F.gehen) {
          F.modus = 'weg';
          F.gehen = false;
          c.visible = false;
          F.zeit = rand(14, 22);
        } else {
          F.modus = 'sitzt';
          F.zeit = rand(4, 6.5);
          F.phase = 0;
        }
      }
      return;
    }
    // sitzt: Flügel öffnen und schließen sich langsam
    F.zeit -= dt;
    F.phase += dt;
    const offen = 0.65 + 0.35 * Math.cos(F.phase * 1.6);
    c.fluegel[0].scale.x = offen;
    c.fluegel[1].scale.x = offen;
    c.rotation += (0.15 - c.rotation) * Math.min(1, dt * 2);
    if (F.zeit <= 0) this.schmetterlingWeg();
  }

  // ---------------------------------------------------------------- Marienkäfer

  baueKaefer() {
    const k = baueMarienkaefer();
    // krabbelt am unteren Rand der linken Buchseite hin und her – kehrt vor dem Falz um
    const seite = this.buchSeiten[0];
    k.position.set(-700, seite.y2 - 40);
    k.zIndex = 30;
    this.world.addChild(k);
    tap(k, () => this.kaeferTipp(), { sound: null, hitArea: new Circle(0, 0, 110) });
    this.kaefer = { c: k, richtung: 1, pause: 0, schritt: 0, x1: seite.x1 + 210, x2: seite.x2 - 110 };
  }

  kaeferTipp() {
    const K = this.kaefer;
    note('pling', pick([79, 81, 84]), { vol: 0.5 });
    fx.burst('herzen', K.c.x, K.c.y - 60, { count: 1, parent: this.world, z: 31 });
    K.pause = 1.6;
    K.richtung *= -1; // dreht danach um
  }

  bewegeKaefer(dt) {
    const K = this.kaefer;
    const c = K.c;
    if (K.pause > 0) {
      K.pause -= dt;
      c.beine.y = 0;
    } else {
      c.x += K.richtung * 26 * dt;
      K.schritt += dt;
      c.beine.y = Math.sin(K.schritt * 9) * 2.5;
      if (c.x > K.x2) K.richtung = -1;
      if (c.x < K.x1) K.richtung = 1;
      // ab und zu eine kleine Rast
      if (Math.random() < dt * 0.08) K.pause = rand(1.5, 3.5);
    }
    // Kopf zeigt in Laufrichtung (weich umdrehen)
    const ziel = K.richtung;
    c.scale.x += (ziel - c.scale.x) * Math.min(1, dt * 4);
  }

  // ---------------------------------------------------------------- Buch und Tisch

  // Tipp neben die Sticker: auf eine Buchseite raschelt das Papier, auf dem Tisch klopft es leise aufs Holz;
  // ein, zwei Funken an der Stelle, und der Marienkäfer dreht sich neugierig dorthin.
  tippeBuch(e) {
    const jetzt = performance.now();
    if (jetzt - this.buchTipp < BUCH_PAUSE * 1000) return; // mehrere Finger / Dauertippen: ruhig bleiben
    this.buchTipp = jetzt;
    const seite = (this.buchSeiten || []).findIndex((b) => e.x > b.x1 && e.x < b.x2 && e.y > b.y1 && e.y < b.y2);
    if (seite >= 0) sfx('common/wisch', { vol: 0.35 });
    else sfx('common/klack', { vol: 0.35 });
    fx.burst('funkeln', e.x, e.y, { count: 2, parent: this.front, z: 20 });
    const K = this.kaefer;
    if (K && seite === 0) {
      K.richtung = e.x > K.c.x ? 1 : -1;
      K.pause = 0;
    }
  }

  // ---------------------------------------------------------------- Ablauf

  update(dt, t) {
    if (!this.falter) return; // noch beim Aufbau
    this.bewegeSchmetterling(dt, t);
    this.bewegeKaefer(dt);
    // Sticker der anderen Doppelseiten nach und nach vorbereiten (nicht während des Umblätterns/Einklebens)
    if (this.zuBauen.length && !this.gleitet && !this.klebt) {
      this.bauUhr -= dt;
      if (this.bauUhr <= 0) {
        this.bauUhr = 0.06;
        this.zeigeSticker(this.zuBauen.shift());
      }
    }
  }

  hints() {
    if (this.klebt || this.gleitet || !this.kacheln) return [];
    // Leeres Album: der nächste sinnvolle Schritt ist, spielen zu gehen und Sticker zu finden → Ausgang
    // (Karten-Knopf bzw. Zurück-Knopf in den Ort)
    if (!this.hatEtwas && this.ausgang && !this.ausgang.destroyed) {
      voice('album_leer');
      return [this.ausgang];
    }
    this.hinweisZaehler++;
    const hier = this.kacheln.filter((t) => t.blatt === this.nr);
    const sticker = hier.find((t) => t.geklebt);
    const pfeil = this.pfeile?.find((k) => k.an && k.richtung > 0) || this.pfeile?.find((k) => k.an);
    const ziele = [];
    // abwechselnd: einen Sticker antippen / umblättern
    if (sticker && (this.hinweisZaehler % 2 || !pfeil)) ziele.push(sticker.k);
    if (pfeil) {
      ziele.push(pfeil);
      if (!sticker || !(this.hinweisZaehler % 2)) voice('album_blaettern');
    }
    if (!ziele.length && hier.length) ziele.push(hier[0].k);
    return ziele;
  }

  exit() {
    // Der Stern-Zähler am Album-Knopf zeigt, was es Neues gibt – jetzt ist alles angeschaut
    if (this.kacheln && !this.kacheln.some((t) => t.neu && !t.geklebt)) store.set('album.sterne', 0);
    // Sprites zerstört der Kern gleich danach; die eigenen geladenen Bilder erst, wenn sie nicht mehr gezeigt werden.
    // Die weißen Sticker-Ränder bleiben im Speicher von bilder.js für den nächsten Besuch.
    const geladen = this.geladen || [];
    setTimeout(() => gibFrei(geladen), 0);
  }
}
