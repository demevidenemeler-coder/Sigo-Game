// Ruhe-Bild der Schlafenszeit: Nachthimmel, schlafender Mond (atmet langsam), ein paar weich funkelnde Sterne,
// das Haus mit warmem Fenster und Sigos Lok, die mit geschlossenen Augen unter einer bunten Decke schläft (das
// Gesicht schaut vorn heraus, ab und zu steigt ein zzz auf). Das Wiegenlied spielt noch etwa eine Minute und
// verklingt dann.
// Im normalen Spiel erscheint nach ~6 s ein Sonnen-Knopf (zurück zur Karte). Ist die Spielzeit für heute
// aufgebraucht, gibt es keinen – das Bild bleibt, bis die Eltern das Zahnrad unten rechts halten.

import { stage, spr, sfx, music, voice, note, tap, fx, ui, rand, pick, clamp, PIXI } from '../../engine/index.js';
import { setzeHintergrund, hgPunkt } from '../../gemeinsam/seiten.js';
import { spielzeit } from '../../gemeinsam/spielzeit.js';
import { elternOffen } from '../../gemeinsam/eltern.js';

/**
 * Weiches Aufleuchten nach einem Tipp (Ruhe-Regel: Helligkeit ändert sich nie sprunghaft).
 * Der Tipp setzt o.ziel = 1; o.extra steigt in ≥ 0,6 s dorthin und klingt danach langsam wieder ab.
 */
export function glimmen(o, dt, abklingen = 0.5) {
  if (o.ziel > o.extra) {
    o.extra = Math.min(o.ziel, o.extra + dt / 0.6);
    if (o.extra >= o.ziel) o.ziel = 0;
  } else {
    o.ziel = 0;
    o.extra = Math.max(0, o.extra - dt * abklingen);
  }
}

const HG = 'schlafen/hg_ruhe';
const MOND_S = 0.8;
// Sigos Lok (zug/lok_dampf) unter der Patchwork-Decke – alle Maße in Bildpunkten der Lok
const LOK_S = 0.5;
const LOK_ANKER = { x: 0.5 * 948, y: 0.982 * 614 };
const DECKE_SX = 0.76;          // Decke so breit, dass sie Führerhaus und Kessel deckt, das Gesicht aber frei lässt
const DECKE_SY = 0.86;
const DECKE_LINKS = -14;        // linke Kante der Decke (Bildpunkte der Lok)
const SONNE_NACH = 6;          // s bis zum Sonnen-Knopf
const MUSIK_NOCH = 55;         // s, dann verklingt das Wiegenlied …
const MUSIK_AUSKLANG = 12;     // … über so viele Sekunden
const PENTATONIK = [72, 74, 76, 79, 81, 84];

// ein paar Sterne, die ganz langsam heller und dunkler werden (Bildpunkte des Hintergrunds, Größe)
const STERNE = [
  [560, 560, 0.3], [930, 250, 0.22], [1060, 700, 0.26], [1900, 300, 0.24], [2050, 640, 0.3],
  [2260, 980, 0.22], [760, 900, 0.2], [1650, 820, 0.22],
];

