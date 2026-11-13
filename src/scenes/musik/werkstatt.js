// Seite 2 (in der Mitte): Die Musik-Werkstatt (neu in Runde 3).
//
// Links auf der Werkbank wird jede Runde ein Instrument gebaut – abwechselnd eine Ei-Rassel, eine Trommel oder ein
// Zupfkasten (nie zweimal dasselbe hintereinander, über die Besuche gemerkt), jedes in einer anderen Farbe:
//   Rassel:    1. Füllen      – dreimal auf eine Schale tippen (Reis, Bohnen, Perlen – auch gemischt)
//              2. Deckel drauf – den Deckel auf die Rassel ziehen (Antippen geht auch)
//              3. Bemalen     – dreimal auf einen Farbtopf tippen: Tupfen kommen auf die Rassel
//              4. Schütteln   – die Rassel hin und her ziehen (oder antippen)
//              5. Ins Regal   – sie schwebt ins Regal an der Wand. Sticker.
//   Trommel:   1. Fell drauf, 2. vier Schnüre spannen (Trommel antippen, der Ton steigt), 3. Bemalen,
//              4. Probetrommeln, 5. Ins Regal
//   Zupfkasten: 1. drei Saiten aufziehen (die Saiten-Rolle hinziehen), 2. Bemalen, 3. Zupfen (über die Saiten
//              streichen), 4. Ins Regal
// Das Regal wächst über die Besuche (8 Plätze, store 'musik.regal'); jedes Instrument dort klingt beim Antippen.
//
// Rechts auf dem Boden: das Echo-Spiel mit drei Glocken. Ein Tier kommt zu Besuch (jedes Mal ein anderes, mit
// anderem Klang): Antippen → es spielt zwei Töne vor (die Glocken leuchten weich), das Kind antwortet irgendwie
// (falsch gibt es nicht; genau nachgespielt gibt es ein paar Sterne extra), dann drei, dann vier Töne. Manchmal
// spielt das Tier die Antwort des Kindes noch einmal nach. Zum Schluss spielen beide zusammen, Sticker, das Tier
// winkt und geht, ein neues kommt.

import { stage, spr, tap, drag, Actor, fx, note, sfx, voice, store, rand, pick, clamp, lerp, PIXI }
  from '../../engine/index.js';
import { Seite } from '../../gemeinsam/seiten.js';
import { belohne } from '../../gemeinsam/sticker.js';
import { Klangleiste } from './klangleiste.js';
import { gemerkt, waehleFrisch, merke } from './abwechslung.js';

// ---------------------------------------------------------------- Maße (hg_werkstatt: Bank, Regal, Boden)

const WERK = { x: -130, y: 968 };               // hier steht das Instrument auf der Werkbank
const S = 1.3;                                  // so groß wird auf der Werkbank gebaut
const VORRAT_X = [-875, -645, -415];            // Schalen bzw. Farbtöpfe auf der Werkbank
const VORRAT_Y = 968;
const TEIL = { x: 175, y: 968 };                // Deckel / Fell / Saiten-Rolle liegt rechts auf der Bank
const REGAL = [                                 // Plätze im Regal (Füße), oben und unten je vier
  [180, 392], [410, 392], [640, 392], [870, 392],
  [180, 690], [410, 690], [640, 690], [870, 690],
];
const REGAL_SKALA = 0.55;
const ARTEN = ['rassel', 'trommel', 'zupf'];
const FARBEN = [0xff8a7a, 0x7cc8f0, 0x9ad66a, 0xffc845, 0xc39af0, 0xff9fcb];
const KOERNER = {
  reis: { farbe: 0xfffaf0, r: 6, rand: 0xd9cfb8 },
  bohnen: { farbe: 0xb5533c, r: 10, rand: 0x7e3424 },
  perlen: { farbe: null, r: 9, rand: 0xffffff },
};
const SCHRITTE = {
  rassel: ['fuellen', 'deckel', 'malen', 'probieren'],
  trommel: ['fell', 'spannen', 'malen', 'probieren'],
  zupf: ['saiten', 'malen', 'probieren'],
};
const PROBIEREN_GENUG = { rassel: 6, trommel: 5, zupf: 6 };
const ZUPF_TOENE = [72, 76, 79];

const GLOCKEN_X = [150, 380, 610];
const GLOCKEN_Y = 1460;
const GLOCKEN_FARBEN = [0xffb3a8, 0xfff0a0, 0xa8d8ff];
const ECHO_X = 860;
const ECHO_Y = 1500;
const ECHO_SKALA = 0.3;
const ECHO_GAESTE = ['frosch', 'eule', 'ente', 'igel', 'schaf', 'hase', 'fuchs', 'pinguin'];
const ECHO_KLAENGE = [
  { instr: 'glocke', toene: [79, 84, 88], vol: 0.3 },
  { instr: 'xylo', toene: [72, 76, 79], vol: 0.75 },
  { instr: 'pling', toene: [76, 79, 84], vol: 0.4 },
];
const ECHO_LAENGEN = [2, 3, 4];
const ECHO_ABSTAND = 0.7;      // Sekunden zwischen zwei vorgespielten Tönen (gemächlich)

// Ruhe-Regel für Flüge: Spitze höchstens 1000 Einheiten/s (sineInOut: Spitze = π/2 · Schnitt)
function flugZeit(dx, dy, { bogen = 0, mindestens = 0.6 } = {}) {
  const weg = Math.hypot(Math.hypot(dx, dy), 2 * bogen);
  return Math.max(mindestens, (weg * Math.PI) / 2 / 1000);
}

// etwas dunklere Farbe für Ränder
function dunkler(c, f = 0.72) {
  const r = Math.round(((c >> 16) & 255) * f);
  const g = Math.round(((c >> 8) & 255) * f);
  const b = Math.round((c & 255) * f);
  return (r << 16) | (g << 8) | b;
}

// ---------------------------------------------------------------- gezeichnete Instrumente (Knete-Stil)

// Halbe Ellipse als Vieleck (unten: a 0…π, oben: a π…2π)
function halbEi(rx, ry, oben) {
  const p = [];
  for (let k = 0; k <= 24; k++) {
    const a = (oben ? Math.PI : 0) + (Math.PI * k) / 24;
    p.push(rx * Math.cos(a), ry * Math.sin(a));
  }
  return p;
}

/**
 * Ein Instrument zum Bauen (Ursprung = Füße, Mitte unten). Alle Teile sind da, die fehlenden noch unsichtbar.
 * → { c, art, farbe, ... } mit den Teilen, die der Bau-Ablauf ein- und ausschaltet.
 */
