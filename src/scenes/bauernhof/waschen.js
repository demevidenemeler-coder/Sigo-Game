// Seite 4 – Waschen und Scheren.
// Links: Das Schwein liegt in der Matschpfütze und kommt mit Matschflecken zum Waschplatz. Matsch wegwischen →
// dann liegt Seifenschaum auf dem Rücken: wegwischen oder mit dem Schlauch abspülen (Düse ziehen/halten) → das
// Schwein glänzt und freut sich – und hüpft nach einer Weile wieder in die Pfütze (endlose Schleife).
// Rechts: Das Schaf steht von der Seite; die Wolle wegwischen (Schermaschine summt leise) → Wollballen hüpfen in
// den Sack. Nach einer Weile wächst die Wolle weich nach.

import { Actor, voice, fx, meta, tex, tap, drag, wipe, rand, clamp, PIXI } from '../../engine/index.js';
import { Seite } from '../../gemeinsam/seiten.js';
import { belohne } from '../../gemeinsam/sticker.js';
import { ton, laut, bildFigur, bogenFlug, Wolken, Vogel, Schmetterling, wackelDing } from './hilfen.js';

const SCHWEIN_HOEHE = 470;
const SCHAF_HOEHE = 470;
// Matschflecken auf dem Schwein (Bildpunkte relativ zum Anker des Bilds schwein_idle) und Größe
const MATSCH = [
  { id: 'bauernhof/matsch1', x: -60, y: -330, s: 0.42 },   // Bauchseite
  { id: 'bauernhof/matsch2', x: 110, y: -165, s: 0.46 },   // vorn unten am Bein
  { id: 'bauernhof/matsch3', x: -235, y: -455, s: 0.36 },  // Rücken/Po (nicht übers Gesicht)
];
const SCHAUM = { x: 40, y: -470, s: 1.0 };
// Wolle (tiere/schaf_seite) über dem geschorenen Schaf: Versatz in Bildpunkten des geschorenen Bilds
const WOLLE = { x: 6, y: 4, s: 800 / 900 };
const TROPFEN_ANZAHL = 30;
const WISCH_ZUGABE = 80;      // Wischflächen reichen rundum so viele Bühnen-Einheiten über das Schwein hinaus
const BRAUN = 0x8a5a33;

// Die drei Matschflecken als ein gemeinsames Bild (einmal pro Modul gebaut und wiederverwendet).
// → {textur, x, y}: x/y = linke obere Ecke in Bildpunkten des Schweins (relativ zum Anker)
let matschCache = null;
function matschTextur() {
  if (matschCache && !matschCache.textur.destroyed) return matschCache;
  const teile = MATSCH.map((m) => {
    const t = tex(m.id);
    const w = t.width * m.s;
    const h = t.height * m.s;
    return { t, x: m.x - w / 2, y: m.y - h / 2, w, h };
  });
  const x0 = Math.floor(Math.min(...teile.map((p) => p.x)));
  const y0 = Math.floor(Math.min(...teile.map((p) => p.y)));
  const x1 = Math.ceil(Math.max(...teile.map((p) => p.x + p.w)));
  const y1 = Math.ceil(Math.max(...teile.map((p) => p.y + p.h)));
  try {
    const c = document.createElement('canvas');
    c.width = x1 - x0;
    c.height = y1 - y0;
    // willReadFrequently: Die Leinwand bleibt im Hauptspeicher. wipe() liest sie beim Seitenaufbau einmal zurück
    // (welche Stellen Matsch haben) – auf der Grafikkarte kostete das Zurücklesen spürbar Zeit beim Umblättern.
    const g = c.getContext('2d', { willReadFrequently: true });
    for (const p of teile) {
      const q = p.t.source.resource;
      const f = p.t.frame;
      const r = p.t.source.resolution || 1;
      g.drawImage(q, f.x * r, f.y * r, f.width * r, f.height * r, p.x - x0, p.y - y0, p.w, p.h);
    }
    matschCache = { textur: PIXI.Texture.from(c), x: x0, y: y0 };
  } catch (e) {
    // Bild nicht lesbar (sollte nicht vorkommen): nur der große Fleck
    console.warn('[bauernhof] Matsch-Bild nicht zusammensetzbar:', e);
    const p = teile[0];
    return { textur: p.t, x: p.x, y: p.y, einzeln: MATSCH[0].s };
  }
  return matschCache;
}

