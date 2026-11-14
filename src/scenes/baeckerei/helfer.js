// Kleine Helfer für die Bäckerei: Umhängen, weicher Bogenflug, Gleit-Dauer, Zufall ohne Wiederholung,
// Farben mischen, Bäckermütze und Partyhütchen (gezeichnet), Gebackenes merken (store).

import { PIXI, meta, tex, store, pick, lerp, clamp } from '../../engine/index.js';

// ---------------------------------------------------------------- Allgemeines

/** Ding in einen anderen Container hängen, ohne dass es auf dem Bildschirm springt. */
export function umhängen(obj, ziel) {
  if (!obj || obj.destroyed || !ziel || ziel.destroyed || obj.parent === ziel) return obj;
  const g = obj.getGlobalPosition();
  const p = ziel.toLocal(g);
  ziel.addChild(obj);
  obj.position.set(p.x, p.y);
  return obj;
}

/** Mittleres Tempo eines Flugs (Einheiten/s) – nichts rast quer über das Bild. */
export const TEMPO = 900;

/** Dauer eines geraden Gleitens um (dx, dy): mindestens `min` Sekunden, bei weitem Weg länger. */
export function gleitDauer(dx, dy, min = 0.35, spitze = Math.PI / 2) {
  return Math.max(min, (Math.hypot(dx, dy) * spitze) / (TEMPO * Math.PI / 2));
}

/**
 * Weicher Flug im Bogen nach (x, y) (Koordinaten des Eltern-Containers).
 * {dauer (kürzeste Zeit), höhe, skala (Endgröße), dreh (Drehung dazu)} → Promise<boolean>
 */
export function bogen(seite, obj, x, y, { dauer = 0.55, höhe = 110, skala = null, dreh = 0 } = {}) {
  const von = { x: obj.x, y: obj.y, s: Math.abs(obj.scale.y), r: obj.rotation };
  const weg = Math.hypot(x - von.x, y - von.y) + höhe;
  dauer = Math.max(dauer, weg / TEMPO);
  const p = { t: 0 };
  return seite.tween(p, { t: 1 }, dauer, {
    ease: 'sineInOut',
    onUpdate: () => {
      if (obj.destroyed) return;
      const k = p.t;
      obj.x = von.x + (x - von.x) * k;
      obj.y = von.y + (y - von.y) * k - höhe * 4 * k * (1 - k);
      if (skala !== null) obj.scale.set(von.s + (skala - von.s) * k);
      obj.rotation = von.r + dreh * k;
    },
  });
}

/** Zufällig aus der Liste, aber keins der letzten `merken` (verlauf wird ergänzt). */
export function wähleNeu(liste, verlauf, merken = 1) {
  const zuletzt = verlauf.slice(-merken);
  const rest = liste.filter((x) => !zuletzt.includes(x));
  const wahl = pick(rest.length ? rest : liste);
  verlauf.push(wahl);
  if (verlauf.length > 8) verlauf.shift();
  return wahl;
}

/** Farbe zwischen a und b (t = 0 … 1) */
export function misch(a, b, t) {
  const r = Math.round(lerp((a >> 16) & 255, (b >> 16) & 255, t));
  const g = Math.round(lerp((a >> 8) & 255, (b >> 8) & 255, t));
  const bl = Math.round(lerp(a & 255, b & 255, t));
  return (r << 16) | (g << 8) | bl;
}

/** War das Ziehen nur ein Tipp? */
export const kurz = (ctx) => Math.hypot(ctx.x - ctx.startX, ctx.y - ctx.startY) < 70;

/** Skala, mit der ein Bild `breite` breit wird (oder höchstens `höhe` hoch). */
export function skalaFür(id, breite, höhe = Infinity) {
  const m = meta(id);
  const w = m.w || tex(id).width || 1;
  const h = m.h || tex(id).height || 1;
  return Math.min(breite / w, höhe / h);
}

/** Tippfläche (Rechteck) für ein Sprite mit mindestens `min` Einheiten Breite/Höhe auf dem Bildschirm. */
export function fläche(sp, min = 240, skala = null) {
  const s = skala || Math.abs(sp.scale.x) || 1;
  const w = Math.max(sp.texture.width, min / s);
  const h = Math.max(sp.texture.height, min / s);
  return new PIXI.Rectangle(-sp.anchor.x * sp.texture.width - (w - sp.texture.width) / 2,
    -sp.anchor.y * sp.texture.height - (h - sp.texture.height) / 2, w, h);
}

// ---------------------------------------------------------------- Mützen

/** Sitz einer Mütze je Tier: Verschiebung gegenüber der Bildmitte oben (Bildpunkte des Tierbildes). */
const SITZ = {
  hase: [95, 230], katze: [0, 60], hund: [0, 40], baer: [-40, 140], fuchs: [40, 160], schwein: [40, 30],
  maus: [50, 160], eichhoernchen: [100, 100], ente: [0, 30], pferd: [90, 60], giraffe: [60, 40],
  huhn: [60, 0], hahn: [80, 20], elefant: [0, 40], kuh: [0, 30], eule: [0, 30], pinguin: [0, 40],
  schaf: [0, 60], frosch: [0, 40], affe: [0, 50], loewe: [0, 60],
};

