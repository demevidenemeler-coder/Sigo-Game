// Seite 1 – Füttern: Vier Hoftiere stehen auf dem Hof. Ab und zu zeigt eines in der Denkblase, was es gern
// hätte. Unten liegt eine Leiste mit fünf Futtern. Sind alle vier satt, freuen sie sich gemeinsam (Sticker),
// laufen hinaus – und aus der Scheune kommen vier neue.
// Nebensachen: Scheunentor (geht auf und zu), Futtertrog, Strohballen, Traktor, Vogel auf dem Zaun,
// Schmetterling, ziehende Wolken.

import { Actor, voice, fx, meta, tex, tap, rand, pick, shuffle, PIXI } from '../../engine/index.js';
import { Seite } from '../../gemeinsam/seiten.js';
import { fuettere, futterAuswahl, mag } from '../../gemeinsam/futter.js';
import { belohne, sticker as stickerVon } from '../../gemeinsam/sticker.js';
import { ton, laut, Wolken, Vogel, Schmetterling, wackelDing, engeTippflaeche } from './hilfen.js';

const TIERE = ['kuh', 'schwein', 'schaf', 'pferd', 'huhn', 'hase', 'hund', 'katze', 'ente'];
// Höhe der Tiere auf dem Bild (Bühnen-Einheiten) – große Tiere etwas größer
const HOEHE = { kuh: 540, pferd: 545, schwein: 500, schaf: 505, hund: 500, katze: 470, hase: 490, huhn: 470, ente: 460 };

// Scheunentor im Hintergrundbild (Bildpunkte des Hintergrunds 2829×1600)
const TOR = { x0: 595, xm: 807, x1: 1010, y0: 597, y1: 940 };
const HG_BREITE = 2829;
// Traktor: klein auf der Wiese hinter dem Zaun (rechts oben, über den Köpfen der Tiere, links vom Blätter-Pfeil)
const TRAKTOR = { x: 860, y: 688, skala: 0.22 };

export class Futterplatz extends Seite {
  static hg = 'bauernhof/hg_futter';

  aufbau() {
    this.plaetze = [1, 2, 3, 4].map((i) => this.punkt('platz' + i, { x: -750 + (i - 1) * 500, y: 1240 }));
    this.tiere = [];          // die vier Tiere der Runde
    this.wechsel = false;     // laufen gerade Tiere hinaus/herein?
    this.runde = 0;
    this.blaseZeit = 4;

    this.baueTor();
    this.baueNebensachen();
    this.wolken = new Wolken(this.hinten, { anzahl: 2, yVon: 70, yBis: 200 });
    // Vogel auf dem Zaun in der Lücke zwischen den beiden mittleren Tieren (dort verdeckt ihn keine Tippfläche)
    this.vogel = new Vogel(this, { x: 0, y: 790 }, { skala: 0.7, z: 6 });
    this.falter = new Schmetterling(this, { x0: -1000, y0: 1180, x1: 1000, y1: 1300 }, { skala: 0.8, eltern: this.vorn });

    // erste Runde: Tiere stehen schon da
    this.neueRunde(true);
  }

  betreten() {
    voice('bauernhof_hallo');
    // Hinweis bei jedem Betreten anmelden (der Kern sagt ihn höchstens einmal am Tag) – aber nur, solange die Seite
    // zu sehen ist und das Kind noch kein Futter genommen hat (auch, wenn er erst nach der Begrüßung dran ist)
    this._hinweis?.kill();
    const passt = () => this.aktiv && !this.futterGenommen;
    this._hinweis = this.after(3.2, () => { if (passt()) voice('bauernhof_futter', { nurWenn: passt }); });
  }

  verlassen() {
    this._hinweis?.kill();
    this._hinweis = null;
  }

  // ---------------------------------------------------------------- Scheunentor

