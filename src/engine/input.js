// Eingabe für kleine Hände: tap, drag, wipe, hold.
//
// - Ausgelöst wird beim Berühren (Pixi-Ereignis 'pointerdown' auf dem Ding, mit vergrößerter Tippfläche).
// - Bewegung und Loslassen laufen über globale Listener am Fenster (auch pointercancel, Fenster verlässt Fokus),
//   damit nichts „kleben" bleibt.
// - Mehrere Finger: Tabelle pointerId → Finger. Jeder Finger zieht höchstens ein Ding,
//   jedes Ding hängt an höchstens einem Finger.
// - Jede Eingabe gehört dem aktuellen Besitzer (der Szene) und wird mit ihm beendet (offInputs).

import { Container, Point, Rectangle, RenderTexture, Sprite, Texture } from 'pixi';
import { stage } from './stage.js';
import { tween, killTweensOf, after, scaleFeedback, resetScale } from './tween.js';
import { clamp, warnOnce } from './util.js';
import { isTest } from './test.js';

// ---------------------------------------------------------------- Grundzustand

const finger = new Map();          // pointerId → { move(p), end(abgebrochen) }
const anFinger = new Set();        // Dinge, die gerade an einem Finger hängen
let gesperrt = false;              // während der Blende
let besitzer = null;               // aktuelle Szene
const handlesVon = new Map();      // besitzer → Set(handle)
const eingabeHoerer = new Set();   // onInput-Rückrufe
const tickHoerer = new Set();      // hold-Zähler pro Bild
let tippTon = () => {};            // wird von audio.js gesetzt

/** Ton-Haken: fn(soundId, art) mit art = 'tap' | 'wipe' | 'drag' | 'drop' | 'hold'. */
export function setTapSound(fn) {
  tippTon = typeof fn === 'function' ? fn : () => {};
}

function spieleTon(id, art) {
  if (!id) return;
  try { tippTon(id, art); } catch (e) { console.warn('[sigo] Tipp-Ton:', e); }
}

/** Eingabe sperren (Blende). Laufende Finger werden dabei sauber beendet. */
export function setInputLocked(an) {
  gesperrt = !!an;
  if (gesperrt) cancelAllFingers();
}

export function isInputLocked() {
  return gesperrt;
}

/** Besitzer für neue Eingaben (setzt der Szenen-Verwalter). */
export function setInputOwner(o) {
  besitzer = o;
}

/** Alle Eingaben eines Besitzers beenden. */
export function offInputs(o) {
  const set = handlesVon.get(o);
  if (!set) return;
  handlesVon.delete(o);
  for (const h of [...set]) h.off();
}

/** Rückruf bei jeder Eingabe (Leerlauf-Uhr, Zeige-Hand). → Abmelde-Funktion */
export function onInput(cb) {
  richteListenerEin(); // auch Szenen ganz ohne tap/drag zählen Berührungen
  eingabeHoerer.add(cb);
  return () => eingabeHoerer.delete(cb);
}

function meldeEingabe() {
  for (const cb of eingabeHoerer) {
    try { cb(); } catch (e) { console.error('[sigo] onInput:', e); }
  }
}

const tippHoerer = new Set();

/**
 * Rückruf cb(obj) bei jedem Antippen über tap() – direkt beim Berühren, bevor die Szene reagiert (z. B. damit der
 * Kern schon beim Tipp auf einen Ort dessen Bilder anfordert). → Abmelde-Funktion
 */
export function onTap(cb) {
  tippHoerer.add(cb);
  return () => tippHoerer.delete(cb);
}

function meldeTipp(obj) {
  for (const cb of tippHoerer) {
    try { cb(obj); } catch (e) { console.error('[sigo] onTap:', e); }
  }
}

/** Jedes Bild vom Szenen-Verwalter aufgerufen (für hold). */
export function updateInput(dt) {
  for (const fn of [...tickHoerer]) fn(dt);
}

/** Alle Finger loslassen (z. B. Tab im Hintergrund). */
export function cancelAllFingers() {
  for (const [id, f] of [...finger]) {
    finger.delete(id);
    f.end(true);
  }
}

/** Anzahl aktiver Finger, die gerade ein Ding ziehen/halten/wischen (zum Testen). */
export function activeFingers() {
  return finger.size;
}

// Alle gedrückten Zeiger (auch ein Finger, der still auf einem tap-Ding ruht):
// pointerId → { zeit: letzte Regung (ms), gross: Berührfläche größer als eine Fingerkuppe }
const gedrueckt = new Map();
const VERGESSEN_NACH = 20000; // ms ohne pointerup/-move: gilt als losgelassen (Schutz gegen verlorene Ereignisse)
const FINGER_MAX = 70;        // CSS-Pixel: größere Berührflächen (Handballen, flache Hand) gelten als „groß"

function vergissAlte() {
  const jetzt = performance.now();
  for (const [id, z] of gedrueckt) if (jetzt - z.zeit > VERGESSEN_NACH) gedrueckt.delete(id);
}

/** Liegt gerade irgendein Finger (oder die gedrückte Maus) auf dem Bildschirm? (Leerlauf-Uhr ruht dann) */
export function anyPointerDown() {
  vergissAlte();
  return gedrueckt.size > 0;
}