export class Waschen extends Seite {
  static hg = 'bauernhof/hg_waschen';

  aufbau() {
    this.pfuetze = this.punkt('pfuetze', { x: -955, y: 1205 });
    const w = this.punkt('waschplatz', { x: 5, y: 1250 });
    // etwas rechts und vorn auf dem Pflaster: der Wasserhahn an der Mauer bleibt sichtbar und antippbar
    this.waschplatz = { x: w.x + 45, y: w.y + 50 };
    // in der Pfütze weit genug rechts, damit das Schwein nicht unter dem linken Blätter-Pfeil liegt
    this.liegeplatz = { x: this.pfuetze.x + 160, y: this.pfuetze.y + 18 };
    this._pg = new PIXI.Point();   // wiederverwendete Punkte (keine neuen Objekte pro Bild)
    this._pl = new PIXI.Point();
    this._mitte = { x: 0, y: 0 };

    this.wolken = new Wolken(this.hinten, { anzahl: 2, yVon: 60, yBis: 190 });
    this.vogel = new Vogel(this, { x: -360, y: 628 }, { skala: 0.65, z: 4, farbe: 0xf2b45c });
    this.falter = new Schmetterling(this, { x0: 380, y0: 960, x1: 1000, y1: 1180 }, { skala: 0.75, eltern: this.vorn });

    this.baueTropfen();
    this.baueSchwein();
    this.baueSchlauch();
    this.baueSchaf();
    this.baueNebensachen();
  }

  // Hinweise bei jedem Betreten anmelden (der Kern sagt jeden höchstens einmal am Tag): „Wisch den Matsch …" nur,
  // wenn Matsch zu sehen ist (liegt das Schwein noch sauber in der Pfütze, kommt er, sobald es am Waschplatz ist),
  // „Wisch dem Schaf …" danach bzw. gleich. Beide nur, solange die Seite zu sehen ist und das Kind das noch nicht
  // selbst begonnen hat – auch, wenn ein Satz erst später an die Reihe kommt.
  betreten() {
    this._hinweis?.kill();
    this._hinweis = this.after(2.5, () => this.hinweisAnbieten());
  }

  verlassen() {
    this._hinweis?.kill();
    this._hinweis = null;
  }

  waschenPasst() {
    return this.aktiv && !this.gewaschen && this.matsch.some((m) => m.visible && !m.sauber);
  }

  scherenPasst() {
    return this.aktiv && !this.wolleBeruehrt && !this.wolleFertig;
  }

  hinweisAnbieten() {
    if (!this.aktiv) return;
    const scheren = () => this.scherenPasst();
    if (this.waschenPasst()) {
      voice('bauernhof_waschen', { nurWenn: () => this.waschenPasst() }).then(() => {
        if (!this.aktiv) return;   // inzwischen weggeblättert: beim nächsten Betreten wird neu angeboten
        this._hinweis?.kill();
        this._hinweis = this.after(3, () => { if (scheren()) voice('bauernhof_scheren', { nurWenn: scheren }); });
      });
    } else if (scheren()) {
      voice('bauernhof_scheren', { nurWenn: scheren });
    }
  }

  // ---------------------------------------------------------------- Schwein

