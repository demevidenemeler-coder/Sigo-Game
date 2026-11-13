// Güterbahnhof: die zweite Seite des Bahnhofs (Pfeil rechts auf der ersten Seite).
//
// Zwei neue Abläufe, die das Kind in beliebiger Reihenfolge spielen kann – die Zeige-Hand zeigt erst die Lok, dann
// den Kran:
//
//   Lok aus dem Schuppen holen                                                     (4 Schritte, je ein Tipp)
//     1. Im Tor des Lokschuppens schläft eine Lok (kleine Z steigen auf). Antippen → sie wacht auf und pfeift.
//     2. Lok antippen → sie rollt aus dem Schuppen auf die Drehscheibe (sie schaut noch nach links).
//     3. Drehscheibe (oder Lok) antippen → die Scheibe surrt, die Lok dreht sich um und schaut nach rechts.
//     4. Lok antippen → sie rollt rückwärts an die Güterwagen und kuppelt an (Klonk, die Wagen hüpfen).
//
//   Güterwagen mit dem Kran beladen                                                (je Ladung 2 Tipps, 3 Ladungen)
//     Jeder Wagen trägt vorn ein Schild mit dem Bild seiner Ladung. Auf der Wiese davor liegt genau diese Ladung.
//     a) Ladung antippen → die Laufkatze fährt hin, der Haken senkt sich und hebt die Ladung hoch.
//     b) Den passenden Wagen antippen → der Kran fährt hin und setzt die Ladung hinein.
//        Ein anderer Wagen? Der Kran fährt erst dorthin, die Ladung wackelt, das richtige Schild hüpft – und der
//        Kran bringt sie dann von selbst zum richtigen Wagen. Nichts kann schiefgehen.
//   Zum Schluss: Lok antippen → Pfiff, der Güterzug fährt hinaus. Ein Sticker, eine Blume mehr auf der Wiese.
//
// Abwechslung: jede Runde eine andere Lok im Schuppen (nie zweimal dieselbe), andere Ladungen (3 aus 6, nie
// dieselbe Auswahl hintereinander) und andere Wagen-Farben, Ladungen liegen in anderer Reihenfolge. Manchmal sitzt
// ein Tier auf einer Ladung und fährt mit; manchmal fährt nach der Abfahrt ein Personenzug durch und die Gäste winken.
// Was wächst: Für jeden abgefahrenen Güterzug blüht eine Blume mehr auf der Wiese (höchstens 10, store bahnhof.blumen).
//
// Koordinaten: Die Seite hat eigene Container (hinten/welt/vorn in bg/world/front der Szene, um WEITE nach rechts
// versetzt; hud in hud). Ruht die Seite, gilt x = 0 in der Bildmitte – wie auf der ersten Seite.

import {
  stage, spr, sfx, sfxSchleife, voice, note, tap, Actor, fx, ui, store, killTweensOf, pick, shuffle, clamp, PIXI,
} from '../../engine/index.js';
import { Zug, Fahrzeug, legeGleis, LOKS } from '../../gemeinsam/zug.js';
import { belohne, stickerFuerOrt } from '../../gemeinsam/sticker.js';

const { Container, Graphics, Sprite, Texture, Rectangle } = PIXI;

const HG = 'bahnhof/hg_gueter';
const GLEIS_Y = 1285;            // Lauffläche (Mitte des Schotterstreifens im Bild)
const HOF_Y = 1192;              // Boden hinter dem Gleis (Lokschuppen, Kran)
const WIESE_Y = 1525;            // Boden der Wiese vorn (Ladungen, Blumen)
const S = 0.38;                  // Größe des Güterzugs
const LOK_X = 150;               // Mitte der Lok, wenn sie angekuppelt ist
const DREH_X = 330;              // Mitte der Drehscheibe
const SCHUPPEN_X = 830;
const SCHUPPEN_S = 1.05;
// Tor des Schuppens (im Bild x 80…290, Bogen ab y≈300, Boden 530 – Anker 418/530; Einheiten des Bildes)
const TOR_L = SCHUPPEN_X - 338 * SCHUPPEN_S;
const TOR_R = SCHUPPEN_X - 128 * SCHUPPEN_S;
const TOR_OBEN = HOF_Y - 236 * SCHUPPEN_S;
const KRAN_X = -960;
const SCHIENE_Y = HOF_Y - (0.981 * 665 - 185);   // Unterkante des Kranarms (Laufschiene)
const KATZE_MIN = -775;
const KATZE_MAX = 45;
const HAKEN_RUHE = 860;
const HAKEN_UNTEN = 66;          // so weit unter der Haken-Mitte hängt die Ladung
const TRAGE_UNTERKANTE = 1060;   // beim Tragen schwebt die Ladung mit ihrer Unterkante hier (über den Wagen)
const KATZE_TEMPO = 420;         // Einheiten/s (ruhig)
const HAKEN_TEMPO = 450;
const PLAETZE = [-770, -470, -170];   // Ladungen auf der Wiese
const MAX_BLUMEN = 10;
const OFFENE = ['wagen_offen_rot', 'wagen_offen_blau', 'wagen_offen_gelb', 'wagen_offen_gruen', 'wagen_offen_lila', 'wagen_offen_orange'];
const LOK_RAD = { lok_dampf: 'zug/rad_gross', lok_diesel: 'zug/rad_blau', lok_gruen: 'zug/rad_klein', lok_schnell: 'zug/rad_klein' };
const DAMPFLOKS = new Set(['lok_dampf', 'lok_gruen']);
const GUETER = ['bahnhof/ladung_staemme', 'zug/ladung_kiste', 'zug/ladung_milchkanne', 'zug/ladung_fass',
  'zug/ladung_heuballen', 'zug/ladung_apfelkorb'];
