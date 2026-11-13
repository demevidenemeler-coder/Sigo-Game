// Neue Halte der Zugfahrt (Runde 3) – mehr Schritte und mehr Abwechslung, alles ohne „falsch":
//
//   holz      Holzlager (Aufgabe): Die Lok denkt an drei Holzscheite. Das Kind zieht (oder tippt) ein Scheit nach
//             dem anderen zur Lok; jedes Scheit pufft eine Dampfwolke, ein Platz in der Denkblase füllt sich.
//             Nach dem dritten pfeift die Lok fröhlich und fährt weiter. Hebel: Die Scheite hüpfen von selbst.
//   markt     Marktstand (Aufgabe): Ein Tier verkauft drei Leckereien. Die Gäste im Zug denken nacheinander an das,
//             was sie möchten; das Kind zieht (oder tippt) das Passende in den Zug – der Gast isst und freut sich.
//             Etwas anderes hüpft freundlich zurück auf die Theke. Ist niemand im Zug, steigt erst ein Kunde ein.
//   picknick  Picknick am Wegesrand (Zwischen-Station, hält nicht): zwei Tiere auf einer Decke, ein Korb;
//             Korb antippen → eine Leckerei hüpft zu einem Tier, es isst und freut sich.
//   FreundeLeine  Am Ladeplatz hängt eine Leine mit Bildern aller Freunde, die schon etwas geliefert bekommen haben
//             (bleibt über alle Besuche; neue Freunde werden beim nächsten Ladeplatz weich aufgehängt).

import {
  spr, tex, meta, sfx, note, animal, voice, fx, tap, drag, store, hasTex, rand, pick, shuffle, clamp, PIXI,
} from '../../engine/index.js';
import { futterFuer, FUTTER } from '../../gemeinsam/futter.js';
import { Ding, tippbar, flaeche, ruhig } from './hilfen.js';
import { figur, gruss, MENSCHEN } from './stationen.js';
import { bogen, freude, figurBild, figurenUnterwegs } from './auftrag.js';
import { LOK_X, HINTEN_Y, VORNE_Y } from './konst.js';

const { Container, Graphics, Rectangle } = PIXI;

// Eigener Sticker eines Halts; ist er schon im Album, gibt es wie bei den anderen Stationen eine fehlende Lok
const eigenerSticker = (id) => (store.stickers().includes(id) ? 'lok' : id);

/** Wer ist gerade frei (nicht im Zug, an keinem Bahnhof, bei keiner Lieferung)? Aus liste, nie `ohne`. */
function freieFigur(s, liste, ohne = []) {
  const besetzt = figurenUnterwegs(s);
  const frei = liste.filter((id) => !besetzt.has(id) && !ohne.includes(id));
  return pick(frei.length ? frei : liste.filter((id) => !ohne.includes(id)));
}

/** Denkblase (wie am Wasserturm) mit einem Bild-Container: in s.front bei (x, y) – Fuß der Blase. */
function denkblase(s, x, y) {
  const g = new Container({ label: 'denkblase-halt' });
  g.position.set(x, y);
  g.zIndex = 800;
  g.eventMode = 'none';
  s.front.addChild(g);
  spr('common/blase_denk', { anchor: [45 / 600, 540 / 562], scale: 0.5, parent: g });
  g.alpha = 0;
  s.tween(g, { alpha: 1 }, 0.5, { ease: 'sineInOut' });
  return g;
}

function blaseWeg(s, g, nach = 0) {
  s.after(nach, () => {
    if (!g || g.destroyed) return;
    s.tween(g, { alpha: 0 }, 0.6, { ease: 'sineInOut' }).then(() => { if (!g.destroyed) g.destroy({ children: true, context: true }); });
  });
}

// ================================================================ Holzlager (Holz nachlegen)

const HOLZ_X = 640;      // Mitte des Stapels beim Halt (Bildschirm-x)
const SCHEITE = 3;
const SCHEIT_SKALA = 0.58;

export class Holzlager extends Ding {
  constructor(s, linkeKante) {
    super(s, 0);
    this.art = 'holz';
    const id = 'fahrt/holzstapel';
    const skala = 0.9;
    const y = HINTEN_Y - 4;
    this.y = y;
    const c = this.teil(s.ebHinten, y);
    this.c = c;
    this.flug = this.teil(s.ebFlug, 5);   // Scheite liegen über dem Zug (beim Ziehen nichts umhängen)
    this.stapel = spr(id, { x: 0, y, scale: skala, parent: c });
    tippbar(this.stapel, () => this.stapelTipp());
    // Das bereite Scheit liegt vorn auf der Wiese vor dem Stapel (oben auf dem Stapel verschwand es zwischen den
    // gemalten Scheiten – man sah nicht, was man greifen soll)
    this.scheitOrt = { x: -70, y: y + 30 };
    const m = meta(id);
    this.links = -(m.w * m.ax) * skala - 20;
    this.rechts = (m.w * (1 - m.ax)) * skala + 20;
    this.wx = linkeKante - this.links;
    this.da = false;
    this.erledigt = false;
    this.fertig = false;
    this.geladen = 0;       // so viele Scheite sind schon in der Lok
    this.scheit = null;     // das Scheit, das gerade bereitliegt
    this.icons = [];
    this.neuesScheit(false);
  }

