// Ton-Kern von Sigo 2: Geräusche, Musik, Stimme, erzeugte Instrumente und Tierlaute.
// Reine Web Audio API, keine Bibliothek.
//
// Kette:  Geräusche ───────┐
//         Musik → Dämpfer ─┼→ Master → sanfter Begrenzer → Sicherheitsnetz → Lautsprecher
//         Stimme ──────────┘
//
// Ruhe-Regeln: alles weich ein- und ausgeblendet, Gesamtlautstärke gedeckelt, höchstens 6 Geräusche
// gleichzeitig, nichts Schrilles. Der AudioContext entsteht erst bei der ersten Berührung (initAudio()).

import { onAudioRegistered } from './assets.js';
import { setTapSound, onInput, inEingabe } from './input.js';
import { SceneManager } from './scene.js';

const EINST_SCHLUESSEL = 'sigo2.einst';
const GESAGT_SCHLUESSEL = 'sigo2.gesagt';

// Grundpegel der Busse (werden mit den Reglern der Eltern multipliziert) und des Masters
const BASIS = { sfx: 0.8, musik: 0.3, stimme: 0.95 };
const MASTER = 0.7;

const MAX_GERAEUSCHE = 6;      // gleichzeitige Geräusche (sfx + Tierlaute)
const MAX_TOENE = 6;           // gleichzeitige Instrumententöne
const SFX_ABSTAND = 0.07;      // gleiches Geräusch frühestens nach 70 ms erneut
// Ton-Bremse für Töne, die direkt aus einer Berührung kommen (Tippen, Ziehen, Wischen – nicht Melodien der Szene):
const TIPP_GLEICH = 0.2;       // derselbe Ton frühestens nach 0,2 s neu
const TIPP_KLANG_ABSTAND = 0.16; // zwei neue Klänge frühestens so weit auseinander (kein Tonhaufen)
const TIPP_JE_SEK = 5;         // höchstens so viele neue Klänge je Sekunde
const KLANG_ZUSAMMEN = 0.025;  // was so dicht beieinander beginnt, ist EIN Klang (Tipp-Ton + Ton des Dings)
const KLANG_TEILE = 3;         // … aus höchstens so vielen Tönen
const LANG_AB = 0.4;           // ein Ton ab dieser Länge legt sich nicht über sich selbst (s)
const LANG_NEU_AB = 0.6;       // … er beginnt frühestens nach so langer Zeit neu (der alte blendet weich aus)
const SFX_ZU_SPAET = 0.4;      // ein Geräusch, das so lange laden musste, wird nicht mehr gespielt (s)
const MUSIK_BLENDE = 1.5;      // Überblenden beim Musikwechsel (s)
const MUSIK_RUNDEN_BLENDE = 2; // Überblenden am Schleifenende, wenn das Stück aus- oder einblendet (s)
const MUSIK_IM_SPEICHER = 2;   // so viele entpackte Musikstücke bleiben im Speicher
const MUSIK_VORAB_NACH = 2.5;  // s: vor der ersten Berührung wird die Musik erst so spät vorab geholt
const STIMME_PAUSE = 1.2;      // Mindestpause zwischen zwei Sätzen (s)
const WARTEN_MAX = 6;          // ein Satz, der in diese Pause fällt, wartet höchstens so lange (s)
const WIEDERHOLEN_NACH = 25;   // so lange nichts getan nach einem Hinweis: er kommt einmal wieder (s)
const DAEMPFUNG = 0.4;         // Musik während eines Satzes: ≈ −8 dB
const TIER_MAX = 2.5;          // Tierlaute höchstens so lang (s)
const TIER_ZIEL_RMS = 0.12;    // gemeinsamer Pegel aller Tierlaute (RMS der lauten Stellen)
const NACHHOLEN_MAX = 20;      // ein Satz vor der ersten Berührung wird höchstens so lange danach noch gesagt (s)
const NACHHOLEN_PAUSE = 0.35;  // … und zwar so kurz nach dem Entsperren (s)

const SOUNDS = new URL('../../sounds/', import.meta.url);

// ---------- Zustand ----------

let ctx = null;          // AudioContext (oder im Test ein OfflineAudioContext)
let kette = null;        // { sfx, musik, daempfer, stimme, master, begrenzer }
let istOffline = false;
let erstelltUm = 0;      // performance.now() beim Anlegen des Kontexts
let versteckt = false;   // Tab im Hintergrund
let initialisiert = false;

const urls = new Map();     // 'pack/name' → URL
const rohdaten = new Map(); // URL → Promise<ArrayBuffer|null> (darf schon vor dem Entsperren laden)
const puffer = new Map();   // Schlüssel → AudioBuffer | null (null = Datei fehlt oder kaputt)
const laedt = new Map();    // Schlüssel → Promise<AudioBuffer|null>
const gewarnt = new Set();
const zuletzt = new Map();  // sfx-id → performance.now() des letzten Abspielens

const geraeusche = [];      // laufende Geräusche: { ende, aus, quellen }
const toene = [];           // laufende Instrumententöne, gleicher Aufbau

const einst = { musik: 0.7, geraeusche: 0.9, stimme: 1, redenImmer: false };
ladeEinstellungen();

// ---------- Hilfen ----------

function leseJson(schluessel) {
  try {
    const wert = JSON.parse(localStorage.getItem(schluessel));
    return wert && typeof wert === 'object' ? wert : {};
  } catch {
    return {};
  }
}

function schreibeJson(schluessel, wert) {
  try {
    localStorage.setItem(schluessel, JSON.stringify(wert));
  } catch {
    // Speicher voll oder gesperrt: dann eben nur für diese Sitzung
  }
}

function warneEinmal(schluessel, text) {
  if (gewarnt.has(schluessel)) return;
  gewarnt.add(schluessel);
  console.warn(`[Ton] ${text}: ${schluessel}`);
}

const midiZuHz = (midi) => 440 * 2 ** ((midi - 69) / 12);

// Hält einen AudioParam auf seinem momentanen Wert fest (ohne Sprung) und löscht alles Geplante danach.
function halte(param, t) {
  if (param.cancelAndHoldAtTime) {
    param.cancelAndHoldAtTime(t);
  } else {
    const wert = param.value;
    param.cancelScheduledValues(t);
    param.setValueAtTime(wert, t);
  }
}

// Weiches Gleiten zu einem neuen Wert
function gleite(param, wert, tau = 0.08) {
  const t = ctx.currentTime;
  halte(param, t);
  param.setTargetAtTime(wert, t, tau);
}

// Darf gerade etwas erklingen? Kurz nach dem Anlegen zählt „entsperrt gerade" mit (auf Touch-Geräten
// wird der Kontext erst beim Loslassen des Fingers freigegeben).
function bereit() {
  if (!ctx || versteckt) return false;
  return istOffline || ctx.state === 'running' || performance.now() - erstelltUm < 1500;
}

// ---------- Laden ----------

function holeRohdaten(url) {
  if (!rohdaten.has(url)) {
    const anfrage = fetch(url)
      .then((antwort) => {
        if (!antwort.ok) throw new Error('HTTP ' + antwort.status);
        return antwort.arrayBuffer();
      })
      .catch((fehler) => {
        console.warn(`[Ton] Datei nicht ladbar: ${url} (${fehler.message})`);
        return null;
      });
    rohdaten.set(url, anfrage);
  }
  return rohdaten.get(url);
}

// Lädt und entpackt einen Ton einmal. Ohne Kontext werden nur die Rohdaten geholt (Ergebnis null, nicht gemerkt).
function ladePuffer(schluessel, url) {
  if (puffer.has(schluessel)) return Promise.resolve(puffer.get(schluessel));
  if (!laedt.has(schluessel)) {
    const arbeit = (async () => {
      const bytes = await holeRohdaten(url);
      if (!bytes) return null;
      if (!ctx) return undefined;
      try {
        // decodeAudioData verbraucht den Speicher, daher eine Kopie
        const buf = await ctx.decodeAudioData(bytes.slice(0));
        rohdaten.delete(url);
        return buf;
      } catch (fehler) {
        console.warn(`[Ton] Datei nicht lesbar: ${url} (${fehler.message || fehler})`);
        return null;
      }
    })().then((buf) => {
      laedt.delete(schluessel);
      if (buf !== undefined) puffer.set(schluessel, buf);
      return buf ?? null;
    });
    laedt.set(schluessel, arbeit);
  }
  return laedt.get(schluessel);
}

// Weißes Rauschen (1 s) je Kontext, für Klopfen, Atem, Trommeln
const rauschPuffer = new WeakMap();
function rauschen(c) {
  if (!rauschPuffer.has(c)) {
    const buf = c.createBuffer(1, c.sampleRate, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    rauschPuffer.set(c, buf);
  }
  return rauschPuffer.get(c);
}

// ---------- Kontext und Kette ----------

const SICHERHEITS_KURVE = (() => {
  const n = 2049;
  const kurve = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1;
    const a = Math.abs(x);
    kurve[i] = a <= 0.7 ? x : Math.sign(x) * (0.7 + 0.25 * Math.tanh((a - 0.7) / 0.25));
  }
  return kurve;
})();

