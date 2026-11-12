// Seite 1: Das Gemüsebeet.
// Fünf Erdhügel. Unten liegen fünf Samentüten: auf einen freien Hügel ziehen (oder antippen → nächster freier
// Hügel) → die Tüte rieselt Samen, ein Keim erscheint. Die Gießkanne über die Pflanze ziehen/halten → sie kippt,
// Tropfen fallen, die Pflanze wächst weich in zwei Schritten. Reife Pflanze antippen → die Ernte hüpft in den Korb,
// Karotten bekommt der Hase. Fünf Ernten im Korb → Sticker, der Korb wird wieder leer.
// Kleine Gäste: Biene, Marienkäfer, Schnecke, Regenwurm, ein Vogel auf dem Zaun.

import {
  tap, drag, sfx, voice, note, fx, Actor, spr, meta, rand, pick, clamp, killTweensOf, PIXI,
} from '../../engine/index.js';
import { Seite } from '../../gemeinsam/seiten.js';
import { fuettere } from '../../gemeinsam/futter.js';
import { belohne } from '../../gemeinsam/sticker.js';
import { umhängen, skalaFür, bogen, gleitDauer, Vogel, Flieger } from './helfer.js';
import { bauKorb } from './korb.js';

// Pflanzen: Bilder der drei Stufen (Keim, halb, reif), Darstellungshöhe je Stufe, Ernte-Bild
const PFLANZEN = {
  karotte: {
    stufen: ['garten/keim', 'garten/karotte_2', 'garten/karotte_3'], höhe: [140, 280, 330],
    ernte: 'common/futter_karotte', futter: 'futter_karotte',
  },
  sonnenblume: {
    stufen: ['garten/keim', 'garten/sonnenblume_2', 'garten/sonnenblume_3'], höhe: [140, 320, 460],
    ernte: 'garten/ernte_sonnenblume',
  },
  erdbeere: {
    stufen: ['garten/keim', 'garten/erdbeere_2', 'garten/erdbeere_3'], höhe: [140, 230, 270],
    ernte: 'common/futter_erdbeere',
  },
  tomate: {
    stufen: ['garten/keim', 'garten/tomate_2', 'garten/tomate_3'], höhe: [140, 320, 390],
    ernte: 'garten/ernte_tomate',
  },
  kuerbis: {
    stufen: ['garten/keim', 'garten/kuerbis_2', 'garten/kuerbis_3'], höhe: [140, 230, 230],
    ernte: 'garten/ernte_kuerbis',
  },
};
const SORTEN = ['karotte', 'sonnenblume', 'erdbeere', 'tomate', 'kuerbis'];
const MAX_BREITE = 330;        // so breit darf eine Pflanze auf ihrem Hügel höchstens werden
const PFLANZ_TIEFE = 50;       // Fuß der Pflanze liegt so weit unter der Hügelkuppe
const GIESS_ZEIT = 1.1;        // Sekunden Wasser bis zum nächsten Wachsen
const KORB_RUNDE = 5;          // so viele Ernten im Korb → Sticker
const TROPFEN = 22;            // Vorrat an Wassertropfen

const KANNE_RUHE = { x: -905, y: 1385 };
const KANNE_SKALA = 0.72;
const TÜLLE = { x: 385 - 210, y: 88 - 151 };   // Brausekopf relativ zur Bildmitte (Punkt tuelle aus pack.json)

export class Beet extends Seite {
  static hg = 'garten/hg_beet';

  aufbau() {
    this.zeit = 0;
    this.korbZahl = 0;
    this.giessTon = 0;
    this.hinweisSorte = 0;
    this.sät = false;          // läuft gerade eine Aussaat?
    this.saatSchlange = [];    // weitere Aussaaten warten hier (Ruhe: immer nur eine Tüte unterwegs)

    this.baueHügel();
    this.baueKanne();
    this.baueKorbUndHase();
    this.baueLeiste();
    this.baueGäste();
    this.baueTropfen();

    // Der Hase zeigt ab und zu, was er gern hätte (nur, wenn gerade niemand spielt)
    this.every(11, () => {
      if (this.aktiv && this.szene.idle > 3 && !this.hase._isst) this.zeigeWunsch();
    });
  }

