// Seite 2: die Zuckerbäckerei – abwechselnd Kekse und eine Geburtstagstorte.
//
// Kekse (ein Gast kommt und wünscht sich einen Keks):
//   1. Ausrollen: das Nudelholz über den Teig ziehen (oder antippen) – der Teig wird eine flache Platte.
//   2. Ausstechen: eine Form antippen (Stern, Herz, Mond, Hase – jede Runde drei andere) – sie sticht einen Keks
//      aus. Viermal; jede Form darf man nehmen, auch gemischt.
//   3. Backen: den kleinen Ofen antippen – die Kekse hüpfen hinein, werden goldbraun und hüpfen wieder heraus.
//   4. Zuckerguss: eine Schale antippen (drei Farben je Runde) – der nächste Keks bekommt Guss in dieser Farbe.
//   5. Streusel: den Streuer antippen – er streut bunte Streusel über alle Kekse.
//   6. Verschenken: einen Keks zum Gast ziehen (oder den Gast antippen) – er knuspert und freut sich.
//   7. Ins Keksglas: das Glas antippen (oder einen Keks hineinziehen) – die übrigen Kekse hüpfen hinein.
//      Das Glas bleibt über die Besuche gefüllt (gespeichert); es gibt einen Sticker.
// Geburtstagstorte (ein Tier mit Partyhütchen hat Geburtstag):
//   1. Boden auf die Tortenplatte (Stapel antippen oder ziehen), 2. Creme darauf (Schale antippen),
//   3. noch ein Boden und Creme (manchmal ein dritter), 4. Früchte obendrauf (drei Tipps, zwei Sorten zur Wahl),
//   5. drei Kerzen hineinstecken, 6. Kerzen anzünden (Torte antippen – die Flammen erscheinen weich),
//   7. Pusten: das Geburtstagstier antippen – es pustet, die Flammen gehen sanft aus, ein leises Lied, Sticker.
// Jede Runde ändern sich Gast, Formen, Farben, Creme, Früchte und die Zahl der Böden. Nichts kann schiefgehen.

import { tap, drag, sfx, voice, note, fx, Actor, spr, meta, rand, pick, clamp, killTweensOf, PIXI } from '../../engine/index.js';
import { Seite } from '../../gemeinsam/seiten.js';
import { belohne } from '../../gemeinsam/sticker.js';
import {
  umhängen, bogen, gleitDauer, wähleNeu, misch, kurz, skalaFür, fläche, partyhütchen, keksglas, merkeKekse,
} from './helfer.js';

// ---------------------------------------------------------------- Maße
const STAND_Y = 968;                          // hier stehen die Dinge auf der Theke
const PLATTE = { x: -380, y: 950 };           // Mitte der Teigplatte
const KEKS_PLÄTZE = [-270, -90, 90, 270];     // Kekse auf der Platte (x zur Mitte)
const KEKS_BREITE = 180;
const NUDELHOLZ = { x: 100, y: STAND_Y - 40 };
const WERKZEUG_X = [170, 360, 550];           // Ausstecher, dann Guss-Schalen
const STREUER = { x: 360, y: STAND_Y };
const OFEN = { x: 810, y: STAND_Y + 6, s: 0.5 };
const GLAS = { x: -880, y: STAND_Y + 4, s: 0.72 };
const GAST = { x: -690, y: 1565, s: 0.62 };
const GAST_VON = -1580;
const FORMEN = ['stern', 'herz', 'mond', 'hase'];
const GUSS = {
  rosa: 0xf7a6c2, mint: 0xa6e2c8, gelb: 0xffe089, blau: 0xa9ccf6, weiss: 0xfffaf4, lila: 0xd2b8f2,
};
const STREUSEL_FARBEN = [0xf05a7e, 0x5ab0f0, 0xffc93c, 0x6ccf7a, 0xb57cf0, 0xffffff];
const KEKS_GÄSTE = ['hase', 'igel', 'eichhoernchen', 'maus', 'fuchs', 'ente', 'pinguin', 'hund', 'katze'];
const TORTEN_GÄSTE = ['baer', 'elefant', 'giraffe', 'kuh', 'pferd', 'affe', 'loewe', 'schwein', 'frosch', 'huhn'];
const GAST_SKALA = { maus: 0.5, igel: 0.56, ente: 0.56, frosch: 0.56, huhn: 0.56, giraffe: 0.56, elefant: 0.58 };

// Torte
const TORTE = { x: -170, y: STAND_Y };
const TELLER_SKALA = 1.1;
const BODEN_BREITE = 380;
const BODEN_HÖHE = 84;                        // so viel wächst die Torte je Boden
const STAPEL = { x: -590, y: STAND_Y };
const CREME_SCHALE = { x: 150, y: STAND_Y };
const FRUCHT_X = [330, 510];
const KERZEN_BECHER = { x: 420, y: STAND_Y };
const CREMES = [0xfbd0dc, 0xfffaf2, 0xc89a72, 0xc6ecd8, 0xfff0a8];
const FRÜCHTE = {
  erdbeere: { bild: 'common/futter_erdbeere', breite: 58 },
  kirschen: { bild: 'baeckerei/kirschen', breite: 66 },
  heidelbeeren: { bild: 'baeckerei/heidelbeeren', breite: 64 },
};
const KERZEN_FARBEN = [0xf6a8c0, 0xa8d8f6, 0xfff0a0, 0xbfe8b0, 0xd8c0f6];

export class Zuckerbaeckerei extends Seite {
  static hg = 'baeckerei/hg_zucker';

  aufbau() {
    this.uhr = 0;
    this.tonBis = {};
    this.r = null;
    this.letzteArt = null;
    this.gastVerlauf = [];
    this.formVerlauf = [];
    this.baueOfen();
    this.baueGlas();
    this.baueDeko();
    this.neueRunde({ erste: true });
  }

  betreten() {
    this._hinweis?.kill();
    this._hinweis = this.after(2.4, () => this.sageHinweis());
    if (this.r?.gast) this.after(1.0, () => { if (this.aktiv) this.zeigeWunsch(); });
  }

  verlassen() {
    this._hinweis?.kill();
    this._hinweis = null;
  }

  tonEinmal(id, sek, opt) {
    if (this.uhr < (this.tonBis[id] || 0)) return;
    this.tonBis[id] = this.uhr + sek;
    sfx(id, opt);
  }

  sageHinweis() {
    const r = this.r;
    if (!this.aktiv || !r) return;
    const ids = {
      ausrollen: 'baeckerei_ausrollen', ausstechen: 'baeckerei_ausstechen', guss: 'baeckerei_guss',
      boden: 'baeckerei_torte', pusten: 'baeckerei_pusten',
    };
    const phase = r.phase;
    const id = ids[phase];
    if (id) voice(id, { nurWenn: () => this.aktiv && this.r === r && r.phase === phase });
  }

  weiter(phase) {
    const r = this.r;
    r.phase = phase;
    this.after(0.6, () => { if (this.aktiv && this.r === r && r.phase === phase) this.sageHinweis(); });
  }

  // ---------------------------------------------------------------- feste Dinge: Ofen, Keksglas, Deko

  baueOfen() {
    const id = 'baeckerei/ofen';
    const m = meta(id);
    const o = spr(id, { parent: this.welt, x: OFEN.x, y: OFEN.y, z: 300 });
    o.scale.set(OFEN.s);
    this.ofen = o;
    const pt = (p) => ({ x: OFEN.x + (p[0] - m.ax * m.w) * OFEN.s, y: OFEN.y + (p[1] - m.ay * m.h) * OFEN.s });
    this.mund = pt(m.pts?.mund || [332, 470]);
    this.mundBoden = pt(m.pts?.mundboden || [332, 548]);
    this.schornstein = pt([415, 40]);
    tap(o, () => this.ofenAngetippt(), {
      sound: null, squash: false, hitArea: new PIXI.Rectangle(-m.ax * m.w - 30, -m.ay * m.h - 30, m.w + 60, m.h + 60),
    });
    const g = new PIXI.Graphics();
    const w = 78;
    g.roundRect(this.mund.x - w, this.mund.y - 48, 2 * w, 94, 46).fill({ color: 0xff7418, alpha: 0.55 });
    g.ellipse(this.mund.x, this.mundBoden.y - 20, w - 12, 36).fill({ color: 0xff9a2e, alpha: 0.6 });
    g.ellipse(this.mund.x, this.mundBoden.y - 13, w - 30, 20).fill({ color: 0xffd36a, alpha: 0.65 });
    g.alpha = 0;
    g.zIndex = 301;
    g.eventMode = 'none';
    this.welt.addChild(g);
    this.glut = g;
  }

