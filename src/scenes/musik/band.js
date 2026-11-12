// Seite 1: Die Tier-Band auf der Wiesen-Bühne.
//
// Fünf Tiere stehen an platz1…platz5 mit ihrem Instrument. Antippen schaltet ein Tier ein/aus: Sofort erklingt ein
// leiser Ton seines Instruments (beim Ausschalten ein kleiner absteigender Ton), dann spielt es ein kurzes Muster
// (2 Takte) im gemeinsamen Takt (84 Schläge/Minute), wippt mit, und ein warmer Lichtkegel von der Lichterkette
// blendet weich über ihm ein. Ab und zu steigt eine einzelne Note auf. Spielen alle fünf: auf dem nächsten
// Schlag (höchstens 0,7 s später) leiser Applaus und ein Sticker.
// Antippen des Vorhangs (links oder rechts) lässt alle nacheinander weich verstummen.
// Die Lämpchen der Lichterkette klingen einzeln (antippen oder darüberstreichen, jeder Finger zählt).
//
// Harmonie: Takt 1 C-Dur, Takt 2 F-Dur; alle Stimmen aus C-Dur (Melodie fast nur Fünftonleiter) – jedes
// Zusammenspiel klingt.

import { spr, meta, tap, Actor, fx, note, sfx, voice, rand, pick, PIXI } from '../../engine/index.js';
import { Seite } from '../../gemeinsam/seiten.js';
import { belohne } from '../../gemeinsam/sticker.js';
import { Takt } from './takt.js';
import { Klangleiste } from './klangleiste.js';
import { schmetterling, lichtPfuetze } from './deko.js';

const TIER_SKALA = 0.36;
const GRUPPE_SKALA = 1.14;       // Tier + Instrument zusammen etwas größer
const KEGEL_OBEN = 135;          // Spitze des Lichtkegels: an der Lichterkette (das Licht kommt von dort)
const KEGEL_ALPHA = 0.6;        // nicht zu kräftig – fünf Kegel zusammen sollen das Bild nicht milchig machen
const APPLAUS_ABSTAND = 25;      // Sekunden zwischen zwei Applaus-Momenten
const FALTER_HOEHE = 650;        // so hoch flattert der Schmetterling beim Antippen (über die Köpfe der Band)
// Lücken zwischen den Tieren (Seiten-x): dorthin weicht der Schmetterling beim Hochfliegen aus
const FALTER_LUECKEN = [-570, -190, 190, 570];

// Kurzschreibweise für Muster: Schritt (Achtel 0…15) → Liste von [Instrument, Ton, Lautstärke, Dauer?]
const T = (midi, vol, dauer) => ['trommel', midi, vol, dauer];