  betreten() {
    if (this.besuche === 1) voice('garten_hallo');
    // Hinweis „Zieh eine Samentüte auf die Erde" bei jedem Betreten anbieten (der Kern sagt ihn höchstens einmal am
    // Tag) – nur, solange die Seite zu sehen ist und das Kind auf dieser Seite noch keine Tüte genommen hat und
    // nichts wächst. nurWenn wird auch gefragt, wenn der Satz erst nach einem anderen an die Reihe kommt.
    this.tüteHier = false;
    this._hinweis?.kill();
    const passt = () => this.aktiv && !this.tüteHier && !this.sät &&
      this.plätze.every((p) => p.stufe === 0 && !p.belegt);
    this._hinweis = this.after(this.besuche === 1 ? 3.2 : 2.5, () => {
      if (passt()) voice('garten_saeen', { nurWenn: passt });
    });
  }

  // ---------------------------------------------------------------- Hügel und Pflanzen

  baueHügel() {
    const ersatzX = [-980, -557, -140, 278, 690];
    this.plätze = ersatzX.map((ex, i) => {
      const p = this.punkt('beet' + (i + 1), { x: ex, y: 1035 });
      const c = new PIXI.Container({ label: 'beet' + (i + 1) });
      c.position.set(p.x, p.y + PFLANZ_TIEFE);
      c.zIndex = 100 + i;
      this.welt.addChild(c);
      const platz = {
        i, c, x: p.x, y: p.y + PFLANZ_TIEFE, sorte: null, stufe: 0, sprite: null, höhe: 0,
        wasser: 0, belegt: false, phase: rand(0, 6),
      };
      tap(c, () => this.tippePlatz(platz), {
        sound: null, squash: false, hitArea: new PIXI.Rectangle(-150, -200, 300, 270),
      });
      return platz;
    });
  }

  freierPlatz() {
    return this.plätze.find((p) => p.stufe === 0 && !p.belegt) || null;
  }

  // Tippfläche passend zur Pflanze (mindestens 300 × 270)
  setzeFläche(platz) {
    const h = Math.max(200, platz.höhe + 40);
    platz.c.hitArea = new PIXI.Rectangle(-150, -h, 300, h + 70);
  }

  setzePflanze(platz, sorte, stufe, { weich = true } = {}) {
    const cfg = PFLANZEN[sorte];
    const id = cfg.stufen[stufe - 1];
    const s = skalaFür(id, cfg.höhe[stufe - 1], MAX_BREITE);
    const alt = platz.sprite;
    const neu = spr(id, { parent: platz.c });
    platz.sorte = sorte;
    platz.stufe = stufe;
    platz.sprite = neu;
    platz.höhe = (meta(id).h || neu.texture.height) * s;
    platz.wasser = 0;
    this.setzeFläche(platz);
    if (weich) {
      neu.alpha = 0;
      neu.scale.set(s * (alt ? 0.85 : 0.2));
      this.tween(neu, { alpha: 1 }, alt ? 0.6 : 0.3, { ease: 'sineInOut' });
      this.tween(neu, { scale: s }, alt ? 0.8 : 0.55, { ease: 'backOut' });
    } else {
      neu.scale.set(s);
    }
    if (alt) {
      killTweensOf(alt);
      this.tween(alt, { alpha: 0 }, 0.6, { ease: 'sineInOut' }).then(() => { if (!alt.destroyed) alt.destroy(); });
    }
  }

  tippePlatz(platz) {
    if (platz.belegt) {
      if (platz.sprite) fx.wobble(platz.sprite, 0.05);
      return;
    }
    if (platz.stufe === 0) {
      // leerer Hügel: Erde krümelt, die erste Samentüte hüpft als Hinweis
      sfx('common/graben', { vol: 0.4 });
      this.burst('staub', platz.x, platz.y - 30, { count: 3 });
      const tüte = this.leiste.sprite(SORTEN[this.hinweisSorte % SORTEN.length]);
      if (tüte) fx.pop(tüte, 0.15);
    } else if (platz.stufe < 3) {
      // wächst noch: raschelt, die Gießkanne wackelt als Hinweis
      fx.wobble(platz.sprite, 0.06);
      sfx('common/rascheln', { vol: 0.45 });
      if (!this.kannenZug.isDragging()) fx.wobble(this.kanne, 0.06);
    } else {
      this.ernten(platz);
    }
  }

