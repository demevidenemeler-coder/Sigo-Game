// Seite 3: Tierkinder und die kleine Zoo-Bahn. Ein Tierkind steht am Eingang und sucht seine Mama.
//   1. Das Tierkind antippen – es hüpft in den Wagen (schläft es, wacht es davon auf; manchmal sind es Zwillinge).
//   2. Die Lok antippen (oder ziehen) – die Zoo-Bahn fährt zum Gehege der Mama und hält vor dem Tor.
//   3. Das Tor antippen – es schwingt auf, das Kind hüpft zur Mama, beide freuen sich (Sticker zoo_tor).
//   4. Die Kamera antippen – ein Foto von Mama und Kind kommt heraus und wird langsam sichtbar.
//   5. Das Foto an die Fotowand ziehen (oder antippen) – Sticker zoo_fotowand.
//   6. Die Bahn fährt zurück zum Eingang, das nächste Tierkind wartet.
// Von Runde zu Runde anders: anderes Gehege und Tier (nie zweimal dasselbe hintereinander), mal schläft das Kind,
// mal sind es Zwillinge, mal fährt ein Gast vom Bauernhof mit. Die Mamas der drei Gehege werden pro Besuch neu
// gemischt. Wiedervereinte Kinder bleiben bei ihrer Mama (das Gehege füllt sich).
// Was wächst: die Fotowand am Eingang – die Fotos bleiben über alle Besuche (store 'zoo.fotos', höchstens 8).

import { tap, drag, sfx, voice, fx, Actor, spr, meta, pick, killTweensOf, store, PIXI } from '../../engine/index.js';
import { Seite } from '../../gemeinsam/seiten.js';
import { Zug, legeGleis } from '../../gemeinsam/zug.js';
import { belohne } from '../../gemeinsam/sticker.js';
import { bogen, wähleNeu, gemischt, tonEinmal, kurz } from './helfer.js';

// ---------------------------------------------------------------- Maße (Seiten-Koordinaten)
const GLEIS_Y = 1200;                       // Lauffläche der Schiene (Sandweg)
const ZUG_S = 0.42;                         // größer als früher (0,34): Bahn und Kinder sind gut zu treffen
const START_WAGEN_X = -620;                 // dort steht der erste Wagen am Eingang
const WAGEN_MAX_X = 650;                    // weiter rechts nicht: sonst fährt die Lok aus dem Bild (Zug-Skala 0,42)
const WARTEN = { x: -1180, y: 1100 };       // dort wartet das Tierkind (unter dem Eingangsbogen)
const KAMERA = { x: -730, y: 1440 };
const WAND = { x: -330, y: 1595, s: 0.75 }; // Fotowand (Anker unten Mitte)
const MAX_FOTOS = 8;
const KIND_S = 0.25;
const MAMA_S = 0.33;
const FAHRT_MAX = 430;                      // Einheiten/s
const FAHRT_BESCHL = 320;

// Die drei Gehege: Tor-Mitte (in der Lücke des vorderen Zauns), Platz der Mama und des Kindes
const GEHEGE = [
  // Mama und Kind neben dem Tor (nicht dahinter, sonst verdeckt es sie) und weit weg vom Nachbar-Gehege
  // (früher standen zwei Mamas am selben Trennzaun und wirkten wie in einem Gehege)
  { tor: -514, mama: { x: -265, y: 862 }, kind: { x: -365, y: 884 } },
  { tor: 220, mama: { x: 425, y: 872 }, kind: { x: 345, y: 894 } },
  { tor: 996, mama: { x: 700, y: 862 }, kind: { x: 820, y: 888 } },
];
const TOR_Y = 1012;
const TOR_S = 0.42;
const ZOOTIERE = ['giraffe', 'loewe', 'elefant', 'affe', 'pinguin', 'baer'];
const MITFAHRER = ['hase', 'schaf', 'ente', 'schwein'];

export class Tierkinder extends Seite {
  static hg = 'zoo/hg_bahn';

  aufbau() {
    this.uhr = 0;
    this.r = null;
    this.verlauf = [];
    this.fahrt = null;
    this.fv = 0;
    this.baueGehege();
    this.baueBahn();
    this.baueKamera();
    this.baueFotowand();
    this.neueRunde({ erste: true });
  }

  betreten() {
    this._hinweis?.kill();
    this._hinweis = this.after(2.2, () => this.sageHinweis());
  }

