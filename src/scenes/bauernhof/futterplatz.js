// Seite 1 – Füttern. Eine Fütter-Runde hat mehrere Schritte:
//   1. Scheunentor antippen → vier Tiere kommen heraus (jede Runde andere; manchmal ein kleiner Überraschungsgast)
//   2. Jedes Tier zeigt in der Denkblase, was es gern hätte → Futter aus der Leiste zum Tier ziehen (vier Mal)
//   3. Alle satt → die Leiste verschwindet, vorn steht der leere Wassertrog: den Wassereimer zum Trog ziehen
//   4. Durstige Tiere antippen → jedes geht zum Trog, trinkt, freut sich und läuft hinaus auf die Weide
//   5. Alle getrunken → Sticker; die Weide hinter dem Zaun füllt sich Runde um Runde (bleibt gespeichert)
// Die erste Runde beginnt mit Tieren, die schon da sind (Schritt 2). Nichts kann falsch gemacht werden: Nicht
// gemochtes Futter hüpft zurück, ein Tier, das schon trinkt, nickt nur.
// Nebensachen: Scheunentor, Traktor, Strohballen, Wassereimer, Vogel auf dem Zaun, Schmetterling, Wolken,
// Tiere auf der Weide (antippen: Laut und Hüpfer).

import { Actor, voice, fx, meta, tex, tap, drag, rand, pick, shuffle, store, PIXI } from '../../engine/index.js';
import { Seite } from '../../gemeinsam/seiten.js';
import { fuettere, futterAuswahl, mag } from '../../gemeinsam/futter.js';
import { belohne, sticker as stickerVon } from '../../gemeinsam/sticker.js';
import { ton, laut, Wolken, Vogel, Schmetterling, wackelDing, engeTippflaeche } from './hilfen.js';

const TIERE = ['kuh', 'schwein', 'schaf', 'pferd', 'huhn', 'hase', 'hund', 'katze', 'ente'];
const GAESTE = ['maus', 'hahn'];          // kleine Überraschungsgäste (höchstens einer je Runde)
// Höhe der Tiere auf dem Bild (Bühnen-Einheiten) – große Tiere etwas größer
const HOEHE = {
  kuh: 540, pferd: 545, schwein: 500, schaf: 505, hund: 500, katze: 470, hase: 490, huhn: 470, ente: 460,
  maus: 400, hahn: 470,
};

// Scheunentor im Hintergrundbild (Bildpunkte des Hintergrunds 2829×1600)
const TOR = { x0: 595, xm: 807, x1: 1010, y0: 597, y1: 940 };
const HG_BREITE = 2829;
// Traktor: klein auf der Wiese hinter dem Zaun (rechts oben, über den Köpfen der Tiere, links vom Blätter-Pfeil)
const TRAKTOR = { x: 860, y: 688, skala: 0.22 };
// Wassertrog vorn in der Mitte (erscheint, wenn alle satt sind – dort lag vorher die Futterleiste)
const TROG = { x: 0, y: 1458, skala: 1.0 };
const TROG_INNEN = { x: 40, y: 26, w: 420, h: 44 };   // Wasserfläche im Bild futtertrog (500×185)
const TRINK_PLAETZE = [{ x: -235, y: 1330 }, { x: 235, y: 1330 }];
// Wer getrunken hat, läuft hier hinaus (und blendet am Bildrand weich aus)
const AUSGANG = { x: 1180, y: 1250 };
// Ruhe-Regel: höchstens so viele Tiere laufen gleichzeitig (zum Trog, zur Seite, hinaus, auf die Weide)
const GLEICHZEITIG = 2;
const EIMER = { x: -935, y: 1395, skala: 0.5 };
// Weide hinter dem Zaun: dort grasen die Tiere der letzten Runden (klein, weit hinten)
const WEIDE_PLAETZE = [{ x: 150, y: 724 }, { x: 300, y: 710 }, { x: 450, y: 726 }, { x: 600, y: 712 }, { x: 375, y: 690 }];
const WEIDE_HOEHE = 105;
const WEIDE_KEY = 'bauernhof.weide';
const MILCHWEISS = 0x8fd0f2;

export class Futterplatz extends Seite {
  static hg = 'bauernhof/hg_futter';

  aufbau() {
    this.plaetze = [1, 2, 3, 4].map((i) => this.punkt('platz' + i, { x: -750 + (i - 1) * 500, y: 1240 }));
    this.tiere = [];          // die vier Tiere der Runde
    this.phase = 'fuettern';  // 'tor' | 'kommen' | 'fuettern' | 'wasser' | 'giessen' | 'trinken' | 'ende'
    this.runde = 0;
    this.blaseZeit = 4;
    this.klopfZeit = 3;
    this.gastZuletzt = -5;
    this.trinkPlatz = [null, null];
    this._gaenge = [];        // wartende Bewegungen (siehe gang())
    this._laufend = 0;        // laufende Bewegungen
    this._pg = new PIXI.Point();
    this._pl = new PIXI.Point();

    this.baueTor();
    this.baueNebensachen();
    this.baueTrog();
    this.baueEimer();
    this.wolken = new Wolken(this.hinten, { anzahl: 2, yVon: 70, yBis: 200 });
    // Vogel auf dem Zaun in der Lücke zwischen den beiden mittleren Tieren (dort verdeckt ihn keine Tippfläche)
    this.vogel = new Vogel(this, { x: 0, y: 790 }, { skala: 0.7, z: 6 });
    this.falter = new Schmetterling(this, { x0: -1000, y0: 1180, x1: 1000, y1: 1300 }, { skala: 0.8, eltern: this.vorn });
    this.weide = [];
    this.baueWeide();

    // erste Runde: Tiere stehen schon da
    this.neueRunde(true);
  }

