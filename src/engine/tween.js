// Weiche Bewegungen (Tweens) und Zeitgeber – alles läuft über EINEN zentralen Updater (updateTweens),
// den der Szenen-Verwalter jedes Bild mit dt aufruft. Kein requestAnimationFrame pro Tween.
//
// Jeder Tween/Zeitgeber gehört einem „Besitzer" (meist die Szene). killOwner(besitzer) beendet alle auf einmal.
//
// Zwei Arten, einen Tween zu beenden:
// - kill()  – abbrechen (z. B. Szene endet): das Promise erfüllt sich NIE, Code nach `await` läuft nicht weiter.
// - stop()  – ersetzen (eine neue Bewegung übernimmt dieselben Felder, z. B. Antippen staucht, Finger greift):
//             das Ding bleibt, wo es ist, und das Promise erfüllt sich mit false. So bleibt im laufenden Spiel
//             nie Code hängen. killTweensOf() ersetzt (stop), killOwner() bricht ab (kill).
// Ein Tween, der sein Ziel erreicht, erfüllt sein Promise mit true.
//
// Ruhe-Größe: Kurze Rückmeldungen (Stauchen beim Antippen, Anheben beim Ziehen, pop, pulse …) laufen alle über
// scaleFeedback() und teilen sich EINEN Speicher für die Größe, zu der das Ding zurückkehrt. Läuft gerade ein
// fremder Größen-Tween (z. B. der Szene), zählt dessen Ziel als Ruhe-Größe – nichts bleibt verzerrt.

// ---------------------------------------------------------------- Kurven
const c1 = 1.70158;
const c3 = c1 + 1;

export const ease = {
  linear: (t) => t,
  quadIn: (t) => t * t,
  quadOut: (t) => 1 - (1 - t) * (1 - t),
  quadInOut: (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
  cubicIn: (t) => t * t * t,
  cubicOut: (t) => 1 - Math.pow(1 - t, 3),
  cubicInOut: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  sineIn: (t) => 1 - Math.cos((t * Math.PI) / 2),
  sineOut: (t) => Math.sin((t * Math.PI) / 2),
  sineInOut: (t) => -(Math.cos(Math.PI * t) - 1) / 2,
  backIn: (t) => c3 * t * t * t - c1 * t * t,
  backOut: (t) => 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2),
  elasticOut: (t) => {
    if (t === 0 || t === 1) return t;
    return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1;
  },
  bounceOut: (t) => {
    const n1 = 7.5625;
    const d1 = 2.75;
    if (t < 1 / d1) return n1 * t * t;
    if (t < 2 / d1) return n1 * (t -= 1.5 / d1) * t + 0.75;
    if (t < 2.5 / d1) return n1 * (t -= 2.25 / d1) * t + 0.9375;
    return n1 * (t -= 2.625 / d1) * t + 0.984375;
  },
};

// ---------------------------------------------------------------- Sonderfelder
// scale = gleichmäßig; das Vorzeichen von scale.x (Spiegelung) bleibt dabei erhalten.
const SONDER = {
  scale: {
    get: (o) => Math.abs(o.scale.y),
    set: (o, v) => { o.scale.x = (o.scale.x < 0 ? -1 : 1) * v; o.scale.y = v; },
  },
  scaleX: { get: (o) => o.scale.x, set: (o, v) => { o.scale.x = v; } },
  scaleY: { get: (o) => o.scale.y, set: (o, v) => { o.scale.y = v; } },
  skewX: { get: (o) => o.skew.x, set: (o, v) => { o.skew.x = v; } },
  skewY: { get: (o) => o.skew.y, set: (o, v) => { o.skew.y = v; } },
  pivotX: { get: (o) => o.pivot.x, set: (o, v) => { o.pivot.x = v; } },
  pivotY: { get: (o) => o.pivot.y, set: (o, v) => { o.pivot.y = v; } },
};

function zugriff(obj, name) {
  if (SONDER[name] && obj && obj.scale !== undefined) return SONDER[name];
  return { get: (o) => o[name], set: (o, v) => { o[name] = v; } };
}

// ---------------------------------------------------------------- Verwaltung
const aktiv = [];             // laufende Tweens und Zeitgeber
let standardBesitzer = null;  // wird vom Szenen-Verwalter auf die laufende Szene gesetzt

/** Besitzer für Tweens/Zeitgeber ohne ausdrückliches opt.owner (die gerade laufende Szene). */
export function setDefaultOwner(owner) {
  standardBesitzer = owner;
}

