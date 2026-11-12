// Seite 3: der Waschplatz hinter der Wache.
// Das Auto ist schmutzig: Matsch wegwischen → mit dem Schwamm einschäumen (Schwamm über das Auto ziehen) →
// abspülen (Schlauchrolle antippen – je Tipp ein Schaumfleck – oder festhalten, dann wandert der Strahl von Schaum
// zu Schaum) → Funkeln und Freude. Danach rollt das Auto hinaus und kommt nach einer Weile wieder schmutzig herein
// (endlose Schleife). Die Rolle steht vorn links vor der Fahrspur, das Auto fährt hinter ihr vorbei.

import { spr, sfx, voice, note, tap, drag, wipe, hold, fx, pick, PIXI } from '../../engine/index.js';
import { Seite } from '../../gemeinsam/seiten.js';
import { belohne } from '../../gemeinsam/sticker.js';
import { FeuerAuto, freue, feuerSticker } from './auto.js';
import { Wasserstrahl } from './strahl.js';
import { TonSchleife } from './schleife.js';
import { Vogel, Schmetterling, Wolken, tippStelle, entprellt } from './deko.js';

const AUTO_SKALA = 1.15;

// Matsch und Schaum: Ort im Körper-Bild (Bildpunkte), Bild und Größe
const MATSCH = [
  { tex: 'matsch_a', x: 175, y: 330, s: 0.42, r: 0.3 },
  { tex: 'matsch_d', x: 405, y: 300, s: 0.34, r: -0.1 },
  { tex: 'matsch_b', x: 300, y: 452, s: 0.56, r: 0.03 },
  { tex: 'matsch_e', x: 640, y: 395, s: 0.3, r: 0.4 },
  { tex: 'matsch_c', x: 790, y: 478, s: 0.27, r: 0 },
];
const SCHAUM = [
  { tex: 'schaum_b', x: 170, y: 315, s: 0.42 },
  { tex: 'schaum_b', x: 395, y: 305, s: 0.42 },
  { tex: 'schaum_a', x: 290, y: 455, s: 0.52 },
  { tex: 'schaum_a', x: 600, y: 445, s: 0.42 },
  { tex: 'schaum_b', x: 645, y: 345, s: 0.3 },
  { tex: 'schaum_a', x: 790, y: 470, s: 0.32 },
];
const SCHWAMM_HEIM = { x: -560, y: 1420 };
// Schlauchrolle vorn links, VOR der Fahrspur des Autos (das Auto fährt hinter ihr vorbei); Düsenmündung im Bild
const ROLLE = { x: -930, y: 1500, scale: 0.72, duese: [190, 372] };
const SPUEL_ZEIT = 0.3;       // Sekunden Wasser je Schaumfleck
const MIN_SPUELEN = 0.6;      // so lange spritzt es nach einem kurzen Tipp mindestens
const ABSTELL_ZIEL = { x: -150, y: 1400 };   // wohin der Strahl zielt, solange kein Auto da ist (Boden)
// gemalte Dinge im Hintergrund (Seiten-Koordinaten, aus dem Bild abgelesen)
const REGAL = { x: -830, y: 770, breite: 260, hoehe: 200 };   // gelber und blauer Eimer im Regal unter dem Hahn
const FENSTER = [{ x: -494, y: 590 }, { x: -50, y: 590 }, { x: 396, y: 590 }];

export class Waschplatz extends Seite {
  static hg = 'feuerwehr/hg_waschplatz';

