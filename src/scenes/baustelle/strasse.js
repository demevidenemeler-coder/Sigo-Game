// Seite 3 – Straße (hg_strasse). Eine Runde (≈ 1–2 Minuten), sechs Schritte:
//   1. Schotter: Der Kipper steht links mit Schotter in der Mulde. Finger über die Straße ziehen (oder vor den Kipper
//      tippen) → er rollt hinterher und lädt hinter sich die holprige Decke ab. Ohne Finger kriecht er von selbst.
//   2. Walzen: Die Walze folgt dem Finger und walzt die Holperdecke glatt (wie bisher).
//   3. Striche: Das Markierwägelchen malt Striche, wo der Finger entlangfährt – mal weiß, mal gelb.
//   4. Zebrastreifen: An einer Stelle (jede Runde woanders) fehlen die Striche. Antippen → Streifen um Streifen
//      erscheint (mit einer kleinen Tonleiter). Danach geht ein Tier über den Zebrastreifen.
//   5. Band: Zwei Pfosten mit rotem Band, Kipper (mit zwei Gästen) und ein zweites Fahrzeug warten davor.
//      Antippen oder durchwischen → das Band ist durch, Zuschauer jubeln, Sticker.
//   6. Fahrt: alle fahren hupend über die neue Straße. Jede Runde kommt ein Zuschauer dazu (bis fünf, gespeichert).
// Abwechslung: Strichfarbe, Ort des Zebrastreifens, Tier auf dem Zebrastreifen, Gäste im Kipper, zweites Fahrzeug.

import { stage, spr, meta, tex, voice, fx, tap, note, store, Actor, PIXI, clamp } from '../../engine/index.js';
import { Seite } from '../../gemeinsam/seiten.js';
import { Fahrzeug } from '../../gemeinsam/zug.js';
import { belohne } from '../../gemeinsam/sticker.js';
import { Decke } from './decke.js';
import { Wolken, Schmetterling, Spatz, helmTier, freuen, ton, laut, Beutel, HandStart } from './deko.js';

const WALZE_S = 0.52;
const WALZE_Y = [1185, 1390];     // Standlinie der Walze (vorn/hinten auf der Straße)
const WALZE_TEMPO = 1100;         // höchstens so schnell folgt sie dem Finger
const PINSEL = { rx: 115, ry: 150 };
const FERTIG_AB = 0.9;            // Anteil der gezählten Fläche (nur der Kernbereich zählt, siehe zaehlen)
const ZAEHL_X = 1000;             // gezählt wird x -1000 … +1000 (auf jedem Bildschirm sichtbar)
const TROMMEL_X = 1235;           // so weit nach außen kommt die Trommel (deckt auch die Bildränder ab)
const LINIE_Y = 1240;             // Mitte der Straße: hier kommen die Striche hin
const STRICHE = 10;
const STRICH_LANG = 120;
const STRICH_X = 1000;            // Striche zwischen -1000 und +1000 (Kernbereich)
const STRICH_FERTIG = 0.4;        // ab diesem Anteil gilt ein Strich als gemalt
const STRICH_FARBEN = [0xfbf7ec, 0xf4cf52];   // weiß, gelb
const FINGER_VERGESSEN = 3;       // s ohne Bewegung: der Finger gilt als losgelassen (falls ein pointerup verloren ging)
const ROLLE_S = 0.55;
const SPUR = 1395;                // Standlinie der Fahrzeuge

// Schotter
const KIPPER_S = 0.5;
const KIPPER_START = -1000;
const KIPPER_MAX = 1250;
const KIPPER_TEMPO = 650;         // mit Finger höchstens so schnell
const KIPPER_SELBST = 170;        // ohne Finger (nach einer Weile) kriecht er so langsam von selbst
const SELBST_AB = 7;              // s ohne Finger, bis er von selbst fährt
const SCHRITT = 380;              // Antippen des Kippers: ein Stück vor
const SCHOTTER_FERTIG = 760;      // steht der Kipper so weit rechts, fährt er allein hinaus (und lädt den Rest ab)
const SCHOTTER_FARBE = 0xa39587;

// Zebrastreifen
const ZEBRA_ORTE = [-420, 20, 400];
const ZEBRA_N = 5;
const ZEBRA_ABSTAND = 112;
const ZEBRA_BREIT = 66;
const ZEBRA_HOCH = 290;
const ZEBRA_TOENE = [72, 74, 76, 77, 79];
const QUERER = ['igel', 'ente', 'hase', 'frosch', 'maus'];

// Band (etwas rechts der Mitte, damit Kipper und zweites Fahrzeug links davor ganz im Bild warten können)
const BAND_Y = 1150;
const BAND_MITTE = 220;
const PFOSTEN_X = 500;            // Abstand der Pfosten von der Band-Mitte
const BAND_S = (2 * PFOSTEN_X) / 1300;
const BAND_SCHNITT = 420;         // Bildpunkte: links vom Schleifen-Knoten

// Gäste im Kipper, zweites Fahrzeug, Zuschauer
const GAESTE = [['hund', 'ente'], ['affe', 'pinguin'], ['schwein', 'hund'], ['ente', 'affe'], ['pinguin', 'schwein']];
const ZWEITE = ['mischer', 'walze', 'rolle'];
const WARTEN_KIPPER = -560;       // Kipper wartet vor dem linken Pfosten (Schnauze ≈ 55 davor)
const WARTEN_ZWEITES = { mischer: -1080, walze: -1060, rolle: -985 };   // dahinter, ganz im Kernbereich zu sehen
const ZUSCHAUER = [
  { tier: 'schaf', x: -880 }, { tier: 'hase', x: -400 }, { tier: 'igel', x: 140 },
  { tier: 'maus', x: 780 }, { tier: 'frosch', x: 1040 },
];
const ZUSCHAUER_Y = 1028;
const ZUSCHAUER_S = 0.17;
const ZUSCHAUER_KEY = 'baustelle.zuschauer';
const TIER_PAD = 75;              // kleine Tiere: Tippfläche reichlich größer als das Bild (≥ 260 Einheiten)

export const STRASSE_TIERE = [...new Set([...GAESTE.flat(), ...QUERER, ...ZUSCHAUER.map((z) => z.tier)])];

export class Strasse extends Seite {
  static hg = 'baustelle/hg_strasse';

