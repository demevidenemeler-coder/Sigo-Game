// Seite 1: Gepäck. Vor dem kleinen Flughafen-Haus geben Gäste ihr Gepäck auf – eine Kette in Schritten:
//   1. Ein Gast kommt mit einem Gepäckstück (Koffer, Surfbrett, Vogelkäfig, Teddy, Ball, Geschenk, Rucksack …) und
//      zeigt in der Denkblase, wohin die Reise geht (Meer, Berge, Schnee, Insel).
//   2. Das Gepäck aufs Band ziehen (oder antippen – es hüpft von selbst hinauf).
//   3. Den Schalter antippen: Der Drucker schickt einen Anhänger in der Farbe des Ziels ans Gepäck.
//   4. Den grünen Knopf drücken: Das Band fährt das Gepäck gemächlich durch den Tunnel (der Vogel im Käfig piept,
//      der Tunnel lächelt). Wer den Knopf zu früh drückt, bekommt den Anhänger von selbst.
//   5. Das Gepäck auf den Gepäckwagen ziehen (oder antippen). Der Gast winkt und geht.
//   Nach drei Gepäckstücken (drei Gäste):
//   6. Den kleinen Schlepper antippen (oder ziehen): Er zieht den vollen Wagen hinaus zum Flugzeug, in der Ferne
//      hebt ein Flieger sanft ab, und bald schwebt eine Postkarte vom Ziel an die Pinnwand. Erste ganze Kette: Sticker.
//   Dann kommt der Wagen leer zurück, und neue Gäste kommen. Die Pinnwand bleibt über die Besuche (store).
// Nichts kann schiefgehen: Was daneben fällt, gleitet zurück; Antippen hilft immer weiter.

import { PIXI, spr, meta, tap, drag, fx, sfx, sfxSchleife, note, voice, rand, pick } from '../../engine/index.js';
import { Seite } from '../../gemeinsam/seiten.js';
import { belohne } from '../../gemeinsam/sticker.js';
import {
  bogenFlug, gleite, umhaengen, andersAls, kurz, ZIELE, ZIEL_IDS, postkarte, postkarteDazu, Pinnwand, GaesteReihe,
  neuesTier, leiserLaut, piep, denkBlase,
} from './helfer.js';

const BODEN = 1470;              // Standlinie der Gäste
const GAST_X = -930;
const GAST_SKALA = 0.44;
const DRAUSSEN = -1600;
const ABLAGE_X = -720;           // hier stellt der Gast sein Gepäck ab
const SCHALTER = { x: -590, y: 1330, s: 0.74 };
const BAND = { von: -430, bis: 250, y: 1215 };
const BAND_START = -330;         // hier landet das Gepäck auf dem Band
const BAND_ENDE = 170;           // hier wartet es am Ende
const TUNNEL = { x: -80, y: 1236, s: 0.7 };
const KNOPF = { x: 90, y: 1490 };
const WAGEN = { x: 520, y: 1525, s: 0.85 };
const PLAETZE = [-160, -8, 142];  // Plätze auf dem Wagen (relativ zur Wagenmitte)
const SCHLEPPER = { x: 918, y: 1508, s: 0.56 };
const PRO_WAGEN = 3;
const PINNWAND = { x: -454, y: 552, w: 470, h: 292 };

// Gepäckstücke: Bild, gezeigte Höhe, liegt (Surfbrett liegt flach), kleine Besonderheit
const DINGE = [
  { id: 'koffer', bild: 'flughafen/koffer', h: 190 },
  { id: 'koffer_gelb', bild: 'zug/ladung_koffer', h: 175 },
  { id: 'surfbrett', bild: 'flughafen/surfbrett', h: 270, liegt: true },
  { id: 'kaefig', bild: 'flughafen/vogelkaefig', h: 205, vogel: true },
  { id: 'teddy', bild: 'zug/ladung_teddy', h: 170 },
  { id: 'geschenk', bild: 'zug/ladung_geschenk', h: 160 },
  { id: 'ball', bild: 'zug/ladung_ball', h: 150, huepft: true },
  { id: 'rucksack', bild: 'flughafen/rucksack', h: 180 },
];
// Welche Ziele zu einem Ding passen (sonst alle)
const PASST = { surfbrett: ['meer', 'insel'], ball: ['meer', 'insel'] };

export class Gepaeck extends Seite {
  static hg = 'flughafen/hg_gepaeck';

