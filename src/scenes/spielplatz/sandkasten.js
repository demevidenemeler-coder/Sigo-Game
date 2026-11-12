// Seite 3 – Sandkasten (schräg von oben): eine Sandburg entsteht in Schritten. Jeder Schritt hat eine eigene
// Geste, die Zeige-Hand zeigt immer den nächsten; nichts kann schiefgehen (wo man etwas loslässt, es findet seinen
// Platz von selbst).
//   1. Eimer füllen   (halten oder tippen) – die Schaufel schippt Sand in den Eimer, er wird voll
//   2. Stürzen        (ziehen)              – den vollen Eimer zur Baustelle ziehen, er dreht sich um
//   3. Klopfen        (dreimal tippen)      – klopf, klopf, klopf – der Eimer hebt sich: ein Sandturm steht
//      1.–3. je Burg zwei oder drei Mal (vier Burg-Formen, nie zweimal dieselbe hintereinander)
//   4. Schätze graben (wischen, tippen)     – unter dem glatten Sand liegen drei Schätze; sie schmücken die Türme
//   5. Fahnen         (ziehen)              – auf jeden Turm eine Fahne (jede Runde andere Farben)
//   6. Wassergraben   (ziehen)              – die Gießkanne über die Burg ziehen, der Graben füllt sich;
//                                            eine kleine Überraschung kommt (Quietscheente, Frosch oder Entchen)
//   7. Fertig: Der Hund freut sich, Sticker, am hinteren Rand kommt ein Wimpel dazu (die Reihe wächst).
//   Nächste Runde: Sobald wieder Sand in den Eimer kommt, wird die alte Burg weich wieder glatt.
//   Kleiner Bonus: Während die Türme entstehen, liegt schon ein Schatz versteckt im Sand – wer gleich losgräbt,
//   findet ihn (ohne eigenen Schritt); angetippt fliegt er zum Hund, der sich freut.
//   Frei dazu: Förmchen (Stern, Fisch) backen Sandkuchen, Hund, Schaufel, Türme, Wimpel und Sand reagieren.

import {
  spr, tex, meta, Actor, tap, drag, hold, wipe, sfx, sfxSchleife, note, voice, fx, killTweensOf, rand, pick, shuffle,
  clamp, stage, PIXI,
} from '../../engine/index.js';
import { Seite, hgPunkt } from '../../gemeinsam/seiten.js';
import { belohne } from '../../gemeinsam/sticker.js';
import {
  freude, stickerFuer, merker, teilTextur, Schmetterling, andere, flugDauer, bogenFlug, FARBEN,
} from './helfer.js';

const SCHAETZE = ['auto', 'ball', 'dino', 'ente', 'krone', 'muschel', 'ring', 'schaufel', 'schluessel', 'stern'];
const ANZAHL = 3;               // Schätze je Burg
const SCHATZ_GROESSE = 175;     // Einheiten (längere Seite) im Sand
const DEKO_GROESSE = 100;       // am Turm
const FREI_AB = 0.55;           // Anteil freigelegter Probepunkte, ab dem ein Schatz antippbar ist
const WISCH_RADIUS = 125;
const PENTA = [72, 74, 76, 79, 81];

// Die ganze Sandfläche innen am Holzrand (Szenen-Koordinaten, aus dem Hintergrund abgelesen). Die Ecken oben sind
// für Karten- und Album-Knopf abgeschnitten.
const SAND = [
  [-1180, 270], [-1020, 212], [1020, 212], [1076, 270], [1150, 1308], [-1240, 1308],
];
const SAND_BOX = { x: -1250, y: 200, w: 2410, h: 1120 };   // umschließendes Rechteck
const DECKE_RES = 0.6;          // Auflösung der Decke (Bildpunkte je Einheit) – Sand verträgt das gut
// Ersatz, falls der Hintergrund nicht gelesen werden kann: die gemalte Sanddecke in der Mitte
const DECKE_ERSATZ = { x: 0, y: 770, w: 1300, h: 780 };

// Burg: Wassergraben (Ellipse um die Baustelle) und die vier Burg-Formen (Fuß der Türme, Größe)
const BURG = { x: 60, y: 815, rx: 600, ry: 190, dx: 64, dy: 32 };   // dx/dy = Breite des Grabens
// Die Größen `s` beziehen sich auf ein Turm-Bild von 582 Bildpunkten Breite; das gespeicherte Bild ist kleiner
// (schlanker zu laden) – turmSkala() rechnet um.
const TURM_BREITE = 582;
const FORMEN = [
  [{ x: 60, y: 770, s: 0.54 }, { x: -265, y: 860, s: 0.4 }, { x: 385, y: 860, s: 0.4 }],
  [{ x: -140, y: 820, s: 0.48 }, { x: 260, y: 820, s: 0.48 }],
  [{ x: -60, y: 770, s: 0.54 }, { x: 330, y: 870, s: 0.4 }],
  [{ x: 180, y: 770, s: 0.54 }, { x: -200, y: 870, s: 0.4 }],
];
// Schätze liegen vorn im Sand (vor dem Graben, frei von Schaufel, Förmchen und Kuchen)
const SCHATZ_SPALTEN = [-430, -120, 200, 520];
const SCHATZ_Y = [1080, 1170];

const EIMER_HEIM = { x: -890, y: 1478 };     // auf dem vorderen Holzrand
const EIMER_SKALA = 0.55;
const SCHAUFEL_HEIM = { x: -650, y: 1205, rotation: -0.3 };
const SCHAUFEL_UEBER_EIMER = { x: -820, y: 1236, rotation: 1.35 };
const KANNE_HEIM = { x: 690, y: 1430 };
const KANNE_SKALA = 0.5;
const GIESS_ORT = { x: -500, y: 690 };       // dort gießt die Kanne von selbst weiter (Tülle über dem Graben)
const FAHNEN_ORTE = [{ x: -330, y: 1452 }, { x: -60, y: 1452 }, { x: 210, y: 1452 }];
const FAHNE_SKALA = 0.62;
// Wimpel am hinteren Holzrand (einer je fertiger Burg; frei von Hund und Knopf-Ecken)
const WIMPEL_X = [-850, -720, -590, -460, -330, 330, 460, 590, 720, 850];
const WIMPEL_Y = 206;
const WIMPEL_SKALA = 0.42;
let wimpelFarben = [];          // bleibt für die ganze Spielzeit (auch nach dem Verlassen des Spielplatzes)
const UEBERRASCHUNGEN = ['gummiente', 'frosch', 'ente'];

export class Sandkasten extends Seite {
  static hg = 'spielplatz/hg_sandkasten';

  aufbau() {
    this.finger = new Map();   // pointerId → letzter Punkt (zum Freilegen der Schätze)
    this.gefunden = 0;
    this.kuchenGetippt = false;
    this.gegraben = false;     // in dieser Grab-Runde schon gegraben (dann kein Hinweis mehr aufs Graben)
    this._hinweise = [];
    this.griffe = [];          // Eingaben des laufenden Schritts (werden beim nächsten Schritt abgebaut)
    this.zeit = 0;
    this.formNr = Math.floor(rand(0, FORMEN.length));
    this.form = FORMEN[this.formNr];
    this.turmNr = 0;
    this.alteBurg = false;
    this.ueberraschung = null;

    this.baueSandRand();
    this.baueGrube();
    this.baueSchaetze();
    this.baueDecke();
    this.baueBurg();
    this.baueEimer();
    this.baueSchaufel();
    this.baueKanne();
    this.baueHund();
    this.baueFoermchen();
    this.baueWimpel();
    // Schmetterling gaukelt über dem hinteren Holzrand
    this.falter = new Schmetterling(this, {
      x: -600, y: 190, farbe: 2, z: 400, scale: 0.85,
      bereich: { x0: -900, x1: 820, y0: 150, y1: 230 },
    });
    // Merkpunkte für die Zeige-Hand (Ziehbewegungen)
    this.handVon = merker(this.welt);
    this.handNach = merker(this.welt);
    this.zielMerker = merker(this.welt);
    this.giessMerker = merker(this.welt);
    this.giessMerker.position.set(GIESS_ORT.x, GIESS_ORT.y);
    this.giessTon = sfxSchleife('common/giessen', { vol: 0.45 });
    this.starteFuellen();
    this.versteckeBonus();
  }

  // ---------------------------------------------------------------- Ablauf-Hilfen

  griffeAus() {
    for (const g of this.griffe) g.off();
    this.griffe = [];
  }

