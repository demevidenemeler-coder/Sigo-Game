// Teich, Seite 3 (Froschbucht): der Froschchor auf fünf Seerosenblättern und das Froschkonzert.
// - Auf den Blättern sitzen die Frösche des Chors (gespeichert in 'teich.chor', anfangs zwei; jede geschaffte
//   Kinderstube bringt einen dazu, höchstens fünf). Jeder Frosch singt beim Antippen seinen eigenen Ton –
//   von links nach rechts wird es höher (wie ein Xylophon).
// - Froschkonzert (Ablauf, Libelle antippen):
//   1. Die Libelle fliegt als Dirigentin vor den Chor.
//   2. Je Runde anders: ein oder zwei Frösche schlafen ein (antippen weckt sie), ein Frosch taucht ab (sein Blatt
//      antippen, dann klettert er wieder hinauf) – oder alle sind gleich wach.
//   3. Das Lied: Ein sanftes Leuchten liegt unter dem Frosch, der den nächsten Ton singt. Ihn antippen → nächster
//      Ton (andere Frösche singen einfach ihren Ton, nichts ist falsch). Lied und Instrument wechseln je Runde.
//   4. Zum Schluss singt der Chor das ganze Lied noch einmal allein, alle hüpfen, eine Seerosenblüte wächst dazu
//      (gespeichert in 'teich.blueten', bis alle fünf Blätter blühen). Sticker.

import { Actor, spr, tap, fx, voice, note, store, killTweensOf, rand, pick, clamp, PIXI } from '../../engine/index.js';
import { belohne } from '../../gemeinsam/sticker.js';
import { ton, laut, naechsterSticker, flugDauer } from './deko.js';

export const PADS = [
  { x: -40, y: 960 }, { x: 215, y: 1135 }, { x: 460, y: 950 }, { x: 705, y: 1135 }, { x: 940, y: 960 },
];
const FUELL = [2, 1, 3, 0, 4];               // in dieser Reihenfolge bekommt der Chor neue Plätze
const BLATT_S = 0.74;
export const FROSCH_S = 0.27;
const CHOR_MAX = 5;
const SKALEN = { 1: [67], 2: [64, 67], 3: [60, 64, 67], 4: [60, 62, 64, 67], 5: [60, 62, 64, 65, 67] };
const LIEDER = [
  { id: 'quak', n: 1, t: [67, 67, 67, 67] },
  { id: 'kuckuck', n: 2, t: [67, 64, 67, 64] },
  { id: 'bimbam', n: 2, t: [64, 67, 64, 67, 67] },
  { id: 'dreiklang', n: 3, t: [60, 64, 67, 67, 64, 60] },
  { id: 'runter', n: 3, t: [67, 64, 60, 64, 67] },
  { id: 'jakob', n: 4, t: [60, 62, 64, 60, 60, 62, 64, 60] },
  { id: 'treppe', n: 4, t: [60, 62, 64, 67, 64, 62, 60] },
  { id: 'entchen', n: 5, t: [60, 62, 64, 65, 67, 67] },
  { id: 'haenschen', n: 5, t: [67, 64, 64, 65, 62, 62] },
];
const INSTRUMENTE = ['xylo', 'floete', 'glocke'];
const WECKEN = ['schlafen', 'tauchen', 'wach'];
export const FARBEN = { gruen: 0xffffff, blau: 0x8cc4ff, gold: 0xffd45a, orange: 0xffa8c4 };
const LIBELLE_RUHE = { x: 770, y: 385 };     // auf dem Rohrkolben am fernen Ufer
const DIRIGENT = { x: 455, y: 600 };          // über dem Chor
const LIBELLE_S = 0.5;

