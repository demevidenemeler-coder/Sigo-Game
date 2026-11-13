// Seite 1: die Feuerwache – Ablauf „Ausrücken" in fünf Schritten:
//   1. Glocke antippen → sie läutet, das Rolltor fährt weich hoch, das Blaulicht glimmt, und eine Denkblase an der
//      Glocke zeigt, was heute los ist (Feuer, Mülleimer, Katze, Ballon, Entenkind – nie zweimal dasselbe).
//   2. Oben aus dem Loch baumeln die Pfoten des Fuchses: ihn an der Stange hinunterziehen (Antippen geht auch).
//   3. Helme auf die Mannschaft ziehen (drei Tiere, jede Runde etwas andere). Waren sie schon behelmt: weiter.
//   4. Die Mannschaft und der Fuchs steigen von selbst nacheinander ein.
//   5. Auto antippen → Tatü, es fährt hinaus → weiter zur Einsatz-Seite.
// Kommt das Auto zurück: Mannschaft steigt aus, legt die Helme zurück, der Orden vom Einsatz schwebt an die Wand
// (die Orden-Reihe wächst über die Runden), das Auto fährt rückwärts in die Garage, das Tor geht zu, und ein Tier der
// Mannschaft geht nach Hause – ein neues kommt. Hydrant, Schlauchrolle, Eimer, Stange, Orden reagieren beim Antippen.
// Dankesbilder am Rolltor (neu in Runde 3): Für jede Einsatz-Art, die das Kind zum ersten Mal schafft, malt der
// Gerettete ein Bild. Nach der Heimkehr klebt ein Tier der Mannschaft es ans Tor; die Sammlung bleibt über die Besuche.
// Antippen eines Bildes: es wackelt, das gemalte Tier ruft.

import { spr, sfx, voice, note, animal, tap, drag, Actor, fx, rand, pick, clamp, PIXI } from '../../engine/index.js';
import { Seite } from '../../gemeinsam/seiten.js';
import { belohne } from '../../gemeinsam/sticker.js';
import { FeuerAuto, setzeHelm, helmSitz, helmSprite, kopfPunkt, freue, feuerSticker } from './auto.js';
import { Vogel, Schmetterling, Wolken, tippStelle, entprellt, zeigeBlase } from './deko.js';
import { EINSAETZE, naechsterEinsatz, waehleMannschaft, MANNSCHAFT, ordenZahl, ordenDazu, ORDEN_MAX, dankListe } from './einsaetze.js';
import { dankBild } from './dank.js';

const AUTO_SKALA = 0.8;
const AUTO_Z_GARAGE = 10;     // in der Garage: hinter dem Rolltor (z 20)
const AUTO_Z_DRAUSSEN = 35;   // draußen: vor Eimer (12), Hydrant (30), Fuchs (26); hinter den Tieren (40) und Helmen (45)
const TOR = { links: -400, rechts: 576, oben: 772, unten: 1300 };  // Garagenöffnung (Szenen-Koordinaten)
const AUS_TOR = { x: 330, y: 1372, scale: 0.86 };                  // Platz vor der Garage (schräg rechts davor)
const PLAETZE = [
  { x: -890, y: 1478 },
  { x: -640, y: 1490 },
  { x: -395, y: 1482 },
];
const TIER_SKALA = { hund: 0.31, katze: 0.3, baer: 0.3, affe: 0.29, schwein: 0.28, hase: 0.3 };
const HELM_PLAETZE = [{ x: 420, y: 1468 }, { x: 650, y: 1478 }, { x: 880, y: 1466 }];
const HELM_SKALA = 0.68;
const STANGE_X = 847;         // Mitte der gemalten Rutschstange (im Bild x 2250…2274, abgelesen)
const FUCHS_X = STANGE_X - 30; // Anker des Fuchses beim Rutschen: sein Körper liegt dann mittig an der Stange
// Orden-Reihe an der roten Wand links und rechts vom runden Fenster (Aufhängung oben)
const ORDEN_PLAETZE = [-315, -195, -75, 345, 465, 585].map((x) => ({ x, y: 522 }));
const ORDEN_SKALA = 0.3;
// Denkblase an der Glocke (kleinstes Bläschen)
const BLASE_GLOCKE = { x: -470, y: 640 };
// Dankesbilder am Rolltor: zwei Reihen zu je vier (Mitte des Tors x 88), über dem Griff
const DANK_PLAETZE = [];
for (const y of [905, 1095]) for (const k of [-1.5, -0.5, 0.5, 1.5]) DANK_PLAETZE.push({ x: 88 + k * 228, y });
const DANK_DREH = [-0.06, 0.04, -0.03, 0.06, 0.05, -0.04, 0.03, -0.06];
const DANK_SKALA = 0.92;

export class Wache extends Seite {
  static hg = 'feuerwehr/hg_wache';

