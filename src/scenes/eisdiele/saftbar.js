// Seite 2: die Saftbar.
// Ein Tier kommt und zeigt in seiner Denkblase das Obst, aus dem es Saft möchte (1–2 Früchte).
// Links auf einer großen Obstkiste liegt Obst bereit. Bis zu drei Früchte in den Mixer-Krug ziehen (oder antippen –
// dann hüpfen sie von selbst hinein). Knopf des Mixers antippen → er surrt, die Früchte wirbeln, Saft in der
// Mischfarbe steigt. Krug antippen → der Mixer neigt sich und gießt in ein freies Glas, ein Strohhalm kommt dazu.
// Volles Glas zum Tier ziehen (oder antippen) → es trinkt und freut sich (war das Wunsch-Obst drin: besonders),
// winkt und geht; das nächste kommt.

import { PIXI, spr, tex, tap, drag, fx, sfx, note, voice, pick, clamp } from '../../engine/index.js';
import { Seite, hgPunkt } from '../../gemeinsam/seiten.js';
import { belohne, stickerFuerOrt } from '../../gemeinsam/sticker.js';
import { Kundschaft } from './kunden.js';
import { Vogel, Schmetterling, bildFleck, bogenFlug, umhaengen, mischfarbe } from './deko.js';

// Obst: Bild, Saftfarbe, Darstellungsgröße (längste Seite)
const OBST = {
  apfel: { tex: 'common/futter_apfel', farbe: 0xc6dc3a, g: 175 },
  banane: { tex: 'common/futter_banane', farbe: 0xffdc5a, g: 190 },
  erdbeere: { tex: 'common/futter_erdbeere', farbe: 0xff4f6e, g: 170 },
  orange: { tex: 'eisdiele/orange', farbe: 0xffa22e, g: 170 },
  kiwi: { tex: 'eisdiele/kiwi', farbe: 0x9ccc3c, g: 165 },
  ananas: { tex: 'eisdiele/ananas', farbe: 0xffd84a, g: 200 },
  kirschen: { tex: 'eisdiele/kirschen', farbe: 0xd8283c, g: 165 },
  zitrone: { tex: 'eisdiele/zitrone', farbe: 0xffe23a, g: 165 },
  blaubeeren: { tex: 'eisdiele/blaubeeren', farbe: 0x7a5ad8, g: 165 },
};

// Obstkiste links auf der Theke (der Hintergrund hat dafür keine Punkte): zwei Reihen, die obere steht auf der Kiste
const KISTE = { links: -965, rechts: -135, oben: 872 };
const REIHE_UNTEN = [['apfel', -880], ['banane', -715], ['erdbeere', -550], ['orange', -385], ['kiwi', -220]];
const REIHE_OBEN = [['ananas', -797], ['kirschen', -632], ['zitrone', -467], ['blaubeeren', -302]];

const MIXER_X = 70;            // Punkt 'mixer' liegt bei x=0 – etwas nach rechts, damit die Obstkiste Platz hat
const MIXER_SKALA = 0.8;
const MAX_OBST = 3;
const MIX_DAUER = 2.6;
const GLAS_X = [320, 490, 660];   // Punkte glas1…3 liegen zu weit rechts (Kunde, Pfeil-Ecke)
const GLAS_SKALA = 0.55;
const KUNDE_X = 830;              // Kunde steht rechts vorn (kurzer Weg vom Glas); Punkt 'kunde' liegt links
const KUNDE_SKALA = 0.56;
const LIPPE = { x: 106, y: -4 };   // Ausguss-Kante relativ zum Punkt krug_oben (Mixer gespiegelt, Henkel links)
const OBST_IDS = Object.keys(OBST);

export class Saftbar extends Seite {
  static hg = 'eisdiele/hg_saftbar';

