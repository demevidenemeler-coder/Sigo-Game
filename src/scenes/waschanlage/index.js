// Ort „Waschanlage" – eine Bilderbuch-Seite.
//
// Ein Tier bringt sein Fahrzeug (es fährt oben auf dem Dach mit), hüpft hinunter und wartet links. Dann geht es
// Schritt für Schritt – jeder Schritt hat seine eigene Geste und sein eigenes Werkzeug am Werkzeugplatz links unten:
//   1. Schmutz weg      – wischen (Finger oder Bürste). Jede Runde anderer Schmutz: Matsch, Staub, Farbkleckse,
//                         Blätter (fallen beim Berühren sanft herunter) oder gemischt. Manchmal versteckt sich
//                         unter einem Fleck eine Überraschung (Frosch, Wurm, Ball, Teddy).
//   2. Einschäumen      – Schwamm aus dem Eimer nehmen (oder einfach mit dem Finger) über das Fahrzeug reiben
//   3. Abspülen         – Brause antippen/halten (sie schwenkt langsam) oder mit dem Finger übers Fahrzeug fahren;
//                         aus dem Schaum steigen ein paar große Seifenblasen (antippen: plopp)
//   4. Trocknen         – das Handtuch (liegt jetzt am Werkzeugplatz) über die Wassertropfen reiben oder die Tropfen
//                         antippen → Glanz, „Hurra, blitzblank!"
//   5. Reifen aufpumpen – nur manchmal: ein Reifen wird platt, die Pumpe steht bereit, jedes Antippen pumpt
//   6. Aufkleber        – drei zur Wahl auf einem Brett, das Tier wünscht sich einen (Denkblase); jeder ist richtig
//   Abschied            – das Tier freut sich, hüpft aufs Dach, die Ente klatscht, ein neuer Wimpel kommt an die
//                         Wimpelkette (wächst über die Runden, gespeichert), dann fährt es stolz hinaus.
//
// Reihenfolge ohne Zwang: Reiben auf dem Fahrzeug tut immer das, was gerade dran ist – egal ob mit Finger, Bürste,
// Schwamm oder Handtuch. Wasser spült zu jeder Zeit Matsch und Schaum weg. Das gerade passende Werkzeug wippt.
// Drei Wahl-Knöpfe links (eigene Lok, Auto, Traktor) bestimmen, was als Nächstes kommt; ohne Wahl reihum.
// Nebensachen: zwei Bürstenwalzen (drehen sich beim Antippen), Düsen und Rohre spritzen, Vogel auf der Mauer,
// Schmetterling, Wolken, Abfluss blubbert, Eimer blubbert, Wimpel wippen.

import {
  stage, spr, meta, sfx, voice, tap, drag, wipe, hold, Actor, fx, ui, rand, pick, shuffle, clamp, lerp, PIXI,
} from '../../engine/index.js';
import { Seite, SeitenSzene } from '../../gemeinsam/seiten.js';
import { belohne, gesammelt, stickerFuerOrt } from '../../gemeinsam/sticker.js';
import { TYPEN, plan, baueFahrzeug, flaechenPunkte, ohneGesicht, verteile, streue, oberkante } from './fahrzeuge.js';
import { Schleife } from './schleife.js';
import { Wolken, Vogel, Falter } from './deko.js';
import { Tankstelle } from './tankstelle.js';
import {
  KUNDEN, DEKO, SCHMUTZ, FUNDE, FARBEN, STAUB, neuOhne, Pumpe, StickerBrett, Wimpelkette, dachPunkt,
} from './werkstatt.js';

const { Container, Graphics, Rectangle, Circle, Sprite } = PIXI;

const START_ABSTAND = 2000;      // so weit links beginnt ein Fahrzeug (und so weit rechts verschwindet es)
const BRAUSE_SKALA = 0.85;
const DUESE = 330;               // Abstand Rohrende → Düse (Einheiten)
const WERKZEUG_BILD = {
  1: 'common/buerste', 2: 'common/schwamm', 3: 'waschanlage/brause', 4: 'common/handtuch', 5: 'waschanlage/pumpe_koerper',
};
const SPUEL_PAUSE = 2.5;         // so lange nach dem Einschäumen gibt Reiben noch kein Wasser (der Schaum bleibt stehen)
const GESICHT_MATSCH = 220;      // Abstand (Bildpunkte des Körpers) von Augen/Mund, unter dem kein Matsch landet
const GESICHT_SCHAUM = 165;      // dito für Schaum – das Fahrzeug lächelt aus dem Schaum heraus
// gemalte Sprühdüsen an der Wand (am Raster des Hintergrunds abgelesen, Seiten-Koordinaten). Die linke äußere
// (x≈-887) liegt hinter den Wahl-Knöpfen und bekommt keine eigene Fläche.
const DUESEN = [{ x: -717, y: 682 }, { x: -551, y: 682 }, { x: 567, y: 682 }, { x: 732, y: 682 }, { x: 897, y: 682 }];
const STAND = { x: -820, y: 1300 };        // dort wartet das Tier, dem das Fahrzeug gehört
const HANDTUCH_HEIM = { x: -715, y: 1438 };
const PUMPE_ORT = { x: -600, y: 1482 };
const BRETT_ORT = { x: -760, y: 1424 };
const PLATT = 0.62;                        // so flach ist ein platter Reifen (Höhe)
const KIPP = -0.022;                       // so weit neigt sich das Fahrzeug zum platten Reifen

// weicher runder Fleck (Schatten, Pfütze) aus der Rauch-Textur der Effekte
function weich(parent, { x, y, w, h, farbe, alpha, z }) {
  const s = new Sprite(fx.texture('rauch'));
  s.anchor.set(0.5);
  s.tint = farbe;
  s.alpha = alpha;
  s.width = w;
  s.height = h;
  s.position.set(x, y);
  s.zIndex = z;
  s.eventMode = 'none';
  parent.addChild(s);
  return s;
}

class Waschplatz extends Seite {
  static hg = 'waschanlage/hg_waschanlage';

  aufbau() {
    this.P = {
      fz: this.punkt('fahrzeug', { x: 0, y: 1390 }),
      eimer: this.punkt('eimer', { x: 665, y: 1420 }),
      dusche: this.punkt('dusche', { x: 107, y: 345 }),
      abfluss: this.punkt('abfluss', { x: -14, y: 1330 }),
    };
    this.w = null;               // das Fahrzeug, das gerade da ist (siehe kommen())
    this.gewaehlt = null;        // per Knopf gewählt: kommt als Nächstes
    this.letzterTyp = null;
    this.letzterSchmutz = null;
    this.letzteKunden = [];
    this.letzterFund = null;
    this.letztesPlatt = true;
    this.letzteDeko = [];
    this.runden = 0;
    this.knopfGetippt = false;   // schon einmal einen Wahl-Knopf angetippt
    this.tore = new Map();       // Entprellen von Tönen/Teilchen: name → letzte Zeit
    this.finger = new Map();     // pointerId → {x, y, t} letzter Ort eines Fingers auf dem Fahrzeug
    this.unten = new Set();      // pointerIds, die gerade aufliegen
    this.werkzeugFinger = new Set();   // pointerIds, die gerade Schwamm, Bürste oder Handtuch ziehen
    this.wasser = { staerke: 0, halten: false, nach: 0, finger: 0, ziel: { x: 0, y: 0 }, schwenk: 0, tonAn: false };
    this.wasserTon = new Schleife('common/wasserstrahl', { vol: 0.5 });
    this.fahrTon = null;
    this.pfuetzeZiel = 0;

    this.baueDeko();
    this.baueDuesen();
    this.baueWalzen();
    this.baueEnte();
    this.baueEimer();
    this.baueBuerste();
    this.baueHandtuch();
    this.bauePumpe();
    this.baueBrett();
    this.baueBlasen();
    this.baueBrause();
    this.baueKnoepfe();
    this.baueReiber();

    // Ab und zu zeigt die Ente, welches Werkzeug jetzt passt (beim Aufkleber: das Tier zeigt seinen Wunsch) –
    // nur, wenn gerade niemand spielt
    this.every(13, () => {
      const w = this.w;
      if (!this.aktiv || !w || w.zustand !== 'waschen' || this.szene.idle < 5) return;
      if (w.schritt === 6) {
        if (!w.deko.gewaehlt && !w.kunde.reitet) w.kunde.actor.bubble(w.deko.wunsch, 2.6);
      } else if (WERKZEUG_BILD[w.schritt]) {
        this.enteDenkt(WERKZEUG_BILD[w.schritt]);
      }
    });
  }

  // Denkblase der Ente – links vom Kopf (rechts davon wäre sie auf schmalen Bildschirmen abgeschnitten)
  enteDenkt(bild) {
    this.ente.bubble(bild, 2.2, { seite: 'links' });
  }

  betreten() {
    if (this.besuche === 1) this.after(0.5, () => voice('waschanlage_hallo'));
    if (!this.w) this.after(0.4, () => this.kommen());
  }

  verlassen() {
    this.wasser.halten = false;
    this.wasserTon.aus(0.3);
    this.wasser.tonAn = false;
    this.fahrTon?.aus(0.3);
  }

  aufraeumen() {
    for (const [art, fn] of Object.entries(this._lauscher || {})) window.removeEventListener(art, fn);
    this._lauscher = null;
    this.wasserTon.ende();
    this.fahrTon?.ende();
  }

  // ---------------------------------------------------------------- Aufbau

  baueDeko() {
    this.wolken = new Wolken(this.hinten, { von: -620, bis: 1320 });
    // Mauerkrone: dort sitzt der Vogel (links vom Rohrbogen und rechts davon)
    this.vogel = new Vogel(this, { stangen: [[-930, -430, 378], [330, 880, 378]], parent: this.welt, z: 4 });
    this.falter = new Falter(this, { bereich: { x0: -820, x1: 820, y0: 200, y1: 560 }, parent: this.welt, z: 70 });
    // Wimpelkette über der Mauer: ein Wimpel je fertig gewaschenem Fahrzeug
    this.kette = new Wimpelkette(this, { parent: this.welt, z: 3 });

    // Abfluss im Boden: blubbert beim Antippen
    const a = this.P.abfluss;
    const abfluss = new Container({ label: 'abfluss' });
    abfluss.position.set(a.x, a.y);
    abfluss.zIndex = 2;
    this.welt.addChild(abfluss);
    tap(abfluss, () => {
      sfx('common/blubber', { vol: 0.5 });
      this.burst('blasen', a.x, a.y - 20, { count: 3 });
    }, { sound: null, squash: false, hitArea: new Circle(0, 0, 120) });

    // Pfütze unter dem Fahrzeug (wächst beim Abspülen, trocknet langsam)
    this.pfuetze = weich(this.welt, { x: this.P.fz.x, y: this.P.fz.y - 8, w: 1150, h: 120, farbe: 0x86c8f0, alpha: 0, z: 25 });
  }