  /** Der Eimer hat in diesem Schritt nichts zu tun – antippen: er wackelt, ein leises Sandgeräusch */
  eimerRuhe() {
    this.griffe.push(tap(this.eimer, () => {
      if (this.hebt || this.stuerzt) return;
      fx.wobble(this.eimer, 0.05);
      if (this.zeit - (this.eimerZeit ?? -9) > 0.4) {
        this.eimerZeit = this.zeit;
        sfx('common/sand', { vol: 0.3 });
        this.burst('staub', this.eimer.x, this.eimer.y - 40, { count: 2 });
      }
    }, { sound: null, squash: true, hitArea: this.eimer.hitArea }));
  }

  /** Hinweis-Satz anmelden – nur solange die Seite zu sehen ist und `bedingung()` gilt */
  sage(id, bedingung, nach = 1.2) {
    const passt = () => this.aktiv && bedingung();
    this._hinweise.push(this.after(nach, () => { if (passt()) voice(id, { nurWenn: passt }); }));
  }

  sageSchritt(nach = 1.2) {
    switch (this.phase) {
      case 'fuellen':
        if (!this.alteBurg) this.sage('spielplatz_eimer', () => this.phase === 'fuellen' && this.fuellung === 0, nach);
        break;
      case 'klopfen':
        this.sage('spielplatz_klopfen', () => this.phase === 'klopfen' && this.klopfer === 0, nach);
        break;
      case 'graben':
        this.sage('spielplatz_graben', () => this.phase === 'graben' && !this.gegraben, nach + 0.6);
        break;
      case 'fahnen':
        this.sage('spielplatz_fahne', () => this.phase === 'fahnen' && this.fahnen.every((f) => !f.steckt), nach);
        break;
      case 'wasser':
        this.sage('spielplatz_wasser', () => this.phase === 'wasser' && this.wasserStand === 0, nach);
        break;
      default:
    }
  }

  // ---------------------------------------------------------------- Grube und Decke

  // Ganz unten: die ganze Sandfläche reagiert (wenn die Decke gerade weg ist, z. B. nach dem Freilegen)
  baueSandRand() {
    const c = new PIXI.Container({ label: 'sandRand' });
    c.zIndex = 5;
    this.welt.addChild(c);
    this.randZeit = -9;
    tap(c, (e) => {
      const jetzt = performance.now() / 1000;
      if (jetzt - this.randZeit < 0.35) return;
      this.randZeit = jetzt;
      sfx('common/graben', { vol: 0.3 });
      this.burst('staub', e.x, e.y, { count: 3 });
    }, { sound: null, squash: false, hitArea: new PIXI.Polygon(SAND.flat()) });
  }

  // Unter der Decke ist der Sand etwas dunkler: freigelegte Stellen sehen aus wie gegraben
  baueGrube() {
    const b = SAND_BOX;
    const g = new PIXI.Sprite(grubeTextur());
    g.position.set(b.x, b.y);
    g.scale.set(b.w / GRUBE.w, b.h / GRUBE.h);
    g.zIndex = 30;
    g.eventMode = 'none';
    this.welt.addChild(g);
  }

  baueDecke() {
    // Die Decke ist der gemalte Sand selbst (aus dem Hintergrund ausgeschnitten, weicher Rand) – sie sieht aus wie
    // der Sandkasten, und überall, wo das Kind gräbt, kommt der dunklere, gegrabene Sand darunter zum Vorschein.
    let s = null;
    let flaeche;
    const t = this.hg ? deckenTextur(this.hg) : null;
    if (t) {
      const b = SAND_BOX;
      s = new PIXI.Sprite(t);
      s.label = 'sanddecke';
      s.position.set(b.x, b.y);
      s.scale.set(1 / DECKE_RES);
      s.zIndex = 50;
      this.welt.addChild(s);
      // die Textur gehört nur zu diesem Besuch (wipe() gibt sie beim Zerstören der Decke zurück)
      s.once('destroyed', () => { if (!t.destroyed) t.destroy(true); });
      flaeche = new PIXI.Polygon(SAND.flatMap(([x, y]) => [(x - b.x) * DECKE_RES, (y - b.y) * DECKE_RES]));
    } else {
      const d = DECKE_ERSATZ;
      s = spr('spielplatz/sanddecke', { x: d.x, y: d.y, anchor: 0.5, z: 50, parent: this.welt });
      s.scale.set(d.w / s.texture.width, d.h / s.texture.height);
    }
    this.decke = s;
    this.graben = wipe(s, {
      radius: WISCH_RADIUS,
      sound: 'common/graben',
      doneAt: 0.85,
      hitArea: flaeche,
      onDone: () => {
        // ganz frei: alle übrigen Schätze sind jetzt zu sehen
        for (const sch of this.alleSchaetze) if (!sch.frei && sch.imSand) this.legeFrei(sch);
        this.after(0.8, () => { if (!this.decke.destroyed && this.graben.isDone()) this.decke.eventMode = 'none'; });
      },
    });
    // Eigene Spur der grabenden Finger: welche Probepunkte der Schätze sind frei?
    s.on('pointerdown', (e) => {
      if (this.phase === 'graben') this.gegraben = true;
      if (this.graben.isDone()) return;
      const p = this.welt.toLocal(e.global);
      this.finger.set(e.pointerId, p);
      this.markiere(p, p);
    });
    // Der Kern schaltet Pixis Bewegungs-Ereignisse ab (er verfolgt Finger selbst am Fenster) – darum hier eigene
    // Fenster-Zuhörer; sie enden, wenn die Decke beim Verlassen der Szene zerstört wird.
    const roh = new PIXI.Point();
    const zuWelt = (ev) => {
      stage.app.renderer.events.mapPositionToPoint(roh, ev.clientX, ev.clientY);
      return this.welt.toLocal(roh);
    };
    const bewegt = (ev) => {
      const alt = this.finger.get(ev.pointerId);
      if (!alt || s.destroyed || this.graben.isDone()) return;
      const p = zuWelt(ev);
      this.markiere(alt, p);
      this.finger.set(ev.pointerId, p);
    };
    const los = (ev) => {
      if (ev.type === 'pointerup' && this.finger.has(ev.pointerId)) bewegt(ev);
      this.finger.delete(ev.pointerId);
    };
    window.addEventListener('pointermove', bewegt, { passive: true });
    window.addEventListener('pointerup', los, { passive: true });
    window.addEventListener('pointercancel', los, { passive: true });
    s.once('destroyed', () => {
      window.removeEventListener('pointermove', bewegt);
      window.removeEventListener('pointerup', los);
      window.removeEventListener('pointercancel', los);
    });
  }

  /** Sand wird weich wieder glatt */
  glaetteSand(fade = 1.2) {
    this.decke.eventMode = 'static';
    this.graben.reset({ fade });
    this.finger.clear();
  }

  // Probepunkte nahe der Strecke a→b als gegraben markieren
  markiere(a, b) {
    const r = WISCH_RADIUS * 0.85;
    const r2 = r * r;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const l2 = dx * dx + dy * dy || 1;
    for (const sch of this.alleSchaetze) {
      if (!sch.imSand || sch.frei) continue;
      let neu = false;
      for (const p of sch.proben) {
        if (p.weg) continue;
        const t = clamp(((p.x - a.x) * dx + (p.y - a.y) * dy) / l2, 0, 1);
        const qx = a.x + dx * t - p.x;
        const qy = a.y + dy * t - p.y;
        if (qx * qx + qy * qy <= r2) { p.weg = true; neu = true; }
      }
      if (neu && sch.proben.filter((p) => p.weg).length / sch.proben.length >= FREI_AB) this.legeFrei(sch);
    }
  }

  // ---------------------------------------------------------------- Burg (Türme, Graben, Wasser, Fahnen)

