// Orte mit mehreren Bilderbuch-Seiten.
//
//   class Futterplatz extends Seite {
//     static hg = 'bauernhof/hg_futter';   // Hintergrund (mittig, Höhe 1600, automatisch eingesetzt)
//     aufbau() { … }                       // einmal beim ersten Besuch: Dinge in this.welt / this.vorn / this.hud
//     betreten() { … }                     // jedes Mal, wenn die Seite fertig hereingeglitten ist
//     verlassen() { … }                    // jedes Mal, wenn das Wegblättern beginnt (und beim Verlassen der Szene)
//     update(dt, t) { … }                  // nur solange die Seite sichtbar ist
//     hinweise() { return [obj, …]; }      // Ziele für die Zeige-Hand
//   }
//   export default class Bauernhof extends SeitenSzene {
//     static id = 'bauernhof';
//     static packs = ['bauernhof'];
//     static seiten = [Futterplatz, Huehner, Melken, Waschen];
//   }
//
// Aufbau: Jede Seite hat vier eigene Container – `hinten` (in szene.bg, dort liegt der Hintergrund),
// `welt` (in szene.world), `vorn` (in szene.front) und `hud` (in szene.hud). Ruht die Seite, liegen alle bei x=0,
// d. h. Seiten-Koordinaten = Szenen-Koordinaten (x=0 Bildmitte, y 0…1600; hud: 0…stage.W). Beim Blättern werden
// die vier Container gemeinsam zur Seite geschoben. Nur die sichtbare Seite (beim Gleiten: die zwei beteiligten)
// ist im Baum sichtbar; alle anderen sind unsichtbar und bekommen weder Eingaben noch update().
//
// Zeitgeber (this.tween/wait/after/every einer Seite) gehören der SZENE: Sie enden beim Verlassen der Szene,
// laufen aber beim Wegblättern weiter (die Seite ist dann nur unsichtbar). Wer das nicht will, prüft this.aktiv
// oder beendet sie in verlassen() mit .kill().

import {
  Scene, stage, spr, meta, sfx, fx, ui, tween, killTweensOf, cancelAllFingers, clamp, warnOnce, pruefeStimme, PIXI,
} from '../engine/index.js';

const GLEITEN = 1.0;          // Sekunden für einen Seitenwechsel (Ruhe-Regel: die ganze Seite zieht vorbei)
const NACHLAUF = 0.3;         // so lange nach dem Gleiten blättert ein Pfeil-Tipp noch nicht weiter (s)
const PFEIL = 230;            // Größe der Blätter-Knöpfe
const PFEIL_RAND = 60;        // Abstand der Knöpfe vom Bildschirmrand
const PUNKT_R = 11;           // Seiten-Punkte unten
const PUNKT_ABSTAND = 42;
const HG_BREITE = 2840;       // Hintergründe sind höchstens so breit – so weit gleitet eine Seite mindestens
const BODEN = 1300;           // Standlinie, wenn das Bild keinen Punkt 'boden' hat
// Ab so vielen Sekunden ohne Eingabe zeigt die Hand auf den Pfeil: Hände bei 6, 14, 22 s auf die Seite; die
// Stimme wiederholt den Hinweis (25 s nach ihm) nur bis dahin; die vierte Hand bei 30 s zeigt den Weg zur nächsten
// Seite. So zeigen Hand und Stimme nie Verschiedenes nacheinander.
const PFEIL_HINWEIS_AB = 30;

// ---------------------------------------------------------------- freie Hilfen

const HOCHLADEN_JE_BILD = 4e6;  // Bildpunkte, die vor dem Gleiten höchstens in einem Bild hochgeladen werden

/**
 * Bilder einer Seite vorab in die Grafikkarte laden. Sonst geschieht das im ersten Bild des Gleitens (mehrere
 * Millionen Bildpunkte samt Mipmaps auf einmal) und das Gleiten ruckt am Anfang. Verteilt auf wenige Bilder;
 * schon hochgeladene Bilder kosten nichts.
 */
async function ladeHoch(szene, ebenen) {
  const r = stage.app?.renderer;
  if (!r?.texture?.initSource) return;
  const quellen = new Set();
  const sammle = (o) => {
    if (!o || o.destroyed || o.visible === false) return;
    const q = o.texture?.source;
    if (q && !q.destroyed && q.uploadMethodId === 'image' && q.resource && !q._gpuData?.[r.uid]) quellen.add(q);
    for (const k of o.children || []) sammle(k);
  };
  for (const e of ebenen) sammle(e);
  let budget = 0;
  for (const q of quellen) {
    if (!szene.alive) return;
    if (q.destroyed || q._gpuData?.[r.uid]) continue;
    if (budget > HOCHLADEN_JE_BILD) {
      budget = 0;
      await new Promise((weiter) => requestAnimationFrame(() => weiter()));
      if (!szene.alive || q.destroyed) continue;
    }
    try { r.texture.initSource(q); } catch { /* lädt dann eben beim Zeichnen */ }
    budget += (q.pixelWidth || 0) * (q.pixelHeight || 0);
  }
}