  verlassen() {
    this._hinweis?.kill();
    this._hinweis = null;
  }

  sageHinweis() {
    const r = this.r;
    if (!this.aktiv || !r) return;
    const ids = { einsteigen: 'zoo_tierkind', tor: 'zoo_tor', aufhängen: 'zoo_foto' };
    const id = ids[r.schritt];
    const schritt = r.schritt;
    if (id) voice(id, { nurWenn: () => this.aktiv && this.r === r && r.schritt === schritt });
  }

  // ---------------------------------------------------------------- Gehege mit Mamas und Toren

  baueGehege() {
    const mamas = gemischt(ZOOTIERE).slice(0, 3);
    const fest = testWunsch('zootier');
    if (fest && ZOOTIERE.includes(fest) && !mamas.includes(fest)) mamas[1] = fest;
    this.gehege = GEHEGE.map((g, i) => {
      const tier = mamas[i];
      const mama = new Actor(tier, { x: g.mama.x, y: g.mama.y, scale: MAMA_S * (tier === 'giraffe' ? 1.15 : 1), parent: this.welt, z: 800 });
      mama.lookAt(g.kind.x);
      mama.onTap(() => { mama.cheer({ parent: this.vorn }); });
      // Tor: Rahmen mit Türflügel (Scharnier links)
      const tor = new PIXI.Container({ label: 'tor' });
      tor.position.set(g.tor, TOR_Y);
      tor.zIndex = 1000;
      tor.scale.set(TOR_S);
      const rahmen = spr('zoo/tor_rahmen', { parent: tor });
      const m = meta('zoo/tor_rahmen');
      const tür = spr('zoo/tor_tuer', { parent: tor });
      tür.position.set(130 - m.ax * m.w, 512 - m.ay * m.h);
      tor.hitArea = new PIXI.Rectangle(-330, -560, 660, 600);
      this.welt.addChild(tor);
      const e = { i, g, tier, mama, tor, rahmen, tür, offen: false, kinder: [] };
      tap(tor, () => this.torAngetippt(e), { sound: null, squash: false });
      return e;
    });
  }

  torAngetippt(e) {
    const r = this.r;
    if (r && r.schritt === 'tor' && r.ziel === e) {
      this.öffneTor(r);
      return;
    }
    // sonst: das Tor wackelt nur ein bisschen
    if (!e.offen) {
      killTweensOf(e.tür, ['skewY']);
      this.tween(e.tür, { skewY: -0.06 }, 0.15, { ease: 'sineOut' })
        .then(() => this.tween(e.tür, { skewY: 0 }, 0.35, { ease: 'backOut' }));
      tonEinmal(this, 'common/quietsch', 0.6, { vol: 0.25 });
    }
  }

  async öffneTor(r) {
    const e = r.ziel;
    r.schritt = 'zwischen';
    e.offen = true;
    sfx('common/quietsch', { vol: 0.4 });
    killTweensOf(e.tür);
    // der Flügel schwingt nach vorn auf (wird schmal) – ruhig, 0,7 s
    await this.tween(e.tür, { scaleX: 0.22, skewY: -0.12 }, 0.7, { ease: 'sineInOut' });
    if (this.r !== r) return;
    this.wiedersehen(r);
  }

  schließeTor(e) {
    if (!e.offen) return;
    e.offen = false;
    killTweensOf(e.tür);
    this.tween(e.tür, { scaleX: 1, skewY: 0 }, 0.7, { ease: 'sineInOut' })
      .then((ok) => { if (ok) tonEinmal(this, 'common/klack', 0.5, { vol: 0.3 }); });
  }

  // ---------------------------------------------------------------- Zoo-Bahn

