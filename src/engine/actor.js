// Figuren (Tiere, Leute): atmen von selbst, haben einen weichen Bodenschatten, hüpfen, watscheln, nicken,
// schütteln den Kopf, freuen sich, zeigen Wünsche in einer Denkblase und machen ihren Laut.
//
//   const kuh = new Actor('kuh', {x, y, scale, flip, parent: this.world});   // Bilder 'tiere/kuh_<pose>'
//   const schaf = new Actor('schaf', {pack: 'demo', parent: this.world});    // Bilder 'demo/schaf_<pose>'
//
// Aufbau:  Actor (Container: Ort, Größe)
//            ├─ schatten (weiche Ellipse am Boden, wird beim Hüpfen kleiner und blasser)
//            └─ koerper  (Bewegungen der Figur: Hüpfen, Laufen, Landen, Nicken, Schütteln)
//                 └─ huelle (kurze Rückmeldungen: Stauchen beim Posenwechsel, fx.pop/wobble/pulse)
//                      └─ atem (Ruhe-Atmen und leichtes Wiegen)
//                           └─ sprite (Anker an den Füßen; Spiegelung = Blickrichtung)
// Alle Bewegungen sind Tweens der aktuellen Szene und enden mit ihr.
//
// Bewegungen lösen sich ab: hop/hopTo/walkTo/stop beenden die laufende Bewegung. Deren Promise erfüllt sich
// dann mit false (nie hängender Code); ein normal beendeter Ablauf liefert true.
// Ist die Figur schon abgebaut (destroy), enden laufende Bewegungen still mit false, und neue fangen gar nicht
// erst an (Promise mit false) – kein Fehler, wenn eine Szene eine Figur mitten im Laufen entfernt.

import { Container, Rectangle, Sprite, Texture } from 'pixi';
import { stage } from './stage.js';
import { tex, hasTex, meta, bildBekannt } from './assets.js';
import { tween, killTweensOf, ease, after, scaleFeedback } from './tween.js';
import { tap } from './input.js';
import { animal } from './audio.js';
import { fx } from './fx.js';
import { SceneManager } from './scene.js';
import { rand, clamp, warnOnce } from './util.js';

const NEIN = () => Promise.resolve(false);   // Antwort einer abgebauten Figur

const FREUDE_SPERRE = 1.2;    // s: so lange nach einer Freude gibt es beim Antippen nur den Laut
const ATEM_STAERKE = 0.012;   // ± 1,2 % Höhe
const WIEGEN_STAERKE = 0.012; // Schrägstellung (skew) beim Wiegen

// ---------------------------------------------------------------- Texturen

function leinwand(w, h, zeichne) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  zeichne(c.getContext('2d'), w, h);
  return Texture.from(c);
}

let schattenTex = null;
function schattenTextur() {
  if (!schattenTex) {
    schattenTex = leinwand(128, 128, (c, g) => {
      const v = c.createRadialGradient(g / 2, g / 2, 0, g / 2, g / 2, g / 2);
      v.addColorStop(0, 'rgba(60,45,30,0.38)');
      v.addColorStop(0.55, 'rgba(60,45,30,0.22)');
      v.addColorStop(1, 'rgba(60,45,30,0)');
      c.fillStyle = v;
      c.fillRect(0, 0, g, g);
    });
  }
  return schattenTex;
}

