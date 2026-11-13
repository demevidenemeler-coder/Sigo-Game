// Seite 1: Das Konzert der Tier-Band auf der Wiesen-Bühne – eine Kette aus sechs Schritten, jede Runde etwas anders.
//
//   1. Vorhang auf      – an der goldenen Kordel ziehen (Antippen geht auch); der Vorhang rafft sich weich zur Seite.
//   2. Austeilen        – jedes Tier wünscht sich ein Instrument (Denkblase). Die Instrumente liegen vorn im Gras:
//                         hinziehen. Landet eins beim falschen Tier, schüttelt es freundlich den Kopf, und das
//                         Instrument schwebt von selbst zum richtigen – nichts kann schiefgehen.
//   3. Licht an         – mit dem Finger über die Lichterkette streichen; jedes Lämpchen bleibt an. Sind die meisten
//                         an, gehen die übrigen von selbst an, und es wird sanft Abend.
//   4. Einsatz          – Tiere antippen: jedes spielt seine Stimme im gemeinsamen Takt (wie früher). Spielen alle
//                         fünf zwei Durchgänge lang, endet das Stück mit einem Schluss-Akkord, und alle verbeugen sich.
//   5. Applaus          – ein Gast kommt (unten links). Antippen: Applaus, und er wirft einen Blumenstrauß auf die
//                         Bühne. Die Sträuße bleiben liegen (bis zu sechs, über die Besuche hinweg) – es wächst etwas.
//   6. Vorhang zu       – wieder an der Kordel ziehen: der Vorhang schließt sich, Sticker. Hinter dem Vorhang wird für
//                         die nächste Runde umgebaut.
// Danach ist frei spielen erlaubt (Tiere ein/aus, wie früher), bis die Kordel gezogen wird.
//
// Abwechslung je Runde: ein anderes Stück (6 Stücke: Tempo, Takt, Tonart, Lichtfarbe), andere Instrument-Wünsche
// (jedes Tier hat zwei Instrumente zur Wahl), ein anderer Gast (6 Tiere), und jede zweite Runde landet ein kleiner
// Vogel auf der Lichterkette und singt mit. Runde, Stück, Wünsche und Gast sind gemerkt (store 'musik.*'): Nur das
// allererste Konzert ist das vertraute Stück, jeder spätere Besuch macht mit einem anderen weiter. Wer mitten im
// Konzert ins Stickerbuch geht, findet beim Zurückkommen dasselbe Konzert wieder (Musik.rückkehr → rueckweg()).
// Immer da: Lichterkette (klingt), Schmetterling, Wolke, gemalter Vorhang (antippen = alle hören auf).

import { stage, spr, meta, tex, tap, drag, Actor, fx, note, sfx, voice, animal, store, rand, pick, clamp, lerp, PIXI }
  from '../../engine/index.js';
import { Seite } from '../../gemeinsam/seiten.js';
import { belohne } from '../../gemeinsam/sticker.js';
import { Takt } from './takt.js';
import { Klangleiste } from './klangleiste.js';
import { schmetterling, lichtPfuetze, vogel } from './deko.js';
import { LIEDER, KLANG, ANSPIEL, schlussWert } from './bandlieder.js';
import { gemerkt, waehleFrisch, merke } from './abwechslung.js';

const TIER_SKALA = 0.36;
const GRUPPE_SKALA = 1.14;       // Tier + Instrument zusammen etwas größer
const KEGEL_OBEN = 135;          // Spitze des Lichtkegels: an der Lichterkette (das Licht kommt von dort)
const KEGEL_ALPHA = 0.6;         // nicht zu kräftig – fünf Kegel zusammen sollen das Bild nicht milchig machen
const FALTER_HOEHE = 650;        // so hoch flattert der Schmetterling beim Antippen (über die Köpfe der Band)
const FALTER_LUECKEN = [-570, -190, 190, 570];
const LAMPE_AN = 0.6;            // Deckkraft des Scheins einer eingeschalteten Lampe
const LAMPEN_GENUG = 8;          // so viele Lämpchen, dann gehen die übrigen von selbst an
const ABEND = 0.26;              // so dunkel wird der Himmel hinter der Band, wenn das Licht an ist
const VORHANG_ZEIT = 2.2;        // Sekunden zum Öffnen/Schließen des Vorhangs
const REIHE_X = [-640, -320, 0, 320, 640];
const REIHE_Y = 1478;            // die Instrumente liegen vorn im Gras
const REIHE_GROESSE = 200;
const STRAUSS_X = [-570, 570, -190, 190, -950, 950];
const STRAUSS_Y = 1398;          // Vorderkante der Bühne
const GAESTE = ['kuh', 'schaf', 'ente', 'frosch', 'igel', 'eule', 'fuchs', 'pinguin'];
const GAST_X = -830;
const GAST_Y = 1566;
const GAST_SKALA = 0.32;
const Z_VORHANG = 200;           // geschlossener Vorhang: vor der Band
const Z_VORN = 230;              // Gast, Instrumente im Gras, Sträuße, Kordel: vor dem Vorhang
const KORDEL_RAND = 340;         // Abstand der Kordel vom linken Bildrand (Karten-Knopf: Tippfläche bis ≈ 310)
const KORDEL_Y = 340;            // Mitte des Kordel-Bildes (900 hoch): Seil von oben, Quaste ≈ 430…790
const KORDEL_GRIFF = 250;        // Mitte der Quaste unter der Bildmitte (hier zeigt die Hand hin)
const WUNSCH_HALTEN_AB = 4;      // so lange Ruhe, dann bleibt die Wunsch-Blase beim selben Tier (Hand kommt ab 6 s)

// Die Band. Jedes Tier hat eine Rolle im Stück und zwei Instrumente, die es sich wünschen kann.
// ix/iy = Ort des Instruments relativ zu den Füßen (Einheiten), is = Größe, ir = Drehung,
// art = wie das Instrument beim Spielen zuckt.
const MUSIKER = [
  {
    tier: 'baer', platz: 'platz1', rolle: 'rhythmus', optionen: [
      { inst: 'trommel_gross', ix: 18, iy: 36, is: 0.33, ir: 0, art: 'trommel' },
      { inst: 'bongos', ix: 10, iy: 42, is: 0.46, ir: 0, art: 'trommel' },
    ],
  },
  {
    tier: 'katze', platz: 'platz2', rolle: 'begleitung', optionen: [
      { inst: 'gitarre', ix: 34, iy: -40, is: 0.44, ir: -0.95, art: 'zupfen' },
      { inst: 'tamburin', ix: 92, iy: -70, is: 0.36, ir: 0.18, art: 'rasseln' },
    ],
  },
  {
    tier: 'elefant', platz: 'platz3', rolle: 'melodie', optionen: [
      { inst: 'trompete', ix: 118, iy: -178, is: 0.36, ir: -0.32, art: 'blasen' },
      { inst: 'floete', ix: 128, iy: -150, is: 0.42, ir: -1.05, art: 'blasen' },
    ],
  },
  {
    tier: 'hase', platz: 'platz4', rolle: 'bass', optionen: [
      { inst: 'klavier_klein', ix: 0, iy: 44, is: 0.5, ir: 0, art: 'klavier' },
      { inst: 'glockenspiel_glocke', ix: 104, iy: -60, is: 0.4, ir: 0.22, art: 'rasseln' },
    ],
  },
  {
    tier: 'affe', platz: 'platz5', rolle: 'rassel', optionen: [
      { inst: 'rassel', ix: 92, iy: -150, is: 0.34, ir: 0.25, art: 'rasseln' },
      { inst: 'triangel', ix: 104, iy: -96, is: 0.34, ir: 0.08, art: 'rasseln' },
    ],
  },
];

// Umriss der Vorhänge im Bühnenbild (Bildpunkte von hg_buehne 2829×1600), für Ausschnitt und Maske
const VORHANG_LINKS = [
  [0, 0], [445, 0], [425, 100], [385, 200], [335, 300], [285, 400], [235, 500], [175, 560], [158, 610],
  [168, 660], [195, 760], [215, 860], [228, 960], [236, 1060], [232, 1115], [190, 1145], [0, 1160],
];
const VORHANG_RECHTS = VORHANG_LINKS.map(([x, y]) => [2829 - x, y]);

