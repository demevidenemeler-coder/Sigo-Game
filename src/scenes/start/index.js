// Startbild: Morgenstimmung auf der Wiese.
//
// - Das Logo (rahmen/logo) schwebt sanft; aus dem Schornstein der O-Lok steigt ab und zu ein Wölkchen.
// - Auf dem Gleis rollt der Zug des Kindes (ladeZug) gemütlich von links herein und hält.
// - Großer grüner Start-Knopf (rahmen/knopf_start, atmet sanft) → Pfiff, der Zug fährt nach rechts hinaus,
//   dann geht es zur Landkarte.
// - Alles reagiert: Logo (kleine Melodie, Funkeln), Lok (Pfiff), Wagen und Gäste (jubeln), Sonne (lächelt,
//   warmer Schein), Apfelbaum (Rascheln, ein Apfel fällt), Wiese (Blümchen), Blumen unten (Schmetterling),
//   Himmel (leises Funkeln). Ein Schmetterling gaukelt über den Blumen.
// - Unten rechts bleiben 240×240 frei (Eltern-Zahnrad), oben links gibt es keinen Karten-Knopf.

import {
  Scene, stage, spr, sfx, voice, note, tap, fx, rand, pick, clamp, PIXI, audioState,
} from '../../engine/index.js';
import { setzeHintergrund, hgPunkt } from '../../gemeinsam/seiten.js';
import { Zug, legeGleis, ladeZug } from '../../gemeinsam/zug.js';
import { blume, Schmetterling, leuchtTextur } from '../karte/natur.js';

const HG = 'rahmen/start_hg';
const ZUG_SKALA = 0.5;
const ZUG_HALT_X = -120;        // hier hält der Zug (Mitte)
const V_HEREIN = 330;           // Einheiten/s beim Hereinrollen
const BREMSE = 140;             // Einheiten/s² beim weichen Bremsen
const ANFAHREN = 240;           // Einheiten/s² beim Anfahren
const ANFAHREN_HINAUS = 400;    // beim Losfahren etwas flotter (es geht ja los!)
const V_HINAUS = 600;
const LOGO_SKALA = 0.8;         // 1265 → ≈ 1010 breit
const LOGO_SCHORNSTEIN = { x: 1038, y: 150 };   // Bildpunkte im Logo (Lok-O)
const KNOPF = { x: 790, y: 680, groesse: 380 };
const PENTATONIK = [72, 74, 76, 79, 81, 84];
const MAX_BLUMEN = 10;
const MAX_AEPFEL = 3;

export default class Start extends Scene {
  static id = 'start';
  static packs = ['rahmen', 'zug', 'tiere'];
  static tiere = [];
  static music = 'musik/karte';
  static ohneKarte = true;

  async enter() {
    this.phase = 'warten';       // warten → herein → steht → hinaus
    this.v = 0;
    this.los = false;
    this.blumen = [];
    this.falter = [];
    this.aepfel = [];
    this.logoTon = 0;

    this.hg = setzeHintergrund(this, HG);
    tap(this.hg, (e) => this.wieseGetippt(e.x, e.y), {
      sound: null, squash: false, hitArea: new PIXI.Rectangle(-3000, -1000, 6000, 3000),
    });

    this.baueSonne();
    this.baueBaum();
    this.baueLogo();
    this.baueKnopf();
    this.baueZug();
    this.baueFalter();

    this.after(0.5, () => { this.phase = this.los ? this.phase : 'herein'; });
    // Wer nach der Ankunft lange nichts tut, hört einmal je Besuch, wo es losgeht (die Zeige-Hand kommt vom Kern;
    // ob der Satz heute schon kam, entscheidet der Kern). Erst, wenn der Ton frei ist: Vor der ersten Berührung
    // würde der Satz sonst die vorgemerkte Begrüßung verdrängen – und käme womöglich erst, nachdem das Kind den
    // Knopf schon gedrückt hat. Ist der Knopf gedrückt, entfällt er still.
    this.knopfGesagt = false;
    this.every(1, () => {
      if (this.knopfGesagt || this.los || this.phase !== 'steht' || this.idle <= 8 || !audioState.bereit) return;
      this.knopfGesagt = true;
      voice('start_knopf', { nurWenn: () => !this.los });
    });
  }

  // ---------------------------------------------------------------- Aufbau

