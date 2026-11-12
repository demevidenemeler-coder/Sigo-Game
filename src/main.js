// Start: Spielkern hochfahren, Ton und Hinweise verdrahten, Szenen anmelden, erste Szene zeigen.
// Dazu: Spielzeit pro Tag, Eltern-Zahnrad, Vollbild und wacher Bildschirm, Offline-Speicher (Service Worker).

import {
  initStage, initTest, SceneManager, registerScene, params, isTest, recordError,
  initAudio, music, sfx, setTapSound, loadPackAudio, ui,
} from './engine/index.js';
import { spielzeit } from './gemeinsam/spielzeit.js';
import { zahnrad, vollbildAn } from './gemeinsam/eltern.js';

// Alle Szenen – pro Szene eine Zeile: id → Lade-Funktion
const SZENEN = {
  probe: () => import('./scenes/probe/index.js'),
  demo: () => import('./scenes/demo/index.js'),
  zugtest: () => import('./scenes/zugtest/index.js'),
  seitentest: () => import('./scenes/seitentest/index.js'),
  // Rahmen
  start: () => import('./scenes/start/index.js'),
  karte: () => import('./scenes/karte/index.js'),
  album: () => import('./scenes/album/index.js'),
  schlafen: () => import('./scenes/schlafen/index.js'),
  // Orte
  bahnhof: () => import('./scenes/bahnhof/index.js'),
  fahrt: () => import('./scenes/fahrt/index.js'),
  bauernhof: () => import('./scenes/bauernhof/index.js'),
  feuerwehr: () => import('./scenes/feuerwehr/index.js'),
  baustelle: () => import('./scenes/baustelle/index.js'),
  garten: () => import('./scenes/garten/index.js'),
  teich: () => import('./scenes/teich/index.js'),
  musik: () => import('./scenes/musik/index.js'),
  malhaus: () => import('./scenes/malhaus/index.js'),
  eisdiele: () => import('./scenes/eisdiele/index.js'),
  spielplatz: () => import('./scenes/spielplatz/index.js'),
  wald: () => import('./scenes/wald/index.js'),
  waschanlage: () => import('./scenes/waschanlage/index.js'),
};

const START = 'start';
const MIT_ZAHNRAD = new Set(['start', 'karte']);   // im Ruhe-Bild setzt die Schlafen-Szene es selbst

function ladeHinweisWeg() {
  const el = document.getElementById('laden');
  if (!el) return;
  el.classList.add('weg');
  setTimeout(() => el.remove(), 900);
}

// Ton: Der AudioContext entsteht bei der ersten Berührung. Die Ton-Adressen aus allen pack.json-Dateien
// meldet assets.js an audio.js (onAudioRegistered → registerAudio, in audio.js eingerichtet).
function verdrahteTon() {
  initAudio();
  // Musik-Adressen (Paket 'musik'): nur die Ton-Einträge anmelden – die Bilder des Musik-Orts lädt erst der Ort
  loadPackAudio('musik');
  // Tipp-/Zieh-/Wisch-Töne der Eingabe: etwas leiser als normale Geräusche, Wischen am leisesten
  const LAUT = { tap: 0.7, drag: 0.6, drop: 0.6, wipe: 0.45, hold: 0.6 };
  setTapSound((id, art) => sfx(id, { vol: LAUT[art] ?? 0.7 }));
  // Musik der Szene (static music) – weich übergeblendet; ohne Angabe wird sie leise ausgeblendet
  SceneManager.onEnter((szene) => music(szene.constructor.music || null));
}

// ---------------------------------------------------------------- Vollbild und wacher Bildschirm

let wachSperre = null;
let fordertAn = false;

// Der Bildschirm bleibt nur wach, solange gespielt wird. Ohne Berührung gibt das Spiel die Sperre frei, dann
// schaltet das Tablet den Bildschirm nach seiner eigenen Zeit ab (Akku, dunkles Kinderzimmer):
const WACH_OHNE_BERUEHRUNG = 300;   // s: überall
const WACH_IM_RUHEBILD = 75;        // s: im Ruhe-Bild „Schluss für heute" (das Wiegenlied ist dann verklungen)

async function wachHalten() {
  if (!('wakeLock' in navigator) || document.visibilityState !== 'visible') return;
  if ((wachSperre && !wachSperre.released) || fordertAn) return;
  fordertAn = true;
  try {
    wachSperre = await navigator.wakeLock.request('screen');
  } catch { /* nicht erlaubt (Akku-Sparen o. ä.) – egal */ }
  fordertAn = false;
}

function wachFreigeben() {
  const s = wachSperre;
  if (!s || s.released) return;
  s.release().catch(() => {});
}

// Ist das Ruhe-Bild zu sehen, weil die Spielzeit für heute aufgebraucht ist?
const imRuhebild = (szene) => szene?.id === 'schlafen' && szene.phase === 'ruhe' && spielzeit.aufgebraucht();

