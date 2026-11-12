// Teich, Seite 2: Ablauf „Flaschenpost-Schatzsuche" (Haupttätigkeit der Seite).
//   1. Die Flaschenpost angeln (der Köder fängt sie wie einen Fisch) – sie liegt groß über dem Wasser.
//   2. Den Korken herausziehen (ziehen; antippen geht auch) – plopp, der Korken schwimmt davon.
//   3. Über den Brief wischen – er rollt sich mit dem Finger auf und zeigt, was gesucht wird (1–2 Dinge).
//   4. (5.) Das Gesuchte angeln – es leuchtet sanft am Grund; gefunden fliegt es auf den Brief.
//   6. Abschluss – je Brief ein anderer: Schlüssel ins Schloss ziehen (Kiste geht auf), Krone der Katze aufsetzen,
//      Stiefel zum Krebs ins Wasser (er zieht ein), Gummiente in den Eimer (Bad), Muschel halten (Perle kommt).
//   7. Der Fund kommt als Andenken ans rechte Ufer – jeder Brief hat dort seinen festen Platz (gespeichert);
//      ein Wiederfund lässt sein Andenken funkeln, sind alle fünf da, freut sich die Katze besonders. Sticker.
// Nichts kann falsch gemacht werden: an der falschen Stelle Losgelassenes gleitet freundlich zurück.

import { spr, tex, meta, drag, hold, fx, voice, note, store, killTweensOf, rand, pick, clamp, PIXI }
  from '../../engine/index.js';
import { belohne } from '../../gemeinsam/sticker.js';
import { ton, freue, naechsterSticker, flugDauer } from './deko.js';

const BUEHNE = { x: 380, y: 330 };           // dort liegt die Flasche, öffnet sich der Brief, ist der Abschluss
const ZETTEL = { x: 760, y: 205, s: 0.36 };  // der Brief klein als Merkzettel, während gesucht wird
const BRIEF_S = 0.8;
// Andenken am rechten Ufer: je Brief ein fester Platz (Reihenfolge wie VARIANTEN), im Kernbereich
const PLAETZE = [
  { x: 470, y: 512, z: 46 }, { x: 595, y: 512, z: 46 }, { x: 720, y: 510, z: 46 },
  { x: 845, y: 506, z: 46 }, { x: 965, y: 504, z: 46 },
];
const ANDENKEN_GROESSE = 118;

const VARIANTEN = [
  { id: 'schatz', dinge: ['schatzkiste_klein', 'schluessel_gold'], icon: 'teich/schatzkiste_klein' },
  { id: 'krone', dinge: ['krone'], icon: 'teich/krone' },
  { id: 'stiefel', dinge: ['stiefel'], icon: 'teich/stiefel' },
  { id: 'ente', dinge: ['gummiente'], icon: 'teich/gummiente' },
  { id: 'muschel', dinge: ['muschel', 'seestern'], icon: 'teich/muschel' },
];

// Bildpunkte der offenen Flasche: Halsöffnung, Richtung des Halses (nach rechts oben)
const HALS = { x: 300 - 180, y: 55 - 142.5 };
const HALS_RICHTUNG = { x: 0.75, y: -0.66 };

export class SchatzAblauf {
  constructor(seite) {
    this.seite = seite;
    this.phase = 'frei';     // frei | flasche | brief | lesen | suchen | finale
    this.letzte = store.get('teich.postLetzte', null);
    this.gesucht = [];       // {d, gefunden, glanz, platz}
    this._p = new PIXI.Point();
    this.baueAndenken();
  }

  get aktiv() { return this.phase !== 'frei'; }

  // ---------------------------------------------------------------- Andenken auf dem Steg

  baueAndenken() {
    this.andenken = new Map();   // icon → Sprite
    const liste = store.get('teich.schaetze', []);
    for (const id of new Set(Array.isArray(liste) ? liste : [])) {
      if (typeof id === 'string' && VARIANTEN.some((v) => v.icon === id)) this.andenkenDazu(id, null);
    }
  }

