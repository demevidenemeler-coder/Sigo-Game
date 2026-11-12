// Spielzeit pro Tag – von den Eltern begrenzbar (Eltern-Bereich).
//
//   import { spielzeit } from '../gemeinsam/spielzeit.js';
//   spielzeit.start(SceneManager);      // einmal in main.js
//   spielzeit.aufgebraucht()            // true = für heute ist Schluss (Ruhe-Bild)
//   spielzeit.heuteSek, .grenzeMin, .restSek, setzeGrenze(min), nochZehn(), zuruecksetzen(), pause(an)
//   const ab = spielzeit.beiAenderung(() => …);   // z. B. Sonnen-Knopf zeigen, wenn die Eltern verlängern
//
// Gezählt wird nur, wenn die Seite sichtbar ist, der Eltern-Bereich zu ist und in den letzten 60 s etwas
// berührt wurde. Der Zählstand liegt in store ('spielzeit.heute' = {datum, sek, bonus, aus}), die Grenze in
// 'spielzeit.grenze' (Minuten, 0 = aus, Standard 30). Bei einem neuen Tag beginnt alles bei 0.
//
// Ist die Grenze erreicht, wird nicht mitten in der Tätigkeit abgebrochen: Beim nächsten ruhigen Moment
// (3 s ohne Berührung, kein Szenenwechsel), spätestens nach 60 s, geht es weich zur Szene 'schlafen' mit
// {ende: true}. Danach ist 'aus' gesetzt: Jeder Start an diesem Tag führt zum Ruhe-Bild, bis die Eltern
// „Noch 10 Minuten" oder „Spielzeit zurücksetzen" wählen.
//
// Testbetrieb (?test=1): Begrenzung aus und nichts wird gespeichert – außer ?spielzeit=<sekunden> setzt eine
// Grenze in Sekunden zum Ausprobieren (Zählung beginnt dann bei 0, nur im Arbeitsspeicher).

import { store, isTest } from '../engine/index.js';

export const GRENZEN = [0, 15, 20, 30, 45, 60];  // Auswahl im Eltern-Bereich (Minuten, 0 = aus)
const STANDARD_GRENZE = 30;
const AKTIV_FENSTER = 60;     // s: so lange nach der letzten Berührung zählt die Zeit weiter
const RUHIG_NACH = 3;         // s ohne Berührung = ruhiger Moment
const SPAETESTENS = 60;       // s nach Erreichen der Grenze wird auf jeden Fall gewechselt
const SPEICHERN_ALLE = 10;    // s
const ZIEL = 'schlafen';

const testGrenze = (() => {
  const roh = new URLSearchParams(location.search).get('spielzeit');
  const n = Number(roh);
  return roh !== null && Number.isFinite(n) && n > 0 ? n : null;
})();
const nurImSpeicher = isTest; // im Test nie den echten Tagesstand anfassen

function heute() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function leer() {
  return { datum: heute(), sek: 0, bonus: 0, aus: false };
}

function lade() {
  if (nurImSpeicher) return leer();
  const z = store.get('spielzeit.heute', null);
  if (!z || typeof z !== 'object' || z.datum !== heute()) return leer();
  return {
    datum: z.datum,
    sek: Number.isFinite(Number(z.sek)) ? Math.max(0, Number(z.sek)) : 0,
    bonus: Number.isFinite(Number(z.bonus)) ? Math.max(0, Number(z.bonus)) : 0,
    aus: z.aus === true,
  };
}

let zustand = lade();
let manager = null;
let laeuft = false;
let pausiert = false;
let letzteEingabe = Date.now();   // der Start zählt als Berührung
let letzterTakt = Date.now();
let seitSpeichern = 0;
let faelligSeit = 0;              // Date.now(), seit die Grenze erreicht ist (0 = nicht fällig)
const hoerer = new Set();

function speichere() {
  if (nurImSpeicher) return;
  store.set('spielzeit.heute', zustand);
  seitSpeichern = 0;
}

function melde() {
  for (const fn of [...hoerer]) {
    try { fn(); } catch (e) { console.error('[sigo] spielzeit:', e); }
  }
}

// neuer Tag? → alles von vorn
function tageswechsel() {
  if (zustand.datum === heute()) return false;
  zustand = leer();
  faelligSeit = 0;
  speichere();
  melde();
  return true;
}

function leseGrenze() {
  const g = Number(store.get('spielzeit.grenze', STANDARD_GRENZE));
  return GRENZEN.includes(g) ? g : STANDARD_GRENZE;
}

// eingestellte Grenze in Sekunden ohne Verlängerung (Infinity = keine)
function basisSek() {
  if (isTest) return testGrenze ?? Infinity;
  const g = leseGrenze();
  return g > 0 ? g * 60 : Infinity;
}

// Grenze in Sekunden samt „Noch 10 Minuten" (Infinity = keine)
function grenzeSek() {
  return basisSek() + zustand.bonus;
}