  ofenAngetippt() {
    const r = this.r;
    if (r?.phase === 'backen') { this.backeKekse(); return; }
    fx.wobble(this.ofen, 0.03);
    this.tonEinmal('common/klack', 0.4, { vol: 0.3 });
    this.burst('rauch', this.schornstein.x, this.schornstein.y, { count: 1 });
  }

  baueGlas() {
    const c = new PIXI.Container({ label: 'keksglas', sortableChildren: true });
    c.position.set(GLAS.x, GLAS.y);
    this.welt.addChild(c);
    c.zIndex = 200;
    const inhalt = new PIXI.Container({ label: 'glasinhalt', sortableChildren: true });
    inhalt.zIndex = 1;
    c.addChild(inhalt);
    const glas = spr('baeckerei/keksglas', { parent: c, z: 2 });
    glas.scale.set(GLAS.s);
    const m = meta('baeckerei/keksglas');
    c.hitArea = new PIXI.Rectangle(-m.w * GLAS.s / 2 - 30, -m.h * GLAS.s - 20, m.w * GLAS.s + 60, m.h * GLAS.s + 40);
    tap(c, () => this.glasAngetippt(), { sound: null, squash: false });
    this.glas = { c, inhalt, glas };
    keksglas().forEach((k, i) => this.glasKeks(k, i, false));
  }

  // Platz des i-ten Kekses im Glas (unten beginnend, vier je Reihe, leicht versetzt)
  glasPlatz(i) {
    const reihe = Math.floor(i / 4);
    const spalte = i % 4;
    return { x: -72 + spalte * 46 + (reihe % 2) * 14, y: -48 - reihe * 52, rot: ((i * 37) % 9 - 4) * 0.12 };
  }

  glasKeks(k, i, neu) {
    const p = this.glasPlatz(i);
    const c = this.baueKeksBild(k.f, k.c, 0.3);
    c.position.set(p.x, p.y);
    c.rotation = p.rot;
    c.zIndex = i;
    c.eventMode = 'none';
    this.glas.inhalt.addChild(c);
    if (neu) {
      c.scale.set(0.1);
      this.tween(c.scale, { x: 0.3, y: 0.3 }, 0.4, { ease: 'backOut' });
    }
    return c;
  }

  glasAngetippt() {
    const r = this.r;
    if (r?.phase === 'glas') { this.allesInsGlas(); return; }
    fx.wobble(this.glas.c, 0.04);
    note('glocke', pick([79, 84, 88]), { vol: 0.25 });
  }

  baueDeko() {
    const zone = (x, y, w, h, fn) => {
      const c = new PIXI.Container({ label: 'deko' });
      c.position.set(x, y);
      c.hitArea = new PIXI.Rectangle(-w / 2, -h / 2, w, h);
      c.zIndex = 5;
      this.welt.addChild(c);
      tap(c, fn, { sound: null, squash: false });
    };
    // Fenster mit Blumen
    zone(-820, 420, 380, 440, () => {
      this.tonEinmal('common/wusch', 0.6, { vol: 0.25 });
      this.burst('blaetter', -930, 380, { count: 2 });
    });
    // Wimpelkette
    let ton = 0;
    zone(250, 120, 1300, 200, () => {
      note('pling', [79, 81, 84, 86, 88][ton++ % 5], { vol: 0.25 });
      this.burst('funkeln', 250 + rand(-500, 500), 160, { count: 2 });
    });
    // Regal mit Tortenständern
    zone(860, 440, 620, 300, () => {
      note('glocke', pick([84, 88, 91]), { vol: 0.25 });
      this.burst('funkeln', 860 + rand(-200, 200), 420, { count: 2 });
    });
    // Schranktüren unten: klopfen leise
    zone(0, 1300, 2400, 500, () => this.tonEinmal('common/klack', 0.3, { vol: 0.25 }));
  }

  // ---------------------------------------------------------------- Runde und Gast

  async neueRunde({ erste = false } = {}) {
    const art = erste || this.letzteArt === 'torte' ? 'kekse' : 'torte';
    this.letzteArt = art;
    const r = { art, phase: 'start', gast: null, fertig: false, dinge: [] };
    this.r = r;
    if (art === 'kekse') this.richteKekse(r);
    else this.richteTorte(r);
    // Der Gast kommt von links
    const tier = wähleNeu(art === 'kekse' ? KEKS_GÄSTE : TORTEN_GÄSTE, this.gastVerlauf, 3);
    const s = GAST_SKALA[tier] ?? GAST.s;
    const a = new Actor(tier, { x: erste ? GAST.x : GAST_VON, y: GAST.y, scale: s, parent: this.welt, z: 1500 });
    a.onTap(() => this.gastAngetippt(a), { pad: 30 });
    r.gast = a;
    if (art === 'torte') partyhütchen(this, a);
    if (!erste) {
      sfx('common/hupf', { vol: 0.35 });
      await a.walkTo(GAST.x, GAST.y, { tempo: 320 });
      if (this.r !== r || a.destroyed) return;
    }
    a.lookAt(art === 'kekse' ? PLATTE.x : TORTE.x);
    if (this.aktiv) this.after(0.3, () => this.zeigeWunsch());
    if (r.phase === 'start') this.weiter(art === 'kekse' ? 'ausrollen' : 'boden');
  }

  zeigeWunsch() {
    const r = this.r;
    const a = r?.gast;
    if (!a || a.destroyed || r.fertig) return;
    a.bubble(r.art === 'kekse' ? 'baeckerei/keks_' + (r.wunschForm || 'herz') : 'baeckerei/torte', 2.6, { seite: 'rechts' });
  }

  gastAngetippt(a) {
    const r = this.r;
    fx.wobble(a, 0.06);
    if (this.uhr > (this.gastLaut || 0)) { this.gastLaut = this.uhr + 1.2; a.sound(); }
    if (!r || r.gast !== a) return;
    if (r.phase === 'geben') { this.gibKeks(null); return; }
    if (r.phase === 'pusten') { this.pusten(); return; }
    this.zeigeWunsch();
  }

  async gastGeht(r) {
    const a = r.gast;
    if (!a || a.destroyed) return;
    a.bubble('common/p_herz', 1.2, { seite: 'rechts' });
    await this.wait(1.3);
    if (a.destroyed) return;
    await a.walkTo(GAST_VON, a.y, { tempo: 320 });
    if (!a.destroyed) a.destroy({ children: true });
  }

  // ================================================================ Kekse

  richteKekse(r) {
    r.formen = [];
    while (r.formen.length < 3) {
      const f = pick(FORMEN);
      if (!r.formen.includes(f)) r.formen.push(f);
    }
    r.wunschForm = pick(r.formen);
    r.farben = Object.keys(GUSS).sort(() => Math.random() - 0.5).slice(0, 3);
    r.kekse = [];
    r.walz = 0;
    r.letzteForm = null;
    // Teig und Platte
    const platte = new PIXI.Graphics();
    platte.position.set(PLATTE.x, PLATTE.y);
    platte.zIndex = 400;
    platte.eventMode = 'static';
    platte.hitArea = new PIXI.Rectangle(-320, -130, 640, 220);
    this.welt.addChild(platte);
    tap(platte, () => this.platteAngetippt(), { sound: null, squash: false });
    r.platte = platte;
    const teig = spr('baeckerei/teig', { parent: this.welt, x: PLATTE.x, y: STAND_Y + 4, z: 401 });
    teig.scale.set(0.62);
    teig.eventMode = 'none';
    r.teig = teig;
    this.zeichnePlatte();
    this.erscheine(teig, 0.62);
    // Nudelholz
    const nh = spr('baeckerei/nudelholz', { anchor: 0.5, parent: this.welt, x: NUDELHOLZ.x, y: NUDELHOLZ.y, z: 450 });
    nh.scale.set(0.62);
    nh.hitArea = fläche(nh, 230, 0.62);
    this.erscheine(nh, 0.62, 0.2);
    r.nudelholz = nh;
    let letzteX = null;
    r.nhZug = drag(nh, {
      back: false, lift: 1.06, sound: null,
      onStart: () => { letzteX = null; },
      onMove: (z, ctx) => {
        if (r.phase !== 'ausrollen') return;
        // über der Platte: jede Bewegung rollt den Teig flacher
        if (Math.abs(nh.y - PLATTE.y) < 200 && Math.abs(nh.x - PLATTE.x) < 380) {
          if (letzteX !== null) this.walze(Math.abs(nh.x - letzteX) / 1400);
          letzteX = nh.x;
        } else letzteX = null;
      },
      onDrop: (z, ctx) => {
        if (r.phase === 'ausrollen' && kurz(ctx)) { this.rolleEinmal(); return; }
        this.tween(nh, NUDELHOLZ, gleitDauer(NUDELHOLZ.x - nh.x, NUDELHOLZ.y - nh.y, 0.35, 3), { ease: 'cubicOut' });
      },
    });
  }

