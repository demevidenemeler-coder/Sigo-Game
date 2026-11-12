// Kleinigkeiten an der Strecke (Bäume, Büsche, Häuser, Mühle, Teich, Zaun, Heu, Blumen) und das Leben am
// Himmel (Sonne/Mond, Sterne, Wolken, Heißluftballon, Vogel) sowie ein Schmetterling über der Wiese.
// Alles reagiert beim Antippen mit Wackeln und einem Ton – ruhig, nichts blinkt.

import {
  spr, tex, meta, localPoint, sfx, note, animal, fx, tap, Actor, rand, randInt, pick, clamp, PIXI,
} from '../../engine/index.js';
import { Ding, tippbar, flaeche, ruhig } from './hilfen.js';
import { HINTEN_Y, VORNE_Y, Z, LOK_X } from './konst.js';

const { Container, Graphics, Rectangle } = PIXI;

// Pentatonik – passt immer zusammen
const PENTA = [72, 74, 76, 79, 81, 84];

// ---------------------------------------------------------------- Dinge hinter dem Gleis

// art, Bild, Größe, Gewicht (wie oft), Abstand zur Standlinie (negativ = weiter hinten)
const HINTEN = [
  { art: 'baum', id: 'fahrt/baum_rund', skala: [0.5, 0.58], gewicht: 4, tief: [-20, 5] },
  { art: 'baum', id: 'fahrt/baum_birke', skala: [0.5, 0.56], gewicht: 3, tief: [-15, 5] },
  { art: 'baum', id: 'fahrt/baum_tanne', skala: [0.46, 0.54], gewicht: 3, tief: [-20, 5] },
  { art: 'busch', id: 'fahrt/busch1', skala: [0.55, 0.62], gewicht: 3, tief: [0, 15] },
  { art: 'busch', id: 'fahrt/busch2', skala: [0.62, 0.7], gewicht: 2, tief: [5, 15] },
  { art: 'haus', id: 'fahrt/haus_rot', skala: [0.46, 0.5], gewicht: 1, tief: [-30, -20] },
  { art: 'haus', id: 'fahrt/haus_blau', skala: [0.46, 0.5], gewicht: 1, tief: [-30, -20] },
  { art: 'haus', id: 'fahrt/haus_gelb', skala: [0.46, 0.5], gewicht: 1, tief: [-30, -20] },
  { art: 'scheune', id: 'fahrt/scheune', skala: [0.46, 0.5], gewicht: 1, tief: [-30, -20] },
  { art: 'muehle', id: 'fahrt/muehle_turm', skala: [0.6, 0.62], gewicht: 1, tief: [-30, -25] },
  { art: 'teich', id: 'fahrt/teich_klein', skala: [0.5, 0.55], gewicht: 1, tief: [0, 10] },
  { art: 'heu', id: 'fahrt/heuballen', skala: [0.42, 0.48], gewicht: 2, tief: [0, 12] },
  { art: 'zaun', id: 'fahrt/zaun', skala: [0.55, 0.6], gewicht: 2, tief: [8, 15] },
];

// Dinge der vorderen Reihe (klein, damit sie den Zug nicht verdecken)
const VORNE = [
  { art: 'blume', id: 'fahrt/blume_gross_1', skala: [0.62, 0.7], gewicht: 3 },
  { art: 'blume', id: 'fahrt/blume_gross_2', skala: [0.62, 0.7], gewicht: 3 },
  { art: 'busch', id: 'fahrt/busch2', skala: [0.6, 0.68], gewicht: 2 },
  { art: 'heu', id: 'fahrt/heuballen', skala: [0.44, 0.5], gewicht: 1 },
];

function gewichtet(liste) {
  const summe = liste.reduce((a, e) => a + e.gewicht, 0);
  let r = Math.random() * summe;
  for (const e of liste) {
    r -= e.gewicht;
    if (r <= 0) return e;
  }
  return liste[liste.length - 1];
}

/** Ein Ding hinter dem Gleis. letzteArt: nicht zweimal Haus/Mühle/Teich hintereinander. */
export function neueDekoHinten(szene, linkeKante, { ohne = [] } = {}) {
  let wahl;
  for (let i = 0; i < 8; i++) {
    wahl = gewichtet(HINTEN);
    if (!ohne.includes(wahl.art)) break;
  }
  return new DekoHinten(szene, linkeKante, wahl);
}