  wachsen(platz) {
    if (platz.stufe < 1 || platz.stufe >= 3) return;
    this.setzePflanze(platz, platz.sorte, platz.stufe + 1);
    sfx('common/wachsen', { vol: 0.8 });
    this.burst('funkeln', platz.x, platz.y - platz.höhe * 0.6, { count: 4 });
    // „Fertig! Tipp die Pflanze an." – nur, solange noch eine reife Pflanze steht und die Seite zu sehen ist
    const reif = () => this.aktiv && this.plätze.some((p) => p.stufe === 3 && !p.belegt);
    if (platz.stufe === 3) this.after(0.9, () => { if (reif()) voice('garten_ernten', { nurWenn: reif }); });
  }

  // ---------------------------------------------------------------- Säen

  baueLeiste() {
    this.leiste = this.tray({
      items: SORTEN.map((id) => ({ id, tex: 'garten/tuete_' + id })),
      abstand: 250,
      onPick: (item, kopie) => this.tüteGegriffen(item, kopie),
    });
  }

  tüteGegriffen(item, kopie) {
    this.tüteHier = true;
    drag(kopie, {
      targets: () => this.plätze.filter((p) => p.stufe === 0 && !p.belegt)
        .map((p) => ({ platz: p, x: p.x, y: p.y - 80, radius: 250 })),
      back: false,
      lift: 1.12,
      onDrop: (ziel, ctx) => {
        kopie.eventMode = 'none';
        let platz = ctx.cancelled ? null : ziel?.platz;
        // nur angetippt (kaum bewegt): zum nächsten freien Hügel
        if (!platz && !ctx.cancelled && Math.hypot(ctx.x - ctx.startX, ctx.y - ctx.startY) < 70) platz = this.freierPlatz();
        if (platz && !platz.belegt && platz.stufe === 0) this.säeBald(platz, item.id, kopie);
        else this.tüteWeg(kopie, ctx);
      },
    });
  }

  tüteWeg(kopie, ctx) {
    // zurück zur Leiste (der Kern gleitet mit cubicOut: weiter Weg → länger, damit sie nicht davonschießt)
    ctx.back(gleitDauer(ctx.heimX - kopie.x, ctx.heimY - kopie.y, 0.4, 3)).then(() => {
      if (kopie.destroyed) return;
      this.tween(kopie, { alpha: 0, scale: Math.abs(kopie.scale.y) * 0.5 }, 0.25, { ease: 'sineInOut' })
        .then(() => { if (!kopie.destroyed) kopie.destroy(); });
    });
  }

  // Aussaat anmelden: der Hügel ist sofort reserviert; läuft schon eine, wartet diese Tüte (leicht kleiner und
  // durchscheinend an ihrem Platz), bis sie dran ist – so fliegen bei schnellem Mehrfach-Tippen nie viele Tüten
  // gleichzeitig und die Geräusche stapeln sich nicht.
  säeBald(platz, sorte, kopie) {
    platz.belegt = true;
    this.hinweisSorte++;
    umhängen(kopie, this.vorn);
    kopie.zIndex = 900;
    if (!this.sät) {
      this.säen(platz, sorte, kopie, false);
      return;
    }
    killTweensOf(kopie, ['alpha']);
    this.tween(kopie, { alpha: 0.75 }, 0.3, { ease: 'sineInOut' });
    this.saatSchlange.push({ platz, sorte, kopie });
  }

  nächsteSaat() {
    const n = this.saatSchlange.shift();
    if (!n) return;
    if (n.kopie.destroyed) { this.nächsteSaat(); return; }
    killTweensOf(n.kopie, ['alpha']);
    this.tween(n.kopie, { alpha: 1 }, 0.2, { ease: 'sineInOut' });
    this.säen(n.platz, n.sorte, n.kopie, true);
  }