/**
 * Wie viele Finger (Zeiger) liegen gerade auf dem Bildschirm? Mit {gross: true} zählt eine große Berührfläche
 * (Handballen) wie viele Finger – so lässt sich „genau ein kleiner Finger" prüfen: pointerCount({gross:true}) === 1.
 */
export function pointerCount({ gross = false } = {}) {
  vergissAlte();
  let n = 0;
  for (const z of gedrueckt.values()) n += gross && z.gross ? 99 : 1;
  return n;
}

const istGross = (ev) => ev.pointerType === 'touch' && Math.max(ev.width || 0, ev.height || 0) > FINGER_MAX;

// Fenster-Koordinaten → Pixi-Bildschirm-Koordinaten
const tmp = new Point();
function globalVon(ev) {
  const p = new Point();
  stage.app.renderer.events.mapPositionToPoint(p, ev.clientX, ev.clientY);
  return p;
}

// Läuft gerade die Antwort auf eine Berührung (pointerdown/pointermove/pointerup werden abgearbeitet)? Die Ton-Bremse
// in audio.js zählt nur Töne, die so direkt aus einer Berührung kommen – nicht Melodien und Zeitgeber der Szenen.
let eingabeLaeuft = false;
function eingabeBeginnt() {
  if (eingabeLaeuft) return;
  eingabeLaeuft = true;
  setTimeout(() => { eingabeLaeuft = false; }, 0); // nach allen Hörern dieses Ereignisses
}

/** Wird gerade eine Berührung abgearbeitet? (für die Ton-Bremse) */
export function inEingabe() {
  return eingabeLaeuft;
}

let globaleListener = false;
function richteListenerEin() {
  if (globaleListener) return;
  globaleListener = true;
  // jede Berührung irgendwo zählt für die Leerlauf-Uhr
  window.addEventListener('pointerdown', (ev) => {
    eingabeBeginnt();
    gedrueckt.set(ev.pointerId, { zeit: performance.now(), gross: istGross(ev) });
    meldeEingabe();
  }, { passive: true, capture: true });
  window.addEventListener('pointermove', (ev) => {
    if (gedrueckt.has(ev.pointerId)) eingabeBeginnt();
  }, { passive: true, capture: true });
  window.addEventListener('pointerup', eingabeBeginnt, { passive: true, capture: true });
  window.addEventListener('pointermove', (ev) => {
    const z = gedrueckt.get(ev.pointerId);
    if (z) {
      z.zeit = performance.now();
      if (istGross(ev)) z.gross = true;
    }
    const f = finger.get(ev.pointerId);
    if (!f) {
      // Ein Finger, der woanders aufsetzte (neben dem Fleck, auf dem Auto …) und jetzt über etwas zum Wischen
      // fährt, wischt ab hier mit
      if (z && !gesperrt && wischDinge.size) wischBeginnt(ev.pointerId, globalVon(ev));
      return;
    }
    meldeEingabe();
    f.move(globalVon(ev));
  }, { passive: true });
  const ende = (abgebrochen) => (ev) => {
    gedrueckt.delete(ev.pointerId);
    const f = finger.get(ev.pointerId);
    if (!f) return;
    finger.delete(ev.pointerId);
    if (!abgebrochen) f.move(globalVon(ev));
    f.end(abgebrochen);
  };
  window.addEventListener('pointerup', ende(false), { passive: true });
  window.addEventListener('pointercancel', ende(true), { passive: true });
  const allesLos = () => { gedrueckt.clear(); cancelAllFingers(); };
  window.addEventListener('blur', allesLos);
  document.addEventListener('visibilitychange', () => { if (document.hidden) allesLos(); });
}

// ---------------------------------------------------------------- Hilfen

// Ein Handle anlegen: registriert beim Besitzer, endet automatisch, wenn obj zerstört wird
function neuesHandle(obj, aufraeumen) {
  richteListenerEin();
  const owner = besitzer;
  const h = {
    aus: false,
    off() {
      if (h.aus) return;
      h.aus = true;
      handlesVon.get(owner)?.delete(h);
      obj.off?.('destroyed', h.off);
      aufraeumen();
    },
  };
  if (owner) {
    if (!handlesVon.has(owner)) handlesVon.set(owner, new Set());
    handlesVon.get(owner).add(h);
  }
  obj.once?.('destroyed', h.off);
  return h;
}

// Tippfläche: lokale Grenzen + pad (pad in Bühnen-Einheiten, unabhängig von der Skalierung des Dings)
function setzeTippflaeche(obj, pad, eigene) {
  obj.eventMode = 'static';
  if (eigene) obj.hitArea = eigene;
  else if (!obj.hitArea) {
    const b = obj.getLocalBounds();
    const s = Math.abs(obj.scale?.x || 1) || 1;
    const p = pad / s;
    obj.hitArea = new Rectangle(b.x - p, b.y - p, b.width + 2 * p, b.height + 2 * p);
  }
  if (isTest) pruefeTippflaeche(obj);
}

