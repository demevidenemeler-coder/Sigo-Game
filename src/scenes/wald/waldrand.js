// Seite 4 – Waldrand: zwei neue Abläufe nebeneinander, beide jederzeit spielbar.
//
// Rechts – Vogelhaus bauen (je Runde 10 geführte Schritte):
//   1. Dach – das Dach liegt im Gras; aufs Vogelhaus ziehen (oder antippen): es setzt sich obendrauf.
//   2. Nägel – zwei leuchtende Nägel antippen: ein kleiner Hammer klopft sie fest.
//   3. Aufhängen – das Vogelhaus an den leuchtenden Platz am Ast ziehen (oder antippen); es schaukelt sanft.
//   4. Körner – dreimal die Körnerschüssel antippen: Körner fliegen hinein, die Schale wird voll.
//   5. Vögel – drei Vögel kommen nacheinander, setzen sich und picken. Jeden antippen: er singt sein Lied.
//      Haben alle gesungen: ein Sticker. Dann fliegen sie weiter, ein neues Vogelhaus liegt bereit.
//   Was sich ändert: 3 von 4 Vögeln (am längsten nicht dran), wer wo sitzt, die Dachfarbe.
//   Was wächst: die fertigen Vogelhäuser bleiben am Ast hängen (bis 3, gespeichert; das älteste macht Platz).
//
// Links – Eichhörnchen versteckt Nüsse für den Winter (je Runde 9 geführte Schritte):
//   1. Verstecken – eine Stelle im Gras leuchtet: antippen, das Eichhörnchen holt eine Nuss, gräbt sie ein (3×).
//   2. Winter – eine Wolke zieht heran: antippen, es schneit leise, das Eichhörnchen schläft ein.
//   3. Wecken – das schlafende Eichhörnchen antippen: es wacht hungrig auf.
//   4. Wiederfinden – die verschneiten Hügel antippen: es gräbt die Nüsse aus und frisst (3×). Manchmal wartet
//      eine kleine Überraschung im Hügel (ein Wurm guckt heraus, ein Pilz wächst).
//   5. Frühling – der Schnee taut, eine Gießkanne steht bereit: antippen, das Bäumchen wird gegossen und wächst.
//   Was sich ändert: andere Verstecke, Eicheln oder Kastanien, Überraschungen.
//   Was wächst: das Bäumchen – über die Besuche vom Keimling zum jungen Baum (gespeichert).

import { spr, tex, meta, sfx, voice, note, tap, drag, Actor, fx, store, rand, pick, shuffle, clamp, killTweensOf, PIXI } from '../../engine/index.js';
import { Seite } from '../../gemeinsam/seiten.js';
import { belohne } from '../../gemeinsam/sticker.js';
import { jubel, laut, blase, bogen, waehleArten, waehleSticker } from './deko.js';

// ---------------------------------------------------------------- Vogelhaus
const BAUPLATZ = { x: 470, y: 1190 };              // Mitte des Unterteils beim Bauen
const DACH_START = { x: 720, y: 1370 };            // Dach liegt im Gras (weg von der Ecke unten rechts)
const SCHALE = { x: 905, y: 1165 };                // Körnerschüssel (unten Mitte)
const UNTEN_BREITE = 250;
const DACH_BREITE = 290;
const DACH_UEBERLAPP = 72;                         // so tief sitzt das Dach über den Pfosten
const SEIL = 46;                                   // Seil vom Aufhänge-Punkt bis zum Ring
const SEIL_UEBER_AST = 62;                         // so weit reicht das Seil noch nach oben in den Ast
const HAENGT_SKALA = 0.85;                         // kleiner als beim Bauen: hängt frei über dem Eichhörnchen
// Plätze am Ast (Unterseite des Asts); Hintergrund hg_waldrand
const AST_PLAETZE = [{ x: -300, y: 448 }, { x: 15, y: 458 }, { x: 330, y: 468 }];
const HAEUSER_SPEICHER = 'wald.vogelhaeuser';
const HAEUSER_MAX = 3;
const DACH_FARBEN = [0xf08a7e, 0x8fc3ec, 0xa6d98a, 0xf6cf6a, 0xc9a6e6];
const NAEGEL = [{ x: -102, y: -112 }, { x: 102, y: -112 }];   // im Haus (unskaliert)
const VOEGEL = ['meise', 'rotkehlchen', 'gimpel', 'spatz'];
const VOEGEL_SPEICHER = 'wald.zuletzt.voegel';
const VOGEL_HOEHE = 150;
// Lieder: [midi, Instrument, Abstand bis zum nächsten Ton]
const LIEDER = {
  meise: [[88, 'floete', 0.17], [88, 'floete', 0.17], [81, 'floete', 0.3]],
  rotkehlchen: [[91, 'pling', 0.12], [89, 'pling', 0.12], [86, 'pling', 0.12], [88, 'pling', 0.12], [84, 'pling', 0.2]],
  gimpel: [[76, 'floete', 0.42], [74, 'floete', 0.5]],
  spatz: [[86, 'pling', 0.15], [86, 'pling', 0.15], [83, 'pling', 0.15], [86, 'pling', 0.2]],
};

// ---------------------------------------------------------------- Eichhörnchen und Bäumchen
// Heimplatz rechts unterhalb des linken Ast-Platzes (das Haus dort hängt nicht auf seinem Kopf)
const EICH_HEIM = { x: -130, y: 1165 };
const EICH_HOEHE = 270;
const VORRAT = { x: 25, y: 1190 };                 // Nüsse neben dem Eichhörnchen
const VERSTECKE = [
  { x: -920, y: 1265 }, { x: -720, y: 1440 }, { x: -620, y: 1225 }, { x: -450, y: 1425 }, { x: -220, y: 1440 },
];
const NUESSE_PRO_RUNDE = 3;
const BAUM = { x: -770, y: 1075 };
const BAUM_SPEICHER = 'wald.baeumchen';
// Stufen des Bäumchens: Bild und Höhe (Einheiten)
const BAUM_STUFEN = [
  ['keimling', 170], ['keimling', 230], ['baeumchen', 290], ['baeumchen', 350], ['baeumchen', 410], ['baeumchen', 470], ['baeumchen', 530],
];
const KANNE = { x: -470, y: 1085 };
const SCHNEE_FLOCKEN = 18;
const SCHNEE_ALPHA = 0.72;

// weicher Schnee auf dem Boden (oben weich auslaufend) – einmal pro Modul
let schneeTex = null;
function schneeTextur() {
  if (!schneeTex) {
    const c = document.createElement('canvas');
    c.width = 16;
    c.height = 256;
    const g = c.getContext('2d');
    const v = g.createLinearGradient(0, 0, 0, 256);
    v.addColorStop(0, 'rgba(246,250,255,0)');
    v.addColorStop(0.16, 'rgba(246,250,255,0.75)');
    v.addColorStop(0.3, 'rgba(246,250,255,0.95)');
    v.addColorStop(1, 'rgba(240,246,255,1)');
    g.fillStyle = v;
    g.fillRect(0, 0, 16, 256);
    schneeTex = PIXI.Texture.from(c);
  }
  return schneeTex;
}

// weiches Leuchten (Ellipse) als Zeichen „hier geht es weiter"
function leuchten(rx, ry, farbe = 0xfff1b8) {
  const g = new PIXI.Graphics()
    .ellipse(0, 0, rx, ry).fill({ color: farbe, alpha: 0.35 })
    .ellipse(0, 0, rx * 0.68, ry * 0.68).fill({ color: farbe, alpha: 0.45 });
  g.eventMode = 'none';
  return g;
}

