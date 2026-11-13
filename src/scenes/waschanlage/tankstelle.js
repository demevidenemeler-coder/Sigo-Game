// Ort „Waschanlage", Seite 2: Tankstelle mit kleinem Café.
//
// Ein Tier bringt sein Fahrzeug (es fährt oben auf dem Dach mit), hüpft hinunter und wartet vor dem Café.
// Zwei Abläufe, die nebeneinander gehen (die Zeige-Hand führt erst durchs Tanken, dann ins Café):
//   Tanken   1. Tankdeckel antippen – er klappt auf
//            2. Zapfhahn von der Säule zum Tank ziehen (oder einfach antippen: er fliegt hin)
//            3. tanken: die Zapfsäule halten oder antippen – im runden Fenster wächst die Füllung
//            4. voll („Ding"): Zapfhahn zurück an die Säule (ziehen oder antippen)
//            5. Tankdeckel zu – das Fahrzeug hupt
//   Café     1. Becher von der Fensterbank unter den Hahn der Kakao-Maschine (ziehen oder antippen)
//            2. eine Sorte antippen (Kakao, Milch, Erdbeermilch, Apfelsaft) – das Tier wünscht sich eine
//               (Denkblase), jede ist richtig; der Becher füllt sich
//            3. Sahne drauf: den Becher dreimal antippen (zwei Sahnetupfer, dann ein Belag)
//            4. Becher zum Tier (ziehen oder antippen) – es trinkt; manchmal bleibt ein Milchbart
//   Foto     Ist beides fertig, kommt die Kamera: antippen → ein Foto des Tiers fliegt an die Fotowand.
//            Die Fotowand wächst über die Besuche (gespeichert unter waschanlage.fotos).
//   Abschied Das Tier hüpft aufs Dach, das Fahrzeug hupt, Sticker, es rollt hinaus; das nächste kommt.
// Was sich je Runde ändert: Fahrzeug (nie zweimal dasselbe), Tier (keines der letzten 3), drei der vier Sorten
// und der Wunsch, der Belag auf der Sahne, Überraschungen (Milchbart in der Farbe des Getränks; die Zapfsäule
// hat Schluckauf).
// Nichts kann schiefgehen: Zapfhahn oder Becher ohne Ziel losgelassen gleiten zurück; wer den Zapfhahn zum noch
// geschlossenen Tank bringt, dem klappt der Deckel von selbst auf; eine Sorte vor dem Becher stellt ihn von selbst hin.

import { spr, tex, meta, sfx, voice, tap, drag, hold, Actor, fx, store, rand, pick, shuffle, clamp, lerp, animal, PIXI }
  from '../../engine/index.js';
import { Seite } from '../../gemeinsam/seiten.js';
import { belohne, gesammelt, sticker } from '../../gemeinsam/sticker.js';
import { TYPEN, plan, baueFahrzeug, flaechenPunkte, oberkante } from './fahrzeuge.js';
import { KUNDEN, neuOhne, dachPunkt } from './werkstatt.js';
import { Schleife } from './schleife.js';
import { Wolken, Vogel } from './deko.js';

const { Container, Graphics, Circle, Rectangle, Sprite } = PIXI;

const START = 2000;                        // so weit links beginnt ein Fahrzeug (und so weit rechts verschwindet es)
const FZ = { x: -130, y: 1390 };           // dort steht das Fahrzeug beim Tanken
const SAEULE = { x: -840, y: 1335, h: 560 };
const AUTOMAT = { x: 730, y: 1335, h: 600 };
const STAND = { x: 430, y: 1335 };         // dort wartet das Tier vor dem Café
const BECHER_HEIM = { x: 440, y: 870 };    // Becher auf der Fensterbank des Cafés (Fuß)
const BECHER_SKALA = 0.5;
const SORTEN_X = [510, 715, 920];
const SORTEN_Y = 1430;
const KAMERA = { x: 235, y: 570 };
const HAHN_SKALA = 0.75;
const WAND = { x: -330, y: 585, spalten: 5, zeilen: 2, dx: 165, dy: 148 };
const FOTO_SPEICHER = 'waschanlage.fotos';
const STICKER_HIER = ['waschanlage_zapfsaeule', 'waschanlage_kakao'];

const SORTEN = {
  kakao: { bild: 'waschanlage/kakao_becher', farbe: 0x8a5a3c },
  milch: { bild: 'common/futter_milch', farbe: 0xfbf7ef },
  erdbeer: { bild: 'common/futter_erdbeere', farbe: 0xf5a9bf },
  apfel: { bild: 'common/futter_apfel', farbe: 0xf1c75a },
};
const BELAEGE = ['common/p_konfetti', 'common/p_stern', 'common/p_herz', 'common/futter_erdbeere'];

// weicher runder Fleck (Schatten) aus der Rauch-Textur der Effekte
function weich(parent, { x, y, w, h, alpha = 0.28, z }) {
  const s = new Sprite(fx.texture('rauch'));
  s.anchor.set(0.5);
  s.tint = 0x34405a;
  s.alpha = alpha;
  s.width = w;
  s.height = h;
  s.position.set(x, y);
  s.zIndex = z;
  s.eventMode = 'none';
  parent.addChild(s);
  return s;
}

// Punkt eines Sprites (pts aus pack.json, in Einheiten des Bildes) → Koordinaten von ziel
function bildPunkt(sprite, id, name, ziel) {
  const m = meta(id);
  const p = m.pts?.[name] || [m.w / 2, m.h / 2];
  const lokal = { x: (p[0] - m.ax * m.w), y: (p[1] - m.ay * m.h) };
  return ziel.toLocal(sprite.toGlobal(lokal));
}

export class Tankstelle extends Seite {
  static hg = 'waschanlage/hg_tankstelle';

  aufbau() {
    this.r = null;               // die Runde (das Fahrzeug, das gerade da ist)
    this.letzterTyp = null;
    this.letzteKunden = [];
    this.letzterBelag = null;
    this.runden = 0;
    this.tore = new Map();
    this.tankt = false;          // ein Finger hält die Zapfsäule
    this.anzeige = 0;            // Füllung im Fenster der Säule (weich)
    this.anzeigeZiel = 0;
    this.fahrTon = null;
    this.tankTon = new Schleife('common/giessen', { vol: 0.35 });

    this.wolken = new Wolken(this.hinten, { von: -350, bis: 1320 });
    this.vogel = new Vogel(this, { stangen: [[-380, -120, 372], [60, 300, 372]], parent: this.welt, z: 4 });
    this.baueWand();
    this.baueSaeule();
    this.baueHahn();
    this.baueAutomat();
    this.baueBecher();
    this.baueSorten();
    this.baueKamera();

    // ab und zu zeigt das Tier seinen Wunsch, wenn gerade niemand spielt
    this.every(12, () => {
      const r = this.r;
      if (!this.aktiv || !r || r.zustand !== 'da' || !r.kundeDa || this.szene.idle < 5) return;
      if (r.trink.phase === 'leer' || r.trink.phase === 'steht') r.kunde.actor.bubble(SORTEN[r.trink.wunsch].bild, 2.4);
    });
  }

  betreten() {
    if (this.besuche === 1) this.after(0.5, () => voice('waschanlage_tankstelle_hallo'));
    if (!this.r) this.after(0.4, () => this.kommen());
  }

  verlassen() {
    this.tankt = false;
    this.tankTon.aus(0.3);
    this.fahrTon?.aus(0.3);
  }

  aufraeumen() {
    this.tankTon.ende();
    this.fahrTon?.ende();
  }

  // ---------------------------------------------------------------- Aufbau

