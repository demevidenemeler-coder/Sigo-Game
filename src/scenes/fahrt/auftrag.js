// Lieferfahrt – der kleine Ablauf der Zugfahrt über mehrere Stationen, dazu Wasserturm, Signal, Regenschauer,
// Regenbogen und das Sternen-Brett über dem Fahr-Hebel.
//
// Eine Runde (index.js plant sie): Ladeplatz → (Station) → Aufgabe → (Station) → Ziel → (Station)
//   1. Ladeplatz   Am Güterschuppen wartet jemand mit einer Ladung; seine Denkblase zeigt, für wen sie ist.
//                  Ziehen (oder antippen) → die Ladung hüpft in einen Wagen.
//   2. Abfahren    Hebel → der Zug fährt los, der Absender winkt.
//   3. Aufgabe     Wasserturm (Finger halten → die Lok trinkt sich satt), Signal (antippen → grün; vorher watscheln
//                  ein paar Tiere über das Gleis) oder ein Tier auf dem Gleis (pfeifen – stationen.js).
//   4. Ziel        Ein Haus; Tür antippen → der Empfänger kommt heraus und denkt an seine Ladung.
//   5. Abgeben     Ladung aus dem Wagen zu ihm ziehen (oder antippen) → er freut sich.
//   6. Dank        Ein Stern fliegt auf das Sternen-Brett über dem Hebel; fünf Sterne → ein Regenbogen.
// Nichts kann schiefgehen: Der Hebel erledigt an jeder Station den offenen Schritt freundlich von selbst, eine
// Ladung, die daneben landet, gleitet zurück.

import {
  spr, meta, localPoint, sfx, sfxSchleife, note, voice, fx, tap, drag, hold, ambient, store, Actor, rand, pick, clamp, PIXI,
} from '../../engine/index.js';
import { WAGEN_MIT_LADUNG } from '../../gemeinsam/zug.js';
import { belohne, stickerFuerOrt } from '../../gemeinsam/sticker.js';
import { Ding, tippbar, flaeche, ruhig } from './hilfen.js';
import { figur, gruss, MENSCHEN } from './stationen.js';
import { GLEIS_Y, LOK_X, HINTEN_Y, VORNE_Y } from './konst.js';
import { FreundeLeine, merkeFreund } from './halte.js';

const { Container, Graphics, Rectangle } = PIXI;

// ================================================================ Lieferungen

// von = Absender, an = Empfänger (je der erste, der gerade nicht schon im Zug sitzt oder anderswo zu sehen ist –
// so kommt jede Lieferung, auch wenn z. B. die Kuh mitfährt), haus = wo der Empfänger wohnt (scheune oder ein Haus
// mit zufälliger Dachfarbe)
export const LIEFERUNGEN = [
  { id: 'milch', von: ['kuh', 'oma', 'papa'], ladung: 'ladung_milchkanne', an: ['katze', 'igel', 'hase'] },
  { id: 'geschenk', von: ['oma', 'papa', 'baer'], ladung: 'ladung_geschenk', an: ['kind_m', 'kind_j', 'maus'] },
  { id: 'heu', von: ['pferd', 'kuh', 'schwein'], ladung: 'ladung_heuballen', an: ['schaf', 'pferd', 'kuh'], haus: 'scheune' },
  { id: 'ball', von: ['papa', 'kind_m', 'oma'], ladung: 'ladung_ball', an: ['hund', 'affe', 'katze'] },
  { id: 'teddy', von: ['baer', 'oma', 'papa'], ladung: 'ladung_teddy', an: ['kind_j', 'kind_m', 'affe'] },
  { id: 'aepfel', von: ['schwein', 'igel', 'kuh'], ladung: 'ladung_apfelkorb', an: ['pferd', 'schaf', 'schwein'], haus: 'scheune' },
  { id: 'koffer', von: ['elefant', 'giraffe', 'affe'], ladung: 'ladung_koffer', an: ['oma', 'papa', 'kind_m'] },
  { id: 'bausteine', von: ['kind_j', 'kind_m', 'papa'], ladung: 'ladung_bausteine', an: ['maus', 'affe', 'hase'] },
  // Runde 3: zwei neue Lieferungen (neue Empfänger für die Freunde-Leine)
  { id: 'fass', von: ['baer', 'schwein', 'oma'], ladung: 'ladung_fass', an: ['fuchs', 'eichhoernchen', 'igel'] },
  { id: 'kiste', von: ['papa', 'elefant', 'pferd'], ladung: 'ladung_kiste', an: ['giraffe', 'loewe', 'oma'] },
];

const HAUS_FARBEN = ['rot', 'blau', 'gelb'];

/** Bild einer Figur (für Denkblasen) */
export const figurBild = (id) => (MENSCHEN.has(id) ? 'zug/' + id + '_idle' : 'tiere/' + id + '_idle');

/**
 * Wer gerade schon zu sehen ist oder bald zu sehen sein wird: Gäste im Zug (auch die, die gerade hineinhüpfen),
 * Wartende an den Bahnhöfen und Absender/Empfänger der Lieferungen, die an der Strecke stehen oder geplant sind.
 * (index.js nutzt das auch für den nächsten Wartenden am Bahnsteig.)
 */
export function figurenUnterwegs(s) {
  const da = new Set();
  for (const w of s.zug.wagen) if (w.gastId) da.add(w.gastId);
  if (s.reserviert) for (const id of s.reserviert.values()) da.add(id);
  const lief = (l) => {
    if (!l) return;
    da.add(l.von);
    da.add(l.an);
  };
  for (const d of s.dinge || []) {
    if (d.fahrgaeste) for (const f of d.fahrgaeste) if (f.id) da.add(f.id);
    lief(d.lief);
  }
  for (const e of s.folge || []) if (typeof e === 'object') lief(e.lief);
  return da;
}

/**
 * Neue Lieferung aus einem gemischten Beutel (alle acht kommen dran, bevor sich eine wiederholt; über Besuche
 * hinweg gespeichert; nie dieselbe zweimal hintereinander). Absender und Empfänger: wer gerade frei ist.
 */
