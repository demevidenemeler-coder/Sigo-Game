// Eisdiele – gezeichnete Kleinigkeiten (weiche, runde Formen passend zum Knete-Look):
// Waffel-Halter, Topping-Wagen, Schälchen, ein kleiner Vogel und ein Schmetterling.
// Alles ruhig: nur sanftes Wiegen, langsames Flattern, kleine Hüpfer beim Antippen.

import { PIXI, tap, fx, note, rand, pick } from '../../engine/index.js';

// ---------------------------------------------------------------- Waffel-Halter

/**
 * Halter für die Waffel (Spitze nach unten). Ursprung = Standfläche auf der Theke.
 * → { hinten, vorn } – hinten liegt hinter der Waffel, vorn (der vordere Ring) davor.
 */
export function waffelHalter() {
  const hinten = new PIXI.Graphics();
  // weicher Schatten auf der Theke
  hinten.ellipse(0, 4, 100, 20).fill({ color: 0x5a4630, alpha: 0.16 });
  // Fuß
  hinten.ellipse(0, -6, 84, 22).fill(0x8fcfb4).stroke({ width: 5, color: 0x6db497 });
  hinten.ellipse(-18, -12, 40, 8).fill({ color: 0xffffff, alpha: 0.35 });
  // Stiel
  hinten.roundRect(-17, -150, 34, 146, 14).fill(0xa6dcc5).stroke({ width: 4, color: 0x7cc0a4 });
  hinten.roundRect(-9, -140, 8, 120, 4).fill({ color: 0xffffff, alpha: 0.3 });
  // Rückseite des Rings
  hinten.ellipse(0, -150, 66, 20).fill(0xd98a9c);

  const vorn = new PIXI.Graphics();
  vorn.roundRect(-70, -158, 140, 34, 17).fill(0xf4a6b6).stroke({ width: 5, color: 0xdc8296 });
  vorn.roundRect(-52, -153, 70, 9, 4.5).fill({ color: 0xffffff, alpha: 0.45 });
  vorn.eventMode = 'none';
  hinten.eventMode = 'none';
  return { hinten, vorn };
}

// ---------------------------------------------------------------- Topping-Wagen

/** Kleiner Servier-Wagen. Ursprung = Mitte der Ablagefläche (Dinge stehen bei y=0). Höhe bis zum Boden: `bein`. */
export function toppingWagen(breite, bein = 200) {
  const g = new PIXI.Graphics();
  const h = breite / 2;
  // Schatten auf dem Boden
  g.ellipse(0, bein + 6, h + 20, 26).fill({ color: 0x5a4630, alpha: 0.14 });
  // Beine mit Rädchen
  for (const x of [-h + 70, h - 70]) {
    g.roundRect(x - 16, 30, 32, bein - 30, 12).fill(0xe2b98a).stroke({ width: 4, color: 0xc4955f });
    g.circle(x, bein - 6, 22).fill(0x9a7656).stroke({ width: 4, color: 0x7a5a40 });
    g.circle(x - 6, bein - 12, 7).fill({ color: 0xffffff, alpha: 0.35 });
  }
  // untere Ablage
  g.roundRect(-h + 50, bein * 0.68, breite - 100, 24, 12).fill(0xeac597).stroke({ width: 4, color: 0xc4955f });
  // Schürze (mint mit rosa Tupfen)
  g.roundRect(-h + 14, 18, breite - 28, 78, 28).fill(0xaadfc8).stroke({ width: 5, color: 0x7cc0a4 });
  const n = Math.max(3, Math.round((breite - 80) / 90));
  for (let i = 0; i < n; i++) {
    const x = -h + 50 + ((breite - 100) * i) / (n - 1);
    g.circle(x, 58, 12).fill({ color: 0xf4a6b6, alpha: 0.9 });
  }
  // Platte
  g.roundRect(-h, -14, breite, 40, 20).fill(0xfbe7cb).stroke({ width: 6, color: 0xf09aac });
  g.roundRect(-h + 26, -9, breite - 52, 10, 5).fill({ color: 0xffffff, alpha: 0.55 });
  g.eventMode = 'none';
  return g;
}

/** Flaches Schälchen; Ursprung = Standfläche. */
export function schale(farbe = 0xf6c3cf, rand = 0xe3a0b2) {
  const g = new PIXI.Graphics();
  g.ellipse(0, 2, 92, 16).fill({ color: 0x5a4630, alpha: 0.14 });
  g.roundRect(-84, -40, 168, 42, 21).fill(farbe).stroke({ width: 5, color: rand });
  g.ellipse(0, -40, 86, 18).fill(rand);
  g.ellipse(0, -42, 76, 13).fill({ color: 0xffffff, alpha: 0.35 });
  g.roundRect(-60, -30, 50, 8, 4).fill({ color: 0xffffff, alpha: 0.35 });
  g.eventMode = 'none';
  return g;
}

