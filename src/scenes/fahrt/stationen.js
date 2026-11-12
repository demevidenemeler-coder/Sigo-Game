// Die „Stationen" der Zugfahrt – kommen in loser, gemischter Folge an der Strecke vorbei:
//   apfel      Apfelbaum: Tipp → Äpfel hüpfen in den Zug, die Gäste freuen sich
//   bahnhof    kleiner Bahnhof: Zug hält, Fahrgast mit Luftballon steigt ein / Gast steigt aus
//   tunnel     Berg vor dem Zug, drinnen wird es weich etwas dunkler, Pfiff
//   bruecke    Xylophon-Brücke: Die Lok spielt über 8 Stäbe eine Tonleiter; Stäbe auch antippbar
//   tier       Kuh/Schaf auf dem Gleis: Zug hält, Tipp oder Pfiff → es hüpft auf die Wiese
//   uebergang  Bahnübergang: Schranken schließen weich, ein Auto wartet und hupt
//   wasch      Waschbogen: Schaumbläschen, danach ein leises Funkeln
//   ballons    Luftballons am Wegrand: Tipp → weiches Plopp

import {
  spr, tex, meta, localPoint, sfx, note, animal, voice, fx, tap, Actor, rand, randInt, pick, clamp, store, PIXI,
} from '../../engine/index.js';
import { GAESTE_TIERE, GAESTE_MENSCHEN } from '../../gemeinsam/zug.js';
import { Ding, tippbar, ruhig } from './hilfen.js';
import { GLEIS_Y, LOK_X, HINTEN_Y, VORNE_Y } from './konst.js';

const { Container, Graphics, Rectangle } = PIXI;

// Eigener Sticker einer Station; ist er schon im Album, gibt es wie früher eine fehlende Lok ('lok')
const eigenerSticker = (id) => (store.stickers().includes(id) ? 'lok' : id);

export const STATION_ARTEN = ['apfel', 'bahnhof', 'tunnel', 'bruecke', 'tier', 'uebergang', 'wasch', 'ballons'];

/** Station bauen: linkeKante = Landschafts-x, ab dem sie Platz hat. */
export function neueStation(szene, art, linkeKante) {
  switch (art) {
    case 'apfel': return new Apfelbaum(szene, linkeKante);
    case 'bahnhof': return new Bahnhof(szene, linkeKante);
    case 'tunnel': return new Tunnel(szene, linkeKante);
    case 'bruecke': return new Bruecke(szene, linkeKante);
    case 'tier': return new TierAufGleis(szene, linkeKante);
    case 'uebergang': return new Uebergang(szene, linkeKante);
    case 'wasch': return new Waschbogen(szene, linkeKante);
    default: return new Ballons(szene, linkeKante);
  }
}

const MENSCHEN = new Set(GAESTE_MENSCHEN);
const GROESSE = {
  maus: 0.7, frosch: 0.74, igel: 0.76, ente: 0.8, huhn: 0.82, eichhoernchen: 0.82, hase: 0.86, eule: 0.84,
  pinguin: 0.86, katze: 0.88, fuchs: 0.92, affe: 0.92, hund: 0.95, schaf: 0.98, schwein: 0.98, baer: 1,
  loewe: 1, kuh: 1.04, pferd: 1.06, giraffe: 1.1, elefant: 1.12,
};

/** Figur (Tier oder Mensch) in passender Größe. */
function figur(id, opt) {
  const mensch = MENSCHEN.has(id);
  const skala = (mensch ? 0.29 : 0.26) * (GROESSE[id] ?? 1) * (opt.faktor ?? 1);
  const a = new Actor(id, { pack: mensch ? 'zug' : 'tiere', x: opt.x, y: opt.y, scale: skala, parent: opt.parent });
  a.mensch = mensch;
  a.gastId = id;
  return a;
}

/** Freundlicher Gruß: winken bzw. Arme hoch, Tierlaut (Menschen: ein leiser Hupfer-Ton). */
function gruss(s, a, { laut = true } = {}) {
  if (!a || a.destroyed) return;
  a.pose('happy');
  if (laut) {
    if (a.mensch) sfx('common/hupf', { vol: 0.45 });
    else a.sound();
  }
  s.after(1.6, () => { if (!a.destroyed && a.poseName === 'happy') a.pose('idle'); });
}

// ================================================================ Apfelbaum

class Apfelbaum extends Ding {
  constructor(s, linkeKante) {
    super(s, 0);
    this.art = 'apfel';
    const skala = 0.62;
    const y = HINTEN_Y - 5;
    this.y = y;
    const c = this.teil(s.ebHinten, y);
    this.c = c;
    this.baum = spr('fahrt/baum_apfel', { x: 0, y, scale: skala, parent: c });
    this.aepfel = [];
    for (const name of ['apfel1', 'apfel2', 'apfel3', 'apfel4', 'apfel5', 'apfel6']) {
      const p = localPoint('fahrt/baum_apfel', name);
      if (!p) continue;
      const a = spr('fahrt/apfel', { x: p.x, y: p.y, scale: 0.85, parent: this.baum });
      a.haengt = true;
      a.ruhe = 0.85;
      this.aepfel.push(a);
    }
    this.links = -270;
    this.rechts = 270;
    this.wx = linkeKante - this.links;
    this.sperreBis = 0;
    tippbar(this.baum, () => this.schuetteln());
  }

