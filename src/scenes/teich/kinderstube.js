// Teich, Seite 3 (Froschbucht): Ablauf „Kinderstube" – vom Froschlaich über die Kaulquappe zum Frosch.
//   1. Im flachen Wasser treibt Froschlaich. Antippen: bei jedem Tipp schlüpft eine Kaulquappe (2–3 je Runde).
//   2. Die Kaulquappen haben Hunger (Denkblase): Wasserpflanze antippen (ein Stück schwimmt von selbst hin) oder ein
//      Stück zu einer Kaulquappe ziehen. Satt bekommt sie Hinterbeinchen.
//   3. Kaulquappe mit Beinchen antippen: sie schwimmt ans Ufer und hüpft als kleiner Frosch auf den Stein.
//   4. Kleinen Frosch antippen oder zum Chor ziehen: der erste hüpft auf ein freies Seerosenblatt und gehört
//      von nun an zum Froschchor (gespeichert), die anderen hüpfen ans ferne Ufer und verschwinden im Gras.
//   5. Der Chor freut sich, Sticker; nach einer Pause treibt neuer Laich herein.
// Je Runde anders (nie zweimal dasselbe hintereinander): Zahl der Kaulquappen, Ort des Laichs und manchmal ein
// besonderer Frosch (türkis, golden, orange), der seine Farbe im Chor behält.
// Nichts kann falsch gemacht werden: jedes Stück Futter findet eine hungrige Kaulquappe, jeder Frosch einen Weg.

import { Actor, spr, tex, tap, drag, fx, voice, store, killTweensOf, rand, pick, clamp, PIXI } from '../../engine/index.js';
import { belohne } from '../../gemeinsam/sticker.js';
import { ton, laut, naechsterSticker, flugDauer } from './deko.js';
import { FARBEN, FROSCH_S } from './konzert.js';

const LAICH_PLAETZE = [{ x: -520, y: 1150 }, { x: -340, y: 1280 }, { x: -640, y: 1030 }];
const LAICH_S = 0.85;
const PFLANZE = { x: -560, y: 1515, s: 0.95 };
const ZONE = { x0: -900, x1: -180, y0: 980, y1: 1300 };
const QUAPPE_S = 0.8;
// Sitzplätze der kleinen Frösche: auf dem flachen Stein und im Sand am Ufer
const SITZ = [{ x: -925, y: 1265 }, { x: -1075, y: 1180 }, { x: -790, y: 1400 }];
const KLEIN_S = 0.17;
const PAUSE_ERST = 2;
const PAUSE = [9, 13];
const VARIANTEN = [
  { id: 'zwei', n: 2 },
  { id: 'drei', n: 3 },
  { id: 'blau', n: 2, farbe: 'blau' },
  { id: 'gold', n: 3, farbe: 'gold' },
  { id: 'orange', n: 2, farbe: 'orange' },
];

export class Kinderstube {
  constructor(seite, konzert) {
    this.seite = seite;
    this.konzert = konzert;
    this.phase = 'ruhe';      // ruhe | laich | futter | beine | chor | fertig
    this.uhr = PAUSE_ERST;
    this.letzte = store.get('teich.laichLetzte', null);
    this.letzterOrt = -1;
    this.erzwinge = null;     // nur zum Testen: { v }
    this.quappen = [];
    this.kleine = [];         // kleine Frösche auf dem Stein
    this.runden = 0;
    this._p = new PIXI.Point();
    this.bauePflanze();
    this.baueLaich();
  }

  /** Läuft gerade das Konzert? Dann quaken die Frösche der Kinderstube nicht dazwischen (Töne nicht stapeln). */
  leise() { return this.konzert.aktiv; }

  /** braucht die Kinderstube gerade das Kind? (dann schweigt der Konzert-Hinweis) */
  braucht() { return this.phase !== 'ruhe' && this.phase !== 'fertig'; }

  // ---------------------------------------------------------------- Aufbau

  bauePflanze() {
    const w = this.seite.welt;
    const p = spr('teich/wasserpflanze', { parent: w, x: PFLANZE.x, y: PFLANZE.y });
    p.scale.set(PFLANZE.s);
    p.zIndex = PFLANZE.y;
    p.label = 'wasserpflanze';
    p.wiegen = { w: 0 };
    this.pflanze = p;
    // Greiffläche ≈ 280 breit, endet 15 über dem 70er-Rand unten
    tap(p, (e) => this.pflanzeBeruehrt(e), {
      sound: null, squash: false, hitArea: new PIXI.Rectangle(-150, -290, 300, 290),
    });
  }

