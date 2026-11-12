// Seite 1 – Baggern (hg_grube).
// Tipp auf den Sandberg (oder auf den Bagger, oder den Arm ziehen): Der Bagger dreht sich zum Sandberg, schaufelt
// Sand, dreht sich zum Kipper und lädt ab. Die Ladung wächst in vier Stufen. Jeder Tipp während der Arbeit merkt
// eine weitere Schaufel vor (höchstens so viele, wie noch in den Kipper passen). Voll → der Kipper hupt einmal;
// antippen → er fährt ein Stück nach rechts, kippt sichtbar ab und rollt leer zurück. Zwei Tiere mit Bauhelm
// schauen zu und freuen sich.

import { spr, meta, voice, fx, tap, drag, PIXI, rand, clamp } from '../../engine/index.js';
import { Seite } from '../../gemeinsam/seiten.js';
import { Fahrzeug } from '../../gemeinsam/zug.js';
import { belohne } from '../../gemeinsam/sticker.js';
import { Wolken, Schmetterling, Spatz, helmTier, freuen, ton } from './deko.js';

const BAGGER_S = 0.62;          // Bagger-Körper
const ARM_S = 0.55;             // Bagger-Arm (Reichweite ≈ 450)
const KIPPER_S = 0.62;
const BAGGER_X = 35;            // so weit rechts, dass der Arm Sandberg und Kipper erreicht (Punkt 'bagger' liegt zu weit links)
const GRABEN = { x: -600, y: 990 };   // in den Sandberg (Oberfläche dort ≈ 965)
const STUFEN = 4;
const KIPP_X = 860;             // hier kippt der Kipper ab (noch ganz im Bild)
const KIPP_WINKEL = -0.1;       // Neigung beim Abkippen (Schnauze hoch, hinten bleibt am Boden)

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

export class Grube extends Seite {
  static hg = 'baustelle/hg_grube';

