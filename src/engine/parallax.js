// Lange, rollende Landschaften mit Tiefe (Parallaxe).
//
//   const land = new Parallax(this, {
//     layers: [
//       { tex: 'zug/himmel', depth: 0,   y: 1600, tile: true },   // ganz hinten, bewegt sich nicht
//       { tex: 'zug/berge',  depth: 0.3, y: 1100, tile: true },
//       { tex: 'zug/wiese',  depth: 1,   y: 1600, tile: true },   // läuft mit der Welt
//     ],
//     breite: 20000,               // optional: Kamera bleibt zwischen 0 und breite
//   });
//   land.kamera.ziel = 5000;       // Kamera fährt weich dorthin (land.kamera.x ist der aktuelle Stand)
//                                  // – fährt weich an, höchstens `tempo` Einheiten/s (Standard 600), bremst weich ab.
//                                  // Große Sprünge lieber mit springe(x) unter der Blende machen.
//   land.add(baum, 0.6);           // Ding, das in Tiefe 0.6 mitläuft (x = Ort in der Landschaft)
//
// depth: 0 = steht still (Himmel), 1 = läuft mit der Spielwelt, > 1 = Vordergrund (schneller).
// y = Unterkante der Ebene (Standard 1600). tile = als TilingSprite endlos wiederholt.
// Ebenen mit depth < 1 liegen in scene.bg, depth = 1 in scene.world, depth > 1 in scene.front – standardmäßig
// hinter allem anderen in ihrer Ebene (zIndex -1000 + Reihenfolge); mit {z} lässt sich das ändern.
// Dinge außerhalb des Bildschirms werden nicht gezeichnet (renderable = false) – lange Strecken bleiben günstig.

import { Container, Sprite, TilingSprite, Texture } from 'pixi';
import { stage } from './stage.js';
import { tex } from './assets.js';
import { SceneManager } from './scene.js';
import { clamp } from './util.js';

const RAND_SICHT = 300; // so weit über den Bildschirmrand hinaus wird noch gezeichnet

function ebeneFuer(scene, depth) {
  if (depth < 1) return scene.bg;
  if (depth > 1) return scene.front;
  return scene.world;
}

export class Parallax {
  /**
   * @param {Scene} scene
   * @param {object} opt {layers: [{tex, depth, y=1600, tile=true, scale=1, x=0, z}], breite, weich=2.5, tempo=600,
   *                     start=0}
   */
  constructor(scene, opt = {}) {
    this.scene = scene;
    this.breite = opt.breite ?? null;
    // weich = wie sanft die Kamera vor dem Ziel ausrollt (je größer, desto später bremst sie);
    // tempo = Höchstgeschwindigkeit in Einheiten/s (Ruhe-Regel: keine schnellen Kamerafahrten)
    this.kamera = { x: opt.start ?? 0, ziel: opt.start ?? 0, weich: opt.weich ?? 2.5, tempo: opt.tempo ?? 600, v: 0 };
    this.ebenen = [];      // {depth, container, kachel?, sprite?, scale}
    this.tiefen = new Map(); // depth → Container für add()

    (opt.layers || []).forEach((l, i) => this._baueEbene(l, i));

    this._tick = (ticker) => this.update(Math.min(ticker.deltaMS / 1000, 0.05));
    stage.app.ticker.add(this._tick);
    this._abResize = stage.on('resize', () => this._groesse());
    this._abExit = SceneManager.onExit((s) => { if (s === scene) this.destroy(); });
    this._groesse();
    this.update(0);
  }

  _baueEbene(l, i) {
    const depth = l.depth ?? 1;
    const t = typeof l.tex === 'string' ? tex(l.tex) : l.tex || Texture.WHITE;
    const scale = l.scale ?? 1;
    const c = new Container({ label: 'parallax:' + depth });
    c.zIndex = l.z ?? -1000 + i;
    ebeneFuer(this.scene, depth).addChild(c);
    const e = { depth, container: c, scale, y: l.y ?? stage.H, x: l.x ?? 0 };
    if (l.tile ?? true) {
      e.kachel = new TilingSprite({ texture: t, width: stage.W + 8, height: t.height * scale });
      e.kachel.tileScale.set(scale);
      e.kachel.anchor.set(0, 1);
      c.addChild(e.kachel);
    } else {
      e.sprite = new Sprite(t);
      e.sprite.anchor.set(0, 1);
      e.sprite.scale.set(scale);
      e.sprite.position.set(e.x, e.y);
      c.addChild(e.sprite);
    }
    this.ebenen.push(e);
  }

