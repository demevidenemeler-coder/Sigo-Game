// Eltern-Bereich: dezentes Zahnrad unten rechts (3 Sekunden HALTEN öffnet) und eine HTML-Ebene über dem Spiel.
//
//   import { zahnrad, oeffneEltern, elternOffen } from '../gemeinsam/eltern.js';
//   zahnrad(szene);        // in szene.hud unten rechts (main.js setzt es auf 'start' und 'karte', die
//                          // Schlafen-Szene im Ruhe-Bild)
//
// Kinder sollen nicht hinein – drei Hürden:
// 1. Das Zahnrad liegt deutlich vom Rand weg (ein Daumen, der das Tablet festhält, trifft es nicht). Kurzes Tippen
//    lässt es nur wackeln; beim Halten füllt sich langsam ein Ring, erst nach 3 s öffnet sich der Bereich.
//    Gezählt wird nur, solange genau EIN kleiner Finger auf dem Bildschirm liegt (kein Handballen, keine flache
//    Hand, kein zweiter Finger) – sonst beginnt der Ring von vorn.
//    Liegt ein zweiter Finger auf (oft der Daumen der Hand, die das Tablet hält), färbt sich die Ring-Spur weich
//    rötlich – ein stilles Zeichen für Erwachsene, dass gerade nicht gezählt wird.
// 2. Danach eine kleine Lese-Aufgabe für Erwachsene: „Tippe erst auf drei, dann auf sieben" unter neun Ziffern
//    (Raten trifft nur mit 1/72). Ein falscher Tipp, ein Tipp neben die Karte oder 30 s ohne Eingabe führen zurück
//    ins Spiel (das Kind sitzt nie fest). Nach einem falschen Tipp ruht das Zahnrad still: erst 1 Minute, beim
//    nächsten Fehler 5, dann 15 Minuten (der Zähler beginnt nach einer richtigen Lösung oder 6 Stunden neu).
// 3. Was die Spielzeit lockert (Grenze aufheben/erhöhen, „Noch 10 Minuten", „Spielzeit zurücksetzen") und was
//    etwas löscht, fragt noch einmal nach.
// Solange der Bereich offen ist, steht das Spiel (kein Bild-Takt, keine Eingaben, die Spielzeit zählt nicht);
// Musik und Geräusche bleiben hörbar, damit man die Regler ausprobieren kann. Liegt der Bereich 3 Minuten
// unberührt offen, schließt er sich von selbst.
//
// Inhalt: Lautstärke Musik / Geräusche / Stimme, „Stimme erklärt bei jedem Besuch", Spielzeit pro Tag mit Anzeige,
// „Noch 10 Minuten", „Spielzeit zurücksetzen", „Sätze wieder sprechen", „Sticker-Album leeren" und „Zug
// zurücksetzen", Vollbild, Versions-Zeile, „Schließen".

import {
  stage, tex, hasTex, hold, fx, sfx, SceneManager, setVolumes, audioState, setInputLocked, cancelAllFingers, store,
  pointerCount, resetSpoken, PIXI,
} from '../engine/index.js';
import { spielzeit, GRENZEN } from './spielzeit.js';

const HALTEN = 3;          // Sekunden
const GROESSE = 150;       // Zahnrad (Einheiten)
const ABSTAND = 200;       // Mitte des Zahnrads vom rechten/unteren Rand
const TREFF_R = 100;       // Halte-Fläche: Kreis um die Mitte (reicht bis 100 Einheiten an den Rand heran)
const RING_R = 92;
const TOR_ZEIT = 30;       // s: so lange wartet die Aufgabe für Erwachsene, dann geht es zurück ins Spiel
const OFFEN_ZEIT = 180;    // s: so lange bleibt der Bereich unberührt offen
const SPERREN = [60, 300, 900];   // s: so lange ruht das Zahnrad nach dem 1., 2., 3. (und jedem weiteren) Fehler
const SPERRE_VERGESSEN = 6 * 3600; // s: so lange nach dem letzten Fehler beginnt der Zähler neu
const FEHLER_ZEIGEN = 1.6;  // s: so lange steht nach einem falschen Tipp der Hinweis da, bevor es zurück ins Spiel geht

// ---------------------------------------------------------------- Sperre nach falschen Tipps