export class Konzert {
  constructor(seite) {
    this.seite = seite;
    this.phase = 'frei';     // frei | kommt | wecken | lied | finale | geht
    this.frosche = [];       // {a: Actor, pad, farbe, ton, schlaeft, taucht}
    this.instr = 'xylo';
    this.letztesLied = store.get('teich.liedLetzte', null);
    this.letztesInstr = store.get('teich.instrLetzte', null);
    this.letztesWecken = store.get('teich.weckLetzte', null);
    this.erzwinge = null;    // nur zum Testen: { lied, wecken, instr }
    this.reserviert = new Set();
    this.sperre = 0;
    this.runden = 0;
    this.baueBlaetter();
    this.baueLeuchten();
    this.baueLibelle();
    let chor = store.get('teich.chor', ['gruen', 'gruen']);
    if (!Array.isArray(chor)) chor = ['gruen', 'gruen'];
    chor = chor.filter((f) => FARBEN[f] !== undefined).slice(0, CHOR_MAX);
    if (!chor.length) chor = ['gruen'];
    chor.forEach((farbe, i) => this.neuerFrosch(FUELL[i], farbe));
    this.blueten = clamp(Math.round(Number(store.get('teich.blueten', 0)) || 0), 0, CHOR_MAX);
    for (let i = 0; i < this.blueten; i++) this.bluehe(FUELL[i], true);
    this.stimme();
  }

  get aktiv() { return this.phase !== 'frei'; }

  // ---------------------------------------------------------------- Aufbau

  baueBlaetter() {
    const w = this.seite.welt;
    this.pads = PADS.map((p, i) => {
      const c = new PIXI.Container({ label: 'chorblatt:' + i });
      const blatt = spr('teich/seerosenblatt', { parent: c, anchor: 0.5 });
      blatt.scale.set(BLATT_S);
      blatt.rotation = rand(-0.1, 0.1);
      c.position.set(p.x, p.y);
      c.zIndex = p.y - 60;
      c.basis = { ...p };
      c.dip = { y: 0 };
      c.phase = rand(0, 6);
      c.frosch = null;
      w.addChild(c);
      tap(c, () => this.blattGetippt(i), {
        sound: null, squash: false, hitArea: new PIXI.Ellipse(0, 0, 175, 120),
      });
      return c;
    });
    // Wellenring über einem Blatt, unter dem ein Frosch taucht (Vorrat: einer)
    this.tauchRing = spr('teich/wasserring', { parent: w, anchor: 0.5 });
    this.tauchRing.visible = false;
    this.tauchRing.eventMode = 'none';
  }

  baueLeuchten() {
    const g = new PIXI.Graphics();
    for (let i = 6; i >= 1; i--) g.ellipse(0, 0, 60 + i * 22, 70 + i * 20).fill({ color: 0xfff0a0, alpha: 0.26 });
    g.eventMode = 'none';
    g.alpha = 0;
    g.visible = false;
    this.seite.welt.addChild(g);
    this.leuchten = g;
    this.leuchtOrt = { x: 0, y: 0 };
  }

  baueLibelle() {
    const s = spr('teich/libelle', { parent: this.seite.welt, anchor: 0.5 });
    s.scale.set(LIBELLE_S);
    s.zIndex = 3000;
    s.label = 'dirigentin';
    this.libelle = { s, h: { ...LIBELLE_RUHE }, modus: 'ruht', blick: -1, t: rand(0, 5), takt: { a: 0 } };
    s.scale.x = -LIBELLE_S;
    tap(s, () => this.libelleGetippt(), { sound: null, squash: false, hitArea: new PIXI.Circle(0, 0, 150 / LIBELLE_S) });
  }

  // ---------------------------------------------------------------- Chor

  neuerFrosch(padIdx, farbe, actor = null) {
    const pad = this.pads[padIdx];
    const a = actor || new Actor('frosch', { x: pad.x, y: pad.y + 22, scale: FROSCH_S, parent: this.seite.welt });
    a.sprite.tint = FARBEN[farbe] ?? 0xffffff;
    a.zIndex = pad.basis.y + 10;
    const f = { a, pad: padIdx, farbe, ton: null, schlaeft: false, taucht: false, zzz: null };
    pad.frosch = f;
    a.onTap(() => this.froschGetippt(f), { pad: 45 });
    this.frosche.push(f);
    return f;
  }