  betreten() {
    voice('bauernhof_hallo');
    // Hinweis bei jedem Betreten anmelden (der Kern sagt ihn höchstens einmal am Tag) – aber nur, solange die Seite
    // zu sehen ist und das Kind noch kein Futter genommen hat (auch, wenn er erst nach der Begrüßung dran ist)
    this._hinweis?.kill();
    const passt = () => this.aktiv && !this.futterGenommen && this.phase === 'fuettern';
    this._hinweis = this.after(3.2, () => { if (passt()) voice('bauernhof_futter', { nurWenn: passt }); });
    if (this.phase === 'tor') this.torHinweis();
    if (this.phase === 'wasser') this.wasserHinweis();
  }

  verlassen() {
    this._hinweis?.kill();
    this._hinweis = null;
  }

  torHinweis() {
    const passt = () => this.aktiv && this.phase === 'tor';
    this.after(1.5, () => { if (passt()) voice('bauernhof_tor', { nurWenn: passt }); });
  }

  wasserHinweis() {
    const passt = () => this.aktiv && this.phase === 'wasser';
    this.after(1.2, () => { if (passt()) voice('bauernhof_durst', { nurWenn: passt }); });
  }

  // ---------------------------------------------------------------- Scheunentor

  baueTor() {
    const hgTex = this.hg.texture;
    const halb = HG_BREITE / 2;
    const h = TOR.y1 - TOR.y0;
    // dunkles Innere der Scheune (liegt hinter den Flügeln)
    this.innen = new PIXI.Graphics()
      .rect(TOR.x0 - halb, TOR.y0, TOR.x1 - TOR.x0, h).fill(0x4a2c1c)
      .rect(TOR.x0 - halb, TOR.y0 + h * 0.62, TOR.x1 - TOR.x0, h * 0.38).fill(0x6e4a2a)
      .ellipse((TOR.x0 + TOR.x1) / 2 - halb - 60, TOR.y1 - 30, 120, 34).fill(0xc9a24e)
      .ellipse((TOR.x0 + TOR.x1) / 2 - halb + 90, TOR.y1 - 22, 90, 24).fill(0xd8b25a);
    this.innen.zIndex = 1;
    this.welt.addChild(this.innen);
    // die beiden Flügel: Ausschnitte aus dem Hintergrundbild, drehen sich an den Angeln auf
    const fluegel = (x0, x1, links) => {
      const t = new PIXI.Texture({ source: hgTex.source, frame: new PIXI.Rectangle(x0, TOR.y0, x1 - x0, h) });
      const s = new PIXI.Sprite(t);
      s.anchor.set(links ? 0 : 1, 0);
      s.position.set((links ? x0 : x1) - halb, TOR.y0);
      s.zIndex = 2;
      this.welt.addChild(s);
      return s;
    };
    this.torL = fluegel(TOR.x0, TOR.xm, true);
    this.torR = fluegel(TOR.xm, TOR.x1, false);
    this.torOffen = false;
    this.torMitte = { x: TOR.xm - halb, y: (TOR.y0 + TOR.y1) / 2 + 20 };
    // Antippen der Scheune: in der Tor-Phase kommen die neuen Tiere, sonst geht das Tor kurz auf
    this.torFlaeche = new PIXI.Container({ label: 'scheune' });
    this.torFlaeche.zIndex = 3;
    this.welt.addChild(this.torFlaeche);
    tap(this.torFlaeche, () => {
      if (this.phase === 'tor') { this.tiereHerein(); return; }
      if (this.phase === 'kommen' || this.torOffen) return;
      this.oeffneTor().then(() => this.after(1.6, () => { if (this.phase !== 'kommen') this.schliesseTor(); }));
    }, { sound: null, squash: false, hitArea: new PIXI.Rectangle(TOR.x0 - halb - 20, TOR.y0 - 40, TOR.x1 - TOR.x0 + 40, h + 40) });
  }

  oeffneTor() {
    if (this.torOffen) return Promise.resolve(true);
    this.torOffen = true;
    ton('common/tuer', { vol: 0.6, abstand: 0.8 });
    this.tween(this.torL, { scaleX: 0.16, skewY: -0.12 }, 0.8, { ease: 'sineInOut' });
    return this.tween(this.torR, { scaleX: 0.16, skewY: 0.12 }, 0.8, { ease: 'sineInOut' });
  }

