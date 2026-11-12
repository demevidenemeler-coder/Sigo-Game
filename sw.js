// Offline-Speicher für Sigo (Service Worker).
//
// - Die Liste aller Spieldateien, ihre Prüfsummen und der Versions-Stempel stehen in sw-dateien.js (erzeugt von
//   tools/sw_liste.py).
// - Installieren: alle Dateien in einen Speicher mit Versionsnamen legen. Was sich seit der vorigen Fassung nicht
//   geändert hat (gleiche Prüfsumme), wird aus deren Speicher übernommen – aus dem Netz kommt nur Neues. Fehlt auch
//   nur eine Datei (wackliges WLAN), scheitert die Installation: Der alte, vollständige Speicher bleibt in Gebrauch,
//   und der Browser versucht es beim nächsten Start erneut. Schon geladene Dateien bleiben dabei liegen.
// - Eine neue Fassung übernimmt NIE mitten im Spiel: Sie wartet, bis das Spiel neu startet – oder bis main.js ihr
//   Bescheid gibt ('sigo-jetzt', nur wenn das Spiel gerade unsichtbar im Hintergrund liegt; danach lädt die Seite
//   neu). So kommen alter Spielkern und neue Szenen nie zusammen.
// - Aktivieren: nur die EIGENEN alten Speicher löschen (sigo2-… und den des alten 3D-Spiels, sigo-v…). Andere
//   Web-Apps auf derselben Adresse (z. B. <name>.github.io) behalten ihre Speicher.
// - Abrufen: streng aus dem Speicher dieser Fassung (schnell, auch ohne Internet). Nur was dort fehlt (nicht in
//   der Liste), kommt aus dem Netz – ohne es zu speichern, damit sich keine Fassungen mischen. sw-dateien.js
//   beantwortet der Service Worker selbst mit seiner Fassung (Versions-Zeile im Eltern-Bereich, auch ohne Netz).

importScripts('sw-dateien.js');

const VERSION = self.SIGO_VERSION || 'ohne-liste';
const PREFIX = 'sigo2-';
const SPEICHER = PREFIX + VERSION;
const DATEIEN = self.SIGO_DATEIEN || ['./', 'index.html'];
const PRUEF = self.SIGO_PRUEF || {};                 // Datei → kurze Prüfsumme des Inhalts
const PRUEF_KOPF = 'x-sigo-pruef';                   // so steht die Prüfsumme an der gespeicherten Antwort
const ALTES_SPIEL = /^sigo-v\d+$/;                   // Speicher des alten 3D-Spiels
const GLEICHZEITIG = 6;
const VERSUCHE = 2;
// Diese Dateien dürfen fehlen (Stimm-Aufnahmen kommen nach und nach; ohne sie bleibt es nur still)
const DARF_FEHLEN = /^assets\/stimme\//;

const eigenerSpeicher = (name) => name.startsWith(PREFIX) || ALTES_SPIEL.test(name);

// Antwort mit der Prüfsumme als Kopfzeile (eine neue Antwort ist außerdem nie „umgeleitet" – wichtig für './')
function mitPruefsumme(antwort, pruef) {
  const kopf = new Headers(antwort.headers);
  if (pruef) kopf.set(PRUEF_KOPF, pruef);
  return new Response(antwort.body, { status: antwort.status, statusText: antwort.statusText, headers: kopf });
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
    try {
      // 'no-cache': beim Server nachfragen (immer die neueste Datei), aber eine eben geladene, unveränderte Datei
      // nicht noch einmal ganz übertragen
      const antwort = await fetch(new Request(url, { cache: 'no-cache' }));
      if (antwort.ok) {
        await speicher.put(url, mitPruefsumme(antwort, pruef));
        return true;
      }
      if (antwort.status === 404) break;                 // gibt es wirklich nicht – nicht nochmal fragen
    } catch {
      // Netz weg – gleich noch einmal versuchen
    }
  }
  return DARF_FEHLEN.test(url);
}

self.addEventListener('install', (ereignis) => {
  ereignis.waitUntil((async () => {
    const speicher = await caches.open(SPEICHER);
    const namen = (await caches.keys()).filter((n) => n.startsWith(PREFIX) && n !== SPEICHER).sort().reverse();
    const alte = await Promise.all(namen.map((n) => caches.open(n)));
    const reihe = [...DATEIEN];
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

// main.js meldet: das Spiel liegt unsichtbar im Hintergrund – jetzt darf die neue Fassung übernehmen
self.addEventListener('message', (ereignis) => {
  if (ereignis.data === 'sigo-jetzt') self.skipWaiting();
});

const VERSIONS_DATEI = new URL('sw-dateien.js', self.registration.scope).pathname;

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

  ereignis.respondWith((async () => {
    const speicher = await caches.open(SPEICHER);
    // Seitenaufruf (auch mit ?szene=…): immer die Startseite dieser Fassung
    const schluessel = anfrage.mode === 'navigate' ? new URL('./', self.registration.scope).href : anfrage;
    const gespeichert = await speicher.match(schluessel, { ignoreSearch: true });
    if (gespeichert) return gespeichert;
    try {
      return await fetch(anfrage);
    } catch {
      return new Response('', { status: 504, statusText: 'offline' });
    }
  })());
});
