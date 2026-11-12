// Seite 2: der Einsatz – jede Runde ein anderer (nie zweimal derselbe hintereinander), jeder als kleine Kette.
// Das Auto kommt mit Blaulicht, zwei Tiere der Mannschaft (mit Helm) hüpfen hinten heraus.
//
// Feuer (im Fenster des Hauses oder im Mülleimer am Gehweg):
//   1. Schlauch vom Auto zum Hydranten ziehen (Antippen des Hydranten geht auch: der Schlauch kommt von selbst).
//   2. Hydrant antippen: das Rad dreht sich, beim zweiten Mal läuft Wasser durch den Schlauch.
//   3. Mit dem Finger zeigen, wohin das Wasser spritzt: Flämmchen löschen (Antippen genügt, Halten und Ziehen geht).
//   4. Der Gerettete freut sich (Hase in der Tür bzw. Igel hinter dem Mülleimer), Orden ans Auto, Sticker.
//   5. Auf dem Gerätefach halten: der Schlauch rollt sich ein (ein Tipp rollt ein gutes Stück).
//   6. Auto antippen: alle steigen ein, Tatü, weiter zum Waschplatz.
// Leiter (Katze auf dem Ast, Ballon im Baum, Entenkind auf dem Dach):
//   1. Leiter antippen: sie richtet sich auf, der Korb erscheint an der Spitze.
//   2. Den Korb hinaufziehen: die Leiter folgt dem Finger (beim Loslassen fährt sie den Rest von selbst).
//   3. Die Katze bzw. das Entenkind hüpft hinein / der Ballon hängt sich an den Korb.
//   4. Den Korb hinunterziehen: die Leiter legt sich wieder hin; der Gerettete kommt zu seinem Freund, alle freuen sich.
//   5. Auto antippen: alle steigen ein, Tatü, weiter zum Waschplatz.
// Überraschungen: manchmal ein Regenbogen im Sprühwasser, manchmal fällt ein Apfel vom Baum (die Mannschaft nascht).
// Was wächst: Gerettete bleiben als Zuschauer auf der Straße (bis zu drei, wer schon da ist, freut sich nur).

import { sfx, voice, tap, drag, hold, Actor, fx, rand, pick, shuffle, clamp, spr, stage, pointerCount, PIXI } from '../../engine/index.js';
import { Seite } from '../../gemeinsam/seiten.js';
import { belohne } from '../../gemeinsam/sticker.js';
import { FeuerAuto, freue, feuerSticker, setzeHelm, LEITER_SPITZE, LEITER_LIEGT } from './auto.js';
import { Wasserstrahl } from './strahl.js';
import { TonSchleife } from './schleife.js';
import { Vogel, Schmetterling, Wolken, tippStelle, entprellt, zeigeBlase, tippRand } from './deko.js';
import { EINSAETZE, naechsterEinsatz, waehleMannschaft } from './einsaetze.js';

const AUTO_SKALA = 0.75;
const FLAMME_SKALA = 0.46;
const TREFFER = 165;          // so nah muss der Strahl an der Mitte eines Flämmchens sein
const LOESCHZEIT = 0.6;       // Sekunden Dauer-Wasser, bis ein Flämmchen aus ist (Halten)
const SCHWALL = 0.45;         // so viel löscht schon der erste Schwall eines einzelnen Fingerdrucks (Tippen)
const MIN_SPRITZEN = 0.5;     // so lange spritzt der Strahl mindestens – auch wenn nur kurz getippt wurde
const FINGER_RUHE = 3;        // Sekunden ganz ohne Bewegung des lenkenden Fingers: Strahl pausiert (Sicherheitsnetz)
const ORDEN_SKALA = 0.5;      // Orden an der Fahrertür (Faktor auf das Bild, im Auto)
// Türöffnung des Hauses im Hintergrund (Seiten-Koordinaten, aus dem Bild abgelesen): Rundbogen + gerade Seiten
const TUER = { links: 242, rechts: 450, bogenY: 908, unten: 1118 };
const GEHWEG = 1228;          // Füße auf dem Gehweg
const HYDRANT = { x: -205, y: GEHWEG - 4, scale: 0.42 };
const MUELL = { x: 40, y: GEHWEG - 2, scale: 0.42 };
const MANNSCHAFT_PLAETZE = [{ x: -250, y: 1505 }, { x: -60, y: 1518 }];
const ZUSCHAUER = [{ x: 480, y: 1500 }, { x: 680, y: 1512 }, { x: 880, y: 1500 }];
const BALLON = { x: -640, y: 560, scale: 0.62 };      // Schnurende im Laub
const MAUS = { x: -20, y: GEHWEG + 4, scale: 0.22 };
const KUEKEN = { x: 150, y: 566, scale: 0.13 };       // auf der Dachtraufe links
const MAMA = { x: 620, y: GEHWEG + 6, scale: 0.24 };
const KORB_SKALA = 0.5;
const KORB_HALTER = { x: 32 - 0.601 * 350, y: 147 - 0.982 * 241 };  // Halter relativ zum Anker (Bildpunkte)
const BALLON_FARBEN = [0xff7d7d, 0x8fc8ff, 0xffd166, 0xa7e08a, 0xd7a6ff];

// Punkt auf einer quadratischen Kurve a → b mit Kontrollpunkt c
function kurve(a, c, b, t, aus) {
  const q = 1 - t;
  aus.x = q * q * a.x + 2 * q * t * c.x + t * t * b.x;
  aus.y = q * q * a.y + 2 * q * t * c.y + t * t * b.y;
  return aus;
}

export class Einsatz extends Seite {
  static hg = 'feuerwehr/hg_einsatz';

  aufbau() {
    // 'start' | 'ankunft' | 'schlauch' | 'hydrant' | 'feuer' | 'leiter' | 'ausfahren' | 'runter' | 'jubel'
    // | 'aufrollen' | 'einsteigen' | 'faehrt' | 'weg'
    this.zustand = 'start';
    this.runden = 0;
    this.zisch = entprellt(0.9);
    this.klack = entprellt(0.5);
    this.kicher = entprellt(2.5);
    this.spritz = entprellt(1.2);
    this.rolltOn = entprellt(0.9);
    this.zeit = 0;
    this.wasserTon = new TonSchleife('common/wasserstrahl', { vol: 0.55 });
    this.mannschaft = [];
    this.zuschauer = [null, null, null];   // je Platz: [Figur, …] (Entenmama mit Kind = zwei)
    this.zuschauerFolge = [];              // Reihenfolge der Ankunft (der älteste geht zuerst)

    this.wolken = new Wolken({
      parent: this.hinten,
      liste: [
        { tex: 'common/wolke1', x: -200, y: 150, scale: 0.26, v: 6 },
        { tex: 'common/wolke2', x: 1000, y: 260, scale: 0.3, v: 9 },
      ],
    });

    // Auto am Straßenrand links
    const a = this.punkt('auto', { x: -714, y: 1430 });
    this.autoPlatz = { x: a.x + 24, y: a.y + 10 };
    this.auto = new FeuerAuto({ x: -1900, y: this.autoPlatz.y, scale: AUTO_SKALA, parent: this.welt, z: 10, fahrer: 'fuchs' });
    tap(this.auto.f.koerper, (e) => this.autoAngetippt(e), { sound: null, pad: 40 });
    // Leiter: großzügige Tippfläche um die liegende Leiter (lokale Bildpunkte, Leiter ist klein skaliert)
    tap(this.auto.leiter, () => this.leiterAngetippt(), {
      sound: null, squash: false, hitArea: new PIXI.Rectangle(-200, -420, 1250, 760),
    });

    this.baueFlammen();
    this.baueHaus();
    this.baueHydrant();
    this.baueSchlauch();
    this.baueKorb();
    this.baueStrahl();

    this.vogel = new Vogel(this, {
      parent: this.welt,
      scale: 0.85,
      plaetze: [{ x: 478, y: 205 }, { x: 160, y: 300, flip: true }, { x: -330, y: 125 }],
    });
    this.falter = new Schmetterling(this, { x: 870, y: 930, parent: this.welt, farbe: 0xffd27a, weite: 110 });
    tippStelle(this.welt, -400, 380, 250, () => {
      sfx('common/rascheln', { vol: 0.6 });
      this.burst('blaetter', rand(-640, -300), 420, { count: 4 });
    }, { label: 'baumkrone', z: 2 });

    // Regenbogen (Überraschung beim Löschen)
    this.regenbogen = spr('common/regenbogen', { x: 520, y: 470, scale: 0.62, parent: this.welt, z: 5 });
    this.regenbogen.alpha = 0;
    this.regenbogen.visible = false;
    this.regenbogen.eventMode = 'none';
  }

  // ---------------------------------------------------------------- Flammen (Fenster und Mülleimer)