// Skalierung des Dings in Bühnen-Einheiten (für Pinselgröße u. a.)
function szenenSkala(obj) {
  const m = obj.worldTransform;
  return Math.hypot(m.a, m.b) / (stage.scale || 1);
}

// Nur im Testbetrieb: warnen, wenn eine Tippfläche schmaler als 200 Bühnen-Einheiten ist (Regel für kleine Hände).
// Geprüft wird kurz nach dem Anlegen, wenn das Ding seinen Platz im Baum hat. Übersprungen werden Dinge, die gar
// nicht (mehr) angetippt werden können (eventMode 'none'), und die Kopien aus der Leiste ('trayKopie:…' – sie
// hängen schon am Finger; angetippt wird das große Ding in der Leiste).
const KLEINSTE_TIPPFLAECHE = 200;
function pruefeTippflaeche(obj) {
  after(0.5, () => {
    if (obj.destroyed || !obj.parent || !obj.hitArea) return;
    if (obj.eventMode === 'none' || String(obj.label || '').startsWith('trayKopie')) return;
    const h = obj.hitArea;
    const breite = h.radius !== undefined ? 2 * h.radius : h.width;
    const hoehe = h.radius !== undefined ? 2 * h.radius : h.height;
    if (!(breite > 0 && hoehe > 0)) return;
    const m = obj.worldTransform;
    const sx = Math.hypot(m.a, m.b) / (stage.scale || 1);
    const sy = Math.hypot(m.c, m.d) / (stage.scale || 1);
    const klein = Math.round(Math.min(breite * sx, hoehe * sy));
    if (klein < KLEINSTE_TIPPFLAECHE - 0.5) {
      warnOnce(`Tippfläche von '${obj.label || obj.constructor?.name || 'Ding'}' ist nur ${klein} Einheiten breit ` +
        `(Regel: mindestens ${KLEINSTE_TIPPFLAECHE}, lieber 260+).`);
    }
  });
}

// Größen-Rückmeldung zurück zur Ruhe-Größe (gemeinsamer Speicher in tween.js)
function zurueckZurRuhe(obj, dauer = 0.25, easeName = 'backOut') {
  scaleFeedback(obj, [], { rueck: [dauer, easeName] });
}

// ursprünglicher zIndex, solange ein Ding nach vorn geholt ist
const ruheZ = new WeakMap();
const HOCH_Z = 100000;   // zIndex eines Dings am Finger

// Mittelpunkt der sichtbaren Fläche in Koordinaten von `bezug`
function mitteIn(obj, bezug) {
  const b = obj.getBounds();
  return bezug.toLocal(new Point(b.x + b.width / 2, b.y + b.height / 2));
}

/** Kleines Stauchen als Rückmeldung (weich, kein Gezappel). */
export function squash(obj, staerke = 0.1) {
  if (!obj || obj.destroyed || !obj.scale) return;
  scaleFeedback(obj, [[1 + staerke * 0.7, 1 - staerke, 0.07, 'quadOut']], { rueck: [0.3, 'backOut'] });
}

// ---------------------------------------------------------------- tap

/** tap(obj, fn, {pad=30, sound='common/tipp', squash=true, hitArea}) – löst beim Berühren aus. */
export function tap(obj, fn, opt = {}) {
  const pad = opt.pad ?? 30;
  const ton = opt.sound === undefined ? 'common/tipp' : opt.sound;
  const stauchen = opt.squash ?? true;
  let letztes = -1e9;
  setzeTippflaeche(obj, pad, opt.hitArea);

  const unten = (e) => {
    if (gesperrt || h.aus) return;
    e.stopPropagation();
    const jetzt = performance.now();
    if (jetzt - letztes < 120) return; // Entprellen
    letztes = jetzt;
    meldeEingabe();
    if (tippHoerer.size) meldeTipp(obj);
    if (stauchen) squash(obj);
    spieleTon(ton, 'tap');
    const p = obj.parent ? obj.parent.toLocal(e.global) : { x: e.global.x, y: e.global.y };
    try {
      fn?.({ obj, x: p.x, y: p.y, pointerId: e.pointerId });
    } catch (err) {
      console.error('[sigo] Fehler in tap:', err);
    }
  };
  obj.on('pointerdown', unten);
  const h = neuesHandle(obj, () => { obj.off('pointerdown', unten); });
  return h;
}

// ---------------------------------------------------------------- drag

/**
 * drag(obj, {targets:[{obj, id, radius} | {x, y, id, radius}] | () => [...], onStart(ctx), onMove(target|null, ctx),
 *            onDrop(target|null, ctx), back=true, lift=1.1, pad=30, radius=260, sound, heim: {x, y} | () => {x, y}})
 * Ohne Treffer gleitet das Ding zurück. ctx.snapTo(target) legt es weich aufs Ziel; ctx.back() schickt es zurück –
 * zum Heimplatz (ctx.heimX/heimY): opt.heim, sonst der Ort beim Greifen. Wird es gepackt, während es noch
 * heimgleitet, bleibt der alte Heimplatz. ctx.startX/startY ist immer der Ort beim Greifen.
 * Gibt onDrop false zurück, gleitet es auch mit Treffer zurück.
 * Am Finger liegt das Ding ganz vorn (zIndex 100000); 0,5 s nach dem Loslassen bekommt es seinen alten zIndex
 * zurück – außer onDrop hat selbst einen zIndex gesetzt: dann bleibt der.
 */