export function neueLieferung(s) {
  const letzte = s.letzteLieferung ?? store.get('fahrt.lieferung', null);
  const ids = LIEFERUNGEN.map((l) => l.id);
  let beutel = store.get('fahrt.lieferBeutel', []);
  beutel = Array.isArray(beutel) ? beutel.filter((id) => ids.includes(id)) : [];
  if (!beutel.length) {
    beutel = [...ids].sort(() => Math.random() - 0.5);
    if (beutel[0] === letzte) beutel.push(beutel.shift());
  }
  let id = beutel.shift();
  if (id === letzte && beutel.length) {   // (nur nach einem Fehler im Speicher möglich)
    beutel.push(id);
    id = beutel.shift();
  }
  store.set('fahrt.lieferBeutel', beutel);
  const v = LIEFERUNGEN.find((l) => l.id === id);
  s.letzteLieferung = v.id;
  store.set('fahrt.lieferung', v.id);
  const besetzt = figurenUnterwegs(s);
  // Ist keiner ganz frei, dann wenigstens keiner, der im Zug sitzt (der bliebe die ganze Runde doppelt zu sehen)
  const imZug = new Set(s.zug.wagen.map((w) => w.gastId).filter(Boolean));
  const waehle = (liste) => liste.find((f) => !besetzt.has(f)) ?? liste.find((f) => !imZug.has(f)) ?? liste[0];
  const von = waehle(v.von);
  const an = waehle(v.an.filter((f) => f !== von));
  let haus = v.haus;
  if (!haus) {
    const farben = HAUS_FARBEN.filter((f) => f !== s.letzteHausFarbe);
    haus = pick(farben);
    s.letzteHausFarbe = haus;
  }
  return {
    id: v.id, von, an, ladung: v.ladung, haus, geladen: false, geliefert: false, art: null, w: null, f: null, sprite: null,
  };
}

// ---------------------------------------------------------------- Hilfen

/** Ein Ding weich im Bogen nach (x, y) seines Eltern-Containers fliegen lassen (Größe gleitet mit). → thenable */
export function bogen(s, obj, x, y, { skala, dauer = 1, hoehe = 200, drehen = 0 } = {}) {
  const x0 = obj.x;
  const y0 = obj.y;
  const s0 = Math.abs(obj.scale.y);
  const s1 = skala ?? s0;
  const p = { t: 0 };
  return s.tween(p, { t: 1 }, dauer, {
    ease: 'sineInOut',
    onUpdate: () => {
      if (obj.destroyed) return;
      const k = p.t;
      obj.x = x0 + (x - x0) * k;
      obj.y = y0 + (y - y0) * k - hoehe * 4 * k * (1 - k);
      obj.scale.set(s0 + (s1 - s0) * k);
      obj.rotation = drehen * Math.sin(k * Math.PI);
    },
  });
}

/** Ding in einen anderen Container hängen, ohne dass es springt (Ort und Größe bleiben). */
export function umhaengen(obj, neu) {
  const p = neu.toLocal(obj.getGlobalPosition());
  const k = Math.abs(obj.worldTransform.a) / Math.max(1e-6, Math.abs(neu.worldTransform.a));
  neu.addChild(obj);
  obj.position.set(p.x, p.y);
  obj.scale.set(k);
}

// Platz der Lieferung im Wagen. Wie beim Zug-Baustein, aber im offenen Wagen etwas größer und höher: Sie schaut
// fast ganz über die Wand (eine gewöhnliche Ladung nur knapp zur Hälfte) – man sieht, dass sie mitfährt.
// Dazu der Ort, an dem sie hineinplumpst.
const LIEFER_GROESSER = 1.25;
const LIEFER_UNTER_RAND = 0.14;   // so viel der Lieferung verdeckt die Wagenwand
function ladungStart(w, id) {
  const p = w.platz;
  const m = meta('zug/' + id);
  const flach = p.art === 'flach';
  const breite = p.breite * (flach ? 0.55 : 0.42);
  const sk = Math.min(breite / m.w, (breite * 1.1) / m.h) * (flach ? 1 : LIEFER_GROESSER);
  const h = m.h * sk;
  const fuss = flach ? p.boden : Math.min(p.rand + h * LIEFER_UNTER_RAND, p.boden);
  const beide = w.gast && p.art === 'sitz';
  return { x: beide ? p.mitte + p.breite * 0.27 : p.mitte, y: fuss - 280, sk, fuss };
}

/**
 * Wohin die Ladung kommt: ein freier Lade-Wagen (am liebsten der, auf den sie gezogen wurde, sonst ein Flachwagen
 * ohne Gast – dort ist sie ganz zu sehen –, sonst einer ohne Gast – neben einem Gast verschwindet sie fast hinter
 * ihm), sonst oben auf den letzten Wagen, sonst auf die Lok.
 */
function waehleWagen(zug, wunsch = null) {
  const frei = zug.wagen.filter((w) => WAGEN_MIT_LADUNG.includes(w.typ) && w.platz && !w.ladung);
  const ohneGast = frei.filter((w) => !w.gast);
  const wahl = (wunsch && ohneGast.includes(wunsch) ? wunsch : null)
    || ohneGast.find((w) => w.platz.art === 'flach') || ohneGast[0]
    || (wunsch && frei.includes(wunsch) ? wunsch : null) || frei[0];
  if (wahl) return { art: 'ladung', w: wahl, f: wahl.fahrzeug };
  const w = zug.wagen[zug.wagen.length - 1];
  if (w) return { art: 'dach', w, f: w.fahrzeug };
  return { art: 'lok', w: null, f: zug.lok };
}

/** Die Ladung (Sprite irgendwo in der Welt) fliegt in den Zug. */
function ladeIn(s, lief, ware, wunsch = null) {
  if (lief.geladen || !ware || ware.destroyed) return;
  lief.geladen = true;
  const zug = s.zug;
  const wahl = waehleWagen(zug, wunsch);
  const f = wahl.f;
  let ziel;
  let sk;
  let st = null;
  if (wahl.art === 'ladung') {
    st = ladungStart(wahl.w, lief.ladung);
    ziel = { x: st.x, y: st.y };
    sk = st.sk;
  } else {
    const m = meta(f.koerperId);
    const lm = meta('zug/' + lief.ladung);
    sk = (m.w * 0.26) / lm.w;
    ziel = { x: ((wahl.art === 'lok' ? 0.3 : 0.5) - m.ax) * m.w, y: -m.ay * m.h + 14 };
  }
  umhaengen(ware, s.ebFlug);
  ware.eventMode = 'none';
  ware.zIndex = 20;
  const zg = s.ebFlug.toLocal(f.innen.toGlobal(ziel));
  const skZiel = sk * Math.abs(f.innen.worldTransform.a) / Math.max(1e-6, Math.abs(s.ebFlug.worldTransform.a));
  const weite = Math.hypot(zg.x - ware.x, zg.y - ware.y);
  sfx('common/hupf', { vol: 0.6 });
  bogen(s, ware, zg.x, zg.y, { skala: skZiel, dauer: clamp(0.7 + weite / 900, 0.9, 1.7), hoehe: 180, drehen: 0.15 })
    .then((ok) => {
      if (!ok || ware.destroyed || zug.destroyed) return;
      lief.art = wahl.art;
      lief.w = wahl.w;
      lief.f = f;
      if (wahl.art === 'ladung') {
        zug.setzeLadung(wahl.w.index, lief.ladung);
        // größer und höher als eine gewöhnliche Ladung (der neue Fall ersetzt den des Bausteins, darum Klack hier)
        const l = wahl.w.ladung;
        if (l && wahl.w.ladungId === lief.ladung) {
          l.scale.set(st.sk);
          l._fuss = st.fuss;
          l.y = st.fuss - 280;
          s.tween(l, { y: st.fuss }, 0.38, { ease: 'quadIn', overwrite: true }).then((ok) => {
            if (!ok || l.destroyed) return;
            fx.pop(l, 0.08);
            sfx('common/klack', { vol: 0.8 });
          });
        }
      } else {
        const e = spr('zug/' + lief.ladung, { x: ziel.x, y: ziel.y, scale: sk, parent: f.innen });
        e.zIndex = 3;
        lief.sprite = e;
        sfx('common/klack', { vol: 0.8 });
        fx.pop(e, 0.08);
      }
      s.tween(ware, { alpha: 0 }, 0.18, { ease: 'sineInOut' }).then(() => { if (!ware.destroyed) ware.destroy(); });
      s.after(0.5, () => { if (!zug.destroyed) zug.gaesteJubeln(); });
    });
}

