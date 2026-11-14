// Seite 3: Über den Wolken. Der zuletzt gestartete Flieger (Seite 2) fliegt gemächlich über das Wolkenmeer.
// Steuern: den Flieger mit dem Finger ziehen – oder irgendwo in den Himmel tippen, dann fliegt er dorthin
// (höchstens 700 Einheiten/s, sanft gebremst, leicht geneigt).
// Ablauf einer Reise (jede Runde anders gemischt):
//   zwei Begegnungen aus drei (Regenwolke → Regenbogen, Vogelschwarm fliegt mit, Ballon mit winkendem Tier) –
//   hinfliegen oder antippen → dann schwebt ein Reiseziel heran (Meer, Berge, Schnee, Insel; nie zweimal
//   hintereinander dasselbe) → zur Landebahn fliegen (Ring) → sanft landen und ausrollen → die Gäste hüpfen hinaus
//   → eine Postkarte vom Ziel fliegt zur Pinnwand (Seite 1) → den Flieger antippen: alle steigen ein, er rollt los
//   und hebt sanft wieder ab.
// Sticker: die erste Landung (Postkarte). Was wächst: jede Landung bringt eine Postkarte an die Pinnwand.

import { PIXI, spr, meta, tap, drag, fx, sfx, note, voice, store, rand, shuffle, clamp, animal, Actor } from '../../engine/index.js';
import { Seite } from '../../gemeinsam/seiten.js';
import { belohne } from '../../gemeinsam/sticker.js';
import {
  gleite, bogenFlug, andersAls, kurz, ZIELE, ZIEL_IDS, postkarte, postkarteDazu, zeichneVogel, zielRing, atme,
  GaesteReihe, tierKopf, leiserLaut, piep,
} from './helfer.js';

const GRENZE = { x0: -860, x1: 700, y0: 300, y1: 1120 };
const TEMPO_MAX = 700;               // so schnell folgt der Flieger dem Finger höchstens (Einheiten/s)
const START = { x: -420, y: 720 };
const WARTE_X = 430;                 // hier warten die Begegnungen
const ZIEL_UNTEN = 1540;             // Unterkante der schwebenden Reiseziele
const BAHN_MITTE_X = 120;            // dorthin kommt die Mitte der Landebahn
const GAST_SKALA = 0.26;

const FLIEGER = {
  flugzeug: { bild: 'flughafen/flugzeug', s: 0.58, fenster: ['f1', 'f2'], r: 26 },
  hubschrauber: { bild: 'flughafen/hubschrauber', s: 0.6, fenster: ['f1', 'f2'], r: 30 },
  doppeldecker: { bild: 'flughafen/doppeldecker', s: 0.62, fenster: ['f1'], r: 50 },
};
const BEGEGNUNGEN = ['regen', 'voegel', 'ballon'];

export class Himmel extends Seite {
  static hg = 'flughafen/hg_himmel';

  aufbau() {
    this.schritt = 'leer';
    this.flugNr = 0;
    this.reihe = new GaesteReihe();
    this.letztesZiel = null;
    this.letztePaarung = '';
    this.fahrt = 1;                   // wie schnell die Wolken vorbeiziehen (1 = Reiseflug)
    this.fahrtZiel = 1;
    this.zieht = false;
    this.tippZiel = null;
    this.skript = false;              // true: ein Ablauf (Landen, Abheben) bewegt den Flieger selbst
    this.amBoden = false;
    this.beg = null;
    this.uhr = 0;
    this.baueWolken();
    this.baueHimmelFlaeche();
    this.ring = zielRing(110);
    this.ring.zIndex = 65;
    this.ring.alpha = 0;
    this.welt.addChild(this.ring);
    this.baueGriff();
  }

  betreten() {
    if (this.besuche === 1) {
      this.neuerFlieger();
      this.flieger.position.set(-1700, START.y);
      this.skript = true;
      gleite(this, this.flieger, START.x, START.y, 520).then(() => {
        this.skript = false;
        this.flug();
      });
    } else {
      this.hinweis(1.0);
    }
  }

  verlassen() {
    this._hinweis?.kill();
    this._hinweis = null;
  }

  // ---------------------------------------------------------------- Wolken und Himmel