export function drag(obj, opt = {}) {
  const pad = opt.pad ?? 30;
  const lift = opt.lift ?? 1.1;
  const zurueck = opt.back ?? true;
  const standardRadius = opt.radius ?? 260;
  setzeTippflaeche(obj, pad, opt.hitArea);

  let aktiv = null;       // { pointerId, dx, dy, ctx }
  let letzterCtx = null;  // ctx des letzten Ziehens (wird beim nächsten Greifen abgelöst)

  const ziele = () => {
    const t = typeof opt.targets === 'function' ? opt.targets() : opt.targets;
    return Array.isArray(t) ? t : [];
  };

  // Ort eines Ziels in Koordinaten von obj.parent
  const zielOrt = (z) => {
    if (z.obj) {
      if (z.obj.destroyed || !z.obj.parent) return null;
      return mitteIn(z.obj, obj.parent);
    }
    return { x: z.x, y: z.y };
  };

  // nächstes Ziel innerhalb seines Radius
  const naechstesZiel = () => {
    const m = mitteIn(obj, obj.parent);
    let bestes = null;
    let besterAbstand = Infinity;
    for (const z of ziele()) {
      if (!z || z.disabled) continue;
      const o = zielOrt(z);
      if (!o) continue;
      const d = Math.hypot(o.x - m.x, o.y - m.y);
      if (d <= (z.radius ?? standardRadius) && d < besterAbstand) {
        bestes = z;
        besterAbstand = d;
      }
    }
    return bestes;
  };

  const gleite = (x, y, dauer = 0.45) => {
    killTweensOf(obj, ['x', 'y']);
    return tween(obj, { x, y }, dauer, { ease: 'cubicOut' });
  };

  // Ergebnis von snapTo/back, wenn nichts mehr zu tun ist: erfüllt sich sofort mit false
  const nichts = () => {
    const p = Promise.resolve(false);
    return { then: (a, b) => p.then(a, b), kill() { return this; }, stop() { return this; } };
  };

  // Heimplatz (Ziel von back()): fest vorgegeben (opt.heim), sonst der Ort beim Greifen. Wird das Ding gepackt,
  // während es noch zu seinem Heimplatz zurückgleitet, bleibt der alte Heimplatz – sonst wanderte es bei jedem
  // Antippen ein Stück weiter weg.
  const heimFuer = (vorher) => {
    if (opt.heim) {
      const hp = typeof opt.heim === 'function' ? opt.heim() : opt.heim;
      if (hp && Number.isFinite(hp.x) && Number.isFinite(hp.y)) return { x: hp.x, y: hp.y };
    }
    if (vorher && vorher.zurueck && !vorher.zurueck.tot) return { x: vorher.heimX, y: vorher.heimY };
    return { x: obj.x, y: obj.y };
  };

  const macheCtx = (pointerId, heim) => {
    const ctx = {
      obj,
      pointerId,
      x: obj.x,
      y: obj.y,
      startX: obj.x,    // Ort beim Greifen (zum Messen, wie weit gezogen wurde)
      startY: obj.y,
      heimX: heim.x,    // dorthin gleitet back()
      heimY: heim.y,
      zurueck: null,    // laufendes Zurückgleiten
      target: null,
      cancelled: false,
      erledigt: false,  // snapTo/back wurde gerufen
      abgeloest: false, // das Ding wurde inzwischen neu gegriffen: dieser ctx bewegt es nicht mehr
      /** Weich aufs Ziel legen (Mitte des Dings auf den Zielpunkt). → thenable */
      snapTo(z, dauer = 0.25) {
        ctx.erledigt = true;
        if (ctx.abgeloest || obj.destroyed || !obj.parent) return nichts();
        const o = z ? zielOrt(z) : null;
        if (!o) return gleite(obj.x, obj.y, 0);
        const m = mitteIn(obj, obj.parent);
        return gleite(obj.x + (o.x - m.x), obj.y + (o.y - m.y), dauer);
      },
      /** Weich zum Heimplatz zurück. → thenable */
      back(dauer = 0.45) {
        ctx.erledigt = true;
        if (ctx.abgeloest || obj.destroyed) return nichts();
        const t = gleite(ctx.heimX, ctx.heimY, dauer);
        ctx.zurueck = t;
        return t;
      },
    };
    return ctx;
  };

  const loslassen = (abgebrochen) => {
    const a = aktiv;
    if (!a) return;
    aktiv = null;
    anFinger.delete(obj);
    if (obj.destroyed) return;
    zurueckZurRuhe(obj, 0.25, 'quadOut');
    const ziel = abgebrochen ? null : naechstesZiel();
    a.ctx.target = ziel;
    a.ctx.cancelled = abgebrochen;
    a.ctx.x = obj.x;
    a.ctx.y = obj.y;
    spieleTon(opt.sound, 'drop');
    let ergebnis;
    try {
      ergebnis = opt.onDrop?.(ziel, a.ctx);
    } catch (err) {
      console.error('[sigo] Fehler in onDrop:', err);
    }
    if (obj.destroyed) return;
    if (!a.ctx.erledigt && ((!ziel && zurueck) || ergebnis === false)) a.ctx.back();
    // Hat die Szene in onDrop selbst einen zIndex gesetzt, gilt ihrer – das verzögerte Zurücksetzen entfällt
    if (obj.zIndex !== HOCH_Z) {
      ruheZ.delete(obj);
      return;
    }
    // zIndex erst zurück, wenn es wieder liegt
    after(0.5, () => {
      if (obj.destroyed || aktiv || !ruheZ.has(obj)) return;
      obj.zIndex = ruheZ.get(obj);
      ruheZ.delete(obj);
    });
  };

  const unten = (e) => {
    if (gesperrt || h.aus || aktiv) return;          // ein Ding hängt an höchstens einem Finger
    if (finger.has(e.pointerId) || anFinger.has(obj)) return;  // ein Finger zieht höchstens ein Ding
    if (!obj.parent) return;
    e.stopPropagation();
    meldeEingabe();
    // Figuren hören auf zu laufen/hüpfen, laufende Bewegungen der Szene enden (ihre Promises mit false)
    const heim = heimFuer(letzterCtx);   // vor dem Anhalten: gleitet es gerade heim?
    if (obj.isActor && typeof obj.stop === 'function') obj.stop();
    killTweensOf(obj, ['x', 'y']);
    if (letzterCtx) letzterCtx.abgeloest = true; // spätes snapTo/back des alten Ziehens wirkt nicht mehr
    const p = obj.parent.toLocal(e.global);
    const ctx = macheCtx(e.pointerId, heim);
    letzterCtx = ctx;
    aktiv = { pointerId: e.pointerId, dx: obj.x - p.x, dy: obj.y - p.y, ctx };
    anFinger.add(obj);
    if (!ruheZ.has(obj)) ruheZ.set(obj, obj.zIndex);
    obj.zIndex = HOCH_Z;
    scaleFeedback(obj, [[lift, lift, 0.12, 'quadOut']], { halten: true });
    spieleTon(opt.sound, 'drag');
    try { opt.onStart?.(ctx); } catch (err) { console.error('[sigo] Fehler in onStart:', err); }

    finger.set(e.pointerId, {
      move(g) {
        if (!aktiv || obj.destroyed || !obj.parent) return;
        const q = obj.parent.toLocal(g, undefined, tmp);
        obj.x = q.x + aktiv.dx;
        obj.y = q.y + aktiv.dy;
        ctx.x = obj.x;
        ctx.y = obj.y;
        const ziel = naechstesZiel();
        ctx.target = ziel;
        try { opt.onMove?.(ziel, ctx); } catch (err) { console.error('[sigo] Fehler in onMove:', err); }
      },
      end: loslassen,
    });
  };

  obj.on('pointerdown', unten);
  const h = neuesHandle(obj, () => {
    obj.off('pointerdown', unten);
    if (aktiv) {
      finger.delete(aktiv.pointerId);
      anFinger.delete(obj);
      if (!obj.destroyed) {
        if (ruheZ.has(obj)) obj.zIndex = ruheZ.get(obj);
        ruheZ.delete(obj);
        resetScale(obj);
      }
      aktiv = null;
    }
  });
  /** Wird gerade gezogen? */
  h.isDragging = () => !!aktiv;
  /** Aktuelles Ziel unter dem Ding (auch ohne Ziehen abfragbar). */
  h.target = () => (obj.parent ? naechstesZiel() : null);
  return h;
}