  baueSchwein() {
    const skala = SCHWEIN_HOEHE / (meta('tiere/schwein_idle').h || 900);
    const s = new Actor('schwein', { x: this.liegeplatz.x, y: this.liegeplatz.y, scale: skala, parent: this.welt, z: 30 });
    this.schwein = s;

    // Matsch und Schaum liegen auf dem Bild des Schweins (spiegeln und atmen mit)
    // Matsch: Die drei Flecken sind EIN Bild (einmal zusammengesetzt), damit ein Wisch-Strich überall auf dem
    // Schwein wirkt und nur ein Bild gewischt werden muss.
    const mt = matschTextur();
    const decke = new PIXI.Sprite(mt.textur);
    decke.label = 'matsch';
    decke.position.set(mt.x, mt.y);
    const k = mt.einzeln || 1;   // nur im Notfall (Einzelbild) verkleinert
    decke.scale.set(k);
    s.sprite.addChild(decke);
    const z = WISCH_ZUGABE / skala;   // Zugabe in Bildpunkten des Schweins
    decke.wisch = wipe(decke, {
      radius: 100,
      doneAt: 0.8,
      // Tippfläche: der ganze Körper des Schweins und rundum etwas mehr (kleine Kinder setzen oft daneben an)
      hitArea: new PIXI.Rectangle((-340 - z - mt.x) / k, (-720 - z - mt.y) / k, (680 + 2 * z) / k, (700 + 2 * z) / k),
      sound: 'common/wisch',
      onProgress: () => { this.gewaschen = true; },   // (für den Hinweis „Wisch den Matsch …")
      onDone: () => this.fleckWeg(decke),
    });
    decke.visible = false;
    decke.sauber = true;
    decke.eventMode = 'none';
    this.matsch = [decke];
    const sch = new PIXI.Sprite(tex('bauernhof/schaumdecke'));
    sch.anchor.set(0.5);
    sch.position.set(SCHAUM.x, SCHAUM.y);
    sch.scale.set(SCHAUM.s);
    s.sprite.addChild(sch);
    sch.wisch = wipe(sch, {
      radius: 100,
      hitArea: new PIXI.Rectangle(-390 - z, -270 - z, 780 + 2 * z, 600 + 2 * z),
      sound: 'common/schrubben',
      onProgress: () => { this.gewaschen = true; if (Math.random() < 0.25) this.burst('blasen', this.schweinMitte().x + rand(-80, 80), this.schweinMitte().y - 60, { count: 1 }); },
      onDone: () => this.fleckWeg(sch),
    });
    sch.visible = false;
    sch.sauber = true;
    sch.eventMode = 'none';
    this.schaum = sch;

    s.onTap(() => {
      laut('schwein', 1.0);
      fx.wobble(s, 0.04);
      if (this.zustand === 'pfuetze' && this.zeit > 1) {
        ton('common/platsch', { vol: 0.6, abstand: 1 });
        this.zeit = 99; // steht gleich auf
      } else if (this.zustand === 'sauber') {
        s.cheer();
      }
    });

    // (Tippfläche oben nach dem Stehbild bemessen – passt auch fürs Liegen)
    s.pose('sleep');
    this.zustand = 'pfuetze';
    this.zeit = 0;
  }

  schweinMitte(ziel = { x: 0, y: 0 }) {
    ziel.x = this.schwein.x + (this.schwein.flip ? -20 : 20);
    ziel.y = this.schwein.y - 230;
    return ziel;
  }

  fleckWeg(o) {
    if (o.sauber) return;
    o.sauber = true;
    o.eventMode = 'none'; // verdeckt keine anderen Flecken mehr
    if (this.zustand === 'matsch' && this.matsch.every((m) => m.sauber)) this.schaumKommt();
    else if (this.zustand === 'schaum' && this.schaum.sauber) this.schweinSauber();
  }

  // Schwein steht in der Pfütze auf (mit Matsch) und hüpft zum Waschplatz
  async zumWaschplatz() {
    this.zustand = 'unterwegs';
    const s = this.schwein;
    s.pose('idle');
    for (const m of this.matsch) {
      m.visible = true;
      m.sauber = false;
      m.eventMode = 'none';   // erst am Waschplatz wischbar (sonst wäre der Matsch unterwegs schon weg)
      m.wisch.reset({ fade: 0.6 });
    }
    ton('common/platsch', { vol: 0.5, abstand: 0.5 });
    this.matschSpritzer(this.liegeplatz.x, this.liegeplatz.y - 40);
    await this.wait(0.9);
    const ziel = this.waschplatz;
    const von = { x: s.x, y: s.y };
    for (let i = 1; i <= 3; i++) {
      const k = i / 3;
      ton('common/hupf', { vol: 0.4, abstand: 0.2 });
      if (!(await s.hopTo(von.x + (ziel.x - von.x) * k, von.y + (ziel.y - von.y) * k, { hoehe: 70, dauer: 0.5 }))) break;
    }
    s.position.set(ziel.x, ziel.y);
    s.lookAt(9999);
    this.zustand = 'matsch';
    for (const m of this.matsch) if (!m.sauber) m.eventMode = 'static';
    // jetzt ist der Matsch wischbar: Hinweis kurz danach anbieten (nur, solange die Seite zu sehen ist und noch
    // nicht gewaschen wurde – wischt das Kind gleich los, braucht es ihn nicht; der Kern sagt ihn höchstens einmal
    // am Tag)
    this.after(1.5, () => { if (this.waschenPasst()) voice('bauernhof_waschen', { nurWenn: () => this.waschenPasst() }); });
    // Sicherheitsnetz: ist der Matsch (z. B. schon abgespült) weg, geht es gleich mit dem Schaum weiter
    if (this.matsch.every((m) => m.sauber)) this.schaumKommt();
  }