function baueInstrument(art, farbe) {
  const c = new PIXI.Container({ label: 'bau:' + art });
  const rand_ = dunkler(farbe);
  const holz = 0xd99a4a;
  const holzRand = 0xa86a2a;
  const d = { c, art, farbe, deko: new PIXI.Container(), dekoZahl: 0 };
  // weicher Schatten
  c.addChild(new PIXI.Graphics().ellipse(0, -4, art === 'zupf' ? 170 : 130, 18).fill({ color: 0x5a3a1a, alpha: 0.18 }));
  if (art === 'rassel') {
    c.addChild(new PIXI.Graphics().ellipse(0, -10, 72, 18).fill(holz).stroke({ width: 5, color: holzRand }));
    const ei = new PIXI.Container();
    ei.y = -122;
    c.addChild(ei);
    const unten = new PIXI.Graphics().poly(halbEi(90, 108, false)).fill(farbe).stroke({ width: 6, color: rand_ });
    unten.ellipse(-40, 40, 16, 26).fill({ color: 0xffffff, alpha: 0.22 });
    const oeffnung = new PIXI.Graphics().ellipse(0, 0, 88, 22).fill(0x6b3f22).stroke({ width: 5, color: rand_ });
    const koerner = new PIXI.Container();
    const deckel = new PIXI.Graphics().poly(halbEi(90, 108, true)).fill(farbe).stroke({ width: 6, color: rand_ });
    deckel.ellipse(-36, -62, 18, 26).fill({ color: 0xffffff, alpha: 0.3 });
    deckel.visible = false;
    // Tupfen liegen über dem Deckel (sie kommen erst, wenn er drauf ist)
    ei.addChild(unten, oeffnung, koerner, deckel, d.deko);
    Object.assign(d, { ei, oeffnung, koerner, deckel, fuellung: [] });
  } else if (art === 'trommel') {
    const g = new PIXI.Graphics();
    g.roundRect(-118, -224, 236, 214, 28).fill(farbe).stroke({ width: 6, color: rand_ });
    g.roundRect(-104, -210, 30, 180, 14).fill({ color: 0xffffff, alpha: 0.2 });
    g.roundRect(-126, -36, 252, 34, 16).fill(holz).stroke({ width: 5, color: holzRand });
    g.roundRect(-126, -246, 252, 34, 16).fill(holz).stroke({ width: 5, color: holzRand });
    const oeffnung = new PIXI.Graphics().ellipse(0, -246, 114, 30).fill(0x5a3422).stroke({ width: 5, color: holzRand });
    const fell = new PIXI.Graphics().ellipse(0, -248, 116, 31).fill(0xf7ecd2).stroke({ width: 5, color: 0xcdb990 })
      .ellipse(-34, -256, 40, 9).fill({ color: 0xffffff, alpha: 0.5 });
    fell.visible = false;
    const seile = new PIXI.Container();
    c.addChild(g, d.deko, seile, oeffnung, fell);
    Object.assign(d, { oeffnung, fell, seile, seilZahl: 0, ton: pick([33, 34, 35]) });
  } else {
    const g = new PIXI.Graphics();
    g.roundRect(-150, -330, 300, 324, 48).fill(farbe).stroke({ width: 6, color: rand_ });
    g.roundRect(-132, -312, 40, 250, 20).fill({ color: 0xffffff, alpha: 0.2 });
    g.circle(0, -178, 54).fill(0x5a3422).stroke({ width: 8, color: holz });
    g.roundRect(-112, -306, 224, 24, 11).fill(holz).stroke({ width: 4, color: holzRand });
    g.roundRect(-112, -74, 224, 24, 11).fill(holz).stroke({ width: 4, color: holzRand });
    const saiten = [-60, 0, 60].map((x) => {
      const s = new PIXI.Graphics().moveTo(x, -296).lineTo(x, -60).stroke({ width: 6, color: 0xfff6dd, cap: 'round' })
        .circle(x, -296, 9).fill(0xffd27a).circle(x, -60, 9).fill(0xffd27a);
      s.visible = false;
      return s;
    });
    c.addChild(g, d.deko, ...saiten);
    Object.assign(d, { saiten, saitenZahl: 0, schwingen: [0, 0, 0] });
  }
  return d;
}

// Tupfen der k-ten Farbe auf das Instrument (k = 0, 1, 2 → jede Reihe an anderer Stelle)
function bemale(d, farbe) {
  const k = d.dekoZahl++;
  const g = new PIXI.Graphics();
  const tupf = (x, y, r = 15) => {
    g.circle(x, y, r).fill(farbe).stroke({ width: 3, color: 0xffffff, alpha: 0.85 });
    g.circle(x - r * 0.3, y - r * 0.3, r * 0.3).fill({ color: 0xffffff, alpha: 0.45 });
  };
  if (d.art === 'rassel') {
    // Reihen auf dem Ei (Mitte des Eis = 0, ±108 hoch)
    const y = [-50, 50, 0][k % 3];
    const breit = 90 * Math.sqrt(1 - (y / 108) ** 2) * 0.78;
    for (let i = -2; i <= 2; i++) tupf((i / 2) * breit, y + Math.abs(i) * 4, k % 3 === 2 ? 12 : 15);
  } else if (d.art === 'trommel') {
    const y = [-178, -92, -135][k % 3];
    for (let i = -2; i <= 2; i++) tupf(i * 44 + (k % 3 === 2 ? 22 : 0), y, 16);
  } else if (k % 3 === 0) {
    for (let i = 0; i < 8; i++) {
      const w = (i / 8) * Math.PI * 2;
      tupf(Math.cos(w) * 82, -178 + Math.sin(w) * 82, 11);
    }
  } else if (k % 3 === 1) {
    for (let i = -2; i <= 2; i++) tupf(i * 56, -28, 12);
  } else {
    for (const x of [-126, 126]) for (let i = 0; i < 4; i++) tupf(x, -250 + i * 56, 11);
  }
  d.deko.addChild(g);
  return g;
}

// Körner in die offene Rassel
function fuelle(d, sorte) {
  const ko = KOERNER[sorte];
  d.fuellung.push(sorte);
  const g = new PIXI.Graphics();
  for (let i = 0; i < 9; i++) {
    const w = rand(0, Math.PI * 2);
    const r = Math.sqrt(Math.random());
    const x = Math.cos(w) * r * 66;
    const y = Math.sin(w) * r * 12 - (d.fuellung.length - 1) * 3;
    const f = ko.farbe ?? pick(FARBEN);
    if (sorte === 'bohnen') g.ellipse(x, y, ko.r * 1.3, ko.r * 0.85).fill(f).stroke({ width: 2, color: ko.rand });
    else g.circle(x, y, ko.r).fill(f).stroke({ width: 2, color: ko.rand, alpha: 0.7 });
  }
  d.koerner.addChild(g);
}

/** Fertiges Instrument (fürs Regal) aus einem gemerkten Eintrag */
function fertigesInstrument(e) {
  const d = baueInstrument(e.a, FARBEN[e.f] ?? FARBEN[0]);
  if (e.a === 'rassel') {
    d.deckel.visible = true;
    d.oeffnung.visible = false;
    d.koerner.visible = false;
    d.fuellung = Array.isArray(e.k) ? e.k.filter((s) => KOERNER[s]) : ['reis'];
  } else if (e.a === 'trommel') {
    d.fell.visible = true;
    d.oeffnung.visible = false;
    for (let k = 0; k < 4; k++) seil(d);
    if (Number.isFinite(e.t)) d.ton = e.t;
  } else {
    for (const s of d.saiten) s.visible = true;
    d.saitenZahl = 3;
  }
  for (const f of Array.isArray(e.d) ? e.d : []) bemale(d, FARBEN[f] ?? FARBEN[0]);
  return d;
}

