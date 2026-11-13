// Seite 1: die Eisdiele – eine Bestellung als kleine Kette.
//   1. Ein Tier kommt herein und zeigt in der Denkblase sein Wunsch-Eis: Waffel oder Becher, Kugeln, Toppings.
//   2. Gefäß wählen: Waffel oder Becher auf dem Wagen antippen → es hüpft in den Halter.
//   3. Kugeln: Eiswanne antippen → der Portionierer taucht ein, eine Kugel hüpft hinauf (höchstens drei).
//   4. Toppings: Kirsche, Sahne, Streusel, Soße antippen → sie landen obendrauf.
//   5. Servieren: fertiges Eis zum Tier ziehen oder klingeln → es schleckt (Becher: manchmal mit Waffelröllchen).
//   6. Bezahlen: das Tier legt eine Münze (manchmal zwei) auf die Theke – in die Kasse ziehen oder antippen.
//      Die Münzen stapeln sich neben der Kasse; ist der Turm voll, gibt es einen noch fehlenden Sticker der Eisdiele
//      (sind alle gesammelt: ein ruhiger Freuden-Moment mit Funkeln und drei Glockentönen).
//   7. Das Tier winkt, sein Bild kommt an die Kunden-Wand, und es geht. Das nächste kommt.
// Nichts kann schiefgehen: Wer gleich eine Wanne antippt, bekommt das gewünschte Gefäß von selbst; jedes Eis
// schmeckt (passt es genau: besonders große Freude). Antippen einer Kugel/eines Toppings nimmt es wieder herunter.

import { PIXI, spr, tap, drag, fx, sfx, note, voice, pick, clamp, killTweensOf } from '../../engine/index.js';
import { Seite, hgPunkt } from '../../gemeinsam/seiten.js';
import { belohne, stickerFuerOrt } from '../../gemeinsam/sticker.js';
import {
  Eis, SORTEN, TOPPINGS, TOPPING_BILD, TOPPING_Z, MAX_KUGELN, KUGEL_SKALA, neuerWunsch, miniEis,
} from './eis.js';
import { Kundschaft } from './kunden.js';
import { KundenWand, belohneZiel } from './girlanden.js';
import {
  waffelHalter, toppingWagen, schale, Vogel, Schmetterling, bildFleck, bogenFlug, umhaengen,
} from './deko.js';
import { partyHut, kerze, geburtstagsLied } from './stieleis.js';