  // Ding weich erscheinen lassen
  erscheine(obj, s, verz = 0) {
    obj.alpha = 0;
    obj.scale.set(s * 0.4);
    this.tween(obj, { alpha: 1 }, 0.35, { ease: 'sineInOut', delay: verz });
    this.tween(obj, { scale: s }, 0.5, { ease: 'backOut', delay: verz });
  }

  verschwinde(obj, dauer = 0.4) {
    if (!obj || obj.destroyed) return;
    obj.eventMode = 'none';
    killTweensOf(obj);
    this.tween(obj, { alpha: 0 }, dauer, { ease: 'sineInOut' }).then(() => { if (!obj.destroyed) obj.destroy({ children: true }); });
  }

  zeichnePlatte() {
    const r = this.r;
    const g = r.platte;
    g.clear();
    const p = r.walz;
    if (p <= 0.01) return;
    const w = 200 + p * 520;
    const h = 70 + p * 80;
    const f = r.ausgestochen || [];
    g.ellipse(0, 10, w / 2 + 6, h / 2 + 6).fill({ color: 0x8a6a40, alpha: 0.12 });
    g.roundRect(-w / 2, -h / 2, w, h, h / 2).fill(0xf3dcae).stroke({ width: 5, color: 0xdcb880 });
    g.roundRect(-w / 2 + 20, -h / 2 + 10, w * 0.5, 12, 6).fill({ color: 0xffffff, alpha: 0.35 });
    // ein paar Mehlpünktchen (feste Plätze)
    for (let i = 0; i < 9; i++) {
      const x = ((i * 97) % 100 - 50) / 100 * w * 0.8;
      const y = ((i * 61) % 100 - 50) / 100 * h * 0.6;
      g.circle(x, y, 5).fill({ color: 0xffffff, alpha: 0.5 });
    }
    // ausgestochene Löcher (dort, wo schon ein Keks heraus ist)
    for (const x of f) g.ellipse(x, 2, 78, 46).fill({ color: 0xe2c08c, alpha: 0.9 });
  }

  walze(d) {
    const r = this.r;
    if (r.phase !== 'ausrollen') return;
    const vorher = r.walz;
    r.walz = clamp(r.walz + d, 0, 1);
    if (Math.floor(r.walz * 6) > Math.floor(vorher * 6)) this.tonEinmal('common/wisch', 0.4, { vol: 0.3 });
    if (r.teig && !r.teig.destroyed) {
      r.teig.scale.set(0.62 * (1 - r.walz * 0.9));
      r.teig.alpha = 1 - r.walz;
    }
    this.zeichnePlatte();
    if (r.walz >= 1) this.ausgerollt();
  }

  async rolleEinmal() {
    const r = this.r;
    if (r.phase !== 'ausrollen' || r.rollt) return;
    r.rollt = true;
    const nh = r.nudelholz;
    killTweensOf(nh);
    await bogen(this, nh, PLATTE.x - 200, PLATTE.y - 20, { dauer: 0.4, höhe: 60 });
    let vor = nh.x;
    await this.tween(nh, { x: PLATTE.x + 200 }, 0.7, {
      ease: 'sineInOut', onUpdate: () => { this.walze(Math.abs(nh.x - vor) / 900); vor = nh.x; },
    });
    if (r.phase === 'ausrollen') {
      vor = nh.x;
      await this.tween(nh, { x: PLATTE.x - 60 }, 0.6, {
        ease: 'sineInOut', onUpdate: () => { this.walze(Math.abs(nh.x - vor) / 900); vor = nh.x; },
      });
    }
    r.rollt = false;
    if (r.phase === 'ausrollen') this.tween(nh, NUDELHOLZ, 0.5, { ease: 'sineInOut' });
  }

  ausgerollt() {
    const r = this.r;
    r.phase = 'warten';
    if (r.teig && !r.teig.destroyed) this.verschwinde(r.teig, 0.2);
    r.teig = null;
    sfx('common/funkeln', { vol: 0.35 });
    this.burst('staub', PLATTE.x, PLATTE.y - 20, { count: 3 });
    r.nhZug?.off();
    const nh = r.nudelholz;
    killTweensOf(nh);
    this.tween(nh, { x: NUDELHOLZ.x, y: NUDELHOLZ.y }, 0.5, { ease: 'sineInOut' }).then(() => this.verschwinde(nh, 0.4));
    // die Ausstecher kommen
    r.ausstecher = r.formen.map((f, i) => this.stelleAusstecher(f, i));
    this.weiter('ausstechen');
  }

  stelleAusstecher(form, i) {
    const r = this.r;
    const id = 'baeckerei/ausstecher_' + form;
    const sp = spr(id, { anchor: 0.5, parent: this.welt, x: WERKZEUG_X[i], y: STAND_Y - 70, z: 460 + i });
    const s = 175 / (meta(id).w || 320);
    sp.hitArea = fläche(sp, 220, s);
    this.erscheine(sp, s, i * 0.15);
    note('glocke', [76, 79, 84][i], { vol: 0.2 });
    const a = { form, sp, s, heim: { x: WERKZEUG_X[i], y: STAND_Y - 70 } };
    tap(sp, () => this.steche(a), { sound: null, squash: false });
    return a;
  }

  platteAngetippt() {
    const r = this.r;
    if (r.phase === 'ausrollen') { this.rolleEinmal(); return; }
    if (r.phase === 'ausstechen') {
      const a = r.ausstecher.find((x) => x.form === r.letzteForm) || r.ausstecher[0];
      this.steche(a);
    }
  }

  // Ein Ausstecher sticht einen Keks aus der Platte (der Stand ändert sich sofort, das Bild folgt)
  async steche(a) {
    const r = this.r;
    if (!r || r.phase !== 'ausstechen' || a.sp.destroyed) { fx.wobble(a.sp, 0.06); return; }
    if (a.unterwegs || r.kekse.length >= KEKS_PLÄTZE.length) return;
    const i = r.kekse.length;
    a.unterwegs = true;
    r.letzteForm = a.form;
    const keks = { form: a.form, farbe: null, c: null, gebacken: false, glasiert: false, gestreut: false, weg: false, i };
    r.kekse.push(keks);
    const ziel = { x: PLATTE.x + KEKS_PLÄTZE[i], y: PLATTE.y };
    const sp = a.sp;
    killTweensOf(sp);
    sp.zIndex = 700;
    await bogen(this, sp, ziel.x, ziel.y - 70, { dauer: 0.4, höhe: 80 });
    await this.tween(sp, { y: ziel.y }, 0.15, { ease: 'quadIn' });
    sfx('common/klack', { vol: 0.5 });
    // Keks erscheint, die Stelle in der Platte wird ein Loch
    r.ausgestochen = [...(r.ausgestochen || []), KEKS_PLÄTZE[i]];
    keks.c = this.baueKeks(keks, ziel);
    await this.tween(sp, { y: ziel.y - 90 }, 0.2, { ease: 'quadOut' });
    await bogen(this, sp, a.heim.x, a.heim.y, { dauer: 0.4, höhe: 80 });
    sp.zIndex = 460;
    a.unterwegs = false;
    if (this.r !== r) return;
    if (r.kekse.length >= KEKS_PLÄTZE.length && r.phase === 'ausstechen' && r.kekse.every((k) => k.c)) this.ausgestochen();
  }

