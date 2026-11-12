// Seite 3: der Waschplatz hinter der Wache.
// Kette je Runde (gut 1–2 Minuten, nichts kann schiefgehen):
//   (Auto rollt herein, wenn es vom Einsatz kommt) → Schmutz wegwischen (Matsch, Laub oder Sand; Ruß nur nach
//   einem Feuer; zweimal dieselbe Art hintereinander: eine zweite mischt sich dazu) → Schwamm in den Schaum-Eimer
//   tauchen → Auto einschäumen → abspülen (Schlauchrolle antippen oder festhalten) → mit dem Tuch trocken reiben,
//   bis es glänzt → Auto antippen: es fährt heim zur Wache.
// Kleine ruhige Überraschungen (abwechselnd): ein Frosch hüpft aus dem Schaum, eine Ente planscht in der Pfütze.
// Was wächst: über dem Waschplatz hängt nach jeder Wäsche ein Wimpel mehr (bis die Kette voll ist).

import { spr, tex, sfx, voice, note, tap, drag, wipe, hold, fx, pick, shuffle, isTest, Actor, PIXI } from '../../engine/index.js';
import { Seite } from '../../gemeinsam/seiten.js';
import { belohne } from '../../gemeinsam/sticker.js';
import { FeuerAuto, freue, feuerSticker } from './auto.js';
import { Wasserstrahl } from './strahl.js';
import { TonSchleife } from './schleife.js';
import { Vogel, Schmetterling, Wolken, tippStelle, entprellt, tippRand } from './deko.js';
import { wimpelZahl, wimpelDazu, WIMPEL_MAX } from './einsaetze.js';

const { Container, Graphics } = PIXI;

const AUTO_SKALA = 1.15;

// Schmutz-Stellen: Ort im Körper-Bild (Bildpunkte), Größe (für Matsch), Drehung. Je Runde 4–5 davon.
const FLECKEN = [
  { x: 175, y: 330, s: 0.42, r: 0.3 },
  { x: 405, y: 300, s: 0.34, r: -0.1 },
  { x: 300, y: 452, s: 0.5, r: 0.03 },
  { x: 640, y: 395, s: 0.3, r: 0.4 },
  { x: 790, y: 478, s: 0.27, r: 0 },
  { x: 540, y: 462, s: 0.3, r: -0.3 },
  { x: 245, y: 235, s: 0.28, r: 0.15 },
];
const MATSCH_TEX = ['matsch_a', 'matsch_d', 'matsch_b', 'matsch_e', 'matsch_c', 'matsch_b', 'matsch_d'];
// Arten von Schmutz: Bild je Stelle, Größenfaktor, Färbung
const SCHMUTZ = {
  matsch: { bilder: MATSCH_TEX.map((t) => 'feuerwehr/' + t), faktor: 1 },
  // Ruß: graue Rauchwölkchen (eigene Form, nicht wie Matsch) – kommt nur nach einem Feuer-Einsatz
  russ: { bilder: ['common/p_rauch'], faktor: 2.9, tint: 0x6a6670, platz: 'rauch', nurVomFeuer: true },
  laub: { bilder: ['common/p_blatt_herbst', 'common/p_blatt', 'common/p_blatt_herbst'], faktor: 2.9, platz: 'blaetter' },
  sand: { bilder: ['common/p_staub'], faktor: 2.9, tint: 0xf3dcae, platz: 'staub' },
};
const SCHMUTZ_ARTEN = Object.keys(SCHMUTZ);

const SCHAUM = [
  { tex: 'schaum_b', x: 170, y: 315, s: 0.42 },
  { tex: 'schaum_b', x: 395, y: 305, s: 0.42 },
  { tex: 'schaum_a', x: 290, y: 455, s: 0.52 },
  { tex: 'schaum_a', x: 600, y: 445, s: 0.42 },
  { tex: 'schaum_b', x: 645, y: 345, s: 0.3 },
  { tex: 'schaum_a', x: 790, y: 470, s: 0.32 },
];
// Glanzstellen fürs Trockenreiben (Körper-Bildpunkte)
const GLANZ = [[230, 290], [470, 230], [700, 330], [420, 470]];

// Dinge vorn rechts neben dem Auto (die Ecke unten rechts bleibt frei)
const EIMER = { x: 770, y: 1395, scale: 0.55 };
const SCHWAMM_HEIM = { x: 560, y: 1470 };         // Schwamm liegt neben dem Eimer
const SCHWAMM_NASS = { x: 770, y: 1060 };         // nach dem Eintauchen: über dem Eimer
const TUCH_HEIM = { x: 560, y: 1475 };