  /** Das nächste Scheit rollt aus dem Stapel nach vorn. */
  neuesScheit(weich = true) {
    if (this.tot || this.fertig || this.geladen >= SCHEITE) return;
    const sc = spr('fahrt/holzscheit', {
      x: this.scheitOrt.x, y: this.scheitOrt.y, scale: SCHEIT_SKALA, parent: this.flug, rotation: rand(-0.08, 0.08),
    });
    this.scheit = sc;
    this.ziehen = drag(sc, {
      hitArea: flaeche(sc, { min: 260 }),
      targets: () => [{ obj: this.s.zug.lok.koerper, radius: 380 }],
      onDrop: (z, ctx) => this.ablegen(sc, z, ctx),
    });
    if (weich) {
      sc.alpha = 0;
      sc.scale.set(SCHEIT_SKALA * 0.5);
      this.s.tween(sc, { alpha: 1 }, 0.35, { ease: 'sineInOut' });
      this.s.tween(sc, { scale: SCHEIT_SKALA }, 0.5, { ease: 'backOut' });
      sfx('common/klack', { vol: 0.45 });
    }
  }

  stapelTipp() {
    fx.wobble(this.stapel, 0.02);
    // Am Halt hilft auch ein Tipp auf den Stapel: das bereite Scheit hüpft zur Lok
    if (this.da && !this.fertig && this.scheit && !this.fliegt) {
      this.feuere();
      return;
    }
    if (ruhig(this.stapel, 0.8)) sfx('common/klack', { vol: 0.5 });
  }

  ablegen(sc, ziel, ctx) {
    if (sc !== this.scheit || this.fertig) return false;
    const getippt = Math.hypot(ctx.x - ctx.startX, ctx.y - ctx.startY) < 30;
    if (this.da && (ziel || getippt)) {
      ctx.erledigt = true;
      this.feuere();
      return undefined;
    }
    if (!this.da) fx.wobble(this.stapel, 0.02);
    sfx('common/hupf', { vol: 0.4 });
    return false;   // daneben (oder der Zug ist noch nicht da): zurück auf den Stapel
  }

  /** Das bereite Scheit fliegt in die Lok. */
  feuere() {
    const s = this.s;
    const sc = this.scheit;
    if (!sc || sc.destroyed || this.fliegt || this.fertig) return;
    this.fliegt = true;
    this.scheit = null;
    this.ziehen?.off();
    sc.eventMode = 'none';
    // Ziel: Führerhaus der Lok (dort wird nachgelegt)
    const b = s.inWelt(s.zug.lok.getBounds());
    const zielWelt = { x: b.x + b.w * 0.3, y: b.y + b.h * 0.4 };
    const z = this.flug.toLocal(s.world.toGlobal(zielWelt));
    const weite = Math.hypot(z.x - sc.x, z.y - sc.y);
    sfx('common/hupf', { vol: 0.55 });
    bogen(s, sc, z.x, z.y, { skala: SCHEIT_SKALA * 0.6, dauer: clamp(0.7 + weite / 900, 0.9, 1.6), hoehe: 200, drehen: 0.6 })
      .then((ok) => {
        if (this.tot) return;
        s.tween(sc, { alpha: 0 }, 0.2, { ease: 'sineInOut' }).then(() => { if (!sc.destroyed) sc.destroy(); });
        if (!ok) return;
        const i = this.geladen++;
        sfx('common/plopp', { vol: 0.7 });
        if (!s.zug.destroyed) {
          s.zug.lok.hupf(16);
          const r = s.zug.punktLok('schornstein');
          if (r) fx.burst('rauch', r.x, r.y - 10, { count: 3, parent: s.world, groesse: 1.1 });
        }
        s.after(0.25, () => sfx('common/dampf', { vol: 0.35 }));
        note('glocke', [72, 76, 79][i] ?? 79, { vol: 0.4 });
        const icon = this.icons[i];
        if (icon && !icon.destroyed) {
          icon.tint = 0xffffff;
          s.tween(icon, { alpha: 1 }, 0.5, { ease: 'sineInOut' });
          fx.pop(icon, 0.2);
        }
        this.fliegt = false;
        if (this.geladen >= SCHEITE) this.satt();
        else s.after(0.4, () => this.neuesScheit());
      });
  }

  angekommen() {
    const s = this.s;
    this.da = true;
    sfx('common/gong', { vol: 0.3 });
    // Denkblase über der Lok: drei Scheite, die sich füllen
    const b = s.inWelt(s.zug.lok.getBounds());
    const g = denkblase(s, LOK_X - 40, b.y + 30);
    for (let i = 0; i < SCHEITE; i++) {
      const ic = spr('fahrt/holzscheit', { x: 76 + i * 66, y: -140, scale: 0.28, parent: g });
      ic.tint = 0x8c8c8c;
      ic.alpha = 0.3;
      this.icons.push(ic);
    }
    this.anzeige = g;
    s.after(0.6, () => { if (!this.tot && s.zug.lok) fx.wobble(s.zug.lok.huepfer, 0.02); });
    const passt = () => !this.tot && this.da && this.geladen === 0 && !this.fliegt;
    s.after(1.5, () => { if (passt()) voice('fahrt_holz', { nurWenn: passt }); });
  }

