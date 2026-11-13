// Bahnhof: Hier baut das Kind seinen Zug zusammen und fährt los.
//
// - Der gespeicherte Zug (ladeZug) rollt weich von links herein und hält am Bahnsteig (bei 4 Wagen etwas weiter
//   links, damit die Lok nicht vor der Gepäckkarre steht; wird er länger oder kürzer, rückt er weich nach).
// - Oben vier große Auswahl-Knöpfe (Lok, Wagen, Tiere/Leute, Ladung). Ein Tipp öffnet unten eine Leiste:
//     Lok antippen/zum Zug ziehen   → die Lok wechselt (alte pufft weg, neue hüpft hin)
//     Wagen antippen/ziehen         → wird hinten angekuppelt (bei 4 Wagen wird der letzte ausgetauscht)
//     Tier/Mensch antippen/ziehen   → hüpft in den nächsten freien bzw. den getroffenen Wagen
//     Ladung antippen/ziehen        → plumpst in den nächsten passenden bzw. den getroffenen Wagen
// - Am Zug: Lok antippen = Pfiff. Wagen antippen = wackelt (Gäste freuen sich); Wagen lange nach unten ziehen =
//   abkuppeln. Gast antippen = freut sich; Gast aus dem Wagen ziehen = steigt aus und läuft davon.
//   Ladung antippen = klackt; aus dem Wagen ziehen = wird abgeladen.
// - Im Wartehäuschen wartet ein Tier: antippen = freut sich, in den Zug ziehen = steigt ein (bald wartet ein neues).
// - Rechts der grüne Knopf mit der Kelle: Glocke, Pfiff, Gäste jubeln, der Zug fährt hinaus → Szene 'fahrt'.
// - Nebensachen: Turmuhr (Kuckuck, Zeiger drehen), Bank, Gepäckkarre, Bahnhofsglocke, Laterne, Baum,
//   Bahnhofshaus (Gong), Vogel, Schmetterling, Wolken.
// Jede Änderung am Zug wird gespeichert (speichereZug).
//
// Haupt-Ablauf jeder Runde (ablauf.js): Zwei Fahrgäste kommen, der Schaffner knipst ihre Fahrkarten, sie steigen in
// ihren Wunsch-Wagen, die Gepäckkarre wird zum Zug geschoben, die Lok wird versorgt (Wasser, Putzen oder Dampf),
// das Signal wird grün – dann hebt der Schaffner die Kelle. Der freie Zugbau oben bleibt jederzeit möglich.

import {
  Scene, stage, spr, sfx, voice, tap, drag, Actor, fx, ui, store, killTweensOf, pick, clamp, cancelAllFingers,
  pruefeStimme, PIXI,
} from '../../engine/index.js';
import { setzeHintergrund, hgPunkt } from '../../gemeinsam/seiten.js';
import {
  Zug, legeGleis, ladeZug, speichereZug, LOKS, WAGEN, WAGEN_MIT_SITZ, WAGEN_MIT_LADUNG, GAESTE_TIERE,
  GAESTE_MENSCHEN, LADUNGEN,
} from '../../gemeinsam/zug.js';
import { belohne, stickerFuerOrt } from '../../gemeinsam/sticker.js';
import { Vogel, Schmetterling, Uhr, Wolken } from './deko.js';
import { Abfahrt } from './ablauf.js';
import { Gueterbahnhof } from './gueter.js';

const { Container, Graphics, Circle, Rectangle, Point } = PIXI;

const HG = 'bahnhof/hg_bahnhof';
// Das Gleis liegt etwas höher als der Punkt „gleis" (1325) – noch im Schotterstreifen (1215–1440). So bleibt der Zug
// ganz sichtbar, wenn unten die Auswahl-Leiste (y 1270–1520) offen ist; sie deckt dann nur die Schiene ab.
const GLEIS_Y = 1250;
const SKALA = 0.5;               // Zug-Größe (Lok ≈ 470 breit, 4 Wagen ≈ 2100)
const EINFAHRT_TEMPO = 520;      // Einheiten/s beim Hereinrollen (höchstens)
const ABFAHRT_TEMPO = 450;
const RANGIER_TEMPO = 200;       // Einheiten/s, wenn der Zug am Bahnsteig ein Stück vor- oder zurückrückt
const MAX_WAGEN = 4;
// Der Zug hält in der Mitte. Ist er so lang, dass die Lok vor der Gepäckkarre (ganz rechts, ab x ≈ 820) stünde, hält
// er ein Stück weiter links – höchstens so weit, dass der letzte Wagen noch ganz im Bild bleibt (Tablet: bis -1280).
const LOK_RECHTS_HOECHSTENS = 806;
const ZUG_LINKS_MINDESTENS = -1235;
const TUER_X = -490;             // Tür des gemalten Bahnhofshauses (genau unter der Turmuhr)
const OFFENE = ['wagen_offen_rot', 'wagen_offen_blau', 'wagen_offen_gelb', 'wagen_offen_gruen', 'wagen_offen_lila', 'wagen_offen_orange'];
const MENSCHEN = new Set(GAESTE_MENSCHEN);
// Diese Tiere warten gern im Wartehäuschen (nicht zu groß fürs Häuschen)
const WARTENDE = ['hund', 'katze', 'hase', 'schaf', 'schwein', 'ente', 'pinguin', 'fuchs', 'affe', 'igel', 'huhn', 'eule'];

const ARTEN = {
  lok: { icon: 'bahnhof/icon_lok', stimme: 'bahnhof_lok', items: LOKS.map((id) => ({ id, tex: 'zug/' + id })) },
  wagen: { icon: 'bahnhof/icon_wagen', stimme: 'bahnhof_wagen', items: WAGEN.map((id) => ({ id, tex: 'zug/' + id })) },
  gast: {
    icon: 'bahnhof/icon_tiere',
    stimme: 'bahnhof_tiere',
    items: [
      ...GAESTE_TIERE.map((id) => ({ id, tex: `tiere/${id}_idle` })),
      ...GAESTE_MENSCHEN.map((id) => ({ id, tex: `zug/${id}_idle` })),
    ],
  },
  ladung: { icon: 'bahnhof/icon_ladung', stimme: 'bahnhof_ladung', items: LADUNGEN.map((id) => ({ id, tex: 'zug/' + id })) },
};
const REIHE = ['lok', 'wagen', 'gast', 'ladung'];
// Zweite Seite (Güterbahnhof, gueter.js): liegt so weit rechts (Hintergründe sind 2829 breit); Blättern wie bei den
// Seiten-Orten (1,0 s, sineInOut). Pfeil-Tipps während des Gleitens und 0,3 s danach zählen nicht.
const WEITE = 2900;
const GLEITEN = 1.0;
const PFEIL_Y = 840;             // Blätter-Pfeile: unter der Kelle, über dem Signal
const PFEIL_HINWEIS_AB = 30;     // so lange Ruhe, dann zeigt die Hand auf den Pfeil

export default class Bahnhof extends Scene {
  static id = 'bahnhof';
  static packs = ['bahnhof', 'zug', 'tiere'];
  // Alle Tiere, die hier zu sehen sein können: Auswahl-Leiste (alle Zug-Gäste), Fahrgäste, Wartehäuschen, gespeicherter Zug
  static tiere = ['kuh', 'schaf', 'schwein', 'pferd', 'hund', 'katze', 'hase', 'huhn', 'ente', 'frosch', 'maus', 'igel',
    'baer', 'affe', 'loewe', 'elefant', 'giraffe', 'pinguin', 'fuchs', 'eule', 'eichhoernchen', 'hahn'];
  static music = 'musik/fahrt';

