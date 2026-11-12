// Gezeichnete Kleinigkeiten und Bausteine für den Musik-Ort (weiche runde Formen im Knete-Stil):
// Schmetterling, Vogel, Entchen (auf dem Notenblatt), Xylophon aus Rahmen + eingefärbten Stäben.
// Alles mit PIXI.Graphics bzw. vorhandenen Bildern – keine eigenen Texturen (nichts bleibt im Speicher hängen).

import { spr, PIXI } from '../../engine/index.js';

// Regenbogen für die 8 Stäbe/Tasten (weich, nicht grell) – von rot (tief) bis rosa (hoch)
export const REGENBOGEN = [0xff6f61, 0xffa24a, 0xffd54a, 0x8fd65a, 0x45c9b5, 0x55a8f0, 0x9a84ee, 0xf28ccf];

// C-Dur von c'' bis c''' (Xylophon) – „Alle meine Entchen" braucht das F
export const XYLO_TOENE = [72, 74, 76, 77, 79, 81, 83, 84];

// ---------------------------------------------------------------- Xylophon

// Lage der beiden Schienen im Rahmenbild (xylo_rahmen 1208×600, Bildpunkte): Mittellinie oben/unten
const schieneOben = (px) => 62 + 0.125 * px;
const schieneUnten = (px) => 578 - 0.103 * px;
const STAB_X0 = 150;     // Mitte des ersten Stabs (Bildpunkte des Rahmens)
const STAB_ABSTAND = 130;
const STAB_BREITE = 116;

/**
 * Xylophon: Rahmen mit 8 eingefärbten Stäben (lang → kurz). Lokale Koordinaten: Mitte des Rahmens = (0, 0),
 * Maße wie das Rahmenbild (1208×600). → { c, staebe: [{c, bild, glanz, x, y, h}], felder, y0, y1 }
 */
export function baueXylophon({ bodenY = null } = {}) {
  const c = new PIXI.Container({ label: 'xylophon' });
  // Mit bodenY (lokale Koordinaten): ein hölzerner Ständer trägt das Xylophon bis auf den Boden
  if (bodenY !== null) c.addChild(xyloStaender(bodenY));
  const rahmen = spr('musik/xylo_rahmen', { anchor: 0.5, parent: c });
  rahmen.label = 'rahmen';

  const staebe = [];
  for (let i = 0; i < 8; i++) {
    const px = STAB_X0 + i * STAB_ABSTAND;
    const oben = schieneOben(px);
    const unten = schieneUnten(px);
    const h = unten - oben + 80;
    const x = px - 604;
    const y = (oben + unten) / 2 - 300;
    const s = new PIXI.Container({ label: 'stab' + i });
    s.position.set(x, y);
    const bild = spr('musik/xylo_stab', { anchor: 0.5, parent: s });
    bild.scale.set(STAB_BREITE / 186, h / 700);
    bild.tint = REGENBOGEN[i];
    // weicher Lichtrand für „spiel mich" (beim Vorspielen), sonst unsichtbar
    const glanz = new PIXI.Graphics()
      .roundRect(-STAB_BREITE / 2 - 16, -h / 2 - 16, STAB_BREITE + 32, h + 32, 46)
      .stroke({ width: 16, color: 0xfff1a8, alpha: 0.95 })
      .roundRect(-STAB_BREITE / 2 + 6, -h / 2 + 6, STAB_BREITE - 12, h - 12, 34)
      .fill({ color: 0xffffff, alpha: 0.35 });
    glanz.alpha = 0;
    s.addChild(glanz);
    c.addChild(s);
    staebe.push({ c: s, bild, glanz, x, y, h, licht: 0, ziel: 0 });
  }
  // Felder: Grenzen in der Mitte zwischen zwei Stäben
  const felder = staebe.map((st, i) => ({
    x0: i === 0 ? st.x - STAB_ABSTAND / 2 : (staebe[i - 1].x + st.x) / 2,
    x1: i === 7 ? st.x + STAB_ABSTAND / 2 : (st.x + staebe[i + 1].x) / 2,
  }));
  return { c, staebe, felder, y0: -300, y1: 300 };
}

