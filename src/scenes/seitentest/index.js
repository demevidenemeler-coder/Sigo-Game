// Testszene für die gemeinsamen Bausteine Seiten, Futter und Sticker (src/gemeinsam/).
//   Seite 1 (Wiese):   Kuh und Hund füttern – Leiste mit Heu, Knochen und Fisch (Fisch mag keiner der beiden)
//   Seite 2 (Wache):   Sticker-Knopf – erstes Antippen: Stern fliegt ins Album, danach nur Funkeln
//   Seite 3 (Einsatz): alle benannten Punkte des Hintergrunds als kleine Markierungen (this.punkt)
// Start direkt auf einer Seite: ?szene=seitentest&seite=2

import { stage, meta, Actor, fx, ui, PIXI } from '../../engine/index.js';
import { Seite, SeitenSzene } from '../../gemeinsam/seiten.js';
import { fuettere, wunsch } from '../../gemeinsam/futter.js';
import { belohne } from '../../gemeinsam/sticker.js';

// ---------------------------------------------------------------- Seite 1: Füttern

class Wiese extends Seite {
  static hg = 'demo/hintergrund';

  aufbau() {
    const y = 1250;
    this.kuh = new Actor('kuh', { x: -520, y, scale: 0.55, parent: this.welt, z: 10 });
    this.hund = new Actor('hund', { x: 420, y, scale: 0.5, flip: true, parent: this.welt, z: 10 });
    // Antippen: Tier zeigt in der Denkblase, was es gern hätte
    for (const tier of [this.kuh, this.hund]) {
      tier.onTap(() => {
        fx.wobble(tier);
        tier.sound();
        tier.bubble(wunsch(tier.tierId), 2.2);
      });
    }

    this.leiste = this.tray({
      items: ['common/futter_heu', 'common/futter_knochen', 'common/futter_fisch'].map((id) => ({ id, tex: id })),
      targets: () => [this.kuh, this.hund].map((tier) => {
        const m = tier.point('mouth');
        return { id: tier.tierId, tier, x: m.x, y: m.y, radius: 300 };
      }),
      onDrop: (item, ziel, kopie, ctx) => {
        ctx.behalten(); // die Kopie gehört jetzt uns – fuettere() fliegt sie zum Maul
        kopie.futterId = item.id;
        fuettere(this, ziel.tier, kopie, { heim: { x: ctx.startX, y: ctx.startY } }).then((gemocht) => {
          if (gemocht || kopie.destroyed) return;
          // zurück in der Leiste: weich verschwinden (das Fach ist dort ja wieder voll)
          kopie.eventMode = 'none';
          this.tween(kopie, { alpha: 0 }, 0.35, { ease: 'sineInOut' }).then(() => { if (!kopie.destroyed) kopie.destroy(); });
        });
      },
    });
  }

  hinweise() {
    return [{ von: this.leiste.sprite('common/futter_heu'), nach: this.kuh }, this.kuh, this.hund];
  }
}

// ---------------------------------------------------------------- Seite 2: Sticker

class Wache extends Seite {
  static hg = 'feuerwehr/hg_wache';

  aufbau() {
    this.sternKnopf = this.knopf('feuerwehr/stern_orden', { size: 280, onTap: () => this.antippen() });
    this.legeKnopf();
  }

  legeKnopf() {
    this.sternKnopf.position.set(stage.W / 2, 760);
  }

  resize() {
    this.legeKnopf();
  }

  antippen() {
    // Knopf liegt in this.hud (0…stage.W) – belohne() will Szenen-Koordinaten (x=0 Bildmitte)
    belohne(this, 'feuerwehr_helm', this.sternKnopf.x - stage.W / 2, this.sternKnopf.y - 40);
  }

  hinweise() {
    return [this.sternKnopf];
  }
}

// ---------------------------------------------------------------- Seite 3: Punkte des Hintergrunds

class Einsatz extends Seite {
  static hg = 'feuerwehr/hg_einsatz';

  aufbau() {
    this.marken = [];
    const pts = meta(this.hgId).pts || {};
    for (const name of Object.keys(pts)) {
      const p = this.punkt(name);
      const m = new PIXI.Container({ label: 'marke:' + name });
      m.position.set(p.x, p.y);
      m.addChild(
        new PIXI.Graphics()
          .circle(0, 0, 34).fill({ color: 0xffffff, alpha: 0.8 }).stroke({ width: 6, color: 0xe0503c })
          .circle(0, 0, 8).fill(0xe0503c),
      );
      // Namen nur zum Prüfen (Testszene, nicht für Kinder)
      const schrift = new PIXI.Text({ text: name, style: { fontSize: 34, fill: 0x3a2a1a, fontWeight: 'bold' } });
      schrift.anchor.set(0.5, 0);
      schrift.y = 42;
      m.addChild(schrift);
      m.zIndex = 50;
      this.welt.addChild(m);
      this.marken.push(m);
    }
    // Standlinie (this.boden) als dünne Linie
    const linie = new PIXI.Graphics().moveTo(-1400, this.boden).lineTo(1400, this.boden)
      .stroke({ width: 4, color: 0x3a7ad0, alpha: 0.6 });
    this.welt.addChild(linie);
  }

  betreten() {
    // Beim Ankommen hüpfen die Markierungen nacheinander kurz (ruhig, eine nach der anderen)
    this.marken.forEach((m, i) => this.after(0.15 * i, () => fx.pop(m, 0.15)));
  }

  hinweise() {
    return this.marken.slice(0, 2);
  }
}

// ---------------------------------------------------------------- Szene

export default class Seitentest extends SeitenSzene {
  static id = 'seitentest';
  static packs = ['demo', 'feuerwehr', 'tiere'];
  static music = 'musik/wiese';
  static seiten = [Wiese, Wache, Einsatz];

  vorbereiten() {
    ui.albumKnopf(this);
  }
}