  aufbau() {
    this.wolken = new Wolken(this, { anzahl: 2, y: [100, 260] });
    this.schmetterling = new Schmetterling(this, { bereich: { x: -450, y: 600, w: 900, h: 240 }, farbe: 0x8fc8f0 });
    this.spatz = new Spatz(this, { x: 520, y: 842, z: 4 });

    const oben = this.punkt('strasse_oben', { x: 0, y: 1055 }).y;
    const unten = this.punkt('strasse_unten', { x: 0, y: 1425 }).y;
    this.oben = oben;
    this.unten = unten;
    this.decke = new Decke(this.welt, {
      x: -1420, y: oben - 18, w: 2840, h: unten - oben + 36,
      zaehlen: { x0: -ZAEHL_X, x1: ZAEHL_X, y0: oben + 10, y1: unten - 10 },
    });

    this.beutel = {
      farbe: new Beutel([0, 1]),
      zebra: new Beutel(ZEBRA_ORTE),
      querer: new Beutel(QUERER),
      gaeste: new Beutel(GAESTE.map((_, i) => i)),
      zweite: new Beutel(ZWEITE),
    };

    this.baueStriche();
    this.baueZebra();
    this.baueWalze();
    this.baueRolle();
    this.baueKolonne();
    this.baueBand();
    this.baueZuschauer();
    this.baueFlaeche(oben, unten);
    this.handStart = new HandStart(this.welt);   // Startpunkt der Zeige-Hand beim Schotter-Schieben

    // 'schotter' | 'wechsel' | 'walzen' | 'malen' | 'zebra' | 'band' | 'fahrt'
    this.phase = 'wechsel';
    this.finger = null;        // pointerId des steuernden Fingers (der jüngste Finger auf der Straße steuert)
    this.fingerRuht = 0;       // Sekunden seit der letzten Bewegung des Fingers
    this.ziel = null;          // wohin der Finger zeigt (Seiten-Koordinaten)
    this._vorher = { x: 0, y: 0 };
    this._jetzt = { x: 0, y: 0 };
    this.ohneFinger = 0;       // Sekunden ohne Finger (Markierwägelchen, Kipper)
    this.walzTon = 0;
    this.runde = 0;
    this.neueRunde(false);
  }

  betreten() {
    // Hinweis bei jedem Betreten anmelden (der Kern sagt ihn höchstens einmal am Tag) – nur, solange die Seite zu
    // sehen ist und der Schritt noch läuft (die Zeitgeber laufen beim Wegblättern weiter)
    this._hinweis?.kill();
    this._hinweis = null;
    const satz = { schotter: 'baustelle_schotter', walzen: 'baustelle_walze', band: 'baustelle_band' }[this.phase];
    if (!satz) return;
    const phase = this.phase;
    const passt = () => this.aktiv && this.phase === phase;
    this._hinweis = this.after(1.2, () => { if (passt()) voice(satz, { nurWenn: passt }); });
  }

  verlassen() {
    this._hinweis?.kill();
    this._hinweis = null;
    this.finger = null;
    this.ziel = null;
  }

  // ---------------------------------------------------------------- Eingabe: Finger auf der Straße

  baueFlaeche(oben, unten) {
    const f = new PIXI.Container({ label: 'strassenFlaeche' });
    f.zIndex = 1;
    // Straße samt Bordstein; unten rechts bleibt die Ecke (240 × 240) frei
    f.hitArea = {
      contains: (x, y) => x > -1420 && x < 1420 && y > oben - 70 && y < unten + 40 &&
        !(x > stage.W / 2 - 250 && y > stage.H - 250),
    };
    f.eventMode = 'static';
    this.welt.addChild(f);
    this._zielPunkt = new PIXI.Point();
    this._g = new PIXI.Point();
    f.on('pointerdown', (e) => {
      if (!this.aktiv) return;
      // Walze oder Wägelchen getroffen? → kleine Antwort (auch für einen zweiten Finger)
      if (this.walze.visible && this.walze.getBounds().rectangle.contains(e.global.x, e.global.y)) this.walzeHupt();
      else if (this.rolle.visible && this.rolle.getBounds().rectangle.contains(e.global.x, e.global.y)) {
        if (ton('common/klingel', { abstand: 0.6, vol: 0.5 })) fx.wobble(this.rolle, 0.05);
      }
      e.stopPropagation();
      if (this.phase !== 'walzen' && this.phase !== 'malen' && this.phase !== 'schotter') {
        // während Wechsel, Zebra, Band und Fahrt steuert der Finger auf der Straße nichts
        if (ton('common/tipp', { abstand: 0.2, vol: 0.6 })) {
          const p = this.welt.toLocal(e.global);
          this.burst('staub', p.x, p.y, { count: 2 });
        }
        return;
      }
      // der neue Finger übernimmt (ein verlorener alter Finger kann so nie etwas blockieren)
      this.finger = e.pointerId;
      this.fingerRuht = 0;
      this.ziel = this.welt.toLocal(e.global, undefined, this._zielPunkt);
      this.ohneFinger = 0;
      if (this.phase === 'walzen') ton('common/walze', { abstand: 2.6, vol: 0.55 });
      else if (this.phase === 'malen') ton('common/pinsel', { abstand: 0.6, vol: 0.6 });
      else this.kipperSchritt(this.ziel);
    });
    // Bewegen und Loslassen direkt am Fenster (wie der Spielkern) – Abbau in aufraeumen() beim Verlassen der Szene
    this._bewegt = (ev) => {
      if (ev.pointerId !== this.finger || !this.aktiv || this.welt.destroyed) return;
      stage.app.renderer.events.mapPositionToPoint(this._g, ev.clientX, ev.clientY);
      this.ziel = this.welt.toLocal(this._g, undefined, this._zielPunkt);
      this.fingerRuht = 0;
    };
    this._los = (ev) => {
      if (ev.pointerId === this.finger) this.finger = null;
    };
    // Fenster verliert den Fokus (Systemgeste, anderes Programm): kein pointerup mehr – Finger loslassen
    this._alleLos = () => { this.finger = null; };
    window.addEventListener('pointermove', this._bewegt, { passive: true });
    window.addEventListener('pointerup', this._los, { passive: true });
    window.addEventListener('pointercancel', this._los, { passive: true });
    window.addEventListener('blur', this._alleLos);
    this.flaeche = f;
  }

  // ---------------------------------------------------------------- Runde

