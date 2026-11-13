// Die verschiedenen Einsätze und die Mannschaft – gemeinsam für alle drei Seiten.
//
// Ein Einsatz wird beim Alarm auf der Wache gewählt (der Fuchs zeigt ihn in einer Denkblase) und auf der
// Einsatz-Seite gespielt. Nie zweimal derselbe hintereinander. Kommt das Kind direkt auf die Einsatz-Seite,
// wählt sie selbst einen.

import { pick, shuffle, store, isTest } from '../../engine/index.js';

/**
 * art: 'feuer' (Schlauch, Hydrant, löschen), 'leiter' (Leiter aufrichten, ausfahren, retten) oder
 *      'garten' (Blumenkübel aufrichten, Erde zurückwischen, Blumen einsetzen, gießen)
 * retter: wer sich am Ende freut (bzw. gerettet wird) – er malt der Feuerwehr ein Dankesbild
 * schmutz: wie das Auto danach auf dem Waschplatz aussieht
 * sticker: welchen Sticker die geschaffte Runde am liebsten bringt
 */
export const EINSAETZE = {
  fenster: { icon: 'feuerwehr/flamme1', art: 'feuer', retter: 'hase', schmutz: 'russ', sticker: 'feuerwehr_feuerwehrauto' },
  muell: { icon: 'common/icon_muelleimer', art: 'feuer', retter: 'igel', schmutz: 'russ', sticker: 'feuerwehr_feuerwehrauto' },
  katze: { icon: 'tiere/katze_idle', art: 'leiter', retter: 'katze', schmutz: 'laub', sticker: 'feuerwehr_leiterkorb' },
  ballon: { icon: 'feuerwehr/ballon', art: 'leiter', retter: 'maus', schmutz: 'laub', sticker: 'feuerwehr_leiterkorb' },
  kueken: { icon: 'tiere/ente_idle', art: 'leiter', retter: 'ente', schmutz: 'matsch', sticker: 'feuerwehr_leiterkorb' },
  // neu in Runde 3
  drachen: { icon: 'feuerwehr/drachen', art: 'leiter', retter: 'maus', schmutz: 'laub', sticker: 'feuerwehr_leiterkorb' },
  laterne: { icon: 'feuerwehr/gluehbirne', art: 'leiter', retter: 'eule', schmutz: 'sand', sticker: 'feuerwehr_laterne' },
  kuebel: { icon: 'feuerwehr/blume_rot_auf', art: 'garten', retter: 'schaf', schmutz: 'matsch', sticker: 'feuerwehr_blumenkuebel' },
};
const EINSAETZE_IDS = Object.keys(EINSAETZE);
// Diese beiden sehen sich ähnlich (etwas hängt im Baum): nie direkt hintereinander
const AEHNLICH = { ballon: 'drachen', drachen: 'ballon' };

// Nur zum Testen (mit test=1): ?einsatz=<id> legt den ersten Einsatz fest
let testEinsatz = null;
try {
  const q = new URLSearchParams(location.search);
  if (isTest && EINSAETZE_IDS.includes(q.get('einsatz'))) testEinsatz = q.get('einsatz');
} catch { /* egal */ }

/**
 * Nächster Einsatz (zufällig, nie derselbe wie der letzte). Einsätze, für die noch kein Dankesbild am Tor hängt,
 * kommen bevorzugt – so findet ein Kind, das den Ort kennt, die neuen bald. Merkt ihn sich an der Szene. → id
 */
export function naechsterEinsatz(szene) {
  const letzter = szene.letzterEinsatz;
  const frei = EINSAETZE_IDS.filter((id) => id !== letzter && id !== AEHNLICH[letzter]);
  const schon = new Set(dankListe());
  const neu = frei.filter((id) => !schon.has(id));
  const id = testEinsatz || pick(neu.length && Math.random() < 0.6 ? neu : frei);
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

// Dankesbilder am Rolltor der Wache: je Einsatz-Art eines (gemalt vom Geretteten), in der Reihenfolge des Schaffens.
const DANK_KEY = 'feuerwehr.dank';

/** ids der Einsätze, deren Dankesbild schon am Tor klebt (höchstens eines je Einsatz) */
export function dankListe() {
  const l = store.get(DANK_KEY, []);
  return Array.isArray(l) ? l.filter((id, i) => EINSAETZE[id] && l.indexOf(id) === i).slice(0, EINSAETZE_IDS.length) : [];
}

/** Dankesbild für einen Einsatz dazu. → true, wenn es neu ist */
export function dankDazu(id) {
  const l = dankListe();
  if (!EINSAETZE[id] || l.includes(id)) return false;
  l.push(id);
  store.set(DANK_KEY, l);
  return true;
}

export const DANK_MAX = EINSAETZE_IDS.length;