  baueWolken() {
    // hinten: große, langsame Wolken; vorn: eine kleine, die vor allem vorbeizieht (nimmt keine Eingaben)
    const arten = ['common/wolke1', 'common/wolke2', 'common/wolke3', 'common/wolke1', 'common/wolke2'];
    this.wolken = arten.map((bild, i) => {
      const w = spr(bild, { anchor: 0.5, scale: rand(0.32, 0.5), parent: this.welt, z: 4 + i });
      w.position.set(-1100 + i * 560 + rand(-80, 80), rand(220, 1100));
      w.alpha = 0.95;
      w.tempo = rand(90, 150);
      const m = meta(bild);
      const hh = Math.max(m.h, 280 / w.scale.y);
      tap(w, () => this.wolkeTipp(w), { sound: null, hitArea: new PIXI.Rectangle(-m.w / 2, -hh / 2, m.w, hh) });
      return w;
    });
    const v = spr('common/wolke2', { anchor: 0.5, scale: 0.36, parent: this.welt, z: 62 });
    v.position.set(900, 1000);
    v.alpha = 0.8;
    v.tempo = 210;
    v.eventMode = 'none';
    this.wolken.push(v);
  }

  wolkeTipp(w) {
    fx.wobble(w, 0.05);
    note('floete', 72 + Math.floor(rand(0, 3)) * 2, { vol: 0.25 });
    // der Flieger fliegt hin (die Wolke ist weich – einfach hindurch)
    if (!this.skript && !this.amBoden) this.setzeZiel(w.x, w.y);
  }

  baueHimmelFlaeche() {
    // In den Himmel tippen: der Flieger fliegt dorthin
    const c = new PIXI.Container({ label: 'himmel' });
    c.hitArea = new PIXI.Rectangle(-1280, 0, 2560, 1600);
    c.zIndex = 0;
    tap(c, (e) => { if (e) this.himmelTipp(e.x, e.y); }, { sound: null, squash: false });
    this.welt.addChild(c);
  }

  himmelTipp(x, y) {
    if (this.skript || this.amBoden) {
      if (this.amBoden) fx.wobble(this.flieger.koerper, 0.02);
      return;
    }
    this.setzeZiel(x, y);
  }

  setzeZiel(x, y) {
    const unten = this.schritt === 'landen' ? this.bahn.y : GRENZE.y1;
    this.tippZiel = { x: clamp(x, GRENZE.x0, GRENZE.x1), y: clamp(y, GRENZE.y0, unten) };
  }

  // ---------------------------------------------------------------- Flieger

  /** Den Flieger bauen, der zuletzt auf Seite 2 gestartet ist (Ballon → Flugzeug), mit zwei Gästen an Bord. */
  neuerFlieger() {
    let typ = store.get('flughafen.flieger', 'flugzeug');
    if (!FLIEGER[typ]) typ = 'flugzeug';
    const alt = this.flieger;
    if (alt && this.typ === typ) {
      this.setzeGaeste();
      return alt;
    }
    const pos = alt ? { x: alt.x, y: alt.y } : { x: START.x, y: START.y };
    alt?.destroy({ children: true });
    this.typ = typ;
    const T = FLIEGER[typ];
    const f = new PIXI.Container({ label: 'flieger:' + typ });
    f.position.set(pos.x, pos.y);
    f.zIndex = 30;
    const k = new PIXI.Container({ label: 'koerper', sortableChildren: true });
    f.addChild(k);
    f.koerper = k;
    const b = spr(T.bild, { scale: T.s, parent: k, z: 5 });
    b.anchor.set(0.5, 0.6);   // Mitte des Rumpfs (zum Neigen)
    f.bild = b;
    const m = meta(T.bild);
    f.unten = (1 - 0.6) * m.h * T.s;     // Abstand von der Mitte bis zu den Rädern
    if (typ === 'hubschrauber') {
      const p = this.lokal(f, 'rotor');
      const g = new PIXI.Graphics().ellipse(0, 0, 430 * T.s, 18).fill({ color: 0xffffff, alpha: 0.55 });
      g.position.set(p.x, p.y);
      g.zIndex = 7;
      g.eventMode = 'none';
      k.addChild(g);
      f.rotor = g;
    } else {
      const p = this.lokal(f, typ === 'doppeldecker' ? 'propeller' : 'nase');
      if (typ === 'doppeldecker') {
        const g = new PIXI.Graphics().ellipse(0, 0, 16, 160 * T.s).fill({ color: 0xffffff, alpha: 0.55 });
        g.position.set(p.x + 4, p.y);
        g.zIndex = 7;
        g.eventMode = 'none';
        k.addChild(g);
        f.prop = g;
      }
    }
    this.welt.addChild(f);
    this.flieger = f;
    this.setzeGaeste();
    return f;
  }

