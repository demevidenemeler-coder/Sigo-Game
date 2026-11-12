// Seite 2: Die Blumenwiese – ein Strauß für einen Gast.
// Ablauf einer Runde:
//   1. Ein Gast (Kuh, Schaf, Ente, Katze, Huhn, Frosch – nie einer der letzten zwei) kommt auf die Wiese und
//      zeigt in einer Denkblase seine Lieblingsblume (nie eine der letzten drei Farben).
//   2. Öffnen: Knospen antippen → sie gehen weich auf und singen (jede Blume ein Ton der Fünftonleiter).
//   3. Pflücken: Blumen in die Vase ziehen (eine Knospe geht dabei von selbst auf). Drei Blumen machen den Strauß.
//   4. Schleife: Eine Schleife in der Farbe der Lieblingsblume erscheint – antippen, sie bindet sich um die Vase.
//   5. Verschenken: Die Vase zum Gast ziehen (oder antippen). Er freut sich (mit der Lieblingsblume im Strauß noch
//      mehr), es gibt einen Sticker, aus dem Strauß flattert ein neuer Schmetterling (es werden mit jeder Runde mehr),
//      der Gast geht mit dem Strauß, die Blumen schlafen ein, wo gepflückt wurde, wachsen neue Knospen.
// Sind einmal alle sieben Blumen offen, erscheint wie bisher weich ein Regenbogen (Sticker).
// Schmetterlinge und die Biene fliegen ruhig zu offenen Blumen (höchstens zwei in der Luft); antippen → auffliegen,
// und der Finger greift trotzdem die Blume darunter (das Tierchen verschluckt keinen Griff).
// Kleine Überraschung: Manchmal krabbelt dort, wo eine Blume gepflückt wurde, ein Marienkäfer aus dem Gras.

import { tap, drag, sfx, voice, note, fx, spr, meta, Actor, rand, pick, clamp, killTweensOf, PIXI } from '../../engine/index.js';
import { Seite } from '../../gemeinsam/seiten.js';
import { belohne } from '../../gemeinsam/sticker.js';
import { Flieger, wolken, bogen, umhängen, gleitDauer, wähleNeu } from './helfer.js';

// von links nach rechts: Farbe und Ton (C-Dur-Fünftonleiter: C D E G A C D)
const FARBEN = ['rot', 'orange', 'gelb', 'weiss', 'blau', 'lila', 'rosa'];
const TÖNE = [72, 74, 76, 79, 81, 84, 86];
const SCHLEIFEN_FARBE = {
  rot: 0xff7b7b, orange: 0xffad5c, gelb: 0xffe36b, weiss: 0xfff7ee, blau: 0x86bfff, lila: 0xc7a2ff, rosa: 0xff9fd0,
};
const HÖHE_HINTEN = 370;   // Blumen der hinteren Reihe (kleiner, weiter weg)
const HÖHE_VORN = 450;     // Blumen der vorderen Reihe
const FLIEGER_Z = 1600;    // Schmetterlinge und Biene liegen über beiden Blumenreihen (sitzen sichtbar auf der Blüte)
const HÖCHSTENS_IN_DER_LUFT = 2;   // Ruhe-Regel: höchstens zwei fliegen gleichzeitig, die anderen sitzen
const HÖCHSTENS_FLIEGER = 7;       // so viele Schmetterlinge (samt Biene) werden es mit den Runden höchstens
// Blumenplätze: hintere Reihe (vier) und vordere Reihe (drei), etwas nach links gerückt – rechts stehen Vase und Gast
const PLÄTZE = [[-930, 1130], [-700, 1420], [-480, 1130], [-250, 1420], [-30, 1130], [200, 1420], [420, 1130]];
// Plätze im Gras zwischen den Blumen, auf denen ein Flieger ausruhen kann
const GRAS = [[-1060, 1300], [-250, 1010], [210, 990], [640, 1150], [-30, 1480], [-1000, 1490]];
const VASE = { x: 720, y: 1492 };
const VASE_SKALA = 0.62;
const STRAUSS = 3;         // so viele Blumen machen den Strauß
const FÄCHER = [-0.3, 0.3, 0];   // Neigung der Blumen in der Vase (die dritte steht mittig vorn)
const GÄSTE = [
  { tier: 'kuh', scale: 0.3 }, { tier: 'schaf', scale: 0.3 }, { tier: 'ente', scale: 0.29 },
  { tier: 'katze', scale: 0.29 }, { tier: 'huhn', scale: 0.29 }, { tier: 'frosch', scale: 0.3 },
];
const GAST = { x: 995, y: 1320 };
const GAST_WEG = 1560;
// neue Schmetterlinge: Bild und Tönung (die drei Bilder in anderen Farben)
const NEUE_FALTER = [
  ['garten/schmetterling_gelb', 0xffb877], ['garten/schmetterling_rosa', 0xcdb6ff],
  ['garten/schmetterling_gelb', 0xb8f5c8],
];

