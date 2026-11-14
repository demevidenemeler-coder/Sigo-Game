// Seite 1: Fütterung. Das Kind ist Tierpfleger. Jede Runde kommt ein anderes Zootier ans Gehege und zeigt in der
// Denkblase, was es mag.
//   1. Futter aus der Kiste in den Futterwagen ziehen (oder antippen) – zwei Stück, die Blase zeigt das nächste.
//   2. Den Wagen zum Tier ziehen (oder antippen) – er rollt hinüber.
//   3. Füttern, bei jedem Tier ein bisschen anders:
//        Giraffe  – das Futter in den Korb am Seil legen, dann am Seil ziehen: der Korb fährt hoch zum Maul.
//        Affe     – er sitzt oben auf dem Ast: Futter antippen, es fliegt hoch, der Affe fängt es.
//        Elefant  – Futter zum Elefanten ziehen, er frisst; zum Schluss trinkt er und prustet eine Fontäne.
//        Bär      – Futter zum Bären; danach trinkt er und patscht ins Wasser.
//        Pinguin  – erst Wasser in den Trog pumpen, dann den Fisch hineinlegen: der Pinguin springt hinterher.
//   4. Wasser pumpen: dreimal auf die Pumpe tippen, der Trog füllt sich, das Tier trinkt.
//   5. Das Tier freut sich, es gibt einen Sticker; der Wagen rollt zurück, das Tier geht, das nächste kommt.
// Nichts kann schiefgehen: Was daneben landet, gleitet zurück; jedes Futter wird freundlich genommen.

import { tap, drag, sfx, voice, note, fx, Actor, spr, meta, rand, pick, clamp, killTweensOf, PIXI } from '../../engine/index.js';
import { Seite } from '../../gemeinsam/seiten.js';
import { MAG } from '../../gemeinsam/futter.js';
import { belohne } from '../../gemeinsam/sticker.js';
import { umhängen, bogen, gleitDauer, wähleNeu, gemischt, lassEssen, tonEinmal, kurz } from './helfer.js';

// ---------------------------------------------------------------- Maße (Seiten-Koordinaten)
const KISTE = { x: -860, y: 1350, s: 0.85 };
const KISTE_PLÄTZE = [-1000, -860, -720];       // x der Futter in der Kiste
const KISTE_Y = 1215;
const WAGEN_HEIM = { x: -440, y: 1470 };
const WAGEN_ZIEL = { x: -20, y: 1470 };
const WAGEN_S = 0.78;
const LADE_PLÄTZE = [[-70, -22], [62, -26]];        // Futter im Wagen (relativ zum Punkt 'ladung')
const PUMPE = { x: 300, y: 1490, s: 0.55 };
const TROG = { x: 600, y: 1530, s: 0.68 };
const FUTTER_H = 150;                            // Höhe eines Futters
const KORB = { x: 540, unten: 1330, oben: 1060, s: 0.52 };
const AST_Y = 292;                               // Unterkante des langen Astes im Hintergrund
const KOMMT_VON = 1550;

// Die Zootiere der Fütterung: Platz, Größe und wie sie gefüttert werden
const TIERE = {
  giraffe: { x: 745, y: 1400, s: 0.9, art: 'korb', zweit: 'futter_salat' },
  affe: { x: 260, y: AST_Y + 6, s: 0.3, art: 'werfen', trinkt: { x: 800, y: 1420, s: 0.42 }, zweit: 'futter_nuss' },
  elefant: { x: 790, y: 1420, s: 0.52, art: 'geben', zweit: 'futter_apfel' },
  baer: { x: 790, y: 1420, s: 0.52, art: 'geben', zweit: 'futter_erdbeere' },
  pinguin: { x: 820, y: 1430, s: 0.44, art: 'becken', zweit: 'futter_banane' },
};
const NAMEN = Object.keys(TIERE);

// Testhilfe: Wert aus der Adresse (nur mit test=1), sonst null
function testWunsch(name) {
  try {
    const q = new URLSearchParams(location.search);
    return q.get('test') === '1' ? q.get(name) : null;
  } catch { return null; }
}

export class Fuetterung extends Seite {
  static hg = 'zoo/hg_futter';

  aufbau() {
    this.uhr = 0;
    this.r = null;
    this.verlauf = [];
    this.baueKiste();
    this.baueWagen();
    this.bauePumpe();
    this.baueTrog();
    this.baueKorb();
    this.neueRunde({ erste: true });
    // Das Tier zeigt ab und zu seinen Wunsch (nur, wenn gerade niemand spielt)
    this.every(9, () => {
      if (this.aktiv && this.szene.idle > 4 && this.r?.da && this.r.phase === 'laden') this.zeigeWunsch();
    });
  }

  betreten() {
    if (this.besuche === 1) voice('zoo_hallo');
    this._hinweis?.kill();
    this._hinweis = this.after(2.6, () => this.sageHinweis());
    if (this.r?.da) this.after(1.0, () => { if (this.aktiv) this.zeigeWunsch(); });
  }

  verlassen() {
    this._hinweis?.kill();
    this._hinweis = null;
  }

  sageHinweis() {
    const r = this.r;
    if (!this.aktiv || !r?.da) return;
    const ids = { laden: 'zoo_futter', fahren: 'zoo_wagen', seil: 'zoo_korb', wasser: 'zoo_pumpe' };
    const id = ids[r.phase];
    const phase = r.phase;
    if (id) voice(id, { nurWenn: () => this.aktiv && this.r === r && r.phase === phase });
  }

  // ---------------------------------------------------------------- Kiste, Wagen, Pumpe, Trog, Korb