  baueBurg() {
    // Graben (dunklerer, feuchter Sand) und Wasser darüber – Ringe um die Baustelle, unter den Türmen
    const B = BURG;
    this.grabenRing = new PIXI.Graphics()
      .ellipse(0, 0, B.rx + 8, B.ry + 6).fill({ color: 0x9a6a35, alpha: 0.28 })
      .ellipse(0, 0, B.rx - B.dx - 8, B.ry - B.dy - 6).cut()
      .ellipse(0, 4, B.rx - 6, B.ry - 3).fill({ color: 0x7a4c22, alpha: 0.22 })
      .ellipse(0, 4, B.rx - B.dx + 6, B.ry - B.dy + 3).cut();
    this.wasser = new PIXI.Graphics()
      .ellipse(0, 3, B.rx - 4, B.ry - 2).fill({ color: 0x5bb6e8 })
      .ellipse(0, 3, B.rx - B.dx + 4, B.ry - B.dy + 2).cut()
      .ellipse(0, 6, B.rx - B.dx * 0.35, B.ry - B.dy * 0.35).stroke({ width: 7, color: 0xc4ecff, alpha: 0.7 });
    for (const g of [this.grabenRing, this.wasser]) {
      g.position.set(B.x, B.y);
      g.eventMode = 'none';
      g.visible = false;
      g.alpha = 0;
      this.welt.addChild(g);
    }
    this.grabenRing.zIndex = 52;
    this.wasser.zIndex = 53;
    this.wasserStand = 0;

    // Markierung der Baustelle (weicher Kreis, atmet langsam)
    this.markierung = new PIXI.Graphics()
      .ellipse(0, 0, 170, 52).fill({ color: 0xffffff, alpha: 0.35 })
      .ellipse(0, 0, 170, 52).stroke({ width: 8, color: 0xfff3d0, alpha: 0.9 });
    this.markierung.zIndex = 55;
    this.markierung.eventMode = 'none';
    this.markierung.visible = false;
    this.welt.addChild(this.markierung);

    // Türme (Vorrat für die größte Burg)
    this.tuerme = [];
    for (let i = 0; i < 3; i++) {
      const t = spr('spielplatz/sandturm', { parent: this.welt });
      t.visible = false;
      t.fahne = null;
      tap(t, () => {
        fx.wobble(t, 0.04);
        sfx('common/sand', { vol: 0.35 });
        this.burst('staub', t.x + rand(-60, 60), t.y - 20, { count: 2 });
      }, { sound: null, squash: false });
      t.eventMode = 'none';
      this.tuerme.push(t);
    }

    // Fahnen (eine je Turm), weiß und eingefärbt
    this.fahnen = [];
    for (let i = 0; i < 3; i++) {
      const f = spr('spielplatz/fahne', { parent: this.welt });
      f.visible = false;
      f.steckt = null;
      f.zugFlaeche = new PIXI.Rectangle(-180, -360, 400, 420);
      f.hitArea = f.zugFlaeche;
      this.fahnen.push(f);
    }

    // Überraschungen im Wasser
    this.gummiente = spr('spielplatz/schatz_ente', { anchor: [0.5, 0.8], parent: this.welt, z: 56 });
    this.gummiente.scale.set(110 / 300);
    this.gummiente.visible = false;
    tap(this.gummiente, () => {
      note('pling', pick([79, 84]), { vol: 0.35 });
      fx.wobble(this.gummiente, 0.12);
    }, { sound: null, squash: true, hitArea: new PIXI.Circle(0, -100, 380) });
    this.gaeste = {};
    for (const id of ['frosch', 'ente']) {
      const a = new Actor(id, { x: 0, y: 0, scale: 0.15, parent: this.welt, z: 57 });
      a.visible = false;
      a.onTap(() => freude(this, a, { herzen: 3, hoehe: 40 }), { pad: 80 });
      this.gaeste[id] = a;
    }
  }

  turmZ(y) {
    return 100 + Math.round(y / 10);
  }

  /** Sprite-Skala eines Turms der Größe s (s bezogen auf ein 582 Bildpunkte breites Bild) */
  turmSkala(s) {
    const w = meta('spielplatz/sandturm')?.w || TURM_BREITE;
    return (s * TURM_BREITE) / w;
  }

  // ---------------------------------------------------------------- 1. Eimer füllen

  baueEimer() {
    const e = new PIXI.Container({ label: 'eimer' });
    const kipp = new PIXI.Container({ label: 'eimerKipp' });
    spr('spielplatz/eimer_leer', { anchor: 0.5, parent: kipp });
    // Sand-Haufen aus dem Bild des vollen Eimers: wächst beim Füllen aus der Öffnung
    const haufen = new PIXI.Sprite(teilTextur('spielplatz/eimer_sand', 28, 0, 312, 118));
    haufen.anchor.set(0.5, 1);
    haufen.position.set(6, -58);
    kipp.addChild(haufen);
    kipp.y = -194;   // Unterkante des Eimers liegt auf dem Ort des Containers
    e.addChild(kipp);
    e.position.set(EIMER_HEIM.x, EIMER_HEIM.y);
    e.scale.set(EIMER_SKALA);
    e.zIndex = 80;
    e.hitArea = new PIXI.Rectangle(-240, -440, 480, 480);
    this.welt.addChild(e);
    this.eimer = e;
    this.eimerKipp = kipp;
    this.haufen = haufen;
    this.setzeFuellung(0);
  }

  setzeFuellung(f) {
    this.fuellung = f;
    this.haufen.visible = f > 0.01;
    this.haufen.scale.set(0.97 * (0.72 + 0.28 * f), 0.97 * Math.max(0.08, f));
  }

  starteFuellen() {
    this.phase = 'fuellen';
    this.griffeAus();
    this.griffe.push(hold(this.eimer, {
      hitArea: this.eimer.hitArea,
      // tippen = ein Schipp; halten = die Schaufel schippt immer weiter
      onStart: () => this.schippe(),
      onTick: () => { if (!this.schippt) this.schippe(); },
    }));
    this.sageSchritt();
  }

  // Ein Schipp Sand: die Schaufel sticht in den Sand und kippt ihn in den Eimer
  async schippe() {
    if (this.phase !== 'fuellen') return;
    if (this.alteBurg) this.baueAb();
    if (this.schippt) return;
    this.schippt = true;
    const s = this.schaufel;
    const h = SCHAUFEL_HEIM;
    const u = SCHAUFEL_UEBER_EIMER;
    killTweensOf(s, ['x', 'y', 'rotation']);
    sfx('common/graben', { vol: 0.4 });
    this.burst('staub', h.x + 20, h.y + 80, { count: 2 });
    await this.tween(s, { y: h.y + 28, rotation: h.rotation - 0.15 }, 0.14, { ease: 'quadOut' });
    await this.tween(s, { x: u.x, y: u.y, rotation: u.rotation }, 0.3, { ease: 'sineInOut' });
    sfx('common/sand', { vol: 0.5 });
    this.burst('staub', this.eimer.x + 10, this.eimer.y - 170, { count: 3 });
    this.setzeFuellung(Math.min(1, this.fuellung + 0.25));
    fx.pop(this.eimer, 0.04);
    await this.tween(s, { x: h.x, y: h.y, rotation: h.rotation }, 0.3, { ease: 'sineInOut' });
    this.schippt = false;
    if (this.fuellung >= 1 && this.phase === 'fuellen') this.starteStuerzen();
  }

  // ---------------------------------------------------------------- 2. Stürzen

  starteStuerzen() {
    this.phase = 'stuerzen';
    this.griffeAus();
    const ziel = this.form[this.turmNr];
    this.markierung.position.set(ziel.x, ziel.y);
    this.markierung.scale.set(ziel.s / 0.5);
    this.markierung.visible = true;
    this.markierung.alpha = 0;
    this.tween(this.markierung, { alpha: 1 }, 0.6, { ease: 'sineInOut' });
    this.zielMerker.position.set(ziel.x, ziel.y - 100);
    fx.pop(this.eimer, 0.08);
    sfx('common/plopp', { vol: 0.35 });
    // Wo das Kind den Eimer auch loslässt (oder nur antippt): er hüpft zur Baustelle
    this.griffe.push(drag(this.eimer, {
      back: false,
      lift: 1.06,
      hitArea: this.eimer.hitArea,
      onStart: () => sfx('common/hupf', { vol: 0.3 }),
      onDrop: () => {
        this.eimer.zIndex = 300;
        this.stuerze();
      },
    }));
  }

  async stuerze() {
    if (this.phase !== 'stuerzen' || this.stuerzt) return;
    this.stuerzt = true;
    this.griffeAus();
    const ziel = this.form[this.turmNr];
    const e = this.eimer;
    e.zIndex = 300;
    // so groß wie der Turm, der daraus wird
    const s = (TURM_BREITE * ziel.s * 0.92) / 386;
    await bogenFlug(this, e, ziel.x, ziel.y - 150, { hoehe: 130, min: 0.7, skala: s });
    // umdrehen und aufsetzen
    sfx('common/wusch', { vol: 0.3 });
    this.tween(this.eimerKipp, { scaleY: -1 }, 0.42, { ease: 'sineInOut' });
    await this.tween(e, { y: ziel.y + 28 * s }, 0.42, { ease: 'quadIn' });
    sfx('common/landen', { vol: 0.55 });
    this.burst('staub', ziel.x, ziel.y - 10, { count: 6 });
    this.tween(this.markierung, { alpha: 0 }, 0.5, { ease: 'sineInOut' })
      .then((ok) => { if (ok) this.markierung.visible = false; });
    this.stuerzt = false;
    this.starteKlopfen();
  }