/** Das Ding der Lieferung, wie es gerade im Zug liegt (oder null). */
function wareImZug(lief) {
  if (!lief.geladen || lief.geliefert) return null;
  if (lief.art === 'ladung') {
    const w = lief.w;
    return w && w.ladungId === lief.ladung && w.ladung && !w.ladung.destroyed ? w.ladung : null;
  }
  return lief.sprite && !lief.sprite.destroyed ? lief.sprite : null;
}

/** Freude einer Figur (Tiere mit Laut und Herzen, Menschen winken mit Herzen). */
export function freude(s, a) {
  if (!a || a.destroyed) return;
  if (a.mensch) {
    gruss(s, a);
    a.hop(60);
    const b = s.inWelt(a.getBounds());
    fx.burst('herzen', b.x + b.w / 2, b.y + 20, { count: 3, parent: s.front });
  } else {
    a.cheer({ parent: s.front });
  }
}

// ================================================================ Ladeplatz (Güterschuppen)

const LADEN_X = 600;   // dort steht die Mitte des Schuppens beim Halt (Bildschirm-x)

export class Ladeplatz extends Ding {
  constructor(s, linkeKante, lief) {
    super(s, 0);
    this.art = 'laden';
    this.lief = lief;
    const id = 'fahrt/gueterschuppen';
    const skala = 0.6;
    const y = HINTEN_Y - 8;
    const c = this.teil(s.ebHinten, y);
    this.c = c;
    this.flug = this.teil(s.ebFlug, 5);
    this.schuppen = spr(id, { x: 0, y, scale: skala, parent: c });
    tippbar(this.schuppen, () => {
      fx.wobble(this.schuppen, 0.015);
      if (ruhig(this.schuppen, 0.8)) sfx('common/tuer', { vol: 0.5 });
    });
    const r = localPoint(id, 'rampe');
    this.rampeY = y + (r ? r.y : -120) * skala;
    // Absender links auf der Rampe, die Ladung rechts daneben
    this.sender = figur(lief.von, { x: -125, y: this.rampeY, parent: c });
    this.sender.onTap(() => this.senderTipp(), { pad: 70 });
    this.ware = spr('zug/' + lief.ladung, { x: 115, y: this.rampeY + 2, scale: 0.36, parent: c });
    this.ziehen = drag(this.ware, {
      hitArea: flaeche(this.ware, { min: 250 }),
      targets: () => this.zugZiele(),
      onStart: () => this.greifen(),
      onDrop: (z, ctx) => this.ablegen(z, ctx),
    });
    const m = meta(id);
    this.links = -(m.w * m.ax) * skala - 20;
    this.rechts = (m.w * (1 - m.ax)) * skala + 20;
    // Freunde-Leine vorn links unter dem Zug (wächst über alle Besuche)
    this.leine = new FreundeLeine(s, this, -1180);
    this.vorneLinks = this.leine.links;   // nur die vordere Reihe bleibt dort frei (hinten dürfen Bäume stehen)
    this.vorneBelegt = true;
    this.wx = linkeKante - this.links;
    this.da = false;
    this.erledigt = false;
    this.blasenZeit = 5;
  }

  zugZiele() {
    const zug = this.s.zug;
    return [
      { obj: zug.lok.koerper, radius: 360 },
      ...zug.wagen.map((w) => ({ obj: w.fahrzeug.koerper, radius: 360, wagen: w })),
    ];
  }

  // Beim Greifen über den Zug heben (gleiche Lage, nur eine höhere Ebene)
  greifen() {
    if (this.ware.parent === this.c) umhaengen(this.ware, this.flug);
  }

  ablegen(ziel, ctx) {
    if (this.lief.geladen) return undefined;
    const getippt = Math.hypot(ctx.x - ctx.startX, ctx.y - ctx.startY) < 30;
    if (ziel || getippt) {
      ctx.erledigt = true;   // nicht zurückgleiten: sie hüpft in den Zug
      this.einladen(ziel?.wagen);
      return undefined;
    }
    sfx('common/hupf', { vol: 0.4 });
    return false;            // daneben: freundlich zurück auf die Rampe
  }

  einladen(wunsch = null) {
    if (this.lief.geladen) return;
    this.ziehen.off();
    ladeIn(this.s, this.lief, this.ware, wunsch);
    this.s.after(1.1, () => {
      if (this.tot) return;
      gruss(this.s, this.sender);
      this.sender.hop(50);
    });
  }

  senderTipp() {
    const a = this.sender;
    gruss(this.s, a);
    a.hop(50);
    if (!this.lief.geladen) a.bubble(figurBild(this.lief.an), 3.5);
  }

  haltBei() {
    return this.erledigt ? null : this.wx - LADEN_X;
  }

  angekommen() {
    const s = this.s;
    this.da = true;
    sfx('common/gong', { vol: 0.4 });
    gruss(s, this.sender);
    this.sender.bubble(figurBild(this.lief.an), 4);
    this.blasenZeit = 8;
    const passt = () => !this.tot && this.da && !this.lief.geladen;
    s.after(1.5, () => { if (passt()) voice('fahrt_laden', { nurWenn: passt }); });
  }

  /** Hebel: Ist die Ladung noch nicht im Zug, hüpft sie selbst hinein – dann geht es los. */
  weiter() {
    if (this.erledigt) return true;
    if (!this.lief.geladen) {
      if (this.autoLaeuft) return false;
      this.autoLaeuft = true;
      this.einladen();
      this.s.after(1.9, () => {
        if (this.tot) return;
        this.erledigt = true;
        this.da = false;
        this.s.losfahren();
      });
      return false;
    }
    this.erledigt = true;
    this.da = false;
    this.s.after(0.5, () => { if (!this.tot) gruss(this.s, this.sender, { laut: false }); });
    return true;
  }

  update(dt, sx) {
    this.leine.update(dt, sx);
    // Wartet das Kind, denkt der Absender noch einmal an den Empfänger, und die Ladung lädt sanft ein
    if (!this.da || this.lief.geladen) return;
    this.blasenZeit -= dt;
    if (this.blasenZeit <= 0) {
      this.blasenZeit = 9;
      this.sender.bubble(figurBild(this.lief.an), 3.5);
    }
  }