  baueKiste() {
    this.kiste = spr('zoo/futterkiste', { x: KISTE.x, y: KISTE.y, parent: this.welt, z: 1300 });
    this.kiste.scale.set(KISTE.s);
    this.kistenInhalt = new PIXI.Container({ label: 'kisteninhalt', sortableChildren: true });
    this.kistenInhalt.zIndex = 1310;   // die Kiste ist niedrig und offen: das Futter liegt sichtbar obenauf
    this.welt.addChild(this.kistenInhalt);
    tap(this.kiste, () => {
      fx.wobble(this.kiste, 0.04);
      const f = this.r?.futter.find((x) => x.ort === 'kiste');
      if (f) fx.pop(f.sp, 0.12);
    }, { sound: 'common/klack', squash: false });
  }

  baueWagen() {
    const c = new PIXI.Container({ label: 'futterwagen', sortableChildren: true });
    c.position.set(WAGEN_HEIM.x, WAGEN_HEIM.y);
    c.zIndex = 1400;
    const b = spr('zoo/futterwagen', { parent: c, z: 1 });
    b.scale.set(WAGEN_S);
    const m = meta('zoo/futterwagen');
    const l = m.pts?.ladung || [370, 40];
    this.ladung = { x: (l[0] - m.ax * m.w) * WAGEN_S, y: (l[1] - m.ay * m.h) * WAGEN_S };
    this.wagenInhalt = new PIXI.Container({ label: 'wageninhalt', sortableChildren: true });
    this.wagenInhalt.zIndex = 2;   // liegt oben im Wagen
    c.addChild(this.wagenInhalt);
    c.hitArea = new PIXI.Rectangle(-300, -300, 560, 330);
    this.welt.addChild(c);
    this.wagen = c;
    this.wagenZug = drag(c, {
      lift: 1.03,
      back: false,
      sound: null,
      onStart: () => {
        if (this.r?.phase !== 'fahren') sfx('common/klack', { vol: 0.3 });
      },
      onMove: (z, ctx) => {
        // nur waagrecht, nur wenn er fahren darf
        if (this.r?.phase !== 'fahren') { c.position.set(ctx.startX, ctx.startY); return; }
        c.y = WAGEN_HEIM.y;
        c.x = clamp(c.x, WAGEN_HEIM.x - 40, WAGEN_ZIEL.x + 60);
      },
      onDrop: (z, ctx) => {
        const r = this.r;
        if (r?.phase === 'fahren' && (c.x > WAGEN_HEIM.x + 120 || kurz(ctx))) { this.fahreWagen(); return; }
        const ziel = r?.phase === 'fahren' || !r?.wagenDa ? WAGEN_HEIM : WAGEN_ZIEL;
        this.tween(c, { x: ziel.x, y: ziel.y }, gleitDauer(ziel.x - c.x, ziel.y - c.y, 0.3, 3), { ease: 'cubicOut' });
      },
    });
  }

  bauePumpe() {
    this.pumpe = spr('zoo/pumpe', { x: PUMPE.x, y: PUMPE.y, parent: this.welt, z: 1350 });
    this.pumpe.scale.set(PUMPE.s);
    const m = meta('zoo/pumpe');
    const a = m.pts?.auslauf || [505, 385];
    this.auslauf = { x: PUMPE.x + (a[0] - m.ax * m.w) * PUMPE.s, y: PUMPE.y + (a[1] - m.ay * m.h) * PUMPE.s };
    this.strahl = new PIXI.Graphics();
    this.strahl.zIndex = 1360;
    this.strahl.eventMode = 'none';
    this.welt.addChild(this.strahl);
    tap(this.pumpe, () => this.pumpen(), {
      sound: null, squash: false,
      hitArea: new PIXI.Rectangle(-m.ax * m.w - 20, -m.ay * m.h - 20, m.w + 40, m.h + 40),
    });
  }

  baueTrog() {
    this.trog = spr('zoo/trog', { x: TROG.x, y: TROG.y, parent: this.welt, z: 1500 });
    this.trog.scale.set(TROG.s);
    const m = meta('zoo/trog');
    const w = m.pts?.wasser || [300, 62];
    this.wasserPunkt = { x: TROG.x + (w[0] - m.ax * m.w) * TROG.s, y: TROG.y + (w[1] - m.ay * m.h) * TROG.s };
    this.trogBreite = m.w * TROG.s;
    this.wasser = new PIXI.Graphics();
    this.wasser.zIndex = 1501;
    this.wasser.eventMode = 'none';
    this.welt.addChild(this.wasser);
    this.pegel = 0;
    tap(this.trog, () => {
      fx.wobble(this.trog, 0.03);
      if (this.pegel > 0.2) {
        tonEinmal(this, 'common/platsch', 0.6, { vol: 0.35 });
        this.burst('tropfen', this.wasserPunkt.x + rand(-80, 80), this.wasserPunkt.y - 10, { count: 2 });
      } else sfx('common/klack', { vol: 0.3 });
    }, { sound: null, squash: false, hitArea: new PIXI.Rectangle(-m.ax * m.w, -m.ay * m.h - 60, m.w, m.h + 60) });
  }

  zeichneWasser() {
    const g = this.wasser;
    g.clear();
    const p = this.pegel;
    if (p <= 0.01) return;
    const o = this.wasserPunkt;
    const rx = this.trogBreite * 0.4;
    const y = o.y + 24 - p * 26;
    g.roundRect(o.x - rx, y, 2 * rx, 30 + p * 10, 22).fill({ color: 0x7fc8ea, alpha: 0.95 });
    g.ellipse(o.x, y + 4, rx - 6, 10).fill({ color: 0xbfe6f6, alpha: 0.9 });
    g.ellipse(o.x - rx * 0.5, y + 2, 34, 5).fill({ color: 0xffffff, alpha: 0.5 });
  }