  aufbau() {
    this.phase = 'leer';
    this.reihe = new GaesteReihe();
    this.ding = null;            // das Gepäckstück, um das es gerade geht
    this.gast = null;
    this.aufWagen = [];          // Gepäck auf dem Wagen
    this.ziele = [];             // Ziele der Gäste dieser Runde
    this.letztesDing = null;
    this.letztesZiel = null;
    this.ketten = 0;
    this.bandZeit = 0;
    this.bandLaeuft = false;
    this.gesagt = new Set();

    this.pinnwand = new Pinnwand(this, PINNWAND, { z: 2 });
    this.baueSchalter();
    this.baueBand();
    this.baueKnopf();
    this.baueWagen();
    this.baueFlecken();
  }

  betreten() {
    this.pinnwand.auffrischen();
    if (this.besuche === 1) {
      voice('flughafen_hallo');
      this.after(0.4, () => this.naechsterGast());
    } else {
      this.hinweis(1.0);
    }
  }

  verlassen() {
    this._hinweis?.kill();
    this._hinweis = null;
    this.bandTon?.aus(0.3);
    this.motor?.aus(0.3);
  }

  update(dt, t) {
    // Band: Rollen drehen sich und die Streifen wandern, solange es läuft
    if (this.bandLaeuft) {
      this.bandZeit += dt;
      for (const r of this.rollen) r.rotation += dt * 3.2;
      this.streifen.x = (this.bandZeit * 70) % 60;
    }
    // Ruhe-Bewegung: der Windsack-Fleck nicht, aber der Tunnel atmet ganz leicht
    this.tunnel.scale.y = TUNNEL.s * (1 + 0.012 * Math.sin(t * 1.6));
    if (this.ringBand) this.ringBand.alpha = this.phase === 'aufsBand' ? 0.55 + 0.25 * Math.sin(t * 2.2) : 0;
  }

  // ---------------------------------------------------------------- Aufbau

  baueSchalter() {
    this.schalter = spr('flughafen/schalter', { x: SCHALTER.x, y: SCHALTER.y, scale: SCHALTER.s, parent: this.welt, z: 8 });
    tap(this.schalter, () => this.schalterTipp(), { sound: null, hitArea: new PIXI.Rectangle(-260, -440, 520, 450) });
    const m = meta('flughafen/schalter');
    const p = m?.pts?.schlitz || [360, 170];
    this.schlitz = {
      x: SCHALTER.x + (p[0] - m.w * m.ax) * SCHALTER.s,
      y: SCHALTER.y + (p[1] - m.h * m.ay) * SCHALTER.s,
    };
  }

  baueBand() {
    const { von, bis, y } = BAND;
    const g = new PIXI.Graphics();
    // Beine
    for (const x of [von + 60, bis - 60]) {
      g.roundRect(x - 18, y + 30, 36, BODEN - 40 - y - 30, 14).fill(0xb9c3cf).stroke({ width: 4, color: 0x8d99a8 });
      g.ellipse(x, BODEN - 40, 40, 12).fill({ color: 0x5a4630, alpha: 0.14 });
    }
    // Rahmen (vorn), weich und rund
    g.roundRect(von - 20, y + 4, bis - von + 40, 66, 33).fill(0x8ccfe0).stroke({ width: 6, color: 0x5fafc6 });
    g.roundRect(von + 10, y + 16, bis - von - 20, 12, 6).fill({ color: 0xffffff, alpha: 0.35 });
    g.zIndex = 10;
    g.eventMode = 'none';
    this.welt.addChild(g);
    // Bandfläche mit wandernden Streifen (Maske hält sie im Band)
    const flaeche = new PIXI.Container();
    flaeche.zIndex = 11;
    const grund = new PIXI.Graphics().roundRect(von - 4, y - 14, bis - von + 8, 26, 13).fill(0x5d6672);
    flaeche.addChild(grund);
    const st = new PIXI.Graphics();
    for (let x = von - 60; x < bis + 60; x += 60) st.roundRect(x, y - 10, 26, 18, 6).fill({ color: 0x7d8794 });
    flaeche.addChild(st);
    const maske = new PIXI.Graphics().roundRect(von - 4, y - 14, bis - von + 8, 26, 13).fill(0xffffff);
    flaeche.addChild(maske);
    st.mask = maske;
    this.streifen = st;
    flaeche.eventMode = 'none';
    this.welt.addChild(flaeche);
    // Rollen an den Enden
    this.rollen = [];
    for (const x of [von + 6, bis - 6]) {
      const r = new PIXI.Graphics();
      r.circle(0, 0, 30).fill(0xf6d36b).stroke({ width: 5, color: 0xd9a93a });
      r.rect(-4, -26, 8, 52).fill(0xd9a93a);
      r.circle(0, 0, 9).fill(0xffffff);
      r.position.set(x, y + 36);
      r.zIndex = 12;
      r.eventMode = 'none';
      this.welt.addChild(r);
      this.rollen.push(r);
    }
    // Tippfläche über das ganze Band: dreht die Rollen kurz
    const fl = new PIXI.Container({ label: 'band' });
    fl.hitArea = new PIXI.Rectangle(von, y - 60, bis - von, 200);
    fl.zIndex = 9;
    tap(fl, () => this.bandTipp(), { sound: null, squash: false });
    this.welt.addChild(fl);
    // weicher Ring: hier aufs Band legen
    this.ringBand = new PIXI.Graphics();
    this.ringBand.ellipse(0, 0, 120, 34).stroke({ width: 8, color: 0xffffff });
    this.ringBand.position.set(BAND_START, y - 4);
    this.ringBand.zIndex = 12;
    this.ringBand.alpha = 0;
    this.ringBand.eventMode = 'none';
    this.welt.addChild(this.ringBand);
    // Tunnel über dem Band (das Gepäck fährt darunter durch)
    this.tunnel = spr('flughafen/tunnel', { x: TUNNEL.x, y: TUNNEL.y, scale: TUNNEL.s, parent: this.welt, z: 14 });
    tap(this.tunnel, () => {
      fx.wobble(this.tunnel, 0.04);
      note('pling', 79, { vol: 0.3 });
    }, { sound: null, squash: false, hitArea: new PIXI.Rectangle(-250, -330, 500, 330) });
  }