  /** Punkt im Flieger-Bild → Koordinaten im Körper (Mitte = Rumpf). */
  lokal(f, name) {
    const T = FLIEGER[this.typ];
    const m = meta(T.bild);
    const p = m?.pts?.[name];
    if (!p) return { x: 0, y: -60 };
    return { x: (p[0] - 0.5 * m.w) * T.s, y: (p[1] - 0.6 * m.h) * T.s };
  }

  /** Punkt des Fliegers in Seiten-Koordinaten (ohne Neigung, die ist klein). */
  fp(name) {
    const f = this.flieger;
    const p = this.lokal(f, name);
    return { x: f.x + p.x, y: f.y + f.koerper.y + p.y };
  }

  setzeGaeste() {
    const f = this.flieger;
    const T = FLIEGER[this.typ];
    for (const k of f.koepfe || []) if (!k.destroyed) k.destroy({ children: true });
    f.koepfe = [];
    this.gaeste = [];
    for (const name of T.fenster) {
      const id = this.reihe.naechster(this.gaeste);
      this.gaeste.push(id);
      const p = this.lokal(f, name);
      const r = T.r * T.s * (this.typ === 'doppeldecker' ? 1 : 1.05);
      const kopf = tierKopf(id, r);
      if (this.typ === 'doppeldecker') {
        // Pilot im offenen Sitz: der Kopf schaut über den Sitzrand (vor dem Bild, sonst verdeckt ihn der Flügel)
        kopf.position.set(p.x + 40 * T.s, p.y - 12 * T.s);
      } else {
        kopf.position.set(p.x, p.y);
      }
      kopf.zIndex = 6;
      f.koerper.addChild(kopf);
      f.koepfe.push(kopf);
    }
  }

  baueGriff() {
    // Unsichtbarer Griff über dem Flieger: Ziehen steuert, kurzes Antippen ist ein Tipp auf den Flieger
    const g = new PIXI.Container({ label: 'griff' });
    g.zIndex = 70;
    this.welt.addChild(g);
    this.griff = g;
    this.griffHandle = drag(g, {
      hitArea: new PIXI.Rectangle(-300, -210, 600, 380),
      back: false,
      lift: 1,
      sound: null,
      onStart: () => {
        if (this.skript || this.amBoden) return;
        this.zieht = true;
        this.tippZiel = null;
      },
      onMove: () => {
        if (!this.zieht) return;
        const unten = this.schritt === 'landen' ? this.bahn.y - 20 : GRENZE.y1;
        g.x = clamp(g.x, GRENZE.x0, GRENZE.x1);
        g.y = clamp(g.y, GRENZE.y0, unten);
      },
      onDrop: (z, ctx) => {
        ctx.erledigt = true;
        const zog = this.zieht;
        this.zieht = false;
        if (kurz(ctx)) { this.fliegerTipp(); return; }
        // Finger losgelassen: der Flieger fliegt noch gemächlich bis dorthin, wo der Finger war (bleibt nicht stehen)
        if (zog && !this.skript && !this.amBoden) this.setzeZiel(g.x, g.y);
      },
    });
  }

  fliegerTipp() {
    const f = this.flieger;
    if (!f) return;
    if (this.schritt === 'abflug') { this.abflug(); return; }
    fx.wobble(f.koerper, 0.03);
    // ein Gast lacht aus dem Fenster
    const i = Math.floor(rand(0, f.koepfe.length));
    const k = f.koepfe[i];
    if (k && !k.destroyed) {
      fx.pop(k, 0.15);
      this.tierLaut(this.gaeste[i]);
    } else {
      note('xylo', 64, { vol: 0.3 });
    }
  }

  tierLaut(id) {
    const jetzt = performance.now();
    if (jetzt - (this._laut || 0) < 1200) return;
    this._laut = jetzt;
    animal(id);
  }

  // ---------------------------------------------------------------- Bild für Bild

