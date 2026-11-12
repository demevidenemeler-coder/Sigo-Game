// Seite 1: Das Gemüsebeet – jede Runde kommt ein Gast mit einem Wunsch.
// Ablauf einer Runde (jeder Schritt mit eigener Geste, nichts kann schiefgehen):
//   1. Ein Gast (Hase, Schwein, Bär, Eichhörnchen, Pferd, Ente, Igel – nie einer der letzten drei) kommt
//      ans Beet und zeigt in einer Denkblase, was er gern hätte.
//   2. Unkraut zupfen: Auf ein paar Hügeln wachsen Löwenzahn oder Pusteblumen – nach oben ziehen (oder antippen).
//      Pusteblumen pusten ihre Schirmchen weg, manchmal schaut dabei der Regenwurm heraus.
//   3. Säen: Samentüte auf einen freien Hügel ziehen (oder antippen → nächster freier Hügel).
//   4. Gießen: Gießkanne über die Pflanze ziehen – sie wächst in zwei Schritten.
//   5. Ernten: reife Pflanze antippen. Das Gewünschte hüpft auf den Rand des Beets, alles andere in den Korb.
//   6. Waschen: Das Gemüse ist voller Erde – mit dem Finger sauber reiben (wischen; wer eine Weile breit über das
//      Gemüse reibt, bekommt es immer sauber).
//   7. Geben: Das saubere Gemüse zum Gast ziehen (oder antippen) – er isst, freut sich, es gibt einen Sticker,
//      und als Dankeschön wächst am Zaun eine Blume (die Reihe füllt sich über die Runden und bleibt gespeichert).
//   Danach geht der Gast, der nächste kommt. Fünf Ernten im Korb → Sticker, der Korb wird wieder leer.
// Die Zeige-Hand folgt dieser Kette (sie zeigt immer nur den nächsten Schritt für den Gast).
// Kleine Gäste wie bisher: Biene, Marienkäfer, Schnecke, Regenwurm, ein Vogel auf dem Zaun.

import {
  tap, drag, wipe, sfx, voice, note, fx, Actor, spr, meta, store, stage, rand, pick, clamp, killTweensOf, PIXI,
} from '../../engine/index.js';
import { Seite } from '../../gemeinsam/seiten.js';
import { belohne } from '../../gemeinsam/sticker.js';
import { umhängen, skalaFür, bogen, gleitDauer, Vogel, Flieger, wähleNeu, lassEssen } from './helfer.js';
import { bauKorb } from './korb.js';

// Pflanzen: Bilder der drei Stufen (Keim, halb, reif), Darstellungshöhe je Stufe, Ernte-Bild
const PFLANZEN = {
  karotte: {
    stufen: ['garten/keim', 'garten/karotte_2', 'garten/karotte_3'], höhe: [140, 280, 330],
    ernte: 'common/futter_karotte',
  },
  sonnenblume: {
    stufen: ['garten/keim', 'garten/sonnenblume_2', 'garten/sonnenblume_3'], höhe: [140, 320, 460],
    ernte: 'garten/ernte_sonnenblume',
  },
  erdbeere: {
    stufen: ['garten/keim', 'garten/erdbeere_2', 'garten/erdbeere_3'], höhe: [140, 230, 270],
    ernte: 'common/futter_erdbeere',
  },
  tomate: {
    stufen: ['garten/keim', 'garten/tomate_2', 'garten/tomate_3'], höhe: [140, 320, 390],
    ernte: 'garten/ernte_tomate',
  },
  kuerbis: {
    stufen: ['garten/keim', 'garten/kuerbis_2', 'garten/kuerbis_3'], höhe: [140, 230, 230],
    ernte: 'garten/ernte_kuerbis',
  },
};
const SORTEN = ['karotte', 'sonnenblume', 'erdbeere', 'tomate', 'kuerbis'];
const MAX_BREITE = 330;        // so breit darf eine Pflanze auf ihrem Hügel höchstens werden
const PFLANZ_TIEFE = 50;       // Fuß der Pflanze liegt so weit unter der Hügelkuppe
const GIESS_ZEIT = 1.1;        // Sekunden Wasser bis zum nächsten Wachsen
const KORB_RUNDE = 5;          // so viele Ernten im Korb → Sticker
const TROPFEN = 22;            // Vorrat an Wassertropfen

const KANNE_RUHE = { x: -905, y: 1385 };
const KANNE_SKALA = 0.72;
const TÜLLE = { x: 385 - 210, y: 88 - 151 };   // Brausekopf relativ zur Bildmitte (Punkt tuelle aus pack.json)

// Gäste: Tier, Größe, Wunsch (Sorte). Der Hase kommt beim allerersten Mal (er wohnt hier).
const GÄSTE = [
  { tier: 'hase', scale: 0.36, wunsch: 'karotte', kraut: true },
  { tier: 'schwein', scale: 0.34, wunsch: 'kuerbis', kraut: true },
  { tier: 'baer', scale: 0.37, wunsch: 'erdbeere', kraut: false },
  { tier: 'eichhoernchen', scale: 0.34, wunsch: 'sonnenblume', kraut: false },
  { tier: 'pferd', scale: 0.38, wunsch: 'karotte', kraut: true },
  { tier: 'ente', scale: 0.32, wunsch: 'tomate', kraut: true },
  { tier: 'igel', scale: 0.32, wunsch: 'erdbeere', kraut: false },
];
const GAST_X = 930;
const GAST_WEG = 1520;         // dort kommen die Gäste her (rechts außerhalb des Bildes)
const GESCHENK = { x: 585, y: 1238 };   // Waschplatz auf dem vorderen Beetrand (Unterkante des Gemüses)
const GESCHENK_HÖHE = 210;
// Waschen: Pinsel-Radius, ab welchem Anteil ein Fleck als sauber gilt, und nach wie viel Reibe-Zeit (Sekunden, in
// denen sich wirklich etwas tut) die übrigen Flecken von selbst weich verschwinden – breites Reiben über das ganze
// Gemüse, wie es kleine Kinder tun, reicht so immer.
const WISCH_RADIUS = 100;
const WISCH_FERTIG = 0.6;
const REIBE_ZEIT = 2.4;
// Dankeschön-Blumen hinter dem Beet vor dem Zaun (in den Lücken zwischen den Hügeln)
const DANKE_X = [-1150, -768, -348, 69, 484, 860];
const DANKE_Y = 985;
const DANKE_FARBEN = ['rot', 'gelb', 'blau', 'rosa', 'orange', 'lila'];
const DANKE_TÖNE = [72, 76, 79, 81, 84, 88];
const DANKE_KEY = 'garten.dankeblumen';

export class Beet extends Seite {
  static hg = 'garten/hg_beet';

  aufbau() {
    this.zeit = 0;
    this.korbZahl = 0;
    this.giessTon = 0;
    this.hinweisSorte = 0;
    this.sät = false;          // läuft gerade eine Aussaat?
    this.saatSchlange = [];    // weitere Aussaaten warten hier (Ruhe: immer nur eine Tüte unterwegs)
    this.gast = null;          // Actor des Gasts
    this.gastCfg = null;
    this.gastDa = false;       // steht am Beet und wartet
    this.geschenk = null;      // das gewünschte Gemüse auf dem Waschplatz
    this.wischTakt = 0;

    this.baueHügel();
    this.baueKanne();
    this.baueKorb();
    this.baueLeiste();
    this.baueGäste();
    this.baueTropfen();
    this.baueDankeBlumen();

    // Erster Gast: der Hase sitzt schon da, zwei Unkräuter wachsen
    this.neuerGast({ sofort: true });

    // Der Gast zeigt ab und zu, was er gern hätte (nur, wenn gerade niemand spielt)
    this.every(11, () => {
      if (this.aktiv && this.szene.idle > 3 && this.gastDa && !this.geschenk) this.zeigeWunsch();
    });
  }