  schuetteln() {
    const s = this.s;
    this.geschuettelt = true;   // dann braucht es den Hinweis „Tipp auf den Apfelbaum!" nicht mehr
    fx.wobble(this.baum, 0.045);
    // Rascheln und Blätter höchstens alle 0,8 s (Dauertippen stapelt keine Geräusche)
    if (ruhig(this.baum, 0.8)) {
      sfx('common/rascheln');
      fx.burst('blaetter', 0, this.y - 380, { count: 3, parent: this.c, z: 1000 });
    }
    const haengend = this.aepfel.filter((a) => a.haengt);
    // Solange noch Äpfel unterwegs sind, nur wackeln und rascheln (sonst fliegen bei schnellem Tippen zu viele)
    if (!haengend.length || s.t < this.sperreBis) return;
    s.after(1.4, () => { if (!this.tot) s.belohneEinmal('apfel', 'fahrt_baum_apfel', this.c, 0, this.y - 620); });
    const n = Math.min(haengend.length, randInt(2, 3));
    this.sperreBis = s.t + 0.12 + (n - 1) * 0.28 + 0.8 + 0.3;   // bis der letzte Apfel gelandet ist
    for (let i = 0; i < n; i++) {
      const a = haengend.splice(randInt(0, haengend.length - 1), 1)[0];
      a.haengt = false;
      s.after(0.12 + i * 0.28, () => {
        if (this.tot || a.destroyed) return;
        s.apfelInDenZug(a, i === n - 1);
        a.visible = false;
        // wächst nach einer Weile nach (weich)
        s.after(rand(6, 9), () => {
          if (this.tot || a.destroyed) return;
          a.visible = true;
          a.alpha = 0;
          a.scale.set(a.ruhe * 0.3);
          s.tween(a, { alpha: 1 }, 0.8, { ease: 'sineInOut' });
          s.tween(a, { scale: a.ruhe }, 1.2, { ease: 'sineInOut' }).then(() => { a.haengt = true; });
        });
      });
    }
  }

  update(dt, sx) {
    // einmal ansagen, wenn der Baum gut zu sehen ist (nicht gleich beim Begrüßen) – aber erst, wenn der Zug schon
    // einmal gefahren ist: Steht er am Anfang noch, ist „Tipp auf den Hebel …" der wichtige Hinweis, und der soll
    // der letzte bleiben (nur der letzte Hinweis wird nach langer Ruhe wiederholt).
    const s = this.s;
    const gutZuSehen = (x) => x > -s.W / 2 + 300 && x < s.W / 2 - 300;
    // Fährt der Zug, muss der Baum noch eine Weile im Bild bleiben (nicht schon links auf dem Weg hinaus). Steht er,
    // dann nur, wenn das Kind selbst angehalten hat – an einer Station (Bahnhof, Tier) hat deren Hinweis Vorrang.
    const steht = () => s.v < 1 && !s.fahren && !s.stehtBei;
    const bleibtZuSehen = (x) => gutZuSehen(x) && (x > 0 || steht());
    if (!this.angesagt && !this.geschuettelt && s.schonGefahren && s.t > 7 && bleibtZuSehen(sx)) {
      this.angesagt = true;
      // nur, wenn der Baum auch dann noch gut zu sehen ist und noch nicht geschüttelt wurde (der Satz kann warten)
      voice('fahrt_apfel', {
        nurWenn: () => !this.tot && !this.geschuettelt && this.aepfel.some((a) => a.haengt)
          && bleibtZuSehen(this.wx - s.strecke),
      });
    }
  }

  hinweise() {
    return this.aepfel.some((a) => a.haengt) ? [this.baum] : [];
  }
}

// ================================================================ Bahnhof

const DACH_FARBEN = ['rot', 'blau', 'gelb'];
let bahnhofNr = 0;

class Bahnhof extends Ding {
  constructor(s, linkeKante) {
    super(s, 0);
    this.art = 'bahnhof';
    const farbe = DACH_FARBEN[bahnhofNr++ % DACH_FARBEN.length];
    this.farbe = farbe;
    const skala = 0.72;
    const y = 1212;
    this.y = y;
    const id = 'fahrt/bahnhof_klein_' + farbe;
    const c = this.teil(s.ebHinten, y);
    this.c = c;
    // Ebene über dem Zug, die mit dem Bahnhof mitzieht: dort hüpfen aussteigende Gäste zum Bahnsteig
    this.flug = this.teil(s.ebFlug, 5);
    this.flug.sortableChildren = true;
    this.haus = spr(id, { x: 0, y, scale: skala, parent: c });
    const p = localPoint(id, 'bahnsteig');
    this.steigY = y + (p ? p.y : -150) * skala;
    tippbar(this.haus, () => {
      fx.wobble(this.haus, 0.015);
      sfx('common/glocke', { vol: 0.45 });
    });

    this.links = -340;
    this.rechts = 340;
    this.wx = linkeKante - this.links;
    // zwei Plätze auf dem Bahnsteig: rechts der Lok und links vom Hebel-Pult (der Halt liegt bei platzZiel)
    this.plaetze = [-100, 100];
    this.fahrgaeste = [];   // { actor, ballon, platz }
    this.da = false;        // Zug steht hier
    this.erledigt = false;  // durfte weiterfahren
    this.winkZeit = rand(2, 4);
    this.zielX = s.platzZiel();

    // ein wartender Fahrgast mit Luftballon in der Farbe des Dachs
    this.neuerFahrgast(s.wartenderGast(), pick(this.plaetze), { ballon: farbe });
  }

  neuerFahrgast(id, platz, { ballon = null, herein = false } = {}) {
    const s = this.s;
    const a = figur(id, { x: platz, y: this.steigY, parent: this.c });
    a.zIndex = 5;
    const fg = { actor: a, ballon: null, platz, id };
    if (ballon) {
      const b = spr('fahrt/luftballon_' + ballon, { anchor: [0.5, 0.985], scale: 0.62, parent: this.c });
      b.zIndex = 6;
      b.phase = rand(0, 6);
      // Der Ballon gehört zum Fahrgast: Tipp darauf wirkt wie ein Tipp auf ihn (er hält ihn ja fest)
      tippbar(b, () => {
        sfx('common/ballon', { vol: 0.6 });
        fx.wobble(b, 0.12);
        this.fahrgastTipp(fg);
      });
      fg.ballon = b;
      this.stelleBallon(fg, 0);
    }
    a.onTap(() => this.fahrgastTipp(fg), { pad: 80 });
    this.fahrgaeste.push(fg);
    if (herein) {
      const y0 = a.y;
      a.y = y0 - 170;
      a.alpha = 0;
      s.tween(a, { alpha: 1 }, 0.2, { ease: 'sineInOut' });
      s.tween(a, { y: y0 }, 0.38, { ease: 'quadIn' }).then((ok) => {
        if (!ok || a.destroyed) return;
        fx.pop(a, 0.08);
        sfx('common/landen', { vol: 0.7 });
        gruss(s, a);
      });
    }
    return fg;
  }