  aufbau() {
    this.theke = this.punkt('mixer', { x: 0, y: 1060 }).y;
    this.bodenY = Math.min(1560, this.punkt('kunde', { x: -994, y: 1570 }).y);
    this.imKrug = [];          // Früchte im Krug: {sprite, id}
    this.unterwegs = 0;        // Früchte im Flug zum Krug
    this.saft = 0;             // Füllstand des Krugs 0…1
    this.saftFarbe = 0xffd27a;
    this.mixt = false;
    this.giesst = false;
    this.trinkt = false;
    this.mixZeit = 0;
    this.runde = 0;
    this.treffer = 0;          // Säfte mit dem Wunsch-Obst
    this.letzterKlick = 0;
    this.wunsch = null;        // ['kiwi', …] – Obst, das sich der Kunde wünscht
    this.blase = null;
    this.saftInhalt = [];      // Obst im fertigen Saft des Krugs
    this.obstRein = false;     // schon einmal eine Frucht in den Mixer gelegt (dann kein Hinweis mehr aufs Obst)
    this._hinweis = null;
    this.sticker = stickerFuerOrt('eisdiele').find((x) => x.id === 'eisdiele_eisbecher')?.id || 'eisdiele_eisbecher';

    this.baueKiste();
    this.baueMixer();
    this.glaeser = GLAS_X.map((x, i) => this.baueGlas(x, i));
    this.strahl = new PIXI.Graphics();
    this.strahl.zIndex = 45;
    this.strahl.alpha = 0;
    this.strahl.eventMode = 'none';
    this.welt.addChild(this.strahl);

    this.kunde = new Kundschaft(this, {
      x: KUNDE_X, y: this.bodenY, scale: KUNDE_SKALA, z: 30, draussen: 1580,
    });

    // kleine lebendige Nebensachen
    this.vogel = new Vogel(this, { x: 330, y: 454, farbe: 0xf2c46a, bauch: 0xfff5dc, flip: true, z: 2 });
    // nur über freiem Himmel/Schirm (nicht über Obst, Gläsern, Wunschblase); unter den Spieldingen
    this.falter = new Schmetterling(this, {
      orte: [{ x: 760, y: 540 }, { x: 420, y: 470 }, { x: -520, y: 440 }, { x: 980, y: 560 }],
      farbe: 0xa8d8f8, farbe2: 0xfff1a8, z: 2,
    });
    // gemalte Dinge im Hintergrund klingen beim Antippen (Orte am Foto abgelesen)
    const ton = (m, instr = 'glocke') => () => note(instr, m, { vol: 0.3 });
    bildFleck(this, { x: -235, y: 560, w: 240, h: 200, ton: ton(79) });       // Orangen-Kiste
    bildFleck(this, { x: 330, y: 560, w: 200, h: 200, ton: ton(81) });        // Zitronen (Rest neben dem Krug)
    bildFleck(this, { x: 560, y: 560, w: 260, h: 200, ton: ton(84) });        // Äpfel-Kiste
    bildFleck(this, { x: -150, y: 770, w: 200, h: 200, ton: ton(76) });       // Melonen hinter dem Mixer
    bildFleck(this, { x: 470, y: 745, w: 330, h: 200, ton: ton(74) });        // Wassermelone über den Gläsern
    bildFleck(this, { x: 1185, y: 480, w: 230, h: 320, ton: ton(72, 'floete') }); // Windmühle (rechts außen)
  }

  betreten() {
    if (this.besuche === 1) {
      this.naechsterKunde(0.3);   // der Hinweis kommt, sobald das erste Tier seinen Wunsch zeigt
    } else {
      this.hinweisAnmelden(1.2);
    }
  }

  verlassen() {
    // nichts Dauerhaftes – Teilchen liegen in this.vorn und gleiten mit; nur der angemeldete Hinweis endet
    this._hinweis?.kill();
    this._hinweis = null;
  }

  /** Hinweis „Leg das Wunsch-Obst in den Mixer" anmelden (der Kern sagt ihn höchstens einmal am Tag) – nur, solange
   *  die Seite zu sehen ist und noch keine Frucht im Mixer gelandet ist (auch nicht, wenn er später an die Reihe kommt). */
  hinweisAnmelden(sek) {
    this._hinweis?.kill();
    this._hinweis = null;
    if (this.obstRein) return;
    const passt = () => this.aktiv && !this.obstRein && !this.obst.some((f) => f.sprite?.ziehen?.isDragging());
    this._hinweis = this.after(sek, () => { if (passt()) voice('eisdiele_saft', { nurWenn: passt }); });
  }

  // ---------------------------------------------------------------- Aufbau

  baueKiste() {
    const { links, rechts, oben } = KISTE;
    const unten = this.theke - 6;
    const g = new PIXI.Graphics();
    const b = rechts - links;
    // Schatten auf der Theke
    g.ellipse((links + rechts) / 2, unten + 4, b / 2 + 20, 18).fill({ color: 0x5a3a1a, alpha: 0.18 });
    // Kiste: warmes Holz, drei Latten, runde Ecken
    g.roundRect(links, oben, b, unten - oben, 26).fill(0xe2a660).stroke({ width: 6, color: 0xb87838 });
    for (let i = 1; i < 3; i++) {
      const y = oben + ((unten - oben) * i) / 3;
      g.roundRect(links + 14, y - 4, b - 28, 8, 4).fill({ color: 0xb87838, alpha: 0.45 });
    }
    g.roundRect(links + 6, oben + 2, b - 12, 22, 11).fill(0xf2c27e);
    g.roundRect(links + 30, oben + 6, b * 0.5, 7, 3.5).fill({ color: 0xffffff, alpha: 0.35 });
    // Griffloch
    g.roundRect((links + rechts) / 2 - 60, oben + 70, 120, 28, 14).fill({ color: 0x8a5a2a, alpha: 0.5 });
    g.zIndex = 2;
    g.eventMode = 'none';
    this.welt.addChild(g);

    this.obst = [];
    for (const [id, x] of REIHE_UNTEN) this.obst.push({ id, x, boden: this.theke - 4, z: 8 });
    for (const [id, x] of REIHE_OBEN) this.obst.push({ id, x, boden: oben + 8, z: 5 });
    for (const fach of this.obst) this.legeObst(fach, false);
  }