  /** Töne nach Platz von links nach rechts verteilen (nur außerhalb des Konzerts) */
  stimme() {
    const n = this.frosche.length;
    const skala = SKALEN[clamp(n, 1, 5)];
    [...this.frosche].sort((a, b) => this.pads[a.pad].basis.x - this.pads[b.pad].basis.x)
      .forEach((f, i) => { f.ton = skala[i]; });
  }

  /** freier Platz im Chor (noch nicht reserviert) → Index oder -1 */
  freierPlatz() {
    for (const i of FUELL) if (!this.pads[i].frosch && !this.reserviert.has(i)) return i;
    return -1;
  }

  reserviere(i) { this.reserviert.add(i); }

  /**
   * Der Chor ist voll: der älteste Frosch (lieber ein grüner – bunte bleiben) zieht weiter ans ferne Ufer und macht
   * sein Blatt für den Neuen frei. Nur außerhalb des Konzerts. `nurSehen`: nichts tun, nur das Blatt nennen.
   * → Index des frei werdenden Blatts oder -1
   */
  platzMachen(nurSehen = false) {
    if (this.phase !== 'frei' || this.frosche.length < CHOR_MAX) return -1;
    const frei = this.frosche.filter((f) => !f.springt && !f.taucht && !f.schlaeft && !f.a.destroyed);
    const alt = frei.find((f) => f.farbe === 'gruen') || frei[0];
    if (!alt) return -1;
    if (nurSehen) return alt.pad;
    const pad = this.pads[alt.pad];
    this.frosche = this.frosche.filter((f) => f !== alt);
    pad.frosch = null;
    this.reserviere(alt.pad);
    const a = alt.a;
    alt.springt = true;
    a.eventMode = 'none';
    a.zIndex = 600;
    const zx = rand(-420, 40);
    const zy = rand(560, 580);   // im Gras am fernen Ufer
    const dauer = flugDauer(zx - a.x, zy - a.y, { hoehe: 240, ease: 'sine', min: 1.2, max: 3, v: 900 });
    this.wippe(pad, 14);
    laut('frosch', 0.5);
    this.seite.tween(a.scale, { x: FROSCH_S * 0.5, y: FROSCH_S * 0.5 }, dauer, { ease: 'sineInOut' });
    a.hopTo(zx, zy, { hoehe: 240, dauer, staub: false }).then(() => {
      if (a.destroyed) return;
      this.seite.tween(a, { alpha: 0 }, 1.2, { ease: 'sineInOut', delay: 0.6 })
        .then(() => { if (!a.destroyed) a.destroy({ children: true }); });
    });
    return alt.pad;
  }

  /** Ort, an dem ein Frosch auf Blatt i sitzt */
  sitz(i) {
    const p = this.pads[i];
    return { x: p.basis.x, y: p.basis.y + 22 };
  }

  /** Ein kleiner Frosch aus der Kinderstube ist auf Blatt i gelandet: er gehört jetzt zum Chor (gespeichert) */
  mitgliedDazu(actor, farbe, i) {
    this.reserviert.delete(i);
    const f = this.neuerFrosch(i, farbe, actor);
    store.set('teich.chor', this.frosche.map((x) => x.farbe));
    if (this.phase === 'frei') this.stimme();
    else f.ton = 72;
    this.wippe(this.pads[i], 16);
    this.seite.ringe.ring(this.pads[i].x, this.pads[i].y + 20, 320, { z: this.pads[i].zIndex - 1 });
    ton('common/platsch', { vol: 0.35 }, 0.3);
    return f;
  }

  /** Alle Frösche freuen sich kurz (Ende der Kinderstube) */
  chorFreut() {
    this.frosche.forEach((f, i) => this.seite.after(0.15 * i, () => {
      if (f.taucht || f.schlaeft) return;
      f.a.hop(40);
    }));
    laut('frosch', 0.6);
  }