  // Der Korb am Seil (nur bei der Giraffe zu sehen): Seil vom Ast, Korb, Griff zum Ziehen
  baueKorb() {
    const c = new PIXI.Container({ label: 'seilkorb', sortableChildren: true });
    c.zIndex = 1600;   // vor Pumpe, Trog und Giraffe (der Griff hängt über der Pumpe)
    this.welt.addChild(c);
    this.seil = new PIXI.Graphics();
    c.addChild(this.seil);
    this.korb = spr('common/icon_korb', { anchor: { x: 0.5, y: 0.9 }, parent: c, z: 2 });
    this.korb.scale.set(KORB.s);
    this.korbInhalt = new PIXI.Container({ label: 'korbinhalt', sortableChildren: true });
    this.korbInhalt.zIndex = 1;
    c.addChild(this.korbInhalt);
    this.korbY = KORB.unten;
    // Griff am Seilende (hängt neben dem Korb herunter)
    this.griff = new PIXI.Graphics();
    this.griff.roundRect(-50, -24, 100, 48, 24).fill(0xd9483b).stroke({ width: 6, color: 0x9a2e25 });
    this.griff.roundRect(-36, -15, 34, 11, 6).fill({ color: 0xffffff, alpha: 0.35 });
    this.griff.zIndex = 3;
    c.addChild(this.griff);
    this.griff.hitArea = new PIXI.Circle(0, 0, 130);
    this.griffZug = drag(this.griff, {
      back: false, lift: 1.1, sound: null,
      onMove: () => {
        this.griff.x = KORB.x - 130;
        const ruhe = this.griffRuhe();
        this.griff.y = clamp(this.griff.y, ruhe - 20, ruhe + 160);
        this.zeichneKorb();
      },
      onDrop: () => {
        // jedes Ziehen (auch ein Tipp) zieht den Korb ein Stück hoch
        this.zieheSeil();
        this.tween(this.griff, { y: this.griffRuhe() }, 0.35, { ease: 'backOut', onUpdate: () => this.zeichneKorb() });
      },
    });
    this.korbC = c;
    this.zeichneKorb();
    c.visible = false;
    tap(this.korb, () => {
      if (this.r?.phase === 'seil') this.zieheSeil();
      else fx.wobble(this.korb, 0.05);
    }, { sound: 'common/rascheln', squash: false, hitArea: new PIXI.Rectangle(-330, -420, 660, 480) });
  }

  griffRuhe() {
    return 1060;
  }

  zeichneKorb() {
    const g = this.seil;
    g.clear();
    const y = this.korbY;
    const kh = (meta('common/icon_korb').h || 400) * KORB.s * 0.9;
    // Seil vom Ast über eine Rolle zum Korb, und vom Ast hinab zum Griff
    g.moveTo(KORB.x, AST_Y - 4).lineTo(KORB.x, y - kh + 10).stroke({ width: 8, color: 0xa47a4a, cap: 'round' });
    g.moveTo(KORB.x - 130, AST_Y - 4).lineTo(KORB.x - 130, this.griff.y - 10).stroke({ width: 8, color: 0xa47a4a, cap: 'round' });
    g.circle(KORB.x - 65, AST_Y - 18, 30).fill(0x8a6a48).circle(KORB.x - 65, AST_Y - 18, 12).fill(0xd9b36a);
    g.moveTo(KORB.x - 130, AST_Y - 4).quadraticCurveTo(KORB.x - 65, AST_Y - 70, KORB.x, AST_Y - 4)
      .stroke({ width: 8, color: 0xa47a4a, cap: 'round' });
    this.korb.position.set(KORB.x, y);
    this.korbInhalt.position.set(KORB.x, y - kh * 0.55);
    if (!this.griffZug?.isDragging?.()) this.griff.position.set(KORB.x - 130, this.griff.y || this.griffRuhe());
  }

  // ---------------------------------------------------------------- Runde

  neueRunde({ erste = false } = {}) {
    let tier = wähleNeu(NAMEN, this.verlauf, 2);
    // nur zum Testen: ?zootier=affe legt das erste Tier fest
    if (erste) {
      const fest = testWunsch('zootier');
      if (fest && TIERE[fest]) { tier = fest; this.verlauf[this.verlauf.length - 1] = fest; }
    }
    const cfg = TIERE[tier];
    const wunsch = [MAG[tier][0], MAG[tier][1] || cfg.zweit];
    // Kiste: die zwei Wünsche und eins, das das Tier auch gern probiert – gemischt
    const sorten = gemischt([...wunsch, cfg.zweit !== wunsch[1] ? cfg.zweit : pick(['futter_apfel', 'futter_karotte'])]);
    const r = {
      tier, cfg, wunsch, phase: 'kommt', da: false, futter: [], imWagen: [], wagenDa: false, gefüttert: 0,
      pegelZiel: 0, pumpt: false, fertig: false, a: null,
    };
    this.r = r;
    sorten.forEach((id, i) => this.after(erste ? 0 : 0.3 + i * 0.3, () => { if (this.r === r) r.futter.push(this.legeInKiste(id, i)); }));
    // Korb nur bei der Giraffe
    this.korbC.visible = cfg.art === 'korb';
    this.korbY = KORB.unten;
    this.griff.y = this.griffRuhe();
    this.zeichneKorb();
    this.kommt(r, erste);
  }