  async enter(params = {}) {
    this.nr = 0;                 // sichtbare Seite: 0 Bahnsteig, 1 Güterbahnhof
    this.gleitet = false;
    this._ruhtBis = 0;
    this.gueter = null;
    this.hud1 = new Container({ label: 'seite1:hud', sortableChildren: true });
    this.hud.addChild(this.hud1);
    this.modus = 'kommt';        // 'kommt' (rollt herein) → 'steht' → 'faehrt' (Abfahrt)
    this.v = 0;                  // Geschwindigkeit beim Hereinrollen
    this.leiste = null;
    this.leisteArt = null;
    this.aenderungen = 0;        // wie oft das Kind den Zug verändert hat (für die Hinweise)
    this.tauschGast = 0;
    this.tauschLadung = 0;
    this.toene = new Map();      // Ton-id → Zeit des letzten Abspielens (Entprellen)
    this.zuege = new Map();      // pointerId → laufendes Ziehen an Zug-Teilen (Wagen, Gast, Ladung)
    this.laeufer = new Set();    // ausgestiegene Gäste, die gerade davonlaufen

    this.hg = setzeHintergrund(this, HG);
    const punkt = (name, ersatz) => hgPunkt(this.hg, HG, name) || ersatz;
    // Punkt „boden" (1085) ist die Vorderkante des Bahnsteigs – dort verdeckt der Zug alles. Die Dinge stehen
    // deshalb hinten auf dem Bahnsteig, auf einer Linie mit dem Bahnhofshaus.
    this.boden = punkt('boden', { y: 1085 }).y - 45;

    this.baueBahnsteig(punkt);
    this.gleis = legeGleis(this.world, { y: GLEIS_Y, z: 4, scale: SKALA });
    this.baueZug();
    this.baueKnoepfe();
    ui.albumKnopf(this);
    this.richteZiehenEin();
    // Die Abfahrts-Vorbereitung (Schaffner, Fahrgäste, Gepäckkarre, Signal, Girlande). Das Tier fürs Wartehäuschen
    // kommt jetzt als Nachzügler, wenn die Fahrgäste eingestiegen sind (ablauf.einsteigen → neuerWartegast).
    this.ablauf = new Abfahrt(this);
    // „Zu früh auf Grün": Der erste Tipp zeigt, was noch fehlt (losHinweisZeit). Tippt das Kind danach mit etwas
    // Abstand noch einmal (nicht nur Dauertippen), fährt der Zug trotzdem. Nach 12 s gilt wieder der erste Tipp.
    this.losHinweisZeit = -99;
    this.every(1.5, () => this.pruefeWartegast());

    // Begrüßung – aber nicht mehr, wenn der Zug schon abfährt (sie kann hinter einem Leisten-Satz warten).
    // Die Hinweise zu den Schritten sagt der Ablauf selbst an (nur, solange das Kind den Schritt noch nicht tut).
    this.after(1.2, () => voice('bahnhof_hallo', { nurWenn: () => this.modus !== 'faehrt' && this.nr === 0 }));

    // Start auf der zweiten Seite (Rückweg aus dem Album, ?seite=1 beim Testen)
    if (startSeite(params) === 1) this.zeigeSeite(1, true);
  }

  // ---------------------------------------------------------------- Seiten (Bahnsteig ↔ Güterbahnhof)

  holeGueter() {
    if (!this.gueter) {
      this.gueter = new Gueterbahnhof(this, WEITE);
      this.versatz(this.nr);
    }
    return this.gueter;
  }

  // k = 0: Bahnsteig, 1: Güterbahnhof (dazwischen: beim Gleiten)
  versatz(k) {
    const x = -WEITE * k;
    this.bg.x = x;
    this.world.x = x;
    this.front.x = x;
    this.hud1.x = -stage.W * k;
    this.hud1.visible = k < 0.999;
    if (this.gueter) {
      this.gueter.hud.x = stage.W * (1 - k);
      this.gueter.hud.visible = k > 0.001;
      // Auf dem Bahnsteig ist vom Güterbahnhof nichts zu sehen (dort wartende Züge ragten sonst herein)
      const g = this.gueter;
      g.hinten.visible = g.welt.visible = g.vorn.visible = k > 0.001;
    }
  }

  async zeigeSeite(n, sofort = false) {
    if (this.gleitet || n === this.nr || (!sofort && this.t < this._ruhtBis)) return;
    if (n === 1 && this.modus === 'faehrt') return;
    const g = this.holeGueter();
    const alt = this.nr;
    this.gleitet = true;
    // Was gerade gezogen oder gezeigt wird, endet sauber; während des Gleitens keine Eingabe
    cancelAllFingers();
    ui.handWeg(0.2);
    this.schliesseLeiste();
    this.zuege.forEach((z) => z.ende());
    this.zuege.clear();
    if (alt === 1) g.verlassen();
    this.nr = n;
    pruefeStimme();
    const ebenen = [this.bg, this.world, this.front, this.hud1, g.hud];
    for (const c of ebenen) c.interactiveChildren = false;
    if (!sofort) {
      sfx('common/wusch', { vol: 0.35 });
      const p = { k: alt };
      await this.tween(p, { k: n }, GLEITEN, { ease: 'sineInOut', onUpdate: () => this.versatz(p.k) });
    }
    this.versatz(n);
    for (const c of ebenen) c.interactiveChildren = true;
    this.gleitet = false;
    this._ruhtBis = this.t + 0.3;
    if (n === 1) g.betreten();
  }

  rückkehr() {
    return { seite: this.nr };
  }

  get hinweisHaende() {
    return 4;
  }

  // Die Stimme wiederholt einen Hinweis nur, solange die Hand noch nicht auf den Blätter-Pfeil zeigt
  hinweisWiederholbar() {
    if (this.gleitet || this.idle >= PFEIL_HINWEIS_AB) return false;
    return this.hints().length > 0;
  }

  // ---------------------------------------------------------------- Bahnsteig und Nebensachen

