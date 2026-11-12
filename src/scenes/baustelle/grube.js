// Seite 1 – Baggern (hg_grube).
// Ablauf einer Runde („Der Bagger hilft suchen"):
//   1. Ein Besucher kommt von rechts und zeigt in einer Denkblase, was er verloren hat (Knochen, Nuss, Ball …).
//   2. Tipp auf den Sandberg (oder den Bagger, oder den Arm ziehen): Der Bagger schaufelt Sand in den Kipper.
//   3. Nach zwei Schaufeln guckt das Verlorene aus dem Sandberg. Antippen → der Bagger gräbt es aus und legt es
//      vor sich ab.
//   4. Das Fundstück zum Besucher ziehen (oder antippen: es hüpft hin) → der Besucher freut sich.
//   5. Weiter schaufeln, bis der Kipper voll ist; voll → er hupt. Antippen → er fährt zur Abladestelle.
//   6. Den Kipper festhalten (oder mehrmals antippen): Er kippt Stück für Stück, der Sand rutscht hinaus.
//   7. Geschafft: Sticker, ein neuer Wimpel an der Kette am Zaun (wächst über die Runden), der Besucher winkt und
//      geht mit seinem Fundstück; der Kipper rollt leer zurück, der nächste Besucher kommt.
// Die Reihenfolge von 4 und 5/6 ist frei – nichts kann falsch gemacht werden. Zwei Tiere mit Bauhelm schauen zu.

import { spr, meta, hasTex, voice, fx, tap, drag, hold, Actor, PIXI, rand, pick, clamp, ease } from '../../engine/index.js';
import { Seite } from '../../gemeinsam/seiten.js';
import { Fahrzeug } from '../../gemeinsam/zug.js';
import { belohne } from '../../gemeinsam/sticker.js';
import { Wolken, Schmetterling, Spatz, helmTier, freuen, ton, laut, Beutel, Wimpelkette } from './deko.js';

const BAGGER_S = 0.62;          // Bagger-Körper
const ARM_S = 0.55;             // Bagger-Arm (Reichweite ≈ 450)
const KIPPER_S = 0.62;
const BAGGER_X = 35;            // so weit rechts, dass der Arm Sandberg und Kipper erreicht (Punkt 'bagger' liegt zu weit links)
const GRABEN = { x: -600, y: 990 };   // in den Sandberg (Oberfläche dort ≈ 965)
const STUFEN = 4;
const KIPP_X = 860;             // hier kippt der Kipper ab (noch ganz im Bild)
const KIPP_WINKEL = -0.12;      // Neigung beim Abkippen (Schnauze hoch, hinten bleibt am Boden)
const KIPP_DAUER = 1.5;         // so lange festhalten, bis er ganz gekippt ist (Tippen hilft auch)

// Arm: Gelenk und Schaufel in Bildpunkten des Arm-Bilds
const ARM = { gx: 825, gy: 105, sx: 150, sy: 520 };
const SCHAUFEL_WINKEL = Math.atan2(ARM.sy - ARM.gy, ARM.sx - ARM.gx);

// Haltungen des Arms (Drehung; + = Schaufel höher)
const RUHE = 0.55;
const TRAGEN = 0.95;
const ARM_MIN = 0.45;           // beim Ziehen: so weit hinunter …
const ARM_MAX = 1.1;            // … und so weit hinauf

// Dauer der Schritte einer Schaufel-Runde (zusammen ≈ 3,5 s; ruhig, aber nicht zäh)
const T_DREH = 0.7;
const T_ARM = 0.5;

// Besucher und was sie verloren haben (Bilder aus common/zug – immer geladen)
const BESUCHER = [
  { tier: 'hund', ding: 'common/futter_knochen' },
  { tier: 'eichhoernchen', ding: 'common/futter_nuss' },
  { tier: 'maus', ding: 'common/futter_kaese' },
  { tier: 'hase', ding: 'common/futter_karotte' },
  { tier: 'baer', ding: 'common/futter_honig' },
  { tier: 'katze', ding: 'zug/ladung_ball' },
  { tier: 'schaf', ding: 'zug/ladung_teddy' },
  { tier: 'frosch', ding: 'zug/ladung_geschenk' },
];
export const GRUBE_TIERE = ['affe', 'pinguin', ...BESUCHER.map((b) => b.tier)];
const BESUCH = { x: 690, y: 1468, scale: 0.29 };
// Wo das Verlorene aus dem Sandberg guckt: oben auf dem freien Hang – nicht hinter dem Baggerarm (der ruht bei
// x > -700, y > 940) und nicht hinter dem Baustellen-Schild (x -450 … -310, y 755 … 935). Die Schaufel reicht nicht
// ganz hinauf: Beim Ausgraben hüpft das Ding ihr entgegen.
const FUND_ORTE = [{ x: -700, y: 950 }, { x: -800, y: 885 }, { x: -905, y: 820 }];
const ABLAGE = { x: 175, y: 1392 };    // hier legt der Bagger das Fundstück ab
const DING_GROESSE = 170;

export class Grube extends Seite {
  static hg = 'baustelle/hg_grube';