// { n: Fehler in Folge, letzter: Zeitpunkt (ms), bis: gesperrt bis (ms) } – im store, damit auch ein Neustart nicht hilft
function sperre() {
  const s = store.get('eltern.sperre', null);
  const leer = { n: 0, letzter: 0, bis: 0 };
  if (!s || typeof s !== 'object') return leer;
  const jetzt = Date.now();
  // Uhr zurückgestellt (bis liegt weit in der Zukunft) oder lange her: neu beginnen
  if (!(Number(s.letzter) <= jetzt) || jetzt - Number(s.letzter) > SPERRE_VERGESSEN * 1000) return leer;
  return { n: Number(s.n) || 0, letzter: Number(s.letzter) || 0, bis: Math.min(Number(s.bis) || 0, jetzt + SPERREN[SPERREN.length - 1] * 1000) };
}

/** Ruht das Zahnrad gerade (nach einem falschen Tipp)? */
export function zahnradGesperrt() {
  return sperre().bis > Date.now();
}

// Ein Fehler: Sperre wächst. → Sekunden der neuen Sperre
function merkeFehler() {
  const s = sperre();
  const n = s.n + 1;
  const sek = SPERREN[Math.min(n, SPERREN.length) - 1];
  const jetzt = Date.now();
  store.set('eltern.sperre', { n, letzter: jetzt, bis: jetzt + sek * 1000 });
  return sek;
}

function loeseSperre() {
  store.remove('eltern.sperre');
}

// ---------------------------------------------------------------- Zahnrad (im Spiel)

function zeichneErsatz(g) {
  // Zahnrad ohne Bild: acht runde Zähne um eine Scheibe
  for (let i = 0; i < 8; i++) {
    const w = (i / 8) * Math.PI * 2;
    g.circle(Math.cos(w) * 58, Math.sin(w) * 58, 18).fill(0x8a9bb0);
  }
  g.circle(0, 0, 60).fill(0x8a9bb0);
  g.circle(0, 0, 22).fill(0xf4ecdf);
}

/** Zahnrad unten rechts in szene.hud. → Container */
export function zahnrad(szene) {
  if (!szene || !szene.hud || szene.hud.destroyed) return null;
  const c = new PIXI.Container({ label: 'zahnrad' });
  c.zIndex = 9000;
  let bild;
  if (hasTex('common/icon_zahnrad')) {
    bild = new PIXI.Sprite(tex('common/icon_zahnrad'));
    bild.anchor.set(0.5);
    bild.scale.set(GROESSE / Math.max(bild.texture.width, bild.texture.height));
  } else {
    bild = new PIXI.Graphics();
    zeichneErsatz(bild);
    bild.scale.set(GROESSE / 156);
  }
  bild.alpha = 0.48;
  const spur = new PIXI.Graphics().circle(0, 0, RING_R).stroke({ width: 14, color: 0xffffff, alpha: 0.35 });
  spur.alpha = 0;
  // zweite Spur in einem warmen Rot: liegt mehr als ein Finger auf, blendet sie weich über die weiße (0,5 s)
  const spurMehr = new PIXI.Graphics().circle(0, 0, RING_R).stroke({ width: 14, color: 0xe58a6a, alpha: 0.75 });
  spurMehr.alpha = 0;
  const ring = new PIXI.Graphics();
  c.addChild(spur, spurMehr, ring, bild);
  szene.hud.addChild(c);

  const setze = () => c.position.set(stage.W - ABSTAND, stage.H - ABSTAND);
  setze();
  const ab = stage.on('resize', () => { if (!c.destroyed) setze(); });
  c.once('destroyed', ab);

  let p = 0;          // Füllstand 0…1
  let zeit = 0;       // so lange liegt schon genau ein kleiner Finger auf (s)
  let rueck = null;   // Tween, der den Ring zurückfahren lässt
  let mehr = false;   // liegt gerade mehr als ein (kleiner) Finger auf?
  let gesperrt = false; // ruht das Zahnrad (nach einem falschen Tipp)?
  const zeigeMehr = (an) => {
    if (an === mehr) return;
    mehr = an;
    szene.tween(spurMehr, { alpha: an ? 1 : 0 }, 0.5, { ease: 'sineInOut' });
  };
  const zeichne = () => {
    ring.clear();
    if (p <= 0.001) return;
    const a = -Math.PI / 2;
    const b = a + Math.PI * 2 * Math.min(1, p);
    ring.moveTo(Math.cos(a) * RING_R, Math.sin(a) * RING_R).arc(0, 0, RING_R, a, b)
      .stroke({ width: 14, color: 0xfff1cf, alpha: 0.95, cap: 'round' });
  };

  hold(c, {
    hitArea: new PIXI.Circle(0, 0, TREFF_R),
    onStart: () => {
      rueck?.kill();
      rueck = null;
      zeit = 0;
      // Nach einem falschen Tipp ruht das Zahnrad still: es wackelt nur, kein Ring, keine Aufgabe
      gesperrt = zahnradGesperrt();
      if (gesperrt) return;
      szene.tween(spur, { alpha: 1 }, 0.3, { ease: 'sineInOut' });
      szene.tween(bild, { alpha: 0.75 }, 0.3, { ease: 'sineInOut' });
    },
    onTick: (dt) => {
      if (p >= 1 || gesperrt) return;
      // Nur ein einzelner kleiner Finger zählt: Handballen, flache Hand oder ein zweiter Finger → von vorn
      if (pointerCount({ gross: true }) === 1) {
        zeit += dt;
        bild.rotation += dt * 0.6;
        zeigeMehr(false);
      } else {
        zeit = 0;
        zeigeMehr(true);
      }
      p = Math.min(1, zeit / HALTEN);
      zeichne();
      if (p >= 1) oeffneEltern();
    },
    onEnd: (ctx) => {
      if (ctx.time < 0.35 || gesperrt) fx.wobble(c, 0.1);
      zeigeMehr(false);
      if (gesperrt) return;
      const proxy = { p };
      rueck = szene.tween(proxy, { p: 0 }, 0.4, { ease: 'sineInOut', onUpdate: () => { p = proxy.p; zeichne(); } });
      szene.tween(spur, { alpha: 0 }, 0.4, { ease: 'sineInOut' });
      szene.tween(bild, { alpha: 0.48 }, 0.4, { ease: 'sineInOut' });
    },
  });
  return c;
}