  async kommt(r, erste) {
    const cfg = r.cfg;
    if (r.tier === 'affe') {
      // Der Affe schwingt sich von rechts oben auf den Ast
      const a = new Actor('affe', { x: 1400, y: AST_Y + 6, scale: cfg.s, parent: this.welt, z: 900 });
      r.a = a;
      this.machTierTippbar(a);
      if (!erste) {
        a.hopTo(900, AST_Y + 6, { hoehe: 120, dauer: 0.9 });
        await this.wait(1.0);
        if (this.r !== r) return;
        await a.hopTo(cfg.x, cfg.y, { hoehe: 110, dauer: 0.9 });
      } else a.position.set(cfg.x, cfg.y);
    } else {
      const a = new Actor(r.tier, { x: erste ? cfg.x : KOMMT_VON, y: cfg.y, scale: cfg.s, parent: this.welt, z: 1450 });
      r.a = a;
      this.machTierTippbar(a);
      if (!erste) {
        sfx('common/hupf', { vol: 0.35 });
        await a.walkTo(cfg.x, cfg.y, { tempo: 280 });
      }
    }
    if (this.r !== r || r.a.destroyed) return;
    r.a.lookAt(-400);
    r.da = true;
    r.phase = cfg.art === 'becken' ? 'laden' : 'laden';
    if (this.aktiv) {
      r.a.sound();
      this.after(0.4, () => this.zeigeWunsch());
      this.after(2.4, () => this.sageHinweis());
    }
  }

  machTierTippbar(a) {
    a.onTap(() => {
      const r = this.r;
      fx.wobble(a, 0.05);
      a.sound();
      if (!r || r.a !== a || !r.da) return;
      // wartet Futter im Wagen und ist der Wagen da: das nächste Futter kommt zu diesem Tier
      if (r.phase === 'füttern' && (r.cfg.art === 'geben' || r.cfg.art === 'werfen')) {
        const f = r.futter.find((x) => x.ort === 'wagen');
        if (f) { this.füttere(f); return; }
      }
      if (r.phase === 'laden') this.zeigeWunsch();
    });
  }

  zeigeWunsch() {
    const r = this.r;
    if (!r?.da || !r.a || r.a.destroyed) return;
    if (r.phase === 'laden') {
      // das nächste Wunsch-Futter, das noch in der Kiste liegt
      const id = r.wunsch.find((w) => r.futter.some((f) => f.id === w && f.ort === 'kiste')) ||
        r.futter.find((f) => f.ort === 'kiste')?.id;
      if (id) this.blase(r.a, 'common/' + id, 2.6);
    } else if (r.phase === 'wasser') this.blase(r.a, 'common/p_tropfen', 2.2);
  }

  // Denkblase: rechts im Bild zur Mitte hin (sonst läge sie über dem Blätter-Pfeil)
  blase(a, bild, sek) {
    if (!a || a.destroyed) return;
    a.bubble(bild, sek, a.x > 300 ? { seite: 'links' } : {});
  }

  // ---------------------------------------------------------------- Futter in der Kiste

  legeInKiste(id, i) {
    const bild = 'common/' + id;
    const m = meta(bild);
    const s = FUTTER_H / Math.max(1, m.h || 400);
    const heim = { x: KISTE_PLÄTZE[i % 3], y: KISTE_Y + (i === 1 ? -14 : 0) };
    const sp = spr(bild, { anchor: 0.5, x: heim.x, y: heim.y, parent: this.kistenInhalt });
    sp.rotation = rand(-0.2, 0.2);
    sp.scale.set(s * 0.3);
    sp.alpha = 0;
    sp.zIndex = i;
    this.tween(sp, { alpha: 1 }, 0.3, { ease: 'sineInOut' });
    this.tween(sp, { scale: s }, 0.5, { ease: 'backOut' });
    note('glocke', [76, 79, 84][i % 3], { vol: 0.18 });
    const f = { id, sp, s, heim, ort: 'kiste', marke: 0, zug: null };
    // Tippfläche gut 230 × 230; überlappen sich zwei, gewinnt das, dessen Mitte dem Finger am nächsten ist
    const w = 118 / s;
    const rechteck = new PIXI.Rectangle(-w, -w, 2 * w, 2 * w);
    sp.hitArea = {
      x: -w, y: -w, width: 2 * w, height: 2 * w,
      contains: (lx, ly) => {
        if (!rechteck.contains(lx, ly)) return false;
        // liegen mehrere nebeneinander (Kiste, Wagen), gewinnt das nächste
        const behälter = sp.parent;
        if (behälter !== this.kistenInhalt && behälter !== this.wagenInhalt) return true;
        const px = sp.x + lx * sp.scale.x;
        const py = sp.y + ly * sp.scale.y;
        const eigen = Math.hypot(px - sp.x, py - sp.y);
        for (const o of this.r?.futter || []) {
          if (o !== f && !o.sp.destroyed && o.sp.parent === behälter && Math.hypot(px - o.sp.x, py - o.sp.y) < eigen) return false;
        }
        return true;
      },
    };
    sp.on('pointerdown', () => {
      if (sp.parent !== this.welt && !sp.destroyed) umhängen(sp, this.welt);
      sp.zIndex = 1700;
    });
    f.zug = drag(sp, {
      back: false,
      lift: 1.12,
      targets: () => this.zielFür(f),
      onDrop: (ziel, ctx) => this.futterLos(f, ziel, ctx),
    });
    return f;
  }