/**
 * Benannter Punkt eines Bildes (pts aus pack.json, in Bildpunkten des fertigen Bildes) → Koordinaten im
 * Eltern-Container des Sprites. Berücksichtigt Anker, Größe, Ort und Drehung des Sprites.
 * hgPunkt(sprite, 'feuerwehr/hg_wache', 'garage') oder kurz hgPunkt(sprite, 'garage') (id = sprite.label, das
 * spr() setzt). Fehlt der Punkt: null.
 */
export function hgPunkt(sprite, id, name) {
  if (name === undefined) {
    name = id;
    id = sprite?.label;
  }
  if (!sprite || sprite.destroyed || !id) return null;
  const m = meta(id);
  const p = m.pts?.[name];
  if (!p) return null;
  const t = sprite.texture;
  // pts beziehen sich auf das fertige Bild (m.w × m.h); die Textur kann (Platzhalter, Auflösung) anders groß sein
  const w = m.w || t.width;
  const h = m.h || t.height;
  const lx = (p[0] / w - sprite.anchor.x) * t.width;
  const ly = (p[1] / h - sprite.anchor.y) * t.height;
  sprite.updateLocalTransform();
  const q = sprite.localTransform.apply(new PIXI.Point(lx, ly));
  return { x: q.x, y: q.y };
}

/**
 * Hintergrund einsetzen: mittig (x=0), auf Höhe 1600 gebracht (y 0…1600), ganz hinten.
 * ziel = Szene (dann in szene.bg) oder ein Container. → Sprite
 */
export function setzeHintergrund(ziel, id, opt = {}) {
  const parent = ziel && ziel.bg instanceof PIXI.Container ? ziel.bg : ziel;
  const s = spr(id, { anchor: 0.5, x: opt.x ?? 0, y: stage.H / 2, parent });
  s.scale.set(stage.H / (s.texture.height || stage.H));
  s.zIndex = opt.z ?? -1000;
  return s;
}

// ---------------------------------------------------------------- Seite

export class Seite {
  /** Hintergrundbild der Seite ('pack/name') oder null */
  static hg = null;

  constructor(szene, index) {
    this.szene = szene;
    this.index = index;
    this.aktiv = false;      // true zwischen betreten() und verlassen()
    this.besuche = 0;        // wie oft die Seite schon betreten wurde (beim ersten betreten() ist es 1)
    this.t = 0;              // Sekunden, die die Seite insgesamt sichtbar war (t von update)
    this.gebaut = false;
    const name = `seite${index}`;
    this.hinten = new PIXI.Container({ label: name + ':hinten', sortableChildren: true });
    this.welt = new PIXI.Container({ label: name + ':welt', sortableChildren: true });
    this.vorn = new PIXI.Container({ label: name + ':vorn', sortableChildren: true });
    this.hud = new PIXI.Container({ label: name + ':hud', sortableChildren: true });
    szene.bg.addChild(this.hinten);
    szene.world.addChild(this.welt);
    szene.front.addChild(this.vorn);
    szene.hud.addChild(this.hud);
    this.hgId = this.constructor.hg || null;
    this.hg = this.hgId ? setzeHintergrund(this.hinten, this.hgId) : null;
    this._zeigen(false);
  }

  // --- von der Seite überschrieben ---
  aufbau() {}
  betreten() {}
  verlassen() {}
  update(dt, t) {}
  hinweise() { return []; }
  resize(W, H) {}

  // --- Punkte des Hintergrunds ---

  /** Benannter Punkt des Hintergrundbilds in Seiten-Koordinaten (= Szenen-Koordinaten). Fehlt er: ersatz/null. */
  punkt(name, ersatz = null) {
    const p = this.hg ? hgPunkt(this.hg, this.hgId, name) : null;
    if (!p && ersatz === null) warnOnce(`Seite: Punkt '${name}' fehlt in ${this.hgId}.`);
    return p || ersatz;
  }

  /** Standlinie: y des Punkts 'boden', sonst 1300. */
  get boden() {
    const p = this.hg ? hgPunkt(this.hg, this.hgId, 'boden') : null;
    return p ? p.y : BODEN;
  }