  baueKnopf() {
    const c = new PIXI.Container({ label: 'knopf' });
    c.position.set(KNOPF.x, KNOPF.y);
    c.zIndex = 30;
    // kleines Pult mit großem grünem Knopf (ein weißer Pfeil darauf: „los")
    const g = new PIXI.Graphics();
    g.ellipse(0, 4, 110, 22).fill({ color: 0x5a4630, alpha: 0.16 });
    g.roundRect(-95, -120, 190, 124, 30).fill(0xf2e2c4).stroke({ width: 6, color: 0xd8bf94 });
    g.roundRect(-75, -104, 70, 14, 7).fill({ color: 0xffffff, alpha: 0.45 });
    g.roundRect(-60, -60, 120, 30, 15).fill(0xe9d3ab);
    c.addChild(g);
    const dom = new PIXI.Graphics();
    dom.ellipse(0, 10, 74, 26).fill(0x3f9a4a);
    dom.ellipse(0, 0, 70, 48).fill(0x63c46a).stroke({ width: 6, color: 0x3f9a4a });
    dom.ellipse(-24, -18, 22, 11).fill({ color: 0xffffff, alpha: 0.45 });
    dom.roundPoly(6, 2, 24, 3, 6, Math.PI / 2).fill(0xffffff);
    dom.position.set(0, -150);
    c.addChild(dom);
    this.knopfDom = dom;
    c.hitArea = new PIXI.Rectangle(-130, -240, 260, 250);
    tap(c, () => this.knopfTipp(), { sound: null, squash: false });
    this.welt.addChild(c);
    this.knopf = c;
  }

  baueWagen() {
    // Wagen und Schlepper fahren zusammen (ein Container), das Gepäck darauf fährt mit
    const zug = new PIXI.Container({ label: 'gepaeckzug', sortableChildren: true });
    zug.zIndex = 24;
    this.welt.addChild(zug);
    this.zug = zug;
    this.wagen = spr('flughafen/gepaeckwagen', { x: WAGEN.x, y: WAGEN.y, scale: WAGEN.s, parent: zug, z: 1 });
    tap(this.wagen, () => this.wagenTipp(), { sound: null, hitArea: new PIXI.Rectangle(-360, -230, 720, 260) });
    const m = meta('flughafen/gepaeckwagen');
    this.flaecheY = WAGEN.y - (m.h * m.ay - 140) * WAGEN.s;
    this.schlepper = spr('flughafen/schlepper', { x: SCHLEPPER.x, y: SCHLEPPER.y, scale: SCHLEPPER.s, parent: zug, z: 2 });
    tap(this.schlepper, () => this.schlepperTipp(), { sound: null, hitArea: new PIXI.Rectangle(-240, -400, 470, 410) });
  }

