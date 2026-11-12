// Das Eis: Waffel oder Becher mit bis zu drei Kugeln und Toppings obendrauf – als echtes, ziehbares Eis auf der
// Theke und als kleines Bild in der Wunsch-Blase. Beide benutzen dieselbe Anordnung (stapel()).

import { PIXI, spr, tex, meta, pick } from '../../engine/index.js';

export const SORTEN = ['erdbeer', 'schoko', 'vanille', 'pistazie', 'blaubeer'];
export const TOPPINGS = ['kirsche', 'sahne', 'streusel', 'sosse'];
export const GEFAESSE = ['waffel', 'becher'];
export const TOPPING_BILD = {
  kirsche: 'eisdiele/kirsche',
  sahne: 'eisdiele/sahnehaube',
  streusel: 'eisdiele/streusel_bunt',
  sosse: 'eisdiele/schokosauce',
};
export const TOPPING_Z = { sosse: 10, sahne: 11, streusel: 12, kirsche: 13 };

export const MAX_KUGELN = 3;
export const WAFFEL_SKALA = 0.75;
export const BECHER_SKALA = 0.58;
export const KUGEL_SKALA = 0.62;
const KUGEL_ABSTAND = 100;
// Öffnung (Kugel-Boden) und unterstes Ende relativ zum Ursprung des Eises (= Bildmitte der Waffel)
const FORM = {
  waffel: { oben: (52 - 210) * WAFFEL_SKALA, unten: (410 - 210) * WAFFEL_SKALA },
  // Der Becher steht mit dem Fuß auf der Theke (160 unter dem Ursprung); die Kugeln sitzen tief in der Schale
  becher: { oben: -6, unten: 160 },
};
export const SPITZE = FORM.waffel.unten;   // Spitze der Waffel unter der Bildmitte

/**
 * Anordnung: n Kugeln, Toppings (Set), Gefäß. → { kugeln: [{x,y}], top: {name: {x,y,s}}, kante }
 * Koordinaten relativ zum Ursprung des Eises (volle Größe).
 */
export function stapel(n, tops, art = 'waffel') {
  const oben = FORM[art].oben;
  const kugeln = [];
  for (let i = 0; i < n; i++) kugeln.push({ x: 0, y: oben - 32 - i * KUGEL_ABSTAND });
  let kante = n ? kugeln[n - 1].y - 72 : oben + 6;
  const top = {};
  if (tops.has('sosse')) {
    top.sosse = n ? { x: 0, y: kante + 32, s: 0.8 } : { x: 0, y: kante - 4, s: 0.62 };
    kante -= 12;
  }
  if (tops.has('sahne')) {
    top.sahne = { x: 0, y: kante - 48, s: 0.62 };
    kante -= 104;
  }
  if (tops.has('streusel')) {
    top.streusel = { x: 0, y: kante + 10, s: 0.55 };
    kante -= 18;
  }
  if (tops.has('kirsche')) {
    top.kirsche = { x: 6, y: kante - 44, s: 0.5 };
    kante -= 100;
  }
  return { kugeln, top, kante };
}

/** Bild des Gefäßes (Sprite) in einen Container setzen – Waffel mittig, Becher mit dem Fuß auf der Theke. */
export function gefaessBild(art, parent) {
  if (art === 'becher') {
    return spr('eisdiele/becher', { scale: BECHER_SKALA, y: FORM.becher.unten, parent, z: 0 });
  }
  return spr('eisdiele/waffel', { anchor: 0.5, scale: WAFFEL_SKALA, parent, z: 0 });
}

// ---------------------------------------------------------------- Wunsch

const schluessel = (w) => `${w.gefaess}|${w.kugeln.slice().sort().join(',')}|${w.toppings.slice().sort().join(',')}`;

/**
 * Zufälliger Wunsch: {gefaess, kugeln: ['erdbeer', …], toppings: ['kirsche', …]}.
 * einfach = erste Runde (eine Kugel, ein Topping). Nie genau derselbe Wunsch wie `vorher`.
 */
export function neuerWunsch(einfach = false, vorher = null) {
  for (let versuch = 0; versuch < 12; versuch++) {
    const gefaess = pick(GEFAESSE);
    const n = einfach ? 1 : pick([1, 2, 2, 2, 3, 3]);
    const kugeln = [];
    for (let i = 0; i < n; i++) kugeln.push(pick(SORTEN));
    const t = einfach ? 1 : pick([0, 1, 1, 2, 2]);
    const frei = TOPPINGS.slice();
    const toppings = [];
    for (let i = 0; i < t; i++) toppings.push(frei.splice(Math.floor(Math.random() * frei.length), 1)[0]);
    const w = { gefaess, kugeln, toppings };
    if (!vorher || schluessel(w) !== schluessel(vorher)) return w;
  }
  return { gefaess: vorher?.gefaess === 'waffel' ? 'becher' : 'waffel', kugeln: [pick(SORTEN)], toppings: [] };
}