  baueBahn() {
    this.gleis = legeGleis(this.welt, { y: GLEIS_Y, scale: 0.42, z: 1100 });
    this.zug = new Zug({
      konfig: { lok: 'lok_gruen', wagen: [{ typ: 'wagen_offen_gelb', gast: null, ladung: null }, { typ: 'wagen_offen_blau', gast: null, ladung: null }] },
      x: 0, y: GLEIS_Y, scale: ZUG_S, parent: this.welt, szene: { front: this.vorn }, z: 1200, bewegt: true,
    });
    // Abstand Zug-Mitte → Mitte des ersten Wagens (für das Halten vor einem Tor)
    this.wagenVersatz = this.zug.wagen[0].fahrzeug.x * ZUG_S;
    this.zug.x = START_WAGEN_X - this.wagenVersatz;
    this.zug.lok.hitArea = new PIXI.Rectangle(-520, -700, 1040, 760);
    tap(this.zug.lok, () => this.lokAngetippt(), { sound: null, squash: false });
    for (const w of this.zug.wagen) {
      w.koerper.hitArea = new PIXI.Rectangle(-450, -560, 900, 620);
      tap(w.koerper, () => {
        if (!this.zug.gaesteJubeln(w.index)) fx.wobble(w.koerper, 0.03);
        if (this.r?.schritt === 'fahren') this.lokAngetippt();
      }, { sound: null, squash: false });
    }
  }

  lokAngetippt() {
    const r = this.r;
    this.zug.pfeife();
    if (r && r.schritt === 'fahren') this.fahreZumGehege(r);
    // steigen die Kinder gerade ein: die Bahn fährt los, sobald alle sitzen
    else if (r && (r.schritt === 'einsteigen' || r.schritt === 'zwischen') && !r.wieder && r.kinder.some((k) => k.imZug || k.springt)) r.losGleich = true;
  }

  // Fährt den Zug so, dass der erste Wagen bei x hält. → Promise (true = angekommen)
  fahreZu(x) {
    const ziel = x - this.wagenVersatz;
    this.fahrt?.fertig(false);
    return new Promise((fertig) => {
      this.fahrt = { ziel, fertig };
    });
  }

  async fahreZumGehege(r) {
    r.schritt = 'fährt';
    sfx('common/zug_fahren', { vol: 0.35 });
    const ok = await this.fahreZu(Math.min(r.ziel.g.tor, WAGEN_MAX_X));
    if (!ok || this.r !== r) return;
    this.zug.pfeife();
    r.schritt = 'tor';
    fx.pulse(r.ziel.tor);
    this.after(0.8, () => { if (this.aktiv && this.r === r && r.schritt === 'tor') this.sageHinweis(); });
  }

  // ---------------------------------------------------------------- Kamera und Fotowand

  baueKamera() {
    this.kamera = spr('common/icon_kamera', { anchor: 0.5, x: KAMERA.x, y: KAMERA.y, parent: this.welt, z: 1300 });
    const s = 220 / Math.max(1, meta('common/icon_kamera').w || 300, meta('common/icon_kamera').h || 300);
    this.kamera.scale.set(s);
    this.kamera.hitArea = new PIXI.Circle(0, 0, 140 / s);
    tap(this.kamera, () => this.kameraAngetippt(), { sound: null, squash: true });
  }

  kameraAngetippt() {
    const r = this.r;
    if (r && r.schritt === 'foto') {
      this.machFoto(r);
      return;
    }
    // während Mama und Kind sich noch freuen: das Foto kommt gleich danach (der Tipp verpufft nicht)
    if (r && r.wieder && !r.foto && r.schritt === 'zwischen') r.fotoGleich = true;
    tonEinmal(this, 'common/klick', 0.5, { vol: 0.35 });
  }

  baueFotowand() {
    this.wand = spr('zoo/fotowand', { x: WAND.x, y: WAND.y, parent: this.welt, z: 1300 });
    this.wand.scale.set(WAND.s);
    this.wand.hitArea = new PIXI.Rectangle(-300, -520, 600, 520);
    tap(this.wand, () => {
      fx.wobble(this.wand, 0.02);
      tonEinmal(this, 'common/tipp', 0.4, { vol: 0.3 });
      for (const f of this.wandFotos) {
        if (f.destroyed || f.eventMode !== 'none') continue;
        const r0 = f.ruhe ?? f.rotation;
        f.ruhe = r0;
        killTweensOf(f, ['rotation']);
        this.tween(f, { rotation: r0 - 0.07 }, 0.15, { ease: 'sineOut' }).then((ok) => { if (ok) this.tween(f, { rotation: r0 }, 0.5, { ease: 'backOut' }); });
      }
    }, { sound: null, squash: false });
    this.wandFotos = [];
    const daten = ladeFotos();
    daten.forEach((d, i) => {
      const f = baueFoto(d);
      f.eventMode = 'none';
      const p = this.platz(i);
      f.position.set(p.x, p.y);
      f.rotation = p.r;
      f.ruhe = p.r;
      f.scale.set(p.s);
      f.zIndex = 1310;
      this.welt.addChild(f);
      this.wandFotos.push(f);
    });
  }