  // Bild eines Kekses: gebacken (unten), roh (darüber, blendet beim Backen aus), Guss, Streusel
  baueKeksBild(form, farbe, s) {
    const c = new PIXI.Container({ label: 'keks' });
    const back = spr('baeckerei/keks_' + form, { anchor: 0.5, parent: c });
    const roh = spr('baeckerei/keks_' + form + '_roh', { anchor: 0.5, parent: c });
    roh.alpha = farbe === null ? 1 : 0;
    const guss = spr('baeckerei/guss_' + form, { anchor: 0.5, parent: c });
    guss.tint = farbe ?? 0xffffff;
    guss.visible = farbe !== null;
    const streusel = new PIXI.Graphics();
    c.addChild(streusel);
    if (farbe !== null) this.zeichneStreusel(streusel, form, 1);
    c.scale.set(s);
    c.teile = { back, roh, guss, streusel };
    return c;
  }

  baueKeks(keks, ort) {
    const s = KEKS_BREITE / 300;
    const c = this.baueKeksBild(keks.form, null, s);
    c.position.set(ort.x, ort.y);
    c.zIndex = 420 + keks.i;
    c.hitArea = new PIXI.Rectangle(-135 / s, -135 / s, 270 / s, 270 / s);   // 270 Einheiten (Kekse liegen eng)
    this.welt.addChild(c);
    c.scale.set(s * 0.5);
    this.tween(c.scale, { x: s, y: s }, 0.35, { ease: 'backOut' });
    keks.s = s;
    keks.heim = { x: ort.x, y: ort.y };
    keks.zug = drag(c, {
      back: false, lift: 1.1,
      targets: () => {
        const r = this.r;
        const l = [];
        if (r.phase === 'geben' && r.gast && !r.gast.destroyed) l.push({ id: 'gast', ...this.maul(r.gast), radius: 300 });
        if (r.phase === 'glas') l.push({ id: 'glas', x: GLAS.x, y: GLAS.y - 150, radius: 280 });
        return l;
      },
      onDrop: (ziel, ctx) => this.keksLosgelassen(keks, ziel, ctx),
    });
    return c;
  }

  keksLosgelassen(keks, ziel, ctx) {
    const r = this.r;
    if (keks.weg) return;
    if (r.phase === 'geben' && (ziel?.id === 'gast' || kurz(ctx))) { this.gibKeks(keks); return; }
    if (r.phase === 'glas' && (ziel?.id === 'glas' || kurz(ctx))) { this.allesInsGlas(); return; }
    if (kurz(ctx)) this.keksAngetippt(keks);
    const c = keks.c;
    this.tween(c, keks.heim, gleitDauer(keks.heim.x - c.x, keks.heim.y - c.y, 0.3, 3), { ease: 'cubicOut' });
  }

  keksAngetippt(keks) {
    const r = this.r;
    if (r.phase === 'backen') { this.backeKekse(); return; }
    if (r.phase === 'guss') { this.gieße(r.letzteFarbe || r.farben[0], keks); return; }
    if (r.phase === 'streusel') { this.streue(); return; }
    note('xylo', pick([72, 74, 76, 79]), { vol: 0.25 });
  }

  maul(a) {
    return a.point('mouth') || { x: a.x + 40, y: a.y - 200 };
  }

  ausgestochen() {
    const r = this.r;
    r.phase = 'warten';
    for (const a of r.ausstecher) this.verschwinde(a.sp);
    // Restteig weg
    const g = r.platte;
    g.eventMode = 'none';
    this.tween(g, { alpha: 0 }, 0.6, { ease: 'sineInOut', delay: 0.3 }).then(() => { if (!g.destroyed) g.destroy(); });
    this.after(0.9, () => {
      if (this.r !== r) return;
      this.weiter('backen');
      if (this.aktiv) fx.pop(this.ofen, 0.06);
    });
  }

  // Die Kekse hüpfen in den Ofen, werden goldbraun und hüpfen wieder heraus
  async backeKekse() {
    const r = this.r;
    if (r.phase !== 'backen') return;
    r.phase = 'imOfen';
    const kekse = r.kekse;
    for (const k of kekse) { k.zug?.off(); k.c.eventMode = 'none'; }
    for (let i = 0; i < kekse.length; i++) {
      const k = kekse[i];
      const c = k.c;
      c.zIndex = 800;
      const zx = this.mund.x - 66 + i * 44;
      bogen(this, c, zx, this.mundBoden.y - 26, { dauer: 0.55, höhe: 160, skala: k.s * 0.32 })
        .then(() => { if (!c.destroyed) c.zIndex = 302 + i; });
      note('xylo', [72, 76, 79, 84][i], { vol: 0.22 });
      await this.wait(0.22);
    }
    await this.wait(0.6);
    if (this.r !== r) return;
    killTweensOf(this.glut);
    this.tween(this.glut, { alpha: 1 }, 1.0, { ease: 'sineInOut' });
    this.burst('rauch', this.schornstein.x, this.schornstein.y, { count: 1 });
    for (const k of kekse) {
      this.tween(k.c.teile.roh, { alpha: 0 }, 2.2, { ease: 'sineInOut', delay: 0.4 });
    }
    await this.wait(2.8);
    if (this.r !== r) return;
    note('glocke', 84, { vol: 0.28 });
    this.after(0.35, () => note('glocke', 88, { vol: 0.28 }));
    this.tween(this.glut, { alpha: 0 }, 1.2, { ease: 'sineInOut' });
    for (let i = 0; i < kekse.length; i++) {
      const k = kekse[i];
      k.gebacken = true;
      k.c.zIndex = 800;
      bogen(this, k.c, k.heim.x, k.heim.y, { dauer: 0.6, höhe: 160, skala: k.s })
        .then(() => { if (!k.c.destroyed) k.c.zIndex = 420 + k.i; });
      await this.wait(0.2);
    }
    await this.wait(0.7);
    if (this.r !== r) return;
    this.burst('rauch', PLATTE.x - 100, PLATTE.y - 60, { count: 1 });
    this.burst('rauch', PLATTE.x + 120, PLATTE.y - 60, { count: 1 });
    for (const k of kekse) {
      k.c.eventMode = 'static';
      k.zug = drag(k.c, {
        back: false, lift: 1.1,
        targets: () => {
          const l = [];
          if (r.phase === 'geben' && r.gast && !r.gast.destroyed) l.push({ id: 'gast', ...this.maul(r.gast), radius: 300 });
          if (r.phase === 'glas') l.push({ id: 'glas', x: GLAS.x, y: GLAS.y - 150, radius: 280 });
          return l;
        },
        onDrop: (ziel, ctx) => this.keksLosgelassen(k, ziel, ctx),
      });
    }
    // Guss-Schalen
    r.schalen = r.farben.map((f, i) => this.stelleSchale(f, i));
    this.weiter('guss');
  }

  stelleSchale(name, i) {
    const r = this.r;
    const farbe = GUSS[name];
    const c = new PIXI.Container({ label: 'guss_' + name });
    const s = 0.46;
    const b = spr('baeckerei/schuessel', { parent: c });
    b.scale.set(s);
    const m = meta('baeckerei/schuessel');
    const innen = m.pts?.innen || [210, 100];
    const ix = (innen[0] - m.ax * m.w) * s;
    const iy = (innen[1] - m.ay * m.h) * s;
    const g = new PIXI.Graphics();
    g.ellipse(ix, iy + 10, 76, 20).fill(farbe).stroke({ width: 3, color: misch(farbe, 0x6a4a3a, 0.25) });
    g.ellipse(ix - 18, iy + 6, 18, 5).fill({ color: 0xffffff, alpha: 0.6 });
    c.addChild(g);
    c.position.set(WERKZEUG_X[i], STAND_Y);
    c.zIndex = 460 + i;
    c.hitArea = new PIXI.Rectangle(-125, -200, 250, 225);
    this.welt.addChild(c);
    this.erscheine(c, 1, i * 0.15);
    const schale = { name, farbe, c };
    tap(c, () => this.gieße(name), { sound: null, squash: false });
    return schale;
  }