  /** Container für Dinge in einer Tiefe (wird bei Bedarf angelegt). */
  ebene(depth = 1) {
    let c = this.tiefen.get(depth);
    if (!c) {
      c = new Container({ label: 'tiefe:' + depth, sortableChildren: true });
      c.zIndex = depth < 1 ? -500 + depth * 100 : 0;
      ebeneFuer(this.scene, depth).addChild(c);
      this.tiefen.set(depth, c);
      c.x = -this.kamera.x * depth;
    }
    return c;
  }

  /** Ding in einer Tiefe mitlaufen lassen; obj.x ist sein Ort in der Landschaft. → obj */
  add(obj, depth = 1) {
    this.ebene(depth).addChild(obj);
    return obj;
  }

  /** Kamera sofort (ohne Gleiten) setzen. */
  springe(x) {
    this.kamera.ziel = this.kamera.x = this._begrenze(x);
    this.kamera.v = 0;
    this.update(0);
  }

  _begrenze(x) {
    if (this.breite === null) return x;
    return clamp(x, 0, Math.max(0, this.breite));
  }

  _groesse() {
    for (const e of this.ebenen) {
      if (e.kachel && !e.kachel.destroyed) e.kachel.width = stage.W + 8;
    }
  }

  /** Jedes Bild (läuft von selbst). */
  update(dt) {
    const k = this.kamera;
    k.ziel = this._begrenze(k.ziel);
    // Weich nachgeführt: Wunsch-Tempo wächst mit dem Abstand, ist aber begrenzt (tempo) und so gewählt, dass die
    // Kamera mit der begrenzten Beschleunigung rechtzeitig sanft anhalten kann – kein Ruck, kein Überschwingen.
    const rest = k.ziel - k.x;
    const vMax = Math.max(20, k.tempo);
    const beschl = vMax * 1.2;                       // in knapp einer Sekunde auf Höchsttempo
    const abstand = Math.abs(rest);
    const vSoll = Math.sign(rest) * Math.min(vMax, abstand * k.weich, Math.sqrt(2 * beschl * abstand));
    k.v += clamp(vSoll - k.v, -beschl * dt, beschl * dt);
    k.x += k.v * dt;
    if ((k.ziel - k.x) * rest <= 0 || (Math.abs(k.ziel - k.x) < 0.5 && Math.abs(k.v) < 8)) {
      if (dt > 0 || abstand < 0.5) { k.x = k.ziel; k.v = 0; }
    }

    const W = stage.W;
    for (const e of this.ebenen) {
      const versatz = k.x * e.depth;
      if (e.kachel) {
        e.kachel.position.set(-W / 2 - 4, e.y);
        e.kachel.tilePosition.x = e.x - versatz; // in Einheiten der Ebene (tileScale wirkt erst danach)
      } else {
        e.container.x = -versatz;
        const b = e.sprite;
        const links = b.x - versatz;
        const rechts = links + b.width;
        b.renderable = rechts > -W / 2 - RAND_SICHT && links < W / 2 + RAND_SICHT;
      }
    }
    // Dinge in Tiefen: nur zeichnen, was (fast) zu sehen ist
    for (const [depth, c] of this.tiefen) {
      c.x = -k.x * depth;
      for (const kind of c.children) {
        // Breite nur einmal messen (getBounds jedes Bild wäre teuer); eigene Angabe über kind.cullBreite
        if (kind.cullBreite === undefined) kind.cullBreite = kind.getLocalBounds().width * Math.abs(kind.scale.x);
        const halb = kind.cullBreite / 2 + RAND_SICHT;
        const x = kind.x + c.x;
        kind.renderable = x > -W / 2 - halb && x < W / 2 + halb;
      }
    }
  }

  destroy() {
    if (this._tot) return;
    this._tot = true;
    stage.app.ticker.remove(this._tick);
    this._abResize?.();
    this._abExit?.();
    for (const e of this.ebenen) if (!e.container.destroyed) e.container.destroy({ children: true });
    for (const c of this.tiefen.values()) if (!c.destroyed) c.destroy({ children: true });
    this.ebenen = [];
    this.tiefen.clear();
  }
}