  baueBahnsteig(punkt) {
    const B = this.boden;
    const w = this.world;

    // Wolken ziehen langsam (hinter allem, über dem gemalten Himmel)
    this.wolken = new Wolken(this, { parent: this.bg, z: -500 });

    // Turmuhr: Punkt „uhr" liegt am oberen Rand des Zifferblatts; die Mitte sitzt 12 Bildpunkte tiefer
    const u = punkt('uhr', { x: -490, y: 442 });
    const sk = this.hg.scale.x;
    this.uhr = new Uhr(this, {
      hgId: HG, mitte: { x: u.x, y: u.y + 12 * sk }, bildMitte: { x: 925, y: 454 }, radius: 100, skala: sk,
      parent: this.bg, z: -900,
    });

    // Bahnhofshaus (gemalt): antippen = Bahnhofs-Gong, zwei Noten steigen auf
    this.haus = new Container({ label: 'haus' });
    this.haus.zIndex = -800;
    this.bg.addChild(this.haus);
    tap(this.haus, () => {
      if (this.ton('common/gong', 3, { vol: 0.6 })) fx.burst('noten', -230, 760, { count: 2, parent: this.front });
    }, { sound: null, squash: false, hitArea: new Rectangle(-1040, 600, 760, 400) });

    // Laterne: antippen = Licht wird weich heller bzw. wieder normal
    this.licht = new Graphics().circle(0, 0, 90).fill({ color: 0xffe08a, alpha: 0.5 }).circle(0, 0, 55).fill({ color: 0xfff2c4, alpha: 0.5 });
    this.licht.position.set(-1172, 660);
    this.licht.alpha = 0;
    this.licht.zIndex = -700;
    this.licht.eventMode = 'none';
    this.bg.addChild(this.licht);
    const laterne = new Container({ label: 'laterne' });
    laterne.zIndex = -690;
    this.bg.addChild(laterne);
    // (Die Laterne ist gemalt und steht links außerhalb des Kernbereichs; die Tippfläche reicht bis in ihn hinein.
    //  Umschalten höchstens alle 0,8 s – so wechselt das Licht auch bei Dauertippen nur weich.)
    tap(laterne, () => {
      if (!this.ton('common/klick', 0.8, { vol: 0.6 })) return;
      this.lichtAn = !this.lichtAn;
      killTweensOf(this.licht, ['alpha']);
      this.tween(this.licht, { alpha: this.lichtAn ? 1 : 0 }, 0.8, { ease: 'sineInOut' });
    }, { sound: null, squash: false, hitArea: new Rectangle(-1275, 520, 270, 520) });

    // Baum oben links: Blätter rascheln
    const baum = new Container({ label: 'baum' });
    baum.zIndex = -680;
    this.bg.addChild(baum);
    tap(baum, (e) => {
      if (this.ton('common/rascheln', 0.8, { vol: 0.6 })) fx.burst('blaetter', e.x, e.y + 40, { count: 4, parent: this.front });
    }, { sound: null, squash: false, hitArea: new Rectangle(-1000, 80, 480, 230) });

    // Bahnhofsglocke rechts neben dem Haus
    this.glocke = spr('bahnhof/bahnhofsglocke', { x: -10, y: B + 4, scale: 0.56, parent: w, z: 2 });
    tap(this.glocke, () => this.laeuten(), { sound: null, pad: 50 });

    // Bank vor dem linken Fenster des Bahnhofshauses: Dort kommt die hohe Lok nie hin (sie steht immer rechts der
    // Mitte), davor fahren nur die niedrigen Wagen – die Bank bleibt also immer sichtbar. Der Vogel sitzt gern auf der
    // Lehne, bei langem Zug wartet hier auch das Tier aus dem Wartehäuschen.
    this.bank = spr('bahnhof/bank', { x: -790, y: B + 4, scale: 0.52, parent: w, z: 2 });
    // Sitzfläche: im Bild etwa 100 Bildpunkte über dem Anker; das Tier sitzt links, die rechte Lehne bleibt dem Vogel
    this.bankSitz = { x: this.bank.x - 35, y: B + 4 - 100 * 0.52 };
    tap(this.bank, () => {
      fx.wobble(this.bank, 0.03);
      this.ton('common/klack', 0.3, { vol: 0.6 });
      if (this.vogel?.nr === 0) this.vogel.tipp();
    }, { sound: null, pad: 40 });

    // Wartehäuschen (darin wartet ein Tier)
    this.haeuschen = spr('bahnhof/wartehaeuschen', { x: 720, y: B + 6, scale: 0.5, parent: w, z: 1 });
    tap(this.haeuschen, () => {
      fx.wobble(this.haeuschen, 0.02);
      if (this.wartegast && !this.wartegast.destroyed) this.wartegast.cheer();
      else this.ton('common/tuer', 0.6, { vol: 0.5 });
    }, { sound: null, pad: 30 });

    // Die Gepäckkarre (ganz rechts) gehört jetzt zum Ablauf (ablauf.js): Gepäck zum Zug schieben, leer hüpft sie.

    // Vogel: Bank-Lehne → Pfosten der Glocke → Dach des Wartehäuschens → zurück (alle drei bleiben über der Lok sichtbar).
    // Er liegt unter dem wartenden Tier (z 3): Sitzen beide auf der Bank, greift der Finger das Tier, nicht den Vogel.
    const oben = (s, dx = 0) => ({ x: s.x + dx, y: s.y - s.height * s.anchor.y + 6 });
    this.vogel = new Vogel(this, [oben(this.bank, 85), oben(this.glocke, -2), oben(this.haeuschen, 0)], { parent: w, z: 2.6, skala: 0.9 });

    // Schmetterling über der Wiese hinter dem Bahnsteig
    this.falter = new Schmetterling(this, { x: 380, y: 800, breite: 420, hoehe: 60, parent: w, z: 7 });
  }

  // Wartendes Tier im Häuschen (antippen = freut sich, in den Zug ziehen = steigt ein)
  neuerWartegast(verz = 2.5) {
    this.after(verz, () => {
      if (this.wartegast && !this.wartegast.destroyed) return;
      if (this.modus === 'faehrt') return;
      const id = pick(WARTENDE.filter((t) => !this.gastImZug(t) && t !== this.letzterWartegast)) || 'hund';
      this.letzterWartegast = id;
      const platz = this.warteplatz();
      const a = new Actor(id, { x: platz.x, y: platz.y, scale: 0.2, parent: this.world, z: 3 });
      a.wartId = id;
      a._ort = platz.ort;
      this.wartegast = a;
      a.alpha = 0;
      this.tween(a, { alpha: 1 }, 0.5, { ease: 'sineInOut' });
      if (platz.ort === 'haeuschen') {
        // kommt von rechts ins Häuschen spaziert
        a.x = Math.min(platz.x + 260, 1040);
        a.flip = true;
        a.walkTo(platz.x, platz.y, { tempo: 200 }).then((ok) => { if (ok && !a.destroyed) a.flip = false; });
      }
      a.onTap(() => a.cheer(), { pad: 70 });
      // Auf der Bank steht es hinter den Wagen: Ein Griff über dem Zug hält es greifbar (Fahrgäste ragen sonst davor)
      this.ablauf?.griffFuerFigur(a, 0.2 * 900 * 0.97);
      drag(a, {
        lift: 1.08,
        targets: () => this.zugZiele(),
        onStart: () => {
          a._gezogen = true;
          if (a._wechselt) {
            // mitten im Platzwechsel gegriffen: gleich ganz sichtbar, der Platz wird danach neu geprüft
            killTweensOf(a, ['alpha']);
            a.alpha = 1;
            a._wechselt = false;
            a._ort = null;
          }
        },
        onDrop: (ziel, ctx) => {
          a._gezogen = false;
          // nur angetippt (kaum bewegt): freut sich nur, steigt nicht ein
          if (Math.hypot(ctx.x - ctx.startX, ctx.y - ctx.startY) < 40) return false;
          if (this.modus === 'faehrt' || (!ziel && !this.ueberZug(a.x, a.y))) return false;
          // Sitzt dieses Tier schon im Zug, freut sich das im Zug – das wartende bleibt (kein Doppelgänger)
          const schon = this.zug.wagen.find((x) => x.gastId === id);
          if (schon) {
            this.jubeln(schon.index);
            return false;
          }
          if (!this.gastRein(id, ziel?.w || null)) return false;
          a.eventMode = 'none';
          this.tween(a, { alpha: 0, scale: a.scale.x * 0.7 }, 0.25, { ease: 'sineInOut' })
            .then(() => { if (!a.destroyed) a.destroy({ children: true }); });
          if (this.wartegast === a) this.wartegast = null;
          this.neuerWartegast(3);
          return true;
        },
      });
    });
  }

  // Rechte Kante der Lok in world-Koordinaten (die Lok steht vor dem Häuschen, wenn der Zug lang ist)
  lokRechts() {
    const lok = this.zug?.lok;
    if (!lok || lok.destroyed) return -9999;
    const b = lok.getBounds();
    return this.world.toLocal({ x: b.x + b.width, y: b.y }).x;
  }