function baueKette(c) {
  const k = {};
  // Sanfter Begrenzer: fängt Spitzen ab, wenn mehreres zusammenkommt
  k.begrenzer = c.createDynamicsCompressor();
  k.begrenzer.threshold.value = -12;
  k.begrenzer.knee.value = 12;
  k.begrenzer.ratio.value = 12;
  k.begrenzer.attack.value = 0.003;
  k.begrenzer.release.value = 0.25;
  // Sicherheitsnetz dahinter: bis 0,7 unverändert, darüber weich gerundet, nie über 0,91
  k.netz = c.createWaveShaper();
  k.netz.curve = SICHERHEITS_KURVE;
  k.master = c.createGain();
  k.master.gain.value = MASTER;
  k.master.connect(k.begrenzer).connect(k.netz).connect(c.destination);

  k.sfx = c.createGain();
  k.musik = c.createGain();
  k.daempfer = c.createGain();
  k.stimme = c.createGain();
  k.sfx.connect(k.master);
  k.musik.connect(k.daempfer).connect(k.master);
  k.stimme.connect(k.master);
  k.sfx.gain.value = BASIS.sfx * einst.geraeusche ** 2;
  k.musik.gain.value = BASIS.musik * einst.musik ** 2;
  k.stimme.gain.value = BASIS.stimme * einst.stimme ** 2;
  return k;
}

function wechsleKontext(c) {
  // Alles Laufende gehört zum alten Kontext und wird vergessen
  geraeusche.length = 0;
  toene.length = 0;
  tierLaeuft.clear();
  laeuftGeraeusch.clear();
  laufend = null;
  satz = null;
  spricht = false;
  wartende = 0;
  stimmeEnde = -Infinity;
  warteschlange = Promise.resolve(false);

  ctx = c;
  istOffline = typeof OfflineAudioContext !== 'undefined' && c instanceof OfflineAudioContext;
  kette = baueKette(c);
  erstelltUm = performance.now();
  if (musikWunsch.id) music(musikWunsch.id, { vol: musikWunsch.vol });
  // Geräusch-Schleifen, die klingen sollen, auf dem neuen Kontext neu ansetzen
  for (const s of schleifen) s._neuerKontext();
}

function starteKontext() {
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  try {
    wechsleKontext(new AC({ latencyHint: 'interactive' }));
  } catch (fehler) {
    console.warn('[Ton] AudioContext nicht möglich:', fehler);
    return;
  }
  ctx.resume().catch(() => {});
  holeSatzNach();
}

function setzeVersteckt(wert) {
  versteckt = wert;
  if (!ctx || istOffline) return;
  if (wert) ctx.suspend().catch(() => {});
  else weckeWieder();
}

// Nach dem Zurückkommen fortsetzen; klappt das nicht sofort, noch ein paar Mal nachfassen
function weckeWieder(versuch = 0) {
  if (!ctx || istOffline || versteckt || ctx.state === 'running' || ctx.state === 'closed') return;
  ctx.resume().catch(() => {});
  if (versuch < 5) setTimeout(() => weckeWieder(versuch + 1), 400);
}

/**
 * Bereitet den Ton vor. Der Kontext entsteht bei der ersten Berührung (pointerdown/touchend/keydown);
 * vorher gewünschte Musik startet dann. Der Lauscher bleibt danach still bestehen und weckt den Ton
 * wieder, falls das System ihn unterbrochen hat. Tab im Hintergrund → Pause, beim Zurückkommen weiter.
 * Nur für Tests: initAudio({ kontext: new OfflineAudioContext(…) }) baut die Kette sofort auf diesem Kontext.
 */
export function initAudio({ kontext } = {}) {
  if (kontext) {
    wechsleKontext(kontext);
    return;
  }
  if (initialisiert) return;
  initialisiert = true;
  const wecken = () => {
    if (!ctx || istOffline) starteKontext(); // ein Test-Kontext wird durch einen echten ersetzt
    else if (!versteckt && !istOffline && ctx.state !== 'running') ctx.resume().catch(() => {});
  };
  for (const art of ['pointerdown', 'touchend', 'keydown']) {
    window.addEventListener(art, wecken, { capture: true, passive: true });
  }
  document.addEventListener('visibilitychange', () => setzeVersteckt(document.visibilityState === 'hidden'));
  window.addEventListener('pagehide', () => setzeVersteckt(true));
  window.addEventListener('pageshow', () => setzeVersteckt(document.visibilityState === 'hidden'));
  versteckt = document.visibilityState === 'hidden';
}

// ---------- Einstellungen ----------

function ladeEinstellungen() {
  const gespeichert = leseJson(EINST_SCHLUESSEL);
  uebernimm(gespeichert);
}

function uebernimm(neu) {
  for (const name of ['musik', 'geraeusche', 'stimme']) {
    const wert = Number(neu[name]);
    if (neu[name] !== undefined && Number.isFinite(wert)) einst[name] = Math.min(1, Math.max(0, wert));
  }
  if (typeof neu.redenImmer === 'boolean') einst.redenImmer = neu.redenImmer;
}

/** Lautstärken 0…1 der Eltern-Regler und „immer reden"; wird in 'sigo2.einst' gespeichert. */
export function setVolumes(neu = {}) {
  uebernimm(neu);
  // Andere Einstellungen im selben Schlüssel bleiben erhalten
  const gespeichert = leseJson(EINST_SCHLUESSEL);
  schreibeJson(EINST_SCHLUESSEL, { ...gespeichert, ...einst });
  if (!kette) return;
  // Quadratisch, damit sich der Regler gleichmäßig anfühlt
  gleite(kette.sfx.gain, BASIS.sfx * einst.geraeusche ** 2);
  gleite(kette.musik.gain, BASIS.musik * einst.musik ** 2);
  gleite(kette.stimme.gain, BASIS.stimme * einst.stimme ** 2);
}

// ---------- Stimmen-Begrenzung ----------

// Trägt einen neuen Klang in die Liste ein; sind zu viele da, wird der älteste weich beendet.
function belege(liste, max, eintrag) {
  const jetzt = ctx.currentTime;
  for (let i = liste.length - 1; i >= 0; i--) if (liste[i].ende <= jetzt) liste.splice(i, 1);
  while (liste.length >= max) blendeAus(liste.shift(), 0.06);
  liste.push(eintrag);
}

function blendeAus(eintrag, dauer) {
  const t = ctx.currentTime;
  halte(eintrag.aus.gain, t);
  eintrag.aus.gain.linearRampToValueAtTime(0, t + dauer);
  for (const quelle of eintrag.quellen) {
    try {
      quelle.stop(t + dauer + 0.02);
    } catch {
      // schon beendet
    }
  }
  eintrag.ende = Math.min(eintrag.ende, t + dauer);
}

// Spielt einen Puffer(-Ausschnitt) über den Geräusche-Bus. Ergebnis: { eintrag, fertig: Promise<true> }
function spielePuffer(buf, { vol = 1, rate = 1, pan = 0, streu = 0, start = 0, dauer = Infinity, ein = 0.004, ausblenden = 0 }) {
  const t = ctx.currentTime;
  const quelle = ctx.createBufferSource();
  quelle.buffer = buf;
  const echteRate = rate * (1 + (Math.random() * 2 - 1) * streu);
  quelle.playbackRate.value = echteRate;
  const laenge = Math.max(0.01, Math.min(dauer, buf.duration - start));
  const spielzeit = laenge / echteRate;

  const aus = ctx.createGain();
  aus.gain.setValueAtTime(0, t);
  aus.gain.linearRampToValueAtTime(vol, t + Math.min(ein, spielzeit / 2));
  if (ausblenden > 0) {
    const ab = Math.max(t + ein, t + spielzeit - ausblenden);
    aus.gain.setValueAtTime(vol, ab);
    aus.gain.linearRampToValueAtTime(0, t + spielzeit);
  }

  let knoten = quelle;
  if (pan) {
    const panner = ctx.createStereoPanner();
    panner.pan.value = Math.max(-1, Math.min(1, pan));
    knoten.connect(panner);
    knoten = panner;
  }
  knoten.connect(aus).connect(kette.sfx);
  quelle.start(t, start, laenge);

  const eintrag = { ende: t + spielzeit, aus, quellen: [quelle] };
  belege(geraeusche, MAX_GERAEUSCHE, eintrag);
  const fertig = new Promise((erfuellt) => {
    quelle.onended = () => {
      knoten.disconnect();
      aus.disconnect();
      erfuellt(true);
    };
  });
  return { eintrag, fertig };
}

// ---------- Geräusche ----------

/** Meldet einen Ton aus einem Paket an: registerAudio('bauernhof/muh', url). */
export function registerAudio(id, url) {
  urls.set(id, String(url));
}