// ---------------------------------------------------------------- hold

/** hold(obj, {onStart(ctx), onTick(dt, ctx), onEnd(ctx), pad=30, sound}) – solange der Finger drauf ist. */
export function hold(obj, opt = {}) {
  const pad = opt.pad ?? 30;
  setzeTippflaeche(obj, pad, opt.hitArea);
  let aktiv = null; // { pointerId, ctx, zeit }

  const beenden = () => {
    if (!aktiv) return;
    const a = aktiv;
    aktiv = null;
    tickHoerer.delete(tick);
    finger.delete(a.pointerId);
    if (!obj.destroyed) {
      try { opt.onEnd?.(a.ctx); } catch (err) { console.error('[sigo] Fehler in onEnd:', err); }
    }
  };

  const tick = (dt) => {
    if (!aktiv) return;
    if (obj.destroyed) { beenden(); return; }
    aktiv.ctx.time += dt;
    meldeEingabe();
    try { opt.onTick?.(dt, aktiv.ctx); } catch (err) { console.error('[sigo] Fehler in onTick:', err); }
  };

  const unten = (e) => {
    if (gesperrt || h.aus || aktiv || finger.has(e.pointerId)) return;
    e.stopPropagation();
    meldeEingabe();
    aktiv = { pointerId: e.pointerId, ctx: { obj, time: 0, pointerId: e.pointerId } };
    spieleTon(opt.sound, 'hold');
    try { opt.onStart?.(aktiv.ctx); } catch (err) { console.error('[sigo] Fehler in onStart:', err); }
    tickHoerer.add(tick);
    finger.set(e.pointerId, {
      move(g) {
        // Finger rutscht vom Ding: Halten endet
        if (!aktiv || obj.destroyed) return;
        const lokal = obj.toLocal(g, undefined, tmp);
        if (obj.hitArea && !obj.hitArea.contains(lokal.x, lokal.y)) {
          finger.delete(aktiv.pointerId);
          beenden();
        }
      },
      end: () => beenden(),
    });
  };

  obj.on('pointerdown', unten);
  const h = neuesHandle(obj, () => {
    obj.off('pointerdown', unten);
    beenden();
  });
  h.isHolding = () => !!aktiv;
  return h;
}