  schaumKommt() {
    this.zustand = 'schaum';
    const sch = this.schaum;
    sch.visible = true;
    sch.sauber = false;
    sch.eventMode = 'static';
    sch.wisch.reset({ fade: 0.7 });
    ton('common/schrubben', { vol: 0.6, abstand: 0.5 });
    const m = this.schweinMitte();
    this.burst('blasen', m.x, m.y - 80, { count: 6 });
  }

  schweinSauber() {
    this.zustand = 'sauber';
    this.zeit = 0;
    const s = this.schwein;
    const m = this.schweinMitte();
    this.burst('funkeln', m.x, m.y, { count: 10 });
    ton('common/funkeln', { vol: 0.6 });
    this.after(0.5, () => s.cheer());
    this.after(1.4, () => belohne(this, 'tier_schwein', m.x, m.y - 360));
  }

  async zurPfuetze() {
    this.zustand = 'unterwegs';
    const s = this.schwein;
    for (const m of [...this.matsch, this.schaum]) { m.visible = false; m.sauber = true; m.eventMode = 'none'; }
    laut('schwein', 1);
    const ziel = this.liegeplatz;
    const von = { x: s.x, y: s.y };
    for (let i = 1; i <= 4; i++) {
      const k = i / 4;
      ton('common/hupf', { vol: 0.4, abstand: 0.2 });
      if (!(await s.hopTo(von.x + (ziel.x - von.x) * k, von.y + (ziel.y - von.y) * k, { hoehe: i === 4 ? 120 : 70, dauer: 0.5 }))) break;
    }
    s.position.set(ziel.x, ziel.y);
    ton('common/platsch', { vol: 0.8, abstand: 0.5 });
    this.matschSpritzer(ziel.x, ziel.y - 30);
    s.pose('sleep');
    this.zustand = 'pfuetze';
    this.zeit = 0;
  }

  // ---------------------------------------------------------------- Tropfen (Wasser und Matsch)

  baueTropfen() {
    this.tropfen = [];
    for (let i = 0; i < TROPFEN_ANZAHL; i++) {
      const t = new PIXI.Sprite(tex('common/p_tropfen'));
      t.anchor.set(0.5);
      t.scale.set(0.16);
      t.visible = false;
      t.zIndex = 70;
      t.eventMode = 'none';
      t.leben = 0;
      this.welt.addChild(t);
      this.tropfen.push(t);
    }
    this.naechsterTropfen = 0;
  }

  tropfen1(x, y, vx, vy, farbe = 0xffffff, leben = 0.7) {
    const t = this.tropfen[this.naechsterTropfen];
    this.naechsterTropfen = (this.naechsterTropfen + 1) % this.tropfen.length;
    t.position.set(x, y);
    t.vx = vx;
    t.vy = vy;
    t.leben = leben;
    t.tint = farbe;
    t.alpha = 0.9;
    t.visible = true;
  }

  matschSpritzer(x, y) {
    for (let i = 0; i < 7; i++) {
      const w = -Math.PI / 2 + rand(-1.1, 1.1);
      const v = rand(260, 420);
      this.tropfen1(x + rand(-60, 60), y, Math.cos(w) * v, Math.sin(w) * v, BRAUN, 0.6);
    }
  }

  bewegeTropfen(dt) {
    for (const t of this.tropfen) {
      if (!t.visible) continue;
      t.leben -= dt;
      t.vy += 900 * dt;
      t.x += t.vx * dt;
      t.y += t.vy * dt;
      t.rotation = Math.atan2(t.vy, t.vx) - Math.PI / 2;
      if (t.leben < 0.2) t.alpha = Math.max(0, t.leben / 0.2) * 0.9;
      if (t.leben <= 0) t.visible = false;
    }
  }

  // ---------------------------------------------------------------- Schlauch