  update(dt, t) {
    this.uhr = t;
    const f = this.flieger;
    // Fahrt (Wolken) weich angleichen
    this.fahrt += (this.fahrtZiel - this.fahrt) * Math.min(1, dt * 1.2);
    for (const w of this.wolken) {
      w.x -= w.tempo * (0.15 + 0.85 * this.fahrt) * dt;
      if (w.x < -1750) {
        w.x = 1750 + rand(0, 300);
        w.y = rand(220, 1100);
      }
    }
    if (f && !f.destroyed) {
      if (!this.skript && !this.amBoden) this.steuere(f, dt);
      else { this.vx = 0; this.vy = 0; }
      // Neigung folgt der Steiggeschwindigkeit (weich, höchstens ±0,16)
      if (!this.skript) {
        const ziel = this.amBoden ? 0 : clamp((this.vy || 0) / TEMPO_MAX * 0.16, -0.16, 0.16);
        f.koerper.rotation += (ziel - f.koerper.rotation) * Math.min(1, dt * 4);
      }
      f.koerper.y = this.amBoden ? 0 : Math.sin(t * 1.7) * 9;
      if (f.rotor) f.rotor.scale.x = 1 + 0.05 * Math.sin(t * 9);
      if (f.prop) f.prop.scale.y = 1 + 0.06 * Math.sin(t * 9);
      if (!this.zieht) this.griff.position.set(f.x, f.y);
    }
    if (this.ring.alpha > 0) atme(this.ring, t);
    // Begegnung
    const b = this.beg;
    if (b && !b.c.destroyed) {
      b.update?.(dt, t);
      if (b.wartet && !b.geloest && f && Math.hypot(f.x - b.c.x, f.y - b.c.y) < 250) this.loese(b);
    }
    // Landung: Flieger am Ring
    if (this.schritt === 'landen' && f && Math.hypot(f.x - this.ring.x, f.y + f.unten - (this.ring.y + 60)) < 210) {
      this.landen();
    }
  }

  steuere(f, dt) {
    const z = this.zieht ? this.griff : this.tippZiel;
    let vx = 0;
    let vy = 0;
    if (z) {
      const dx = z.x - f.x;
      const dy = z.y - f.y;
      const d = Math.hypot(dx, dy);
      if (d > 1) {
        const v = Math.min(TEMPO_MAX, d * 2.4);
        vx = (dx / d) * v;
        vy = (dy / d) * v;
        f.x += vx * dt;
        f.y += vy * dt;
      } else if (!this.zieht) {
        this.tippZiel = null;
      }
    }
    // weich, nicht ruckartig: die gemerkte Geschwindigkeit folgt
    this.vx = vx;
    this.vy = (this.vy || 0) + (vy - (this.vy || 0)) * Math.min(1, dt * 5);
  }

  // ---------------------------------------------------------------- Ablauf einer Reise

  async flug() {
    const nr = ++this.flugNr;
    this.schritt = 'fliegen';
    this.fahrtZiel = 1;
    this.sag('flughafen_fliegen', 'fliegen', 1.5);
    // zwei der drei Begegnungen, nie dieselbe Mischung wie eben
    let arten = shuffle(BEGEGNUNGEN.slice()).slice(0, 2);
    if (arten.join() === this.letztePaarung) arten = arten.reverse();
    this.letztePaarung = arten.join();
    for (const art of arten) {
      await this.wait(2.2);
      if (nr !== this.flugNr) return;
      await this.begegnung(art);
      if (nr !== this.flugNr) return;
    }
    await this.wait(1.2);
    if (nr !== this.flugNr) return;
    this.zielKommt(nr);
  }

  /** Eine Begegnung schwebt heran, wartet, bis der Flieger hinfliegt (oder sie angetippt wird). → Promise (fertig) */
  begegnung(art) {
    const b = this['baue_' + art]();
    b.art = art;
    const y = rand(420, 960);
    b.c.position.set(1550, y);
    // Ballon und Vögel vor dem Flieger (30) – fliegt er hin, bleiben sie zu sehen; die große Regenwolke dahinter,
    // sonst verschwände der Flieger hinter Wolke und Regenbogen
    b.c.zIndex = art === 'regen' ? 20 : 40;
    this.welt.addChild(b.c);
    this.beg = b;
    tap(b.c, () => this.begegnungTipp(b), { sound: null, squash: false, hitArea: b.flaeche });
    b.fertig = new Promise((res) => { b.erledigt = res; });
    gleite(this, b.c, WARTE_X, y, 420).then(() => {
      if (b.c.destroyed) return;
      b.wartet = true;
      this.hinweis(4);
    });
    return b.fertig;
  }

  begegnungTipp(b) {
    b.tipp?.();
    if (b.geloest) return;
    b.wartet = true;
    // der Flieger fliegt hin
    if (!this.skript && !this.amBoden) this.setzeZiel(b.c.x - 60, b.c.y);
  }

  async loese(b) {
    if (b.geloest) return;
    b.geloest = true;
    this.tippZiel = null;
    await b.loese();
    // weiter ziehen lassen und abbauen
    if (!b.c.destroyed && !b.bleibt) {
      await gleite(this, b.c, -1700, b.c.y, 330);
      if (!b.c.destroyed) b.c.destroy({ children: true });
    }
    if (this.beg === b) this.beg = null;
    b.erledigt();
  }