// Weiße Denkblase (Wolke) mit zwei kleinen Kreisen als Schwanz unten links
let blaseTex = null;
const BLASE = { w: 340, h: 320, mitteX: 190, mitteY: 130, ankerX: 30 / 340, ankerY: 300 / 320 };
function blaseTextur() {
  if (hasTex('common/blase_denk')) return tex('common/blase_denk');
  if (!blaseTex) {
    blaseTex = leinwand(BLASE.w, BLASE.h, (c) => {
      const teile = (fn) => {
        for (const [x, y, r] of [[190, 130, 105], [110, 135, 62], [270, 135, 60], [150, 72, 58], [235, 75, 56],
          [150, 195, 55], [235, 195, 55]]) {
          c.beginPath();
          c.arc(x, y, r, 0, Math.PI * 2);
          fn();
        }
        c.beginPath(); c.arc(78, 248, 22, 0, Math.PI * 2); fn();
        c.beginPath(); c.arc(40, 290, 13, 0, Math.PI * 2); fn();
      };
      c.save();
      c.translate(0, 6);
      c.fillStyle = 'rgba(80,60,40,0.12)';
      teile(() => c.fill());
      c.restore();
      c.strokeStyle = '#dcd4c8';
      c.lineWidth = 10;
      teile(() => c.stroke());
      c.fillStyle = '#ffffff';
      teile(() => c.fill());
    });
  }
  return blaseTex;
}

// ---------------------------------------------------------------- gemeinsamer Takt

const alle = new Set();
let tickerAn = false;

function tick(ticker) {
  const dt = Math.min(ticker.deltaMS / 1000, 0.05);
  for (const a of alle) {
    if (a.destroyed) { alle.delete(a); continue; }
    try { a._tick(dt); } catch (e) { console.error('[sigo] Actor:', e); }
  }
}

// kleine Pause, die mit der Szene endet
const pause = (sek) => tween({ t: 0 }, { t: 1 }, sek, { ease: 'linear' });

// ---------------------------------------------------------------- Actor

export class Actor extends Container {
  /**
   * @param {string} id  Name der Figur (Bilder '<pack>/<id>_<pose>', Laut animal(id))
   * @param {object} opt {x, y, scale, flip, parent, z, pack='tiere', laut=id, atmen=true, blick='rechts'}
   */
  constructor(id, opt = {}) {
    super({ label: 'actor:' + id });
    this.tierId = id;
    this.pack = opt.pack ?? 'tiere';
    this.laut = opt.laut ?? id;
    this.blick = opt.blick ?? 'rechts';   // in welche Richtung die Bilder schauen (für lookAt/walkTo)
    this.atmen = opt.atmen ?? true;
    this.poseName = 'idle';
    this._zeit = rand(0, 10);
    this._periode = rand(2.6, 3.4);
    this._wiegenPeriode = this._periode * rand(1.5, 1.9);
    this.isActor = true;
    this._bewegung = null;   // Proxy-Tween von hopTo/walkTo
    this._lauf = 0;          // Marke der aktuellen Bewegung (hop/hopTo/walkTo/stop zählen hoch)
    this._hop = null;        // laufender Hüpfer auf der Stelle (Promise)
    this._freude = null;     // laufendes cheer() (Promise)
    this._geste = 0;         // Marke der aktuellen Geste (nod/shake)
    this._gesteTween = null;
    this._seiteVon = null;   // welche Bewegung die Pose 'seite' gesetzt hat
    this._blase = null;
    this._tap = null;

    this.schatten = new Sprite(schattenTextur());
    this.schatten.anchor.set(0.5);
    this.koerper = new Container({ label: 'koerper' });
    this.huelle = new Container({ label: 'huelle' });
    this.atem = new Container({ label: 'atem' });
    this.sprite = new Sprite(Texture.EMPTY);
    this.atem.addChild(this.sprite);
    this.huelle.addChild(this.atem);
    this.koerper.addChild(this.huelle);
    this.addChild(this.schatten, this.koerper);
    this._setzeTextur('idle');

    this.position.set(opt.x ?? 0, opt.y ?? 0);
    this.scale.set(opt.scale ?? 1);
    if (opt.flip) this.flip = true;
    if (opt.z !== undefined) this.zIndex = opt.z;
    opt.parent?.addChild(this);

    alle.add(this);
    this.once('destroyed', () => alle.delete(this));
    if (!tickerAn && stage.app) {
      tickerAn = true;
      stage.app.ticker.add(tick);
    }
  }

  // --- Bilder ---

  _texId(pose) {
    return `${this.pack}/${this.tierId}_${pose}`;
  }

