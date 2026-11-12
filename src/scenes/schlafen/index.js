// Schlafenszeit: das Gute-Nacht-Ritual – sehr ruhig.
//
// Zimmer (schlafen/hg_schlafzimmer):
// - Vier müde Tiere stehen vorn im Zimmer und gähnen ab und zu. Antippen oder zu einem Bett ziehen → das Tier
//   hüpft ins Bett und legt sich hin (Kopf auf dem Kissen). Ein leeres Bett antippen holt das nächste Tier.
// - Decken liegen als Stapel auf dem Teppich: die oberste auf ein liegendes Tier ziehen – oder das liegende Tier
//   antippen – und es wird zugedeckt (leises Schnarchen, ein paar langsame zzz).
// - Spieluhr (auf dem Regal) spielt das Wiegenlied lauter und zeigt Noten; Buch, Kuscheltier, Mobile, Vorhänge,
//   Nachtlicht und Fenster reagieren auch. Draußen ziehen Wölkchen am Abendhimmel.
// - Sind alle zugedeckt, wippt die Lampe als Einladung → antippen: Klick, das Licht wird langsam dunkel (3 s),
//   im Fenster Mond, Sterne und eine Eule, das Nachtlicht leuchtet. „Gute Nacht!" – ein Sticker.
// Danach gleitet das Bild weich zum Ruhe-Bild (ruhe.js). Dort führt im normalen Spiel nach ~6 s ein Sonnen-Knopf
// zurück zur Karte; ist die Spielzeit für heute aufgebraucht, bleibt das Ruhe-Bild (Eltern-Zahnrad unten rechts).
//
// params: {ende: true} – Spielzeit vorbei: zuerst „Sigo ist müde …", kein Karten- und Album-Knopf (der Album-Knopf
//                        erscheint nur kurz, ohne Eingabe, wenn der Gute-Nacht-Sticker hineinfliegt), dafür gleich
//                        das Eltern-Zahnrad unten rechts (falls das Kind protestiert: „Noch 10 Minuten").
//         {ruhe: true} – gleich das Ruhe-Bild (Start an einem Tag, an dem die Spielzeit aufgebraucht ist).
// Testen: ?szene=schlafen&test=1 [&ende=1 | &ruhe=1]

import {
  Scene, stage, spr, tex, hasTex, sfx, music, voice, note, animal, tap, drag, Actor, fx, ui,
  rand, pick, shuffle, clamp, lerp, PIXI, audioState,
} from '../../engine/index.js';
import { setzeHintergrund, hgPunkt } from '../../gemeinsam/seiten.js';
import { belohne, gesammelt } from '../../gemeinsam/sticker.js';
import { spielzeit } from '../../gemeinsam/spielzeit.js';
import { zahnrad } from '../../gemeinsam/eltern.js';
import { Ruhe, glimmen } from './ruhe.js';

const HG = 'schlafen/hg_schlafzimmer';
const HG_B = 2829;                      // Bildpunkte des Hintergrunds
const HG_H = 1600;

// Betten: x aus den Punkten bett1…bett4; sie stehen an der Rückwand (die Punkte liegen ganz vorn am Bildrand,
// dort wäre für die Tiere kein Platz mehr – darum steht die Höhe hier fest)
const BETT_Y = 1150;
const BETT_S = 0.62;                    // 700 → 434 breit
const LIEGE = { dx: 62, dy: -96 };      // wo das schlafende Tier im Bett liegt (Fuß-Anker)
const DECKE = { dx: 116, dy: -38, s: 0.48 };
const KOPF = { dx: -78, dy: -190 };     // ungefähr der Kopf auf dem Kissen (für zzz)

const STEH_Y = 1478;
const STEH_X = [-905, -455, 455, 905];
const TIER_S = 0.34;
const SCHLAF_S = 0.32;
// so weit vom rechten Bildrand bleiben die Tippflächen der Tiere weg: Mitte des Eltern-Zahnrads 200 vom Rand,
// seine Halte-Fläche ein Kreis mit 100 Halbmesser (src/gemeinsam/eltern.js), dazu 20 Luft
const ZAHNRAD_FREI = 320;
const TIERE = ['hase', 'katze', 'hund', 'baer', 'schaf', 'pinguin', 'schwein', 'pferd', 'kuh', 'elefant'];

const STAPEL = ['decke_gruen', 'decke_gelb', 'decke_blau', 'decke_rot'];  // unten → oben
const STAPEL_X = 0;
const STAPEL_Y = 1505;
const STAPEL_S = 0.42;
const STAPEL_HUB = 38;

const NACHT_TINT = 0x56609a;            // so dunkel wird das Zimmer (nie finster)
const PENTATONIK = [72, 74, 76, 79, 81, 84];

// Fensterscheiben im Hintergrund (Bildpunkte): obere Scheiben mit Rundbogen, untere rechteckig
const SCHEIBEN = [
  [990, 362, 990, 300, 1030, 255, 1090, 215, 1160, 180, 1250, 148, 1330, 132, 1398, 128, 1398, 362],
  [1448, 362, 1448, 128, 1520, 132, 1600, 148, 1690, 180, 1760, 220, 1810, 262, 1832, 300, 1832, 362],
  [976, 405, 1398, 405, 1398, 668, 976, 668],
  [1448, 405, 1842, 405, 1842, 668, 1448, 668],
];
const FENSTER_STERNE = [
  [1100, 262, 0.2], [1215, 175, 0.16], [1305, 300, 0.24], [1535, 205, 0.18], [1660, 300, 0.15],
  [1760, 330, 0.2], [1190, 445, 0.17], [1590, 440, 0.2], [1370, 215, 0.14],
];

