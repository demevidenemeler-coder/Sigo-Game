// Die Bühne: Pixi-Anwendung, Maße, Ebenen-Baum, Auflösung und Qualitätswächter.
//
// Baum:  app.stage
//          ├─ buehne (skaliert: 1 Einheit = stage.scale CSS-Pixel)
//          │    ├─ szenenWurzel (x = W/2)  ├─ bg   ├─ world   └─ front
//          │    ├─ hud   (Koordinaten 0…W / 0…H)
//          │    └─ blende (Szenenwechsel)
//          └─ rand (cremefarbene Ränder, falls das Fenster nicht 16:10…21:9 ist)

import { Application, Container, Graphics, Sprite, Texture } from 'pixi';

const H = 1600;                       // Bühne ist immer 1600 Einheiten hoch
const SEITE_MIN = 16 / 10;            // schmalstes Seitenverhältnis der Bühne
const SEITE_MAX = 21 / 9;             // breitestes
const MAX_PIXEL = 2560 * 1600;        // Zeichenpuffer höchstens so viele Bildpunkte
const STUFEN = [1, 0.85, 0.7, 0.55];  // Qualitätsstufen (Faktor auf die Auflösung)
export const HINTERGRUND = 0xf4ecdf;  // Cremeton (wie im Manifest)
const RAND_WEICH = 40;                // weicher Übergang zum Rand in Einheiten

// Speicher-Schutz: Pixi gibt die Zeichendaten eines Graphics nur frei, wenn destroy() OHNE Angaben aufgerufen wird
// oder mit {context: true}. Bei destroy({children: true}) – so räumen Szenen fast immer auf – blieben sie für immer
// im Grafikspeicher liegen, und bei langem Spielen wuchs der Speicher stetig. Darum gilt hier für alle: Gehören die
// Zeichendaten dem Graphics allein (nicht geteilt), werden sie mit ihm freigegeben, außer {context: false} steht da.
const graphicsDestroy = Graphics.prototype.destroy;
Graphics.prototype.destroy = function (optionen) {
  if (optionen && typeof optionen === 'object' && optionen.context === undefined && this._ownedContext) {
    optionen = { ...optionen, context: true };
  }
  return graphicsDestroy.call(this, optionen);
};

// Ereignisse der Bühne (z. B. 'resize')
const hoerer = new Map();

export const stage = {
  app: null,
  W: 2560,
  H,
  cx: 1280,
  cy: H / 2,
  scale: 1,          // CSS-Pixel pro Bühnen-Einheit
  stufe: 0,          // Qualitätsstufe 0…3
  resolution: 1,     // aktuelle Renderer-Auflösung
  fps: 60,           // gleitender Mittelwert
  frameMs: 16.7,     // gleitende mittlere Bildzeit
  buehne: null,
  sceneRoot: null,
  bg: null,
  world: null,
  front: null,
  hud: null,
  blende: null,

  on(name, fn) {
    if (!hoerer.has(name)) hoerer.set(name, new Set());
    hoerer.get(name).add(fn);
    return () => stage.off(name, fn);
  },
  off(name, fn) {
    hoerer.get(name)?.delete(fn);
  },
  emit(name, ...args) {
    for (const fn of [...(hoerer.get(name) || [])]) {
      try { fn(...args); } catch (e) { console.error('[sigo] Fehler im Bühnen-Ereignis', name, e); }
    }
  },

  /** Qualitätswächter für einige Sekunden aussetzen (z. B. während Bilder geladen werden). */
  pauseWatch(sek = 2) {
    wache.ruheBis = Math.max(wache.ruheBis, performance.now() + sek * 1000);
    wache.langsamMs = 0;
    wache.flottMs = 0;
  },
};

// ---------------------------------------------------------------- Aufbau