// Ständer unter dem Rahmen: zwei runde Holzbeine (links unter dem langen, rechts unter dem kurzen Ende),
// eine Querstrebe und ein weicher Schatten auf dem Boden. Farben wie der Rahmen.
function xyloStaender(boden) {
  const g = new PIXI.Graphics();
  const holz = 0xeaa448;
  const kante = 0xc27a2c;
  g.ellipse(0, boden + 4, 640, 30).fill({ color: 0x6a3d16, alpha: 0.16 });
  g.ellipse(0, boden + 2, 560, 18).fill({ color: 0x6a3d16, alpha: 0.12 });
  // Querstrebe
  g.roundRect(-515, boden - 78, 1040, 34, 17).fill(0xdc9640).stroke({ width: 5, color: kante });
  // Beine (oben im Rahmen versteckt)
  for (const [x, oben] of [[-509, 220], [526, 150]]) {
    g.roundRect(x - 30, oben, 60, boden - oben, 28).fill(holz).stroke({ width: 5, color: kante });
    g.roundRect(x - 18, oben + 10, 14, boden - oben - 30, 7).fill({ color: 0xffffff, alpha: 0.22 });
    // Füßchen
    g.ellipse(x, boden - 6, 52, 18).fill(0xd98e3a).stroke({ width: 5, color: kante });
  }
  return g;
}

/** Kleines Xylophon als Knopf-Bild */
export function xylophonIcon() {
  return baueXylophon().c;
}

// ---------------------------------------------------------------- Klavier (gezeichneter Körper)

/**
 * Klavier-Körper im Stil von musik/klavier_klein (rot, gelber runder Deckel, gelbe Beine, Blumen) für 8 Tasten
 * der Breite tb mit Abstand ta. Plastisch wie Knete: Licht von oben links (hellere Oberkante, runder Lichtfleck),
 * dunklere Unterkante, zwei Seitenwangen mit Tiefe, eingelassenes Tastenbett. Nur Graphics mit gestaffelten,
 * halbdurchsichtigen Formen (keine Verlaufs-Texturen, nichts bleibt im Speicher).
 * Lokale Koordinaten: Mitte oben der Tasten = (0, 0); Tasten reichen bis y = th.
 */