/** Weicher Schatten unter einem Ding auf der Theke. */
export function schatten(breite) {
  const g = new PIXI.Graphics().ellipse(0, 0, breite / 2, breite * 0.09).fill({ color: 0x5a4630, alpha: 0.16 });
  g.eventMode = 'none';
  return g;
}

// ---------------------------------------------------------------- Vogel

/**
 * Kleiner runder Vogel, der irgendwo sitzt, sanft atmet und ab und zu den Kopf dreht.
 * Antippen: zwei leise Piepser und ein kleiner Hüpfer. Ursprung = Füße.
 */
export class Vogel extends PIXI.Container {
  constructor(seite, { x, y, farbe = 0x8ec5ea, bauch = 0xfff2d6, flip = false, parent, z = 6 } = {}) {
    super({ label: 'vogel' });
    this.seite = seite;
    this.position.set(x, y);
    this.zIndex = z;
    this.t = rand(0, 5);
    this.koerper = new PIXI.Container();
    this.addChild(this.koerper);
    const dunkel = mische(farbe, 0x30405a, 0.25);
    const g = new PIXI.Graphics();
    // Schwanz
    g.roundRect(-92, -78, 60, 26, 13).fill(dunkel);
    // Beinchen
    g.roundRect(-14, -16, 7, 16, 3).fill(0xe8a050);
    g.roundRect(8, -16, 7, 16, 3).fill(0xe8a050);
    // Körper, Bauch
    g.ellipse(0, -58, 62, 50).fill(farbe).stroke({ width: 4, color: dunkel });
    g.ellipse(12, -46, 38, 32).fill(bauch);
    // Flügel
    g.ellipse(-16, -62, 34, 22).fill(dunkel);
    g.ellipse(-22, -68, 16, 7).fill({ color: 0xffffff, alpha: 0.25 });
    this.koerper.addChild(g);

    // Kopf (dreht sich ab und zu)
    this.kopf = new PIXI.Container();
    this.kopf.position.set(30, -110);
    const k = new PIXI.Graphics();
    k.circle(0, 0, 38).fill(farbe).stroke({ width: 4, color: dunkel });
    k.ellipse(-10, -16, 14, 8).fill({ color: 0xffffff, alpha: 0.3 });
    k.circle(12, -4, 8.5).fill(0x2a2230);
    k.circle(15, -7, 3).fill(0xffffff);
    k.circle(18, 12, 8).fill({ color: 0xf59aa8, alpha: 0.7 });
    k.poly([30, -6, 54, 2, 30, 10]).fill(0xf2a23c).stroke({ width: 3, color: 0xd8862a, join: 'round' });
    this.kopf.addChild(k);
    this.koerper.addChild(this.kopf);

    if (flip) this.scale.x = -1;
    this.hitArea = new PIXI.Rectangle(-120, -200, 240, 230);
    (parent || seite.welt).addChild(this);
    this.letzterPiep = 0;
    tap(this, () => this.antippen(), { sound: null, squash: false });
    // ab und zu schaut er sich um (nur, solange die Seite sichtbar ist)
    seite.every(rand(5, 7), () => {
      if (!seite.aktiv || this.destroyed) return;
      seite.tween(this.kopf, { rotation: rand(-0.25, 0.2) }, 0.6, { ease: 'sineInOut' });
    });
  }

  antippen() {
    const jetzt = performance.now();
    if (jetzt - this.letzterPiep > 700) {
      this.letzterPiep = jetzt;
      note('floete', 88, { dauer: 0.1, vol: 0.45 });
      this.seite.after(0.16, () => note('floete', 91, { dauer: 0.12, vol: 0.45 }));
    }
    const k = this.koerper;
    this.seite.tween(k, { y: -36 }, 0.18, { ease: 'quadOut' })
      .then((ok) => { if (ok && !k.destroyed) this.seite.tween(k, { y: 0 }, 0.3, { ease: 'bounceOut' }); });
    fx.wobble(this.kopf, 0.12);
  }

  update(dt) {
    this.t += dt;
    // ruhiges Atmen
    const w = Math.sin(this.t * 2.2);
    this.koerper.scale.set(1 - 0.012 * w, 1 + 0.02 * w);
  }
}