// Lämpchen der Lichterkette (Bildpunkte von hg_buehne) und ihre Töne (C-Dur-Fünftonleiter, aufsteigend)
const LAMPEN = [
  [470, 75], [640, 145], [830, 155], [1000, 120], [1140, 65], [1310, 140],
  [1530, 140], [1690, 75], [1840, 140], [2030, 165], [2200, 145], [2370, 75],
];
const LAMPEN_TOENE = [67, 69, 72, 74, 76, 79, 81, 84, 86, 88, 91, 93];
// Landeplätze des Vogels (Bildpunkte von hg_buehne): auf dem Seil an den zwei tiefsten Stellen der Lichterkette,
// jeweils links neben einem Lämpchen (Füße bei y ≈ 146, der ganze Vogel ist zu sehen)
const VOGEL_PLAETZE = [[790, 146], [1930, 146]];
const VOGEL_SKALA = 1.15;

// Ruhe-Regel für Flüge: Mit sineInOut ist die Spitze π/2-mal so schnell wie der Schnitt. Die Dauer wird so
// gewählt, dass auch die Spitze höchstens FLUG_SPITZE Einheiten/s erreicht (bogen = Höhe eines Bogens obendrauf).
const FLUG_SPITZE = 1000;
function flugZeit(dx, dy, { bogen = 0, mindestens = 0.6 } = {}) {
  const weg = Math.hypot(Math.hypot(dx, dy), 2 * bogen);
  return Math.max(mindestens, (weg * Math.PI) / 2 / FLUG_SPITZE);
}

export class Band extends Seite {
  static hg = 'musik/hg_buehne';

  aufbau() {
    this.texturen = [];
    this.phase = 'zu';
    // Über die Besuche hinweg gemerkt (auch nach dem Stickerbuch, das den Ort neu aufbaut): wie viele Konzerte
    // schon begonnen haben, das letzte Stück, die letzten Wünsche und der letzte Gast. Nur das allererste Konzert
    // ist das vertraute Stück, danach geht die Abwechslung bei jedem Besuch weiter.
    this.runde = clamp(Math.floor(Number(store.get('musik.runde', 0)) || 0), 0, 99999);
    this.liedZuletzt = gemerkt('musik.lieder', LIEDER.map((l) => l.id));
    this.gastZuletzt = gemerkt('musik.gaeste', GAESTE);
    this.lied = null;
    const alteWahl = String(store.get('musik.wahl', ''));
    this.letzteWahl = /^[01]{5}$/.test(alteWahl) ? alteWahl : '';
    this.zusammen = 0;          // Schritte, in denen alle fünf zusammen spielen (für das Ende des Stücks)
    this.freudeGezeigt = false; // freies Spielen: kleiner Freude-Moment, wenn alle fünf spielen
    this.wunschUhr = 0;
    this.wunschZeiger = 0;
    this.wunschJetzt = null;
    this.vorhangTipps = 0;
    this.gast = null;
    this.vogelDa = null;

    this.musiker = MUSIKER.map((m, i) => this.baueMusiker(m, i));
    this.baueVorhaenge();
    this.baueAbend();
    this.baueSchmetterling();
    this.baueWolke();
    this.baueLampen();
    this.baueReihe();
    this.baueStraeusse();
    this.baueVorhangZu();
    this.baueKordel();
    // Zurück aus dem Stickerbuch mitten im Konzert: dasselbe Stück mit denselben Wünschen geht weiter
    const fort = this.gueltigerStand(this.szene.params?.konzert);
    if (fort) this.runde = Math.max(0, this.runde - 1);   // dasselbe Konzert, keine neue Runde
    this.neueRunde(fort);
    if (fort) this.fortsetzen(fort);
  }

  // ---------------------------------------------------------------- Stand (für den Rückweg aus dem Stickerbuch)

  /** Jetziger Stand des Konzerts für scene.rückkehr() – null, solange der Vorhang zu ist. */
  rueckweg() {
    if (!this.lied || ['zu', 'oeffnet', 'schliesst'].includes(this.phase)) return null;
    return {
      lied: this.lied.id,
      wahl: this.letzteWahl,
      da: this.musiker.filter((m) => m.hatInst).map((m) => m.i),
      licht: !!this.lichtFertig,
    };
  }

  gueltigerStand(k) {
    if (!k || typeof k !== 'object') return null;
    const lied = LIEDER.find((l) => l.id === k.lied);
    if (!lied || !/^[01]{5}$/.test(String(k.wahl))) return null;
    const da = Array.isArray(k.da) ? k.da.filter((i) => Number.isInteger(i) && i >= 0 && i < MUSIKER.length) : [];
    return { lied, wahl: String(k.wahl), da, licht: !!k.licht };
  }

  // Konzert ohne Umwege wieder herstellen: Vorhang offen, gelieferte Instrumente bei den Tieren, die übrigen im
  // Gras; war das Licht schon an, ist es wieder Abend, und die Tiere warten auf ihren Einsatz.
  fortsetzen(k) {
    this.vorhangLage(0);
    for (const m of this.musiker) {
      if (!k.da.includes(m.i)) continue;
      const item = this.reihe.get(m.wunsch);
      item.geliefert = true;
      m.hatInst = true;
      m.inst = m.insts[m.optIdx];
      m.inst.visible = true;
      m.inst.alpha = 1;
    }
    for (const item of this.reihe.values()) {
      if (!item.dabei || item.geliefert) continue;
      item.c.visible = true;
      item.c.alpha = 1;
      item.c.y = item.heimY;
      item.c.eventMode = 'static';
    }
    if (!this.musiker.every((m) => m.hatInst)) {
      this.phase = 'austeilen';
      this.wunschUhr = 0.6;
      this.wunschZeiger = 0;
      return;
    }
    if (!k.licht) {
      this.phase = 'licht';
      return;
    }
    this.lichtFertig = true;
    for (const l of this.lampen) {
      l.an = true;
      l.schein.alpha = LAMPE_AN;
    }
    this.abend.alpha = 1;
    this.phase = 'einsatz';
    this.tierHier = false;
  }

  // ---------------------------------------------------------------- Aufbau

  baueMusiker(def, i) {
    const p = this.punkt(def.platz, { x: -760 + i * 380, y: 1260 });

    // Lichtkegel und Lichtpfütze (hinter dem Tier)
    const kegel = spr('musik/scheinwerfer_schein', { x: p.x, y: KEGEL_OBEN, parent: this.welt, z: 2 });
    kegel.scale.set(0.62, (p.y + 30 - KEGEL_OBEN) / 866);
    kegel.alpha = 0;
    kegel.eventMode = 'none';
    const pfuetze = lichtPfuetze(185, 46, 0.26);
    pfuetze.position.set(p.x, p.y + 6);
    pfuetze.zIndex = 3;
    pfuetze.alpha = 0;
    this.welt.addChild(pfuetze);
    // Warmer Schein direkt hinter dem Tier: zeigt deutlich, wer spielt
    const aura = new PIXI.Graphics();
    for (let k = 0; k < 5; k++) {
      const f = 1 - k * 0.16;
      aura.ellipse(0, -205, 215 * f, 255 * f).fill({ color: 0xffffff, alpha: 0.09 });
    }
    aura.position.set(p.x, p.y);
    aura.zIndex = 4;
    aura.alpha = 0;
    aura.eventMode = 'none';
    this.welt.addChild(aura);

    // Gruppe: Tier + Instrument (wippt gemeinsam, Drehpunkt an den Füßen)
    const gruppe = new PIXI.Container({ label: 'musiker:' + def.tier });
    gruppe.position.set(p.x, p.y);
    gruppe.scale.set(GRUPPE_SKALA);
    gruppe.zIndex = 10 + i;
    gruppe.sortableChildren = true;
    this.welt.addChild(gruppe);
    const tier = new Actor(def.tier, { x: 0, y: 0, scale: TIER_SKALA, parent: gruppe, z: 1 });
    // beide möglichen Instrumente liegen bereit (unsichtbar, bis das Tier eins bekommt)
    const insts = def.optionen.map((o) => {
      const s = spr('musik/' + o.inst, { x: o.ix, y: o.iy, parent: gruppe, z: 2 });
      s.scale.set(o.is);
      s.rotation = o.ir;
      s.visible = false;
      s.alpha = 0;
      s.eventMode = 'none';
      return s;
    });

    const m = {
      def, i, p, kegel, pfuetze, aura, gruppe, tier, insts,
      optIdx: 0, opt: def.optionen[0], inst: null, wunsch: def.optionen[0].inst, hatInst: false,
      an: false, licht: 0, anschlag: 0, bow: 0, zaehler: 0,
    };
    // Große Tippfläche: Tier und Instrument zusammen (≈ 320 × 470)
    tap(gruppe, () => this.musikerTipp(m), {
      sound: null,
      squash: false,
      hitArea: new PIXI.Rectangle(-160, -380, 320, 450),
    });
    return m;
  }

