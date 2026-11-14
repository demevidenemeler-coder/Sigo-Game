// Kleine Helfer für den Zoo: Umhängen in einen anderen Container, weicher Bogenflug, ruhiges Gleiten,
// Auswahl ohne direkte Wiederholung, ein Tier isst etwas, Töne entprellen und eine Reibe-Fläche
// (Bürste, Kamm, Handtuch … über ein Tier reiben).

import { sfx, drag, pick, clamp, PIXI } from '../../engine/index.js';

/** Ding in einen anderen Container hängen, ohne dass es auf dem Bildschirm springt. */
export function umhängen(obj, ziel) {
  if (!obj || obj.destroyed || !ziel || obj.parent === ziel) return obj;
  const g = obj.getGlobalPosition();
  const p = ziel.toLocal(g);
  ziel.addChild(obj);
  obj.position.set(p.x, p.y);
  return obj;
}

/** Mittleres Tempo eines Flugs oder Gleitens (Einheiten/s) – nichts rast quer über das Bild. */
export const BOGEN_TEMPO = 900;

/** Dauer eines geraden Gleitens um (dx, dy): mindestens `min` Sekunden, bei weitem Weg länger. */
export function gleitDauer(dx, dy, min = 0.35, spitze = Math.PI / 2) {
  return Math.max(min, (Math.hypot(dx, dy) * spitze) / (BOGEN_TEMPO * Math.PI / 2));
}

/** Weich (sineInOut) nach (x, y) gleiten, Dauer nach dem Weg. → Promise<boolean> */
export function gleite(seite, obj, x, y, min = 0.35) {
  return seite.tween(obj, { x, y }, gleitDauer(x - obj.x, y - obj.y, min), { ease: 'sineInOut' });
}

/**
 * Weicher Flug im Bogen nach (x, y) (Koordinaten des Eltern-Containers).
 * {dauer, höhe, skala (Endgröße absolut), dreh} → Promise<boolean>. Weite Wege dauern länger (Ruhe-Regel).
 */
export function bogen(seite, obj, x, y, { dauer = 0.6, höhe = 120, skala = null, dreh = 0 } = {}) {
  const von = { x: obj.x, y: obj.y, s: Math.abs(obj.scale.y), r: obj.rotation };
  const weg = Math.hypot(x - von.x, y - von.y) + höhe;
  dauer = Math.max(dauer, weg / BOGEN_TEMPO);
  const proxy = { p: 0 };
  return seite.tween(proxy, { p: 1 }, dauer, {
    ease: 'sineInOut',
    onUpdate: () => {
      if (obj.destroyed) return;
      const p = proxy.p;
      obj.x = von.x + (x - von.x) * p;
      obj.y = von.y + (y - von.y) * p - höhe * 4 * p * (1 - p);
      if (skala !== null) obj.scale.set(von.s + (skala - von.s) * p);
      obj.rotation = von.r + dreh * p;
    },
  });
}

/** Zufällig aus der Liste, aber keins der letzten `merken` (verlauf = Array, wird ergänzt). */
export function wähleNeu(liste, verlauf, merken = 2) {
  const zuletzt = verlauf.slice(-merken);
  const rest = liste.filter((x) => !zuletzt.includes(x));
  const wahl = pick(rest.length ? rest : liste);
  verlauf.push(wahl);
  if (verlauf.length > 10) verlauf.shift();
  return wahl;
}