const MITFAHRER = ['katze', 'maus', 'huhn', 'igel', 'hase', 'ente'];
const PERSONEN_GAESTE = ['kuh', 'schaf', 'hund', 'pinguin', 'affe', 'baer', 'giraffe', 'frosch'];
const BLUMEN_FARBEN = [0xf28bb0, 0xf6c445, 0xe8564a, 0xa77bd6, 0x6fb6e8, 0xf2903a];
const STICKER_NEU = ['bahnhof_lokschuppen', 'bahnhof_kran', 'bahnhof_baumstaemme'];
const STIMME = {
  schlaeft: 'bahnhof_schuppen', draussen: 'bahnhof_drehscheibe', gedreht: 'bahnhof_ankuppeln',
  kran: 'bahnhof_kran', wagen: 'bahnhof_wagenbild', los: 'bahnhof_gueterzug',
};

// Ein Ding (ohne Drehung) in einen anderen Container umhängen – es bleibt, wo es ist, und gleich groß.
function weltSkala(c) {
  const a = c.toGlobal({ x: 0, y: 0 });
  const b = c.toGlobal({ x: 1, y: 0 });
  return Math.hypot(b.x - a.x, b.y - a.y) || 1;
}
function umhaengen(obj, ziel) {
  const g = obj.parent.toGlobal(obj.position);
  const faktor = weltSkala(obj.parent) / weltSkala(ziel);
  const p = ziel.toLocal(g);
  ziel.addChild(obj);
  obj.position.set(p.x, p.y);
  obj.scale.set(obj.scale.x * faktor, obj.scale.y * faktor);
}

export class Gueterbahnhof {
  constructor(szene, weite) {
    this.s = szene;
    this.szene = szene;     // für belohne()
    this.weite = weite;
    this.hinten = new Container({ label: 'gueter:hinten', sortableChildren: true });
    this.welt = new Container({ label: 'gueter:welt', sortableChildren: true });
    this.vorn = new Container({ label: 'gueter:vorn', sortableChildren: true });
    this.hud = new Container({ label: 'gueter:hud', sortableChildren: true });
    this.hinten.zIndex = -400;
    for (const c of [this.hinten, this.welt, this.vorn]) c.x = weite;
    szene.bg.addChild(this.hinten);
    szene.world.addChild(this.welt);
    szene.front.addChild(this.vorn);
    szene.hud.addChild(this.hud);
    this.aktiv = false;
    this._zeit = 0;
    this._toene = new Map();
    this.zug = null;
    this.lok = null;               // die Lok aus dem Schuppen (bis sie angekuppelt ist)
    this.lokZustand = 'leer';      // 'schlaeft' → 'wach' → 'draussen' → 'gedreht' → 'dran'
    this.lokBeschaeftigt = false;
    this.kranZustand = 'frei';     // 'frei' | 'holt' | 'traegt' | 'bringt'
    this.gueter = [];
    this.faehrt = false;
    this.ankunft = false;          // Wagen rollen gerade herein
    this.schritt = '';
    this.baue();
    this.neueRunde(true);
  }

  // ---------------------------------------------------------------- Aufbau

