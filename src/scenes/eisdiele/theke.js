// Seite 1: die Eisdiele.
// Ein Tier kommt herein und zeigt in der Denkblase sein Wunsch-Eis. Antippen einer Eiswanne → eine Kugel hüpft
// auf die Waffel (höchstens drei). Auf dem Wagen vorn: Kirsche, Sahne, Streusel, Soße (antippen) und die Klingel.
// Fertiges Eis zum Tier ziehen oder klingeln → es schleckt und freut sich (passt es genau: besonders, Sticker).
// Antippen einer Kugel/eines Toppings auf dem Eis nimmt es wieder herunter.

import { PIXI, spr, tap, drag, fx, sfx, note, voice, pick, clamp, killTweensOf } from '../../engine/index.js';
import { Seite } from '../../gemeinsam/seiten.js';
import { belohne, stickerFuerOrt } from '../../gemeinsam/sticker.js';
import {
  Eis, SORTEN, TOPPINGS, TOPPING_BILD, TOPPING_Z, MAX_KUGELN, KUGEL_SKALA, neuerWunsch, miniEis,
} from './eis.js';
import { Kundschaft } from './kunden.js';
import {
  waffelHalter, toppingWagen, schale, Vogel, Schmetterling, bildFleck, bogenFlug, umhaengen,
} from './deko.js';

const WANNE_X = [-110, 120, 350, 580, 810];   // die Punkte wanne1…5 liegen zu weit rechts (Pfeil, Rand)
const WANNE_SKALA = 0.62;
const HALTER_X = -360;
const KUNDE_X = -850;                          // Punkt 'kunde' liegt halb außerhalb des Tablet-Bildes
const KUNDE_SKALA = 0.62;
const WAGEN = { x: 380, y: 1300, breite: 1280 };
const TOPPING_X = { kirsche: -110, sahne: 140, streusel: 390, sosse: 640 };
const GLOCKE_X = 890;
const TOPPING_SCHALE = {
  kirsche: [0xf6c3cf, 0xe3a0b2], sahne: [0xbfe6d6, 0x8fcfb4], streusel: [0xfbe3a8, 0xe8c57a], sosse: [0xf6c3cf, 0xe3a0b2],
};
const TOPPING_ANZEIGE = { kirsche: 0.62, sahne: 0.62, streusel: 0.72, sosse: 0.7 };

export class Theke extends Seite {
  static hg = 'eisdiele/hg_eisdiele';

  aufbau() {
    this.theke = this.punkt('theke_l', { x: -1084, y: 960 }).y + 15;   // Standfläche auf der Theke
    this.bodenY = this.punkt('kunde', { x: -1084, y: 1540 }).y;
    this.flug = 0;            // Kugeln unterwegs zur Waffel
    this.toppingFlug = new Set();
    this.servierWunsch = false; // geklingelt/gezogen, während noch etwas flog: gleich nach der Landung servieren
    this.bedient = false;     // ein Tier schleckt gerade (die neue Waffel steht dann schon im Halter)
    this.wunsch = null;
    this.blase = null;
    this.runde = 0;
    this.treffer = 0;         // genau passende Eis
    this.letzteKlingel = 0;
    this.gekugelt = false;    // schon einmal eine Kugel geholt (dann kein Hinweis mehr auf die Eis-Schalen)
    this._hinweis = null;
    this.sticker = stickerFuerOrt('eisdiele').find((s) => s.id === 'eisdiele_waffel')?.id || 'eisdiele_waffel';

    this.baueHalter();
    this.baueWannen();
    this.baueWagen();
    this.neuesEis(true);
    this.kunde = new Kundschaft(this, {
      x: KUNDE_X, y: this.bodenY, scale: KUNDE_SKALA, z: 4,   // hinter dem Eis, das es bekommt
      onTipp: () => { if (this.mini) fx.pop(this.mini, 0.1); },
    });

    // kleine lebendige Nebensachen
    this.vogel = new Vogel(this, { x: -105, y: 540, farbe: 0x9fd0ee, flip: true, z: 2 });
    this.falter = new Schmetterling(this, {
      // nur über freier Wand (nicht über Eis, Wunschblase, Wannen); unter den Spieldingen, damit er keine Tipps fängt
      orte: [{ x: 880, y: 560 }, { x: 600, y: 330 }, { x: 160, y: 360 }, { x: -330, y: 300 }], z: 2,
    });
    const glas = (m) => () => note('glocke', m, { vol: 0.3 });
    for (const [x, y, m] of [[-634, 418, 79], [-431, 428, 83], [-233, 461, 86], [596, 456, 81], [792, 423, 84],
      [997, 439, 88]]) {
      bildFleck(this, { x, y, w: 200, h: 220, ton: glas(m) });
    }
  }