export class Wiese extends Seite {
  static hg = 'garten/hg_wiese';

  aufbau() {
    this.feier = false;
    this.uhr = 0;
    this.gast = null;
    this.gastCfg = null;
    this.gastDa = false;
    this.wunsch = null;        // Farbe der Lieblingsblume des Gasts
    this.blumen = PLÄTZE.map((p, i) => this.baueBlume(i, false));
    this.baueVase();

    // Regenbogen (erst unsichtbar) hinter allem, aber vor dem Himmel
    this.regenbogen = spr('common/regenbogen', { anchor: 0.5, x: 0, y: 470, parent: this.hinten, z: -950 });
    this.regenbogen.scale.set(1.3);
    this.regenbogen.alpha = 0;
    this.regenbogen.visible = false;

    this.wolken = wolken(this.hinten, [
      { id: 'common/wolke3', x: -620, y: 250, breite: 230, tempo: 7 },
      { id: 'common/wolke2', x: 420, y: 215, breite: 360, tempo: 5 },
    ]);

    // Flieger: drei Schmetterlinge und die Biene – über den Blumen, damit man sie auf den Blüten sieht
    const wähle = (f) => this.blumenZiel(f);
    const z = FLIEGER_Z;
    this.gras = GRAS.map(([x, y]) => ({ x, y, gras: true }));
    this.flieger = [
      new Flieger(this, 'garten/schmetterling_blau', { x: -700, y: 500, maß: 130, tempo: 85, z, wähleZiel: wähle }),
      new Flieger(this, 'garten/schmetterling_gelb', { x: 200, y: 420, maß: 120, tempo: 80, z, wähleZiel: wähle }),
      new Flieger(this, 'garten/schmetterling_rosa', { x: 800, y: 560, maß: 125, tempo: 80, z, wähleZiel: wähle }),
      new Flieger(this, 'garten/biene', { x: -100, y: 650, maß: 120, art: 'biene', tempo: 75, z, wähleZiel: wähle }),
    ];
    this.neueFalter = 0;
    // Zu Beginn ruhen zwei im Gras (Ruhe-Regel: höchstens zwei in der Luft)
    this.flieger[0].setzeSitzend(this.gras[0].x, this.gras[0].y, rand(4, 7), this.gras[0]);
    this.flieger[3].setzeSitzend(this.gras[2].x, this.gras[2].y, rand(7, 10), this.gras[2]);

    this.neuerGast({ sofort: true });
    // Der Gast zeigt ab und zu seine Lieblingsblume (nur, wenn gerade niemand spielt)
    this.every(12, () => {
      if (this.aktiv && this.szene.idle > 3 && this.gastDa && this.vase.phase === 'pflücken') this.zeigeWunsch();
    });
  }

  betreten() {
    // Hinweise kurz nach dem Hereingleiten anbieten (der Kern sagt jeden höchstens einmal am Tag), nur solange sie
    // passen: erst „Tipp die Blumen an", dann „Pflück Blumen für die Vase"
    this.blumeHier = false;
    this._hinweis?.kill();
    const passt = () => this.aktiv && !this.blumeHier && this.blumen.some((b) => b && !b.offen && !b.imVase);
    const pflücken = () => this.aktiv && this.vase.phase === 'pflücken' && this.vase.blumen.length === 0 &&
      this.blumen.some((b) => b && b.offen);
    this._hinweis = this.after(2.5, () => {
      if (passt()) voice('garten_blumen', { nurWenn: passt });
      else if (pflücken()) voice('garten_strauss', { nurWenn: pflücken });
    });
    if (this.gastDa) this.after(1.4, () => { if (this.aktiv) this.zeigeWunsch(); });
  }