  hinweise() {
    return this.da && !this.lief.geladen && !this.ware.destroyed ? [this.ware] : [];
  }
}

// ================================================================ Ziel (Haus des Empfängers)

const ZIEL_X = 560;   // dort steht die Tür beim Halt (Bildschirm-x)

export class Ziel extends Ding {
  constructor(s, linkeKante, lief) {
    super(s, 0);
    this.art = 'ziel';
    this.lief = lief;
    const scheune = lief.haus === 'scheune';
    const id = scheune ? 'fahrt/scheune' : 'fahrt/haus_' + lief.haus;
    const skala = scheune ? 0.44 : 0.48;
    const y = HINTEN_Y - 22;
    this.y = y;
    const c = this.teil(s.ebHinten, y);
    this.c = c;
    this.flug = this.teil(s.ebFlug, 5);
    this.haus = spr(id, { x: 0, y, scale: skala, parent: c });
    tippbar(this.haus, () => {
      fx.wobble(this.haus, 0.02);
      if (ruhig(this.haus, 0.8)) sfx('common/tuer', { vol: 0.45 });
    });
    const t = localPoint(id, scheune ? 'tor' : 'tuer');
    this.tuer = { x: (t ? t.x : 0) * skala, y: y + (t ? t.y : -150) * skala };
    // Tür: eigene große Tippfläche (zum Anklopfen)
    this.tuerF = new Container({ label: 'tuer' });
    this.tuerF.position.set(this.tuer.x, this.tuer.y);
    // fast unsichtbare Fläche: gibt der Tür Grenzen (dorthin zeigt die Zeige-Hand)
    this.tuerF.addChild(new Graphics().roundRect(-70, -80, 140, 160, 40).fill({ color: 0xffffff, alpha: 0.001 }));
    c.addChild(this.tuerF);
    tap(this.tuerF, () => this.klopfen(), { sound: null, squash: false, hitArea: new Rectangle(-130, -140, 260, 260) });
    this.standX = this.tuer.x + 10;
    this.standY = y + 14;
    const m = meta(id);
    this.links = -(m.w * m.ax) * skala - 20;
    this.rechts = (m.w * (1 - m.ax)) * skala + 60;
    this.wx = linkeKante - this.links;
    this.da = false;
    this.draussen = false;
    this.erledigt = false;
    this.empf = null;
    this.ware = null;
    this.winkZeit = 4;
  }

  haltBei() {
    return this.erledigt ? null : this.wx + this.tuer.x - ZIEL_X;
  }

  /** Tür antippen: Der Empfänger kommt heraus und denkt an seine Ladung. */
  klopfen() {
    const s = this.s;
    fx.wobble(this.haus, 0.02);
    if (this.draussen) {
      if (this.empf && !this.empf.destroyed && ruhig(this.tuerF, 0.8)) gruss(s, this.empf);
      return;
    }
    this.draussen = true;
    sfx('common/tuer', { vol: 0.6 });
    s.after(0.3, () => sfx('common/klingel', { vol: 0.35 }));
    s.after(0.6, () => {
      if (this.tot) return;
      const a = figur(this.lief.an, { x: this.tuer.x, y: this.standY - 6, parent: this.c });
      a.zIndex = 5;
      a.alpha = 0;
      this.empf = a;
      s.tween(a, { alpha: 1 }, 0.4, { ease: 'sineInOut' });
      a.hopTo(this.standX, this.standY, { hoehe: 50, dauer: 0.5, staub: false }).then(() => {
        if (this.tot || a.destroyed) return;
        gruss(s, a);
        if (wareImZug(this.lief) || (this.ware && !this.lief.geliefert)) {
          a.bubble('zug/' + this.lief.ladung, 4.5, { seite: 'links' });
          const passt = () => !this.tot && this.da && !this.lief.geliefert && !!this.ware;
          s.after(1.2, () => { if (passt()) voice('fahrt_abgeben', { nurWenn: passt }); });
        }
      });
      a.onTap(() => this.empfTipp(), { pad: 70 });
    });
  }

  empfTipp() {
    const a = this.empf;
    if (!a || a.destroyed) return;
    if (this.lief.geliefert) {
      freude(this.s, a);
      return;
    }
    gruss(this.s, a);
    if (this.ware) a.bubble('zug/' + this.lief.ladung, 3.5, { seite: 'links' });
  }

  angekommen() {
    const s = this.s;
    this.da = true;
    sfx('common/gong', { vol: 0.35 });
    this.holeWare();
    const passt = () => !this.tot && this.da && !this.draussen;
    s.after(1.5, () => { if (passt()) voice('fahrt_klopfen', { nurWenn: passt }); });
  }

  /** Die Ladung im Zug wird greifbar: ein Stellvertreter genau an ihrer Stelle, über dem Zug. */
  holeWare() {
    const alt = wareImZug(this.lief);
    if (!alt || this.ware) return;
    const p = this.flug.toLocal(alt.getGlobalPosition());
    const k = Math.abs(alt.worldTransform.a) / Math.max(1e-6, Math.abs(this.flug.worldTransform.a));
    const ware = spr('zug/' + this.lief.ladung, { x: p.x, y: p.y, scale: k, parent: this.flug });
    alt.visible = false;
    this.ware = ware;
    this.ziehen = drag(ware, {
      hitArea: flaeche(ware, { min: 250 }),
      targets: () => (this.empf && !this.empf.destroyed ? [{ obj: this.empf, radius: 360 }] : []),
      onDrop: (z, ctx) => this.ablegen(z, ctx),
    });
  }

  ablegen(ziel, ctx) {
    if (this.lief.geliefert) return undefined;
    const getippt = Math.hypot(ctx.x - ctx.startX, ctx.y - ctx.startY) < 30;
    if (!this.draussen) {
      // Noch niemand da: erst anklopfen (geschieht von selbst), die Ladung wartet im Wagen
      this.klopfen();
      return false;
    }
    if (ziel || getippt) {
      ctx.erledigt = true;
      this.abgeben();
      return undefined;
    }
    sfx('common/hupf', { vol: 0.4 });
    return false;
  }