  betreten() {
    if (this.besuche === 1) {
      voice('eisdiele_hallo');
      this.naechsterKunde(0.4);   // der Hinweis kommt, sobald das erste Tier seinen Wunsch zeigt
    } else {
      this.hinweisAnmelden(1.2);
    }
  }

  verlassen() {
    this._hinweis?.kill();
    this._hinweis = null;
  }

  /** Hinweis „Tipp auf eine Eis-Schale" anmelden (der Kern sagt ihn höchstens einmal am Tag) – nur, solange die
   *  Seite zu sehen ist und das Kind noch keine Kugel geholt hat (auch nicht, wenn er erst später an die Reihe kommt). */
  hinweisAnmelden(sek) {
    this._hinweis?.kill();
    this._hinweis = null;
    if (this.gekugelt) return;
    const passt = () => this.aktiv && !this.gekugelt;
    this._hinweis = this.after(sek, () => { if (passt()) voice('eisdiele_kugel', { nurWenn: passt }); });
  }

  update(dt) {
    this.vogel.update(dt);
    this.falter.update(dt);
  }

  // ---------------------------------------------------------------- Aufbau

  baueHalter() {
    const h = waffelHalter();
    h.hinten.position.set(HALTER_X, this.theke);
    h.hinten.zIndex = 4;
    h.vorn.position.set(HALTER_X, this.theke);
    h.vorn.zIndex = 6;
    this.welt.addChild(h.hinten, h.vorn);
    this.eisOrt = { x: HALTER_X, y: this.theke - 160 };
  }

  baueWannen() {
    this.wannen = SORTEN.map((sorte, i) => {
      const s = spr('eisdiele/wanne_' + sorte, { scale: WANNE_SKALA, x: WANNE_X[i], parent: this.welt, z: 3 });
      s.y = this.theke - (s.texture.height * WANNE_SKALA) / 2 + 12;
      s.sorte = sorte;
      tap(s, () => this.kugelHolen(s), { sound: null, hitArea: new PIXI.Rectangle(-185, -190, 370, 360) });
      return s;
    });
    // Eisportionierer: taucht beim Antippen kurz in die Wanne
    this.loeffel = spr('eisdiele/eisloeffel', { anchor: 0.5, scale: 0.42, parent: this.welt, z: 7, alpha: 0 });
    this.loeffel.eventMode = 'none';
  }

  baueWagen() {
    const w = toppingWagen(WAGEN.breite, 205);
    w.position.set(WAGEN.x, WAGEN.y);
    w.zIndex = 14;
    this.welt.addChild(w);

    this.schalen = {};
    for (const name of TOPPINGS) {
      const c = new PIXI.Container({ label: 'topping:' + name });
      c.position.set(TOPPING_X[name], WAGEN.y);
      c.zIndex = 15;
      const [f, r] = TOPPING_SCHALE[name];
      c.addChild(schale(f, r));
      const bild = spr(TOPPING_BILD[name], { anchor: 0.5, scale: TOPPING_ANZEIGE[name], parent: c });
      bild.y = -40 - (bild.texture.height * TOPPING_ANZEIGE[name]) * 0.38;
      c.bild = bild;
      c.hitArea = new PIXI.Rectangle(-118, -200, 236, 230);
      tap(c, () => this.toppingTipp(name), { sound: null });
      this.welt.addChild(c);
      this.schalen[name] = c;
    }

    this.glocke = spr('eisdiele/glocke_theke', { scale: 0.62, x: GLOCKE_X, y: WAGEN.y + 4, parent: this.welt, z: 15 });
    tap(this.glocke, () => this.klingeln(), { sound: null, hitArea: new PIXI.Rectangle(-190, -330, 380, 360) });
  }