  aufbau() {
    // 'zu' | 'alarm' | 'stange' | 'rutscht' | 'helme' | 'einsteigen' | 'bereit' | 'faehrt' | 'weg' | 'heim'
    this.zustand = 'zu';
    this.klack = entprellt(0.5);
    this.bimmel = entprellt(1.0);
    this.spritz = entprellt(1.5);
    this.pling = entprellt(0.25);

    this.wolken = new Wolken({
      parent: this.hinten,
      liste: [
        { tex: 'common/wolke2', x: -620, y: 120, scale: 0.42, v: 7 },
        { tex: 'common/wolke3', x: 900, y: 70, scale: 0.26, v: 5 },
      ],
    });

    this.baueGarage();
    this.baueGlocke();
    this.baueFuchs();
    this.baueWartende();
    this.baueHelme();
    this.baueKleinkram();
    this.baueOrden();
    this.baueDank();

    this.vogel = new Vogel(this, {
      parent: this.welt,
      scale: 1.1,
      plaetze: [{ x: 498, y: 236 }, { x: 0, y: 180 }, { x: -980, y: 380, flip: true }, { x: 820, y: 330, flip: true }],
    });
    this.falter = new Schmetterling(this, { x: 700, y: 570, parent: this.welt, farbe: 0xf6b0cf, weite: 90 });
    this.falter.c.scale.set(1.5);
  }

  // ---------------------------------------------------------------- Garage, Tor, Auto

  baueGarage() {
    const garage = this.punkt('garage', { x: 85, y: 1290 });
    this.garage = { x: garage.x + 4, y: garage.y + 4 };
    this.auto = new FeuerAuto({ x: this.garage.x, y: this.garage.y, scale: AUTO_SKALA, parent: this.welt, z: AUTO_Z_GARAGE, fahrer: 'fuchs', fahrerSichtbar: false });
    tap(this.auto.f.koerper, () => this.autoAngetippt(), { sound: null, pad: 40 });

    // Rolltor vor der Öffnung, oben von einer Maske abgeschnitten (verschwindet unter der Rolle)
    const breite = TOR.rechts - TOR.links;
    const hoehe = TOR.unten - TOR.oben;
    this.tor = spr('feuerwehr/rolltor', { x: (TOR.links + TOR.rechts) / 2, y: TOR.unten + 6, parent: this.welt, z: 20 });
    this.tor.scale.set((breite + 16) / 797, (hoehe + 14) / (589 * 0.98));
    const maske = new PIXI.Graphics().rect(TOR.links - 20, TOR.oben, breite + 40, hoehe + 40).fill(0xffffff);
    this.welt.addChild(maske);
    this.tor.mask = maske;
    this.torZuY = this.tor.y;
    tap(this.tor, () => this.torAngetippt(), {
      sound: null, squash: false, hitArea: new PIXI.Rectangle(-0.5 * 797, -0.98 * 589, 797, 589),
    });
  }

  autoAngetippt() {
    const a = this.auto;
    if (this.zustand === 'bereit') {
      this.losfahren();
      return;
    }
    // sonst: freundlich hupen/wackeln, nichts passiert
    a.f.wackel(0.02);
    if (this.zustand !== 'faehrt') this.klack('common/hupe', { vol: 0.4 });
  }

  torAngetippt() {
    if (this.zustand !== 'zu') return;
    fx.wobble(this.tor, 0.015);
    this.klack('common/klack', { vol: 0.6 });
    fx.pop(this.glocke, 0.1);
  }

  // ---------------------------------------------------------------- Glocke, Alarm

  baueGlocke() {
    const p = this.punkt('glocke', { x: -594, y: 720 });
    this.glocke = spr('feuerwehr/alarmglocke', { x: p.x + 20, y: p.y + 30, scale: 0.78, parent: this.welt, z: 15 });
    // Drehpunkt an der Aufhängung, damit die Glocke schwingt
    this.glocke.anchor.set(160 / 254, 110 / 350);
    this.glocke.position.set(p.x + 20 + (160 / 254 - 0.5) * 254 * 0.78, p.y + 30 + (110 / 350 - 0.5) * 350 * 0.78);
    tap(this.glocke, () => this.laeuten(), { sound: null, squash: false, pad: 60 });
  }

  laeuten() {
    const g = this.glocke;
    this.bimmel('common/glocke', { vol: 0.8 });   // entprellt: wildes Tippen läutet nicht zehnmal übereinander
    fx.wobble(g, 0.22);
    if (this.zustand === 'zu') this.alarm();
    // während des Alarms zeigt die Glocke noch einmal, was los ist – aber nur, wenn gerade keine Blase zu sehen ist
    // (Dauertippen baut sie sonst immer neu auf, und sie pulsiert zwischen halb durchsichtig und sichtbar)
    else if (['alarm', 'stange', 'helme'].includes(this.zustand) && this.szene.einsatzWahl && !this.blaseZuSehen()) {
      this.einsatzBlase();
    }
  }

  blaseZuSehen() {
    const b = this._feuerBlase;
    return !!b && !b.destroyed;
  }

  einsatzBlase() {
    const e = EINSAETZE[this.szene.einsatzWahl];
    if (!e) return;
    const tint = this.szene.einsatzWahl === 'ballon' ? 0xff7d7d : undefined;
    zeigeBlase(this, BLASE_GLOCKE.x, BLASE_GLOCKE.y, e.icon, { sek: 3, tint });
  }

  async alarm() {
    this.zustand = 'alarm';
    this.szene.einsatzWahl = naechsterEinsatz(this.szene);
    this.auto.blaulicht(true);
    // Tor rollt weich hoch
    this.after(0.35, () => sfx('common/rolltor', { vol: 0.75 }));
    this.tween(this.tor, { y: TOR.oben - 4 }, 2.3, { ease: 'sineInOut', delay: 0.3 });
    // die Glocke zeigt den Einsatz
    this.after(0.5, () => this.einsatzBlase());
    await this.wait(2.0);
    // Oben aus dem Loch baumeln die Pfoten des Fuchses: er wartet, dass man ihn hinunterzieht
    await this.fuchsGuckt(true);
    this.zustand = 'stange';
    this.fuchsZiehbar(true);
    this.stangeHinweis(2.5);
  }