  // Gemalte Vorhänge: Ausschnitt aus dem Hintergrund mit Umriss-Maske – schwingt beim Antippen sanft.
  baueVorhaenge() {
    const hg = this.hg;
    const m = meta(this.hgId);
    const sx = hg.texture.width / (m.w || hg.texture.width); // Bildpunkte des fertigen Bildes → Textur
    this.vorhaenge = [
      this.baueVorhang(VORHANG_LINKS, 0, 460, +1, sx),
      this.baueVorhang(VORHANG_RECHTS, 2829 - 460, 460, -1, sx),
    ];
  }

  baueVorhang(umriss, bx, bw, richtung, sx) {
    const hg = this.hg;
    const frame = new PIXI.Rectangle(bx * sx, 0, bw * sx, 1170 * sx);
    const textur = new PIXI.Texture({ source: hg.texture.source, frame });
    this.texturen.push(textur);
    const oben = this.bildPunkt(bx, 0);
    const c = new PIXI.Container({ label: richtung > 0 ? 'vorhangLinks' : 'vorhangRechts' });
    c.position.set(oben.x, oben.y);
    c.scale.set(hg.scale.x * sx);
    c.zIndex = -900;
    const bild = new PIXI.Sprite(textur);
    bild.scale.set(1 / sx);
    const maske = new PIXI.Graphics().poly(umriss.map(([x, y]) => [x - bx, y]).flat()).fill(0xffffff);
    c.addChild(bild, maske);
    bild.mask = maske;
    this.hinten.addChild(c);

    // Tippfläche: der Streifen am Rand (oben nicht in der Ecke des Karten-/Album-Knopfs)
    const ziel = new PIXI.Container({ label: c.label + ':tipp' });
    ziel.zIndex = 5;
    this.welt.addChild(ziel);
    const kante = this.bildPunkt(richtung > 0 ? 330 : 2829 - 330, 0).x;
    const x0 = richtung > 0 ? -1500 : kante - 90;
    const x1 = richtung > 0 ? kante + 90 : 1500;
    tap(ziel, () => this.vorhangTipp(c, richtung), {
      sound: null,
      squash: false,
      hitArea: new PIXI.Rectangle(x0, 280, x1 - x0, 1150 - 280),
    });
    return { c, ziel, richtung };
  }

  // Bildpunkt des Hintergrunds (fertiges Bild) → Seiten-Koordinaten
  bildPunkt(px, py) {
    const hg = this.hg;
    const m = meta(this.hgId);
    const w = m.w || hg.texture.width;
    const h = m.h || hg.texture.height;
    const t = hg.texture;
    const lx = (px / w - hg.anchor.x) * t.width;
    const ly = (py / h - hg.anchor.y) * t.height;
    return { x: hg.x + lx * hg.scale.x, y: hg.y + ly * hg.scale.y };
  }

  // Abend: eine leichte blaue Tönung über dem gemalten Himmel (die Band davor bleibt hell)
  baueAbend() {
    const g = new PIXI.Graphics().rect(-2200, 0, 4400, 1600).fill({ color: 0x2b2457, alpha: ABEND });
    g.zIndex = -940;
    g.alpha = 0;
    g.eventMode = 'none';
    this.hinten.addChild(g);
    this.abend = g;
  }

  baueSchmetterling() {
    const s = schmetterling(0xffa94d, 0xffe08a);
    s.c.zIndex = 50;
    s.c.scale.set(1.15);
    this.vorn.addChild(s.c);
    this.falter = { ...s, t: rand(0, 20), weg: 0, wegZiel: 0, lueckeX: 0 };
    tap(s.c, () => {
      const f = this.falter;
      if (f.wegZiel === 0 && f.weg < 0.2) {
        let beste = FALTER_LUECKEN[0];
        for (const x of FALTER_LUECKEN) if (Math.abs(x - s.c.x) < Math.abs(beste - s.c.x)) beste = x;
        f.lueckeX = beste;
      }
      f.wegZiel = 1;
      note('glocke', pick([84, 88, 91]), { vol: 0.25 });
      f.zurueck?.kill?.();
      f.zurueck = this.after(2.2, () => { f.wegZiel = 0; });
    }, { sound: null, squash: false, hitArea: new PIXI.Circle(0, 0, 110) });
  }

  baueWolke() {
    const w = spr('common/wolke3', { x: -900, y: 300, parent: this.hinten, z: -950 });
    w.scale.set(0.19);
    w.alpha = 0;
    this.wolke = { s: w, x: -950 };
    tap(w, () => {
      fx.wobble(w, 0.06);
      note('glocke', 79, { vol: 0.22 });
    }, { sound: null, squash: true, pad: 70 });
  }

  // Die Lichterkette oben: jedes Lämpchen ist ein Feld einer Klangleiste (antippen oder darüberstreichen,
  // jeder Finger zählt). Im Schritt „Licht an" bleibt jedes berührte Lämpchen an.
  baueLampen() {
    this.lampen = LAMPEN.map(([px, py], i) => {
      const p = this.bildPunkt(px, py);
      const schein = new PIXI.Graphics();
      for (let k = 0; k < 5; k++) schein.circle(0, 0, 34 + k * 16).fill({ color: 0xffffff, alpha: 0.18 });
      schein.position.set(p.x, p.y);
      schein.alpha = 0;
      schein.zIndex = 1;
      schein.eventMode = 'none';
      this.welt.addChild(schein);
      return { x: p.x, y: p.y, schein, ton: LAMPEN_TOENE[i], zuletzt: -1, an: false };
    });
    const flaeche = new PIXI.Container({ label: 'lichterkette' });
    flaeche.zIndex = 4;
    this.welt.addChild(flaeche);
    const L = this.lampen;
    const felder = L.map((l, i) => ({
      x0: i === 0 ? l.x - 70 : (L[i - 1].x + l.x) / 2,
      x1: i === L.length - 1 ? l.x + 70 : (l.x + L[i + 1].x) / 2,
    }));
    this.lampenLeiste = new Klangleiste(flaeche, {
      felder, y0: 72, y1: 300, rand: 0,
      onSpiel: (i) => this.lampeTipp(i),
      darf: () => this.aktiv && !['zu', 'oeffnet', 'schliesst'].includes(this.phase),
    });
  }

  lampeTipp(i) {
    const l = this.lampen[i];
    const t = this.szene.t;
    if (t - l.zuletzt < 0.2) return;
    l.zuletzt = t;
    note('glocke', l.ton, { vol: 0.28 });
    if (this.phase === 'licht' && !l.an) {
      l.an = true;
      this.tween(l.schein, { alpha: LAMPE_AN }, 0.5, { ease: 'sineInOut' });
      this.lichtGezaehlt();
      return;
    }
    if (l.an) {
      // brennt schon: kurz etwas heller, dann wieder wie vorher
      this.tween(l.schein, { alpha: 1 }, 0.5, { ease: 'sineInOut' })
        .then((ok) => ok && this.tween(l.schein, { alpha: l.an ? LAMPE_AN : 0 }, 1.0, { ease: 'sineInOut' }));
      return;
    }
    // weich auf (0,5 s), dann langsam wieder aus (1,4 s)
    this.tween(l.schein, { alpha: 1 }, 0.5, { ease: 'sineInOut' })
      .then((ok) => ok && this.tween(l.schein, { alpha: l.an ? LAMPE_AN : 0 }, 1.4, { ease: 'sineInOut' }));
  }