  baueFlammen() {
    const art = ['flamme1', 'flamme2', 'flamme3'];
    this.flammen = ['fenster1', 'fenster2', 'fenster3'].map((name, i) => {
      const p = this.punkt(name, { x: 342 + i * 260, y: 603 });
      return this.neueFlamme(art[i], p.x, p.y, 58, FLAMME_SKALA, 'fenster');
    });
    // Mülleimer am Gehweg (steht immer da; im Einsatz „Mülleimer" sitzen Flämmchen darauf)
    this.muell = spr('common/icon_muelleimer', { x: MUELL.x, y: MUELL.y, scale: MUELL.scale, parent: this.welt, z: 20 });
    tap(this.muell, () => {
      this.klack('common/klack', { vol: 0.55 });
      fx.wobble(this.muell, 0.05);
    }, { sound: null, pad: 70, squash: false });
    // Bild hat den Anker in der Mitte: Flämmchen stehen knapp unter dem oberen Rand (wachsen aus dem Eimer)
    const oben = MUELL.y - 400 * MUELL.scale * 0.5 - 18;
    this.flammen.push(this.neueFlamme('flamme2', MUELL.x - 28, oben, 40, 0.36, 'muell'));
    this.flammen.push(this.neueFlamme('flamme3', MUELL.x + 30, oben + 4, 40, 0.32, 'muell'));
  }

  neueFlamme(tex, x, y, unter, skala, ort) {
    const s = spr('feuerwehr/' + tex, { x, y: y + unter, parent: this.welt, z: 21 });
    s.scale.set(0);
    s.visible = false;
    s.eventMode = 'none';
    // Die beiden Flämmchen im Mülleimer stehen dicht beisammen (ein Strahl trifft beide): sie brauchen mehr
    // Wasser, damit das Löschen auch dort zwei, drei Spritzer dauert und nicht mit einem Tipp vorbei ist.
    const vollLeben = ort === 'muell' ? 2.2 : 1;
    return { s, mitte: { x, y }, an: false, leben: 1, vollLeben, groesse: 0, rauch: null, phase: rand(0, 6), dampf: 0, skala, ort };
  }

  flammeAn(f, verz) {
    f.an = true;
    f.leben = f.vollLeben;
    f.s.visible = true;
    f.s.alpha = 0;
    f.groesse = 0;
    this.tween(f, { groesse: 1 }, 1.2, { ease: 'sineOut', delay: verz });
    this.tween(f.s, { alpha: 1 }, 0.8, { ease: 'sineInOut', delay: verz });
    this.after(verz + 0.6, () => this.rauchAn(f));
  }

  rauchAn(f) {
    if (!f.an || f.rauch || !this.aktiv) return;
    f.rauch = this.emitter('rauch', { x: f.mitte.x, y: f.mitte.y - 90, rate: 0.45, groesse: 0.75 });
  }

  rauchAus(f) {
    f.rauch?.stop();
    f.rauch = null;
  }

  flammeAus(f) {
    f.an = false;
    this.rauchAus(f);
    this.zisch('common/zisch', { vol: 0.8 });
    this.burst('rauch', f.mitte.x, f.mitte.y - 20, { count: 5, groesse: 0.9 });
    this.tween(f, { groesse: 0 }, 0.7, { ease: 'sineIn' });
    this.tween(f.s, { alpha: 0 }, 0.7, { ease: 'sineInOut' }).then(() => { if (!f.an) f.s.visible = false; });
    if (!this.regenbogenGezeigt && this.regenbogenRunde) this.regenbogenZeigen();
    if (this.flammen.every((x) => !x.an) && this.zustand === 'feuer') this.feuerAus();
  }

  async regenbogenZeigen() {
    this.regenbogenGezeigt = true;
    const r = this.regenbogen;
    r.visible = true;
    sfx('common/funkeln', { vol: 0.4 });
    await this.tween(r, { alpha: 0.55 }, 1.4, { ease: 'sineInOut' });
    await this.wait(2.6);
    await this.tween(r, { alpha: 0 }, 1.6, { ease: 'sineInOut' });
    r.visible = false;
  }

  // ---------------------------------------------------------------- Haus

  baueHaus() {
    // offene Tür: dunkle Türöffnung (liegt über der gemalten Tür, nur sichtbar, solange sie offen ist)
    const { links, rechts, bogenY, unten } = TUER;
    const r = (rechts - links) / 2;
    const mx = links + r;
    this.tuerMitte = mx;
    const tor = (g, inset, farbe, alpha) => g
      .moveTo(links + inset, unten)
      .lineTo(links + inset, bogenY)
      .arc(mx, bogenY, r - inset, Math.PI, 0)
      .lineTo(rechts - inset, unten)
      .closePath()
      .fill({ color: farbe, alpha });
    const oeffnung = new PIXI.Graphics();
    tor(oeffnung, 0, 0x4a2c1c, 1);
    tor(oeffnung, 16, 0x6e4529, 0.6);
    oeffnung.rect(links + 6, unten - 40, rechts - links - 12, 40).fill({ color: 0x8a5a36, alpha: 0.55 });
    // die aufgeschwungene Tür als schmaler Streifen am rechten Rand
    oeffnung.roundRect(rechts - 34, bogenY - 70, 30, unten - bogenY + 66, 8).fill(0xb8692f);
    oeffnung.roundRect(rechts - 28, bogenY - 60, 6, unten - bogenY + 50, 3).fill({ color: 0x8c4a1e, alpha: 0.6 });
    oeffnung.zIndex = 21;
    oeffnung.alpha = 0;
    oeffnung.visible = false;
    oeffnung.eventMode = 'none';
    this.welt.addChild(oeffnung);
    this.oeffnung = oeffnung;
    // Tür selbst: klopfen
    tippStelle(this.welt, mx, (bogenY + unten) / 2, 140, () => {
      if (this.oeffnung.visible) return;
      this.klack('common/klack', { vol: 0.6 });
      this.after(0.25, () => sfx('common/klack', { vol: 0.5 }));
    }, { label: 'tuer', z: 3 });

    this.orden = spr('feuerwehr/stern_orden', { x: mx, y: 640, scale: 0, parent: this.vorn, z: 50 });
    this.orden.anchor.set(0.5, 0.08);
    this.orden.visible = false;
    this.orden.eventMode = 'none';
  }

  async tuerAuf() {
    const o = this.oeffnung;
    o.visible = true;
    sfx('common/tuer', { vol: 0.5 });
    await this.tween(o, { alpha: 1 }, 0.5, { ease: 'sineInOut' });
  }

  async tuerZu() {
    await this.tween(this.oeffnung, { alpha: 0 }, 0.6, { ease: 'sineInOut' });
    this.oeffnung.visible = false;
  }

  // ---------------------------------------------------------------- Hydrant und Schlauch

  baueHydrant() {
    const h = spr('feuerwehr/hydrant', { x: HYDRANT.x, y: HYDRANT.y, scale: HYDRANT.scale, parent: this.welt, z: 19 });
    this.hydrant = h;
    const s = HYDRANT.scale;
    // Handrad vorn auf dem Wappen (dreht sich beim Aufdrehen)
    const rad = new PIXI.Graphics()
      .circle(0, 0, 25).fill(0xb07a1c)
      .circle(0, 0, 19).fill(0xe7b54a)
      .rect(-3, -22, 6, 44).fill(0xb07a1c)
      .rect(-22, -3, 44, 6).fill(0xb07a1c)
      .circle(0, 0, 8).fill(0xf6d26a)
      .circle(-6, -8, 5).fill({ color: 0xffffff, alpha: 0.4 });
    rad.position.set(HYDRANT.x + (150 - 0.493 * 295) * s, HYDRANT.y + (230 - 0.985 * 400) * s);
    rad.zIndex = 20;
    rad.eventMode = 'none';
    this.welt.addChild(rad);
    this.rad = rad;
    // Anschluss links am Hydranten
    this.hydrantAnschluss = { x: HYDRANT.x + (35 - 0.493 * 295) * s, y: HYDRANT.y + (232 - 0.985 * 400) * s };
    this.radStufe = 0;
    tap(h, () => this.hydrantAngetippt(), { sound: null, pad: 75, squash: false });
  }

  hydrantAngetippt() {
    fx.wobble(this.hydrant, 0.04);
    if (this.zustand === 'schlauch') {
      // Antippen statt Ziehen: der Schlauch kommt von selbst herüber
      this.schlauchAnschliessen(false);
      return;
    }
    if (this.zustand === 'hydrant') {
      this.radStufe++;
      this.klack('common/klack', { vol: 0.6 });
      this.tween(this.rad, { rotation: this.radStufe * Math.PI / 2 }, 0.45, { ease: 'sineInOut' });
      if (this.radStufe >= 2) this.wasserMarsch();
      return;
    }
    // sonst: ein paar Tropfen
    this.spritz('common/spritz', { vol: 0.45 });
    this.burst('tropfen', HYDRANT.x, HYDRANT.y - 150, { count: 6 });
  }

