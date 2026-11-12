// Seite 3: Der Obstbaum.
// Im Baum hängen vier Äpfel und vier Birnen. Tipp auf den Baum → er raschelt, die Früchte schaukeln, ein paar
// Blätter fallen und 1–2 Früchte plumpsen ins Gras (eine Frucht direkt antippen lässt sie auch fallen). Frucht in den
// passenden Korb ziehen (roter Korb = Äpfel, gelber Korb = Birnen); falscher Korb → hüpft freundlich zurück.
// Alles einsortiert → der Igel kommt und bekommt einen Apfel – oder (jede zweite Runde, und solange ihr Sticker
// noch fehlt, zuerst) die Maus, die am gelben Korb wohnt, bekommt eine Birne; Sticker; danach wachsen die Früchte
// weich nach. Schnelles Mehrfach-Tippen auf den Baum lässt nicht mehr Früchte fallen, nur die Blätter rascheln.

import {
  tap, drag, sfx, voice, note, fx, Actor, spr, rand, pick, clamp, killTweensOf, PIXI,
} from '../../engine/index.js';
import { Seite } from '../../gemeinsam/seiten.js';
import { fuettere } from '../../gemeinsam/futter.js';
import { belohne, gesammelt } from '../../gemeinsam/sticker.js';
import { umhängen, bogen, gleitDauer, Vogel, Flieger, wolken } from './helfer.js';
import { bauKorb } from './korb.js';

const FRUCHT_HÖHE = 160;       // Darstellungshöhe einer Frucht am Baum
const IM_KORB = 0.62;          // Größe im Korb (Anteil)
const ANKER_Y = 0.08;          // Früchte hängen am Stiel
const IGEL_WEG = -1500;        // dort wartet der Igel (außerhalb des Bildes)
const IGEL_Y = 1395;
const FALL_G = 1600;           // „Schwerkraft“ beim Fallen (Einheiten/s²): ruhiger als echt
const SCHÜTTEL_PAUSE = 1.4;    // so lange nach einem Schütteln fallen keine weiteren Früchte (Ruhe)
const MAUS_SKALA = 0.2;
// Oberkante des vorderen Korbrands (Bildpunkte der Korb-Bilder 500 × 399)
const KORB_RAND = [[0, 112], [60, 150], [140, 178], [250, 190], [360, 178], [440, 150], [500, 112]];
// Plätze im Korb (Bildpunkte): Mitte der Frucht
const KORB_PLÄTZE = [[170, 118], [330, 118], [250, 104], [205, 88], [295, 88]];
// Landeplätze im Gras (Unterkante der Frucht): hintere Reihe neben dem Stamm, vordere Reihe davor
const LANDEPLÄTZE = [
  [-480, 1330], [-240, 1335], [240, 1335], [480, 1330],
  [-360, 1460], [-120, 1465], [120, 1465], [360, 1460],
];

// Abstand eines Punkts (Seiten-Koordinaten) zur Mitte einer Frucht (der Anker sitzt am Stiel), ohne neue Objekte
function abstandZurMitte(f, x, y) {
  const sp = f.sp;
  const d = (0.5 - ANKER_Y) * sp.texture.height * sp.scale.y;
  const mx = sp.x - Math.sin(sp.rotation) * d;
  const my = sp.y + Math.cos(sp.rotation) * d;
  return Math.hypot(x - mx, y - my);
}

export class Obst extends Seite {
  static hg = 'garten/hg_obst';