  lokLinks() {
    const lok = this.zug?.lok;
    if (!lok || lok.destroyed) return 9999;
    const b = lok.getBounds();
    return this.world.toLocal({ x: b.x, y: b.y }).x;
  }

  // Liegt ein Ding (Fußpunkt x, y in world) über dem Zug? Großzügig: auch zwischen zwei Wagen und auf der Kupplung.
  ueberZug(x, y) {
    const z = this.zug;
    if (this.modus !== 'steht' || !z) return false;
    return x > z.x - z.laenge / 2 - 40 && x < this.lokRechts() + 40 && y > this.boden + 50 && y < GLEIS_Y + 220;
  }

  // Wo der Zug halten soll (Mitte des Zugs): in der Bildmitte – außer die Lok stünde dann vor der Gepäckkarre.
  halteX() {
    const z = this.zug;
    const lok = z?.lok;
    if (!lok || lok.destroyed) return 0;
    const lokRechts = this.lokRechts() - z.x;   // rechte Lok-Kante, gemessen von der Zug-Mitte
    const soll = Math.min(0, LOK_RECHTS_HOECHSTENS - lokRechts);
    return Math.round(Math.max(soll, ZUG_LINKS_MINDESTENS + z.laenge / 2));
  }

  // Am Bahnsteig: Ist der Zug länger oder kürzer geworden, rückt er weich (mit drehenden Rädern) auf seinen Halteplatz.
  rangiere(dt) {
    const z = this.zug;
    const rest = this.halteX() - z.x;
    if (Math.abs(rest) < 1.5 && Math.abs(this.v) < 6) {
      if (this.v !== 0 || z.geschwindigkeit !== 0) {
        this.v = 0;
        z.geschwindigkeit = 0;
      }
      return;
    }
    const soll = clamp(rest * 1.3, -RANGIER_TEMPO, RANGIER_TEMPO);
    this.v += (soll - this.v) * (1 - Math.exp(-dt * 2.5));
    z.geschwindigkeit = this.v;
  }

  gastImZug(id) {
    return this.zug.wagen.some((w) => w.gastId === id);
  }

  // Wo wartet das Tier? Im Häuschen – steht dort (bei 3–4 Wagen) die hohe Lok davor, auf der Bank vor dem Haus.
  // Beim Hereinrollen (und Rangieren) zählt schon die Endlage des Zugs.
  warteplatz() {
    const hx = this.haeuschen.x + 10;
    const dx = this.modus === 'faehrt' ? 0 : this.halteX() - this.zug.x;
    const links = this.lokLinks() + dx;
    const rechts = this.lokRechts() + dx;
    if (rechts < hx - 90 || links > hx + 90) return { ort: 'haeuschen', x: hx, y: this.boden };
    return { ort: 'bank', x: this.bankSitz.x, y: this.bankSitz.y };
  }

  // Regelmäßig: das wartende Tier wartet dort, wo man es sehen kann. Statt hinter der hohen Lok entlangzulaufen
  // (dann sähe es aus, als stünde es auf dem Lokdach), blendet es weich aus und am neuen Platz wieder ein.
  // Ist dasselbe Tier inzwischen in den Zug gestiegen, geht das wartende ins Haus und bald kommt ein anderes.
  pruefeWartegast() {
    const a = this.wartegast;
    if (!a || a.destroyed || a._gezogen || a._wechselt || this.modus !== 'steht') return;
    if (this.gastImZug(a.wartId)) {
      this.wartegast = null;
      a.eventMode = 'none';
      this.tween(a, { alpha: 0 }, 0.6, { ease: 'sineInOut' }).then(() => { if (!a.destroyed) a.destroy({ children: true }); });
      this.neuerWartegast(2.5);
      return;
    }
    const platz = this.warteplatz();
    if (platz.ort === a._ort) return;
    a._ort = platz.ort;
    a._wechselt = true;
    a.stop();
    this.tween(a, { alpha: 0 }, 0.5, { ease: 'sineInOut' }).then((ok) => {
      if (a.destroyed) return;
      if (!ok || a._gezogen) { a._wechselt = false; a.alpha = 1; return; }
      a.position.set(platz.x, platz.y);
      a.flip = false;
      this.tween(a, { alpha: 1 }, 0.5, { ease: 'sineInOut' }).then(() => { a._wechselt = false; });
    });
  }

  wartegastSichtbar() {
    const a = this.wartegast;
    if (!a || a.destroyed || a._wechselt || a.alpha < 0.9) return false;
    return a.x > this.lokRechts() + 40 || a.x < this.lokLinks() - 40;
  }

  // ---------------------------------------------------------------- Zug

  baueZug() {
    this.zug = new Zug({ konfig: ladeZug(), x: 0, y: GLEIS_Y, scale: SKALA, parent: this.world, szene: this, z: 5, bewegt: true });
    const z = this.zug;
    z.x = -stage.W / 2 - z.laenge / 2 - 120;   // startet links außerhalb und rollt herein
    z.geschwindigkeit = EINFAHRT_TEMPO * 0.6;
    this.v = z.geschwindigkeit;

    z.on('lok', (lok) => {
      this.tippbareLok(lok);
      this.ablauf?.lokNeu(lok);
    });
    z.on('wagen', (w) => this.tippbarerWagen(w));
    z.on('gast', (w) => this.tippbarerGast(w));
    z.on('ladung', (w) => this.tippbareLadung(w));
    this.tippbareLok(z.lok);
    for (const w of z.wagen) {
      this.tippbarerWagen(w);
      if (w.gast) this.tippbarerGast(w);
      if (w.ladung) this.tippbareLadung(w);
    }
  }

  tippbareLok(lok) {
    tap(lok, (e) => {
      // Lok-Pflege „Dampf machen“: Festhalten lässt Dampf aufsteigen (statt des Pfiffs)
      if (this.ablauf?.lokGedrueckt(e)) return;
      if (!this.zug.pfeife()) fx.wobble(lok.huepfer, 0.015);
    }, { sound: null });
  }

  tippbarerWagen(w) {
    tap(w.koerper, (e) => {
      if (!this.zug.wagen.includes(w)) return;
      w.fahrzeug.wackel(0.03);
      if (w.gast) this.jubeln(w.index);
      if (this.modus === 'faehrt') return;
      // Ziehen nach unten: Wagen folgt ein Stück, ab einer Weile wird er abgekuppelt.
      // Ziehen nach oben (der Finger lag auf der Vorderwand vor dem Gast): Gast steigt aus, sonst wird abgeladen.
      const f = w.fahrzeug;
      this.verfolge(w.koerper, e, {
        bewegt: (dx, dy) => {
          if (f.destroyed || !this.zug.wagen.includes(w)) return true;
          if (dy < -170) {
            if (w.gast) this.aussteigen(w);
            else if (w.ladung) this.abladen(w);
            else return false;
            killTweensOf(f.huepfer, ['y']);
            this.tween(f.huepfer, { y: 0 }, 0.35, { ease: 'backOut' });
            return true;
          }
          const tief = clamp(dy, 0, 400);
          killTweensOf(f.huepfer, ['y']);
          f.huepfer.y = Math.min(tief * 0.5, 100) / SKALA;
          if (tief > 240) {
            this.abkuppeln(w);
            return true;
          }
          return false;
        },
        ende: () => {
          if (!f.destroyed && this.zug.wagen.includes(w)) this.tween(f.huepfer, { y: 0 }, 0.35, { ease: 'backOut' });
        },
      });
    });
  }

