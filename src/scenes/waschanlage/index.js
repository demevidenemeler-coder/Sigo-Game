// Ort „Waschanlage" – eine Bilderbuch-Seite.
//
// Fahrzeuge rollen schmutzig herein und werden in drei einfachen Schritten sauber:
//   1. Matsch wegwischen      – jeden Fleck mit dem Finger (wipe) oder mit der Bürste vom Boden
//   2. Einschäumen            – Schwamm aus dem Eimer nehmen (oder einfach mit dem Finger) über das Fahrzeug reiben:
//                               dort, wo gerieben wird, blendet weicher Schaum ein
//   3. Abspülen               – Brause antippen/halten (sie schwenkt langsam hin und her) oder mit dem Finger übers
//                               Fahrzeug fahren (die Brause zielt dorthin) → Wasserfäden und Tropfen, Schaum verschwindet
// Sauber → ruhiges Funkeln, das Fahrzeug hüpft und hupt/pfeift, die Ente (Waschmeisterin) freut sich und klatscht,
// gelegentlich ein Sticker; dann rollt es rechts hinaus und das nächste kommt.
//
// Reihenfolge ohne Zwang: Reiben auf dem Fahrzeug tut immer das, was gerade dran ist – egal ob mit Finger, Bürste
// oder Schwamm. Wasser spült zu jeder Zeit Matsch und Schaum weg. Das gerade passende Werkzeug wippt sanft.
// Drei Wahl-Knöpfe links (eigene Lok, Auto, Traktor) bestimmen, was als Nächstes kommt; ohne Wahl reihum.
// Nebensachen: zwei Bürstenwalzen (drehen sich beim Antippen), Vogel auf der Mauer, Schmetterling, Wolken,
// Abfluss blubbert, Eimer blubbert.

import {
  stage, spr, meta, sfx, voice, tap, drag, wipe, hold, Actor, fx, ui, rand, pick, shuffle, clamp, PIXI,
} from '../../engine/index.js';
import { Seite, SeitenSzene } from '../../gemeinsam/seiten.js';
import { belohne, gesammelt, stickerFuerOrt } from '../../gemeinsam/sticker.js';
import { TYPEN, plan, baueFahrzeug, flaechenPunkte, ohneGesicht, verteile, streue } from './fahrzeuge.js';
import { Schleife } from './schleife.js';
import { Wolken, Vogel, Falter } from './deko.js';

const { Container, Graphics, Rectangle, Circle, Sprite } = PIXI;