  // ---------------------------------------------------------------- Begegnung: Regenwolke

  baue_regen() {
    const c = new PIXI.Container({ label: 'regenwolke', sortableChildren: true });
    const bogen = spr('common/regenbogen', { anchor: [0.5, 1], scale: 0.62, parent: c, z: 0 });
    bogen.y = 150;
    bogen.alpha = 0;
    const w = spr('common/wolke1', { anchor: 0.5, scale: 0.44, parent: c, z: 2 });
    w.tint = 0x9eabbd;
    const tropfen = [];
    for (let i = 0; i < 8; i++) {
      const d = spr('common/p_tropfen', { anchor: 0.5, scale: 0.32, parent: c, z: 1 });
      d.tint = 0x8cc8ff;
      d.position.set(rand(-150, 150), rand(60, 260));
      tropfen.push(d);
    }
    sfx('common/regen', { vol: 0.22 });
    const b = {
      c, flaeche: new PIXI.Rectangle(-230, -130, 460, 420),
      update: (dt) => {
        for (const d of tropfen) {
          d.y += 300 * dt;
          if (d.y > 280) { d.y = 60; d.x = rand(-150, 150); }
        }
      },
      tipp: () => { fx.wobble(w, 0.04); note('xylo', 60, { vol: 0.25 }); },
      loese: async () => {
        // Die Wolke wird weich hell, der Regen hört auf, ein Regenbogen erscheint (alles ≥ 0,5 s)
        const k = { v: 0 };
        this.tween(k, { v: 1 }, 1.4, {
          ease: 'sineInOut',
          onUpdate: () => { if (!w.destroyed) w.tint = mische(0x9eabbd, 0xffffff, k.v); },
        });
        for (const d of tropfen) this.tween(d, { alpha: 0 }, 0.8, { ease: 'sineInOut' });
        this.tween(bogen, { alpha: 0.95 }, 1.6, { ease: 'sineInOut' });
        this.tween(bogen, { scale: 0.7 }, 1.6, { ease: 'sineOut' });
        [72, 76, 79, 84].forEach((n, i) => this.after(0.3 + i * 0.28, () => note('glocke', n, { vol: 0.26 })));
        await this.wait(2.6);
        this.burst('funkeln', c.x, c.y - 120, { count: 4 });
      },
    };
    return b;
  }

  // ---------------------------------------------------------------- Begegnung: Vogelschwarm

  baue_voegel() {
    const c = new PIXI.Container({ label: 'voegel' });
    const farben = [
      { farbe: 0x6fa8dc, dunkel: 0x4c82bd }, { farbe: 0xf2a65a, dunkel: 0xd9823a }, { farbe: 0x8ccf7e, dunkel: 0x63ad55 },
    ];
    const voegel = farben.map((fa, i) => {
      const v = zeichneVogel(fa);
      v.scale.set(-0.62, 0.62);   // schauen nach links (sie kommen entgegen)
      v.position.set(i * 120 - 120, (i % 2) * 70 - 35);
      v.phase = i * 1.3;
      c.addChild(v);
      return v;
    });
    const b = {
      c, flaeche: new PIXI.Rectangle(-260, -150, 520, 300), bleibt: true,
      update: (dt, t) => {
        for (const v of voegel) {
          v.fluegel.scale.y = 0.6 + 0.5 * Math.sin(t * 9 + v.phase);
          v.fluegel.y = -4 * Math.sin(t * 9 + v.phase);
        }
        if (b.begleitet && this.flieger) {
          // sie fliegen neben dem Flieger mit (leicht versetzt, weich nachgezogen)
          const f = this.flieger;
          const k = Math.min(1, dt * 2.2);
          c.x += (f.x + 40 - c.x) * k;
          c.y += (f.y - 230 - c.y) * k;
        }
      },
      tipp: () => { piep(); for (const v of voegel) fx.wobble(v, 0.05); },
      loese: async () => {
        piep();
        for (const v of voegel) this.tween(v.scale, { x: 0.62 }, 0.5, { ease: 'sineInOut' });   // drehen sich um
        b.begleitet = true;
        [79, 83, 86].forEach((n, i) => this.after(0.2 + i * 0.3, () => note('floete', n, { vol: 0.22 })));
        await this.wait(4.5);
        b.begleitet = false;
        piep();
        await bogenFlug(this, c, c.x + 900, -150, { dauer: 2.8, hoehe: 120 });
        if (!c.destroyed) c.destroy({ children: true });
      },
    };
    return b;
  }

  // ---------------------------------------------------------------- Begegnung: Ballon mit Tier