  /** Neue Runde: Straße leer, Kipper mit Schotter steht links. */
  async neueRunde(weich = true) {
    this.runde++;
    this.phase = 'wechsel';
    this.finger = null;
    this.ziel = null;
    this.autoStrich = null;
    // alte Striche, Zebrastreifen und Bandreste weich weg
    const weg = weich ? 1.2 : 0.01;
    for (const q of this.striche) {
      this.tween(q.s, { alpha: 0 }, weg, { ease: 'sineInOut' }).then(() => {
        q.s.width = 0;
        q.s.alpha = 1;
        q.von = null;
        q.bis = null;
        q.fertig = false;
        q.frei = false;
      });
    }
    for (const z of this.zebra) {
      this.tween(z, { alpha: 0 }, weg, { ease: 'sineInOut' }).then(() => { z.height = 0; z.alpha = 1; });
    }
    if (this.bandTeile.visible) {
      this.tween(this.bandTeile, { alpha: 0 }, weg, { ease: 'sineInOut' }).then(() => { this.bandTeile.visible = false; });
    }
    // die Holperdecke verschwindet (die vorige Straße ist ja fertig) – jetzt kommt neuer Schotter
    if (weich) await this.tween(this.decke.sprite, { alpha: 0 }, 0.6, { ease: 'sineInOut' });
    this.decke.leere();
    this.decke.sprite.alpha = 1;
    this.walze.visible = false;
    this.walze.position.set(-1750, 1300);
    this.walze.scale.set(WALZE_S);

    const k = this.kipper;
    k.visible = true;
    k.rotation = 0;
    for (const g of this.gaeste) g.visible = false;
    this.ladungBild.visible = true;
    this.ladungBild.scale.set(0.9, 1.35);
    this.schotterBis = -1420;
    if (weich) {
      k.x = -1900;
      ton('common/motor', { abstand: 3, vol: 0.5 });
      await k.fahreZu(KIPPER_START, 2.4, { ease: 'sineOut' });
    } else {
      k.x = KIPPER_START;
    }
    this.tween(k, { rotation: -0.045 }, 0.6, { ease: 'sineInOut' });
    this.schotterBis = -1420;
    this.decke.zeigeBis(this.kipperHinten());
    this.schotterBis = this.kipperHinten();
    this.ohneFinger = 0;
    this.kipperZiel = null;
    this.phase = 'schotter';
    if (weich) this.betreten();
  }

  // ---------------------------------------------------------------- 1. Schotter

  kipperHinten() {
    return this.kipper.x + this.muldeHintenX * KIPPER_S;
  }

  // Antippen auf oder vor dem Kipper: ein gutes Stück vor (Ziehen mit dem Finger steuert ihn direkt)
  kipperSchritt(p) {
    if (this.phase !== 'schotter') return;
    const k = this.kipper;
    const naheAmKipper = p.x < k.x + 320;
    this.kipperZiel = naheAmKipper ? Math.min(KIPPER_MAX, k.x + SCHRITT) : Math.min(KIPPER_MAX, p.x);
    ton('common/motor', { abstand: 3, vol: 0.45 });
  }

  bewegeKipper(dt) {
    if (this.phase !== 'schotter') return;
    const k = this.kipper;
    if (this.finger !== null) {
      this.ohneFinger = 0;
      // der Finger zieht: der Kipper folgt (nur vorwärts, damit niemand „falsch" ziehen kann)
      if (this.ziel && this.ziel.x > k.x - 150) this.kipperZiel = Math.min(KIPPER_MAX, Math.max(k.x, this.ziel.x + 150));
    } else {
      this.ohneFinger += dt;
    }
    let tx = this.kipperZiel;
    let max = KIPPER_TEMPO * dt;
    if ((tx === null || tx <= k.x + 1) && this.ohneFinger > SELBST_AB) {
      tx = Math.min(KIPPER_MAX, k.x + 200);
      max = KIPPER_SELBST * dt;
    }
    if (tx === null || tx <= k.x + 0.5) return;
    const dx = Math.min(max, (tx - k.x) * (1 - Math.exp(-dt * 4)) + 20 * dt);
    const vorher = k.x;
    k.x = Math.min(tx, k.x + dx);
    k.rolle(k.x - vorher);
    if (k.x >= tx - 1) this.kipperZiel = null;
    this.schotterRieselt(dt);
    const hinten = this.kipperHinten();
    if (hinten > this.schotterBis + 10) {
      this.schotterBis = hinten;
      this.decke.zeigeBis(hinten);
      // die Ladung wird kleiner
      const p = clamp((k.x - KIPPER_START) / (SCHOTTER_FERTIG - KIPPER_START), 0, 1);
      this.ladungBild.scale.set(0.9 - 0.3 * p, 1.35 - 0.95 * p);
    }
    if (k.x >= SCHOTTER_FERTIG) this.schotterFertig();
  }

  schotterRieselt(dt) {
    this._riesel = (this._riesel || 0) + dt;
    if (this._riesel < 0.3) return;
    this._riesel = 0;
    const x = this.kipperHinten();
    this.burst('staub', x - 20, SPUR - 90, { count: 1 });
    ton('common/sand', { abstand: 1.1, vol: 0.4 });
  }

  async schotterFertig() {
    if (this.phase !== 'schotter') return;
    this.phase = 'wechsel';
    this.finger = null;
    this.ziel = null;
    this.kipperZiel = null;
    ton('common/hupe', { abstand: 0.6, vol: 0.6 });
    this.kipper.hupf(18);
    // Kipper fährt rechts hinaus und lädt bis zum Rand ab
    this.tween(this.kipper, { rotation: 0 }, 0.8, { ease: 'sineInOut' });
    this.schotterAus = true;
    await this.kipper.fahreZu(1900, 2.6, { ease: 'quadIn' });
    this.schotterAus = false;
    this.decke.fuelle();
    this.kipper.visible = false;
    this.ladungBild.visible = false;
    // die Walze kommt von links
    const w = this.walze;
    w.visible = true;
    w.position.set(-1750, 1300);
    w.scale.set(WALZE_S);
    ton('common/motor', { abstand: 3, vol: 0.5 });
    await this.tween(w, { x: -700 }, 2.2, {
      ease: 'quadOut',
      onUpdate: () => { this.trommel.rotation += 0.03; },
    });
    this.finger = null;
    this.ziel = null;
    this.phase = 'walzen';
    this.betreten();
  }

  // ---------------------------------------------------------------- 2. Walze

