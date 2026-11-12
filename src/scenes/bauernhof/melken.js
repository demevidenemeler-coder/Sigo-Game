// Seite 3 – Melken. Eine Milch-Runde hat mehrere Schritte:
//   1. Die Kuh hat Hunger (Denkblase): ihr Futter (Heu, Apfel oder Salat – jede Runde anders) zur Kuh ziehen
//   2. Euter antippen oder halten → Milchstrahl, der Eimer füllt sich (leer → halb → voll)
//   3. Vollen Eimer zur Milchkanne ziehen → umfüllen; die Katze bekommt dabei ein Schälchen Milch
//   4. Ein Tierkind kommt herein (Kälbchen, Lämmchen, Ferkel, Fohlen oder Welpe – jede Runde ein anderes) und
//      wünscht sich Milch: die Kanne antippen → sie kippt, das Fläschchen füllt sich
//   5. Das Fläschchen zum Tierkind ziehen → es trinkt, freut sich (Sticker) und kuschelt sich zum Schlafen ins
//      Heu. Im Heu schlafen bis zu drei Tierkinder (bleibt gespeichert) – das älteste wacht auf und geht.
// Nebenher: Schälchen/Katze antippen → die Katze schlabbert die Milch. Nichts kann falsch gemacht werden: Wer
// zu früh melkt, sieht die Kuh freundlich an ihr Futter denken.

import { Actor, voice, fx, meta, tex, tap, drag, hold, rand, pick, store, PIXI } from '../../engine/index.js';
import { Seite } from '../../gemeinsam/seiten.js';
import { fuettere } from '../../gemeinsam/futter.js';
import { belohne } from '../../gemeinsam/sticker.js';
import { ton, laut, bildFigur } from './hilfen.js';

const KUH_SKALA = 0.85;
const EIMER_SKALA = 0.56;
const EIMER_Y = 1468;         // der Eimer steht vorn vor der Kuh – so sieht man die Milch vom Euter hineinfließen
const KANNE_SKALA = 0.74;
const SCHALE_SKALA = 0.75;
const SPRITZER_VOLL = 6;
const MELK_TAKT = 0.42;       // Sekunden zwischen zwei Spritzern beim Halten
const MILCH = 0xfffbf0;
const STRAHL_ZEIT = 0.45;     // so lange bleibt ein Milchstrahl sichtbar (auch bei einem einzelnen Tipp)
// Milchkanne (Bild 304×420): der Deckel reicht bis etwa Bildzeile 90, darunter der Hals mit der Öffnung
const KANNE_DECKEL_Y = 90;
const KANNE_HALS = { x: 152, y: 96, rx: 62, ry: 15 };
const KANNE_KIPP = -0.42;     // so weit kippt die Kanne zum Fläschchen
// Futter der Kuh (jede Runde eins davon)
const KUH_FUTTER = ['common/futter_heu', 'common/futter_apfel', 'common/futter_salat'];
// Das Futter liegt zwischen Katze und Kuh, über dem Katzen-Schälchen (das bleibt frei) und vor dem Kuhschwanz
const FUTTER_ORT = { x: -485, y: 1110 };
// Jedes Futter bekommt dieselbe Bilddiagonale (Heu ist flach und breit, der Apfel hoch – so wirken alle gleich groß)
const FUTTER_DIAGONALE = 250;
const futterSkala = (id) => {
  const m = meta(id);
  return FUTTER_DIAGONALE / Math.hypot(m?.w || 420, m?.h || 300);
};
// Tierkinder (kleine Ausgaben der großen Tiere)
const KINDER = ['kuh', 'schaf', 'schwein', 'pferd', 'hund'];
const KIND_HOEHE = 270;
const KIND_ORT = { x: -400, y: 1500 };
// Fläschchen (common/futter_milch, 242×420): Milch im unteren Teil (Bildpunkte)
const FLASCHE = { x: 630, y: 1350, skala: 0.5 };
const FLASCHE_MILCH = { x: 22, y: 246, w: 204, h: 160 };
// Schlafplätze im Heuhaufen links (weit hinten, also kleiner)
const SCHLAF = [{ x: -1150, y: 1032 }, { x: -1005, y: 1008 }, { x: -860, y: 1018 }];
const SCHLAF_HOEHE = 175;
const SCHLAF_KEY = 'bauernhof.heuKinder';

export class Melken extends Seite {
  static hg = 'bauernhof/hg_melken';