  // Andenken auf seinen festen Platz; gibt es das schon, fliegt der Fund hin und es funkelt nur
  andenkenDazu(id, von) {
    const seite = this.seite;
    const i = VARIANTEN.findIndex((v) => v.icon === id);
    const p = PLAETZE[Math.max(0, i)];
    const m = meta(id);
    const gross = ANDENKEN_GROESSE / Math.max(m.w || 300, m.h || 300);
    const da = this.andenken.get(id);
    if (!von) {
      if (da) return da;
      const s = spr(id, { parent: seite.welt, anchor: { x: 0.5, y: 0.9 }, x: p.x, y: p.y });
      s.scale.set(gross);
      s.zIndex = p.z;
      s.gross = gross;
      seite.tapAndenken(s);
      this.andenken.set(id, s);
      return s;
    }
    // im ruhigen Bogen vom Abschluss ans Ufer
    const s = spr(id, { parent: seite.welt, anchor: { x: 0.5, y: 0.9 }, x: von.x, y: von.y });
    s.scale.set(gross * 2);
    s.zIndex = 2300;
    s.eventMode = 'none';
    const x0 = von.x;
    const y0 = von.y;
    const q = { t: 0 };
    const hoehe = 160;
    seite.tween(q, { t: 1 }, flugDauer(p.x - x0, p.y - y0, { hoehe, ease: 'sine', min: 1.4, v: 900 }), {
      ease: 'sineInOut',
      onUpdate: () => {
        if (s.destroyed) return;
        s.x = x0 + (p.x - x0) * q.t;
        s.y = y0 + (p.y - y0) * q.t - hoehe * 4 * q.t * (1 - q.t);
        s.scale.set(gross * (2 - q.t));
      },
    }).then((ok) => {
      if (!ok || s.destroyed) return;
      seite.burst('funkeln', p.x, p.y - 50, { count: 4 });
      ton('common/klack', { vol: 0.5 }, 0.2);
      const alt = this.andenken.get(id);
      if (alt && alt !== s && !alt.destroyed) {
        // schon in der Sammlung: der Fund geht darin auf, das Andenken funkelt
        s.destroy();
        fx.pop(alt, 0.15);
        note('glocke', 88, { vol: 0.3 });
        return;
      }
      s.zIndex = p.z;
      s.gross = gross;
      seite.tapAndenken(s);
      this.andenken.set(id, s);
      fx.pop(s, 0.15);
      if (this.andenken.size === PLAETZE.length) this.sammlungVoll();
    });
    return s;
  }

  // alle fünf Andenken beisammen: sie wackeln nacheinander mit einer kleinen Glockenmelodie
  sammlungVoll() {
    const seite = this.seite;
    const liste = VARIANTEN.map((v) => this.andenken.get(v.icon)).filter(Boolean);
    liste.forEach((a, i) => seite.after(0.5 + i * 0.3, () => {
      if (a.destroyed) return;
      fx.wobble(a, 0.12);
      note('glocke', [79, 81, 84, 88, 91][i] || 84, { vol: 0.3 });
    }));
    seite.after(0.5 + liste.length * 0.3, () => {
      freue(seite, seite.katze);
      seite.burst('sterne', PLAETZE[2].x, PLAETZE[2].y - 120, { count: 6 });
    });
  }

  // ---------------------------------------------------------------- Fangen (von Angeln gerufen)

  /** Darf der Köder dieses Ding gerade fangen? */
  fangbar(d) {
    if (this.phase === 'frei') return true;
    if (this.phase !== 'suchen') return false;
    return this.gesucht.some((g) => g.d === d && !g.gefunden);
  }

  /** Gesuchtes Ding nah am Köder (hat Vorrang vor Fischen)? */
  gesuchtNah(x, y, r) {
    if (this.phase !== 'suchen') return null;
    for (const g of this.gesucht) {
      const d = g.d;
      if (g.gefunden || (d.zustand !== 'liegt' && d.zustand !== 'treibt')) continue;
      if (Math.hypot(d.x - x, d.y - y) < r) return d;
    }
    return null;
  }

  /** Ein Ding (kein Fisch) wurde hochgezogen. true = der Ablauf kümmert sich darum. */
  gefangen(d) {
    if (this.phase === 'frei' && d === this.seite.post) { this.starte(d); return true; }
    if (this.phase === 'suchen') {
      const g = this.gesucht.find((x) => x.d === d && !x.gefunden);
      if (g) { this.gefunden(g); return true; }
    }
    return false;
  }

  // ---------------------------------------------------------------- 1. Flasche

  starte(post) {
    const seite = this.seite;
    // Brief wählen: nie derselbe wie zuletzt, und nur einer, dessen Dinge gerade frei sind
    const frei = (name) => {
      const d = seite.dinge.find((x) => x.name === name);
      return d && ['liegt', 'weg', 'treibt'].includes(d.zustand);
    };
    let liste = VARIANTEN.filter((v) => v.id !== this.letzte && v.dinge.every(frei));
    if (!liste.length) liste = VARIANTEN.filter((v) => v.dinge.every(frei));
    if (!liste.length) liste = [VARIANTEN[2]];
    // meist ein Brief, dessen Andenken noch fehlt – so füllt sich die Sammlung am Ufer
    const fehlt = liste.filter((v) => !this.andenken.has(v.icon));
    if (fehlt.length && Math.random() < 0.75) liste = fehlt;
    this.v = pick(liste);
    this.letzte = this.v.id;
    store.set('teich.postLetzte', this.letzte);
    this.phase = 'flasche';

    // die gefangene Flaschenpost wird zur großen offenen Flasche mit Korken
    post.zustand = 'weg';
    post.c.visible = false;
    const c = new PIXI.Container({ label: 'schatz:flasche' });
    c.zIndex = 2100;
    const f = spr('teich/flasche_offen', { parent: c, anchor: 0.5 });
    f.eventMode = 'none';
    const k = spr('teich/korken', { parent: c, anchor: 0.5 });
    k.scale.set(0.55);
    k.rotation = 0.85;
    k.position.set(HALS.x + HALS_RICHTUNG.x * 8, HALS.y + HALS_RICHTUNG.y * 8);
    c.position.set(post.x, post.y);
    c.scale.set(0.5);
    seite.welt.addChild(c);
    this.flasche = c;
    this.korken = k;
    seite.tween(c, { x: BUEHNE.x, y: BUEHNE.y }, 0.7, { ease: 'sineInOut' });
    seite.tween(c, { scale: 1.1 }, 0.7, { ease: 'backOut' }).then((ok) => {
      if (!ok) return;
      ton('common/funkeln', { vol: 0.45 }, 0.3);
      seite.burst('funkeln', BUEHNE.x, BUEHNE.y, { count: 5 });
      this.korkenGreifbar();
      this.sagHinweis('teich_korken', () => this.phase === 'flasche');
    });
  }

