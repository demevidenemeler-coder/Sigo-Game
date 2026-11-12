// Offline-Speicher für Sigo (Service Worker).
//
// - Die Liste aller Spieldateien, ihre Prüfsummen und der Versions-Stempel stehen in sw-dateien.js (erzeugt von
//   tools/sw_liste.py).
// - Installieren: alle Dateien in einen Speicher mit Versionsnamen legen. Was sich seit der vorigen Fassung nicht
//   geändert hat (gleiche Prüfsumme), wird aus deren Speicher übernommen – aus dem Netz kommt nur Neues. Fehlt auch
//   nur eine Datei (wackliges WLAN), scheitert die Installation: Der alte, vollständige Speicher bleibt in Gebrauch,
//   und der Browser versucht es beim nächsten Start erneut. Schon geladene Dateien bleiben dabei liegen.
//   Rücksicht aufs Spiel: höchstens GLEICHZEITIG Dateien auf einmal, zuerst das, was das Kind als Nächstes braucht
//   (Kern, Start, Karte, Tiere, dann die Orte, Musik zuletzt). Solange das Spiel selbst gerade lädt (main.js meldet
//   'sigo-laden' an/aus), wartet die Installation (höchstens PAUSE_MAX Sekunden am Stück).
// - Eine neue Fassung übernimmt NIE mitten im Spiel: Sie wartet, bis das Spiel neu startet – oder bis main.js ihr
//   Bescheid gibt ('sigo-jetzt', nur wenn das Spiel gerade unsichtbar im Hintergrund liegt; danach lädt die Seite
//   neu). So kommen alter Spielkern und neue Szenen nie zusammen.
// - Aktivieren: nur die EIGENEN alten Speicher löschen (sigo2-… und den des alten 3D-Spiels, sigo-v…). Andere
//   Web-Apps auf derselben Adresse (z. B. <name>.github.io) behalten ihre Speicher.
// - Abrufen: streng aus dem Speicher dieser Fassung (schnell, auch ohne Internet). Nur was dort fehlt (nicht in
//   der Liste), kommt aus dem Netz – ohne es zu speichern, damit sich keine Fassungen mischen. sw-dateien.js
//   beantwortet der Service Worker selbst mit seiner Fassung (Versions-Zeile im Eltern-Bereich, auch ohne Netz).
//   Gesucht wird GENAU (Adresse ohne ?…): `match(…, {ignoreSearch: true})` geht bei ~960 Einträgen jeden Eintrag
//   durch und kostete je Datei 0,5–0,7 s (auf älterem Chrome noch mehr) – das war der größte Teil der Ladezeit.

importScripts('sw-dateien.js');

const VERSION = self.SIGO_VERSION || 'ohne-liste';
const PREFIX = 'sigo2-';
const SPEICHER = PREFIX + VERSION;
const DATEIEN = self.SIGO_DATEIEN || ['./', 'index.html'];
const PRUEF = self.SIGO_PRUEF || {};                 // Datei → kurze Prüfsumme des Inhalts
const PRUEF_KOPF = 'x-sigo-pruef';                   // so steht die Prüfsumme an der gespeicherten Antwort
const ALTES_SPIEL = /^sigo-v\d+$/;                   // Speicher des alten 3D-Spiels
const GLEICHZEITIG = 3;
const VERSUCHE = 3;
const ZEITLIMIT = 90;                                // s je Datei (die größte, ein Musikstück, braucht bei 1 Mbit/s ≈ 30 s)
const PAUSE_MAX = 8;                                 // s: so lange wartet die Installation höchstens am Stück
// Diese Dateien dürfen fehlen (Stimm-Aufnahmen kommen nach und nach; ohne sie bleibt es nur still)
const DARF_FEHLEN = /^assets\/stimme\//;

const eigenerSpeicher = (name) => name.startsWith(PREFIX) || ALTES_SPIEL.test(name);

// Der Speicher dieser Fassung – einmal geöffnet und gemerkt (nicht bei jeder Anfrage neu)
let speicherOffen = null;
function meinSpeicher() {
  if (!speicherOffen) speicherOffen = caches.open(SPEICHER).catch((e) => { speicherOffen = null; throw e; });
  return speicherOffen;
}

