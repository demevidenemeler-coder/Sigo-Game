// Bilder und Töne aus Paketen (assets/<pack>/pack.json).
// Bilder heißen 'pack/name'. Fehlt ein Bild, gibt tex() eine erzeugte Platzhalter-Textur zurück,
// damit Szenen schon gebaut werden können, bevor die fertigen Bilder da sind.
//
// Laden (schnell, siehe ENTWICKLUNG.md „Pakete und Laden"):
// - Bilder werden selbst geholt und entpackt (fetch → createImageBitmap, das Entpacken läuft im Browser neben dem
//   Hauptthread) – nicht über PIXI.Assets: Dessen Lader teilt Texturen je Adresse, und gibt eine Szene ihr eigenes
//   Exemplar frei (Album), wäre sonst auch das des Kerns zerstört.
// - Ein Paket kann TEILWEISE geladen sein: Vom Paket 'tiere' lädt eine Szene mit `static tiere = ['kuh', …]` nur
//   diese Tiere (alle Posen tiere/kuh_*; ein genauer Bildname wie 'kuh_happy' lädt nur dieses Bild).
//   `ladeTiere([...])` lädt später nach. Die Liste der Bilder (pack.json) ist immer ganz bekannt: meta() stimmt
//   auch für ein noch nicht geladenes Bild, und tex() gibt dafür ein „Wartebild" in der richtigen Größe zurück,
//   das sich von selbst in das echte Bild verwandelt, sobald es da ist (im Testbetrieb mit Warnung).
// - Bildgrößen: pack.json `w`/`h` sind Einheiten; `res` < 1 heißt, die Datei ist kleiner abgelegt (Bildpunkte je
//   Einheit, z. B. Tiere 600 statt 900 Bildpunkte – tools/bild.py verkleinern). Szenen merken davon nichts.
// - Mipmaps nur für Bilder, die verkleinert gezeigt werden (Figuren, Dinge) – nicht für Hintergründe, die
//   ohnehin 1:1 gezeichnet werden (spart Zeit beim Hochladen und ein Drittel Grafikspeicher).
// - Leise laden (Vorausladen): höchstens zwei Bilder gleichzeitig, nur wenn kein Szenenwechsel läuft und die
//   Bildrate stimmt. Braucht eine Szene ein Bild, das gerade leise wartet, wird es sofort geholt.

import { Assets, ImageSource, Sprite, Texture } from 'pixi';
import { stage } from './stage.js';

const BASIS = 'assets/';
const TIER_PAKET = 'tiere';
const TEST = (() => { try { return new URLSearchParams(location.search).get('test') === '1'; } catch { return false; } })();
const LEISE_GLEICHZEITIG = 2;      // Vorausladen: so viele Bilder auf einmal
const LEISE_BILD_MS = 22;          // Vorausladen nur, wenn die mittlere Bildzeit darunter liegt

// Paket: { id, json: Promise<pack|null>, daten: pack|null, bilder: Map(name → Bild), offen, status }
// Bild:  { alias, b, da, fehler, textur, promise, starte(), gestartet, verworfen, zuletzt }
const pakete = new Map();
const nurToene = new Map();    // id → Promise (Paket, von dem nur die Ton-Adressen angemeldet wurden)
const metas = new Map();       // 'pack/name' → { w, h, ax, ay, pts, desc }
const platzhalter = new Map(); // 'pack/name' → Texture (Bild gibt es nicht)
const warteBilder = new Map(); // 'pack/name' → Texture (Bild gibt es, ist aber noch nicht geladen)
const packJsons = new Map();   // id → Promise<pack|null>
const tierQuellen = new Set(); // fn(Klasse) → weitere Tiernamen (z. B. Gäste im gespeicherten Zug)
let szenenName = '';           // für Warnungen: welche Szene gerade läuft
let wechselLaeuft = false;     // während eines Szenenwechsels lädt nichts leise

/** Ton-Adressen aus allen geladenen Paketen: 'pack/name' → URL. audio.js liest hier. */
export const audioUrls = new Map();
const audioHoerer = new Set();

/** Ruft cb(id, url) für jeden (auch schon bekannten) Ton-Eintrag auf. → Abmelde-Funktion */
export function onAudioRegistered(cb) {
  audioHoerer.add(cb);
  for (const [id, url] of audioUrls) cb(id, url);
  return () => audioHoerer.delete(cb);
}

