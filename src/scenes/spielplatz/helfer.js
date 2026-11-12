// Kleine Helfer für den Spielplatz: Freude einer Figur (Herzen gleiten mit der Seite), Teil-Texturen aus
// einem Bild, Bildpunkte, und die ruhigen Nebensachen (Wolken, Schmetterling, Vogel).

import { tex, hasTex, meta, tap, fx, sfx, note, animal, rand, pick, clamp, store, PIXI } from '../../engine/index.js';
import { stickerFuerOrt } from '../../gemeinsam/sticker.js';

// ---------------------------------------------------------------- Freude

/**
 * Figur freut sich: Pose 'happy', kleiner Hüpfer, ein paar Herzen – die Herzen liegen in seite.vorn und gleiten
 * beim Blättern mit (actor.cheer() legt sie in die Szene). Erneut während der Freude: nur der Laut.
 * → Promise<boolean>
 */
export function freude(seite, a, { laut = true, herzen = 5, hoehe = 70 } = {}) {
  if (!a || a.destroyed) return Promise.resolve(false);
  if (a._spFreude) {
    if (laut) a.sound();
    return a._spFreude;
  }
  a.pose('happy');
  if (laut) a.sound();
  if (herzen > 0) {
    const k = inVorn(seite, a.parent, a.point('kopf'));
    if (k) seite.burst('herzen', k.x, k.y + 30, { count: herzen });
  }
  const p = (async () => {
    const ok = await a.hop(hoehe);
    if (ok) await seite.wait(0.6);
    if (!a.destroyed && a.poseName === 'happy') a.pose('idle');
    return ok;
  })().then((ok) => {
    if (a._spFreude === p) a._spFreude = null;
    return ok;
  });
  a._spFreude = p;
  return p;
}

/** Punkt aus Koordinaten von `von` (Container) in Koordinaten von seite.vorn */
export function inVorn(seite, von, p) {
  if (!von || von.destroyed || !p) return null;
  const g = von.toGlobal(p);
  return seite.vorn.toLocal(g);
}

/**
 * Unsichtbarer Merkpunkt für die Zeige-Hand: hints() nimmt bei Ziehbewegungen nur Dinge, die im Baum hängen
 * und sichtbar sind – ein reiner {x, y}-Punkt fällt dort durch. → Graphics (setze .position)
 */
export function merker(parent) {
  const g = new PIXI.Graphics().circle(0, 0, 6).fill({ color: 0xffffff, alpha: 0.001 });
  g.eventMode = 'none';
  g.label = 'merker';
  parent.addChild(g);
  return g;
}

// ---------------------------------------------------------------- Bilder

/**
 * Bildpunkt (px, py in Bildpunkten des fertigen Bildes, wie pts in pack.json) eines Sprites → Koordinaten
 * seines Eltern-Containers. Berücksichtigt Anker, Größe, Ort und Drehung.
 */
export function bildPunkt(sprite, px, py) {
  const m = meta(sprite.label);
  const t = sprite.texture;
  const w = m.w || t.width;
  const h = m.h || t.height;
  const lx = (px / w - sprite.anchor.x) * t.width;
  const ly = (py / h - sprite.anchor.y) * t.height;
  sprite.updateLocalTransform();
  const q = sprite.localTransform.apply(new PIXI.Point(lx, ly));
  return { x: q.x, y: q.y };
}

// Teil-Texturen (Ausschnitte eines Bildes) – einmal je Bildquelle angelegt und wiederverwendet
const teile = new Map(); // schlüssel → { source, texture }

/** Ausschnitt (x, y, w, h in Bildpunkten des fertigen Bildes) aus 'pack/bild' als eigene Textur. */
export function teilTextur(id, x, y, w, h) {
  if (!hasTex(id)) return tex(id);
  const t = tex(id);
  const schluessel = `${id}|${x},${y},${w},${h}`;
  const alt = teile.get(schluessel);
  if (alt && alt.source === t.source && !alt.texture.destroyed) return alt.texture;
  const m = meta(id);
  const f = t.frame;
  const kx = f.width / (m.w || f.width);
  const ky = f.height / (m.h || f.height);
  const texture = new PIXI.Texture({
    source: t.source,
    frame: new PIXI.Rectangle(f.x + x * kx, f.y + y * ky, w * kx, h * ky),
  });
  teile.set(schluessel, { source: t.source, texture });
  return texture;
}

// ---------------------------------------------------------------- Sticker

/** Nächster noch nicht gesammelter Sticker des Spielplatzes (sonst der erste → nur ein leiser Gruß). */
export function naechsterSticker() {
  const liste = stickerFuerOrt('spielplatz');
  const da = new Set(store.stickers?.() || []);
  const neu = liste.find((s) => !da.has(s.id));
  return (neu || liste[0])?.id || 'spielplatz_ballon';
}