// Reihenfolge beim Installieren: was das Kind zuerst braucht, kommt zuerst (sonst bleibt die Reihenfolge der Liste)
const VORN = [
  /^(\.\/|index\.html|manifest\.webmanifest|vendor\/)/,
  /^src\/(main\.js|engine\/|gemeinsam\/)/,
  /^(src\/scenes\/(start|karte)\/|assets\/(common|rahmen|zug|tiere)\/)/,
  /^src\/scenes\//,
  /^assets\/(?!musik\/.*\.(ogg|mp3)$|stimme\/)/,
  /^(sounds\/|assets\/stimme\/)/,
];
function rang(url) {
  const i = VORN.findIndex((m) => m.test(url));
  return i < 0 ? VORN.length : i;
}

// Spiel lädt gerade (main.js meldet es) → Installation wartet
let spielLaedtBis = 0;
const warte = (ms) => new Promise((r) => setTimeout(r, ms));
async function rueksicht() {
  const anfang = Date.now();
  while (Date.now() < spielLaedtBis && Date.now() - anfang < PAUSE_MAX * 1000) await warte(100);
}

// Kurze Prüfsumme wie tools/sw_liste.py: SHA-256 des Inhalts, die ersten 12 Hex-Zeichen
async function pruefsummeVon(daten) {
  const h = new Uint8Array(await crypto.subtle.digest('SHA-256', daten));
  let s = '';
  for (let i = 0; i < 6; i++) s += h[i].toString(16).padStart(2, '0');
  return s;
}

// Holen mit Zeitlimit: Eine hängende Verbindung blockiert sonst einen der GLEICHZEITIG Arbeiter für immer.
async function holeMitZeitlimit(url, cacheArt) {
  const abbruch = new AbortController();
  const uhr = setTimeout(() => abbruch.abort(), ZEITLIMIT * 1000);
  try {
    const antwort = await fetch(new Request(url, { cache: cacheArt, signal: abbruch.signal }));
    // Den Inhalt ganz lesen, solange die Uhr läuft (auch ein stockender Inhalt zählt als hängend)
    const daten = antwort.ok ? await antwort.arrayBuffer() : null;
    return { antwort, daten };
  } finally {
    clearTimeout(uhr);
  }
}

async function lade(speicher, alte, url) {
  if (await speicher.match(url)) return true;          // von einem früheren Versuch schon da
  const pruef = PRUEF[url];
  // unverändert seit einer früheren Fassung? Dann aus deren Speicher übernehmen
  if (pruef) {
    for (const alt of alte) {
      const vorhanden = await alt.match(url);
      if (vorhanden && vorhanden.headers.get(PRUEF_KOPF) === pruef) {
        await speicher.put(url, vorhanden);
        return true;
      }
    }
  }
  for (let i = 0; i < VERSUCHE; i++) {
    await rueksicht();
    try {
      // 'no-cache': beim Server nachfragen (immer die neueste Datei), aber eine eben geladene, unveränderte Datei
      // nicht noch einmal ganz übertragen (das Spiel hat sie dann schon im Browser-Speicher: Antwort 304).
      // Passt der Inhalt nicht zur Prüfsumme (ein Zwischenspeicher lieferte kurz nach dem Veröffentlichen noch die
      // alte Datei), beim nächsten Versuch ganz frisch holen ('reload').
      const { antwort, daten } = await holeMitZeitlimit(url, i === 0 ? 'no-cache' : 'reload');
      if (antwort.ok) {
        const echt = pruef ? await pruefsummeVon(daten) : '';
        if (pruef && echt !== pruef && i < VERSUCHE - 1) continue;
        // Gespeichert wird mit der Prüfsumme des echten Inhalts: Eine abweichende Datei (sollte nach dem neuen
        // Versuch nicht mehr vorkommen) wird so bei der nächsten Fassung nie als „unverändert" übernommen.
        // Eine neue Antwort ist außerdem nie „umgeleitet" – wichtig für './'.
        const kopf = new Headers(antwort.headers);
        if (echt) kopf.set(PRUEF_KOPF, echt);
        await speicher.put(url, new Response(daten, { status: antwort.status, statusText: antwort.statusText, headers: kopf }));
        return true;
      }
      if (antwort.status === 404) break;                 // gibt es wirklich nicht – nicht nochmal fragen
    } catch {
      // Netz weg oder Zeitlimit – gleich noch einmal versuchen
    }
  }
  return DARF_FEHLEN.test(url);
}