/** ids, für die Platzhalter erzeugt wurden (auch unter window.__sigo.fehlend). */
export const fehlend = [];

// ---------------------------------------------------------------- pack.json

/** pack.json eines Pakets (einmal geholt und gemerkt). → Promise<pack|null> */
export function packJson(id) {
  if (!packJsons.has(id)) {
    const p = fetch(BASIS + id + '/pack.json', { cache: 'no-cache' })
      .then((antwort) => {
        if (!antwort.ok) throw new Error('HTTP ' + antwort.status);
        return antwort.json();
      })
      .catch((e) => {
        packJsons.delete(id);   // später noch einmal versuchen
        console.warn(`[sigo] Paket '${id}': pack.json fehlt oder ist kaputt (${e.message}) – es gibt Platzhalter.`);
        return null;
      });
    packJsons.set(id, p);
  }
  return packJsons.get(id);
}

// Töne: nur Adressen merken, laden tut audio.js
function meldeToene(id, pack) {
  const ordner = BASIS + id + '/';
  for (const [name, a] of Object.entries(pack.audio || {})) {
    if (!a || !a.file) continue;
    const key = id + '/' + name;
    const url = ordner + a.file;
    if (audioUrls.get(key) === url) continue;
    audioUrls.set(key, url);
    for (const cb of audioHoerer) {
      try { cb(key, url); } catch (e) { console.error('[sigo] onAudioRegistered:', e); }
    }
  }
}

// Bilder des Pakets bekannt machen (meta() und Wartebilder gehen dann auch für noch nicht geladene Bilder)
function meldeBilder(id, pack) {
  for (const [name, b] of Object.entries(pack.images || {})) {
    if (!b || !b.file) continue;
    metas.set(id + '/' + name, {
      w: b.w, h: b.h,
      ax: b.ax ?? 0.5, ay: b.ay ?? 0.5,
      pts: b.pts || {},
      desc: b.desc || '',
    });
  }
}

/**
 * Nur die Ton-Adressen eines Pakets anmelden, ohne seine Bilder zu laden (z. B. die Musik-Stücke für alle Orte).
 * Ein späteres loadPack(id) lädt die Bilder ganz normal. → Promise
 */
export function loadPackAudio(id) {
  if (pakete.has(id)) return pakete.get(id).json.then(() => {});
  if (!nurToene.has(id)) {
    nurToene.set(id, packJson(id).then((pack) => {
      if (pack) meldeToene(id, pack);
      else nurToene.delete(id);
    }));
  }
  return nurToene.get(id);
}

// ---------------------------------------------------------------- Pakete

/** Ist das Paket geladen (alles, was von ihm verlangt wurde)? */
export function isPackLoaded(id) {
  return pakete.get(id)?.status === 'da';
}

/** Liste der geladenen (oder ladenden) Pakete. */
export function loadedPacks() {
  return [...pakete.keys()];
}

function paket(id) {
  let p = pakete.get(id);
  if (!p) {
    p = { id, daten: null, bilder: new Map(), offen: 0, status: 'laedt' };
    p.json = packJson(id).then((pack) => {
      if (pakete.get(id) !== p) return null;
      if (pack) {
        p.daten = pack;
        meldeToene(id, pack);
        meldeBilder(id, pack);
      }
      return pack;
    });
    pakete.set(id, p);
  }
  return p;
}

// Bildnamen zu einer Auswahl: genaue Namen ('kuh_happy') oder Tiernamen ('kuh' → kuh_idle, kuh_happy, …)
function namenFuer(pack, auswahl, id) {
  const alle = Object.keys(pack.images || {});
  const namen = new Set();
  for (const a of auswahl) {
    if (typeof a !== 'string' || !a) continue;
    if (pack.images[a]) { namen.add(a); continue; }
    const passend = alle.filter((n) => n.startsWith(a + '_'));
    if (!passend.length) warnungEinmal(`unbekannt:${id}/${a}`, `[sigo] Paket '${id}' hat nichts zu '${a}' (static tiere / ladeTiere prüfen).`);
    for (const n of passend) namen.add(n);
  }
  return [...namen];
}

