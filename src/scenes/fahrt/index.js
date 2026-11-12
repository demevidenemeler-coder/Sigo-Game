// Zugfahrt: eine endlose, gemütliche Fahrt von der Seite.
//
// Der Zug des Kindes (ladeZug) steht links der Mitte, die Landschaft zieht in Ebenen vorbei (Himmel, ferne Berge,
// Hügel, Wiese, Gras ganz vorn). Entlang der Strecke kommen in loser, gemischter Folge „Stationen"
// (stationen.js: Apfelbaum, Bahnhof, Tunnel, Xylophon-Brücke, Tier auf dem Gleis, Bahnübergang, Waschbogen,
// Luftballons), dazwischen Bäume, Büsche, Häuser, Mühle, Teich, Zaun, Heu, Blumen (deko.js). Am Himmel: Sonne/Mond,
// Wolken, Heißluftballon, Vogel; über der Wiese ab und zu ein Schmetterling.
//
// Bedienung:
//   Fahr-Hebel rechts (mittlere Höhe, auf einem Holz-Schaltpult)  Tipp → Fahren/Halten; an einem Halt: weiter
//   Pfeifen-Seil oben rechts           Tipp → Pfiff + Dampf (ein Tier auf dem Gleis hüpft davon)
//   Lok                                Tipp → Pfiff (an einem Halt: weiter)
//   Wagen                              Tipp → Gäste freuen sich; am Bahnhof steigt der Gast aus
//   Wetter-Knopf oben links            Sonne → Abend → Nacht → Regen → Schnee
//
// Alles, was vorbeizieht, ist ein „Ding" (hilfen.js) mit einem Ort in der Landschaft (wx). strecke = gefahrene
// Strecke; Bildschirm-x eines Dings = wx − strecke. Vor dem rechten Rand wird geplant, hinter dem linken abgebaut.

import {
  Scene, stage, spr, tex, sfx, voice, tap, fx, ui, ambient, store, rand, pick, clamp, isTest, PIXI,
} from '../../engine/index.js';
import { Zug, legeGleis, ladeZug, GAESTE_MENSCHEN, LOKS } from '../../gemeinsam/zug.js';
import { belohne } from '../../gemeinsam/sticker.js';
import {
  GLEIS_Y, LOK_X, ZUG_SKALA, TEMPO, ANFAHREN, BREMSEN, BREMSEN_MAX, Z, STATION_ABSTAND,
} from './konst.js';
import { Himmel, neueDekoHinten, neueDekoVorne } from './deko.js';
import { neueStation } from './stationen.js';

const { Container, Graphics, Rectangle, TilingSprite } = PIXI;

// Landschafts-Ebenen: Bild, Tiefe (Anteil der Fahrt), Unterkante, Größe, Ebene
const LANDSCHAFT = [
  { tex: 'fahrt/himmel', depth: 0.015, y: 1600, scale: 1, ebene: 'bg', z: -100 },
  { tex: 'fahrt/berge_fern', depth: 0.06, y: 1000, scale: 1, ebene: 'bg', z: -80 },
  { tex: 'fahrt/huegel_mitte', depth: 0.22, y: 1135, scale: 1, ebene: 'bg', z: -60 },
  { tex: 'fahrt/boden', depth: 1, y: 1600, scale: 1.04, ebene: 'world', z: Z.boden },
  { tex: 'fahrt/vorn_gras', depth: 1.3, y: 1612, scale: 0.72, ebene: 'front', z: 50 },
];

// Tageszeit/Wetter-Knopf: der Knopf zeigt den aktuellen Zustand, ein Tipp schaltet weiter
const ZUSTAENDE = [
  { icon: 'common/icon_sonne', zeit: 'tag', wetter: 'klar' },
  { icon: 'common/icon_abend', zeit: 'abend', wetter: 'klar' },
  { icon: 'common/icon_mond', zeit: 'nacht', wetter: 'klar' },
  { icon: 'common/icon_regen', zeit: 'tag', wetter: 'regen' },
  { icon: 'common/icon_schnee', zeit: 'tag', wetter: 'schnee' },
];