  verlassen() {
    this._hinweis?.kill();
    this._hinweis = null;
  }

  // ---------------------------------------------------------------- Blumen

  baueBlume(i, weich) {
    const [x, y] = PLÄTZE[i];
    const vorn = y > 1300;
    const höhe = vorn ? HÖHE_VORN : HÖHE_HINTEN;
    const farbe = FARBEN[i];
    const c = new PIXI.Container({ label: 'blume:' + farbe });
    c.position.set(x, y);
    c.zIndex = Math.round(y);
    const zu = spr(`garten/blume_${farbe}_zu`, { parent: c });
    const auf = spr(`garten/blume_${farbe}_auf`, { parent: c });
    const s = höhe / 420;
    zu.scale.set(s);
    auf.scale.set(s);
    auf.alpha = 0;
    // weicher Schatten am Boden
    const schatten = new PIXI.Graphics().ellipse(0, 0, 70 * s, 16 * s).fill({ color: 0x2d4a14, alpha: 0.18 });
    c.addChildAt(schatten, 0);
    this.welt.addChild(c);
    const blume = {
      i, c, zu, auf, s, höhe, farbe, offen: false, ton: TÖNE[i], phase: rand(0, 6), wiegt: false, imVase: false,
      schatten, heim: { x, y }, kopf: { x, y: y - höhe * 0.82 }, zug: null,
    };
    c.hitArea = new PIXI.Rectangle(-150, -höhe - 30, 300, höhe + 60);
    blume.zug = drag(c, {
      lift: 1.06,
      sound: null,
      heim: { x, y },
      targets: () => (this.vase.phase === 'pflücken' && this.vase.blumen.length < STRAUSS && !this.vase.unterwegs
        ? [{ id: 'vase', x: this.vase.c.x, y: this.vase.c.y - 260, radius: 300 }] : []),
      onStart: () => this.tippeBlume(blume),
      onDrop: (ziel, ctx) => {
        if (ziel && !blume.imVase) {
          this.inDieVase(blume);
          return;
        }
        // daneben (oder nur angetippt): weich zurück an ihren Platz (weg-abhängig, damit nichts zurückschießt)
        ctx.back(gleitDauer(x - c.x, y - c.y, 0.35, 3));
      },
    });
    if (weich) {
      c.scale.set(0.05);
      this.tween(c, { scale: 1 }, 0.9, { ease: 'backOut' });
    }
    return blume;
  }

  tippeBlume(b) {
    this.blumeHier = true;
    if (!b.offen) this.öffne(b);
    else this.wiege(b);
  }

  klinge(b) {
    note('xylo', b.ton, { vol: 0.75 });
    this.burst('noten', b.c.x, b.c.y - b.höhe * 0.82 - 60, { count: 1 });
  }

  öffne(b) {
    b.offen = true;
    killTweensOf(b.zu, ['alpha']);
    killTweensOf(b.auf, ['alpha']);
    // Die offene Blüte liegt oben: erst sie einblenden, dann die Knospe darunter ausblenden –
    // so scheint unterwegs nie die Wiese durch die Blume.
    this.tween(b.auf, { alpha: 1 }, 0.7, { ease: 'sineInOut' });
    this.tween(b.zu, { alpha: 0 }, 0.35, { ease: 'sineInOut', delay: 0.55 });
    fx.pop(b.auf, 0.08);
    this.klinge(b);
    if (!this.feier && this.blumen.every((x) => x && x.offen && !x.imVase)) this.feiern();
  }