  sagHinweis(id, wann) {
    const passt = () => this.seite.aktiv && wann();
    this.seite.after(1.0, () => { if (passt()) voice(id, { nurWenn: passt }); });
  }

  korkenGreifbar() {
    const k = this.korken;
    const start = { x: k.x, y: k.y };
    this.korkenDrag = drag(k, {
      lift: 1.1,
      // ≈ 260 Einheiten (Korken 0,55 in der Flasche 1,1)
      hitArea: new PIXI.Rectangle(-215, -215, 430, 430),
      back: false,
      onStart: () => ton('common/rupf', { vol: 0.35 }, 0.3),
      onMove: () => {
        if (Math.hypot(k.x - start.x, k.y - start.y) > 55) this.korkenRaus();
      },
      onDrop: () => this.korkenRaus(),
    });
  }

  korkenRaus() {
    if (this.phase !== 'flasche' || this.korkenWeg) return;
    this.korkenWeg = true;
    this.korkenDrag?.off();
    const seite = this.seite;
    const k = this.korken;
    // Korken aus der Flasche in die Welt: fliegt im Bogen ins Wasser und schwimmt davon
    const g = k.getGlobalPosition();
    const p = seite.welt.toLocal(g);
    k.removeFromParent();
    seite.welt.addChild(k);
    k.position.set(p.x, p.y);
    k.scale.set(0.6);
    k.zIndex = 2200;
    k.eventMode = 'none';
    ton('common/plopp', { vol: 0.8 }, 0.1);
    ton('common/rupf', { vol: 0.5 }, 0.1);
    seite.burst('funkeln', p.x, p.y, { count: 4 });
    const zx = p.x + 260;
    const zy = seite.WL + 6;
    const q = { t: 0 };
    seite.tween(q, { t: 1 }, flugDauer(zx - p.x, zy - p.y, { hoehe: 200, ease: 'linear', min: 0.9 }), {
      ease: 'linear',
      onUpdate: () => {
        if (k.destroyed) return;
        k.x = p.x + (zx - p.x) * q.t;
        k.y = p.y + (zy - p.y) * q.t - 200 * 4 * q.t * (1 - q.t);
        k.rotation = 0.85 + q.t * 4;
      },
    }).then((ok) => {
      if (!ok || k.destroyed) return;
      seite.ringe.ring(zx, seite.WL, 260);
      ton('common/platsch', { vol: 0.35 }, 0.2);
      k.zIndex = 485;
      seite.tween(k, { x: zx + 300 }, 8, { ease: 'sineInOut' });
      seite.tween(k, { alpha: 0 }, 2, { ease: 'sineInOut', delay: 6 }).then(() => { if (!k.destroyed) k.destroy(); });
    });
    seite.after(0.35, () => this.briefKommt());
  }

  // ---------------------------------------------------------------- 2. Brief aufrollen

  briefKommt() {
    const seite = this.seite;
    const c = this.flasche;
    // Rolle gleitet aus dem Flaschenhals
    const r = spr('teich/brief_rolle', { parent: c, anchor: 0.5 });
    r.scale.set(0.6);
    r.rotation = -0.72;
    r.position.set(HALS.x - 40, HALS.y + 30);
    r.alpha = 0;
    seite.tween(r, { alpha: 1 }, 0.3, { ease: 'sineInOut' });
    seite.tween(r, { x: HALS.x + 110, y: HALS.y - 90 }, 0.8, { ease: 'sineInOut' }).then((ok) => {
      if (!ok) return;
      // Rolle in die Welt: sie liegt waagrecht über der Bühne; die leere Flasche gleitet ins Wasser zurück
      const g = r.getGlobalPosition();
      const p = seite.welt.toLocal(g);
      r.removeFromParent();
      r.destroy();
      this.briefAufbauen(p);
      seite.tween(c, { y: seite.WL + 120, alpha: 0 }, 1.4, { ease: 'sineInOut' }).then(() => { if (!c.destroyed) c.destroy({ children: true }); });
      this.flasche = null;
    });
  }