  baue() {
    const hg = spr(HG, { parent: this.hinten, anchor: 0.5 });
    hg.scale.set(1600 / hg.height);
    hg.position.set(0, 800);
    hg.eventMode = 'none';

    this.gleis = legeGleis(this.welt, { y: GLEIS_Y, z: 4, scale: 0.5 });

    // Lokschuppen (hinter dem Gleis): antippen weckt die Lok bzw. lässt Rauch aus dem Schornstein steigen
    this.schuppen = spr('bahnhof/lokschuppen', { x: SCHUPPEN_X, y: HOF_Y, scale: SCHUPPEN_S, parent: this.welt, z: 2 });
    tap(this.schuppen, () => this.schuppenTipp(), { sound: null, squash: false });
    // dunkler Grund im Tor, damit die Lok „drinnen" steht; Maske: alles links vom Tor und das Tor selbst
    this.maske = new Graphics()
      .rect(-3000, -200, 3000 + TOR_L + 12, 2400).fill(0xffffff)
      .roundRect(TOR_L, TOR_OBEN, TOR_R - TOR_L, HOF_Y - TOR_OBEN + 30, 100).fill(0xffffff);
    this.welt.addChild(this.maske);

    // Drehscheibe im Gleis
    this.dreh = new Container({ label: 'drehscheibe' });
    this.dreh.position.set(DREH_X, GLEIS_Y - 6);
    this.dreh.zIndex = 5;
    this.drehBild = spr('bahnhof/drehscheibe', { anchor: 0.5, scale: 0.8, parent: this.dreh });
    this.welt.addChild(this.dreh);
    tap(this.dreh, () => this.drehTipp(), { sound: null, squash: false, hitArea: new Rectangle(-250, -230, 500, 300) });

    // Kran: Turm links hinter dem Gleis, Arm über den Wagen; Laufkatze, Seil und Haken bewegen sich
    this.kran = spr('bahnhof/kran', { x: KRAN_X, y: HOF_Y, parent: this.welt, z: 3 });
    tap(this.kran, () => {
      fx.wobble(this.kran, 0.01);
      if (this.ton('common/kran', 1.2, { vol: 0.35 }) && this.kranZustand === 'frei') this.hakenWippen();
    }, {
      sound: null,
      squash: false,
      // nur Turm und Arm (unter dem Arm ist Luft – dort liegen Wagen und Ladungen)
      hitArea: { contains: (x, y) => x > -175 && y > -665 && y < 20 && (x < 190 || (x < 1140 && y < -440)) },
    });
    this.katze = new Graphics()
      .roundRect(-44, -4, 88, 34, 13).fill(0xd9473b).stroke({ width: 4, color: 0x8f2d24, alpha: 0.6 })
      .circle(-24, -4, 10).fill(0x6b4a30).circle(24, -4, 10).fill(0x6b4a30);
    this.katze.position.set(-400, SCHIENE_Y + 6);
    this.katze.zIndex = 7;
    this.katze.eventMode = 'none';
    this.welt.addChild(this.katze);
    this.seil = new Sprite(Texture.WHITE);
    this.seil.anchor.set(0.5, 0);
    this.seil.tint = 0x7a5a3a;
    this.seil.width = 7;
    this.seil.zIndex = 7;
    this.seil.eventMode = 'none';
    this.welt.addChild(this.seil);
    this.haken = new Container({ label: 'haken' });
    this.haken.position.set(-400, HAKEN_RUHE);
    this.haken.zIndex = 7.1;
    spr('bahnhof/kranhaken', { anchor: 0.5, scale: 0.62, parent: this.haken });
    this.welt.addChild(this.haken);
    tap(this.haken, () => this.hakenTipp(), { sound: null, squash: false, hitArea: new Rectangle(-110, -110, 220, 260) });
    this.kranTon = sfxSchleife('common/kran', { vol: 0.3 });

    // Blumen (wachsen über die Besuche)
    this.blumen = [];
    const n = clamp(store.get('bahnhof.blumen', 0) | 0, 0, MAX_BLUMEN);
    for (let i = 0; i < n; i++) this.neueBlume(i, false);

    // Pfeil zurück zum Bahnsteig
    this.pfeilLinks = ui.button('common/icon_pfeil_links', {
      size: 220, parent: this.hud, sound: null, onTap: () => this.s.zeigeSeite(0),
    });
    this.pfeilLinks.label = 'pfeilLinks';
    this.ordne();
  }

  ordne() {
    this.pfeilLinks?.position.set(175, 840);
  }

  // ---------------------------------------------------------------- Runde

  neueRunde(sofort = false) {
    this.faehrt = false;
    // Lok: nie zweimal dieselbe hintereinander
    const letzteLok = store.get('bahnhof.gueterlok', null);
    const lokTyp = pick(LOKS.filter((l) => l !== letzteLok));
    store.set('bahnhof.gueterlok', lokTyp);
    // Ladungen: 3 aus 6, nie dieselbe Auswahl hintereinander
    const letzte = store.get('bahnhof.gueter', '');
    let wahl;
    for (let i = 0; i < 8; i++) {
      wahl = shuffle(GUETER).slice(0, 3);
      if ([...wahl].sort().join() !== letzte) break;
    }
    store.set('bahnhof.gueter', [...wahl].sort().join());
    // Wagen: Baumstämme brauchen den Flachwagen, sonst offene Wagen in verschiedenen Farben (ab und zu flach)
    const farben = shuffle(OFFENE);
    const typen = wahl.map((g) => (g.endsWith('staemme') || Math.random() < 0.2 ? 'wagen_flach' : farben.pop()));
    this.lokTyp = lokTyp;

    this.baueZug(typen, wahl, sofort);
    this.baueLok(lokTyp);
    this.baueGueter(wahl);
    this.pruefeSchritt();
  }

  baueZug(typen, wahl, sofort) {
    const zug = new Zug({
      konfig: { lok: this.lokTyp, wagen: typen.map((typ) => ({ typ, gast: null, ladung: null })) },
      x: 0, y: GLEIS_Y, scale: S, parent: this.welt, szene: { front: this.vorn }, z: 6, bewegt: true,
    });
    this.zug = zug;
    // Die Lok des Zugs ist erst unsichtbar – die echte Lok holt das Kind aus dem Schuppen
    tap(zug.lok, () => this.lokTipp(), { sound: null, pad: 80 });
    zug.lok.alpha = 0;
    zug.lok.eventMode = 'none';
    this.zielX = LOK_X - zug.lok.x * S;
    zug.wagen.forEach((w, i) => {
      w.will = wahl[i];
      w.voll = false;
      this.baueSchild(w);
      tap(w.koerper, () => this.wagenTipp(w), { sound: null, pad: 90 });
    });
    if (sofort) {
      zug.x = this.zielX;
      this.ankunft = false;
    } else {
      // knapp links außerhalb dieser Seite (nicht weiter: dort läge schon der Bahnsteig der ersten Seite)
      zug.x = Math.min(this.zielX - 600, -stage.W / 2 - zug.laenge / 2 - 60);
      this.ankunft = true;
      this.vEin = 380;
      sfx('common/zug_fahren', { vol: 0.3 });
    }
  }