  wiege(b) {
    this.klinge(b);
    if (b.wiegt) return;
    b.wiegt = true;
    const proxy = { p: 0 };
    this.tween(proxy, { p: 1 }, 1.6, {
      ease: 'linear',
      onUpdate: () => { if (!b.imVase && !b.c.destroyed) b.c.rotation = Math.sin(proxy.p * Math.PI * 3) * 0.1 * (1 - proxy.p); },
    }).then(() => {
      if (!b.imVase && !b.c.destroyed) b.c.rotation = 0;
      b.wiegt = false;
    });
  }

  schließe(b) {
    b.offen = false;
    killTweensOf(b.zu, ['alpha']);
    killTweensOf(b.auf, ['alpha']);
    this.tween(b.zu, { alpha: 1 }, 0.5, { ease: 'sineInOut' });
    this.tween(b.auf, { alpha: 0 }, 1.2, { ease: 'sineInOut', delay: 0.3 });
  }

  async feiern() {
    this.feier = true;
    await this.wait(0.9);
    // Regenbogen erscheint weich, die Blumen singen ihre Töne nacheinander
    const rb = this.regenbogen;
    rb.visible = true;
    killTweensOf(rb, ['alpha']);
    this.tween(rb, { alpha: 0.95 }, 2.5, { ease: 'sineInOut' });
    this.blumen.forEach((b, i) => this.after(0.4 + i * 0.28, () => {
      if (!b || b.imVase) return;
      note('glocke', b.ton, { vol: 0.35 });
      fx.pop(b.auf, 0.05);
    }));
    await this.wait(2.8);
    await belohne(this, 'garten_blume', 0, 560);
    await this.wait(6);
    // Der Regenbogen verblasst wieder; die Blumen bleiben offen (sie werden für den Strauß gebraucht)
    this.tween(rb, { alpha: 0 }, 3, { ease: 'sineInOut' }).then(() => { if (rb.alpha < 0.01) rb.visible = false; });
  }

  // ---------------------------------------------------------------- Vase und Strauß

  baueVase() {
    const c = new PIXI.Container({ label: 'vase' });
    c.position.set(VASE.x, VASE.y);
    c.zIndex = VASE.y;
    c.sortableChildren = true;
    const strauss = new PIXI.Container({ label: 'strauss' });
    strauss.zIndex = 1;
    const bild = spr('garten/vase', { parent: c, z: 2 });
    bild.scale.set(VASE_SKALA);
    const schatten = new PIXI.Graphics().ellipse(0, 0, 100, 20).fill({ color: 0x2d4a14, alpha: 0.2 });
    schatten.zIndex = 0;
    c.addChild(schatten, strauss);
    const m = meta('garten/vase');
    const hals = m.pts?.hals || [160, 32];
    const halsY = (hals[1] - m.ay * m.h) * VASE_SKALA;
    this.welt.addChild(c);
    this.vase = { c, bild, strauss, halsY, blumen: [], phase: 'pflücken', schleife: null, unterwegs: false, zug: null };
    c.hitArea = new PIXI.Rectangle(-140, -m.h * VASE_SKALA - 140, 280, m.h * VASE_SKALA + 170);
    this.vase.zug = drag(c, {
      lift: 1.06,
      sound: null,
      back: false,
      targets: () => (this.gastDa && this.vase.phase === 'schenken' ? [{ id: 'gast', ...this.gastMaul(), radius: 330 }] : []),
      onStart: () => { sfx('common/klack', { vol: 0.35 }); this.burst('funkeln', c.x, c.y - 300, { count: 1 }); },
      onDrop: (ziel, ctx) => {
        const kurz = Math.hypot(ctx.x - ctx.startX, ctx.y - ctx.startY) < 70;
        const v = this.vase;
        if (v.phase === 'schenken' && this.gastDa && (ziel || kurz)) { this.after(0.22, () => this.verschenke()); return; }
        // noch nicht fertig: ein angetippter Strauß zeigt, was fehlt (die Schleife hüpft), sonst zurück
        if (kurz && v.phase === 'schleife') this.bindeSchleife();
        else if (kurz && v.phase === 'pflücken') fx.wobble(c, 0.05);
        this.tween(c, { x: VASE.x, y: VASE.y }, gleitDauer(VASE.x - c.x, VASE.y - c.y, 0.35, 3), { ease: 'cubicOut' });
      },
    });
  }