  // Guss auf den nächsten Keks (oder auf den angetippten)
  gieße(name, keks = null) {
    const r = this.r;
    if (r.phase !== 'guss') {
      const s = r.schalen?.find((x) => x.name === name);
      if (s) fx.wobble(s.c, 0.05);
      return;
    }
    const k = keks && !keks.glasiert ? keks : r.kekse.find((x) => !x.glasiert);
    if (!k) return;
    k.glasiert = true;
    r.letzteFarbe = name;
    const farbe = GUSS[name];
    k.farbe = farbe;
    const schale = r.schalen.find((x) => x.name === name);
    if (schale) fx.pop(schale.c, 0.08);
    // ein Klecks fliegt aus der Schale auf den Keks und verläuft weich
    const klecks = new PIXI.Graphics();
    klecks.circle(0, 0, 26).fill(farbe).stroke({ width: 3, color: misch(farbe, 0x6a4a3a, 0.2) });
    klecks.circle(-8, -8, 7).fill({ color: 0xffffff, alpha: 0.6 });
    const von = schale ? { x: schale.c.x, y: schale.c.y - 110 } : { x: k.c.x, y: k.c.y - 200 };
    klecks.position.set(von.x, von.y);
    klecks.zIndex = 900;
    klecks.eventMode = 'none';
    this.welt.addChild(klecks);
    bogen(this, klecks, k.c.x, k.c.y - 4, { dauer: 0.45, höhe: 120 }).then(() => {
      if (!klecks.destroyed) klecks.destroy();
      if (k.c.destroyed) return;
      sfx('common/plopp', { vol: 0.45 });
      const gs = k.c.teile.guss;
      gs.tint = farbe;
      gs.visible = true;
      gs.scale.set(0.3);
      gs.alpha = 0.6;
      this.tween(gs.scale, { x: 1, y: 1 }, 0.5, { ease: 'backOut' });
      this.tween(gs, { alpha: 1 }, 0.4, { ease: 'sineInOut' });
      if (this.r === r && r.phase === 'guss' && r.kekse.every((x) => x.glasiert)) this.zumStreuen();
    });
  }

  zumStreuen() {
    const r = this.r;
    r.phase = 'warten';
    this.after(0.6, () => {
      if (this.r !== r) return;
      for (const s of r.schalen) this.verschwinde(s.c);
      const st = spr('baeckerei/streuer', { parent: this.welt, x: STREUER.x, y: STREUER.y, z: 470 });
      const s = 0.8;
      st.hitArea = fläche(st, 230, s);
      this.erscheine(st, s, 0.3);
      r.streuer = st;
      r.streuerS = s;
      // Tippfläche erst anmelden, wenn der Streuer ganz da ist (der Kern misst sie nach 0,5 s);
      // bis dahin streut auch ein Tipp auf einen Keks
      this.after(0.85, () => { if (!st.destroyed) tap(st, () => this.streue(), { sound: null, squash: false }); });
      r.phase = 'streusel';
    });
  }

  // feste, zufällige Streusel auf einem Keks (in Koordinaten des Keks-Bildes, 300er Maß)
  zeichneStreusel(g, form, anteil) {
    g.clear();
    const n = Math.round(12 * anteil);
    // Saat aus allen Zeichen (Form + Nummer), damit jeder Keks eigene Streusel hat
    let saat = 3;
    for (const ch of String(form)) saat = (saat * 31 + ch.charCodeAt(0)) % 233280;
    const zufall = () => { saat = (saat * 9301 + 49297) % 233280; return saat / 233280; };
    // kurze Stäbchen, jedes mit eigener Drehung
    for (let i = 0; i < n; i++) {
      const x = (zufall() - 0.5) * 150;
      const y = (zufall() - 0.5) * 140;
      const w = zufall() * Math.PI;
      const f = STREUSEL_FARBEN[i % STREUSEL_FARBEN.length];
      const dx = Math.cos(w) * 17;
      const dy = Math.sin(w) * 17;
      g.moveTo(x - dx, y - dy).lineTo(x + dx, y + dy).stroke({ width: 14, color: f, cap: 'round' });
    }
  }

  async streue() {
    const r = this.r;
    if (r.phase !== 'streusel' || r.streut) {
      if (r.streuer && !r.streuer.destroyed && !r.streut) fx.wobble(r.streuer, 0.05);
      return;
    }
    r.streut = true;
    const st = r.streuer;
    killTweensOf(st);
    st.zIndex = 900;
    for (const k of r.kekse) {
      if (k.c.destroyed) continue;
      await bogen(this, st, k.c.x + 20, k.c.y - 110, { dauer: 0.35, höhe: 50 });
      if (st.destroyed) return;
      await this.tween(st, { rotation: 2.6 }, 0.2, { ease: 'sineInOut' });
      this.tonEinmal('common/sand', 0.4, { vol: 0.35 });
      const p = { a: 0 };
      await this.tween(p, { a: 1 }, 0.35, {
        ease: 'linear', onUpdate: () => { if (!k.c.destroyed) this.zeichneStreusel(k.c.teile.streusel, k.form + k.i, p.a); },
      });
      k.gestreut = true;
      await this.tween(st, { rotation: 0 }, 0.15, { ease: 'sineInOut' });
    }
    await bogen(this, st, STREUER.x, STREUER.y, { dauer: 0.45, höhe: 60 });
    if (this.r !== r) return;
    this.verschwinde(st, 0.5);
    sfx('common/funkeln', { vol: 0.4 });
    for (const k of r.kekse) this.burst('funkeln', k.c.x, k.c.y - 20, { count: 1 });
    // Gibt es die Wunsch-Form nicht (das Kind hat andere ausgestochen), wünscht sich der Gast einen, der da ist
    if (!r.kekse.some((k) => !k.weg && k.form === r.wunschForm)) r.wunschForm = r.kekse.find((k) => !k.weg)?.form || r.wunschForm;
    this.weiter('geben');
    this.after(0.5, () => { if (this.aktiv && r.phase === 'geben') this.zeigeWunsch(); });
  }

  // Ein Keks für den Gast (am liebsten die Wunsch-Form; jeder Keks ist willkommen)
  async gibKeks(keks) {
    const r = this.r;
    if (r.phase !== 'geben') return;
    const a = r.gast;
    if (!a || a.destroyed) return;
    const k = keks && !keks.weg ? keks
      : r.kekse.find((x) => !x.weg && x.form === r.wunschForm) || r.kekse.find((x) => !x.weg);
    if (!k) return;
    r.phase = 'isst';
    k.weg = true;
    k.zug?.off();
    const c = k.c;
    c.eventMode = 'none';
    killTweensOf(c);
    c.zIndex = 1600;
    const m = this.maul(a);
    await bogen(this, c, m.x, m.y, { dauer: 0.5, höhe: 90, skala: k.s * 0.9 });
    if (a.destroyed || c.destroyed) return;
    a.pose('eat');
    for (let i = 0; i < 2; i++) {
      sfx('common/mampf', { vol: 0.6 });
      await this.tween(c.scale, { x: c.scale.x * 0.7, y: c.scale.y * 0.7 }, 0.3, { ease: 'sineInOut' });
      await this.wait(0.14);
    }
    await this.tween(c, { alpha: 0 }, 0.25);
    if (!c.destroyed) c.destroy({ children: true });
    if (a.destroyed) return;
    a.cheer({ parent: this.vorn });
    if (k.form === r.wunschForm) this.after(0.6, () => { if (!a.destroyed) a.hop(60); });
    await this.wait(1.0);
    if (this.r !== r) return;
    this.weiter('glas');
    if (this.aktiv) fx.pop(this.glas.c, 0.05);
  }

