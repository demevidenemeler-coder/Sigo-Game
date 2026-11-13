// Seite 3: die Eisküche – zwei neue Abläufe, die nebeneinander laufen (jeder für sich, nichts blockiert das andere).
//
// A) Eis selber machen (links):
//   1. Milch: das Kännchen antippen oder zum Trichter ziehen → es gießt Milch in die Eismaschine.
//   2. Frucht: eine Frucht vom Teller in den Trichter ziehen (oder antippen).
//   3. Kurbeln: die Kurbel an der Maschine antippen – vier halbe Drehungen, jede klingt einen Ton höher.
//   4. Die neue Sorte quillt in die Wanne (Farbe der Frucht, die Frucht vorn darauf).
//   5. Die Wanne ins Sorten-Regal an der Wand ziehen (oder antippen).
//   Das Regal bleibt über alle Besuche (store 'eisdiele.sorten'): jede neue Frucht gibt eine neue Sorte, bis alle neun
//   dastehen. Eine Sorte, die es schon gibt, hüpft nur kurz und freut sich.
//
// B) Eis am Stiel (rechts) – für einen Gast, der in seiner Denkblase sein Wunsch-Eis zeigt (Farbe, Schokolade, Streusel):
//   1. Frucht vom Teller in die Form ziehen (oder antippen) → die Form füllt sich mit Saft.
//   2. Stiel: den Stiel-Becher antippen (oder den Stiel ziehen) → er steckt in der Form.
//   3. Kühlen: die Form antippen oder zur Kühltruhe ziehen → sie verschwindet darin, es glitzert leise.
//   4. Herausnehmen: das fertige Eis schaut aus der Truhe – antippen → es dreht sich um und steckt im Halter.
//   5. Schokolade: Eis zum Topf ziehen oder den Topf antippen → es taucht ein.
//   6. Streusel: Schälchen antippen oder das Eis darauf ziehen.
//   7. Dem Gast geben: Eis zum Tier ziehen oder antippen → es schleckt es in drei Bissen und freut sich.
//   Schokolade und Streusel sind nie Pflicht; passt alles zum Wunsch, freut sich das Tier besonders.
//   Überraschung: Manchmal hat der Gast Geburtstag (Partyhütchen) – dann steckt eine Kerze im Eis, das Tier pustet sie
//   aus, und es klingt ein leises Geburtstagslied.

import { PIXI, spr, meta, tap, drag, fx, sfx, note, voice, pick, clamp, store, killTweensOf } from '../../engine/index.js';
import { Seite, hgPunkt } from '../../gemeinsam/seiten.js';
import { belohne, stickerFuerOrt } from '../../gemeinsam/sticker.js';
import { Kundschaft } from './kunden.js';
import { belohneZiel } from './girlanden.js';
import { toppingWagen, schale, bogenFlug, mische } from './deko.js';
import { OBST } from './saftbar.js';
import {
  Stieleis, EisForm, miniStieleis, partyHut, kerze, geburtstagsLied, EIS_H, STIEL_L,
} from './stieleis.js';

const OBST_IDS = Object.keys(OBST);
const SPEICHER = 'eisdiele.sorten';

const THEKE_Y = 980;               // Standfläche auf der Arbeitstheke (am Foto abgelesen)
const MASCH = { x: -700, s: 0.85 };
const WANNE_X = -385;
const WANNE_S = 0.72;
const REGAL_S = 0.46;
const TELLER_X = [-175, -10, 155];
const FRUCHT_G = 150;              // Darstellungsgröße einer Frucht auf dem Teller
const FORM_X = 330;
const TRUHE = { x: 600, s: 0.7 };
const UNTEN_Y = 1350;              // Ablage des kleinen Wagens vorn
const KANNE_X = -830;
const KANNE_S = 0.85;
const STIEL_X = -560;
const TOPF_X = -280;
const TOPF_S = 0.72;
const STREU_X = 0;
const HALTER_X = 280;
const HALTER_OBEN = UNTEN_Y - 44;
const KUNDE_X = 880;
const KUNDE_SKALA = 0.56;
const KURBEL_NOETIG = 4;           // halbe Drehungen
// Sorten-Regal an der freien Wand: zwei Bretter, je fünf Plätze (feste Plätze in der Reihenfolge von OBST)
const REGAL = { links: -490, rechts: 250, bretter: [470, 690], x: [-400, -250, -100, 50, 200] };

export class Eiskueche extends Seite {
  static hg = 'eisdiele/hg_eiskueche';

  aufbau() {
    this.bodenY = 1575;
    // Eismaschine
    this.m = { milch: false, frucht: null, kurbel: 0, laeuft: false, voll: false, fruchtFlug: false, kanneFlug: false };
    this.maschinenRunden = 0;
    // Eis am Stiel
    this.eis = null;            // das fertige Eis (in der Truhe, im Halter oder unterwegs)
    this.eisOrt = null;         // 'truhe' | 'halter' | 'unterwegs'
    this.formWeg = false;       // die Form ist gerade in der Truhe
    this.friert = false;
    this.saftFlug = false;
    this.stielFlug = false;
    this.isst = false;
    this.wunsch = null;         // {frucht, schoko, streusel}
    this.letzterWunsch = null;
    this.stielRunden = 0;
    this.blase = null;
    this.geburtstag = null;     // Tier mit Geburtstag (bis es gegangen ist)
    this.letztesMalGeburtstag = false;
    this.gast = null;
    this.letzteKurbelTon = 0;
    this._hinweis = null;

    this.sorten = store.get(SPEICHER, []).filter((id) => OBST[id]);
    this.regalWannen = {};

    this.baueRegal();
    this.baueMaschine();
    this.baueTeller();
    this.baueWagen();
    this.baueStiel();

    this.kunde = new Kundschaft(this, {
      x: KUNDE_X, y: this.bodenY, scale: KUNDE_SKALA, z: 30, draussen: 1580, kleinDx: -140, kleinPad: 30,
      onTipp: () => { if (this.blase) for (const c of this.blase.children.slice(1)) fx.pop(c, 0.1); },
    });
  }

  /** Geschaffte Runden beider Abläufe (zum Zählen in Tests). */
  get runde() {
    return this.stielRunden + this.maschinenRunden;
  }

  betreten() {
    if (this.besuche === 1) this.naechsterKunde(0.4);
    // „Gieß die Milch in die Eismaschine" – nur, solange die Maschine noch ganz unberührt ist
    this._hinweis?.kill();
    const passt = () => this.aktiv && !this.m.milch && !this.m.kanneFlug && !this.m.frucht && !this.maschinenRunden;
    this._hinweis = this.after(1.4, () => { if (passt()) voice('eisdiele_milch', { nurWenn: passt }); });
  }

  verlassen() {
    this._hinweis?.kill();
    this._hinweis = null;
  }

  /** Einen Hinweis-Satz etwas später sagen – nur, wenn er dann noch passt. */
  satz(id, sek, passt) {
    const p = () => this.aktiv && passt();
    this.after(sek, () => { if (p()) voice(id, { nurWenn: p }); });
  }

  /** Sticker der Eisdiele: den gewünschten, wenn es ihn gibt (sonst einen noch fehlenden). */
  belohneSticker(id, x, y) {
    if (stickerFuerOrt('eisdiele').some((s) => s.id === id)) belohne(this, id, x, y);
    else belohneZiel(this, id, x, y);
  }

  // ---------------------------------------------------------------- Aufbau: Regal

  regalPlatz(frucht) {
    const i = Math.max(0, OBST_IDS.indexOf(frucht));
    return { x: REGAL.x[i % 5], y: REGAL.bretter[Math.floor(i / 5)] - 6 };
  }