export function klavierKoerper(tb, ta, th, boden = th + 130) {
  const breite = 8 * tb + 7 * ta;
  const g = new PIXI.Graphics();
  const ROT = 0xe0524a;
  const ROT_HELL = 0xf47466;
  const ROT_DUNKEL = 0xa8372f;
  const KANTE = 0xb33f38;
  const GELB = 0xffc845;
  const GELB_DUNKEL = 0xe09a2c;
  const l = -breite / 2 - 44;        // linke Außenkante des Körpers
  const b = breite + 88;
  const oben = -150;
  const unten = th + 60;
  const h = unten - oben;

  // Schatten am Boden (weich, zwei Lagen)
  g.ellipse(0, boden + 4, b * 0.52, 36).fill({ color: 0x5a3a1a, alpha: 0.14 });
  g.ellipse(0, boden + 2, b * 0.44, 22).fill({ color: 0x5a3a1a, alpha: 0.12 });

  // Beine: gelbe runde Säulen (Licht links, Schatten rechts) mit roten Füßchen
  for (const x of [l + 130, l + b - 130]) {
    const y0 = unten - 20;
    const lang = boden - y0;
    g.roundRect(x - 38, y0, 76, lang, 36).fill(GELB);
    g.roundRect(x + 6, y0 + 10, 26, lang - 34, 13).fill({ color: GELB_DUNKEL, alpha: 0.45 });
    g.roundRect(x - 26, y0 + 14, 16, lang - 50, 8).fill({ color: 0xffffff, alpha: 0.32 });
    g.roundRect(x - 38, y0, 76, lang, 36).stroke({ width: 5, color: 0xd99a2b });
    // Schatten des Körpers oben am Bein
    g.roundRect(x - 36, y0 + 2, 72, 30, 14).fill({ color: 0x8a4a10, alpha: 0.22 });
    // Füßchen
    g.ellipse(x, boden - 10, 58, 24).fill(0xe8604f);
    g.ellipse(x + 10, boden - 4, 44, 14).fill({ color: ROT_DUNKEL, alpha: 0.35 });
    g.ellipse(x - 18, boden - 20, 20, 8).fill({ color: 0xffffff, alpha: 0.35 });
    g.ellipse(x, boden - 10, 58, 24).stroke({ width: 4, color: KANTE });
  }

  // Körper: Grundfarbe, darüber hellere Oberhälfte, dunklere Unterkante – wirkt rund statt flach
  g.roundRect(l, oben, b, h, 64).fill(ROT);
  g.roundRect(l + 10, oben + 8, b - 20, h * 0.55, 56).fill({ color: ROT_HELL, alpha: 0.5 });
  g.roundRect(l + 22, oben + 16, b - 44, h * 0.28, 44).fill({ color: ROT_HELL, alpha: 0.45 });
  g.roundRect(l + 6, unten - 110, b - 12, 104, 50).fill({ color: ROT_DUNKEL, alpha: 0.28 });
  g.roundRect(l + 6, unten - 56, b - 12, 50, 25).fill({ color: ROT_DUNKEL, alpha: 0.3 });
  // runder Lichtfleck oben links (gestaffelt = weicher Rand)
  for (let k = 0; k < 4; k++) {
    g.ellipse(l + 230, oben + 70, 190 - k * 42, 46 - k * 9).fill({ color: 0xffffff, alpha: 0.07 + k * 0.03 });
  }
  g.roundRect(l, oben, b, h, 64).stroke({ width: 6, color: KANTE });


  // Tastenbett: eingelassen, oben tiefer Schatten, unten eine helle Lippe
  const tl = -breite / 2 - 18;
  const tw = breite + 36;
  g.roundRect(tl, -22, tw, th + 44, 28).fill(0x7e322d);
  g.roundRect(tl + 4, -18, tw - 8, 44, 22).fill({ color: 0x4e1d1a, alpha: 0.5 });
  g.roundRect(tl + 4, -18, tw - 8, 22, 11).fill({ color: 0x4e1d1a, alpha: 0.35 });
  g.roundRect(tl + 10, th + 14, tw - 20, 10, 5).fill({ color: 0xffb3a6, alpha: 0.35 });

  // Seitenwangen: rahmen das Tastenbett links und rechts ein, die linke im Licht, die rechte im Schatten
  const wange = (x, hell) => {
    g.roundRect(x - 26, oben + 34, 52, h - 30, 26).fill(hell ? 0xee6457 : 0xc9463e);
    g.roundRect(x + (hell ? 4 : -20), oben + 54, 16, h - 84, 8)
      .fill({ color: hell ? ROT_DUNKEL : 0x8e2c26, alpha: hell ? 0.2 : 0.3 });
    g.roundRect(x - (hell ? 16 : 12), oben + 52, 11, h - 120, 5).fill({ color: 0xffffff, alpha: hell ? 0.34 : 0.14 });
    g.roundRect(x - 26, oben + 34, 52, h - 30, 26).stroke({ width: 4, color: KANTE });
  };
  wange(l + 22, true);
  wange(l + b - 22, false);

  // kleine Blumen auf der Vorderkante unter den Tasten (wie beim kleinen Spielzeugklavier)
  for (const f of [-0.3, 0, 0.3]) blume(g, f * breite, th + 40, 0.38);

  // Schatten des Deckels auf dem Körper
  g.roundRect(l + 8, oben + 42, b - 16, 30, 15).fill({ color: 0x7a2420, alpha: 0.28 });
  // Deckel: runder gelber Wulst – Oberseite hell, Unterseite dunkler, Glanzstreifen links
  const dl = l - 26;
  const db = b + 52;
  g.roundRect(dl, -200, db, 96, 48).fill(GELB);
  g.roundRect(dl + 6, -150, db - 12, 44, 22).fill({ color: GELB_DUNKEL, alpha: 0.42 });
  g.roundRect(dl + 14, -194, db - 28, 40, 20).fill({ color: 0xffe08a, alpha: 0.55 });
  g.roundRect(dl + 40, -188, db * 0.42, 18, 9).fill({ color: 0xffffff, alpha: 0.42 });
  g.roundRect(dl, -200, db, 96, 48).stroke({ width: 6, color: 0xd99a2b });
  // Blume mit Blättern in der Mitte des Deckels
  g.ellipse(-70, -148, 34, 15).fill(0x6cc25a);
  g.ellipse(70, -148, 34, 15).fill(0x6cc25a);
  g.ellipse(-76, -152, 16, 5).fill({ color: 0xffffff, alpha: 0.3 });
  g.ellipse(64, -152, 16, 5).fill({ color: 0xffffff, alpha: 0.3 });
  blume(g, 0, -152, 1);
  return g;
}