  aufbau() {
    const boden = this.boden;   // 1250
    this.wolken = new Wolken(this, { anzahl: 2 });
    this.schmetterling = new Schmetterling(this, { bereich: { x: -250, y: 470, w: 900, h: 240 }, farbe: 0xb9a4f0 });
    this.spatz = new Spatz(this, { x: 190, y: 742, flip: true, z: 4 });

    this.ladung = 0;          // 0 … STUFEN (Sand im Kipper)
    this.laeuft = false;      // Bagger arbeitet gerade eine Runde
    this.vorgemerkt = 0;      // so viele Schaufeln kommen nach der laufenden noch
    this.kipperDa = true;     // Kipper steht an seinem Platz
    this.kipperPuls = null;
    this.inSchaufel = false;  // eine Schaufel ist zwischen Sandberg und Kipper unterwegs
    this.armGezogen = false;  // ein Finger hält den Arm
    this.armZiel = RUHE;
    this._p = new PIXI.Point();

    this.baueSandberg();
    this.baueBagger(boden);
    this.baueKipper(boden);
    this.baueDinge(boden);
    this.baueTiere();
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

  // Schaufel-Spitze in Seiten-Koordinaten (für Teilchen)
  schaufelOrt() {
    this._p.set(ARM.sx - ARM.gx, ARM.sy - ARM.gy - 30);
    return this.welt.toLocal(this._p, this.arm);
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

  /** Wunsch nach einer Schaufel Sand (vom Sandberg, vom Bagger, vom Arm). */
  schaufeln() {
    this.gebaggert = true;   // das Kind hat es gefunden: kein Bagger-Hinweis mehr nötig
    const frei = STUFEN - this.ladung - (this.inSchaufel ? 1 : 0) - this.vorgemerkt;
    if (this.laeuft) {
      // während der Arbeit: vormerken, solange noch etwas in den Kipper passt
      if (frei > 0) this.vorgemerkt++;
      this.nicke();
      return;
    }
    if (frei <= 0) {
      // Kipper ist voll: einmal hupen (die Hand zeigt ohnehin auf ihn) – kein Schaufeln, kein Warten
      if (this.kipperDa) this.kipperHupt(false);
      else this.nicke();
      return;
    }
    this.runde();
  }

  // Arbeit des Baggers: Schaufel um Schaufel, solange etwas vorgemerkt ist, dann zurück in die Ruhe
  async runde() {
    this.laeuft = true;
    try {
      for (;;) {
        await this.eineSchaufel();
        if (this.vorgemerkt > 0 && this.ladung < STUFEN) { this.vorgemerkt--; continue; }
        this.tween(this.arm, { rotation: RUHE }, T_DREH, { ease: 'sineInOut' });
        await this.drehe(1);
        // (auch während des Zurückdrehens getippt? dann gleich weiter)
        if (this.vorgemerkt > 0 && this.ladung < STUFEN) { this.vorgemerkt--; continue; }
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
    while (!this.kipperDa) await this.wait(0.3);
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
    if (this.ladung >= STUFEN) this.after(0.4, () => this.kipperHupt(true));
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

    tap(k, () => this.kipperGetippt(), {
      sound: null,
      hitArea: new PIXI.Rectangle(-560, -720, 1040, 760),
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
      voice('baustelle_kipper', { nurWenn: () => this.aktiv });
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

  async kipperGetippt() {
    if (!this.kipperDa) return;
    if (this.ladung < STUFEN) {
      ton('common/hupe', { abstand: 0.8, vol: 0.7 });
      this.kipper.wackel(0.03);
      return;
    }
    // voll: ein Stück nach rechts fahren, sichtbar abkippen, leer zurückrollen
    this.kipperDa = false;
    this.kipperPuls?.stop();
    this.kipperPuls = null;
    ton('common/hupe', { abstand: 0.5 });
    ton('common/motor', { abstand: 4, vol: 0.7 });
    for (const t of this.tiere) this.after(rand(0, 0.4), () => freuen(this, t));
    const ort = this.kipper.punkt('mulde');
    belohne(this, 'baustelle_kipper', ort.x, ort.y - 120);
    await this.wait(0.4);
    await this.kipper.fahreZu(KIPP_X, 1.8, { ease: 'sineInOut' });

    // abkippen: Schnauze hebt sich, die Ladung rutscht hinten hinaus und fällt in einer kleinen Staubwolke zu Boden
    ton('common/kippen', { abstand: 1 });
    this.kipperBasisX = this.kipper.x;
    const neigung = { w: 0 };
    await this.tween(neigung, { w: KIPP_WINKEL }, 0.9, { ease: 'sineInOut', onUpdate: () => this.neige(neigung.w) });
    const l = this.ladungBild;
    this.tween(l, { x: this.ladungRuhe.x - 230, y: this.ladungRuhe.y + 60, rotation: -0.3 }, 0.7, { ease: 'quadIn' });
    this.tween(l, { alpha: 0 }, 0.6, { ease: 'sineInOut', delay: 0.25 });
    await this.wait(0.35);
    // Sand fällt hinter dem Kipper zu Boden
    this._p.set(this.muldeHinten.x, this.muldeHinten.y);
    const kante = this.welt.toLocal(this._p, this.kipper.koerper);
    const f = this.fallKlumpen;
    f.visible = true;
    f.alpha = 1;
    f.rotation = 0;
    f.position.set(kante.x, kante.y + 30);
    f.scale.set(0.5);
    this.tween(f, { scale: 0.9 }, 0.5, { ease: 'sineInOut' });
    await this.tween(f, { x: kante.x - 50, y: this.kipperY - 10 }, 0.5, { ease: 'quadIn' });
    this.burst('staub', f.x, f.y - 30, { count: 7 });
    this.tween(f, { alpha: 0, scaleY: 0.5 }, 1.6, { ease: 'sineInOut', delay: 0.4 }).then(() => { f.visible = false; });
    await this.wait(0.4);
    // wieder gerade, Ladung leer
    await this.tween(neigung, { w: 0 }, 0.7, { ease: 'sineInOut', onUpdate: () => this.neige(neigung.w) });
    this.setzeLadung(0);
    l.alpha = 1;
    l.rotation = 0;
    l.scale.set(0.5);
    l.position.set(this.ladungRuhe.x, this.ladungRuhe.y);
    await this.wait(0.3);

    // leer zurück an den Platz
    ton('common/motor', { abstand: 4, vol: 0.6 });
    await this.kipper.fahreZu(this.kipperX, 1.6, { ease: 'sineInOut' });
    this.kipper.hupf(14);
    ton('common/hupe', { abstand: 0.5, vol: 0.7 });
    this.kipperDa = true;
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
    this.pylon2 = ding('baustelle/pylon', 870, 1420, 0.42, 38, () => ton('common/plopp', { abstand: 0.3 }), 50);
    this.karre = ding('baustelle/schubkarre', -930, 1430, 0.62, 35, (s) => {
      ton('common/quietsch', { abstand: 0.8, vol: 0.6 });
      this.tween(s, { x: s.x + 30 * (s.vor = -(s.vor || -1)) }, 0.5, { ease: 'sineInOut' });
    }, 40);
  }

  baueTiere() {
    this.tiere = [
      helmTier('affe', { x: -620, y: 1455, scale: 0.3, parent: this.welt, z: 42 }),
      helmTier('pinguin', { x: 440, y: 1460, scale: 0.29, flip: true, parent: this.welt, z: 44 }),
    ];
    for (const t of this.tiere) t.onTap(() => freuen(this, t));
  }

  // ---------------------------------------------------------------- Takt und Hinweise

  update(dt) {
    this.wolken.update(dt);
    this.schmetterling.update(dt);
    this.kipper.update(dt);
    // Arm folgt weich dem Finger
    if (this.armGezogen && !this.laeuft) {
      this.arm.rotation += (this.armZiel - this.arm.rotation) * (1 - Math.exp(-dt * 8));
    }
    // Sand in der Schaufel bleibt aufrecht, egal wie der Arm steht
    this.klumpen.rotation = -this.arm.rotation;
  }

  hinweise() {
    // voll: auf den Kipper; unterwegs: auf die Tiere (die freuen sich) und den Sandberg (der Bagger lädt schon vor)
    if (this.ladung >= STUFEN && this.kipperDa) return [this.kipper];
    if (!this.kipperDa) return [this.tiere[1], this.tiere[0]];
    return [{ x: -700, y: 900 }, this.tiere[0]];
  }
}