  baueRegal() {
    const g = new PIXI.Graphics();
    const { links, rechts } = REGAL;
    for (const y of REGAL.bretter) {
      // Konsolen, Brett, Schatten an der Wand
      for (const x of [links + 70, rechts - 70]) {
        g.poly([x - 16, y + 16, x + 16, y + 16, x + 6, y + 70, x - 6, y + 70]).fill(0xd9a066).stroke({ width: 4, color: 0xb07a40, join: 'round' });
      }
      g.roundRect(links + 10, y + 18, rechts - links - 20, 14, 7).fill({ color: 0x8a5a3a, alpha: 0.12 });
      g.roundRect(links, y, rechts - links, 26, 13).fill(0xf2c27e).stroke({ width: 5, color: 0xc98a4a });
      g.roundRect(links + 20, y + 4, (rechts - links) * 0.55, 7, 3.5).fill({ color: 0xffffff, alpha: 0.35 });
    }
    // leere Plätze: zarte Umrisse (zeigen, dass hier noch Sorten hinkommen)
    OBST_IDS.forEach((id) => {
      const p = this.regalPlatz(id);
      g.roundRect(p.x - 52, p.y - 72, 104, 70, 20).fill({ color: 0xffffff, alpha: 0.28 }).stroke({ width: 3, color: 0xe0b890, alpha: 0.5 });
    });
    g.zIndex = 2;
    g.eventMode = 'none';
    this.welt.addChild(g);
    for (const id of this.sorten) {
      const w = this.baueWanne(id, true);
      const p = this.regalPlatz(id);
      w.position.set(p.x, p.y);
      w.scale.set(REGAL_S);
      this.regalWanneFertig(w, id);
    }
  }

  /** Wanne mit Eis (Farbe der Frucht) – voll = gleich gefüllt (fürs Regal), sonst leer. Ursprung = Standfläche. */
  baueWanne(frucht, voll) {
    const c = new PIXI.Container({ label: 'wanne', sortableChildren: true });
    c.creme = spr('eisdiele/eiscreme_weiss', { scale: 0.92, y: -150, parent: c, z: 0 });
    c.creme.eventMode = 'none';
    c.bild = spr('eisdiele/wanne_leer', { parent: c, z: 1 });
    c.bild.eventMode = 'none';
    c.hitArea = new PIXI.Rectangle(-170, -310, 340, 330);
    c.icon = null;
    if (voll) this.wanneFuellen(c, frucht, true);
    else c.creme.visible = false;
    c.zIndex = 8;
    this.welt.addChild(c);
    return c;
  }

  /** Wanne mit der Sorte füllen (sofort oder später über das Quellen). */
  wanneFuellen(c, frucht, sofort) {
    c.frucht = frucht;
    c.creme.tint = mische(OBST[frucht].farbe, 0xffffff, 0.3);
    c.creme.visible = true;
    if (sofort) {
      c.creme.scale.y = 0.92;
      this.wanneIcon(c, frucht);
    }
  }

  wanneIcon(c, frucht) {
    const o = OBST[frucht];
    const s = spr(o.tex, { anchor: 0.5, parent: c, z: 2, y: -82 });
    s.scale.set(118 / Math.max(s.texture.width, s.texture.height));
    s.eventMode = 'none';
    c.icon = s;
    return s;
  }

  regalWanneFertig(w, id) {
    w.zIndex = 4;
    w.eventMode = 'static';
    this.regalWannen[id] = w;
    const ton = 72 + OBST_IDS.indexOf(id) * 2;
    let zuletzt = 0;
    tap(w, () => {
      fx.wobble(w, 0.08);
      const jetzt = performance.now();
      if (jetzt - zuletzt > 400) { zuletzt = jetzt; note('glocke', ton, { vol: 0.28 }); }
    }, { sound: null, squash: false, hitArea: new PIXI.Rectangle(-260, -480, 520, 520) });
  }

  // ---------------------------------------------------------------- Aufbau: Eismaschine

  baueMaschine() {
    this.maschine = spr('eisdiele/eismaschine', { scale: MASCH.s, x: MASCH.x, y: THEKE_Y, parent: this.welt, z: 10 });
    const p = (n, e) => hgPunkt(this.maschine, 'eisdiele/eismaschine', n) || e;
    this.trichter = p('trichter', { x: MASCH.x, y: 600 });
    this.ausguss = p('ausguss', { x: MASCH.x + 150, y: 830 });
    const kp = p('kurbel', { x: MASCH.x - 140, y: 800 });
    tap(this.maschine, () => this.maschineTipp(), { sound: null, squash: false, hitArea: new PIXI.Rectangle(-170, -600, 330, 600) });
    const schatten = new PIXI.Graphics().ellipse(MASCH.x + 20, THEKE_Y + 2, 170, 22).fill({ color: 0x5a4630, alpha: 0.15 });
    schatten.zIndex = 1;
    schatten.eventMode = 'none';
    this.welt.addChild(schatten);

    // Kurbel (gezeichnet): Achse an der linken Seite, Arm mit Griff – dreht sich beim Antippen.
    // Nur der Arm dreht sich; die Tippfläche (ein Kreis um die Achse, der beide Lagen des Griffs abdeckt) bleibt
    // stehen – sonst träfe ein zweiter Tipp auf dieselbe Stelle nach einer halben Drehung nicht mehr.
    const k = new PIXI.Container({ label: 'kurbel' });
    k.position.set(kp.x - 8, kp.y);
    const arm = new PIXI.Graphics();
    arm.roundRect(-13, -112, 26, 118, 13).fill(0xf4a6b6).stroke({ width: 5, color: 0xdc8296 });
    arm.circle(0, -116, 32).fill(0xfff3b0).stroke({ width: 5, color: 0xe8c45a });
    arm.circle(-10, -126, 9).fill({ color: 0xffffff, alpha: 0.5 });
    arm.circle(0, 0, 25).fill(0xf4a6b6).stroke({ width: 5, color: 0xdc8296 });
    arm.circle(0, 0, 9).fill(0xffffff);
    k.addChild(arm);
    arm.rotation = -0.5;
    this.kurbelArm = arm;
    this.kurbelWinkel = -0.5;
    k.zIndex = 12;
    k.hitArea = new PIXI.Circle(0, 0, 150);
    tap(k, () => this.kurbelTipp(), { sound: null, squash: false });
    this.welt.addChild(k);
    this.kurbel = k;

    // Strahl (Milch bzw. Eis aus dem Ausguss)
    this.strahl = new PIXI.Graphics();
    this.strahl.zIndex = 9;
    this.strahl.alpha = 0;
    this.strahl.eventMode = 'none';
    this.welt.addChild(this.strahl);

    this.neueWanne(false);
  }

  /** Leere Wanne unter den Ausguss stellen (weich=wächst heran). */
  neueWanne(weich = true) {
    const w = this.baueWanne(null, false);
    w.position.set(WANNE_X, THEKE_Y);
    w.scale.set(WANNE_S);
    this.wanne = w;
    w.ziehen = drag(w, {
      targets: () => (this.m.voll && this.wanne === w ? [{ id: 'regal', ...this.regalZiel(), radius: 420 }] : []),
      heim: { x: WANNE_X, y: THEKE_Y },
      onStart: () => note('glocke', this.m.voll ? 84 : 79, { vol: 0.22 }),
      onDrop: (ziel, ctx) => {
        const getippt = Math.hypot(ctx.x - ctx.startX, ctx.y - ctx.startY) < 40;
        if (!this.m.voll || this.wanne !== w) {
          // noch leer: die Kurbel bzw. was fehlt, zeigt sich
          if (getippt) this.maschineTipp();
          return getippt ? undefined : false;
        }
        if (!ziel && !getippt) return undefined;
        ctx.erledigt = true;
        this.insRegal(w);
        return undefined;
      },
    });
    if (weich) {
      w.alpha = 0;
      w.scale.set(WANNE_S * 0.4);
      this.tween(w, { alpha: 1 }, 0.35, { ease: 'sineInOut' });
      this.tween(w, { scale: WANNE_S }, 0.5, { ease: 'backOut' });
    }
  }