  // Fotowand: Korkbrett an der Café-Wand, ein Foto je fertigem Besuch (wächst über die Besuche)
  baueWand() {
    const w = WAND;
    const breite = w.spalten * w.dx + 40;
    const hoehe = w.zeilen * w.dy + 40;
    const brett = new Graphics()
      .roundRect(-breite / 2 + 6, -hoehe / 2 + 10, breite, hoehe, 28).fill({ color: 0x5a4630, alpha: 0.18 })
      .roundRect(-breite / 2, -hoehe / 2, breite, hoehe, 28).fill(0xb57a42).stroke({ width: 8, color: 0x8f5e30 })
      .roundRect(-breite / 2 + 16, -hoehe / 2 + 16, breite - 32, hoehe - 32, 18).fill(0xcf9a5c);
    // leere Plätze: zarte Rahmen, damit man sieht, dass hier noch Fotos hinkommen
    for (let i = 0; i < w.spalten * w.zeilen; i++) {
      const p = this.fotoPlatz(i, true);
      brett.roundRect(p.x - 62, p.y - 66, 124, 132, 12).fill({ color: 0xffffff, alpha: 0.16 });
    }
    brett.position.set(w.x, w.y);
    brett.zIndex = 3;
    brett.eventMode = 'none';
    this.welt.addChild(brett);
    this.fotos = new Array(w.spalten * w.zeilen).fill(null);
    const daten = store.get(FOTO_SPEICHER, null);
    this.fotoListe = Array.isArray(daten?.liste) ? daten.liste.slice(0, this.fotos.length) : [];
    this.fotoAnzahl = Number.isFinite(daten?.anzahl) ? daten.anzahl : this.fotoListe.length;
    this.fotoListe.forEach((f, i) => {
      if (f && TYPEN.includes(f.typ) && KUNDEN.some((k) => k.id === f.tier)) this.fotoDran(i, f, false);
    });
  }

  // Mitte des Fotoplatzes i (relativ = relativ zur Brettmitte)
  fotoPlatz(i, relativ = false) {
    const w = WAND;
    const sp = i % w.spalten;
    const ze = Math.floor(i / w.spalten);
    const x = (sp - (w.spalten - 1) / 2) * w.dx;
    const y = (ze - (w.zeilen - 1) / 2) * w.dy;
    return relativ ? { x, y } : { x: w.x + x, y: w.y + y };
  }

  // ein Foto bauen: weißer Rahmen, Himmel, das Tier, unten links das Fahrzeug-Symbol
  baueFoto(f) {
    const c = new Container({ label: 'foto' });
    const g = new Graphics()
      .roundRect(-64, -68, 132, 142, 14).fill({ color: 0x5a4630, alpha: 0.2 })
      .roundRect(-68, -72, 136, 144, 14).fill(0xfffaf0).stroke({ width: 3, color: 0xe8dcc4 })
      .roundRect(-58, -62, 116, 104, 9).fill(0xbfe3f7)
      .roundRect(-58, 18, 116, 24, 9).fill(0x9fd17a);
    g.eventMode = 'none';
    c.addChild(g);
    const tier = spr(`tiere/${f.tier}_happy`, { anchor: [0.5, 1], x: 6, y: 40, parent: c });
    tier.scale.set(88 / Math.max(tier.texture.height, 1));
    tier.eventMode = 'none';
    const fz = spr(`waschanlage/icon_${f.typ}_wahl`, { anchor: 0.5, x: -38, y: 50, parent: c });
    fz.scale.set(52 / Math.max(fz.texture.width, fz.texture.height, 1));
    fz.eventMode = 'none';
    const nadel = new Graphics().circle(0, -66, 9).fill(0xf26b6b).circle(-3, -69, 3).fill({ color: 0xffffff, alpha: 0.6 });
    nadel.eventMode = 'none';
    c.addChild(nadel);
    c.tier = f.tier;
    return c;
  }

  fotoDran(i, f, neu) {
    const alt = this.fotos[i];
    if (alt) {
      this.fotos[i] = null;
      this.tween(alt, { alpha: 0 }, 0.4, { ease: 'sineInOut' }).then(() => { if (!alt.destroyed) alt.destroy({ children: true }); });
    }
    const c = this.baueFoto(f);
    const p = this.fotoPlatz(i);
    c.position.set(p.x, p.y);
    c.rotation = rand(-0.08, 0.08);
    c.zIndex = 4;
    this.welt.addChild(c);
    this.fotos[i] = c;
    tap(c, () => {
      fx.wobble(c, 0.1);
      if (this.tor('fotoTier', 0.6)) animal(c.tier);
    }, { sound: null, squash: false, hitArea: new Circle(0, 0, 102) });
    if (neu) {
      c.alpha = 0;
      this.tween(c, { alpha: 1 }, 0.3, { ease: 'sineInOut' });
    }
    return c;
  }

  baueSaeule() {
    const s = SAEULE;
    weich(this.welt, { x: s.x + 10, y: s.y - 6, w: 400, h: 60, z: 18 });
    this.saeule = new Container({ label: 'zapfsaeule' });
    this.saeule.position.set(s.x, s.y);
    this.saeule.zIndex = 20;
    this.welt.addChild(this.saeule);
    const k = spr('waschanlage/zapfsaeule', { parent: this.saeule });
    k.scale.set(s.h / meta('waschanlage/zapfsaeule').h);
    k.eventMode = 'none';
    this.saeuleBild = k;
    // Anzeige im runden Fenster: eine Füllung, die von der Mitte aus wächst
    const f = bildPunkt(k, 'waschanlage/zapfsaeule', 'fenster', this.saeule);
    this.fenster = new Graphics()
      .circle(0, 0, 70).fill(0x8fd36a)
      .circle(-20, -22, 20).fill({ color: 0xffffff, alpha: 0.35 });
    this.fenster.position.set(f.x, f.y);
    this.fenster.scale.set(0.01);
    this.fenster.alpha = 0;
    this.fenster.eventMode = 'none';
    this.saeule.addChild(this.fenster);
    this.fensterWelt = { x: s.x + f.x, y: s.y + f.y };
    this.haken = bildPunkt(k, 'waschanlage/zapfsaeule', 'haken', this.welt);
    this.schlauchStart = bildPunkt(k, 'waschanlage/zapfsaeule', 'schlauch', this.welt);
    const m = meta('waschanlage/zapfsaeule');
    const sk = k.scale.x;
    this.saeuleHalten = hold(this.saeule, {
      hitArea: new Rectangle(-m.ax * m.w * sk - 10, -s.h - 10, m.w * sk * 0.86, s.h - 40),
      onStart: () => this.saeuleAn(),
      onEnd: () => this.saeuleAus(),
    });
  }

