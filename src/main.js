// Start: Spielkern hochfahren, Ton und Hinweise verdrahten, Szenen anmelden, erste Szene zeigen.
// Dazu: Spielzeit pro Tag, Eltern-Zahnrad, Vollbild und wacher Bildschirm, Offline-Speicher (Service Worker).

import {
  initStage, initTest, SceneManager, registerScene, params, isTest, recordError,
  initAudio, music, sfx, setTapSound, loadPackAudio, ui, store,
} from './engine/index.js';
import { packJson, onLaden, laedtGerade } from './engine/assets.js';
import { onTap } from './engine/input.js';
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
  zoo: () => import('./scenes/zoo/index.js'),
  flughafen: () => import('./scenes/flughafen/index.js'),
  baeckerei: () => import('./scenes/baeckerei/index.js'),
};

const START = 'start';
const MIT_ZAHNRAD = new Set(['start', 'karte']);   // im Ruhe-Bild setzt die Schlafen-Szene es selbst
const ORTE = ['bahnhof', 'bauernhof', 'feuerwehr', 'baustelle', 'garten', 'teich', 'musik', 'malhaus', 'eisdiele',
  'spielplatz', 'wald', 'waschanlage', 'schlafen', 'zoo', 'flughafen', 'baeckerei', 'fahrt', 'album'];
// Vorausladen: Was wahrscheinlich als Nächstes kommt, lädt still im Hintergrund (Bilder in kleinen Häppchen).
// Auf der Karte kann das Kind überall hin – dort wird nur der Code der Orte geholt (die Bilder aller Orte passen
// nicht zugleich in den Speicher); der zuletzt besuchte Ort bleibt ohnehin im Speicher (Vorrat im Kern).
const DANACH = { start: ['karte'], bahnhof: ['fahrt'], '*': ['karte'] };

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

// Beim allerersten Besuch lädt der Service Worker ~60 MB. Das soll dem Spiel nicht die Leitung wegnehmen:
// - Er meldet sich erst an, wenn das erste Bild steht UND das Kind zum ersten Mal getippt hat (dann steht auch der
//   Ton: Das Anlegen des AudioContext bei der ersten Berührung hing in Messungen bis zu 3 s, wenn der Service
//   Worker gleichzeitig den Offline-Speicher füllte) – spätestens SW_SPAETESTENS s nach dem ersten Bild.
// - Solange das Spiel selbst lädt (Szenenwechsel oder Bilder mit voller Kraft, z. B. ab dem Tipp auf einen Ort),
//   holt die Installation nichts Neues (Nachricht 'sigo-laden').
// - Was das Spiel bis dahin geladen hat, liegt im Browser-Speicher und kostet den Service Worker nur eine kurze
//   Nachfrage (304).
// - Scheitert die Installation (langsames WLAN: Chrome bricht sie nach etwa 5 min ab; Netz weg), versucht es das
//   Spiel in derselben Sitzung wieder (nach SW_NEU_VERSUCH s, nicht mitten in einem Szenenwechsel). Schon
//   Gespeichertes bleibt liegen, es kommt nur der Rest.
const SW_NACH_TIPP = 2;          // s nach der ersten Berührung
const SW_SPAETESTENS = 30;       // s nach dem ersten Bild, auch ohne Berührung
const SW_NEU_VERSUCH = [30, 60, 120, 240];   // s Pause vor dem 1., 2., 3., … neuen Versuch (dann bleibt es bei 240)

function registriereServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  const suche = new URLSearchParams(location.search);
  // Im Testbetrieb und beim Entwickeln auf dem eigenen Rechner nicht (Tests sollen immer frische Dateien sehen);
  // ?sw=1 schaltet ihn zum Ausprobieren trotzdem ein.
  const lokal = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
  if (isTest || (lokal && suche.get('sw') !== '1')) return;
  const sw = navigator.serviceWorker;
  let reg = null;
  let versuche = 0;

  // Dem Service Worker sagen, ob das Spiel gerade selbst lädt
  let meldeteLaden = null;
  const meldeLaden = () => {
    const an = SceneManager.wechselt || laedtGerade();
    if (!reg || an === meldeteLaden) return;
    meldeteLaden = an;
    for (const w of [reg.installing, reg.waiting]) {
      try { w?.postMessage({ sigo: 'laden', an }); } catch { /* egal */ }
    }
  };
  SceneManager.onWechsel(meldeLaden);
  onLaden(meldeLaden);

  // Installierender Arbeiter: scheitert er (redundant) und kommt kein anderer nach, später noch einmal versuchen.
  // Jeder Arbeiter nur einmal (beim ersten Anmelden melden ihn register() UND 'updatefound').
  const beobachtet = new WeakSet();
  const beobachte = (w) => {
    if (!w || beobachtet.has(w)) return;
    beobachtet.add(w);
    meldeteLaden = null;
    meldeLaden();
    let fertig = false;   // war er einmal ganz installiert, ist ein späteres 'redundant' nur die Ablösung
    w.addEventListener('statechange', () => {
      // fertig geladen, während das Spiel schon im Hintergrund liegt: gleich übernehmen
      if (w.state === 'installed') uebernehmen();
      if (w.state === 'installed' || w.state === 'activating' || w.state === 'activated') fertig = true;
      if (w.state !== 'redundant' || fertig || reg.installing || reg.waiting) return;
      const pause = SW_NEU_VERSUCH[Math.min(versuche, SW_NEU_VERSUCH.length - 1)];
      versuche++;
      console.info(`[sigo] Offline-Speicher unvollständig – neuer Versuch in ${pause} s.`);
      setTimeout(neuerVersuch, pause * 1000);
    });
  };
  const neuerVersuch = () => {
    if (SceneManager.wechselt || document.hidden) {
      setTimeout(neuerVersuch, 5000);
      return;
    }
    // Ohne fertigen Arbeiter meldet register() einen neuen Versuch an (nach einer gescheiterten ersten Installation
    // ist das eine neue Anmeldung – anmelden() hängt sich auch an sie); mit einem aktiven sucht update() neu
    if (reg?.active) Promise.resolve(reg.update()).catch((e) => console.warn('[sigo] Service Worker:', e));
    else anmelden();
  };

  const uebernehmen = beobachteNeueFassung(() => reg);
  const verbunden = new WeakSet();
  const anmelden = async () => {
    try {
      // updateViaCache 'none': sw.js und sw-dateien.js werden beim Prüfen auf Neues nie aus dem Browser-Speicher
      // genommen – eine neue Liste (neuer Versions-Stempel) wird also sicher bemerkt
      const r = await sw.register('sw.js', { updateViaCache: 'none' });
      reg = r;
      if (!verbunden.has(r)) {
        verbunden.add(r);
        r.addEventListener('updatefound', () => beobachte(r.installing));
      }
      beobachte(r.installing);
    } catch (e) {
      // sw.js gerade nicht erreichbar (Netz weg): ohne fertigen Offline-Speicher später noch einmal
      console.warn('[sigo] Service Worker:', e);
      if (!reg?.active) setTimeout(neuerVersuch, SW_NEU_VERSUCH[Math.min(versuche++, SW_NEU_VERSUCH.length - 1)] * 1000);
    }
  };
  // Schon eingerichtet (späterer Start): gleich anmelden – kostet nichts, der Update-Weg bleibt wie bisher
  if (sw.controller) {
    anmelden();
    return;
  }
  let angemeldet = false;
  const einmal = () => {
    if (angemeldet) return;
    angemeldet = true;
    anmelden();
  };
  let bereit = false;
  let getippt = false;
  const pruefe = () => { if (bereit && getippt) setTimeout(einmal, SW_NACH_TIPP * 1000); };
  window.addEventListener('pointerdown', () => { getippt = true; pruefe(); }, { once: true, capture: true, passive: true });
  SceneManager.ready.then(() => {
    bereit = true;
    setTimeout(einmal, SW_SPAETESTENS * 1000);
    pruefe();
  });
}

// Eine neue Fassung übernimmt nie mitten im Spiel (sonst kämen alter Spielkern und neu nachgeladene Szenen
// zusammen). Sie wartet, bis das Spiel neu startet – oder bis es unsichtbar im Hintergrund liegt: Dann darf sie
// übernehmen, und die Seite lädt still neu. Kommt das Kind zurück, läuft schon die neue Fassung.
// holeReg: die aktuelle Anmeldung (nach einer gescheiterten ersten Installation ist das eine neue). Gibt
// uebernehmen() zurück: aufrufen, sobald ein neuer Arbeiter fertig installiert ist.
function beobachteNeueFassung(holeReg) {
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
    const reg = holeReg();
    if (document.visibilityState === 'hidden' && reg?.waiting && sw.controller) reg.waiting.postMessage('sigo-jetzt');
  };
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') uebernehmen();
    else holeReg()?.update().catch(() => {});   // zurück im Spiel: still nach einer neuen Fassung sehen
  });
  return uebernehmen;
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

