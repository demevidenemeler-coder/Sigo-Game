// Seite 4: Die Gartenküche vor dem Gartenhaus – abwechselnd wird Suppe gekocht oder Marmelade eingemacht.
//
// Suppen-Runde (zwei Gäste setzen sich vor den Tisch und wünschen sich Suppe):
//   1. Gemüse aus dem Korb in den Wassereimer ziehen (oder antippen) – es wird gewaschen und hüpft aufs Brett.
//   2. Schneiden: aufs Gemüse (oder Brett) tippen – das Holzmesser schneidet, drei Tipps, dann liegen Scheiben da.
//   3. Das Brett zum Topf ziehen (oder antippen) – die Scheiben plumpsen in die Suppe, sie wird bunter.
//      (2 oder 3 Gemüse je Runde: Karotte, Tomate, Kürbis, Salat – jede Runde eine andere Mischung und Farbe)
//   4. Umrühren: mit dem Finger im Topf kreisen (oder den Löffel antippen) – die Suppe dampft.
//   5. Schöpfen: Topf oder Schale antippen – der Löffel füllt eine Schale nach der anderen.
//   6. Die Schalen zu den Gästen ziehen (oder antippen) – sie essen und freuen sich, es gibt einen Sticker.
// Marmeladen-Runde (ein Gast wünscht sich ein Marmeladenbrot):
//   1. Drei Früchte (Erdbeere, Apfel, Birne – jede Runde andere) aus dem Korb in den Topf ziehen (oder antippen).
//   2. Umrühren wie bei der Suppe – die Marmelade wird dick und glänzt. Manchmal kommt eine Biene naschen.
//   3. Glas füllen: Topf oder Glas antippen – der Löffel füllt das Glas.
//   4. Deckel: den karierten Deckel aufs Glas ziehen (oder antippen).
//   5. Ins Regal: das Glas ins Wandregal ziehen (oder antippen). Das Regal füllt sich über die Besuche (gespeichert).
//   6. Brot bestreichen: Brot oder Topf antippen – Marmelade kommt aufs Brot.
//   7. Das Brot zum Gast ziehen (oder antippen) – er isst, freut sich, es gibt einen Sticker.
// Danach gehen die Gäste und die nächste Runde (die andere Art, andere Gäste) beginnt.
// Die Zeige-Hand zeigt immer nur den nächsten Schritt. Nichts kann schiefgehen: Was daneben landet, gleitet zurück.

import {
  tap, drag, sfx, voice, note, fx, Actor, spr, meta, store, rand, pick, clamp, lerp, killTweensOf, PIXI,
} from '../../engine/index.js';
import { Seite } from '../../gemeinsam/seiten.js';
import { belohne } from '../../gemeinsam/sticker.js';
import { umhängen, bogen, gleitDauer, Vogel, Flieger, wähleNeu, lassEssen } from './helfer.js';
import { bauKorb } from './korb.js';

// ---------------------------------------------------------------- Maße (Seiten-Koordinaten)
const TISCH_Y = 846;                       // Oberkante der Tischplatte (dort stehen die Dinge)
const KORB = { x: -770, y: TISCH_Y - 120, skala: 0.6 };
const KORB_RAND = [[0, 196], [60, 214], [178, 232], [296, 214], [356, 196]];
const KORB_PLÄTZE = [[112, 178], [180, 168], [248, 178]];
const EIMER = { x: -440, y: TISCH_Y - 116, skala: 0.55 };
const BRETT = { x: -10, y: TISCH_Y + 10, skala: 0.85 };
const BRETT_GEMÜSE = { x: -62, y: -122 };  // Gemüse auf dem Brett (im Brett-Container)
const STÜCK_PLÄTZE = [[30, -108], [98, -110], [64, -82], [130, -86], [-2, -84], [70, -130]];
const TOPF = { x: 430, y: 1450, skala: 0.9 };
const SCHALEN = [{ x: 20, y: 1512 }, { x: 830, y: 1512 }];
const SCHALE_SKALA = 0.75;
const GLAS = { x: 830, y: 1512, skala: 0.62 };
const DECKEL_WARTET = { x: 830, y: 1150 };
const REGAL_SKALA = 0.42;
// Plätze im Wandregal (Unterkante der Gläser): erst das untere Brett, dann das obere
const REGAL_PLÄTZE = [
  ...[-150, -10, 130, 270, 410, 550, 690, 830, 960].map((x) => ({ x, y: 522 })),
  ...[-150, -10, 130, 270, 410, 550, 690, 830].map((x) => ({ x, y: 287 })),
];
const REGAL_KEY = 'garten.marmeladen';
const GAST_PLÄTZE = [{ x: -800, y: 1482 }, { x: -380, y: 1482 }];
const GAST_VON = -1580;
const RÜHR_ZIEL = Math.PI * 2 * 2.2;       // so viel Umrühren, dann ist es fertig
const WASSER = 0xa9d8ec;
const BRÜHE = 0xf2b955;                     // warme Grundfarbe jeder Suppe (sie wird nie grau)

const GEMÜSE = {
  karotte: { bild: 'common/futter_karotte', farbe: 0xf28a2e, höhe: 150, liegt: -1.15 },
  tomate: { bild: 'garten/ernte_tomate', farbe: 0xe2493c, höhe: 132, liegt: 0 },
  kuerbis: { bild: 'garten/ernte_kuerbis', farbe: 0xf2a33c, höhe: 136, liegt: 0 },
  salat: { bild: 'common/futter_salat', farbe: 0x8ccf5a, höhe: 132, liegt: 0 },
};
const OBST = {
  erdbeere: { bild: 'common/futter_erdbeere', farbe: 0xe0283e, höhe: 132 },
  apfel: { bild: 'garten/apfel_rot', farbe: 0xf5a83a, höhe: 132 },
  birne: { bild: 'garten/birne_gelb', farbe: 0xf2d24a, höhe: 138 },
};
// Gäste und ihre Größe (sie sitzen vorn auf der Terrasse)
const SKALA = {
  hase: 0.37, schwein: 0.35, baer: 0.37, hund: 0.35, schaf: 0.34, pferd: 0.35, ente: 0.33, katze: 0.33,
  maus: 0.27, eichhoernchen: 0.35, igel: 0.33, fuchs: 0.35, kuh: 0.33,
};
const SUPPEN_GÄSTE = ['hase', 'schwein', 'baer', 'hund', 'schaf', 'pferd', 'ente', 'katze', 'kuh'];
const MARMELADEN_GÄSTE = ['baer', 'maus', 'eichhoernchen', 'igel', 'fuchs', 'hund', 'katze'];

// Farbe zwischen a und b (t = 0 … 1)
function misch(a, b, t) {
  const r = Math.round(lerp((a >> 16) & 255, (b >> 16) & 255, t));
  const g = Math.round(lerp((a >> 8) & 255, (b >> 8) & 255, t));
  const bl = Math.round(lerp(a & 255, b & 255, t));
  return (r << 16) | (g << 8) | bl;
}

const kurz = (ctx) => Math.hypot(ctx.x - ctx.startX, ctx.y - ctx.startY) < 70;

export class Kueche extends Seite {
  static hg = 'garten/hg_kueche';

  aufbau() {
    this.uhr = 0;
    this.r = null;              // laufende Runde
    this.letzteArt = null;
    this.gastVerlauf = [];
    this.tonBis = {};           // Entprellen von Tönen, die aus vielen kleinen Bewegungen kommen
    this.baueTisch();
    this.baueTopf();
    this.baueRegal();
    this.vogel = new Vogel(this, { x: -880, y: 592, bereich: [-950, -800], scale: 0.6, z: 20 });
    this.baueBiene();
    this.neueRunde({ erste: true });
    // Die Gäste zeigen ab und zu ihren Wunsch (nur, wenn gerade niemand spielt)
    this.every(12, () => {
      if (this.aktiv && this.szene.idle > 3 && this.r && this.r.gästeDa && !this.r.fertig) this.zeigeWunsch();
    });
    // Ist die Suppe fertig, steigt ab und zu ein Dampfwölkchen auf (ruhig)
    this.every(4.5, () => {
      const r = this.r;
      if (this.aktiv && r && r.gekocht && r.level > 0 && !r.fertig) {
        this.burst('rauch', this.öffnung.x + rand(-60, 60), this.öffnung.y - 40, { count: 1 });
      }
    });
  }

  betreten() {
    this._hinweis?.kill();
    this._hinweis = this.after(2.5, () => this.sageHinweis());
    if (this.r?.gästeDa) this.after(1.3, () => { if (this.aktiv) this.zeigeWunsch(); });
  }

  verlassen() {
    this._hinweis?.kill();
    this._hinweis = null;
  }