// Die Band. inst = Bild, ix/iy = Ort des Instruments relativ zu den Füßen (Einheiten), is = Größe,
// ir = Drehung, vorn = vor dem Tier. art = wie das Instrument beim Spielen zuckt.
// anspiel = leiser Ton des Instruments sofort beim Einschalten (passt immer: C-Dur).
const MUSIKER = [
  {
    tier: 'baer', platz: 'platz1', inst: 'musik/trommel_gross', ix: 18, iy: 36, is: 0.33, ir: 0, art: 'trommel',
    anspiel: ['trommel', 36, 0.5],
    // Ruhiger Grundschlag: tiefe Trommel auf 1 und 3, weiche Trommel auf 2 und 4
    muster: {
      0: [T(36, 0.85)], 2: [T(38, 0.28)], 4: [T(36, 0.7)], 6: [T(38, 0.28)],
      8: [T(36, 0.85)], 10: [T(38, 0.28)], 12: [T(36, 0.7)], 13: [T(36, 0.35)], 14: [T(38, 0.3)],
    },
  },
  {
    tier: 'katze', platz: 'platz2', inst: 'musik/gitarre', ix: 34, iy: -40, is: 0.44, ir: -0.95, art: 'zupfen',
    anspiel: ['pling', 72, 0.3],
    // Ukulele: kleine Zupf-Figur auf den Zwischen-Achteln (C-Dur, dann F-Dur)
    muster: {
      1: [['pling', 67, 0.32]], 3: [['pling', 72, 0.3]], 5: [['pling', 76, 0.3]], 7: [['pling', 72, 0.28]],
      9: [['pling', 69, 0.32]], 11: [['pling', 72, 0.3]], 13: [['pling', 69, 0.3]], 15: [['pling', 67, 0.28]],
    },
  },
  {
    tier: 'elefant', platz: 'platz3', inst: 'musik/trompete', ix: 118, iy: -178, is: 0.36, ir: -0.32, art: 'blasen',
    anspiel: ['floete', 67, 0.34, 0.25],
    // Trompete (Flöten-Klang, tief): „tä-tä-tää" – kleines Motiv
    muster: {
      0: [['floete', 67, 0.5, 0.22]], 2: [['floete', 67, 0.5, 0.22]], 4: [['floete', 64, 0.55, 0.7]],
      8: [['floete', 69, 0.5, 0.22]], 10: [['floete', 69, 0.5, 0.22]], 12: [['floete', 72, 0.55, 0.5]],
      14: [['floete', 67, 0.45, 0.3]],
    },
  },
  {
    tier: 'hase', platz: 'platz4', inst: 'musik/klavier_klein', ix: 0, iy: 44, is: 0.5, ir: 0, art: 'klavier',
    anspiel: ['klavier', 60, 0.36, 0.35],
    // Klavier: Grundtöne im Viertel-Schritt (gebrochener Akkord)
    muster: {
      0: [['klavier', 48, 0.55, 0.5]], 2: [['klavier', 55, 0.42, 0.4]], 4: [['klavier', 52, 0.45, 0.4]],
      6: [['klavier', 55, 0.42, 0.4]],
      8: [['klavier', 53, 0.55, 0.5]], 10: [['klavier', 57, 0.42, 0.4]], 12: [['klavier', 60, 0.45, 0.4]],
      14: [['klavier', 57, 0.42, 0.4]],
    },
  },
  {
    tier: 'affe', platz: 'platz5', inst: 'musik/rassel', ix: 92, iy: -150, is: 0.34, ir: 0.25, art: 'rasseln',
    anspiel: ['trommel', 42, 0.32],
    // Rasseln: weich auf den Zwischen-Achteln
    muster: {
      1: [T(42, 0.3)], 3: [T(42, 0.3)], 5: [T(42, 0.3)], 7: [T(42, 0.36)],
      9: [T(42, 0.3)], 11: [T(42, 0.3)], 13: [T(42, 0.3)], 15: [T(42, 0.36)],
    },
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

export class Band extends Seite {
  static hg = 'musik/hg_buehne';

  aufbau() {
    this.takt = new Takt({ bpm: 84, schritteProSchlag: 2, laenge: 16 });
    this.takt.onSchritt = (i) => this.schritt(i);
    this.letzterApplaus = -1e9;
    this.runde = 0;           // wie oft schon alle fünf zusammen gespielt haben (für den Sticker)
    this.alleZusammen = false;
    this.notenZaehler = 0;
    this.texturen = [];

    this.musiker = MUSIKER.map((m, i) => this.baueMusiker(m, i));
    this.baueVorhaenge();
    this.baueSchmetterling();
    this.baueWolke();
    this.baueLampen();
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
    // Warmer Schein direkt hinter dem Tier: zeigt deutlich, wer spielt (statt Nebel über dem ganzen Bild)
    const aura = new PIXI.Graphics();
    for (let k = 0; k < 5; k++) {
      const f = 1 - k * 0.16;
      aura.ellipse(0, -205, 215 * f, 255 * f).fill({ color: 0xfff0b8, alpha: 0.09 });
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
    this.welt.addChild(gruppe);
    const tier = new Actor(def.tier, { x: 0, y: 0, scale: TIER_SKALA, parent: gruppe, z: 1 });
    const inst = spr(def.inst, { x: def.ix, y: def.iy, parent: gruppe, z: 2 });
    inst.scale.set(def.is);
    inst.rotation = def.ir;
    gruppe.sortableChildren = true;

    const m = {
      def, i, p, kegel, pfuetze, aura, gruppe, tier, inst,
      an: false, licht: 0, anschlag: 0, ruheY: inst.y, ruheR: inst.rotation, ruheS: def.is,
    };
    // Große Tippfläche: Tier und Instrument zusammen (≈ 320 × 470)
    tap(gruppe, () => { this.tierHier = true; this.umschalten(m); }, {
      sound: null,
      squash: false,
      hitArea: new PIXI.Rectangle(-160, -380, 320, 450),
    });
    return m;
  }

  // Vorhänge: Ausschnitt aus dem Hintergrund (eigene Textur auf derselben Quelle) mit Umriss-Maske –
  // so kann der Vorhang beim Antippen sanft schwingen. Tippfläche: der sichtbare Vorhangstreifen.
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
    // Ort der linken oberen Ecke des Ausschnitts in Seiten-Koordinaten
    const oben = this.bildPunkt(bx, 0);
    // Der Container rechnet in Bildpunkten des fertigen Bildes (1 Bildpunkt = sx Textur-Pixel)
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

    // Tippfläche in Seiten-Koordinaten: der Streifen am Rand (oben nicht in der Ecke des Karten-/Album-Knopfs)
    const ziel = new PIXI.Container({ label: c.label + ':tipp' });
    ziel.zIndex = 5;
    this.welt.addChild(ziel);
    const kante = this.bildPunkt(richtung > 0 ? 330 : 2829 - 330, 0).x;
    const x0 = richtung > 0 ? -1500 : kante - 90;
    const x1 = richtung > 0 ? kante + 90 : 1500;
    // In der Mitte des rechten Vorhangs liegt der Blätter-Pfeil (liegt im hud darüber und gewinnt ohnehin)
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

  baueSchmetterling() {
    const s = schmetterling(0xffa94d, 0xffe08a);
    s.c.zIndex = 50;
    s.c.scale.set(1.15);
    this.vorn.addChild(s.c);
    this.falter = { ...s, t: rand(0, 20), weg: 0, wegZiel: 0, lueckeX: 0 };
    // Tippen: flattert durch die nächste Lücke zwischen zwei Tieren über die Köpfe der Band und kommt wieder
    // (Tippfläche groß genug für kleine Finger)
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
    // Eine kleine Wolke zieht ganz langsam über den Himmel (hinter den Lämpchen)
    const w = spr('common/wolke3', { x: -900, y: 300, parent: this.hinten, z: -950 });
    w.scale.set(0.19);
    w.alpha = 0;
    this.wolke = { s: w, x: -950 };
    tap(w, () => {
      fx.wobble(w, 0.06);
      note('glocke', 79, { vol: 0.22 });
    }, { sound: null, squash: true, pad: 70 });
  }

  // Die Lichterkette oben: Antippen lässt ein Lämpchen weich aufglühen und klingen (Fünftonleiter, links tief,
  // rechts hoch). Jedes Lämpchen ist ein eigenes Feld einer Klangleiste (lückenlos, unterhalb des 70er-Rands):
  // jeder Finger zählt einzeln, und mit dem Finger über die Kette streichen spielt eine kleine Tonleiter.
  baueLampen() {
    this.lampen = LAMPEN.map(([px, py], i) => {
      const p = this.bildPunkt(px, py);
      const schein = new PIXI.Graphics();
      for (let k = 0; k < 5; k++) schein.circle(0, 0, 34 + k * 16).fill({ color: 0xfff1b0, alpha: 0.18 });
      schein.position.set(p.x, p.y);
      schein.alpha = 0;
      schein.zIndex = 1;
      schein.eventMode = 'none';
      this.welt.addChild(schein);
      return { x: p.x, y: p.y, schein, ton: LAMPEN_TOENE[i], zuletzt: -1 };
    });
    const flaeche = new PIXI.Container({ label: 'lichterkette' });
    flaeche.zIndex = 4;
    this.welt.addChild(flaeche);
    const L = this.lampen;
    const felder = L.map((l, i) => ({
      x0: i === 0 ? l.x - 70 : (L[i - 1].x + l.x) / 2,
      x1: i === L.length - 1 ? l.x + 70 : (l.x + L[i + 1].x) / 2,
    }));
    // y 72 … 300 (Rand 0 – die Fläche beginnt genau unter dem 70er-Rand)
    this.lampenLeiste = new Klangleiste(flaeche, {
      felder, y0: 72, y1: 300, rand: 0,
      onSpiel: (i) => this.lampeTipp(i),
      darf: () => this.aktiv,
    });
  }

  lampeTipp(i) {
    const beste = this.lampen[i];
    const t = this.szene.t;
    if (t - beste.zuletzt < 0.2) return;
    beste.zuletzt = t;
    note('glocke', beste.ton, { vol: 0.28 });
    // weich auf (0,5 s), dann langsam wieder aus (1,4 s)
    this.tween(beste.schein, { alpha: 1 }, 0.5, { ease: 'sineInOut' })
      .then((ok) => ok && this.tween(beste.schein, { alpha: 0 }, 1.4, { ease: 'sineInOut' }));
  }

  // ---------------------------------------------------------------- Seiten-Ablauf

  betreten() {
    // Wer noch an ist, beginnt seine 2 Takte von vorn
    if (this.musiker.some((m) => m.an)) this.takt.reset();
    if (this.besuche === 1) voice('musik_hallo');
    // „Tipp ein Tier an, dann spielt es mit." bei jedem Betreten anbieten (der Kern sagt ihn höchstens einmal am
    // Tag) – nur, solange die Seite zu sehen ist, das Kind hier noch kein Tier angetippt hat und noch eins schweigt.
    // nurWenn wird auch gefragt, wenn der Satz erst nach der Begrüßung an die Reihe kommt.
    this.tierHier = false;
    this._hinweis?.kill();
    const passt = () => this.aktiv && !this.tierHier && this.musiker.some((m) => !m.an);
    this._hinweis = this.after(this.besuche === 1 ? 4.5 : 2.5, () => {
      if (passt()) voice('musik_band', { nurWenn: passt });
    });
  }

  verlassen() {
    this._hinweis?.kill();
    this._hinweis = null;
    // Musik pausiert (update läuft nicht mehr); wer an ist, bleibt an und spielt beim Zurückkommen weiter
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
      g.scale.y = GRUPPE_SKALA * (1 - 0.024 * a * tief);
      g.scale.x = GRUPPE_SKALA * (1 + 0.01 * a * tief);
      g.rotation = 0.028 * a * Math.sin(schlag * Math.PI + m.i);
      this.instrumentZucken(m);
      m.anschlag *= weichAnschlag;
    }
    this.flattern(dt, t);
    this.ziehen(dt);
  }

  // Instrument reagiert sichtbar auf seine Töne (ohne Tweens, aus dem abklingenden Anschlag)
  instrumentZucken(m) {
    const k = m.anschlag;
    const inst = m.inst;
    const s = m.ruheS;
    switch (m.def.art) {
      case 'trommel':
        inst.scale.set(s * (1 + 0.04 * k), s * (1 - 0.06 * k));
        break;
      case 'zupfen':
        inst.rotation = m.ruheR + 0.06 * k;
        break;
      case 'blasen':
        inst.scale.set(s * (1 + 0.06 * k));
        inst.rotation = m.ruheR - 0.05 * k;
        break;
      case 'klavier':
        inst.scale.set(s * (1 + 0.02 * k), s * (1 - 0.03 * k));
        break;
      case 'rasseln':
        inst.rotation = m.ruheR + 0.14 * k;
        break;
      default:
    }
  }

  flattern(dt, t) {
    const f = this.falter;
    f.t += dt;
    f.weg += (f.wegZiel - f.weg) * (1 - Math.exp(-dt * 2.5));
    // Gemächlicher Bogen über den Blumen vorn (unterer Rand bleibt frei)
    // Beim Hochfliegen weicht er zur Lücke zwischen zwei Tieren aus (seitlich schneller als nach oben,
    // damit er nicht vor einem Gesicht vorbeizieht) und kreist oben über den Köpfen.
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
    // am Anfang und Ende weich ein- und ausblenden
    const rand = Math.min(w.x + 950, 760 - w.x);
    w.s.alpha = 0.92 * Math.min(1, Math.max(0, rand / 160));
  }

  // ---------------------------------------------------------------- Musik

  schritt(i) {
    for (const m of this.musiker) {
      if (!m.an) continue;
      const toene = m.def.muster[i];
      if (!toene) continue;
      for (const [instr, midi, vol, dauer] of toene) note(instr, midi, { vol, dauer });
      m.anschlag = 1;
    }
    // Ab und zu steigt eine einzelne Note auf (höchstens eine pro Takt)
    if (i % 8 === 4) {
      const spielen = this.musiker.filter((m) => m.an);
      if (spielen.length && Math.random() < 0.7) {
        const m = pick(spielen);
        this.burst('noten', m.p.x + rand(-40, 40), m.p.y - 360, { count: 1 });
      }
    }
    // Alle fünf spielen: auf dem nächsten Schlag (Viertel, höchstens ≈ 0,7 s nach dem Antippen) der
    // freundliche Moment – so verbindet das Kind die Freude mit seinem Tipp.
    if (i % 2 === 0 && this.alleZusammen && !this.applausGespielt) {
      this.applausGespielt = true;
      this.applaus();
    }
  }

  /**
   * Tier ein-/ausschalten. Sofort: Instrument zuckt, Tier nickt, ein leiser Ton (ein: ein Ton des eigenen
   * Instruments; aus: ein kleiner absteigender Ton, beim Vorhang übergibt der Aufrufer den Ton).
   */
  umschalten(m, { ausTon = null } = {}) {
    const vorher = this.musiker.filter((x) => x.an).length;
    m.an = !m.an;
    const erster = m.an && vorher === 0;
    if (erster) this.takt.reset(); // erster Einsatz: der Takt beginnt genau jetzt (Schritt 0 im nächsten Bild)
    m.anschlag = 1;
    m.tier.nod();
    if (m.an) {
      // Beim allerersten Einsatz spielt Schritt 0 gleich selbst – nur ergänzen, wenn dort nichts steht
      if (!(erster && m.def.muster[0])) {
        const [instr, midi, vol, dauer] = m.def.anspiel;
        note(instr, midi, { vol, dauer });
      }
    } else if (ausTon !== null) {
      note('pling', ausTon, { vol: 0.2 });
    } else {
      note('pling', 67, { vol: 0.2 });
      this.after(0.13, () => note('pling', 60, { vol: 0.17 }));
    }
    const jetzt = this.musiker.filter((x) => x.an).length;
    const alle = jetzt === this.musiker.length;
    if (alle && !this.alleZusammen) {
      this.alleZusammen = true;
      this.applausGespielt = false;
    } else if (!alle) {
      this.alleZusammen = false;
    }
  }

  applaus() {
    const jetzt = this.szene.t;
    if (jetzt - this.letzterApplaus < APPLAUS_ABSTAND) {
      // Kurz nach dem letzten Applaus: nur ein kleiner Freude-Moment (kein Applaus, kein Sticker)
      this.musiker.forEach((m, k) => this.after(0.15 * k, () => { if (m.an) m.tier.nod(); }));
      this.burst('herzen', 0, 640, { count: 3 });
      return;
    }
    this.letzterApplaus = jetzt;
    sfx('common/applaus', { vol: 0.45 });
    // Die Tiere freuen sich nacheinander (ohne Tierlaute – die Musik läuft ja)
    this.musiker.forEach((m, k) => {
      this.after(0.2 * k, () => {
        if (!m.an) return;
        m.tier.pose('happy');
        this.after(1.4, () => { if (!m.tier.destroyed) m.tier.pose('idle'); });
      });
    });
    this.burst('herzen', 0, 620, { count: 6 });
    this.runde++;
    this.after(1.2, () => {
      voice('musik_alle', { nurWenn: () => this.aktiv });   // Lob nur auf dieser Seite
      belohne(this, 'musik_trompete', 0, 560);
    });
  }

  // Alle hören nacheinander weich auf (von außen nach innen, im Abstand eines halben Schlags)
  vorhangTipp(c, richtung) {
    sfx('common/wusch', { vol: 0.4 });
    this.schwinge(c, richtung);
    const spielen = this.musiker.filter((m) => m.an);
    if (!spielen.length) {
      // Niemand spielt: die Tiere nicken freundlich
      this.musiker.forEach((m, k) => this.after(0.12 * k, () => m.tier.nod()));
      return;
    }
    const reihe = richtung > 0 ? spielen : [...spielen].reverse();
    // Jeder, der aufhört, sagt mit einem Ton „tschüss" – zusammen eine kleine absteigende Tonleiter
    const toene = [72, 69, 67, 64, 60];
    reihe.forEach((m, k) => {
      this.after(0.36 * k, () => {
        if (m.an) this.umschalten(m, { ausTon: toene[k] });
      });
    });
  }

  schwinge(c, richtung) {
    // Nur nach innen schwingen (so bleibt das gemalte Original dahinter verdeckt)
    const a = 0.032 * richtung;
    this.tween(c, { skewX: a }, 0.4, { ease: 'sineOut' })
      .then((ok) => ok && this.tween(c, { skewX: a * 0.25 }, 0.7, { ease: 'sineInOut' }))
      .then((ok) => ok && this.tween(c, { skewX: a * 0.6 }, 0.6, { ease: 'sineInOut' }))
      .then((ok) => ok && this.tween(c, { skewX: 0 }, 0.9, { ease: 'sineInOut' }));
  }

  // ---------------------------------------------------------------- Zeige-Hand

  // Nächster sinnvoller Schritt: ein Tier, das noch nicht spielt. Spielen alle fünf, gibt es nichts mehr zu
  // zeigen – dann zeigt die SeitenSzene auf den Pfeil zur Instrumente-Seite. Der Vorhang („alle aus") wird nie
  // gezeigt: Ausschalten ist kein Schritt, zu dem die Hand einladen soll.
  hinweise() {
    return this.musiker.filter((m) => !m.an).slice(0, 2).map((m) => m.gruppe);
  }

  resize() {}
}