// Wer am Bahnsteig wartet (abwechselnd Tier und Mensch)
const WARTENDE_TIERE = ['hund', 'katze', 'hase', 'schwein', 'pinguin', 'ente', 'fuchs', 'baer', 'affe', 'igel', 'eule'];

// Erste Stationen in fester Reihenfolge (das Kind sieht gleich viel), danach gemischt
const ANFANG = ['bahnhof', 'bruecke', 'tier', 'ballons', 'tunnel', 'uebergang', 'apfel', 'wasch'];
const ALLE = ['apfel', 'bahnhof', 'tunnel', 'bruecke', 'tier', 'uebergang', 'wasch', 'ballons'];

const HEBEL_WINKEL = 0.42;       // Halten = nach links gekippt, Fahren = nach rechts
const HEBEL_PULT = { b: 300, oben: -410, h: 450 };   // Holz-Schaltpult unter dem Hebel (relativ zum Sockel-Fuß)
const PLANE_VORAUS = 900;        // so weit hinter dem rechten Rand wird schon aufgebaut
const ABBAU_HINTER = 500;        // so weit hinter dem linken Rand wird abgebaut

export default class Fahrt extends Scene {
  static id = 'fahrt';
  static packs = ['fahrt', 'zug', 'tiere'];
  static tiere = ['hund', 'katze', 'hase', 'schwein', 'pinguin', 'ente', 'fuchs', 'baer', 'affe', 'igel', 'eule', 'frosch', 'kuh', 'schaf', 'huhn', 'pferd'];
  static music = 'musik/fahrt';

  async enter(params = {}) {
    this.W = stage.W;
    this.strecke = 0;          // gefahrene Strecke (Einheiten)
    this.v = 0;                // Geschwindigkeit (Einheiten/s)
    this.a = 0;                // Beschleunigung (weich nachgeführt)
    this.fahren = false;       // Wunsch des Kindes (Hebel)
    this.schonGefahren = false; // ist der Zug in diesem Besuch schon einmal losgefahren (Hebel benutzt)?
    this.stehtBei = null;      // Station, an der der Zug gerade hält
    this.zustand = 0;          // Index in ZUSTAENDE
    this.wetter = 'klar';
    this.zeit = 'tag';
    this.dinge = [];
    this.belohnt = new Set();
    this.mensch = false;       // abwechselnd Tier/Mensch am Bahnsteig
    this.reserviert = new Map(); // Wagen-Index → Gast-id: Platz ist schon vergeben, der Gast hüpft noch hin

    this.baueLandschaft();
    this.baueEbenen();
    this.baueGleis();
    this.baueZug();
    this.himmel = new Himmel(this);
    this.baueBedienung();
    ui.albumKnopf(this);

    // weiche Abdunklung im Tunnel (über Landschaft und Zug, unter den Knöpfen)
    this.dunkelSchicht = new Graphics().rect(-2000, -100, 4000, 1800).fill(0x1d2440);
    this.dunkelSchicht.alpha = 0;
    this.dunkelSchicht.zIndex = 900;
    this.dunkelSchicht.eventMode = 'none';
    this.front.addChild(this.dunkelSchicht);

    // Strecke planen: am Anfang steht ein Apfelbaum gleich hinter dem Zug, dann geht es los
    this.planHinten = -this.W / 2 - 300;
    this.planVorne = -this.W / 2 - 200;
    this.sperren = [];          // belegte Abschnitte der Stationen {von, bis, hinten, vorne}
    this.folge = [...ANFANG];
    // Zum Ausprobieren: erste Station wählen (go('fahrt', {station}) oder im Test ?station=tunnel)
    const wunsch = params.station || (isTest ? new URLSearchParams(location.search).get('station') : null);
    if (ALLE.includes(wunsch)) this.folge = [wunsch, ...ANFANG.filter((a) => a !== wunsch)];
    this.letzteArt = null;
    this.setzeStation('apfel', -560);
    this.naechsteStation = 900;
    this.plane();

    voice('fahrt_hallo');
    // „Tipp auf den Hebel" nur, solange der Zug noch steht – auch, wenn der Satz erst nach der Begrüßung dran ist
    const hebelNoetig = () => !this.fahren && !this.stehtBei;
    this.after(4, () => { if (hebelNoetig()) voice('fahrt_hebel', { nurWenn: hebelNoetig }); });
  }

