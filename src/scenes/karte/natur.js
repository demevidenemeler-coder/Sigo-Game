// Kleine lebendige Nebensachen für Start und Karte – mit PIXI.Graphics in weichen runden Formen gezeichnet
// (passende Bilder gibt es in den Paketen nicht): Blümchen, Schmetterling, Vogel.
// Jedes Ding hat eine Methode tick(dt) für seine eigene ruhige Bewegung (von der Szene in update aufgerufen).
// Gezeichnet wird nur beim Anlegen, nie pro Bild.

import { PIXI, rand, pick, clamp } from '../../engine/index.js';

const { Container, Graphics } = PIXI;

export const BLUETEN_FARBEN = [0xff9fb6, 0xffffff, 0xffd36e, 0xc9a7f0, 0x9fd0f5, 0xffb38a];
const FLUEGEL_FARBEN = [
  [0xffb3c8, 0xff8fae], [0xffe08a, 0xffc24f], [0xb9d8ff, 0x86b6f0], [0xd7c0ff, 0xb393ef], [0xffc7a0, 0xff9f6b],
];

// ---------------------------------------------------------------- Blümchen

/**
 * Blümchen mit Stiel, zwei Blättern und fünf runden Blütenblättern. Ursprung = Fuß am Boden.
 * → Container mit .kopf (für Wackeln) und tick(dt) (sanftes Wiegen)
 */
export function blume(farbe = pick(BLUETEN_FARBEN), groesse = 1) {
  const c = new Container({ label: 'blume' });
  const schatten = new Graphics().ellipse(0, 2, 26, 8).fill({ color: 0x2f5a1c, alpha: 0.18 });
  const stiel = new Graphics()
    .moveTo(0, 0).quadraticCurveTo(5, -24, 0, -50)
    .stroke({ width: 7, color: 0x5f9f3c, cap: 'round' });
  const blattL = new Graphics().ellipse(0, 0, 15, 7).fill(0x77b84d);
  blattL.position.set(-11, -18);
  blattL.rotation = 0.5;
  const blattR = new Graphics().ellipse(0, 0, 13, 6).fill(0x6aae44);
  blattR.position.set(11, -28);
  blattR.rotation = -0.5;
  const kopf = new Container();
  kopf.position.set(0, -54);
  const blueten = new Graphics();
  const saum = farbe === 0xffffff ? 0xe2dccf : dunkler(farbe, 0.85);
  for (let i = 0; i < 5; i++) {
    const w = -Math.PI / 2 + (i * Math.PI * 2) / 5;
    blueten.circle(Math.cos(w) * 13, Math.sin(w) * 13, 11.5).fill(farbe).stroke({ width: 2, color: saum });
  }
  blueten.circle(0, 0, 9).fill(0xffd45e).stroke({ width: 2, color: 0xe7a93a });
  blueten.circle(-3, -3, 3.2).fill({ color: 0xffffff, alpha: 0.7 });
  kopf.addChild(blueten);
  c.addChild(schatten, stiel, blattL, blattR, kopf);
  c.scale.set(groesse);
  c.kopf = kopf;
  c.eventMode = 'none';
  const phase = Math.random() * 10;
  let t = 0;
  c.tick = (dt) => {
    t += dt;
    kopf.rotation = Math.sin(t * 1.3 + phase) * 0.08;
    kopf.x = Math.sin(t * 1.3 + phase) * 2;
  };
  return c;
}

function dunkler(farbe, f) {
  const r = Math.round(((farbe >> 16) & 255) * f);
  const g = Math.round(((farbe >> 8) & 255) * f);
  const b = Math.round((farbe & 255) * f);
  return (r << 16) | (g << 8) | b;
}

// ---------------------------------------------------------------- Schmetterling

function heller(farbe, f) {
  const r = (farbe >> 16) & 255;
  const g = (farbe >> 8) & 255;
  const b = farbe & 255;
  return (Math.round(r + (255 - r) * f) << 16) | (Math.round(g + (255 - g) * f) << 8) | Math.round(b + (255 - b) * f);
}