/** Pixi starten und an parent hängen. Muss einmal vor allem anderen aufgerufen werden. */
export async function initStage(parent = document.body) {
  const app = new Application();
  const groesse = fensterGroesse();
  await app.init({
    preference: 'webgl',
    antialias: false,
    autoDensity: true,
    powerPreference: 'high-performance',
    resolution: aufloesungFuer(groesse.w, groesse.h),
    width: groesse.w,
    height: groesse.h,
    background: HINTERGRUND,
    autoStart: true,
    // Texturen unsichtbarer Seiten erst nach 10 Minuten aus der Grafikkarte nehmen (Standard 60 s): sonst lädt
    // jedes Zurückblättern nach einer Minute alles neu hoch und das Gleiten ruckt. Beim Szenenwechsel gibt der
    // Kern die Pakete ohnehin selbst frei.
    gcMaxUnusedTime: 10 * 60000,
  });
  stage.app = app;
  sichertZeichnen(app);
  parent.appendChild(app.canvas);
  app.canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  // Wir benutzen keine Pixi-Hover-/Bewegungsereignisse (Bewegung läuft über input.js) – spart Rechenzeit.
  const ev = app.renderer.events;
  ev.features.move = false;
  ev.features.globalMove = false;
  ev.features.wheel = false;

  const buehne = new Container({ label: 'buehne' });
  const sceneRoot = new Container({ label: 'szenenWurzel' });
  const bg = new Container({ label: 'bg', sortableChildren: true });
  const world = new Container({ label: 'world', sortableChildren: true });
  const front = new Container({ label: 'front', sortableChildren: true });
  const hud = new Container({ label: 'hud', sortableChildren: true });
  const blende = new Container({ label: 'blende' });
  sceneRoot.addChild(bg, world, front);
  buehne.addChild(sceneRoot, hud, blende);
  app.stage.addChild(buehne);

  Object.assign(stage, { buehne, sceneRoot, bg, world, front, hud, blende });

  baueRand();
  layout();

  // Größenänderung: auf das nächste Bild bündeln
  let geplant = false;
  const neuLayout = () => {
    if (geplant) return;
    geplant = true;
    requestAnimationFrame(() => { geplant = false; layout(); });
  };
  window.addEventListener('resize', neuLayout);
  window.addEventListener('orientationchange', neuLayout);

  // Tab im Hintergrund: Ticker anhalten, sonst Strom sparen geht nicht
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      app.ticker.stop();
    } else {
      stage.pauseWatch(2);
      app.ticker.start();
    }
  });

  stage.pauseWatch(3);
  app.ticker.add(waechter);
  return stage;
}

// ---------------------------------------------------------------- Sicherheitsnetz beim Zeichnen

// Wirft das Zeichnen (z. B. ein Sprite, dessen Textur schon zerstört ist), bleibt Pixis Ticker für immer stehen:
// kein Bild, keine Tweens – die Blende bliebe zu und das Spiel stünde still hinter der Wolkendecke. Darum zeichnet
// der Kern selbst: Wirft es, bekommen alle Dinge mit kaputter Textur eine leere (sie werden unsichtbar), der Fehler
// wird gemeldet (Ereignis 'zeichenfehler', einmal je Fehlerart) und es geht im nächsten Bild weiter.
function sichertZeichnen(app) {
  const ticker = app.ticker;
  ticker.remove(app.render, app);
  const gemeldet = new Set();
  ticker.add(() => {
    try {
      app.render();
    } catch (e) {
      // Hilft das Heilen nicht (anderer Fehler), fehlt eben dieses Bild – der Ticker läuft weiter (Tweens, Blende,
      // Eingabe), die Blende geht also trotzdem auf.
      const geheilt = heileTexturen(app.stage);
      const art = String(e?.message || e);
      if (!gemeldet.has(art)) {
        gemeldet.add(art);
        stage.emit('zeichenfehler', e, geheilt);
      }
    }
  }, null, -25);   // UPDATE_PRIORITY.LOW – wie Pixis eigenes Zeichnen: nach allen Tweens dieses Bildes
}

