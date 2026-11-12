// Seite 3 – Sandkasten (schräg von oben):
//   Über der Sandfläche liegt eine glatte Sanddecke; darunter fünf zufällige Schätze. Mit dem Finger graben
//   (wegwischen) legt sie frei; freigelegten Schatz antippen → er hüpft in die Sammelreihe am Rand.
//   Alle fünf gefunden → der Hund freut sich, Sticker; die Schätze wandern in den Eimer, der Sand wird wieder
//   glatt und neue Schätze liegen darunter.
//   Förmchen (Stern, Fisch) antippen → auf seiner Seite am Rand entsteht ein Sandkuchen; antippen → zerfällt.

import {
  spr, tex, Actor, tap, wipe, sfx, note, voice, fx, killTweensOf, rand, pick, shuffle, clamp, stage, PIXI,
} from '../../engine/index.js';
import { Seite } from '../../gemeinsam/seiten.js';
import { belohne } from '../../gemeinsam/sticker.js';
import { freude, stickerFuer, merker, Schmetterling } from './helfer.js';

const SCHAETZE = ['auto', 'ball', 'dino', 'ente', 'krone', 'muschel', 'ring', 'schaufel', 'schluessel', 'stern'];
const ANZAHL = 5;
const SCHATZ_GROESSE = 175;     // Einheiten (längere Seite) im Sand
const REIHE_GROESSE = 150;      // in der Sammelreihe
const FREI_AB = 0.55;           // Anteil freigelegter Probepunkte, ab dem ein Schatz antippbar ist
const WISCH_RADIUS = 125;
const PENTA = [72, 74, 76, 79, 81];
// Ruhe-Regel: nichts fliegt schneller als etwa so viele Einheiten/s (Spitze, die Grenze liegt bei etwa 1500)
const FLUG_TEMPO = 1200;

// Die ganze Sandfläche innen am Holzrand (Szenen-Koordinaten, aus dem Hintergrund abgelesen). Die Ecken oben sind
// für Karten- und Album-Knopf abgeschnitten.
const SAND = [
  [-1180, 270], [-1020, 212], [1020, 212], [1076, 270], [1150, 1308], [-1240, 1308],
];
const SAND_BOX = { x: -1250, y: 200, w: 2410, h: 1120 };   // umschließendes Rechteck
const DECKE_RES = 0.6;          // Auflösung der Decke (Bildpunkte je Einheit) – Sand verträgt das gut
// Ersatz, falls der Hintergrund nicht gelesen werden kann: die gemalte Sanddecke in der Mitte
const DECKE_ERSATZ = { x: 0, y: 770, w: 1300, h: 780 };
// Hier dürfen Schätze liegen: frei von Förmchen, Kuchenplätzen, Hund, Schaufel und Blätter-Pfeilen
const SCHATZ_RAUM = { x0: -680, x1: 680, y0: 520, y1: 1170 };

export class Sandkasten extends Seite {
  static hg = 'spielplatz/hg_sandkasten';

  aufbau() {
    this.finger = new Map();   // pointerId → letzter Punkt (zum Freilegen der Schätze)
    this.gefunden = 0;
    this.feiert = false;
    this.kuchenGetippt = false;
    this.gegraben = false;     // schon einmal im Sand gegraben (dann kein Hinweis mehr aufs Graben)
    this._hinweise = [];

    this.baueSandRand();
    this.baueGrube();
    this.baueSchaetze();
    this.baueDecke();
    this.baueReihe();
    this.baueEimer();
    this.baueHund();
    this.baueFoermchen();
    this.baueSchaufel();
    // Schmetterling gaukelt über dem hinteren Holzrand (vorn liegt die Sammelreihe)
    this.falter = new Schmetterling(this, {
      x: -600, y: 190, farbe: 2, z: 400, scale: 0.85,
      bereich: { x0: -900, x1: 820, y0: 150, y1: 230 },
    });
    this.verteileSchaetze();
    // Merkpunkte für die Zeige-Hand (Graben = Ziehbewegung über dem Sand)
    this.handVon = merker(this.welt);
    this.handNach = merker(this.welt);
  }

  // ---------------------------------------------------------------- Grube und Decke