  // Der passende Satz zum jetzigen Schritt (der Kern sagt jeden höchstens einmal am Tag)
  sageHinweis() {
    const r = this.r;
    if (!this.aktiv || !r || !r.gästeDa) return;
    const schritt = this.schritt();
    const ids = {
      waschen: 'garten_eimer', schneiden: 'garten_schneiden', brett: 'garten_topf', obst: 'garten_topf',
      rühren: 'garten_ruehren', schöpfen: 'garten_schalen', regal: 'garten_regal',
    };
    const id = ids[schritt];
    if (id) voice(id, { nurWenn: () => this.aktiv && this.schritt() === schritt });
  }

  tonEinmal(id, sek, opt) {
    if (this.uhr < (this.tonBis[id] || 0)) return;
    this.tonBis[id] = this.uhr + sek;
    sfx(id, opt);
  }

  // ---------------------------------------------------------------- Tisch: Korb, Eimer, Brett, Messer

  baueTisch() {
    this.korb = bauKorb(this, 'common/icon_korb', {
      x: KORB.x, y: KORB.y, scale: KORB.skala, z: 300, rand: KORB_RAND,
    });
    // Antippen des Korbs: die nächste Zutat hüpft als Hinweis
    tap(this.korb.c, () => {
      const z = this.r?.zutaten.find((x) => x.zustand === 'korb');
      if (z) fx.pop(z.sp, 0.12);
    }, { sound: null, squash: false });

    this.eimer = spr('common/eimer_wasser', { anchor: 0.5, x: EIMER.x, y: EIMER.y, parent: this.welt, z: 310 });
    this.eimer.scale.set(EIMER.skala);
    tap(this.eimer, () => {
      fx.wobble(this.eimer, 0.05);
      this.tonEinmal('common/platsch', 0.6, { vol: 0.35 });
      this.burst('tropfen', EIMER.x, EIMER.y - 110, { count: 2 });
    }, { sound: null, squash: false, hitArea: new PIXI.Rectangle(-130 / EIMER.skala, -140 / EIMER.skala, 260 / EIMER.skala, 270 / EIMER.skala) });

    // Brett: ein Container, darauf liegen Gemüse und Scheiben
    const c = new PIXI.Container({ label: 'brett' });
    c.position.set(BRETT.x, BRETT.y);
    c.zIndex = 320;
    c.sortableChildren = true;
    const b = spr('garten/brett', { parent: c, z: 0 });
    b.scale.set(BRETT.skala);
    this.stücke = new PIXI.Container({ label: 'stuecke' });
    this.stücke.zIndex = 2;
    c.addChild(this.stücke);
    this.welt.addChild(c);
    this.brett = c;
    c.hitArea = new PIXI.Rectangle(-200, -250, 400, 290);
    this.brettZug = drag(c, {
      lift: 1.03,
      back: false,
      sound: null,
      targets: () => (this.r?.brettBereit ? [{ id: 'topf', x: this.öffnung.x, y: this.öffnung.y - 60, radius: 300 }] : []),
      onStart: () => this.brettAngetippt(),
      onMove: (z, ctx) => {
        // Nur Scheiben darauf: das Brett darf zum Topf. Sonst bleibt es liegen (Schneiden ist Tippen).
        if (!this.r?.brettBereit) c.position.set(ctx.startX, ctx.startY);
      },
      onDrop: (ziel, ctx) => {
        const r = this.r;
        if (r?.brettBereit && (ziel || kurz(ctx))) { this.kippeInTopf(); return; }
        this.tween(c, { x: BRETT.x, y: BRETT.y }, gleitDauer(BRETT.x - c.x, BRETT.y - c.y, 0.35, 3), { ease: 'cubicOut' });
      },
    });

    this.messer = spr('garten/holzmesser', { anchor: 0.5, parent: this.welt, z: 900 });
    this.messer.scale.set(0.55);
    this.messer.alpha = 0;
    this.messer.eventMode = 'none';
    this.messerRuhe = { x: BRETT.x + 150, y: BRETT.y - 250 };
    this.messer.position.set(this.messerRuhe.x, this.messerRuhe.y);
  }

  // ---------------------------------------------------------------- Topf, Löffel, Umrühren

  baueTopf() {
    const id = 'garten/kochtopf';
    const m = meta(id);
    this.topf = spr(id, { parent: this.welt, x: TOPF.x, y: TOPF.y, z: 1400 });
    this.topf.scale.set(TOPF.skala);
    const ö = m.pts?.oeffnung || [300, 72];
    this.öffnung = { x: TOPF.x + (ö[0] - m.ax * m.w) * TOPF.skala, y: TOPF.y + (ö[1] - m.ay * m.h) * TOPF.skala };
    tap(this.topf, () => this.topfAngetippt(), {
      sound: null, squash: false,
      hitArea: new PIXI.Rectangle(-m.ax * m.w - 10, -m.ay * m.h - 40, m.w + 20, m.h + 50),
    });
    // Inhalt des Topfs (Wasser, Suppe, Marmelade): eine gezeichnete Oberfläche in der Öffnung
    this.inhalt = new PIXI.Graphics();
    this.inhalt.zIndex = 1403;
    this.inhalt.eventMode = 'none';
    this.welt.addChild(this.inhalt);
    // Löffel (steckt im Topf, solange gerührt oder geschöpft wird)
    this.löffel = spr('garten/kochloeffel', { anchor: 0.5, parent: this.welt, z: 1402 });
    this.löffel.scale.set(0.72);
    this.löffel.alpha = 0;
    this.löffel.eventMode = 'none';
    this.löffelH = (meta('garten/kochloeffel').h || 420) * 0.72;
    this.rührWinkel = -Math.PI / 2;
    this.setzeLöffel();
    // Rührfläche über der Öffnung: folgt dem Finger, der Winkel um die Topfmitte rührt
    const f = new PIXI.Container({ label: 'ruehren' });
    f.position.set(this.öffnung.x, this.öffnung.y);
    f.zIndex = 1500;
    f.hitArea = new PIXI.Circle(0, 0, 240);
    f.eventMode = 'none';
    this.welt.addChild(f);
    this.rührFläche = f;
    let letzter = null;
    let bewegt = 0;
    f.on('pointerdown', (e) => {
      const p = this.welt.toLocal(e.global);
      f.position.set(p.x, p.y);
      letzter = null;
    });
    drag(f, {
      back: false,
      lift: 1,
      sound: null,
      onStart: () => { bewegt = 0; },
      onMove: () => {
        // Winkel um die Mitte der Öffnung (die Öffnung ist flach: senkrecht gestreckt rechnen)
        const dx = f.x - this.öffnung.x;
        const dy = (f.y - this.öffnung.y) * 2.2;
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
        f.position.set(this.öffnung.x, this.öffnung.y);
        letzter = null;
      },
    });
  }

  // Löffel an seinen Platz im Topf (Spitze im Inhalt, kreist mit dem Rühren)
  setzeLöffel() {
    const l = this.löffel;
    const a = this.rührWinkel;
    const spitze = { x: this.öffnung.x + Math.cos(a) * 70, y: this.öffnung.y + 8 + Math.sin(a) * 12 };
    const r = 0.22 * Math.cos(a) + 0.12;
    l.rotation = r;
    const h = this.löffelH / 2 - 26;
    l.position.set(spitze.x + Math.sin(r) * h, spitze.y - Math.cos(r) * h);
  }

  zeichneInhalt() {
    const g = this.inhalt;
    g.clear();
    const r = this.r;
    const level = r ? r.level : 0;
    if (!r || level <= 0.001) return;
    const o = this.öffnung;
    const cy = o.y + 16 - level * 10;
    const rx = 142 + level * 18;
    const ry = 28 + level * 5;
    const farbe = r.farbe;
    g.ellipse(o.x, cy, rx, ry).fill({ color: farbe, alpha: 0.96 })
      .stroke({ width: 4, color: misch(farbe, 0x5a2a10, 0.35), alpha: 0.6 });
    g.ellipse(o.x - rx * 0.35, cy - ry * 0.3, rx * 0.3, ry * 0.28).fill({ color: 0xffffff, alpha: 0.25 });
    // kleine Stückchen in der Suppe (feste Plätze, keine Zufälle pro Bild)
    for (let i = 0; i < r.flocken.length; i++) {
      const [fx_, fy, fc] = r.flocken[i];
      g.circle(o.x + fx_ * rx * 0.7, cy + fy * ry * 0.55, 11).fill(fc).circle(o.x + fx_ * rx * 0.7 - 3, cy + fy * ry * 0.55 - 3, 4)
        .fill({ color: 0xffffff, alpha: 0.35 });
    }
  }

  topfAngetippt() {
    const r = this.r;
    if (!r) return;
    if (r.phase === 'rühren') { this.rühreEinStück(); return; }
    if (r.phase === 'schöpfen') { this.schöpfe(); return; }
    if (r.phase === 'abfüllen') { this.füllGlas(); return; }
    if (r.phase === 'brot') { this.bestreiche(); return; }
    fx.wobble(this.topf, 0.03);
    if (r.level > 0) this.tonEinmal('common/blubber', 0.8, { vol: 0.35 });
    else sfx('common/klack', { vol: 0.35 });
  }