/** Ein Ding in der vorderen Reihe (bei Regen auch Pfützen, bei Schnee ein Schneemann). */
export function neueDekoVorne(szene, linkeKante) {
  let wahl = gewichtet(VORNE);
  const w = szene.wetter;
  if (w === 'schnee' && Math.random() < 0.5) wahl = { art: 'schneemann', id: 'fahrt/schneemann', skala: [0.44, 0.48] };
  if (w === 'regen' && Math.random() < 0.45) wahl = { art: 'pfuetze', id: 'fahrt/pfuetze', skala: [0.8, 0.9] };
  return new DekoVorne(szene, linkeKante, wahl);
}

class DekoHinten extends Ding {
  constructor(s, linkeKante, wahl) {
    super(s, 0);
    this.art = wahl.art;
    const skala = rand(wahl.skala[0], wahl.skala[1]);
    const y = HINTEN_Y + rand(wahl.tief[0], wahl.tief[1]);
    const c = this.teil(s.ebHinten, y);
    this.c = c;
    this.y = y;
    this.skala = skala;

    if (wahl.art === 'muehle') {
      this.baueMuehle(skala, y);
    } else if (wahl.art === 'zaun') {
      this.baueZaun(skala, y);
    } else {
      this.bild = spr(wahl.id, { x: 0, y, scale: skala, parent: c, flip: wahl.art === 'baum' && Math.random() < 0.5 });
      if (wahl.art === 'teich') this.baueTeich(skala, y);
    }

    // Breite → Ort
    const b = c.getLocalBounds();
    this.links = b.x - 10;
    this.rechts = b.x + b.width + 10;
    this.wx = linkeKante - this.links;

    this.macheTippbar(wahl);
  }

  macheTippbar(wahl) {
    const s = this.s;
    const ziel = this.bild || this.c;
    const krone = () => ({ x: 0, y: this.y - ziel.height * 0.7 });
    switch (wahl.art) {
      // Ton und Teilchen höchstens alle 0,7–1 s je Ding (ruhig); dazwischen wackelt es nur weich
      case 'baum':
        tippbar(ziel, () => {
          fx.wobble(ziel, 0.05);
          if (!ruhig(ziel, 0.8)) return;
          sfx('common/rascheln');
          const k = krone();
          fx.burst('blaetter', k.x, k.y, { count: 5, parent: this.c, z: 1000 });
        });
        break;
      case 'busch':
        tippbar(ziel, () => {
          fx.wobble(ziel, 0.07);
          if (!ruhig(ziel, 0.8)) return;
          sfx('common/rascheln');
          fx.burst('blaetter', 0, this.y - ziel.height * 0.5, { count: 3, parent: this.c, z: 1000 });
        }, { pad: 50 });
        break;
      case 'haus':
        tippbar(ziel, () => {
          fx.wobble(ziel, 0.035);
          if (!ruhig(ziel, 0.8)) return;
          sfx('common/tuer');
          const p = localPoint(wahl.id, 'schornstein');
          if (p) {
            const flip = ziel.scale.x < 0 ? -1 : 1;
            fx.burst('rauch', p.x * this.skala * flip, this.y + p.y * this.skala, { count: 3, parent: this.c, z: 1000, groesse: 0.8 });
          }
        });
        break;
      case 'scheune':
        tippbar(ziel, () => {
          fx.wobble(ziel, 0.03);
          if (!ruhig(ziel, 1.2)) return;   // Tierlaute nicht übereinander
          sfx('common/tuer');
          s.after(0.35, () => { if (!this.tot) animal(pick(['kuh', 'pferd', 'schwein', 'schaf', 'huhn'])); });
        });
        break;
      case 'muehle':
        tippbar(this.c, () => {
          fx.wobble(this.turm, 0.02);
          this.dreh = 3.2;
          if (ruhig(this.c, 0.8)) sfx('common/wusch');
          s.belohneEinmal('muehle', 'fahrt_muehle_turm', this.c, 0, this.y - 380);
        });
        break;
      case 'teich':
        tippbar(ziel, () => {
          fx.pop(ziel, 0.04);
          if (!ruhig(ziel, 0.7)) return;
          sfx('common/platsch');
          const p = localPoint(wahl.id, 'wasser');
          const x = p ? p.x * this.skala * (ziel.scale.x < 0 ? -1 : 1) : 0;
          const y = p ? this.y + p.y * this.skala : this.y - 80;
          fx.burst('tropfen', x, y, { count: 7, parent: this.c, z: 1000 });
        });
        break;
      case 'heu':
        tippbar(ziel, () => this.huepf(ziel), { pad: 50 });
        break;
      case 'zaun':
        tippbar(this.c, () => {
          for (const z of this.c.children) fx.wobble(z, 0.05);
          if (ruhig(this.c, 0.3)) sfx('common/klack');
        });
        break;
      default:
        tippbar(ziel, () => fx.wobble(ziel, 0.05));
    }
  }