  aufbau() {
    this.zustand = 'matsch';   // 'matsch' | 'schaum' | 'spuelen' | 'sauber' | 'weg'
    this.klack = entprellt(0.5);
    this.schrubb = entprellt(0.45);
    this.platsch = entprellt(0.5);
    this.spritz = entprellt(1.2);
    this.zeit = 0;
    this._p = new PIXI.Point();   // Hilfspunkte, damit beim Spülen nicht jedes Bild neue Objekte entstehen
    this._q = new PIXI.Point();
    this.wasserTon = new TonSchleife('common/wasserstrahl', { vol: 0.5 });

    this.wolken = new Wolken({
      parent: this.hinten,
      liste: [
        { tex: 'common/wolke3', x: -400, y: 150, scale: 0.22, v: 6 },
        { tex: 'common/wolke2', x: 700, y: 230, scale: 0.28, v: 8 },
      ],
    });

    const p = this.punkt('auto', { x: 0, y: 1300 });
    this.autoPlatz = { x: p.x + 60, y: p.y + 70 };
    this.auto = new FeuerAuto({ x: this.autoPlatz.x, y: this.autoPlatz.y, scale: AUTO_SKALA, parent: this.welt, z: 10, fahrer: 'fuchs' });
    tap(this.auto.f.koerper, () => {
      this.klack('common/hupe', { vol: 0.45 });
      this.auto.f.hupf(16);
    }, { sound: null, pad: 40 });

    // Pfütze unter dem Auto: wächst beim Abspülen, trocknet weg, wenn das Auto hinausgefahren ist
    this.pfuetze = spr('feuerwehr/pfuetze_blau', { x: this.autoPlatz.x + 20, y: this.autoPlatz.y + 6, parent: this.welt, z: 5 });
    this.pfuetze.scale.set(1.9, 1.1);
    this.pfuetze.alpha = 0;
    this.pfuetze.eventMode = 'none';

    this.baueMatsch();
    this.baueSchaum();
    this.baueSchwamm();
    this.baueSchlauch();
    this.baueKleinkram();

    this.vogel = new Vogel(this, {
      parent: this.welt,
      scale: 0.85,
      plaetze: [{ x: 186, y: 158 }, { x: -520, y: 262 }, { x: 640, y: 255, flip: true }],
    });
    this.falter = new Schmetterling(this, { x: 860, y: 700, parent: this.welt, farbe: 0xc9b2f2, weite: 100 });
  }

  // Bildpunkt des Auto-Körpers → Koordinaten in fahrzeug.innen
  innen(px, py) {
    const k = this.auto.f.koerper;
    return { x: px - k.anchor.x * k.texture.width, y: py - k.anchor.y * k.texture.height };
  }

  // ---------------------------------------------------------------- Matsch

  baueMatsch() {
    this.matsch = MATSCH.map((m) => {
      const p = this.innen(m.x, m.y);
      const s = spr('waschanlage/' + m.tex, { x: p.x, y: p.y, scale: m.s, parent: this.auto.f.innen });
      s.rotation = m.r;
      s.wisch = wipe(s, {
        radius: 105,
        pad: 70,
        doneAt: 0.7,   // sieht der Fleck weg aus, ist er weg (Krümel wischen sich dann von selbst fort)
        sound: 'common/wisch',
        onProgress: () => { this.gewischt = true; },   // (für den Hinweis „Wisch es sauber!")
        onDone: () => {
          const g = this.vorn.toLocal(s.getGlobalPosition());
          this.burst('funkeln', g.x, g.y, { count: 4 });
          if (this.matsch.every((x) => x.wisch.isDone())) this.matschWeg();
        },
      });
      return s;
    });
  }

  matschWeg() {
    if (this.zustand !== 'matsch') return;
    this.zustand = 'schaum';
    sfx('common/funkeln', { vol: 0.5 });
    fx.pop(this.auto.f.rumpf, 0.04);
    this.after(0.6, () => this.schwammKommt());
  }

  // ---------------------------------------------------------------- Schaum

  baueSchaum() {
    this.schaum = SCHAUM.map((m) => {
      const p = this.innen(m.x, m.y);
      const s = spr('waschanlage/' + m.tex, { x: p.x, y: p.y, scale: 0, parent: this.auto.f.innen });
      s.eventMode = 'none';
      s.ziel = m.s;
      s.da = false;
      s.visible = false;
      return s;
    });
  }

  baueSchwamm() {
    const s = spr('common/schwamm', { x: SCHWAMM_HEIM.x, y: SCHWAMM_HEIM.y, scale: 0.6, parent: this.welt, z: 50 });
    s.visible = false;
    s.eventMode = 'none';
    this.schwamm = s;
    drag(s, {
      pad: 50,
      lift: 1.1,
      onMove: () => this.schrubben(),
      onDrop: () => {
        if (this.zustand !== 'schaum') return;
        // großzügig: ist schon gut die Hälfte eingeschäumt, breitet sich der Rest von selbst aus
        if (this.schaum.filter((x) => x.da).length >= 3) this.restSchaum();
      },
    });
  }

  schwammKommt() {
    const s = this.schwamm;
    s.position.set(SCHWAMM_HEIM.x, SCHWAMM_HEIM.y);
    s.visible = true;
    s.alpha = 0;
    s.eventMode = 'static';
    this.tween(s, { alpha: 1 }, 0.4, { ease: 'sineInOut' });
    fx.pop(s, 0.15);
    sfx('common/plopp', { vol: 0.6 });
  }

