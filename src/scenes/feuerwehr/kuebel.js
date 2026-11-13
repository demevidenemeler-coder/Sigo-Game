// Der Blumenkübel vor dem Haus (neu in Runde 3) – Teil der Einsatz-Seite (Methoden werden in einsatz.js an die
// Klasse gehängt, `this` ist die Seite).
//
// Sonst steht er mit drei Blumen vor dem Haus: Antippen lässt die Blumen schaukeln.
// Einsatz „Blumenkübel" (eigene Kette, art 'garten'):
//   1. Der Kübel ist umgekippt: antippen (oder ziehen) – er richtet sich auf.
//   2. Drei Erdhäufchen liegen herum: wegwischen – die Erde fliegt zurück in den Kübel.
//   3. Die drei Blumen (Knospen) in den Kübel ziehen (Antippen geht auch).
//   4. Die Gießkanne kommt: über den Kübel ziehen (oder antippen) – sie gießt, die Blumen gehen auf.
//   5. Das Schaf kommt aus der Tür und freut sich, Orden, Sticker; dann Auto antippen.

import { spr, tex, meta, sfx, note, tap, drag, wipe, fx, pick, shuffle, rand, Actor, PIXI } from '../../engine/index.js';
import { freue } from './auto.js';
import { entprellt, tippRand } from './deko.js';

export const KUEBEL = { x: 760, y: 1232, scale: 0.56 };
const LIEGT = { x: 660, y: 1126, rotation: 1.5 };   // umgekippt: Öffnung nach rechts, liegt auf der Seite
const BLUME_SKALA = 0.42;
const FARBEN = ['rot', 'gelb', 'blau'];
const SLOTS = [{ dx: -58, dy: 10, r: -0.22 }, { dx: 0, dy: 4, r: 0 }, { dx: 58, dy: 10, r: 0.22 }];
// Erdhäufchen (je eine Knospe liegt daneben). Die Zuschauer stehen solange weiter links (einsatz.js), damit die
// Knospen nicht auf ihren Köpfen liegen.
const HAUFEN = [{ x: 640, y: 1292, r: 0.1 }, { x: 905, y: 1290, r: -0.15 }, { x: 790, y: 1318, r: 0.05 }];
const ERDE_TINT = 0x9a6638;
const KANNE_SKALA = 0.6;
const KANNE_HEIM = { x: 700, y: 1335 };
const GIESS_ZEIT = 0.75;    // Sekunden Gießen je Blume