  regalZiel() {
    const f = this.m.frucht;
    const p = this.regalPlatz(f);
    return { x: p.x, y: p.y - 50 };
  }

  // ---------------------------------------------------------------- Aufbau: Obst-Teller

  baueTeller() {
    this.teller = TELLER_X.map((x) => {
      const c = schale(...pick([[0xf6c3cf, 0xe3a0b2], [0xbfe6d6, 0x8fcfb4], [0xfbe3a8, 0xe8c57a]]));
      c.position.set(x, THEKE_Y);
      c.scale.set(0.84);
      c.zIndex = 6;
      this.welt.addChild(c);
      return { x, sprite: null, id: null };
    });
    for (const fach of this.teller) this.legeFrucht(fach, this.waehleFrucht(), false);
  }

  /** Welche Frucht kommt neu auf einen Teller? Zuerst das Wunsch-Obst, dann Sorten, die im Regal noch fehlen. */
  waehleFrucht(ohne = null) {
    const da = new Set(this.teller.filter((f) => f !== ohne && f.id).map((f) => f.id));
    const frei = OBST_IDS.filter((id) => !da.has(id));
    const w = this.wunsch?.frucht;
    if (w && !da.has(w)) return w;
    const neu = frei.filter((id) => !this.sorten.includes(id) && id !== this.m.frucht);
    if (neu.length && Math.random() < 0.7) return pick(neu);
    return pick(frei);
  }

  legeFrucht(fach, id, weich = true) {
    const o = OBST[id];
    const s = spr(o.tex, { anchor: 0.5, parent: this.welt, z: 7 });
    const skala = FRUCHT_G / Math.max(s.texture.width, s.texture.height);
    s.position.set(fach.x, THEKE_Y - 30 - (s.texture.height * skala) / 2);
    s.obstId = id;
    fach.sprite = s;
    fach.id = id;
    const r = 102 / skala;   // Greiffläche gut 200 Einheiten
    s.ziehen = drag(s, {
      hitArea: new PIXI.Rectangle(-r, -r, 2 * r, 2 * r),
      targets: () => {
        const t = [];
        if (this.maschineNimmtFrucht()) t.push({ id: 'maschine', x: this.trichter.x, y: this.trichter.y + 40, radius: 280 });
        if (this.formNimmtSaft()) t.push({ id: 'form', x: FORM_X, y: THEKE_Y - 160, radius: 240 });
        return t;
      },
      onStart: () => note('xylo', this.wunsch?.frucht === id ? 79 : 72, { vol: 0.25 }),
      onDrop: (ziel, ctx) => {
        const getippt = Math.hypot(ctx.x - ctx.startX, ctx.y - ctx.startY) < 40;
        if (!ziel && !getippt) return undefined;
        const wohin = ziel ? ziel.id : this.zielFuerFrucht();
        if (!wohin) {
          this.nichtsFrei();
          return false;
        }
        ctx.erledigt = true;
        if (wohin === 'maschine') this.fruchtInMaschine(fach, s);
        else this.fruchtInForm(fach, s);
        return undefined;
      },
    });
    if (weich) {
      s.scale.set(0.01);
      s.alpha = 0;
      this.tween(s, { alpha: 1 }, 0.35, { ease: 'sineInOut' });
      this.tween(s, { scale: skala }, 0.55, { ease: 'backOut' });
    } else {
      s.scale.set(skala);
    }
  }

  /** Frucht ist weg: der Teller bekommt bald eine neue. */
  tellerNachfuellen(fach) {
    fach.sprite = null;
    fach.id = null;
    this.after(0.9, () => { if (!fach.sprite) this.legeFrucht(fach, this.waehleFrucht(fach)); });
  }

  /** Kein Teller hat das Wunsch-Obst? Dann tauscht eine Frucht sanft (nicht die, die gerade gezogen wird). */
  wunschObstAuflegen() {
    const w = this.wunsch?.frucht;
    if (!w || this.teller.some((f) => f.id === w)) return;
    const fach = this.teller.find((f) => f.sprite && !f.sprite.ziehen?.isDragging() && f.sprite.eventMode !== 'none');
    if (!fach) return;
    const alt = fach.sprite;
    alt.ziehen?.off();
    alt.eventMode = 'none';
    this.tween(alt, { alpha: 0, scale: alt.scale.x * 0.5 }, 0.35, { ease: 'sineInOut' }).then(() => { if (!alt.destroyed) alt.destroy(); });
    fach.sprite = null;
    fach.id = null;
    this.after(0.3, () => { if (!fach.sprite) this.legeFrucht(fach, w); });
  }

  maschineNimmtFrucht() {
    const m = this.m;
    return !m.frucht && !m.fruchtFlug && !m.laeuft && !m.voll;
  }

  formNimmtSaft() {
    return !this.formWeg && this.form.leer && !this.eis && !this.saftFlug;
  }

  /** Angetippte Frucht: wohin? Wartet die Maschine mit Milch, dorthin; sonst in die Form, sonst in die Maschine. */
  zielFuerFrucht() {
    const m = this.maschineNimmtFrucht();
    const f = this.formNimmtSaft();
    if (m && f) return this.m.milch || !this.kunde.bereit ? 'maschine' : 'form';
    if (f) return 'form';
    if (m) return 'maschine';
    return null;
  }

  nichtsFrei() {
    fx.wobble(this.maschine, 0.03);
    fx.wobble(this.form, 0.04);
    note('xylo', 60, { vol: 0.3 });
  }

  // ---------------------------------------------------------------- Aufbau: Wagen vorn