  stangeHinweis(verz) {
    this._hinweis?.kill();
    const passt = () => this.aktiv && this.zustand === 'stange';
    this._hinweis = this.after(verz, () => { if (passt()) voice('feuerwehr_stange', { nurWenn: passt }); });
  }

  // ---------------------------------------------------------------- Fuchs an der Stange

  baueFuchs() {
    const oben = this.punkt('stange_oben', { x: 850, y: 725 });
    const unten = this.punkt('stange_unten', { x: 850, y: 1280 });
    this.stange = { oben, unten };
    this.fuchs = new Actor('fuchs', { x: oben.x - 34, y: oben.y - 10, scale: 0.29, parent: this.welt, z: 26 });
    setzeHelm(this.fuchs);
    this.fuchs.visible = false;
    this.fuchs.schatten.visible = false;
    // nur unterhalb der Decke des Torbogens zu sehen
    this.fuchsMaske = new PIXI.Graphics().rect(oben.x - 260, oben.y - 20, 520, 900).fill(0xffffff);
    this.welt.addChild(this.fuchsMaske);
    this.fuchs.mask = this.fuchsMaske;
    this.fuchs.onTap(() => {
      if (this.zustand === 'stange') return;   // dann übernimmt das Ziehen (auch ein Tipp lässt ihn rutschen)
      freue(this, this.fuchs, { herzen: 3 });
    }, { pad: 60 });

    // Die gemalte Stange noch einmal VOR dem Fuchs (gleiche Farben wie im Hintergrund): Solange er an ihr
    // hinunterrutscht, umarmt er sie – sonst sähe es aus, als säße er oben auf einem Stiel.
    const sx = STANGE_X - oben.x;
    const lang = unten.y - 15 - (oben.y - 20);
    const g = new PIXI.Graphics()
      .rect(sx - 12, 0, 25, lang).fill(0xeebe4a)          // Gold
      .rect(sx - 12, 0, 3, lang).fill(0xa8600a)           // dunkle linke Kante
      .rect(sx - 8, 0, 4, lang).fill(0xf6d26a)
      .rect(sx - 1, 0, 5, lang).fill(0xfff2b4)            // Glanzlinie
      .rect(sx + 5, 0, 6, lang).fill(0xc2800f)            // Schattenseite
      .rect(sx + 11, 0, 2, lang).fill(0xe2bc50);
    g.position.set(oben.x, oben.y - 20);
    g.zIndex = 27;
    g.alpha = 0;
    g.visible = false;
    g.eventMode = 'none';
    this.welt.addChild(g);
    this.stangeVorn = g;

    // Die Stange selbst ist antippbar: Ist der Fuchs noch oben, baumeln kurz seine Pfoten aus dem Loch.
    // Wartet er gerade auf das Hinunterziehen, rutscht er los.
    tippStelle(this.welt, STANGE_X, (oben.y + unten.y) / 2, 0, () => this.stangeAngetippt(), {
      label: 'stange', z: 3, breite: 210, hoehe: unten.y - oben.y,
    });
  }

  zeigeStangeVorn(an) {
    const g = this.stangeVorn;
    if (an) {
      g.visible = true;
      this.tween(g, { alpha: 1 }, 0.15, { ease: 'sineOut' });
    } else {
      this.tween(g, { alpha: 0 }, 0.3, { ease: 'sineInOut' }).then((ok) => { if (ok) g.visible = false; });
    }
  }

  stangeAngetippt() {
    this.pling('common/klack', { vol: 0.35 });
    note('glocke', pick([79, 83, 86]), { vol: 0.3 });
    this.burst('funkeln', STANGE_X, rand(850, 1150), { count: 2 });
    if (this.zustand === 'stange') {
      this.fuchsLos();
      return;
    }
    if (this.zustand !== 'zu' || this.fuchs.visible || this.guckt) return;
    // Fuchs schaut kurz von oben herunter: erst die Pfoten, dann wieder hinauf
    this.fuchsGuckt(false);
  }

  // Pfoten aus dem Loch: bleiben = true (Alarm, er wartet) oder nur kurz schauen
  async fuchsGuckt(bleiben) {
    const f = this.fuchs;
    const { oben } = this.stange;
    this.guckt = true;
    f.stop();
    f.mask = this.fuchsMaske;
    this.fuchsMaske.visible = true;
    f.schatten.visible = false;
    if (!f.visible) f.position.set(FUCHS_X, oben.y - 20);
    f.x = FUCHS_X;
    f.alpha = 1;
    f.visible = true;
    this.zeigeStangeVorn(true);
    let ok = await this.tween(f, { y: oben.y + (bleiben ? 150 : 110) }, 0.6, { ease: 'sineOut' });
    if (ok) f.sound();
    if (bleiben) {
      this.guckt = false;
      return ok;
    }
    if (ok) {
      await this.wait(0.9);
      if (this.zustand === 'zu') ok = await this.tween(f, { y: oben.y - 20 }, 0.6, { ease: 'sineIn' });
    }
    this.guckt = false;
    // beim Alarm übernimmt das Rutschen – dann nichts verstecken
    if (ok && this.zustand === 'zu') {
      f.visible = false;
      this.zeigeStangeVorn(false);
    }
    return ok;
  }