// ---------- Ton-Bremse ----------
//
// Ein Kind, das schnell trommelt, soll keinen Lärm machen (Ruhe-Regel: Töne nicht stapeln). Töne, die direkt in
// einer Berührung entstehen (inEingabe(): während pointerdown/pointermove abgearbeitet werden), zählen als Klänge:
// Was innerhalb von 25 ms beginnt, ist EIN Klang (Tipp-Ton + Ton des Dings + Tierlaut). Neue Klänge kommen
// frühestens 0,16 s nach dem letzten und höchstens 5 je Sekunde; der Rest bleibt still. Die sichtbare Antwort
// (Stauchen, Wackeln) kommt trotzdem sofort. Melodien und Zeitgeber der Szenen bremst das nicht.
const klangZeiten = [];   // Beginn der erlaubten Klänge (performance.now, ms)
let klangOffen = null;    // { zeit, n }: der zuletzt erlaubte Klang – so kurz danach dürfen noch Töne dazu

function tippKlangErlaubt() {
  if (!inEingabe()) return true;
  const jetzt = performance.now();
  if (klangOffen && jetzt - klangOffen.zeit <= KLANG_ZUSAMMEN * 1000) {
    if (klangOffen.n >= KLANG_TEILE) return false;
    klangOffen.n++;
    return true;
  }
  while (klangZeiten.length && jetzt - klangZeiten[0] > 1000) klangZeiten.shift();
  const letzter = klangZeiten[klangZeiten.length - 1] ?? -Infinity;
  if (jetzt - letzter < TIPP_KLANG_ABSTAND * 1000 || klangZeiten.length >= TIPP_JE_SEK) return false;
  klangZeiten.push(jetzt);
  klangOffen = { zeit: jetzt, n: 1 };
  return true;
}

const laeuftGeraeusch = new Map(); // sfx-id → { eintrag, beginn (Kontext-Zeit), lang }

/** Geräusch abspielen. Gibt ein Promise zurück: true am Ende, false wenn nichts erklang. */
export function sfx(id, { vol = 1, rate = 1, pan = 0, streu = 0.04 } = {}) {
  const url = urls.get(id);
  if (!url) {
    warneEinmal(id, 'unbekanntes Geräusch');
    return Promise.resolve(false);
  }
  if (!bereit()) {
    if (!ctx) holeRohdaten(url);
    return Promise.resolve(false);
  }
  const jetzt = performance.now();
  const ausBeruehrung = inEingabe();
  const abstand = ausBeruehrung ? TIPP_GLEICH : SFX_ABSTAND;
  if (jetzt - (zuletzt.get(id) ?? -Infinity) < abstand * 1000) return Promise.resolve(false);
  // Ein langer Ton (≥ 0,4 s) aus einer Berührung legt sich nicht über sich selbst: kurz nach dem Start klingt der
  // alte einfach weiter, danach blendet er weich aus und der neue beginnt
  const vorher = laeuftGeraeusch.get(id);
  const klingtNoch = vorher && vorher.lang && vorher.eintrag.ende > ctx.currentTime;
  if (ausBeruehrung && klingtNoch && ctx.currentTime - vorher.beginn < LANG_NEU_AB) return Promise.resolve(false);
  if (!tippKlangErlaubt()) return Promise.resolve(false);
  zuletzt.set(id, jetzt);
  if (ausBeruehrung && klingtNoch) blendeAus(vorher.eintrag, 0.12);

  const optionen = { vol, rate, pan, streu };
  const spiele = (buf) => {
    const { eintrag, fertig } = spielePuffer(buf, optionen);
    laeuftGeraeusch.set(id, { eintrag, beginn: ctx.currentTime, lang: buf.duration >= LANG_AB });
    return fertig;
  };
  const fertig = puffer.get(id);
  if (fertig !== undefined) return fertig ? spiele(fertig) : Promise.resolve(false);
  return ladePuffer(id, url).then((buf) => {
    const zuSpaet = performance.now() - jetzt > SFX_ZU_SPAET * 1000;
    return buf && !zuSpaet && bereit() ? spiele(buf) : false;
  });
}

/** Töne vorab laden: preload(['common/tipp', 'kuh']) – Einträge ohne '/' sind Tiere. */
export function preload(ids) {
  const liste = Array.isArray(ids) ? ids : [ids];
  return Promise.all(
    liste.map((id) => {
      if (!id.includes('/')) return ladeTier(id);
      const url = urls.get(id);
      if (!url) {
        warneEinmal(id, 'unbekanntes Geräusch');
        return null;
      }
      return ctx ? ladePuffer(id, url) : holeRohdaten(url);
    }),
  ).then(() => undefined);
}

// ---------- Geräusch-Schleifen ----------

const schleifen = new Set();   // alle lebenden Schleifen (für Kontextwechsel und Szenenende)

/**
 * Ein Geräusch als stoppbare Schleife (Wasserstrahl, Motor, Bürsten …), weich ein- und ausgeblendet.
 * Läuft über den Geräusche-Bus (folgt also dem Regler der Eltern), zählt aber nicht zu den 6 gleichzeitigen
 * Geräuschen. Gehört der Szene, in der sie entstand, und verstummt mit ihr von selbst.
 */
class GeraeuschSchleife {
  constructor(id, { vol = 0.6, rate = 1, ein = 0.3, aus = 0.4 } = {}) {
    this.id = id;
    this.vol = vol;
    this.rate = rate;
    this.ein = ein;
    this.ausDauer = aus;
    this.soll = false;       // soll gerade klingen
    this.tot = false;
    this._knoten = null;     // { kontext, quelle, aus }
    this._marke = 0;         // jeder Ladeversuch zieht eine neue Marke (alte Ergebnisse verfallen)
    this._laedt = false;
    this.szene = SceneManager.current;
    schleifen.add(this);
  }

  /** Klingt die Schleife gerade (oder soll sie gleich, sobald der Ton geladen bzw. entsperrt ist)? */
  get aktiv() {
    return this.soll && !this.tot;
  }

  /** Weich einblenden (sek, Standard ein=0,3 s). Läuft sie schon, passiert nichts Neues. → this */
  an(sek = this.ein) {
    if (this.tot) return this;
    this.soll = true;
    this._starte(sek);
    return this;
  }

  /** Weich ausblenden (sek, Standard aus=0,4 s); an() startet sie später wieder. → this */
  aus(sek = this.ausDauer) {
    this.soll = false;
    this._marke++;
    this._laedt = false;
    const k = this._knoten;
    this._knoten = null;
    if (!k || k.kontext !== ctx) return this;
    try {
      const t = ctx.currentTime;
      halte(k.aus.gain, t);
      k.aus.gain.linearRampToValueAtTime(0, t + Math.max(0.02, sek));
      k.quelle.stop(t + Math.max(0.02, sek) + 0.05);
    } catch {
      // Kontext schon zu
    }
    return this;
  }

  /** Endgültig beenden (weich, 0,15 s). Danach tut die Schleife nichts mehr. */
  stop() {
    this.aus(0.15);
    this.tot = true;
    schleifen.delete(this);
  }

  _starte(sek) {
    if (!this.soll || this.tot || !bereit()) return;   // vor dem Entsperren: startet mit dem Kontext
    const k = this._knoten;
    if (k && k.kontext === ctx) {
      // klingt schon: nur sicher auf volle Lautstärke
      gleite(k.aus.gain, this.vol, Math.max(0.02, sek) / 3);
      return;
    }
    if (this._laedt) return;
    const url = urls.get(this.id);
    if (!url) {
      warneEinmal(this.id, 'unbekanntes Geräusch (Schleife)');
      return;
    }
    const marke = ++this._marke;
    const meinKontext = ctx;
    this._laedt = true;
    ladePuffer(this.id, url).then((buf) => {
      if (marke !== this._marke) return;
      this._laedt = false;
      if (!buf || this.tot || !this.soll || ctx !== meinKontext || !bereit()) return;
      const t = ctx.currentTime;
      const quelle = ctx.createBufferSource();
      quelle.buffer = buf;
      quelle.loop = true;
      quelle.playbackRate.value = this.rate;
      const aus = ctx.createGain();
      aus.gain.setValueAtTime(0, t);
      aus.gain.linearRampToValueAtTime(this.vol, t + Math.max(0.02, sek));
      quelle.connect(aus).connect(kette.sfx);
      // irgendwo in der Schleife anfangen: zwei Schleifen desselben Geräuschs klingen nicht gleich
      quelle.start(t, Math.random() * Math.max(0, buf.duration - 0.5));
      quelle.onended = () => {
        try { quelle.disconnect(); aus.disconnect(); } catch { /* schon weg */ }
      };
      this._knoten = { kontext: meinKontext, quelle, aus };
    });
  }

  // neuer AudioContext (erste Berührung, Test): alte Knoten sind weg; soll sie klingen, neu ansetzen
  _neuerKontext() {
    this._knoten = null;
    this._marke++;
    this._laedt = false;
    if (this.soll && !this.tot) this._starte(this.ein);
  }
}