  betreten() {
    if (this.besuche === 1) voice('garten_hallo');
    // Hinweise bei jedem Betreten anbieten (der Kern sagt jeden höchstens einmal am Tag), nur solange sie passen
    this.tüteHier = false;
    this._hinweis?.kill();
    const unkraut = () => this.aktiv && this.plätze.some((p) => p.unkraut && !p.unkraut.raus);
    const passt = () => this.aktiv && !this.tüteHier && !this.sät && !unkraut() &&
      this.plätze.every((p) => p.stufe === 0 && !p.belegt);
    this._hinweis = this.after(this.besuche === 1 ? 3.2 : 2.5, () => {
      if (unkraut()) voice('garten_unkraut', { nurWenn: unkraut });
      else if (passt()) voice('garten_saeen', { nurWenn: passt });
    });
    if (this.gastDa && !this.geschenk) this.after(1.2, () => { if (this.aktiv) this.zeigeWunsch(); });
    // war beim Wegblättern gerade Waschen dran: weiter Reibe-Zeit zählen
    if (this.geschenk && !this.geschenk.sauber && this.geschenk.flecken.length) this.reibenAn(this.geschenk);
  }

  // ---------------------------------------------------------------- Hügel und Pflanzen

  baueHügel() {
    const ersatzX = [-980, -557, -140, 278, 690];
    this.plätze = ersatzX.map((ex, i) => {
      const p = this.punkt('beet' + (i + 1), { x: ex, y: 1035 });
      const c = new PIXI.Container({ label: 'beet' + (i + 1) });
      c.position.set(p.x, p.y + PFLANZ_TIEFE);
      c.zIndex = 100 + i;
      c.sortableChildren = true;
      this.welt.addChild(c);
      const platz = {
        i, c, x: p.x, y: p.y + PFLANZ_TIEFE, sorte: null, stufe: 0, sprite: null, höhe: 0,
        wasser: 0, belegt: false, phase: rand(0, 6), unkraut: null,
      };
      tap(c, () => this.tippePlatz(platz), {
        sound: null, squash: false, hitArea: new PIXI.Rectangle(-150, -200, 300, 270),
      });
      return platz;
    });
  }

  // freier Hügel zum Säen (kein Unkraut, nichts gepflanzt)
  istFrei(p) {
    return p.stufe === 0 && !p.belegt && !p.unkraut;
  }

  freierPlatz() {
    return this.plätze.find((p) => this.istFrei(p)) || null;
  }

  // Tippfläche passend zur Pflanze (mindestens 300 × 270)
  setzeFläche(platz) {
    const h = Math.max(200, platz.höhe + 40);
    platz.c.hitArea = new PIXI.Rectangle(-150, -h, 300, h + 70);
  }

  setzePflanze(platz, sorte, stufe, { weich = true } = {}) {
    const cfg = PFLANZEN[sorte];
    const id = cfg.stufen[stufe - 1];
    const s = skalaFür(id, cfg.höhe[stufe - 1], MAX_BREITE);
    const alt = platz.sprite;
    const neu = spr(id, { parent: platz.c });
    platz.sorte = sorte;
    platz.stufe = stufe;
    platz.sprite = neu;
    platz.höhe = (meta(id).h || neu.texture.height) * s;
    platz.wasser = 0;
    this.setzeFläche(platz);
    if (weich) {
      neu.alpha = 0;
      neu.scale.set(s * (alt ? 0.85 : 0.2));
      this.tween(neu, { alpha: 1 }, alt ? 0.6 : 0.3, { ease: 'sineInOut' });
      this.tween(neu, { scale: s }, alt ? 0.8 : 0.55, { ease: 'backOut' });
    } else {
      neu.scale.set(s);
    }
    if (alt) {
      killTweensOf(alt);
      this.tween(alt, { alpha: 0 }, 0.6, { ease: 'sineInOut' }).then(() => { if (!alt.destroyed) alt.destroy(); });
    }
  }

  tippePlatz(platz) {
    // Sitzt die Biene auf dieser Pflanze, fliegt sie auf (der Tipp gilt trotzdem der Pflanze)
    if (this.biene.ding === platz) this.biene.aufflattern();
    if (platz.unkraut && !platz.unkraut.raus) {
      this.zupfe(platz.unkraut);
      return;
    }
    if (platz.belegt) {
      if (platz.sprite) fx.wobble(platz.sprite, 0.05);
      return;
    }
    if (platz.stufe === 0) {
      // leerer Hügel: Erde krümelt, die (gewünschte) Samentüte hüpft als Hinweis
      sfx('common/graben', { vol: 0.4 });
      this.burst('staub', platz.x, platz.y - 30, { count: 3 });
      const tüte = this.leiste.sprite(this.hinweisTüte());
      if (tüte) fx.pop(tüte, 0.15);
    } else if (platz.stufe < 3) {
      // wächst noch: raschelt, die Gießkanne wackelt als Hinweis
      fx.wobble(platz.sprite, 0.06);
      sfx('common/rascheln', { vol: 0.45 });
      if (!this.kannenZug.isDragging()) fx.wobble(this.kanne, 0.06);
    } else {
      this.ernten(platz);
    }
  }

  wachsen(platz) {
    if (platz.stufe < 1 || platz.stufe >= 3) return;
    this.setzePflanze(platz, platz.sorte, platz.stufe + 1);
    sfx('common/wachsen', { vol: 0.8 });
    this.burst('funkeln', platz.x, platz.y - platz.höhe * 0.6, { count: 4 });
    // „Fertig! Tipp die Pflanze an." – nur, solange noch eine reife Pflanze steht und die Seite zu sehen ist
    const reif = () => this.aktiv && this.plätze.some((p) => p.stufe === 3 && !p.belegt);
    if (platz.stufe === 3) this.after(0.9, () => { if (reif()) voice('garten_ernten', { nurWenn: reif }); });
  }

  // ---------------------------------------------------------------- Unkraut

  // Zu Beginn einer Runde wachsen auf 2–3 freien Hügeln Löwenzahn oder Pusteblumen
  wachseUnkraut({ sofort = false } = {}) {
    const frei = this.plätze.filter((p) => this.istFrei(p)).sort(() => Math.random() - 0.5);
    const anzahl = Math.min(frei.length, pick([2, 3, 3]));
    let puste = 0;
    frei.slice(0, anzahl).forEach((p, k) => {
      // höchstens eine Pusteblume je Runde (sie ist die kleine Überraschung)
      const art = puste === 0 && Math.random() < 0.4 ? 'puste' : 'loewenzahn';
      if (art === 'puste') puste++;
      this.pflanzeUnkraut(p, art, sofort ? 0 : 0.6 + k * 0.5);
    });
  }