  baueSonne() {
    // Die gemalte Sonne liegt fast ganz am Bildrand – eine lächelnde Sonne darüber, die man antippen kann
    const p = { x: -1150, y: 205 };
    this.schein = new PIXI.Sprite(leuchtTextur());
    this.schein.anchor.set(0.5);
    this.schein.position.set(p.x, p.y);
    this.schein.scale.set(560 / 256);
    this.schein.alpha = 0;
    this.schein.zIndex = -950;
    this.schein.eventMode = 'none';
    this.bg.addChild(this.schein);
    this.sonne = spr('common/sonne', { x: p.x, y: p.y, parent: this.bg });
    this.sonne.anchor.set(0.5);
    this.sonne.scale.set(250 / this.sonne.texture.width);
    this.sonne.zIndex = -900;
    tap(this.sonne, () => this.sonneGetippt(), { sound: null, pad: 30 });
  }

  sonneGetippt() {
    note('glocke', pick([84, 88, 91]), { vol: 0.35 });
    fx.pop(this.sonne, 0.1);
    this.tween(this.schein, { alpha: 0.85 }, 0.6, { ease: 'sineInOut' })
      .then((ok) => ok && this.tween(this.schein, { alpha: 0 }, 1.4, { ease: 'sineInOut' }));
    fx.burst('funkeln', this.sonne.x + 60, this.sonne.y + 60, { count: 4, parent: this.bg, z: -890 });
  }

  baueBaum() {
    // unsichtbare Fläche über der gemalten Baumkrone (Bild 0…620 × 285…780)
    const krone = new PIXI.Container({ label: 'baumkrone' });
    krone.zIndex = -800;
    this.bg.addChild(krone);
    const a = this.bild(0, 285);
    const b = this.bild(615, 780);
    this.krone = { x0: a.x, y0: a.y, x1: b.x, y1: b.y };
    tap(krone, (e) => this.baumGetippt(e.x, e.y), {
      sound: null, squash: false, hitArea: new PIXI.Rectangle(a.x, a.y, b.x - a.x, b.y - a.y),
    });
  }

  baumGetippt(x, y) {
    sfx('common/rascheln', { vol: 0.8 });
    fx.burst('blaetter', x, y, { count: 3 });
    if (this.aepfel.length >= MAX_AEPFEL) return;
    // ein Apfel fällt aus der Krone (in der Nähe des Fingers, aber innerhalb der Krone)
    const k = this.krone;
    const sx = clamp(x + rand(-60, 60), Math.max(k.x0 + 120, -stage.W / 2 + 80), k.x1 - 90);
    const sy = clamp(y, k.y0 + 120, k.y1 - 120);
    const apfel = spr('common/futter_apfel', { x: sx, y: sy, parent: this.world });
    apfel.anchor.set(0.5, 0.95);
    apfel.scale.set(80 / apfel.texture.height);
    apfel.zIndex = 2;
    apfel.alpha = 0;
    this.aepfel.push(apfel);
    const boden = rand(1080, 1130);
    this.tween(apfel, { alpha: 1 }, 0.2, { ease: 'sineInOut' });
    this.tween(apfel, { y: boden }, 0.75, { ease: 'bounceOut' })
      .then((ok) => {
        if (!ok) return false;
        sfx('common/landen', { vol: 0.6 });
        return this.tween(apfel, { x: apfel.x + rand(60, 140), rotation: rand(1.2, 2.2) }, 1.1, { ease: 'cubicOut' });
      })
      .then(() => this.wait(7))
      .then(() => this.tween(apfel, { alpha: 0 }, 1, { ease: 'sineInOut' }))
      .then(() => {
        this.aepfel = this.aepfel.filter((q) => q !== apfel);
        if (!apfel.destroyed) apfel.destroy();
      });
    const h = apfel.texture.height;
    tap(apfel, () => {
      sfx('common/plopp', { vol: 0.7 });
      fx.burst('herzen', apfel.x, apfel.y - 60, { count: 2 });
    }, { sound: null, hitArea: new PIXI.Circle(0, -h * 0.45, 110 / apfel.scale.y) });
  }

  baueLogo() {
    const p = hgPunkt(this.hg, 'logo') || { x: 0, y: 480 };
    this.logoOrt = p;
    this.logo = spr('rahmen/logo', { x: p.x, y: p.y, parent: this.world });
    this.logo.scale.set(LOGO_SKALA);
    this.logo.zIndex = 3;
    tap(this.logo, () => this.logoGetippt(), { sound: null, pad: 20 });
    // ab und zu ein Dampfwölkchen aus dem Lok-O
    this.every(5.5, () => {
      const q = this.logoPunkt(LOGO_SCHORNSTEIN);
      fx.burst('rauch', q.x, q.y, { count: 1, groesse: 0.7 });
    });
  }