// ---------------------------------------------------------------- wipe

let pinselTextur = null;
function pinsel() {
  if (pinselTextur) return pinselTextur;
  // weicher runder Tupfer: innen voll, außen weich auslaufend
  const G = 128;
  const c = document.createElement('canvas');
  c.width = G;
  c.height = G;
  const g = c.getContext('2d');
  const v = g.createRadialGradient(G / 2, G / 2, 0, G / 2, G / 2, G / 2);
  v.addColorStop(0, 'rgba(255,255,255,1)');
  v.addColorStop(0.55, 'rgba(255,255,255,1)');
  v.addColorStop(0.8, 'rgba(255,255,255,0.55)');
  v.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = v;
  g.fillRect(0, 0, G, G);
  pinselTextur = Texture.from(c);
  return pinselTextur;
}

const RASTER = 10; // 10×10 Zellen für den Fortschritt

// Wischen folgt dem Finger: Alle Dinge zum Wischen stehen in wischDinge (obj → Eintrag). Ein Finger wischt jedes
// davon, über das er fährt – auch wenn er daneben aufgesetzt hat (auf dem Auto, neben dem Fleck) oder auf einem
// anderen Fleck. Was „darüber" heißt, entscheidet Pixis eigener Treffertest (oberstes antippbares Ding unter dem
// Finger): verdeckte, unsichtbare oder gesperrte Dinge (z. B. auf einer anderen Seite) wischt er nicht.
// Ein Finger, der etwas zieht oder hält, wischt nicht.
const wischDinge = new Map();   // obj → { betreten(pointerId, global), strich(a, b), fertig() }
const wischFinger = new Map();  // pointerId → { wisch: true, letzter, dinge: Set(Eintrag), move, end }
const letzterWischTon = new Map(); // Ton-id → performance.now() (mehrere Flecken teilen sich die Ton-Pause)

// Ist ein Ding gerade erreichbar? (sichtbar, keine Ebene darüber mit eventMode 'none')
function erreichbar(obj) {
  for (let o = obj; o; o = o.parent) {
    if (o.destroyed || !o.visible || o.eventMode === 'none') return false;
  }
  return true;
}

// Das oberste antippbare Ding unter dem Punkt – wenn es zum Wischen ist, sein Eintrag
function wischDingUnter(g) {
  let irgendeins = false;
  for (const [obj, e] of wischDinge) if (!e.fertig() && erreichbar(obj)) { irgendeins = true; break; }
  if (!irgendeins) return null;
  let ziel = null;
  try { ziel = stage.app.renderer.events.rootBoundary.hitTest(g.x, g.y); } catch { return null; }
  return (ziel && wischDinge.get(ziel)) || null;
}

// Der Finger kommt über ein Ding zum Wischen (oder setzt auf ihm auf): wie ein Aufsetzen dort. Das Ding bekommt ein
// pointerdown – so sehen auch eigene Hörer der Szene (z. B. Schätze im Sand) den Finger.
function wischBeginnt(pointerId, g) {
  const e = wischDingUnter(g);
  if (!e) return;
  const f = wischFinger.get(pointerId);
  if (f && f.dinge.has(e)) return;
  e.betreten(pointerId, g);
}

// Gemeinsamer Wisch-Finger: führt den Strich über alle Dinge, die er schon berührt hat, und nimmt neue dazu
function holeWischFinger(pointerId, g) {
  let f = wischFinger.get(pointerId);
  if (f) return f;
  f = {
    wisch: true,
    letzter: new Point(g.x, g.y),
    dinge: new Set(),
    move(p) {
      for (const e of [...f.dinge]) e.strich(f.letzter, p);
      f.letzter.set(p.x, p.y);
      wischBeginnt(pointerId, p);
    },
    end() {
      wischFinger.delete(pointerId);
      f.dinge.clear();
    },
  };
  wischFinger.set(pointerId, f);
  finger.set(pointerId, f);
  return f;
}