  /** Lebendige Kleinigkeiten im Bild: Fenster, Windsack, Turm (Klang und Funkeln). */
  baueFlecken() {
    const flecken = [
      { x: -1060, y: 560, w: 300, h: 360, ton: () => note('glocke', 79, { vol: 0.25 }) },   // Fenster
      { x: 280, y: 630, w: 260, h: 300, ton: () => sfx('common/wusch', { vol: 0.3 }) },     // Windsack
      { x: 1160, y: 560, w: 240, h: 340, ton: () => note('glocke', 86, { vol: 0.25 }) },    // Turm
    ];
    for (const f of flecken) {
      const c = new PIXI.Container({ label: 'fleck' });
      c.position.set(f.x, f.y);
      c.hitArea = new PIXI.Rectangle(-f.w / 2, -f.h / 2, f.w, f.h);
      c.zIndex = 1;
      let zuletzt = 0;
      tap(c, () => {
        const jetzt = performance.now();
        if (jetzt - zuletzt < 700) return;
        zuletzt = jetzt;
        f.ton();
        this.burst('funkeln', f.x, f.y - 30, { count: 4 });
      }, { sound: null, squash: false });
      this.welt.addChild(c);
    }
  }

  // ---------------------------------------------------------------- Stimme

  /** Satz zum jetzigen Schritt (nur solange die Seite zu sehen ist und der Schritt noch dran ist). */
  sag(id, phase, sek = 0.6) {
    this._hinweis?.kill();
    const passt = () => this.aktiv && this.phase === phase;
    this._hinweis = this.after(sek, () => { if (passt()) voice(id, { nurWenn: passt }); });
  }

  hinweis(sek) {
    const satz = {
      aufsBand: 'flughafen_band', anhaenger: 'flughafen_anhaenger', knopf: 'flughafen_knopf',
      amEnde: 'flughafen_wagen', schlepper: 'flughafen_schlepper',
    }[this.phase];
    if (satz) this.sag(satz, this.phase, sek);
  }

  // ---------------------------------------------------------------- Gäste und Gepäck

  async naechsterGast() {
    if (this.phase !== 'leer') return;
    this.phase = 'kommt';
    const id = this.reihe.naechster();
    const a = neuesTier(this, id, { x: DRAUSSEN, y: BODEN, scale: GAST_SKALA, z: 18 });
    a.onTap(() => this.gastTipp(a), { pad: 30 });
    this.gast = a;
    // Gepäck und Ziel: anders als beim vorigen Gast
    const schonDa = new Set(this.aufWagen.map((c) => c.art.id));
    const art = pick(DINGE.filter((d) => d.id !== this.letztesDing && !schonDa.has(d.id)));
    this.letztesDing = art.id;
    const moegliche = PASST[art.id] || ZIEL_IDS;
    const ziel = andersAls(moegliche, this.letztesZiel);
    this.letztesZiel = ziel;
    const d = this.neuesDing(art, ziel, DRAUSSEN + 200);
    this.ding = d;
    const weg = Math.abs(GAST_X - DRAUSSEN);
    const tempo = 380;
    this.tween(d, { x: ABLAGE_X }, weg / tempo, { ease: 'linear' });
    let ok = await a.walkTo(GAST_X, BODEN, { tempo });
    for (let i = 0; !ok && i < 8 && !a.destroyed && this.gast === a; i++) {
      await this.wait(0.4);
      ok = await a.walkTo(GAST_X, BODEN, { tempo });
    }
    if (a.destroyed || this.gast !== a) return;
    a.lookAt(GAST_X + 100);
    if (!d.destroyed) {
      d.x = ABLAGE_X;
      fx.pop(d, 0.06);
      sfx('common/klack', { vol: 0.3 });
    }
    this.zeigeZiel(a, ziel);
    this.phase = 'aufsBand';
    this.hinweis(0.9);
  }

  /** Denkblase mit einer kleinen Postkarte des Ziels (bleibt, bis das Gepäck auf dem Wagen ist). */
  zeigeZiel(a, ziel) {
    this.blaseWeg();
    const b = denkBlase(postkarte(ziel, 190), 330);
    const kopf = a.point('kopf');
    b.position.set(kopf.x + 70, kopf.y + 10);
    b.zIndex = 40;
    b.alpha = 0;
    b.scale.set(0.6);
    b.hitArea = new PIXI.Rectangle(-20, -300, 340, 310);
    tap(b, () => { fx.pop(b.innen, 0.08); ZIELE[ziel].ton(); }, { sound: null, squash: false });
    this.welt.addChild(b);
    this.tween(b, { alpha: 1 }, 0.4, { ease: 'sineInOut' });
    this.tween(b, { scale: 1 }, 0.5, { ease: 'backOut' });
    sfx('common/plopp', { vol: 0.4, rate: 0.9 });
    this.blase = b;
  }