  // Wohin darf das Futter gerade?
  zielFür(f) {
    const r = this.r;
    if (!r) return [];
    if (f.ort === 'kiste') {
      if (r.phase !== 'laden') return [];
      return [{ id: 'wagen', x: this.wagen.x + this.ladung.x, y: this.wagen.y + this.ladung.y, radius: 300 }];
    }
    if (f.ort === 'wagen' && r.phase === 'füttern') {
      if (r.cfg.art === 'korb') return [{ id: 'korb', x: KORB.x, y: this.korbY - 100, radius: 300 }];
      if (r.cfg.art === 'becken') return [{ id: 'trog', x: this.wasserPunkt.x, y: this.wasserPunkt.y - 30, radius: 330 }];
      const m = r.a.point('mouth');
      return [{ id: 'tier', x: m.x, y: m.y, radius: r.cfg.art === 'werfen' ? 420 : 340 }];
    }
    return [];
  }

  futterLos(f, ziel, ctx) {
    const r = this.r;
    const sp = f.sp;
    if (sp.destroyed) return;
    if (f.ort === 'kiste') {
      if (r?.phase === 'laden' && (ziel || kurz(ctx))) { this.inDenWagen(f); return; }
      this.zurück(f);
      return;
    }
    if (f.ort === 'wagen') {
      if (r?.phase === 'füttern' && (ziel || kurz(ctx))) { this.füttere(f); return; }
      this.zurück(f);
    }
  }

  // zurück an seinen Platz (Kiste oder Wagen)
  zurück(f) {
    const sp = f.sp;
    const m = ++f.marke;
    const behälter = f.ort === 'wagen' ? this.wagenInhalt : this.kistenInhalt;
    const g = behälter.toGlobal(new PIXI.Point(f.heim.x, f.heim.y));
    const p = this.welt.toLocal(g);
    this.tween(sp, { x: p.x, y: p.y }, gleitDauer(p.x - sp.x, p.y - sp.y, 0.35), { ease: 'sineInOut' }).then((ok) => {
      if (!ok || f.marke !== m || sp.destroyed || f.zug?.isDragging?.()) return;
      umhängen(sp, behälter);
      sp.position.set(f.heim.x, f.heim.y);
      sp.zIndex = f.ort === 'wagen' ? 1 : 0;
    });
  }

  async inDenWagen(f) {
    const r = this.r;
    const n = r.imWagen.length;
    if (n >= 2) { this.zurück(f); return; }
    r.imWagen.push(f);
    f.ort = 'wagen';
    f.marke++;
    const sp = f.sp;
    sp.eventMode = 'none';
    killTweensOf(sp);
    const [lx, ly] = LADE_PLÄTZE[n];
    f.heim = { x: this.ladung.x + lx, y: this.ladung.y + ly };
    const g = this.wagenInhalt.toGlobal(new PIXI.Point(f.heim.x, f.heim.y));
    const p = this.welt.toLocal(g);
    sp.zIndex = 1700;
    await bogen(this, sp, p.x, p.y, { dauer: 0.5, höhe: 110, dreh: -sp.rotation + rand(-0.15, 0.15) });
    if (sp.destroyed || this.r !== r) return;
    umhängen(sp, this.wagenInhalt);
    sp.position.set(f.heim.x, f.heim.y);
    sp.zIndex = 1;
    sp.eventMode = 'static';
    sfx('common/landen', { vol: 0.4 });
    fx.wobble(this.wagen, 0.03);
    if (r.imWagen.length === 1) {
      this.after(0.4, () => this.zeigeWunsch());
      // ist das Wunsch-Futter dabei, nickt das Tier
      if (r.wunsch.includes(f.id)) r.a?.nod();
    } else if (r.imWagen.length >= 2 && r.phase === 'laden') {
      r.a?.nod();
      r.phase = 'fahren';
      // was in der Kiste übrig ist, hüpft heraus (Platz für die nächste Runde)
      for (const o of r.futter) {
        if (o.ort !== 'kiste') continue;
        o.ort = 'weg';
        o.zug?.off();
        o.sp.eventMode = 'none';
        this.tween(o.sp, { alpha: 0 }, 0.5, { ease: 'sineInOut', delay: 0.4 }).then(() => { if (!o.sp.destroyed) o.sp.destroy(); });
      }
      this.after(0.5, () => { if (this.aktiv && r.phase === 'fahren') fx.pulse(this.wagen); });
      const passt = () => this.aktiv && this.r === r && r.phase === 'fahren';
      this.after(0.9, () => { if (passt()) voice('zoo_wagen', { nurWenn: passt }); });
    }
  }

  // ---------------------------------------------------------------- Wagen fährt

  async fahreWagen() {
    const r = this.r;
    if (r.phase !== 'fahren') return;
    r.phase = 'rollt';
    const c = this.wagen;
    killTweensOf(c);
    sfx('common/rutsch', { vol: 0.35 });
    const p = { k: 0 };
    const x0 = c.x;
    await this.tween(p, { k: 1 }, gleitDauer(WAGEN_ZIEL.x - x0, 0, 0.9), {
      ease: 'sineInOut',
      onUpdate: () => {
        c.x = x0 + (WAGEN_ZIEL.x - x0) * p.k;
        c.y = WAGEN_ZIEL.y - Math.abs(Math.sin(p.k * Math.PI * 5)) * 6;
      },
    });
    if (this.r !== r) return;
    c.y = WAGEN_ZIEL.y;
    r.wagenDa = true;
    sfx('common/klack', { vol: 0.4 });
    r.a?.lookAt(c.x);
    // Pinguin: erst Wasser ins Becken, dann der Fisch
    if (r.cfg.art === 'becken') this.zumWasser();
    else this.zumFüttern();
  }