  // Die gemalten Sprühdüsen und Rohre der Wand: Antippen einer Düse gibt einen kleinen Wasserstrahl; Antippen eines
  // Rohrs blubbert, und kurz darauf spritzt die nächste Düse (bzw. beim Rohrbogen die Brause) – das Wasser kommt an.
  baueDuesen() {
    this.duesen = DUESEN.map((p, i) => {
      const strahl = spr('waschanlage/wasserfaden', { x: p.x, y: p.y + 18, scale: 0.3, parent: this.welt, z: 6 });
      strahl.alpha = 0;
      strahl.visible = false;
      strahl.eventMode = 'none';
      const d = { ...p, i, strahl, n: 0 };
      const zone = new Container({ label: 'duese' });
      zone.position.set(p.x, p.y);
      zone.zIndex = 3;
      this.welt.addChild(zone);
      tap(zone, () => this.spritze(d), { sound: null, squash: false, hitArea: new Circle(0, 0, 108) });
      return d;
    });

    const rohre = [
      { x0: -1100, x1: -160, y0: 400, y1: 600, was: 'links' },
      { x0: -160, x1: 160, y0: 170, y1: 420, was: 'brause' },
      { x0: 250, x1: 1090, y0: 400, y1: 600, was: 'rechts' },
    ];
    for (const r of rohre) {
      const zone = new Container({ label: 'rohr' });
      zone.zIndex = 2;
      this.welt.addChild(zone);
      tap(zone, (e) => this.rohrGetippt(r, e), {
        sound: null, squash: false, hitArea: new Rectangle(r.x0, r.y0, r.x1 - r.x0, r.y1 - r.y0),
      });
    }
  }

  spritze(d) {
    if (!this.tor('duese' + d.i, 0.45)) return;
    const s = d.strahl;
    const n = ++d.n;
    s.visible = true;
    this.tween(s, { alpha: 0.85 }, 0.3, { ease: 'sineInOut' });
    this.after(0.8, () => {
      if (d.n !== n || s.destroyed) return;
      this.tween(s, { alpha: 0 }, 0.6, { ease: 'sineInOut' }).then((ok) => { if (ok && d.n === n) s.visible = false; });
    });
    if (this.tor('spritz', 0.3)) sfx('common/spritz', { vol: 0.35 });
    this.after(0.35, () => this.burst('tropfen', d.x + rand(-20, 20), d.y + 210, { count: 2 }));
  }

  rohrGetippt(r, e) {
    if (this.tor('rohr', 0.5)) sfx('common/blubber', { vol: 0.3 });
    if (r.was === 'brause') {
      this.after(0.3, () => {
        this.wasser.nach = Math.max(this.wasser.nach, 0.6);
        fx.pop(this.duschkopf, 0.04);
      });
      return;
    }
    // die Düse dieser Seite, die dem Finger am nächsten ist
    const x = e?.x ?? (r.x0 + r.x1) / 2;
    const seite = this.duesen.filter((d) => (r.was === 'links' ? d.x < 0 : d.x > 0));
    let beste = seite[0];
    for (const d of seite) if (Math.abs(d.x - x) < Math.abs(beste.x - x)) beste = d;
    if (beste) this.after(0.35, () => this.spritze(beste));
  }

  baueWalzen() {
    this.walzen = [];
    const y = 905;
    for (const seite of [-1, 1]) {
      const x = seite * 650;
      const rohr = seite * 1075;   // senkrechtes gelbes Rohr im Hintergrund
      const x0 = Math.min(x, rohr);
      const breite = Math.abs(rohr - x);
      const arm = new Graphics()
        .roundRect(x0, y - 17, breite, 34, 17).fill(0xf2c53d).stroke({ width: 3, color: 0xd6a22a })
        .roundRect(x0 + 10, y - 13, breite - 20, 9, 4.5).fill({ color: 0xffffff, alpha: 0.3 })
        .roundRect(rohr - 28, y - 32, 56, 64, 16).fill(0xf4ecdc).stroke({ width: 3, color: 0xd5c9b2 })
        .circle(rohr, y, 8).fill(0xd5c9b2);
      arm.zIndex = 8;
      arm.eventMode = 'none';
      this.welt.addChild(arm);
      weich(this.welt, { x: x + 18, y: y + 22, w: 330, h: 330, farbe: 0x1d3b66, alpha: 0.22, z: 9 });
      const s = spr('waschanlage/buerste_walze', { x, y, scale: 0.56, parent: this.welt, z: 10 });
      s.rotation = rand(0, Math.PI * 2);
      tap(s, () => this.walzeDreht(s, seite), { sound: null });
      this.walzen.push(s);

      // die großen gemalten Bürsten am Bildrand: Antippen dreht die Walze dieser Seite mit
      const randZone = new Container({ label: 'randbuerste' });
      randZone.zIndex = 1;
      this.welt.addChild(randZone);
      tap(randZone, () => this.walzeDreht(s, seite), {
        sound: null, squash: false,
        hitArea: new Rectangle(seite < 0 ? -1420 : 1110, 420, 310, 680),
      });
    }
  }

  walzeDreht(s, seite) {
    this.tween(s, { rotation: s.rotation + seite * Math.PI * 2 }, 2.2, { ease: 'cubicOut' });
    if (this.tor('walze' + seite, 0.6)) {
      sfx('common/schrubben', { vol: 0.5, rate: 0.9 });
      this.burst('blasen', s.x, s.y + 60, { count: 3 });
    }
  }

  baueEnte() {
    this.ente = new Actor('ente', { x: 930, y: 1300, scale: 0.45, parent: this.welt, z: 20 });
    this.ente.flip = true;   // schaut nach links zum Waschplatz
    this.ente.onTap(() => this.ente.cheer({ parent: this.vorn }));
  }

  baueEimer() {
    const e = this.P.eimer;
    weich(this.welt, { x: e.x - 6, y: e.y - 8, w: 330, h: 64, farbe: 0x34405a, alpha: 0.3, z: 39 });
    this.eimer = spr('waschanlage/eimer_schaum', { x: e.x, y: e.y, scale: 0.8, parent: this.welt, z: 40 });
    tap(this.eimer, () => {
      fx.wobble(this.eimer, 0.05);
      if (this.tor('eimer', 0.5)) {
        sfx('common/blubber', { vol: 0.5 });
        this.burst('blasen', e.x, e.y - 300, { count: 4 });
      }
    }, { sound: null });

    // Der Schwamm liegt oben im Eimer (über dem gemalten); darunter ein Schaumklecks, falls er weg ist
    this.schwammHeim = { x: e.x + 22, y: e.y - 268 };
    const klecks = spr('waschanlage/schaum_b', { x: this.schwammHeim.x, y: this.schwammHeim.y + 6, scale: 0.27, parent: this.welt, z: 45 });
    klecks.eventMode = 'none';
    this.schwamm = spr('common/schwamm', { x: this.schwammHeim.x, y: this.schwammHeim.y, scale: 0.45, parent: this.welt, z: 50 });
    this.schwammZug = drag(this.schwamm, {
      back: true,
      lift: 1.08,
      hitArea: new Rectangle(-260, -240, 520, 480),
      onStart: (ctx) => {
        this.werkzeugFinger.add(ctx.pointerId);
        sfx('common/plopp', { vol: 0.6 });
      },
      onDrop: (ziel, ctx) => {
        this.werkzeugFinger.delete(ctx?.pointerId);
        this.after(0.45, () => sfx('common/plopp', { vol: 0.4 }));
      },
    });
  }

  baueBuerste() {
    this.buersteHeim = { x: -700, y: 1452, rot: -0.12 };
    const h = this.buersteHeim;
    this.buersteSchatten = weich(this.welt, { x: h.x, y: h.y + 40, w: 300, h: 50, farbe: 0x34405a, alpha: 0.28, z: 44 });
    this.buerste = spr('common/buerste', { x: h.x, y: h.y, scale: 0.62, parent: this.welt, z: 45 });
    this.buerste.rotation = h.rot;
    this.buersteZug = drag(this.buerste, {
      back: true,
      lift: 1.08,
      // unten gekürzt: nichts von der Fläche liegt im Rand der Systemgesten (unter y≈1530)
      hitArea: new Rectangle(-245, -235, 490, 330),
      onStart: (ctx) => {
        this.werkzeugFinger.add(ctx.pointerId);
        sfx('common/wisch', { vol: 0.4 });
      },
      onDrop: (ziel, ctx) => {
        this.werkzeugFinger.delete(ctx?.pointerId);
        this.after(0.45, () => sfx('common/klack', { vol: 0.35 }));
      },
    });
  }

  // Handtuch: liegt beim Trocknen am Werkzeugplatz (statt der Bürste)
  baueHandtuch() {
    const h = HANDTUCH_HEIM;
    this.handtuchSchatten = weich(this.welt, { x: h.x, y: h.y + 62, w: 300, h: 50, farbe: 0x34405a, alpha: 0, z: 44 });
    this.handtuch = spr('common/handtuch', { x: h.x, y: h.y, scale: 0.6, anchor: 0.5, parent: this.welt, z: 46 });
    this.handtuch.alpha = 0;
    this.handtuch.visible = false;
    this.handtuchZug = drag(this.handtuch, {
      back: true,
      lift: 1.08,
      hitArea: new Rectangle(-260, -190, 520, 340),
      onStart: (ctx) => {
        this.werkzeugFinger.add(ctx.pointerId);
        sfx('common/wisch', { vol: 0.35, rate: 1.1 });
      },
      onDrop: (ziel, ctx) => {
        this.werkzeugFinger.delete(ctx?.pointerId);
        this.after(0.45, () => sfx('common/plopp', { vol: 0.3 }));
      },
    });
    this.handtuch.eventMode = 'none';
  }

  bauePumpe() {
    this.pumpe = new Pumpe(this, {
      x: PUMPE_ORT.x, y: PUMPE_ORT.y, parent: this.welt, z: 46,
      onPump: () => this.pumpen('pumpe'),
    });
    this.pumpeSchatten = weich(this.welt, { x: PUMPE_ORT.x, y: PUMPE_ORT.y - 6, w: 230, h: 46, farbe: 0x34405a, alpha: 0, z: 44 });
  }

  baueBrett() {
    this.brett = new StickerBrett(this, {
      x: BRETT_ORT.x, y: BRETT_ORT.y, parent: this.welt, z: 47,
      onWahl: (platz) => this.dekoGewaehlt(platz),
    });
    this.brettSchatten = weich(this.welt, { x: BRETT_ORT.x, y: BRETT_ORT.y + 96, w: 700, h: 70, farbe: 0x34405a, alpha: 0, z: 44 });
  }

  // drei große Seifenblasen (werden wiederverwendet): steigen nach dem Einschäumen langsam auf, Antippen: plopp
  baueBlasen() {
    this.blasen = [0, 1, 2].map((i) => {
      const s = spr('common/p_blase', { anchor: 0.5, scale: 1.15, parent: this.welt, z: 72 });
      s.alpha = 0;
      s.visible = false;
      const b = { s, aktiv: false, zeit: 0, phase: i * 2.1, basis: 1.15 };
      tap(s, () => this.blasePlatzt(b), { sound: null, squash: false, hitArea: new Circle(0, 0, 100) });
      s.eventMode = 'none';
      return b;
    });
  }

  baueBrause() {
    const d = this.P.dusche;
    const c = new Container({ label: 'brause' });
    c.position.set(d.x, d.y);
    c.zIndex = 60;
    this.welt.addChild(c);
    this.brause = c;
    // Wasser hinter dem Duschkopf (kommt unten aus den Düsen)
    const wasser = new Container({ label: 'wasser' });
    wasser.position.set(3, DUESE - 14);
    wasser.eventMode = 'none';
    wasser.interactiveChildren = false;
    wasser.alpha = 0;
    wasser.visible = false;
    this.strahl = spr('waschanlage/wasserfaden', { parent: wasser, scale: 0.9 });
    this.strahl2 = spr('waschanlage/wasserfaden', { parent: wasser, scale: 0.84, x: 6 });
    this.strahl2.scale.x = -0.84;
    this.strahl2.alpha = 0.5;
    this.wasserC = wasser;
    c.addChild(wasser);
    this.duschkopf = spr('waschanlage/brause', { scale: BRAUSE_SKALA, parent: c });

    this.brauseHalten = hold(c, {
      hitArea: new Rectangle(-150, -10, 300, 380),
      onStart: () => {
        this.wasser.halten = true;
        fx.pop(this.duschkopf, 0.05);
      },
      onEnd: () => {
        this.wasser.halten = false;
        this.wasser.nach = 0.7;   // ein kurzes Antippen gibt einen kleinen Guss
      },
    });
  }