  async säen(platz, sorte, kopie, folge) {
    this.sät = true;
    const leiser = folge ? 0.6 : 1;   // Folge-Aussaaten etwas leiser
    killTweensOf(kopie, ['x', 'y', 'rotation']);
    // Tüte schwebt über den Hügel und kippt
    await bogen(this, kopie, platz.x - 70, platz.y - 230, { dauer: 0.45, höhe: 60 });
    await this.tween(kopie, { rotation: 0.95 }, 0.3, { ease: 'sineInOut' });
    // Samen rieseln aus der Öffnung auf den Hügel
    sfx('common/sand', { vol: 0.45 * leiser });
    for (let k = 0; k < 5; k++) {
      const korn = new PIXI.Graphics().ellipse(0, 0, 9, 7).fill(0x8a5a2b).ellipse(-2, -2, 4, 3).fill({ color: 0xffffff, alpha: 0.25 });
      korn.position.set(platz.x + 8 + rand(-10, 10), platz.y - 300);
      korn.zIndex = 890;
      korn.alpha = 0;
      this.vorn.addChild(korn);
      const d = k * 0.12;
      this.tween(korn, { alpha: 1 }, 0.1, { delay: d });
      this.tween(korn, { y: platz.y - 40 + rand(-8, 8), x: platz.x + rand(-30, 30) }, 0.5, { ease: 'quadIn', delay: d })
        .then(() => this.tween(korn, { alpha: 0 }, 0.3))
        .then(() => { if (!korn.destroyed) korn.destroy(); });
    }
    await this.wait(0.75);
    this.tween(kopie, { alpha: 0, scale: Math.abs(kopie.scale.y) * 0.6 }, 0.35, { ease: 'sineInOut' })
      .then(() => { if (!kopie.destroyed) kopie.destroy(); });
    this.burst('staub', platz.x, platz.y - 25, { count: 3 });
    sfx('common/plopp', { vol: 0.8 * leiser });
    this.setzePflanze(platz, sorte, 1);
    platz.belegt = false;
    // „Jetzt gießen!" – nicht, wenn das Kind die Gießkanne schon hält (oder die Seite nicht mehr zu sehen ist)
    const durst = () => this.aktiv && !this.kannenZug.isDragging() &&
      this.plätze.some((p) => p.stufe >= 1 && p.stufe < 3 && !p.belegt);
    if (durst()) voice('garten_giessen', { nurWenn: durst });
    if (!this.saatSchlange.length) {
      this.after(0.7, () => { if (!this.kannenZug.isDragging()) fx.wobble(this.kanne, 0.07); });
    }
    // die nächste wartende Tüte nach einer kleinen Pause
    await this.wait(0.35);
    this.sät = false;
    this.nächsteSaat();
  }

  // ---------------------------------------------------------------- Gießen

  baueKanne() {
    this.kanne = spr('common/giesskanne', {
      anchor: 0.5, x: KANNE_RUHE.x, y: KANNE_RUHE.y, scale: KANNE_SKALA, parent: this.welt, z: 700,
    });
    this.kannenZug = drag(this.kanne, {
      back: false,
      lift: 1.06,
      pad: 30,
      onStart: () => sfx('common/tipp', { vol: 0.5 }),
      onDrop: () => this.kanneHeim(),
    });
    this._g = new PIXI.Point();
    this._l = new PIXI.Point();
    this._tülle = new PIXI.Point(TÜLLE.x, TÜLLE.y);
  }

  kanneHeim() {
    killTweensOf(this.kanne, ['x', 'y']);
    const k = this.kanne;
    // Weg-abhängig, damit die Kanne von weit oben nicht zurückschießt
    this.tween(k, { x: KANNE_RUHE.x, y: KANNE_RUHE.y }, gleitDauer(KANNE_RUHE.x - k.x, KANNE_RUHE.y - k.y, 0.55),
      { ease: 'sineInOut' });
  }

  // Brausekopf der Kanne in Seiten-Koordinaten (ohne neue Objekte)
  tülle() {
    this.kanne.toGlobal(this._tülle, this._g);
    return this.welt.toLocal(this._g, undefined, this._l);
  }

  baueTropfen() {
    const t = fx.texture('tropfen');
    const s = 30 / Math.max(1, t.width);
    this.tropfen = [];
    for (let i = 0; i < TROPFEN; i++) {
      const d = new PIXI.Sprite(t);
      d.anchor.set(0.5);
      d.scale.set(s);
      d.visible = false;
      d.eventMode = 'none';
      d.zIndex = 950;
      d.vx = 0;
      d.vy = 0;
      d.boden = 0;
      this.vorn.addChild(d);
      this.tropfen.push(d);
    }
    this.tropfenTakt = 0;
  }