  zumFüttern() {
    const r = this.r;
    r.phase = 'füttern';
    const f = r.futter.find((x) => x.ort === 'wagen');
    if (f && this.aktiv) this.after(0.3, () => fx.pulse(f.sp));
    if (r.cfg.art === 'werfen' && this.aktiv) this.after(0.6, () => this.blase(r.a, 'common/' + (f?.id || 'futter_banane'), 2));
  }

  // ---------------------------------------------------------------- Füttern

  async füttere(f) {
    const r = this.r;
    if (!r || r.phase !== 'füttern' || f.ort !== 'wagen') return;
    // isst das Tier noch: das nächste Futter merken und gleich danach geben (kein Tipp verpufft)
    if (r.isst) { r.danach = f; return; }
    f.ort = 'unterwegs';
    f.marke++;
    f.zug?.off();
    f.zug = null;
    const sp = f.sp;
    sp.eventMode = 'none';
    killTweensOf(sp);
    if (sp.parent !== this.welt) umhängen(sp, this.welt);
    sp.zIndex = 1700;
    const art = r.cfg.art;
    r.isst = true;
    let ok = true;
    if (art === 'korb') {
      // in den Korb
      const n = r.gefüttert;
      const ziel = { x: KORB.x + (n ? 40 : -40), y: this.korbY - 120 };
      await bogen(this, sp, ziel.x, ziel.y, { dauer: 0.5, höhe: 120 });
      if (sp.destroyed || this.r !== r) return;
      umhängen(sp, this.korbInhalt);
      sp.zIndex = n;
      sfx('common/rascheln', { vol: 0.4 });
      fx.wobble(this.korb, 0.05);
    } else if (art === 'werfen') {
      // hoch zum Affen – er fängt es
      const m = r.a.point('mouth');
      sfx('common/wusch', { vol: 0.3 });
      await bogen(this, sp, m.x, m.y + 20, { dauer: 0.85, höhe: 260, dreh: 3.5 });
      if (sp.destroyed || this.r !== r) return;
      r.a.pose('happy');
      sfx('common/klick', { vol: 0.4 });
      await this.wait(0.35);
      ok = await lassEssen(this, r.a, sp, { flug: false, bissen: 2 });
    } else if (art === 'becken') {
      ok = await this.fischInsBecken(sp);
    } else {
      ok = await lassEssen(this, r.a, sp, { bissen: r.tier === 'elefant' ? 3 : 2 });
    }
    r.isst = false;
    if (this.r !== r) return;
    f.ort = 'gegessen';
    r.gefüttert++;
    const rest = r.futter.find((x) => x.ort === 'wagen');
    if (rest) {
      if (art !== 'korb' && ok) r.a.nod();
      const gemerkt = r.danach;
      r.danach = null;
      if (gemerkt === rest && !rest.sp.destroyed && !rest.zug?.isDragging?.()) { this.after(0.3, () => { if (this.r === r) this.füttere(rest); }); return; }
      if (this.aktiv) this.after(0.4, () => fx.pulse(rest.sp));
      return;
    }
    // alles gefüttert
    if (art === 'korb') { this.zumSeil(); return; }
    if (art === 'becken') { this.fertig(); return; }
    if (ok && !r.a.destroyed) await r.a.cheer({ parent: this.vorn });
    if (this.r !== r) return;
    this.zumWasser();
  }

  // ---------------------------------------------------------------- Giraffe: Korb am Seil

  zumSeil() {
    const r = this.r;
    r.phase = 'seil';
    r.züge = 0;
    if (this.aktiv) this.after(0.3, () => fx.pulse(this.griff));
    const passt = () => this.aktiv && this.r === r && r.phase === 'seil';
    this.after(0.8, () => { if (passt()) voice('zoo_korb', { nurWenn: passt }); });
  }

  async zieheSeil() {
    const r = this.r;
    if (!r || r.phase !== 'seil' || r.zieht) return;
    r.zieht = true;
    r.züge++;
    sfx('common/kran', { vol: 0.3 });
    const ziel = KORB.unten + (KORB.oben - KORB.unten) * Math.min(1, r.züge / 3);
    const p = { y: this.korbY };
    await this.tween(p, { y: ziel }, 0.55, { ease: 'sineInOut', onUpdate: () => { this.korbY = p.y; this.zeichneKorb(); } });
    r.zieht = false;
    if (this.r !== r) return;
    if (r.züge < 3) { if (this.aktiv) fx.pulse(this.griff); return; }
    r.phase = 'frisst';
    // die Giraffe frisst aus dem Korb
    const a = r.a;
    a.lookAt(KORB.x);
    a.pose('eat');
    const stücke = [...this.korbInhalt.children];
    for (const s of stücke) {
      sfx('common/mampf', { vol: 0.7 });
      await this.tween(s, { scale: Math.abs(s.scale.y) * 0.6, alpha: 0.6 }, 0.35, { ease: 'sineInOut' });
      await this.tween(s, { scale: 0.05, alpha: 0 }, 0.3, { ease: 'quadIn' });
      if (!s.destroyed) s.destroy();
      await this.wait(0.15);
    }
    if (this.r !== r || a.destroyed) return;
    a.pose('idle');
    await a.cheer({ parent: this.vorn });
    if (this.r !== r) return;
    // Korb wieder hinunter
    const q = { y: this.korbY };
    this.tween(q, { y: KORB.unten }, 0.9, { ease: 'sineInOut', onUpdate: () => { this.korbY = q.y; this.zeichneKorb(); } });
    this.zumWasser();
  }

  // ---------------------------------------------------------------- Pinguin: Fisch ins Becken