  baueWagen() {
    const w = toppingWagen(1420, 200);
    w.position.set(-245, UNTEN_Y);
    w.zIndex = 12;
    this.welt.addChild(w);

    // Milchkännchen
    this.kanne = spr('eisdiele/milchkanne', { scale: KANNE_S, x: KANNE_X, y: UNTEN_Y + 4, parent: this.welt, z: 15 });
    this.kanneHeim = { x: KANNE_X, y: UNTEN_Y + 4 };
    this.kanne.ziehen = drag(this.kanne, {
      hitArea: new PIXI.Rectangle(-150, -250, 280, 270),
      targets: () => (this.maschineNimmtMilch() ? [{ id: 'maschine', x: this.trichter.x, y: this.trichter.y + 60, radius: 300 }] : []),
      heim: this.kanneHeim,
      onStart: () => note('glocke', 81, { vol: 0.22 }),
      onDrop: (ziel, ctx) => {
        const getippt = Math.hypot(ctx.x - ctx.startX, ctx.y - ctx.startY) < 40;
        if (!ziel && !getippt) return undefined;
        if (!this.maschineNimmtMilch()) {
          this.maschineTipp();
          return false;
        }
        ctx.erledigt = true;
        this.milchGiessen();
        return undefined;
      },
    });

    // Stiel-Becher: ein Becher voller Holzstiele
    const b = new PIXI.Container({ label: 'stielbecher', sortableChildren: true });
    b.position.set(STIEL_X, UNTEN_Y + 2);
    const g = new PIXI.Graphics();
    for (const [x, r] of [[-26, -0.16], [0, 0.04], [24, 0.18]]) {
      const s = new PIXI.Graphics();
      s.roundRect(-12, -200, 24, 150, 11).fill(0xf0cf95).stroke({ width: 4, color: 0xc99a5c });
      s.position.set(x, 0);
      s.rotation = r;
      b.addChild(s);
    }
    g.ellipse(0, 2, 78, 14).fill({ color: 0x5a4630, alpha: 0.14 });
    g.roundRect(-64, -110, 128, 112, 30).fill(0xb9c8f2).stroke({ width: 5, color: 0x8ea0d8 });
    g.roundRect(-70, -118, 140, 22, 11).fill(0xf7cf7a).stroke({ width: 4, color: 0xe0b050 });
    g.roundRect(-46, -88, 30, 9, 4.5).fill({ color: 0xffffff, alpha: 0.4 });
    for (const x of [-26, 8, 34]) g.circle(x, -48, 9).fill({ color: 0xffffff, alpha: 0.6 });
    g.zIndex = 5;
    b.addChild(g);
    b.zIndex = 15;
    b.hitArea = new PIXI.Rectangle(-120, -260, 240, 280);
    tap(b, () => this.stielTipp(), { sound: null });
    this.welt.addChild(b);
    this.stielBecher = b;

    // Schokoladen-Topf
    this.topf = spr('eisdiele/schokotopf', { scale: TOPF_S, x: TOPF_X, y: UNTEN_Y + 4, parent: this.welt, z: 16 });
    tap(this.topf, () => this.topfTipp(), { sound: null, hitArea: new PIXI.Rectangle(-165, -280, 330, 300) });

    // Streusel-Schälchen
    const st = new PIXI.Container({ label: 'streusel' });
    st.position.set(STREU_X, UNTEN_Y);
    st.addChild(schale(0xfbe3a8, 0xe8c57a));
    const bild = spr('eisdiele/streusel_bunt', { anchor: 0.5, scale: 0.72, parent: st, y: -78 });
    bild.eventMode = 'none';
    st.bild = bild;
    st.zIndex = 15;
    st.hitArea = new PIXI.Rectangle(-110, -200, 220, 230);
    tap(st, () => this.streuTipp(), { sound: null });
    this.welt.addChild(st);
    this.streuSchale = st;

    // Halter für das fertige Eis
    const h = new PIXI.Graphics();
    h.ellipse(0, 4, 90, 14).fill({ color: 0x5a4630, alpha: 0.14 });
    h.roundRect(-80, -46, 160, 50, 20).fill(0xf4a6b6).stroke({ width: 5, color: 0xdc8296 });
    h.ellipse(0, -44, 26, 8).fill(0xb86a7c);
    h.roundRect(-60, -38, 40, 8, 4).fill({ color: 0xffffff, alpha: 0.4 });
    h.position.set(HALTER_X, UNTEN_Y + 2);
    h.zIndex = 18;
    h.hitArea = new PIXI.Rectangle(-110, -200, 220, 220);
    tap(h, () => {
      if (this.eis && this.eisOrt === 'halter') this.eisTipp();
      else { note('xylo', 67, { vol: 0.25 }); if (this.eisOrt === 'truhe') this.after(0.2, () => fx.pop(this.eis, 0.08)); }
    }, { sound: null });
    this.welt.addChild(h);
    this.halter = h;
  }

  // ---------------------------------------------------------------- Aufbau: Form und Truhe

  baueStiel() {
    this.truhe = spr('eisdiele/kuehltruhe', { scale: TRUHE.s, x: TRUHE.x, y: THEKE_Y, parent: this.welt, z: 8 });
    this.truheInnen = hgPunkt(this.truhe, 'eisdiele/kuehltruhe', 'innen') || { x: TRUHE.x, y: THEKE_Y - 170 };
    tap(this.truhe, () => this.truheTipp(), { sound: null, squash: false, hitArea: new PIXI.Rectangle(-200, -480, 400, 490) });

    this.form = new EisForm();
    this.form.position.set(FORM_X, THEKE_Y);
    this.form.zIndex = 10;
    this.welt.addChild(this.form);
    this.form.ziehen = drag(this.form, {
      targets: () => (this.form.eis && !this.formWeg && !this.friert ? [{ id: 'truhe', x: TRUHE.x, y: THEKE_Y - 180, radius: 300 }] : []),
      heim: { x: FORM_X, y: THEKE_Y },
      onStart: () => note('glocke', 79, { vol: 0.2 }),
      onDrop: (ziel, ctx) => {
        const getippt = Math.hypot(ctx.x - ctx.startX, ctx.y - ctx.startY) < 40;
        if (!ziel && !getippt) return undefined;
        if (!this.form.eis) {
          if (getippt) this.formLeerHinweis();
          return getippt ? undefined : false;
        }
        ctx.erledigt = true;
        this.formKuehlen();
        return undefined;
      },
    });
  }

  // ---------------------------------------------------------------- Eismaschine

  maschineNimmtMilch() {
    const m = this.m;
    return !m.milch && !m.kanneFlug && !m.laeuft && !m.voll;
  }

  /** Maschine angetippt: sie wackelt, und was als Nächstes fehlt, hüpft kurz. */
  maschineTipp() {
    fx.wobble(this.maschine, 0.04);
    note('xylo', 64, { vol: 0.28 });
    const m = this.m;
    if (m.laeuft) return;
    if (m.voll) { this.after(0.25, () => fx.pop(this.wanne, 0.08)); return; }
    if (!m.milch && !m.kanneFlug) { this.after(0.25, () => fx.pop(this.kanne, 0.1)); return; }
    if (!m.frucht && !m.fruchtFlug) {
      const f = this.teller.find((x) => x.sprite);
      if (f) this.after(0.25, () => fx.pop(f.sprite, 0.1));
      return;
    }
    if (m.milch && m.frucht) this.after(0.25, () => fx.pop(this.kurbel, 0.1));
  }

  milchGiessen() {
    const m = this.m;
    m.kanneFlug = true;
    const k = this.kanne;
    k.eventMode = 'none';
    k.zIndex = 40;
    // Tülle (lokal, unskaliert) und wohin das Kännchen muss, damit sie geneigt über dem Trichter steht
    const md = meta('eisdiele/milchkanne') || {};
    const pt = md.pts?.tuelle || [255, 25];
    const tuelle = { x: pt[0] - (md.ax ?? 0.58) * (md.w ?? 260), y: pt[1] - (md.ay ?? 0.986) * (md.h ?? 225) };
    const neig = 0.7;
    const dx = (tuelle.x * Math.cos(neig) - tuelle.y * Math.sin(neig)) * KANNE_S;
    const dy = (tuelle.x * Math.sin(neig) + tuelle.y * Math.cos(neig)) * KANNE_S;
    const zx = this.trichter.x - 10 - dx;
    const zy = this.trichter.y - 40 - dy;
    sfx('common/hupf', { vol: 0.3 });
    this.tween(k, { rotation: neig }, 0.75, { ease: 'sineInOut', delay: 0.15 });
    bogenFlug(this, k, zx, zy, { dauer: 0.9, hoehe: 120 }).then(async (ok) => {
      if (k.destroyed) return;
      if (!ok) await this.wait(0.2);
      const t = this.welt.toLocal(k.toGlobal(tuelle));
      const st = this.strahl;
      st.clear()
        .moveTo(t.x, t.y)
        .quadraticCurveTo(t.x + 18, t.y + 10, this.trichter.x + 8, this.trichter.y + 30)
        .stroke({ width: 18, color: 0xfffbf0, cap: 'round', alpha: 0.95 });
      st.zIndex = 39;
      sfx('common/giessen', { vol: 0.32 });
      await this.tween(st, { alpha: 1 }, 0.2, { ease: 'sineInOut' });
      await this.wait(0.9);
      await this.tween(st, { alpha: 0 }, 0.25, { ease: 'sineInOut' });
      m.milch = true;
      fx.pop(this.maschine, 0.04);
      sfx('common/plopp', { vol: 0.4, rate: 0.9 });
      this.tween(k, { rotation: 0 }, 0.5, { ease: 'sineInOut' });
      await bogenFlug(this, k, this.kanneHeim.x, this.kanneHeim.y, { dauer: 0.8, hoehe: 110 });
      if (k.destroyed) return;
      k.rotation = 0;
      k.zIndex = 15;
      k.eventMode = 'static';
      m.kanneFlug = false;
      this.nachMaschine();
    });
  }