  // Die Instrumente im Gras vor der Bühne (je Instrument ein Ding; jede Runde liegen die fünf gewünschten da)
  baueReihe() {
    this.reihe = new Map();
    const namen = new Set(MUSIKER.flatMap((d) => d.optionen.map((o) => o.inst)));
    for (const inst of namen) {
      const c = new PIXI.Container({ label: 'reihe:' + inst });
      c.zIndex = Z_VORN;
      const mm = meta('musik/' + inst);
      const s = REIHE_GROESSE / Math.max(mm.w || 1, mm.h || 1);
      c.addChild(new PIXI.Graphics().ellipse(0, (mm.h || 200) * s * 0.5 - 4, 92, 18)
        .fill({ color: 0x3d5a1a, alpha: 0.2 }));
      const bild = spr('musik/' + inst, { anchor: 0.5, parent: c });
      bild.scale.set(s);
      c.visible = false;
      c.alpha = 0;
      this.welt.addChild(c);
      const item = { inst, c, bild, geliefert: false, heimX: 0, heimY: REIHE_Y };
      item.zug = drag(c, {
        hitArea: new PIXI.Circle(0, 0, 135),
        heim: () => ({ x: item.heimX, y: item.heimY }),
        // Jedes Tier ist ein Ziel – auch eins, das schon spielt: dann schwebt das Instrument zum richtigen
        targets: () => this.musiker.map((m) => ({ x: m.p.x, y: m.p.y - 220, radius: 260, m })),
        onDrop: (z, ctx) => this.ablegen(item, z, ctx),
      });
      c.eventMode = 'none';
      this.reihe.set(inst, item);
    }
  }

  // Blumensträuße auf der Vorderkante der Bühne (bleiben über die Besuche hinweg liegen, bis zu sechs)
  baueStraeusse() {
    this.straeusse = new Array(STRAUSS_X.length).fill(null);
    this.straussZahl = clamp(Number(store.get('musik.straeusse', 0)) || 0, 0, 999);
    const n = Math.min(this.straussZahl, STRAUSS_X.length);
    for (let k = 0; k < n; k++) this.legeStrauss(k, STRAUSS_X[k], STRAUSS_Y, rand(-0.12, 0.12));
  }

  legeStrauss(slot, x, y, rot) {
    const s = spr('musik/strauss', { x, y, parent: this.welt, z: Z_VORN - 5 });
    s.scale.set(0.52);
    s.rotation = rot;
    const ton = [79, 84, 81, 76, 72, 88][slot];
    tap(s, () => {
      fx.wobble(s, 0.06);
      note('glocke', ton, { vol: 0.22 });
    }, { sound: null, squash: true, hitArea: new PIXI.Circle(0, -160, 210) });
    this.straeusse[slot] = s;
    return s;
  }

  // Der geschlossene Vorhang: zwei Bahnen von den Rändern bis zur Mitte. Öffnen = zur Seite raffen und ausblenden.
  baueVorhangZu() {
    const c = new PIXI.Container({ label: 'vorhangZu' });
    c.zIndex = Z_VORHANG;
    c.sortableChildren = true;
    this.welt.addChild(c);
    const links = spr('musik/vorhang_zu', { anchor: [0, 0], parent: c });
    const rechts = spr('musik/vorhang_zu', { anchor: [0, 0], parent: c });
    links.zIndex = 2;    // die linke Bahn liegt in der Mitte über der rechten
    this.vorhangZu = { c, links, rechts, k: 1 };
    tap(c, () => this.vorhangZuTipp(), { sound: null, squash: false, hitArea: new PIXI.Rectangle(-1600, 0, 3200, 1420) });
    this.vorhangLage(1);
  }

  // k = 1 geschlossen … 0 offen
  vorhangLage(k) {
    const v = this.vorhangZu;
    v.k = k;
    const W = stage.W;
    const t = tex('musik/vorhang_zu');
    const breit = (W / 2 + 90) / t.width;   // die Bahnen überlappen sich in der Mitte (Bild hat Rand)
    const hoch = 1430 / t.height;
    const faktor = 0.14 + 0.86 * k;
    for (const [s, r] of [[v.links, 1], [v.rechts, -1]]) {
      s.position.set(-r * (W / 2 + 20), -18);
      s.scale.set(r * breit * faktor, hoch);
      s.alpha = clamp(k / 0.16, 0, 1);
    }
    v.c.visible = k > 0.001;
    v.c.eventMode = k > 0.5 ? 'static' : 'none';
  }

  // Die goldene Kordel am linken Vorhang: herunterziehen (oder antippen) öffnet bzw. schließt den Vorhang
  baueKordel() {
    const c = new PIXI.Container({ label: 'kordel' });
    c.zIndex = Z_VORN;
    this.welt.addChild(c);
    const s = spr('musik/kordel', { anchor: 0.5, parent: c });
    s.scale.set(1);
    this.kordel = c;
    this.kordelBild = s;
    this.ordneKordel();
    drag(c, {
      hitArea: new PIXI.Rectangle(-150, 90, 300, 400),
      heim: () => ({ x: this.kx, y: this.ky }),
      lift: 1,
      sound: null,
      onMove: () => {
        c.x = this.kx;
        c.y = clamp(c.y, this.ky - 20, this.ky + 170);
        if (c.y > this.ky + 110) this.kordelZug();
      },
      onDrop: () => this.kordelZug(),
    });
  }

  // Die Kordel hängt rechts neben der Ecke des Karten-Knopfs (die Ecke 0…310 × 0…310 bleibt frei): Seil bei
  // x ≈ 340 vom linken Rand, die Quaste (Tippfläche) bei y ≈ 430…830.
  ordneKordel() {
    this.kx = -stage.W / 2 + KORDEL_RAND;
    this.ky = KORDEL_Y;
    this.kordel.position.set(this.kx, this.ky);
  }

  kordelZug() {
    const t = this.szene.t;
    if (t - (this.letzterZug ?? -9) < 0.9) return;
    this.letzterZug = t;
    note('glocke', 84, { vol: 0.2 });
    if (this.phase === 'zu') this.oeffnen();
    else if (this.phase === 'frei') this.schliessen();
    else fx.wobble(this.kordelBild, 0.05);
  }

  vorhangZuTipp() {
    if (this.phase !== 'zu') return;
    sfx('common/wusch', { vol: 0.3 });
    fx.wobble(this.kordelBild, 0.06);
    const v = this.vorhangZu;
    for (const [s, r] of [[v.links, 1], [v.rechts, -1]]) {
      this.tween(s, { skewY: 0.012 * r }, 0.4, { ease: 'sineInOut' })
        .then((ok) => ok && this.tween(s, { skewY: 0 }, 0.8, { ease: 'sineInOut' }));
    }
    // Wer nur auf den Vorhang tippt, kommt auch weiter: beim zweiten Mal geht er auf
    if (++this.vorhangTipps >= 2) this.oeffnen();
  }

  // ---------------------------------------------------------------- Runde

