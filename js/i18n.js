// Alle Texte und Namen je Sprache. Neue Sprache = neuer Block mit denselben Schlüsseln.
// Bei Namen: [Name, optionales Lautwort].
export const LANGUAGES = {
  de: {
    label: 'Deutsch',
    speechLang: 'de-DE',
    strings: {
      workshop: 'Werkstatt',
      draw: 'Strecke bauen',
      drive: 'Los geht\'s!',
      trackDone: 'Die Strecke ist fertig!',
      tired: 'Der Zug ist müde. Er fährt jetzt schlafen. Bis später!',
      bye: 'Tschüss!',
      full: 'Alles voll!',
      tabParts: 'Loks und Wagen',
      tabAnimals: 'Tiere',
      tabPassengers: 'Mitfahrer',
      tabBuild: 'Bauen',
      station: 'Bahnhof! Wer steigt ein?',
      fuelEmpty: 'Oh, die Lok hat Hunger! Wir müssen tanken.',
      fuelFull: 'Alles voll! Weiter geht\'s!',
      sparkling: 'Blitzsauber!',
      hopIn: 'Einsteigen!',
      hopOut: 'Aussteigen!',
      tabPaint: 'Farben',
      tabDecor: 'Schmuck',
      music: 'Musik',
      musicVolume: 'Musik-Lautstärke',
      quiet: 'leise',
      medium: 'mittel',
      loud: 'laut',
      settingsTitle: 'Einstellungen für Eltern',
      parentInfo: 'Tipp: Spielt am Anfang zusammen. Fragt nach: „Wer fährt heute mit?“, „Welche Farbe hat die Lok?“ – so wird aus dem Spiel ein Gespräch.',
      language: 'Sprache',
      playMinutes: 'Spielzeit',
      restMinutes: 'Pause nach der Spielzeit',
      minutes: 'Min.',
      unlimited: 'unbegrenzt',
      noRest: 'keine',
      voice: 'Stimme (Dinge benennen)',
      sounds: 'Geräusche',
      speechRate: 'Sprechtempo',
      slow: 'langsam',
      normal: 'normal',
      on: 'an',
      off: 'aus',
      back: 'Zurück zum Spiel',
      newSession: 'Neue Spielzeit starten',
      resetTrain: 'Zug zurücksetzen',
      resetTrack: 'Strecke zurücksetzen',
      restActive: 'Pause läuft bis {time} Uhr.',
      playedToday: 'Gespielt in dieser Spielzeit: {min} Min.',
      voiceOk: 'Stimme gefunden: {name}',
      voiceMissing: 'Keine passende Stimme gefunden. Android: Einstellungen → Sprachausgabe → Sprachdaten für Deutsch installieren.',
      holdHint: 'Zum Öffnen 3 Sekunden gedrückt halten',
    },
    names: {
      dampf: ['Dampflok'], diesel: ['Diesellok'], elok: ['E-Lok'], schnell: ['Schnellzug'],
      personen: ['Personenwagen'], gueter: ['Güterwagen'], tier: ['Tierwagen'], flach: ['Flachwagen'],
      zirkus: ['Zirkuswagen'], schluss: ['Schlusswagen'], tank: ['Tankwagen'], holz: ['Holzwagen'],
      kohle: ['Kohlewagen'], auto: ['Autotransporter'], kran: ['Kranwagen'],
      rot: ['Rot'], orange: ['Orange'], gelb: ['Gelb'], gruen: ['Grün'], blau: ['Blau'],
      lila: ['Lila'], rosa: ['Rosa'], weiss: ['Weiß'], schwarz: ['Schwarz'], braun: ['Braun'],
      gesicht: ['Gesicht'], stern: ['Stern'], herz: ['Herz'], blume: ['Blume'], lampe: ['Lampe'],
      lichterkette: ['Lichterkette'], glocke: ['Glocke'], fahne: ['Fähnchen'], ballon: ['Luftballon'],
      regenbogen: ['Regenbogen'],
      kuh: ['Kuh', 'Muuh'], schwein: ['Schwein', 'Grunz, grunz'], schaf: ['Schaf', 'Määh'],
      pferd: ['Pferd'], hund: ['Hund', 'Wau wau'], katze: ['Katze', 'Miau'], huhn: ['Huhn'],
      hahn: ['Hahn', 'Kikeriki'], ente: ['Ente', 'Quak, quak'], hase: ['Hase'], frosch: ['Frosch', 'Quak'],
      loewe: ['Löwe'], elefant: ['Elefant', 'Törööö'], giraffe: ['Giraffe'], pinguin: ['Pinguin'],
      kind: ['Kind', 'Juhu!'], papa: ['Papa', 'Hallo!'], oma: ['Oma', 'Hallo!'], teddy: ['Teddy'],
      ball: ['Ball'], kiste: ['Kiste'], geschenk: ['Geschenk'], milch: ['Milchkanne'], apfel: ['Apfel'],
      bahnhof: ['Bahnhof'], tunnel: ['Tunnel'], bruecke: ['Brücke'], waschanlage: ['Waschanlage'],
      tankstelle: ['Tankstelle'], uebergang: ['Bahnübergang'],
      tag: ['Tag'], nacht: ['Nacht'], sonne: ['Sonne'], regen: ['Regen'], schnee: ['Schnee'],
    },
  },
  en: {
    label: 'English',
    speechLang: 'en-US',
    strings: {
      workshop: 'Workshop',
      draw: 'Build the track',
      drive: 'Let\'s go!',
      trackDone: 'The track is ready!',
      tired: 'The train is tired. It is going to sleep now. See you later!',
      bye: 'Bye bye!',
      full: 'All full!',
      tabParts: 'Engines and cars',
      tabAnimals: 'Animals',
      tabPassengers: 'Passengers',
      tabBuild: 'Build',
      station: 'Station! Who is getting on?',
      fuelEmpty: 'Oh, the engine is hungry! We need to fill up.',
      fuelFull: 'All full! Off we go!',
      sparkling: 'Sparkling clean!',
      hopIn: 'All aboard!',
      hopOut: 'Getting off!',
      tabPaint: 'Colours',
      tabDecor: 'Decorations',
      music: 'Music',
      musicVolume: 'Music volume',
      quiet: 'quiet',
      medium: 'medium',
      loud: 'loud',
      settingsTitle: 'Parent settings',
      parentInfo: 'Tip: Play together at first. Ask: “Who is riding today?”, “What colour is the engine?” – that turns the game into a conversation.',
      language: 'Language',
      playMinutes: 'Play time',
      restMinutes: 'Break after play time',
      minutes: 'min',
      unlimited: 'unlimited',
      noRest: 'none',
      voice: 'Voice (naming things)',
      sounds: 'Sounds',
      speechRate: 'Speech speed',
      slow: 'slow',
      normal: 'normal',
      on: 'on',
      off: 'off',
      back: 'Back to the game',
      newSession: 'Start new play time',
      resetTrain: 'Reset train',
      resetTrack: 'Reset track',
      restActive: 'Break until {time}.',
      playedToday: 'Played this session: {min} min',
      voiceOk: 'Voice found: {name}',
      voiceMissing: 'No matching voice found. Android: Settings → Text-to-speech → install voice data.',
      holdHint: 'Hold for 3 seconds to open',
    },
    names: {
      dampf: ['Steam engine'], diesel: ['Diesel engine'], elok: ['Electric engine'], schnell: ['Express train'],
      personen: ['Passenger car'], gueter: ['Freight car'], tier: ['Animal car'], flach: ['Flat car'],
      zirkus: ['Circus car'], schluss: ['Caboose'], tank: ['Tank car'], holz: ['Log car'],
      kohle: ['Coal car'], auto: ['Car carrier'], kran: ['Crane car'],
      rot: ['Red'], orange: ['Orange'], gelb: ['Yellow'], gruen: ['Green'], blau: ['Blue'],
      lila: ['Purple'], rosa: ['Pink'], weiss: ['White'], schwarz: ['Black'], braun: ['Brown'],
      gesicht: ['Face'], stern: ['Star'], herz: ['Heart'], blume: ['Flower'], lampe: ['Lamp'],
      lichterkette: ['Fairy lights'], glocke: ['Bell'], fahne: ['Flag'], ballon: ['Balloon'],
      regenbogen: ['Rainbow'],
      kuh: ['Cow', 'Moo'], schwein: ['Pig', 'Oink, oink'], schaf: ['Sheep', 'Baa'],
      pferd: ['Horse'], hund: ['Dog', 'Woof woof'], katze: ['Cat', 'Meow'], huhn: ['Chicken'],
      hahn: ['Rooster', 'Cock-a-doodle-doo'], ente: ['Duck', 'Quack, quack'], hase: ['Bunny'], frosch: ['Frog', 'Ribbit'],
      loewe: ['Lion'], elefant: ['Elephant', 'Toot'], giraffe: ['Giraffe'], pinguin: ['Penguin'],
      kind: ['Child', 'Yay!'], papa: ['Daddy', 'Hello!'], oma: ['Grandma', 'Hello!'], teddy: ['Teddy'],
      ball: ['Ball'], kiste: ['Box'], geschenk: ['Present'], milch: ['Milk can'], apfel: ['Apple'],
      bahnhof: ['Station'], tunnel: ['Tunnel'], bruecke: ['Bridge'], waschanlage: ['Train wash'],
      tankstelle: ['Filling station'], uebergang: ['Level crossing'],
      tag: ['Day'], nacht: ['Night'], sonne: ['Sunshine'], regen: ['Rain'], schnee: ['Snow'],
    },
  },
};

let current = 'de';

export function setLanguage(code) {
  current = LANGUAGES[code] ? code : 'de';
  document.documentElement.lang = current;
}

export function lang() {
  return current;
}

export function speechLang() {
  return LANGUAGES[current].speechLang;
}

export function t(key, vars = {}) {
  const s = LANGUAGES[current].strings[key] ?? LANGUAGES.de.strings[key] ?? key;
  return s.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '');
}

export function nameOf(id) {
  return (LANGUAGES[current].names[id] ?? LANGUAGES.de.names[id] ?? [id])[0];
}

export function soundWordOf(id) {
  return (LANGUAGES[current].names[id] ?? LANGUAGES.de.names[id] ?? [])[1];
}