  baueWalze() {
    const w = new PIXI.Container({ label: 'walze' });
    const mw = meta('baustelle/walze');
    const trommelPunkt = { x: mw.pts.trommel[0] - mw.ax * mw.w, y: mw.pts.trommel[1] - mw.ay * mw.h };
    // Trommel hinter dem Körper (im leeren Bogen vorn sichtbar), dreht sich beim Fahren
    const tr = spr('baustelle/walze_trommel', { anchor: 0.5, parent: w });
    tr.scale.set(0.72);
    tr.position.set(trommelPunkt.x, trommelPunkt.y);
    this.koerperW = new PIXI.Container();
    w.addChild(this.koerperW);
    spr('baustelle/walze', { parent: this.koerperW });
    w.scale.set(WALZE_S);
    w.position.set(-1750, 1300);
    w.zIndex = 20;
    w.visible = false;
    this.welt.addChild(w);
    this.walze = w;
    this.trommel = tr;
    this.trommelPunkt = trommelPunkt;
    this.trommelR = 150;   // Bildpunkte der Walze
    this.walzeT = 0;
    // Antippen der Walze (Hupe, kleiner Hüpfer) macht die Straßen-Fläche mit – so steuert der Finger auch dann,
    // wenn er direkt auf der Walze landet.
  }

  walzeHupt() {
    if (!ton('common/hupe', { abstand: 0.8, vol: 0.7 })) return;
    this.tween(this.koerperW, { y: -30 }, 0.15, { ease: 'quadOut' })
      .then(() => this.tween(this.koerperW, { y: 0 }, 0.2, { ease: 'quadIn' }));
  }

  // Ort, an dem die Trommel den Boden berührt (Seiten-Koordinaten) – in `aus` geschrieben (kein neues Objekt je Bild)
  walzOrt(aus = { x: 0, y: 0 }) {
    const w = this.walze;
    aus.x = w.x + this.trommelPunkt.x * w.scale.x;
    aus.y = w.y - 30;
    return aus;
  }

  bewegeWalze(dt) {
    const w = this.walze;
    // fährt auch nach dem Loslassen noch weich bis zur letzten Fingerstelle
    if (this.phase !== 'walzen' || !this.ziel) return;
    const s0 = w.scale.x;
    // nahe am Bildrand etwas weiter nach außen, damit auch die Ecken der Straße glatt werden
    const trommelZiel = clamp(this.ziel.x * 1.1, -TROMMEL_X, TROMMEL_X);
    const tx = trommelZiel - this.trommelPunkt.x * s0;
    const ty = clamp(this.ziel.y + 60, WALZE_Y[0], WALZE_Y[1]);
    const k = 1 - Math.exp(-dt * 5);
    let dx = (tx - w.x) * k;
    let dy = (ty - w.y) * k;
    const d = Math.hypot(dx, dy);
    const max = WALZE_TEMPO * dt;
    if (d > max) { dx *= max / d; dy *= max / d; }
    if (d < 0.3) {
      if (this.finger === null) this.ziel = null;
      return;
    }
    const vorher = this.walzOrt(this._vorher);
    w.x += dx;
    w.y += dy;
    // weiter vorn = etwas größer
    const tief = (w.y - WALZE_Y[0]) / (WALZE_Y[1] - WALZE_Y[0]);
    w.scale.set(WALZE_S * (0.94 + 0.1 * tief));
    w.zIndex = 20 + tief;
    this.trommel.rotation += dx / (this.trommelR * w.scale.x);
    const jetzt = this.walzOrt(this._jetzt);
    const anteil = this.decke.walze(vorher.x, vorher.y, jetzt.x, jetzt.y, PINSEL.rx, PINSEL.ry);
    ton('common/walze', { abstand: 2.6, vol: 0.55 });
    if (anteil >= FERTIG_AB) this.glatt();
  }

  async glatt() {
    if (this.phase !== 'walzen') return;
    this.phase = 'wechsel';
    this.finger = null;
    this.ziel = null;
    ton('common/funkeln', { abstand: 0.5 });
    for (let i = 0; i < 3; i++) this.burst('funkeln', -700 + i * 700, LINIE_Y, { count: 5 });
    await this.tween(this.decke.sprite, { alpha: 0 }, 0.8, { ease: 'sineInOut' });
    this.decke.leere();
    this.decke.sprite.alpha = 1;
    // Walze fährt rechts hinaus, das Markierwägelchen rollt von links herein
    ton('common/motor', { abstand: 3, vol: 0.5 });
    this.tween(this.walze, { x: 1750 }, 2.2, {
      ease: 'quadIn',
      onUpdate: () => { this.trommel.rotation += 0.04; },
    }).then(() => { this.walze.visible = false; });
    // diese Runde: Strichfarbe und Ort des Zebrastreifens (die Striche dort bleiben frei)
    const farbe = STRICH_FARBEN[this.beutel.farbe.ziehe()];
    this.zebraX = this.beutel.zebra.ziehe();
    const halb = ((ZEBRA_N - 1) * ZEBRA_ABSTAND) / 2 + ZEBRA_BREIT / 2 + 40;
    for (const q of this.striche) {
      q.s.tint = farbe;
      q.frei = q.b > this.zebraX - halb && q.a < this.zebraX + halb;
      if (q.frei) q.fertig = true;
    }
    await this.wait(0.8);
    // der Satz sagt „weiße Striche" – nur in weißen Runden (bei Gelb malt das Wägelchen ohne Ansage)
    if (farbe === STRICH_FARBEN[0]) voice('baustelle_linie', { nurWenn: () => this.aktiv && this.phase !== 'schotter' });
    this.rolle.visible = true;
    this.rolle.x = -1650;
    // hält mit der Düse knapp links vom ersten Strich
    const erster = this.naechsterStrich() || this.striche[0];
    await this.tween(this.rolle, { x: Math.min(this.striche[0].a, erster.a) - 40 - this.duese.x }, 1.6, { ease: 'sineOut' });
    this.phase = 'malen';
    this.ohneFinger = -1.5;   // beim ersten Mal etwas länger auf den Finger warten (≈ 4 s), dann fährt es selbst
  }

  // ---------------------------------------------------------------- 3. Striche und Markierwägelchen

  baueStriche() {
    this.striche = [];
    const abstand = (2 * STRICH_X) / STRICHE;
    for (let i = 0; i < STRICHE; i++) {
      const mitte = -STRICH_X + abstand * (i + 0.5);
      const s = new PIXI.Sprite(PIXI.Texture.WHITE);
      s.tint = STRICH_FARBEN[0];
      s.height = 20;
      s.anchor.set(0, 0.5);
      s.position.set(mitte - STRICH_LANG / 2, LINIE_Y);
      s.width = 0;
      s.zIndex = 3;
      s.eventMode = 'none';
      this.welt.addChild(s);
      this.striche.push({ s, a: mitte - STRICH_LANG / 2, b: mitte + STRICH_LANG / 2, von: null, bis: null, fertig: false, frei: false });
    }
  }