  // nur ausblenden (die Position gehört dem Ziehen, das den Schwamm gerade noch heimgleiten lässt)
  schwammWeg() {
    const s = this.schwamm;
    s.eventMode = 'none';
    this.tween(s, { alpha: 0 }, 0.6, { ease: 'sineInOut' }).then((ok) => { if (ok) s.visible = false; });
  }

  schaumAn(sch) {
    sch.da = true;
    sch.visible = true;
    sch.alpha = 0;
    this.tween(sch, { alpha: 1 }, 0.35, { ease: 'sineInOut' });
    this.tween(sch, { scale: sch.ziel }, 0.45, { ease: 'backOut' });
    const g = this.vorn.toLocal(sch.getGlobalPosition());
    this.burst('blasen', g.x, g.y - 20, { count: 3 });
  }

  schrubben() {
    if (this.zustand !== 'schaum') return;
    const s = this.schwamm;
    const innen = this.auto.f.innen;
    const m = innen.toLocal(s.getGlobalPosition());
    let neu = false;
    for (const sch of this.schaum) {
      if (sch.da) continue;
      if (Math.hypot(sch.x - m.x, sch.y - m.y) > 210) continue;
      this.schaumAn(sch);
      neu = true;
    }
    if (neu || Math.random() < 0.05) this.schrubb('common/schrubben', { vol: 0.6 });
    if (this.schaum.every((x) => x.da)) this.schaumFertig();
  }

  async restSchaum() {
    this.schwammWeg();
    for (const sch of this.schaum) {
      if (sch.da || this.zustand !== 'schaum') continue;
      this.schaumAn(sch);
      this.schrubb('common/schrubben', { vol: 0.5 });
      await this.wait(0.3);
    }
    if (this.zustand === 'schaum') this.schaumFertig();
  }

  schaumFertig() {
    if (this.zustand !== 'schaum') return;
    this.zustand = 'spuelen';
    this.after(0.4, () => this.schwammWeg());
  }

  // ---------------------------------------------------------------- Abspülen

  // Abspülen: Schlauchrolle antippen oder festhalten. Jeder Druck spült mindestens einen Schaumfleck ab – der
  // Strahl läuft dafür nach einem kurzen Tipp weiter, bis der Fleck weg ist. Festhalten spült einen nach dem anderen.
  baueSchlauch() {
    this.rolle = spr('feuerwehr/schlauchrolle', { x: ROLLE.x, y: ROLLE.y, scale: ROLLE.scale, parent: this.welt, z: 30 });
    this.strahl = new Wasserstrahl({ parent: this.welt, z: 40, dicke: 58, bogen: 0.35 });
    this.spuelZiel = null;
    this.spuelZeit = 0;
    this.tropfenUhr = 0;
    this.fegZeit = 0;
    this.haelt = false;       // liegt gerade ein Finger auf der Rolle?
    this.spuelBis = 0;        // bis dahin spritzt es mindestens (Seiten-Zeit)
    this.schwaelle = 0;       // so viele Schaumflecken schuldet das Spülen noch kurzen Tipps (höchstens 3)
    this.schwallBis = 0;      // Notbremse: spätestens dann ist auch ein offener Schwall vorbei
    hold(this.rolle, {
      pad: 50,
      onStart: () => {
        if (!this.aktiv) return;
        this.haelt = true;
        this.spuelBis = this.zeit + MIN_SPUELEN;
        if (this.zustand === 'spuelen') {
          this.schwaelle = Math.min(3, this.schwaelle + 1);
          this.schwallBis = this.zeit + 3;
        }
        fx.pop(this.rolle, 0.06);
        if (this.strahl.an) return;
        this.strahl.setze(true);
        this.wasserTon.an();
        this.spritz('common/spritz', { vol: 0.35 });
        this.duesePunkt();
        const z = this.zielPunkt(0);
        this.strahl.ziel.x = z.x;
        this.strahl.ziel.y = z.y;
      },
      onEnd: () => { this.haelt = false; },
    });
  }

  spuelenAus() {
    this.haelt = false;
    this.schwaelle = 0;
    this.strahl.setze(false);
    this.wasserTon.aus();
  }

  duesePunkt() {
    const s = this.strahl;
    const r = this.rolle;
    s.start.x = r.x + (ROLLE.duese[0] - 168) * r.scale.x;
    s.start.y = r.y + (ROLLE.duese[1] - 394) * r.scale.y;
  }