  async allesInsGlas() {
    const r = this.r;
    if (r.phase !== 'glas') return;
    r.phase = 'insGlas';
    const übrig = r.kekse.filter((k) => !k.weg && !k.c.destroyed);
    const neu = [];
    let n = keksglas().length;
    for (const k of übrig) {
      k.weg = true;
      k.zug?.off();
      const c = k.c;
      c.eventMode = 'none';
      killTweensOf(c);
      c.zIndex = 1600;
      // Ist das Glas voll, rücken die ältesten Kekse weg (nur die letzten 16 bleiben)
      const platz = this.glasPlatz(Math.min(n, 15));
      await bogen(this, c, GLAS.x + platz.x, GLAS.y - 330, { dauer: 0.45, höhe: 100, skala: k.s });
      if (c.destroyed) return;
      note('glocke', [79, 81, 84, 88][neu.length % 4], { vol: 0.25 });
      c.destroy({ children: true });
      neu.push({ f: k.form, c: k.farbe ?? GUSS.weiss });
      n++;
    }
    if (this.r !== r) return;
    merkeKekse(neu);
    // Glas neu füllen (verschobene Plätze, wenn es voll war)
    this.glas.inhalt.removeChildren().forEach((x) => x.destroy({ children: true }));
    const liste = keksglas();
    liste.forEach((k, i) => this.glasKeks(k, i, i >= liste.length - neu.length));
    sfx('common/landen', { vol: 0.4 });
    fx.wobble(this.glas.c, 0.04);
    this.rundeGeschafft('baeckerei_keks', GLAS.x + 200, GLAS.y - 380);
  }

  // ================================================================ Torte

  richteTorte(r) {
    r.böden = pick([2, 2, 3]);
    r.creme = pick(CREMES);
    r.fruchtSorten = Object.keys(FRÜCHTE).sort(() => Math.random() - 0.5).slice(0, 2);
    r.kerzenFarbe = pick(KERZEN_FARBEN);
    r.gelegt = 0;       // Böden auf der Platte
    r.gecremt = 0;      // davon mit Creme
    r.früchte = [];
    r.kerzen = [];
    // Tortenplatte und der Torten-Container (wächst nach oben)
    const t = new PIXI.Container({ label: 'torte', sortableChildren: true });
    t.position.set(TORTE.x, TORTE.y);
    t.zIndex = 400;
    this.welt.addChild(t);
    const teller = spr('baeckerei/tortenteller', { parent: t, z: 0 });
    teller.scale.set(TELLER_SKALA);
    const tm = meta('baeckerei/tortenteller');
    r.tortenBasis = -(tm.ay * tm.h - 64) * TELLER_SKALA;   // Oberfläche der Platte
    t.hitArea = new PIXI.Rectangle(-260, r.tortenBasis - 460, 520, 500 - r.tortenBasis);
    tap(t, () => this.torteAngetippt(), { sound: null, squash: false });
    r.torte = t;
    this.erscheine(t, 1);
    // Stapel mit Böden
    r.stapel = [];
    const bs = BODEN_BREITE / (meta('baeckerei/tortenboden').w || 360) * 0.7;
    for (let i = 0; i < r.böden; i++) {
      const b = spr('baeckerei/tortenboden', { anchor: 0.5, parent: this.welt, x: STAPEL.x, y: STAPEL.y - 60 - i * 52, z: 410 + i });
      b.eventMode = 'none';
      this.erscheine(b, bs, i * 0.12);
      r.stapel.push(b);
    }
    const sc = new PIXI.Container({ label: 'stapel' });
    sc.position.set(STAPEL.x, STAPEL.y - 100);
    sc.hitArea = new PIXI.Rectangle(-150, -170, 300, 290);
    sc.zIndex = 430;
    this.welt.addChild(sc);
    r.stapelFläche = sc;
    r.stapelZug = drag(sc, {
      back: false, lift: 1, sound: null,
      targets: () => [{ id: 'torte', x: TORTE.x, y: TORTE.y - 200, radius: 300 }],
      onMove: (z, ctx) => {
        // der oberste Boden folgt dem Finger
        const b = r.stapel[r.stapel.length - 1];
        if (b && !b.destroyed && r.phase === 'boden') b.position.set(ctx.x, ctx.y + 40);
        sc.position.set(ctx.startX, ctx.startY);
      },
      onDrop: (z, ctx) => {
        sc.position.set(ctx.startX, ctx.startY);
        if (r.phase === 'boden' && (z || kurz(ctx))) { this.legeBoden(); return; }
        const b = r.stapel[r.stapel.length - 1];
        if (b && !b.destroyed) this.tween(b, { x: STAPEL.x, y: STAPEL.y - 60 - (r.stapel.length - 1) * 52 }, 0.35, { ease: 'cubicOut' });
      },
    });
    // Creme-Schale
    r.cremeSchale = this.baueCremeSchale(r.creme);
    // Ebene für Creme und Belag auf der Torte
    r.schichten = [];
  }

  baueCremeSchale(farbe) {
    const c = new PIXI.Container({ label: 'creme' });
    const s = 0.5;
    const b = spr('baeckerei/schuessel', { parent: c });
    b.scale.set(s);
    const m = meta('baeckerei/schuessel');
    const innen = m.pts?.innen || [210, 100];
    const ix = (innen[0] - m.ax * m.w) * s;
    const iy = (innen[1] - m.ay * m.h) * s;
    const g = new PIXI.Graphics();
    g.ellipse(ix, iy + 12, 82, 22).fill(farbe).stroke({ width: 3, color: misch(farbe, 0x6a4a3a, 0.25) });
    // ein Creme-Häubchen
    g.circle(ix + 10, iy + 2, 24).fill(farbe).stroke({ width: 3, color: misch(farbe, 0x6a4a3a, 0.2) });
    g.circle(ix + 2, iy - 6, 8).fill({ color: 0xffffff, alpha: 0.6 });
    c.addChild(g);
    c.position.set(CREME_SCHALE.x, CREME_SCHALE.y);
    c.zIndex = 450;
    c.hitArea = new PIXI.Rectangle(-130, -230, 260, 250);
    this.welt.addChild(c);
    this.erscheine(c, 1, 0.3);
    tap(c, () => this.cremeDrauf(), { sound: null, squash: false });
    return c;
  }

  // Höhe der Torte (Oberkante) im Torten-Container
  torteOben(n = this.r.gelegt) {
    return this.r.tortenBasis - 24 - n * BODEN_HÖHE;
  }

  torteAngetippt() {
    const r = this.r;
    switch (r.phase) {
      case 'boden': this.legeBoden(); break;
      case 'creme': this.cremeDrauf(); break;
      case 'früchte': this.legeFrucht(r.fruchtSorten[r.früchte.length % 2]); break;
      case 'kerzen': this.steckeKerze(); break;
      case 'anzünden': this.zündeAn(); break;
      default:
        fx.wobble(r.torte, 0.03);
        this.tonEinmal('common/plopp', 0.4, { vol: 0.3 });
    }
  }

  async legeBoden() {
    const r = this.r;
    if (r.phase !== 'boden' || r.legt) return;
    const b = r.stapel.pop();
    if (!b) return;
    r.legt = true;
    killTweensOf(b);
    b.zIndex = 900;
    const n = r.gelegt;
    const s = BODEN_BREITE / (meta('baeckerei/tortenboden').w || 360);
    // Ziel: Mitte des Bodens im Torten-Container → Welt
    const zy = r.torte.y + this.torteOben(n) + 52;
    await bogen(this, b, r.torte.x, zy - 50, { dauer: 0.55, höhe: 120, skala: s });
    await this.tween(b, { y: zy }, 0.2, { ease: 'quadIn' });
    if (b.destroyed || this.r !== r) return;
    umhängen(b, r.torte);
    b.zIndex = 10 + n * 10;
    sfx('common/landen', { vol: 0.5 });
    r.gelegt++;
    r.legt = false;
    this.burst('funkeln', r.torte.x, zy - 40, { count: 1 });
    this.weiter('creme');
    this.after(0.4, () => { if (this.aktiv && r.phase === 'creme') fx.pop(r.cremeSchale, 0.08); });
  }