  // ---------------------------------------------------------------- 3. Klopfen und Abheben

  starteKlopfen() {
    this.phase = 'klopfen';
    this.klopfer = 0;
    this.griffeAus();
    this.griffe.push(tap(this.eimer, () => this.klopfe(), { sound: null, squash: true, hitArea: this.eimer.hitArea }));
    this.sageSchritt(0.8);
  }

  klopfe() {
    if (this.phase !== 'klopfen' || this.hebt) return;
    this.klopfer++;
    sfx('common/klack', { vol: 0.5, rate: 0.85 + this.klopfer * 0.08 });
    this.burst('staub', this.eimer.x + rand(-80, 80), this.eimer.y - 15, { count: 2 });
    if (this.klopfer >= 3) this.hebeEimer();
  }

  async hebeEimer() {
    this.hebt = true;
    this.griffeAus();
    const ziel = this.form[this.turmNr];
    const turm = this.tuerme[this.turmNr];
    if (!ziel || !turm) { this.hebt = false; return; }
    killTweensOf(turm);
    turm.position.set(ziel.x, ziel.y);
    turm.scale.set(this.turmSkala(ziel.s));
    turm.s = ziel.s;
    turm.alpha = 1;
    turm.visible = true;
    turm.zIndex = this.turmZ(ziel.y);
    turm.eventMode = 'static';
    const e = this.eimer;
    e.zIndex = turm.zIndex + 5;
    await this.wait(0.25);
    sfx('common/rupf', { vol: 0.5 });
    this.tween(e, { alpha: 0 }, 0.55, { ease: 'sineInOut', delay: 0.3 });
    await this.tween(e, { y: e.y - 280 }, 0.85, { ease: 'sineOut' });
    sfx('common/sand', { vol: 0.4 });
    this.burst('staub', ziel.x, ziel.y - 15, { count: 5 });
    this.burst('funkeln', ziel.x, ziel.y - 560 * ziel.s, { count: 3 });
    fx.pop(turm, 0.05);
    this.hund.lookAt(ziel.x);
    // der leere Eimer steht wieder an seinem Platz
    e.position.set(EIMER_HEIM.x, EIMER_HEIM.y);
    e.scale.set(EIMER_SKALA);
    this.eimerKipp.scale.y = 1;
    this.setzeFuellung(0);
    e.zIndex = 80;
    this.tween(e, { alpha: 1 }, 0.5, { ease: 'sineInOut' });
    this.hebt = false;
    this.turmNr++;
    if (this.turmNr < this.form.length) {
      this.starteFuellen();
    } else {
      this.after(0.6, () => this.starteGraben());
    }
  }

  // ---------------------------------------------------------------- 4. Schätze graben

  baueSchaetze() {
    this.schaetze = [];
    for (let i = 0; i <= ANZAHL; i++) {
      const s = spr('spielplatz/schatz_' + SCHAETZE[i], { anchor: 0.5, z: 40, parent: this.welt });
      s.visible = false;
      s.imSand = false;
      s.frei = false;
      s.amTurm = false;
      s.proben = [];
      // Fangfläche über der Decke: erst aktiv, wenn der Schatz freigelegt ist
      const fang = new PIXI.Container({ label: 'schatzFang' });
      fang.zIndex = 60;
      this.welt.addChild(fang);
      tap(fang, () => this.hebeAuf(s), { sound: null, squash: false, hitArea: new PIXI.Circle(0, 0, 140) });
      fang.eventMode = 'none';
      s.fang = fang;
      // am Turm: antippen → wackelt und klingt
      tap(s, () => {
        if (s.amTurm || s.amHund) {
          fx.wobble(s, 0.12);
          note('xylo', pick(PENTA), { vol: 0.4 });
        }
      }, { sound: null, squash: true, hitArea: new PIXI.Circle(0, 0, 400) });
      s.eventMode = 'none';
      this.schaetze.push(s);
    }
    // der letzte ist der Bonus-Schatz (liegt während des Burgbaus im Sand)
    this.bonus = this.schaetze.pop();
    this.alleSchaetze = [...this.schaetze, this.bonus];
  }

  /** Bonus-Schatz unter den glatten Sand legen (nur während des Burgbaus; ein anderer als zuletzt) */
  versteckeBonus() {
    const s = this.bonus;
    if (!['fuellen', 'stuerzen', 'klopfen'].includes(this.phase) || s.imSand) return;
    const art = andere(SCHAETZE, s.art);
    killTweensOf(s);
    const id = 'spielplatz/schatz_' + art;
    s.texture = tex(id);
    s.label = id;
    s.art = art;
    s.scale.set(SCHATZ_GROESSE / Math.max(s.texture.width, s.texture.height));
    s.rotation = rand(-0.35, 0.35);
    s.alpha = 1;
    s.zIndex = 40;
    s.visible = true;
    s.imSand = true;
    s.frei = false;
    s.amHund = false;
    s.eventMode = 'none';
    s.fang.eventMode = 'none';
    this.setzeSchatz(s, pick(SCHATZ_SPALTEN) + rand(-40, 40), rand(SCHATZ_Y[0], SCHATZ_Y[1]));
  }

  /** Bonus-Schatz gefunden und angetippt: er fliegt zum Hund, der Hund freut sich */
  async bonusZumHund() {
    const s = this.bonus;
    if (!s.frei || !s.imSand) return;
    s.imSand = false;
    s.fang.eventMode = 'none';
    sfx('common/funkeln', { vol: 0.6 });
    this.burst('funkeln', s.x, s.y, { count: 5 });
    s.zIndex = 400;
    const ziel = { x: this.hund.x + 165, y: this.hund.y + 28 };
    const k = (DEKO_GROESSE * 1.15) / Math.max(s.texture.width, s.texture.height);
    this.tween(s, { rotation: 0.12 }, 0.6, { ease: 'sineInOut' });
    const ok = await bogenFlug(this, s, ziel.x, ziel.y, { hoehe: 220, min: 0.9, skala: k });
    if (!ok || s.imSand) return;
    s.zIndex = 60;
    tippGroesse(s);
    s.amHund = true;
    s.eventMode = 'static';
    sfx('common/plopp', { vol: 0.4 });
    this.hund.lookAt(s.x);
    freude(this, this.hund, { herzen: 4 });
  }

  starteGraben() {
    this.phase = 'graben';
    this.griffeAus();
    this.eimerRuhe();
    this.gefunden = 0;
    this.gegraben = false;
    // ein nicht gefundener Bonus-Schatz bleibt nicht unter dem neuen Sand liegen
    if (this.bonus.imSand) {
      this.bonus.imSand = false;
      this.bonus.fang.eventMode = 'none';
      this.tween(this.bonus, { alpha: 0 }, 1.0, { ease: 'sineInOut' })
        .then((ok) => { if (ok && !this.bonus.imSand) this.bonus.visible = false; });
    }
    // Der Sand wird glatt, darunter liegen neue Schätze
    this.glaetteSand(1.2);
    sfx('common/sand', { vol: 0.35 });
    this.after(1.25, () => { if (this.phase === 'graben') this.verteileSchaetze(); });
    this.sageSchritt(1.4);
  }

  verteileSchaetze() {
    const arten = shuffle([...SCHAETZE]).slice(0, ANZAHL);
    const spalten = shuffle([...SCHATZ_SPALTEN]).slice(0, ANZAHL);
    this.schaetze.forEach((s, i) => {
      killTweensOf(s);
      const id = 'spielplatz/schatz_' + arten[i];
      s.texture = tex(id);
      s.label = id;
      s.art = arten[i];
      const k = SCHATZ_GROESSE / Math.max(s.texture.width, s.texture.height);
      s.scale.set(k);
      s.rotation = rand(-0.35, 0.35);
      s.alpha = 1;
      s.zIndex = 40;
      s.visible = true;
      s.imSand = true;
      s.frei = false;
      s.amTurm = false;
      s.eventMode = 'none';
      s.fang.eventMode = 'none';
      this.setzeSchatz(s, spalten[i] + rand(-40, 40), rand(SCHATZ_Y[0], SCHATZ_Y[1]));
    });
  }

