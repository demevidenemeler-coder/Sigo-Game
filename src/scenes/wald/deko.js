// Gemeinsames für die Wald-Seiten: Tierkinder als Figuren, ruhige Freude mit Herzen an der Seite,
// Größe nach Tiefe (Perspektive), ein gezeichneter Schmetterling und weiche Licht-Texturen.

import { Actor, PIXI, tap, note, fx, store, rand, pick, shuffle, clamp } from '../../engine/index.js';
import { gesammelt, hatBild } from '../../gemeinsam/sticker.js';

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
 * (Die Seite wird beim Aufruf fest gewählt – nachträgliches Spiegeln hob das Größen-Tween der Blase wieder auf.)
 */
export function blase(actor, bild, sek = 2.5, rechtsAb = 560) {
  if (!actor || actor.destroyed || !bild) return;
  actor.bubble(bild, sek, actor.x > rechtsAb ? { seite: 'links' } : {});
}

// ---------------------------------------------------------------- Abwechslung

/**
 * n Arten wählen, am liebsten die, die am längsten nicht dran waren (gleich lange: zufällig). So kommt jede Art
 * regelmäßig vor, und dieselbe Gruppe kehrt nicht dauernd wieder. Der Stand bleibt gespeichert (`speicher`), damit
 * auch der nächste Besuch mit anderen Tieren beginnt.
 */
export function waehleArten(alle, n, speicher) {
  let zuletzt = store.get(speicher, {});
  if (!zuletzt || typeof zuletzt !== 'object' || Array.isArray(zuletzt)) zuletzt = {};
  const runde = (Number(zuletzt._runde) || 0) + 1;
  const wann = (a) => Number(zuletzt[a]) || 0;
  const wieOft = (a) => Number(zuletzt['#' + a]) || 0;
  // zuerst: am längsten nicht dran; gleich lange: seltener dran gewesen; sonst Zufall
  const reihe = shuffle(alle).sort((a, b) => wann(a) - wann(b) || wieOft(a) - wieOft(b));
  const gewaehlt = shuffle(reihe.slice(0, n));
  for (const a of gewaehlt) { zuletzt[a] = runde; zuletzt['#' + a] = wieOft(a) + 1; }
  zuletzt._runde = runde;
  store.set(speicher, zuletzt);
  return gewaehlt;
}