  baueHahn() {
    const c = new Container({ label: 'zapfhahn' });
    const m = meta('waschanlage/zapfhahn');
    const sp = m.pts.spitze;
    const s = spr('waschanlage/zapfhahn', { parent: c });
    // die Spitze der Tülle liegt im Ursprung: so sitzt sie genau im Tank
    s.position.set(-(sp[0] - m.ax * m.w), -(sp[1] - m.ay * m.h));
    s.eventMode = 'none';
    this.hahnBild = s;
    c.zIndex = 36;
    this.welt.addChild(c);
    this.hahn = c;
    // Schlauch von der Säule zum Zapfhahn (wird neu gezeichnet, wenn der Hahn sich bewegt)
    this.schlauch = new Graphics();
    this.schlauch.zIndex = 35;
    this.schlauch.eventMode = 'none';
    this.welt.addChild(this.schlauch);
    this.schlauchStand = { x: NaN, y: NaN, r: NaN, sx: NaN };
    this.hahnPhase = 'heim';     // 'heim' | 'fliegt' | 'tank'
    this.setzeHahn(this.hahnHeim(), true);
    this.hahnZug = drag(c, {
      back: true,
      lift: 1.06,
      hitArea: new Rectangle(-50, -180, 380, 290),
      heim: () => (this.hahnPhase === 'tank' ? this.hahnTankOrt() : this.hahnHeim()),
      targets: () => this.hahnZiele(),
      onStart: () => sfx('common/klick', { vol: 0.4 }),
      onDrop: (ziel, ctx) => {
        const weg = Math.hypot(ctx.x - ctx.startX, ctx.y - ctx.startY);
        ctx.erledigt = true;
        // nur angetippt: das, was jetzt dran ist
        if (weg < 30) { this.hahnGetippt(); return; }
        if (ziel?.id === 'tank') { this.hahnZumTank(); return; }
        if (ziel?.id === 'haken') { this.hahnHeimfliegen(); return; }
        // ohne Ziel: zurück an seinen Platz (in der richtigen Lage)
        if (this.hahnPhase === 'tank') this.hahnZumTank(true);
        else this.hahnHeimfliegen(true);
      },
    });
  }

  // Solange der Zapfhahn von selbst fliegt, lässt er sich nicht greifen: Ein Griff hielte seinen Flug an, und er
  // bliebe zwischen Säule und Tank hängen (früher eine Sackgasse, wenn das Kind ihn auf dem Heimweg antippte).
  hahnFliegt(an) {
    this.hahnPhase = an ? 'fliegt' : this.hahnPhase;
    this.hahn.eventMode = an ? 'none' : 'static';
  }

  // Lage des Hahns: hängt senkrecht am Haken der Säule (Tülle unten)
  hahnHeim() {
    return { x: this.haken.x - 8, y: this.haken.y + 150, rotation: -Math.PI / 2, sx: HAHN_SKALA };
  }

  // Lage im Tank: gespiegelt (Tülle zeigt nach rechts in den Tank), leicht geneigt
  hahnTankOrt() {
    const t = this.r?.tankWelt || { x: FZ.x - 380, y: 1150 };
    return { x: t.x - 6, y: t.y + 4, rotation: -0.35, sx: -HAHN_SKALA };
  }

  setzeHahn(l, sofort) {
    const h = this.hahn;
    if (sofort) {
      h.position.set(l.x, l.y);
      h.rotation = l.rotation;
      h.scale.set(l.sx, Math.abs(l.sx));
      return Promise.resolve(true);
    }
    const dauer = clamp(Math.hypot(l.x - h.x, l.y - h.y) / 450, 0.7, 1.4);
    this.tween(h, { rotation: l.rotation, scaleX: l.sx, scaleY: Math.abs(l.sx) }, dauer, { ease: 'sineInOut' });
    return this.tween(h, { x: l.x, y: l.y }, dauer, { ease: 'sineInOut' });
  }

  hahnZiele() {
    const r = this.r;
    if (this.hahnPhase === 'tank') {
      return [{ id: 'haken', x: this.haken.x + 40, y: this.haken.y + 80, radius: 300 }];
    }
    if (r && r.zustand === 'da' && r.tank.menge < 1) {
      return [{ id: 'tank', x: r.tankWelt.x - 90, y: r.tankWelt.y - 30, radius: 320 }];
    }
    return [];
  }

  baueAutomat() {
    const a = AUTOMAT;
    weich(this.welt, { x: a.x, y: a.y - 6, w: 420, h: 60, z: 18 });
    this.automat = spr('waschanlage/kakao_automat', { x: a.x, y: a.y, parent: this.welt, z: 20 });
    this.automat.scale.set(a.h / meta('waschanlage/kakao_automat').h);
    this.hahnPunkt = bildPunkt(this.automat, 'waschanlage/kakao_automat', 'hahn', this.welt);
    this.tablett = bildPunkt(this.automat, 'waschanlage/kakao_automat', 'tablett', this.welt);
    tap(this.automat, () => {
      fx.wobble(this.automat, 0.04);
      if (this.tor('automat', 0.6)) sfx('common/blubber', { vol: 0.4 });
      const t = this.r?.trink;
      if (t && t.phase === 'steht') for (const k of this.sorten) fx.pulse(k);
    }, { sound: null, squash: false });
    // Strahl aus dem Hahn (Farbe der Sorte)
    this.strahl = new Graphics().roundRect(-11, 0, 22, 100, 11).fill(0xffffff);
    this.strahl.position.set(this.hahnPunkt.x, this.hahnPunkt.y - 4);
    this.strahl.alpha = 0;
    this.strahl.visible = false;
    this.strahl.eventMode = 'none';
    this.strahl.zIndex = 21;
    this.welt.addChild(this.strahl);
  }

  baueBecher() {
    const c = new Container({ label: 'becher' });
    c.zIndex = 25;               // über dem Automaten (20), hinter den Fahrzeugen (30)
    this.welt.addChild(c);
    const s = spr('waschanlage/becher', { parent: c });
    s.eventMode = 'none';
    this.becherBild = s;
    const m = meta('waschanlage/becher');
    const o = m.pts.oeffnung;
    this.oeffnung = { x: o[0] - m.ax * m.w, y: o[1] - m.ay * m.h };
    this.inhalt = new Graphics().ellipse(0, 0, 80, 21).fill(0xffffff).ellipse(-22, -5, 26, 6).fill({ color: 0xffffff, alpha: 0.3 });
    this.inhalt.position.set(this.oeffnung.x, this.oeffnung.y + 2);
    this.inhalt.alpha = 0;
    this.inhalt.eventMode = 'none';
    c.addChild(this.inhalt);
    this.sahne = new Container({ label: 'sahne' });
    this.sahne.eventMode = 'none';
    c.addChild(this.sahne);
    c.scale.set(BECHER_SKALA);
    this.becher = c;
    c.position.set(BECHER_HEIM.x, BECHER_HEIM.y);
    this.becherZug = drag(c, {
      back: true,
      lift: 1.08,
      hitArea: new Rectangle(-250, -380, 500, 450),
      heim: () => this.becherOrt(),
      targets: () => this.becherZiele(),
      onStart: () => sfx('common/klack', { vol: 0.35 }),
      onDrop: (ziel, ctx) => {
        const weg = Math.hypot(ctx.x - ctx.startX, ctx.y - ctx.startY);
        ctx.erledigt = true;
        if (weg < 30) { this.becherGetippt(); return; }
        if (ziel?.id === 'hahn') { this.becherHin(); return; }
        if (ziel?.id === 'tier') { this.becherZumTier(); return; }
        this.tween(c, this.becherOrt(), 0.45, { ease: 'cubicOut' });
      },
    });
  }

  // wo der Becher gerade hingehört
  becherOrt() {
    const p = this.r?.trink.phase;
    if (!p || p === 'leer' || p === 'fertig') return { x: BECHER_HEIM.x, y: BECHER_HEIM.y };
    return { x: this.tablett.x - this.oeffnung.x * BECHER_SKALA, y: this.tablett.y + 2 };
  }

  becherZiele() {
    const r = this.r;
    if (!r || r.zustand !== 'da') return [];
    const p = r.trink.phase;
    if (p === 'leer') return [{ id: 'hahn', x: this.tablett.x, y: this.tablett.y - 60, radius: 300 }];
    if ((p === 'eingeschenkt' || p === 'sahne') && r.kundeDa) {
      const k = r.kunde.actor;
      return [{ id: 'tier', x: k.x, y: k.y - r.kunde.info.h * 0.6, radius: 340 }];
    }
    return [];
  }