  // Schatz an eine Stelle im Sand legen (Fangfläche und Probepunkte wandern mit)
  setzeSchatz(s, x, y) {
    s.position.set(x, y);
    s.fang.position.set(x, y);
    tippGroesse(s);
    // Probepunkte: 3×3 Raster über dem Schatz
    s.proben = [];
    for (const fx_ of [-0.32, 0, 0.32]) {
      for (const fy of [-0.32, 0, 0.32]) {
        s.proben.push({ x: x + fx_ * SCHATZ_GROESSE, y: y + fy * SCHATZ_GROESSE, weg: false });
      }
    }
  }

  legeFrei(s) {
    if (s.frei || !s.imSand) return;
    s.frei = true;
    s.fang.eventMode = 'static';
    // leiser Hinweis: kurzes Funkeln, der Schatz wackelt
    this.burst('funkeln', s.x, s.y, { count: 3 });
    sfx('common/funkeln', { vol: 0.25 });
    fx.wobble(s, 0.1);
  }

  // Schmuck-Plätze an den Türmen: erst die Mitte jedes Turms, dann die Seiten des ersten
  dekoPlatz(i) {
    const n = this.form.length;
    const liste = [];
    for (let t = 0; t < n; t++) liste.push([t, 'deko_m']);
    liste.push([0, 'deko_l'], [0, 'deko_r'], [1, 'deko_l']);
    const [t, name] = liste[i % liste.length];
    const turm = this.tuerme[t];
    const p = hgPunkt(turm, name) || { x: turm.x, y: turm.y - 150 };
    return { x: p.x, y: p.y, turm };
  }

  async hebeAuf(s) {
    if (s === this.bonus) { this.bonusZumHund(); return; }
    if (!s.frei || !s.imSand || this.phase !== 'graben') return;
    s.imSand = false;
    s.fang.eventMode = 'none';
    const platz = this.dekoPlatz(this.gefunden);
    this.gefunden++;
    sfx('common/funkeln', { vol: 0.6 });
    this.burst('funkeln', s.x, s.y, { count: 5 });
    s.zIndex = 400;
    const k1 = DEKO_GROESSE / Math.max(s.texture.width, s.texture.height);
    this.tween(s, { rotation: rand(-0.15, 0.15) }, 0.6, { ease: 'sineInOut' });
    await bogenFlug(this, s, platz.x, platz.y, { hoehe: 240, min: 0.8, skala: k1 });
    s.zIndex = platz.turm.zIndex + 1;
    tippGroesse(s);
    s.amTurm = true;
    s.eventMode = 'static';
    sfx('common/plopp', { vol: 0.4 });
    fx.pop(s, 0.1);
    this.hund.lookAt(s.x);
    if (this.gefunden >= ANZAHL && this.phase === 'graben') this.after(0.7, () => this.starteFahnen());
  }

  // ---------------------------------------------------------------- 5. Fahnen

  starteFahnen() {
    this.phase = 'fahnen';
    this.griffeAus();
    this.eimerRuhe();
    const n = this.form.length;
    const farben = shuffle([...FARBEN]).slice(0, n);
    this.rundenFarbe = farben[0];
    this.fahnen.forEach((f, i) => {
      killTweensOf(f);
      f.tippGriff?.off();
      f.tippGriff = null;
      f.steckt = null;
      if (i >= n) { f.visible = false; return; }
      const o = FAHNEN_ORTE[i];
      f.tint = farben[i];
      f.position.set(o.x, o.y);
      f.rotation = 0;
      f.alpha = 1;
      f.scale.set(FAHNE_SKALA * 0.85);
      f.alpha = 0;
      f.zIndex = 90;
      f.visible = true;
      this.after(i * 0.2, () => {
        sfx('common/plopp', { vol: 0.3 });
        this.tween(f, { alpha: 1 }, 0.3, { ease: 'sineInOut' });
        this.tween(f, { scale: FAHNE_SKALA }, 0.45, { ease: 'backOut' });
      });
      // Wohin das Kind die Fahne auch zieht (oder sie nur antippt): sie steckt sich auf den nächsten freien Turm
      f.zug = drag(f, {
        back: false,
        lift: 1.08,
        hitArea: f.zugFlaeche,
        onDrop: () => {
          f.zIndex = 400;
          this.steckeFahne(f);
        },
      });
      this.griffe.push(f.zug);
    });
    this.sageSchritt(1.0);
  }

  freierTurm(x, y) {
    let best = null;
    let d0 = Infinity;
    for (let i = 0; i < this.form.length; i++) {
      const t = this.tuerme[i];
      if (t.fahne) continue;
      const d = Math.hypot(t.x - x, t.y - 250 * t.s - y);
      if (d < d0) { d0 = d; best = t; }
    }
    return best;
  }

  async steckeFahne(f) {
    if (f.steckt || this.phase !== 'fahnen') return;
    const t = this.freierTurm(f.x, f.y);
    if (!t) return;
    t.fahne = f;
    f.steckt = t;
    f.zug?.off();
    f.zug = null;
    f.eventMode = 'none';
    const p = hgPunkt(t, 'spitze') || { x: t.x, y: t.y - 470 * t.s };
    sfx('common/hupf', { vol: 0.3 });
    await bogenFlug(this, f, p.x, p.y + 8, { hoehe: 110, min: 0.55, skala: t.s * 0.95, drehung: 0 });
    f.zIndex = t.zIndex + 2;
    sfx('common/plopp', { vol: 0.45 });
    this.burst('funkeln', p.x + 30, p.y - 120 * t.s, { count: 3 });
    f.eventMode = 'static';
    // gesteckte Fahne: antippen → flattert kurz (auch nach dem Fertigwerden, bis die Burg wieder glatt wird)
    f.tippGriff = tap(f, () => {
      fx.wobble(f, 0.08);
      note('glocke', pick(PENTA), { vol: 0.25 });
    }, { sound: null, squash: false, hitArea: new PIXI.Rectangle(-260, -520, 580, 620) });
    if (this.phase === 'fahnen' && this.fahnen.slice(0, this.form.length).every((x) => x.steckt)) {
      this.after(0.6, () => this.starteWasser());
    }
  }

  // ---------------------------------------------------------------- 6. Wassergraben

  baueKanne() {
    const k = spr('common/giesskanne', { parent: this.welt });
    k.position.set(KANNE_HEIM.x, KANNE_HEIM.y);
    k.scale.set(KANNE_SKALA);
    k.zIndex = 90;
    k.visible = false;
    k.hitArea = new PIXI.Rectangle(-330, -280, 660, 560);
    this.kanne = k;
    this.giesst = false;      // gießt gerade (am Finger über der Burg oder von selbst)
    this.giesstSelbst = false;
    this.tropfenZeit = 0;
  }

  starteWasser() {
    this.phase = 'wasser';
    this.griffeAus();
    this.eimerRuhe();
    this.wasserStand = 0;
    // Der Graben zieht sich um die Burg (weich), die Gießkanne kommt
    sfx('common/graben', { vol: 0.45 });
    const g = this.grabenRing;
    g.visible = true;
    this.tween(g, { alpha: 1 }, 0.9, { ease: 'sineInOut' });
    for (const w of [0.6, 2.2, 4]) {
      this.burst('staub', BURG.x + Math.cos(w) * BURG.rx, BURG.y + Math.sin(w) * BURG.ry, { count: 2 });
    }
    this.wasser.visible = true;
    this.wasser.alpha = 0;
    const k = this.kanne;
    killTweensOf(k);
    k.position.set(KANNE_HEIM.x, KANNE_HEIM.y);
    k.rotation = 0;
    k.scale.set(KANNE_SKALA * 0.85);
    k.alpha = 0;
    this.tween(k, { alpha: 1 }, 0.4, { ease: 'sineInOut', delay: 0.5 });
    k.visible = true;
    k.zIndex = 90;
    this.after(0.5, () => {
      sfx('common/plopp', { vol: 0.35 });
      this.tween(k, { scale: KANNE_SKALA }, 0.45, { ease: 'backOut' });
    });
    this.kanneZug = drag(k, {
      back: false,
      lift: 1.06,
      hitArea: k.hitArea,
      onDrop: () => {
        k.zIndex = 400;
        // nicht voll: die Kanne setzt sich an den Graben und gießt von selbst weiter
        if (this.wasserStand < 1) this.kanneAnDenGraben();
      },
    });
    this.griffe.push(this.kanneZug);
    this.sageSchritt(1.2);
  }