// ---------------------------------------------------------------- HTML-Ebene

const CSS = `
#eltern { position: fixed; inset: 0; z-index: 50; display: flex; align-items: center; justify-content: center;
  background: rgba(58, 47, 34, 0.32); opacity: 0; transition: opacity 0.9s cubic-bezier(0.3, 0, 0.7, 1);
  pointer-events: none;
  font-family: "Nunito", "Segoe UI", Roboto, "HarmonyOS Sans", system-ui, sans-serif; color: #4a3b2a;
  -webkit-user-select: none; user-select: none; }
#eltern.offen { opacity: 1; pointer-events: auto; }
#eltern * { box-sizing: border-box; }
#eltern .karte { width: min(980px, 94vw); max-height: 94vh; overflow-y: auto; overscroll-behavior: contain;
  touch-action: pan-y; background: #fffaf2; border-radius: 34px; padding: 28px 40px 26px;
  box-shadow: 0 18px 60px rgba(58, 47, 34, 0.3); transform: translateY(14px);
  transition: transform 0.9s cubic-bezier(0.3, 0, 0.7, 1); }
#eltern.offen .karte { transform: none; }
#eltern header { display: flex; align-items: center; justify-content: space-between; gap: 20px; margin-bottom: 6px; }
#eltern h1 { font-size: 34px; margin: 0; font-weight: 800; letter-spacing: 0.01em; }
#eltern h2 { font-size: 21px; margin: 16px 0 6px; font-weight: 800; color: #8a6d4a; text-transform: none; }
#eltern section { border-top: 2px solid #f0e4d2; }
#eltern .zeile { display: flex; align-items: center; gap: 18px; min-height: 58px; }
#eltern .zeile label, #eltern .zeile .name { flex: 0 0 170px; font-size: 22px; font-weight: 700; }
#eltern .zeile .wert { flex: 0 0 70px; text-align: right; font-size: 20px; color: #8a6d4a; font-variant-numeric: tabular-nums; }
#eltern input[type=range] { flex: 1; height: 44px; accent-color: #7cb86a; touch-action: none; }
#eltern button { font: inherit; font-size: 21px; font-weight: 700; color: #4a3b2a; background: #f3e7d4;
  border: none; border-radius: 22px; padding: 14px 24px; min-height: 58px; cursor: pointer;
  transition: background 0.3s ease, transform 0.15s ease; touch-action: manipulation; }
#eltern button:active { transform: scale(0.97); }
#eltern button.haupt { background: #7cb86a; color: #fff; }
#eltern button.gross { font-size: 26px; min-height: 76px; padding: 18px 40px; border-radius: 30px; }
#eltern button.vorsicht { background: #f6dccf; }
#eltern button.ja { background: #d9806a; color: #fff; }
#eltern .knoepfe { display: flex; flex-wrap: wrap; gap: 14px; margin: 6px 0 4px; }
#eltern .wahl { display: flex; flex-wrap: wrap; gap: 10px; }
#eltern .wahl button { min-width: 92px; padding: 12px 18px; }
#eltern .wahl button[aria-pressed=true] { background: #7cb86a; color: #fff; }
#eltern .schalter { position: relative; width: 96px; min-width: 96px; height: 54px; padding: 0; border-radius: 27px; background: #e6dccb; }
#eltern .schalter::after { content: ""; position: absolute; top: 6px; left: 6px; width: 42px; height: 42px; border-radius: 50%;
  background: #fff; box-shadow: 0 2px 6px rgba(0,0,0,0.18); transition: left 0.3s ease; }
#eltern .schalter[aria-pressed=true] { background: #7cb86a; }
#eltern .schalter[aria-pressed=true]::after { left: 48px; }
#eltern .info { font-size: 21px; margin: 10px 0 6px; line-height: 1.4; }
#eltern .info b { font-weight: 800; }
#eltern .frage { display: none; align-items: center; flex-wrap: wrap; gap: 12px; font-size: 20px; font-weight: 700; }
#eltern .gruppe.fragt > .los { display: none; }
#eltern .gruppe.fragt > .frage, #eltern .frage.zeigt { display: flex; }
#eltern .gruppe { display: flex; }
#eltern .erledigt { font-size: 19px; color: #6c9a5c; min-height: 28px; margin-top: 4px; transition: opacity 0.5s ease; }
#eltern footer { margin-top: 20px; padding-top: 14px; border-top: 2px solid #f0e4d2; font-size: 16px; color: #a08a6c;
  display: flex; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
#eltern .tor { text-align: center; }
#eltern .tor p { font-size: 24px; margin: 18px 0 22px; line-height: 1.4; }
#eltern .tor p b { font-size: 28px; }
#eltern .ziffern { display: grid; grid-template-columns: repeat(9, 1fr); gap: 10px; margin: 0 0 28px; }
#eltern .ziffern button { font-size: 30px; min-height: 64px; padding: 8px 0; border-radius: 18px; }
#eltern .ziffern button.gewaehlt { background: #7cb86a; color: #fff; }
#eltern .tor .fehler { font-size: 21px; color: #b0654c; min-height: 30px; margin: -8px 0 18px; }
#eltern .karte:not(.frei) .einst, #eltern .karte.frei .tor { display: none; }
@media (max-width: 700px) { #eltern .zeile label, #eltern .zeile .name { flex-basis: 120px; font-size: 19px; }
  #eltern .ziffern { grid-template-columns: repeat(5, 1fr); } }
`;