// ---------------------------------------------------------------- Schmetterling

/**
 * Schmetterling, der langsam um einen Ort schwebt. Antippen: er flattert gemächlich zu einem anderen Ort.
 * orte = [{x, y}, …] in Koordinaten des Eltern-Containers.
 */
export class Schmetterling extends PIXI.Container {
  constructor(seite, { orte, farbe = 0xf7b6d2, farbe2 = 0xffe08a, parent, z = 40 } = {}) {
    super({ label: 'schmetterling' });
    this.seite = seite;
    this.orte = orte;
    this.ort = { ...orte[0] };
    this.t = rand(0, 10);
    this.zIndex = z;
    this.position.set(this.ort.x, this.ort.y);

    const fluegel = (seite) => {
      const f = new PIXI.Container();
      const g = new PIXI.Graphics();
      g.ellipse(seite * 34, -22, 36, 30).fill(farbe).stroke({ width: 3, color: mische(farbe, 0x6a3a5a, 0.3) });
      g.ellipse(seite * 26, 18, 24, 20).fill(farbe2).stroke({ width: 3, color: mische(farbe2, 0x6a4a2a, 0.3) });
      g.circle(seite * 40, -26, 9).fill({ color: 0xffffff, alpha: 0.55 });
      f.addChild(g);
      return f;
    };
    this.links = fluegel(-1);
    this.rechts = fluegel(1);
    const leib = new PIXI.Graphics()
      .roundRect(-7, -34, 14, 64, 7).fill(0x5a4a5a)
      .moveTo(-3, -32).quadraticCurveTo(-14, -56, -22, -58).stroke({ width: 3, color: 0x5a4a5a, cap: 'round' })
      .moveTo(3, -32).quadraticCurveTo(14, -56, 22, -58).stroke({ width: 3, color: 0x5a4a5a, cap: 'round' });
    this.addChild(this.links, this.rechts, leib);
    this.scale.set(0.9);
    this.hitArea = new PIXI.Circle(0, 0, 135);
    (parent || seite.welt).addChild(this);
    tap(this, () => this.weiter(), { sound: null, squash: false });
  }

  weiter() {
    note('pling', pick([84, 86, 88]), { vol: 0.3 });
    const neu = pick(this.orte.filter((o) => Math.hypot(o.x - this.ort.x, o.y - this.ort.y) > 50)) || this.orte[0];
    this.seite.tween(this.ort, { x: neu.x, y: neu.y }, 2.6, { ease: 'sineInOut' });
  }

  update(dt) {
    this.t += dt;
    const t = this.t;
    // langsames Flattern (etwa 2 Schläge pro Sekunde)
    const f = 0.35 + 0.65 * Math.abs(Math.cos(t * Math.PI * 2));
    this.links.scale.x = f;
    this.rechts.scale.x = f;
    // ruhiges Schweben um den Ort
    this.x = this.ort.x + Math.sin(t * 0.55) * 80;
    this.y = this.ort.y + Math.sin(t * 0.9) * 40;
    this.rotation = Math.sin(t * 0.55 + 1.2) * 0.12;
  }
}

// ---------------------------------------------------------------- Tippflächen im Hintergrund

/**
 * Unsichtbare Tippfläche über einem gemalten Ding im Hintergrund: leiser Ton + ein paar Funkel.
 * ton = Funktion, die den Ton spielt.
 */
export function bildFleck(seite, { x, y, w = 220, h = 220, ton, teilchen = 'funkeln' }) {
  const c = new PIXI.Container({ label: 'fleck' });
  c.position.set(x, y);
  c.zIndex = 5;
  c.hitArea = new PIXI.Rectangle(-w / 2, -h / 2, w, h);
  seite.hinten.addChild(c);
  let zuletzt = 0;
  tap(c, () => {
    const jetzt = performance.now();
    if (jetzt - zuletzt < 600) return;
    zuletzt = jetzt;
    ton?.();
    seite.burst(teilchen, x, y - 20, { count: 4 });
  }, { sound: null, squash: false });
  return c;
}

// ---------------------------------------------------------------- Bewegung

// Höchste Fluggeschwindigkeit eines Bogens (Einheiten/s). Ruhe-Regel: nichts rast quer über das Bild – die Grenze
// liegt bei etwa 1500; mit etwas Abstand darunter, damit auch eine Messung über ruckelnde Bilder darunter bleibt.
const BOGEN_V_MAX = 1400;