/**
 * Paket laden: pack.json lesen, Bilder holen und entpacken, Ton-Adressen merken.
 * loadPack(id, onProgress) oder loadPack(id, {nur: ['kuh', 'schaf_seite'], leise, onProgress}).
 * `nur`: nur diese Bilder/Tiere (sonst alle). `leise`: im Hintergrund (Vorausladen, siehe oben).
 * Fehler werden nur gewarnt – es gibt keinen Absturz. → Promise (wenn alles Verlangte da ist)
 */
export function loadPack(id, opt) {
  const { nur = null, leise = false, onProgress = null, zuerst = null } = typeof opt === 'function' ? { onProgress: opt } : (opt || {});
  const p = paket(id);
  p.offen++;
  p.status = 'laedt';
  const arbeit = (async () => {
    const pack = await p.json;
    if (!pack || pakete.get(id) !== p) return;
    const namen = nur ? namenFuer(pack, nur, id) : Object.keys(pack.images || {});
    let liste = namen.map((n) => [n, pack.images[n]]).filter(([, b]) => b && b.file);
    // zuerst (Set 'pack/name'): nur diese mit voller Kraft laden und abwarten, den Rest leise hinterher
    if (zuerst) {
      const spaeter = liste.filter(([n]) => !zuerst.has(id + '/' + n));
      for (const [name, b] of spaeter) ladeBild(p, name, b, true);
      liste = liste.filter(([n]) => zuerst.has(id + '/' + n));
    }
    let fertig = 0;
    onProgress?.(liste.length ? 0 : 1);
    await Promise.all(liste.map(([name, b]) => ladeBild(p, name, b, leise).then(() => {
      fertig++;
      onProgress?.(fertig / liste.length);
    })));
  })().catch((e) => console.warn(`[sigo] Paket '${id}':`, e?.message || e)).finally(() => {
    if (--p.offen <= 0) {
      p.offen = 0;
      p.status = 'da';
    }
  });
  return arbeit;
}

// ---------------------------------------------------------------- einzelne Bilder

const mitMipmaps = (b) => !(b.w >= 2000 && b.h >= 1400);   // Hintergründe (1600 hoch, ≥ 2133 breit) ohne

// Bildpunkte je Einheit: aus der echten Größe der Datei und w/h (Einheiten) aus pack.json. So stimmt die Größe im
// Spiel immer – auch wenn pack.json und Bilddatei nicht zur selben Fassung gehören (z. B. ein altes 900er-Tierbild
// aus einem Zwischenspeicher neben einer neuen pack.json mit res 0,667). Ohne w/h gilt `res` (sonst 1).
function aufloesungFuer(b, breite, hoehe) {
  const angabe = b.res > 0 && b.res < 1 ? b.res : 1;
  if (!(b.w > 0) || !(breite > 0)) return angabe;
  const r = breite / b.w;
  // Längere Seite nehmen (genauer); weicht sie nur um Rundung ab, bleibt die Angabe aus pack.json
  const echt = b.h > 0 && hoehe > 0 && b.h > b.w ? hoehe / b.h : r;
  return Math.abs(echt - angabe) * Math.max(b.w, b.h || 0) < 1.5 ? angabe : echt;
}

async function holeTextur(alias, url, b) {
  if (typeof createImageBitmap !== 'function') {
    // sehr alter Browser: über PIXI.Assets (dort mit eigenem Lader)
    const aufloesung = b.res > 0 && b.res < 1 ? b.res : 1;
    return Assets.load({ alias: 'kern:' + alias, src: url, data: { resolution: aufloesung, autoGenerateMipmaps: mitMipmaps(b) } });
  }
  const antwort = await fetch(url);
  if (!antwort.ok) throw new Error('HTTP ' + antwort.status);
  const blob = await antwort.blob();
  const bitmap = await createImageBitmap(blob);
  const source = new ImageSource({
    resource: bitmap,
    alphaMode: 'premultiply-alpha-on-upload',
    resolution: aufloesungFuer(b, bitmap.width, bitmap.height),
    autoGenerateMipmaps: mitMipmaps(b),
    label: alias,
  });
  return new Texture({ source, label: alias });
}

function zerstoere(t) {
  if (!t || t.destroyed) return;
  try {
    const bitmap = t.source?.resource;
    t.destroy(true);
    bitmap?.close?.();
  } catch (e) {
    console.warn(`[sigo] Bild '${t.label}' ließ sich nicht freigeben:`, e);
  }
}