  fruchtInMaschine(fach, s) {
    const m = this.m;
    m.fruchtFlug = true;
    s.ziehen?.off();
    s.eventMode = 'none';
    s.zIndex = 40;
    this.tellerNachfuellen(fach);
    sfx('common/hupf', { vol: 0.35 });
    bogenFlug(this, s, this.trichter.x, this.trichter.y - 70, { dauer: 0.6, hoehe: 150, skala: s.scale.x * 0.8 }).then(() => {
      if (s.destroyed) { m.fruchtFlug = false; return false; }
      s.zIndex = 9;   // hinter den Trichterrand
      return this.tween(s, { y: this.trichter.y + 40, alpha: 0, scale: s.scale.x * 0.5 }, 0.4, { ease: 'sineIn' });
    }).then(() => {
      if (!s.destroyed) s.destroy();
      m.fruchtFlug = false;
      m.frucht = s.obstId;
      fx.pop(this.maschine, 0.04);
      sfx('common/plopp', { vol: 0.5, rate: 0.85 });
      this.nachMaschine();
    });
  }

  /** Milch und Frucht drin: „Jetzt kurbeln!" */
  nachMaschine() {
    const m = this.m;
    if (m.milch && m.frucht && !m.laeuft && !m.voll) {
      this.satz('eisdiele_kurbel', 0.5, () => m.milch && m.frucht && m.kurbel === 0 && !m.laeuft);
    }
  }

  kurbelTipp() {
    const m = this.m;
    const k = this.kurbel;
    if (m.laeuft || m.voll) {
      fx.wobble(k, 0.08);
      if (m.voll) this.after(0.2, () => fx.pop(this.wanne, 0.08));
      return;
    }
    if (!m.milch || !m.frucht) {
      // noch nicht bereit: die Kurbel ruckelt nur ein bisschen, und was fehlt, zeigt sich
      fx.wobble(k, 0.12);
      this.maschineTipp();
      return;
    }
    // Schnelles Tippen zählt jedes Mal (der Arm dreht aus der jetzigen Lage weiter) – höchstens alle 0,25 s
    const nun = performance.now();
    if (nun - (this.letzteKurbel || 0) < 250) return;
    this.letzteKurbel = nun;
    this.kurbelWinkel += Math.PI;
    killTweensOf(this.kurbelArm);
    this.tween(this.kurbelArm, { rotation: this.kurbelWinkel }, 0.45, { ease: 'sineInOut' });
    const jetzt = performance.now();
    if (jetzt - this.letzteKurbelTon > 500) {
      this.letzteKurbelTon = jetzt;
      sfx('common/angel', { vol: 0.3 });
    }
    note('xylo', [64, 67, 69, 72][Math.min(3, m.kurbel)], { vol: 0.3 });
    fx.wobble(this.maschine, 0.025);
    m.kurbel++;
    if (m.kurbel >= KURBEL_NOETIG) {
      m.laeuft = true;
      this.after(0.5, () => this.eisQuillt());
    }
  }

  async eisQuillt() {
    const m = this.m;
    const w = this.wanne;
    const farbe = mische(OBST[m.frucht].farbe, 0xffffff, 0.3);
    this.wanneFuellen(w, m.frucht, false);
    w.creme.scale.y = 0.05;
    const a = this.ausguss;
    const zx = WANNE_X + 10;
    const zy = THEKE_Y - 125;
    const st = this.strahl;
    st.zIndex = 9;
    st.clear().moveTo(a.x - 4, a.y - 2).quadraticCurveTo(a.x + 30, a.y + 30, zx, zy)
      .stroke({ width: 30, color: farbe, cap: 'round', alpha: 1 });
    fx.pop(this.maschine, 0.04);
    sfx('common/blubber', { vol: 0.4 });
    await this.tween(st, { alpha: 1 }, 0.25, { ease: 'sineInOut' });
    await this.tween(w.creme.scale, { y: 0.92 }, 1.6, { ease: 'sineInOut' });
    await this.tween(st, { alpha: 0 }, 0.3, { ease: 'sineInOut' });
    if (w.destroyed) return;
    const icon = this.wanneIcon(w, m.frucht);
    const ruhe = icon.scale.x;
    icon.scale.set(0.01);
    this.tween(icon, { scale: ruhe }, 0.45, { ease: 'backOut' });
    sfx('common/plopp', { vol: 0.5 });
    this.burst('funkeln', WANNE_X, THEKE_Y - 140, { count: 4 });
    m.laeuft = false;
    m.voll = true;
    const neu = !this.sorten.includes(m.frucht);
    if (neu) this.satz('eisdiele_sorte', 0.5, () => m.voll && this.wanne === w && !w.ziehen?.isDragging());
  }

  /** Volle Wanne ins Regal: neue Sorte bekommt ihren Platz (bleibt), eine bekannte Sorte freut sich nur. */
  async insRegal(w) {
    const m = this.m;
    const frucht = m.frucht;
    m.voll = false;
    w.ziehen?.off();
    w.eventMode = 'none';
    w.zIndex = 40;
    const p = this.regalPlatz(frucht);
    const neu = !this.sorten.includes(frucht);
    sfx('common/hupf', { vol: 0.35 });
    // Maschine wieder bereit, eine neue leere Wanne kommt
    m.milch = false;
    m.frucht = null;
    m.kurbel = 0;
    this.after(0.6, () => this.neueWanne(true));
    await bogenFlug(this, w, p.x, p.y, { dauer: 0.8, hoehe: 160, skala: REGAL_S });
    if (w.destroyed) return;
    this.maschinenRunden++;
    if (neu) {
      this.sorten.push(frucht);
      store.set(SPEICHER, this.sorten.slice());
      this.regalWanneFertig(w, frucht);
      sfx('common/plopp', { vol: 0.5 });
      note('glocke', 84, { vol: 0.3 });
      this.after(0.2, () => note('glocke', 88, { vol: 0.3 }));
      this.burst('funkeln', p.x, p.y - 60, { count: 5 });
    } else {
      const alt = this.regalWannen[frucht];
      this.tween(w, { alpha: 0 }, 0.3, { ease: 'sineInOut' }).then(() => { if (!w.destroyed) w.destroy({ children: true }); });
      if (alt && !alt.destroyed) fx.pop(alt, 0.12);
      note('glocke', 86, { vol: 0.28 });
      this.burst('funkeln', p.x, p.y - 60, { count: 3 });
    }
    if (this.maschinenRunden === 1) this.belohneSticker('eisdiele_eismaschine', p.x + 60, p.y - 160);
    else if (neu && this.sorten.length === OBST_IDS.length) belohneZiel(this, 'eisdiele_eismaschine', p.x, p.y - 160);
  }

  // ---------------------------------------------------------------- Eis am Stiel: Saft, Stiel, Kühlen