  /** Neue Frucht in ihr Fach legen (beim Aufbau sofort, später wächst sie weich heran). */
  legeObst(fach, weich = true) {
    const o = OBST[fach.id];
    const s = spr(o.tex, { anchor: 0.5, parent: this.welt, z: fach.z });
    const skala = o.g / Math.max(s.texture.width, s.texture.height);
    fach.skala = skala;
    s.position.set(fach.x, fach.boden - (s.texture.height * skala) / 2);
    s.obstId = fach.id;
    fach.sprite = s;
    const r = 100 / skala;   // Greiffläche gut 200 Einheiten
    s.ziehen = drag(s, {
      hitArea: new PIXI.Rectangle(-r, -r, 2 * r, 2 * r),
      targets: () => [{ id: 'krug', ...this.krugMitte(), radius: 340 }],
      // sofort beim Berühren: ein heller Ton (das Anheben macht der Kern); das Wunsch-Obst klingt wie die Blase
      onStart: () => note('xylo', this.wunsch?.includes(fach.id) ? 79 : 72, { vol: 0.25 }),
      onDrop: (ziel, ctx) => {
        const getippt = Math.hypot(ctx.x - ctx.startX, ctx.y - ctx.startY) < 40;
        if (!ziel && !getippt) return undefined;          // gleitet zurück
        if (!this.passtRein()) {
          this.krugVoll();
          return false;
        }
        ctx.erledigt = true;   // nicht zurückgleiten – die Frucht hüpft selbst in den Krug
        this.reinWerfen(fach, s);
        return undefined;
      },
    });
    if (weich) {
      s.scale.set(0.01);
      s.alpha = 0;
      this.tween(s, { alpha: 1 }, 0.35, { ease: 'sineInOut' });
      this.tween(s, { scale: skala }, 0.55, { ease: 'backOut' });
    } else {
      s.scale.set(skala);
    }
  }

  baueMixer() {
    // Alles am Mixer hängt in einem Container (Ursprung = Standfläche), damit er sich zum Gießen neigen kann
    const c = new PIXI.Container({ label: 'mixer', sortableChildren: true });
    c.position.set(MIXER_X, this.theke);
    c.zIndex = 20;
    this.welt.addChild(c);
    this.mixer = c;

    const schatten = new PIXI.Graphics().ellipse(0, 2, 170, 26).fill({ color: 0x5a3a1a, alpha: 0.2 });
    schatten.eventMode = 'none';
    c.addChild(schatten);
    // gespiegelt: der Henkel zeigt nach links, gegossen wird über den rechten Rand zu den Gläsern
    this.mixerBild = spr('eisdiele/mixer', { scale: MIXER_SKALA, flip: true, parent: c, z: 10 });
    this.mixerBild.eventMode = 'none';
    const p = (name) => hgPunkt(this.mixerBild, 'eisdiele/mixer', name);
    this.krugUnten = p('krug_unten') || { x: 0, y: -235 };
    this.krugOben = p('krug_oben') || { x: 0, y: -423 };
    this.knopfOrt = p('knopf') || { x: 0, y: -87 };

    // Saft im Krug: vor dem Bild, etwas durchscheinend (so bleibt der Glanz des Krugs zu ahnen)
    this.krugSaft = this.saftSprite(c, this.krugUnten, MIXER_SKALA, MIXER_SKALA, 11);
    this.krugSaft.alpha = 0.8;

    // Tippflächen: Krug (gießen) und Knopf (mixen)
    const krug = new PIXI.Container({ label: 'krug' });
    krug.zIndex = 20;
    c.addChild(krug);
    const ky = (this.krugOben.y + this.krugUnten.y) / 2;
    krug.hitArea = new PIXI.Rectangle(-170, ky - 230, 360, 420);
    tap(krug, () => this.krugTipp(), { sound: null, squash: false });
    this.krug = krug;
    this.krugZiel = { x: 0, y: ky };

    const knopf = new PIXI.Container({ label: 'knopf' });
    knopf.zIndex = 21;
    knopf.position.set(this.knopfOrt.x, this.knopfOrt.y);
    knopf.hitArea = new PIXI.Rectangle(-160, -110, 320, 220);
    c.addChild(knopf);
    tap(knopf, () => this.knopfTipp(), { sound: null, squash: false });
    this.knopf = knopf;
  }