  // Ballon hängt an der Hand (folgt Hüpfern) und wiegt sich leicht. Am rechten Platz hält der Gast ihn links,
  // damit die Ballon-Tippfläche nicht an das Hebel-Pult stößt.
  stelleBallon(fg, t) {
    const b = fg.ballon;
    const a = fg.actor;
    if (!b || b.destroyed || a.destroyed) return;
    const hoehe = a.sprite.texture.height * Math.abs(a.scale.y);
    b.x = a.x + (fg.platz > 0 ? -0.33 : 0.33) * hoehe;
    b.y = a.y + a.koerper.y - 0.42 * hoehe;
    b.rotation = Math.sin(t * 0.9 + b.phase) * 0.08;
  }

  fahrgastTipp(fg) {
    const s = this.s;
    if (fg.geht) return;
    if (!this.da) {
      gruss(s, fg.actor);
      fg.actor.hop(50);
      return;
    }
    this.einsteigen(fg);
  }

  einsteigen(fg) {
    const s = this.s;
    const zug = s.zug;
    // Platz sofort vergeben: tippt das Kind gleich den nächsten Fahrgast an, bekommt er einen anderen Wagen
    const idx = s.freierSitz();
    if (idx < 0) {
      // kein Platz: freundliches Kopfschütteln, Gäste im Zug winken
      fg.actor.shake();
      sfx('common/nein', { vol: 0.5 });
      zug.gaesteJubeln();
      return;
    }
    s.reserviert.set(idx, fg.id);
    this.eingestiegen = true;
    fg.geht = true;
    this.fahrgaeste.splice(this.fahrgaeste.indexOf(fg), 1);
    const w = zug.wagen[idx];
    const a = fg.actor;
    a.pose('happy');
    if (fg.ballon) s.ballonLoslassen(fg.ballon);
    fg.ballon = null;
    // über den Zug heben (sonst hüpft er hinter der Lok vorbei)
    const p = s.ebFlug.toLocal(a.getGlobalPosition());
    s.ebFlug.addChild(a);
    a.position.set(p.x, p.y);
    a.eventMode = 'none';
    // Ziel: Füße knapp über dem Wagenrand – genau dort beginnt der Gast im Wagen sein Hineinplumpsen (setzeGast)
    const pl = w.platz;
    const innen = w.fahrzeug.innen;
    const ziel = s.ebFlug.toLocal(innen.toGlobal({ x: pl.mitte, y: pl.rand - 40 }));
    // Größe unterwegs an die Größe im Wagen angleichen (gleiche Rechnung wie im Zug-Baustein, ungefähr)
    const kante = s.ebFlug.toLocal(innen.toGlobal({ x: pl.mitte + pl.breite, y: pl.rand }));
    const breiteWelt = Math.abs(kante.x - ziel.x);
    const hoeheZiel = breiteWelt * (a.mensch ? 0.95 : 0.8) * (GROESSE[fg.id] ?? 1);
    const skalaZiel = Math.min(Math.abs(a.scale.y), hoeheZiel / a.sprite.texture.height);
    // ruhiger Bogen: Dauer und Höhe wachsen mit der Strecke (nie ein Sprung quer über das Bild in einem Wimpernschlag)
    const weite = Math.hypot(ziel.x - p.x, ziel.y - p.y);
    const dauer = clamp(0.7 + weite / 800, 0.9, 2.6);
    const hoehe = clamp(130 + weite * 0.14, 150, 330);
    s.tween(a.scale, { x: Math.sign(a.scale.x) * skalaZiel, y: skalaZiel }, dauer, { ease: 'sineInOut' });
    sfx('common/hupf', { vol: 0.6 });
    a.hopTo(ziel.x, ziel.y, { hoehe, dauer, staub: false }).then(() => {
      // angekommen: Der Gast im Wagen übernimmt (blendet an derselben Stelle ein), der Hüpfer blendet aus
      s.reserviert.delete(idx);
      if (zug.destroyed) return;
      if (!w.gast && zug.wagen[idx] === w) zug.setzeGast(idx, fg.id);
      if (!a.destroyed) {
        s.tween(a, { alpha: 0 }, 0.18, { ease: 'sineInOut' }).then(() => { if (!a.destroyed) a.destroy({ children: true }); });
      }
      s.after(0.8, () => {
        if (zug.destroyed) return;
        zug.gaesteJubeln(idx);
        const b = w.fahrzeug.koerper.getBounds();
        const q = s.front.toLocal({ x: b.x + b.width / 2, y: b.y - 60 });
        s.belohneEinmal('fahrgast', MENSCHEN.has(fg.id) ? 'lok' : 'tier_' + fg.id, s.front, q.x, q.y);
      });
    });
  }

  /** Gast aus dem Zug steigt hier aus und hüpft in einem ruhigen Bogen auf den Bahnsteig. → true, wenn ausgestiegen */
  aussteigen(w) {
    const s = this.s;
    const frei = this.plaetze.find((x) => !this.fahrgaeste.some((f) => f.platz === x));
    if (frei === undefined || !w.gast) return false;
    const id = w.gastId;
    const alt = w.gast;
    // Start: Füße auf dem Wagenrand, gleiche Größe wie im Wagen
    const pl = w.platz;
    const innen = w.fahrzeug.innen;
    const start = this.flug.toLocal(innen.toGlobal({ x: alt.x, y: pl.rand }));
    const skala0 = Math.abs(alt.worldTransform.d) / Math.abs(this.flug.worldTransform.d || 1);
    s.zug.setzeGast(w.index, null);
    alt.visible = false;            // der Baustein blendet ihn nach oben aus – stattdessen hüpft die Figur unten
    const fg = { platz: frei, geht: true, id };
    this.fahrgaeste.push(fg);       // Platz schon reservieren
    const a = figur(id, { x: start.x, y: start.y, parent: this.flug });
    a.eventMode = 'none';
    a.zIndex = 5;
    a.schatten.visible = false;
    // figur() gibt ihr die Bahnsteig-Größe; sie beginnt in Wagen-Größe und wächst unterwegs weich hinein
    const skalaZiel = Math.abs(a.scale.y);
    a.scale.set(skala0);
    a.pose('happy');
    const ziel = { x: frei, y: this.steigY };
    const weite = Math.hypot(ziel.x - start.x, ziel.y - start.y);
    const dauer = clamp(0.8 + weite / 800, 1.2, 2.6);
    const hoehe = clamp(150 + weite * 0.12, 170, 320);
    s.tween(a.scale, { x: skalaZiel, y: skalaZiel }, dauer, { ease: 'sineInOut' });
    a.hopTo(ziel.x, ziel.y, { hoehe, dauer, staub: false }).then((ok) => {
      if (this.tot) {
        if (!a.destroyed) a.destroy({ children: true });
        return;
      }
      const i = this.fahrgaeste.indexOf(fg);
      if (i >= 0) this.fahrgaeste.splice(i, 1);
      const da = this.neuerFahrgast(id, frei);
      if (!a.destroyed) a.destroy({ children: true });
      fx.pop(da.actor, 0.08);
      sfx('common/landen', { vol: 0.7 });
      gruss(s, da.actor);
    });
    return true;
  }