  // Der wartende Fuchs lässt sich an der Stange hinunterziehen (nur senkrecht). Loslassen oder Antippen: er rutscht
  // den Rest von selbst – egal wie weit gezogen wurde.
  fuchsZiehbar(an) {
    this.fuchsZug?.off();
    this.fuchsZug = null;
    if (!an) return;
    const f = this.fuchs;
    const { oben, unten } = this.stange;
    this.fuchsZug = drag(f, {
      pad: 70,
      lift: 1.04,
      onMove: () => {
        f.x = FUCHS_X;
        f.y = clamp(f.y, oben.y + 60, unten.y + 8);
        if (f.y > unten.y - 30) this.fuchsLos();   // ganz unten angekommen: das Ziehen endet von selbst
      },
      onDrop: (ziel, ctx) => {
        ctx.erledigt = true;
        f.zIndex = 26;
        this.fuchsLos();
      },
    });
  }

  fuchsLos() {
    if (this.zustand !== 'stange') return;
    this.zustand = 'rutscht';
    this.fuchsZiehbar(false);
    this.fuchs.zIndex = 26;
    this.fuchsRutscht().then(() => this.nachDemRutschen());
  }

  async fuchsRutscht() {
    const f = this.fuchs;
    const { oben, unten } = this.stange;
    f.stop();
    this.fuchsMaske.visible = true;
    f.mask = this.fuchsMaske;
    if (!f.visible) f.position.set(FUCHS_X, oben.y - 20);   // schaut er gerade heraus: von dort aus rutschen
    f.x = FUCHS_X;
    f.alpha = 1;
    f.visible = true;
    this.zeigeStangeVorn(true);
    sfx('common/rutsch', { vol: 0.7 });
    const rest = clamp((unten.y + 8 - f.y) / (unten.y - oben.y), 0.2, 1);
    await this.tween(f, { y: unten.y + 8 }, 1.05 * Math.sqrt(rest), { ease: 'quadIn' });
    f.mask = null;
    this.fuchsMaske.visible = false;
    f.schatten.visible = true;
    fx.pop(f, 0.1);
    sfx('common/landen', { vol: 0.7 });
    f.sound();
    this.zeigeStangeVorn(false);
  }

  async nachDemRutschen() {
    await this.wait(0.4);
    if (this.tiere.every((t) => t.helm)) {
      this.einsteigen();
      return;
    }
    this.zustand = 'helme';
    this.fuchs.bubble('feuerwehr/helm', 2.4, { seite: 'links' });
    this.helmHinweis(2.5);
  }

  async fuchsSteigtEin() {
    const f = this.fuchs;
    const fahrer = this.auto.fahrer;
    // Ziel: Füße des Fahrers (im Fenster), in Seiten-Koordinaten
    const ziel = this.welt.toLocal(fahrer.toGlobal({ x: 0, y: 0 }));
    const skalaZiel = Math.abs(fahrer.worldTransform.a / this.welt.worldTransform.a);
    f.schatten.visible = false;
    f.stop();
    // eigener Bogen statt hopTo: hopTo würde den Fuchs umdrehen, der Helm sitzt aber auf der Blickrichtung
    const von = { x: f.x, y: f.y, s: f.scale.x };
    const p = { t: 0 };
    let umgestiegen = false;
    sfx('common/hupf', { vol: 0.5 });
    await this.tween(p, { t: 1 }, 0.8, {
      ease: 'sineInOut',
      onUpdate: () => {
        const t = p.t;
        f.x = von.x + (ziel.x - von.x) * t;
        f.y = von.y + (ziel.y - von.y) * t - Math.sin(Math.PI * t) * 190;
        f.scale.set(von.s + (skalaZiel - von.s) * t);
        // zum Schluss taucht er ins Führerhaus: Fuchs verblasst, der Fahrer im Fenster erscheint
        if (t > 0.7 && !umgestiegen) {
          umgestiegen = true;
          fahrer.visible = true;
          fahrer.alpha = 0;
          this.tween(fahrer, { alpha: 1 }, 0.25, { ease: 'sineOut' });
          this.tween(f, { alpha: 0 }, 0.22, { ease: 'sineIn' });
        }
      },
    });
    // umsteigen: der Fahrer im Auto übernimmt
    f.visible = false;
    f.alpha = 1;
    f.scale.set(von.s);
    fahrer.visible = true;
    fahrer.alpha = 1;
    fx.pop(fahrer, 0.12);
    sfx('common/plopp', { vol: 0.6 });
  }

  // ---------------------------------------------------------------- Einsteigen, Losfahren, Heimkommen

  async einsteigen() {
    this.zustand = 'einsteigen';
    // die Mannschaft hüpft nacheinander hinten ins Auto (verblasst dort)
    for (const t of this.tiere) {
      const heck = this.auto.punkt('heck', this.welt);
      t.zIndex = 41;
      t.schatten.visible = false;
      sfx('common/hupf', { vol: 0.45 });
      await t.hopTo(heck.x, heck.y + 60, { hoehe: 150, dauer: 0.6, staub: false });
      sfx('common/plopp', { vol: 0.45 });
      await this.tween(t, { alpha: 0 }, 0.25, { ease: 'sineIn' });
      t.visible = false;
      await this.wait(0.15);
    }
    await this.fuchsSteigtEin();
    this.zustand = 'bereit';
    fx.pop(this.auto.f.rumpf, 0.04);
    this.auto.tatue(this, 0);
  }