  pflanzeUnkraut(platz, art, verzögerung) {
    const id = art === 'puste' ? 'garten/pusteblume' : 'garten/loewenzahn';
    const s = skalaFür(id, art === 'puste' ? 240 : 175, 230);
    const sp = spr(id, { parent: platz.c, z: 5 });
    sp.x = rand(-25, 25);
    const u = { sp, art, platz, s, raus: false, zug: null };
    platz.unkraut = u;
    // Tippfläche (lokal, unskaliert): mindestens 240 × (Höhe + 80) Einheiten
    const h = meta(id).h || sp.texture.height;
    sp.hitArea = new PIXI.Rectangle(-120 / s, -h - 40 / s, 240 / s, h + 80 / s);
    sp.eventMode = 'none';
    const fertig = () => {
      if (sp.destroyed || u.raus) return;
      sp.eventMode = 'static';
      u.zug = drag(sp, {
        back: false,
        lift: 1.04,
        sound: null,
        onStart: () => { sfx('common/rascheln', { vol: 0.35 }); },
        onMove: (z, ctx) => {
          // Die Pflanze bleibt in der Erde stecken und dehnt sich ein wenig – weit genug gezogen, kommt sie heraus
          const hoch = ctx.startY - ctx.y;
          sp.x = ctx.startX;
          sp.y = clamp(-hoch * 0.25, -40, 0);
          if (hoch > 90) this.zupfe(u);
        },
        onDrop: (z, ctx) => {
          if (u.raus) return;
          // Nur angetippt oder zur Seite gezogen: auch dann kommt sie heraus (nichts kann schiefgehen)
          this.zupfe(u);
          void ctx;
        },
      });
    };
    if (verzögerung <= 0) {
      sp.scale.set(s);
      this.after(0.05, fertig);
      return;
    }
    sp.scale.set(0.01);
    sp.alpha = 0;
    this.after(verzögerung, () => {
      if (sp.destroyed) return;
      sfx('common/wachsen', { vol: 0.45 });
      this.tween(sp, { alpha: 1 }, 0.4, { ease: 'sineInOut' });
      this.tween(sp, { scale: s }, 0.7, { ease: 'backOut' }).then(fertig);
    });
  }

  zupfe(u) {
    if (u.raus) return;
    u.raus = true;
    u.zug?.off();
    u.zug = null;
    const { sp, platz } = u;
    platz.unkraut = null;
    killTweensOf(sp);
    sp.eventMode = 'none';
    sp.alpha = 1;
    sfx('common/rupf', { vol: 0.85 });
    this.burst('staub', platz.x, platz.y - 25, { count: 3 });
    umhängen(sp, this.vorn);
    sp.zIndex = 880;
    sp.scale.set(u.s);
    // Überraschung: manchmal schaut der Regenwurm aus dem Loch
    if (!this.wurm.oben && Math.random() < 0.3) {
      this.wurm.c.x = platz.x + 95;
      this.wurm.c.y = platz.y + 92;
      this.after(0.5, () => this.wurmRauf());
    }
    // Hinweis auf den nächsten Schritt, wenn alles Unkraut weg ist
    if (!this.plätze.some((p) => p.unkraut)) this.after(0.9, () => this.zeigeTüte());
    if (u.art === 'puste') this.puste(u);
    else this.löwenzahnWeg(u);
  }

  // Pusteblume: die Schirmchen schweben langsam davon, der Stängel blendet aus
  async puste(u) {
    const sp = u.sp;
    const kopf = { x: sp.x, y: sp.y - sp.height * 0.8 };
    await this.tween(sp, { y: sp.y - 60 }, 0.3, { ease: 'quadOut' });
    if (sp.destroyed) return;
    note('glocke', pick([84, 88, 91]), { vol: 0.25 });
    for (let k = 0; k < 9; k++) {
      const g = this.schirmchen();
      g.position.set(kopf.x + rand(-40, 40), kopf.y + rand(-30, 30));
      g.alpha = 0;
      this.vorn.addChild(g);
      const d = k * 0.08;
      const zx = g.x + rand(120, 420);
      const zy = g.y - rand(160, 380);
      this.tween(g, { alpha: 0.95 }, 0.3, { delay: d });
      this.tween(g, { x: zx, y: zy, rotation: rand(-0.6, 0.6) }, rand(3, 4.2), { ease: 'sineInOut', delay: d })
        .then(() => !g.destroyed && this.tween(g, { alpha: 0 }, 0.8))
        .then(() => { if (!g.destroyed) g.destroy(); });
    }
    this.tween(sp, { alpha: 0 }, 0.9, { ease: 'sineInOut', delay: 0.3 }).then(() => { if (!sp.destroyed) sp.destroy(); });
  }

  // ein weißes Schirmchen (gezeichnet: Stiel + weicher Flaum)
  schirmchen() {
    const g = new PIXI.Graphics();
    g.moveTo(0, 0).lineTo(0, 26).stroke({ width: 3, color: 0xd8d2c0, cap: 'round' });
    g.circle(0, 0, 13).fill({ color: 0xffffff, alpha: 0.85 });
    g.circle(-3, -3, 6).fill({ color: 0xffffff, alpha: 0.9 });
    g.zIndex = 890;
    g.eventMode = 'none';
    return g;
  }

  // Löwenzahn: Gäste, die Grünes mögen, knabbern ihn; sonst wirft man ihn weg (Blätter rieseln)
  async löwenzahnWeg(u) {
    const sp = u.sp;
    await this.tween(sp, { y: sp.y - 90, rotation: rand(-0.2, 0.2) }, 0.3, { ease: 'quadOut' });
    if (sp.destroyed) return;
    const gast = this.gast;
    if (gast && this.gastDa && this.gastCfg?.kraut && !gast._isst) {
      gast._isst = true;
      umhängen(sp, this.welt);
      const ok = await lassEssen(this, gast, sp, { bissen: 1, vol: 0.6 });
      if (gast && !gast.destroyed) gast._isst = false;
      if (ok || sp.destroyed) return;
    }
    if (sp.destroyed) return;
    this.burst('blaetter', sp.x, sp.y - 80, { count: 3 });
    this.tween(sp, { alpha: 0, scale: u.s * 0.5 }, 0.5, { ease: 'sineInOut' })
      .then(() => { if (!sp.destroyed) sp.destroy(); });
  }

  // ---------------------------------------------------------------- Säen

  // Welche Tüte zeigt die Hand? Die gewünschte, solange davon nichts wächst – sonst reihum
  hinweisTüte() {
    const w = this.gastCfg?.wunsch;
    if (w && !this.geschenk && !this.plätze.some((p) => p.sorte === w)) return w;
    return SORTEN[this.hinweisSorte % SORTEN.length];
  }

  zeigeTüte() {
    if (!this.aktiv || !this.freierPlatz()) return;
    const tüte = this.leiste.sprite(this.hinweisTüte());
    if (tüte) fx.pulse(tüte);
  }

  baueLeiste() {
    this.leiste = this.tray({
      items: SORTEN.map((id) => ({ id, tex: 'garten/tuete_' + id })),
      abstand: 250,
      onPick: (item, kopie) => this.tüteGegriffen(item, kopie),
    });
  }

  tüteGegriffen(item, kopie) {
    this.tüteHier = true;
    drag(kopie, {
      targets: () => this.plätze.filter((p) => this.istFrei(p))
        .map((p) => ({ platz: p, x: p.x, y: p.y - 80, radius: 250 })),
      back: false,
      lift: 1.12,
      onDrop: (ziel, ctx) => {
        kopie.eventMode = 'none';
        let platz = ctx.cancelled ? null : ziel?.platz;
        // nur angetippt (kaum bewegt): zum nächsten freien Hügel
        if (!platz && !ctx.cancelled && Math.hypot(ctx.x - ctx.startX, ctx.y - ctx.startY) < 70) platz = this.freierPlatz();
        if (platz && this.istFrei(platz)) this.säeBald(platz, item.id, kopie);
        else {
          this.tüteWeg(kopie, ctx);
          // kein Hügel frei, weil Unkraut wächst: das Unkraut wackelt als Hinweis
          const u = this.plätze.find((p) => p.unkraut && !p.unkraut.raus)?.unkraut;
          if (u && !this.freierPlatz()) fx.wobble(u.sp, 0.08);
        }
      },
    });
  }

  tüteWeg(kopie, ctx) {
    // zurück zur Leiste (der Kern gleitet mit cubicOut: weiter Weg → länger, damit sie nicht davonschießt)
    ctx.back(gleitDauer(ctx.heimX - kopie.x, ctx.heimY - kopie.y, 0.4, 3)).then(() => {
      if (kopie.destroyed) return;
      this.tween(kopie, { alpha: 0, scale: Math.abs(kopie.scale.y) * 0.5 }, 0.25, { ease: 'sineInOut' })
        .then(() => { if (!kopie.destroyed) kopie.destroy(); });
    });
  }