  /**
   * Saft-Füllung (eingefärbt). Der Füllstand schneidet das Bild von oben ab (eigene Textur mit wanderndem
   * Ausschnitt auf demselben Bild – Masken machten mit Pixi beim Ein-/Ausblenden Ärger).
   * ort = Mitte des Bodens; sx/sy = Skalierung. → Sprite mit .fuell(k) (0…1)
   */
  saftSprite(parent, ort, sx, sy, z) {
    const basis = tex('eisdiele/saft_fuellung');
    const f = basis.frame;
    const voll = { y: f.y, h: f.height * 0.983 };   // unten ist ein schmaler durchsichtiger Rand
    // dynamic: sonst bemerkt das Sprite die späteren Änderungen des Ausschnitts nicht
    const t = new PIXI.Texture({
      source: basis.source, frame: new PIXI.Rectangle(f.x, f.y, f.width, voll.h), dynamic: true,
    });
    const s = new PIXI.Sprite(t);
    s.once('destroyed', () => t.destroy(false));   // eigene Ausschnitt-Textur mit dem Sprite freigeben
    s.anchor.set(0.5, 1);
    s.position.set(ort.x, ort.y);
    s.scale.set(sx, sy);
    s.zIndex = z;
    s.eventMode = 'none';
    parent.addChild(s);
    s.fuell = (k) => {
      k = clamp(k, 0, 1);
      const h = Math.max(1, voll.h * k);
      t.frame.y = voll.y + voll.h - h;
      t.frame.height = h;
      t.update();
      s.visible = k > 0.005;
    };
    s.fuell(0);
    return s;
  }

  baueGlas(x, i) {
    const g = new PIXI.Container({ label: 'glas' + (i + 1), sortableChildren: true });
    g.position.set(x, this.theke);
    g.zIndex = 25;
    g.index = i;
    g.voll = false;
    g.heim = { x, y: this.theke };
    this.welt.addChild(g);
    const schatten = new PIXI.Graphics().ellipse(0, 2, 70, 13).fill({ color: 0x5a3a1a, alpha: 0.18 });
    schatten.eventMode = 'none';
    g.addChild(schatten);
    g.schatten = schatten;
    g.bild = spr('eisdiele/glas_leer', { scale: GLAS_SKALA, parent: g, z: 1 });
    const innenUnten = hgPunkt(g.bild, 'eisdiele/glas_leer', 'innen_unten') || { x: 0, y: -32 };
    const innenOben = hgPunkt(g.bild, 'eisdiele/glas_leer', 'innen_oben') || { x: 0, y: -195 };
    g.halm = spr('eisdiele/strohhalm', { scale: 0.48, parent: g, z: 2, x: -8, y: innenUnten.y - 4 });
    g.halm.visible = false;
    // Saft vor dem (undurchsichtigen) Glasbild, etwas durchscheinend; Höhe bis knapp unter den Rand
    const hoehe = (innenUnten.y - innenOben.y) * 0.86;
    const sy = hoehe / (243 * 0.983);
    g.saft = this.saftSprite(g, innenUnten, (190 / 278) * GLAS_SKALA, sy, 3);
    g.saft.alpha = 0.86;
    g.stand = 0;
    // Spitze des Strohhalms (für das Trinken): Bildpunkt (140, 12) des Halms
    g.halmSpitze = { x: g.halm.x + (140 - 0.165 * 158) * 0.48, y: g.halm.y + (12 - 0.985 * 360) * 0.48 };

    g.ziehen = this.glasZiehen(g);
    return g;
  }

  // ---------------------------------------------------------------- Obst → Krug

  /** Der ganze Mixer (samt Saft und Obst darin) wackelt bzw. hüpft kurz – nicht während er sich zum Gießen neigt. */
  wackel(art, staerke) {
    if (this.giesst) return;
    if (art === 'pop') fx.pop(this.mixer, staerke);
    else fx.wobble(this.mixer, staerke);
  }

  krugMitte() {
    return this.welt.toLocal(this.mixer.toGlobal(this.krugZiel));
  }

  passtRein() {
    return !this.mixt && !this.giesst && this.saft <= 0.01 && this.imKrug.length + this.unterwegs < MAX_OBST;
  }

  /** Krug ist voll / Saft wartet: der Mixer wackelt freundlich und zeigt, was als Nächstes dran ist. */
  krugVoll() {
    this.wackel('wobble', 0.04);
    note('xylo', 60, { vol: 0.3 });
    if (this.saft > 0.5) this.after(0.2, () => this.wackel('pop', 0.06));
  }