// Schneller erster Start: Die Start-Szene wartet nur auf die Bilder, die sie beim Aufbau anfasst (gemerkt vom
// letzten Start; beim allerersten Besuch gilt START_BILDER), alle anderen Bilder ihrer Pakete (Karte, Zug-Teile,
// Symbole …) laden danach leise. Statt 6,9 MB sind es so beim ersten Besuch ≈ 1,4 MB bis zum Startbild.
// Fasst die Szene doch ein anderes Bild an (z. B. ein umgebauter Zug), baut der Kern sie unsichtbar mit allen
// Bildern neu auf – es kostet dann nur einmal die alte Zeit. Liste neu ermitteln (nach Änderungen an der
// Start-Szene; nicht nötig, aber schneller beim allerersten Besuch):
//   node tools/shot.mjs --szene start --out shots/x.jpg --warte 3 --aktionen '[["js","localStorage.getItem(\"sigo2.erstebilder.start\")"]]'
const START_BILDER = [
  'common/hand', 'common/icon_zahnrad', 'common/p_rauch', 'common/sonne',
  'rahmen/knopf_start', 'rahmen/logo', 'rahmen/start_hg',
  'tiere/kuh_idle',
  'zug/kuppelstange', 'zug/lok_dampf', 'zug/rad_gross', 'zug/rad_gruen', 'zug/schiene',
  'zug/wagen_offen_gelb', 'zug/wagen_offen_gelb_vorn', 'zug/wagen_offen_rot', 'zug/wagen_offen_rot_vorn',
];
const ERSTE_BILDER_MAX = 60;   // wächst die gemerkte Liste darüber (oft umgebaute Züge), fängt sie neu an

function richteErstenStartEin(erste) {
  if (erste !== START) return;
  const gemerkt = store.get('erstebilder.start', null);
  const liste = Array.isArray(gemerkt) && gemerkt.length ? gemerkt : START_BILDER;
  SceneManager.ersteBilder(START, liste, (ids) => {
    if (!ids.length) return;
    const neu = new Set([...(Array.isArray(gemerkt) ? gemerkt : []), ...ids]);
    store.set('erstebilder.start', neu.size <= ERSTE_BILDER_MAX ? [...neu].sort() : [...ids].sort());
  });
}

// Auf der Karte: den Code aller Orte still holen (je Ort ein Modul, mit Pausen) – einmal je Sitzung
function holeOrtsCode() {
  let geholt = false;
  SceneManager.onWechsel((an) => {
    if (an || geholt || SceneManager.current?.id !== 'karte') return;
    geholt = true;
    const reihe = ORTE.filter((id) => SceneManager.has(id));
    const weiter = () => {
      if (!reihe.length) return;
      if (SceneManager.wechselt) {
        setTimeout(weiter, 1000);
        return;
      }
      SceneManager.vorausladen(reihe.shift(), { nurCode: true }).finally(() => setTimeout(weiter, 150));
    };
    setTimeout(weiter, 2000);
  });
}

// Tipp auf einen Ort (ein Ding mit label 'ort:<id>', so baut die Karte ihre Orte): Bilder des Ortes sofort mit
// voller Kraft anfordern. Die Zugfahrt dorthin dauert 1–2 s – so lange lädt der Ort schon, und beim Wechsel ist er
// meist fertig. Nur der erste Ort je Besuch der Karte (Tipps während der Fahrt lassen andere Orte nur wackeln).
function ladeOrtBeimTipp() {
  const schon = new WeakSet();   // Szenen-Besuche, in denen schon ein Ort angefordert wurde (hält sie nicht fest)
  onTap((obj) => {
    const m = /^ort:([\w-]+)$/.exec(obj?.label || '');
    const hier = SceneManager.current;
    if (!m || !hier || schon.has(hier) || SceneManager.wechselt || m[1] === hier.id || !SceneManager.has(m[1])) return;
    schon.add(hier);
    SceneManager.vorausladen(m[1], { sofort: true }).then((ok) => { if (!ok) schon.delete(hier); });
  });
}

async function start() {
  initTest(SceneManager);
  for (const [id, laden] of Object.entries(SZENEN)) registerScene(id, laden);
  // Die Bilder der ersten Szene schon holen, während die Grafik hochfährt
  for (const p of ['common', 'rahmen', 'zug', 'tiere']) packJson(p);
  const [erste, erstePar] = ersteSzene();
  richteErstenStartEin(erste);
  SceneManager.vorausladen(erste, { sofort: true });
  registriereServiceWorker();
  try {
    await initStage(document.body);
  } catch (e) {
    recordError('Grafik ließ sich nicht starten', e);
    return;
  }
  verdrahteTon();
  verdrahteGeraet();
  SceneManager.danach(DANACH);
  holeOrtsCode();
  ladeOrtBeimTipp();
  SceneManager.start();
  // Eltern-Zahnrad unten rechts auf Start und Karte
  SceneManager.onEnter((szene) => { if (MIT_ZAHNRAD.has(szene.id)) zahnrad(szene); });
  // Zeige-Hand: nach 6 s ohne Eingabe, dann alle 8 s, höchstens 3-mal bis zur nächsten Berührung
  ui.startHinweise(SceneManager);
  const ab = SceneManager.onEnter(() => { ab(); ladeHinweisWeg(); });
  spielzeit.start(SceneManager);
  SceneManager.go(erste, erstePar);
}

start();