  bluehe(i, sofort = false) {
    const pad = this.pads[i];
    if (pad.bluete) return;
    const b = spr('teich/seerose_bluete', { parent: pad, anchor: 0.5, x: -112, y: -22 });
    b.eventMode = 'none';
    pad.bluete = b;
    const s = 0.62;
    if (sofort) { b.scale.set(s); return; }
    b.scale.set(0.05);
    b.alpha = 0;
    this.seite.tween(b, { alpha: 1 }, 0.6, { ease: 'sineInOut' });
    this.seite.tween(b.scale, { x: s, y: s }, 0.9, { ease: 'backOut' });
    this.seite.burst('funkeln', pad.x - 112, pad.y - 30, { count: 6 });
  }

  wippe(c, tief = 12) {
    killTweensOf(c.dip);
    this.seite.tween(c.dip, { y: tief }, 0.14, { ease: 'quadOut' })
      .then((ok) => { if (ok) this.seite.tween(c.dip, { y: 0 }, 0.7, { ease: 'elasticOut' }); });
  }

  // ---------------------------------------------------------------- Antippen

  blattGetippt(i) {
    const pad = this.pads[i];
    const f = pad.frosch;
    if (f) { this.froschGetippt(f); return; }
    this.wippe(pad);
    this.seite.ringe.ring(pad.x, pad.y + 10, 300, { z: pad.zIndex - 1 });
    ton('common/platsch', { vol: 0.3, rate: 1.1 }, 0.3);
  }

  froschGetippt(f) {
    if (f.springt) return;
    if (f.schlaeft) { this.wecke(f); return; }
    if (f.taucht) { this.tauchAuf(f); return; }
    this.singe(f);
    if (this.phase === 'lied' && f === this.ziel) this.naechsterTon();
  }

  /** Frosch singt seinen Ton (Maul auf, Note steigt auf, Blatt wippt) */
  singe(f, { vol = 0.5 } = {}) {
    if (f.a.destroyed) return;
    note(this.instr, f.ton ?? 72, { vol });
    f.a.pose('eat');
    f.singt = (f.singt || 0) + 1;
    const marke = f.singt;
    this.seite.after(0.38, () => { if (f.singt === marke && !f.a.destroyed && !f.schlaeft) f.a.pose('idle'); });
    const kopf = f.a.point('kopf');
    this.seite.burst('noten', kopf.x + 20, kopf.y + 10, { count: 1 });
    this.wippe(this.pads[f.pad], 8);
  }

  libelleGetippt() {
    const l = this.libelle;
    note('pling', pick([84, 86, 88]), { vol: 0.3 });
    fx.wobble(l.s, 0.1);
    if (this.phase === 'frei' && this.sperre <= 0 && this.frosche.length) this.starte();
  }

  // ---------------------------------------------------------------- Ablauf

  waehle() {
    const z = this.erzwinge || {};
    const n = this.frosche.length;
    const passt = LIEDER.filter((l) => l.n <= n && l.t.every((m) => SKALEN[clamp(n, 1, 5)].includes(m)));
    // lieber Lieder, die den ganzen Chor brauchen; nie dasselbe zweimal hintereinander
    const voll = passt.filter((l) => l.n >= Math.min(n, 3));
    const auswahl = (voll.length > 1 ? voll : passt).filter((l) => l.id !== this.letztesLied);
    this.lied = LIEDER.find((l) => l.id === z.lied && passt.includes(l)) || pick(auswahl.length ? auswahl : passt);
    this.instr = INSTRUMENTE.includes(z.instr) ? z.instr : pick(INSTRUMENTE.filter((i) => i !== this.letztesInstr));
    this.wecken = WECKEN.includes(z.wecken) ? z.wecken : pick(WECKEN.filter((w) => w !== this.letztesWecken));
    this.letztesLied = this.lied.id;
    this.letztesInstr = this.instr;
    this.letztesWecken = this.wecken;
    store.set('teich.liedLetzte', this.letztesLied);
    store.set('teich.instrLetzte', this.letztesInstr);
    store.set('teich.weckLetzte', this.letztesWecken);
  }

