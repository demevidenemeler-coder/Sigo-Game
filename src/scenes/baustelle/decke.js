// Holprige Erd-Decke über der Straße, die eine Walze wegwalzt.
// Wie wipe() des Kerns – nur dass hier nicht der Finger, sondern die Walzen-Trommel radiert (die Walze folgt dem
// Finger weich). Bild: eine RenderTexture, in die zwei Kacheln 'baustelle/holperdecke' gemalt werden; Radieren mit
// einem weichen runden Pinsel (blendMode 'erase'). Fortschritt über ein Raster aus Zellen.
// Die RenderTexture gehört der Decke: zerstoere() in exit() der Szene aufrufen.

import { stage, tex, PIXI } from '../../engine/index.js';

// weicher runder Tupfer – einmal pro Modul (nicht pro Szene) angelegt
let pinselTex = null;
function pinsel() {
  if (pinselTex) return pinselTex;
  const G = 128;
  const c = document.createElement('canvas');
  c.width = G;
  c.height = G;
  const g = c.getContext('2d');
  const v = g.createRadialGradient(G / 2, G / 2, 0, G / 2, G / 2, G / 2);
  v.addColorStop(0, 'rgba(255,255,255,1)');
  v.addColorStop(0.6, 'rgba(255,255,255,1)');
  v.addColorStop(0.85, 'rgba(255,255,255,0.5)');
  v.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = v;
  g.fillRect(0, 0, G, G);
  pinselTex = PIXI.Texture.from(c);
  return pinselTex;
}

const ZELLE = 80;

export class Decke {
  /**
   * @param parent Container (Seiten-Welt)
   * @param opt {x, y, w, h} Fläche in Koordinaten von parent; zaehlen: {x0, x1, y0, y1} Bereich, der für den
   *            Fortschritt zählt (dieselben Koordinaten)
   */
  constructor(parent, { x, y, w, h, zaehlen, z = 2 }) {
    this.x = x;
    this.y = y;
    this.w = w;
    this.h = h;
    this.renderer = stage.app.renderer;
    this.rt = PIXI.RenderTexture.create({ width: w, height: h, resolution: 0.5 });
    this.sprite = new PIXI.Sprite(this.rt);
    this.sprite.position.set(x, y);
    this.sprite.zIndex = z;
    this.sprite.eventMode = 'none';
    this.sprite.label = 'holperdecke';
    parent.addChild(this.sprite);

    // zwei Kacheln nebeneinander, die rechte gespiegelt: so treffen sich an der Naht gleiche Ränder (keine sichtbare
    // Kante). Vom Bild werden links und rechts die unregelmäßigen Ränder abgeschnitten (eigener Bildausschnitt,
    // teilt die Bildquelle – wird in zerstoere() wieder freigegeben).
    this.fuellC = new PIXI.Container();
    const t = tex('baustelle/holperdecke');
    const rand = Math.round(t.frame.width * 0.04);
    this.ausschnitt = new PIXI.Texture({
      source: t.source,
      frame: new PIXI.Rectangle(t.frame.x + rand, t.frame.y, t.frame.width - 2 * rand, t.frame.height),
    });
    for (let i = 0; i < 2; i++) {
      const s = new PIXI.Sprite(this.ausschnitt);
      s.width = w / 2 + 1;
      s.height = h;
      if (i === 1) {
        s.scale.x *= -1;
        s.x = w;
      }
      this.fuellC.addChild(s);
    }
    this.leerC = new PIXI.Container();
    this.pinselC = new PIXI.Container();
    // „Schotter abladen": alles rechts einer welligen Kante wird nach dem Füllen wieder weggenommen
    this.kanteC = new PIXI.Container();
    this.kanteG = new PIXI.Graphics();
    this.kanteG.blendMode = 'erase';
    this.kanteC.addChild(this.kanteG);
    this._kante = [];
    this.pool = [];

    // Zellen für den Fortschritt
    const zl = zaehlen || { x0: x, x1: x + w, y0: y, y1: y + h };
    this.zellen = [];
    for (let zy = zl.y0; zy + ZELLE / 2 <= zl.y1; zy += ZELLE) {
      for (let zx = zl.x0; zx + ZELLE / 2 <= zl.x1; zx += ZELLE) {
        this.zellen.push({ x: zx + ZELLE / 2 - x, y: Math.min(zy + ZELLE / 2, zl.y1 - 10) - y, weg: false });
      }
    }
    this.anteil = 0;
    this.fuelle();
  }