  // Für die nächste Runde umbauen (hinter dem geschlossenen Vorhang): Stück, Wünsche, Instrumente zurück ins Gras
  // fort = gemerkter Stand (zurück aus dem Stickerbuch): dann dasselbe Stück mit denselben Wünschen
  neueRunde(fort = null) {
    // Das allererste Stück ist das vertraute (wie früher), danach keins der letzten drei (auch über Besuche hinweg)
    const erstes = !fort && this.runde === 0 && !this.liedZuletzt.length;
    this.lied = fort ? fort.lied : erstes ? LIEDER[0] : waehleFrisch(LIEDER, this.liedZuletzt, 3, (l) => l.id);
    if (!fort) this.liedZuletzt = merke('musik.lieder', this.liedZuletzt, this.lied.id);
    this.takt = new Takt({ bpm: this.lied.bpm, schritteProSchlag: 2, laenge: this.lied.laenge });
    this.takt.onSchritt = (i) => this.schritt(i);
    this.zusammen = 0;
    this.freudeGezeigt = false;
    this.vorhangTipps = 0;
    this.lichtFertig = false;
    this.vogelGeplant = this.runde % 2 === 1;

    // Wünsche: die erste Runde wie früher (Trommel, Ukulele, Trompete, Klavier, Rasseln), dann gemischt
    let wahl = fort ? fort.wahl : '00000';
    if (!erstes && !fort) {
      do {
        wahl = this.musiker.map(() => (Math.random() < 0.5 ? '0' : '1')).join('');
      } while (wahl === this.letzteWahl);
    }
    this.letzteWahl = wahl;
    store.set('musik.runde', this.runde + 1);
    store.set('musik.wahl', wahl);
    const farbe = this.lied.farbe;
    this.musiker.forEach((m, k) => {
      m.optIdx = Number(wahl[k]);
      m.opt = m.def.optionen[m.optIdx];
      m.wunsch = m.opt.inst;
      m.hatInst = false;
      m.an = false;
      m.inst = null;
      m.anschlag = 0;
      for (const s of m.insts) {
        s.visible = false;
        s.alpha = 0;
      }
      m.kegel.tint = farbe;
      m.aura.tint = farbe;
      m.pfuetze.tint = farbe;
    });
    for (const l of this.lampen) {
      l.an = false;
      l.schein.alpha = 0;
      l.schein.tint = farbe;
    }
    // Instrumente: die fünf gewünschten bekommen gemischte Plätze im Gras
    const plaetze = [...REIHE_X].sort(() => Math.random() - 0.5);
    for (const item of this.reihe.values()) {
      item.c.visible = false;
      item.c.alpha = 0;
      item.c.scale.set(1);
      item.c.eventMode = 'none';
      item.geliefert = false;
      item.dabei = false;
    }
    this.musiker.forEach((m, k) => {
      const item = this.reihe.get(m.wunsch);
      item.dabei = true;
      item.heimX = plaetze[k];
      item.heimY = REIHE_Y;
      item.c.position.set(plaetze[k], REIHE_Y + 30);
    });
    this.phase = 'zu';
  }

  oeffnen() {
    if (this.phase !== 'zu') return;
    this.phase = 'oeffnet';
    sfx('common/wusch', { vol: 0.45 });
    const p = { k: this.vorhangZu.k };
    this.tween(p, { k: 0 }, VORHANG_ZEIT, { ease: 'sineInOut', onUpdate: () => this.vorhangLage(p.k) }).then(() => {
      this.vorhangLage(0);
      this.phase = 'austeilen';
      this.wunschUhr = 0.6;
      this.wunschZeiger = 0;
      // die Instrumente erscheinen nacheinander im Gras
      let k = 0;
      for (const item of this.reihe.values()) {
        if (!item.dabei) continue;
        item.c.visible = true;
        this.tween(item.c, { alpha: 1, y: item.heimY }, 0.6, { ease: 'sineOut', delay: 0.2 * k++ })
          .then(() => { if (!item.geliefert) item.c.eventMode = 'static'; });
      }
      this.after(1.6, () => voice('musik_austeilen', { nurWenn: () => this.aktiv && this.phase === 'austeilen' }));
    });
  }

  // Instrument losgelassen
  ablegen(item, z, ctx) {
    if (!z) {
      // nur angetippt: das Instrument klingt kurz
      if (Math.hypot(ctx.x - ctx.startX, ctx.y - ctx.startY) < 40) {
        ANSPIEL[item.inst]();
        fx.wobble(item.bild, 0.08);
      }
      return;
    }
    const richtig = z.m.wunsch === item.inst && !z.m.hatInst
      ? z.m
      : this.musiker.find((m) => !m.hatInst && m.wunsch === item.inst);
    if (!richtig || item.geliefert) {
      ctx.back();
      return;
    }
    item.geliefert = true;
    item.c.eventMode = 'none';
    item.c.zIndex = Z_VORN + 5;
    if (richtig === z.m) {
      this.gib(richtig, item);
      return;
    }
    // Falsches Tier: es schüttelt freundlich den Kopf, das Instrument schwebt zum richtigen
    z.m.tier.shake();
    sfx('common/nein', { vol: 0.3 });
    const zx = richtig.p.x;
    const zy = richtig.p.y - 220;
    this.tween(item.c, { x: zx, y: zy }, flugZeit(zx - item.c.x, zy - item.c.y), { ease: 'sineInOut', delay: 0.3 })
      .then(() => this.gib(richtig, item));
  }

  // Das Tier bekommt sein Instrument
  gib(m, item) {
    this.tween(item.c, { alpha: 0, scale: 0.7 }, 0.35, { ease: 'sineInOut' })
      .then(() => { item.c.visible = false; });
    m.hatInst = true;
    m.inst = m.insts[m.optIdx];
    m.inst.visible = true;
    m.inst.alpha = 0;
    this.tween(m.inst, { alpha: 1 }, 0.4, { ease: 'sineInOut' });
    m.anschlag = 1;
    m.tier.nod();
    ANSPIEL[m.opt.inst]();
    this.burst('noten', m.p.x + 40, m.p.y - 430, { count: 1 });
    if (this.musiker.every((x) => x.hatInst) && this.phase === 'austeilen') {
      this.phase = 'licht_bald';
      this.after(1.2, () => {
        this.phase = 'licht';
        voice('musik_lichter', { nurWenn: () => this.aktiv && this.phase === 'licht' });
      });
    }
  }

  // Genug Lämpchen an: die übrigen gehen nacheinander an, es wird sanft Abend, dann dürfen die Tiere spielen
  lichtGezaehlt() {
    if (this.lichtFertig) return;
    const an = this.lampen.filter((l) => l.an).length;
    if (an < LAMPEN_GENUG) return;
    this.lichtFertig = true;
    let k = 0;
    for (const l of this.lampen) {
      if (l.an) continue;
      l.an = true;
      this.tween(l.schein, { alpha: LAMPE_AN }, 0.6, { ease: 'sineInOut', delay: 0.25 * k++ });
    }
    this.tween(this.abend, { alpha: 1 }, 2.5, { ease: 'sineInOut' });
    // Überraschung in den Runden ohne Vogel (nicht im allerersten Konzert): der Abendstern geht auf
    if (!this.vogelGeplant && this.runde > 0) this.after(2.2, () => this.sternKommt());
    this.after(1.6, () => {
      this.phase = 'einsatz';
      this.tierHier = false;
      voice('musik_band', { nurWenn: () => this.aktiv && this.phase === 'einsatz' && this.spielende() === 0 });
    });
  }

  musikerTipp(m) {
    this.tierHier = true;
    if ((this.phase === 'einsatz' || this.phase === 'frei') && m.hatInst) {
      this.umschalten(m);
      return;
    }
    if (!m.hatInst) {
      // noch ohne Instrument: nickt und zeigt seinen Wunsch
      m.tier.nod();
      if (this.phase === 'austeilen') this.zeigeWunsch(m);
      else m.tier.sound();
      return;
    }
    // hat sein Instrument, das Stück läuft aber noch nicht: ein Ton zum Ausprobieren
    m.anschlag = 1;
    m.tier.nod();
    ANSPIEL[m.opt.inst]();
  }

  zeigeWunsch(m, sek = 2.6) {
    this.wunschJetzt = m;
    m.tier.bubble('musik/' + m.wunsch, sek, { seite: m.i === 4 ? 'links' : 'rechts' });
    const item = this.reihe.get(m.wunsch);
    if (item && !item.geliefert) fx.pulse(item.bild);
  }

  // Der Reihe nach zeigt ein wartendes Tier seinen Wunsch (immer nur eine Blase, ruhig)
  naechsterWunsch() {
    const warten = this.musiker.filter((m) => !m.hatInst);
    if (!warten.length) return;
    this.zeigeWunsch(warten[this.wunschZeiger++ % warten.length]);
  }

  // ---------------------------------------------------------------- Seiten-Ablauf