// Mütze auf den Kopf eines Tiers setzen (hängt in actor.huelle, hüpft mit)
function aufsetzen(seite, a, h, drehung) {
  const [dx, dy] = SITZ[a.tierId] || [0, 40];
  const p = a._bildPunkt('kopf');
  const l = a.huelle.toLocal(a.sprite.toGlobal({ x: p.x + dx, y: p.y + dy + 160 }));
  const k = 0.8 / Math.max(0.2, Math.abs(a.scale.x));
  h.position.set(l.x, l.y);
  h.rotation = drehung;
  h.scale.set(0.01);
  h.eventMode = 'none';
  a.huelle.addChild(h);
  seite.tween(h, { scale: k }, 0.5, { ease: 'backOut' });
  return h;
}

/** Weiße, bauschige Bäckermütze (gezeichnet). Ursprung = Unterkante des Bandes. */
export function bäckermütze(seite, a) {
  if (!a || a.destroyed) return null;
  const h = new PIXI.Container({ label: 'baeckermuetze' });
  const g = new PIXI.Graphics();
  const rand_ = 0xd9d2c6;
  // drei Bäusche oben
  g.circle(-36, -92, 40).fill(0xfffdf8).stroke({ width: 4, color: rand_ });
  g.circle(36, -92, 40).fill(0xfffdf8).stroke({ width: 4, color: rand_ });
  g.circle(0, -112, 46).fill(0xfffdf8).stroke({ width: 4, color: rand_ });
  // Band
  g.roundRect(-54, -58, 108, 58, 18).fill(0xfffdf8).stroke({ width: 4, color: rand_ });
  g.roundRect(-46, -50, 32, 42, 12).fill({ color: 0xffffff, alpha: 0.7 });
  // Glanz (Licht von oben links)
  g.ellipse(-16, -132, 18, 10).fill({ color: 0xffffff, alpha: 0.9 });
  g.ellipse(-50, -104, 10, 7).fill({ color: 0xffffff, alpha: 0.8 });
  h.addChild(g);
  return aufsetzen(seite, a, h, -0.1);
}

/** Partyhütchen für ein Geburtstagstier (gezeichnet, Farbe wechselt). */
export function partyhütchen(seite, a) {
  if (!a || a.destroyed) return null;
  const farbe = pick([0xf7cf7a, 0xb9c8f2, 0xc6e6a8, 0xf6b8d0]);
  const rand_ = misch(farbe, 0x5a3a2a, 0.3);
  const h = new PIXI.Container({ label: 'partyhut' });
  const g = new PIXI.Graphics();
  g.poly([-44, 0, 44, 0, 0, -112]).fill(farbe).stroke({ width: 5, color: rand_, join: 'round' });
  // Streifen statt Punkte
  g.moveTo(-30, -36).lineTo(26, -26).stroke({ width: 7, color: 0xffffff, alpha: 0.6, cap: 'round' });
  g.moveTo(-16, -72).lineTo(14, -66).stroke({ width: 6, color: 0xffffff, alpha: 0.6, cap: 'round' });
  g.circle(0, -116, 15).fill(0xffffff).stroke({ width: 4, color: rand_ });
  h.addChild(g);
  return aufsetzen(seite, a, h, 0.16);
}

// ---------------------------------------------------------------- Gebackenes merken

const GEBACKEN = 'baeckerei.gebacken';
const MAX_GEBACKEN = 30;   // so viel passt ins Wandregal im Laden (drei Bretter)
const SORTEN_NAMEN = ['brezel', 'broetchen', 'hoernchen', 'brot'];
const GLAS = 'baeckerei.keksglas';
const KEKS_FORMEN = ['stern', 'herz', 'mond', 'hase'];   // nur Formen mit Bild (kaputter Speicher)

/** Was schon gebacken wurde (Liste der Sorten, neueste hinten, höchstens 30). */
export function gebacken() {
  const l = store.get(GEBACKEN, []);
  return Array.isArray(l) ? l.filter((x) => SORTEN_NAMEN.includes(x)).slice(-MAX_GEBACKEN) : [];
}

export function merkeGebacken(sorte) {
  const l = gebacken();
  l.push(sorte);
  store.set(GEBACKEN, l.slice(-MAX_GEBACKEN));
}

/** Kekse im Glas: [{f: form, c: farbe}], höchstens 16. */
export function keksglas() {
  const l = store.get(GLAS, []);
  return Array.isArray(l) ? l.filter((k) => k && KEKS_FORMEN.includes(k.f) && Number.isFinite(k.c)).slice(-16) : [];
}

export function merkeKekse(liste) {
  store.set(GLAS, [...keksglas(), ...liste].slice(-16));
}

export { clamp };
