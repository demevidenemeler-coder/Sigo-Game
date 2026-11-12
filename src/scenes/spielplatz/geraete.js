// Seite 2 – Spielgeräte:
//   Schaukel: Katze sitzt drauf; antippen → schwingt als gedämpftes Pendel um die Aufhängung.
//   Rutsche: drei Tiere warten an der Leiter; antippen → das vorderste klettert hoch, rutscht, freut sich,
//            stellt sich wieder an.
//   Wippe: Schaf und Schwein; Tipp auf eine Seite → sie geht weich hinunter, das andere Tier hüpft leicht.
//   Vorn: Federwippe (wippt) und Karussell (dreht eine langsame Runde).

import {
  spr, tex, Actor, tap, sfx, note, voice, fx, rand, pick, clamp, store, ease, PIXI,
} from '../../engine/index.js';
import { Seite, hgPunkt } from '../../gemeinsam/seiten.js';
import { belohne } from '../../gemeinsam/sticker.js';
import { freude, inVorn, bildPunkt, teilTextur, stickerFuer, wolken, Schmetterling, Vogel } from './helfer.js';

const TIER_SKALA = 0.2;
const SEITEN = ['l', 'r'];
const TON_ABSTAND = 0.4;                    // gleiche Töne frühestens nach so vielen Sekunden wieder

// Schaukel (x kommt aus dem Hintergrund-Punkt „schaukel")
const SCHAUKEL_SKALA = 0.55;
const SEIL_LAENGE = 222;                    // Aufhängung → Oberkante Brett (Einheiten)
const PENDEL_W = (2 * Math.PI) / 2.7;       // Eigenfrequenz (Periode 2,7 s)
const PENDEL_DAEMPFUNG = 0.17;
const PENDEL_MAX = 0.5;                     // größter Ausschlag (rad)

// Rutsche: rechts neben der Schaukel (ihr rechtes Bein endet bei etwa −395), Leiter links ab etwa −340
const RUTSCHE_X = -40;
const RUTSCHE_SKALA = 0.6;
const RUTSCH_TIERE = ['ente', 'hase', 'frosch'];
// Bahn auf der Rutschfläche (Bildpunkte der Rutsche), von oben nach unten
const BAHN = [[528, 402], [600, 412], [680, 452], [760, 532], [840, 600], [930, 632], [1030, 644]];

// Wippe
const WIPPE_X = 690;
const WIPPE_SKALA = 0.55;
const WIPPE_MAX = 0.27;

// Karussell: Sitze (Ausschnitte im Bild, Mitte x), Kreisbahn um die Stange
const KARUSSELL_SITZE = [
  { x: 100, w: 195, winkel: -Math.PI / 2 },
  { x: 308, w: 196, winkel: 0 },
  { x: 535, w: 196, winkel: Math.PI / 2 },
];
const KARUSSELL_MITTE = 12;   // Stange liegt 12 Bildpunkte rechts der Bildmitte
const KARUSSELL_R = 218;
const KARUSSELL_SKALA = 0.46;              // Bild 788×900 → 362×414, nicht vergrößert
const KARUSSELL_ORT = { x: 620, y: 1528 }; // vorn im Gras zwischen Rutschen-Landung und Wippe
const REITER_SKALA = 0.1;                  // Igel auf dem vorderen Sitz (Welt-Größe)
const MELODIE = [72, 76, 79, 84, 81, 79, 76, 72];

export class Geraete extends Seite {
  static hg = 'spielplatz/hg_geraete';

  aufbau() {
    this.G = this.boden;
    this.rutschRunden = 0;
    this.zeit = 0;
    this.benutzt = false;   // schon ein Gerät angetippt (dann kein Hinweis mehr auf die Geräte)
    this._hinweis = null;
    this.tonZeit = {};

    this.wolken = wolken(this, [
      { bild: 'wolke2', x: -200, y: 150, scale: 0.38, v: 8, alpha: 0.85 },
    ]);
    this.baueSchaukel();
    this.baueRutsche();
    this.baueWippe();
    this.baueFederwippe();
    this.baueKarussell();
    this.falter = new Schmetterling(this, {
      x: 250, y: 1420, farbe: 1, z: 320, scale: 0.9,
      bereich: { x0: -950, x1: 850, y0: 1360, y1: 1460 },
    });
    this.vogel = new Vogel(this, { y0: 200, y1: 420, z: 5, pause: [20, 36] });
    this.baueUmgebung();
  }