// Welche Rasterzellen haben Inhalt? (Alpha-Stichprobe des Originalbildes; sonst Ellipse)
function inhaltsZellen(textur) {
  const zellen = new Array(RASTER * RASTER).fill(false);
  const quelle = textur.source?.resource;
  const fein = RASTER * 4;
  try {
    if (!quelle || !(quelle instanceof ImageBitmap || quelle instanceof HTMLCanvasElement ||
        quelle instanceof HTMLImageElement || (typeof OffscreenCanvas !== 'undefined' && quelle instanceof OffscreenCanvas))) {
      throw new Error('keine lesbare Quelle');
    }
    const c = document.createElement('canvas');
    c.width = fein;
    c.height = fein;
    const g = c.getContext('2d', { willReadFrequently: true });
    const f = textur.frame;
    const res = textur.source.resolution || 1;
    g.drawImage(quelle, f.x * res, f.y * res, f.width * res, f.height * res, 0, 0, fein, fein);
    const daten = g.getImageData(0, 0, fein, fein).data;
    for (let zy = 0; zy < RASTER; zy++) {
      for (let zx = 0; zx < RASTER; zx++) {
        let summe = 0;
        for (let y = 0; y < 4; y++) {
          for (let x = 0; x < 4; x++) {
            summe += daten[((zy * 4 + y) * fein + (zx * 4 + x)) * 4 + 3];
          }
        }
        zellen[zy * RASTER + zx] = summe / 16 > 50;
      }
    }
    return zellen;
  } catch {
    // einfacher Ersatz: alle Zellen innerhalb einer Ellipse
    for (let zy = 0; zy < RASTER; zy++) {
      for (let zx = 0; zx < RASTER; zx++) {
        const nx = ((zx + 0.5) / RASTER) * 2 - 1;
        const ny = ((zy + 0.5) / RASTER) * 2 - 1;
        zellen[zy * RASTER + zx] = nx * nx + ny * ny <= 1;
      }
    }
    return zellen;
  }
}

/**
 * wipe(sprite, {radius=110, onProgress(p), onDone, sound, pad=40, doneAt=0.85})
 * Das Sprite verschwindet dort, wo gewischt wird. Gibt {off, reset({fade}), progress()} zurück.
 * Es wischt jeder Finger, der darüberfährt – auch einer, der daneben oder auf einem anderen Fleck aufgesetzt hat
 * (er bekommt beim Hereinfahren ein pointerdown mit `hereingewischt: true`).
 */