  zumRühren() {
    const r = this.r;
    r.phase = 'rühren';
    r.gerührt = 0;
    this.rührWinkel = -Math.PI / 2;
    this.setzeLöffel();
    killTweensOf(this.löffel, ['alpha']);
    this.tween(this.löffel, { alpha: 1 }, 0.5, { ease: 'sineInOut' });
    this.rührFläche.eventMode = 'static';
    this.after(0.6, () => { if (this.aktiv && this.r === r && r.phase === 'rühren') fx.pulse(this.löffel); });
    const passt = () => this.aktiv && this.r === r && r.phase === 'rühren' && r.gerührt < 2;
    this.after(0.9, () => { if (passt()) voice('garten_ruehren', { nurWenn: passt }); });
  }

  // Ein Tipp: der Löffel macht von selbst eine kleine Runde
  rühreEinStück() {
    const r = this.r;
    if (!r || r.phase !== 'rühren' || r.rührtSelbst) return;
    r.rührtSelbst = true;
    const p = { w: 0 };
    let vorher = 0;
    this.tween(p, { w: 1.6 }, 0.7, {
      ease: 'sineInOut',
      onUpdate: () => { this.rühre(p.w - vorher); vorher = p.w; },
    }).then(() => { r.rührtSelbst = false; });
  }

  rühre(d) {
    const r = this.r;
    if (!r || r.phase !== 'rühren') return;
    this.rührWinkel += d;
    this.setzeLöffel();
    const vorher = r.gerührt;
    r.gerührt += Math.abs(d);
    // je halbe Runde ein leises Blubbern und eine Blase
    if (Math.floor(r.gerührt / Math.PI) > Math.floor(vorher / Math.PI)) {
      this.tonEinmal('common/blubber', 0.7, { vol: 0.32 });
      this.burst('blasen', this.öffnung.x + rand(-80, 80), this.öffnung.y, { count: 1 });
    }
    // Marmelade wird beim Rühren dunkler und dicker
    if (r.art === 'marmelade') {
      r.farbe = misch(r.grundFarbe, misch(r.grundFarbe, 0xd01830, 0.25), clamp(r.gerührt / RÜHR_ZIEL, 0, 1));
      this.zeichneInhalt();
    }
    if (r.gerührt >= RÜHR_ZIEL) this.gekocht();
  }

  gekocht() {
    const r = this.r;
    if (r.phase !== 'rühren') return;
    r.gekocht = true;
    this.rührFläche.eventMode = 'none';
    sfx('common/funkeln', { vol: 0.45 });
    this.burst('funkeln', this.öffnung.x, this.öffnung.y - 30, { count: 4 });
    this.burst('rauch', this.öffnung.x, this.öffnung.y - 40, { count: 2 });
    if (r.art === 'suppe') {
      r.phase = 'schöpfen';
      this.after(0.6, () => this.stelleSchalen());
    } else {
      r.phase = 'abfüllen';
      this.after(0.6, () => this.stelleGlas());
      if (Math.random() < 0.6) this.after(2.5, () => this.bieneKommt());
    }
  }

  // ---------------------------------------------------------------- Runde

  async neueRunde({ erste = false } = {}) {
    // Abwechselnd Suppe und Marmelade (die erste Runde ist Suppe)
    const art = erste ? 'suppe' : this.letzteArt === 'suppe' ? 'marmelade' : 'suppe';
    this.letzteArt = art;
    const r = {
      art, phase: art === 'suppe' ? 'gemüse' : 'obst', gäste: [], zutaten: [], level: art === 'suppe' ? 0.3 : 0, farbe: WASSER,
      grundFarbe: WASSER, flocken: [], gerührt: 0, gekocht: false, gästeDa: false, fertig: false,
      inArbeit: null, brettBereit: false, schalen: [], glas: null, deckel: null, brot: null,
    };
    this.r = r;
    this.zeichneInhalt();
    // Gäste wählen: nie einer der letzten drei
    const liste = art === 'suppe' ? SUPPEN_GÄSTE : MARMELADEN_GÄSTE;
    const anzahl = art === 'suppe' ? 2 : 1;
    const tiere = [];
    for (let i = 0; i < anzahl; i++) {
      let t = wähleNeu(liste, this.gastVerlauf, 3);
      if (tiere.includes(t)) t = pick(liste.filter((x) => !tiere.includes(x)));
      tiere.push(t);
    }
    // Zutaten: 2 oder 3 Gemüse (verschiedene) bzw. 3 Früchte (gemischt)
    let namen;
    if (art === 'suppe') {
      // nie dieselbe Mischung wie in der letzten Suppe
      for (let v = 0; v < 6; v++) {
        namen = Object.keys(GEMÜSE).sort(() => Math.random() - 0.5).slice(0, pick([2, 2, 3]));
        if ([...namen].sort().join() !== this.letzteSuppe) break;
      }
      this.letzteSuppe = [...namen].sort().join();
    } else {
      namen = [0, 1, 2].map(() => pick(Object.keys(OBST)));
      if (namen.every((n) => n === namen[0]) && Math.random() < 0.6) namen[2] = pick(Object.keys(OBST).filter((n) => n !== namen[0]));
    }
    // Die Zutaten liegen gleich im Korb (man darf sofort anfangen), währenddessen kommen die Gäste
    namen.forEach((n, i) => this.after(i * 0.35, () => { if (this.r === r) r.zutaten.push(this.legeInKorb(n, i, art)); }));
    // Gäste kommen von links herein und setzen sich vor den Tisch
    const plätze = anzahl === 1 ? [{ x: -560, y: GAST_PLÄTZE[0].y }] : GAST_PLÄTZE;
    r.gäste = tiere.map((t, i) => ({ tier: t, platz: plätze[i], a: null, satt: false, bekommt: false }));
    if (erste) {
      for (const g of r.gäste) {
        g.a = this.baueGast(g.tier, g.platz.x, g.platz.y);
      }
    } else {
      sfx('common/hupf', { vol: 0.4 });
      const wege = r.gäste.map(async (g, i) => {
        await this.wait(i * 0.7);
        g.a = this.baueGast(g.tier, GAST_VON, g.platz.y);
        await g.a.walkTo(g.platz.x, g.platz.y, { tempo: 260 });
      });
      await Promise.all(wege);
      if (this.r !== r) return;
    }
    for (const g of r.gäste) if (!g.a.destroyed) g.a.lookAt(TOPF.x);
    r.gästeDa = true;
    if (this.aktiv) {
      this.after(0.3, () => this.zeigeWunsch());
      this.after(2.6, () => this.sageHinweis());
      this.after(1.4, () => { const z = r.zutaten.find((x) => x.zustand === 'korb'); if (z && this.aktiv) fx.pulse(z.sp); });
    }
  }

  baueGast(tier, x, y) {
    const a = new Actor(tier, { x, y, scale: SKALA[tier] || 0.3, parent: this.welt, z: Math.round(y) });
    a.onTap(() => {
      fx.wobble(a, 0.05);
      a.sound();
      const r = this.r;
      if (!r || !r.gästeDa) return;
      const g = r.gäste.find((x) => x.a === a);
      // ein voller Teller / das Brot wartet: dann kommt es zu diesem Gast
      if (g && !g.satt && !g.bekommt) {
        const schale = r.schalen.find((s) => s.voll && !s.weg);
        if (schale) { this.gibSchale(schale, g); return; }
        if (r.brot && r.brot.fertig && !r.brot.weg) { this.gibBrot(g); return; }
      }
      this.zeigeWunsch(a);
    });
    return a;
  }

  zeigeWunsch(nur = null) {
    const r = this.r;
    if (!r || !r.gästeDa) return;
    const bild = r.art === 'suppe' ? 'garten/schale_suppe' : 'garten/glas_voll';
    r.gäste.forEach((g, i) => {
      if (!g.a || g.a.destroyed || g.satt || (nur && g.a !== nur)) return;
      this.after(nur ? 0 : i * 0.5, () => { if (!g.a.destroyed) g.a.bubble(bild, 2.6, { seite: 'rechts' }); });
    });
  }

  // ---------------------------------------------------------------- Zutaten im Korb