  giessen(dt) {
    const k = this.kanne;
    const zieht = this.kannenZug.isDragging();
    let über = false;
    let ziel = null;
    let t = null;
    if (zieht) {
      t = this.tülle();
      über = t.y < 1150 && t.x > -1250 && t.x < 1050;
      for (const p of this.plätze) {
        if (p.stufe < 1 || p.belegt) continue;
        if (Math.abs(t.x + 50 - p.x) < 175 && t.y < p.y - 40 && t.y > p.y - 900) ziel = p;
      }
    }
    // Kippen (weich)
    const soll = über ? 0.62 : 0;
    k.rotation += (soll - k.rotation) * (1 - Math.exp(-dt * 5));
    const kippt = über && k.rotation > 0.35;
    this.giessTon -= dt;
    if (kippt) {
      if (this.giessTon <= 0) {
        sfx('common/giessen', { vol: 0.5 });
        this.giessTon = 2.6;
      }
      // neue Tropfen
      this.tropfenTakt -= dt;
      while (this.tropfenTakt <= 0) {
        this.tropfenTakt += 1 / 16;
        const d = this.tropfen.find((q) => !q.visible);
        if (!d) break;
        d.visible = true;
        d.alpha = 0.9;
        d.position.set(t.x + rand(-10, 10), t.y + rand(-4, 8));
        d.vx = rand(30, 80);
        d.vy = rand(20, 90);
        d.boden = ziel ? ziel.y - 30 + rand(-10, 15) : Math.min(1180, t.y + 420);
      }
      if (ziel && ziel.stufe < 3) {
        ziel.wasser += dt;
        if (ziel.wasser >= GIESS_ZEIT) this.wachsen(ziel);
      }
    } else {
      this.tropfenTakt = 0;
    }
    // Tropfen fallen
    for (const d of this.tropfen) {
      if (!d.visible) continue;
      d.vy += 1100 * dt;
      d.x += d.vx * dt;
      d.y += d.vy * dt;
      if (d.y >= d.boden) {
        d.alpha -= dt * 8;
        if (d.alpha <= 0) d.visible = false;
      }
    }
  }

  // ---------------------------------------------------------------- Ernten, Korb, Hase

  baueKorbUndHase() {
    // Korb rechts neben der Leiste (unten rechts bleibt frei)
    this.korb = bauKorb(this, 'common/icon_korb', {
      x: 850, y: 1390, scale: 0.6, z: 320,
      rand: [[0, 196], [60, 214], [178, 232], [296, 214], [356, 196]],
    });
    const hp = this.punkt('hase', { x: 1135, y: 1190 });
    // Der Punkt liegt sehr weit rechts (am Rand des Kernbereichs, unter dem Blätter-Pfeil): nach links auf die
    // Ecke des Beets, damit Hase und Herzen nicht unter dem Pfeil liegen
    this.hase = new Actor('hase', {
      x: Math.min(hp.x, 930), y: hp.y + 20, scale: 0.36, flip: true, parent: this.welt, z: 300,
    });
    this.hase.onTap(() => {
      fx.wobble(this.hase, 0.05);
      this.hase.sound();
      this.zeigeWunsch();
    });
  }

  // Denkblase links über dem Hasen (die Blase des Kerns ginge rechts aus dem Bild)
  zeigeWunsch() {
    if (this.blase && !this.blase.destroyed) return;
    const m = meta('common/blase_denk');
    const schwanz = m.pts?.schwanz || [45, 540];
    const innen = m.pts?.innen || [330, 260];
    const b = new PIXI.Container({ label: 'wunsch' });
    b.zIndex = 900;
    b.eventMode = 'none';
    const s = 300 / (m.w || 600);
    const grund = spr('common/blase_denk', { parent: b });
    grund.anchor.set(schwanz[0] / m.w, schwanz[1] / m.h);
    grund.scale.set(-s, s);
    const bild = spr('common/futter_karotte', { anchor: 0.5, parent: b });
    bild.scale.set(150 / 420);
    bild.position.set(-(innen[0] - schwanz[0]) * s, (innen[1] - schwanz[1]) * s);
    const kopf = this.hase.y - 300;
    b.position.set(this.hase.x - 60, kopf);
    b.alpha = 0;
    b.scale.set(0.6);
    this.welt.addChild(b);
    this.blase = b;
    this.tween(b, { alpha: 1 }, 0.35, { ease: 'sineInOut' });
    this.tween(b, { scale: 1 }, 0.45, { ease: 'backOut' });
    this.after(2.8, () => {
      if (b.destroyed) return;
      this.tween(b, { alpha: 0, scale: 0.85 }, 0.45, { ease: 'sineInOut' })
        .then(() => { if (!b.destroyed) b.destroy({ children: true }); });
    });
  }