export class Waldrand extends Seite {
  static hg = 'wald/hg_waldrand';

  aufbau() {
    this.zuletzt = 'vogel';     // welcher Ablauf zuletzt berührt wurde (zuerst zeigt die Hand dorthin)
    this.uhr = 0;
    this.leuchtende = [];
    this.baueSchnee();
    this.baueHaengende();
    this.baueSchale();
    this.koernerPool = [];
    for (let i = 0; i < 12; i++) {
      const k = new PIXI.Graphics().ellipse(0, 0, 11, 8).fill(pick([0xd9a441, 0xb8743a, 0xf0d58a, 0x8a5a35]));
      k.visible = false;
      k.eventMode = 'none';
      k.zIndex = 5200;
      this.welt.addChild(k);
      this.koernerPool.push(k);
    }
    this.voegel = [];
    this.vogelRunde = 0;
    this.neuesHaus(true);

    this.baueBaum();
    this.baueEichhoernchen();
    this.baueVerstecke();
    this.neueNussRunde(true);
    this.every(8, () => { if (this.aktiv) this.erinnern(); });
  }

  betreten() {
    if (this.besuche === 1) {
      this.after(1, () => voice('wald_vogelhaus', { nurWenn: () => this.aktiv && this.vPhase === 'dach' }));
      this.after(10, () => voice('wald_nuesse', { nurWenn: () => this.aktiv && this.nPhase === 'verstecken' && this.versteckt === 0 && !this.nussLaeuft }));
    }
  }

  verlassen() {}

  // ================================================================ Vogelhaus

  // Ein Vogelhaus: Container mit Unterteil (leer/voll) und Dach; Ursprung = Aufhänge-Punkt (oberes Seilende)
  bauHaus(farbe, mitDach) {
    const h = new PIXI.Container({ label: 'vogelhaus' });
    const uS = UNTEN_BREITE / (tex('wald/vogelhaus_leer').width || 420);
    const uH = (tex('wald/vogelhaus_leer').height || 390) * uS;
    const dS = DACH_BREITE / (tex('wald/vogelhaus_dach').width || 420);
    const dH = (tex('wald/vogelhaus_dach').height || 345) * dS;
    h.dachY = -uH / 2 - dH / 2 + DACH_UEBERLAPP;            // Dachmitte relativ zur Mitte des Unterteils
    h.ringY = h.dachY - dH / 2;                             // oberster Punkt (Ring)
    h.innen = new PIXI.Container();                         // Mitte des Unterteils = (0, 0)
    h.addChild(h.innen);
    // das Seil reicht ein Stück über den Aufhänge-Punkt hinaus bis in den Ast (sonst schwebt das Haus darunter)
    h.seil = new PIXI.Graphics().moveTo(0, h.ringY - SEIL - SEIL_UEBER_AST).lineTo(0, h.ringY + 14).stroke({ width: 7, color: 0x7a5a3a });
    h.seil.visible = false;
    h.leer = spr('wald/vogelhaus_leer', { anchor: 0.5, scale: uS, parent: h.innen });
    h.voll = spr('wald/vogelhaus', { anchor: 0.5, scale: uS, parent: h.innen });
    h.voll.alpha = 0;
    h.dach = spr('wald/vogelhaus_dach', { anchor: 0.5, scale: dS, parent: h.innen });
    h.dach.tint = farbe;
    h.dach.y = h.dachY;
    h.dach.visible = mitDach;
    h.innen.addChildAt(h.seil, 0);
    h.farbe = farbe;
    h.schaukel = rand(0, 10);
    h.haengt = false;
    for (const c of [h.leer, h.voll, h.dach]) c.eventMode = 'none';
    return h;
  }

  // Ein fertiges Haus an einen Ast-Platz hängen (ohne Bewegung)
  setzeAnAst(h, platz) {
    const p = AST_PLAETZE[platz];
    h.platz = platz;
    h.haengt = true;
    h.seil.visible = true;
    // innen so verschieben, dass der Ursprung des Hauses das obere Seilende ist
    h.innen.y = -(h.ringY - SEIL);
    h.scale.set(HAENGT_SKALA);
    h.position.set(p.x, p.y);
    h.zIndex = 400 + platz;
  }

  baueHaengende() {
    let liste = store.get(HAEUSER_SPEICHER, []);
    if (!Array.isArray(liste)) liste = [];
    this.haeuserListe = liste.filter((e) => e && Number.isInteger(e.platz) && e.platz >= 0 && e.platz < AST_PLAETZE.length).slice(-HAEUSER_MAX);
    this.haengende = [];
    for (const e of this.haeuserListe) {
      const h = this.bauHaus(Number(e.farbe) || DACH_FARBEN[0], true);
      this.welt.addChild(h);
      this.setzeAnAst(h, e.platz);
      this.machHaengendTippbar(h);
      this.haengende.push(h);
    }
    // Leuchten für den Platz am Ast
    this.astLeuchten = leuchten(120, 60);
    this.astLeuchten.visible = false;
    this.astLeuchten.zIndex = 390;
    this.welt.addChild(this.astLeuchten);
  }

  machHaengendTippbar(h) {
    h.hitArea = new PIXI.Rectangle(-160, 0, 320, -h.ringY + SEIL + 140);
    h.tippe = tap(h, () => {
      this.zuletzt = 'vogel';
      h.stoss = 1;
      sfx('common/klack', { vol: 0.25 });
    }, { sound: null, squash: false });
  }

  baueSchale() {
    const t = tex('common/futter_koerner');
    this.schale = spr('common/futter_koerner', { x: SCHALE.x, y: SCHALE.y, scale: 210 / (t.width || 420), parent: this.welt, z: SCHALE.y });
    tap(this.schale, () => this.schaleGetippt(), { sound: null, squash: true, pad: 40 });
    this.schaleLeuchten = leuchten(150, 55);
    this.schaleLeuchten.position.set(SCHALE.x, SCHALE.y - 10);
    this.schaleLeuchten.zIndex = SCHALE.y - 1;
    this.schaleLeuchten.visible = false;
    this.welt.addChild(this.schaleLeuchten);
  }