  /** Ton nur, wenn derselbe nicht gerade eben erst klang (kein Stapeln bei Dauertippen) */
  ton(id, opt, abstand = TON_ABSTAND) {
    if (this.zeit - (this.tonZeit[id] ?? -99) < abstand) return false;
    this.tonZeit[id] = this.zeit;
    sfx(id, opt);
    return true;
  }

  // ---------------------------------------------------------------- Bäume, Hecke, Sand (gemalt): reagieren auch

  baueUmgebung() {
    // ganz unten in der Welt: alles, was davor steht, fängt seine Tipps selbst
    const flaeche = (label, rect, fn) => {
      const c = new PIXI.Container({ label });
      c.zIndex = -50;
      this.welt.addChild(c);
      tap(c, fn, { sound: null, squash: false, hitArea: rect });
    };
    // Baumkronen und Hecke: zwischen den Blätter-Pfeilen, unter den Knopf-Ecken
    flaeche('baeume', new PIXI.Rectangle(-980, 280, 1960, 680), (e) => {
      if (this.ton('common/wusch', { vol: 0.22, rate: 0.8 }, 0.5)) {
        this.burst('blaetter', e.x, Math.min(e.y, 900), { count: 3 });
      }
    });
    // Sandfläche: ein wenig Staub
    flaeche('sand', new PIXI.Rectangle(-1000, 960, 2000, 420), (e) => {
      if (this.ton('common/sand', { vol: 0.25 }, 0.5)) this.burst('staub', e.x, e.y, { count: 2 });
    });
  }

  // ---------------------------------------------------------------- Schaukel

  baueSchaukel() {
    const G = this.G;
    const S = SCHAUKEL_SKALA;
    const x = this.punkt('schaukel', { x: -694 }).x;
    this.gestell = spr('spielplatz/schaukel_gestell', { x, y: G, scale: S, z: 10, parent: this.welt });
    const haken = hgPunkt(this.gestell, 'aufhaengung') || bildPunkt(this.gestell, 555, 125);

    // Schatten unter der Schaukel (wandert mit)
    this.schaukelSchatten = new PIXI.Graphics().ellipse(0, 0, 120, 18).fill({ color: 0x5a4630, alpha: 0.16 });
    this.schaukelSchatten.position.set(haken.x, G - 6);
    this.schaukelSchatten.zIndex = 9;
    this.welt.addChild(this.schaukelSchatten);

    const p = new PIXI.Container({ label: 'schaukel' });
    p.position.set(haken.x, haken.y);
    p.zIndex = 12;
    // Seile (gestaucht, damit das Brett über dem Boden hängt) und Brett als eigene Ausschnitte
    const breite = S * 0.8;
    const seile = new PIXI.Sprite(teilTextur('spielplatz/schaukel_sitz', 0, 0, 469, 700));
    seile.anchor.set(0.5, 35 / 700);
    seile.scale.set(breite, SEIL_LAENGE / 665);
    const brett = new PIXI.Sprite(teilTextur('spielplatz/schaukel_sitz', 0, 690, 469, 110));
    brett.anchor.set(0.5, 10 / 110);
    brett.position.set(0, SEIL_LAENGE);
    brett.scale.set(breite);
    p.addChild(seile, brett);
    this.brett = brett;
    this.katze = new Actor('katze', { x: 8, y: SEIL_LAENGE + 10, scale: TIER_SKALA, parent: p });
    this.katze.schatten.visible = false;
    this.welt.addChild(p);
    this.schaukel = p;
    this.pendel = { w: 0, v: 0, letzteV: 0, quietsch: -10, schubser: 0, zeit: 0, froh: false };

    tap(p, () => this.schubse(), { sound: null, squash: false, hitArea: new PIXI.Rectangle(-150, 60, 300, 300) });
    tap(this.gestell, () => this.schubse(), { sound: null, squash: false });
  }