  fruchtInForm(fach, s) {
    this.saftFlug = true;
    s.ziehen?.off();
    s.eventMode = 'none';
    s.zIndex = 40;
    this.tellerNachfuellen(fach);
    sfx('common/hupf', { vol: 0.35 });
    const id = s.obstId;
    bogenFlug(this, s, FORM_X, THEKE_Y - 330, { dauer: 0.6, hoehe: 140, skala: s.scale.x * 0.8 }).then(() => {
      if (s.destroyed) { this.saftFlug = false; return false; }
      return this.tween(s, { y: THEKE_Y - 200, alpha: 0, scale: s.scale.x * 0.5 }, 0.35, { ease: 'sineIn' });
    }).then(async () => {
      if (!s.destroyed) s.destroy();
      const f = this.form;
      f.saftRein(OBST[id].farbe, id);
      sfx('common/blubber', { vol: 0.35 });
      await this.tween(f.fuell.scale, { y: 1 }, 0.7, { ease: 'sineOut' });
      this.saftFlug = false;
      fx.pop(f, 0.04);
      this.satz('eisdiele_stiel', 0.5, () => !!f.eis && !f.mitStiel && !this.formWeg);
    });
  }

  formLeerHinweis() {
    fx.wobble(this.form, 0.05);
    note('xylo', 62, { vol: 0.28 });
    const w = this.wunsch?.frucht;
    const f = this.teller.find((x) => x.sprite && x.id === w) || this.teller.find((x) => x.sprite);
    if (f && this.formNimmtSaft()) this.after(0.25, () => fx.pop(f.sprite, 0.1));
  }

  stielTipp() {
    const f = this.form;
    if (!f.eis || f.mitStiel || this.formWeg || this.stielFlug || this.saftFlug) {
      fx.wobble(this.stielBecher, 0.05);
      note('xylo', 66, { vol: 0.25 });
      if (!f.eis && !this.formWeg && !this.eis) this.formLeerHinweis();
      return;
    }
    this.stielRein();
  }

  /** Ein Stiel fliegt vom Becher in die Form. → Promise */
  async stielRein() {
    const f = this.form;
    this.stielFlug = true;
    fx.pop(this.stielBecher, 0.05);
    sfx('common/rupf', { vol: 0.35 });
    const s = new PIXI.Graphics();
    s.roundRect(-12, -150, 24, 150, 11).fill(0xf0cf95).stroke({ width: 4, color: 0xc99a5c });
    s.position.set(STIEL_X, UNTEN_Y - 60);
    s.zIndex = 40;
    s.eventMode = 'none';
    this.welt.addChild(s);
    await bogenFlug(this, s, FORM_X, THEKE_Y - 250, { dauer: 0.6, hoehe: 160, skala: 0.9 });
    if (s.destroyed) return;
    s.destroy();
    this.stielFlug = false;
    if (!f.eis) return;
    f.mitStiel = true;
    f.eis.stielZeigen(true);
    const stiel = f.eis.stiel;
    stiel.y = -40;
    this.tween(stiel, { y: 0 }, 0.3, { ease: 'bounceOut' });
    sfx('common/klack', { vol: 0.35, rate: 1.2 });
    this.satz('eisdiele_kuehlen', 0.6, () => !!f.eis && f.mitStiel && !this.formWeg);
  }

  async formKuehlen() {
    const f = this.form;
    if (!f.eis || this.formWeg || this.friert || this.saftFlug) return;
    if (!f.mitStiel) {
      // ohne Stiel geht es auch: er kommt von selbst dazu
      if (!this.stielFlug) await this.stielRein();
      await this.wait(0.3);
      if (!f.eis || !f.mitStiel || this.formWeg) return;
    }
    this.formWeg = true;
    this.friert = true;
    const farbe = f.farbe;
    const frucht = f.frucht;
    f.eventMode = 'none';
    f.zIndex = 40;
    sfx('common/hupf', { vol: 0.3 });
    const innen = this.truheInnen;
    await bogenFlug(this, f, innen.x, innen.y + 40, { dauer: 0.7, hoehe: 150, skala: 0.75 });
    if (f.destroyed) return;
    await this.tween(f, { y: innen.y + 90, alpha: 0, scale: 0.45 }, 0.4, { ease: 'sineIn' });
    f.visible = false;
    f.leeren();
    // in der Truhe: es wird kalt (leises Glitzern, zwei helle Töne)
    sfx('common/landen', { vol: 0.3 });
    this.burst('funkeln', innen.x, innen.y - 30, { count: 4 });
    this.after(0.7, () => note('glocke', 88, { vol: 0.22 }));
    this.after(1.4, () => { note('glocke', 91, { vol: 0.22 }); this.burst('funkeln', innen.x - 40, innen.y - 50, { count: 3 }); });
    await this.wait(2.2);
    // das fertige Eis schaut kopfüber (Stiel oben) aus der Truhe
    const e = new Stieleis(farbe);
    e.frucht = frucht;
    e.rotation = Math.PI;
    e.position.set(innen.x, innen.y - 40);
    e.scale.set(0.4);
    e.alpha = 0;
    e.zIndex = 9;
    this.welt.addChild(e);
    this.eis = e;
    sfx('common/plopp', { vol: 0.45 });
    this.tween(e, { alpha: 1 }, 0.4, { ease: 'sineInOut' });
    await this.tween(e, { y: innen.y - 250, scale: 0.8 }, 0.7, { ease: 'backOut' });
    if (e.destroyed) return;
    this.friert = false;
    this.eisOrt = 'truhe';
    e.eventMode = 'static';
    // Tippfläche in eigenen (ungedrehten) Koordinaten: Körper und Stiel
    e.tippen = tap(e, () => this.eisTipp(), { sound: null, squash: false, hitArea: new PIXI.Rectangle(-150, -EIS_H - 40, 300, EIS_H + STIEL_L + 50) });
  }

  truheTipp() {
    if (this.eisOrt === 'truhe') { this.herausnehmen(); return; }
    fx.wobble(this.truhe, 0.03);
    note('glocke', 91, { vol: 0.22 });
    if (this.form.eis && !this.formWeg && !this.friert) this.after(0.2, () => fx.pop(this.form, 0.06));
  }

  /** Eis angetippt: aus der Truhe → in den Halter; im Halter → zum Gast (wenn einer wartet). */
  eisTipp() {
    if (!this.eis) return;
    if (this.eisOrt === 'truhe') this.herausnehmen();
    else if (this.eisOrt === 'halter') {
      if (this.kunde.bereit && !this.isst) this.geben();
      else { fx.wobble(this.eis, 0.06); note('xylo', 72, { vol: 0.25 }); }
    }
  }

  halterOrt() {
    return { x: HALTER_X, y: HALTER_OBEN - (STIEL_L - 46) };
  }

  async herausnehmen() {
    const e = this.eis;
    if (!e || this.eisOrt !== 'truhe') return;
    this.eisOrt = 'unterwegs';
    e.tippen?.off();
    e.tippen = null;
    e.eventMode = 'none';
    e.zIndex = 40;
    sfx('common/rupf', { vol: 0.35 });
    const h = this.halterOrt();
    this.tween(e, { rotation: 0 }, 0.8, { ease: 'sineInOut' });
    await bogenFlug(this, e, h.x, h.y, { dauer: 0.9, hoehe: 160, skala: 1 });
    if (e.destroyed) return;
    e.rotation = 0;
    e.zIndex = 17;   // Stiel steckt im Halter (der liegt davor)
    sfx('common/klack', { vol: 0.35 });
    fx.pop(e, 0.05);
    this.eisOrt = 'halter';
    // die Form steht wieder bereit
    this.formZurueck();
    this.eisZiehbar(e);
  }