function ladeBild(p, name, b, leise = false) {
  let bild = p.bilder.get(name);
  if (bild) {
    if (!leise && !bild.gestartet) bild.starte();   // wartete leise – jetzt sofort
    return bild.promise;
  }
  const alias = p.id + '/' + name;
  bild = { alias, b, da: false, textur: null, gestartet: false, verworfen: false, zuletzt: performance.now() };
  let fertig;
  bild.promise = new Promise((r) => { fertig = r; });
  bild.starte = (laut = true) => {
    if (bild.gestartet) return;
    bild.gestartet = true;
    const i = leiseReihe.indexOf(bild);
    if (i >= 0) leiseReihe.splice(i, 1);
    if (laut) zaehleLaden(+1);
    holeTextur(alias, BASIS + p.id + '/' + b.file, b).then((t) => {
      if (bild.verworfen || p.bilder.get(name) !== bild || pakete.get(p.id) !== p) {
        zerstoere(t);
        return;
      }
      bild.da = true;
      bild.textur = t;
      Assets.cache.set(alias, t);
      verwandleWartebild(alias, t);
    }).catch((e) => {
      bild.fehler = true;          // tex() gibt dann den Platzhalter (wie bei einem fehlenden Bild)
      if (!bild.verworfen) console.warn(`[sigo] Bild '${alias}' (${b.file}) nicht ladbar – Platzhalter.`, e?.message || e);
    }).finally(() => {
      if (laut) zaehleLaden(-1);
      fertig();
    });
  };
  p.bilder.set(name, bild);
  if (leise) {
    leiseReihe.push(bild);
    pumpeLeise();
  } else {
    bild.starte();
  }
  return bild.promise;
}

function gibBildFrei(p, name) {
  const bild = p.bilder.get(name);
  if (!bild) return;
  p.bilder.delete(name);
  bild.verworfen = true;
  const i = leiseReihe.indexOf(bild);
  if (i >= 0) leiseReihe.splice(i, 1);
  if (!bild.gestartet) {
    bild.gestartet = true;
    bild.starte = () => {};
  }
  if (bild.da) {
    if (Assets.cache.has(bild.alias) && Assets.cache.get(bild.alias) === bild.textur) Assets.cache.remove(bild.alias);
    zerstoere(bild.textur);
    bild.textur = null;
    bild.da = false;
  }
}

/** Paket freigeben (Texturen werden zerstört). Sprites damit müssen vorher weg sein. */
export async function unloadPack(id) {
  const p = pakete.get(id);
  if (!p) return;
  pakete.delete(id);
  for (const name of [...p.bilder.keys()]) gibBildFrei(p, name);
  for (const alias of [...metas.keys()]) if (alias.startsWith(id + '/')) metas.delete(alias);
}

// ---------------------------------------------------------------- Lädt das Spiel gerade (mit voller Kraft)?

// Zählt Bilder, die gerade mit voller Kraft geladen werden (nicht das leise Vorausladen). main.js sagt es dem
// Service Worker: Solange das Spiel selbst Bilder braucht, holt seine Installation nichts Neues (Leitung frei).
let lautOffen = 0;
const ladeHoerer = new Set();

function zaehleLaden(d) {
  const vorher = lautOffen > 0;
  lautOffen = Math.max(0, lautOffen + d);
  const jetzt = lautOffen > 0;
  if (vorher === jetzt) return;
  for (const cb of ladeHoerer) {
    try { cb(jetzt); } catch (e) { console.error('[sigo] onLaden:', e); }
  }
}

/** cb(true), sobald Bilder mit voller Kraft geladen werden, cb(false), wenn keins mehr offen ist. → Abmelde-Funktion */
export function onLaden(cb) {
  ladeHoerer.add(cb);
  return () => ladeHoerer.delete(cb);
}

/** Werden gerade Bilder mit voller Kraft geladen? */
export function laedtGerade() {
  return lautOffen > 0;
}

// ---------------------------------------------------------------- leise laden (Vorausladen)

const leiseReihe = [];
let leiseLaufen = 0;
let leiseUhr = 0;