  /** Drei Scheite in der Lok: sie pfeift fröhlich und fährt weiter. */
  satt() {
    if (this.fertig) return;
    const s = this.s;
    this.fertig = true;
    sfx('common/funkeln', { vol: 0.45 });
    if (this.anzeige) fx.pop(this.anzeige, 0.08);
    const b = s.inWelt(s.zug.lok.getBounds());
    fx.burst('funkeln', b.x + b.w / 2, b.y + 40, { count: 6, parent: s.front });
    s.after(0.5, () => { if (!s.zug.destroyed) { s.zug.pfeife(); s.zug.lok.hupf(24); } });
    blaseWeg(s, this.anzeige, 1.3);
    s.after(1.4, () => {
      if (this.tot) return;
      s.belohneEinmal('holz', eigenerSticker('fahrt_holzstapel'), this.c, 0, this.y - 330);
    });
    s.after(2.4, () => {
      if (this.tot) return;
      this.erledigt = true;
      this.da = false;
      s.losfahren();
    });
  }

  haltBei() {
    return this.erledigt ? null : this.wx - HOLZ_X;
  }

  /** Hebel: Die übrigen Scheite hüpfen von selbst in die Lok, dann geht es weiter. */
  weiter() {
    if (this.erledigt) return true;
    if (!this.da) {
      this.erledigt = true;
      return true;
    }
    if (this.auto || this.fertig) return false;
    this.auto = true;
    const schritt = () => {
      if (this.tot || this.fertig) return;
      if (!this.fliegt && this.scheit) this.feuere();
      this.s.after(0.7, schritt);
    };
    schritt();
    return false;
  }

  hinweise() {
    return this.da && !this.fertig && this.scheit && !this.scheit.destroyed ? [this.scheit] : [];
  }

  zerstoere() {
    if (this.anzeige && !this.anzeige.destroyed) this.anzeige.destroy({ children: true, context: true });
    super.zerstoere();
  }
}

// ================================================================ Marktstand (Gäste kaufen ein)

const MARKT_X = 610;     // Mitte des Stands beim Halt (Bildschirm-x)
const WUENSCHE = 3;
const VERKAEUFER = ['hase', 'affe', 'huhn', 'eichhoernchen', 'ente', 'igel', 'fuchs', 'katze', 'maus'];
const MENSCHEN_ESSEN = ['futter_apfel', 'futter_banane', 'futter_brot', 'futter_erdbeere', 'futter_kaese', 'futter_honig'];
const WARE_GROESSE = 108;
let letzterVerkaeufer = null;

/** Was ein Gast gern isst ('common/futter_x') */
function leckereien(id) {
  if (MENSCHEN.has(id)) return MENSCHEN_ESSEN.map((k) => 'common/' + k);
  return futterFuer(id);
}

export class Markt extends Ding {
  constructor(s, linkeKante) {
    super(s, 0);
    this.art = 'markt';
    const id = 'fahrt/marktstand';
    const skala = 0.85;
    const y = HINTEN_Y - 4;
    this.y = y;
    const c = this.teil(s.ebHinten, y);
    this.c = c;
    this.flug = this.teil(s.ebFlug, 5);
    // Verkäufer steht hinter der Theke (zuerst einfügen: der Stand verdeckt seine Beine)
    const vid = freieFigur(s, VERKAEUFER, [letzterVerkaeufer]);
    letzterVerkaeufer = vid;
    const m0 = meta(id);
    const rel = (py) => (py - m0.ay * m0.h) * skala;   // Bildzeile → y relativ zum Fuß des Stands
    this.korbY = y + rel(445);                         // Oberkante der drei Körbe unter der Theke
    this.korbX = [155, 300, 455].map((px) => (px - m0.ax * m0.w) * skala);
    // Kopf genau im Fenster zwischen Dach und Theke (Dachkante ≈ Bildzeile 245)
    this.verkaeufer = figur(vid, { x: 0, y: 0, parent: c, faktor: 1.2 });
    const hoehe = this.verkaeufer.sprite.texture.height * Math.abs(this.verkaeufer.scale.y);
    this.verkaeufer.y = y + rel(195) + hoehe;
    this.verkaeufer.onTap(() => {
      if (ruhig(this.verkaeufer, 0.9)) gruss(s, this.verkaeufer);
      else fx.wobble(this.verkaeufer, 0.05);
    }, { pad: 60 });
    this.fahrgaeste = [{ id: vid }];   // (so taucht er nicht gleichzeitig woanders auf)
    this.stand = spr(id, { x: 0, y, scale: skala, parent: c });
    tippbar(this.stand, () => {
      fx.wobble(this.stand, 0.015);
      if (ruhig(this.stand, 0.8)) sfx('common/klingel', { vol: 0.35 });
    });
    const m = meta(id);
    this.links = -(m.w * m.ax) * skala - 20;
    this.rechts = (m.w * (1 - m.ax)) * skala + 20;
    this.wx = linkeKante - this.links;
    this.da = false;
    this.erledigt = false;
    this.fertig = false;
    this.waren = [];      // Sprites auf der Theke ({bild, id})
    this.wuensche = [];   // [{w (Wagen oder null = Lok), ware}]
    this.k = 0;           // nächster Wunsch
    this.blasenZeit = 0;
  }