  legeInKorb(name, i, art) {
    const cfg = art === 'suppe' ? GEMÜSE[name] : OBST[name];
    const [px, py] = KORB_PLÄTZE[i % KORB_PLÄTZE.length];
    const heim = this.korb.lokal(px, py);
    const sp = spr(cfg.bild, { anchor: 0.5, parent: this.korb.inhalt, x: heim.x, y: heim.y });
    const s = cfg.höhe / Math.max(1, meta(cfg.bild).h || sp.texture.height);
    sp.zIndex = i;
    sp.rotation = rand(-0.2, 0.2);
    sp.scale.set(s * 0.3);
    sp.alpha = 0;
    this.tween(sp, { alpha: 1 }, 0.3, { ease: 'sineInOut' });
    this.tween(sp, { scale: s }, 0.5, { ease: 'backOut' });
    note('glocke', [76, 79, 84][i % 3], { vol: 0.2 });
    const z = { name, cfg, art, sp, s, heim, zustand: 'korb', marke: 0, zug: null };
    // Tippfläche mindestens 230 × 230 Einheiten. Die Dinge liegen eng im Korb und ihre Flächen überlappen sich:
    // dann gewinnt das Ding, dessen Mitte dem Finger am nächsten ist (so greift man, was man antippt).
    const w = 115 / s;
    const rechteck = new PIXI.Rectangle(-w, -w, 2 * w, 2 * w);
    sp.hitArea = {
      x: -w, y: -w, width: 2 * w, height: 2 * w,
      contains: (lx, ly) => {
        if (!rechteck.contains(lx, ly)) return false;
        if (sp.parent !== this.korb.inhalt) return true;
        const px = sp.x + lx * sp.scale.x;
        const py = sp.y + ly * sp.scale.y;
        const eigen = Math.hypot(px - sp.x, py - sp.y);
        for (const o of this.r?.zutaten || []) {
          if (o !== z && o.zustand === 'korb' && o.sp.parent === this.korb.inhalt &&
            Math.hypot(px - o.sp.x, py - o.sp.y) < eigen) return false;
        }
        return true;
      },
    };
    // Vor drag() angemeldet: beim Greifen aus dem Korb in die Welt umhängen (dann folgt sie dem Finger richtig)
    sp.on('pointerdown', () => {
      if (z.zustand !== 'korb') return;
      z.marke++;
      if (sp.parent !== this.welt) umhängen(sp, this.welt);
      sp.zIndex = 760;
    });
    z.zug = drag(sp, {
      back: false,
      lift: 1.12,
      targets: () => {
        if (z.art === 'suppe') return this.r?.inArbeit ? [] : [{ id: 'eimer', x: EIMER.x, y: EIMER.y - 60, radius: 240 }];
        return [{ id: 'topf', x: this.öffnung.x, y: this.öffnung.y - 40, radius: 300 }];
      },
      onDrop: (ziel, ctx) => {
        if (z.zustand !== 'korb') return;
        const r = this.r;
        if (z.art === 'suppe') {
          if (r && !r.inArbeit && (ziel || kurz(ctx))) { this.wasche(z); return; }
          // gerade wird etwas anderes geschnitten: das Brett wackelt als Hinweis
          if (r?.inArbeit) fx.wobble(this.brett, 0.04);
        } else if (r && (ziel || kurz(ctx))) { this.obstInTopf(z); return; }
        this.zurückInKorb(z);
      },
    });
    return z;
  }

  zurückInKorb(z) {
    const sp = z.sp;
    const m = ++z.marke;
    const g = this.korb.inhalt.toGlobal(new PIXI.Point(z.heim.x, z.heim.y));
    const p = this.welt.toLocal(g);
    this.tween(sp, { x: p.x, y: p.y }, gleitDauer(p.x - sp.x, p.y - sp.y, 0.35, Math.PI / 2), { ease: 'sineInOut' })
      .then((ok) => {
        if (!ok || z.marke !== m || z.zustand !== 'korb' || sp.destroyed || z.zug?.isDragging()) return;
        umhängen(sp, this.korb.inhalt);
        sp.position.set(z.heim.x, z.heim.y);
        sp.zIndex = 0;
      });
  }

  // aus dem Korb nehmen (falls es noch drin liegt) und nicht mehr greifbar machen
  nimm(z) {
    z.marke++;
    z.zug?.off();
    z.zug = null;
    killTweensOf(z.sp);
    z.sp.eventMode = 'none';
    if (z.sp.parent !== this.welt) umhängen(z.sp, this.welt);
    z.sp.scale.set(z.s);
  }

  // ---------------------------------------------------------------- Suppe: waschen, schneiden, in den Topf

  async wasche(z) {
    const r = this.r;
    r.inArbeit = z;
    z.zustand = 'eimer';
    this.nimm(z);
    const sp = z.sp;
    sp.zIndex = 760;
    await bogen(this, sp, EIMER.x, EIMER.y - 230, { dauer: 0.45, höhe: 90, dreh: -sp.rotation });
    if (sp.destroyed) return;
    sp.zIndex = 305;   // hinter dem Eimer: es taucht ein
    await this.tween(sp, { y: EIMER.y - 90 }, 0.3, { ease: 'quadIn' });
    sfx('common/platsch', { vol: 0.55 });
    this.burst('tropfen', EIMER.x, EIMER.y - 120, { count: 4 });
    await this.tween(sp, { y: EIMER.y - 130 }, 0.3, { ease: 'sineInOut' });
    await this.tween(sp, { y: EIMER.y - 85 }, 0.3, { ease: 'sineInOut' });
    this.burst('blasen', EIMER.x + rand(-30, 30), EIMER.y - 130, { count: 2 });
    await this.wait(0.2);
    await this.tween(sp, { y: EIMER.y - 240 }, 0.4, { ease: 'quadOut' });
    if (sp.destroyed) return;
    sp.zIndex = 760;
    sfx('common/funkeln', { vol: 0.3 });
    this.burst('funkeln', sp.x, sp.y, { count: 2 });
    // aufs Brett (dort liegt es, eine Karotte quer)
    const ziel = { x: BRETT.x + BRETT_GEMÜSE.x, y: BRETT.y + BRETT_GEMÜSE.y };
    await bogen(this, sp, ziel.x, ziel.y, { dauer: 0.55, höhe: 140, dreh: z.cfg.liegt - sp.rotation });
    if (sp.destroyed || this.r !== r) return;
    umhängen(sp, this.brett);
    sp.zIndex = 1;
    sfx('common/landen', { vol: 0.45 });
    z.zustand = 'brett';
    z.schnitte = 0;
    killTweensOf(this.messer);
    this.messer.position.set(this.messerRuhe.x, this.messerRuhe.y);
    this.messer.rotation = 0;
    this.tween(this.messer, { alpha: 1 }, 0.4, { ease: 'sineInOut' });
    const passt = () => this.aktiv && this.r === r && z.zustand === 'brett';
    this.after(0.5, () => { if (passt()) voice('garten_schneiden', { nurWenn: passt }); });
  }

  brettAngetippt() {
    const r = this.r;
    const z = r?.inArbeit;
    if (z && z.zustand === 'brett') this.schneide(z);
    else if (r?.phase === 'brot' && r.brot && !r.brot.fertig) this.bestreiche();
    else if (!r?.brettBereit) sfx('common/klack', { vol: 0.3 });
  }

  // Ein Schnitt. Der Stand (Zahl der Schnitte, fertig) ändert sich sofort beim Tipp; das Messer ist nur Bild.
  // Gesperrt wird allein über die Uhr der Seite – nie über ein Warten auf Bewegungen, das hängen bleiben könnte
  // (früher: eine Sperre, die erst nach mehreren await frei wurde – blieb sie stehen, lag das Gemüse für immer da).
  schneide(z) {
    const r = this.r;
    if (!r || r.inArbeit !== z || z.zustand !== 'brett') return;
    if (this.uhr < (r.schnittBis || 0)) return;
    r.schnittBis = this.uhr + 0.48;
    z.schnitte++;
    const n = z.schnitte;
    const letzter = n >= 3;
    if (letzter) z.zustand = 'stücke';
    const sp = z.sp;
    const m = this.messer;
    // Messer saust nicht: weich hinauf und hinunter (ein Bogen), ein Klack, weich wieder zur Ruhe
    const vx = this.brett.x + sp.x + 40 - (n - 1) * 26;
    const vy = this.brett.y + sp.y - 60;
    killTweensOf(m);
    m.alpha = 1;
    const von = { x: m.x, y: m.y, r: m.rotation };
    const p = { t: 0 };
    this.tween(p, { t: 1 }, 0.4, {
      ease: 'linear',
      onUpdate: () => {
        if (m.destroyed) return;
        const k = p.t;
        const a = Math.min(1, k / 0.57);                  // erst zur Stelle über dem Gemüse
        const ea = a * a * (3 - 2 * a);
        const b = k <= 0.57 ? 0 : (k - 0.57) / 0.43;      // dann hinunter
        m.x = von.x + (vx - von.x) * ea;
        m.y = von.y + (vy - 70 - von.y) * ea + 70 * b * b;
        m.rotation = von.r + (0.15 - von.r) * ea - 0.15 * b;
      },
    });
    this.after(0.4, () => {
      if (this.r !== r) return;
      sfx('common/klack', { vol: 0.55 });
      // vom Gemüse geht ein Stück ab: es wird kürzer, daneben liegen Scheiben
      if (!sp.destroyed) {
        this.tween(sp.scale, { x: z.s * (1 - n * 0.22) }, 0.15, { ease: 'quadOut' });
        this.tween(sp, { x: sp.x - 10 }, 0.15, { ease: 'quadOut' });
      }
      this.legeStück(z.cfg.farbe, r.stückZahl = (r.stückZahl || 0) + 1);
      this.tween(m, { x: this.messerRuhe.x, y: this.messerRuhe.y, rotation: 0 }, 0.3, { ease: 'sineInOut' });
      if (!letzter) return;
      this.legeStück(z.cfg.farbe, ++r.stückZahl);
      if (!sp.destroyed) this.tween(sp, { alpha: 0 }, 0.3, { ease: 'sineInOut' }).then(() => { if (!sp.destroyed) sp.destroy(); });
      this.tween(m, { alpha: 0 }, 0.5, { ease: 'sineInOut', delay: 0.3 });
      r.brettBereit = true;
      this.after(0.5, () => { if (this.aktiv && r.brettBereit) fx.pulse(this.brett); });
      const passt = () => this.aktiv && this.r === r && r.brettBereit;
      this.after(0.7, () => { if (passt()) voice('garten_topf', { nurWenn: passt }); });
    });
  }