export default class Schlafen extends Scene {
  static id = 'schlafen';
  static packs = ['schlafen', 'tiere', 'zug'];
  static music = 'musik/nacht';

  async enter(params = {}) {
    this.ende = !!params.ende;
    this.phase = params.ruhe ? 'ruhe' : 'zimmer';
    this.dunkel = false;
    this.bereit = false;
    this.zeit = 0;
    this.spieluhrBis = 0;
    this.mobileSchwung = 0;
    this.lampeSchwung = 0;
    this.letztesSchnarchen = -9;
    this.gesagtDecke = false;
    this.halloZeit = null;          // wann die Begrüßung zu Ende war (bzw. entfiel, weil heute schon gesagt)
    this.halloNochmal = false;      // Begrüßung in diesem Besuch schon wiederholt?
    this.emitter = [];

    // Knöpfe des Kerns: Karte (oben links) und Album (oben rechts) – bei aufgebrauchter Spielzeit unsichtbar.
    // Den Album-Knopf gibt es im Zimmer immer: Er ist das Ziel des Gute-Nacht-Sterns.
    this.kartenKnopf = this.hud.children.find((c) => c.label === 'kartenKnopf') || null;
    if (this.phase === 'zimmer') this.album = ui.albumKnopf(this);
    this.knoepfeAnpassen(true);

    this.baueZimmer();
    this.ruhe = new Ruhe(this);

    if (this.phase === 'ruhe') {
      this.zimmerHinten.visible = false;
      this.raum.visible = false;
      this.fenster.visible = false;
      this.licht.visible = false;
      this.ruhe.zeige(true);
    } else if (this.ende) {
      voice('schlafen_muede', { force: true });
      this.zahnradDa(false);
    } else {
      // Der Auftrag steckt nur in der Begrüßung – und die wiederholt der Kern nie. Darum sagt die Szene ihn selbst
      // noch einmal (einmal je Besuch), wenn das Kind danach 25 s nichts angefangen hat (siehe update()).
      voice('schlafen_hallo').then(() => { if (this.alive) this.halloZeit = this.zeit; });
    }

    // Eltern verlängern oder Spielzeit endet, während man hier ist
    this.abSpielzeit = spielzeit.beiAenderung(() => {
      if (!this.alive) return;
      if (spielzeit.aufgebraucht()) this.zahnradDa(true);
      else this.ende = false;          // „Noch 10 Minuten": Karte und Album sind wieder da
      this.knoepfeAnpassen(false);
      this.ruhe.spielzeitGeaendert();
    });

    // Müde Tiere gähnen ab und zu (immer nur eins)
    this.every(6.5, () => this.gaehnen());
  }

  exit() {
    this.abSpielzeit?.();
    for (const e of this.emitter) e.stop();
    this.spieluhrNoten?.stop();
    this.ruhe?.exit();
  }

  // Karten-/Album-Knopf: im Ruhe-Bild und bei aufgebrauchter Spielzeit weg (weich)
  knoepfeAnpassen(sofort) {
    const zeigen = this.phase === 'zimmer' && !spielzeit.aufgebraucht() && !this.ende;
    for (const k of [this.kartenKnopf, this.album]) {
      if (!k || k.destroyed) continue;
      k.eventMode = zeigen ? 'static' : 'none';
      if (sofort) {
        k.alpha = zeigen ? 1 : 0;
        k.visible = zeigen;
      } else {
        k.visible = true;
        this.tween(k, { alpha: zeigen ? 1 : 0 }, 0.8, { ease: 'sineInOut' })
          .then((ok) => { if (ok && !k.destroyed && !zeigen) k.visible = false; });
      }
    }
  }

  /** Eltern-Zahnrad unten rechts – höchstens eins (Spielzeit-Ende im Zimmer, danach im Ruhe-Bild weiter). */
  zahnradDa(weich) {
    if (this.rad && !this.rad.destroyed) return this.rad;
    this.rad = zahnrad(this);
    if (this.rad && weich) {
      this.rad.alpha = 0;
      this.tween(this.rad, { alpha: 1 }, 1.5, { ease: 'sineInOut', delay: 2 });
    }
    return this.rad;
  }

  // Bildpunkt des Hintergrunds → Szenen-Koordinaten
  bp(px, py) {
    const h = this.hg;
    return { x: h.x + (px - HG_B / 2) * h.scale.x, y: h.y + (py - HG_H / 2) * h.scale.y };
  }

  pt(name, ersatz) {
    return hgPunkt(this.hg, HG, name) || ersatz;
  }

  // ---------------------------------------------------------------- Zimmer