  briefAufbauen(p) {
    const seite = this.seite;
    this.phase = 'brief';
    this.rollen = 0;
    const brief = new PIXI.Container({ label: 'schatz:brief' });
    brief.position.set(BUEHNE.x, BUEHNE.y);
    brief.zIndex = 2100;
    seite.welt.addChild(brief);
    // Papier: Anker links, wächst mit dem Wischen nach rechts
    const papier = spr('teich/brief_offen', { parent: brief, anchor: { x: 0, y: 0.5 } });
    papier.x = -320 * BRIEF_S;
    papier.scale.set(0.12 * BRIEF_S, BRIEF_S);
    papier.alpha = 0;
    // die gesuchten Dinge auf dem Brief (erst sichtbar, wenn er ganz offen ist)
    const bilder = new PIXI.Container();
    brief.addChild(bilder);
    const n = this.v.dinge.length;
    this.bildplaetze = this.v.dinge.map((name, i) => {
      const id = name === 'schatzkiste_klein' ? 'teich/schatzkiste_zu' : 'teich/' + name;
      const m = meta(id);
      const b = spr(id, { parent: bilder, anchor: 0.5 });
      const groesse = n === 1 ? 240 : 190;
      b.scale.set(groesse / Math.max(m.w || 300, m.h || 300));
      b.position.set(n === 1 ? 0 : (i === 0 ? -120 : 120), 6);
      b.alpha = 0;
      b.basis = b.scale.x;
      return b;
    });
    this.brief = brief;
    this.papier = papier;
    // die Rolle selbst: wird gewischt (sie folgt dem Finger nicht, sie rollt das Papier auf)
    const rolle = spr('teich/brief_rolle', { parent: seite.welt, anchor: 0.5 });
    rolle.scale.set(0.75);
    rolle.position.set(p.x, p.y);
    rolle.zIndex = 2150;
    this.rolle = rolle;
    this._rolleZiel = null;   // Ziel der letzten Runde vergessen (sonst springt die Rolle an den alten Rand)
    seite.tween(rolle, { x: BUEHNE.x - 230, y: BUEHNE.y, rotation: 0 },
      flugDauer(BUEHNE.x - 230 - p.x, BUEHNE.y - p.y, { ease: 'sine', min: 0.6 }), { ease: 'sineInOut' }).then((ok) => {
      if (!ok) return;
      this._rolleZiel = { x: BUEHNE.x - 230, y: BUEHNE.y };
      seite.tween(papier, { alpha: 1 }, 0.3, { ease: 'sineInOut' });
      this.rolleGreifbar();
      this.sagHinweis('teich_brief', () => this.phase === 'brief' && this.rollen < 0.2);
    });
  }

  rolleGreifbar() {
    const r = this.rolle;
    const alt = { x: 0, y: 0 };
    this.rolleDrag = drag(r, {
      lift: 1.05,
      hitArea: new PIXI.Rectangle(-200, -170, 400, 340),   // ≈ 300×255 Einheiten
      back: false,
      onStart: (ctx) => { alt.x = ctx.startX; alt.y = ctx.startY; ton('common/wisch', { vol: 0.4 }, 0.3); },
      onMove: (_, ctx) => {
        // jede Bewegung rollt weiter auf (egal in welche Richtung); die Rolle bleibt am Papierrand
        const weg = Math.hypot(ctx.x - alt.x, ctx.y - alt.y);
        alt.x = ctx.x;
        alt.y = ctx.y;
        this.rolleWeiter(weg / 520);
      },
      onDrop: (_, ctx) => {
        const bewegt = Math.hypot(ctx.x - ctx.startX, ctx.y - ctx.startY);
        if (bewegt < 30) this.rolleWeiter(0.34, true);   // nur getippt: ein Stück weich weiter
        else this.rolleWeiter(0);
      },
    });
  }

  rolleWeiter(stueck, weich = false) {
    if (this.phase !== 'brief') return;
    const vorher = this.rollen;
    this.rollen = Math.min(1, this.rollen + stueck);
    if (this.rollen > vorher + 0.05 || weich) ton('common/wisch', { vol: 0.35 }, 0.35);
    const sx = (0.12 + 0.88 * this.rollen) * BRIEF_S;
    const randX = BUEHNE.x - 320 * BRIEF_S + 640 * sx - 40;
    if (weich) {
      this.seite.tween(this.papier.scale, { x: sx }, 0.35, { ease: 'sineInOut' });
      this.seite.tween(this.rolle, { x: Math.max(BUEHNE.x - 230, randX), y: BUEHNE.y }, 0.35, { ease: 'sineInOut' });
    } else {
      killTweensOf(this.papier.scale);
      this.papier.scale.x = sx;
    }
    this._rolleZiel = { x: Math.max(BUEHNE.x - 230, randX), y: BUEHNE.y };
    if (this.rollen >= 1) this.briefOffen();
  }