self.addEventListener('install', (ereignis) => {
  ereignis.waitUntil((async () => {
    const speicher = await meinSpeicher();
    const namen = (await caches.keys()).filter((n) => n.startsWith(PREFIX) && n !== SPEICHER).sort().reverse();
    const alte = await Promise.all(namen.map((n) => caches.open(n)));
    const reihe = DATEIEN.map((url, i) => [rang(url), i, url]).sort((a, b) => a[0] - b[0] || a[1] - b[1]).map((x) => x[2]);
    const fehlt = [];
    const arbeiter = Array.from({ length: GLEICHZEITIG }, async () => {
      while (reihe.length) {
        const url = reihe.shift();
        if (!(await lade(speicher, alte, url))) fehlt.push(url);
      }
    });
    await Promise.all(arbeiter);
    // Unvollständig → Installation scheitert, der alte Speicher bleibt (kein skipWaiting: siehe oben)
    if (fehlt.length) throw new Error(`Offline-Speicher unvollständig (${fehlt.length} fehlen, z. B. ${fehlt[0]})`);
  })());
});

self.addEventListener('activate', (ereignis) => {
  ereignis.waitUntil((async () => {
    let hatteAlte = false;
    for (const name of await caches.keys()) {
      if (name === SPEICHER || !eigenerSpeicher(name)) continue;   // fremde Speicher bleiben unangetastet
      if (name.startsWith(PREFIX)) hatteAlte = true;
      await caches.delete(name);
    }
    // Allererste Installation: die gerade laufende Seite gleich übernehmen (sie kam frisch aus dem Netz, es gibt
    // keine ältere Fassung, mit der sich etwas mischen könnte). Bei einem Update nie – dort lädt main.js neu.
    if (!hatteAlte) await self.clients.claim();
  })());
});

// main.js meldet: das Spiel liegt unsichtbar im Hintergrund – jetzt darf die neue Fassung übernehmen.
// Und: das Spiel lädt gerade selbst ({sigo: 'laden', an}) – die Installation wartet so lange.
self.addEventListener('message', (ereignis) => {
  const d = ereignis.data;
  if (d === 'sigo-jetzt') self.skipWaiting();
  else if (d && d.sigo === 'laden') spielLaedtBis = d.an ? Date.now() + PAUSE_MAX * 1000 : 0;
});

const BEREICH = new URL('./', self.registration.scope);
const VERSIONS_DATEI = new URL('sw-dateien.js', BEREICH).pathname;
const STARTSEITE = BEREICH.href;

self.addEventListener('fetch', (ereignis) => {
  const anfrage = ereignis.request;
  if (anfrage.method !== 'GET') return;
  const url = new URL(anfrage.url);
  if (url.origin !== self.location.origin) return;

  // Welche Fassung läuft? (die Seite fragt danach; Updates des Service Workers kommen hier nicht vorbei)
  if (url.pathname === VERSIONS_DATEI) {
    ereignis.respondWith(new Response(`self.SIGO_VERSION = '${VERSION}';\n`, {
      headers: { 'content-type': 'text/javascript; charset=utf-8', 'cache-control': 'no-store' },
    }));
    return;
  }

  // Schlüssel im Speicher: die Adresse ohne ?… und #… (so wurde gespeichert); ein Seitenaufruf (auch mit
  // ?szene=…) bekommt immer die Startseite dieser Fassung
  const schluessel = anfrage.mode === 'navigate' ? STARTSEITE : url.origin + url.pathname;
  ereignis.respondWith((async () => {
    try {
      const gespeichert = await (await meinSpeicher()).match(schluessel);
      if (gespeichert) return gespeichert;
    } catch { /* Speicher nicht lesbar – dann aus dem Netz */ }
    try {
      return await fetch(anfrage);
    } catch {
      return new Response('', { status: 504, statusText: 'offline' });
    }
  })());
});