  baueZimmer() {
    this.zimmerHinten = new PIXI.Container({ label: 'zimmerHinten' });
    this.bg.addChild(this.zimmerHinten);
    this.hg = setzeHintergrund(this.zimmerHinten, HG);
    this.hg.label = HG;

    // world: Fenster-Ausblick (untönig, eigene Nacht) < Zimmer (wird dunkel getönt) < Licht (leuchtet)
    this.fenster = new PIXI.Container({ label: 'fenster', sortableChildren: true });
    this.fenster.zIndex = 1;
    this.raum = new PIXI.Container({ label: 'raum', sortableChildren: true });
    this.raum.zIndex = 2;
    this.licht = new PIXI.Container({ label: 'licht' });
    this.licht.zIndex = 3;
    this.licht.eventMode = 'none';
    this.world.addChild(this.fenster, this.raum, this.licht);

    this.baueFenster();
    this.baueDinge();
    this.baueBetten();
    this.baueTiere();
    this.baueStapel();
  }

  baueFenster() {
    const f = this.fenster;
    const maske = new PIXI.Graphics();
    for (const s of SCHEIBEN) {
      const p = [];
      for (let i = 0; i < s.length; i += 2) {
        const q = this.bp(s[i], s[i + 1]);
        p.push(q.x, q.y);
      }
      maske.poly(p).fill(0xffffff);
    }
    f.addChild(maske);
    f.mask = maske;

    // Abendwölkchen ziehen langsam vorbei
    const links = this.bp(976, 0).x;
    const rechts = this.bp(1842, 0).x;
    this.wolkenBahn = [links - 120, rechts + 120];
    this.wolken = [
      { id: 'common/wolke2', y: this.bp(0, 215).y, s: 0.2, v: 7, x: lerp(links, rechts, 0.25) },
      { id: 'common/wolke3', y: this.bp(0, 300).y, s: 0.12, v: 4.5, x: lerp(links, rechts, 0.75) },
      { id: 'common/wolke2', y: this.bp(0, 460).y, s: 0.15, v: 5.5, x: lerp(links, rechts, 0.5) },
    ].map((w) => {
      const s = spr(w.id, { x: w.x, y: w.y, scale: w.s, parent: f, alpha: 0.75 });
      s.tint = 0xe6d8f2;
      s.v = w.v;
      return s;
    });

    // Für die Nacht: Mond, Sterne, Eule (erst unsichtbar)
    const m = this.bp(1705, 255);
    this.fensterMond = spr(hasTex('common/mond') ? 'common/mond' : 'schlafen/schlafmond',
      { x: m.x, y: m.y + 40, scale: 0.17, parent: f, alpha: 0 });
    this.fensterSterne = FENSTER_STERNE.map(([px, py, sk], i) => {
      const q = this.bp(px, py);
      const s = spr('common/stern_himmel', { x: q.x, y: q.y, scale: sk, parent: f, alpha: 0 });
      s.phase = i * 1.7;
      s.periode = rand(3.2, 5.5);
      s.hell = 0;
      s.extra = 0;
      s.ziel = 0;
      return s;
    });
    // die Eule sitzt draußen oben auf der Baumkrone rechts (rechte untere Scheibe, zwischen Hase und Vorhang)
    const e = this.bp(1757, 508);
    this.eule = new Actor('eule', { x: e.x, y: e.y, scale: 0.075, parent: f });
    this.eule.schatten.visible = false;
    this.eule.alpha = 0;
    this.eule.tint = 0xa6b0d8;
  }