  schubse() {
    this.benutzt = true;   // ein Gerät angetippt: kein Hinweis mehr auf die Geräte
    const z = this.pendel;
    const amp = Math.hypot(z.w, z.v / PENDEL_W);
    const richtung = Math.abs(z.v) > 0.15 ? Math.sign(z.v) : (z.w > 0 ? -1 : 1);
    z.v += richtung * (amp < 0.1 ? 1.0 : 0.6);
    const neu = Math.hypot(z.w, z.v / PENDEL_W);
    if (neu > PENDEL_MAX) z.v *= PENDEL_MAX / neu;
    this.ton('common/wusch', { vol: 0.3 });
    z.schubser++;
    if (z.schubser % 3 === 1 && z.zeit - (z.laut ?? -10) > 3) {
      z.laut = z.zeit;
      this.katze.sound();
    }
  }

  schaukelUpdate(dt) {
    const z = this.pendel;
    z.zeit += dt;
    // in kleinen Schritten rechnen (stabil auch bei großem dt)
    let rest = dt;
    while (rest > 0) {
      const h = Math.min(rest, 1 / 120);
      rest -= h;
      z.v += (-PENDEL_W * PENDEL_W * Math.sin(z.w) - PENDEL_DAEMPFUNG * z.v) * h;
      z.w += z.v * h;
    }
    this.schaukel.rotation = z.w;
    this.schaukelSchatten.x = this.schaukel.x - Math.sin(z.w) * (SEIL_LAENGE + 40);
    this.schaukelSchatten.scale.x = 1 - Math.abs(z.w) * 0.4;
    const amp = Math.hypot(z.w, z.v / PENDEL_W);
    // Umkehrpunkt: ab und zu ein leises Quietschen
    if (Math.sign(z.v) !== Math.sign(z.letzteV) && amp > 0.25 && z.zeit - z.quietsch > 7) {
      z.quietsch = z.zeit;
      sfx('common/quietsch', { vol: 0.3 });
    }
    z.letzteV = z.v;
    // Katze freut sich, wenn es hoch hinaus geht
    if (!z.froh && amp > 0.3) {
      z.froh = true;
      this.katze.pose('happy');
    } else if (z.froh && amp < 0.12) {
      z.froh = false;
      this.katze.pose('idle');
    }
  }

  // ---------------------------------------------------------------- Rutsche

  baueRutsche() {
    const G = this.G;
    const S = RUTSCHE_SKALA;
    this.rutsche = spr('spielplatz/rutsche', { x: RUTSCHE_X, y: G, scale: S, z: 10, parent: this.welt });
    const r = this.rutsche;
    this.leiterFuss = hgPunkt(r, 'leiter_fuss') || bildPunkt(r, 150, 770);
    this.leiterFuss.x += 10;
    this.leiterOben = bildPunkt(r, 262, 408);
    this.obenPunkt = hgPunkt(r, 'oben') || bildPunkt(r, 520, 410);
    this.obenPunkt.y -= 4;
    this.bahn = BAHN.map(([x, y]) => bildPunkt(r, x, y));
    this.bahnLaengen = [0];
    for (let i = 1; i < this.bahn.length; i++) {
      const a = this.bahn[i - 1];
      const b = this.bahn[i];
      this.bahnLaengen.push(this.bahnLaengen[i - 1] + Math.hypot(b.x - a.x, b.y - a.y));
    }
    // Landung kurz hinter dem Rutschen-Ende (vor der Wippe, die erst bei etwa +390 beginnt)
    const ende = this.bahn[this.bahn.length - 1];
    this.landung = { x: ende.x + 45, y: G + 40 };
    // Warteplätze: schräg vor der Leiter, nach vorn hin (frei vom rechten Schaukelbein)
    this.plaetze = [
      { x: this.leiterFuss.x - 5, y: G + 35 },
      { x: this.leiterFuss.x + 115, y: G + 105 },
      { x: this.leiterFuss.x + 240, y: G + 165 },
    ];
    this.schlange = [];
    this.leiterFrei = true;
    RUTSCH_TIERE.forEach((id, i) => {
      const p = this.plaetze[i];
      const a = new Actor(id, { x: p.x, y: p.y, scale: TIER_SKALA, parent: this.welt, z: this.tierZ(p.y) });
      a.bereit = true;
      a._platz = i;
      a.onTap(() => this.rutschTierTipp(a), { pad: 70 });
      this.schlange.push(a);
    });
    tap(r, () => this.starteRutschen(), {
      sound: null, squash: false,
      // ganze Rutsche (Bildpunkte, Anker unten Mitte)
      hitArea: new PIXI.Rectangle(-560, -800, 1120, 820),
    });
  }