  // Eine Gemüsescheibe auf dem Brett (gezeichnet: Rand, helleres Inneres, Glanz)
  legeStück(farbe, n) {
    const [x, y] = STÜCK_PLÄTZE[(n - 1) % STÜCK_PLÄTZE.length];
    const g = new PIXI.Graphics();
    g.ellipse(0, 4, 25, 9).fill({ color: 0x5a3010, alpha: 0.18 });
    g.ellipse(0, 0, 25, 20).fill(farbe);
    g.ellipse(0, -1, 15, 11).fill(misch(farbe, 0xffffff, 0.35));
    g.ellipse(-8, -7, 6, 4).fill({ color: 0xffffff, alpha: 0.4 });
    g.position.set(x + rand(-4, 4), y + rand(-3, 3));
    g.scale.set(0.4);
    g.farbe = farbe;
    g.eventMode = 'none';
    this.stücke.addChild(g);
    this.tween(g.scale, { x: 1.3, y: 1.3 }, 0.3, { ease: 'backOut' });
  }

  async kippeInTopf() {
    const r = this.r;
    if (!r.brettBereit) return;
    r.brettBereit = false;
    const z = r.inArbeit;
    const c = this.brett;
    killTweensOf(c);
    await bogen(this, c, this.öffnung.x - 150, this.öffnung.y - 210, { dauer: 0.6, höhe: 120 });
    if (c.destroyed) return;
    await this.tween(c, { rotation: 0.55 }, 0.35, { ease: 'sineInOut' });
    const stücke = [...this.stücke.children];
    stücke.forEach((g, i) => {
      umhängen(g, this.welt);
      g.zIndex = 1404;
      const zx = this.öffnung.x + rand(-70, 70);
      this.tween(g, { x: zx, y: this.öffnung.y + 10, rotation: rand(-1, 1) }, 0.45, { ease: 'quadIn', delay: i * 0.08 })
        .then(() => this.tween(g, { alpha: 0, scale: 0.5 }, 0.25))
        .then(() => { if (!g.destroyed) g.destroy(); });
    });
    await this.wait(0.45);
    sfx('common/plopp', { vol: 0.7 });
    this.burst('tropfen', this.öffnung.x, this.öffnung.y - 20, { count: 3 });
    // die Suppe wird mehr und bunter
    const n = r.zutaten.length;
    r.level = clamp(r.level + 0.7 / n, 0, 1);
    // Farbe: warme Brühe, eingefärbt vom Mittel aller Gemüse im Topf (so wird sie nie grau)
    z.zustand = 'topf';
    const drin = r.zutaten.filter((x) => x.zustand === 'topf');
    const mittel = drin.reduce((m, x, i) => misch(m, x.cfg.farbe, 1 / (i + 1)), drin[0].cfg.farbe);
    r.farbe = misch(BRÜHE, mittel, 0.5);
    for (let k = 0; k < 3; k++) r.flocken.push([rand(-0.8, 0.8), rand(-0.6, 0.6), misch(z.cfg.farbe, 0xffffff, 0.1)]);
    this.zeichneInhalt();
    await this.tween(c, { rotation: 0 }, 0.3, { ease: 'sineInOut' });
    await bogen(this, c, BRETT.x, BRETT.y, { dauer: 0.6, höhe: 100 });
    if (this.r !== r) return;
    r.inArbeit = null;
    r.stückZahl = 0;
    if (r.zutaten.every((x) => x.zustand === 'topf')) {
      this.after(0.3, () => this.zumRühren());
    } else {
      const nächste = r.zutaten.find((x) => x.zustand === 'korb');
      if (nächste && this.aktiv) fx.pulse(nächste.sp);
    }
  }

  // ---------------------------------------------------------------- Suppe: schöpfen und essen

  stelleSchalen() {
    const r = this.r;
    r.schalen = r.gäste.map((g, i) => this.baueSchale(i));
    const passt = () => this.aktiv && this.r === r && r.phase === 'schöpfen' && !r.schalen.some((s) => s.voll);
    this.after(0.8, () => { if (passt()) voice('garten_schalen', { nurWenn: passt }); });
  }

  baueSchale(i) {
    const ort = SCHALEN[i % SCHALEN.length];
    const c = new PIXI.Container({ label: 'schale' + i });
    c.sortableChildren = true;
    const bild = spr('garten/schale', { parent: c, z: 1 });
    const suppe = new PIXI.Graphics();
    suppe.zIndex = 2;
    c.addChild(suppe);
    c.position.set(ort.x, ort.y);
    c.scale.set(SCHALE_SKALA);
    c.zIndex = 1460 + i;
    this.welt.addChild(c);
    const m = meta('garten/schale');
    const p = m.pts?.innen || [150, 58];
    const s = { c, bild, suppe, innen: { x: p[0] - m.ax * m.w, y: p[1] - m.ay * m.h }, füllung: 0, voll: false, weg: false, zug: null, i, ort };
    c.alpha = 0;
    this.tween(c, { alpha: 1 }, 0.5, { ease: 'sineInOut', delay: i * 0.25 });
    c.hitArea = new PIXI.Rectangle(-170, -300, 340, 340);
    tap(c, () => {
      if (!s.voll) this.schöpfe();
      else if (!s.zug) fx.wobble(c, 0.05);
    }, { sound: null, squash: false });
    return s;
  }

  zeichneSuppe(s, farbe) {
    const g = s.suppe;
    g.clear();
    const f = s.füllung;
    if (f <= 0.01) return;
    const k = 0.7 + 0.3 * f;
    const y = s.innen.y + (1 - f) * 22;
    g.ellipse(s.innen.x, y, 104 * k, 27 * k).fill({ color: farbe, alpha: clamp(f * 3, 0, 1) });
    g.ellipse(s.innen.x - 30, y - 6, 26 * k, 7 * k).fill({ color: 0xffffff, alpha: 0.25 * f });
    if (f > 0.6) {
      g.circle(s.innen.x + 30, y + 2, 10).fill(misch(farbe, 0xffffff, 0.3));
      g.circle(s.innen.x - 22, y + 6, 9).fill(misch(farbe, 0x000000, 0.1));
    }
  }

  // Der Löffel holt Suppe aus dem Topf und füllt die nächste leere Schale
  async schöpfe() {
    const r = this.r;
    if (!r || r.phase !== 'schöpfen' || r.schöpft) return;
    const s = r.schalen.find((x) => !x.voll && x.füllung === 0);
    if (!s) return;
    r.schöpft = true;
    const l = this.löffel;
    killTweensOf(l);
    l.alpha = 1;
    l.zIndex = 1600;
    sfx('common/blubber', { vol: 0.35 });
    await bogen(this, l, s.ort.x + 40, s.ort.y - 250, { dauer: 0.6, höhe: 120, dreh: -l.rotation });
    await this.tween(l, { rotation: -0.9 }, 0.3, { ease: 'sineInOut' });
    sfx('common/giessen', { vol: 0.3 });
    const p = { f: 0 };
    await this.tween(p, { f: 1 }, 0.6, { ease: 'sineInOut', onUpdate: () => { s.füllung = p.f; this.zeichneSuppe(s, r.farbe); } });
    s.voll = true;
    this.burst('rauch', s.ort.x, s.ort.y - 170, { count: 1 });
    this.machSchaleGreifbar(s);
    await this.tween(l, { rotation: 0 }, 0.25, { ease: 'sineInOut' });
    l.zIndex = 1402;
    await bogen(this, l, l.x + (this.öffnung.x - l.x), this.öffnung.y - 120, { dauer: 0.55, höhe: 100 });
    this.setzeLöffel();
    r.schöpft = false;
    if (this.r !== r) return;
    if (r.schalen.every((x) => x.voll)) {
      r.phase = 'essen';
    } else if (this.aktiv) fx.pulse(this.topf);
  }