export class Ruhe {
  constructor(szene) {
    this.s = szene;
    this.an = false;
    this.zeit = 0;
    this.sonne = null;
    this.sonneSagen = false;   // Sonnen-Satz wartet, bis der Eltern-Bereich zu ist
    this.musikVol = 1;
    this.letzterHimmel = -9;

    this.hinten = new PIXI.Container({ label: 'ruheHinten' });
    this.hinten.zIndex = 10;
    this.hinten.visible = false;
    this.hinten.alpha = 0;
    szene.bg.addChild(this.hinten);
    this.welt = new PIXI.Container({ label: 'ruheWelt', sortableChildren: true });
    this.welt.zIndex = 20;
    this.welt.visible = false;
    this.welt.alpha = 0;
    szene.world.addChild(this.welt);

    this.hg = setzeHintergrund(this.hinten, HG);
    this.hg.label = HG;
    const pt = (name, ersatz) => hgPunkt(this.hg, HG, name) || ersatz;
    const bp = (px, py) => ({ x: this.hg.x + (px - 2829 / 2) * this.hg.scale.x, y: this.hg.y + (py - 800) * this.hg.scale.y });

    // Himmel antippen: ein leises Funkeln dort
    const himmel = new PIXI.Container({ label: 'himmel' });
    himmel.zIndex = -1;
    himmel.hitArea = new PIXI.Rectangle(-1500, 0, 3000, 1600);
    this.welt.addChild(himmel);
    tap(himmel, (e) => this.himmelTipp(e), { sound: null, squash: false });

    // weich funkelnde Sterne
    this.sterne = STERNE.map(([px, py, sk], i) => {
      const q = bp(px, py);
      const st = spr('common/stern_himmel', { x: q.x, y: q.y, scale: sk, parent: this.welt, z: 1 });
      st.phase = i * 1.3;
      st.periode = rand(4, 7);
      st.extra = 0;
      st.ziel = 0;
      return st;
    });
    // ab und zu eine langsame Sternschnuppe
    this.schnuppe = spr('common/stern_himmel', { x: 0, y: 0, scale: 0.18, parent: this.welt, z: 1, alpha: 0 });
    this.schnuppeIn = rand(10, 16);

    // Haus mit warmem Fenster
    const hf = pt('haus_fenster', { x: 425, y: 1240 });
    this.hausSchein = spr('schlafen/lichtschein_warm', { x: hf.x, y: hf.y, scale: 0.34, parent: this.welt, z: 2, alpha: 0.55 });
    this.hausSchein.eventMode = 'none';
    const haus = new PIXI.Container({ label: 'haus' });
    haus.zIndex = 3;
    // das ganze Häuschen samt Dach (das Fenster sitzt links im Haus)
    haus.hitArea = new PIXI.Rectangle(hf.x - 250, hf.y - 340, 620, 470);
    this.welt.addChild(haus);
    this.hausGlimm = { extra: 0, ziel: 0 };
    tap(haus, () => {
      this.hausGlimm.ziel = 1;
      note('glocke', pick(PENTATONIK), { vol: 0.22 });
    }, { sound: null, squash: false });

    // Sigos Lok schläft unter der bunten Decke vorn auf der Wiese
    const zp = bp(720, 1478);
    this.zug = this.baueLok(zp.x, zp.y);
    tap(this.zug, () => {
      fx.wobble(this.zug, 0.04);
      if (this.zeit - (this.zugZeit ?? -9) > 1.6) {
        this.zugZeit = this.zeit;
        sfx('common/schnarchen', { vol: 0.35 });
      }
      fx.burst('zzz', this.zzzPunkt.x, this.zzzPunkt.y, { count: 1, parent: szene.front });
    }, { sound: null, squash: false, pad: 30 });

    // schlafender Mond
    const m = pt('mond', { x: 0, y: 380 });
    this.mond = spr('schlafen/schlafmond', { x: m.x, y: m.y, scale: MOND_S, parent: this.welt, z: 5 });
    tap(this.mond, () => {
      fx.wobble(this.mond, 0.05);
      note('glocke', pick(PENTATONIK) + 12, { vol: 0.25 });
      fx.burst('sterne', this.mond.x + rand(-120, 120), this.mond.y - 150, { count: 3, parent: szene.front });
    }, { sound: null, squash: false, pad: 20 });
  }

  /**
   * Sigos Lok mit geschlossenen Augen, die Decke über Führerhaus und Kessel. Ein Container in Bildpunkten der Lok
   * (Ursprung = Fuß-Anker der Lok), Fuß auf (x, y).
   */
  baueLok(x, y) {
    const c = new PIXI.Container({ label: 'sigoSchlaeft' });
    c.position.set(x, y);
    c.scale.set(LOK_S);
    c.zIndex = 4;
    this.welt.addChild(c);
    const L = (px, py) => [px - LOK_ANKER.x, py - LOK_ANKER.y];   // Bildpunkt der Lok → Container

    // weicher Schatten auf der Wiese
    const schatten = new PIXI.Graphics();
    for (const [rx, a] of [[520, 0.12], [470, 0.14], [410, 0.16]]) schatten.ellipse(-10, -4, rx, 44).fill({ color: 0x0a1a24, alpha: a });
    c.addChild(schatten);
    const lok = spr('zug/lok_dampf', { parent: c });
    lok.position.set(0, 0);
    lok.tint = 0xe2e2f2;           // ein Hauch Nacht, damit die Lok nicht wie am Tag leuchtet
    // Augen zu, Mund klein: die offenen Augen und den lachenden Mund weich mit Hautfarbe übermalen
    // (je drei Ringe mit abnehmender Deckkraft, damit kein harter Rand entsteht), darüber geschlossene Lider
    const g = new PIXI.Graphics();
    const flicken = (px, py, rx, ry, farbe) => {
      const [gx, gy] = L(px, py);
      g.ellipse(gx, gy, rx + 7, ry + 7).fill({ color: farbe, alpha: 0.3 });
      g.ellipse(gx, gy, rx + 3, ry + 3).fill({ color: farbe, alpha: 0.6 });
      g.ellipse(gx, gy, rx, ry).fill({ color: farbe });
    };
    flicken(777, 308, 26, 33, 0xfbd4a8);
    flicken(849, 307, 14, 31, 0xf1c99c);
    flicken(818, 373, 29, 25, 0xf0c48f);
    const strich = (a, b, c2, farbe, w) => {
      const [x0, y0] = L(...a);
      const [x1, y1] = L(...b);
      const [x2, y2] = L(...c2);
      g.moveTo(x0, y0).quadraticCurveTo(x1, y1, x2, y2).stroke({ width: w, color: farbe, cap: 'round' });
    };
    strich([755, 306], [777, 328], [799, 305], 0x5a3322, 7);     // linkes Lid
    strich([836, 305], [850, 322], [863, 302], 0x5a3322, 6);     // rechtes Lid (seitlich, schmaler)
    strich([804, 370], [818, 381], [833, 368], 0x9a4b32, 6);     // kleines Lächeln
    c.addChild(g);

    // die Decke: linke Kante am Führerhaus, rechts endet sie vor dem Gesicht; leicht in den Boden gezogen
    this.decke = spr('schlafen/zug_schlaeft_decke', { parent: c });
    const dm = { w: 1010, ax: 0.516 };
    this.decke.scale.set(DECKE_SX, DECKE_SY);
    this.decke.tint = 0xe2e2f2;
    g.tint = 0xe2e2f2;
    this.decke.position.set(L(DECKE_LINKS, 0)[0] + dm.w * dm.ax * DECKE_SX, 8);

    // zzz steigen über dem Gesicht auf
    const [zx, zy] = L(860, 170);
    this.zzzPunkt = { x: x + zx * LOK_S, y: y + zy * LOK_S };
    c.hitArea = new PIXI.Rectangle(-LOK_ANKER.x - 20, -LOK_ANKER.y - 30, 990, 660);
    return c;
  }