  async kanneAnDenGraben() {
    const k = this.kanne;
    const ok = await bogenFlug(this, k, GIESS_ORT.x, GIESS_ORT.y, { hoehe: 90, min: 0.45 });
    if (ok && this.phase === 'wasser' && !this.kanneZug?.isDragging()) this.giesstSelbst = true;
  }

  tuelle() {
    return hgPunkt(this.kanne, 'tuelle') || { x: this.kanne.x + 90, y: this.kanne.y - 30 };
  }

  ueberDerBurg() {
    const p = this.tuelle();
    const nx = (p.x - BURG.x) / (BURG.rx + 90);
    const ny = (p.y - BURG.y) / (BURG.ry + 140);
    return nx * nx + ny * ny <= 1;
  }

  wasserUpdate(dt) {
    // Weggeblättert (auch während des Gleitens) gießt nichts: Ton aus, bis die Seite wieder zu sehen ist
    if (!this.aktiv) {
      if (this.giesst) {
        this.giesst = false;
        this.giessTon.aus();
      }
      return;
    }
    if (this.phase !== 'wasser' || !this.kanne.visible) return;
    const k = this.kanne;
    const amFinger = this.kanneZug?.isDragging();
    if (amFinger) this.giesstSelbst = false;
    const giesst = this.wasserStand < 1 && ((amFinger && this.ueberDerBurg()) || this.giesstSelbst);
    const ziel = giesst ? 0.55 : 0;
    k.rotation += (ziel - k.rotation) * Math.min(1, dt * 5);
    if (giesst !== this.giesst) {
      this.giesst = giesst;
      if (giesst) this.giessTon.an(); else this.giessTon.aus();
    }
    if (!giesst || k.rotation < 0.3) return;
    this.wasserStand = Math.min(1, this.wasserStand + dt / 3.4);
    this.wasser.alpha = 0.92 * this.wasserStand;
    this.tropfenZeit -= dt;
    if (this.tropfenZeit <= 0) {
      this.tropfenZeit = 0.32;
      const p = this.tuelle();
      this.burst('tropfen', p.x + 10, p.y + 10, { count: 2 });
    }
    if (this.wasserStand >= 1) this.wasserFertig();
  }

  async wasserFertig() {
    this.phase = 'fertig';
    this.giesst = false;
    this.giesstSelbst = false;
    this.giessTon.aus();
    this.griffeAus();
    this.eimerRuhe();
    this.kanneZug = null;
    sfx('common/platsch', { vol: 0.4 });
    this.burst('funkeln', BURG.x - 300, BURG.y + 150, { count: 3 });
    const k = this.kanne;
    k.eventMode = 'none';
    this.tween(k, { rotation: 0 }, 0.3, { ease: 'sineInOut' });
    this.after(0.35, () => {
      bogenFlug(this, k, KANNE_HEIM.x, KANNE_HEIM.y, { hoehe: 120, min: 0.6, skala: KANNE_SKALA * 0.6 }).then((ok) => {
        if (ok) this.tween(k, { alpha: 0 }, 0.5, { ease: 'sineInOut' }).then((ok2) => { if (ok2) k.visible = false; });
      });
    });
    await this.wait(0.8);
    this.ueberraschen();
    await this.wait(1.6);
    this.finale();
  }

  // Kleine Überraschung im Wasser (jede Runde eine andere)
  ueberraschen() {
    const art = andere(UEBERRASCHUNGEN, this.ueberraschung);
    this.ueberraschung = art;
    const vorn = BURG.y + BURG.ry - BURG.dy / 2;
    if (art === 'gummiente') {
      const e = this.gummiente;
      killTweensOf(e);
      e.position.set(BURG.x + rand(-200, 200), vorn + 12);
      e.basisY = e.y;
      const k = 110 / 300;
      e.scale.set(k * 0.3);
      e.alpha = 1;
      e.visible = true;
      sfx('common/platsch', { vol: 0.35 });
      this.burst('tropfen', e.x, e.y - 20, { count: 4 });
      this.tween(e, { scale: k }, 0.5, { ease: 'backOut' });
      return;
    }
    const a = this.gaeste[art];
    const vonLinks = art === 'ente';
    a.stop();
    a.position.set(vonLinks ? -760 : 820, 1010);
    a.alpha = 0;
    a.visible = true;
    a.pose('idle');
    this.tween(a, { alpha: 1 }, 0.4, { ease: 'sineInOut' });
    a.hopTo(BURG.x + (vonLinks ? -230 : 280), vorn + 8, { hoehe: 110, dauer: 0.9 }).then((ok) => {
      if (!ok) return;
      sfx('common/platsch', { vol: 0.4 });
      this.burst('tropfen', a.x, a.y - 10, { count: 4 });
      freude(this, a, { herzen: 3, hoehe: 30 });
    });
  }

  // ---------------------------------------------------------------- 7. Fertig

  async finale() {
    this.phase = 'fertig';
    await this.wait(0.3);
    freude(this, this.hund, { herzen: 6 });
    // seitlich der Burg (über der Mitte verdeckte das Sticker-Bild kurz die Fahne des großen Turms)
    belohne(this, stickerFuer('schatz'), BURG.x + 560, 470);
    this.neuerWimpel(this.rundenFarbe ?? pick(FARBEN));
    await this.wait(2.4);
    // nächste Runde: der leere Eimer wartet; sobald Sand hineinkommt, wird die alte Burg glatt
    this.alteBurg = true;
    this.starteFuellen();
    this.sage('spielplatz_kuchen', () => !this.kuchenGetippt && this.phase === 'fuellen' && this.alteBurg, 6);
  }

  // Die fertige Burg wird weich wieder glatter Sand; die nächste Burg bekommt eine andere Form
  baueAb() {
    this.alteBurg = false;
    sfx('common/sand', { vol: 0.5 });
    const weg = (o, props = {}) => {
      if (!o.visible) return;
      killTweensOf(o);
      o.eventMode = 'none';
      this.tween(o, { alpha: 0, ...props }, 1.0, { ease: 'sineInOut' }).then((ok) => { if (ok) o.visible = false; });
    };
    for (const t of this.tuerme) {
      if (t.visible) this.burst('staub', t.x, t.y - 40, { count: 4 });
      weg(t, { scaleY: t.scale.y * 0.3, scaleX: t.scale.x * 1.15 });
      t.fahne = null;
    }
    for (const f of this.fahnen) {
      weg(f);
      f.steckt = null;
      f.tippGriff?.off();
      f.tippGriff = null;
    }
    for (const s of this.schaetze) { weg(s); s.amTurm = false; }
    if (!this.bonus.imSand) { weg(this.bonus); this.bonus.amHund = false; }
    this.after(1.25, () => this.versteckeBonus());
    weg(this.grabenRing);
    weg(this.wasser);
    weg(this.gummiente);
    for (const a of Object.values(this.gaeste)) weg(a);
    this.glaetteSand(1.2);
    this.formNr = FORMEN.indexOf(andere(FORMEN, FORMEN[this.formNr]));
    this.form = FORMEN[this.formNr];
    this.turmNr = 0;
  }

  // ---------------------------------------------------------------- Wimpel am hinteren Rand (wachsen mit den Runden)

  baueWimpel() {
    this.wimpel = [];
    wimpelFarben.forEach((farbe, i) => this.setzeWimpel(farbe, i, false));
  }

  setzeWimpel(farbe, i, neu) {
    const w = spr('spielplatz/fahne', { x: WIMPEL_X[i], y: WIMPEL_Y, parent: this.welt, z: 58 });
    w.tint = farbe;
    w.scale.set(WIMPEL_SKALA);
    w.phase = rand(0, 6);
    tap(w, () => {
      fx.wobble(w, 0.1);
      note('pling', pick(PENTA) + 12, { vol: 0.25 });
    }, { sound: null, squash: false, hitArea: new PIXI.Rectangle(-210, -420, 500, 500) });
    if (neu) {
      w.scale.set(WIMPEL_SKALA * 0.3);
      this.tween(w, { scale: WIMPEL_SKALA }, 0.5, { ease: 'backOut' });
      this.burst('funkeln', w.x + 20, w.y - 60, { count: 3 });
    }
    this.wimpel[i] = w;
  }