  // Platz i (0 … 7) auf der Korkfläche: 4 Spalten, 2 Reihen
  platz(i) {
    const m = meta('zoo/fotowand');
    const lo = m.pts.kork_lo;
    const ru = m.pts.kork_ru;
    const sp = i % 4;
    const zl = Math.floor(i / 4) % 2;
    const bx = lo[0] + ((sp + 0.5) / 4) * (ru[0] - lo[0]);
    const by = lo[1] + ((zl + 0.5) / 2) * (ru[1] - lo[1]);
    const x = WAND.x + (bx - m.ax * m.w) * WAND.s;
    const y = WAND.y + (by - m.ay * m.h) * WAND.s;
    const dreh = [-0.06, 0.05, -0.03, 0.07, 0.04, -0.07, 0.06, -0.04][i % 8];
    return { x, y, r: dreh, s: 0.36 };
  }

  async machFoto(r) {
    r.schritt = 'zwischen';
    sfx('common/klick', { vol: 0.6 });
    fx.pop(this.kamera, 0.06);
    const d = { t: r.ziel.tier, n: r.anzahl };
    const f = baueFoto(d, { neu: true });
    f.position.set(KAMERA.x, KAMERA.y - 40);
    f.scale.set(0.3);
    f.alpha = 0;
    f.zIndex = 2500;
    this.welt.addChild(f);
    r.foto = { f, d };
    // das Foto gleitet ruhig aus der Kamera nach oben und wird langsam sichtbar (kein Blitz)
    this.tween(f, { alpha: 1 }, 0.5, { ease: 'sineInOut' });
    await this.tween(f, { y: KAMERA.y - 330, x: KAMERA.x + 60, scale: 1, rotation: -0.04 }, 0.8, { ease: 'sineOut' });
    if (this.r !== r || f.destroyed) return;
    this.tween(f.schleier, { alpha: 0 }, 1.4, { ease: 'sineInOut' });
    f.hitArea = new PIXI.Rectangle(-130, -150, 260, 300);
    r.foto.heim = { x: f.x, y: f.y };
    r.foto.zug = drag(f, {
      lift: 1.06,
      back: true,
      heim: r.foto.heim,
      targets: () => [{ id: 'wand', x: WAND.x, y: WAND.y - 220, radius: 360 }],
      onDrop: (z, ctx) => { if (z || kurz(ctx)) this.fotoAnDieWand(r); },
    });
    r.schritt = 'aufhängen';
    this.after(0.6, () => { if (this.aktiv && this.r === r && r.schritt === 'aufhängen') this.sageHinweis(); });
  }

  async fotoAnDieWand(r) {
    if (r.schritt !== 'aufhängen' || !r.foto) return;
    r.schritt = 'zwischen';
    const { f, d } = r.foto;
    r.foto.zug?.off();
    f.eventMode = 'none';
    killTweensOf(f);
    if (f.schleier) f.schleier.alpha = 0;
    // Daten speichern (das älteste fällt weg, wenn die Wand voll ist)
    const liste = ladeFotos();
    liste.push(d);
    let raus = null;
    if (liste.length > MAX_FOTOS) {
      liste.shift();
      raus = this.wandFotos.shift() || null;
    }
    store.set('zoo.fotos', liste);
    if (raus) {
      // das älteste Foto wandert in die Tasche … und die anderen rücken auf
      this.tween(raus, { alpha: 0, y: raus.y + 40 }, 0.5, { ease: 'sineInOut' }).then(() => { if (!raus.destroyed) raus.destroy({ children: true }); });
      this.wandFotos.forEach((w, i) => {
        const p = this.platz(i);
        w.ruhe = p.r;
        killTweensOf(w);
        this.tween(w, { x: p.x, y: p.y, rotation: p.r }, 0.6, { ease: 'sineInOut' });
      });
    }
    const p = this.platz(this.wandFotos.length);
    f.ruhe = p.r;
    this.wandFotos.push(f);
    await bogen(this, f, p.x, p.y, { dauer: 0.7, höhe: 120, skala: p.s, dreh: p.r - f.rotation });
    if (f.destroyed) return;
    f.zIndex = 1310;
    sfx('common/klack', { vol: 0.5 });
    // kein pop (die Größe des Fotos ändert sich gerade) – es wackelt nur kurz an der Nadel
    this.tween(f, { rotation: p.r + 0.08 }, 0.15, { ease: 'sineOut' }).then(() => this.tween(f, { rotation: p.r }, 0.4, { ease: 'backOut' }));
    this.burst('funkeln', p.x, p.y, { count: 4 });
    if (this.r !== r) return;
    await belohne(this, 'zoo_fotowand', p.x, p.y - 120);
    if (this.r !== r) return;
    this.rundeZuEnde(r);
  }