  // Aussaat anmelden: der Hügel ist sofort reserviert; läuft schon eine, wartet diese Tüte (leicht kleiner und
  // durchscheinend an ihrem Platz), bis sie dran ist – so fliegen bei schnellem Mehrfach-Tippen nie viele Tüten
  // gleichzeitig und die Geräusche stapeln sich nicht.
  säeBald(platz, sorte, kopie) {
    platz.belegt = true;
    this.hinweisSorte++;
    umhängen(kopie, this.vorn);
    kopie.zIndex = 900;
    if (!this.sät) {
      this.säen(platz, sorte, kopie, false);
      return;
    }
    killTweensOf(kopie, ['alpha']);
    this.tween(kopie, { alpha: 0.75 }, 0.3, { ease: 'sineInOut' });
    this.saatSchlange.push({ platz, sorte, kopie });
  }

  nächsteSaat() {
    const n = this.saatSchlange.shift();
    if (!n) return;
    if (n.kopie.destroyed) { this.nächsteSaat(); return; }
    killTweensOf(n.kopie, ['alpha']);
    this.tween(n.kopie, { alpha: 1 }, 0.2, { ease: 'sineInOut' });
    this.säen(n.platz, n.sorte, n.kopie, true);
  }

  async säen(platz, sorte, kopie, folge) {
    this.sät = true;
    const leiser = folge ? 0.6 : 1;   // Folge-Aussaaten etwas leiser
    killTweensOf(kopie, ['x', 'y', 'rotation']);
    // Tüte schwebt über den Hügel und kippt
    await bogen(this, kopie, platz.x - 70, platz.y - 230, { dauer: 0.45, höhe: 60 });
    await this.tween(kopie, { rotation: 0.95 }, 0.3, { ease: 'sineInOut' });
    // Samen rieseln aus der Öffnung auf den Hügel
    sfx('common/sand', { vol: 0.45 * leiser });
    for (let k = 0; k < 5; k++) {
      const korn = new PIXI.Graphics().ellipse(0, 0, 9, 7).fill(0x8a5a2b).ellipse(-2, -2, 4, 3).fill({ color: 0xffffff, alpha: 0.25 });
      korn.position.set(platz.x + 8 + rand(-10, 10), platz.y - 300);
      korn.zIndex = 890;
      korn.alpha = 0;
      this.vorn.addChild(korn);
      const d = k * 0.12;
      this.tween(korn, { alpha: 1 }, 0.1, { delay: d });
      this.tween(korn, { y: platz.y - 40 + rand(-8, 8), x: platz.x + rand(-30, 30) }, 0.5, { ease: 'quadIn', delay: d })
        .then(() => this.tween(korn, { alpha: 0 }, 0.3))
        .then(() => { if (!korn.destroyed) korn.destroy(); });
    }
    await this.wait(0.75);
    this.tween(kopie, { alpha: 0, scale: Math.abs(kopie.scale.y) * 0.6 }, 0.35, { ease: 'sineInOut' })
      .then(() => { if (!kopie.destroyed) kopie.destroy(); });
    this.burst('staub', platz.x, platz.y - 25, { count: 3 });
    sfx('common/plopp', { vol: 0.8 * leiser });
    this.setzePflanze(platz, sorte, 1);
    platz.belegt = false;
    // „Jetzt gießen!" – nicht, wenn das Kind die Gießkanne schon hält (oder die Seite nicht mehr zu sehen ist)
    const durst = () => this.aktiv && !this.kannenZug.isDragging() &&
      this.plätze.some((p) => p.stufe >= 1 && p.stufe < 3 && !p.belegt);
    if (durst()) voice('garten_giessen', { nurWenn: durst });
    if (!this.saatSchlange.length) {
      this.after(0.7, () => { if (!this.kannenZug.isDragging()) fx.wobble(this.kanne, 0.07); });
    }
    // die nächste wartende Tüte nach einer kleinen Pause
    await this.wait(0.35);
    this.sät = false;
    this.nächsteSaat();
  }

  // ---------------------------------------------------------------- Gießen

  baueKanne() {
    this.kanne = spr('common/giesskanne', {
      anchor: 0.5, x: KANNE_RUHE.x, y: KANNE_RUHE.y, scale: KANNE_SKALA, parent: this.welt, z: 700,
    });
    this.kannenZug = drag(this.kanne, {
      back: false,
      lift: 1.06,
      pad: 30,
      onStart: () => sfx('common/tipp', { vol: 0.5 }),
      onDrop: () => this.kanneHeim(),
    });
    this._g = new PIXI.Point();
    this._l = new PIXI.Point();
    this._tülle = new PIXI.Point(TÜLLE.x, TÜLLE.y);
  }

  kanneHeim() {
    killTweensOf(this.kanne, ['x', 'y']);
    const k = this.kanne;
    // Weg-abhängig, damit die Kanne von weit oben nicht zurückschießt
    this.tween(k, { x: KANNE_RUHE.x, y: KANNE_RUHE.y }, gleitDauer(KANNE_RUHE.x - k.x, KANNE_RUHE.y - k.y, 0.55),
      { ease: 'sineInOut' });
  }

  // Brausekopf der Kanne in Seiten-Koordinaten (ohne neue Objekte)
  tülle() {
    this.kanne.toGlobal(this._tülle, this._g);
    return this.welt.toLocal(this._g, undefined, this._l);
  }

  baueTropfen() {
    const t = fx.texture('tropfen');
    const s = 30 / Math.max(1, t.width);
    this.tropfen = [];
    for (let i = 0; i < TROPFEN; i++) {
      const d = new PIXI.Sprite(t);
      d.anchor.set(0.5);
      d.scale.set(s);
      d.visible = false;
      d.eventMode = 'none';
      d.zIndex = 950;
      d.vx = 0;
      d.vy = 0;
      d.boden = 0;
      this.vorn.addChild(d);
      this.tropfen.push(d);
    }
    this.tropfenTakt = 0;
  }

  giessen(dt) {
    const k = this.kanne;
    const zieht = this.kannenZug.isDragging();
    let über = false;
    let ziel = null;
    let t = null;
    if (zieht) {
      t = this.tülle();
      über = t.y < 1150 && t.x > -1250 && t.x < 1050;
      for (const p of this.plätze) {
        if (p.stufe < 1 || p.belegt) continue;
        if (Math.abs(t.x + 50 - p.x) < 175 && t.y < p.y - 40 && t.y > p.y - 900) ziel = p;
      }
    }
    // Kippen (weich)
    const soll = über ? 0.62 : 0;
    k.rotation += (soll - k.rotation) * (1 - Math.exp(-dt * 5));
    const kippt = über && k.rotation > 0.35;
    this.giessTon -= dt;
    if (kippt) {
      if (this.giessTon <= 0) {
        sfx('common/giessen', { vol: 0.5 });
        this.giessTon = 2.6;
      }
      // neue Tropfen
      this.tropfenTakt -= dt;
      while (this.tropfenTakt <= 0) {
        this.tropfenTakt += 1 / 16;
        const d = this.tropfen.find((q) => !q.visible);
        if (!d) break;
        d.visible = true;
        d.alpha = 0.9;
        d.position.set(t.x + rand(-10, 10), t.y + rand(-4, 8));
        d.vx = rand(30, 80);
        d.vy = rand(20, 90);
        d.boden = ziel ? ziel.y - 30 + rand(-10, 15) : Math.min(1180, t.y + 420);
      }
      if (ziel && ziel.stufe < 3) {
        ziel.wasser += dt;
        if (ziel.wasser >= GIESS_ZEIT) this.wachsen(ziel);
      }
    } else {
      this.tropfenTakt = 0;
    }
    // Tropfen fallen
    for (const d of this.tropfen) {
      if (!d.visible) continue;
      d.vy += 1100 * dt;
      d.x += d.vx * dt;
      d.y += d.vy * dt;
      if (d.y >= d.boden) {
        d.alpha -= dt * 8;
        if (d.alpha <= 0) d.visible = false;
      }
    }
  }