  baueLaich() {
    const s = spr('teich/laich', { parent: this.seite.welt, anchor: 0.5 });
    s.scale.set(LAICH_S);
    s.visible = false;
    s.alpha = 0;
    s.label = 'laich';
    this.laich = s;
    tap(s, () => this.laichGetippt(), { sound: null, squash: false, hitArea: new PIXI.Circle(0, 0, 175) });
  }

  // ---------------------------------------------------------------- Runde

  waehle() {
    const z = this.erzwinge || {};
    this.v = VARIANTEN.find((v) => v.id === z.v) || pick(VARIANTEN.filter((v) => v.id !== this.letzte));
    this.letzte = this.v.id;
    store.set('teich.laichLetzte', this.letzte);
    const orte = [0, 1, 2].filter((i) => i !== this.letzterOrt);
    this.ort = pick(orte);
    this.letzterOrt = this.ort;
  }

  starte() {
    this.waehle();
    this.runden++;
    this.phase = 'laich';
    this.geschluepft = 0;
    this.gefuettert = 0;
    this.verwandelt = 0;
    this.gesendet = 0;
    this.mitglied = false;
    const p = LAICH_PLAETZE[this.ort];
    const s = this.laich;
    killTweensOf(s);
    killTweensOf(s.scale);
    s.position.set(p.x, p.y);
    s.zIndex = p.y + 900;   // vor den frisch geschlüpften Kaulquappen: der nächste Tipp trifft wieder den Laich
    s.scale.set(LAICH_S);
    s.visible = true;
    s.eventMode = 'static';
    s.basisY = p.y;
    this.seite.tween(s, { alpha: 1 }, 1.2, { ease: 'sineInOut' });
    this.seite.ringe.ring(p.x, p.y + 30, 320);
    this.sag('teich_laich', () => this.phase === 'laich' && this.geschluepft === 0);
  }

  sag(id, wann) {
    const passt = () => this.seite.aktiv && wann();
    this.seite.after(1.2, () => { if (passt()) voice(id, { nurWenn: passt }); });
  }

  // ---------------------------------------------------------------- 1. Laich

  laichGetippt() {
    const s = this.laich;
    fx.wobble(s, 0.08);
    if (this.phase !== 'laich' || this.geschluepft >= this.v.n) { ton('common/blubber', { vol: 0.4 }, 0.4); return; }
    this.geschluepft++;
    ton('common/plopp', { vol: 0.55 }, 0.12);
    this.seite.burst('blasen', s.x, s.y - 30, { count: 3 });
    const q = this.neueQuappe(s.x + rand(-40, 40), s.y + rand(-10, 20));
    // die Kaulquappe flitzt sanft ein Stück vom Laich weg
    q.ziel.x = clamp(s.x + rand(-260, 260), ZONE.x0, ZONE.x1);
    q.ziel.y = clamp(s.y + rand(-160, 160), ZONE.y0, ZONE.y1);
    const rest = this.v.n - this.geschluepft;
    this.seite.tween(s.scale, { x: LAICH_S * (0.45 + 0.55 * rest / this.v.n), y: LAICH_S * (0.45 + 0.55 * rest / this.v.n) },
      0.4, { ease: 'backOut' });
    if (rest === 0) {
      s.eventMode = 'none';
      this.seite.tween(s, { alpha: 0 }, 0.9, { ease: 'sineInOut', delay: 0.3 }).then((ok) => { if (ok) s.visible = false; });
      this.seite.after(1.3, () => this.futterBeginnt());
    }
  }

  neueQuappe(x, y) {
    const c = new PIXI.Container({ label: 'kaulquappe' });
    const bild = spr('teich/kaulquappe', { parent: c, anchor: 0.5 });
    c.position.set(x, y);
    c.zIndex = y + 600;
    this.seite.welt.addChild(c);
    const q = {
      c, bild, x, y, ziel: { x, y }, stufe: 0, hunger: true, reserviert: false, wartet: false,
      blick: Math.random() < 0.5 ? 1 : -1, sx: 1, phase: rand(0, 6), groesse: { s: 0.1 },
    };
    q.sx = q.blick;
    this.seite.tween(q.groesse, { s: QUAPPE_S }, 0.5, { ease: 'backOut' });
    // Tippfläche ≈ 250×220 (unabhängig von der Bildgröße)
    tap(c, () => this.quappeGetippt(q), { sound: null, squash: false, hitArea: new PIXI.Rectangle(-125, -110, 250, 220) });
    this.quappen.push(q);
    return q;
  }

