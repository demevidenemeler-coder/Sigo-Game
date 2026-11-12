// Seite 2 – Hausbau (hg_rohbau).
// Auf dem Fundament sind die Plätze der Hausteile als blasse Umrisse zu sehen. Die Teile liegen vorn links im
// Lager. Antippen → der Kran fährt hin, hakt das Teil an und setzt es weich an seinen Platz. Ziehen geht auch:
// Das Teil rastet großzügig auf einem passenden freien Platz ein. Unten zuerst – ein Dach ohne Wände hüpft
// freundlich zurück. Haus fertig → Fahne obendrauf, ein Tier zieht ein und winkt aus der Tür, Sticker; danach
// gleitet das Haus hinaus und ein neues beginnt (andere Wandfarbe, mal mit Turm).

import { spr, meta, voice, fx, tap, drag, Actor, PIXI, rand, isTweening } from '../../engine/index.js';
import { Seite } from '../../gemeinsam/seiten.js';
import { belohne } from '../../gemeinsam/sticker.js';
import { Wolken, Schmetterling, helmTier, freuen, kopfAufSeite, ton, laut } from './deko.js';

const P = 0.65;             // Größe der Hausteile (Wand = 260 × 260)
const F = P / 0.5;          // Maße im Plan sind für P = 0.5 angegeben
const BASIS = 975;          // Standlinie der Häuser auf der Betonplatte (vordere Hälfte der Platte)
const KRAN_Y = 902;         // Fuß des Krans (an der Zaunlinie, hinter der Platte)
const KRAN_S = 1.1;
const HAKEN_S = 0.7;
const KRAN_RUHE = -260;     // Ort des Krans, wenn er nichts zu tun hat
const KRAN_MIN = -740;      // weiter links nicht: sonst steht der Kran hinter dem Karten-Knopf oben links
const TEMPO_KRAN = 430;     // Einheiten/s beim Fahren
const TEMPO_HAKEN = 520;

// Häuser nacheinander: Wandfarbe und ob ein Turm dazukommt
const HAEUSER = [
  { wand: 'baustelle/teil_wand_rot', turm: false },
  { wand: 'baustelle/teil_wand_gelb', turm: true },
  { wand: 'baustelle/teil_wand_gelb', turm: false },
  { wand: 'baustelle/teil_wand_rot', turm: true },
];

// Teile, die schon sicher auf dem Weg zu ihrem Platz sind
const UNTERWEGS = new Set(['wartet', 'kran', 'kommt']);

// Wer zieht ein? (abwechselnd)
const BEWOHNER = ['hase', 'katze', 'maus', 'schaf', 'igel', 'ente', 'fuchs', 'schwein'];

// Lager: Mitte unten der Ablageplätze (das breite Dach hat einen eigenen Platz).
// Nicht weiter links als x ≈ -400: Der Kran steht 360 links vom Haken und soll die Ecke oben links frei lassen.
// Die untere Reihe endet bei y 1470 (darunter 70 Einheiten Rand ohne Ziele).
const LAGER_DACH = { x: -310, y: 1205 };
const LAGER = [
  { x: 120, y: 1205 }, { x: 395, y: 1205 },
  { x: -400, y: 1470 }, { x: -125, y: 1470 }, { x: 150, y: 1470 }, { x: 420, y: 1470 },
];

// Plätze als heller „Bauplan" (blassblau-weiß statt der echten Farben): hebt sich von den roten Ziegel-Ruinen
// und dem gelben Zaun im Hintergrund ab
function bauplanFilter() {
  const f = new PIXI.ColorMatrixFilter();
  const a = 0.22;   // Anteil der echten Farbe
  const ziel = [0.8, 0.9, 1.0];
  f.matrix = [
    a, 0, 0, 0, (1 - a) * ziel[0],
    0, a, 0, 0, (1 - a) * ziel[1],
    0, 0, a, 0, (1 - a) * ziel[2],
    0, 0, 0, 1, 0,
  ];
  return f;
}