  abgeben() {
    const s = this.s;
    const lief = this.lief;
    const ware = this.ware;
    if (lief.geliefert || this.abgabeWartet || !ware || ware.destroyed) return;
    if (!this.empf || this.empf.destroyed) {
      // Der Empfänger kommt gerade erst heraus (oder es hat noch niemand angeklopft): kurz warten, dann fliegt die
      // Ladung zu ihm. Bis dahin bleibt sie, wo sie ist, und lässt sich nicht greifen.
      if (!this.draussen) this.klopfen();
      this.abgabeWartet = true;
      ware.eventMode = 'none';
      s.after(0.3, () => {
        this.abgabeWartet = false;
        if (this.tot || ware.destroyed) return;
        ware.eventMode = 'static';
        this.abgeben();
      });
      return;
    }
    lief.geliefert = true;
    this.ziehen?.off();
    ware.eventMode = 'none';
    // im Zug wird der Platz frei (die versteckte Ladung verschwindet still)
    if (lief.art === 'ladung' && lief.w && lief.w.ladungId === lief.ladung) s.zug.setzeLadung(lief.w.index, null);
    else if (lief.sprite && !lief.sprite.destroyed) lief.sprite.destroy();
    sfx('common/hupf', { vol: 0.6 });
    const zx = this.standX + 150;
    const zy = this.standY + 8;
    const weite = Math.hypot(zx - ware.x, zy - ware.y);
    bogen(s, ware, zx, zy, { skala: 0.36, dauer: clamp(0.7 + weite / 900, 0.9, 1.6), hoehe: 170, drehen: -0.12 })
      .then((ok) => {
        if (!ok || this.tot || ware.destroyed) return;
        // bleibt beim Haus stehen (hinter dem Zug, wenn er weiterfährt)
        this.c.addChild(ware);
        ware.zIndex = 6;
        ware.eventMode = 'static';
        tippbar(ware, () => {
          fx.wobble(ware, 0.08);
          if (ruhig(ware, 0.6)) sfx('common/plopp', { vol: 0.5 });
        });
        sfx('common/landen', { vol: 0.7 });
        fx.pop(ware, 0.1);
        const a = this.empf;
        freude(s, a);
        merkeFreund(lief.an);   // kommt beim nächsten Ladeplatz auf die Freunde-Leine
        // statt der Ladung denkt er jetzt an ein Herz (ersetzt die alte Denkblase)
        s.after(0.6, () => { if (!a.destroyed) a.bubble('common/p_herz', 2.2, { seite: 'links' }); });
        s.after(0.5, () => { if (!s.zug.destroyed) s.zug.gaesteJubeln(); });
        // Dank: ein Stern fliegt auf das Sternen-Brett, danach ein Sticker
        s.after(1.0, () => {
          if (this.tot || a.destroyed) return;
          const b = a.getBounds();
          s.sternbrett?.fuelle({ x: b.x + b.width / 2, y: b.y + b.height * 0.2 });
        });
        s.after(2.6, () => {
          if (this.tot || a.destroyed) return;
          const b = s.inWelt(a.getBounds());
          belohne(s, lieferSticker(), b.x + b.w / 2, b.y - 60);
        });
      });
  }

  /** Hebel: Was noch fehlt, geschieht von selbst (anklopfen, abgeben) – dann fährt der Zug weiter. */
  weiter() {
    if (this.erledigt) return true;
    if (this.ware && !this.lief.geliefert) {
      if (this.autoLaeuft) return false;
      this.autoLaeuft = true;
      const s = this.s;
      let warte = 0.2;
      if (!this.draussen) {
        this.klopfen();
        warte = 1.8;
      }
      // Abgeben, sobald der Empfänger draußen ist; weiter geht es erst, wenn die Ladung wirklich bei ihm ist
      const versuche = () => {
        if (this.tot) return;
        if (this.lief.geliefert) {
          s.after(3.2, () => {
            if (this.tot) return;
            this.erledigt = true;
            this.da = false;
            s.losfahren();
          });
          return;
        }
        this.abgeben();
        s.after(0.3, versuche);
      };
      s.after(warte, versuche);
      return false;
    }
    this.erledigt = true;
    this.da = false;
    if (this.empf) this.s.after(0.6, () => { if (!this.tot && this.empf && !this.empf.destroyed) gruss(this.s, this.empf, { laut: false }); });
    return true;
  }

  update(dt, sx) {
    // ab und zu winkt der Empfänger (nur wenn er zu sehen ist)
    if (!this.empf || this.empf.destroyed) return;
    this.winkZeit -= dt;
    if (this.winkZeit <= 0) {
      this.winkZeit = rand(5, 7);
      if (sx > -this.s.W / 2 && sx < this.s.W / 2) gruss(this.s, this.empf, { laut: false });
    }
  }

  hinweise() {
    if (!this.da) return [];
    if (!this.draussen) return [this.tuerF];
    if (this.ware && !this.lief.geliefert && !this.ware.destroyed) return [this.ware];
    return [];
  }
}

/**
 * Sticker für eine Lieferung: nur Sticker der Zugfahrt (Tiere und Loks entdeckt das Kind an ihren eigenen Orten).
 * Zuerst einer, der noch fehlt; sind alle da, ein schon gesammelter – dann gibt es nur einen leisen Gruß.
 */
function lieferSticker() {
  const da = new Set(store.stickers());
  const ort = stickerFuerOrt('fahrt');
  return (ort.find((st) => !da.has(st.id)) || pick(ort)).id;
}

// ================================================================ Wasserturm

export class Wasserturm extends Ding {
  constructor(s, linkeKante) {
    super(s, 0);
    this.art = 'wasser';
    const id = 'fahrt/wasserturm';
    const skala = 0.95;
    const y = HINTEN_Y - 6;
    const c = this.teil(s.ebHinten, y - 30);
    this.c = c;
    this.turm = spr(id, { x: 0, y, scale: skala, parent: c });
    const d = localPoint(id, 'duese');
    this.duese = { x: (d ? d.x : 240) * skala, y: y + (d ? d.y : -300) * skala };
    // Wasserstrahl: hinter der Lok (gleiche Ebene wie der Turm) – er verschwindet oben in der Lok
    this.strahl = new Graphics()
      .roundRect(-14, 0, 28, 300, 14).fill({ color: 0x8fd3f4, alpha: 0.85 })
      .roundRect(-6, 4, 8, 290, 4).fill({ color: 0xffffff, alpha: 0.45 });
    this.strahl.position.set(this.duese.x, this.duese.y - 4);
    this.strahl.alpha = 0;
    this.strahl.eventMode = 'none';
    c.addChild(this.strahl);
    this.halten = hold(this.turm, {
      hitArea: flaeche(this.turm, { min: 260 }),
      onStart: () => this.start(),
      onTick: (dt) => this.tick(dt),
      onEnd: () => this.ende(),
    });
    const m = meta(id);
    this.links = -(m.w * m.ax) * skala - 20;
    this.rechts = (m.w * (1 - m.ax)) * skala + 20;
    this.wx = linkeKante - this.links;
    this.fuell = 0;
    this.da = false;
    this.voll = false;
    this.erledigt = false;
    this.haeltFest = false;
    this.tropfZeit = 0;
    this.anzeige = null;
  }

  // wo die Lok Wasser bekommt (Bildschirm-x): etwa über dem Kessel
  einfuell() {
    return LOK_X - this.s.lokBreite * 0.42;
  }

  haltBei() {
    return this.erledigt ? null : this.wx + this.duese.x - this.einfuell();
  }