// Schlauchrolle vorn links, VOR der Fahrspur des Autos (das Auto fährt hinter ihr vorbei); Düsenmündung im Bild
const ROLLE = { x: -930, y: 1500, scale: 0.72, duese: [190, 372] };
const SPUEL_ZEIT = 0.3;       // Sekunden Wasser je Schaumfleck
const MIN_SPUELEN = 0.6;      // so lange spritzt es nach einem kurzen Tipp mindestens
const ABSTELL_ZIEL = { x: -150, y: 1400 };   // wohin der Strahl zielt, solange kein Auto da ist (Boden)
// gemalte Dinge im Hintergrund (Seiten-Koordinaten, aus dem Bild abgelesen)
const REGAL = { x: -830, y: 770, breite: 260, hoehe: 200 };   // gelber und blauer Eimer im Regal unter dem Hahn
const FENSTER = [{ x: -494, y: 590 }, { x: -50, y: 590 }, { x: 396, y: 590 }];
const FENSTER_B = 240;
const FENSTER_H = 230;
// Wimpelkette unter der Dachkante
const KETTE = { x0: -760, x1: 760, y: 448, durchhang: 34 };
const WIMPEL_FARBEN = [0xe8705f, 0xf2bd55, 0x74b6e2, 0x93c86f, 0xc8a6e8, 0xf29ab6, 0xf5d36a, 0x7fcfc0, 0xf0a05a];

// Nur zum Testen (mit test=1): ?schmutz=<art>, ?ueber=frosch|ente|keine
let testSchmutz = null;
let testUeber = null;
try {
  const q = new URLSearchParams(location.search);
  if (isTest && SCHMUTZ[q.get('schmutz')]) testSchmutz = q.get('schmutz');
  if (isTest && ['frosch', 'ente', 'keine'].includes(q.get('ueber'))) testUeber = q.get('ueber');
} catch { /* egal */ }

export class Waschplatz extends Seite {
  static hg = 'feuerwehr/hg_waschplatz';

  aufbau() {
    // 'einfahrt' | 'schmutz' | 'eintauchen' | 'schaum' | 'spuelen' | 'polieren' | 'fertig' | 'weg'
    this.zustand = 'schmutz';
    this.runde = 0;
    this.letzterSchmutz = null;
    this.letzteUeber = 'ente';
    this.klack = entprellt(0.5);
    this.schrubb = entprellt(0.45);
    this.reib = entprellt(0.4);
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
    tap(this.auto.f.koerper, () => this.autoAngetippt(), { sound: null, pad: 40 });

    // Pfütze unter dem Auto: wächst beim Abspülen, trocknet weg, wenn das Auto hinausgefahren ist
    this.pfuetze = spr('feuerwehr/pfuetze_blau', { x: this.autoPlatz.x + 20, y: this.autoPlatz.y + 6, parent: this.welt, z: 5 });
    this.pfuetze.scale.set(1.9, 1.1);
    this.pfuetze.alpha = 0;
    this.pfuetze.eventMode = 'none';

    this.baueWimpel();
    this.baueSchmutz();
    this.baueSchaum();
    this.baueEimer();
    this.baueSchwamm();
    this.baueTuch();
    this.baueSchlauch();
    this.baueKleinkram();

    this.vogel = new Vogel(this, {
      parent: this.welt,
      scale: 0.85,
      plaetze: [{ x: 186, y: 158 }, { x: -520, y: 262 }, { x: 640, y: 255, flip: true }],
    });
    this.falter = new Schmetterling(this, { x: 860, y: 700, parent: this.welt, farbe: 0xc9b2f2, weite: 100 });

    // Kommt das Auto gleich vom Einsatz herein, steht es anfangs draußen (betreten() lässt es hereinrollen)
    if (this.szene.waschKommt) {
      this.zustand = 'weg';
      this.auto.f.x = -1800;
    } else {
      this.neuerSchmutz();
    }
    this.ueber = this.naechsteUeberraschung();
  }

  // Bildpunkt des Auto-Körpers → Koordinaten in fahrzeug.innen
  innen(px, py) {
    const k = this.auto.f.koerper;
    return { x: px - k.anchor.x * k.texture.width, y: py - k.anchor.y * k.texture.height };
  }

  // Ort eines Punkts in fahrzeug.innen → Seiten-Koordinaten (in den wiederverwendeten Punkt `aus`)
  ausInnen(x, y, aus) {
    this._q.set(x, y);
    this.auto.f.innen.toGlobal(this._q, this._q);
    return this.welt.toLocal(this._q, undefined, aus);
  }

  // ---------------------------------------------------------------- Schmutz