  // Schild vorn am Wagen: runde Holzscheibe mit dem Bild der Ladung, die hinein soll
  baueSchild(w) {
    const f = w.fahrzeug;
    const p = w.platz;
    const c = new Container({ label: 'schild' });
    const r = 132;   // Bildpunkte des Wagens (≈ 50 Einheiten)
    c.addChild(new Graphics().circle(0, 6, r + 6).fill({ color: 0x5a4630, alpha: 0.2 })
      .circle(0, 0, r).fill(0xfff6e6).stroke({ width: 14, color: 0xc89a5c }));
    const bild = spr(w.will, { anchor: 0.5, parent: c });
    bild.scale.set((r * 1.45) / Math.max(bild.texture.width, bild.texture.height));
    const m = f.koerper;
    const unten = (1 - m.anchor.y) * m.texture.height;
    const y = p?.art === 'sitz' ? (p.rand + p.boden) / 2 : -m.texture.height * m.anchor.y * 0.2;
    c.position.set(p ? p.mitte : 0, p?.art === 'sitz' ? y + 30 : Math.min(-40, unten - 160));
    c.eventMode = 'none';
    f.rumpf.addChild(c);
    w.schild = c;
  }

  baueLok(typ) {
    if (this.lok && !this.lok.destroyed) this.lok.destroy({ children: true });
    const f = new Fahrzeug({
      koerper: 'zug/' + typ,
      raeder: [{ tex: LOK_RAD[typ], punkt: 'rad1' }, { tex: LOK_RAD[typ], punkt: 'rad2' }],
      stange: DAMPFLOKS.has(typ) ? { tex: 'zug/kuppelstange' } : null,
      scale: S, flip: true, parent: this.welt, z: 6.5,
    });
    const halb = (f.koerper.texture.width * S) / 2;
    f.position.set(TOR_L + 24 + halb, HOF_Y);
    this.maske.visible = true;
    f.mask = this.maske;
    f.alpha = 0;
    this.s.tween(f, { alpha: 1 }, 0.8, { ease: 'sineInOut' });
    // Tippfläche selbst setzen (die Maske im Tor würde sie sonst schmal machen)
    const t = f.koerper.texture;
    tap(f, () => this.lokTipp(), { sound: null, hitArea: new Rectangle(-t.width / 2 - 90, -t.height - 110, t.width + 180, t.height + 160) });
    this.lok = f;
    this.lokZustand = 'schlaeft';
    this.lokBeschaeftigt = false;
  }

  baueGueter(wahl) {
    for (const g of this.gueter) if (g.paket && !g.paket.destroyed && g.paket.parent === this.welt) g.paket.destroy({ children: true });
    const plaetze = shuffle(PLAETZE);
    const mitTier = Math.random() < 0.45 ? Math.floor(Math.random() * wahl.length) : -1;
    const tierId = pick(MITFAHRER.filter((t) => t !== this.letzterMitfahrer));
    this.gueter = wahl.map((id, i) => {
      const paket = new Container({ label: 'ladung' });
      const bild = spr(id, { parent: paket });
      const s0 = Math.min(205 / bild.texture.width, 178 / bild.texture.height);
      bild.scale.set(s0);
      const g = { id, paket, bild, hoehe0: bild.texture.height * s0, zustand: 'liegt', wagen: this.zug.wagen[i], tier: null };
      paket.position.set(plaetze[i], WIESE_Y);
      paket.zIndex = 8;
      paket.alpha = 0;
      this.s.tween(paket, { alpha: 1 }, 0.6, { ease: 'sineInOut', delay: 0.2 + i * 0.25 });
      this.welt.addChild(paket);
      tap(paket, () => this.ladungTipp(g), { sound: null, hitArea: new Rectangle(-135, -235, 270, 255) });
      if (i === mitTier) {
        // Überraschung: ein Tier sitzt obendrauf und fährt mit
        this.letzterMitfahrer = tierId;
        const a = new Actor(tierId, { x: -18, y: -g.hoehe0 + 10, scale: 0.13, parent: paket });
        a.schatten.visible = false;
        a.onTap(() => a.cheer(), { pad: 70 });
        g.tier = a;
      }
      return g;
    });
  }

  // ---------------------------------------------------------------- Lok

  schuppenTipp() {
    if (this.lokZustand === 'schlaeft' || this.lokZustand === 'wach') {
      this.lokTipp();
      return;
    }
    fx.wobble(this.schuppen, 0.012);
    if (this.ton('common/tuer', 1, { vol: 0.4 })) fx.burst('rauch', SCHUPPEN_X + 152, HOF_Y - 520, { count: 2, parent: this.vorn });
  }

  lokTipp() {
    if (this.faehrt) return;
    if (this.lokBeschaeftigt) {
      if (this.lok && !this.lok.destroyed) this.lok.wackel(0.012);
      return;
    }
    const z = this.lokZustand;
    if (z === 'schlaeft') this.wecken();
    else if (z === 'wach') this.rausfahren();
    else if (z === 'draussen') this.drehen();
    else if (z === 'gedreht') this.ankuppeln();
    else if (z === 'dran') {
      if (this.bereit()) this.abfahrt();
      else {
        if (!this.zugPfeife()) this.zug.lok.wackel(0.012);
        const h = this.hinweise()[0];
        if (h) this.s.after(0.3, () => { if (this.aktiv && !this.faehrt) ui.hand(h); });
      }
    }
  }

