// Seite 2 – Hühner: Fünf Nester auf dem Regalbrett, auf dreien sitzt ein Huhn. Huhn antippen → gackert, hüpft,
// ein Ei liegt im Nest. Ei antippen oder ziehen → hüpft in den Eierkorb (bis 6 Eier sichtbar). Manchmal wackelt
// ein Ei und ein Küken schlüpft – antippen → piept und läuft zu einer Henne. Korb voll → der Hahn kräht, der Korb
// wird abgeholt und ein leerer kommt.

import { Actor, voice, fx, meta, tex, tap, drag, rand, pick, clamp, killTweensOf, PIXI } from '../../engine/index.js';
import { Seite } from '../../gemeinsam/seiten.js';
import { belohne } from '../../gemeinsam/sticker.js';
import { ton, laut, bogenFlug } from './hilfen.js';

const NEST_SKALA = 0.72;
const HUHN_HOEHE = 350;
const EI_SKALA = 0.85;
const KORB_SKALA = 0.72;
const KORB_EI_SKALA = 0.54;   // Ei im Korb (Bühnen-Einheiten je Bildpunkt)
const KORB_MAX = 6;
const KUEKEN_NEST = 0.55;     // Küken im Nest
const KUEKEN_BODEN_SKALA = 0.8; // Küken vorn im Stroh
const KUEKEN_BODEN = 1415;    // Füße des Kükens im Stroh
const KUEKEN_X_MIN = -520;    // zwischen Hahn (links) …
const KUEKEN_X_MAX = 600;     // … und Eierkorb (rechts)
// Plätze der Eier im Korb (Bildpunkte des Korbbilds 443×500): hinten drei, vorn drei
const KORB_PLAETZE = [[160, 282], [230, 278], [300, 282], [128, 304], [222, 308], [316, 304]];
const KORB_RAND_Y = 292;      // darunter verdeckt der vordere Korbrand die Eier

export class Huehner extends Seite {
  static hg = 'bauernhof/hg_huehner';

  aufbau() {
    this.nester = [1, 2, 3, 4, 5].map((i) => this.baueNest(i));
    this.imKorb = 0;              // vergebene Plätze im Korb (auch Eier, die noch fliegen)
    this.gelandet = 0;            // Eier, die schon im Korb liegen
    this.korbUnterwegs = false;
    this.kueken = null;
    this.schluepfZeit = rand(7, 10);
    this.umzugZeit = rand(16, 22);

    // drei Hennen auf zufälligen Nestern
    const plaetze = [0, 1, 2, 3, 4].sort(() => Math.random() - 0.5).slice(0, 3).sort();
    this.hennen = plaetze.map((n) => this.baueHenne(this.nester[n]));

    this.baueKorb();
    this.baueHahn();
  }

  betreten() {
    // Hinweis kurz nach dem Betreten anmelden – nur, solange die Seite zu sehen ist und das Kind noch kein Huhn
    // angetippt hat (tippt es gleich los, braucht es ihn nicht; wartet der Satz, wird das noch einmal gefragt)
    this._hinweis?.kill();
    const passt = () => this.aktiv && !this.huhnGetippt;
    this._hinweis = this.after(2.5, () => { if (passt()) voice('bauernhof_eier', { nurWenn: passt }); });
  }

  verlassen() {
    this._hinweis?.kill();
    this._hinweis = null;
  }

  // ---------------------------------------------------------------- Nester und Hennen

  baueNest(i) {
    const p = this.punkt('nest' + i, { x: -800 + (i - 1) * 400, y: 850 });
    const nest = this.bild('bauernhof/nest_leer', p.x, p.y, NEST_SKALA, 20);
    const m = meta('bauernhof/nest_leer');
    // Mitte der Mulde (Bildpunkt 215/150) – dort liegen Ei und Küken
    const mulde = { x: p.x + (215 - m.ax * m.w) * NEST_SKALA, y: p.y + (150 - m.ay * m.h) * NEST_SKALA + 42 };
    const slot = { i, x: p.x, y: p.y, nest, mulde, henne: null, ei: null, kueken: null };
    // Tippfläche über Nest und Henne (unter den Eiern)
    const flaeche = new PIXI.Container({ label: 'nest' + i });
    flaeche.position.set(p.x, p.y);
    flaeche.zIndex = 25;
    this.welt.addChild(flaeche);
    tap(flaeche, () => this.tippeNest(slot), {
      sound: null, squash: false, hitArea: new PIXI.Rectangle(-175, -470, 350, 490),
    });
    return slot;
  }