  briefOffen() {
    const seite = this.seite;
    this.phase = 'lesen';
    this.rolleDrag?.off();
    const r = this.rolle;
    this.rolle = null;
    seite.tween(r, { alpha: 0 }, 0.4, { ease: 'sineInOut' }).then(() => { if (!r.destroyed) r.destroy(); });
    seite.tween(this.papier.scale, { x: BRIEF_S }, 0.3, { ease: 'sineInOut' });
    note('glocke', 79, { vol: 0.35 });
    this.bildplaetze.forEach((b, i) => {
      seite.after(0.3 + i * 0.4, () => {
        seite.tween(b, { alpha: 1 }, 0.4, { ease: 'sineInOut' });
        b.scale.set(b.basis * 0.6);
        seite.tween(b, { scale: b.basis }, 0.5, { ease: 'backOut' });
        ton('common/funkeln', { vol: 0.4 }, 0.2);
        note('glocke', [84, 88][i] || 84, { vol: 0.3 });
      });
    });
    // gut ansehen, dann wird der Brief klein (Merkzettel) und die Suche beginnt
    seite.after(2.8, () => {
      seite.tween(this.brief, { x: ZETTEL.x, y: ZETTEL.y, scale: ZETTEL.s / BRIEF_S }, 0.9, { ease: 'sineInOut' })
        .then((ok) => { if (ok) this.sucheBeginnt(); });
    });
  }

  // ---------------------------------------------------------------- 3. Suchen

  sucheBeginnt() {
    const seite = this.seite;
    this.phase = 'suchen';
    this.gesucht = this.v.dinge.map((name, i) => {
      const d = seite.dinge.find((x) => x.name === name);
      if (name === 'schatzkiste_klein') d.bild.texture = tex('teich/schatzkiste_zu');
      if (d.zustand === 'weg') seite.lassSinken(d);
      const glanz = new PIXI.Graphics();
      for (let k = 4; k >= 1; k--) glanz.ellipse(0, 0, 70 + k * 22, 40 + k * 12).fill({ color: 0xfff3b0, alpha: 0.13 });
      glanz.zIndex = 405;
      glanz.eventMode = 'none';
      seite.welt.addChild(glanz);
      return { d, gefunden: false, glanz, bild: this.bildplaetze[i] };
    });
    this.sagHinweis('teich_suchen', () => this.phase === 'suchen' && this.gesucht.every((g) => !g.gefunden));
  }

  gefunden(g) {
    const seite = this.seite;
    g.gefunden = true;
    const d = g.d;
    d.zustand = 'schatz';
    d.c.zIndex = 2200;
    const glanz = g.glanz;
    seite.tween(glanz, { alpha: 0 }, 0.5, { ease: 'sineInOut' }).then(() => { if (!glanz.destroyed) glanz.destroy(); });
    // fliegt auf sein Bild auf dem Merkzettel
    const ziel = this.brief.toGlobal(g.bild.position);
    const p = seite.welt.toLocal(ziel);
    const s = g.bild.basis * (ZETTEL.s / BRIEF_S);   // Bild auf dem Merkzettel (Brief ist verkleinert)
    d.dreh = 0;
    seite.bogen(d, p.x, p.y, { hoehe: 120, dauer: 0.8, s: s * 1.05 }).then((ok) => {
      if (!ok) return;
      g.bild.alpha = 0;
      seite.burst('funkeln', p.x, p.y, { count: 5 });
      ton('common/funkeln', { vol: 0.5 }, 0.2);
      note('glocke', 84 + this.gesucht.filter((x) => x.gefunden).length * 3, { vol: 0.35 });
      freue(seite, seite.katze);
      if (this.gesucht.every((x) => x.gefunden)) seite.after(1.0, () => this.finale());
    });
  }

  // ---------------------------------------------------------------- 4. Abschluss