  // Ort eines Punkts in fahrzeug.innen → Seiten-Koordinaten (in den wiederverwendeten Punkt `aus`)
  ausInnen(x, y, aus) {
    this._q.set(x, y);
    this.auto.f.innen.toGlobal(this._q, this._q);
    return this.welt.toLocal(this._q, undefined, aus);
  }

  // Wohin der Strahl gerade zielt (Seiten-Koordinaten): nächster Schaum, sonst langsam über das Auto,
  // und solange das Auto weg ist (oder hereinrollt) auf den Boden davor. → wiederverwendeter Punkt
  zielPunkt(dt) {
    this.fegZeit += dt;
    if (this.zustand === 'weg') return this._p.set(ABSTELL_ZIEL.x + Math.sin(this.fegZeit * 0.8) * 120, ABSTELL_ZIEL.y);
    if (this.zustand === 'spuelen') {
      if (!this.spuelZiel || !this.spuelZiel.da) {
        this.spuelZiel = this.schaum.find((s) => s.da) || null;
        this.spuelZeit = 0;
      }
      if (this.spuelZiel) return this.ausInnen(this.spuelZiel.x, this.spuelZiel.y, this._p);
    }
    const x = Math.sin(this.fegZeit * 0.7) * 300;
    return this.ausInnen(x, -260 + Math.sin(this.fegZeit * 1.3) * 60, this._p);
  }

  spuelTakt(dt) {
    const s = this.strahl;
    if (!s.sichtbar) return;
    this.duesePunkt();
    if (s.an) {
      const z = this.zielPunkt(dt);
      const k = 1 - Math.exp(-dt * 7);
      s.ziel.x += (z.x - s.ziel.x) * k;
      s.ziel.y += (z.y - s.ziel.y) * k;
      // Finger weg, Mindestzeit um und kein Schwall mehr offen: Strahl aus
      if (this.zustand !== 'spuelen' || this.zeit > this.schwallBis) this.schwaelle = 0;
      if (!this.haelt && this.zeit >= this.spuelBis && this.schwaelle === 0) this.spuelenAus();
    }
    s.update(dt);
    if (!s.trifft) return;
    if (this.zustand !== 'weg') this.pfuetze.alpha = Math.min(0.55, this.pfuetze.alpha + dt * 0.15);
    this.tropfenUhr -= dt;
    if (this.tropfenUhr <= 0) {
      this.tropfenUhr = 0.3;
      this.burst('tropfen', s.ziel.x, s.ziel.y, { count: 2 });
    }
    const sch = this.spuelZiel;
    if (this.zustand !== 'spuelen' || !sch) return;
    if (!s.nahe(this.ausInnen(sch.x, sch.y, this._p), 90)) return;
    this.spuelZeit += dt;
    if (this.spuelZeit < SPUEL_ZEIT) return;
    // dieser Schaum ist weg
    sch.da = false;
    this.spuelZiel = null;
    this.schwaelle = Math.max(0, this.schwaelle - 1);
    const g = this.vorn.toLocal(sch.getGlobalPosition());
    this.burst('blasen', g.x, g.y - 10, { count: 4 });
    this.platsch('common/platsch', { vol: 0.4 });
    this.tween(sch, { alpha: 0, scale: sch.ziel * 1.15 }, 0.5, { ease: 'sineInOut' }).then(() => {
      if (!sch.da) { sch.visible = false; sch.scale.set(0); }
    });
    if (this.schaum.every((x) => !x.da)) this.sauber();
  }

  // ---------------------------------------------------------------- Sauber, hinaus, wieder herein