  async fischInsBecken(sp) {
    const r = this.r;
    const o = this.wasserPunkt;
    const zx = o.x + rand(-60, 60);
    // etwas kleiner und tiefer: der Fisch schwimmt im Wasser, statt auf dem Rand zu liegen
    await bogen(this, sp, zx, o.y + 4, { dauer: 0.55, höhe: 140, skala: Math.abs(sp.scale.y) * 0.72 });
    if (sp.destroyed || this.r !== r) return false;
    sfx('common/platsch', { vol: 0.5 });
    this.burst('tropfen', zx, o.y - 10, { count: 4 });
    sp.zIndex = 1502;
    // schwimmt ein bisschen hin und her
    this.tween(sp, { x: zx + 50, y: o.y + 12, rotation: 0.2 }, 0.8, { ease: 'sineInOut' });
    await this.wait(0.5);
    // der Pinguin springt hinterher
    const a = r.a;
    if (a.destroyed) return false;
    const maske = new PIXI.Graphics().rect(-2000, -2000, 4000, 2000 + o.y + 10 - a.y).fill(0xffffff);
    await a.hopTo(o.x - 30, a.y, { hoehe: 120, dauer: 0.6 });
    if (a.destroyed || this.r !== r) { maske.destroy(); return false; }
    // eintauchen (nur der Teil über dem Wasser bleibt sichtbar)
    a.zIndex = 1500;   // hinter dem Trog-Rand, vor dem Wasser? Der Rand verdeckt den Bauch
    maske.position.set(a.x, a.y);
    this.welt.addChild(maske);
    maske.clear().rect(-600, -2000, 1200, 2000 - (a.y - (o.y + 6))).fill(0xffffff);
    maske.position.set(a.x, a.y);
    a.mask = maske;
    sfx('common/platsch', { vol: 0.6 });
    this.burst('tropfen', o.x - 30, o.y - 20, { count: 6 });
    await this.tween(a, { y: a.y + 160 }, 0.4, { ease: 'quadIn' });
    if (!sp.destroyed) sp.destroy();
    await this.wait(0.5);
    sfx('common/mampf', { vol: 0.6 });
    await this.tween(a, { y: a.y - 160 }, 0.4, { ease: 'quadOut' });
    if (a.destroyed) { if (!maske.destroyed) maske.destroy(); return false; }
    a.mask = null;
    if (!maske.destroyed) maske.destroy();
    this.burst('tropfen', o.x - 30, o.y - 30, { count: 4 });
    await a.hopTo(r.cfg.x, r.cfg.y, { hoehe: 110, dauer: 0.6 });
    a.zIndex = 1450;
    if (a.destroyed) return false;
    await a.cheer({ parent: this.vorn });
    return true;
  }

  // ---------------------------------------------------------------- Wasser pumpen

  zumWasser() {
    const r = this.r;
    r.phase = 'wasser';
    r.pumpTipps = 0;
    if (this.aktiv) {
      this.after(0.3, () => fx.pulse(this.pumpe));
      this.after(0.6, () => this.zeigeWunsch());
    }
    const passt = () => this.aktiv && this.r === r && r.phase === 'wasser';
    this.after(1.0, () => { if (passt()) voice('zoo_pumpe', { nurWenn: passt }); });
  }

  async pumpen() {
    const r = this.r;
    fx.wobble(this.pumpe, 0.05);
    if (!r || r.phase !== 'wasser' || r.pumpt) {
      tonEinmal(this, 'common/quietsch', 0.8, { vol: 0.25 });
      return;
    }
    r.pumpt = true;
    r.pumpTipps++;
    sfx('common/quietsch', { vol: 0.3 });
    // Strahl: weich ein, Wasser steigt, weich aus
    const p = { a: 0 };
    const zeichne = () => {
      const g = this.strahl;
      g.clear();
      if (p.a <= 0.01) return;
      const unten = this.wasserPunkt.y + 10 - this.pegel * 20;
      g.roundRect(this.auslauf.x - 10, this.auslauf.y, 20, unten - this.auslauf.y, 10).fill({ color: 0x8fd0f0, alpha: 0.85 * p.a });
      g.roundRect(this.auslauf.x - 4, this.auslauf.y + 6, 6, unten - this.auslauf.y - 12, 3).fill({ color: 0xffffff, alpha: 0.45 * p.a });
    };
    this.tween(p, { a: 1 }, 0.25, { ease: 'sineInOut', onUpdate: zeichne });
    sfx('common/giessen', { vol: 0.4 });
    const ziel = Math.min(1, r.pumpTipps / 3);
    const q = { l: this.pegel };
    await this.tween(q, { l: ziel }, 0.8, { ease: 'sineInOut', onUpdate: () => { this.pegel = q.l; this.zeichneWasser(); zeichne(); } });
    await this.tween(p, { a: 0 }, 0.3, { ease: 'sineInOut', onUpdate: zeichne });
    this.burst('tropfen', this.auslauf.x + 30, this.wasserPunkt.y - 10, { count: 1 });
    r.pumpt = false;
    if (this.r !== r || r.phase !== 'wasser') return;
    if (r.pumpTipps < 3) { if (this.aktiv) fx.pulse(this.pumpe); return; }
    r.phase = 'trinkt';
    if (r.cfg.art === 'becken') {
      // Pinguin: Becken voll, jetzt kommt der Fisch hinein
      sfx('common/funkeln', { vol: 0.35 });
      this.burst('funkeln', this.wasserPunkt.x, this.wasserPunkt.y - 30, { count: 3 });
      this.zumFüttern();
      return;
    }
    await this.trinkt();
  }