  baueRolle() {
    const r = spr('baustelle/linienrolle', { parent: this.welt });
    r.scale.set(ROLLE_S);
    const m = meta('baustelle/linienrolle');
    this.duese = { x: (m.pts.duese[0] - m.ax * m.w) * ROLLE_S, y: (m.pts.duese[1] - m.ay * m.h) * ROLLE_S };
    r.position.set(-1650, LINIE_Y - this.duese.y);
    r.zIndex = 25;
    r.visible = false;
    this.rolle = r;
    // Antippen (Klingel) übernimmt die Straßen-Fläche – wer das Wägelchen greift, steuert es gleich
  }

  bewegeRolle(dt) {
    if (this.phase !== 'malen') return;
    const r = this.rolle;
    let tx = null;
    if (this.finger !== null) this.ohneFinger = 0;
    else this.ohneFinger += dt;
    // mit Finger (und kurz nach dem Loslassen) fährt es zur Fingerstelle
    const folgt = !!this.ziel && this.ohneFinger < 1.5;
    if (folgt) {
      tx = this.ziel.x - this.duese.x;
      this.autoStrich = null;
    } else {
      // nach einer Weile ohne Finger fährt es von selbst zum nächsten leeren Strich
      if (this.ohneFinger > 2.5) {
        const n = this.naechsterStrich();
        if (n) {
          // Richtung einmal je Strich festlegen (sonst pendelt es um die Mitte)
          if (this.autoStrich !== n) {
            this.autoStrich = n;
            const d = r.x + this.duese.x;
            this.autoZiel = d < (n.a + n.b) / 2 ? n.b + 10 : n.a - 10;
          }
          tx = this.autoZiel - this.duese.x;
        }
      }
    }
    if (tx === null) return;
    tx = clamp(tx, -1150 - this.duese.x, 1150 - this.duese.x);
    // mit Finger: weich hinterher; von selbst: gemächlich mit gleichem Tempo
    const k = folgt ? 1 - Math.exp(-dt * 5) : 1;
    let dx = (tx - r.x) * k;
    const max = (folgt ? 1000 : 380) * dt;
    dx = clamp(dx, -max, max);
    if (Math.abs(dx) < 0.2) return;
    const a = r.x + this.duese.x;
    r.x += dx;
    const b = r.x + this.duese.x;
    r.rotation = Math.sin(this.t * 14) * 0.01;
    this.male(Math.min(a, b), Math.max(a, b));
  }

  male(lo, hi) {
    let neu = false;
    for (const q of this.striche) {
      if (q.fertig || hi < q.a || lo > q.b) continue;
      const v = Math.max(q.a, lo);
      const b = Math.min(q.b, hi);
      q.von = q.von === null ? v : Math.min(q.von, v);
      q.bis = q.bis === null ? b : Math.max(q.bis, b);
      neu = true;
      if (q.bis - q.von >= STRICH_LANG * STRICH_FERTIG) {
        // ab knapp der Hälfte gilt der Strich als gemalt und wächst weich zu voller Länge
        q.fertig = true;
        q.s.x = q.von;
        q.s.width = q.bis - q.von;
        this.tween(q.s, { x: q.a, width: STRICH_LANG }, 0.3, { ease: 'sineInOut' });
        ton('common/pinsel', { abstand: 0.35, vol: 0.55 });
        continue;
      }
      q.s.x = q.von;
      q.s.width = q.bis - q.von;
    }
    if (neu && !this.naechsterStrich()) this.allesGemalt();
  }

  // erster noch nicht gemalter Strich (oder null)
  naechsterStrich() {
    for (const q of this.striche) if (!q.fertig) return q;
    return null;
  }

  async allesGemalt() {
    if (this.phase !== 'malen') return;
    this.phase = 'wechsel';
    this.finger = null;
    this.ziel = null;
    ton('common/funkeln', { abstand: 0.5 });
    this.burst('funkeln', 0, LINIE_Y - 30, { count: 6 });
    await this.tween(this.rolle, { x: 1700 }, 2, { ease: 'quadIn' });
    this.rolle.visible = false;
    // die Lücke wird zum Zebrastreifen: zeigen, wo
    this.zebraFeld.x = this.zebraX;
    this.zebraNr = 0;
    this.zebraFeld.eventMode = 'static';
    this.phase = 'zebra';
    for (let i = 0; i < ZEBRA_N; i++) {
      const z = this.zebra[i];
      z.x = this.zebraX + (i - (ZEBRA_N - 1) / 2) * ZEBRA_ABSTAND;
    }
    // ein ganz blasser Umriss, wo die Streifen hinkommen
    this.zebraUmriss.x = this.zebraX;
    this.zebraUmriss.alpha = 0;
    this.zebraUmriss.visible = true;
    this.tween(this.zebraUmriss, { alpha: 0.35 }, 0.8, { ease: 'sineInOut' });
  }

  // ---------------------------------------------------------------- 4. Zebrastreifen

  baueZebra() {
    this.zebra = [];
    for (let i = 0; i < ZEBRA_N; i++) {
      const s = new PIXI.Sprite(PIXI.Texture.WHITE);
      s.tint = 0xfbf7ec;
      s.anchor.set(0.5);
      s.width = ZEBRA_BREIT;
      s.height = 0;
      s.position.set(0, LINIE_Y);
      s.zIndex = 3.2;
      s.eventMode = 'none';
      this.welt.addChild(s);
      this.zebra.push(s);
    }
    // blasse Umrisse der fünf Streifen
    const u = new PIXI.Graphics();
    for (let i = 0; i < ZEBRA_N; i++) {
      const x = (i - (ZEBRA_N - 1) / 2) * ZEBRA_ABSTAND;
      u.roundRect(x - ZEBRA_BREIT / 2, LINIE_Y - ZEBRA_HOCH / 2, ZEBRA_BREIT, ZEBRA_HOCH, 8)
        .stroke({ width: 6, color: 0xffffff, alpha: 0.9 });
    }
    u.zIndex = 3.1;
    u.eventMode = 'none';
    u.visible = false;
    this.welt.addChild(u);
    this.zebraUmriss = u;
    // Tippfläche über dem ganzen Zebrastreifen (liegt über der Straßen-Fläche)
    const f = new PIXI.Container({ label: 'zebra' });
    const halb = ((ZEBRA_N - 1) * ZEBRA_ABSTAND) / 2 + ZEBRA_BREIT / 2 + 60;
    f.hitArea = new PIXI.Rectangle(-halb, LINIE_Y - ZEBRA_HOCH / 2 - 60, 2 * halb, ZEBRA_HOCH + 120);
    f.zIndex = 4;
    f.eventMode = 'none';
    f.on('pointerdown', (e) => {
      e.stopPropagation();
      this.zebraGetippt();
    });
    this.welt.addChild(f);
    this.zebraFeld = f;
  }