  starte() {
    this.stimme();
    this.waehle();
    this.runden++;
    this.phase = 'kommt';
    this.spieler = [...this.frosche];
    const l = this.libelle;
    l.modus = 'fliegt';
    killTweensOf(l.h);
    const dauer = flugDauer(DIRIGENT.x - l.h.x, DIRIGENT.y - l.h.y, { ease: 'sine', min: 1.6, v: 600 });
    this.seite.tween(l.h, DIRIGENT, dauer, { ease: 'sineInOut' }).then((ok) => {
      if (!ok) return;
      l.modus = 'dirigiert';
      this.bereit();
    });
  }

  // Die Libelle ist da: je nach Runde schlafen Frösche ein, einer taucht ab – oder es geht gleich los
  bereit() {
    const wach = this.spieler.filter((f) => !f.a.destroyed);
    if (this.wecken === 'schlafen' && wach.length) {
      const zahl = wach.length >= 3 ? 2 : 1;
      const wer = mische(wach).slice(0, zahl);
      wer.forEach((f, i) => this.seite.after(0.5 * i, () => this.schlafEin(f)));
      this.seite.after(0.5 * zahl + 0.4, () => {
        this.phase = 'wecken';
        this.sag('teich_wecken', () => this.phase === 'wecken');
        this.pruefeWach();   // schon alle wach (schnelle Finger)?
      });
    } else if (this.wecken === 'tauchen' && wach.length) {
      this.tauchAb(pick(wach));
      this.seite.after(1.2, () => { this.phase = 'wecken'; this.pruefeWach(); });
    } else {
      this.seite.after(0.4, () => this.starteLied());
    }
  }

  schlafEin(f) {
    if (f.a.destroyed) return;
    f.schlaeft = true;
    f.a.pose('sleep');
    const kopf = f.a.point('kopf');
    f.zzz = this.seite.emitter('zzz', { x: kopf.x + 30, y: kopf.y + 40, rate: 0.6 });
  }

  wecke(f) {
    f.schlaeft = false;
    f.zzz?.stop();
    f.zzz = null;
    f.a.pose('happy');
    laut('frosch', 0.5);
    f.a.hop(50).then(() => { if (!f.a.destroyed && f.a.poseName === 'happy') f.a.pose('idle'); });
    this.wippe(this.pads[f.pad], 12);
    this.pruefeWach();
  }

  tauchAb(f) {
    f.taucht = true;
    f.springt = true;
    const p = this.pads[f.pad];
    const zx = p.basis.x + 150;
    const zy = p.basis.y + 70;
    ton('common/hupf', { vol: 0.45 }, 0.3);
    f.a.hopTo(zx, zy, { hoehe: 120, dauer: 0.7, staub: false }).then(() => {
      f.springt = false;
      if (f.a.destroyed) return;
      this.seite.ringe.ring(zx, zy, 300, { z: p.zIndex + 1 });
      ton('common/platsch', { vol: 0.45 }, 0.2);
      this.seite.burst('tropfen', zx, zy - 20, { count: 5 });
      this.seite.tween(f.a, { alpha: 0 }, 0.3, { ease: 'sineInOut' });
      f.a.eventMode = 'none';
      this.tauchFrosch = f;
      this.tauchUhr = 0.4;
    });
  }

  tauchAuf(f) {
    if (f.springt || !f.taucht) return;
    f.springt = true;
    this.tauchFrosch = null;
    this.tauchRing.visible = false;
    const s = this.sitz(f.pad);
    killTweensOf(f.a, ['alpha']);
    f.a.alpha = 1;
    this.seite.burst('blasen', f.a.x, f.a.y - 30, { count: 4 });
    ton('common/blubber', { vol: 0.5 }, 0.3);
    f.a.hopTo(s.x, s.y, { hoehe: 160, dauer: 0.75, staub: false }).then(() => {
      f.springt = false;
      f.taucht = false;
      if (f.a.destroyed) return;
      f.a.eventMode = 'static';
      f.a.position.set(s.x, s.y);
      laut('frosch', 0.5);
      this.wippe(this.pads[f.pad], 16);
      this.pruefeWach();
    });
  }