  blaseWeg() {
    const b = this.blase;
    this.blase = null;
    if (!b || b.destroyed) return;
    b.eventMode = 'none';
    this.tween(b, { alpha: 0, scale: 0.85 }, 0.4, { ease: 'sineInOut' }).then(() => { if (!b.destroyed) b.destroy({ children: true }); });
  }

  gastTipp(a) {
    fx.wobble(a, 0.06);
    leiserLaut(a);
    if (this.blase) fx.pop(this.blase.innen, 0.08);
  }

  /** Gepäckstück als Container; Ursprung = Mitte der Unterkante. */
  neuesDing(art, ziel, x) {
    const c = new PIXI.Container({ label: 'gepaeck:' + art.id, sortableChildren: true });
    c.art = art;
    c.ziel = ziel;
    const m = meta(art.bild) || { w: 200, h: 200 };
    const s = art.h / m.h;   // Höhe bzw. (liegend) Länge
    const bild = spr(art.bild, { parent: c, z: 1 });
    if (art.liegt) {
      bild.anchor.set(0.5);
      bild.scale.set(s);
      bild.rotation = -Math.PI / 2;
      bild.y = -(m.w * s) / 2;
      c.breite = m.h * s;
      c.hoehe = m.w * s;
    } else {
      bild.anchor.set(0.5, 1);
      bild.scale.set(s);
      c.breite = m.w * s;
      c.hoehe = m.h * s;
    }
    c.bild = bild;
    c.position.set(x, BODEN);
    c.zIndex = 20;
    c.hitArea = new PIXI.Rectangle(-Math.max(115, c.breite / 2 + 20), -Math.max(220, c.hoehe + 30),
      Math.max(230, c.breite + 40), Math.max(240, c.hoehe + 50));
    this.welt.addChild(c);
    c.ziehen = drag(c, {
      targets: () => this.dingZiele(c),
      onDrop: (z, ctx) => this.dingAbgelegt(c, z, ctx),
    });
    return c;
  }

  dingZiele(c) {
    if (c !== this.ding) return [];
    if (this.phase === 'aufsBand') return [{ id: 'band', x: BAND_START, y: BAND.y - c.hoehe / 2, radius: 320 }];
    if (this.phase === 'amEnde') {
      const p = this.platz();
      return [{ id: 'wagen', x: p.x, y: this.flaecheY - c.hoehe / 2, radius: 360 }];
    }
    return [];
  }

  dingAbgelegt(c, ziel, ctx) {
    if (c !== this.ding) return false;
    const getippt = kurz(ctx);
    if (this.phase === 'aufsBand' && (ziel || getippt)) {
      ctx.erledigt = true;
      this.aufsBand(c);
      return undefined;
    }
    if (this.phase === 'amEnde' && (ziel || getippt)) {
      ctx.erledigt = true;
      this.aufDenWagen(c);
      return undefined;
    }
    // sonst: freundlich zeigen, was jetzt dran ist
    if (getippt) {
      fx.wobble(c, 0.06);
      if (this.phase === 'anhaenger') this.after(0.2, () => fx.pulse(this.schalter));
      if (this.phase === 'knopf') this.after(0.2, () => fx.pulse(this.knopf));
    }
    return false;
  }

  /** Auf das Band: das Gepäck hüpft hinauf. */
  aufsBand(c) {
    this.phase = 'hebt';
    c.eventMode = 'none';
    c.zIndex = 12;
    sfx('common/hupf', { vol: 0.35 });
    bogenFlug(this, c, BAND_START, BAND.y - 2, { dauer: 0.55, hoehe: 140 }).then(() => {
      if (c.destroyed) return;
      c.eventMode = 'static';
      sfx('common/klack', { vol: 0.35 });
      fx.pop(c, 0.06);
      if (this.gast && !this.gast.destroyed) this.gast.nod();
      this.phase = 'anhaenger';
      this.hinweis(0.6);
      if (this.knopfWunsch) { this.knopfWunsch = false; this.knopfTipp(); }
    });
  }

  // ---------------------------------------------------------------- Anhänger

  schalterTipp() {
    fx.wobble(this.schalter, 0.04);
    if (this.phase !== 'anhaenger') {
      note('xylo', 64, { vol: 0.3 });
      if (this.phase === 'aufsBand' && this.ding) this.after(0.2, () => fx.pop(this.ding, 0.08));
      return;
    }
    this.anhaengerDrucken();
  }