  baueDinge() {
    const r = this.raum;
    const fb = this.pt('fensterbank', { x: -4, y: 705 });
    const sims = fb.y - 4;       // hier stehen die Dinge auf der Fensterbank

    // Vorhänge links und rechts am Fenster
    const vl = this.bp(905, 40);
    const vr = this.bp(1925, 40);
    this.vorhaenge = [
      spr('schlafen/vorhang_l', { x: vl.x, y: vl.y, scale: 0.72, parent: r, z: 5 }),
      spr('schlafen/vorhang_l', { x: vr.x, y: vr.y, scale: 0.72, parent: r, z: 5, flip: true }),
    ];
    for (const v of this.vorhaenge) {
      tap(v, () => {
        this.tween(v, { skewX: v.skew.x > 0 ? -0.05 : 0.05 }, 0.5, { ease: 'sineInOut' })
          .then((ok) => { if (ok) this.tween(v, { skewX: 0 }, 1.2, { ease: 'sineInOut' }); });
        sfx('common/rascheln', { vol: 0.35 });
      }, { sound: null, squash: false, pad: 20 });
    }

    // Fenster: antippen → ein Funkeln (abends) bzw. ein Stern leuchtet auf (nachts)
    const fo = this.bp(976, 120);
    const fu = this.bp(1842, 670);
    this.fensterFlaeche = new PIXI.Container({ label: 'fensterFlaeche' });
    this.fensterFlaeche.zIndex = 4;
    this.fensterFlaeche.hitArea = new PIXI.Rectangle(fo.x, fo.y, fu.x - fo.x, fu.y - fo.y);
    r.addChild(this.fensterFlaeche);
    tap(this.fensterFlaeche, (e) => this.fensterTipp(e), { sound: null, squash: false });

    // Auf der Fensterbank: Gute-Nacht-Buch und Kuschelhase
    this.buch = spr('schlafen/buch_gutenacht', { x: fb.x - 190, y: sims, scale: 0.6, parent: r, z: 6 });
    tap(this.buch, () => {
      fx.wobble(this.buch, 0.08);
      sfx('common/wusch', { vol: 0.45 });
      fx.burst('sterne', this.buch.x, this.buch.y - 230, { count: 3, parent: this.front });
    }, { sound: null, pad: 30 });
    this.hase = spr('schlafen/kuscheltier_hase', { x: fb.x + 195, y: sims, scale: 0.6, parent: r, z: 6 });
    tap(this.hase, () => {
      const h = this.hase;
      this.tween(h, { y: sims - 45 }, 0.22, { ease: 'quadOut' })
        .then((ok) => { if (ok) this.tween(h, { y: sims }, 0.3, { ease: 'bounceOut' }); });
      sfx('common/plopp', { vol: 0.6 });
      fx.burst('herzen', h.x, h.y - 230, { count: 3, parent: this.front });
    }, { pad: 30 });

    // Hängelampe mit warmem Schein
    const lp0 = this.pt('lampe', { x: -934, y: 0 });
    const lp = { x: lp0.x + 80, y: lp0.y };   // etwas nach rechts: die Ecke oben links gehört dem Karten-Knopf
    this.lampe = spr('schlafen/lampe_haenge', { x: lp.x, y: lp.y, scale: 0.8, parent: r, z: 7 });
    const birne = hgPunkt(this.lampe, 'schlafen/lampe_haenge', 'birne') || { x: lp.x, y: 310 };
    this.lampenSchein = spr('schlafen/lichtschein_warm', { x: birne.x, y: birne.y, scale: 1.15, parent: this.licht, alpha: 0.42 });
    tap(this.lampe, () => this.lampeTipp(), { sound: null, pad: 40 });

    // Mobile über den Betten
    this.mobile = spr('schlafen/mobile_sterne', { x: 650, y: 0, scale: 0.62, parent: r, z: 7 });
    tap(this.mobile, () => this.mobileTipp(), { sound: null, squash: false, pad: 35 });

    // Spieluhr oben auf dem Regal
    const ro = this.pt('regal_oben', { x: 1056, y: 515 });
    this.spieluhr = spr('schlafen/spieluhr', { x: ro.x - 150, y: ro.y + 6, scale: 0.6, parent: r, z: 6 });
    tap(this.spieluhr, () => this.spieluhrTipp(), { sound: null, pad: 30 });

    // Nachtlicht auf dem Boden links neben dem ersten Bett
    this.nachtlicht = spr('schlafen/nachtlicht', { x: -1110, y: 1195, scale: 0.5, parent: r, z: 9 });
    this.nachtSchein = spr('schlafen/lichtschein_warm',
      { x: this.nachtlicht.x, y: this.nachtlicht.y - 80, scale: 0.42, parent: this.licht, alpha: 0 });
    tap(this.nachtlicht, () => {
      const ziel = this.dunkel ? 0.7 : 0.4;
      const zurueck = this.dunkel ? 0.45 : 0;
      this.tween(this.nachtSchein, { alpha: ziel }, 0.6, { ease: 'sineInOut' })
        .then((ok) => { if (ok) this.tween(this.nachtSchein, { alpha: zurueck }, 1.4, { ease: 'sineInOut' }); });
      note('pling', pick(PENTATONIK) + 12, { vol: 0.3 });
    }, { sound: null, pad: 40 });
  }

  baueBetten() {
    this.betten = [1, 2, 3, 4].map((n, i) => {
      const p = this.pt('bett' + n, { x: [-700, -235, 235, 700][i], y: 1400 });
      const x = p.x;
      const sprite = spr('schlafen/bett', { x, y: BETT_Y, scale: BETT_S, parent: this.raum, z: 10 });
      const bett = { i, x, sprite, tier: null, decke: null, zzz: null };
      // große Tippfläche über dem ganzen Bett
      const zone = new PIXI.Container({ label: 'bettZone' + n });
      zone.zIndex = 40;
      zone.hitArea = new PIXI.Rectangle(x - 200, BETT_Y - 300, 460, 330);
      this.raum.addChild(zone);
      tap(zone, () => this.bettTipp(bett), { sound: null, squash: false });
      bett.zone = zone;
      bett.ziel = { x: x + 50, y: BETT_Y - 150 };
      return bett;
    });
  }

  baueTiere() {
    const arten = shuffle([...TIERE]).slice(0, 4);
    this.tiere = arten.map((art, i) => {
      const x = STEH_X[i] + rand(-25, 25);
      const actor = new Actor(art, { x, y: STEH_Y, scale: TIER_S, parent: this.raum, z: 50, flip: x > 0 });
      const t = { art, actor, zustand: 'steht', bett: null };
      t.ziehen = drag(actor, {
        back: false,
        lift: 1.08,
        targets: () => this.betten.filter((b) => !b.tier).map((b) => ({ ...b.ziel, radius: 290, bett: b })),
        onStart: () => { animal(art); },
        onDrop: (ziel, ctx) => {
          if (t.zustand !== 'steht') return;
          const weg = Math.hypot(ctx.x - ctx.startX, ctx.y - ctx.startY);
          if (ziel) this.insBett(t, ziel.bett);
          else if (weg < 60) this.insBett(t, this.freiesBettNahe(actor.x));
          else ctx.back();
        },
      });
      this.wegVomZahnrad(actor);
      return t;
    });
  }