  pruefeWach() {
    if (this.phase !== 'wecken') return;
    if (this.spieler.some((f) => f.schlaeft || f.taucht)) return;
    this.phase = 'bereit';
    this.seite.after(0.9, () => this.starteLied());
  }

  starteLied() {
    this.phase = 'lied';
    this.idx = 0;
    this.zeigeZiel(true);
    this.sag('teich_lied', () => this.phase === 'lied' && this.idx === 0);
  }

  froschMitTon(m) {
    return this.spieler.find((f) => f.ton === m && !f.a.destroyed) || this.spieler[0];
  }

  zeigeZiel(sofort = false) {
    this.ziel = this.froschMitTon(this.lied.t[this.idx]);
    const s = this.sitz(this.ziel.pad);
    const g = this.leuchten;
    g.zIndex = this.pads[this.ziel.pad].zIndex + 2;
    killTweensOf(this.leuchtOrt);
    if (sofort || !g.visible) {
      this.leuchtOrt.x = s.x;
      this.leuchtOrt.y = s.y - 105;
      g.visible = true;
      g.alpha = 0;
    } else {
      // ruhig hinübergleiten (Ruhe-Regel: höchstens ~1000 Einheiten/s, jeder Wechsel mindestens 0,6 s)
      const dauer = flugDauer(s.x - this.leuchtOrt.x, s.y - 105 - this.leuchtOrt.y, { ease: 'sine', min: 0.6, v: 800 });
      this.seite.tween(this.leuchtOrt, { x: s.x, y: s.y - 105 }, dauer, { ease: 'sineInOut' });
    }
  }

  naechsterTon() {
    this.idx++;
    if (this.idx >= this.lied.t.length) { this.finale(); return; }
    this.zeigeZiel();
  }

  finale() {
    this.phase = 'finale';
    this.ziel = null;
    this.seite.tween(this.leuchten, { alpha: 0 }, 0.6, { ease: 'sineInOut' }).then(() => { this.leuchten.visible = false; });
    const takt = 0.42;
    const start = 0.9;
    // der Chor singt das Lied noch einmal ganz allein
    this.lied.t.forEach((m, i) => this.seite.after(start + i * takt, () => {
      const f = this.froschMitTon(m);
      if (f) this.singe(f, { vol: 0.42 });
    }));
    const ende = start + this.lied.t.length * takt + 0.5;
    this.seite.after(ende, () => {
      // alle hüpfen nacheinander, dann wächst eine Blüte
      this.spieler.forEach((f, i) => this.seite.after(i * 0.16, () => { if (!f.a.destroyed) f.a.hop(70); }));
      laut('frosch', 0.6);
      this.seite.burst('herzen', DIRIGENT.x, DIRIGENT.y - 40, { count: 6 });
      if (this.blueten < CHOR_MAX) {
        const i = FUELL[this.blueten];
        this.blueten++;
        store.set('teich.blueten', this.blueten);
        this.seite.after(0.8, () => this.bluehe(i));
      }
      this.seite.after(1.4, () => belohne(this.seite, naechsterSticker('teich_libelle', ['teich_libelle', 'tier_frosch']),
        DIRIGENT.x - 300, 420));
    });
    this.seite.after(ende + 3.2, () => this.libelleHeim());
  }

  libelleHeim() {
    this.phase = 'geht';
    const l = this.libelle;
    l.modus = 'fliegt';
    killTweensOf(l.h);
    const dauer = flugDauer(LIBELLE_RUHE.x - l.h.x, LIBELLE_RUHE.y - l.h.y, { ease: 'sine', min: 1.6, v: 600 });
    this.seite.tween(l.h, LIBELLE_RUHE, dauer, { ease: 'sineInOut' }).then(() => {
      l.modus = 'ruht';
      this.phase = 'frei';
      this.sperre = 3;
      this.spieler = [];
      this.stimme();
    });
  }

  sag(id, wann) {
    const passt = () => this.seite.aktiv && wann();
    this.seite.after(1.0, () => { if (passt()) voice(id, { nurWenn: passt }); });
  }