  betreten() {
    if (this.musiker.some((m) => m.an)) this.takt.reset();
    if (this.besuche === 1) voice('musik_hallo');
    this.tierHier = false;
    this._hinweis?.kill();
    this._hinweis = this.after(this.besuche === 1 ? 4.5 : 2.5, () => this.sagHinweis());
  }

  // Den Satz zum jetzigen Schritt anbieten (der Kern sagt jeden höchstens einmal am Tag)
  sagHinweis() {
    if (!this.aktiv) return;
    const satz = {
      zu: 'musik_kordel', austeilen: 'musik_austeilen', licht: 'musik_lichter', einsatz: 'musik_band',
      frei: 'musik_kordel',
    }[this.phase];
    if (!satz) return;
    const phase = this.phase;
    const passt = () => this.aktiv && this.phase === phase && (phase !== 'einsatz' || !this.tierHier);
    voice(satz, { nurWenn: passt });
  }

  verlassen() {
    this._hinweis?.kill();
    this._hinweis = null;
    this.lampenLeiste.loslassen();
  }

  /** Aufräumen beim Verlassen der Szene (Fenster-Listener der Lichterkette, eigene Ausschnitt-Texturen) */
  aufraeumen() {
    this.lampenLeiste?.abbauen();
    for (const t of this.texturen) t.destroy(false);
    this.texturen.length = 0;
  }

  update(dt, t) {
    this.takt.update(dt);
    const schlag = this.takt.schlag;
    const phase = schlag - Math.floor(schlag);
    const tief = 0.5 + 0.5 * Math.cos(phase * Math.PI * 2);   // 1 genau auf dem Schlag, weich dazwischen
    const weichLicht = 1 - Math.exp(-dt * 2.2);                 // ≈ 1,5 s bis ganz hell/dunkel
    const weichAnschlag = Math.exp(-dt * 9);

    for (const m of this.musiker) {
      m.licht += ((m.an ? 1 : 0) - m.licht) * weichLicht;
      m.kegel.alpha = KEGEL_ALPHA * m.licht;
      m.pfuetze.alpha = m.licht;
      m.aura.alpha = m.licht;
      const a = m.licht;
      const g = m.gruppe;
      // Verbeugung: etwas kleiner und breiter (wie ein Nicken mit dem ganzen Körper)
      g.scale.y = GRUPPE_SKALA * (1 - 0.024 * a * tief) * (1 - 0.1 * m.bow);
      g.scale.x = GRUPPE_SKALA * (1 + 0.01 * a * tief) * (1 + 0.03 * m.bow);
      g.rotation = 0.028 * a * Math.sin(schlag * Math.PI + m.i);
      this.instrumentZucken(m);
      m.anschlag *= weichAnschlag;
    }
    // Beim Austeilen fliegt der Schmetterling über die Instrumente im Gras – dann lässt er sich nicht antippen,
    // damit er keinem Finger das Instrument wegschnappt
    // Beim Austeilen und während der Gast da ist, fängt der Schmetterling keine Finger ab (er kann sich auf den Gast setzen)
    const falterDurch = this.phase === 'austeilen' || this.phase === 'gast' || this.phase === 'applaus';
    this.falter.c.eventMode = falterDurch ? 'none' : 'static';
    if (this.phase === 'austeilen') {
      this.wunschUhr -= dt;
      if (this.wunschUhr <= 0) {
        // Ruht das Kind (bald kommt die Zeige-Hand), wechselt die Blase nicht mehr zum nächsten Tier: Hand und
        // Denkblase zeigen dann dasselbe Tier mit demselben Instrument (die Hand nimmt wunschJetzt).
        const m = this.wunschJetzt;
        if (this.szene.idle >= WUNSCH_HALTEN_AB && m && !m.hatInst) {
          this.wunschUhr = 5.5;
          this.zeigeWunsch(m, 6);
        } else {
          this.wunschUhr = 3.6;
          this.naechsterWunsch();
        }
      }
    }
    this.flattern(dt, t);
    this.ziehen(dt);
    this.vogelLeben(dt, t);
  }

  // Instrument reagiert sichtbar auf seine Töne (ohne Tweens, aus dem abklingenden Anschlag)
  instrumentZucken(m) {
    const inst = m.inst;
    if (!inst) return;
    const k = m.anschlag;
    const s = m.opt.is;
    const r = m.opt.ir;
    switch (m.opt.art) {
      case 'trommel':
        inst.scale.set(s * (1 + 0.04 * k), s * (1 - 0.06 * k));
        break;
      case 'zupfen':
        inst.rotation = r + 0.06 * k;
        break;
      case 'blasen':
        inst.scale.set(s * (1 + 0.06 * k));
        inst.rotation = r - 0.05 * k;
        break;
      case 'klavier':
        inst.scale.set(s * (1 + 0.02 * k), s * (1 - 0.03 * k));
        break;
      case 'rasseln':
        inst.rotation = r + 0.14 * k;
        break;
      default:
    }
  }

  flattern(dt, t) {
    const f = this.falter;
    f.t += dt;
    f.weg += (f.wegZiel - f.weg) * (1 - Math.exp(-dt * 2.5));
    const frei = 760 * Math.sin(f.t * 0.06) + 90 * Math.sin(f.t * 0.37);
    const seitlich = Math.min(1, f.weg * 2.2);
    const x = frei + (f.lueckeX + 40 * Math.sin(f.t * 0.8) - frei) * seitlich;
    const y = 1420 + 30 * Math.sin(f.t * 0.29) - FALTER_HOEHE * f.weg;
    f.c.position.set(x, y);
    f.c.rotation = 0.12 * Math.cos(f.t * 0.06) + 0.05 * Math.sin(f.t * 0.9);
    const schlag = 0.35 + 0.65 * Math.abs(Math.sin(f.t * (5 + 3 * f.weg)));
    f.links.scale.x = schlag;
    f.rechts.scale.x = schlag;
  }

  ziehen(dt) {
    const w = this.wolke;
    w.x += 9 * dt;
    if (w.x > 760) w.x = -950;
    w.s.x = w.x;
    const rand = Math.min(w.x + 950, 760 - w.x);
    w.s.alpha = 0.92 * Math.min(1, Math.max(0, rand / 160));
  }

  // ---------------------------------------------------------------- Musik

  spielende() {
    return this.musiker.filter((m) => m.an).length;
  }

  musterWert(m, i) {
    const w = this.lied[m.def.rolle]?.[i];
    return w === undefined ? null : w;
  }

  schritt(i) {
    const L = this.lied.laenge;
    const alle = this.spielende() === this.musiker.length;
    // Zwei Durchgänge mit allen fünf: das Stück endet mit dem Schluss-Akkord (statt Schritt 0)
    if (alle && i === 0 && this.phase === 'einsatz' && this.zusammen >= 2 * L) {
      this.finale();
      return;
    }
    if (alle) this.zusammen++;
    for (const m of this.musiker) {
      if (!m.an) continue;
      const w = this.musterWert(m, i);
      if (w === null) continue;
      if (KLANG[m.opt.inst](w, m.zaehler++)) m.anschlag = 1;
    }
    // Ab und zu steigt eine einzelne Note auf (höchstens eine pro Takt)
    if (i % (L / 2) === L / 4) {
      const spielen = this.musiker.filter((m) => m.an);
      if (spielen.length && Math.random() < 0.7) {
        const m = pick(spielen);
        this.burst('noten', m.p.x + rand(-40, 40), m.p.y - 360, { count: 1 });
      }
    }
    // Überraschung (jede zweite Runde): spielen drei, kommt ein kleiner Vogel und singt mit
    if (this.vogelGeplant && !this.vogelDa && this.phase === 'einsatz' && this.spielende() >= 3) this.vogelKommt();
    if (this.vogelDa?.sitzt && i === 0 && Math.random() < 0.5) this.vogelSingt(false);
    // Freies Spielen: spielen alle fünf, ein kleiner Freude-Moment auf dem nächsten Schlag
    if (this.phase === 'frei' && alle && !this.freudeGezeigt && i % 2 === 0) {
      this.freudeGezeigt = true;
      this.musiker.forEach((m, k) => this.after(0.15 * k, () => { if (m.an) m.tier.nod(); }));
      this.burst('herzen', 0, 640, { count: 3 });
    }
  }