  // Platz der n-ten Blume im Strauß (in Koordinaten der Vase): Fuß im Bauch der Vase, Blüten fächern sich auf
  straussPlatz(n) {
    return { x: [-34, 34, 0][n], y: this.vase.halsY + 95, rotation: FÄCHER[n] };
  }

  async inDieVase(b) {
    const v = this.vase;
    if (v.blumen.length >= STRAUSS) return;
    b.imVase = true;
    v.blumen.push(b);
    b.zug?.off();
    b.zug = null;
    b.c.eventMode = 'none';
    if (!b.offen) this.öffne(b);
    b.offen = true;
    b.schatten.visible = false;
    const n = v.blumen.length - 1;
    const platz = this.straussPlatz(n);
    // In der Vase ist die Blume kleiner (ein Strauß, kein Baum)
    const skala = 0.72 * (HÖHE_HINTEN / b.höhe);
    killTweensOf(b.c);
    sfx('common/rascheln', { vol: 0.45 });
    await bogen(this, b.c, v.c.x + platz.x, v.c.y + platz.y, { dauer: 0.4, höhe: 60, skala, dreh: platz.rotation - b.c.rotation });
    if (b.c.destroyed) return;
    umhängen(b.c, v.strauss);
    b.c.position.set(platz.x, platz.y);
    b.c.rotation = platz.rotation;
    b.c.zIndex = n === 2 ? 3 : 1;
    sfx('common/plopp', { vol: 0.6 });
    fx.pop(v.c, 0.05);
    note('glocke', b.ton, { vol: 0.3 });
    // Überraschung: wo die Blume stand, krabbelt manchmal ein Marienkäfer aus dem Gras
    if (Math.random() < 0.3) this.käferKommt(b.heim.x, b.heim.y);
    if (b.farbe === this.wunsch && this.gastDa) this.after(0.4, () => this.gast?.nod?.());
    if (v.blumen.length >= STRAUSS) this.after(0.6, () => this.zeigeSchleife());
  }

  // Die Schleife erscheint schwebend neben dem Strauß – antippen, dann bindet sie sich um die Vase
  zeigeSchleife() {
    const v = this.vase;
    if (v.phase !== 'pflücken' || v.schleife) return;
    v.phase = 'schleife';
    const s = spr('garten/schleife', { anchor: 0.5, parent: this.welt, z: 1700 });
    s.tint = SCHLEIFEN_FARBE[this.wunsch] ?? 0xff9fd0;
    const ss = 150 / s.texture.width;
    s.scale.set(ss * 0.3);
    s.position.set(v.c.x - 210, v.c.y - 420);
    s.alpha = 0;
    s.ruhe = ss;
    s.hitArea = new PIXI.Rectangle(-130 / ss, -130 / ss, 260 / ss, 260 / ss);
    v.schleife = s;
    note('glocke', 84, { vol: 0.3 });
    this.tween(s, { alpha: 1 }, 0.4, { ease: 'sineInOut' });
    this.tween(s, { scale: ss }, 0.6, { ease: 'backOut' });
    tap(s, () => this.bindeSchleife(), { sound: null, squash: false });
  }

  async bindeSchleife() {
    const v = this.vase;
    const s = v.schleife;
    if (v.phase !== 'schleife' || !s || s.gebunden) return;
    s.gebunden = true;
    s.eventMode = 'none';
    killTweensOf(s);
    sfx('common/rascheln', { vol: 0.4 });
    umhängen(s, v.c);
    s.zIndex = 5;
    // weich zum Hals der Vase, dort ein kleiner „Zieh-fest"-Hüpfer
    await bogen(this, s, 0, v.halsY + 22, { dauer: 0.55, höhe: 80, skala: s.ruhe * 0.85, dreh: -s.rotation });
    if (s.destroyed) return;
    await this.tween(s, { scaleX: s.ruhe * 1.05, scaleY: s.ruhe * 0.7 }, 0.12, { ease: 'quadOut' });
    await this.tween(s, { scaleX: s.ruhe * 0.85, scaleY: s.ruhe * 0.85 }, 0.35, { ease: 'backOut' });
    sfx('common/funkeln', { vol: 0.45 });
    this.burst('funkeln', v.c.x, v.c.y - 280, { count: 4 });
    v.phase = 'schenken';
    const schenken = () => this.aktiv && this.vase.phase === 'schenken';
    this.after(0.5, () => { if (schenken()) voice('garten_schenken', { nurWenn: schenken }); });
  }

