// Alle Texte der App. Eine neue Sprache = neuer Block hier + Namen in items.js.
export const LANGUAGES = {
  de: {
    label: 'Deutsch',
    speechLang: 'de-DE',
    strings: {
      actSort: 'Aufräumen',
      allSorted: 'Alles aufgeräumt!',
      restSpeech: 'Fertig für heute. Bis später!',
      settingsTitle: 'Einstellungen für Eltern',
      parentInfo: 'Tipp: Setzt euch am Anfang gemeinsam hin. Benennt die Dinge zusammen – das Tablet ersetzt nicht das Spielen mit echten Gegenständen.',
      language: 'Sprache',
      topics: 'Themen',
      topicsHint: 'Mindestens zwei Themen müssen aktiv sein.',
      itemsPerRound: 'Dinge pro Runde',
      homesPerRound: 'Körbe pro Runde',
      roundsPerSession: 'Runden pro Spielzeit',
      restMinutes: 'Pause nach der Spielzeit',
      minutes: 'Min.',
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
      restActive: 'Pause läuft bis {time} Uhr.',
      voiceOk: 'Stimme gefunden: {name}',
      voiceMissing: 'Keine passende Stimme gefunden. Android: Einstellungen → Sprachausgabe → Sprachdaten für Deutsch installieren.',
      holdHint: 'Zum Öffnen 3 Sekunden gedrückt halten',
    },
    categories: { tiere: 'Tiere', fahrzeuge: 'Fahrzeuge', musik: 'Musik' },
  },
  en: {
    label: 'English',
    speechLang: 'en-US',
    strings: {
      actSort: 'Tidy up',
      allSorted: 'All tidied up!',
      restSpeech: 'All done for today. See you later!',
      settingsTitle: 'Parent settings',
      parentInfo: 'Tip: Sit down together at first and name the things together – the tablet does not replace playing with real objects.',
      language: 'Language',
      topics: 'Topics',
      topicsHint: 'At least two topics must be active.',
      itemsPerRound: 'Things per round',
      homesPerRound: 'Baskets per round',
      roundsPerSession: 'Rounds per play time',
      restMinutes: 'Break after play time',
      minutes: 'min',
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
      restActive: 'Break until {time}.',
      voiceOk: 'Voice found: {name}',
      voiceMissing: 'No matching voice found. Android: Settings → Text-to-speech → install voice data.',
      holdHint: 'Hold for 3 seconds to open',
    },
    categories: { tiere: 'Animals', fahrzeuge: 'Vehicles', musik: 'Music' },
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

export function categoryName(id) {
  return LANGUAGES[current].categories[id] ?? id;
}