  async ernten(platz) {
    const cfg = PFLANZEN[platz.sorte];
    platz.belegt = true;
    sfx('common/rupf', { vol: 0.9 });
    const alt = platz.sprite;
    const h = platz.höhe;
    platz.sprite = null;
    killTweensOf(alt);
    this.tween(alt, { scaleY: alt.scale.y * 1.1 }, 0.12, { ease: 'quadOut' })
      .then(() => !alt.destroyed && this.tween(alt, { alpha: 0, scaleX: alt.scale.x * 0.6, scaleY: alt.scale.y * 0.6 }, 0.35, { ease: 'sineInOut' }))
      .then(() => { if (!alt.destroyed) alt.destroy(); });
    this.burst('staub', platz.x, platz.y - 20, { count: 4 });
    // Hügel ist gleich wieder frei
    this.after(0.55, () => {
      platz.stufe = 0;
      platz.sorte = null;
      platz.höhe = 0;
      platz.belegt = false;
      this.setzeFläche(platz);
    });

    // Die Ernte hüpft heraus …
    const e = spr(cfg.ernte, { anchor: 0.5, parent: this.welt, x: platz.x, y: platz.y - Math.min(h, 300) * 0.45, z: 800 });
    const s = skalaFür(cfg.ernte, 170, 170);
    e.scale.set(s * 0.5);
    e.eventMode = 'none';
    this.tween(e, { scale: s }, 0.35, { ease: 'backOut' });
    await bogen(this, e, e.x, e.y - 120, { dauer: 0.35, höhe: 0 });

    // … zum Hasen (Karotten) oder in den Korb
    if (cfg.futter && !this.hase._isst) {
      const blase = this.blase;
      if (blase && !blase.destroyed) {
        this.tween(blase, { alpha: 0 }, 0.3).then(() => { if (!blase.destroyed) blase.destroy({ children: true }); });
      }
      // Der gemeinsame Fütter-Ablauf fliegt in fester Zeit (0,45 s) zum Maul – vom linken Hügel aus wäre das ein
      // Schuss quer über das Bild. Darum erst ruhig (weg-abhängig) bis kurz vor den Hasen, den letzten kleinen
      // Bogen macht dann fuettere().
      const maul = this.hase.point('mouth') || { x: this.hase.x - 60, y: this.hase.y - 150 };
      const vor = { x: maul.x - 240, y: maul.y - 40 };
      if (Math.hypot(vor.x - e.x, vor.y - e.y) > 120) {
        await bogen(this, e, vor.x, vor.y, { dauer: 0.45, höhe: 90 });
        if (e.destroyed) return;
      }
      const gemocht = await fuettere(this, this.hase, e, { futter: cfg.futter });
      if (gemocht || e.destroyed) return;
    }
    this.inDenKorb(e, s);
  }

  async inDenKorb(e, s) {
    const korb = this.korb;
    const n = korb.liste.length;
    const plätze = [[130, 190], [222, 192], [176, 176], [150, 160], [205, 160], [178, 150]];
    const [px, py] = plätze[n % plätze.length];
    korb.liste.push(e);
    const ziel = korb.lokal(px, py);
    // erst über den Korb fliegen …
    const über = korb.öffnung(px, py - 140);
    await bogen(this, e, über.x, über.y, { dauer: 0.6, höhe: 200, skala: s * 0.62 });
    if (e.destroyed) return;
    // … dann hinein (zwischen die beiden Korb-Ebenen)
    umhängen(e, korb.inhalt);
    await this.tween(e, { y: ziel.y }, 0.22, { ease: 'quadIn' });
    e.x = ziel.x;
    e.ruheY = ziel.y;
    sfx('common/plopp', { vol: 0.7 });
    fx.pop(korb.c, 0.06);
    this.korbZahl++;
    if (this.korbZahl >= KORB_RUNDE) {
      this.korbZahl = 0;
      this.korbRunde();
    }
  }

  async korbRunde() {
    const korb = this.korb;
    const inhalt = korb.liste.splice(0);
    await this.wait(0.4);
    const o = korb.öffnung();
    await belohne(this, 'garten_sonnenblume', o.x, o.y - 160);
    await this.wait(1.2);
    // Korb leert sich weich (die Ernte ist „in der Küche")
    inhalt.forEach((e, i) => {
      if (e.destroyed) return;
      this.tween(e, { alpha: 0 }, 0.6, { ease: 'sineInOut', delay: i * 0.15 })
        .then(() => { if (!e.destroyed) e.destroy(); });
    });
  }