  // --- Zeit (gehört der Szene, siehe oben) ---
  tween(obj, props, dauer, opt) { return this.szene.tween(obj, props, dauer, opt); }
  wait(sek) { return this.szene.wait(sek); }
  after(sek, fn) { return this.szene.after(sek, fn); }
  every(sek, fn) { return this.szene.every(sek, fn); }

  // --- Bequemes, das an der Seite hängt (gleitet beim Blättern mit, ist unsichtbar, wenn die Seite es ist) ---

  /** fx.burst in this.vorn */
  burst(art, x, y, opt = {}) { return fx.burst(art, x, y, { parent: this.vorn, ...opt }); }

  /** fx.emitter in this.vorn (in verlassen() ggf. .stop()) */
  emitter(art, opt = {}) { return fx.emitter(art, { parent: this.vorn, ...opt }); }

  /** ui.button in this.hud */
  knopf(quelle, opt = {}) { return ui.button(quelle, { parent: this.hud, ...opt }); }

  /** ui.tray, dessen Leiste in this.hud liegt (Kopien zum Ziehen entstehen weiter in szene.front) */
  tray(opt = {}) {
    const leiste = ui.tray(this.szene, opt);
    this.hud.addChild(leiste.container);
    return leiste;
  }

  // --- intern ---

  _zeigen(an) {
    for (const c of this._ebenen()) c.visible = an;
    this._sperre(!an);
  }

  _sperre(an) {
    for (const c of this._ebenen()) c.eventMode = an ? 'none' : 'passive';
  }

  _versatz(x) {
    for (const c of this._ebenen()) c.x = x;
  }

  _ebenen() {
    return [this.hinten, this.welt, this.vorn, this.hud];
  }
}

// ---------------------------------------------------------------- SeitenSzene

/**
 * Szene aus mehreren Seiten mit Blätter-Pfeilen links/rechts und kleinen Seiten-Punkten unten.
 * Haken für die Szene selbst (alle freiwillig): vorbereiten(params) – einmal vor der ersten Seite (z. B.
 * ui.albumKnopf(this)); jedesBild(dt, t); seiteGewechselt(neu, alt). Wer enter/update/exit/resize/hints doch
 * überschreibt, ruft super.… auf.
 */
export class SeitenSzene extends Scene {
  static seiten = [];

  async enter(params = {}) {
    this.seitenKlassen = this.constructor.seiten || [];
    this.seiten = new Array(this.seitenKlassen.length).fill(null); // werden beim ersten Besuch gebaut
    this.nr = -1;              // Nummer der sichtbaren Seite
    this.seite = null;         // die sichtbare Seite
    this._lauf = null;         // laufender Seitenwechsel (Promise)
    this._ziel = -1;
    this._ruhtBis = 0;         // bis zu dieser Zeit (this.t) blättert ein Tipp auf den Pfeil nicht weiter
    if (!this.seitenKlassen.length) {
      warnOnce(`${this.id}: static seiten ist leer.`);
      return;
    }
    this._bauePfeile();
    this._bauePunkte();
    this._ordne();
    await this.vorbereiten?.(params);
    await this.zeigeSeite(startSeite(this.id, params), { sofort: true });
  }

  /** Anzahl Seiten */
  get anzahl() {
    return this.seitenKlassen?.length || 0;
  }

  /**
   * Stand für einen Rückweg in diese Szene (der Album-Knopf gibt ihn dem Album mit, dessen Zurück-Knopf startet
   * die Szene damit neu): die sichtbare Seite – beim Gleiten schon die, zu der geblättert wird.
   */
  rückkehr() {
    return Number.isInteger(this.nr) && this.nr >= 0 ? { seite: this.nr } : {};
  }

  /** Gleitet gerade eine Seite? */
  get gleitet() {
    return !!this._lauf;
  }

  /**
   * Zu Seite n blättern (0 = erste). Mit {sofort: true} ohne Gleiten. Während eines Wechsels werden weitere
   * Wünsche ignoriert (es kommt das Promise des laufenden Wechsels zurück). → Promise (wenn die Seite steht)
   */
  zeigeSeite(n, { sofort = false } = {}) {
    if (!this.alive || !this.anzahl) return Promise.resolve(false);
    if (this._lauf) return this._lauf;
    const ziel = clamp(Math.round(Number(n) || 0), 0, this.anzahl - 1);
    if (ziel === this.nr) return Promise.resolve(true);
    this._ziel = ziel;
    this._lauf = this._wechsle(ziel, sofort).finally(() => { this._lauf = null; });
    return this._lauf;
  }

