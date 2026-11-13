// Die Straßenlaterne auf der Einsatz-Seite (neu in Runde 3) – als Teil der Einsatz-Seite (Methoden werden in
// einsatz.js an die Klasse gehängt, `this` ist die Seite).
//
// Sonst steht sie einfach da: Antippen lässt sie kurz warm aufleuchten (weich, nie blinken).
// Einsatz „Laterne" (Leiter-Kette mit eigener Mitte):
//   1. Leiter antippen: sie richtet sich auf, ein Tier der Mannschaft hüpft in den Korb.
//   2. Korb zur Laterne hinaufziehen.
//   3. Aus dem Gerätefach kommt eine Glühbirne: zur Laterne hinaufziehen (Antippen geht auch, dann fliegt sie selbst).
//   4. Die Laterne dreimal antippen: die Birne wird eingedreht, die Laterne leuchtet warm, die Eule oben freut sich.
//   5. Korb herunterziehen, das Tier hüpft zurück, die Eule kommt zu den Zuschauern.

import { spr, meta, sfx, note, tap, drag, fx, pick } from '../../engine/index.js';
import { freue } from './auto.js';

export const LATERNE = { x: -470, y: 1232, scale: 0.9 };
const BIRNE_GLAS = 0.27;     // Größe der Birne im Glas
const BIRNE_FACH = 0.55;     // Größe der Ersatzbirne am Auto (gut zu greifen)
const DREHUNGEN = 3;         // so oft antippen, bis die Birne fest sitzt
const SCHEIN_SKALA = 0.36;   // Lichtschein: etwa 320 Einheiten