  aufbau() {
    this.spritzer = 0;
    this.eimerZahl = 0;
    this.giesst = false;
    this.strahlZeit = 0;
    this.phase = 'heu';     // 'heu' | 'melken' | 'kanne' | 'fuellt' | 'flasche' | 'trinkt' | 'pause'
    this.runde = 0;

    // Kuh (eigenes Bild von der Seite, mit Euter)
    const k = this.punkt('kuh', { x: 0, y: 1240 });
    this.kuh = bildFigur('bauernhof/kuh_melken', 'kuh', {
      x: k.x, y: k.y, scale: KUH_SKALA, parent: this.welt, z: 20, punkte: { kopf: [790, 120] },
    });
    this.kuh.onTap(() => {
      fx.wobble(this.kuh, 0.04);
      laut('kuh', 1.5);
      this.kuh.nod();
      if (this.phase === 'heu') this.zeigeKuhWunsch();
    });
    this.euter = this.kuh.point('euter');

    this.strahl = new PIXI.Graphics();
    this.strahl.zIndex = 36;   // über dem Eimer: der Strahl endet sichtbar am Eimerrand
    this.strahl.alpha = 0;
    this.welt.addChild(this.strahl);

    this.baueEimer();
    this.baueKanne();
    this.baueMelkflaeche();
    this.baueKatze();
    this.baueFutter();
    this.baueFlasche();

    this._pg = new PIXI.Point();   // wiederverwendete Punkte (keine neuen Objekte pro Bild)
    this._pl = new PIXI.Point();
    this.giessTipp = 0;
    this.kauZeit = rand(8, 12);
    this.wunschZeit = rand(9, 13);
    this.kuhWunschZeit = 2;
    this.kindWunschZeit = 3;
    this.zzzZeit = 2;

    this.schlaefer = [];
    let liste = store.get(SCHLAF_KEY, []);
    if (!Array.isArray(liste)) liste = [];
    liste.filter((id) => KINDER.includes(id)).slice(-SCHLAF.length).forEach((id) => this.schlafKind(id, null));

    this.neueRunde();
  }

  betreten() {
    this._hinweis?.kill();
    this._hinweis = this.after(2.5, () => this.hinweisAnbieten());
  }

  verlassen() {
    this._hinweis?.kill();
    this._hinweis = null;
  }

  // Hinweise nur, solange die Seite zu sehen ist und das Kind den Schritt noch nicht selbst getan hat
  hinweisAnbieten() {
    if (!this.aktiv) return;
    if (this.phase === 'melken' && !this.gemolken) {
      const passt = () => this.aktiv && !this.gemolken && this.phase === 'melken';
      voice('bauernhof_melken', { nurWenn: passt });
    } else if (this.phase === 'flasche' && !this.flascheGenommen) {
      const passt = () => this.aktiv && this.phase === 'flasche' && !this.flascheGenommen;
      voice('bauernhof_flasche', { nurWenn: passt });
    }
  }

  // ---------------------------------------------------------------- Runde

  neueRunde() {
    this.runde++;
    this.phase = 'heu';
    this.gemolken = false;
    this.flascheGenommen = false;
    // Futter der Kuh: jede Runde ein anderes
    const alt = this.futterId;
    const moegliche = KUH_FUTTER.filter((f) => f !== alt);
    this.futterId = this.runde === 1 ? KUH_FUTTER[0] : pick(moegliche);
    this.legeFutterHin(this.futterId);
    // nächstes Tierkind (nie zweimal dasselbe hintereinander)
    const vorher = this.kindId;
    this.kindId = pick(KINDER.filter((k) => k !== vorher));
    this.kuhWunschZeit = 1.5;
  }

  zeigeKuhWunsch() {
    if (!this.kuh._blase && this.phase === 'heu') this.kuh.bubble(this.futterId, 2.4);
  }

  // ---------------------------------------------------------------- Futter für die Kuh

  baueFutter() {
    this.futter = this.bild(KUH_FUTTER[0], FUTTER_ORT.x, FUTTER_ORT.y, futterSkala(KUH_FUTTER[0]), 45);
    this.futter.anchor.set(0.5);
    drag(this.futter, {
      pad: 32,
      heim: FUTTER_ORT,
      onStart: () => ton('common/rascheln', { vol: 0.5, abstand: 0.5 }),
      targets: () => {
        const m = this.kuh.point('mouth');
        return [{ id: 'kuh', x: m.x - 40, y: m.y + 40, radius: 300 }];
      },
      onDrop: (ziel, ctx) => {
        if (!ziel) return;
        fuettere(this, this.kuh, this.futter, { futter: this.futterId, behalten: true, heim: FUTTER_ORT })
          .then((ok) => {
            if (!ok) return;
            this.kuh.nod(); // kaut genüsslich
            if (this.phase === 'heu') {
              this.phase = 'melken';
              if (this.aktiv) this._hinweis = this.after(1.5, () => this.hinweisAnbieten());
            }
            this.after(1.2, () => this.legeFutterHin(this.futterId));
          });
      },
    });
  }

  legeFutterHin(id) {
    const f = this.futter;
    if (f.destroyed) return;
    if (f.label !== id) {
      f.texture = tex(id);
      f.label = id;
    }
    f.scale.set(futterSkala(id));
    f.position.set(FUTTER_ORT.x, FUTTER_ORT.y - 30);
    f.alpha = 0;
    f.visible = true;
    this.tween(f, { alpha: 1, y: FUTTER_ORT.y }, 0.6, { ease: 'sineInOut' });
  }