// Weich modellierte Ellipse im Knete-Stil (Licht von oben links): dunklere Schattenseite unten rechts mit
// kräftigerer Kontur, darauf die Grundfarbe leicht nach oben links versetzt, oben links ein matter Glanzfleck.
function knete(g, x, y, rx, ry, farbe, { kontur = true, glanz = 0.4 } = {}) {
  const schatten = dunkler(farbe, 0.78);
  g.ellipse(x, y, rx, ry).fill(schatten);
  if (kontur) g.ellipse(x, y, rx, ry).stroke({ width: 2.5, color: dunkler(farbe, 0.6), alpha: 0.9 });
  g.ellipse(x - rx * 0.08, y - ry * 0.12, rx * 0.88, ry * 0.84).fill(farbe);
  if (glanz > 0) {
    g.ellipse(x - rx * 0.35, y - ry * 0.42, rx * 0.34, ry * 0.22).fill({ color: heller(farbe, 0.7), alpha: glanz });
  }
  return g;
}

function fluegel(farben, seite) {
  const f = new Graphics();
  // unterer kleiner und oberer großer Flügel, nach außen (seite = -1 links, +1 rechts), weich modelliert
  knete(f, seite * 13, 10, 12.5, 10.5, farben[1], { glanz: 0.3 });
  knete(f, seite * 17, -9, 18.5, 15.5, farben[0], { glanz: 0.45 });
  // Tupfen auf dem Flügel (rund, wie aufgesetzte Knete)
  f.circle(seite * 22, -12, 5).fill({ color: 0xffffff, alpha: 0.8 });
  f.circle(seite * 22.8, -13, 2).fill({ color: 0xffffff, alpha: 0.9 });
  f.circle(seite * 15, 12, 3.2).fill({ color: heller(farben[1], 0.55), alpha: 0.9 });
  return f;
}

/**
 * Schmetterling (etwa 75 breit). Flattert mit ruhigem Flügelschlag; tick(dt) bewegt ihn langsam zu seinem
 * Ziel (ziel = {x, y}); ist er dort, sucht er sich ein neues in seinem Bereich (bereich = {x0, x1, y0, y1}).
 * einblenden = Sekunden, in denen er weich sichtbar wird (taucht nie plötzlich auf).
 */
export class Schmetterling extends Container {
  constructor({ x = 0, y = 0, bereich = null, tempo = 70, einblenden = 0 } = {}) {
    super({ label: 'schmetterling' });
    const farben = pick(FLUEGEL_FARBEN);
    this.links = fluegel(farben, -1);
    this.rechts = fluegel(farben, 1);
    const braun = 0x6b4a3a;
    const koerper = new Graphics()
      // Fühler mit runden Knöpfchen
      .moveTo(-2, -16).quadraticCurveTo(-6, -27, -11, -29).stroke({ width: 2.2, color: braun, cap: 'round' })
      .moveTo(2, -16).quadraticCurveTo(6, -27, 11, -29).stroke({ width: 2.2, color: braun, cap: 'round' })
      .circle(-11, -29, 2.8).fill(braun)
      .circle(11, -29, 2.8).fill(braun);
    knete(koerper, 0, 4, 5.5, 14, 0x8a6250, { glanz: 0.35 });
    knete(koerper, 0, -13, 7.5, 7, 0x8a6250, { glanz: 0.45 });
    koerper.circle(-2.6, -13.5, 1.6).fill(0x2b1d18).circle(2.6, -13.5, 1.6).fill(0x2b1d18);
    this.flug = new Container();
    this.flug.addChild(this.links, this.rechts, koerper);
    this.addChild(this.flug);
    this.position.set(x, y);
    this.bereich = bereich;
    this.tempo = tempo;
    this.ziel = bereich ? this._neuesZiel() : null;
    this._t = Math.random() * 10;
    this._vx = 0;
    this._vy = 0;
    this._alter = 0;
    this.einblenden = einblenden;
    this.alpha = einblenden > 0 ? 0 : 1;
    this.weg = false;      // fliegt davon (verblasst)
  }

