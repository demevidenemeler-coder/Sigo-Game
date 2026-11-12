// Kleine Helfer für den Garten: gezeichneter Vogel, ruhig fliegende Tierchen (Biene, Schmetterlinge),
// ziehende Wolken, Umhängen in einen anderen Container und ein weicher Bogenflug.

import { spr, tex, meta, tap, sfx, note, animal, fx, rand, pick, clamp, PIXI } from '../../engine/index.js';

// ---------------------------------------------------------------- allgemeine Hilfen

/** Ding in einen anderen Container hängen, ohne dass es auf dem Bildschirm springt. */
export function umhängen(obj, ziel) {
  if (!obj || obj.destroyed || !ziel || obj.parent === ziel) return obj;
  const g = obj.getGlobalPosition();
  const p = ziel.toLocal(g);
  ziel.addChild(obj);
  obj.position.set(p.x, p.y);
  return obj;
}

/** Skala, mit der ein Bild höchstens `höhe` hoch und `breite` breit wird (nie über 1,3-fach). */
export function skalaFür(id, höhe, breite = Infinity) {
  const m = meta(id);
  const w = m.w || tex(id).width || 1;
  const h = m.h || tex(id).height || 1;
  return Math.min(höhe / h, breite / w, 1.3);
}

/**
 * Mittleres Tempo eines Flugs oder Gleitens (Einheiten/s). Mit sineInOut liegt die Spitze beim 1,57-Fachen
 * (≈ 1500 Einheiten/s) – so rast nichts quer über das Bild, egal wie weit der Weg ist.
 */
export const BOGEN_TEMPO = 950;

/**
 * Dauer eines geraden Gleitens um (dx, dy): mindestens `min` Sekunden, bei weitem Weg länger.
 * `spitze` = Spitze der Kurve im Verhältnis zum Mittel (sineInOut 1,57; cubicOut 3).
 */
export function gleitDauer(dx, dy, min, spitze = Math.PI / 2) {
  return Math.max(min, (Math.hypot(dx, dy) * spitze) / (BOGEN_TEMPO * Math.PI / 2));
}

/** Länge des Bogens von (x0, y0) nach (x1, y1) mit Scheitelhöhe `höhe` (Einheiten, grob abgetastet). */
function bogenLänge(x0, y0, x1, y1, höhe) {
  let weg = 0;
  let px = x0;
  let py = y0;
  for (let i = 1; i <= 16; i++) {
    const p = i / 16;
    const qx = x0 + (x1 - x0) * p;
    const qy = y0 + (y1 - y0) * p - höhe * 4 * p * (1 - p);
    weg += Math.hypot(qx - px, qy - py);
    px = qx;
    py = qy;
  }
  return weg;
}

/**
 * Weicher Flug im Bogen nach (x, y) (Koordinaten des Eltern-Containers). seite = Seite oder Szene (tween).
 * {dauer, höhe, skala (Endgröße absolut), dreh} → Promise<boolean>
 * `dauer` ist die kürzeste Flugzeit: Ein weiter Weg dauert länger (im Mittel höchstens BOGEN_TEMPO Einheiten/s),
 * damit nichts quer über das Bild rast (Ruhe-Regel).
 */
export function bogen(seite, obj, x, y, { dauer = 0.6, höhe = 120, skala = null, dreh = 0 } = {}) {
  const von = { x: obj.x, y: obj.y, s: Math.abs(obj.scale.y), r: obj.rotation };
  // Alle Bögen laufen in den Seiten-Ebenen (welt, vorn), die nicht skaliert sind: Einheiten = Bühnen-Einheiten
  const weg = bogenLänge(von.x, von.y, x, y, höhe);
  dauer = Math.max(dauer, weg / BOGEN_TEMPO);
  const proxy = { p: 0 };
  return seite.tween(proxy, { p: 1 }, dauer, {
    ease: 'sineInOut',
    onUpdate: () => {
      if (obj.destroyed) return;
      const p = proxy.p;
      obj.x = von.x + (x - von.x) * p;
      obj.y = von.y + (y - von.y) * p - höhe * 4 * p * (1 - p);
      if (skala !== null) obj.scale.set(von.s + (skala - von.s) * p);
      obj.rotation = von.r + dreh * p;
    },
  });
}

// ---------------------------------------------------------------- Vogel (gezeichnet)