  // Neue Runde: ein neues Unterteil steht auf dem Bauplatz, das Dach liegt im Gras
  neuesHaus(sofort = false) {
    const alt = this.haus?.farbe;
    const farbe = pick(DACH_FARBEN.filter((f) => f !== alt && f !== this.haeuserListe.at(-1)?.farbe));
    const h = this.bauHaus(farbe, false);
    h.position.set(BAUPLATZ.x, BAUPLATZ.y);
    h.zIndex = BAUPLATZ.y;
    this.welt.addChild(h);
    this.haus = h;
    this.fuellung = 0;
    this.naegelFest = 0;
    this.vPhase = 'dach';

    // Dach im Gras (etwas schräg)
    const dS = DACH_BREITE / (tex('wald/vogelhaus_dach').width || 420);
    const d = spr('wald/vogelhaus_dach', { anchor: 0.5, x: DACH_START.x, y: DACH_START.y, scale: dS * 0.9, parent: this.welt, z: DACH_START.y });
    d.tint = farbe;
    d.rotation = -0.35;
    this.dachTeil = d;
    d.zieh = drag(d, {
      pad: 60,
      lift: 1.08,
      sound: null,
      targets: () => [{ id: 'haus', x: this.haus.x, y: this.haus.y + this.haus.dachY, radius: 300 }],
      onStart: () => { this.zuletzt = 'vogel'; sfx('common/tipp', { vol: 0.6 }); },
      onDrop: (ziel, ctx) => {
        ctx.erledigt = true;
        const weg = Math.hypot(ctx.x - ctx.startX, ctx.y - ctx.startY);
        if (ziel || weg < 90) this.dachDrauf();
        else ctx.back(0.4);
      },
    });

    // Unterteil antippen: wackelt (und zeigt, was fehlt)
    h.hitArea = new PIXI.Rectangle(-150, h.dachY - 60, 300, -h.dachY + 200);
    h.tippe = tap(h, () => this.hausGetippt(), { sound: null, squash: false });

    // Nägel (erst nach dem Dach sichtbar)
    h.naegel = NAEGEL.map((n) => {
      const c = new PIXI.Container({ label: 'nagel' });
      c.position.set(n.x, n.y);
      c.licht = leuchten(42, 42, 0xffe9a0);
      const kopf = new PIXI.Graphics().circle(0, 0, 11).fill(0x9aa4b4).circle(-3, -3, 4).fill({ color: 0xffffff, alpha: 0.6 });
      kopf.eventMode = 'none';
      c.addChild(c.licht, kopf);
      c.fest = false;
      c.visible = false;
      c.hitArea = new PIXI.Circle(0, 0, 110);
      c.eventMode = 'none';
      tap(c, () => this.nagelGetippt(c), { sound: null, squash: false, hitArea: new PIXI.Circle(0, 0, 110) });
      h.innen.addChild(c);
      return c;
    });

    if (!sofort) {
      for (const o of [h, d]) {
        const s = o.scale.x;
        o.alpha = 0;
        o.scale.set(s * 0.6);
        this.tween(o, { alpha: 1 }, 0.6, { ease: 'sineInOut' });
        this.tween(o, { scale: s }, 0.8, { ease: 'backOut' });
      }
      sfx('common/plopp', { vol: 0.4 });
    }
  }

  hausGetippt() {
    this.zuletzt = 'vogel';
    const h = this.haus;
    if (this.vPhase === 'aufhaengen') { this.aufhaengen(); return; }
    fx.wobble(h, 0.04);
    sfx('common/klack', { vol: 0.25 });
  }

  async dachDrauf() {
    if (this.vPhase !== 'dach') return;
    this.vPhase = 'dach_fliegt';
    const d = this.dachTeil;
    d.eventMode = 'none';
    d.zieh?.off();
    const h = this.haus;
    this.tween(d, { rotation: 0 }, 0.5, { ease: 'sineInOut' });
    sfx('common/hupf', { vol: 0.5 });
    await bogen(this, d, { x: h.x, y: h.y + h.dachY }, { dauer: 0.6, hoehe: 160, skala: h.dach.scale.x });
    if (d.destroyed) return;
    d.destroy();
    this.dachTeil = null;
    h.dach.visible = true;
    sfx('common/klack', { vol: 0.5 });
    fx.pop(h, 0.04);
    this.burst('staub', h.x, h.y + h.dachY + 90, { count: 3 });
    for (const n of h.naegel) { n.visible = true; n.eventMode = 'static'; }
    this.vPhase = 'naegel';
  }

  async nagelGetippt(n) {
    this.zuletzt = 'vogel';
    if (n.fest || this.vPhase !== 'naegel') return;
    n.fest = true;
    n.eventMode = 'none';
    // kleiner Hammer klopft zweimal
    const ham = new PIXI.Container();
    const g = new PIXI.Graphics()
      .roundRect(-8, -6, 16, 96, 8).fill(0xb07a45)
      .roundRect(-34, -26, 68, 30, 12).fill(0x7d8798)
      .roundRect(-28, -22, 30, 8, 4).fill({ color: 0xffffff, alpha: 0.35 });
    ham.addChild(g);
    ham.pivot.set(0, 80);
    ham.position.set(n.x + (n.x < 0 ? -10 : 10), n.y + 70);
    ham.rotation = n.x < 0 ? -0.9 : 0.9;
    ham.alpha = 0;
    ham.eventMode = 'none';
    this.haus.innen.addChild(ham);
    await this.tween(ham, { alpha: 1 }, 0.2, { ease: 'sineInOut' });
    for (let i = 0; i < 2; i++) {
      if (!(await this.tween(ham, { rotation: 0 }, 0.13, { ease: 'quadIn' }))) return;
      sfx('common/klack', { vol: 0.55 });
      if (i === 0) this.burst('staub', this.haus.x + n.x, this.haus.y + n.y, { count: 2 });
      fx.pop(n, 0.08);
      await this.tween(ham, { rotation: n.x < 0 ? -0.6 : 0.6 }, 0.2, { ease: 'sineOut' });
    }
    this.tween(n.licht, { alpha: 0 }, 0.6, { ease: 'sineInOut' });
    await this.tween(ham, { alpha: 0 }, 0.3, { ease: 'sineInOut' });
    ham.destroy({ children: true });
    this.naegelFest++;
    note('xylo', this.naegelFest === 1 ? 76 : 79, { vol: 0.3 });
    if (this.naegelFest >= NAEGEL.length && this.vPhase === 'naegel') this.bereitZumAufhaengen();
  }

  // Platz am Ast wählen: der erste freie – sonst macht das älteste Haus Platz (es schwebt sanft davon)
  bereitZumAufhaengen() {
    const belegt = new Set(this.haengende.map((h) => h.platz));
    let platz = AST_PLAETZE.findIndex((_, i) => !belegt.has(i));
    if (platz < 0) {
      const alt = this.haengende.shift();
      this.haeuserListe.shift();
      platz = alt.platz;
      alt.eventMode = 'none';
      this.tween(alt, { y: alt.y - 60, alpha: 0 }, 1.2, { ease: 'sineInOut' }).then(() => { if (!alt.destroyed) alt.destroy({ children: true }); });
    }
    this.zielPlatz = platz;
    const p = AST_PLAETZE[platz];
    this.astLeuchten.position.set(p.x, p.y + 60);
    this.astLeuchten.visible = true;
    this.astLeuchten.alpha = 0;
    this.tween(this.astLeuchten, { alpha: 1 }, 0.6, { ease: 'sineInOut' });
    this.vPhase = 'aufhaengen';
    const h = this.haus;
    h.tippe?.off();
    h.tippe = null;
    h.eventMode = 'static';
    h.zieh = drag(h, {
      pad: 40,
      lift: 1.05,
      sound: null,
      targets: () => [{ id: 'ast', x: p.x, y: p.y + 140, radius: 330 }],
      onStart: () => { this.zuletzt = 'vogel'; sfx('common/tipp', { vol: 0.6 }); },
      onDrop: (ziel, ctx) => {
        ctx.erledigt = true;
        const weg = Math.hypot(ctx.x - ctx.startX, ctx.y - ctx.startY);
        if (ziel || weg < 90) this.aufhaengen();
        else ctx.back(0.4);
      },
    });
  }

