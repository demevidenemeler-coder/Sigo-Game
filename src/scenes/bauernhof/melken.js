// Seite 3 – Melken: Die Kuh steht im Melkstand, davor der Eimer. Euter antippen oder halten → Milchstrahl,
// der Eimer füllt sich (leer → halb → voll). Vollen Eimer zur Milchkanne ziehen → wird umgefüllt, die Kuh freut
// sich, und das Schälchen der Katze wird voll. Schälchen antippen → die Katze schlabbert. Nach drei Eimern gibt
// es einen Sticker. Heubündel zur Kuh ziehen → sie frisst.

import { Actor, voice, fx, meta, tex, tap, drag, hold, rand, PIXI } from '../../engine/index.js';
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
const EIMER_PRO_STICKER = 3;
const MILCH = 0xfffbf0;
const STRAHL_ZEIT = 0.45;     // so lange bleibt ein Milchstrahl sichtbar (auch bei einem einzelnen Tipp)
// Milchkanne (Bild 304×420): der Deckel reicht bis etwa Bildzeile 90, darunter der Hals mit der Öffnung
const KANNE_DECKEL_Y = 90;
const KANNE_HALS = { x: 152, y: 96, rx: 62, ry: 15 };

export class Melken extends Seite {
  static hg = 'bauernhof/hg_melken';

  aufbau() {
    this.spritzer = 0;
    this.eimerZahl = 0;
    this.giesst = false;
    this.strahlZeit = 0;

    // Kuh (eigenes Bild von der Seite, mit Euter)
    const k = this.punkt('kuh', { x: 0, y: 1240 });
    this.kuh = bildFigur('bauernhof/kuh_melken', 'kuh', {
      x: k.x, y: k.y, scale: KUH_SKALA, parent: this.welt, z: 20, punkte: { kopf: [790, 120] },
    });
    this.kuh.onTap(() => {
      fx.wobble(this.kuh, 0.04);
      laut('kuh', 1.5);
      this.kuh.nod();
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
    this.baueHeu();

    this._pg = new PIXI.Point();   // wiederverwendete Punkte (keine neuen Objekte pro Bild)
    this._pl = new PIXI.Point();
    this.giessTipp = 0;
    this.kauZeit = rand(8, 12);
    this.wunschZeit = rand(9, 13);
  }

  betreten() {
    // Hinweis kurz nach dem Betreten anmelden – nur, solange die Seite zu sehen ist und noch nicht gemolken wurde
    this._hinweis?.kill();
    const passt = () => this.aktiv && !this.gemolken;
    this._hinweis = this.after(2.5, () => { if (passt()) voice('bauernhof_melken', { nurWenn: passt }); });
  }

  verlassen() {
    this._hinweis?.kill();
    this._hinweis = null;
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
      targets: () => [{ id: 'kanne', x: this.kanne.x, y: this.kanne.y - 200, radius: 330 }],
      onStart: () => { this.puls?.stop(); this.puls = null; },
      onDrop: (ziel, ctx) => {
        if (ziel) this.umfuellen(ctx);
        else ctx.back();
      },
    });
  }

  async umfuellen(ctx) {
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
    if (this.eimerZahl % EIMER_PRO_STICKER === 0) {
      this.after(1.2, () => belohne(this, 'tier_kuh', this.kuh.x + 120, this.kuh.y - 680));
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
      fx.wobble(k, 0.05);
      ton('common/klack', { vol: 0.5 });
    }, { sound: null, squash: false, hitArea: new PIXI.Rectangle(ox - 50, oy - 50, W + 100, H + 100) });
  }

  // Mitte der Kannenöffnung in Seiten-Koordinaten
  kannenOeffnung() {
    const k = this.kanne;
    return { x: k.x + this.kannenHals.x * k.scale.x, y: k.y + this.kannenHals.y * k.scale.y };
  }

  deckelAuf(auf) {
    const d = this.kannenDeckel;
    if (!d || d.destroyed) return;
    this.tween(d, { rotation: auf ? 1.0 : 0, y: this.kannenDeckelY - (auf ? 14 : 0) }, 0.4, { ease: 'sineInOut' });
    this.tween(this.kannenLoch, { alpha: auf ? 1 : 0 }, auf ? 0.3 : 0.25, { ease: 'sineInOut', delay: auf ? 0.05 : 0.15 });
    ton('common/klack', { vol: 0.35, abstand: 0.3 });
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

  // ---------------------------------------------------------------- Heu

  baueHeu() {
    // Heubündel liegt auf dem Boden zwischen Katze und Kuh (Mitte; die Unterkante liegt bei y≈1250)
    this.heuOrt = { x: -520, y: 1175 };
    this.heu = this.bild('common/futter_heu', this.heuOrt.x, this.heuOrt.y, 0.52, 45);
    this.heu.anchor.set(0.5);
    this.heu.futterId = 'futter_heu';
    drag(this.heu, {
      pad: 40,
      onStart: () => ton('common/rascheln', { vol: 0.5, abstand: 0.5 }),
      targets: () => {
        const m = this.kuh.point('mouth');
        return [{ id: 'kuh', x: m.x - 40, y: m.y + 40, radius: 300 }];
      },
      onDrop: (ziel, ctx) => {
        if (!ziel) return;
        fuettere(this, this.kuh, this.heu, { futter: 'common/futter_heu', behalten: true, heim: this.heuOrt })
          .then((ok) => {
            if (!ok) return;
            this.kuh.nod(); // kaut genüsslich
            this.heuZurueck();
          });
      },
    });
  }

  heuZurueck() {
    const h = this.heu;
    if (h.destroyed) return;
    this.after(1.2, () => {
      h.position.set(this.heuOrt.x, this.heuOrt.y - 30);
      h.alpha = 0;
      h.visible = true;
      this.tween(h, { alpha: 1, y: this.heuOrt.y }, 0.6, { ease: 'sineInOut' });
    });
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
    // die Katze wünscht sich Milch
    this.wunschZeit -= dt;
    if (this.wunschZeit <= 0) {
      this.wunschZeit = rand(12, 16);
      if (!this.schaleVoll && this.szene.idle > 2) this.zeigeKatzenWunsch();
    }
  }

  hinweise() {
    if (this.giesst) return [];
    const liste = [];
    if (this.spritzer >= SPRITZER_VOLL) liste.push({ von: this.eimer, nach: this.kanne });
    else liste.push({ x: this.euter.x, y: this.euter.y + 10 });
    if (this.schaleVoll) liste.push(this.schale);
    if (this.heu.visible) liste.push({ von: this.heu, nach: this.kuh });
    return liste;
  }
}