  async verschenke() {
    const v = this.vase;
    const gast = this.gast;
    if (v.phase !== 'schenken' || !gast || !this.gastDa) return;
    v.phase = 'weg';
    v.zug?.off();
    v.zug = null;
    v.c.eventMode = 'none';
    killTweensOf(v.c);
    this.gastDa = false;
    // Die Vase gleitet neben den Gast (etwas kleiner: sie steht nun weiter hinten)
    const ziel = { x: gast.x - 205, y: gast.y + 30 };
    await bogen(this, v.c, ziel.x, ziel.y, { dauer: 0.6, höhe: 120, skala: 0.88 });
    if (v.c.destroyed || gast.destroyed) return;
    sfx('common/landen', { vol: 0.5 });
    const lieblingsblume = v.blumen.some((b) => b.farbe === this.wunsch);
    await gast.cheer({ parent: this.vorn });
    if (lieblingsblume) {
      this.burst('herzen', gast.x - 30, gast.y - 300, { count: 4 });
      note('glocke', 88, { vol: 0.3 });
    }
    await belohne(this, 'garten_blume', gast.x - 160, gast.y - 640);
    await this.wait(0.4);
    // Aus dem Strauß flattert ein neuer Schmetterling (es werden mit jeder Runde mehr)
    this.neuerFalter(v.c.x, v.c.y - 320);
    await this.wait(1.2);
    // Der Gast geht – der Strauß geht mit
    const dx = GAST_WEG - gast.x;
    const dauer = Math.abs(dx) / 230;
    this.tween(v.c, { x: v.c.x + dx }, dauer, { ease: 'linear' });
    await gast.walkTo(GAST_WEG, gast.y, { tempo: 230 });
    if (!gast.destroyed) gast.destroy({ children: true });
    if (this.gast === gast) this.gast = null;
    await this.neueRunde();
  }

  // Die Blumen schlafen ein, wo gepflückt wurde wachsen Knospen, eine neue Vase steht bereit, der nächste Gast kommt
  async neueRunde() {
    const alteVase = this.vase;
    for (const b of alteVase.blumen) this.blumen[b.i] = null;
    alteVase.c.destroy({ children: true });
    for (const b of this.blumen) {
      if (b && b.offen) {
        this.schließe(b);
        await this.wait(0.5);
      }
    }
    this.feier = false;
    for (let i = 0; i < this.blumen.length; i++) {
      if (this.blumen[i]) continue;
      this.blumen[i] = this.baueBlume(i, true);
      note('glocke', TÖNE[i], { vol: 0.2 });
      await this.wait(0.4);
    }
    this.baueVase();
    const v = this.vase;
    v.c.alpha = 0;
    this.tween(v.c, { alpha: 1 }, 0.7, { ease: 'sineInOut' });
    await this.wait(0.8);
    this.neuerGast();
  }

  // ---------------------------------------------------------------- Gast