  /** Eine Seite vor (+1) oder zurück (-1). Am Rand passiert nichts (kein Rundlauf). */
  blaettern(richtung) {
    if (this._lauf) return this._lauf;
    const n = this.nr + (richtung > 0 ? 1 : -1);
    if (n < 0 || n >= this.anzahl) return Promise.resolve(false);
    return this.zeigeSeite(n);
  }

  // --- Ablauf ---

  update(dt, t) {
    for (const s of this.seiten || []) {
      if (!s || !s.gebaut || !s.welt.visible) continue;
      s.t += dt;
      s.update(dt, s.t);
    }
    this.jedesBild?.(dt, t);
  }

  hints() {
    const s = this.seite;
    if (!s || this._lauf) return [];
    let liste = [];
    try {
      liste = s.hinweise() || [];
    } catch (e) {
      console.error('[sigo] Fehler in hinweise():', e);
    }
    // Lange nichts passiert (oder die Seite hat nichts zu zeigen): die Hand zeigt auf den Weg zur nächsten Seite
    const pfeil = this._wegPfeil();
    if (pfeil && (!liste.length || this.idle >= PFEIL_HINWEIS_AB)) return [pfeil];
    return liste;
  }

  // Pfeil zur nächsten Seite (am Ende: zur vorigen), sonst null
  _wegPfeil() {
    return this.nr < this.anzahl - 1 ? this.pfeilRechts : this.nr > 0 ? this.pfeilLinks : null;
  }

  // Hinweise der sichtbaren Seite selbst (ohne Pfeil)
  _seitenHinweise() {
    const s = this.seite;
    if (!s || this._lauf) return [];
    try { return (s.hinweise() || []).filter(Boolean); } catch { return []; }
  }

  /** Wie viele Zeige-Hände bis zur nächsten Berührung: eine mehr, wenn sie am Ende auf den Pfeil zeigen kann. */
  get hinweisHaende() {
    return this._wegPfeil() && this._seitenHinweise().length ? 4 : 3;
  }

  /**
   * Darf die Stimme den Hinweis wiederholen? Nur, wenn die Seite selbst etwas zu zeigen hat und die Hand noch nicht
   * auf den Blätter-Pfeil zeigt (sonst sagte die Stimme etwas anderes, als die Hand zeigt).
   */
  hinweisWiederholbar() {
    if (this._lauf) return false;
    if (this._wegPfeil() && this.idle >= PFEIL_HINWEIS_AB) return false;
    return this._seitenHinweise().length > 0;
  }

  resize(W, H) {
    this._ordne();
    for (const s of this.seiten || []) {
      if (!s?.gebaut) continue;
      try { s.resize(W, H); } catch (e) { console.error('[sigo] Fehler in Seite.resize:', e); }
    }
  }

  exit() {
    const s = this.seite;
    if (s && s.aktiv) {
      s.aktiv = false;
      try { s.verlassen(); } catch (e) { console.error('[sigo] Fehler in verlassen():', e); }
    }
  }

  // --- intern ---

  async _hole(n) {
    let s = this.seiten[n];
    if (!s) {
      s = new this.seitenKlassen[n](this, n);
      this.seiten[n] = s;
    }
    if (!s.gebaut) {
      s.gebaut = true;
      await s.aufbau();
    }
    return s;
  }

  async _wechsle(n, sofort) {
    const alt = this.seite;
    const altNr = this.nr;
    const neu = await this._hole(n);
    if (!this.alive) return false;
    const richtung = n > altNr ? 1 : -1;

    // Was gerade gezogen oder gezeigt wird, endet sauber; während des Gleitens keine Eingabe auf den Seiten
    cancelAllFingers();
    ui.handWeg(0.2);
    if (alt) {
      alt.aktiv = false;
      alt._sperre(true);
      try { alt.verlassen(); } catch (e) { console.error('[sigo] Fehler in verlassen():', e); }
    }
    neu._zeigen(true);
    neu._sperre(true);
    this.nr = n;
    this.seite = neu;
    this._zeigeStand(!sofort);
    // Ein Satz der alten Seite (Auftrag, Lob) klingt nicht auf der neuen weiter: er blendet weich aus
    if (alt) pruefeStimme();

    if (alt && !sofort) {
      const weite = Math.max(stage.W, HG_BREITE);
      neu._versatz(richtung * weite);   // erst außer Sicht schieben, dann hochladen
      await ladeHoch(this, neu._ebenen());
      if (!this.alive) return false;
      sfx('common/wusch', { vol: 0.35 });
      const p = { k: 0 };
      await this.tween(p, { k: 1 }, GLEITEN, {
        ease: 'sineInOut',
        onUpdate: () => {
          alt._versatz(-richtung * weite * p.k);
          neu._versatz(richtung * weite * (1 - p.k));
        },
      });
      // Endet die Szene im selben Bild wie das Gleiten (zweiter Finger auf Karte/Album), nichts mehr anfassen
      if (!this.alive) return false;
      this._ruhtBis = this.t + NACHLAUF;
    }
    if (alt) {
      alt._versatz(0);
      alt._zeigen(false);
    }
    neu._versatz(0);
    neu._sperre(false);
    neu.aktiv = true;
    neu.besuche++;
    try { neu.betreten(); } catch (e) { console.error('[sigo] Fehler in betreten():', e); }
    try { this.seiteGewechselt?.(neu, alt); } catch (e) { console.error('[sigo] Fehler in seiteGewechselt():', e); }
    return true;
  }