  // ---------------------------------------------------------------- 2. Futter

  futterBeginnt() {
    this.phase = 'futter';
    const q = this.quappen.find((x) => x.hunger);
    if (q) this.blase(q, 'teich/wasserpflanze', 3.5);
    this.sag('teich_futter', () => this.phase === 'futter' && this.gefuettert === 0);
  }

  // Berührt: in der Futter-Phase entsteht ein Stück am Finger (ziehen oder einfach loslassen)
  pflanzeBeruehrt(e) {
    const p = this.pflanze;
    killTweensOf(p.wiegen);
    p.wiegen.w = 0.1;
    this.seite.tween(p.wiegen, { w: 0 }, 1.2, { ease: 'sineInOut' });
    ton('common/rascheln', { vol: 0.45 }, 0.3);
    if (this.phase !== 'futter' || !this.quappen.some((q) => q.hunger && !q.reserviert)) return;
    const st = spr('teich/wasserpflanze', { parent: this.seite.welt, x: e.x, y: e.y + 30 });
    st.scale.set(0.38);
    st.zIndex = 5000;
    drag(st, {
      lift: 1.12,
      hitArea: new PIXI.Rectangle(-360, -560, 720, 640),
      back: false,
      onDrop: (_, ctx) => this.stueckLos(st, ctx),
    });
    const global = this.seite.welt.toGlobal({ x: e.x, y: e.y });
    st.emit('pointerdown', { pointerId: e.pointerId, global, stopPropagation() {} });
    st.eventMode = 'none';
  }

  stueckLos(st, ctx) {
    st.eventMode = 'none';
    const bewegt = ctx.cancelled ? 0 : Math.hypot(ctx.x - ctx.startX, ctx.y - ctx.startY);
    const frei = this.quappen.filter((q) => q.hunger && !q.reserviert);
    if (!frei.length) {
      this.seite.tween(st, { alpha: 0 }, 0.5, { ease: 'sineInOut' }).then(() => { if (!st.destroyed) st.destroy(); });
      return;
    }
    // losgelassen nah bei einer Kaulquappe: die bekommt es; sonst die nächste hungrige
    const naechste = frei.reduce((a, b) => (Math.hypot(a.x - st.x, a.y - st.y) < Math.hypot(b.x - st.x, b.y - st.y) ? a : b));
    this.fuettere(naechste, st, bewegt >= 40);
  }

  fuettere(q, st, gezogen) {
    q.reserviert = true;
    q.wartet = true;
    const x0 = st.x;
    const y0 = st.y;
    const zx = q.x + q.blick * 70;
    const zy = q.y - 20;
    const hoehe = gezogen ? 40 : 120;
    const p = { t: 0 };
    ton('common/wusch', { vol: 0.25 }, 0.3);
    this.seite.tween(p, { t: 1 }, flugDauer(zx - x0, zy - y0, { hoehe, min: 0.5, v: 900 }), {
      ease: 'linear',
      onUpdate: () => {
        if (st.destroyed) return;
        st.x = x0 + (zx - x0) * p.t;
        st.y = y0 + (zy - y0) * p.t - hoehe * 4 * p.t * (1 - p.t);
      },
    }).then(() => {
      if (!st.destroyed) {
        this.seite.tween(st, { alpha: 0 }, 0.35, { ease: 'sineInOut' }).then(() => { if (!st.destroyed) st.destroy(); });
        this.seite.tween(st.scale, { x: 0.1, y: 0.1 }, 0.35, { ease: 'sineInOut' });
      }
      ton('common/mampf', { vol: 0.6 }, 0.2);
      fx.pop(q.bild, 0.12);
      this.seite.after(0.6, () => this.wachseBeine(q));
    });
  }

  wachseBeine(q) {
    if (q.c.destroyed) return;
    q.bild.texture = tex('teich/kaulquappe_beine');
    q.stufe = 1;
    q.hunger = false;
    q.wartet = false;
    fx.pop(q.bild, 0.18);
    this.seite.burst('funkeln', q.x, q.y - 40, { count: 5 });
    ton('common/wachsen', { vol: 0.45 }, 0.3);
    this.gefuettert++;
    if (this.quappen.every((x) => !x.hunger)) {
      this.seite.after(0.9, () => { if (this.phase === 'futter') this.phase = 'beine'; });
    } else {
      const naechste = this.quappen.find((x) => x.hunger && !x.reserviert);
      if (naechste) this.blase(naechste, 'teich/wasserpflanze', 2.5);
    }
  }