// Dinge mit zerstörter Textur (oder ohne Quelle) bekommen Texture.EMPTY. → Anzahl
function heileTexturen(wurzel) {
  let n = 0;
  const gehe = (o) => {
    if (!o || o.destroyed) return;
    if (o.texture instanceof Texture) {   // Sprite, TilingSprite, Mesh … (nicht Graphics)
      const t = o.texture;
      if (t !== Texture.EMPTY && (t.destroyed || !t.source || t.source.destroyed)) {
        try { o.texture = Texture.EMPTY; n++; } catch { /* egal */ }
      }
    }
    for (const k of o.children || []) gehe(k);
  };
  gehe(wurzel);
  return n;
}

// ---------------------------------------------------------------- Maße

function fensterGroesse() {
  return {
    w: Math.max(1, Math.round(window.innerWidth)),
    h: Math.max(1, Math.round(window.innerHeight)),
  };
}

// Gerätepixel, aber Zeichenpuffer höchstens 2560×1600 (bzw. gleiche Fläche); dazu die Qualitätsstufe
function aufloesungFuer(w, h) {
  const dpr = window.devicePixelRatio || 1;
  const grenze = Math.sqrt(MAX_PIXEL / (w * h));
  return Math.max(0.25, Math.min(dpr, grenze) * STUFEN[stage.stufe]);
}

function layout() {
  const app = stage.app;
  if (!app) return;
  const { w, h } = fensterGroesse();
  const seite = Math.min(SEITE_MAX, Math.max(SEITE_MIN, w / h));
  const W = Math.round(H * seite);
  // passt ganz hinein; bei schmaleren/breiteren Fenstern bleiben weiche Ränder
  const scale = Math.min(w / W, h / H);

  const res = aufloesungFuer(w, h);
  app.renderer.resize(w, h, res);

  stage.W = W;
  stage.cx = W / 2;
  stage.scale = scale;
  stage.resolution = res;
  stage.buehne.scale.set(scale);
  stage.buehne.x = Math.round((w - W * scale) / 2);
  stage.buehne.y = Math.round((h - H * scale) / 2);
  stage.sceneRoot.x = W / 2;

  zeichneRand(w, h);
  stage.emit('resize', stage);
}

// ---------------------------------------------------------------- Ränder

let rand = null;

function verlaufTextur() {
  // 1×64-Verlauf: oben voll Creme, unten durchsichtig
  const c = document.createElement('canvas');
  c.width = 4;
  c.height = 64;
  const g = c.getContext('2d');
  const v = g.createLinearGradient(0, 0, 0, 64);
  const farbe = '#' + HINTERGRUND.toString(16).padStart(6, '0');
  v.addColorStop(0, farbe);
  v.addColorStop(1, farbe + '00');
  g.fillStyle = v;
  g.fillRect(0, 0, 4, 64);
  return Texture.from(c);
}

function baueRand() {
  const tex = verlaufTextur();
  rand = {
    container: new Container({ label: 'rand' }),
    flaechen: new Graphics(),
    verlauf: [0, 1, 2, 3].map(() => new Sprite(tex)),
  };
  rand.container.eventMode = 'none';
  rand.container.addChild(rand.flaechen, ...rand.verlauf);
  stage.app.stage.addChild(rand.container);
}