/**
 * Kleiner runder Vogel (weiche Formen wie die Knete-Figuren), schaut nach rechts. Ursprung = Füße.
 */
export function zeichneVogel({ farbe = 0x6fa8dc, dunkel = 0x4c82bd, bauch = 0xfff1dc } = {}) {
  const c = new PIXI.Container({ label: 'vogel' });
  const körper = new PIXI.Container();
  const g = new PIXI.Graphics();
  // Schwanzfedern
  g.roundPoly(-62, -40, 26, 3, 10, Math.PI * 0.95).fill(dunkel);
  // Beinchen
  g.moveTo(-8, -18).lineTo(-12, 0).stroke({ width: 6, color: 0xe59a3a, cap: 'round' });
  g.moveTo(10, -18).lineTo(12, 0).stroke({ width: 6, color: 0xe59a3a, cap: 'round' });
  // weicher Schatten unter dem Körper
  g.ellipse(4, -50, 62, 52).fill({ color: 0x2c4a70, alpha: 0.12 });
  // Körper und Kopf (eine runde Form)
  g.ellipse(0, -56, 60, 50).fill(farbe);
  g.circle(30, -92, 34).fill(farbe);
  // Bauch
  g.ellipse(14, -44, 38, 30).fill(bauch);
  // Flügel
  g.ellipse(-18, -58, 34, 22).fill(dunkel);
  g.ellipse(-14, -62, 22, 10).fill({ color: 0xffffff, alpha: 0.18 });
  // Glanz auf dem Kopf (Licht von oben links)
  g.ellipse(18, -112, 14, 8).fill({ color: 0xffffff, alpha: 0.35 });
  // Schnabel
  g.roundPoly(66, -88, 13, 3, 4, 0).fill(0xf2a23a);
  // Auge mit Glanzpunkt, Bäckchen
  g.circle(40, -98, 9).fill(0x2a2018);
  g.circle(43, -101, 3.2).fill(0xffffff);
  g.ellipse(40, -78, 9, 6).fill({ color: 0xff9aa6, alpha: 0.75 });
  körper.addChild(g);
  c.addChild(körper);
  c.körper = körper;
  return c;
}

/**
 * Vogel, der auf einer Stange (Zaun, Ast) sitzt, atmet, ab und zu zur Seite hüpft und beim Antippen
 * piepst und hochhüpft. bereich = [xMin, xMax] auf der Stange (y fest).
 */
export class Vogel {
  constructor(seite, { x, y, bereich, scale = 1, parent, z = 200, farbe, dunkel, bauch }) {
    this.seite = seite;
    this.bereich = bereich || [x - 100, x + 100];
    this.c = zeichneVogel({ farbe, dunkel, bauch });
    this.c.position.set(x, y);
    this.c.scale.set(scale);
    this.c.zIndex = z;
    this.basis = scale;
    this.zeit = rand(0, 5);
    this.nächstes = rand(5, 9);
    this.hüpft = false;
    (parent || seite.welt).addChild(this.c);
    // Tippfläche großzügig (der Vogel ist klein): 240 × 240 Einheiten
    const r = 120 / scale;
    this.c.hitArea = new PIXI.Rectangle(-r, -2 * r + 30 / scale, 2 * r, 2 * r);
    tap(this.c, () => this.piepen(), { sound: null, squash: false });
  }

  piepen() {
    animal('vogel');
    this.hupf(0);
  }

  // kleiner Hüpfer (dx = seitlich)
  async hupf(dx) {
    if (this.hüpft) return;
    this.hüpft = true;
    const k = this.c.körper;
    const x0 = this.c.x;
    const x1 = clamp(x0 + dx, this.bereich[0], this.bereich[1]);
    if (Math.abs(x1 - x0) > 4) this.c.scale.x = (x1 > x0 ? 1 : -1) * this.basis;
    const proxy = { p: 0 };
    await this.seite.tween(proxy, { p: 1 }, 0.42, {
      ease: 'linear',
      onUpdate: () => {
        const p = proxy.p;
        this.c.x = x0 + (x1 - x0) * p;
        k.y = -55 * 4 * p * (1 - p);
      },
    });
    k.y = 0;
    this.hüpft = false;
  }