function besitzerAus(opt) {
  return opt && opt.owner !== undefined ? opt.owner : standardBesitzer;
}

// Promise, das sich nur „von innen" erfüllen lässt
function offenesVersprechen() {
  let erfuellen;
  const promise = new Promise((res) => { erfuellen = res; });
  return { promise, erfuellen };
}

class Tween {
  constructor(target, props, dauer, opt) {
    this.target = target;
    this.props = props;
    this.dauer = Math.max(0, dauer);
    this.ease = typeof opt.ease === 'function' ? opt.ease : ease[opt.ease] || ease.quadOut;
    this.delay = opt.delay || 0;
    this.yoyo = !!opt.yoyo;
    this.wiederholungen = opt.repeat === -1 ? Infinity : opt.repeat || 0;
    this.onUpdate = opt.onUpdate || null;
    this.onComplete = opt.onComplete || null;
    this.owner = besitzerAus(opt);
    this.feedback = !!opt.feedback; // kurze Rückmeldung des Kerns (siehe scaleFeedback)
    this.zeit = 0;
    this.gestartet = false;
    this.tot = false;
    this.felder = null; // [{zugriff, von, nach}]
    this.startWerte = null; // {name: Wert beim Start} (für yoyo: dorthin kehrt er zurück)
    const { promise, erfuellen } = offenesVersprechen();
    this._promise = promise;
    this._erfuellen = erfuellen;
  }

  _starte() {
    this.gestartet = true;
    this.felder = [];
    this.startWerte = {};
    for (const name of Object.keys(this.props)) {
      const ziel = this.props[name];
      if (typeof ziel !== 'number' || Number.isNaN(ziel)) continue;
      const z = zugriff(this.target, name);
      const von = z.get(this.target);
      this.startWerte[name] = von;
      this.felder.push({ name, z, von, nach: ziel });
    }
  }

  // Lebt der Besitzer noch? (Szene ohne alive-Feld oder Kern-Besitzer: ja)
  _besitzerLebt() {
    return !this.owner || this.owner.alive !== false;
  }

  _setze(p) {
    const k = this.ease(p);
    for (const f of this.felder) f.z.set(this.target, f.von + (f.nach - f.von) * k);
    if (this.onUpdate) this.onUpdate(p);
  }

  step(dt) {
    if (this.target && this.target.destroyed) {
      // Ding wurde während der Szene zerstört: nicht hängen lassen (endet die Szene, gilt kill)
      if (this._besitzerLebt()) this.stop();
      else this.kill();
      return;
    }
    if (this.delay > 0) {
      this.delay -= dt;
      if (this.delay > 0) return;
      dt = -this.delay;
      this.delay = 0;
    }
    if (!this.gestartet) this._starte();
    this.zeit += dt;
    if (this.dauer === 0 || this.zeit >= this.dauer) {
      if (this.wiederholungen > 0) {
        this.wiederholungen--;
        this.zeit = this.dauer > 0 ? this.zeit % this.dauer : 0;
        if (this.yoyo) {
          for (const f of this.felder) [f.von, f.nach] = [f.nach, f.von];
        }
        this._setze(this.dauer > 0 ? this.zeit / this.dauer : 1);
        return;
      }
      this._setze(1);
      this.tot = true;
      if (this.onComplete) this.onComplete();
      this._erfuellen(true);
      return;
    }
    this._setze(this.zeit / this.dauer);
  }

  /**
   * Abbrechen: das Promise erfüllt sich nie (wie beim Verlassen der Szene).
   * Mit fertig=true springt der Tween stattdessen ans Ziel und erfüllt sein Promise mit true.
   */
  kill(fertig = false) {
    if (this.tot) return this;
    this.tot = true;
    if (fertig && this.target && !this.target.destroyed) {
      if (!this.gestartet) this._starte();
      this._setze(1);
      this._erfuellen(true);
    }
    return this;
  }

  /** Ersetzen/anhalten: bleibt, wo er ist; das Promise erfüllt sich mit false. onComplete läuft nicht. */
  stop() {
    if (this.tot) return this;
    this.tot = true;
    this._erfuellen(false);
    return this;
  }

  /** Feld-Namen, die dieser Tween bewegt (für killTweensOf mit Feldern). */
  bewegt(name) {
    return Object.prototype.hasOwnProperty.call(this.props, name);
  }

  then(ok, fehler) {
    return this._promise.then(ok, fehler);
  }
}