  /** Kurz bevor der Stand ins Bild kommt: Wünsche festlegen und die passenden Leckereien auf die Theke legen. */
  richteEin() {
    const s = this.s;
    this.eingerichtet = true;
    const gaeste = s.zug.wagen.filter((w) => w.gast && !s.reserviert.has(w.index));
    this.gaesteIds = gaeste.map((w) => w.gastId);
    // Wünsche: abwechselnd die Gäste (ohne Gast denkt die Lok an etwas Leckeres – oder es steigt erst ein Kunde ein)
    const waren = [];
    const nimm = (liste) => {
      const frei = liste.filter((x) => !waren.includes(x) && hasTex(x));
      const alle = FUTTER.map((k) => 'common/' + k).filter((x) => !waren.includes(x) && hasTex(x));
      return pick(frei.length ? frei : alle);
    };
    for (let i = 0; i < WUENSCHE; i++) {
      const w = gaeste.length ? gaeste[i % gaeste.length] : null;
      const ware = nimm(w ? leckereien(w.gastId) : MENSCHEN_ESSEN.map((k) => 'common/' + k));
      waren.push(ware);
      this.wuensche.push({ w, ware, gastId: w ? w.gastId : null });
    }
    // auf der Theke: in gemischter Folge
    // in den drei Körben unter der Theke (so bleibt der Verkäufer hinter der Theke gut zu sehen)
    shuffle([...waren]).forEach((ware, i) => {
      const mm = meta(ware);
      const sk = WARE_GROESSE / Math.max(mm.w, mm.h);
      const b = spr(ware, { x: this.korbX[i], y: this.korbY - WARE_GROESSE * 0.3, scale: sk, anchor: 0.5, parent: this.flug });
      b.ware = ware;
      b.ruhe = sk;
      const eintrag = { bild: b, ware, weg: false };
      drag(b, {
        hitArea: new Rectangle(-105 / sk, -125 / sk, 210 / sk, 230 / sk),
        targets: () => this.zugZiele(),
        onDrop: (z, ctx) => this.ablegen(eintrag, z, ctx),
      });
      this.waren.push(eintrag);
    });
  }

  zugZiele() {
    const zug = this.s.zug;
    return [
      { obj: zug.lok.koerper, radius: 380 },
      ...zug.wagen.map((w) => ({ obj: w.fahrzeug.koerper, radius: 380 })),
    ];
  }

  aktuell() {
    return this.wuensche[this.k] || null;
  }

  ablegen(e, ziel, ctx) {
    if (e.weg || this.fertig) return false;
    const getippt = Math.hypot(ctx.x - ctx.startX, ctx.y - ctx.startY) < 30;
    const wunsch = this.aktuell();
    if (this.da && !this.busy && wunsch && wunsch.ware === e.ware && (ziel || getippt)) {
      ctx.erledigt = true;
      this.gib(e);
      return undefined;
    }
    if (this.da && (ziel || getippt) && wunsch) {
      // Etwas anderes: kein „falsch" – es gleitet ganz ruhig in seinen Korb zurück (kein Wackeln, kein Ton), der
      // Gast denkt noch einmal an seinen Wunsch, und das Gewünschte wippt einladend.
      this.zeigeWunsch();
      this.lade(wunsch);
      return false;
    }
    sfx('common/hupf', { vol: 0.4 });
    return false;
  }

  /**
   * Das Gewünschte lädt ein: es wippt sanft und liegt zuoberst – die Tippflächen der Körbe überlappen sich, so
   * erwischt ein Finger zwischen zwei Körben eher das Gewünschte.
   */
  lade(wu, wippen = true) {
    const e = wu && this.waren.find((x) => !x.weg && x.ware === wu.ware);
    if (!e || e.bild.destroyed) return;
    this.flug.addChild(e.bild);
    if (!wippen || !ruhig(e.bild, 3)) return;
    const p = fx.pulse(e.bild, { staerke: 0.1 });
    this.s.after(2.8, () => p.stop());   // zwei sanfte Atemzüge, dann Ruhe
  }