  baue_ballon() {
    const c = new PIXI.Container({ label: 'ballon', sortableChildren: true });
    const id = this.reihe.naechster(this.gaeste);
    const korb = spr('flughafen/korb', { scale: 0.34, parent: c, z: 3 });
    korb.y = 120;
    const huelle = spr('flughafen/ballon', { scale: 0.4, parent: c, z: 1 });
    huelle.y = 120 - meta('flughafen/korb').h * 0.34 * 0.85;
    const kopf = tierKopf(id, 40);
    kopf.position.set(0, 120 - meta('flughafen/korb').h * 0.34 * 0.85 - 10);
    kopf.zIndex = 2;
    c.addChild(kopf);
    const b = {
      c, flaeche: new PIXI.Rectangle(-170, -260, 340, 400),
      update: (dt, t) => { c.rotation = 0.03 * Math.sin(t * 1.2); },
      tipp: () => { fx.pop(kopf, 0.15); this.tierLaut(id); },
      loese: async () => {
        // das Tier freut sich, der Ballon steigt gemächlich davon
        fx.pop(kopf, 0.2);
        this.tierLaut(id);
        this.burst('funkeln', c.x, c.y - 60, { count: 5 });
        note('xylo', 76, { vol: 0.28 });
        this.after(0.3, () => note('xylo', 81, { vol: 0.28 }));
        await this.wait(1.2);
        await this.tween(c, { y: -500, x: c.x + 150 }, 4.0, { ease: 'sineIn' });
        if (!c.destroyed) c.destroy({ children: true });
      },
    };
    b.bleibt = true;
    return b;
  }

  // ---------------------------------------------------------------- Reiseziel und Landung

  async zielKommt(nr) {
    this.schritt = 'zielkommt';
    const z = andersAls(ZIEL_IDS, this.letztesZiel);
    this.letztesZiel = z;
    this.ziel = z;
    const bild = ZIELE[z].bild;
    const m = meta(bild);
    const s = z === 'insel' ? 1.1 : 1.35;
    const sp = spr(bild, { scale: s, parent: this.welt, z: 12 });
    const a = m.pts.bahn_a;
    const e = m.pts.bahn_b;
    const bx = ((a[0] + e[0]) / 2 - m.ax * m.w) * s;
    const by = (a[1] - m.ay * m.h) * s;
    const zielX = BAHN_MITTE_X - bx;
    sp.position.set(zielX + 2600, ZIEL_UNTEN);
    tap(sp, () => this.zielTipp(), { sound: null, squash: false });
    this.zielBild = sp;
    const halb = ((e[0] - a[0]) / 2) * s;
    this.bahn = { x0: BAHN_MITTE_X - halb, x1: BAHN_MITTE_X + halb, y: ZIEL_UNTEN + by };
    this.fahrtZiel = 0.35;
    await gleite(this, sp, zielX, ZIEL_UNTEN, 540);
    if (nr !== this.flugNr || sp.destroyed) return;
    ZIELE[z].ton();
    // Ring: kurz vor der Mitte der Bahn, etwas darüber
    this.ring.position.set(this.bahn.x0 + (this.bahn.x1 - this.bahn.x0) * 0.3, this.bahn.y - 60);
    this.tween(this.ring, { alpha: 0.75 }, 0.6, { ease: 'sineInOut' });
    this.schritt = 'landen';
    this.sag('flughafen_landen', 'landen', 0.6);
  }

  zielTipp() {
    const sp = this.zielBild;
    if (!sp || sp.destroyed) return;
    ZIELE[this.ziel]?.ton();
    fx.wobble(sp, 0.015);
    if (this.schritt === 'landen' && !this.skript && !this.amBoden) {
      this.tippZiel = { x: this.ring.x, y: this.ring.y + 60 - this.flieger.unten };
    }
  }

