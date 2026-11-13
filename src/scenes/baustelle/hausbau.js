// Seite 2 – Hausbau (hg_rohbau).
// Ablauf eines Hauses (jede Runde ein anderes Haus, andere Farben, ein anderer Bewohner):
//   1. Ein Tier kommt und wartet links: Es bekommt heute ein Haus.
//   2. Beton: Der Mischer setzt rückwärts an die Betonplatte. Festhalten (oder antippen) → der Beton läuft und
//      bedeckt die Bauplatte.
//   3. Glattstreichen: über den nassen Beton wischen, bis er glatt ist.
//   4. Bauen: Die Hausteile liegen vorn im Lager. Antippen → der Kran holt sie und setzt sie auf ihren Platz
//      (blasse Umrisse zeigen wohin); Ziehen geht auch. Unten zuerst – ein Dach ohne Wände hüpft freundlich zurück.
//   5. Farbe: Drei Farbeimer stehen bereit, der Bewohner zeigt seine Lieblingsfarbe (jede Farbe ist richtig).
//      Eimer antippen → über die Wände wischen: Sie werden bunt.
//   6. Einzug: Fahne obendrauf, der Bewohner läuft zur Tür und winkt, aus dem Schornstein steigt Rauch, Sticker.
//   7. Das fertige Haus wandert in die kleine Siedlung hinten am Hang (wächst über die Runden, wird gespeichert).

import { spr, meta, voice, fx, tap, drag, wipe, hold, note, sfxSchleife, store, Actor, PIXI, rand, pick, isTweening } from '../../engine/index.js';
import { Seite } from '../../gemeinsam/seiten.js';
import { belohne } from '../../gemeinsam/sticker.js';
import { Wolken, Schmetterling, helmTier, freuen, kopfAufSeite, ton, laut, Beutel, einfaerben, HandStart } from './deko.js';

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

// Mischer (rückwärts an die Platte, die Rinne hinten links gießt auf die Platte)
const MISCHER_S = 0.5;
const MISCHER = { x: 840, y: 1150 };
const BETON_Y = 942;        // Mitte der Betonschicht auf der Platte
const BETON_H = 104;
const GIESS_DAUER = 2.4;    // so lange festhalten, bis die Platte bedeckt ist

// Wandfarbe, Turm, Dachfarbe – jede Runde ein anderes Haus
const DAECHER = [null, 0x7aa6e6, 0x86c77a, 0xc08a5c];   // null = rotes Ziegeldach wie im Bild
const HAEUSER = [
  { wand: 'rot', turm: false, dach: 0 },
  { wand: 'gelb', turm: true, dach: 1 },
  { wand: 'gelb', turm: false, dach: 2 },
  { wand: 'rot', turm: true, dach: 3 },
  { wand: 'rot', turm: false, dach: 1 },
  { wand: 'gelb', turm: true, dach: 0 },
];
const WAND = { rot: 'baustelle/teil_wand_rot', gelb: 'baustelle/teil_wand_gelb' };
// Hellwerden beim Umstreichen: dunkle rote Ziegel brauchen mehr als helle gelbe
const HELL = { rot: { k: 1.5, b: 0.26 }, gelb: { k: 0.95, b: 0.16 }, turm: { k: 1.0, b: 0.16 }, dach: { k: 1.35, b: 0.18 } };

export const FARBEN = [
  { id: 'blau', tex: 'baustelle/farbeimer_blau', c: 0x8fcaf2 },
  { id: 'rosa', tex: 'baustelle/farbeimer_rosa', c: 0xf7a9c6 },
  { id: 'gruen', tex: 'baustelle/farbeimer_gruen', c: 0x9ee0a2 },
  { id: 'lila', tex: 'baustelle/farbeimer_lila', c: 0xc8aaf0 },
];
const EIMER_S = 0.55;
const EIMER_ORTE = [{ x: -280, y: 1470 }, { x: 40, y: 1470 }, { x: 360, y: 1470 }];

// Wer zieht ein?
const BEWOHNER = ['hase', 'katze', 'maus', 'schaf', 'igel', 'ente', 'fuchs', 'schwein'];
export const HAUSBAU_TIERE = ['hund', ...BEWOHNER];
const WARTEN = { x: -840, y: 1300, scale: 0.26 };

// Siedlung hinten am Hang: Plätze (Standlinie direkt hinter dem Bauzaun) in der Reihenfolge des Füllens
// (nicht bei x ≈ -620: dort steht der Kran in Ruhe; nicht links von -900: dort ist der Pfeil-Knopf)
const SIEDLUNG = [{ x: 470, y: 770 }, { x: -400, y: 770 }, { x: 920, y: 778 }, { x: 70, y: 765 }, { x: -900, y: 778 }];
const MINI = 0.27;
const SIEDLUNG_KEY = 'baustelle.siedlung';