  async losfahren() {
    this.zustand = 'faehrt';
    const a = this.auto;
    this.szene.mannschaft = this.tiere.map((t) => t.tierId);
    a.tatue(this, 0);
    fx.pop(a.fahrer, 0.1);
    // vor der Garage steht das Auto weiter vorn als Eimer, Hydrant und Schlauchrolle: also davor zeichnen
    a.f.zIndex = AUTO_Z_DRAUSSEN;
    await this.wait(0.5);
    await a.fahre(this, AUS_TOR, 1.6, 'sineIn');
    await a.fahre(this, { x: 1750, y: AUS_TOR.y + 6 }, 1.7, 'linear');
    this.zustand = 'weg';
    // Nur weiterblättern, wenn das Kind noch hier auf der Wache zuschaut – hat es selbst geblättert, bleibt es dort
    if (this.aktiv && this.szene.nr === this.index && !this.szene.gleitet) {
      this.szene.autoKommt = true;
      this.szene.zeigeSeite(1);
    }
  }

  async heimkommen() {
    this.zustand = 'heim';
    const a = this.auto;
    a.f.position.set(1750, AUS_TOR.y + 6);
    a.f.scale.set(AUS_TOR.scale);
    a.f.zIndex = AUTO_Z_DRAUSSEN;
    a.fahrer.visible = true;
    a.blaulicht(false);
    await a.fahre(this, AUS_TOR, 2.2, 'sineOut');
    await this.wait(0.3);
    // Mannschaft steigt hinten aus und hüpft an ihre Plätze, dann kommen die Helme zurück ins Regal
    for (let i = 0; i < this.tiere.length; i++) {
      const t = this.tiere[i];
      if (t.visible) continue;
      const heck = a.punkt('heck', this.welt);
      t.position.set(heck.x, heck.y + 60);
      t.visible = true;
      t.alpha = 0;
      t.zIndex = 40;
      this.tween(t, { alpha: 1 }, 0.25, { ease: 'sineOut' });
      sfx('common/hupf', { vol: 0.45 });
      await t.hopTo(PLAETZE[i].x, PLAETZE[i].y, { hoehe: 160, dauer: 0.7 });
      t.schatten.visible = true;
      t.lookAt(t.x + 100);
    }
    await this.wait(0.3);
    for (const t of this.tiere) {
      if (!t.helm) continue;
      await this.helmAb(t);
      await this.wait(0.2);
    }
    // Orden vom Einsatz an die Wand
    await this.ordenAnDieWand(true);
    // rückwärts schräg in die Garage
    await a.fahre(this, { x: this.garage.x, y: this.garage.y, scale: AUTO_SKALA }, 1.8, 'sineInOut');
    a.f.zIndex = AUTO_Z_GARAGE;   // wieder hinter dem Rolltor
    sfx('common/rolltor', { vol: 0.6 });
    await this.tween(this.tor, { y: this.torZuY }, 2.2, { ease: 'sineInOut' });
    a.fahrer.visible = false;   // der Fuchs geht hinter dem Tor wieder nach oben
    this.klack('common/klack', { vol: 0.5 });
    this.zustand = 'zu';
    this.szene.einsatzWahl = null;
    this.helmAufgesetzt = false;
    await this.wait(0.8);
    await this.dankAnsTor();
    this.mannschaftWechselt();
  }

  // Ein Tier der Mannschaft geht nach Hause, ein anderes kommt (nur, solange nichts anderes läuft)
  async mannschaftWechselt() {
    if (this.zustand !== 'zu' || this.tiere.some((t) => t.helm)) return;
    const i = Math.floor(Math.random() * this.tiere.length);
    const alt = this.tiere[i];
    const neuId = pick(MANNSCHAFT.filter((id) => !this.tiere.some((t) => t.tierId === id)));
    if (!neuId) return;
    // gleich tauschen: läutet das Kind währenddessen, fährt schon das neue Tier mit
    const neu = this.neuesTier(neuId, i, -1500);
    this.tiere[i] = neu;
    alt.eventMode = 'none';
    alt.sound();
    alt.walkTo(-1500, alt.y, { tempo: 330 }).then(() => { if (!alt.destroyed) alt.destroy({ children: true }); });
    await this.wait(1.4);
    if (await neu.walkTo(PLAETZE[i].x, PLAETZE[i].y, { tempo: 330 })) {
      neu.lookAt(neu.x + 100);
      neu.sound();
    }
  }

  // ---------------------------------------------------------------- Tiere und Helme

  baueWartende() {
    this.tiere = waehleMannschaft(3).map((id, i) => this.neuesTier(id, i));
  }

  neuesTier(id, i, x) {
    const p = PLAETZE[i];
    const a = new Actor(id, { x: x ?? p.x, y: p.y, scale: TIER_SKALA[id] ?? 0.3, parent: this.welt, z: 40 });
    a.helm = null;
    a.onTap(() => {
      if (a.helm) freue(this, a, { herzen: 3 });
      else {
        fx.wobble(a);
        a.sound();
        a.bubble('feuerwehr/helm', 1.8);
        // „Zieh einen Helm zu einem Tier" – nicht mehr, wenn das Kind schon einen Helm aufgesetzt hat oder
        // weggeblättert ist, bis der Satz an der Reihe ist
        voice('feuerwehr_helm', { nurWenn: () => this.aktiv && !this.helmAufgesetzt && this.tiere.some((t) => !t.helm) });
      }
    }, { pad: 40 });
    return a;
  }