  baueSchlauch() {
    this.schlauchG = new PIXI.Graphics();
    this.schlauchG.zIndex = 12;
    this.schlauchG.eventMode = 'none';
    this.welt.addChild(this.schlauchG);
    // Kupplung am Schlauchende (zum Ziehen)
    const k = new PIXI.Container({ label: 'kupplung' });
    k.addChild(new PIXI.Graphics()
      .circle(0, 0, 24).fill(0x9c6a18)
      .circle(0, 0, 18).fill(0xe0a83a)
      .circle(0, 0, 9).fill(0x6b4a14)
      .circle(-7, -8, 5).fill({ color: 0xffffff, alpha: 0.45 }));
    k.zIndex = 13;
    k.eventMode = 'none';
    this.welt.addChild(k);
    this.kupplung = k;
    this.schlauchDran = false;   // Ende steckt am Hydranten
    this.schlauchT = 0;          // 0 = ganz eingerollt (Ende am Auto) … 1 = Ende am Hydranten
    this.wasserAn = false;
    this.welle = -1;             // Wasser-Welle im Schlauch (0…1), -1 = keine
    this._a = new PIXI.Point();
    this._c = { x: 0, y: 0 };
    this._b = { x: 0, y: 0 };
    this._m = { x: 0, y: 0 };
    this._alt = { ax: 0, ay: 0, bx: 0, by: 0, w: -2, dick: 0 };
    // Gerätefach am Auto: dort halten, um den Schlauch einzurollen
    const fach = new PIXI.Container({ label: 'fach' });
    fach.zIndex = 14;
    fach.eventMode = 'none';
    fach.hitArea = new PIXI.Rectangle(-230, -130, 460, 260);
    this.welt.addChild(fach);
    this.fach = fach;
    this.rollt = false;
    this.rollBis = 0;
    hold(fach, {
      onStart: () => {
        if (this.zustand !== 'aufrollen') return;
        this.rollt = true;
        this.rollBis = Math.min(this.rollBis, Math.max(0, this.schlauchT - 0.3));
        fx.pop(this.auto.f.rumpf, 0.02);
        this.rollTon();
      },
      onEnd: () => { this.rollt = false; },
    });
  }

  rollTon() {
    this.rolltOn('common/angel', { vol: 0.55 });
  }

  // Wo der Schlauch hängt: Anfang am Auto, Ende an der Kupplung; durchhängend
  schlauchPunkte() {
    this.auto.punkt('schlauch', this.welt, this._a);
    const a = this._a;
    const b = this._b;
    b.x = this.kupplung.x;
    b.y = this.kupplung.y;
    const c = this._c;
    c.x = (a.x + b.x) / 2;
    c.y = Math.max(a.y, b.y) + 40 + Math.abs(b.x - a.x) * 0.18;
  }

  zeichneSchlauch() {
    const g = this.schlauchG;
    const a = this._a;
    const b = this._b;
    const c = this._c;
    const alt = this._alt;
    const dick = this.wasserAn ? 1 : 0;
    if (Math.abs(alt.ax - a.x) < 0.5 && Math.abs(alt.ay - a.y) < 0.5 && Math.abs(alt.bx - b.x) < 0.5 &&
        Math.abs(alt.by - b.y) < 0.5 && Math.abs(alt.w - this.welle) < 0.004 && alt.dick === dick) return;
    alt.ax = a.x; alt.ay = a.y; alt.bx = b.x; alt.by = b.y; alt.w = this.welle; alt.dick = dick;
    g.clear();
    if (Math.hypot(b.x - a.x, b.y - a.y) < 12) return;
    const w = 22 + dick * 4;
    g.moveTo(a.x, a.y).quadraticCurveTo(c.x, c.y, b.x, b.y).stroke({ width: w, color: 0x9e2a20, cap: 'round' });
    g.moveTo(a.x, a.y).quadraticCurveTo(c.x, c.y, b.x, b.y).stroke({ width: w - 9, color: 0xd2473a, cap: 'round' });
    g.moveTo(a.x, a.y - 4).quadraticCurveTo(c.x, c.y - 5, b.x, b.y - 4).stroke({ width: 4, color: 0xf3a08e, alpha: 0.7, cap: 'round' });
    if (this.welle >= 0) {
      // eine hellblaue Welle läuft vom Hydranten zum Auto
      kurve(b, c, a, this.welle, this._m);
      g.ellipse(this._m.x, this._m.y, 26, 15).fill({ color: 0x9fd8ff, alpha: 0.85 });
    }
  }

  schlauchTakt(dt) {
    const k = this.kupplung;
    // Ende folgt dem Auto, solange es eingerollt ist; beim Einrollen wandert es die Kurve zurück
    if (this.zustand === 'aufrollen') {
      if (this.rollt || this.schlauchT > this.rollBis) {
        this.schlauchT = Math.max(0, this.schlauchT - dt * 0.42);
        if (this.rollt) this.rollTon();
      }
      const r = this.rollBahn;
      kurve(r.a, r.c, r.b, this.schlauchT, k.position);
      if (this.schlauchT <= 0) this.eingerollt();
    } else if (!this.schlauchDran && !this.kupplungZieht) {
      if (!this.kupplungGleitet) this.auto.punkt('schlauch', this.welt, k.position);
    }
    if (this.welle >= 0) {
      this.welle += dt / 1.3;
      if (this.welle > 1) this.welle = -1;
    }
    this.schlauchPunkte();
    this.zeichneSchlauch();
  }

  schlauchZiehbar(an) {
    this.kupplungZug?.off();
    this.kupplungZug = null;
    const k = this.kupplung;
    k.eventMode = an ? 'static' : 'none';
    // Abschalten beendet ein laufendes Ziehen ohne onDrop (z. B. ein zweiter Finger tippt den Hydranten an):
    // dann gehört das Schlauchende wieder dem Ablauf, sonst bliebe es für immer „am Finger“ liegen.
    this.kupplungZieht = false;
    this.kupplungGleitet = false;
    k.zIndex = 13;
    if (!an) return;
    this.kupplungZug = drag(k, {
      pad: 110,
      lift: 1.15,
      heim: () => this.auto.punkt('schlauch', this.welt),
      targets: () => [{ x: this.hydrantAnschluss.x, y: this.hydrantAnschluss.y, radius: 260 }],
      onStart: () => {
        this.kupplungZieht = true;
        this.klack('common/klack', { vol: 0.4 });
      },
      onDrop: (ziel, ctx) => {
        this.kupplungZieht = false;
        if (ziel && this.zustand === 'schlauch') {
          ctx.erledigt = true;
          k.zIndex = 13;
          this.schlauchAnschliessen(true);
          return;
        }
        // daneben: gleitet zum Auto zurück (das Ende folgt dabei nicht dem Auto, sondern dem Gleiten)
        this.kupplungGleitet = true;
        ctx.back(0.5).then(() => { this.kupplungGleitet = false; });
      },
    });
  }

  async schlauchAnschliessen(gezogen) {
    if (this.zustand !== 'schlauch') return;
    this.zustand = 'hydrant';
    this.schlauchZiehbar(false);
    this.schlauchDran = true;
    const k = this.kupplung;
    const z = this.hydrantAnschluss;
    await this.tween(k, { x: z.x, y: z.y }, gezogen ? 0.25 : 0.9, { ease: 'sineInOut' });
    sfx('common/kupplung', { vol: 0.55 });
    fx.pop(this.hydrant, 0.06);
    this.burst('funkeln', z.x, z.y, { count: 3 });
    this.hinweisSatz(null);
  }

  wasserMarsch() {
    this.zustand = 'feuer';
    this.wasserAn = true;
    this.welle = 0;
    sfx('common/blubber', { vol: 0.5 });
    this.after(1.0, () => {
      sfx('common/spritz', { vol: 0.5 });
      this.burst('tropfen', this._a.x, this._a.y - 20, { count: 4 });
      fx.pop(this.auto.f.rumpf, 0.03);
    });
    this.after(1.3, () => this.hinweisSatz('feuerwehr_spritzen', () => !this.gespritzt));
  }

  // ---------------------------------------------------------------- Leiter und Korb

  baueKorb() {
    const k = spr('feuerwehr/leiterkorb', { scale: KORB_SKALA, parent: this.welt, z: 27 });
    k.visible = false;
    k.alpha = 0;
    k.eventMode = 'none';
    this.korb = k;
    this._tip = new PIXI.Point();
    this._fuss = new PIXI.Point();
    this.reiter = null;      // wer gerade im Korb mitfährt
    this.korbBallon = null;  // Ballon, der am Korb hängt
  }

  // Leiter-Spitze (Halter des Korbs) in Seiten-Koordinaten
  leiterSpitze(aus = this._tip) {
    return this.welt.toLocal(this.auto.leiter.toGlobal({ x: LEITER_SPITZE.x, y: LEITER_SPITZE.y }), undefined, aus);
  }

