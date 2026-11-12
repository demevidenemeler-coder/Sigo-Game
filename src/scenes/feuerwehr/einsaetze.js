// Die verschiedenen Einsätze und die Mannschaft – gemeinsam für alle drei Seiten.
//
// Ein Einsatz wird beim Alarm auf der Wache gewählt (der Fuchs zeigt ihn in einer Denkblase) und auf der
// Einsatz-Seite gespielt. Nie zweimal derselbe hintereinander. Kommt das Kind direkt auf die Einsatz-Seite,
// wählt sie selbst einen.

import { pick, shuffle, store, isTest } from '../../engine/index.js';

const EINSAETZE_IDS = ['fenster', 'muell', 'katze', 'ballon', 'kueken'];

/**
 * art: 'feuer' (Schlauch, Hydrant, löschen) oder 'leiter' (Leiter aufrichten, ausfahren, retten)
 * retter: wer sich am Ende freut (bzw. gerettet wird)
 * schmutz: wie das Auto danach auf dem Waschplatz aussieht
 */
export const EINSAETZE = {
  fenster: { icon: 'feuerwehr/flamme1', art: 'feuer', retter: 'hase', schmutz: 'russ' },
  muell: { icon: 'common/icon_muelleimer', art: 'feuer', retter: 'igel', schmutz: 'russ' },
  katze: { icon: 'tiere/katze_idle', art: 'leiter', retter: 'katze', schmutz: 'laub' },
  ballon: { icon: 'feuerwehr/ballon', art: 'leiter', retter: 'maus', schmutz: 'laub' },
  kueken: { icon: 'tiere/ente_idle', art: 'leiter', retter: 'ente', schmutz: 'matsch' },
};

// Nur zum Testen (mit test=1): ?einsatz=<id> legt den ersten Einsatz fest
let testEinsatz = null;
try {
  const q = new URLSearchParams(location.search);
  if (isTest && EINSAETZE_IDS.includes(q.get('einsatz'))) testEinsatz = q.get('einsatz');
} catch { /* egal */ }

/** Nächster Einsatz (zufällig, nie derselbe wie der letzte). Merkt ihn sich an der Szene. → id */
export function naechsterEinsatz(szene) {
  const frei = Object.keys(EINSAETZE).filter((id) => id !== szene.letzterEinsatz);
  const id = testEinsatz || pick(frei);
  testEinsatz = null;
  szene.letzterEinsatz = id;
  return id;
}

/** Wer in der Wache als Mannschaft warten kann (für alle gibt es einen Helm-Sitz). */
export const MANNSCHAFT = ['hund', 'katze', 'baer', 'affe', 'schwein', 'hase'];

/** n zufällige Mannschafts-Tiere, ohne die ausgeschlossenen. */
export function waehleMannschaft(n, ohne = []) {
  return shuffle(MANNSCHAFT.filter((t) => !ohne.includes(t))).slice(0, n);
}

// ---------------------------------------------------------------- was über die Runden wächst

const ORDEN_KEY = 'feuerwehr.orden';
const WIMPEL_KEY = 'feuerwehr.wimpel';
export const ORDEN_MAX = 6;
export const WIMPEL_MAX = 9;

/** Wie viele Orden hängen an der Wand der Wache (0…6)? */
export function ordenZahl() {
  const n = store.get(ORDEN_KEY, 0);
  return Number.isFinite(n) ? Math.max(0, Math.min(ORDEN_MAX, Math.floor(n))) : 0;
}
export function ordenDazu() {
  const n = Math.min(ORDEN_MAX, ordenZahl() + 1);
  store.set(ORDEN_KEY, n);
  return n;
}

/** Wie viele Wimpel hängen über dem Waschplatz (0…9)? */
export function wimpelZahl() {
  const n = store.get(WIMPEL_KEY, 0);
  return Number.isFinite(n) ? Math.max(0, Math.min(WIMPEL_MAX, Math.floor(n))) : 0;
}
export function wimpelDazu() {
  const n = Math.min(WIMPEL_MAX, wimpelZahl() + 1);
  store.set(WIMPEL_KEY, n);
  return n;
}