  tierZ(y) {
    return 100 + Math.round((y - 900) / 5);
  }

  rutschTierTipp(a) {
    this.benutzt = true;
    // Jedes wartende Tier darf angetippt werden: ist die Leiter frei, klettert das vorderste los
    const vorn = this.schlange[0];
    if (vorn && vorn.bereit && this.leiterFrei && this.schlange.includes(a)) {
      this.starteRutschen();
      if (a !== vorn) a.nod();
    } else if (a.bereit && !a.unterwegs) {
      freude(this, a, { herzen: 3, hoehe: 50 });
    } else {
      a.sound();
    }
  }

  ordneSchlange() {
    this.schlange.forEach((t, i) => {
      if (t._platz === i) return;
      t._platz = i;
      t.bereit = false;
      const p = this.plaetze[Math.min(i, this.plaetze.length - 1)];
      t.zIndex = this.tierZ(Math.max(t.y, p.y));
      t.walkTo(p.x, p.y, { tempo: 210 }).then((ok) => {
        if (t._platz !== i) return;
        if (ok) {
          t.bereit = true;
          t.zIndex = this.tierZ(p.y);
          t.lookAt(this.leiterFuss.x + 400);
        } else {
          // unterbrochen: kurz danach noch einmal
          t._platz = -1;
          this.after(0.4, () => this.ordneSchlange());
        }
      });
    });
  }

  async starteRutschen() {
    this.benutzt = true;
    const a = this.schlange[0];
    if (!this.leiterFrei || !a || !a.bereit) {
      fx.wobble(this.rutsche, 0.02);
      return;
    }
    this.leiterFrei = false;
    this.schlange.shift();
    a.unterwegs = true;
    a.bereit = false;
    a._platz = -1;
    this.ordneSchlange();
    a.zIndex = 230;
    sfx('common/hupf', { vol: 0.35 });
    let ok = await a.walkTo(this.leiterFuss.x, this.leiterFuss.y, { tempo: 240 });
    if (ok) ok = await a.walkTo(this.leiterOben.x, this.leiterOben.y, { tempo: 140 });
    if (ok) ok = await a.walkTo(this.obenPunkt.x, this.obenPunkt.y, { tempo: 170 });
    if (!ok) { this.leiterFrei = true; this.zurueck(a); return; }
    a.pose('idle');
    a.lookAt(this.obenPunkt.x + 300);
    await this.wait(0.35);
    this.leiterFrei = true;
    // hinunter: erst langsam, dann schneller, unten weich auslaufen
    sfx('common/rutsch', { vol: 0.6 });
    const gesamt = this.bahnLaengen[this.bahnLaengen.length - 1];
    const proxy = { p: 0 };
    const k = a.koerper;
    await this.tween(proxy, { p: 1 }, 1.5, {
      ease: (t) => (t < 0.7 ? 0.7 * ease.quadIn(t / 0.7) * 0.85 : 0.595 + 0.405 * ease.quadOut((t - 0.7) / 0.3)),
      onUpdate: () => {
        if (a.destroyed) return;
        const s = proxy.p * gesamt;
        let i = 1;
        while (i < this.bahn.length - 1 && this.bahnLaengen[i] < s) i++;
        const p0 = this.bahn[i - 1];
        const p1 = this.bahn[i];
        const l0 = this.bahnLaengen[i - 1];
        const t = clamp((s - l0) / Math.max(1, this.bahnLaengen[i] - l0), 0, 1);
        a.x = p0.x + (p1.x - p0.x) * t;
        a.y = p0.y + (p1.y - p0.y) * t;
        k.rotation = Math.atan2(p1.y - p0.y, p1.x - p0.x) * 0.45;
      },
    });
    this.tween(k, { rotation: 0 }, 0.2, { ease: 'sineOut' });
    a.zIndex = this.tierZ(this.landung.y);
    ok = await a.hopTo(this.landung.x, this.landung.y, { hoehe: 55, dauer: 0.5 });
    await freude(this, a);
    this.rutschRunden++;
    if (this.rutschRunden % RUTSCH_TIERE.length === 0) {
      belohne(this, stickerFuer('rutsche'), this.landung.x, this.landung.y - 260);
    }
    this.zurueck(a);
  }

