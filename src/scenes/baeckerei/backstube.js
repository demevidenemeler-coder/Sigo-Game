// Seite 1: die Backstube – ein Backtag als Kette.
//   0. Das Bäcker-Tier (mit Bäckermütze) zeigt in der Denkblase, was heute gebacken wird: Brezeln, Brötchen,
//      Hörnchen oder Brote (jede Runde etwas anderes).
//   1. Zutaten: Mehl und zwei andere (Ei, Milch, Butter, Zucker – jede Runde eine andere Mischung) in die Schüssel
//      ziehen oder antippen. Mehl staubt, das Ei macht klack, die Milch gluckert.
//   2. Rühren: mit dem Finger in der Schüssel kreisen (oder den Schneebesen antippen) – es wird ein glatter Teig.
//   3. Kneten: Der Teig plumpst auf den Tisch. Draufdrücken (antippen) und ziehen – viermal.
//   4. Formen: Der Teig teilt sich in kleine Kugeln auf dem Blech. Antippen – jede wird zur Brezel, zum Brötchen …
//   5. In den Ofen: das Blech zum Ofen ziehen (oder antippen). Der Ofen glüht langsam warm, das Gebackene wird
//      vor den Augen goldbraun, aus dem Schornstein steigen ruhige Wölkchen, dann klingt die Ofenuhr.
//   6. Herausholen: den Ofen (oder das Blech) antippen – es duftet, das Bäcker-Tier schnuppert und freut sich.
//   7. In den Korb: das Blech zum Korb ziehen (oder antippen) – alles hüpft hinein, es gibt einen Sticker. Was
//      gebacken wurde, kommt im Laden (Seite 3) ins Wandregal – das Regal füllt sich über die Besuche.
// Überraschungen: Manchmal schaut eine kleine Maus aus dem leeren Korb und niest Mehl. Alle zwei Runden kommt ein
// anderes Bäcker-Tier. Nichts kann schiefgehen: Was daneben landet, gleitet zurück; jeder Tipp bringt weiter.

import { tap, drag, sfx, voice, note, fx, Actor, spr, meta, rand, pick, clamp, killTweensOf, PIXI } from '../../engine/index.js';
import { Seite } from '../../gemeinsam/seiten.js';
import { belohne } from '../../gemeinsam/sticker.js';
import {
  umhängen, bogen, gleitDauer, wähleNeu, misch, kurz, skalaFür, fläche, bäckermütze, merkeGebacken,
} from './helfer.js';
import { bauKorb } from './korb.js';

// ---------------------------------------------------------------- Maße (Seiten-Koordinaten)
const TISCH_Y = 935;                            // hier stehen die Dinge auf dem Tisch
const ZUTAT_X = [-960, -750, -540];
const SCHÜSSEL = { x: -250, y: TISCH_Y + 4, s: 0.85 };
const SCHÜSSEL_RUHE = { x: -660, y: TISCH_Y - 10, s: 0.62 };   // dort wartet die leere Schüssel
const TEIG = { x: -250, y: TISCH_Y + 6, s: 0.72 };
const BLECH = { x: 110, y: TISCH_Y - 44, s: 0.86 };
const OFEN = { x: 700, y: 1478, s: 0.92 };
const OFEN_BLECH_SKALA = 0.56;
const KORB = { x: -770, y: 1560, s: 0.8 };   // y = Unterkante
const KORB_PLÄTZE = [[112, 186], [244, 186], [178, 176], [140, 166], [216, 166]];
const HELFER_PLATZ = { x: 250, y: 1565 };
const HELFER_SKALA = 0.5;
const HELFER = ['baer', 'schwein', 'hund', 'katze', 'schaf'];
const RÜHR_ZIEL = Math.PI * 2 * 2;
const KNETEN = 4;
const TEIG_FARBE = 0xf2d6a2;

const ZUTATEN = {
  mehl: { bild: 'baeckerei/mehlsack', höhe: 240, farbe: 0xfbf7ee, art: 'schütten' },
  ei: { bild: 'baeckerei/ei', höhe: 160, farbe: 0xffbf2e, art: 'ei' },
  milch: { bild: 'baeckerei/milchkanne', höhe: 210, farbe: 0xfffbf2, art: 'giessen' },
  butter: { bild: 'baeckerei/butter', höhe: 140, farbe: 0xffe073, art: 'plumps' },
  zucker: { bild: 'baeckerei/zucker', höhe: 205, farbe: 0xffffff, art: 'schütten' },
};

// Was gebacken werden kann: Anzahl auf dem Blech, Breite eines Stücks
export const SORTEN = {
  brezel: { n: 3, breite: 150 },
  broetchen: { n: 3, breite: 125 },
  hoernchen: { n: 3, breite: 150 },
  brot: { n: 2, breite: 200 },
};

export class Backstube extends Seite {
  static hg = 'baeckerei/hg_backstube';

  aufbau() {
    this.uhr = 0;
    this.tonBis = {};
    this.r = null;
    this.runden = 0;
    this.sortenVerlauf = [];
    this.helferVerlauf = [];
    this.letzteMischung = '';
    this.mausBis = 0;
    this.baueSchüssel();
    this.baueOfen();
    this.baueBlech();
    const km = meta('common/icon_korb');
    this.korb = bauKorb(this, { x: KORB.x, y: KORB.y - (1 - km.ay) * km.h * KORB.s, scale: KORB.s, z: 1300 });
    this.korbMitte = { x: KORB.x, y: this.korb.c.y };
    tap(this.korb.c, () => this.korbAngetippt(), { sound: null, squash: false });
    this.baueMaus();
    this.baueDeko();
    this.helfer = this.neuerHelfer(HELFER_PLATZ.x);
    this.neueRunde({ erste: true });
  }

