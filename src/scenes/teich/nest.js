// Teich, Seite 1: Ablauf „Nest bauen und Küken ausbrüten" (Haupttätigkeit der Seite).
// Die Mama der linken Entenfamilie schwimmt ans Grasufer und wünscht sich ein Nest (Denkblase mit dem Baustoff).
//   1. Baustoff ins Nest bringen – je Runde ein anderer (ziehen; nur antippen: das Stück fliegt von selbst):
//        Schilf  – ein Halm liegt am großen Schilf (oder Schilf antippen: ein Halm am Finger)
//        Federn  – drei Federn treiben auf dem Wasser
//        Blätter – die Trauerweide antippen: ein Zweig segelt herab aufs Wasser, dann ins Nest ziehen
//      Drei Stücke, das Nest wächst mit jedem; sie bleiben sichtbar am Nestrand liegen.
//   2. Die Mama antippen: sie hüpft ins Nest und legt Eier (2–4, je Runde andere Farbe).
//   (Manchmal: Regenschauer – eine Wolke zieht herbei, das Seerosenblatt als Schirm über die Mama ziehen,
//    danach steht ein Regenbogen am Himmel.)
//   3. Eier wärmen: Finger aufs Nest halten (oder mehrmals tippen) – warmes Leuchten, Herzen, die Eier wackeln.
//   4. Eier antippen: erst ein Riss, dann schlüpft ein Küken (Überraschungen: goldenes Ei, Gummiente im Ei).
//   (Manchmal: Die Küken haben Hunger – Brotkrümel zum Nest ziehen oder das Brot antippen.)
//   5. Die Mama hüpft ins Wasser; Küken ins Wasser ziehen (oder antippen – dann hüpfen sie selbst).
//   6. Die Familie schwimmt mit den neuen Küken heim – sie wächst um höchstens eins je Runde (gespeichert). Sticker.
// Nichts kann falsch gemacht werden: Baustoff landet immer im Nest, ein Küken auf dem Gras hüpft zurück in die Schale.

import { spr, meta, drag, hold, fx, voice, note, store, killTweensOf, rand, pick, clamp, PIXI }
  from '../../engine/index.js';
import { belohne } from '../../gemeinsam/sticker.js';
import { ton, laut, naechsterSticker, flugDauer } from './deko.js';

const NEST = { x: -1000, y: 1450, s: 0.9 };      // Nest auf dem Grasufer (Anker unten Mitte)
const WARTE = { x: -830, y: 1215 };              // dort wartet die Mama im Wasser neben dem Nest
const MULDE_Y = 222;                              // Bildzeile im Nest, auf der Eier und Mama stehen (hinter dem Rand)
const NEST_MASSE = { w: 420, h: 342, ax: 0.507, ay: 0.984 };
const STUFEN = [0.55, 0.72, 0.87, 1];             // Nestgröße nach 0…3 Stücken
const HALME = 3;
const MAMA_LAND = 0.56;                           // Größe der Mama im Nest
const EI_S = 0.52;
const KUEKEN_S = 0.42;
const GUMMI_S = 0.5;                              // die Gummiente ist deutlich größer als ein Küken
const KUEKEN_MAX = 5;                             // so viele Küken je Familie, mehr schwimmen weiter
const WAERME_DAUER = 2.4;                         // Sekunden Halten bis die Eier warm sind
const PAUSE_ERST = 4;                             // bis zur ersten Runde (s)
const PAUSE = [12, 16];                           // zwischen den Runden (s)

// Baustoffe: Bild, Größe beim Tragen, Größe am Nestrand
const STOFFE = {
  schilf: { bild: 'teich/halm', s: 0.55, rest: 0.3 },
  federn: { bild: 'teich/feder', s: 0.5, rest: 0.34 },
  blaetter: { bild: 'common/futter_blatt', s: 0.38, rest: 0.19 },
};
// Plätze am Nestrand (Bildpunkte des Nests) mit Drehung
const RAND_PLAETZE = [{ x: 92, y: 262, r: -0.55 }, { x: 330, y: 258, r: 0.55 }, { x: 212, y: 292, r: 0.08 }];
const SCHILF_VORRAT = { x: -405, y: 1420 };       // dort liegt ein geschnittener Halm am großen Schilf
// Federn treiben vorn links auf dem Wasser; dort landen auch die Zweige der Weide
const WASSER_PLAETZE = [{ x: -640, y: 1290 }, { x: -400, y: 1245 }, { x: -170, y: 1320 }];
const WEIDE = { x: -745, y: 300 };                // Krone der Trauerweide (im Hintergrund)
const SCHIRM_START = { x: -540, y: 1300 };       // dort treibt das Seerosenblatt beim Regen
const WOLKE = { x: -985, y: 820 };                // Regenwolke über dem Nest

// Eier: nie zweimal dieselbe Sorte hintereinander
const VARIANTEN = [
  { id: 'weiss', eier: 3, bild: 'teich/ei', farbe: 0xffffff },
  { id: 'blau', eier: 2, bild: 'teich/ei', farbe: 0xc9e6ff },
  { id: 'tupfen', eier: 4, bild: 'teich/ei_gepunktet', farbe: 0xffffff },
  { id: 'gold', eier: 3, bild: 'teich/ei', farbe: 0xfff1dc, gold: true },
  { id: 'gummi', eier: 3, bild: 'teich/ei_gepunktet', farbe: 0xffffff, gummi: true },
  { id: 'rosa', eier: 2, bild: 'teich/ei', farbe: 0xffdfe9 },
];
const EXTRAS = ['regen', 'hunger', 'keins'];

export class NestAblauf {
  /** seite: AmTeich; wasser: PIXI.Polygon des Wassers */
  constructor(seite, wasser) {
    this.seite = seite;
    this.wasser = wasser;
    // ruhe | kommt | halme | einziehen | regen | waermen | eier | hunger | insWasser | heim
    this.phase = 'ruhe';
    this.uhr = PAUSE_ERST;
    this.mama = seite.enten[0];
    this.letzte = store.get('teich.nestLetzte', null);
    this.letzterStoff = store.get('teich.nestStoff', null);
    this.letztesExtra = store.get('teich.nestExtra', null);
    this.erzwinge = null;    // nur zum Testen: { v, stoff, extra }
    this.runden = 0;
    this.halme = 0;
    this.unterwegs = 0;
    this.stuecke = [];       // Baustoff-Stücke, die noch nicht im Nest sind
    this.eier = [];
    this.neue = [];          // geschlüpfte Küken im Wasser (folgen der Mama)
    this.waerme = 0;
    this._p = new PIXI.Point();
    this.baueNest();
    this.baueRegen();
  }

  // ---------------------------------------------------------------- Aufbau