// Ein Stück Schnur (Zickzack) an der Trommel
function seil(d) {
  const k = d.seilZahl++;
  const x = -96 + k * 48;
  d.seile.addChild(new PIXI.Graphics()
    .moveTo(x, -214).lineTo(x + 24, -44).lineTo(x + 48, -214)
    .stroke({ width: 6, color: 0xfff6dd, cap: 'round', join: 'round' }));
}

/** Klang eines fertigen (oder gerade ausprobierten) Instruments */
function klang(d, staerke = 1) {
  if (d.art === 'rassel') {
    const f = d.fuellung;
    const viel = (s) => f.filter((x) => x === s).length;
    note('trommel', 42, { vol: 0.32 * staerke });
    if (viel('bohnen') >= 1) note('trommel', 38, { vol: 0.08 * staerke * viel('bohnen') });
    if (viel('perlen') >= 1) note('glocke', 96, { vol: 0.04 * staerke * viel('perlen') });
    return;
  }
  if (d.art === 'trommel') {
    note('trommel', d.ton, { vol: 0.7 * staerke });
    return;
  }
  note('pling', ZUPF_TOENE[1], { vol: 0.3 * staerke });
}

// ---------------------------------------------------------------- Vorrat: Schalen und Farbtöpfe

function schale(sorte) {
  const g = new PIXI.Graphics();
  g.ellipse(0, -6, 92, 16).fill({ color: 0x5a3a1a, alpha: 0.18 });
  const ko = KOERNER[sorte];
  // Häufchen
  for (let i = 0; i < 22; i++) {
    const x = rand(-58, 58);
    const y = -66 - rand(0, 26) * (1 - Math.abs(x) / 70);
    const f = ko.farbe ?? FARBEN[i % FARBEN.length];
    if (sorte === 'bohnen') g.ellipse(x, y, ko.r * 1.3, ko.r * 0.85).fill(f).stroke({ width: 2, color: ko.rand });
    else g.circle(x, y, ko.r + 1).fill(f).stroke({ width: 2, color: ko.rand, alpha: 0.7 });
  }
  // Holzschale (vorn über dem Häufchen)
  g.poly(halbEi(86, 62, false).map((v, i) => (i % 2 ? v - 64 : v))).fill(0xc98a4a).stroke({ width: 5, color: 0x9a6230 });
  g.ellipse(-36, -40, 16, 8).fill({ color: 0xffffff, alpha: 0.25 });
  return g;
}

function farbtopf(farbe) {
  const g = new PIXI.Graphics();
  g.ellipse(0, -6, 76, 14).fill({ color: 0x5a3a1a, alpha: 0.18 });
  g.roundRect(-62, -120, 124, 116, 26).fill(0xf3f0ea).stroke({ width: 5, color: 0xc9c1b4 });
  g.ellipse(0, -118, 62, 18).fill(farbe).stroke({ width: 5, color: dunkler(farbe) });
  g.roundRect(-62, -96, 124, 26, 12).fill(farbe);
  g.ellipse(-24, -122, 18, 5).fill({ color: 0xffffff, alpha: 0.5 });
  // Pinsel im Topf
  g.roundRect(18, -210, 16, 100, 8).fill(0xd99a4a).stroke({ width: 3, color: 0xa86a2a });
  g.roundRect(14, -132, 24, 26, 8).fill(farbe);
  return g;
}

// Teil, das auf das Instrument kommt (liegt rechts auf der Bank)
function teilBild(art, farbe) {
  const g = new PIXI.Graphics();
  g.ellipse(0, -6, 100, 14).fill({ color: 0x5a3a1a, alpha: 0.18 });
  if (art === 'rassel') {
    g.poly(halbEi(90, 108, true).map((v, i) => (i % 2 ? v - 8 : v))).fill(farbe).stroke({ width: 6, color: dunkler(farbe) });
    g.ellipse(-36, -70, 18, 26).fill({ color: 0xffffff, alpha: 0.3 });
  } else if (art === 'trommel') {
    // zusammengerolltes Fell
    g.roundRect(-110, -70, 220, 64, 32).fill(0xf7ecd2).stroke({ width: 5, color: 0xcdb990 });
    g.ellipse(84, -38, 22, 30).fill(0xeadcb8).stroke({ width: 4, color: 0xcdb990 });
    g.roundRect(-90, -62, 120, 12, 6).fill({ color: 0xffffff, alpha: 0.5 });
  } else {
    // Saiten-Rolle
    g.circle(0, -70, 62).fill(0xffd27a).stroke({ width: 6, color: 0xd99a2b });
    for (let r = 48; r > 18; r -= 10) g.circle(0, -70, r).stroke({ width: 4, color: 0xfff6dd });
    g.circle(0, -70, 14).fill(0xa86a2a);
  }
  return g;
}

// ---------------------------------------------------------------- Seite

export class Werkstatt extends Seite {
  static hg = 'musik/hg_werkstatt';

  aufbau() {
    this.fokus = 'bau';
    this.artZuletzt = gemerkt('musik.bauarten', ARTEN);
    this.letzteFarbe = -1;
    this.baueRegal();
    this.baueVorrat();
    this.baueTeil();
    this.baueGriff();
    this.baueZupfFeld();
    this.baueGlocken();
    this.echo = { phase: 'leer', tier: null, runde: 0, folge: [], antwort: [], lauf: 0, klang: ECHO_KLAENGE[0] };
    this.echoZuletzt = gemerkt('musik.echogaeste', ECHO_GAESTE);
    this.neuerBau(this.szene.params?.werkbau);
    this.after(1.0, () => this.echoGastKommt());
  }

  // ---------------------------------------------------------------- Hilfen

  bildPunkt(px, py) {
    const hg = this.hg;
    const t = hg.texture;
    return {
      x: hg.x + (px / 2829 - hg.anchor.x) * t.width * hg.scale.x,
      y: hg.y + (py / 1600 - hg.anchor.y) * t.height * hg.scale.y,
    };
  }

  handPunkt(name, x, y) {
    this.handPunkte ??= {};
    let g = this.handPunkte[name];
    if (!g || g.destroyed) {
      g = new PIXI.Graphics().rect(-3, -3, 6, 6).fill({ color: 0xffffff, alpha: 0.001 });
      g.eventMode = 'none';
      g.label = 'handPunkt:' + name;
      this.welt.addChild(g);
      this.handPunkte[name] = g;
    }
    g.position.set(x, y);
    return g;
  }