  haltBei() {
    return this.erledigt ? null : this.wx - this.zielX;
  }

  angekommen() {
    const s = this.s;
    this.da = true;
    sfx('common/gong', { vol: 0.4 });
    // „Da wartet jemand. Tipp ihn an …" kurz nach dem Halten und nur, solange der Zug hier hält, noch niemand
    // eingestiegen ist und ein Sitz frei ist (tippt das Kind gleich selbst, braucht es den Hinweis nicht)
    const passt = () => this.da && !this.tot && !this.eingestiegen && this.fahrgaeste.some((f) => !f.geht)
      && s.freierSitz() >= 0;
    s.after(1.5, () => { if (passt()) voice('fahrt_bahnhof', { nurWenn: passt }); });
    this.fahrgaeste.forEach((fg, i) => s.after(0.4 + i * 0.3, () => gruss(s, fg.actor)));
  }

  weiter() {
    if (this.erledigt) return;
    this.erledigt = true;
    this.da = false;
    const s = this.s;
    this.fahrgaeste.forEach((fg, i) => s.after(0.6 + i * 0.3, () => gruss(s, fg.actor, { laut: i === 0 })));
    s.losfahren();
  }

  update(dt, sx) {
    const t = this.s.t;
    for (const fg of this.fahrgaeste) if (fg.ballon) this.stelleBallon(fg, t);
    // ab und zu winkt ein wartender Fahrgast (nur, wenn er zu sehen ist)
    this.winkZeit -= dt;
    if (this.winkZeit <= 0) {
      this.winkZeit = rand(4, 6);
      const sichtbar = sx > -this.s.W / 2 && sx < this.s.W / 2;
      const fg = pick(this.fahrgaeste.filter((f) => !f.geht && f.actor));
      if (sichtbar && fg) gruss(this.s, fg.actor, { laut: false });
    }
  }

  hinweise() {
    if (!this.da) return [];
    if (this.s.freierSitz() >= 0) {
      const fg = this.fahrgaeste.find((f) => !f.geht && f.actor);
      if (fg) return [fg.actor];
    }
    return [];
  }

  zerstoere() {
    for (const fg of this.fahrgaeste) if (fg.ballon && !fg.ballon.destroyed) fg.ballon.destroy();
    super.zerstoere();
  }
}

// ================================================================ Tunnel

class Tunnel extends Ding {
  constructor(s, linkeKante) {
    super(s, 0);
    this.art = 'tunnel';
    const skala = 1.35;
    this.skala = skala;
    const id = 'fahrt/berg_tunnel';
    const m = meta(id);
    const fuss = 1368;
    // Das Tunnelloch im Bild schaut zum Betrachter. Damit der Zug sichtbar „hineinfährt", ist das Loch im vorderen
    // Berg ausgespart (umgekehrte Maske): Durch die Öffnung sieht man hinter dem Zug das dunkle Loch (Kopie des
    // Bilds, nur im Loch) und davor den Zug selbst – leicht abgedunkelt, als wäre er drinnen.
    const bogen = (g) => {
      // Lochform in Bildpunkten (gemessen): Bogen mit Mitte (493, 420), Halbachsen 142 × 132, unten Zeile 572
      const L = (px) => (px - m.ax * m.w) * skala;
      const T = (py) => (py - m.ay * m.h) * skala;
      const pts = [L(351), T(572)];
      for (let i = 0; i <= 24; i++) {
        const w = Math.PI + (i / 24) * Math.PI;
        pts.push(L(493 + Math.cos(w) * 142), T(420 + Math.sin(w) * 132));
      }
      pts.push(L(635), T(572));
      return g.poly(pts);
    };
    // hinten (unter dem Gleis): das dunkle Loch
    const hinten = this.teil(s.ebStrasse, 0);
    const lochC = new Container({ label: 'tunnel-loch' });
    lochC.position.set(0, fuss);
    hinten.addChild(lochC);
    const lochBild = spr(id, { x: 0, y: 0, scale: skala, parent: lochC });
    const lochMaske = bogen(new Graphics()).fill(0xffffff);
    lochC.addChild(lochMaske);
    lochBild.mask = lochMaske;
    // vorn (über dem Zug): Berg mit Aussparung, darunter ein Hauch Dunkel über dem Zug im Loch
    const c = this.teil(s.ebVorn, 0);
    this.bergC = new Container({ label: 'tunnel-berg' });
    this.bergC.position.set(0, fuss);
    c.addChild(this.bergC);
    const schatten = bogen(new Graphics()).fill({ color: 0x1a120c, alpha: 0.34 });
    this.bergC.addChild(schatten);
    this.berg = spr(id, { x: 0, y: 0, scale: skala, parent: this.bergC });
    const aussparung = bogen(new Graphics()).fill(0xffffff);
    this.bergC.addChild(aussparung);
    this.berg.setMask({ mask: aussparung, inverse: true });
    this.halb = (m.w * skala) / 2;
    this.links = -this.halb - 20;
    this.rechts = this.halb + 20;
    this.wx = linkeKante - this.links;
    this.vorneBelegt = true;
    this.drin = false;
    this.warDrin = false;
    tippbar(this.bergC, () => {
      fx.wobble(this.bergC, 0.01);
      // Echo aus dem Tunnel
      note('floete', 76, { vol: 0.55, dauer: 0.35 });
      s.after(0.45, () => note('floete', 72, { vol: 0.35, dauer: 0.35 }));
      s.after(0.9, () => note('floete', 72, { vol: 0.18, dauer: 0.35 }));
    }, { skala: 1 });
  }