export const LaterneTeil = {
  // Punkt aus pack.json der Laterne → Seiten-Koordinaten
  lampPunkt(name) {
    const m = meta('feuerwehr/laterne');
    const p = m.pts?.[name] || [m.w / 2, 0];
    return {
      x: LATERNE.x + (p[0] - m.ax * m.w) * LATERNE.scale,
      y: LATERNE.y + (p[1] - m.ay * m.h) * LATERNE.scale,
    };
  },

  baueLaterne() {
    const l = spr('feuerwehr/laterne', { x: LATERNE.x, y: LATERNE.y, scale: LATERNE.scale, parent: this.welt, z: 8 });
    this.laterne = l;
    this.lampGlas = this.lampPunkt('glas');
    this.lampSpitze = this.lampPunkt('spitze');
    const g = this.lampGlas;
    // die Birne im Glas (fehlt beim Einsatz „Laterne")
    this.glasBirne = spr('feuerwehr/gluehbirne', { x: g.x, y: g.y + 6, scale: BIRNE_GLAS, parent: this.welt, z: 8.6 });
    this.glasBirne.eventMode = 'none';
    this.glasBirne.alpha = 0.85;
    // warmer Schein (weich ein- und ausblenden, mindestens 0,8 s)
    const s = spr('feuerwehr/lichtschein_warm', { x: g.x, y: g.y, parent: this.welt, z: 8.8 });
    s.scale.set(SCHEIN_SKALA);
    s.alpha = 0;
    s.visible = false;
    s.eventMode = 'none';
    this.lampSchein = s;
    this.lampKaputt = false;
    this.drehungen = 0;
    this.birneZug = null;
    tap(l, () => this.laterneAngetippt(), { sound: null, pad: 55, squash: false });

    // Ersatzbirne (kommt im Einsatz aus dem Gerätefach)
    const b = spr('feuerwehr/gluehbirne', { scale: BIRNE_FACH, parent: this.welt, z: 46 });
    b.visible = false;
    b.eventMode = 'none';
    this.birne = b;
  },

  laterneAngetippt() {
    fx.wobble(this.laterne, 0.025);
    if (this.einsatz === 'laterne' && ['leiter', 'ausfahren'].includes(this.zustand)) {
      this.leiterAngetippt();
      return;
    }
    if (this.zustand === 'birne') {
      this.birneRein(false);
      return;
    }
    if (this.zustand === 'drehen') {
      this.birneDrehen();
      return;
    }
    if (this.lampKaputt) {
      this.klack('common/klack', { vol: 0.45 });
      return;
    }
    note('glocke', pick([76, 79, 83]), { vol: 0.25 });
    // gerade frisch repariert: sie leuchtet ohnehin (ein Tipp darf sie nicht vorzeitig ausgehen lassen)
    if (this.lampBleibt) return;
    this.lampAn(2.2);
  },

  // Schein weich an und nach `sek` Sekunden weich wieder aus (sek = 0: bleibt an)
  lampAn(sek, dauer = 0.9) {
    const s = this.lampSchein;
    this._lampAus?.kill();
    s.visible = true;
    this.tween(s, { alpha: 0.85 }, dauer, { ease: 'sineInOut' });
    if (sek) this._lampAus = this.after(sek, () => this.lampAus());
  },

  lampAus() {
    const s = this.lampSchein;
    this.tween(s, { alpha: 0 }, 1.4, { ease: 'sineInOut' }).then((ok) => { if (ok) s.visible = false; });
  },

  // Zu Beginn jeder Runde: beim Einsatz „Laterne" fehlt die Birne, die Eule sitzt oben auf der Laterne
  laterneVorbereiten(kaputt) {
    this.birneZug?.off();
    this.birneZug = null;
    this.birne.visible = false;
    this.birne.eventMode = 'none';
    this.drehungen = 0;
    this.lampKaputt = kaputt;
    this.lampBleibt = false;
    this.glasBirne.visible = !kaputt;
    this.glasBirne.rotation = 0;
    if (!kaputt) return null;
    this._lampAus?.kill();
    this.lampAus();
    return this.lampSpitze;
  },

  // Ein Tier der Mannschaft hüpft in den Korb (es dreht oben die Birne ein)
  async helferInKorb() {
    const h = this.mannschaft.find((t) => !t.destroyed);
    if (!h) return;
    const b = this.korbBoden();
    h.schatten.visible = false;
    h.zIndex = 26;
    sfx('common/hupf', { vol: 0.45 });
    await h.hopTo(b.x, b.y, { hoehe: 120, dauer: 0.6, staub: false });
    this.reiterHoch = 0;
    this.reiter = h;
    this.helfer = h;
  },

  // Oben angekommen: die Ersatzbirne kommt aus dem Gerätefach
  birneBeginnt() {
    this.zustand = 'birne';
    const b = this.birne;
    const f = this.auto.punkt('fach', this.welt);
    b.position.set(f.x + 40, f.y - 30);
    b.scale.set(BIRNE_FACH);
    b.rotation = 0;
    b.alpha = 0;
    b.visible = true;
    b.eventMode = 'static';
    b.zIndex = 46;
    this.tween(b, { alpha: 1 }, 0.4, { ease: 'sineInOut' });
    fx.pop(b, 0.15);
    sfx('common/plopp', { vol: 0.55 });
    this.helfer?.bubble('feuerwehr/gluehbirne', 2.6, { seite: 'rechts' });
    const g = this.lampGlas;
    this.birneZug?.off();
    this.birneZug = drag(b, {
      pad: 70,
      lift: 1.1,
      targets: () => [{ x: g.x, y: g.y, radius: 270 }],
      onDrop: (ziel, ctx) => {
        // getroffen – oder nur angetippt: dann fliegt sie von selbst hinauf
        if (ziel || Math.hypot(b.x - ctx.startX, b.y - ctx.startY) < 40) {
          ctx.erledigt = true;
          b.zIndex = 46;
          this.birneRein(!!ziel);
        }
      },
    });
    this.hinweisSatz('feuerwehr_birne', () => this.zustand === 'birne', 2.2);
  },

  async birneRein(gezogen) {
    if (this.zustand !== 'birne') return;
    this.zustand = 'birneFliegt';
    this.birneZug?.off();
    this.birneZug = null;
    const b = this.birne;
    b.eventMode = 'none';
    const g = this.lampGlas;
    const von = { x: b.x, y: b.y, s: b.scale.x };
    const p = { t: 0 };
    const dauer = gezogen ? 0.4 : 1.3;
    sfx('common/wusch', { vol: 0.35 });
    await this.tween(p, { t: 1 }, dauer, {
      ease: 'sineInOut',
      onUpdate: () => {
        b.x = von.x + (g.x - von.x) * p.t;
        b.y = von.y + (g.y + 6 - von.y) * p.t - Math.sin(Math.PI * p.t) * (gezogen ? 20 : 160);
        b.scale.set(von.s + (BIRNE_GLAS - von.s) * p.t);
      },
    });
    // jetzt steckt die Birne im Glas
    b.visible = false;
    this.glasBirne.visible = true;
    this.glasBirne.alpha = 0.85;
    this.glasBirne.rotation = 0;
    sfx('common/klick', { vol: 0.5 });
    this.zustand = 'drehen';
    this.drehungen = 0;
    this.hinweisSatz(null);
  },

  // Antippen: ein Stück eindrehen. Nach drei Mal leuchtet die Laterne.
  birneDrehen() {
    if (this.zustand !== 'drehen') return;
    this.drehungen++;
    const gb = this.glasBirne;
    sfx('common/klick', { vol: 0.5 });
    note('glocke', [72, 76, 79][Math.min(2, this.drehungen - 1)], { vol: 0.25 });
    this.tween(gb, { rotation: this.drehungen % 2 ? 0.18 : -0.18 }, 0.2, { ease: 'sineOut' })
      .then((ok) => { if (ok) this.tween(gb, { rotation: 0 }, 0.25, { ease: 'sineInOut' }); });
    this.burst('funkeln', this.lampGlas.x, this.lampGlas.y, { count: 2 });
    if (this.drehungen >= DREHUNGEN) this.laterneLeuchtet();
  },

  async laterneLeuchtet() {
    this.zustand = 'leuchtet';
    this.lampKaputt = false;
    this.lampBleibt = true;
    await this.wait(0.35);
    // ganz weich aufleuchten (1,5 s), nie blinken
    this.lampAn(0, 1.5);
    this.tween(this.glasBirne, { alpha: 1 }, 1.5, { ease: 'sineInOut' });
    sfx('common/funkeln', { vol: 0.55 });
    await this.wait(0.6);
    const eule = this.retter;
    if (eule && !eule.destroyed) freue(this, eule, { herzen: 4 });
    if (this.helfer && !this.helfer.destroyed) freue(this, this.helfer, { herzen: 3, laut: false });
    await this.wait(1.4);
    // nun den Korb wieder herunterziehen
    this.zustand = 'runter';
    this.korbZiehbar(true);
  },

  // Hüpfer, der sicher ankommt: Ein Tipp aufs Tier mitten im Sprung (Stauchen, Freuen) bricht hopTo ab – dann
  // bliebe der Helfer oben auf dem Auto sitzen (und verdeckte es). Unterwegs nimmt das Tier darum keine Tipps an,
  // und wird der Sprung doch abgelöst, springt es noch einmal bzw. steht zuletzt einfach am Ziel.
  async sicherHuepfen(t, x, y, opt) {
    if (!t || t.destroyed) return;
    const vorher = t.eventMode;
    t.eventMode = 'none';
    for (let i = 0; i < 2 && !t.destroyed; i++) {
      if (await t.hopTo(x, y, opt)) break;
      await this.wait(0.2);
    }
    if (t.destroyed) return;
    if (Math.hypot(t.x - x, t.y - y) > 2) t.position.set(x, y);
    t.eventMode = vorher;
  },

  // Nach der Rettung: der Helfer hüpft vom Korb an seinen Platz, die Eule kommt herunter auf die Straße
  async laterneGeschafft(platz) {
    const h = this.helfer;
    this.helfer = null;
    this.reiter = null;
    if (h && !h.destroyed) {
      h.zIndex = 40;
      sfx('common/hupf', { vol: 0.45 });
      await this.sicherHuepfen(h, platz.x, platz.y, { hoehe: 150, dauer: 0.8 });
      h.schatten.visible = true;
    }
    const e = this.retter;
    e.zIndex = 38;
    sfx('common/hupf', { vol: 0.45 });
    // gemächlich vom Laternendach auf die Straße (Spitze unter 1000 Einheiten/s)
    await this.sicherHuepfen(e, 130, 1490, { hoehe: 120, dauer: 1.4 });
    e.schatten.visible = true;
    await freue(this, e, { herzen: 5 });
    // nach einer Weile geht die Laterne (es ist ja Tag) weich wieder aus
    this._lampAus?.kill();
    this._lampAus = this.after(5, () => {
      this.lampBleibt = false;
      this.lampAus();
    });
  },

  laterneHinweise() {
    if (this.zustand === 'birne') return [{ von: this.birne, nach: { x: this.lampGlas.x, y: this.lampGlas.y } }];
    if (this.zustand === 'drehen') return [{ x: this.lampGlas.x, y: this.lampGlas.y }];
    return null;
  },
};