function zeichneRand(w, h) {
  const { buehne } = stage;
  const bx = buehne.x;
  const by = buehne.y;
  const bw = stage.W * stage.scale;
  const bh = H * stage.scale;
  const g = rand.flaechen;
  g.clear();
  if (by > 0.5) g.rect(0, 0, w, by).rect(0, by + bh, w, h - by - bh);
  if (bx > 0.5) g.rect(0, 0, bx, h).rect(bx + bw, 0, w - bx - bw, h);
  g.fill(HINTERGRUND);

  const weich = RAND_WEICH * stage.scale;
  const [oben, unten, links, rechts] = rand.verlauf;
  const zeigY = by > 0.5;
  const zeigX = bx > 0.5;
  // oben: Creme nach unten auslaufend
  Object.assign(oben, { visible: zeigY, x: 0, y: by, width: w, height: weich, rotation: 0 });
  // unten: um 180° gedreht
  unten.visible = zeigY;
  unten.rotation = Math.PI;
  unten.position.set(w, by + bh);
  unten.width = w;
  unten.height = weich;
  // links: um -90° gedreht (Creme links)
  links.visible = zeigX;
  links.rotation = -Math.PI / 2;
  links.position.set(bx, h);
  links.width = h;
  links.height = weich;
  // rechts: um +90° gedreht
  rechts.visible = zeigX;
  rechts.rotation = Math.PI / 2;
  rechts.position.set(bx + bw, 0);
  rechts.width = h;
  rechts.height = weich;
}

// ---------------------------------------------------------------- Qualitätswächter
//
// Gemessen wird der Abstand zwischen zwei Bildern. Sind die Bilder 3 s lang zu langsam (> 22 ms), sinkt die
// Auflösung eine Stufe. Sind sie danach 20 s lang flott (< 18 ms, also auch bei 60 Hz), steigt sie wieder eine
// Stufe – eine kurze Drosselung (Wärme, Stromsparen, Benachrichtigungen) macht das Bild also nicht dauerhaft
// unscharf. Gegen Pendeln: Wird es innerhalb von 30 s nach dem Hochstufen wieder zu langsam, war es zu viel –
// dann geht es sofort zurück, und Hochstufen bleibt eine Weile gesperrt (5 min, bei jedem Mal doppelt so lange).

const LANGSAM_MS = 22;
const FLOTT_MS = 18;
const RUNTER_NACH = 3000;
const HOCH_NACH = 20000;
const ZU_VIEL_INNERHALB = 30000;

const wache = { ruheBis: 0, langsamMs: 0, flottMs: 0, hochUm: -Infinity, hochGesperrtBis: 0, sperre: 5 * 60000 };
stage._wache = wache; // nur zum Testen auslesbar

function setzeStufe(stufe, grund) {
  stage.stufe = stufe;
  console.info(`[sigo] ${grund} (${stage.frameMs.toFixed(1)} ms) – Auflösung auf Stufe ${STUFEN[stage.stufe]}`);
  stage.frameMs = 16.7;
  stage.pauseWatch(2);
  layout();
}

function waechter(ticker) {
  const d = Math.min(ticker.deltaMS, 250);
  // gleitender Mittelwert, zeitgewichtet (~0,5 s Gedächtnis)
  const k = 1 - Math.exp(-d / 500);
  stage.frameMs += (d - stage.frameMs) * k;
  stage.fps = Math.round(1000 / stage.frameMs);

  const jetzt = performance.now();
  if (jetzt < wache.ruheBis) return;

  if (stage.frameMs > LANGSAM_MS) {
    wache.flottMs = 0;
    wache.langsamMs += d;
    if (wache.langsamMs > RUNTER_NACH && stage.stufe < STUFEN.length - 1) {
      // gleich nach dem Hochstufen wieder zu langsam? Dann war es zu viel: Hochstufen eine Weile sperren
      if (jetzt - wache.hochUm < ZU_VIEL_INNERHALB) {
        wache.hochGesperrtBis = jetzt + wache.sperre;
        wache.sperre *= 2;
      }
      setzeStufe(stage.stufe + 1, 'Bilder zu langsam');
    }
    return;
  }
  wache.langsamMs = 0;
  if (stage.stufe > 0 && stage.frameMs < FLOTT_MS && jetzt >= wache.hochGesperrtBis) {
    wache.flottMs += d;
    if (wache.flottMs > HOCH_NACH) {
      wache.hochUm = jetzt;
      setzeStufe(stage.stufe - 1, 'Bilder wieder flott');
    }
  } else {
    wache.flottMs = 0;
  }
}