  baueHelme() {
    this.helme = HELM_PLAETZE.map((p, i) => {
      const schatten = new PIXI.Graphics().ellipse(0, 0, 95, 17).fill({ color: 0x5a4630, alpha: 0.2 });
      schatten.position.set(p.x, p.y + 6);
      schatten.zIndex = 44;
      this.welt.addChild(schatten);
      const h = helmSprite({ x: p.x, y: p.y, scale: HELM_SKALA, parent: this.welt, z: 45 });
      h.rotation = [-0.12, 0.08, -0.05][i];
      h.heim = { x: p.x, y: p.y, rotation: h.rotation };
      h.schatten = schatten;
      h.zug = drag(h, {
        pad: 45,
        lift: 1.12,
        targets: () => this.tiere.filter((t) => !t.helm && t.visible).map((t) => {
          const k = kopfPunkt(t, this.welt);
          return { tier: t, x: k.x, y: k.y, radius: 230 };
        }),
        onStart: () => this.tween(h, { rotation: 0 }, 0.2, { ease: 'sineOut' }),
        onDrop: (ziel, ctx) => {
          if (!ziel || ziel.tier.helm) {
            this.tween(h, { rotation: h.heim.rotation }, 0.4, { ease: 'sineInOut' });
            if (ziel) ctx.back();
            return;
          }
          ctx.erledigt = true;
          this.helmAuf(h, ziel.tier);
        },
      });
      return h;
    });
  }

  async helmAuf(h, tier) {
    tier.helm = h;        // gleich belegen (zwei Finger, zwei Helme: nur einer passt)
    this.helmAufgesetzt = true;
    h.eventMode = 'none';
    tier.stop();
    const sitz = helmSitz(tier.tierId);
    const ziel = this.welt.toLocal(tier.atem.toGlobal({ x: sitz.x, y: sitz.y }));
    const skala = Math.abs(tier.atem.worldTransform.a / this.welt.worldTransform.a) * sitz.scale;
    this.tween(h.schatten, { alpha: 0 }, 0.3, { ease: 'sineInOut' });
    this.tween(h, { rotation: sitz.rotation }, 0.3, { ease: 'sineOut' });
    await this.tween(h, { x: ziel.x, y: ziel.y, scale: skala }, 0.3, { ease: 'sineOut' });
    setzeHelm(tier, h);
    sfx('common/plopp', { vol: 0.7 });
    fx.pop(tier, 0.06);
    freue(this, tier, { herzen: 4 });
    if (this.tiere.every((t) => t.helm)) this.alleHelme();
  }

  async alleHelme() {
    await this.wait(1.2);
    const mitte = this.tiere[1];
    const k = kopfPunkt(mitte, this.welt);
    this.tiere.forEach((t, i) => this.after(i * 0.25, () => freue(this, t, { herzen: 3, laut: i === 1 })));
    belohne(this, feuerSticker('feuerwehr_helm'), k.x + 120, k.y - 380);
    // Wartet der Ablauf auf die Helme (der Fuchs ist schon unten): jetzt steigen alle ein
    if (this.zustand === 'helme') {
      await this.wait(2.2);
      if (this.zustand === 'helme') this.einsteigen();
    }
  }

  async helmAb(tier) {
    const h = tier.helm;
    if (!h) return;
    const ziel = this.welt.toLocal(h.getGlobalPosition());
    const skala = Math.abs(h.worldTransform.a / this.welt.worldTransform.a);
    this.welt.addChild(h);
    h.position.set(ziel.x, ziel.y);
    h.scale.set(skala);
    tier.helm = null;
    sfx('common/hupf', { vol: 0.5 });
    this.tween(h.schatten, { alpha: 1 }, 0.5, { ease: 'sineInOut' });
    this.tween(h, { rotation: h.heim.rotation, scale: HELM_SKALA }, 0.7, { ease: 'sineInOut' });
    // kleiner Bogen zurück an seinen Platz
    const von = { x: ziel.x, y: ziel.y };
    const p = { t: 0 };
    await this.tween(p, { t: 1 }, 0.7, {
      ease: 'sineInOut',
      onUpdate: () => {
        h.x = von.x + (h.heim.x - von.x) * p.t;
        h.y = von.y + (h.heim.y - von.y) * p.t - Math.sin(Math.PI * p.t) * 140;
      },
    });
    fx.pop(h, 0.08);
    h.eventMode = 'static';
  }

  helmHinweis(verz) {
    this._hinweis?.kill();
    const passt = () => this.aktiv && this.zustand === 'helme' && !this.helmAufgesetzt;
    this._hinweis = this.after(verz, () => { if (passt()) voice('feuerwehr_helm', { nurWenn: passt }); });
  }

  // ---------------------------------------------------------------- Orden an der Wand (wächst über die Runden)

  baueOrden() {
    this.orden = [];
    const n = ordenZahl();
    for (let i = 0; i < n; i++) this.ordenHaengt(i, false);
  }

