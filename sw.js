// Offline-Unterstützung: Mit Internet wird immer die neueste Fassung geladen (und gespeichert),
// ohne Internet die gespeicherte. Neue Dateien in ASSETS eintragen.
const VERSION = 'sigo-v19';
const ASSETS = [
  './',
  'index.html',
  'manifest.webmanifest',
  'css/style.css',
  'vendor/three.module.min.js',
  'vendor/RoundedBoxGeometry.js',
  'vendor/RoomEnvironment.js',
  'js/app.js',
  'js/audio.js',
  'js/catalog.js',
  'js/i18n.js',
  'js/music.js',
  'js/settings.js',
  'js/game/environment.js',
  'js/game/figures.js',
  'js/game/game.js',
  'js/game/lamps.js',
  'js/game/textures.js',
  'js/game/thumbs.js',
  'js/game/trackObjects.js',
  'js/game/features.js',
  'js/game/crossings.js',
  'js/game/tray.js',
  'js/game/track.js',
  'js/game/train.js',
  'js/game/trainModel.js',
  'js/game/world.js',
  'js/game/modes/workshop.js',
  'js/game/modes/draw.js',
  'js/game/modes/drive.js',
  'js/game/modes/wash.js',
  'js/game/foods.js',
  'js/game/feeding.js',
  'js/game/weatherFx.js',
  'js/game/wheelStyles.js',
  'js/game/hint.js',
  'js/game/sideTrain.js',
  'js/game/merge.js',
  'js/game/models.js',
  'js/game/workshopDeco.js',
  'js/game/zones.js',
  'js/game/ambient.js',
  'js/game/beams.js',
  'js/game/discover.js',
  'js/game/village.js',
  'js/game/groundPaint.js',
  'models/kuh.sigm',
  'models/schwein.sigm',
  'models/schaf.sigm',
  'models/hund.sigm',
  'models/katze.sigm',
  'models/ente.sigm',
  'models/pferd.sigm',
  'models/huhn.sigm',
  'models/hahn.sigm',
  'models/hase.sigm',
  'models/frosch.sigm',
  'models/loewe.sigm',
  'models/elefant.sigm',
  'models/giraffe.sigm',
  'models/pinguin.sigm',
  'models/teddy.sigm',
  'models/kind.sigm',
  'models/oma.sigm',
  'models/papa.sigm',
  'models/fahrer.sigm',
  'models/fuchs.sigm',
  'models/igel.sigm',
  'models/eichhoernchen.sigm',
  'models/storch.sigm',
  'models/fisch.sigm',
  'models/maulwurf.sigm',
  'models/reh.sigm',
  'models/eule.sigm',
  'models/schnecke.sigm',
  'models/biber.sigm',
  'js/animalSynth.js',
  'js/recordings.js',
  'js/voiceStudio.js',
  'js/game/bedroom.js',
  'js/game/modes/bed.js',
  'sounds/frosch.mp3',
  'sounds/hahn.mp3',
  'sounds/huhn.mp3',
  'sounds/hund.mp3',
  'sounds/katze.mp3',
  'sounds/kuh.mp3',
  'sounds/schaf.mp3',
  'sounds/schwein.mp3',
  'sounds/voegel.mp3',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET' || !e.request.url.startsWith(self.location.origin)) return;
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(VERSION).then((c) => c.put(e.request, copy));
        }
        return res;
      })
      .catch(() => caches.match(e.request, { ignoreSearch: true })),
  );
});