  /** Ruhe-Bild zeigen: sofort (Start im Ruhe-Bild) oder weich überblendet (nach dem Licht-aus). */
  zeige(sofort) {
    if (this.an) return;
    this.an = true;
    this.zeit = 0;
    const s = this.s;
    this.hinten.visible = true;
    this.welt.visible = true;
    if (sofort) {
      this.hinten.alpha = 1;
      this.welt.alpha = 1;
    } else {
      for (const c of [this.hinten, this.welt]) s.tween(c, { alpha: 1 }, 3.2, { ease: 'sineInOut' });
      // der Mond steigt dabei langsam ein Stückchen auf
      const my = this.mond.y;
      this.mond.y = my + 90;
      s.tween(this.mond, { y: my }, 5, { ease: 'sineInOut' });
    }
    // ganz wenige zzz von der schlafenden Lok
    this.zzz = fx.emitter('zzz', { x: this.zzzPunkt.x, y: this.zzzPunkt.y, rate: 0.12, parent: s.front });
    // Eltern-Zahnrad unten rechts (hat die Szene schon eins – Spielzeit-Ende –, bleibt es bei diesem)
    s.zahnradDa(!sofort);
    s.after(SONNE_NACH, () => this.pruefeSonne());
    // Wiegenlied klingt nach einer Weile aus
    s.after(MUSIK_NOCH, () => {
      const schritte = MUSIK_AUSKLANG;
      for (let i = 1; i <= schritte; i++) {
        s.after(i, () => {
          this.musikVol = Math.max(0, 1 - i / schritte);
          if (this.musikVol <= 0.001) music(null);
          else music('musik/nacht', { vol: this.musikVol });
        });
      }
    });
    s.after(MUSIK_NOCH + MUSIK_AUSKLANG + 4, () => sfx('common/grillen', { vol: 0.25 }));
  }

  // Sonnen-Knopf nur, wenn die Spielzeit es erlaubt
  pruefeSonne() {
    if (!this.an || !this.s.alive || this.zeit < SONNE_NACH - 0.1) return;
    const darf = !spielzeit.aufgebraucht();
    if (darf && !this.sonne) {
      this.sonne = ui.button('common/icon_sonne', {
        x: stage.W / 2, y: 1300, size: 270, parent: this.s.hud, z: 8000,
        sound: null,
        onTap: () => this.aufwachen(),
      });
      this.sonne.alpha = 0;
      this.s.tween(this.sonne, { alpha: 1 }, 1.2, { ease: 'sineInOut' });
      fx.pulse(this.sonne, { staerke: 0.05, periode: 2 });
      // Kommt die Sonne, weil die Eltern gerade im Eltern-Bereich „Noch 10 Minuten" gewählt haben, wartet der Satz,
      // bis der Bereich zu ist und das Kind die Sonne sieht (update() sagt ihn dann) – sonst wäre er für heute
      // hinter dem Schleier verbraucht.
      if (elternOffen()) this.sonneSagen = true;
      else this.sageSonne();
    } else if (!darf && this.sonne) {
      const alt = this.sonne;
      this.sonne = null;
      this.sonneSagen = false;
      alt.off();
      this.s.tween(alt, { alpha: 0 }, 0.8, { ease: 'sineInOut' }).then(() => { if (!alt.destroyed) alt.destroy({ children: true }); });
    }
  }