const ZAHLWORT = ['', 'eins', 'zwei', 'drei', 'vier', 'fünf', 'sechs', 'sieben', 'acht', 'neun'];

let ebene = null;     // das <div id="eltern">
let karte = null;     // die Karte darin (Klasse 'frei', sobald die Aufgabe gelöst ist)
let offen = false;
let anzeigeTakt = 0;
let fertigTimer = 0;
let ruheTimer = 0;    // schließt den Bereich nach langer Ruhe
let zielZahlen = [];  // die zwei Zahlen der Aufgabe, in dieser Reihenfolge
let getroffen = 0;    // so viele davon sind schon richtig getippt
let fehlerTimer = 0;  // zeigt nach einem falschen Tipp kurz den Hinweis, dann zurück ins Spiel
const el = {};
const nachfragen = []; // alle Nachfrage-Zeilen (beim Öffnen zurücksetzen)

function knopf(text, klasse = '') {
  const b = document.createElement('button');
  b.type = 'button';
  b.textContent = text;
  if (klasse) b.className = klasse;
  return b;
}

// Langes Nichtstun im Bereich: zurück ins Spiel (vor der Aufgabe schon nach 30 s)
function weckeRuheUhr() {
  clearTimeout(ruheTimer);
  if (!offen) return;
  const sek = karte?.classList.contains('frei') ? OFFEN_ZEIT : TOR_ZEIT;
  ruheTimer = setTimeout(schliesseEltern, sek * 1000);
}

function regler(name, schluessel, karteEl) {
  const z = document.createElement('div');
  z.className = 'zeile';
  const id = 'eltern-' + schluessel;
  const l = document.createElement('label');
  l.htmlFor = id;
  l.textContent = name;
  const r = document.createElement('input');
  r.type = 'range';
  r.min = '0';
  r.max = '100';
  r.step = '5';
  r.id = id;
  const w = document.createElement('span');
  w.className = 'wert';
  let probe = 0;
  r.addEventListener('input', () => {
    const v = Number(r.value) / 100;
    setVolumes({ [schluessel]: v });
    w.textContent = r.value + ' %';
    // Geräusche: kurz anspielen, damit man hört, wie laut es ist (höchstens alle 0,3 s)
    if (schluessel === 'geraeusche' && performance.now() - probe > 300) {
      probe = performance.now();
      sfx('common/plopp');
    }
  });
  z.append(l, r, w);
  karteEl.append(z);
  el[schluessel] = { r, w };
}