  // Ganz unten: die ganze Sandfläche reagiert (wenn die Decke gerade weg ist, z. B. nach dem Freilegen)
  baueSandRand() {
    const c = new PIXI.Container({ label: 'sandRand' });
    c.zIndex = 5;
    this.welt.addChild(c);
    this.randZeit = -9;
    tap(c, (e) => {
      const jetzt = performance.now() / 1000;
      if (jetzt - this.randZeit < 0.35) return;
      this.randZeit = jetzt;
      sfx('common/graben', { vol: 0.3 });
      this.burst('staub', e.x, e.y, { count: 3 });
    }, { sound: null, squash: false, hitArea: new PIXI.Polygon(SAND.flat()) });
  }

  // Unter der Decke ist der Sand etwas dunkler: freigelegte Stellen sehen aus wie gegraben
  baueGrube() {
    const b = SAND_BOX;
    const g = new PIXI.Sprite(grubeTextur());
    g.position.set(b.x, b.y);
    g.scale.set(b.w / GRUBE.w, b.h / GRUBE.h);
    g.zIndex = 30;
    g.eventMode = 'none';
    this.welt.addChild(g);
  }

  baueDecke() {
    // Die Decke ist der gemalte Sand selbst (aus dem Hintergrund ausgeschnitten, weicher Rand) – sie sieht aus wie
    // der Sandkasten, und überall, wo das Kind gräbt, kommt der dunklere, gegrabene Sand darunter zum Vorschein.
    let s = null;
    let flaeche;
    const t = this.hg ? deckenTextur(this.hg) : null;
    if (t) {
      const b = SAND_BOX;
      s = new PIXI.Sprite(t);
      s.label = 'sanddecke';
      s.position.set(b.x, b.y);
      s.scale.set(1 / DECKE_RES);
      s.zIndex = 50;
      this.welt.addChild(s);
      // die Textur gehört nur zu diesem Besuch (wipe() gibt sie beim Zerstören der Decke zurück)
      s.once('destroyed', () => { if (!t.destroyed) t.destroy(true); });
      flaeche = new PIXI.Polygon(SAND.flatMap(([x, y]) => [(x - b.x) * DECKE_RES, (y - b.y) * DECKE_RES]));
    } else {
      const d = DECKE_ERSATZ;
      s = spr('spielplatz/sanddecke', { x: d.x, y: d.y, anchor: 0.5, z: 50, parent: this.welt });
      s.scale.set(d.w / s.texture.width, d.h / s.texture.height);
    }
    this.decke = s;
    this.graben = wipe(s, {
      radius: WISCH_RADIUS,
      sound: 'common/graben',
      doneAt: 0.85,
      hitArea: flaeche,
      onDone: () => {
        // ganz frei: alle übrigen Schätze sind jetzt zu sehen
        for (const sch of this.schaetze) if (!sch.frei && sch.imSand) this.legeFrei(sch);
        this.after(0.8, () => { if (!this.decke.destroyed) this.decke.eventMode = 'none'; });
      },
    });
    // Eigene Spur der grabenden Finger: welche Probepunkte der Schätze sind frei?
    s.on('pointerdown', (e) => {
      this.gegraben = true;
      if (this.graben.isDone()) return;
      const p = this.welt.toLocal(e.global);
      this.finger.set(e.pointerId, p);
      this.markiere(p, p);
    });
    // Der Kern schaltet Pixis Bewegungs-Ereignisse ab (er verfolgt Finger selbst am Fenster) – darum hier eigene
    // Fenster-Zuhörer; sie enden, wenn die Decke beim Verlassen der Szene zerstört wird.
    const roh = new PIXI.Point();
    const zuWelt = (ev) => {
      stage.app.renderer.events.mapPositionToPoint(roh, ev.clientX, ev.clientY);
      return this.welt.toLocal(roh);
    };
    const bewegt = (ev) => {
      const alt = this.finger.get(ev.pointerId);
      if (!alt || s.destroyed || this.graben.isDone()) return;
      const p = zuWelt(ev);
      this.markiere(alt, p);
      this.finger.set(ev.pointerId, p);
    };
    const los = (ev) => {
      if (ev.type === 'pointerup' && this.finger.has(ev.pointerId)) bewegt(ev);
      this.finger.delete(ev.pointerId);
    };
    window.addEventListener('pointermove', bewegt, { passive: true });
    window.addEventListener('pointerup', los, { passive: true });
    window.addEventListener('pointercancel', los, { passive: true });
    s.once('destroyed', () => {
      window.removeEventListener('pointermove', bewegt);
      window.removeEventListener('pointerup', los);
      window.removeEventListener('pointercancel', los);
    });
  }