  // Etwas fliegt gemächlich im Bogen (höchstens ≈ 1000 Einheiten/s an der schnellsten Stelle)
  fliege(obj, zx, zy, { bogen = 120, mindestens = 0.6, skala = null } = {}) {
    const x0 = obj.x;
    const y0 = obj.y;
    const p = { k: 0 };
    const dauer = flugZeit(zx - x0, zy - y0, { bogen, mindestens });
    // Größe als eigener Tween: so kennt der Kern die neue Ruhe-Größe (Wackeln/Pulsieren stellt sie nicht zurück)
    if (skala !== null) this.tween(obj, { scale: skala }, dauer, { ease: 'sineInOut' });
    return this.tween(p, { k: 1 }, dauer, {
      ease: 'sineInOut',
      onUpdate: () => {
        if (obj.destroyed) return;
        obj.x = lerp(x0, zx, p.k);
        obj.y = lerp(y0, zy, p.k) - bogen * Math.sin(Math.PI * p.k);
      },
    });
  }

  // ---------------------------------------------------------------- Regal (wächst über die Besuche)

  baueRegal() {
    this.regal = new Array(REGAL.length).fill(null);
    const roh = store.get('musik.regal', []);
    this.regalListe = Array.isArray(roh) ? roh.filter((e) => e && ARTEN.includes(e.a)).slice(-REGAL.length) : [];
    this.regalZahl = clamp(Math.floor(Number(store.get('musik.regalzahl', this.regalListe.length)) || 0), 0, 99999);
    // Die gemerkten Instrumente stehen auf ihren Plätzen (ältestes zuerst)
    const n = this.regalListe.length;
    this.regalListe.forEach((e, i) => {
      const platz = (this.regalZahl - n + i) % REGAL.length;
      const d = fertigesInstrument(e);
      this.stelleInsRegal(d, (platz + REGAL.length) % REGAL.length);
    });
  }

  stelleInsRegal(d, platz) {
    const [x, y] = REGAL[platz];
    d.c.position.set(x, y);
    d.c.scale.set(REGAL_SKALA);
    d.c.zIndex = 5;
    if (d.c.parent !== this.welt) this.welt.addChild(d.c);
    d.c.eventMode = 'static';
    d.regalPlatz = platz;
    this.regal[platz] = d;
    let zuletzt = -9;
    tap(d.c, () => {
      fx.wobble(d.c, 0.08);
      const t = this.szene.t;
      if (t - zuletzt < 0.35) return;
      zuletzt = t;
      if (d.art === 'zupf') ZUPF_TOENE.forEach((m, k) => this.after(0.12 * k, () => note('pling', m, { vol: 0.26 })));
      else if (d.art === 'rassel') {
        klang(d, 0.8);
        this.after(0.16, () => klang(d, 0.5));
      } else klang(d, 0.8);
    }, { sound: null, squash: false, hitArea: new PIXI.Rectangle(-290, -500, 580, 540) });
  }

  // ---------------------------------------------------------------- Vorrat (Schalen / Farbtöpfe)

  baueVorrat() {
    this.vorrat = VORRAT_X.map((x, i) => {
      const c = new PIXI.Container({ label: 'vorrat' + i });
      c.position.set(x, VORRAT_Y);
      c.scale.set(1.25);
      c.zIndex = 20;
      c.visible = false;
      c.alpha = 0;
      this.welt.addChild(c);
      const v = { c, i, bild: null, sorte: null, farbe: null };
      tap(c, () => this.vorratTipp(v), { sound: null, squash: true, hitArea: new PIXI.Rectangle(-92, -190, 184, 214) });
      return v;
    });
    this.vorratModus = null;
  }

  // modus: 'schalen' | 'farben' | null (alles weg) – weich aus- und eingeblendet
  zeigeVorrat(modus) {
    if (this.vorratModus === modus) return;
    this.vorratModus = modus;
    const farben = FARBEN.map((f, i) => i).filter((i) => i !== this.bau?.farbIdx).sort(() => Math.random() - 0.5);
    this.vorrat.forEach((v, i) => {
      const neu = () => {
        if (v.c.destroyed) return;
        if (v.bild) v.bild.destroy();
        v.bild = null;
        if (!modus) {
          v.c.visible = false;
          return;
        }
        if (modus === 'schalen') {
          v.sorte = ['reis', 'bohnen', 'perlen'][i];
          v.bild = schale(v.sorte);
        } else {
          v.farbe = farben[i];
          v.bild = farbtopf(FARBEN[v.farbe]);
        }
        v.c.addChild(v.bild);
        v.c.visible = true;
        this.tween(v.c, { alpha: 1 }, 0.5, { ease: 'sineInOut', delay: 0.12 * i });
      };
      if (v.c.visible && v.c.alpha > 0) this.tween(v.c, { alpha: 0 }, 0.4, { ease: 'sineInOut' }).then(neu);
      else neu();
    });
  }

  vorratTipp(v) {
    this.fokus = 'bau';
    const b = this.bau;
    if (!b || !this.vorratModus || !v.bild) return;
    if (this.vorratModus === 'schalen' && b.schritt === 'fuellen' && b.unterwegs + b.d.fuellung.length < 3) {
      b.unterwegs++;
      sfx('common/sand', { vol: 0.25 });
      const happen = new PIXI.Graphics();
      const ko = KOERNER[v.sorte];
      for (let k = 0; k < 7; k++) {
        happen.circle(rand(-22, 22), rand(-14, 8), ko.r + 1).fill(ko.farbe ?? pick(FARBEN));
      }
      happen.position.set(v.c.x, v.c.y - 100);
      happen.zIndex = 60;
      this.welt.addChild(happen);
      this.fliege(happen, WERK.x, WERK.y - 135 * S, { bogen: 140 }).then(() => {
        happen.destroy();
        if (b !== this.bau) return;
        b.unterwegs--;
        fuelle(b.d, v.sorte);
        if (this.aktiv) klang(b.d, 0.8);
        fx.wobble(b.d.c, 0.05);
        if (b.d.fuellung.length >= 3 && !b.unterwegs) this.weiter();
      });
      return;
    }
    if (this.vorratModus === 'farben' && b.schritt === 'malen' && b.unterwegs + b.d.dekoZahl < 3) {
      b.unterwegs++;
      const farbe = FARBEN[v.farbe];
      const klecks = new PIXI.Graphics().circle(0, 0, 26).fill(farbe).stroke({ width: 4, color: 0xffffff, alpha: 0.8 });
      klecks.position.set(v.c.x + 30, v.c.y - 170);
      klecks.zIndex = 60;
      this.welt.addChild(klecks);
      const hoehe = (b.d.art === 'zupf' ? 180 : 140) * S;
      this.fliege(klecks, WERK.x, WERK.y - hoehe, { bogen: 120 }).then(() => {
        klecks.destroy();
        if (b !== this.bau) return;
        b.unterwegs--;
        bemale(b.d, farbe);
        b.deko.push(v.farbe);
        if (this.aktiv) sfx('common/pinsel', { vol: 0.35 });
        fx.pop(b.d.c, 0.05);
        if (b.d.dekoZahl >= 3 && !b.unterwegs) this.weiter();
      });
      return;
    }
    // sonst: die Schale raschelt / der Topf klingt nur
    fx.wobble(v.c, 0.06);
    if (this.vorratModus === 'schalen') note('trommel', 42, { vol: 0.2 });
    else note('glocke', 84, { vol: 0.16 });
  }