  /**
   * Unten rechts liegt (bei Spielzeit-Ende gleich, sonst sobald die Spielzeit im Zimmer abläuft) das Eltern-Zahnrad
   * im hud über allem. Ein Tier, dessen Tippfläche dort hineinragt, ließe sich an diesem Stück nicht antippen – das
   * Zahnrad wackelt nur. Darum rückt das Tier so weit nach links, dass seine ganze Tippfläche frei bleibt.
   */
  wegVomZahnrad(actor) {
    const h = actor.hitArea;
    if (!h) return;
    const a = this.world.toLocal(actor.toGlobal({ x: h.x, y: h.y }));
    const b = this.world.toLocal(actor.toGlobal({ x: h.x + h.width, y: h.y + h.height }));
    const rechts = Math.max(a.x, b.x);
    const grenze = stage.W / 2 - ZAHNRAD_FREI;
    if (rechts > grenze) actor.x -= rechts - grenze;
  }

  baueStapel() {
    this.stapel = STAPEL.map((id, i) => {
      const d = spr('schlafen/' + id, {
        x: STAPEL_X + (i % 2 ? 12 : -10), y: STAPEL_Y - i * STAPEL_HUB, scale: STAPEL_S, parent: this.raum, z: 45 + i,
      });
      d.rotation = (i % 2 ? 1 : -1) * 0.025;
      d.deckeId = id;
      return d;
    });
    this.machObersteZiehbar();
  }

  get oberste() {
    return this.stapel[this.stapel.length - 1] || null;
  }

  machObersteZiehbar() {
    const d = this.oberste;
    if (!d || d.ziehen) return;
    const unten = (this.stapel.length - 1) * STAPEL_HUB / STAPEL_S;   // Tippfläche reicht über den ganzen Stapel
    d.ziehen = drag(d, {
      lift: 1.08,
      hitArea: new PIXI.Rectangle(-330, -380, 660, Math.max(560, 420 + unten)),
      targets: () => this.betten.filter((b) => b.tier && b.tier.zustand === 'liegt')
        .map((b) => ({ ...b.ziel, radius: 300, bett: b })),
      onDrop: (ziel, ctx) => {
        if (ziel) {
          ctx.erledigt = true;
          this.zudecken(ziel.bett, d);
          return;
        }
        // nur angetippt: wartet ein liegendes Tier, fliegt die Decke von selbst hinüber
        const weg = Math.hypot(ctx.x - ctx.startX, ctx.y - ctx.startY);
        const wartet = this.betten.find((b) => b.tier && b.tier.zustand === 'liegt');
        if (weg < 60 && wartet) {
          ctx.erledigt = true;
          this.zudecken(wartet, d);
        }
      },
    });
  }

  // ---------------------------------------------------------------- Ablauf

  freiesBettNahe(x) {
    let bestes = null;
    for (const b of this.betten) {
      if (!b.tier && (!bestes || Math.abs(b.x - x) < Math.abs(bestes.x - x))) bestes = b;
    }
    return bestes;
  }

  async insBett(t, bett) {
    if (!bett || t.zustand !== 'steht') return;
    if (bett.tier) bett = this.freiesBettNahe(t.actor.x);
    if (!bett) return;
    t.zustand = 'huepft';
    t.bett = bett;
    bett.tier = t;
    t.ziehen.off();
    const a = t.actor;
    a.zIndex = 30;
    sfx('common/hupf', { vol: 0.55 });
    const x = bett.x + LIEGE.dx;
    const y = BETT_Y + LIEGE.dy;
    this.tween(a, { scale: SCHLAF_S }, 0.75, { ease: 'sineInOut' });
    await a.hopTo(x, y, { hoehe: 150, dauer: 0.75, staub: false });
    if (!this.alive) return;
    a.position.set(x, y);
    a.zIndex = 12;
    a.schatten.visible = false;
    a.pose('sleep');
    a.flip = true;   // Kopf nach links, aufs Kissen
    sfx('common/landen', { vol: 0.45 });
    t.zustand = 'liegt';
    if (!this.gesagtDecke) {
      this.gesagtDecke = true;
      // „Zieh eine Decke über das Tier" – nur, solange noch keins zugedeckt ist und das Kind nicht gerade eine Decke
      // zieht (nurWenn: auch, wenn der Satz erst nach einem anderen an die Reihe kommt)
      const deckeNoch = () => this.alive && this.phase === 'zimmer' && !this.dunkel
        && !this.betten.some((b) => b.tier?.zustand === 'zugedeckt')
        && this.betten.some((b) => b.tier?.zustand === 'liegt')
        && !this.oberste?.ziehen?.isDragging();
      this.after(0.8, () => { if (deckeNoch()) voice('schlafen_decke', { nurWenn: deckeNoch }); });
    }
  }