function verdrahteGeraet() {
  // Beim ersten Berühren: Vollbild (braucht eine echte Berührung, darum beim Loslassen) und wacher Bildschirm.
  // Im Vollbild bleibt das Bild im Querformat (im Browser-Tab wirkt die Angabe im Manifest nicht).
  // Im Testbetrieb kein Vollbild (Testfotos bleiben gleich).
  let erstesMal = true;
  const beruehrt = () => {
    wachHalten();
    if (!erstesMal) return;
    erstesMal = false;
    if (!isTest) vollbildAn();
  };
  window.addEventListener('pointerup', beruehrt, { capture: true, passive: true });
  // Nach der Rückkehr (Bildschirm war aus, App im Hintergrund) gibt das System die Sperre frei – neu anfordern
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') wachHalten(); });
  // Lange keine Berührung: freigeben (die nächste Berührung fordert sie wieder an)
  SceneManager.onIdle((szene, idle) => {
    if (idle >= WACH_OHNE_BERUEHRUNG || (idle >= WACH_IM_RUHEBILD && imRuhebild(szene))) wachFreigeben();
  }, { after: 5 });
}

// ---------------------------------------------------------------- Offline (Service Worker)

function registriereServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  const suche = new URLSearchParams(location.search);
  // Im Testbetrieb und beim Entwickeln auf dem eigenen Rechner nicht (Tests sollen immer frische Dateien sehen);
  // ?sw=1 schaltet ihn zum Ausprobieren trotzdem ein.
  const lokal = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
  if (isTest || (lokal && suche.get('sw') !== '1')) return;
  window.addEventListener('load', async () => {
    try {
      // updateViaCache 'none': sw.js und sw-dateien.js werden beim Prüfen auf Neues nie aus dem Browser-Speicher
      // genommen – eine neue Liste (neuer Versions-Stempel) wird also sicher bemerkt
      const reg = await navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' });
      beobachteNeueFassung(reg);
    } catch (e) {
      console.warn('[sigo] Service Worker:', e);
    }
  });
}

// Eine neue Fassung übernimmt nie mitten im Spiel (sonst kämen alter Spielkern und neu nachgeladene Szenen
// zusammen). Sie wartet, bis das Spiel neu startet – oder bis es unsichtbar im Hintergrund liegt: Dann darf sie
// übernehmen, und die Seite lädt still neu. Kommt das Kind zurück, läuft schon die neue Fassung.
function beobachteNeueFassung(reg) {
  const sw = navigator.serviceWorker;
  let kontrolle = sw.controller;
  let laedt = false;
  sw.addEventListener('controllerchange', () => {
    const vorher = kontrolle;
    kontrolle = sw.controller;
    // erste Installation (vorher nichts): die Seite ist schon die neueste – nicht neu laden
    if (!vorher || laedt) return;
    laedt = true;
    location.reload();
  });
  const uebernehmen = () => {
    if (document.visibilityState === 'hidden' && reg.waiting && sw.controller) reg.waiting.postMessage('sigo-jetzt');
  };
  // ist sie fertig geladen, während das Spiel schon im Hintergrund liegt, gleich übernehmen
  reg.addEventListener('updatefound', () => {
    const neu = reg.installing;
    neu?.addEventListener('statechange', () => { if (neu.state === 'installed') uebernehmen(); });
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') uebernehmen();
    else reg.update().catch(() => {});   // zurück im Spiel: still nach einer neuen Fassung sehen
  });
}

// ---------------------------------------------------------------- Start

// Erste Szene: ?szene=… (Testen), sonst Start – oder das Ruhe-Bild, wenn die Spielzeit für heute vorbei ist
function ersteSzene() {
  if (params.szene) {
    const suche = new URLSearchParams(location.search);
    const p = params.szene === 'schlafen' ? { ende: suche.get('ende') === '1', ruhe: suche.get('ruhe') === '1' } : {};
    return [params.szene, p];
  }
  if (spielzeit.aufgebraucht()) return ['schlafen', { ruhe: true }];
  return [START, {}];
}

async function start() {
  initTest(SceneManager);
  registriereServiceWorker();
  try {
    await initStage(document.body);
  } catch (e) {
    recordError('Grafik ließ sich nicht starten', e);
    return;
  }
  verdrahteTon();
  verdrahteGeraet();
  for (const [id, laden] of Object.entries(SZENEN)) registerScene(id, laden);
  SceneManager.start();
  // Eltern-Zahnrad unten rechts auf Start und Karte
  SceneManager.onEnter((szene) => { if (MIT_ZAHNRAD.has(szene.id)) zahnrad(szene); });
  // Zeige-Hand: nach 6 s ohne Eingabe, dann alle 8 s, höchstens 3-mal bis zur nächsten Berührung
  ui.startHinweise(SceneManager);
  const ab = SceneManager.onEnter(() => { ab(); ladeHinweisWeg(); });
  spielzeit.start(SceneManager);
  const [id, p] = ersteSzene();
  SceneManager.go(id, p);
}

start();
