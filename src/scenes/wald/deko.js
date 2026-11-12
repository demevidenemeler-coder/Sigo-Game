// Gemeinsames für die Wald-Seiten: Tierkinder als Figuren, ruhige Freude mit Herzen an der Seite,
// Größe nach Tiefe (Perspektive), ein gezeichneter Schmetterling und weiche Licht-Texturen.

import { Actor, PIXI, tap, note, fx, rand, pick, clamp } from '../../engine/index.js';

// ---------------------------------------------------------------- Tierkind

/**
 * Tierkind aus dem Wald-Paket (wald/baby_<art>) – nur ein Bild, alle Posen benutzen es (Posenwechsel = kurzes
 * Stauchen). Laut wie die Mama (animal('<art>')).
 */
export class Kind extends Actor {
  constructor(art, opt = {}) {
    super('baby_' + art, { ...opt, pack: 'wald', laut: art });
    this.art = art;
  }

  _texId() {
    return `${this.pack}/${this.tierId}`;
  }
}

/** Mama zu einer Tierkind-Art (das Reh kommt aus dem Wald-Paket). */
export function mamaFuer(art, opt = {}) {
  if (art === 'reh') return new Actor('reh', { ...opt, pack: 'wald' });
  return new Actor(art, opt);
}

// ---------------------------------------------------------------- Laut und Gehen

/** Tierlaut, aber höchstens alle `abstand` Sekunden je Tier (Dauertippen stapelt keine Laute). */
export function laut(tier, abstand = 0.7) {
  if (!tier || tier.destroyed) return;
  const jetzt = performance.now();
  if (jetzt - (tier._lautZeit || -1e9) < abstand * 1000) return;
  tier._lautZeit = jetzt;
  tier.sound();
}

/**
 * Sicher zu (x, y) gehen: Wird das Gehen unterbrochen (z. B. von einem Hüpfer), geht das Tier nach einer kurzen
 * Pause weiter, bis es wirklich ankommt. Solange es geht, ist `tier.geht` gesetzt (jubel() hüpft dann nicht).
 * Ein neuer geheZu-Aufruf für dasselbe Tier löst den alten ab. → Promise<boolean> (true = angekommen)
 */
export async function geheZu(seite, tier, x, y, opt = {}) {
  if (!tier || tier.destroyed) return false;
  const marke = (tier._gehMarke = (tier._gehMarke || 0) + 1);
  tier.geht = true;
  try {
    for (let versuch = 0; versuch < 30; versuch++) {
      if (tier.destroyed || tier._gehMarke !== marke) return false;
      if (await tier.walkTo(x, y, opt)) return !tier.destroyed && tier._gehMarke === marke;
      if (tier.destroyed || tier._gehMarke !== marke) return false;
      await seite.wait(0.3);   // kurz verschnaufen, dann weiter
    }
    return false;
  } finally {
    if (!tier.destroyed && tier._gehMarke === marke) tier.geht = false;
  }
}

// ---------------------------------------------------------------- Freude

/**
 * Tier freut sich: Pose happy, kleiner Hüpfer, ein paar Herzen (an der Seite – gleiten beim Blättern mit), Laut.
 * Erneut während der Freude: nur der Laut. Geht das Tier gerade (geheZu), wackelt es nur und macht seinen Laut –
 * ein Hüpfer würde das Gehen unterbrechen. → Promise (wenn vorbei)
 */
export function jubel(seite, tier, { herzen = 5, laut: mitLaut = true } = {}) {
  if (!tier || tier.destroyed) return Promise.resolve(false);
  if (mitLaut) laut(tier);
  if (tier.geht) {
    fx.wobble(tier, 0.05);
    return Promise.resolve(false);
  }
  if (tier._jubel) return tier._jubel;
  tier.pose('happy');
  if (herzen > 0) {
    const k = tier.point('kopf');
    seite.burst('herzen', k.x, k.y + 40, { count: herzen });
  }
  tier._jubel = (async () => {
    await tier.hop(70);
    await seite.wait(0.8);
    if (!tier.destroyed && tier.poseName === 'happy') tier.pose('idle');
    tier._jubel = null;
    return true;
  })();
  return tier._jubel;
}

// ---------------------------------------------------------------- Denkblase