  reinWerfen(fach, s) {
    this.obstRein = true;   // das Kind hat losgelegt: kein Hinweis mehr auf das Obst
    s.ziehen?.off();
    s.eventMode = 'none';
    fach.sprite = null;
    this.unterwegs++;
    const n = this.imKrug.length + this.unterwegs - 1;
    // Platz im Krug (Koordinaten des Mixers): drei Früchte nebeneinander/übereinander am Boden
    const u = this.krugUnten;
    const plaetze = [{ x: u.x - 42, y: u.y - 48 }, { x: u.x + 46, y: u.y - 52 }, { x: u.x + 2, y: u.y - 115 }];
    const platz = plaetze[clamp(n, 0, 2)];
    const ueber = this.welt.toLocal(this.mixer.toGlobal({ x: platz.x, y: this.krugOben.y - 70 }));
    sfx('common/hupf', { vol: 0.35 });
    const klein = (OBST[fach.id].g * 0.62) / Math.max(s.texture.width, s.texture.height);
    s.zIndex = 60;
    bogenFlug(this, s, ueber.x, ueber.y, { dauer: 0.5, hoehe: 160, skala: klein }).then(() => {
      if (s.destroyed) return;
      // in den Krug: hinter das Glas des Krugs hängen und hineinplumpsen
      umhaengen(s, this.mixer);
      s.zIndex = 5;
      this.tween(s, { y: platz.y, x: platz.x }, 0.32, { ease: 'bounceOut' }).then(() => {
        this.unterwegs = Math.max(0, this.unterwegs - 1);
        if (s.destroyed) return;
        this.imKrug.push({ sprite: s, id: fach.id });
        sfx('common/plopp', { vol: 0.5, rate: 0.8 });
        this.wackel('pop', 0.03);
        if (this.mixWunsch && !this.unterwegs) this.after(0.2, () => this.knopfTipp());
        else if (this.imKrug.length === 1) {
          // „Drück den Knopf" – nicht mehr, wenn das Kind schon gedrückt hat (es mixt) oder weggeblättert ist
          const passt = () => this.aktiv && !this.mixt && !this.mixWunsch && !this.giesst && this.saft <= 0.01
            && this.imKrug.length > 0;
          this.after(0.6, () => { if (passt()) voice('eisdiele_mixen', { nurWenn: passt }); });
        }
      });
    });
    // das Fach füllt sich wieder
    this.after(0.9, () => this.legeObst(fach, true));
  }

  // ---------------------------------------------------------------- Mixen

  knopfTipp() {
    const jetzt = performance.now();
    if (jetzt - this.letzterKlick > 250) {
      this.letzterKlick = jetzt;
      sfx('common/klick', { vol: 0.5 });
    }
    // Druck: der Mixer staucht sich kurz
    this.wackel('pop', 0.04);
    if (this.mixt || this.giesst) return;
    if (this.saft > 0.01) {
      this.after(0.2, () => this.wackel('pop', 0.06));
      return;
    }
    if (this.unterwegs) {
      this.mixWunsch = true;   // Knopf schon gedrückt, während noch eine Frucht fliegt: gleich danach mixen
      return;
    }
    if (!this.imKrug.length) {
      // leer: eine Frucht hüpft kurz („leg mich hinein!") – am liebsten das Wunsch-Obst
      const f = this.fehlendesObst() || pick(this.obst.filter((x) => x.sprite));
      if (f) this.after(0.2, () => fx.pop(f.sprite, 0.12));
      return;
    }
    this.mixWunsch = false;
    this.mixt = true;
    this.mixZeit = 0;
    this.saftFarbe = mischfarbe(this.imKrug.map((f) => OBST[f.id].farbe));
    this.saftInhalt = this.imKrug.map((f) => f.id);
    this.krugSaft.tint = this.saftFarbe;
    this.mixInhalt = this.imKrug.map((f, i) => ({
      s: f.sprite, w: (i / this.imKrug.length) * Math.PI * 2, s0: f.sprite.scale.x, r: 40 + i * 6,
    }));
    sfx('common/kran', { vol: 0.45 });
  }

  update(dt) {
    this.vogel.update(dt);
    this.falter.update(dt);
    if (!this.mixt) return;
    this.mixZeit += dt;
    const p = clamp(this.mixZeit / MIX_DAUER, 0, 1);
    const u = this.krugUnten;
    // Früchte wirbeln ruhig im Kreis und werden zu Saft
    for (const f of this.mixInhalt) {
      if (f.s.destroyed) continue;
      f.w += dt * 4.2;
      const r = f.r * (1 - p * 0.5);
      f.s.x = u.x + Math.cos(f.w) * r;
      f.s.y = u.y - 95 + Math.sin(f.w) * r * 0.55 - p * 30;
      f.s.rotation += dt * 3;
      const k = clamp(1 - p / 0.85, 0, 1);
      f.s.scale.set(f.s0 * (0.4 + 0.6 * k));
      f.s.alpha = k;
    }
    this.saft = p * p * (3 - 2 * p);
    this.krugSaft.fuell(this.saft);
    // leises Surren: der Mixer zittert kaum sichtbar
    this.mixerBild.x = Math.sin(this.mixZeit * 38) * 1.2 * (1 - p);
    if (p >= 1) this.mixFertig();
  }