  baueKnoepfe() {
    this.knoepfe = TYPEN.map((typ) => {
      const k = this.knopf(`waschanlage/icon_${typ}_wahl`, { size: 210, onTap: () => this.waehle(typ) });
      k.typ = typ;
      return k;
    });
    this.ordneKnoepfe();
  }

  ordneKnoepfe() {
    const x = stage.W / 2 - 960;
    this.knoepfe.forEach((k, i) => k.position.set(x, 470 + i * 232));
  }

  resize() {
    this.ordneKnoepfe();
  }

  markiereKnopf(typ) {
    for (const k of this.knoepfe) k.markiere(k.typ === typ);
  }

  // Jede Fingerbewegung zählt: Was über dem Fahrzeug gerieben wird, wirkt – egal, ob der Finger auf dem
  // Fahrzeug, auf einem Werkzeug oder daneben angefangen hat. Der Kern schaltet Pixis globale
  // Bewegungs-Ereignisse ab (Leistung), darum hören wir selbst am Fenster mit; Abbau in aufraeumen().
  baueReiber() {
    const unten = this.unten;
    const p = new PIXI.Point();
    const ort = (ev) => {
      stage.app.renderer.events.mapPositionToPoint(p, ev.clientX, ev.clientY);
      return this.welt.toLocal(p);
    };
    const los = (ev) => {
      unten.delete(ev.pointerId);
      this.finger.delete(ev.pointerId);
      this.werkzeugFinger.delete(ev.pointerId);
      this.w?.alteFinger?.delete(ev.pointerId);
    };
    this._lauscher = {
      pointerdown: (ev) => { unten.add(ev.pointerId); },
      pointermove: (ev) => {
        if (!unten.has(ev.pointerId) || !this.szene.alive) return;
        try {
          this.fingerZieht(ev.pointerId, ort(ev));
        } catch (err) {
          console.error('[waschanlage] Reiben:', err);
        }
      },
      pointerup: los,
      pointercancel: los,
    };
    for (const [art, fn] of Object.entries(this._lauscher)) window.addEventListener(art, fn, { passive: true });
  }

  // ---------------------------------------------------------------- Fahrzeuge kommen und gehen

  naechsterTyp() {
    let typ;
    if (this.gewaehlt) {
      typ = this.gewaehlt;
      this.gewaehlt = null;
    } else {
      typ = TYPEN[(TYPEN.indexOf(this.letzterTyp) + 1) % TYPEN.length];
    }
    this.letzterTyp = typ;
    return typ;
  }

  // Was diese Runde anders ist: Schmutz, Tier, platter Reifen, Überraschung, Aufkleber
  wuerfle(typ) {
    // Traktoren kommen gern vom Feld (Matsch, Blätter); jede Art aber nie zweimal hintereinander
    const arten = typ === 'traktor' && Math.random() < 0.5 ? ['matsch', 'blaetter', 'gemischt'] : SCHMUTZ;
    const schmutz = neuOhne(arten, this.letzterSchmutz);
    this.letzterSchmutz = schmutz;
    const kunde = neuOhne(KUNDEN, this.letzteKunden);
    this.letzteKunden = [kunde, ...this.letzteKunden].slice(0, 3);
    // platter Reifen: etwa jede zweite Runde, nie zweimal nacheinander ohne
    const platt = !this.letztesPlatt || Math.random() < 0.35;
    this.letztesPlatt = platt;
    const fund = Math.random() < 0.6 ? neuOhne(FUNDE, this.letzterFund) : null;
    if (fund) this.letzterFund = fund;
    const ids = shuffle(DEKO.filter((d) => !this.letzteDeko.includes(d))).slice(0, 3);
    this.letzteDeko = ids;
    return { schmutz, kunde, platt, fund, deko: { ids, wunsch: pick(ids), gewaehlt: null } };
  }

  kommen() {
    if (this.w || !this.szene.alive) return;
    const typ = this.naechsterTyp();
    const p = plan(typ);
    const f = baueFahrzeug(p, { x: this.P.fz.x - START_ABSTAND, y: this.P.fz.y, parent: this.welt, z: 30 });
    const los = this.wuerfle(typ);
    const w = {
      typ, plan: p, f, zustand: 'kommt', schritt: 0, flecken: [], schaum: [], tropfen: [], box: null, oben: 1000,
      schmutz: los.schmutz, platt: los.platt ? { luft: 1, anzeige: 1 } : null, deko: los.deko, fund: null, kipp: 0,
    };
    this.w = w;
    this.markiereKnopf(typ);
    this.beschmutze(w);
    if (los.fund && w.flecken.length) w.fund = { art: los.fund, fleck: pick(w.flecken) };
    this.baueSchaum(w);
    this.baueWaschflaeche(w);
    this.baueKunde(w, los.kunde);
    this.fahrTonAn(w);
    f.fahreZu(this.P.fz.x, 3.4, { ease: 'sineInOut' }).then((ok) => {
      if (ok && this.w === w && w.zustand === 'kommt') this.angekommen(w);
    });
  }

  // Das Tier, dem das Fahrzeug gehört: fährt auf dem Dach mit
  baueKunde(w, info) {
    // auf dem Dach links der Brause (die hängt über der Mitte), damit das Tier frei steht
    const dach = dachPunkt(flaechenPunkte(w.plan), -230 / w.plan.scale);
    const kante = oberkante(w.plan.koerper, dach.x);
    if (kante !== null) dach.y = kante + 10;   // Füße genau auf dem Dach
    const g = this.welt.toLocal(w.f.innen.toGlobal(dach));
    const a = new Actor(info.id, { x: g.x, y: g.y, scale: info.h / 900, parent: this.welt, z: 32 });
    w.kunde = { actor: a, info, reitet: true, dx: g.x - w.f.x, y: g.y };
    a.onTap(() => {
      a.cheer({ parent: this.vorn });
      if (w.zustand === 'waschen' && w.schritt === 6 && !w.deko.gewaehlt) this.after(0.6, () => a.bubble(w.deko.wunsch, 2.4));
    });
  }

  angekommen(w) {
    this.fahrTon?.aus(0.7);
    this.miss(w);
    w.zustand = 'waschen';
    w.schritt = 1;
    this.gruss(w);
    this.ente.nod();
    // das Tier hüpft vom Dach und wartet links
    w.kunde.reitet = false;
    this.after(0.5, () => this.kundeRunter(w));
    // „Wisch den Matsch weg" – nur, wenn das Kind noch nicht selbst wischt (auch nicht, wenn er erst später an die
    // Reihe kommt: nurWenn wird dann noch einmal gefragt)
    const matschNoch = () => this.aktiv && this.w === w && w.zustand === 'waschen' && w.schritt === 1 && !w.gewischt
      && w.flecken.every((f) => !f.fertig && f.rest >= 0.98);
    const satz = w.schmutz === 'matsch' ? 'waschanlage_matsch' : 'waschanlage_schmutzig';
    this.after(1.8, () => { if (matschNoch()) voice(satz, { nurWenn: matschNoch }); });
    // schon beim Hereinrollen den Fleck mit der Überraschung weggewischt: jetzt kommt sie heraus (nach dem
    // Hüpfer des Tiers, damit sich nicht zu viel zugleich bewegt)
    if (w.fund?.wartet) {
      w.fund.wartet = false;
      const f = w.fund.fleck;
      this.after(1.7, () => this.zeigeFund(w, f));
    }
    this.pruefe();   // vielleicht wurde schon beim Hereinrollen gewischt
  }

  // Fahrzeug fährt hinaus (fertig gewaschen oder weil ein anderes gewählt wurde), dann kommt das nächste.
  // Steht das Tier noch unten, hüpft es zuerst aufs Dach. Eilig (anderes gewählt): Ist es gerade erst links
  // hereingerollt, rollt es weich links zurück statt quer durchs Bild; sonst nach rechts. Die Dauer richtet sich nach
  // dem Weg, damit es nie hektisch wird (≤ ~1100 Einheiten/s).
  losfahren(w, eilig = false) {
    if (w !== this.w || w.zustand === 'geht') return;
    const zurueck = eilig && w.zustand === 'kommt' && w.f.x < this.P.fz.x - 300;
    w.zustand = 'geht';
    for (const f of this.finger.values()) f.weg = true;
    if (w.platt) w.platt.luft = 1;   // nichts fährt mit plattem Reifen davon
    if (w.kunde.reitet) {
      this.fahreWeg(w, eilig, zurueck);
      return;
    }
    this.kundeAufsDach(w, 1.1);
    this.after(1.2, () => this.fahreWeg(w, eilig, zurueck));
  }

  // Das Tier hüpft vom Dach an seinen Warteplatz. Wird der Sprung unterbrochen (das Kind tippt es an und es freut
  // sich), springt es kurz danach noch einmal – es bleibt nie in der Luft hängen.
  kundeRunter(w, versuch = 0) {
    const k = w.kunde;
    if (k.actor.destroyed || k.reitet || this.w !== w) return;
    k.actor.hopTo(STAND.x, STAND.y, { hoehe: 140, dauer: 1.15 }).then((ok) => {
      if (k.actor.destroyed || k.reitet) return;
      if (!ok) {
        if (versuch < 4) this.after(0.6, () => this.kundeRunter(w, versuch + 1));
        return;
      }
      k.actor.zIndex = 21;
      k.actor.lookAt(STAND.x + 100);
      if (versuch === 0) k.actor.sound();
    });
  }

  // Das Tier hüpft aufs Dach und fährt mit. Wird der Sprung unterbrochen, zieht update() es weich aufs Dach.
  kundeAufsDach(w, dauer) {
    const k = w.kunde;
    if (k.reitet || k.actor.destroyed) return;
    k.reitet = true;
    k.springt = true;
    k.actor.zIndex = 32;
    k.actor.hopTo(w.f.x + k.dx, k.y, { hoehe: 150, dauer }).then(() => {
      k.springt = false;
      if (!k.actor.destroyed) k.actor.lookAt(k.actor.x + 100);
    });
  }

  fahreWeg(w, eilig, zurueck) {
    if (this.w !== w || w.f.destroyed) return;
    this.fahrTonAn(w);
    sfx('common/wusch', { vol: 0.35 });
    const ziel = this.P.fz.x + (zurueck ? -START_ABSTAND : START_ABSTAND);
    const dauer = eilig ? clamp(Math.abs(ziel - w.f.x) / 700, 1.2, 3.4) : 3.2;
    w.f.fahreZu(ziel, dauer, { ease: eilig ? 'sineInOut' : 'quadIn' }).then(() => {
      if (!w.kunde.actor.destroyed) w.kunde.actor.destroy({ children: true });
      if (!w.f.destroyed) w.f.destroy({ children: true });
      if (this.w !== w) return;
      this.w = null;
      this.fahrTon?.aus(0.6);
      if (this.runden === 1 && !eilig && !this.wahlGezeigt && !this.knopfGetippt) {
        this.wahlGezeigt = true;
        voice('waschanlage_wahl', { nurWenn: () => this.aktiv && !this.knopfGetippt });
        this.after(0.9, () => { if (this.aktiv) ui.hand(this.knoepfe[TYPEN.indexOf(this.letzterTyp) === 2 ? 0 : 2]); });
      }
      this.after(0.5, () => this.kommen());
    });
  }