/** Liste zufällig mischen (neue Liste). */
export function gemischt(liste) {
  const a = [...liste];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Ein Tier isst etwas: Das Ding fliegt im kleinen Bogen zum Maul, Pose eat, ein paar ruhige Bissen, es wird klein
 * und verschwindet. Freuen (cheer) macht der Aufrufer. → Promise<boolean> (true = aufgegessen)
 */
export async function lassEssen(seite, tier, ding, { ton = 'common/mampf', bissen = 2, vol = 0.7, flug = true } = {}) {
  if (!tier || tier.destroyed || !ding || ding.destroyed) return false;
  ding.eventMode = 'none';
  if (tier.parent && ding.parent !== tier.parent) umhängen(ding, tier.parent);
  ding.zIndex = (tier.zIndex || 0) + 5;
  tier.pose('eat');
  if (flug) {
    const maul = tier.point('mouth') || { x: tier.x, y: tier.y - 150 };
    const s0 = Math.abs(ding.scale.y);
    await bogen(seite, ding, maul.x, maul.y, { dauer: 0.45, höhe: 60, skala: s0 * 0.85 });
  }
  if (ding.destroyed || tier.destroyed) return false;
  for (let k = 0; k < bissen; k++) {
    if (ding.destroyed) break;
    sfx(ton, { vol });
    await seite.tween(ding, { scale: Math.abs(ding.scale.y) * 0.72 }, 0.3, { ease: 'sineInOut' });
    await seite.wait(0.14);
  }
  if (!ding.destroyed) {
    await seite.tween(ding, { alpha: 0, scale: Math.abs(ding.scale.y) * 0.4 }, 0.25, { ease: 'quadIn' });
    if (!ding.destroyed) ding.destroy({ children: true });
  }
  await seite.wait(0.2);
  if (!tier.destroyed && tier.poseName === 'eat') tier.pose('idle');
  return !tier.destroyed;
}

/** Ein Ton höchstens alle `sek` Sekunden (nach der Uhr der Seite, `seite.uhr`). */
export function tonEinmal(seite, id, sek, opt) {
  seite._tonBis = seite._tonBis || {};
  if (seite.uhr < (seite._tonBis[id] || 0)) return;
  seite._tonBis[id] = seite.uhr + sek;
  sfx(id, opt);
}

/** Waren Start und Ende eines Ziehens so nah, dass es eigentlich ein Tipp war? */
export const kurz = (ctx) => Math.hypot(ctx.x - ctx.startX, ctx.y - ctx.startY) < 70;

/**
 * Reibe-Fläche: ein unsichtbares Feld über einem Tier. Fährt ein Finger darüber, folgt ihm ein Werkzeug (Bild) und
 * `onReib(x, y, weg)` meldet jedes Stück Weg (Seiten-Koordinaten). Ein einzelner Tipp (ohne Bewegung) meldet
 * `onTipp(x, y)` – so geht es auch ohne Wischen. → {feld, an(werkzeug|null), aus(), off()}
 */
export function reibeFläche(seite, { x, y, w, h, z = 1500, onReib, onTipp, onEnde }) {
  // Der Finger zieht einen unsichtbaren Punkt; nach dem Loslassen springt er an seinen Platz zurück
  const punkt = new PIXI.Container({ label: 'reibeflaeche' });
  punkt.hitArea = new PIXI.Rectangle(-w / 2, -h / 2, w, h);
  punkt.position.set(x, y);
  punkt.zIndex = z;
  punkt.eventMode = 'none';
  seite.welt.addChild(punkt);
  let werkzeug = null;
  let letzter = null;
  let weg = 0;
  // vor drag() angemeldet: der Punkt springt unter den Finger (dann folgt er ihm genau)
  punkt.on('pointerdown', (e) => {
    const p = seite.welt.toLocal(e.global);
    punkt.position.set(p.x, p.y);
    letzter = { x: p.x, y: p.y };
    weg = 0;
    if (werkzeug && !werkzeug.destroyed) werkzeug.position.set(p.x, p.y);
  });
  const zug = drag(punkt, {
    back: false,
    lift: 1,
    sound: null,
    onMove: () => {
      const px = clamp(punkt.x, x - w / 2, x + w / 2);
      const py = clamp(punkt.y, y - h / 2, y + h / 2);
      if (werkzeug && !werkzeug.destroyed) {
        werkzeug.position.set(px, py);
        werkzeug.rotation = Math.sin((seite.uhr || 0) * 9) * 0.12;
      }
      if (letzter) {
        const d = Math.hypot(px - letzter.x, py - letzter.y);
        if (d > 2) {
          weg += d;
          onReib?.(px, py, d);
        }
      }
      letzter = { x: px, y: py };
    },
    onDrop: () => {
      if (weg < 25) onTipp?.(letzter?.x ?? x, letzter?.y ?? y);
      onEnde?.();
      letzter = null;
      punkt.position.set(x, y);
    },
  });
  return {
    feld: punkt,
    an(neuesWerkzeug) {
      werkzeug = neuesWerkzeug || null;
      punkt.eventMode = 'static';
    },
    aus() {
      punkt.eventMode = 'none';
      werkzeug = null;
    },
    off() {
      zug.off();
      if (!punkt.destroyed) punkt.destroy();
    },
  };
}