// Endet eine Szene, verstummen ihre Schleifen
SceneManager.onExit((szene) => {
  for (const s of [...schleifen]) if (s.szene === szene) s.stop();
});

/**
 * Stoppbare Geräusch-Schleife: const s = sfxSchleife('common/wasserstrahl', {vol: 0.6, rate, ein: 0.3, aus: 0.4});
 * s.an() – weich einblenden; s.aus() – weich ausblenden (an() geht wieder); s.stop() – endgültig.
 * Endet mit der Szene von selbst. Vor der ersten Berührung bleibt sie still und setzt dann ein, wenn sie soll.
 */
export function sfxSchleife(id, opt = {}) {
  return new GeraeuschSchleife(id, opt);
}

// ---------- Musik ----------

let musikWunsch = { id: null, vol: 1 }; // was laufen soll (auch vor dem Entsperren)
let laufend = null;                     // { id, vol, aus, quellen, beendet }
const musikReihe = [];                  // zuletzt benutzte Musikstücke (für den Speicher)

/** Hintergrundmusik in Schleife; weiches Überblenden. music(null) blendet aus. Gleiche id läuft weiter. */
export function music(id, { vol = 1 } = {}) {
  id = id || null;
  musikWunsch = { id, vol };
  const url = id && urls.get(id);
  if (id && !url) {
    warneEinmal(id, 'unbekannte Musik');
  }
  if (!ctx) {
    // Vor der ersten Berührung klingt noch nichts: die Musik erst nach den Bildern holen (beim ersten Besuch
    // nimmt sie dem Startbild sonst die Leitung weg). Kommt die Berührung früher, lädt sie dann sofort.
    if (url) setTimeout(() => { if (!ctx && musikWunsch.id === id) holeRohdaten(url); }, MUSIK_VORAB_NACH * 1000);
    return;
  }
  if (laufend && laufend.id === id) {
    if (laufend.vol !== vol && laufend.aus) gleite(laufend.aus.gain, vol, 0.4);
    laufend.vol = vol;
    return;
  }
  if (laufend) beendeMusik(laufend);
  laufend = null;
  if (!url) return;

  const stueck = { id, vol, aus: null, quellen: [], beendet: false };
  laufend = stueck;
  ladePuffer(id, url).then((buf) => {
    if (!buf || laufend !== stueck) return;
    merkeMusik(id);
    starteSchleife(stueck, buf);
  });
}

// Höchstens MUSIK_IM_SPEICHER entpackte Stücke behalten (ein 2-Minuten-Stück braucht ~45 MB)
function merkeMusik(id) {
  const stelle = musikReihe.indexOf(id);
  if (stelle >= 0) musikReihe.splice(stelle, 1);
  musikReihe.push(id);
  while (musikReihe.length > MUSIK_IM_SPEICHER) puffer.delete(musikReihe.shift());
}

// Misst ein Musikstück: stille Ränder (Kodier-Polster) abschneiden; blendet es am Anfang oder Ende
// aus, wird die Schleife überblendet, sonst nahtlos (Runde an Runde, sampelgenau).
function schleifenMass(buf) {
  const d = buf.getChannelData(0);
  const sr = buf.sampleRate;
  const grenze = 0.0005;
  const maxRand = Math.floor(0.1 * sr);
  let a = 0;
  while (a < maxRand && Math.abs(d[a]) < grenze) a++;
  let b = d.length - 1;
  while (d.length - 1 - b < maxRand && Math.abs(d[b]) < grenze) b--;

  const rms = (von, bis) => {
    let summe = 0;
    let n = 0;
    for (let i = Math.max(0, von); i < Math.min(d.length, bis); i += 8) {
      summe += d[i] * d[i];
      n++;
    }
    return n ? Math.sqrt(summe / n) : 0;
  };
  const gesamt = rms(a, b);
  const randLaenge = Math.floor(1.5 * sr);
  const blendet = rms(a, a + randLaenge) < gesamt * 0.35 || rms(b - randLaenge, b) < gesamt * 0.35;
  const laenge = (b - a + 1) / sr;
  const ueberlapp = blendet && laenge > MUSIK_RUNDEN_BLENDE * 3 ? MUSIK_RUNDEN_BLENDE : 0;
  return { start: a / sr, laenge, ueberlapp };
}

function starteSchleife(stueck, buf) {
  const { start, laenge, ueberlapp } = schleifenMass(buf);
  const t = ctx.currentTime;
  stueck.aus = ctx.createGain();
  stueck.aus.gain.setValueAtTime(0, t);
  stueck.aus.gain.linearRampToValueAtTime(stueck.vol, t + MUSIK_BLENDE);
  stueck.aus.connect(kette.musik);

  // Eine Runde = einmal das Stück. Es ist immer eine Runde im Voraus geplant; endet eine,
  // wird die übernächste geplant.
  let naechsterStart = t;
  let erste = true;
  const plane = () => {
    if (stueck.beendet) return;
    const t0 = naechsterStart;
    const quelle = ctx.createBufferSource();
    quelle.buffer = buf;
    const huelle = ctx.createGain();
    if (ueberlapp > 0) {
      huelle.gain.setValueAtTime(erste ? 1 : 0, t0);
      huelle.gain.linearRampToValueAtTime(1, t0 + ueberlapp);
      huelle.gain.setValueAtTime(1, t0 + laenge - ueberlapp);
      huelle.gain.linearRampToValueAtTime(0, t0 + laenge);
    }
    quelle.connect(huelle).connect(stueck.aus);
    quelle.start(t0, start, laenge);
    stueck.quellen.push(quelle);
    quelle.onended = () => {
      quelle.disconnect();
      huelle.disconnect();
      stueck.quellen.splice(stueck.quellen.indexOf(quelle), 1);
      if (stueck.beendet) {
        if (stueck.quellen.length === 0) stueck.aus.disconnect();
      } else {
        plane();
      }
    };
    erste = false;
    naechsterStart = t0 + laenge - ueberlapp;
  };
  plane();
  plane();
}

function beendeMusik(stueck) {
  stueck.beendet = true;
  if (!stueck.aus) return;
  const t = ctx.currentTime;
  halte(stueck.aus.gain, t);
  stueck.aus.gain.linearRampToValueAtTime(0, t + MUSIK_BLENDE);
  for (const quelle of stueck.quellen) {
    try {
      quelle.stop(t + MUSIK_BLENDE + 0.05);
    } catch {
      // schon beendet
    }
  }
}

// ---------- Stimme ----------
//
// Wenig reden: Jeder Satz erklingt höchstens einmal am Tag (gezählt wird nur, was wirklich erklungen ist).
// Mit „Erklärt bei jedem Besuch" (redenImmer) einmal je Besuch einer Szene. Hat das Kind nach einem Hinweis
// WIEDERHOLEN_NACH Sekunden nichts getan, kommt der letzte Hinweis dieses Besuchs noch einmal (einmal je Besuch).
// Ein Satz, der in die Pause nach einem anderen fällt, wird kurz vorgemerkt (der neueste zählt) und danach gesagt –
// wenn das höchstens WARTEN_MAX Sekunden her ist und noch dieselbe Szene läuft.
// Ein Satz gehört der Szene (und Seite), in der er gesagt wurde: Beginnt ein Szenenwechsel, sagt die alte Szene
// nichts Neues mehr, und ein laufender Satz blendet weich aus (0,3 s). Beim Blättern (pruefeStimme()) blendet ein
// laufender Satz aus, dessen nurWenn() jetzt false ist – oder der ohne nurWenn zur alten Seite gehört (außer *_hallo).

const SATZ_AUS = 0.3;                       // so weich blendet ein Satz aus, der nicht mehr passt (s)

let spricht = false;
let stimmeEnde = -Infinity;                 // Kontext-Zeit, zu der der letzte Satz endete
let wartende = 0;                           // Sätze, die in der Reihe auf ihren Platz warten
let warteschlange = Promise.resolve(false);
let vorgemerkt = null;                      // { id, force, nurWenn, zeit, szene } – Satz von vor der ersten Berührung
let wartend = null;                         // { id, force, nurWenn, zeit, szene, seite, erfuellen } – Satz in der Pause
let wartendTimer = 0;
let satz = null;                            // der gerade klingende Satz: { id, szene, seite, nurWenn, huelle, quelle, aus }
const gesagtHier = new Set();               // in diesem Besuch der Szene schon erklungen
let hinweisHier = null;                     // letzter Hinweis (kein *_hallo) dieses Besuchs: { id, zeit, nurWenn, erklungen }
let wiederholtHier = false;
let letzteEingabe = -Infinity;              // performance.now() der letzten echten Berührung
const NACH_BERUEHRUNG = 1.5;                // so kurz nach einer Berührung ist ein Satz eine Antwort, kein Hinweis (s)

onInput(() => { letzteEingabe = performance.now(); });