/**
 * Sticker einer Tätigkeit: gibt es 'spielplatz_<art>' (z. B. rutsche, schatz), gehört er fest zu ihr;
 * sonst (noch nicht im Sticker-Baustein) der nächste freie des Spielplatzes.
 */
export function stickerFuer(art) {
  const id = 'spielplatz_' + art;
  if (stickerFuerOrt('spielplatz').some((s) => s.id === id)) return id;
  return naechsterSticker();
}

// ---------------------------------------------------------------- Wolken

/**
 * Ein paar Wolken ziehen langsam über den Himmel (in seite.hinten, vor dem gemalten Hintergrund).
 * liste: [{bild, x, y, scale, v, alpha}] → Objekt mit update(dt)
 */
export function wolken(seite, liste) {
  const ws = liste.map((o) => {
    const s = new PIXI.Sprite(tex('common/' + o.bild));
    s.anchor.set(0.5);
    s.label = 'wolke';
    s.position.set(o.x, o.y);
    s.scale.set(o.scale);
    s.alpha = o.alpha ?? 0.92;
    s.zIndex = -900;
    seite.hinten.addChild(s);
    s.v = o.v;
    // Tippfläche mindestens ~320 Einheiten groß (Wolken sind flach)
    const tw = s.texture.width;
    const th = s.texture.height;
    const mind = 320 / o.scale;
    const fw = Math.max(tw, mind);
    const fh = Math.max(th, mind);
    tap(s, () => {
      fx.pop(s, 0.06);
      sfx('common/wusch', { vol: 0.22, rate: 0.8 });
    }, { sound: null, squash: false, hitArea: new PIXI.Rectangle(-fw / 2, -fh / 2, fw, fh) });
    return s;
  });
  return {
    sprites: ws,
    update(dt) {
      for (const s of ws) {
        s.x += s.v * dt;
        const halb = (s.texture.width * s.scale.x) / 2;
        if (s.x - halb > 1500) s.x = -1500 - halb;
      }
    },
  };
}

// ---------------------------------------------------------------- Schmetterling (gezeichnet)

const FLUEGEL_FARBEN = [
  [0xffb347, 0xe58a2a], // orange
  [0x8fc9f2, 0x5a9fd1], // hellblau
  [0xf7a8c8, 0xd9739e], // rosa
];

function fluegel(farbe, rand_, richtung) {
  const g = new PIXI.Graphics();
  const s = richtung; // -1 links, +1 rechts
  g.ellipse(s * 30, -16, 30, 24).fill(farbe).stroke({ width: 4, color: rand_ });
  g.ellipse(s * 20, 16, 19, 16).fill(farbe).stroke({ width: 4, color: rand_ });
  g.circle(s * 36, -20, 8).fill({ color: 0xffffff, alpha: 0.85 });
  g.circle(s * 22, 18, 5).fill({ color: 0xffffff, alpha: 0.8 });
  return g;
}

/** Ein ruhiger Schmetterling, der über einem Bereich gaukelt. Antippen → flattert woandershin (+ leiser Ton). */
export class Schmetterling extends PIXI.Container {
  constructor(seite, { x, y, bereich, farbe = 0, z = 60, scale = 1 }) {
    super({ label: 'schmetterling' });
    this.seite = seite;
    this.bereich = bereich; // {x0, x1, y0, y1}
    const [f, r] = FLUEGEL_FARBEN[farbe % FLUEGEL_FARBEN.length];
    this.links = fluegel(f, r, -1);
    this.rechts = fluegel(f, r, 1);
    const koerper = new PIXI.Graphics()
      .ellipse(0, 2, 7, 24).fill(0x6b4a33)
      .moveTo(-3, -20).quadraticCurveTo(-10, -36, -16, -40).stroke({ width: 3, color: 0x6b4a33, cap: 'round' })
      .moveTo(3, -20).quadraticCurveTo(10, -36, 16, -40).stroke({ width: 3, color: 0x6b4a33, cap: 'round' })
      .circle(-16, -40, 4).fill(0x6b4a33)
      .circle(16, -40, 4).fill(0x6b4a33);
    this.huelle = new PIXI.Container();
    this.huelle.addChild(this.links, this.rechts, koerper);
    this.addChild(this.huelle);
    this.position.set(x, y);
    this.scale.set(scale);
    this.zIndex = z;
    this.ziel = { x, y };
    this.tempo = 55;
    this.phase = rand(0, 6);
    this.zeit = rand(0, 10);
    this.ruhe = rand(1, 3);  // Sekunden bis zum nächsten Ziel
    this.eilig = 0;
    this.hitArea = new PIXI.Circle(0, 0, 130 / scale);
    seite.welt.addChild(this);
    tap(this, () => this.aufscheuchen(), { sound: null, squash: false, hitArea: this.hitArea });
    this.neuesZiel();
  }