function pumpeLeise() {
  if (leiseUhr) return;
  while (leiseReihe.length && leiseLaufen < LEISE_GLEICHZEITIG) {
    if (wechselLaeuft || (stage.app && stage.frameMs > LEISE_BILD_MS) || document.hidden) {
      leiseUhr = setTimeout(() => { leiseUhr = 0; pumpeLeise(); }, 250);
      return;
    }
    const bild = leiseReihe.shift();
    if (bild.gestartet) continue;
    leiseLaufen++;
    bild.starte(false);
    bild.promise.finally(() => {
      leiseLaufen--;
      // Häppchen: zwischen zwei Bildern ein Bild lang Luft lassen
      requestAnimationFrame(() => pumpeLeise());
    });
  }
}

// ---------------------------------------------------------------- Tiere und Bedarf einer Szene

/**
 * Weitere Tiernamen für eine Szene melden (z. B. die Gäste im gespeicherten Zug): fn(SzenenKlasse) → ['kuh', …].
 * Gilt nur für Szenen mit `static tiere`. → Abmelde-Funktion
 */
export function tierBedarf(fn) {
  tierQuellen.add(fn);
  return () => tierQuellen.delete(fn);
}

/**
 * Was braucht eine Szene? → { packs: Set, tiere: [namen] | null (= alle aus 'tiere') }
 * Mit `static tiere` wird aus 'tiere' nur das Genannte geladen (und 'tiere' gehört dann sicher dazu).
 */
export function bedarfFuer(Klasse) {
  const packs = new Set(['common', ...(Klasse?.packs || [])]);
  let tiere = null;
  if (Array.isArray(Klasse?.tiere)) {
    packs.add(TIER_PAKET);
    const alle = new Set(Klasse.tiere);
    for (const fn of tierQuellen) {
      try { for (const t of fn(Klasse) || []) alle.add(t); } catch (e) { console.warn('[sigo] tierBedarf:', e); }
    }
    tiere = [...alle];
  }
  return { packs, tiere };
}

/**
 * Den Bedarf laden (leise = Vorausladen im Hintergrund). Mit `zuerst` (Set 'pack/name') werden nur diese Bilder
 * mit voller Kraft geladen und abgewartet, alle anderen des Bedarfs leise hinterher. → Promise
 */
export function ladeBedarf(bedarf, { leise = false, zuerst = null } = {}) {
  return Promise.all([...bedarf.packs].map((id) => (
    id === TIER_PAKET && bedarf.tiere ? loadPack(id, { nur: bedarf.tiere, leise, zuerst }) : loadPack(id, { leise, zuerst })
  ))).then(() => {});
}

// ---------------------------------------------------------------- Probe beim Aufbau (schneller erster Start)

// Während der Kern die erste Szene mit nur einem Teil ihrer Bilder aufbaut, merkt er sich, welche Bilder die Szene
// anfasst (tex/hasTex) – und welche davon noch nicht geladen waren („verfehlt“: dann baut der Kern sie mit allen
// Bildern noch einmal auf, unsichtbar hinter der Blende).
let probe = null;

export function beginneProbe() {
  probe = { beruehrt: new Set(), verfehlt: new Set() };
}

/** → { beruehrt: ['pack/name', …], verfehlt: […] } (nur bekannte Bilder aus pack.json) */
export function endeProbe() {
  const p = probe;
  probe = null;
  return { beruehrt: p ? [...p.beruehrt] : [], verfehlt: p ? [...p.verfehlt] : [] };
}

function probeMerke(id) {
  if (!probe || !metas.has(id)) return;
  probe.beruehrt.add(id);
  if (!Assets.cache.has(id)) probe.verfehlt.add(id);
}

/**
 * Tiere nachladen, die eine Szene später braucht: await ladeTiere(['fuchs']) (alle Posen; auch genaue Bildnamen
 * wie 'fuchs_happy'). Schon Geladenes kostet nichts. → Promise
 */
export function ladeTiere(namen) {
  return loadPack(TIER_PAKET, { nur: Array.isArray(namen) ? namen : [namen] });
}

/** Mittel-Bildpunkte eines Pakets (alle Bilder, in Bildpunkten der Dateien) – für die Speicher-Rechnung. */
export function paketMpx(id) {
  const pack = pakete.get(id)?.daten;
  if (!pack) return 0;
  let s = 0;
  for (const b of Object.values(pack.images || {})) {
    const r = b.res > 0 && b.res < 1 ? b.res : 1;
    s += (b.w || 0) * (b.h || 0) * r * r;
  }
  return s / 1e6;
}

