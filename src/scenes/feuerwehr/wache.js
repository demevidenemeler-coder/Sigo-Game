// Seite 1: die Feuerwache.
// Glocke antippen → läutet, das Rolltor fährt weich hoch, der Fuchs mit Helm rutscht die Stange hinunter und hüpft
// ins Auto. Auto antippen → Tatü, das Blaulicht glimmt, das Auto fährt hinaus → weiter zur Einsatz-Seite.
// Kommt man zurück, fährt das Auto rückwärts wieder in die Garage und das Tor geht zu (endlose Schleife).
// Drei Helme liegen bereit: auf Hund, Katze und Bär ziehen. Hydrant, Schlauchrolle, Eimer reagieren beim Antippen,
// die Rutschstange auch (ist der Fuchs noch oben, baumeln seine Pfoten kurz aus dem Loch in der Decke).

import { spr, sfx, voice, note, tap, drag, Actor, fx, rand, pick, PIXI } from '../../engine/index.js';
import { Seite } from '../../gemeinsam/seiten.js';
import { belohne } from '../../gemeinsam/sticker.js';
import { FeuerAuto, setzeHelm, helmSitz, helmSprite, kopfPunkt, freue, feuerSticker } from './auto.js';
import { Vogel, Schmetterling, Wolken, tippStelle, entprellt } from './deko.js';

const AUTO_SKALA = 0.8;
const AUTO_Z_GARAGE = 10;     // in der Garage: hinter dem Rolltor (z 20)
const AUTO_Z_DRAUSSEN = 35;   // draußen: vor Eimer (12), Hydrant (30), Fuchs (26); hinter den Tieren (40) und Helmen (45)
const TOR = { links: -400, rechts: 576, oben: 772, unten: 1300 };  // Garagenöffnung (Szenen-Koordinaten)
const AUS_TOR = { x: 330, y: 1372, scale: 0.86 };                  // Platz vor der Garage (schräg rechts davor)
const WARTENDE = [
  { id: 'hund', x: -890, y: 1478, scale: 0.31 },
  { id: 'katze', x: -640, y: 1490, scale: 0.3 },
  { id: 'baer', x: -395, y: 1482, scale: 0.3 },
];
const HELM_PLAETZE = [{ x: 420, y: 1468 }, { x: 650, y: 1478 }, { x: 880, y: 1466 }];
const HELM_SKALA = 0.68;
const STANGE_X = 847;         // Mitte der gemalten Rutschstange (im Bild x 2250…2274, abgelesen)
const FUCHS_X = STANGE_X - 30; // Anker des Fuchses beim Rutschen: sein Körper liegt dann mittig an der Stange

export class Wache extends Seite {
  static hg = 'feuerwehr/hg_wache';

  aufbau() {
    this.zustand = 'zu';   // 'zu' | 'alarm' | 'bereit' | 'faehrt' | 'weg' | 'heim'
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

  // ---------------------------------------------------------------- Glocke

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
  }