  async sauber() {
    this.zustand = 'sauber';
    await this.wait(0.6);
    const a = this.auto;
    sfx('common/funkeln', { vol: 0.7 });
    a.f.hupf(20);
    // weiche Glanzsterne auf dem Auto (gehen langsam auf und zu, kein Blitzen)
    [[250, 260], [560, 200], [780, 330]].forEach(([x, y], i) => {
      const p = this.innen(x, y);
      const g = spr('waschanlage/glanzstern', { x: p.x, y: p.y, scale: 0, parent: a.f.innen, z: 5 });
      g.alpha = 0;
      this.after(i * 0.35, () => {
        this.tween(g, { alpha: 1, scale: 0.55 }, 0.6, { ease: 'sineOut' })
          .then(() => this.tween(g, { alpha: 0, scale: 0.3, rotation: 0.4 }, 0.8, { ease: 'sineIn' }))
          .then(() => { if (!g.destroyed) g.destroy(); });
      });
    });
    const mitte = this.welt.toLocal(a.f.innen.toGlobal(this.innen(460, 260)));
    this.burst('funkeln', mitte.x, mitte.y, { count: 10 });
    freue(this, a.fahrer, { herzen: 5 });
    belohne(this, feuerSticker('feuerwehr_schlauchrolle'), mitte.x, mitte.y - 300);
    await this.wait(3.2);
    // hinaus nach rechts
    this.zustand = 'weg';
    this.klack('common/hupe', { vol: 0.45 });
    await a.fahre(this, { x: 1800 }, 2.6, 'sineIn');
    this.tween(this.pfuetze, { alpha: 0 }, 2, { ease: 'sineInOut' });
    await this.wait(2.5);
    // unterwegs wieder schmutzig geworden …
    for (const m of this.matsch) m.wisch.reset();
    for (const s of this.schaum) { s.da = false; s.visible = false; s.scale.set(0); }
    a.f.position.set(-1800, this.autoPlatz.y);
    await a.fahre(this, { x: this.autoPlatz.x }, 2.8, 'sineOut');
    this.zustand = 'matsch';
    fx.pop(a.f.rumpf, 0.04);
    // Hat das Kind schon während der Einfahrt alles weggewischt, geht es gleich weiter (keine Sackgasse)
    if (this.matsch.every((m) => m.wisch.isDone())) this.matschWeg();
  }

  // ---------------------------------------------------------------- Kleinkram

  baueKleinkram() {
    const hahn = this.punkt('hahn', { x: -924, y: 700 });
    tippStelle(this.welt, hahn.x - 30, hahn.y - 40, 120, () => {
      this.platsch('common/platsch', { vol: 0.5 });
      this.burst('tropfen', hahn.x + 4, hahn.y - 10, { count: 6 });
    }, { label: 'hahn' });
    // Eimer im Regal unter dem Hahn (gemalt): klack und ein paar Tropfen schwappen heraus
    tippStelle(this.welt, REGAL.x, REGAL.y, 0, () => {
      this.klack('common/klack', { vol: 0.55 });
      this.burst('tropfen', REGAL.x + 20, REGAL.y - 50, { count: 4 });
    }, { label: 'regal', breite: REGAL.breite, hoehe: REGAL.hoehe });
    // die drei Fenster: ein heller Ton, je Fenster ein anderer, und ein kleines Funkeln an der Scheibe
    let plingZeit = -1;
    FENSTER.forEach((f, i) => {
      tippStelle(this.welt, f.x, f.y, 0, () => {
        if (this.zeit - plingZeit > 0.25) {
          plingZeit = this.zeit;
          note('pling', [84, 88, 91][i], { vol: 0.35 });
        }
        this.burst('funkeln', f.x + pick([-40, 0, 40]), f.y - 20, { count: 2 });
      }, { label: 'fenster' + (i + 1), breite: 240, hoehe: 230 });
    });
    const abfluss = this.punkt('abfluss', { x: 965, y: 1095 });
    tippStelle(this.welt, abfluss.x, abfluss.y, 125, () => {
      this.klack('common/blubber', { vol: 0.6 });
      this.burst('blasen', abfluss.x, abfluss.y - 20, { count: 5 });
    }, { label: 'abfluss' });
  }

  // ---------------------------------------------------------------- Ablauf

  betreten() {
    // Hinweis bei jedem Betreten anmelden (der Kern sagt ihn höchstens einmal am Tag) – nur, solange die Seite zu
    // sehen ist, das Auto voller Matsch dasteht und das Kind noch nicht selbst gewischt hat
    this._hinweis?.kill();
    const passt = () => this.aktiv && this.zustand === 'matsch' && !this.gewischt;
    this._hinweis = this.after(2, () => { if (passt()) voice('feuerwehr_waschen', { nurWenn: passt }); });
  }

  verlassen() {
    this._hinweis?.kill();
    this._hinweis = null;
    this.spuelenAus();
    this.wasserTon.weg();
  }

  update(dt) {
    this.zeit += dt;
    this.auto.update(dt);
    this.wolken.update(dt);
    this.vogel.update(dt);
    this.falter.update(dt);
    this.spuelTakt(dt);
  }

  hinweise() {
    if (this.zustand === 'matsch') {
      const m = this.matsch.find((x) => !x.wisch.isDone());
      return m ? [m] : [];
    }
    if (this.zustand === 'schaum' && this.schwamm.visible) return [{ von: this.schwamm, nach: this.auto.f.koerper }];
    if (this.zustand === 'spuelen') return [this.rolle];
    return [this.auto.f.koerper];
  }
}