  update(dt) {
    this.zeit += dt;
    // Atmen
    this.c.körper.scale.y = 1 + 0.025 * Math.sin(this.zeit * 2.4);
    this.nächstes -= dt;
    if (this.nächstes <= 0) {
      this.nächstes = rand(6, 11);
      if (Math.random() < 0.35) this.c.scale.x = -this.c.scale.x; // umschauen
      else this.hupf(pick([-1, 1]) * rand(70, 140));
    }
  }
}

// ---------------------------------------------------------------- Flieger (Biene, Schmetterling)

/**
 * Ein ruhig fliegendes Tierchen. Es fliegt weich zu Zielen, die `wähleZiel(flieger)` liefert
 * ({x, y, sitzen, dauer, ding}); sitzt es, wartet es `dauer` Sekunden. Antippen → flattert auf.
 * art 'biene' (Seitenansicht, schaut nach rechts) oder 'falter' (von oben, Flügelschlag).
 */
export class Flieger {
  constructor(seite, id, { x, y, maß = 140, art = 'falter', tempo = 100, z = 400, parent, wähleZiel }) {
    this.seite = seite;
    this.art = art;
    this.tempo = tempo;
    this.wähleZiel = wähleZiel;
    this.c = new PIXI.Container({ label: 'flieger:' + id });
    this.c.zIndex = z;
    this.c.position.set(x, y);
    this.sprite = spr(id, { anchor: 0.5, parent: this.c });
    this.s = maß / Math.max(this.sprite.texture.width, this.sprite.texture.height);
    this.sprite.scale.set(this.s);
    (parent || seite.welt).addChild(this.c);
    this.vx = 0;
    this.vy = 0;
    this.phase = rand(0, 6);
    this.wipp = rand(0, 6);
    this.ziel = null;
    this.sitzt = 0;          // Restzeit auf dem Ziel
    this.eile = 1;           // > 1 kurz nach dem Aufflattern
    this.puls = 0;           // kurzes Größer-Werden beim Antippen (update() rechnet es ein)
    this.c.hitArea = new PIXI.Circle(0, 0, Math.max(125, maß * 0.75));
    tap(this.c, () => this.aufflattern(), { sound: null, squash: false });
  }

  /** Fliegt es gerade (sitzt nicht)? */
  get fliegt() {
    return !(this.sitzt > 0);
  }

  /** Sofort irgendwo sitzen (z. B. zu Beginn), ohne hinzufliegen. */
  setzeSitzend(x, y, dauer, ding = null) {
    this.c.position.set(x, y);
    this.ziel = { x, y, sitzen: true, dauer, ding };
    this.sitzt = dauer;
    this.vx = 0;
    this.vy = 0;
  }

  /** Worauf sitzt bzw. wohin fliegt es gerade (ding aus wähleZiel)? */
  get ding() {
    return this.ziel?.ding ?? null;
  }

  /** Auffliegen: zu einer freien Stelle am Himmel, danach weiter wie gewohnt. */
  aufflattern() {
    // Ton entprellt: schnelles Mehrfach-Tippen stapelt keine Töne
    const jetzt = performance.now();
    if (!(jetzt - (this._tonZeit || 0) < 600)) {
      this._tonZeit = jetzt;
      if (this.art === 'biene') sfx('common/biene', { vol: 0.5 });
      else note('pling', pick([84, 86, 88, 91]), { vol: 0.28 });
    }
    this.puls = 0.18;
    const x = clamp(this.c.x + rand(-380, 380), -950, 950);
    this.ziel = { x, y: rand(320, 560), sitzen: false };
    this.sitzt = 0;
    this.eile = 1.7;
    this.vy -= 90;
  }

  _neuesZiel() {
    this.ziel = this.wähleZiel?.(this) || { x: rand(-800, 800), y: rand(400, 800), sitzen: false };
    this.eile = 1;
  }