/**
 * Denkblase wie actor.bubble – steht die Figur rechts (x > rechtsAb), öffnet sie sich nach links, damit sie
 * nicht über den Bildrand oder den Blätter-Pfeil (Szene x ≈ 995…1215, y 690…910) ragt. Die Blase ist rund 400
 * Einheiten breit (Abstand zum Kopf eingerechnet) – ab x 600 reichte sie sonst an den Pfeil.
 */
export function blase(actor, bild, sek = 2.5, rechtsAb = 560) {
  if (!actor || actor.destroyed || !bild) return;
  actor.bubble(bild, sek);
  const b = actor._blase;
  if (b && actor.x > rechtsAb) {
    b.x = -b.x;
    b.scale.x = -Math.abs(b.scale.x);
  }
}

// ---------------------------------------------------------------- Tiefe

/** Größenfaktor nach Tiefe: weiter hinten (kleineres y) etwas kleiner. */
export function tiefe(y, { y0 = 1170, y1 = 1400, f0 = 0.86, f1 = 1.1 } = {}) {
  return clamp(f0 + ((y - y0) / (y1 - y0)) * (f1 - f0), f0 - 0.1, f1 + 0.1);
}

// ---------------------------------------------------------------- Texturen (einmal pro Modul)

function leinwand(w, h, zeichne) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  zeichne(c.getContext('2d'), w, h);
  return PIXI.Texture.from(c);
}

let dunkelTex = null;
/**
 * Nacht-Schleier mit weichem Loch in der Mitte (für die Taschenlampe). Quadrat; das Loch ist bis 3,5 % der
 * Breite ganz klar und ab 9 % ganz dunkel.
 */
export function dunkelTextur() {
  if (!dunkelTex) {
    dunkelTex = leinwand(1024, 1024, (c, g) => {
      const m = g / 2;
      const v = c.createRadialGradient(m, m, 0, m, m, m);
      v.addColorStop(0, 'rgba(8,12,40,0)');
      v.addColorStop(0.07, 'rgba(8,12,40,0)');
      v.addColorStop(0.12, 'rgba(8,12,40,0.22)');
      v.addColorStop(0.18, 'rgba(8,12,40,1)');
      v.addColorStop(1, 'rgba(8,12,40,1)');
      c.fillStyle = v;
      c.fillRect(0, 0, g, g);
    });
  }
  return dunkelTex;
}

let schweifTex = null;
/** Weicher Schweif einer Sternschnuppe (Kopf rechts). */
export function schweifTextur() {
  if (!schweifTex) {
    schweifTex = leinwand(512, 64, (c, w, h) => {
      const v = c.createLinearGradient(0, 0, w, 0);
      v.addColorStop(0, 'rgba(255,250,225,0)');
      v.addColorStop(0.8, 'rgba(255,250,225,0.45)');
      v.addColorStop(1, 'rgba(255,252,235,0.9)');
      c.fillStyle = v;
      c.beginPath();
      c.moveTo(0, h / 2);
      c.quadraticCurveTo(w * 0.7, h * 0.2, w - h / 2, h * 0.22);
      c.arc(w - h / 2, h / 2, h * 0.28, -Math.PI / 2, Math.PI / 2);
      c.quadraticCurveTo(w * 0.7, h * 0.8, 0, h / 2);
      c.fill();
      const k = c.createRadialGradient(w - h / 2, h / 2, 0, w - h / 2, h / 2, h / 2);
      k.addColorStop(0, 'rgba(255,255,245,1)');
      k.addColorStop(1, 'rgba(255,255,245,0)');
      c.fillStyle = k;
      c.fillRect(w - h, 0, h, h);
    });
  }
  return schweifTex;
}

// ---------------------------------------------------------------- Schmetterling

const FLUEGEL = [
  [0xf7b6c8, 0xe58aa6], [0xffd98a, 0xf2b14c], [0xb9dcf5, 0x7fb6e3], [0xcbb8f0, 0x9f86d8],
];

function fluegel(seite, farbe) {
  const [hell, dunkel] = farbe;
  const g = new PIXI.Graphics();
  const s = seite; // +1 rechts, -1 links
  g.ellipse(s * 30, -20, 32, 26).fill(hell).stroke({ width: 4, color: dunkel });
  g.ellipse(s * 22, 18, 20, 17).fill(hell).stroke({ width: 4, color: dunkel });
  g.circle(s * 34, -24, 7).fill({ color: 0xffffff, alpha: 0.85 });
  g.circle(s * 20, 20, 5).fill({ color: 0xffffff, alpha: 0.7 });
  return g;
}