  // ---------------------------------------------------------------- Teil (Deckel / Fell / Saite)

  baueTeil() {
    const c = new PIXI.Container({ label: 'teil' });
    c.position.set(TEIL.x, TEIL.y);
    c.scale.set(S);
    c.zIndex = 40;
    c.visible = false;
    c.eventMode = 'none';
    this.welt.addChild(c);
    this.teil = { c, bild: null };
    drag(c, {
      hitArea: new PIXI.Rectangle(-110, -170, 220, 200),
      back: false,
      sound: null,
      targets: () => [{ x: WERK.x, y: WERK.y - 150 * S, radius: 320 }],
      onStart: () => { this.fokus = 'bau'; },
      onDrop: () => this.teilAnbringen(),
    });
  }

  zeigeTeil() {
    const b = this.bau;
    const t = this.teil;
    if (t.bild) t.bild.destroy();
    t.bild = teilBild(b.art, b.d.farbe);
    t.c.addChild(t.bild);
    t.c.position.set(TEIL.x + 60, TEIL.y);
    t.c.alpha = 0;
    t.c.visible = true;
    t.c.eventMode = 'none';
    this.tween(t.c, { alpha: 1, x: TEIL.x }, 0.6, { ease: 'sineOut' }).then(() => {
      if (this.bau === b && this.teilSchritt()) t.c.eventMode = 'static';
    });
  }

  teilSchritt() {
    const s = this.bau?.schritt;
    return s === 'deckel' || s === 'fell' || s === 'saiten';
  }

  // Losgelassen (oder nur angetippt): das Teil schwebt aufs Instrument
  teilAnbringen() {
    const b = this.bau;
    const t = this.teil;
    if (!b || !this.teilSchritt() || b.unterwegs) return;
    b.unterwegs++;
    t.c.eventMode = 'none';
    const zy = WERK.y - S * (b.art === 'rassel' ? 122 : b.art === 'trommel' ? 200 : 180);
    this.fliege(t.c, WERK.x, zy, { bogen: 60, mindestens: 0.5 }).then(() => {
      b.unterwegs--;
      if (b !== this.bau) return;
      t.c.visible = false;
      const d = b.d;
      if (b.art === 'rassel') {
        d.deckel.visible = true;
        d.oeffnung.visible = false;
        d.koerner.visible = false;
        if (this.aktiv) sfx('common/klack', { vol: 0.4 });
        this.weiter();
      } else if (b.art === 'trommel') {
        d.fell.visible = true;
        d.oeffnung.visible = false;
        if (this.aktiv) sfx('common/plopp', { vol: 0.4 });
        this.weiter();
      } else {
        const s = d.saiten[d.saitenZahl++];
        s.visible = true;
        if (this.aktiv) note('pling', ZUPF_TOENE[d.saitenZahl - 1], { vol: 0.3 });
        if (d.saitenZahl >= 3) this.weiter();
        else this.after(0.3, () => { if (this.bau === b) this.zeigeTeil(); });
      }
      fx.pop(d.c, 0.05);
    });
  }

  // ---------------------------------------------------------------- Griff zum Schütteln, Saiten zum Zupfen

  baueGriff() {
    const g = new PIXI.Container({ label: 'griff' });
    g.position.set(WERK.x, WERK.y - 160);
    g.zIndex = 45;
    g.visible = false;
    this.welt.addChild(g);
    this.griff = g;
    let weg = 0;
    let lx = 0;
    let ly = 0;
    drag(g, {
      hitArea: new PIXI.Rectangle(-150, -150, 300, 300),
      lift: 1,
      sound: null,
      heim: () => ({ x: WERK.x, y: WERK.y - 160 }),
      onStart: () => {
        this.fokus = 'bau';
        weg = 0;
        lx = g.x;
        ly = g.y;
        this.schuettle();
      },
      onMove: () => {
        weg += Math.hypot(g.x - lx, g.y - ly);
        lx = g.x;
        ly = g.y;
        if (weg > 140) {
          weg = 0;
          this.schuettle();
        }
      },
      onDrop: () => {},
    });
  }

  schuettle() {
    const b = this.bau;
    if (!b || b.schritt !== 'probieren' || b.art !== 'rassel') return;
    const t = this.szene.t;
    if (t - (b.letztesSchuetteln ?? -9) < 0.2) return;
    b.letztesSchuetteln = t;
    klang(b.d, 1);
    fx.wobble(b.d.c, 0.12);
    this.probiert();
  }

  baueZupfFeld() {
    const f = new PIXI.Container({ label: 'zupffeld' });
    f.position.set(WERK.x, WERK.y);
    f.scale.set(S);
    f.zIndex = 45;
    f.visible = false;
    this.welt.addChild(f);
    this.zupfFeld = f;
    this.zupfLeiste = new Klangleiste(f, {
      felder: [{ x0: -170, x1: -30 }, { x0: -30, x1: 30 }, { x0: 30, x1: 170 }],
      y0: -330, y1: -20, rand: 20,
      onSpiel: (i) => this.zupfe(i),
      darf: () => this.aktiv && this.bau?.schritt === 'probieren' && this.bau?.art === 'zupf',
    });
  }

  zupfe(i) {
    const b = this.bau;
    if (!b || b.art !== 'zupf') return;
    this.fokus = 'bau';
    note('pling', ZUPF_TOENE[i], { vol: 0.34 });
    b.d.schwingen[i] = 1;
    this.probiert();
  }

  // ---------------------------------------------------------------- Bau-Ablauf

  // stand: halb gebautes Instrument vom Rückweg aus dem Stickerbuch (rueckweg()) – es geht damit weiter
  neuerBau(stand = null) {
    const alt = this.pruefeStand(stand);
    const art = alt ? alt.a : !this.artZuletzt.length ? 'rassel' : waehleFrisch(ARTEN, this.artZuletzt, 1);
    if (!alt) this.artZuletzt = merke('musik.bauarten', this.artZuletzt, art);
    let farbIdx = alt ? alt.f : -1;
    if (!alt) do farbIdx = Math.floor(Math.random() * FARBEN.length); while (farbIdx === this.letzteFarbe);
    this.letzteFarbe = farbIdx;
    const d = baueInstrument(art, FARBEN[farbIdx]);
    d.c.position.set(WERK.x, WERK.y);
    d.c.scale.set(S);
    d.c.zIndex = 30;
    d.c.alpha = 0;
    this.welt.addChild(d.c);
    this.bau = { art, d, farbIdx, schritte: SCHRITTE[art], nr: -1, schritt: null, unterwegs: 0, deko: [], probiert: 0 };
    if (alt) this.stelleWieder(alt);
    d.tipp = tap(d.c, () => this.instrumentTipp(), {
      sound: null, squash: false, hitArea: new PIXI.Rectangle(-170, -350, 340, 370),
    });
    this.tween(d.c, { alpha: 1 }, 0.6, { ease: 'sineInOut' });
    this.weiter();
  }