  // ---------------------------------------------------------------- Aufbau

  baueLandschaft() {
    this.landschaft = LANDSCHAFT.map((l) => {
      const t = tex(l.tex);
      const k = new TilingSprite({ texture: t, width: this.W + 8, height: t.height * l.scale });
      k.label = 'land:' + l.tex;
      k.tileScale.set(l.scale);
      k.anchor.set(0, 1);
      k.position.set(-this.W / 2 - 4, l.y);
      k.zIndex = l.z;
      k.eventMode = 'none';
      this[l.ebene].addChild(k);
      return { kachel: k, depth: l.depth, versatz: rand(0, t.width) };
    });
  }

  baueEbenen() {
    const eb = (name, z, sortiert = false) => {
      const c = new Container({ label: name, sortableChildren: sortiert });
      c.zIndex = z;
      this.world.addChild(c);
      return c;
    };
    this.ebHinten = eb('hinten', Z.hinten, true);
    this.ebStrasse = eb('strasse', Z.strasse);
    this.ebBruecke = eb('bruecke', Z.bruecke);
    this.ebAufGleis = eb('aufGleis', Z.aufGleis);
    this.ebVorn = eb('vorn', Z.vorn);
    this.ebVorne = eb('vorne', Z.vorne, true);
    this.ebFlug = eb('flug', Z.flug, true);
  }

  baueGleis() {
    const breite = this.W / 2 + 80;
    this.gleisVon = -breite;
    this.gleis = legeGleis(this.world, { y: GLEIS_Y, von: -breite, bis: breite, z: Z.gleis });
    // zweites Stück rechts einer Brücke (die Brücke hat eine Lücke in der Schiene)
    this.gleis2 = legeGleis(this.world, { y: GLEIS_Y, von: 0, bis: 10, z: Z.gleis });
    this.gleis2.sprite.visible = false;
  }

  baueZug() {
    this.zug = new Zug({
      konfig: ladeZug(), x: LOK_X, y: GLEIS_Y, scale: ZUG_SKALA, parent: this.world, szene: this, z: Z.zug, bezug: 'lok',
    });
    const zug = this.zug;
    tap(zug.lok, () => this.lokTipp(), { sound: null, pad: 30 });
    for (const w of zug.wagen) this.wagenTippbar(w);
    zug.on('wagen', (w) => this.wagenTippbar(w));
    zug.on('lok', (l) => tap(l, () => this.lokTipp(), { sound: null, pad: 30 }));

    // Maße für die Stationen
    const lb = this.inWelt(zug.lok.getBounds());
    this.lokBreite = lb.w;
    this.lokRadX = zug.punktLok('rad2')?.x ?? LOK_X - 60;
    this.zugHeck = LOK_X - zug.laenge;
    this.fahrzeuge = [zug.lok, ...zug.wagen.map((w) => w.fahrzeug)].map((f, nr) => {
      const b = this.inWelt(f.getBounds());
      return { nr, mitte: b.x + b.w / 2, oben: b.y };
    });
  }

  // Grenzen (global) → Welt-Koordinaten {x, y, w, h}
  inWelt(b) {
    const a = this.world.toLocal({ x: b.x, y: b.y });
    const c = this.world.toLocal({ x: b.x + b.width, y: b.y + b.height });
    return { x: a.x, y: a.y, w: c.x - a.x, h: c.y - a.y };
  }

