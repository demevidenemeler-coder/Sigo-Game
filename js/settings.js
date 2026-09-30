// Einstellungen, Spielzeit, Zug und Strecke werden nur lokal auf dem Gerät gespeichert.

const KEYS = {
  settings: 'sigo.settings.v2',
  session: 'sigo.session.v2',
  train: 'sigo.train.v1',
  track: 'sigo.track.v1',
};

export const DEFAULT_SETTINGS = {
  language: 'de',
  playMinutes: 15,
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
    if (value == null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Speicher nicht verfügbar – App läuft trotzdem, nur ohne Merken
  }
}

export const loadSettings = () => ({ ...DEFAULT_SETTINGS, ...(read(KEYS.settings) ?? {}) });
export const saveSettings = (s) => write(KEYS.settings, s);

export const loadSession = () => ({ playedMs: 0, restUntil: 0, ...(read(KEYS.session) ?? {}) });
export const saveSession = (s) => write(KEYS.session, s);

export const loadTrain = () => read(KEYS.train);
export const saveTrain = (t) => write(KEYS.train, t);

export const loadTrack = () => read(KEYS.track);
export const saveTrack = (points) => write(KEYS.track, points);