  update(dt, sx) {
    const s = this.s;
    // drin = die Lok ist vom Berg (ohne die schrägen Ränder) verdeckt
    const links = sx - this.halb * 0.8;
    const rechts = sx + this.halb * 0.8;
    const lokHinten = LOK_X - s.lokBreite;
    const drin = links < LOK_X - 60 && rechts > lokHinten + 60;
    if (drin !== this.drin) {
      this.drin = drin;
      s.dunkel(drin);
      if (drin) {
        s.zug.pfeife();
        this.warDrin = true;
      } else if (this.warDrin) {
        s.belohneEinmal('tunnel', eigenerSticker('fahrt_tunnel'), s.front, LOK_X - s.lokBreite / 2, GLEIS_Y - 420);
      }
    }
  }

  zerstoere() {
    if (this.drin) this.s.dunkel(false);
    super.zerstoere();
  }
}

// ================================================================ Xylophon-Brücke

const TONLEITER = [72, 74, 76, 77, 79, 81, 83, 84];

class Bruecke extends Ding {
  constructor(s, linkeKante) {
    super(s, 0);
    this.art = 'bruecke';
    this.sperrtHinten = false;
    const id = 'fahrt/bruecke';
    const skala = 1.0;
    const m = meta(id);
    const c = this.teil(s.ebBruecke, 0);
    this.c = c;
    // Fahrbahn (Oberkante der Stäbe, Zeile ~14) liegt auf der Schienenhöhe
    const fahrbahn = 14;
    this.bild = spr(id, { x: 0, y: GLEIS_Y + (m.ay * m.h - fahrbahn) * skala, scale: skala, parent: c });
    const pl = localPoint(id, 'fahrbahn_l');
    const pr = localPoint(id, 'fahrbahn_r');
    this.lueckeL = (pl ? pl.x : -m.w / 2 + 40) * skala + 6;
    this.lueckeR = (pr ? pr.x : m.w / 2 - 40) * skala - 6;
    this.links = -(m.w * skala) / 2 - 20;
    this.rechts = (m.w * skala) / 2 + 20;
    this.wx = linkeKante - this.links;
    this.vorneBelegt = true;

    // die acht Stäbe: unsichtbare große Tippflächen + weicher Schimmer
    this.staebe = [];
    for (let i = 0; i < 8; i++) {
      const p = localPoint(id, 'stab' + (i + 1));
      const x = (p ? p.x : (i - 3.5) * 145) * skala;
      // weicher Schimmer auf dem Stab (Stab im Bild: etwa 130 × 60 Bildpunkte, Mitte 36 unter der Fahrbahn)
      const glanz = new Graphics().roundRect(-58 * skala, -24 * skala, 116 * skala, 48 * skala, 16 * skala)
        .fill({ color: 0xffffff, alpha: 1 });
      glanz.position.set(x, GLEIS_Y + 34 * skala);
      glanz.alpha = 0;
      c.addChild(glanz);
      const flaeche = new Container({ label: 'stab' + (i + 1) });
      flaeche.position.set(x, GLEIS_Y + 30);
      flaeche.hitArea = new Rectangle(-100, -150, 200, 260);
      c.addChild(flaeche);
      const stab = { x, glanz, flaeche, gespielt: false, i };
      tippbar(flaeche, () => this.spiele(stab), { min: 200 });
      this.staebe.push(stab);
    }
    this.fertig = false;
  }

  spiele(stab) {
    const s = this.s;
    note('xylo', TONLEITER[stab.i], { vol: 0.8 });
    const g = stab.glanz;
    s.tween(g, { alpha: 0.4 }, 0.5, { ease: 'sineInOut' }).then((ok) => {
      if (ok && !g.destroyed) s.tween(g, { alpha: 0 }, 0.7, { ease: 'sineInOut' });
    });
    fx.burst('noten', stab.x, GLEIS_Y - 40, { count: 1, parent: this.c, z: 1000 });
  }

  /** Lücke in der Schiene (Bildschirm-x) */
  luecke(sx) {
    return [sx + this.lueckeL, sx + this.lueckeR];
  }

  update(dt, sx) {
    const s = this.s;
    // Die Lok rollt über die Stäbe: ihr Vorderrad schlägt jeden Stab an
    const rad = s.lokRadX;
    for (const st of this.staebe) {
      if (!st.gespielt && sx + st.x < rad) {
        st.gespielt = true;
        if (sx + st.x > rad - 200) this.spiele(st);   // nur, wenn es eben geschah (nicht beim Erscheinen)
      }
    }
    if (!this.fertig && this.staebe[7].gespielt) {
      this.fertig = true;
      s.belohneEinmal('bruecke', eigenerSticker('fahrt_bruecke'), s.front, LOK_X - s.lokBreite / 2, GLEIS_Y - 420);
    }
    // Brücke ist da: Stimme einmal
    if (!this.angesagt && sx < s.W / 2 - 300) {
      this.angesagt = true;
      // nicht mehr, wenn der Zug schon ganz darüber ist (der Satz kann hinter einem anderen warten)
      voice('fahrt_bruecke', { nurWenn: () => !this.tot && !this.fertig });
    }
  }

  hinweise() {
    const s = this.s;
    // ein Stab rechts vor der Lok
    const sx = this.wx - s.strecke;
    const frei = this.staebe.find((st) => sx + st.x > LOK_X + 120 && sx + st.x < s.W / 2 - 300);
    return frei ? [frei.flaeche] : [];
  }
}

// ================================================================ Tier auf dem Gleis

let tierNr = 0;
const WIESE_X = 130;   // dorthin hüpft das Tier vom Gleis (rechts vom Gleisplatz, links vom Hebel-Pult)