  angekommen() {
    const s = this.s;
    this.da = true;
    sfx('common/gong', { vol: 0.3 });
    this.baueAnzeige();
    const passt = () => !this.tot && this.da && !this.voll && !this.haeltFest;
    s.after(1.5, () => { if (passt()) voice('fahrt_wasser', { nurWenn: passt }); });
  }

  // Denkblase über der Lok mit einem Tropfen, der sich von unten füllt
  baueAnzeige() {
    const s = this.s;
    const b = s.inWelt(s.zug.lok.getBounds());
    const g = new Container({ label: 'wasser-anzeige' });
    g.position.set(LOK_X - 40, b.y + 30);
    g.zIndex = 800;
    g.eventMode = 'none';
    s.front.addChild(g);
    spr('common/blase_denk', { anchor: [45 / 600, 540 / 562], scale: 0.5, parent: g });
    const leer = spr('common/p_tropfen', { x: 142, y: -140, scale: 1, parent: g });
    leer.tint = 0x8c8c8c;
    leer.alpha = 0.28;
    this.tropfen = spr('common/p_tropfen', { x: 142, y: -140, scale: 1, parent: g });
    this.maske = new Graphics().rect(-80, 0, 160, 220).fill(0xffffff);
    this.maske.x = 142;
    g.addChild(this.maske);
    this.tropfen.mask = this.maske;
    g.alpha = 0;
    s.tween(g, { alpha: 1 }, 0.5, { ease: 'sineInOut' });
    this.anzeige = g;
    this.zeigeFuellung();
  }

  zeigeFuellung() {
    if (this.maske && !this.maske.destroyed) this.maske.y = -140 + 82 - 164 * this.fuell;
  }

  start() {
    const s = this.s;
    if (!this.da || this.voll) {
      // vor dem Halt (oder satt): ein paar Spritzer aus der Brause
      fx.wobble(this.turm, 0.015);
      if (ruhig(this.turm, 0.7)) {
        sfx('common/spritz', { vol: 0.5 });
        fx.burst('tropfen', this.duese.x, this.duese.y + 10, { count: 4, parent: this.c, z: 1000 });
      }
      return;
    }
    this.haeltFest = true;
    this.strahlAn(true);
    this.fuell = Math.min(1, this.fuell + 0.08);   // auch kurzes Tippen hilft ein wenig
    this.zeigeFuellung();
    if (this.fuell >= 1) this.satt();
  }

  tick(dt) {
    // Der Finger lag schon auf dem Turm, als der Zug ankam: gleich losströmen (onTick kommt nur, solange er liegt)
    if (!this.haeltFest && this.da && !this.voll && !this.auto) {
      this.haeltFest = true;
      this.strahlAn(true);
    }
    if (!this.da || this.voll || !this.haeltFest) return;
    this.fuell = Math.min(1, this.fuell + dt / 2.6);
    this.zeigeFuellung();
    this.tropfZeit -= dt;
    if (this.tropfZeit <= 0) {
      this.tropfZeit = 0.5;
      fx.burst('tropfen', this.einfuell(), this.duese.y + 70, { count: 2, parent: this.s.front });
    }
    if (this.fuell >= 1) this.satt();
  }

  ende() {
    this.haeltFest = false;
    if (!this.auto) this.strahlAn(false);
  }

  strahlAn(an) {
    const s = this.s;
    if (an === this._strahl) return;
    this._strahl = an;
    s.tween(this.strahl, { alpha: an ? 1 : 0 }, 0.5, { ease: 'sineInOut' });
    if (an) {
      if (!this.ton) this.ton = sfxSchleife('common/wasserstrahl', { vol: 0.4 });
      this.ton.an(0.3);
    } else {
      this.ton?.aus(0.4);
    }
  }

  /** Tank voll: die Lok freut sich, pfeift und fährt bald von selbst weiter. */
  satt() {
    if (this.voll) return;
    const s = this.s;
    this.voll = true;
    this.haeltFest = false;
    this.auto = false;
    this.strahlAn(false);
    sfx('common/funkeln', { vol: 0.45 });
    if (this.tropfen) fx.pop(this.anzeige, 0.08);
    const b = s.inWelt(s.zug.lok.getBounds());
    fx.burst('funkeln', b.x + b.w / 2, b.y + 40, { count: 6, parent: s.front });
    s.after(0.4, () => { if (!s.zug.destroyed) { s.zug.pfeife(); s.zug.lok.hupf(22); } });
    s.after(1.0, () => {
      if (this.tot) return;
      s.belohneEinmal('wasser', store.stickers().includes('fahrt_wasserturm') ? 'lok' : 'fahrt_wasserturm',
        this.c, 0, this.duese.y - 420);
    });
    s.after(1.3, () => {
      const g = this.anzeige;
      if (!g || g.destroyed) return;
      s.tween(g, { alpha: 0 }, 0.6, { ease: 'sineInOut' }).then(() => { if (!g.destroyed) g.destroy({ children: true, context: true }); });
    });
    s.after(2.2, () => {
      if (this.tot) return;
      this.erledigt = true;
      this.da = false;
      s.losfahren();
    });
  }

  /** Hebel: Der Turm füllt die Lok von selbst voll, dann geht es weiter. */
  weiter() {
    if (this.erledigt) return true;
    if (!this.da) {
      this.erledigt = true;
      return true;
    }
    if (this.voll || this.auto) return false;
    this.auto = true;
    this.strahlAn(true);
    const p = { f: this.fuell };
    this.s.tween(p, { f: 1 }, 1.4 * (1 - this.fuell) + 0.2, {
      ease: 'sineInOut',
      onUpdate: () => {
        this.fuell = p.f;
        this.zeigeFuellung();
      },
    }).then(() => { if (!this.tot) this.satt(); });
    return false;
  }

  hinweise() {
    return this.da && !this.voll ? [this.turm] : [];
  }

  zerstoere() {
    this.ton?.stop();
    if (this.anzeige && !this.anzeige.destroyed) this.anzeige.destroy({ children: true, context: true });
    super.zerstoere();
  }
}

// ================================================================ Signal (mit Tieren, die über das Gleis watscheln)

const UEBER_GLEIS = [
  { id: 'ente', n: 3, sk: 0.15 }, { id: 'huhn', n: 3, sk: 0.15 }, { id: 'igel', n: 2, sk: 0.15 },
  { id: 'hase', n: 2, sk: 0.17 }, { id: 'schaf', n: 2, sk: 0.2 }, { id: 'schwein', n: 2, sk: 0.19 },
];
let letzteKreuzer = null;
const SIGNAL_X = LOK_X + 300;    // dort steht das Signal beim Halt (Bildschirm-x)
const KREUZ_X = -170;            // dort (relativ zum Signal) gehen die Tiere über das Gleis