  async alarm() {
    this.zustand = 'alarm';
    this.auto.blaulicht(true);
    // Tor rollt weich hoch
    this.after(0.35, () => sfx('common/rolltor', { vol: 0.75 }));
    this.tween(this.tor, { y: TOR.oben - 4 }, 2.3, { ease: 'sineInOut', delay: 0.3 });
    // Fuchs rutscht die Stange hinunter
    await this.wait(0.7);
    await this.fuchsRutscht();
    await this.wait(0.35);
    await this.fuchsSteigtEin();
    this.zustand = 'bereit';
    fx.pop(this.auto.f.rumpf, 0.04);
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
    this.fuchs.onTap(() => freue(this, this.fuchs, { herzen: 3 }), { pad: 60 });

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
    const f = this.fuchs;
    if (this.zustand !== 'zu' || f.visible || this.guckt) return;
    // Fuchs schaut von oben herunter: erst die Pfoten, dann wieder hinauf
    this.guckt = true;
    const { oben } = this.stange;
    f.stop();
    f.mask = this.fuchsMaske;
    this.fuchsMaske.visible = true;
    f.schatten.visible = false;
    f.position.set(FUCHS_X, oben.y - 20);
    f.visible = true;
    this.zeigeStangeVorn(true);
    this.tween(f, { y: oben.y + 110 }, 0.6, { ease: 'sineOut' }).then(async (ok) => {
      if (ok) {
        f.sound();
        await this.wait(0.9);
        if (this.zustand === 'zu') ok = await this.tween(f, { y: oben.y - 20 }, 0.6, { ease: 'sineIn' });
      }
      this.guckt = false;
      // beim Alarm übernimmt das Rutschen – dann nichts verstecken
      if (ok && this.zustand === 'zu') {
        f.visible = false;
        this.zeigeStangeVorn(false);
      }
    });
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
    await this.tween(f, { y: unten.y + 8 }, 1.05, { ease: 'quadIn' });
    f.mask = null;
    this.fuchsMaske.visible = false;
    f.schatten.visible = true;
    fx.pop(f, 0.1);
    sfx('common/landen', { vol: 0.7 });
    f.sound();
  }

  async fuchsSteigtEin() {
    const f = this.fuchs;
    const fahrer = this.auto.fahrer;
    // Ziel: Füße des Fahrers (im Fenster), in Seiten-Koordinaten
    const ziel = this.welt.toLocal(fahrer.toGlobal({ x: 0, y: 0 }));
    const skalaZiel = Math.abs(fahrer.worldTransform.a / this.welt.worldTransform.a);
    f.schatten.visible = false;
    f.stop();
    this.zeigeStangeVorn(false);   // er lässt die Stange los
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

  // ---------------------------------------------------------------- Losfahren und Heimkommen

  async losfahren() {
    this.zustand = 'faehrt';
    const a = this.auto;
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
    // rückwärts schräg in die Garage
    await a.fahre(this, { x: this.garage.x, y: this.garage.y, scale: AUTO_SKALA }, 1.8, 'sineInOut');
    a.f.zIndex = AUTO_Z_GARAGE;   // wieder hinter dem Rolltor
    sfx('common/rolltor', { vol: 0.6 });
    await this.tween(this.tor, { y: this.torZuY }, 2.2, { ease: 'sineInOut' });
    a.fahrer.visible = false;   // der Fuchs geht hinter dem Tor wieder nach oben
    this.klack('common/klack', { vol: 0.5 });
    this.zustand = 'zu';
  }

  // ---------------------------------------------------------------- Tiere und Helme

  baueWartende() {
    this.tiere = WARTENDE.map((w) => {
      const a = new Actor(w.id, { x: w.x, y: w.y, scale: w.scale, parent: this.welt, z: 40 });
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
    });
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
      h.traeger = null;
      h.zug = drag(h, {
        pad: 45,
        lift: 1.12,
        targets: () => this.tiere.filter((t) => !t.helm).map((t) => {
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
    // nach einer Weile legen die Tiere die Helme wieder hin – dann geht es von vorn los
    await this.wait(14);
    for (const t of this.tiere) {
      await this.helmAb(t);
      await this.wait(0.3);
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
  }

  verlassen() {
    this._hinweis?.kill();
    this._hinweis = null;
  }

  update(dt) {
    this.auto.update(dt);
    this.wolken.update(dt);
    this.vogel.update(dt);
    this.falter.update(dt);
  }

  hinweise() {
    const freieHelme = this.helme.filter((h) => !h.traeger && h.eventMode !== 'none');
    const ohneHelm = this.tiere.find((t) => !t.helm);
    const liste = [];
    if (this.zustand === 'zu') liste.push(this.glocke);
    if (this.zustand === 'bereit') liste.push(this.auto.f.koerper);
    if (freieHelme.length && ohneHelm) liste.push({ von: freieHelme[0], nach: ohneHelm });
    return liste;
  }
}