/**
 * Kürzeste Flugdauer (s), bei der ein Bogen (Ease sineInOut) nirgends schneller als BOGEN_V_MAX ist.
 * Bahn: P(k) = Start + (Ziel − Start)·k − (0, 4·hoehe·k·(1 − k)); k(t) = (1 − cos πt) / 2 bei Dauer 1.
 * Bei Dauer T ist die Geschwindigkeit |dP/dk|·k'(t)/T – also T = (Spitze bei Dauer 1) / BOGEN_V_MAX.
 */
function bogenMindestDauer(dx, dy, hoehe) {
  let spitze = 0;
  for (let i = 1; i < 40; i++) {
    const t = i / 40;
    const k = (1 - Math.cos(Math.PI * t)) / 2;
    const kt = (Math.PI / 2) * Math.sin(Math.PI * t);
    const v = Math.hypot(dx, dy - 4 * hoehe * (1 - 2 * k)) * kt;
    if (v > spitze) spitze = v;
  }
  return spitze / BOGEN_V_MAX;
}

/**
 * Ding im ruhigen Bogen von seinem Ort nach (x, y) fliegen lassen (Koordinaten seines Eltern-Containers).
 * opt {dauer=0.55, hoehe=150, skala, ziel}. Die Dauer ist eine Mindestdauer: Bei langen Wegen fliegt das Ding
 * entsprechend länger, damit es nie schneller als BOGEN_V_MAX wird (kurze Wege bleiben wie gewohnt flott).
 * ziel = () => ({x, y}): Das Ziel kann sich unterwegs bewegen (z. B. die Waffel, die das Kind gerade zieht) –
 * das Ding landet dann trotzdem genau darauf, statt danach hinterherzuspringen. → Promise<boolean>
 */
export function bogenFlug(seite, obj, x, y, opt = {}) {
  const x0 = obj.x;
  const y0 = obj.y;
  const s0 = obj.scale.y;
  const s1 = opt.skala ?? s0;
  const hoehe = opt.hoehe ?? 150;
  const p = { k: 0 };
  let zx = x;
  let zy = y;
  // Alle Flüge der Eisdiele laufen in `welt` (Bühnen-Einheiten, nur beim Blättern waagrecht verschoben) – die
  // Strecke im Eltern-Container ist also die Strecke auf dem Bild.
  const dauer = Math.max(opt.dauer ?? 0.55, bogenMindestDauer(x - x0, y - y0, hoehe));
  return seite.tween(p, { k: 1 }, dauer, {
    ease: 'sineInOut',
    onUpdate: () => {
      if (obj.destroyed) return;
      if (opt.ziel) {
        const z = opt.ziel();
        if (z) { zx = z.x; zy = z.y; }
      }
      const k = p.k;
      obj.x = x0 + (zx - x0) * k;
      obj.y = y0 + (zy - y0) * k - hoehe * 4 * k * (1 - k);
      obj.scale.set(s0 + (s1 - s0) * k);
    },
  });
}

/** Ding in einen anderen Container hängen, ohne dass es auf dem Bildschirm springt (Ort und Größe bleiben). */
export function umhaengen(obj, neu) {
  const alt = obj.parent;
  if (!alt || alt === neu) return;
  const g = alt.toGlobal(obj.position);
  const sa = Math.hypot(alt.worldTransform.a, alt.worldTransform.b) || 1;
  const sn = Math.hypot(neu.worldTransform.a, neu.worldTransform.b) || 1;
  const p = neu.toLocal(g);
  neu.addChild(obj);
  obj.position.set(p.x, p.y);
  obj.scale.set(obj.scale.x * (sa / sn), obj.scale.y * (sa / sn));
}

// ---------------------------------------------------------------- Farben

/** Zwei Farben mischen (a → b, Anteil k). */
export function mische(a, b, k) {
  const r = Math.round(((a >> 16) & 255) * (1 - k) + ((b >> 16) & 255) * k);
  const g = Math.round(((a >> 8) & 255) * (1 - k) + ((b >> 8) & 255) * k);
  const bl = Math.round((a & 255) * (1 - k) + (b & 255) * k);
  return (r << 16) | (g << 8) | bl;
}

/** Mischfarbe mehrerer Früchte (Mittelwert, etwas aufgehellt). */
export function mischfarbe(farben) {
  if (!farben.length) return 0xffd27a;
  let r = 0;
  let g = 0;
  let b = 0;
  for (const f of farben) {
    r += (f >> 16) & 255;
    g += (f >> 8) & 255;
    b += f & 255;
  }
  const n = farben.length;
  return mische(((r / n) << 16) | ((g / n) << 8) | (b / n), 0xffffff, 0.12);
}