  // ---------------------------------------------------------------- 3. Verwandeln

  quappeGetippt(q) {
    if (q.weg) return;
    if (q.stufe === 1 && !q.hunger && (this.phase === 'beine' || this.phase === 'futter')) { this.verwandle(q); return; }
    // sonst: kleiner Hüpfer und Blubbern; hungrige zeigen ihren Wunsch
    fx.wobble(q.bild, 0.12);
    ton('common/blubber', { vol: 0.4 }, 0.3);
    this.seite.burst('blasen', q.x, q.y - 30, { count: 2 });
    if (q.hunger && this.phase === 'futter') this.blase(q, 'teich/wasserpflanze', 2);
  }

  verwandle(q) {
    q.weg = true;
    q.wartet = true;
    q.c.eventMode = 'none';
    const i = this.verwandelt++;
    const sitz = SITZ[i % SITZ.length];
    // schwimmt ans Ufer (Wasserkante vor dem Sitzplatz)
    const rand_ = { x: sitz.x + 150, y: sitz.y + 30 };
    killTweensOf(q);
    const dauer = clamp(Math.hypot(rand_.x - q.x, rand_.y - q.y) / 260, 0.8, 2.2);
    q.blick = rand_.x < q.x ? -1 : 1;
    this.seite.tween(q, { x: rand_.x, y: rand_.y }, dauer, { ease: 'sineInOut' }).then(() => {
      if (q.c.destroyed) return;
      // Plopp: aus der Kaulquappe wird ein kleiner Frosch, der auf seinen Platz hüpft
      const farbe = this.v.farbe && i === 0 ? this.v.farbe : 'gruen';
      const a = new Actor('frosch', { x: q.x, y: q.y + 20, scale: KLEIN_S * 0.6, parent: this.seite.welt });
      a.sprite.tint = FARBEN[farbe];
      a.zIndex = 3000;
      this.seite.ringe.ring(q.x, q.y + 10, 260);
      ton('common/platsch', { vol: 0.4 }, 0.2);
      this.seite.burst(farbe === 'gold' ? 'sterne' : 'funkeln', q.x, q.y - 40, { count: 5 });
      this.seite.tween(q.c, { alpha: 0 }, 0.25, { ease: 'sineInOut' }).then(() => { if (!q.c.destroyed) q.c.destroy({ children: true }); });
      this.quappen = this.quappen.filter((x) => x !== q);
      this.seite.tween(a.scale, { x: KLEIN_S, y: KLEIN_S }, 0.6, { ease: 'sineInOut' });
      a.hopTo(sitz.x, sitz.y, { hoehe: 110, dauer: 0.7, staub: false }).then(() => {
        if (a.destroyed) return;
        a.zIndex = sitz.y;
        if (!this.leise()) laut('frosch', 0.6);
        a.hop(30);
      });
      const k = { a, farbe, gesendet: false };
      this.kleine.push(k);
      this.machZiehbar(k);
      if (this.verwandelt >= this.v.n) {
        this.seite.after(1.0, () => {
          this.phase = 'chor';
          this.sag('teich_chor', () => this.phase === 'chor' && this.gesendet === 0);
        });
      }
    });
  }

  // ---------------------------------------------------------------- 4. Zum Chor

  machZiehbar(k) {
    const a = k.a;
    // Ziehen (oder nur antippen): losgelassen hüpft der Frosch immer weiter – zum Chor oder ans ferne Ufer
    k.drag = drag(a, {
      lift: 1.1,
      back: false,
      hitArea: new PIXI.Rectangle(-700, -1350, 1400, 1450),   // ≈ 240×250 bei der kleinen Größe
      onStart: () => { a.stop(); },
      onDrop: () => this.sende(k),
    });
  }