  // ---------------------------------------------------------------- Melken

  baueMelkflaeche() {
    // Großes Ziel ums Euter (antippen oder halten)
    const f = new PIXI.Container({ label: 'euter' });
    f.position.set(this.euter.x, this.euter.y);
    f.zIndex = 30;
    this.welt.addChild(f);
    this.melkFlaeche = f;
    hold(f, {
      hitArea: new PIXI.Rectangle(-170, -150, 340, 250),
      onStart: (ctx) => { ctx.naechster = MELK_TAKT; this.spritze(); },
      onTick: (dt, ctx) => this.melkTakt(dt, ctx),
    });
  }

  melkTakt(dt, ctx) {
    ctx.naechster = (ctx.naechster ?? MELK_TAKT) - dt;
    if (ctx.naechster <= 0) {
      ctx.naechster = MELK_TAKT;
      this.spritze();
    }
  }

  spritze() {
    if (this.phase === 'heu') {
      // erst Futter: die Kuh denkt freundlich an ihr Futter
      const jetzt = performance.now();
      if (jetzt - this.giessTipp > 900) {
        this.giessTipp = jetzt;
        fx.wobble(this.kuh, 0.03);
        laut('kuh', 1.5);
        this.zeigeKuhWunsch();
      }
      return;
    }
    this.gemolken = true;   // (für den Hinweis „Tipp auf das Euter")
    if (this.giesst) {
      // Der Eimer wird gerade umgefüllt: die Kuh antwortet trotzdem (kleines Wackeln und Muhen)
      const jetzt = performance.now();
      if (jetzt - this.giessTipp > 900) {
        this.giessTipp = jetzt;
        fx.wobble(this.kuh, 0.03);
        laut('kuh', 1.5);
      }
      return;
    }
    // Milchstrahl vom Euter in den Eimer (auch wenn er schon voll ist – dann schwappt es nur)
    this.strahlZeit = STRAHL_ZEIT;
    this.zeichneMelkStrahl();
    this.strahl.alpha = 1;
    ton('common/melken', { vol: 0.8, abstand: 0.75 });
    fx.pop(this.kuh, 0.02);
    if (this.spritzer < SPRITZER_VOLL) {
      this.spritzer++;
      this.setzeEimerBild();
      fx.pop(this.eimer, 0.04);
      if (this.spritzer >= SPRITZER_VOLL) this.eimerVoll();
    } else {
      fx.wobble(this.eimer, 0.03);
    }
  }

  zeichneMelkStrahl() {
    const e = this.euter;
    const g = this.strahl;
    // von einer der Zitzen (Spitzen etwa 16 unter dem Punkt „euter") hinunter in den Eimer
    const vonX = e.x + rand(-22, 22);
    const vonY = e.y + 16;
    const nachX = this.eimer.x + rand(-14, 14);
    const nachY = this.eimer.y - 0.84 * this.eimer.height;
    const mx = (vonX + nachX) / 2 + rand(-10, 10);
    g.clear()
      .moveTo(vonX, vonY)
      .quadraticCurveTo(mx, (vonY + nachY) / 2, nachX, nachY)
      .stroke({ width: 14, color: MILCH, cap: 'round' })
      .moveTo(vonX + 3, vonY + 6)
      .quadraticCurveTo(mx + 3, (vonY + nachY) / 2, nachX + 3, nachY - 8)
      .stroke({ width: 4, color: 0xffffff, alpha: 0.8, cap: 'round' })
      // ein paar Spritzer am Eimerrand
      .circle(nachX - 24, nachY - 10, 8).fill(MILCH)
      .circle(nachX + 22, nachY - 16, 7).fill(MILCH)
      .circle(nachX + 4, nachY - 26, 5).fill(MILCH);
  }

  // ---------------------------------------------------------------- Eimer

  baueEimer() {
    // Der Eimer steht vor der Kuh unter dem Euter – etwas weiter vorn als der Punkt „eimer", sonst verdeckt er das Euter
    const p = this.punkt('eimer', { x: -40, y: 1290 });
    this.eimerOrt = { x: this.euter.x + 6, y: Math.max(p.y, EIMER_Y) };
    this.eimer = this.bild('bauernhof/eimer_leer', this.eimerOrt.x, this.eimerOrt.y, EIMER_SKALA, 35);
    this.eimerMelken = this.eimerAlsMelkziel();
    this.eimerZiehen = null;
  }

  // Eimer antippen/halten melkt auch (solange er nicht voll ist)
  eimerAlsMelkziel() {
    return hold(this.eimer, {
      pad: 50,
      onStart: (ctx) => { ctx.naechster = MELK_TAKT; this.spritze(); },
      onTick: (dt, ctx) => this.melkTakt(dt, ctx),
    });
  }

  setzeEimerBild() {
    const id = this.spritzer >= SPRITZER_VOLL ? 'bauernhof/eimer_voll'
      : this.spritzer >= 3 ? 'bauernhof/eimer_halb' : 'bauernhof/eimer_leer';
    if (this.eimer.label === id) return;
    this.eimer.texture = tex(id);
    this.eimer.label = id;
  }