  aufbau() {
    const boden = this.boden;   // 1250
    this.wolken = new Wolken(this, { anzahl: 2 });
    this.schmetterling = new Schmetterling(this, { bereich: { x: -250, y: 470, w: 900, h: 240 }, farbe: 0xb9a4f0 });
    this.spatz = new Spatz(this, { x: 190, y: 742, flip: true, z: 4 });
    this.kette = new Wimpelkette(this, {
      punkte: [{ x: -114, y: 708 }, { x: 246, y: 708 }, { x: 606, y: 708 }, { x: 976, y: 708 }],
      jeBogen: 4, key: 'baustelle.wimpel', z: 3.5,
    });

    this.ladung = 0;          // 0 … STUFEN (Sand im Kipper)
    this.laeuft = false;      // Bagger arbeitet gerade eine Runde
    this.vorgemerkt = 0;      // so viele Schaufeln kommen nach der laufenden noch
    this.kipperZustand = 'da';  // 'da' | 'faehrt' | 'kippbereit' | 'kippt' | 'zurueck'
    this.kippP = 0;           // 0 … 1: wie weit der Kipper gekippt ist
    this.kipperPuls = null;
    this.inSchaufel = false;  // eine Schaufel ist zwischen Sandberg und Kipper unterwegs
    this.armGezogen = false;  // ein Finger hält den Arm
    this.armZiel = RUHE;
    this._p = new PIXI.Point();
    this._q = new PIXI.Point();
    // (die Spielsachen liegen im Zug-Paket – das ist geladen, wenn das Kind über die Karte kommt; ob ein Bild da ist,
    // prüft jeder Besuch neu, siehe neuerBesucher)
    this.besucherBeutel = new Beutel(BESUCHER);
    this.ortBeutel = new Beutel(FUND_ORTE);
    this.besuch = null;
    this.schaufelnRunde = 0;  // Sand-Schaufeln seit Beginn des Besuchs

    this.baueSandberg();
    this.baueBagger(boden);
    this.baueKipper(boden);
    this.baueDinge(boden);
    this.baueTiere();
    this.after(1.2, () => this.neuerBesucher());
  }

  betreten() {
    // Hinweis bei jedem Betreten anmelden (der Kern sagt ihn höchstens einmal am Tag) – aber nur, solange die Seite
    // zu sehen ist und das Kind noch nicht selbst gebaggert hat (die Zeitgeber laufen beim Wegblättern weiter)
    this._hinweis?.kill();
    this._hinweis = null;
    if (this.gebaggert) return;
    const passt = () => this.aktiv && !this.gebaggert;
    this._hinweis = this.after(4, () => { if (passt()) voice('baustelle_bagger', { nurWenn: passt }); });
  }

  verlassen() {
    this.vorgemerkt = 0;
    this._hinweis?.kill();
    this._hinweis = null;
  }

  // ---------------------------------------------------------------- Sandberg

  baueSandberg() {
    // unsichtbare Tippfläche über dem Sandberg (der ist Teil des Hintergrunds) – bis zum linken Bildrand
    const s = new PIXI.Container({ label: 'sandberg' });
    s.hitArea = new PIXI.Polygon([-1300, 520, -990, 600, -760, 700, -560, 880, -380, 1060, -380, 1250, -1300, 1250]);
    s.zIndex = 1;
    this.welt.addChild(s);
    tap(s, (e) => {
      // Sand rieselt – aber nicht übereinander, wenn das Kind schnell hintereinander tippt
      if (ton('common/sand', { abstand: 0.8, vol: 0.7 })) this.burst('staub', e.x, e.y, { count: 3 });
      this.schaufeln();
    }, { sound: null, squash: false });
    this.sandberg = s;
  }

  // ---------------------------------------------------------------- Bagger

  baueBagger(boden) {
    const b = new PIXI.Container({ label: 'bagger' });
    b.position.set(BAGGER_X, boden);
    b.zIndex = 20;
    this.welt.addChild(b);
    // dreh: spiegelt beim Umdrehen (scale.x von +1 nach -1) – Blick nach links = +1
    const dreh = new PIXI.Container({ label: 'baggerDreh' });
    b.addChild(dreh);
    const k = spr('baustelle/bagger_koerper', { parent: dreh });
    k.scale.set(BAGGER_S);
    const mk = meta('baustelle/bagger_koerper');
    const gelenk = { x: (mk.pts.gelenk[0] - mk.ax * mk.w) * BAGGER_S, y: (mk.pts.gelenk[1] - mk.ay * mk.h) * BAGGER_S };

    const arm = spr('baustelle/bagger_arm', { parent: dreh });
    const ma = meta('baustelle/bagger_arm');
    arm.anchor.set(ARM.gx / ma.w, ARM.gy / ma.h);
    arm.scale.set(ARM_S);
    arm.position.set(gelenk.x, gelenk.y);
    arm.rotation = RUHE;

    // Sand in der Schaufel (Kind des Arms, bleibt beim Schwenken aufrecht)
    const klumpen = spr('baustelle/sand_klumpen', { parent: arm });
    klumpen.scale.set(0.62);
    klumpen.position.set(ARM.sx - ARM.gx + 10, ARM.sy - ARM.gy - 40);
    klumpen.visible = false;

    this.bagger = b;
    this.dreh = dreh;
    this.arm = arm;
    this.klumpen = klumpen;
    this.gelenk = gelenk;
    this.blick = 1;   // +1 = links (zum Sandberg), -1 = rechts (zum Kipper)

    // Antippen des Baggers startet ebenfalls eine Schaufel. (Die Tippfläche liegt auf dem Körper, nicht auf dem
    // ganzen Bagger: eine Fläche am Container würde den Arm abschneiden, wenn er über den Rand hinausragt.)
    tap(k, () => this.schaufeln(), { sound: 'common/tipp', pad: 30, squash: false });
    this.baueArmZiehen();
  }