  neuerWimpel(farbe) {
    if (wimpelFarben.length >= WIMPEL_X.length) {
      // alle Plätze voll: der älteste geht, die anderen rücken weich nach
      wimpelFarben.shift();
      const alt = this.wimpel.shift();
      if (alt) this.tween(alt, { alpha: 0 }, 0.6, { ease: 'sineInOut' }).then(() => { if (!alt.destroyed) alt.destroy(); });
      this.wimpel.forEach((w, i) => this.tween(w, { x: WIMPEL_X[i] }, 0.8, { ease: 'sineInOut' }));
    }
    wimpelFarben.push(farbe);
    this.setzeWimpel(farbe, wimpelFarben.length - 1, true);
  }

  // ---------------------------------------------------------------- Hund

  baueHund() {
    // sitzt hinten am Rand des Sandkastens und schaut zu
    this.hund = new Actor('hund', { x: 30, y: 352, scale: 0.26, parent: this.welt, z: 59 });
    this.hund.onTap(() => freude(this, this.hund));
  }

  // ---------------------------------------------------------------- Förmchen und Sandkuchen

  baueFoermchen() {
    this.plaetze = [
      { x: -860, y: 905 }, { x: 860, y: 905 }, { x: 870, y: 1225 },
    ].map((p) => ({ ...p, kuchen: null, zeit: 0 }));
    this.kuchenNr = 0;
    this.foermchen = [
      { art: 'stern', x: -860, y: 600 },
      { art: 'fisch', x: 880, y: 600 },
    ].map((o) => {
      const f = spr('spielplatz/foermchen_' + o.art, { x: o.x, y: o.y, scale: 0.68, z: 55, parent: this.welt });
      f.art = o.art;
      f.heim = { x: o.x, y: o.y };
      f.beschaeftigt = false;
      tap(f, () => this.backe(f), { sound: null, squash: true, pad: 50 });
      return f;
    });
  }

  freierPlatz(f) {
    // Jedes Förmchen backt auf seiner Seite (kein weiter Flug quer über den Sandkasten): freier Platz dort, sonst
    // zerfällt dort der älteste Kuchen und der neue entsteht an seiner Stelle. Nur zur Sicherheit: irgendein Platz.
    const eigene = this.plaetze.filter((p) => Math.sign(p.x) === Math.sign(f.heim.x));
    const frei = eigene.find((p) => !p.kuchen && !p.reserviert);
    if (frei) return frei;
    const aelteste = (liste) => liste.filter((p) => p.kuchen && !p.reserviert).sort((a, b) => a.zeit - b.zeit)[0];
    const alt = aelteste(eigene) || this.plaetze.find((p) => !p.kuchen && !p.reserviert) || aelteste(this.plaetze);
    if (alt) this.zerfalle(alt);
    return alt || null;
  }

  async backe(f) {
    this.kuchenGetippt = true;   // das Kind kennt die Förmchen schon: kein Hinweis mehr darauf
    if (f.beschaeftigt) {
      fx.wobble(f, 0.06);
      return;
    }
    const platz = this.freierPlatz(f);
    if (!platz) { fx.wobble(f, 0.06); return; }
    f.beschaeftigt = true;
    platz.reserviert = true;
    f.zIndex = 90;
    const k = f.scale.x;
    sfx('common/hupf', { vol: 0.35 });
    // hinüberhüpfen
    const x0 = f.x;
    const y0 = f.y;
    const proxy = { p: 0 };
    await this.tween(proxy, { p: 1 }, flugDauer(platz.x - x0, platz.y - y0, 120, 0.55), {
      ease: 'sineInOut',
      onUpdate: () => {
        f.x = x0 + (platz.x - x0) * proxy.p;
        f.y = y0 + (platz.y - y0) * proxy.p - 120 * 4 * proxy.p * (1 - proxy.p);
      },
    });
    // andrücken
    await this.tween(f, { scaleX: k * 1.08, scaleY: k * 0.86 }, 0.18, { ease: 'quadOut' });
    sfx('common/sand', { vol: 0.5 });
    // Kuchen entsteht unter dem Förmchen
    const kuchen = spr('spielplatz/sandkuchen_' + f.art, { x: platz.x, y: platz.y, scale: 0.6, z: 52, parent: this.welt });
    kuchen.alpha = 0;
    platz.kuchen = kuchen;
    platz.zeit = ++this.kuchenNr;
    this.tween(kuchen, { alpha: 1 }, 0.3, { ease: 'sineInOut' });
    tap(kuchen, () => this.zerfalle(platz), { sound: null, squash: true, pad: 50 });
    await this.tween(f, { scaleX: k, scaleY: k, y: platz.y - 110 }, 0.35, { ease: 'backOut' });
    this.burst('staub', platz.x, platz.y - 20, { count: 5 });
    platz.reserviert = false;
    // zurück an den Platz
    const x1 = f.x;
    const y1 = f.y;
    proxy.p = 0;
    await this.tween(proxy, { p: 1 }, flugDauer(f.heim.x - x1, f.heim.y - y1, 80, 0.55), {
      ease: 'sineInOut',
      onUpdate: () => {
        f.x = x1 + (f.heim.x - x1) * proxy.p;
        f.y = y1 + (f.heim.y - y1) * proxy.p - 80 * 4 * proxy.p * (1 - proxy.p);
      },
    });
    f.zIndex = 55;
    f.beschaeftigt = false;
  }

  zerfalle(platz) {
    const kuchen = platz.kuchen;
    if (!kuchen || kuchen.zerfaellt) return;
    kuchen.zerfaellt = true;
    kuchen.eventMode = 'none';
    platz.kuchen = null;
    sfx('common/sand', { vol: 0.55 });
    this.burst('staub', kuchen.x, kuchen.y - 50, { count: 7 });
    const k = kuchen.scale.y;
    killTweensOf(kuchen);
    this.tween(kuchen, { scaleY: k * 0.25, scaleX: k * 1.3, alpha: 0 }, 0.8, { ease: 'sineInOut' })
      .then(() => { if (!kuchen.destroyed) kuchen.destroy(); });
  }

  // ---------------------------------------------------------------- Schaufel (schippt den Sand in den Eimer)

  baueSchaufel() {
    const h = SCHAUFEL_HEIM;
    const s = spr('spielplatz/schaufel_gross', { x: h.x, y: h.y, scale: 0.46, rotation: h.rotation, z: 85, parent: this.welt });
    this.schaufel = s;
    tap(s, () => {
      if (this.phase === 'fuellen') { this.schippe(); return; }
      if (this.schippt) return;
      fx.wobble(s, 0.1);
      sfx('common/graben', { vol: 0.45 });
      this.burst('staub', s.x + 20, s.y + 90, { count: 4 });
    }, { sound: null, squash: false, pad: 70 });
  }

  // ---------------------------------------------------------------- Seite

  betreten() {
    // Hinweis zum laufenden Schritt bei jedem Betreten anmelden (der Kern sagt jeden höchstens einmal am Tag) – nur,
    // solange die Seite zu sehen ist und das Kind den Schritt noch nicht selbst tut
    this.hinweiseAus();
    this.sageSchritt(this.besuche === 1 ? 0.6 : 1.2);
  }

  verlassen() {
    this.finger.clear();
    this.hinweiseAus();
    if (this.giesst) {
      this.giesst = false;
      this.giessTon.aus();
    }
  }

  hinweiseAus() {
    for (const h of this._hinweise || []) h?.kill();
    this._hinweise = [];
  }

  update(dt, t) {
    this.zeit = t;
    this.falter.update(dt);
    this.wasserUpdate(dt);
    // gesteckte Fahnen und Wimpel flattern ganz leicht, die Quietscheente schaukelt
    for (const f of this.fahnen) if (f.steckt && f.visible) f.skew.y = Math.sin(t * 1.6 + f.x * 0.01) * 0.035;
    for (const w of this.wimpel) if (w && !w.destroyed) w.skew.y = Math.sin(t * 1.3 + w.phase) * 0.04;
    const e = this.gummiente;
    if (e.visible && e.basisY !== undefined) {
      e.y = e.basisY + Math.sin(t * 1.4) * 4;
      e.rotation = Math.sin(t * 1.1) * 0.06;
    }
  }