  logoPunkt(bp) {
    const t = this.logo.texture;
    return this.front.toLocal({ x: bp.x - t.width / 2, y: bp.y - t.height / 2 }, this.logo);
  }

  logoGetippt() {
    const jetzt = this.t;
    if (jetzt - this.logoTon < 0.9) return;   // die kleine Melodie nicht übereinanderstapeln
    this.logoTon = jetzt;
    const toene = pick([[72, 76, 79], [76, 79, 84], [79, 76, 72], [72, 74, 76]]);
    toene.forEach((n, i) => this.after(i * 0.16, () => note('xylo', n, { vol: 0.6 })));
    fx.burst('funkeln', this.logo.x, this.logo.y, { count: 6 });
  }

  baueKnopf() {
    const k = spr('rahmen/knopf_start', { x: KNOPF.x, y: KNOPF.y, parent: this.world });
    k.scale.set(KNOPF.groesse / k.texture.height);
    k.zIndex = 4;
    this.knopf = k;
    const r = (KNOPF.groesse / 2 + 30) / k.scale.x;
    tap(k, () => this.losfahren(), { sound: null, hitArea: new PIXI.Circle(0, 0, r) });
    this.knopfAtem = fx.pulse(k, { staerke: 0.05, periode: 1.8 });
  }

  baueZug() {
    const gleis = hgPunkt(this.hg, 'gleis') || { y: 1285 };
    // Das Gleisbild ist ≈110 hoch (Schiene oben, Schwellen und Schotter darunter): Oberkante der Schiene
    // etwas über den gemalten Schotterstreifen (1240…1325) legen, damit er ihn bedeckt
    this.gleisY = gleis.y - 50;
    this.gleis = legeGleis(this.world, { y: this.gleisY, von: -1700, bis: 1700, z: 1, scale: ZUG_SKALA });
    const zug = new Zug({ konfig: ladeZug(), x: 0, y: this.gleisY, scale: ZUG_SKALA, parent: this.world, szene: this, z: 5 });
    this.zug = zug;
    zug.x = -(stage.W / 2 + zug.laenge / 2 + 60);
    tap(zug.lok, () => this.lokGetippt(), { sound: null });
    for (const w of zug.wagen) {
      tap(w.koerper, () => {
        w.fahrzeug.wackel();
        if (!zug.gaesteJubeln(w.index)) sfx('common/klack', { vol: 0.6 });
      }, { sound: null });
    }
  }

  lokGetippt() {
    if (this.zug.pfeife()) this.zug.lok.hupf(14);
  }

  baueFalter() {
    // ein Schmetterling gaukelt über den Blumen vorn (unten rechts bleibt frei)
    const f = new Schmetterling({ x: -500, y: 1420, bereich: { x0: -1000, x1: 780, y0: 1360, y1: 1480 }, tempo: 60 });
    f.scale.set(1.9);
    f.zIndex = 30;
    this.world.addChild(f);
    this.falter.push(f);
    this.heimFalter = f;
    tap(f, () => this.falterGetippt(f), { sound: null, squash: false, hitArea: new PIXI.Circle(0, 0, 110 / 1.9) });
  }

  falterGetippt(f) {
    if (f.weg) return;
    note('floete', pick([79, 81, 84]), { vol: 0.35 });
    fx.burst('herzen', f.x, f.y - 20, { count: 2 });
    f.fliegWeg(f.x > 0 ? -1 : 1, () => {
      // nach einer Weile kommt er von links außerhalb des Bilds zurück (rechts unten sitzt das Zahnrad) und wird
      // dabei weich sichtbar – er taucht nie plötzlich mitten im Bild auf
      this.after(6, () => f.kommZurueck(-stage.W / 2 - 60, rand(1380, 1440), 0.6));
    });
  }

  // ---------------------------------------------------------------- Umrechnen

  bild(px, py) {
    const hg = this.hg;
    const t = hg.texture;
    const s = hg.scale.y;
    return { x: hg.x + (px / t.width - hg.anchor.x) * t.width * s, y: hg.y + (py / t.height - hg.anchor.y) * t.height * s };
  }

  // ---------------------------------------------------------------- Wiese, Himmel, Blumen