  ordenHaengt(i, neu) {
    const p = ORDEN_PLAETZE[i];
    const o = spr('feuerwehr/stern_orden', { x: p.x, y: p.y, scale: ORDEN_SKALA, parent: this.welt, z: 8 });
    o.anchor.set(0.5, 0.08);
    o.rotation = [0.04, -0.03, 0.02, -0.04, 0.03, -0.02][i];
    tap(o, () => {
      this.pling('common/funkeln', { vol: 0.4 });
      note('glocke', [79, 81, 83, 84, 86, 88][i], { vol: 0.3 });
      fx.wobble(o, 0.12);
    }, { sound: null, squash: false, pad: 75 });
    this.orden[i] = o;
    if (neu) fx.pop(o, 0.15);
    return o;
  }

  // Geschaffte Einsätze bringen je einen Orden an die Wand: vom Auto aus (mitAuto) oder still erscheinend
  async ordenAnDieWand(mitAuto) {
    while (this.szene.ordenOffen > 0) {
      this.szene.ordenOffen--;
      const vorher = ordenZahl();
      if (vorher >= ORDEN_MAX) {
        // Wand ist voll: die Orden funkeln und klingen einmal reihum
        for (let i = 0; i < this.orden.length; i++) {
          this.after(i * 0.18, () => {
            const o = this.orden[i];
            if (!o || o.destroyed) return;
            fx.wobble(o, 0.1);
            this.burst('funkeln', o.x, o.y + 60, { count: 2 });
          });
        }
        sfx('common/funkeln', { vol: 0.5 });
        await this.wait(1.4);
        continue;
      }
      const i = ordenDazu() - 1;
      const p = ORDEN_PLAETZE[i];
      const o = spr('feuerwehr/stern_orden', { parent: this.welt, z: 46 });
      o.anchor.set(0.5, 0.08);
      if (mitAuto) {
        const tuer = this.auto.punkt('orden', this.welt);
        o.position.set(tuer.x, tuer.y);
        o.scale.set(0.45);
      } else {
        o.position.set(p.x, p.y - 60);
        o.scale.set(ORDEN_SKALA);
        o.alpha = 0;
        this.tween(o, { alpha: 1 }, 0.5, { ease: 'sineInOut' });
      }
      sfx('common/funkeln', { vol: 0.5 });
      const von = { x: o.x, y: o.y };
      const q = { t: 0 };
      this.tween(o, { scale: ORDEN_SKALA }, 1.4, { ease: 'sineInOut' });
      await this.tween(q, { t: 1 }, mitAuto ? 1.4 : 0.8, {
        ease: 'sineInOut',
        onUpdate: () => {
          o.x = von.x + (p.x - von.x) * q.t;
          o.y = von.y + (p.y - von.y) * q.t - Math.sin(Math.PI * q.t) * (mitAuto ? 200 : 20);
        },
      });
      o.destroy();
      this.ordenHaengt(i, true);
      sfx('common/plopp', { vol: 0.5 });
      this.burst('funkeln', p.x, p.y + 60, { count: 4 });
      await this.wait(0.5);
    }
  }

  // ---------------------------------------------------------------- Dankesbilder am Rolltor (wachsen über die Besuche)

  baueDank() {
    // eigene Ebene über dem Tor, gleich abgeschnitten wie das Tor (verschwindet beim Hochfahren unter der Rolle)
    const e = new PIXI.Container({ label: 'dankbilder' });
    e.zIndex = 21;
    this.welt.addChild(e);
    const maske = new PIXI.Graphics().rect(TOR.links - 20, TOR.oben, TOR.rechts - TOR.links + 40, TOR.unten - TOR.oben + 40).fill(0xffffff);
    this.welt.addChild(maske);
    e.mask = maske;
    this.dankEbene = e;
    this.dankBilder = [];
    // was schon gemalt wurde – ohne das Bild, das gerade erst ans Tor geklebt werden will
    const neu = this.szene.dankNeu;
    for (const id of dankListe()) if (id !== neu) this.dankKlebt(id, false);
  }

  dankKlebt(id, mitPop) {
    const i = this.dankBilder.length;
    const p = DANK_PLAETZE[i];
    if (!p) return null;
    const b = dankBild(id);
    b.position.set(p.x, p.y);
    b.rotation = DANK_DREH[i];
    b.scale.set(DANK_SKALA);
    b.einsatz = id;
    this.dankEbene.addChild(b);
    const tierId = EINSAETZE[id]?.retter;
    tap(b, () => {
      fx.wobble(b, 0.08);
      // wie ein Tipp aufs Tor: die Glocke zeigt sich (sie startet den Alarm)
      if (this.zustand === 'zu') fx.pop(this.glocke, 0.1);
      if (tierId && this.pling('common/rascheln', { vol: 0.3 })) animal(tierId);
    }, { sound: null, squash: false, pad: 26 });
    this.dankBilder.push(b);
    if (mitPop) fx.pop(b, 0.12);
    return b;
  }