  zebraGetippt() {
    if (this.phase !== 'zebra' || !this.aktiv) return;
    const i = this.zebraNr;
    if (i >= ZEBRA_N) return;
    this.zebraNr++;
    const z = this.zebra[i];
    z.alpha = 1;
    this.tween(z, { height: ZEBRA_HOCH }, 0.45, { ease: 'backOut' });
    note('glocke', ZEBRA_TOENE[i], { vol: 0.24 });
    ton('common/pinsel', { abstand: 0.15, vol: 0.45 });
    if (this.zebraNr >= ZEBRA_N) this.zebraFertig();
  }

  async zebraFertig() {
    this.phase = 'wechsel';
    this.zebraFeld.eventMode = 'none';
    this.tween(this.zebraUmriss, { alpha: 0 }, 0.6, { ease: 'sineInOut' }).then(() => { this.zebraUmriss.visible = false; });
    await this.wait(0.5);
    ton('common/funkeln', { abstand: 0.5, vol: 0.6 });
    this.burst('funkeln', this.zebraX, LINIE_Y - 40, { count: 4 });
    // ein Tier geht über den Zebrastreifen (von hinten nach vorn) und dann nach links davon
    const id = this.beutel.querer.ziehe();
    const t = new Actor(id, { x: this.zebraX, y: ZUSCHAUER_Y, scale: 0.19, parent: this.welt, z: 26 });
    this.querer = t;
    t.onTap(() => freuen(this, t, { herzen: 2 }), { pad: TIER_PAD });
    t.alpha = 0;
    await this.tween(t, { alpha: 1 }, 0.5, { ease: 'sineInOut' });
    laut(id);
    await t.walkTo(this.zebraX, 1500, { tempo: 170 });
    if (t.destroyed) return;
    await t.cheer();
    this.after(0.3, () => {
      if (t.destroyed) return;
      t.walkTo(-1500, 1500, { tempo: 260 }).then(() => { if (!t.destroyed) t.destroy({ children: true }); });
    });
    await this.wait(0.6);
    this.bandAufstellen();
  }

  // ---------------------------------------------------------------- 5. Band

  baueBand() {
    const c = new PIXI.Container({ label: 'band' });
    c.x = BAND_MITTE;
    c.zIndex = 28;
    c.visible = false;
    this.welt.addChild(c);
    // zwei Pfosten (rot-weiß) mit Fuß
    for (const sx of [-1, 1]) {
      const p = new PIXI.Graphics();
      p.roundRect(-16, -250, 32, 250, 12).fill(0xf6f1e6);
      for (let i = 0; i < 3; i++) p.rect(-16, -230 + i * 76, 32, 34).fill(0xe0574a);
      p.circle(0, -258, 22).fill(0xf2c74a);
      p.ellipse(0, 0, 54, 16).fill(0x8a8a8a);
      p.position.set(sx * PFOSTEN_X, BAND_Y + 230);
      p.eventMode = 'none';
      c.addChild(p);
    }
    // das Band in zwei Teilen (eigene Bildausschnitte – in aufraeumen() freigegeben)
    const t = tex('baustelle/band');
    const m = meta('baustelle/band');
    const fx0 = t.frame.x;
    const breite = t.frame.width;
    const hoehe = t.frame.height;
    const schnitt = Math.round((BAND_SCHNITT / m.w) * breite);
    this.bandTex = [
      new PIXI.Texture({ source: t.source, frame: new PIXI.Rectangle(fx0, t.frame.y, schnitt, hoehe) }),
      new PIXI.Texture({ source: t.source, frame: new PIXI.Rectangle(fx0 + schnitt, t.frame.y, breite - schnitt, hoehe) }),
    ];
    const s = BAND_S * (m.w / breite);
    const mitteY = (150 / m.h) * hoehe;   // Mitte des Bandes (Bildpunkte, ohne Schleife)
    const links = new PIXI.Sprite(this.bandTex[0]);
    links.anchor.set(0, mitteY / hoehe);
    links.scale.set(s);
    links.position.set(-PFOSTEN_X, BAND_Y);
    const rechts = new PIXI.Sprite(this.bandTex[1]);
    rechts.anchor.set(1, mitteY / hoehe);
    rechts.scale.set(s);
    rechts.position.set(PFOSTEN_X, BAND_Y);
    links.eventMode = 'none';
    rechts.eventMode = 'none';
    c.addChild(links, rechts);
    this.bandL = links;
    this.bandR = rechts;
    this.bandTeile = c;
    // Tippfläche: Antippen oder Durchwischen schneidet
    const f = new PIXI.Container({ label: 'bandFlaeche' });
    f.x = BAND_MITTE;
    f.hitArea = new PIXI.Rectangle(-PFOSTEN_X - 40, BAND_Y - 150, 2 * PFOSTEN_X + 80, 300);
    f.zIndex = 29;
    f.eventMode = 'none';
    f.on('pointerdown', (e) => {
      e.stopPropagation();
      this.schneiden();
    });
    this.welt.addChild(f);
    this.bandFlaeche = f;
  }

  async bandAufstellen() {
    const c = this.bandTeile;
    c.visible = true;
    c.alpha = 0;
    this.bandL.rotation = 0;
    this.bandR.rotation = 0;
    this.bandL.alpha = 1;
    this.bandR.alpha = 1;
    ton('common/plopp', { abstand: 0.2, vol: 0.6 });
    await this.tween(c, { alpha: 1 }, 0.8, { ease: 'sineInOut' });
    // Kipper mit Gästen und ein zweites Fahrzeug rollen heran und warten vor dem Band
    this.setzeGaeste();
    this.zweites = this.beutel.zweite.ziehe();
    const k = this.kipper;
    k.visible = true;
    k.rotation = 0;
    k.x = -1900;
    this.ladungBild.visible = false;
    for (const g of this.gaeste) g.visible = true;
    const v = this.zweitesFahrzeug();
    ton('common/motor', { abstand: 3, vol: 0.55 });
    this.tween(v.obj, { x: WARTEN_ZWEITES[this.zweites] }, 3.4, { ease: 'sineOut', onUpdate: v.dreh });
    await k.fahreZu(WARTEN_KIPPER, 3.0, { ease: 'sineOut' });
    ton('common/hupe', { abstand: 0.6, vol: 0.6 });
    this.bandFlaeche.eventMode = 'static';
    this.phase = 'band';
    this.betreten();
  }