// Neuer Besuch: Zählung „je Besuch" beginnt neu
SceneManager.onEnter(() => {
  gesagtHier.clear();
  hinweisHier = null;
  wiederholtHier = false;
});

// Ein Szenenwechsel beginnt: ein laufender Satz der alten Szene klingt nicht in die Blende und die neue Szene hinein
SceneManager.onLeave((szene) => {
  if (satz && satz.szene === szene) blendeSatzAus();
});

// Endet die Szene, gelten ihre vorgemerkten und wartenden Sätze nicht mehr
SceneManager.onExit((szene) => {
  if (vorgemerkt && vorgemerkt.szene === szene) vorgemerkt = null;
  if (wartend && wartend.szene === szene) {
    const w = wartend;
    wartend = null;
    clearTimeout(wartendTimer);
    w.erfuellen(false);
  }
  if (satz && satz.szene === szene) blendeSatzAus();
});

// Seite einer SeitenSzene (zum Blättern: gehört ein Satz noch zur sichtbaren Seite?)
const seiteVon = (szene) => (szene && typeof szene.seite === 'object' ? szene.seite : null);

// Darf die Szene den Hinweis wiederholen? Eigener Haken hinweisWiederholbar() (SeitenSzene: nur, wenn die Seite
// selbst etwas zu zeigen hat und die Hand noch nicht auf den Blätter-Pfeil zeigt), sonst: hints() zeigt etwas.
function wiederholbar(szene) {
  try {
    if (typeof szene.hinweisWiederholbar === 'function') return !!szene.hinweisWiederholbar();
    return (szene.hints?.() || []).some(Boolean);
  } catch {
    return false;
  }
}

// Lange nichts getan nach einem Hinweis: ihn einmal je Besuch wiederholen – wenn seit der letzten Berührung UND
// seit der Hinweis erklang (oder, war er heute schon dran, seit er fällig war) je 25 s vergangen sind, der Hinweis
// nach der letzten Berührung kam und die Szene etwas zu zeigen hat (dann zeigt auch die Zeige-Hand).
SceneManager.onIdle((szene, idle) => {
  if (wiederholtHier || !hinweisHier || !szene?.alive || SceneManager.wechselt) return;
  if (idle < WIEDERHOLEN_NACH) return;
  if (letzteEingabe > hinweisHier.zeit) return;
  const seit = (performance.now() - (hinweisHier.erklungen ?? hinweisHier.zeit)) / 1000;
  if (seit < WIEDERHOLEN_NACH || spricht) return;
  if (!wiederholbar(szene)) return;
  wiederholtHier = true;
  voice(hinweisHier.id, { force: true, nurWenn: hinweisHier.nurWenn });
}, { after: 1 });

