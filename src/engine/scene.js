// Szenen und Szenen-Verwalter.
//
// Eine Szene ist ein Ort im Spiel (Klasse, die von Scene erbt, als default-Export von src/scenes/<id>/index.js).
// Der Verwalter lädt sie bei Bedarf (dynamic import), lädt ihre Pakete, blendet weich über und räumt danach auf:
// Tweens, Zeitgeber, Eingaben und Ebenen der alten Szene enden – offene Promises lösen nie mehr aus.

import { Container, Graphics, Rectangle, Sprite, Texture } from 'pixi';
import { stage, HINTERGRUND } from './stage.js';
import {
  tween, deadTween, after, every, wait, killOwner, updateTweens, setDefaultOwner, ease,
} from './tween.js';
import { tap, setInputLocked, setInputOwner, offInputs, onInput, updateInput, anyPointerDown } from './input.js';
import { loadPack, unloadPack, loadedPacks, hasTex, tex } from './assets.js';
import { clamp } from './util.js';
import { recordError, isTest } from './test.js';

const KERN = Symbol('kern');                       // Besitzer für Tweens des Kerns (Blende)
const BLEIBEN = new Set(['common', 'tiere', 'zug']); // diese Pakete bleiben immer geladen
// Ruhe-Regel: Die Helligkeit des ganzen Bildes ändert sich gleichmäßig über die ganze Blende (10–90 % in ≈ 0,8 s),
// nicht in einem kurzen Fenster in der Mitte.
const BLENDE_ZU = 1.0;                               // Sekunden
const BLENDE_AUF = 1.0;
const NIE = new Promise(() => {});                  // Promise, das nie auslöst

// ---------------------------------------------------------------- Scene

export class Scene {
  static id = '';
  static packs = [];       // 'common' ist immer geladen
  static music = null;     // z. B. 'common/musik_wiese' (spielt audio.js über SceneManager.onEnter)
  static ohneKarte = false; // true = kein Karten-Knopf oben links

  constructor() {
    this.bg = new Container({ label: 'bg', sortableChildren: true });
    this.world = new Container({ label: 'world', sortableChildren: true });
    this.front = new Container({ label: 'front', sortableChildren: true });
    this.hud = new Container({ label: 'hud', sortableChildren: true });
    this.id = this.constructor.id;
    this.params = {};
    this.t = 0;        // Sekunden seit enter
    this.idle = 0;     // Sekunden seit der letzten Eingabe
    this._alive = true;
    this._shown = false;
  }

  /** Läuft die Szene noch? */
  get alive() {
    return this._alive;
  }

  // --- Aufbau und Ablauf (von der Szene überschrieben) ---
  async enter(params) {}
  update(dt, t) {}
  exit() {}
  hints() { return []; }

  // --- an die Lebensdauer gebunden ---
  tween(obj, props, dauer, opt = {}) {
    if (!this._alive) return deadTween();
    return tween(obj, props, dauer, { ...opt, owner: this });
  }

  wait(sek) {
    if (!this._alive) return NIE;
    return wait(sek, { owner: this });
  }

  after(sek, fn) {
    if (!this._alive) return { kill() {} };
    return after(sek, fn, { owner: this });
  }

  every(sek, fn) {
    if (!this._alive) return { kill() {} };
    return every(sek, fn, { owner: this });
  }

  go(id, params) {
    if (!this._alive) return NIE;
    return SceneManager.go(id, params);
  }
}

// ---------------------------------------------------------------- Blende (cremefarbene Wolken)

const hex = (farbe) => '#' + farbe.toString(16).padStart(6, '0');