  wieseGetippt(x, y) {
    // unten rechts sitzt das Eltern-Zahnrad: dort passiert nichts
    if (y > stage.H - 240 && x + stage.W / 2 > stage.W - 240) return;
    if (y < 1010) {
      // Himmel und ferne Hügel: ein leises Funkeln (Blumen wachsen nur auf der nahen Wiese)
      fx.burst('funkeln', x, y, { count: 3 });
      note('pling', pick(PENTATONIK), { vol: 0.3 });
      return;
    }
    if (y > 1360) {
      // gemalte Blumen vorn: ein Schmetterling flattert auf
      if (this.falter.length < 3) {
        const f = new Schmetterling({ x, y, einblenden: 0.5 });
        f.scale.set(1.7);
        f.zIndex = 31;
        this.world.addChild(f);
        this.falter.push(f);
        f.fliegWeg(x > 0 ? -1 : 1, (weg) => {
          this.falter = this.falter.filter((q) => q !== weg);
          weg.destroy({ children: true });
        });
        note('floete', pick([79, 81, 84]), { vol: 0.3 });
      } else {
        fx.burst('funkeln', x, y, { count: 2 });
      }
      return;
    }
    if (y > this.gleisY - 30) {
      fx.burst('staub', x, y, { count: 3 });
      return;
    }
    // Wiese: ein Blümchen wächst (an einer vorhandenen wackelt es)
    const nah = this.blumen.find((b) => Math.hypot(b.x - x, b.y - 30 - y) < 70);
    if (nah) {
      fx.wobble(nah.kopf, 0.25);
      note('pling', pick(PENTATONIK), { vol: 0.3 });
      return;
    }
    const b = blume(undefined, rand(1.3, 1.6));
    b.position.set(x, Math.min(y + 30, this.gleisY - 10));
    b.zIndex = 2;
    const s = b.scale.x;
    b.scale.set(0);
    this.world.addChild(b);
    this.tween(b, { scale: s }, 0.55, { ease: 'backOut' });
    this.blumen.push(b);
    sfx('common/wachsen', { vol: 0.55 });
    if (this.blumen.length > MAX_BLUMEN) {
      const alt = this.blumen.shift();
      this.tween(alt, { alpha: 0 }, 1.2, { ease: 'sineInOut' }).then(() => { if (!alt.destroyed) alt.destroy({ children: true }); });
    }
  }

  // ---------------------------------------------------------------- Losfahren

  losfahren() {
    if (this.los) return;
    this.los = true;
    this.knopfAtem?.stop();
    fx.pop(this.knopf, 0.12);
    this.zug.pfeife();
    this.after(0.25, () => this.tween(this.knopf, { alpha: 0 }, 0.6, { ease: 'sineInOut' }));
    this.knopf.eventMode = 'none';
    this.after(0.4, () => { this.phase = 'hinaus'; });
    this.after(2.8, () => this.go('karte'));
  }

  angekommen() {
    this.zug.pfeife();
    this.after(0.6, () => voice('start_hallo'));
  }

  // ---------------------------------------------------------------- Ablauf

  update(dt, t) {
    // Zug: Geschwindigkeit selbst führen (weich anfahren, auf den Punkt genau weich bremsen)
    const zug = this.zug;
    let vZiel = 0;
    if (this.phase === 'herein') {
      const rest = ZUG_HALT_X - zug.x;
      vZiel = Math.min(V_HEREIN, Math.sqrt(2 * BREMSE * Math.max(0, rest)));
      if (rest < 0.5) {
        vZiel = 0;
        this.v = 0;
        zug.x = ZUG_HALT_X;
        this.phase = 'steht';
        this.angekommen();
      }
    } else if (this.phase === 'hinaus') {
      vZiel = V_HINAUS;
    }
    const a = this.phase === 'hinaus' ? ANFAHREN_HINAUS : ANFAHREN;
    this.v = vZiel > this.v ? Math.min(vZiel, this.v + a * dt) : vZiel;
    zug.geschwindigkeit = this.v;
    zug.update(dt);
    zug.x += zug.dx;
    if (this.phase === 'herein' && zug.x > ZUG_HALT_X) zug.x = ZUG_HALT_X;

    // Logo schwebt sanft
    const l = this.logo;
    l.y = this.logoOrt.y + Math.sin((t / 4.6) * Math.PI * 2) * 12;
    l.rotation = Math.sin((t / 6.4) * Math.PI * 2) * 0.012;

    // Sonne wiegt sich ganz leicht
    this.sonne.rotation = Math.sin((t / 7) * Math.PI * 2) * 0.05;

    for (const b of this.blumen) b.tick(dt);
    for (const f of this.falter) f.tick(dt);
  }

  hints() {
    // Die Hand zeigt nur auf das, was das Kind tun soll: den Start-Knopf. Lok und Logo entdeckt es von selbst.
    if (this.los) return [];
    return [this.knopf];
  }
}