  async landen() {
    if (this.schritt !== 'landen') return;
    const nr = this.flugNr;
    this.schritt = 'landet';
    this._hinweis?.kill();
    this.skript = true;
    this.zieht = false;
    this.tippZiel = null;
    this.tween(this.ring, { alpha: 0 }, 0.5, { ease: 'sineInOut' });
    const f = this.flieger;
    const bahn = this.bahn;
    const auf = { x: bahn.x0 + (bahn.x1 - bahn.x0) * 0.3, y: bahn.y - f.unten };
    sfx('common/landen', { vol: 0.35 });
    if (this.typ === 'hubschrauber') {
      await gleite(this, f, auf.x + 60, auf.y - 200, 340);
      this.tween(f.koerper, { rotation: 0 }, 0.6, { ease: 'sineInOut' });
      await this.tween(f, { y: auf.y }, 1.8, { ease: 'sineInOut' });
    } else {
      this.tween(f.koerper, { rotation: -0.05 }, 0.8, { ease: 'sineInOut' });
      await gleite(this, f, auf.x, auf.y, 360);
      this.amBoden = true;
      this.tween(f.koerper, { rotation: 0 }, 0.5, { ease: 'sineInOut' });
      this.burst('staub', f.x, bahn.y, { count: 4 });
      await this.tween(f, { x: bahn.x0 + (bahn.x1 - bahn.x0) * 0.62 }, 1.8, { ease: 'sineOut' });
    }
    if (nr !== this.flugNr) return;
    this.amBoden = true;
    this.fahrtZiel = 0;
    await this.aussteigen(nr);
  }

  async aussteigen(nr) {
    const f = this.flieger;
    const tuer = this.fp(this.typ === 'doppeldecker' ? 'f1' : 'tuer_unten');
    const boden = this.bahn.y + 8;
    this.draussen = [];
    for (let i = 0; i < this.gaeste.length; i++) {
      const id = this.gaeste[i];
      const kopf = f.koepfe[i];
      if (kopf && !kopf.destroyed) this.tween(kopf, { alpha: 0 }, 0.3, { ease: 'sineInOut' });
      const a = new Actor(id, { x: tuer.x, y: tuer.y + 20, scale: GAST_SKALA * 0.6, parent: this.welt, z: 75 + i });
      a.alpha = 0;
      a.onTap(() => this.gastTipp(a), { pad: 60 });
      this.draussen.push(a);
      this.tween(a, { alpha: 1 }, 0.3, { ease: 'sineInOut' });
      this.tween(a.scale, { x: GAST_SKALA, y: GAST_SKALA }, 0.5, { ease: 'sineOut' });
      await a.hopTo(f.x + 170 + i * 135, boden + 30, { hoehe: 90, dauer: 0.6 });
      if (nr !== this.flugNr) return;
      a.pose('happy');
      leiserLaut(a);
      a.hop(60);
    }
    // Postkarte vom Ziel – sie fliegt zur Pinnwand (Seite 1, links)
    await this.wait(0.6);
    if (nr !== this.flugNr) return;
    await this.postkarteKommt();
    if (nr !== this.flugNr) return;
    this.schritt = 'abflug';
    this.hinweis(3);
  }

  gastTipp(a) {
    if (a.destroyed) return;
    a.pose('happy');
    a.hop(70);
    leiserLaut(a);
    this.after(0.8, () => { if (!a.destroyed) a.pose('idle'); });
    // Wer einen Gast antippt, wenn alle fertig sind, schickt sie wieder an Bord
    if (this.schritt === 'abflug') this.after(0.4, () => this.abflug());
  }

  async postkarteKommt() {
    const z = this.ziel;
    const k = postkarte(z, 480);
    k.position.set(this.bahn.x0 + 120, 560);
    k.zIndex = 80;
    k.scale.set(0.3);
    k.alpha = 0;
    k.eventMode = 'none';
    this.welt.addChild(k);
    sfx('common/plopp', { vol: 0.4 });
    this.tween(k, { alpha: 1 }, 0.4, { ease: 'sineInOut' });
    await this.tween(k, { scale: 1 }, 0.6, { ease: 'backOut' });
    voice('flughafen_postkarte', { nurWenn: () => this.aktiv });
    ZIELE[z].ton();
    postkarteDazu(z);
    if (!this.postSticker) {
      this.postSticker = true;
      belohne(this, 'flughafen_postkarte', k.x + 260, k.y);
    }
    await this.wait(1.6);
    // im Bogen nach links zum Blätter-Pfeil (dort geht es zur Pinnwand)
    await bogenFlug(this, k, -960, 780, { dauer: 1.4, hoehe: 140, skala: 0.3 });
    await this.tween(k, { alpha: 0 }, 0.5, { ease: 'sineInOut' });
    if (!k.destroyed) k.destroy({ children: true });
  }