  hinweise() {
    switch (this.phase) {
      case 'fuellen':
        return this.schippt ? [] : [this.eimer];
      case 'stuerzen':
        return this.stuerzt ? [] : [{ von: this.eimer, nach: this.zielMerker }];
      case 'klopfen':
        return this.hebt ? [] : [this.eimer];
      case 'graben': {
        const frei = this.schaetze.find((s) => s.frei && s.imSand);
        if (frei) return [{ x: frei.x, y: frei.y }];
        const ziel = this.schaetze.find((s) => s.imSand && !s.frei);
        if (ziel && !this.graben.isDone()) {
          this.handVon.position.set(ziel.x - 220, ziel.y - 60);
          this.handNach.position.set(ziel.x + 200, ziel.y + 60);
          return [{ von: this.handVon, nach: this.handNach }];
        }
        return [];
      }
      case 'fahnen': {
        const f = this.fahnen.find((x, i) => i < this.form.length && !x.steckt && x.eventMode !== 'none');
        const t = f && this.freierTurm(f.x, f.y);
        if (!t) return [];
        const p = hgPunkt(t, 'spitze') || { x: t.x, y: t.y - 300 };
        this.zielMerker.position.set(p.x, p.y);
        return [{ von: f, nach: this.zielMerker }];
      }
      case 'wasser':
        return this.giesstSelbst || this.kanneZug?.isDragging() ? [] : [{ von: this.kanne, nach: this.giessMerker }];
      default:
        return [this.foermchen[0]];
    }
  }
}

// Die beiden gezeichneten Hilfsbilder des Sandkastens schon beim Betreten des Spielplatzes anlegen (die Blende ist
// dann noch zu), damit das erste Umblättern zum Sandkasten nichts mehr zeichnen muss.
export function sandkastenVorbereiten() {
  grubeTextur();
  gegenMaske();
}

// Leinwände für Texturen werden mit willReadFrequently angelegt: Dann liegen sie im Arbeitsspeicher, und das
// Hochladen zur Grafikkarte ist eine einfache Kopie. Eine Leinwand auf der Grafikkarte müsste dafür erst
// zurückgelesen werden – das ließ das Umblättern spürbar stocken.

// Gegrabener (etwas feuchterer, dunklerer) Sand mit weichem Rand und ein paar Krümeln, so groß wie die ganze
// Sandfläche – einmal je Modul gezeichnet und wiederverwendet (Texturen aus Leinwänden nie pro Besuch anlegen).
const GRUBE = { w: 964, h: 448 };   // = SAND_BOX × 0,4
let grubeTex = null;
function grubeTextur() {
  if (grubeTex && !grubeTex.destroyed) return grubeTex;
  const c = document.createElement('canvas');
  c.width = GRUBE.w;
  c.height = GRUBE.h;
  const g = c.getContext('2d', { willReadFrequently: true });
  const k = GRUBE.w / SAND_BOX.w;
  const mx = SAND_BOX.x + SAND_BOX.w / 2;
  const my = SAND_BOX.y + SAND_BOX.h / 2;
  const trapez = (einzug) => {
    // Sandfläche, zur Mitte hin um den Anteil `einzug` eingerückt
    g.beginPath();
    SAND.forEach(([x, y], i) => {
      const px = (x + (mx - x) * einzug - SAND_BOX.x) * k;
      const py = (y + (my - y) * einzug - SAND_BOX.y) * k;
      if (i === 0) g.moveTo(px, py);
      else g.lineTo(px, py);
    });
    g.closePath();
    g.fill();
  };
  g.filter = 'blur(10px)';
  g.fillStyle = 'rgba(150, 95, 40, 0.30)';
  trapez(0.03);
  g.filter = 'blur(16px)';
  g.fillStyle = 'rgba(135, 85, 35, 0.12)';
  trapez(0.25);
  g.filter = 'none';
  // Krümel: kleine dunkle und helle Tupfer (fester Zufall, damit es immer gleich aussieht)
  let z = 7;
  const zufall = () => {
    z = (z * 16807) % 2147483647;
    return z / 2147483647;
  };
  for (let i = 0; i < 160; i++) {
    const x = 40 + zufall() * (GRUBE.w - 80);
    const y = 30 + zufall() * (GRUBE.h - 60);
    const hell = zufall() < 0.4;
    g.fillStyle = hell ? 'rgba(255, 236, 190, 0.22)' : 'rgba(140, 90, 40, 0.14)';
    g.beginPath();
    g.ellipse(x, y, 1 + zufall() * 2, 0.8 + zufall() * 1.5, 0, 0, Math.PI * 2);
    g.fill();
  }
  grubeTex = PIXI.Texture.from(c);
  return grubeTex;
}

// Decke = gemalter Sand des Hintergrunds im Trapez der Sandfläche, Rand weich ausgeblendet. Sie entsteht ganz auf
// der Grafikkarte: Hintergrund-Ausschnitt in eine RenderTexture zeichnen, außerhalb des Trapezes mit einer weichen
// Gegen-Maske ('erase') wegnehmen. So wird bei jedem Besuch nichts auf dem Prozessor gemalt, nichts zurückgelesen
// und nichts zusätzlich hochgeladen – das Umblättern zum Sandkasten stockt nicht. (wipe() kann eine RenderTexture nicht auslesen und
// zählt dann die Zellen einer Ellipse über der Fläche – die liegt ganz im Sand; die Ecken muss niemand freilegen.)
// Die Textur gehört zu einem Besuch und wird mit der Decke zerstört (siehe baueDecke).
function deckenTextur(hg) {
  try {
    const b = SAND_BOX;
    const rt = PIXI.RenderTexture.create({
      width: Math.round(b.w * DECKE_RES), height: Math.round(b.h * DECKE_RES), resolution: 1,
    });
    // Bühne in Decken-Bildpunkten: Ursprung = linke obere Ecke der SAND_BOX
    const buehne = new PIXI.Container();
    buehne.scale.set(DECKE_RES);
    buehne.position.set(-b.x * DECKE_RES, -b.y * DECKE_RES);
    const bild = new PIXI.Sprite(hg.texture);
    bild.anchor.copyFrom(hg.anchor);
    bild.scale.copyFrom(hg.scale);
    bild.position.set(hg.x, hg.y);
    bild.rotation = hg.rotation;
    const weg = new PIXI.Sprite(gegenMaske());
    weg.position.set(b.x, b.y);
    weg.scale.set(b.w / MASKE.w, b.h / MASKE.h);
    weg.blendMode = 'erase';
    buehne.addChild(bild, weg);
    stage.app.renderer.render({ container: buehne, target: rt, clear: true, clearColor: [0, 0, 0, 0] });
    buehne.destroy({ children: true });
    return rt;
  } catch (err) {
    console.warn('[spielplatz] Sanddecke aus dem Hintergrund nicht möglich:', err);
    return null;
  }
}

// Gegen-Maske der Decke: undurchsichtig außerhalb des Sand-Trapezes, durchsichtig darin, weicher Übergang. Klein
// (SAND_BOX × 0,25) und nur einmal je Modul gezeichnet und hochgeladen – weich wird sie beim Vergrößern ohnehin.
const MASKE = { w: 603, h: 280 };
let maskeTex = null;
function gegenMaske() {
  if (maskeTex && !maskeTex.destroyed) return maskeTex;
  const c = document.createElement('canvas');
  c.width = MASKE.w;
  c.height = MASKE.h;
  const g = c.getContext('2d', { willReadFrequently: true });
  const kx = MASKE.w / SAND_BOX.w;
  const ky = MASKE.h / SAND_BOX.h;
  g.fillStyle = '#000';
  g.fillRect(0, 0, MASKE.w, MASKE.h);
  // Trapez ausstanzen, mit weichem Rand (wie zuvor 6 Bildpunkte bei 0,6 → hier 2,5 bei 0,25)
  g.globalCompositeOperation = 'destination-out';
  g.filter = 'blur(2.5px)';
  g.beginPath();
  SAND.forEach(([x, y], i) => {
    const px = (x - SAND_BOX.x) * kx;
    const py = (y - SAND_BOX.y) * ky;
    if (i === 0) g.moveTo(px, py);
    else g.lineTo(px, py);
  });
  g.closePath();
  g.fill();
  maskeTex = PIXI.Texture.from(c);
  return maskeTex;
}

// Tippfläche eines Schatzes: immer etwa 260 Einheiten, egal wie groß er gerade gezeigt wird
function tippGroesse(s) {
  const k = Math.abs(s.scale.x) || 1;
  if (s.hitArea) s.hitArea.radius = 130 / k;
}