  wagenTippbar(w) {
    // ganzer Wagen samt Gast darüber; Wagenbilder sind flach – die Fläche reicht deshalb weit nach oben
    const f = w.koerper;
    const b = f.getLocalBounds();
    const s = ZUG_SKALA;
    const breite = Math.max(b.width, 240 / s);
    const oben = b.y - 120;
    const hoehe = Math.max(b.y + b.height - oben, 260 / s);
    tap(f, () => this.wagenTipp(w), {
      sound: null, squash: false, hitArea: new Rectangle(b.x + b.width / 2 - breite / 2, oben, breite, hoehe),
    });
  }

  baueBedienung() {
    // Fahr-Hebel: rechts auf mittlerer Höhe (unten rechts bleibt frei). Er steht auf einem runden Holz-Schaltpult,
    // damit er sich deutlich als Knopf liest und nicht wie ein Ding der Landschaft, das nicht mitfährt.
    const h = new Container({ label: 'hebel' });
    h.zIndex = 50;
    const pult = new Graphics()
      .roundRect(-HEBEL_PULT.b / 2 + 6, HEBEL_PULT.oben + 10, HEBEL_PULT.b, HEBEL_PULT.h, 80)
      .fill({ color: 0x3a2a1a, alpha: 0.16 })
      .roundRect(-HEBEL_PULT.b / 2, HEBEL_PULT.oben, HEBEL_PULT.b, HEBEL_PULT.h, 80)
      .fill(0xbf8752)
      .roundRect(-HEBEL_PULT.b / 2 + 14, HEBEL_PULT.oben + 14, HEBEL_PULT.b - 28, HEBEL_PULT.h - 28, 68)
      .fill(0xf4e2bf)
      .roundRect(-HEBEL_PULT.b / 2 + 30, HEBEL_PULT.oben + 26, HEBEL_PULT.b - 60, 46, 23)
      .fill({ color: 0xffffff, alpha: 0.35 });
    const skala = 0.72;
    const sockel = spr('fahrt/hebel_sockel', { scale: skala });
    const dreh = { x: (151 - 0.5 * 303) * skala, y: (75 - 0.98 * 182) * skala };
    const griff = spr('fahrt/hebel_griff', { x: dreh.x, y: dreh.y, scale: skala, rotation: -HEBEL_WINKEL });
    h.addChild(pult, griff, sockel);
    h.hitArea = new Rectangle(-HEBEL_PULT.b / 2, HEBEL_PULT.oben, HEBEL_PULT.b, HEBEL_PULT.h);
    this.hud.addChild(h);
    this.hebel = h;
    this.hebelGriff = griff;
    tap(h, () => this.hebelTipp(), { sound: null, squash: false });

    // Pfeifen-Seil: oben rechts neben dem Album-Knopf
    const seil = spr('fahrt/pfeife_seil', { scale: 1.25 });
    seil.hitArea = new Rectangle(-105, 70, 210, 215);
    seil.zIndex = 50;
    this.hud.addChild(seil);
    this.seil = seil;
    tap(seil, () => this.seilZiehen(), { sound: null, squash: false });

    // Tageszeit- und Wetter-Knopf: oben links neben dem Karten-Knopf
    this.wetterKnopf = ui.button(ZUSTAENDE[0].icon, { size: 200, parent: this.hud, onTap: () => this.naechsterZustand() });
    this.wetterKnopf.zIndex = 50;
    this.ordneBedienung();
  }

  ordneBedienung() {
    const W = this.W;
    // Pult: x W−405…W−105, y 655…1105 – frei bleiben die Ecke unten rechts (240 × 240) und Platz für die Zeige-Hand
    this.hebel.position.set(W - 255, 1065);
    const album = ui.albumPos();
    // zwischen Seil, Album- und Karten-Knopf bleibt eine Lücke von mindestens 50 Einheiten; oben 70 frei
    this.seil.position.set(album.x - 300, 0);
    this.wetterKnopf.position.set(470, 200);
  }