// Kleine weiße Blume (5 Blätter, orange Mitte, Lichtpunkt), Größe s = 1 ≈ 90 breit
function blume(g, x, y, s) {
  for (let k = 0; k < 5; k++) {
    const w = (k / 5) * Math.PI * 2 - Math.PI / 2;
    g.circle(x + Math.cos(w) * 26 * s, y + Math.sin(w) * 26 * s, 19 * s).fill(0xfffaf0);
  }
  g.circle(x + 6 * s, y + 6 * s, 15 * s).fill({ color: 0xd9c9b0, alpha: 0.35 });
  g.circle(x, y, 15 * s).fill(0xffa83b);
  g.circle(x - 5 * s, y - 5 * s, 5 * s).fill({ color: 0xffffff, alpha: 0.6 });
}

// ---------------------------------------------------------------- Schmetterling

/** Schmetterling (≈ 120 breit). → { c, links, rechts } – Flügel über scale.x der Hälften schlagen lassen */
export function schmetterling(farbe = 0xffa94d, innen = 0xffe08a) {
  const c = new PIXI.Container({ label: 'schmetterling' });
  const fluegel = (seite) => {
    const f = new PIXI.Container();
    const g = new PIXI.Graphics();
    g.ellipse(seite * 30, -18, 32, 28).fill(farbe).stroke({ width: 4, color: 0xd9783a });
    g.ellipse(seite * 24, 20, 22, 20).fill(farbe).stroke({ width: 4, color: 0xd9783a });
    g.circle(seite * 34, -20, 11).fill(innen);
    g.circle(seite * 24, 20, 7).fill(innen);
    g.circle(seite * 22, -30, 6).fill({ color: 0xffffff, alpha: 0.5 });
    f.addChild(g);
    return f;
  };
  const links = fluegel(-1);
  const rechts = fluegel(1);
  const koerper = new PIXI.Graphics()
    .roundRect(-6, -30, 12, 62, 6).fill(0x6b4a3a)
    .circle(0, -34, 9).fill(0x6b4a3a)
    .moveTo(-3, -40).quadraticCurveTo(-12, -58, -18, -60).stroke({ width: 3, color: 0x6b4a3a, cap: 'round' })
    .moveTo(3, -40).quadraticCurveTo(12, -58, 18, -60).stroke({ width: 3, color: 0x6b4a3a, cap: 'round' });
  c.addChild(links, rechts, koerper);
  return { c, links, rechts };
}

// ---------------------------------------------------------------- Vogel

