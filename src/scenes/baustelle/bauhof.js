// Seite 4 – Bauhof (hg_bauhof). Zwei Abläufe, die sich abwechseln (wie ein Arbeitstag):
//
// A. Werkbank (am Tag) – jede Runde ein anderes Ding für einen anderen Gast:
//   1. Ein Gast kommt von links und zeigt in einer Denkblase, was er sich wünscht (Hundehütte, Vogelhaus, Briefkasten).
//   2. Bretter: Den Bretterstapel antippen → ein Brett fliegt auf die Werkbank, das Ding wächst ein Drittel höher
//      (drei Bretter; ein blasser Bauplan zeigt, was entsteht).
//   3. Nägel: Drei Nägel stehen vor. Antippen → der Hammer klopft (zweimal je Nagel, dann ist er drin).
//   4. Farbe: Drei Farbeimer, der Gast zeigt seine Lieblingsfarbe (jede ist richtig). Eimer antippen, dann über das
//      Ding wischen → es wird bunt.
//   5. Fertig: Sticker, das Ding hüpft zum Gast, dann wandert es in die Reihe am Zaun (wächst über die Besuche,
//      gespeichert unter 'baustelle.werkstuecke'); der Gast geht.
// B. Feierabend – der Himmel wird abendlich, drei Fahrzeuge (jedes Mal andere, in anderer Reihenfolge) kommen:
//   1. Das Fahrzeug hält an der Zapfsäule.
//   2. Zapfsäule antippen → der Schlauch geht zum Tank.
//   3. Zapfsäule festhalten (oder mehrmals tippen) → die Tankanzeige füllt sich.
//   4. Voll: Fahrzeug antippen → es fährt in sein Tor der Halle, das Rolltor geht zu.
//   Sind alle drin: Nacht mit Mond und Sternen, eine kleine Überraschung (Eule, Igel oder Glühwürmchen), Sticker.
//   Dann wird es wieder Morgen, die Tore gehen auf, der nächste Gast kommt.

import { spr, meta, hasTex, voice, fx, tap, hold, wipe, note, sfxSchleife, store, Actor, PIXI, rand, pick, clamp, lerp, ease } from '../../engine/index.js';
import { Seite } from '../../gemeinsam/seiten.js';
import { Fahrzeug } from '../../gemeinsam/zug.js';
import { belohne } from '../../gemeinsam/sticker.js';
import { Wolken, Spatz, freuen, ton, laut, Beutel, einfaerben, HandStart } from './deko.js';
import { FARBEN, bauplanFilter } from './hausbau.js';

const BODEN = 1195;                       // Boden vor der Halle (Unterkante der Tore)
const TORE = [-120, 452, 1028];           // Mitte der drei Tore
const TOR_HALB = 200;                     // halbe Breite eines Tors
const TOR_BOGEN = 820;                    // Mitte des Rundbogens (oben ist das Tor rund)
const ROLLTOR_AUF = -600;                 // so weit ist das Rolltor hochgezogen (ganz unsichtbar über dem Bogen)
const FAHR_Y = 1482;                      // Standlinie der Fahrzeuge vorn
const STOP_X = 640;                       // hier hält ein Fahrzeug zum Tanken
const PUMPE = { x: 150, y: 1335, s: 0.62 };
const TANK_DAUER = 2.2;                   // so lange festhalten, bis der Tank voll ist

const BANK = { x: -400, y: 1458, s: 0.82 };
const TISCH_Y = 1177;                     // hier steht das Werkstück auf der Werkbank
const STAPEL = { x: 30, y: 1505 };        // Bretterstapel
const BRETT_S = 0.62;
const GAST = { x: -1000, y: 1478, s: 0.26 };
const EIMER_ORTE = [{ x: -650, y: 1512 }, { x: -400, y: 1512 }, { x: -150, y: 1512 }];
const EIMER_S = 0.45;
const HAMMER_S = 0.5;

// Reihe der fertigen Werkstücke am Zaun (wächst über die Besuche)
const REIHE = [-1170, -1045, -920, -795, -670];
const REIHE_Y = 1192;
const MINI = 0.34;
const REIHE_KEY = 'baustelle.werkstuecke';

// Was gebaut werden kann; Nägel als Anteil von Breite (x, von der Mitte) und Höhe (y, vom Fuß)
const DINGE = {
  hundehuette: { tex: 'baustelle/hundehuette', s: 0.8, naegel: [[-0.36, 0.3], [0.36, 0.3], [0, 0.8]], gaeste: ['hund', 'katze', 'fuchs'] },
  vogelhaus: { tex: 'baustelle/vogelhaus', s: 0.76, naegel: [[-0.3, 0.58], [0.3, 0.58], [0, 0.3]], gaeste: ['eule', 'huhn', 'ente'] },
  briefkasten: { tex: 'baustelle/briefkasten', s: 0.76, naegel: [[-0.33, 0.64], [0.33, 0.64], [0, 0.3]], gaeste: ['igel', 'maus', 'hase', 'eichhoernchen'] },
};
const FAHRZEUGE = ['kipper', 'mischer', 'walze', 'bagger'];
const UEBERRASCHUNG = ['eule', 'igel', 'gluehwuermchen'];
const STERNE = [{ x: 120, y: 120 }, { x: 330, y: 230 }, { x: -260, y: 170 }, { x: 560, y: 90 }, { x: 760, y: 330 },
  { x: -60, y: 320 }, { x: -480, y: 300 }, { x: 420, y: 360 }];

export const BAUHOF_TIERE = [...new Set([...Object.values(DINGE).flatMap((d) => d.gaeste), 'eule', 'igel'])];

export class Bauhof extends Seite {
  static hg = 'baustelle/hg_bauhof';

  aufbau() {
    this.wolken = new Wolken(this, { anzahl: 2, y: [90, 240] });
    this.spatz = new Spatz(this, { x: -560, y: 1002, z: 5 });
    this.bauplan = bauplanFilter();
    this.filterListe = new Map();
    this.handStart = new HandStart(this.welt);
    this.dingBeutel = new Beutel(Object.keys(DINGE));
    this.gastBeutel = Object.fromEntries(Object.entries(DINGE).map(([k, d]) => [k, new Beutel(d.gaeste)]));
    this.fzBeutel = new Beutel(FAHRZEUGE);
    this.ueberBeutel = new Beutel(UEBERRASCHUNG);
    this.phase = 'start';
    this.minis = [];
    this.baueTore();
    this.baueBank();
    this.baueStapel();
    this.bauePumpe();
    this.baueNacht();
    this.baueReihe();
    this.after(0.8, () => this.neueWerkbank());
  }

