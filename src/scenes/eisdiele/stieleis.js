// Eis am Stiel und seine Form – gezeichnet (weiche, runde Formen), damit Farbe, Schokolade und Streusel sich frei
// zusammensetzen lassen. Dazu das Partyhütchen, die Kerze und das Geburtstagslied (für Geburtstags-Gäste).

import { PIXI, note, rand, pick } from '../../engine/index.js';
import { mische } from './deko.js';

const B = 60;            // halbe Breite des Eis-Körpers
export const EIS_H = 210;  // Höhe des Eis-Körpers
export const STIEL_L = 110;
const STREUSEL_FARBEN = [0xff8fb1, 0x8fd6ff, 0xffe066, 0x9fe39a, 0xc9a8ff, 0xffffff];

/** Umriss eines Eis-Körpers: unten leicht gerundet, oben ganz rund. Ursprung = Mitte der Unterkante. */
function umriss(g, b = B, h = EIS_H) {
  g.moveTo(-b, -24)
    .lineTo(-b, -h + b)
    .arc(0, -h + b, b, Math.PI, 0)
    .lineTo(b, -24)
    .quadraticCurveTo(b, 0, b - 24, 0)
    .lineTo(-b + 24, 0)
    .quadraticCurveTo(-b, 0, -b, -24)
    .closePath();
  return g;
}

/**
 * Eis am Stiel. Ursprung = Mitte der Unterkante des Eis-Körpers; der Stiel ragt nach unten (STIEL_L).
 * farbe = Saftfarbe; .schokoAn(), .streuen(), .stielZeigen(an)
 */
export class Stieleis extends PIXI.Container {
  constructor(farbe) {
    super({ label: 'stieleis', sortableChildren: true });
    this.farbe = farbe;
    this.hatSchoko = false;
    this.hatStreusel = false;

    this.stiel = new PIXI.Graphics();
    this.stiel.roundRect(-13, -30, 26, STIEL_L + 30, 12).fill(0xf0cf95).stroke({ width: 4, color: 0xc99a5c });
    this.stiel.roundRect(-6, -6, 6, STIEL_L - 16, 3).fill({ color: 0xffffff, alpha: 0.35 });
    this.stiel.zIndex = 0;

    this.koerper = umriss(new PIXI.Graphics()).fill(farbe).stroke({ width: 5, color: mische(farbe, 0x5a3a2a, 0.3) });
    this.koerper.zIndex = 1;
    // Glanz (nicht eingefärbt) und ein paar Fruchtstückchen
    this.glanz = new PIXI.Graphics();
    this.glanz.roundRect(-B + 16, -EIS_H + 54, 16, EIS_H - 96, 8).fill({ color: 0xffffff, alpha: 0.38 });
    for (const [x, y] of [[18, -60], [-8, -96], [26, -128], [-20, -40]]) {
      this.glanz.ellipse(x, y, 5, 8).fill({ color: mische(farbe, 0xfff4c0, 0.6), alpha: 0.9 });
    }
    this.glanz.zIndex = 2;

    this.schoko = new PIXI.Graphics();
    const s = this.schoko;
    const b = B + 3;
    s.moveTo(-b, -112).lineTo(-b, -EIS_H + B).arc(0, -EIS_H + B, b, Math.PI, 0).lineTo(b, -112);
    // gewellter Rand mit zwei Nasen
    s.quadraticCurveTo(b - 14, -96, b - 30, -110).quadraticCurveTo(10, -126, -6, -108)
      .quadraticCurveTo(-26, -92, -40, -110).quadraticCurveTo(-56, -122, -b, -112).closePath();
    s.fill(0x7a4628).stroke({ width: 4, color: 0x5a3018 });
    s.roundRect(14, -122, 20, 44, 10).fill(0x7a4628);
    s.roundRect(-34, -118, 18, 30, 9).fill(0x7a4628);
    s.ellipse(-26, -EIS_H + 44, 14, 24).fill({ color: 0xffffff, alpha: 0.28 });
    s.zIndex = 3;
    s.visible = false;

    this.streusel = new PIXI.Container();
    this.streusel.zIndex = 4;
    this.streusel.visible = false;

    // Körper samt Schokolade/Streusel in einem Teil – beim Abbeißen wird es von oben her kürzer (scale.y)
    this.oben = new PIXI.Container({ sortableChildren: true });
    this.oben.zIndex = 1;
    this.oben.addChild(this.koerper, this.glanz, this.schoko, this.streusel);
    this.addChild(this.stiel, this.oben);
    this.eventMode = 'none';
  }