  // „Tipp auf die Sonne …" – nicht mehr, wenn die Sonne schon angetippt ist, wieder weg ist (Spielzeit
  // aufgebraucht) oder der Eltern-Bereich (wieder) offen ist
  sageSonne() {
    voice('schlafen_sonne', {
      nurWenn: () => !!this.sonne && !this.sonne.destroyed && !this.weckt && !elternOffen(),
    });
  }

  spielzeitGeaendert() {
    if (this.an) this.pruefeSonne();
  }

  aufwachen() {
    if (this.weckt) return;
    this.weckt = true;
    note('glocke', 79, { vol: 0.3 });
    sfx('common/funkeln', { vol: 0.5 });
    fx.burst('sterne', this.sonne.x - stage.W / 2, this.sonne.y, { count: 5, parent: this.s.front });
    this.s.after(0.6, () => this.s.go('karte'));
  }

  himmelTipp(e) {
    if (this.zeit - this.letzterHimmel < 0.35) return;
    this.letzterHimmel = this.zeit;
    fx.burst('funkeln', e.x, e.y, { count: 3, parent: this.s.front });
    note('pling', pick(PENTATONIK) + 12, { vol: 0.18 });
    // der nächste Stern leuchtet kurz auf
    let n = this.sterne[0];
    for (const q of this.sterne) if (Math.hypot(q.x - e.x, q.y - e.y) < Math.hypot(n.x - e.x, n.y - e.y)) n = q;
    if (Math.hypot(n.x - e.x, n.y - e.y) < 300) n.ziel = 1;
  }

  update(dt) {
    if (!this.an) return;
    this.zeit += dt;
    const t = this.zeit;
    // Eltern-Bereich wieder zu (das Bild läuft wieder): den zurückgehaltenen Sonnen-Satz sagen, sobald die Sonne
    // eingeblendet ist
    if (this.sonneSagen && !elternOffen()) {
      this.sonneSagen = false;
      this.s.after(1.2, () => this.sageSonne());
    }
    // Mond atmet langsam und wiegt sich
    const atem = Math.sin((t / 5) * Math.PI * 2);
    this.mond.scale.set(MOND_S * (1 + 0.022 * atem), MOND_S * (1 - 0.012 * atem));
    this.mond.rotation = 0.035 * Math.sin((t / 11) * Math.PI * 2);
    // die Decke über der Lok hebt und senkt sich mit dem Atem
    this.decke.scale.y = DECKE_SY * (1 + 0.018 * Math.sin((t / 3.6) * Math.PI * 2));
    // Sterne
    for (const st of this.sterne) {
      glimmen(st, dt, 0.5);
      const w = 0.5 + 0.5 * Math.sin((t / st.periode) * Math.PI * 2 + st.phase);
      st.alpha = clamp(0.35 + 0.5 * w + 0.4 * st.extra, 0, 1);
    }
    // Hausfenster glimmt (nach einem Tipp weich heller)
    glimmen(this.hausGlimm, dt, 0.6);
    this.hausSchein.alpha = 0.5 + 0.08 * Math.sin((t / 4.5) * Math.PI * 2) + 0.35 * this.hausGlimm.extra;
    // Sternschnuppe: selten, langsam, weich
    this.schnuppeIn -= dt;
    if (this.schnuppeIn <= 0) {
      this.schnuppeIn = rand(18, 28);
      const sch = this.schnuppe;
      const links = Math.random() < 0.5;
      const x0 = links ? rand(-900, -500) : rand(300, 700);
      sch.position.set(x0, rand(170, 300));
      sch.alpha = 0;
      this.s.tween(sch, { x: x0 + 420, y: sch.y + 160 }, 3.5, { ease: 'sineInOut' });
      this.s.tween(sch, { alpha: 0.9 }, 1.2, { ease: 'sineInOut' })
        .then((ok) => { if (ok) this.s.tween(sch, { alpha: 0 }, 1.6, { ease: 'sineInOut', delay: 0.6 }); });
    }
  }

  hinweise() {
    // ohne Sonne (Spielzeit vorbei) zeigt die Hand nichts – das Bild soll zur Ruhe kommen
    if (this.sonne && !this.sonne.destroyed) return [this.sonne];
    return [];
  }

  exit() {
    this.zzz?.stop();
  }
}