  // ---------------------------------------------------------------- Gast

  gastPunkt() {
    const hp = this.punkt('hase', { x: 1135, y: 1190 });
    // Der Punkt liegt sehr weit rechts (am Rand des Kernbereichs, unter dem Blätter-Pfeil): nach links auf die
    // Ecke des Beets, damit Gast und Herzen nicht unter dem Pfeil liegen
    return { x: Math.min(hp.x, GAST_X), y: hp.y + 20 };
  }

  // Ein neuer Gast kommt (sofort: sitzt schon da – nur beim allerersten Mal)
  async neuerGast({ sofort = false } = {}) {
    // nie einer der letzten drei Gäste (bei sieben Tieren bleibt immer genug Abwechslung)
    this.gastVerlauf = this.gastVerlauf || [];
    let tier;
    if (sofort) { tier = 'hase'; this.gastVerlauf.push(tier); } else tier = wähleNeu(GÄSTE.map((x) => x.tier), this.gastVerlauf, 3);
    const cfg = GÄSTE.find((g) => g.tier === tier);
    this.gastCfg = cfg;
    this.gastDa = false;
    const ort = this.gastPunkt();
    const a = new Actor(cfg.tier, {
      x: sofort ? ort.x : GAST_WEG, y: ort.y, scale: cfg.scale, flip: sofort, parent: this.welt, z: 300,
    });
    this.gast = a;
    a.onTap(() => {
      if (!this.gastDa) { a.sound(); return; }
      fx.wobble(a, 0.05);
      a.sound();
      if (!this.geschenk) this.zeigeWunsch();
      else if (this.geschenk.sauber) this.gibGast(this.geschenk);
    });
    this.wachseUnkraut({ sofort });
    if (!sofort) {
      sfx('common/hupf', { vol: 0.4 });
      const ok = await a.walkTo(ort.x, ort.y, { tempo: 240 });
      if (!ok || a.destroyed || a !== this.gast) return;
      a.lookAt(ort.x - 100);
      await this.wait(0.3);
    }
    this.gastDa = true;
    if (!sofort && this.aktiv) {
      this.zeigeWunsch();
      this.after(1.0, () => this.zeigeNächstes());
    }
  }

  // Kleiner Hinweis auf den nächsten Schritt der Kette: erst wackelt das Unkraut, sonst hüpft die Samentüte
  zeigeNächstes() {
    if (!this.aktiv) return;
    const u = this.plätze.find((p) => p.unkraut && !p.unkraut.raus)?.unkraut;
    if (u) fx.wobble(u.sp, 0.07);
    else this.zeigeTüte();
  }

  zeigeWunsch() {
    const g = this.gast;
    if (!g || g.destroyed || !this.gastCfg) return;
    g.bubble(PFLANZEN[this.gastCfg.wunsch].ernte, 2.6, { seite: 'links' });
  }

  gastMaul() {
    const g = this.gast;
    return g?.point('mouth') || { x: (g?.x ?? GAST_X) - 60, y: (g?.y ?? 1210) - 150 };
  }

  // ---------------------------------------------------------------- Ernten, Waschen, Geben, Korb

  baueKorb() {
    // Korb rechts neben der Leiste (unten rechts bleibt frei)
    this.korb = bauKorb(this, 'common/icon_korb', {
      x: 850, y: 1390, scale: 0.6, z: 320,
      rand: [[0, 196], [60, 214], [178, 232], [296, 214], [356, 196]],
    });
  }

  async ernten(platz) {
    const cfg = PFLANZEN[platz.sorte];
    const sorte = platz.sorte;
    platz.belegt = true;
    sfx('common/rupf', { vol: 0.9 });
    const alt = platz.sprite;
    const h = platz.höhe;
    platz.sprite = null;
    killTweensOf(alt);
    this.tween(alt, { scaleY: alt.scale.y * 1.1 }, 0.12, { ease: 'quadOut' })
      .then(() => !alt.destroyed && this.tween(alt, { alpha: 0, scaleX: alt.scale.x * 0.6, scaleY: alt.scale.y * 0.6 }, 0.35, { ease: 'sineInOut' }))
      .then(() => { if (!alt.destroyed) alt.destroy(); });
    this.burst('staub', platz.x, platz.y - 20, { count: 4 });
    // Hügel ist gleich wieder frei
    this.after(0.55, () => {
      platz.stufe = 0;
      platz.sorte = null;
      platz.höhe = 0;
      platz.belegt = false;
      this.setzeFläche(platz);
    });

    // Das Gewünschte wird das Geschenk für den Gast (es muss erst gewaschen werden)
    if (sorte === this.gastCfg?.wunsch && this.gastDa && !this.geschenk) {
      this.neuesGeschenk(cfg.ernte, platz, h);
      return;
    }

    // Die Ernte hüpft heraus …
    const e = spr(cfg.ernte, { anchor: 0.5, parent: this.welt, x: platz.x, y: platz.y - Math.min(h, 300) * 0.45, z: 800 });
    const s = skalaFür(cfg.ernte, 170, 170);
    e.scale.set(s * 0.5);
    e.eventMode = 'none';
    this.tween(e, { scale: s }, 0.35, { ease: 'backOut' });
    await bogen(this, e, e.x, e.y - 120, { dauer: 0.35, höhe: 0 });
    // … in den Korb
    this.inDenKorb(e, s);
  }

  // Das gewünschte Gemüse: hüpft auf den Waschplatz, ist voller Erde und will sauber gerieben werden
  async neuesGeschenk(bild, platz, h) {
    const c = new PIXI.Container({ label: 'geschenk' });
    c.sortableChildren = true;
    c.zIndex = 820;
    c.position.set(platz.x, platz.y - Math.min(h, 300) * 0.45 + GESCHENK_HÖHE / 2);
    const s = skalaFür(bild, GESCHENK_HÖHE, GESCHENK_HÖHE);
    const veg = spr(bild, { anchor: 0.5, parent: c, y: -GESCHENK_HÖHE / 2 });
    veg.scale.set(s);
    c.eventMode = 'passive';
    this.welt.addChild(c);
    const g = { c, veg, s, sauber: false, flecken: [], weg: false, zug: null };
    this.geschenk = g;
    c.scale.set(0.5);
    this.tween(c, { scale: 1 }, 0.35, { ease: 'backOut' });
    await bogen(this, c, c.x, c.y - 120, { dauer: 0.35, höhe: 0 });
    if (c.destroyed) return;
    await bogen(this, c, GESCHENK.x, GESCHENK.y, { dauer: 0.6, höhe: 160 });
    if (c.destroyed) return;
    sfx('common/landen', { vol: 0.6 });
    this.burst('staub', GESCHENK.x, GESCHENK.y - 10, { count: 2 });
    this.machDreckig(g);
    const dreckig = () => this.aktiv && this.geschenk === g && !g.sauber;
    this.after(0.6, () => { if (dreckig()) voice('garten_waschen', { nurWenn: dreckig }); });
  }