  /** nach dem Davonfliegen wieder hereinkommen: von (x, y) aus, weich eingeblendet, zurück in seinen Bereich */
  kommZurueck(x, y, einblenden = 0.6) {
    this.weg = false;
    this._fertig = null;
    this._alter = 0;
    this.einblenden = einblenden;
    this.alpha = 0;
    this.rotation = 0;
    this._vx = 0;
    this._vy = 0;
    this.position.set(x, y);
    if (this.bereich) this.ziel = this._neuesZiel();
  }

  _neuesZiel() {
    const b = this.bereich;
    return { x: rand(b.x0, b.x1), y: rand(b.y0, b.y1) };
  }

  /** davonfliegen: steigt in einem Bogen auf und verblasst; fertig() wird danach gerufen */
  fliegWeg(richtung = Math.random() < 0.5 ? -1 : 1, fertig = null) {
    this.weg = true;
    this._wegRichtung = richtung;
    this._wegZeit = 0;
    this._fertig = fertig;
  }

  tick(dt) {
    this._t += dt;
    this._alter += dt;
    const ein = this.einblenden > 0 ? clamp(this._alter / this.einblenden, 0, 1) : 1;
    // Flügelschlag: ruhig, etwa 3 Schläge pro Sekunde
    const schlag = 0.3 + 0.7 * Math.abs(Math.cos(this._t * Math.PI * 3));
    this.links.scale.x = schlag;
    this.rechts.scale.x = schlag;
    this.flug.y = Math.sin(this._t * 2.2) * 6;

    if (this.weg) {
      this._wegZeit += dt;
      this.x += this._wegRichtung * 90 * dt;
      this.y -= 80 * dt;
      this.rotation = this._wegRichtung * 0.15;
      this.alpha = ein * clamp(1 - (this._wegZeit - 1.6) / 1.2, 0, 1);
      if (this.alpha <= 0 && this._fertig) {
        const f = this._fertig;
        this._fertig = null;
        f(this);
      }
      return;
    }
    this.alpha = ein;
    if (!this.ziel) return;
    const dx = this.ziel.x - this.x;
    const dy = this.ziel.y - this.y;
    const d = Math.hypot(dx, dy);
    if (d < 20) {
      this.ziel = this._neuesZiel();
      return;
    }
    // weich zum Ziel lenken (kein Zickzack)
    const k = 1 - Math.exp(-dt * 1.5);
    this._vx += ((dx / d) * this.tempo - this._vx) * k;
    this._vy += ((dy / d) * this.tempo - this._vy) * k;
    this.x += this._vx * dt;
    this.y += this._vy * dt;
    this.rotation = clamp(this._vx / 400, -0.2, 0.2);
  }
}

// ---------------------------------------------------------------- Vogel

/**
 * Kleiner runder Vogel (etwa 110 lang), schaut nach rechts; flip über scale.x der .figur.
 * tick(dt) lässt die Flügel ruhig schlagen.
 */