class Zeitgeber {
  constructor(sek, fn, wiederholen, opt) {
    this.sek = Math.max(0.0001, sek);
    this.rest = this.sek;
    this.fn = fn;
    this.wiederholen = wiederholen;
    this.owner = besitzerAus(opt);
    this.tot = false;
    this.target = null;
  }

  step(dt) {
    this.rest -= dt;
    if (this.rest > 0) return;
    if (this.wiederholen) {
      this.rest += this.sek;
      if (this.rest < 0) this.rest = this.sek; // nach langer Pause nicht mehrfach nachholen
    } else {
      this.tot = true;
    }
    this.fn();
  }

  kill() {
    this.tot = true;
    return this;
  }
}

// ---------------------------------------------------------------- öffentliche Funktionen

/**
 * tween(obj, {x, y, scale, scaleX, scaleY, rotation, alpha, skewX, …}, dauer, {ease, delay, yoyo, repeat, onUpdate,
 * onComplete, owner, overwrite}) → thenable mit .kill() und .stop().  repeat: Anzahl Wiederholungen, -1 = endlos.
 * Das Promise erfüllt sich mit true (Ziel erreicht) oder false (durch eine neue Bewegung ersetzt).
 */
export function tween(target, props, dauer = 0.4, opt = {}) {
  if (opt.overwrite) killTweensOf(target, Object.keys(props));
  // Eine „echte" Größen-Bewegung (z. B. der Szene) übernimmt: laufende Rückmeldungen enden, Ruhe-Größe vergessen
  if (!opt.feedback && target && ruhe.has(target) && GROESSE.some((f) => f in props)) {
    stoppeRueckmeldung(target);
    ruhe.delete(target);
  }
  // Eine echte Drehung übernimmt: ein laufendes Wackeln (fx.wobble) desselben Dings endet, sonst setzte es am
  // Ende die alte Drehung zurück
  if (!opt.feedback && target && 'rotation' in props) {
    for (const w of aktiv) if (!w.tot && w.wackelt === target) w.stop();
  }
  const t = new Tween(target, props, dauer, opt);
  aktiv.push(t);
  return t;
}

/** Ein Tween, der nie etwas tut und nie auslöst (z. B. wenn die Szene schon beendet ist). */
export function deadTween() {
  const t = new Tween(null, {}, 0, { owner: null });
  t.tot = true;
  return t;
}

/** fn einmal nach sek Sekunden aufrufen. → {kill()} */
export function after(sek, fn, opt = {}) {
  const z = new Zeitgeber(sek, fn, false, opt);
  aktiv.push(z);
  return z;
}

/** fn alle sek Sekunden aufrufen. → {kill()} */
export function every(sek, fn, opt = {}) {
  const z = new Zeitgeber(sek, fn, true, opt);
  aktiv.push(z);
  return z;
}

/** Promise, das nach sek Sekunden erfüllt wird (endet mit dem Besitzer, dann nie). */
export function wait(sek, opt = {}) {
  return new Promise((res) => after(sek, res, opt));
}

/**
 * Alle Tweens eines Objekts ersetzen/anhalten (optional nur die, die bestimmte Felder bewegen).
 * Ihre Promises erfüllen sich mit false – wartender Code läuft weiter.
 */
export function killTweensOf(target, felder = null) {
  for (const t of aktiv) {
    if (t.tot || t.target !== target || !(t instanceof Tween)) continue;
    if (!felder || felder.some((f) => t.bewegt(f))) t.stop();
  }
}

/** Wohin bringen die laufenden Tweens das Feld `name`? (Ziel des letzten, bei yoyo der Startwert; sonst jetzt) */
export function targetValue(target, name) {
  let wert = target[name];
  for (const t of aktiv) {
    if (t.tot || t.target !== target || !(t instanceof Tween) || !t.bewegt(name)) continue;
    const quelle = t.yoyo ? t.startWerte : t.props;
    if (quelle && typeof quelle[name] === 'number') wert = quelle[name];
  }
  return wert;
}

// ---------------------------------------------------------------- Ruhe-Größe und Größen-Rückmeldungen

const GROESSE = ['scale', 'scaleX', 'scaleY'];
const ruhe = new WeakMap(); // obj → {x, y}: dorthin kehren alle Rückmeldungen zurück

const bewegtGroesse = (t) => GROESSE.some((f) => t.bewegt(f));

// laufende Größen-Rückmeldungen eines Dings ersetzen
function stoppeRueckmeldung(obj) {
  for (const t of aktiv) {
    if (!t.tot && t.target === obj && t instanceof Tween && t.feedback && bewegtGroesse(t)) t.stop();
  }
}