  zugPfeife() {
    if (!this.ton('common/pfiff', 0.9, { vol: 0.7 })) return false;
    const f = this.lokZustand === 'dran' ? this.zug.lok : this.lok;
    const p = f?.punkt('schornstein', this.vorn);
    if (p) fx.burst('rauch', p.x, p.y - 10, { count: 3, parent: this.vorn });
    if (f) fx.pop(f.rumpf, 0.05);
    return true;
  }

  wecken() {
    const f = this.lok;
    this.lokZustand = 'wach';
    f.hupf(18);
    this.s.after(0.25, () => this.zugPfeife());
    this.pruefeSchritt();
  }

  async rausfahren() {
    const f = this.lok;
    this.lokBeschaeftigt = true;
    this.ton('common/zug_fahren', 2, { vol: 0.25 });
    // aus dem Tor nach links, dann die kleine Rampe hinunter auf die Drehscheibe
    f.fahreZu(DREH_X, 2.6, { ease: 'sineInOut' });
    await this.s.tween(f, { y: GLEIS_Y }, 1.3, { ease: 'sineInOut', delay: 1.0 });
    await this.s.wait(0.35);
    if (f.destroyed) return;
    f.mask = null;
    this.maske.visible = false;   // ohne Lok wäre die Maske sonst als weiße Fläche zu sehen
    this.lokBeschaeftigt = false;
    this.lokZustand = 'draussen';
    fx.wobble(this.dreh, 0.01);
    this.pruefeSchritt();
  }

  drehTipp() {
    if (this.lokZustand === 'draussen' && !this.lokBeschaeftigt) {
      this.drehen();
      return;
    }
    fx.wobble(this.drehBild, 0.02);
    this.ton('common/klack', 0.4, { vol: 0.5 });
  }

  async drehen() {
    const f = this.lok;
    this.lokBeschaeftigt = true;
    this.kranTon.an(0.3);
    fx.wobble(this.drehBild, 0.015);
    // Die Lok dreht sich auf der Scheibe: von links schauend über „schmal" nach rechts schauend
    await this.s.tween(f.huepfer.scale, { x: 1 }, 2.0, { ease: 'sineInOut' });
    this.kranTon.aus(0.4);
    if (f.destroyed) return;
    f.flip = false;
    this.ton('common/klack', 0.3, { vol: 0.6 });
    fx.pop(f.rumpf, 0.05);
    this.lokBeschaeftigt = false;
    this.lokZustand = 'gedreht';
    this.pruefeSchritt();
  }

  async ankuppeln() {
    if (this.ankunft) {
      this.lok.wackel(0.012);
      return;
    }
    const f = this.lok;
    const zug = this.zug;
    this.lokBeschaeftigt = true;
    const ziel = zug.x + zug.lok.x * S;
    await f.fahreZu(ziel, clamp(Math.abs(f.x - ziel) / 140, 0.8, 2), { ease: 'sineInOut' });
    if (f.destroyed || zug.destroyed) return;
    // die echte Zug-Lok übernimmt (gleicher Platz, gleiches Bild)
    zug.lok.alpha = 1;
    zug.lok.eventMode = 'static';
    f.destroy({ children: true });
    this.lok = null;
    sfx('common/kupplung');
    zug.lok.wackel(0.012);
    zug.wagen.forEach((w, i) => this.s.after(0.12 * i, () => { if (!w.fahrzeug.destroyed) w.fahrzeug.hupf(10); }));
    this.lokBeschaeftigt = false;
    this.lokZustand = 'dran';
    this.pruefeSchritt();
  }

  // ---------------------------------------------------------------- Kran

  hakenWippen() {
    const h = this.haken;
    killTweensOf(h, ['y']);
    const y0 = h.y;
    this.s.tween(h, { y: y0 + 40 }, 0.35, { ease: 'sineInOut' }).then((ok) => {
      if (ok) this.s.tween(h, { y: y0 }, 0.45, { ease: 'sineInOut' });
    });
  }

  hakenTipp() {
    if (this.kranZustand === 'traegt') {
      const g = this.getragen;
      if (g) fx.wobble(g.paket, 0.05);
      this.ton('common/hupf', 0.4, { vol: 0.5 });
      return;
    }
    fx.wobble(this.haken, 0.06);
    this.ton('common/klack', 0.4, { vol: 0.4 });
  }

  // Laufkatze fahren und Haken heben/senken (nacheinander, ruhig); das Surren klingt nur, solange er sich bewegt
  async kranFahre(x, y) {
    const k = this.katze;
    const h = this.haken;
    x = clamp(x, KATZE_MIN, KATZE_MAX);
    this.kranTon.an(0.25);
    if (Math.abs(k.x - x) > 2) {
      const d = clamp(Math.abs(k.x - x) / KATZE_TEMPO, 0.35, 3);
      this.s.tween(h, { x }, d, { ease: 'sineInOut' });
      await this.s.tween(k, { x }, d, { ease: 'sineInOut' });
    }
    if (Math.abs(h.y - y) > 2) await this.s.tween(h, { y }, clamp(Math.abs(h.y - y) / HAKEN_TEMPO, 0.3, 2.5), { ease: 'sineInOut' });
    this.kranTon.aus(0.35);
  }