  // Ein neues Dankesbild wird vom Platz eines Mannschafts-Tiers im Bogen ans Tor geklebt (nur bei geschlossenem Tor)
  async dankAnsTor() {
    const id = this.szene.dankNeu;
    if (!id || this._dankLaeuft || this.zustand !== 'zu') return;
    this._dankLaeuft = true;
    this.szene.dankNeu = null;
    const i = this.dankBilder.length;
    const p = DANK_PLAETZE[i];
    if (!p || this.dankBilder.some((b) => b.einsatz === id)) {
      this._dankLaeuft = false;
      return;
    }
    const tier = this.tiere.find((t) => !t.destroyed && t.visible) || null;
    const start = tier ? kopfPunkt(tier, this.welt) : { x: p.x, y: 1450 };
    const b = dankBild(id);
    b.position.set(start.x, start.y - 60);
    b.scale.set(0.3);
    b.alpha = 0;
    b.zIndex = 60;
    b.eventMode = 'none';
    this.welt.addChild(b);
    if (tier) freue(this, tier, { herzen: 2, laut: true });
    sfx('common/rascheln', { vol: 0.45 });
    this.tween(b, { alpha: 1 }, 0.4, { ease: 'sineInOut' });
    const von = { x: b.x, y: b.y, s: 0.3 };
    const q = { t: 0 };
    this.tween(b, { rotation: DANK_DREH[i] }, 1.4, { ease: 'sineInOut' });
    await this.tween(q, { t: 1 }, 1.4, {
      ease: 'sineInOut',
      onUpdate: () => {
        b.x = von.x + (p.x - von.x) * q.t;
        b.y = von.y + (p.y + this.dankEbene.y - von.y) * q.t - Math.sin(Math.PI * q.t) * 180;
        b.scale.set(von.s + (DANK_SKALA - von.s) * q.t);
      },
    });
    b.destroy({ children: true });
    this.dankKlebt(id, true);
    sfx('common/plopp', { vol: 0.55 });
    this.burst('funkeln', p.x, p.y + this.dankEbene.y, { count: 4 });
    await this.wait(0.6);
    this._dankLaeuft = false;
  }

  // ---------------------------------------------------------------- Hydrant, Schlauchrolle, Eimer

  baueKleinkram() {
    const hydrant = spr('feuerwehr/hydrant', { x: -1010, y: 1262, scale: 0.5, parent: this.welt, z: 30 });
    tap(hydrant, () => {
      this.spritz('common/spritz', { vol: 0.6 });
      fx.wobble(hydrant, 0.05);
      this.burst('tropfen', hydrant.x, hydrant.y - 190, { count: 9 });
    }, { sound: null, pad: 50 });

    const rolle = spr('feuerwehr/schlauchrolle', { x: -700, y: 1188, scale: 0.56, parent: this.welt, z: 12 });
    tap(rolle, () => {
      this.klack('common/angel', { vol: 0.6 });
      fx.wobble(rolle, 0.06);
    }, { sound: null, pad: 40 });

    const eimer = spr('feuerwehr/eimer_rot', { x: 1000, y: 1222, scale: 0.6, parent: this.welt, z: 12 });
    tap(eimer, () => {
      this.klack('common/klack', { vol: 0.7 });
      this.tween(eimer, { y: 1190 }, 0.15, { ease: 'quadOut' }).then(() => this.tween(eimer, { y: 1222 }, 0.3, { ease: 'bounceOut' }));
    }, { sound: null, pad: 45 });
  }

  // ---------------------------------------------------------------- Ablauf

  betreten() {
    if (this.besuche === 1) voice('feuerwehr_hallo');
    // Hinweis bei jedem Betreten anmelden (der Kern sagt ihn höchstens einmal am Tag) – nur, solange die Seite zu
    // sehen ist und die Glocke noch nicht geläutet hat (auch, wenn der Satz erst nach der Begrüßung dran ist)
    this._hinweis?.kill();
    const passt = () => this.aktiv && this.zustand === 'zu';
    this._hinweis = this.after(4, () => { if (passt()) voice('feuerwehr_glocke', { nurWenn: passt }); });
    if (this.zustand === 'weg') this.heimkommen();
    else if (this.zustand === 'zu' && (this.szene.ordenOffen > 0 || this.szene.dankNeu)) {
      this.after(1.2, async () => {
        if (this.zustand !== 'zu' || this._dankLaeuft) return;
        await this.ordenAnDieWand(false);
        this.dankAnsTor();
      });
    }
    else if (this.zustand === 'helme') this.helmHinweis(2);
    else if (this.zustand === 'stange') this.stangeHinweis(2);
  }

  verlassen() {
    this._hinweis?.kill();
    this._hinweis = null;
  }

  update(dt) {
    // die Dankesbilder kleben am Tor: sie fahren mit ihm hoch und herunter
    this.dankEbene.y = this.tor.y - this.torZuY;
    this.auto.update(dt);
    this.wolken.update(dt);
    this.vogel.update(dt);
    this.falter.update(dt);
  }

  hinweise() {
    const freieHelme = this.helme.filter((h) => h.eventMode !== 'none');
    const ohneHelm = this.tiere.find((t) => !t.helm && t.visible);
    const helmHand = freieHelme.length && ohneHelm ? { von: freieHelme[0], nach: ohneHelm } : null;
    switch (this.zustand) {
      case 'zu': return helmHand ? [this.glocke, helmHand] : [this.glocke];
      case 'stange': return [{ von: this.fuchs, nach: { x: FUCHS_X + 30, y: this.stange.unten.y - 180 } }];
      case 'helme': return helmHand ? [helmHand] : [this.fuchs];
      case 'bereit': return [this.auto.f.koerper];
      // während etwas von selbst läuft: aufs Auto zeigen, nicht auf den Pfeil zur nächsten Seite
      default: return [this.auto.f.koerper];
    }
  }
}