  zurueck(a) {
    a.unterwegs = false;
    a._platz = -1;
    this.schlange.push(a);
    this.ordneSchlange();
  }

  // ---------------------------------------------------------------- Wippe

  baueWippe() {
    const G = this.G;
    const S = WIPPE_SKALA;
    this.wippeFuss = spr('spielplatz/wippe_fuss', { x: WIPPE_X, y: G, scale: S, z: 12, parent: this.welt });
    const lager = hgPunkt(this.wippeFuss, 'lager') || bildPunkt(this.wippeFuss, 250, 110);
    const b = new PIXI.Container({ label: 'wippe' });
    b.position.set(lager.x, lager.y - 2);
    b.zIndex = 11;
    spr('spielplatz/wippe_balken', { anchor: [550 / 1100, 185 / 189], scale: S, parent: b });
    this.welt.addChild(b);
    this.wippe = b;
    this.sitze = {
      l: { x: (160 - 550) * S, y: (96 - 185) * S },
      r: { x: (960 - 550) * S, y: (96 - 185) * S },
    };
    this.wippeTiere = {
      l: new Actor('schaf', { scale: TIER_SKALA, parent: this.welt, z: 14 }),
      r: new Actor('schwein', { scale: TIER_SKALA, parent: this.welt, z: 14, flip: true }),
    };
    for (const seite of SEITEN) {
      const t = this.wippeTiere[seite];
      t.schatten.visible = false;
      t.onTap(() => this.wippen(seite), { pad: 60 });
    }
    this.wz = { w: WIPPE_MAX * 0.7, v: 0, ziel: WIPPE_MAX, unten: 'r', aufgesetzt: true, zaehler: 0 };
    tap(b, (e) => this.wippen(e.x < WIPPE_X ? 'l' : 'r'), {
      sound: null, squash: false, hitArea: new PIXI.Rectangle(-340, -150, 680, 200),
    });
    tap(this.wippeFuss, () => this.wippen(this.wz.unten === 'l' ? 'r' : 'l'), { sound: null, squash: false });
    this.wippeUpdate(0);
  }

  wippen(seite) {
    this.benutzt = true;
    const z = this.wz;
    if (z.unten === seite && z.aufgesetzt) {
      // schon unten: kleiner Hopser mit derselben Seite
      z.v += (seite === 'l' ? 1 : -1) * 0.9;
      z.aufgesetzt = false;
      freude(this, this.wippeTiere[seite], { laut: false, herzen: 2, hoehe: 30 });
      return;
    }
    z.unten = seite;
    z.ziel = seite === 'l' ? -WIPPE_MAX : WIPPE_MAX;
    z.aufgesetzt = false;
    this.ton('common/wusch', { vol: 0.25, rate: 0.9 });
  }