  baueNest() {
    const w = this.seite.welt;
    // warmes Leuchten hinter dem Nest (beim Wärmen, weich)
    this.glanz = new PIXI.Graphics();
    for (let i = 7; i >= 1; i--) this.glanz.ellipse(0, 0, 90 + i * 34, 60 + i * 22).fill({ color: 0xffd27a, alpha: 0.11 });
    this.glanz.position.set(NEST.x, NEST.y - 150);
    this.glanz.alpha = 0;
    this.glanz.zIndex = NEST.y - 320;
    this.glanz.eventMode = 'none';
    w.addChild(this.glanz);

    this.hinten = new PIXI.Container({ label: 'nest:hinten' });
    this.nestBild = spr('teich/nest', { parent: this.hinten });
    this.vorn = new PIXI.Container({ label: 'nest:vorn' });
    const rand_ = spr('teich/nest', { parent: this.vorn });
    // Maske: nur der vordere Rand (unterhalb der Mulde) – Eier, Küken und Mama stehen dahinter „im" Nest
    const m = NEST_MASSE;
    const ox = m.w * m.ax;
    const oy = m.h * m.ay;
    const maske = new PIXI.Graphics()
      .poly([0, 200, 60, 205, 120, 218, 213, 228, 300, 218, 360, 204, 420, 196, 420, 342, 0, 342]
        .map((v, i) => (i % 2 === 0 ? v - ox : v - oy)))
      .fill(0xffffff);
    this.vorn.addChild(maske);
    rand_.mask = maske;
    // Baustoff am Nestrand (wächst mit dem Nest mit)
    this.deko = new PIXI.Container({ label: 'nest:deko' });
    this.vorn.addChild(this.deko);
    for (const c of [this.hinten, this.vorn]) {
      c.position.set(NEST.x, NEST.y);
      c.alpha = 0;
      c.eventMode = 'none';
      w.addChild(c);
    }
    this.hinten.zIndex = NEST.y - 300;
    this.vorn.zIndex = NEST.y + 2;
    this.setzeStufe(0, true);

    // Eine Fläche fürs ganze Nest: Wärmen (halten), Eier antippen (das nächste Ei zum Finger)
    this.flaeche = new PIXI.Container({ label: 'nest:flaeche' });
    this.flaeche.position.set(NEST.x, NEST.y - 110);
    this.flaeche.zIndex = NEST.y + 5;
    w.addChild(this.flaeche);
    this.flaeche.on('pointerdown', (e) => {
      const p = w.toLocal(e.global, undefined, this._p);
      this.druck = { x: p.x, y: p.y };
    });
    hold(this.flaeche, {
      hitArea: new PIXI.Ellipse(0, 0, 210, 150),
      onStart: () => this.nestBeruehrt(),
      onTick: (dt) => this.halten(dt),
      onEnd: () => { this.haelt = false; },
    });
    this.flaeche.eventMode = 'none';   // erst, wenn es ein Nest gibt
  }

  // Regenwolke und ein kleiner Vorrat an Tropfen (einmal angelegt, nur ein- und ausgeblendet)
  baueRegen() {
    const w = this.seite.welt;
    this.wolke = spr('common/wolke3', { parent: w, anchor: 0.5 });
    this.wolke.scale.set(300 / 810);
    this.wolke.tint = 0xc4cfdd;
    this.wolke.zIndex = 3050;
    this.wolke.visible = false;
    this.wolke.label = 'nest:wolke';
    this.wolke.eventMode = 'none';
    this.tropfen = [];
    for (let i = 0; i < 12; i++) {
      const g = new PIXI.Graphics()
        .poly([0, -16, 7, -2, 0, 8, -7, -2]).fill({ color: 0x8cc6ee, alpha: 0.85 })
        .circle(0, 1, 7).fill({ color: 0x8cc6ee, alpha: 0.85 });
      g.visible = false;
      g.eventMode = 'none';
      g.zIndex = 3040;
      w.addChild(g);
      this.tropfen.push({ g, vy: 0, bis: 0 });
    }
    this.regnet = false;
    this.tropfUhr = 0;
  }

  // Stufe 0…3 (Stücke im Nest): Nest wächst weich
  setzeStufe(n, sofort = false) {
    const s = NEST.s * STUFEN[n];
    for (const c of [this.hinten, this.vorn]) {
      if (sofort) c.scale.set(s);
      else this.seite.tween(c, { scale: s }, 0.5, { ease: 'backOut' });
    }
  }

  // Punkt in der Nestmulde (Bildpunkt des Nests → Welt), bei Nestgröße stufe (Standard: voll)
  mulde(bx = 213, by = MULDE_Y, stufe = 1) {
    const s = NEST.s * stufe;
    return { x: NEST.x + (bx - NEST_MASSE.w * NEST_MASSE.ax) * s, y: NEST.y + (by - NEST_MASSE.h * NEST_MASSE.ay) * s };
  }

  // ---------------------------------------------------------------- Ablauf

  update(dt, t) {
    const e = this.mama;
    if (this.phase === 'ruhe') {
      if (this.seite.aktiv) this.uhr -= dt;
      // nur, wenn die Mama gerade frei schwimmt (nicht frisst oder einen Krümel holt)
      if (this.uhr <= 0 && e.modus === 'schwimmt') this.starte();
      this.updateRegen(dt);
      return;
    }
    if (e.modus !== 'nest') return;
    // im Wasser: schwimmen bzw. am Ziel sanft schaukeln (im Nest und beim Hüpfen steuert der Ablauf selbst)
    if (!this.mamaImNest && !this.mamaSpringt) this.schwimme(e, dt, t);
    // die großen Küken warten im hinteren Wasser und schaukeln nur
    for (const kk of e.kueken) this.seite.setzeSchwimmer(kk, t);
    this.folgen(dt, t);
    // Baustoff auf dem Wasser schaukelt
    for (const st of this.stuecke) {
      if (st.zustand !== 'schwimmt' || st.s.destroyed) continue;
      st.s.x = st.x + Math.sin(t * 0.7 + st.phase) * 6;
      st.s.y = st.y + Math.sin(t * 1.5 + st.phase) * 4;
      st.s.rotation = st.dreh + Math.sin(t * 1.1 + st.phase) * 0.06;
    }
    if (this.schirm && this.schirm.zustand === 'schwimmt' && !this.schirm.s.destroyed) {
      this.schirm.s.y = SCHIRM_START.y + Math.sin(t * 1.4) * 4;
      this.schirm.s.rotation = Math.sin(t * 0.9) * 0.05;
    }
    this.updateRegen(dt);
    // vor dem Wärmen lädt ein sanftes Leuchten ein, das Nest zu berühren
    if (this.phase === 'waermen' && this.waerme === 0) this.glanz.alpha = 0.14 + Math.sin(t * 2) * 0.1;
    // Wärmen: Eier wackeln, Mama wiegt sich, Leuchten
    if (this.phase === 'waermen' || this.phase === 'eier') {
      const a = this.phase === 'waermen' ? this.waerme : 0.35;
      for (const ei of this.eier) {
        if (ei.stufe < 2 && !ei.s.destroyed) ei.s.rotation = Math.sin(t * (5 + ei.phase) + ei.phase) * 0.08 * a + ei.dreh;
      }
    }
    // hungrige Küken recken sich
    if (this.phase === 'hunger') {
      for (const ei of this.eier) {
        if (ei.hungrig && !ei.bekommt && ei.kueken && !ei.kueken.destroyed) {
          ei.kueken.y = ei.y - 18 - Math.abs(Math.sin(t * 2.6 + ei.phase)) * 10;
        }
      }
    }
    if (this.mamaImNest) {
      e.bild.rotation = Math.sin(t * 1.2) * 0.02 + (this.haelt ? Math.sin(t * 3) * 0.04 : 0);
    }
  }

  // Runde wählen: Eier, Baustoff, Zwischenfall – jeweils nie zweimal dasselbe hintereinander
  waehle() {
    const z = this.erzwinge || {};
    this.v = VARIANTEN.find((v) => v.id === z.v) || pick(VARIANTEN.filter((v) => v.id !== this.letzte));
    this.stoffId = STOFFE[z.stoff] ? z.stoff : pick(Object.keys(STOFFE).filter((s) => s !== this.letzterStoff));
    this.extra = EXTRAS.includes(z.extra) ? z.extra : pick(EXTRAS.filter((x) => x !== this.letztesExtra));
    this.stoff = STOFFE[this.stoffId];
    this.letzte = this.v.id;
    this.letzterStoff = this.stoffId;
    this.letztesExtra = this.extra;
    store.set('teich.nestLetzte', this.letzte);
    store.set('teich.nestStoff', this.stoffId);
    store.set('teich.nestExtra', this.extra);
  }