  tippbarerGast(w) {
    const a = w.gast;
    if (!a) return;
    a.onTap((e) => {
      if (w.gast !== a) return;
      if (!this.jubeln(w.index) && !a.mensch) a.sound();
      if (this.modus === 'faehrt') return;
      // Herausziehen: der Gast hebt sich mit dem Finger, ab einer Weile steigt er aus
      this.verfolge(a, e, {
        bewegt: (dx, dy) => {
          if (a.destroyed || w.gast !== a) return true;
          const hoch = clamp(-dy, 0, 400);
          killTweensOf(a, ['y']);
          a.y = a._fuss - Math.min(hoch * 0.6, 110) / SKALA;
          if (hoch > 150 || Math.abs(dx) > 240) {
            this.aussteigen(w);
            return true;
          }
          return false;
        },
        ende: () => {
          if (!a.destroyed && w.gast === a) this.tween(a, { y: a._fuss }, 0.3, { ease: 'backOut' });
        },
      });
    }, { pad: 150 });
  }

  tippbareLadung(w) {
    const s = w.ladung;
    if (!s) return;
    // Im offenen Wagen sitzt die Ladung sonst so tief und klein, dass kaum etwas herausschaut: etwas größer machen
    // und das Bild über den Anker anheben (stört keine Bewegung des Bausteins), so dass gut drei Viertel über den
    // Rand ragen.
    const p = w.platz;
    if (p?.art === 'sitz' && !s._gehoben) {
      s._gehoben = true;
      s.scale.set(s.scale.x * 1.25, s.scale.y * 1.25);
      const sy = Math.abs(s.scale.y) || 1;
      const hoehe = s.texture.height * sy;
      const heben = s._fuss - (p.rand + hoehe * 0.22);
      if (heben > 0) s.anchor.y += heben / sy / s.texture.height;
    }
    tap(s, (e) => {
      if (w.ladung !== s) return;
      this.ton('common/klack', 0.25, { vol: 0.6 });
      if (this.modus === 'faehrt') return;
      this.verfolge(s, e, {
        bewegt: (dx, dy) => {
          if (s.destroyed || w.ladung !== s) return true;
          const hoch = clamp(-dy, 0, 400);
          killTweensOf(s, ['y']);
          s.y = s._fuss - Math.min(hoch * 0.6, 110) / SKALA;
          if (hoch > 150 || Math.abs(dx) > 240) {
            this.abladen(w);
            return true;
          }
          return false;
        },
        ende: () => {
          if (!s.destroyed && w.ladung === s) this.tween(s, { y: s._fuss }, 0.3, { ease: 'backOut' });
        },
      });
    }, { pad: 160, sound: null });
  }

  // ---------------------------------------------------------------- Zug verändern

  speichere() {
    speichereZug(this.zug.konfig);
  }

  geaendert() {
    this.aenderungen++;
    this.speichere();
    // „Tipp auf Grün" nur, solange der Zug noch steht (nicht, wenn das Kind schon auf Grün getippt hat)
    // (und erst, wenn die Abfahrt fertig vorbereitet ist – sonst sagt der Ablauf den nächsten Schritt an)
    const passt = () => this.modus === 'steht' && (!this.ablauf || this.ablauf.fertig);
    if (this.aenderungen >= 2 && this.zug.wagen.some((w) => w.gast) && passt()) {
      this.after(1.5, () => { if (passt()) voice('bahnhof_los', { nurWenn: passt }); });
    }
  }

  lokTauschen(id) {
    const z = this.zug;
    if (z.lok.typ === id) {
      z.pfeife();
      return z.lok;
    }
    // die alte Lok pufft weg
    const mitte = z.lok.punkt('gesicht', this.front);
    if (mitte) fx.burst('rauch', mitte.x - 60, mitte.y, { count: 5, parent: this.front });
    z.setzeLok(id);
    this.after(0.55, () => z.pfeife());
    this.geaendert();
    return z.lok;
  }

  // Wagen hinten anhängen; bei 4 Wagen wird der letzte ausgetauscht (Gast/Ladung ziehen mit um, wenn sie passen)
  wagenDazu(typ) {
    const z = this.zug;
    if (z.wagen.length < MAX_WAGEN) {
      const w = z.wagenDazu(typ);
      this.geaendert();
      return w || null;
    }
    const alt = z.wagen[z.wagen.length - 1];
    const gast = alt.gastId;
    const ladung = alt.ladungId;
    if (gast && !WAGEN_MIT_SITZ.includes(typ)) this.aussteigen(alt);
    z.wagenWeg();
    const neu = z.wagenDazu(typ);
    if (!neu) return null;
    if (gast && WAGEN_MIT_SITZ.includes(typ)) z.setzeGast(neu.index, gast);
    if (ladung && WAGEN_MIT_LADUNG.includes(typ)) {
      this.after(0.3, () => {
        if (z.wagen.includes(neu)) z.setzeLadung(neu.index, ladung);
        this.speichere();
      });
    }
    this.geaendert();
    return neu;
  }

  abladen(w) {
    if (!w.ladung) return;
    this.zug.setzeLadung(w.index, null);
    this.ton('common/rupf', 0.3, { vol: 0.7 });
    this.geaendert();
  }

  abkuppeln(w) {
    if (!this.zug.wagen.includes(w)) return;
    if (w.gast) this.aussteigen(w);
    this.tween(w.fahrzeug.huepfer, { y: w.fahrzeug.huepfer.y + 60 }, 0.6, { ease: 'sineIn' });
    this.zug.wagenWeg(w.index);
    this.geaendert();
  }

  // In welchen Wagen kommt ein Gast? Getroffener Sitz-Wagen, sonst erster freier, sonst ein neuer offener Wagen,
  // sonst reihum (der bisherige Gast steigt aus).
  wohin(w) {
    const z = this.zug;
    if (w && z.wagen.includes(w) && w.platz?.art === 'sitz') return w;
    const i = z.freierPlatz();
    if (i >= 0) return z.wagen[i];
    if (z.wagen.length < MAX_WAGEN) {
      const frei = OFFENE.filter((t) => !z.wagen.some((x) => x.typ === t));
      return z.wagenDazu(pick(frei.length ? frei : OFFENE)) || null;
    }
    const mitSitz = z.wagen.filter((x) => x.platz?.art === 'sitz');
    if (mitSitz.length) return mitSitz[this.tauschGast++ % mitSitz.length];
    return this.wagenDazu(pick(OFFENE));   // tauscht den letzten Wagen gegen einen offenen
  }

  // Gäste gibt es im Zug nur einmal: Tippt das Kind dasselbe Tier noch einmal an (oder zieht es irgendwohin an den
  // Zug), freut sich das Tier, das schon mitfährt – es entstehen keine Doppelgänger, und die anderen Gäste, die das
  // Kind ausgesucht hat, bleiben sitzen.
  gastRein(id, w = null) {
    const z = this.zug;
    const schon = z.wagen.find((x) => x.gastId === id);
    if (schon) {
      this.jubeln(schon.index);
      return schon.fahrzeug;
    }
    w = this.wohin(w);
    if (!w) return null;
    if (w.gastId === id) {
      z.gaesteJubeln(w.index);
      return w.fahrzeug;
    }
    if (w.gast) this.aussteigen(w);
    z.setzeGast(w.index, id);
    this.geaendert();
    return w.fahrzeug;
  }