  waehle(typ) {
    this.knopfGetippt = true;   // das Kind kennt die Wahl-Knöpfe schon: kein Hinweis mehr darauf
    const w = this.w;
    if (w && w.typ === typ && w.zustand !== 'geht') {
      // ist schon da: grüßt
      this.gruss(w);
      return;
    }
    this.gewaehlt = typ;
    this.markiereKnopf(typ);
    if (w && (w.zustand === 'kommt' || w.zustand === 'waschen')) this.losfahren(w, true);
    else if (!w) this.kommen();
  }

  gruss(w) {
    if (!this.tor('gruss', 0.7)) return;
    const g = w.plan.gruss;
    sfx(g.id, { vol: g.vol, rate: g.rate ?? 1 });
    w.f.hupf(26);
    if (w.plan.dampf) {
      const s = w.f.punkt('schornstein', this.vorn);
      if (s) this.burst('rauch', s.x, s.y - 10, { count: 4 });
    }
  }

  fahrTonAn(w) {
    this.fahrTon?.aus(0.3);
    this.fahrTon = new Schleife(w.plan.fahrTon, { vol: 0.4 });
    if (this.aktiv) this.fahrTon.an(0.5);
  }

  // ---------------------------------------------------------------- Schmutz und Schaum anbringen

  beschmutze(w) {
    const pts = flaechenPunkte(w.plan);
    let oben = Infinity;
    let unten = -Infinity;
    for (const p of pts) { oben = Math.min(oben, p.y); unten = Math.max(unten, p.y); }
    const art = w.schmutz;
    let nWisch = 0;
    let nBlatt = 0;
    if (art === 'matsch' || art === 'farbe') nWisch = Math.random() < 0.5 ? 4 : 5;
    else if (art === 'staub') nWisch = 5;
    else if (art === 'blaetter') nBlatt = Math.random() < 0.5 ? 6 : 7;
    else { nWisch = 3; nBlatt = 3; }
    const n = nWisch + nBlatt;
    // … nie ins Gesicht (ein Klecks am Auge läse sich wie ein Auge/Ohr, und die Freude wäre verdeckt)
    // (Blätter sind größer und breiter: etwas mehr Abstand)
    const frei = ohneGesicht(w.plan, pts, nBlatt ? GESICHT_MATSCH + 40 : GESICHT_MATSCH, n * 3);
    // Matsch sitzt eher unten (dort spritzt er hin); Staub, Farbe und Blätter überall
    const tief = frei.filter((p) => p.y > oben + (unten - oben) * 0.3);
    const orte = shuffle(verteile(art === 'matsch' && tief.length >= n * 3 ? tief : frei, n));
    const matsch = shuffle(['matsch_a', 'matsch_b', 'matsch_c', 'matsch_d', 'matsch_e']);
    const hell = shuffle(['fleck_hell_a', 'fleck_hell_d', 'fleck_hell_e']);
    const farben = shuffle([...FARBEN]);
    orte.forEach((o, i) => {
      if (i >= nWisch) {
        this.baueBlatt(w, o);
      } else if (art === 'farbe') {
        this.baueFleck(w, o, hell[i % hell.length], { tint: farben[i % farben.length], mass: rand(185, 225) });
      } else if (art === 'staub') {
        const id = pick(['fleck_hell_a', 'fleck_hell_e']);
        this.baueFleck(w, o, id, { tint: pick(STAUB), alpha: 0.88, mass: rand(175, 210), staub: true });
      } else {
        this.baueFleck(w, o, matsch[i % matsch.length], { mass: rand(195, 235) });
      }
    });
  }

  // Ein Fleck zum Wegwischen (Matsch, Staub, Farbe)
  baueFleck(w, o, bild, { tint = 0xffffff, alpha = 1, mass: einheiten = 210, staub = false } = {}) {
    const s0 = w.plan.scale;
    const huelle = new Container({ label: 'fleck' });
    huelle.position.set(o.x, o.y);
    huelle.rotation = rand(-0.35, 0.35);
    huelle.zIndex = 5;
    const s = spr('waschanlage/' + bild, { parent: huelle });
    s.tint = tint;
    s.alpha = alpha;
    const mass = einheiten / s0;
    const sk = mass / Math.max(s.texture.width, s.texture.height);
    s.scale.set(sk);
    w.f.innen.addChild(huelle);
    const fleck = { art: 'wisch', huelle, sprite: s, rest: 1, fertig: false, x: o.x, y: o.y, r: mass * s0 * 0.45, wx: 0, wy: 0, staub };
    // Tippfläche mindestens ~250 Einheiten, auch beim schmalen Streifen
    const min = 250 / (sk * s0);
    const bw = Math.max(s.texture.width, min);
    const bh = Math.max(s.texture.height, min);
    fleck.wisch = wipe(s, {
      radius: 95,
      sound: null,
      hitArea: new Rectangle(-bw / 2, -bh / 2, bw, bh),
      onProgress: () => {
        w.gewischt = true;   // das Kind wischt schon: kein Hinweis mehr auf den Schmutz
        if (this.tor('wisch', 0.35)) sfx('common/wisch', { vol: 0.5 });
        if (this.tor('krumen', 0.3) && fleck.wx) this.burst('staub', fleck.wx + rand(-40, 40), fleck.wy, { count: 1 });
      },
      onDone: () => this.fleckWeg(fleck),
    });
    // Antippen allein schafft den Fleck auch: Jeder Tipp macht ihn ein Stück blasser (wie ein Tupfer auf dem
    // Fahrzeug), nach 4 Tipps ist er weg. Ohne das bliebe ein Kind, das die Zeige-Hand nachmacht und immer wieder
    // auf dieselbe Stelle tippt, hängen – das Wischen allein frisst an derselben Stelle nichts mehr weg.
    tap(s, (e) => this.fleckGetippt(w, huelle, e), { sound: null, squash: false });
    w.flecken.push(fleck);
  }

  fleckGetippt(w, huelle, e) {
    if (this.w !== w || w.zustand !== 'waschen' || w.schritt !== 1 || huelle.destroyed) return;
    const p = this.welt.toLocal(huelle.toGlobal({ x: e.x, y: e.y }));
    this.reibe(p.x, p.y, 0, true, e.pointerId);
  }

  // Ein Blatt: fällt beim ersten Berühren (Finger, Bürste, Wasser) sanft herunter
  baueBlatt(w, o) {
    const s0 = w.plan.scale;
    const huelle = new Container({ label: 'blatt' });
    huelle.position.set(o.x, o.y);
    huelle.rotation = rand(-0.9, 0.9);
    huelle.zIndex = 6;
    const s = spr(pick(['common/p_blatt', 'common/p_blatt_herbst', 'common/p_blatt_herbst']), { anchor: 0.5, parent: huelle });
    const mass = rand(180, 215) / s0;
    s.scale.set(mass / Math.max(s.texture.width, s.texture.height));
    if (Math.random() < 0.5) s.scale.x *= -1;
    s.eventMode = 'none';
    w.f.innen.addChild(huelle);
    w.flecken.push({ art: 'blatt', huelle, sprite: s, rest: 1, fertig: false, x: o.x, y: o.y, r: mass * s0 * 0.5, wx: 0, wy: 0 });
  }

  baueSchaum(w) {
    const pts = ohneGesicht(w.plan, flaechenPunkte(w.plan), GESICHT_SCHAUM);
    const orte = streue(pts, 115, 18);
    for (const o of orte) {
      const id = 'waschanlage/' + pick(['schaum_a', 'schaum_b', 'schaum_b']);
      const s = spr(id, { x: o.x, y: o.y, parent: w.f.innen, z: 8 });
      const basis = rand(250, 310) / w.plan.scale / Math.max(s.texture.width, s.texture.height);
      s.scale.set(basis * 0.35);
      s.rotation = rand(-0.25, 0.25);
      s.alpha = 0;
      s.visible = false;
      s.eventMode = 'none';
      w.schaum.push({ s, basis, wert: 0, anzeige: 0, erreicht: false, x: o.x, y: o.y, wx: 0, wy: 0 });
    }
  }

  // Wassertropfen nach dem Abspülen (zum Trockenreiben)
  baueTropfen(w) {
    const pts = ohneGesicht(w.plan, flaechenPunkte(w.plan), GESICHT_SCHAUM);
    const orte = streue(pts, 150, 8);
    const imWelt = (x, y) => this.welt.toLocal(w.f.innen.toGlobal({ x, y }));
    orte.forEach((o, i) => {
      const s = spr('common/p_tropfen', { anchor: 0.5, x: o.x, y: o.y, parent: w.f.innen, z: 9 });
      const ziel = 112 / w.plan.scale / Math.max(s.texture.width, s.texture.height);
      s.scale.set(ziel * 0.3);
      s.alpha = 0;
      s.rotation = rand(-0.15, 0.15);
      s.eventMode = 'none';
      this.after(0.1 + i * 0.12, () => {
        if (s.destroyed) return;
        this.tween(s, { alpha: 0.95 }, 0.4, { ease: 'sineInOut' });
        this.tween(s, { scale: ziel }, 0.5, { ease: 'backOut' });
      });
      const p = imWelt(o.x, o.y);
      w.tropfen.push({ s, ziel, fertig: false, wx: p.x, wy: p.y });
    });
  }

  // Tippfläche über dem ganzen Körper (unter dem Schmutz): Antippen = ein Tupfer, sonst grüßt das Fahrzeug
  baueWaschflaeche(w) {
    const m = meta(w.plan.koerper);
    const pad = 30;
    const z = new Container({ label: 'waschflaeche' });
    z.zIndex = 1;
    w.f.innen.addChild(z);
    tap(z, (e) => this.fahrzeugGetippt(w, e), {
      sound: null, squash: false,
      hitArea: new Rectangle(-m.ax * m.w - pad, -m.ay * m.h - pad, m.w + 2 * pad, m.h + 2 * pad),
    });
  }

  // Orte in Seiten-Koordinaten ausrechnen (das Fahrzeug steht beim Waschen still)
  miss(w) {
    const imWelt = (x, y) => this.welt.toLocal(w.f.innen.toGlobal({ x, y }));
    for (const f of w.flecken) { const p = imWelt(f.x, f.y); f.wx = p.x; f.wy = p.y; }
    for (const b of w.schaum) { const p = imWelt(b.x, b.y); b.wx = p.x; b.wy = p.y; }
    const m = meta(w.plan.koerper);
    const a = imWelt(-m.ax * m.w, -m.ay * m.h);
    const c = imWelt((1 - m.ax) * m.w, (1 - m.ay) * m.h);
    w.box = { x0: a.x - 25, y0: a.y - 25, x1: c.x + 25, y1: c.y + 25 };
    w.oben = a.y + (c.y - a.y) * 0.12;
  }

  // ---------------------------------------------------------------- Reiben

