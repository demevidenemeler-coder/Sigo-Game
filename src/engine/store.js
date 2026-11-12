// Speicher im Browser (localStorage). Alle Schlüssel beginnen mit 'sigo2.'.
// Fehlertolerant: Im privaten Modus oder bei vollem Speicher wird still im Arbeitsspeicher weitergemacht.

const PRAEFIX = 'sigo2.';
const ersatz = new Map(); // falls localStorage nicht geht

function lesen(key) {
  try {
    const roh = localStorage.getItem(PRAEFIX + key);
    if (roh !== null) return roh;
  } catch { /* privater Modus */ }
  return ersatz.has(key) ? ersatz.get(key) : null;
}

function schreiben(key, roh) {
  ersatz.set(key, roh);
  try {
    localStorage.setItem(PRAEFIX + key, roh);
  } catch { /* privater Modus oder voll – Arbeitsspeicher reicht */ }
}

export const store = {
  /** Wert lesen; fehlt er oder ist er kaputt, kommt def zurück. */
  get(key, def = null) {
    const roh = lesen(key);
    if (roh === null) return def;
    try {
      return JSON.parse(roh);
    } catch {
      return def;
    }
  },

  /** Wert speichern (wird als JSON abgelegt). */
  set(key, val) {
    let roh;
    try {
      roh = JSON.stringify(val);
    } catch (e) {
      console.warn('[sigo] store.set: Wert nicht speicherbar', key, e);
      return;
    }
    schreiben(key, roh);
  },

  remove(key) {
    ersatz.delete(key);
    try { localStorage.removeItem(PRAEFIX + key); } catch { /* egal */ }
  },

  /** Sticker ins Album legen. true = war neu. */
  sticker(id) {
    const liste = store.get('sticker', []);
    if (!Array.isArray(liste)) {
      store.set('sticker', [id]);
      return true;
    }
    if (liste.includes(id)) return false;
    liste.push(id);
    store.set('sticker', liste);
    return true;
  },

  /** Alle gesammelten Sticker. */
  stickers() {
    const liste = store.get('sticker', []);
    return Array.isArray(liste) ? liste : [];
  },
};