  /**
   * Gibt es diese Pose als (geladenes) Bild? Steht sie in pack.json, ist aber noch nicht geladen (Tier fehlt in
   * `static tiere`), wird sie jetzt nachgeladen – bis dahin bleibt die jetzige Pose (kein durchsichtiges Bild).
   */
  hasPose(pose) {
    const id = this._texId(pose);
    if (hasTex(id)) return true;
    if (bildBekannt(id)) tex(id);
    return false;
  }

  _setzeTextur(pose) {
    const id = this.hasPose(pose) || pose === 'idle' ? this._texId(pose) : this._texId('idle');
    this._aktuelleTex = id;
    const t = tex(id);
    const m = meta(id);
    this.sprite.texture = t;
    this.sprite.anchor.set(m.ax ?? 0.5, hasTex(id) || bildBekannt(id) ? m.ay ?? 0.97 : 0.97);
    // Schatten passend zur Breite der Figur
    const breite = t.width * 0.62;
    this._schattenBasis = { x: breite / 128, y: (breite * 0.2) / 128 };
    this.schatten.scale.set(this._schattenBasis.x, this._schattenBasis.y);
  }

  /** Pose wechseln ('idle' | 'happy' | 'eat' | 'sleep' | 'seite' …). Fehlt das Bild, bleibt 'idle'. */
  pose(name = 'idle') {
    if (this.destroyed) return NEIN();
    const ziel = this.hasPose(name) ? name : 'idle';
    if (ziel === this.poseName) return Promise.resolve(true);
    this.poseName = ziel;
    // Kurzes Stauchen auf der Hülle – berührt keine Bewegung des Körpers (Hüpfen, Laufen, Nicken laufen weiter)
    const fertig = scaleFeedback(this.huelle, [[1.04, 0.94, 0.08, 'quadOut']], { rueck: [0.25, 'backOut'] });
    // Bildwechsel im tiefsten Punkt (eigener Zeitgeber: klappt auch, wenn das Stauchen abgelöst wird)
    after(0.08, () => {
      if (!this.destroyed && this.poseName === ziel) this._setzeTextur(ziel);
    });
    return fertig;
  }

  // --- Blickrichtung ---

  /** true = Bild gespiegelt */
  get flip() {
    return this.sprite.scale.x < 0;
  }

  set flip(an) {
    killTweensOf(this.sprite, ['scaleX']);
    this.sprite.scale.x = Math.abs(this.sprite.scale.y || 1) * (an ? -1 : 1);
    this._blickZiel = !!an;
  }

  /** Zu einer x-Stelle (Koordinaten des Eltern-Containers) schauen – mit kurzem, weichem Umdrehen. */
  lookAt(x) {
    if (this.destroyed) return Promise.resolve();
    const nachLinks = x < this.x;
    const soll = this.blick === 'links' ? !nachLinks : nachLinks;
    if (soll === this._blickZiel) return Promise.resolve();
    if (this._blickZiel === undefined && soll === this.flip) return Promise.resolve();
    this._blickZiel = soll;
    const s = this.sprite;
    killTweensOf(s, ['scaleX']);
    // durch 0 hindurch gespiegelt: sieht aus wie ein kurzes Umdrehen
    return tween(s, { scaleX: Math.abs(s.scale.y || 1) * (soll ? -1 : 1) }, 0.28, { ease: 'sineInOut' });
  }

  // --- Takt (Atmen, Schatten) ---