  // Drei Erdflecken auf das Gemüse – jeder wird weggewischt
  machDreckig(g) {
    const k = GESCHENK_HÖHE / 175;
    const stellen = [[-38, -120], [34, -82], [-12, -42]];
    const t = 'common/p_staub';
    g.reibZeit = 0;
    this.reibenAn(g);
    for (const [x, y] of stellen) {
      const f = spr(t, { anchor: 0.5, parent: g.c, x: (x + rand(-8, 8)) * k, y: (y + rand(-8, 8)) * k, z: 2 });
      const fs = (92 * k) / Math.max(f.texture.width, 1);
      f.scale.set(fs * rand(0.9, 1.1), fs * rand(0.8, 1));
      f.rotation = rand(-0.6, 0.6);
      f.tint = 0x7a4a26;
      f.alpha = 0.92;
      f.sauber = false;
      const w = f.texture.width;
      const hh = f.texture.height;
      // Tippfläche großzügig (mindestens 260 Einheiten), so trifft ein Kinderfinger immer
      const ax = 130 / fs;
      f.wisch = wipe(f, {
        radius: WISCH_RADIUS,
        doneAt: WISCH_FERTIG,
        sound: 'common/schrubben',
        hitArea: new PIXI.Rectangle(-Math.max(w / 2, ax), -Math.max(hh / 2, ax), 2 * Math.max(w / 2, ax), 2 * Math.max(hh / 2, ax)),
        onProgress: () => this.gerieben(g),
        onDone: () => this.fleckSauber(g, f),
      });
      g.flecken.push(f);
    }
  }

  // Ein Fleck ist sauber (weggewischt oder nach genug Reiben von selbst): Blasen, nach dem letzten ist es fertig
  fleckSauber(g, f, { vonSelbst = false } = {}) {
    if (f.sauber || f.destroyed) return;
    f.sauber = true;
    this.burst('blasen', g.c.x + f.x, g.c.y + f.y, { count: 2 });
    if (vonSelbst) {
      // weich ausblenden (der Wisch-Baustein tut das nur bei echtem Wegwischen), danach abbauen
      this.tween(f, { alpha: 0 }, 0.6, { ease: 'sineInOut' }).then(() => {
        if (f.destroyed) return;
        f.wisch.off();
        f.destroy();
      });
    } else {
      this.after(0.8, () => { f.wisch.off(); if (!f.destroyed) f.destroy(); });
    }
    if (g.flecken.every((x) => x.sauber)) this.after(0.4, () => this.istSauber(g));
  }

  // Reibe-Zeit: Solange das Gemüse dreckig ist, zählt jede Fingerbewegung über ihm (auch dort, wo schon sauber ist).
  // Wer lange genug reibt, bekommt es sauber, auch wenn ein Fleck nur gestreift wurde. Der Kern meldet Bewegungen
  // nur beim Ziehen/Wischen, darum ein eigener Hörer am Fenster – er lebt nur, solange gewaschen wird
  // (abgebaut in istSauber() und verlassen()).
  reibenAn(g) {
    if (this._reibHörer || g.sauber) return;
    const p = new PIXI.Point();
    let letzte = 0;
    this._reibHörer = (ev) => {
      if (this.geschenk !== g || g.sauber || g.c.destroyed || !this.aktiv) return;
      if (ev.pointerType === 'mouse' && !(ev.buttons & 1)) return;
      stage.app.renderer.events.mapPositionToPoint(p, ev.clientX, ev.clientY);
      const l = g.c.toLocal(p);
      if (Math.abs(l.x) > 150 || l.y < -GESCHENK_HÖHE - 70 || l.y > 60) return;
      const jetzt = performance.now() / 1000;
      g.reibZeit += clamp(jetzt - letzte, 0, 0.1);
      letzte = jetzt;
      if (g.reibZeit >= REIBE_ZEIT) {
        for (const f of g.flecken) this.fleckSauber(g, f, { vonSelbst: true });
      }
    };
    window.addEventListener('pointermove', this._reibHörer, { passive: true });
  }

  reibenAus() {
    if (this._reibHörer) window.removeEventListener('pointermove', this._reibHörer);
    this._reibHörer = null;
  }

  // Beim Reiben ab und zu ein paar Seifenblasen (ruhig, entprellt)
  gerieben(g) {
    if (g.c.destroyed || g.sauber) return;
    if (this.zeit - this.wischTakt < 0.45) return;
    this.wischTakt = this.zeit;
    this.burst('blasen', g.c.x + rand(-50, 50), g.c.y - rand(40, GESCHENK_HÖHE * 0.8), { count: 1 });
  }

  istSauber(g) {
    if (g.sauber || g.c.destroyed) return;
    g.sauber = true;
    this.reibenAus();
    sfx('common/funkeln', { vol: 0.5 });
    this.burst('funkeln', g.c.x, g.c.y - GESCHENK_HÖHE / 2, { count: 5 });
    fx.pop(g.veg, 0.12);
    // Jetzt kann es zum Gast gezogen werden
    this.greifbar(g);
    this.after(0.8, () => {
      if (this.aktiv && !g.weg && this.gastDa) this.zeigeWunsch();
    });
  }

  greifbar(g) {
    if (g.zug || g.weg || g.c.destroyed) return;
    g.c.hitArea = new PIXI.Rectangle(-130, -GESCHENK_HÖHE - 50, 260, GESCHENK_HÖHE + 90);
    g.c.eventMode = 'static';
    g.zug = drag(g.c, {
      back: false,
      lift: 1.1,
      targets: () => (this.gastDa && this.gast ? [{ ...this.gastMaul(), id: 'gast', radius: 320 }] : []),
      onDrop: (ziel, ctx) => {
        const kurz = Math.hypot(ctx.x - ctx.startX, ctx.y - ctx.startY) < 70;
        if (this.gastDa && this.gast && !this.gast._isst && (ziel || kurz)) {
          // erst die Größen-Rückmeldung des Loslassens ausklingen lassen, dann fliegt es zum Gast
          g.zug?.off();
          g.zug = null;
          g.c.eventMode = 'none';
          this.after(0.22, () => this.gibGast(g));
          return;
        }
        this.tween(g.c, { x: GESCHENK.x, y: GESCHENK.y },
          gleitDauer(GESCHENK.x - g.c.x, GESCHENK.y - g.c.y, 0.45, 3), { ease: 'cubicOut' });
      },
    });
  }

  async gibGast(g) {
    if (g.weg || !g.sauber || g.c.destroyed) return;
    const gast = this.gast;
    if (!this.gastDa || !gast || gast._isst) {
      // (noch) niemand zum Geben da: es bleibt auf dem Waschplatz und ist wieder greifbar
      this.greifbar(g);
      return;
    }
    killTweensOf(g.c, ['scale', 'scaleX', 'scaleY']);
    g.c.scale.set(1);
    g.weg = true;
    g.zug?.off();
    g.zug = null;
    gast._isst = true;
    killTweensOf(g.c);
    const ok = await lassEssen(this, gast, g.c, { bissen: 3 });
    if (!gast.destroyed) gast._isst = false;
    if (this.geschenk === g) this.geschenk = null;
    if (!ok || gast !== this.gast) return;
    await this.rundeGeschafft(gast);
  }

  // Der Gast hat bekommen, was er wollte: Sticker, Dankeschön-Blume, er geht, der nächste kommt
  async rundeGeschafft(gast) {
    this.gastDa = false;
    await belohne(this, 'garten_sonnenblume', gast.x - 40, gast.y - 560);
    await this.wait(0.4);
    this.dankeBlume();
    await this.wait(1.4);
    if (gast.destroyed) return;
    gast.bubble?.('common/p_herz', 1.4, { seite: 'links' });
    await this.wait(1.6);
    await gast.walkTo(GAST_WEG, gast.y, { tempo: 240 });
    if (!gast.destroyed) gast.destroy({ children: true });
    if (this.gast === gast) this.gast = null;
    await this.wait(0.8);
    this.neuerGast();
  }

  // ---------------------------------------------------------------- Dankeschön-Blumen am Zaun