  baueSchlauch() {
    this.rolle = { x: 294, y: 824 };
    // Die Düse hängt rechts unter der Schlauchrolle (nicht vor dem Kopf des Schweins)
    this.dueseRuhe = { x: 400, y: 968, r: 1.15 };
    this.schlauchLinie = new PIXI.Graphics();
    this.schlauchLinie.zIndex = 64;
    this.welt.addChild(this.schlauchLinie);

    const d = new PIXI.Container({ label: 'duese' });
    d.position.set(this.dueseRuhe.x, this.dueseRuhe.y);
    d.zIndex = 66;
    this.welt.addChild(d);
    const bild = new PIXI.Sprite(tex('bauernhof/schlauch_duese'));
    bild.anchor.set(0.5);
    bild.label = 'bauernhof/schlauch_duese';
    bild.scale.set(0.5);
    bild.rotation = this.dueseRuhe.r;
    d.addChild(bild);
    this.duese = d;
    this.dueseBild = bild;
    // Spitze der Düse und Schlauchende in Bildkoordinaten der Düse (einmal ausgerechnet)
    const dm = meta('bauernhof/schlauch_duese');
    const sp = dm.pts?.spitze || [372, 95];
    const tw = bild.texture.width;
    const th = bild.texture.height;
    this.spitzeLokal = new PIXI.Point((sp[0] / (dm.w || tw) - 0.5) * tw, (sp[1] / (dm.h || th) - 0.5) * th);
    this.schlauchEndeLokal = new PIXI.Point(55 - 188, 385 - 200);
    this.spritzt = false;
    this.spritzTakt = 0;
    drag(d, {
      hitArea: new PIXI.Circle(0, 0, 140),
      lift: 1.06,
      onStart: () => {
        this.spritzt = true;
        if (this.zustand === 'matsch' || this.zustand === 'schaum') this.gewaschen = true;
        ton('common/spritz', { vol: 0.6, abstand: 0.3 });
      },
      onDrop: (ziel, ctx) => {
        this.spritzt = false;
        ctx.back(0.6);
        this.tween(bild, { rotation: this.dueseRuhe.r, scaleX: 0.5 }, 0.5, { ease: 'sineInOut' });
      },
    });
    this.zeichneSchlauch();
  }

  zeichneSchlauch() {
    const b = this.dueseBild;
    const d = this.duese;
    // nur neu zeichnen, wenn sich die Düse bewegt hat
    const stand = d.x + d.y * 7 + b.rotation * 1000 + b.scale.x * 100 + d.scale.x * 10;
    if (stand === this.schlauchStand) return;
    this.schlauchStand = stand;
    // Schlauchende an der Düse (unten links am Griff, Bildpunkt 55/390 des Bilds 376×400)
    const ende = this.welt.toLocal(b.toGlobal(this.schlauchEndeLokal, this._pg), undefined, this._pl);
    const r = this.rolle;
    const mx = (r.x + ende.x) / 2;
    const my = Math.max(r.y, ende.y) + 90;
    this.schlauchLinie.clear()
      .moveTo(r.x, r.y).quadraticCurveTo(mx, my, ende.x, ende.y).stroke({ width: 22, color: 0x3f8a35, cap: 'round' })
      .moveTo(r.x, r.y - 5).quadraticCurveTo(mx, my - 6, ende.x, ende.y - 5).stroke({ width: 6, color: 0x7cc46a, alpha: 0.7, cap: 'round' })
      .circle(r.x, r.y, 20).fill(0x2f6d28);
  }

  // Wohin zielt die Düse? (auf das Schwein, wenn es nah ist, sonst zur Bildmitte)
  zielen() {
    const d = this.duese;
    const m = this.schweinMitte(this._mitte);
    const nah = Math.hypot(m.x - d.x, m.y - d.y) < 950;
    const ziel = this._zielP || (this._zielP = { x: 0, y: 0 });
    if (nah) { ziel.x = m.x; ziel.y = m.y; } else { ziel.x = d.x < 0 ? d.x + 400 : d.x - 400; ziel.y = d.y + 60; }
    this._nah = nah;
    const links = ziel.x < d.x;
    const winkel = Math.atan2(ziel.y - d.y, ziel.x - d.x);
    const b = this.dueseBild;
    b.scale.x = links ? -0.5 : 0.5;
    const r = links ? winkel - Math.PI : winkel;
    b.rotation = clamp(Math.atan2(Math.sin(r), Math.cos(r)), -0.7, 0.7);
    return ziel;
  }