  starte() {
    this.waehle();
    this.runden++;
    this.halme = 0;
    this.unterwegs = 0;
    this.waerme = 0;
    this.phase = 'kommt';
    const e = this.mama;
    e.modus = 'nest';
    e.v.x = 0;
    e.v.y = 0;
    this.ziel = { ...WARTE };
    // Reste der letzten Runde fort
    for (const st of this.stuecke) if (!st.s.destroyed) st.s.destroy();
    this.stuecke = [];
    this.deko.removeChildren().forEach((c) => c.destroy());
    // leeres, angefangenes Nest erscheint
    this.setzeStufe(0, true);
    for (const c of [this.hinten, this.vorn]) {
      killTweensOf(c);
      this.seite.tween(c, { alpha: 1 }, 1.2, { ease: 'sineInOut' });
    }
    this.flaeche.eventMode = 'static';
  }

  // Mama (und neue Küken) schwimmen weich zum Ziel
  schwimme(e, dt, t) {
    const dx = this.ziel.x - e.x;
    const dy = this.ziel.y - e.y;
    const d = Math.hypot(dx, dy);
    let vx = 0;
    let vy = 0;
    if (d > 8) {
      const v = 110 * clamp(d / 80, 0.3, 1);
      vx = (dx / d) * v;
      vy = (dy / d) * v;
    }
    const k = 1 - Math.exp(-dt * 2.2);
    e.v.x += (vx - e.v.x) * k;
    e.v.y += (vy - e.v.y) * k;
    e.x += e.v.x * dt;
    e.y += e.v.y * dt;
    this.seite.dreheSchwimmer(e, e.v.x, dt);
    this.seite.setzeSchwimmer(e, t);
    if (d < 14 && Math.hypot(e.v.x, e.v.y) < 20) this.angekommen();
  }

  angekommen() {
    if (this.phase === 'kommt') {
      this.phase = 'halme';
      laut('ente');
      fx.wobble(this.mama.c, 0.06);
      this.blase(this.stoff.bild, 3.5);
      this.legeStoffAus();
      this.sagHinweis('teich_nest', () => this.phase === 'halme' && this.halme === 0 && this.unterwegs === 0);
    } else if (this.phase === 'heim' && !this.zuhause) {
      // erst, wenn auch die neuen Küken im hinteren Wasser sind
      if (this.neue.every((k) => k.y < 905)) this.zuhauseAngekommen();
    }
  }

  sagHinweis(id, wann) {
    const passt = () => this.seite.aktiv && wann();
    this.seite.after(1.2, () => { if (passt()) voice(id, { nurWenn: passt }); });
  }

  // Denkblase über der wartenden Mama (die Enten sind keine Figuren mit bubble())
  blase(bild, sek) {
    this.blaseWeg();
    const e = this.mama;
    const c = new PIXI.Container({ label: 'nest:blase' });
    const m = meta('common/blase_denk');
    const schwanz = m.pts?.schwanz || [m.w * 0.1, m.h * 0.95];
    const innen = m.pts?.innen || [m.w * 0.55, m.h * 0.45];
    const grund = spr('common/blase_denk', { parent: c, anchor: { x: schwanz[0] / m.w, y: schwanz[1] / m.h } });
    const s = 300 / m.w;
    grund.scale.set(s);
    const b = spr(bild, { parent: c, anchor: 0.5 });
    b.scale.set(150 / Math.max(b.texture.width, b.texture.height));
    b.position.set((innen[0] - schwanz[0]) * s, (innen[1] - schwanz[1]) * s);
    // im Nest sitzt die Mama tiefer und kleiner: die Blase steht dann über ihrem Kopf
    const hoch = this.mamaImNest ? 300 : 330 * e.s;
    c.position.set(e.x + 60, e.y - hoch);
    c.zIndex = 3000;
    c.alpha = 0;
    c.scale.set(0.6);
    c.eventMode = 'none';
    this.seite.welt.addChild(c);
    this._blase = c;
    this.seite.tween(c, { alpha: 1 }, 0.35, { ease: 'sineInOut' });
    this.seite.tween(c, { scale: 1 }, 0.45, { ease: 'backOut' });
    this.seite.after(sek, () => this.blaseWeg(c));
  }

  blaseWeg(nur = null) {
    const c = this._blase;
    if (!c || c.destroyed || (nur && nur !== c)) return;
    this._blase = null;
    this.seite.tween(c, { alpha: 0 }, 0.45, { ease: 'sineInOut' }).then(() => { if (!c.destroyed) c.destroy({ children: true }); });
  }

  // ---------------------------------------------------------------- 1. Baustoff

  // je nach Baustoff liegen Stücke bereit (Schilf: am großen Schilf, Federn: auf dem Wasser; Blätter: an der Weide)
  legeStoffAus() {
    if (this.stoffId === 'schilf') this.schilfVorrat();
    else if (this.stoffId === 'federn') {
      WASSER_PLAETZE.forEach((p, i) => this.seite.after(i * 0.35, () => {
        if (this.phase === 'halme') this.neuesStueck(p.x, p.y, { erscheint: true });
      }));
    }
  }

  // ein geschnittener Halm lehnt am großen Schilf (kommt nach, solange noch Halme fehlen)
  schilfVorrat() {
    if (this.phase !== 'halme' || this.stoffId !== 'schilf') return;
    if (this.stuecke.some((st) => st.vorrat && st.zustand === 'schwimmt')) return;
    if (this.halme + this.unterwegs >= HALME) return;
    const st = this.neuesStueck(SCHILF_VORRAT.x, SCHILF_VORRAT.y, { erscheint: true });
    st.vorrat = true;
    st.dreh = 0.45;
  }

  /**
   * Neues Baustoff-Stück bei (x, y). amFinger: Ereignis eines Fingers – das Stück hängt gleich daran.
   * Ziehen oder Antippen bringt es immer ins Nest.
   */
  neuesStueck(x, y, { amFinger = null, erscheint = false } = {}) {
    const stoff = this.stoff;
    const s = spr(stoff.bild, { parent: this.seite.welt, x, y, anchor: 0.5 });
    s.scale.set(stoff.s);
    s.zIndex = 3100;
    const st = { s, x, y, zustand: 'schwimmt', phase: rand(0, 6), dreh: rand(-0.3, 0.3), gezaehlt: false };
    s.rotation = st.dreh;
    const r = 135 / stoff.s;   // Greiffläche ≈ 270 breit, unten knapp (70er-Rand frei)
    st.drag = drag(s, {
      lift: 1.12,
      hitArea: new PIXI.Rectangle(-r, -150 / stoff.s, 2 * r, 260 / stoff.s),
      back: false,
      onStart: () => this.stueckGegriffen(st),
      onDrop: (_, ctx) => this.stueckLos(st, ctx),
    });
    this.stuecke.push(st);
    if (erscheint) {
      s.alpha = 0;
      this.seite.tween(s, { alpha: 1 }, 0.6, { ease: 'sineInOut' });
      this.seite.ringe.ring(x, y + 10, 220);
    }
    if (amFinger) {
      const global = this.seite.welt.toGlobal({ x, y });
      s.emit('pointerdown', { pointerId: amFinger.pointerId, global, stopPropagation() {} });
      // hängt jetzt am Finger; seine Tippfläche soll keinen zweiten Finger schlucken
      s.eventMode = 'none';
    }
    return st;
  }

  stueckGegriffen(st) {
    if (st.gezaehlt) return;
    st.gezaehlt = true;
    st.zustand = 'zieht';
    this.unterwegs++;
    ton('common/rupf', { vol: 0.4 }, 0.2);
    if (st.vorrat) this.seite.after(0.8, () => this.schilfVorrat());
  }

  /** Vom Schilf (AmTeich) beim Berühren gerufen: true, wenn ein Halm entsteht und am Finger hängt. */
  halmVomSchilf(e) {
    if (this.phase !== 'halme' || this.stoffId !== 'schilf' || this.halme + this.unterwegs >= HALME) return false;
    this.neuesStueck(e.x, e.y, { amFinger: e });
    return true;
  }