// Die Wolkendecke als EIN Bild: Cremegrund mit weichen, etwas helleren und dunkleren Wolkenballen. Weil sie als
// Ganzes überblendet wird (eine Deckkraft für alles), wächst die Helligkeit genau mit der Blende – überlappende
// Wolken machen keinen schnellen Sprung. Klein gemalt (¼ Auflösung) und hochgezogen: die Ränder sind ohnehin weich.
function wolkenDecke(W, H) {
  const F = 4;
  const c = document.createElement('canvas');
  c.width = Math.max(16, Math.ceil(W / F));
  c.height = Math.max(16, Math.ceil(H / F));
  const g = c.getContext('2d');
  g.fillStyle = hex(HINTERGRUND);
  g.fillRect(0, 0, c.width, c.height);
  const abstand = 400;
  const spalten = Math.ceil(W / abstand) + 1;
  const zeilen = Math.ceil(H / abstand) + 1;
  const toene = ['248,242,232', '239,229,213', '250,246,238'];
  let n = 0;
  for (let zy = 0; zy < zeilen; zy++) {
    for (let zx = 0; zx < spalten; zx++) {
      const x = (zx * abstand + (zy % 2 ? abstand / 2 : 0) - abstand / 4 + ((n * 37) % 60) - 30) / F;
      const y = (zy * abstand + ((n * 53) % 60) - 30) / F;
      const r = 380 / F;
      const v = g.createRadialGradient(x, y, 0, x, y, r);
      v.addColorStop(0, `rgba(${toene[n % 3]},0.9)`);
      v.addColorStop(0.7, `rgba(${toene[n % 3]},0.6)`);
      v.addColorStop(1, `rgba(${toene[n % 3]},0)`);
      g.fillStyle = v;
      g.fillRect(x - r, y - r, 2 * r, 2 * r);
      n++;
    }
  }
  return Texture.from(c);
}

// Verlauf der Deckkraft: fast gleichmäßig, nur an den Enden weich (größte Steigung ≈ 1,17 statt π/2)
const deckKurve = (p) => 0.7 * p + 0.3 * ease.sineInOut(p);

class Blende {
  constructor(container) {
    this.c = container;
    this.c.eventMode = 'static';
    this.decke = new Sprite(Texture.EMPTY);
    this.punkte = new Container();
    this.c.addChild(this.decke, this.punkte);
    this.p = 1; // 0 = offen, 1 = zu (Start: zu – der Lade-Hinweis der Seite liegt darüber)
    this.punkteZeit = 0;
    for (let i = 0; i < 3; i++) {
      const g = new Graphics().circle(0, 0, 22).fill(0xd9c7a8);
      g.x = (i - 1) * 80;
      this.punkte.addChild(g);
    }
    this.punkte.visible = false;
    this.layout();
    this.sperre(true);
  }

  layout() {
    const W = stage.W;
    const H = stage.H;
    // Wolkendecke nur neu malen, wenn sich die Größe geändert hat (die alte Textur wird freigegeben)
    if (this._W !== W || this._H !== H) {
      const alt = this.decke.texture;
      this.decke.texture = wolkenDecke(W + 80, H + 80);
      if (alt && alt !== Texture.EMPTY) alt.destroy(true);
      this._W = W;
      this._H = H;
    }
    this.decke.anchor.set(0.5);
    this.decke.position.set(W / 2, H / 2);
    this.decke.width = W + 80;
    this.decke.height = H + 80;
    this._sx = this.decke.scale.x;
    this._sy = this.decke.scale.y;
    this.punkte.position.set(W / 2, H / 2);
    this.c.hitArea = new Rectangle(0, 0, W, H);
    this.setze(this.p);
  }

  setze(p) {
    this.p = p;
    this.c.visible = p > 0.001;
    // Eine Deckkraft für die ganze Decke: Die Helligkeit folgt gleichmäßig der Blende (kein Aufblitzen).
    // Die Wolken ziehen dabei nur sanft ein wenig zusammen (Bewegung ohne Helligkeitssprung).
    this.decke.alpha = deckKurve(clamp(p, 0, 1));
    const k = 1.06 - 0.06 * ease.sineInOut(clamp(p, 0, 1));
    this.decke.scale.set(this._sx * k, this._sy * k);
  }

  sperre(an) {
    this.c.eventMode = an ? 'static' : 'none';
  }

  zeigePunkte(an) {
    this.punkte.visible = an;
    this.punkteZeit = 0;
  }

  tick(dt) {
    if (!this.punkte.visible) return;
    this.punkteZeit += dt;
    // ruhiges, langsames Pulsieren nacheinander (kein Blinken)
    this.punkte.children.forEach((g, i) => {
      g.alpha = 0.35 + 0.45 * (0.5 + 0.5 * Math.sin(this.punkteZeit * 2.6 - i * 0.9));
    });
  }

  fahre(ziel, dauer) {
    const proxy = { p: this.p };
    return tween(proxy, { p: ziel }, dauer, {
      ease: 'linear',
      owner: KERN,
      onUpdate: () => this.setze(proxy.p),
    });
  }