  mixFertig() {
    this.mixt = false;
    this.mixerBild.x = 0;
    for (const f of this.imKrug) if (!f.sprite.destroyed) f.sprite.destroy();
    this.imKrug = [];
    this.mixInhalt = [];
    this.saft = 1;
    this.krugSaft.fuell(1);
    sfx('common/plopp', { vol: 0.5 });
    const oben = this.welt.toLocal(this.mixer.toGlobal(this.krugOben));
    this.burst('funkeln', oben.x, oben.y + 20, { count: 5 });
    // „Gib den Saft dem Tier" – nicht mehr, wenn das Kind schon gießt oder weggeblättert ist
    const passt = () => this.aktiv && !this.giesst && this.saft > 0.5;
    this.after(0.5, () => { if (passt()) voice('eisdiele_glas', { nurWenn: passt }); });
  }

  // ---------------------------------------------------------------- Gießen

  krugTipp() {
    if (this.mixt || this.giesst) {
      this.wackel('wobble', 0.03);
      return;
    }
    if (this.saft < 0.5) {
      // noch kein Saft: der Mixer wackelt, Hinweis auf Obst bzw. Knopf
      this.wackel('wobble', 0.04);
      note('xylo', 64, { vol: 0.3 });
      if (this.imKrug.length) this.after(0.25, () => this.wackel('pop', 0.05));
      return;
    }
    const glas = this.glaeser.find((g) => !g.voll && !g.unterwegs && !g.ziehen?.isDragging());
    if (!glas) {
      // alle Gläser voll: sie wackeln freundlich („erst austrinken!")
      for (const g of this.glaeser) fx.wobble(g, 0.04);
      note('xylo', 60, { vol: 0.3 });
      return;
    }
    this.giessen(glas);
  }

  async giessen(glas) {
    this.giesst = true;
    glas.unterwegs = true;
    glas.ziehen?.off();
    glas.eventMode = 'none';
    const m = this.mixer;
    // Glas steht sicher an seinem Platz (falls es gerade noch zurückgleitet)
    this.tween(glas, { x: glas.heim.x, y: glas.heim.y }, 0.25, { ease: 'sineInOut' });
    // Mixer neigt sich zum Glas
    const neigung = clamp((glas.x - m.x) / 2400, 0.08, 0.2);
    await this.tween(m, { rotation: neigung }, 0.45, { ease: 'sineInOut' });
    // Strahl: vom vorderen oberen Rand des Krugs (dem Henkel gegenüber) im Bogen ins Glas
    const lippe = this.welt.toLocal(m.toGlobal({ x: this.krugOben.x + LIPPE.x, y: this.krugOben.y + LIPPE.y }));
    const rand = this.welt.toLocal(glas.toGlobal({ x: 0, y: -175 }));
    const ziel = { x: rand.x, y: rand.y + 60 };
    const st = this.strahl;
    st.clear()
      .moveTo(lippe.x, lippe.y)
      .quadraticCurveTo(lippe.x + (ziel.x - lippe.x) * 0.8, lippe.y - 10, ziel.x, ziel.y)
      .stroke({ width: 22, color: this.saftFarbe, cap: 'round', alpha: 0.9 });
    glas.saft.tint = this.saftFarbe;
    glas.inhalt = this.saftInhalt.slice();
    sfx('common/giessen', { vol: 0.35 });
    this.tween(st, { alpha: 1 }, 0.2, { ease: 'sineInOut' });
    const f = { k: 0 };
    await this.tween(f, { k: 1 }, 1.7, {
      ease: 'sineInOut',
      onUpdate: () => {
        this.saft = 1 - f.k;
        this.krugSaft.fuell(this.saft);
        glas.stand = f.k;
        glas.saft.fuell(f.k);
      },
    });
    this.tween(st, { alpha: 0 }, 0.25, { ease: 'sineInOut' });
    this.saft = 0;
    this.krugSaft.fuell(0);
    await this.tween(m, { rotation: 0 }, 0.45, { ease: 'sineInOut' });
    this.giesst = false;
    // Strohhalm hinein
    glas.halm.visible = true;
    glas.halm.alpha = 0;
    const hy = glas.halm.y;
    glas.halm.y = hy - 60;
    this.tween(glas.halm, { alpha: 1 }, 0.25, { ease: 'sineInOut' });
    this.tween(glas.halm, { y: hy }, 0.35, { ease: 'bounceOut' });
    sfx('common/plopp', { vol: 0.45, rate: 1.1 });
    glas.voll = true;
    glas.unterwegs = false;
    glas.ziehen = this.glasZiehen(glas);
  }