  async aufhaengen() {
    if (this.vPhase !== 'aufhaengen') return;
    this.vPhase = 'fliegt';
    const h = this.haus;
    h.zieh?.off();
    h.zieh = null;
    h.tippe?.off();
    h.eventMode = 'none';
    killTweensOf(h, ['x', 'y', 'scale', 'scaleX', 'scaleY']);
    const p = AST_PLAETZE[this.zielPlatz];
    // Ursprung auf das obere Seilende legen, ohne dass das Haus springt
    const dy = -(h.ringY - SEIL);
    h.innen.y = dy;
    h.y -= dy * h.scale.y;
    h.zIndex = 5000;
    sfx('common/wusch', { vol: 0.4 });
    await bogen(this, h, { x: p.x, y: p.y }, { dauer: 1.1, hoehe: 140, skala: HAENGT_SKALA });
    if (h.destroyed) return;
    this.setzeAnAst(h, this.zielPlatz);
    h.stoss = 1.4;
    sfx('common/landen', { vol: 0.5 });
    this.tween(this.astLeuchten, { alpha: 0 }, 0.5, { ease: 'sineInOut' }).then(() => { this.astLeuchten.visible = false; });
    this.haengende.push(h);
    this.haeuserListe.push({ farbe: h.farbe, platz: this.zielPlatz });
    store.set(HAEUSER_SPEICHER, this.haeuserListe.slice(-HAEUSER_MAX));
    this.machHaengendTippbar(h);
    this.vPhase = 'fuellen';
    this.schaleLeuchten.visible = true;
    this.schaleLeuchten.alpha = 0;
    this.tween(this.schaleLeuchten, { alpha: 1 }, 0.6, { ease: 'sineInOut' });
    this.after(1, () => voice('wald_koerner', { nurWenn: () => this.aktiv && this.vPhase === 'fuellen' && this.fuellung === 0 }));
  }

  schaleGetippt() {
    this.zuletzt = 'vogel';
    sfx('common/sand', { vol: 0.35 });
    if (this.vPhase !== 'fuellen' || this.fuellt) { fx.wobble(this.schale, 0.04); return; }
    this.fuellt = true;
    const h = this.haus;
    const ziel = this.welt.toLocal(h.innen.toGlobal({ x: 0, y: 20 }));
    let fertig = 0;
    for (let i = 0; i < 5; i++) {
      const k = this.koernerPool.find((x) => !x.visible);
      if (!k) break;
      k.visible = true;
      k.alpha = 1;
      k.position.set(SCHALE.x + rand(-40, 40), SCHALE.y - 90);
      this.after(i * 0.08, () => {
        bogen(this, k, { x: ziel.x + rand(-60, 60), y: ziel.y + rand(-8, 12) }, { dauer: 0.75, hoehe: 260 }).then(() => {
          k.visible = false;
          fertig++;
          if (fertig === 1) sfx('common/plopp', { vol: 0.35 });
        });
      });
    }
    this.after(0.95, () => {
      this.fuellt = false;
      if (this.vPhase !== 'fuellen') return;
      this.fuellung++;
      this.tween(h.voll, { alpha: Math.min(1, this.fuellung / 3) }, 0.6, { ease: 'sineInOut' });
      note('xylo', [72, 76, 79][this.fuellung - 1] || 79, { vol: 0.3 });
      h.stoss = 0.6;
      if (this.fuellung >= 3) {
        this.vPhase = 'voegel';
        this.tween(this.schaleLeuchten, { alpha: 0 }, 0.5, { ease: 'sineInOut' }).then(() => { this.schaleLeuchten.visible = false; });
        this.voegelKommen();
      }
    });
  }

  // ---------------------------------------------------------------- Vögel

  // Sitzplätze am Haus (im Haus, unskaliert: Sitzstange, Schalenrand links) und auf dem Ast daneben
  sitzPlaetze(h) {
    const astRechts = h.platz < 2;
    return shuffle([
      { amHaus: true, x: 12, y: 100, flip: false },
      { amHaus: true, x: -78, y: -168, flip: false, dach: true },
      { amHaus: false, x: h.x + (astRechts ? 175 : -175), y: AST_PLAETZE[h.platz].y - 40, flip: astRechts },
    ]);
  }

  async voegelKommen() {
    const h = this.haus;
    const arten = waehleArten(VOEGEL, 3, VOEGEL_SPEICHER);
    const plaetze = this.sitzPlaetze(h);
    this.voegel = [];
    // einer nach dem anderen: der nächste fliegt erst los, wenn der vorige sitzt (Ruhe-Regel)
    for (let i = 0; i < arten.length; i++) {
      if (i > 0) await this.wait(0.7);
      await this.ruhigAbwarten();
      if (this.haus !== h) return;
      await this.vogelKommt(arten[i], plaetze[i], h);
    }
  }

  // Ruhe-Regel bei zwei Abläufen nebeneinander: Was von selbst fliegt (Vögel kommen und gehen), wartet, solange das
  // Eichhörnchen hüpft oder eine Nuss trägt – so bewegen sich höchstens zwei Dinge auffällig zugleich.
  async ruhigAbwarten(hoechstens = 10) {
    for (let t = 0; t < hoechstens && this.nussLaeuft; t += 0.25) await this.wait(0.25);
  }

  vogelKommt(art, sitz, h) {
    const id = 'wald/vogel_' + art;
    const t = tex(id);
    const s = VOGEL_HOEHE / (t.height || 300);
    const v = new PIXI.Container({ label: 'vogel:' + art });
    v.bild = spr(id, { scale: s, parent: v });
    v.bild.eventMode = 'none';
    v.art = art;
    v.sitz = sitz;
    v.haus = h;
    v.sitzt = false;
    v.gesungen = false;
    v.phase = rand(0, 10);
    v.zIndex = 5100;
    const vonRechts = Math.random() < 0.6;
    // Einflug unterhalb der Knopf-Ecken oben links/rechts
    v.position.set(vonRechts ? 1450 : -1450, rand(380, 480));
    v.bild.scale.x = s * (vonRechts ? -1 : 1);
    this.welt.addChild(v);
    v.hitArea = new PIXI.Circle(0, -VOGEL_HOEHE * 0.45, 125);
    tap(v, () => this.vogelGetippt(v), { sound: null, squash: false, hitArea: new PIXI.Circle(0, -VOGEL_HOEHE * 0.45, 125) });
    this.voegel.push(v);
    const ziel = this.sitzOrt(v);
    v.fliegt = true;
    sfx('common/wusch', { vol: 0.2 });
    return bogen(this, v, ziel, { dauer: 3, hoehe: -120 }).then((ok) => {
      if (v.destroyed) return;
      v.fliegt = false;
      v.sitzt = true;
      v.bild.scale.x = s * (sitz.flip ? -1 : 1);
      v.zIndex = sitz.amHaus ? 5100 : 380;
      sfx('common/landen', { vol: 0.3 });
      if (sitz.amHaus) h.stoss = 0.5;
      // gleich ein kleines Lied zur Begrüßung (leise)
      this.singe(v, 0.18);
      if (this.voegel.filter((x) => x.sitzt).length === 1) {
        this.after(1.5, () => voice('wald_singen', { nurWenn: () => this.aktiv && this.vPhase === 'voegel' && !this.voegel.some((x) => x.gesungen) }));
      }
    });
  }

  // Wo sitzt der Vogel gerade (Welt-Koordinaten)? Am Haus schaukelt der Platz mit.
  sitzOrt(v, aus = { x: 0, y: 0 }) {
    const s = v.sitz;
    if (!s.amHaus) { aus.x = s.x; aus.y = s.y; return aus; }
    const g = v.haus.innen.toGlobal({ x: s.x, y: s.y });
    const l = this.welt.toLocal(g);
    aus.x = l.x;
    aus.y = l.y;
    return aus;
  }