  schliessen() {
    if (this.p >= 1) return Promise.resolve();
    return this.fahre(1, BLENDE_ZU * (1 - this.p));
  }

  oeffnen() {
    return this.fahre(0, BLENDE_AUF);
  }
}

// ---------------------------------------------------------------- Karten-Knopf

function zeichneKartenSymbol(g) {
  // gefaltete Landkarte, ganz ohne Text
  g.roundRect(-58, -44, 116, 88, 14).fill(0xf2d9a0).stroke({ width: 6, color: 0xb98d52 });
  g.moveTo(-19, -44).lineTo(-19, 44).moveTo(19, -44).lineTo(19, 44).stroke({ width: 5, color: 0xd1ae73 });
  g.circle(-36, 8, 10).fill(0x7cb86a);
  g.circle(30, -14, 12).fill(0x6fa7d8);
  g.moveTo(-5, 22).lineTo(8, -2).lineTo(20, 22).closePath().fill(0xd9806a);
}

function baueKartenKnopf(szene) {
  const R = 100; // 200 Einheiten groß
  const knopf = new Container({ label: 'kartenKnopf' });
  knopf.position.set(70 + R, 70 + R);
  knopf.zIndex = 9000;
  const id = 'common/icon_karte';
  if (hasTex(id)) {
    const s = new Sprite(tex(id));
    s.anchor.set(0.5);
    s.scale.set((2 * R) / Math.max(s.texture.width, s.texture.height));
    knopf.addChild(s);
  } else {
    tex(id); // als fehlend vermerken
    const g = new Graphics();
    g.circle(0, 8, R).fill({ color: 0x5a4630, alpha: 0.12 });
    g.circle(0, 0, R).fill(0xfffaf0).stroke({ width: 7, color: 0xe3d3b8 });
    zeichneKartenSymbol(g);
    knopf.addChild(g);
  }
  szene.hud.addChild(knopf);
  tap(knopf, () => SceneManager.go('karte'), { pad: 20, hitArea: new Rectangle(-R - 20, -R - 20, 2 * R + 40, 2 * R + 40) });
  return knopf;
}

// ---------------------------------------------------------------- Verwalter

class Verwalter {
  constructor() {
    this.registry = new Map();     // id → () => import(...)
    this.current = null;
    this.blende = null;
    this._wechsel = null;
    this._idle = [];               // { cb, after, next }
    this._enter = new Set();
    this._exit = new Set();
    this._leave = new Set();
    this._schliesst = false;       // die Blende schließt gerade (die laufende Szene wird gleich verlassen)
    this._erstes = true;
    this._vorige = null;           // id der zuletzt erfolgreich gestarteten Szene (für den Rückfall)
    this.ready = new Promise((res) => { this._ready = res; });
  }

  /** Szene anmelden: register('bauernhof', () => import('../scenes/bauernhof/index.js')) */
  register(id, laden) {
    this.registry.set(id, laden);
  }

  has(id) {
    return this.registry.has(id);
  }

  get scene() {
    return this.current;
  }

  /** Läuft gerade ein Szenenwechsel (Blende)? */
  get wechselt() {
    return !!this._wechsel;
  }

  /**
   * Wird die laufende Szene gerade verlassen? (vom go() bis zu ihrem Ende; während die neue Szene aufgebaut wird
   * und die Blende sich öffnet, ist das schon wieder false)
   */
  get schliesst() {
    return this._schliesst;
  }

  /** Einmal nach initStage aufrufen. */
  start() {
    this.blende = new Blende(stage.blende);
    stage.on('resize', () => {
      this.blende.layout();
      const s = this.current;
      if (s && s._alive && typeof s.resize === 'function') {
        try { s.resize(stage.W, stage.H); } catch (e) { recordError(`Fehler in ${s.id}.resize`, e); }
      }
    });
    onInput(() => this._idleZurueck());
    stage.app.ticker.add((ticker) => this._tick(ticker));
  }

  // Leerlauf-Uhr auf 0 (Eingabe, Finger liegt auf, neue Szene)
  _idleZurueck() {
    if (this.current) this.current.idle = 0;
    for (const e of this._idle) e.next = e.after;
  }