function wechsleZurRuhe(params) {
  const s = manager?.current;
  if (!manager || manager._wechsel) return false;
  if (s && s.id === ZIEL) return true;   // schon im Schlafzimmer: die Szene richtet sich nach aufgebraucht()
  manager.go(ZIEL, params);
  return true;
}

function takt() {
  const jetzt = Date.now();
  const dt = Math.min(2, Math.max(0, (jetzt - letzterTakt) / 1000));
  letzterTakt = jetzt;
  tageswechsel();
  if (pausiert) return;

  // Für heute vorbei, aber das Kind ist (z. B. über einen alten Knopf) woanders: zurück ins Ruhe-Bild
  if (zustand.aus) {
    const s = manager?.current;
    if (s && s.id !== ZIEL && s._shown) wechsleZurRuhe({ ruhe: true });
    return;
  }

  const sichtbar = document.visibilityState === 'visible';
  if (sichtbar && jetzt - letzteEingabe <= AKTIV_FENSTER * 1000) {
    zustand.sek += dt;
    seitSpeichern += dt;
    if (seitSpeichern >= SPEICHERN_ALLE) speichere();
  }

  if (zustand.sek < grenzeSek()) {
    faelligSeit = 0;
    return;
  }
  if (!faelligSeit) faelligSeit = jetzt;
  const s = manager?.current;
  const ruhig = !!s && s._shown && s.idle >= RUHIG_NACH;
  const zuLange = jetzt - faelligSeit >= SPAETESTENS * 1000;
  if (!ruhig && !zuLange) return;
  if (!wechsleZurRuhe({ ende: true })) return;
  zustand.aus = true;
  faelligSeit = 0;
  speichere();
  melde();
}

export const spielzeit = {
  /** Einmal in main.js (nach dem Anmelden der Szenen). */
  start(m) {
    manager = m;
    if (laeuft) return;
    laeuft = true;
    const beruehrt = () => { letzteEingabe = Date.now(); };
    for (const art of ['pointerdown', 'keydown']) window.addEventListener(art, beruehrt, { capture: true, passive: true });
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') speichere();
      letzterTakt = Date.now();   // die Zeit im Hintergrund zählt nicht
    });
    window.addEventListener('pagehide', speichere);
    setInterval(takt, 1000);
  },

  /** Für heute aufgebraucht? (Dann führt der Start ins Ruhe-Bild, und es gibt keinen Sonnen-Knopf.) */
  aufgebraucht() {
    tageswechsel();
    return zustand.aus;
  },

  /** Heute gespielte Sekunden */
  get heuteSek() {
    tageswechsel();
    return zustand.sek;
  },

  /** Eingestellte Grenze in Minuten (0 = aus) */
  get grenzeMin() {
    return leseGrenze();
  },

  /** Verbleibende Sekunden (Infinity = keine Grenze) */
  get restSek() {
    tageswechsel();
    if (zustand.aus) return 0;
    return Math.max(0, grenzeSek() - zustand.sek);
  },

  /** Testbetrieb: null = normal, sonst ein kurzer Hinweis für die Anzeige im Eltern-Bereich */
  get testbetrieb() {
    if (!isTest) return null;
    return testGrenze ? `Testbetrieb: Grenze ${testGrenze} Sekunden` : 'Testbetrieb: Begrenzung aus';
  },

  setzeGrenze(min) {
    const g = GRENZEN.includes(Number(min)) ? Number(min) : STANDARD_GRENZE;
    store.set('spielzeit.grenze', g);
    // Ohne Grenze (oder mit einer neuen, noch nicht erreichten) gibt es für heute kein Ende mehr
    if (zustand.aus && (g === 0 || zustand.sek < grenzeSek())) zustand.aus = false;
    faelligSeit = 0;
    speichere();
    melde();
  },

  /** „Noch 10 Minuten": ab jetzt noch 10 Minuten Spielzeit. */
  nochZehn() {
    tageswechsel();
    const basis = basisSek();
    if (Number.isFinite(basis)) zustand.bonus = Math.max(zustand.bonus, zustand.sek + 600 - basis);
    zustand.aus = false;
    faelligSeit = 0;
    letzteEingabe = Date.now();
    speichere();
    melde();
  },

  /** „Spielzeit zurücksetzen": heute wieder bei 0. */
  zuruecksetzen() {
    zustand = leer();
    faelligSeit = 0;
    letzteEingabe = Date.now();
    speichere();
    melde();
  },

  /** Eltern-Bereich offen: nicht zählen, nicht wechseln. */
  pause(an) {
    pausiert = !!an;
    letzterTakt = Date.now();
    if (!an) letzteEingabe = Date.now();
  },

  /** fn() bei jeder Änderung (aufgebraucht, verlängert, zurückgesetzt). → Abmelde-Funktion */
  beiAenderung(fn) {
    hoerer.add(fn);
    return () => hoerer.delete(fn);
  },
};