  async neuerGast({ sofort = false } = {}) {
    // nie einer der letzten zwei Gäste und keine der letzten drei Lieblingsfarben
    this.gastVerlauf = this.gastVerlauf || [];
    this.farbVerlauf = this.farbVerlauf || [];
    const tier = wähleNeu(GÄSTE.map((g) => g.tier), this.gastVerlauf, 2);
    const cfg = GÄSTE.find((g) => g.tier === tier);
    this.gastCfg = cfg;
    this.wunsch = wähleNeu(FARBEN, this.farbVerlauf, 3);
    this.gastDa = false;
    const a = new Actor(cfg.tier, {
      x: sofort ? GAST.x : GAST_WEG, y: GAST.y, scale: cfg.scale, parent: this.welt, z: GAST.y,
    });
    this.gast = a;
    a.onTap(() => {
      fx.wobble(a, 0.05);
      a.sound();
      if (this.gastDa && this.vase.phase === 'schenken') this.verschenke();
      else if (this.gastDa) this.zeigeWunsch();
    });
    if (!sofort) {
      sfx('common/hupf', { vol: 0.4 });
      const ok = await a.walkTo(GAST.x, GAST.y, { tempo: 230 });
      if (!ok || a.destroyed || a !== this.gast) return;
    }
    a.lookAt(GAST.x - 100);
    this.gastDa = true;
    if (!sofort && this.aktiv) {
      await this.wait(0.3);
      this.zeigeWunsch();
      const pflücken = () => this.aktiv && this.vase.phase === 'pflücken' && this.vase.blumen.length === 0;
      this.after(3, () => { if (pflücken()) voice('garten_strauss', { nurWenn: pflücken }); });
    }
  }

  zeigeWunsch() {
    const g = this.gast;
    if (!g || g.destroyed || !this.wunsch) return;
    g.bubble(`garten/blume_${this.wunsch}_auf`, 2.6, { seite: 'links' });
  }

  gastMaul() {
    const g = this.gast;
    return g?.point('mouth') || { x: GAST.x - 40, y: GAST.y - 160 };
  }

  // ---------------------------------------------------------------- Überraschung und neue Schmetterlinge

  käferKommt(x, y) {
    if (this.käfer && !this.käfer.destroyed) return;
    const k = spr('garten/marienkaefer', { anchor: 0.5, parent: this.welt, x, y: y - 20, z: Math.round(y) + 1 });
    const s = 80 / k.texture.width;
    k.scale.set(s * 0.3);
    k.alpha = 0;
    k.hitArea = new PIXI.Circle(0, 0, 125 / s);
    this.käfer = k;
    const richtung = pick([-1, 1]);
    this.tween(k, { alpha: 1 }, 0.4, { ease: 'sineInOut' });
    this.tween(k, { scale: s }, 0.5, { ease: 'backOut' });
    this.tween(k, { x: x + richtung * 160, rotation: richtung * 0.4 }, 7, { ease: 'sineInOut', delay: 0.6 });
    tap(k, () => {
      note('glocke', pick([88, 91]), { vol: 0.3 });
      fx.pop(k, 0.15);
    }, { sound: null, squash: false });
    this.after(9, () => {
      if (k.destroyed) return;
      this.tween(k, { alpha: 0 }, 0.8, { ease: 'sineInOut' }).then(() => { if (!k.destroyed) k.destroy(); });
    });
  }

  neuerFalter(x, y) {
    if (this.flieger.length >= HÖCHSTENS_FLIEGER) {
      // schon viele: die vorhandenen grüßen nur (ein Schmetterling flattert kurz auf)
      pick(this.flieger.filter((f) => !f.fliegt) || this.flieger)?.aufflattern();
      return;
    }
    const [id, tönung] = NEUE_FALTER[this.neueFalter % NEUE_FALTER.length];
    this.neueFalter++;
    const f = new Flieger(this, id, { x, y, maß: 115, tempo: 80, z: FLIEGER_Z, wähleZiel: (q) => this.blumenZiel(q) });
    f.sprite.tint = tönung;
    f.c.alpha = 0;
    this.tween(f.c, { alpha: 1 }, 0.6, { ease: 'sineInOut' });
    note('pling', 88, { vol: 0.25 });
    f.ziel = { x: clamp(x - 300, -900, 900), y: rand(380, 560), sitzen: false };
    this.flieger.push(f);
  }