  resize(W) {
    this.W = W;
    for (const l of this.landschaft) {
      l.kachel.width = W + 8;
      l.kachel.x = -W / 2 - 4;
    }
    const breite = W / 2 + 80;
    this.gleisVon = -breite;
    this.gleis.sprite.x = -breite;
    this.gleis.sprite.width = 2 * breite;
    this.ordneBedienung();
  }

  // ---------------------------------------------------------------- Bedienung

  hebelTipp() {
    const s = this.stehtBei;
    if (s && s.haltBei() !== null) {
      s.weiter();            // Station gibt frei (ruft losfahren)
      if (!this.fahren) this.losfahren();
      return;
    }
    if (this.fahren) this.anhalten();
    else this.losfahren();
  }

  losfahren() {
    this.stehtBei = null;
    if (this.fahren) return;
    this.fahren = true;
    // Ab jetzt kennt das Kind den Hebel: erst dann darf die Stimme auf andere Dinge hinweisen (Apfelbaum), damit
    // „Tipp auf den Hebel …" am Anfang der letzte – und damit der wiederholte – Hinweis bleibt
    this.schonGefahren = true;
    this.kippeHebel();
  }

  anhalten() {
    if (!this.fahren) return;
    this.fahren = false;
    this.kippeHebel();
  }

  kippeHebel() {
    sfx('common/klack', { vol: 0.7 });
    this.tween(this.hebelGriff, { rotation: this.fahren ? HEBEL_WINKEL : -HEBEL_WINKEL }, 0.5, { ease: 'backOut' });
    if (this.fahren) this.after(0.25, () => this.zug.pfeife());
  }

  seilZiehen() {
    const s = this.seil;
    if (!s.ziehen) {
      s.ziehen = true;
      this.tween(s, { y: 55 }, 0.14, { ease: 'quadOut' })
        .then(() => this.tween(s, { y: 0 }, 0.6, { ease: 'elasticOut' }))
        .then(() => { s.ziehen = false; });
    }
    this.pfeifen();
  }

  pfeifen() {
    if (!this.zug.pfeife()) return;
    // Tiere auf dem Gleis, die man schon sieht, hüpfen beiseite
    for (const d of this.dinge) {
      if (d.art === 'tier' && !d.weg && d.wx - this.strecke < this.W / 2 + 50) d.weiter();
    }
  }

  lokTipp() {
    fx.wobble(this.zug.lok.huepfer, 0.02);
    this.pfeifen();
    const s = this.stehtBei;
    if (s && s.haltBei() !== null && s.art === 'bahnhof') this.after(0.5, () => s.weiter());
  }

  wagenTipp(w) {
    const s = this.stehtBei;
    if (s && s.art === 'bahnhof' && w.gast && s.da) {
      if (s.aussteigen(w)) return;
    }
    w.fahrzeug.wackel(0.02);
    if (w.gast) this.zug.gaesteJubeln(w.index);
    else sfx('common/klack', { vol: 0.6 });
  }

  naechsterZustand() {
    this.zustand = (this.zustand + 1) % ZUSTAENDE.length;
    const z = ZUSTAENDE[this.zustand];
    this.zeit = z.zeit;
    this.wetter = z.wetter;
    this.wetterKnopf.setIcon(z.icon);
    ambient.set({ zeit: z.zeit, wetter: z.wetter }, { dauer: 2.5 });
    this.himmel.setze(z.zeit, z.wetter);
  }

  // ---------------------------------------------------------------- Hilfen für die Stationen

  /** Wo die Mitte eines Bahnhofs beim Halt steht (Bildschirm-x). */
  platzZiel() {
    return LOK_X + 200;
  }

  /** Erster Sitz-Wagen ohne Gast, der auch nicht schon für einen hüpfenden Gast vergeben ist (sonst -1). */
  freierSitz() {
    return this.zug.wagen.findIndex((w) => w.platz?.art === 'sitz' && !w.gast && !this.reserviert.has(w.index));
  }