// Plätze eines Hauses: Mitte relativ zum Hausfuß (x Mitte der zwei Wände, y = Standlinie), Bild, Ebene, Bedingung
function plan(haus) {
  const s = [
    { id: 'wandL', art: 'wand', tex: haus.wand, x: -100, y: -100, z: 2, braucht: [] },
    { id: 'wandR', art: 'wand', tex: haus.wand, x: 100, y: -100, z: 2, braucht: [] },
    { id: 'tuer', art: 'tuer', tex: 'baustelle/teil_tuer', x: -100, y: -97, z: 4, braucht: ['wandL'] },
    { id: 'fenster', art: 'fenster', tex: 'baustelle/teil_fenster', x: 100, y: -110, z: 4, braucht: ['wandR'] },
    { id: 'dach', art: 'dach', tex: 'baustelle/teil_dach', x: 0, y: -300, z: 5, braucht: ['wandL', 'wandR'] },
    { id: 'schornstein', art: 'schornstein', tex: 'baustelle/teil_schornstein', x: 112, y: -350, z: 1, braucht: ['dach'] },
  ];
  if (haus.turm) s.push({ id: 'turm', art: 'turm', tex: 'baustelle/teil_turm', x: 287, y: -100, z: 2, braucht: [] });
  for (const p of s) {
    p.x *= F;
    p.y *= F;
  }
  return s;
}

export class Hausbau extends Seite {
  static hg = 'baustelle/hg_rohbau';

  aufbau() {
    this.wolken = new Wolken(this, { anzahl: 3, y: [110, 300] });
    this.schmetterling = new Schmetterling(this, { bereich: { x: 520, y: 1020, w: 500, h: 220 }, farbe: 0xf7b26a });
    this.nr = -1;
    this.bewohnerNr = Math.floor(rand(0, BEWOHNER.length));
    this.auftraege = [];
    this.kranLaeuft = false;
    this.fertigLaeuft = false;
    this.last = null;           // Teil, das gerade am Haken hängt
    this.bauplan = bauplanFilter();
    this.baueKran();
    this.baueDeko();
    this.neuesHaus(false);
  }

  betreten() {
    // Hinweis bei jedem Betreten anmelden (der Kern sagt ihn höchstens einmal am Tag) – nur, solange die Seite zu
    // sehen ist, das Kind noch kein Teil angefasst hat und kein Haus gerade fertig gefeiert wird
    this._hinweis?.kill();
    this._hinweis = null;
    if (this.angefangen) return;
    const passt = () => this.aktiv && !this.angefangen && !this.fertigLaeuft;
    this._hinweis = this.after(1.2, () => { if (passt()) voice('baustelle_haus', { nurWenn: passt }); });
  }

  verlassen() {
    this._hinweis?.kill();
    this._hinweis = null;
  }

  // ---------------------------------------------------------------- Kran

  baueKran() {
    // Schiene, auf der der Kran fährt (an der Zaunlinie)
    const schiene = new PIXI.Graphics()
      .roundRect(-1500, KRAN_Y - 12, 2400, 14, 7).fill(0x8c7458)
      .roundRect(-1500, KRAN_Y - 14, 2400, 5, 3).fill({ color: 0xffffff, alpha: 0.25 });
    schiene.zIndex = 1;
    this.welt.addChild(schiene);

    const k = spr('baustelle/kran', { parent: this.welt });
    k.scale.set(KRAN_S);
    k.y = KRAN_Y;
    k.zIndex = 3;
    const m = meta('baustelle/kran');
    this.seilDX = (m.pts.seil[0] - m.ax * m.w) * KRAN_S;
    this.seilY = KRAN_Y + (m.pts.seil[1] - m.ay * m.h) * KRAN_S;
    this.kran = k;

    // Seil: ein schmaler Streifen, dessen Länge jedes Bild angepasst wird
    const seil = new PIXI.Sprite(PIXI.Texture.WHITE);
    seil.tint = 0x4a4038;
    seil.anchor.set(0.5, 0);
    seil.width = 7;
    seil.zIndex = 600;
    this.welt.addChild(seil);
    this.seil = seil;

    const h = spr('baustelle/kranhaken', { parent: this.welt });
    const mh = meta('baustelle/kranhaken');
    h.anchor.set(mh.pts.oben[0] / mh.w, mh.pts.oben[1] / mh.h);
    h.scale.set(HAKEN_S);
    h.zIndex = 601;
    this.haken = h;
    this.hakenTiefe = (mh.pts.haken[1] - mh.pts.oben[1]) * HAKEN_S;   // vom Seilende bis zur Hakenspitze
    this.hakenOben = this.seilY + 16;

    // Zustand, den die Tweens bewegen: x des Krans, y des Seilendes
    this.k = { x: KRAN_RUHE, y: this.hakenOben };
    this.stelleKran();

    tap(k, () => {
      fx.wobble(k, 0.02);
      ton('common/kran', { abstand: 2.5, vol: 0.6 });
    }, { sound: null, hitArea: new PIXI.Rectangle(-180, -790, 300, 790) });
    tap(h, () => {
      fx.wobble(h, 0.15);
      ton('common/klack', { abstand: 0.3 });
    }, { sound: null, pad: 70, squash: false });
  }