  korbAnSpitze() {
    const t = this.leiterSpitze();
    this.korb.position.set(t.x - KORB_HALTER.x * KORB_SKALA, t.y - KORB_HALTER.y * KORB_SKALA);
  }

  // Mitte des Korbbodens (dort stehen Mitfahrer) in Seiten-Koordinaten
  korbBoden() {
    const k = this.korb;
    return { x: k.x + (175 - 0.601 * 350) * KORB_SKALA + 10, y: k.y - 26 };
  }

  // Ziel der Leiter-Spitze, damit der Korb gleich rechts neben dem Geretteten hängt
  korbZiel() {
    const z = this.rettZiel;
    return { x: z.x + 98, y: z.y - 22 };
  }

  // Leiter so stellen, dass ihre Spitze auf (x, y) zeigt (Länge begrenzt). Gibt die Länge (Faktor) zurück.
  leiterAuf(x, y) {
    const a = this.auto;
    const l = a.leiter;
    const fuss = a.punkt('leiter', this.welt, this._fuss);
    const skala = Math.abs(a.f.worldTransform.a / this.welt.worldTransform.a);
    const winkel = clamp(Math.atan2(y - fuss.y, x - fuss.x), -1.45, 0);
    const lang = clamp(Math.hypot(x - fuss.x, y - fuss.y) / skala / LEITER_SPITZE.x, LEITER_LIEGT, this.leiterMax ?? 2.4);
    l.rotation = winkel;
    l.scale.x = lang;
    return lang;
  }

  // Leiter weich von ihrer jetzigen Stellung zur Stellung (winkel, lang)
  leiterNach(winkel, lang, dauer) {
    const l = this.auto.leiter;
    const von = { r: l.rotation, s: l.scale.x };
    const p = { t: 0 };
    return this.tween(p, { t: 1 }, dauer, {
      ease: 'sineInOut',
      onUpdate: () => {
        l.rotation = von.r + (winkel - von.r) * p.t;
        l.scale.x = von.s + (lang - von.s) * p.t;
      },
    });
  }

  // Winkel und Länge, mit denen die Spitze auf (x, y) zeigt
  leiterMass(x, y) {
    const a = this.auto;
    const fuss = a.punkt('leiter', this.welt, this._fuss);
    const skala = Math.abs(a.f.worldTransform.a / this.welt.worldTransform.a);
    return {
      winkel: clamp(Math.atan2(y - fuss.y, x - fuss.x), -1.45, 0),
      lang: Math.max(LEITER_LIEGT, Math.hypot(x - fuss.x, y - fuss.y) / skala / LEITER_SPITZE.x),
    };
  }

  leiterAngetippt() {
    if (this.zustand === 'leiter' && !this.ankunftLaeuft) {
      this.leiterAufrichten();
      return;
    }
    if (this.zustand === 'ausfahren' && !this.leiterFaehrt) {
      this.leiterAusfahren();
      return;
    }
    if (this.zustand === 'runter' && !this.leiterFaehrt) {
      this.leiterEinfahren();
      return;
    }
    // Die Tippfläche der Leiter liegt oben hinten auf dem Auto: dort zählt ein Tipp wie ein Tipp aufs Auto
    if (this.zustand === 'einsteigen') {
      this.abfahren();
      return;
    }
    if (this.zustand === 'aufrollen') {
      this.rollBis = Math.max(0, this.schlauchT - 0.3);
      this.rollTon();
      return;
    }
    if (!['ausfahren', 'runter'].includes(this.zustand)) this.leiterWackelt();
  }

  // Leiter ruckelt kurz (es gibt gerade nichts zu holen)
  leiterWackelt() {
    if (this.leiterFaehrt) return;
    this.klack('common/klack', { vol: 0.5 });
    const l = this.auto.leiter;
    const r = l.rotation;
    this.tween(l, { rotation: r - 0.06 }, 0.15, { ease: 'sineOut' })
      .then((ok) => { if (ok) this.tween(l, { rotation: r }, 0.35, { ease: 'bounceOut' }); });
  }

  async leiterAufrichten() {
    this.zustand = 'ausfahren';
    this.leiterFaehrt = true;
    const z = this.korbZiel();
    const m = this.leiterMass(z.x, z.y);
    this.leiterMax = m.lang * 1.04;
    sfx('common/kran', { vol: 0.5 });
    // nur etwa halb ausgefahren: auch bei einem nahen Ziel (Katze auf dem Ast) bleibt ein echtes Stück zum Hinaufziehen
    await this.leiterNach(m.winkel, clamp(m.lang * 0.5, LEITER_LIEGT, 0.55), 1.6);
    this.leiterFaehrt = false;
    // der Korb erscheint an der Spitze
    const k = this.korb;
    this.korbAnSpitze();
    k.visible = true;
    this.tween(k, { alpha: 1 }, 0.4, { ease: 'sineInOut' });
    fx.pop(k, 0.12);
    sfx('common/plopp', { vol: 0.5 });
    this.korbZiehbar(true);
    this.hinweisSatz('feuerwehr_korb', () => this.zustand === 'ausfahren' && !this.korbGezogen);
  }

  korbZiehbar(an) {
    this.korbZug?.off();
    this.korbZug = null;
    const k = this.korb;
    k.eventMode = an ? 'static' : 'none';
    // Abschalten beendet ein laufendes Ziehen ohne onDrop (z. B. ein zweiter Finger tippt die Leiter an):
    // dann hängt der Korb im nächsten Bild wieder an der Leiterspitze, statt in der Luft zu bleiben.
    this.korbZieht = false;
    k.zIndex = 27;
    if (!an) return;
    this.korbZug = drag(k, {
      pad: 90,
      lift: 1.06,
      onStart: () => {
        this.korbGezogen = true;
        this.korbZieht = true;
        sfx('common/kran', { vol: 0.35 });
      },
      onMove: () => {
        // Leiter folgt dem Finger; der Korb bleibt an ihrer Spitze
        this.leiterAuf(k.x + KORB_HALTER.x * KORB_SKALA, k.y + KORB_HALTER.y * KORB_SKALA);
        this.korbAnSpitze();
        if (this.zustand === 'ausfahren') {
          const z = this.korbZiel();
          const t = this.leiterSpitze();
          if (Math.hypot(t.x - z.x, t.y - z.y) < 45) this.korbLos();
        } else if (this.zustand === 'runter' && this.auto.leiter.scale.x < LEITER_LIEGT + 0.12) {
          this.korbLos();
        }
      },
      onDrop: (ziel, ctx) => {
        ctx.erledigt = true;
        k.zIndex = 27;
        this.korbLos();
      },
    });
  }

  // Ziehen zu Ende (losgelassen oder angekommen): den Rest fährt die Leiter von selbst
  korbLos() {
    if (!this.korbZieht) return;
    this.korbZieht = false;
    this.korbZiehbar(false);
    this.korb.zIndex = 27;
    if (this.zustand === 'ausfahren') this.leiterAusfahren();
    else if (this.zustand === 'runter') this.leiterEinfahren();
  }

  async leiterAusfahren() {
    if (this.leiterFaehrt) return;
    this.korbZiehbar(false);
    this.leiterFaehrt = true;
    const z = this.korbZiel();
    const m = this.leiterMass(z.x, z.y);
    sfx('common/kran', { vol: 0.45 });
    await this.leiterNach(m.winkel, m.lang, 0.9);
    this.leiterFaehrt = false;
    this.zustand = 'holen';
    sfx('common/klack', { vol: 0.5 });
    await this.wait(0.3);
    if (this.apfelRunde && this.einsatz !== 'kueken') this.apfelFaellt();
    await this.einsteigenInKorb();
    this.zustand = 'runter';
    this.korbZiehbar(true);
  }

  async einsteigenInKorb() {
    const r = this.retter;
    const b = this.korbBoden();
    if (this.einsatz === 'ballon') {
      // der Ballon löst sich aus dem Laub und hängt sich an den Korb
      const bl = this.ballon;
      sfx('common/rascheln', { vol: 0.55 });
      this.burst('blaetter', bl.x, bl.y - 120, { count: 3 });
      await this.tween(bl, { x: b.x + 30, y: b.y - 40, rotation: 0 }, 0.8, { ease: 'sineInOut' });
      this.korbBallon = bl;
      sfx('common/ballon', { vol: 0.5 });
      return;
    }
    r.schatten.visible = false;
    r.zIndex = 26;
    sfx('common/hupf', { vol: 0.45 });
    // Das kleine Entenkind steht im Korb etwas höher, sonst verschwindet es ganz hinter dem Korbrand
    this.reiterHoch = this.einsatz === 'kueken' ? 48 : 0;
    await r.hopTo(b.x, b.y - this.reiterHoch, { hoehe: 70, dauer: 0.55, staub: false });
    this.reiter = r;
    r.sound();
  }