  // Ladung ebenso: Was schon geladen ist, hüpft kurz in seinem Wagen, statt den Zug mit Kopien zu füllen.
  ladungRein(id, w = null) {
    const z = this.zug;
    const schon = z.wagen.find((x) => x.ladungId === id && x.ladung);
    if (schon) {
      fx.pop(schon.ladung, 0.1);
      this.ton('common/klack', 0.25, { vol: 0.6 });
      return schon.fahrzeug;
    }
    if (!(w && z.wagen.includes(w) && WAGEN_MIT_LADUNG.includes(w.typ))) {
      w = z.wagen.find((x) => WAGEN_MIT_LADUNG.includes(x.typ) && !x.ladung) || null;
      if (!w && z.wagen.length < MAX_WAGEN) w = z.wagenDazu('wagen_flach') || null;
      if (!w) {
        const mit = z.wagen.filter((x) => WAGEN_MIT_LADUNG.includes(x.typ));
        w = mit.length ? mit[this.tauschLadung++ % mit.length] : this.wagenDazu('wagen_flach');
      }
    }
    if (!w) return null;
    if (w.ladungId === id) {
      if (w.ladung) fx.pop(w.ladung, 0.1);
      this.ton('common/klack', 0.25, { vol: 0.6 });
      return w.fahrzeug;
    }
    z.setzeLadung(w.index, id);
    this.geaendert();
    return w.fahrzeug;
  }

  // Gast steigt aus: hüpft auf den Bahnsteig und läuft ins Bahnhofshaus
  aussteigen(w) {
    const a = w.gast;
    if (!a || a.destroyed) return;
    const id = w.gastId;
    const p = this.world.toLocal(a.getGlobalPosition());
    const wt = a.worldTransform;
    const ws = this.world.worldTransform;
    const skala = Math.hypot(wt.a, wt.b) / (Math.hypot(ws.a, ws.b) || 1);
    this.zug.setzeGast(w.index, null);
    a.visible = false;
    this.davonlaufen(id, p.x, p.y, skala);
    this.geaendert();
  }

  davonlaufen(id, x, y, skala) {
    // höchstens zwei gleichzeitig (Ruhe-Regel) – der älteste blendet sonst schon aus
    if (this.laeufer.size >= 2) {
      const alt = this.laeufer.values().next().value;
      this.laeufer.delete(alt);
      if (!alt.destroyed) this.tween(alt, { alpha: 0 }, 0.4, { ease: 'sineInOut' }).then(() => { if (!alt.destroyed) alt.destroy({ children: true }); });
    }
    const mensch = MENSCHEN.has(id);
    const a = new Actor(id, { pack: mensch ? 'zug' : 'tiere', x, y: Math.min(y, this.boden + 120), scale: skala, parent: this.world, z: 3 });
    this.laeufer.add(a);
    // Ziel: die Tür des Bahnhofshauses (links von allen Wagen). So läuft niemand hinter der hohen Lok entlang
    // (dort sähe es aus, als stünde das Tier auf dem Lokdach).
    const richtung = TUER_X < x ? -1 : 1;
    const huepfX = x + richtung * Math.min(90, Math.abs(TUER_X - x));
    a.onTap(() => {
      if (mensch) {
        a.pose('happy');
        a.hop(50);
        this.ton('common/landen', 0.3, { vol: 0.6 });
        this.after(1.2, () => { if (!a.destroyed) a.pose('idle'); });
      } else a.cheer();
    }, { pad: 60 });
    const fertig = () => {
      this.laeufer.delete(a);
      if (!a.destroyed) this.tween(a, { alpha: 0 }, 0.4, { ease: 'sineInOut' }).then(() => { if (!a.destroyed) a.destroy({ children: true }); });
    };
    a.hopTo(huepfX, this.boden, { hoehe: 140, dauer: 0.7 })
      .then((ok) => (ok ? a.walkTo(TUER_X, this.boden, { tempo: 240 }) : false))
      .then((ok) => {
        if (!ok) {
          this.after(4, fertig);
          return;
        }
        // an der Tür: winkt kurz (kleiner Hüpfer) und geht hinein
        this.ton('common/tuer', 1, { vol: 0.45 });
        this.laeufer.delete(a);
        if (a.destroyed) return;
        a.eventMode = 'none';
        this.tween(a, { alpha: 0, scale: a.scale.x * 0.85 }, 0.7, { ease: 'sineInOut' })
          .then(() => { if (!a.destroyed) a.destroy({ children: true }); });
      });
  }

  // ---------------------------------------------------------------- Ziehen an Zug-Teilen (eigener kleiner Verfolger)

  richteZiehenEin() {
    const ort = (ev) => {
      const g = new Point();
      stage.app.renderer.events.mapPositionToPoint(g, ev.clientX, ev.clientY);
      return this.world.toLocal(g);
    };
    this._zugBewegt = (ev) => {
      const z = this.zuege.get(ev.pointerId);
      if (!z) return;
      const p = ort(ev);
      let fertig = true;
      try { fertig = z.bewegt(p.x - z.x0, p.y - z.y0); } catch (e) { console.error('[bahnhof] Ziehen:', e); }
      if (fertig) this.zuege.delete(ev.pointerId);
    };
    this._zugEnde = (ev) => {
      const z = this.zuege.get(ev.pointerId);
      if (!z) return;
      this.zuege.delete(ev.pointerId);
      try { z.ende(); } catch (e) { console.error('[bahnhof] Ziehen:', e); }
    };
    window.addEventListener('pointermove', this._zugBewegt, { passive: true });
    window.addEventListener('pointerup', this._zugEnde, { passive: true });
    window.addEventListener('pointercancel', this._zugEnde, { passive: true });
  }

  // e = Ereignis aus tap() (x, y in Koordinaten von obj.parent)
  verfolge(obj, e, { bewegt, ende }) {
    if (!obj.parent || e.pointerId === undefined) return;
    const p = this.world.toLocal(obj.parent.toGlobal({ x: e.x, y: e.y }));
    const alt = this.zuege.get(e.pointerId);
    if (alt) alt.ende();
    this.zuege.set(e.pointerId, { x0: p.x, y0: p.y, bewegt, ende });
  }

  exit() {
    this.ablauf?.exit();
    this.gueter?.exit();
    window.removeEventListener('pointermove', this._zugBewegt);
    window.removeEventListener('pointerup', this._zugEnde);
    window.removeEventListener('pointercancel', this._zugEnde);
    this.zuege.clear();
  }

  // ---------------------------------------------------------------- Knöpfe und Leiste

  baueKnoepfe() {
    this.knoepfe = {};
    for (const art of REIHE) {
      this.knoepfe[art] = this.rundKnopf(ARTEN[art].icon, 250, () => this.oeffneLeiste(art));
    }
    // Abfahrts-Knopf: grüne Platte mit der grünen Kelle – „Tipp auf Grün" ist so auch ohne das Wort „Kelle" klar
    this.losKnopf = ui.button('bahnhof/fahne_gruen', { size: 290, farbe: 0x9fe08f, parent: this.hud1, onTap: () => this.abfahren(), sound: null });
    // Pfeil zum Güterbahnhof
    this.pfeilRechts = ui.button('common/icon_pfeil_rechts', {
      size: 220, parent: this.hud1, sound: null, onTap: () => { if (this.modus !== 'faehrt') this.zeigeSeite(1); },
    });
    this.pfeilRechts.label = 'pfeilRechts';
    this.ordneKnoepfe();
  }