/**
 * Aufräumen beim Szenenwechsel (die alte Szene ist schon weg): Pakete, die weder gebraucht werden noch immer
 * bleiben noch in `behalten` stehen, werden freigegeben; vom Tier-Paket bleiben die gebrauchten Bilder und die
 * `tierVorrat` zuletzt benutzten.
 */
export function raeumeAuf(bedarf, { bleiben = new Set(), behalten = new Set(), tierVorrat = 30 } = {}) {
  for (const id of loadedPacks()) {
    if (bedarf.packs.has(id) || bleiben.has(id) || behalten.has(id)) continue;
    unloadPack(id);
  }
  const p = pakete.get(TIER_PAKET);
  if (!p || !bedarf.tiere || !p.daten) return;
  const noetig = new Set(namenFuer(p.daten, bedarf.tiere, TIER_PAKET));
  const uebrig = [...p.bilder.entries()].filter(([n]) => !noetig.has(n)).sort((a, b) => b[1].zuletzt - a[1].zuletzt);
  for (const [name] of uebrig.slice(tierVorrat)) gibBildFrei(p, name);
}

/** Kern: Szenenwechsel läuft (kein leises Laden) / Name der Szene für Warnungen. */
export function setzeWechsel(an, szene) {
  wechselLaeuft = an;
  if (szene !== undefined) szenenName = szene || '';
  if (!an) pumpeLeise();
}

// ---------------------------------------------------------------- Bilder

/** Gibt es das echte Bild (geladen)? */
export function hasTex(id) {
  if (probe) probeMerke(id);
  return Assets.cache.has(id);
}

/** Steht das Bild in einer gelesenen pack.json (auch wenn es noch nicht geladen ist)? */
export function bildBekannt(id) {
  return metas.has(id);
}

const warnungen = new Set();
function warnungEinmal(schluessel, text) {
  if (warnungen.has(schluessel)) return;
  warnungen.add(schluessel);
  console.warn(text);
}

// Wartebild: durchsichtig und so groß wie das echte Bild (in Einheiten); wird zum echten Bild, sobald es da ist
function baueWartebild(id, m) {
  const w = Math.max(1, m.w || 300);
  const h = Math.max(1, m.h || 300);
  const k = Math.max(w, h) / 16;            // höchstens 16 Bildpunkte – reicht für „unsichtbar"
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w / k));
  c.height = Math.max(1, Math.round(h / k));
  const source = new ImageSource({ resource: c, resolution: c.width / w, autoGenerateMipmaps: false, label: 'warte:' + id });
  return new Texture({ source, label: 'warte:' + id, dynamic: true });
}

function verwandleWartebild(alias, echt) {
  const t = warteBilder.get(alias);
  if (!t) return;
  warteBilder.delete(alias);
  if (t.destroyed || !echt || echt.destroyed) return;
  const alt = t.source;
  t.source = echt.source;
  t.update();
  try { alt.destroy(); } catch { /* egal */ }
}

/** Textur zu 'pack/name' – fehlt sie, kommt ein Platzhalter (und die id landet in `fehlend`). */
export function tex(id) {
  if (probe) probeMerke(id);
  if (Assets.cache.has(id)) {
    const t = Assets.get(id);
    if (t && !t.destroyed) {
      const p = pakete.get(id.slice(0, id.indexOf('/')));
      const bild = p?.bilder.get(id.slice(id.indexOf('/') + 1));
      if (bild) bild.zuletzt = performance.now();
      return t;
    }
  }
  // Bekannt, aber (noch) nicht geladen: Wartebild, das Bild kommt sofort nach
  const m = metas.get(id);
  const stelle = id.indexOf('/');
  const p = stelle > 0 ? pakete.get(id.slice(0, stelle)) : null;
  if (m && p?.daten) {
    const name = id.slice(stelle + 1);
    const b = p.daten.images?.[name];
    const bild = p.bilder.get(name);
    if (b && b.file && !bild?.fehler) {
      let t = warteBilder.get(id);
      if (!t || t.destroyed) {
        t = baueWartebild(id, m);
        warteBilder.set(id, t);
      }
      // Im Testbetrieb sichtbar machen, damit vergessene Angaben auffallen (gerade leise ladende Bilder nicht)
      if (TEST && !bild) {
        const tipp = p.id === TIER_PAKET
          ? `'${name.replace(/_[^_]+$/, '')}' in static tiere der Szene eintragen oder ladeTiere() rufen`
          : `Paket '${p.id}' in static packs eintragen`;
        warnungEinmal(`warte:${szenenName}:${id}`,
          `[sigo] Bild '${id}' war nicht geladen${szenenName ? ` (Szene '${szenenName}')` : ''} – lädt jetzt nach (${tipp}).`);
      }
      ladeBild(p, name, b, false);
      return t;
    }
  }
  let t = platzhalter.get(id);
  if (!t) {
    t = baueAttrappe(id);
    platzhalter.set(id, t);
    fehlend.push(id);
    console.warn(`[sigo] Bild '${id}' fehlt – Platzhalter.`);
  }
  return t;
}