  // Arm ziehen: Solange der Finger hält (und der Bagger nichts zu tun hat), folgt die Schaufel dem Finger weich
  // nach oben/unten. Loslassen (oder nur antippen) → der Bagger schaufelt.
  baueArmZiehen() {
    const arm = this.arm;
    // Ort des Fingers beim Greifen (eigener Hörer vor dem Ziehen des Kerns – beide hören auf dasselbe pointerdown)
    arm.on('pointerdown', (e) => {
      this._armStart = this.welt.toLocal(e.global);
      this._armStartX = arm.x;
      this._armStartY = arm.y;
    });
    drag(arm, {
      lift: 1,
      back: false,
      pad: 30,
      sound: 'common/tipp',
      onStart: () => {
        this.armGezogen = !this.laeuft && this.blick === 1;
        this.armZiel = arm.rotation;
      },
      onMove: () => {
        // Das Ziehen des Kerns verschiebt den Arm – wir nehmen nur die Fingerstelle und lassen ihn am Gelenk
        const dx = arm.x - this._armStartX;
        const dy = arm.y - this._armStartY;
        arm.position.set(this.gelenk.x, this.gelenk.y);
        if (!this.armGezogen || this.laeuft || !this._armStart) return;
        const f = { x: this._armStart.x + dx * this.blick, y: this._armStart.y + dy };
        this.armZiel = clamp(this.armWinkel(f, 1), ARM_MIN, ARM_MAX);
      },
      onDrop: () => {
        arm.position.set(this.gelenk.x, this.gelenk.y);
        this.armGezogen = false;
        this.schaufeln();
        return undefined;
      },
    });
  }

  // Drehung des Arms, damit die Schaufel auf einen Punkt (Seiten-Koordinaten) zeigt – bei gegebener Blickrichtung
  armWinkel(ziel, blick) {
    const lx = (ziel.x - this.bagger.x) * blick - this.gelenk.x;
    const ly = ziel.y - this.bagger.y - this.gelenk.y;
    // in den Bereich -π … π bringen, sonst dreht sich der Arm einmal ganz herum
    let w = Math.atan2(ly, lx) - SCHAUFEL_WINKEL;
    while (w > Math.PI) w -= Math.PI * 2;
    while (w < -Math.PI) w += Math.PI * 2;
    return w;
  }

  // Schaufel-Spitze in Seiten-Koordinaten (für Teilchen) – in `aus` geschrieben
  schaufelOrt(aus) {
    this._p.set(ARM.sx - ARM.gx, ARM.sy - ARM.gy - 30);
    return this.welt.toLocal(this._p, this.arm, aus);
  }

  async drehe(blick) {
    if (this.blick === blick) return true;
    this.blick = blick;
    ton('common/kran', { abstand: 1.5, vol: 0.45, rate: 0.8 });
    return this.tween(this.dreh, { scaleX: blick }, T_DREH, { ease: 'sineInOut' });
  }

  // Kleine Antwort, wenn der Bagger gerade nicht (noch einmal) schaufeln kann: er nickt
  nicke() {
    fx.wobble(this.dreh, 0.025);
  }

  fundGuckt() {
    return this.besuch?.dingPhase === 'guckt';
  }

  /** Wunsch nach einer Schaufel (vom Sandberg, vom Bagger, vom Arm, vom Fundstück). */
  schaufeln() {
    this.gebaggert = true;   // das Kind hat es gefunden: kein Bagger-Hinweis mehr nötig
    const fund = this.fundGuckt();
    const frei = STUFEN - this.ladung - (this.inSchaufel ? 1 : 0) - this.vorgemerkt;
    if (this.laeuft) {
      // während der Arbeit: vormerken, solange noch etwas in den Kipper passt (oder ein Fundstück wartet)
      if (frei > 0 || (fund && this.vorgemerkt === 0)) this.vorgemerkt++;
      this.nicke();
      return;
    }
    if (frei <= 0 && !fund) {
      // Kipper ist voll: einmal hupen (die Hand zeigt ohnehin auf ihn) – kein Schaufeln, kein Warten
      if (this.kipperZustand === 'da') this.kipperHupt(false);
      else this.nicke();
      return;
    }
    this.runde();
  }

  // Arbeit des Baggers: Schaufel um Schaufel, solange etwas vorgemerkt ist, dann zurück in die Ruhe
  async runde() {
    this.laeuft = true;
    const weiter = () => this.vorgemerkt > 0 && (this.ladung < STUFEN || this.fundGuckt());
    try {
      for (;;) {
        if (this.fundGuckt()) await this.fundSchaufel();
        else if (this.ladung < STUFEN) await this.eineSchaufel();
        if (weiter()) { this.vorgemerkt--; continue; }
        this.tween(this.arm, { rotation: RUHE }, T_DREH, { ease: 'sineInOut' });
        await this.drehe(1);
        // (auch während des Zurückdrehens getippt? dann gleich weiter)
        if (weiter()) { this.vorgemerkt--; continue; }
        break;
      }
      this.vorgemerkt = 0;
    } finally {
      this.laeuft = false;
      this.inSchaufel = false;
    }
  }