  singe(v, vol = 0.32) {
    if (v.singt) return;
    v.singt = true;
    let t = 0;
    for (const [midi, instr, pause] of LIEDER[v.art]) {
      this.after(t, () => { if (!v.destroyed) { note(instr, midi, { vol }); v.schnabel = 1; } });
      t += pause;
    }
    this.after(t + 0.2, () => { v.singt = false; });
  }

  vogelGetippt(v) {
    this.zuletzt = 'vogel';
    if (!v.sitzt || v.destroyed) { return; }
    this.singe(v);
    this.burst('noten', v.x, v.y - VOGEL_HOEHE, { count: 2 });
    fx.pop(v.bild, 0.06);
    if (!v.gesungen) {
      v.gesungen = true;
      if (this.vPhase === 'voegel' && this.voegel.length === 3 && this.voegel.every((x) => x.gesungen)) {
        this.vPhase = 'abschied';
        this.after(2.2, () => this.vogelRundeFertig());
      }
    }
  }

  async vogelRundeFertig() {
    const h = this.haus;
    belohne(this, waehleSticker(['wald_meise', 'wald_rotkehlchen']), h.x, h.y + 200);
    this.vogelRunde++;
    await this.wait(3.5);
    // die Vögel fliegen nacheinander weiter; die Körner sind aufgepickt
    this.tween(h.voll, { alpha: 0 }, 3, { ease: 'sineInOut' });
    // nacheinander: der nächste startet erst, wenn der vorige fast aus dem Bild ist (höchstens zwei Bewegungen)
    const weg = [...this.voegel];
    for (const v of weg) {
      if (v.destroyed) continue;
      await this.wait(0.6);
      await this.ruhigAbwarten();
      if (v.destroyed) continue;
      v.sitzt = false;
      v.fliegt = true;
      v.eventMode = 'none';
      const nachRechts = v.x > 0;
      v.bild.scale.x = Math.abs(v.bild.scale.y) * (nachRechts ? 1 : -1);
      v.zIndex = 5100;
      const flug = bogen(this, v, { x: nachRechts ? 1500 : -1500, y: rand(380, 480) }, { dauer: 2.4, hoehe: 100 }).then(() => { if (!v.destroyed) v.destroy({ children: true }); });
      await Promise.race([flug, this.wait(1.8)]);
    }
    this.voegel = [];
    await this.wait(2.5);
    this.neuesHaus();
  }

  // ================================================================ Eichhörnchen

  baueEichhoernchen() {
    const e = new Actor('eichhoernchen', { x: EICH_HEIM.x, y: EICH_HEIM.y, scale: EICH_HOEHE / 900, parent: this.welt, z: EICH_HEIM.y });
    e.lookAt(-1000);
    e.onTap(() => this.eichGetippt());
    this.eich = e;
    this.vorrat = [];
  }

  baueVerstecke() {
    this.verstecke = VERSTECKE.map((o, i) => {
      const c = new PIXI.Container({ label: 'versteck' });
      c.position.set(o.x, o.y);
      c.zIndex = o.y - 40;
      c.licht = leuchten(110, 46);
      c.licht.visible = false;
      c.huegel = new PIXI.Graphics()
        .ellipse(0, 6, 92, 36).fill(0x7a4e2c)
        .ellipse(0, -2, 78, 30).fill(0x93603a)
        .ellipse(-22, -14, 30, 10).fill({ color: 0xb98458, alpha: 0.8 });
      c.huegel.visible = false;
      c.kappe = new PIXI.Graphics()
        .ellipse(0, -6, 84, 30).fill(0xf6f9ff)
        .ellipse(-20, -18, 34, 11).fill({ color: 0xffffff, alpha: 0.9 });
      c.kappe.alpha = 0;
      c.addChild(c.licht, c.huegel, c.kappe);
      c.nr = i;
      c.zustand = 'frei';          // 'frei' | 'dran' | 'versteckt' | 'gefunden'
      c.hitArea = new PIXI.Circle(0, -10, 115);
      c.eventMode = 'none';
      tap(c, () => this.versteckGetippt(c), { sound: null, squash: false, hitArea: new PIXI.Circle(0, -10, 115) });
      this.welt.addChild(c);
      return c;
    });

    // Schnee am Boden, Flocken, Wolke
    this.schneeFlocken = [];
    for (let i = 0; i < SCHNEE_FLOCKEN; i++) {
      const f = spr('common/p_schneeflocke', { anchor: 0.5, scale: rand(0.18, 0.3), parent: this.welt, z: 5300 });
      f.visible = false;
      f.eventMode = 'none';
      this.schneeFlocken.push(f);
    }
    const wt = tex('common/wolke3');
    this.wolke = spr('common/wolke3', { anchor: 0.5, x: -1600, y: 260, scale: 300 / (wt.width || 810), parent: this.welt, z: 350 });
    this.wolke.visible = false;
    this.wolke.tint = 0xe8eef8;
    tap(this.wolke, () => this.wolkeGetippt(), { sound: null, squash: true, pad: 50 });
  }

  baueSchnee() {
    const s = new PIXI.Sprite(schneeTextur());
    s.anchor.set(0.5, 0);
    s.width = 3000;
    s.height = 700;
    s.position.set(0, 930);
    s.alpha = 0;
    s.zIndex = 5;
    s.eventMode = 'none';
    this.welt.addChild(s);
    this.schnee = s;
    this.schneit = false;
  }

  vorratAuffuellen(sofort) {
    for (const n of this.vorrat) if (!n.destroyed) n.destroy();
    this.vorrat = [];
    for (let i = 0; i < NUESSE_PRO_RUNDE; i++) {
      const art = pick(['eichel', 'eichel', 'kastanie']);
      const t = tex('wald/' + art);
      const sk = 82 / Math.max(t.width, t.height, 1);
      const n = spr('wald/' + art, { x: VORRAT.x + (i - 1) * 52, y: VORRAT.y + (i % 2) * 18, scale: sk, parent: this.welt, z: VORRAT.y + 30 + i });
      n.art = art;
      n.ruhe = sk;
      tap(n, () => this.vorratGetippt(), { sound: null, squash: true, hitArea: new PIXI.Circle(0, -40 / sk, 105 / sk) });
      if (!sofort) {
        // antippbar erst in voller Größe (eventMode 'none' bis dahin – so misst die Prüfung der Tippfläche nie die
        // wachsende Nuss, auch nicht, wenn die Seite gerade weggeblättert ist und ihre Lage nicht neu gerechnet wird)
        n.alpha = 0;
        n.scale.set(0.01);
        n.eventMode = 'none';
        this.after(i * 0.2, () => {
          this.tween(n, { alpha: 1 }, 0.4, { ease: 'sineInOut' });
          this.tween(n, { scale: sk }, 0.6, { ease: 'backOut' }).then(() => { if (!n.destroyed && !n.weg) { n.scale.set(sk); n.eventMode = 'static'; } });
        });
      }
      this.vorrat.push(n);
    }
    if (!sofort) sfx('common/wachsen', { vol: 0.3 });
  }