  machSchaleGreifbar(s) {
    const r = this.r;
    s.zug = drag(s.c, {
      lift: 1.08,
      back: false,
      targets: () => r.gäste.filter((g) => !g.satt && !g.bekommt).map((g) => ({ gast: g, ...this.maul(g.a), radius: 330 })),
      onDrop: (ziel, ctx) => {
        let g = ziel?.gast;
        if (!g && kurz(ctx)) g = this.nächsterHungriger(s.c.x);
        if (g && !g.satt && !g.bekommt) { this.gibSchale(s, g); return; }
        this.tween(s.c, { x: s.ort.x, y: s.ort.y }, gleitDauer(s.ort.x - s.c.x, s.ort.y - s.c.y, 0.4, 3), { ease: 'cubicOut' });
      },
    });
  }

  maul(a) {
    return a.point('mouth') || { x: a.x + 40, y: a.y - 140 };
  }

  nächsterHungriger(x) {
    const r = this.r;
    const liste = r.gäste.filter((g) => !g.satt && !g.bekommt && g.a && !g.a.destroyed);
    liste.sort((p, q) => Math.abs(p.a.x - x) - Math.abs(q.a.x - x));
    return liste[0] || null;
  }

  async gibSchale(s, g) {
    if (s.weg || g.bekommt || g.satt) return;
    s.weg = true;
    g.bekommt = true;
    s.zug?.off();
    s.zug = null;
    s.c.eventMode = 'none';
    killTweensOf(s.c);
    const a = g.a;
    // Die Schale gleitet vor den Gast auf den Boden, er löffelt sie leer
    s.c.zIndex = Math.round(a.y) + 5;
    await bogen(this, s.c, a.x + 120, a.y + 12, { dauer: 0.55, höhe: 120, skala: SCHALE_SKALA * 0.85 });
    if (a.destroyed || s.c.destroyed) return;
    a.pose('eat');
    const r = this.r;
    for (let k = 0; k < 3; k++) {
      sfx('common/mampf', { vol: 0.6 });
      const p = { f: s.füllung };
      await this.tween(p, { f: Math.max(0, s.füllung - 0.34) }, 0.45, {
        ease: 'sineInOut', onUpdate: () => { s.füllung = p.f; this.zeichneSuppe(s, r.farbe); },
      });
      await this.wait(0.12);
      if (a.destroyed || s.c.destroyed) return;
    }
    s.füllung = 0;
    this.zeichneSuppe(s, r.farbe);
    g.satt = true;
    this.tween(s.c, { alpha: 0 }, 0.8, { ease: 'sineInOut', delay: 0.8 }).then(() => { if (!s.c.destroyed) s.c.destroy({ children: true }); });
    await a.cheer({ parent: this.vorn });
    if (this.r === r && r.gäste.every((x) => x.satt)) this.rundeGeschafft();
  }

  // ---------------------------------------------------------------- Marmelade

  async obstInTopf(z) {
    const r = this.r;
    z.zustand = 'topf';
    this.nimm(z);
    const sp = z.sp;
    sp.zIndex = 1404;
    await bogen(this, sp, this.öffnung.x + rand(-40, 40), this.öffnung.y - 170, { dauer: 0.5, höhe: 110, dreh: -sp.rotation });
    if (sp.destroyed) return;
    await this.tween(sp, { y: this.öffnung.y + 4, scale: z.s * 0.8 }, 0.3, { ease: 'quadIn' });
    sfx('common/plopp', { vol: 0.6 });
    this.burst('tropfen', this.öffnung.x, this.öffnung.y - 20, { count: 2 });
    this.tween(sp, { alpha: 0 }, 0.25).then(() => { if (!sp.destroyed) sp.destroy(); });
    if (this.r !== r) return;
    const drin = r.zutaten.filter((x) => x.zustand === 'topf' && x !== z).length;
    r.level = clamp(r.level + 0.32, 0, 0.95);
    r.grundFarbe = drin === 0 ? z.cfg.farbe : misch(r.grundFarbe, z.cfg.farbe, 1 / (drin + 1));
    r.farbe = r.grundFarbe;
    r.flocken.push([rand(-0.7, 0.7), rand(-0.5, 0.5), misch(z.cfg.farbe, 0x000000, 0.12)]);
    this.zeichneInhalt();
    if (r.zutaten.length && r.zutaten.every((x) => x.zustand === 'topf') && r.phase === 'obst') {
      r.phase = 'warten';
      this.after(0.5, () => { if (this.r === r) this.zumRühren(); });
    }
  }

  stelleGlas() {
    const r = this.r;
    const c = new PIXI.Container({ label: 'glas' });
    c.sortableChildren = true;
    const marmelade = new PIXI.Graphics();
    marmelade.zIndex = 3;   // vor dem Glasbild: sonst wirkt die Marmelade durchs milchige Glas blass und halb leer
    c.addChild(marmelade);
    const bild = spr('garten/glas', { parent: c, z: 2 });
    c.position.set(GLAS.x, GLAS.y);
    c.scale.set(GLAS.skala);
    c.zIndex = 1470;
    this.welt.addChild(c);
    const glas = { c, bild, marmelade, füllung: 0, farbe: r.farbe, zu: false, zug: null };
    r.glas = glas;
    c.alpha = 0;
    this.tween(c, { alpha: 1 }, 0.5, { ease: 'sineInOut' });
    c.hitArea = new PIXI.Rectangle(-230, -420, 460, 460);
    tap(c, () => {
      if (r.phase === 'abfüllen') this.füllGlas();
      else if (r.phase === 'deckel') this.deckelDrauf();
      else if (!glas.zug) fx.wobble(c, 0.04);
    }, { sound: null, squash: false });
    this.after(0.7, () => { if (this.aktiv && r.phase === 'abfüllen') fx.pulse(c); });
  }

  zeichneMarmelade(glas) {
    const g = glas.marmelade;
    g.clear();
    const f = glas.füllung;
    if (f <= 0.01) return;
    const unten = -16;
    const oben = unten - f * 196;
    // liegt vor dem Glasbild, darum etwas schmaler als das Glas (die Glaswand bleibt sichtbar) und leicht durchscheinend
    g.roundRect(-106, oben, 212, unten - oben, Math.min(40, (unten - oben) / 2)).fill({ color: glas.farbe, alpha: 0.88 });
    g.ellipse(0, oben + 10, 96, Math.min(14, (unten - oben) / 3)).fill({ color: misch(glas.farbe, 0xffffff, 0.25), alpha: 0.8 });
    g.roundRect(-90, oben + 18, 24, Math.max(0, unten - oben - 36), 12).fill({ color: 0xffffff, alpha: 0.35 });
    if (f > 0.5) {
      g.circle(30, oben + 50, 13).fill(misch(glas.farbe, 0x000000, 0.15));
      g.circle(-30, oben + 110, 11).fill(misch(glas.farbe, 0x000000, 0.12));
    }
  }

  // Der Löffel füllt das Glas in zwei Löffeln
  async füllGlas() {
    const r = this.r;
    const glas = r?.glas;
    if (!glas || r.phase !== 'abfüllen' || r.schöpft) return;
    r.schöpft = true;
    const l = this.löffel;
    killTweensOf(l);
    l.alpha = 1;
    l.zIndex = 1600;
    sfx('common/blubber', { vol: 0.35 });
    await bogen(this, l, GLAS.x + 40, GLAS.y - 300, { dauer: 0.6, höhe: 120, dreh: -l.rotation });
    await this.tween(l, { rotation: -0.9 }, 0.3, { ease: 'sineInOut' });
    const p = { f: glas.füllung };
    glas.farbe = r.farbe;
    await this.tween(p, { f: glas.füllung + 0.5 }, 0.6, { ease: 'sineInOut', onUpdate: () => { glas.füllung = p.f; this.zeichneMarmelade(glas); } });
    sfx('common/plopp', { vol: 0.45 });
    await this.tween(l, { rotation: 0 }, 0.25, { ease: 'sineInOut' });
    l.zIndex = 1402;
    await bogen(this, l, this.öffnung.x, this.öffnung.y - 120, { dauer: 0.55, höhe: 100 });
    this.setzeLöffel();
    r.schöpft = false;
    if (this.r !== r) return;
    if (glas.füllung >= 0.99) {
      glas.füllung = 1;
      r.level = clamp(r.level - 0.45, 0.15, 1);
      this.zeichneInhalt();
      r.phase = 'deckel';
      this.zeigeDeckel();
    } else if (this.aktiv) fx.pulse(this.topf);
  }