  ladungTipp(g) {
    if (this.faehrt || g.zustand !== 'liegt') return;
    if (this.kranZustand !== 'frei' || this.ankunft) {
      fx.wobble(g.paket, 0.04);
      this.ton('common/klack', 0.4, { vol: 0.4 });
      return;
    }
    this.holen(g);
  }

  async holen(g) {
    this.kranZustand = 'holt';
    g.zustand = 'haengt';
    this.getragen = g;
    this.gemerkt = null;
    fx.wobble(g.paket, 0.03);
    this.ton('common/klack', 0.2, { vol: 0.6 });
    this.pruefeSchritt();
    // erst auf Tragehöhe, dann hinüber, dann hinunter bis zur Ladung
    const oben = TRAGE_UNTERKANTE - g.hoehe0 - HAKEN_UNTEN;
    if (this.haken.y > oben + 5) await this.kranFahre(this.katze.x, oben);
    await this.kranFahre(g.paket.x, WIESE_Y - g.hoehe0 - HAKEN_UNTEN);
    if (g.paket.destroyed) return;
    // einhaken
    umhaengen(g.paket, this.haken);
    g.paket.position.set(0, HAKEN_UNTEN + g.hoehe0);
    this.ton('common/klack', 0.2, { vol: 0.8 });
    if (g.tier && !g.tier.destroyed) g.tier.cheer();
    await this.s.wait(0.25);
    await this.kranFahre(this.katze.x, oben);
    this.kranZustand = 'traegt';
    // Hat das Kind schon während des Hebens auf einen Wagen getippt, fährt der Kran gleich dorthin
    const gemerkt = this.gemerkt;
    this.gemerkt = null;
    if (gemerkt && this.zug && this.zug.wagen.includes(gemerkt) && !this.faehrt) {
      this.bringen(g, gemerkt);
      return;
    }
    // das passende Schild hüpft kurz – „da gehört es hin"
    const w = g.wagen;
    if (w?.schild && !w.schild.destroyed) fx.pop(w.schild, 0.15);
    this.pruefeSchritt();
  }

  wagenTipp(w) {
    if (this.faehrt) return;
    w.fahrzeug.wackel(0.02);
    const g = this.getragen;
    // Der Kran hebt noch: Den Tipp merken – sobald die Ladung oben ist, bringt er sie (kein Tipp geht verloren)
    if (this.kranZustand === 'holt' && g) {
      this.gemerkt = w;
      if (w.schild && !w.voll) fx.pop(w.schild, 0.12);
      this.ton('common/klack', 0.3, { vol: 0.45 });
      return;
    }
    if (this.kranZustand !== 'traegt' || !g) {
      if (w.schild && !w.voll) fx.pop(w.schild, 0.12);
      this.ton('common/klack', 0.3, { vol: 0.45 });
      return;
    }
    this.bringen(g, w);
  }

  async bringen(g, getippt) {
    this.kranZustand = 'bringt';
    this.pruefeSchritt();
    const ziel = g.wagen;
    const mitte = (w) => this.welt.toLocal(w.fahrzeug.getGlobalPosition()).x;
    if (getippt !== ziel) {
      // ein anderer Wagen: hinfahren, die Ladung wackelt, das richtige Schild hüpft – dann weiter zum richtigen
      await this.kranFahre(mitte(getippt), this.haken.y);
      if (g.paket.destroyed) return;
      fx.wobble(g.paket, 0.07);
      this.ton('common/hupf', 0.3, { vol: 0.5 });
      if (ziel.schild && !ziel.schild.destroyed) fx.pop(ziel.schild, 0.15);
      await this.s.wait(0.7);
    }
    await this.kranFahre(mitte(ziel), this.haken.y);
    if (g.paket.destroyed || this.zug?.destroyed) return;
    // Größe und Platz im Wagen (wie im Zug-Baustein: flach obendrauf, im offenen Wagen schaut sie halb heraus)
    const p = ziel.platz;
    const m = g.bild.texture;
    const breite = p.breite * (p.art === 'flach' ? 0.66 : 0.52);   // etwas größer als im Zug-Baustein: gut sichtbar
    const skalaPx = Math.min(breite / m.width, (breite * 1.1) / m.height);
    const hoehePx = m.height * skalaPx;
    // (im offenen Wagen wie auf dem Bahnsteig, siehe tippbareLadung in index.js: gut drei Viertel ragen heraus –
    //  tiefer sähe man vom Fass oder der Milchkanne nur noch den Deckel)
    const fuss = p.art === 'flach' ? p.boden : Math.min(p.rand + hoehePx * 0.22, p.boden);
    const innen = ziel.fahrzeug.innen;
    const soll = this.welt.toLocal(innen.toGlobal({ x: p.mitte, y: fuss }));
    const faktor = (skalaPx * S) / (g.bild.scale.x * g.paket.scale.x);   // Wagen-Größe, in world gerechnet
    const neueHoehe = g.hoehe0 * g.paket.scale.x * faktor;
    // im Schweben auf Wagen-Größe, dann hinunter
    this.s.tween(g.paket.scale, { x: g.paket.scale.x * faktor, y: g.paket.scale.y * faktor }, 0.5, { ease: 'sineInOut' });
    await this.s.tween(g.paket, { y: HAKEN_UNTEN + neueHoehe }, 0.5, { ease: 'sineInOut' });
    await this.kranFahre(soll.x, soll.y - HAKEN_UNTEN - neueHoehe);
    if (g.paket.destroyed || ziel.fahrzeug.destroyed) return;
    umhaengen(g.paket, innen);
    g.paket.position.set(p.mitte, fuss);
    g.paket.zIndex = 1;
    g.zustand = 'drin';
    ziel.voll = true;
    this.getragen = null;
    sfx('common/klack', { vol: 0.8 });
    fx.pop(g.paket, 0.08);
    ziel.fahrzeug.hupf(8);
    if (ziel.schild && !ziel.schild.destroyed) this.s.tween(ziel.schild, { alpha: 0 }, 0.6, { ease: 'sineInOut' });   // die Ladung ist jetzt selbst zu sehen
    if (g.tier && !g.tier.destroyed) this.s.after(0.4, () => { if (!g.tier.destroyed) g.tier.cheer(); });
    await this.s.wait(0.2);
    await this.kranFahre(this.katze.x, HAKEN_RUHE);
    this.kranZustand = 'frei';
    this.pruefeSchritt();
  }