  eimerVoll() {
    // jetzt darf der Eimer gezogen werden
    this.eimerMelken?.off();
    this.eimerMelken = null;
    ton('common/plopp', { vol: 0.6 });
    this.puls = fx.pulse(this.eimer, { staerke: 0.04, periode: 1.6 });
    this.eimerZiehen = drag(this.eimer, {
      pad: 50,
      lift: 1.08,
      targets: () => (this.phase === 'fuellt' ? [] : [{ id: 'kanne', x: this.kanne.x, y: this.kanne.y - 200, radius: 330 }]),
      onStart: () => { this.puls?.stop(); this.puls = null; },
      onDrop: (ziel, ctx) => {
        if (ziel && this.phase !== 'fuellt') this.umfuellen(ctx);
        else ctx.back();
      },
    });
  }

  async umfuellen() {
    this.giesst = true;
    this.eimerZiehen?.off();
    this.eimerZiehen = null;
    const e = this.eimer;
    e.eventMode = 'none';
    const kanne = this.kanne;
    const oeffnung = this.kannenOeffnung();
    // Deckel klappt auf, der Eimer schwebt links über die Kanne und kippt
    this.deckelAuf(true);
    await this.tween(e, { x: oeffnung.x - 150, y: oeffnung.y - 60 }, 0.35, { ease: 'sineInOut' });
    await this.tween(e, { rotation: 0.95 }, 0.45, { ease: 'sineInOut' });
    const kanteLokal = new PIXI.Point(0.5 * e.texture.width - 14, -0.9 * e.texture.height);
    ton('common/giessen', { vol: 0.7, abstand: 1 });
    const p = { k: 0 };
    await this.tween(p, { k: 1 }, 1.3, {
      ease: 'linear',
      onUpdate: () => {
        // Strahl vom Eimerrand in die Kanne
        const r = this.welt.toLocal(e.toGlobal(kanteLokal, this._pg), undefined, this._pl);
        const dicke = 16 * Math.sin(Math.min(1, p.k * 1.15) * Math.PI) + 2;
        this.strahl.clear()
          .moveTo(r.x, r.y)
          .quadraticCurveTo(r.x + 30, (r.y + oeffnung.y) / 2, oeffnung.x, oeffnung.y)
          .stroke({ width: dicke, color: MILCH, cap: 'round' });
        this.strahl.alpha = 1;
        this.strahlZeit = 0.2;
        if (p.k > 0.4 && this.spritzer >= SPRITZER_VOLL) { this.spritzer = 3; this.setzeEimerBild(); }
        if (p.k > 0.8 && this.spritzer > 0) { this.spritzer = 0; this.setzeEimerBild(); }
      },
    });
    fx.pop(kanne, 0.06);
    this.burst('funkeln', oeffnung.x, oeffnung.y - 40, { count: 5 });
    await this.tween(e, { rotation: 0 }, 0.4, { ease: 'sineInOut' });
    this.deckelAuf(false);
    await this.tween(e, { x: this.eimerOrt.x, y: this.eimerOrt.y }, 0.6, { ease: 'sineInOut' });
    e.eventMode = 'static';
    this.giesst = false;
    this.eimerMelken = this.eimerAlsMelkziel();

    // Die Kuh freut sich, die Katze bekommt ein Schälchen Milch
    this.kuh.cheer();
    this.eimerZahl++;
    if (!this.schaleVoll) this.after(0.6, () => this.fuelleSchale());
    // Jetzt ist Milch in der Kanne: ein Tierkind kommt und wünscht sich ein Fläschchen
    if (this.phase === 'melken') {
      this.phase = 'kanne';
      this.after(0.8, () => this.kindKommt());
    }
  }

  // ---------------------------------------------------------------- Kanne