export const KuebelTeil = {
  // Öffnung des stehenden Kübels (Seiten-Koordinaten)
  kuebelOeffnung() {
    const m = meta('feuerwehr/blumenkuebel');
    const p = m.pts?.oeffnung || [m.w / 2, m.h * 0.15];
    return { x: KUEBEL.x + (p[0] - m.ax * m.w) * KUEBEL.scale, y: KUEBEL.y + (p[1] - m.ay * m.h) * KUEBEL.scale };
  },

  baueKuebel() {
    const k = spr('feuerwehr/blumenkuebel', { x: KUEBEL.x, y: KUEBEL.y, scale: KUEBEL.scale, parent: this.welt, z: 36 });
    this.kuebel = k;
    const m = meta('feuerwehr/blumenkuebel');
    const op = m.pts?.oeffnung || [m.w / 2, m.h * 0.15];
    // Erde im Kübel: Kind des Kübels (kippt mit), wächst beim Einfüllen
    const erde = new PIXI.Graphics()
      .ellipse(0, 0, 128, 30).fill(0x6b4426)
      .ellipse(-30, -6, 60, 12).fill({ color: 0x8a5a34, alpha: 0.8 })
      .circle(40, 4, 8).fill({ color: 0x4e301a, alpha: 0.7 })
      .circle(-70, 6, 6).fill({ color: 0x4e301a, alpha: 0.6 });
    erde.position.set(op[0] - m.ax * m.w, op[1] - m.ay * m.h + 4);
    erde.eventMode = 'none';
    k.addChild(erde);
    this.kuebelErde = erde;
    this.erdeVoll = 1;
    this.setzeErde(1);
    this.oeffnung = this.kuebelOeffnung();
    this.rascheln = entprellt(0.8);
    this.giessTon = entprellt(1.4);

    tap(k, () => this.kuebelAngetippt(), { sound: null, pad: 45, squash: false });

    // drei Blumen (stehen sonst offen im Kübel)
    this.blumen = FARBEN.map((farbe, i) => {
      const b = spr(`feuerwehr/blume_${farbe}_auf`, { scale: BLUME_SKALA, parent: this.welt, z: 35.5 });
      b.farbe = farbe;
      b.offen = true;
      b.eventMode = 'none';
      b.zug = null;
      this.blumeInSlot(b, i);
      return b;
    });

    // Erdhäufchen (nur beim Einsatz zu sehen)
    this.haufen = HAUFEN.map((h, i) => {
      const s = spr(['feuerwehr/matsch_b', 'feuerwehr/matsch_c', 'feuerwehr/matsch_b'][i], { x: h.x, y: h.y, parent: this.welt, z: 39 });
      s.scale.set(i === 1 ? 0.3 : 0.4);
      s.rotation = h.r;
      s.tint = ERDE_TINT;
      s.visible = false;
      s.wisch = wipe(s, {
        radius: 105,
        pad: 75,
        doneAt: 0.5,
        sound: 'common/graben',
        onDone: () => this.haufenWeg(i),
      });
      return s;
    });

    // Gießkanne (kommt, wenn alle Blumen drin sind)
    const kanne = spr('common/giesskanne', { x: KANNE_HEIM.x, y: KANNE_HEIM.y, scale: KANNE_SKALA, parent: this.welt, z: 47 });
    kanne.visible = false;
    kanne.eventMode = 'none';
    this.kanne = kanne;
    this.kanneZieht = false;
    this.giessZeit = 0;
    this.giessTropfen = 0;
    this._tuelle = new PIXI.Point();
    drag(kanne, {
      pad: 60,
      lift: 1.08,
      heim: KANNE_HEIM,
      onStart: () => {
        this.kanneZieht = true;
        this.kanneGezogen = true;
        // wer die Kanne greift, gießt selbst (sie gießt nicht weiter, während sie woanders hängt)
        this.kanneSelbst = false;
      },
      onDrop: (ziel, ctx) => {
        this.kanneZieht = false;
        if (this.zustand !== 'giessen') return;
        const angetippt = Math.hypot(kanne.x - ctx.startX, kanne.y - ctx.startY) < 40;
        // angetippt, nah genug oder schon eine Blume gegossen: die Kanne gießt den Rest von selbst
        if (angetippt || this.kanneNah() || this.blumen.some((b) => b.offen)) {
          ctx.erledigt = true;
          this.kanneGiesstSelbst();
        } else {
          this.tween(kanne, { rotation: 0 }, 0.3, { ease: 'sineInOut' });
        }
      },
    });
  },

  setzeErde(f) {
    this.erdeVoll = f;
    const e = this.kuebelErde;
    e.visible = f > 0.02;
    e.scale.set(0.35 + 0.65 * f, 0.4 + 0.6 * f);
    e.alpha = Math.min(1, 0.4 + f);
  },

  blumeInSlot(b, i) {
    const s = SLOTS[i];
    const o = this.oeffnung || this.kuebelOeffnung();
    b.position.set(o.x + s.dx, o.y + s.dy);
    b.rotation = s.r;
    b.slot = i;
  },

  kuebelAngetippt() {
    if (this.zustand === 'kuebel') {
      this.kuebelAufrichten();
      return;
    }
    // während er sich aufrichtet nicht wackeln (das Wackeln würde am Ende die alte Schräglage zurückholen)
    if (this.zustand === 'aufrichten' || this.kuebelUmgekippt) return;
    fx.wobble(this.kuebel, 0.03);
    if (this.einsatz === 'kuebel' && this.zustand !== 'jubel' && !['einsteigen', 'faehrt', 'weg'].includes(this.zustand)) {
      this.klack('common/klack', { vol: 0.4 });
      return;
    }
    // stehende Blumen schaukeln, ein heller Ton
    this.rascheln('common/rascheln', { vol: 0.35 });
    note('pling', pick([84, 88, 91]), { vol: 0.3 });
    for (const b of this.blumen) {
      if (b.slot === undefined || b.slot < 0) continue;
      const r = SLOTS[b.slot].r;
      this.tween(b, { rotation: r + rand(0.1, 0.18) }, 0.35, { ease: 'sineOut' })
        .then((ok) => { if (ok) this.tween(b, { rotation: r }, 0.9, { ease: 'elasticOut' }); });
    }
  },

  // Zu Beginn jeder Runde: beim Einsatz „Blumenkübel" liegt alles umgekippt da, sonst steht der Kübel ordentlich
  kuebelVorbereiten(umgekippt) {
    for (const b of this.blumen) {
      b.zug?.off();
      b.zug = null;
      b.eventMode = 'none';
    }
    this.kanne.visible = false;
    this.kanne.eventMode = 'none';
    this.kanneZieht = false;
    this.giessZeit = 0;
    const k = this.kuebel;
    if (!umgekippt) {
      if (!this.kuebelUmgekippt) return;
      // war noch umgekippt (Runde nicht fertig gespielt): still wieder ordentlich hinstellen
      this.kuebelUmgekippt = false;
      k.position.set(KUEBEL.x, KUEBEL.y);
      k.rotation = 0;
      this.setzeErde(1);
      this.blumen.forEach((b, i) => {
        b.texture = tex(`feuerwehr/blume_${b.farbe}_auf`);
        b.offen = true;
        b.scale.set(BLUME_SKALA);
        b.zIndex = 35.5;
        this.blumeInSlot(b, i);
      });
      for (const h of this.haufen) h.visible = false;
      return;
    }
    this.kuebelUmgekippt = true;
    k.position.set(LIEGT.x, LIEGT.y);
    k.rotation = LIEGT.rotation;
    this.setzeErde(0);
    this.erdeZahl = 0;
    this.blumenDrin = 0;
    const reihe = shuffle([0, 1, 2]);
    this.haufen.forEach((h, i) => {
      h.wisch.reset();
      h.visible = true;
      h.alpha = 1;
      // auf jedem Häufchen liegt eine umgefallene Knospe
      const b = this.blumen[reihe[i]];
      const links = i % 2 === 0;
      b.texture = tex(`feuerwehr/blume_${b.farbe}_zu`);
      b.offen = false;
      b.slot = -1;
      b.scale.set(BLUME_SKALA);
      b.rotation = links ? 1.4 : -1.4;
      b.position.set(h.x + (links ? -78 : 78), h.y - 8);
      // über den Zuschauern (z 38), damit man sie greift; die mittlere Knospe liegt ganz vorn
      b.zIndex = i === 2 ? 39.5 : 39.2;
    });
  },

  kuebelBeginnt() {
    this.zustand = 'kuebel';
    this.blase('feuerwehr/blumenkuebel');
    this.hinweisSatz('feuerwehr_kuebel', () => this.zustand === 'kuebel');
  },

  async kuebelAufrichten() {
    if (this.zustand !== 'kuebel') return;
    this.zustand = 'aufrichten';
    const k = this.kuebel;
    sfx('common/kippen', { vol: 0.5 });
    const von = { x: k.x, y: k.y, r: k.rotation };
    const p = { t: 0 };
    await this.tween(p, { t: 1 }, 0.8, {
      ease: 'sineInOut',
      onUpdate: () => {
        k.x = von.x + (KUEBEL.x - von.x) * p.t;
        k.y = von.y + (KUEBEL.y - von.y) * p.t - Math.sin(Math.PI * p.t) * 30;
        k.rotation = von.r * (1 - p.t);
      },
    });
    this.kuebelUmgekippt = false;
    sfx('common/plopp', { vol: 0.6 });
    fx.pop(k, 0.08);
    this.burst('staub', KUEBEL.x, KUEBEL.y - 10, { count: 4 });
    this.zustand = 'erde';
    this.hinweisSatz('feuerwehr_erde', () => this.zustand === 'erde' && this.erdeZahl === 0, 1.8);
  },

  // Ein Häufchen ist weggewischt: die Erde fliegt im Bogen in den Kübel
  async haufenWeg(i) {
    const h = this.haufen[i];
    this.tween(h, { alpha: 0 }, 0.5, { ease: 'sineInOut' }).then((ok) => { if (ok) h.visible = false; });
    // Erde, die schon weggewischt wird, solange der Kübel noch liegt: sie fliegt, sobald er steht
    // (ein Wisch-Strich richtet ihn auch auf). Sonst landete sie im Leeren, und danach ginge es nicht weiter.
    const runde = this.runden;
    if (this.zustand === 'kuebel') this.kuebelAufrichten();
    while (this.kuebelUmgekippt || this.zustand === 'aufrichten' || this.zustand === 'ankunft') {
      await this.wait(0.2);
      if (this.runden !== runde) return;
    }
    if (this.runden !== runde || this.einsatz !== 'kuebel') return;
    const o = this.oeffnung;
    const klumpen = spr('feuerwehr/matsch_b', { x: h.x, y: h.y - 10, scale: 0.13, parent: this.welt, z: 46 });
    klumpen.tint = ERDE_TINT;
    klumpen.eventMode = 'none';
    const von = { x: klumpen.x, y: klumpen.y };
    const p = { t: 0 };
    await this.tween(p, { t: 1 }, 0.7, {
      ease: 'sineInOut',
      onUpdate: () => {
        klumpen.x = von.x + (o.x - von.x) * p.t;
        klumpen.y = von.y + (o.y - von.y) * p.t - Math.sin(Math.PI * p.t) * 160;
      },
    });
    klumpen.destroy();
    sfx('common/sand', { vol: 0.45 });
    this.erdeZahl = (this.erdeZahl || 0) + 1;
    const ziel = Math.min(1, this.erdeZahl / HAUFEN.length);
    const q = { f: this.erdeVoll };
    this.tween(q, { f: ziel }, 0.5, { ease: 'sineOut', onUpdate: () => this.setzeErde(q.f) });
    fx.pop(this.kuebel, 0.04);
    if (this.erdeZahl >= HAUFEN.length && this.zustand === 'erde') this.blumenBeginnen();
  },

  async blumenBeginnen() {
    this.zustand = 'blumen';
    await this.wait(0.6);
    const o = this.oeffnung;
    for (const b of this.blumen) {
      b.eventMode = 'static';
      fx.pop(b, 0.1);
      b.zug = drag(b, {
        pad: 55,
        lift: 1.1,
        targets: () => [{ x: o.x, y: o.y - 40, radius: 250 }],
        onStart: () => this.tween(b, { rotation: 0 }, 0.25, { ease: 'sineOut' }),
        onDrop: (ziel, ctx) => {
          const angetippt = Math.hypot(b.x - ctx.startX, b.y - ctx.startY) < 40;
          // großzügig: in die Nähe des Topfs gebracht zählt auch
          const nah = Math.hypot(b.x - o.x, b.y - (o.y - 40)) < 340;
          if (ziel || angetippt || nah) {
            ctx.erledigt = true;
            b.zIndex = 35.5;
            this.blumeRein(b, !!ziel);
            return;
          }
          // daneben: legt sich wieder hin, wo sie lag
          this.tween(b, { rotation: b.x < KUEBEL.x ? 1.4 : -1.4 }, 0.4, { ease: 'sineInOut' });
        },
      });
    }
    this.hinweisSatz('feuerwehr_blumen', () => this.zustand === 'blumen' && this.blumenDrin === 0, 1.5);
  },

  async blumeRein(b, gezogen) {
    if (this.zustand !== 'blumen' || b.slot >= 0) return;
    b.zug?.off();
    b.zug = null;
    b.eventMode = 'none';
    // nächster freier Platz im Kübel
    const frei = [0, 1, 2].find((i) => !this.blumen.some((x) => x.slot === i));
    b.slot = frei ?? 1;
    const s = SLOTS[b.slot];
    const o = this.oeffnung;
    b.zIndex = 35.5;
    const von = { x: b.x, y: b.y, r: b.rotation };
    const p = { t: 0 };
    await this.tween(p, { t: 1 }, gezogen ? 0.35 : 0.8, {
      ease: 'sineInOut',
      onUpdate: () => {
        b.x = von.x + (o.x + s.dx - von.x) * p.t;
        b.y = von.y + (o.y + s.dy - von.y) * p.t - Math.sin(Math.PI * p.t) * (gezogen ? 10 : 120);
        b.rotation = von.r + (s.r - von.r) * p.t;
      },
    });
    sfx('common/plopp', { vol: 0.5 });
    fx.pop(b, 0.08);
    this.burst('blaetter', o.x + s.dx, o.y - 30, { count: 2 });
    this.blumenDrin++;
    if (this.blumenDrin >= this.blumen.length && this.zustand === 'blumen') this.kanneKommt();
  },

  async kanneKommt() {
    this.zustand = 'giessen';
    this.giessZeit = 0;
    this.kanneGezogen = false;
    await this.wait(0.5);
    const k = this.kanne;
    k.position.set(KANNE_HEIM.x, KANNE_HEIM.y);
    k.rotation = 0;
    k.alpha = 0;
    k.visible = true;
    k.eventMode = 'static';
    this.tween(k, { alpha: 1 }, 0.4, { ease: 'sineInOut' });
    fx.pop(k, 0.12);
    sfx('common/plopp', { vol: 0.5 });
    this.hinweisSatz('feuerwehr_giessen', () => this.zustand === 'giessen' && !this.kanneGezogen, 2);
  },

  // Wo die Kanne stehen muss, damit die Tülle über dem Kübel ist
  giessPlatz() {
    const o = this.oeffnung;
    return { x: o.x - 150, y: o.y - 170 };
  },

  kanneNah() {
    const g = this.giessPlatz();
    return Math.hypot(this.kanne.x - g.x, this.kanne.y - g.y) < 210;
  },

  // Die Kanne fliegt selbst zum Kübel und gießt alle Blumen
  async kanneGiesstSelbst() {
    if (this.zustand !== 'giessen' || this.kanneAuto) return;
    this.kanneAuto = true;
    const k = this.kanne;
    k.eventMode = 'none';
    const g = this.giessPlatz();
    await this.tween(k, { x: g.x, y: g.y }, 0.7, { ease: 'sineInOut' });
    this.kanneAuto = false;
    // ab hier gießt kanneTakt weiter, bis alle offen sind
    this.kanneSelbst = true;
  },

  kuebelTakt(dt) {
    if (this.zustand !== 'giessen') return;
    const k = this.kanne;
    const giesst = this.kanneSelbst || (this.kanneZieht && this.kanneNah());
    // Kanne neigt sich über dem Kübel (weich)
    const zielR = giesst ? 0.5 : 0;
    k.rotation += (zielR - k.rotation) * (1 - Math.exp(-dt * 6));
    if (!giesst || k.rotation < 0.3) return;
    this.giessTon('common/giessen', { vol: 0.5 });
    this.giessTropfen -= dt;
    if (this.giessTropfen <= 0) {
      this.giessTropfen = 0.28;
      k.toGlobal({ x: 175, y: -63 }, this._tuelle);
      const t = this.welt.toLocal(this._tuelle);
      this.burst('tropfen', t.x, t.y + 20, { count: 2 });
    }
    this.giessZeit += dt;
    if (this.giessZeit < GIESS_ZEIT) return;
    this.giessZeit = 0;
    const b = this.blumen.filter((x) => !x.offen).sort((a, c) => a.slot - c.slot)[0];
    if (b) this.blumeGehtAuf(b);
    if (this.blumen.every((x) => x.offen)) this.alleBlumenOffen();
  },

  blumeGehtAuf(b) {
    b.offen = true;
    b.texture = tex(`feuerwehr/blume_${b.farbe}_auf`);
    fx.pop(b, 0.12);
    note('pling', [79, 84, 88][b.slot] ?? 84, { vol: 0.3 });
    sfx('common/wachsen', { vol: 0.35 });
    this.burst('funkeln', b.x, b.y - 150, { count: 2 });
  },

  async alleBlumenOffen() {
    this.zustand = 'jubel';
    this.kanneSelbst = false;
    const k = this.kanne;
    k.eventMode = 'none';
    this.hinweisSatz(null);
    this.tween(k, { rotation: 0 }, 0.4, { ease: 'sineInOut' });
    await this.wait(0.5);
    this.tween(k, { alpha: 0 }, 0.6, { ease: 'sineInOut' }).then((ok) => { if (ok) k.visible = false; });
    // das Schaf kommt aus der Tür, schaut sich die Blumen an und freut sich
    await this.tuerAuf();
    const s = new Actor('schaf', { x: this.tuerMitte + 4, y: 1120, scale: 0.26, parent: this.welt, z: 22 });
    s.schatten.visible = false;
    s.alpha = 0;
    s.onTap(() => freue(this, s, { herzen: 3 }), { pad: tippRand(s) });
    this.tween(s, { alpha: 1 }, 0.4, { ease: 'sineInOut' });
    this.retter = s;
    await s.hop(40);
    s.zIndex = 38;
    s.schatten.visible = true;
    await this.sicherHuepfen(s, KUEBEL.x - 210, 1262, { hoehe: 70, dauer: 0.7 });
    s.lookAt(KUEBEL.x);
    await freue(this, s, { herzen: 5 });
    await this.belohnung();
    this.tuerZu();
    // die Straße ist wieder frei: die Zuschauer rücken zurück, das Schaf stellt sich dazu
    this.zuschauerRuecken(false);
    this.zuDenZuschauern([s]);
    await this.wait(1.0);
    this.einsteigenBeginnt();
  },

  kuebelHinweise() {
    switch (this.zustand) {
      case 'kuebel': return [this.kuebel];
      case 'erde': {
        const h = this.haufen.find((x) => x.visible && !x.wisch.isDone());
        return h ? [h] : [this.kuebel];
      }
      case 'blumen': {
        const b = this.blumen.find((x) => x.slot < 0 && x.eventMode !== 'none');
        return b ? [{ von: b, nach: { x: this.oeffnung.x, y: this.oeffnung.y - 40 } }] : [this.kuebel];
      }
      case 'giessen': {
        const g = this.giessPlatz();
        return this.kanne.visible ? [{ von: this.kanne, nach: g }] : [this.kuebel];
      }
      default: return null;
    }
  },
};