  betreten() {
    this._hinweis?.kill();
    if (this.besuche === 1) voice('baeckerei_hallo');
    this._hinweis = this.after(this.besuche === 1 ? 3.4 : 2.2, () => this.sageHinweis());
    if (this.r && this.r.phase === 'zutaten') this.after(1.0, () => { if (this.aktiv) this.zeigeRezept(); });
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
      zutaten: 'baeckerei_zutaten', rühren: 'baeckerei_ruehren', kneten: 'baeckerei_kneten',
      formen: 'baeckerei_formen', ofen: 'baeckerei_ofen',
    };
    const id = ids[r.phase];
    const phase = r.phase;
    if (id) voice(id, { nurWenn: () => this.aktiv && this.r === r && r.phase === phase });
  }

  // nach jedem Schritt: Satz zum neuen Schritt (der Kern sagt jeden höchstens einmal am Tag)
  weiter(phase) {
    const r = this.r;
    r.phase = phase;
    this.after(0.6, () => { if (this.aktiv && this.r === r && r.phase === phase) this.sageHinweis(); });
  }

  // ---------------------------------------------------------------- Aufbau

  baueSchüssel() {
    const c = new PIXI.Container({ label: 'schuessel', sortableChildren: true });
    const bild = spr('baeckerei/schuessel', { parent: c, z: 1 });
    const inhalt = new PIXI.Graphics();
    inhalt.zIndex = 2;
    c.addChild(inhalt);
    const m = meta('baeckerei/schuessel');
    const p = m.pts?.innen || [210, 100];
    this.innenLokal = { x: p[0] - m.ax * m.w, y: p[1] - m.ay * m.h };
    c.position.set(SCHÜSSEL.x, SCHÜSSEL.y);
    c.scale.set(SCHÜSSEL.s);
    c.zIndex = 400;
    this.welt.addChild(c);
    c.hitArea = new PIXI.Rectangle(-m.ax * m.w - 20, -m.ay * m.h - 60, m.w + 40, m.h + 70);
    tap(c, () => {
      const r = this.r;
      if (r?.phase === 'rühren') { this.rühreEinStück(); return; }
      fx.wobble(c, 0.04);
      this.tonEinmal('common/klack', 0.4, { vol: 0.3 });
    }, { sound: null, squash: false });
    this.schüssel = { c, bild, inhalt };

    // Schneebesen (steckt nur beim Rühren in der Schüssel)
    const b = spr('baeckerei/schneebesen', { anchor: 0.5, parent: this.welt, z: 420 });
    b.scale.set(0.62);
    b.alpha = 0;
    b.eventMode = 'none';
    this.besen = b;
    this.besenH = (meta('baeckerei/schneebesen').h || 340) * 0.62;
    this.rührWinkel = -Math.PI / 2;

    // Rührfläche über der Öffnung: Finger kreist, der Winkel um die Mitte rührt
    const f = new PIXI.Container({ label: 'ruehren' });
    const ö = this.öffnung();
    f.position.set(ö.x, ö.y);
    f.zIndex = 900;
    f.hitArea = new PIXI.Circle(0, 0, 230);
    f.eventMode = 'none';
    this.welt.addChild(f);
    this.rührFläche = f;
    let letzter = null;
    let bewegt = 0;
    f.on('pointerdown', (e) => {
      const q = this.welt.toLocal(e.global);
      f.position.set(q.x, q.y);
      letzter = null;
    });
    drag(f, {
      back: false, lift: 1, sound: null,
      onStart: () => { bewegt = 0; },
      onMove: () => {
        const o = this.öffnung();
        const dx = f.x - o.x;
        const dy = (f.y - o.y) * 2.2;
        if (Math.hypot(dx, dy) < 30) return;
        const w = Math.atan2(dy, dx);
        if (letzter !== null) {
          let d = w - letzter;
          while (d > Math.PI) d -= 2 * Math.PI;
          while (d < -Math.PI) d += 2 * Math.PI;
          bewegt += Math.abs(d);
          this.rühre(d);
        }
        letzter = w;
      },
      onDrop: () => {
        if (bewegt < 0.2) this.rühreEinStück();
        const o = this.öffnung();
        f.position.set(o.x, o.y);
        letzter = null;
      },
    });
  }

  // Mitte der Schüssel-Öffnung in Welt-Koordinaten
  öffnung() {
    const c = this.schüssel.c;
    return { x: c.x + this.innenLokal.x * c.scale.x, y: c.y + (this.innenLokal.y + 8) * c.scale.y };
  }

  baueOfen() {
    const id = 'baeckerei/ofen';
    const m = meta(id);
    const o = spr(id, { parent: this.welt, x: OFEN.x, y: OFEN.y, z: 500 });
    o.scale.set(OFEN.s);
    this.ofen = o;
    const pt = (n, d) => {
      const p = m.pts?.[n] || d;
      return { x: OFEN.x + (p[0] - m.ax * m.w) * OFEN.s, y: OFEN.y + (p[1] - m.ay * m.h) * OFEN.s };
    };
    this.mund = pt('mund', [332, 470]);
    this.mundBoden = pt('mundboden', [332, 548]);
    this.schornstein = pt('schornstein', [415, 40]);
    tap(o, () => this.ofenAngetippt(), {
      sound: null, squash: false,
      hitArea: new PIXI.Rectangle(-m.ax * m.w, -m.ay * m.h, m.w, m.h),
    });
    // Glut im Ofen: weiche Flächen, Helligkeit ändert sich nur langsam (≥ 1 s)
    const g = new PIXI.Graphics();
    const w = 150;
    g.roundRect(this.mund.x - w, this.mund.y - 92, 2 * w, 180, 90).fill({ color: 0xff7418, alpha: 0.55 });
    g.ellipse(this.mund.x, this.mundBoden.y - 40, w - 22, 70).fill({ color: 0xff9a2e, alpha: 0.6 });
    g.ellipse(this.mund.x, this.mundBoden.y - 26, w - 60, 40).fill({ color: 0xffd36a, alpha: 0.65 });
    g.alpha = 0;
    g.zIndex = 501;
    g.eventMode = 'none';
    this.welt.addChild(g);
    this.glut = g;
  }

  baueBlech() {
    const c = new PIXI.Container({ label: 'blech', sortableChildren: true });
    const b = spr('baeckerei/blech', { anchor: 0.5, parent: c, z: 0 });
    b.scale.set(BLECH.s);
    c.position.set(BLECH.x, BLECH.y);
    c.zIndex = 450;
    this.welt.addChild(c);
    this.blech = c;
    c.hitArea = new PIXI.Rectangle(-240, -150, 480, 260);
    // vor drag() angemeldet: wo der Finger aufsetzt (zum Formen der nächstliegenden Kugel)
    c.on('pointerdown', (e) => { this.fingerX = this.welt.toLocal(e.global).x; });
    drag(c, {
      lift: 1.04, back: false, sound: null,
      targets: () => {
        const r = this.r;
        if (r?.phase === 'ofen') return [{ id: 'ofen', x: this.mund.x, y: this.mund.y, radius: 320 }];
        if (r?.phase === 'korb') return [{ id: 'korb', x: KORB.x, y: KORB.y - 180, radius: 330 }];
        return [];
      },
      onStart: (ctx) => {
        const r = this.r;
        // Schieben/Einräumen nur, wenn der Griff schon in diesem Schritt begann – sonst schöbe der Tipp,
        // der die letzte Kugel formt, das Blech beim Loslassen gleich in den Ofen (ein Schritt fiele weg)
        ctx.phaseBeimGriff = r?.phase;
        if (r?.phase === 'formen') this.forme(this.fingerX ?? ctx.x);
        else if (r?.phase === 'raus') this.holeRaus();
      },
      onMove: (z, ctx) => {
        const r = this.r;
        // Nur zum Ofen bzw. zum Korb darf das Blech wandern; sonst bleibt es liegen
        if (!(r?.phase === 'ofen' || r?.phase === 'korb') || r.blechUnterwegs) c.position.set(ctx.startX, ctx.startY);
      },
      onDrop: (ziel, ctx) => {
        const r = this.r;
        const gleich = ctx.phaseBeimGriff === r?.phase;
        if (gleich && r?.phase === 'ofen' && !r.blechUnterwegs && (ziel || kurz(ctx))) { this.schiebeEin(); return; }
        if (gleich && r?.phase === 'korb' && !r.blechUnterwegs && (ziel || kurz(ctx))) { this.inDenKorb(); return; }
        if (r?.blechUnterwegs) return;
        const heim = r?.phase === 'backen' || r?.phase === 'raus' ? this.blechImOfen() : { x: BLECH.x, y: BLECH.y };
        this.tween(c, heim, gleitDauer(heim.x - c.x, heim.y - c.y, 0.35, 3), { ease: 'cubicOut' });
      },
    });
  }

  blechImOfen() {
    return { x: this.mund.x, y: this.mundBoden.y - 34 };
  }

  baueMaus() {
    const p = this.korb.lokal(178, 330);
    const a = new Actor('maus', { x: p.x, y: p.y, scale: 0.24, parent: this.korb.inhalt, z: 50 });
    a.unten = p.y;
    a.visible = false;
    a.onTap(() => {
      fx.wobble(a, 0.08);
      if (this.uhr > (this.mausLaut || 0)) { this.mausLaut = this.uhr + 1.2; a.sound(); }
    }, { pad: 60 });
    this.maus = a;
    this.mausDa = false;
  }

  async mausGucktHeraus() {
    const a = this.maus;
    if (this.mausDa || !this.aktiv || a.destroyed || this.uhr < this.mausBis) return;
    if (this.korb.inhalt.children.some((k) => k.istWare)) return;   // nur aus dem leeren Korb
    this.mausDa = true;
    this.mausBis = this.uhr + 14;
    a.visible = true;
    a.y = a.unten;
    a.pose('idle');
    await this.tween(a, { y: a.unten - 112 }, 0.8, { ease: 'sineInOut' });
    if (a.destroyed) return;
    await this.wait(0.6);
    // Hatschi: ein Mehlwölkchen
    a.pose('happy');
    this.burst('staub', KORB.x, KORB.y - 300, { count: 4 });
    if (this.uhr > (this.mausLaut || 0)) { this.mausLaut = this.uhr + 1.2; a.sound(); }
    await a.hop(40);
    await this.wait(2.2);
    if (a.destroyed) return;
    a.pose('idle');
    await this.tween(a, { y: a.unten }, 0.8, { ease: 'sineInOut' });
    if (a.destroyed) return;
    a.visible = false;
    this.mausDa = false;
  }

  korbAngetippt() {
    const r = this.r;
    if (r?.phase === 'korb') { this.inDenKorb(); return; }
    fx.wobble(this.korb.c, 0.04);
    sfx('common/rascheln', { vol: 0.3 });
    if (!this.mausDa && Math.random() < 0.6) this.mausGucktHeraus();
  }

  // Unsichtbare Tippflächen auf Dingen des Hintergrunds: Pfannen, Fenster, Regal mit Broten
  baueDeko() {
    const zone = (x, y, w, h, fn) => {
      const c = new PIXI.Container({ label: 'deko' });
      c.position.set(x, y);
      c.hitArea = new PIXI.Rectangle(-w / 2, -h / 2, w, h);
      c.zIndex = 10;
      this.welt.addChild(c);
      tap(c, fn, { sound: null, squash: false });
    };
    // Kupferpfannen: zarte Glockentöne
    let pfanne = 0;
    zone(240, 430, 520, 320, () => {
      note('glocke', [72, 76, 79][pfanne++ % 3], { vol: 0.28 });
      this.burst('funkeln', 240 + rand(-150, 150), 470, { count: 2 });
    });
    // Fenster: ein Blatt weht vorbei
    zone(-245, 330, 400, 420, () => {
      this.tonEinmal('common/wusch', 0.6, { vol: 0.25 });
      this.burst('blaetter', -245, 330, { count: 2 });
    });
    // Regal mit Broten und Gläsern
    // (die Ecke oben links bleibt für den Karten-Knopf frei)
    // ganze Breite bis zum linken Bildrand, aber unterhalb der Ecke (y ≥ 280)
    zone(-935, 500, 670, 440, () => {
      note('xylo', pick([67, 69, 71, 72]), { vol: 0.3 });
      this.burst('funkeln', -880 + rand(-100, 100), 330, { count: 2 });
    });
  }

  neuerHelfer(x) {
    const t = wähleNeu(HELFER, this.helferVerlauf, 2);
    const a = new Actor(t, { x, y: HELFER_PLATZ.y, scale: HELFER_SKALA, parent: this.welt, z: 1250 });
    a.onTap(() => this.helferAngetippt(a), { pad: 30 });
    bäckermütze(this, a);
    a.lookAt(OFEN.x);
    return a;
  }

  helferAngetippt(a) {
    fx.wobble(a, 0.06);
    if (this.uhr > (this.helferLaut || 0)) { this.helferLaut = this.uhr + 1.2; a.sound(); }
    if (this.r?.phase === 'zutaten') this.zeigeRezept();
  }

  zeigeRezept() {
    const a = this.helfer;
    const r = this.r;
    if (!a || a.destroyed || !r) return;
    a.bubble('baeckerei/' + r.sorte, 2.6, { seite: 'rechts' });
  }

  // ---------------------------------------------------------------- Runde

  async neueRunde({ erste = false } = {}) {
    this.runden++;
    const sorte = wähleNeu(Object.keys(SORTEN), this.sortenVerlauf, 1);
    // Zutaten: Mehl und zwei andere, nie dieselbe Mischung wie zuletzt
    let namen;
    for (let v = 0; v < 6; v++) {
      namen = ['mehl', ...['ei', 'milch', 'butter', 'zucker'].sort(() => Math.random() - 0.5).slice(0, 2)];
      if ([...namen].sort().join() !== this.letzteMischung) break;
    }
    this.letzteMischung = [...namen].sort().join();
    namen.sort(() => Math.random() - 0.5);
    const r = {
      sorte, phase: 'start', zutaten: [], level: 0, flecken: [], glatt: 0, gerührt: 0, knet: 0,
      kugeln: [], teig: null, blechUnterwegs: false, fertig: false,
    };
    this.r = r;
    this.zeichneInhalt();

    if (!erste) {
      // Gebackenes der letzten Runde geht in den Laden (verblasst im Korb)
      for (const k of [...this.korb.inhalt.children]) {
        if (!k.istWare) continue;
        k.istWare = false;
        this.tween(k, { alpha: 0 }, 0.8, { ease: 'sineInOut' }).then(() => { if (!k.destroyed) k.destroy({ children: true }); });
      }
      // die leere Schüssel kommt zurück an ihren Platz
      const c = this.schüssel.c;
      killTweensOf(c);
      c.alpha = 1;
      await bogen(this, c, SCHÜSSEL.x, SCHÜSSEL.y, { dauer: 0.7, höhe: 80, skala: SCHÜSSEL.s, dreh: -c.rotation });
      if (this.r !== r) return;
      this.rührFläche.position.set(this.öffnung().x, this.öffnung().y);
      // alle zwei Runden kommt ein anderes Bäcker-Tier
      if (this.runden % 2 === 1) await this.helferWechsel();
      if (this.r !== r) return;
    }
    namen.forEach((n, i) => this.after(i * 0.3, () => { if (this.r === r) r.zutaten.push(this.stelleZutat(n, i)); }));
    await this.wait(namen.length * 0.3 + 0.2);
    if (this.r !== r) return;
    r.phase = 'zutaten';
    if (this.aktiv) {
      this.after(0.4, () => { if (this.aktiv && this.r === r) this.zeigeRezept(); });
      this.after(2.6, () => this.sageHinweis());
    }
    if (!erste && Math.random() < 0.4) this.after(rand(4, 8), () => { if (this.r === r && r.phase !== 'korb') this.mausGucktHeraus(); });
  }

  async helferWechsel() {
    const alt = this.helfer;
    this.helfer = null;
    if (alt && !alt.destroyed) {
      alt.pose('happy');
      await alt.walkTo(-1560, alt.y, { tempo: 380 });
      if (!alt.destroyed) alt.destroy({ children: true });
    }
    const neu = this.neuerHelfer(-1560);
    this.helfer = neu;
    await neu.walkTo(HELFER_PLATZ.x, HELFER_PLATZ.y, { tempo: 380 });
    if (!neu.destroyed) neu.lookAt(OFEN.x);
  }

  stelleZutat(name, i) {
    const cfg = ZUTATEN[name];
    const x = ZUTAT_X[i];
    const sp = spr(cfg.bild, { parent: this.welt, x, y: TISCH_Y, z: 410 + i });
    const s = skalaFür(cfg.bild, 230, cfg.höhe);
    sp.scale.set(s * 0.3);
    sp.alpha = 0;
    this.tween(sp, { alpha: 1 }, 0.3, { ease: 'sineInOut' });
    this.tween(sp, { scale: s }, 0.5, { ease: 'backOut' });
    note('glocke', [76, 79, 84][i % 3], { vol: 0.2 });
    const z = { name, cfg, sp, s, heim: { x, y: TISCH_Y }, zustand: 'tisch', zug: null };
    sp.hitArea = fläche(sp, 210, s);
    z.zug = drag(sp, {
      back: false, lift: 1.1,
      targets: () => [{ id: 'schuessel', ...this.öffnung(), radius: 280 }],
      onDrop: (ziel, ctx) => {
        if (z.zustand !== 'tisch') return;
        if (ziel || kurz(ctx)) { this.inDieSchüssel(z); return; }
        this.tween(sp, z.heim, gleitDauer(z.heim.x - sp.x, z.heim.y - sp.y, 0.35, 3), { ease: 'cubicOut' });
      },
    });
    return z;
  }

  // ---------------------------------------------------------------- 1. Zutaten in die Schüssel

  async inDieSchüssel(z) {
    const r = this.r;
    if (!r || r.phase !== 'zutaten' || z.zustand !== 'tisch') {
      if (z.zustand === 'tisch') this.tween(z.sp, z.heim, 0.4, { ease: 'cubicOut' });
      return;
    }
    z.zustand = 'unterwegs';
    z.zug?.off();
    z.zug = null;
    const sp = z.sp;
    killTweensOf(sp);
    sp.eventMode = 'none';
    sp.zIndex = 800;
    sp.scale.set(z.s);
    const ö = this.öffnung();
    const art = z.cfg.art;
    if (art === 'plumps' || art === 'ei') {
      await bogen(this, sp, ö.x + rand(-30, 30), ö.y - 150, { dauer: 0.5, höhe: 90 });
      if (sp.destroyed) return;
      if (art === 'ei') {
        await this.tween(sp, { rotation: 0.3 }, 0.2, { ease: 'sineInOut' });
        sfx('common/klack', { vol: 0.5 });
        this.tween(sp, { alpha: 0, scale: z.s * 0.8 }, 0.3, { ease: 'sineInOut' });
        this.legeFleck(z.cfg.farbe, 'ei');
      } else {
        await this.tween(sp, { y: ö.y - 20, scale: z.s * 0.7 }, 0.3, { ease: 'quadIn' });
        sfx('common/plopp', { vol: 0.55 });
        this.tween(sp, { alpha: 0 }, 0.25);
        this.legeFleck(z.cfg.farbe, 'butter');
      }
    } else {
      // schütten bzw. gießen: über der Schüssel kippen (Öffnung zeigt nach rechts unten)
      await bogen(this, sp, ö.x - 130, ö.y - 200, { dauer: 0.55, höhe: 100 });
      if (sp.destroyed) return;
      const kipp = art === 'giessen' ? 1.0 : 1.5;
      await this.tween(sp, { rotation: kipp }, 0.35, { ease: 'sineInOut' });
      if (z.name === 'mehl') {
        this.tonEinmal('common/sand', 0.5, { vol: 0.45 });
        this.burst('staub', ö.x, ö.y - 30, { count: 4 });
        this.legeFleck(z.cfg.farbe, 'haufen');
      } else if (z.name === 'zucker') {
        this.tonEinmal('common/sand', 0.5, { vol: 0.4 });
        this.burst('funkeln', ö.x, ö.y - 30, { count: 3 });
        this.legeFleck(z.cfg.farbe, 'haufen');
      } else {
        this.tonEinmal('common/giessen', 0.6, { vol: 0.45 });
        this.legeFleck(z.cfg.farbe, 'milch');
      }
      await this.wait(0.55);
      await this.tween(sp, { rotation: 0 }, 0.3, { ease: 'sineInOut' });
      await bogen(this, sp, z.heim.x, z.heim.y, { dauer: 0.5, höhe: 80 });
      this.tween(sp, { alpha: 0 }, 0.4, { ease: 'sineInOut' });
    }
    z.zustand = 'drin';
    this.after(0.6, () => { if (!sp.destroyed) sp.destroy(); });
    if (this.r !== r) return;
    if (r.zutaten.length === 3 && r.zutaten.every((x) => x.zustand === 'drin') && r.phase === 'zutaten') {
      this.zumRühren();
    } else {
      const n = r.zutaten.find((x) => x.zustand === 'tisch');
      if (n && this.aktiv) fx.pop(n.sp, 0.1);
    }
  }

  legeFleck(farbe, art) {
    const r = this.r;
    r.level = clamp(r.level + 0.34, 0, 1);
    if (art === 'milch') r.flecken.push({ farbe, art, x: 0, y: 0 });
    else r.flecken.push({ farbe, art, x: rand(-60, 60), y: rand(-8, 8) });
    this.zeichneInhalt();
  }

  zeichneInhalt() {
    const g = this.schüssel.inhalt;
    g.clear();
    const r = this.r;
    if (!r || r.level <= 0.01) return;
    const o = { x: this.innenLokal.x, y: this.innenLokal.y + 26 };
    const rx = 140 + r.level * 22;
    const ry = 34 + r.level * 6;
    const grund = misch(0xf1e2c2, TEIG_FARBE, r.glatt);
    g.ellipse(o.x, o.y, rx, ry).fill(grund).stroke({ width: 4, color: misch(grund, 0x7a5030, 0.25), alpha: 0.5 });
    if (r.glatt < 0.99) {
      for (const f of r.flecken) {
        const c = misch(f.farbe, TEIG_FARBE, r.glatt);
        const a = 1 - r.glatt;
        if (f.art === 'milch') g.ellipse(o.x, o.y, rx * 0.86, ry * 0.8).fill({ color: c, alpha: a * 0.9 });
        else if (f.art === 'ei') {
          g.ellipse(o.x + f.x, o.y + f.y, 40, 14).fill({ color: 0xfffaf0, alpha: a });
          g.ellipse(o.x + f.x, o.y + f.y - 2, 20, 9).fill({ color: c, alpha: a });
        } else if (f.art === 'butter') {
          g.roundRect(o.x + f.x - 30, o.y + f.y - 14, 60, 26, 8).fill({ color: c, alpha: a });
        } else {
          g.ellipse(o.x + f.x, o.y + f.y - 6, 54, 20).fill({ color: c, alpha: a });
          g.ellipse(o.x + f.x - 12, o.y + f.y - 12, 20, 7).fill({ color: 0xffffff, alpha: a * 0.6 });
        }
      }
    }
    if (r.glatt > 0.05) {
      // weiche Rühr-Spuren im Teig
      g.ellipse(o.x - 10, o.y - 2, rx * 0.55, ry * 0.45).stroke({ width: 5, color: 0xffffff, alpha: 0.35 * r.glatt });
      g.ellipse(o.x + 20, o.y + 3, rx * 0.3, ry * 0.25).stroke({ width: 4, color: 0xe2bd82, alpha: 0.5 * r.glatt });
    }
    g.ellipse(o.x - rx * 0.4, o.y - ry * 0.35, rx * 0.22, ry * 0.2).fill({ color: 0xffffff, alpha: 0.3 });
  }

  // ---------------------------------------------------------------- 2. Rühren

  zumRühren() {
    const r = this.r;
    this.weiter('rühren');
    r.gerührt = 0;
    this.rührWinkel = -Math.PI / 2;
    this.setzeBesen();
    killTweensOf(this.besen, ['alpha']);
    this.tween(this.besen, { alpha: 1 }, 0.5, { ease: 'sineInOut' });
    const ö = this.öffnung();
    this.rührFläche.position.set(ö.x, ö.y);
    this.rührFläche.eventMode = 'static';
    this.after(0.6, () => { if (this.aktiv && this.r === r && r.phase === 'rühren') fx.pop(this.besen, 0.1); });
  }

  setzeBesen() {
    const b = this.besen;
    const a = this.rührWinkel;
    const ö = this.öffnung();
    const spitze = { x: ö.x + Math.cos(a) * 80, y: ö.y + 10 + Math.sin(a) * 14 };
    const rot = 0.24 * Math.cos(a) + 0.1;
    b.rotation = rot;
    const h = this.besenH / 2 - 30;
    b.position.set(spitze.x + Math.sin(rot) * h, spitze.y - Math.cos(rot) * h);
  }

  rühreEinStück() {
    const r = this.r;
    if (!r || r.phase !== 'rühren' || r.rührtSelbst) return;
    r.rührtSelbst = true;
    const p = { w: 0 };
    let vorher = 0;
    this.tween(p, { w: 2.2 }, 0.8, {
      ease: 'sineInOut',
      onUpdate: () => { this.rühre(p.w - vorher); vorher = p.w; },
    }).then(() => { r.rührtSelbst = false; });
  }

  rühre(d) {
    const r = this.r;
    if (!r || r.phase !== 'rühren') return;
    this.rührWinkel += d;
    this.setzeBesen();
    const vorher = r.gerührt;
    r.gerührt += Math.abs(d);
    if (Math.floor(r.gerührt / Math.PI) > Math.floor(vorher / Math.PI)) {
      this.tonEinmal('common/wisch', 0.5, { vol: 0.3 });
    }
    r.glatt = clamp(r.gerührt / RÜHR_ZIEL, 0, 1);
    this.zeichneInhalt();
    if (r.gerührt >= RÜHR_ZIEL) this.teigFertig();
  }

  async teigFertig() {
    const r = this.r;
    if (r.phase !== 'rühren') return;
    r.phase = 'kippen';
    r.glatt = 1;
    this.zeichneInhalt();
    this.rührFläche.eventMode = 'none';
    sfx('common/funkeln', { vol: 0.4 });
    this.burst('funkeln', this.öffnung().x, this.öffnung().y - 30, { count: 3 });
    this.tween(this.besen, { alpha: 0 }, 0.5, { ease: 'sineInOut', delay: 0.2 });
    await this.wait(0.6);
    if (this.r !== r) return;
    // Die Schüssel kippt, der Teig plumpst auf den Tisch, die Schüssel wartet hinten links
    const c = this.schüssel.c;
    await this.tween(c, { rotation: 0.5, y: SCHÜSSEL.y - 40 }, 0.4, { ease: 'sineInOut' });
    const t = this.baueTeig();
    r.teig = t;
    t.c.position.set(this.öffnung().x + 40, this.öffnung().y);
    t.c.scale.set(0.4);
    sfx('common/landen', { vol: 0.5 });
    await bogen(this, t.c, TEIG.x + 40, TEIG.y, { dauer: 0.5, höhe: 60, skala: 1 });
    this.burst('staub', TEIG.x + 40, TEIG.y - 20, { count: 3 });
    r.level = 0;
    this.zeichneInhalt();
    await bogen(this, c, SCHÜSSEL_RUHE.x, SCHÜSSEL_RUHE.y, { dauer: 0.6, höhe: 60, skala: SCHÜSSEL_RUHE.s, dreh: -0.5 });
    if (this.r !== r) return;
    c.rotation = 0;
    this.tween(t.c, { x: TEIG.x }, 0.4, { ease: 'sineInOut' });
    this.weiter('kneten');
    this.after(0.5, () => { if (this.aktiv && r.phase === 'kneten') fx.pop(t.sp, 0.1); });
  }

  // ---------------------------------------------------------------- 3. Kneten

  baueTeig() {
    const c = new PIXI.Container({ label: 'teig' });
    const sp = spr('baeckerei/teig', { parent: c });
    sp.scale.set(TEIG.s);
    c.zIndex = 430;
    c.hitArea = new PIXI.Rectangle(-170, -230, 340, 260);
    this.welt.addChild(c);
    const t = { c, sp, s: TEIG.s };
    let drückt = false;
    t.zug = drag(c, {
      back: false, lift: 1, sound: null,
      onStart: () => {
        drückt = true;
        t.zugWeite = 0;
        this.knete(t, 'drücken');
      },
      onMove: (z, ctx) => {
        c.position.set(ctx.startX, ctx.startY);
        if (!drückt || this.r?.phase !== 'kneten') return;
        const dx = Math.abs(ctx.x - ctx.startX);
        t.zugWeite = dx;
        const k = clamp(dx / 420, 0, 0.45);
        killTweensOf(sp.scale);
        sp.scale.set(t.s * (1 + k), t.s * (1 - k * 0.45));
      },
      onDrop: (z, ctx) => {
        drückt = false;
        c.position.set(ctx.startX, ctx.startY);
        const gezogen = (t.zugWeite || 0) > 90;
        killTweensOf(sp.scale);
        this.tween(sp.scale, { x: t.s, y: t.s }, 0.5, { ease: 'backOut' });
        if (gezogen) this.knete(t, 'ziehen');
      },
    });
    return t;
  }

  knete(t, wie) {
    const r = this.r;
    if (!r || r.teig !== t) return;
    if (r.phase !== 'kneten') {
      fx.wobble(t.c, 0.04);
      return;
    }
    if (wie === 'drücken') {
      if (this.uhr < (r.knetBis || 0)) return;
      r.knetBis = this.uhr + 0.35;
      const sp = t.sp;
      killTweensOf(sp.scale);
      this.tween(sp.scale, { x: t.s * 1.18, y: t.s * 0.78 }, 0.14, { ease: 'quadOut' })
        .then((ok) => { if (ok && !sp.destroyed) this.tween(sp.scale, { x: t.s, y: t.s }, 0.45, { ease: 'backOut' }); });
      this.tonEinmal('common/landen', 0.3, { vol: 0.4 });
      this.burst('staub', t.c.x + rand(-60, 60), t.c.y - 40, { count: 1 });
    } else {
      sfx('common/wisch', { vol: 0.3 });
    }
    r.knet++;
    // der Teig wird mit jedem Kneten ein bisschen größer und runder
    t.s = TEIG.s * (1 + Math.min(r.knet, KNETEN) * 0.04);
    if (r.knet >= KNETEN) this.teigGeknetet();
  }

  async teigGeknetet() {
    const r = this.r;
    if (r.phase !== 'kneten') return;
    r.phase = 'teilen';
    const t = r.teig;
    t.zug?.off();
    t.c.eventMode = 'none';
    sfx('common/funkeln', { vol: 0.35 });
    this.burst('funkeln', t.c.x, t.c.y - 90, { count: 3 });
    await this.wait(0.5);
    if (this.r !== r) return;
    // Der Teig teilt sich in kleine Kugeln, die aufs Blech hüpfen
    const cfg = SORTEN[r.sorte];
    const plätze = this.blechPlätze(cfg.n);
    this.tween(t.sp.scale, { x: t.s * 0.4, y: t.s * 0.4 }, 0.3 + cfg.n * 0.18, { ease: 'sineInOut' });
    for (let i = 0; i < cfg.n; i++) {
      const k = spr('baeckerei/teig', { parent: this.welt, x: t.c.x, y: t.c.y - 30, z: 470 });
      const s = (cfg.breite * 0.62) / (meta('baeckerei/teig').w || 320);
      k.scale.set(s);
      const ziel = { x: this.blech.x + plätze[i].x, y: this.blech.y + plätze[i].y + 26 };
      note('xylo', [67, 71, 74, 79][i % 4], { vol: 0.25 });
      await bogen(this, k, ziel.x, ziel.y, { dauer: 0.42, höhe: 120 });
      if (k.destroyed || this.r !== r) return;
      umhängen(k, this.blech);
      k.zIndex = 2;
      r.kugeln.push({ k, s, platz: plätze[i], form: null, zustand: 'kugel' });
    }
    this.tween(t.c, { alpha: 0 }, 0.3).then(() => { if (!t.c.destroyed) t.c.destroy({ children: true }); });
    r.teig = null;
    this.weiter('formen');
    this.after(0.4, () => { if (this.aktiv && r.phase === 'formen') fx.pop(r.kugeln[0]?.k, 0.15); });
  }

  blechPlätze(n) {
    const breite = 320;
    const l = [];
    for (let i = 0; i < n; i++) l.push({ x: n === 1 ? 0 : -breite / 2 + (breite * i) / (n - 1), y: -14 });
    return l;
  }

  // ---------------------------------------------------------------- 4. Formen

  // Ein Tipp aufs Blech: die Kugel, die dem Finger am nächsten liegt, bekommt ihre Form
  forme(fingerX) {
    const r = this.r;
    if (!r || r.phase !== 'formen') return;
    const offen = r.kugeln.filter((k) => k.zustand === 'kugel');
    if (!offen.length) return;
    const lx = fingerX - this.blech.x;
    offen.sort((a, b) => Math.abs(a.platz.x - lx) - Math.abs(b.platz.x - lx));
    const k = offen[0];
    k.zustand = 'roh';
    const kugel = k.k;
    // Kugel wird flach gedrückt und verwandelt sich in die Form
    this.tween(kugel.scale, { x: k.s * 1.4, y: k.s * 0.5 }, 0.18, { ease: 'quadOut' })
      .then(() => this.tween(kugel, { alpha: 0 }, 0.2))
      .then(() => { if (!kugel.destroyed) kugel.destroy(); });
    const id = 'baeckerei/' + r.sorte;
    const c = new PIXI.Container({ label: 'ware' });
    const s = SORTEN[r.sorte].breite / (meta(id).w || 360);
    const gebacken = spr(id, { anchor: 0.5, parent: c });
    gebacken.alpha = 0;
    const roh = spr(id + '_roh', { anchor: 0.5, parent: c });
    c.scale.set(s * 0.4);
    c.position.set(k.platz.x, k.platz.y);
    c.rotation = rand(-0.08, 0.08);
    c.zIndex = 3;
    c.eventMode = 'none';
    this.blech.addChild(c);
    k.form = { c, roh, gebacken, s };
    this.tween(c.scale, { x: s, y: s }, 0.45, { ease: 'backOut', delay: 0.15 });
    this.tween(c, { rotation: c.rotation + pick([-0.25, 0.25]) }, 0.45, { ease: 'backOut', delay: 0.15 });
    sfx('common/plopp', { vol: 0.45 });
    note('glocke', [72, 76, 79, 84][r.kugeln.indexOf(k) % 4], { vol: 0.22 });
    if (r.kugeln.every((x) => x.zustand === 'roh')) {
      this.weiter('ofen');
      this.after(0.7, () => { if (this.aktiv && r.phase === 'ofen') fx.pop(this.ofen, 0.06); });
    }
  }

  // ---------------------------------------------------------------- 5. Ofen

  ofenAngetippt() {
    const r = this.r;
    if (r?.phase === 'ofen') { this.schiebeEin(); return; }
    if (r?.phase === 'raus') { this.holeRaus(); return; }
    fx.wobble(this.ofen, 0.025);
    if (r?.phase === 'backen') {
      // warm: ein Wölkchen aus dem Schornstein
      this.tonEinmal('common/dampf', 1.2, { vol: 0.25 });
      this.burst('rauch', this.schornstein.x, this.schornstein.y, { count: 1 });
    } else this.tonEinmal('common/klack', 0.4, { vol: 0.3 });
  }

  async schiebeEin() {
    const r = this.r;
    if (!r || r.phase !== 'ofen' || r.blechUnterwegs) return;
    r.blechUnterwegs = true;
    r.phase = 'backen';
    const c = this.blech;
    killTweensOf(c);
    c.zIndex = 900;
    const ziel = this.blechImOfen();
    await bogen(this, c, ziel.x, ziel.y - 60, { dauer: 0.7, höhe: 130, skala: 0.85 });
    if (this.r !== r) return;
    c.zIndex = 502;
    sfx('common/wusch', { vol: 0.35 });
    await this.tween(c, { y: ziel.y, scaleX: OFEN_BLECH_SKALA, scaleY: OFEN_BLECH_SKALA }, 0.5, { ease: 'sineInOut' });
    if (this.r !== r) return;
    r.blechUnterwegs = false;
    this.backe();
  }

  async backe() {
    const r = this.r;
    // die Glut wird langsam warm (Helligkeit ändert sich über 1,4 s)
    killTweensOf(this.glut);
    this.tween(this.glut, { alpha: 1 }, 1.4, { ease: 'sineInOut' });
    const rauch = this.every(1.4, () => {
      if (this.aktiv && this.r === r && r.phase === 'backen') this.burst('rauch', this.schornstein.x + rand(-10, 10), this.schornstein.y, { count: 1 });
    });
    await this.wait(0.8);
    if (this.r !== r) { rauch.kill?.(); return; }
    // vor den Augen goldbraun: roh blendet weich ins Gebackene über
    for (const k of r.kugeln) {
      if (!k.form) continue;
      this.tween(k.form.gebacken, { alpha: 1 }, 3.0, { ease: 'sineInOut' });
      this.tween(k.form.roh, { alpha: 0 }, 3.0, { ease: 'sineInOut' });
      // ein wenig aufgehen
      this.tween(k.form.c.scale, { x: k.form.s * 1.08, y: k.form.s * 1.08 }, 3.0, { ease: 'sineInOut' });
    }
    await this.wait(3.3);
    rauch.kill?.();
    if (this.r !== r) return;
    // Ofenuhr: zwei leise Glockentöne
    note('glocke', 84, { vol: 0.3 });
    this.after(0.35, () => note('glocke', 88, { vol: 0.3 }));
    this.burst('funkeln', this.mund.x, this.mund.y - 40, { count: 3 });
    this.tween(this.glut, { alpha: 0.35 }, 1.2, { ease: 'sineInOut' });
    this.weiter('raus');
    this.after(0.8, () => { if (this.aktiv && r.phase === 'raus') fx.pop(this.blech, 0.08); });
    if (this.helfer && !this.helfer.destroyed) this.helfer.lookAt(OFEN.x);
  }

  // ---------------------------------------------------------------- 6. Herausholen

  async holeRaus() {
    const r = this.r;
    if (!r || r.phase !== 'raus' || r.blechUnterwegs) return;
    r.blechUnterwegs = true;
    r.phase = 'heraus';
    const c = this.blech;
    killTweensOf(c);
    this.tween(this.glut, { alpha: 0 }, 1.0, { ease: 'sineInOut' });
    sfx('common/wusch', { vol: 0.35 });
    await this.tween(c, { y: c.y - 60, scaleX: 0.85, scaleY: 0.85 }, 0.45, { ease: 'sineInOut' });
    c.zIndex = 900;
    await bogen(this, c, BLECH.x, BLECH.y, { dauer: 0.7, höhe: 120, skala: 1 });
    if (this.r !== r) return;
    c.zIndex = 450;
    r.blechUnterwegs = false;
    // Es duftet: ruhige Wölkchen steigen auf, das Bäcker-Tier schnuppert und freut sich
    sfx('common/funkeln', { vol: 0.4 });
    this.burst('rauch', BLECH.x - 90, BLECH.y - 60, { count: 1 });
    this.after(0.4, () => this.burst('rauch', BLECH.x + 80, BLECH.y - 70, { count: 1 }));
    this.after(0.8, () => this.burst('rauch', BLECH.x, BLECH.y - 60, { count: 1 }));
    voice('baeckerei_duft', { nurWenn: () => this.aktiv && this.r === r });
    const h = this.helfer;
    if (h && !h.destroyed) {
      h.lookAt(BLECH.x);
      this.after(0.6, () => { if (!h.destroyed) h.cheer({ parent: this.vorn }); });
    }
    await this.wait(0.8);
    if (this.r !== r) return;
    r.phase = 'korb';
    this.after(0.6, () => { if (this.aktiv && r.phase === 'korb') fx.pop(this.korb.c, 0.06); });
  }

  // ---------------------------------------------------------------- 7. In den Korb

  async inDenKorb() {
    const r = this.r;
    if (!r || r.phase !== 'korb' || r.blechUnterwegs) return;
    r.blechUnterwegs = true;
    r.phase = 'einräumen';
    const c = this.blech;
    killTweensOf(c);
    this.tween(c, { x: BLECH.x, y: BLECH.y }, gleitDauer(BLECH.x - c.x, BLECH.y - c.y, 0.3, 3), { ease: 'cubicOut' });
    await this.wait(0.3);
    const waren = r.kugeln.map((k) => k.form).filter(Boolean);
    for (let i = 0; i < waren.length; i++) {
      const w = waren[i];
      if (w.c.destroyed) continue;
      umhängen(w.c, this.welt);
      w.c.zIndex = 1400;
      const [px, py] = KORB_PLÄTZE[i % KORB_PLÄTZE.length];
      const ziel = this.korb.lokal(px, py);
      const zx = this.korb.c.x + ziel.x;
      const zy = this.korb.c.y + ziel.y;
      note('glocke', [72, 76, 79, 84, 88][i % 5], { vol: 0.25 });
      await bogen(this, w.c, zx, zy, { dauer: 0.5, höhe: 140, skala: w.s * 0.95 });
      if (w.c.destroyed || this.r !== r) return;
      umhängen(w.c, this.korb.inhalt);
      w.c.zIndex = i;
      w.c.istWare = true;
      sfx('common/landen', { vol: 0.35 });
    }
    if (this.r !== r) return;
    r.blechUnterwegs = false;
    merkeGebacken(r.sorte);
    fx.wobble(this.korb.c, 0.04);
    this.rundeGeschafft();
  }

  async rundeGeschafft() {
    const r = this.r;
    if (r.fertig) return;
    r.fertig = true;
    r.phase = 'fertig';
    await this.wait(0.4);
    await belohne(this, 'baeckerei_brezel', KORB.x + 260, KORB.y - 420);
    if (this.r !== r) return;
    const h = this.helfer;
    if (h && !h.destroyed) h.cheer({ parent: this.vorn });
    await this.wait(2.2);
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
    const korbZiel = { x: KORB.x, y: KORB.y - 200 };
    switch (r.phase) {
      case 'zutaten': {
        const z = r.zutaten.find((x) => x.zustand === 'tisch' && !x.sp.destroyed);
        return z ? [{ von: z.sp, nach: this.öffnung() }] : [];
      }
      case 'rühren': return [this.besen];
      case 'kneten': return r.teig ? [r.teig.c] : [];
      case 'formen': {
        const k = r.kugeln.find((x) => x.zustand === 'kugel' && !x.k.destroyed);
        return k ? [k.k] : [];
      }
      case 'ofen': return [{ von: this.blech, nach: { x: this.mund.x, y: this.mund.y } }];
      case 'backen': return [{ x: this.mund.x, y: this.mund.y }];
      case 'raus': return [this.blech];
      case 'korb': return [{ von: this.blech, nach: korbZiel }];
      default: return this.helfer && !this.helfer.destroyed ? [this.helfer] : [];
    }
  }
}