  // Die Kanne besteht aus zwei Ausschnitten desselben Bilds: Körper und Deckel. Beim Umfüllen klappt der Deckel
  // nach rechts auf, darunter sieht man die dunkle Öffnung – die Milch fließt hinein statt auf den Deckel.
  baueKanne() {
    const p = this.punkt('kanne', { x: 865, y: 1260 });
    const id = 'bauernhof/milchkanne';
    const m = meta(id);
    const t = tex(id);
    const W = m.w || t.width;
    const H = m.h || t.height;
    const sx = W / t.frame.width;    // Bildpunkte je Texturpunkt (meist 1)
    const sy = H / t.frame.height;
    const ky = Math.round(KANNE_DECKEL_Y / sy);   // Schnittzeile in Texturpunkten
    const k = new PIXI.Container({ label: id });
    k.position.set(p.x, p.y);
    k.scale.set(KANNE_SKALA);
    k.zIndex = 25;
    this.welt.addChild(k);
    this.kannenOrt = { x: p.x, y: p.y };
    const ox = -m.ax * W;
    const oy = -m.ay * H;
    // Körper (ab der Schnittzeile)
    const koerper = new PIXI.Sprite(new PIXI.Texture({
      source: t.source, frame: new PIXI.Rectangle(t.frame.x, t.frame.y + ky, t.frame.width, t.frame.height - ky),
    }));
    koerper.position.set(ox, oy + ky * sy);
    koerper.scale.set(sx, sy);
    // Öffnung im Hals (nur sichtbar, solange der Deckel offen ist)
    const h = KANNE_HALS;
    const loch = new PIXI.Graphics()
      .ellipse(ox + h.x, oy + h.y, h.rx + 8, h.ry + 5).fill(0xc3cad2)
      .ellipse(ox + h.x, oy + h.y + 1, h.rx, h.ry).fill(0x4a525c)
      .ellipse(ox + h.x, oy + h.y + 5, h.rx - 14, h.ry - 6).fill({ color: 0xf6f0e2, alpha: 0.85 });
    loch.alpha = 0;
    // Deckel: dreht sich um seine rechte untere Ecke (Scharnier)
    const scharnier = { x: 244, y: ky * sy - 4 };
    const deckel = new PIXI.Sprite(new PIXI.Texture({
      source: t.source, frame: new PIXI.Rectangle(t.frame.x, t.frame.y, t.frame.width, ky),
    }));
    deckel.scale.set(sx, sy);
    deckel.pivot.set(scharnier.x / sx, scharnier.y / sy);
    deckel.position.set(ox + scharnier.x, oy + scharnier.y);
    k.addChild(koerper, loch, deckel);
    this.kanne = k;
    this.kannenDeckel = deckel;
    this.kannenDeckelY = deckel.y;
    this.kannenLoch = loch;
    this.kannenHals = { x: ox + h.x, y: oy + h.y };
    tap(k, () => {
      if (this.phase === 'kanne') { this.flascheFuellen(); return; }
      fx.wobble(k, 0.05);
      ton('common/klack', { vol: 0.5 });
    }, { sound: null, squash: false, hitArea: new PIXI.Rectangle(ox - 50, oy - 50, W + 100, H + 100) });
  }

  // Mitte der Kannenöffnung in Seiten-Koordinaten (berücksichtigt das Kippen)
  kannenOeffnung() {
    const r = this.welt.toLocal(this.kanne.toGlobal(this.kannenHals, this._pg), undefined, this._pl);
    return { x: r.x, y: r.y };
  }

  deckelAuf(auf) {
    const d = this.kannenDeckel;
    if (!d || d.destroyed) return;
    this.tween(d, { rotation: auf ? 1.0 : 0, y: this.kannenDeckelY - (auf ? 14 : 0) }, 0.4, { ease: 'sineInOut' });
    this.tween(this.kannenLoch, { alpha: auf ? 1 : 0 }, auf ? 0.3 : 0.25, { ease: 'sineInOut', delay: auf ? 0.05 : 0.15 });
    ton('common/klack', { vol: 0.35, abstand: 0.3 });
  }

  // ---------------------------------------------------------------- Fläschchen

  baueFlasche() {
    const f = this.bild('common/futter_milch', FLASCHE.x, FLASCHE.y, FLASCHE.skala, 46);
    f.anchor.set(0.5);
    const m = meta('common/futter_milch');
    const w = m.w || 242;
    const h = m.h || 420;
    const ox = -0.5 * w;
    const oy = -0.5 * h;
    const fm = FLASCHE_MILCH;
    // leeres Glas: ein heller, gläserner Deckel über der Milch – er schrumpft nach oben weg, wenn Milch kommt
    const leer = new PIXI.Graphics()
      .roundRect(0, 0, fm.w, fm.h, 46).fill({ color: 0xe6eef2, alpha: 0.94 })
      .roundRect(fm.w * 0.12, fm.h * 0.08, fm.w * 0.18, fm.h * 0.7, 16).fill({ color: 0xffffff, alpha: 0.6 });
    leer.position.set(ox + fm.x, oy + fm.y);
    f.addChild(leer);
    this.flascheLeer = leer;
    f.visible = false;
    f.alpha = 0;
    this.flasche = f;
    drag(f, {
      pad: 60,
      lift: 1.08,
      heim: { x: FLASCHE.x, y: FLASCHE.y },
      targets: () => (this.phase === 'flasche' && this.kind && !this.kind.destroyed
        ? [{ id: 'kind', ...this.kindMaul(), radius: 300 }] : []),
      onStart: () => { this.flascheGenommen = true; this.flaschenPuls?.stop(); this.flaschenPuls = null; },
      onDrop: (ziel, ctx) => {
        if (ziel && this.phase === 'flasche') this.kindTrinkt();
        else ctx.back(0.5);
      },
    });
  }