function schalter(name, karteEl, onClick) {
  const z = document.createElement('div');
  z.className = 'zeile';
  const n = document.createElement('span');
  n.className = 'name';
  n.textContent = name;
  const b = knopf('', 'schalter');
  b.setAttribute('aria-label', name);
  b.addEventListener('click', () => onClick(b));
  z.append(n, b);
  karteEl.append(z);
  return b;
}

// Nachfrage-Zeile: „Wirklich …?  [Ja, …] [Nein]". → { zeile, frage(text, jaText, tun), zu() }
function nachfrageZeile(beiZu = () => {}) {
  const frage = document.createElement('div');
  frage.className = 'frage';
  const t = document.createElement('span');
  const ja = knopf('', 'ja');
  const nein = knopf('Nein');
  frage.append(t, ja, nein);
  let zeit = 0;
  let tun = null;
  const n = {
    zeile: frage,
    frage(text, jaText, fn) {
      t.textContent = text;
      ja.textContent = jaText;
      tun = fn;
      frage.classList.add('zeigt');
      clearTimeout(zeit);
      zeit = setTimeout(n.zu, 8000);
    },
    zu() {
      frage.classList.remove('zeigt');
      clearTimeout(zeit);
      tun = null;
      beiZu();
    },
  };
  nein.addEventListener('click', n.zu);
  ja.addEventListener('click', () => { const fn = tun; n.zu(); fn?.(); });
  nachfragen.push(n);
  return n;
}

// Knopf mit Nachfrage: „Sticker-Album leeren" → „Alle Sticker entfernen?  [Ja, leeren] [Nein]"
function mitNachfrage(text, frageText, jaText, tun) {
  const g = document.createElement('div');
  g.className = 'gruppe';
  const los = knopf(text, 'vorsicht los');
  const n = nachfrageZeile(() => g.classList.remove('fragt'));
  g.append(los, n.zeile);
  los.addEventListener('click', () => {
    g.classList.add('fragt');
    n.frage(frageText, jaText, tun);
  });
  return g;
}

// Bestätigung direkt unter den Knöpfen, die sie ausgelöst haben (wo = 'zeit' | 'spiel'); sie wird ins Bild geholt
function meldeErledigt(text, wo = 'spiel') {
  const zeile = wo === 'zeit' ? el.erledigtZeit : el.erledigt;
  for (const z of [el.erledigt, el.erledigtZeit]) if (z !== zeile) { z.style.opacity = '0'; z.textContent = ''; }
  zeile.textContent = text;
  zeile.style.opacity = '1';
  try { zeile.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); } catch { /* alte Browser: egal */ }
  clearTimeout(fertigTimer);
  fertigTimer = setTimeout(() => { zeile.style.opacity = '0'; }, 3500);
}

function minuten(sek) {
  const m = Math.floor(sek / 60);
  return m === 1 ? '1 Minute' : `${m} Minuten`;
}

function zeigeSpielzeit() {
  if (!ebene) return;
  const g = spielzeit.grenzeMin;
  for (const b of el.wahl) b.setAttribute('aria-pressed', String(Number(b.dataset.min) === g));
  let text = `Heute gespielt: <b>${minuten(spielzeit.heuteSek)}</b>`;
  if (spielzeit.testbetrieb) text += ' · ' + spielzeit.testbetrieb + (spielzeit.aufgebraucht() ? ' (aufgebraucht)' : '');
  else if (spielzeit.aufgebraucht()) text += ' · für heute <b>aufgebraucht</b>';
  else if (g > 0) text += ` · noch <b>${minuten(Math.ceil(spielzeit.restSek / 60) * 60)}</b>`;
  else text += ' · ohne Begrenzung';
  el.info.innerHTML = text;
  el.vollbild.setAttribute('aria-pressed', String(!!document.fullscreenElement));
}

function zeigeTon() {
  const e = audioState.einst;
  for (const s of ['musik', 'geraeusche', 'stimme']) {
    const v = Math.round((e[s] ?? 1) * 100);
    el[s].r.value = String(v);
    el[s].w.textContent = v + ' %';
  }
  el.reden.setAttribute('aria-pressed', String(!!e.redenImmer));
}