export class Signal extends Ding {
  constructor(s, linkeKante) {
    super(s, 0);
    this.art = 'signal';
    const y = HINTEN_Y + 12;
    const c = this.teil(s.ebHinten, y);
    this.c = c;
    this.sc = new Container({ label: 'signal' });
    c.addChild(this.sc);
    this.rot = spr('zug/signal_rot', { x: 0, y, scale: 0.62, parent: this.sc });
    this.gruen = spr('zug/signal_gruen', { x: 0, y, scale: 0.62, parent: this.sc, alpha: 0 });
    tippbar(this.sc, () => this.tipp(), { skala: 1 });
    this.tc = this.teil(s.ebAufGleis, 0);    // Tiere, die über das Gleis gehen
    this.tiere = [];
    this.links = -260;
    this.rechts = 160;
    this.wx = linkeKante - this.links;
    this.istGruen = false;
    this.da = false;
    this.erledigt = false;
    this.abfahrt = false;
  }

  haltBei() {
    if (this.erledigt || (this.istGruen && !this.da)) return null;
    return this.wx - SIGNAL_X;
  }

  angekommen() {
    const s = this.s;
    this.da = true;
    sfx('common/gong', { vol: 0.3 });
    s.after(0.8, () => { if (!this.tot) this.tiereKommen(); });
    const passt = () => !this.tot && !this.istGruen;
    s.after(2.4, () => { if (passt()) voice('fahrt_signal', { nurWenn: passt }); });
  }

  tiereKommen() {
    const s = this.s;
    const art = pick(UEBER_GLEIS.filter((k) => k.id !== letzteKreuzer));
    letzteKreuzer = art.id;
    // Sie watscheln schräg von hinten links nach vorn rechts über das Gleis (hintereinander, mit Abstand),
    // dann vorn nach rechts davon
    const ABSTAND = 1.4;
    for (let i = 0; i < art.n; i++) {
      s.after(i * ABSTAND, () => {
        if (this.tot) return;
        const a = new Actor(art.id, { x: KREUZ_X - 90, y: HINTEN_Y - 12, scale: art.sk * 0.9, parent: this.tc });
        a.alpha = 0;
        this.tiere.push(a);
        a.onTap(() => {
          fx.wobble(a, 0.08);
          if (ruhig(a, 0.9)) a.sound();
          const b = s.inWelt(a.getBounds());
          fx.burst('herzen', b.x + b.w / 2, b.y + 10, { count: 2, parent: s.front });
        }, { pad: 90 });
        s.tween(a, { alpha: 1 }, 0.4, { ease: 'sineInOut' });
        s.tween(a.scale, { x: art.sk * 1.2, y: art.sk * 1.2 }, 2.8, { ease: 'sineInOut' });
        if (i === 0) s.after(0.4, () => { if (!a.destroyed) a.sound(); });
        a.walkTo(KREUZ_X + 110, GLEIS_Y + 190, { tempo: 100 })
          .then((ok) => (ok && !a.destroyed ? a.walkTo(760, GLEIS_Y + 190, { tempo: 130 }) : ok))
          .then(() => {
            if (a.destroyed) return;
            s.tween(a, { alpha: 0 }, 0.6, { ease: 'sineInOut' }).then(() => { if (!a.destroyed) a.destroy({ children: true, context: true }); });
          });
      });
    }
    this.tiereBis = s.t + (art.n - 1) * ABSTAND + 5;   // spätestens dann ist das Gleis frei (nie hängen bleiben)
  }

  gleisFrei() {
    if (!this.tiereBis) return false;
    if (this.s.t >= this.tiereBis) return true;
    return this.tiere.length > 0 && this.tiere.every((a) => a.destroyed || a.y > GLEIS_Y + 120);
  }

  tipp() {
    const s = this.s;
    fx.wobble(this.sc, 0.03);
    if (this.istGruen) {
      if (ruhig(this.sc, 0.8)) sfx('common/klick', { vol: 0.5 });
      return;
    }
    this.istGruen = true;
    sfx('common/klick', { vol: 0.7 });
    note('glocke', 79, { vol: 0.45 });
    s.after(0.25, () => note('glocke', 84, { vol: 0.4 }));
    s.tween(this.gruen, { alpha: 1 }, 0.7, { ease: 'sineInOut' });
    s.tween(this.rot, { alpha: 0 }, 0.7, { ease: 'sineInOut' });
  }

  /** Hebel: Das Signal wird grün; sobald das Gleis frei ist, geht es weiter. */
  weiter() {
    if (this.erledigt) return true;
    if (!this.da) {
      this.tipp();
      return true;
    }
    this.tipp();
    return false;
  }

  update() {
    if (!this.da || !this.istGruen || this.abfahrt || !this.gleisFrei()) return;
    const s = this.s;
    this.abfahrt = true;
    s.after(0.5, () => { if (!s.zug.destroyed) s.zug.pfeife(); });
    s.after(1.1, () => {
      if (this.tot) return;
      this.erledigt = true;
      this.da = false;
      s.losfahren();
    });
  }

  hinweise() {
    return this.istGruen ? [] : [this.sc];
  }
}

// ================================================================ Regenschauer (Überraschung) und Regenbogen

// Wer passend zum Wetter am Wegesrand auftaucht, wenn kein Regenschauer kommen kann
const WETTER_GAST = { abend: 'eule', nacht: 'eule', regen: 'frosch', schnee: 'pinguin' };
const WETTER_GAST_X = 40;   // Platz relativ zu wx (vordere Reihe)

/**
 * Wetter-Überraschung. An einem klaren Tag eine unsichtbare „Station": Hier zieht ein leiser Regen über die
 * Strecke, danach erscheint ein Regenbogen. Ist es Abend oder Nacht, regnet oder schneit es schon (oder läuft
 * gerade ein Schauer), hüpft stattdessen ein passendes Tier an den Wegesrand: Eule, Frosch oder Pinguin.
 * Entschieden wird erst, wenn die Stelle gleich ins Bild kommt – das Kind kann das Wetter ja vorher noch wechseln.
 */
export class Regenschauer extends Ding {
  constructor(s, linkeKante) {
    super(s, 0);
    this.art = 'regen';
    this.sperrtHinten = false;
    this.vorneBelegt = true;   // Platz für den Wetter-Gast in der vorderen Reihe
    this.links = -170;
    this.rechts = 250;
    this.wx = linkeKante - this.links;
    this.c = this.teil(s.ebVorne, VORNE_Y);
    this.gast = null;
  }

  update(dt, sx) {
    if (this.los || sx > this.s.W / 2 - 150) return;
    this.los = true;
    if (!regenSchauer(this.s)) this.wetterGast();
  }

