// Seite 3: Der Obstbaum – vom Baum bis in den Becher.
// Ablauf einer Runde:
//   1. Schütteln: Tipp auf den Baum → er raschelt, Blätter rieseln, 1–2 Früchte plumpsen ins Gras (eine Frucht direkt
//      antippen lässt sie auch fallen). Jede Runde hängen etwas andere Mengen Äpfel und Birnen am Baum.
//   2. Sortieren: Frucht in den passenden Korb ziehen (roter Korb = Äpfel, gelber Korb = Birnen); falscher Korb →
//      hüpft freundlich zurück. Manchmal schaut ein kleiner Wurm aus einem Apfel.
//   3. Einfüllen: Ist alles einsortiert, kommen ein oder zwei Gäste (Igel, Maus, Eichhörnchen, Hase, Ente, Fuchs –
//      hinter den Körben entlang), dann steht eine Saftpresse unter dem Baum. Korb antippen → die Früchte hüpfen
//      nacheinander in die Presse (immer nur ein Korb zugleich).
//   4. Kurbeln: Das Kurbelrad im Kreis drehen (wischen, ziehen – jede Bewegung dreht; ein Tipp dreht ein Stück) →
//      Saft läuft in den Becher, ein voller Becher macht dem nächsten Platz.
//   5. Ausschenken: vollen Becher zu einem Gast ziehen (oder antippen) → er trinkt und freut sich.
//   6. Alle haben getrunken: Sticker (Maus bzw. Igel), eine Saftflasche kommt auf die Bank am Zaun (die Reihe füllt sich
//      über die Runden und bleibt gespeichert), die Gäste gehen, die Presse verschwindet, neue Früchte wachsen.
// Schnelles Mehrfach-Tippen auf den Baum lässt nicht mehr Früchte fallen, nur die Blätter rascheln.

import {
  tap, drag, sfx, voice, note, fx, Actor, spr, meta, store, rand, pick, clamp, lerp, killTweensOf, PIXI,
} from '../../engine/index.js';
import { Seite } from '../../gemeinsam/seiten.js';
import { belohne, gesammelt } from '../../gemeinsam/sticker.js';
import { umhängen, bogen, gleitDauer, Vogel, Flieger, wolken, wähleAnders } from './helfer.js';
import { bauKorb } from './korb.js';

const FRUCHT_HÖHE = 160;       // Darstellungshöhe einer Frucht am Baum
const IM_KORB = 0.62;          // Größe im Korb (Anteil)
const ANKER_Y = 0.08;          // Früchte hängen am Stiel
const FALL_G = 1600;           // „Schwerkraft" beim Fallen (Einheiten/s²): ruhiger als echt
const SCHÜTTEL_PAUSE = 1.4;    // so lange nach einem Schütteln fallen keine weiteren Früchte (Ruhe)
const MAUS_SKALA = 0.2;
// Oberkante des vorderen Korbrands (Bildpunkte der Korb-Bilder 500 × 399)
const KORB_RAND = [[0, 112], [60, 150], [140, 178], [250, 190], [360, 178], [440, 150], [500, 112]];
// Plätze im Korb (Bildpunkte): Mitte der Frucht
const KORB_PLÄTZE = [[170, 118], [330, 118], [250, 104], [205, 88], [295, 88], [250, 76]];
// Landeplätze im Gras (Unterkante der Frucht): hintere Reihe neben dem Stamm, vordere Reihe davor
const LANDEPLÄTZE = [
  [-480, 1330], [-240, 1335], [240, 1335], [480, 1330],
  [-360, 1460], [-120, 1465], [120, 1465], [360, 1460],
];
// Wie viele Äpfel (von acht) hängen am Baum? Jede Runde etwas anders (nie zweimal gleich hintereinander)
const APFEL_ANZAHL = [3, 4, 5, 6];

// Saft
const PRESSE = { x: 0, y: 1440, skala: 0.62 };
const BECHER_SKALA = 0.55;
const UNTER_TÜLLE = { x: 3, y: 1524 };         // Becher unter dem Auslauf (Fuß des Bechers)
const BECHER_WARTEN = { x: 222, y: 1530 };     // nächster leerer Becher
const BECHER_FERTIG = [{ x: -222, y: 1530 }, { x: 222, y: 1530 }];   // volle Becher
const DREH_JE_BECHER = Math.PI * 2 * 1.25;     // so viel Kurbeln füllt einen Becher
const SAFT_APFEL = 0xf0b43c;
const SAFT_BIRNE = 0xe7dc6a;
// Gäste: Tier, Größe; Plätze links und rechts neben der Presse
const GÄSTE = {
  igel: 0.3, maus: 0.22, eichhoernchen: 0.28, hase: 0.3, ente: 0.27, fuchs: 0.3,
};
const GAST_PLÄTZE = [{ x: -400, y: 1430, von: -1500 }, { x: 400, y: 1430, von: 1500 }];
const HINTEN_Y = 1300;         // dort laufen die Gäste hinter den Körben entlang
const HINTER_KORB_Z = 55;      // … und liegen dabei hinter den Körben (z 60)
// Saftflaschen-Bank: vor dem Zaun rechts vom Stamm
const FLASCHEN_KEY = 'garten.saftflaschen';
const FLASCHEN = 6;
const FLASCHE = { x: 300, y: 1122, abstand: 62, höhe: 104 };

// Abstand eines Punkts (Seiten-Koordinaten) zur Mitte einer Frucht (der Anker sitzt am Stiel), ohne neue Objekte
function abstandZurMitte(f, x, y) {
  const sp = f.sp;
  const d = (0.5 - ANKER_Y) * sp.texture.height * sp.scale.y;
  const mx = sp.x - Math.sin(sp.rotation) * d;
  const my = sp.y + Math.cos(sp.rotation) * d;
  return Math.hypot(x - mx, y - my);
}

// Bildpunkt eines Sprites (pack-Punkt) relativ zum Anker, in Einheiten bei Skala s
function punktVon(id, name, s) {
  const m = meta(id);
  const p = m.pts?.[name] || [m.w / 2, m.h / 2];
  return { x: (p[0] - m.ax * m.w) * s, y: (p[1] - m.ay * m.h) * s };
}

export class Obst extends Seite {
  static hg = 'garten/hg_obst';