  // ---------------------------------------------------------------- Eis

  neuesEis(sofort = false) {
    const e = new Eis();
    e.position.set(this.eisOrt.x, this.eisOrt.y);
    e.zIndex = 5;
    this.welt.addChild(e);
    this.eis = e;
    if (!sofort) {
      e.alpha = 0;
      e.scale.set(0.3);
      this.tween(e, { alpha: 1 }, 0.35, { ease: 'sineInOut' });
      this.tween(e, { scale: 1 }, 0.55, { ease: 'backOut' });
      sfx('common/plopp', { vol: 0.5 });
    }
    // Wo hat der Finger das Eis gegriffen? (für „Antippen nimmt eine Kugel herunter") – das Teil unter dem Finger
    // hüpft sofort kurz (Rückmeldung beim Berühren; heruntergenommen wird es beim Loslassen, damit Ziehen geht)
    e.on('pointerdown', (ev) => {
      e.griff = e.toLocal(ev.global);
      if (e !== this.eis) return;
      const t = this.teilUnter(e);
      if (t) fx.pop(t.obj, 0.1);
    });
    e.ziehen = drag(e, {
      targets: () => this.zielKunde(),
      onDrop: (ziel, ctx) => {
        if (ziel) return this.servieren(e) ? undefined : false;
        // kaum bewegt = angetippt: die angetippte Kugel bzw. das Topping hüpft zurück (das Eis gleitet heim)
        if (Math.hypot(ctx.x - ctx.startX, ctx.y - ctx.startY) < 40) this.eisTipp(e);
        return undefined;
      },
    });
  }

  zielKunde() {
    const a = this.kunde?.actor;
    if (!a || !this.kunde.bereit || this.bedient) return [];
    const m = a.point('mouth');
    return [{ id: 'kunde', x: m.x, y: m.y - 80, radius: 430 }];
  }

  kugelHolen(wanne) {
    this.gekugelt = true;  // das Kind hat losgelegt: kein Hinweis mehr auf die Eis-Schalen
    const e = this.eis;   // während ein Tier schleckt, ist das schon die neue Waffel
    if (e.anzahl + this.flug >= MAX_KUGELN) {
      // schon voll: das Eis wackelt freundlich
      fx.wobble(e, 0.05);
      note('xylo', 60, { vol: 0.35 });
      return;
    }
    this.loeffelTaucht(wanne);
    sfx('common/rupf', { vol: 0.4 });
    const index = e.anzahl + this.flug;
    this.flug++;
    const platz = e.platz('kugel', index, this.flug);
    const k = spr('eisdiele/kugel_' + wanne.sorte, {
      anchor: 0.5, scale: 0.3, x: wanne.x, y: wanne.y - 50, parent: this.welt, z: 60,
    });
    k.sorte = wanne.sorte;
    k.eventMode = 'none';
    const ziel = this.welt.toLocal(e.toGlobal(platz));
    const skala = KUGEL_SKALA * Math.abs(e.scale.x || 1);
    // Ziel folgt der Waffel: zieht das Kind sie unterwegs weg, landet die Kugel trotzdem darauf
    const zielJetzt = () => (e.destroyed ? null : this.welt.toLocal(e.toGlobal(platz)));
    bogenFlug(this, k, ziel.x, ziel.y, { dauer: 0.5, hoehe: 170, skala, ziel: zielJetzt }).then(() => {
      this.flug--;
      if (k.destroyed) return this.nachLandung();
      if (e.destroyed || e !== this.eis || e.anzahl >= MAX_KUGELN) {
        this.tween(k, { alpha: 0 }, 0.3, { ease: 'sineInOut' }).then(() => { if (!k.destroyed) k.destroy(); });
        return this.nachLandung();
      }
      umhaengen(k, e);
      e.kugeln.push(k);
      e.ordne(this, 0.2);
      sfx('common/plopp', { vol: 0.6 });
      fx.pop(e, 0.05);
      if (this.wunsch && this.kunde.bereit && e.anzahl >= this.wunsch.kugeln.length) {
        // „Gib das Eis dem Tier" – aber nicht, wenn das Kind es schon zieht, geklingelt hat oder weggeblättert ist
        voice('eisdiele_geben', {
          nurWenn: () => this.aktiv && e === this.eis && !this.bedient && !this.servierWunsch && e.anzahl > 0
            && !e.ziehen?.isDragging(),
        });
      }
      this.nachLandung();
    });
  }