  // Kanne antippen: sie kippt zum Fläschchen, die Milch steigt darin hoch
  async flascheFuellen() {
    this.phase = 'fuellt';
    this.kannenPuls?.stop();
    this.kannenPuls = null;
    const f = this.flasche;
    const leer = this.flascheLeer;
    f.position.set(FLASCHE.x, FLASCHE.y);
    f.rotation = 0;
    f.eventMode = 'none';
    leer.scale.y = 1;
    f.visible = true;
    ton('common/plopp', { vol: 0.5 });
    await this.tween(f, { alpha: 1 }, 0.4, { ease: 'sineInOut' });
    this.deckelAuf(true);
    await this.tween(this.kanne, { rotation: KANNE_KIPP }, 0.6, { ease: 'sineInOut' });
    ton('common/giessen', { vol: 0.6, abstand: 1 });
    const ziel = { x: FLASCHE.x, y: FLASCHE.y - 0.5 * 420 * FLASCHE.skala + 6 };   // Sauger oben am Fläschchen
    const p = { k: 0 };
    await this.tween(p, { k: 1 }, 1.4, {
      ease: 'linear',
      onUpdate: () => {
        const o = this.kannenOeffnung();
        const dicke = 12 * Math.sin(Math.min(1, p.k * 1.1) * Math.PI) + 2;
        this.strahl.clear()
          .moveTo(o.x - 20, o.y)
          .quadraticCurveTo(o.x - 70, (o.y + ziel.y) / 2 - 30, ziel.x, ziel.y)
          .stroke({ width: dicke, color: MILCH, cap: 'round' });
        this.strahl.alpha = 1;
        this.strahlZeit = 0.2;
        leer.scale.y = Math.max(0, 1 - p.k * 1.1);
      },
    });
    leer.scale.y = 0;
    this.burst('funkeln', FLASCHE.x, FLASCHE.y - 60, { count: 4 });
    this.deckelAuf(false);
    await this.tween(this.kanne, { rotation: 0 }, 0.6, { ease: 'sineInOut' });
    f.eventMode = 'static';
    this.phase = 'flasche';
    this.flaschenPuls = fx.pulse(f, { staerke: 0.05, periode: 1.6 });
    this.kind?.lookAt(FLASCHE.x);
    if (this.aktiv) this._hinweis = this.after(1.5, () => this.hinweisAnbieten());
  }

  // ---------------------------------------------------------------- Tierkind

  kindMaul() {
    const k = this.kind;
    const m = k.point('mouth');
    return { x: m.x + 30, y: m.y };
  }

  async kindKommt() {
    if (this.kind && !this.kind.destroyed) return;
    const id = this.kindId;
    const skala = KIND_HOEHE / (meta(`tiere/${id}_idle`).h || 900);
    const k = new Actor(id, { x: -1500, y: KIND_ORT.y, scale: skala, parent: this.welt, z: 60 });
    this.kind = k;
    k.onTap(() => {
      laut(id, 1);
      if (this.phase === 'flasche' || this.phase === 'kanne' || this.phase === 'fuellt') {
        fx.wobble(k, 0.05);
        if (!k._blase) k.bubble('common/futter_milch', 2.2);
      } else {
        k.hop(50);
      }
    });
    laut(id, 0.5);
    await k.walkTo(KIND_ORT.x, KIND_ORT.y, { tempo: 330 });
    if (k.destroyed) return;
    k.lookAt(9999);
    k.bubble('common/futter_milch', 2.6);
    this.kannenPuls = this.phase === 'kanne' ? fx.pulse(this.kanne, { staerke: 0.03, periode: 1.6 }) : null;
    this.kindWunschZeit = 7;
  }

  async kindTrinkt() {
    this.phase = 'trinkt';
    const f = this.flasche;
    const k = this.kind;
    f.eventMode = 'none';
    const maul = this.kindMaul();
    // Fläschchen legt sich an das Maul (Sauger zeigt zum Tierkind)
    await this.tween(f, { x: maul.x + 70, y: maul.y - 10, rotation: -1.15 }, 0.5, { ease: 'sineInOut' });
    k.pose('eat');
    for (let i = 0; i < 4; i++) {
      ton('common/mampf', { vol: 0.6 - i * 0.08, abstand: 0.3 });
      this.tween(this.flascheLeer, { scaleY: (i + 1) / 4 }, 0.6, { ease: 'sineInOut' });
      this.tween(f, { x: maul.x + 70 + (i % 2 ? 6 : -6) }, 0.3, { ease: 'sineInOut' });
      await this.wait(0.65);
    }
    // leeres Fläschchen geht weich weg
    this.tween(f, { alpha: 0 }, 0.5, { ease: 'sineInOut' }).then(() => { if (!f.destroyed) { f.visible = false; f.rotation = 0; } });
    if (k.destroyed) return;
    k.pose('idle');
    k.cheer();
    belohne(this, 'tier_' + k.tierId, k.x + 60, k.y - 520);
    await this.wait(2.4);
    if (k.destroyed) return;
    // satt und müde: ins Heu zum Schlafen
    this.kind = null;
    await this.schlafKind(k.tierId, k);
    this.neueRunde();
  }