  // ---------------------------------------------------------------- Runde

  neueRunde({ erste = false } = {}) {
    let nr = Number(wähleNeu([0, 1, 2], this.verlauf, 1));
    const fest = erste && testWunsch('gehege') !== null ? Number(testWunsch('gehege')) : NaN;   // Testhilfe: ?gehege=0|1|2
    if (fest >= 0 && fest <= 2) { nr = fest; this.verlauf[this.verlauf.length - 1] = fest; }
    const ziel = this.gehege[nr];
    // Zwillinge (selten) oder ein Mitfahrer vom Bauernhof (manchmal)
    const wurf = Math.random();
    const anzahl = !erste && wurf < 0.25 ? 2 : 1;
    const mitfahrer = anzahl === 1 && wurf > 0.6 ? pick(MITFAHRER) : null;
    const schläft = !erste && Math.random() < 0.35;
    const r = { ziel, anzahl, mitfahrer, schläft, schritt: 'kommt', kinder: [], foto: null, fertig: false };
    this.r = r;
    // war in diesem Gehege schon ein Kind, spielt es jetzt im Hintergrund (es macht Platz)
    for (const k of ziel.kinder) {
      if (k.destroyed) continue;
      k.eventMode = 'none';
      this.tween(k, { alpha: 0 }, 0.8, { ease: 'sineInOut' }).then(() => { if (!k.destroyed) k.destroy({ children: true }); });
    }
    ziel.kinder = [];
    if (mitfahrer) this.zug.setzeGast(1, mitfahrer, { sofort: erste });
    this.kinderKommen(r, erste);
  }

  async kinderKommen(r, erste) {
    for (let i = 0; i < r.anzahl; i++) {
      // Zwillinge: das zweite Kind steht schräg dahinter (neben dem Eingang ist kein Platz – dort steht der Wagen)
      const x = WARTEN.x + i * 75;
      const k = new Actor(r.ziel.tier, { x: erste ? x : -1560, y: WARTEN.y - i * 55, scale: KIND_S, parent: this.welt, z: 1150 - i });
      k.kindNr = i;
      k.onTap(() => this.kindAngetippt(r, k), { pad: 60 });
      r.kinder.push(k);
    }
    if (!erste) {
      sfx('common/hupf', { vol: 0.3 });
      await Promise.all(r.kinder.map((k, i) => k.walkTo(WARTEN.x + i * 75, k.y, { tempo: 300 })));
    }
    if (this.r !== r) return;
    for (const k of r.kinder) {
      if (k.destroyed) continue;
      k.lookAt(WARTEN.x + 400);
      if (r.schläft) {
        k.pose('sleep');
        k.schläft = true;
      }
    }
    r.schritt = 'einsteigen';
    const erstes = r.kinder[0];
    if (erstes && !erstes.destroyed) {
      if (r.schläft) this.burst('zzz', erstes.x + 40, erstes.y - 160, { count: 2 });
      else erstes.bubble(`tiere/${r.ziel.tier}_happy`, 2.4);
    }
    if (this.aktiv) this.after(1.0, () => { if (this.aktiv && this.r === r && r.schritt === 'einsteigen') this.sageHinweis(); });
  }