  fahrzeugGetippt(w, e) {
    const p = this.welt.toLocal(w.f.innen.toGlobal({ x: e.x, y: e.y }));
    if (w.zustand !== 'waschen') {
      this.gruss(w);
      return;
    }
    if (w.schritt === 5) {
      // Antippen am platten Reifen pumpt auch ein bisschen; sonst kichert das Fahrzeug und die Pumpe wippt
      const r = this.radMitte(w);
      if (r && Math.hypot(p.x - r.x, p.y - r.y) < 190) this.pumpen('rad');
      else if (this.tor('leer', 0.6)) {
        sfx('common/tipp', { vol: 0.5 });
        w.f.wackel(0.02);
        fx.wobble(this.pumpe, 0.06);
      }
      return;
    }
    if (w.schritt >= 6) {
      this.gruss(w);
      if (!w.deko.gewaehlt) for (const pl of this.brett.plaetze) fx.pulse(pl.c);
      return;
    }
    this.finger.set(e.pointerId, { x: p.x, y: p.y, t: this.t, weg: false });
    this.reibe(p.x, p.y, 0, true, e.pointerId);
  }

  fingerZieht(id, p) {
    if (!this.aktiv) return;
    const w = this.w;
    if (!w || w.zustand !== 'waschen') return;
    const alt = this.finger.get(id);
    if (!alt || alt.weg) {
      this.finger.set(id, { x: p.x, y: p.y, t: this.t, weg: false });
      return;
    }
    alt.t = this.t;
    const d = Math.hypot(p.x - alt.x, p.y - alt.y);
    if (d > 280) {             // Sprung (neuer Finger mit alter Nummer): neu ansetzen
      alt.x = p.x;
      alt.y = p.y;
      return;
    }
    if (d < 3) return;
    // in Stücken über die Strecke, damit schnelles Wischen keine Lücken lässt
    const n = Math.max(1, Math.ceil(d / 60));
    for (let i = 1; i <= n; i++) {
      const x = alt.x + ((p.x - alt.x) * i) / n;
      const y = alt.y + ((p.y - alt.y) * i) / n;
      if (this.aufFahrzeug(w, x, y)) this.reibe(x, y, d / n, false, id);
    }
    alt.x = p.x;
    alt.y = p.y;
  }

  aufFahrzeug(w, x, y) {
    const b = w.box;
    return !!b && x >= b.x0 && x <= b.x1 && y >= b.y0 && y <= b.y1;
  }

  // Reiben tut, was gerade dran ist
  reibe(x, y, laenge, tupf, id) {
    const w = this.w;
    if (!w || w.zustand !== 'waschen') return;
    if (w.schritt === 1) {
      w.gewischt = true;   // Finger auf dem schmutzigen Fahrzeug: kein Hinweis mehr auf den Schmutz
      this.reibeMatsch(w, x, y, laenge, tupf);
    } else if (w.schritt === 2) {
      this.reibeSchaum(w, x, y, laenge, tupf);
    } else if (w.schritt === 4) {
      this.reibeTropfen(w, x, y, tupf);
    } else if (w.schritt !== 3) {
      // Pumpen und Aufkleber haben eigene Dinge zum Antippen
    } else if (this.werkzeugFinger.has(id) || w.alteFinger?.has(id) || this.t < w.spuelAb) {
      // Gerade erst eingeschäumt, oder ein Werkzeug in der Hand, oder derselbe Finger reibt einfach weiter:
      // noch kein Wasser – nur ein Schaum-Tupfer. So bleibt der volle Schaum stehen, bis das Kind zur Brause
      // greift oder frisch mit dem Finger übers Fahrzeug fährt.
      this.reibeSchaum(w, x, y, laenge * 0.4, tupf, true);
    } else {
      this.wasser.ziel.x = x;
      this.wasser.ziel.y = y;
      this.wasser.finger = tupf ? 0.8 : 0.45;
      // Die Brause zielt zum Finger – dort spült es gleich mit (sonst müsste das Kind lange an einer Stelle warten)
      if (this.wasser.staerke > 0.3) {
        const weg = laenge * 0.001 + (tupf ? 0.1 : 0);
        for (const b of w.schaum) {
          if (b.wert > 0 && Math.hypot(x - b.wx, y - b.wy) < 180) b.wert = Math.max(0, b.wert - weg);
        }
      }
    }
  }

  reibeMatsch(w, x, y, laenge, tupf) {
    let getroffen = false;
    for (const f of w.flecken) {
      if (f.fertig) continue;
      if (Math.hypot(x - f.wx, y - f.wy) > f.r + (f.art === 'blatt' ? 60 : 80)) continue;
      getroffen = true;
      if (f.art === 'blatt') {
        this.fleckWeg(f);
        continue;
      }
      // ein Tupfer (Antippen) nimmt ein Fünftel: nach 4 Tipps ist der Fleck weg
      f.rest -= laenge * 0.0017 + (tupf ? 0.2 : 0);
      if (f.rest <= 0.3) this.fleckWeg(f);
    }
    if (getroffen) {
      if (this.tor('wisch', 0.35)) sfx('common/wisch', { vol: 0.5 });
      if (this.tor('krumen', 0.3)) this.burst('staub', x, y, { count: 1 });
    } else if (tupf && this.tor('leer', 0.6)) {
      // saubere Stelle angetippt: Das Fahrzeug wackelt kichernd, und der nächste Fleck wippt („hier!")
      sfx('common/tipp', { vol: 0.5 });
      w.f.wackel(0.025);
      let naechster = null;
      let best = Infinity;
      for (const f of w.flecken) {
        if (f.fertig) continue;
        const d = Math.hypot(x - f.wx, y - f.wy);
        if (d < best) { best = d; naechster = f; }
      }
      if (naechster) fx.wobble(naechster.huelle, 0.14);
    }
  }

  fleckWeg(f) {
    if (f.fertig) return;
    f.fertig = true;
    const w = this.w;
    if (f.art === 'blatt') {
      // fällt sanft schaukelnd herunter und verblasst
      const h = f.huelle;
      const seite = Math.random() < 0.5 ? -1 : 1;
      this.tween(h, { y: h.y + 300, x: h.x + seite * rand(50, 110) }, 1.6, { ease: 'sineIn' });
      this.tween(h, { rotation: h.rotation + seite * rand(1.0, 1.8) }, 1.6, { ease: 'sineInOut' });
      this.tween(h, { alpha: 0 }, 1.6, { ease: 'quadIn' }).then(() => { if (!h.destroyed) h.visible = false; });
      if (this.tor('blattTon', 0.3)) sfx('common/rascheln', { vol: 0.35 });
    } else {
      this.tween(f.huelle, { alpha: 0 }, 0.6, { ease: 'sineInOut' }).then(() => {
        if (!f.huelle.destroyed) f.huelle.visible = false;
      });
      if (f.wx && this.tor('fleckFunkeln', 0.3)) {
        this.burst('funkeln', f.wx, f.wy, { count: 3 });
        sfx('common/funkeln', { vol: 0.3 });
      }
    }
    if (w && w.fund && w.fund.fleck === f && !w.fund.gezeigt) {
      w.fund.gezeigt = true;
      // Die Überraschung kommt erst heraus, wenn das Fahrzeug steht (beim Hereinrollen gewischt: nach der Ankunft);
      // fährt es schon wieder, bleibt sie versteckt.
      if (w.zustand === 'waschen') this.after(0.45, () => this.zeigeFund(w, f));
      else if (w.zustand === 'kommt') w.fund.wartet = true;
    }
    this.pruefe();
  }

  // klein = nur ein Tupfer (Schritt 3, bevor gespült wird): wenig Schaum dazu, kein Fortschritt
  reibeSchaum(w, x, y, laenge, tupf, klein = false) {
    let neu = false;
    let getroffen = false;
    for (const b of w.schaum) {
      const d = Math.hypot(x - b.wx, y - b.wy);
      if (d > (klein ? 150 : 200)) continue;
      getroffen = true;
      const k = 1 - d / 280;
      b.wert = Math.min(1, b.wert + (laenge * 0.0035 + (tupf ? (klein ? 0.15 : 0.32) : 0)) * k);
      if (klein) continue;
      if (!b.erreicht && b.wert >= 0.7) {
        b.erreicht = true;
        neu = true;
      }
    }
    if (getroffen) {
      if (this.tor('schrubben', 0.6)) sfx('common/schrubben', { vol: 0.55 });
      if (this.tor('blase', 0.5)) this.burst('blasen', x, y - 30, { count: 1 });
    }
    if (neu) this.pruefe();
  }

  reibeTropfen(w, x, y, tupf) {
    let weg = 0;
    for (const t of w.tropfen) {
      if (t.fertig) continue;
      if (Math.hypot(x - t.wx, y - t.wy) > (tupf ? 140 : 115)) continue;
      t.fertig = true;
      weg++;
      this.tween(t.s, { alpha: 0, scale: t.ziel * 0.5 }, 0.35, { ease: 'sineInOut' })
        .then(() => { if (!t.s.destroyed) t.s.visible = false; });
    }
    if (weg) {
      if (this.tor('trocken', 0.3)) sfx(tupf ? 'common/plopp' : 'common/wisch', { vol: 0.4, rate: 1.15 });
      if (this.tor('trockenFunkeln', 0.4)) this.burst('funkeln', x, y, { count: 1 });
      this.pruefe();
    } else if (tupf && this.tor('leer', 0.6)) {
      sfx('common/tipp', { vol: 0.5 });
      w.f.wackel(0.02);
      const t = w.tropfen.find((q) => !q.fertig);
      if (t) fx.pulse(t.s);
    }
  }

  // ---------------------------------------------------------------- Ablauf der Schritte

  pruefe() {
    const w = this.w;
    if (!w || w.zustand !== 'waschen') return;
    if (w.schritt === 1 && w.flecken.every((f) => f.fertig)) {
      this.zuSchritt(w, 2);
    } else if (w.schritt === 2) {
      const n = w.schaum.filter((b) => b.erreicht).length;
      if (n >= Math.ceil(w.schaum.length * 0.85)) {
        // die letzten Stellen schäumen von selbst nach
        for (const b of w.schaum) {
          if (!b.erreicht) { b.erreicht = true; b.wert = 1; }
        }
        this.zuSchritt(w, 3);
      }
    } else if (w.schritt === 3 && w.schaum.every((b) => b.wert <= 0.04)) {
      this.gespuelt(w);
    } else if (w.schritt === 4 && !w.trocken && w.tropfen.length && w.tropfen.every((t) => t.fertig)) {
      this.getrocknet(w);
    }
  }

  zuSchritt(w, n) {
    if (w.schritt >= n) return;
    w.schritt = n;
    if (n === 3) {
      // Der volle Schaum bleibt erst einmal stehen: Reiben spült erst nach einer kleinen Pause und nur mit einem
      // frisch aufgesetzten Finger (die Finger, die gerade noch einschäumen, schäumen weiter).
      w.spuelAb = this.t + SPUEL_PAUSE;
      w.alteFinger = new Set(this.unten);
    } else if (n === 4) {
      this.baueTropfen(w);
    } else if (n === 5) {
      this.reifenPlatt(w);
    } else if (n === 6) {
      this.brett.belege(w.deko.ids);
    }
    const noch = () => this.aktiv && this.w === w && w.zustand === 'waschen' && w.schritt === n;
    this.after(0.3, () => {
      if (this.w !== w || w.zustand !== 'waschen') return;
      if (n !== 5) this.ente.nod();
      if (n !== 5) sfx('common/plopp', { vol: 0.5 });
      if (n === 2) {
        this.burst('funkeln', (w.box.x0 + w.box.x1) / 2, (w.box.y0 + w.box.y1) / 2, { count: 4 });
        // nicht mehr, wenn schon kräftig eingeschäumt wird (oder das Fahrzeug weg ist)
        voice('waschanlage_schaum', { nurWenn: () => noch() && !w.schaum.some((b) => b.erreicht) });
      } else if (n === 3) {
        // das eingeschäumte Fahrzeug freut sich kurz über den Schaum, ein paar große Seifenblasen steigen auf
        w.f.wackel(0.02);
        this.burst('blasen', (w.box.x0 + w.box.x1) / 2, w.oben + 40, { count: 3 });
        this.after(1.2, () => { if (noch()) this.starteBlasen(w); });
        // nicht mehr, wenn das Kind die Brause schon laufen lässt (oder das Fahrzeug weg ist)
        voice('waschanlage_spuelen', { nurWenn: () => noch() && !this.wasser.halten && this.wasser.staerke < 0.3 });
      } else if (n === 4) {
        voice('waschanlage_trocknen', { nurWenn: () => noch() && w.tropfen.every((t) => !t.fertig) });
      } else if (n === 5) {
        voice('waschanlage_pumpen', { nurWenn: () => noch() && w.platt.luft <= 0.01 });
      } else if (n === 6) {
        const k = w.kunde.actor;
        this.after(0.5, () => { if (noch() && !k.destroyed) k.bubble(w.deko.wunsch, 3); });
        voice('waschanlage_schmuck', { nurWenn: () => noch() && !w.deko.gewaehlt });
      }
    });
  }