  async eineSchaufel() {
    this.inSchaufel = true;
    // 1. zum Sandberg drehen, Arm hinunter, schaufeln
    if (this.blick !== 1) {
      this.tween(this.arm, { rotation: RUHE }, T_DREH, { ease: 'sineInOut' });
      await this.drehe(1);
    }
    ton('common/graben', { abstand: 0.8 });
    await this.tween(this.arm, { rotation: this.armWinkel(GRABEN, 1) }, T_ARM, { ease: 'sineInOut' });
    const s = this.schaufelOrt();
    this.burst('staub', s.x, s.y + 20, { count: 4 });
    this.klumpen.visible = true;
    this.klumpen.scale.set(0.2);
    this.tween(this.klumpen, { scale: 0.62 }, 0.3, { ease: 'backOut' });
    ton('common/sand', { abstand: 0.8, vol: 0.8 });
    await this.wait(0.2);
    // 2. anheben
    await this.tween(this.arm, { rotation: TRAGEN }, T_ARM, { ease: 'sineInOut' });
    // 3. ist der Kipper gerade unterwegs, wartet der Bagger mit erhobener Schaufel (er kommt leer zurück)
    while (this.kipperZustand !== 'da') await this.wait(0.3);
    // 4. zum Kipper drehen, über die Mulde schwenken, auskippen
    await this.drehe(-1);
    const mulde = this.muldeOrt();
    const ueber = { x: mulde.x, y: mulde.y - 150 };
    await this.tween(this.arm, { rotation: this.armWinkel(ueber, -1) }, T_ARM, { ease: 'sineInOut' });
    await this.abladen(mulde);
    // 5. Arm hoch (aus der Mulde heraus) – zurückdrehen macht die nächste Schaufel bzw. runde()
    await this.tween(this.arm, { rotation: TRAGEN }, 0.35, { ease: 'sineInOut' });
  }

  async abladen(mulde) {
    // Klumpen fällt aus der Schaufel in die Mulde
    const von = this.welt.toLocal(new PIXI.Point(0, 0), this.klumpen);
    this.klumpen.visible = false;
    const f = this.fallKlumpen;
    f.visible = true;
    f.alpha = 1;
    f.position.set(von.x, von.y);
    f.scale.set(0.62 * ARM_S);
    ton('common/sand', { abstand: 0.8 });
    this.tween(this.arm, { rotation: this.arm.rotation - 0.25 }, 0.3, { ease: 'sineInOut' });
    await this.tween(f, { x: mulde.x, y: mulde.y + 10 }, 0.4, { ease: 'quadIn' });
    this.tween(f, { alpha: 0 }, 0.25, { ease: 'sineInOut' }).then(() => { f.visible = false; });
    this.burst('staub', mulde.x, mulde.y - 10, { count: 4 });
    this.inSchaufel = false;
    this.setzeLadung(this.ladung + 1);
    this.schaufelnRunde++;
    this.pruefeFund();
    if (this.ladung >= STUFEN) this.after(0.4, () => this.kipperHupt(true));
  }

  // ---------------------------------------------------------------- Besucher und Fundstück

  async neuerBesucher() {
    if (this.besuch) return;
    let def = this.besucherBeutel.ziehe();
    // fehlt ein Bild (Paket nicht geladen), den nächsten aus dem Beutel nehmen
    for (let i = 0; i < BESUCHER.length && !hasTex(def.ding); i++) def = this.besucherBeutel.ziehe();
    if (!hasTex(def.ding)) def = BESUCHER[0];
    const tier = new Actor(def.tier, { x: 1480, y: BESUCH.y, scale: BESUCH.scale, parent: this.welt, z: 46 });
    const b = { def, tier, dingPhase: 'versteckt', ding: null, lippe: null, gekippt: false, geht: false };
    this.besuch = b;
    tier.onTap(() => this.besucherGetippt(b));
    tier._unterwegs = true;
    while (!tier.destroyed && !(await tier.walkTo(BESUCH.x, BESUCH.y, { tempo: 300 }))) await this.wait(0.3);
    if (tier.destroyed) return;
    tier._unterwegs = false;
    this.zeigeWunsch(b);
    const passt = () => this.aktiv && this.besuch === b && b.dingPhase !== 'gegeben';
    voice('baustelle_suchen', { nurWenn: passt });
    this.pruefeFund();
  }

  zeigeWunsch(b) {
    if (b.tier.destroyed || b.dingPhase === 'gegeben') return;
    b.tier.bubble(b.def.ding, 2.6, { seite: 'links' });
  }

  besucherGetippt(b) {
    laut(b.tier.tierId);
    if (b.tier._unterwegs || b.geht) {
      fx.wobble(b.tier, 0.05);
      return;
    }
    if (b.dingPhase === 'gegeben') b.tier.cheer({ parent: this.vorn });
    else {
      fx.wobble(b.tier, 0.05);
      if (!b.tier._blase) this.zeigeWunsch(b);
    }
  }