  _tick(dt) {
    this._zeit += dt;
    const a = this.atem;
    if (this.atmen) {
      const w = Math.sin((this._zeit / this._periode) * Math.PI * 2);
      a.scale.y = 1 + ATEM_STAERKE * w;
      a.scale.x = 1 - ATEM_STAERKE * 0.4 * w;
      a.skew.x = WIEGEN_STAERKE * Math.sin((this._zeit / this._wiegenPeriode) * Math.PI * 2);
    } else {
      // weich in die Ruhe
      const k = 1 - Math.exp(-dt * 6);
      a.scale.y += (1 - a.scale.y) * k;
      a.scale.x += (1 - a.scale.x) * k;
      a.skew.x += (0 - a.skew.x) * k;
    }
    // Schatten: je höher der Körper, desto kleiner und blasser
    const hoch = clamp(-this.koerper.y / 260, 0, 1);
    const b = this._schattenBasis;
    this.schatten.scale.set(b.x * (1 - 0.4 * hoch), b.y * (1 - 0.4 * hoch));
    this.schatten.alpha = 1 - 0.55 * hoch;
  }

  // --- Bewegungen ---

  // Laufende Bewegung beenden (ihr Promise erfüllt sich mit false) und eine neue Marke ziehen. → neue Marke
  _stoppeBewegung() {
    this._lauf++;
    this._hop = null;
    this._bewegung?.stop();
    this._bewegung = null;
    this._gesteTween?.stop();
    this._gesteTween = null;
    killTweensOf(this, ['x', 'y']);
    const k = this.koerper;
    killTweensOf(k);
    // Kippen und Stauchen der alten Bewegung weich auflösen (Höhe übernimmt die neue Bewegung)
    if (k.rotation !== 0 || k.scale.x !== 1 || k.scale.y !== 1) {
      tween(k, { rotation: 0, scaleX: 1, scaleY: 1 }, 0.15, { ease: 'sineOut' });
    }
    return this._lauf;
  }

  // Gehört die Bewegung mit dieser Marke noch dazu?
  _laeuft(lauf) {
    return lauf === this._lauf && !this.destroyed;
  }

  /**
   * Jede Bewegung anhalten (Hüpfen, Laufen, Nicken, Schütteln) – z. B. wenn ein Finger die Figur greift.
   * Der Körper kommt weich zur Ruhe; wartende Bewegungs-Promises erfüllen sich mit false.
   */
  stop() {
    if (this.destroyed) return this;
    this._stoppeBewegung();
    killTweensOf(this.koerper);
    const k = this.koerper;
    if (k.y !== 0 || k.rotation !== 0 || k.scale.x !== 1 || k.scale.y !== 1) {
      tween(k, { y: 0, rotation: 0, scaleX: 1, scaleY: 1 }, 0.2, { ease: 'sineOut' });
    }
    return this;
  }

  async _lande(staub, lauf) {
    const k = this.koerper;
    k.y = 0;
    if (staub) {
      const p = this._inFront({ x: this.x, y: this.y });
      if (p) fx.burst('staub', p.x, p.y, { count: 5, parent: p.ebene });
    }
    if (!(await tween(k, { scaleX: 1.07, scaleY: 0.93 }, 0.08, { ease: 'quadOut' })) || !this._laeuft(lauf)) return false;
    return (await tween(k, { scaleX: 1, scaleY: 1 }, 0.3, { ease: 'backOut' })) && this._laeuft(lauf);
  }

  /**
   * Hüpfer auf der Stelle. Läuft schon einer, wird kein neuer angesetzt (kein Gezappel bei Dauertippen) –
   * man bekommt das Promise des laufenden. → Promise<boolean>
   */
  hop(hoehe = 70, { staub = false } = {}) {
    if (this.destroyed) return NEIN();
    if (this._hop) return this._hop;
    const lauf = this._stoppeBewegung();
    const k = this.koerper;
    const ablauf = async () => {
      if (!(await tween(k, { scaleX: 1.06, scaleY: 0.92, y: 0, rotation: 0 }, 0.09, { ease: 'quadOut' })) ||
          !this._laeuft(lauf)) return false;
      tween(k, { scaleX: 0.97, scaleY: 1.04 }, 0.2, { ease: 'sineOut' });
      if (!(await tween(k, { y: -hoehe }, 0.24, { ease: 'quadOut' })) || !this._laeuft(lauf)) return false;
      tween(k, { scaleX: 1, scaleY: 1 }, 0.2, { ease: 'sineInOut' });
      if (!(await tween(k, { y: 0 }, 0.22, { ease: 'quadIn' })) || !this._laeuft(lauf)) return false;
      return this._lande(staub, lauf);
    };
    const hop = ablauf().then((ok) => {
      if (this._hop === hop) this._hop = null;
      return ok;
    });
    this._hop = hop;
    return hop;
  }