async function ladeVersion() {
  // Der Service Worker beantwortet sw-dateien.js mit der Fassung, die gerade läuft (auch ohne Netz);
  // ohne Service Worker kommt die Datei vom Server.
  let v = '';
  try {
    const antwort = await fetch('sw-dateien.js', { cache: 'no-cache' });
    if (antwort.ok) v = ((await antwort.text()).match(/SIGO_VERSION\s*=\s*['"]([^'"]+)['"]/) || [])[1] || '';
  } catch { /* offline ohne Zwischenspeicher */ }
  if (!v) {
    try {
      // Ersatz: der Name des Offline-Speichers trägt die Fassung
      const name = (await caches.keys()).filter((n) => n.startsWith('sigo2-')).sort().pop();
      if (name) v = name.slice(6);
    } catch { /* kein Speicher */ }
  }
  let offline = navigator.serviceWorker?.controller ? 'offline spielbar' : 'Offline-Speicher nicht aktiv';
  try {
    // eine neue Fassung ist fertig geladen und übernimmt, sobald das Spiel im Hintergrund liegt oder neu startet
    const reg = await navigator.serviceWorker?.getRegistration();
    if (reg?.waiting) offline += ' · neue Fassung kommt beim nächsten Start';
  } catch { /* egal */ }
  el.version.textContent = `Sigo 2 · Version ${v || 'Entwicklung'}`;
  el.offline.textContent = offline;
}

/** Vollbild an (und Querformat festhalten, wo der Browser das erlaubt). */
export function vollbildAn() {
  const d = document.documentElement;
  if (document.fullscreenElement || !d.requestFullscreen) return;
  try {
    d.requestFullscreen({ navigationUI: 'hide' })
      .then(() => screen.orientation?.lock?.('landscape'))
      .catch(() => {});
  } catch { /* still schlucken */ }
}

// Aufgabe für Erwachsene: zwei verschiedene Zahlen in fester Reihenfolge (Raten trifft nur mit 1/72)
function neueAufgabe() {
  const a = 1 + Math.floor(Math.random() * 9);
  let b = 1 + Math.floor(Math.random() * 8);
  if (b >= a) b++;
  zielZahlen = [a, b];
  getroffen = 0;
  el.torWort1.textContent = ZAHLWORT[a];
  el.torWort2.textContent = ZAHLWORT[b];
  el.torFehler.textContent = '';
  clearTimeout(fehlerTimer);
  for (const k of el.ziffern) { k.classList.remove('gewaehlt'); k.disabled = false; }
}

// Ein falscher Tipp: kurz sagen, was jetzt gilt (für Erwachsene), dann zurück ins Spiel; das Zahnrad ruht
function falschGetippt() {
  const sek = merkeFehler();
  for (const k of el.ziffern) k.disabled = true;
  const dauer = sek >= 120 ? `${Math.round(sek / 60)} Minuten` : '1 Minute';
  el.torFehler.textContent = `Leider falsch. Das Zahnrad ruht jetzt ${dauer}.`;
  clearTimeout(fehlerTimer);
  fehlerTimer = setTimeout(schliesseEltern, FEHLER_ZEIGEN * 1000);
}

function baueTor(k) {
  const tor = document.createElement('div');
  tor.className = 'tor';
  const h1 = document.createElement('h1');
  h1.textContent = 'Eltern-Bereich';
  const p = document.createElement('p');
  p.append('Für Erwachsene: Tippe erst auf die Zahl ');
  el.torWort1 = document.createElement('b');
  el.torWort2 = document.createElement('b');
  p.append(el.torWort1, ', dann auf die Zahl ', el.torWort2, '.');
  const ziffern = document.createElement('div');
  ziffern.className = 'ziffern';
  el.ziffern = [];
  for (let i = 1; i <= 9; i++) {
    const b = knopf(String(i));
    b.addEventListener('click', () => {
      if (!offen || b.disabled) return;
      if (i !== zielZahlen[getroffen]) {
        falschGetippt(); // falsch getippt: zurück ins Spiel (ein Kind sitzt nie fest), das Zahnrad ruht
        return;
      }
      b.classList.add('gewaehlt');
      getroffen++;
      if (getroffen < zielZahlen.length) return;
      loeseSperre();
      karte.classList.add('frei');
      karte.scrollTop = 0;
      weckeRuheUhr();
    });
    ziffern.append(b);
    el.ziffern.push(b);
  }
  el.torFehler = document.createElement('div');
  el.torFehler.className = 'fehler';
  el.torFehler.setAttribute('role', 'status');
  const zurueck = knopf('Zurück zum Spiel', 'haupt gross');
  zurueck.addEventListener('click', schliesseEltern);
  tor.append(h1, p, ziffern, el.torFehler, zurueck);
  k.append(tor);
}