  /** Der Drucker schickt den Anhänger ans Gepäck. → Promise (wenn er hängt) */
  anhaengerDrucken() {
    const c = this.ding;
    if (!c || c.destroyed || c.anhaenger) return Promise.resolve();
    this.phase = 'druckt';
    sfx('common/klick', { vol: 0.45 });
    this.after(0.12, () => note('pling', 84, { vol: 0.25 }));
    const a = anhaenger(ZIELE[c.ziel].farbe);
    a.position.set(this.schlitz.x, this.schlitz.y);
    a.scale.set(0.5);
    a.zIndex = 50;
    this.welt.addChild(a);
    const zielJetzt = () => (c.destroyed ? null : { x: c.x + c.breite * 0.32, y: c.y - c.hoehe * 0.72 });
    const z = zielJetzt();
    return bogenFlug(this, a, z.x, z.y, { dauer: 0.7, hoehe: 160, skala: 1, ziel: zielJetzt }).then(() => {
      if (c.destroyed || a.destroyed) return;
      umhaengen(a, c);
      a.zIndex = 5;
      c.anhaenger = a;
      sfx('common/plopp', { vol: 0.5 });
      this.burst('funkeln', c.x + c.breite * 0.3, c.y - c.hoehe * 0.7, { count: 3 });
      fx.wobble(a, 0.12);
      if (this.phase === 'druckt') {
        this.phase = 'knopf';
        this.hinweis(0.5);
      }
    });
  }

  // ---------------------------------------------------------------- Band

  knopfTipp() {
    // Knopf drückt sich sanft hinein
    this.tween(this.knopfDom, { y: -138 }, 0.08, { ease: 'quadOut' })
      .then((ok) => ok && this.tween(this.knopfDom, { y: -150 }, 0.22, { ease: 'sineOut' }));
    sfx('common/klick', { vol: 0.45 });
    if (this.phase === 'anhaenger') {
      // zu früh gedrückt: der Anhänger kommt von selbst, dann fährt das Band
      this.anhaengerDrucken().then(() => this.bandFaehrt());
      return;
    }
    if (this.phase === 'knopf') {
      this.bandFaehrt();
      return;
    }
    if (this.phase === 'hebt') { this.knopfWunsch = true; return; }
    note('xylo', 67, { vol: 0.3 });
    if (this.phase === 'aufsBand' && this.ding) this.after(0.2, () => fx.pop(this.ding, 0.08));
  }

  bandTipp() {
    if (!this.bandLaeuft) {
      for (const r of this.rollen) this.tween(r, { rotation: r.rotation + Math.PI }, 0.6, { ease: 'sineInOut' });
    }
    note('xylo', 60, { vol: 0.25 });
  }

  async bandFaehrt() {
    const c = this.ding;
    if (!c || c.destroyed || this.phase === 'faehrt') return;
    this.phase = 'faehrt';
    c.eventMode = 'none';
    this.bandLaeuft = true;
    if (!this.bandTon) this.bandTon = sfxSchleife('common/motor', { vol: 0.18, rate: 1.4 });
    if (this.aktiv) this.bandTon.an(0.3);
    const tempo = 210;
    const dauer = (BAND_ENDE - c.x) / tempo;
    // in der Mitte des Tunnels: ein heller Klang, der Tunnel lächelt (wackelt), der Vogel piept
    this.after(dauer * 0.5, () => {
      fx.wobble(this.tunnel, 0.04);
      note('pling', 84, { vol: 0.28 });
      if (c.art.vogel) this.after(0.3, () => piep());
    });
    await this.tween(c, { x: BAND_ENDE }, dauer, { ease: 'linear' });
    this.bandLaeuft = false;
    this.bandTon?.aus(0.4);
    if (c.destroyed) return;
    c.eventMode = 'static';
    sfx('common/klack', { vol: 0.3 });
    fx.pop(c, 0.05);
    if (c.art.vogel) piep();
    this.phase = 'amEnde';
    this.hinweis(0.6);
  }

  // ---------------------------------------------------------------- Wagen

  platz() {
    const i = Math.min(this.aufWagen.length, PRO_WAGEN - 1);
    return { x: WAGEN.x + PLAETZE[i], y: this.flaecheY };
  }