  /**
   * Im Bogen zu (x, y) hüpfen: hopTo(x, y, {hoehe=90, dauer=0.6, staub=true, drehen=true}).
   * drehen:false = die Blickrichtung bleibt (z. B. ein Stück rückwärts hüpfen). → Promise<boolean>
   */
  async hopTo(x, y, opt = {}) {
    if (this.destroyed) return false;
    if (y === undefined) y = this.y;
    const lauf = this._stoppeBewegung();
    const hoehe = opt.hoehe ?? 90;
    const dauer = Math.max(0.3, opt.dauer ?? 0.6);
    if (opt.drehen !== false && Math.abs(x - this.x) > 5) this.lookAt(x);
    const k = this.koerper;
    if (!(await tween(k, { scaleX: 1.06, scaleY: 0.92 }, 0.09, { ease: 'quadOut' })) || !this._laeuft(lauf)) return false;
    tween(k, { scaleX: 0.97, scaleY: 1.04 }, dauer * 0.4, { ease: 'sineOut' }).then((ok) => {
      if (ok && this._laeuft(lauf)) tween(k, { scaleX: 1, scaleY: 1 }, dauer * 0.4, { ease: 'sineInOut' });
    });
    const x0 = this.x;
    const y0 = this.y;
    const proxy = { p: 0 };
    const bewegung = tween(proxy, { p: 1 }, dauer, {
      ease: 'linear',
      onUpdate: () => {
        if (this.destroyed) { bewegung.stop(); return; }   // abgebaut: still enden
        const p = proxy.p;
        const e = ease.sineInOut(p);
        this.x = x0 + (x - x0) * e;
        this.y = y0 + (y - y0) * e;
        k.y = -hoehe * 4 * p * (1 - p);
      },
    });
    this._bewegung = bewegung;
    if (!(await bewegung) || !this._laeuft(lauf)) return false;
    this._bewegung = null;
    return this._lande(opt.staub ?? true, lauf);
  }

  /**
   * Watschelnd zu (x, y) laufen: walkTo(x, y, {tempo=260, drehen=true}) – kleine Hüpfer, leichtes Kippen.
   * drehen:false = die Blickrichtung bleibt. → Promise<boolean>
   */
  async walkTo(x, y, opt = {}) {
    if (this.destroyed) return false;
    if (y === undefined) y = this.y;
    const lauf = this._stoppeBewegung();
    const tempo = Math.max(40, opt.tempo ?? 260);
    const d = Math.hypot(x - this.x, y - this.y);
    if (d < 2) return true;
    if (opt.drehen !== false && Math.abs(x - this.x) > 5) this.lookAt(x);
    const vorher = this.poseName;
    const seitlich = this.hasPose('seite');
    if (seitlich) {
      this.pose('seite');
      this._seiteVon = lauf;
    }
    const dauer = d / tempo;
    const schritt = 0.34; // Sekunden pro Schritt
    const k = this.koerper;
    const x0 = this.x;
    const y0 = this.y;
    const proxy = { p: 0 };
    const bewegung = tween(proxy, { p: 1 }, dauer, {
      ease: 'linear',
      onUpdate: () => {
        if (this.destroyed) { bewegung.stop(); return; }   // abgebaut: still enden
        const p = proxy.p;
        this.x = x0 + (x - x0) * p;
        this.y = y0 + (y - y0) * p;
        const t = p * dauer;
        const phase = (t / schritt) * Math.PI;
        const weich = clamp(Math.min(t, dauer - t) / 0.2, 0, 1); // am Anfang und Ende sanft
        k.y = -Math.abs(Math.sin(phase)) * 14 * weich;
        k.rotation = Math.sin(phase) * 0.05 * weich;
      },
    });
    this._bewegung = bewegung;
    const ok = (await bewegung) && this._laeuft(lauf);
    if (ok) {
      this._bewegung = null;
      k.y = 0;
      k.rotation = 0;
    }
    // Seiten-Pose zurück – außer eine neuere Bewegung hat sie inzwischen selbst gesetzt
    if (seitlich && this._seiteVon === lauf && !this.destroyed) {
      this._seiteVon = null;
      if (this.poseName === 'seite') this.pose(vorher === 'seite' ? 'idle' : vorher);
    }
    return ok;
  }