  // ---------------------------------------------------------------- Abfahrt und neue Runde

  bereit() {
    return this.lokZustand === 'dran' && this.kranZustand === 'frei' && !this.ankunft
      && this.gueter.every((g) => g.zustand === 'drin');
  }

  abfahrt() {
    this.faehrt = true;
    this.pruefeSchritt();
    this.zugPfeife();
    for (const g of this.gueter) if (g.tier && !g.tier.destroyed) this.s.after(0.6, () => { if (!g.tier.destroyed) g.tier.cheer(); });
    this.s.after(1.1, () => {
      if (!this.zug || this.zug.destroyed) return;
      this.zug.fahre(360);
      this.ton('common/zug_fahren', 2, { vol: 0.4 });
    });
  }

  // Der Güterzug ist draußen: Sticker, eine Blume mehr, manchmal ein Personenzug, dann kommen neue Wagen
  zugDraussen() {
    const zug = this.zug;
    this.zug = null;
    zug.destroy({ children: true });
    const neu = STICKER_NEU.filter((id) => stickerFuerOrt('bahnhof').some((s) => s.id === id));
    const schon = new Set(store.stickers?.() || []);
    const id = neu.find((x) => !schon.has(x)) || this.lokTyp;
    belohne(this, id, 300, 900);
    this.s.after(1.4, () => this.blumeDazu());
    if (Math.random() < 0.35) this.s.after(2.6, () => this.durchfahrt());
    else this.s.after(2.6, () => this.neueRunde(false));
  }

  // Überraschung: ein Personenzug fährt durch, die Gäste winken (antippen = sie freuen sich)
  durchfahrt() {
    const gaeste = shuffle(PERSONEN_GAESTE).slice(0, 2);
    const farben = shuffle(OFFENE);
    const z = new Zug({
      konfig: { lok: pick(LOKS), wagen: gaeste.map((gast) => ({ typ: farben.pop(), gast, ladung: null })) },
      x: 0, y: GLEIS_Y, scale: S, parent: this.welt, szene: { front: this.vorn }, z: 6, bewegt: true,
    });
    z.x = -stage.W / 2 - z.laenge / 2 - 60;   // knapp links außerhalb dieser Seite
    z.geschwindigkeit = 330;
    z.fahre(330);
    this.durch = z;
    this.ton('common/zug_fahren', 2, { vol: 0.3 });
    for (const w of z.wagen) tap(w.koerper, () => z.gaesteJubeln(), { sound: null, pad: 70 });
    tap(z.lok, () => z.pfeife(), { sound: null, pad: 80 });
    this.s.after(2.8, () => { if (!z.destroyed) { z.pfeife(); z.gaesteJubeln(); } });
  }

  // ---------------------------------------------------------------- Blumen (wachsen über die Besuche)

  neueBlume(i, neu) {
    const c = new Container({ label: 'blume' });
    const farbe = BLUMEN_FARBEN[i % BLUMEN_FARBEN.length];
    const h = 78 + (i % 3) * 14;
    const g = new Graphics()
      .moveTo(0, 0).quadraticCurveTo(6, -h * 0.5, 0, -h).stroke({ width: 7, color: 0x4f9a3a })
      .ellipse(14, -h * 0.4, 16, 8).fill(0x6cc15a);
    for (let k = 0; k < 5; k++) {
      const w = (k / 5) * Math.PI * 2;
      g.circle(Math.cos(w) * 17, -h + Math.sin(w) * 17, 14).fill(farbe);
    }
    g.circle(0, -h, 11).fill(0xffe08a);
    c.addChild(g);
    c.position.set(170 + i * 82, WIESE_Y + 8);
    c.zIndex = 7.5;
    c._phase = i * 1.1;
    this.welt.addChild(c);
    this.blumen.push(c);
    tap(c, () => {
      fx.wobble(c, 0.1);
      if (this.ton('blume', 0.3)) note('glocke', 74 + (i % 7) * 2, { vol: 0.2 });
    }, { sound: null, squash: false, hitArea: new Rectangle(-100, -200, 200, 220) });
    if (neu) {
      c.scale.set(0.1);
      this.s.tween(c, { scale: 1 }, 0.9, { ease: 'backOut' });
      sfx('common/wachsen', { vol: 0.6 });
      fx.burst('funkeln', c.x, c.y - h, { count: 4, parent: this.vorn });
    }
  }