  finale() {
    const seite = this.seite;
    this.phase = 'finale';
    const b = this.brief;
    this.brief = null;
    seite.tween(b, { alpha: 0 }, 0.6, { ease: 'sineInOut' }).then(() => { if (!b.destroyed) b.destroy({ children: true }); });
    const dinge = this.gesucht.map((g) => g.d);
    const plaetze = dinge.length === 1 ? [{ x: BUEHNE.x, y: BUEHNE.y + 30, g: 230 }]
      : [{ x: BUEHNE.x - 150, y: BUEHNE.y + 60, g: 240 }, { x: BUEHNE.x + 220, y: BUEHNE.y - 20, g: 170 }];
    // Bei der Schatzkiste: Kiste links, Schlüssel rechts (Schlüssel wird gezogen)
    dinge.forEach((d, i) => {
      const pl = plaetze[i];
      const m = meta(d.id);
      d.heim = { x: pl.x, y: pl.y };
      seite.bogen(d, pl.x, pl.y, { hoehe: 60, dauer: 0.7, s: pl.g / Math.max(m.w || 300, m.h || 300) });
    });
    seite.after(0.8, () => {
      const art = this.v.id;
      if (art === 'schatz') this.finaleSchloss(dinge[1], dinge[0]);
      else if (art === 'krone') this.finaleKrone(dinge[0]);
      else if (art === 'stiefel') this.finaleStiefel(dinge[0]);
      else if (art === 'ente') this.finaleEimer(dinge[0]);
      else this.finalePerle(dinge[0], dinge[1]);
    });
  }

  // gemeinsames Ziehen im Abschluss: Ding folgt dem Finger, sonst sync; daneben → zurück auf seinen Platz
  ziehbar(d, { ziel, treffer }) {
    const seite = this.seite;
    d.ziehHandle = drag(d.c, {
      lift: 1.08,
      hitArea: new PIXI.Rectangle(-150, -150, 300, 300),   // der Container ist nicht skaliert (das Bild schon)
      back: false,
      onStart: () => { d.ziehen = true; },
      onMove: () => { d.x = d.c.x; d.y = d.c.y; },
      onDrop: (_, ctx) => {
        d.x = d.c.x;
        d.y = d.c.y;
        d.ziehen = false;
        const z = ziel();
        const nah = z && Math.hypot(d.x - z.x, d.y - z.y) < (z.r || 240);
        if (nah || treffer?.(d)) {
          d.ziehHandle.off();
          d.ziehHandle = null;
          d.c.eventMode = 'none';
          ctx.erledigt = true;
          return z;
        }
        // freundlich zurück
        seite.bogen(d, d.heim.x, d.heim.y, { hoehe: 40, dauer: 0.5 });
        ctx.erledigt = true;
        return null;
      },
    });
  }

  finaleSchloss(schluessel, kiste) {
    const seite = this.seite;
    const schloss = () => ({ x: kiste.x, y: kiste.y + 10, r: 260 });
    this.zeige = { von: schluessel.c, nach: kiste.c };
    this.ziehbar(schluessel, { ziel: schloss });
    // Ankommen am Schloss: Schlüssel steckt, dreht sich, Kiste springt auf
    this.wennAngekommen(schluessel, () => {
      const z = schloss();
      seite.bogen(schluessel, z.x + 10, z.y + 10, { hoehe: 20, dauer: 0.35, s: schluessel.s * 0.7 }).then((ok) => {
        if (!ok) return;
        ton('common/klack', { vol: 0.6 }, 0.1);
        seite.tween(schluessel, { dreh: 1.4 }, 0.5, { ease: 'sineInOut' }).then(() => {
          kiste.bild.texture = tex('teich/schatzkiste_klein');
          fx.pop(kiste.c, 0.15);
          schluessel.c.visible = false;
          ton('common/funkeln', { vol: 0.6 }, 0.1);
          note('glocke', 84, { vol: 0.4 });
          seite.after(0.18, () => note('glocke', 88, { vol: 0.4 }));
          seite.after(0.36, () => note('glocke', 91, { vol: 0.4 }));
          seite.burst('sterne', kiste.x, kiste.y - 60, { count: 6 });
          seite.burst('funkeln', kiste.x, kiste.y - 40, { count: 6 });
          freue(seite, seite.katze);
          seite.after(2.2, () => this.abschluss([kiste, schluessel], kiste));
        });
      });
    });
  }

  finaleKrone(krone) {
    const seite = this.seite;
    const kopf = () => { const k = seite.katze.point('kopf'); return { x: k.x + 6, y: k.y + 40, r: 300 }; };
    this.zeige = { von: krone.c, nach: seite.katze };
    // auch an die Katze irgendwo (Körper) gelegt, landet die Krone auf dem Kopf
    this.ziehbar(krone, { ziel: kopf, treffer: (d) => Math.hypot(d.x - seite.katze.x, d.y - (seite.katze.y - 120)) < 300 });
    this.wennAngekommen(krone, () => {
      const z = kopf();
      seite.bogen(krone, z.x, z.y, { hoehe: 60, dauer: 0.45, s: krone.basisS * 0.95 }).then((ok) => {
        if (!ok) return;
        krone.zustand = 'krone';
        krone.c.zIndex = 60;
        freue(seite, seite.katze);
        note('glocke', 84, { vol: 0.4 });
        seite.after(0.25, () => note('glocke', 91, { vol: 0.35 }));
        seite.burst('funkeln', z.x, z.y - 30, { count: 6 });
        // die Krone bleibt eine Weile auf (Angeln blendet sie später aus)
        seite.after(7, () => seite.blendeAus(krone));
        seite.after(1.8, () => this.abschluss([], { x: z.x, y: z.y }));
      });
    });
  }