  aufbau() {
    this.runde = 'sammeln';   // 'sammeln' | 'saft' | 'nachwachsen'
    this.apfelZahl = 4;

    // Körbe an den Punkten korb_l / korb_r
    const kl = this.punkt('korb_l', { x: -714, y: 1400 });
    const kr = this.punkt('korb_r', { x: 706, y: 1400 });
    this.korbRot = bauKorb(this, 'garten/korb_rot', { x: kl.x, y: kl.y, scale: 0.62, z: 60, rand: KORB_RAND });
    this.korbGelb = bauKorb(this, 'garten/korb_gelb', { x: kr.x, y: kr.y, scale: 0.62, z: 60, rand: KORB_RAND });
    this.korbRot.art = 'apfel';
    this.korbGelb.art = 'birne';
    // Ein Tipp auf einen vollen Korb schüttet ihn in die Saftpresse (der Korb selbst wackelt wie bisher)
    for (const k of [this.korbRot, this.korbGelb]) {
      tap(k.c, () => {
        // sitzt der Schmetterling auf diesem Korb, fliegt er auf
        if (this.falter?.ding === k) this.falter.aufflattern();
        const s = this.saft;
        if (this.runde === 'saft' && s?.phase === 'füllen') this.korbAusleeren(k);
        // die Gäste kommen noch: der Korb merkt sich den Tipp und leert sich, sobald die Presse steht
        else if (this.runde === 'saft' && s?.phase === 'kommen' && k.liste.length && !s.leerSchlange.includes(k)) {
          s.leerSchlange.push(k);
        }
      }, { sound: null, squash: false });
    }

    this.baueBaum();
    this.früchte = [];
    this.plan = this.neuerPlan();
    for (let i = 0; i < 8; i++) this.früchte.push(this.neueFrucht(i, false));

    // Die Maus wohnt rechts neben dem gelben Korb (Birnen-Korb) – klein, antippbar
    this.mausHeim = { x: this.korbGelb.c.x + 255, y: kr.y };
    this.maus = new Actor('maus', {
      x: this.mausHeim.x, y: this.mausHeim.y, scale: MAUS_SKALA, flip: true, parent: this.welt, z: 70,
    });
    this.mausBeschäftigt = false;
    this.maus.onTap(() => {
      if (this.mausBeschäftigt) this.maus.sound();
      else this.maus.cheer({ parent: this.vorn });
    }, { pad: 70 });
    this.uhr = 0;
    this.schüttelBis = 0;
    this.raschelBis = 0;
    this.obstRunden = 0;
    this.letzteGäste = '';
    this.gäste = [];

    // kleine Nebensachen: ein Vogel auf dem linken Ast, ein Schmetterling, ziehende Wolken
    this.vogel = new Vogel(this, {
      x: -420, y: 835, bereich: [-470, -360], scale: 0.7, z: 20, farbe: 0xf0a85a, dunkel: 0xd48434, bauch: 0xfff3dd,
    });
    this.falter = new Flieger(this, 'garten/schmetterling_rosa', {
      x: 600, y: 900, maß: 110, tempo: 80, z: 400,
      wähleZiel: () => {
        if (Math.random() < 0.4) {
          const k = pick([this.korbRot, this.korbGelb]);
          const o = k.öffnung(250, 10);
          return { x: o.x + rand(-60, 60), y: o.y - 20, sitzen: true, dauer: rand(3, 5), ding: k };
        }
        return { x: rand(-950, 950), y: rand(250, 1000), sitzen: false };
      },
    });
    // Wolken nur im freien Himmel links und rechts der Krone (die Krone ist Teil des Hintergrundbilds und steht
    // vorn – eine Wolke davor sähe falsch aus); sie pendeln dort ganz langsam hin und her
    this.wolken = wolken(this.hinten, [
      { id: 'common/wolke3', x: -1000, y: 345, breite: 200, tempo: 5, bereich: [-1270, -790] },
      { id: 'common/wolke1', x: 950, y: 330, breite: 260, tempo: 4, bereich: [760, 1290] },
    ]);

    // Saftflaschen-Bank (gespeichert): eine kleine Holzbank vor dem Zaun, auf die nach jeder Saft-Runde eine Flasche
    // kommt. Sie erscheint erst mit der ersten Flasche (vorher wäre sie nur ein Strich im Gras).
    this.baueBank();
    this.flaschen = [];
    const n = clamp(Number(store.get(FLASCHEN_KEY, 0)) || 0, 0, FLASCHEN);
    for (let i = 0; i < n; i++) this.setzeFlasche(i, false);
    this.bank.visible = n > 0;
  }

  baueBank() {
    const x0 = FLASCHE.x - 46;
    const breite = (FLASCHEN - 1) * FLASCHE.abstand + 92;
    const y = FLASCHE.y;
    const g = new PIXI.Graphics();
    // weicher Schatten im Gras
    g.ellipse(x0 + breite / 2, y + 52, breite / 2 + 10, 12).fill({ color: 0x2d4a14, alpha: 0.18 });
    // zwei runde Beine
    for (const bx of [x0 + 34, x0 + breite - 34]) {
      g.roundRect(bx - 10, y + 6, 20, 46, 8).fill(0x9a6a3a);
      g.roundRect(bx - 6, y + 10, 5, 36, 3).fill({ color: 0xffffff, alpha: 0.12 });
    }
    // Sitzbrett mit hellerer Oberkante (Licht von oben links)
    g.roundRect(x0, y - 6, breite, 22, 9).fill(0xb7834c);
    g.roundRect(x0 + 6, y - 5, breite - 12, 6, 3).fill({ color: 0xffe2b8, alpha: 0.35 });
    g.roundRect(x0 + 4, y + 11, breite - 8, 5, 2).fill({ color: 0x7a5230, alpha: 0.5 });
    const c = new PIXI.Container({ label: 'saftbank' });
    c.addChild(g);
    c.zIndex = 24;
    // Antippen: die Bank wackelt, die Flaschen klingen leise mit
    c.hitArea = new PIXI.Rectangle(x0 - 10, y - 110, breite + 20, 220);
    tap(c, () => {
      fx.wobble(c, 0.02);
      this.flaschen.forEach((f, i) => this.after(i * 0.12, () => fx.wobble(f, 0.05)));
    }, { sound: 'common/klack', squash: false });
    c.pivot.set(x0 + breite / 2, y + 52);
    c.position.set(x0 + breite / 2, y + 52);
    this.welt.addChild(c);
    this.bank = c;
  }

  betreten() {
    // „Tipp den Baum an. Leg das Obst in den passenden Korb." kurz nach dem Hereingleiten anbieten (der Kern sagt
    // ihn höchstens einmal am Tag) – nur, wenn das Kind auf dieser Seite noch nicht geschüttelt, keine Frucht
    // angetippt oder gezogen hat und die Seite noch zu sehen ist
    this.obstHier = false;
    this._hinweis?.kill();
    const passt = () => this.aktiv && !this.obstHier && this.runde === 'sammeln';
    this._hinweis = this.after(2.5, () => { if (passt()) voice('garten_obst', { nurWenn: passt }); });
  }

  verlassen() {
    this._hinweis?.kill();
    this._hinweis = null;
  }

  // Wie viele Äpfel und Birnen diesmal? Gemischt verteilt auf die acht Plätze
  neuerPlan() {
    this.apfelZahl = wähleAnders(APFEL_ANZAHL, this.apfelZahl);
    const plan = [];
    for (let i = 0; i < 8; i++) plan.push(i < this.apfelZahl ? 'apfel' : 'birne');
    return plan.sort(() => Math.random() - 0.5);
  }

  // ---------------------------------------------------------------- Baum

  baueBaum() {
    const stamm = this.punkt('stamm', { x: -14, y: 1100 });
    this.stammPunkt = stamm;
    // Krone (Ellipse) und Stamm als Tippfläche – das Bild des Baums ist Teil des Hintergrunds
    const krone = { x: -20, y: 470, rx: 720, ry: 400 };
    this.krone = krone;
    const baum = new PIXI.Container({ label: 'baum' });
    baum.zIndex = 1;
    baum.hitArea = {
      contains: (x, y) => {
        const dx = (x - krone.x) / krone.rx;
        const dy = (y - krone.y) / krone.ry;
        if (dx * dx + dy * dy <= 1) return true;
        return Math.abs(x - stamm.x) < 190 && y > 820 && y < 1330;
      },
    };
    this.welt.addChild(baum);
    this.baum = baum;
    tap(baum, () => this.schüttle(), { sound: null, squash: false });
  }