  // Für jede Art eigene Wisch-Bilder (einmal gebaut); sichtbar sind nur die der aktuellen Runde
  baueSchmutz() {
    this.schmutz = {};
    for (const art of SCHMUTZ_ARTEN) {
      const def = SCHMUTZ[art];
      this.schmutz[art] = FLECKEN.map((f, i) => {
        const pos = this.innen(f.x, f.y);
        const tex = def.bilder[i % def.bilder.length];
        // Blätter und Sand sind kleine Bilder: etwas größer ziehen (ähnlich groß wie die Matschflecken)
        const scale = def.faktor === 1 ? f.s : 1.15 + (f.s - 0.27) * 1.6;
        const s = spr(tex, { x: pos.x, y: pos.y, scale, parent: this.auto.f.innen });
        s.rotation = def.faktor === 1 ? f.r : f.r * 2.2;
        if (def.tint !== undefined) s.tint = def.tint;
        s.visible = false;
        s.wisch = wipe(s, {
          radius: 105,
          pad: 70,
          doneAt: 0.55,  // sieht der Fleck weg aus, ist er weg (Krümel wischen sich dann von selbst fort; ein kräftiger Strich genügt meist)
          sound: art === 'laub' ? 'common/rascheln' : 'common/wisch',
          onProgress: () => { this.gewischt = true; },   // (für den Hinweis „Wisch es sauber!")
          onDone: () => {
            const g = this.vorn.toLocal(s.getGlobalPosition());
            this.burst(def.platz || 'funkeln', g.x, g.y, { count: 4 });
            this.after(0.8, () => { if (s.wisch.isDone()) s.visible = false; });
            if (this.flecken.every((x) => x.wisch.isDone())) this.schmutzWeg();
          },
        });
        return s;
      });
    }
    this.flecken = [];
  }

  // Neue Schmutz-Art für diese Runde: vom Einsatz mitgebracht, sonst abwechselnd (nie zweimal dieselbe)
  neuerSchmutz() {
    let art = testSchmutz || this.szene.schmutz;
    testSchmutz = null;
    this.szene.schmutz = null;
    if (!SCHMUTZ[art] || (art === this.letzterSchmutz && !this.vomEinsatz)) {
      // ohne Einsatz: Matsch, Laub oder Sand (Ruß gibt es nur nach einem Feuer)
      art = pick(SCHMUTZ_ARTEN.filter((a) => a !== this.letzterSchmutz && !SCHMUTZ[a].nurVomFeuer));
    }
    // Bringt der Einsatz dieselbe Art wie beim letzten Mal (zweimal Feuer hintereinander), mischt sich eine
    // zweite Art dazu – so sieht das Auto trotzdem jedes Mal anders aus.
    const misch = art === this.letzterSchmutz
      ? pick(SCHMUTZ_ARTEN.filter((a) => a !== art && !SCHMUTZ[a].nurVomFeuer))
      : null;
    this.letzterSchmutz = art;
    this.schmutzArt = art;
    for (const liste of Object.values(this.schmutz)) for (const s of liste) s.visible = false;
    const n = Math.random() < 0.5 ? 4 : 5;
    const auswahl = shuffle(FLECKEN.map((_, i) => i)).slice(0, n);
    const gemischt = misch ? new Set(auswahl.slice(0, 2)) : null;
    auswahl.sort((a, b) => a - b);
    this.flecken = auswahl.map((i) => this.schmutz[gemischt?.has(i) ? misch : art][i]);
    for (const s of this.flecken) {
      s.wisch.reset();
      s.visible = true;
    }
    this.gewischt = false;
  }

  schmutzWeg() {
    if (this.zustand !== 'schmutz') return;
    this.zustand = 'eintauchen';
    sfx('common/funkeln', { vol: 0.5 });
    fx.pop(this.auto.f.rumpf, 0.04);
    this.after(0.6, () => this.schwammKommt());
  }

  // ---------------------------------------------------------------- Schaum-Eimer und Schwamm

  baueEimer() {
    const e = spr('feuerwehr/eimer_schaum', { x: EIMER.x, y: EIMER.y, scale: EIMER.scale, parent: this.welt, z: 30 });
    this.eimer = e;
    tap(e, () => {
      if (this.zustand === 'eintauchen' && this.schwamm.eventMode !== 'none') this.eintauchen();
      else {
        this.klack('common/blubber', { vol: 0.5 });
        this.burst('blasen', e.x, e.y - 110, { count: 4 });
      }
    }, { sound: null, pad: 60 });
  }

  baueSchwamm() {
    // erst trocken; nach dem Eintauchen das Bild mit Schaumhaube
    this.schwammTrocken = tex('feuerwehr/schwamm_trocken');
    this.schwammNass = tex('common/schwamm');
    const s = spr('feuerwehr/schwamm_trocken', { x: SCHWAMM_HEIM.x, y: SCHWAMM_HEIM.y, scale: 0.6, parent: this.welt, z: 50 });
    s.visible = false;
    s.eventMode = 'none';
    this.schwamm = s;
    this.schwammHeim = SCHWAMM_HEIM;
    drag(s, {
      pad: 60,
      lift: 1.1,
      heim: () => this.schwammHeim,
      targets: () => (this.zustand === 'eintauchen' ? [{ x: EIMER.x, y: EIMER.y - 170, radius: 240 }] : []),
      onStart: () => { this.schwammGezogen = true; },
      onMove: () => this.schrubben(),
      onDrop: (ziel, ctx) => {
        if (this.zustand === 'eintauchen' && ziel) {
          ctx.erledigt = true;
          this.eintauchen();
          return;
        }
        if (this.zustand !== 'schaum') return;
        // großzügig: ist schon gut die Hälfte eingeschäumt, breitet sich der Rest von selbst aus
        if (this.schaum.filter((x) => x.da).length >= 3) this.restSchaum();
      },
    });
  }