  /** Denkblase des Gasts, der gerade an der Reihe ist (ohne Gast: die Lok). */
  zeigeWunsch() {
    const s = this.s;
    const wu = this.aktuell();
    if (!wu || this.busy) return;
    this.blasenZeit = 8;
    this.lade(wu, false);
    // große Denkblase über dem Gast (die Blase der Figur selbst wäre im halb so großen Zug zu klein)
    if (this.blase && !this.blase.destroyed) {
      if (this.blase.alpha > 0.6 && this.blase.wunsch === wu) {
        fx.pop(this.blase, 0.08);   // steht noch da: nur kurz anstupsen
        return;
      }
      this.blase.destroy({ children: true, context: true });
    }
    const a = wu.w && wu.w.gast && !wu.w.gast.destroyed ? wu.w.gast : null;
    const b = s.inWelt((a || s.zug.lok).getBounds());
    const g = a ? denkblase(s, b.x + b.w * 0.62, b.y + 20) : denkblase(s, LOK_X - 40, b.y + 30);
    const mm = meta(wu.ware);
    spr(wu.ware, { x: 142, y: -140, scale: 150 / Math.max(mm.w, mm.h), anchor: 0.5, parent: g });
    if (a) fx.wobble(a, 0.05);
    g.wunsch = wu;
    this.blase = g;
    blaseWeg(s, g, 4.5);
  }

  /** Die Leckerei fliegt zum Gast (bzw. zur Lok). */
  gib(e) {
    const s = this.s;
    const wu = this.aktuell();
    if (!wu || e.weg || this.busy) return;
    this.busy = true;
    e.weg = true;
    if (this.blase && !this.blase.destroyed) blaseWeg(s, this.blase, 0);
    const b = e.bild;
    b.eventMode = 'none';
    const a = wu.w && wu.w.gast && !wu.w.gast.destroyed && wu.w.gastId === wu.gastId ? wu.w.gast : null;
    let zielWelt;
    if (a) {
      const g = s.inWelt(a.getBounds());
      zielWelt = { x: g.x + g.w / 2, y: g.y + g.h * 0.35 };
    } else {
      const g = s.inWelt(s.zug.lok.getBounds());
      zielWelt = { x: g.x + g.w * 0.7, y: g.y + g.h * 0.45 };
    }
    const z = this.flug.toLocal(s.world.toGlobal(zielWelt));
    const weite = Math.hypot(z.x - b.x, z.y - b.y);
    sfx('common/hupf', { vol: 0.55 });
    bogen(s, b, z.x, z.y, { skala: b.ruhe * 0.7, dauer: clamp(0.7 + weite / 900, 0.9, 1.7), hoehe: 190, drehen: 0.2 })
      .then((ok) => {
        if (this.tot) return;
        s.tween(b, { alpha: 0, scale: b.ruhe * 0.2 }, 0.3, { ease: 'quadIn' }).then(() => { if (!b.destroyed) b.destroy(); });
        if (!ok) { this.busy = false; return; }
        sfx('common/mampf', { vol: 0.8 });
        if (a && !a.destroyed) {
          if (!a.mensch) a.pose('eat');
          s.after(0.6, () => { if (!s.zug.destroyed && wu.w) s.zug.gaesteJubeln(wu.w.index); });
        } else if (!s.zug.destroyed) {
          s.zug.lok.hupf(20);
          s.after(0.5, () => { if (!s.zug.destroyed) s.zug.pfeife(); });
        }
        note('glocke', [76, 79, 84][this.k] ?? 84, { vol: 0.35 });
        this.k++;
        s.after(this.auto ? 0.6 : 1.4, () => {   // mit dem Hebel geht es etwas zügiger
          if (this.tot) return;
          this.busy = false;
          if (this.k >= this.wuensche.length) this.dank();
          else this.zeigeWunsch();
        });
      });
  }

  angekommen() {
    const s = this.s;
    this.da = true;
    if (!this.eingerichtet) this.richteEin();
    sfx('common/gong', { vol: 0.3 });
    gruss(s, this.verkaeufer);
    // Niemand im Zug? Dann steigt erst ein Kunde ein – er möchte etwas kaufen
    if (!this.gaesteIds.length) {
      const idx = s.freierSitz();
      if (idx >= 0) {
        const id = s.wartenderGast();
        s.zug.setzeGast(idx, id);
        const w = s.zug.wagen[idx];
        for (const wu of this.wuensche) {
          wu.w = w;
          wu.gastId = id;
        }
        // Wünsche passend zum neuen Kunden
        const passend = shuffle(leckereien(id).filter((x) => hasTex(x)));
        this.wuensche.forEach((wu, i) => {
          const neu = passend[i];
          const e = this.waren.find((x) => x.ware === wu.ware);
          if (!neu || !e || this.waren.some((x) => x.ware === neu)) return;
          const mm = meta(neu);
          e.bild.texture = tex(neu);
          const sk = WARE_GROESSE / Math.max(mm.w, mm.h);
          e.bild.scale.set(sk);
          e.bild.ruhe = sk;
          e.ware = neu;
          wu.ware = neu;
        });
      }
    }
    s.after(1.3, () => { if (!this.tot && this.da) this.zeigeWunsch(); });
    const passt = () => !this.tot && this.da && this.k === 0 && !this.busy;
    s.after(2.6, () => { if (passt()) voice('fahrt_markt', { nurWenn: passt }); });
  }

  /** Alle haben etwas bekommen: Der Verkäufer freut sich, der Zug fährt weiter. */
  dank() {
    if (this.fertig) return;
    const s = this.s;
    this.fertig = true;
    freude(s, this.verkaeufer);
    s.after(0.4, () => sfx('common/klingel', { vol: 0.4 }));
    s.after(1.2, () => {
      if (this.tot) return;
      s.belohneEinmal('markt', eigenerSticker('fahrt_marktstand'), this.c, 0, this.y - 470);
    });
    s.after(2.6, () => {
      if (this.tot) return;
      this.erledigt = true;
      this.da = false;
      if (!s.zug.destroyed) s.zug.pfeife();
      s.losfahren();
    });
  }