  // Probepunkte nahe der Strecke a→b als gegraben markieren
  markiere(a, b) {
    const r = WISCH_RADIUS * 0.85;
    const r2 = r * r;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const l2 = dx * dx + dy * dy || 1;
    for (const sch of this.schaetze) {
      if (!sch.imSand || sch.frei) continue;
      let neu = false;
      for (const p of sch.proben) {
        if (p.weg) continue;
        const t = clamp(((p.x - a.x) * dx + (p.y - a.y) * dy) / l2, 0, 1);
        const qx = a.x + dx * t - p.x;
        const qy = a.y + dy * t - p.y;
        if (qx * qx + qy * qy <= r2) { p.weg = true; neu = true; }
      }
      if (neu && sch.proben.filter((p) => p.weg).length / sch.proben.length >= FREI_AB) this.legeFrei(sch);
    }
  }

  // ---------------------------------------------------------------- Schätze

  baueSchaetze() {
    this.schaetze = [];
    for (let i = 0; i < ANZAHL; i++) {
      const s = spr('spielplatz/schatz_' + SCHAETZE[i], { anchor: 0.5, z: 40, parent: this.welt });
      s.visible = false;
      s.imSand = false;
      s.frei = false;
      s.proben = [];
      // Fangfläche über der Decke: erst aktiv, wenn der Schatz freigelegt ist
      const fang = new PIXI.Container({ label: 'schatzFang' });
      fang.zIndex = 60;
      this.welt.addChild(fang);
      tap(fang, () => this.hebeAuf(s), { sound: null, squash: false, hitArea: new PIXI.Circle(0, 0, 140) });
      fang.eventMode = 'none';
      s.fang = fang;
      // in der Reihe: antippen → wackelt und klingt
      tap(s, () => {
        if (s.inReihe) {
          fx.wobble(s, 0.12);
          note('xylo', pick(PENTA), { vol: 0.4 });
        }
      }, { sound: null, squash: true, hitArea: new PIXI.Circle(0, 0, 400) });
      s.eventMode = 'none';
      this.schaetze.push(s);
    }
  }

  verteileSchaetze() {
    const arten = shuffle([...SCHAETZE]).slice(0, ANZAHL);
    const r = SCHATZ_RAUM;
    const orte = [];
    for (let i = 0; i < ANZAHL; i++) {
      let best = null;
      for (let v = 0; v < 40; v++) {
        const p = { x: rand(r.x0, r.x1), y: rand(r.y0, r.y1) };
        const abstand = Math.min(...orte.map((o) => Math.hypot(o.x - p.x, (o.y - p.y) * 1.3)), 9999);
        if (!best || abstand > best.abstand) best = { ...p, abstand };
        if (abstand > 360) break;
      }
      orte.push(best);
    }
    this.schaetze.forEach((s, i) => {
      killTweensOf(s);
      const id = 'spielplatz/schatz_' + arten[i];
      s.texture = tex(id);
      s.label = id;
      s.art = arten[i];
      const k = SCHATZ_GROESSE / Math.max(s.texture.width, s.texture.height);
      s.basis = k;
      s.scale.set(k);
      s.rotation = rand(-0.35, 0.35);
      s.alpha = 1;
      s.zIndex = 40;
      s.visible = true;
      s.imSand = true;
      s.frei = false;
      s.inReihe = false;
      s.eventMode = 'none';
      s.fang.eventMode = 'none';
      this.setzeSchatz(s, orte[i].x, orte[i].y);
    });
  }