  baueDankeBlumen() {
    this.dankeBlumen = [];
    const n = clamp(Number(store.get(DANKE_KEY, 0)) || 0, 0, DANKE_X.length);
    for (let i = 0; i < n; i++) this.setzeDankeBlume(i, false);
  }

  setzeDankeBlume(i, weich) {
    const farbe = DANKE_FARBEN[i % DANKE_FARBEN.length];
    const id = `garten/blume_${farbe}_auf`;
    const c = new PIXI.Container({ label: 'dankeblume' + i });
    c.position.set(DANKE_X[i], DANKE_Y + rand(-6, 6));
    c.zIndex = 40;
    const s = 150 / 420;
    const b = spr(id, { parent: c });
    b.scale.set(s);
    const schatten = new PIXI.Graphics().ellipse(0, 0, 26, 7).fill({ color: 0x2d4a14, alpha: 0.18 });
    c.addChildAt(schatten, 0);
    this.welt.addChild(c);
    c.hitArea = new PIXI.Rectangle(-105, -180, 210, 210);
    tap(c, () => {
      fx.wobble(c, 0.08);
      note('xylo', DANKE_TÖNE[i % DANKE_TÖNE.length], { vol: 0.5 });
    }, { sound: null, squash: false });
    this.dankeBlumen.push(c);
    if (weich) {
      c.scale.set(0.05);
      this.tween(c, { scale: 1 }, 0.9, { ease: 'backOut' });
    }
    return c;
  }

  dankeBlume() {
    const n = this.dankeBlumen.length;
    if (n < DANKE_X.length) {
      const c = this.setzeDankeBlume(n, true);
      store.set(DANKE_KEY, n + 1);
      sfx('common/wachsen', { vol: 0.6 });
      note('glocke', DANKE_TÖNE[n % DANKE_TÖNE.length], { vol: 0.3 });
      this.after(0.5, () => this.burst('funkeln', c.x, c.y - 120, { count: 4 }));
    } else {
      // Die Reihe ist voll: alle Blumen nicken nacheinander
      this.dankeBlumen.forEach((c, i) => this.after(i * 0.25, () => {
        fx.wobble(c, 0.06);
        note('glocke', DANKE_TÖNE[i % DANKE_TÖNE.length], { vol: 0.2 });
      }));
    }
  }

  async inDenKorb(e, s) {
    const korb = this.korb;
    const n = korb.liste.length;
    const plätze = [[130, 190], [222, 192], [176, 176], [150, 160], [205, 160], [178, 150]];
    const [px, py] = plätze[n % plätze.length];
    korb.liste.push(e);
    const ziel = korb.lokal(px, py);
    // erst über den Korb fliegen …
    const über = korb.öffnung(px, py - 140);
    await bogen(this, e, über.x, über.y, { dauer: 0.6, höhe: 200, skala: s * 0.62 });
    if (e.destroyed) return;
    // … dann hinein (zwischen die beiden Korb-Ebenen)
    umhängen(e, korb.inhalt);
    await this.tween(e, { y: ziel.y }, 0.22, { ease: 'quadIn' });
    e.x = ziel.x;
    e.ruheY = ziel.y;
    sfx('common/plopp', { vol: 0.7 });
    fx.pop(korb.c, 0.06);
    this.korbZahl++;
    if (this.korbZahl >= KORB_RUNDE) {
      this.korbZahl = 0;
      this.korbRunde();
    }
  }

  async korbRunde() {
    const korb = this.korb;
    const inhalt = korb.liste.splice(0);
    await this.wait(0.4);
    const o = korb.öffnung();
    await belohne(this, 'garten_sonnenblume', o.x, o.y - 160);
    await this.wait(1.2);
    // Korb leert sich weich (die Ernte ist „in der Küche")
    inhalt.forEach((e, i) => {
      if (e.destroyed) return;
      this.tween(e, { alpha: 0 }, 0.6, { ease: 'sineInOut', delay: i * 0.15 })
        .then(() => { if (!e.destroyed) e.destroy(); });
    });
  }

  // ---------------------------------------------------------------- kleine Gäste

  baueGäste() {
    // Biene besucht die Pflanzen
    this.biene = new Flieger(this, 'garten/biene', {
      x: -300, y: 650, maß: 120, art: 'biene', tempo: 85, z: 650,
      wähleZiel: () => {
        const gross = this.plätze.filter((p) => p.stufe >= 2 && !p.belegt);
        if (gross.length && Math.random() < 0.6) {
          const p = pick(gross);
          return { x: p.x + rand(-30, 30), y: p.y - p.höhe * 0.8, sitzen: true, dauer: rand(2.5, 4.5), ding: p };
        }
        return { x: rand(-950, 820), y: rand(480, 820), sitzen: false };
      },
    });

    // Marienkäfer krabbelt auf dem vorderen Holzrand (links)
    this.käfer = this.krabbler('garten/marienkaefer', {
      x: -760, y: 1212, maß: 95, bereich: [-1120, -420], tempo: 20, anker: [0.5, 0.75],
      onTap: (k) => {
        note('glocke', pick([88, 91]), { vol: 0.3 });
        this.hüpfer(k.sprite, 40);
        k.richtung *= -1;
      },
    });
    // Schnecke kriecht auf dem Holzrand (rechts, bis vor den Waschplatz)
    this.schnecke = this.krabbler('garten/schnecke', {
      x: 250, y: 1216, maß: 150, bereich: [60, 420], tempo: 9, anker: [0.423, 0.979],
      onTap: (k) => {
        note('xylo', pick([60, 64, 67]), { vol: 0.4 });
        killTweensOf(k.sprite, ['scaleX', 'scaleY']);
        const sx = k.sprite.scale.x;
        const sy = k.sprite.scale.y;
        this.tween(k.sprite, { scaleX: sx * 0.86, scaleY: sy * 0.9 }, 0.25, { ease: 'sineInOut' })
          .then(() => this.tween(k.sprite, { scaleX: sx, scaleY: sy }, 0.6, { ease: 'backOut', delay: 0.6 }));
        k.pause = 2;
      },
    });

    // Regenwurm schaut ab und zu zwischen zwei Hügeln heraus
    this.baueWurm();

    // Vogel auf dem Zaun
    this.vogel = new Vogel(this, { x: -260, y: 788, bereich: [-640, 200], scale: 0.8, z: 50 });
  }

  // Krabbelt langsam hin und her, macht Pausen, dreht um. → {c, sprite, richtung, pause}
  krabbler(id, { x, y, maß, bereich, tempo, anker, onTap }) {
    const c = new PIXI.Container({ label: 'krabbler:' + id });
    c.position.set(x, y);
    c.zIndex = 330;
    const sprite = spr(id, { anchor: anker, parent: c });
    const s = maß / Math.max(sprite.texture.width, sprite.texture.height);
    sprite.scale.set(s);
    this.welt.addChild(c);
    const k = { c, sprite, s, bereich, tempo, richtung: 1, pause: rand(1, 3), phase: rand(0, 6) };
    c.hitArea = new PIXI.Circle(0, -maß * 0.3, 125);
    tap(c, () => onTap(k), { sound: null, squash: false });
    this.krabbler_ = this.krabbler_ || [];
    this.krabbler_.push(k);
    return k;
  }

  krabbelt(dt) {
    for (const k of this.krabbler_) {
      k.phase += dt;
      if (k.pause > 0) {
        k.pause -= dt;
      } else {
        k.c.x += k.richtung * k.tempo * dt;
        if (k.c.x > k.bereich[1]) { k.c.x = k.bereich[1]; k.richtung = -1; k.pause = rand(1.5, 3); }
        if (k.c.x < k.bereich[0]) { k.c.x = k.bereich[0]; k.richtung = 1; k.pause = rand(1.5, 3); }
        if (Math.random() < dt * 0.08) k.pause = rand(1.5, 4);
      }
      // Blickrichtung (Bilder schauen nach rechts) und leichtes Wiegen beim Krabbeln
      k.c.scale.x = k.richtung;
      k.c.rotation = k.pause > 0 ? 0 : Math.sin(k.phase * 5) * 0.03;
    }
  }