  schüttle() {
    this.obstHier = true;
    const hängen = this.früchte.filter((f) => f.zustand === 'hängt');
    if (this.uhr < this.schüttelBis || !hängen.length) {
      // gerade erst geschüttelt (oder nichts mehr dran): nur leise rascheln (entprellt), die Früchte schaukeln
      if (this.uhr >= this.raschelBis) {
        sfx('common/rascheln', { vol: 0.3 });
        this.raschelBis = this.uhr + 0.6;
      }
      for (const f of hängen) f.schwung = Math.min(0.28, Math.max(f.schwung, 0.12) + 0.05);
      return;
    }
    // nach längerer Ruhe dürfen auch einmal zwei Früchte fallen, bei raschem Weiterschütteln nur eine
    const ausgeruht = this.uhr - (this.letztesSchütteln ?? -99) > 4;
    this.letztesSchütteln = this.uhr;
    this.schüttelBis = this.uhr + SCHÜTTEL_PAUSE;
    this.raschelBis = this.uhr + 0.6;
    sfx('common/rascheln', { vol: 0.7 });
    // ein paar Blätter rieseln aus der Krone
    const k = this.krone;
    this.burst('blaetter', k.x + rand(-420, 420), k.y + rand(-120, 200), { count: 4 });
    for (const f of hängen) f.schwung = Math.max(f.schwung, 0.2);
    // 1–2 Früchte fallen
    const anzahl = Math.min(hängen.length, ausgeruht && Math.random() < 0.5 ? 2 : 1);
    const wahl = [...hängen].sort(() => Math.random() - 0.5).slice(0, anzahl);
    wahl.forEach((f, i) => this.after(0.3 + i * 0.45, () => this.fallen(f)));
  }

  // ---------------------------------------------------------------- Früchte

  neueFrucht(i, weich) {
    const art = this.plan[i];
    const id = art === 'apfel' ? 'garten/apfel_rot' : 'garten/birne_gelb';
    const ersatz = [[-514, 560], [-264, 340], [6, 240], [266, 340], [516, 560], [-314, 720], [6, 500], [336, 720]][i];
    const p = this.punkt('frucht' + (i + 1), { x: ersatz[0], y: ersatz[1] });
    const sp = spr(id, { parent: this.welt, anchor: [0.5, ANKER_Y], z: 30 });
    const s = FRUCHT_HÖHE / sp.texture.height;
    // Punkt = Mitte der Frucht; der Anker sitzt am Stiel
    const am = { x: p.x, y: p.y - FRUCHT_HÖHE * (0.5 - ANKER_Y) };
    sp.position.set(am.x, am.y);
    sp.scale.set(weich ? 0 : s);
    const f = { i, art, sp, s, am, zustand: 'hängt', schwung: 0, phase: rand(0, 6), tap: null, zug: null, wurm: null };
    // Tippfläche (lokal): 250 × 270 Einheiten um die Mitte der Frucht – gilt auch beim Ziehen. Liegen Früchte
    // dicht beieinander, überlappen sich die Flächen: dann gewinnt die, deren Mitte dem Finger am nächsten ist.
    const th = sp.texture.height;
    const rechteck = new PIXI.Rectangle(-125 / s, (0.5 - ANKER_Y) * th - 135 / s, 250 / s, 270 / s);
    sp.hitArea = {
      contains: (lx, ly) => {
        if (!rechteck.contains(lx, ly)) return false;
        if (f.zustand !== 'liegt' || sp.parent !== this.welt) return true;
        const sc = sp.scale.y;
        const cs = Math.cos(sp.rotation);
        const sn = Math.sin(sp.rotation);
        const wx = sp.x + (lx * cs - ly * sn) * sc;
        const wy = sp.y + (lx * sn + ly * cs) * sc;
        const eigen = abstandZurMitte(f, wx, wy);
        for (const o of this.früchte) {
          if (o !== f && o.zustand === 'liegt' && o.sp && o.sp.parent === this.welt &&
            abstandZurMitte(o, wx, wy) < eigen) return false;
        }
        return true;
      },
    };
    f.tap = tap(sp, () => { this.obstHier = true; this.fallen(f); }, { sound: null, squash: false });
    if (weich) {
      f.zustand = 'wächst';
      this.tween(sp, { scale: s }, 1.4, { ease: 'backOut' }).then(() => { f.zustand = 'hängt'; });
    }
    return f;
  }

  async fallen(f) {
    if (f.zustand !== 'hängt') return;
    f.zustand = 'fällt';
    f.tap?.off();
    f.tap = null;
    f.schwung = 0;
    killTweensOf(f.sp);
    f.sp.scale.set(f.s);
    sfx('common/wusch', { vol: 0.3 });
    // Landeplatz im Gras: der freie Platz, der der Frucht am nächsten liegt (nie auf einer anderen Frucht,
    // nie in einem Korb – so bleibt jede Frucht einzeln gut greifbar)
    const belegt = new Set(this.früchte.filter((o) => o !== f && o.platz !== undefined &&
      (o.zustand === 'liegt' || o.zustand === 'fällt')).map((o) => o.platz));
    let platz = 0;
    let bester = Infinity;
    LANDEPLÄTZE.forEach(([px, py], i) => {
      if (belegt.has(i)) return;
      const d = Math.abs(px - f.sp.x) + Math.abs(py - 1300) * 0.3 + rand(0, 60);
      if (d < bester) { bester = d; platz = i; }
    });
    f.platz = platz;
    const x = LANDEPLÄTZE[platz][0] + rand(-12, 12);
    const y = LANDEPLÄTZE[platz][1] + rand(-8, 8);
    const h = FRUCHT_HÖHE;
    const liegtY = y - h * (1 - ANKER_Y);   // Unterkante der Frucht auf dem Boden
    f.ziel = { x, y: liegtY };
    f.sp.zIndex = 65 + Math.round((y - 1280) / 10);
    const dreh = pick([-1, 1]) * rand(0.15, 0.35);
    // fallen (schneller werdend), dann kleiner Hopser. Die Fallzeit folgt der Höhe wie bei einem sanften
    // Fall (Beschleunigung FALL_G): oben hängende Früchte fallen länger und kommen unten höchstens mit etwa
    // 2000 Einheiten/s an.
    const fall = { p: 0 };
    const x0 = f.sp.x;
    const y0 = f.sp.y;
    const fallZeit = clamp(Math.sqrt((2 * Math.hypot(x - x0, liegtY - y0)) / FALL_G), 0.6, 1.3);
    await this.tween(fall, { p: 1 }, fallZeit, {
      ease: 'quadIn',
      onUpdate: () => {
        f.sp.x = x0 + (x - x0) * fall.p;
        f.sp.y = y0 + (liegtY - y0) * fall.p;
        f.sp.rotation = dreh * fall.p;
      },
    });
    sfx('common/landen', { vol: 0.6 });
    this.burst('staub', x, y - 10, { count: 2 });
    await this.tween(f.sp, { y: liegtY - 36 }, 0.16, { ease: 'quadOut' });
    await this.tween(f.sp, { y: liegtY }, 0.32, { ease: 'bounceOut' });
    f.zustand = 'liegt';
    // Kleine Überraschung: aus manchem Apfel schaut ein Würmchen
    if (f.art === 'apfel' && !this.früchte.some((o) => o.wurm) && Math.random() < 0.3) this.wurmImApfel(f);
    f.zug = drag(f.sp, {
      targets: () => this.korbZiele(),
      lift: 1.15,
      pad: 55,
      back: false,   // ohne Treffer gleitet sie zu ihrem Platz im Gras (nicht dorthin, wo sie gegriffen wurde)
      // Neu gegriffen (auch mitten im Zurückhüpfen): jede eigene Bewegung der Frucht endet sofort,
      // damit sie dem Finger folgt
      onStart: () => { this.halteAn(f); if (f.wurm) this.wurmWackelt(f); },
      onDrop: (ziel, ctx) => this.abgelegt(f, ziel, ctx),
    });
  }