  // Schatz an eine Stelle im Sand legen (Fangfläche und Probepunkte wandern mit)
  setzeSchatz(s, x, y) {
    s.position.set(x, y);
    s.fang.position.set(x, y);
    tippGroesse(s);
    // Probepunkte: 3×3 Raster über dem Schatz
    s.proben = [];
    for (const fx_ of [-0.32, 0, 0.32]) {
      for (const fy of [-0.32, 0, 0.32]) {
        s.proben.push({ x: x + fx_ * SCHATZ_GROESSE, y: y + fy * SCHATZ_GROESSE, weg: false });
      }
    }
  }

  legeFrei(s) {
    if (s.frei || !s.imSand) return;
    s.frei = true;
    s.fang.eventMode = 'static';
    // leiser Hinweis: kurzes Funkeln, der Schatz wackelt
    this.burst('funkeln', s.x, s.y, { count: 3 });
    sfx('common/funkeln', { vol: 0.25 });
    fx.wobble(s, 0.1);
  }

  async hebeAuf(s) {
    if (!s.frei || !s.imSand) return;
    s.imSand = false;
    s.fang.eventMode = 'none';
    const platz = this.reihe[this.gefunden];
    this.gefunden++;
    sfx('common/funkeln', { vol: 0.6 });
    this.burst('funkeln', s.x, s.y, { count: 6 });
    s.zIndex = 70;
    const x0 = s.x;
    const y0 = s.y;
    const k0 = s.scale.x;
    const k1 = REIHE_GROESSE / Math.max(s.texture.width, s.texture.height);
    const proxy = { p: 0 };
    await this.tween(proxy, { p: 1 }, flugDauer(platz.x - x0, platz.y - y0, 260, 0.85), {
      ease: 'sineInOut',
      onUpdate: () => {
        const p = proxy.p;
        s.x = x0 + (platz.x - x0) * p;
        s.y = y0 + (platz.y - y0) * p - 260 * 4 * p * (1 - p);
        s.scale.set(k0 + (k1 - k0) * p + 0.15 * k0 * 4 * p * (1 - p));
        s.rotation *= 0.9;
      },
    });
    s.rotation = 0;
    s.basis = k1;
    tippGroesse(s);
    s.inReihe = true;
    s.eventMode = 'static';
    sfx('common/plopp', { vol: 0.4 });
    fx.pop(s, 0.1);
    if (this.gefunden >= ANZAHL) this.feiern();
    else if (Math.random() < 0.5) this.hund.lookAt(s.x);
  }

  // ---------------------------------------------------------------- Sammelreihe und Eimer

  baueReihe() {
    // auf dem vorderen Holzrand, mittig
    this.reihe = [];
    for (let i = 0; i < ANZAHL; i++) this.reihe.push({ x: (i - (ANZAHL - 1) / 2) * 235, y: 1408 });
  }

  baueEimer() {
    this.eimer = spr('spielplatz/eimer_sand', { x: -890, y: 1478, scale: 0.55, z: 80, parent: this.welt });
    tap(this.eimer, () => {
      fx.wobble(this.eimer, 0.08);
      sfx('common/sand', { vol: 0.5 });
      this.burst('staub', this.eimer.x, this.eimer.y - 200, { count: 4 });
    }, { sound: null, squash: true });
  }

  async feiern() {
    if (this.feiert) return;
    this.feiert = true;
    await this.wait(0.4);
    freude(this, this.hund, { herzen: 6 });
    belohne(this, stickerFuer('schatz'), 0, 600);
    await this.wait(2.6);
    // die Schätze wandern nacheinander in den Eimer
    const oeffnung = { x: this.eimer.x + 5, y: this.eimer.y - 205 };
    const reihe = this.schaetze.filter((s) => s.inReihe);
    const fluege = [];
    for (const s of reihe) {
      s.inReihe = false;
      s.eventMode = 'none';
      const x0 = s.x;
      const y0 = s.y;
      const k0 = s.scale.x;
      const proxy = { p: 0 };
      fluege.push(this.tween(proxy, { p: 1 }, flugDauer(oeffnung.x - x0, oeffnung.y - y0, 220, 0.75), {
        ease: 'sineInOut',
        onUpdate: () => {
          const p = proxy.p;
          s.x = x0 + (oeffnung.x - x0) * p;
          s.y = y0 + (oeffnung.y - y0) * p - 220 * 4 * p * (1 - p);
          s.scale.set(k0 * (1 - 0.55 * p));
          s.alpha = p > 0.8 ? 1 - (p - 0.8) / 0.2 : 1;
        },
      }).then((ok) => {
        if (!ok) return;
        s.visible = false;
        sfx('common/sand', { vol: 0.35 });
        fx.pop(this.eimer, 0.06);
      }));
      await this.wait(0.4);
    }
    // erst wenn alle im Eimer sind (weite Flüge dauern länger), wird der Sand wieder glatt
    await Promise.all(fluege);
    await this.wait(0.4);
    // Sand wird weich wieder glatt, darunter liegen neue Schätze
    this.decke.eventMode = 'static';
    this.graben.reset({ fade: 1.6 });
    this.finger.clear();
    sfx('common/sand', { vol: 0.4 });
    await this.wait(1.7);
    this.gefunden = 0;
    this.verteileSchaetze();
    this.feiert = false;
  }