  hüpfer(obj, höhe) {
    if (obj._hüpft) return;
    obj._hüpft = true;
    const y0 = obj.y;
    this.tween(obj, { y: y0 - höhe }, 0.18, { ease: 'quadOut' })
      .then(() => this.tween(obj, { y: y0 }, 0.3, { ease: 'bounceOut' }))
      .then(() => { obj._hüpft = false; });
  }

  baueWurm() {
    this.wurmHeim = { x: (this.plätze[1].x + this.plätze[2].x) / 2, y: 1178 };
    const c = new PIXI.Container({ label: 'regenwurm' });
    c.position.set(this.wurmHeim.x, this.wurmHeim.y);
    c.zIndex = 90;
    const w = spr('garten/regenwurm', { anchor: [0.55, 0.92], parent: c });
    const s = 120 / w.texture.width;
    w.scale.set(s, s * 0.05);
    w.alpha = 0;
    this.welt.addChild(c);
    // kleines Erdloch, aus dem er schaut
    const loch = new PIXI.Graphics().ellipse(0, 0, 34, 10).fill({ color: 0x4a2a14, alpha: 0.55 });
    loch.zIndex = -1;
    loch.alpha = 0;
    c.addChild(loch);
    c.sortableChildren = true;
    this.wurm = { c, w, s, loch, oben: false, zeit: rand(4, 8), wackel: 0 };
    c.hitArea = new PIXI.Rectangle(-120, -170, 240, 230);
    tap(c, () => {
      const wm = this.wurm;
      if (!wm.oben) this.wurmRauf();
      else {
        note('pling', 91, { vol: 0.3 });
        this.after(0.14, () => note('pling', 95, { vol: 0.25 }));
        wm.wackel = 1;
        wm.zeit = Math.max(wm.zeit, 3);
      }
    }, { sound: null, squash: false });
  }

  wurmRauf() {
    const wm = this.wurm;
    wm.oben = true;
    wm.zeit = rand(4, 6);
    killTweensOf(wm.w);
    killTweensOf(wm.loch);
    sfx('common/graben', { vol: 0.3 });
    this.tween(wm.loch, { alpha: 1 }, 0.3, { ease: 'sineInOut' });
    this.tween(wm.w, { alpha: 1 }, 0.3, { ease: 'sineInOut' });
    this.tween(wm.w, { scaleY: wm.s }, 0.9, { ease: 'backOut' });
  }

  wurmRunter() {
    const wm = this.wurm;
    wm.oben = false;
    wm.zeit = rand(10, 16);
    killTweensOf(wm.w);
    killTweensOf(wm.loch);
    this.tween(wm.w, { scaleY: wm.s * 0.05 }, 0.9, { ease: 'sineInOut' });
    this.tween(wm.w, { alpha: 0 }, 0.4, { ease: 'sineInOut', delay: 0.6 });
    // Loch schließt sich, danach wohnt er wieder zwischen den beiden Hügeln
    this.tween(wm.loch, { alpha: 0 }, 0.5, { ease: 'sineInOut', delay: 0.8 }).then(() => {
      if (wm.oben) return;
      wm.c.position.set(this.wurmHeim.x, this.wurmHeim.y);
    });
  }

  // ---------------------------------------------------------------- Ablauf

  update(dt, t) {
    this.zeit = t;
    this.giessen(dt);
    // Die Pflanze unter der Biene wird geerntet (oder ist weg): die Biene fliegt weiter
    const bp = this.biene.ding;
    if (bp && !this.biene.fliegt && (bp.belegt || bp.stufe < 2)) this.biene.aufflattern();
    this.biene.update(dt);
    this.vogel.update(dt);
    this.krabbelt(dt);
    // Wurm
    const wm = this.wurm;
    wm.zeit -= dt;
    if (wm.zeit <= 0) {
      if (wm.oben) this.wurmRunter();
      else this.wurmRauf();
    }
    wm.wackel = Math.max(0, wm.wackel - dt * 0.8);
    wm.w.rotation = wm.oben ? Math.sin(t * 2.2) * (0.06 + 0.12 * wm.wackel) : 0;
    // Pflanzen und Unkraut wiegen sich leicht
    for (const p of this.plätze) {
      if (p.sprite) p.sprite.skew.x = 0.025 * Math.sin(t * 1.1 + p.phase);
      if (p.unkraut && !p.unkraut.raus) p.unkraut.sp.skew.x = 0.04 * Math.sin(t * 1.3 + p.phase);
    }
  }

  verlassen() {
    this._hinweis?.kill();
    this._hinweis = null;
    this.reibenAus();
    // Kanne nicht schief stehen lassen, Tropfen weg
    if (this.kanne) this.kanne.rotation = 0;
    for (const d of this.tropfen || []) d.visible = false;
  }

  // Die Zeige-Hand folgt der Kette des Gasts: Solange ein Schritt der Kette offen ist, zeigt sie nur ihn (die Hand
  // wechselt sonst reihum zwischen allen Zielen und führte mitten aus der Kette heraus).
  hinweise() {
    const g = this.geschenk;
    if (g && !g.weg && !g.c.destroyed) {
      // Geschenk: erst sauber reiben (die Hand zeigt auf den ersten Fleck, der noch da ist), dann zum Gast
      if (!g.sauber) return [g.flecken.find((f) => !f.destroyed && !f.sauber) || g.veg];
      if (this.gastDa) return [{ von: g.c, nach: this.gastMaul() }];
    }
    const unkraut = this.plätze.find((p) => p.unkraut && !p.unkraut.raus && p.unkraut.zug);
    const zupfen = unkraut && { von: unkraut.unkraut.sp, nach: { x: unkraut.x, y: unkraut.y - 330 } };
    const w = this.gastDa && !g ? this.gastCfg?.wunsch : null;
    if (w) {
      const reifW = this.plätze.find((p) => p.sorte === w && p.stufe === 3 && !p.belegt);
      if (reifW) return [reifW.sprite];
      const durstW = this.plätze.find((p) => p.sorte === w && p.stufe >= 1 && p.stufe < 3 && !p.belegt);
      if (durstW) return [{ von: this.kanne, nach: { x: durstW.x + 60, y: durstW.y - durstW.höhe - 140 } }];
      // Erst das Unkraut, dann säen
      if (zupfen) return [zupfen];
      const frei = this.freierPlatz();
      const tüte = this.leiste.sprite(w);
      if (!this.plätze.some((p) => p.sorte === w) && frei && tüte) {
        return [{ von: tüte, nach: { x: frei.x, y: frei.y - 60 } }];
      }
    }
    // Außerhalb der Kette (kein Gast da, oder der Wunsch wird gerade gesät): alles, was gerade geht
    const liste = [];
    if (zupfen) liste.push(zupfen);
    const reif = this.plätze.find((p) => p.stufe === 3 && !p.belegt);
    if (reif) liste.push(reif.sprite);
    const durst = this.plätze.find((p) => p.stufe >= 1 && p.stufe < 3 && !p.belegt);
    if (durst) liste.push({ von: this.kanne, nach: { x: durst.x + 60, y: durst.y - durst.höhe - 140 } });
    const frei = this.freierPlatz();
    const tüte = this.leiste.sprite(this.hinweisTüte());
    if (frei && tüte && !this.sät) liste.push({ von: tüte, nach: { x: frei.x, y: frei.y - 60 } });
    if (!liste.length && this.gast && !this.gast.destroyed) liste.push(this.gast);
    if (!liste.length) liste.push(this.korb.c);
    return liste;
  }
}