const WANNE_X = [-110, 120, 350, 580, 810];   // die Punkte wanne1…5 liegen zu weit rechts (Pfeil, Rand)
const WANNE_SKALA = 0.62;
const HALTER_X = -340;
const KUNDE_X = -850;                          // Punkt 'kunde' liegt halb außerhalb des Tablet-Bildes
const KUNDE_SKALA = 0.62;
const WAGEN = { x: 270, y: 1300, breite: 1580 };
const STAPEL_X = { becher: -410, waffel: -190 };
const TOPPING_X = { kirsche: 30, sahne: 250, streusel: 470, sosse: 690 };
const GLOCKE_X = 910;
const KASSE_X = -895;                          // ganz im Kernbereich (ab x=-1066 auf jedem Bildschirm zu sehen)
const KASSE_SKALA = 0.62;
const TURM_X = -1008;                          // Münzturm links neben der Kasse (rechts ist Platz für die Wunschblase)
const TURM_VOLL = 6;
const MUENZ_X = [-660, -550];                  // hier legt das Tier seine Münzen ab
const MUENZE_SKALA = 0.45;
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
    this.bedient = false;     // ein Tier schleckt gerade
    this.zahlt = false;       // ein Tier wartet darauf, dass seine Münzen in die Kasse kommen
    this.eis = null;          // das Eis im Halter (null = noch kein Gefäß gewählt)
    this.wunsch = null;
    this.letzterWunsch = null;
    this.blase = null;
    this.runde = 0;
    this.ketten = 0;          // ganz geschaffte Bestellungen (bis zum Bezahlen)
    this.muenzen = [];        // Münzen auf der Theke
    this.turm = [];           // Münzen im Turm
    this.letzteKlingel = 0;
    this.gekugelt = false;    // schon einmal eine Kugel geholt (dann kein Hinweis mehr auf die Eis-Schalen)
    this.gewaehlt = false;    // schon einmal ein Gefäß gewählt
    this._hinweis = null;
    this.sticker = stickerFuerOrt('eisdiele').find((s) => s.id === 'eisdiele_waffel')?.id || 'eisdiele_waffel';

    this.baueHalter();
    this.baueWannen();
    this.baueWagen();
    this.baueKasse();
    this.wand = new KundenWand(this, { von: -60, bis: 560, y: 292, durchhang: 22, plaetze: 4, z: 3 });
    this.kunde = new Kundschaft(this, {
      x: KUNDE_X, y: this.bodenY, scale: KUNDE_SKALA, z: 4,   // hinter dem Eis, das es bekommt
      onTipp: () => { if (this.mini) fx.pop(this.mini, 0.1); },
      kleinDx: -195,
    });

    // kleine lebendige Nebensachen
    this.vogel = new Vogel(this, { x: -105, y: 540, farbe: 0x9fd0ee, flip: true, z: 2 });
    this.falter = new Schmetterling(this, {
      // nur über freier Wand (nicht über Eis, Wunschblase, Wannen, Kunden-Wand); unter den Spieldingen
      orte: [{ x: 880, y: 620 }, { x: 650, y: 250 }, { x: 160, y: 640 }, { x: -620, y: 700 }], z: 2,
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

  /** Hinweis für den ersten Schritt anmelden (der Kern sagt ihn höchstens einmal am Tag): erst „Waffel oder
   *  Becher?", danach „Tipp auf eine Eis-Schale" – nur, solange die Seite zu sehen ist und das Kind es noch nicht tat. */
  hinweisAnmelden(sek) {
    this._hinweis?.kill();
    this._hinweis = null;
    if (!this.gewaehlt && !this.eis) {
      const passt = () => this.aktiv && !this.eis && !this.gewaehlt;
      this._hinweis = this.after(sek, () => { if (passt()) voice('eisdiele_gefaess', { nurWenn: passt }); });
      return;
    }
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
    this.halter = h;
    this.eisOrt = { x: HALTER_X, y: this.theke - 160 };
  }

  /** Halter ein-/ausblenden (ein Becher steht ohne Halter auf der Theke). */
  halterZeigen(an) {
    for (const g of [this.halter.hinten, this.halter.vorn]) this.tween(g, { alpha: an ? 1 : 0 }, 0.3, { ease: 'sineInOut' });
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

    // Gefäße: ein Becher-Paar und ein Waffel-Becher (Waffeln stecken in einem kleinen Topf)
    this.stapel = {};
    const becher = new PIXI.Container({ label: 'gefaess:becher', sortableChildren: true });
    becher.position.set(STAPEL_X.becher, WAGEN.y + 4);
    spr('eisdiele/becher', { scale: 0.4, x: -34, y: -10, parent: becher, z: 0 }).tint = 0xeedede;
    spr('eisdiele/becher', { scale: 0.45, x: 18, y: 0, parent: becher, z: 1 });
    const waffel = new PIXI.Container({ label: 'gefaess:waffel', sortableChildren: true });
    waffel.position.set(STAPEL_X.waffel, WAGEN.y + 4);
    [[-24, -132, -0.16], [24, -132, 0.16], [0, -150, 0]].forEach(([x, y, r], i) => {
      spr('eisdiele/waffel', { anchor: 0.5, scale: 0.46, x, y, rotation: r, parent: waffel, z: i });
    });
    const topf = new PIXI.Graphics();
    topf.ellipse(0, 2, 78, 14).fill({ color: 0x5a4630, alpha: 0.14 });
    topf.roundRect(-66, -78, 132, 80, 26).fill(0xaadfc8).stroke({ width: 5, color: 0x7cc0a4 });
    topf.roundRect(-72, -86, 144, 22, 11).fill(0xf4a6b6).stroke({ width: 4, color: 0xdc8296 });
    topf.roundRect(-50, -60, 34, 9, 4.5).fill({ color: 0xffffff, alpha: 0.4 });
    topf.zIndex = 5;
    waffel.addChild(topf);
    for (const [art, c] of [['becher', becher], ['waffel', waffel]]) {
      c.hitArea = new PIXI.Rectangle(-110, -250, 220, 270);
      c.zIndex = 15;
      tap(c, () => this.gefaessTipp(art), { sound: null });
      this.welt.addChild(c);
      this.stapel[art] = c;
    }

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
      c.hitArea = new PIXI.Rectangle(-108, -200, 216, 230);
      tap(c, () => this.toppingTipp(name), { sound: null });
      this.welt.addChild(c);
      this.schalen[name] = c;
    }

    this.glocke = spr('eisdiele/glocke_theke', { scale: 0.62, x: GLOCKE_X, y: WAGEN.y + 4, parent: this.welt, z: 15 });
    tap(this.glocke, () => this.klingeln(), { sound: null, hitArea: new PIXI.Rectangle(-180, -330, 360, 360) });
  }

  baueKasse() {
    this.kasse = spr('eisdiele/kasse', { scale: KASSE_SKALA, x: KASSE_X, y: this.theke + 2, parent: this.welt, z: 3 });
    const sch = hgPunkt(this.kasse, 'eisdiele/kasse', 'schlitz') || { x: KASSE_X + 60, y: this.theke - 130 };
    this.schlitz = { x: sch.x, y: sch.y };
    tap(this.kasse, () => this.kasseTipp(), { sound: null, hitArea: new PIXI.Rectangle(-170, -380, 340, 390) });
    // Münzturm: ein flacher Teller, auf dem sich die Münzen stapeln
    const t = new PIXI.Container({ label: 'muenzturm', sortableChildren: true });
    t.position.set(TURM_X, this.theke);
    t.zIndex = 2;                                // knapp hinter der Kasse
    const teller = new PIXI.Graphics();
    teller.ellipse(0, 2, 56, 12).fill({ color: 0x5a4630, alpha: 0.16 });
    teller.ellipse(0, -4, 52, 13).fill(0xf6c3cf).stroke({ width: 4, color: 0xe3a0b2 });
    teller.ellipse(-12, -7, 20, 4).fill({ color: 0xffffff, alpha: 0.4 });
    t.addChild(teller);
    t.hitArea = new PIXI.Rectangle(-120, -190, 200, 210);
    tap(t, () => {
      for (const m of this.turm) fx.wobble(m, 0.06);
      note('glocke', 88, { vol: 0.25 });
    }, { sound: null, squash: false });
    this.welt.addChild(t);
    this.turmC = t;
  }

  // ---------------------------------------------------------------- Gefäß

  gefaessTipp(art) {
    const st = this.stapel[art];
    const e = this.eis;
    if (e && (!e.leer || this.flug > 0 || this.toppingFlug.size > 0)) {
      // es entsteht schon ein Eis: freundliches Wackeln, nichts geht verloren
      fx.wobble(e, 0.04);
      note('xylo', 64, { vol: 0.3 });
      return;
    }
    if (e && e.art === art) {
      fx.pop(e, 0.06);
      note('xylo', 67, { vol: 0.3 });
      return;
    }
    if (e) this.eisZurueck(e);
    fx.pop(st, 0.06);
    this.neuesEis(art);
  }

  /** Leeres Gefäß (anderes gewählt): fliegt auf den Wagen zurück und verschwindet dort sanft. */
  eisZurueck(e) {
    e.ziehen?.off();
    e.eventMode = 'none';
    if (this.eis === e) this.eis = null;
    const st = this.stapel[e.art];
    bogenFlug(this, e, st.x, st.y - 130, { dauer: 0.5, hoehe: 120, skala: 0.55 })
      .then(() => (e.destroyed ? false : this.tween(e, { alpha: 0 }, 0.25, { ease: 'sineInOut' })))
      .then(() => { if (!e.destroyed) e.destroy({ children: true }); });
  }

  /** Neues Gefäß fliegt vom Wagen in den Halter. → das Eis */
  neuesEis(art) {
    this.gewaehlt = true;
    const st = this.stapel[art];
    const e = new Eis(art);
    e.position.set(st.x, st.y - (art === 'becher' ? 160 : 140));
    e.scale.set(0.6);
    e.zIndex = 5;
    this.welt.addChild(e);
    this.eis = e;
    this.halterZeigen(art === 'waffel');
    sfx('common/hupf', { vol: 0.35 });
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
      heim: () => this.eisOrt,
      onDrop: (ziel, ctx) => {
        if (ziel) return this.servieren(e) ? undefined : false;
        // kaum bewegt = angetippt: die angetippte Kugel bzw. das Topping hüpft zurück (das Eis gleitet heim)
        if (Math.hypot(ctx.x - ctx.startX, ctx.y - ctx.startY) < 40) this.eisTipp(e);
        return undefined;
      },
    });
    e.eventMode = 'none';   // erst greifbar, wenn es im Halter steht
    e.unterwegs = true;
    bogenFlug(this, e, this.eisOrt.x, this.eisOrt.y, { dauer: 0.6, hoehe: 150, skala: 1 }).then(() => {
      if (e.destroyed) return;
      e.unterwegs = false;
      if (e !== this.eis) return;
      e.eventMode = 'static';
      sfx('common/plopp', { vol: 0.5 });
      fx.pop(e, 0.05);
      if (!this.gekugelt) this.hinweisAnmelden(0.6);
      this.nachLandung();
    });
    return e;
  }

  /** Noch kein Gefäß, aber schon eine Wanne/ein Topping angetippt: das gewünschte Gefäß kommt von selbst. */
  sicherEis() {
    return this.eis || this.neuesEis(this.wunsch?.gefaess || 'waffel');
  }

  // ---------------------------------------------------------------- Eis

  zielKunde() {
    const a = this.kunde?.actor;
    if (!a || !this.kunde.bereit || this.bedient || this.zahlt) return [];
    const m = a.point('mouth');
    return [{ id: 'kunde', x: m.x, y: m.y - 80, radius: 430 }];
  }

  kugelHolen(wanne) {
    this.gekugelt = true;  // das Kind hat losgelegt: kein Hinweis mehr auf die Eis-Schalen
    const e = this.sicherEis();
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
    // Ziel folgt dem Gefäß: fliegt es noch oder zieht das Kind es weg, landet die Kugel trotzdem darauf
    const zielJetzt = () => (e.destroyed ? null : this.welt.toLocal(e.toGlobal(platz)));
    const ziel = zielJetzt();
    const skala = () => KUGEL_SKALA * Math.abs(e.scale.x || 1);
    bogenFlug(this, k, ziel.x, ziel.y, { dauer: 0.5, hoehe: 170, skala: skala(), ziel: zielJetzt }).then(() => {
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
      this.vielleichtGeben(e);
      this.nachLandung();
    });
  }

  /** Ist das Eis so, wie es sich das Tier wünscht: „Gib das Eis dem Tier" (nicht, wenn das Kind es schon tut). */
  vielleichtGeben(e) {
    const w = this.wunsch;
    if (!w || !this.kunde.bereit || e.anzahl < w.kugeln.length || e.fehlendesTopping(w)) return;
    voice('eisdiele_geben', {
      nurWenn: () => this.aktiv && e === this.eis && !this.bedient && !this.zahlt && !this.servierWunsch && e.anzahl > 0
        && !e.ziehen?.isDragging(),
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

  /** Welches Teil (Kugel/Topping) liegt unter dem Griffpunkt? → {obj, weg()} oder null (= Gefäß) */
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
    const grenze = e.art === 'becher' ? 30 : -60;   // darunter liegt das Gefäß selbst
    return bestes && (g.y < grenze || !e.kugeln.length) && abstand < 140 ? bestes : null;
  }

  /** Eis angetippt: das Teil unter dem Finger kommt herunter; auf dem Gefäß selbst nur ein freundliches Wackeln. */
  eisTipp(e) {
    if (e !== this.eis) return;
    const teil = this.teilUnter(e);
    if (teil) {
      teil.weg();
      return;
    }
    // Gefäß: kleiner Klang, und die Klingel zeigt sich, wenn schon Eis drauf ist
    note('xylo', 67, { vol: 0.3 });
    if (e.anzahl && this.kunde.bereit) this.after(0.2, () => fx.pop(this.glocke, 0.08));
  }

  kugelWeg(e, k) {
    if (e !== this.eis) return;
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
    const e = this.sicherEis();
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
    const zielJetzt = () => (e.destroyed ? null : this.welt.toLocal(e.toGlobal(p)));
    const ziel = zielJetzt();
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
      // Streusel rieseln ein wenig
      if (name === 'streusel') {
        const o = this.welt.toLocal(e.toGlobal({ x: p.x, y: p.y - 30 }));
        this.burst('konfetti', o.x, o.y, { count: 5 });
      }
      this.vielleichtGeben(e);
      this.nachLandung();
    });
  }

  toppingWeg(e, name) {
    if (e !== this.eis) return;
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
    if (this.zahlt && this.muenzen.length) {
      this.after(0.2, () => fx.pop(this.muenzen[0], 0.1));
      return;
    }
    if (!this.eis) {
      this.leerHinweis();
      return;
    }
    if (this.eis.ziehen?.isDragging()) return;
    if (this.kunde.bereit && !this.bedient) this.servieren(this.eis);
  }

  /** Leeres Eis (oder Kugel noch unterwegs): das Tier zeigt freundlich auf seinen Wunsch. */
  leerHinweis() {
    if (this.mini) fx.pop(this.mini, 0.12);
    this.kunde.laut();
    if (!this.eis) {
      const st = this.stapel[this.wunsch?.gefaess || 'waffel'];
      this.after(0.3, () => fx.pop(st, 0.08));
      return;
    }
    const sorte = this.wunsch ? this.eis.fehlendeSorte(this.wunsch) : null;
    const w = sorte && this.wannen.find((x) => x.sorte === sorte);
    if (w) this.after(0.3, () => fx.pop(w, 0.08));
  }

  /** Eis an den Kunden geben. → true, wenn es losgeht */
  servieren(e) {
    if (this.bedient || this.zahlt || !this.kunde.bereit || e !== this.eis) return false;
    if (this.flug > 0 || this.toppingFlug.size > 0 || e.unterwegs) {
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
    if (!this.servierWunsch || this.flug > 0 || this.toppingFlug.size > 0 || this.eis?.unterwegs) return;
    this.servierWunsch = false;
    this.after(0.25, () => {
      if (this.eis && !this.eis.ziehen?.isDragging()) this.servieren(this.eis);
    });
  }

  async schlecken(e) {
    const a = this.kunde.actor;
    // Dieses Tier ist bedient: es nimmt bis zum Gehen kein zweites Eis mehr an (auch nicht in der Pause nach dem
    // Bezahlen). Erst der nächste Kunde wartet wieder (Kundschaft.kommt setzt bereit).
    this.kunde.bereit = false;
    this.gast = a;            // das bediente Tier (bis es gegangen ist)
    const passt = !!this.wunsch && e.stimmt(this.wunsch);
    e.ziehen?.off();
    e.eventMode = 'none';
    e.zIndex = 7;             // vor dem Halter-Ring
    this.wunsch = null;
    this.runde++;
    this.blaseWeg();
    // Der Halter ist frei: das nächste Gefäß darf schon gewählt werden
    this.eis = null;
    this.halterZeigen(true);
    // kleine Überraschung: ein Becher bekommt manchmal ein Waffelröllchen geschenkt
    if (e.art === 'becher' && Math.random() < 0.5) {
      const k = e.kante();
      const r = spr('eisdiele/waffelroellchen', { anchor: 0.5, scale: 0.05, x: 40, y: k + 40, rotation: -0.9, parent: e, z: 20 });
      sfx('common/plopp', { vol: 0.45, rate: 1.2 });
      await this.tween(r, { scale: 0.55 }, 0.4, { ease: 'backOut' });
      const o = this.welt.toLocal(e.toGlobal({ x: 40, y: k + 20 }));
      this.burst('funkeln', o.x, o.y, { count: 4 });
      await this.wait(0.4);
    }
    if (a.destroyed) return;
    // Geburtstag: eine Kerze steckt im Eis, das Tier pustet sie aus, ein leises Lied
    const geburtstag = this.geburtstag === a;
    if (geburtstag) {
      const k = kerze();
      k.position.set(e.anzahl ? 0 : 30, e.kante() + 26);
      k.scale.set(0.01);
      k.zIndex = 30;
      e.addChild(k);
      sfx('common/plopp', { vol: 0.4, rate: 1.2 });
      await this.tween(k, { scale: 0.9 }, 0.45, { ease: 'backOut' });
      await this.wait(0.7);
      if (a.destroyed || e.destroyed) return;
      sfx('common/zisch', { vol: 0.3 });
      this.tween(k.flamme, { alpha: 0 }, 0.6, { ease: 'sineInOut' });
      const f = this.welt.toLocal(k.toGlobal({ x: 0, y: -100 }));
      this.burst('rauch', f.x, f.y, { count: 2 });
      await this.wait(0.5);
      await this.wait(geburtstagsLied(this));
      if (a.destroyed || e.destroyed) return;
    }
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
    const teile = e.children.filter((t) => t !== e.waffel).sort((p, q) => q.zIndex - p.zIndex || p.y - q.y);
    for (const t of teile) {
      this.tween(t, { alpha: 0, scale: t.scale.x * 0.55 }, 0.35, { ease: 'sineInOut' });
      await this.wait(0.32);
    }
    await this.tween(e, { alpha: 0, scale: s * 0.6 }, 0.35, { ease: 'sineInOut' });
    e.destroy({ children: true });
    a.pose('idle');
    await this.kunde.freut(passt || geburtstag, a);
    if (this.geburtstag === a) this.geburtstag = null;
    await this.wait(0.2);
    this.bedient = false;
    await this.bezahlen(a);
    if (a.destroyed) return;
    this.ketten++;
    const kopf = a.point('kopf');
    if (this.ketten === 1) belohne(this, this.sticker, kopf.x + 160, kopf.y - 60);
    await this.wand.dazu(a.tierId, kopf.x, kopf.y);
    await this.kunde.geht();
    await this.naechsterKunde(0.3);
  }

  // ---------------------------------------------------------------- Bezahlen

  /** Das Tier legt eine Münze (manchmal zwei) auf die Theke und wartet, bis sie in der Kasse sind. → Promise */
  bezahlen(a) {
    if (!a || a.destroyed) return Promise.resolve();
    this.zahlt = true;
    const n = this.ketten >= 1 && Math.random() < 0.3 ? 2 : 1;
    this.offen = n;
    const fertig = new Promise((res) => { this._bezahlt = res; });
    for (let i = 0; i < n; i++) this.after(i * 0.5, () => this.muenzeLegen(a, MUENZ_X[i]));
    const passt = () => this.aktiv && this.muenzen.length > 0 && !this.muenzen.some((m) => m.ziehen?.isDragging());
    this.after(1.1, () => { if (passt()) voice('eisdiele_muenze', { nurWenn: passt }); });
    return fertig.then(() => { this.zahlt = false; });
  }

  muenzeLegen(a, x) {
    if (a.destroyed) return;
    const mund = a.point('mouth');
    const m = spr('eisdiele/muenze', { anchor: 0.5, scale: 0.15, x: mund.x, y: mund.y, parent: this.welt, z: 40 });
    m.eventMode = 'none';
    sfx('common/hupf', { vol: 0.35 });
    const y = this.theke - 166 * MUENZE_SKALA * 0.5 - 2;
    bogenFlug(this, m, x, y, { dauer: 0.6, hoehe: 160, skala: MUENZE_SKALA }).then(() => {
      if (m.destroyed) return;
      sfx('common/klack', { vol: 0.35, rate: 1.3 });
      fx.pop(m, 0.08);
      this.muenzen.push(m);
      const r = 105 / MUENZE_SKALA;   // Greiffläche gut 200 Einheiten
      m.ziehen = drag(m, {
        hitArea: new PIXI.Circle(0, 0, r),
        targets: () => [{ id: 'kasse', x: this.schlitz.x, y: this.schlitz.y + 60, radius: 320 }],
        onStart: () => note('glocke', 91, { vol: 0.2 }),
        onDrop: (ziel, ctx) => {
          const getippt = Math.hypot(ctx.x - ctx.startX, ctx.y - ctx.startY) < 40;
          if (!ziel && !getippt) return undefined;   // gleitet zurück
          ctx.erledigt = true;
          this.muenzeRein(m);
          return undefined;
        },
      });
    });
  }

  muenzeRein(m) {
    m.ziehen?.off();
    m.eventMode = 'none';
    this.muenzen = this.muenzen.filter((x) => x !== m);
    m.zIndex = 40;
    const s = this.schlitz;
    bogenFlug(this, m, s.x, s.y - 50, { dauer: 0.45, hoehe: 90, skala: 0.32 }).then(() => {
      if (m.destroyed) return false;
      return this.tween(m, { y: s.y + 10, alpha: 0 }, 0.3, { ease: 'sineIn' });
    }).then(() => {
      if (!m.destroyed) m.destroy();
      // „Kling-klong": die Kasse hüpft, zwei helle Töne, ein paar Funkel am Schlitz
      fx.pop(this.kasse, 0.06);
      note('glocke', 84, { vol: 0.35 });
      this.after(0.16, () => note('glocke', 91, { vol: 0.35 }));
      this.burst('funkeln', s.x, s.y - 20, { count: 3 });
      this.turmDazu();
      this.offen = Math.max(0, (this.offen || 0) - 1);
      if (!this.offen) this.after(0.5, () => this._bezahlt?.());
    });
  }

  /** Eine Münze mehr im Turm; ist er voll: Belohnung (belohneZiel), und die Münzen hüpfen nacheinander in die Kasse. */
  turmDazu() {
    const i = this.turm.length;
    const g = new PIXI.Graphics();
    g.roundRect(-36, -8, 72, 16, 8).fill(0xe0a020);
    g.ellipse(0, -8, 36, 11).fill(0xffd34a).stroke({ width: 3, color: 0xe8a92a });
    g.ellipse(-10, -11, 12, 3).fill({ color: 0xffffff, alpha: 0.5 });
    g.position.set(i % 2 ? 3 : -3, -12 - i * 15);
    g.zIndex = i + 1;
    g.scale.set(0.2);
    g.eventMode = 'none';
    this.turmC.addChild(g);
    this.turm.push(g);
    this.tween(g, { scale: 1 }, 0.35, { ease: 'backOut' });
    sfx('common/klack', { vol: 0.3, rate: 1.5 });
    if (this.turm.length >= TURM_VOLL) this.after(0.5, () => this.turmVoll());
  }

  async turmVoll() {
    const alle = this.turm;
    this.turm = [];
    // ein noch fehlender Sticker der Eisdiele – sonst ein ruhiger Freuden-Moment über dem Turm
    belohneZiel(this, 'eisdiele_kasse', TURM_X + 120, this.theke - 300);
    await this.wait(1.0);
    const s = this.schlitz;
    for (const g of alle.reverse()) {
      if (g.destroyed) continue;
      umhaengen(g, this.welt);
      g.zIndex = 40;
      bogenFlug(this, g, s.x, s.y - 30, { dauer: 0.45, hoehe: 80, skala: 0.5 })
        .then(() => { if (!g.destroyed) g.destroy(); note('glocke', 86, { vol: 0.2 }); });
      await this.wait(0.22);
    }
    this.after(0.4, () => fx.pop(this.kasse, 0.06));
  }

  kasseTipp() {
    fx.pop(this.kasse, 0.05);
    note('glocke', 84, { vol: 0.3 });
    if (this.muenzen.length) this.after(0.2, () => fx.pop(this.muenzen[0], 0.12));
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
    const w = neuerWunsch(this.runde === 0, this.letzterWunsch);
    this.letzterWunsch = w;
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
    // Schwanz der Blase knapp über dem Kopf; die Blase steht zwischen Kasse und Waffelhalter (verdeckt weder das Eis
    // noch Kasse und Münzturm) und unter der Markise
    b.position.set(HALTER_X - 120 - 330, Math.max(kopf.y - 30, 470));
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
    this.vielleichtGeburtstag(a);
  }

  /** Überraschung: Ab der dritten Runde hat ein Gast manchmal Geburtstag (Partyhütchen; nie zweimal hintereinander). */
  vielleichtGeburtstag(a) {
    const fest = this.runde >= 2 && !this.letztesMalGeburtstag && Math.random() < 0.2;
    this.letztesMalGeburtstag = fest;
    if (!fest) return;
    this.geburtstag = a;
    this.after(0.4, () => partyHut(this, a));
    const p = () => this.aktiv && this.geburtstag === a && !this.bedient;
    this.after(0.9, () => { if (p()) voice('eisdiele_geburtstag', { nurWenn: p }); });
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
    if (this.muenzen.length) return [{ von: this.muenzen[0], nach: { x: this.schlitz.x, y: this.schlitz.y } }];
    const e = this.eis;
    const w = this.wunsch;
    const wartet = w && this.kunde.bereit && !this.bedient && !this.zahlt;
    // Kundenwechsel (oder das Tier schleckt noch): die Hand führt nicht schon zu einem Gefäß, das sich das nächste
    // Tier vielleicht gar nicht wünscht. Sie zeigt auf das Tier, das gerade hereinkommt, sonst auf die neue Karte an
    // der Kunden-Wand (beides antippbar) – so lockt sie in der kurzen Pause nicht zum Blätter-Pfeil.
    if (!wartet) {
      if (this.bedient || this.zahlt) return [];
      const neu = this.kunde.actor;
      if (neu && !neu.destroyed && neu !== this.gast) return [neu];
      const karte = this.wand.karten[this.wand.karten.length - 1];
      return karte && !karte.destroyed ? [karte] : [];
    }
    if (!e) return [this.stapel[w.gefaess]];
    if (e.unterwegs) return [];
    // noch leeres, aber anderes Gefäß im Halter: zuerst das gewünschte Gefäß (es tauscht sich von selbst)
    if (e.leer && e.art !== w.gefaess) return [this.stapel[w.gefaess]];
    const sorte = e.fehlendeSorte(w);
    if (sorte && e.anzahl < MAX_KUGELN) return [this.wannen.find((x) => x.sorte === sorte)];
    const top = e.fehlendesTopping(w);
    if (top) return [this.schalen[top]];
    if (e.anzahl) return [{ von: e.waffel, nach: this.kunde.actor }, this.glocke];
    return [pick(this.wannen)];
  }
}