/**
 * Kleiner gezeichneter Schmetterling: gaukelt langsam in einem Bereich umher, schlägt ruhig mit den Flügeln.
 * Antippen → flattert auf (kleiner Bogen nach oben) und kommt zurück, ein leiser Glockenton.
 * Mit {weg: true} fliegt er davon und verschwindet (für „aus dem Busch aufgeflogen").
 */
export class Schmetterling extends PIXI.Container {
  constructor(seite, { x, y, bereich, parent, groesse = 1, z = 4000 }) {
    super({ label: 'schmetterling' });
    this.seite = seite;
    this.bereich = bereich; // {x0, x1, y0, y1}
    this.position.set(x, y);
    this.zIndex = z;
    const farbe = pick(FLUEGEL);
    this.links = fluegel(-1, farbe);
    this.rechts = fluegel(1, farbe);
    const koerper = new PIXI.Graphics()
      .ellipse(0, 0, 7, 26).fill(0x6a4a3a)
      .moveTo(-2, -24).quadraticCurveTo(-10, -44, -16, -46).stroke({ width: 3, color: 0x6a4a3a })
      .moveTo(2, -24).quadraticCurveTo(10, -44, 16, -46).stroke({ width: 3, color: 0x6a4a3a });
    this.flug = new PIXI.Container();
    this.flug.addChild(this.links, this.rechts, koerper);
    this.flug.scale.set(groesse);
    this.addChild(this.flug);
    this.ziel = { x, y };
    this.tempo = 55;
    this.phase = rand(0, 10);
    this.eile = 0;      // Sekunden schneller Flug nach dem Antippen
    this.davon = false; // fliegt weg und verschwindet
    parent.addChild(this);
    this.hitArea = new PIXI.Circle(0, 0, 125);
    tap(this, () => this.aufgescheucht(), { sound: null, squash: false, hitArea: new PIXI.Circle(0, 0, 125) });
    this._neuesZiel();
  }

  _neuesZiel() {
    const b = this.bereich;
    this.ziel = { x: rand(b.x0, b.x1), y: rand(b.y0, b.y1) };
  }

  aufgescheucht() {
    note('glocke', pick([84, 88, 91]), { vol: 0.25 });
    this.eile = 1.4;
    this.ziel = { x: this.x + rand(-160, 160), y: Math.max(160, this.y - rand(160, 260)) };
  }

  /** Davonfliegen (nach oben aus dem Bild) und verschwinden. */
  fliegDavon(richtung = 1) {
    this.davon = true;
    this.eventMode = 'none';
    this.eile = 99;
    this.ziel = { x: this.x + richtung * rand(500, 800), y: -150 };
  }

  update(dt) {
    if (this.destroyed) return;
    this.phase += dt;
    // ruhiger Flügelschlag (etwa 3 Schläge pro Sekunde, schneller nur kurz beim Auffliegen)
    const f = this.eile > 0 ? 5 : 3;
    const s = 0.35 + 0.65 * Math.abs(Math.cos(this.phase * Math.PI * f));
    this.links.scale.x = s;
    this.rechts.scale.x = s;
    this.eile = Math.max(0, this.eile - dt);
    const tempo = this.eile > 0 ? 190 : this.tempo;
    const dx = this.ziel.x - this.x;
    const dy = this.ziel.y - this.y;
    const d = Math.hypot(dx, dy);
    if (d < 20) {
      if (this.davon) {
        this.destroy({ children: true });
        return;
      }
      if (this.eile <= 0) this._neuesZiel();
      else this.ziel = { x: this.x + rand(-80, 80), y: this.y + rand(40, 90) };
      return;
    }
    const k = Math.min(1, (tempo * dt) / d);
    this.x += dx * k;
    // leichtes Auf und Ab beim Gaukeln
    this.y += dy * k + Math.sin(this.phase * 2.2) * 22 * dt;
    this.flug.rotation = clamp(dx / Math.max(1, d), -1, 1) * 0.25;
    if (this.davon && this.y < -100) this.destroy({ children: true });
  }
}