  sende(k) {
    if (k.gesendet) return;
    const a = k.a;
    if (this.phase !== 'chor') {
      // noch nicht dran: er hüpft zurück auf seinen Platz und quakt
      const i = this.kleine.indexOf(k);
      const sitz = SITZ[Math.max(0, i) % SITZ.length];
      a.hopTo(sitz.x, sitz.y, { hoehe: 60, dauer: 0.45, staub: false });
      laut('frosch', 0.8);
      return;
    }
    k.gesendet = true;
    this.gesendet++;
    a.eventMode = 'none';
    k.drag?.off();
    a.zIndex = 3000;
    // in den Chor kommt einer je Runde – gibt es einen besonderen (bunten) Frosch, ist er es
    const bunt = this.kleine.some((o) => !o.gesendet && o !== k && o.farbe !== 'gruen');
    let platz = this.mitglied || (k.farbe === 'gruen' && bunt) ? -1 : this.konzert.freierPlatz();
    // Chor voll: der älteste Frosch zieht weiter und macht Platz (so bleibt auch ein voller Chor lebendig)
    if (platz < 0 && !this.mitglied && !(k.farbe === 'gruen' && bunt)) platz = this.konzert.platzMachen();
    ton('common/hupf', { vol: 0.5 }, 0.2);
    if (platz >= 0) {
      this.mitglied = true;
      this.konzert.reserviere(platz);
      const s = this.konzert.sitz(platz);
      const dauer = flugDauer(s.x - a.x, s.y - a.y, { hoehe: 280, ease: 'sine', min: 1.0, max: 3, v: 1000 });
      this.seite.tween(a.scale, { x: FROSCH_S, y: FROSCH_S }, dauer, { ease: 'sineInOut' });
      a.hopTo(s.x, s.y, { hoehe: 280, dauer, staub: false }).then(() => {
        if (a.destroyed) return;
        a.position.set(s.x, s.y);
        this.konzert.mitgliedDazu(a, k.farbe, platz);
        if (this.leise()) a.hop(40); else a.cheer({ parent: this.seite.vorn });
        this.weiter();
      });
    } else {
      // der Chor ist voll (oder hat schon einen Neuen): ans ferne Ufer, dann ins Gras
      const zx = rand(-420, 40);
      const zy = rand(560, 580);   // im Gras am fernen Ufer (Wasser beginnt bei 590)
      const dauer = flugDauer(zx - a.x, zy - a.y, { hoehe: 240, ease: 'sine', min: 1.0, max: 3, v: 1000 });
      this.seite.tween(a.scale, { x: KLEIN_S * 0.8, y: KLEIN_S * 0.8 }, dauer, { ease: 'sineInOut' });
      a.hopTo(zx, zy, { hoehe: 240, dauer, staub: false }).then(() => {
        if (a.destroyed) return;
        a.zIndex = zy;
        if (!this.leise()) laut('frosch', 0.6);
        this.seite.tween(a, { alpha: 0 }, 1.2, { ease: 'sineInOut', delay: 0.8 }).then(() => { if (!a.destroyed) a.destroy({ children: true }); });
        this.weiter();
      });
    }
  }

  weiter() {
    if (this.phase !== 'chor' || this.kleine.some((k) => !k.gesendet)) return;
    if (this.fertigGesagt) return;
    this.fertigGesagt = true;
    this.phase = 'fertig';
    this.seite.after(0.8, () => {
      if (!this.leise()) this.konzert.chorFreut();
      belohne(this.seite, naechsterSticker('teich_kaulquappe', ['teich_kaulquappe']), -470, 560);
    });
    this.seite.after(2.5, () => {
      this.kleine = this.kleine.filter((k) => !k.a.destroyed && !k.gesendet);
      this.fertigGesagt = false;
      this.phase = 'ruhe';
      this.uhr = rand(...PAUSE);
    });
  }

  // ---------------------------------------------------------------- Denkblase

  blase(q, bild, sek) {
    this.blaseWeg();
    const c = new PIXI.Container({ label: 'stube:blase' });
    const grund = spr('common/blase_denk', { parent: c, anchor: { x: 0.1, y: 0.95 } });
    grund.scale.set(260 / grund.texture.width);
    const b = spr(bild, { parent: c, anchor: 0.5 });
    b.scale.set(120 / Math.max(b.texture.width, b.texture.height));
    b.position.set(grund.width * 0.48, -grund.height * 0.52);
    c.zIndex = 3100;
    c.alpha = 0;
    c.scale.set(0.6);
    c.eventMode = 'none';
    c.quappe = q;
    this.seite.welt.addChild(c);
    this._blase = c;
    this.seite.tween(c, { alpha: 1 }, 0.35, { ease: 'sineInOut' });
    this.seite.tween(c, { scale: 1 }, 0.45, { ease: 'backOut' });
    this.seite.after(sek, () => this.blaseWeg(c));
  }