  finaleStiefel(stiefel) {
    const seite = this.seite;
    const kr = seite.krebs;
    this.zeige = { von: stiefel.c, nach: kr.c };
    // ins Wasser gezogen (oder zum Krebs) zählt
    this.ziehbar(stiefel, { ziel: () => ({ x: kr.x, y: seite.GRUND - 80, r: 380 }), treffer: (d) => d.y > seite.WL + 40 });
    this.wennAngekommen(stiefel, () => {
      // neben den Krebs (zur Bildmitte hin) sinken
      const zx = clamp(kr.x + (kr.x < 300 ? 170 : -170), -330, 880);
      stiefel.s = stiefel.basisS * 1.15;
      const zy = seite.grundY(stiefel) + 4;
      ton('common/platsch', { vol: 0.4 }, 0.2);
      seite.ringe.ring(stiefel.x, seite.WL, 280);
      seite.tween(stiefel, { x: zx, y: zy, dreh: 0 }, 1.6, { ease: 'sineInOut' }).then((ok) => {
        if (!ok) return;
        seite.burst('staub', zx, seite.GRUND - 10, { count: 3 });
        stiefel.c.zIndex = 420;
        // der Krebs läuft hin und zieht ein
        seite.krebsZiehtEin(stiefel, () => {
          freue(seite, seite.katze);
          note('xylo', 72, { vol: 0.5 });
          seite.after(0.2, () => note('xylo', 76, { vol: 0.5 }));
          seite.after(0.4, () => note('xylo', 79, { vol: 0.5 }));
          seite.after(1.4, () => this.abschluss([], { x: zx, y: zy - 60 }));
        });
      });
    });
  }

  finaleEimer(ente) {
    const seite = this.seite;
    const bad = () => ({ x: seite.innen.x, y: seite.innen.y - 40, r: 280 });
    this.zeige = { von: ente.c, nach: seite.eimer };
    this.ziehbar(ente, { ziel: bad });
    this.wennAngekommen(ente, () => {
      const z = { x: seite.innen.x, y: seite.innen.y - 95 };
      seite.bogen(ente, z.x, z.y, { hoehe: 70, dauer: 0.5, s: ente.basisS * 0.75 }).then((ok) => {
        if (!ok) return;
        ente.c.zIndex = 45;
        ente.badet = true;
        ton('common/platsch', { vol: 0.45 }, 0.2);
        seite.burst('tropfen', z.x, z.y - 20, { count: 6 });
        fx.pop(seite.eimer, 0.05);
        note('floete', 86, { vol: 0.5, dauer: 0.18 });
        seite.after(0.25, () => note('floete', 91, { vol: 0.5, dauer: 0.22 }));
        seite.fischeHuepfen();
        freue(seite, seite.katze);
        // nach einem Bad hüpft sie zurück in den Teich
        seite.after(8, () => { ente.badet = false; seite.wirfZurueck(ente); });
        seite.after(1.8, () => this.abschluss([], { x: z.x, y: z.y - 40 }));
      });
    });
  }

  finalePerle(muschel, stern) {
    const seite = this.seite;
    this.zeige = muschel.c;
    this.glanzWert = 0;
    const weiter = (dt) => {
      if (this.perleDa) return;
      this.glanzWert = Math.min(1, this.glanzWert + dt / 1.3);
      muschel.s = muschel.zielS * (1 + 0.08 * this.glanzWert);
      const stufe = Math.floor(this.glanzWert * 4);
      if (stufe > (this._perleStufe ?? -1)) {
        this._perleStufe = stufe;
        note('glocke', [76, 79, 83, 86, 88][stufe], { vol: 0.3 });
        seite.burst('funkeln', muschel.x + rand(-60, 60), muschel.y - 40, { count: 2 });
      }
      if (this.glanzWert >= 1) this.perle(muschel, stern);
    };
    muschel.zielS = muschel.s;
    this.perleHalten = hold(muschel.c, {
      hitArea: new PIXI.Rectangle(-150, -150, 300, 300),
      onStart: () => weiter(0.4),     // Antippen hilft auch (Halten ist keine Pflicht)
      onTick: (dt) => weiter(dt),
    });
    // Seestern: antippen dreht ihn (er freut sich mit)
    this.sternTap = seite.tapDing(stern, () => {
      seite.tween(stern, { dreh: stern.dreh + Math.PI * 2 }, 1, { ease: 'sineInOut' });
      note('xylo', pick([76, 79, 83]), { vol: 0.45 });
    });
  }