  // Nach zwei Schaufeln guckt das Verlorene aus dem Sandberg
  pruefeFund() {
    const b = this.besuch;
    if (!b || b.tier._unterwegs || b.dingPhase !== 'versteckt' || this.schaufelnRunde < 2) return;
    b.dingPhase = 'guckt';
    const ort = this.ortBeutel.ziehe();
    b.ort = ort;
    const d = spr(b.def.ding, { parent: this.welt });
    d.anchor.set(0.5);
    const m = meta(b.def.ding);
    d.groesse = DING_GROESSE / Math.max(m.w, m.h);
    // Tippfläche fest (das Ding ploppt aus winziger Größe auf – sonst würde sie riesig)
    // (mindestens 240 Einheiten je Richtung, auch für flache Dinge wie den Knochen)
    const px = Math.max(45 / d.groesse, (240 / d.groesse - m.w) / 2);
    const py = Math.max(45 / d.groesse, (240 / d.groesse - m.h) / 2);
    d.flaeche = new PIXI.Rectangle(-m.w / 2 - px, -m.h / 2 - py, m.w + 2 * px, m.h + 2 * py);
    d.position.set(ort.x, ort.y - 75);
    d.rotation = -0.3;
    d.zIndex = 2;
    d.scale.set(0.01);
    const lippe = spr('baustelle/sand_klumpen', { parent: this.welt });
    lippe.scale.set(0.62);
    lippe.position.set(ort.x + 10, ort.y + 30);
    lippe.zIndex = 2.5;
    lippe.eventMode = 'none';
    b.ding = d;
    b.lippe = lippe;
    ton('common/plopp', { abstand: 0.2 });
    this.tween(d, { scale: d.groesse }, 0.5, { ease: 'backOut' });
    this.burst('funkeln', ort.x, ort.y - 60, { count: 3 });
    // Antippen: der Bagger gräbt es aus (wie ein Tipp auf den Sandberg)
    b.dingTap = tap(d, () => this.schaufeln(), { sound: 'common/tipp', hitArea: d.flaeche, squash: false });
    // ab und zu ein kleines Wackeln und Funkeln: „hier bin ich"
    b.wackler = this.every(2.4, () => {
      if (!this.aktiv || b.dingPhase !== 'guckt' || d.destroyed) return;
      this.tween(d, { rotation: -0.12 }, 0.25, { ease: 'sineInOut' })
        .then(() => this.tween(d, { rotation: -0.3 }, 0.35, { ease: 'sineInOut' }));
      this.burst('funkeln', d.x + rand(-40, 40), d.y - 50, { count: 2 });
    });
  }

  async fundSchaufel() {
    const b = this.besuch;
    const d = b.ding;
    b.dingPhase = 'graben';
    b.wackler?.kill();
    b.dingTap?.off();
    d.eventMode = 'none';
    if (this.blick !== 1) {
      this.tween(this.arm, { rotation: RUHE }, T_DREH, { ease: 'sineInOut' });
      await this.drehe(1);
    }
    ton('common/graben', { abstand: 0.8 });
    // Arm so weit wie möglich zum Fundstück hinauf (oben am Hang reicht die Schaufel nicht ganz hin)
    await this.tween(this.arm, { rotation: clamp(this.armWinkel(b.ort, 1), ARM_MIN, ARM_MAX) }, T_ARM + 0.1, { ease: 'sineInOut' });
    // das Fundstück hüpft aus dem Sand in die Schaufel; die Sandlippe sinkt weg
    this.burst('staub', b.ort.x, b.ort.y - 20, { count: 5 });
    ton('common/rupf', { abstand: 0.3, vol: 0.8 });
    b.dingPhase = 'hinein';
    d.zIndex = 50;
    this.tween(d, { rotation: 0 }, 0.3, { ease: 'sineInOut' });
    this.tween(b.lippe, { alpha: 0, scaleY: 0.3 }, 0.6, { ease: 'sineInOut' }).then(() => b.lippe?.destroy());
    b.lippe = null;
    const s = this.schaufelOrt(this._q);
    await this.bogen(d, s.x, s.y - 30, 0.55, 90);
    // jetzt liegt es in der Schaufel (update hält es dort)
    b.dingPhase = 'schaufel';
    await this.wait(0.15);
    await this.tween(this.arm, { rotation: TRAGEN + 0.1 }, T_ARM + 0.1, { ease: 'sineInOut' });
    this.burst('funkeln', d.x, d.y - 40, { count: 4 });
    ton('common/funkeln', { abstand: 0.5, vol: 0.6 });
    await this.wait(0.35);
    // hüpft im Bogen vor den Bagger
    b.dingPhase = 'fliegt';
    this.tween(this.arm, { rotation: this.arm.rotation - 0.2 }, 0.3, { ease: 'sineInOut' });
    await this.bogen(d, ABLAGE.x, ABLAGE.y - 80, 0.8, 260);
    ton('common/plopp', { abstand: 0.15 });
    this.burst('staub', ABLAGE.x, ABLAGE.y, { count: 3 });
    fx.pop(d, 0.08);
    b.dingPhase = 'liegt';
    d.eventMode = 'static';
    d.zIndex = 48;
    this.macheDingZiehbar(b);
    for (const t of this.tiere) this.after(rand(0, 0.4), () => freuen(this, t, { herzen: 2 }));
  }