  async trinkt() {
    const r = this.r;
    const a = r.a;
    const o = this.wasserPunkt;
    if (r.tier === 'affe') {
      // der Affe springt vom Ast herunter an den Trog
      const t = r.cfg.trinkt;
      await a.hopTo(t.x, t.y, { hoehe: 140, dauer: 1.0 });
      if (a.destroyed || this.r !== r) return;
      this.tween(a.scale, { x: t.s, y: t.s }, 0.4, { ease: 'sineInOut' });
      a.zIndex = 1450;
    }
    if (a.destroyed || this.r !== r) return;
    a.lookAt(o.x);
    a.pose('eat');
    for (let k = 0; k < 3; k++) {
      sfx('common/blubber', { vol: 0.35 });
      this.burst('blasen', o.x + rand(-60, 60), o.y - 6, { count: 1 });
      await this.wait(0.45);
    }
    const q = { l: this.pegel };
    this.tween(q, { l: 0.35 }, 1.0, { ease: 'sineInOut', onUpdate: () => { this.pegel = q.l; this.zeichneWasser(); } });
    if (this.r !== r || a.destroyed) return;
    a.pose('idle');
    if (r.tier === 'elefant') {
      // Fontäne aus dem Rüssel (ruhige Tropfen)
      await this.wait(0.3);
      const m = a.point('mouth');
      sfx('common/spritz', { vol: 0.45 });
      this.burst('tropfen', m.x - 20, m.y - 140, { count: 8 });
      this.after(0.5, () => this.burst('tropfen', m.x - 60, m.y - 180, { count: 6 }));
    } else if (r.tier === 'baer') {
      await this.wait(0.2);
      sfx('common/platsch', { vol: 0.5 });
      this.burst('tropfen', o.x, o.y - 20, { count: 6 });
    }
    await this.wait(0.6);
    if (this.r !== r) return;
    this.fertig();
  }

  // ---------------------------------------------------------------- Ende der Runde

  async fertig() {
    const r = this.r;
    if (r.fertig) return;
    r.fertig = true;
    r.phase = 'fertig';
    const a = r.a;
    if (!a.destroyed) a.cheer({ parent: this.vorn });
    await this.wait(0.7);
    await belohne(this, 'zoo_futterwagen', 0, 760);
    await this.wait(0.8);
    if (this.r !== r) return;
    // Wagen rollt heim, Wasser versickert, das Tier geht
    const c = this.wagen;
    const x0 = c.x;
    const p = { k: 0 };
    this.tween(p, { k: 1 }, gleitDauer(WAGEN_HEIM.x - x0, 0, 1.0), {
      ease: 'sineInOut',
      onUpdate: () => { c.x = x0 + (WAGEN_HEIM.x - x0) * p.k; c.y = WAGEN_HEIM.y - Math.abs(Math.sin(p.k * Math.PI * 5)) * 6; },
    });
    const q = { l: this.pegel };
    this.tween(q, { l: 0 }, 1.6, { ease: 'sineInOut', onUpdate: () => { this.pegel = q.l; this.zeichneWasser(); } });
    if (!a.destroyed) {
      this.blase(a, 'common/p_herz', 1.2);
      await this.wait(1.3);
      if (a.destroyed) return;
      if (r.tier === 'affe') await a.hopTo(1500, a.y - 200, { hoehe: 160, dauer: 1.2 });
      else await a.walkTo(KOMMT_VON, a.y, { tempo: 280 });
      if (!a.destroyed) a.destroy({ children: true });
    }
    for (const f of r.futter) if (!f.sp.destroyed && f.ort !== 'kiste') f.sp.destroy();
    if (this.korbInhalt.children.length) for (const s of [...this.korbInhalt.children]) s.destroy();
    await this.wait(0.4);
    if (this.r !== r) return;
    c.position.set(WAGEN_HEIM.x, WAGEN_HEIM.y);
    this.neueRunde();
  }

  // ---------------------------------------------------------------- Ablauf, Hand

  update(dt) {
    this.uhr += dt;
  }

  hinweise() {
    const r = this.r;
    if (!r?.da) return [];
    if (r.phase === 'laden') {
      const f = r.futter.find((x) => x.ort === 'kiste' && r.wunsch.includes(x.id) && !x.sp.destroyed) ||
        r.futter.find((x) => x.ort === 'kiste' && !x.sp.destroyed);
      if (f) return [{ von: f.sp, nach: { x: this.wagen.x + this.ladung.x, y: this.wagen.y + this.ladung.y } }];
    }
    if (r.phase === 'fahren') return [{ von: this.wagen, nach: { x: WAGEN_ZIEL.x, y: WAGEN_ZIEL.y - 120 } }];
    if (r.phase === 'füttern') {
      const f = r.futter.find((x) => x.ort === 'wagen' && !x.sp.destroyed);
      if (f) {
        if (r.cfg.art === 'korb') return [{ von: f.sp, nach: { x: KORB.x, y: this.korbY - 100 } }];
        if (r.cfg.art === 'becken') return [{ von: f.sp, nach: { x: this.wasserPunkt.x, y: this.wasserPunkt.y - 20 } }];
        if (r.cfg.art === 'werfen') return [f.sp];
        return [{ von: f.sp, nach: r.a.point('mouth') }];
      }
    }
    if (r.phase === 'seil') return [{ von: this.griff, nach: { x: this.griff.x, y: this.griff.y + 140 } }];
    if (r.phase === 'wasser') return [this.pumpe];
    // dazwischen (frisst, trinkt, rollt …): auf das Tier – sonst zeigte die Hand auf den Blätter-Pfeil
    return r.a && !r.a.destroyed ? [r.a] : [];
  }
}