  async leiterEinfahren() {
    if (this.leiterFaehrt) return;
    this.korbZiehbar(false);
    this.zustand = 'jubel';
    this.leiterFaehrt = true;
    sfx('common/kran', { vol: 0.45 });
    await this.leiterNach(0, LEITER_LIEGT, 2.0);
    this.leiterFaehrt = false;
    await this.wait(0.2);
    await this.gerettet();
  }

  // ---------------------------------------------------------------- Ein Apfel fällt (Überraschung)

  async apfelFaellt() {
    this.apfelRunde = false;
    const t = this.leiterSpitze({ x: 0, y: 0 });
    const a = spr('common/futter_apfel', { x: t.x + 40, y: t.y - 60, scale: 0.2, parent: this.welt, z: 30 });
    a.eventMode = 'none';
    sfx('common/rascheln', { vol: 0.5 });
    const helfer = this.mannschaft[0];
    const ziel = helfer && !helfer.destroyed ? { x: helfer.x + 110, y: helfer.y - 10 } : { x: t.x + 60, y: 1500 };
    const von = { x: a.x, y: a.y };
    const p = { t: 0 };
    // gemächlich (Ruhe-Regel: höchstens etwa 1000 Einheiten/s, auch am Ende des Falls)
    await this.tween(p, { t: 1 }, 1.7, {
      ease: 'sineIn',
      onUpdate: () => {
        a.x = von.x + (ziel.x - von.x) * p.t;
        a.y = von.y + (ziel.y - von.y) * p.t;
        a.rotation = p.t * 2.5;
      },
    });
    sfx('common/landen', { vol: 0.5 });
    await this.tween(a, { y: ziel.y - 40 }, 0.2, { ease: 'quadOut' });
    await this.tween(a, { y: ziel.y }, 0.25, { ease: 'bounceOut' });
    if (helfer && !helfer.destroyed) {
      helfer.lookAt(a.x);
      sfx('common/mampf', { vol: 0.5 });
      if (helfer.hasPose('eat') && !helfer.helm) helfer.pose('eat');
      this.burst('herzen', helfer.x, helfer.y - 220, { count: 2 });
    }
    await this.tween(a, { alpha: 0, scale: 0.12 }, 0.8, { ease: 'sineInOut' });
    a.destroy();
  }

  // ---------------------------------------------------------------- Mannschaft und Zuschauer

  async mannschaftSteigtAus() {
    const ids = (this.szene.mannschaft || waehleMannschaft(3)).filter((id) => id !== this.e.retter).slice(0, 2);
    this.szene.mannschaft = null;
    for (let i = 0; i < ids.length; i++) {
      const p = MANNSCHAFT_PLAETZE[i];
      const heck = this.auto.punkt('heck', this.welt);
      const t = new Actor(ids[i], { x: heck.x, y: heck.y + 60, scale: 0.27, parent: this.welt, z: 40 });
      setzeHelm(t);
      t.alpha = 0;
      t.schatten.visible = false;
      t.onTap(() => freue(this, t, { herzen: 3 }), { pad: tippRand(t) });
      this.mannschaft.push(t);
      this.tween(t, { alpha: 1 }, 0.25, { ease: 'sineOut' });
      sfx('common/hupf', { vol: 0.45 });
      await t.hopTo(p.x, p.y, { hoehe: 150, dauer: 0.7 });
      t.schatten.visible = true;
      await this.wait(0.1);
    }
  }

  async mannschaftSteigtEin() {
    for (const t of this.mannschaft) {
      if (t.destroyed) continue;
      const heck = this.auto.punkt('heck', this.welt);
      t.schatten.visible = false;
      sfx('common/hupf', { vol: 0.45 });
      await t.hopTo(heck.x, heck.y + 60, { hoehe: 150, dauer: 0.6, staub: false });
      await this.tween(t, { alpha: 0 }, 0.25, { ease: 'sineIn' });
      t.destroy({ children: true });
    }
    this.mannschaft = [];
  }

  // Gerettete gehen zu den Zuschauern (ist dasselbe Tier schon da, freut es sich nur und das neue geht heim)
  async zuDenZuschauern(gruppe) {
    const id = gruppe[0].tierId;
    const da = this.zuschauer.findIndex((g) => g && g[0].tierId === id);
    if (da >= 0) {
      freue(this, this.zuschauer[da][0], { herzen: 3 });
      for (const f of gruppe) {
        this.tween(f, { alpha: 0 }, 0.8, { ease: 'sineInOut' }).then(() => { if (!f.destroyed) f.destroy({ children: true }); });
      }
      return;
    }
    let platz = this.zuschauer.findIndex((g) => !g);
    if (platz < 0) {
      // der älteste Zuschauer geht nach Hause
      platz = this.zuschauerFolge.shift();
      const alt = this.zuschauer[platz];
      this.zuschauer[platz] = null;
      for (const f of alt) {
        f.eventMode = 'none';
        f.walkTo(1550, f.y, { tempo: 320 }).then(() => { if (!f.destroyed) f.destroy({ children: true }); });
      }
      await this.wait(0.8);
    }
    this.zuschauer[platz] = gruppe;
    this.zuschauerFolge.push(platz);
    const p = ZUSCHAUER[platz];
    const laeufe = gruppe.map((f, i) => {
      f.zIndex = 38;
      f.onTap(() => freue(this, f, { herzen: 3 }), { pad: tippRand(f) });
      return f.walkTo(p.x + i * 95, p.y + i * 6, { tempo: 340 });
    });
    await Promise.all(laeufe);
    for (const f of gruppe) if (!f.destroyed) f.lookAt(f.x - 100);
  }

  // ---------------------------------------------------------------- Eine Runde vorbereiten

  vorbereiten() {
    const id = this.szene.einsatzWahl || naechsterEinsatz(this.szene);
    this.szene.einsatzWahl = null;
    this.einsatz = id;
    this.e = EINSAETZE[id];
    this.runden++;
    this.retter = null;
    this.mama = null;
    this.ballon = null;
    this.korbBallon = null;
    this.reiter = null;
    this.gespritzt = false;
    this.korbGezogen = false;
    this.regenbogenGezeigt = false;
    this.regenbogenRunde = this.e.art === 'feuer' && Math.random() < 0.5;
    this.apfelRunde = this.e.art === 'leiter' && Math.random() < 0.5;
    this.radStufe = 0;
    this.rad.rotation = 0;
    // Brennt der Mülleimer, darf ein Druck auf ihn nicht das Spritzen schlucken (sein Wackeln fängt den Finger sonst ab)
    this.muell.eventMode = id === 'muell' ? 'none' : 'static';

    if (id === 'fenster') {
      const anzahl = this.runden === 1 ? 2 : (Math.random() < 0.5 ? 2 : 3);
      shuffle(this.flammen.filter((f) => f.ort === 'fenster')).slice(0, anzahl).forEach((f, i) => this.flammeAn(f, 0.2 + i * 0.5));
    } else if (id === 'muell') {
      this.flammen.filter((f) => f.ort === 'muell').forEach((f, i) => this.flammeAn(f, 0.2 + i * 0.4));
      // manchmal brennt zusätzlich ein Fenster
      if (Math.random() < 0.4) this.flammeAn(pick(this.flammen.filter((f) => f.ort === 'fenster')), 1.2);
      // der Igel versteckt sich hinter dem Mülleimer
      const ig = new Actor('igel', { x: MUELL.x + 10, y: MUELL.y + 2, scale: 0.2, parent: this.welt, z: 18 });
      ig.visible = false;
      ig.schatten.visible = false;
      this.retter = ig;
    } else if (id === 'katze') {
      const ast = this.punkt('ast', { x: -854, y: 738 });
      const k = new Actor('katze', { x: ast.x + 10, y: ast.y + 14, scale: 0.24, parent: this.welt, z: 25 });
      k.schatten.visible = false;
      this.retter = k;
      this.rettZiel = { x: k.x, y: k.y };
      this.erscheine(k);
    } else if (id === 'ballon') {
      const farbe = pick(BALLON_FARBEN);
      const bl = spr('feuerwehr/ballon', { x: BALLON.x, y: BALLON.y, scale: BALLON.scale, parent: this.welt, z: 24 });
      bl.tint = farbe;
      bl.rotation = -0.12;
      bl.eventMode = 'none';
      this.ballon = bl;
      this.ballonFarbe = farbe;
      const m = new Actor('maus', { x: MAUS.x, y: MAUS.y, scale: MAUS.scale, parent: this.welt, z: 37 });
      m.flip = true;
      this.retter = m;
      this.rettZiel = { x: BALLON.x - 60, y: BALLON.y + 30 };
      this.erscheine(m);
      m.onTap(() => { fx.wobble(m); m.sound(); m.bubble('feuerwehr/ballon', 1.6); }, { pad: tippRand(m) });
      tap(bl, () => {
        sfx('common/ballon', { vol: 0.4 });
        fx.wobble(bl, 0.08);
      }, { sound: null, pad: 60, squash: false });
    } else if (id === 'kueken') {
      const kk = new Actor('ente', { x: KUEKEN.x, y: KUEKEN.y, scale: KUEKEN.scale, parent: this.welt, z: 25 });
      kk.schatten.visible = false;
      this.retter = kk;
      this.rettZiel = { x: kk.x, y: kk.y };
      const mama = new Actor('ente', { x: MAMA.x, y: MAMA.y, scale: MAMA.scale, parent: this.welt, z: 37, flip: true });
      this.mama = mama;
      mama.onTap(() => { fx.wobble(mama); mama.sound(); mama.bubble('tiere/ente_idle', 1.6); }, { pad: tippRand(mama) });
      this.erscheine(kk);
      this.erscheine(mama);
    }
    // Gerettete auf dem Ast/Dach lassen sich antippen: wie Antippen der Leiter
    if (this.retter && this.e.art === 'leiter' && id !== 'ballon') {
      const r = this.retter;
      r.onTap(() => {
        fx.wobble(r);
        r.sound();
        if (this.zustand === 'leiter' || this.zustand === 'ausfahren') this.leiterAngetippt();
      }, { pad: tippRand(r, 280, 70) });   // auch das kleine Entenkind: Tippfläche ≥ 280
    }
  }