  /** Glas ziehbar machen: zum Kunden ziehen oder antippen → er trinkt (nur ein volles Glas). */
  glasZiehen(glas) {
    return drag(glas, {
      hitArea: new PIXI.Rectangle(-105, -255, 210, 285),
      targets: () => this.zielKunde(),
      // sofort beim Berühren: leeres Glas klingt hell, ein volles gluckert leise
      onStart: () => {
        if (!glas.voll) this.leeresGlas(glas);
        else note('glocke', 86, { vol: 0.25 });
      },
      onDrop: (ziel, ctx) => {
        const getippt = Math.hypot(ctx.x - ctx.startX, ctx.y - ctx.startY) < 40;
        if (!glas.voll) return getippt ? undefined : false;
        if (ziel || getippt) {
          if (this.geben(glas, ctx)) return undefined;
          if (getippt) this.kunde.laut();
        }
        return false;
      },
    });
  }

  /** Leeres Glas angetippt: es klingt hell, und der Krug bzw. Knopf zeigt sich. */
  leeresGlas(g) {
    note('glocke', 84 + g.index * 3, { vol: 0.3 });
    if (this.saft > 0.5) this.after(0.2, () => this.wackel('pop', 0.06));
  }

  // ---------------------------------------------------------------- Trinken

  zielKunde() {
    const a = this.kunde?.actor;
    if (!a || !this.kunde.bereit || this.trinkt) return [];
    const m = a.point('mouth');
    return [{ id: 'kunde', x: m.x, y: m.y + 40, radius: 380 }];
  }

  /** Volles Glas dem Kunden geben. → true, wenn es losgeht */
  geben(glas, ctx) {
    const a = this.kunde.actor;
    if (!a || !this.kunde.bereit || this.trinkt || !glas.voll) return false;
    ctx.erledigt = true;
    this.trinkt = true;
    this.trinken(glas, a);
    return true;
  }

  /** Enthält der Saft das Wunsch-Obst? */
  passt(glas) {
    return !!this.wunsch && this.wunsch.every((id) => (glas.inhalt || []).includes(id));
  }

  async trinken(glas, a) {
    const passt = this.passt(glas);
    this.wunsch = null;
    this.blaseWeg();
    glas.ziehen?.off();
    glas.eventMode = 'none';
    glas.unterwegs = true;
    glas.zIndex = 70;
    a.pose('eat');
    // Glas schwebt so heran, dass die Spitze des Strohhalms am Maul ist
    const mund = a.point('mouth');
    const s = 0.8;
    const zx = mund.x - glas.halmSpitze.x * s - (a.flip ? -10 : 10);
    const zy = mund.y - glas.halmSpitze.y * s + 6;
    glas.schatten.visible = false;
    await bogenFlug(this, glas, zx, zy, { dauer: 0.6, hoehe: 90, skala: s });
    if (glas.destroyed) return;
    glas.zIndex = 70;   // das Ziehen setzt seine Ebene nach 0,5 s zurück – das Glas bleibt vor dem Tier
    sfx('common/blubber', { vol: 0.6 });
    a.nod();
    const f = { k: glas.stand };
    await this.tween(f, { k: 0 }, 1.35, {
      ease: 'sineInOut',
      onUpdate: () => glas.saft.fuell(f.k),
    });
    // leeres Glas verschwindet sanft, an seinem Platz steht gleich wieder ein frisches
    await this.tween(glas, { alpha: 0 }, 0.35, { ease: 'sineInOut' });
    this.glasZurueck(glas);

    a.pose('idle');
    this.runde++;
    const kopf = a.point('kopf');
    // Sticker gelegentlich: beim ersten Saft mit dem Wunsch-Obst und dann bei jedem dritten
    if (passt) {
      this.treffer++;
      if (this.treffer % 3 === 1) belohne(this, this.sticker, kopf.x - 220, kopf.y - 80);
    }
    await this.kunde.freut(passt);
    await this.wait(0.3);
    this.trinkt = false;
    await this.kunde.geht();
    await this.naechsterKunde(0.4);
  }

  /** Glas leer und sauber zurück an seinen Platz (wächst weich heran). */
  glasZurueck(g) {
    if (g.destroyed) return;
    g.saft.fuell(0);
    g.stand = 0;
    g.voll = false;
    g.halm.visible = false;
    g.schatten.visible = true;
    g.position.set(g.heim.x, g.heim.y);
    g.zIndex = 25;
    g.alpha = 0;
    g.scale.set(0.4);
    this.tween(g, { alpha: 1 }, 0.35, { ease: 'sineInOut' });
    this.tween(g, { scale: 1 }, 0.5, { ease: 'backOut' });
    sfx('common/plopp', { vol: 0.4, rate: 0.95 });
    g.unterwegs = false;
    g.ziehen = this.glasZiehen(g);
  }