  // zweites Fahrzeug dieser Runde, links außerhalb bereitgestellt → {obj, dreh}
  zweitesFahrzeug() {
    if (this.zweites === 'walze') {
      const w = this.walze;
      w.visible = true;
      w.scale.set(WALZE_S);
      w.position.set(-2300, 1330);
      w.zIndex = 29;
      return { obj: w, dreh: () => { this.trommel.rotation += 0.05; } };
    }
    if (this.zweites === 'rolle') {
      const r = this.rolle;
      r.visible = true;
      r.x = -2300;
      r.y = SPUR - 40;
      r.zIndex = 29;
      return { obj: r, dreh: null };
    }
    const m = this.mischer;
    m.visible = true;
    m.x = -2300;
    return { obj: m, dreh: null };
  }

  // Ruhig nacheinander statt alles auf einmal: (1) das Band sinkt, ein wenig Konfetti, der Sticker kommt;
  // (2) wenn der Stern im Album ist: Band und Pfosten blenden aus, die Zuschauer freuen sich einer nach dem anderen;
  // (3) dann erst fahren alle los; (4) nach der Fahrt kommt ein neuer Zuschauer dazu.
  async schneiden() {
    if (this.phase !== 'band' || !this.aktiv) return;
    this.phase = 'fahrt';
    this.bandFlaeche.eventMode = 'none';
    ton('common/rupf', { abstand: 0.3, vol: 0.8 });
    // die beiden Enden schwingen weich nach unten
    // (nicht zu tief: die Schleife soll nicht über den Seiten-Punkten unten hängen)
    this.tween(this.bandL, { rotation: 0.6 }, 1.1, { ease: 'sineInOut' });
    this.tween(this.bandR, { rotation: -0.3 }, 1.2, { ease: 'sineInOut' });
    this.burst('konfetti', BAND_MITTE, BAND_Y - 120, { count: 16 });
    this.after(0.4, () => ton('common/applaus', { abstand: 2, vol: 0.55 }));
    // belohne() erfüllt sich, wenn der Stern angekommen ist (schon gesammelt: gleich, nach leisem Funkeln)
    await Promise.race([belohne(this, 'baustelle_walze', BAND_MITTE, BAND_Y - 300), this.wait(3.2)]);
    await this.wait(0.4);
    // Band samt Pfosten weich weg (die Fahrzeuge fahren nicht durch die Pfosten)
    this.tween(this.bandTeile, { alpha: 0 }, 1.0, { ease: 'sineInOut' }).then(() => { this.bandTeile.visible = false; });
    this.zuschauer.forEach((z, i) => this.after(0.2 + i * 0.4, () => freuen(this, z, { herzen: 2 })));
    await this.wait(Math.max(1.2, 0.4 + this.zuschauer.length * 0.4));
    this.fahrt();
  }

  // ---------------------------------------------------------------- 6. Fahrt

  baueKolonne() {
    const mischer = new PIXI.Container({ label: 'mischer' });
    this.mischerBild = spr('baustelle/mischer', { parent: mischer });
    mischer.scale.set(0.55);
    mischer.position.set(-1900, SPUR);
    mischer.zIndex = 30;
    mischer.visible = false;
    this.welt.addChild(mischer);
    this.mischer = mischer;
    tap(mischer, () => {
      ton('common/hupe', { abstand: 0.6 });
      fx.wobble(this.mischerBild, 0.03);
    }, { sound: null, pad: 30, squash: false });

    const k = new Fahrzeug({
      koerper: 'baustelle/kipper',
      raeder: [{ tex: 'baustelle/rad_lkw', punkt: 'rad1' }, { tex: 'baustelle/rad_lkw', punkt: 'rad2' }],
      x: -1900, y: SPUR, scale: KIPPER_S, parent: this.welt, z: 31,
    });
    k.visible = false;
    const mk = meta('baustelle/kipper');
    this.muldeY = 330 - mk.ay * mk.h;
    this.muldeHintenX = 30 - mk.ax * mk.w;
    // Schotter in der Mulde (hinter dem Körper: nur der Teil über dem Rand ist zu sehen)
    const lad = spr('baustelle/sand_ladung');
    lad.tint = SCHOTTER_FARBE;
    lad.position.set(mk.pts.mulde[0] - mk.ax * mk.w - 20, 215 - mk.ay * mk.h);
    lad.visible = false;
    k.rumpf.addChildAt(lad, 0);
    this.ladungBild = lad;
    this.gaeste = [];
    this.kipper = k;
    tap(k, () => {
      if (this.phase === 'schotter') {
        this.kipperSchritt({ x: k.x });
        return;
      }
      ton('common/hupe', { abstand: 0.6 });
      for (const g of this.gaeste) if (g.visible) freuen(this, g, { herzen: 3 });
    }, { sound: null, hitArea: new PIXI.Rectangle(-560, -900, 1040, 940) });
  }

  // zwei Tiere mit Helm sitzen in der Mulde (jede Runde andere)
  setzeGaeste() {
    for (const g of this.gaeste) g.destroy({ children: true });
    const mk = meta('baustelle/kipper');
    const paar = GAESTE[this.beutel.gaeste.ziehe()];
    this.gaeste = [
      helmTier(paar[0], { x: 160 - mk.ax * mk.w, y: this.muldeY, scale: 0.42 }),
      helmTier(paar[1], { x: 400 - mk.ax * mk.w, y: this.muldeY, scale: 0.4 }),
    ];
    for (const g of this.gaeste) {
      g.eventMode = 'none';
      this.kipper.rumpf.addChildAt(g, 0);
    }
  }

  async fahrt() {
    const k = this.kipper;
    const v = this.zweites === 'walze' ? { obj: this.walze, dreh: () => { this.trommel.rotation += 0.05; } }
      : this.zweites === 'rolle' ? { obj: this.rolle, dreh: null } : { obj: this.mischer, dreh: null };
    ton('common/motor', { abstand: 3, vol: 0.6 });
    this.after(0.3, () => ton('common/hupe', { abstand: 0.6 }));
    // die Gäste jubeln, wenn der Kipper gut im Bild ist
    this.after(2.2, () => {
      ton('common/hupe', { abstand: 0.6 });
      for (const g of this.gaeste) freuen(this, g, { herzen: 3 });
    });
    this.tween(v.obj, { x: 1950 }, 7.4, { ease: 'sineInOut', onUpdate: v.dreh });
    await k.fahreZu(1950, 6.2, { ease: 'sineInOut' });
    await this.wait(1.3);
    k.visible = false;
    v.obj.visible = false;
    // jetzt ist die Straße ruhig: ein neuer Zuschauer kommt dazu (bis fünf). Er läuft noch, während der nächste
    // Kipper hereinrollt – das sind höchstens zwei Bewegungen zugleich.
    this.neuerZuschauer();
    // Rolle und Walze wieder an ihre Arbeitsplätze
    this.rolle.y = LINIE_Y - this.duese.y;
    this.rolle.zIndex = 25;
    this.walze.zIndex = 20;
    await this.wait(1.2);
    await this.neueRunde(true);
  }