  zeigeDeckel() {
    const r = this.r;
    const d = spr('garten/deckel', { anchor: 0.5, parent: this.welt, x: DECKEL_WARTET.x, y: DECKEL_WARTET.y, z: 1650 });
    const s = GLAS.skala;
    d.scale.set(s * 0.3);
    d.alpha = 0;
    d.ruhe = s;
    r.deckel = d;
    note('glocke', 84, { vol: 0.25 });
    this.tween(d, { alpha: 1 }, 0.4, { ease: 'sineInOut' });
    this.tween(d, { scale: s }, 0.6, { ease: 'backOut' });
    d.hitArea = new PIXI.Rectangle(-140 / s, -140 / s, 280 / s, 280 / s);
    const ziel = () => ({ x: GLAS.x, y: GLAS.y - 268 * GLAS.skala });
    d.zug = drag(d, {
      back: false,
      lift: 1.1,
      targets: () => [{ id: 'glas', ...ziel(), radius: 260 }],
      onDrop: (z, ctx) => {
        if (r.phase === 'deckel' && (z || kurz(ctx))) { this.deckelDrauf(); return; }
        this.tween(d, { x: DECKEL_WARTET.x, y: DECKEL_WARTET.y }, gleitDauer(DECKEL_WARTET.x - d.x, DECKEL_WARTET.y - d.y, 0.35, 3), { ease: 'cubicOut' });
      },
    });
  }

  async deckelDrauf() {
    const r = this.r;
    const d = r?.deckel;
    const glas = r?.glas;
    if (!d || !glas || r.phase !== 'deckel' || d.drauf) return;
    d.drauf = true;
    d.zug?.off();
    d.zug = null;
    d.eventMode = 'none';
    killTweensOf(d);
    sfx('common/rascheln', { vol: 0.4 });
    await bogen(this, d, GLAS.x, GLAS.y - 268 * GLAS.skala, { dauer: 0.45, höhe: 70, skala: GLAS.skala, dreh: -d.rotation });
    if (d.destroyed || glas.c.destroyed) return;
    umhängen(d, glas.c);
    d.position.set(0, -268);
    d.scale.set(1);
    d.zIndex = 4;
    // einmal festdrehen
    await this.tween(d, { rotation: 0.12 }, 0.15, { ease: 'sineInOut' });
    await this.tween(d, { rotation: -0.08 }, 0.15, { ease: 'sineInOut' });
    await this.tween(d, { rotation: 0 }, 0.15, { ease: 'sineInOut' });
    sfx('common/klack', { vol: 0.5 });
    this.burst('funkeln', GLAS.x, GLAS.y - 150, { count: 3 });
    glas.zu = true;
    r.phase = 'regal';
    this.machGlasGreifbar(glas);
    const passt = () => this.aktiv && this.r === r && r.phase === 'regal';
    this.after(0.5, () => { if (passt()) voice('garten_regal', { nurWenn: passt }); });
  }

  machGlasGreifbar(glas) {
    const r = this.r;
    glas.zug = drag(glas.c, {
      lift: 1.08,
      back: false,
      targets: () => [{ id: 'regal', x: 420, y: 420, radius: 560 }],
      onDrop: (z, ctx) => {
        if (r.phase === 'regal' && (z || kurz(ctx))) { this.insRegal(glas); return; }
        this.tween(glas.c, { x: GLAS.x, y: GLAS.y }, gleitDauer(GLAS.x - glas.c.x, GLAS.y - glas.c.y, 0.4, 3), { ease: 'cubicOut' });
      },
    });
  }

  // ---------------------------------------------------------------- Regal (gespeichert)

  regalStand() {
    const st = store.get(REGAL_KEY, null);
    const farben = Array.isArray(st?.farben) ? st.farben.filter((f) => Number.isFinite(f)).slice(0, REGAL_PLÄTZE.length) : [];
    const n = Number.isFinite(st?.n) && st.n >= 0 ? Math.floor(st.n) : farben.length;
    return { farben, n };
  }

  baueRegal() {
    this.regal = new Array(REGAL_PLÄTZE.length).fill(null);
    const { farben } = this.regalStand();
    farben.forEach((f, i) => { this.regal[i] = this.regalGlas(i, f); });
  }

  // Ein fertiges Glas im Regal (Marmelade, Glas, Deckel)
  regalGlas(i, farbe) {
    const p = REGAL_PLÄTZE[i];
    const c = new PIXI.Container({ label: 'regalglas' + i });
    c.sortableChildren = true;
    const g = new PIXI.Graphics();
    g.zIndex = 3;
    c.addChild(g);
    const glas = { marmelade: g, füllung: 1, farbe };
    this.zeichneMarmelade(glas);
    spr('garten/glas', { parent: c, z: 2 });
    spr('garten/deckel', { anchor: 0.5, parent: c, x: 0, y: -268, z: 4 });
    c.position.set(p.x, p.y);
    c.scale.set(REGAL_SKALA);
    c.zIndex = 30;
    // Tippfläche gut 200 Einheiten (die Gläser stehen eng, die Flächen dürfen sich überlappen)
    c.hitArea = new PIXI.Rectangle(-245, -450, 490, 490);
    this.welt.addChild(c);
    tap(c, () => {
      fx.wobble(c, 0.06);
      note('glocke', [79, 81, 84, 86, 88, 91, 93][i % 7], { vol: 0.3 });
    }, { sound: null, squash: false });
    return c;
  }

  async insRegal(glas) {
    const r = this.r;
    if (r.phase !== 'regal') return;
    r.phase = 'insRegal';
    glas.zug?.off();
    glas.zug = null;
    glas.c.eventMode = 'none';
    killTweensOf(glas.c);
    const st = this.regalStand();
    const platz = st.n % REGAL_PLÄTZE.length;
    // Ist das Regal voll, wird das älteste Glas „aufgegessen" und macht Platz
    const alt = this.regal[platz];
    if (alt) {
      this.regal[platz] = null;
      this.tween(alt, { alpha: 0 }, 0.6, { ease: 'sineInOut' }).then(() => { if (!alt.destroyed) alt.destroy({ children: true }); });
    }
    const p = REGAL_PLÄTZE[platz];
    glas.c.zIndex = 1700;
    await bogen(this, glas.c, p.x, p.y, { dauer: 0.8, höhe: 160, skala: REGAL_SKALA });
    if (glas.c.destroyed) return;
    glas.c.destroy({ children: true });
    this.regal[platz] = this.regalGlas(platz, glas.farbe);
    const farben = st.farben.slice();
    farben[platz] = glas.farbe;
    store.set(REGAL_KEY, { farben, n: st.n + 1 });
    sfx('common/klack', { vol: 0.55 });
    note('glocke', [79, 81, 84, 86, 88, 91, 93][platz % 7], { vol: 0.3 });
    this.burst('funkeln', p.x, p.y - 70, { count: 3 });
    // die anderen Gläser klingen kurz mit (höchstens drei)
    this.regal.filter((x) => x && x !== this.regal[platz]).slice(-3).forEach((x, k) => this.after(0.3 + k * 0.2, () => fx.wobble(x, 0.04)));
    await this.wait(0.8);
    if (this.r !== r) return;
    this.legeBrot();
  }

  // ---------------------------------------------------------------- Marmeladenbrot

  legeBrot() {
    const r = this.r;
    r.phase = 'brot';
    const c = new PIXI.Container({ label: 'brot' });
    c.sortableChildren = true;
    const b = spr('common/futter_brot', { anchor: 0.5, parent: c, z: 1 });
    const s = 200 / (meta('common/futter_brot').w || b.texture.width);
    b.scale.set(s);
    const belag = new PIXI.Graphics();
    belag.zIndex = 2;
    c.addChild(belag);
    c.position.set(BRETT.x - 10, BRETT.y - 150);
    c.zIndex = 330;
    this.welt.addChild(c);
    r.brot = { c, belag, fertig: false, weg: false, zug: null };
    c.alpha = 0;
    c.scale.set(0.5);
    this.tween(c, { alpha: 1 }, 0.4, { ease: 'sineInOut' });
    this.tween(c, { scale: 1 }, 0.6, { ease: 'backOut' });
    sfx('common/plopp', { vol: 0.5 });
    c.hitArea = new PIXI.Rectangle(-140, -130, 280, 250);
    tap(c, () => {
      if (!r.brot.fertig) this.bestreiche();
    }, { sound: null, squash: false });
    this.after(0.7, () => { if (this.aktiv && r.phase === 'brot') fx.pulse(c); });
  }