  perle(muschel, stern) {
    const seite = this.seite;
    this.perleDa = true;
    this.perleHalten?.off();
    this.zeige = null;
    const g = new PIXI.Graphics()
      .circle(0, 0, 34).fill(0xfbf6ff)
      .circle(-10, -11, 12).fill({ color: 0xffffff, alpha: 0.9 })
      .circle(8, 10, 22).fill({ color: 0xe6dcf5, alpha: 0.35 });
    g.position.set(muschel.x, muschel.y - 10);
    g.zIndex = 2300;
    g.scale.set(0.2);
    g.eventMode = 'none';
    seite.welt.addChild(g);
    seite.tween(g, { scale: 1, y: muschel.y - 150 }, 0.9, { ease: 'backOut' });
    ton('common/funkeln', { vol: 0.6 }, 0.1);
    note('glocke', 88, { vol: 0.4 });
    seite.after(0.2, () => note('glocke', 91, { vol: 0.4 }));
    seite.after(0.4, () => note('glocke', 96, { vol: 0.35 }));
    seite.burst('funkeln', muschel.x, muschel.y - 120, { count: 7 });
    seite.tween(stern, { dreh: stern.dreh + Math.PI * 2 }, 1.2, { ease: 'sineInOut' });
    freue(seite, seite.katze);
    seite.after(2.2, () => {
      seite.tween(g, { alpha: 0 }, 0.6, { ease: 'sineInOut' }).then(() => { if (!g.destroyed) g.destroy(); });
      this.abschluss([muschel, stern], { x: muschel.x, y: muschel.y - 150 });
    });
  }

  // nach dem Loslassen am richtigen Ort: fn einmal ausführen
  wennAngekommen(d, fn) {
    d.beimZiel = fn;
  }

  update(dt, t) {
    for (const g of this.gesucht) {
      const d = g.d;
      if (g.glanz && !g.glanz.destroyed && !g.gefunden) {
        g.glanz.position.set(d.x, d.y + 10);
        g.glanz.alpha = 0.55 + Math.sin(t * 2.4) * 0.25;
        g.glanz.visible = d.c.visible;
      }
      if (d.beimZiel && !d.ziehHandle && !d.ziehen && d.zustand === 'schatz') {
        const fn = d.beimZiel;
        d.beimZiel = null;
        fn();
      }
      if (d.badet) {
        d.y = this.seite.innen.y - 95 + Math.sin(t * 1.8) * 5;
        d.dreh = Math.sin(t * 1.3) * 0.08;
      }
    }
    if (this.rolle && this._rolleZiel && this.phase === 'brief') {
      // die Rolle bleibt am rechten Papierrand, auch wenn der Finger sie ein Stück mitzieht
      this.rolle.x += (this._rolleZiel.x - this.rolle.x) * (1 - Math.exp(-dt * 14));
      this.rolle.y += (this._rolleZiel.y - this.rolle.y) * (1 - Math.exp(-dt * 14));
    }
  }

  abschluss(weg, ort) {
    const seite = this.seite;
    this.zeige = null;
    for (const d of weg) {
      if (d.zustand === 'schatz') seite.blendeAus(d);
    }
    // Andenken ans Ufer, Sticker
    this.andenkenDazu(this.v.icon, ort);
    const liste = store.get('teich.schaetze', []);
    store.set('teich.schaetze', [...new Set([...(Array.isArray(liste) ? liste : []), this.v.icon])]);
    seite.after(1.2, () => belohne(seite, naechsterSticker('tier_pinguin', ['tier_pinguin']), BUEHNE.x + 200, BUEHNE.y - 60));
    for (const g of this.gesucht) if (g.glanz && !g.glanz.destroyed) g.glanz.destroy();
    this.sternTap?.off();
    this.sternTap = null;
    this.gesucht = [];
    this.perleDa = false;
    this._perleStufe = -1;
    this.korkenWeg = false;
    this.phase = 'frei';
    // die nächste Flaschenpost treibt bald herein
    seite.after(rand(7, 10), () => seite.treibHerein(seite.post));
  }

  // ---------------------------------------------------------------- Zeige-Hand

  hinweis() {
    const seite = this.seite;
    switch (this.phase) {
      case 'frei': return seite.post.zustand === 'treibt' && seite.post.c.visible ? { von: seite.koeder, nach: seite.post.c } : null;
      case 'flasche': return this.korken && !this.korkenWeg && !this.korken.destroyed
        ? { von: this.korken, nach: { x: BUEHNE.x + 260, y: BUEHNE.y - 220 } } : null;
      case 'brief': return this.rolle && !this.rolle.destroyed
        ? { von: this.rolle, nach: { x: BUEHNE.x + 260, y: BUEHNE.y } } : null;
      case 'suchen': {
        const g = this.gesucht.find((x) => !x.gefunden && x.d.c.visible && (x.d.zustand === 'liegt' || x.d.zustand === 'treibt'));
        return g ? { von: seite.koeder, nach: g.d.c } : null;
      }
      case 'finale': return this.zeige || null;
      default: return null;
    }
  }
}