  // Ein kleiner Wurm schaut oben aus dem Apfel (Kind des Apfels: wackelt und fliegt mit)
  wurmImApfel(f) {
    const w = spr('garten/regenwurm', { anchor: [0.2, 0.9], parent: f.sp });
    const th = f.sp.texture.height;
    const ws = 62 / w.texture.width / f.s;
    w.scale.set(ws, ws * 0.05);
    w.position.set(25, th * 0.32);
    w.eventMode = 'none';
    f.wurm = { w, ws };
    this.after(0.4, () => {
      if (w.destroyed) return;
      note('pling', 91, { vol: 0.22 });
      this.tween(w.scale, { y: ws }, 0.8, { ease: 'backOut' });
    });
  }

  wurmWackelt(f) {
    const w = f.wurm?.w;
    if (!w || w.destroyed) return;
    note('pling', pick([91, 95]), { vol: 0.25 });
    killTweensOf(w, ['rotation']);
    this.tween(w, { rotation: 0.3 }, 0.15, { ease: 'sineInOut', yoyo: true, repeat: 2 })
      .then(() => { if (!w.destroyed) w.rotation = 0; });
  }

  // Wurm verabschiedet sich, bevor der Apfel im Korb verschwindet
  wurmWeg(f) {
    const wm = f.wurm;
    if (!wm) return;
    f.wurm = null;
    const w = wm.w;
    if (w.destroyed) return;
    note('pling', 95, { vol: 0.22 });
    this.tween(w, { alpha: 0 }, 0.35, { ease: 'sineInOut' }).then(() => { if (!w.destroyed) w.destroy(); });
  }

  korbZiele() {
    return [this.korbRot, this.korbGelb].map((k) => {
      const o = k.öffnung(250, 120);
      return { korb: k, id: k.art, x: o.x, y: o.y, radius: 250 };
    });
  }

  // Alle eigenen Bewegungen einer Frucht beenden (der Bogen läuft über einen Hilfs-Tween, den der Kern beim
  // Greifen nicht kennt; die Marke lässt eine schon laufende Hüpf-Kette nicht weitermachen)
  halteAn(f) {
    this.obstHier = true;   // auch beim Greifen einer Frucht (onStart) – das Kind ist schon beim Einsortieren
    f.marke = (f.marke || 0) + 1;
    f.rück?.stop();
    f.rück = null;
    killTweensOf(f.sp, ['x', 'y']);
  }

  abgelegt(f, ziel, ctx) {
    if (f.zustand !== 'liegt') return;
    if (ziel && ziel.id === f.art) {
      this.einsortieren(f, ziel.korb);
      return;
    }
    const heim = f.ziel;
    if (!ziel) {
      // daneben: weich zurück an ihren Platz im Gras
      this.halteAn(f);
      // weg-abhängig (von weit oben dauert es länger, damit sie nicht zurückschießt)
      this.tween(f.sp, { x: heim.x, y: heim.y }, gleitDauer(heim.x - f.sp.x, heim.y - f.sp.y, 0.45, 3),
        { ease: 'cubicOut' });
      return;
    }
    void ctx;
    // falscher Korb: freundliches „Nö", der Korb wackelt, die Frucht hüpft zurück an ihren Platz
    if (this.uhr >= (this.neinBis || 0)) {
      sfx('common/nein', { vol: 0.8 });
      this.neinBis = this.uhr + 0.7;
    }
    fx.wobble(ziel.korb.c, 0.06);
    this.zurückHüpfen(f, heim.x, heim.y);
  }

  async zurückHüpfen(f, x, y) {
    this.halteAn(f);
    const marke = f.marke;
    const gilt = () => !f.sp.destroyed && f.marke === marke && f.zustand === 'liegt';
    const rück = bogen(this, f.sp, x, y, { dauer: 0.65, höhe: 170 });
    f.rück = rück;
    const ok = await rück;
    if (f.rück === rück) f.rück = null;
    if (!ok || !gilt()) return;
    if (!(await this.tween(f.sp, { y: y - 26 }, 0.14, { ease: 'quadOut' })) || !gilt()) return;
    await this.tween(f.sp, { y }, 0.3, { ease: 'bounceOut' });
  }

  async einsortieren(f, korb) {
    this.halteAn(f);
    f.zustand = 'korb';
    f.zug?.off();
    f.zug = null;
    f.sp.eventMode = 'none';
    this.wurmWeg(f);
    const n = korb.liste.length;
    korb.liste.push(f.sp);
    f.sp.art = f.art;
    const [px, py] = KORB_PLÄTZE[n % KORB_PLÄTZE.length];
    const ziel = korb.lokal(px, py);
    const s = f.s * IM_KORB;
    // Anker sitzt am Stiel: Mitte der Frucht liegt (0.5 − ANKER_Y) · Höhe darunter
    const versatz = FRUCHT_HÖHE * IM_KORB * (0.5 - ANKER_Y);
    const über = korb.öffnung(px, py - 150);
    killTweensOf(f.sp, ['x', 'y', 'rotation']);
    await bogen(this, f.sp, über.x, über.y - versatz, { dauer: 0.35, höhe: 40, skala: s, dreh: rand(-0.2, 0.2) - f.sp.rotation });
    if (f.sp.destroyed) return;
    umhängen(f.sp, korb.inhalt);
    f.sp.zIndex = n;
    await this.tween(f.sp, { x: ziel.x, y: ziel.y - versatz }, 0.22, { ease: 'quadIn' });
    f.sp.ruheY = ziel.y - versatz;
    sfx('common/plopp', { vol: 0.75 });
    fx.pop(korb.c, 0.06);
    note('xylo', korb.art === 'apfel' ? 72 + 2 * korb.liste.length : 79 + 2 * korb.liste.length, { vol: 0.3 });
    if (this.runde === 'sammeln' && this.früchte.every((x) => x.zustand === 'korb')) this.saftRunde();
  }

  // ---------------------------------------------------------------- Saft: Presse, Gäste, Becher

  // Wer kommt diesmal? Ein oder zwei Gäste, immer mit Maus oder Igel (ihre Sticker); solange der Maus-Sticker
  // fehlt, ist die Maus dabei. Nie zweimal dieselbe Runde hintereinander.
  wähleGäste() {
    const mausFehlt = !gesammelt().includes('tier_maus');
    let liste;
    for (let v = 0; v < 8; v++) {
      const haupt = mausFehlt ? 'maus' : wähleAnders(['maus', 'igel'], this.letzterHaupt);
      const anzahl = Math.random() < 0.7 ? 2 : 1;
      liste = [haupt];
      if (anzahl === 2) liste.push(pick(Object.keys(GÄSTE).filter((t) => t !== haupt)));
      if (Math.random() < 0.5) liste.reverse();
      if (liste.join() !== this.letzteGäste) break;
    }
    this.letzteGäste = liste.join();
    this.letzterHaupt = liste.includes('maus') ? (liste.includes('igel') ? pick(['maus', 'igel']) : 'maus') : 'igel';
    return liste;
  }