const START_ABSTAND = 2000;      // so weit links beginnt ein Fahrzeug (und so weit rechts verschwindet es)
const BRAUSE_SKALA = 0.85;
const DUESE = 330;               // Abstand Rohrende → Düse (Einheiten)
const WERKZEUG_BILD = { 1: 'common/buerste', 2: 'common/schwamm', 3: 'waschanlage/brause' };
const SPUEL_PAUSE = 2.5;         // so lange nach dem Einschäumen gibt Reiben noch kein Wasser (der Schaum bleibt stehen)
const GESICHT_MATSCH = 220;      // Abstand (Bildpunkte des Körpers) von Augen/Mund, unter dem kein Matsch landet
const GESICHT_SCHAUM = 165;      // dito für Schaum – das Fahrzeug lächelt aus dem Schaum heraus
// gemalte Sprühdüsen an der Wand (am Raster des Hintergrunds abgelesen, Seiten-Koordinaten). Die linke äußere
// (x≈-887) liegt hinter den Wahl-Knöpfen und bekommt keine eigene Fläche.
const DUESEN = [{ x: -717, y: 682 }, { x: -551, y: 682 }, { x: 567, y: 682 }, { x: 732, y: 682 }, { x: 897, y: 682 }];

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
    this.runden = 0;
    this.knopfGetippt = false;   // schon einmal einen Wahl-Knopf angetippt
    this.tore = new Map();       // Entprellen von Tönen/Teilchen: name → letzte Zeit
    this.finger = new Map();     // pointerId → {x, y, t} letzter Ort eines Fingers auf dem Fahrzeug
    this.unten = new Set();      // pointerIds, die gerade aufliegen
    this.werkzeugFinger = new Set();   // pointerIds, die gerade Schwamm oder Bürste ziehen
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
    this.baueBrause();
    this.baueKnoepfe();
    this.baueReiber();

    // Ab und zu zeigt die Ente, welches Werkzeug jetzt passt (nur, wenn gerade niemand spielt)
    this.every(13, () => {
      const w = this.w;
      if (!this.aktiv || !w || w.zustand !== 'waschen' || this.szene.idle < 5) return;
      this.enteDenkt(WERKZEUG_BILD[w.schritt]);
    });
  }

  // Denkblase der Ente – gespiegelt, also links vom Kopf: rechts davon wäre sie auf schmalen Bildschirmen
  // abgeschnitten (die Ente steht weit rechts). Actor.bubble kennt keine Seite, darum hier nachträglich.
  enteDenkt(bild) {
    this.ente.bubble(bild, 2.2);
    const b = this.ente._blase;
    if (!b || b.destroyed || b.children.length < 2) return;
    const [grund, inhalt] = b.children;
    const skala = 1 / Math.max(0.05, Math.abs(this.ente.scale.x));
    grund.scale.x = -Math.abs(grund.scale.x);
    inhalt.x = -inhalt.x;
    b.x -= 80 * skala;
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
    this.ente.onTap(() => this.ente.cheer());
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
  // Fahrzeug, auf der Bürste, auf dem Schwamm oder daneben angefangen hat. Der Kern schaltet Pixis globale
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

  kommen() {
    if (this.w || !this.szene.alive) return;
    const typ = this.naechsterTyp();
    const p = plan(typ);
    const f = baueFahrzeug(p, { x: this.P.fz.x - START_ABSTAND, y: this.P.fz.y, parent: this.welt, z: 30 });
    const w = { typ, plan: p, f, zustand: 'kommt', schritt: 0, flecken: [], schaum: [], box: null, oben: 1000 };
    this.w = w;
    this.markiereKnopf(typ);
    this.beschmutze(w);
    this.baueSchaum(w);
    this.baueWaschflaeche(w);
    this.fahrTonAn(w);
    f.fahreZu(this.P.fz.x, 3.4, { ease: 'sineInOut' }).then((ok) => {
      if (ok && this.w === w && w.zustand === 'kommt') this.angekommen(w);
    });
  }

  angekommen(w) {
    this.fahrTon?.aus(0.7);
    this.miss(w);
    w.zustand = 'waschen';
    w.schritt = 1;
    this.gruss(w);
    this.ente.nod();
    // „Wisch den Matsch weg" – nur, wenn das Kind noch nicht selbst wischt (auch nicht, wenn er erst später an die
    // Reihe kommt: nurWenn wird dann noch einmal gefragt)
    const matschNoch = () => this.aktiv && this.w === w && w.zustand === 'waschen' && w.schritt === 1 && !w.gewischt
      && w.flecken.every((f) => !f.fertig && f.rest >= 0.98);
    this.after(1.6, () => { if (matschNoch()) voice('waschanlage_matsch', { nurWenn: matschNoch }); });
    this.pruefe();   // vielleicht wurde schon beim Hereinrollen gewischt
  }

  // Fahrzeug fährt rechts hinaus (fertig gewaschen oder weil ein anderes gewählt wurde), dann kommt das nächste
  // Eilig (anderes gewählt): Ist es gerade erst links hereingerollt, rollt es weich links zurück statt quer durchs
  // Bild; sonst nach rechts. Die Dauer richtet sich nach dem Weg, damit es nie hektisch wird (≤ ~1100 Einheiten/s).
  losfahren(w, eilig = false) {
    if (w !== this.w || w.zustand === 'geht') return;
    const zurueck = eilig && w.zustand === 'kommt' && w.f.x < this.P.fz.x - 300;
    w.zustand = 'geht';
    for (const f of this.finger.values()) f.weg = true;
    this.fahrTonAn(w);
    sfx('common/wusch', { vol: 0.35 });
    const ziel = this.P.fz.x + (zurueck ? -START_ABSTAND : START_ABSTAND);
    const dauer = eilig ? clamp(Math.abs(ziel - w.f.x) / 700, 1.2, 3.4) : 3.2;
    w.f.fahreZu(ziel, dauer, { ease: eilig ? 'sineInOut' : 'quadIn' }).then(() => {
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

  // ---------------------------------------------------------------- Matsch und Schaum anbringen

  beschmutze(w) {
    const pts = flaechenPunkte(w.plan);
    let oben = Infinity;
    let unten = -Infinity;
    for (const p of pts) { oben = Math.min(oben, p.y); unten = Math.max(unten, p.y); }
    // Matsch sitzt eher unten (dort spritzt er hin)
    const n = Math.random() < 0.5 ? 4 : 5;
    // … und nie ins Gesicht (ein Klecks am Auge läse sich wie ein Auge/Ohr, und die Freude wäre verdeckt)
    const frei = ohneGesicht(w.plan, pts, GESICHT_MATSCH, n * 3);
    const tief = frei.filter((p) => p.y > oben + (unten - oben) * 0.3);
    const orte = verteile(tief.length >= n * 3 ? tief : frei, n);
    const ids = shuffle(['matsch_a', 'matsch_b', 'matsch_c', 'matsch_d', 'matsch_e']);
    const s0 = w.plan.scale;
    orte.forEach((o, i) => {
      const huelle = new Container({ label: 'matsch' });
      huelle.position.set(o.x, o.y);
      huelle.rotation = rand(-0.35, 0.35);
      huelle.zIndex = 5;
      const s = spr('waschanlage/' + ids[i % ids.length], { parent: huelle });
      const mass = rand(195, 235) / s0;   // ≈ 195–235 Einheiten auf der Bühne
      const sk = mass / Math.max(s.texture.width, s.texture.height);
      s.scale.set(sk);
      w.f.innen.addChild(huelle);
      const fleck = { huelle, sprite: s, rest: 1, fertig: false, x: o.x, y: o.y, r: mass * s0 * 0.45, wx: 0, wy: 0 };
      // Tippfläche mindestens ~250 Einheiten, auch beim schmalen Streifen
      const min = 250 / (sk * s0);
      const bw = Math.max(s.texture.width, min);
      const bh = Math.max(s.texture.height, min);
      fleck.wisch = wipe(s, {
        radius: 95,
        sound: null,
        hitArea: new Rectangle(-bw / 2, -bh / 2, bw, bh),
        onProgress: () => {
          w.gewischt = true;   // das Kind wischt schon: kein Hinweis mehr auf den Matsch
          if (this.tor('wisch', 0.35)) sfx('common/wisch', { vol: 0.5 });
          if (this.tor('krumen', 0.3) && fleck.wx) this.burst('staub', fleck.wx + rand(-40, 40), fleck.wy, { count: 1 });
        },
        onDone: () => this.fleckWeg(fleck),
      });
      w.flecken.push(fleck);
    });
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

  // Tippfläche über dem ganzen Körper (unter dem Matsch): Antippen = ein Tupfer, sonst grüßt das Fahrzeug
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
      w.gewischt = true;   // Finger auf dem schmutzigen Fahrzeug: kein Hinweis mehr auf den Matsch
      this.reibeMatsch(w, x, y, laenge, tupf);
    }
    else if (w.schritt === 2) this.reibeSchaum(w, x, y, laenge, tupf);
    else if (this.werkzeugFinger.has(id) || w.alteFinger?.has(id) || this.t < w.spuelAb) {
      // Gerade erst eingeschäumt, oder Schwamm/Bürste in der Hand, oder derselbe Finger reibt einfach weiter:
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
      if (Math.hypot(x - f.wx, y - f.wy) > f.r + 80) continue;
      getroffen = true;
      f.rest -= laenge * 0.0017 + (tupf ? 0.08 : 0);
      if (f.rest <= 0.3) this.fleckWeg(f);
    }
    if (getroffen) {
      if (this.tor('wisch', 0.35)) sfx('common/wisch', { vol: 0.5 });
      if (this.tor('krumen', 0.3)) this.burst('staub', x, y, { count: 1 });
    } else if (tupf && this.tor('leer', 0.6)) {
      // saubere Stelle angetippt: Das Fahrzeug wackelt kichernd, und der nächste Matschfleck wippt („hier!")
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
    this.tween(f.huelle, { alpha: 0 }, 0.6, { ease: 'sineInOut' }).then(() => {
      if (!f.huelle.destroyed) f.huelle.visible = false;
    });
    if (f.wx && this.tor('fleckFunkeln', 0.3)) {
      this.burst('funkeln', f.wx, f.wy, { count: 3 });
      sfx('common/funkeln', { vol: 0.3 });
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
      this.sauber(w);
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
    }
    this.after(0.3, () => {
      if (this.w !== w || w.zustand !== 'waschen') return;
      this.ente.nod();
      sfx('common/plopp', { vol: 0.5 });
      if (n === 2) {
        this.burst('funkeln', (w.box.x0 + w.box.x1) / 2, (w.box.y0 + w.box.y1) / 2, { count: 4 });
        // nicht mehr, wenn schon kräftig eingeschäumt wird (oder das Fahrzeug weg ist)
        voice('waschanlage_schaum', {
          nurWenn: () => this.aktiv && this.w === w && w.zustand === 'waschen' && w.schritt === 2
            && !w.schaum.some((b) => b.erreicht),
        });
      } else if (n === 3) {
        // das eingeschäumte Fahrzeug freut sich kurz über den Schaum
        w.f.wackel(0.02);
        this.burst('blasen', (w.box.x0 + w.box.x1) / 2, w.oben + 40, { count: 3 });
        // nicht mehr, wenn das Kind die Brause schon laufen lässt (oder das Fahrzeug weg ist)
        voice('waschanlage_spuelen', {
          nurWenn: () => this.aktiv && this.w === w && w.zustand === 'waschen' && w.schritt === 3
            && !this.wasser.halten && this.wasser.staerke < 0.3,
        });
      }
    });
  }

  // Der Moment „sauber" – gestaffelt, damit sich nie mehr als zwei Dinge zugleich auffällig bewegen und kein
  // Ton auf dem anderen liegt: Glanz → Fahrzeug hupt/pfeift → Ente klatscht → Sticker → hinausrollen.
  sauber(w) {
    w.zustand = 'fertig';
    this.runden++;
    for (const b of w.schaum) b.wert = 0;
    // Wasser aus (auch wenn noch ein Finger auf der Brause liegt)
    const ws = this.wasser;
    ws.halten = false;
    ws.nach = 0;
    ws.finger = 0;
    sfx('common/funkeln', { vol: 0.45 });
    this.glanz(w);
    voice('waschanlage_sauber');
    this.after(0.9, () => { if (this.w === w && !w.f.destroyed) this.gruss(w); });
    this.after(1.9, () => this.enteKlatscht());
    this.after(2.9, () => this.belohnung(w));
    this.after(4.6, () => this.losfahren(w));
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
    const ids = stickerFuerOrt('waschanlage', { nurVorhandene: true }).map((s) => s.id);
    if (!ids.length) return;
    const schon = new Set(gesammelt());
    const neu = ids.find((id) => !schon.has(id));
    if (!neu && this.runden % 3 !== 0) return;
    // rechts neben dem Fahrzeug über der Walze – dort ist frei (nicht auf der Brause, nicht im Wasser),
    // und der Stern hat es nicht weit bis zum Album-Knopf oben rechts
    belohne(this, neu || pick(ids), clamp(w.box.x1 + 160, 560, 700), 600);
  }

  // ---------------------------------------------------------------- Takt

  update(dt, t) {
    this.wolken.update(dt);
    this.vogel.update(dt);
    this.falter.update(dt);
    const w = this.w;
    if (w && !w.f.destroyed) {
      w.f.update(dt);
      this.zeigeSchmutz(w, dt);
    }
    this.wippe(t, dt);
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
      if (!f.fertig) f.huelle.alpha += (clamp(f.rest, 0, 1) - f.huelle.alpha) * k;
    }
  }

  // Das Werkzeug des aktuellen Schritts wippt sanft; gezogene Werkzeuge neigen sich zum Schrubben
  wippe(t, dt) {
    const w = this.w;
    const schritt = w && w.zustand === 'waschen' ? w.schritt : 0;
    const k = 1 - Math.exp(-dt * 5);
    const wipp = Math.sin(t * 2.6) * 0.1;
    const b = this.buerste;
    if (!b.destroyed) {
      const ziel = this.buersteZug.isDragging() ? -0.4 : this.buersteHeim.rot + (schritt === 1 ? wipp : 0);
      b.rotation += (ziel - b.rotation) * k;
      // der Schatten bleibt nur, solange die Bürste (fast) daheim liegt
      const weg = Math.hypot(b.x - this.buersteHeim.x, b.y - this.buersteHeim.y);
      this.buersteSchatten.alpha = 0.28 * clamp(1 - weg / 120, 0, 1);
    }
    const s = this.schwamm;
    if (!s.destroyed) {
      const ziel = this.schwammZug.isDragging() ? 0.25 : schritt === 2 ? wipp : 0;
      s.rotation += (ziel - s.rotation) * k;
    }
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
      } else {
        liste.push(this.duschkopf);
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
  static music = 'musik/bau';
  static seiten = [Waschplatz];

  vorbereiten() {
    ui.albumKnopf(this);
  }

  exit() {
    super.exit();
    for (const s of this.seiten || []) s?.aufraeumen?.();
  }
}