  stielZeigen(an) {
    this.stiel.visible = an;
  }

  schokoAn() {
    this.hatSchoko = true;
    this.schoko.visible = true;
  }

  /** Bunte Streusel auf die obere Hälfte (auf die Schokolade, falls es sie gibt). */
  streuen() {
    if (this.hatStreusel) return;
    this.hatStreusel = true;
    const orte = [[-30, -170], [6, -186], [32, -160], [-12, -150], [24, -134], [-36, -128], [0, -122], [-20, -192], [36, -184]];
    for (const [x, y] of orte) {
      const g = new PIXI.Graphics().roundRect(-9, -3.5, 18, 7, 3.5).fill(pick(STREUSEL_FARBEN));
      g.position.set(x + rand(-4, 4), y + rand(-4, 4));
      g.rotation = rand(-1.4, 1.4);
      this.streusel.addChild(g);
    }
    this.streusel.visible = true;
  }
}

/** Kleines Bild des Wunsches (für die Denkblase): Eis mit/ohne Schokolade und Streusel. */
export function miniStieleis(farbe, schoko, streusel) {
  const e = new Stieleis(farbe);
  if (schoko) e.schokoAn();
  if (streusel) e.streuen();
  return e;
}

/**
 * Die Form für ein Eis am Stiel (halb durchsichtig, man sieht den Saft darin). Ursprung = Standfläche.
 * Der Saft steht kopfüber darin (rundes Ende unten); der Stiel steckt oben heraus.
 */
export class EisForm extends PIXI.Container {
  constructor() {
    super({ label: 'eisform', sortableChildren: true });
    const fuss = new PIXI.Graphics();
    fuss.ellipse(0, 4, 104, 18).fill({ color: 0x5a4630, alpha: 0.15 });
    fuss.roundRect(-98, -18, 196, 24, 12).fill(0x9fd8c0).stroke({ width: 4, color: 0x6db497 });
    fuss.zIndex = 0;
    // Rückwand: die Form selbst (kopfüber), etwas größer als das Eis
    const hinten = new PIXI.Graphics();
    umriss(hinten, 74, 250).fill(0xd8f2e6).stroke({ width: 6, color: 0x7cc0a4 });
    hinten.rotation = Math.PI;
    hinten.position.set(0, -268);
    hinten.zIndex = 1;
    // Saft: wächst von unten nach oben (Hülle mit scale.y), darin das Eis kopfüber
    this.fuell = new PIXI.Container();
    this.fuell.position.set(0, -32);
    this.fuell.zIndex = 2;
    this.fuell.scale.y = 0;
    this.addChild(fuss, hinten, this.fuell);
    // Vorderseite: Glanz
    const vorn = new PIXI.Graphics();
    vorn.roundRect(-52, -226, 14, 150, 7).fill({ color: 0xffffff, alpha: 0.45 });
    vorn.roundRect(-74, -276, 148, 16, 8).fill({ color: 0xffffff, alpha: 0.3 });
    vorn.zIndex = 5;
    this.addChild(vorn);
    this.eis = null;
    this.farbe = null;
    this.frucht = null;
    this.mitStiel = false;
    this.hitArea = new PIXI.Rectangle(-120, -300, 240, 330);
  }

  get leer() {
    return !this.eis;
  }

  /** Saft einfüllen (neues Eis kopfüber, noch ohne Stiel). → das Eis */
  saftRein(farbe, frucht) {
    this.leeren();
    const e = new Stieleis(farbe);
    e.scale.set(0.9);
    e.rotation = Math.PI;
    e.position.set(0, -EIS_H * 0.9);
    e.stielZeigen(false);
    this.fuell.addChild(e);
    this.eis = e;
    this.farbe = farbe;
    this.frucht = frucht;
    this.mitStiel = false;
    return e;
  }

  leeren() {
    if (this.eis && !this.eis.destroyed) this.eis.destroy({ children: true });
    this.eis = null;
    this.farbe = null;
    this.frucht = null;
    this.mitStiel = false;
    this.fuell.scale.y = 0;
  }