  schwammKommt() {
    const s = this.schwamm;
    this.schwammHeim = SCHWAMM_HEIM;
    s.position.set(SCHWAMM_HEIM.x, SCHWAMM_HEIM.y);
    s.texture = this.schwammTrocken;
    s.scale.set(0.6);
    s.visible = true;
    s.alpha = 0;
    s.eventMode = 'static';
    this.schwammGezogen = false;
    this.tween(s, { alpha: 1 }, 0.4, { ease: 'sineInOut' });
    fx.pop(s, 0.15);
    sfx('common/plopp', { vol: 0.6 });
    this.hinweisSatz('feuerwehr_schwamm', () => !this.schwammGezogen, 2.5);
  }

  // Schwamm taucht in den Schaum-Eimer und kommt schaumig wieder heraus
  async eintauchen() {
    if (this.zustand !== 'eintauchen') return;
    const r = this.runde;
    this.zustand = 'tauchen';
    const s = this.schwamm;
    s.eventMode = 'none';
    s.zIndex = 50;   // selbst gesetzt: das Ziehen setzt den zIndex dann nicht verspätet zurück
    // (der Eimer steht mit dem Boden auf EIMER.y, sein Rand liegt gut 230 Einheiten höher)
    await this.tween(s, { x: EIMER.x, y: EIMER.y - 330 }, 0.35, { ease: 'sineOut' });
    if (r !== this.runde) return;
    s.zIndex = 29;   // hinter den Eimerrand
    sfx('common/blubber', { vol: 0.55 });
    await this.tween(s, { y: EIMER.y - 205 }, 0.4, { ease: 'sineInOut' });
    if (r !== this.runde) return;
    this.burst('blasen', EIMER.x, EIMER.y - 250, { count: 6 });
    await this.wait(0.35);
    if (r !== this.runde) return;
    s.texture = this.schwammNass;   // mit Schaumhaube wieder heraus
    s.scale.set(0.5);
    await this.tween(s, { x: SCHWAMM_NASS.x, y: SCHWAMM_NASS.y }, 0.5, { ease: 'sineOut' });
    if (r !== this.runde) return;
    s.zIndex = 50;
    this.schwammHeim = SCHWAMM_NASS;
    this.zustand = 'schaum';
    this.schwammGezogen = false;
    s.eventMode = 'static';
    this.schrubb('common/schrubben', { vol: 0.4 });
    this.hinweisSatz(null);
  }

  // nur ausblenden (die Position gehört dem Ziehen, das den Schwamm gerade noch heimgleiten lässt)
  schwammWeg() {
    const s = this.schwamm;
    s.eventMode = 'none';
    this.tween(s, { alpha: 0 }, 0.6, { ease: 'sineInOut' }).then((ok) => { if (ok) s.visible = false; });
  }

  baueSchaum() {
    this.schaum = SCHAUM.map((m) => {
      const p = this.innen(m.x, m.y);
      const s = spr('feuerwehr/' + m.tex, { x: p.x, y: p.y, scale: 0, parent: this.auto.f.innen });
      s.eventMode = 'none';
      s.ziel = m.s;
      s.da = false;
      s.visible = false;
      return s;
    });
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
    const m = this.auto.f.innen.toLocal(s.getGlobalPosition());
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
    const r = this.runde;
    this.schwammWeg();
    for (const sch of this.schaum) {
      if (sch.da || this.zustand !== 'schaum') continue;
      this.schaumAn(sch);
      this.schrubb('common/schrubben', { vol: 0.5 });
      await this.wait(0.3);
      if (r !== this.runde) return;
    }
    if (this.zustand === 'schaum') this.schaumFertig();
  }