/**
 * Ruhe-Größe eines Dings ({x, y}, gemeinsam für den ganzen Kern). Beim ersten Mal wird sie gemerkt: die jetzige
 * Größe – oder, wenn gerade ein fremder Größen-Tween läuft, dessen Ziel (der Tween wird dabei ersetzt).
 */
export function restScale(obj) {
  let r = ruhe.get(obj);
  if (r) return r;
  r = { x: obj.scale.x, y: obj.scale.y };
  for (const t of aktiv) {
    if (t.tot || t.target !== obj || !(t instanceof Tween) || t.feedback || !bewegtGroesse(t)) continue;
    const quelle = t.yoyo ? t.startWerte || {} : t.props;
    if (typeof quelle.scale === 'number') {
      r.x = (r.x < 0 ? -1 : 1) * quelle.scale;
      r.y = quelle.scale;
    }
    if (typeof quelle.scaleX === 'number') r.x = quelle.scaleX;
    if (typeof quelle.scaleY === 'number') r.y = quelle.scaleY;
    t.stop();
  }
  ruhe.set(obj, r);
  return r;
}

/** Laufende Rückmeldungen beenden und das Ding sofort auf seine Ruhe-Größe setzen (falls eine gemerkt ist). */
export function resetScale(obj) {
  const r = ruhe.get(obj);
  if (!r) return;
  stoppeRueckmeldung(obj);
  ruhe.delete(obj);
  if (!obj.destroyed) obj.scale.set(r.x, r.y);
}

/**
 * Kurze Größen-Rückmeldung: schritte = [[faktorX, faktorY, dauer, ease], …] relativ zur Ruhe-Größe, danach weich
 * zurück (rueck = [dauer, ease]) – oder mit halten:true dort stehen bleiben (angehoben beim Ziehen; später mit
 * scaleFeedback(obj, []) zurück). Eine neue Rückmeldung löst die alte sauber ab; am Ende steht das Ding immer in
 * derselben Ruhe-Größe. → Promise<boolean>: true = fertig, false = abgelöst.
 */
export function scaleFeedback(obj, schritte = [], { rueck = [0.25, 'backOut'], halten = false } = {}) {
  if (!obj || obj.destroyed || !obj.scale) return Promise.resolve(false);
  const r = restScale(obj);
  stoppeRueckmeldung(obj);
  return new Promise((fertig) => {
    let i = 0;
    const naechster = () => {
      if (obj.destroyed) { fertig(false); return; }
      let ziel;
      let dauer;
      let kurve;
      let letzter = false;
      if (i < schritte.length) {
        const [fx, fy, d, e] = schritte[i++];
        ziel = { scaleX: r.x * fx, scaleY: r.y * fy };
        dauer = d;
        kurve = e;
      } else if (halten) {
        fertig(true);
        return;
      } else {
        ziel = { scaleX: r.x, scaleY: r.y };
        [dauer, kurve] = rueck;
        letzter = true;
      }
      const t = tween(obj, ziel, dauer, {
        ease: kurve,
        feedback: true,
        onComplete: letzter ? () => { ruhe.delete(obj); fertig(true); } : naechster,
      });
      t.then((ok) => { if (!ok) fertig(false); });
    };
    naechster();
  });
}

/** Läuft gerade ein Tween auf dem Objekt? */
export function isTweening(target) {
  return aktiv.some((t) => !t.tot && t.target === target);
}

/** Alle Tweens und Zeitgeber eines Besitzers beenden. */
export function killOwner(owner) {
  for (const t of aktiv) if (t.owner === owner) t.kill();
}

/** Der zentrale Updater – einmal pro Bild. */
export function updateTweens(dt) {
  const n = aktiv.length;
  for (let i = 0; i < n; i++) {
    const t = aktiv[i];
    if (t.tot) continue;
    try {
      t.step(dt);
    } catch (e) {
      console.error('[sigo] Fehler in Tween/Zeitgeber:', e);
      t.kill();
    }
  }
  // tote entfernen (neue, die während des Durchlaufs dazukamen, bleiben erhalten)
  let j = 0;
  for (let i = 0; i < aktiv.length; i++) if (!aktiv[i].tot) aktiv[j++] = aktiv[i];
  aktiv.length = j;
}

/** Anzahl laufender Tweens/Zeitgeber (zum Testen). */
export function tweenCount() {
  return aktiv.length;
}