  // Ein Tierkind kuschelt sich ins Heu (k = das laufende Kind; null = beim Aufbau schon da). Sind alle Plätze
  // belegt, wacht das älteste auf und geht hinaus.
  async schlafKind(id, k) {
    if (this.schlaefer.length >= SCHLAF.length) {
      const alt = this.schlaefer.shift();
      alt.pose('idle');
      alt.eventMode = 'none';
      laut(alt.tierId, 1);
      alt.walkTo(-1550, alt.y + 30, { tempo: 200 }).then(() => { if (!alt.destroyed) alt.destroy({ children: true }); });
    }
    const belegt = this.schlaefer.map((s) => s.platz);
    const platz = SCHLAF.find((p) => !belegt.includes(p)) || SCHLAF[0];
    const skala = SCHLAF_HOEHE / (meta(`tiere/${id}_idle`).h || 900);
    if (!k) {
      k = new Actor(id, { x: platz.x, y: platz.y, scale: skala, parent: this.welt, z: 10 });
      k.pose('sleep');
    } else {
      ton('common/hupf', { vol: 0.4, abstand: 0.2 });
      // in zwei Hüpfern hinüber ins Heu, dabei kleiner (es ist weiter hinten)
      this.tween(k, { scale: skala }, 1.2, { ease: 'sineInOut' });
      const mitte = { x: (k.x + platz.x) / 2, y: (k.y + platz.y) / 2 + 40 };
      await k.hopTo(mitte.x, mitte.y, { hoehe: 90, dauer: 0.6 });
      if (k.destroyed) return;
      k.zIndex = 10;
      await k.hopTo(platz.x, platz.y, { hoehe: 90, dauer: 0.6, staub: false });
      if (k.destroyed) return;
      k.position.set(platz.x, platz.y);
      ton('common/rascheln', { vol: 0.5 });
      k.pose('sleep');
    }
    k.platz = platz;
    k.flip = platz.x > -950;
    k.onTap(() => {
      ton('common/schnarchen', { vol: 0.4, abstand: 1.2 });
      fx.wobble(k, 0.04);
      this.burst('zzz', k.x + 40, k.y - 150, { count: 1 });
    }, { pad: 60 });
    this.schlaefer.push(k);
    store.set(SCHLAF_KEY, this.schlaefer.map((s) => s.tierId));
  }

  // ---------------------------------------------------------------- Katze und Schälchen

  baueKatze() {
    const p = this.punkt('katze', { x: -855, y: 1400 });
    const skala = 400 / (meta('tiere/katze_idle').h || 900);
    this.katze = new Actor('katze', { x: p.x - 40, y: p.y, scale: skala, parent: this.welt, z: 40 });
    this.katzeHeim = { x: p.x - 40, y: p.y };
    this.katze.onTap(() => {
      laut('katze', 1.2);
      if (this.schaleVoll) this.schlabbern();
      else {
        fx.wobble(this.katze, 0.05);
        this.zeigeKatzenWunsch();
      }
    });

    // Schälchen rechts neben der Katze; leer = Milchfläche mit einem Boden-Oval abgedeckt
    this.schale = this.bild('bauernhof/schale_milch', p.x + 240, p.y + 30, SCHALE_SKALA, 41);
    const m = meta('bauernhof/schale_milch');
    const ox = 155 - m.ax * m.w;
    const oy = 60 - m.ay * m.h;
    // leer: matter, schattiger Schalenboden (sieht nicht nach Wasser aus), oben ein dunkler Schattenrand
    this.schaleLeer = new PIXI.Graphics()
      .ellipse(ox, oy, 104, 36).fill(0x2c6066)
      .ellipse(ox, oy + 9, 84, 24).fill(0x356e74)
      .ellipse(ox + 10, oy + 14, 56, 13).fill(0x3f7a80);
    this.schale.addChild(this.schaleLeer);
    this.schaleVoll = false;
    tap(this.schale, () => {
      if (this.schaleVoll) this.schlabbern();
      else {
        fx.wobble(this.schale, 0.05);
        ton('common/klack', { vol: 0.4 });
        this.zeigeKatzenWunsch();
      }
    }, { sound: null, squash: false, pad: 50 });
  }

  zeigeKatzenWunsch() {
    if (!this.katze._blase) this.katze.bubble('bauernhof/schale_milch', 2.4);
  }

  fuelleSchale() {
    if (this.schaleVoll) return;
    this.schaleVoll = true;
    ton('common/plopp', { vol: 0.6 });
    this.tween(this.schaleLeer, { alpha: 0 }, 0.9, { ease: 'sineInOut' });
    this.burst('funkeln', this.schale.x, this.schale.y - 120, { count: 4 });
    this.katze.lookAt(this.schale.x);
  }