export function wipe(obj, opt = {}) {
  const radius = opt.radius ?? 110;
  const fertigAb = opt.doneAt ?? 0.85;
  const pad = opt.pad ?? 40;
  const renderer = stage.app.renderer;

  const original = obj.texture;
  const w = original.width;
  const hT = original.height;
  // große Bilder mit etwas weniger Auflösung wischen (spart Speicher, sieht gleich aus)
  const res = Math.min(1, 1400 / Math.max(w, hT));
  const rt = RenderTexture.create({ width: w, height: hT, resolution: res });
  const kopie = new Sprite(original);
  const tupfer = new Container();
  const pool = [];
  const pinselTex = pinsel();

  const zellenMitInhalt = inhaltsZellen(original);
  let weg = new Array(RASTER * RASTER).fill(false);
  const anzahlInhalt = zellenMitInhalt.filter(Boolean).length;
  let fortschritt = 0;
  let fertig = false;
  let ausblenden = null;
  const ruheAlpha = obj.alpha;
  const zellW = w / RASTER;
  const zellH = hT / RASTER;

  const fuelle = () => {
    renderer.render({ container: kopie, target: rt, clear: true, clearColor: [0, 0, 0, 0] });
  };
  fuelle();
  obj.texture = rt;
  setzeTippflaeche(obj, pad, opt.hitArea);

  // Punkt im Sprite → Bildkoordinaten (0…w, 0…h)
  const bildPunkt = (g) => {
    const l = obj.toLocal(g);
    return { x: l.x + obj.anchor.x * w, y: l.y + obj.anchor.y * hT };
  };

  const radiusLokal = () => radius / (szenenSkala(obj) || 1);

  const tupfe = (punkte, r) => {
    let n = 0;
    for (const p of punkte) {
      let s = pool[n];
      if (!s) {
        s = new Sprite(pinselTex);
        s.anchor.set(0.5);
        s.blendMode = 'erase';
        pool.push(s);
        tupfer.addChild(s);
      }
      s.visible = true;
      s.position.set(p.x, p.y);
      s.width = s.height = r * 2;
      n++;
    }
    for (let i = n; i < pool.length; i++) pool[i].visible = false;
    renderer.render({ container: tupfer, target: rt, clear: false });

    // Fortschritt: Zellen, deren Mitte innerhalb des inneren Pinsels lag
    const r2 = (r * 0.75) * (r * 0.75);
    for (const p of punkte) {
      const x0 = clamp(Math.floor((p.x - r) / zellW), 0, RASTER - 1);
      const x1 = clamp(Math.floor((p.x + r) / zellW), 0, RASTER - 1);
      const y0 = clamp(Math.floor((p.y - r) / zellH), 0, RASTER - 1);
      const y1 = clamp(Math.floor((p.y + r) / zellH), 0, RASTER - 1);
      for (let zy = y0; zy <= y1; zy++) {
        for (let zx = x0; zx <= x1; zx++) {
          const mx = (zx + 0.5) * zellW - p.x;
          const my = (zy + 0.5) * zellH - p.y;
          if (mx * mx + my * my <= r2) weg[zy * RASTER + zx] = true;
        }
      }
    }
    let geschafft = 0;
    for (let i = 0; i < weg.length; i++) if (weg[i] && zellenMitInhalt[i]) geschafft++;
    const neu = anzahlInhalt ? geschafft / anzahlInhalt : 1;
    if (neu !== fortschritt) {
      fortschritt = neu;
      try { opt.onProgress?.(fortschritt); } catch (err) { console.error('[sigo] Fehler in onProgress:', err); }
    }
    if (!fertig && fortschritt >= fertigAb) {
      fertig = true;
      try { opt.onDone?.(); } catch (err) { console.error('[sigo] Fehler in onDone:', err); }
      // Rest weich ausblenden, danach ganz leer machen
      ausblenden = tween(obj, { alpha: 0 }, 0.7, {
        ease: 'sineInOut',
        onComplete: () => {
          if (h.aus) return;
          renderer.render({ container: tupfer, target: rt, clear: true, clearColor: [0, 0, 0, 0] });
          obj.alpha = ruheAlpha;
          ausblenden = null;
        },
      });
    }
  };

  // Ton beim Wischen: höchstens alle 0,28 s (auch über mehrere Flecken hinweg)
  const wischTon = (sofort) => {
    if (!opt.sound) return;
    const jetzt = performance.now();
    if (!sofort && jetzt - (letzterWischTon.get(opt.sound) ?? -Infinity) <= 280) return;
    letzterWischTon.set(opt.sound, jetzt);
    spieleTon(opt.sound, 'wipe');
  };

  // Strich von a nach b (Bildschirm-Punkte) mit Zwischenpunkten (keine Lücken). Teile außerhalb des Bildes wischen
  // nichts weg; ein Strich, der das Ding gar nicht berührt, kostet nichts.
  const strich = (ga, gb) => {
    if (h.aus || fertig || obj.destroyed || !erreichbar(obj)) return;
    const a = bildPunkt(ga);
    const b = bildPunkt(gb);
    const r = radiusLokal();
    if (Math.max(a.x, b.x) < -r || Math.min(a.x, b.x) > w + r || Math.max(a.y, b.y) < -r || Math.min(a.y, b.y) > hT + r) return;
    const schritt = Math.max(2, r * 0.35);
    const d = Math.hypot(b.x - a.x, b.y - a.y);
    const n = Math.min(80, Math.max(1, Math.ceil(d / schritt)));
    const punkte = [];
    for (let i = 1; i <= n; i++) {
      const t = i / n;
      punkte.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
    }
    tupfe(punkte, r);
    if (d > 2) wischTon(false);
  };

  // Ein Finger setzt auf (oder fährt herein): ein Tupfer hier, ab jetzt folgt das Ding dem gemeinsamen Wisch-Finger
  const unten = (e) => {
    if (gesperrt || h.aus || fertig) return;
    const vorhanden = finger.get(e.pointerId);
    if (vorhanden && !vorhanden.wisch) return;   // dieser Finger zieht oder hält schon etwas
    e.stopPropagation();
    meldeEingabe();
    const f = holeWischFinger(e.pointerId, e.global);
    if (f.dinge.has(eintrag)) return;
    f.dinge.add(eintrag);
    tupfe([bildPunkt(e.global)], radiusLokal());
    wischTon(true);
  };

  // Eintrag im gemeinsamen Verzeichnis (Wischen folgt dem Finger)
  const eintrag = {
    betreten(pointerId, g) {
      if (obj.destroyed) return;
      const ev = {
        type: 'pointerdown', pointerId, pointerType: 'touch', global: new Point(g.x, g.y), target: obj,
        currentTarget: obj, hereingewischt: true, stopPropagation() {}, preventDefault() {},
      };
      try { obj.emit('pointerdown', ev); } catch (err) { console.error('[sigo] Fehler beim Hereinwischen:', err); }
    },
    strich,
    fertig: () => fertig || h.aus,
  };
  wischDinge.set(obj, eintrag);

  obj.on('pointerdown', unten);
  const h = neuesHandle(obj, () => {
    obj.off('pointerdown', unten);
    wischDinge.delete(obj);
    for (const f of wischFinger.values()) f.dinge.delete(eintrag);
    ausblenden?.kill();
    if (!obj.destroyed) {
      obj.texture = original;
      obj.alpha = ruheAlpha;
    }
    tupfer.destroy({ children: true });
    kopie.destroy();
    rt.destroy(true);
  });

  /** Volle Textur wiederherstellen. Mit {fade: sek} weich einblenden. */
  h.reset = (o = {}) => {
    if (h.aus) return;
    ausblenden?.kill();
    ausblenden = null;
    fuelle();
    weg = new Array(RASTER * RASTER).fill(false);
    fortschritt = 0;
    fertig = false;
    if (o.fade && !obj.destroyed) {
      obj.alpha = 0;
      tween(obj, { alpha: ruheAlpha }, o.fade, { ease: 'sineInOut' });
    } else {
      obj.alpha = ruheAlpha;
    }
  };
  h.progress = () => fortschritt;
  h.isDone = () => fertig;
  return h;
}
