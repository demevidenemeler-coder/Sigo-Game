// Hilfen zum Testen ohne Tablet.
//   ?szene=<id>  startet direkt in einer Szene
//   ?test=1      Testbetrieb (z. B. keine Spielzeit-Begrenzung) und window.__sigo zum Fernsteuern
// Fehler (window.onerror, unhandledrejection, vom Kern gemeldete) werden immer gesammelt.

import { fehlend } from './assets.js';
import { stage } from './stage.js';

const suche = new URLSearchParams(location.search);

/** URL-Parameter */
export const params = {
  szene: suche.get('szene') || null,
  test: suche.get('test') === '1',
};

/** Testbetrieb an? */
export const isTest = params.test;

/** Gesammelte Fehler: [{ text, stack, zeit }] */
export const errors = [];

function textVon(e) {
  if (!e) return '';
  if (e instanceof Error) return e.message;
  if (typeof e === 'string') return e;
  try { return JSON.stringify(e); } catch { return String(e); }
}

/** Fehler melden: Konsole + Liste. */
export function recordError(text, e) {
  const eintrag = { text: e ? `${text}: ${textVon(e)}` : text, stack: e?.stack || '', zeit: performance.now() };
  errors.push(eintrag);
  console.error('[sigo] ' + eintrag.text, e || '');
}

let eingerichtet = false;

/**
 * Fehler-Sammler und window.__sigo einrichten.
 * manager = SceneManager (wird hereingereicht, damit test.js nicht von scene.js abhängt).
 */
export function initTest(manager) {
  if (eingerichtet) return;
  eingerichtet = true;
  window.addEventListener('error', (ev) => {
    errors.push({ text: ev.message || 'Fehler', stack: ev.error?.stack || '', zeit: performance.now() });
  });
  window.addEventListener('unhandledrejection', (ev) => {
    errors.push({ text: 'Promise: ' + textVon(ev.reason), stack: ev.reason?.stack || '', zeit: performance.now() });
  });

  // window.__sigo gibt es immer (schadet nicht), im Testbetrieb ist es zum Fernsteuern gedacht
  window.__sigo = {
    test: params.test,
    ready: manager.ready,
    go: (id, p) => manager.go(id, p),
    get scene() { return manager.current; },
    errors,
    fehlend,
    get fps() { return stage.fps; },
    stage,
  };
}