  schaumFertig() {
    if (this.zustand !== 'schaum') return;
    this.zustand = 'spuelen';
    this.after(0.4, () => this.schwammWeg());
    if (this.ueber === 'frosch') this.after(1.0, () => this.froschImSchaum(this.runde));
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

  // Wohin der Strahl gerade zielt (Seiten-Koordinaten): nächster Schaum, sonst langsam über das Auto,
  // und solange das Auto weg ist (oder hereinrollt) auf den Boden davor. → wiederverwendeter Punkt
  zielPunkt(dt) {
    this.fegZeit += dt;
    if (this.zustand === 'weg' || this.zustand === 'einfahrt') {
      return this._p.set(ABSTELL_ZIEL.x + Math.sin(this.fegZeit * 0.8) * 120, ABSTELL_ZIEL.y);
    }
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
    if (this.zustand !== 'weg' && this.zustand !== 'einfahrt') this.pfuetze.alpha = Math.min(0.55, this.pfuetze.alpha + dt * 0.15);
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
    if (this.schaum.every((x) => !x.da)) this.gespuelt();
  }

  gespuelt() {
    if (this.zustand !== 'spuelen') return;
    this.zustand = 'polieren';
    this.after(0.8, () => this.tuchKommt());
    if (this.ueber === 'ente') this.after(1.6, () => this.enteInDerPfuetze(this.runde));
  }

  // ---------------------------------------------------------------- Trockenreiben mit dem Tuch

  baueTuch() {
    const t = spr('common/handtuch', { x: TUCH_HEIM.x, y: TUCH_HEIM.y, scale: 0.5, parent: this.welt, z: 50 });
    t.visible = false;
    t.eventMode = 'none';
    this.tuch = t;
    drag(t, {
      pad: 60,
      lift: 1.1,
      heim: TUCH_HEIM,
      onStart: () => { this.tuchGezogen = true; },
      onMove: () => this.reiben(),
      onDrop: () => {
        if (this.zustand !== 'polieren') return;
        if (this.glanz.filter((g) => g.da).length >= 2) this.restGlanz();
      },
    });
    this.glanz = GLANZ.map(([x, y]) => {
      const p = this.innen(x, y);
      const g = spr('feuerwehr/glanzstern', { x: p.x, y: p.y, scale: 0, parent: this.auto.f.innen, z: 5 });
      g.eventMode = 'none';
      g.visible = false;
      g.da = false;
      return g;
    });
  }

  tuchKommt() {
    if (this.zustand !== 'polieren') return;
    const t = this.tuch;
    t.position.set(TUCH_HEIM.x, TUCH_HEIM.y);
    t.visible = true;
    t.alpha = 0;
    t.eventMode = 'static';
    this.tuchGezogen = false;
    this.tween(t, { alpha: 1 }, 0.4, { ease: 'sineInOut' });
    fx.pop(t, 0.12);
    sfx('common/plopp', { vol: 0.5 });
    this.hinweisSatz('feuerwehr_tuch', () => !this.tuchGezogen, 2.5);
  }

  tuchWeg() {
    const t = this.tuch;
    t.eventMode = 'none';
    this.tween(t, { alpha: 0 }, 0.6, { ease: 'sineInOut' }).then((ok) => { if (ok) t.visible = false; });
  }

  glanzAn(g) {
    g.da = true;
    g.visible = true;
    g.alpha = 0;
    g.rotation = 0;
    this.tween(g, { alpha: 1 }, 0.5, { ease: 'sineInOut' });
    this.tween(g, { scale: 0.5 }, 0.6, { ease: 'backOut' });
    note('pling', pick([84, 88, 91]), { vol: 0.3 });
  }

  reiben() {
    if (this.zustand !== 'polieren') return;
    const m = this.auto.f.innen.toLocal(this.tuch.getGlobalPosition());
    let neu = false;
    for (const g of this.glanz) {
      if (g.da) continue;
      if (Math.hypot(g.x - m.x, g.y - m.y) > 200) continue;
      this.glanzAn(g);
      neu = true;
    }
    if (neu || Math.random() < 0.05) this.reib('common/wisch', { vol: 0.5 });
    if (this.glanz.every((g) => g.da)) this.sauber();
  }

  async restGlanz() {
    const r = this.runde;
    this.tuchWeg();
    for (const g of this.glanz) {
      if (g.da || this.zustand !== 'polieren') continue;
      this.glanzAn(g);
      await this.wait(0.35);
      if (r !== this.runde) return;
    }
    if (this.zustand === 'polieren') this.sauber();
  }

  // ---------------------------------------------------------------- Sauber, Wimpel, heimfahren

  async sauber() {
    if (this.zustand !== 'polieren') return;
    const r = this.runde;
    this.zustand = 'glaenzt';
    this.after(0.3, () => this.tuchWeg());
    await this.wait(0.5);
    if (r !== this.runde) return;
    const a = this.auto;
    sfx('common/funkeln', { vol: 0.7 });
    a.f.hupf(20);
    const mitte = this.welt.toLocal(a.f.innen.toGlobal(this.innen(460, 260)));
    this.burst('funkeln', mitte.x, mitte.y, { count: 10 });
    freue(this, a.fahrer, { herzen: 5 });
    belohne(this, feuerSticker('feuerwehr_schlauchrolle'), mitte.x, mitte.y - 300);
    await this.wait(1.6);
    if (r !== this.runde) return;
    this.wimpelWaechst();
    await this.wait(1.4);
    if (r !== this.runde) return;
    // Glanzsterne gehen langsam wieder zu
    for (const g of this.glanz) {
      this.tween(g, { alpha: 0, scale: 0.3, rotation: 0.4 }, 1.0, { ease: 'sineIn' }).then(() => {
        if (!g.da) return;
        g.da = false;
        g.visible = false;
        g.scale.set(0);
      });
    }
    this.zustand = 'fertig';
    this.auto.blaulicht(true);
    this.after(1.6, () => { if (this.zustand === 'fertig') this.auto.blaulicht(false); });
  }

  autoAngetippt() {
    if (this.zustand === 'fertig') {
      this.heimfahren();
      return;
    }
    this.klack('common/hupe', { vol: 0.45 });
    this.auto.f.hupf(16);
  }

  // Sauber nach Hause: ist die Wache gerade leer (das Auto war im Einsatz), blättert es zur Wache weiter.
  // Sonst fährt es eine Runde und kommt nach einer Weile wieder schmutzig herein (endlose Schleife).
  async heimfahren() {
    const r = this.runde;
    this.zustand = 'weg';
    this.hinweisSatz(null);
    const a = this.auto;
    this.auto.tatue(this, 2.5);
    fx.pop(a.fahrer, 0.1);
    await this.wait(0.6);
    if (r !== this.runde) return;
    await a.fahre(this, { x: 1800 }, 2.6, 'sineIn');
    if (r !== this.runde) return;
    this.tween(this.pfuetze, { alpha: 0 }, 2, { ease: 'sineInOut' });
    const wache = this.szene.seiten?.[0];
    const heim = this.vomEinsatz || wache?.zustand === 'weg';
    this.vomEinsatz = false;
    if (heim && this.aktiv && this.szene.nr === this.index && !this.szene.gleitet) {
      // Kommt das Kind später wieder her, rollt das Auto (frisch schmutzig) wieder herein – siehe betreten()
      this.wartetDraussen = true;
      this.szene.zeigeSeite(0);
      return;
    }
    await this.wait(2.5);
    if (r !== this.runde) return;
    this.neueRunde({ einfahrt: true });
  }

  aufraeumen() {
    this.spuelenAus();
    this.hinweisSatz(null);
    for (const s of this.schaum) { s.da = false; s.visible = false; s.scale.set(0); }
    for (const g of this.glanz) { g.da = false; g.visible = false; g.scale.set(0); }
    this.schwamm.visible = false;
    this.schwamm.eventMode = 'none';
    this.schwamm.zIndex = 50;
    this.tuch.visible = false;
    this.tuch.eventMode = 'none';
    this.spuelZiel = null;
    this.auto.blaulicht(false);
  }

  naechsteUeberraschung() {
    let u = testUeber;
    testUeber = null;
    if (!u) u = Math.random() < 0.2 ? 'keine' : this.letzteUeber === 'frosch' ? 'ente' : 'frosch';
    if (u !== 'keine') this.letzteUeber = u;
    return u;
  }

  // Neue Runde: Auto rollt (mit neuem Schmutz) von links herein
  async neueRunde({ einfahrt = true } = {}) {
    this.runde++;
    this.wartetDraussen = false;
    const r = this.runde;
    this.aufraeumen();
    this.neuerSchmutz();
    this.ueber = this.naechsteUeberraschung();
    const a = this.auto;
    if (!einfahrt) {
      a.f.position.set(this.autoPlatz.x, this.autoPlatz.y);
      this.zustand = 'schmutz';
      return;
    }
    this.zustand = 'einfahrt';
    a.f.position.set(-1800, this.autoPlatz.y);
    this.tween(this.pfuetze, { alpha: 0 }, 1.2, { ease: 'sineInOut' });
    if (this.vomEinsatz) a.blaulicht(true);
    await a.fahre(this, { x: this.autoPlatz.x }, 2.8, 'sineOut');
    if (r !== this.runde) return;
    a.blaulicht(false);
    this.zustand = 'schmutz';
    fx.pop(a.f.rumpf, 0.04);
    this.klack('common/hupe', { vol: 0.4 });
    // Hat das Kind schon während der Einfahrt alles weggewischt, geht es gleich weiter (keine Sackgasse)
    if (this.flecken.every((m) => m.wisch.isDone())) this.schmutzWeg();
    else this.waschHinweis(1.5);
  }

  // ---------------------------------------------------------------- Wimpelkette (wächst über die Runden)

  kettePunkt(t) {
    const k = KETTE;
    const x = k.x0 + (k.x1 - k.x0) * t;
    const y = k.y + Math.sin(Math.PI * t) * k.durchhang;
    return { x, y };
  }

  baueWimpel() {
    const k = KETTE;
    const schnur = new Graphics();
    schnur.moveTo(k.x0, k.y);
    for (let i = 1; i <= 24; i++) {
      const p = this.kettePunkt(i / 24);
      schnur.lineTo(p.x, p.y);
    }
    schnur.stroke({ width: 7, color: 0x7a5a3c, alpha: 0.95 });
    schnur.circle(k.x0, k.y, 9).fill(0x8a6a4a).circle(k.x1, k.y, 9).fill(0x8a6a4a);
    schnur.zIndex = -5;
    schnur.eventMode = 'none';
    this.welt.addChild(schnur);
    this.wimpel = [];
    for (let i = 0; i < WIMPEL_MAX; i++) {
      const p = this.kettePunkt((i + 1) / (WIMPEL_MAX + 1));
      const c = new Container({ label: 'wimpel' });
      c.position.set(p.x, p.y - 2);
      const farbe = WIMPEL_FARBEN[i % WIMPEL_FARBEN.length];
      c.addChild(new Graphics()
        .moveTo(-56, 0).lineTo(56, 0).lineTo(4, 122).quadraticCurveTo(0, 130, -4, 122).closePath().fill(farbe)
        .moveTo(-40, 8).lineTo(-10, 8).lineTo(-20, 56).closePath().fill({ color: 0xffffff, alpha: 0.28 })
        .roundRect(-60, -7, 120, 13, 6).fill(0x8a6a4a));
      c.zIndex = -4;
      c.eventMode = 'none';
      c.visible = i < wimpelZahl();
      c.phase = i * 0.9;
      this.welt.addChild(c);
      this.wimpel.push(c);
    }
    this.schaukeln = 0;
    // Die ganze Kette ist antippbar (ein einzelner Wimpel wäre zu klein): alle Wimpel schaukeln, ein leises Wusch.
    // Hängt ein Wimpel vor einem Fenster, klingt das Fenster mit (seine eigene Fläche liegt teils dahinter).
    const wusch = entprellt(0.8);
    tippStelle(this.welt, 0, KETTE.y + 72, 0, (e) => {
      this.schaukeln = Math.max(this.schaukeln, 0.6);
      if (wusch('common/wusch', { vol: 0.35 })) this.burst('funkeln', e.x, KETTE.y + 40, { count: 2 });
      FENSTER.forEach((f, i) => {
        if (Math.abs(e.x - f.x) < FENSTER_B / 2 && Math.abs(e.y - f.y) < FENSTER_H / 2) this.fensterTipp?.(i);
      });
    }, { label: 'wimpelkette', z: 2, breite: KETTE.x1 - KETTE.x0 + 80, hoehe: 230 });
  }

  wimpelWaechst() {
    const vorher = wimpelZahl();
    if (vorher >= WIMPEL_MAX) {
      // Kette ist voll: alle schaukeln fröhlich, ein paar Funken
      this.schaukeln = 1;
      this.burst('funkeln', 0, KETTE.y + 70, { count: 6 });
      sfx('common/funkeln', { vol: 0.45 });
      return;
    }
    const n = wimpelDazu();
    const w = this.wimpel[n - 1];
    w.visible = true;
    w.alpha = 0;
    w.scale.set(1, 0.1);
    this.tween(w, { alpha: 1 }, 0.6, { ease: 'sineInOut' });
    this.tween(w.scale, { y: 1 }, 0.8, { ease: 'backOut' });
    sfx('common/wachsen', { vol: 0.45 });
    this.burst('funkeln', w.x, w.y + 50, { count: 4 });
    this.schaukeln = 0.6;
    if (n === WIMPEL_MAX) this.after(1.0, () => { this.burst('sterne', 0, KETTE.y + 70, { count: 6 }); sfx('common/applaus', { vol: 0.35 }); });
  }

  wimpelTakt(dt) {
    this.schaukeln = Math.max(0, this.schaukeln - dt * 0.35);
    const weite = 0.04 + this.schaukeln * 0.16;
    for (const w of this.wimpel) {
      if (!w.visible) continue;
      w.rotation = Math.sin(this.zeit * 1.3 + w.phase) * weite;
    }
  }

  // ---------------------------------------------------------------- Überraschungen

  // Ein Frosch guckt aus dem Schaum auf dem Dach, hüpft herunter und davon
  async froschImSchaum(r) {
    if (r !== this.runde || this.frosch) return;
    const i = this.innen(400, 240);
    const start = this.ausInnen(i.x, i.y, new PIXI.Point());
    const f = new Actor('frosch', { x: start.x, y: start.y, scale: 0.17, parent: this.welt, z: 15 });
    this.frosch = f;
    f.schatten.visible = false;
    f.alpha = 0;
    f.flip = true;
    f.onTap(() => { fx.wobble(f); f.sound(); }, { pad: tippRand(f) });
    this.burst('blasen', start.x, start.y - 40, { count: 5 });
    await this.tween(f, { alpha: 1 }, 0.5, { ease: 'sineInOut' });
    f.sound();
    await this.wait(0.9);
    if (f.destroyed) return;
    await f.hopTo(-420, 1470, { hoehe: 220, dauer: 1.1 });
    if (f.destroyed) return;
    f.schatten.visible = true;
    this.platsch('common/platsch', { vol: 0.35 });
    await this.wait(0.6);
    if (f.destroyed) return;
    for (const x of [-760, -1100, -1500]) {
      await f.hopTo(x, 1480, { hoehe: 120, dauer: 0.7 });
      if (f.destroyed) return;
    }
    f.destroy({ children: true });
    if (this.frosch === f) this.frosch = null;
  }

  // Eine Ente watschelt herbei, planscht in der Pfütze und watschelt wieder davon
  async enteInDerPfuetze(r) {
    if (r !== this.runde || this.ente) return;
    const y = this.autoPlatz.y + 70;
    const e = new Actor('ente', { x: 1500, y, scale: 0.22, parent: this.welt, z: 20, flip: true });
    this.ente = e;
    e.onTap(() => { fx.wobble(e); e.sound(); }, { pad: tippRand(e) });
    await e.walkTo(330, y, { tempo: 300 });
    if (e.destroyed) return;
    for (let i = 0; i < 2; i++) {
      await e.hop(50);
      if (e.destroyed) return;
      this.platsch('common/platsch', { vol: 0.45 });
      this.burst('tropfen', e.x, e.y - 10, { count: 4 });
      await this.wait(0.35);
    }
    e.sound();
    await this.wait(1.0);
    if (e.destroyed) return;
    e.flip = false;
    await e.walkTo(1550, y, { tempo: 300 });
    if (!e.destroyed) e.destroy({ children: true });
    if (this.ente === e) this.ente = null;
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
    this.fensterTipp = (i) => {
      const f = FENSTER[i];
      if (this.zeit - plingZeit > 0.25) {
        plingZeit = this.zeit;
        note('pling', [84, 88, 91][i], { vol: 0.35 });
      }
      this.burst('funkeln', f.x + pick([-40, 0, 40]), f.y - 20, { count: 2 });
    };
    FENSTER.forEach((f, i) => {
      tippStelle(this.welt, f.x, f.y, 0, () => this.fensterTipp(i),
        { label: 'fenster' + (i + 1), breite: FENSTER_B, hoehe: FENSTER_H });
    });
    const abfluss = this.punkt('abfluss', { x: 965, y: 1095 });
    tippStelle(this.welt, abfluss.x, abfluss.y, 125, () => {
      this.klack('common/blubber', { vol: 0.6 });
      this.burst('blasen', abfluss.x, abfluss.y - 20, { count: 5 });
    }, { label: 'abfluss' });
  }

  // ---------------------------------------------------------------- Ablauf

  hinweisSatz(id, bedingung = () => true, verz = 1.5) {
    this._hinweis?.kill();
    this._hinweis = null;
    this._hinweisNeu = null;
    if (!id) return;
    const zustand = this.zustand;
    const passt = () => this.aktiv && this.zustand === zustand && bedingung();
    this._hinweisNeu = () => this.hinweisSatz(id, bedingung, 2);
    this._hinweis = this.after(verz, () => { if (passt()) voice(id, { nurWenn: passt }); });
  }

  waschHinweis(verz = 2) {
    this.hinweisSatz('feuerwehr_waschen', () => !this.gewischt, verz);
  }

  betreten() {
    // Kommt das Auto gerade vom Einsatz: neu schmutzig hereinrollen lassen
    if (this.szene.waschKommt) {
      this.szene.waschKommt = false;
      this.vomEinsatz = true;
      this.neueRunde({ einfahrt: true });
      return;
    }
    if (this.wartetDraussen) {
      this.neueRunde({ einfahrt: true });
      return;
    }
    if (this.zustand === 'schmutz') this.waschHinweis(2);
    else this._hinweisNeu?.();
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
    this.wimpelTakt(dt);
    this.spuelTakt(dt);
  }

  hinweise() {
    switch (this.zustand) {
      case 'schmutz': {
        const m = this.flecken.find((x) => !x.wisch.isDone());
        return m ? [m] : [];
      }
      case 'eintauchen':
        return this.schwamm.visible ? [{ von: this.schwamm, nach: this.eimer }] : [];
      case 'schaum':
        return this.schwamm.visible ? [{ von: this.schwamm, nach: this.auto.f.koerper }] : [];
      case 'spuelen':
        return [this.rolle];
      case 'polieren': {
        const g = this.glanz.find((x) => !x.da);
        if (!this.tuch.visible || !g) return [];
        const p = this.ausInnen(g.x, g.y, new PIXI.Point());
        return [{ von: this.tuch, nach: { x: p.x, y: p.y } }];
      }
      // fertig, und während etwas von selbst läuft: aufs Auto zeigen (nicht auf den Pfeil zur nächsten Seite)
      default:
        return [this.auto.f.koerper];
    }
  }
}