  neueNussRunde(sofort = false) {
    this.nPhase = 'verstecken';
    this.versteckt = 0;
    this.gefunden = 0;
    this.nussLaeuft = false;
    // drei Verstecke, möglichst andere als beim letzten Mal
    const vorher = new Set(this.runde || []);
    const reihe = shuffle(this.verstecke).sort((a, b) => (vorher.has(a.nr) ? 1 : 0) - (vorher.has(b.nr) ? 1 : 0));
    this.aktuelle = reihe.slice(0, NUESSE_PRO_RUNDE);
    this.runde = this.aktuelle.map((c) => c.nr);
    this.ueberraschung = Math.random() < 0.6 ? pick(this.aktuelle) : null;
    this.ueberraschungArt = pick(['wurm', 'pilz']);
    for (const c of this.verstecke) {
      c.zustand = 'frei';
      c.huegel.visible = false;
      c.kappe.alpha = 0;
      c.licht.visible = false;
      c.eventMode = 'none';
      c.alpha = 1;
    }
    this.vorratAuffuellen(sofort);
    this.naechstesVersteck();
  }

  naechstesVersteck() {
    const c = this.aktuelle[this.versteckt];
    if (!c) return;
    c.zustand = 'dran';
    c.licht.visible = true;
    c.licht.alpha = 0;
    this.tween(c.licht, { alpha: 1 }, 0.6, { ease: 'sineInOut' });
    c.eventMode = 'static';
  }

  eichGetippt() {
    this.zuletzt = 'nuss';
    if (this.nPhase === 'schlaf') { this.aufwachen(); return; }
    if (this.nussLaeuft) return;
    if (this.nPhase === 'verstecken') { this.versteckGetippt(this.aktuelle[this.versteckt]); return; }
    // steht es auf einem Versteck, gräbt es dort (das Eichhörnchen verdeckt den Hügel nie)
    if (this.nPhase === 'finden') {
      const e = this.eich;
      const offen = this.aktuelle.filter((c) => c.zustand === 'versteckt').sort((a, b) => Math.hypot(a.x - e.x, a.y - e.y) - Math.hypot(b.x - e.x, b.y - e.y));
      if (offen.length) { this.ausgraben(offen[0]); return; }
    }
    jubel(this, this.eich, { herzen: 2 });
  }

  vorratGetippt() {
    this.zuletzt = 'nuss';
    if (this.nPhase === 'verstecken' && !this.nussLaeuft) this.versteckGetippt(this.aktuelle[this.versteckt]);
    else sfx('common/klack', { vol: 0.2 });
  }

  versteckGetippt(c) {
    this.zuletzt = 'nuss';
    if (!c || this.nussLaeuft) return;
    if (this.nPhase === 'verstecken' && c.zustand === 'dran') this.vergraben(c);
    else if (this.nPhase === 'finden' && c.zustand === 'versteckt') this.ausgraben(c);
  }

  // Eichhörnchen hüpft neben das Versteck (rechts davon, schaut hin)
  async hinZu(c) {
    const e = this.eich;
    const x = c.x + 105;
    const y = c.y + 5;
    e.zIndex = Math.max(c.zIndex + 2, y);
    const ok = await e.hopTo(x, y, { hoehe: 80, dauer: clamp(Math.hypot(x - e.x, y - e.y) / 650, 0.5, 1.2) });
    if (!ok || e.destroyed) return false;
    await e.lookAt(c.x - 200);
    return true;
  }

  async heim() {
    const e = this.eich;
    await e.hopTo(EICH_HEIM.x, EICH_HEIM.y, { hoehe: 70, dauer: clamp(Math.hypot(EICH_HEIM.x - e.x, EICH_HEIM.y - e.y) / 650, 0.5, 1.2) });
    if (e.destroyed) return;
    e.zIndex = EICH_HEIM.y;
    e.lookAt(-1000);
  }

  async vergraben(c) {
    this.nussLaeuft = true;
    c.zustand = 'versteckt';
    c.eventMode = 'none';
    this.tween(c.licht, { alpha: 0 }, 0.6, { ease: 'sineInOut' });
    const e = this.eich;
    const n = this.vorrat.shift();
    // die Nuss hüpft dem Eichhörnchen in die Pfoten
    if (n && !n.destroyed) {
      n.weg = true;
      n.eventMode = 'none';
      n.zIndex = 5000;
      sfx('common/hupf', { vol: 0.4 });
      const k = e.point('mouth');
      await bogen(this, n, { x: k.x, y: k.y + 50 }, { dauer: 0.45, hoehe: 70 });
    }
    // gemeinsam hinüber: die Nuss folgt dem Eichhörnchen (update)
    this.traegt = n && !n.destroyed ? n : null;
    const ok = await this.hinZu(c);
    this.traegt = null;
    if (!ok) { this.nussLaeuft = false; return; }
    // graben
    sfx('common/graben', { vol: 0.5 });
    e.pose('eat');
    this.burst('staub', c.x, c.y - 10, { count: 4 });
    await this.wait(0.5);
    if (n && !n.destroyed) {
      await bogen(this, n, { x: c.x, y: c.y - 6 }, { dauer: 0.35, hoehe: 40 });
      await this.tween(n, { scale: n.ruhe * 0.3, alpha: 0 }, 0.3, { ease: 'quadIn' });
      n.destroy();
    }
    c.versteckteArt = n?.art || 'eichel';
    c.huegel.visible = true;
    c.huegel.scale.set(0.2);
    this.tween(c.huegel, { scale: 1 }, 0.6, { ease: 'backOut' });
    sfx('common/plopp', { vol: 0.4 });
    e.pose('idle');
    this.versteckt++;
    note('xylo', [72, 76, 79][this.versteckt - 1] || 79, { vol: 0.3 });
    await this.wait(0.4);
    await this.heim();
    this.nussLaeuft = false;
    if (this.versteckt >= NUESSE_PRO_RUNDE) this.winterKommt();
    else this.naechstesVersteck();
  }

  // Eine Wolke zieht heran – antippen: es schneit
  winterKommt() {
    this.nPhase = 'wolke';
    const w = this.wolke;
    w.visible = true;
    w.alpha = 0;
    // sie gleitet sanft von links heran (nicht durch die Ecke mit dem Karten-Knopf)
    w.position.set(-720, 250);
    w.eventMode = 'static';
    this.tween(w, { alpha: 1 }, 1, { ease: 'sineInOut' });
    this.tween(w, { x: -430 }, 2.6, { ease: 'sineInOut' });
  }

  wolkeGetippt() {
    this.zuletzt = 'nuss';
    if (this.nPhase !== 'wolke') return;
    this.nPhase = 'schnee';
    killTweensOf(this.wolke, ['x']);
    sfx('common/wusch', { vol: 0.3 });
    note('glocke', 84, { vol: 0.2 });
    this.schneit = true;
    this.tween(this.schnee, { alpha: SCHNEE_ALPHA }, 3.5, { ease: 'sineInOut' });
    for (const c of this.aktuelle) this.tween(c.kappe, { alpha: 1 }, 3.5, { ease: 'sineInOut', delay: 0.5 });
    // das Eichhörnchen kuschelt sich ein
    this.after(2.2, async () => {
      if (this.nussLaeuft) return;
      this.eich.pose('sleep');
      this.nPhase = 'schlaf';
      this.burst('zzz', this.eich.x, this.eich.y - 200, { count: 2 });
    });
    this.after(7, () => {
      this.schneit = false;
      const w = this.wolke;
      w.eventMode = 'none';
      this.tween(w, { x: 300, alpha: 0 }, 3, { ease: 'sineInOut' }).then(() => { w.visible = false; });
    });
  }