function baue() {
  const stil = document.createElement('style');
  stil.textContent = CSS;
  document.head.append(stil);

  ebene = document.createElement('div');
  ebene.id = 'eltern';
  ebene.setAttribute('role', 'dialog');
  ebene.setAttribute('aria-modal', 'true');
  ebene.setAttribute('aria-label', 'Eltern-Bereich');
  ebene.setAttribute('aria-hidden', 'true');
  karte = document.createElement('div');
  karte.className = 'karte';
  ebene.append(karte);
  baueTor(karte);

  const k = document.createElement('div');
  k.className = 'einst';
  karte.append(k);

  const kopf = document.createElement('header');
  const h1 = document.createElement('h1');
  h1.textContent = 'Eltern-Bereich';
  const zu = knopf('Schließen', 'haupt gross');
  zu.addEventListener('click', schliesseEltern);
  kopf.append(h1, zu);
  k.append(kopf);

  // Lautstärke
  const ton = document.createElement('section');
  ton.innerHTML = '<h2>Lautstärke</h2>';
  regler('Musik', 'musik', ton);
  regler('Geräusche', 'geraeusche', ton);
  regler('Stimme', 'stimme', ton);
  el.reden = schalter('Stimme erklärt bei jedem Besuch', ton, (b) => {
    const an = b.getAttribute('aria-pressed') !== 'true';
    setVolumes({ redenImmer: an });
    b.setAttribute('aria-pressed', String(an));
  });
  el.reden.parentElement.querySelector('.name').style.flexBasis = 'auto';
  el.reden.parentElement.style.justifyContent = 'space-between';
  const hinweis = document.createElement('p');
  hinweis.className = 'info';
  hinweis.style.fontSize = '18px';
  hinweis.style.color = '#8a6d4a';
  hinweis.textContent = 'Sonst erklärt die Stimme jeden Ort einmal am Tag.';
  ton.append(hinweis);
  k.append(ton);

  // Spielzeit
  const zeit = document.createElement('section');
  zeit.innerHTML = '<h2>Spielzeit pro Tag</h2>';
  const wahl = document.createElement('div');
  wahl.className = 'wahl';
  const wahlFrage = nachfrageZeile();
  el.wahl = GRENZEN.map((m) => {
    const b = knopf(m === 0 ? 'Aus' : `${m} Min.`);
    b.dataset.min = String(m);
    b.addEventListener('click', () => {
      const jetzt = spielzeit.grenzeMin;
      if (m === jetzt) return;
      const setze = () => { spielzeit.setzeGrenze(m); zeigeSpielzeit(); };
      // strenger: sofort; lockerer (aus oder mehr Minuten): mit Nachfrage
      const lockerer = jetzt > 0 && (m === 0 || m > jetzt);
      if (!lockerer) { wahlFrage.zu(); setze(); return; }
      wahlFrage.frage(m === 0 ? 'Spielzeit-Grenze ausschalten?' : `Auf ${m} Minuten erhöhen?`,
        m === 0 ? 'Ja, ausschalten' : 'Ja, erhöhen', setze);
    });
    wahl.append(b);
    return b;
  });
  zeit.append(wahl, wahlFrage.zeile);
  el.info = document.createElement('p');
  el.info.className = 'info';
  zeit.append(el.info);
  const zk = document.createElement('div');
  zk.className = 'knoepfe';
  const zehn = mitNachfrage('Noch 10 Minuten', '10 Minuten dazugeben?', 'Ja, 10 Minuten', () => {
    spielzeit.nochZehn();
    zeigeSpielzeit();
    meldeErledigt('Noch 10 Minuten Spielzeit.', 'zeit');
  });
  const null0 = mitNachfrage('Spielzeit zurücksetzen', 'Heute wieder bei 0 beginnen?', 'Ja, zurücksetzen', () => {
    spielzeit.zuruecksetzen();
    zeigeSpielzeit();
    meldeErledigt('Die Spielzeit für heute beginnt wieder bei 0.', 'zeit');
  });
  zk.append(zehn, null0);
  zeit.append(zk);
  el.erledigtZeit = document.createElement('div');
  el.erledigtZeit.className = 'erledigt';
  el.erledigtZeit.setAttribute('role', 'status');
  zeit.append(el.erledigtZeit);
  k.append(zeit);

  // Spiel
  const spiel = document.createElement('section');
  spiel.innerHTML = '<h2>Spiel</h2>';
  el.vollbild = schalter('Vollbild', spiel, () => {
    if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    else vollbildAn();
  });
  el.vollbild.parentElement.style.justifyContent = 'space-between';
  el.vollbild.parentElement.querySelector('.name').style.flexBasis = 'auto';
  document.addEventListener('fullscreenchange', () => {
    el.vollbild.setAttribute('aria-pressed', String(!!document.fullscreenElement));
  });
  const sk = document.createElement('div');
  sk.className = 'knoepfe';
  const saetze = knopf('Sätze wieder sprechen', 'vorsicht');
  saetze.addEventListener('click', () => {
    resetSpoken();
    meldeErledigt('Die Stimme erklärt alles wieder wie beim ersten Mal.');
  });
  const album = mitNachfrage('Sticker-Album leeren', 'Alle Sticker entfernen?', 'Ja, leeren', () => {
    store.remove('sticker');
    store.remove('album.gesehen');   // sonst gälten neu verdiente Sticker nicht als neu (kein Einkleben)
    store.set('album.sterne', 0);
    meldeErledigt('Das Sticker-Album ist leer.');
  });
  const zug = mitNachfrage('Zug zurücksetzen', 'Den eigenen Zug zurücksetzen?', 'Ja, zurücksetzen', () => {
    store.remove('zug');
    meldeErledigt('Der Zug ist wieder wie am Anfang.');
  });
  sk.append(saetze, album, zug);
  spiel.append(sk);
  el.erledigt = document.createElement('div');
  el.erledigt.className = 'erledigt';
  el.erledigt.setAttribute('role', 'status');
  spiel.append(el.erledigt);
  k.append(spiel);

  const fuss = document.createElement('footer');
  el.version = document.createElement('span');
  el.offline = document.createElement('span');
  fuss.append(el.version, el.offline);
  k.append(fuss);

  // Jede Berührung im Bereich hält ihn offen; ein Tipp neben die Karte führt vor der Aufgabe zurück ins Spiel
  // (danach tut er nichts, damit Eltern nicht versehentlich schließen). Escape schließt am Rechner.
  ebene.addEventListener('pointerdown', (e) => {
    weckeRuheUhr();
    if (e.target === ebene && !karte.classList.contains('frei')) schliesseEltern();
  });
  karte.addEventListener('scroll', weckeRuheUhr, { passive: true });
  document.addEventListener('keydown', (e) => { if (offen && e.key === 'Escape') schliesseEltern(); });
  document.body.append(ebene);
}