  baueTor() {
    const hgTex = this.hg.texture;
    const halb = HG_BREITE / 2;
    const h = TOR.y1 - TOR.y0;
    // dunkles Innere der Scheune (liegt hinter den Flügeln)
    this.innen = new PIXI.Graphics()
      .rect(TOR.x0 - halb, TOR.y0, TOR.x1 - TOR.x0, h).fill(0x4a2c1c)
      .rect(TOR.x0 - halb, TOR.y0 + h * 0.62, TOR.x1 - TOR.x0, h * 0.38).fill(0x6e4a2a)
      .ellipse((TOR.x0 + TOR.x1) / 2 - halb - 60, TOR.y1 - 30, 120, 34).fill(0xc9a24e)
      .ellipse((TOR.x0 + TOR.x1) / 2 - halb + 90, TOR.y1 - 22, 90, 24).fill(0xd8b25a);
    this.innen.zIndex = 1;
    this.welt.addChild(this.innen);
    // die beiden Flügel: Ausschnitte aus dem Hintergrundbild, drehen sich an den Angeln auf
    const fluegel = (x0, x1, links) => {
      const t = new PIXI.Texture({ source: hgTex.source, frame: new PIXI.Rectangle(x0, TOR.y0, x1 - x0, h) });
      const s = new PIXI.Sprite(t);
      s.anchor.set(links ? 0 : 1, 0);
      s.position.set((links ? x0 : x1) - halb, TOR.y0);
      s.zIndex = 2;
      this.welt.addChild(s);
      return s;
    };
    this.torL = fluegel(TOR.x0, TOR.xm, true);
    this.torR = fluegel(TOR.xm, TOR.x1, false);
    this.torOffen = false;
    // Antippen der Scheune: Tor geht kurz auf
    this.torFlaeche = new PIXI.Container({ label: 'scheune' });
    this.torFlaeche.zIndex = 3;
    this.welt.addChild(this.torFlaeche);
    tap(this.torFlaeche, () => {
      if (this.wechsel) return;
      this.oeffneTor().then(() => this.after(1.6, () => { if (!this.wechsel) this.schliesseTor(); }));
    }, { sound: null, squash: false, hitArea: new PIXI.Rectangle(TOR.x0 - halb - 20, TOR.y0 - 40, TOR.x1 - TOR.x0 + 40, h + 40) });
  }

  oeffneTor() {
    if (this.torOffen) return Promise.resolve(true);
    this.torOffen = true;
    ton('common/tuer', { vol: 0.6, abstand: 0.8 });
    this.tween(this.torL, { scaleX: 0.16, skewY: -0.12 }, 0.8, { ease: 'sineInOut' });
    return this.tween(this.torR, { scaleX: 0.16, skewY: 0.12 }, 0.8, { ease: 'sineInOut' });
  }

  schliesseTor() {
    if (!this.torOffen) return Promise.resolve(true);
    this.torOffen = false;
    this.tween(this.torL, { scaleX: 1, skewY: 0 }, 0.8, { ease: 'sineInOut' });
    return this.tween(this.torR, { scaleX: 1, skewY: 0 }, 0.8, { ease: 'sineInOut' }).then((ok) => {
      if (ok) ton('common/klack', { vol: 0.4 });
      return ok;
    });
  }

  // ---------------------------------------------------------------- Nebensachen

  baueNebensachen() {
    // Traktor steht weit hinten auf der Wiese hinter dem Zaun (über den Köpfen der Tiere, frei antippbar)
    const tk = TRAKTOR.skala;
    this.traktor = this.ding('bauernhof/traktor', TRAKTOR.x, TRAKTOR.y, tk, 4);
    wackelDing(this.traktor, {
      ton: 'common/traktor', vol: 0.55, abstand: 2.8, pad: 45,
      dazu: () => {
        // Rauch aus dem Auspuff (Bildpunkte ~264 rechts, ~600 über dem Anker)
        this.burst('rauch', this.traktor.x + 264 * tk, this.traktor.y - 600 * tk, { count: 3 });
      },
    });
    // Futtertrog vorn links, Strohballen vorn rechts (neben der Leiste)
    this.trog = this.ding('bauernhof/futtertrog', -930, 1420, 0.5, 1420);
    wackelDing(this.trog, { ton: 'common/klack', vol: 0.6, pad: 60 });
    this.stroh = this.ding('bauernhof/strohballen', 905, 1415, 0.5, 1415);
    wackelDing(this.stroh, {
      ton: 'common/rascheln', vol: 0.6, abstand: 0.8, pad: 40,
      dazu: () => this.burst('staub', this.stroh.x, this.stroh.y - 120, { count: 4 }),
    });
  }

