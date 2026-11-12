// Bilder und Töne aus Paketen (assets/<pack>/pack.json).
// Bilder heißen 'pack/name'. Fehlt ein Bild, gibt tex() eine erzeugte Platzhalter-Textur zurück,
// damit Szenen schon gebaut werden können, bevor die fertigen Bilder da sind.

import { Assets, ImageSource, Sprite, Texture } from 'pixi';

const BASIS = 'assets/';

// Pakete, deren Bilder beim Laden verkleinert werden (größte Seite in Bildpunkten). Die Größe in Einheiten bleibt
// gleich (die Textur bekommt eine Auflösung < 1), Szenen merken davon nichts. 'tiere' (110 Bilder bis 900 px, immer
// geladen) wird höchstens mit dem 0,61-fachen seiner Bildgröße gezeichnet – mit 600 px ist jedes Tier auf dem
// Bildschirm noch mindestens 1:1 scharf, und das Paket braucht nur noch knapp die Hälfte des Speichers.
const VERKLEINERN = { tiere: 600 };

const pakete = new Map();      // id → { bilder: [alias], eigene: [alias], status: 'laedt'|'da', promise }
const nurToene = new Map();    // id → Promise (Paket, von dem nur die Ton-Adressen angemeldet wurden)
const metas = new Map();       // 'pack/name' → { w, h, ax, ay, pts, desc }
const platzhalter = new Map(); // 'pack/name' → Texture

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

// ---------------------------------------------------------------- Pakete

/** Ist das Paket geladen? */
export function isPackLoaded(id) {
  return pakete.get(id)?.status === 'da';
}

/** Liste der geladenen (oder ladenden) Pakete. */
export function loadedPacks() {
  return [...pakete.keys()];
}

/**
 * Paket laden: pack.json lesen, alle Bilder über PIXI.Assets laden, Ton-Adressen merken.
 * onProgress(0…1). Fehler werden nur gewarnt – es gibt keinen Absturz.
 */
export function loadPack(id, onProgress) {
  const da = pakete.get(id);
  if (da) {
    if (onProgress) da.promise.then(() => onProgress(1));
    return da.promise;
  }
  const eintrag = { bilder: [], eigene: [], status: 'laedt', promise: null };
  pakete.set(id, eintrag);
  eintrag.promise = ladePaket(id, eintrag, onProgress);
  return eintrag.promise;
}

async function holePackJson(id) {
  const antwort = await fetch(BASIS + id + '/pack.json', { cache: 'no-cache' });
  if (!antwort.ok) throw new Error('HTTP ' + antwort.status);
  return antwort.json();
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

/**
 * Nur die Ton-Adressen eines Pakets anmelden, ohne seine Bilder zu laden (z. B. die Musik-Stücke für alle Orte).
 * Ein späteres loadPack(id) lädt die Bilder ganz normal. → Promise
 */
export function loadPackAudio(id) {
  if (pakete.has(id)) return pakete.get(id).promise;
  if (!nurToene.has(id)) {
    nurToene.set(id, holePackJson(id).then((pack) => meldeToene(id, pack)).catch((e) => {
      nurToene.delete(id);
      console.warn(`[sigo] Paket '${id}': Ton-Liste nicht lesbar (${e.message}).`);
    }));
  }
  return nurToene.get(id);
}

// Bild verkleinert laden (VERKLEINERN): gleich beim Entpacken auf höchstens `max` Bildpunkte, die Textur behält
// über ihre Auflösung die Größe in Einheiten aus pack.json.
async function ladeVerkleinert(alias, url, b, max) {
  const antwort = await fetch(url);
  if (!antwort.ok) throw new Error('HTTP ' + antwort.status);
  const blob = await antwort.blob();
  const f = max / Math.max(b.w, b.h);
  const breite = Math.max(1, Math.round(b.w * f));
  const hoehe = Math.max(1, Math.round(b.h * f));
  const bitmap = await createImageBitmap(blob, { resizeWidth: breite, resizeHeight: hoehe, resizeQuality: 'high' });
  const source = new ImageSource({
    resource: bitmap,
    alphaMode: 'premultiply-alpha-on-upload',
    resolution: breite / b.w,
    autoGenerateMipmaps: true,
    label: alias,
  });
  const t = new Texture({ source, label: alias });
  Assets.cache.set(alias, t);
  return t;
}

async function ladePaket(id, eintrag, onProgress) {
  const ordner = BASIS + id + '/';
  let pack = null;
  try {
    pack = await holePackJson(id);
  } catch (e) {
    console.warn(`[sigo] Paket '${id}': pack.json fehlt oder ist kaputt (${e.message}) – es gibt Platzhalter.`);
    eintrag.status = 'da';
    onProgress?.(1);
    return;
  }
  meldeToene(id, pack);

  // Bilder einzeln laden, damit ein fehlendes Bild die anderen nicht mitreißt
  const liste = Object.entries(pack.images || {}).filter(([, b]) => b && b.file);
  let fertig = 0;
  onProgress?.(liste.length ? 0 : 1);
  await Promise.all(liste.map(async ([name, b]) => {
    const alias = id + '/' + name;
    const max = VERKLEINERN[id];
    try {
      if (max && b.w > 0 && b.h > 0 && Math.max(b.w, b.h) > max && typeof createImageBitmap === 'function') {
        await ladeVerkleinert(alias, ordner + b.file, b, max);
        eintrag.eigene.push(alias);
      } else {
        await Assets.load({ alias, src: ordner + b.file, data: { autoGenerateMipmaps: true } });
        eintrag.bilder.push(alias);
      }
      metas.set(alias, {
        w: b.w, h: b.h,
        ax: b.ax ?? 0.5, ay: b.ay ?? 0.5,
        pts: b.pts || {},
        desc: b.desc || '',
      });
    } catch (e) {
      console.warn(`[sigo] Bild '${alias}' (${b.file}) nicht ladbar – Platzhalter.`, e?.message || e);
    }
    fertig++;
    onProgress?.(fertig / liste.length);
  }));
  eintrag.status = 'da';
}

/** Paket freigeben (Texturen werden zerstört). Sprites damit müssen vorher weg sein. */
export async function unloadPack(id) {
  const eintrag = pakete.get(id);
  if (!eintrag) return;
  pakete.delete(id);
  await eintrag.promise?.catch(() => {});
  for (const alias of [...eintrag.bilder, ...eintrag.eigene]) metas.delete(alias);
  for (const alias of eintrag.eigene) {
    const t = Assets.cache.has(alias) ? Assets.cache.get(alias) : null;
    Assets.cache.remove(alias);
    try {
      const bitmap = t?.source?.resource;
      t?.destroy(true);
      bitmap?.close?.();
    } catch (e) {
      console.warn(`[sigo] Bild '${alias}' ließ sich nicht freigeben:`, e);
    }
  }
  if (eintrag.bilder.length) {
    try {
      await Assets.unload(eintrag.bilder);
    } catch (e) {
      console.warn(`[sigo] Paket '${id}' ließ sich nicht ganz freigeben:`, e);
    }
  }
}

// ---------------------------------------------------------------- Bilder

/** Gibt es das echte Bild? */
export function hasTex(id) {
  return Assets.cache.has(id);
}

/** Textur zu 'pack/name' – fehlt sie, kommt ein Platzhalter (und die id landet in `fehlend`). */
export function tex(id) {
  if (Assets.cache.has(id)) {
    const t = Assets.get(id);
    if (t && !t.destroyed) return t;
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