/** Eltern-Bereich öffnen (das Spiel steht still). Zuerst kommt die Aufgabe für Erwachsene. */
export function oeffneEltern() {
  if (offen) return;
  if (!ebene) baue();
  offen = true;
  cancelAllFingers();
  setInputLocked(true);
  spielzeit.pause(true);
  for (const n of nachfragen) n.zu();
  karte.classList.remove('frei');
  neueAufgabe();
  el.erledigt.style.opacity = '0';
  el.erledigtZeit.style.opacity = '0';
  zeigeTon();
  zeigeSpielzeit();
  ladeVersion();
  clearInterval(anzeigeTakt);
  anzeigeTakt = setInterval(zeigeSpielzeit, 1000);
  weckeRuheUhr();
  karte.scrollTop = 0;
  ebene.setAttribute('aria-hidden', 'false');
  // erst einblenden, dann das Bild anhalten (das letzte Bild bleibt unter dem Schleier stehen)
  requestAnimationFrame(() => {
    ebene.classList.add('offen');
    setTimeout(() => { if (offen) stage.app?.ticker.stop(); }, 120);
  });
}

/** Eltern-Bereich schließen, Spiel läuft weiter. */
export function schliesseEltern() {
  if (!offen) return;
  offen = false;
  clearInterval(anzeigeTakt);
  clearTimeout(ruheTimer);
  clearTimeout(fehlerTimer);
  ebene.classList.remove('offen');
  ebene.setAttribute('aria-hidden', 'true');
  stage.app?.ticker.start();
  spielzeit.pause(false);
  // Eingaben erst nach dem Ausblenden wieder an (der Finger auf „Schließen" tippt nichts im Spiel an)
  setTimeout(() => { if (!offen && !SceneManager._wechsel) setInputLocked(false); }, 350);
}

/** Ist der Eltern-Bereich gerade offen? */
export function elternOffen() {
  return offen;
}