  stelleKran() {
    const k = this.k;
    this.kran.x = k.x;
    const hx = k.x + this.seilDX;
    this.seil.position.set(hx, this.seilY);
    this.seil.height = Math.max(1, k.y - this.seilY);
    this.haken.position.set(hx, k.y);
    if (this.last && !this.last.destroyed) {
      this.last.zIndex = 590;   // (das Ziehen des Kerns stellt den alten zIndex verzögert wieder her)
      this.last.position.set(hx, k.y + this.hakenTiefe + 2 + this.last.height / 2);
    }
  }

  async kranZu(hakenX, dauerMin = 0.5) {
    const ziel = Math.max(KRAN_MIN, hakenX - this.seilDX);
    const d = Math.abs(ziel - this.k.x);
    if (d < 2) return true;
    if (d > 120) ton('common/kran', { abstand: 2.6, vol: 0.55 });
    return this.tween(this.k, { x: ziel }, Math.max(dauerMin, d / TEMPO_KRAN + 0.35), { ease: 'sineInOut' });
  }

  async hakenZu(y) {
    const d = Math.abs(y - this.k.y);
    if (d < 2) return true;
    return this.tween(this.k, { y }, d / TEMPO_HAKEN + 0.3, { ease: 'sineInOut' });
  }

  async kranArbeit() {
    if (this.kranLaeuft) return;
    this.kranLaeuft = true;
    try {
      while (this.auftraege.length) {
        const a = this.auftraege.shift();
        if (a.teil.destroyed || a.teil.zustand !== 'wartet') continue;
        if (!this.erlaubt(a.platz, true)) {
          // was darunter gehört, wurde inzwischen weggezogen: freundlich zurück
          this.gibFrei(a.teil);
          this.huepfNein(a.teil);
          continue;
        }
        await this.kranHole(a.teil, a.platz);
      }
      await this.hakenZu(this.hakenOben);
      if (!this.auftraege.length && !this.fertigLaeuft) await this.kranZu(KRAN_RUHE, 1);
    } finally {
      this.kranLaeuft = false;
    }
    if (this.auftraege.length) this.kranArbeit();
  }

  async kranHole(teil, platz) {
    await this.hakenZu(this.hakenOben);
    await this.kranZu(teil.x);
    if (teil.destroyed || teil.zustand !== 'wartet') return;
    // anhaken
    teil.zustand = 'kran';
    teil.eventMode = 'none';
    await this.hakenZu(teil.y - teil.height / 2 - this.hakenTiefe - 2);
    ton('common/klack', { abstand: 0.2, vol: 0.8 });
    this.last = teil;
    teil.zIndex = 590;
    // hochziehen, hinfahren, absenken
    await this.hakenZu(this.hakenOben);
    const ziel = this.platzOrt(platz);
    await this.kranZu(ziel.x);
    await this.hakenZu(ziel.y - teil.height / 2 - this.hakenTiefe - 2);
    this.last = null;
    this.setzeEin(teil, platz);
    await this.wait(0.2);
    await this.hakenZu(this.hakenOben);
  }

  // ---------------------------------------------------------------- Haus und Teile