  /** Wer als Nächstes am Bahnsteig wartet (nicht schon im Zug oder an einem anderen Bahnhof). */
  wartenderGast() {
    const besetzt = new Set([...this.zug.wagen.map((w) => w.gastId).filter(Boolean), ...this.reserviert.values()]);
    for (const d of this.dinge) if (d.fahrgaeste) for (const f of d.fahrgaeste) if (f.id) besetzt.add(f.id);
    this.mensch = !this.mensch;
    const liste = (this.mensch ? GAESTE_MENSCHEN : WARTENDE_TIERE).filter((id) => !besetzt.has(id));
    return pick(liste.length ? liste : WARTENDE_TIERE);
  }

  /** Ein Luftballon fliegt davon (weich nach oben, verblasst). */
  ballonLoslassen(b) {
    if (!b || b.destroyed) return;
    const p = this.ebFlug.toLocal(b.getGlobalPosition());
    this.ebFlug.addChild(b);
    b.position.set(p.x, p.y);
    b.eventMode = 'none';
    this.tween(b, { y: p.y - 760, rotation: 0.12 }, 6, { ease: 'sineIn' });
    this.tween(b, { x: p.x + 140 }, 6, { ease: 'sineInOut' });
    this.tween(b, { alpha: 0 }, 2, { ease: 'sineInOut', delay: 4 }).then(() => { if (!b.destroyed) b.destroy(); });
  }

  /** Ein Apfel aus dem Baum hüpft im Bogen in einen Wagen. */
  apfelInDenZug(a, letzter) {
    const zug = this.zug;
    if (!a || a.destroyed || zug.destroyed) return;
    const g = a.getGlobalPosition();
    const start = this.ebFlug.toLocal(g);
    const skala = Math.abs(a.worldTransform.a) / (stage.scale || 1);
    const ap = spr('fahrt/apfel', { x: start.x, y: start.y, scale: skala, parent: this.ebFlug });
    ap.eventMode = 'none';
    // Ziel: am liebsten ein Wagen mit Gast, sonst irgendein Wagen, sonst die Lok
    const mitGast = zug.wagen.filter((w) => w.gast);
    const w = pick(mitGast.length ? mitGast : zug.wagen);
    const ziel = w ? w.fahrzeug : zug.lok;
    const b = this.inWelt(ziel.koerper.getBounds());
    const zx = b.x + b.w / 2 + rand(-50, 50);
    const zy = b.y + 40;
    const p = { t: 0 };
    sfx('common/hupf', { vol: 0.5 });
    this.tween(p, { t: 1 }, 0.8, {
      ease: 'linear',
      onUpdate: () => {
        if (ap.destroyed) return;
        const k = p.t;
        ap.x = start.x + (zx - start.x) * k;
        ap.y = start.y + (zy - start.y) * k - 260 * 4 * k * (1 - k);
        ap.rotation = k * 4;
      },
    }).then((ok) => {
      if (!ok || ap.destroyed) return;
      sfx('common/plopp', { vol: 0.6 });
      fx.pop(ziel.rumpf, 0.04);
      this.tween(ap, { alpha: 0, scale: skala * 0.5 }, 0.25, { ease: 'sineInOut' }).then(() => { if (!ap.destroyed) ap.destroy(); });
      if (letzter) {
        if (w && w.gast) zug.gaesteJubeln(w.index);
        else fx.burst('herzen', zx, zy - 30, { count: 3, parent: this.front });
      }
    });
  }

  /** Weich dunkler (Tunnel) und wieder hell. */
  dunkel(an) {
    this.tween(this.dunkelSchicht, { alpha: an ? 0.3 : 0 }, an ? 0.9 : 1.2, { ease: 'sineInOut' });
  }