  // ---------------------------------------------------------------- Hund

  baueHund() {
    // sitzt hinten am Rand des Sandkastens und schaut zu
    this.hund = new Actor('hund', { x: 30, y: 352, scale: 0.26, parent: this.welt, z: 58 });
    this.hund.onTap(() => freude(this, this.hund));
  }

  // ---------------------------------------------------------------- Förmchen und Sandkuchen

  baueFoermchen() {
    this.plaetze = [
      { x: -860, y: 905 }, { x: 860, y: 905 }, { x: -880, y: 1225 }, { x: 870, y: 1225 },
    ].map((p) => ({ ...p, kuchen: null, zeit: 0 }));
    this.kuchenNr = 0;
    this.foermchen = [
      { art: 'stern', x: -860, y: 600 },
      { art: 'fisch', x: 880, y: 600 },
    ].map((o) => {
      const f = spr('spielplatz/foermchen_' + o.art, { x: o.x, y: o.y, scale: 0.68, z: 55, parent: this.welt });
      f.art = o.art;
      f.heim = { x: o.x, y: o.y };
      f.beschaeftigt = false;
      tap(f, () => this.backe(f), { sound: null, squash: true, pad: 50 });
      return f;
    });
  }

  freierPlatz(f) {
    // Jedes Förmchen backt auf seiner Seite (kein weiter Flug quer über den Sandkasten): freier Platz dort, sonst
    // zerfällt dort der älteste Kuchen und der neue entsteht an seiner Stelle. Nur zur Sicherheit: irgendein Platz.
    const eigene = this.plaetze.filter((p) => Math.sign(p.x) === Math.sign(f.heim.x));
    const frei = eigene.find((p) => !p.kuchen && !p.reserviert);
    if (frei) return frei;
    const aelteste = (liste) => liste.filter((p) => p.kuchen && !p.reserviert).sort((a, b) => a.zeit - b.zeit)[0];
    const alt = aelteste(eigene) || this.plaetze.find((p) => !p.kuchen && !p.reserviert) || aelteste(this.plaetze);
    if (alt) this.zerfalle(alt);
    return alt || null;
  }