  async kindAngetippt(r, k) {
    if (k.zuHause) {
      k.cheer({ parent: this.vorn });
      return;
    }
    if (this.r !== r || k.imZug || k.springt) {
      fx.wobble(k, 0.05);
      return;
    }
    if (r.schritt !== 'einsteigen') {
      fx.wobble(k, 0.05);
      tonEinmal(this, 'common/hupf', 0.4, { vol: 0.25 });
      return;
    }
    // schläft es? Aufwachen, strecken – dann hüpft es gleich los
    if (k.schläft) {
      k.schläft = false;
      k.springt = true;
      k.pose('idle');
      k.sound();
      fx.wobble(k, 0.06);
      await this.wait(0.7);
      if (this.r !== r || k.destroyed) return;
      k.springt = false;
    }
    k.springt = true;
    const w = this.zug.wagen[k.kindNr];
    const p = this.welt.toLocal(w.koerper.getGlobalPosition());
    await k.hopTo(p.x, GLEIS_Y - 70, { hoehe: 140, dauer: 0.7 });
    if (this.r !== r || k.destroyed) return;
    // im Wagen übernimmt der Zug das Kind (es plumpst hinein)
    k.visible = false;
    k.imZug = true;
    this.zug.setzeGast(k.kindNr, r.ziel.tier);
    if (r.kinder.every((x) => x.imZug)) {
      r.schritt = 'zwischen';
      await this.wait(0.7);
      if (this.r !== r) return;
      this.zug.gaesteJubeln();
      r.schritt = 'fahren';
      if (r.losGleich) { this.fahreZumGehege(r); return; }
      fx.pulse(this.zug.lok);
    }
  }

  async wiedersehen(r) {
    const e = r.ziel;
    r.wieder = true;
    // die Kinder hüpfen aus dem Wagen durch das Tor zur Mama
    for (const k of r.kinder) {
      const w = this.zug.wagen[k.kindNr];
      const g = w.gast;
      const p = g && !g.destroyed ? this.welt.toLocal(g.getGlobalPosition()) : { x: e.g.tor, y: GLEIS_Y - 60 };
      if (g) g.visible = false;
      this.zug.setzeGast(k.kindNr, null, { sofort: true });
      if (k.destroyed) continue;
      k.position.set(p.x, p.y);
      k.visible = true;
      k.imZug = false;
      k.zIndex = 1250;
      k.springt = true;
      sfx('common/hupf', { vol: 0.5 });
      await k.hopTo(e.g.tor + (k.kindNr ? 30 : -20), TOR_Y - 10, { hoehe: 120, dauer: 0.6 });
      if (this.r !== r || k.destroyed) return;
      k.zIndex = 820 - k.kindNr;
      // Zwilling: etwas zur Mama hin und ein Stück weiter hinten
      const ziel = { x: e.g.kind.x - k.kindNr * 62 * Math.sign(e.g.kind.x - e.g.mama.x || 1), y: e.g.kind.y - k.kindNr * 20 };
      k.hopTo(ziel.x, ziel.y, { hoehe: 90, dauer: 0.6 }).then(() => {
        if (!k.destroyed) k.lookAt(e.mama.x);
      });
    }
    await this.wait(0.8);
    if (this.r !== r) return;
    // Wiedersehen: Mama und Kind(er) freuen sich
    e.mama.lookAt(r.kinder[0]?.x ?? e.g.kind.x);
    e.mama.cheer({ parent: this.vorn });
    for (const k of r.kinder) {
      if (k.destroyed) continue;
      k.zuHause = true;
      k.springt = false;
      this.after(0.3 + k.kindNr * 0.25, () => { if (!k.destroyed) k.cheer({ parent: this.vorn }); });
      e.kinder.push(k);
    }
    await this.wait(1.2);
    if (this.r !== r) return;
    this.schließeTor(e);
    await belohne(this, 'zoo_tor', e.g.tor, 620);
    if (this.r !== r) return;
    // jetzt ein Foto!
    r.schritt = 'foto';
    if (r.fotoGleich) { this.machFoto(r); return; }
    fx.pulse(this.kamera);
  }

  async rundeZuEnde(r) {
    if (r.fertig) return;
    r.fertig = true;
    r.schritt = 'fertig';
    // der Mitfahrer steigt aus, die Bahn fährt zurück zum Eingang
    if (r.mitfahrer) this.zug.setzeGast(1, null);
    await this.wait(0.6);
    if (this.r !== r) return;
    sfx('common/zug_fahren', { vol: 0.3 });
    await this.fahreZu(START_WAGEN_X);
    if (this.r !== r) return;
    await this.wait(0.4);
    if (this.r !== r) return;
    this.neueRunde();
  }

  // ---------------------------------------------------------------- Takt, Hand

