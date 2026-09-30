// Alle Texte und Namen je Sprache. Neue Sprache = neuer Block mit denselben Schlüsseln.
// Bei Namen: [Name, optionales Lautwort].
export const LANGUAGES = {
  de: {
    label: 'Deutsch',
    speechLang: 'de-DE',
    strings: {
      workshop: 'Werkstatt',
      draw: 'Strecke malen',
      drive: 'Los geht\'s!',
      trackDone: 'Die Strecke ist fertig!',
      tired: 'Der Zug ist müde. Er fährt jetzt schlafen. Bis später!',
      bye: 'Tschüss!',
      full: 'Alles voll!',
      tabParts: 'Wagen',
      tabPaint: 'Farben',
      tabDecor: 'Schmuck',
      tabCargo: 'Mitfahrer',
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
      dampf: ['Dampflok'], elok: ['E-Lok'],
      personen: ['Personenwagen'], gueter: ['Güterwagen'], tier: ['Tierwagen'],
      flach: ['Flachwagen'], tank: ['Tankwagen'],
      rot: ['Rot'], orange: ['Orange'], gelb: ['Gelb'], gruen: ['Grün'], blau: ['Blau'],
      lila: ['Lila'], rosa: ['Rosa'], weiss: ['Weiß'], schwarz: ['Schwarz'],
      stern: ['Stern'], herz: ['Herz'], blume: ['Blume'], lampe: ['Lampe'],
      fahne: ['Fähnchen'], ballon: ['Luftballon'],
      kuh: ['Kuh', 'Muuh'], schwein: ['Schwein', 'Grunz, grunz'], schaf: ['Schaf', 'Määh'],
      hund: ['Hund', 'Wau wau'], katze: ['Katze', 'Miau'], ente: ['Ente', 'Quak, quak'],
      teddy: ['Teddy'], kind: ['Kind', 'Juhu!'], oma: ['Oma', 'Hallo!'],
      kiste: ['Kiste'], geschenk: ['Geschenk'], apfel: ['Apfel'],
    },
  },
  en: {
    label: 'English',
    speechLang: 'en-US',
    strings: {
      workshop: 'Workshop',
      draw: 'Draw the track',
      drive: 'Let\'s go!',
      trackDone: 'The track is ready!',
      tired: 'The train is tired. It is going to sleep now. See you later!',
      bye: 'Bye bye!',
      full: 'All full!',
      tabParts: 'Cars',
      tabPaint: 'Colours',
      tabDecor: 'Decorations',
      tabCargo: 'Passengers',
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
      dampf: ['Steam engine'], elok: ['Electric engine'],
      personen: ['Passenger car'], gueter: ['Freight car'], tier: ['Animal car'],
      flach: ['Flat car'], tank: ['Tank car'],
      rot: ['Red'], orange: ['Orange'], gelb: ['Yellow'], gruen: ['Green'], blau: ['Blue'],
      lila: ['Purple'], rosa: ['Pink'], weiss: ['White'], schwarz: ['Black'],
      stern: ['Star'], herz: ['Heart'], blume: ['Flower'], lampe: ['Lamp'],
      fahne: ['Flag'], ballon: ['Balloon'],
      kuh: ['Cow', 'Moo'], schwein: ['Pig', 'Oink, oink'], schaf: ['Sheep', 'Baa'],
      hund: ['Dog', 'Woof woof'], katze: ['Cat', 'Meow'], ente: ['Duck', 'Quack, quack'],
      teddy: ['Teddy'], kind: ['Child', 'Yay!'], oma: ['Grandma', 'Hello!'],
      kiste: ['Box'], geschenk: ['Present'], apfel: ['Apple'],
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