  schliesseTor() {
    if (!this.torOffen) return Promise.resolve(true);
    this.torOffen = false;
    this.tween(this.torL, { scaleX: 1, skewY: 0 }, 0.8, { ease: 'sineInOut' });
    return this.tween(this.torR, { scaleX: 1, skewY: 0 }, 0.8, { ease: 'sineInOut' }).then((ok) => {
      if (ok) ton('common/klack', { vol: 0.4 });
      return ok;
    });
  }

  // Wartende Tiere klopfen von innen: das Tor ruckelt sanft und man hört, wer drin ist
  klopfen() {
    if (this.torOffen) return;
    const id = this.naechste?.[0];
    if (id) laut(id, 3);
    for (const f of [this.torL, this.torR]) {
      this.tween(f, { skewY: (f === this.torL ? -1 : 1) * 0.025 }, 0.22, { ease: 'sineInOut', yoyo: true, repeat: 1 });
    }
  }

  // ---------------------------------------------------------------- Nebensachen

  baueNebensachen() {
    // Traktor steht weit hinten auf der Wiese hinter dem Zaun (über den Köpfen der Tiere, frei antippbar)
    const tk = TRAKTOR.skala;
    this.traktor = this.ding('bauernhof/traktor', TRAKTOR.x, TRAKTOR.y, tk, 4);
    wackelDing(this.traktor, {
      ton: 'common/traktor', vol: 0.55, abstand: 2.8, pad: 45,
      dazu: () => {
        // Rauch aus dem Auspuff (Bildpunkte ~264 rechts, ~600 über dem Anker)
        this.burst('rauch', this.traktor.x + 264 * tk, this.traktor.y - 600 * tk, { count: 3 });
      },
    });
    // Strohballen vorn rechts (neben der Leiste)
    this.stroh = this.ding('bauernhof/strohballen', 905, 1415, 0.5, 1415);
    wackelDing(this.stroh, {
      ton: 'common/rascheln', vol: 0.6, abstand: 0.8, pad: 40,
      dazu: () => this.burst('staub', this.stroh.x, this.stroh.y - 120, { count: 4 }),
    });
  }