  // Neue Geste (nod/shake) beginnen: die vorige endet. → Marke
  _neueGeste() {
    this._gesteTween?.stop();
    this._gesteTween = null;
    return ++this._geste;
  }

  /** Zweimal nicken (ja). Läuft neben einer Bewegung her, ohne sie zu beenden. → Promise<boolean> */
  async nod() {
    if (this.destroyed) return false;
    const geste = this._neueGeste();
    const k = this.koerper;
    const richtung = this.flip ? -1 : 1;
    const schritt = async (props, dauer) => {
      this._gesteTween = tween(k, props, dauer, { ease: 'sineInOut' });
      return (await this._gesteTween) && geste === this._geste && !this.destroyed;
    };
    for (let i = 0; i < 2; i++) {
      if (!(await schritt({ scaleY: 0.95, scaleX: 1.02, rotation: 0.04 * richtung }, 0.18))) return false;
      if (!(await schritt({ scaleY: 1, scaleX: 1, rotation: 0 }, 0.22))) return false;
    }
    this._gesteTween = null;
    return true;
  }

  /** Kopfschütteln (nein): der ganze Körper dreht sich langsam hin und her. → Promise<boolean> */
  shake() {
    if (this.destroyed) return NEIN();
    this._neueGeste();
    const k = this.koerper;
    const proxy = { p: 0 };
    const t = tween(proxy, { p: 1 }, 1.2, {
      ease: 'linear',
      onUpdate: () => { if (!k.destroyed) k.rotation = Math.sin(proxy.p * Math.PI * 3) * 0.07 * (1 - 0.4 * proxy.p); },
      onComplete: () => { if (!k.destroyed) k.rotation = 0; },
    });
    this._gesteTween = t;
    // abgelöst? Eine neue Geste setzt die Drehung selbst, eine neue Bewegung stellt den Körper weich gerade
    return t.then((ok) => {
      if (this._gesteTween === t) this._gesteTween = null;
      return ok;
    });
  }

  /**
   * Freut sich: Pose 'happy', Hüpfer, ein paar Herzen, Tierlaut. Wird während der Freude (mindestens 1,2 s) wieder
   * getippt, gibt es nur den Laut (kein neuer Sprung, keine neuen Herzen – nichts zappelt). → Promise<boolean>
   * cheer({parent}): die Herzen fliegen in diesem Container statt in der front-Ebene der Szene (z. B. in der
   * Ebene einer Seite, damit sie beim Blättern mitgleiten).
   */
  cheer({ parent = null } = {}) {
    if (this.destroyed) return NEIN();
    // Die Sperre ist zeitlich: Auch wenn der Hüpfer abgebrochen wird (ein Finger greift die Figur, drag hält sie
    // an), beginnt frühestens nach FREUDE_SPERRE Sekunden eine neue Freude mit Herzen und Sprung.
    const jetzt = performance.now();
    if (this._freude || jetzt < (this._freudeBis || 0)) {
      this.sound();
      return this._freude || NEIN();
    }
    this._freudeBis = jetzt + FREUDE_SPERRE * 1000;
    this.pose('happy');
    this.sound();
    const kopf = parent && !parent.destroyed
      ? this._inEbene(this.point('kopf'), parent)
      : this._inFront(this.point('kopf'));
    if (kopf) fx.burst('herzen', kopf.x, kopf.y + 30, { count: 6, parent: kopf.ebene });
    const freude = (async () => {
      const ok = await this.hop(80);
      if (ok) await pause(0.7);
      if (!this.destroyed && this.poseName === 'happy') this.pose('idle');
      return ok;
    })().then((ok) => {
      if (this._freude === freude) this._freude = null;
      return ok;
    });
    this._freude = freude;
    return freude;
  }