  // Ziel für Schmetterlinge/Biene: eine offene Blume, auf der noch niemand sitzt – sonst ein Stück Himmel.
  // Sind schon zwei andere in der Luft, fliegt dieses nur zu einem nahen Sitzplatz (Blume oder Gras) und ruht dort.
  blumenZiel(f) {
    const besetzt = (d) => this.flieger?.some((o) => o !== f && o.ding === d);
    const frei = this.blumen.filter((b) => b && b.offen && !b.imVase && !besetzt(b));
    const inDerLuft = (this.flieger || []).filter((o) => o !== f && o.fliegt).length;
    const aufBlume = (b) => ({ x: b.kopf.x + rand(-10, 10), y: b.kopf.y - 22, sitzen: true, dauer: rand(5, 9), ding: b });
    if (inDerLuft >= HÖCHSTENS_IN_DER_LUFT) {
      if (frei.length && Math.random() < 0.7) return aufBlume(this.nächstes(frei, f));
      const gras = this.nächstes(this.gras.filter((g) => !besetzt(g)), f);
      if (gras) return { x: gras.x, y: gras.y, sitzen: true, dauer: rand(6, 10), ding: gras };
    }
    if (frei.length && Math.random() < 0.75) return aufBlume(pick(frei));
    if (Math.random() < 0.35) {
      const gras = pick(this.gras.filter((g) => !besetzt(g)));
      if (gras) return { x: gras.x, y: gras.y, sitzen: true, dauer: rand(4, 8), ding: gras };
    }
    return { x: rand(-950, 950), y: rand(380, 880), sitzen: false };
  }

  // das dem Flieger nächste Ding einer Liste (oder null)
  nächstes(liste, f) {
    let bestes = null;
    let d = Infinity;
    for (const o of liste) {
      const p = o.kopf || o;
      const e = Math.hypot(p.x - f.c.x, p.y - f.c.y);
      if (e < d) { d = e; bestes = o; }
    }
    return bestes;
  }

  // ---------------------------------------------------------------- Ablauf

  update(dt, t) {
    this.uhr += dt;
    this.wolken.update(dt);
    for (const f of this.flieger) {
      // Blume wiegt sich oder wird gepflückt: auffliegen; Blume hat sich geschlossen: ruhig weiter
      const b = f.ding;
      if (b && !b.gras && f.sitzt > 0) {
        if (b.wiegt || b.imVase || b.c.destroyed || b.c.x !== b.heim.x || b.c.y !== b.heim.y) f.aufflattern();
        else if (!b.offen) { f.sitzt = 0; f._neuesZiel(); }
      }
      // Ruhe-Regel: Wäre es gleich mit dem Sitzen fertig, während schon zwei fliegen, bleibt es noch ein wenig
      if (f.sitzt > 0 && f.sitzt <= dt * 1.5 &&
        this.flieger.filter((o) => o !== f && o.fliegt).length >= HÖCHSTENS_IN_DER_LUFT) {
        f.sitzt += rand(1.5, 3);
      }
      f.update(dt);
    }
    // Blumen wiegen sich ganz leicht im Wind
    for (const b of this.blumen) {
      if (!b || b.imVase) continue;
      const w = 0.02 * Math.sin(t * 0.9 + b.phase);
      b.zu.skew.x = w;
      b.auf.skew.x = w;
    }
    // die Schleife schwebt sanft, solange sie wartet
    const s = this.vase.schleife;
    if (s && !s.gebunden && !s.destroyed) s.rotation = 0.08 * Math.sin(t * 1.6);
  }

  hinweise() {
    const v = this.vase;
    const liste = [];
    if (v.phase === 'schenken' && this.gastDa) liste.push({ von: v.c, nach: this.gastMaul() });
    if (v.phase === 'schleife' && v.schleife && !v.schleife.gebunden) liste.push(v.schleife);
    if (v.phase === 'pflücken' && v.blumen.length < STRAUSS) {
      const da = this.blumen.filter((b) => b && !b.imVase);
      const lieb = da.find((b) => b.farbe === this.wunsch && !v.blumen.some((x) => x.farbe === this.wunsch));
      const offen = da.find((b) => b.offen);
      const erste = lieb || offen;
      if (erste) liste.push({ von: erste.auf, nach: { x: v.c.x, y: v.c.y - 260 } });
      const zu = da.find((b) => !b.offen && b !== erste);
      if (zu) liste.push(zu.c);
    }
    if (!liste.length && this.gast && !this.gast.destroyed) liste.push(this.gast);
    if (!liste.length) liste.push(this.flieger[0].c);
    return liste;
  }
}
