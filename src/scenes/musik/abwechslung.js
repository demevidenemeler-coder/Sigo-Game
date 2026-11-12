// Abwechslung über Runden und Besuche hinweg: Was zuletzt dran war, steht im Speicher (store), neuestes hinten.
// Gewählt wird zufällig, aber nie eins der letzten `n` – so kommen bei sechs Stücken immer erst andere dran.

import { store, pick } from '../../engine/index.js';

/** Gemerkte Liste lesen; nur bekannte ids bleiben (alte oder kaputte Einträge fallen still weg). */
export function gemerkt(schluessel, erlaubt) {
  const roh = store.get(schluessel, []);
  return Array.isArray(roh) ? roh.filter((id) => erlaubt.includes(id)).slice(-8) : [];
}

/** Zufällig aus `liste`, aber keins der letzten `n` aus `zuletzt` (id(x) liefert die id eines Eintrags). */
export function waehleFrisch(liste, zuletzt, n = 3, id = (x) => x) {
  const sperre = zuletzt.slice(-n);
  const rest = liste.filter((x) => !sperre.includes(id(x)));
  return pick(rest.length ? rest : liste);
}

/** Neue Wahl hinten anhängen, speichern und die neue Liste zurückgeben. */
export function merke(schluessel, zuletzt, wert) {
  const neu = [...zuletzt.filter((x) => x !== wert), wert].slice(-8);
  store.set(schluessel, neu);
  return neu;
}