  // Schaum ist weg: Wasser aus, dann Tropfen zum Trockenreiben
  gespuelt(w) {
    if (w.schritt !== 3) return;
    w.schritt = 3.5;   // Pause zwischen den Schritten
    for (const b of w.schaum) b.wert = 0;
    const ws = this.wasser;
    ws.halten = false;
    ws.nach = 0;
    ws.finger = 0;
    sfx('common/funkeln', { vol: 0.35 });
    this.after(0.9, () => {
      if (this.w !== w || w.zustand !== 'waschen') return;
      this.zuSchritt(w, 4);
    });
  }

  // Alle Tropfen weg: Der Moment „blitzblank" – Glanz, Stimme, Hupen; dann Reifen oder Aufkleber
  getrocknet(w) {
    w.trocken = true;
    sfx('common/funkeln', { vol: 0.45 });
    this.glanz(w);
    voice('waschanlage_sauber');
    this.after(0.9, () => { if (this.w === w && !w.f.destroyed) this.gruss(w); });
    this.after(2.2, () => {
      if (this.w !== w || w.zustand !== 'waschen') return;
      this.zuSchritt(w, w.platt ? 5 : 6);
    });
  }

  // ---------------------------------------------------------------- Reifen

  hinteresRad(w) {
    let r = null;
    for (const q of w.f.raeder) if (!r || q.sprite.x < r.sprite.x) r = q;
    return r;
  }

  radMitte(w) {
    const r = w.platt?.rad;
    if (!r || r.sprite.destroyed) return null;
    return this.welt.toLocal(r.sprite.toGlobal({ x: 0, y: 0 }));
  }

  // Ein Reifen verliert Luft (leises Zischen), das Fahrzeug neigt sich, die Pumpe kommt mit Schlauch
  reifenPlatt(w) {
    const p = w.platt;
    const r = this.hinteresRad(w);
    if (!r) { this.after(0.2, () => this.zuSchritt(w, 6)); return; }
    p.rad = r;
    p.sy = r.sprite.scale.y;
    p.y0 = r.sprite.y;
    p.luft = 0;
    // Speichen weich in eine ruhige Lage drehen, damit der Reifen gerade gestaucht wird
    const ziel = Math.round(r.sprite.rotation / Math.PI) * Math.PI;
    this.tween(r.sprite, { rotation: ziel }, 0.9, { ease: 'sineInOut' }).then(() => w.f.rolle?.(1e-6));
    sfx('common/zisch', { vol: 0.3, rate: 0.8 });
    this.after(1.1, () => {
      if (this.w !== w || w.zustand !== 'waschen') return;
      this.legeSchlauch(w);
    });
  }

  legeSchlauch(w) {
    const m = this.radMitte(w);
    if (m) this.pumpe.legeSchlauch(m);
    w.platt.schlauchBei = w.platt.anzeige;
  }

  // Ein Pumpstoß (von der Pumpe oder vom Antippen des Reifens)
  pumpen(quelle) {
    const w = this.w;
    if (!w || w.zustand !== 'waschen' || w.schritt !== 5 || !w.platt || w.platt.luft >= 1) {
      if (quelle === 'pumpe') this.pumpe.pumpe();
      return;
    }
    if (!this.tor('pumpstoss', 0.3)) return;
    const p = w.platt;
    this.pumpe.pumpe();
    p.luft = Math.min(1, p.luft + (quelle === 'pumpe' ? 0.25 : 0.17));
    sfx('common/ballon', { vol: 0.45, rate: 0.85 + p.luft * 0.3 });
    if (p.luft >= 1) {
      this.after(0.5, () => {
        if (this.w !== w || w.zustand !== 'waschen' || w.schritt !== 5) return;
        fx.pop(p.rad.sprite, 0.08);
        const m = this.radMitte(w);
        if (m) this.burst('funkeln', m.x, m.y, { count: 4 });
        sfx('common/plopp', { vol: 0.5 });
        w.f.hupf(20);
        this.after(1.2, () => { if (this.w === w && w.zustand === 'waschen') this.zuSchritt(w, 6); });
      });
    }
  }

  // jedes Bild: Reifen zeigt seine Luft (weich), das Fahrzeug neigt sich passend
  zeigeReifen(w, dt) {
    const p = w.platt;
    if (!p || !p.rad || p.rad.sprite.destroyed) return;
    const vorher = p.anzeige;
    p.anzeige += (p.luft - p.anzeige) * (1 - Math.exp(-dt * (p.luft > p.anzeige ? 5 : 1.6)));
    if (Math.abs(p.luft - p.anzeige) < 0.002) p.anzeige = p.luft;
    if (p.anzeige === vorher && p.anzeige === 1) return;
    const flach = 1 - (1 - PLATT) * (1 - p.anzeige);
    p.rad.sprite.scale.y = p.sy * flach;
    p.rad.sprite.y = p.y0 + p.rad.r * (1 - flach);
    w.kipp = KIPP * (1 - p.anzeige);
    // Schlauch folgt der Radmitte (nur bei merklicher Änderung neu zeichnen)
    if (w.schritt === 5 && p.schlauchBei !== undefined && Math.abs(p.anzeige - p.schlauchBei) > 0.06) this.legeSchlauch(w);
  }

  // ---------------------------------------------------------------- Aufkleber und Abschied

  dekoGewaehlt(platz) {
    const w = this.w;
    if (!w || w.zustand !== 'waschen' || w.schritt !== 6 || w.deko.gewaehlt || !platz.id) return;
    w.deko.gewaehlt = platz.id;
    sfx('common/plopp', { vol: 0.6 });
    platz.bild.visible = false;
    // Aufkleber fliegt im Bogen aufs Fahrzeug
    const start = { x: this.brett.x + platz.c.x, y: this.brett.y + platz.c.y };
    const frei = ohneGesicht(w.plan, flaechenPunkte(w.plan), 200);
    const mitte = frei.filter((q) => Math.abs(q.x) < 260);
    const ziel = pick(mitte.length ? mitte : frei);
    const zielWelt = this.welt.toLocal(w.f.innen.toGlobal(ziel));
    const s = spr(platz.id, { anchor: 0.5, x: start.x, y: start.y, parent: this.welt, z: 75 });
    const groesse = 160 / Math.max(s.texture.width, s.texture.height);
    s.scale.set(132 / Math.max(s.texture.width, s.texture.height));
    s.eventMode = 'none';
    const proxy = { p: 0 };
    // Dauer aus dem Weg (nicht gedeckelt): an der schnellsten Stelle höchstens ~1100 Einheiten/s
    const dauer = Math.max(1.1, Math.hypot(zielWelt.x - start.x, zielWelt.y - start.y) / 600);
    const s0 = s.scale.x;
    this.tween(proxy, { p: 1 }, dauer, {
      ease: 'sineInOut',
      onUpdate: () => {
        if (s.destroyed) return;
        const q = proxy.p;
        s.x = lerp(start.x, zielWelt.x, q);
        s.y = lerp(start.y, zielWelt.y, q) - Math.sin(q * Math.PI) * 180;
        s.scale.set(lerp(s0, groesse, q));
        s.rotation = Math.sin(q * Math.PI) * 0.3;
      },
    }).then((ok) => {
      if (!ok || s.destroyed) return;
      // ab jetzt fährt der Aufkleber mit
      if (w.f.destroyed) { s.destroy(); return; }
      s.position.set(ziel.x, ziel.y);
      s.scale.set(groesse / w.plan.scale);
      s.rotation = rand(-0.2, 0.2);
      s.zIndex = 12;
      w.f.innen.addChild(s);
      w.deko.sprite = s;
      fx.pop(s, 0.12);
      sfx('common/klack', { vol: 0.45 });
      this.burst('funkeln', zielWelt.x, zielWelt.y, { count: 4 });
      this.abschied(w, platz.id === w.deko.wunsch);
    });
  }

  // Gestaffelt, damit sich nie mehr als zwei Dinge zugleich auffällig bewegen und kein Ton auf dem anderen liegt:
  // Tier freut sich → hüpft aufs Dach → Fahrzeug hupt → Ente klatscht → Wimpel → Sticker → hinausrollen
  abschied(w, wunsch) {
    w.zustand = 'fertig';
    this.runden++;
    const k = w.kunde;
    const lebt = () => this.w === w && !w.f.destroyed && !k.actor.destroyed;
    this.after(0.5, () => {
      if (!lebt()) return;
      k.actor.cheer({ parent: this.vorn });
      if (wunsch) this.burst('herzen', k.actor.x, k.actor.y - k.info.h - 20, { count: 2 });
    });
    this.after(1.7, () => { if (lebt()) this.kundeAufsDach(w, 1.15); });
    this.after(2.9, () => {
      if (!lebt()) return;
      this.gruss(w);
      voice('waschanlage_tschuess');
    });
    this.after(3.6, () => this.enteKlatscht());
    this.after(4.4, () => this.wimpelFliegt(w));
    this.after(6.4, () => this.belohnung(w));
    this.after(7.8, () => this.losfahren(w));
  }

  // Ein kleines Abbild des Aufklebers fliegt zur Wimpelkette, dort kommt ein neuer Wimpel dazu
  wimpelFliegt(w) {
    if (this.w !== w || !w.deko.gewaehlt || !this.aktiv) return;
    const bild = w.deko.gewaehlt;
    const i = this.kette.naechsterPlatz();
    const ziel = this.kette.platzMitte(i);
    const d = w.deko.sprite;
    const start = d && !d.destroyed ? this.welt.toLocal(d.toGlobal({ x: 0, y: 0 })) : { x: 0, y: 900 };
    const s = spr(bild, { anchor: 0.5, x: start.x, y: start.y, parent: this.welt, z: 75 });
    const a = 120 / Math.max(s.texture.width, s.texture.height);
    const b = 58 / Math.max(s.texture.width, s.texture.height);
    s.scale.set(a);
    s.alpha = 0.9;
    s.eventMode = 'none';
    const proxy = { p: 0 };
    // Dauer aus dem Weg (nicht gedeckelt): an der schnellsten Stelle höchstens ~1100 Einheiten/s
    const dauer = Math.max(1.1, Math.hypot(ziel.x - start.x, ziel.y - start.y) / 600);
    this.tween(proxy, { p: 1 }, dauer, {
      ease: 'sineInOut',
      onUpdate: () => {
        if (s.destroyed) return;
        const q = proxy.p;
        s.x = lerp(start.x, ziel.x, q);
        s.y = lerp(start.y, ziel.y, q) - Math.sin(q * Math.PI) * 120;
        s.scale.set(lerp(a, b, q));
      },
    }).then(() => {
      if (!s.destroyed) s.destroy();
      const voll = this.kette.dazu(bild);
      sfx('common/plopp', { vol: 0.45 });
      if (voll) {
        // die ganze Kette ist voll: alle Wimpel wippen, ein bisschen Konfetti, die Ente freut sich
        this.after(0.6, () => {
          this.kette.freuen();
          this.burst('konfetti', 0, 330, { count: 12 });
          sfx('common/funkeln', { vol: 0.45 });
        });
      }
    });
  }