  aufDenWagen(c) {
    this.phase = 'laedt';
    c.eventMode = 'none';
    c.zIndex = 30;
    const p = this.platz();
    sfx('common/hupf', { vol: 0.35 });
    bogenFlug(this, c, p.x + this.zug.x, p.y + 4, { dauer: 0.6, hoehe: 150 }).then(async () => {
      if (c.destroyed) return;
      umhaengen(c, this.zug);
      c.zIndex = 3 + this.aufWagen.length;
      c.ziehen?.off();
      this.aufWagen.push(c);
      this.ziele.push(c.ziel);
      sfx('common/klack', { vol: 0.4 });
      fx.pop(c, 0.06);
      c.eventMode = 'static';
      tap(c, () => { fx.wobble(c, 0.06); if (c.art.vogel) piep(); else note('xylo', 69, { vol: 0.25 }); }, { sound: null, squash: false });
      if (c.art.huepft) {
        // der Ball hüpft noch zweimal
        await this.tween(c, { y: p.y - 60 }, 0.22, { ease: 'quadOut' });
        await this.tween(c, { y: p.y + 4 }, 0.22, { ease: 'quadIn' });
        await this.tween(c, { y: p.y - 25 }, 0.16, { ease: 'quadOut' });
        await this.tween(c, { y: p.y + 4 }, 0.16, { ease: 'quadIn' });
      }
      this.ding = null;
      this.gastGeht();
      if (this.aufWagen.length >= PRO_WAGEN) {
        this.phase = 'schlepper';
        this.after(0.6, () => { if (this.phase === 'schlepper') fx.pulse(this.schlepper); });
        this.hinweis(1.2);
      } else {
        this.phase = 'leer';
        this.after(0.9, () => this.naechsterGast());
      }
    });
  }

  /** Der Gast winkt (wiegt sich fröhlich) und geht zurück ins Haus. */
  async gastGeht() {
    const a = this.gast;
    this.gast = null;
    this.blaseWeg();
    if (!a || a.destroyed) return;
    a.pose('happy');
    leiserLaut(a);
    this.burst('herzen', a.x, a.point('kopf').y + 30, { count: 4 });
    await a.hop(60);
    await this.wait(0.3);
    if (a.destroyed) return;
    a.pose('idle');
    await a.walkTo(DRAUSSEN, a.y, { tempo: 400 });
    if (!a.destroyed) a.destroy({ children: true });
  }

  wagenTipp() {
    fx.wobble(this.wagen, 0.03);
    note('xylo', 62, { vol: 0.28 });
    if (this.phase === 'schlepper') this.after(0.2, () => fx.pulse(this.schlepper));
  }

  // ---------------------------------------------------------------- Schlepper, Abflug, Postkarte

  schlepperTipp() {
    if (this.phase !== 'schlepper') {
      fx.wobble(this.schlepper, 0.05);
      note('xylo', 72, { vol: 0.28 });
      return;
    }
    this.abfahrt();
  }

  async abfahrt() {
    this.phase = 'abfahrt';
    this._hinweis?.kill();
    fx.pop(this.schlepper, 0.08);
    sfx('common/hupe', { vol: 0.25 });
    await this.wait(0.5);
    if (!this.motor) this.motor = sfxSchleife('common/motor', { vol: 0.22, rate: 1.1 });
    if (this.aktiv) this.motor.an(0.4);
    // gemächlich hinaus (Spitze unter 700 Einheiten/s)
    await this.tween(this.zug, { x: 1500 }, 3.4, { ease: 'sineIn' });
    this.motor.aus(0.5);
    for (const c of this.aufWagen) if (!c.destroyed) c.destroy({ children: true });
    this.aufWagen = [];
    const ziele = this.ziele;
    this.ziele = [];
    await this.wait(0.2);
    // Der ferne Flieger steigt noch, da schwebt schon die Postkarte herunter – so wartet das Kind nicht lange
    // (zusammen rund 13 s statt 20 s; nie mehr als zwei Bewegungen zugleich).
    const flug = this.fernerAbflug();
    await this.wait(3.0);
    await this.postkarteKommt(pick(ziele.length ? ziele : ZIEL_IDS));
    await flug;
    // der Wagen kommt leer zurück
    this.zug.x = 1500;
    if (this.aktiv) this.motor.an(0.3);
    await this.tween(this.zug, { x: 0 }, 2.4, { ease: 'sineOut' });
    this.motor.aus(0.5);
    fx.pop(this.schlepper, 0.05);
    this.phase = 'leer';
    this.naechsterGast();
  }