  spritzen(dt) {
    const ziel = this.zielen();
    const nah = this._nah;
    const p = this.welt.toLocal(this.dueseBild.toGlobal(this.spitzeLokal, this._pg), undefined, this._pl);
    this.spritzTakt -= dt;
    while (this.spritzTakt <= 0) {
      this.spritzTakt += 1 / 22;
      const w = Math.atan2(ziel.y - 60 - p.y, ziel.x - p.x) + rand(-0.12, 0.12);
      const v = rand(620, 760);
      this.tropfen1(p.x, p.y, Math.cos(w) * v, Math.sin(w) * v - 120, 0xffffff, 0.65);
    }
    ton('common/spritz', { vol: 0.55, abstand: 1.8 });
    // Wasser spült Matsch und Schaum ab
    const m = this.schweinMitte(this._mitte);
    if (nah && Math.hypot(m.x - p.x, m.y - p.y) < 620) {
      if (this.zustand === 'matsch') {
        for (const o of this.matsch) this.abspuelen(o, dt);
      } else if (this.zustand === 'schaum') {
        this.abspuelen(this.schaum, dt);
        if (Math.random() < dt * 4) this.burst('blasen', m.x + rand(-90, 90), m.y - 80, { count: 1 });
      } else if (this.zustand === 'sauber' && !this.schwein._freude) {
        this.schwein.cheer();
      }
    }
  }

  abspuelen(o, dt) {
    if (o.sauber || !o.visible) return;
    o.alpha = Math.max(0, o.alpha - dt * 0.6);
    if (o.alpha <= 0.05) {
      o.visible = false;
      this.fleckWeg(o);
    }
  }

  // ---------------------------------------------------------------- Schaf

  baueSchaf() {
    const p = this.punkt('schafplatz', { x: 915, y: 1270 });
    // etwas weiter links als der Punkt, damit der Blätter-Pfeil rechts frei bleibt; schaut zum Schwein
    const ort = { x: Math.min(p.x, 835), y: p.y };
    const skala = SCHAF_HOEHE / (meta('bauernhof/schaf_geschoren').h || 800);
    const schaf = bildFigur('bauernhof/schaf_geschoren', 'schaf', {
      x: ort.x, y: ort.y, scale: skala, parent: this.welt, z: 40, punkte: { kopf: [530, 90] },
    });
    schaf.flip = true;
    this.schaf = schaf;
    schaf.onTap(() => {
      laut('schaf', 1.2);
      fx.wobble(schaf, 0.04);
    });

    // Wolle: das wollige Schaf von der Seite, deckungsgleich darüber
    const wm = meta('tiere/schaf_seite');
    const wolle = new PIXI.Sprite(tex('tiere/schaf_seite'));
    wolle.anchor.set(wm.ax, wm.ay);
    wolle.scale.set(WOLLE.s);
    wolle.position.set(WOLLE.x, WOLLE.y);
    schaf.sprite.addChild(wolle);
    this.wolle = wolle;
    this.wolleZuletzt = 0;
    this.wolleFertig = false;
    this.ballenWarten = 0;
    this.wolleWisch = wipe(wolle, {
      radius: 120,
      pad: 30,
      onProgress: (p) => {
        this.wolleBeruehrt = true;   // (für den Hinweis „Wisch dem Schaf die Wolle ab")
        ton('common/schermaschine', { vol: 0.32, abstand: 2.6 });
        while (p - this.wolleZuletzt >= 0.16) {
          this.wolleZuletzt += 0.16;
          this.ballenWarten++;
        }
      },
      onDone: () => this.geschoren(),
    });

    // Wollsack zwischen Waschplatz und Schaf
    this.sack = this.bild('bauernhof/wollsack', 505, 1318, 0.58, 45);
    wackelDing(this.sack, { ton: 'common/plopp', vol: 0.5, pad: 40 });
  }

  geschoren() {
    this.wolleFertig = true;
    this.ballenWarten++;
    this.after(0.6, () => this.schaf.cheer());
    this.after(1.2, () => belohne(this, 'tier_schaf', this.schaf.x, this.schaf.y - 560));
    // nach einer Weile wächst die Wolle weich nach
    this.after(10, () => {
      ton('common/wachsen', { vol: 0.4 });
      this.wolleWisch.reset({ fade: 3 });
      this.wolleZuletzt = 0;
      this.wolleFertig = false;
    });
  }