// Datum (Ortszeit) für „einmal am Tag"
function heute() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Heute schon erklungen? (ältere Einträge waren reine Zähler ohne Datum: die gelten als „nicht heute")
function heuteGesagt(id) {
  const e = leseJson(GESAGT_SCHLUESSEL)[id];
  return !!e && typeof e === 'object' && e.tag === heute();
}

function merkeGesagt(id) {
  const gesagt = leseJson(GESAGT_SCHLUESSEL);
  const alt = gesagt[id];
  const n = (typeof alt === 'number' ? alt : Number(alt?.n) || 0) + 1;
  gesagt[id] = { n, tag: heute() };
  schreibeJson(GESAGT_SCHLUESSEL, gesagt);
  gesagtHier.add(id);
}

// Soll der Satz (noch) gesagt werden?
function sollSagen(id, force) {
  if (force) return true;
  if (einst.redenImmer) return !gesagtHier.has(id);
  return !heuteGesagt(id);
}

/** Alle Sätze gelten wieder als ungesagt (Eltern-Bereich: „Sätze wieder sprechen"). */
export function resetSpoken() {
  try { localStorage.removeItem(GESAGT_SCHLUESSEL); } catch { /* egal */ }
  gesagtHier.clear();
}

// Direkt nach dem Entsperren: den vorgemerkten Satz sagen – nur wenn er höchstens NACHHOLEN_MAX s alt ist, noch
// dieselbe Szene läuft und kein Szenenwechsel begonnen hat (die erste Berührung kann ja ein Ortswechsel sein).
// Hat die Berührung selbst schon einen Satz ausgelöst, wartet der vorgemerkte wie sonst auch auf die Pause.
function holeSatzNach() {
  const v = vorgemerkt;
  vorgemerkt = null;
  if (!v) return;
  setTimeout(() => {
    const s = SceneManager.current;
    if (performance.now() - v.zeit > NACHHOLEN_MAX * 1000) return;
    if (!s || s !== v.szene || !s.alive || SceneManager.schliesst) return;
    voice(v.id, { force: v.force, nurWenn: v.nurWenn });
  }, NACHHOLEN_PAUSE * 1000);
}

// Darf die Szene (noch) reden? Sie muss die laufende sein, leben und darf nicht gerade verlassen werden.
function szeneDarfReden(szene) {
  return !!szene && szene === SceneManager.current && szene.alive && !SceneManager.schliesst;
}

// Gilt ein wartender Satz noch?
function giltNoch(w) {
  if (performance.now() - w.zeit > WARTEN_MAX * 1000) return false;
  if (!szeneDarfReden(w.szene) || !bereit()) return false;
  if (!sollSagen(w.id, w.force)) return false;
  try { if (w.nurWenn && w.nurWenn() === false) return false; } catch { return false; }
  return true;
}

// Den wartenden Satz nach der Pause sagen (wird auch am Ende jedes Satzes neu geplant)
function planeWartenden() {
  clearTimeout(wartendTimer);
  const w = wartend;
  if (!w || !ctx) return;
  if (spricht || wartende > 0) return; // kommt am Ende des laufenden Satzes wieder hierher
  const rest = Math.max(0, STIMME_PAUSE - (ctx.currentTime - stimmeEnde));
  wartendTimer = setTimeout(() => {
    if (wartend !== w || spricht || wartende > 0) return;
    wartend = null;
    if (!giltNoch(w)) {
      w.erfuellen(false);
      return;
    }
    reiheEin(w.id, w).then(w.erfuellen);
  }, rest * 1000 + 20);
}

// Satz in die Reihe stellen (nur einer gleichzeitig, Pause davor). info = { szene, seite, nurWenn }
function reiheEin(id, info) {
  const schluessel = 'stimme/' + id;
  const url = stimmeUrl(id);
  wartende++;
  const versprechen = warteschlange.then(async () => {
    const rest = STIMME_PAUSE - (ctx.currentTime - stimmeEnde);
    if (rest > 0) await new Promise((weiter) => setTimeout(weiter, rest * 1000));
    wartende--;
    let erklungen = false;
    try {
      // Während er wartete, kann ein Szenenwechsel begonnen haben: dann sagt die alte Szene nichts mehr
      if (!szeneDarfReden(info.szene)) return false;
      // ein Hinweis zählt für die Wiederholung ab dem Augenblick, in dem er wirklich erklingt
      if (hinweisHier && hinweisHier.id === id && hinweisHier.szene === info.szene) hinweisHier.erklungen = performance.now();
      erklungen = await sprich(schluessel, url, { id, ...info });
      if (erklungen) merkeGesagt(id);
    } finally {
      planeWartenden();
    }
    return erklungen;
  });
  warteschlange = versprechen.catch(() => false);
  return versprechen;
}

// Den laufenden Satz weich ausblenden (er zählt dann nicht als gesagt und darf später wiederkommen)
function blendeSatzAus() {
  const s = satz;
  if (!s || s.aus || !ctx || s.kontext !== ctx) return;
  s.aus = true;
  try {
    const t = ctx.currentTime;
    halte(s.huelle.gain, t);
    s.huelle.gain.linearRampToValueAtTime(0, t + SATZ_AUS);
    s.quelle.stop(t + SATZ_AUS + 0.02);
  } catch {
    // schon zu Ende
  }
}

/**
 * Nach dem Blättern fragen: Passt der laufende Satz noch? Sein nurWenn() ist jetzt false – oder er hat kein nurWenn,
 * ist kein *_hallo und gehört zu einer anderen Seite als der sichtbaren: dann blendet er weich aus (0,3 s).
 * (SeitenSzene ruft das selbst beim Blättern auf.)
 */
export function pruefeStimme() {
  const s = satz;
  if (!s || s.aus) return;
  if (!szeneDarfReden(s.szene)) { blendeSatzAus(); return; }
  let passt = true;
  if (s.nurWenn) {
    try { passt = s.nurWenn() !== false; } catch { passt = false; }
  } else if (!/_hallo$/.test(s.id) && s.seite && seiteVon(s.szene) !== s.seite) {
    passt = false;
  }
  if (!passt) blendeSatzAus();
}

// Adresse eines Satzes: aus einer pack.json ('stimme/<id>'), sonst direkt die Datei assets/stimme/<id>.mp3
// (die Stimme braucht also kein eigenes Paket; fehlt die Datei, bleibt es still mit einer Warnung).
function stimmeUrl(id) {
  const schluessel = 'stimme/' + id;
  if (urls.has(schluessel)) return urls.get(schluessel);
  if (!/^[\w-]+$/.test(id)) return null;
  return new URL('assets/stimme/' + id + '.mp3', document.baseURI).href;
}

/**
 * Spricht den Satz <id> (assets/stimme/<id>.mp3). Wenig reden: einmal am Tag (mit der Einstellung „bei jedem
 * Besuch": einmal je Besuch der Szene; force: immer). Nur ein Satz gleichzeitig, mindestens 1,2 s Pause dazwischen.
 * Ein Satz in dieser Zeit wird vorgemerkt (der neueste zählt) und danach gesagt, wenn das höchstens 6 s her ist und
 * noch dieselbe Szene läuft; mit force wartet er auf jeden Fall. Die Musik wird dabei leiser.
 * opt.nurWenn: () => boolean – wird vor dem (späteren) Sprechen noch einmal gefragt; false = still verwerfen.
 * Ergebnis: Promise<boolean> – true am Ende des Satzes, false, wenn er nicht gesagt wird.
 */
export function voice(id, { force = false, nurWenn = null } = {}) {
  const schluessel = 'stimme/' + id;
  const url = stimmeUrl(id);
  if (!url) {
    warneEinmal(schluessel, 'unbekannter Satz');
    return Promise.resolve(false);
  }

  // Nur die laufende Szene redet – nicht mehr, sobald ein Szenenwechsel begonnen hat (sonst begänne ein Hinweis in
  // der Blende und klänge in die nächste Szene hinein)
  const szene = SceneManager.current;
  if (!szeneDarfReden(szene)) return Promise.resolve(false);
  const seite = seiteVon(szene);

  // Hinweis merken (auch wenn er heute schon kam): Er kann nach langem Nichtstun einmal wiederkommen. Was gleich
  // nach einer Berührung gesagt wird, ist eine Antwort (Lob), kein Hinweis. Gezählt wird ab der letzten echten
  // Berührung (der Szenenstart ist keine) – auch für Hinweise, die hinter der Begrüßung warten.
  const jetzt = performance.now();
  if (!force && !/_hallo$/.test(id) && jetzt - letzteEingabe >= NACH_BERUEHRUNG * 1000) {
    hinweisHier = { id, zeit: jetzt, nurWenn, szene, erklungen: null };
  }

  if (!sollSagen(id, force)) return Promise.resolve(false);
  try { if (nurWenn && nurWenn() === false) return Promise.resolve(false); } catch { return Promise.resolve(false); }

  if (!bereit()) {
    // Vor der ersten Berührung ist der Ton noch gesperrt: den Satz vormerken (der letzte zählt) – er kommt kurz
    // nach dem Entsperren, wenn bis dahin höchstens 20 s vergangen sind und noch dieselbe Szene läuft.
    if (!ctx && !versteckt) {
      vorgemerkt = { id, force, nurWenn, zeit: performance.now(), szene };
      holeRohdaten(url);
    }
    return Promise.resolve(false);
  }

  const info = { szene, seite, nurWenn };
  const frei = !spricht && wartende === 0 && ctx.currentTime - stimmeEnde >= STIMME_PAUSE;
  if (frei || force) return reiheEin(id, info);

  // In der Pause oder während eines Satzes: vormerken, der neueste zählt
  if (wartend) wartend.erfuellen(false);
  holeRohdaten(url);
  return new Promise((erfuellen) => {
    wartend = { id, force, nurWenn, zeit: performance.now(), szene, seite, erfuellen };
    planeWartenden();
  });
}

// Spricht einen Satz. info = { id, szene, seite, nurWenn } (zum Prüfen, ob er noch passt). → true, wenn er ganz
// erklungen ist; false, wenn er fehlt oder weich ausgeblendet wurde
async function sprich(schluessel, url, info) {
  spricht = true;
  const meinKontext = ctx;
  let meiner = null;
  try {
    const buf = await ladePuffer(schluessel, url);
    if (!buf || ctx !== meinKontext) return false;
    // Während der Satz lud, kann ein Wechsel begonnen haben
    if (!szeneDarfReden(info.szene)) return false;
    const t = ctx.currentTime;
    gleite(kette.daempfer.gain, DAEMPFUNG, 0.08);
    const quelle = ctx.createBufferSource();
    quelle.buffer = buf;
    const huelle = ctx.createGain();
    huelle.gain.setValueAtTime(0, t + 0.2);
    huelle.gain.linearRampToValueAtTime(1, t + 0.21);
    quelle.connect(huelle).connect(kette.stimme);
    quelle.start(t + 0.2);
    meiner = { ...info, quelle, huelle, kontext: meinKontext, aus: false };
    satz = meiner;
    await new Promise((fertig) => {
      quelle.onended = fertig;
    });
    quelle.disconnect();
    huelle.disconnect();
    return !meiner.aus;
  } finally {
    if (satz === meiner) satz = null;
    if (ctx === meinKontext) {
      spricht = false;
      stimmeEnde = ctx.currentTime;
      gleite(kette.daempfer.gain, 1, 0.35);
    }
  }
}

// ---------- Erzeugte Instrumente ----------

// Bausteine; p = { c: Kontext, ziel: Knoten, quellen: [] }
function oszillator(p, typ, freq, t, bis) {
  const o = p.c.createOscillator();
  o.type = typ;
  o.frequency.setValueAtTime(freq, t);
  o.start(t);
  o.stop(bis);
  p.quellen.push(o);
  return o;
}

// Hüllkurve: weicher Anstieg auf spitze, dann natürliches Abklingen (tau) – keine Sprünge, keine Knackser
function huelle(p, t, ein, spitze, tau, ziel = p.ziel) {
  const g = p.c.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(spitze, t + ein);
  g.gain.setTargetAtTime(0, t + ein, tau);
  g.connect(ziel);
  return g;
}

function rauschQuelle(p, t, bis) {
  const q = p.c.createBufferSource();
  q.buffer = rauschen(p.c);
  q.loop = true;
  q.start(t, Math.random() * 0.5);
  q.stop(bis);
  p.quellen.push(q);
  return q;
}

function filter(p, typ, freq, q = 0.7) {
  const f = p.c.createBiquadFilter();
  f.type = typ;
  f.frequency.value = freq;
  f.Q.value = q;
  return f;
}

// Jedes Instrument plant ab t und gibt zurück, wann es verklungen ist.
const INSTRUMENTE = {
  // Holz-Xylophon: Sinus + 4-facher Oberton, der sehr schnell verklingt, dazu ein kurzes Klopfen
  xylo(p, t, f) {
    const tau = 0.2;
    const bis = t + tau * 8;
    oszillator(p, 'sine', f, t, bis).connect(huelle(p, t, 0.003, 0.45, tau));
    if (f * 4 < 9000) oszillator(p, 'sine', f * 4, t, t + 0.4).connect(huelle(p, t, 0.002, 0.1, 0.03));
    const klopf = filter(p, 'bandpass', Math.min(3500, Math.max(900, f * 2)), 1.2);
    rauschQuelle(p, t, t + 0.08).connect(klopf).connect(huelle(p, t, 0.002, 0.1, 0.008));
    return bis;
  },

  // Weiches E-Piano: sanfte FM (Modulator 1:1, Anteil klingt schnell ab)
  klavier(p, t, f, dauer = 0.6) {
    const bis = t + dauer + 1.2;
    const traeger = oszillator(p, 'sine', f, t, bis);
    const modulator = oszillator(p, 'sine', f, t, bis);
    const tiefe = p.c.createGain();
    const anteil = f > 1200 ? 0.6 : 1.3;
    tiefe.gain.setValueAtTime(f * anteil, t);
    tiefe.gain.setTargetAtTime(f * 0.15, t, 0.25);
    modulator.connect(tiefe).connect(traeger.frequency);
    const g = p.c.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.38, t + 0.006);
    g.gain.setTargetAtTime(0, t + 0.006, 0.9);   // natürliches Ausklingen
    g.gain.setTargetAtTime(0, t + dauer, 0.12);  // Taste losgelassen
    traeger.connect(g).connect(p.ziel);
    return Math.min(bis, t + dauer + 1);
  },

  // Glockenspiel: unharmonische Teiltöne, lang ausklingend, leise
  glocke(p, t, f) {
    const teile = [
      [1, 1, 0.7],
      [2.76, 0.4, 0.35],
      [5.4, 0.18, 0.18],
      [8.93, 0.08, 0.1],
    ];
    const bis = t + 0.7 * 8;
    for (const [verhaeltnis, anteil, tau] of teile) {
      if (f * verhaeltnis > 9000) continue;
      oszillator(p, 'sine', f * verhaeltnis, t, t + tau * 8).connect(huelle(p, t, 0.002, 0.2 * anteil, tau));
    }
    return bis;
  },

  // Trommeln: 36 = tiefe Trommel, 38 = weiche Snare, 42 = Schellen/Shaker
  trommel(p, t, f, dauer, midi) {
    if (midi < 38) {
      const tief = oszillator(p, 'sine', 120 * 2 ** ((midi - 36) / 12), t, t + 1.2);
      tief.frequency.exponentialRampToValueAtTime(50 * 2 ** ((midi - 36) / 12), t + 0.15);
      tief.connect(huelle(p, t, 0.004, 0.85, 0.14));
      rauschQuelle(p, t, t + 0.06).connect(filter(p, 'lowpass', 1200)).connect(huelle(p, t, 0.002, 0.08, 0.008));
      return t + 1.2;
    }
    if (midi < 42) {
      const koerper = oszillator(p, 'sine', 190, t, t + 0.6);
      koerper.frequency.exponentialRampToValueAtTime(160, t + 0.08);
      koerper.connect(huelle(p, t, 0.003, 0.42, 0.06));
      const band = filter(p, 'lowpass', 4000);
      rauschQuelle(p, t, t + 0.6).connect(filter(p, 'highpass', 700)).connect(band).connect(huelle(p, t, 0.003, 0.42, 0.07));
      return t + 0.6;
    }
    const schelle = filter(p, 'bandpass', 6000, 0.8);
    rauschQuelle(p, t, t + 0.35).connect(schelle).connect(filter(p, 'lowpass', 9000)).connect(huelle(p, t, 0.012, 0.6, 0.035));
    return t + 0.35;
  },

  // Flöte: Sinus mit leisen Obertönen, weicher Einsatz, spätes Vibrato und etwas Atem
  floete(p, t, f, dauer = 0.5) {
    const bis = t + dauer + 0.8;
    const g = p.c.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.32, t + 0.08);
    g.gain.setTargetAtTime(0, t + Math.max(dauer, 0.1), 0.09);
    g.connect(p.ziel);
    const vibrato = oszillator(p, 'sine', 5, t, bis);
    const vibratoTiefe = p.c.createGain();
    vibratoTiefe.gain.setValueAtTime(0, t);
    vibratoTiefe.gain.linearRampToValueAtTime(12, t + 0.4); // Cent
    vibrato.connect(vibratoTiefe);
    for (const [verhaeltnis, anteil] of [[1, 1], [2, 0.1], [3, 0.035]]) {
      if (f * verhaeltnis > 9000) continue;
      const o = oszillator(p, 'sine', f * verhaeltnis, t, bis);
      vibratoTiefe.connect(o.detune);
      const a = p.c.createGain();
      a.gain.value = anteil;
      o.connect(a).connect(g);
    }
    const atem = p.c.createGain();
    atem.gain.setValueAtTime(0, t);
    atem.gain.linearRampToValueAtTime(0.05, t + 0.03);
    atem.gain.setTargetAtTime(0.012, t + 0.03, 0.1);
    atem.gain.setTargetAtTime(0, t + Math.max(dauer, 0.1), 0.09);
    atem.connect(p.ziel);
    rauschQuelle(p, t, bis).connect(filter(p, 'bandpass', Math.min(6000, f * 2), 1)).connect(atem);
    return bis;
  },

  // Kurzer freundlicher Rückmelde-Ton mit kleinem Anschleifen nach oben
  pling(p, t, f) {
    const bis = t + 1;
    const o = oszillator(p, 'sine', f * 0.94, t, bis);
    o.frequency.exponentialRampToValueAtTime(f, t + 0.03);
    o.connect(huelle(p, t, 0.004, 0.5, 0.11));
    oszillator(p, 'sine', f * 2, t, t + 0.5).connect(huelle(p, t, 0.004, 0.08, 0.05));
    return bis;
  },
};