  update(dt) {
    this.uhr += dt;
    const f = this.fahrt;
    const z = this.zug;
    if (f && !z.destroyed) {
      const d = f.ziel - z.x;
      if (Math.abs(d) < 2) {
        z.x = f.ziel;
        z.geschwindigkeit = 0;
        this.fv = 0;
        this.fahrt = null;
        f.fertig(true);
      } else {
        // weich anfahren, gleichmäßig fahren, weich bremsen
        this.fv = Math.min(this.fv + FAHRT_BESCHL * dt, FAHRT_MAX, Math.sqrt(2 * FAHRT_BESCHL * Math.abs(d)) + 12);
        const schritt = Math.sign(d) * Math.min(this.fv, Math.abs(d) / Math.max(dt, 1e-3));
        z.geschwindigkeit = schritt;
      }
    }
    z.update(dt);
  }

  hinweise() {
    const r = this.r;
    if (!r) return [];
    switch (r.schritt) {
      case 'einsteigen': {
        const k = r.kinder.find((x) => !x.imZug && !x.destroyed);
        return k ? [k] : [];
      }
      case 'fahren': return [{ von: this.zug.lok, nach: { x: r.ziel.g.tor + 300, y: GLEIS_Y - 80 } }];
      case 'tor': return [r.ziel.tor];
      case 'foto': return [this.kamera];
      case 'aufhängen': return r.foto?.f && !r.foto.f.destroyed
        ? [{ von: r.foto.f, nach: this.platz(Math.min(this.wandFotos.length, MAX_FOTOS - 1)) }] : [];
      // dazwischen (fährt, freut sich …): auf das, was als Nächstes kommt
      default: {
        if (r.fertig) return [this.zug.lok];
        if (r.foto?.f && !r.foto.f.destroyed) return [r.foto.f];
        if (r.wieder) return [this.kamera];
        if (r.kinder.some((k) => k.imZug)) return [r.ziel.tor];
        const k = r.kinder.find((x) => !x.destroyed);
        return k ? [k] : [];
      }
    }
  }
}

// ---------------------------------------------------------------- Fotos

function ladeFotos() {
  const roh = store.get('zoo.fotos', []);
  if (!Array.isArray(roh)) return [];
  return roh
    .filter((d) => d && ZOOTIERE.includes(d.t))
    .map((d) => ({ t: d.t, n: d.n === 2 ? 2 : 1 }))
    .slice(-MAX_FOTOS);
}

const HIMMEL = [0xcdeeff, 0xd8f0ff, 0xffe9cf, 0xe6f6dc];

// Ein Sofortbild: weißer Rand, Himmel und Wiese, Mama groß, Kind(er) klein. f.schleier = heller Überzug (entwickeln).
function baueFoto(d, { neu = false } = {}) {
  const f = new PIXI.Container({ label: 'foto' });
  f.sortableChildren = true;
  const karte = new PIXI.Graphics()
    .roundRect(-115, -135, 230, 270, 14).fill(0xfffdf6).stroke({ width: 4, color: 0xe6d8c2 })
    .rect(-98, -118, 196, 130).fill(HIMMEL[(d.t.length + d.n) % HIMMEL.length])
    .rect(-98, 12, 196, 60).fill(0xa8dc84);
  f.addChild(karte);
  const tier = `tiere/${d.t}_happy`;
  const m = meta(tier);
  const groß = 132 / Math.max(1, m.w || 600, m.h || 900);
  const mama = spr(tier, { parent: f });
  mama.scale.set(groß);
  mama.position.set(-30, 62);
  const klein = (d.n === 2 ? 62 : 78) / Math.max(1, m.w || 600, m.h || 900);
  for (let i = 0; i < d.n; i++) {
    const k = spr(tier, { parent: f });
    k.scale.set(klein);
    k.position.set(d.n === 2 ? 38 + i * 40 : 52, 66 + i * 2);
  }
  // Pinn-Nadel oben
  const nadel = new PIXI.Graphics().circle(0, -122, 9).fill(0xe2574c).circle(-3, -125, 3).fill(0xffb3aa);
  nadel.zIndex = 5;
  f.addChild(nadel);
  if (neu) {
    const schleier = new PIXI.Graphics().rect(-98, -118, 196, 190).fill(0xfffaf0);
    schleier.zIndex = 4;
    f.addChild(schleier);
    f.schleier = schleier;
  }
  return f;
}

// Testhilfe: Wert aus der Adresse (nur mit test=1), sonst null
function testWunsch(name) {
  try {
    const q = new URLSearchParams(location.search);
    return q.get('test') === '1' ? q.get(name) : null;
  } catch { return null; }
}