  haltBei() {
    return this.erledigt ? null : this.wx - MARKT_X;
  }

  /** Hebel: Die übrigen Wünsche erfüllen sich von selbst, dann geht es weiter. */
  weiter() {
    if (this.erledigt) return true;
    if (!this.da) {
      this.erledigt = true;
      return true;
    }
    if (this.auto || this.fertig) return false;
    this.auto = true;
    const schritt = () => {
      if (this.tot || this.fertig) return;
      const wu = this.aktuell();
      if (wu && !this.busy) {
        const e = this.waren.find((x) => !x.weg && x.ware === wu.ware);
        if (e) this.gib(e);
      }
      this.s.after(0.4, schritt);
    };
    schritt();
    return false;
  }

  update(dt, sx) {
    if (!this.eingerichtet && sx < this.s.W / 2 + 150) this.richteEin();
    if (!this.da || this.fertig || this.busy) return;
    this.blasenZeit -= dt;
    if (this.blasenZeit <= 0) this.zeigeWunsch();
  }

  hinweise() {
    if (!this.da || this.fertig || this.busy) return [];
    const wu = this.aktuell();
    const e = wu && this.waren.find((x) => !x.weg && x.ware === wu.ware);
    return e && !e.bild.destroyed ? [e.bild] : [];
  }

  zerstoere() {
    if (this.blase && !this.blase.destroyed) this.blase.destroy({ children: true, context: true });
    super.zerstoere();
  }
}

// ================================================================ Picknick (Zwischen-Station)

const PICKNICK_Y = 1420;   // Decke liegt in der vorderen Reihe zwischen Gleisbett und Gras
const PICKNICK_TIERE =['hase', 'baer', 'igel', 'eichhoernchen', 'fuchs', 'ente', 'maus', 'katze', 'hund', 'schwein'];
let letztesPicknick = [];

export class Picknick extends Ding {
  constructor(s, linkeKante) {
    super(s, 0);
    this.art = 'picknick';
    // in der vorderen Reihe (vor dem Gleis): hinter dem Gleis verdeckte der Zug das Picknick, sobald es neben ihm
    // war – man sah es nur 2 s lang, und die Tiere wirkten wie Gäste im Zug
    this.sperrtHinten = false;
    const y = PICKNICK_Y;
    this.y = y;
    const c = this.teil(s.ebVorne, VORNE_Y);
    this.c = c;
    this.flug = this.teil(s.ebFlug, 4);
    // Decke: rotes Oval mit weißen Tupfen (liegt flach auf der Wiese)
    const decke = new Graphics()
      .ellipse(6, y + 7, 235, 44).fill({ color: 0x3a2a1a, alpha: 0.12 })
      .ellipse(0, y, 235, 44).fill(0xe4675c)
      .ellipse(0, y - 4, 218, 37).fill(0xec7b6e);
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2;
      decke.ellipse(Math.cos(a) * 145, y - 4 + Math.sin(a) * 22, 15, 6).fill({ color: 0xffffff, alpha: 0.75 });
    }
    decke.ellipse(0, y - 4, 18, 8).fill({ color: 0xffffff, alpha: 0.75 });
    c.addChild(decke);
    this.decke = decke;
    // Zwei Tiere, nicht dieselben wie beim letzten Picknick
    const a1 = freieFigur(s, PICKNICK_TIERE, letztesPicknick);
    const a2 = freieFigur(s, PICKNICK_TIERE, [...letztesPicknick, a1]);
    letztesPicknick = [a1, a2];
    this.fahrgaeste = [{ id: a1 }, { id: a2 }];
    this.tiere = [
      figur(a1, { x: -150, y: y - 6, parent: c, faktor: 1.05 }),
      figur(a2, { x: 150, y: y - 6, parent: c, faktor: 1.05 }),
    ];
    this.tiere[1].flip = true;
    for (const t of this.tiere) {
      t.zIndex = 2;
      t.onTap(() => {
        if (ruhig(t, 0.9)) freude(s, t);
        else fx.wobble(t, 0.06);
      }, { pad: 70 });
    }
    // Korb in der Mitte
    this.korb = spr('common/icon_korb', { x: 0, y: y - 60, scale: 0.3, parent: c });
    this.korb.zIndex = 3;
    tippbar(this.korb, () => this.korbTipp(), { min: 250 });
    this.links = -300;
    this.rechts = 300;
    this.wx = linkeKante - this.links;
    this.vorneBelegt = true;
    this.nr = 0;
  }

  korbTipp() {
    const s = this.s;
    fx.wobble(this.korb, 0.06);
    if (!ruhig(this.korb, 1.3)) return;
    this.getippt = true;
    const t = this.tiere[this.nr++ % 2];
    if (!t || t.destroyed) return;
    const ware = pick(futterFuer(t.tierId).filter((x) => hasTex(x)));
    if (!ware) return;
    const mm = meta(ware);
    const sk = 90 / Math.max(mm.w, mm.h);
    const b = spr(ware, { x: this.korb.x, y: this.korb.y - 40, scale: sk, parent: this.flug });
    b.eventMode = 'none';
    const tb = s.inWelt(t.getBounds());
    const z = this.flug.toLocal(s.world.toGlobal({ x: tb.x + tb.w / 2, y: tb.y + tb.h * 0.4 }));
    sfx('common/hupf', { vol: 0.5 });
    bogen(s, b, z.x, z.y, { skala: sk * 0.8, dauer: 0.8, hoehe: 140, drehen: 0.2 }).then((ok) => {
      if (b.destroyed) return;
      s.tween(b, { alpha: 0, scale: sk * 0.2 }, 0.3, { ease: 'quadIn' }).then(() => { if (!b.destroyed) b.destroy(); });
      if (!ok || this.tot || t.destroyed) return;
      sfx('common/mampf', { vol: 0.7 });
      t.pose('eat');
      s.after(0.7, () => { if (!t.destroyed && !this.tot) freude(s, t); });
    });
  }

  update(dt, sx) {
    // Wenn der Zug vorbeikommt, winken beide einmal
    if (!this.gewinkt && sx < LOK_X + 250) {
      this.gewinkt = true;
      this.tiere.forEach((t, i) => this.s.after(i * 0.4, () => gruss(this.s, t, { laut: i === 0 })));
    }
  }

  hinweise() {
    return this.getippt ? [] : [this.korb];
  }
}