  loeffelTaucht(wanne) {
    const l = this.loeffel;
    l.position.set(wanne.x + 30, wanne.y - 175);
    l.rotation = 0.3;
    l.alpha = 1;
    this.tween(l, { y: wanne.y - 120 }, 0.12, { ease: 'quadOut' })
      .then((ok) => ok && this.tween(l, { y: wanne.y - 190 }, 0.2, { ease: 'sineOut' }))
      .then((ok) => ok && this.tween(l, { alpha: 0 }, 0.3, { ease: 'sineInOut' }));
  }

  /** Welches Teil (Kugel/Topping) liegt unter dem Griffpunkt? → {obj, weg()} oder null (= Waffel) */
  teilUnter(e) {
    const g = e.griff || { x: 0, y: 0 };
    let bestes = null;
    let abstand = Infinity;
    for (const k of e.kugeln) {
      const d = Math.abs(k.y - g.y);
      if (d < abstand) { abstand = d; bestes = { obj: k, weg: () => this.kugelWeg(e, k) }; }
    }
    for (const [name, t] of e.toppings) {
      const d = Math.abs(t.y - g.y) - 15;   // Toppings liegen obenauf: bei Gleichstand gewinnen sie
      if (d < abstand) { abstand = d; bestes = { obj: t, weg: () => this.toppingWeg(e, name) }; }
    }
    return bestes && (g.y < -60 || !e.kugeln.length) && abstand < 140 ? bestes : null;
  }

  /** Eis angetippt: das Teil unter dem Finger kommt herunter; auf der Waffel selbst nur ein freundliches Wackeln. */
  eisTipp(e) {
    if (e !== this.eis) return;
    const teil = this.teilUnter(e);
    if (teil) {
      teil.weg();
      return;
    }
    // Waffel: kleiner Klang, und die Klingel zeigt sich, wenn schon Eis drauf ist
    note('xylo', 67, { vol: 0.3 });
    if (e.anzahl && this.kunde.bereit) this.after(0.2, () => fx.pop(this.glocke, 0.08));
  }

  kugelWeg(e, k) {
    if (this.bedient && e !== this.eis) return;
    const i = e.kugeln.indexOf(k);
    if (i < 0) return;
    e.kugeln.splice(i, 1);
    k.eventMode = 'none';
    killTweensOf(k);
    umhaengen(k, this.welt);
    k.zIndex = 60;
    e.ordne(this, 0.3);
    sfx('common/plopp', { vol: 0.45, rate: 0.85 });
    const w = this.wannen.find((x) => x.sorte === k.sorte) || this.wannen[0];
    bogenFlug(this, k, w.x, w.y - 30, { dauer: 0.5, hoehe: 140, skala: 0.3 })
      .then(() => { if (!k.destroyed) return this.tween(k, { alpha: 0 }, 0.2, { ease: 'sineInOut' }); return false; })
      .then(() => { if (!k.destroyed) k.destroy(); });
  }

  toppingTipp(name) {
    const e = this.eis;
    const s = this.schalen[name];
    if (e.hat(name)) {
      fx.wobble(e.toppings.get(name), 0.12);
      return;
    }
    if (this.toppingFlug.has(name)) return;
    this.toppingFlug.add(name);
    sfx('common/rupf', { vol: 0.35, rate: 1.1 });
    const b = s.bild;
    const t = spr(TOPPING_BILD[name], { anchor: 0.5, scale: b.scale.x * 0.8, x: s.x + b.x, y: s.y + b.y, parent: this.welt, z: 61 });
    t.eventMode = 'none';
    const p = e.platz('topping', name);
    const ziel = this.welt.toLocal(e.toGlobal(p));
    const zielJetzt = () => (e.destroyed ? null : this.welt.toLocal(e.toGlobal(p)));
    bogenFlug(this, t, ziel.x, ziel.y, { dauer: 0.55, hoehe: 200, skala: p.s * Math.abs(e.scale.x || 1), ziel: zielJetzt }).then(() => {
      this.toppingFlug.delete(name);
      if (t.destroyed) return this.nachLandung();
      if (e.destroyed || e !== this.eis || e.hat(name)) {
        this.tween(t, { alpha: 0 }, 0.3, { ease: 'sineInOut' }).then(() => { if (!t.destroyed) t.destroy(); });
        return this.nachLandung();
      }
      umhaengen(t, e);
      t.zIndex = TOPPING_Z[name];
      e.toppings.set(name, t);
      e.ordne(this, 0.2);
      sfx('common/plopp', { vol: 0.55, rate: 1.15 });
      this.nachLandung();
    });
  }