  /** Tierlaut. → Promise<boolean> */
  sound() {
    return animal(this.laut);
  }

  // --- Punkte ---

  // Punkt im Bild (Bildpunkte des fertigen Bildes) → Koordinaten des Sprites (relativ zum Anker)
  _bildPunkt(name) {
    const id = this._aktuelleTex;
    const t = this.sprite.texture;
    const m = meta(id);
    const echt = hasTex(id) || bildBekannt(id);
    const w = echt ? m.w ?? t.width : t.width;
    const h = echt ? m.h ?? t.height : t.height;
    const pts = echt ? m.pts || {} : {};
    let p = pts[name];
    if (!p && name === 'mund') p = pts.mouth;
    if (!p && name === 'mouth') p = pts.mund;
    if (!p && name === 'head') p = pts.kopf;
    if (!p) {
      if (name === 'mouth' || name === 'mund') p = [w * 0.5, h * 0.38];
      else if (name === 'kopf' || name === 'head') p = [w * 0.5, 0];
      else p = [w * 0.5, h * 0.5];
    }
    return { x: p[0] - this.sprite.anchor.x * w, y: p[1] - this.sprite.anchor.y * h };
  }

  /** Benannter Punkt ('mouth', 'kopf', … aus pack.json) in Koordinaten des Eltern-Containers. */
  point(name) {
    const g = this.sprite.toGlobal(this._bildPunkt(name));
    return this.parent ? this.parent.toLocal(g) : { x: g.x, y: g.y };
  }

  // Punkt aus Eltern-Koordinaten in die front-Ebene der Szene umrechnen (dort fliegen die Teilchen)
  _inFront(p) {
    const szene = SceneManager.current;
    if (!szene || !szene.alive || !p) return null;
    return this._inEbene(p, szene.front);
  }

  // Punkt aus Eltern-Koordinaten in die Koordinaten von `ebene` umrechnen
  _inEbene(p, ebene) {
    if (!p || !ebene || ebene.destroyed) return null;
    const g = this.parent ? this.parent.toGlobal(p) : p;
    const l = ebene.toLocal(g);
    return { x: l.x, y: l.y, ebene };
  }

  // --- Denkblase ---