  baueSorten() {
    this.sorten = SORTEN_X.map((x, i) => {
      const c = new Container({ label: 'sorte' });
      c.position.set(x, SORTEN_Y);
      c.zIndex = 50;
      const g = new Graphics()
        .circle(0, 8, 94).fill({ color: 0x5a4630, alpha: 0.2 })
        .circle(0, 0, 94).fill(0xfff6e6).stroke({ width: 6, color: 0xe3cfa8 })
        .circle(-26, -34, 26).fill({ color: 0xffffff, alpha: 0.5 });
      g.eventMode = 'none';
      c.addChild(g);
      const b = spr('common/p_stern', { anchor: 0.5, parent: c });
      b.eventMode = 'none';
      c.bild = b;
      c.sorte = null;
      c.i = i;
      this.welt.addChild(c);
      tap(c, () => this.sorteGewaehlt(c), { sound: 'common/tipp', hitArea: new Circle(0, 0, 108) });
      return c;
    });
  }

  belegeSorten(ids) {
    this.sorten.forEach((c, i) => {
      c.sorte = ids[i];
      c.bild.texture = tex(SORTEN[ids[i]].bild);
      const t = c.bild.texture;
      c.bild.scale.set(128 / Math.max(t.width, t.height, 1));
    });
  }

  baueKamera() {
    const c = new Container({ label: 'kamera' });
    c.position.set(KAMERA.x, KAMERA.y);
    c.zIndex = 60;
    const s = spr('common/icon_kamera', { anchor: 0.5, parent: c });
    s.scale.set(190 / Math.max(s.texture.width, s.texture.height));
    s.eventMode = 'none';
    this.welt.addChild(c);
    c.alpha = 0;
    c.visible = false;
    this.kamera = c;
    tap(c, () => this.fotoMachen(), { sound: null, hitArea: new Circle(0, 0, 120) });
    c.eventMode = 'none';
  }

  // ---------------------------------------------------------------- Runde: kommen und gehen

  kommen() {
    if (this.r || !this.szene.alive) return;
    const typ = neuOhne(TYPEN, this.letzterTyp);
    this.letzterTyp = typ;
    const kunde = neuOhne(KUNDEN, this.letzteKunden);
    this.letzteKunden = [kunde, ...this.letzteKunden].slice(0, 3);
    const angebot = shuffle(Object.keys(SORTEN)).slice(0, 3);
    const belag = neuOhne(BELAEGE, this.letzterBelag);
    this.letzterBelag = belag;
    const wunsch = neuOhne(angebot, this.letzterWunsch);   // nicht zweimal hintereinander dasselbe
    this.letzterWunsch = wunsch;
    const p = plan(typ);
    const f = baueFahrzeug(p, { x: FZ.x - START, y: FZ.y, parent: this.welt, z: 30 });
    const r = {
      typ, plan: p, f, zustand: 'kommt', kundeDa: false,
      tank: { phase: 'zu', menge: 0, schluckauf: Math.random() < 0.4 },
      trink: { phase: 'leer', wunsch, sorte: null, sahne: 0, belag, milchbart: Math.random() < 0.5 },
    };
    this.r = r;
    // das ganze Fahrzeug reagiert beim Antippen (hupt); Tankdeckel und Tier liegen darüber
    const m = meta(p.koerper);
    const zone = new Container({ label: 'fahrzeugFlaeche' });
    zone.zIndex = 1;
    f.innen.addChild(zone);
    tap(zone, () => {
      this.hupen(r);
      if (r.zustand === 'da' && (r.tank.phase === 'zu' || r.tank.phase === 'gehaengt') && r.deckel) fx.pulse(r.deckel);
    }, { sound: null, squash: false, hitArea: new Rectangle(-m.ax * m.w, -m.ay * m.h, m.w, m.h) });
    this.anzeigeZiel = 0;
    this.belegeSorten(angebot);
    this.baueKunde(r, kunde);
    this.fahrTonAn(r);
    f.fahreZu(FZ.x, 3.4, { ease: 'sineInOut' }).then((ok) => {
      if (ok && this.r === r && r.zustand === 'kommt') this.angekommen(r);
    });
  }

  baueKunde(r, info) {
    const dach = dachPunkt(flaechenPunkte(r.plan), 60 / r.plan.scale);
    const kante = oberkante(r.plan.koerper, dach.x);
    if (kante !== null) dach.y = kante + 10;
    const g = this.welt.toLocal(r.f.innen.toGlobal(dach));
    const a = new Actor(info.id, { x: g.x, y: g.y, scale: info.h / 900, parent: this.welt, z: 32 });
    r.kunde = { actor: a, info, reitet: true, dx: g.x - r.f.x, y: g.y };
    a.onTap(() => {
      a.cheer({ parent: this.vorn });
      const t = r.trink.phase;
      if (r.kundeDa && (t === 'leer' || t === 'steht')) this.after(0.6, () => a.bubble(SORTEN[r.trink.wunsch].bild, 2.4));
    });
  }

  fahrTonAn(r) {
    this.fahrTon?.aus(0.3);
    this.fahrTon = new Schleife(r.plan.fahrTon, { vol: 0.4 });
    if (this.aktiv) this.fahrTon.an(0.5);
  }

  angekommen(r) {
    this.fahrTon?.aus(0.7);
    r.zustand = 'da';
    this.baueDeckel(r);
    this.hupen(r);
    r.kunde.reitet = false;
    this.after(0.5, () => this.kundeRunter(r));
    const deckelNoch = () => this.aktiv && this.r === r && r.tank.phase === 'zu' && this.hahnPhase === 'heim';
    this.after(2.2, () => { if (deckelNoch()) voice('waschanlage_deckel', { nurWenn: deckelNoch }); });
  }