  betreten() {
    this._hinweis?.kill();
    this._hinweis = null;
    this.sageHinweis(1.2);
  }

  verlassen() {
    this._hinweis?.kill();
    this._hinweis = null;
    this.tankTon?.aus(0.3);
  }

  // Satz zum gerade laufenden Schritt (der Kern sagt jeden höchstens einmal am Tag)
  sageHinweis(nach = 0.8) {
    if (!this.aktiv) return;
    const satz = {
      bretter: 'baustelle_bretter', naegel: 'baustelle_naegel', farbe: 'baustelle_farbe',
      anschliessen: 'baustelle_tanken', voll: 'baustelle_halle',
    }[this.phase];
    if (!satz) return;
    const phase = this.phase;
    const passt = () => this.aktiv && this.phase === phase;
    this._hinweis?.kill();
    this._hinweis = this.after(nach, () => { if (passt()) voice(satz, { nurWenn: passt }); });
  }

  filter(farbe) {
    let f = this.filterListe.get(farbe);
    if (!f) {
      f = einfaerben(farbe, { k: 1.0, b: 0.17 });
      this.filterListe.set(farbe, f);
    }
    return f;
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

  // ================================================================ Halle und Rolltore

  baueTore() {
    this.tore = TORE.map((cx, i) => {
      const c = new PIXI.Container({ label: 'tor' + i });
      c.zIndex = 6;
      this.welt.addChild(c);
      const maske = new PIXI.Graphics()
        .rect(cx - TOR_HALB, TOR_BOGEN, 2 * TOR_HALB, BODEN - TOR_BOGEN + 4).fill(0xffffff)
        .circle(cx, TOR_BOGEN, TOR_HALB).fill(0xffffff);
      c.addChild(maske);
      const rolltor = new PIXI.Graphics();
      const l = cx - TOR_HALB;
      rolltor.rect(l, 600, 2 * TOR_HALB, BODEN - 600 + 4).fill(0xa9bcd0);
      for (let y = 630; y < BODEN - 20; y += 48) {
        rolltor.rect(l, y, 2 * TOR_HALB, 7).fill({ color: 0x7d91a8, alpha: 0.8 });
        rolltor.rect(l, y + 7, 2 * TOR_HALB, 4).fill({ color: 0xffffff, alpha: 0.25 });
      }
      rolltor.roundRect(l, BODEN - 30, 2 * TOR_HALB, 30, 8).fill(0x6c7f95);
      rolltor.roundRect(cx - 40, BODEN - 70, 80, 18, 9).fill(0x55657a);
      rolltor.y = ROLLTOR_AUF;
      rolltor.eventMode = 'none';
      c.addChild(rolltor);
      c.mask = maske;
      // Tippfläche über der ganzen Toröffnung
      const f = new PIXI.Container({ label: 'torFlaeche' });
      f.hitArea = new PIXI.Rectangle(cx - TOR_HALB, TOR_BOGEN - 150, 2 * TOR_HALB, BODEN - TOR_BOGEN + 150);
      f.zIndex = 7;
      this.welt.addChild(f);
      const tor = { cx, c, rolltor, zu: false, i };
      tap(f, () => this.torGetippt(tor), { sound: null, squash: false });
      return tor;
    });
  }

  torGetippt(tor) {
    if (tor.zu) {
      // drinnen schläft ein Fahrzeug
      if (this.phase === 'nacht') {
        if (ton('common/schnarchen', { abstand: 1.5, vol: 0.5 })) this.burst('zzz', tor.cx, TOR_BOGEN - 40, { count: 2 });
      } else {
        ton('common/klack', { abstand: 0.3, vol: 0.6 });
      }
      fx.wobble(tor.rolltor, 0.004);
    } else {
      // leere Halle: ein tiefes Echo
      note('glocke', pick([55, 59, 62]), { vol: 0.2 });
    }
  }

  torZu(tor, zu, dauer = 1.4) {
    tor.zu = zu;
    ton('common/rolltor', { abstand: 0.6, vol: 0.55 });
    return this.tween(tor.rolltor, { y: zu ? 0 : ROLLTOR_AUF }, dauer, { ease: 'sineInOut' });
  }

  // ================================================================ Werkbank

  baueBank() {
    const b = spr('baustelle/werkbank', { x: BANK.x, y: BANK.y, parent: this.welt });
    b.scale.set(BANK.s);
    b.zIndex = 10;
    tap(b, () => {
      fx.wobble(b, 0.02);
      ton('common/klack', { abstand: 0.3, vol: 0.6 });
    }, { sound: null, squash: false });
    this.bank = b;
    // Tippfläche für die Nägel (nur im Nagel-Schritt an)
    const nf = new PIXI.Container({ label: 'naegelFlaeche' });
    nf.zIndex = 30;
    nf.eventMode = 'none';
    nf.on('pointerdown', (e) => {
      e.stopPropagation();
      this.nagelGetippt(this.welt.toLocal(e.global));
    });
    this.welt.addChild(nf);
    this.nagelFlaeche = nf;
    // Hammer (erscheint beim Klopfen): Drehpunkt am Griff, der Kopf schlägt auf den Nagel
    const h = new PIXI.Container({ label: 'hammer' });
    const hs = spr('baustelle/hammer', { parent: h });
    hs.anchor.set(0.06, 0.45);
    h.scale.set(HAMMER_S);
    h.zIndex = 40;
    h.visible = false;
    h.eventMode = 'none';
    this.welt.addChild(h);
    this.hammer = h;
    const mh = meta('baustelle/hammer');
    // Kopf-Mitte (Bildpunkte 322, 127) relativ zum Griff-Anker
    this.hammerKopf = { x: (322 - 0.06 * mh.w) * HAMMER_S, y: (127 - 0.45 * mh.h) * HAMMER_S, halb: 0.5 * mh.h * HAMMER_S };
  }

  baueStapel() {
    const c = new PIXI.Container({ label: 'bretter' });
    c.position.set(STAPEL.x, STAPEL.y);
    c.zIndex = 34;
    this.welt.addChild(c);
    const m = meta('baustelle/brett');
    // (oben nur wenig Rand: darüber steht die Zapfsäule, deren Fuß sonst unter der Tippfläche der Bretter läge)
    c.hitArea = new PIXI.Rectangle(-m.w * BRETT_S / 2 - 50, -3 * m.h * BRETT_S - 20, m.w * BRETT_S + 100, 3 * m.h * BRETT_S + 50);
    tap(c, () => this.stapelGetippt(), { sound: 'common/tipp', squash: false });
    this.stapel = c;
    this.bretter = [];
  }

  legeBretter() {
    const m = meta('baustelle/brett');
    const h = m.h * BRETT_S;
    this.bretter = [];
    this.stapel.eventMode = 'static';
    for (let i = 0; i < 3; i++) {
      const b = spr('baustelle/brett', { parent: this.stapel });
      b.scale.set(0.01);
      b.position.set(rand(-8, 8), -h / 2 - i * (h - 8));
      b.rotation = rand(-0.03, 0.03);
      b.eventMode = 'none';
      this.after(0.2 + i * 0.2, () => {
        if (b.destroyed) return;
        ton('common/plopp', { abstand: 0.12, vol: 0.5 });
        this.tween(b, { scale: BRETT_S }, 0.4, { ease: 'backOut' });
      });
      this.bretter.push(b);
    }
  }

  async neueWerkbank() {
    this.phase = 'bretter';
    this.brettNr = 0;
    this.brettFliegt = false;
    this.lieblingsFarbe = null;
    this.farbe = null;
    this.art =this.dingBeutel.ziehe();
    this.baueDing(this.art);
    this.legeBretter();
    this.gastKommt(this.gastBeutel[this.art].ziehe());
    this.sageHinweis(1.5);
  }

  baueDing(art) {
    const d = DINGE[art];
    const m = meta(d.tex);
    const c = new PIXI.Container({ label: 'werkstueck', sortableChildren: true });
    c.position.set(BANK.x, TISCH_Y);
    c.zIndex = 12;
    this.welt.addChild(c);
    const geist = spr(d.tex, { parent: c });
    geist.scale.set(d.s);
    geist.filters = [this.bauplan];
    geist.alpha = 0;
    geist.eventMode = 'none';
    this.tween(geist, { alpha: 0.5 }, 0.8, { ease: 'sineInOut' });
    const holz = spr(d.tex, { parent: c });
    holz.scale.set(d.s);
    holz.zIndex = 2;
    holz.eventMode = 'none';
    const maske = new PIXI.Graphics();
    c.addChild(maske);
    holz.mask = maske;
    this.ding = { art, d, c, geist, holz, maske, w: m.w * d.s, h: m.h * d.s, sicht: 0, naegel: [] };
    this.zeichneMaske();
  }

  zeichneMaske() {
    const g = this.ding;
    const hoch = g.h * g.sicht + 4;
    g.maske.clear().rect(-g.w / 2 - 30, -hoch, g.w + 60, hoch + 6).fill(0xffffff);
  }

  async gastKommt(id) {
    const tier = new Actor(id, { x: -1500, y: GAST.y, scale: GAST.s, parent: this.welt, z: 36 });
    this.gast = tier;
    tier.onTap(() => this.gastGetippt(tier));
    tier._unterwegs = true;
    while (!tier.destroyed && !(await tier.walkTo(GAST.x, GAST.y, { tempo: 300 }))) await this.wait(0.3);
    if (tier.destroyed) return;
    tier._unterwegs = false;
    tier.lookAt(GAST.x + 500);
    if (this.ding && this.phase !== 'fertig') tier.bubble(this.ding.d.tex, 2.6);
  }

  gastGetippt(tier) {
    laut(tier.tierId);
    if (tier._unterwegs || tier._blase) {
      fx.wobble(tier, 0.05);
      return;
    }
    if (this.phase === 'farbe' && this.lieblingsFarbe) tier.bubble(this.lieblingsFarbe.tex, 2);
    else if (this.ding && ['bretter', 'naegel'].includes(this.phase)) tier.bubble(this.ding.d.tex, 2);
    else freuen(this, tier);
  }

  // ---------------------------------------------------------------- Bretter

  stapelGetippt() {
    if (this.phase !== 'bretter' || this.brettFliegt || this.brettNr >= 3) {
      fx.wobble(this.stapel, 0.03);
      return;
    }
    const b = this.bretter[this.bretter.length - 1 - this.brettNr];
    if (!b || b.destroyed) return;
    this.brettNr++;
    this.brettFliegt = true;
    this.brettFlug(b);
  }

  async brettFlug(b) {
    // vom Stapel in die Welt umhängen (gleicher Ort), dann im Bogen auf die Werkbank
    const p = this.welt.toLocal(b.getGlobalPosition());
    this.welt.addChild(b);
    b.position.set(p.x, p.y);
    b.zIndex = 38;
    ton('common/wusch', { abstand: 0.3, vol: 0.5 });
    const g = this.ding;
    const zielY = TISCH_Y - g.h * (this.brettNr - 0.5) / 3;
    this.tween(b, { rotation: rand(-0.2, 0.2) }, 0.6, { ease: 'sineInOut' });
    await this.bogen(b, BANK.x, zielY, 0.7, 180);
    // das Brett wird zu einem Teil des Dings
    this.tween(b, { alpha: 0, scaleX: BRETT_S * 1.2 }, 0.3, { ease: 'sineInOut' }).then(() => b.destroy());
    ton('common/klack', { abstand: 0.15 });
    this.burst('staub', BANK.x, zielY + 20, { count: 3 });
    const n = this.brettNr;
    // der Stapel ist leer: keine Tippfläche mehr (sonst fängt sie Tipps auf den Fuß der Zapfsäule ab)
    if (n >= 3) this.stapel.eventMode = 'none';
    await this.tween(g, { sicht: n / 3 }, 0.45, { ease: 'sineInOut', onUpdate: () => this.zeichneMaske() });
    this.zeichneMaske();
    fx.pop(g.c, 0.04);
    this.brettFliegt = false;
    if (n >= 3) this.alleBretter();
  }

  async alleBretter() {
    this.phase = 'naegel-kommen';
    const g = this.ding;
    g.holz.mask = null;
    g.maske.destroy();
    this.tween(g.geist, { alpha: 0 }, 0.5, { ease: 'sineInOut' }).then(() => g.geist.destroy());
    await this.wait(0.5);
    // drei Nägel stehen vor (große, glänzende Köpfe)
    g.naegel = g.d.naegel.map(([fx_, fy], i) => {
      const n = new PIXI.Container({ label: 'nagel' });
      n.position.set(fx_ * g.w, -fy * g.h);
      n.zIndex = 5;
      const kopf = new PIXI.Graphics()
        .circle(3, 5, 22).fill({ color: 0x5a4a3a, alpha: 0.35 })
        .circle(0, 0, 20).fill(0x9aa3ad).stroke({ width: 4, color: 0x6d7681 })
        .circle(-6, -6, 6).fill({ color: 0xffffff, alpha: 0.6 });
      n.addChild(kopf);
      n.eventMode = 'none';
      n.schlaege = 0;
      n.scale.set(0.01);
      g.c.addChild(n);
      this.after(i * 0.2, () => {
        ton('common/plopp', { abstand: 0.12, vol: 0.5 });
        this.tween(n, { scale: 1.35 }, 0.4, { ease: 'backOut' });
      });
      return n;
    });
    await this.wait(0.7);
    this.nagelFlaeche.hitArea = new PIXI.Rectangle(BANK.x - g.w / 2 - 70, TISCH_Y - g.h - 70, g.w + 140, g.h + 100);
    this.nagelFlaeche.eventMode = 'static';
    this.hammerBusy = false;
    this.phase = 'naegel';
    this.sageHinweis();
  }

  // ---------------------------------------------------------------- Nägel

  naechsterNagel() {
    return this.ding?.naegel.find((n) => n.schlaege < 2) || null;
  }

  nagelGetippt(p) {
    if (this.phase !== 'naegel') return;
    const g = this.ding;
    // der Nagel, der dem Finger am nächsten ist (und noch nicht drin)
    let best = null;
    let bestD = Infinity;
    for (const n of g.naegel) {
      if (n.schlaege >= 2) continue;
      const d = Math.hypot(g.c.x + n.x - p.x, g.c.y + n.y - p.y);
      if (d < bestD) { bestD = d; best = n; }
    }
    if (!best) return;
    if (this.hammerBusy) {
      fx.wobble(g.c, 0.02);
      return;
    }
    this.klopfe(best);
  }

  async klopfe(n) {
    this.hammerBusy = true;
    const g = this.ding;
    const h = this.hammer;
    const k = this.hammerKopf;
    const zx = g.c.x + n.x;
    const zy = g.c.y + n.y - 14;
    // Griff so setzen, dass der Kopf (Drehung 0) mit seiner Unterkante auf dem Nagel liegt
    const hx = zx - k.x;
    const hy = zy - k.y - k.halb;
    let dauer = 0.22;
    if (!h.visible) {
      h.position.set(hx, hy);
      h.visible = true;
      h.alpha = 0;
      h.rotation = -0.8;
      this.tween(h, { alpha: 1 }, 0.25, { ease: 'sineInOut' });
    } else if (Math.hypot(h.x - hx, h.y - hy) > 2) {
      // zum nächsten Nagel weich hinübergleiten (nicht springen), dabei ausholen
      dauer = 0.4;
      this.tween(h, { x: hx, y: hy }, dauer, { ease: 'sineInOut' });
    }
    // ruhig ausholen und schlagen (der Kopf ist dabei höchstens etwa 1200 Einheiten/s schnell)
    await this.tween(h, { rotation: -0.8 }, dauer, { ease: 'sineInOut' });
    await this.tween(h, { rotation: 0 }, 0.2, { ease: 'quadIn' });
    n.schlaege++;
    ton('common/klack', { abstand: 0.1, vol: 0.9, rate: n.schlaege === 1 ? 1 : 1.15 });
    this.burst('staub', zx, zy + 10, { count: 2 });
    this.tween(n, { scale: n.schlaege >= 2 ? 0.75 : 1.05 }, 0.12, { ease: 'quadOut' });
    fx.pop(g.c, 0.025);
    await this.tween(h, { rotation: -0.55 }, 0.25, { ease: 'quadOut' });
    this.hammerBusy = false;
    if (n.schlaege >= 2) {
      this.burst('funkeln', zx, zy - 10, { count: 2 });
      if (!this.naechsterNagel()) this.alleNaegel();
    }
  }

  async alleNaegel() {
    this.phase = 'farbe-kommt';
    this.nagelFlaeche.eventMode = 'none';
    ton('common/funkeln', { abstand: 0.5, vol: 0.6 });
    await this.wait(0.3);
    this.tween(this.hammer, { alpha: 0, rotation: -0.9 }, 0.4, { ease: 'sineInOut' }).then(() => { this.hammer.visible = false; });
    if (this.gast && !this.gast._unterwegs) freuen(this, this.gast, { herzen: 3 });
    await this.wait(0.6);
    // drei Eimer (aus vier Farben), der Gast zeigt seine Lieblingsfarbe
    const farben = FARBEN.slice().sort(() => Math.random() - 0.5).slice(0, 3);
    this.eimer = farben.map((f, i) => {
      const e = spr(f.tex, { parent: this.welt });
      e.farbe = f;
      e.scale.set(0.01);
      e.position.set(EIMER_ORTE[i].x, EIMER_ORTE[i].y);
      e.zIndex = 42;
      this.after(0.1 + i * 0.25, async () => {
        if (e.destroyed) return;
        ton('common/plopp', { abstand: 0.12, vol: 0.6 });
        await this.tween(e, { scale: EIMER_S }, 0.45, { ease: 'backOut' });
        if (e.destroyed || e.tippen) return;
        const m = meta(f.tex);
        e.tippen = tap(e, () => this.waehleFarbe(e), {
          sound: 'common/tipp', squash: false,
          hitArea: new PIXI.Rectangle(-m.ax * m.w - 60, -m.ay * m.h - 60, m.w + 120, m.h + 100),
        });
      });
      return e;
    });
    this.phase = 'farbe';
    await this.wait(0.9);
    const lieblings = pick(this.eimer);
    this.lieblingsFarbe = lieblings.farbe;
    if (this.gast && !this.gast.destroyed && this.phase === 'farbe') {
      if (!this.gast._unterwegs) this.gast.bubble(lieblings.farbe.tex, 2.6);
      const puls = fx.pulse(lieblings, { staerke: 0.05, periode: 1.6 });
      this.after(3.2, () => puls.stop());
    }
    this.sageHinweis(0.6);
  }

  // ---------------------------------------------------------------- Streichen

  waehleFarbe(e) {
    if (this.phase !== 'farbe') {
      fx.wobble(e, 0.06);
      ton('common/platsch', { abstand: 0.6, vol: 0.4 });
      return;
    }
    this.phase = 'malen';
    this.farbe = e.farbe;
    ton('common/platsch', { abstand: 0.3, vol: 0.6 });
    for (const a of this.eimer) {
      if (a === e) continue;
      a.tippen?.off();
      a.eventMode = 'none';
      this.tween(a, { scale: 0.01, alpha: 0 }, 0.4, { ease: 'backIn' }).then(() => a.destroy());
    }
    this.eimer = [e];
    e.tippen?.off();
    e.eventMode = 'none';
    // der Eimer hüpft neben die Werkbank, der Pinsel steckt darin
    const ziel = { x: BANK.x + 390, y: 1505 };
    this.tween(e, { x: ziel.x }, 0.6, { ease: 'sineInOut' });
    this.tween(e, { y: ziel.y - 120 }, 0.3, { ease: 'quadOut' }).then(() => this.tween(e, { y: ziel.y }, 0.3, { ease: 'quadIn' }));
    const pin = spr('baustelle/pinsel', { parent: this.welt });
    // (Borsten nach unten in den Eimer; der Pinsel steckt hinter dem Eimerrand)
    pin.position.set(ziel.x + 15, ziel.y - 225);
    pin.rotation = -0.75;
    pin.zIndex = 41;
    pin.scale.set(0.01);
    pin.eventMode = 'none';
    this.after(0.6, () => this.tween(pin, { scale: 0.55 }, 0.4, { ease: 'backOut' }));
    this.pinsel = pin;
    if (this.gast && !this.gast.destroyed) freuen(this, this.gast, { herzen: e.farbe === this.lieblingsFarbe ? 5 : 3 });
    // die bunte Fassung liegt darunter, das Holz wird weggewischt
    const g = this.ding;
    const neu = spr(g.d.tex, { parent: g.c });
    neu.scale.set(g.d.s);
    neu.zIndex = 1;
    neu.filters = [this.filter(e.farbe.c)];
    neu.eventMode = 'none';
    g.neu = neu;
    const m = meta(g.d.tex);
    g.wisch = wipe(g.holz, {
      radius: 130,
      doneAt: 0.62,
      sound: 'common/pinsel',
      hitArea: new PIXI.Rectangle(-m.ax * m.w - 60, -m.ay * m.h - 40, m.w + 120, m.h + 60),
      onDone: () => this.after(0.6, () => this.gestrichen()),
    });
    this.sageHinweis();
  }

  async gestrichen() {
    if (this.phase !== 'malen') return;
    this.phase = 'fertig';
    const g = this.ding;
    g.wisch?.off();
    g.holz.visible = false;
    ton('common/funkeln', { abstand: 0.5, vol: 0.7 });
    this.burst('funkeln', BANK.x, TISCH_Y - g.h / 2, { count: 6 });
    for (const e of this.eimer) this.tween(e, { scale: 0.01, alpha: 0 }, 0.5, { ease: 'backIn', delay: 0.3 }).then(() => e.destroy());
    this.eimer = [];
    const pin = this.pinsel;
    this.pinsel = null;
    if (pin) this.tween(pin, { scale: 0.01, alpha: 0 }, 0.5, { ease: 'backIn', delay: 0.3 }).then(() => pin.destroy());
    belohne(this, 'baustelle_hammer', BANK.x, TISCH_Y - g.h - 120);
    await this.wait(1.4);
    // das Ding hüpft zum Gast
    const gast = this.gast;
    if (gast && !gast.destroyed) {
      while (gast._unterwegs && !gast.destroyed) await this.wait(0.3);
      const c = g.c;
      c.zIndex = 37;
      ton('common/wusch', { abstand: 0.3, vol: 0.5 });
      await this.bogen(c, gast.x + 230, GAST.y - 4, 0.9, 200);
      ton('common/plopp', { abstand: 0.15 });
      if (!gast.destroyed) gast.cheer({ parent: this.vorn });
      await this.wait(1.6);
    }
    await this.inDieReihe(g);
    this.ding = null;
    // der Gast winkt und geht
    if (gast && !gast.destroyed) {
      gast._unterwegs = true;
      gast.walkTo(-1550, GAST.y, { tempo: 280 }).then(() => gast.destroy({ children: true }));
    }
    this.gast = null;
    await this.wait(1.6);
    this.feierabend();
  }

  // ---------------------------------------------------------------- Reihe am Zaun

  reiheListe() {
    const l = store.get(REIHE_KEY, []);
    const liste = Array.isArray(l)
      ? l.filter((e) => e && DINGE[e.art] && FARBEN.some((f) => f.id === e.farbe)).slice(-REIHE.length).map((e) => ({ ...e })) : [];
    const belegt = new Set();
    for (const e of liste) {
      if (Number.isInteger(e.platz) && e.platz >= 0 && e.platz < REIHE.length && !belegt.has(e.platz)) belegt.add(e.platz);
      else e.platz = -1;
    }
    for (const e of liste) {
      if (e.platz >= 0) continue;
      e.platz = REIHE.findIndex((_, i) => !belegt.has(i));
      belegt.add(e.platz);
    }
    return liste;
  }

  baueReihe() {
    for (const e of this.reiheListe()) {
      const d = DINGE[e.art];
      const c = new PIXI.Container({ label: 'mini' });
      c.position.set(REIHE[e.platz], REIHE_Y);
      c.zIndex = 4;
      const s = spr(d.tex, { parent: c });
      s.scale.set(d.s * MINI);
      s.filters = [this.filter(FARBEN.find((f) => f.id === e.farbe).c)];
      s.eventMode = 'none';
      this.welt.addChild(c);
      this.macheMiniTippbar(c, d);
      this.minis.push(c);
    }
  }

  macheMiniTippbar(c, d) {
    const m = meta(d.tex);
    const w = m.w * d.s * MINI;
    const h = m.h * d.s * MINI;
    // (Tippfläche mindestens 200 breit – die Nachbarn überlappen sich, jedes antwortet gleich)
    c.hitArea = new PIXI.Rectangle(-Math.max(w, 200) / 2, -Math.max(h, 200), Math.max(w, 200), Math.max(h, 200) + 20);
    c.eventMode = 'static';
    tap(c, () => {
      fx.wobble(c, 0.06);
      note('glocke', pick([76, 79, 84]), { vol: 0.22 });
    }, { sound: null, squash: false });
  }

  async inDieReihe(g) {
    const liste = this.reiheListe();
    let platz = REIHE.findIndex((_, i) => !liste.some((e) => e.platz === i));
    let weg = null;
    if (platz < 0) {
      platz = liste.shift().platz;
      weg = this.minis.shift();
    }
    liste.push({ art: g.art, farbe: this.farbe?.id || 'blau', platz });
    store.set(REIHE_KEY, liste);
    const c = g.c;
    for (const n of g.naegel) n.visible = false;   // (beim Kleinen sieht man die Nägel nicht)
    if (weg && !weg.destroyed) {
      weg.eventMode = 'none';
      await this.tween(weg, { alpha: 0 }, 0.9, { ease: 'sineInOut' });
      weg.destroy({ children: true });
    }
    c.zIndex = 4;
    ton('common/wusch', { abstand: 0.5, vol: 0.5 });
    await this.tween(c, { x: REIHE[platz], y: REIHE_Y, scaleX: MINI, scaleY: MINI }, 1.8, { ease: 'sineInOut' });
    // als kleines Ding neu aufbauen (eine Fassung, gleicher Maßstab wie die gespeicherten)
    g.neu.scale.set(g.d.s * MINI);
    c.scale.set(1);
    g.holz.destroy();
    for (const n of g.naegel) n.destroy();
    this.macheMiniTippbar(c, g.d);
    this.burst('funkeln', c.x, c.y - 80, { count: 3 });
    this.minis.push(c);
  }

  // ================================================================ Feierabend

  bauePumpe() {
    const p = spr('baustelle/zapfsaeule', { x: PUMPE.x, y: PUMPE.y, parent: this.welt });
    p.scale.set(PUMPE.s);
    p.zIndex = 20;
    this.pumpe = p;
    const m = meta('baustelle/zapfsaeule');
    // wo der Schlauch unten aus der Säule kommt (Bildpunkte 380, 520)
    this.schlauchStart = { x: PUMPE.x + (380 - m.ax * m.w) * PUMPE.s, y: PUMPE.y + (520 - m.ay * m.h) * PUMPE.s };
    hold(p, {
      hitArea: new PIXI.Rectangle(-m.ax * m.w - 40, -m.ay * m.h - 20, m.w + 80, m.h + 40),
      onStart: () => this.pumpeGetippt(),
      onTick: (dt) => { if (this.phase === 'tanken') this.tanke(dt / TANK_DAUER); },
      onEnd: () => this.tankTon?.aus(0.3),
    });
    const schlauch = new PIXI.Graphics();
    schlauch.zIndex = 33;
    schlauch.eventMode = 'none';
    this.welt.addChild(schlauch);
    this.schlauch = schlauch;
    this.schlauchP = 0;
    const anzeige = new PIXI.Graphics();
    anzeige.zIndex = 45;
    anzeige.eventMode = 'none';
    anzeige.visible = false;
    this.welt.addChild(anzeige);
    this.anzeige = anzeige;
  }

  pumpeGetippt() {
    fx.wobble(this.pumpe, 0.02);
    if (this.phase === 'anschliessen') {
      this.anschliessen();
    } else if (this.phase === 'tanken') {
      this.tanke(0.18);
    } else {
      ton('common/klick', { abstand: 0.3, vol: 0.6 });
    }
  }

  async anschliessen() {
    this.phase = 'verbinden';
    ton('common/klack', { abstand: 0.2, vol: 0.7 });
    this.tankP = 0;
    this.zeichneAnzeige();
    this.anzeige.visible = true;
    this.anzeige.alpha = 0;
    this.tween(this.anzeige, { alpha: 1 }, 0.5, { ease: 'sineInOut' });
    await this.tween(this, { schlauchP: 1 }, 0.5, { ease: 'sineInOut' });
    this.phase = 'tanken';
    this.tanke(0.1);
  }

  tankPunkt(v) {
    return { x: v.c.x - v.breite * 0.4, y: FAHR_Y - v.hoehe * 0.42 };
  }

  zeichneSchlauch() {
    const v = this.fz;
    const g = this.schlauch;
    g.clear();
    if (!v || this.schlauchP <= 0.01) return;
    const a = this.schlauchStart;
    const z = this.tankPunkt(v);
    const p = this.schlauchP;
    const e = { x: lerp(a.x + 30, z.x, p), y: lerp(a.y - 60, z.y, p) };
    const k = { x: (a.x + e.x) / 2, y: Math.max(a.y, e.y) + 70 };
    g.moveTo(a.x, a.y).quadraticCurveTo(k.x, k.y, e.x, e.y).stroke({ width: 18, color: 0x3c3a3a, cap: 'round' });
    g.roundRect(e.x - 26, e.y - 20, 52, 40, 14).fill(0xf2c230).stroke({ width: 4, color: 0xc99a1c });
  }

  zeichneAnzeige() {
    const v = this.fz;
    if (!v) return;
    const g = this.anzeige;
    const p = clamp(this.tankP || 0, 0, 1);
    g.clear()
      .roundRect(-100, -30, 200, 60, 30).fill(0xfffaf0).stroke({ width: 6, color: 0x6a5a48 });
    if (p > 0.02) g.roundRect(-88, -18, 176 * p, 36, 18).fill(p >= 1 ? 0x6cc35a : 0x9ad46e);
    // Tropfen-Zeichen links daneben
    g.circle(-138, 8, 18).fill(0x3c3a3a).poly([-152, 0, -124, 0, -138, -30]).fill(0x3c3a3a);
    g.position.set(v.c.x, FAHR_Y - v.hoehe - 70);
  }

  tanke(d) {
    if (this.phase !== 'tanken') return;
    this.tankP = Math.min(1, (this.tankP || 0) + d);
    if (!this.tankTon) this.tankTon = sfxSchleife('common/giessen', { vol: 0.4, rate: 0.8 });
    if (!this.tankTon.aktiv) this.tankTon.an(0.2);
    this.zeichneAnzeige();
    if (this.tankP >= 1) this.vollGetankt();
  }

  async vollGetankt() {
    this.phase = 'voll-wird';
    this.tankTon?.aus(0.3);
    ton('common/funkeln', { abstand: 0.4, vol: 0.6 });
    this.burst('funkeln', this.anzeige.x, this.anzeige.y, { count: 4 });
    await this.tween(this, { schlauchP: 0 }, 0.5, { ease: 'sineInOut' });
    const v = this.fz;
    if (!v) return;
    ton('common/hupe', { abstand: 0.5, vol: 0.7 });
    this.hupf(v);
    this.phase = 'voll';
    v.puls = fx.pulse(v.koerper, { staerke: 0.03, periode: 1.8 });
    this.sageHinweis(0.6);
  }

  hupf(v) {
    if (v.fz) { v.fz.hupf(16); return; }
    this.tween(v.koerper, { y: -30 }, 0.15, { ease: 'quadOut' }).then(() => this.tween(v.koerper, { y: 0 }, 0.2, { ease: 'quadIn' }));
  }

  // Fahrzeug bauen: c = Container mit Mitte unten am Boden, Blick nach rechts; koerper = was hüpft/pulst
  machFahrzeug(art) {
    let v;
    if (art === 'kipper') {
      const fz = new Fahrzeug({
        koerper: 'baustelle/kipper',
        raeder: [{ tex: 'baustelle/rad_lkw', punkt: 'rad1' }, { tex: 'baustelle/rad_lkw', punkt: 'rad2' }],
        x: -1900, y: FAHR_Y, scale: 0.42, parent: this.welt, z: 30,
      });
      v = { c: fz, fz, koerper: fz.rumpf, s: 0.42, w: 958, h: 700 };
    } else {
      const c = new PIXI.Container({ label: 'fz:' + art });
      const k = new PIXI.Container();
      c.addChild(k);
      v = { c, koerper: k };
      if (art === 'mischer') {
        spr('baustelle/mischer', { parent: k });
        Object.assign(v, { s: 0.46, w: 900, h: 600 });
      } else if (art === 'walze') {
        const mw = meta('baustelle/walze');
        const tr = spr('baustelle/walze_trommel', { anchor: 0.5, parent: k });
        tr.scale.set(0.72);
        tr.position.set(mw.pts.trommel[0] - mw.ax * mw.w, mw.pts.trommel[1] - mw.ay * mw.h);
        spr('baustelle/walze', { parent: k });
        Object.assign(v, { s: 0.46, w: 900, h: 610, trommel: tr });
      } else {
        // Bagger: Bild schaut nach links – gespiegelt, damit er nach rechts fährt
        const dreh = new PIXI.Container();
        dreh.scale.x = -1;
        k.addChild(dreh);
        spr('baustelle/bagger_koerper', { parent: dreh });
        const mk = meta('baustelle/bagger_koerper');
        const ma = meta('baustelle/bagger_arm');
        const arm = spr('baustelle/bagger_arm', { parent: dreh });
        arm.anchor.set(825 / ma.w, 105 / ma.h);
        arm.scale.set(0.55 / 0.62);
        arm.position.set(mk.pts.gelenk[0] - mk.ax * mk.w, mk.pts.gelenk[1] - mk.ay * mk.h);
        arm.rotation = 0.75;
        Object.assign(v, { s: 0.42, w: 900, h: 700 });
      }
      c.scale.set(v.s);
      c.position.set(-1900, FAHR_Y);
      c.zIndex = 30;
      this.welt.addChild(c);
    }
    v.art = art;
    v.breite = v.w * v.s;
    v.hoehe = v.h * v.s;
    tap(v.c, () => this.fahrzeugGetippt(v), {
      sound: null, squash: false,
      hitArea: new PIXI.Rectangle(-v.w * 0.6, -v.h * 1.05, v.w * 1.2, v.h * 1.1),
    });
    return v;
  }

  // Fahrzeug weich nach x (und y, Größe) bewegen, Räder/Trommel drehen mit
  fahre(v, ziel, dauer, kurve = 'sineInOut') {
    let letztes = v.c.x;
    return this.tween(v.c, ziel, dauer, {
      ease: kurve,
      onUpdate: () => {
        const dx = v.c.x - letztes;
        letztes = v.c.x;
        if (v.fz) v.fz.rolle(dx);
        else if (v.trommel) v.trommel.rotation += dx / (150 * v.c.scale.x);
      },
    });
  }

  fahrzeugGetippt(v) {
    if (this.fz === v && this.phase === 'voll') {
      this.inDieHalle(v);
      return;
    }
    if (ton('common/hupe', { abstand: 0.6, vol: 0.6 })) this.hupf(v);
  }

  async feierabend() {
    this.phase = 'abend';
    // es wird abendlich (weich, über 2,5 s)
    this.tween(this.dunkel, { alpha: 0.16 }, 2.5, { ease: 'sineInOut' });
    await this.wait(1.2);
    // drei verschiedene Fahrzeuge, drei Tore in neuer Reihenfolge
    const arten = [];
    for (let i = 0; arten.length < 3 && i < 20; i++) {
      const a = this.fzBeutel.ziehe();
      if (!arten.includes(a)) arten.push(a);
    }
    const tore = [0, 1, 2].sort(() => Math.random() - 0.5);
    for (let i = 0; i < arten.length; i++) await this.fahrzeugRunde(arten[i], this.tore[tore[i]]);
    this.nacht();
  }

  async fahrzeugRunde(art, tor) {
    const v = this.machFahrzeug(art);
    this.fz = v;
    this.tor = tor;
    this.phase = 'kommt';
    ton('common/motor', { abstand: 3, vol: 0.55 });
    await this.fahre(v, { x: STOP_X }, 3.0, 'sineOut');
    ton('common/hupe', { abstand: 0.6, vol: 0.6 });
    this.hupf(v);
    this.phase = 'anschliessen';
    this.sageHinweis(1.0);
    await new Promise((r) => { this._weiter = r; });
  }

  async inDieHalle(v) {
    this.phase = 'faehrt';
    v.puls?.stop();
    const tor = this.tor;
    this.tween(this.anzeige, { alpha: 0 }, 0.5, { ease: 'sineInOut' }).then(() => { this.anzeige.visible = false; });
    ton('common/motor', { abstand: 2, vol: 0.55 });
    if (v.fz) v.c.zIndex = 8;
    else v.c.zIndex = 8;
    // in einem Zug schräg nach hinten vor das Tor, dabei etwas kleiner (weiter weg)
    await this.fahre(v, { x: tor.cx, y: BODEN + 6, scaleX: v.s * 0.8, scaleY: v.s * 0.8 }, 2.4);
    // hinein ins Dunkle
    await this.tween(v.c, { alpha: 0, y: BODEN - 4 }, 0.9, { ease: 'sineInOut' });
    v.c.destroy({ children: true });
    if (this.fz === v) this.fz = null;
    await this.torZu(tor, true);
    this.burst('zzz', tor.cx, TOR_BOGEN - 40, { count: 1 });
    await this.wait(0.4);
    const weiter = this._weiter;
    this._weiter = null;
    weiter?.();
  }

  // ---------------------------------------------------------------- Nacht und Morgen

  baueNacht() {
    const d = new PIXI.Graphics().rect(-1500, -50, 3000, 1700).fill(0x1c2a5c);
    d.alpha = 0;
    d.zIndex = 800;
    d.eventMode = 'none';
    this.welt.addChild(d);
    this.dunkel = d;
    const mond = spr('common/mond', { x: 640, y: 250, parent: this.welt });
    mond.scale.set(0.3);
    mond.zIndex = 820;
    mond.alpha = 0;
    mond.visible = false;
    tap(mond, () => {
      fx.wobble(mond, 0.06);
      note('glocke', pick([72, 76, 79]), { vol: 0.25 });
    }, { sound: null, pad: 40 });
    this.mond = mond;
    this.sterne = STERNE.map((p) => {
      const s = spr('common/stern_himmel', { x: p.x, y: p.y, parent: this.welt });
      s.scale.set(rand(0.45, 0.65));
      s.zIndex = 815;
      s.alpha = 0;
      s.visible = false;
      s.eventMode = 'none';
      return s;
    });
  }

  async nacht() {
    this.phase = 'nacht';
    this.tween(this.dunkel, { alpha: 0.5 }, 3.0, { ease: 'sineInOut' });
    await this.wait(1.0);
    const mond = this.mond;
    mond.visible = true;
    this.tween(mond, { alpha: 1 }, 1.6, { ease: 'sineInOut' });
    const anzahl = 5 + Math.floor(Math.random() * 4);
    const liste = this.sterne.slice().sort(() => Math.random() - 0.5).slice(0, anzahl);
    liste.forEach((s, i) => {
      s.visible = true;
      this.tween(s, { alpha: 0.9 }, 1.2, { ease: 'sineInOut', delay: 0.6 + i * 0.3 });
    });
    voice('baustelle_feierabend', { nurWenn: () => this.aktiv && this.phase === 'nacht' });
    await this.wait(1.2);
    belohne(this, 'baustelle_zapfsaeule', PUMPE.x, PUMPE.y - 450);
    this.ueberraschung(this.ueberBeutel.ziehe());
    // die Fahrzeuge schlafen: ab und zu ein Z aus einem Tor
    for (let i = 0; i < 4; i++) {
      this.after(1.5 + i * 2.2, () => {
        if (this.phase !== 'nacht') return;
        const t = this.tore[i % 3];
        this.burst('zzz', t.cx, TOR_BOGEN - 40, { count: 1 });
      });
    }
    await this.wait(9);
    this.morgen();
  }

  ueberraschung(art) {
    this._ueber = null;
    if (art === 'gluehwuermchen') {
      const e = this.emitter('funkeln', { x: -820, y: 980, rate: 0.9 });
      this.after(7, () => e.stop());
      return;
    }
    if (art === 'eule') {
      // eine Eule setzt sich auf den Zaun
      const t = new Actor('eule', { x: -1120, y: 1010, scale: 0.17, parent: this.welt, z: 830 });
      t.alpha = 0;
      t.onTap(() => freuen(this, t, { herzen: 2 }), { pad: 70 });
      this.tween(t, { alpha: 1 }, 1.0, { ease: 'sineInOut' }).then(() => laut('eule'));
      this._ueber = t;
      return;
    }
    // ein Igel schnüffelt vorn über den Platz
    const t = new Actor('igel', { x: -1500, y: 1470, scale: 0.2, parent: this.welt, z: 830 });
    t.onTap(() => freuen(this, t, { herzen: 2 }), { pad: 70 });
    this._ueber = t;
    t.walkTo(-500, 1470, { tempo: 160 }).then((ok) => { if (ok && !t.destroyed) laut('igel'); });
  }

  async morgen() {
    this.phase = 'morgen';
    this.tween(this.dunkel, { alpha: 0 }, 2.8, { ease: 'sineInOut' });
    const weg = [this.mond, ...this.sterne].filter((s) => s.visible);
    for (const s of weg) this.tween(s, { alpha: 0 }, 1.6, { ease: 'sineInOut' }).then(() => { s.visible = false; });
    const u = this._ueber;
    this._ueber = null;
    if (u && !u.destroyed) this.tween(u, { alpha: 0 }, 1.4, { ease: 'sineInOut' }).then(() => u.destroy({ children: true }));
    await this.wait(1.8);
    // die Tore gehen nacheinander auf (die Halle ist leer – die Fahrzeuge sind schon bei der Arbeit)
    for (const t of this.tore) {
      if (!t.zu) continue;
      this.torZu(t, false, 1.2);
      await this.wait(0.7);
    }
    await this.wait(0.8);
    this.neueWerkbank();
  }

  // ================================================================ Takt und Hinweise

  update(dt) {
    this.wolken.update(dt);
    if (this.fz?.fz && !this.fz.c.destroyed) this.fz.fz.update(dt);
    if (this.schlauchP > 0.01 || this._schlauchSichtbar) {
      this.zeichneSchlauch();
      this._schlauchSichtbar = this.schlauchP > 0.01;
    }
  }

  hinweise() {
    const g = this.ding;
    switch (this.phase) {
      case 'bretter': {
        const b = this.bretter[this.bretter.length - 1 - this.brettNr];
        return b && !b.destroyed ? [this.stapel] : [this.bank];
      }
      case 'naegel': {
        const n = this.naechsterNagel();
        return n ? [{ x: g.c.x + n.x, y: g.c.y + n.y }] : [this.bank];
      }
      case 'farbe': {
        const l = (this.eimer || []).find((e) => e.farbe === this.lieblingsFarbe) || this.eimer?.[0];
        return l ? [l] : [this.bank];
      }
      case 'malen':
        return [{ von: this.handStart.bei(BANK.x - g.w / 2 + 20, TISCH_Y - g.h * 0.55), nach: { x: BANK.x + g.w / 2 - 20, y: TISCH_Y - g.h * 0.55 } }];
      case 'anschliessen':
      case 'tanken':
        return [this.pumpe];
      case 'voll':
        return this.fz ? [this.fz.c] : [this.pumpe];
      case 'nacht':
        return [this.mond];
      case 'fertig':
        return this.gast && !this.gast.destroyed ? [this.gast] : [this.bank];
      case 'morgen':
        return [this.bank];
      default:
        return [this.pumpe];
    }
  }

  /** Von der Szene in exit() gerufen: die geteilten Filter freigeben. */
  aufraeumen() {
    this.bauplan?.destroy();
    this.bauplan = null;
    for (const f of this.filterListe?.values() || []) f.destroy();
    this.filterListe?.clear();
  }
}