  neuesZiel(weit = false) {
    const b = this.bereich;
    let x;
    let y;
    for (let i = 0; i < 6; i++) {
      x = rand(b.x0, b.x1);
      y = rand(b.y0, b.y1);
      if (!weit || Math.hypot(x - this.x, y - this.y) > 400) break;
    }
    this.ziel = { x, y };
  }

  aufscheuchen() {
    note('pling', pick([79, 81, 84, 86]), { vol: 0.3 });
    this.eilig = 2.2;
    this.neuesZiel(true);
  }

  update(dt) {
    this.zeit += dt;
    const dx = this.ziel.x - this.x;
    const dy = this.ziel.y - this.y;
    const d = Math.hypot(dx, dy);
    this.eilig = Math.max(0, this.eilig - dt);
    const tempo = this.eilig > 0 ? 150 : this.tempo;
    if (d > 8) {
      const k = Math.min(1, (tempo * dt) / d);
      this.x += dx * k;
      this.y += dy * k + Math.sin(this.zeit * 3.1) * 18 * dt;
      // Blickrichtung: leicht schräg in Flugrichtung
      this.huelle.rotation += ((clamp(dx / 400, -0.35, 0.35)) - this.huelle.rotation) * Math.min(1, dt * 3);
    } else {
      this.ruhe -= dt;
      if (this.ruhe <= 0) {
        this.ruhe = rand(1.5, 4);
        this.neuesZiel();
      }
    }
    // Flügelschlag: ruhig (≈1,4 Hz), beim Sitzen langsamer
    this.phase += dt * (d > 8 ? 8.5 : 3);
    const s = 0.3 + 0.7 * Math.abs(Math.cos(this.phase));
    this.links.scale.x = s;
    this.rechts.scale.x = s;
  }
}

// ---------------------------------------------------------------- Vogel (gezeichnet)

/** Kleiner runder Vogel, der ab und zu gemächlich über den Himmel fliegt. Antippen → zwitschert, kleiner Bogen. */
export class Vogel extends PIXI.Container {
  constructor(seite, { y0 = 300, y1 = 520, z = 22, pause = [16, 30] } = {}) {
    super({ label: 'vogel' });
    this.seite = seite;
    this.y0 = y0;
    this.y1 = y1;
    this.pauseBereich = pause;
    const g = new PIXI.Graphics()
      .ellipse(-34, 4, 20, 10).fill(0x4f86c6)                     // Schwanz
      .circle(0, 0, 34).fill(0x6fa8dc)                            // Körper
      .ellipse(6, 12, 22, 16).fill(0xfdf3e3)                      // Bauch
      .poly([30, -4, 50, 2, 30, 9]).fill(0xf5a623)                // Schnabel
      .circle(16, -10, 6).fill(0x2b2b2b)                          // Auge
      .circle(18, -12, 2).fill(0xffffff)
      .circle(12, 2, 5).fill({ color: 0xff9aa8, alpha: 0.7 });    // Bäckchen
    this.fluegel = new PIXI.Graphics().ellipse(0, -12, 24, 14).fill(0x4f86c6);
    this.fluegel.position.set(-6, -2);
    this.koerper = new PIXI.Container();
    this.koerper.addChild(g, this.fluegel);
    this.addChild(this.koerper);
    this.zIndex = z;
    this.scale.set(1.2);
    this.visible = false;
    this.fliegt = false;
    this.warte = rand(5, 10);
    this.zeit = 0;
    this.hopser = 0;
    this.hitArea = new PIXI.Circle(0, 0, 120);
    seite.welt.addChild(this);
    tap(this, () => this.zwitschern(), { sound: null, squash: false, hitArea: this.hitArea });
  }

  zwitschern() {
    animal('vogel');
    this.hopser = 1;
  }

  start() {
    this.richtung = Math.random() < 0.5 ? 1 : -1;
    this.x = -1500 * this.richtung;
    this.basisY = rand(this.y0, this.y1);
    this.y = this.basisY;
    this.koerper.scale.x = this.richtung;
    this.visible = true;
    this.fliegt = true;
  }

  update(dt) {
    this.zeit += dt;
    if (!this.fliegt) {
      this.warte -= dt;
      if (this.warte <= 0) this.start();
      return;
    }
    this.x += this.richtung * 150 * dt;
    this.hopser = Math.max(0, this.hopser - dt * 1.2);
    const bogen = Math.sin((1 - this.hopser) * Math.PI) * (this.hopser > 0 ? 70 : 0);
    this.y = this.basisY + Math.sin(this.zeit * 1.6) * 22 - bogen;
    this.fluegel.rotation = Math.sin(this.zeit * 14) * 0.5;
    if (Math.abs(this.x) > 1520) {
      this.fliegt = false;
      this.visible = false;
      this.warte = rand(this.pauseBereich[0], this.pauseBereich[1]);
    }
  }
}