  // ---------------------------------------------------------------- kleine Gäste

  baueGäste() {
    // Biene besucht die Pflanzen
    this.biene = new Flieger(this, 'garten/biene', {
      x: -300, y: 650, maß: 120, art: 'biene', tempo: 85, z: 650,
      wähleZiel: () => {
        const gross = this.plätze.filter((p) => p.stufe >= 2 && !p.belegt);
        if (gross.length && Math.random() < 0.6) {
          const p = pick(gross);
          return { x: p.x + rand(-30, 30), y: p.y - p.höhe * 0.8, sitzen: true, dauer: rand(2.5, 4.5) };
        }
        return { x: rand(-950, 820), y: rand(480, 820), sitzen: false };
      },
    });

    // Marienkäfer krabbelt auf dem vorderen Holzrand (links)
    this.käfer = this.krabbler('garten/marienkaefer', {
      x: -760, y: 1212, maß: 95, bereich: [-1120, -420], tempo: 20, anker: [0.5, 0.75],
      onTap: (k) => {
        note('glocke', pick([88, 91]), { vol: 0.3 });
        this.hüpfer(k.sprite, 40);
        k.richtung *= -1;
      },
    });
    // Schnecke kriecht auf dem Holzrand (rechts)
    this.schnecke = this.krabbler('garten/schnecke', {
      x: 300, y: 1216, maß: 150, bereich: [80, 780], tempo: 9, anker: [0.423, 0.979],
      onTap: (k) => {
        note('xylo', pick([60, 64, 67]), { vol: 0.4 });
        killTweensOf(k.sprite, ['scaleX', 'scaleY']);
        const sx = k.sprite.scale.x;
        const sy = k.sprite.scale.y;
        this.tween(k.sprite, { scaleX: sx * 0.86, scaleY: sy * 0.9 }, 0.25, { ease: 'sineInOut' })
          .then(() => this.tween(k.sprite, { scaleX: sx, scaleY: sy }, 0.6, { ease: 'backOut', delay: 0.6 }));
        k.pause = 2;
      },
    });

    // Regenwurm schaut ab und zu zwischen zwei Hügeln heraus
    this.baueWurm();

    // Vogel auf dem Zaun
    this.vogel = new Vogel(this, { x: -260, y: 788, bereich: [-640, 200], scale: 0.8, z: 50 });
  }

  // Krabbelt langsam hin und her, macht Pausen, dreht um. → {c, sprite, richtung, pause}
  krabbler(id, { x, y, maß, bereich, tempo, anker, onTap }) {
    const c = new PIXI.Container({ label: 'krabbler:' + id });
    c.position.set(x, y);
    c.zIndex = 330;
    const sprite = spr(id, { anchor: anker, parent: c });
    const s = maß / Math.max(sprite.texture.width, sprite.texture.height);
    sprite.scale.set(s);
    this.welt.addChild(c);
    const k = { c, sprite, s, bereich, tempo, richtung: 1, pause: rand(1, 3), phase: rand(0, 6) };
    c.hitArea = new PIXI.Circle(0, -maß * 0.3, 125);
    tap(c, () => onTap(k), { sound: null, squash: false });
    this.krabbler_ = this.krabbler_ || [];
    this.krabbler_.push(k);
    return k;
  }

  krabbelt(dt) {
    for (const k of this.krabbler_) {
      k.phase += dt;
      if (k.pause > 0) {
        k.pause -= dt;
      } else {
        k.c.x += k.richtung * k.tempo * dt;
        if (k.c.x > k.bereich[1]) { k.c.x = k.bereich[1]; k.richtung = -1; k.pause = rand(1.5, 3); }
        if (k.c.x < k.bereich[0]) { k.c.x = k.bereich[0]; k.richtung = 1; k.pause = rand(1.5, 3); }
        if (Math.random() < dt * 0.08) k.pause = rand(1.5, 4);
      }
      // Blickrichtung (Bilder schauen nach rechts) und leichtes Wiegen beim Krabbeln
      k.c.scale.x = k.richtung;
      k.c.rotation = k.pause > 0 ? 0 : Math.sin(k.phase * 5) * 0.03;
    }
  }