  /** Stand des halb gebauten Instruments für scene.rückkehr() – null, wenn gerade nichts halb fertig ist. */
  rueckweg() {
    const b = this.bau;
    if (!b || b.d.c.destroyed || b.gespeichert) return null;
    const d = b.d;
    // Schon fertig, aber noch nicht im Regal: das Ausprobieren kommt noch einmal (dann geht es ins Regal)
    const nr = b.schritt === 'fertig' ? b.schritte.length - 1 : b.nr;
    const stand = { a: b.art, f: b.farbIdx, nr, d: b.deko.slice(0, 3) };
    if (b.art === 'rassel') stand.k = d.fuellung.slice(0, 3);
    if (b.art === 'trommel') Object.assign(stand, { s: d.seilZahl, t: d.ton });
    if (b.art === 'zupf') stand.s = d.saitenZahl;
    return stand;
  }

  // Mitgebrachten Stand prüfen (alte oder kaputte Werte → null, dann beginnt einfach ein neues Instrument)
  pruefeStand(st) {
    if (!st || typeof st !== 'object' || !ARTEN.includes(st.a)) return null;
    const f = Math.floor(Number(st.f));
    const nr = Math.floor(Number(st.nr));
    if (!(f >= 0 && f < FARBEN.length) || !(nr >= 0 && nr < SCHRITTE[st.a].length)) return null;
    const zahl = (x, max) => clamp(Math.floor(Number(x)) || 0, 0, max);
    return {
      a: st.a, f, nr,
      d: (Array.isArray(st.d) ? st.d : []).map((x) => Math.floor(Number(x))).filter((x) => x >= 0 && x < FARBEN.length).slice(0, 3),
      k: (Array.isArray(st.k) ? st.k : []).filter((s) => KOERNER[s]).slice(0, 3),
      s: zahl(st.s, st.a === 'trommel' ? 4 : 3),
      t: Number.isFinite(st.t) ? clamp(st.t, 30, 40) : null,
    };
  }

  // Das Instrument so weit zusammensetzen, wie es beim Weggehen war (ohne Töne)
  stelleWieder(st) {
    const b = this.bau;
    const d = b.d;
    const schritt = b.schritte[st.nr];
    const fertigBis = (s) => b.schritte.indexOf(s) < st.nr;   // dieser Schritt war schon geschafft
    if (b.art === 'rassel') {
      const k = fertigBis('fuellen') ? [...st.k, 'reis', 'reis', 'reis'].slice(0, 3) : st.k;
      for (const s of k) fuelle(d, s);
      if (fertigBis('deckel')) {
        d.deckel.visible = true;
        d.oeffnung.visible = false;
        d.koerner.visible = false;
      }
    } else if (b.art === 'trommel') {
      if (st.t !== null) d.ton = st.t;
      if (fertigBis('fell')) {
        d.fell.visible = true;
        d.oeffnung.visible = false;
      }
      const n = fertigBis('spannen') ? 4 : schritt === 'spannen' ? Math.min(st.s, 3) : 0;
      for (let k = 0; k < n; k++) seil(d);
    } else {
      const n = fertigBis('saiten') ? 3 : Math.min(st.s, 2);
      for (let k = 0; k < n; k++) d.saiten[k].visible = true;
      d.saitenZahl = n;
    }
    const deko = fertigBis('malen') ? [...st.d, b.farbIdx === 0 ? 1 : 0, 2, 3].slice(0, 3) : schritt === 'malen' ? st.d.slice(0, 2) : [];
    for (const f of deko) bemale(d, FARBEN[f]);
    b.deko = deko;
    b.nr = st.nr - 1;   // weiter() setzt beim gemerkten Schritt fort
  }

  // Nächster Schritt der Bau-Kette
  weiter() {
    const b = this.bau;
    b.nr++;
    b.schritt = b.schritte[b.nr] ?? 'fertig';
    b.probiert = 0;
    const s = b.schritt;
    this.zeigeVorrat(s === 'fuellen' ? 'schalen' : s === 'malen' ? 'farben' : null);
    if (s === 'deckel' || s === 'fell' || s === 'saiten') this.after(0.3, () => { if (this.bau === b) this.zeigeTeil(); });
    this.griff.visible = s === 'probieren' && b.art === 'rassel';
    this.zupfFeld.visible = s === 'probieren' && b.art === 'zupf';
    if (s === 'probieren') {
      fx.pulse(b.d.c);
      voice('musik_ausprobieren', { nurWenn: () => this.aktiv && this.bau === b && b.schritt === 'probieren' && !b.probiert });
    } else if (s === 'malen') {
      voice('musik_bemalen', { nurWenn: () => this.aktiv && this.bau === b && b.schritt === 'malen' && !b.d.dekoZahl });
    }
    if (s === 'fertig') this.fertig();
  }

  instrumentTipp() {
    this.fokus = 'bau';
    const b = this.bau;
    if (!b) return;
    const d = b.d;
    if (b.schritt === 'spannen' && d.seilZahl < 4) {
      seil(d);
      note('trommel', 30 + d.seilZahl * 1.5, { vol: 0.55 });
      fx.pop(d.c, 0.05);
      if (d.seilZahl >= 4) this.weiter();
      return;
    }
    if (b.schritt === 'probieren') {
      if (b.art === 'rassel') {
        this.schuettle();
      } else if (b.art === 'trommel') {
        const t = this.szene.t;
        if (t - (b.letzterSchlag ?? -9) < 0.15) return;
        b.letzterSchlag = t;
        klang(d, 1);
        fx.pop(d.c, 0.08);
        this.probiert();
      }
      return;
    }
    if (this.teilSchritt()) {
      // Wer aufs Instrument tippt, bekommt das Teil gezeigt
      fx.pulse(this.teil.c);
      return;
    }
    fx.wobble(d.c, 0.05);
    if (b.schritt === 'fuellen' && d.fuellung.length) klang(d, 0.5);
    else note('pling', 72, { vol: 0.18 });
  }

  probiert() {
    const b = this.bau;
    b.probiert++;
    if (b.probiert % 2 === 0) this.burst('noten', WERK.x + rand(-60, 60), WERK.y - 440, { count: 1 });
    if (b.probiert >= PROBIEREN_GENUG[b.art]) this.weiter();
  }