  async bestreiche() {
    const r = this.r;
    const brot = r?.brot;
    if (!brot || brot.fertig || r.schöpft || r.phase !== 'brot') return;
    r.schöpft = true;
    const l = this.löffel;
    killTweensOf(l);
    l.alpha = 1;
    l.zIndex = 1600;
    await bogen(this, l, brot.c.x + 30, brot.c.y - 150, { dauer: 0.7, höhe: 160, dreh: -l.rotation });
    // hin und her streichen
    sfx('common/wisch', { vol: 0.4 });
    for (let k = 0; k < 2; k++) {
      await this.tween(l, { x: brot.c.x - 40, rotation: -0.5 }, 0.25, { ease: 'sineInOut' });
      await this.tween(l, { x: brot.c.x + 40, rotation: -0.2 }, 0.25, { ease: 'sineInOut' });
    }
    const g = brot.belag;
    g.clear();
    g.ellipse(0, -22, 80, 34).fill({ color: r.farbe, alpha: 1 })
      .stroke({ width: 4, color: misch(r.farbe, 0x6a1010, 0.35), alpha: 0.7 });
    g.ellipse(-28, -32, 24, 9).fill({ color: 0xffffff, alpha: 0.4 });
    g.circle(26, -16, 10).fill(misch(r.farbe, 0x000000, 0.18));
    g.alpha = 0;
    this.tween(g, { alpha: 1 }, 0.4, { ease: 'sineInOut' });
    brot.fertig = true;
    r.level = 0;
    this.zeichneInhalt();
    await this.tween(l, { rotation: 0 }, 0.2);
    l.zIndex = 1402;
    await bogen(this, l, this.öffnung.x, this.öffnung.y - 120, { dauer: 0.7, höhe: 120 });
    this.setzeLöffel();
    this.tween(l, { alpha: 0 }, 0.5, { ease: 'sineInOut' });
    r.schöpft = false;
    if (this.r !== r) return;
    r.phase = 'geben';
    sfx('common/funkeln', { vol: 0.35 });
    this.machBrotGreifbar();
  }

  machBrotGreifbar() {
    const r = this.r;
    const brot = r.brot;
    const heim = { x: brot.c.x, y: brot.c.y };
    brot.zug = drag(brot.c, {
      lift: 1.1,
      back: false,
      targets: () => r.gäste.filter((g) => !g.satt && !g.bekommt).map((g) => ({ gast: g, ...this.maul(g.a), radius: 330 })),
      onDrop: (z, ctx) => {
        let g = z?.gast;
        if (!g && kurz(ctx)) g = this.nächsterHungriger(brot.c.x);
        if (g) { this.gibBrot(g); return; }
        this.tween(brot.c, heim, gleitDauer(heim.x - brot.c.x, heim.y - brot.c.y, 0.4, 3), { ease: 'cubicOut' });
      },
    });
  }

  async gibBrot(g) {
    const r = this.r;
    const brot = r.brot;
    if (!brot || brot.weg || !brot.fertig || g.bekommt || g.satt) return;
    brot.weg = true;
    g.bekommt = true;
    brot.zug?.off();
    brot.zug = null;
    const ok = await lassEssen(this, g.a, brot.c, { bissen: 3 });
    g.satt = true;
    if (ok && this.r === r) this.rundeGeschafft();
  }

  // ---------------------------------------------------------------- Biene (nur in Marmeladen-Runden, manchmal)

  baueBiene() {
    this.bieneModus = 'weg';
    this.biene = new Flieger(this, 'garten/biene', {
      x: 1500, y: 450, maß: 110, art: 'biene', tempo: 90, z: 1450,
      wähleZiel: () => {
        if (this.bieneModus === 'topf') {
          this.bieneModus = 'blumen';
          return { x: this.öffnung.x + rand(-110, 110), y: this.öffnung.y - 40, sitzen: true, dauer: rand(5, 7) };
        }
        if (this.bieneModus === 'blumen') {
          this.bieneModus = 'raus';
          return { x: -880 + rand(-60, 60), y: 540, sitzen: true, dauer: rand(4, 6) };
        }
        this.bieneModus = 'weg';
        return { x: 1500, y: rand(350, 600), sitzen: false };
      },
    });
    this.biene.c.visible = false;
  }

  bieneKommt() {
    if (this.bieneModus !== 'weg' || !this.aktiv) return;
    const b = this.biene;
    b.c.position.set(1450, rand(380, 560));
    b.c.visible = true;
    this.bieneModus = 'topf';
    b.ziel = null;
    b.sitzt = 0;
    sfx('common/biene', { vol: 0.35 });
  }

  // ---------------------------------------------------------------- Ende der Runde

  async rundeGeschafft() {
    const r = this.r;
    if (r.fertig) return;
    r.fertig = true;
    r.phase = 'fertig';
    await this.wait(0.5);
    await belohne(this, r.art === 'suppe' ? 'garten_suppe' : 'garten_marmelade', 120, 700);
    await this.wait(1.0);
    // Löffel weg, Topf leer, Gäste gehen
    this.tween(this.löffel, { alpha: 0 }, 0.5, { ease: 'sineInOut' });
    for (const g of r.gäste) {
      if (g.a && !g.a.destroyed) g.a.bubble('common/p_herz', 1.2, { seite: 'rechts' });
    }
    await this.wait(1.4);
    const wege = r.gäste.map(async (g, i) => {
      await this.wait(i * 0.5);
      const a = g.a;
      if (!a || a.destroyed) return;
      await a.walkTo(GAST_VON, a.y, { tempo: 260 });
      if (!a.destroyed) a.destroy({ children: true });
    });
    const p = { l: r.level };
    this.tween(p, { l: 0 }, 1.2, { ease: 'sineInOut', onUpdate: () => { r.level = p.l; this.zeichneInhalt(); } });
    for (const s of r.schalen) if (!s.c.destroyed) this.tween(s.c, { alpha: 0 }, 0.6).then(() => { if (!s.c.destroyed) s.c.destroy({ children: true }); });
    await Promise.all(wege);
    for (const z of r.zutaten) if (!z.sp.destroyed && z.zustand !== 'topf') z.sp.destroy();
    await this.wait(0.6);
    if (this.r !== r) return;
    this.neueRunde();
  }

  // ---------------------------------------------------------------- Ablauf

  update(dt) {
    this.uhr += dt;
    this.vogel.update(dt);
    if (this.biene.c.visible) {
      this.biene.update(dt);
      if (this.bieneModus === 'weg' && this.biene.c.x > 1400) this.biene.c.visible = false;
    }
  }

  // Welcher Schritt ist gerade dran? (für Hand und Stimme)
  schritt() {
    const r = this.r;
    if (!r || r.fertig) return 'warten';
    if (r.art === 'suppe' && r.phase === 'gemüse') {
      const z = r.inArbeit;
      if (!z) return 'waschen';
      if (z.zustand === 'brett') return 'schneiden';
      if (r.brettBereit) return 'brett';
      return 'warten';
    }
    if (r.phase === 'obst') return 'obst';
    if (r.phase === 'rühren') return 'rühren';
    // (die Schalen erscheinen erst kurz nach dem Kochen – bis dahin ist auch schon „schöpfen" dran)
    if (r.phase === 'schöpfen') return !r.schalen.length || r.schalen.some((s) => !s.voll) ? 'schöpfen' : 'essen';
    if (r.phase === 'essen') return 'essen';
    return r.phase;
  }

  hinweise() {
    const r = this.r;
    const s = this.schritt();
    const öffnung = { x: this.öffnung.x, y: this.öffnung.y - 40 };
    if (r) {
      const imKorb = r.zutaten.find((x) => x.zustand === 'korb' && !x.sp.destroyed);
      if (s === 'waschen' && imKorb) return [{ von: imKorb.sp, nach: { x: EIMER.x, y: EIMER.y - 80 } }];
      if (s === 'schneiden' && r.inArbeit?.sp && !r.inArbeit.sp.destroyed) return [r.inArbeit.sp];
      if (s === 'brett') return [{ von: this.brett, nach: öffnung }];
      if (s === 'obst' && imKorb) return [{ von: imKorb.sp, nach: öffnung }];
      if (s === 'rühren') return [this.löffel];
      if (s === 'schöpfen') return [this.topf];
      if (s === 'essen') {
        const schale = r.schalen.find((x) => x.voll && !x.weg);
        const g = this.nächsterHungriger(schale?.c.x ?? 0);
        if (schale && g) return [{ von: schale.c, nach: this.maul(g.a) }];
      }
      if (s === 'abfüllen' && r.glas) return [r.glas.c];
      if (s === 'deckel' && r.deckel && !r.deckel.destroyed) return [{ von: r.deckel, nach: { x: GLAS.x, y: GLAS.y - 170 } }];
      if (s === 'regal' && r.glas) {
        const p = REGAL_PLÄTZE[this.regalStand().n % REGAL_PLÄTZE.length];
        return [{ von: r.glas.c, nach: { x: p.x, y: p.y - 60 } }];
      }
      if (s === 'brot' && r.brot) return [r.brot.c];
      if (s === 'geben' && r.brot && !r.brot.weg) {
        const g = this.nächsterHungriger(r.brot.c.x);
        if (g) return [{ von: r.brot.c, nach: this.maul(g.a) }];
      }
      const gast = r.gäste.find((g) => g.a && !g.a.destroyed);
      if (gast) return [gast.a];
    }
    return [this.topf];
  }
}