  // Ruhig nacheinander (Ruhe-Regel: höchstens zwei auffällige Bewegungen): erst kommen die Gäste – hinter den
  // Körben entlang, so verdecken sie nichts –, dann erscheint die Presse, dann die Becher, erst dann sind die Körbe dran.
  async saftRunde() {
    this.runde = 'saft';
    this.obstRunden++;
    const s = {
      phase: 'kommen', presse: null, rad: null, becher: [], gefüllt: 0, dreh: 0, letzterWinkel: null,
      äpfel: 0, birnen: 0, farbe: SAFT_APFEL, strahl: null, fließt: 0, tonTakt: 0, klackTakt: 0, leerSchlange: [],
    };
    this.saft = s;
    await this.wait(0.8);
    const tiere = this.wähleGäste();
    // Die Maus wohnt rechts: sie nimmt immer den rechten Platz (kurzer Weg), ein anderer Gast den linken
    const platzVon = (tier, i) => {
      if (tier === 'maus') return GAST_PLÄTZE[1];
      if (tiere.includes('maus')) return GAST_PLÄTZE[0];
      return GAST_PLÄTZE[tiere.length === 1 ? 0 : i];
    };
    this.gäste = tiere.map((tier, i) => this.gastKommt(tier, platzVon(tier, i)));
    // warten, bis alle stehen (höchstens 9 s – ein Gast, den das Kind beim Laufen gegriffen hat, steht dann eben)
    for (let i = 0; i < 90 && !this.gäste.every((g) => g.da); i++) await this.wait(0.1);
    for (const g of this.gäste) g.da = true;
    await this.wait(0.3);
    this.bauePresse(s);
    await this.wait(0.8);
    // je Gast ein Becher: der erste steht unter dem Auslauf, der zweite wartet daneben
    s.becher = tiere.map((_, i) => this.baueBecher(i));
    await this.wait(0.5 + 0.2 * tiere.length);
    s.phase = 'füllen';
    // wurde ein Korb schon angetippt, während die Gäste kamen, ist er jetzt gleich dran
    const gemerkt = s.leerSchlange.shift();
    if (gemerkt) this.korbAusleeren(gemerkt);
    else if (this.aktiv) fx.pulse(this.korbRot.liste.length ? this.korbRot.c : this.korbGelb.c);
  }

  bauePresse(s) {
    const id = 'garten/saftpresse_koerper';
    const c = new PIXI.Container({ label: 'saftpresse' });
    c.position.set(PRESSE.x, PRESSE.y);
    c.zIndex = 1440;
    c.sortableChildren = true;
    const k = spr(id, { parent: c, z: 1 });
    k.scale.set(PRESSE.skala);
    const radPunkt = punktVon(id, 'rad', PRESSE.skala);
    const rad = spr('garten/saftpresse_rad', { anchor: 0.5, parent: c, x: radPunkt.x, y: radPunkt.y, z: 2 });
    const rm = meta('garten/saftpresse_rad');
    rad.scale.set(PRESSE.skala * (rm.radSkala || 1));
    // weicher Schatten
    const schatten = new PIXI.Graphics().ellipse(0, 0, 150, 24).fill({ color: 0x2d4a14, alpha: 0.2 });
    schatten.zIndex = 0;
    c.addChild(schatten);
    this.welt.addChild(c);
    s.presse = c;
    s.rad = rad;
    s.tülle = punktVon(id, 'tuelle', PRESSE.skala);
    s.oben = punktVon(id, 'oben', PRESSE.skala);
    s.radPunkt = { x: PRESSE.x + radPunkt.x, y: PRESSE.y + radPunkt.y };
    c.alpha = 0;
    c.scale.set(0.7);
    sfx('common/klack', { vol: 0.5 });
    this.tween(c, { alpha: 1 }, 0.5, { ease: 'sineInOut' });
    this.tween(c, { scale: 1 }, 0.7, { ease: 'backOut' });
    // Antippen der Presse: Hinweis auf den nächsten Schritt
    c.hitArea = new PIXI.Rectangle(-170, -390, 340, 400);
    tap(c, () => {
      fx.wobble(c, 0.03);
      if (s.phase === 'füllen') { fx.pulse(this.korbRot.liste.length ? this.korbRot.c : this.korbGelb.c); }
      else if (s.phase === 'kurbeln') this.dreheKurbel(0.6);
    }, { sound: 'common/klack', squash: false });

    // Kurbel: eine unsichtbare Fläche um die Nabe folgt dem Finger, der Drehwinkel um die Nabe dreht das Rad
    const fläche = new PIXI.Container({ label: 'kurbel' });
    fläche.position.set(s.radPunkt.x, s.radPunkt.y);
    fläche.zIndex = 1500;
    fläche.hitArea = new PIXI.Circle(0, 0, 175);
    fläche.eventMode = 'static';
    this.welt.addChild(fläche);
    s.fläche = fläche;
    // Vor drag() angemeldet: setzt die Fläche genau unter den Finger, so folgt sie ihm ohne Versatz
    fläche.on('pointerdown', (e) => {
      const p = this.welt.toLocal(e.global);
      fläche.position.set(p.x, p.y);
      s.letzterWinkel = null;
    });
    s.kurbelZug = drag(fläche, {
      back: false,
      lift: 1,
      sound: null,
      onStart: () => { s.bewegt = 0; },
      onMove: () => {
        const dx = fläche.x - s.radPunkt.x;
        const dy = fläche.y - s.radPunkt.y;
        if (Math.hypot(dx, dy) < 25) return;
        const w = Math.atan2(dy, dx);
        if (s.letzterWinkel !== null) {
          let d = w - s.letzterWinkel;
          while (d > Math.PI) d -= 2 * Math.PI;
          while (d < -Math.PI) d += 2 * Math.PI;
          s.bewegt += Math.abs(d);
          this.dreheKurbel(d);
        }
        s.letzterWinkel = w;
      },
      onDrop: () => {
        // nur angetippt: das Rad dreht sich ein Stück von selbst (nichts kann schiefgehen)
        if (s.bewegt < 0.15) this.dreheKurbel(0.7, true);
        fläche.position.set(s.radPunkt.x, s.radPunkt.y);
        s.letzterWinkel = null;
      },
    });
  }