  erscheine(f) {
    f.alpha = 0;
    this.tween(f, { alpha: 1 }, 0.6, { ease: 'sineInOut' });
  }

  async neueRunde() {
    this.zustand = 'ankunft';
    this.vorbereiten();
    await this.ankunft();
    await this.mannschaftSteigtAus();
    if (this.e.art === 'feuer') {
      this.zustand = 'schlauch';
      this.schlauchZiehbar(true);
      this.blase('feuerwehr/hydrant');
      this.hinweisSatz('feuerwehr_schlauch', () => this.zustand === 'schlauch');
    } else {
      this.zustand = 'leiter';
      this.retter?.sound();
      this.blase('feuerwehr/leiter');
      // „Tipp auf die Leiter. Wir holen die Katze." passt nur zur Katze
      if (this.einsatz === 'katze') this.hinweisSatz('feuerwehr_leiter', () => this.zustand === 'leiter');
    }
  }

  // Denkblase am Führerhaus: der Fuchs denkt an den nächsten Schritt
  blase(quelle, opt) {
    const p = this.auto.punkt('blaulicht', this.vorn);
    zeigeBlase(this, p.x + 40, p.y - 10, quelle, opt);
  }

  // ---------------------------------------------------------------- Geschafft

  async feuerAus() {
    this.zustand = 'jubel';
    this.muell.eventMode = 'static';
    await this.wait(0.8);
    const r = await this.retterZeigtSich();
    await freue(this, r, { herzen: 5 });
    await this.belohnung();
    // der Gerettete geht zu den Zuschauern, die Tür schließt sich
    if (this.einsatz === 'fenster') {
      r.zIndex = 38;
      r.schatten.visible = true;
      await r.hopTo(TUER.links + 104, GEHWEG + 30, { hoehe: 60, dauer: 0.5 });
      this.tuerZu();
    }
    this.zuDenZuschauern([r]);
    await this.wait(1.0);
    this.aufrollenBeginnt();
  }

  // Hase in der Tür bzw. Igel hinter dem Mülleimer
  async retterZeigtSich() {
    if (this.einsatz === 'fenster') {
      await this.tuerAuf();
      const h = new Actor('hase', { x: this.tuerMitte + 4, y: TUER.unten + 2, scale: 0.3, parent: this.welt, z: 22 });
      h.schatten.visible = false;
      h.alpha = 0;
      this.tween(h, { alpha: 1 }, 0.4, { ease: 'sineInOut' });
      await h.hop(40);
      this.retter = h;
      return h;
    }
    const ig = this.retter;
    ig.visible = true;
    ig.alpha = 1;
    ig.schatten.visible = true;
    await ig.hopTo(MUELL.x + 150, MUELL.y + 8, { hoehe: 60, dauer: 0.6 });
    ig.zIndex = 30;
    return ig;
  }

  async belohnung() {
    await this.wait(0.4);
    await this.ordenZumAuto();
    freue(this, this.auto.fahrer, { herzen: 3, laut: false });
    for (const t of this.mannschaft) this.after(rand(0, 0.5), () => freue(this, t, { herzen: 2, laut: false }));
    await this.wait(0.7);
    belohne(this, feuerSticker('feuerwehr_feuerwehrauto'), 20, 560);
    this.szene.ordenOffen = Math.min(3, (this.szene.ordenOffen || 0) + 1);
    this.szene.schmutz = this.e.schmutz;
    await this.wait(1.6);
  }

  async gerettet() {
    const r = this.retter;
    if (this.einsatz === 'ballon') {
      // der Ballon schwebt vom Korb zur Maus, sie hält ihn fest
      const bl = this.korbBallon;
      this.korbBallon = null;
      const m = r;
      const ziel = { x: m.x - 30, y: m.y - 150 };
      sfx('common/ballon', { vol: 0.5 });
      await this.tween(bl, { x: ziel.x, y: ziel.y }, 1.6, { ease: 'sineInOut' });
      // ab jetzt hängt der Ballon an der Maus (geht mit ihr mit)
      const s = bl.scale.x / Math.abs(m.scale.x);
      m.addChild(bl);
      bl.position.set((ziel.x - m.x) / m.scale.x, (ziel.y - m.y) / m.scale.y);
      bl.scale.set(s * 0.8);
      bl.zIndex = 5;
      bl.rotation = 0.08;
      bl.eventMode = 'none';
      m.flip = false;
      await freue(this, m, { herzen: 5 });
    } else {
      // vom Korb (auf dem Dach) auf die Straße
      this.reiter = null;
      r.zIndex = 38;
      const unten = { x: 140, y: 1490 };
      r.schatten.visible = true;
      sfx('common/hupf', { vol: 0.45 });
      // langer Weg vom Dach: gemächlicher Hüpfer (Spitze knapp 1050 Einheiten/s)
      await r.hopTo(unten.x, unten.y, { hoehe: 170, dauer: 1.4 });
      if (this.einsatz === 'kueken') {
        // Entenmama kommt, beide freuen sich
        const mama = this.mama;
        await mama.walkTo(unten.x + 130, unten.y + 6, { tempo: 360 });
        mama.lookAt(r.x);
        r.lookAt(mama.x);
        freue(this, mama, { herzen: 4 });
        await freue(this, r, { herzen: 4 });
      } else {
        r.lookAt(r.x - 100);
        await freue(this, r, { herzen: 6 });
      }
    }
    this.tween(this.korb, { alpha: 0 }, 0.5, { ease: 'sineInOut' }).then((ok) => { if (ok) this.korb.visible = false; });
    await this.belohnung();
    const gruppe = this.einsatz === 'kueken' ? [this.mama, r] : [r];
    this.zuDenZuschauern(gruppe);
    await this.wait(1.0);
    this.einsteigenBeginnt();
  }

  // Orden erscheint über dem Geretteten, schaukelt kurz und schwebt dann an die Fahrertür (bleibt dort)
  async ordenZumAuto() {
    const o = this.orden;
    const alt = this.ordenAmAuto;
    if (alt) {
      this.ordenAmAuto = null;
      this.tween(alt, { alpha: 0 }, 0.5, { ease: 'sineInOut' }).then(() => alt.destroy());
    }
    const r = this.retter;
    const start = r && !r.destroyed ? this.vorn.toLocal(r.toGlobal({ x: 0, y: 0 })) : { x: this.tuerMitte, y: 1100 };
    o.visible = true;
    o.alpha = 0;
    o.scale.set(0.2);
    o.rotation = 0;
    o.position.set(start.x, start.y - 420);
    this.tween(o, { alpha: 1, y: start.y - 380 }, 0.6, { ease: 'sineOut' });
    await this.tween(o, { scale: 0.55 }, 0.6, { ease: 'backOut' });
    sfx('common/funkeln', { vol: 0.5 });
    await this.tween(o, { rotation: 0.08 }, 0.6, { ease: 'sineInOut', yoyo: true, repeat: 1 });
    // im weichen Bogen zur Tür des Autos (Ziel jedes Bild neu: das Auto federt)
    const ziel = new PIXI.Point();
    const von = { x: o.x, y: o.y };
    const p = { t: 0 };
    const skalaZiel = ORDEN_SKALA * Math.abs(this.auto.f.worldTransform.a / this.vorn.worldTransform.a);
    this.tween(o, { scale: skalaZiel }, 1.4, { ease: 'sineInOut' });
    await this.tween(p, { t: 1 }, 1.4, {
      ease: 'sineInOut',
      onUpdate: () => {
        this.auto.punkt('orden', this.vorn, ziel);
        o.x = von.x + (ziel.x - von.x) * p.t;
        o.y = von.y + (ziel.y - von.y) * p.t - Math.sin(Math.PI * p.t) * 160;
      },
    });
    // an der Tür festmachen: eine Kopie hängt im Auto (fährt mit), der fliegende Orden verschwindet
    const am = spr('feuerwehr/stern_orden', { parent: this.auto.f.innen, z: 5 });
    am.anchor.set(0.5, 0.08);
    const l = this.auto.lokal('orden');
    am.position.set(l.x, l.y);
    am.scale.set(ORDEN_SKALA);
    am.eventMode = 'none';
    this.ordenAmAuto = am;
    o.visible = false;
    sfx('common/plopp', { vol: 0.5 });
    fx.pop(am, 0.15);
    this.burst('funkeln', ziel.x, ziel.y, { count: 4 });
  }