  formZurueck() {
    const f = this.form;
    f.leeren();
    f.position.set(FORM_X, THEKE_Y);
    f.visible = true;
    f.alpha = 0;
    f.scale.set(0.5);
    f.zIndex = 10;
    this.tween(f, { alpha: 1 }, 0.35, { ease: 'sineInOut' });
    this.tween(f, { scale: 1 }, 0.5, { ease: 'backOut' });
    this.after(0.5, () => {
      this.formWeg = false;
      f.eventMode = 'static';
    });
  }

  eisZiehbar(e) {
    e.ziehen?.off();
    e.eventMode = 'static';
    e.ziehen = drag(e, {
      hitArea: new PIXI.Rectangle(-110, -EIS_H - 40, 220, EIS_H + 120),
      heim: () => this.halterOrt(),
      targets: () => {
        if (this.eisOrt !== 'halter') return [];
        const t = [];
        if (!e.hatSchoko) t.push({ id: 'schoko', x: TOPF_X, y: UNTEN_Y - 150, radius: 230 });
        if (!e.hatStreusel) t.push({ id: 'streusel', x: STREU_X, y: UNTEN_Y - 110, radius: 210 });
        const a = this.kunde.actor;
        if (a && this.kunde.bereit && !this.isst) {
          const mund = a.point('mouth');
          t.push({ id: 'kunde', x: mund.x, y: mund.y, radius: 430 });
        }
        return t;
      },
      onStart: () => note('glocke', 86, { vol: 0.22 }),
      onDrop: (ziel, ctx) => {
        const getippt = Math.hypot(ctx.x - ctx.startX, ctx.y - ctx.startY) < 40;
        if (this.eisOrt !== 'halter') return false;
        if (!ziel) {
          if (getippt) this.eisTipp();
          return undefined;
        }
        if (ziel.id === 'kunde') {
          if (!this.kunde.bereit || this.isst) return false;
          ctx.erledigt = true;
          this.geben();
          return undefined;
        }
        if (ziel.id === 'schoko') {
          ctx.erledigt = true;
          this.tauchen();
          return undefined;
        }
        // Streusel: das Eis gleitet in den Halter zurück und bekommt seine Streusel
        this.streuen();
        return false;
      },
    });
  }

  // ---------------------------------------------------------------- Eis am Stiel: Schokolade, Streusel

  topfTipp() {
    const e = this.eis;
    if (e && this.eisOrt === 'halter' && !e.hatSchoko && !e.ziehen?.isDragging()) {
      this.tauchen();
      return;
    }
    fx.wobble(this.topf, 0.05);
    note('xylo', 62, { vol: 0.26 });
  }

  async tauchen() {
    const e = this.eis;
    if (!e || this.eisOrt !== 'halter' || e.hatSchoko) return;
    this.eisOrt = 'unterwegs';
    e.eventMode = 'none';
    e.zIndex = 40;
    sfx('common/hupf', { vol: 0.3 });
    // kopfüber über den Topf, eintauchen (hinter den Topfrand), wieder heraus
    this.tween(e, { rotation: Math.PI }, 0.6, { ease: 'sineInOut' });
    await bogenFlug(this, e, TOPF_X, UNTEN_Y - 380, { dauer: 0.7, hoehe: 120 });
    if (e.destroyed) return;
    e.zIndex = 14;   // hinter dem Topf (16)
    await this.tween(e, { y: UNTEN_Y - 270 }, 0.4, { ease: 'sineInOut' });
    sfx('common/blubber', { vol: 0.35, rate: 0.85 });
    await this.wait(0.35);
    e.schokoAn();
    await this.tween(e, { y: UNTEN_Y - 380 }, 0.4, { ease: 'sineInOut' });
    e.zIndex = 40;
    this.tween(e, { rotation: Math.PI * 2 }, 0.6, { ease: 'sineInOut' });
    const h = this.halterOrt();
    await bogenFlug(this, e, h.x, h.y, { dauer: 0.7, hoehe: 120 });
    if (e.destroyed) return;
    e.rotation = 0;
    e.zIndex = 17;
    fx.pop(e, 0.05);
    sfx('common/klack', { vol: 0.3 });
    this.eisOrt = 'halter';
    e.eventMode = 'static';
  }

  streuTipp() {
    const e = this.eis;
    if (e && this.eisOrt === 'halter' && !e.hatStreusel) {
      this.streuen();
      return;
    }
    fx.wobble(this.streuSchale, 0.06);
    note('xylo', 69, { vol: 0.26 });
  }

  /** Ein paar Streusel-Häufchen fliegen aufs Eis (es bleibt im Halter). */
  streuen() {
    const e = this.eis;
    if (!e || e.hatStreusel || this.streutGerade) return;
    this.streutGerade = true;
    fx.pop(this.streuSchale, 0.06);
    sfx('common/sand', { vol: 0.3 });
    const h = this.halterOrt();
    for (let i = 0; i < 4; i++) {
      this.after(i * 0.1, () => {
        const s = spr('eisdiele/streusel_bunt', { anchor: 0.5, scale: 0.3, x: STREU_X + (i - 1.5) * 20, y: UNTEN_Y - 90, parent: this.welt, z: 41 });
        s.eventMode = 'none';
        bogenFlug(this, s, h.x + (i - 1.5) * 22, h.y - EIS_H + 50 + (i % 2) * 30, { dauer: 0.55, hoehe: 140, skala: 0.18 })
          .then(() => (s.destroyed ? false : this.tween(s, { alpha: 0 }, 0.2, { ease: 'sineInOut' })))
          .then(() => { if (!s.destroyed) s.destroy(); });
      });
    }
    this.after(0.75, () => {
      this.streutGerade = false;
      if (e.destroyed || this.eis !== e) return;
      e.streuen();
      fx.pop(e, 0.05);
      sfx('common/plopp', { vol: 0.4, rate: 1.2 });
    });
  }

  // ---------------------------------------------------------------- Eis am Stiel: Gast

  async geben() {
    const e = this.eis;
    const a = this.kunde.actor;
    if (!e || !a || !this.kunde.bereit || this.isst || this.eisOrt !== 'halter') return;
    this.isst = true;
    this.kunde.bereit = false;
    this.gast = a;
    this.eisOrt = 'unterwegs';
    const w = this.wunsch;
    const passt = !!w && e.frucht === w.frucht && e.hatSchoko === w.schoko && e.hatStreusel === w.streusel;
    const geburtstag = this.geburtstag === a;
    this.wunsch = null;
    this.blaseWeg();
    e.ziehen?.off();
    e.eventMode = 'none';
    e.zIndex = 40;
    const mund = a.point('mouth');
    const s = 0.72;
    await bogenFlug(this, e, mund.x - 24, mund.y + EIS_H * s * 0.45, { dauer: 0.7, hoehe: 110, skala: s });
    if (e.destroyed || a.destroyed) return;
    if (geburtstag) {
      // Kerze im Eis, das Tier pustet sie aus, ein leises Lied
      const k = kerze();
      k.position.set(0, -EIS_H + 10);
      k.scale.set(0.01);
      k.zIndex = 6;
      e.oben.addChild(k);
      sfx('common/plopp', { vol: 0.4, rate: 1.2 });
      await this.tween(k, { scale: 1 }, 0.45, { ease: 'backOut' });
      await this.wait(0.7);
      if (e.destroyed) return;
      sfx('common/zisch', { vol: 0.3 });
      this.tween(k.flamme, { alpha: 0 }, 0.6, { ease: 'sineInOut' });
      const f = this.welt.toLocal(k.toGlobal({ x: 0, y: -100 }));
      this.burst('rauch', f.x, f.y, { count: 2 });
      await this.wait(0.5);
      await this.wait(geburtstagsLied(this));
      if (e.destroyed || a.destroyed) return;
    }
    a.pose('eat');
    for (const k of [0.66, 0.33, 0]) {
      sfx('common/mampf', { vol: 0.8 });
      a.nod();
      await this.tween(e.oben.scale, { y: k }, 0.35, { ease: 'sineInOut' });
      await this.wait(0.25);
      if (e.destroyed || a.destroyed) return;
    }
    await this.tween(e, { alpha: 0 }, 0.3, { ease: 'sineInOut' });
    e.destroy({ children: true });
    this.eis = null;
    this.eisOrt = null;
    a.pose('idle');
    this.stielRunden++;
    const kopf = a.point('kopf');
    await this.kunde.freut(passt || geburtstag, a);
    if (this.stielRunden === 1) this.belohneSticker('eisdiele_stieleis', kopf.x - 240, kopf.y - 60);
    await this.wait(0.3);
    this.isst = false;
    if (this.geburtstag === a) this.geburtstag = null;
    await this.kunde.geht();
    await this.naechsterKunde(0.4);
  }