  neuesHaus(weich = true) {
    this.nr = (this.nr + 1) % HAEUSER.length;
    const def = HAEUSER[this.nr];
    const hx = def.turm ? 120 : 300;
    const haus = new PIXI.Container({ label: 'haus', sortableChildren: true });
    haus.position.set(hx, BASIS);
    haus.zIndex = 10;
    this.welt.addChild(haus);
    this.haus = haus;
    this.def = def;
    this.plaetze = plan(def);

    // blasse Umrisse der Plätze
    for (const p of this.plaetze) {
      const g = spr(p.tex, { anchor: 0.5, parent: haus });
      g.scale.set(P);
      g.position.set(p.x, p.y);
      // der Umriss des Schornsteins liegt vor dem Dach (sonst verdeckt), das echte Teil später dahinter
      g.zIndex = p.id === 'schornstein' ? 6 : p.z;
      g.filters = [this.bauplan];
      g.alpha = 0;
      this.tween(g, { alpha: 0.6 }, weich ? 1 : 0.01, { ease: 'sineInOut' });
      p.geist = g;
      p.belegt = null;
      p.reserviert = null;
    }
    this.pruefePlaetze();

    // Teile ins Lager (das Dach auf seinen breiten Platz, die übrigen gemischt)
    // feste Ordnung, je Haus etwas verschoben (Abwechslung, aber vorhersagbar: die Wände liegen beim ersten Haus vorn)
    const dreh = (this.nr * 2) % LAGER.length;
    const plaetze = LAGER.slice(dreh).concat(LAGER.slice(0, dreh));
    let i = 0;
    this.teile = [];
    for (const p of this.plaetze) {
      const ort = p.art === 'dach' ? LAGER_DACH : plaetze[i++];
      const t = this.neuesTeil(p, ort);
      this.teile.push(t);
      if (weich) {
        // erst unsichtbar (in voller Größe, damit die Tippfläche stimmt), dann ploppt es auf
        t.visible = false;
        this.after(0.6 + 0.18 * this.teile.length, () => {
          if (t.destroyed) return;
          t.scale.set(0.01);
          t.visible = true;
          ton('common/plopp', { abstand: 0.12, vol: 0.6 });
          this.tween(t, { scale: P }, 0.4, { ease: 'backOut' });
        });
      }
    }
  }

  neuesTeil(platz, ort) {
    const t = spr(platz.tex, { anchor: 0.5, parent: this.welt });
    t.scale.set(P);
    const h = meta(platz.tex).h * P;
    t.position.set(ort.x, ort.y - h / 2);
    t.heim = { x: t.x, y: t.y };
    t.art = platz.art;
    t.zustand = 'lager';
    t.zIndex = 30 + Math.round(ort.y / 100);
    const pad = Math.max(30, (230 - Math.min(meta(platz.tex).w, h / P) * P) / 2);
    t.ziehen = drag(t, {
      lift: 1.08,
      pad,
      targets: () => this.plaetze
        .filter((p) => p.art === t.art && !p.belegt && (!p.reserviert || p.reserviert === t))
        .map((p) => ({ obj: p.geist, platz: p, radius: 300 })),
      onStart: () => {
        this.angefangen = true;
        this.gibFrei(t);
        t.zustand = 'gezogen';
      },
      onDrop: (ziel, ctx) => this.losgelassen(t, ziel, ctx),
    });
    return t;
  }

  losgelassen(t, ziel, ctx) {
    const weg = Math.hypot(ctx.x - ctx.startX, ctx.y - ctx.startY);
    t.zustand = 'lager';
    if (!ziel) {
      // kaum bewegt = angetippt: der Kran holt es
      if (weg < 30 && !ctx.cancelled) {
        ctx.back(0.15);
        this.teilGetippt(t);
      }
      return undefined; // ohne Ziel gleitet es von selbst zurück
    }
    if (!this.erlaubt(ziel.platz, false)) {
      ctx.back(0.4);
      this.after(0.42, () => this.huepfNein(t));
      return undefined;
    }
    t.zustand = 'kommt';
    t.eventMode = 'none';
    ziel.platz.reserviert = t;
    ctx.snapTo(ziel, 0.22).then(() => this.setzeEin(t, ziel.platz));
    return undefined;
  }

  teilGetippt(t) {
    this.angefangen = true;
    if (t.zustand !== 'lager' || this.fertigLaeuft) return;
    const platz = this.plaetze.find((p) => p.art === t.art && !p.belegt && !p.reserviert);
    if (!platz) {
      fx.wobble(t, 0.06);
      return;
    }
    if (!this.erlaubt(platz, true)) {
      this.huepfNein(t);
      return;
    }
    platz.reserviert = t;
    t.zustand = 'wartet';
    this.auftraege.push({ teil: t, platz });
    ton('common/kran', { abstand: 2.6, vol: 0.55 });
    this.kranArbeit();
  }

  // Teil aus der Warteschlange nehmen und seinen Platz freigeben
  gibFrei(t) {
    this.auftraege = this.auftraege.filter((a) => a.teil !== t);
    for (const p of this.plaetze) if (p.reserviert === t && !p.belegt) p.reserviert = null;
    if (t.zustand === 'wartet') t.zustand = 'lager';
  }