  /** Volle Decke (ohne Einblenden – das macht die Seite mit sprite.alpha). */
  fuelle() {
    this.renderer.render({ container: this.fuellC, target: this.rt, clear: true, clearColor: [0, 0, 0, 0] });
    for (const z of this.zellen) z.weg = false;
    this.anteil = 0;
  }

  /**
   * Decke nur links von xRechts (Koordinaten des Eltern-Containers), mit weicher, welliger Kante – so entsteht sie
   * hinter dem Kipper, der Schotter ablädt. Zählt nicht als Walz-Fortschritt.
   */
  zeigeBis(xRechts) {
    const kx = xRechts - this.x;
    if (kx >= this.w) { this.fuelle(); return; }
    this.renderer.render({ container: this.fuellC, target: this.rt, clear: true, clearColor: [0, 0, 0, 0] });
    if (kx > -40) {
      const p = this._kante;
      p.length = 0;
      const n = 9;
      p.push(this.w + 10, -10);
      for (let i = 0; i <= n; i++) {
        const y = -10 + ((this.h + 20) * i) / n;
        p.push(Math.max(0, kx + Math.sin(i * 1.7) * 22 + Math.sin(i * 0.6 + 1) * 12), y);
      }
      p.push(this.w + 10, this.h + 10);
      this.kanteG.clear().poly(p).fill(0xffffff);
    } else {
      this.kanteG.clear().rect(-10, -10, this.w + 20, this.h + 20).fill(0xffffff);
    }
    this.renderer.render({ container: this.kanteC, target: this.rt, clear: false });
    for (const z of this.zellen) z.weg = false;
    this.anteil = 0;
  }

  /** Ganz leer machen. */
  leere() {
    this.renderer.render({ container: this.leerC, target: this.rt, clear: true, clearColor: [0, 0, 0, 0] });
    for (const z of this.zellen) z.weg = true;
    this.anteil = 1;
  }

  /**
   * Von (ax, ay) nach (bx, by) walzen (Koordinaten des Eltern-Containers), Pinsel-Halbachsen rx, ry.
   * → neuer Anteil 0…1
   */
  walze(ax, ay, bx, by, rx, ry) {
    const d = Math.hypot(bx - ax, by - ay);
    const n = Math.min(14, Math.max(1, Math.ceil(d / (rx * 0.4))));
    let i = 0;
    for (; i < n; i++) {
      const t = (i + 1) / n;
      const px = ax + (bx - ax) * t - this.x;
      const py = ay + (by - ay) * t - this.y;
      let s = this.pool[i];
      if (!s) {
        s = new PIXI.Sprite(pinsel());
        s.anchor.set(0.5);
        s.blendMode = 'erase';
        this.pool.push(s);
        this.pinselC.addChild(s);
      }
      s.visible = true;
      s.position.set(px, py);
      s.width = rx * 2;
      s.height = ry * 2;
      // Zellen, deren Mitte im inneren Teil des Pinsels liegt
      const qx = rx * 0.78;
      const qy = ry * 0.78;
      for (const z of this.zellen) {
        if (z.weg) continue;
        const ex = (z.x - px) / qx;
        const ey = (z.y - py) / qy;
        if (ex * ex + ey * ey <= 1) z.weg = true;
      }
    }
    for (let j = i; j < this.pool.length; j++) this.pool[j].visible = false;
    this.renderer.render({ container: this.pinselC, target: this.rt, clear: false });
    let weg = 0;
    for (const z of this.zellen) if (z.weg) weg++;
    this.anteil = this.zellen.length ? weg / this.zellen.length : 1;
    return this.anteil;
  }

  zerstoere() {
    if (this.rt.destroyed) return;
    if (!this.sprite.destroyed) this.sprite.texture = PIXI.Texture.EMPTY;
    this.fuellC.destroy({ children: true });
    this.pinselC.destroy({ children: true });
    this.kanteC.destroy({ children: true });
    this.leerC.destroy();
    this.ausschnitt?.destroy(false);
    this.rt.destroy(true);
  }
}