  baueHenne(slot) {
    const skala = HUHN_HOEHE / (meta('tiere/huhn_idle').h || 900);
    const h = new Actor('huhn', { x: slot.x, y: slot.y - 78, scale: skala, parent: this.welt, z: 15 });
    h.flip = slot.x > 0;
    h.slot = slot;
    slot.henne = h;
    return h;
  }

  tippeNest(slot) {
    const h = slot.henne;
    if (!h) {
      fx.wobble(slot.nest, 0.05);
      ton('common/rascheln', { vol: 0.5, abstand: 0.6 });
      return;
    }
    laut('huhn', 0.8);
    this.huhnGetippt = true;
    if (h._legt || h._zieht) return;   // legt gerade oder hüpft gerade ins andere Nest
    if (slot.ei || slot.kueken) {
      h.hop(50);
      return;
    }
    this.legeEi(slot);
  }

  async legeEi(slot) {
    const h = slot.henne;
    h._legt = true;
    h.pose('happy');
    h.hop(120);
    await this.wait(0.34);
    if (!slot.ei && !slot.kueken) this.neuesEi(slot);
    await this.wait(0.8);
    h._legt = false;
    if (!h.destroyed && h.poseName === 'happy') h.pose('idle');
  }

  neuesEi(slot) {
    const id = pick(['bauernhof/ei', 'bauernhof/ei_braun']);
    const ei = this.bild(id, slot.mulde.x, slot.mulde.y, 0, 40);
    ei.alter = 0;
    ei.slot = slot;
    slot.ei = ei;
    ton('common/plopp', { vol: 0.8, abstand: 0.1 });
    this.tween(ei, { scale: EI_SKALA }, 0.45, { ease: 'backOut' });
    ei.ziehen = drag(ei, {
      back: false,
      lift: 1.15,
      pad: 60,
      onStart: () => {
        ei.gezogen = true;
        if (slot.ei === ei) slot.ei = null;
      },
      onDrop: () => this.eiInKorb(ei),
    });
    return ei;
  }

  // ---------------------------------------------------------------- Korb

  baueKorb() {
    const p = this.punkt('korb', { x: 836, y: 1480 });
    this.korbOrt = p;
    const c = new PIXI.Container({ label: 'eierkorb' });
    c.position.set(p.x, p.y);
    c.zIndex = 50;
    this.welt.addChild(c);
    const m = meta('bauernhof/eierkorb');
    this.korbM = m;
    this.korb = new PIXI.Sprite(tex('bauernhof/eierkorb'));
    this.korb.anchor.set(m.ax, m.ay);
    this.korb.scale.set(KORB_SKALA);
    c.addChild(this.korb);
    this.korbEier = new PIXI.Container({ label: 'korbEier' });
    c.addChild(this.korbEier);
    const randY = (KORB_RAND_Y - m.ay * m.h) * KORB_SKALA;
    const maske = new PIXI.Graphics().rect(-260, -420, 520, 420 + randY).fill(0xffffff);
    c.addChild(maske);
    this.korbEier.mask = maske;
    this.korbC = c;
    tap(c, () => {
      fx.wobble(c, 0.05);
      ton('common/klack', { vol: 0.5 });
    }, { sound: null, squash: false, hitArea: new PIXI.Rectangle(-170, -370, 340, 380) });
  }

  // Platz Nr. n im Korb in Korb-Koordinaten
  korbPlatz(n) {
    const m = this.korbM;
    const [x, y] = KORB_PLAETZE[n % KORB_PLAETZE.length];
    return { x: (x - m.ax * m.w) * KORB_SKALA, y: (y - m.ay * m.h) * KORB_SKALA };
  }