// ================================================================ Freunde-Leine (am Ladeplatz, wächst über Besuche)

const LEINE_PLAETZE = 10;
const LEINE_ABSTAND = 104;
const RAHMEN_R = 48;
const LEINE_Y = 1336;            // Höhe der Pfosten-Köpfe (vor dem Gleisbett)
const BILD_Y = LEINE_Y + 64;     // Mitte der Bilder

/** Nach einer Lieferung: der Empfänger kommt auf die Freunde-Leine (jeder einmal, höchstens zehn). */
export function merkeFreund(id) {
  const liste = store.get('fahrt.freunde', []);
  const l = Array.isArray(liste) ? liste.filter((x) => typeof x === 'string') : [];
  if (l.includes(id) || l.length >= LEINE_PLAETZE) return false;
  l.push(id);
  store.set('fahrt.freunde', l);
  return true;
}

function freundeListe() {
  const l = store.get('fahrt.freunde', []);
  return Array.isArray(l) ? l.filter((x) => typeof x === 'string' && hasTex(figurBild(x))).slice(0, LEINE_PLAETZE) : [];
}

export class FreundeLeine {
  /** ding = Ladeplatz; x0 = linker Pfosten (relativ zu ding.wx) */
  constructor(s, ding, x0) {
    this.s = s;
    this.ding = ding;
    const c = ding.teil(s.ebVorne, VORNE_Y);
    this.c = c;
    this.x0 = x0;
    const x1 = x0 + (LEINE_PLAETZE + 1) * LEINE_ABSTAND;
    this.links = x0 - 40;
    this.rechts = x1 + 40;
    // Pfosten und Leine (leicht durchhängend)
    const g = new Graphics();
    for (const x of [x0, x1]) {
      g.roundRect(x - 13, LEINE_Y - 12, 26, VORNE_Y - LEINE_Y + 2, 10).fill(0xb7834e);
      g.roundRect(x - 13, LEINE_Y - 12, 9, VORNE_Y - LEINE_Y + 2, 6).fill({ color: 0xffffff, alpha: 0.15 });
      g.circle(x, LEINE_Y - 14, 17).fill(0xd6a46c);
    }
    const pts = [];
    for (let i = 0; i <= 24; i++) {
      const k = i / 24;
      pts.push(x0 + (x1 - x0) * k, LEINE_Y - 4 + Math.sin(k * Math.PI) * 26);
    }
    g.moveTo(pts[0], pts[1]);
    for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]);
    g.stroke({ width: 5, color: 0xf2e4c4 });
    c.addChild(g);
    this.leineY = (x) => LEINE_Y - 4 + Math.sin(((x - x0) / (x1 - x0)) * Math.PI) * 26;
    // Plätze: leere Rahmen (blasse Kreise) – je Freund ein Bild
    this.plaetze = [];
    for (let i = 0; i < LEINE_PLAETZE; i++) {
      const x = x0 + (i + 1) * LEINE_ABSTAND;
      const p = new Container({ label: 'freund' + i });
      p.position.set(x, this.leineY(x) + 2);
      const leer = new Graphics()
        .circle(0, BILD_Y - LEINE_Y, RAHMEN_R).fill({ color: 0xffffff, alpha: 0.28 })
        .circle(0, BILD_Y - LEINE_Y, RAHMEN_R).stroke({ width: 4, color: 0xffffff, alpha: 0.45 })
        .roundRect(-7, -8, 14, 26, 5).fill(0xd6a46c);   // Klammer
      p.addChild(leer);
      c.addChild(p);
      this.plaetze.push({ c: p, x, bild: null, id: null });
    }
    this.gezeigt = 0;
    const liste = freundeListe();
    const schon = clamp(Math.floor(store.get('fahrt.freundeGezeigt', 0)) || 0, 0, liste.length);
    for (let i = 0; i < schon; i++) this.haengeAuf(i, liste[i], false);
    this.gezeigt = schon;
    this.pruefZeit = 0;
    // eine Tippfläche für die ganze Leine: es freut sich das Bild, das dem Finger am nächsten ist
    const f = new Container({ label: 'freunde-leine' });
    c.addChild(f);
    tap(f, (ctx) => this.tipp(ctx), {
      sound: null, squash: false, hitArea: new Rectangle(x0 - 30, LEINE_Y - 70, x1 - x0 + 60, 230),
    });
    this.flaeche = f;
  }

  haengeAuf(i, id, weich) {
    const p = this.plaetze[i];
    if (!p || p.bild) return;
    const s = this.s;
    const bild = new Container({ label: 'bild:' + id });
    bild.position.set(0, BILD_Y - LEINE_Y);
    bild.addChild(new Graphics()
      .circle(3, 4, RAHMEN_R + 2).fill({ color: 0x3a2a1a, alpha: 0.14 })
      .circle(0, 0, RAHMEN_R + 2).fill(0xbf8752)
      .circle(0, 0, RAHMEN_R - 4).fill(0xfff6e2));
    const tid = figurBild(id);
    const mm = meta(tid);
    const sk = ((RAHMEN_R - 8) * 2) / Math.max(mm.w, mm.h);
    spr(tid, { x: 0, y: 0, scale: sk, anchor: 0.5, parent: bild });
    bild.addChild(new Graphics().roundRect(-7, -RAHMEN_R - 12, 14, 24, 5).fill(0xd6a46c));
    p.c.addChild(bild);
    p.bild = bild;
    p.id = id;
    if (weich) {
      bild.alpha = 0;
      bild.scale.set(0.4);
      s.tween(bild, { alpha: 1 }, 0.5, { ease: 'sineInOut' });
      s.tween(bild, { scale: 1 }, 0.6, { ease: 'backOut' });
      this.laut(p);
      s.after(0.4, () => {
        if (bild.destroyed) return;
        const g = s.front.toLocal(bild.getGlobalPosition());
        fx.burst('herzen', g.x, g.y - 40, { count: 3, parent: s.front });
      });
    }
  }

  laut(p) {
    if (MENSCHEN.has(p.id)) sfx('common/hupf', { vol: 0.5 });
    else if (p.id) animal(p.id);
  }

  tipp(ctx) {
    let best = null;
    let bestD = Infinity;
    for (const p of this.plaetze) {
      const d = Math.abs(p.x - ctx.x);
      if (d < bestD) { bestD = d; best = p; }
    }
    if (!best) return;
    fx.wobble(best.c, 0.08);
    if (!best.bild) {
      if (ruhig(this.c, 0.5)) sfx('common/klack', { vol: 0.4 });
      return;
    }
    if (!ruhig(best.c, 0.8)) return;
    this.laut(best);
    note('glocke', 72 + (this.plaetze.indexOf(best) % 6) * 2, { vol: 0.3 });
  }

  /** Jedes Bild: neue Freunde aufhängen, sobald die Leine gut zu sehen ist. */
  update(dt, sx) {
    this.pruefZeit -= dt;
    // Erst, wenn die Ladung im Zug ist (ruhiger Moment): Beim Ankommen grüßt schon der Absender, denkt an den
    // Empfänger und die Stimme erklärt das Laden – ein Bild mit Tierlaut und Satz dazu wäre zu viel auf einmal.
    // Das gilt auch, wenn der Zug danach gerade anfährt (die Leine ist dann noch zu sehen); sonst am nächsten Mal.
    const lief = this.ding.lief;
    this.ruhe = lief && lief.geladen && (this.ding.da || this.s.stehtBei === null) ? (this.ruhe || 0) + dt : 0;
    if (this.pruefZeit > 0 || this.haengt || this.ruhe < 1.6) return;
    this.pruefZeit = 0.5;
    const s = this.s;
    const links = sx + this.x0;
    const rechts = sx + this.rechts;
    if (links < -s.W / 2 + 100 || rechts > s.W / 2 - 100 + 400) return;
    const liste = freundeListe();
    if (liste.length <= this.gezeigt) return;
    const i = this.gezeigt++;
    store.set('fahrt.freundeGezeigt', this.gezeigt);
    this.haengt = true;
    this.haengeAuf(i, liste[i], true);
    if (!this.angesagt) {
      this.angesagt = true;
      const passt = () => !this.ding.tot;
      s.after(1.0, () => { if (passt()) voice('fahrt_freunde', { nurWenn: passt }); });
    }
    s.after(1.4, () => { this.haengt = false; });
  }

  /** Hinweis: das zuletzt aufgehängte Bild, solange es neu ist */
  neuestes() {
    const p = this.plaetze[this.gezeigt - 1];
    return p && p.bild && !p.bild.destroyed ? p.bild : null;
  }
}