  // Runder Knopf aus einem Bild, das schon selbst eine runde Scheibe ist (ohne zweite Platte)
  rundKnopf(id, d, onTap) {
    const k = new Container({ label: 'auswahl:' + id });
    const schatten = new Graphics().ellipse(0, d * 0.46, d * 0.42, d * 0.1).fill({ color: 0x5a4630, alpha: 0.18 });
    const ring = new Graphics().circle(0, 0, d / 2 + 12).stroke({ width: 16, color: 0xffffff, alpha: 0.95 });
    ring.alpha = 0;
    const bild = spr(id, { anchor: 0.5 });
    bild.scale.set(d / Math.max(bild.texture.width, bild.texture.height));
    k.addChild(schatten, ring, bild);
    k.bild = bild;
    k.markiere = (an) => {
      killTweensOf(ring, ['alpha']);
      this.tween(ring, { alpha: an ? 1 : 0 }, 0.5, { ease: 'sineInOut' });
    };
    this.hud1.addChild(k);
    tap(k, () => onTap(), { hitArea: new Circle(0, 0, d / 2 + 20) });
    return k;
  }

  resize() {
    this.ordneKnoepfe();
    this.gueter?.ordne();
    if (!this.gleitet) this.versatz(this.nr);
  }

  ordneKnoepfe() {
    const W = stage.W;
    REIHE.forEach((art, i) => this.knoepfe[art]?.position.set(W / 2 + 280 + (i - 1.5) * 290, 215));
    this.losKnopf?.position.set(W / 2 + 1066 - 190, 560);
    this.pfeilRechts?.position.set(W - 175, PFEIL_Y);
  }

  oeffneLeiste(art) {
    if (this.modus === 'faehrt' || this.nr !== 0 || this.gleitet) return;
    if (this.leisteArt === art) {
      this.schliesseLeiste();
      return;
    }
    this.schliesseLeiste();
    this.leisteArt = art;
    this.knoepfe[art].markiere(true);
    const kopien = new Map();   // Kopie → Startpunkt (zum Erkennen von „nur angetippt")
    const leiste = ui.tray(this, {
      items: ARTEN[art].items,
      versatz: -40,
      onTap: (item, kopie) => {
        leiste.genommen = true;   // das Kind hat schon etwas aus der Leiste genommen (dann kein Hinweis mehr)
        if (!kopie || kopie.destroyed || kopien.has(kopie) || !String(kopie.label || '').startsWith('trayKopie')) return;
        kopien.set(kopie, { x: kopie.x, y: kopie.y });
        kopie.once('destroyed', () => kopien.delete(kopie));
      },
      targets: () => this.leistenZiele(art, kopien),
      onDrop: (item, ziel, kopie, ctx) => this.abgelegt(art, item, ziel, kopie, ctx),
    });
    this.leiste = leiste;
    // Hinweis zur Leiste („Tipp auf eine Lok" …): Muss er hinter einem anderen Satz warten, gilt er nur noch, solange
    // genau diese Leiste offen ist und das Kind seither nichts genommen und nichts am Zug verändert hat
    const stand = this.aenderungen;
    voice(ARTEN[art].stimme, {
      nurWenn: () => this.leiste === leiste && !leiste.genommen && this.aenderungen === stand && this.modus !== 'faehrt',
    });
    // weich von unten hereingleiten
    const c = leiste.container;
    const y = c.y;
    c.y = y + 280;
    c.alpha = 0;
    this.tween(c, { y, alpha: 1 }, 0.45, { ease: 'sineOut' });
  }

  schliesseLeiste() {
    const l = this.leiste;
    if (!l) return;
    if (this.leisteArt) this.knoepfe[this.leisteArt].markiere(false);
    this.leiste = null;
    this.leisteArt = null;
    const c = l.container;
    c.eventMode = 'none';
    killTweensOf(c, ['y', 'alpha']);
    this.tween(c, { y: c.y + 280, alpha: 0 }, 0.35, { ease: 'sineIn' }).then(() => l.off());
  }

  // Ziele beim Ablegen: der Zug (je nach Art Lok oder Wagen) und „nur angetippt" (Kopie liegt noch fast am Start)
  leistenZiele(art, kopien) {
    const liste = [];
    for (const [k, p] of kopien) if (!k.destroyed) liste.push({ id: 'tipp', x: p.x, y: p.y, radius: 110 });
    if (this.modus === 'faehrt') return liste;
    return liste.concat(this.zugZiele(art === 'lok'));
  }

  zugZiele(nurLok = false) {
    const z = this.zug;
    const liste = [{ id: 'lok', obj: z.lok.koerper, radius: 300 }];
    if (!nurLok) for (const w of z.wagen) liste.push({ id: 'wagen', w, obj: w.fahrzeug.koerper, radius: 260 });
    return liste;
  }

  abgelegt(art, item, ziel, kopie, ctx) {
    if (this.modus === 'faehrt') return false;
    const w = ziel.id === 'wagen' ? ziel.w : null;
    let wohin = null;
    if (art === 'lok') wohin = this.lokTauschen(item.id);
    else if (art === 'wagen') wohin = this.wagenDazu(item.id)?.fahrzeug;
    else if (art === 'gast') wohin = this.gastRein(item.id, w);
    else if (art === 'ladung') wohin = this.ladungRein(item.id, w);
    if (!wohin) return false;
    // Die Kopie fliegt weich zum Ziel und verschwindet dort (das Ding selbst erscheint im Zug)
    ctx.behalten();
    kopie.eventMode = 'none';
    const b = (wohin.koerper || wohin).getBounds();
    const p = this.front.toLocal({ x: b.x + b.width / 2, y: b.y + b.height * 0.3 });
    killTweensOf(kopie);
    // (kurz halten: die Kopie ist fort, bevor der Kern ihre – dann winzige – Tippfläche prüft)
    this.tween(kopie, { x: p.x, y: p.y, scale: Math.abs(kopie.scale.y) * 0.55, alpha: 0 }, 0.3, { ease: 'sineInOut' })
      .then(() => { if (!kopie.destroyed) kopie.destroy(); });
    return true;
  }

  // ---------------------------------------------------------------- Abfahrt

  laeuten() {
    fx.wobble(this.glocke, 0.06);
    if (this.ton('common/glocke', 1.2, { vol: 0.7 })) {
      const b = this.glocke;
      fx.burst('noten', b.x + 70, b.y - b.height * 0.75, { count: 1, parent: this.world });
    }
  }

  // Welcher Sticker gibt es für diese Fahrt? Erst die Lok, dann Zoo-Tiere im Zug, dann Glocke und Uhr.
  stickerWahl() {
    const moegliche = new Set(stickerFuerOrt('bahnhof').map((s) => s.id));
    const reihe = [
      this.zug.lok.typ,
      ...this.zug.wagen.map((w) => w.gastId && 'tier_' + w.gastId).filter(Boolean),
      'bahnhof_bahnhofsglocke', 'bahnhof_bahnhofsuhr', ...LOKS,
    ].filter((id) => moegliche.has(id));
    const schon = new Set(store.stickers?.() || []);
    return reihe.find((id) => !schon.has(id)) || this.zug.lok.typ;
  }