  // Ding im Bogen nach (x, y) bewegen (Höhe des Bogens h) → Promise
  bogen(d, x, y, dauer, h) {
    const x0 = d.x;
    const y0 = d.y;
    const p = { t: 0 };
    return this.tween(p, { t: 1 }, dauer, {
      ease: 'linear',
      onUpdate: () => {
        if (d.destroyed) return;
        const e = ease.sineInOut(p.t);
        d.x = x0 + (x - x0) * e;
        d.y = y0 + (y - y0) * e - h * 4 * p.t * (1 - p.t);
      },
    });
  }

  macheDingZiehbar(b) {
    const d = b.ding;
    b.dingZiehen = drag(d, {
      lift: 1.12,
      hitArea: d.flaeche,
      targets: () => [{ x: b.tier.x, y: b.tier.y - 120, radius: 340 }],
      onStart: () => { b.tier.lookAt(d.x); },
      onDrop: (ziel, ctx) => {
        const weg = Math.hypot(ctx.x - ctx.startX, ctx.y - ctx.startY);
        if (ziel || (weg < 30 && !ctx.cancelled)) {
          ctx.erledigt = true;
          this.gib(b);
          return undefined;
        }
        return undefined;   // gleitet von selbst zurück
      },
    });
  }

  async gib(b) {
    if (b.dingPhase !== 'liegt') return;
    b.dingPhase = 'gegeben';
    b.dingZiehen?.off();
    const d = b.ding;
    d.eventMode = 'none';
    d.zIndex = 47;
    await this.bogen(d, b.tier.x - 95, b.tier.y - 45, 0.6, 140);
    if (d.destroyed || b.tier.destroyed) return;
    ton('common/plopp', { abstand: 0.15 });
    b.tier.lookAt(b.tier.x - 100);
    b.tier.cheer({ parent: this.vorn });
    // Das Fundstück bleibt beim Besucher: ein Antippen freut ihn noch einmal
    d.eventMode = 'static';
    tap(d, () => this.besucherGetippt(b), { sound: null, hitArea: d.flaeche });
    this.pruefeRunde();
  }

  pruefeRunde() {
    const b = this.besuch;
    if (!b || b.geht || b.dingPhase !== 'gegeben' || !b.gekippt) return;
    b.geht = true;
    this.feiern(b);
  }

  async feiern(b) {
    await this.wait(0.6);
    belohne(this, 'baustelle_kipper', 120, 980);
    const w = this.kette.neuerWimpel();
    if (w) {
      ton('common/plopp', { abstand: 0.2 });
      this.burst('funkeln', w.x, w.y + 30, { count: 4 });
    }
    for (const t of this.tiere) this.after(rand(0.1, 0.5), () => freuen(this, t, { herzen: 3 }));
    await this.wait(1.4);
    if (b.tier.destroyed) return;
    b.tier.cheer({ parent: this.vorn });
    await this.wait(1.3);
    // geht mit seinem Fundstück nach rechts hinaus (update führt das Ding mit)
    b.tier._unterwegs = true;
    b.mitnehmen = true;
    while (!b.tier.destroyed && !(await b.tier.walkTo(1520, BESUCH.y, { tempo: 280 }))) await this.wait(0.3);
    b.tier.destroy({ children: true });
    if (b.ding && !b.ding.destroyed) b.ding.destroy();
    if (this.besuch === b) this.besuch = null;
    this.schaufelnRunde = this.ladung;
    await this.wait(1.2);
    this.neuerBesucher();
  }

  // ---------------------------------------------------------------- Kipper

  baueKipper(boden) {
    const p = this.punkt('kipper', { x: 735, y: boden });
    this.kipperX = p.x - 60;   // etwas weiter links als der Punkt: sonst stößt die Schnauze an den Blätter-Pfeil
    this.kipperY = boden;
    const k = new Fahrzeug({
      koerper: 'baustelle/kipper',
      raeder: [{ tex: 'baustelle/rad_lkw', punkt: 'rad1' }, { tex: 'baustelle/rad_lkw', punkt: 'rad2' }],
      x: this.kipperX, y: boden, scale: KIPPER_S, parent: this.welt, z: 15,
    });
    this.kipper = k;
    // Ladung hinter dem Körper: nur der Teil über dem Muldenrand ist zu sehen
    const mk = meta('baustelle/kipper');
    const lad = spr('baustelle/sand_ladung');
    this.ladungRuhe = { x: mk.pts.mulde[0] - mk.ax * mk.w - 20, y: 215 - mk.ay * mk.h };
    lad.position.set(this.ladungRuhe.x, this.ladungRuhe.y);
    lad.visible = false;
    k.rumpf.addChildAt(lad, 0);
    this.ladungBild = lad;
    // Hinterrad (dort bleibt der Kipper beim Neigen am Boden) und obere hintere Ecke der Mulde (dort rutscht der
    // Sand hinaus), beides in Koordinaten des Körper-Bilds bzw. des Fahrzeugs
    this.hinterradX = k.ruhePunkt('rad1').x;
    this.muldeHinten = { x: 30 - mk.ax * mk.w, y: 200 - mk.ay * mk.h };
    // fallender Sandklumpen (einer, wird wiederverwendet)
    this.fallKlumpen = spr('baustelle/sand_klumpen', { parent: this.welt });
    this.fallKlumpen.zIndex = 16;
    this.fallKlumpen.visible = false;

    // Antippen: losfahren (wenn voll); festhalten an der Abladestelle: kippen
    hold(k, {
      hitArea: new PIXI.Rectangle(-560, -720, 1040, 760),
      onStart: () => this.kipperGetippt(),
      onTick: (dt) => { if (this.kipperZustand === 'kippbereit') this.kippe(dt / KIPP_DAUER); },
    });
  }