  _bauePfeile() {
    if (this.anzahl < 2) return;
    const knopf = (richtung) => {
      const k = ui.button(richtung < 0 ? 'common/icon_pfeil_links' : 'common/icon_pfeil_rechts', {
        size: PFEIL,
        parent: this.hud,
        z: 8800,
        sound: null, // das Blättern hat seinen eigenen Ton (wusch)
        // Gleich nach dem Gleiten (Dauertippen auf den Pfeil) noch nicht die nächste Fahrt – der Pfeil staucht trotzdem
        onTap: () => { if (this.t >= this._ruhtBis) this.blaettern(richtung); },
      });
      k.label = richtung < 0 ? 'pfeilLinks' : 'pfeilRechts';
      k._an = true;
      return k;
    };
    this.pfeilLinks = knopf(-1);
    this.pfeilRechts = knopf(1);
  }

  _bauePunkte() {
    this.punkte = new PIXI.Container({ label: 'seitenPunkte' });
    this.punkte.zIndex = 8700;
    this.punkte.eventMode = 'none';
    if (this.anzahl < 2) return;
    for (let i = 0; i < this.anzahl; i++) {
      const g = new PIXI.Graphics()
        .circle(0, 2, PUNKT_R + 3).fill({ color: 0x5a4630, alpha: 0.18 })
        .circle(0, 0, PUNKT_R).fill(0xfff6e6).stroke({ width: 4, color: 0x9a7a55 });
      g.x = (i - (this.anzahl - 1) / 2) * PUNKT_ABSTAND;
      g.alpha = 0.55;
      this.punkte.addChild(g);
    }
    this.hud.addChild(this.punkte);
  }

  _ordne() {
    const y = stage.H / 2;
    this.pfeilLinks?.position.set(PFEIL_RAND + PFEIL / 2, y);
    this.pfeilRechts?.position.set(stage.W - PFEIL_RAND - PFEIL / 2, y);
    this.punkte?.position.set(stage.W / 2, stage.H - 38);
  }

  // Pfeile und Punkte auf den neuen Stand bringen (weich, ruhig)
  _zeigeStand(weich) {
    const d = weich ? 0.45 : 0;
    this._pfeil(this.pfeilLinks, this.nr > 0, d);
    this._pfeil(this.pfeilRechts, this.nr < this.anzahl - 1, d);
    this.punkte?.children.forEach((g, i) => {
      const hier = i === this.nr;
      killTweensOf(g, ['alpha', 'scale']);
      if (d) this.tween(g, { alpha: hier ? 1 : 0.55, scale: hier ? 1.4 : 1 }, d, { ease: 'sineInOut' });
      else { g.alpha = hier ? 1 : 0.55; g.scale.set(hier ? 1.4 : 1); }
    });
  }

  _pfeil(k, an, d) {
    if (!k || k.destroyed) return;
    k._an = an;
    killTweensOf(k, ['alpha']);
    k.eventMode = an ? 'static' : 'none';
    if (an) k.visible = true;
    if (!d) {
      k.alpha = an ? 1 : 0;
      k.visible = an;
      return;
    }
    tween(k, { alpha: an ? 1 : 0 }, d, { ease: 'sineInOut' }).then(() => {
      if (!k.destroyed && !k._an) k.visible = false;
    });
  }
}

// Start-Seite: params.seite, sonst – wenn die Szene direkt über die Adresse gestartet wurde – ?seite=n, sonst 0
function startSeite(id, params) {
  if (params && params.seite !== undefined && params.seite !== null) return Number(params.seite) || 0;
  try {
    const suche = new URLSearchParams(location.search);
    if (suche.get('szene') === id && suche.has('seite')) return Number(suche.get('seite')) || 0;
  } catch { /* ohne Adresse: erste Seite */ }
  return 0;
}