  async abfahren() {
    if (this.nr !== 0 || this.gleitet) return;
    if (this.modus !== 'steht') {
      fx.wobble(this.losKnopf, 0.03);
      return;
    }
    // Noch nicht alles vorbereitet: Der erste Tipp zeigt freundlich, was noch fehlt (Schaffner-Denkblase und Hand).
    // Tippt das Kind danach noch einmal auf Grün (mit etwas Abstand, nicht nur Dauertippen, und innerhalb von 12 s),
    // fährt der Zug trotzdem – niemand bleibt hängen. Kommen die Fahrgäste gerade erst, zählt ein Tipp noch nicht.
    const a = this.ablauf;
    if (a && !a.fertig && a.gestartet) {
      const seit = this.t - this.losHinweisZeit;
      if (a.schrittName === 'warten' || seit > 12 || seit < 1.5) {
        fx.wobble(this.losKnopf, 0.03);
        if (a.schrittName === 'warten') {
          a.zeigeAnkunft();
          return;
        }
        if (seit > 12) {
          this.losHinweisZeit = this.t;
          a.zeigeNaechstes();
          const h = a.hinweise()[0];
          if (h) this.after(0.4, () => { if (this.modus === 'steht') ui.hand(h); });
        }
        return;
      }
    }
    this.modus = 'faehrt';
    this.ablauf?.abfahrt();
    this.schliesseLeiste();
    this.losKnopf.markiere(true);
    this.zuege.forEach((z) => z.ende());
    this.zuege.clear();
    this.speichere();
    this.laeuten();
    const z = this.zug;
    const lohn = belohne(this, this.stickerWahl(), clamp(z.x, -600, 600), 760);
    this.after(0.9, () => { z.pfeife(); z.gaesteJubeln(); });
    await this.wait(1.9);
    z.fahre(ABFAHRT_TEMPO);
    sfx('common/zug_fahren', { vol: 0.45 });
    const draussen = new Promise((fertig) => { this.raus = fertig; });
    await Promise.all([lohn, Promise.race([draussen, this.wait(9)])]);
    this.go('fahrt');
  }

  // ---------------------------------------------------------------- Ablauf

  update(dt) {
    const z = this.zug;
    if (this.modus === 'kommt') {
      // weich hereinrollen und genau am Halteplatz anhalten
      const ziel = this.halteX();
      const rest = ziel - z.x;
      const soll = clamp(rest * 1.5, 0, EINFAHRT_TEMPO);
      this.v += (soll - this.v) * (1 - Math.exp(-dt * 2.5));
      if (rest < 1.5 && this.v < 6) {
        this.v = 0;
        z.x = ziel;
        this.modus = 'steht';
        // (kein Pfiff vom Bahnsteig, während das Kind im Güterbahnhof spielt)
        this.after(0.4, () => { if (this.nr === 0) z.pfeife(); });
        this.ablauf?.start();
      }
      z.geschwindigkeit = this.v;
    } else if (this.modus === 'steht') {
      this.rangiere(dt);
    }
    z.update(dt);
    if (this.modus === 'faehrt' && this.raus && z.x - z.laenge / 2 > stage.W / 2 - 250) {
      this.raus();
      this.raus = null;
    }
    this.wolken.update(dt);
    this.uhr.update(dt);
    this.ablauf?.update(dt);
    this.vogel.update(dt);
    this.falter.update(dt);
    if (this.gueter && (this.nr === 1 || this.gleitet)) this.gueter.update(dt);
  }

  hints() {
    if (this.gleitet) return [];
    if (this.nr === 1) {
      // Erst die Schritte des Güterbahnhofs; ab 30 s Ruhe der Pfeil zurück. Während Kran, Lok oder Zug gerade
      // selbst etwas tun (keine Hinweise), zeigt die Hand nicht vorschnell zurück zum Bahnsteig.
      return this.idle >= PFEIL_HINWEIS_AB ? [this.gueter.pfeilLinks] : this.gueter.hinweise();
    }
    if (this.modus !== 'steht') return [];
    if (this.idle >= PFEIL_HINWEIS_AB) return [this.pfeilRechts];
    const z = this.zug;
    const liste = [];
    // Offene Leiste: erst zeigen, wohin ein Ding aus ihr gehört
    if (this.leiste) {
      const h = this.leistenHinweis();
      if (h) liste.push(h);
    }
    // Dann der nächste Schritt der Abfahrts-Vorbereitung (zuletzt die grüne Kelle)
    const schritte = this.ablauf ? this.ablauf.hinweise() : [];
    for (const h of schritte) liste.push(h);
    if (!schritte.length) {
      // (noch) nichts vorzubereiten: wie früher Zug bauen und losfahren
      if (!this.leiste) liste.push(this.knoepfe.gast, this.knoepfe.wagen);
      if ((!this.ablauf || this.ablauf.fertig) && z.wagen.some((w) => w.gast)) liste.push(this.losKnopf);
    }
    // Das Tier im Wartehäuschen erst, wenn kein Schritt der Abfahrts-Vorbereitung offen ist – sonst zeigte jede
    // zweite Hand auf das Häuschen statt auf den nächsten Schritt.
    if ((!schritte.length || this.ablauf?.fertig) && this.wartegastSichtbar()) liste.push(this.wartegast);
    return liste;
  }

  // Zeige-Hand bei offener Leiste: ein Ding, das noch nicht am Zug ist, dorthin, wo es wirklich etwas bewirkt.
  //   Lok → auf die Lok (nur dort ist sie ein Ziel), Wagen → ans Zugende, Gast → in einen freien Sitz-Wagen,
  //   Ladung → auf einen leeren Ladewagen (gibt es keinen passenden Wagen, auf die Lok: dann kommt einer dazu).
  leistenHinweis() {
    const z = this.zug;
    const art = this.leisteArt;
    const dabei = (id) => (art === 'lok' ? z.lok.typ === id
      : art === 'gast' ? this.gastImZug(id)
        : art === 'ladung' ? z.wagen.some((w) => w.ladungId === id) : false);
    let von = null;
    for (const it of ARTEN[art].items) {
      const s = this.leiste.sprite(it.id);
      if (!s || !s.parent || s.parent.alpha <= 0.5 || dabei(it.id)) continue;
      von = s;
      break;
    }
    if (!von) return null;
    let ziel = null;
    if (art === 'wagen') ziel = z.wagen[z.wagen.length - 1];
    else if (art === 'gast') ziel = z.wagen[z.freierPlatz()] || z.wagen.find((w) => w.platz?.art === 'sitz');
    else if (art === 'ladung') {
      ziel = z.wagen.find((w) => WAGEN_MIT_LADUNG.includes(w.typ) && !w.ladung)
        || z.wagen.find((w) => WAGEN_MIT_LADUNG.includes(w.typ));
    }
    return { von, nach: ziel?.fahrzeug.koerper || z.lok.koerper };
  }

  // Gäste eines Wagens freuen sich – bei Dauertippen höchstens alle 0,6 s neu (keine gestapelten Laute).
  // → true, wenn sich dort jemand freut (oder gerade gefreut hat)
  jubeln(index) {
    const k = 'jubel:' + index;
    if (this.t - (this.toene.get(k) ?? -99) < 0.6) return true;
    this.toene.set(k, this.t);
    return this.zug.gaesteJubeln(index);
  }

  // Ton abspielen, aber nicht öfter als alle `pause` Sekunden (gleiche Töne nicht stapeln). → true, wenn gespielt
  ton(id, pause = 0.5, opt) {
    // Töne des Bahnsteigs schweigen, solange der Güterbahnhof zu sehen ist (z. B. die Tür, wenn Fahrgäste kommen)
    if (this.nr === 1) return false;
    const jetzt = this.t;
    if (jetzt - (this.toene.get(id) ?? -99) < pause) return false;
    this.toene.set(id, jetzt);
    sfx(id, opt);
    return true;
  }
}

// Start-Seite: params.seite, sonst – wenn die Szene direkt über die Adresse gestartet wurde – ?seite=n, sonst 0
function startSeite(params) {
  if (params && params.seite !== undefined && params.seite !== null) return Number(params.seite) === 1 ? 1 : 0;
  try {
    const suche = new URLSearchParams(location.search);
    if (suche.get('szene') === 'bahnhof' && suche.get('seite') === '1') return 1;
  } catch { /* ohne Adresse: erste Seite */ }
  return 0;
}