  async backe(f) {
    this.kuchenGetippt = true;   // das Kind kennt die Förmchen schon: kein Hinweis mehr darauf
    if (f.beschaeftigt) {
      fx.wobble(f, 0.06);
      return;
    }
    const platz = this.freierPlatz(f);
    if (!platz) { fx.wobble(f, 0.06); return; }
    f.beschaeftigt = true;
    platz.reserviert = true;
    f.zIndex = 90;
    const k = f.scale.x;
    sfx('common/hupf', { vol: 0.35 });
    // hinüberhüpfen
    const x0 = f.x;
    const y0 = f.y;
    const proxy = { p: 0 };
    await this.tween(proxy, { p: 1 }, flugDauer(platz.x - x0, platz.y - y0, 120, 0.55), {
      ease: 'sineInOut',
      onUpdate: () => {
        f.x = x0 + (platz.x - x0) * proxy.p;
        f.y = y0 + (platz.y - y0) * proxy.p - 120 * 4 * proxy.p * (1 - proxy.p);
      },
    });
    // andrücken
    await this.tween(f, { scaleX: k * 1.08, scaleY: k * 0.86 }, 0.18, { ease: 'quadOut' });
    sfx('common/sand', { vol: 0.5 });
    // Kuchen entsteht unter dem Förmchen
    const kuchen = spr('spielplatz/sandkuchen_' + f.art, { x: platz.x, y: platz.y, scale: 0.6, z: 52, parent: this.welt });
    kuchen.alpha = 0;
    platz.kuchen = kuchen;
    platz.zeit = ++this.kuchenNr;
    this.tween(kuchen, { alpha: 1 }, 0.3, { ease: 'sineInOut' });
    tap(kuchen, () => this.zerfalle(platz), { sound: null, squash: true, pad: 50 });
    await this.tween(f, { scaleX: k, scaleY: k, y: platz.y - 110 }, 0.35, { ease: 'backOut' });
    this.burst('staub', platz.x, platz.y - 20, { count: 5 });
    platz.reserviert = false;
    // zurück an den Platz
    const x1 = f.x;
    const y1 = f.y;
    proxy.p = 0;
    await this.tween(proxy, { p: 1 }, flugDauer(f.heim.x - x1, f.heim.y - y1, 80, 0.55), {
      ease: 'sineInOut',
      onUpdate: () => {
        f.x = x1 + (f.heim.x - x1) * proxy.p;
        f.y = y1 + (f.heim.y - y1) * proxy.p - 80 * 4 * proxy.p * (1 - proxy.p);
      },
    });
    f.zIndex = 55;
    f.beschaeftigt = false;
  }

  zerfalle(platz) {
    const kuchen = platz.kuchen;
    if (!kuchen || kuchen.zerfaellt) return;
    kuchen.zerfaellt = true;
    kuchen.eventMode = 'none';
    platz.kuchen = null;
    sfx('common/sand', { vol: 0.55 });
    this.burst('staub', kuchen.x, kuchen.y - 50, { count: 7 });
    const k = kuchen.scale.y;
    killTweensOf(kuchen);
    this.tween(kuchen, { scaleY: k * 0.25, scaleX: k * 1.3, alpha: 0 }, 0.8, { ease: 'sineInOut' })
      .then(() => { if (!kuchen.destroyed) kuchen.destroy(); });
  }

  // ---------------------------------------------------------------- Schaufel (Deko, reagiert)

  baueSchaufel() {
    // steckt hinten rechts im Sand (frei von Kuchenplätzen, Förmchen und Schätzen)
    const s = spr('spielplatz/schaufel_gross', { x: 560, y: 340, scale: 0.46, rotation: 0.28, z: 54, parent: this.welt });
    this.schaufel = s;
    tap(s, () => {
      fx.wobble(s, 0.1);
      sfx('common/graben', { vol: 0.45 });
      this.burst('staub', s.x + 20, s.y + 90, { count: 4 });
    }, { sound: null, squash: false, pad: 70 });
  }

  // ---------------------------------------------------------------- Ablauf

  betreten() {
    // Hinweise bei jedem Betreten anmelden (der Kern sagt jeden höchstens einmal am Tag) – aber nur, solange die
    // Seite zu sehen ist und das Kind das noch nicht selbst tut (nurWenn: auch, wenn er erst später an die Reihe kommt)
    this.hinweiseAus();
    const erst = this.besuche === 1;
    const grabenNoch = () => this.aktiv && !this.gegraben;
    const kuchenNoch = () => this.aktiv && !this.kuchenGetippt;
    this._hinweise = [
      this.after(erst ? 0.6 : 1.2, () => { if (grabenNoch()) voice('spielplatz_graben', { nurWenn: grabenNoch }); }),
      this.after(erst ? 14 : 9, () => { if (kuchenNoch()) voice('spielplatz_kuchen', { nurWenn: kuchenNoch }); }),
    ];
  }

  verlassen() {
    this.finger.clear();
    this.hinweiseAus();
  }

  hinweiseAus() {
    for (const h of this._hinweise || []) h?.kill();
    this._hinweise = [];
  }

  update(dt) {
    this.falter.update(dt);
  }