export class Vogel extends Container {
  constructor({ farbe = 0x7fb6e6, bauch = 0xfff1d6 } = {}) {
    super({ label: 'vogel' });
    this.figur = new Container();
    // Schwanz: drei runde Federn als kleiner Fächer
    const schwanz = new Graphics();
    for (const [dy, w] of [[-9, -0.35], [0, 0], [9, 0.35]]) {
      const f = new Graphics();
      knete(f, 0, 0, 15, 7, dunkler(farbe, 0.88), { glanz: 0.25 });
      f.position.set(-40, dy * 0.6 - 2);
      f.rotation = w + 0.15;
      schwanz.addChild(f);
    }
    // Körper rund wie ein Knetball, Bauch heller, großer runder Kopf mit Auge, Bäckchen und Schnabel
    const koerper = new Graphics();
    knete(koerper, 0, 2, 37, 27, farbe, { glanz: 0.4 });
    koerper.ellipse(8, 11, 22, 13).fill(bauch);
    koerper.ellipse(5, 8, 15, 6).fill({ color: 0xffffff, alpha: 0.35 });
    knete(koerper, 27, -15, 22, 21, farbe, { glanz: 0.5 });
    koerper
      .ellipse(34, -18, 6.2, 7).fill(0x2b1d18)
      .circle(36, -21, 2.4).fill(0xffffff)
      .circle(32.5, -15.5, 1.1).fill({ color: 0xffffff, alpha: 0.8 })
      .ellipse(31, -6, 6, 4).fill({ color: 0xff8a9c, alpha: 0.6 });
    // Schnabel: rund, zweiteilig
    koerper
      .poly([45, -20, 57, -14, 45, -9]).fill(0xe8892e).stroke({ width: 4, color: 0xe8892e, join: 'round' })
      .poly([46, -18.5, 54, -15, 46, -13]).fill(0xffb25a)
      .ellipse(47.5, -17, 2.5, 1.2).fill({ color: 0xffffff, alpha: 0.5 });
    this.fluegel = new Graphics();
    knete(this.fluegel, -6, -12, 22, 12.5, dunkler(farbe, 0.92), { glanz: 0.35 });
    this.fluegel.pivot.set(-4, -4);
    this.fluegel.position.set(-4, -4);
    this.figur.addChild(schwanz, koerper, this.fluegel);
    // weicher Schatten weit unten (Vogel fliegt über die Wiese)
    this.schatten = new Graphics().ellipse(0, 0, 30, 9).fill({ color: 0x2f4a1c, alpha: 0.12 });
    this.schatten.y = 120;
    this.addChild(this.schatten, this.figur);
    this._t = Math.random() * 10;
  }

  set blickLinks(an) {
    this.figur.scale.x = an ? -1 : 1;
  }

  tick(dt) {
    this._t += dt;
    // ruhiger Flügelschlag (2,2 pro Sekunde) mit kleinem Auf und Ab des Körpers
    const w = Math.sin(this._t * Math.PI * 2 * 2.2);
    this.fluegel.scale.y = w;
    this.figur.y = -w * 4;
  }
}

// ---------------------------------------------------------------- weiche Maske

let maskeTex = null;
/** Weiches Rechteck (weiß, Rand verläuft) als Maske für ausgeschnittene Bildteile. Einmal pro Modul. */
export function weicheMaskeTextur() {
  if (maskeTex) return maskeTex;
  const G = 256;
  const c = document.createElement('canvas');
  c.width = G;
  c.height = G;
  const g = c.getContext('2d');
  g.filter = 'blur(14px)';
  g.fillStyle = '#ffffff';
  g.beginPath();
  g.roundRect(30, 30, G - 60, G - 60, 50);
  g.fill();
  maskeTex = PIXI.Texture.from(c);
  return maskeTex;
}

let leuchtTex = null;
/** Weicher, warmer Lichtschein (radial), z. B. hinter der Sonne. Einmal pro Modul. */
export function leuchtTextur() {
  if (leuchtTex) return leuchtTex;
  const G = 256;
  const c = document.createElement('canvas');
  c.width = G;
  c.height = G;
  const g = c.getContext('2d');
  const v = g.createRadialGradient(G / 2, G / 2, 0, G / 2, G / 2, G / 2);
  v.addColorStop(0, 'rgba(255,244,190,0.9)');
  v.addColorStop(0.45, 'rgba(255,232,150,0.45)');
  v.addColorStop(1, 'rgba(255,225,140,0)');
  g.fillStyle = v;
  g.fillRect(0, 0, G, G);
  leuchtTex = PIXI.Texture.from(c);
  return leuchtTex;
}