  async naechsterKunde(warte = 0) {
    if (warte) await this.wait(warte);
    const ok = await this.kunde.kommt();
    if (ok) this.zeigeWunsch();
  }

  // ---------------------------------------------------------------- Wunsch

  /** Neuer Wunsch (1–2 verschiedene Früchte; der erste Kunde wünscht sich eine) in einer Denkblase über dem Kopf. */
  zeigeWunsch() {
    const a = this.kunde.actor;
    if (!a) return;
    const n = this.runde === 0 ? 1 : pick([1, 1, 2]);
    const ids = OBST_IDS.slice();
    const w = [];
    for (let i = 0; i < n; i++) w.push(ids.splice(Math.floor(Math.random() * ids.length), 1)[0]);
    this.wunsch = w;

    const kopf = a.point('kopf');
    const b = new PIXI.Container({ label: 'saftwunsch' });
    b.zIndex = 35;
    const S = 0.6;
    spr('common/blase_denk', { anchor: [45 / 600, 540 / 562], scale: S, parent: b });
    const mx = (330 - 45) * S;
    const my = (262 - 540) * S;
    w.forEach((id, i) => {
      const o = OBST[id];
      const f = spr(o.tex, { anchor: 0.5, parent: b });
      const g = n === 1 ? 175 : 135;
      f.scale.set(g / Math.max(f.texture.width, f.texture.height));
      f.position.set(mx + (n === 1 ? 0 : (i ? 72 : -72)), my + (n === 1 ? 0 : (i ? 10 : -10)));
    });
    // Schwanz der Blase knapp über/vor dem Kopf; die Blase bleibt im Kernbereich und über dem Rand unten
    const x = clamp(kopf.x + 10, -1000, 1066 - 340);
    const y = clamp(kopf.y - 90, 120 + 340, 1300);
    b.position.set(x, y);
    b.hitArea = new PIXI.Rectangle(0, -340, 360, 345);
    b.alpha = 0;
    b.scale.set(0.6);
    this.welt.addChild(b);
    this.tween(b, { alpha: 1 }, 0.35, { ease: 'sineInOut' });
    this.tween(b, { scale: 1 }, 0.5, { ease: 'backOut' });
    sfx('common/plopp', { vol: 0.45, rate: 0.9 });
    // Antippen: das Wunsch-Obst in der Blase hüpft, das Tier sagt etwas, die Frucht auf der Kiste zeigt sich
    tap(b, () => {
      for (const c of b.children.slice(1)) fx.pop(c, 0.12);
      this.kunde.laut();
      const fach = this.obst.find((x2) => x2.id === w[0] && x2.sprite);
      if (fach) this.after(0.3, () => fx.pop(fach.sprite, 0.1));
    }, { sound: null, squash: false });
    this.blase = b;
    if (this.runde === 0) this.hinweisAnmelden(0.5);
  }

  blaseWeg() {
    const b = this.blase;
    this.blase = null;
    if (!b || b.destroyed) return;
    b.eventMode = 'none';
    this.tween(b, { alpha: 0, scale: 0.85 }, 0.35, { ease: 'sineInOut' }).then(() => { if (!b.destroyed) b.destroy({ children: true }); });
  }

  /** Erste gewünschte Frucht, die noch nicht im Krug (oder unterwegs dorthin) ist → Fach oder null */
  fehlendesObst() {
    if (!this.wunsch) return null;
    const drin = this.imKrug.map((f) => f.id).concat(this.saftInhalt.length && this.saft > 0.01 ? this.saftInhalt : []);
    for (const id of this.wunsch) {
      if (drin.includes(id)) continue;
      const fach = this.obst.find((x) => x.id === id);
      if (fach?.sprite) return fach;
    }
    return null;
  }

  // ---------------------------------------------------------------- Zeige-Hand

  hinweise() {
    const kunde = this.kunde.bereit && !this.trinkt ? this.kunde.actor : null;
    const voll = this.glaeser.find((g) => g.voll && !g.unterwegs);
    if (voll && kunde) return [{ von: voll, nach: kunde }];
    if (this.mixt || this.giesst) return [];
    const ort = (p) => this.welt.toLocal(this.mixer.toGlobal(p));
    if (this.saft > 0.5 && this.glaeser.some((g) => !g.voll)) return [ort(this.krugZiel)];
    if (this.unterwegs) return [];
    // zuerst das Wunsch-Obst in den Krug, dann der Knopf
    const fehlt = this.passtRein() ? this.fehlendesObst() : null;
    if (fehlt) return [{ von: fehlt.sprite, nach: ort(this.krugZiel) }];
    if (this.imKrug.length) return [ort(this.knopfOrt)];
    const f = pick(this.obst.filter((x) => x.sprite));
    return f ? [{ von: f.sprite, nach: ort(this.krugZiel) }] : [];
  }
}