  ding(id, x, y, skala, z) {
    const s = new PIXI.Sprite(tex(id));
    const m = meta(id);
    s.anchor.set(m.ax, m.ay);
    s.scale.set(skala);
    s.position.set(x, y);
    s.zIndex = z;
    s.label = id;
    this.welt.addChild(s);
    return s;
  }

  // ---------------------------------------------------------------- Runden

  neueRunde(sofort = false) {
    this.runde++;
    // vier verschiedene Tiere, möglichst andere als zuletzt
    const vorher = this.tiere.map((t) => t.tierId);
    let auswahl = shuffle(TIERE.filter((t) => !vorher.includes(t))).slice(0, 4);
    if (auswahl.length < 4) auswahl = shuffle([...TIERE]).slice(0, 4);
    this.tiere = auswahl.map((id, i) => this.baueTier(id, i, sofort));
    this.baueLeiste();
    if (!sofort) this.kommenHerein();
  }

  baueTier(id, i, sofort) {
    const p = this.plaetze[i];
    const skala = HOEHE[id] / (meta(`tiere/${id}_idle`).h || 900);
    const tier = new Actor(id, { x: p.x, y: p.y, scale: skala, parent: this.welt, z: p.y });
    tier.ruheSkala = skala;
    tier.platz = p;
    tier.satt = false;
    tier.da = sofort;          // steht an seinem Platz (darf gefüttert werden)
    if (i >= 2) tier.flip = true;  // rechts stehende schauen zur Mitte
    this.tippeTier(tier, id);
    if (!sofort) {
      tier.visible = false;
    }
    return tier;
  }

  tippeTier(tier, id) {
    tier.onTap(() => {
      if (!tier.da) { laut(id); return; }
      if (tier.satt) {
        // satt und zufrieden: freut sich (cheer entprellt Dauertippen selbst)
        if (!tier._isst) tier.cheer();
        return;
      }
      fx.wobble(tier, 0.05);
      laut(id);
      this.zeigeWunsch(tier);
    });
    // Tippfläche eng an den Körper: sonst verdecken die Tiere Traktor, Vogel und Scheunentor hinter sich
    engeTippflaeche(tier, { breite: 0.8, oben: 0.02, unten: 30 });
  }

  baueLeiste() {
    const alt = this.leiste;
    if (alt) {
      this.tween(alt.container, { alpha: 0 }, 0.4, { ease: 'sineInOut' }).then(() => alt.off());
    }
    const items = futterAuswahl(this.tiere.map((t) => t.tierId), 5).map((id) => ({ id, tex: id, scale: leistenSkala(id) }));
    this.items = items;
    this.leiste = this.tray({
      items,
      onTap: () => { this.futterGenommen = true; },   // Futter gegriffen: Hinweis „Zieh das Futter …" entfällt
      targets:() => this.tiere.filter((t) => t.da && !t.destroyed).map((t) => {
        const m = t.point('mouth');
        return { id: t.tierId, tier: t, x: m.x, y: m.y + 60, radius: 270 };
      }),
      onDrop: (item, ziel, kopie, ctx) => {
        ctx.behalten();
        kopie.futterId = item.id;
        const tier = ziel.tier;
        fuettere(this, tier, kopie, { heim: { x: ctx.startX, y: ctx.startY } }).then((gemocht) => {
          if (gemocht) {
            this.gefuettert(tier);
            return;
          }
          if (kopie.destroyed) return;
          kopie.eventMode = 'none';
          this.tween(kopie, { alpha: 0 }, 0.35, { ease: 'sineInOut' }).then(() => { if (!kopie.destroyed) kopie.destroy(); });
        });
      },
    });
    if (alt) {
      this.leiste.container.alpha = 0;
      this.tween(this.leiste.container, { alpha: 1 }, 0.5, { ease: 'sineInOut', delay: 0.3 });
    }
  }

  // Wunsch des Tiers: ein Futter aus der Leiste, das es mag
  wunschVon(tier) {
    const moegliche = (this.items || []).map((it) => it.id).filter((id) => mag(tier.tierId, id));
    return moegliche.length ? pick(moegliche) : null;
  }

  zeigeWunsch(tier) {
    const w = this.wunschVon(tier);
    if (!w || tier._blase) return;
    tier.bubble(w, 2.6);
  }

  gefuettert(tier) {
    if (tier.satt) return;
    tier.satt = true;
    if (this.tiere.every((t) => t.satt) && !this.wechsel) {
      this.wechsel = true;
      this.after(1.0, () => this.alleSatt());
    }
  }