  hinweise() {
    const liste = [];
    const frei = this.schaetze.find((s) => s.frei && s.imSand);
    if (frei) liste.push({ x: frei.x, y: frei.y });
    if (!this.graben.isDone() && !this.feiert) {
      const ziel = this.schaetze.find((s) => s.imSand && !s.frei);
      if (ziel) {
        this.handVon.position.set(ziel.x - 220, ziel.y - 60);
        this.handNach.position.set(ziel.x + 200, ziel.y + 60);
        liste.push({ von: this.handVon, nach: this.handNach });
      }
    }
    liste.push(this.foermchen[0]);
    return liste;
  }
}

// Die beiden gezeichneten Hilfsbilder des Sandkastens schon beim Betreten des Spielplatzes anlegen (die Blende ist
// dann noch zu), damit das erste Umblättern zum Sandkasten nichts mehr zeichnen muss.
export function sandkastenVorbereiten() {
  grubeTextur();
  gegenMaske();
}

// Leinwände für Texturen werden mit willReadFrequently angelegt: Dann liegen sie im Arbeitsspeicher, und das
// Hochladen zur Grafikkarte ist eine einfache Kopie. Eine Leinwand auf der Grafikkarte müsste dafür erst
// zurückgelesen werden – das ließ das Umblättern spürbar stocken.

// Gegrabener (etwas feuchterer, dunklerer) Sand mit weichem Rand und ein paar Krümeln, so groß wie die ganze
// Sandfläche – einmal je Modul gezeichnet und wiederverwendet (Texturen aus Leinwänden nie pro Besuch anlegen).
const GRUBE = { w: 964, h: 448 };   // = SAND_BOX × 0,4
let grubeTex = null;
function grubeTextur() {
  if (grubeTex && !grubeTex.destroyed) return grubeTex;
  const c = document.createElement('canvas');
  c.width = GRUBE.w;
  c.height = GRUBE.h;
  const g = c.getContext('2d', { willReadFrequently: true });
  const k = GRUBE.w / SAND_BOX.w;
  const mx = SAND_BOX.x + SAND_BOX.w / 2;
  const my = SAND_BOX.y + SAND_BOX.h / 2;
  const trapez = (einzug) => {
    // Sandfläche, zur Mitte hin um den Anteil `einzug` eingerückt
    g.beginPath();
    SAND.forEach(([x, y], i) => {
      const px = (x + (mx - x) * einzug - SAND_BOX.x) * k;
      const py = (y + (my - y) * einzug - SAND_BOX.y) * k;
      if (i === 0) g.moveTo(px, py);
      else g.lineTo(px, py);
    });
    g.closePath();
    g.fill();
  };
  g.filter = 'blur(10px)';
  g.fillStyle = 'rgba(150, 95, 40, 0.30)';
  trapez(0.03);
  g.filter = 'blur(16px)';
  g.fillStyle = 'rgba(135, 85, 35, 0.12)';
  trapez(0.25);
  g.filter = 'none';
  // Krümel: kleine dunkle und helle Tupfer (fester Zufall, damit es immer gleich aussieht)
  let z = 7;
  const zufall = () => {
    z = (z * 16807) % 2147483647;
    return z / 2147483647;
  };
  for (let i = 0; i < 160; i++) {
    const x = 40 + zufall() * (GRUBE.w - 80);
    const y = 30 + zufall() * (GRUBE.h - 60);
    const hell = zufall() < 0.4;
    g.fillStyle = hell ? 'rgba(255, 236, 190, 0.22)' : 'rgba(140, 90, 40, 0.14)';
    g.beginPath();
    g.ellipse(x, y, 1 + zufall() * 2, 0.8 + zufall() * 1.5, 0, 0, Math.PI * 2);
    g.fill();
  }
  grubeTex = PIXI.Texture.from(c);
  return grubeTex;
}