  // ---------------------------------------------------------------- Aufrollen, Einsteigen, Abfahrt

  aufrollenBeginnt() {
    // Hydrant zudrehen, dann wartet der Schlauch aufs Einrollen
    this.zustand = 'aufrollen';
    this.wasserAn = false;
    this.spritzeAus();
    this.tween(this.rad, { rotation: 0 }, 0.8, { ease: 'sineInOut' });
    this.klack('common/klack', { vol: 0.5 });
    this.schlauchDran = false;
    this.schlauchPunkte();
    this.rollBahn = {
      a: { x: this._a.x, y: this._a.y },
      c: { x: this._c.x, y: this._c.y },
      b: { x: this.kupplung.x, y: this.kupplung.y },
    };
    this.schlauchT = 1;
    this.rollBis = 1;
    const f = this.auto.punkt('fach', this.welt);
    this.fach.position.set(f.x, f.y);
    this.fach.eventMode = 'static';
    this.kupplung.eventMode = 'static';
    this._kupplungTipp?.off();
    this._kupplungTipp = tap(this.kupplung, () => {
      if (this.zustand !== 'aufrollen') return;
      this.rollBis = Math.max(0, this.schlauchT - 0.3);
      this.rollTon();
    }, { sound: null, pad: 110 });
    this.blase('feuerwehr/schlauchrolle');
    this.hinweisSatz('feuerwehr_aufrollen', () => this.zustand === 'aufrollen' && this.schlauchT > 0.95);
  }

  eingerollt() {
    this.fach.eventMode = 'none';
    this.kupplung.eventMode = 'none';
    this._kupplungTipp?.off();
    this._kupplungTipp = null;
    this.rollt = false;
    sfx('common/klack', { vol: 0.6 });
    fx.pop(this.auto.f.rumpf, 0.04);
    this.einsteigenBeginnt();
  }

  einsteigenBeginnt() {
    this.zustand = 'einsteigen';
    this.auto.blaulicht(true);
    this.blase('feuerwehr/feuerwehrauto');
  }

  async abfahren() {
    this.zustand = 'faehrt';
    this.hinweisSatz(null);
    await this.mannschaftSteigtEin();
    const a = this.auto;
    a.tatue(this, 4);
    fx.pop(a.fahrer, 0.1);
    await this.wait(0.5);
    await a.fahre(this, { x: 1900 }, 2.8, 'sineIn');
    a.blaulicht(false);
    this.zustand = 'weg';
    // weiter zum Waschplatz – nur, wenn das Kind noch hier zuschaut
    if (this.aktiv && this.szene.nr === this.index && !this.szene.gleitet) {
      this.szene.waschKommt = true;
      this.szene.zeigeSeite(2);
    } else if (this.aktiv) {
      await this.wait(2.0);
      if (this.aktiv && this.zustand === 'weg') this.neueRunde();
    }
  }

  autoAngetippt(e) {
    // e.x in Koordinaten des Rumpfs (= Körper-Bild relativ zum Anker): hintere Hälfte oben = Leiter
    if (e.x < -60 && e.y < -200 && this.e?.art === 'leiter') {
      this.leiterAngetippt();
      return;
    }
    if (this.zustand === 'einsteigen') {
      this.abfahren();
      return;
    }
    if (this.zustand === 'aufrollen') {
      this.rollBis = Math.max(0, this.schlauchT - 0.3);
      this.rollTon();
      return;
    }
    if (this.zustand === 'faehrt' || this.zustand === 'weg') return;
    this.auto.tatue(this, 3);
    fx.pop(this.auto.fahrer, 0.08);
  }

  // Hinweis-Satz anmelden (der Kern sagt jeden höchstens einmal am Tag) – nur, solange die Seite zu sehen ist und
  // die Bedingung noch gilt; nurWenn wird noch einmal gefragt, wenn der Satz warten muss.
  hinweisSatz(id, bedingung = () => true, verz = 1.5) {
    this._hinweis?.kill();
    this._hinweis = null;
    if (!id) return;
    const zustand = this.zustand;
    const passt = () => this.aktiv && this.zustand === zustand && bedingung();
    this._hinweisNeu = () => this.hinweisSatz(id, bedingung, 2);
    this._hinweis = this.after(verz, () => { if (passt()) voice(id, { nurWenn: passt }); });
  }

  // ---------------------------------------------------------------- Wasserstrahl

  // Der Finger lenkt den Strahl. Ein kurzes Antippen genügt: Der Strahl spritzt dann mindestens MIN_SPRITZEN
  // Sekunden zum Fingerpunkt, und sobald er dort ankommt, löscht ein „Schwall" schon ein gutes Stück des
  // getroffenen Flämmchens (zwei, drei Tipps je Flamme). Festhalten und Ziehen löscht fortlaufend.
  // Bewegen und Loslassen hören direkt am Fenster zu (Pixis globalpointermove ist im Kern abgeschaltet, und Ziele
  // über dem Fänger würden ein pointermove am Fänger abfangen). Ein neuer Finger übernimmt immer – so kann ein
  // verlorener alter Finger (Systemgeste, Handballen, Fenster verliert den Fokus) den Strahl nie festhalten.
  baueStrahl() {
    this.strahl = new Wasserstrahl({ parent: this.welt, z: 35, dicke: 64 });
    this.spritzt = null;            // { id, ruhe } des Fingers, der gerade lenkt (null = kein Finger)
    this.ruhendeId = null;          // Finger, der zu lange stillstand: regt er sich wieder, lenkt er weiter
    this.zielPunkt = new PIXI.Point();   // wohin der Strahl soll (bleibt nach dem Loslassen stehen)
    this.duese = new PIXI.Point();
    this._g = new PIXI.Point();
    this.spritzBis = 0;             // bis zu dieser Seiten-Zeit spritzt es mindestens
    this.schwall = false;           // wartet ein Schwall eines Fingerdrucks darauf, anzukommen?
    this.schwallBis = 0;
    this.tropfenUhr = 0;
    // Fänger hinter allem: wo kein anderes Ding getroffen wird, lenkt der Finger den Strahl
    const f = new PIXI.Container({ label: 'strahlFaenger' });
    f.zIndex = -50;
    f.eventMode = 'static';
    f.hitArea = new PIXI.Rectangle(-1500, 0, 3000, 1600);
    this.welt.addChild(f);
    this.faenger = f;
    f.on('pointerdown', (e) => {
      if (!this.aktiv || this.ankunftLaeuft || this.szene.gleitet) return;
      if (!this.wasserAn) {
        // noch kein Wasser: ein paar Tropfen aus dem Werfer, und der Fuchs denkt an den nächsten Schritt
        if (['schlauch', 'hydrant'].includes(this.zustand) && this.klack('common/plopp', { vol: 0.35 })) {
          this.auto.punkt('duese', this.welt, this.duese);
          this.burst('tropfen', this.duese.x, this.duese.y, { count: 2 });
          this.blase('feuerwehr/hydrant', { sek: 1.6 });
        }
        return;
      }
      this.welt.toLocal(e.global, undefined, this.zielPunkt);
      this.fingerLenkt(e.pointerId, true);
    });
    // Fenster-Hörer: angelegt in betreten(), abgebaut in verlassen() (läuft auch beim Verlassen der Szene)
    this._bewegt = (ev) => {
      if (!this.aktiv || this.welt.destroyed) return;
      const id = ev.pointerId;
      if (this.spritzt?.id !== id) {
        // ein Finger, der nur zu lange stillstand und noch aufliegt, lenkt weiter, sobald er sich regt
        if (id !== this.ruhendeId || !ev.buttons || this.ankunftLaeuft || this.szene.gleitet || !this.wasserAn) return;
      }
      stage.app.renderer.events.mapPositionToPoint(this._g, ev.clientX, ev.clientY);
      this.welt.toLocal(this._g, undefined, this.zielPunkt);
      if (this.spritzt?.id === id) this.spritzt.ruhe = 0;
      else this.fingerLenkt(id, false);
    };
    this._los = (ev) => {
      if (ev.pointerId === this.ruhendeId) this.ruhendeId = null;
      if (this.spritzt && ev.pointerId === this.spritzt.id) this.spritzt = null;   // Strahl endet im Takt
    };
    this._alleLos = () => {
      this.spritzt = null;
      this.ruhendeId = null;
    };
    this._versteckt = () => { if (document.hidden) this._alleLos(); };
    this.lauschtAmFenster = false;
  }