  /** In der Ferne rollt ein kleiner Flieger los und hebt sanft ab (hinter dem Grasstreifen). */
  async fernerAbflug() {
    const f = spr('flughafen/flugzeug', { x: 1250, y: 865, scale: 0.17, parent: this.hinten, z: 2 });
    this.fernFlieger = f;
    f.scale.x = -0.17;   // fliegt nach links
    f.eventMode = 'none';
    f.alpha = 0;
    this.tween(f, { alpha: 1 }, 0.6, { ease: 'sineInOut' });
    sfx('common/wusch', { vol: 0.25 });
    await this.tween(f, { x: 640 }, 2.0, { ease: 'sineInOut' });
    this.tween(f, { rotation: 0.16 }, 1.2, { ease: 'sineInOut' });
    await this.tween(f, { x: -300, y: 380 }, 3.2, { ease: 'sineIn' });
    await this.tween(f, { alpha: 0, x: -520, y: 300 }, 0.8, { ease: 'sineInOut' });
    this.fernFlieger = null;
    if (!f.destroyed) f.destroy();
  }

  /** Eine Postkarte schwebt von oben an die Pinnwand (bleibt). Erste ganze Kette: Sticker. */
  async postkarteKommt(ziel) {
    const p = this.pinnwand.naechsterPlatz();
    const k = postkarte(ziel, 300);
    k.position.set(0, -200);
    k.rotation = -0.1;
    k.zIndex = 60;
    k.eventMode = 'none';
    this.welt.addChild(k);
    this.neueKarte = k;
    sfx('common/funkeln', { vol: 0.35 });
    await this.tween(k, { y: 330, rotation: 0.06 }, 1.6, { ease: 'sineOut' });
    if (this.aktiv) voice('flughafen_postkarte', { nurWenn: () => this.aktiv });
    await this.wait(0.8);
    await bogenFlug(this, k, p.x, p.y, { dauer: 1.1, hoehe: 80, skala: this.pinnwand.breite / 300 });
    postkarteDazu(ziel);
    this.pinnwand.auffrischen();
    this.neueKarte = null;
    if (!k.destroyed) k.destroy({ children: true });
    this.burst('funkeln', p.x, p.y, { count: 5 });
    this.ketten++;
    if (this.ketten === 1) belohne(this, 'flughafen_koffer', -150, 520);
    await this.wait(0.3);
  }

  // ---------------------------------------------------------------- Zeige-Hand

  hinweise() {
    const c = this.ding;
    switch (this.phase) {
      case 'aufsBand':
        return c ? [{ von: c, nach: { x: BAND_START, y: BAND.y - 60 } }] : [];
      case 'anhaenger':
        return [this.schalter];
      case 'knopf':
        return [this.knopf];
      case 'amEnde': {
        const p = this.platz();
        return c ? [{ von: c, nach: { x: p.x, y: p.y - 60 } }] : [];
      }
      case 'schlepper':
        return [this.schlepper];
      case 'abfahrt': {
        // Der Wagen ist unterwegs: die Hand zeigt, wo gerade etwas geschieht (Flieger in der Ferne, Postkarte),
        // nicht auf ein Ding, das jetzt nichts tut
        const f = this.fernFlieger;
        if (f && !f.destroyed && f.alpha > 0.5) return [{ x: f.x, y: f.y - 40 }];
        const k = this.neueKarte;
        if (k && !k.destroyed) return [k];
        return this.zug.x < 600 ? [this.schlepper] : [];
      }
      default:
        // Zwischen den Schritten (Gast kommt, Band fährt, Flieger hebt ab): auf das, was gerade geschieht
        if (this.gast && !this.gast.destroyed) return [this.gast];
        return [this.pinnwand.karten[this.pinnwand.karten.length - 1] || this.tunnel];
    }
  }
}

/** Gepäck-Anhänger: Schnur und rundes Schild in der Farbe des Ziels. Ursprung = Befestigung oben. */
function anhaenger(farbe) {
  const c = new PIXI.Container({ label: 'anhaenger' });
  const g = new PIXI.Graphics();
  g.moveTo(0, 0).bezierCurveTo(10, 14, 6, 26, 14, 36).stroke({ width: 5, color: 0x8a6a4a, cap: 'round' });
  g.roundRect(-14, 34, 60, 76, 16).fill(farbe).stroke({ width: 5, color: 0xffffff });
  g.circle(16, 50, 7).fill(0xffffff);
  g.roundRect(-2, 66, 36, 9, 4.5).fill({ color: 0xffffff, alpha: 0.85 });
  g.roundRect(-2, 82, 26, 9, 4.5).fill({ color: 0xffffff, alpha: 0.85 });
  c.addChild(g);
  c.eventMode = 'none';
  return c;
}