  async aufwachen() {
    if (this.nPhase !== 'schlaf' || this.nussLaeuft) return;
    this.nPhase = 'finden';
    const e = this.eich;
    e.pose('idle');
    await e.hop(60);
    laut(e);
    blase(e, 'wald/' + (this.aktuelle[0].versteckteArt || 'eichel'), 2.6);
    for (const c of this.aktuelle) c.eventMode = 'static';
    this.after(1.2, () => voice('wald_winter', { nurWenn: () => this.aktiv && this.nPhase === 'finden' && this.gefunden === 0 }));
  }

  async ausgraben(c) {
    this.nussLaeuft = true;
    c.zustand = 'gefunden';
    c.eventMode = 'none';
    const e = this.eich;
    const ok = await this.hinZu(c);
    if (!ok) { this.nussLaeuft = false; c.zustand = 'versteckt'; c.eventMode = 'static'; return; }
    sfx('common/graben', { vol: 0.5 });
    e.pose('eat');
    this.burst('staub', c.x, c.y - 10, { count: 4 });
    this.tween(c.kappe, { alpha: 0 }, 0.5, { ease: 'sineInOut' });
    await this.wait(0.45);
    this.tween(c.huegel, { alpha: 0 }, 0.6, { ease: 'sineInOut' }).then(() => { c.huegel.visible = false; c.huegel.alpha = 1; });
    if (c === this.ueberraschung) await this.ueberraschen(c);
    // die Nuss hüpft heraus – und wird gefressen
    const art = c.versteckteArt || 'eichel';
    const t = tex('wald/' + art);
    const sk = 82 / Math.max(t.width, t.height, 1);
    const n = spr('wald/' + art, { x: c.x, y: c.y, scale: sk * 0.4, parent: this.welt, z: 5000 });
    n.eventMode = 'none';
    sfx('common/plopp', { vol: 0.45 });
    this.tween(n, { scale: sk }, 0.4, { ease: 'backOut' });
    await this.tween(n, { y: c.y - 110 }, 0.4, { ease: 'sineOut' });
    const m = e.point('mouth');
    await bogen(this, n, { x: m.x, y: m.y + 40 }, { dauer: 0.4, hoehe: 40 });
    sfx('common/mampf', { vol: 0.55 });
    await this.tween(n, { scale: sk * 0.2, alpha: 0 }, 0.4, { ease: 'quadIn' });
    n.destroy();
    e.pose('idle');
    jubel(this, e, { herzen: 3 });
    this.gefunden++;
    note('xylo', [79, 81, 84][this.gefunden - 1] || 84, { vol: 0.3 });
    await this.wait(1);
    if (this.gefunden < NUESSE_PRO_RUNDE) await this.heim();
    this.nussLaeuft = false;
    if (this.gefunden >= NUESSE_PRO_RUNDE) this.fruehling();
  }

  // Kleine Überraschung im Hügel: ein Wurm guckt heraus, oder ein Pilz wächst
  async ueberraschen(c) {
    if (this.ueberraschungArt === 'wurm') {
      const t = tex('common/futter_wurm');
      const w = spr('common/futter_wurm', { anchor: [0.5, 1], x: c.x - 30, y: c.y + 10, scale: 120 / (t.width || 420), parent: this.welt, z: c.zIndex + 1 });
      w.eventMode = 'none';
      w.alpha = 0;
      this.tween(w, { alpha: 1 }, 0.3, { ease: 'sineInOut' });
      await this.tween(w, { y: c.y - 30 }, 0.5, { ease: 'backOut' });
      fx.wobble(w, 0.15);
      note('pling', 84, { vol: 0.2 });
      await this.wait(0.9);
      await this.tween(w, { y: c.y + 20, alpha: 0 }, 0.5, { ease: 'sineIn' });
      w.destroy();
    } else {
      const t = tex('wald/pilz_braun');
      const sk = 110 / Math.max(t.width, t.height, 1);
      const p = spr('wald/pilz_braun', { x: c.x - 70, y: c.y + 15, scale: 0.01, parent: this.welt, z: c.zIndex + 1 });
      sfx('common/wachsen', { vol: 0.35 });
      this.tween(p, { scale: sk }, 0.8, { ease: 'backOut' });
      tap(p, () => { fx.wobble(p, 0.1); note('pling', 81, { vol: 0.2 }); }, { sound: null, squash: false, pad: 80 });
      // er bleibt eine Weile stehen, dann verblasst er still
      this.after(14, () => { if (!p.destroyed) this.tween(p, { alpha: 0 }, 1.2, { ease: 'sineInOut' }).then(() => { if (!p.destroyed) p.destroy(); }); });
      await this.wait(0.5);
    }
  }

  async fruehling() {
    this.nPhase = 'tauen';
    this.tween(this.schnee, { alpha: 0 }, 2.5, { ease: 'sineInOut' });
    await this.heim();
    // Gießkanne steht bereit
    const t = tex('common/giesskanne');
    const sk = 190 / (t.width || 420);
    const k = spr('common/giesskanne', { x: KANNE.x, y: KANNE.y, scale: sk, parent: this.welt, z: KANNE.y });
    k.alpha = 0;
    k.ruhe = sk;
    this.kanne = k;
    tap(k, () => this.giessen(), { sound: null, squash: true, pad: 60 });
    this.tween(k, { alpha: 1 }, 0.6, { ease: 'sineInOut' });
    sfx('common/plopp', { vol: 0.35 });
    this.nPhase = 'giessen';
    this.after(1, () => voice('wald_giessen', { nurWenn: () => this.aktiv && this.nPhase === 'giessen' }));
  }

  async giessen() {
    this.zuletzt = 'nuss';
    if (this.nPhase !== 'giessen') return;
    this.nPhase = 'gegossen';
    const k = this.kanne;
    k.eventMode = 'none';
    const b = this.baum;
    const hoehe = b.texture.height * b.scale.y;
    // neben das Bäumchen, Tülle zum Bäumchen (gespiegelt), dann kippen
    const zielX = BAUM.x + 150 + hoehe * 0.15;
    const zielY = BAUM.y - Math.min(hoehe, 300) * 0.55;
    k.zIndex = 5000;
    await bogen(this, k, { x: zielX, y: zielY }, { dauer: 0.8, hoehe: 80 });
    if (k.destroyed) return;
    this.tween(k.scale, { x: -k.ruhe }, 0.3, { ease: 'sineInOut' });
    await this.tween(k, { rotation: -0.45 }, 0.45, { ease: 'sineInOut' });
    sfx('common/giessen', { vol: 0.45 });
    const spitze = this.welt.toLocal(k.toGlobal({ x: 175, y: -63 }));   // Tülle (Punkt tuelle der Gießkanne)
    for (let i = 0; i < 3; i++) this.after(i * 0.4, () => this.burst('tropfen', spitze.x, spitze.y, { count: 3 }));
    await this.wait(1.4);
    await this.tween(k, { rotation: 0 }, 0.4, { ease: 'sineInOut' });
    this.tween(k, { alpha: 0 }, 0.5, { ease: 'sineInOut' }).then(() => { if (!k.destroyed) k.destroy(); });
    this.kanne = null;
    await this.baumWaechst();
    jubel(this, this.eich, { herzen: 4 });
    await this.wait(1);
    belohne(this, waehleSticker(['wald_baeumchen', 'tier_eichhoernchen']), BAUM.x + 120, BAUM.y - 300);
    await this.wait(3);
    this.neueNussRunde();
  }