  async zudecken(bett, d = null) {
    const t = bett.tier;
    if (!t || t.zustand !== 'liegt') return;
    if (!d) {
      d = this.oberste;
      if (!d || d.ziehen?.isDragging()) return;
    }
    const stelle = this.stapel.indexOf(d);
    if (stelle < 0) return;
    this.stapel.splice(stelle, 1);
    d.ziehen?.off();
    d.ziehen = null;
    t.zustand = 'zugedeckt';
    bett.decke = d;
    this.machObersteZiehbar();

    const zx = bett.x + DECKE.dx;
    const zy = BETT_Y + DECKE.dy;
    d.zIndex = 31;
    sfx('common/wusch', { vol: 0.4 });
    // im weichen Bogen hinüber und sanft herabsinken
    const x0 = d.x;
    const y0 = d.y;
    const s0 = d.scale.x;
    const r0 = d.rotation;
    const proxy = { p: 0 };
    const weit = Math.hypot(zx - x0, zy - y0);
    const ok = await this.tween(proxy, { p: 1 }, clamp(weit / 900, 0.45, 0.85), {
      ease: 'sineInOut',
      onUpdate: () => {
        const p = proxy.p;
        d.x = lerp(x0, zx, p);
        d.y = lerp(y0, zy, p) - Math.sin(p * Math.PI) * Math.min(160, weit * 0.25);
        d.scale.set(lerp(s0, DECKE.s, p));
        d.rotation = lerp(r0, 0, p);
      },
    });
    if (!ok && !this.alive) return;
    d.position.set(zx, zy);
    d.scale.set(DECKE.s);
    d.rotation = 0;
    d.zIndex = 14;
    // kleines Einsinken
    this.tween(d, { scaleY: DECKE.s * 0.94 }, 0.12, { ease: 'quadOut' })
      .then((fertig) => { if (fertig) this.tween(d, { scaleY: DECKE.s }, 0.4, { ease: 'backOut' }); });
    d.eventMode = 'none';   // die Bett-Fläche darüber nimmt die Tipper
    this.schnarchen(0.35);
    bett.zzz = fx.emitter('zzz', { x: bett.x + KOPF.dx, y: BETT_Y + KOPF.dy, rate: 0.16, parent: this.front, groesse: 0.8 });
    this.emitter.push(bett.zzz);

    if (this.betten.every((b) => b.tier && b.tier.zustand === 'zugedeckt')) this.after(1.2, () => this.lampeBereit());
  }

  schnarchen(vol = 0.35) {
    if (this.zeit - this.letztesSchnarchen < 1.6) return;
    this.letztesSchnarchen = this.zeit;
    sfx('common/schnarchen', { vol });
  }

  bettTipp(bett) {
    if (this.phase !== 'zimmer') return;
    const t = bett.tier;
    if (!t) {
      // leeres Bett: das nächste stehende Tier kommt
      const wartend = this.tiere.filter((x) => x.zustand === 'steht' && !x.ziehen.isDragging());
      if (wartend.length) {
        wartend.sort((a, b) => Math.abs(a.actor.x - bett.x) - Math.abs(b.actor.x - bett.x));
        this.insBett(wartend[0], bett);
      } else {
        fx.wobble(bett.sprite, 0.05);
        sfx('common/plopp', { vol: 0.4 });
      }
      return;
    }
    if (t.zustand === 'liegt') {
      this.zudecken(bett);
      return;
    }
    if (t.zustand === 'zugedeckt') {
      fx.wobble(bett.decke, 0.04);
      fx.burst('zzz', bett.x + KOPF.dx, BETT_Y + KOPF.dy - 20, { count: 1, parent: this.front });
      this.schnarchen(0.4);
    }
  }

  gaehnen() {
    if (this.phase !== 'zimmer' || this.dunkel) return;
    const kandidaten = this.tiere.filter((t) => t.zustand === 'steht' && !t.ziehen.isDragging());
    if (!kandidaten.length) return;
    const t = pick(kandidaten);
    const k = t.actor.koerper;
    if (k.y !== 0) return;
    this.tween(k, { scaleY: 1.07, scaleX: 0.95 }, 0.9, { ease: 'sineInOut' })
      .then((ok) => { if (ok) this.tween(k, { scaleY: 1, scaleX: 1 }, 1.1, { ease: 'sineInOut' }); });
    const kopf = t.actor.point('kopf');
    fx.burst('zzz', kopf.x + 30, kopf.y + 20, { count: 1, parent: this.front });
  }

  lampeBereit() {
    if (this.bereit || this.dunkel) return;
    this.bereit = true;
    // „Mach das Licht aus" – erst lädt die wippende Lampe selbst ein; der Satz kommt nur, wenn das Kind sie bis
    // dahin nicht angetippt hat (nurWenn: auch, wenn er erst nach einem anderen Satz an die Reihe kommt)
    const lampeNoch = () => this.alive && this.phase === 'zimmer' && this.bereit && !this.dunkel;
    this.after(1.5, () => { if (lampeNoch()) voice('schlafen_lampe', { nurWenn: lampeNoch }); });
  }

  lampeTipp() {
    if (this.phase !== 'zimmer') return;
    if (!this.bereit || this.dunkel) {
      // nur sanft schaukeln
      this.lampeSchwung = Math.min(0.1, this.lampeSchwung + 0.06);
      sfx('common/tipp', { vol: 0.5 });
      return;
    }
    this.lichtAus();
  }