  async abflug() {
    if (this.schritt !== 'abflug') return;
    const nr = this.flugNr;
    this.schritt = 'steigt_ein';
    this._hinweis?.kill();
    const f = this.flieger;
    const tuer = this.fp(this.typ === 'doppeldecker' ? 'f1' : 'tuer_unten');
    // alle hüpfen wieder hinein, die Köpfe erscheinen in den Fenstern
    for (let i = 0; i < this.draussen.length; i++) {
      const a = this.draussen[i];
      if (a.destroyed) continue;
      await a.hopTo(tuer.x, tuer.y + 10, { hoehe: 90, dauer: 0.5 });
      if (nr !== this.flugNr) return;
      this.tween(a, { alpha: 0 }, 0.25, { ease: 'sineInOut' }).then(() => { if (!a.destroyed) a.destroy({ children: true }); });
      const kopf = f.koepfe[i];
      if (kopf && !kopf.destroyed) this.tween(kopf, { alpha: 1 }, 0.3, { ease: 'sineInOut' });
    }
    this.draussen = [];
    await this.wait(0.4);
    if (nr !== this.flugNr) return;
    // los: gemächlich rollen und sanft abheben, das Ziel schwebt davon
    this.schritt = 'hebt_ab';
    sfx('common/wusch', { vol: 0.25 });
    const sp = this.zielBild;
    if (this.typ === 'hubschrauber') {
      await this.tween(f, { y: f.y - 380 }, 2.2, { ease: 'sineInOut' });
    } else {
      await this.tween(f, { x: this.bahn.x1 }, 1.8, { ease: 'quadIn' });
      this.amBoden = false;
      this.tween(f.koerper, { rotation: -0.12 }, 1.0, { ease: 'sineInOut' });
      await this.tween(f, { x: GRENZE.x1 - 60, y: f.y - 420 }, 2.6, { ease: 'sineInOut' });
      this.tween(f.koerper, { rotation: 0 }, 1.0, { ease: 'sineInOut' });
    }
    this.amBoden = false;
    this.fahrtZiel = 1;
    if (sp && !sp.destroyed) {
      gleite(this, sp, sp.x - 2700, sp.y, 540).then(() => { if (!sp.destroyed) sp.destroy({ children: true }); });
    }
    this.zielBild = null;
    if (nr !== this.flugNr) return;
    // Wurde auf Seite 2 inzwischen ein anderer Flieger gestartet, kommt er jetzt (sonst neue Gäste)
    const typVorher = this.typ;
    const typNeu = store.get('flughafen.flieger', 'flugzeug');
    if (FLIEGER[typNeu] && typNeu !== typVorher) {
      // der alte Flieger verschwindet weich, dann kommt der neue
      await this.tween(f, { alpha: 0 }, 0.7, { ease: 'sineInOut' });
      if (nr !== this.flugNr) return;
    }
    this.neuerFlieger();
    if (this.typ !== typVorher) {
      const nf = this.flieger;
      nf.alpha = 0;
      this.tween(nf, { alpha: 1 }, 0.8, { ease: 'sineInOut' });
    }
    // gemächlich zurück in die Mitte des Himmels
    this.skript = true;
    await gleite(this, this.flieger, START.x + 300, START.y, 380);
    this.skript = false;
    this.flug();
  }

  // ---------------------------------------------------------------- Stimme und Zeige-Hand

  sag(id, schritt, sek) {
    this._hinweis?.kill();
    const passt = () => this.aktiv && this.schritt === schritt;
    this._hinweis = this.after(sek, () => { if (passt()) voice(id, { nurWenn: passt }); });
  }

  hinweis(sek) {
    if (this.schritt === 'fliegen') this.sag('flughafen_fliegen', 'fliegen', sek);
    else if (this.schritt === 'landen') this.sag('flughafen_landen', 'landen', sek);
  }

  hinweise() {
    const f = this.flieger;
    if (!f || f.destroyed) return [];
    const b = this.beg;
    switch (this.schritt) {
      case 'fliegen':
        if (b && !b.geloest && !b.c.destroyed && b.c.x < 900) return [{ von: f, nach: { x: b.c.x, y: b.c.y } }];
        // sonst zeigt die Hand, dass man den Flieger mit dem Finger führen kann (ein Stück nach rechts oben/unten)
        return [{ von: f, nach: { x: clamp(f.x + 380, GRENZE.x0, GRENZE.x1), y: f.y < 700 ? f.y + 160 : f.y - 160 } }];
      case 'landen':
        return [{ von: f, nach: { x: this.ring.x, y: this.ring.y } }];
      case 'abflug':
        return [f];
      default:
        return [f];
    }
  }
}

/** Zwei Farben mischen (k = 0…1). */
function mische(a, b, k) {
  const r = ((a >> 16) & 255) + ((((b >> 16) & 255) - ((a >> 16) & 255)) * k);
  const g = ((a >> 8) & 255) + ((((b >> 8) & 255) - ((a >> 8) & 255)) * k);
  const bl = (a & 255) + (((b & 255) - (a & 255)) * k);
  return (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(bl);
}