  wollballen() {
    const s = this.schaf;
    const b = this.bild('bauernhof/wolle_ballen', s.x + rand(-110, 120), s.y - rand(190, 330), 0, 80);
    b.anchor.set(0.5);
    b.eventMode = 'none';
    ton('common/plopp', { vol: 0.6, abstand: 0.12 });
    this.tween(b, { scale: 0.3 }, 0.3, { ease: 'backOut' }).then((ok) => {
      if (!ok || b.destroyed) return;
      const ziel = { x: this.sack.x, y: this.sack.y - this.sack.height * 0.82 };
      bogenFlug(this, b, ziel.x, ziel.y, { dauer: 0.75, hoehe: 160, skala: 0.18 }).then(() => {
        if (b.destroyed) return;
        fx.pop(this.sack, 0.06);
        ton('common/landen', { vol: 0.5, abstand: 0.12 });
        this.tween(b, { alpha: 0 }, 0.25).then(() => { if (!b.destroyed) b.destroy(); });
      });
    });
  }

  // ---------------------------------------------------------------- Nebensachen

  baueNebensachen() {
    // Wasserhahn an der Mauer: ein paar Tropfen. Die Tippfläche liegt auf Griff und Rohr (über dem Kopf des
    // Schweins) und liegt über dem Schwein, damit der Hahn nie verdeckt ist.
    const h = this.punkt('hahn', { x: -101, y: 910 });
    const hahn = new PIXI.Container({ label: 'wasserhahn' });
    hahn.position.set(h.x, h.y);
    hahn.zIndex = 31;
    this.welt.addChild(hahn);
    tap(hahn, () => {
      ton('common/spritz', { vol: 0.5, abstand: 0.8 });
      for (let i = 0; i < 6; i++) this.tropfen1(h.x + 30 + rand(-8, 8), h.y + 20, rand(-30, 30), rand(0, 120), 0xffffff, 0.55);
    }, { sound: null, squash: false, hitArea: new PIXI.Circle(-35, -115, 112) });

    // Pfütze: platscht (wenn das Schwein nicht drin liegt)
    const pf = new PIXI.Container({ label: 'pfuetze' });
    pf.position.set(this.pfuetze.x, this.pfuetze.y);
    pf.zIndex = 3;
    this.welt.addChild(pf);
    tap(pf, () => {
      ton('common/platsch', { vol: 0.6, abstand: 0.8 });
      this.matschSpritzer(this.pfuetze.x + rand(-120, 120), this.pfuetze.y);
    }, { sound: null, squash: false, hitArea: new PIXI.Ellipse(0, 0, 380, 130) });
  }

  bild(id, x, y, skala, z) {
    const s = new PIXI.Sprite(tex(id));
    const m = meta(id);
    s.anchor.set(m.ax, m.ay);
    s.scale.set(skala);
    s.position.set(x, y);
    s.zIndex = z;
    s.label = id;
    this.welt.addChild(s);
    return s;
  }

  // ---------------------------------------------------------------- Ablauf

  update(dt) {
    this.wolken.update(dt);
    this.vogel.update(dt);
    this.falter.update(dt);
    this.bewegeTropfen(dt);

    // Schwein: Pfütze → Waschplatz → (sauber) → Pfütze …
    this.zeit += dt;
    if (this.zustand === 'pfuetze') {
      if (Math.floor(this.zeit / 1.6) !== Math.floor((this.zeit - dt) / 1.6)) fx.wobble(this.schwein, 0.05);
      if (this.zeit > 3.5) this.zumWaschplatz();
    } else if (this.zustand === 'sauber' && this.zeit > 9) {
      this.zurPfuetze();
    }

    // Schlauch
    if (this.spritzt) this.spritzen(dt);
    this.zeichneSchlauch();

    // Wollballen nacheinander (nicht alle auf einmal)
    this.ballenZeit = (this.ballenZeit ?? 0) - dt;
    if (this.ballenWarten > 0 && this.ballenZeit <= 0) {
      this.ballenWarten--;
      this.ballenZeit = 0.28;
      this.wollballen();
    }
  }

  hinweise() {
    const liste = [];
    if (this.zustand === 'matsch') {
      const fleck = this.matsch.find((m) => !m.sauber && m.visible);
      if (fleck) liste.push(fleck);
      liste.push({ von: this.dueseBild, nach: this.schwein });
    } else if (this.zustand === 'schaum') {
      liste.push({ von: this.dueseBild, nach: this.schwein }, this.schaum);
    }
    if (!this.wolleFertig) liste.push(this.wolle);
    liste.push(this.schwein);
    return liste;
  }
}