class TierAufGleis extends Ding {
  constructor(s, linkeKante) {
    super(s, 0);
    this.art = 'tier';
    // abwechselnd Kuh und Schaf – aber nicht das Tier, das schon im Zug sitzt
    let id = ['kuh', 'schaf'][tierNr++ % 2];
    if (s.zug.wagen.some((w) => w.gastId === id)) id = id === 'kuh' ? 'schaf' : 'kuh';
    this.tierId = id;
    const c = this.teil(s.ebAufGleis, 0);
    this.c = c;
    this.tier = new Actor(this.tierId, { x: 0, y: GLEIS_Y + 6, scale: this.tierId === 'kuh' ? 0.3 : 0.29, parent: c, flip: true });
    this.tier.onTap(() => this.tipp(), { pad: 60 });
    // Hinter dem Gleis, links vom Tier (beim Halt gleich rechts der Lok): bei der Kuh das Schild „Kuhweide",
    // beim Schaf ein Stück Zaun. Das Tier hüpft später nach rechts auf die Wiese – nicht davor.
    const h = this.teil(s.ebHinten, HINTEN_Y);
    if (this.tierId === 'kuh') {
      this.schild = spr('fahrt/kuhweide_schild', { x: -205, y: HINTEN_Y, scale: 0.5, parent: h });
    } else {
      this.schild = spr('fahrt/zaun', { x: -250, y: HINTEN_Y + 8, scale: 0.5, parent: h });
    }
    tippbar(this.schild, () => {
      fx.wobble(this.schild, 0.06);
      if (ruhig(this.schild, 1)) animal(this.tierId);
    });
    this.links = -420;
    this.rechts = 330;
    this.wx = linkeKante - this.links;
    this.weg = false;     // hüpft gerade fort / ist fort
    this.springt = false; // ist gerade auf dem Sprung vom Gleis auf die Wiese
    this.frei = false;    // Gleis ist frei
    this.da = false;
    this.lautZeit = rand(2, 3);
  }

  tipp() {
    if (this.weg) {
      // Während des Sprungs auf die Wiese nur der Tierlaut: Ein Hüpfer auf der Stelle (cheer) würde den Sprung
      // abbrechen, und das Tier bliebe auf der Schiene stehen.
      if (!this.springt) this.tier.cheer();
      else if (ruhig(this.tier, 1)) this.tier.sound();
      return;
    }
    this.weiter();
  }

  /** Ende des Sprungs: Das Tier steht auf der Wiese und frisst – auch wenn ein Hüpfer unterbrochen wurde. */
  aufDerWiese(ok) {
    const a = this.tier;
    if (this.tot || a.destroyed) return;
    if (!ok) {
      // weich an den Platz auf der Wiese gleiten (nie auf dem Gleis stehen bleiben)
      a.stop();
      this.s.tween(a, { x: WIESE_X, y: HINTEN_Y - 8 }, 0.4, { ease: 'sineInOut' });
    }
    this.s.after(ok ? 0 : 0.45, () => {
      if (this.tot || a.destroyed) return;
      a.x = WIESE_X;
      a.y = HINTEN_Y - 8;
      a.lookAt(-1000);
      a.pose('eat');
      this.springt = false;
    });
  }

  haltBei() {
    return this.frei ? null : this.wx - (LOK_X + 235);
  }

  angekommen() {
    this.da = true;
    // kurz nach dem Halten und nur, solange das Tier noch auf dem Gleis steht (Pfiff, Tipp oder Hebel schicken es
    // auf die Wiese) – pfeift das Kind gleich selbst, braucht es den Hinweis nicht
    const passt = () => !this.tot && !this.weg;
    this.s.after(1.5, () => { if (passt()) voice('fahrt_tier', { nurWenn: passt }); });
    this.tier.sound();
    this.tier.nod();
  }

  /** Pfiff, Tipp, Hebel oder Lok: Das Tier hüpft fröhlich auf die Wiese. */
  weiter() {
    if (this.weg) return;
    this.weg = true;
    const s = this.s;
    const a = this.tier;
    const sichtbar = this.wx - s.strecke < s.W / 2 + 100;
    if (!sichtbar) {
      // noch gar nicht zu sehen (z. B. Pfiff von weitem): still beiseite
      a.x = WIESE_X;
      a.y = HINTEN_Y - 8;
      a.flip = false;
      a.pose('eat');
      this.frei = true;
      return;
    }
    this.springt = true;
    a.cheer();
    s.after(0.65, () => {
      if (this.tot || a.destroyed) return;
      a.hopTo(WIESE_X * 0.55, GLEIS_Y - 30, { hoehe: 90, dauer: 0.55, staub: false })
        .then((ok) => (ok && !a.destroyed ? a.hopTo(WIESE_X, HINTEN_Y - 8, { hoehe: 70, dauer: 0.55 }) : false))
        .then((ok) => this.aufDerWiese(ok));
    });
    // Das Gleis wird frei, sobald das Tier von der Schiene herunter ist (siehe update); spätestens nach 2,5 s,
    // damit der Zug nie hängen bleibt.
    this.freiSpaetestens = s.t + 2.5;
  }

  /** Gleis frei: der Zug darf weiter (fährt los, wenn er hier wartet). */
  gibFrei() {
    if (this.frei) return;
    this.frei = true;
    if (this.da) this.s.losfahren();
    this.da = false;
  }

  update(dt, sx) {
    if (this.weg && !this.frei && !this.tot) {
      const a = this.tier;
      // (der erste Sprung endet bei GLEIS_Y − 30 neben der Schiene; bis die Lok dort ist, steht das Tier längst
      //  auf der Wiese – der Sprung lässt sich ja nicht mehr unterbrechen)
      if (a.destroyed || a.y < GLEIS_Y - 25 || this.s.t >= this.freiSpaetestens) this.gibFrei();
    }
    if (this.da && !this.weg) {
      this.lautZeit -= dt;
      if (this.lautZeit <= 0) {
        this.lautZeit = rand(4, 6);
        this.tier.nod();
        if (Math.random() < 0.5) this.tier.sound();
      }
    }
  }

  hinweise() {
    // Die Stimme sagt „Pfeif mal!" – darum zeigt die Hand dorthin, wo man pfeift: zuerst auf die Lok (groß, gleich
    // neben dem Tier; Tipp = Pfiff), danach auf das Pfeifen-Seil. Das Tier selbst antippen geht natürlich auch.
    const s = this.s;
    if (this.weg || this.wx - s.strecke >= s.W / 2 - 150) return [];
    return [s.zug.lok, s.seil].filter(Boolean);
  }
}

// ================================================================ Bahnübergang