  /** cb(szene, idleSek), sobald `after` Sekunden nichts passiert ist – und dann alle `after` Sekunden wieder. */
  onIdle(cb, { after: sek = 6 } = {}) {
    const e = { cb, after: sek, next: sek };
    this._idle.push(e);
    return () => { this._idle = this._idle.filter((x) => x !== e); };
  }

  /** cb(szene) direkt bevor enter() läuft (z. B. Musik). */
  onEnter(cb) {
    this._enter.add(cb);
    return () => this._enter.delete(cb);
  }

  /** cb(szene) beim Verlassen. */
  onExit(cb) {
    this._exit.add(cb);
    return () => this._exit.delete(cb);
  }

  /** cb(szene), sobald ein Szenenwechsel beginnt (die Blende fängt an zu schließen; die Szene lebt noch). */
  onLeave(cb) {
    this._leave.add(cb);
    return () => this._leave.delete(cb);
  }

  /** Szenenwechsel mit weicher Blende. Während eines Wechsels werden weitere Wünsche ignoriert. */
  go(id, params = {}) {
    if (this._wechsel) return this._wechsel;
    this._wechsel = this._wechsle(id, params).finally(() => { this._wechsel = null; });
    return this._wechsel;
  }

  async _wechsle(id, params) {
    stage.pauseWatch(5);
    setInputLocked(true);
    this.blende.sperre(true);
    const alt = this.current;
    if (alt) {
      this._schliesst = true;
      for (const cb of this._leave) {
        try { cb(alt); } catch (e) { console.error('[sigo] onLeave:', e); }
      }
    }
    try {
      await this.blende.schliessen();
      this._beende();
    } finally {
      this._schliesst = false;
    }

    // gewünschte Szene, sonst ein Rückfall – nie ein toter Bildschirm, nie eine Sackgasse
    const versuche = [id, ...this._rueckfaelle(id)];
    let geschafft = false;
    for (let i = 0; i < versuche.length && !geschafft; i++) {
      geschafft = await this._starte(versuche[i], i === 0 ? params : {});
    }
    if (!geschafft) recordError('Keine Szene ließ sich starten.');

    this.blende.zeigePunkte(false);
    if (this.current) this.current._shown = true;
    stage.pauseWatch(2);
    await this.blende.oeffnen();
    this.blende.sperre(false);
    setInputLocked(false);
    if (this._erstes) {
      this._erstes = false;
      this._ready(true); // ohne Bezug auf die Szene (sonst bliebe sie für immer im Speicher)
    }
    return this.current;
  }

  // Wohin, wenn eine Szene fehlt oder scheitert: Karte, dann die vorige Szene, dann jede andere angemeldete.
  // Die technische Probe-Szene nur im Testbetrieb.
  _rueckfaelle(ausser) {
    const liste = ['karte', this._vorige, ...this.registry.keys()]
      .filter((x) => x && x !== ausser && this.has(x) && (x !== 'probe' || isTest));
    return [...new Set(liste)];
  }

  async _starte(id, params) {
    const laden = this.registry.get(id);
    if (!laden) {
      recordError(`Szene '${id}' ist nicht angemeldet.`);
      return false;
    }
    let Klasse;
    try {
      const modul = await laden();
      Klasse = modul.default;
      if (typeof Klasse !== 'function' || !(Klasse.prototype instanceof Scene)) {
        throw new Error('default-Export ist keine Scene-Klasse');
      }
    } catch (e) {
      recordError(`Szene '${id}' lässt sich nicht laden`, e);
      return false;
    }

    // Pakete: alte freigeben, die die neue nicht braucht; neue laden
    const noetig = new Set(['common', ...(Klasse.packs || [])]);
    await Promise.all(loadedPacks().filter((p) => !noetig.has(p) && !BLEIBEN.has(p)).map((p) => unloadPack(p)));
    const punkte = after(0.8, () => this.blende.zeigePunkte(true), { owner: KERN });
    await Promise.all([...noetig].map((p) => loadPack(p)));
    punkte.kill();

    let s;
    try {
      s = new Klasse();
      s.id = id;
      s.params = params;
      stage.bg.addChild(s.bg);
      stage.world.addChild(s.world);
      stage.front.addChild(s.front);
      stage.hud.addChild(s.hud);
      this.current = s;
      this._idleZurueck(); // Leerlauf zählt in jeder Szene neu (auch nach einem Wechsel ohne Berührung)
      setDefaultOwner(s);
      setInputOwner(s);
      // Karten-Knopf nur, wenn es die Karte gibt (sonst führte ein Tipp ins Leere)
      if (!Klasse.ohneKarte && id !== 'karte' && this.has('karte')) baueKartenKnopf(s);
      for (const cb of this._enter) {
        try { cb(s); } catch (e) { console.error('[sigo] onEnter:', e); }
      }
      s._entered = true;
      const fertig = Promise.resolve(s.enter(params));
      // Ist enter nach 1,2 s noch nicht fertig (z. B. wartet auf eine Einleitung), geht die Blende trotzdem auf.
      const ergebnis = await Promise.race([fertig.then(() => 'fertig'), wait(1.2, { owner: KERN }).then(() => 'zeit')]);
      if (ergebnis === 'zeit') {
        fertig.catch((e) => {
          if (this.current !== s || !s._alive) return;
          recordError(`Fehler in ${id}.enter`, e);
          const ziel = this._rueckfaelle(id)[0];
          if (ziel) this.go(ziel);
        });
      }
      this._vorige = id;
      return true;
    } catch (e) {
      recordError(`Fehler beim Aufbau der Szene '${id}'`, e);
      if (s && this.current === s) this._beende();
      return false;
    }
  }