  async eiInKorb(ei) {
    if (ei.destroyed) return;
    ei.ziehen?.off();
    ei.eventMode = 'none';
    ei.zIndex = 100;
    // Korb ist gerade unterwegs (oder voll): Ei hüpft zurück ins Nest
    if (this.korbUnterwegs || this.imKorb >= KORB_MAX) {
      const slot = ei.slot;
      if (!slot.ei && !slot.kueken) {
        await bogenFlug(this, ei, slot.mulde.x, slot.mulde.y, { dauer: 0.6, hoehe: 120, skala: EI_SKALA });
        if (ei.destroyed) return;
        ei.zIndex = 40;
        ei.eventMode = 'static';
        ei.gezogen = false;
        slot.ei = ei;
        ei.ziehen = drag(ei, {
          back: false, lift: 1.15, pad: 60,
          onStart: () => { ei.gezogen = true; if (slot.ei === ei) slot.ei = null; },
          onDrop: () => this.eiInKorb(ei),
        });
      } else {
        this.tween(ei, { alpha: 0 }, 0.4).then(() => { if (!ei.destroyed) ei.destroy(); });
      }
      return;
    }
    const n = this.imKorb++;
    const lokal = this.korbPlatz(n);
    const ziel = this.welt.toLocal(this.korbC.toGlobal(lokal));
    ton('common/hupf', { vol: 0.6, abstand: 0.15 });
    await bogenFlug(this, ei, ziel.x, ziel.y, { dauer: 0.7, hoehe: 200, skala: KORB_EI_SKALA });
    if (ei.destroyed) return;
    // ins Korb-Innere umziehen (dort verdeckt der vordere Rand den Fuß des Eis)
    this.korbEier.addChild(ei);
    ei.position.set(lokal.x, lokal.y);
    ei.scale.set(KORB_EI_SKALA);
    ei.zIndex = n < 3 ? 1 : 2;
    this.korbEier.sortableChildren = true;
    ton('common/landen', { vol: 0.6, abstand: 0.15 });
    fx.pop(this.korbC, 0.05);
    // Erst wenn das letzte Ei wirklich liegt, ist der Korb voll (fliegen zwei Eier gleichzeitig, zählt das spätere)
    this.gelandet++;
    if (this.gelandet >= KORB_MAX) this.korbVoll();
  }

  async korbVoll() {
    if (this.korbUnterwegs) return;   // nur einmal (Hahn kräht einmal, ein Sticker, ein Abholen)
    this.korbUnterwegs = true;
    await this.wait(0.5);
    // Der Hahn kräht vor Freude
    this.hahn.cheer();
    belohne(this, 'bauernhof_eierkorb', this.korbOrt.x - 40, this.korbOrt.y - 480);
    await this.wait(2.6);
    // Korb wird abgeholt …
    sfx_wusch();
    await this.tween(this.korbC, { x: 1750 }, 1.6, { ease: 'sineInOut' });
    for (const e of [...this.korbEier.children]) e.destroy();
    this.imKorb = 0;
    this.gelandet = 0;
    await this.wait(0.6);
    // … und ein leerer kommt
    ton('common/plopp', { vol: 0.5 });
    await this.tween(this.korbC, { x: this.korbOrt.x }, 1.6, { ease: 'sineInOut' });
    ton('common/landen', { vol: 0.5 });
    this.korbUnterwegs = false;
  }

  // ---------------------------------------------------------------- Hahn

  baueHahn() {
    const skala = 440 / (meta('tiere/hahn_idle').h || 900);
    this.hahn = new Actor('hahn', { x: -760, y: 1462, scale: skala, parent: this.welt, z: 60 });
    this.hahn.onTap(() => {
      fx.wobble(this.hahn, 0.05);
      laut('hahn', 2.5);
    });
  }

  // ---------------------------------------------------------------- Küken