  hüpfer(obj, höhe) {
    if (obj._hüpft) return;
    obj._hüpft = true;
    const y0 = obj.y;
    this.tween(obj, { y: y0 - höhe }, 0.18, { ease: 'quadOut' })
      .then(() => this.tween(obj, { y: y0 }, 0.3, { ease: 'bounceOut' }))
      .then(() => { obj._hüpft = false; });
  }

  baueWurm() {
    const zwischen = (this.plätze[1].x + this.plätze[2].x) / 2;
    const c = new PIXI.Container({ label: 'regenwurm' });
    c.position.set(zwischen, 1178);
    c.zIndex = 90;
    const w = spr('garten/regenwurm', { anchor: [0.55, 0.92], parent: c });
    const s = 120 / w.texture.width;
    w.scale.set(s, s * 0.05);
    w.alpha = 0;
    this.welt.addChild(c);
    // kleines Erdloch, aus dem er schaut
    const loch = new PIXI.Graphics().ellipse(0, 0, 34, 10).fill({ color: 0x4a2a14, alpha: 0.55 });
    loch.zIndex = -1;
    c.addChild(loch);
    c.sortableChildren = true;
    this.wurm = { c, w, s, oben: false, zeit: rand(4, 8), wackel: 0 };
    c.hitArea = new PIXI.Rectangle(-120, -170, 240, 230);
    tap(c, () => {
      const wm = this.wurm;
      if (!wm.oben) this.wurmRauf();
      else {
        note('pling', 91, { vol: 0.3 });
        this.after(0.14, () => note('pling', 95, { vol: 0.25 }));
        wm.wackel = 1;
        wm.zeit = Math.max(wm.zeit, 3);
      }
    }, { sound: null, squash: false });
  }

  wurmRauf() {
    const wm = this.wurm;
    wm.oben = true;
    wm.zeit = rand(4, 6);
    killTweensOf(wm.w);
    sfx('common/graben', { vol: 0.3 });
    this.tween(wm.w, { alpha: 1 }, 0.3, { ease: 'sineInOut' });
    this.tween(wm.w, { scaleY: wm.s }, 0.9, { ease: 'backOut' });
  }

  wurmRunter() {
    const wm = this.wurm;
    wm.oben = false;
    wm.zeit = rand(10, 16);
    killTweensOf(wm.w);
    this.tween(wm.w, { scaleY: wm.s * 0.05 }, 0.9, { ease: 'sineInOut' });
    this.tween(wm.w, { alpha: 0 }, 0.4, { ease: 'sineInOut', delay: 0.6 });
  }

  // ---------------------------------------------------------------- Ablauf

  update(dt, t) {
    this.zeit = t;
    this.giessen(dt);
    this.biene.update(dt);
    this.vogel.update(dt);
    this.krabbelt(dt);
    // Wurm
    const wm = this.wurm;
    wm.zeit -= dt;
    if (wm.zeit <= 0) {
      if (wm.oben) this.wurmRunter();
      else this.wurmRauf();
    }
    wm.wackel = Math.max(0, wm.wackel - dt * 0.8);
    wm.w.rotation = wm.oben ? Math.sin(t * 2.2) * (0.06 + 0.12 * wm.wackel) : 0;
    // Pflanzen wiegen sich leicht
    for (const p of this.plätze) {
      if (p.sprite) p.sprite.skew.x = 0.025 * Math.sin(t * 1.1 + p.phase);
    }
  }

  verlassen() {
    this._hinweis?.kill();
    this._hinweis = null;
    // Kanne nicht schief stehen lassen, Tropfen weg
    if (this.kanne) this.kanne.rotation = 0;
    for (const d of this.tropfen || []) d.visible = false;
  }

  hinweise() {
    const liste = [];
    const reif = this.plätze.find((p) => p.stufe === 3 && !p.belegt);
    if (reif) liste.push(reif.sprite);
    const durst = this.plätze.find((p) => p.stufe >= 1 && p.stufe < 3 && !p.belegt);
    if (durst) liste.push({ von: this.kanne, nach: { x: durst.x + 60, y: durst.y - durst.höhe - 140 } });
    const frei = this.freierPlatz();
    const tüte = this.leiste.sprite(SORTEN[this.hinweisSorte % SORTEN.length]);
    if (frei && tüte) liste.push({ von: tüte, nach: { x: frei.x, y: frei.y - 60 } });
    if (!liste.length) liste.push(this.hase);
    return liste;
  }
}