  huepf(ziel) {
    if (this._huepft) return;
    this._huepft = true;
    sfx('common/hupf');
    const y0 = this.y;
    this.s.tween(ziel, { y: y0 - 45 }, 0.18, { ease: 'quadOut' })
      .then(() => this.s.tween(ziel, { y: y0 }, 0.45, { ease: 'bounceOut' }))
      .then(() => { this._huepft = false; });
  }

  baueMuehle(skala, y) {
    this.turm = spr('fahrt/muehle_turm', { x: 0, y, scale: skala, parent: this.c });
    const n = localPoint('fahrt/muehle_turm', 'nabe');
    this.fluegel = spr('fahrt/muehle_fluegel', { x: n.x * skala, y: y + n.y * skala, scale: skala * 0.95, parent: this.c });
    this.fluegel.rotation = rand(0, Math.PI);
    this.dreh = 0.45;
  }

  baueZaun(skala, y) {
    const n = randInt(2, 3);
    const breite = meta('fahrt/zaun').w * skala * 0.94;
    for (let i = 0; i < n; i++) spr('fahrt/zaun', { x: (i - (n - 1) / 2) * breite, y, scale: skala, parent: this.c });
  }

  baueTeich(skala, y) {
    if (Math.random() < 0.6) {
      const p = localPoint('fahrt/teich_klein', 'seerose');
      const flip = this.bild.scale.x < 0 ? -1 : 1;
      const tier = pick(['frosch', 'ente']);
      const a = new Actor(tier, {
        x: p.x * skala * flip, y: y + p.y * skala + 12, scale: tier === 'frosch' ? 0.13 : 0.15, parent: this.c,
      });
      a.schatten.visible = false;
      a.onTap(() => a.cheer(), { pad: 90 });
      this.tier = a;
    }
  }

  update(dt) {
    if (this.fluegel) {
      this.dreh += (0.45 - this.dreh) * (1 - Math.exp(-dt * 0.6));
      this.fluegel.rotation += this.dreh * dt;
    }
  }

  hinweise() {
    return this.art === 'muehle' ? [this.turm] : [];
  }
}

class DekoVorne extends Ding {
  constructor(s, linkeKante, wahl) {
    super(s, 0);
    this.art = wahl.art;
    const skala = rand(wahl.skala[0], wahl.skala[1]);
    const y = VORNE_Y + rand(-12, 12);
    const c = this.teil(s.ebVorne, y);
    this.c = c;
    this.y = y;
    this.bild = spr(wahl.id, { x: 0, y, scale: skala, parent: c, flip: Math.random() < 0.4 && wahl.art !== 'blume' });
    const b = c.getLocalBounds();
    this.links = b.x - 10;
    this.rechts = b.x + b.width + 10;
    this.wx = linkeKante - this.links;

    const bild = this.bild;
    switch (wahl.art) {
      case 'blume':
        tippbar(bild, () => {
          fx.wobble(bild, 0.1);
          note('glocke', pick(PENTA) + 12, { vol: 0.45 });
        });
        break;
      case 'busch':
        tippbar(bild, () => {
          fx.wobble(bild, 0.07);
          if (!ruhig(bild, 0.8)) return;
          sfx('common/rascheln');
          fx.burst('blaetter', 0, y - 80, { count: 3, parent: c, z: 1000 });
        }, { pad: 50 });
        break;
      case 'heu':
        tippbar(bild, () => {
          if (this._huepft) return;
          this._huepft = true;
          sfx('common/hupf');
          s.tween(bild, { y: y - 45 }, 0.18, { ease: 'quadOut' })
            .then(() => s.tween(bild, { y }, 0.45, { ease: 'bounceOut' }))
            .then(() => { this._huepft = false; });
        }, { pad: 50 });
        break;
      case 'pfuetze':
        tippbar(bild, () => {
          fx.pop(bild, 0.06);
          if (!ruhig(bild, 0.7)) return;
          sfx('common/platsch');
          fx.burst('tropfen', 0, y - 20, { count: 6, parent: c, z: 1000 });
        }, { pad: 60 });
        break;
      case 'schneemann':
        tippbar(bild, () => {
          fx.wobble(bild, 0.08);
          if (ruhig(bild, 0.4)) sfx('common/plopp');
        });
        break;
      default:
        tippbar(bild, () => fx.wobble(bild, 0.06));
    }
  }
}