  lichtAus() {
    this.dunkel = true;
    this.bereit = false;
    sfx('common/klick');
    this.lampeSchwung = 0.03;
    this.spieluhrBis = 0;
    // Zimmer wird langsam dunkel (Tönung), Lampenschein geht aus, Nachtlicht und Fenster-Nacht kommen
    const von = [255, 255, 255];
    const nach = [(NACHT_TINT >> 16) & 255, (NACHT_TINT >> 8) & 255, NACHT_TINT & 255];
    const proxy = { p: 0 };
    this.tween(proxy, { p: 1 }, 3, {
      ease: 'sineInOut',
      onUpdate: () => {
        const c = von.map((v, i) => Math.round(lerp(v, nach[i], proxy.p)));
        const farbe = (c[0] << 16) | (c[1] << 8) | c[2];
        this.zimmerHinten.tint = farbe;
        this.raum.tint = farbe;
      },
    });
    this.tween(this.lampenSchein, { alpha: 0 }, 2.5, { ease: 'sineInOut' });
    this.tween(this.nachtSchein, { alpha: 0.45 }, 2.5, { ease: 'sineInOut', delay: 0.8 });
    for (const w of this.wolken) this.tween(w, { alpha: 0 }, 2.5, { ease: 'sineInOut' });
    this.tween(this.fensterMond, { alpha: 1, y: this.fensterMond.y - 40 }, 4, { ease: 'sineInOut', delay: 0.8 });
    this.fensterSterne.forEach((s, i) => {
      const proxyS = { h: 0 };
      this.tween(proxyS, { h: 1 }, 2, { ease: 'sineInOut', delay: 1 + i * 0.25, onUpdate: () => { s.hell = proxyS.h; } });
    });
    this.tween(this.eule, { alpha: 1 }, 2.5, { ease: 'sineInOut', delay: 2.5 });
    if (this.spieluhrNoten) { this.spieluhrNoten.stop(); this.spieluhrNoten = null; }
    music('musik/nacht', { vol: 1 });

    this.after(1.4, () => voice('schlafen_gutenacht', { force: true }));
    this.after(3, () => {
      const id = gesammelt().includes('schlafen_kuschelhase') ? 'schlafen_mond' : 'schlafen_kuschelhase';
      const ort = id === 'schlafen_mond' ? { x: this.fensterMond.x, y: this.fensterMond.y }
        : { x: this.hase.x, y: this.hase.y - 110 };
      // Spielzeit-Ende: der Album-Knopf ist versteckt – für einen neuen Sticker erscheint er kurz (ohne Eingabe),
      // damit der Stern ein Ziel hat, und verschwindet danach wieder
      const a = this.album;
      const kurz = a && !a.destroyed && !a.visible && !gesammelt().includes(id);
      if (kurz) {
        a.visible = true;
        a.eventMode = 'none';
        this.tween(a, { alpha: 1 }, 0.6, { ease: 'sineInOut' });
      }
      belohne(this, id, ort.x, ort.y).then(() => {
        if (kurz && this.alive) this.after(1, () => this.knoepfeAnpassen(false));
      });
    });
    this.after(8, () => this.zurRuhe());
  }

  zurRuhe() {
    if (this.phase === 'ruhe') return;
    this.phase = 'ruhe';
    this.knoepfeAnpassen(false);
    for (const b of this.betten) b.zzz?.stop();
    // Die Zimmer-Wand bleibt deckend liegen, bis das Ruhe-Bild darüber ganz da ist: Blendeten beide zugleich
    // halb durchsichtig über- und ineinander, schiene der helle Grund durch und das Bild würde kurz heller.
    // So mischt sich nur das dunkle Zimmer weich ins Ruhe-Bild – es wird nie heller als eins von beiden.
    const weg = [this.raum, this.fenster, this.licht];
    for (const c of weg) {
      this.tween(c, { alpha: 0 }, 3, { ease: 'sineInOut' })
        .then((ok) => { if (ok) c.visible = false; });
    }
    this.ruhe.zeige(false);
    this.after(3.5, () => { this.zimmerHinten.visible = false; });
  }

  // ---------------------------------------------------------------- kleine Dinge

  fensterTipp(e) {
    if (this.phase !== 'zimmer') return;
    if (this.dunkel) {
      // Eule angetippt?
      if (this.eule.alpha > 0.5 && Math.hypot(e.x - this.eule.x, e.y - (this.eule.y - 40)) < 100) {
        fx.wobble(this.eule, 0.08);
        animal('eule');
        return;
      }
      // der nächste Stern leuchtet kurz heller
      let s = this.fensterSterne[0];
      for (const q of this.fensterSterne) if (Math.hypot(q.x - e.x, q.y - e.y) < Math.hypot(s.x - e.x, s.y - e.y)) s = q;
      s.ziel = 1;
      note('glocke', pick(PENTATONIK) + 12, { vol: 0.22 });
      return;
    }
    fx.burst('funkeln', e.x, e.y, { count: 4, parent: this.front });
    note('pling', pick(PENTATONIK) + 12, { vol: 0.25 });
  }