  /** Von der Weide (AmTeich) beim Antippen gerufen: true, wenn ein Zweig herabsegelt. */
  blattVomBaum(e) {
    if (this.phase !== 'halme' || this.stoffId !== 'blaetter') return false;
    const liegen = this.stuecke.filter((st) => st.zustand === 'faellt' || st.zustand === 'schwimmt');
    if (this.halme + this.unterwegs + liegen.length >= HALME) return false;
    const frei = WASSER_PLAETZE.filter((p) => !liegen.some((st) => st.platz === p));
    const z = frei[0] || WASSER_PLAETZE[0];
    const x0 = clamp(e.x, WEIDE.x - 200, WEIDE.x + 200);
    const y0 = clamp(e.y, WEIDE.y - 80, WEIDE.y + 120);
    const st = this.neuesStueck(x0, y0);
    st.platz = z;
    st.zustand = 'faellt';
    st.s.eventMode = 'none';
    st.s.scale.set(this.stoff.s * 0.6);
    ton('common/rascheln', { vol: 0.5 }, 0.3);
    // segelt sanft hin und her schaukelnd herab (langsam, wie ein Blatt)
    const p = { t: 0 };
    this.seite.tween(p, { t: 1 }, 3.2, {
      ease: 'sineInOut',
      onUpdate: () => {
        if (st.s.destroyed) return;
        st.s.x = x0 + (z.x - x0) * p.t + Math.sin(p.t * Math.PI * 3) * 70 * (1 - p.t);
        st.s.y = y0 + (z.y - y0) * p.t;
        st.s.rotation = Math.sin(p.t * Math.PI * 3) * 0.5 * (1 - p.t);
        st.s.scale.set(this.stoff.s * (0.6 + 0.4 * p.t));
      },
    }).then((ok) => {
      if (!ok || st.s.destroyed || st.zustand !== 'faellt') return;
      st.zustand = 'schwimmt';
      st.x = z.x;
      st.y = z.y;
      st.dreh = 0;
      st.s.eventMode = 'static';
      this.seite.ringe.ring(z.x, z.y + 10, 240);
      ton('common/plopp', { vol: 0.4 }, 0.2);
    });
    return true;
  }

  // Stück losgelassen (oder angetippt): es landet immer am Nestrand
  stueckLos(st, ctx) {
    const s = st.s;
    if (s.destroyed || st.zustand === 'fliegt') return;
    if (!st.gezaehlt) this.stueckGegriffen(st);
    st.zustand = 'fliegt';
    st.drag?.off();
    s.eventMode = 'none';
    if (this.phase !== 'halme') { this.unterwegs = Math.max(0, this.unterwegs - 1); this.stueckWeg(st); return; }
    const n = Math.min(HALME, this.halme + 1);
    const platz = RAND_PLAETZE[this.halme % RAND_PLAETZE.length];
    const z = this.mulde(platz.x, platz.y, STUFEN[n]);
    const x0 = s.x;
    const y0 = s.y;
    const s0 = s.scale.x;
    const s1 = this.stoff.rest * STUFEN[n];
    const r0 = s.rotation;
    const weit = Math.hypot(z.x - x0, z.y - y0);
    const hoehe = ctx?.cancelled || weit < 150 ? 30 : 140;
    const p = { t: 0 };
    this.seite.tween(p, { t: 1 }, flugDauer(z.x - x0, z.y - y0, { hoehe, ease: 'sine', min: 0.4, v: 1000 }), {
      ease: 'sineInOut',
      onUpdate: () => {
        if (s.destroyed) return;
        s.x = x0 + (z.x - x0) * p.t;
        s.y = y0 + (z.y - y0) * p.t - hoehe * 4 * p.t * (1 - p.t);
        s.scale.set(s0 + (s1 - s0) * p.t);
        s.rotation = r0 + (platz.r - r0) * p.t;
      },
    }).then((ok) => {
      if (!ok || s.destroyed) return;
      this.unterwegs = Math.max(0, this.unterwegs - 1);
      this.stuecke = this.stuecke.filter((x) => x !== st);
      if (this.phase !== 'halme') { s.destroy(); return; }
      // bleibt am Nestrand liegen (im Nest-Container: wächst mit)
      s.removeFromParent();
      const m = NEST_MASSE;
      const i = this.halme % RAND_PLAETZE.length;
      const pl = RAND_PLAETZE[i];
      s.position.set(pl.x - m.w * m.ax, pl.y - m.h * m.ay);
      s.scale.set(this.stoff.rest / NEST.s);
      s.rotation = pl.r;
      this.deko.addChild(s);
      this.halme++;
      this.setzeStufe(this.halme);
      ton('common/rascheln', { vol: 0.5 }, 0.2);
      this.seite.burst(this.stoffId === 'federn' ? 'funkeln' : 'blaetter', NEST.x, NEST.y - 150, { count: 3 });
      if (this.halme >= HALME) this.nestFertig();
    });
  }

  stueckWeg(st) {
    const s = st.s;
    this.stuecke = this.stuecke.filter((x) => x !== st);
    if (s.destroyed) return;
    s.eventMode = 'none';
    st.drag?.off();
    this.seite.tween(s, { alpha: 0 }, 0.6, { ease: 'sineInOut' }).then(() => { if (!s.destroyed) s.destroy(); });
  }

  nestFertig() {
    this.phase = 'einziehen';
    // übrige Stücke (auf dem Wasser, am Schilf, noch im Fallen) werden nicht mehr gebraucht
    for (const st of [...this.stuecke]) if (st.zustand !== 'fliegt' && st.zustand !== 'zieht') this.stueckWeg(st);
    this.seite.after(0.5, () => {
      ton('common/funkeln', { vol: 0.45 }, 0.3);
      this.seite.burst('funkeln', NEST.x, NEST.y - 160, { count: 6 });
      laut('ente');
      fx.wobble(this.mama.c, 0.08);
      this.blase('teich/nest', 3);
    });
  }

  // ---------------------------------------------------------------- 2. Mama zieht ein, Eier

  /** AmTeich ruft das beim Antippen einer Ente: true = hier verarbeitet */
  enteGetippt(e) {
    if (e !== this.mama || e.modus !== 'nest') return false;
    if (this.phase === 'einziehen' && !this.mamaSpringt) { this.mamaInsNest(); return true; }
    if (this.mamaImNest) {
      // wer die Mama über den Eiern antippt, meint meist die Eier: das hilft genauso weiter
      if (this.phase === 'eier') { this.eiGetippt(null); return true; }
      if (this.phase === 'regen' && this.schirm?.zustand === 'schwimmt') { this.schirmAuf(); return true; }
      laut('ente');
      fx.wobble(e.c, 0.06);
      if (this.phase === 'waermen') this.halten(0.35);
      return true;
    }
    return false;
  }

  // Mama-Bild ohne Wasser (an Land): Größe fest, Welle weg
  setzeLand(e, s) {
    e.s = s;
    e.c.position.set(e.x, e.y);
    e.bild.scale.set(s * e.sx, s);
    e.bild.y = e.hops.y;
  }

  bogen(e, zx, zy, s1, dauer, hoehe) {
    const x0 = e.x;
    const y0 = e.y;
    const s0 = e.s;
    const p = { t: 0 };
    return this.seite.tween(p, { t: 1 }, dauer, {
      ease: 'sineInOut',
      onUpdate: () => {
        e.x = x0 + (zx - x0) * p.t;
        e.y = y0 + (zy - y0) * p.t;
        e.hops.y = -hoehe * 4 * p.t * (1 - p.t);
        this.setzeLand(e, s0 + (s1 - s0) * p.t);
      },
    });
  }