  wippeUpdate(dt) {
    const z = this.wz;
    if (dt > 0) {
      const vorher = z.w;
      z.v += ((z.ziel - z.w) * 20 - z.v * 5.5) * dt;
      z.w += z.v * dt;
      // Boden: weiter als bis zum Aufsetzen geht es nicht
      if (Math.abs(z.w) > WIPPE_MAX) {
        z.w = Math.sign(z.w) * WIPPE_MAX;
        z.v *= -0.25;
      }
      // Aufsetzen auf der Zielseite: weiches Tock, das obere Tier hüpft leicht
      const zielSeite = Math.sign(z.ziel);
      if (!z.aufgesetzt && Math.sign(z.w) === zielSeite && Math.abs(z.w) >= WIPPE_MAX - 0.01 &&
          Math.abs(vorher) < WIPPE_MAX - 0.001) {
        z.aufgesetzt = true;
        sfx('common/landen', { vol: 0.45 });
        const oben = this.wippeTiere[z.unten === 'l' ? 'r' : 'l'];
        oben.hop(40);
        z.zaehler++;
        if (z.zaehler % 3 === 0) oben.sound();
      } else if (!z.aufgesetzt && Math.abs(z.v) < 0.02 && Math.abs(z.ziel - z.w) < 0.01) {
        z.aufgesetzt = true;
      }
    }
    this.wippe.rotation = z.w;
    const c = Math.cos(z.w);
    const s = Math.sin(z.w);
    for (const seite of SEITEN) {
      const p = this.sitze[seite];
      const t = this.wippeTiere[seite];
      t.position.set(this.wippe.x + p.x * c - p.y * s, this.wippe.y + p.x * s + p.y * c + 4);
    }
  }

  // ---------------------------------------------------------------- Federwippe

  baueFederwippe() {
    const f = spr('spielplatz/federwippe', { x: -760, y: 1488, scale: 0.5, z: 300, parent: this.welt });
    this.federwippe = f;
    this.fw = { w: 0, v: 0, richtung: 1 };
    tap(f, () => {
      this.benutzt = true;
      this.fw.v += this.fw.richtung * 1.6;
      this.fw.richtung *= -1;
      this.ton('common/hupf', { vol: 0.45 });
    }, { sound: null, squash: false });
  }

  federUpdate(dt) {
    const z = this.fw;
    z.v += (-55 * z.w - 2.2 * z.v) * dt;
    z.w = clamp(z.w + z.v * dt, -0.28, 0.28);
    this.federwippe.rotation = z.w;
  }

  // ---------------------------------------------------------------- Karussell

  baueKarussell() {
    const id = 'spielplatz/karussell';
    const k = new PIXI.Container({ label: 'karussell', sortableChildren: true });
    k.position.set(KARUSSELL_ORT.x, KARUSSELL_ORT.y);
    k.scale.set(KARUSSELL_SKALA);
    k.zIndex = 300;
    const AX = 394;      // Anker (unten Mitte) im Bild
    const AY = 885;
    const teil = (x, y, w, h, z) => {
      const s = new PIXI.Sprite(teilTextur(id, x, y, w, h));
      s.position.set(x - AX, y - AY);
      s.zIndex = z;
      k.addChild(s);
      return s;
    };
    teil(0, 0, 788, 503, 4);          // Dach mit oberer Stange
    teil(0, 655, 788, 245, 0);        // Drehteller und Fuß
    // Stange zwischen Dach und Teller (im Bild hinter dem gelben Sitz verborgen) – selbst gezeichnet
    const stange = new PIXI.Graphics()
      .roundRect(KARUSSELL_MITTE - 30, 495 - AY, 60, 180, 14).fill(0xf0b030)
      .roundRect(KARUSSELL_MITTE - 18, 495 - AY, 14, 180, 7).fill({ color: 0xffd877, alpha: 0.8 });
    stange.zIndex = 2;
    k.addChild(stange);
    this.karussellSitze = KARUSSELL_SITZE.map((o) => {
      const s = new PIXI.Sprite(teilTextur(id, o.x, 505, o.w, 152));
      s.anchor.set(0.5, 1);
      s.basis = o.winkel;
      k.addChild(s);
      return s;
    });
    // ein Igel fährt auf dem vorderen Sitz mit (dreht sich mit ihm, ist hinten hinter der Stange)
    this.reiter = new Actor('igel', { x: 0, y: 0, scale: REITER_SKALA / KARUSSELL_SKALA, parent: k });
    this.reiter.schatten.visible = false;
    this.reiter.eventMode = 'none';
    this.welt.addChild(k);
    this.karussell = k;
    this.kz = { dreht: false, phi: 0, noteZeit: -9 };
    this.stelleSitze(0);
    tap(k, () => this.dreheKarussell(), {
      sound: null, squash: false, hitArea: new PIXI.Rectangle(-420, -900, 840, 900),
    });
  }