  betreten() {
    this._hinweis?.kill();
    const passt = () => this.seite.aktiv && this.phase === 'frei' && this.frosche.length > 0 &&
      !this.seite.stube.braucht();
    this._hinweis = this.seite.after(this.seite.besuche === 1 ? 14 : 9, () => {
      if (passt()) voice('teich_libelle', { nurWenn: passt });
    });
  }

  verlassen() {
    this._hinweis?.kill();
    this._hinweis = null;
  }

  // ---------------------------------------------------------------- Bild für Bild

  update(dt, t) {
    if (this.sperre > 0) this.sperre -= dt;
    for (const p of this.pads) {
      p.y = p.basis.y + Math.sin(t * 0.8 + p.phase) * 3 + p.dip.y;
      p.rotation = Math.sin(t * 0.6 + p.phase) * 0.015;
    }
    for (const f of this.frosche) {
      if (!f.springt && !f.taucht && !f.a.destroyed) {
        const p = this.pads[f.pad];
        f.a.y = p.y + 22;
      }
    }
    // Libelle: schwebt ruhig; als Dirigentin wiegt sie sich im Takt
    const l = this.libelle;
    l.t += dt;
    let x = l.h.x;
    let y = l.h.y;
    if (l.modus === 'ruht') {
      y += Math.sin(l.t * 1.3) * 4;
    } else if (l.modus === 'dirigiert') {
      x += Math.sin(l.t * 1.6) * 40;
      y += Math.sin(l.t * 3.2) * 12;
    }
    const vx = x - l.s.x;
    if (Math.abs(vx) > 0.4) l.blick = Math.sign(vx);
    if (l.modus === 'ruht') l.blick = -1;
    l.s.position.set(x, y);
    l.s.rotation = l.modus === 'dirigiert' ? Math.sin(l.t * 1.6) * 0.12 : 0;
    l.s.scale.x += (LIBELLE_S * l.blick - l.s.scale.x) * (1 - Math.exp(-dt * 5));
    // Leuchten unter dem Frosch, der dran ist (sanftes, langsames Pulsieren)
    if (this.leuchten.visible && this.phase === 'lied') {
      this.leuchten.position.set(this.leuchtOrt.x, this.leuchtOrt.y + (this.ziel ? this.pads[this.ziel.pad].dip.y : 0));
      const ziel = 0.75 + Math.sin(t * 2.4) * 0.2;
      this.leuchten.alpha += (ziel - this.leuchten.alpha) * (1 - Math.exp(-dt * 3));
    }
    // ein abgetauchter Frosch: ruhige Ringe, wo er wieder hinaufklettern möchte
    if (this.tauchFrosch) {
      this.tauchUhr -= dt;
      if (this.tauchUhr <= 0) {
        this.tauchUhr = 1.8;
        const p = this.pads[this.tauchFrosch.pad];
        this.seite.ringe.ring(p.basis.x + 150, p.basis.y + 70, 240, { z: p.zIndex + 1, dauer: 1.6, alpha: 0.7 });
      }
    }
  }

  // ---------------------------------------------------------------- Zeige-Hand

  /** nächster Schritt des Konzerts (oder null) */
  hinweis() {
    if (this.phase === 'wecken') {
      const f = this.spieler.find((x) => x.schlaeft || x.taucht);
      if (!f) return null;
      return f.taucht ? { x: this.pads[f.pad].x, y: this.pads[f.pad].y } : f.a;
    }
    if (this.phase === 'lied' && this.ziel) return this.ziel.a;
    return null;
  }

  /** Libelle, solange ein Konzert beginnen kann */
  libelleHinweis() {
    return this.phase === 'frei' && this.frosche.length ? this.libelle.s : null;
  }

  /** ein Frosch des Chors zum Antippen (freies Spiel) */
  froschHinweis() {
    return this.frosche.find((f) => !f.taucht && !f.springt)?.a || null;
  }
}

function mische(a) {
  const b = [...a];
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [b[i], b[j]] = [b[j], b[i]];
  }
  return b;
}