/** Kleines Eis-Bild (Container, nicht antippbar) für die Wunsch-Blase. Mitte des Bildes liegt bei (0, 0). */
export function miniEis(wunsch) {
  const c = new PIXI.Container({ label: 'miniEis', sortableChildren: true });
  const art = wunsch.gefaess || 'waffel';
  const tops = new Set(wunsch.toppings || []);
  const st = stapel(wunsch.kugeln.length, tops, art);
  gefaessBild(art, c);
  wunsch.kugeln.forEach((sorte, i) => {
    const p = st.kugeln[i];
    spr('eisdiele/kugel_' + sorte, { anchor: 0.5, scale: KUGEL_SKALA, x: p.x, y: p.y, parent: c, z: 1 + i });
  });
  for (const [name, p] of Object.entries(st.top)) {
    spr(TOPPING_BILD[name], { anchor: 0.5, scale: p.s, x: p.x, y: p.y, parent: c, z: TOPPING_Z[name] });
  }
  // senkrecht mittig: von der obersten Kante bis zum unteren Ende
  const oben = st.kante - 20;
  const unten = FORM[art].unten;
  c.pivot.set(0, (oben + unten) / 2);
  c.hoehe = unten - oben;   // Gesamthöhe (für die Größe in der Blase)
  c.eventMode = 'none';
  return c;
}

// ---------------------------------------------------------------- Eis auf der Theke

export class Eis extends PIXI.Container {
  constructor(art = 'waffel') {
    super({ label: 'eis', sortableChildren: true });
    this.art = art;
    this.waffel = gefaessBild(art, this);   // das Gefäß (heißt aus alter Zeit „waffel")
    this.kugeln = [];             // Sprites mit .sorte
    this.toppings = new Map();    // name → Sprite
    // Greiffläche: Gefäß und das Eis darüber – wächst mit dem Turm (siehe passeGreifflaeche), damit ein leeres
    // Gefäß nicht die Gläser im Regal oder die Wannen daneben verdeckt
    this.hitArea = new PIXI.Rectangle(-175, -200, 350, 380);
    this.passeGreifflaeche();
  }

  /** Greiffläche an die echte Höhe anpassen: von knapp über der obersten Kante bis unter das Gefäß. */
  passeGreifflaeche() {
    const oben = Math.min(this.kante() - 50, -60);
    this.hitArea.y = oben;
    this.hitArea.height = 180 - oben;
  }

  get anzahl() {
    return this.kugeln.length;
  }

  get leer() {
    return !this.kugeln.length && !this.toppings.size;
  }

  hat(name) {
    return this.toppings.has(name);
  }

  /** Ort für Kugel i bzw. ein Topping (lokal), wenn `extra` zusätzlich dazukommt. */
  platz(art, name, extraKugeln = 0) {
    const tops = new Set(this.toppings.keys());
    if (art === 'topping') tops.add(name);
    const st = stapel(this.anzahl + extraKugeln, tops, this.art);
    if (art === 'kugel') return st.kugeln[Math.min(name, st.kugeln.length - 1)] || { x: 0, y: FORM[this.art].oben };
    return st.top[name];
  }

  /** Oberste Kante (lokal). */
  kante() {
    return stapel(this.anzahl, new Set(this.toppings.keys()), this.art).kante;
  }

  /** Alle Teile weich an ihren Platz. seite = für die Zeit. */
  ordne(seite, dauer = 0.25) {
    this.passeGreifflaeche();
    const st = stapel(this.anzahl, new Set(this.toppings.keys()), this.art);
    this.kugeln.forEach((k, i) => {
      k.zIndex = 1 + i;
      const p = st.kugeln[i];
      seite.tween(k, { x: p.x, y: p.y, scale: KUGEL_SKALA }, dauer, { ease: 'sineInOut' });
    });
    for (const [name, s] of this.toppings) {
      const p = st.top[name];
      seite.tween(s, { x: p.x, y: p.y, scale: p.s }, dauer, { ease: 'sineInOut' });
    }
  }

  /** Stimmt das Eis genau mit dem Wunsch überein? (Reihenfolge egal, zusätzliche Toppings auch) */
  stimmt(wunsch) {
    if (wunsch.gefaess && wunsch.gefaess !== this.art) return false;
    const a = this.kugeln.map((k) => k.sorte).sort().join(',');
    const b = wunsch.kugeln.slice().sort().join(',');
    if (a !== b) return false;
    return (wunsch.toppings || []).every((t) => this.toppings.has(t));
  }

  /** Welche gewünschte Sorte fehlt noch? (oder null) */
  fehlendeSorte(wunsch) {
    const da = this.kugeln.map((k) => k.sorte);
    for (const s of wunsch.kugeln) {
      const i = da.indexOf(s);
      if (i < 0) return s;
      da.splice(i, 1);
    }
    return null;
  }

  /** Welches gewünschte Topping fehlt noch? (oder null) */
  fehlendesTopping(wunsch) {
    return (wunsch.toppings || []).find((t) => !this.toppings.has(t)) || null;
  }
}

/** Größe eines Bildes (für Tippflächen in Bildpunkten). */
export function bildGroesse(id) {
  const m = meta(id);
  const t = tex(id);
  return { w: m.w || t.width, h: m.h || t.height };
}