  // Finger `id` lenkt ab jetzt den Strahl (ein neuer Finger übernimmt immer); `druck` = frisch aufgesetzt (Schwall)
  fingerLenkt(id, druck) {
    this.gespritzt = true;   // (für den Hinweis „Zeig mit dem Finger, wohin das Wasser spritzt")
    this.spritzt = { id, ruhe: 0 };
    this.ruhendeId = null;
    this.spritzBis = Math.max(this.spritzBis, this.zeit + MIN_SPRITZEN);
    if (druck) {
      this.schwall = true;
      this.schwallBis = this.zeit + 0.8;
    }
    if (!this.strahl.an) {
      this.auto.punkt('duese', this.welt, this.duese);
      this.strahl.start.x = this.duese.x;
      this.strahl.start.y = this.duese.y;
      this.strahl.setze(true);
      this.wasserTon.an();
      this.spritz('common/spritz', { vol: 0.35 });
    }
  }

  fensterLauschen(an) {
    if (an === this.lauschtAmFenster) return;
    this.lauschtAmFenster = an;
    const w = an ? window.addEventListener : window.removeEventListener;
    w.call(window, 'pointermove', this._bewegt, { passive: true });
    w.call(window, 'pointerup', this._los, { passive: true });
    w.call(window, 'pointercancel', this._los, { passive: true });
    w.call(window, 'blur', this._alleLos);
    (an ? document.addEventListener : document.removeEventListener).call(document, 'visibilitychange', this._versteckt);
  }

  spritzeAus() {
    this.spritzt = null;
    this.schwall = false;
    this.strahl.setze(false);
    this.wasserTon.aus();
  }

  // Sicherheitsnetz, falls doch einmal kein Loslassen ankommt: Liegt kein Finger mehr auf, endet das Lenken.
  // Steht der lenkende Finger lange ganz still, hört der Strahl auf – regt er sich wieder, spritzt es weiter.
  fingerNachsehen(dt) {
    const s = this.spritzt;
    if (!s) return;
    if (pointerCount() === 0) {
      this.spritzt = null;
      return;
    }
    s.ruhe += dt;
    if (s.ruhe > FINGER_RUHE) {
      this.ruhendeId = s.id;
      this.spritzt = null;
    }
  }

  // Ein Flämmchen bekommt Wasser ab: dt Sekunden Dauerstrahl, dazu evtl. der Schwall eines Fingerdrucks
  wasserAuf(f, dt, schwall) {
    f.leben -= dt / LOESCHZEIT + (schwall ? SCHWALL : 0);
    f.dampf -= schwall ? 1 : dt;
    if (f.dampf <= 0) {
      f.dampf = 0.35;
      this.zisch('common/zisch', { vol: 0.45 });
      this.burst('rauch', f.mitte.x + rand(-30, 30), f.mitte.y - 30, { count: schwall ? 2 : 1, groesse: 0.7 });
    }
    if (f.leben <= 0) this.flammeAus(f);
  }

  strahlTakt(dt) {
    const s = this.strahl;
    if (!s.sichtbar) return;
    this.auto.punkt('duese', this.welt, this.duese);
    s.start.x = this.duese.x;
    s.start.y = this.duese.y;
    if (s.an) {
      // Ziel folgt dem Finger weich (kein Zappeln); ganz am Anfang springt es gleich hin
      const k = s.vorn < 0.1 ? 1 : 1 - Math.exp(-dt * 14);
      s.ziel.x += (this.zielPunkt.x - s.ziel.x) * k;
      s.ziel.y += (this.zielPunkt.y - s.ziel.y) * k;
      // Finger weg und Mindestzeit um (oder kein Wasser mehr): Strahl aus
      if ((!this.spritzt && this.zeit >= this.spritzBis) || !this.wasserAn) {
        this.spritzeAus();
      }
    }
    s.update(dt);
    if (!s.trifft) return;
    this.tropfenUhr -= dt;
    if (this.tropfenUhr <= 0) {
      this.tropfenUhr = 0.3;
      this.burst('tropfen', s.ziel.x, s.ziel.y, { count: 2 });
    }
    // Schwall eines neuen Fingerdrucks: wirkt, sobald der Strahl am Fingerpunkt angekommen ist
    let schwall = false;
    if (this.schwall && (s.nahe(this.zielPunkt) || this.zeit > this.schwallBis)) {
      this.schwall = false;
      schwall = true;
    }
    for (const f of this.flammen) {
      if (!f.an || f.groesse < 0.6) continue;
      if (Math.hypot(s.ziel.x - f.mitte.x, s.ziel.y - (f.mitte.y + 10)) > TREFFER) continue;
      this.wasserAuf(f, dt, schwall);
    }
    // ein paar Spritzer auf einen Zuschauer oder Geretteten: er kichert und hüpft
    for (const g of this.zuschauer) {
      const h = g?.[0];
      if (!h || h.destroyed || !h.visible) continue;
      if (Math.hypot(s.ziel.x - h.x, s.ziel.y - (h.y - 110)) < 140) {
        if (this.kicher('common/platsch', { vol: 0.4 })) freue(this, h, { herzen: 2 });
      }
    }
  }

  // ---------------------------------------------------------------- Ablauf

  async ankunft() {
    this.ankunftLaeuft = true;
    const a = this.auto;
    a.f.position.set(-1900, this.autoPlatz.y);
    a.tatue(this, 3.4);
    await a.fahre(this, { x: this.autoPlatz.x }, 2.6, 'sineOut');
    this.ankunftLaeuft = false;
  }

  betreten() {
    this.fensterLauschen(true);
    this.szene.autoKommt = false;
    if (this.zustand === 'start' || this.zustand === 'weg') {
      this.neueRunde();
    } else {
      // bei jedem Betreten anbieten, was gerade zu tun ist
      this._hinweisNeu?.();
    }
    for (const f of this.flammen) if (f.an) this.rauchAn(f);
  }

  verlassen() {
    this._hinweis?.kill();
    this._hinweis = null;
    this.fensterLauschen(false);
    this.ruhendeId = null;
    this.spritzeAus();
    this.wasserTon.weg();
    this.rollt = false;
    for (const f of this.flammen) this.rauchAus(f);
  }

  update(dt) {
    this.zeit += dt;
    this.auto.update(dt);
    this.wolken.update(dt);
    this.vogel.update(dt);
    this.falter.update(dt);
    // Flämmchen wiegen sich sanft
    for (const f of this.flammen) {
      if (!f.s.visible) continue;
      f.phase += dt;
      const g = f.skala * f.groesse * (0.55 + 0.45 * clamp(f.leben / f.vollLeben, 0, 1));
      f.s.scale.set(g * (1 - 0.03 * Math.sin(f.phase * 2.1)), g * (1 + 0.05 * Math.sin(f.phase * 2.1)));
      f.s.skew.x = Math.sin(f.phase * 1.3) * 0.07;
    }
    // Korb hängt an der Leiter-Spitze, Mitfahrer und Ballon fahren mit
    if (this.korb.visible && !this.korbZieht) this.korbAnSpitze();
    if (this.korb.visible) {
      const b = this.korbBoden();
      if (this.reiter && !this.reiter.destroyed) this.reiter.position.set(b.x, b.y - (this.reiterHoch || 0));
      if (this.korbBallon) this.korbBallon.position.set(b.x + 30, b.y - 40);
    }
    this.schlauchTakt(dt);
    this.fingerNachsehen(dt);
    this.strahlTakt(dt);
  }

  hinweise() {
    const auto = this.auto.f.koerper;
    switch (this.zustand) {
      case 'schlauch': return [{ von: this.kupplung, nach: { x: this.hydrantAnschluss.x, y: this.hydrantAnschluss.y } }];
      case 'hydrant': return [this.rad];
      case 'feuer': {
        const an = this.flammen.filter((f) => f.an && f.groesse > 0.5).map((f) => f.s);
        return an.length ? an : [auto];
      }
      case 'leiter': return [this.auto.leiter];
      case 'ausfahren': return this.korb.visible ? [{ von: this.korb, nach: this.korbZiel() }] : [this.auto.leiter];
      case 'runter': return [{ von: this.korb, nach: { x: this.auto.f.x + 60, y: 1150 } }];
      case 'aufrollen': return [{ x: this.fach.x, y: this.fach.y }];
      case 'einsteigen': return [auto];
      // während etwas von selbst läuft: aufs Auto zeigen, nie zum Pfeil der nächsten Seite
      default: return [auto];
    }
  }
}