// Decke = gemalter Sand des Hintergrunds im Trapez der Sandfläche, Rand weich ausgeblendet. Sie entsteht ganz auf
// der Grafikkarte: Hintergrund-Ausschnitt in eine RenderTexture zeichnen, außerhalb des Trapezes mit einer weichen
// Gegen-Maske ('erase') wegnehmen. So wird bei jedem Besuch nichts auf dem Prozessor gemalt, nichts zurückgelesen
// und nichts zusätzlich hochgeladen – das Umblättern zum Sandkasten stockt nicht. (wipe() kann eine RenderTexture nicht auslesen und
// zählt dann die Zellen einer Ellipse über der Fläche – die liegt ganz im Sand; die Ecken muss niemand freilegen.)
// Die Textur gehört zu einem Besuch und wird mit der Decke zerstört (siehe baueDecke).
function deckenTextur(hg) {
  try {
    const b = SAND_BOX;
    const rt = PIXI.RenderTexture.create({
      width: Math.round(b.w * DECKE_RES), height: Math.round(b.h * DECKE_RES), resolution: 1,
    });
    // Bühne in Decken-Bildpunkten: Ursprung = linke obere Ecke der SAND_BOX
    const buehne = new PIXI.Container();
    buehne.scale.set(DECKE_RES);
    buehne.position.set(-b.x * DECKE_RES, -b.y * DECKE_RES);
    const bild = new PIXI.Sprite(hg.texture);
    bild.anchor.copyFrom(hg.anchor);
    bild.scale.copyFrom(hg.scale);
    bild.position.set(hg.x, hg.y);
    bild.rotation = hg.rotation;
    const weg = new PIXI.Sprite(gegenMaske());
    weg.position.set(b.x, b.y);
    weg.scale.set(b.w / MASKE.w, b.h / MASKE.h);
    weg.blendMode = 'erase';
    buehne.addChild(bild, weg);
    stage.app.renderer.render({ container: buehne, target: rt, clear: true, clearColor: [0, 0, 0, 0] });
    buehne.destroy({ children: true });
    return rt;
  } catch (err) {
    console.warn('[spielplatz] Sanddecke aus dem Hintergrund nicht möglich:', err);
    return null;
  }
}

// Gegen-Maske der Decke: undurchsichtig außerhalb des Sand-Trapezes, durchsichtig darin, weicher Übergang. Klein
// (SAND_BOX × 0,25) und nur einmal je Modul gezeichnet und hochgeladen – weich wird sie beim Vergrößern ohnehin.
const MASKE = { w: 603, h: 280 };
let maskeTex = null;
function gegenMaske() {
  if (maskeTex && !maskeTex.destroyed) return maskeTex;
  const c = document.createElement('canvas');
  c.width = MASKE.w;
  c.height = MASKE.h;
  const g = c.getContext('2d', { willReadFrequently: true });
  const kx = MASKE.w / SAND_BOX.w;
  const ky = MASKE.h / SAND_BOX.h;
  g.fillStyle = '#000';
  g.fillRect(0, 0, MASKE.w, MASKE.h);
  // Trapez ausstanzen, mit weichem Rand (wie zuvor 6 Bildpunkte bei 0,6 → hier 2,5 bei 0,25)
  g.globalCompositeOperation = 'destination-out';
  g.filter = 'blur(2.5px)';
  g.beginPath();
  SAND.forEach(([x, y], i) => {
    const px = (x - SAND_BOX.x) * kx;
    const py = (y - SAND_BOX.y) * ky;
    if (i === 0) g.moveTo(px, py);
    else g.lineTo(px, py);
  });
  g.closePath();
  g.fill();
  maskeTex = PIXI.Texture.from(c);
  return maskeTex;
}

// Dauer eines Bogenflugs (Strecke dx/dy, Bogenhöhe h, Verlauf sineInOut): so lang, dass die schnellste Stelle des
// Flugs FLUG_TEMPO nicht überschreitet, mindestens `min` Sekunden. Weg = (dx·p, dy·p − 4h·p(1−p)); bei sineInOut ist
// dp/dt = (π/T)·√(p(1−p)), also Tempo = |Weg'(p)|·(π/T)·√(p(1−p)) – davon das Größte über p.
function flugDauer(dx, dy, h, min) {
  let m = 0;
  for (let i = 1; i < 40; i++) {
    const p = i / 40;
    const vy = dy - 4 * h * (1 - 2 * p);
    m = Math.max(m, Math.hypot(dx, vy) * Math.sqrt(p * (1 - p)));
  }
  return Math.max(min, Math.PI * m / FLUG_TEMPO);
}

// Tippfläche eines Schatzes: immer etwa 260 Einheiten, egal wie groß er gerade gezeigt wird
function tippGroesse(s) {
  const k = Math.abs(s.scale.x) || 1;
  if (s.hitArea) s.hitArea.radius = 130 / k;
}