  async naechsterKunde(warte = 0) {
    if (warte) await this.wait(warte);
    const ok = await this.kunde.kommt();
    if (ok) this.zeigeWunsch();
  }

  neuerWunsch() {
    const vorher = this.letzterWunsch;
    const erste = this.stielRunden === 0;
    for (let v = 0; v < 12; v++) {
      const w = {
        frucht: pick(OBST_IDS),
        schoko: erste ? true : pick([true, true, false]),
        streusel: erste ? false : pick([true, false]),
      };
      if (!vorher || w.frucht !== vorher.frucht) return w;
    }
    return { frucht: pick(OBST_IDS), schoko: true, streusel: false };
  }

  zeigeWunsch() {
    const a = this.kunde.actor;
    if (!a) return;
    const w = this.neuerWunsch();
    this.wunsch = w;
    this.letzterWunsch = w;
    const kopf = a.point('kopf');
    const b = new PIXI.Container({ label: 'stieleiswunsch' });
    b.zIndex = 35;
    const S = 0.6;
    spr('common/blase_denk', { anchor: [45 / 600, 540 / 562], scale: S, parent: b });
    const mx = (330 - 45) * S - 26;
    const my = (262 - 540) * S - 8;
    const mini = miniStieleis(OBST[w.frucht].farbe, w.schoko, w.streusel);
    mini.scale.set(0.5);
    mini.position.set(mx - 18, my + 40);
    b.addChild(mini);
    const f = spr(OBST[w.frucht].tex, { anchor: 0.5, parent: b });
    f.scale.set(84 / Math.max(f.texture.width, f.texture.height));
    f.position.set(mx + 88, my + 58);
    const x = clamp(kopf.x + 10, -1000, 1066 - 340);
    const y = clamp(kopf.y - 90, 120 + 340, 1300);
    b.position.set(x, y);
    b.hitArea = new PIXI.Rectangle(0, -340, 360, 345);
    b.alpha = 0;
    b.scale.set(0.6);
    this.welt.addChild(b);
    this.tween(b, { alpha: 1 }, 0.35, { ease: 'sineInOut' });
    this.tween(b, { scale: 1 }, 0.5, { ease: 'backOut' });
    sfx('common/plopp', { vol: 0.45, rate: 0.9 });
    tap(b, () => {
      for (const c of b.children.slice(1)) fx.pop(c, 0.1);
      this.kunde.laut();
      const fach = this.teller.find((t) => t.id === w.frucht && t.sprite);
      if (fach) this.after(0.3, () => fx.pop(fach.sprite, 0.1));
    }, { sound: null, squash: false });
    this.blase = b;
    this.wunschObstAuflegen();
    // Überraschung: manchmal hat der Gast Geburtstag (nie zweimal hintereinander)
    const fest = this.stielRunden >= 1 && !this.letztesMalGeburtstag && Math.random() < 0.25;
    this.letztesMalGeburtstag = fest;
    if (fest) {
      this.geburtstag = a;
      this.after(0.4, () => partyHut(this, a));
      const p = () => this.aktiv && this.geburtstag === a && !this.isst;
      this.after(0.9, () => { if (p()) voice('eisdiele_geburtstag', { nurWenn: p }); });
    }
  }

  blaseWeg() {
    const b = this.blase;
    this.blase = null;
    if (!b || b.destroyed) return;
    b.eventMode = 'none';
    this.tween(b, { alpha: 0, scale: 0.85 }, 0.35, { ease: 'sineInOut' }).then(() => { if (!b.destroyed) b.destroy({ children: true }); });
  }

  // ---------------------------------------------------------------- Zeige-Hand

  hinweise() {
    const m = this.m;
    const stiel = this.stielHinweis();
    const masch = this.maschHinweis();
    const stielLaeuft = !!(this.form.eis || this.eis || this.friert || this.saftFlug);
    const maschLaeuft = m.milch || m.frucht || m.voll || m.laeuft || m.kanneFlug || m.fruchtFlug;
    if (stielLaeuft && stiel.length) return stiel;
    if (maschLaeuft && masch.length) return masch;
    // Beide stehen still: abwechselnd – zuerst die Eismaschine (passt zum Satz „Gieß die Milch …"),
    // danach der Ablauf, der seltener dran war.
    const zuerstStiel = this.stielRunden < this.maschinenRunden;
    if (zuerstStiel && stiel.length) return stiel;
    if (masch.length) return masch;
    if (stiel.length) return stiel;
    return this.pausenHinweis();
  }

  stielHinweis() {
    const w = this.wunsch;
    if (this.isst || !w || !this.kunde.bereit) return [];
    const e = this.eis;
    if (e && this.eisOrt === 'truhe') return [e];
    if (e && this.eisOrt === 'halter') {
      if (w.schoko && !e.hatSchoko) return [{ von: e, nach: { x: TOPF_X, y: UNTEN_Y - 160 } }];
      if (w.streusel && !e.hatStreusel) return [this.streuSchale];
      return [{ von: e, nach: this.kunde.actor }];
    }
    if (e || this.friert || this.formWeg || this.saftFlug || this.stielFlug) return [];
    const f = this.form;
    if (f.leer) {
      const fach = this.teller.find((t) => t.sprite && t.id === w.frucht && t.sprite.eventMode !== 'none');
      return fach ? [{ von: fach.sprite, nach: { x: FORM_X, y: THEKE_Y - 160 } }] : [];
    }
    if (!f.mitStiel) return [this.stielBecher];
    return [{ von: f, nach: { x: TRUHE.x, y: THEKE_Y - 200 } }];
  }

  maschHinweis() {
    const m = this.m;
    if (m.laeuft || m.kanneFlug || m.fruchtFlug) return [];
    if (m.voll) return [{ von: this.wanne, nach: this.regalZiel() }];
    const trichter = { x: this.trichter.x, y: this.trichter.y + 30 };
    if (!m.milch) return [{ von: this.kanne, nach: trichter }];
    if (!m.frucht) {
      const fach = this.teller.find((t) => t.sprite && !this.sorten.includes(t.id) && t.sprite.eventMode !== 'none')
        || this.teller.find((t) => t.sprite && t.sprite.eventMode !== 'none');
      return fach ? [{ von: fach.sprite, nach: trichter }] : [];
    }
    return [this.kurbel];
  }

  pausenHinweis() {
    if (this.isst) return [];
    const a = this.kunde.actor;
    if (a && !a.destroyed && a !== this.gast) return [a];
    return [this.kanne];
  }
}