  async schlabbern() {
    if (this.katze._schlabbert || !this.schaleVoll) return;
    const k = this.katze;
    k._schlabbert = true;
    // zum Schälchen hüpfen (der Kopf ist dann über dem Rand)
    const amNapf = { x: this.schale.x - 175, y: this.katzeHeim.y };
    k.lookAt(this.schale.x);
    await k.hopTo(amNapf.x, amNapf.y, { hoehe: 40, dauer: 0.45, staub: false });
    if (k.destroyed) return;
    k.position.set(amNapf.x, amNapf.y);
    k.pose('eat');
    ton('common/mampf', { vol: 0.8, abstand: 0.3 });
    this.tween(this.schaleLeer, { alpha: 1 }, 2.0, { ease: 'sineInOut' });
    await this.wait(0.8);
    ton('common/mampf', { vol: 0.7, abstand: 0.3 });
    await this.wait(0.8);
    ton('common/mampf', { vol: 0.6, abstand: 0.3 });
    await this.wait(0.6);
    this.schaleVoll = false;
    k.pose('idle');
    await k.cheer();
    if (k.destroyed) return;
    // satt und zufrieden zurück an den alten Platz
    await k.hopTo(this.katzeHeim.x, this.katzeHeim.y, { hoehe: 40, dauer: 0.5, staub: false });
    if (k.destroyed) return;
    k.position.set(this.katzeHeim.x, this.katzeHeim.y);
    k.lookAt(this.schale.x);
    k._schlabbert = false;
  }

  // ---------------------------------------------------------------- Hilfen

  bild(id, x, y, skala, z) {
    const s = new PIXI.Sprite(tex(id));
    const m = meta(id);
    s.anchor.set(m.ax, m.ay);
    s.scale.set(skala);
    s.position.set(x, y);
    s.zIndex = z;
    s.label = id;
    this.welt.addChild(s);
    return s;
  }

  update(dt) {
    // Milchstrahl blendet weich aus
    if (this.strahlZeit > 0) {
      this.strahlZeit -= dt;
      if (this.strahlZeit <= 0) this.tween(this.strahl, { alpha: 0 }, 0.15);
    }
    // die Kuh kaut ab und zu (kleines Nicken)
    this.kauZeit -= dt;
    if (this.kauZeit <= 0) {
      this.kauZeit = rand(9, 14);
      if (!this.giesst) this.kuh.nod();
    }
    // Wünsche zeigen (nur, wenn das Kind gerade nichts tut)
    const ruhig = this.szene.idle > 2;
    if (this.phase === 'heu') {
      this.kuhWunschZeit -= dt;
      if (this.kuhWunschZeit <= 0) {
        this.kuhWunschZeit = rand(6, 8);
        if (ruhig || this.runde === 1) this.zeigeKuhWunsch();
      }
    }
    if ((this.phase === 'kanne' || this.phase === 'flasche') && this.kind && !this.kind.destroyed) {
      this.kindWunschZeit -= dt;
      if (this.kindWunschZeit <= 0) {
        this.kindWunschZeit = rand(7, 9);
        if (ruhig && !this.kind._blase) this.kind.bubble('common/futter_milch', 2.2);
      }
    }
    this.wunschZeit -= dt;
    if (this.wunschZeit <= 0) {
      this.wunschZeit = rand(12, 16);
      if (!this.schaleVoll && ruhig && this.phase !== 'heu') this.zeigeKatzenWunsch();
    }
    // schlafende Tierkinder im Heu: ab und zu ein langsames Z
    if (this.schlaefer.length) {
      this.zzzZeit -= dt;
      if (this.zzzZeit <= 0) {
        this.zzzZeit = rand(2.5, 3.5);
        const s = pick(this.schlaefer);
        if (s && !s.destroyed && s.poseName === 'sleep') this.burst('zzz', s.x + 40, s.y - 140, { count: 1 });
      }
    }
  }

  hinweise() {
    // Eimer wird gerade umgefüllt: auf die Kanne zeigen (nie leer – sonst zeigte die Hand auf den Pfeil)
    if (this.giesst) return [this.kanne];
    const liste = [];
    switch (this.phase) {
      case 'heu':
        if (this.futter.visible) liste.push({ von: this.futter, nach: this.kuh });
        break;
      case 'melken':
        if (this.spritzer >= SPRITZER_VOLL) liste.push({ von: this.eimer, nach: this.kanne });
        else liste.push({ x: this.euter.x, y: this.euter.y + 10 });
        break;
      case 'kanne':
        // die Kanne ist sofort antippbar – auch, während das Tierkind noch hereinläuft
        liste.push(this.kanne);
        break;
      case 'flasche':
        if (this.kind && !this.kind.destroyed) liste.push({ von: this.flasche, nach: this.kind });
        break;
      default:
        break;
    }
    // die Katze nur, wenn sonst nichts zu tun ist (der Ablauf geht vor)
    if (!liste.length && this.schaleVoll && !this.katze._schlabbert) liste.push(this.schale);
    // kurze Übergänge (Fläschchen füllt sich, Tierkind trinkt): auf das Tierkind bzw. die Kuh zeigen
    if (!liste.length) liste.push(this.kind && !this.kind.destroyed ? this.kind : this.kuh);
    return liste;
  }
}