  // Mitte der Mulde (oben, am Rand) in Seiten-Koordinaten
  muldeOrt() {
    const mk = meta('baustelle/kipper');
    this._p.set(mk.pts.mulde[0] - mk.ax * mk.w - 20, 175 - mk.ay * mk.h);
    return this.welt.toLocal(this._p, this.kipper.koerper);
  }

  setzeLadung(n) {
    this.ladung = n;
    const l = this.ladungBild;
    if (n <= 0) {
      l.visible = false;
      return;
    }
    const sx = [0, 0.62, 0.74, 0.84, 0.9][n];
    const sy = [0, 0.55, 0.85, 1.1, 1.35][n];
    l.visible = true;
    this.tween(l, { scaleX: sx, scaleY: sy }, 0.45, { ease: 'backOut' });
  }

  kipperHupt(erstesMal) {
    if (ton('common/hupe', { abstand: 1.5 })) this.kipper.hupf(18);
    if (erstesMal) {
      // (die Runde läuft beim Wegblättern weiter – der Satz kommt nur, solange die Seite zu sehen ist)
      voice('baustelle_kipper', { nurWenn: () => this.aktiv && this.kipperZustand === 'da' });
      for (const t of this.tiere) this.after(rand(0.1, 0.5), () => freuen(this, t, { herzen: 3 }));
      this.kipperPuls?.stop();
      this.kipperPuls = fx.pulse(this.kipper.rumpf, { staerke: 0.03, periode: 1.8 });
    }
  }

  // Kipper um sein Hinterrad neigen (w = Drehung; 0 = gerade)
  neige(w) {
    const k = this.kipper;
    const r = this.hinterradX * KIPPER_S;
    k.rotation = w;
    k.x = this.kipperBasisX + r * (1 - Math.cos(w));
    k.y = this.kipperY - r * Math.sin(w);
  }

  kipperGetippt() {
    const z = this.kipperZustand;
    if (z === 'kippbereit') {
      // ein Tipp kippt ein Stück, Festhalten kippt weiter
      this.kipper.wackel(0.02);
      this.kippe(0.22);
      return;
    }
    if (z !== 'da') {
      ton('common/hupe', { abstand: 0.8, vol: 0.6 });
      return;
    }
    if (this.ladung < STUFEN) {
      ton('common/hupe', { abstand: 0.8, vol: 0.7 });
      this.kipper.wackel(0.03);
      return;
    }
    this.losfahren();
  }

  async losfahren() {
    // voll: ein Stück nach rechts fahren und an der Abladestelle warten, bis das Kind ihn festhält
    this.kipperZustand = 'faehrt';
    this.kipperPuls?.stop();
    this.kipperPuls = null;
    ton('common/hupe', { abstand: 0.5 });
    ton('common/motor', { abstand: 4, vol: 0.7 });
    for (const t of this.tiere) this.after(rand(0, 0.4), () => freuen(this, t));
    await this.wait(0.4);
    await this.kipper.fahreZu(KIPP_X, 1.8, { ease: 'sineInOut' });
    this.kipperBasisX = this.kipper.x;
    this.kippP = 0;
    this.kipperZustand = 'kippbereit';
    this.kipper.hupf(10);
    const passt = () => this.aktiv && this.kipperZustand === 'kippbereit' && this.kippP < 0.3;
    this.after(1.2, () => { if (passt()) voice('baustelle_kippen', { nurWenn: passt }); });
  }

  // Ein Stück weiter kippen (d = Anteil 0…1); die Ladung rutscht mit, ganz gekippt → Sand fällt hinaus
  kippe(d) {
    if (this.kipperZustand !== 'kippbereit') return;
    const vorher = this.kippP;
    this.kippP = Math.min(1, this.kippP + d);
    const p = this.kippP;
    if (vorher === 0) ton('common/kippen', { abstand: 1 });
    this.neige(KIPP_WINKEL * ease.sineInOut(p));
    const q = clamp((p - 0.35) / 0.65, 0, 1);
    const l = this.ladungBild;
    l.position.set(this.ladungRuhe.x - 120 * q, this.ladungRuhe.y + 25 * q);
    l.rotation = -0.2 * q;
    if (p >= 1) this.ausgekippt();
  }