  blaseWeg(nur = null) {
    const c = this._blase;
    if (!c || c.destroyed || (nur && nur !== c)) return;
    this._blase = null;
    this.seite.tween(c, { alpha: 0 }, 0.45, { ease: 'sineInOut' }).then(() => { if (!c.destroyed) c.destroy({ children: true }); });
  }

  // ---------------------------------------------------------------- Bild für Bild

  update(dt, t) {
    if (this.phase === 'ruhe') {
      if (this.seite.aktiv && !this.konzert.aktiv) this.uhr -= dt;
      if (this.uhr <= 0) this.starte();
    }
    const p = this.pflanze;
    p.skew.x = Math.sin(t * 0.9) * 0.04 + Math.sin(t * 6) * p.wiegen.w;
    if (this.laich.visible) {
      this.laich.y = this.laich.basisY + Math.sin(t * 1.2) * 4;
      if (this.phase === 'laich') this.laich.rotation = Math.sin(t * 2.2) * 0.04;
    }
    for (const q of this.quappen) this.schwimme(q, dt, t);
    if (this._blase && !this._blase.destroyed) {
      const q = this._blase.quappe;
      if (q && !q.c.destroyed) this._blase.position.set(q.x + 40, q.y - 70);
    }
  }

  schwimme(q, dt, t) {
    if (!q.wartet) {
      const dx = q.ziel.x - q.x;
      const dy = q.ziel.y - q.y;
      const d = Math.hypot(dx, dy);
      if (d < 12) {
        q.ziel.x = rand(ZONE.x0, ZONE.x1);
        q.ziel.y = rand(ZONE.y0, ZONE.y1);
      } else {
        const v = 75 * clamp(d / 90, 0.3, 1);
        q.x += (dx / d) * v * dt;
        q.y += (dy / d) * v * dt * 0.8;
        if (Math.abs(dx) > 10) q.blick = Math.sign(dx);
      }
      // Abstand zu den anderen
      for (const o of this.quappen) {
        if (o === q) continue;
        const ax = q.x - o.x;
        const ay = q.y - o.y;
        const ab = Math.hypot(ax, ay) || 1;
        if (ab < 170) {
          q.x += (ax / ab) * (170 - ab) * Math.min(1, dt * 2);
          q.y += (ay / ab) * (170 - ab) * Math.min(1, dt * 2) * 0.5;
        }
      }
      q.x = clamp(q.x, ZONE.x0 - 40, ZONE.x1 + 40);
      q.y = clamp(q.y, ZONE.y0 - 40, ZONE.y1 + 40);
    }
    q.sx += (q.blick - q.sx) * (1 - Math.exp(-dt * 6));
    const s = q.groesse.s;
    q.c.position.set(q.x, q.y + Math.sin(t * 1.6 + q.phase) * 4);
    q.c.zIndex = q.y + 600;   // vor der Wasserpflanze (sie verdeckt keine Kaulquappe)
    q.bild.scale.set(s * q.sx, s * (1 + Math.sin(t * 7 + q.phase) * 0.03));
    q.bild.skew.y = Math.sin(t * 6 + q.phase) * 0.06;
  }

  // ---------------------------------------------------------------- Zeige-Hand

  hinweis() {
    switch (this.phase) {
      case 'laich': return this.laich.visible ? this.laich : null;
      case 'futter': {
        const q = this.quappen.find((x) => x.hunger && !x.reserviert);
        return q ? { von: this.pflanze, nach: q.c } : null;
      }
      case 'beine': return this.quappen.find((x) => x.stufe === 1 && !x.weg)?.c || null;
      case 'chor': {
        const offen = this.kleine.filter((x) => !x.gesendet && !x.a.destroyed);
        const k = offen.find((x) => x.farbe !== 'gruen') || offen[0];
        if (!k) return null;
        const bunt = this.kleine.some((o) => !o.gesendet && o !== k && o.farbe !== 'gruen');
        let platz = this.mitglied || (k.farbe === 'gruen' && bunt) ? -1 : this.konzert.freierPlatz();
        if (platz < 0 && !this.mitglied && !(k.farbe === 'gruen' && bunt)) platz = this.konzert.platzMachen(true);
        const ziel = platz >= 0 ? this.konzert.sitz(platz) : { x: -200, y: 570 };
        return { von: k.a, nach: ziel };
      }
      default: return null;
    }
  }
}