// Teile, die schon sicher auf dem Weg zu ihrem Platz sind
const UNTERWEGS = new Set(['wartet', 'kran', 'kommt']);

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
export function bauplanFilter() {
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

// Nasser Beton: weiche graue Klumpen (einmal je Modul gemalt – Texturen aus Canvas nie je Szene neu)
let betonTextur = null;
function betonTex() {
  if (betonTextur) return betonTextur;
  const W = 760;
  const H = 128;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d');
  const r = 34;
  g.fillStyle = '#857f77';
  g.beginPath();
  g.moveTo(14 + r, 26);
  g.lineTo(W - 14 - r, 26);
  g.arc(W - 14 - r, 26 + r, r, -Math.PI / 2, 0);
  g.lineTo(W - 14, H - 12 - r);
  g.arc(W - 14 - r, H - 12 - r, r, 0, Math.PI / 2);
  g.lineTo(14 + r, H - 12);
  g.arc(14 + r, H - 12 - r, r, Math.PI / 2, Math.PI);
  g.lineTo(14, 26 + r);
  g.arc(14 + r, 26 + r, r, Math.PI, Math.PI * 1.5);
  g.fill();
  // Klumpen (feste Folge: jedes Mal gleich)
  let s = 7;
  const zufall = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  for (let i = 0; i < 52; i++) {
    const x = 34 + zufall() * (W - 68);
    const y = 34 + zufall() * (H - 64);
    const rad = 16 + zufall() * 22;
    const v = g.createRadialGradient(x - rad * 0.3, y - rad * 0.4, 2, x, y, rad);
    v.addColorStop(0, 'rgba(196,192,185,1)');
    v.addColorStop(0.55, 'rgba(150,145,137,1)');
    v.addColorStop(1, 'rgba(125,119,111,0)');
    g.fillStyle = v;
    g.beginPath();
    g.arc(x, y, rad, 0, Math.PI * 2);
    g.fill();
  }
  betonTextur = PIXI.Texture.from(c);
  return betonTextur;
}

// Plätze eines Hauses: Mitte relativ zum Hausfuß (x Mitte der zwei Wände, y = Standlinie), Bild, Ebene, Bedingung
function plan(haus) {
  const s = [
    { id: 'wandL', art: 'wand', tex: WAND[haus.wand], x: -100, y: -100, z: 2, braucht: [] },
    { id: 'wandR', art: 'wand', tex: WAND[haus.wand], x: 100, y: -100, z: 2, braucht: [] },
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
    this.schmetterling = new Schmetterling(this, { bereich: { x: 560, y: 380, w: 480, h: 180 }, farbe: 0xf7b26a });
    this.hausBeutel = new Beutel(HAEUSER.map((h, i) => i));
    this.bewohnerBeutel = new Beutel(BEWOHNER);
    this.auftraege = [];
    this.kranLaeuft = false;
    this.fertigLaeuft = false;
    this.phase = 'start';
    this.last = null;           // Teil, das gerade am Haken hängt
    this.teile = [];
    this.plaetze = [];
    this.eimer = [];
    this.bauplan = bauplanFilter();
    this.filterListe = new Map();
    this.baueKran();
    this.baueDeko();
    this.baueMischer();
    this.baueBeton();
    this.minis = [];
    this.baueSiedlung();
    this.handStart = new HandStart(this.welt);   // Startpunkt der Zeige-Hand beim Glätten und Streichen
    this.neuesHaus(false);
  }

  betreten() {
    // Hinweis bei jedem Betreten anmelden (der Kern sagt ihn höchstens einmal am Tag) – nur, solange die Seite zu
    // sehen ist und gerade die passende Tätigkeit dran ist
    this._hinweis?.kill();
    this._hinweis = null;
    this.sageHinweis();
  }

  verlassen() {
    this._hinweis?.kill();
    this._hinweis = null;
    this.giessTon?.aus(0.3);
  }

  sageHinweis() {
    if (!this.aktiv) return;
    if (this.phase === 'beton' && !this.gegossen) {
      const passt = () => this.aktiv && this.phase === 'beton' && this.betonP < 0.2;
      this._hinweis = this.after(1.2, () => { if (passt()) voice('baustelle_beton', { nurWenn: passt }); });
    } else if (this.phase === 'bau' && !this.angefangen) {
      const passt = () => this.aktiv && this.phase === 'bau' && !this.angefangen;
      this._hinweis = this.after(1.2, () => { if (passt()) voice('baustelle_haus', { nurWenn: passt }); });
    } else if (this.phase === 'farbe') {
      const passt = () => this.aktiv && this.phase === 'farbe';
      this._hinweis = this.after(0.8, () => { if (passt()) voice('baustelle_farbe', { nurWenn: passt }); });
    }
  }

  // ---------------------------------------------------------------- Farb-Filter (geteilt, in aufraeumen() frei)

  filter(farbe, hell) {
    const key = farbe + '|' + hell;
    let f = this.filterListe.get(key);
    if (!f) {
      f = einfaerben(farbe, HELL[hell]);
      this.filterListe.set(key, f);
    }
    return f;
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

  // ---------------------------------------------------------------- Bewohner

  async bewohnerKommt() {
    const id = this.bewohnerBeutel.ziehe();
    const tier = new Actor(id, { x: -1500, y: WARTEN.y, scale: WARTEN.scale, parent: this.welt, z: 46 });
    this.bewohner = tier;
    tier.onTap(() => this.bewohnerGetippt(tier));
    tier._unterwegs = true;
    while (!tier.destroyed && !(await tier.walkTo(WARTEN.x, WARTEN.y, { tempo: 300 }))) await this.wait(0.3);
    tier._unterwegs = false;
    if (tier.destroyed || this.bewohner !== tier) return;
    tier.lookAt(WARTEN.x + 500);
    // freut sich auf sein Haus: zeigt kurz ein Dach in der Denkblase
    tier.bubble('baustelle/teil_dach', 2.2);
  }

  bewohnerGetippt(tier) {
    laut(tier.tierId);
    if (tier._unterwegs) {
      fx.wobble(tier, 0.05);   // läuft gerade: nur Laut und Wackeln
      return;
    }
    if (this.phase === 'farbe' && this.lieblingsFarbe) {
      fx.wobble(tier, 0.05);
      if (!tier._blase) tier.bubble(this.lieblingsFarbe.tex, 2);
      return;
    }
    this.winke(tier);
  }

  // ---------------------------------------------------------------- Mischer und Beton

  baueMischer() {
    const c = new PIXI.Container({ label: 'mischer' });
    this.mischerBild = spr('baustelle/mischer', { parent: c });
    c.scale.set(MISCHER_S);
    c.position.set(1750, MISCHER.y);
    c.zIndex = 45;
    c.visible = false;
    this.welt.addChild(c);
    this.mischer = c;
    const m = meta('baustelle/mischer');
    // Rinne hinten links an der Trommel (Bildpunkte → Container)
    this.rinne = { x: (40 - m.ax * m.w), y: (300 - m.ay * m.h) };
    // Betonstrahl aus der Rinne (eine weiche graue Zunge; Länge wird beim Gießen gesetzt)
    const strahl = new PIXI.Graphics();
    strahl.zIndex = 44;
    strahl.alpha = 0;
    strahl.eventMode = 'none';
    this.welt.addChild(strahl);
    this.strahl = strahl;
    hold(c, {
      hitArea: new PIXI.Rectangle(-m.ax * m.w - 40, -m.ay * m.h - 40, m.w + 80, m.h + 80),
      onStart: () => this.mischerGetippt(),
      onTick: (dt) => { if (this.phase === 'beton' && this.mischerDa) this.giesse(dt / GIESS_DAUER); },
      onEnd: () => this.strahlAus(),
    });
    this.giessTon = null;
  }

  mischerGetippt() {
    fx.wobble(this.mischerBild, 0.02);
    if (this.phase === 'beton' && this.mischerDa) {
      this.gegossen = true;
      this.giesse(0.1);
      this.strahlAn();
    } else {
      ton('common/hupe', { abstand: 0.8, vol: 0.6 });
    }
  }

  async mischerKommt() {
    const c = this.mischer;
    this.mischerDa = false;
    c.visible = true;
    c.x = 1750;
    ton('common/motor', { abstand: 3, vol: 0.55 });
    // rückwärts: leises Piepen
    for (let i = 0; i < 5; i++) this.after(0.3 + i * 0.6, () => { if (this.aktiv) note('pling', 88, { vol: 0.16 }); });
    await this.tween(c, { x: MISCHER.x }, 3.2, { ease: 'sineInOut' });
    this.mischerDa = true;
    this.zeichneStrahl();
    this.sageHinweis();
  }

  zeichneStrahl() {
    const c = this.mischer;
    const ax = c.x + this.rinne.x * MISCHER_S;
    const ay = c.y + this.rinne.y * MISCHER_S;
    const ex = this.betonRechts - 10;
    const ey = BETON_Y - 10;
    this.strahl.clear()
      .moveTo(ax - 10, ay - 14)
      .bezierCurveTo(ax - 60, ay - 10, ex + 30, ey - 40, ex - 20, ey)
      .lineTo(ex + 30, ey + 6)
      .bezierCurveTo(ex + 40, ey - 30, ax - 30, ay + 20, ax + 10, ay + 14)
      .closePath()
      .fill(0x8f8981)
      .circle(ex + 4, ey + 2, 26).fill(0x9e9890);
  }

  strahlAn() {
    if (this.phase !== 'beton') return;
    this.tween(this.strahl, { alpha: 1 }, 0.25, { ease: 'sineInOut' });
    if (!this.giessTon) this.giessTon = sfxSchleife('common/kran', { vol: 0.45, rate: 0.85 });
    this.giessTon?.an(0.3);
  }

  strahlAus() {
    this.tween(this.strahl, { alpha: 0 }, 0.35, { ease: 'sineInOut' });
    this.giessTon?.aus(0.4);
  }

  baueBeton() {
    const b = new PIXI.Sprite(betonTex());
    b.anchor.set(0.5);
    b.zIndex = 9;
    b.visible = false;
    b.label = 'beton';
    this.welt.addChild(b);
    this.beton = b;
    const maske = new PIXI.Graphics();
    this.welt.addChild(maske);
    this.betonMaske = maske;
  }

  // Bauplatz für das neue Haus: nasser Beton (erst unsichtbar, wächst beim Gießen von rechts nach links)
  legeBeton() {
    const links = this.haus.x - 330 * (F / 1.3);
    const rechts = this.haus.x + (this.def.turm ? 480 : 330) * (F / 1.3);
    this.betonLinks = links;
    this.betonRechts = rechts;
    const b = this.beton;
    b.visible = true;
    b.alpha = 1;
    b.position.set((links + rechts) / 2, BETON_Y);
    b.width = rechts - links;
    b.height = BETON_H;
    b.eventMode = 'none';
    b.mask = this.betonMaske;
    this.betonP = 0;
    this.zeichneMaske();
  }

  zeichneMaske() {
    const w = (this.betonRechts - this.betonLinks) * this.betonP;
    this.betonMaske.clear().rect(this.betonRechts - w - 20, BETON_Y - BETON_H, w + 40, BETON_H * 2).fill(0xffffff);
  }

  giesse(d) {
    if (this.phase !== 'beton' || !this.mischerDa) return;
    this.betonP = Math.min(1, this.betonP + d);
    this.zeichneMaske();
    if (this.strahl.alpha < 0.5) this.strahlAn();
    // ein paar ruhige Spritzer am Auftreffpunkt (höchstens alle 0,5 s)
    const jetzt = performance.now();
    if (jetzt - (this._spritzer || 0) > 500) {
      this._spritzer = jetzt;
      this.burst('staub', this.betonRechts - (this.betonRechts - this.betonLinks) * this.betonP + 20, BETON_Y - 20, { count: 2 });
    }
    if (this.betonP >= 1) this.gegossenFertig();
  }

  async gegossenFertig() {
    this.phase = 'glatt';
    this.strahlAus();
    this.giessTon?.aus(0.5);
    this.beton.mask = null;
    this.betonMaske.clear();
    for (const t of [this.hund]) freuen(this, t, { herzen: 2 });
    await this.wait(0.5);
    // Mischer fährt vorwärts hinaus
    ton('common/hupe', { abstand: 0.6, vol: 0.6 });
    ton('common/motor', { abstand: 3, vol: 0.5 });
    this.tween(this.mischer, { x: 1800 }, 2.4, { ease: 'quadIn' }).then(() => { this.mischer.visible = false; });
    // jetzt glatt streichen
    this.betonWisch = wipe(this.beton, {
      radius: 120,
      hitArea: new PIXI.Rectangle(-420, -150, 840, 300),   // (Bildpunkte der Beton-Textur; ≥ 230 Einheiten hoch)
      sound: 'common/wisch',
      onDone: () => this.glattFertig(),
    });
  }

  async glattFertig() {
    if (this.phase !== 'glatt') return;
    this.phase = 'trocken';
    ton('common/funkeln', { abstand: 0.5, vol: 0.7 });
    for (let i = 0; i < 3; i++) {
      this.burst('funkeln', this.betonLinks + (this.betonRechts - this.betonLinks) * (0.2 + 0.3 * i), BETON_Y - 20, { count: 3 });
    }
    await this.wait(0.9);
    // (das Wischen hat den Rest weich ausgeblendet)
    this.beton.visible = false;
    this.betonWisch?.off();
    this.betonWisch = null;
    for (const p of this.plaetze) if (p.geist && !p.geist.destroyed) this.tween(p.geist, { alpha: 0.6 }, 0.8, { ease: 'sineInOut' });
    this.phase = 'bau';
    this.teileAuslegen();
    this.sageHinweis();
  }

  // ---------------------------------------------------------------- Haus und Teile

  neuesHaus(weich = true) {
    const nr = this.hausBeutel.ziehe();
    const def = HAEUSER[nr];
    this.def = { ...def, nr };
    const hx = def.turm ? 120 : 300;
    const haus = new PIXI.Container({ label: 'haus', sortableChildren: true });
    haus.position.set(hx, BASIS);
    haus.zIndex = 10;
    this.welt.addChild(haus);
    this.haus = haus;
    this.plaetze = plan(def);
    this.teile = [];
    this.angefangen = false;
    this.gegossen = false;
    this.lieblingsFarbe = null;
    this.farbe = null;

    // blasse Umrisse der Plätze
    for (const p of this.plaetze) {
      const g = spr(p.tex, { anchor: 0.5, parent: haus });
      g.scale.set(P);
      g.position.set(p.x, p.y);
      // der Umriss des Schornsteins liegt vor dem Dach (sonst verdeckt), das echte Teil später dahinter
      g.zIndex = p.id === 'schornstein' ? 6 : p.z;
      g.filters = [this.bauplan];
      g.alpha = 0;
      g.eventMode = 'none';
      // erst ganz blass (der Beton soll gut zu sehen sein), beim Bauen deutlicher
      this.tween(g, { alpha: 0.2 }, weich ? 1 : 0.01, { ease: 'sineInOut' });
      p.geist = g;
      p.belegt = null;
      p.reserviert = null;
    }
    this.pruefePlaetze();

    // Der Bewohner kommt, der Mischer setzt an, der nasse Beton wartet (unsichtbar) auf dem Bauplatz
    this.phase = 'beton';
    this.legeBeton();
    this.after(weich ? 0.6 : 0.4, () => this.bewohnerKommt());
    this.after(weich ? 1.4 : 0.8, () => this.mischerKommt());
  }

  // Teile ins Lager (das Dach auf seinen breiten Platz, die übrigen gemischt)
  teileAuslegen() {
    // feste Ordnung, je Haus etwas verschoben (Abwechslung, aber vorhersagbar)
    const dreh = (this.def.nr * 2) % LAGER.length;
    const plaetze = LAGER.slice(dreh).concat(LAGER.slice(0, dreh));
    let i = 0;
    this.teile = [];
    for (const p of this.plaetze) {
      const ort = p.art === 'dach' ? LAGER_DACH : plaetze[i++];
      const t = this.neuesTeil(p, ort);
      this.teile.push(t);
      // erst unsichtbar (in voller Größe, damit die Tippfläche stimmt), dann ploppt es auf
      t.visible = false;
      this.after(0.2 + 0.18 * this.teile.length, () => {
        if (t.destroyed) return;
        t.scale.set(0.01);
        t.visible = true;
        ton('common/plopp', { abstand: 0.12, vol: 0.6 });
        this.tween(t, { scale: P }, 0.4, { ease: 'backOut' });
      });
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
    // das Dach bekommt gleich seine Farbe (auch im Lager)
    if (platz.art === 'dach' && DAECHER[this.def.dach]) t.filters = [this.filter(DAECHER[this.def.dach], 'dach')];
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
    t.tippen = tap(t, () => { fx.wobble(t, 0.05); ton('common/klack', { abstand: 0.2, vol: 0.7 }); }, {
      sound: null, squash: false, pad: Math.max(30, (230 - Math.min(t.width, t.height)) / 2),
    });
    this.pruefePlaetze();
    if (this.plaetze.every((p) => p.belegt)) this.hausSteht();
  }

  // Welche freien Plätze nehmen jetzt schon ein Teil? (nur bei Änderungen neu, nicht jedes Bild)
  pruefePlaetze() {
    for (const p of this.plaetze) p.offen = !p.belegt && this.erlaubt(p, false);
  }

  // ---------------------------------------------------------------- Streichen

  async hausSteht() {
    if (this.fertigLaeuft) return;
    this.fertigLaeuft = true;
    this.phase = 'farbe-kommt';
    await this.wait(0.6);
    if (!this.kranLaeuft) this.kranZu(KRAN_RUHE, 1);
    // drei Eimer (aus vier Farben gemischt), der Bewohner zeigt seine Lieblingsfarbe
    const farben = FARBEN.slice().sort(() => Math.random() - 0.5).slice(0, 3);
    this.eimer = farben.map((f, i) => {
      const e = spr(f.tex, { parent: this.welt });
      e.farbe = f;
      e.scale.set(0.01);
      e.position.set(EIMER_ORTE[i].x, EIMER_ORTE[i].y);
      e.zIndex = 50;
      this.after(0.2 + i * 0.25, async () => {
        if (e.destroyed) return;
        ton('common/plopp', { abstand: 0.12, vol: 0.6 });
        await this.tween(e, { scale: EIMER_S }, 0.45, { ease: 'backOut' });
        // erst jetzt tippbar machen (sonst wird die Tippfläche bei Winz-Größe gemessen)
        if (e.destroyed || e.tippen) return;
        const m = meta(f.tex);
        e.tippen = tap(e, () => this.waehleFarbe(e), {
          sound: 'common/tipp', squash: false,
          hitArea: new PIXI.Rectangle(-m.ax * m.w - 40, -m.ay * m.h - 40, m.w + 80, m.h + 80),
        });
      });
      return e;
    });
    this.phase = 'farbe';
    await this.wait(1.0);
    const lieblings = pick(this.eimer);
    this.lieblingsFarbe = lieblings.farbe;
    if (this.bewohner && !this.bewohner.destroyed && this.phase === 'farbe') {
      this.bewohner.bubble(lieblings.farbe.tex, 2.6);
      const puls = fx.pulse(lieblings, { staerke: 0.05, periode: 1.6 });
      this.after(3.2, () => puls.stop());
    }
    this.sageHinweis();
  }

  async waehleFarbe(e) {
    if (this.phase !== 'farbe') {
      fx.wobble(e, 0.06);
      ton('common/platsch', { abstand: 0.6, vol: 0.4 });
      return;
    }
    this.phase = 'malen';
    this.farbe = e.farbe;
    ton('common/platsch', { abstand: 0.3, vol: 0.6 });
    // die anderen Eimer gehen weg, der gewählte hüpft neben das Haus
    for (const a of this.eimer) {
      if (a === e) continue;
      a.tippen?.off();
      a.eventMode = 'none';
      this.tween(a, { scale: 0.01, alpha: 0 }, 0.4, { ease: 'backIn' }).then(() => a.destroy());
    }
    this.eimer = [e];
    const ziel = { x: this.haus.x - 330 * (F / 1.3) - 110, y: 1180 };
    this.tween(e, { x: ziel.x }, 0.6, { ease: 'sineInOut' });
    this.tween(e, { y: ziel.y - 120 }, 0.3, { ease: 'quadOut' }).then(() => this.tween(e, { y: ziel.y }, 0.3, { ease: 'quadIn' }));
    if (this.bewohner && !this.bewohner.destroyed) freuen(this, this.bewohner, { herzen: e.farbe === this.lieblingsFarbe ? 5 : 3 });
    // Wände (und Turm) bekommen ihre neue Farbe darunter; das Teil selbst wird weggewischt
    this.zuStreichen = [];
    for (const p of this.plaetze) {
      const t = p.belegt;
      if (!t || t.destroyed) continue;
      if (p.art === 'tuer' || p.art === 'fenster') t.eventMode = 'none';   // (darunter wird mitgestrichen)
      if (p.art !== 'wand' && p.art !== 'turm') continue;
      const neu = spr(p.tex, { anchor: 0.5, parent: this.haus });
      neu.scale.set(P);
      neu.position.copyFrom(t.position);
      neu.zIndex = t.zIndex - 0.05;
      neu.filters = [this.filter(e.farbe.c, p.art === 'turm' ? 'turm' : this.def.wand)];
      neu.eventMode = 'none';
      t.tippen?.off();
      const eintrag = { teil: t, neu, fertig: false };
      // großer Pinsel und fertig ab gut zwei Dritteln: Wer der Zeige-Hand folgt (ein Strich quer über alle Wände),
      // ist mit einem, höchstens zwei Strichen fertig
      eintrag.wisch = wipe(t, {
        radius: 140,
        doneAt: 0.65,
        sound: 'common/pinsel',
        onDone: () => { eintrag.fertig = true; this.after(0.8, () => this.pruefeGestrichen()); },
      });
      this.zuStreichen.push(eintrag);
    }
  }

  pruefeGestrichen() {
    if (this.phase !== 'malen' || !this.zuStreichen.every((z) => z.fertig)) return;
    this.phase = 'einzug';
    for (const z of this.zuStreichen) {
      // die frisch gestrichene Wand übernimmt: das alte Teil (schon ausgeblendet) geht
      z.wisch.off();
      z.teil.visible = false;
      z.teil.eventMode = 'none';
      const n = z.neu;
      n.eventMode = 'static';
      tap(n, () => { fx.wobble(n, 0.05); ton('common/klack', { abstand: 0.2, vol: 0.7 }); }, {
        sound: null, squash: false, pad: 30,
      });
    }
    for (const p of this.plaetze) {
      if ((p.art === 'tuer' || p.art === 'fenster') && p.belegt && !p.belegt.destroyed) p.belegt.eventMode = 'static';
    }
    ton('common/funkeln', { abstand: 0.5, vol: 0.7 });
    this.burst('funkeln', this.haus.x, BASIS - 200, { count: 6 });
    // der Eimer hat seine Arbeit getan
    for (const e of this.eimer) {
      e.eventMode = 'none';
      this.tween(e, { scale: 0.01, alpha: 0 }, 0.5, { ease: 'backIn', delay: 0.4 }).then(() => e.destroy());
    }
    this.eimer = [];
    this.einzug();
  }

  // ---------------------------------------------------------------- Einzug und Siedlung

  async einzug() {
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
    await this.wait(0.8);

    // der Bewohner läuft zur Tür und winkt
    const tier = this.bewohner;
    const tuer = this.plaetze.find((p) => p.id === 'tuer');
    if (tier && !tier.destroyed) {
      tier.zIndex = 400;
      // Unterwegs antwortet es ohne Hüpfer (ein Hüpfer beendet das Laufen, sonst spränge es an die Tür). Und falls
      // doch etwas das Laufen unterbricht: weiterlaufen, bis es wirklich an der Tür steht.
      tier._unterwegs = true;
      while (!tier.destroyed && !(await tier.walkTo(haus.x + tuer.x, BASIS, { tempo: 330 }))) await this.wait(0.3);
      tier._unterwegs = false;
      if (tier.destroyed) return;
      haus.addChild(tier);
      tier.position.set(tuer.x, 0);
      tier.scale.set(0.19 * F);
      tier.zIndex = 4.8;
      this.winke(tier);
    }
    // Rauch aus dem Schornstein: ein paar langsame Wölkchen
    const sch = this.plaetze.find((p) => p.id === 'schornstein');
    const so = this.platzOrt(sch);
    const rauch = this.emitter('rauch', { x: so.x, y: so.y - 90, rate: 1.2 });
    this.after(5, () => rauch.stop());
    belohne(this, 'baustelle_kran', haus.x, BASIS - 520);
    await this.wait(1.6);
    if (tier && !tier.destroyed) this.winke(tier);
    await this.wait(2.6);

    // das Haus wandert in die Siedlung hinten am Hang; erst wenn es dort steht, beginnt ein neues (sonst liefen
    // schrumpfendes Haus, neuer Bewohner und Mischer gleichzeitig)
    this.bewohner = null;
    await this.inDieSiedlung(haus, tier);
    await this.wait(0.5);
    this.fertigLaeuft = false;
    this.neuesHaus(true);
  }

  // Jedes Häuschen behält seinen Platz am Hang. Ein neues nimmt den ersten freien Platz; ist alles voll, den Platz
  // des ältesten – das blendet vorher weich aus. So gleitet nie etwas quer über den Hang, und es bewegt sich immer
  // nur eines (erst Ausblenden, dann das neue Haus).
  async inDieSiedlung(haus, tier) {
    // Geister, Lager-Reste und ausgeblendete alte Wandteile brauchen wir nicht mehr
    for (const p of this.plaetze) p.geist?.destroy();
    const liste = this.siedlungListe();
    let platz = SIEDLUNG.findIndex((_, i) => !liste.some((e) => e.platz === i));
    let wegMini = null;
    if (platz < 0) {
      platz = liste.shift().platz;
      wegMini = this.minis.shift();
    }
    liste.push({ nr: this.def.nr, farbe: this.farbe?.id || 'blau', tier: tier?.tierId || 'hase', platz });
    store.set(SIEDLUNG_KEY, liste);
    const slot = SIEDLUNG[platz];
    haus.zIndex = 2;
    for (const c of haus.children) c.eventMode = 'none';
    if (tier && !tier.destroyed) { tier.onTap(() => this.miniGetippt(haus, tier)); }
    if (wegMini && !wegMini.destroyed) {
      wegMini.eventMode = 'none';
      await this.tween(wegMini, { alpha: 0 }, 1.0, { ease: 'sineInOut' });
      wegMini.destroy({ children: true });
    }
    ton('common/wusch', { abstand: 0.5, vol: 0.5 });
    await this.tween(haus, { x: slot.x, y: slot.y, scaleX: MINI, scaleY: MINI }, 2.6, { ease: 'sineInOut' });
    this.macheMiniTippbar(haus, tier);
    this.minis.push(haus);
  }

  // gespeicherte Häuschen (älteste zuerst), jedes mit eigenem Platz (ältere Stände ohne Platz bekommen einen)
  siedlungListe() {
    const l = store.get(SIEDLUNG_KEY, []);
    const liste = Array.isArray(l)
      ? l.filter((e) => e && HAEUSER[e.nr] && typeof e.tier === 'string').slice(-SIEDLUNG.length).map((e) => ({ ...e })) : [];
    const belegt = new Set();
    for (const e of liste) {
      if (Number.isInteger(e.platz) && e.platz >= 0 && e.platz < SIEDLUNG.length && !belegt.has(e.platz)) belegt.add(e.platz);
      else e.platz = -1;
    }
    for (const e of liste) {
      if (e.platz >= 0) continue;
      e.platz = SIEDLUNG.findIndex((_, i) => !belegt.has(i));
      belegt.add(e.platz);
    }
    return liste;
  }

  // Gespeicherte Häuschen wieder aufbauen (beim ersten Besuch der Seite)
  baueSiedlung() {
    const liste = this.siedlungListe();
    liste.forEach((e) => {
      const def = HAEUSER[e.nr];
      const farbe = FARBEN.find((f) => f.id === e.farbe) || FARBEN[0];
      const haus = new PIXI.Container({ label: 'mini', sortableChildren: true });
      haus.position.set(SIEDLUNG[e.platz].x, SIEDLUNG[e.platz].y);
      haus.scale.set(MINI);
      haus.zIndex = 2;
      this.welt.addChild(haus);
      for (const p of plan(def)) {
        const s = spr(p.tex, { anchor: 0.5, parent: haus });
        s.scale.set(P);
        s.position.set(p.x, p.y);
        s.zIndex = p.z + 0.5;
        s.eventMode = 'none';
        if (p.art === 'wand') s.filters = [this.filter(farbe.c, def.wand)];
        else if (p.art === 'turm') s.filters = [this.filter(farbe.c, 'turm')];
        else if (p.art === 'dach' && DAECHER[def.dach]) s.filters = [this.filter(DAECHER[def.dach], 'dach')];
      }
      const fahne = spr('baustelle/teil_fahne', { parent: haus });
      fahne.anchor.set(0.2, 0.97);
      fahne.position.set((def.turm ? 287 : 0) * F, (def.turm ? -192 : -405) * F);
      fahne.scale.set(0.6 * F);
      fahne.zIndex = 6;
      fahne.eventMode = 'none';
      const tier = BEWOHNER.includes(e.tier)
        ? new Actor(e.tier, { x: -100 * F, y: 0, scale: 0.19 * F, parent: haus, z: 4.8 }) : null;
      this.macheMiniTippbar(haus, tier);
      this.minis.push(haus);
    });
  }

  macheMiniTippbar(haus, tier) {
    if (haus.destroyed) return;
    // ein großes Häuschen-Feld (im Haus-Maßstab: das ganze Haus samt Rand)
    haus.hitArea = new PIXI.Rectangle(-450, -700, 960, 790);
    haus.eventMode = 'static';
    tap(haus, () => this.miniGetippt(haus, tier), { sound: null, squash: false });
  }

  miniGetippt(haus, tier) {
    fx.wobble(haus, 0.03);
    note('glocke', pick([76, 79, 84]), { vol: 0.25 });
    if (tier && !tier.destroyed) {
      laut(tier.tierId);
      tier.hop(60);
    }
  }

  winke(tier) {
    if (tier.destroyed) return;
    laut(tier.tierId);
    if (tier._unterwegs) {
      fx.wobble(tier, 0.05);   // läuft noch: nur Laut und Wackeln
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
    // (links hinten neben dem wartenden Bewohner – rechts hält der Mischer und würde den Stapel verdecken)
    const stapel = spr('baustelle/ziegelstapel', { x: -985, y: 1125, parent: this.welt });
    stapel.scale.set(0.46);
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
    if (this.strahl.alpha > 0 && this.mischerDa) this.zeichneStrahl();
    // freie Plätze, auf die jetzt etwas darf, atmen ganz sanft (keine schnellen Helligkeitswechsel) – nur beim Bauen
    if (this.phase !== 'bau') return;
    const atem = 0.5 + 0.5 * Math.sin(t * Math.PI * 2 / 2.6);
    for (const p of this.plaetze) {
      if (p.belegt || !p.geist || p.geist.destroyed) continue;
      if (isTweening(p.geist)) continue;
      p.geist.alpha = p.offen ? 0.62 + 0.2 * atem : 0.45;
    }
  }

  /** Von der Szene in exit() gerufen: die geteilten Filter freigeben. */
  aufraeumen() {
    this.bauplan?.destroy();
    this.bauplan = null;
    for (const f of this.filterListe?.values() || []) f.destroy();
    this.filterListe?.clear();
  }

  hinweise() {
    switch (this.phase) {
      case 'beton':
        return this.mischerDa ? [this.mischer] : [this.hund];
      case 'glatt':
        // (der Kern zeigt einen Zieh-Hinweis nur mit einem sichtbaren Anzeige-Objekt als Start – darum die Marke)
        return [{ von: this.handStart.bei(this.betonLinks + 60, BETON_Y), nach: { x: this.betonRechts - 60, y: BETON_Y } }];
      case 'farbe': {
        const l = this.eimer.find((e) => e.farbe === this.lieblingsFarbe) || this.eimer[0];
        return l ? [l] : [this.hund];
      }
      case 'malen': {
        const offen = (this.zuStreichen || []).filter((z) => !z.fertig);
        if (!offen.length) return [this.hund];
        // ein Strich quer über alle noch offenen Wände, von der linken Kante bis zur rechten (mit dem großen Pinsel
        // reicht das für jede Wand)
        let links = Infinity;
        let rechts = -Infinity;
        let y = 0;
        for (const z of offen) {
          const b = z.teil.getBounds();
          const a = this.welt.toLocal({ x: b.x, y: b.y + b.height / 2 });
          const e = this.welt.toLocal({ x: b.x + b.width, y: b.y + b.height / 2 });
          links = Math.min(links, a.x);
          rechts = Math.max(rechts, e.x);
          y += a.y / offen.length;
        }
        return [{ von: this.handStart.bei(links + 40, y), nach: { x: rechts - 40, y } }];
      }
      case 'bau': {
        const t = this.teile.find((u) => u.zustand === 'lager' && !u.destroyed &&
          this.plaetze.some((p) => p.art === u.art && !p.belegt && !p.reserviert && this.erlaubt(p, false)));
        if (!t) return [this.hund];
        const p = this.plaetze.find((q) => q.art === t.art && !q.belegt && !q.reserviert && this.erlaubt(q, false));
        return [t, { von: t, nach: p.geist }];
      }
      default:
        return [this.hund];
    }
  }
}