  async mamaInsNest() {
    const e = this.mama;
    this.mamaSpringt = true;
    this.blaseWeg();
    ton('common/hupf', { vol: 0.5 });
    this.seite.ringe.ring(e.x, e.y, 300 * e.s);
    e.welle.visible = false;
    e.blick = -1;
    e.sx = -1;
    e.c.zIndex = NEST.y - 100;
    const z = this.mulde(213, MULDE_Y + 6);
    const ok = await this.bogen(e, z.x + 20, z.y, MAMA_LAND, 0.8, 120);
    if (!ok) return;
    e.hops.y = 0;
    this.mamaSpringt = false;
    this.mamaImNest = true;
    ton('common/landen', { vol: 0.5 }, 0.2);
    this.seite.burst('blaetter', NEST.x, NEST.y - 120, { count: 3 });
    // sich einkuscheln, ein bisschen aufstehen – da liegen die Eier
    await this.seite.wait(0.5);
    laut('ente');
    const v = this.v;
    const n = v.eier;
    const xs = n === 2 ? [-58, 58] : n === 3 ? [-88, 0, 88] : [-105, -36, 36, 105];
    const besonders = v.gold || v.gummi ? Math.floor(rand(0, n)) : -1;
    this.eier = [];
    for (let i = 0; i < n; i++) {
      const hinten = n === 4 ? (i === 1 || i === 2) : i === 1;
      const zx = z.x + xs[i];
      const zy = z.y + (hinten ? -8 : 6);
      const s = spr(v.bild, { parent: this.seite.welt, x: zx, y: zy });
      const gold = v.gold && i === besonders;
      s.tint = gold ? 0xffcf4a : v.farbe;
      s.scale.set(0);
      s.zIndex = NEST.y - 40 + (hinten ? 0 : 10);
      s.eventMode = 'none';
      const ei = { s, x: zx, y: zy, stufe: 0, gold, gummi: v.gummi && i === besonders, phase: rand(0, 3),
        dreh: rand(-0.06, 0.06), skala: EI_S * (hinten ? 0.93 : 1) * (n === 4 ? 0.9 : 1) };
      this.eier.push(ei);
      this.seite.after(0.25 + i * 0.35, () => {
        this.seite.tween(s, { scale: ei.skala }, 0.4, { ease: 'backOut' });
        ton('common/plopp', { vol: 0.45 }, 0.1);
        if (gold) this.seite.burst('funkeln', zx, zy - 50, { count: 4 });
      });
    }
    // die Mama rückt nach hinten, die Eier liegen vor ihr
    this.seite.tween(e, { y: z.y - 26 }, 0.5, { ease: 'sineInOut', onUpdate: () => this.setzeLand(e, e.s) });
    await this.seite.wait(0.4 + n * 0.35);
    if (this.extra === 'regen') this.regenKommt();
    else this.waermenBeginnt();
  }

  // ---------------------------------------------------------------- Zwischenfall: Regenschauer

  regenKommt() {
    this.phase = 'regen';
    const w = this.wolke;
    killTweensOf(w);
    w.position.set(-1500, WOLKE.y - 40);
    w.alpha = 0;
    w.visible = true;
    w.eventMode = 'static';
    if (!this._wolkeTap) {
      // Antippen: die Wolke plustert sich (helfen tut der Schirm)
      w.on('pointerdown', () => { fx.pop(w, 0.06); ton('common/wusch', { vol: 0.25 }, 0.8); });
      w.hitArea = new PIXI.Ellipse(0, 0, 420, 330);
      this._wolkeTap = true;
    }
    this.seite.tween(w, { alpha: 1 }, 1.0, { ease: 'sineInOut' });
    this.seite.tween(w, { x: WOLKE.x, y: WOLKE.y }, 3.2, { ease: 'sineInOut' }).then((ok) => {
      if (!ok || this.phase !== 'regen') return;
      this.regnet = true;
      laut('ente');
      fx.wobble(this.mama.c, 0.08);
      this.blase('teich/seerosenblatt', 4);
      // ein freies Seerosenblatt treibt am Ufer: das ist der Schirm
      const s = spr('teich/seerosenblatt', { parent: this.seite.welt, x: SCHIRM_START.x, y: SCHIRM_START.y, anchor: 0.5 });
      s.scale.set(0.42);
      s.zIndex = 3100;
      s.alpha = 0;
      this.seite.tween(s, { alpha: 1 }, 0.6, { ease: 'sineInOut' });
      this.seite.ringe.ring(SCHIRM_START.x, SCHIRM_START.y + 10, 300);
      const sch = { s, zustand: 'schwimmt' };
      this.schirm = sch;
      sch.drag = drag(s, {
        lift: 1.1,
        hitArea: new PIXI.Rectangle(-140 / 0.42, -140 / 0.42, 280 / 0.42, 230 / 0.42),
        back: false,
        onStart: () => { sch.zustand = 'zieht'; ton('common/rupf', { vol: 0.35 }, 0.3); },
        onDrop: () => this.schirmAuf(),
      });
    });
  }

  // Ort des Schirms: über dem Kopf der Mama im Nest
  schirmOrt() {
    const e = this.mama;
    return { x: e.x - 30, y: e.y - 255 };
  }

  schirmAuf() {
    const sch = this.schirm;
    if (!sch || sch.zustand === 'fliegt' || sch.zustand === 'auf' || sch.s.destroyed) return;
    sch.zustand = 'fliegt';
    sch.drag?.off();
    const s = sch.s;
    s.eventMode = 'none';
    const z = this.schirmOrt();
    const x0 = s.x;
    const y0 = s.y;
    const s0 = s.scale.x;
    const r0 = s.rotation;
    const p = { t: 0 };
    this.seite.tween(p, { t: 1 }, flugDauer(z.x - x0, z.y - y0, { hoehe: 60, ease: 'sine', min: 0.5, v: 1000 }), {
      ease: 'sineInOut',
      onUpdate: () => {
        if (s.destroyed) return;
        s.x = x0 + (z.x - x0) * p.t;
        s.y = y0 + (z.y - y0) * p.t - 60 * 4 * p.t * (1 - p.t);
        s.scale.set(s0 + (0.6 - s0) * p.t);
        s.rotation = r0 + (-0.12 - r0) * p.t;
      },
    }).then((ok) => {
      if (!ok || s.destroyed) return;
      sch.zustand = 'auf';
      s.zIndex = NEST.y + 20;
      ton('common/plopp', { vol: 0.5 }, 0.2);
      laut('ente');
      fx.wobble(this.mama.c, 0.06);
      this.seite.burst('herzen', z.x, z.y - 40, { count: 3 });
      // der Schauer hört auf, die Wolke zieht weiter, ein Regenbogen steht am Himmel
      this.seite.after(1.6, () => this.regenVorbei());
    });
  }

  regenVorbei() {
    this.regnet = false;
    const w = this.wolke;
    w.eventMode = 'none';
    killTweensOf(w);
    this.seite.tween(w, { x: WOLKE.x + 700, y: WOLKE.y - 120 }, 3.2, { ease: 'sineInOut' });
    this.seite.tween(w, { alpha: 0 }, 1.6, { ease: 'sineInOut', delay: 1.6 }).then((ok) => { if (ok) w.visible = false; });
    this.seite.after(0.8, () => {
      const rb = spr('common/regenbogen', { parent: this.seite.welt, x: -330, y: 520, anchor: 0.5 });
      rb.scale.set(0.6);
      rb.alpha = 0;
      rb.zIndex = -95;
      rb.eventMode = 'none';
      this.seite.tween(rb, { alpha: 0.85 }, 1.4, { ease: 'sineInOut' })
        .then((ok) => { if (ok) this.seite.tween(rb, { alpha: 0 }, 1.8, { ease: 'sineInOut', delay: 3 }).then(() => { if (!rb.destroyed) rb.destroy(); }); });
      note('glocke', 79, { vol: 0.3 });
      this.seite.after(0.3, () => note('glocke', 84, { vol: 0.3 }));
      this.seite.after(0.6, () => note('glocke', 88, { vol: 0.3 }));
    });
    // der Schirm gleitet zurück aufs Wasser und verblasst
    this.seite.after(2.4, () => {
      const sch = this.schirm;
      this.schirm = null;
      if (sch && !sch.s.destroyed) {
        const s = sch.s;
        this.seite.tween(s, { x: SCHIRM_START.x, y: SCHIRM_START.y, scale: 0.42, rotation: 0 }, 1.4, { ease: 'sineInOut' });
        this.seite.tween(s, { alpha: 0 }, 1.0, { ease: 'sineInOut', delay: 0.8 }).then(() => { if (!s.destroyed) s.destroy(); });
      }
      this.waermenBeginnt();
    });
  }