  // Ein Ei wackelt ruhig, ein Küken schlüpft im Nest und hüpft hinunter ins Stroh. Dort piept es ab und zu.
  schluepfen(ei) {
    const slot = ei.slot;
    if (!slot || ei.destroyed || slot.kueken || this.kueken) return;
    ei.ziehen?.off();
    ei.eventMode = 'none';
    slot.ei = null;
    const kueken = { slot, sprite: null, bereit: false };
    this.kueken = kueken;
    slot.kueken = kueken; // solange es im Nest ist, legt die Henne dort kein Ei
    // Ei wackelt ruhig ein paar Mal …
    ton('common/klack', { vol: 0.35 });
    this.tween(ei, { rotation: 0.13 }, 0.28, { ease: 'sineInOut', yoyo: true, repeat: 5 }).then(async () => {
      if (ei.destroyed) return;
      const x = ei.x;
      const y = ei.y;
      ei.destroy();
      // … dann schlüpft ein Küken (im Nest, vor der Henne)
      const k = this.bild('bauernhof/kueken', x, y, 0, 41);
      kueken.sprite = k;
      ton('common/kueken', { vol: 0.8, abstand: 0.3 });
      this.burst('funkeln', x, y - 80, { count: 5 });
      await this.tween(k, { scale: KUEKEN_NEST }, 0.5, { ease: 'backOut' });
      await this.wait(0.7);
      if (k.destroyed) return;
      // hinunter ins Stroh: ein großer Hüpfer, dabei wird es größer (es kommt nach vorn)
      const boden = { x: clamp(x + (x > 0 ? -150 : 150), KUEKEN_X_MIN, KUEKEN_X_MAX), y: KUEKEN_BODEN };
      k.zIndex = 70;
      ton('common/hupf', { vol: 0.5, abstand: 0.2 });
      if (slot.kueken === kueken) slot.kueken = null;
      if (!(await bogenFlug(this, k, boden.x, boden.y, { dauer: 0.9, hoehe: 260, skala: KUEKEN_BODEN_SKALA }))) return;
      if (k.destroyed) return;
      ton('common/landen', { vol: 0.4, abstand: 0.2 });
      this.burst('staub', k.x, k.y - 10, { count: 3 });
      kueken.bereit = true;
      kueken.piepZeit = rand(2, 4);
      // große Tippfläche (Bildpunkte des Kükens; bei 0,8 etwa 290 Einheiten breit)
      tap(k, () => this.kuekenZurHenne(k), { sound: null, squash: true, hitArea: new PIXI.Circle(0, -150, 180) });
    });
  }

  // Antippen: piept und läuft zu seiner Henne – in kleinen Hüpfern durchs Stroh, dann hinauf ins Nest.
  async kuekenZurHenne(k) {
    if (k.unterwegs || k.destroyed) return;
    k.unterwegs = true;
    killTweensOf(k, ['y']);
    k.y = KUEKEN_BODEN;
    ton('common/kueken', { vol: 0.8, abstand: 0.3 });
    const kueken = this.kueken;
    const slot = kueken?.slot;
    // die Henne des eigenen Nests, sonst die nächste
    const henne = (slot?.henne && !slot.henne.destroyed) ? slot.henne
      : this.hennen.slice().sort((a, b) => Math.abs(a.x - k.x) - Math.abs(b.x - k.x))[0];
    const ziel = henne.slot?.mulde || { x: henne.x, y: henne.y };
    const unter = clamp(ziel.x, KUEKEN_X_MIN, KUEKEN_X_MAX);
    k.scale.x = Math.abs(k.scale.y) * (unter < k.x ? -1 : 1);
    // kleine Hüpfer durchs Stroh, bis es unter dem Nest steht
    while (Math.abs(unter - k.x) > 30) {
      const schritt = Math.sign(unter - k.x) * Math.min(150, Math.abs(unter - k.x));
      ton('common/kueken', { vol: 0.45, abstand: 1.1 });
      if (!(await bogenFlug(this, k, k.x + schritt, KUEKEN_BODEN, { dauer: 0.36, hoehe: 45 }))) return;
      if (k.destroyed) return;
    }
    await this.wait(0.2);
    if (k.destroyed) return;
    // hinauf zur Henne (wird dabei wieder kleiner – das Nest ist weiter hinten)
    henne.lookAt?.(k.x);
    laut('huhn', 0.8);
    k.zIndex = 41;
    if (!(await bogenFlug(this, k, ziel.x, ziel.y, { dauer: 0.8, hoehe: 300, skala: KUEKEN_NEST }))) return;
    if (k.destroyed) return;
    // unter die Flügel kuscheln
    k.zIndex = 14;
    this.burst('herzen', henne.x, henne.y - 300, { count: 4 });
    henne.nod();
    await this.tween(k, { alpha: 0, scale: KUEKEN_NEST * 0.7 }, 0.7, { ease: 'sineInOut' });
    if (!k.destroyed) k.destroy();
    if (this.kueken === kueken) this.kueken = null;
    this.schluepfZeit = rand(9, 14);
  }