  /**
   * Sticker – je Art nur einmal pro Fahrt. id 'lok' = eine Lok, die noch fehlt (sonst die eigene).
   * (x, y) in Koordinaten von `parent`.
   */
  belohneEinmal(art, id, parent, x, y) {
    if (this.belohnt.has(art)) return;
    this.belohnt.add(art);
    if (id === 'lok') id = this.lokSticker();
    const p = this.front.toLocal(parent.toGlobal({ x, y }));
    belohne(this, id, p.x, p.y);
  }

  lokSticker() {
    const da = new Set(store.stickers());
    const eigene = this.zug.lok?.typ || 'lok_dampf';
    if (!da.has(eigene)) return eigene;
    return LOKS.find((l) => !da.has(l)) || eigene;
  }

  // ---------------------------------------------------------------- Strecke planen

  setzeStation(art, linkeKante) {
    const d = neueStation(this, art, linkeKante);
    this.dinge.push(d);
    this.letzteArt = art;
    this.sperren.push({
      von: d.wx + d.links, bis: d.wx + d.rechts, hinten: d.sperrtHinten !== false, vorne: !!d.vorneBelegt,
    });
    d.setze(d.wx - this.strecke);
    return d;
  }

  naechsteArt() {
    if (!this.folge.length) {
      // neue Runde: gemischt, aber nie zweimal dasselbe hintereinander
      const neu = [...ALLE].sort(() => Math.random() - 0.5);
      if (neu[0] === this.letzteArt) neu.push(neu.shift());
      this.folge = neu;
    }
    return this.folge.shift();
  }

  // Liegt [von, bis] in einem gesperrten Abschnitt? → Ende des Abschnitts, sonst null
  gesperrt(von, bis, reihe) {
    for (const s of this.sperren) {
      if (!s[reihe]) continue;
      if (bis > s.von && von < s.bis) return s.bis;
    }
    return null;
  }

  plane() {
    const rechts = this.strecke + this.W / 2 + PLANE_VORAUS;
    // Stationen weit voraus, damit die Deko ihnen ausweichen kann
    while (this.naechsteStation < rechts + 1400) {
      const d = this.setzeStation(this.naechsteArt(), this.naechsteStation);
      this.naechsteStation = d.wx + rand(STATION_ABSTAND[0], STATION_ABSTAND[1]) - 300;
    }
    // Dinge hinter dem Gleis
    let schutz = 0;
    while (this.planHinten < rechts && schutz++ < 20) {
      const kante = this.planHinten + rand(40, 320);
      const ohne = ['haus', 'scheune', 'muehle', 'teich'].includes(this.letzteHinten) ? ['haus', 'scheune', 'muehle', 'teich'] : [];
      const d = neueDekoHinten(this, kante, { ohne });
      const ende = this.gesperrt(d.wx + d.links, d.wx + d.rechts, 'hinten');
      if (ende !== null) {
        d.zerstoere();
        this.planHinten = ende + 20;
        continue;
      }
      this.letzteHinten = d.art;
      this.dinge.push(d);
      d.setze(d.wx - this.strecke);
      this.planHinten = d.wx + d.rechts;
    }
    // vordere Reihe: locker
    schutz = 0;
    while (this.planVorne < rechts && schutz++ < 20) {
      const kante = this.planVorne + rand(450, 1300);
      const d = neueDekoVorne(this, kante);
      const ende = this.gesperrt(d.wx + d.links - 60, d.wx + d.rechts + 60, 'vorne');
      if (ende !== null) {
        d.zerstoere();
        this.planVorne = ende + 40;
        continue;
      }
      this.dinge.push(d);
      d.setze(d.wx - this.strecke);
      this.planVorne = d.wx + d.rechts;
    }
  }

  abbauen() {
    const links = this.strecke - this.W / 2 - ABBAU_HINTER;
    let j = 0;
    for (let i = 0; i < this.dinge.length; i++) {
      const d = this.dinge[i];
      if (d.wx + d.rechts < links && d !== this.stehtBei) d.zerstoere();
      else this.dinge[j++] = d;
    }
    this.dinge.length = j;
    if (this.sperren.length && this.sperren[0].bis < links) this.sperren = this.sperren.filter((s) => s.bis >= links);
  }