  // Tropfen fallen gemächlich aus der Wolke; mit Schirm bleiben sie auf dem Blatt liegen
  updateRegen(dt) {
    const w = this.wolke;
    if (this.regnet) {
      this.tropfUhr -= dt;
      if (this.tropfUhr <= 0) {
        const tr = this.tropfen.find((x) => !x.g.visible);
        if (tr) {
          tr.g.position.set(w.x + rand(-110, 110), w.y + 50);
          tr.g.alpha = 0.9;
          tr.g.visible = true;
          tr.vy = rand(360, 440);
          const sch = this.schirm;
          const aufsBlatt = sch && sch.zustand === 'auf' && Math.abs(tr.g.x - sch.s.x) < 120;
          tr.bis = aufsBlatt ? sch.s.y - 25 : rand(1180, 1330);
        }
        this.tropfUhr = 0.13;
      }
    }
    for (const tr of this.tropfen) {
      if (!tr.g.visible) continue;
      tr.g.y += tr.vy * dt;
      if (tr.g.y >= tr.bis) tr.g.visible = false;
    }
  }

  // ---------------------------------------------------------------- 3. Wärmen, 4. Schlüpfen

  waermenBeginnt() {
    this.phase = 'waermen';
    this.waerme = 0;
    this.blase('common/p_herz', 3.5);
    this.sagHinweis('teich_waermen', () => this.phase === 'waermen' && this.waerme < 0.15);
  }

  nestBeruehrt() {
    const d = this.druck;
    this.druck = null;
    if (this.phase === 'einziehen') {
      if (!this.mamaSpringt) this.mamaInsNest();
    } else if (this.phase === 'waermen') {
      this.haelt = true;
      this.halten(0.3);   // auch kurzes Tippen wärmt ein Stück (Halten ist keine Pflicht)
    } else if (this.phase === 'eier') {
      this.eiGetippt(d);
    } else if (this.phase === 'hunger') {
      // hungrige Küken piepen und recken sich (die Hand zeigt aufs Brot)
      ton('common/kueken', { vol: 0.55 }, 0.4);
      fx.wobble(this.hinten, 0.03);
    } else if (this.mamaImNest) {
      laut('ente');
    } else {
      ton('common/rascheln', { vol: 0.4 }, 0.4);
      fx.wobble(this.hinten, 0.04);
    }
  }

  halten(dt) {
    if (this.phase !== 'waermen') return;
    const vorher = this.waerme;
    this.waerme = Math.min(1, this.waerme + dt / WAERME_DAUER);
    this.glanz.alpha = Math.max(0.24, this.waerme * 0.9);
    // alle halbe Sekunde ein paar Herzen und ein Ton, der mit der Wärme steigt
    const stufe = Math.floor(this.waerme * 5);
    if (stufe > Math.floor(vorher * 5) || vorher === 0) {
      this.seite.burst('herzen', NEST.x + rand(-60, 60), NEST.y - 260, { count: 2 });
      note('glocke', [72, 74, 76, 79, 81, 84][Math.min(5, stufe)], { vol: 0.3 });
    }
    if (this.waerme >= 1) this.warm();
  }

  warm() {
    this.phase = 'eier';
    this.haelt = false;
    killTweensOf(this.glanz);
    this.seite.tween(this.glanz, { alpha: 0 }, 1.5, { ease: 'sineInOut' });
    laut('ente');
    ton('common/funkeln', { vol: 0.4 }, 0.3);
    this.seite.burst('funkeln', NEST.x, NEST.y - 140, { count: 5 });
  }

  // das (noch nicht geschlüpfte) Ei, das dem Finger am nächsten ist
  eiGetippt(p) {
    const offen = this.eier.filter((ei) => ei.stufe < 2);
    if (!offen.length) return;
    const ort = p || { x: NEST.x, y: NEST.y - 120 };
    const ei = offen.reduce((a, b) => (Math.abs(a.x - ort.x) <= Math.abs(b.x - ort.x) ? a : b));
    if (ei.stufe === 0) this.reisse(ei);
    else this.schluepfe(ei);
  }

  reisse(ei) {
    ei.stufe = 1;
    ton('common/klack', { vol: 0.55 }, 0.15);
    fx.wobble(ei.s, 0.15);
    // Zickzack-Riss quer übers Ei (in Bildpunkten des Eis)
    const w = ei.s.texture.width;
    const h = ei.s.texture.height;
    const g = new PIXI.Graphics();
    const y = -h * 0.55;
    g.moveTo(-w * 0.42, y);
    for (let i = 1; i <= 6; i++) g.lineTo(-w * 0.42 + (w * 0.84 * i) / 6, y + (i % 2 ? -18 : 14));
    g.stroke({ width: 9, color: 0x8a6a4a, alpha: 0.85, cap: 'round', join: 'round' });
    ei.s.addChild(g);
  }

  schluepfe(ei) {
    ei.stufe = 2;
    const s = ei.s;
    killTweensOf(s);
    this.seite.tween(s, { alpha: 0, scale: ei.skala * 1.15 }, 0.3, { ease: 'sineInOut' }).then(() => { if (!s.destroyed) s.destroy({ children: true }); });
    const schale = spr('teich/eierschale', { parent: this.seite.welt, x: ei.x, y: ei.y + 4 });
    schale.scale.set(EI_S * 0.95);
    schale.tint = ei.gold ? 0xffcf4a : this.v.bild === 'teich/ei' ? this.v.farbe : 0xffffff;
    schale.zIndex = s.zIndex + 2;
    schale.eventMode = 'none';
    ei.schale = schale;
    // wer schlüpft?
    const id = ei.gummi ? 'teich/gummiente' : 'teich/kueken_schwimmt';
    const k = spr(id, { parent: this.seite.welt, x: ei.x, y: ei.y - 18, anchor: { x: 0.5, y: 0.98 } });
    k.zIndex = s.zIndex + 1;
    const ziel = ei.gummi ? GUMMI_S : KUEKEN_S;
    k.scale.set(0);
    k.basis = ziel;
    ei.kueken = k;
    this.seite.tween(k, { scale: ziel }, 0.45, { ease: 'backOut' });
    this.seite.burst('funkeln', ei.x, ei.y - 70, { count: ei.gold ? 7 : 3 });
    if (ei.gummi) this.gummiQuietscht(ei);
    else {
      ton('common/kueken', { vol: 0.65 }, 0.2);
      if (ei.gold) {
        note('glocke', 84, { vol: 0.35 });
        this.seite.after(0.2, () => note('glocke', 88, { vol: 0.35 }));
      }
    }
    if (this.eier.every((x) => x.stufe === 2)) this.seite.after(1.2, () => this.allesGeschluepft());
  }

  // Die Gummiente: glänzt, quietscht und hüpft zweimal – ganz anders als ein Küken
  gummiQuietscht(ei) {
    const k = ei.kueken;
    const glanz = new PIXI.Graphics()
      .ellipse(0, 0, 30, 15).fill({ color: 0xffffff, alpha: 0.55 })
      .ellipse(34, 10, 9, 6).fill({ color: 0xffffff, alpha: 0.45 });
    glanz.position.set(-40, -235);
    glanz.rotation = -0.45;
    k.addChild(glanz);
    const y0 = ei.y - 18;
    const sprung = (wann, ton1) => this.seite.after(wann, () => {
      if (k.destroyed || ei.imWasser) return;
      note('floete', ton1, { vol: 0.5, dauer: 0.18 });
      this.seite.burst('funkeln', ei.x, y0 - 120, { count: 2 });
      this.seite.tween(k, { y: y0 - 55 }, 0.22, { ease: 'quadOut' })
        .then((ok) => { if (ok && !k.destroyed) this.seite.tween(k, { y: y0 }, 0.4, { ease: 'bounceOut' }); });
    });
    sprung(0.45, 86);
    sprung(1.2, 91);
    this.seite.after(1.9, () => { fx.wobble(this.mama.c, 0.1); laut('ente'); });
  }