  // Die Waschmeisterin klatscht: freut sich, hüpft, leiser Applaus, drei Herzen (mit der Seite verbunden)
  enteKlatscht() {
    const e = this.ente;
    if (!this.aktiv || e.destroyed) return;
    e.pose('happy');
    e.hop(60).then(() => this.after(0.6, () => { if (!e.destroyed && e.poseName === 'happy') e.pose('idle'); }));
    sfx('common/applaus', { vol: 0.4 });
    const k = e.point('kopf');
    this.burst('herzen', k.x, k.y + 30, { count: 3 });
  }

  // 3–4 weiche Glanzsterne auf dem Fahrzeug, nacheinander ein- und ausblendend
  glanz(w) {
    const orte = streue(flaechenPunkte(w.plan), 200, 4);
    orte.forEach((o, i) => {
      const s = spr('waschanlage/glanzstern', { x: o.x, y: o.y, parent: w.f.innen, z: 20 });
      const ziel = rand(0.45, 0.6) / w.plan.scale;
      s.scale.set(ziel * 0.3);
      s.alpha = 0;
      s.eventMode = 'none';
      this.after(0.2 + i * 0.45, () => {
        if (s.destroyed) return;
        this.tween(s, { alpha: 1, scale: ziel }, 0.7, { ease: 'sineInOut' });
        this.tween(s, { rotation: 0.5 }, 2.2, { ease: 'sineInOut' });
        this.after(1.1, () => {
          if (!s.destroyed) this.tween(s, { alpha: 0, scale: ziel * 0.6 }, 0.8, { ease: 'sineInOut' });
        });
      });
    });
  }

  // Ein Sticker je geschaffter Runde, solange es noch neue gibt; danach nur ab und zu ein leiser Gruß
  belohnung(w) {
    if (this.w !== w || w.f.destroyed) return;
    // nur die Sticker des Waschplatzes (Zapfsäule und Kakao gibt es auf der Tankstellen-Seite)
    const ids = stickerFuerOrt('waschanlage', { nurVorhandene: true }).map((s) => s.id)
      .filter((id) => id === 'waschanlage_schwamm' || id === 'waschanlage_buerste');
    if (!ids.length) return;
    const schon = new Set(gesammelt());
    const neu = ids.find((id) => !schon.has(id));
    if (!neu && this.runden % 3 !== 0) return;
    // rechts neben dem Fahrzeug über der Walze – dort ist frei (nicht auf der Brause, nicht im Wasser),
    // und der Stern hat es nicht weit bis zum Album-Knopf oben rechts
    belohne(this, neu || pick(ids), clamp(w.box.x1 + 160, 560, 700), 600);
  }

  // ---------------------------------------------------------------- Überraschungen

  // Unter einem Fleck war etwas versteckt
  zeigeFund(w, f) {
    if (this.w !== w || w.zustand !== 'waschen' || !this.aktiv) return;
    const p = f.wx ? { x: f.wx, y: f.wy } : this.welt.toLocal(w.f.innen.toGlobal({ x: f.x, y: f.y }));
    const art = w.fund.art;
    voice('waschanlage_fund');
    const boden = this.P.fz.y + 85;
    const weg = p.x < 0 ? -1 : 1;   // zur näheren Seite hinaus
    if (art === 'frosch') {
      const a = new Actor('frosch', { x: p.x, y: p.y + 70, scale: 0.05, parent: this.welt, z: 34 });
      a.onTap(() => a.cheer({ parent: this.vorn }));
      this.tween(a, { scale: 0.21 }, 0.45, { ease: 'backOut' });
      this.after(1.1, async () => {
        if (a.destroyed) return;
        a.sound();
        await a.hopTo(p.x + weg * 120, boden, { hoehe: 110, dauer: 0.8 });
        await this.wait(0.7);
        // hüpft zur näheren Seite hinaus (wird ein Sprung unterbrochen, geht es mit dem nächsten weiter)
        for (let i = 0; i < 10 && !a.destroyed; i++) {
          await a.hopTo(a.x + weg * 260, boden, { hoehe: 70, dauer: 0.6 });
          if (Math.abs(a.x) > 1450) break;
          await this.wait(0.15);
        }
        if (!a.destroyed) a.destroy({ children: true });
      });
      return;
    }
    const bild = { wurm: 'common/futter_wurm', ball: 'zug/ladung_ball', teddy: 'zug/ladung_teddy' }[art];
    const s = spr(bild, { anchor: 0.5, x: p.x, y: p.y, parent: this.welt, z: 34 });
    const ziel = (art === 'teddy' ? 175 : 165) / Math.max(s.texture.width, s.texture.height);
    s.scale.set(ziel * 0.2);
    tap(s, () => {
      fx.wobble(s, 0.12);
      if (this.tor('fundTon', 0.4)) sfx('common/hupf', { vol: 0.4 });
    }, { sound: null, squash: false, hitArea: new Circle(0, 0, 115 / ziel) });
    this.tween(s, { scale: ziel }, 0.45, { ease: 'backOut' });
    sfx('common/plopp', { vol: 0.5 });
    const weg2 = () => {
      if (s.destroyed) return;
      s.eventMode = 'none';
      this.tween(s, { alpha: 0 }, 0.6, { ease: 'sineInOut' }).then(() => { if (!s.destroyed) s.destroy(); });
    };
    // Hinunter auf den Boden: weich sinken (höchstens ~800 Einheiten/s), dann ein einziger kleiner Nachfederer
    const sinke = (zielY) => {
      const dauer = Math.max(1.0, Math.abs(zielY - s.y) / 500);
      this.tween(s, { y: zielY }, dauer, { ease: 'sineInOut' }).then((ok) => {
        if (!ok || s.destroyed) return;
        this.tween(s, { y: zielY - 22 }, 0.22, { ease: 'quadOut' })
          .then((ok2) => { if (ok2 && !s.destroyed) this.tween(s, { y: zielY }, 0.26, { ease: 'quadIn' }); });
      });
      return dauer + 0.5;
    };
    if (art === 'wurm') {
      this.tween(s, { rotation: 0.18 }, 0.35, { ease: 'sineInOut', yoyo: true, repeat: 3, delay: 0.5 });
      this.after(2.4, () => {
        if (s.destroyed) return;
        s.rotation = 0;
        const unten = sinke(boden - 40);
        this.after(unten + 0.4, () => {
          if (s.destroyed) return;
          this.tween(s, { x: s.x + weg * 260 }, 2.0, { ease: 'sineInOut' });
          this.after(1.4, weg2);
        });
      });
    } else if (art === 'ball') {
      this.after(0.9, () => {
        if (s.destroyed) return;
        const unten = sinke(boden - 60);
        this.after(unten + 0.2, () => {
          if (s.destroyed) return;
          const zx = weg * 1500;
          const dauer = Math.abs(zx - s.x) / 420;
          this.tween(s, { x: zx }, dauer, { ease: 'sineIn' });
          this.tween(s, { rotation: weg * (Math.abs(zx - s.x) / 80) }, dauer, { ease: 'sineIn' })
            .then(() => { if (!s.destroyed) s.destroy(); });
        });
      });
    } else {
      // Teddy: gehört dem Tier – fliegt im Bogen zu ihm, das Tier freut sich
      this.after(1.0, () => {
        const k = w.kunde.actor;
        if (s.destroyed) return;
        // Das Tier ist schon weg (ein anderes Fahrzeug wurde gewählt) oder fährt gerade auf dem Dach davon:
        // Der Teddy bleibt nicht liegen, er blendet weich aus.
        if (k.destroyed || this.w !== w || w.zustand !== 'waschen' || w.kunde.reitet) { weg2(); return; }
        const sx = s.x;
        const sy = s.y;
        const zx = k.x + 110;
        const zy = k.y - 70;
        const proxy = { p: 0 };
        // Dauer aus dem Weg: höchstens ~1100 Einheiten/s an der schnellsten Stelle
        const dauer = Math.max(1.1, Math.hypot(zx - sx, zy - sy) / 700);
        this.tween(proxy, { p: 1 }, dauer, {
          ease: 'sineInOut',
          onUpdate: () => {
            if (s.destroyed) return;
            s.x = lerp(sx, zx, proxy.p);
            s.y = lerp(sy, zy, proxy.p) - Math.sin(proxy.p * Math.PI) * 160;
          },
        }).then((ok) => {
          if (s.destroyed) return;
          if (!ok) { weg2(); return; }
          if (!k.destroyed) k.cheer({ parent: this.vorn });
          this.after(2.5, weg2);
        });
      });
    }
  }

  starteBlasen(w) {
    if (!w.box) return;
    this.blasen.forEach((b, i) => {
      if (b.aktiv) return;
      this.after(i * 0.9, () => {
        if (b.aktiv || !this.aktiv) return;
        b.aktiv = true;
        b.zeit = 0;
        b.platzt = false;
        b.s.position.set(rand(w.box.x0 + 140, w.box.x1 - 140), w.oben + 20);
        b.s.scale.set(b.basis * 0.6);
        b.s.alpha = 0;
        b.s.visible = true;
        b.s.eventMode = 'static';
        this.tween(b.s, { alpha: 0.95, scale: b.basis }, 0.6, { ease: 'sineInOut' });
      });
    });
  }

  blasePlatzt(b) {
    if (!b.aktiv || b.platzt) return;
    b.platzt = true;
    b.s.eventMode = 'none';
    if (this.tor('blasePlopp', 0.2)) sfx('common/ballon', { vol: 0.35, rate: 1.2 });
    this.burst('tropfen', b.s.x, b.s.y, { count: 2 });
    this.tween(b.s, { alpha: 0, scale: b.basis * 1.25 }, 0.25, { ease: 'sineOut' }).then(() => {
      b.aktiv = false;
      if (!b.s.destroyed) b.s.visible = false;
    });
  }

  blasenTakt(dt) {
    for (const b of this.blasen) {
      if (!b.aktiv || b.platzt) continue;
      b.zeit += dt;
      b.s.y -= 52 * dt;
      b.s.x += Math.sin(b.zeit * 1.4 + b.phase) * 22 * dt;
      if (b.s.y < 300 || b.zeit > 9) {
        b.platzt = true;
        b.s.eventMode = 'none';
        this.tween(b.s, { alpha: 0 }, 0.8, { ease: 'sineInOut' }).then(() => {
          b.aktiv = false;
          if (!b.s.destroyed) b.s.visible = false;
        });
      }
    }
  }

  // ---------------------------------------------------------------- Takt