  aufbau() {
    this.runde = 'sammeln';   // 'sammeln' | 'igel'

    // Körbe an den Punkten korb_l / korb_r
    const kl = this.punkt('korb_l', { x: -714, y: 1400 });
    const kr = this.punkt('korb_r', { x: 706, y: 1400 });
    this.korbRot = bauKorb(this, 'garten/korb_rot', { x: kl.x, y: kl.y, scale: 0.62, z: 60, rand: KORB_RAND });
    this.korbGelb = bauKorb(this, 'garten/korb_gelb', { x: kr.x, y: kr.y, scale: 0.62, z: 60, rand: KORB_RAND });
    this.korbRot.art = 'apfel';
    this.korbGelb.art = 'birne';

    this.baueBaum();
    this.früchte = [];
    for (let i = 0; i < 8; i++) this.früchte.push(this.neueFrucht(i, false));

    // Igel wartet außerhalb des Bildes
    this.igel = new Actor('igel', { x: IGEL_WEG, y: IGEL_Y, scale: 0.3, parent: this.welt, z: 80 });
    this.igel.visible = false;
    this.igelUnterwegs = false;
    this.igel.onTap(() => {
      if (this.igelUnterwegs) {
        fx.wobble(this.igel, 0.05);
        this.igel.sound();
      } else {
        this.igel.cheer();
      }
    });

    // Die Maus wohnt rechts neben dem gelben Korb (Birnen-Korb) – klein, antippbar
    this.mausHeim = { x: this.korbGelb.c.x + 255, y: kr.y };
    this.maus = new Actor('maus', {
      x: this.mausHeim.x, y: this.mausHeim.y, scale: MAUS_SKALA, flip: true, parent: this.welt, z: 70,
    });
    this.mausBeschäftigt = false;
    this.maus.onTap(() => {
      if (this.mausBeschäftigt) this.maus.sound();
      else this.maus.cheer();
    }, { pad: 70 });
    this.uhr = 0;
    this.schüttelBis = 0;
    this.raschelBis = 0;
    this.obstRunden = 0;

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
          return { x: o.x + rand(-60, 60), y: o.y - 20, sitzen: true, dauer: rand(3, 5) };
        }
        return { x: rand(-950, 950), y: rand(250, 1150), sitzen: false };
      },
    });
    // Wolken nur im freien Himmel links und rechts der Krone (die Krone ist Teil des Hintergrundbilds und steht
    // vorn – eine Wolke davor sähe falsch aus); sie pendeln dort ganz langsam hin und her
    this.wolken = wolken(this.hinten, [
      { id: 'common/wolke3', x: -1000, y: 345, breite: 200, tempo: 5, bereich: [-1270, -790] },
      { id: 'common/wolke1', x: 950, y: 330, breite: 260, tempo: 4, bereich: [760, 1290] },
    ]);
  }

  betreten() {
    // „Tipp den Baum an. Leg das Obst in den passenden Korb." kurz nach dem Hereingleiten anbieten (der Kern sagt
    // ihn höchstens einmal am Tag) – nur, wenn das Kind auf dieser Seite noch nicht geschüttelt, keine Frucht
    // angetippt oder gezogen hat und die Seite noch zu sehen ist
    this.obstHier = false;
    this._hinweis?.kill();
    const passt = () => this.aktiv && !this.obstHier;
    this._hinweis = this.after(2.5, () => { if (passt()) voice('garten_obst', { nurWenn: passt }); });
  }

  verlassen() {
    this._hinweis?.kill();
    this._hinweis = null;
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
    if (this.uhr < this.schüttelBis) {
      // gerade erst geschüttelt: nur leise rascheln (entprellt) und die Früchte schaukeln etwas mehr
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
    const art = i % 2 === 0 ? 'apfel' : 'birne';
    const id = art === 'apfel' ? 'garten/apfel_rot' : 'garten/birne_gelb';
    const ersatz = [[-514, 560], [-264, 340], [6, 240], [266, 340], [516, 560], [-314, 720], [6, 500], [336, 720]][i];
    const p = this.punkt('frucht' + (i + 1), { x: ersatz[0], y: ersatz[1] });
    const sp = spr(id, { parent: this.welt, anchor: [0.5, ANKER_Y], z: 30 });
    const s = FRUCHT_HÖHE / sp.texture.height;
    // Punkt = Mitte der Frucht; der Anker sitzt am Stiel
    const am = { x: p.x, y: p.y - FRUCHT_HÖHE * (0.5 - ANKER_Y) };
    sp.position.set(am.x, am.y);
    sp.scale.set(weich ? 0 : s);
    const f = { i, art, sp, s, am, zustand: 'hängt', schwung: 0, phase: rand(0, 6), tap: null, zug: null };
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
    // 2000 Einheiten/s an (vorher in fester Zeit von 0,6 s bis zu 3700).
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
    f.zug = drag(f.sp, {
      targets: () => this.korbZiele(),
      lift: 1.15,
      pad: 55,
      back: false,   // ohne Treffer gleitet sie zu ihrem Platz im Gras (nicht dorthin, wo sie gegriffen wurde)
      // Neu gegriffen (auch mitten im Zurückhüpfen): jede eigene Bewegung der Frucht endet sofort,
      // damit sie dem Finger folgt
      onStart: () => this.halteAn(f),
      onDrop: (ziel, ctx) => this.abgelegt(f, ziel, ctx),
    });
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
    const n = korb.liste.length;
    korb.liste.push(f.sp);
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
    f.sp.zIndex = 0;
    await this.tween(f.sp, { x: ziel.x, y: ziel.y - versatz }, 0.22, { ease: 'quadIn' });
    f.sp.ruheY = ziel.y - versatz;
    sfx('common/plopp', { vol: 0.75 });
    fx.pop(korb.c, 0.06);
    note('xylo', korb.art === 'apfel' ? 72 + 2 * korb.liste.length : 79 + 2 * korb.liste.length, { vol: 0.3 });
    if (this.runde === 'sammeln' && this.früchte.every((x) => x.zustand === 'korb')) this.rundeGeschafft();
  }

  // Wer bekommt diesmal etwas? Solange der Maus-Sticker (der Sticker des Gartens) fehlt, die Maus; danach
  // abwechselnd Igel und Maus.
  rundeGeschafft() {
    this.obstRunden++;
    const mausFehlt = !gesammelt().includes('tier_maus');
    const gast = mausFehlt || this.letzterGast === 'igel' ? 'maus' : 'igel';
    this.letzterGast = gast;
    if (gast === 'maus') this.mausKommt();
    else this.igelKommt();
  }

  // ---------------------------------------------------------------- Igel

  async igelKommt() {
    this.runde = 'igel';
    await this.wait(0.8);
    const igel = this.igel;
    igel.visible = true;
    igel.position.set(IGEL_WEG, IGEL_Y);
    this.igelUnterwegs = true;
    const ziel = this.korbRot.c.x + 280;
    await igel.walkTo(ziel, IGEL_Y, { tempo: 260 });
    this.igelUnterwegs = false;
    igel.position.set(ziel, IGEL_Y);
    igel.lookAt(this.korbRot.c.x);
    await this.wait(0.3);

    // Ein Apfel hüpft aus dem roten Korb zum Igel
    const korb = this.korbRot;
    let apfel = korb.liste.pop();
    if (apfel && !apfel.destroyed) {
      umhängen(apfel, this.welt);
      apfel.zIndex = 120;
      const h = apfel.height;
      apfel.anchor.set(0.5, 0.5);
      apfel.y += h * (0.5 - ANKER_Y);
    } else {
      const o = korb.öffnung();
      apfel = spr('garten/apfel_rot', { anchor: 0.5, parent: this.welt, x: o.x, y: o.y, z: 120 });
      apfel.scale.set((FRUCHT_HÖHE * IM_KORB) / apfel.texture.height);
    }
    apfel.rotation = 0;
    await bogen(this, apfel, apfel.x + 40, apfel.y - 120, { dauer: 0.35, höhe: 0 });
    await fuettere(this, igel, apfel, { futter: 'futter_apfel' });
    if (!apfel.destroyed) apfel.destroy();
    // Sticker deutlich über dem Igel (sonst stünde das Sticker-Bild wie ein zweiter Igel auf seinem Kopf)
    await belohne(this, 'tier_igel', igel.x + 40, igel.y - 640);
    await this.wait(0.8);

    // Igel geht zurück, die Körbe leeren sich, neue Früchte wachsen
    this.igelUnterwegs = true;
    igel.walkTo(IGEL_WEG, IGEL_Y, { tempo: 260 }).then(() => {
      if (igel.x < -1300) igel.visible = false;
      this.igelUnterwegs = false;
    });
    await this.nachwachsen();
  }

  // ---------------------------------------------------------------- Maus

  async mausKommt() {
    this.runde = 'maus';
    await this.wait(0.8);
    const maus = this.maus;
    const korb = this.korbGelb;
    this.mausBeschäftigt = true;
    // Die Maus hüpft an den Korb heran …
    const nah = { x: korb.c.x + 205, y: this.mausHeim.y };
    await maus.hopTo(nah.x, nah.y);
    maus.position.set(nah.x, nah.y);
    maus.lookAt(korb.c.x);
    await this.wait(0.25);

    // … eine Birne hüpft aus dem gelben Korb zu ihr
    let birne = korb.liste.pop();
    if (birne && !birne.destroyed) {
      umhängen(birne, this.welt);
      birne.anchor.set(0.5, 0.5);
      birne.y += birne.height * (0.5 - ANKER_Y);
    } else {
      const o = korb.öffnung();
      birne = spr('garten/birne_gelb', { anchor: 0.5, parent: this.welt, x: o.x, y: o.y });
      birne.scale.set((FRUCHT_HÖHE * IM_KORB) / birne.texture.height);
    }
    birne.zIndex = 120;
    birne.rotation = 0;
    birne.eventMode = 'none';
    await bogen(this, birne, birne.x + 20, birne.y - 110, { dauer: 0.35, höhe: 0 });
    // Die Maus knabbert die Birne (eigener kleiner Ablauf: Birnen stehen nicht auf ihrer Futterliste)
    const maul = maus.point('mouth') || { x: maus.x - 40, y: maus.y - 100 };
    const ruhe = Math.abs(birne.scale.y);
    await bogen(this, birne, maul.x, maul.y, { dauer: 0.45, höhe: 70, skala: ruhe * 0.85 });
    maus.pose('eat');
    for (let k = 0; k < 3; k++) {
      if (birne.destroyed) break;
      sfx('common/mampf', { vol: 0.7 });
      await this.tween(birne, { scale: Math.abs(birne.scale.y) * 0.7 }, 0.3, { ease: 'sineInOut' });
      await this.wait(0.15);
    }
    if (!birne.destroyed) {
      await this.tween(birne, { alpha: 0, scale: Math.abs(birne.scale.y) * 0.4 }, 0.25, { ease: 'quadIn' });
      if (!birne.destroyed) birne.destroy();
    }
    await this.wait(0.2);
    await maus.cheer();
    // Sticker rechts neben der Krone im Himmel, deutlich über der Maus (kein „Turm" aus zwei Mäusen)
    await belohne(this, 'tier_maus', 885, 740);
    await this.wait(0.6);
    // zurück an ihren Platz
    await maus.hopTo(this.mausHeim.x, this.mausHeim.y);
    maus.position.set(this.mausHeim.x, this.mausHeim.y);
    maus.lookAt(this.mausHeim.x - 100);
    this.mausBeschäftigt = false;
    await this.nachwachsen();
  }

  // Körbe leeren sich weich, neue Früchte wachsen nacheinander, dann geht es von vorn los
  async nachwachsen() {
    for (const k of [this.korbRot, this.korbGelb]) {
      const weg = k.liste.splice(0);
      weg.forEach((sp, i) => this.tween(sp, { alpha: 0 }, 0.6, { ease: 'sineInOut', delay: i * 0.12 })
        .then(() => { if (!sp.destroyed) sp.destroy(); }));
    }
    await this.wait(1.2);
    sfx('common/wachsen', { vol: 0.7 });
    this.früchte = [];
    for (let i = 0; i < 8; i++) {
      this.after(i * 0.35, () => {
        this.früchte[i] = this.neueFrucht(i, true);
        note('glocke', [72, 74, 76, 79, 81, 84, 86, 88][i], { vol: 0.2 });
      });
    }
    // Platzhalter, bis alle gewachsen sind (damit niemand „alles im Korb" meldet)
    for (let i = 0; i < 8; i++) this.früchte[i] = { zustand: 'wächst' };
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
  }

  hinweise() {
    const liegt = this.früchte.find((f) => f.zustand === 'liegt');
    const liste = [];
    if (liegt) liste.push({ von: liegt.sp, nach: liegt.art === 'apfel' ? this.korbRot.c : this.korbGelb.c });
    if (this.früchte.some((f) => f.zustand === 'hängt')) liste.push({ x: this.stammPunkt.x, y: this.stammPunkt.y });
    if (this.igel.visible) liste.push(this.igel);
    if (!liste.length) liste.push(this.maus);
    return liste;
  }
}
