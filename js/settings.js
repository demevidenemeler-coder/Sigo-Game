// Einstellungen und Spielzeit werden nur lokal auf dem Gerät gespeichert.

const SETTINGS_KEY = 'sigo.settings.v1';
const SESSION_KEY = 'sigo.session.v1';

export const DEFAULT_SETTINGS = {
  language: 'de',
  categories: { tiere: true, fahrzeuge: true, musik: false },
  itemsPerRound: 4,
  homesPerRound: 2,
  roundsPerSession: 5,
  restMinutes: 30,
  voice: true,
  sounds: true,
  speechRate: 0.85,
};

function read(key) {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? null;
  } catch {
    return null;
  }
}

function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Speicher nicht verfügbar – App läuft trotzdem, nur ohne Merken
  }
}

export function loadSettings() {
  const s = read(SETTINGS_KEY) ?? {};
  return {
    ...DEFAULT_SETTINGS,
    ...s,
    categories: { ...DEFAULT_SETTINGS.categories, ...(s.categories ?? {}) },
  };
}

export function saveSettings(settings) {
  write(SETTINGS_KEY, settings);
}

export function loadSession() {
  return { roundsDone: 0, restUntil: 0, ...(read(SESSION_KEY) ?? {}) };
}

export function saveSession(session) {
  write(SESSION_KEY, session);
}