  wetterGast() {
    const s = this.s;
    const id = WETTER_GAST[s.wetter] || WETTER_GAST[s.zeit] || 'frosch';
    const y = VORNE_Y - 10;
    const a = figur(id, { x: WETTER_GAST_X + 60, y: y - 60, parent: this.c, faktor: 1.25 });
    a.alpha = 0;
    this.gast = a;
    s.tween(a, { alpha: 1 }, 0.5, { ease: 'sineInOut' });
    a.hopTo(WETTER_GAST_X, y, { hoehe: 70, dauer: 0.6, staub: false }).then((ok) => {
      if (!ok || a.destroyed) return;
      gruss(s, a);
    });
    a.onTap(() => {
      if (!ruhig(a, 0.9)) {
        fx.wobble(a, 0.06);
        return;
      }
      freude(s, a);
    }, { pad: 90 });
  }

  hinweise() {
    return this.gast && !this.gast.destroyed ? [this.gast] : [];
  }
}

/** Ein leiser Regenschauer (nur an einem klaren Tag, wenn nicht schon einer läuft). → true, wenn er beginnt */
export function regenSchauer(s) {
  if (s.wetter !== 'klar' || s.zeit !== 'tag' || s.schauer) return false;
  const nr = s.zustand;
  s.schauer = true;
  s.wetter = 'regen';
  ambient.set({ zeit: 'tag', wetter: 'regen' }, { dauer: 2.5 });
  s.himmel.setze('tag', 'regen');
  s.after(11, () => {
    if (s.zustand !== nr) {   // das Kind hat inzwischen selbst das Wetter gewählt
      s.schauer = false;
      return;
    }
    s.wetter = 'klar';
    ambient.set({ zeit: 'tag', wetter: 'klar' }, { dauer: 2.5 });
    s.himmel.setze('tag', 'klar');
    s.after(2.6, () => {
      s.schauer = false;
      if (s.zustand === nr) regenbogen(s);
    });
  });
  return true;
}

/** Ein weicher Regenbogen am Himmel (blendet langsam ein und wieder aus). Antippen → Glöckchen. */
export function regenbogen(s, { dauer = 18 } = {}) {
  if (s.bogen && !s.bogen.destroyed) return;
  const r = spr('common/regenbogen', { x: rand(-420, 120), y: 640, scale: 1.45, parent: s.bg, z: -97 });
  r.alpha = 0;
  s.bogen = r;
  tippbar(r, () => {
    fx.wobble(r, 0.02);
    if (!ruhig(r, 1.4)) return;
    [72, 76, 79, 84].forEach((n, i) => s.after(i * 0.18, () => note('glocke', n, { vol: 0.4 })));
  }, { skala: 1.45 });
  voice('fahrt_regenbogen');
  sfx('common/funkeln', { vol: 0.35 });
  s.tween(r, { alpha: 0.88 }, 2.5, { ease: 'sineInOut' });
  s.after(dauer, () => {
    if (r.destroyed) return;
    r.eventMode = 'none';
    s.tween(r, { alpha: 0 }, 3, { ease: 'sineInOut' }).then(() => {
      if (!r.destroyed) r.destroy();
      if (s.bogen === r) s.bogen = null;
    });
  });
}

// ================================================================ Sternen-Brett (über dem Fahr-Hebel)

const STERNE = 5;
const STERN_SKALA = 0.3;
const STERN_TOENE = [72, 74, 76, 79, 81];

export class Sternbrett {
  constructor(s) {
    this.s = s;
    const c = new Container({ label: 'sternbrett' });
    c.zIndex = 50;
    s.hud.addChild(c);
    this.c = c;
    c.addChild(new Graphics()
      .roundRect(-148, -40, 300, 92, 40).fill({ color: 0x3a2a1a, alpha: 0.16 })
      .roundRect(-152, -46, 304, 92, 40).fill(0xbf8752)
      .roundRect(-140, -34, 280, 68, 30).fill(0xf4e2bf));
    this.plaetze = [];
    for (let i = 0; i < STERNE; i++) {
      const x = (i - (STERNE - 1) / 2) * 53;
      const leer = spr('common/p_stern', { x, y: 0, scale: STERN_SKALA, parent: c });
      leer.tint = 0x8a6a48;
      leer.alpha = 0.25;
      const voll = spr('common/p_stern', { x, y: 0, scale: STERN_SKALA, parent: c });
      voll.alpha = 0;
      this.plaetze.push(voll);
    }
    this.n = clamp(Math.floor(store.get('fahrt.sterne', 0)) || 0, 0, STERNE - 1);
    for (let i = 0; i < this.n; i++) this.plaetze[i].alpha = 1;
    tap(c, () => this.tipp(), { sound: null, squash: false, hitArea: new Rectangle(-160, -100, 320, 200) });
  }

  setze(x, y) {
    this.c.position.set(x, y);
  }

  tipp() {
    fx.wobble(this.c, 0.03);
    if (!ruhig(this.c, 0.5)) return;
    const voll = this.plaetze.filter((p) => p.alpha > 0.5);
    if (voll.length) {
      voll.forEach((p, i) => this.s.after(i * 0.12, () => { if (!p.destroyed) fx.pop(p, 0.15); }));
      note('pling', STERN_TOENE[voll.length - 1] + 12, { vol: 0.35 });
    } else {
      sfx('common/klack', { vol: 0.5 });
    }
  }

  /** Ein Stern fliegt von `global` (Bildschirm-Punkt) auf den nächsten freien Platz. */
  fuelle(global) {
    const s = this.s;
    if (this.n >= STERNE) return;
    const i = this.n++;
    store.set('fahrt.sterne', this.n % STERNE);
    const ziel = this.plaetze[i];
    const start = this.c.toLocal(global);
    const st = spr('common/p_stern', { x: start.x, y: start.y, scale: 0.55, parent: this.c });
    st.eventMode = 'none';
    sfx('common/funkeln', { vol: 0.35 });
    bogen(s, st, ziel.x, ziel.y, { skala: STERN_SKALA, dauer: 1.4, hoehe: 160, drehen: 0.4 }).then((ok) => {
      if (!st.destroyed) st.destroy();
      if (!ok || ziel.destroyed) return;
      s.tween(ziel, { alpha: 1 }, 0.5, { ease: 'sineInOut' });
      fx.pop(ziel, 0.25);
      note('glocke', STERN_TOENE[i] + 12, { vol: 0.45 });
      if (this.n >= STERNE) s.after(0.8, () => this.komplett());
    });
  }

  /** Fünf Sterne: ein Regenbogen, die Sterne funkeln, danach beginnt das Brett weich von vorn. */
  komplett() {
    const s = this.s;
    regenbogen(s);
    this.plaetze.forEach((p, i) => s.after(i * 0.2, () => { if (!p.destroyed) fx.pop(p, 0.2); }));
    fx.burst('funkeln', this.c.x, this.c.y, { count: 6, parent: s.hud });
    s.after(7, () => {
      this.plaetze.forEach((p, i) => { if (!p.destroyed) s.tween(p, { alpha: 0 }, 0.8, { ease: 'sineInOut', delay: i * 0.15 }); });
      this.n = 0;
      store.set('fahrt.sterne', 0);
    });
  }
}