  // Früchte eines Korbs hüpfen nacheinander in die Presse. Immer nur ein Korb zugleich (Ruhe): Wird der zweite
  // angetippt, während der erste noch ausleert, wackelt er und ist danach von selbst dran.
  async korbAusleeren(korb) {
    const s = this.saft;
    if (!s || korb.leert || !korb.liste.length) return;
    if (s.leertGerade) {
      if (!s.leerSchlange.includes(korb)) s.leerSchlange.push(korb);
      return;
    }
    s.leertGerade = true;
    korb.leert = true;
    const oben = { x: PRESSE.x + s.oben.x, y: PRESSE.y + s.oben.y };
    while (korb.liste.length) {
      const sp = korb.liste.pop();
      if (sp.destroyed) continue;
      if (sp.art === 'apfel') s.äpfel++;
      else s.birnen++;
      umhängen(sp, this.welt);
      sp.zIndex = 1480;
      sp.rotation = 0;
      sfx('common/hupf', { vol: 0.35 });
      bogen(this, sp, oben.x + rand(-30, 30), oben.y - 30, { dauer: 0.55, höhe: 200 }).then(() => {
        if (sp.destroyed) return;
        sp.zIndex = 1430;   // hinter dem Fassrand verschwinden
        sfx('common/plopp', { vol: 0.5 });
        this.tween(sp, { y: sp.y + 50, alpha: 0 }, 0.3, { ease: 'quadIn' }).then(() => { if (!sp.destroyed) sp.destroy(); });
      });
      await this.wait(0.35);
    }
    korb.leert = false;
    // Saftfarbe aus der Mischung
    const anteil = s.äpfel / Math.max(1, s.äpfel + s.birnen);
    s.farbe = mischFarbe(SAFT_BIRNE, SAFT_APFEL, anteil);
    await this.wait(0.3);
    s.leertGerade = false;
    if (this.saft !== s) return;
    if (!this.korbRot.liste.length && !this.korbGelb.liste.length && s.phase === 'füllen') {
      await this.wait(0.3);
      this.zumKurbeln(s);
      return;
    }
    // wartet schon der andere Korb (angetippt, während dieser ausleerte), ist er jetzt dran
    const nächster = s.leerSchlange.shift();
    if (nächster) { this.korbAusleeren(nächster); return; }
    const anderer = korb === this.korbRot ? this.korbGelb : this.korbRot;
    if (anderer.liste.length) fx.pulse(anderer.c);
  }

  zumKurbeln(s) {
    s.phase = 'kurbeln';
    s.becher.forEach((b) => this.zeichneSaft(b));
    fx.pulse(s.rad);
    const kurbeln = () => this.aktiv && this.saft === s && s.phase === 'kurbeln' && s.dreh < 0.3;
    this.after(0.6, () => { if (kurbeln()) voice('garten_kurbel', { nurWenn: kurbeln }); });
  }

  // Das Rad dreht sich um d (Bogenmaß); das füllt den Becher unter dem Auslauf
  dreheKurbel(d, weich = false) {
    const s = this.saft;
    if (!s || !s.rad || s.rad.destroyed) return;
    if (weich) {
      this.tween(s.rad, { rotation: s.rad.rotation + d }, 0.6, { ease: 'sineInOut' });
    } else {
      s.rad.rotation += d;
    }
    if (s.phase !== 'kurbeln') return;
    const b = s.becher.find((x) => x.zustand === 'unten');
    if (!b) return;
    s.dreh += Math.abs(d);
    s.fließt = 0.35;
    // leises Klacken je halber Umdrehung (wie eine Ratsche)
    s.klackTakt += Math.abs(d);
    if (s.klackTakt > Math.PI) {
      s.klackTakt = 0;
      sfx('common/klack', { vol: 0.22 });
    }
    b.füllung = clamp(b.füllung + Math.abs(d) / DREH_JE_BECHER, 0, 1);
    this.zeichneSaft(b);
    if (b.füllung >= 1) this.becherVoll(b);
  }

  // ---------------------------------------------------------------- Becher

  baueBecher(i) {
    const c = new PIXI.Container({ label: 'becher' + i });
    c.sortableChildren = true;
    const bild = spr('garten/becher', { parent: c, z: 1 });
    bild.scale.set(BECHER_SKALA);
    const saft = new PIXI.Graphics();
    saft.zIndex = 2;
    c.addChild(saft);
    const ö = punktVon('garten/becher', 'oeffnung', BECHER_SKALA);
    const ort = i === 0 ? UNTER_TÜLLE : BECHER_WARTEN;
    c.position.set(ort.x, ort.y);
    c.zIndex = 1600 + i;
    this.welt.addChild(c);
    const b = { c, bild, saft, ö, füllung: 0, zustand: i === 0 ? 'unten' : 'wartet', zug: null, i };
    c.alpha = 0;
    this.tween(c, { alpha: 1 }, 0.4, { ease: 'sineInOut', delay: 0.3 + i * 0.2 });
    c.hitArea = new PIXI.Rectangle(-130, -200, 260, 230);
    // Ein Tipp auf einen Becher, der noch gefüllt wird: das Rad dreht ein Stück
    tap(c, () => {
      if (b.zustand === 'unten') { sfx('common/klack', { vol: 0.4 }); this.dreheKurbel(0.7, true); }
      else if (b.zustand === 'wartet') fx.wobble(c, 0.05);
    }, { sound: null, squash: false });
    return b;
  }

  zeichneSaft(b) {
    const g = b.saft;
    g.clear();
    const f = b.füllung;
    if (f <= 0.01) return;
    const s = this.saft;
    // Saftspiegel in der Öffnung: wächst mit der Füllung und steigt nach oben, mit dunklerem Rand (gut zu sehen)
    const k = 0.6 + 0.45 * f;
    const rx = 92 * BECHER_SKALA * k;
    const ry = 26 * BECHER_SKALA * k;
    const y = b.ö.y + (1 - f) * 20;
    const farbe = s?.farbe ?? SAFT_APFEL;
    const a = clamp(f * 3, 0, 1);
    g.ellipse(b.ö.x, y, rx, ry).fill({ color: farbe, alpha: a })
      .stroke({ width: 3, color: mischFarbe(farbe, 0x8a4a10, 0.45), alpha: 0.8 * a });
    g.ellipse(b.ö.x - rx * 0.3, y - ry * 0.3, rx * 0.35, ry * 0.3).fill({ color: 0xffffff, alpha: 0.3 * a });
  }

  // Ein Becher ist voll: er rückt zur Seite, der nächste leere kommt unter den Auslauf
  async becherVoll(b) {
    const s = this.saft;
    b.zustand = 'voll';
    sfx('common/funkeln', { vol: 0.4 });
    this.burst('funkeln', b.c.x, b.c.y - 120, { count: 3 });
    const fertig = s.becher.filter((x) => x.zustand === 'voll' || x.zustand === 'bereit').length - 1;
    const ziel = BECHER_FERTIG[fertig % BECHER_FERTIG.length];
    const nächster = s.becher.find((x) => x.zustand === 'wartet');
    if (nächster) {
      nächster.zustand = 'unten';
      bogen(this, nächster.c, UNTER_TÜLLE.x, UNTER_TÜLLE.y, { dauer: 0.6, höhe: 60 });
    }
    await bogen(this, b.c, ziel.x, ziel.y, { dauer: 0.6, höhe: 70 });
    if (b.c.destroyed) return;
    b.zustand = 'bereit';
    this.machGreifbar(b);
    if (!s.becher.some((x) => x.zustand === 'unten' || x.zustand === 'wartet')) {
      s.phase = 'ausschenken';
      const saft = () => this.aktiv && this.saft === s && s.becher.some((x) => x.zustand === 'bereit');
      this.after(0.5, () => { if (saft()) voice('garten_saft', { nurWenn: saft }); });
    }
  }