  toppingWeg(e, name) {
    if (this.bedient && e !== this.eis) return;
    const t = e.toppings.get(name);
    if (!t) return;
    e.toppings.delete(name);
    t.eventMode = 'none';
    killTweensOf(t);
    umhaengen(t, this.welt);
    t.zIndex = 61;
    e.ordne(this, 0.3);
    sfx('common/plopp', { vol: 0.4, rate: 0.9 });
    const s = this.schalen[name];
    bogenFlug(this, t, s.x + s.bild.x, s.y + s.bild.y, { dauer: 0.5, hoehe: 160, skala: s.bild.scale.x * 0.8 })
      .then(() => { if (!t.destroyed) return this.tween(t, { alpha: 0 }, 0.2, { ease: 'sineInOut' }); return false; })
      .then(() => { if (!t.destroyed) t.destroy(); });
  }

  klingeln() {
    const jetzt = performance.now();
    if (jetzt - this.letzteKlingel > 600) {
      this.letzteKlingel = jetzt;
      sfx('common/klingel', { vol: 0.55 });
    }
    if (this.eis.ziehen?.isDragging()) return;
    if (this.kunde.bereit && !this.bedient) this.servieren(this.eis);
  }

  /** Leeres Eis (oder Kugel noch unterwegs): das Tier zeigt freundlich auf seinen Wunsch. */
  leerHinweis() {
    if (this.mini) fx.pop(this.mini, 0.12);
    this.kunde.laut();
    const sorte = this.wunsch ? this.eis.fehlendeSorte(this.wunsch) : null;
    const w = sorte && this.wannen.find((x) => x.sorte === sorte);
    if (w) this.after(0.3, () => fx.pop(w, 0.08));
  }

  /** Eis an den Kunden geben. → true, wenn es losgeht */
  servieren(e) {
    if (this.bedient || !this.kunde.bereit || e !== this.eis) return false;
    if (this.flug > 0 || this.toppingFlug.size > 0) {
      // eine Kugel/ein Topping fliegt noch: erst landen lassen, dann bekommt das Tier das Eis von selbst
      this.servierWunsch = true;
      return false;
    }
    this.servierWunsch = false;
    if (e.anzahl === 0) {
      this.leerHinweis();
      return false;
    }
    this.bedient = true;
    this.schlecken(e);
    return true;
  }

  /** Nach jeder Landung: wartet ein Servier-Wunsch und fliegt nichts mehr, geht das Eis jetzt zum Tier. */
  nachLandung() {
    if (!this.servierWunsch || this.flug > 0 || this.toppingFlug.size > 0) return;
    this.servierWunsch = false;
    this.after(0.25, () => {
      if (!this.eis.ziehen?.isDragging()) this.servieren(this.eis);
    });
  }