  allesGeschluepft() {
    if (this.phase !== 'eier') return;
    const hungrige = this.eier.filter((ei) => ei.kueken && !ei.gummi);
    if (this.extra === 'hunger' && hungrige.length) this.hungerBeginnt(hungrige);
    else this.zumWasser();
  }

  // ---------------------------------------------------------------- Zwischenfall: Hunger

  hungerBeginnt(liste) {
    this.phase = 'hunger';
    for (const ei of liste) ei.hungrig = true;
    ton('common/kueken', { vol: 0.6 }, 0.3);
    this.blase('teich/kruemel', 4);
  }

  /**
   * AmTeich fragt, bevor ein Krümel zu den Enten geht: Haben die Küken im Nest Hunger, bekommt er ein Küken.
   * tipp = das Brot wurde nur angetippt (der Krümel fliegt dann von selbst). → true, wenn hier verarbeitet.
   */
  kruemelFuerKueken(k, x, y, tipp) {
    if (this.phase !== 'hunger') return false;
    if (!tipp && Math.hypot(x - NEST.x, y - (NEST.y - 150)) > 560) return false;
    const offen = this.eier.filter((ei) => ei.hungrig && !ei.bekommt && ei.kueken && !ei.kueken.destroyed);
    if (!offen.length) return false;
    const ei = offen.reduce((a, b) => (Math.abs(a.x - x) <= Math.abs(b.x - x) ? a : b));
    ei.bekommt = true;
    killTweensOf(k);
    k.eventMode = 'none';
    const kk = ei.kueken;
    const zx = ei.x - 20;
    const zy = ei.y - 70;
    const x0 = k.x;
    const y0 = k.y;
    const s0 = k.scale.x;
    const p = { t: 0 };
    ton('common/wusch', { vol: 0.25 }, 0.3);
    this.seite.tween(p, { t: 1 }, flugDauer(zx - x0, zy - y0, { hoehe: 110, ease: 'sine', min: 0.45, v: 1000 }), {
      ease: 'sineInOut',
      onUpdate: () => {
        if (k.destroyed) return;
        k.x = x0 + (zx - x0) * p.t;
        k.y = y0 + (zy - y0) * p.t - 110 * 4 * p.t * (1 - p.t);
        k.scale.set(s0 + (0.22 - s0) * p.t);
      },
    }).then((ok) => {
      if (!ok) return;
      if (!k.destroyed) this.seite.tween(k, { alpha: 0, scale: 0.08 }, 0.3, { ease: 'sineInOut' }).then(() => { if (!k.destroyed) k.destroy(); });
      ei.hungrig = false;
      ton('common/mampf', { vol: 0.55 }, 0.2);
      this.seite.after(0.25, () => ton('common/kueken', { vol: 0.6 }, 0.2));
      this.seite.burst('herzen', ei.x, ei.y - 150, { count: 2 });
      if (!kk.destroyed) {
        const ky = ei.y - 18;
        this.seite.tween(kk, { y: ky - 45 }, 0.2, { ease: 'quadOut' })
          .then((ok2) => { if (ok2 && !kk.destroyed) this.seite.tween(kk, { y: ky }, 0.4, { ease: 'bounceOut' }); });
      }
      if (this.phase === 'hunger' && this.eier.every((x) => !x.hungrig)) {
        this.seite.after(0.9, () => { if (this.phase === 'hunger') { laut('ente'); this.zumWasser('hunger'); } });
      }
    });
    return true;
  }

  // ---------------------------------------------------------------- 5. Ins Wasser

  async zumWasser(von = 'eier') {
    if (this.phase !== von) return;
    this.phase = 'insWasser';
    this.flaeche.eventMode = 'none';   // die Küken liegen jetzt obenauf und werden gegriffen
    const e = this.mama;
    // Mama hüpft ins Wasser und wartet auf ihre Küken
    this.mamaImNest = false;
    this.mamaSpringt = true;
    // sie schaut weiter zum Nest (die Küken kommen von dort); umdrehen tut sie sich erst im Wasser
    e.blick = -1;
    ton('common/hupf', { vol: 0.5 });
    const ok = await this.bogen(e, WARTE.x, WARTE.y, this.seite.schwimmGroesse(WARTE.y), 0.8, 120);
    if (!ok) return;
    e.hops.y = 0;
    e.bild.rotation = 0;
    this.mamaSpringt = false;
    e.welle.visible = true;
    this.ziel = { ...WARTE };
    this.seite.ringe.ring(e.x, e.y, 360 * e.s);
    ton('common/platsch', { vol: 0.4 }, 0.2);
    laut('ente');
    this.blase('teich/kueken_schwimmt', 3);
    // Küken greifbar machen; die Gummiente hüpft gleich selbst ins Wasser und paddelt davon
    for (const ei of this.eier) {
      if (!ei.kueken) continue;
      if (ei.gummi) { this.seite.after(0.6, () => this.gummiWeg(ei)); continue; }
      this.machGreifbar(ei);
    }
    this.sagHinweis('teich_kueken', () => this.phase === 'insWasser' && this.neue.length === 0);
  }

  machGreifbar(ei) {
    const k = ei.kueken;
    k.y = ei.y - 18;
    ei.drag = drag(k, {
      lift: 1.12,
      hitArea: new PIXI.Rectangle(-150 / KUEKEN_S, -230 / KUEKEN_S, 300 / KUEKEN_S, 250 / KUEKEN_S),
      back: false,
      onStart: () => { ton('common/kueken', { vol: 0.5 }, 0.4); },
      onDrop: (_, ctx) => {
        const bewegt = Math.hypot(ctx.x - ctx.startX, ctx.y - ctx.startY);
        // getippt, ins Wasser gezogen oder einfach ein gutes Stück vom Nest weg: es hüpft zur Mama
        const weitWeg = Math.hypot(k.x - NEST.x, k.y - (NEST.y - 110)) > 240;
        if (bewegt < 40 || weitWeg || this.wasser.contains(k.x, k.y) || k.y < 1150) { this.insWasser(ei); return; }
        // aufs Gras gelegt: hüpft zurück in seine Schale
        this.seite.tween(k, { x: ei.x, y: ei.y - 18 }, 0.45, { ease: 'sineInOut' });
      },
    });
  }

  // Küken hüpft ins Wasser und wird ein Schwimmer hinter der Mama
  insWasser(ei) {
    const k = ei.kueken;
    if (!k || k.destroyed || ei.imWasser) return;
    ei.imWasser = true;
    ei.drag?.off();
    k.eventMode = 'none';
    const e = this.mama;
    const n = this.neue.length;
    const zx = e.x - e.blick * (130 + n * 85) * (e.s / 0.45);
    const zy = clamp(e.y + 6, 700, 1250);
    const x0 = k.x;
    const y0 = k.y;
    const s0 = k.scale.x;
    const s1 = this.seite.schwimmGroesse(zy) * 0.92;
    const p = { t: 0 };
    k.zIndex = 4000;
    ton('common/hupf', { vol: 0.4 }, 0.2);
    this.seite.tween(p, { t: 1 }, flugDauer(zx - x0, zy - y0, { hoehe: 110, ease: 'sine', min: 0.6, v: 1000 }), {
      ease: 'sineInOut',
      onUpdate: () => {
        if (k.destroyed) return;
        k.x = x0 + (zx - x0) * p.t;
        k.y = y0 + (zy - y0) * p.t - 110 * 4 * p.t * (1 - p.t);
        k.scale.set(s0 + (s1 - s0) * p.t);
      },
    }).then((ok) => {
      if (!ok || k.destroyed) return;
      k.destroy();
      const w = this.seite.neuesKueken(e, zx, zy);
      this.neue.push(w);
      this.seite.ringe.ring(zx, zy, 200);
      ton('common/platsch', { vol: 0.3, rate: 1.2 }, 0.2);
      if (ei.schale && !ei.schale.destroyed) {
        const sch = ei.schale;
        this.seite.tween(sch, { alpha: 0 }, 0.8, { ease: 'sineInOut' }).then(() => { if (!sch.destroyed) sch.destroy(); });
      }
      if (this.eier.every((x) => !x.kueken || x.gummi || x.imWasser)) this.seite.after(0.8, () => this.heimwaerts());
    });
  }