/** Kleiner runder Vogel (≈ 150 breit, Füße bei y=0, schaut nach rechts). → { c, koerper, auge, schnabel } */
export function vogel() {
  const c = new PIXI.Container({ label: 'vogel' });
  const koerper = new PIXI.Container();
  koerper.y = -6;
  const g = new PIXI.Graphics();
  // Schwanz
  g.roundPoly(-62, -46, 26, 3, 10, Math.PI).fill(0x4f97cc);
  // Körper und Bauch
  g.ellipse(0, -52, 62, 52).fill(0x6fb7e8).stroke({ width: 5, color: 0x4f8fc0 });
  g.ellipse(12, -38, 40, 32).fill(0xfff1d6);
  // Flügel
  g.ellipse(-14, -54, 30, 20).fill(0x4f97cc);
  // Kopf-Glanz
  g.ellipse(-14, -86, 18, 8).fill({ color: 0xffffff, alpha: 0.35 });
  // Bäckchen
  g.circle(34, -60, 9).fill({ color: 0xff8fa0, alpha: 0.8 });
  koerper.addChild(g);
  const schnabel = new PIXI.Graphics()
    .moveTo(0, -9).quadraticCurveTo(26, -2, 0, 9).closePath().fill(0xffa53a).stroke({ width: 3, color: 0xe08a2a });
  schnabel.position.set(56, -70);
  const auge = new PIXI.Graphics().circle(0, 0, 9).fill(0x2b2230).circle(-3, -3, 3.2).fill(0xffffff);
  auge.position.set(30, -80);
  koerper.addChild(schnabel, auge);
  const fuesse = new PIXI.Graphics()
    .moveTo(-10, -8).lineTo(-12, 2).stroke({ width: 5, color: 0xffa53a, cap: 'round' })
    .moveTo(10, -8).lineTo(12, 2).stroke({ width: 5, color: 0xffa53a, cap: 'round' });
  c.addChild(fuesse, koerper);
  return { c, koerper, auge, schnabel };
}

// ---------------------------------------------------------------- Entchen (Bild auf dem Notenblatt)

/** Kleines gelbes Entchen mit drei Notenköpfen (≈ 120 breit) */
export function entchenBild() {
  const g = new PIXI.Graphics();
  // Wasserlinie
  g.roundRect(-62, 22, 124, 10, 5).fill({ color: 0x7cc6ee, alpha: 0.9 });
  // Körper
  g.ellipse(0, 8, 40, 22).fill(0xffd43b).stroke({ width: 3, color: 0xe2a92a });
  g.ellipse(-30, 0, 14, 10).fill(0xffd43b); // Schwänzchen
  // Kopf
  g.circle(22, -20, 17).fill(0xffd43b).stroke({ width: 3, color: 0xe2a92a });
  g.ellipse(41, -16, 11, 6).fill(0xff9a3a);
  g.circle(26, -24, 3.5).fill(0x2b2230);
  // Flügel
  g.ellipse(-4, 6, 16, 9).fill(0xffe78a);
  // Notenköpfe darüber
  const noten = [[-48, -40, 0xff6f61], [-28, -58, 0x45c9b5], [-6, -48, 0x9a84ee]];
  for (const [x, y, f] of noten) {
    g.ellipse(x, y, 8, 6).fill(f);
    g.moveTo(x + 7, y).lineTo(x + 7, y - 22).stroke({ width: 3, color: f });
  }
  return g;
}

// ---------------------------------------------------------------- Lichtpfütze auf dem Bühnenboden

/** Warmer Lichtfleck (4 Ringe, innen am hellsten); alpha = Deckkraft je Ring */
export function lichtPfuetze(rx = 170, ry = 42, alpha = 0.16) {
  const g = new PIXI.Graphics();
  for (let k = 0; k < 4; k++) {
    const f = 1 - k * 0.22;
    g.ellipse(0, 0, rx * f, ry * f).fill({ color: 0xffe7a0, alpha });
  }
  return g;
}