  /**
   * Tier ein-/ausschalten. Sofort: Instrument zuckt, Tier nickt, ein leiser Ton (ein: ein Ton des eigenen
   * Instruments; aus: ein kleiner absteigender Ton, beim Vorhang übergibt der Aufrufer den Ton).
   */
  umschalten(m, { ausTon = null } = {}) {
    const vorher = this.spielende();
    m.an = !m.an;
    const erster = m.an && vorher === 0;
    if (erster) this.takt.reset(); // erster Einsatz: der Takt beginnt genau jetzt (Schritt 0 im nächsten Bild)
    m.anschlag = 1;
    m.tier.nod();
    if (m.an) {
      // Beim allerersten Einsatz spielt Schritt 0 gleich selbst – nur ergänzen, wenn dort nichts steht
      if (!(erster && this.musterWert(m, 0) !== null)) ANSPIEL[m.opt.inst]();
    } else if (ausTon !== null) {
      note('pling', ausTon, { vol: 0.2 });
    } else {
      note('pling', 67, { vol: 0.2 });
      this.after(0.13, () => note('pling', 60, { vol: 0.17 }));
    }
    if (this.spielende() < this.musiker.length) {
      this.zusammen = 0;
      this.freudeGezeigt = false;
    }
  }

  // Ende des Stücks: Schluss-Akkord, alle hören auf, Lob, Verbeugung, dann kommt ein Gast
  finale() {
    this.phase = 'finale';
    for (const m of this.musiker) {
      const w = schlussWert(this.lied, m.def.rolle);
      if (w !== null) KLANG[m.opt.inst](w, 0);
      m.anschlag = 1;
      m.an = false;
    }
    this.burst('herzen', 0, 620, { count: 5 });
    this.after(1.0, () => voice('musik_alle', { nurWenn: () => this.aktiv }));
    this.musiker.forEach((m, k) => {
      this.after(1.5 + 0.35 * k, () => {
        this.tween(m, { bow: 1 }, 0.5, { ease: 'sineInOut' })
          .then((ok) => ok && this.after(0.5, () => this.tween(m, { bow: 0 }, 0.6, { ease: 'sineInOut' })));
      });
    });
    this.after(3.0, () => this.gastKommt());
  }

  gastKommt() {
    // ein anderer Gast als bei den letzten drei Konzerten (auch über Besuche hinweg)
    const name = waehleFrisch(GAESTE, this.gastZuletzt, 3);
    this.gastZuletzt = merke('musik.gaeste', this.gastZuletzt, name);
    this.letzterGast = name;
    const g = new Actor(name, { x: -stage.W / 2 - 250, y: GAST_Y, scale: GAST_SKALA, parent: this.welt });
    g.zIndex = Z_VORN + 10;
    this.gast = g;
    this.phase = 'gast';
    g.onTap(() => this.gastTipp(g));
    voice('musik_besuch', { nurWenn: () => this.aktiv && this.gast === g && this.phase === 'gast' });
    g.walkTo(GAST_X, GAST_Y, { tempo: 240 }).then(() => {
      if (g.destroyed || this.gast !== g) return;
      if (this.phase === 'gast') this.phase = 'applaus';
      g.sound();
      if (this.phase === 'applaus') g.bubble('musik/strauss', 3.5, { seite: 'rechts' });
    });
  }

  // Gast angetippt: Applaus, ein Blumenstrauß fliegt auf die Bühne, die Band freut sich
  gastTipp(g) {
    g.cheer({ parent: this.vorn });
    if (this.phase !== 'gast' && this.phase !== 'applaus') return;
    this.phase = 'frei';
    sfx('common/applaus', { vol: 0.45 });
    this.wirfStrauss(g);
    this.musiker.forEach((m, k) => {
      this.after(0.5 + 0.2 * k, () => {
        m.tier.pose('happy');
        this.after(1.6, () => { if (!m.tier.destroyed) m.tier.pose('idle'); });
      });
    });
    this.after(4, () => {
      if (this.phase === 'frei') voice('musik_kordel', { nurWenn: () => this.aktiv && this.phase === 'frei' });
    });
  }

  wirfStrauss(g) {
    const slot = this.straussZahl % STRAUSS_X.length;
    const alt = this.straeusse[slot];
    if (alt && !alt.destroyed) {
      alt.eventMode = 'none';
      this.tween(alt, { alpha: 0 }, 0.6, { ease: 'sineInOut' }).then(() => { if (!alt.destroyed) alt.destroy(); });
    }
    this.straussZahl++;
    store.set('musik.straeusse', this.straussZahl);
    const zx = STRAUSS_X[slot];
    const zy = STRAUSS_Y;
    const rot = rand(-0.12, 0.12);
    const s = this.legeStrauss(slot, g.x + 40, g.y - 150, -0.5);
    s.eventMode = 'none';
    const x0 = s.x;
    const y0 = s.y;
    const p = { k: 0 };
    // Im weichen Bogen (gemächlich, auch an der schnellsten Stelle höchstens ≈ 1000 Einheiten/s)
    this.tween(p, { k: 1 }, flugZeit(zx - x0, zy - y0, { bogen: 320, mindestens: 1.4 }), {
      ease: 'sineInOut',
      delay: 0.3,
      onUpdate: () => {
        s.x = lerp(x0, zx, p.k);
        s.y = lerp(y0, zy, p.k) - 320 * Math.sin(Math.PI * p.k);
        s.rotation = lerp(-0.5, rot, p.k);
      },
    }).then(() => {
      if (s.destroyed) return;
      s.eventMode = 'static';
      sfx('common/landen', { vol: 0.35 });
      fx.pop(s, 0.08);
      this.burst('funkeln', zx, zy - 80, { count: 4 });
    });
  }

  schliessen() {
    if (this.phase !== 'frei') return;
    this.phase = 'schliesst';
    for (const m of this.musiker) m.an = false;
    sfx('common/wusch', { vol: 0.45 });
    const p = { k: this.vorhangZu.k };
    this.vorhangLage(p.k);
    this.tween(p, { k: 1 }, VORHANG_ZEIT, { ease: 'sineInOut', onUpdate: () => this.vorhangLage(p.k) }).then(() => {
      this.vorhangLage(1);
      this.tween(this.abend, { alpha: 0 }, 1.5, { ease: 'sineInOut' });
      belohne(this, 'musik_trompete', 0, 640);
      // Der Gast winkt (hüpft) und geht; der Vogel fliegt davon
      const g = this.gast;
      this.gast = null;
      if (g && !g.destroyed) {
        this.after(1.2, () => {
          if (g.destroyed) return;
          g.walkTo(-stage.W / 2 - 300, GAST_Y, { tempo: 240 }).then(() => { if (!g.destroyed) g.destroy(); });
        });
      }
      this.vogelGeht();
      this.sternGeht();
      this.runde++;
      this.neueRunde();
    });
  }

  // ---------------------------------------------------------------- Vogel (Überraschung)

  // Der Vogel landet an einer der zwei tiefsten Stellen der Lichterkette (neben Lämpchen 2 bzw. 9, wo das Seil
  // durchhängt) – so ist er ganz zu sehen. Seine Tippfläche reicht weit nach unten (über das Lämpchen), damit
  // kleine Finger ihn unterhalb des oberen Randes treffen.
  vogelKommt() {
    const v = vogel();
    v.c.scale.set(VOGEL_SKALA);
    v.c.zIndex = 6;
    this.welt.addChild(v.c);
    const [px, py] = pick(VOGEL_PLAETZE);
    const ziel = this.bildPunkt(px, py);
    const zx = ziel.x;
    const zy = ziel.y;
    const x0 = stage.W / 2 + 120;
    const y0 = 160;
    v.c.position.set(x0, y0);
    const d = { ...v, sitzt: false, singen: 0, x: zx, y: zy };
    this.vogelDa = d;
    const p = { k: 0 };
    this.tween(p, { k: 1 }, flugZeit(zx - x0, zy - y0, { bogen: 90, mindestens: 2.6 }), {
      ease: 'sineInOut',
      onUpdate: () => {
        v.c.x = lerp(x0, zx, p.k);
        v.c.y = lerp(y0, zy, p.k) - 90 * Math.sin(Math.PI * p.k);
      },
    }).then((ok) => {
      if (!ok || v.c.destroyed) return;
      d.sitzt = true;
      this.vogelSingt(true);
    });
    // Fläche in Vogel-Einheiten: 280 breit (≈ 300 auf der Bühne), vom Kopf bis weit unter das Lämpchen
    tap(v.c, () => this.vogelSingt(true), {
      sound: null, squash: false, hitArea: new PIXI.Rectangle(-140, -120, 280, 300),
    });
  }