  _beende() {
    const s = this.current;
    if (!s) return;
    this.current = null;
    for (const cb of this._exit) {
      try { cb(s); } catch (e) { console.error('[sigo] onExit:', e); }
    }
    s._alive = false;
    try { s.exit(); } catch (e) { recordError(`Fehler in ${s.id}.exit`, e); }
    killOwner(s);
    offInputs(s);
    setDefaultOwner(null);
    setInputOwner(null);
    // Die Ebenen erst abbauen, wenn alles aus demselben Bild gelaufen ist: Endet ein Tween der Szene im selben Bild
    // wie die Blende, läuft der Code nach seinem `await` erst nach dieser Stelle (Mikroaufgaben). Er trifft dann
    // noch auf heile Dinge statt auf zerstörte (sonst „Cannot set properties of null"). Neue Tweens und Zeitgeber
    // der Szene sind da schon tot (alive = false). Die Ebenen liegen bis dahin unsichtbar hinter der Blende.
    const ebenen = [s.bg, s.world, s.front, s.hud];
    for (const ebene of ebenen) {
      ebene.visible = false;
      ebene.eventMode = 'none';
    }
    setTimeout(() => {
      // context: true – auch die Zeichen-Daten (GraphicsContext) der Graphics gleich freigeben, nicht erst nach
      // Minuten über die Speicherbereinigung. Szenen teilen darum keinen GraphicsContext über Szenengrenzen.
      for (const ebene of ebenen) {
        if (ebene.destroyed) continue;
        try { ebene.destroy({ children: true, context: true }); } catch (e) { console.error('[sigo] Aufräumen:', e); }
      }
    }, 0);
  }

  _tick(ticker) {
    const dt = Math.min(ticker.deltaMS / 1000, 0.05);
    updateTweens(dt);
    updateInput(dt);
    this.blende?.tick(dt);
    const s = this.current;
    if (!s || !s._alive || !s._entered) return;
    s.t += dt;
    if (!s._shown) return;
    if (!this._wechsel) {
      // Liegt ein Finger auf (hält ein Ding, ruht auf dem Matsch …), passiert gerade etwas: keine Zeige-Hand
      if (anyPointerDown()) this._idleZurueck();
      else s.idle += dt;
      for (const e of this._idle) {
        if (s.idle >= e.next) {
          e.next += e.after;
          try { e.cb(s, s.idle); } catch (err) { console.error('[sigo] onIdle:', err); }
        }
      }
    }
    try {
      s.update(dt, s.t);
    } catch (e) {
      if (!s._updateFehler) recordError(`Fehler in ${s.id}.update (weitere werden nicht gemeldet)`, e);
      s._updateFehler = (s._updateFehler || 0) + 1;
    }
  }
}

export const SceneManager = new Verwalter();

/** Szene anmelden (Kurzform). */
export function registerScene(id, laden) {
  SceneManager.register(id, laden);
}

/** Szenenwechsel (Kurzform). */
export function go(id, params) {
  return SceneManager.go(id, params);
}