  update(dt) {
    const c = this.c;
    if (!this.ziel) this._neuesZiel();
    const z = this.ziel;
    let fliegt = true;
    if (this.sitzt > 0) {
      fliegt = false;
      this.sitzt -= dt;
      c.x += (z.x - c.x) * (1 - Math.exp(-dt * 6));
      c.y += (z.y - c.y) * (1 - Math.exp(-dt * 6));
      this.vx = 0;
      this.vy = 0;
      if (this.sitzt <= 0) this._neuesZiel();
    } else {
      const dx = z.x - c.x;
      const dy = z.y - c.y;
      const d = Math.hypot(dx, dy);
      if (d < 10) {
        if (z.sitzen) this.sitzt = z.dauer ?? rand(3, 6);
        else this._neuesZiel();
      } else {
        const v = this.tempo * this.eile * clamp(d / 160, 0.25, 1);
        const k = 1 - Math.exp(-dt * 1.6);
        this.vx += ((dx / d) * v - this.vx) * k;
        this.vy += ((dy / d) * v - this.vy) * k;
        c.x += this.vx * dt;
        c.y += this.vy * dt;
      }
    }
    this.eile += (1 - this.eile) * (1 - Math.exp(-dt * 0.8));

    // Darstellung (puls klingt weich ab)
    this.puls *= Math.exp(-dt * 4);
    this.wipp += dt * (fliegt ? 2.4 : 0.9);
    const s = this.s * (1 + this.puls);
    if (this.art === 'biene') {
      this.sprite.y = fliegt ? Math.sin(this.wipp) * 10 : 0;
      const blick = this.sprite.scale.x < 0 ? -1 : 1;
      if (Math.abs(this.vx) > 8) this.sprite.scale.x = (this.vx < 0 ? -1 : 1) * s;
      else this.sprite.scale.x = blick * s;
      this.sprite.scale.y = s * (1 + 0.02 * Math.sin(this.wipp * 2));
      this.sprite.rotation = clamp(this.vy * 0.0016, -0.2, 0.2) * (this.sprite.scale.x < 0 ? -1 : 1);
    } else {
      // Flügelschlag: Breite schwingt weich (fliegend etwas lebhafter, sitzend langsam und klein)
      this.phase += dt * (fliegt ? 4 : 1.2);
      const auf = fliegt ? 0.6 + 0.4 * Math.abs(Math.cos(this.phase)) : 0.82 + 0.18 * Math.abs(Math.cos(this.phase));
      this.sprite.scale.set(s * auf, s);
      this.sprite.y = fliegt ? Math.sin(this.wipp) * 8 : 0;
      this.sprite.rotation = clamp(this.vx * 0.0015, -0.25, 0.25);
    }
  }
}

// ---------------------------------------------------------------- ziehende Wolken

/**
 * Ein paar Wolken ziehen langsam über den Himmel (in `parent`, z. B. seite.hinten, über dem Hintergrund).
 * Mit `bereich: [xMin, xMax]` pendelt eine Wolke weich nur in diesem Stück Himmel hin und her (z. B. damit sie
 * nie vor einem Baum aus dem Hintergrundbild vorbeizieht), sonst zieht sie über den ganzen Himmel.
 * Antippen: kleines Wackeln und ein weicher Ton. → {liste, update(dt)}
 */
export function wolken(parent, liste) {
  const ws = liste.map(({ id, x, y, breite, tempo, bereich }) => {
    const w = spr(id, { anchor: 0.5, x, y, parent, z: -900 });
    w.scale.set(breite / w.texture.width);
    w.alpha = 0.92;
    w.tempo = tempo;
    if (bereich) {
      w.mitte = (bereich[0] + bereich[1]) / 2;
      w.weite = Math.max(1, (bereich[1] - bereich[0]) / 2 - breite / 2);
      w.winkel = Math.asin(clamp((x - w.mitte) / w.weite, -1, 1));
    }
    // Tippfläche: ganzes Bild, aber mindestens 260 Einheiten hoch (flache Wolken sind sonst zu schmal)
    const s = Math.abs(w.scale.x) || 1;
    const tw = w.texture.width;
    const halb = Math.max(w.texture.height / 2, 130 / s);
    tap(w, () => {
      fx.wobble(w, 0.04);
      note('glocke', pick([79, 81, 84]), { vol: 0.25 });
    }, { sound: null, hitArea: new PIXI.Rectangle(-tw / 2 - 20 / s, -halb, tw + 40 / s, 2 * halb) });
    return w;
  });
  return {
    liste: ws,
    update(dt) {
      for (const w of ws) {
        if (w.weite) {
          // weiches Pendeln: in der Mitte so schnell wie tempo, an den Enden bremst sie
          w.winkel += (w.tempo / w.weite) * dt;
          w.x = w.mitte + w.weite * Math.sin(w.winkel);
          continue;
        }
        w.x += w.tempo * dt;
        const grenze = 1500 + w.width / 2;
        if (w.x > grenze) w.x = -grenze;
      }
    },
  };
}