  // Fertig: Freude, dann schwebt das Instrument ins Regal (Sticker), danach kommt das nächste
  fertig() {
    const b = this.bau;
    const d = b.d;
    this.griff.visible = false;
    this.zupfFeld.visible = false;
    this.zupfLeiste.loslassen();
    d.c.eventMode = 'none';
    d.tipp?.off();   // im Regal klingt es nur noch (stelleInsRegal)
    this.burst('herzen', WERK.x, WERK.y - 380, { count: 4 });
    [72, 76, 79, 84].forEach((m, k) => this.after(0.6 + 0.15 * k, () => { if (this.aktiv) note('glocke', m, { vol: 0.2 }); }));
    const tier = this.echo.tier;
    if (tier && !tier.destroyed && tier.da) this.after(0.5, () => { if (!tier.destroyed) tier.cheer({ parent: this.vorn }); });
    this.after(1.4, () => {
      voice('musik_regal', { nurWenn: () => this.aktiv });
      const platz = this.regalZahl % REGAL.length;
      const alt = this.regal[platz];
      if (alt && !alt.c.destroyed) {
        alt.c.eventMode = 'none';
        this.tween(alt.c, { alpha: 0 }, 0.6, { ease: 'sineInOut' }).then(() => { if (!alt.c.destroyed) alt.c.destroy({ children: true }); });
      }
      this.regal[platz] = null;
      this.regalZahl++;
      const eintrag = { a: b.art, f: b.farbIdx, d: b.deko.slice(0, 3) };
      if (b.art === 'rassel') eintrag.k = d.fuellung.slice(0, 3);
      if (b.art === 'trommel') eintrag.t = d.ton;
      this.regalListe = [...this.regalListe, eintrag].slice(-REGAL.length);
      store.set('musik.regal', this.regalListe);
      store.set('musik.regalzahl', this.regalZahl);
      b.gespeichert = true;   // steht jetzt im Regal-Speicher: der Rückweg bringt es nicht noch einmal
      const [zx, zy] = REGAL[platz];
      d.c.zIndex = 50;
      this.fliege(d.c, zx, zy, { bogen: 140, mindestens: 1.2, skala: REGAL_SKALA }).then(() => {
        if (d.c.destroyed) return;
        if (this.aktiv) sfx('common/landen', { vol: 0.35 });
        this.burst('funkeln', zx, zy - 60, { count: 4 });
        this.stelleInsRegal(d, platz);
        if (this.aktiv) belohne(this, 'musik_rassel', zx - 120, zy - 40);
        this.after(1.4, () => { if (this.bau === b) this.neuerBau(); });
      });
    });
  }

  // ---------------------------------------------------------------- Echo-Spiel

  baueGlocken() {
    this.glocken = GLOCKEN_X.map((x, i) => {
      const c = new PIXI.Container({ label: 'glocke' + i });
      c.position.set(x, GLOCKEN_Y);
      c.zIndex = 30 + i;
      this.welt.addChild(c);
      const schein = new PIXI.Graphics();
      for (let k = 0; k < 5; k++) schein.ellipse(0, -150, 120 - k * 14, 150 - k * 16).fill({ color: 0xfff1a8, alpha: 0.16 });
      schein.alpha = 0;
      const schatten = new PIXI.Graphics().ellipse(0, -2, 90, 16).fill({ color: 0x5a3a1a, alpha: 0.18 });
      const bild = spr('musik/glockenspiel_glocke', { parent: c });
      bild.scale.set(0.72);
      bild.tint = GLOCKEN_FARBEN[i];
      c.addChildAt(schatten, 0);
      c.addChildAt(schein, 0);
      const g = { c, i, bild, schein };
      tap(c, () => this.glockeTipp(g), { sound: null, squash: false, hitArea: new PIXI.Rectangle(-115, -310, 230, 340) });
      return g;
    });
  }

  klingeGlocke(i, { vol = 1 } = {}) {
    const g = this.glocken[i];
    const k = this.echo.klang;
    note(k.instr, k.toene[i], { vol: k.vol * vol });
    fx.wobble(g.c, 0.1);
    this.tween(g.schein, { alpha: 1 }, 0.5, { ease: 'sineInOut' })
      .then((ok) => ok && this.tween(g.schein, { alpha: 0 }, 0.7, { ease: 'sineInOut' }));
  }

  glockeTipp(g) {
    this.fokus = 'echo';
    const e = this.echo;
    if (e.phase === 'vor' || e.phase === 'zurueck' || e.phase === 'schluss') {
      fx.wobble(g.c, 0.05);   // das Tier spielt gerade: nur ein Wackeln, kein Ton obendrauf
      return;
    }
    this.klingeGlocke(g.i);
    if (e.phase === 'wartet') {
      this.echoVorspielen();
      return;
    }
    if (e.phase !== 'antwort') return;
    e.antwort.push(g.i);
    if (e.antwort.length >= e.folge.length) this.echoGeantwortet();
  }

  echoGastKommt() {
    const e = this.echo;
    if (e.tier) return;
    const name = waehleFrisch(ECHO_GAESTE, this.echoZuletzt, 3);
    this.echoZuletzt = merke('musik.echogaeste', this.echoZuletzt, name);
    e.klang = waehleFrisch(ECHO_KLAENGE, e.klangZuletzt ? [e.klangZuletzt] : [], 1, (k) => k.instr);
    e.klangZuletzt = e.klang.instr;
    const g = new Actor(name, { x: stage.W / 2 + 220, y: ECHO_Y, scale: ECHO_SKALA, parent: this.welt });
    g.zIndex = 40;
    g.da = false;
    e.tier = g;
    e.phase = 'kommt';
    e.runde = 0;
    g.onTap(() => this.echoTierTipp(g));
    g.walkTo(ECHO_X, ECHO_Y, { tempo: 240 }).then(() => {
      if (g.destroyed || e.tier !== g) return;
      g.da = true;
      e.phase = 'wartet';
      if (this.aktiv) g.sound();
      g.bubble('musik/glockenspiel_glocke', 3, { seite: 'links' });
    });
  }

  echoTierTipp(g) {
    this.fokus = 'echo';
    const e = this.echo;
    if (e.phase === 'wartet') {
      g.nod();
      this.echoVorspielen();
      return;
    }
    if (e.phase === 'antwort') {
      // noch einmal vorspielen lassen
      g.nod();
      this.echoVorspielen({ nochmal: true });
      return;
    }
    g.cheer({ parent: this.vorn });
  }

  // Das Tier spielt seine kleine Folge vor (die Glocken leuchten weich mit)
  echoVorspielen({ nochmal = false } = {}) {
    const e = this.echo;
    const g = e.tier;
    if (!g || g.destroyed) return;
    if (!nochmal) {
      const n = ECHO_LAENGEN[Math.min(e.runde, ECHO_LAENGEN.length - 1)];
      const f = [];
      for (let k = 0; k < n; k++) {
        let t;
        do t = Math.floor(Math.random() * 3); while (k > 0 && t === f[k - 1] && Math.random() < 0.6);
        f.push(t);
      }
      e.folge = f;
    }
    e.phase = 'vor';
    e.antwort = [];
    const lauf = ++e.lauf;
    e.folge.forEach((i, k) => {
      this.after(0.4 + ECHO_ABSTAND * k, () => {
        if (e.lauf !== lauf || !this.aktiv) return;
        this.klingeGlocke(i, { vol: 0.9 });
        if (k % 2 === 0 && !g.destroyed) g.nod();
      });
    });
    this.after(0.4 + ECHO_ABSTAND * e.folge.length + 0.3, () => {
      if (e.lauf !== lauf || !this.aktiv) return;
      e.phase = 'antwort';
      if (!g.destroyed) g.bubble('musik/glockenspiel_glocke', 2.5, { seite: 'links' });
      voice('musik_echo', { nurWenn: () => this.aktiv && e.phase === 'antwort' && !e.antwort.length });
    });
  }