  stelleSitze(phi) {
    for (const s of this.karussellSitze) {
      const w = s.basis + phi;
      const c = Math.cos(w);
      s.x = KARUSSELL_MITTE + Math.sin(w) * KARUSSELL_R;
      s.y = 657 - 885 - 16 * (1 - c);
      s.scale.set(1 - 0.09 * (1 - c));
      s.zIndex = c < -0.05 ? 1 : 3;
    }
    // der Reiter sitzt auf dem vorderen Sitz (Ruhe-Winkel 0)
    const sitz = this.karussellSitze[1];
    const r = this.reiter;
    if (r && sitz) {
      r.position.set(sitz.x + 4, sitz.y - 40 * sitz.scale.y);
      r.scale.set((REITER_SKALA / KARUSSELL_SKALA) * sitz.scale.y);
      // vorn vor Stange und Dachrand, seitlich zwischen Sitz und Dach, hinten hinter der Stange
      const c = Math.cos(sitz.basis + phi);
      r.zIndex = c > 0.3 ? 5 : sitz.zIndex + 0.5;
    }
  }

  async dreheKarussell() {
    this.benutzt = true;
    if (this.kz.dreht) {
      // läuft schon: nur ein Wackeln, die Melodie spielt allein weiter (keine gestapelten Noten)
      fx.wobble(this.karussell, 0.02);
      return;
    }
    this.kz.dreht = true;
    MELODIE.forEach((n, i) => this.after(i * 0.5, () => note('glocke', n, { vol: 0.28 })));
    const dach = inVorn(this, this.welt, { x: this.karussell.x, y: this.karussell.y - 380 });
    this.reiter.pose('happy');
    if (dach) this.burst('noten', dach.x, dach.y, { count: 3 });
    const proxy = { p: 0 };
    await this.tween(proxy, { p: 1 }, 4.2, {
      ease: 'sineInOut',
      onUpdate: () => this.stelleSitze(proxy.p * Math.PI * 2),
    });
    this.stelleSitze(0);
    this.kz.dreht = false;
    this.reiter.pose('idle');
    if (!(store.stickers?.() || []).includes('spielplatz_karussell')) {
      belohne(this, 'spielplatz_karussell', this.karussell.x - 160, 760);
    }
  }

  // ---------------------------------------------------------------- Ablauf

  betreten() {
    // Hinweis bei jedem Betreten anmelden (der Kern sagt ihn höchstens einmal am Tag) – aber nur, solange die Seite
    // zu sehen ist und das Kind noch kein Gerät angetippt hat (nurWenn: auch, wenn er erst später an die Reihe kommt)
    this.hinweisAus();
    if (this.benutzt) return;
    const passt = () => this.aktiv && !this.benutzt;
    this._hinweis = this.after(this.besuche === 1 ? 0.6 : 1.2, () => {
      if (passt()) voice('spielplatz_geraete', { nurWenn: passt });
    });
  }

  verlassen() {
    this.hinweisAus();
  }

  hinweisAus() {
    this._hinweis?.kill();
    this._hinweis = null;
  }

  update(dt) {
    this.zeit += dt;
    this.wolken.update(dt);
    this.falter.update(dt);
    this.vogel.update(dt);
    this.schaukelUpdate(dt);
    this.wippeUpdate(dt);
    this.federUpdate(dt);
  }

  hinweise() {
    const liste = [];
    const vorn = this.schlange[0];
    if (vorn && vorn.bereit && this.leiterFrei) liste.push(vorn);
    liste.push(this.brett, this.wippeTiere.l, this.karussell);
    return liste;
  }
}