  /**
   * Denkblase mit Bild über dem Kopf: bubble('pack/bild' | Textur, sek=2.5, {seite}). → Promise (wenn wieder weg;
   * true = ganz gezeigt). seite: 'rechts' | 'links' – nach welcher Seite die Blase vom Kopf weg steht. Ohne
   * Angabe rechts; würde sie dort über den Bildrand ragen, von selbst links (zur Bildmitte hin).
   * Unbekanntes Bild: Warnung in der Konsole, keine Blase (→ false).
   */
  async bubble(quelle, sek = 2.5, { seite } = {}) {
    if (this.destroyed) return false;
    const bildTex = typeof quelle === 'string' ? (hasTex(quelle) ? tex(quelle) : null)
      : quelle instanceof Texture && !quelle.destroyed ? quelle : null;
    if (!bildTex) {
      warnOnce(`bubble: unbekanntes Bild '${typeof quelle === 'string' ? quelle : String(quelle)}' – keine Denkblase.`);
      return false;
    }
    if (this._blase && !this._blase.destroyed) {
      const alt = this._blase;
      tween(alt, { alpha: 0 }, 0.25, { ease: 'sineInOut' }).then(() => { if (!alt.destroyed) alt.destroy({ children: true }); });
    }
    const b = new Container({ label: 'denkblase' });
    const t = blaseTextur();
    const grund = new Sprite(t);
    // Anker am kleinsten Bläschen (Punkt 'schwanz'), Bild in die Mitte der Fläche (Punkt 'innen')
    let schwanz = [BLASE.ankerX * BLASE.w, BLASE.ankerY * BLASE.h];
    let innen = [BLASE.mitteX, BLASE.mitteY];
    if (hasTex('common/blase_denk')) {
      const m = meta('common/blase_denk');
      schwanz = m.pts?.schwanz || [m.w * 0.1, m.h * 0.95];
      innen = m.pts?.innen || [m.w * 0.55, m.h * 0.45];
    }
    grund.anchor.set(schwanz[0] / t.width, schwanz[1] / t.height);
    const breite = 330;
    const s = breite / t.width;
    grund.scale.set(s);
    b.addChild(grund);

    const bild = new Sprite(bildTex);
    bild.anchor.set(0.5);
    const groesse = 170;
    bild.scale.set(groesse / Math.max(bild.texture.width, bild.texture.height, 1));
    const innenX = (innen[0] - schwanz[0]) * s;
    bild.position.set(innenX, (innen[1] - schwanz[1]) * s);
    b.addChild(bild);

    // über dem Kopf, leicht zur Seite; Größe unabhängig von der Skalierung der Figur
    const hier = this.toLocal(this.sprite.toGlobal(this._bildPunkt('kopf')));
    const skala = 1 / Math.max(0.05, Math.abs(this.scale.x));
    const stelle = (richtung) => {
      grund.scale.x = s * richtung;          // Wolke gespiegelt, das Bild darin nicht
      bild.x = innenX * richtung;
      b.position.set(hier.x + 40 * skala * richtung, hier.y - 10 * skala);
    };
    b.zIndex = 10;
    this.addChild(b);
    let richtung = seite === 'links' ? -1 : 1;
    stelle(richtung);
    if (seite !== 'links' && seite !== 'rechts') {
      // Ragte die fertige Blase rechts über den sichtbaren Bildrand, steht sie links (zur Bildmitte hin)
      b.scale.set(skala);
      const r = b.getBounds();
      const rechtsRand = stage.buehne ? stage.buehne.toLocal({ x: r.maxX, y: r.minY }).x : -Infinity;
      if (rechtsRand > stage.W - 20) {
        richtung = -1;
        stelle(richtung);
      }
    }
    b.scale.set(skala * 0.6);
    b.alpha = 0;
    this._blase = b;

    tween(b, { alpha: 1 }, 0.35, { ease: 'sineInOut' });
    const ok = (await tween(b, { scale: skala }, 0.45, { ease: 'backOut' })) && !b.destroyed;
    if (ok) await pause(Math.max(0.5, sek));
    if (!b.destroyed) await tween(b, { alpha: 0, scale: skala * 0.85 }, 0.45, { ease: 'sineInOut' });
    if (!b.destroyed) b.destroy({ children: true });
    if (this._blase === b) this._blase = null;
    return ok;
  }

  // --- Antippen ---

  /**
   * Tappbar machen: onTap(fn) – fn({x, y, …}, actor). Ohne fn: Standard-Reaktion (wackeln + Laut).
   * Gibt das Eingabe-Objekt mit .off() zurück.
   */
  onTap(fn, { pad = 40 } = {}) {
    this._tap?.off();
    const t = this.sprite.texture;
    const ax = this.sprite.anchor.x;
    const ay = this.sprite.anchor.y;
    const halb = t.width * Math.max(ax, 1 - ax);
    const p = pad / Math.max(0.05, Math.abs(this.scale.x));
    const flaeche = new Rectangle(-halb - p, -ay * t.height - p, 2 * (halb + p), t.height + 2 * p);
    this._tap = tap(this, (e) => {
      if (fn) fn(e, this);
      else {
        fx.wobble(this);
        this.sound();
      }
    }, { squash: false, sound: null, hitArea: flaeche });
    return this._tap;
  }
}