const HALTENDE = new Set(['klavier', 'floete']); // bei diesen ist dauer die Haltezeit
const STANDARD_MIDI = { xylo: 72, klavier: 60, glocke: 84, trommel: 36, floete: 72, pling: 84 };

/** Erzeugter Instrumententon: note('xylo', 72, { vol, dauer }). */
export function note(instr, midi, { vol = 1, dauer } = {}) {
  const bau = INSTRUMENTE[instr];
  if (!bau) {
    warneEinmal('note:' + instr, 'unbekanntes Instrument');
    return;
  }
  if (!bereit()) return;
  midi = Number.isFinite(midi) ? midi : STANDARD_MIDI[instr];
  // Ton-Bremse (nur Töne direkt aus einer Berührung): derselbe Ton frühestens nach 0,2 s, dazu die Klang-Grenze
  if (inEingabe()) {
    const schluessel = 'note:' + instr + ':' + midi;
    const jetzt = performance.now();
    if (jetzt - (zuletzt.get(schluessel) ?? -Infinity) < TIPP_GLEICH * 1000) return;
    if (!tippKlangErlaubt()) return;
    zuletzt.set(schluessel, jetzt);
  }
  const t = ctx.currentTime;
  const aus = ctx.createGain();
  aus.gain.value = Math.max(0, Math.min(1.5, vol));
  aus.connect(kette.sfx);
  const p = { c: ctx, ziel: aus, quellen: [] };
  let ende = bau(p, t, midiZuHz(midi), HALTENDE.has(instr) ? dauer : undefined, midi);
  // Bei klingenden Instrumenten kürzt dauer den Nachklang (weich abgedämpft)
  if (dauer > 0 && !HALTENDE.has(instr) && t + dauer < ende) {
    aus.gain.setTargetAtTime(0, t + dauer, 0.06);
    ende = t + dauer + 0.5;
    for (const q of p.quellen) q.stop(ende);
  }
  belege(toene, MAX_TOENE, { ende, aus, quellen: p.quellen });
  let offen = p.quellen.length;
  for (const q of p.quellen) {
    q.onended = () => {
      if (--offen === 0) aus.disconnect();
    };
  }
}

// ---------- Tierlaute ----------

// Echte Aufnahmen (Quellen in sounds/QUELLEN.md); start/dauer = Ausschnitt in s, pegel = zusätzlicher Faktor
const AUFNAHMEN = {
  kuh: { datei: 'kuh.mp3' },
  schwein: { datei: 'schwein.mp3' },
  schaf: { datei: 'schaf.mp3' },
  hund: { datei: 'hund.mp3' },
  katze: { datei: 'katze.mp3' },
  huhn: { datei: 'huhn.mp3' },
  hahn: { datei: 'hahn.mp3' },
  frosch: { datei: 'frosch.mp3' },
  voegel: { datei: 'voegel.mp3' },
  pferd: { datei: 'pferd.ogg' },
  loewe: { datei: 'loewe.ogg', start: 0.3, dauer: 2.2, pegel: 0.8 }, // etwas leiser: soll nicht erschrecken
  elefant: { datei: 'elefant.ogg' },
  ente: { datei: 'ente.ogg', start: 1.2, dauer: 1.4 },
  pinguin: { datei: 'pinguin.ogg', start: 0.4, dauer: 0.85 },
  affe: { datei: 'affe.ogg', start: 1.55, dauer: 2.45 },
};
const TIER_NAMEN = { vogel: 'voegel' };

// Kleine freundliche Laute für Tiere ohne Aufnahme (werden einmal in einen Puffer gerechnet)
function quieken({ f, n, lang, abstand, ab = 0.02 }) {
  return (p) => {
    let t = ab;
    for (let i = 0; i < n; i++) {
      const hoehe = f * (1 + 0.04 * (i % 2));
      const o = oszillator(p, 'sine', hoehe * 0.85, t, t + lang + 0.1);
      o.frequency.linearRampToValueAtTime(hoehe * 1.12, t + lang * 0.6);
      o.frequency.linearRampToValueAtTime(hoehe, t + lang);
      const g = p.c.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.5, t + 0.015);
      g.gain.setValueAtTime(0.5, t + lang - 0.05);
      g.gain.linearRampToValueAtTime(0, t + lang);
      o.connect(g).connect(p.ziel);
      const oben = oszillator(p, 'sine', hoehe * 2, t, t + lang + 0.1);
      oben.frequency.linearRampToValueAtTime(hoehe * 2.24, t + lang * 0.6);
      const go = p.c.createGain();
      go.gain.value = 0.12;
      oben.connect(go).connect(g);
      t += lang + abstand;
    }
    return t + 0.1;
  };
}