  mobileTipp() {
    const schon = this.mobileSchwung > 0.06;
    this.mobileSchwung = Math.min(0.14, this.mobileSchwung + 0.08);
    if (schon) {
      note('glocke', pick(PENTATONIK) + 12, { vol: 0.22 });
      return;
    }
    [0, 0.28, 0.56].forEach((d, i) => this.after(d, () => note('glocke', PENTATONIK[2 + i] + 12, { vol: 0.24 })));
  }

  spieluhrTipp() {
    if (this.phase !== 'zimmer') return;
    fx.wobble(this.spieluhr, 0.05);
    const neu = this.spieluhrBis <= this.zeit;
    this.spieluhrBis = this.zeit + 15;
    if (!neu) return;
    note('glocke', 84, { vol: 0.25 });
    music('musik/nacht', { vol: 1.6 });
    const k = hgPunkt(this.spieluhr, 'schlafen/spieluhr', 'karussell') || { x: this.spieluhr.x, y: this.spieluhr.y - 180 };
    this.spieluhrNoten?.stop();
    this.spieluhrNoten = fx.emitter('noten', { x: k.x, y: k.y - 40, rate: 0.6, parent: this.front });
    this.emitter.push(this.spieluhrNoten);
  }

  // ---------------------------------------------------------------- Takt

  update(dt) {
    this.zeit += dt;
    const t = this.zeit;
    if (this.phase === 'zimmer' || this.raum.visible) {
      // Wölkchen im Fenster
      const [a, b] = this.wolkenBahn;
      for (const w of this.wolken) {
        w.x += w.v * dt;
        if (w.x > b) w.x = a;
      }
      // Sterne im Fenster (nachts): langsames, weiches Funkeln
      for (const s of this.fensterSterne) {
        glimmen(s, dt, 0.6);
        const welle = 0.6 + 0.4 * Math.sin((t / s.periode) * Math.PI * 2 + s.phase);
        s.alpha = s.hell * clamp(welle + s.extra * 0.5, 0, 1);
      }
      // Mobile schaukelt sanft, nach einem Tipp etwas mehr
      this.mobileSchwung *= Math.exp(-dt * 0.7);
      this.mobile.rotation = 0.025 * Math.sin((t / 6) * Math.PI * 2) + this.mobileSchwung * Math.sin((t / 1.9) * Math.PI * 2);
      // Lampe: wippt als Einladung, wenn alle zugedeckt sind
      this.lampeSchwung *= Math.exp(-dt * 0.8);
      const einladung = this.bereit ? 0.06 : 0;
      this.lampe.rotation = (einladung + this.lampeSchwung) * Math.sin((t / 2.4) * Math.PI * 2);
      // Spieluhr dreht sich (sanftes Wiegen), solange sie spielt
      const spielt = this.spieluhrBis > t;
      if (this.spieluhrNoten && !spielt) {
        this.spieluhrNoten.stop();
        this.spieluhrNoten = null;
        if (!this.dunkel) music('musik/nacht', { vol: 1 });
      }
      this.spieluhr.rotation = spielt ? 0.035 * Math.sin(t * 2.4) : this.spieluhr.rotation * Math.exp(-dt * 3);
      // Nachtlicht atmet nachts ganz leicht
      if (this.dunkel && this.nachtSchein.alpha > 0.3) {
        this.nachtSchein.scale.set(0.42 * (1 + 0.03 * Math.sin((t / 4) * Math.PI * 2)));
      }
      this.halloWiederholen();
    }
    this.ruhe.update(dt, t);
  }

  // Noch kein Tier im Bett? (alle stehen, keins hängt gerade am Finger)
  nochNichtsBegonnen() {
    return this.alive && this.phase === 'zimmer' && !this.dunkel
      && this.tiere.every((x) => x.zustand === 'steht' && !x.ziehen.isDragging());
  }

  // „Alle sind müde. Bring sie ins Bett!" einmal je Besuch wiederholen: 25 s nach der Begrüßung (bzw. nach dem
  // Betreten, wenn sie heute schon dran war) und 25 s ohne Berührung, solange noch kein Tier im Bett ist –
  // dieselben Zeiten, nach denen der Kern Hinweise wiederholt.
  halloWiederholen() {
    if (this.halloNochmal) return;
    // solange die Begrüßung klingt, zählt die Zeit erst ab ihrem Ende
    if (audioState.satz === 'schlafen_hallo') this.halloZeit = this.zeit;
    if (this.halloZeit === null) return;
    if (this.zeit - this.halloZeit < 25 || this.idle < 25) return;
    this.halloNochmal = true;
    if (!this.nochNichtsBegonnen()) return;
    voice('schlafen_hallo', { force: true, nurWenn: () => this.nochNichtsBegonnen() });
  }

  hints() {
    if (this.phase === 'ruhe') return this.ruhe.hinweise();
    if (this.dunkel) return [];
    if (this.bereit) return [this.lampe];
    const liste = [];
    const d = this.oberste;
    for (const b of this.betten) {
      if (d && b.tier && b.tier.zustand === 'liegt') liste.push({ von: d, nach: b.tier.actor });
    }
    for (const t of this.tiere) {
      if (t.zustand !== 'steht') continue;
      const b = this.freiesBettNahe(t.actor.x);
      if (b) liste.push({ von: t.actor, nach: { x: b.ziel.x, y: b.ziel.y } });
    }
    return liste;
  }
}