  async alleSatt() {
    // gemeinsames Freuen – nacheinander, damit es ruhig bleibt
    this.tiere.forEach((t, i) => this.after(i * 0.45, () => { if (!t.destroyed) t.cheer(); }));
    await this.wait(1.2);
    belohne(this, this.stickerWahl(), 0, 560);
    await this.wait(3.2);
    this.gehenHinaus();
  }

  stickerWahl() {
    const neu = this.tiere.map((t) => 'tier_' + t.tierId).filter((id) => stickerVon(id));
    return neu.length ? pick(neu) : 'bauernhof_traktor';
  }

  async gehenHinaus() {
    const alte = this.tiere;
    alte.forEach((t, i) => {
      t.da = false;
      const nachRechts = i >= 2;
      this.after(i * 0.5, () => {
        if (t.destroyed) return;
        t.walkTo(nachRechts ? 1550 : -1550, t.y, { tempo: 320 }).then(() => { if (!t.destroyed) t.destroy({ children: true }); });
      });
    });
    await this.wait(2.6);
    this.neueRunde(false);
  }

  async kommenHerein() {
    await this.oeffneTor();
    const torX = (TOR.x0 + TOR.x1) / 2 - HG_BREITE / 2;
    for (let i = 0; i < this.tiere.length; i++) {
      const t = this.tiere[i];
      if (t.destroyed) continue;
      // aus dem Tor treten: klein (weit hinten), dann nach vorn zum Platz und dabei größer werden
      t.position.set(torX + rand(-40, 40), TOR.y1 - 8);
      t.scale.set(t.ruheSkala * 0.5);
      t.alpha = 0;
      t.visible = true;
      this.tween(t, { alpha: 1 }, 0.4, { ease: 'sineInOut' });
      const d = Math.hypot(t.platz.x - t.x, t.platz.y - t.y);
      const dauer = d / 300;
      this.tween(t, { scale: t.ruheSkala }, dauer, { ease: 'sineInOut' });
      t.walkTo(t.platz.x, t.platz.y, { tempo: 300 }).then((ok) => {
        if (t.destroyed) return;
        t.position.set(t.platz.x, t.platz.y);
        t.da = true;
        if (ok) t.lookAt(i >= 2 ? -9999 : 9999);
      });
      await this.wait(1.1);
    }
    await this.wait(1.4);
    await this.schliesseTor();
    this.wechsel = false;
    this.blaseZeit = 2;
  }

  // ---------------------------------------------------------------- Ablauf

  update(dt) {
    this.wolken.update(dt);
    this.vogel.update(dt);
    this.falter.update(dt);
    // Tiefe: wer weiter vorn steht, liegt davor
    for (const t of this.tiere) if (!t.destroyed) t.zIndex = Math.round(t.y);

    // ab und zu zeigt ein hungriges Tier seinen Wunsch (nur, wenn das Kind gerade nichts tut)
    if (!this.wechsel) {
      this.blaseZeit -= dt;
      if (this.blaseZeit <= 0) {
        this.blaseZeit = rand(6, 9);
        const hungrig = this.tiere.filter((t) => t.da && !t.satt && !t._isst && !t._blase);
        if (hungrig.length && this.szene.idle > 1.5) this.zeigeWunsch(pick(hungrig));
      }
    }
  }

  hinweise() {
    const hungrig = this.tiere.filter((t) => t.da && !t.satt && !t.destroyed);
    if (!hungrig.length || this.wechsel) return [];
    const liste = [];
    for (const t of hungrig) {
      const w = this.wunschVon(t);
      const bild = w && this.leiste?.sprite(w);
      if (bild) liste.push({ von: bild, nach: t });
    }
    liste.push(hungrig[0]);
    return liste;
  }
}

// Flache Futter (Knochen, Wurm, Banane) in der Leiste etwas größer, damit sie gut zu greifen sind
// (die Leiste bringt die längere Seite auf ~210 Einheiten; die kürzere soll mindestens ~150 haben)
function leistenSkala(id) {
  const m = meta(id);
  if (!m?.w || !m?.h) return 1;
  const verh = Math.min(m.w, m.h) / Math.max(m.w, m.h);
  return Math.max(1, Math.min(1.3, 0.72 / verh));
}