  // ---------------------------------------------------------------- Ablauf

  update(dt) {
    // Wer hält den Zug auf? (nächster Halt voraus)
    let halt = null;
    let haltDist = Infinity;
    for (const d of this.dinge) {
      const h = d.haltBei();
      if (h === null || h === undefined) continue;
      const dist = h - this.strecke;
      if (dist > -5 && dist < haltDist) {
        haltDist = dist;
        halt = d;
      }
    }

    // Wunsch-Tempo: Hebel, und vor einem Halt so, dass weich gebremst werden kann
    let vSoll = this.fahren ? TEMPO : 0;
    if (halt) vSoll = Math.min(vSoll, Math.sqrt(2 * BREMSEN * Math.max(0, haltDist)));
    const aSoll = clamp((vSoll - this.v) * 1.6, -BREMSEN_MAX, ANFAHREN);
    this.a += (aSoll - this.a) * (1 - Math.exp(-dt * 3.5));
    this.v = Math.max(0, this.v + this.a * dt);
    let dx = this.v * dt;
    if (halt && dx > haltDist) dx = Math.max(0, haltDist);
    if (halt && haltDist - dx < 2 && this.v < 25) {
      // angekommen
      dx = Math.max(0, haltDist);
      this.v = 0;
      this.a = 0;
      if (!halt._haltDa) {
        halt._haltDa = true;
        this.stehtBei = halt;
        halt.angekommen();
      }
    }
    this.strecke += dx;
    this.zug.geschwindigkeit = dx / Math.max(dt, 1e-4);
    this.zug.update(dt);
    this.gleis.rolle(dx);

    // Landschaft
    for (const l of this.landschaft) l.kachel.tilePosition.x = -(this.strecke * l.depth) + l.versatz;

    // Dinge an der Strecke
    let bruecke = null;
    for (const d of this.dinge) {
      const sx = d.wx - this.strecke;
      d.setze(sx);
      d.update(dt, sx);
      if (d.art === 'bruecke' && sx + d.rechts > -this.W / 2 && sx + d.links < this.W / 2) bruecke = d;
    }
    this.gleisLuecke(bruecke);

    this.himmel.update(dt, this.v);
    this.plane();
    this.abbauen();
  }

  // Schiene unter der Xylophon-Brücke aussparen (zwei Stücke links und rechts)
  gleisLuecke(bruecke) {
    const g1 = this.gleis.sprite;
    const g2 = this.gleis2.sprite;
    const von = this.gleisVon;
    const bis = -von;
    if (!bruecke) {
      if (g2.visible || !g1.visible || g1.width !== bis - von) {
        g2.visible = false;
        g1.visible = true;
        g1.width = bis - von;
      }
      return;
    }
    const [a, b] = bruecke.luecke(bruecke.wx - this.strecke);
    g1.width = clamp(a - von, 0, bis - von);
    g1.visible = g1.width > 1;
    const r = clamp(b, von, bis);
    g2.visible = bis - r > 1;
    g2.x = r;
    g2.width = Math.max(1, bis - r);
    g2.tilePosition.x = g1.tilePosition.x + von - r;
  }

  hints() {
    const liste = [];
    const s = this.stehtBei;
    if (s) liste.push(...s.hinweise());
    if (s || !this.fahren) liste.push(this.hebel);
    if (!s) {
      for (const d of this.dinge) {
        const sx = d.wx - this.strecke;
        if (sx > -this.W / 2 + 200 && sx < this.W / 2 - 300) liste.push(...d.hinweise());
      }
      liste.push(this.zug.lok);
    }
    return liste;
  }

  exit() {
    for (const d of this.dinge) d.zerstoere();
    this.dinge.length = 0;
  }
}

export { GAESTE_MENSCHEN };