  // ---------------------------------------------------------------- Umziehen der Hennen

  umziehen() {
    const freie = this.nester.filter((s) => !s.henne && !s.ei && !s.kueken);
    const willige = this.hennen.filter((h) => !h._legt && !h._zieht && !h.slot.ei && !h.slot.kueken);
    if (!freie.length || !willige.length) return;
    const h = pick(willige);
    const ziel = freie.sort((a, b) => Math.abs(a.x - h.x) - Math.abs(b.x - h.x))[0];
    h.slot.henne = null;
    ziel.henne = h;
    h.slot = ziel;
    laut('huhn', 0.8);
    // Während des Hüpfers legt sie kein Ei (ein hop() würde den Umzug abbrechen) – danach rastet sie sicher ein
    h._zieht = true;
    h.hopTo(ziel.x, ziel.y - 78, { hoehe: 150, dauer: 1.0, staub: false }).then(() => {
      h._zieht = false;
      if (h.destroyed) return;
      if (h.slot === ziel) h.position.set(ziel.x, ziel.y - 78);
      h.flip = ziel.x > 0;
    });
  }

  // ---------------------------------------------------------------- Hilfen

  bild(id, x, y, skala, z) {
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

  update(dt) {
    // Eier im Nest werden älter; ab und zu schlüpft eins (ohne neue Listen pro Bild)
    for (const s of this.nester) {
      const e = s.ei;
      if (e && !e.destroyed && !e.gezogen) e.alter += dt;
    }
    if (!this.kueken) {
      this.schluepfZeit -= dt;
      if (this.schluepfZeit <= 0) {
        this.schluepfZeit = rand(6, 10);
        const alte = this.nester.map((s) => s.ei).filter((e) => e && !e.destroyed && !e.gezogen && e.alter > 5);
        if (alte.length && Math.random() < 0.6) this.schluepfen(pick(alte));
      }
    }
    // das Küken im Stroh piept ab und zu und macht einen kleinen Hüpfer auf der Stelle
    const k = this.kueken;
    if (k?.bereit && k.sprite && !k.sprite.destroyed && !k.sprite.unterwegs) {
      k.piepZeit -= dt;
      if (k.piepZeit <= 0) {
        k.piepZeit = rand(4, 6);
        ton('common/kueken', { vol: 0.5, abstand: 1 });
        const s = k.sprite;
        this.tween(s, { y: KUEKEN_BODEN - 30 }, 0.16, { ease: 'quadOut' })
          .then((ok) => { if (ok && !s.destroyed) this.tween(s, { y: KUEKEN_BODEN }, 0.3, { ease: 'bounceOut' }); });
      }
    }
    // ab und zu zieht eine Henne in ein anderes Nest (nur, wenn das Kind gerade nichts tut)
    this.umzugZeit -= dt;
    if (this.umzugZeit <= 0) {
      this.umzugZeit = rand(16, 24);
      if (this.szene.idle > 3) this.umziehen();
    }
  }

  hinweise() {
    const liste = [];
    const ei = this.nester.map((s) => s.ei).find((e) => e && !e.destroyed);
    if (ei && !this.korbUnterwegs) liste.push({ von: ei, nach: this.korb });
    const k = this.kueken;
    if (k?.bereit && k.sprite && !k.sprite.destroyed && !k.sprite.unterwegs) liste.unshift(k.sprite);
    const henne = this.hennen.find((h) => !h.slot.ei && !h.slot.kueken);
    if (henne) liste.push(henne);
    if (!liste.length) liste.push(this.hennen[0]);
    return liste;
  }
}

function sfx_wusch() {
  ton('common/wusch', { vol: 0.4, abstand: 0.5 });
}