  blumeDazu() {
    const n = clamp(store.get('bahnhof.blumen', 0) | 0, 0, MAX_BLUMEN);
    if (n >= MAX_BLUMEN) {
      for (const b of this.blumen) fx.wobble(b, 0.08);
      return;
    }
    store.set('bahnhof.blumen', n + 1);
    this.neueBlume(n, true);
  }

  // ---------------------------------------------------------------- Schritte, Hinweise, Stimme

  berechneSchritt() {
    if (this.faehrt) return 'faehrt';
    if (this.ankunft) return 'ankunft';
    if (this.kranZustand === 'traegt') return 'wagen';
    if (this.lokBeschaeftigt || this.kranZustand !== 'frei') return 'warten';
    if (this.lokZustand !== 'dran') return this.lokZustand;
    if (this.gueter.some((g) => g.zustand === 'liegt')) return 'kran';
    return 'los';
  }

  pruefeSchritt() {
    const neu = this.berechneSchritt();
    if (neu === this.schritt) return;
    this.schritt = neu;
    if (neu === 'los' && this.zug) fx.pulse(this.zug.lok);
    this.sageSchritt();
  }

  sageSchritt() {
    const neu = this.schritt;
    const satz = STIMME[neu];
    if (!satz || !this.aktiv) return;
    const passt = () => this.schritt === neu && this.aktiv && this.s.nr === 1 && !this.s.gleitet;
    this.s.after(neu === 'wagen' ? 1.2 : 1.8, () => { if (passt()) voice(satz, { nurWenn: passt }); });
  }

  hinweise() {
    const liste = [];
    switch (this.schritt) {
      case 'schlaeft':
        if (this.lok) liste.push(this.lok);
        break;
      case 'wach':
        if (this.lok) liste.push({ von: this.lok, nach: { x: DREH_X, y: GLEIS_Y - 60 } });
        break;
      case 'draussen':
        liste.push(this.drehBild);
        break;
      case 'gedreht':
        if (this.lok && this.zug) liste.push({ von: this.lok, nach: this.zug.wagen[0].koerper });
        break;
      case 'kran': {
        const g = this.gueter.find((x) => x.zustand === 'liegt');
        if (g) liste.push(g.paket);
        break;
      }
      case 'wagen':
        if (this.getragen?.wagen) liste.push(this.getragen.wagen.koerper);
        break;
      case 'los':
        if (this.zug) liste.push(this.zug.lok);
        break;
      default:
        break;
    }
    return liste;
  }

  betreten() {
    this.aktiv = true;
    this.sageSchritt();
  }

  verlassen() {
    this.aktiv = false;
  }

  // ---------------------------------------------------------------- Takt

  update(dt) {
    this._zeit += dt;
    const zug = this.zug;
    if (zug && !zug.destroyed) {
      if (this.ankunft) {
        // Wagen rollen langsam herein und halten genau am Platz (die Lok des Zugs ist noch unsichtbar: ohne Dampf)
        const rest = this.zielX - zug.x;
        const soll = clamp(rest * 1.4, 0, 380);
        this.vEin += (soll - this.vEin) * (1 - Math.exp(-dt * 2.5));
        let dx = this.vEin * dt;
        if (rest < 1.5 && this.vEin < 6) {
          dx = rest;
          this.ankunft = false;
          sfx('common/kupplung', { vol: 0.5 });
        }
        zug.x += dx;
        for (const w of zug.wagen) w.fahrzeug.rolle(dx / S);
        if (!this.ankunft) this.pruefeSchritt();
      }
      zug.update(dt);
      if (this.faehrt && zug.x - zug.laenge / 2 > 1420) this.zugDraussen();
    }
    const d = this.durch;
    if (d && !d.destroyed) {
      d.update(dt);
      if (d.x - d.laenge / 2 > 1450) {
        d.destroy({ children: true });
        this.durch = null;
        this.s.after(0.6, () => this.neueRunde(false));
      }
    }
    if (this.lok && !this.lok.destroyed) this.lok.update(dt);
    // Seil von der Laufkatze bis zum Haken
    this.seil.position.set(this.katze.x, this.katze.y + 26);
    this.seil.height = Math.max(4, this.haken.y - 60 - this.seil.y);
    this.haken.x = this.katze.x;
    // Die Lok im Schuppen schläft: ab und zu steigt ein Z auf
    if (this.lokZustand === 'schlaeft' && this.lok && this.lok.alpha > 0.9) {
      this._zzz = (this._zzz ?? 1) - dt;
      if (this._zzz <= 0) {
        this._zzz = 2.4;
        fx.burst('zzz', TOR_L + 70, TOR_OBEN + 10, { count: 1, parent: this.vorn });
      }
    }
    for (const b of this.blumen) b.rotation = Math.sin(this._zeit * 0.8 + b._phase) * 0.05;
    this.pruefeSchritt();
  }

  ton(id, pause = 0.5, opt) {
    const jetzt = this._zeit;
    if (jetzt - (this._toene.get(id) ?? -99) < pause) return false;
    this._toene.set(id, jetzt);
    if (id.includes('/')) sfx(id, opt);
    return true;
  }

  exit() {
    this.kranTon?.stop();
  }
}