  vogelSingt(laut) {
    const d = this.vogelDa;
    if (!d || !d.sitzt) return;
    d.singen = 1;
    if (laut) animal('vogel');
    else note('glocke', pick([84, 88, 91]), { vol: 0.12 });
    this.tween(d.koerper, { y: -30 }, 0.18, { ease: 'quadOut' })
      .then((ok) => ok && this.tween(d.koerper, { y: -6 }, 0.28, { ease: 'bounceOut' }));
  }

  vogelLeben(dt, t) {
    const st = this.stern;
    if (st && !st.s.destroyed) st.s.scale.set(0.9 + 0.04 * Math.sin(t * 1.6));
    const d = this.vogelDa;
    if (!d || d.c.destroyed) return;
    d.koerper.rotation = 0.04 * Math.sin(t * 1.3) + 0.08 * d.singen * Math.sin(t * 6);
    d.schnabel.scale.y = 1 + 0.6 * d.singen;
    d.singen *= Math.exp(-dt * 2.5);
  }

  vogelGeht() {
    const d = this.vogelDa;
    this.vogelDa = null;
    if (!d || d.c.destroyed) return;
    d.sitzt = false;
    d.c.eventMode = 'none';
    const x0 = d.c.x;
    const y0 = d.c.y;
    const x1 = -stage.W / 2 - 150;
    const y1 = 120;
    const p = { k: 0 };
    this.tween(p, { k: 1 }, flugZeit(x1 - x0, y1 - y0, { bogen: 60, mindestens: 2.4 }), {
      ease: 'sineInOut',
      onUpdate: () => {
        d.c.x = lerp(x0, x1, p.k);
        d.c.y = lerp(y0, y1, p.k) - 60 * Math.sin(Math.PI * p.k);
      },
    }).then(() => { if (!d.c.destroyed) d.c.destroy({ children: true }); });
  }

  // ---------------------------------------------------------------- Abendstern (Überraschung ohne Vogel)

  // Ein Stern blendet weich am Abendhimmel ein (1,5 s), atmet langsam und klingt beim Antippen wie ein Glöckchen.
  sternKommt() {
    if (this.stern) return;
    const [px, py] = pick([[1300, 250], [1620, 300], [1060, 300]]);
    const p = this.bildPunkt(px, py);
    const s = spr('common/stern_himmel', { anchor: 0.5, x: p.x, y: p.y, parent: this.welt, z: 5 });
    s.scale.set(0.9);
    s.alpha = 0;
    this.stern = { s, t: 0, zuletzt: -9 };
    this.tween(s, { alpha: 1 }, 1.5, { ease: 'sineInOut' });
    tap(s, () => {
      const st = this.stern;
      const t = this.szene.t;
      fx.wobble(s, 0.08);
      if (!st || t - st.zuletzt < 0.8) return;
      st.zuletzt = t;
      [84, 88, 91].forEach((m, k) => this.after(0.15 * k, () => note('glocke', m, { vol: 0.18 })));
      this.burst('funkeln', s.x, s.y, { count: 4 });
    }, { sound: null, squash: false, hitArea: new PIXI.Circle(0, 0, 135) });
  }

  sternGeht() {
    const st = this.stern;
    this.stern = null;
    if (!st || st.s.destroyed) return;
    st.s.eventMode = 'none';
    this.tween(st.s, { alpha: 0 }, 1.2, { ease: 'sineInOut' }).then(() => { if (!st.s.destroyed) st.s.destroy(); });
  }

  // Alle hören nacheinander weich auf (von außen nach innen, im Abstand eines halben Schlags)
  vorhangTipp(c, richtung) {
    sfx('common/wusch', { vol: 0.4 });
    this.schwinge(c, richtung);
    const spielen = this.musiker.filter((m) => m.an);
    if (!spielen.length) {
      this.musiker.forEach((m, k) => this.after(0.12 * k, () => m.tier.nod()));
      return;
    }
    const reihe = richtung > 0 ? spielen : [...spielen].reverse();
    const toene = [72, 69, 67, 64, 60];
    reihe.forEach((m, k) => {
      this.after(0.36 * k, () => {
        if (m.an) this.umschalten(m, { ausTon: toene[k] });
      });
    });
  }

  schwinge(c, richtung) {
    const a = 0.032 * richtung;
    this.tween(c, { skewX: a }, 0.4, { ease: 'sineOut' })
      .then((ok) => ok && this.tween(c, { skewX: a * 0.25 }, 0.7, { ease: 'sineInOut' }))
      .then((ok) => ok && this.tween(c, { skewX: a * 0.6 }, 0.6, { ease: 'sineInOut' }))
      .then((ok) => ok && this.tween(c, { skewX: 0 }, 0.9, { ease: 'sineInOut' }));
  }

  // ---------------------------------------------------------------- Zeige-Hand

  // Ein unsichtbarer Punkt als Anfang einer Zieh-Hand: Der Kern zeigt eine Ziehbewegung nur, wenn ihr Anfang ein
  // sichtbares Ding ist (ein bloßes {x, y} fällt bei ihm durch). Jeder Ablauf-Schritt hat seinen eigenen Punkt.
  handPunkt(name, x, y) {
    this.handPunkte ??= {};
    let g = this.handPunkte[name];
    if (!g || g.destroyed) {
      g = new PIXI.Graphics().rect(-3, -3, 6, 6).fill({ color: 0xffffff, alpha: 0.001 });
      g.eventMode = 'none';
      g.label = 'handPunkt:' + name;
      this.welt.addChild(g);
      this.handPunkte[name] = g;
    }
    g.position.set(x, y);
    return g;
  }

  // Die Hand zeigt immer den nächsten Schritt der Kette.
  hinweise() {
    switch (this.phase) {
      case 'zu':
      case 'frei': {
        // An der Quaste nach unten ziehen (nicht auf die Mitte des ganzen Kordel-Bildes: die läge oben am Seil)
        const y = this.ky + KORDEL_GRIFF;
        return [{ von: this.handPunkt('kordel', this.kx, y), nach: { x: this.kx, y: y + 170 } }];
      }
      case 'austeilen': {
        const warten = this.musiker.filter((m) => !m.hatInst);
        const m = this.wunschJetzt && !this.wunschJetzt.hatInst ? this.wunschJetzt : warten[0];
        const item = m && this.reihe.get(m.wunsch);
        if (!item || item.geliefert) return [this.falter.c];
        return [{ von: item.bild, nach: { x: m.p.x, y: m.p.y - 250 } }];
      }
      case 'licht': {
        const L = this.lampen;
        const aus = L.findIndex((l) => !l.an);
        const a = L[Math.max(0, Math.min(aus, L.length - 4))];
        const b = L[Math.min(L.length - 1, Math.max(aus, 0) + 5)];
        return [{ von: this.handPunkt('licht', a.x, a.y + 50), nach: { x: b.x, y: b.y + 50 } }];
      }
      case 'einsatz': {
        const still = this.musiker.filter((m) => !m.an).slice(0, 2).map((m) => m.gruppe);
        return still.length ? still : [this.falter.c];
      }
      case 'gast':
      case 'applaus':
        return this.gast && !this.gast.destroyed ? [this.gast] : [];
      default:
        // Übergänge (Vorhang gleitet, Schluss-Akkord): der Schmetterling ist immer harmlos zum Antippen
        return [this.falter.c];
    }
  }

  resize() {
    this.vorhangLage(this.vorhangZu.k);
    this.ordneKordel();
  }
}