/** Rundensticker: am liebsten einer, den das Kind noch nicht hat (sonst irgendeiner aus der Liste). */
export function waehleSticker(kandidaten) {
  const da = new Set(gesammelt());
  const mitBild = kandidaten.filter((id) => hatBild(id));
  const liste = mitBild.length ? mitBild : kandidaten;
  const neu = liste.filter((id) => !da.has(id));
  return pick(neu.length ? neu : liste);
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

// ---------------------------------------------------------------- Flüge im Bogen

// Ruhe-Regel: nichts rast quer über das Bild – Flüge höchstens so schnell (Einheiten/s)
export const FLUG_SPITZE = 1300;

/**
 * Flugdauer: `min` Sekunden oder mehr – so lang, dass ein Ding auf einem Bogen (sineInOut, Höhe `hoehe`) nirgends
 * schneller als FLUG_SPITZE fliegt.
 */
export function flugDauer(von, nach, min, hoehe = 0) {
  const dx = nach.x - von.x;
  const dy = nach.y - von.y;
  // Bahn: k = (1 − cos πu)/2 (sineInOut), Ort = von + d·k − (0, 4·hoehe·k(1−k)); Tempo = |dOrt/dk| · dk/du
  let spitze = 0;
  for (let i = 1; i < 64; i++) {
    const u = i / 64;
    const k = (1 - Math.cos(Math.PI * u)) / 2;
    const v = Math.hypot(dx, dy - hoehe * 4 * (1 - 2 * k)) * (Math.PI / 2) * Math.sin(Math.PI * u);
    if (v > spitze) spitze = v;
  }
  spitze *= 1.03;   // Sicherheitsrand zwischen den Stützstellen
  return Math.max(min, spitze / FLUG_SPITZE);
}

/** Ding fliegt im Bogen nach `nach` (Koordinaten seines Eltern-Containers); Größe gleitet zu `skala`. → Promise */
export function bogen(seite, obj, nach, { dauer = 0.6, hoehe = 150, skala = null } = {}) {
  const von = { x: obj.x, y: obj.y };
  const s0 = Math.abs(obj.scale.y);
  const p = { k: 0 };
  return seite.tween(p, { k: 1 }, flugDauer(von, nach, dauer, hoehe), {
    ease: 'sineInOut',
    onUpdate: () => {
      if (obj.destroyed) return;
      const k = p.k;
      obj.x = von.x + (nach.x - von.x) * k;
      obj.y = von.y + (nach.y - von.y) * k - hoehe * 4 * k * (1 - k);
      if (skala !== null) obj.scale.set(s0 + (skala - s0) * k);
    },
  });
}

/** Tippfläche einer Figur (wie Actor.onTap): Rechteck um das Bild, `pad` Einheiten Rand. */
export function figurFlaeche(a, pad = 40) {
  const t = a.sprite.texture;
  const ax = a.sprite.anchor.x;
  const ay = a.sprite.anchor.y;
  const halb = t.width * Math.max(ax, 1 - ax);
  const p = pad / Math.max(0.05, Math.abs(a.scale.x));
  return new PIXI.Rectangle(-halb - p, -ay * t.height - p, 2 * (halb + p), t.height + 2 * p);
}

// ---------------------------------------------------------------- Spuren im Boden

// Welche Abdrücke ein Tier macht
const SPUR_ART = { fuchs: 'pfote', baer: 'tatze', igel: 'klein', eichhoernchen: 'klein', hase: 'hase', reh: 'huf', eule: 'vogel', maus: 'klein' };
const SPUR_FARBE = 0x6b4a2b;

// Ein Abdruck bei (x, y), „vorn" = −y
function abdruck(g, art, x, y) {
  const f = { color: SPUR_FARBE, alpha: 0.62 };
  if (art === 'huf') {
    g.ellipse(x - 7, y, 6.5, 16).fill(f);
    g.ellipse(x + 7, y, 6.5, 16).fill(f);
  } else if (art === 'vogel') {
    g.moveTo(x, y + 10).lineTo(x - 13, y - 12)
      .moveTo(x, y + 10).lineTo(x, y - 17)
      .moveTo(x, y + 10).lineTo(x + 13, y - 12)
      .moveTo(x, y + 10).lineTo(x, y + 20)
      .stroke({ width: 6, color: SPUR_FARBE, alpha: 0.62, cap: 'round' });
  } else if (art === 'hase') {
    g.ellipse(x, y + 4, 9, 19).fill(f);
    for (const [dx, dy] of [[-8, -19], [-3, -24], [3, -24], [8, -19]]) g.circle(x + dx, y + dy, 4).fill(f);
  } else {
    const k = art === 'tatze' ? 1.3 : art === 'klein' ? 0.78 : 1;
    g.ellipse(x, y + 6 * k, 15 * k, 12 * k).fill(f);
    const zehen = art === 'tatze'
      ? [[-18, -6], [-10, -16], [0, -20], [10, -16], [18, -6]]
      : [[-14, -10], [-5, -18], [5, -18], [14, -10]];
    for (const [dx, dy] of zehen) g.circle(x + dx * k, y + dy * k, (art === 'tatze' ? 5.5 : 6) * k).fill(f);
  }
}

/**
 * Ein Schritt einer Tierspur (zwei Abdrücke nebeneinander), flach auf dem Boden, in Richtung `winkel` (Bogenmaß,
 * Bildschirm-Richtung). Mit weichem hellem Schein dahinter (`schritt.schein`), der den nächsten Schritt zeigt.
 */
export function spurSchritt(tierArt, winkel, groesse = 1) {
  const art = SPUR_ART[tierArt] || 'pfote';
  const c = new PIXI.Container({ label: 'spur:' + tierArt });
  const schein = new PIXI.Graphics().circle(0, 0, 95).fill({ color: 0xfff3c4, alpha: 0.55 });
  schein.scale.y = 0.55;
  schein.alpha = 0;
  const boden = new PIXI.Container();
  boden.scale.set(groesse, groesse * 0.58);   // flach auf dem Boden
  const g = new PIXI.Graphics();
  // Richtung auf dem Boden (vor dem Plattdrücken): y-Anteil strecken
  const vorn = Math.atan2(Math.sin(winkel) / 0.58, Math.cos(winkel));
  g.rotation = vorn + Math.PI / 2;
  abdruck(g, art, -17, 12);
  abdruck(g, art, 17, -16);
  boden.addChild(g);
  c.addChild(schein, boden);
  c.schein = schein;
  c.abdruck = g;
  return c;
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