  async schlecken(e) {
    const a = this.kunde.actor;
    const passt = !!this.wunsch && e.stimmt(this.wunsch);
    e.ziehen?.off();
    e.eventMode = 'none';
    e.zIndex = 7;             // vor der neuen Waffel und dem Halter-Ring
    this.wunsch = null;
    this.runde++;
    this.blaseWeg();
    // Gleich steht eine neue Waffel im Halter: Wannen und Toppings zielen ab jetzt auf sie (nicht aufs Tier)
    this.neuesEis();
    a.pose('eat');
    await this.wait(0.12);
    if (a.destroyed) return;
    const mund = a.point('mouth');
    const s = 0.62;
    const y = clamp(mund.y + 20 - e.kante() * s, 0, 1440);   // obere Kante des Eises am Maul
    this.tween(e, { x: mund.x + 30, y }, 0.6, { ease: 'sineInOut' });
    await this.tween(e, { scale: s }, 0.6, { ease: 'sineInOut' });
    sfx('common/mampf', { vol: 0.9 });
    a.nod();
    // von oben nach unten aufschlecken
    const teile = [...e.toppings.values()].sort((p, q) => q.zIndex - p.zIndex).concat(e.kugeln.slice().reverse());
    for (const t of teile) {
      this.tween(t, { alpha: 0, scale: t.scale.x * 0.55 }, 0.35, { ease: 'sineInOut' });
      await this.wait(0.32);
    }
    await this.tween(e, { alpha: 0, scale: s * 0.6 }, 0.35, { ease: 'sineInOut' });
    e.destroy({ children: true });
    a.pose('idle');
    const kopf = a.point('kopf');
    // Sticker gelegentlich: beim ersten genau passenden Eis und dann bei jedem dritten
    if (passt) {
      this.treffer++;
      if (this.treffer % 3 === 1) belohne(this, this.sticker, kopf.x + 120, kopf.y - 60);
    }
    await this.kunde.freut(passt);
    await this.wait(0.3);
    this.bedient = false;
    await this.kunde.geht();
    await this.naechsterKunde(0.3);
  }

  // ---------------------------------------------------------------- Kunde und Wunsch

  async naechsterKunde(warte = 0) {
    if (warte) await this.wait(warte);
    const ok = await this.kunde.kommt();
    if (ok) this.zeigeWunsch();
  }

  zeigeWunsch() {
    const a = this.kunde.actor;
    if (!a) return;
    const w = neuerWunsch(this.runde === 0);
    this.servierWunsch = false;
    this.wunsch = w;
    const kopf = a.point('kopf');
    const b = new PIXI.Container({ label: 'wunschblase' });
    b.zIndex = 30;
    const S = 0.62;
    spr('common/blase_denk', { anchor: [45 / 600, 540 / 562], scale: S, parent: b });
    const m = miniEis(w);
    m.scale.set(Math.min(0.55, 265 / m.hoehe));
    m.position.set((330 - 45) * S, (262 - 540) * S);
    b.addChild(m);
    // Schwanz der Blase knapp über dem Kopf; die Blase bleibt links neben dem Waffelhalter (verdeckt das Eis nicht)
    // und unter der Markise
    b.position.set(Math.min(kopf.x - 20, HALTER_X - 120 - 330), Math.max(kopf.y - 30, 470));
    b.hitArea = new PIXI.Rectangle(-30, -345, 380, 355);
    b.alpha = 0;
    b.scale.set(0.6);
    this.welt.addChild(b);
    this.tween(b, { alpha: 1 }, 0.35, { ease: 'sineInOut' });
    this.tween(b, { scale: 1 }, 0.5, { ease: 'backOut' });
    sfx('common/plopp', { vol: 0.45, rate: 0.9 });
    tap(b, () => { fx.pop(m, 0.1); this.kunde.laut(); }, { sound: null, squash: false });
    this.blase = b;
    this.mini = m;
    if (this.runde === 0) this.hinweisAnmelden(0.7);
  }

  blaseWeg() {
    const b = this.blase;
    this.blase = null;
    this.mini = null;
    if (!b || b.destroyed) return;
    b.eventMode = 'none';
    this.tween(b, { alpha: 0, scale: 0.85 }, 0.35, { ease: 'sineInOut' }).then(() => { if (!b.destroyed) b.destroy({ children: true }); });
  }

  // ---------------------------------------------------------------- Zeige-Hand

  hinweise() {
    const e = this.eis;
    const w = this.wunsch;
    // Kunde unterwegs oder am Schlecken: das nächste Eis darf schon entstehen (ist die Waffel voll: Klingel)
    if (!w || !this.kunde.bereit || this.bedient) return e.anzahl < MAX_KUGELN ? [this.wannen[0]] : [this.glocke];
    const sorte = e.fehlendeSorte(w);
    if (sorte && e.anzahl < MAX_KUGELN) return [this.wannen.find((x) => x.sorte === sorte)];
    if (w.topping && !e.hat(w.topping)) return [this.schalen[w.topping]];
    if (e.anzahl) return [{ von: e.waffel, nach: this.kunde.actor }, this.glocke];
    return [pick(this.wannen)];
  }
}