  async cremeDrauf() {
    const r = this.r;
    if (r.phase !== 'creme' || r.cremt) { fx.wobble(r.cremeSchale, 0.04); return; }
    r.cremt = true;
    const n = r.gelegt;
    const y = this.torteOben(n) + BODEN_HÖHE + 2;     // Oberfläche des obersten Bodens (im Torten-Container)
    // Klecks fliegt aus der Schale
    const k = new PIXI.Graphics();
    k.circle(0, 0, 34).fill(r.creme).stroke({ width: 3, color: misch(r.creme, 0x6a4a3a, 0.2) });
    k.position.set(r.cremeSchale.x, r.cremeSchale.y - 120);
    k.zIndex = 900;
    k.eventMode = 'none';
    this.welt.addChild(k);
    fx.pop(r.cremeSchale, 0.08);
    await bogen(this, k, r.torte.x, r.torte.y + y - 10, { dauer: 0.5, höhe: 130 });
    if (!k.destroyed) k.destroy();
    if (this.r !== r) return;
    // Creme verläuft weich über den Boden
    const g = new PIXI.Graphics();
    this.zeichneCreme(g, r.creme, n === r.böden);
    g.position.set(0, y);
    g.zIndex = 11 + (n - 1) * 10;
    g.scale.set(0.3, 0.3);
    g.eventMode = 'none';
    r.torte.addChild(g);
    r.schichten.push(g);
    sfx('common/wisch', { vol: 0.4 });
    await this.tween(g.scale, { x: 1, y: 1 }, 0.6, { ease: 'backOut' });
    r.gecremt++;
    r.cremt = false;
    if (this.r !== r) return;
    if (r.gelegt < r.böden) {
      this.weiter('boden');
      this.after(0.3, () => { if (this.aktiv && r.phase === 'boden') fx.pop(r.stapel[r.stapel.length - 1], 0.08); });
    } else {
      this.verschwinde(r.cremeSchale);
      r.stapelZug?.off();
      if (!r.stapelFläche.destroyed) r.stapelFläche.destroy();
      this.stelleFrüchte();
    }
  }

  // Creme-Schicht: obenauf eine weiche Fläche, vorn kleine Tropfen; die oberste mit Tupfen-Rand
  zeichneCreme(g, farbe, oben) {
    const rand_ = misch(farbe, 0x6a4a3a, 0.2);
    const rx = BODEN_BREITE / 2 - 4;
    // Nur die oberste Schicht läuft über den Rand: wenige weiche, runde Tropfen verschiedener Länge
    // (zuerst gezeichnet, damit die Fläche ihren oberen Teil überdeckt). Zwischenschichten sind eine Füllung,
    // die zwischen den Böden hervorschaut.
    if (oben) {
      const xs = [-0.78, -0.45, -0.12, 0.2, 0.5, 0.8];
      xs.forEach((t, i) => {
        const x = t * rx;
        const kante = 44 * Math.sqrt(Math.max(0, 1 - (x / rx) ** 2));
        const h = [22, 34, 18, 30, 24, 16][i];
        g.roundRect(x - 13, kante - 20, 26, h + 20, 13).fill(farbe);
        g.circle(x, kante + h - 4, 14).fill(farbe);
      });
    }
    g.ellipse(0, 0, rx, 44).fill(farbe).stroke({ width: 4, color: rand_ });
    g.ellipse(-rx * 0.4, -12, rx * 0.3, 9).fill({ color: 0xffffff, alpha: 0.45 });
    if (oben) {
      for (let i = 0; i < 8; i++) {
        const w = (i / 8) * Math.PI * 2;
        g.circle(Math.cos(w) * (rx - 26), Math.sin(w) * 26 - 4, 16).fill(misch(farbe, 0xffffff, 0.35)).stroke({ width: 3, color: rand_ });
      }
    }
  }

  stelleFrüchte() {
    const r = this.r;
    r.fruchtSchalen = r.fruchtSorten.map((name, i) => {
      const cfg = FRÜCHTE[name];
      const sp = spr(cfg.bild, { anchor: 0.5, parent: this.welt, x: FRUCHT_X[i], y: STAND_Y - 80, z: 460 + i });
      const s = skalaFür(cfg.bild, 150, 150);
      sp.hitArea = fläche(sp, 230, s);
      this.erscheine(sp, s, i * 0.15);
      tap(sp, () => this.legeFrucht(name), { sound: null, squash: false });
      return { name, sp };
    });
    this.weiter('früchte');
  }

  // Plätze für Früchte und Kerzen oben auf der Torte (im Torten-Container)
  obenPlatz(i, art) {
    const y = this.torteOben(r_gelegt(this.r)) + BODEN_HÖHE + 2;
    if (art === 'frucht') return { x: [-100, 0, 100][i], y: y + [6, 18, 6][i] };
    return { x: [-52, 0, 52][i], y: y - 2 + [4, 0, 4][i] };
  }

  async legeFrucht(name) {
    const r = this.r;
    if (r.phase !== 'früchte' || r.früchte.length >= 3) {
      const s = r.fruchtSchalen?.find((x) => x.name === name);
      if (s && !s.sp.destroyed) fx.wobble(s.sp, 0.05);
      return;
    }
    const i = r.früchte.length;
    const cfg = FRÜCHTE[name];
    const quelle = r.fruchtSchalen.find((x) => x.name === name);
    const sp = spr(cfg.bild, { anchor: 0.5, parent: this.welt, x: quelle.sp.x, y: quelle.sp.y, z: 900 });
    const s = skalaFür(cfg.bild, cfg.breite * 1.2, cfg.breite * 1.2);
    sp.scale.set(s);
    sp.eventMode = 'none';
    r.früchte.push(sp);
    fx.pop(quelle.sp, 0.08);
    const p = this.obenPlatz(i, 'frucht');
    await bogen(this, sp, r.torte.x + p.x, r.torte.y + p.y, { dauer: 0.5, höhe: 120 });
    if (sp.destroyed || this.r !== r) return;
    umhängen(sp, r.torte);
    sp.zIndex = 200 + i;
    sfx('common/plopp', { vol: 0.4 });
    note('glocke', [76, 79, 84][i], { vol: 0.22 });
    if (r.früchte.length >= 3 && r.phase === 'früchte') {
      r.phase = 'warten';
      this.after(0.5, () => {
        if (this.r !== r) return;
        for (const q of r.fruchtSchalen) this.verschwinde(q.sp);
        this.stelleKerzen();
      });
    }
  }

  stelleKerzen() {
    const r = this.r;
    // Becher mit drei Kerzen (gezeichnet)
    const c = new PIXI.Container({ label: 'kerzenbecher' });
    const g = new PIXI.Graphics();
    for (let i = 0; i < 3; i++) {
      const k = this.zeichneKerze(r.kerzenFarbe);
      k.position.set(-26 + i * 26, -70 - (i % 2) * 10);
      k.rotation = (i - 1) * 0.15;
      c.addChild(k);
    }
    g.roundRect(-60, -90, 120, 90, 24).fill(0xf6c6d4).stroke({ width: 5, color: 0xdc96aa });
    g.roundRect(-46, -80, 26, 60, 12).fill({ color: 0xffffff, alpha: 0.4 });
    c.addChild(g);
    c.position.set(KERZEN_BECHER.x, KERZEN_BECHER.y);
    c.zIndex = 460;
    c.hitArea = new PIXI.Rectangle(-120, -260, 240, 280);
    this.welt.addChild(c);
    this.erscheine(c, 1);
    tap(c, () => this.steckeKerze(), { sound: null, squash: false });
    r.becher = c;
    this.weiter('kerzen');
  }

  // Eine Kerze (gezeichnet, ruhige Flamme). Ursprung = Fuß der Kerze.
  zeichneKerze(farbe) {
    const c = new PIXI.Container({ label: 'kerze' });
    const g = new PIXI.Graphics();
    g.roundRect(-10, -76, 20, 78, 8).fill(0xfffaf4).stroke({ width: 3, color: misch(farbe, 0x6a4a3a, 0.3) });
    for (let i = 0; i < 3; i++) g.roundRect(-10, -64 + i * 24, 20, 8, 4).fill(farbe);
    g.moveTo(0, -76).lineTo(0, -86).stroke({ width: 3, color: 0x5a4a3a });
    c.addChild(g);
    const fl = new PIXI.Graphics();
    fl.ellipse(0, -104, 13, 22).fill(0xffc04a);
    fl.ellipse(0, -99, 6, 12).fill(0xfff1b0);
    fl.alpha = 0;
    fl.eventMode = 'none';
    c.addChild(fl);
    c.flamme = fl;
    c.eventMode = 'none';
    return c;
  }