const ERZEUGT = {
  maus: quieken({ f: 1400, n: 3, lang: 0.09, abstand: 0.06 }),
  hase: quieken({ f: 1000, n: 2, lang: 0.12, abstand: 0.08 }),
  eichhoernchen: quieken({ f: 1200, n: 4, lang: 0.07, abstand: 0.05 }),
  fuchs: quieken({ f: 760, n: 2, lang: 0.16, abstand: 0.1 }),
  // Igel: drei Schnüffler und ein winziges Quieken
  igel(p) {
    for (let i = 0; i < 3; i++) {
      const t = 0.02 + i * 0.15;
      rauschQuelle(p, t, t + 0.25).connect(filter(p, 'bandpass', 2200, 1.5)).connect(huelle(p, t, 0.02, 0.7, 0.03));
    }
    return quieken({ f: 1300, n: 1, lang: 0.09, abstand: 0, ab: 0.52 })(p);
  },
  // Giraffe: ein leises, zufriedenes „Mmm"
  giraffe(p) {
    const g = p.c.createGain();
    g.gain.setValueAtTime(0, 0);
    g.gain.linearRampToValueAtTime(0.5, 0.15);
    g.gain.setValueAtTime(0.5, 0.7);
    g.gain.linearRampToValueAtTime(0, 0.95);
    g.connect(p.ziel);
    for (const [verhaeltnis, anteil] of [[1, 1], [2, 0.3], [3, 0.1]]) {
      const o = oszillator(p, 'sine', 180 * verhaeltnis, 0, 1);
      o.frequency.linearRampToValueAtTime(200 * verhaeltnis, 0.5);
      o.frequency.linearRampToValueAtTime(175 * verhaeltnis, 0.95);
      const a = p.c.createGain();
      a.gain.value = anteil;
      o.connect(a).connect(g);
    }
    return 1;
  },
  // Bär: freundliches Brummen „mmmh" (tief, weich gefiltert)
  baer(p) {
    const o = oszillator(p, 'sawtooth', 90, 0, 1.1);
    o.frequency.linearRampToValueAtTime(115, 0.45);
    o.frequency.linearRampToValueAtTime(95, 1.0);
    const g = p.c.createGain();
    g.gain.setValueAtTime(0, 0);
    g.gain.linearRampToValueAtTime(0.6, 0.12);
    g.gain.setValueAtTime(0.6, 0.8);
    g.gain.linearRampToValueAtTime(0, 1.05);
    o.connect(filter(p, 'lowpass', 450)).connect(g).connect(p.ziel);
    return 1.1;
  },
  // Eule: sanftes „Hu-huu"
  eule(p) {
    for (const [t, lang] of [[0.02, 0.28], [0.45, 0.55]]) {
      const o = oszillator(p, 'sine', 420, t, t + lang + 0.05);
      o.frequency.linearRampToValueAtTime(390, t + lang);
      const g = p.c.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.5, t + 0.06);
      g.gain.setValueAtTime(0.5, t + lang - 0.1);
      g.gain.linearRampToValueAtTime(0, t + lang);
      o.connect(g).connect(p.ziel);
    }
    return 1.05;
  },
};
const STANDARD_LAUT = quieken({ f: 1100, n: 2, lang: 0.11, abstand: 0.08 });

async function erzeugeTier(id) {
  const sr = ctx.sampleRate;
  const off = new OfflineAudioContext(1, Math.ceil(sr * 1.6), sr);
  const p = { c: off, ziel: off.destination, quellen: [] };
  (ERZEUGT[id] || STANDARD_LAUT)(p);
  return off.startRendering();
}

// Pegel der lauten Stellen (RMS über 50-ms-Stücke, die höchstens 20 dB unter dem lautesten liegen)
function messePegel(buf, start, dauer) {
  const sr = buf.sampleRate;
  const von = Math.floor(start * sr);
  const bis = Math.min(buf.length, Math.floor((start + dauer) * sr));
  const kanaele = [];
  for (let k = 0; k < buf.numberOfChannels; k++) kanaele.push(buf.getChannelData(k));
  const stueck = Math.floor(sr * 0.05);
  const energien = [];
  let spitze = 0;
  for (let i = von; i < bis; i += stueck) {
    let summe = 0;
    let n = 0;
    for (const d of kanaele) {
      for (let j = i; j < Math.min(bis, i + stueck); j++) {
        summe += d[j] * d[j];
        if (Math.abs(d[j]) > spitze) spitze = Math.abs(d[j]);
        n++;
      }
    }
    energien.push(n ? summe / n : 0);
  }
  const lautest = Math.max(0, ...energien);
  const laut = energien.filter((e) => e >= lautest * 0.01);
  const rms = laut.length ? Math.sqrt(laut.reduce((s, e) => s + e, 0) / laut.length) : 0;
  return { spitze, rms };
}

async function ladeTierIntern(id) {
  let buf = null;
  let start = 0;
  let dauer = TIER_MAX;
  let pegel = 1;
  const aufnahme = AUFNAHMEN[id];
  if (aufnahme) {
    buf = await ladePuffer('tier:' + id, new URL(aufnahme.datei, SOUNDS).href);
    start = aufnahme.start || 0;
    dauer = aufnahme.dauer ?? TIER_MAX;
    pegel = aufnahme.pegel ?? 1;
  } else if (urls.has('tiere/laut_' + id)) {
    buf = await ladePuffer('tiere/laut_' + id, urls.get('tiere/laut_' + id));
  }
  if (!buf) {
    // Keine (lesbare) Aufnahme: kleiner erzeugter Laut
    buf = await erzeugeTier(id);
    start = 0;
    dauer = TIER_MAX;
    pegel = 1;
  }
  dauer = Math.min(dauer, TIER_MAX, buf.duration - start);
  const mass = messePegel(buf, start, dauer);
  const verstaerkung = mass.rms > 0 ? Math.min(TIER_ZIEL_RMS / mass.rms, 0.8 / mass.spitze, 8) * pegel : 0;
  return { buf, start, dauer, verstaerkung };
}

const tierFertig = new Map(); // id → { buf, start, dauer, verstaerkung } | null
const tierLaedt = new Map();
const tierLaeuft = new Map(); // id → { eintrag, beginn }

function ladeTier(id) {
  if (tierFertig.has(id)) return Promise.resolve(tierFertig.get(id));
  if (!ctx) {
    const aufnahme = AUFNAHMEN[id];
    if (aufnahme) holeRohdaten(new URL(aufnahme.datei, SOUNDS).href);
    return Promise.resolve(null);
  }
  if (!tierLaedt.has(id)) {
    const arbeit = ladeTierIntern(id)
      .catch((fehler) => {
        console.warn(`[Ton] Tierlaut nicht möglich: ${id}`, fehler);
        return null;
      })
      .then((tier) => {
        tierFertig.set(id, tier);
        tierLaedt.delete(id);
        return tier;
      });
    tierLaedt.set(id, arbeit);
  }
  return tierLaedt.get(id);
}

function spieleTier(id, tier) {
  if (!tier || !tier.verstaerkung) return Promise.resolve(false);
  const vorher = tierLaeuft.get(id);
  if (vorher && vorher.eintrag.ende > ctx.currentTime) {
    // Dauertippen: kurz nach dem Start nichts Neues, danach den alten Laut weich ablösen
    if (ctx.currentTime - vorher.beginn < 0.6) return Promise.resolve(false);
    if (!tippKlangErlaubt()) return Promise.resolve(false);
    blendeAus(vorher.eintrag, 0.1);
  } else if (!tippKlangErlaubt()) {
    return Promise.resolve(false);
  }
  const { eintrag, fertig } = spielePuffer(tier.buf, {
    vol: tier.verstaerkung,
    start: tier.start,
    dauer: tier.dauer,
    streu: 0.02,
    ein: 0.01,
    ausblenden: 0.25,
  });
  tierLaeuft.set(id, { eintrag, beginn: ctx.currentTime });
  return fertig;
}

/** Tierlaut: animal('kuh'). Ergebnis: Promise<boolean>, true am Ende. */
export function animal(id) {
  id = TIER_NAMEN[id] || id;
  if (!bereit()) {
    ladeTier(id);
    return Promise.resolve(false);
  }
  const tier = tierFertig.get(id);
  if (tier !== undefined) return spieleTier(id, tier);
  const angefragt = performance.now();
  return ladeTier(id).then((geladen) =>
    performance.now() - angefragt < 1500 && bereit() ? spieleTier(id, geladen) : false,
  );
}

// ---------- Anbindung an den übrigen Kern ----------

// Ton-Einträge aus den pack.json-Dateien (auch schon geladene) und Töne beim Tippen/Ziehen/Wischen
onAudioRegistered(registerAudio);
setTapSound((id) => sfx(id));

// ---------- Zustand für Eltern-Bereich, Werkzeuge und Tests ----------

export const audioState = {
  get bereit() {
    return !!ctx && !versteckt && (istOffline || ctx.state === 'running');
  },
  get kontext() {
    return ctx;
  },
  /** letzter Knoten vor dem Lautsprecher (zum Messen anschließbar) */
  get ausgang() {
    return kette ? kette.netz : null;
  },
  get musik() {
    return laufend ? laufend.id : null;
  },
  get spricht() {
    return spricht;
  },
  /** id des gerade klingenden Satzes (oder null) */
  get satz() {
    return satz && !satz.aus ? satz.id : null;
  },
  get geraeusche() {
    return ctx ? geraeusche.filter((e) => e.ende > ctx.currentTime).length : 0;
  },
  get einst() {
    return { ...einst };
  },
};