  update(dt, t) {
    this.wolken.update(dt);
    this.vogel.update(dt);
    this.falter.update(dt);
    this.kette.update(dt);
    const w = this.w;
    if (w && !w.f.destroyed) {
      w.f.update(dt);
      this.zeigeReifen(w, dt);
      if (w.kipp) w.f.rumpf.rotation += w.kipp;
      this.zeigeSchmutz(w, dt);
      const k = w.kunde;
      if (k.reitet && !k.springt && !k.actor.destroyed) {
        k.actor.x = w.f.x + k.dx;
        k.actor.y += (k.y - k.actor.y) * (1 - Math.exp(-dt * 6));
      }
    }
    this.werkzeuge(t, dt);
    this.blasenTakt(dt);
    this.wasserTakt(dt, t);
    this.pfuetzeZiel = Math.max(0, this.pfuetzeZiel - dt * 0.04);
    this.pfuetze.alpha += (this.pfuetzeZiel - this.pfuetze.alpha) * (1 - Math.exp(-dt * 1.5));
    // Finger, die lange nichts gemeldet haben, vergessen
    for (const [id, f] of this.finger) if (t - f.t > 1.5) this.finger.delete(id);
  }

  zeigeSchmutz(w, dt) {
    const k = 1 - Math.exp(-dt * 6);
    for (const b of w.schaum) {
      b.anzeige += (b.wert - b.anzeige) * k;
      if (Math.abs(b.wert - b.anzeige) < 0.002) b.anzeige = b.wert;
      // Schaum wächst über die Größe, nicht über die Durchsichtigkeit (halb durchsichtiges Weiß auf Rot sähe
      // wie ein rosa Schleier aus): kleine Bläschen sind schon fast weiß
      b.s.visible = b.anzeige > 0.01;
      b.s.alpha = clamp(b.anzeige * 2.5, 0, 1);
      b.s.scale.set(b.basis * (0.35 + 0.65 * b.anzeige));
    }
    for (const f of w.flecken) {
      if (!f.fertig && f.art === 'wisch') f.huelle.alpha += (clamp(f.rest, 0, 1) - f.huelle.alpha) * k;
    }
  }

  // Werkzeugplatz: Je Schritt liegt dort das passende Werkzeug (weich ein- und ausgeblendet; was gerade in der
  // Hand ist, bleibt). Das Werkzeug des aktuellen Schritts wippt sanft; gezogene Werkzeuge neigen sich zum Schrubben.
  werkzeuge(t, dt) {
    const w = this.w;
    const schritt = w && w.zustand === 'waschen' ? w.schritt : 0;
    const k = 1 - Math.exp(-dt * 5);
    const wipp = Math.sin(t * 2.6) * 0.1;

    const b = this.buerste;
    const bZieht = this.buersteZug.isDragging();
    if (!b.destroyed) {
      const ziel = bZieht ? -0.4 : this.buersteHeim.rot + (schritt === 1 ? wipp : 0);
      b.rotation += (ziel - b.rotation) * k;
      // der Schatten bleibt nur, solange die Bürste (fast) daheim liegt
      const weg = Math.hypot(b.x - this.buersteHeim.x, b.y - this.buersteHeim.y);
      this.zeige(dt, b, this.buersteSchatten, schritt < 4, 0.28 * clamp(1 - weg / 120, 0, 1), bZieht);
    }
    const h = this.handtuch;
    const hZieht = this.handtuchZug.isDragging();
    if (!h.destroyed) {
      const ziel = hZieht ? 0.2 : schritt === 4 ? wipp * 0.8 : 0;
      h.rotation += (ziel - h.rotation) * k;
      const weg = Math.hypot(h.x - HANDTUCH_HEIM.x, h.y - HANDTUCH_HEIM.y);
      this.zeige(dt, h, this.handtuchSchatten, schritt === 4, 0.28 * clamp(1 - weg / 120, 0, 1), hZieht);
    }
    this.zeige(dt, this.pumpe, this.pumpeSchatten, schritt === 5, 0.28);
    if (!this.pumpe.schlauch.destroyed) {
      this.pumpe.schlauch.alpha = this.pumpe.alpha;
      this.pumpe.schlauch.visible = this.pumpe.visible;
    }
    this.zeige(dt, this.brett, this.brettSchatten, schritt === 6 && !w.deko.gewaehlt, 0.25);
    const s = this.schwamm;
    if (!s.destroyed) {
      const ziel = this.schwammZug.isDragging() ? 0.25 : schritt === 2 ? wipp : 0;
      s.rotation += (ziel - s.rotation) * k;
    }
  }

  // ein Ding am Werkzeugplatz weich ein-/ausblenden; greifbar nur, wenn es dran ist (oder gerade in der Hand liegt)
  zeige(dt, obj, schatten, soll, schattenAlpha, zieht = false) {
    if (obj.destroyed) return;
    const ziel = soll || zieht ? 1 : 0;
    obj.alpha += (ziel - obj.alpha) * (1 - Math.exp(-dt * 4));
    if (Math.abs(ziel - obj.alpha) < 0.01) obj.alpha = ziel;
    obj.visible = obj.alpha > 0.01;
    const greifbar = (soll && obj.alpha > 0.4) || zieht;
    obj.eventMode = greifbar ? 'static' : 'none';
    if (schatten) schatten.alpha = schattenAlpha * obj.alpha;
  }

  wasserTakt(dt, t) {
    const ws = this.wasser;
    ws.finger = Math.max(0, ws.finger - dt);
    ws.nach = Math.max(0, ws.nach - dt);
    const an = this.aktiv && (ws.halten || ws.finger > 0 || ws.nach > 0);
    ws.staerke = clamp(ws.staerke + (an ? dt * 2.4 : -dt * 2), 0, 1);
    this.wasserC.alpha = ws.staerke;
    this.wasserC.visible = ws.staerke > 0.01;
    this.strahl2.alpha = 0.45 + 0.15 * Math.sin(t * 4.2);
    this.strahl.scale.x = 0.9 * (1 + 0.025 * Math.sin(t * 3.1));
    if (an && !ws.tonAn) {
      ws.tonAn = true;
      this.wasserTon.an(0.3);
    } else if (!an && ws.tonAn) {
      ws.tonAn = false;
      this.wasserTon.aus(0.5);
    }

    // Richtung: zum Finger, sonst beim Halten langsam hin und her, sonst (Schritt 3) sanftes Wippen
    const P = this.P.dusche;
    const w = this.w;
    let ziel = 0;
    if (ws.finger > 0) {
      ziel = clamp(-Math.atan2(ws.ziel.x - P.x, ws.ziel.y - P.y), -0.62, 0.62);
    } else if (an) {
      ws.schwenk += dt;
      ziel = Math.sin((ws.schwenk / 3.4) * Math.PI * 2) * 0.52;
    } else if (w && w.zustand === 'waschen' && w.schritt === 3) {
      ziel = Math.sin(t * 2.6) * 0.08;
    }
    this.brause.rotation += (ziel - this.brause.rotation) * (1 - Math.exp(-dt * (ws.finger > 0 ? 5 : 3)));

    if (ws.staerke < 0.5) return;
    const r = this.brause.rotation;
    const dx = -Math.sin(r);
    const dy = Math.cos(r);
    const auf = !!(w && w.box && (w.zustand === 'waschen' || w.zustand === 'fertig'));
    // Tropfen dort, wo das Wasser auftrifft (Fahrzeug oder Boden)
    if (this.tor('tropfen', 0.2)) {
      const y = auf ? w.oben + rand(0, 80) : this.P.fz.y - rand(0, 30);
      const s = (y - P.y) / dy;
      this.burst('tropfen', P.x + dx * s + rand(-70, 70), y, { count: 2 });
    }
    if (!auf || w.zustand !== 'waschen') return;
    this.pfuetzeZiel = Math.min(0.4, this.pfuetzeZiel + dt * 0.25);
    // Wirkung: alles im Wasserfächer wird abgespült
    for (const b of w.schaum) {
      if (b.wert <= 0) continue;
      if (this.imStrahl(P, dx, dy, b.wx, b.wy)) b.wert = Math.max(0, b.wert - dt * 0.8);
    }
    for (const f of w.flecken) {
      if (f.fertig) continue;
      if (this.imStrahl(P, dx, dy, f.wx, f.wy)) {
        if (f.art === 'blatt') { this.fleckWeg(f); continue; }
        f.rest -= dt * 0.8;
        if (f.rest <= 0.3) this.fleckWeg(f);
      }
    }
    if (w.schritt === 3) this.pruefe();
  }

  imStrahl(P, dx, dy, x, y) {
    const vx = x - P.x;
    const vy = y - P.y;
    const entlang = vx * dx + vy * dy;
    if (entlang < DUESE) return false;
    return Math.abs(vx * dy - vy * dx) < 120 + (entlang - DUESE) * 0.24;
  }

  // ---------------------------------------------------------------- Hilfen

  /** true, wenn „name" seit mindestens sek nicht mehr dran war (Töne/Teilchen entprellen) */
  tor(name, sek) {
    const alt = this.tore.get(name) ?? -1e9;
    if (this.t - alt < sek) return false;
    this.tore.set(name, this.t);
    return true;
  }

  hinweise() {
    const w = this.w;
    const liste = [];
    if (w && w.zustand === 'waschen') {
      if (w.schritt === 1) {
        const f = w.flecken.find((x) => !x.fertig);
        if (f) liste.push(f.sprite);
        liste.push({ von: this.buerste, nach: w.f.koerper });
      } else if (w.schritt === 2) {
        liste.push({ von: this.schwamm, nach: w.f.koerper });
      } else if (w.schritt === 3) {
        liste.push(this.duschkopf);
      } else if (w.schritt === 4) {
        const t = w.tropfen.find((x) => !x.fertig);
        if (t && t.s.alpha > 0.5) liste.push(t.s);
        if (this.handtuch.alpha > 0.5) liste.push({ von: this.handtuch, nach: w.f.koerper });
      } else if (w.schritt === 5) {
        if (this.pumpe.alpha > 0.5) liste.push(this.pumpe.koerper);
      } else if (w.schritt === 6 && !w.deko.gewaehlt && this.brett.alpha > 0.5) {
        const p = this.brett.plaetze.find((q) => q.id === w.deko.wunsch) || this.brett.plaetze[0];
        liste.push(p.c);
      }
    } else if (!w) {
      liste.push(this.knoepfe[0]);
    }
    // rollt gerade etwas herein oder hinaus: nichts drängen, nur auf die Nebensachen zeigen
    liste.push(this.walzen[0], this.ente);
    return liste;
  }
}

export default class Waschanlage extends SeitenSzene {
  static id = 'waschanlage';
  static packs = ['waschanlage', 'zug', 'tiere'];
  // alle Tiere, deren Bilder dieser Ort zeigen kann (Ente, Frosch als Überraschung, die Kunden)
  static tiere = ['ente', 'frosch', 'kuh', 'schaf', 'schwein', 'pferd', 'hund', 'katze', 'hase', 'fuchs', 'igel',
    'baer', 'maus', 'pinguin', 'eichhoernchen', 'huhn'];
  static music = 'musik/bau';
  static seiten = [Waschplatz, Tankstelle];

  vorbereiten() {
    ui.albumKnopf(this);
  }

  // Tankstelle: Rollt gerade ein Fahrzeug herein oder hinaus (oder läuft ein Schritt von selbst), zeigt die Hand
  // nichts – auch nicht auf den Blätter-Pfeil, sonst schickte sie das Kind mitten im Abschied weg. Nach langer
  // Ruhe (30 s) zeigt sie wie überall den Pfeil.
  hints() {
    if (!this.gleitet && this.seite?.wartetGerade?.() && this.idle < 30) return [];
    return super.hints();
  }

  exit() {
    super.exit();
    for (const s of this.seiten || []) s?.aufraeumen?.();
  }
}