class Schranke {
  constructor(s, parent, x, y, skala, flip) {
    this.s = s;
    this.c = new Container({ label: 'schranke' });
    this.c.position.set(x, y);
    this.c.zIndex = y;
    parent.addChild(this.c);
    this.offen = spr('zug/schranke_offen', { scale: skala, parent: this.c, flip });
    this.zu = spr('zug/schranke_zu', { scale: skala, parent: this.c, flip, alpha: 0 });
    this.istZu = false;
    tippbar(this.c, () => {
      fx.wobble(this.istZu ? this.zu : this.offen, 0.03);
      sfx('common/klingel', { vol: 0.4 });
    }, { skala: 1 });
  }

  setze(zu) {
    if (zu === this.istZu) return;
    this.istZu = zu;
    this.s.tween(this.zu, { alpha: zu ? 1 : 0 }, 0.7, { ease: 'sineInOut' });
    this.s.tween(this.offen, { alpha: zu ? 0 : 1 }, 0.7, { ease: 'sineInOut' });
  }
}

class Uebergang extends Ding {
  constructor(s, linkeKante) {
    super(s, 0);
    this.art = 'uebergang';
    const strasse = this.teil(s.ebStrasse, 0);
    spr('fahrt/bahnuebergang_strasse', { x: 0, y: 1505, scale: 1.25, parent: strasse });
    const hinten = this.teil(s.ebHinten, HINTEN_Y);
    const vorne = this.teil(s.ebVorne, VORNE_Y);
    this.vorne = vorne;
    // Halbschranken: vorn links (Baum nach rechts), hinten rechts (Baum nach links)
    this.schranken = [
      new Schranke(s, vorne, -360, 1440, 0.62, false),
      new Schranke(s, hinten, 290, HINTEN_Y + 5, 0.5, true),
    ];
    // Das Auto wartet rechts der Straße (schaut zur Straße). So ist es noch im Bild, wenn das Zugende vorbei ist,
    // und fährt dann sichtbar über den Übergang davon. Container = Fahrweg, Bild darin = Hupf-Hüpfer.
    const farbe = Math.random() < 0.5 ? 'rot' : 'gelb';
    this.autoX = 470;
    this.autoC = new Container({ label: 'auto' });
    this.autoC.position.set(this.autoX, VORNE_Y);
    this.autoC.zIndex = 2;
    vorne.addChild(this.autoC);
    this.auto = spr('fahrt/auto_' + farbe, { x: 0, y: 0, scale: 0.52, parent: this.autoC, flip: true });
    tippbar(this.autoC, () => this.hupen(), { skala: 1 });
    this.links = -820;
    this.rechts = 640;
    this.wx = linkeKante - this.links;
    this.vorneBelegt = true;
    this.zu = false;
    this.warZu = false;
    this.faehrt = false;
  }

  hupen() {
    const a = this.auto;
    if (this.s.t - (this._hupZeit ?? -9) > 0.5) {   // nicht übereinander hupen
      this._hupZeit = this.s.t;
      sfx('common/hupe', { vol: 0.8 });
    }
    if (a._hupft) return;
    a._hupft = true;
    this.s.tween(a, { y: -30 }, 0.14, { ease: 'quadOut' })
      .then(() => this.s.tween(a, { y: 0 }, 0.35, { ease: 'bounceOut' }))
      .then(() => { a._hupft = false; });
  }

  /** Zug ist vorbei: Schranken auf, das Auto hupt zum Abschied und fährt über die Straße nach hinten davon. */
  losfahren() {
    const s = this.s;
    const c = this.autoC;
    this.faehrt = true;
    s.after(0.3, () => {
      if (this.tot) return;
      this.hupen();
      s.tween(c, { x: 40 }, 1.3, { ease: 'sineInOut', delay: 0.3 })
        .then((ok) => {
          if (!ok || this.tot) return false;
          // die Straße hinauf, über das Gleis, kleiner werdend in die Ferne
          s.tween(c, { scale: 0.62 }, 2.6, { ease: 'sineInOut' });
          s.tween(c, { alpha: 0 }, 1.1, { ease: 'sineInOut', delay: 1.5 });
          return s.tween(c, { x: -10, y: HINTEN_Y - 10 }, 2.6, { ease: 'sineInOut' });
        })
        .then((ok) => { if (ok && !this.tot) c.eventMode = 'none'; });
    });
  }

  update(dt, sx) {
    const s = this.s;
    // Fährt die Lok über die Straße, grüßt das wartende Auto mit Hupen und Hüpfer (mitten im Bild gut zu sehen)
    if (!this.gegruesst && sx < LOK_X - 80) {
      this.gegruesst = true;
      if (sx + this.autoX < s.W / 2 - 100) this.hupen();
    }
    // Schranken schließen mitten im Bild (deutlich vor der Lok) und öffnen, sobald das Zugende die Straße passiert hat
    const zu = sx < LOK_X + 520 && sx > s.zugHeck - 100;
    if (zu !== this.zu) {
      this.zu = zu;
      for (const sch of this.schranken) sch.setze(zu);
      if (zu) {
        this.warZu = true;
        sfx('common/klingel', { vol: 0.35 });
      } else if (this.warZu && !this.faehrt && sx < s.zugHeck && sx + this.autoX > -s.W / 2 + 150) {
        this.losfahren();
      }
    }
  }

  hinweise() {
    return this.faehrt ? [] : [this.autoC];
  }
}

// ================================================================ Waschbogen

class Waschbogen extends Ding {
  constructor(s, linkeKante) {
    super(s, 0);
    this.art = 'wasch';
    this.sperrtHinten = false;
    const id = 'fahrt/waschbogen';
    const skala = 0.82;
    const c = this.teil(s.ebVorn, 0);
    this.c = c;
    this.bogen = spr(id, { x: 0, y: 1282, scale: skala, parent: c });
    const d = localPoint(id, 'duesen');
    this.duesenY = 1282 + (d ? d.y : -560) * skala;
    const m = meta(id);
    this.links = -(m.w * skala) / 2 - 20;
    this.rechts = (m.w * skala) / 2 + 20;
    this.wx = linkeKante - this.links;
    this.vorneBelegt = true;
    this.schaum = null;
    this.schrubbZeit = 0;
    this.gewaschen = new Set();
    tippbar(this.bogen, () => {
      fx.wobble(this.bogen, 0.015);
      if (!ruhig(this.bogen, 0.7)) return;
      sfx('common/spritz', { vol: 0.7 });
      fx.burst('tropfen', 0, this.duesenY + 20, { count: 6, parent: this.c, z: 1000 });
    });
  }