  // ---------------------------------------------------------------- Zuschauer am Wegrand

  baueZuschauer() {
    this.zuschauer = [];
    const n = clamp(Number(store.get(ZUSCHAUER_KEY, 0)) || 0, 0, ZUSCHAUER.length);
    for (let i = 0; i < n; i++) this.zuschauer.push(this.macheZuschauer(i, ZUSCHAUER[i].x));
  }

  macheZuschauer(i, x) {
    const z = ZUSCHAUER[i];
    const t = new Actor(z.tier, { x, y: ZUSCHAUER_Y, scale: ZUSCHAUER_S, parent: this.welt, z: 4.5 });
    t.onTap(() => freuen(this, t, { herzen: 2 }), { pad: TIER_PAD });
    if (x === z.x) t.lookAt(0);   // zur Straßenmitte schauen
    return t;
  }

  async neuerZuschauer() {
    const i = this.zuschauer.length;
    if (i >= ZUSCHAUER.length) return;
    store.set(ZUSCHAUER_KEY, i + 1);
    const z = ZUSCHAUER[i];
    const t = this.macheZuschauer(i, z.x < 0 ? -1500 : 1500);
    this.zuschauer.push(t);
    await t.walkTo(z.x, ZUSCHAUER_Y, { tempo: 240 });
    if (t.destroyed) return;
    t.lookAt(0);
    freuen(this, t, { herzen: 2 });
  }

  // ---------------------------------------------------------------- Takt und Hinweise

  update(dt, t) {
    this.t = t;
    // Finger liegt still oder sein pointerup ging verloren: nach einer Weile gilt er als losgelassen
    if (this.finger !== null && (this.fingerRuht += dt) > FINGER_VERGESSEN) this.finger = null;
    this.wolken.update(dt);
    this.schmetterling.update(dt);
    this.bewegeKipper(dt);
    if (this.schotterAus) {
      // beim Hinausfahren lädt der Kipper bis zum rechten Rand ab
      const h = this.kipperHinten();
      if (h > this.schotterBis + 15) {
        this.schotterBis = h;
        this.decke.zeigeBis(h);
        this.schotterRieselt(dt);
      }
    }
    this.bewegeWalze(dt);
    this.bewegeRolle(dt);
    this.kipper.update(dt);
    // der Mischer federt beim Fahren ganz leicht
    if (this.mischer.visible) this.mischerBild.y = Math.sin(t * 7) * 3;
  }

  hinweise() {
    if (this.phase === 'schotter') {
      // vor dem Kipper auf der Straße ansetzen und nach rechts schieben (auf dem Kipper selbst gäbe ein Antippen nur
      // einen Schritt). Start als Anzeige-Objekt: Einen reinen Punkt als Start zeigt der Kern nicht.
      const k = this.kipper;
      const x = clamp(k.x + 300, -1000, 900);
      return [{ von: this.handStart.bei(x, SPUR - 130), nach: { x: clamp(x + 700, -400, 1150), y: SPUR - 130 } }];
    }
    if (this.phase === 'walzen') {
      // von der Walze zum nächsten Rest der Holperdecke
      const p = this.walzOrt();
      const d = this.decke;
      let best = null;
      let bestAbstand = Infinity;
      for (const z of d.zellen) {
        if (z.weg) continue;
        const a = Math.hypot(z.x + d.x - p.x, z.y + d.y - p.y);
        if (a < bestAbstand) { bestAbstand = a; best = z; }
      }
      if (!best) return [{ von: this.trommel, nach: { x: p.x < 0 ? p.x + 700 : p.x - 700, y: p.y } }];
      const nach = { x: best.x + d.x, y: clamp(best.y + d.y, 1150, 1360) };
      // einen langen Strich zeigen: in Richtung des nächsten Rests bis zum letzten Rest in derselben Zeile (wer der
      // Hand folgt, walzt so eine ganze Bahn auf einmal statt kleiner Stücke)
      const richtung = nach.x < p.x ? -1 : 1;
      for (const z of d.zellen) {
        if (z.weg || Math.abs(z.y + d.y - (best.y + d.y)) > 60) continue;
        const zx = z.x + d.x;
        if ((zx - nach.x) * richtung > 0) nach.x = zx;
      }
      // liegt der Rest fast unter der Walze: ein Stück weiter hinüber zeigen (sonst sieht man keine Bewegung)
      if (Math.abs(nach.x - p.x) < 250) nach.x = p.x + richtung * 250;
      nach.x = clamp(nach.x, -1000, 1000);
      return [{ von: this.trommel, nach }];
    }
    if (this.phase === 'malen') {
      const q = this.naechsterStrich();
      const ziel = q ? q.b : this.rolle.x + 700;
      return [{ von: this.rolle, nach: { x: clamp(ziel, -1000, 1000), y: LINIE_Y } }];
    }
    if (this.phase === 'zebra') {
      const z = this.zebra[Math.min(this.zebraNr, ZEBRA_N - 1)];
      return [{ x: z.x, y: LINIE_Y }];
    }
    if (this.phase === 'band') return [{ x: BAND_MITTE - 120, y: BAND_Y }];
    // Wechsel und Fahrt: auf den Spatz, der still sitzt. Nicht auf fahrende Autos – die Hand merkt sich ihr Ziel beim
    // Erscheinen und tippt dann auf die leere Straße hinter dem längst weitergefahrenen Auto.
    return [this.spatz.c];
  }

  /** Von der Szene in exit() gerufen: RenderTexture und Bildausschnitte freigeben. */
  aufraeumen() {
    window.removeEventListener('pointermove', this._bewegt);
    window.removeEventListener('pointerup', this._los);
    window.removeEventListener('pointercancel', this._los);
    window.removeEventListener('blur', this._alleLos);
    this.decke?.zerstoere();
    if (this.bandL && !this.bandL.destroyed) this.bandL.texture = PIXI.Texture.EMPTY;
    if (this.bandR && !this.bandR.destroyed) this.bandR.texture = PIXI.Texture.EMPTY;
    for (const t of this.bandTex || []) t.destroy(false);
    this.bandTex = null;
  }
}