  // Tankdeckel hinten am Fahrzeug (mitten in der Höhe, nahe am hinteren Rand)
  baueDeckel(r) {
    const pts = flaechenPunkte(r.plan);
    let minX = Infinity;
    let y0 = Infinity;
    let y1 = -Infinity;
    for (const p of pts) { minX = Math.min(minX, p.x); y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y); }
    const mitteY = y0 + (y1 - y0) * 0.45;
    let best = pts[0];
    let bestWert = Infinity;
    for (const p of pts) {
      if (p.x > minX + 140) continue;
      const wert = Math.abs(p.y - mitteY) + (p.x - minX) * 0.3;
      if (wert < bestWert) { bestWert = wert; best = p; }
    }
    const ort = { x: best.x + 20, y: best.y };
    const c = new Container({ label: 'tankdeckel' });
    c.position.set(ort.x, ort.y);
    c.scale.set(1 / r.plan.scale);
    c.zIndex = 15;
    const loch = new Graphics()
      .circle(0, 0, 48).fill(0xd9d2c4).stroke({ width: 4, color: 0xb8ae9c })
      .circle(0, 0, 30).fill(0x4a4f5c)
      .circle(-6, -6, 10).fill({ color: 0x6c7280, alpha: 0.7 });
    loch.eventMode = 'none';
    const klappe = new Container();
    klappe.position.set(-46, 0);    // Scharnier links
    const kg = new Graphics()
      .circle(46, 0, 46).fill(0xf2c53d).stroke({ width: 4, color: 0xd6a22a })
      .roundRect(30, -7, 32, 14, 7).fill(0xd6a22a)
      .circle(34, -18, 10).fill({ color: 0xffffff, alpha: 0.35 });
    kg.eventMode = 'none';
    klappe.addChild(kg);
    c.addChild(loch, klappe);
    r.f.innen.addChild(c);
    r.deckel = c;
    r.klappe = klappe;
    tap(c, () => this.deckelGetippt(r), { sound: null, squash: false, hitArea: new Circle(0, 0, 125) });
    r.tankWelt = this.welt.toLocal(r.f.innen.toGlobal(ort));
  }

  // Das Tier hüpft vom Dach vors Café; wird der Sprung unterbrochen, springt es kurz danach noch einmal
  kundeRunter(r, versuch = 0) {
    const k = r.kunde;
    if (k.actor.destroyed || k.reitet || this.r !== r) return;
    k.actor.hopTo(STAND.x, STAND.y, { hoehe: 150, dauer: 1.2 }).then((ok) => {
      if (k.actor.destroyed || k.reitet) return;
      if (!ok) {
        if (versuch < 3) { this.after(0.6, () => this.kundeRunter(r, versuch + 1)); return; }
        // immer wieder unterbrochen: dann steht es eben gleich vor dem Café (sonst ginge es im Café nicht weiter)
        k.actor.position.set(STAND.x, STAND.y);
      }
      k.actor.zIndex = 33;
      k.actor.lookAt(STAND.x + 100);
      r.kundeDa = true;
      if (versuch === 0) k.actor.sound();
      this.after(0.9, () => {
        if (this.r === r && r.zustand === 'da' && r.trink.phase === 'leer' && !k.actor.destroyed) {
          k.actor.bubble(SORTEN[r.trink.wunsch].bild, 2.6);
        }
      });
    });
  }

  kundeAufsDach(r, dauer) {
    const k = r.kunde;
    if (k.reitet || k.actor.destroyed) return;
    k.reitet = true;
    k.springt = true;
    k.actor.zIndex = 32;
    k.actor.hopTo(r.f.x + k.dx, k.y, { hoehe: 160, dauer }).then(() => {
      k.springt = false;
      if (!k.actor.destroyed) k.actor.lookAt(k.actor.x + 100);
    });
  }

  hupen(r) {
    if (!this.tor('hupen', 0.7)) return;
    const g = r.plan.gruss;
    sfx(g.id, { vol: g.vol, rate: g.rate ?? 1 });
    r.f.hupf(24);
    if (r.plan.dampf) {
      const s = r.f.punkt('schornstein', this.vorn);
      if (s) this.burst('rauch', s.x, s.y - 10, { count: 4 });
    }
  }

  // ---------------------------------------------------------------- Tanken

  deckelGetippt(r) {
    if (this.r !== r || r.zustand !== 'da') { this.hupen(r); return; }
    const t = r.tank;
    if (t.phase === 'zu') {
      this.deckelAuf(r);
    } else if (t.phase === 'gehaengt') {
      // Hahn hängt wieder, Tank voll: Deckel zu
      t.phase = 'fertig';
      this.tween(r.klappe, { scaleX: 1 }, 0.35, { ease: 'sineInOut' });
      sfx('common/klack', { vol: 0.5 });
      this.after(0.4, () => {
        if (this.r !== r) return;
        this.burst('funkeln', r.tankWelt.x, r.tankWelt.y, { count: 4 });
        sfx('common/funkeln', { vol: 0.35 });
        this.hupen(r);
        this.allesFertig(r);
        // jetzt hat das Tier Durst (nur, wenn noch niemand den Becher angefasst hat)
        const durstNoch = () => this.aktiv && this.r === r && r.zustand === 'da' && r.kundeDa && r.trink.phase === 'leer';
        this.after(1.2, () => { if (durstNoch()) voice('waschanlage_durst', { nurWenn: durstNoch }); });
      });
    } else {
      fx.wobble(r.deckel, 0.1);
      if (this.tor('deckelTipp', 0.4)) sfx('common/tipp', { vol: 0.4 });
    }
  }

  deckelAuf(r) {
    const t = r.tank;
    if (t.phase !== 'zu') return;
    t.phase = 'offen';
    sfx('common/klick', { vol: 0.5 });
    this.tween(r.klappe, { scaleX: -0.55 }, 0.45, { ease: 'sineInOut' });
  }

  hahnGetippt() {
    const r = this.r;
    if (this.hahnPhase === 'tank') {
      if (r && r.tank.menge < 1) this.tankSchub(0.2);
      else this.hahnHeimfliegen();
      return;
    }
    if (r && r.zustand === 'da' && r.tank.menge < 1) {
      this.hahnZumTank();
      return;
    }
    fx.wobble(this.hahn, 0.08);
    this.setzeHahn(this.hahnHeim(), false);
  }

  // still = er war schon im Tank und gleitet nur in seine Lage zurück
  hahnZumTank(still = false) {
    const r = this.r;
    if (!r || r.zustand !== 'da' || (!still && r.tank.menge >= 1)) { this.hahnHeimfliegen(true); return; }
    if (r.tank.phase === 'zu') this.deckelAuf(r);
    this.hahnFliegt(true);
    this.setzeHahn(this.hahnTankOrt(), false).then((ok) => {
      if (!ok || this.hahn.destroyed) return;
      this.hahnFliegt(false);
      this.hahnPhase = 'tank';
      if (this.r !== r) { this.hahnHeimfliegen(true); return; }
      if (!still) sfx('common/klack', { vol: 0.45 });
      // der Zustand folgt dem Ort, nicht der Art des Flugs
      if (r.tank.phase !== 'offen') return;
      r.tank.phase = 'steckt';
      const tankNoch = () => this.aktiv && this.r === r && r.tank.phase === 'steckt' && r.tank.menge < 0.05 && !this.tankt;
      this.after(0.8, () => { if (tankNoch()) voice('waschanlage_tanken', { nurWenn: tankNoch }); });
    });
  }

  // still = er gleitet nur an seinen Haken zurück (ohne Klack)
  hahnHeimfliegen(still = false) {
    const r = this.r;
    this.hahnFliegt(true);
    this.tankt = false;
    this.setzeHahn(this.hahnHeim(), false).then((ok) => {
      if (!ok || this.hahn.destroyed) return;
      this.hahnFliegt(false);
      this.hahnPhase = 'heim';
      if (!r || this.r !== r) return;
      const t = r.tank;
      // der Zustand folgt dem Ort: hängt der Hahn, ist ein voller Tank fertig zum Zumachen
      if (t.phase === 'voll') {
        sfx('common/klack', { vol: 0.4 });
        t.phase = 'gehaengt';
        fx.pulse(r.deckel);
      } else if (t.phase === 'steckt') {
        if (!still) sfx('common/klack', { vol: 0.4 });
        t.phase = 'offen';   // noch nicht voll: der Hahn kann wieder hin
      } else if (!still) {
        sfx('common/klack', { vol: 0.4 });
      }
    });
  }

  saeuleAn() {
    const r = this.r;
    if (r && r.zustand === 'da' && this.hahnPhase === 'tank' && r.tank.menge < 1) {
      this.tankt = true;
      fx.pop(this.saeuleBild, 0.03);
      if (this.aktiv) this.tankTon.an(0.25);
      return;
    }
    // noch nicht dran: die Säule wackelt und zeigt, was zu tun ist
    fx.wobble(this.saeule, 0.04);
    if (this.tor('saeuleTipp', 0.5)) sfx('common/blubber', { vol: 0.3, rate: 1.2 });
    if (r && r.zustand === 'da') {
      if (r.tank.phase === 'zu' || r.tank.phase === 'gehaengt') fx.pulse(r.deckel);
      else if (this.hahnPhase !== 'fliegt') fx.pulse(this.hahn);
    }
  }

  saeuleAus() {
    if (!this.tankt) return;
    this.tankt = false;
    this.tankTon.aus(0.4);
    // ein kurzes Antippen tankt auch ein Stück (fünfmal antippen = voll, so gut wie halten)
    this.tankSchub(0.2);
  }

  tankSchub(menge) {
    const r = this.r;
    if (!r || r.zustand !== 'da' || this.hahnPhase !== 'tank' || r.tank.menge >= 1) return;
    r.tank.menge = Math.min(1, r.tank.menge + menge);
    if (this.tor('gluck', 0.45)) sfx('common/blubber', { vol: 0.3, rate: 0.8 + r.tank.menge * 0.4 });
    if (r.tank.menge >= 1) this.tankVoll(r);
  }

  tankVoll(r) {
    if (r.tank.phase !== 'steckt') return;
    r.tank.phase = 'voll';
    this.tankt = false;
    this.tankTon.aus(0.4);
    this.after(0.3, () => {
      if (this.r !== r) return;
      sfx('common/klingel', { vol: 0.5 });
      this.burst('funkeln', this.fensterWelt.x, this.fensterWelt.y, { count: 4 });
      fx.pop(this.saeuleBild, 0.05);
    });
    // Überraschung: die Zapfsäule hat Schluckauf
    if (r.tank.schluckauf) {
      for (let i = 0; i < 2; i++) {
        this.after(1.3 + i * 0.9, () => {
          if (this.r !== r || this.saeule.destroyed) return;
          this.tween(this.saeule, { y: SAEULE.y - 26 }, 0.18, { ease: 'quadOut' })
            .then((ok) => { if (ok) this.tween(this.saeule, { y: SAEULE.y }, 0.3, { ease: 'quadIn' }); });
          sfx('common/hupf', { vol: 0.4, rate: 1.3 });
          this.burst('blasen', this.fensterWelt.x, this.fensterWelt.y - 90, { count: 2 });
        });
      }
    }
    const vollNoch = () => this.aktiv && this.r === r && r.tank.phase === 'voll';
    this.after(r.tank.schluckauf ? 3.2 : 1.2, () => { if (vollNoch()) voice('waschanlage_voll', { nurWenn: vollNoch }); });
  }

  // ---------------------------------------------------------------- Café

  becherGetippt() {
    const r = this.r;
    const p = r?.trink.phase;
    if (!r || r.zustand !== 'da' || !p || p === 'fertig') {
      fx.wobble(this.becher, 0.08);
      if (this.tor('becherTipp', 0.4)) sfx('common/klack', { vol: 0.3, rate: 1.2 });
      this.tween(this.becher, this.becherOrt(), 0.4, { ease: 'cubicOut' });
      return;
    }
    if (p === 'leer') this.becherHin();
    else if (p === 'eingeschenkt') this.sahneDrauf(r);
    else if (p === 'sahne') this.becherZumTier();
    else {
      // steht (noch leer), rinnt gerade oder trinkt: wackelt, die Sorten wippen
      fx.wobble(this.becher, 0.06);
      if (p === 'steht') for (const k of this.sorten) fx.pulse(k);
      if (p !== 'trinkt') this.tween(this.becher, this.becherOrt(), 0.3, { ease: 'cubicOut' });
    }
  }

  // Becher unter den Hahn → Promise
  becherHin() {
    const r = this.r;
    if (!r || r.trink.phase !== 'leer') return Promise.resolve(false);
    r.trink.phase = 'steht';
    const ziel = this.becherOrt();
    const b = this.becher;
    const sx = b.x;
    const sy = b.y;
    const proxy = { p: 0 };
    const dauer = Math.max(0.8, Math.hypot(ziel.x - sx, ziel.y - sy) / 550);
    // im Flug nicht greifbar (Finger und Flug zögen sonst gegeneinander)
    b.eventMode = 'none';
    return this.tween(proxy, { p: 1 }, dauer, {
      ease: 'sineInOut',
      onUpdate: () => {
        if (b.destroyed) return;
        b.x = lerp(sx, ziel.x, proxy.p);
        b.y = lerp(sy, ziel.y, proxy.p) - Math.sin(proxy.p * Math.PI) * 90;
      },
    }).then((ok) => {
      if (!b.destroyed) b.eventMode = 'static';
      if (!ok) return false;
      sfx('common/klack', { vol: 0.45 });
      const stehtNoch = () => this.aktiv && this.r === r && r.trink.phase === 'steht';
      this.after(1.0, () => {
        if (!stehtNoch() || !r.kundeDa) return;
        r.kunde.actor.bubble(SORTEN[r.trink.wunsch].bild, 2.4);
      });
      return true;
    });
  }

  async sorteGewaehlt(c) {
    const r = this.r;
    if (!r || r.zustand !== 'da' || !c.sorte) return;
    const t = r.trink;
    if (t.phase === 'leer') {
      // der Becher stellt sich von selbst hin, dann läuft es
      t.vorgemerkt = c.sorte;
      const ok = await this.becherHin();
      if (!ok || this.r !== r || t.phase !== 'steht') return;
      this.schenkeEin(r, t.vorgemerkt);
      return;
    }
    if (t.phase !== 'steht') {
      fx.wobble(c, 0.08);
      if (t.phase === 'eingeschenkt') fx.pulse(this.becher);
      return;
    }
    this.schenkeEin(r, c.sorte);
  }

  schenkeEin(r, sorte) {
    const t = r.trink;
    if (t.phase !== 'steht') return;
    t.phase = 'rinnt';
    t.sorte = sorte;
    const farbe = SORTEN[sorte].farbe;
    this.inhalt.tint = farbe;
    this.inhalt.alpha = 0;
    this.inhalt.scale.set(0.5);
    this.strahl.tint = farbe;
    this.strahl.height = Math.max(20, this.becher.y + this.oeffnung.y * BECHER_SKALA - this.strahl.y + 6);
    this.strahl.visible = true;
    this.tween(this.strahl, { alpha: 1 }, 0.3, { ease: 'sineInOut' });
    fx.wobble(this.automat, 0.03);
    sfx('common/giessen', { vol: 0.4 });
    this.tween(this.inhalt, { alpha: 1 }, 0.8, { ease: 'sineInOut', delay: 0.3 });
    this.tween(this.inhalt, { scaleX: 1, scaleY: 1 }, 1.8, { ease: 'sineInOut', delay: 0.3 });
    this.after(2.2, () => {
      this.tween(this.strahl, { alpha: 0 }, 0.5, { ease: 'sineInOut' }).then((ok) => { if (ok) this.strahl.visible = false; });
      if (this.r !== r || t.phase !== 'rinnt') return;
      t.phase = 'eingeschenkt';
      sfx('common/plopp', { vol: 0.45 });
      this.burst('rauch', this.becher.x + 10, this.becher.y - 120, { count: 2 });
      if (sorte === t.wunsch && r.kundeDa) r.kunde.actor.nod();
    });
  }

  // Sahne: zwei Tupfer, dann der Belag
  sahneDrauf(r) {
    const t = r.trink;
    if (t.phase !== 'eingeschenkt' || t.sahne >= 3) return;
    t.sahne++;
    const o = this.oeffnung;
    let s;
    if (t.sahne <= 2) {
      s = spr('common/p_schaum', { anchor: 0.5, parent: this.sahne });
      const g = t.sahne === 1 ? 190 : 140;
      s.scale.set(g / s.texture.width);
      s.position.set(o.x + (t.sahne === 1 ? 0 : 8), o.y - (t.sahne === 1 ? 16 : 54));
      sfx('common/plopp', { vol: 0.4, rate: 1.1 + t.sahne * 0.1 });
    } else {
      s = spr(t.belag, { anchor: 0.5, parent: this.sahne });
      s.scale.set(84 / Math.max(s.texture.width, s.texture.height));
      s.position.set(o.x + 10, o.y - 90);
      sfx('common/funkeln', { vol: 0.35 });
      this.burst('funkeln', this.becher.x + o.x * BECHER_SKALA, this.becher.y + (o.y - 90) * BECHER_SKALA, { count: 2 });
    }
    s.eventMode = 'none';
    const ziel = s.scale.x;
    s.scale.set(ziel * 0.3);
    this.tween(s, { scale: ziel }, 0.4, { ease: 'backOut' });
    if (t.sahne >= 3) {
      t.phase = 'sahne';
      this.after(0.6, () => { if (this.r === r && t.phase === 'sahne') fx.pulse(this.becher); });
    }
  }

  becherZumTier() {
    const r = this.r;
    const t = r?.trink;
    if (!r || !t || (t.phase !== 'eingeschenkt' && t.phase !== 'sahne') || !r.kundeDa) {
      this.tween(this.becher, this.becherOrt(), 0.4, { ease: 'cubicOut' });
      return;
    }
    t.phase = 'trinkt';
    this.becher.zIndex = 40;     // vor dem Tier
    const k = r.kunde.actor;
    const mund = k.point('mouth');
    const ziel = { x: mund.x + 70, y: mund.y + 120 };
    const b = this.becher;
    // vom Abflug bis er wieder auf der Fensterbank steht nicht greifbar (sonst landete er mitten im Trinken woanders)
    b.eventMode = 'none';
    const sx = b.x;
    const sy = b.y;
    const proxy = { p: 0 };
    const dauer = Math.max(1.0, Math.hypot(ziel.x - sx, ziel.y - sy) / 600);
    this.tween(proxy, { p: 1 }, dauer, {
      ease: 'sineInOut',
      onUpdate: () => {
        if (b.destroyed) return;
        b.x = lerp(sx, ziel.x, proxy.p);
        b.y = lerp(sy, ziel.y, proxy.p) - Math.sin(proxy.p * Math.PI) * 120;
        b.rotation = -0.4 * proxy.p;
      },
    }).then((ok) => {
      if (b.destroyed) return;
      if (!ok || this.r !== r || r.kunde.actor.destroyed) {
        // (sollte nicht vorkommen) Becher wieder greifbar an seinen Platz
        if (t.phase === 'trinkt') t.phase = t.sahne >= 3 ? 'sahne' : 'eingeschenkt';
        b.rotation = 0;
        this.tween(b, this.becherOrt(), 0.6, { ease: 'sineInOut' });
        b.eventMode = 'static';
        return;
      }
      this.trinken(r);
    });
  }

  trinken(r) {
    const t = r.trink;
    const k = r.kunde.actor;
    if (k.destroyed) return;
    k.pose('eat');
    sfx('common/mampf', { vol: 0.5 });
    this.after(0.6, () => sfx('common/blubber', { vol: 0.25, rate: 0.7 }));
    this.tween(this.inhalt, { alpha: 0 }, 1.4, { ease: 'sineInOut' });
    this.tween(this.sahne, { alpha: 0 }, 1.2, { ease: 'sineInOut' });
    this.after(1.7, () => {
      if (this.r !== r || k.destroyed) return;
      k.pose('idle');
      t.phase = 'fertig';
      k.cheer({ parent: this.vorn });
      if (t.sorte === t.wunsch) this.burst('herzen', k.x, k.y - r.kunde.info.h - 20, { count: 2 });
      if (t.milchbart) this.milchbart(k, SORTEN[t.sorte].farbe);
      // Becher zurück auf die Fensterbank, leer und sauber
      this.tween(this.becher, { rotation: 0 }, 0.5, { ease: 'sineInOut' });
      this.tween(this.becher, { x: BECHER_HEIM.x, y: BECHER_HEIM.y }, 1.1, { ease: 'sineInOut', delay: 0.4 })
        .then(() => this.leereBecher());
      this.allesFertig(r);
    });
  }

  leereBecher() {
    if (this.becher.destroyed) return;
    this.becher.eventMode = 'static';
    this.becher.zIndex = 25;     // auf der Fensterbank: hinter den Fahrzeugen
    this.inhalt.alpha = 0;
    for (const c of [...this.sahne.children]) c.destroy();
    this.sahne.alpha = 1;
  }

  // Überraschung: nach dem Trinken bleibt ein Bart in der Farbe des Getränks – das Tier lacht, dann ist er weg
  milchbart(k, farbe) {
    if (k.destroyed) return;
    const mund = k.point('mouth');
    const lokal = k.toLocal(this.welt.toGlobal({ x: mund.x, y: mund.y + 10 }));
    const sk = Math.abs(k.scale.x) || 1;
    const g = new Graphics()
      .ellipse(-26, 0, 30, 15).fill(farbe)
      .ellipse(26, 0, 30, 15).fill(farbe)
      .ellipse(0, -4, 18, 12).fill(farbe);
    g.scale.set(1 / sk);
    g.position.set(lokal.x, lokal.y);
    g.alpha = 0;
    g.eventMode = 'none';
    g.zIndex = 5;
    k.addChild(g);
    this.tween(g, { alpha: 0.95 }, 0.5, { ease: 'sineInOut', delay: 0.6 });
    this.after(1.6, () => { if (!k.destroyed) k.sound(); });
    this.after(4.5, () => {
      if (g.destroyed) return;
      this.tween(g, { alpha: 0 }, 0.8, { ease: 'sineInOut' }).then(() => { if (!g.destroyed) g.destroy(); });
    });
  }

  // ---------------------------------------------------------------- Foto und Abschied

  allesFertig(r) {
    if (this.r !== r || r.zustand !== 'da') return;
    if (r.tank.phase !== 'fertig' || r.trink.phase !== 'fertig') return;
    r.zustand = 'foto';
    this.after(1.4, () => {
      if (this.r !== r || r.zustand !== 'foto') return;
      const c = this.kamera;
      c.visible = true;
      c.scale.set(0.6);
      this.tween(c, { alpha: 1 }, 0.5, { ease: 'sineInOut' });
      this.tween(c, { scale: 1 }, 0.6, { ease: 'backOut' });
      c.eventMode = 'static';
      sfx('common/plopp', { vol: 0.45 });
      const fotoNoch = () => this.aktiv && this.r === r && r.zustand === 'foto';
      this.after(0.8, () => { if (fotoNoch()) voice('waschanlage_foto', { nurWenn: fotoNoch }); });
    });
  }

  fotoMachen() {
    const r = this.r;
    if (!r || r.zustand !== 'foto') return;
    r.zustand = 'fertig';
    this.runden++;
    const c = this.kamera;
    c.eventMode = 'none';
    sfx('common/klick', { vol: 0.6 });
    const k = r.kunde.actor;
    if (!k.destroyed) {
      k.pose('happy');
      this.after(1.6, () => { if (!k.destroyed && k.poseName === 'happy') k.pose('idle'); });
    }
    // das Foto wächst aus der Kamera und schwebt an die Wand
    const i = this.fotoAnzahl % this.fotos.length;
    const daten = { typ: r.typ, tier: r.kunde.info.id };
    const f = this.baueFoto(daten);
    f.position.set(c.x, c.y + 40);
    f.scale.set(0.3);
    f.alpha = 0;
    f.zIndex = 70;
    f.eventMode = 'none';
    this.welt.addChild(f);
    this.tween(f, { alpha: 1 }, 0.4, { ease: 'sineInOut' });
    this.tween(f, { scale: 1.25, y: c.y + 170 }, 0.7, { ease: 'sineInOut' }).then((ok) => {
      if (!ok || f.destroyed) return;
      const ziel = this.fotoPlatz(i);
      const sx = f.x;
      const sy = f.y;
      const proxy = { p: 0 };
      const dauer = Math.max(1.2, Math.hypot(ziel.x - sx, ziel.y - sy) / 550);
      this.after(0.5, () => {
        if (f.destroyed) return;
        this.tween(proxy, { p: 1 }, dauer, {
          ease: 'sineInOut',
          onUpdate: () => {
            if (f.destroyed) return;
            f.x = lerp(sx, ziel.x, proxy.p);
            f.y = lerp(sy, ziel.y, proxy.p) - Math.sin(proxy.p * Math.PI) * 100;
            f.scale.set(lerp(1.25, 1, proxy.p));
          },
        }).then(() => {
          if (!f.destroyed) f.destroy({ children: true });
          this.fotoDran(i, daten, true);
          this.fotoListe[i] = daten;
          this.fotoAnzahl++;
          store.set(FOTO_SPEICHER, { liste: this.fotoListe, anzahl: this.fotoAnzahl });
          sfx('common/klack', { vol: 0.45 });
          this.burst('funkeln', ziel.x, ziel.y, { count: 3 });
        });
      });
    });
    this.tween(c, { alpha: 0 }, 0.6, { ease: 'sineInOut', delay: 0.9 }).then((ok) => { if (ok) c.visible = false; });
    this.after(3.4, () => this.abschied(r));
  }

  abschied(r) {
    if (this.r !== r) return;
    const k = r.kunde;
    const lebt = () => this.r === r && !r.f.destroyed && !k.actor.destroyed;
    if (lebt()) this.kundeAufsDach(r, 1.15);
    this.after(1.3, () => { if (lebt()) { this.hupen(r); voice('waschanlage_tschuess'); } });
    this.after(2.2, () => { if (lebt()) this.belohnung(); });
    this.after(3.6, () => this.losfahren(r));
  }

  belohnung() {
    const ids = STICKER_HIER.filter((id) => sticker(id));
    if (!ids.length) return;
    const schon = new Set(gesammelt());
    const neu = ids.find((id) => !schon.has(id));
    if (!neu && this.runden % 3 !== 0) return;
    belohne(this, neu || pick(ids), FZ.x + 120, 640);
  }

  losfahren(r) {
    if (this.r !== r || r.zustand === 'geht') return;
    r.zustand = 'geht';
    if (!r.kunde.reitet) this.kundeAufsDach(r, 1.0);
    this.fahrTonAn(r);
    sfx('common/wusch', { vol: 0.35 });
    r.f.fahreZu(FZ.x + START, 3.2, { ease: 'quadIn' }).then(() => {
      if (!r.kunde.actor.destroyed) r.kunde.actor.destroy({ children: true });
      if (!r.f.destroyed) r.f.destroy({ children: true });
      if (this.r !== r) return;
      this.r = null;
      this.fahrTon?.aus(0.6);
      this.anzeigeZiel = 0;
      if (this.aktiv) this.after(0.6, () => this.kommen());
    });
  }

  // ---------------------------------------------------------------- Takt

  update(dt, t) {
    this.wolken.update(dt);
    this.vogel.update(dt);
    const r = this.r;
    if (r && !r.f.destroyed) {
      r.f.update(dt);
      const k = r.kunde;
      if (k.reitet && !k.springt && !k.actor.destroyed) {
        k.actor.x = r.f.x + k.dx;
        k.actor.y += (k.y - k.actor.y) * (1 - Math.exp(-dt * 6));
      }
      if (this.tankt && this.hahnPhase === 'tank') this.tankSchub(dt * 0.3);
      this.anzeigeZiel = r.tank.menge;
    }
    if (this.tankt && (!r || this.hahnPhase !== 'tank' || r.tank.menge >= 1)) {
      this.tankt = false;
      this.tankTon.aus(0.4);
    }
    // Anzeige im Fenster: weich zur Menge
    const ziel = this.anzeigeZiel || 0;
    this.anzeige += (ziel - this.anzeige) * (1 - Math.exp(-dt * 4));
    if (Math.abs(ziel - this.anzeige) < 0.002) this.anzeige = ziel;
    this.fenster.scale.set(Math.max(0.01, this.anzeige));
    this.fenster.alpha = clamp(this.anzeige * 3, 0, 1);
    this.zeichneSchlauch();
    // Kamera wippt sanft, solange sie wartet
    if (this.kamera.visible && r?.zustand === 'foto') this.kamera.rotation = Math.sin(t * 2.4) * 0.06;
  }

  zeichneSchlauch() {
    const h = this.hahn;
    const st = this.schlauchStand;
    if (Math.abs(h.x - st.x) < 0.5 && Math.abs(h.y - st.y) < 0.5 && Math.abs(h.rotation - st.r) < 0.003
      && Math.abs(h.scale.x - st.sx) < 0.003) return;
    st.x = h.x;
    st.y = h.y;
    st.r = h.rotation;
    st.sx = h.scale.x;
    const b = bildPunkt(this.hahnBild, 'waschanlage/zapfhahn', 'anschluss', this.welt);
    const a = this.schlauchStart;
    const sag = 140 + Math.abs(b.x - a.x) * 0.25;
    const g = this.schlauch;
    g.clear();
    const weg = (dicke, farbe, alpha, dy = 0) => g
      .moveTo(a.x, a.y + dy)
      .bezierCurveTo(a.x + 60, a.y + sag + dy, b.x - 20, b.y + sag * 0.7 + dy, b.x, b.y + dy)
      .stroke({ width: dicke, color: farbe, alpha, cap: 'round' });
    weg(22, 0x3d4250, 1);
    weg(6, 0x7c8494, 0.7, -5);
  }

  // ---------------------------------------------------------------- Hilfen

  tor(name, sek) {
    const alt = this.tore.get(name) ?? -1e9;
    if (this.t - alt < sek) return false;
    this.tore.set(name, this.t);
    return true;
  }

  hinweise() {
    const r = this.r;
    const liste = [];
    if (r && r.zustand === 'da') {
      const tk = r.tank;
      if (tk.phase === 'zu') liste.push(r.deckel);
      else if (tk.phase === 'offen' && this.hahnPhase === 'heim') {
        liste.push({ von: this.hahnBild, nach: { x: r.tankWelt.x - 60, y: r.tankWelt.y } });
      } else if (tk.phase === 'steckt' && this.hahnPhase === 'tank') liste.push(this.saeuleBild);
      else if (tk.phase === 'voll' && this.hahnPhase === 'tank') {
        liste.push({ von: this.hahnBild, nach: { x: this.haken.x, y: this.haken.y + 60 } });
      } else if (tk.phase === 'gehaengt' && this.hahnPhase === 'heim') liste.push(r.deckel);
      if (!liste.length && r.kundeDa) {
        const tr = r.trink;
        if (tr.phase === 'leer') liste.push({ von: this.becherBild, nach: { x: this.tablett.x, y: this.tablett.y - 60 } });
        else if (tr.phase === 'steht') liste.push(this.sorten.find((c) => c.sorte === tr.wunsch) || this.sorten[0]);
        else if (tr.phase === 'eingeschenkt') liste.push(this.becherBild);
        else if (tr.phase === 'sahne') liste.push({ von: this.becherBild, nach: r.kunde.actor });
      }
    } else if (r && r.zustand === 'foto' && this.kamera.alpha > 0.5) {
      liste.push(this.kamera);
    }
    // immer genau EIN nächster Schritt (die Hand wechselt sonst bei jedem neuen Hinweis das Ziel)
    return liste;
  }

  /** Gerade gibt es nichts zu tun (Fahrzeug rollt herein/hinaus, etwas fliegt oder läuft von selbst). */
  wartetGerade() {
    return this.aktiv && this.hinweise().length === 0;
  }
}