  update(dt, sx) {
    const s = this.s;
    const ueberZug = sx < LOK_X + 40 && sx > s.zugHeck - 40 && sx > -s.W / 2 - 100;
    if (ueberZug && !this.schaum) {
      this.schaum = fx.emitter('blasen', { x: sx, y: this.duesenY + 60, rate: 5, parent: s.front, z: 950 });
    } else if (!ueberZug && this.schaum) {
      this.schaum.stop();
      this.schaum = null;
    }
    if (this.schaum) {
      this.schaum.at(sx + rand(-60, 60), this.duesenY + 60);
      this.schrubbZeit -= dt;
      if (this.schrubbZeit <= 0) {
        this.schrubbZeit = 1.8;
        sfx('common/schrubben', { vol: 0.5 });
      }
    }
    // Nachdem der Bogen über ein Fahrzeug gezogen ist: leises Funkeln darüber
    for (const f of s.fahrzeuge) {
      if (this.gewaschen.has(f.nr) || sx > f.mitte - 40) continue;
      this.gewaschen.add(f.nr);
      if (sx < -s.W / 2) continue;
      const x = f.mitte;
      const y = f.oben;
      s.after(0.5, () => {
        fx.burst('funkeln', x, y + 30, { count: 6, parent: s.front });
        sfx('common/funkeln', { vol: 0.35 });
      });
    }
  }

  zerstoere() {
    this.schaum?.stop();
    this.schaum = null;
    super.zerstoere();
  }
}

// ================================================================ Luftballons am Wegrand

const BALLON_FARBEN = ['rot', 'gelb', 'blau', 'rot', 'blau'];

class Ballons extends Ding {
  constructor(s, linkeKante) {
    super(s, 0);
    this.art = 'ballons';
    this.sperrtHinten = false;
    const c = this.teil(s.ebVorne, VORNE_Y);
    this.c = c;
    // kleiner Holzpfosten, an dem die Schnüre hängen
    const pfosten = new Graphics()
      .ellipse(0, 6, 46, 12).fill({ color: 0x5a4632, alpha: 0.18 })
      .roundRect(-18, -200, 36, 210, 14).fill(0xb7834e)
      .roundRect(-18, -200, 12, 210, 8).fill({ color: 0xffffff, alpha: 0.12 })
      .roundRect(-26, -214, 52, 28, 12).fill(0xd6a46c);
    pfosten.position.set(0, VORNE_Y);
    c.addChild(pfosten);
    this.pfosten = pfosten;
    this.ballons = [];
    const n = 4;
    for (let i = 0; i < n; i++) {
      const farbe = BALLON_FARBEN[(i + randInt(0, 4)) % BALLON_FARBEN.length];
      const b = spr('fahrt/luftballon_' + farbe, { anchor: [0.5, 0.985], scale: 0.82, parent: c });
      b.ruheX = (i - (n - 1) / 2) * 46;
      b.position.set(b.ruheX, VORNE_Y - 190);
      b.rotation = ((i - (n - 1) / 2) * 0.32);
      b.ruheR = b.rotation;
      b.phase = rand(0, 6);
      b.ruhe = 0.82;
      b.da = true;
      b.eventMode = 'none';
      this.ballons.push(b);
    }
    // Eine einzige große Tippfläche über Strauß und Pfosten: Es platzt der Ballon, dessen Kopf dem Finger am
    // nächsten ist (die Ballons stehen zu dicht für eigene Flächen – sonst platzte oft der Nachbar).
    const flaeche = new Container({ label: 'ballon-strauss' });
    c.addChild(flaeche);
    this.flaeche = flaeche;
    tap(flaeche, (ctx) => this.tipp(ctx), {
      sound: null, squash: false, hitArea: new Rectangle(-200, VORNE_Y - 520, 400, 520),
    });
    this.links = -340;
    this.rechts = 340;
    this.wx = linkeKante - this.links;
    this.vorneBelegt = true;
  }

  /** Kopf-Mitte eines Ballons (Koordinaten von c) */
  kopf(b) {
    return { x: b.x + Math.sin(b.rotation) * 160, y: b.y - Math.cos(b.rotation) * 160 };
  }

  tipp(ctx) {
    // ctx in Koordinaten von flaeche.parent = c
    let best = null;
    let bestD = Infinity;
    if (ctx && ctx.y < VORNE_Y - 170) {
      for (const b of this.ballons) {
        if (!b.da) continue;
        const k = this.kopf(b);
        const d = Math.hypot(k.x - ctx.x, k.y - ctx.y);
        if (d < bestD) { bestD = d; best = b; }
      }
    }
    if (best) {
      this.plopp(best);
      return;
    }
    // am Pfosten (oder alle Ballons gerade weg): Pfosten wackelt, Klack
    fx.wobble(this.pfosten, 0.06);
    sfx('common/klack', { vol: 0.6 });
  }

  plopp(b) {
    const s = this.s;
    if (!b.da) return;
    b.da = false;
    if (s.t - (this._ploppZeit ?? -9) > 0.15) {   // gleiche Töne nicht übereinander stapeln
      this._ploppZeit = s.t;
      sfx('common/ballon');
    }
    const kopf = this.kopf(b);
    fx.burst('funkeln', kopf.x, kopf.y, { count: 4, parent: this.c, z: 1000 });
    s.tween(b, { scale: b.ruhe * 1.15, alpha: 0 }, 0.3, { ease: 'sineOut' }).then(() => {
      if (b.destroyed) return;
      b.visible = false;
      // nach einer Weile ist ein neuer Ballon da
      s.after(rand(3.5, 5), () => {
        if (b.destroyed) return;
        b.visible = true;
        b.scale.set(b.ruhe * 0.3);
        s.tween(b, { alpha: 1 }, 0.6, { ease: 'sineInOut' });
        s.tween(b, { scale: b.ruhe }, 0.9, { ease: 'backOut' }).then(() => { b.da = true; });
      });
    });
  }

  update(dt) {
    const t = this.s.t;
    for (const b of this.ballons) b.rotation = b.ruheR + Math.sin(t * 0.8 + b.phase) * 0.05;
  }

  hinweise() {
    const b = this.ballons.find((x) => x.da);
    return b ? [b] : [];
  }
}

export { clamp };