// ---------------------------------------------------------------- Himmel

const WOLKEN = ['common/wolke1', 'common/wolke2', 'common/wolke3'];
const WOLKE_Y = [200, 430];   // Höhe der Wolken (Tippfläche bleibt unter dem 70er-Rand oben)
const WOLKE_WEISS = 0xffffff;
const WOLKE_GRAU = 0xdfe6ee;
const FALTER_SKALA = 0.36;

// Farbe zwischen a und b mischen (k = 0…1)
function mische(a, b, k) {
  const r = ((a >> 16) & 255) + ((((b >> 16) & 255) - ((a >> 16) & 255)) * k);
  const g = ((a >> 8) & 255) + ((((b >> 8) & 255) - ((a >> 8) & 255)) * k);
  const bl = (a & 255) + (((b & 255) - (a & 255)) * k);
  return (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(bl);
}

export class Himmel {
  constructor(s) {
    this.s = s;
    const W = s.W;

    // Sonne, Mond, Sterne
    this.sonne = spr('common/sonne', { x: -560, y: 250, scale: 0.3, parent: s.bg, z: -95 });
    tippbar(this.sonne, () => {
      fx.wobble(this.sonne, 0.06);
      if (!ruhig(this.sonne, 0.5)) return;
      note('glocke', 84, { vol: 0.5 });
      this.s.after(0.25, () => note('glocke', 88, { vol: 0.4 }));
    });
    this.mond = spr('common/mond', { x: -560, y: 260, scale: 0.26, parent: s.bg, z: -95, alpha: 0 });
    this.mond.visible = false;
    tippbar(this.mond, () => {
      fx.wobble(this.mond, 0.06);
      note('glocke', 79, { vol: 0.4 });
    });
    this.sterne = new Container({ label: 'sterne' });
    this.sterne.zIndex = -96;
    this.sterne.alpha = 0;
    this.sterne.visible = false;
    s.bg.addChild(this.sterne);
    for (let i = 0; i < 9; i++) {
      const st = spr('common/stern_himmel', {
        x: rand(-W / 2 + 300, W / 2 - 300), y: rand(140, 520), scale: rand(0.22, 0.32), parent: this.sterne,
      });
      st.phase = rand(0, 6);
    }

    // Wolken
    this.wolken = [];
    for (let i = 0; i < 4; i++) {
      const w = spr(pick(WOLKEN), { x: -W / 2 + (i + 0.5) * (W / 4) + rand(-150, 150), y: rand(WOLKE_Y[0], WOLKE_Y[1]), scale: rand(0.3, 0.42), parent: s.bg, z: -90 });
      w.alpha = 0.95;
      w.wind = rand(8, 16);
      tippbar(w, () => {
        fx.wobble(w, 0.04);
        if (!ruhig(w, 0.7)) return;
        sfx('common/wusch', { vol: 0.5 });
        if (s.wetter === 'regen') fx.burst('tropfen', w.x, w.y + 40, { count: 5, parent: s.bg, z: -89 });
      });
      this.wolken.push(w);
    }

    // Heißluftballon
    this.ballon = spr('fahrt/heissluftballon', { x: rand(-200, 500), y: 380, scale: 0.42, parent: s.bg, z: -55 });
    this.ballon.hoehe = 380;
    this.ballon.phase = rand(0, 6);
    tippbar(this.ballon, () => this.ballonSteigt());

    // Vogel (einer, kommt ab und zu vorbei)
    this.vogel = spr('fahrt/vogel', { x: -W / 2 - 200, y: 300, scale: 0.42, parent: s.bg, z: -50 });
    this.vogel.visible = false;
    this.vogel.fliegt = false;
    this.vogel.versatz = 0;
    this.vogelPause = rand(4, 8);
    tippbar(this.vogel, () => this.vogelTipp());

    // Schmetterling (über der Wiese vor dem Zug)
    // (Bild und Tippfläche getrennt: der Flügelschlag staucht nur das Bild, die Fläche bleibt 280 × 280 groß)
    this.falter = new Container({ label: 'falter' });
    this.falter.position.set(0, 1350);
    this.falter.zIndex = 2;
    s.ebFlug.addChild(this.falter);
    this.falterBild = spr('fahrt/schmetterling', { scale: FALTER_SKALA, parent: this.falter });
    this.falter.visible = false;
    this.falterZustand = { aktiv: false, pause: rand(8, 14), zeit: 0, x: 0, y: 0, zielX: 0, zielY: 0, hoch: 0 };
    tap(this.falter, () => this.falterTipp(), { sound: null, squash: false, hitArea: new Rectangle(-140, -140, 280, 280) });

    this.zeit = 0;
  }

  ballonSteigt() {
    const b = this.ballon;
    if (b.steigt) return;
    b.steigt = true;
    sfx('common/dampf', { vol: 0.45 });
    fx.wobble(b, 0.03);
    this.s.tween(b, { hoehe: Math.max(180, b.hoehe - 170) }, 2.4, { ease: 'sineInOut' })
      .then(() => this.s.tween(b, { hoehe: 380 }, 7, { ease: 'sineInOut', delay: 2 }))
      .then(() => { b.steigt = false; });
    this.s.after(2.6, () => { b.steigt = false; });   // nach dem Steigen wieder antippbar (sinkt weiter von selbst)
  }

  vogelTipp() {
    const v = this.vogel;
    note('floete', 91, { vol: 0.35, dauer: 0.12 });
    this.s.after(0.16, () => note('floete', 88, { vol: 0.35, dauer: 0.15 }));
    killVersatz(this.s, v);
  }

  falterTipp() {
    const z = this.falterZustand;
    note('pling', pick(PENTA) + 12, { vol: 0.4 });
    z.zielY = clamp(z.y - 160, 1180, 1440);
    z.zielX = z.x + rand(-200, 200);
  }

  /** Tageszeit/Wetter: Sonne, Mond und Sterne weich tauschen. */
  setze(zeit, wetter) {
    const s = this.s;
    const nacht = zeit === 'nacht';
    // bei Regen und Schnee versteckt sich die Sonne ganz (halb durchsichtig wirkte sie wie ein Geist)
    const sonneAlpha = nacht || wetter !== 'klar' ? 0 : 1;
    const sonneY = zeit === 'abend' ? 400 : 250;
    this.sonne.visible = true;
    s.tween(this.sonne, { alpha: sonneAlpha, y: sonneY }, 2.5, { ease: 'sineInOut' })
      .then(() => { if (!this.sonne.destroyed && this.sonne.alpha < 0.01) this.sonne.visible = false; });
    this.mond.visible = true;
    s.tween(this.mond, { alpha: nacht ? 1 : 0 }, 2.5, { ease: 'sineInOut' })
      .then(() => { if (!this.mond.destroyed && this.mond.alpha < 0.01) this.mond.visible = false; });
    this.sterne.visible = true;
    s.tween(this.sterne, { alpha: nacht && wetter === 'klar' ? 1 : 0 }, 2.5, { ease: 'sineInOut' })
      .then(() => { if (!this.sterne.destroyed && this.sterne.alpha < 0.01) this.sterne.visible = false; });
    // Wolken-Tönung weich überblenden (nie hart umspringen)
    const ziel = wetter === 'klar' ? WOLKE_WEISS : WOLKE_GRAU;
    const von = this.wolken.map((w) => w.tint);
    const t = { k: 0 };
    this._toenung?.kill();   // schnelles Umschalten: der alte Übergang hört auf, der neue beginnt beim jetzigen Ton
    this._toenung = s.tween(t, { k: 1 }, 2.5, {
      ease: 'sineInOut',
      onUpdate: () => {
        this.wolken.forEach((w, i) => { if (!w.destroyed) w.tint = mische(von[i], ziel, t.k); });
      },
    });
    for (const w of this.wolken) s.tween(w, { alpha: wetter === 'klar' ? 0.95 : 1 }, 2.5, { ease: 'sineInOut' });
  }

  /** jedes Bild: v = Geschwindigkeit des Zugs */
  update(dt, v) {
    const s = this.s;
    const W = s.W;
    this.zeit += dt;
    const t = this.zeit;

    // Sonne/Mond atmen ganz leicht
    this.sonne.scale.set(0.3 * (1 + 0.012 * Math.sin(t * 1.6)));

    // Sterne: sehr langsames Schimmern (kein Blinken)
    if (this.sterne.visible) {
      for (const st of this.sterne.children) st.alpha = 0.7 + 0.3 * Math.sin(t * 0.5 + st.phase);
    }

    // Wolken ziehen (Wind + ein wenig Fahrt)
    for (const w of this.wolken) {
      w.x -= (w.wind + v * 0.035) * dt;
      if (w.x < -W / 2 - 320) {
        w.x = W / 2 + 320;
        w.y = rand(WOLKE_Y[0], WOLKE_Y[1]);
        w.texture = tex(pick(WOLKEN));
        w.scale.set(rand(0.3, 0.42));
        flaeche(w);   // Tippfläche passend zum neuen Bild wieder groß machen
      }
    }

    // Heißluftballon: schwebt, zieht langsam
    const b = this.ballon;
    b.x -= (6 + v * 0.05) * dt;
    if (b.x < -W / 2 - 200) b.x = W / 2 + 200;
    b.y = b.hoehe + Math.sin(t * 0.5 + b.phase) * 14;
    b.rotation = Math.sin(t * 0.4 + b.phase) * 0.03;

    // Vogel
    const vg = this.vogel;
    if (vg.fliegt) {
      vg.x += 150 * dt;
      vg.basisY += Math.sin(t * 0.7) * 6 * dt;
      vg.y = vg.basisY + Math.sin(t * 2.2) * 10 + vg.versatz;
      vg.scale.y = 0.42 * (1 + 0.07 * Math.sin(t * Math.PI * 2 * 2.2));
      if (vg.x > W / 2 + 220) {
        vg.fliegt = false;
        vg.visible = false;
        this.vogelPause = rand(12, 20);
      }
    } else {
      this.vogelPause -= dt;
      if (this.vogelPause <= 0) {
        vg.fliegt = true;
        vg.visible = true;
        vg.x = -W / 2 - 200;
        vg.basisY = rand(220, 480);
        vg.versatz = 0;
      }
    }

    // Schmetterling: flattert eine Weile über der Wiese, fliegt dann davon
    const f = this.falter;
    const z = this.falterZustand;
    if (z.aktiv) {
      z.zeit += dt;
      if (z.zeit > 14 && !z.geht) {
        z.geht = true;
        z.zielY = -200;
        z.zielX = z.x + 300;
      }
      if (!z.geht && Math.hypot(z.zielX - z.x, z.zielY - z.y) < 30) {
        z.zielX = clamp(z.x + rand(-350, 350), -s.W / 2 + 350, LOK_X - 50);
        z.zielY = rand(1300, 1450);
      }
      const k = 1 - Math.exp(-dt * 0.9);
      z.x += clamp((z.zielX - z.x) * k, -110 * dt, 110 * dt);
      z.y += clamp((z.zielY - z.y) * k, -110 * dt, 110 * dt);
      f.x = z.x + Math.sin(t * 1.3) * 18;
      f.y = z.y + Math.sin(t * 2.1) * 12;
      const schlag = Math.abs(Math.sin(t * Math.PI * 1.8));
      this.falterBild.scale.set(FALTER_SKALA * (0.55 + 0.45 * schlag), FALTER_SKALA);
      f.rotation = Math.sin(t * 1.1) * 0.12;
      if (z.geht && z.y < -100) {
        z.aktiv = false;
        f.visible = false;
        z.pause = rand(14, 24);
      }
    } else {
      z.pause -= dt;
      if (z.pause <= 0) {
        z.aktiv = true;
        z.geht = false;
        z.zeit = 0;
        z.x = -s.W / 2 - 150;
        z.y = rand(1280, 1400);
        z.zielX = rand(-700, 0);
        z.zielY = rand(1300, 1440);
        f.visible = true;
      }
    }
  }

  /** Bildschirmbreite geändert */
  resize() {}
}

// Vogel macht einen kleinen Hüpfer in der Luft
function killVersatz(s, v) {
  if (v.huepft) return;
  v.huepft = true;
  s.tween(v, { versatz: -70 }, 0.35, { ease: 'quadOut' })
    .then(() => s.tween(v, { versatz: 0 }, 0.6, { ease: 'sineInOut' }))
    .then(() => { v.huepft = false; });
}

export { gewichtet, PENTA };
export const ZEICHNE = { Graphics };