  machGreifbar(b) {
    b.zug = drag(b.c, {
      lift: 1.08,
      back: false,
      targets: () => this.gäste.filter((g) => g.da && !g.getrunken)
        .map((g) => ({ gast: g, ...(g.a.point('mouth') || { x: g.a.x, y: g.a.y - 150 }), radius: 300 })),
      onDrop: (ziel, ctx) => {
        let g = ziel?.gast;
        const kurz = Math.hypot(ctx.x - ctx.startX, ctx.y - ctx.startY) < 70;
        if (!g && kurz) {
          // nur angetippt: zum nächsten durstigen Gast
          const durstig = this.gäste.filter((x) => x.da && !x.getrunken && !x.bekommt);
          durstig.sort((p, q) => Math.abs(p.a.x - b.c.x) - Math.abs(q.a.x - b.c.x));
          g = durstig[0];
        }
        if (g && !g.getrunken && !g.bekommt) { this.trinken(b, g); return; }
        const heim = b.heim || { x: b.c.x, y: b.c.y };
        this.tween(b.c, { x: heim.x, y: heim.y }, gleitDauer(heim.x - b.c.x, heim.y - b.c.y, 0.4, 3), { ease: 'cubicOut' });
      },
    });
    b.heim = { x: b.c.x, y: b.c.y };
  }

  async trinken(b, g) {
    g.bekommt = true;
    b.zustand = 'weg';
    b.zug?.off();
    b.zug = null;
    b.c.eventMode = 'none';
    const a = g.a;
    killTweensOf(b.c);
    const maul = a.point('mouth') || { x: a.x, y: a.y - 150 };
    const seite = maul.x < a.x ? -1 : 1;
    await bogen(this, b.c, maul.x + seite * 40, maul.y + 70, { dauer: 0.5, höhe: 80 });
    if (b.c.destroyed || a.destroyed) return;
    a.pose('eat');
    await this.tween(b.c, { rotation: -seite * 0.5 }, 0.3, { ease: 'sineInOut' });
    for (let k = 0; k < 3; k++) {
      sfx('common/blubber', { vol: 0.35 });
      const p = { f: b.füllung };
      await this.tween(p, { f: Math.max(0, b.füllung - 0.34) }, 0.45, {
        ease: 'sineInOut', onUpdate: () => { b.füllung = p.f; this.zeichneSaft(b); },
      });
      if (b.c.destroyed) return;
    }
    b.füllung = 0;
    this.zeichneSaft(b);
    await this.tween(b.c, { rotation: 0 }, 0.25, { ease: 'sineInOut' });
    // leerer Becher kommt neben dem Gast ins Gras und blendet weich aus
    bogen(this, b.c, a.x - seite * 120, a.y + 40, { dauer: 0.45, höhe: 50 }).then(() => {
      if (!b.c.destroyed) this.tween(b.c, { alpha: 0 }, 0.8, { ease: 'sineInOut', delay: 0.6 }).then(() => { if (!b.c.destroyed) b.c.destroy({ children: true }); });
    });
    g.getrunken = true;
    await a.cheer({ parent: this.vorn });
    if (this.gäste.every((x) => x.getrunken)) this.saftGeschafft();
  }

  // ---------------------------------------------------------------- Gäste

  // Gäste laufen hinter den Körben entlang (weiter hinten im Gras, hinter dem Korb verdeckt) und kommen erst neben
  // der Presse nach vorn – so laufen sie nie über einen Korb, den das Kind gleich antippen soll.
  gastKommt(tier, platz) {
    const g = { tier, platz, a: null, da: false, getrunken: false, bekommt: false };
    if (tier === 'maus') {
      // die Maus wohnt hier: sie trippelt hinter dem gelben Korb herüber
      g.a = this.maus;
      this.mausBeschäftigt = true;
      const m = this.maus;
      (async () => {
        m.zIndex = HINTER_KORB_Z;
        if (!(await m.walkTo(this.korbGelb.c.x, HINTEN_Y, { tempo: 200 })) || m.destroyed) return;
        if (!(await m.walkTo(platz.x, HINTEN_Y + 10, { tempo: 220 })) || m.destroyed) return;
        m.zIndex = 1400;
        if (!(await m.walkTo(platz.x, platz.y, { tempo: 160 })) || m.destroyed) return;
        m.lookAt(PRESSE.x);
        g.da = true;
      })();
      return g;
    }
    const a = new Actor(tier, { x: platz.von, y: HINTEN_Y, scale: GÄSTE[tier], parent: this.welt, z: HINTER_KORB_Z });
    g.a = a;
    // erst wenn er steht, ist er antippbar
    (async () => {
      if (!(await a.walkTo(platz.x, HINTEN_Y, { tempo: 250 })) || a.destroyed) return;
      a.zIndex = 1400;
      if (!(await a.walkTo(platz.x, platz.y, { tempo: 170 })) || a.destroyed) return;
      a.lookAt(PRESSE.x);
      a.onTap(() => { fx.wobble(a, 0.05); a.sound(); });
      g.da = true;
    })();
    return g;
  }

  async saftGeschafft() {
    const s = this.saft;
    s.phase = 'fertig';
    await this.wait(0.6);
    // Sticker: Maus oder Igel (wer von beiden da war; solange der Maus-Sticker fehlt, die Maus)
    const tiere = this.gäste.map((g) => g.tier);
    const mausFehlt = !gesammelt().includes('tier_maus');
    const id = tiere.includes('maus') && (mausFehlt || !tiere.includes('igel') || Math.random() < 0.5) ? 'tier_maus' : 'tier_igel';
    // Sticker rechts neben der Krone im Himmel (kein „Turm" über einem Tier)
    await belohne(this, id, 885, 740);
    await this.wait(0.4);
    this.neueFlasche();
    await this.wait(1.6);
    // Gäste gehen, die Presse verschwindet, die Körbe sind leer, neue Früchte wachsen
    // (auch zurück hinter den Körben entlang)
    for (const g of this.gäste) {
      if (g.tier === 'maus') {
        const m = this.maus;
        (async () => {
          await m.walkTo(m.x, HINTEN_Y + 10, { tempo: 160 });
          if (m.destroyed) return;
          m.zIndex = HINTER_KORB_Z;
          await m.walkTo(this.korbGelb.c.x, HINTEN_Y, { tempo: 220 });
          if (m.destroyed) return;
          await m.walkTo(this.mausHeim.x, this.mausHeim.y, { tempo: 200 });
          if (m.destroyed) return;
          m.zIndex = 70;
          m.lookAt(this.mausHeim.x - 100);
          this.mausBeschäftigt = false;
        })();
      } else {
        const a = g.a;
        (async () => {
          await a.walkTo(a.x, HINTEN_Y, { tempo: 170 });
          if (a.destroyed) return;
          a.zIndex = HINTER_KORB_Z;
          await a.walkTo(g.platz.von, HINTEN_Y, { tempo: 250 });
          if (!a.destroyed) a.destroy({ children: true });
        })();
      }
    }
    const p = s.presse;
    this.tween(p, { alpha: 0, scale: 0.8 }, 0.8, { ease: 'sineInOut', delay: 0.6 })
      .then(() => { if (!p.destroyed) p.destroy({ children: true }); });
    s.kurbelZug?.off();
    if (!s.fläche.destroyed) s.fläche.destroy();
    for (const b of s.becher) {
      if (!b.c.destroyed && b.zustand !== 'weg') {
        this.tween(b.c, { alpha: 0 }, 0.6).then(() => { if (!b.c.destroyed) b.c.destroy({ children: true }); });
      }
    }
    await this.wait(1.6);
    this.gäste = [];
    this.saft = null;
    await this.nachwachsen();
  }