/** Daten aus pack.json: {w, h, ax, ay, pts, desc}. */
export function meta(id) {
  const m = metas.get(id);
  if (m) return m;
  const t = hasTex(id) ? Assets.get(id) : null;
  return { w: t ? t.width : 300, h: t ? t.height : 300, ax: 0.5, ay: 0.5, pts: {}, desc: '' };
}

/**
 * Sprite bauen: spr('pack/name', {x, y, scale, alpha, rotation, flip, anchor, parent, z, tint, visible})
 * Anker kommt aus pack.json, wenn nicht angegeben.
 */
export function spr(id, opt = {}) {
  const s = new Sprite(tex(id));
  s.label = id;
  if (opt.anchor !== undefined) {
    const a = opt.anchor;
    if (typeof a === 'number') s.anchor.set(a);
    else if (Array.isArray(a)) s.anchor.set(a[0], a[1]);
    else s.anchor.set(a.x, a.y);
  } else {
    const m = meta(id);
    s.anchor.set(m.ax, m.ay);
  }
  if (opt.scale !== undefined) {
    if (typeof opt.scale === 'number') s.scale.set(opt.scale);
    else s.scale.set(opt.scale.x, opt.scale.y);
  }
  if (opt.flip) s.scale.x = -Math.abs(s.scale.x);
  s.x = opt.x ?? 0;
  s.y = opt.y ?? 0;
  if (opt.alpha !== undefined) s.alpha = opt.alpha;
  if (opt.rotation !== undefined) s.rotation = opt.rotation;
  if (opt.tint !== undefined) s.tint = opt.tint;
  if (opt.visible !== undefined) s.visible = opt.visible;
  if (opt.z !== undefined) s.zIndex = opt.z;
  if (opt.parent) opt.parent.addChild(s);
  return s;
}

/** Punkt aus pack.json (pts) in Koordinaten des Sprites (relativ zum Anker, ohne Skalierung). */
export function localPoint(id, name) {
  const m = meta(id);
  const p = m.pts?.[name];
  if (!p) return null;
  return { x: p[0] - m.ax * m.w, y: p[1] - m.ay * m.h };
}

// ---------------------------------------------------------------- Platzhalter

function farbtonAus(text) {
  let h = 0;
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) >>> 0;
  return h % 360;
}

function baueAttrappe(id) {
  const G = 300;
  const c = document.createElement('canvas');
  c.width = G;
  c.height = G;
  const g = c.getContext('2d');
  const ton = farbtonAus(id);
  g.fillStyle = `hsl(${ton} 55% 82%)`;
  g.strokeStyle = `hsl(${ton} 40% 58%)`;
  g.lineWidth = 8;
  g.beginPath();
  g.roundRect(8, 8, G - 16, G - 16, 60);
  g.fill();
  g.stroke();

  // Name klein in die Mitte (nur für Entwickler sichtbar, solange das Bild fehlt)
  const [pack, ...rest] = id.split('/');
  const name = rest.join('/') || pack;
  g.fillStyle = `hsl(${ton} 35% 32%)`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  let px = 40;
  g.font = `bold ${px}px sans-serif`;
  while (g.measureText(name).width > G - 50 && px > 14) {
    px -= 2;
    g.font = `bold ${px}px sans-serif`;
  }
  g.fillText(name, G / 2, G / 2);
  if (rest.length) {
    g.font = '22px sans-serif';
    g.fillText(pack, G / 2, G / 2 + px);
  }
  const t = Texture.from(c);
  t.label = 'platzhalter:' + id;
  return t;
}