  // Darf auf diesen Platz schon etwas? (mitGeplant: Teile in der Warteschlange zählen schon)
  erlaubt(platz, mitGeplant) {
    return platz.braucht.every((id) => {
      const q = this.plaetze.find((p) => p.id === id);
      return q && (q.belegt || (mitGeplant && q.reserviert && UNTERWEGS.has(q.reserviert.zustand)));
    });
  }

  platzOrt(p) {
    return { x: this.haus.x + p.x, y: this.haus.y + p.y };
  }

  huepfNein(t) {
    if (t.destroyed || t._huepft) return;
    t._huepft = true;
    ton('common/nein', { abstand: 0.8, vol: 0.8 });
    const y0 = t.heim.y;
    this.tween(t, { y: y0 - 50 }, 0.18, { ease: 'quadOut' })
      .then(() => this.tween(t, { y: y0 }, 0.22, { ease: 'quadIn' }))
      .then(() => this.tween(t, { y: y0 - 22 }, 0.13, { ease: 'quadOut' }))
      .then(() => this.tween(t, { y: y0 }, 0.15, { ease: 'quadIn' }))
      .then(() => { t._huepft = false; });
    // was zuerst dran ist, atmet kurz
    const zuerst = this.teile.find((u) => u.zustand === 'lager' && !u.destroyed &&
      this.plaetze.some((p) => p.art === u.art && !p.belegt && !p.reserviert && this.erlaubt(p, true)));
    if (zuerst) {
      const puls = fx.pulse(zuerst, { staerke: 0.07, periode: 1.4 });
      this.after(2.8, () => puls.stop());
    }
  }

  setzeEin(t, platz) {
    if (t.destroyed) return;
    t.ziehen?.off();
    t.ziehen = null;
    platz.belegt = t;
    platz.reserviert = null;
    t.zustand = 'fest';
    // ins Haus umhängen (Platz genau treffen)
    this.haus.addChild(t);
    t.position.set(platz.x, platz.y);
    t.scale.set(P);
    t.zIndex = platz.z + 0.5;
    // das Ziehen des Kerns setzt 0,5 s nach dem Loslassen den alten zIndex zurück – danach noch einmal richtig setzen
    this.after(0.6, () => { if (!t.destroyed && t.zustand === 'fest') t.zIndex = platz.z + 0.5; });
    t.eventMode = 'static';
    this.tween(platz.geist, { alpha: 0 }, 0.5, { ease: 'sineInOut' });
    ton('common/klack', { abstand: 0.15 });
    fx.pop(t, 0.06);
    const o = this.platzOrt(platz);
    this.burst('staub', o.x, o.y + t.height / 2 - 10, { count: 4 });
    tap(t, () => { fx.wobble(t, 0.05); ton('common/klack', { abstand: 0.2, vol: 0.7 }); }, {
      sound: null, squash: false, pad: Math.max(30, (230 - Math.min(t.width, t.height)) / 2),
    });
    this.pruefePlaetze();
    if (this.plaetze.every((p) => p.belegt)) this.fertig();
  }

  // Welche freien Plätze nehmen jetzt schon ein Teil? (nur bei Änderungen neu, nicht jedes Bild)
  pruefePlaetze() {
    for (const p of this.plaetze) p.offen = !p.belegt && this.erlaubt(p, false);
  }