  async steckeKerze() {
    const r = this.r;
    if (r.phase !== 'kerzen' || r.kerzen.length >= 3) return;
    const i = r.kerzen.length;
    const k = this.zeichneKerze(r.kerzenFarbe);
    k.position.set(r.becher.x, r.becher.y - 80);
    k.zIndex = 900;
    this.welt.addChild(k);
    r.kerzen.push(k);
    fx.pop(r.becher, 0.06);
    const p = this.obenPlatz(i, 'kerze');
    await bogen(this, k, r.torte.x + p.x, r.torte.y + p.y, { dauer: 0.5, höhe: 140 });
    if (k.destroyed || this.r !== r) return;
    umhängen(k, r.torte);
    k.zIndex = 190 + i;
    sfx('common/klack', { vol: 0.35 });
    if (r.kerzen.length >= 3 && r.phase === 'kerzen') {
      r.phase = 'warten';
      this.verschwinde(r.becher);
      this.after(0.4, () => { if (this.r === r) { r.phase = 'anzünden'; if (this.aktiv) fx.pop(r.torte, 0.04); } });
    }
  }

  async zündeAn() {
    const r = this.r;
    if (r.phase !== 'anzünden') return;
    r.phase = 'warten';
    for (let i = 0; i < r.kerzen.length; i++) {
      const fl = r.kerzen[i].flamme;
      fl.scale.set(0.3);
      // weich an (≥ 0,5 s), danach ganz langsames Wiegen
      this.tween(fl, { alpha: 1 }, 0.6, { ease: 'sineInOut' });
      this.tween(fl.scale, { x: 1, y: 1 }, 0.7, { ease: 'sineInOut' });
      note('glocke', [84, 88, 91][i], { vol: 0.2 });
      await this.wait(0.35);
    }
    if (this.r !== r) return;
    for (const k of r.kerzen) {
      const fl = k.flamme;
      fl.pivot.set(0, -86);
      fl.position.set(0, -86);
      this.tween(fl, { rotation: 0.06 }, 1.6, { ease: 'sineInOut', yoyo: true, repeat: -1 });
    }
    // ein leises Geburtstagslied
    const lied = [[67, 0], [67, 0.32], [69, 0.62], [67, 1.0], [72, 1.4], [71, 1.8]];
    for (const [m, t] of lied) this.after(t, () => { if (this.aktiv) note('glocke', m, { vol: 0.24 }); });
    await this.wait(1.4);
    if (this.r !== r) return;
    this.weiter('pusten');
    this.after(0.6, () => { if (this.aktiv && r.phase === 'pusten' && r.gast && !r.gast.destroyed) fx.pop(r.gast, 0.06); });
  }

  async pusten() {
    const r = this.r;
    if (r.phase !== 'pusten') return;
    r.phase = 'pustet';
    const a = r.gast;
    a.lookAt(r.torte.x);
    // Das Tier holt Luft (wird kurz größer) und pustet: ruhige Wölkchen ziehen zur Torte
    await this.tween(a.koerper.scale, { x: 1.06, y: 1.06 }, 0.4, { ease: 'sineInOut' });
    if (a.destroyed) return;
    this.tween(a.koerper.scale, { x: 1, y: 1 }, 0.5, { ease: 'sineInOut' });
    const m = this.maul(a);
    for (let i = 0; i < 3; i++) {
      this.after(i * 0.15, () => this.burst('rauch', lerp2(m.x, r.torte.x, 0.3 + i * 0.2), lerp2(m.y, r.torte.y - 300, 0.3 + i * 0.2), { count: 1 }));
    }
    sfx('common/wusch', { vol: 0.45 });
    await this.wait(0.5);
    for (const k of r.kerzen) {
      const fl = k.flamme;
      killTweensOf(fl);
      killTweensOf(fl.scale);
      this.tween(fl, { alpha: 0 }, 0.7, { ease: 'sineInOut' });
      this.tween(fl.scale, { x: 0.4, y: 0.4 }, 0.7, { ease: 'sineInOut' });
      const q = { x: r.torte.x + k.x, y: r.torte.y + k.y };
      this.after(0.5, () => this.burst('rauch', q.x, q.y - 110, { count: 1 }));
    }
    sfx('common/zisch', { vol: 0.3 });
    await this.wait(0.9);
    if (this.r !== r || a.destroyed) return;
    sfx('common/applaus', { vol: 0.35 });
    this.burst('konfetti', r.torte.x, r.torte.y - 380, { count: 8 });
    a.cheer({ parent: this.vorn });
    await this.wait(1.2);
    if (this.r !== r) return;
    this.rundeGeschafft('baeckerei_torte', r.torte.x + 300, r.torte.y - 420);
  }

  // ================================================================ Ende der Runde

  async rundeGeschafft(sticker, x, y) {
    const r = this.r;
    if (r.fertig) return;
    r.fertig = true;
    r.phase = 'fertig';
    await this.wait(0.3);
    await belohne(this, sticker, x, y);
    if (this.r !== r) return;
    await this.wait(0.8);
    if (r.art === 'torte' && r.gast && !r.gast.destroyed) {
      // Die Torte geht mit dem Geburtstagstier mit
      const t = r.torte;
      t.eventMode = 'none';
      t.zIndex = 1490;
      await bogen(this, t, r.gast.x + 150, r.gast.y - 20, { dauer: 0.8, höhe: 120, skala: 0.7 });
      const a = r.gast;
      const mit = () => { if (!t.destroyed && !a.destroyed) t.x = a.x + 150; };
      const uhr = this.every(0.016, mit);
      await this.gastGeht(r);
      uhr.kill?.();
      if (!t.destroyed) t.destroy({ children: true });
    } else {
      await this.gastGeht(r);
    }
    for (const sp of r.stapel || []) this.verschwinde(sp);
    await this.wait(0.5);
    if (this.r !== r) return;
    this.neueRunde();
  }

  // ---------------------------------------------------------------- Ablauf

  update(dt) {
    this.uhr += dt;
  }

  hinweise() {
    const r = this.r;
    if (!r) return [];
    const offen = (l) => l?.find((x) => x && !x.destroyed);
    switch (r.phase) {
      case 'ausrollen': return r.nudelholz && !r.nudelholz.destroyed
        ? [{ von: r.nudelholz, nach: { x: PLATTE.x - 120, y: PLATTE.y - 20 } }] : [];
      case 'ausstechen': {
        // am liebsten die Form, die sich der Gast wünscht
        const l = (r.ausstecher || []).filter((x) => !x.sp.destroyed);
        const a = l.find((x) => x.form === r.wunschForm) || l[0];
        return a ? [a.sp] : [];
      }
      case 'backen': return [this.ofen];
      case 'guss': { const s = r.schalen?.[0]; return s ? [s.c] : []; }
      case 'streusel': return r.streuer && !r.streuer.destroyed ? [r.streuer] : [];
      case 'geben': {
        const k = r.kekse.find((x) => !x.weg && !x.c.destroyed);
        return k && r.gast && !r.gast.destroyed ? [{ von: k.c, nach: this.maul(r.gast) }] : [];
      }
      case 'glas': return [this.glas.c];
      case 'boden': {
        const b = offen([...(r.stapel || [])].reverse());
        return b ? [{ von: b, nach: { x: r.torte.x, y: r.torte.y + this.torteOben() } }] : [];
      }
      case 'creme': return r.cremeSchale && !r.cremeSchale.destroyed ? [r.cremeSchale] : [];
      case 'früchte': { const s = r.fruchtSchalen?.find((x) => !x.sp.destroyed); return s ? [s.sp] : []; }
      case 'kerzen': return r.becher && !r.becher.destroyed ? [r.becher] : [];
      case 'anzünden': return [r.torte];
      case 'pusten': return r.gast && !r.gast.destroyed ? [r.gast] : [];
      default: return r.gast && !r.gast.destroyed ? [r.gast] : [];
    }
  }
}

function r_gelegt(r) { return r ? r.gelegt : 0; }
function lerp2(a, b, t) { return a + (b - a) * t; }
