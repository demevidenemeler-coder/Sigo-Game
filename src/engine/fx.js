// Ruhige Effekte: Teilchen (Herzen, Sterne, Funkeln …), kleine Bewegungs-Rückmeldungen (pop, wobble, pulse)
// und der Belohnungsstern, der zum Album-Knopf fliegt.
//
// Ruhe-Regeln: Teilchen schweben, steigen oder sinken langsam, blenden weich ein und aus, nichts blitzt,
// keine additive Überstrahlung. Höchstens 40 pro Effekt und 150 gleichzeitig – die Wetter-Teilchen (ambient)
// zählen mit. Wird es eng, blenden die ältesten weich aus; ist gar kein Platz, entstehen keine neuen
// (nie wird ein Teilchen hart weggenommen).
//
// Alle Teilchen hängen an einem gemeinsamen Vorrat (Pool) von Sprites. Beim Szenenwechsel werden sie vor
// dem Aufräumen der Ebenen abgenommen und wiederverwendet.

import { Sprite, Texture } from 'pixi';
import { stage } from './stage.js';
import { hasTex, tex } from './assets.js';
import { tween, killTweensOf, scaleFeedback, restScale, targetValue } from './tween.js';
import { SceneManager } from './scene.js';
import { note } from './audio.js';
import { ui } from './ui.js';
import { wetterAnzahl } from './ambient.js';
import { rand, randInt, pick, clamp } from './util.js';

const MAX_GESAMT = 150;    // Teilchen gleichzeitig, Wetter eingerechnet
const MAX_BURST = 40;
const MAX_RATE = 12;       // Teilchen pro Sekunde für Emitter
const AUSBLENDEN_ALT = 0.35;

// ---------------------------------------------------------------- Texturen

// Erzeugt eine Canvas-Textur der Größe g×g und ruft zeichne(ctx, g) auf.
function leinwand(g, zeichne, h = g) {
  const c = document.createElement('canvas');
  c.width = g;
  c.height = h;
  const ctx = c.getContext('2d');
  zeichne(ctx, g, h);
  return Texture.from(c);
}

// Weicher Glanz oben links (Knete-/Vinyl-Look)
function glanz(ctx, x, y, r, staerke = 0.45) {
  const v = ctx.createRadialGradient(x, y, 0, x, y, r);
  v.addColorStop(0, `rgba(255,255,255,${staerke})`);
  v.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = v;
  ctx.fillRect(x - r, y - r, 2 * r, 2 * r);
}

function herzPfad(ctx, cx, cy, s) {
  ctx.beginPath();
  ctx.moveTo(cx, cy + s * 0.9);
  ctx.bezierCurveTo(cx - s * 1.25, cy + s * 0.05, cx - s * 0.95, cy - s * 0.95, cx, cy - s * 0.35);
  ctx.bezierCurveTo(cx + s * 0.95, cy - s * 0.95, cx + s * 1.25, cy + s * 0.05, cx, cy + s * 0.9);
  ctx.closePath();
}