  async fertig() {
    if (this.fertigLaeuft) return;
    this.fertigLaeuft = true;
    const haus = this.haus;
    await this.wait(0.7);
    // Fahne obendrauf: auf dem Turm, sonst auf der Dachspitze
    const fahne = spr('baustelle/teil_fahne', { parent: haus });
    fahne.anchor.set(0.2, 0.97);
    fahne.position.set((this.def.turm ? 287 : 0) * F, (this.def.turm ? -192 : -405) * F);
    fahne.zIndex = 6;
    fahne.scale.set(0.01);
    ton('common/plopp', { abstand: 0.1 });
    this.tween(fahne, { scale: 0.6 * F }, 0.6, { ease: 'backOut' });
    tap(fahne, () => { fx.wobble(fahne, 0.1); ton('common/plopp', { abstand: 0.3 }); }, { sound: null, pad: 70 });
    const spitze = this.welt.toLocal(new PIXI.Point(0, -60), fahne);
    this.burst('funkeln', spitze.x, spitze.y, { count: 6 });
    if (!this.kranLaeuft) this.kranZu(KRAN_RUHE, 1);
    await this.wait(0.8);

    // ein Tier zieht ein und winkt aus der Tür
    const id = BEWOHNER[this.bewohnerNr++ % BEWOHNER.length];
    const tuer = this.plaetze.find((p) => p.id === 'tuer');
    const tier = new Actor(id, { x: 1420, y: BASIS, scale: 0.19 * F, parent: this.welt, z: 400 });
    tier.onTap(() => this.winke(tier));
    // Unterwegs antwortet es ohne Hüpfer (ein Hüpfer beendet das Laufen, sonst spränge es an die Tür). Und falls
    // doch etwas das Laufen unterbricht: weiterlaufen, bis es wirklich an der Tür steht.
    tier._unterwegs = true;
    while (!tier.destroyed && !(await tier.walkTo(haus.x + tuer.x, BASIS, { tempo: 330 }))) await this.wait(0.3);
    tier._unterwegs = false;
    if (tier.destroyed) return;
    haus.addChild(tier);
    tier.position.set(tuer.x, 0);
    tier.zIndex = 4.8;
    this.winke(tier);
    belohne(this, 'baustelle_kran', haus.x, BASIS - 520);
    await this.wait(1.6);
    this.winke(tier);
    await this.wait(2.6);

    // Haus gleitet hinaus, ein neues beginnt
    ton('common/wusch', { abstand: 0.5, vol: 0.5 });
    await this.tween(haus, { x: 1950 }, 3.2, { ease: 'sineInOut' });
    haus.destroy({ children: true });
    this.fertigLaeuft = false;
    this.neuesHaus(true);
  }

  winke(tier) {
    if (tier.destroyed) return;
    laut(tier.tierId);
    if (tier._unterwegs) {
      fx.wobble(tier, 0.05);   // läuft noch zur Tür: nur Laut und Wackeln
      return;
    }
    if (tier._winkt) return;
    tier._winkt = true;
    tier.pose('happy');
    const k = kopfAufSeite(this, tier);
    this.burst('herzen', k.x, k.y + 20, { count: 4 });
    tier.hop(40).then(() => this.wait(0.6)).then(() => {
      if (!tier.destroyed) tier.pose('idle');
      tier._winkt = false;
    });
  }

  // ---------------------------------------------------------------- Kleinkram

  baueDeko() {
    const stapel = spr('baustelle/ziegelstapel', { x: 1010, y: 1180, parent: this.welt });
    stapel.scale.set(0.5);
    stapel.zIndex = 40;
    tap(stapel, () => { fx.wobble(stapel, 0.05); ton('common/klack', { abstand: 0.25 }); }, { pad: 40 });
    const pylon = spr('baustelle/pylon', { x: 920, y: 1340, parent: this.welt });
    pylon.scale.set(0.42);
    pylon.zIndex = 41;
    tap(pylon, () => { fx.wobble(pylon, 0.08); ton('common/plopp', { abstand: 0.3 }); }, { pad: 60 });
    this.hund = helmTier('hund', { x: 700, y: 1450, scale: 0.3, flip: true, parent: this.welt, z: 45 });
    this.hund.onTap(() => freuen(this, this.hund));
  }

  // ---------------------------------------------------------------- Takt und Hinweise

  update(dt, t) {
    this.wolken.update(dt);
    this.schmetterling.update(dt);
    this.stelleKran();
    // freie Plätze, auf die jetzt etwas darf, atmen ganz sanft (keine schnellen Helligkeitswechsel)
    const atem = 0.5 + 0.5 * Math.sin(t * Math.PI * 2 / 2.6);
    for (const p of this.plaetze) {
      if (p.belegt || !p.geist || p.geist.destroyed) continue;
      if (isTweening(p.geist)) continue;
      p.geist.alpha = p.offen ? 0.62 + 0.2 * atem : 0.45;
    }
  }

  /** Von der Szene in exit() gerufen: den gemeinsamen Bauplan-Filter freigeben. */
  aufraeumen() {
    this.bauplan?.destroy();
    this.bauplan = null;
  }

  hinweise() {
    if (this.fertigLaeuft) return [this.hund];
    const t = this.teile.find((u) => u.zustand === 'lager' && !u.destroyed &&
      this.plaetze.some((p) => p.art === u.art && !p.belegt && !p.reserviert && this.erlaubt(p, false)));
    if (!t) return [this.hund];
    const p = this.plaetze.find((q) => q.art === t.art && !q.belegt && !q.reserviert && this.erlaubt(q, false));
    return [t, { von: t, nach: p.geist }];
  }
}