  async ausgekippt() {
    this.kipperZustand = 'kippt';
    const l = this.ladungBild;
    this.tween(l, { x: this.ladungRuhe.x - 230, y: this.ladungRuhe.y + 60, rotation: -0.3 }, 0.5, { ease: 'quadIn' });
    this.tween(l, { alpha: 0 }, 0.5, { ease: 'sineInOut', delay: 0.15 });
    await this.wait(0.25);
    // Sand fällt hinter dem Kipper zu Boden
    this._p.set(this.muldeHinten.x, this.muldeHinten.y);
    const kante = this.welt.toLocal(this._p, this.kipper.koerper);
    const f = this.fallKlumpen;
    f.visible = true;
    f.alpha = 1;
    f.rotation = 0;
    f.position.set(kante.x, kante.y + 30);
    f.scale.set(0.5);
    ton('common/sand', { abstand: 0.5 });
    this.tween(f, { scale: 0.9 }, 0.5, { ease: 'sineInOut' });
    await this.tween(f, { x: kante.x - 50, y: this.kipperY - 10 }, 0.5, { ease: 'quadIn' });
    this.burst('staub', f.x, f.y - 30, { count: 7 });
    this.tween(f, { alpha: 0, scaleY: 0.5 }, 1.6, { ease: 'sineInOut', delay: 0.6 }).then(() => { f.visible = false; });
    if (this.besuch && !this.besuch.tier._unterwegs) {
      this.besuch.gekippt = true;
      freuen(this, this.besuch.tier, { herzen: 3 });
    }
    await this.wait(0.5);
    // wieder gerade, Ladung leer
    const neigung = { w: KIPP_WINKEL };
    await this.tween(neigung, { w: 0 }, 0.7, { ease: 'sineInOut', onUpdate: () => this.neige(neigung.w) });
    this.setzeLadung(0);
    l.alpha = 1;
    l.rotation = 0;
    l.scale.set(0.5);
    l.position.set(this.ladungRuhe.x, this.ladungRuhe.y);
    this.pruefeRunde();
    await this.wait(0.3);

    // leer zurück an den Platz
    this.kipperZustand = 'zurueck';
    ton('common/motor', { abstand: 4, vol: 0.6 });
    await this.kipper.fahreZu(this.kipperX, 1.6, { ease: 'sineInOut' });
    this.kipper.hupf(14);
    ton('common/hupe', { abstand: 0.5, vol: 0.7 });
    this.kipperZustand = 'da';
  }

  // ---------------------------------------------------------------- Kleinkram

  baueDinge(boden) {
    const ding = (id, x, y, scale, z, fn, pad = 40) => {
      const s = spr(id, { x, y, parent: this.welt });
      s.scale.set(scale);
      s.zIndex = z;
      tap(s, () => { fx.wobble(s, 0.07); fn?.(s); }, { pad });
      return s;
    };
    // (vorn höchstens bis y ≈ 1500 tippbar: unten bleiben 70 Einheiten frei; die Ecke unten rechts auch)
    this.schild = ding('baustelle/schild_baustelle', -380, 935, 0.45, 3, () => ton('common/klack', { abstand: 0.3 }), 50);
    this.pylon1 = ding('baustelle/pylon', -260, 1455, 0.48, 40, () => ton('common/plopp', { abstand: 0.3 }), 40);
    this.pylon2 = ding('baustelle/pylon', 900, 1420, 0.42, 38, () => ton('common/plopp', { abstand: 0.3 }), 50);
    this.karre = ding('baustelle/schubkarre', -930, 1430, 0.62, 35, (s) => {
      ton('common/quietsch', { abstand: 0.8, vol: 0.6 });
      this.tween(s, { x: s.x + 30 * (s.vor = -(s.vor || -1)) }, 0.5, { ease: 'sineInOut' });
    }, 40);
  }

  baueTiere() {
    this.tiere = [
      helmTier('affe', { x: -620, y: 1455, scale: 0.3, parent: this.welt, z: 42 }),
      helmTier('pinguin', { x: 400, y: 1460, scale: 0.29, flip: true, parent: this.welt, z: 44 }),
    ];
    for (const t of this.tiere) t.onTap(() => freuen(this, t));
  }

  // ---------------------------------------------------------------- Takt und Hinweise

  update(dt) {
    this.wolken.update(dt);
    this.schmetterling.update(dt);
    this.kette.update(dt);
    this.kipper.update(dt);
    // Arm folgt weich dem Finger
    if (this.armGezogen && !this.laeuft) {
      this.arm.rotation += (this.armZiel - this.arm.rotation) * (1 - Math.exp(-dt * 8));
    }
    // Sand in der Schaufel bleibt aufrecht, egal wie der Arm steht
    this.klumpen.rotation = -this.arm.rotation;
    const b = this.besuch;
    if (b?.ding && !b.ding.destroyed) {
      // Fundstück in der Schaufel / beim Besucher, der geht
      if (b.dingPhase === 'schaufel') {
        const s = this.schaufelOrt(this._q);
        b.ding.position.set(s.x, s.y - 30);
      } else if (b.mitnehmen && !b.tier.destroyed) {
        // vor dem Besucher her (er schaut beim Gehen nach rechts)
        b.ding.position.set(b.tier.x + 95 * (b.tier.flip ? -1 : 1), b.tier.y - 45);
      }
    }
  }

  hinweise() {
    const b = this.besuch;
    if (b && !b.tier._unterwegs) {
      if (b.dingPhase === 'guckt') return [b.ding];
      if (b.dingPhase === 'liegt') return [{ von: b.ding, nach: { x: b.tier.x, y: b.tier.y - 120 } }];
    }
    if (this.kipperZustand === 'kippbereit') return [this.kipper];
    // voll: auf den Kipper; unterwegs: auf die Tiere (die freuen sich) und den Sandberg (der Bagger lädt schon vor)
    if (this.ladung >= STUFEN && this.kipperZustand === 'da') return [this.kipper];
    if (this.kipperZustand !== 'da') return [this.tiere[1], this.tiere[0]];
    return [{ x: -700, y: 900 }, this.tiere[0]];
  }
}