  /** Oberkante der Form (für den Stiel), lokal. */
  get oben() {
    return -270;
  }
}

/** Sitz des Partyhütchens je Tier: Verschiebung gegenüber der Bildmitte oben (Bildpunkte des Tierbildes). */
const HUT_SITZ = {
  hase: [95, 230], katze: [0, 60], hund: [0, 40], baer: [-40, 140], fuchs: [40, 160], schwein: [40, 30],
  maus: [50, 160], eichhoernchen: [100, 100], ente: [0, 30], pferd: [90, 60], giraffe: [60, 40],
  huhn: [60, 0], hahn: [80, 20], elefant: [0, 40], kuh: [0, 30], eule: [0, 30],
};

/** Partyhütchen für ein Geburtstags-Tier (hängt in actor.huelle, hüpft mit). → Container */
export function partyHut(seite, a) {
  if (!a || a.destroyed) return null;
  const farbe = pick([0xf4a6b6, 0x9fd8c0, 0xb9c8f2, 0xf7cf7a]);
  const rand2 = mische(farbe, 0x5a3a2a, 0.3);
  const h = new PIXI.Container({ label: 'partyhut' });
  const g = new PIXI.Graphics();
  g.poly([-46, 0, 46, 0, 0, -118]).fill(farbe).stroke({ width: 5, color: rand2, join: 'round' });
  for (const [x, y] of [[-14, -26], [16, -48], [-4, -74], [18, -16]]) g.circle(x, y, 7).fill({ color: 0xffffff, alpha: 0.75 });
  g.roundRect(-52, -10, 104, 16, 8).fill(mische(farbe, 0xffffff, 0.5)).stroke({ width: 3, color: rand2 });
  g.circle(0, -122, 16).fill(0xfff3b0).stroke({ width: 4, color: 0xe8c45a });
  h.addChild(g);
  h.eventMode = 'none';
  // Oberkante des Kopfes: 'kopf' ist bei den Tieren die Bildmitte oben (oft Ohrspitzen oder Luft) – je Tier
  // verschoben (Bildpunkte, am Foto aller Gäste abgelesen), damit das Hütchen auf dem Kopf sitzt, nicht darüber.
  const [dx, dy] = HUT_SITZ[a.tierId] || [0, 0];
  const p = a._bildPunkt('kopf');
  const l = a.huelle.toLocal(a.sprite.toGlobal({ x: p.x + dx, y: p.y + dy + 60 }));
  const k = 0.8 / Math.max(0.2, Math.abs(a.scale.x));
  h.position.set(l.x, l.y);
  h.rotation = 0.18;
  h.scale.set(0.01);
  a.huelle.addChild(h);
  seite.tween(h, { scale: k }, 0.5, { ease: 'backOut' });
  return h;
}

/** Kerze (ruhige Flamme, kein Flackern). Ursprung = Fuß der Kerze. */
export function kerze() {
  const c = new PIXI.Container({ label: 'kerze' });
  const g = new PIXI.Graphics();
  g.roundRect(-9, -70, 18, 72, 7).fill(0xfff4f6).stroke({ width: 3, color: 0xe3a0b2 });
  for (let i = 0; i < 3; i++) g.roundRect(-9, -60 + i * 22, 18, 7, 3).fill(0xf4a6b6);
  g.moveTo(0, -70).lineTo(0, -80).stroke({ width: 3, color: 0x5a4a3a });
  c.addChild(g);
  const flamme = new PIXI.Graphics();
  flamme.ellipse(0, -96, 12, 20).fill(0xffc04a);
  flamme.ellipse(0, -92, 6, 11).fill(0xfff1b0);
  c.addChild(flamme);
  c.flamme = flamme;
  c.eventMode = 'none';
  return c;
}

/** Leises Geburtstagslied (Anfang), weiche Glockentöne – über `seite.after` geplant. → Dauer in s */
export function geburtstagsLied(seite) {
  const toene = [[67, 0], [67, 0.32], [69, 0.62], [67, 1.0], [72, 1.4], [71, 1.8]];
  for (const [m, t] of toene) seite.after(t, () => note('glocke', m, { vol: 0.28 }));
  return 2.4;
}