  // Das Kind hat so viele Töne gespielt, wie das Tier vorgespielt hat: das Tier freut sich (immer)
  echoGeantwortet() {
    const e = this.echo;
    const g = e.tier;
    const genau = e.antwort.every((i, k) => i === e.folge[k]);
    e.phase = 'freude';
    const lauf = ++e.lauf;
    this.after(0.45, () => {
      if (e.lauf !== lauf || !g || g.destroyed) return;
      g.cheer({ parent: this.vorn });
      if (genau) this.burst('sterne', g.x, g.y - 260, { count: 3 });
    });
    e.runde++;
    // Überraschung: manchmal spielt das Tier die Antwort des Kindes noch einmal nach
    const zurueck = e.runde === 2 && Math.random() < 0.6;
    let warte = 1.6;
    if (zurueck) {
      const antwort = e.antwort.slice();
      this.after(1.5, () => {
        if (e.lauf !== lauf || !this.aktiv) return;
        e.phase = 'zurueck';
      });
      antwort.forEach((i, k) => this.after(1.6 + ECHO_ABSTAND * k, () => {
        if (e.lauf !== lauf || !this.aktiv) return;
        this.klingeGlocke(i, { vol: 0.8 });
      }));
      warte = 1.6 + ECHO_ABSTAND * antwort.length + 0.8;
    }
    this.after(warte, () => {
      if (e.lauf !== lauf || !this.aktiv) return;
      if (e.runde >= ECHO_LAENGEN.length) this.echoSchluss();
      else this.echoVorspielen();
    });
  }

  // Zum Schluss spielen alle drei Glocken zusammen hinauf und hinunter, Sticker, das Tier geht
  echoSchluss() {
    const e = this.echo;
    const g = e.tier;
    e.phase = 'schluss';
    const lauf = ++e.lauf;
    [0, 1, 2, 1, 2].forEach((i, k) => this.after(0.32 * k, () => {
      if (e.lauf === lauf && this.aktiv) this.klingeGlocke(i, { vol: 0.8 });
    }));
    this.after(1.8, () => {
      if (e.lauf !== lauf || !g || g.destroyed) return;
      g.cheer({ parent: this.vorn });
      this.burst('herzen', g.x, g.y - 280, { count: 4 });
      if (this.aktiv) belohne(this, 'musik_glocke', 380, 1080);
    });
    this.after(4.6, () => {
      if (e.lauf !== lauf) return;
      e.phase = 'leer';
      e.tier = null;
      if (g && !g.destroyed) {
        g.da = false;
        g.walkTo(stage.W / 2 + 260, ECHO_Y, { tempo: 240 }).then(() => { if (!g.destroyed) g.destroy(); });
      }
      this.after(4, () => this.echoGastKommt());
    });
  }

  // ---------------------------------------------------------------- Seiten-Ablauf

  betreten() {
    if (this.besuche === 1) voice('musik_werkstatt', { nurWenn: () => this.aktiv });
    // Wer während des Vorspielens weggeblättert hat: das Tier wartet wieder auf ein Antippen
    const e = this.echo;
    if (['vor', 'freude', 'zurueck'].includes(e.phase) && e.tier && !e.tier.destroyed) {
      e.lauf++;
      e.phase = 'wartet';
    }
    if (e.phase === 'schluss') {
      e.lauf++;
      e.phase = 'wartet';
      e.runde = 0;
    }
    this._hinweis?.kill();
    this._hinweis = this.after(this.besuche === 1 ? 4.5 : 2.5, () => {
      const b = this.bau;
      if (!this.aktiv || !b) return;
      const satz = { fuellen: 'musik_fuellen', malen: 'musik_bemalen', probieren: 'musik_ausprobieren' }[b.schritt];
      const schritt = b.schritt;
      if (satz) voice(satz, { nurWenn: () => this.aktiv && this.bau === b && b.schritt === schritt });
    });
  }

  verlassen() {
    this._hinweis?.kill();
    this._hinweis = null;
    this.zupfLeiste.loslassen();
  }

  aufraeumen() {
    this.zupfLeiste?.abbauen();
  }

  update(dt, t) {
    const b = this.bau;
    if (b && b.schritt === 'probieren' && b.art === 'rassel' && !b.d.c.destroyed) {
      // die Rassel folgt dem Griff (Finger)
      b.d.c.x = this.griff.x;
      b.d.c.y = this.griff.y + 160;
    }
    if (b && b.art === 'zupf' && !b.d.c.destroyed) {
      b.d.saiten.forEach((s, i) => {
        const w = b.d.schwingen[i];
        s.x = 4 * w * Math.sin(t * 38);   // die Saite zittert kurz und klingt aus
        b.d.schwingen[i] = w * Math.exp(-dt * 4);
      });
    }
    // Das Echo-Tier wiegt sich leicht, solange es wartet
    const g = this.echo.tier;
    if (g && g.da && !g.destroyed) g.rotation = this.echo.phase === 'wartet' ? 0.035 * Math.sin(t * 2) : 0;
  }

  // ---------------------------------------------------------------- Zeige-Hand

  bauHinweise() {
    const b = this.bau;
    if (!b || b.unterwegs) return [];
    const ziel = { x: WERK.x, y: WERK.y - 170 * S };
    switch (b.schritt) {
      case 'fuellen':
      case 'malen':
        return this.vorrat.filter((v) => v.bild).map((v) => v.c).slice(0, 1);
      case 'deckel':
      case 'fell':
      case 'saiten':
        return this.teil.c.visible ? [{ von: this.teil.c, nach: ziel }] : [];
      case 'spannen':
        return [b.d.c];
      case 'probieren':
        if (b.art === 'rassel') return [{ von: this.griff, nach: { x: WERK.x + 200, y: WERK.y - 160 } }];
        if (b.art === 'zupf') {
          return [{ von: this.handPunkt('zupf', WERK.x - 190, WERK.y - 260), nach: { x: WERK.x + 190, y: WERK.y - 260 } }];
        }
        return [b.d.c];
      default:
        return [];
    }
  }

  echoHinweise() {
    const e = this.echo;
    if (e.phase === 'wartet' && e.tier && !e.tier.destroyed) return [e.tier];
    if (e.phase === 'antwort') return [this.glocken[e.folge[e.antwort.length] ?? 0].c];
    return [];
  }

  hinweise() {
    const bau = this.bauHinweise();
    const echo = this.echoHinweise();
    const liste = this.fokus === 'echo' ? [...echo, ...bau] : [...bau, ...echo];
    return liste.length ? liste : this.regal.filter(Boolean).map((d) => d.c).slice(0, 1);
  }

  resize() {}
}