  gummiWeg(ei) {
    const k = ei.kueken;
    if (!k || k.destroyed) return;
    ei.imWasser = true;
    const zx = WARTE.x + 160;
    const zy = 1290;
    const x0 = k.x;
    const y0 = k.y;
    const p = { t: 0 };
    k.zIndex = 4000;
    note('floete', 88, { vol: 0.45, dauer: 0.18 });
    this.seite.tween(p, { t: 1 }, 0.8, {
      ease: 'sineInOut',
      onUpdate: () => {
        if (k.destroyed) return;
        k.x = x0 + (zx - x0) * p.t;
        k.y = y0 + (zy - y0) * p.t - 120 * 4 * p.t * (1 - p.t);
      },
    }).then((ok) => {
      if (!ok || k.destroyed) return;
      this.seite.ringe.ring(zx, zy, 240);
      ton('common/platsch', { vol: 0.3, rate: 1.3 }, 0.2);
      k.zIndex = zy;
      // paddelt gemütlich nach rechts davon und verblasst
      this.seite.tween(k, { x: zx + 520 }, 9, { ease: 'sineInOut' });
      this.seite.tween(k, { alpha: 0 }, 2, { ease: 'sineInOut', delay: 7 }).then(() => { if (!k.destroyed) k.destroy({ children: true }); });
      if (ei.schale && !ei.schale.destroyed) {
        const sch = ei.schale;
        this.seite.tween(sch, { alpha: 0 }, 0.8, { ease: 'sineInOut' }).then(() => { if (!sch.destroyed) sch.destroy(); });
      }
      if (this.eier.every((x) => !x.kueken || x.gummi || x.imWasser) && this.neue.length) this.seite.after(0.8, () => this.heimwaerts());
    });
  }

  // neue Küken schwimmen in einer Reihe hinter der Mama (wie in AmTeich, ohne Band-Grenzen)
  folgen(dt, t) {
    const e = this.mama;
    let vor = e;
    for (const kk of this.neue) {
      const abstand = (vor === e ? 125 : 85) * (e.s / 0.45);
      const zx = vor.x - e.blick * abstand;
      const zy = vor.y + 4;
      const dx = zx - kk.x;
      const dy = zy - kk.y;
      const d = Math.hypot(dx, dy);
      let vx = 0;
      if (d > 1) {
        const v = Math.min(115, d * 2.6);
        vx = (dx / d) * v;
        kk.x += vx * dt;
        kk.y += (dy / d) * v * dt;
      }
      this.seite.dreheSchwimmer(kk, vx, dt);
      this.seite.setzeSchwimmer(kk, t);
      vor = kk;
    }
  }

  // ---------------------------------------------------------------- 6. Heim

  heimwaerts() {
    if (this.phase !== 'insWasser') return;
    this.phase = 'heim';
    this.zuhause = false;
    const e = this.mama;
    laut('ente');
    // zu den großen Küken (hinten), knapp vor die erste
    const erste = e.kueken[0];
    const x = erste ? clamp(erste.x + 150, e.revier[0] + 120, e.revier[1]) : -560;
    this.ziel = { x, y: 860 };
    // Nest bleibt kurz stehen, dann blendet es weich aus
    this.seite.after(5, () => this.nestWeg());
  }

  zuhauseAngekommen() {
    this.zuhause = true;
    const e = this.mama;
    const seite = this.seite;
    const andere = seite.enten[1];
    // die Familien wachsen langsam: je Runde höchstens ein Küken mehr
    const darf = Math.min(KUEKEN_MAX, e.kueken.length + 1);
    const darfAndere = Math.min(KUEKEN_MAX, andere.kueken.length + 1);
    for (const k of this.neue) e.kueken.push(k);
    const geschluepft = this.neue.length;
    this.neue = [];
    e.modus = 'schwimmt';
    e.ziel.x = e.x;
    e.ziel.y = clamp(e.y, 705, 900);
    e.pause = 2;
    e.welle.visible = true;
    // zu viele? die ältesten schwimmen zur anderen Familie (oder, wenn auch die gewachsen ist, hinaus in die Welt)
    while (e.kueken.length > darf) {
      const alt = e.kueken.shift();
      if (andere.kueken.length < darfAndere) { alt.mutter = andere; andere.kueken.push(alt); }
      else seite.kuekenZiehtWeg(alt);
    }
    store.set('teich.kueken', [e.kueken.length, andere.kueken.length]);
    // Freude: Herzen, alle Küken hüpfen
    seite.freueFamilie(e);
    seite.after(0.8, () => {
      if (geschluepft) belohne(seite, naechsterSticker('tier_ente', ['tier_ente', 'teich_seerose']), 0, 400);
    });
    this.phase = 'ruhe';
    this.uhr = rand(...PAUSE);
    seite.verteileKruemel();
  }

  nestWeg() {
    this.flaeche.eventMode = 'none';
    for (const c of [this.hinten, this.vorn]) {
      killTweensOf(c);
      this.seite.tween(c, { alpha: 0 }, 1.5, { ease: 'sineInOut' }).then((ok) => {
        if (ok && c === this.vorn && this.phase === 'ruhe') this.deko.removeChildren().forEach((d) => d.destroy());
      });
    }
    for (const ei of this.eier) {
      for (const s of [ei.schale, ei.kueken]) {
        if (s && !s.destroyed && !ei.gummi) this.seite.tween(s, { alpha: 0 }, 1.2, { ease: 'sineInOut' }).then(() => { if (!s.destroyed) s.destroy(); });
      }
    }
    this.eier = [];
  }

  // ---------------------------------------------------------------- Zeige-Hand

  hinweis() {
    const p = this.phase;
    const nest = this.mulde(213, 200, STUFEN[Math.min(HALME, this.halme)]);
    if (p === 'halme') {
      const liegt = this.stuecke.find((st) => st.zustand === 'schwimmt' && !st.s.destroyed && st.s.alpha > 0.5);
      if (liegt) return { von: liegt.s, nach: nest };
      if (this.stoffId === 'blaetter') return { x: WEIDE.x, y: WEIDE.y + 40 };   // die Weide antippen
      if (this.stoffId === 'schilf') return this.seite.schilf[0];
      return null;
    }
    if (p === 'einziehen') return this.mama.c;
    if (p === 'regen') {
      const sch = this.schirm;
      return sch && sch.zustand === 'schwimmt' && !sch.s.destroyed ? { von: sch.s, nach: this.mama.c } : null;
    }
    if (p === 'waermen') return this.nestBild;
    if (p === 'eier') {
      const ei = this.eier.find((x) => x.stufe < 2);
      return ei ? ei.s : null;
    }
    if (p === 'hunger') {
      const ei = this.eier.find((x) => x.hungrig && !x.bekommt && x.kueken && !x.kueken.destroyed);
      return ei ? { von: this.seite.brot, nach: ei.kueken } : null;
    }
    if (p === 'insWasser') {
      const ei = this.eier.find((x) => x.kueken && !x.gummi && !x.imWasser && !x.kueken.destroyed);
      return ei ? { von: ei.kueken, nach: this.mama.c } : null;
    }
    return null;
  }

  /** Läuft gerade eine Runde (Kind ist mittendrin)? */
  get laeuft() {
    return this.phase !== 'ruhe' && this.phase !== 'kommt' && this.phase !== 'heim';
  }
}