  ding(id, x, y, skala, z) {
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

  // ---------------------------------------------------------------- Wassertrog und Eimer

  baueTrog() {
    this.trog = this.ding('bauernhof/futtertrog', TROG.x, TROG.y, TROG.skala, TROG.y);
    const m = meta('bauernhof/futtertrog');
    const ox = -m.ax * (m.w || 500);
    const oy = -m.ay * (m.h || 185);
    const i = TROG_INNEN;
    this.wasser = new PIXI.Graphics()
      .roundRect(ox + i.x, oy + i.y, i.w, i.h, 20).fill(0x5aa7dc)
      .roundRect(ox + i.x + 14, oy + i.y + 4, i.w - 28, i.h * 0.45, 14).fill({ color: MILCHWEISS, alpha: 0.75 })
      .ellipse(ox + i.x + i.w * 0.3, oy + i.y + 10, 46, 5).fill({ color: 0xffffff, alpha: 0.7 });
    this.wasser.alpha = 0;
    this.trog.addChild(this.wasser);
    this.trogInnen = { x: TROG.x, y: TROG.y + (oy + i.y + i.h / 2) * TROG.skala };
    this.trog.visible = false;
    this.trog.alpha = 0;
    wackelDing(this.trog, { ton: 'common/platsch', vol: 0.4, abstand: 0.8, pad: 40 });
    this.strahl = new PIXI.Graphics();
    this.strahl.zIndex = TROG.y + 2;
    this.strahl.alpha = 0;
    this.welt.addChild(this.strahl);
  }

  baueEimer() {
    this.eimer = this.ding('common/eimer_wasser', EIMER.x, EIMER.y, EIMER.skala, EIMER.y + 120);
    this.eimer.alpha = 0.0;
    this.eimer.visible = false;
    this.eimerZiehen = drag(this.eimer, {
      pad: 50,
      lift: 1.08,
      heim: { x: EIMER.x, y: EIMER.y },
      targets: () => (this.phase === 'wasser'
        ? [{ id: 'trog', x: this.trogInnen.x, y: this.trogInnen.y - 60, radius: 420 }] : []),
      onStart: () => { this.puls?.stop(); this.puls = null; ton('common/platsch', { vol: 0.35, abstand: 0.6 }); },
      onDrop: (ziel, ctx) => {
        if (ziel && this.phase === 'wasser') this.giessen();
        else ctx.back(0.5);
      },
    });
  }

  zeigeEimer() {
    const e = this.eimer;
    e.position.set(EIMER.x, EIMER.y - 40);
    e.rotation = 0;
    e.visible = true;
    e.eventMode = 'static';
    ton('common/plopp', { vol: 0.5 });
    this.tween(e, { alpha: 1, y: EIMER.y }, 0.6, { ease: 'sineInOut' }).then(() => {
      if (this.phase === 'wasser' && !this.puls) this.puls = fx.pulse(e, { staerke: 0.04, periode: 1.6 });
    });
  }

  async giessen() {
    this.phase = 'giessen';
    const e = this.eimer;
    e.eventMode = 'none';
    // Eimer schwebt links über den Trog und kippt
    const z = this.trogInnen;
    await this.tween(e, { x: z.x - 150, y: z.y - 170 }, 0.4, { ease: 'sineInOut' });
    await this.tween(e, { rotation: 1.0 }, 0.45, { ease: 'sineInOut' });
    const kante = new PIXI.Point(0.5 * e.texture.width - 20, -0.36 * e.texture.height);
    ton('common/giessen', { vol: 0.7, abstand: 1 });
    const p = { k: 0 };
    await this.tween(p, { k: 1 }, 1.5, {
      ease: 'linear',
      onUpdate: () => {
        const r = this.welt.toLocal(e.toGlobal(kante, this._pg), undefined, this._pl);
        const dicke = 18 * Math.sin(Math.min(1, p.k * 1.1) * Math.PI) + 2;
        this.strahl.clear()
          .moveTo(r.x, r.y)
          .quadraticCurveTo(r.x + 50, (r.y + z.y) / 2, z.x - 20, z.y)
          .stroke({ width: dicke, color: 0x6cb8e8, cap: 'round' });
        this.strahl.alpha = 1;
        this.wasser.alpha = Math.min(1, p.k * 1.2);
      },
    });
    this.tween(this.strahl, { alpha: 0 }, 0.3);
    this.burst('tropfen', z.x, z.y - 30, { count: 5 });
    fx.pop(this.trog, 0.05);
    await this.tween(e, { rotation: 0 }, 0.4, { ease: 'sineInOut' });
    // leerer Eimer geht weich weg (in der nächsten Runde steht wieder ein voller da)
    this.tween(e, { x: EIMER.x, y: EIMER.y - 30, alpha: 0 }, 0.7, { ease: 'sineInOut' })
      .then((ok) => { if (ok && !e.destroyed) e.visible = false; });
    this.phase = 'trinken';
    // alle schauen zum Wasser und haben Durst
    this.tiere.forEach((t, i) => this.after(0.3 + i * 0.35, () => {
      if (t.destroyed || t.getrunken || t._trinkt) return;
      t.lookAt(0);
    }));
    this.after(1.0, () => this.zeigeDurst(this.tiere.find((t) => !t.getrunken && !t._trinkt)));
  }

  zeigeDurst(tier) {
    if (!tier || tier.destroyed || tier._blase) return;
    tier.bubble('common/eimer_wasser', 2.4);
  }

  // ---------------------------------------------------------------- Laufen (höchstens zwei gleichzeitig)

  // Ruhe-Regel: Es laufen höchstens GLEICHZEITIG Tiere zugleich über den Hof. fn startet eine Bewegung und gibt ihr
  // Promise zurück; weitere Wünsche warten in der Reihe, bis eine Bewegung fertig ist. → Promise mit dem Ergebnis
  gang(fn) {
    return new Promise((fertig) => {
      this._gaenge.push({ fn, fertig });
      this.naechsterGang();
    });
  }

  naechsterGang() {
    while (this._laufend < GLEICHZEITIG && this._gaenge.length) {
      const { fn, fertig } = this._gaenge.shift();
      this._laufend++;
      let frei = false;
      const ende = (v) => {
        if (frei) return;
        frei = true;
        this._laufend--;
        fertig(v);
        this.naechsterGang();
      };
      Promise.resolve().then(fn).then(ende, () => ende(false));
      // Notbremse: eine Bewegung, die nie zu Ende kommt, hält die Reihe nicht auf
      this.after(9, () => ende(false));
    }
  }

  // ---------------------------------------------------------------- Trinken

  // Ein durstiges Tier geht zum Trog, trinkt, freut sich und läuft hinaus auf die Weide
  async trinken(tier, still = false) {
    if (tier.destroyed || tier._trinkt || tier.getrunken) return;
    const wahl = this.waehleTrinkPlatz(tier);
    if (!wahl) {
      // Platz besetzt: freundlich nicken – es kommt dran, sobald ein Platz frei wird
      tier.wartet = true;
      if (still) return;
      tier.nod();
      laut(tier.tierId);
      return;
    }
    const platz = wahl.nr;
    tier.wartet = false;
    tier._trinkt = true;
    tier.platz = null;          // sein Platz auf dem Hof ist jetzt frei
    this.trinkPlatz[platz] = tier;
    laut(tier.tierId);
    fx.wobble(tier, 0.04);      // sofort sichtbar (das Loslaufen kann kurz warten)
    // wer sonst hinter dem Trinkplatz stünde (und verdeckt wäre), rückt nach außen
    for (const w of wahl.weg) this.rueckeZurSeite(w.tier, w.ziel);
    const ziel = TRINK_PLAETZE[platz];
    await this.gang(() => (tier.destroyed ? false : tier.walkTo(ziel.x, ziel.y, { tempo: 360 })));
    if (tier.destroyed) return;
    tier.position.set(ziel.x, ziel.y);
    await tier.lookAt(platz === 0 ? 9999 : -9999);
    tier.pose('eat');
    ton('common/platsch', { vol: 0.35, abstand: 0.3 });
    await this.wait(0.8);
    ton('common/platsch', { vol: 0.3, abstand: 0.3 });
    await this.wait(0.8);
    if (tier.destroyed) return;
    // Freuen und hinaus nach rechts zählen zusammen als eine Bewegung: Laufen schon zwei andere, trinkt es einfach
    // noch ein bisschen weiter. Der Platz am Trog wird frei, sobald es losgeht; dann darf das nächste wartende Tier hin.
    await this.gang(async () => {
      if (tier.destroyed) return false;
      tier.pose('idle');
      await tier.cheer();
      if (tier.destroyed) return false;
      tier.getrunken = true;
      tier._trinkt = false;
      if (this.tiere.every((t) => t.getrunken)) this.rundeFertig();
      if (this.trinkPlatz[platz] === tier) this.trinkPlatz[platz] = null;
      this.naechsterTrinker();
      const dauer = Math.hypot(AUSGANG.x - tier.x, AUSGANG.y - tier.y) / 380;
      this.tween(tier, { alpha: 0 }, 0.7, { ease: 'sineInOut', delay: Math.max(0, dauer - 0.7) });
      return tier.walkTo(AUSGANG.x, AUSGANG.y, { tempo: 380 });
    });
    if (!tier.destroyed) tier.destroy({ children: true });
    // … und erscheint klein auf der Weide
    this.aufDieWeide(tier.tierId);
  }

  // Ein Platz am Trog ist frei geworden: wartende Tiere der Reihe nach fragen (ohne erneutes Nicken)
  naechsterTrinker() {
    for (const n of this.tiere.filter((t) => t.wartet && !t.destroyed && !t._trinkt && !t.getrunken)) {
      this.trinken(n, true);
    }
  }

  // Welcher Platz am Trog? Der auf der eigenen Seite (wer dahinter steht, rückt nach außen). Der auf der anderen Seite
  // nur, wenn dort niemand Durstiges dahinter steht – sonst wartet das Tier lieber kurz (weniger Hin und Her).
  // → { nr, weg: [{tier, ziel}] } oder null (warten)
  waehleTrinkPlatz(tier) {
    const seite = tier.x < 0 ? 0 : 1;
    if (this.trinkPlatz[seite] === null) {
      return { nr: seite, weg: this.verdeckte(seite, tier) || [] };
    }
    const andere = 1 - seite;
    if (this.trinkPlatz[andere] === null && this.verdeckte(andere, tier)?.length === 0) return { nr: andere, weg: [] };
    return null;
  }

  // Wer steht hinter dem Trinkplatz nr (und wäre vom trinkenden Tier fast ganz verdeckt)? Für jedes solche Tier ein
  // freier Platz außen, wo kein Trinkplatz davor liegt → [{tier, ziel}] ([] = niemand verdeckt), null = kein Platz frei
  verdeckte(nr, trinker) {
    const sx = TRINK_PLAETZE[nr].x;
    const hinten = this.tiere.filter((t) => t !== trinker && !t.destroyed && !t.getrunken && !t._trinkt
      && t.platz && Math.abs(t.platz.x - sx) < 320);
    if (!hinten.length) return [];
    const belegt = (p) => this.tiere.some((t) => t !== trinker && !t.destroyed && t.platz === p);
    const aussen = this.plaetze.filter((p) => !belegt(p) && TRINK_PLAETZE.every((s) => Math.abs(p.x - s.x) >= 320));
    if (aussen.length < hinten.length) return null;
    return hinten.map((t) => {
      aussen.sort((a, b) => Math.abs(a.x - t.x) - Math.abs(b.x - t.x));
      return { tier: t, ziel: aussen.shift() };
    });
  }

  // Ein Schritt zur Seite (auf einen freien Platz außen), damit das Tier hinter dem Trog zu sehen bleibt
  rueckeZurSeite(t, ziel) {
    t.platz = ziel;
    this.gang(() => {
      if (t.destroyed || t._trinkt || t.getrunken || t.platz !== ziel) return false;
      return t.walkTo(ziel.x, ziel.y, { tempo: 300 });
    }).then((ok) => {
      if (!ok || t.destroyed || t._trinkt || t.getrunken) return;
      t.position.set(ziel.x, ziel.y);
      t.lookAt(0);
    });
  }

  async rundeFertig() {
    if (this.phase !== 'trinken') return;
    this.phase = 'ende';
    await this.wait(1.4);
    belohne(this, this.stickerWahl(), 0, 560);
    this.tween(this.trog, { alpha: 0 }, 0.8, { ease: 'sineInOut', delay: 1.2 }).then((ok) => {
      if (ok && !this.trog.destroyed) { this.trog.visible = false; this.wasser.alpha = 0; }
    });
    await this.wait(2.4);
    // warten, bis alle hinausgelaufen sind und die Weide-Tiere stehen
    for (let i = 0; i < 60 && (this._laufend > 0 || this._gaenge.length); i++) await this.wait(0.3);
    await this.wait(0.6);
    for (const t of this.tiere) if (!t.destroyed) t.destroy({ children: true });
    this.tiere = [];
    this.waehleNaechste();
    this.phase = 'tor';
    this.klopfZeit = 1.5;
    if (this.aktiv) this.torHinweis();
  }

  // ---------------------------------------------------------------- Weide

  baueWeide() {
    let liste = store.get(WEIDE_KEY, []);
    if (!Array.isArray(liste)) liste = [];
    liste = liste.filter((id) => TIERE.includes(id) || GAESTE.includes(id)).slice(-WEIDE_PLAETZE.length);
    liste.forEach((id, i) => this.weideTier(id, WEIDE_PLAETZE[i], true));
  }

  weideTier(id, platz, sofort) {
    // weiter hinten (kleineres y) etwas kleiner; wer weiter vorn steht, liegt davor
    const tiefe = 1 - (724 - platz.y) * 0.004;
    const skala = tiefe * WEIDE_HOEHE * (HOEHE[id] / 520) / (meta(`tiere/${id}_idle`).h || 900);
    const t = new Actor(id, { x: platz.x, y: platz.y, scale: skala, parent: this.welt, z: 5 + (platz.y - 680) / 100 });
    t.platz = platz;
    t.grasZeit = rand(3, 12);
    t.flip = Math.random() < 0.5;
    t.onTap(() => {
      laut(id, 1.2);
      t.hop(40);
    }, { pad: 90 });
    this.weide.push(t);
    if (!sofort) {
      // kommt von rechts hinter dem Busch auf die Weide (zählt als Bewegung: höchstens zwei gleichzeitig)
      t.position.set(980, platz.y);
      t.alpha = 0;
      this.gang(() => {
        if (t.destroyed) return false;
        this.tween(t, { alpha: 1 }, 0.6, { ease: 'sineInOut' });
        return t.walkTo(platz.x, platz.y, { tempo: 200 });
      }).then((ok) => { if (ok && !t.destroyed) t.lookAt(platz.x + (Math.random() < 0.5 ? -1 : 1)); });
    }
    return t;
  }

  aufDieWeide(id) {
    // ist die Weide voll, blendet das älteste Tier weich aus (es ist weitergezogen) und macht Platz
    if (this.weide.length >= WEIDE_PLAETZE.length) {
      const alt = this.weide.shift();
      const frei = alt.platz;
      alt.eventMode = 'none';
      this.tween(alt, { alpha: 0 }, 1.2, { ease: 'sineInOut' }).then(() => { if (!alt.destroyed) alt.destroy({ children: true }); });
      this.weideTier(id, frei, false);
    } else {
      const belegt = this.weide.map((t) => t.platz);
      const frei = WEIDE_PLAETZE.find((p) => !belegt.includes(p)) || WEIDE_PLAETZE[0];
      this.weideTier(id, frei, false);
    }
    store.set(WEIDE_KEY, this.weide.map((t) => t.tierId));
  }

  // ---------------------------------------------------------------- Runden

  // Wer kommt als Nächstes? Vier Tiere, möglichst andere als zuletzt; ab und zu ein kleiner Gast statt eines Tiers
  waehleNaechste() {
    const vorher = this.letzte || [];
    let auswahl = shuffle(TIERE.filter((t) => !vorher.includes(t))).slice(0, 4);
    if (auswahl.length < 4) auswahl = [...auswahl, ...shuffle(TIERE.filter((t) => !auswahl.includes(t)))].slice(0, 4);
    if (this.runde - this.gastZuletzt >= 2 && Math.random() < 0.45) {
      auswahl[3] = pick(GAESTE.filter((g) => !vorher.includes(g)));
      this.gastZuletzt = this.runde + 1;
    }
    this.naechste = auswahl;
  }

  neueRunde(sofort = false) {
    this.runde++;
    if (!this.naechste) this.waehleNaechste();
    const auswahl = this.naechste;
    this.naechste = null;
    this.letzte = auswahl;
    this.trinkPlatz = [null, null];
    this.tiere = auswahl.map((id, i) => this.baueTier(id, i, sofort));
    this.baueLeiste();            // (der Wassereimer kommt erst, wenn alle satt sind)
    if (sofort) this.phase = 'fuettern';
  }

  // Tor antippen: die wartenden Tiere kommen heraus
  tiereHerein() {
    if (this.phase !== 'tor') return;
    this.phase = 'kommen';
    this.neueRunde(false);
    this.kommenHerein();
  }

  baueTier(id, i, sofort) {
    const p = this.plaetze[i];
    const skala = HOEHE[id] / (meta(`tiere/${id}_idle`).h || 900);
    const tier = new Actor(id, { x: p.x, y: p.y, scale: skala, parent: this.welt, z: p.y });
    tier.ruheSkala = skala;
    tier.platz = p;
    tier.satt = false;
    tier.getrunken = false;
    tier.da = sofort;          // steht an seinem Platz (darf gefüttert werden)
    if (i >= 2) tier.flip = true;  // rechts stehende schauen zur Mitte
    this.tippeTier(tier, id);
    if (!sofort) tier.visible = false;
    return tier;
  }

  tippeTier(tier, id) {
    tier.onTap(() => {
      if (!tier.da) { laut(id); return; }
      if (this.phase === 'trinken' && !tier.getrunken) { this.trinken(tier); return; }
      if (this.phase === 'wasser' || this.phase === 'giessen') {
        fx.wobble(tier, 0.05);
        laut(id);
        this.zeigeDurst(tier);
        return;
      }
      if (tier.satt) {
        // satt und zufrieden: freut sich (cheer entprellt Dauertippen selbst)
        if (!tier._isst && !tier._trinkt) tier.cheer();
        return;
      }
      fx.wobble(tier, 0.05);
      laut(id);
      this.zeigeWunsch(tier);
    });
    // Tippfläche eng an den Körper: sonst verdecken die Tiere Traktor, Vogel und Scheunentor hinter sich
    engeTippflaeche(tier, { breite: 0.8, oben: 0.02, unten: 30 });
  }

  baueLeiste() {
    const alt = this.leiste;
    if (alt) {
      this.tween(alt.container, { alpha: 0 }, 0.4, { ease: 'sineInOut' }).then(() => alt.off());
    }
    const items = futterAuswahl(this.tiere.map((t) => t.tierId), 5).map((id) => ({ id, tex: id, scale: leistenSkala(id) }));
    this.items = items;
    this.leiste = this.tray({
      items,
      onTap: () => { this.futterGenommen = true; },   // Futter gegriffen: Hinweis „Zieh das Futter …" entfällt
      targets: () => this.tiere.filter((t) => t.da && !t.destroyed && this.phase === 'fuettern').map((t) => {
        const m = t.point('mouth');
        return { id: t.tierId, tier: t, x: m.x, y: m.y + 60, radius: 270 };
      }),
      onDrop: (item, ziel, kopie, ctx) => {
        ctx.behalten();
        kopie.futterId = item.id;
        const tier = ziel.tier;
        fuettere(this, tier, kopie, { heim: { x: ctx.startX, y: ctx.startY } }).then((gemocht) => {
          if (gemocht) {
            this.gefuettert(tier);
            return;
          }
          if (kopie.destroyed) return;
          kopie.eventMode = 'none';
          this.tween(kopie, { alpha: 0 }, 0.35, { ease: 'sineInOut' }).then(() => { if (!kopie.destroyed) kopie.destroy(); });
        });
      },
    });
    if (alt) {
      this.leiste.container.alpha = 0;
      this.tween(this.leiste.container, { alpha: 1 }, 0.5, { ease: 'sineInOut', delay: 0.3 });
    }
  }

  // Wunsch des Tiers: ein Futter aus der Leiste, das es mag
  wunschVon(tier) {
    const moegliche = (this.items || []).map((it) => it.id).filter((id) => mag(tier.tierId, id));
    if (!tier.wunsch || !moegliche.includes(tier.wunsch)) tier.wunsch = moegliche.length ? pick(moegliche) : null;
    return tier.wunsch;
  }

  zeigeWunsch(tier) {
    const w = this.wunschVon(tier);
    if (!w || tier._blase) return;
    tier.bubble(w, 2.6);
  }

  gefuettert(tier) {
    if (tier.satt) return;
    tier.satt = true;
    if (this.tiere.every((t) => t.satt) && this.phase === 'fuettern') {
      this.phase = 'satt';
      this.after(1.0, () => this.alleSatt());
    }
  }

  async alleSatt() {
    // gemeinsames Freuen – nacheinander, damit es ruhig bleibt
    this.tiere.forEach((t, i) => this.after(i * 0.45, () => { if (!t.destroyed) t.cheer(); }));
    await this.wait(1.8);
    // Die Leiste geht weg, vorn steht der leere Trog, links kommt der volle Wassereimer
    const l = this.leiste;
    this.leiste = null;
    if (l) this.tween(l.container, { alpha: 0 }, 0.6, { ease: 'sineInOut' }).then(() => l.off());
    await this.wait(0.5);
    const t = this.trog;
    t.visible = true;
    t.alpha = 0;
    this.wasser.alpha = 0;
    ton('common/klack', { vol: 0.5 });
    this.tween(t, { alpha: 1 }, 0.6, { ease: 'sineInOut' });
    await this.wait(0.5);
    this.phase = 'wasser';
    this.zeigeEimer();
    if (this.aktiv) this.wasserHinweis();
    this.after(1.2, () => this.zeigeDurst(pick(this.tiere)));
  }

  stickerWahl() {
    const neu = this.tiere.map((t) => 'tier_' + t.tierId).filter((id) => stickerVon(id));
    return neu.length ? pick(neu) : 'bauernhof_traktor';
  }

  async kommenHerein() {
    await this.oeffneTor();
    const torX = (TOR.x0 + TOR.x1) / 2 - HG_BREITE / 2;
    for (let i = 0; i < this.tiere.length; i++) {
      const t = this.tiere[i];
      if (t.destroyed) continue;
      // aus dem Tor treten: klein (weit hinten), dann nach vorn zum Platz und dabei größer werden
      t.position.set(torX + rand(-40, 40), TOR.y1 - 8);
      t.scale.set(t.ruheSkala * 0.5);
      t.alpha = 0;
      t.visible = true;
      laut(t.tierId, 0.5);
      this.tween(t, { alpha: 1 }, 0.4, { ease: 'sineInOut' });
      const d = Math.hypot(t.platz.x - t.x, t.platz.y - t.y);
      const dauer = d / 300;
      this.tween(t, { scale: t.ruheSkala }, dauer, { ease: 'sineInOut' });
      t.walkTo(t.platz.x, t.platz.y, { tempo: 300 }).then((ok) => {
        if (t.destroyed) return;
        t.position.set(t.platz.x, t.platz.y);
        t.da = true;
        if (ok) t.lookAt(i >= 2 ? -9999 : 9999);
      });
      await this.wait(1.1);
    }
    await this.wait(1.4);
    await this.schliesseTor();
    this.phase = 'fuettern';
    this.blaseZeit = 1;
  }

  // ---------------------------------------------------------------- Ablauf

  update(dt) {
    this.wolken.update(dt);
    this.vogel.update(dt);
    this.falter.update(dt);
    // Tiefe: wer weiter vorn steht, liegt davor
    for (const t of this.tiere) if (!t.destroyed) t.zIndex = Math.round(t.y);

    if (this.phase === 'fuettern' || this.phase === 'trinken' || this.phase === 'wasser') {
      // ab und zu zeigt ein Tier seinen Wunsch (Futter oder Wasser) – nur, wenn das Kind gerade nichts tut
      this.blaseZeit -= dt;
      if (this.blaseZeit <= 0) {
        this.blaseZeit = rand(6, 9);
        if (this.szene.idle > 1.5) {
          if (this.phase === 'fuettern') {
            const hungrig = this.tiere.filter((t) => t.da && !t.satt && !t._isst && !t._blase);
            if (hungrig.length) this.zeigeWunsch(pick(hungrig));
          } else {
            const durstig = this.tiere.filter((t) => !t.getrunken && !t._trinkt && !t._blase);
            if (durstig.length) this.zeigeDurst(pick(durstig));
          }
        }
      }
    } else if (this.phase === 'tor') {
      this.klopfZeit -= dt;
      if (this.klopfZeit <= 0) {
        this.klopfZeit = rand(5, 7);
        if (this.szene.idle > 2) this.klopfen();
      }
    }

    // Weide: die Tiere grasen ab und zu (Kopf runter, dann wieder hoch)
    for (const w of this.weide) {
      if (w.destroyed) continue;
      w.grasZeit -= dt;
      if (w.grasZeit <= 0) {
        w.grasZeit = rand(6, 12);
        w.pose(w.poseName === 'eat' ? 'idle' : 'eat');
      }
    }
  }

  // Ziele der Zeige-Hand. Nie eine leere Liste: sonst zeigte die Hand mitten in der Runde auf den Pfeil zur
  // nächsten Seite (auch in den kurzen Übergängen zeigt sie auf etwas, das gerade dazugehört).
  hinweise() {
    const da = (t) => t && !t.destroyed;
    switch (this.phase) {
      case 'tor':
        return [this.torMitte];
      case 'kommen': {
        // auf das zuletzt angekommene Tier (es lässt sich schon antippen), sonst aufs offene Tor
        const angekommen = this.tiere.filter((t) => da(t) && t.da);
        return [angekommen.length ? angekommen[angekommen.length - 1] : this.torMitte];
      }
      case 'satt': {
        // alle freuen sich gleich gemeinsam
        const t = this.tiere.find(da);
        return t ? [t] : [this.torMitte];
      }
      case 'giessen':
        return [this.trog];
      case 'ende': {
        // die Tiere sind auf dem Weg zur Weide: auf das neueste Weide-Tier zeigen (antippen: es hüpft)
        const w = [...this.weide].reverse().find((x) => da(x) && x.alpha > 0.5);
        if (w) return [w];
        const t = this.tiere.find((x) => da(x) && x.alpha > 0.5);
        return t ? [t] : [this.torMitte];
      }
      case 'fuettern': {
        const hungrig = this.tiere.filter((t) => t.da && !t.satt && !t.destroyed);
        const liste = [];
        for (const t of hungrig) {
          const w = this.wunschVon(t);
          const bild = w && this.leiste?.sprite(w);
          if (bild) liste.push({ von: bild, nach: t });
        }
        if (hungrig.length) liste.push(hungrig[0]);
        return liste;
      }
      case 'wasser':
        return this.eimer.visible ? [{ von: this.eimer, nach: this.trog }] : [this.trog];
      case 'trinken': {
        const durstig = this.tiere.filter((t) => !t.getrunken && !t._trinkt && !t.wartet && !t.destroyed);
        if (durstig.length) return durstig;
        // trinken gerade alle (oder warten): auf ein trinkendes Tier zeigen, sonst auf den Trog
        const t = this.tiere.find((x) => da(x) && (x._trinkt || x.wartet));
        return [t || this.trog];
      }
      default:
        return [this.torMitte];
    }
  }
}

// Flache Futter (Knochen, Wurm, Banane) in der Leiste etwas größer, damit sie gut zu greifen sind
// (die Leiste bringt die längere Seite auf ~210 Einheiten; die kürzere soll mindestens ~150 haben)
function leistenSkala(id) {
  const m = meta(id);
  if (!m?.w || !m?.h) return 1;
  const verh = Math.min(m.w, m.h) / Math.max(m.w, m.h);
  return Math.max(1, Math.min(1.3, 0.72 / verh));
}