  // ---------------------------------------------------------------- Saftflaschen-Regal

  setzeFlasche(i, weich) {
    const f = spr('garten/saftflasche', { parent: this.welt, x: FLASCHE.x + i * FLASCHE.abstand, y: FLASCHE.y, z: 25 });
    const s = FLASCHE.höhe / (meta('garten/saftflasche').h || f.texture.height);
    f.scale.set(s);
    const hw = 100 / s;
    f.hitArea = new PIXI.Rectangle(-hw, -(FLASCHE.höhe + 70) / s, 2 * hw, (FLASCHE.höhe + 140) / s);
    tap(f, () => {
      fx.wobble(f, 0.08);
      note('glocke', [79, 81, 84, 86, 88, 91][i % 6], { vol: 0.3 });
    }, { sound: null, squash: false });
    if (weich) {
      f.scale.set(s * 0.2);
      f.alpha = 0;
      this.tween(f, { alpha: 1 }, 0.4, { ease: 'sineInOut' });
      this.tween(f, { scale: s }, 0.7, { ease: 'backOut' });
    }
    this.flaschen.push(f);
    return f;
  }

  async neueFlasche() {
    const n = this.flaschen.length;
    if (n < FLASCHEN) {
      if (!this.bank.visible) {
        // die Bank blendet zuerst weich ein
        this.bank.visible = true;
        this.bank.alpha = 0;
        await this.tween(this.bank, { alpha: 1 }, 0.6, { ease: 'sineInOut' });
      }
      const f = this.setzeFlasche(n, true);
      store.set(FLASCHEN_KEY, n + 1);
      sfx('common/plopp', { vol: 0.6 });
      this.after(0.4, () => this.burst('funkeln', f.x, f.y - 70, { count: 3 }));
    } else {
      // das Regal ist voll: die Flaschen klingen nacheinander
      this.flaschen.forEach((f, i) => this.after(i * 0.22, () => {
        fx.wobble(f, 0.06);
        note('glocke', [79, 81, 84, 86, 88, 91][i % 6], { vol: 0.2 });
      }));
    }
  }

  // Körbe sind leer, neue Früchte wachsen nacheinander, dann geht es von vorn los
  async nachwachsen() {
    this.runde = 'nachwachsen';
    for (const k of [this.korbRot, this.korbGelb]) {
      const weg = k.liste.splice(0);
      weg.forEach((sp, i) => this.tween(sp, { alpha: 0 }, 0.6, { ease: 'sineInOut', delay: i * 0.12 })
        .then(() => { if (!sp.destroyed) sp.destroy(); }));
    }
    await this.wait(0.6);
    sfx('common/wachsen', { vol: 0.7 });
    this.plan = this.neuerPlan();
    this.früchte = [];
    // Platzhalter, bis alle gewachsen sind (damit niemand „alles im Korb" meldet)
    for (let i = 0; i < 8; i++) this.früchte[i] = { zustand: 'wächst' };
    for (let i = 0; i < 8; i++) {
      this.after(i * 0.35, () => {
        this.früchte[i] = this.neueFrucht(i, true);
        note('glocke', [72, 74, 76, 79, 81, 84, 86, 88][i], { vol: 0.2 });
      });
    }
    await this.wait(8 * 0.35 + 1.5);
    this.runde = 'sammeln';
  }

  // ---------------------------------------------------------------- Ablauf

  update(dt, t) {
    this.uhr += dt;
    this.vogel.update(dt);
    this.falter.update(dt);
    this.wolken.update(dt);
    // hängende Früchte schaukeln leicht (nach dem Schütteln stärker, klingt aus)
    for (const f of this.früchte) {
      if (!f.sp || f.zustand !== 'hängt') continue;
      f.schwung *= Math.exp(-dt * 1.1);
      f.sp.rotation = f.schwung * Math.sin(t * 3.4 + f.phase) + 0.035 * Math.sin(t * 0.9 + f.phase);
    }
    // Saftstrahl aus dem Auslauf, solange gekurbelt wird
    const s = this.saft;
    if (s && s.presse && !s.presse.destroyed) {
      s.fließt = Math.max(0, s.fließt - dt);
      const b = s.becher.find((x) => x.zustand === 'unten');
      if (!s.strahl) {
        s.strahl = new PIXI.Graphics();
        s.strahl.zIndex = 1590;
        s.strahl.eventMode = 'none';
        this.welt.addChild(s.strahl);
      }
      const g = s.strahl;
      g.clear();
      if (s.fließt > 0 && b) {
        const x0 = PRESSE.x + s.tülle.x;
        const y0 = PRESSE.y + s.tülle.y + 8;
        const y1 = b.c.y + b.ö.y + 4;
        const breite = 9 + 2 * Math.sin(t * 9);
        g.roundRect(x0 - breite / 2, y0, breite, Math.max(4, y1 - y0), breite / 2).fill({ color: s.farbe, alpha: 0.9 });
        s.tonTakt -= dt;
        if (s.tonTakt <= 0) {
          sfx('common/giessen', { vol: 0.3 });
          s.tonTakt = 2.6;
        }
      }
    }
  }

  hinweise() {
    const liste = [];
    const s = this.saft;
    if (this.runde === 'saft' && s) {
      if (s.phase === 'füllen') {
        const k = this.korbRot.liste.length ? this.korbRot : this.korbGelb.liste.length ? this.korbGelb : null;
        if (k) liste.push(k.c);
      }
      if (s.phase === 'kurbeln' || s.phase === 'ausschenken') {
        const bereit = s.becher.find((b) => b.zustand === 'bereit');
        const durstig = this.gäste.find((g) => g.da && !g.getrunken && !g.bekommt);
        if (bereit && durstig) liste.push({ von: bereit.c, nach: durstig.a.point('mouth') || durstig.a });
        if (s.phase === 'kurbeln') liste.push(s.rad);
      }
      if (!liste.length && s.presse) liste.push(s.presse);
      // (die Gäste kommen gerade: auf sie zeigen, nicht vom Ablauf weg auf den Blätter-Pfeil)
      if (!liste.length && this.gäste[0]?.a && !this.gäste[0].a.destroyed) liste.push(this.gäste[0].a);
      return liste;
    }
    const liegt = this.früchte.find((f) => f.zustand === 'liegt');
    if (liegt) liste.push({ von: liegt.sp, nach: liegt.art === 'apfel' ? this.korbRot.c : this.korbGelb.c });
    if (this.früchte.some((f) => f.zustand === 'hängt')) liste.push({ x: this.stammPunkt.x, y: this.stammPunkt.y });
    if (!liste.length) liste.push(this.maus);
    return liste;
  }
}

// Farbe zwischen a und b (t = 0 … 1)
function mischFarbe(a, b, t) {
  const r = Math.round(lerp((a >> 16) & 255, (b >> 16) & 255, t));
  const g = Math.round(lerp((a >> 8) & 255, (b >> 8) & 255, t));
  const bl = Math.round(lerp(a & 255, b & 255, t));
  return (r << 16) | (g << 8) | bl;
}