function sternPfad(ctx, cx, cy, aussen, innen, zacken = 5) {
  ctx.beginPath();
  for (let i = 0; i < zacken * 2; i++) {
    const r = i % 2 ? innen : aussen;
    const w = -Math.PI / 2 + (i * Math.PI) / zacken;
    const x = cx + Math.cos(w) * r;
    const y = cy + Math.sin(w) * r;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

const ERZEUGT = {
  herz: () => leinwand(96, (c, g) => {
    herzPfad(c, g / 2, g / 2 + 2, g * 0.42);
    const v = c.createLinearGradient(0, 0, 0, g);
    v.addColorStop(0, '#ff9aa8');
    v.addColorStop(1, '#e8506a');
    c.fillStyle = v;
    c.fill();
    c.save();
    c.clip();
    glanz(c, g * 0.36, g * 0.32, g * 0.22, 0.6);
    c.restore();
  }),
  stern: () => leinwand(96, (c, g) => {
    c.lineJoin = 'round';
    sternPfad(c, g / 2, g / 2 + 3, g * 0.44, g * 0.2);
    c.lineWidth = g * 0.08;
    c.strokeStyle = '#f4b93c';
    c.stroke();
    const v = c.createLinearGradient(0, 0, 0, g);
    v.addColorStop(0, '#ffe58a');
    v.addColorStop(1, '#f7c443');
    c.fillStyle = v;
    c.fill();
    c.save();
    c.clip();
    glanz(c, g * 0.4, g * 0.36, g * 0.2, 0.55);
    c.restore();
  }),
  funke: () => leinwand(80, (c, g) => {
    // weicher Vierzack mit hellem Kern – ohne harte Kanten
    const m = g / 2;
    const halo = c.createRadialGradient(m, m, 0, m, m, m);
    halo.addColorStop(0, 'rgba(255,250,215,0.9)');
    halo.addColorStop(0.35, 'rgba(255,240,170,0.35)');
    halo.addColorStop(1, 'rgba(255,240,170,0)');
    c.fillStyle = halo;
    c.fillRect(0, 0, g, g);
    c.fillStyle = 'rgba(255,248,205,0.95)';
    c.beginPath();
    c.moveTo(m, m - g * 0.42);
    c.quadraticCurveTo(m + g * 0.07, m - g * 0.07, m + g * 0.42, m);
    c.quadraticCurveTo(m + g * 0.07, m + g * 0.07, m, m + g * 0.42);
    c.quadraticCurveTo(m - g * 0.07, m + g * 0.07, m - g * 0.42, m);
    c.quadraticCurveTo(m - g * 0.07, m - g * 0.07, m, m - g * 0.42);
    c.fill();
  }),
  blase: () => leinwand(96, (c, g) => {
    const m = g / 2;
    const r = g * 0.44;
    const v = c.createRadialGradient(m, m, r * 0.6, m, m, r);
    v.addColorStop(0, 'rgba(200,235,255,0.12)');
    v.addColorStop(0.85, 'rgba(170,215,245,0.45)');
    v.addColorStop(1, 'rgba(150,200,240,0.7)');
    c.fillStyle = v;
    c.beginPath();
    c.arc(m, m, r, 0, Math.PI * 2);
    c.fill();
    glanz(c, m - r * 0.4, m - r * 0.4, r * 0.35, 0.85);
  }),
  tropfen: () => leinwand(64, (c, g) => {
    c.beginPath();
    c.moveTo(g / 2, g * 0.06);
    c.bezierCurveTo(g * 0.62, g * 0.32, g * 0.82, g * 0.5, g * 0.82, g * 0.66);
    c.arc(g / 2, g * 0.66, g * 0.32, 0, Math.PI);
    c.bezierCurveTo(g * 0.18, g * 0.5, g * 0.38, g * 0.32, g / 2, g * 0.06);
    const v = c.createLinearGradient(0, 0, 0, g);
    v.addColorStop(0, '#9fd4f5');
    v.addColorStop(1, '#4fa3df');
    c.fillStyle = v;
    c.fill();
    glanz(c, g * 0.42, g * 0.62, g * 0.14, 0.7);
  }),
  blatt: () => leinwand(80, (c, g) => {
    c.translate(g / 2, g / 2);
    c.rotate(-0.6);
    c.beginPath();
    c.moveTo(0, -g * 0.42);
    c.quadraticCurveTo(g * 0.32, 0, 0, g * 0.42);
    c.quadraticCurveTo(-g * 0.32, 0, 0, -g * 0.42);
    const v = c.createLinearGradient(-g * 0.3, 0, g * 0.3, 0);
    v.addColorStop(0, '#8cc65a');
    v.addColorStop(1, '#5f9f3c');
    c.fillStyle = v;
    c.fill();
    c.strokeStyle = 'rgba(60,110,40,0.55)';
    c.lineWidth = g * 0.035;
    c.beginPath();
    c.moveTo(0, -g * 0.34);
    c.lineTo(0, g * 0.38);
    c.stroke();
  }),
  rauch: () => leinwand(96, (c, g) => {
    const m = g / 2;
    const v = c.createRadialGradient(m, m, 0, m, m, m);
    v.addColorStop(0, 'rgba(255,255,255,0.85)');
    v.addColorStop(0.55, 'rgba(250,250,250,0.55)');
    v.addColorStop(1, 'rgba(245,245,245,0)');
    c.fillStyle = v;
    c.fillRect(0, 0, g, g);
  }),
  staub: () => leinwand(80, (c, g) => {
    const m = g / 2;
    const v = c.createRadialGradient(m, m, 0, m, m, m);
    v.addColorStop(0, 'rgba(226,205,170,0.8)');
    v.addColorStop(0.6, 'rgba(220,198,160,0.45)');
    v.addColorStop(1, 'rgba(215,190,150,0)');
    c.fillStyle = v;
    c.fillRect(0, 0, g, g);
  }),
  note1: () => leinwand(96, (c, g) => {
    c.fillStyle = '#ffffff';
    c.beginPath();
    c.ellipse(g * 0.36, g * 0.74, g * 0.17, g * 0.13, -0.4, 0, Math.PI * 2);
    c.fill();
    c.fillRect(g * 0.47, g * 0.14, g * 0.08, g * 0.62);
    c.beginPath();
    c.moveTo(g * 0.55, g * 0.14);
    c.quadraticCurveTo(g * 0.82, g * 0.24, g * 0.74, g * 0.46);
    c.quadraticCurveTo(g * 0.7, g * 0.32, g * 0.55, g * 0.3);
    c.fill();
  }),
  note2: () => leinwand(96, (c, g) => {
    c.fillStyle = '#ffffff';
    for (const x of [0.28, 0.68]) {
      c.beginPath();
      c.ellipse(g * x, g * 0.76, g * 0.13, g * 0.1, -0.4, 0, Math.PI * 2);
      c.fill();
      c.fillRect(g * (x + 0.07), g * 0.22, g * 0.065, g * 0.55);
    }
    c.beginPath();
    c.moveTo(g * 0.35, g * 0.2);
    c.lineTo(g * 0.82, g * 0.12);
    c.lineTo(g * 0.82, g * 0.24);
    c.lineTo(g * 0.35, g * 0.32);
    c.fill();
  }),
  zzz: () => leinwand(80, (c, g) => {
    c.strokeStyle = '#ffffff';
    c.lineWidth = g * 0.13;
    c.lineJoin = 'round';
    c.lineCap = 'round';
    c.beginPath();
    c.moveTo(g * 0.25, g * 0.25);
    c.lineTo(g * 0.75, g * 0.25);
    c.lineTo(g * 0.25, g * 0.75);
    c.lineTo(g * 0.75, g * 0.75);
    c.stroke();
  }),
  konfetti: () => leinwand(48, (c, g) => {
    c.fillStyle = '#ffffff';
    c.beginPath();
    c.roundRect(g * 0.12, g * 0.28, g * 0.76, g * 0.44, g * 0.12);
    c.fill();
  }),
};

const texturen = new Map(); // name → Texture

// Textur für ein Teilchen: zuerst 'common/p_<name>', sonst selbst erzeugt
function teilchenTextur(name) {
  const echt = 'common/p_' + name;
  if (hasTex(echt)) return tex(echt);
  let t = texturen.get(name);
  if (!t) {
    t = (ERZEUGT[name] || ERZEUGT.funke)();
    texturen.set(name, t);
  }
  return t;
}

// ---------------------------------------------------------------- Arten

const PASTELL = [0xffb3c1, 0xffd59e, 0xfff0a0, 0xb8e3a8, 0xa8d8f0, 0xcdb8f0];
const NOTEN_FARBEN = [0x7a6cc9, 0x4f9bd9, 0xe0708a, 0x5fae74];

// Jede Art: Bereiche [min, max]. v = Geschwindigkeit (Einheiten/s), winkel = Richtung (0 = rechts, -π/2 = oben),
// streu = ± um den Winkel, auftrieb/schwere = Beschleunigung nach oben/unten, bremse = Luftwiderstand (1/s),
// wiegen = seitliches Schweben (Amplitude, Frequenz), groesse = Breite in Einheiten, wachsen = Endgröße (Faktor),
// ein/aus = weiches Ein-/Ausblenden (Anteil der Lebenszeit).
const ARTEN = {
  herzen: {
    tex: ['herz'], count: [7, 10], leben: [1.8, 2.4], ort: 40,
    v: [60, 130], winkel: -Math.PI / 2, streu: 0.9, auftrieb: 70, bremse: 1.4,
    wiegen: [10, 18], wiegenF: [1.6, 2.4], groesse: [70, 100], neigung: 0.3, dreh: 0,
    start: 0.4, wachsen: 1, ein: 0.18, aus: 0.4,
  },
  sterne: {
    tex: ['stern'], count: [8, 11], leben: [1.4, 1.9], ort: 30,
    v: [120, 210], winkel: -Math.PI / 2, streu: Math.PI, auftrieb: 25, bremse: 2.2,
    wiegen: [0, 0], wiegenF: [1, 1], groesse: [55, 85], neigung: 0.4, dreh: 1.2,
    start: 0.3, wachsen: 0.9, ein: 0.15, aus: 0.45,
  },
  funkeln: {
    tex: ['funke'], count: [8, 12], leben: [1.3, 1.8], ort: 120,
    v: [0, 30], winkel: -Math.PI / 2, streu: Math.PI, auftrieb: 15, bremse: 1,
    wiegen: [0, 0], wiegenF: [1, 1], groesse: [55, 95], neigung: 0.5, dreh: 0.8,
    start: 0, wachsen: 0.6, ein: 0.4, aus: 0.5, verzoegerung: 0.35,
  },
  konfetti: {
    tex: ['konfetti'], farben: PASTELL, count: [10, 14], leben: [2.2, 2.8], ort: 50,
    v: [170, 260], winkel: -Math.PI / 2, streu: 0.65, schwere: 170, bremse: 1.4,
    wiegen: [16, 28], wiegenF: [2.2, 3.2], groesse: [40, 55], neigung: Math.PI, dreh: 2.2,
    start: 0.6, wachsen: 1, ein: 0.1, aus: 0.35,
  },
  staub: {
    tex: ['staub'], count: [5, 7], leben: [0.7, 1.0], ort: 20,
    v: [80, 150], winkel: -Math.PI / 2, streu: 0, seitlich: true, auftrieb: 20, bremse: 3,
    wiegen: [0, 0], wiegenF: [1, 1], groesse: [50, 80], neigung: Math.PI, dreh: 0.4,
    start: 0.6, wachsen: 1.6, ein: 0.15, aus: 0.6, alpha: 0.75,
  },
  blasen: {
    tex: ['blase'], count: [8, 11], leben: [1.8, 2.8], ort: 50,
    v: [20, 60], winkel: -Math.PI / 2, streu: 0.8, auftrieb: 45, bremse: 0.8,
    wiegen: [12, 22], wiegenF: [1.4, 2.2], groesse: [40, 80], neigung: 0, dreh: 0,
    start: 0.3, wachsen: 1.15, ein: 0.15, aus: 0.25, alpha: 0.9,
  },
  tropfen: {
    tex: ['tropfen'], count: [8, 12], leben: [0.8, 1.1], ort: 25,
    v: [150, 260], winkel: -Math.PI / 2, streu: 0.8, schwere: 650, bremse: 0.3,
    wiegen: [0, 0], wiegenF: [1, 1], groesse: [24, 36], neigung: 0, dreh: 0,
    start: 0.5, wachsen: 0.8, ein: 0.1, aus: 0.35,
  },
  blaetter: {
    tex: ['blatt'], count: [6, 9], leben: [2.5, 3.2], ort: 40,
    v: [80, 160], winkel: -Math.PI / 2, streu: 1, schwere: 70, bremse: 1.5,
    wiegen: [22, 38], wiegenF: [1.2, 1.8], groesse: [45, 65], neigung: Math.PI, dreh: 1.2,
    start: 0.6, wachsen: 1, ein: 0.12, aus: 0.3,
  },
  rauch: {
    tex: ['rauch'], count: [4, 6], leben: [1.8, 2.4], ort: 20,
    v: [20, 50], winkel: -Math.PI / 2, streu: 0.5, auftrieb: 55, bremse: 0.6,
    wiegen: [6, 12], wiegenF: [0.8, 1.2], groesse: [70, 100], neigung: Math.PI, dreh: 0.3,
    start: 0.5, wachsen: 1.9, ein: 0.2, aus: 0.55, alpha: 0.7,
  },
  noten: {
    tex: ['note1', 'note2'], farben: NOTEN_FARBEN, count: [5, 7], leben: [1.8, 2.4], ort: 40,
    v: [30, 70], winkel: -Math.PI / 2, streu: 0.7, auftrieb: 50, bremse: 0.9,
    wiegen: [12, 22], wiegenF: [1.4, 2], groesse: [55, 75], neigung: 0.25, dreh: 0,
    start: 0.4, wachsen: 1, ein: 0.15, aus: 0.35,
  },
  zzz: {
    tex: ['zzz'], farben: [0xa9b8e8], count: [3, 3], leben: [2.4, 2.6], ort: 5,
    v: [35, 45], winkel: -Math.PI / 3, streu: 0.1, auftrieb: 10, bremse: 0.2,
    wiegen: [8, 12], wiegenF: [1, 1.4], groesse: [40, 50], neigung: 0.2, dreh: 0,
    start: 0.5, wachsen: 1.5, ein: 0.2, aus: 0.4, nacheinander: 0.6,
  },
};

const ALIAS = { herz: 'herzen', stern: 'sterne', funke: 'funkeln', blase: 'blasen', blatt: 'blaetter', note: 'noten' };

function artVon(name) {
  const a = ARTEN[name] || ARTEN[ALIAS[name]];
  if (!a) console.warn(`[sigo] fx: unbekannte Art '${name}' – nehme 'funkeln'.`);
  return a || ARTEN.funkeln;
}

const zwischen = (b) => rand(b[0], b[1]);

// ---------------------------------------------------------------- Teilchen-Vorrat

const lebend = [];   // laufende Teilchen (älteste vorn)
const frei = [];     // freie Sprites
const emitter = new Set();
let tickerAn = false;

function holeSprite() {
  while (frei.length) {
    const s = frei.pop();
    if (!s.destroyed) return s;
  }
  const s = new Sprite(Texture.WHITE);
  s.anchor.set(0.5);
  s.eventMode = 'none';
  return s;
}

function gibZurueck(p) {
  const s = p.s;
  if (s.destroyed) return;
  s.removeFromParent();
  s.visible = true;
  frei.push(s);
}

function standardEbene() {
  const s = SceneManager.current;
  return s && s.alive ? s.front : null;
}

// Wie viele fx-Teilchen dürfen gleichzeitig leben? (150 minus Wetter)
function budget() {
  return Math.max(0, MAX_GESAMT - wetterAnzahl());
}

// Platz für n neue Teilchen schaffen: so viele der ältesten (die noch nicht gehen) weich ausblenden lassen.
// Sie zählen mit, bis sie weg sind – darum entstehen neue erst, wenn wirklich Platz ist.
function machePlatz(n) {
  let zuViel = lebend.length + n - budget();
  for (const p of lebend) {
    if (zuViel <= 0) break;
    if (p.geht) continue;
    p.geht = true;
    p.leben = Math.min(p.leben, p.alter + AUSBLENDEN_ALT);
    p.ausDauer = AUSBLENDEN_ALT;
    zuViel--;
  }
}

// Ein Teilchen der Art anlegen (vorher machePlatz aufrufen). Ergebnis: das Teilchen oder null (kein Platz)
function erzeuge(art, x, y, parent, extra = {}) {
  if (!parent || parent.destroyed) return null;
  if (lebend.length >= budget()) return null;

  const s = holeSprite();
  const name = pick(art.tex);
  s.texture = teilchenTextur(name);
  const groesse = zwischen(art.groesse) * (extra.groesse ?? 1);
  const basis = groesse / Math.max(1, s.texture.width);
  // Nur die selbst erzeugten (weißen) Formen einfärben – echte Bilder haben ihre eigenen Farben
  s.tint = art.farben && !hasTex('common/p_' + name) ? pick(art.farben) : 0xffffff;
  s.alpha = 0;
  s.zIndex = extra.z ?? 1000;
  s.rotation = rand(-art.neigung, art.neigung);

  // Startort (innerhalb eines Kreises) und Startgeschwindigkeit
  const w0 = rand(0, Math.PI * 2);
  const r0 = Math.sqrt(Math.random()) * art.ort;
  let winkel = art.winkel + rand(-art.streu, art.streu);
  if (art.seitlich) winkel = Math.random() < 0.5 ? -Math.PI + rand(0.05, 0.4) : -rand(0.05, 0.4);
  const v = zwischen(art.v);

  const p = {
    s,
    art,
    bx: x + Math.cos(w0) * r0,
    by: y + Math.sin(w0) * r0 * 0.6,
    vx: Math.cos(winkel) * v,
    vy: Math.sin(winkel) * v,
    alter: 0,
    leben: zwischen(art.leben),
    verzoegerung: extra.verzoegerung ?? 0,
    basis,
    dreh: rand(-art.dreh, art.dreh),
    wiegen: zwischen(art.wiegen),
    wiegenF: zwischen(art.wiegenF),
    phase: rand(0, Math.PI * 2),
    alpha: (art.alpha ?? 1) * (extra.alpha ?? 1),
    geht: false,
    ausDauer: 0,
  };
  s.position.set(p.bx, p.by);
  s.scale.set(basis * art.start);
  s.visible = p.verzoegerung <= 0;
  parent.addChild(s);
  lebend.push(p);
  starteTicker();
  return p;
}

function schritt(p, dt) {
  const s = p.s;
  if (p.verzoegerung > 0) {
    p.verzoegerung -= dt;
    if (p.verzoegerung > 0) return true;
    s.visible = true;
  }
  p.alter += dt;
  if (p.alter >= p.leben) return false;
  const a = p.art;
  const k = p.alter / p.leben;

  // Bewegung: Bremse, Auftrieb/Schwere, seitliches Schweben
  const bremse = Math.exp(-a.bremse * dt);
  p.vx *= bremse;
  p.vy *= bremse;
  p.vy += ((a.schwere || 0) - (a.auftrieb || 0)) * dt;
  p.bx += p.vx * dt;
  p.by += p.vy * dt;
  s.x = p.bx + (p.wiegen ? Math.sin(p.phase + p.alter * p.wiegenF * Math.PI * 2) * p.wiegen : 0);
  s.y = p.by;
  s.rotation += p.dreh * dt;

  // Größe: weich von „start" auf 1, dann bis „wachsen"
  const einAnteil = Math.max(0.0001, a.ein);
  const einK = clamp(k / einAnteil, 0, 1);
  const auf = 1 - (1 - einK) * (1 - einK); // quadOut
  const g = a.start + (1 - a.start) * auf;
  const spaet = clamp((k - einAnteil) / (1 - einAnteil), 0, 1);
  s.scale.set(p.basis * g * (1 + (a.wachsen - 1) * spaet));

  // Deckkraft: weich ein, weich aus (beim Ausblenden alter Teilchen eigene kurze Dauer)
  const ausAnteil = p.ausDauer > 0 ? p.ausDauer / p.leben : a.aus;
  const ausK = clamp((1 - k) / Math.max(0.0001, ausAnteil), 0, 1);
  const ein = einK * einK * (3 - 2 * einK);
  const aus = ausK * ausK * (3 - 2 * ausK);
  s.alpha = p.alpha * Math.min(ein, aus);
  return true;
}

function tick(ticker) {
  const dt = Math.min(ticker.deltaMS / 1000, 0.05);

  for (const e of emitter) {
    if (!e.aktiv) { emitter.delete(e); continue; }
    if (!e.parent || e.parent.destroyed) { e.aktiv = false; emitter.delete(e); continue; }
    e.rest -= dt;
    while (e.rest <= 0) {
      e.rest += 1 / e.rate;
      machePlatz(1);
      erzeuge(e.art, e.x, e.y, e.parent, { z: e.z, groesse: e.groesse });
    }
  }

  let j = 0;
  for (let i = 0; i < lebend.length; i++) {
    const p = lebend[i];
    let weiter = false;
    if (!p.s.destroyed && p.s.parent) {
      try { weiter = schritt(p, dt); } catch (e) { console.error('[sigo] fx:', e); }
    }
    if (weiter) lebend[j++] = p;
    else gibZurueck(p);
  }
  lebend.length = j;
}

function starteTicker() {
  if (tickerAn || !stage.app) return;
  tickerAn = true;
  stage.app.ticker.add(tick);
}

// Beim Verlassen einer Szene: Teilchen abnehmen (bevor die Ebenen zerstört werden) und Emitter beenden
let angemeldet = false;
function meldeAn() {
  if (angemeldet) return;
  angemeldet = true;
  SceneManager.onExit(() => {
    for (const p of lebend) gibZurueck(p);
    lebend.length = 0;
    for (const e of emitter) e.aktiv = false;
    emitter.clear();
  });
}
meldeAn();

// ---------------------------------------------------------------- Bewegungs-Rückmeldungen

// Bei Figuren (Actor) wirken pop/wobble/pulse auf die Hülle (unter dem Körper): Hüpfen und Laufen gehen weiter.
const teilVon = (obj) => (obj && (obj.huelle || obj.koerper)) || obj;

// Größen-Rückmeldungen teilen sich die Ruhe-Größe mit squash/drag (tween.js: scaleFeedback).
// Für das Wackeln: laufendes Wackeln und die Drehung, zu der es zurückkehrt
const wackeln = new WeakMap(); // obj → { t: Proxy-Tween, r0 }

/** Kurzes weiches Stauchen und Strecken (Rückmeldung beim Antippen). → Promise<boolean> */
function pop(obj, staerke = 0.12) {
  const o = teilVon(obj);
  if (!o || o.destroyed || !o.scale) return Promise.resolve(false);
  return scaleFeedback(o, [
    [1 + staerke, 1 - staerke * 0.8, 0.09, 'quadOut'],
    [1 - staerke * 0.4, 1 + staerke * 0.5, 0.14, 'sineInOut'],
  ], { rueck: [0.22, 'sineInOut'] });
}

const WACKEL_DAUER = 0.55;
const WACKEL_UEBERGANG = 0.12; // so weich geht ein laufender Ausschlag in ein neues Wackeln über (s)

/** Sanftes Wackeln (0,5 s, klingt aus). → Promise<boolean> */
function wobble(obj, staerke = 0.08) {
  const o = teilVon(obj);
  if (!o || o.destroyed) return Promise.resolve(false);
  // Wackelt es schon: neu ansetzen, aber zur selben Drehung zurück. Sonst: Ziel einer laufenden Drehung.
  const vorher = wackeln.get(o);
  const r0 = vorher ? vorher.r0 : targetValue(o, 'rotation');
  // Der jetzige Ausschlag springt nicht auf null, er klingt in den ersten 0,12 s weich aus (Dauertippen ruckt nicht)
  const rest = vorher && !o.destroyed ? o.rotation - r0 : 0;
  vorher?.t.stop();
  killTweensOf(o, ['rotation']);
  const proxy = { p: 0 };
  const t = tween(proxy, { p: 1 }, WACKEL_DAUER, {
    ease: 'linear',
    onUpdate: () => {
      if (o.destroyed) return;
      const p = proxy.p;
      const u = Math.min(1, (p * WACKEL_DAUER) / WACKEL_UEBERGANG);
      const alt = rest * (1 - u * u * (3 - 2 * u));
      o.rotation = r0 + alt + Math.sin(p * Math.PI * 3) * staerke * (1 - p);
    },
    onComplete: () => {
      if (!o.destroyed) o.rotation = r0;
      wackeln.delete(o);
    },
  });
  // Eine neue Drehung der Szene (tween mit rotation) beendet dieses Wackeln (tween.js)
  t.wackelt = o;
  wackeln.set(o, { t, r0 });
  return t.then((ok) => {
    // von einer anderen Drehung abgelöst: nicht schief stehen lassen
    if (!ok && wackeln.get(o)?.t === t) wackeln.delete(o);
    return ok;
  });
}

/** Langsames Atmen der Größe als Hinweis („hier tippen"). Periode ≥ 1,2 s. → {stop()} */
function pulse(obj, { staerke = 0.06, periode = 1.4 } = {}) {
  const o = teilVon(obj);
  if (!o || o.destroyed || !o.scale) return { stop() {} };
  const halb = Math.max(1.2, periode) / 2;
  const r = restScale(o);
  scaleFeedback(o, [], { halten: true }); // ersetzt eine laufende Rückmeldung, merkt die Ruhe-Größe
  const t = tween(o, { scaleX: r.x * (1 + staerke), scaleY: r.y * (1 + staerke) }, halb, {
    ease: 'sineInOut', yoyo: true, repeat: -1, feedback: true,
  });
  let gestoppt = false;
  return {
    stop() {
      if (gestoppt) return;
      gestoppt = true;
      // Wurde das Atmen inzwischen abgelöst (z. B. Antippen), kehrt die neue Rückmeldung selbst zur Ruhe zurück
      if (t.tot || o.destroyed) return;
      t.stop();
      scaleFeedback(o, [], { rueck: [0.35, 'sineInOut'] });
    },
  };
}

// ---------------------------------------------------------------- burst, emitter

/** Ein paar ruhige Teilchen an einer Stelle: burst('herzen', x, y, {count, parent, z, groesse}). */
function burst(artName, x, y, opt = {}) {
  const art = artVon(artName);
  const parent = opt.parent || standardEbene();
  if (!parent) return 0;
  const anzahl = clamp(Math.round(opt.count ?? randInt(art.count[0], art.count[1])), 0, MAX_BURST);
  machePlatz(anzahl);
  for (let i = 0; i < anzahl; i++) {
    const verz = art.nacheinander ? i * art.nacheinander : art.verzoegerung ? rand(0, art.verzoegerung) : 0;
    erzeuge(art, x, y, parent, { z: opt.z, groesse: opt.groesse, verzoegerung: verz });
  }
  return anzahl;
}

/**
 * Gleichmäßiger Strom: emitter('rauch', {x, y, rate=4, parent, z, groesse}) → {x, y, stop()}.
 * x/y dürfen jederzeit geändert werden (z. B. Schornstein, der mitfährt). rate höchstens 12 pro Sekunde.
 */
function emitterNeu(artName, opt = {}) {
  const e = {
    art: artVon(artName),
    x: opt.x ?? 0,
    y: opt.y ?? 0,
    rate: clamp(opt.rate ?? 4, 0.1, MAX_RATE),
    parent: opt.parent || standardEbene(),
    z: opt.z,
    groesse: opt.groesse,
    rest: 0,
    aktiv: true,
    stop() { e.aktiv = false; emitter.delete(e); },
    /** Ort setzen */
    at(x, y) { e.x = x; e.y = y; return e; },
  };
  if (!e.parent) { e.aktiv = false; return e; }
  emitter.add(e);
  starteTicker();
  return e;
}

// ---------------------------------------------------------------- Belohnungsstern

/**
 * Ein Stern erscheint bei (x, y) – Koordinaten der Szene (world/front), oder von opt.parent – und fliegt
 * in einem ruhigen Bogen zum Album-Knopf oben rechts. Dort zählt ui.albumPlus() weiter. → Promise (bei Ankunft)
 */
function stern(x, y, opt = {}) {
  const szene = SceneManager.current;
  if (!szene || !szene.alive) return Promise.resolve();
  const von = opt.parent || szene.front;
  const start = szene.hud.toLocal(von.toGlobal({ x, y }));
  const ziel = ui.albumPos();

  const s = new Sprite(teilchenTextur('stern'));
  s.anchor.set(0.5);
  s.eventMode = 'none';
  s.zIndex = 9500;
  const basis = 130 / Math.max(1, s.texture.width);
  s.scale.set(0);
  s.position.set(start.x, start.y);
  szene.hud.addChild(s);
  burst('funkeln', start.x, start.y, { parent: szene.hud, count: 5, z: 9400 });
  note('pling', 79, { vol: 0.5 });

  // Bogen: quadratische Kurve mit Kontrollpunkt oberhalb
  const kx = (start.x + ziel.x) / 2 - 150;
  const ky = Math.min(start.y, ziel.y) - 250;
  const proxy = { p: 0 };
  return tween(s, { scale: basis * 1.15 }, 0.35, { ease: 'backOut' })
    .then(() => tween(s, { scale: basis }, 0.2, { ease: 'sineInOut' }))
    .then(() => tween(proxy, { p: 1 }, 1.3, {
      ease: 'sineInOut',
      onUpdate: () => {
        if (s.destroyed) return;
        const p = proxy.p;
        const q = 1 - p;
        s.x = q * q * start.x + 2 * q * p * kx + p * p * ziel.x;
        s.y = q * q * start.y + 2 * q * p * ky + p * p * ziel.y;
        s.rotation = p * Math.PI * 0.8;
        s.scale.set(basis * (1 - 0.45 * p));
      },
    }))
    .then(() => {
      ui.albumPlus();
      return tween(s, { alpha: 0, scale: basis * 0.3 }, 0.3, { ease: 'sineInOut' });
    })
    .then(() => { if (!s.destroyed) s.destroy(); });
}

// ---------------------------------------------------------------- Ausgang

export const fx = {
  burst,
  emitter: emitterNeu,
  pop,
  wobble,
  pulse,
  stern,
  /** Textur eines Teilchens (z. B. für eigene Deko): fx.texture('herz') */
  texture: teilchenTextur,
  /** Anzahl laufender Teilchen (zum Testen) */
  get count() { return lebend.length; },
  arten: Object.keys(ARTEN),
};