  // ---------------------------------------------------------------- Bäumchen

  baueBaum() {
    this.stufe = clamp(Math.floor(Number(store.get(BAUM_SPEICHER, 0)) || 0), 0, BAUM_STUFEN.length - 1);
    const b = spr('wald/' + BAUM_STUFEN[this.stufe][0], { x: BAUM.x, y: BAUM.y, parent: this.welt, z: BAUM.y });
    this.baum = b;
    this.setzeBaum(this.stufe);
    tap(b, () => {
      this.zuletzt = 'nuss';
      fx.wobble(b, 0.06);
      sfx('common/rascheln', { vol: 0.3 });
    }, { sound: null, squash: false, pad: 60 });
  }

  setzeBaum(stufe) {
    const [bild, hoehe] = BAUM_STUFEN[stufe];
    const b = this.baum;
    b.texture = tex('wald/' + bild);
    const m = meta('wald/' + bild);
    b.anchor.set(m?.ax ?? 0.5, m?.ay ?? 0.98);
    const sk = hoehe / (b.texture.height || 300);
    b.scale.set(sk);
    return sk;
  }

  async baumWaechst() {
    const b = this.baum;
    const voll = this.stufe >= BAUM_STUFEN.length - 1;
    if (!voll) {
      this.stufe++;
      store.set(BAUM_SPEICHER, this.stufe);
    }
    const alt = Math.abs(b.scale.y);
    const sk = this.setzeBaum(this.stufe);
    b.scale.set(voll ? sk : alt * 0.9);
    sfx('common/wachsen', { vol: 0.5 });
    note('glocke', 79, { vol: 0.2 });
    await this.tween(b, { scale: voll ? sk * 1.06 : sk }, 0.9, { ease: 'backOut' });
    if (voll) await this.tween(b, { scale: sk }, 0.4, { ease: 'sineInOut' });
    this.burst('blaetter', BAUM.x, BAUM.y - BAUM_STUFEN[this.stufe][1] * 0.6, { count: 5 });
  }

  // ================================================================ Ablauf

  erinnern() {
    if (this.szene.idle < 3) return;
    if (this.nPhase === 'schlaf' && Math.random() < 0.6) this.burst('zzz', this.eich.x, this.eich.y - 200, { count: 1 });
    // ein sitzender Vogel pickt
    const sitzend = this.voegel.filter((v) => v.sitzt && !v.destroyed && !v.pickt);
    if (sitzend.length) {
      const v = pick(sitzend);
      v.pickt = true;
      const r = v.bild.scale.x < 0 ? -0.35 : 0.35;
      this.tween(v.bild, { rotation: r }, 0.25, { ease: 'sineInOut' })
        .then(() => this.tween(v.bild, { rotation: 0 }, 0.35, { ease: 'sineInOut' }))
        .then(() => { v.pickt = false; });
    }
  }

  update(dt) {
    this.uhr += dt;
    const puls = 0.55 + 0.45 * Math.sin(this.uhr * 3.2);
    // leuchtende Ziele atmen langsam
    for (const c of this.verstecke) if (c.licht.visible && c.zustand === 'dran') c.licht.scale.set(0.9 + 0.1 * puls);
    if (this.astLeuchten.visible) this.astLeuchten.scale.set(0.9 + 0.1 * puls);
    if (this.schaleLeuchten.visible) this.schaleLeuchten.scale.set(0.9 + 0.1 * puls);
    if (this.haus?.naegel) for (const n of this.haus.naegel) if (!n.fest && n.visible) n.licht.scale.set(0.85 + 0.15 * puls);
    // hängende Häuser schaukeln sanft (ein Stoß klingt langsam ab)
    for (const h of this.haengende) {
      if (h.destroyed) continue;
      h.schaukel += dt;
      h.stoss = Math.max(0, (h.stoss || 0) - dt * 0.6);
      h.rotation = Math.sin(h.schaukel * 1.9) * (0.018 + 0.05 * h.stoss);
    }
    // Vögel: atmen, am Haus mitschaukeln, beim Fliegen leicht wippen
    const p = this._p || (this._p = { x: 0, y: 0 });
    for (const v of this.voegel) {
      if (v.destroyed) continue;
      v.phase += dt;
      v.schnabel = Math.max(0, (v.schnabel || 0) - dt * 4);
      if (v.sitzt) {
        if (v.sitz.amHaus) { this.sitzOrt(v, p); v.position.set(p.x, p.y); v.rotation = v.haus.rotation; }
        v.scale.set(1 - 0.02 * Math.sin(v.phase * 2.2), 1 + 0.03 * Math.sin(v.phase * 2.2) + 0.05 * v.schnabel);
      } else if (v.fliegt) {
        v.rotation = Math.sin(v.phase * 9) * 0.06;
        v.scale.set(1, 1 + 0.06 * Math.sin(v.phase * 12));
      }
    }
    // die Nuss in den Pfoten folgt dem Eichhörnchen
    const n = this.traegt;
    if (n && !n.destroyed && !this.eich.destroyed) {
      const k = this.eich.point('mouth');
      n.position.set(k.x, k.y + 50);
    }
    // Schnee: wenige, langsame Flocken
    for (const f of this.schneeFlocken) {
      if (!f.visible) {
        if (this.schneit && Math.random() < dt * 2.2) {
          f.visible = true;
          f.position.set(rand(-1250, 1250), rand(-60, 200));
          f.tempo = rand(70, 120);
          f.wind = rand(0, 10);
          f.alpha = 0.9;
        }
        continue;
      }
      f.wind += dt;
      f.y += f.tempo * dt;
      f.x += Math.sin(f.wind * 1.2) * 30 * dt;
      f.rotation += dt * 0.4;
      if (f.y > 1500) f.visible = false;
    }
  }

  // ---------------------------------------------------------------- Zeige-Hand

  vogelHinweis() {
    const h = this.haus;
    switch (this.vPhase) {
      case 'dach': return this.dachTeil ? { von: this.dachTeil, nach: { x: h.x, y: h.y + h.dachY } } : null;
      case 'naegel': return h.naegel.find((n) => !n.fest) || null;
      case 'aufhaengen': { const p = AST_PLAETZE[this.zielPlatz]; return { von: h, nach: { x: p.x, y: p.y + 150 } }; }   // ein Container: die Hand zieht ohne halbes Geister-Bild
      case 'fuellen': return this.schale;
      case 'voegel': return this.voegel.find((v) => v.sitzt && !v.gesungen) || null;
      default: return null;
    }
  }

  nussHinweis() {
    if (this.nussLaeuft) return null;
    switch (this.nPhase) {
      case 'verstecken': return this.aktuelle[this.versteckt] || null;
      case 'wolke': return this.wolke;
      case 'schlaf': return this.eich;
      case 'finden': return this.aktuelle.find((c) => c.zustand === 'versteckt') || null;
      case 'giessen': return this.kanne;
      default: return null;
    }
  }

  hinweise() {
    const v = this.vogelHinweis();
    const n = this.nussHinweis();
    const liste = this.zuletzt === 'nuss' ? [n, v] : [v, n];
    const r = liste.filter(Boolean);
    return r.length ? r : [this.eich];
  }
}
