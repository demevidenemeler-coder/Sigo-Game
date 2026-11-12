// Seite 2 – Hühner. Eine Eier-Runde hat mehrere Schritte:
//   1. Die Hennen schlafen noch → den Hahn antippen: er kräht, die Hennen wachen eine nach der anderen auf
//   2. Hennen antippen → jede legt ein Ei ins Nest (weiß, braun, manchmal ein goldenes)
//   3. Eier antippen oder ziehen → sie hüpfen in den Eierkorb
//   4. Nach zwei Eiern schauen die Hennen zum Strohhaufen: Stroh wegwischen → dort lagen versteckte Eier
//      (manchmal huscht dabei eine Maus heraus); auch die in den Korb
//   5. Korb voll (6 Eier) → der Hahn kräht, Sticker, der Korb wird abgeholt
//   6. Eine Henne brütet ein Ei aus: das Ei dreimal antippen → es knackt, ein Küken schlüpft und hüpft zu seinen
//      Geschwistern ins Stroh (die Küken-Familie wächst Runde um Runde, bleibt gespeichert)
//   7. Abend: die Hennen schlafen wieder ein – nächste Runde (andere Nester, Strohhaufen an anderer Stelle)
// Zwischendurch schleicht manchmal die Katze vorbei. Nichts kann falsch gemacht werden.

import { Actor, voice, fx, meta, tex, tap, drag, wipe, rand, pick, clamp, store, PIXI } from '../../engine/index.js';
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
const KUEKEN_BODEN_SKALA = 0.62; // Küken vorn im Stroh
const KUEKEN_BODEN = 1430;    // Füße der Küken im Stroh
const KUEKEN_PLAETZE = [180, 310, 440, 570];       // die Küken-Familie zwischen Bildmitte und Eierkorb
const KUEKEN_KEY = 'bauernhof.kueken';
const GOLD = 0xffc93a;
// Plätze der Eier im Korb (Bildpunkte des Korbbilds 443×500): hinten drei, vorn drei
const KORB_PLAETZE = [[160, 282], [230, 278], [300, 282], [128, 304], [222, 308], [316, 304]];
const KORB_RAND_Y = 292;      // darunter verdeckt der vordere Korbrand die Eier
// Verstecke für den Strohhaufen (Füße im Stroh), jede Runde ein anderes
// (alle im hinteren, etwas dunkleren Teil des Strohbodens – ganz vorn verschwamm der Haufen mit dem Boden)
const VERSTECKE = [{ x: -420, y: 1365 }, { x: -170, y: 1355 }, { x: -320, y: 1420 }, { x: 0, y: 1370 }];
// Tiefe im Stroh: wer weiter vorn steht (größeres y), liegt davor
const tiefe = (y) => Math.round(y / 10);
const FLUG_Z = 300;
// Denkblasen der Hennen rechts stehen links vom Kopf (die Ecke oben rechts mit dem Album-Knopf bleibt frei)
const blasenSeite = (h) => (h.x > 200 ? { seite: 'links' } : {});
const STROH_SKALA = 0.72;
// Ruhe-Regel für Flüge (Eier, Küken): mittleres Tempo in Einheiten/s – die Spitze liegt bei etwa 1,6 × (≤ ~1250)
const EI_TEMPO = 760;

export class Huehner extends Seite {
  static hg = 'bauernhof/hg_huehner';

  aufbau() {
    this.nester = [1, 2, 3, 4, 5].map((i) => this.baueNest(i));
    this.imKorb = 0;              // vergebene Plätze im Korb (auch Eier, die noch fliegen)
    this.gelandet = 0;            // Eier, die schon im Korb liegen
    this.korbUnterwegs = false;
    this.eiFluege = 0;            // Eier, die gerade zum Korb fliegen (höchstens zwei)
    this.eiReihe = [];            // Eier, die auf ihren Flug warten
    this.phase = 'schlaf';       // 'schlaf' | 'wecken' | 'legen' | 'suchen' | 'voll' | 'brueten' | 'abend'
    this.gesucht = false;         // Strohhaufen dieser Runde schon gefunden?
    this.runde = 0;
    this.umzugZeit = rand(16, 22);
    this.zzzZeit = 1;
    this.zzzNr = 0;
    this.katzeZeit = rand(35, 50);
    this.versteckZuletzt = -1;
    this.hennen = [];

    this.baueKorb();
    this.baueHahn();
    this.baueStroh();
    this.familie = [];
    const anzahl = clamp(Number(store.get(KUEKEN_KEY, 0)) || 0, 0, KUEKEN_PLAETZE.length);
    for (let i = 0; i < anzahl; i++) this.kuekenInsStroh(null, true);
    this.neueRunde(true);
  }

  betreten() {
    this._hinweis?.kill();
    this._hinweis = this.after(2.0, () => this.hinweisAnbieten());
  }

  verlassen() {
    this._hinweis?.kill();
    this._hinweis = null;
  }

  // Hinweise nur, solange die Seite zu sehen ist und das Kind den Schritt noch nicht selbst begonnen hat
  hinweisAnbieten() {
    if (!this.aktiv) return;
    if (this.phase === 'schlaf') {
      const passt = () => this.aktiv && this.phase === 'schlaf';
      voice('bauernhof_hahn', { nurWenn: passt });
    } else if (this.phase === 'legen' && !this.huhnGetippt) {
      const passt = () => this.aktiv && !this.huhnGetippt && this.phase === 'legen';
      voice('bauernhof_eier', { nurWenn: passt });
    } else if (this.phase === 'suchen') {
      const passt = () => this.aktiv && this.phase === 'suchen' && !this.strohBeruehrt;
      voice('bauernhof_stroh', { nurWenn: passt });
    }
  }

  // ---------------------------------------------------------------- Runden

  neueRunde(erste = false) {
    this.runde++;
    this.gesucht = false;
    this.strohBeruehrt = false;
    // zwei oder drei Hennen auf zufälligen Nestern (jede Runde etwas anders)
    const anzahl = erste ? 3 : pick([2, 3, 3]);
    const alte = this.hennen;
    // nie genau dieselbe Verteilung wie eben
    const vorher = alte.map((h) => h.slot?.i).join(',');
    let plaetze;
    for (let versuch = 0; versuch < 6; versuch++) {
      plaetze = [0, 1, 2, 3, 4].sort(() => Math.random() - 0.5).slice(0, anzahl).sort();
      if (plaetze.join(',') !== vorher) break;
    }
    // erst alle alten Nester freigeben, dann neu verteilen (sonst löschte eine Henne den Platz einer anderen)
    for (const h of alte) if (h.slot?.henne === h) h.slot.henne = null;
    this.hennen = plaetze.map((n, i) => {
      const slot = this.nester[n];
      const alt = alte[i] && !alte[i].destroyed ? alte[i] : null;
      if (!alt) {
        const h = this.baueHenne(slot);
        if (!erste) { h.alpha = 0; this.tween(h, { alpha: 1 }, 0.8, { ease: 'sineInOut' }); }
        return h;
      }
      const h = alt;
      h.slot = slot;
      slot.henne = h;
      if (!erste) {
        h._zieht = true;
        // nacheinander (höchstens zwei Bewegungen gleichzeitig)
        this.after(i * 0.6, () => h.hopTo(slot.x, slot.y - 78, { hoehe: 120, dauer: 0.9, staub: false }).then(() => {
          h._zieht = false;
          if (h.destroyed || h.slot !== slot) return;
          h.position.set(slot.x, slot.y - 78);
          h.flip = slot.x > 0;
        }));
      }
      return h;
    });
    // übrige Hennen blenden weich aus (sie sind nach draußen gegangen)
    for (const h of alte.slice(anzahl)) {
      h.eventMode = 'none';
      this.tween(h, { alpha: 0 }, 0.8, { ease: 'sineInOut' }).then(() => { if (!h.destroyed) h.destroy({ children: true }); });
    }
    for (const h of this.hennen) h.pose('sleep');
    this.versteckeEier();
    this.phase = 'schlaf';
    this.zzzZeit = 1.5;
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
    if (h._legt || h._zieht) { laut('huhn', 0.8); return; }
    if (this.phase === 'schlaf' || this.phase === 'abend') {
      // verschlafen: kleines Wackeln, sie träumt vom Hahn (der weckt sie)
      fx.wobble(h, 0.03);
      ton('common/schnarchen', { vol: 0.35, abstand: 1.5 });
      if (!h._blase) h.bubble('tiere/hahn_idle', 2.2, blasenSeite(h));
      return;
    }
    laut('huhn', 0.8);
    this.huhnGetippt = true;
    if (this.phase === 'suchen') {
      // „Schau mal, im Stroh!": sie schaut zum Strohhaufen und denkt an ein Ei
      h.lookAt(this.stroh.x);
      if (!h._blase) h.bubble('bauernhof/ei', 2.2, blasenSeite(h));
      fx.wobble(this.stroh, 0.05);
      return;
    }
    if (slot.ei || slot.kueken || this.phase !== 'legen') {
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
    if (!slot.ei && !slot.kueken) this.neuesEi(slot, slot.mulde.x, slot.mulde.y, 40);
    await this.wait(0.8);
    h._legt = false;
    if (!h.destroyed && h.poseName === 'happy') h.pose('idle');
  }

  // Ein Ei erscheint (im Nest oder im Stroh) und kann gezogen oder angetippt werden → Korb
  neuesEi(slot, x, y, z, { gold = Math.random() < 0.15, sofort = false } = {}) {
    const id = pick(['bauernhof/ei', 'bauernhof/ei_braun']);
    const ei = this.bild(gold ? 'bauernhof/ei' : id, x, y, sofort ? EI_SKALA : 0, z);
    if (gold) {
      ei.tint = GOLD;
      ei.gold = true;
    }
    ei.slot = slot;
    ei.heim = { x, y, z };
    if (slot) slot.ei = ei;
    if (!sofort) {
      ton('common/plopp', { vol: 0.8, abstand: 0.1 });
      this.tween(ei, { scale: EI_SKALA }, 0.45, { ease: 'backOut' });
      if (gold) this.after(0.3, () => this.burst('funkeln', x, y - 70, { count: 4 }));
    }
    this.machZiehbar(ei);
    return ei;
  }

  machZiehbar(ei) {
    ei.eventMode = 'static';
    ei.gezogen = false;
    ei.ziehen = drag(ei, {
      back: false,
      lift: 1.15,
      pad: 60,
      onStart: () => {
        ei.gezogen = true;
        if (ei.slot && ei.slot.ei === ei) ei.slot.ei = null;
      },
      onDrop: () => this.eiInKorb(ei),    // auch ein kurzer Tipp schickt das Ei in den Korb
    });
  }

  // ---------------------------------------------------------------- Korb

  baueKorb() {
    const p = this.punkt('korb', { x: 836, y: 1480 });
    this.korbOrt = p;
    const c = new PIXI.Container({ label: 'eierkorb' });
    c.position.set(p.x, p.y);
    c.zIndex = tiefe(p.y);
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
    ei.zIndex = FLUG_Z;
    // Korb ist gerade unterwegs (oder voll): Ei hüpft zurück an seinen Platz
    if (this.korbUnterwegs || this.imKorb >= KORB_MAX) {
      const slot = ei.slot;
      if (slot && (slot.ei || slot.kueken)) {
        this.tween(ei, { alpha: 0 }, 0.4).then(() => { if (!ei.destroyed) ei.destroy(); });
        return;
      }
      await bogenFlug(this, ei, ei.heim.x, ei.heim.y, { dauer: 0.6, hoehe: 120, skala: EI_SKALA, tempo: EI_TEMPO });
      if (ei.destroyed) return;
      ei.zIndex = ei.heim.z;
      if (slot) slot.ei = ei;
      this.machZiehbar(ei);
      return;
    }
    if (ei.slot && ei.slot.ei === ei) ei.slot.ei = null;
    if (this.versteckte?.includes(ei)) this.versteckte = this.versteckte.filter((e) => e !== ei);
    const n = this.imKorb++;
    // Ruhe-Regel: höchstens zwei Eier fliegen zugleich – weitere hüpfen kurz auf und fliegen, sobald eins gelandet ist
    if (this.eiFluege >= 2) {
      fx.pop(ei, 0.08);
      await new Promise((weiter) => this.eiReihe.push(weiter));
      if (ei.destroyed) return;
    }
    this.eiFluege++;
    const lokal = this.korbPlatz(n);
    const ziel = this.welt.toLocal(this.korbC.toGlobal(lokal));
    ton('common/hupf', { vol: 0.6, abstand: 0.15 });
    // Dauer nach der Länge des Bogens: quer über das Bild etwa 2 s, kurze Wege mindestens 0,7 s
    await bogenFlug(this, ei, ziel.x, ziel.y, { dauer: 0.7, hoehe: 200, skala: KORB_EI_SKALA, tempo: EI_TEMPO });
    this.eiFluege--;
    this.eiReihe.shift()?.();
    if (ei.destroyed) return;
    // ins Korb-Innere umziehen (dort verdeckt der vordere Rand den Fuß des Eis)
    this.korbEier.addChild(ei);
    ei.position.set(lokal.x, lokal.y);
    ei.scale.set(KORB_EI_SKALA);
    ei.zIndex = n < 3 ? 1 : 2;
    this.korbEier.sortableChildren = true;
    ton('common/landen', { vol: 0.6, abstand: 0.15 });
    if (ei.gold) this.burst('funkeln', ziel.x, ziel.y - 60, { count: 4 });
    fx.pop(this.korbC, 0.05);
    // Erst wenn das letzte Ei wirklich liegt, ist der Korb voll (fliegen zwei Eier gleichzeitig, zählt das spätere)
    this.gelandet++;
    if (this.gelandet >= 2 && !this.gesucht && this.phase === 'legen') this.suchenBeginnt();
    if (this.gelandet >= KORB_MAX) this.korbVoll();
  }

  async korbVoll() {
    if (this.korbUnterwegs) return;   // nur einmal (Hahn kräht einmal, ein Sticker, ein Abholen)
    this.korbUnterwegs = true;
    this.phase = 'voll';
    await this.wait(0.5);
    // Der Hahn kräht vor Freude
    this.hahn.cheer();
    belohne(this, 'bauernhof_eierkorb', this.korbOrt.x - 40, this.korbOrt.y - 480);
    await this.wait(2.6);
    // Korb wird abgeholt …
    ton('common/wusch', { vol: 0.4, abstand: 0.5 });
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
    this.brueten();
  }

  // ---------------------------------------------------------------- Hahn

  baueHahn() {
    const skala = 440 / (meta('tiere/hahn_idle').h || 900);
    this.hahn = new Actor('hahn', { x: -760, y: 1462, scale: skala, parent: this.welt, z: tiefe(1462) });
    this.hahn.onTap(() => {
      if (this.phase === 'schlaf') { this.wecken(); return; }
      fx.wobble(this.hahn, 0.05);
      laut('hahn', 2.5);
    });
  }

  // Kikeriki! Die Hennen wachen eine nach der anderen auf
  async wecken() {
    this.phase = 'wecken';
    this.hahn.cheer();
    await this.wait(1.0);
    for (const h of this.hennen) {
      if (h.destroyed) continue;
      h.pose('idle');
      h.hop(60);
      laut('huhn', 0.5);
      await this.wait(0.55);
    }
    this.phase = 'legen';
    this.huhnGetippt = false;
    if (this.aktiv) this._hinweis = this.after(2.5, () => this.hinweisAnbieten());
  }

  // ---------------------------------------------------------------- Strohhaufen mit versteckten Eiern

  baueStroh() {
    const s = this.bild('bauernhof/strohhaufen', 0, 1400, STROH_SKALA, 46);
    this.stroh = s;
    s.visible = false;
    // weicher Schatten unter dem Haufen: hebt ihn vom gleichfarbigen Strohboden ab
    const sch = new PIXI.Graphics()
      .ellipse(0, -6, 215, 40).fill({ color: 0x8a4512, alpha: 0.14 })
      .ellipse(0, -8, 180, 30).fill({ color: 0x8a4512, alpha: 0.16 })
      .ellipse(0, -10, 140, 20).fill({ color: 0x7a3a0e, alpha: 0.16 });
    sch.eventMode = 'none';
    sch.visible = false;
    this.welt.addChild(sch);
    this.strohSchatten = sch;
    this.strohWisch = wipe(s, {
      radius: 120,
      doneAt: 0.55,
      pad: 50,
      sound: 'common/rascheln',
      onProgress: () => { this.strohBeruehrt = true; },
      onDone: () => this.strohWeg(),
    });
    this.versteckte = [];
  }

  // Neue Runde: der Strohhaufen liegt woanders, darunter ein oder zwei Eier (manchmal eine Maus)
  versteckeEier() {
    for (const e of this.versteckte || []) if (!e.destroyed) e.destroy();
    this.versteckte = [];
    let i = Math.floor(Math.random() * VERSTECKE.length);
    if (i === this.versteckZuletzt) i = (i + 1 + Math.floor(Math.random() * (VERSTECKE.length - 1))) % VERSTECKE.length;
    this.versteckZuletzt = i;
    const v = VERSTECKE[i];
    const s = this.stroh;
    s.position.set(v.x, v.y);
    s.zIndex = tiefe(v.y);
    s.visible = true;
    s.alpha = 1;
    s.eventMode = 'none';     // erst in der Such-Phase wischbar
    this.strohWisch.reset({ fade: 0.6 });
    const sch = this.strohSchatten;
    sch.position.set(v.x, v.y);
    sch.zIndex = s.zIndex - 2;   // unter Haufen und versteckten Eiern
    sch.visible = true;
    sch.alpha = 0;
    this.tween(sch, { alpha: 1 }, 0.6, { ease: 'sineInOut' });
    const zwei = Math.random() < 0.5;
    const plaetze = zwei ? [-55, 55] : [0];
    for (const dx of plaetze) {
      const ei = this.neuesEi(null, v.x + dx, v.y - 10, s.zIndex - 1, { sofort: true, gold: Math.random() < 0.25 });
      ei.eventMode = 'none';
      ei.visible = false;
      this.versteckte.push(ei);
    }
    this.mausDrin = this.runde > 1 && Math.random() < 0.35;
  }

  suchenBeginnt() {
    this.gesucht = true;
    this.phase = 'suchen';
    this.stroh.eventMode = 'static';
    // die Hennen schauen zum Stroh, eine denkt an ein Ei
    this.hennen.forEach((h, i) => this.after(0.3 + i * 0.3, () => { if (!h.destroyed) h.lookAt(this.stroh.x); }));
    const h = pick(this.hennen);
    this.after(1.0, () => { if (!h.destroyed && !h._blase) h.bubble('bauernhof/ei', 2.4, blasenSeite(h)); });
    this.wackelZeit = 0.8;
    if (this.aktiv) this._hinweis = this.after(2.0, () => this.hinweisAnbieten());
  }

  strohWeg() {
    if (this.phase !== 'suchen') return;
    const s = this.stroh;
    s.eventMode = 'none';
    this.burst('staub', s.x, s.y - 40, { count: 6 });
    ton('common/rascheln', { vol: 0.6, abstand: 0.3 });
    this.tween(s, { alpha: 0 }, 0.5, { ease: 'sineInOut' }).then((ok) => { if (ok && !s.destroyed) s.visible = false; });
    const sch = this.strohSchatten;
    this.tween(sch, { alpha: 0 }, 0.6, { ease: 'sineInOut' }).then((ok) => { if (ok && !sch.destroyed) sch.visible = false; });
    for (const e of this.versteckte) {
      if (e.destroyed) continue;
      e.visible = true;
      e.eventMode = 'static';
      fx.pop(e, 0.1);
      if (e.gold) this.burst('funkeln', e.x, e.y - 70, { count: 4 });
    }
    ton('common/funkeln', { vol: 0.45 });
    if (this.mausDrin) this.mausHuscht(s.x, s.y);
    this.phase = 'legen';
    for (const h of this.hennen) if (!h.destroyed) h.nod();
  }

  // Überraschung: eine kleine Maus huscht aus dem Stroh und läuft davon
  async mausHuscht(x, y) {
    const skala = 170 / (meta('tiere/maus_idle').h || 900);
    const m = new Actor('maus', { x, y: y + 6, scale: 0, parent: this.welt, z: tiefe(y) + 1 });
    m.eventMode = 'none';
    await this.tween(m, { scale: skala }, 0.35, { ease: 'backOut' });
    laut('maus', 1);
    await m.hop(40);
    const ziel = x < 0 ? -1500 : 1500;
    await m.walkTo(ziel, y + 6, { tempo: 380 });
    if (!m.destroyed) m.destroy({ children: true });
  }

  // ---------------------------------------------------------------- Brüten und Küken

  // Eine Henne setzt sich auf ein Ei: es wackelt – dreimal antippen, dann schlüpft ein Küken
  brueten() {
    const frei = this.hennen.filter((h) => !h.destroyed && !h.slot.kueken);
    const h = pick(frei.length ? frei : this.hennen);
    const slot = h.slot;
    if (slot.ei && !slot.ei.destroyed) { slot.ei.ziehen?.off(); slot.ei.destroy(); }
    slot.ei = null;
    const ei = this.bild('bauernhof/ei', slot.mulde.x, slot.mulde.y, 0, 41);
    ei.brutKnacks = 0;
    this.brutEi = ei;
    this.brutHenne = h;
    // Risse (erscheinen nach und nach)
    const riss = new PIXI.Graphics()
      .moveTo(-38, -70).lineTo(-18, -86).lineTo(-4, -68).lineTo(14, -88).lineTo(30, -72)
      .stroke({ width: 6, color: 0x8a6a4a, cap: 'round', join: 'round' });
    riss.alpha = 0;
    ei.addChild(riss);
    ei.riss = riss;
    h.pose('sleep');      // sie kuschelt sich hin
    ton('common/plopp', { vol: 0.6 });
    this.tween(ei, { scale: EI_SKALA * 1.05 }, 0.45, { ease: 'backOut' });
    tap(ei, () => this.knacken(ei), { sound: null, squash: false, pad: 70 });
    this.phase = 'brueten';
    this.brutWackel = 1;
  }

  async knacken(ei) {
    if (ei.destroyed || ei.schluepft || this.phase !== 'brueten') return;
    ei.brutKnacks++;
    ton('common/klack', { vol: 0.5, abstand: 0.15 });
    this.tween(ei, { rotation: 0.16 }, 0.14, { ease: 'sineInOut', yoyo: true, repeat: 1 });
    this.tween(ei.riss, { alpha: Math.min(1, ei.brutKnacks / 2) }, 0.3, { ease: 'sineInOut' });
    ei.riss.scale.set(0.7 + 0.3 * Math.min(1, ei.brutKnacks / 2));
    if (ei.brutKnacks < 3) return;
    ei.schluepft = true;
    ei.eventMode = 'none';
    await this.wait(0.45);
    if (ei.destroyed) return;
    const { x, y } = ei;
    ei.destroy({ children: true });
    this.brutEi = null;
    const h = this.brutHenne;
    if (h && !h.destroyed) h.pose('happy');
    // … ein Küken schlüpft (im Nest, vor der Henne)
    const k = this.bild('bauernhof/kueken', x, y, 0, 41);
    ton('common/kueken', { vol: 0.8, abstand: 0.3 });
    this.burst('funkeln', x, y - 80, { count: 5 });
    await this.tween(k, { scale: KUEKEN_NEST }, 0.5, { ease: 'backOut' });
    if (h && !h.destroyed) { h.nod(); this.burst('herzen', h.x, h.y - 300, { count: 4 }); }
    await this.wait(0.9);
    if (k.destroyed) return;
    if (h && !h.destroyed) h.pose('idle');
    this.kuekenInsStroh(k, false);
    store.set(KUEKEN_KEY, this.familie.length);
    await this.wait(2.0);
    this.abend();
  }

  // Ein Küken kommt zur Familie ins Stroh (k = schon sichtbares Küken, sonst ein neues); ist die Familie groß,
  // hüpft das älteste davon (es ist jetzt groß genug)
  async kuekenInsStroh(k, sofort) {
    if (this.familie.length >= KUEKEN_PLAETZE.length) {
      const alt = this.familie.shift();
      alt.eventMode = 'none';
      alt.scale.x = -Math.abs(alt.scale.y);
      ton('common/kueken', { vol: 0.4, abstand: 0.6 });
      bogenFlug(this, alt, alt.x - 260, KUEKEN_BODEN, { dauer: 0.7, hoehe: 60 }).then(() => {
        if (!alt.destroyed) this.tween(alt, { alpha: 0 }, 0.6).then(() => { if (!alt.destroyed) alt.destroy(); });
      });
      // alle rücken einen Platz nach links – nacheinander (höchstens zwei kleine Hüpfer zugleich)
      this.familie.forEach((f, i) => {
        f.platzNr = i;
        this.after(0.75 + i * 0.55, () => {
          if (!f.destroyed && f.platzNr === i) bogenFlug(this, f, KUEKEN_PLAETZE[i], KUEKEN_BODEN, { dauer: 0.5, hoehe: 40 });
        });
      });
    }
    const nr = this.familie.length;
    const zielX = KUEKEN_PLAETZE[nr];
    if (!k) k = this.bild('bauernhof/kueken', zielX, KUEKEN_BODEN, KUEKEN_BODEN_SKALA, tiefe(KUEKEN_BODEN));
    k.platzNr = nr;
    k.piepZeit = rand(3, 8);
    this.familie.push(k);
    // große Tippfläche (Bildpunkte des Kükens; bei 0,62 etwa 220 Einheiten breit)
    tap(k, () => this.kuekenPiept(k), { sound: null, squash: true, hitArea: new PIXI.Circle(0, -150, 180) });
    if (sofort) return;
    ton('common/hupf', { vol: 0.5, abstand: 0.2 });
    k.zIndex = FLUG_Z;
    if (!(await bogenFlug(this, k, zielX, KUEKEN_BODEN, { dauer: 1.1, hoehe: 300, skala: KUEKEN_BODEN_SKALA, tempo: EI_TEMPO }))) return;
    if (k.destroyed) return;
    k.zIndex = tiefe(KUEKEN_BODEN);
    ton('common/landen', { vol: 0.4, abstand: 0.2 });
    this.burst('staub', k.x, k.y - 10, { count: 3 });
  }

  kuekenPiept(k) {
    if (k.destroyed) return;
    ton('common/kueken', { vol: 0.7, abstand: 0.3 });
    this.huepfer(k);
    this.burst('herzen', k.x, k.y - 200, { count: 2 });
  }

  huepfer(k) {
    if (k.huepft || k.destroyed) return;
    k.huepft = true;
    this.tween(k, { y: KUEKEN_BODEN - 34 }, 0.16, { ease: 'quadOut' }).then((ok) => {
      if (!ok || k.destroyed) { k.huepft = false; return; }
      this.tween(k, { y: KUEKEN_BODEN }, 0.3, { ease: 'bounceOut' }).then(() => { k.huepft = false; });
    });
  }

  // Abend: Hennen schlafen ein, dann beginnt die nächste Runde
  async abend() {
    this.phase = 'abend';
    for (const h of this.hennen) {
      if (h.destroyed) continue;
      h.pose('sleep');
      await this.wait(0.5);
    }
    await this.wait(1.2);
    this.neueRunde(false);
  }

  // ---------------------------------------------------------------- Katze schleicht vorbei

  async katzeKommt() {
    if (this.katze) return;
    const skala = 330 / (meta('tiere/katze_idle').h || 900);
    const von = Math.random() < 0.5 ? -1 : 1;
    const k = new Actor('katze', { x: von * 1500, y: 1330, scale: skala, parent: this.welt, z: tiefe(1330) });
    this.katze = k;
    k.onTap(() => { laut('katze', 1.2); k.hop(40); });
    await k.walkTo(von * 260, 1330, { tempo: 170 });
    if (k.destroyed) return;
    k.lookAt(0);
    laut('katze', 2);
    await this.wait(2.2);
    if (k.destroyed) return;
    // der Hahn plustert sich auf, die Katze schlendert weiter
    fx.wobble(this.hahn, 0.05);
    this.hahn.hop(50);
    await this.wait(0.6);
    await k.walkTo(-von * 1500, 1330, { tempo: 190 });
    if (!k.destroyed) k.destroy({ children: true });
    this.katze = null;
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
    // schlafende Hennen: ab und zu ein langsames Z
    if (this.phase === 'schlaf' || this.phase === 'abend') {
      this.zzzZeit -= dt;
      if (this.zzzZeit <= 0 && this.hennen.length) {
        this.zzzZeit = 1.6;
        const h = this.hennen[this.zzzNr++ % this.hennen.length];
        if (h && !h.destroyed) this.burst('zzz', h.x + (h.flip ? -50 : 50), h.y - 280, { count: 1 });
      }
    }
    // Such-Phase: der Strohhaufen raschelt ab und zu
    if (this.phase === 'suchen') {
      this.wackelZeit -= dt;
      if (this.wackelZeit <= 0) {
        this.wackelZeit = 3;
        fx.wobble(this.stroh, 0.05);
        if (this.szene.idle > 2) ton('common/rascheln', { vol: 0.3, abstand: 2 });
      }
    }
    // Brut-Ei wackelt ruhig
    if (this.phase === 'brueten' && this.brutEi && !this.brutEi.destroyed && !this.brutEi.schluepft) {
      this.brutWackel -= dt;
      if (this.brutWackel <= 0) {
        this.brutWackel = 2.4;
        this.tween(this.brutEi, { rotation: 0.1 }, 0.25, { ease: 'sineInOut', yoyo: true, repeat: 1 });
      }
    }
    // die Küken im Stroh piepen ab und zu und machen einen kleinen Hüpfer
    for (const k of this.familie) {
      if (k.destroyed) continue;
      k.piepZeit -= dt;
      if (k.piepZeit <= 0) {
        k.piepZeit = rand(6, 11);
        if (this.szene.idle > 1) {
          ton('common/kueken', { vol: 0.35, abstand: 2 });
          this.huepfer(k);
        }
      }
    }
    // ab und zu zieht eine Henne in ein anderes Nest (nur, wenn das Kind gerade nichts tut)
    if (this.phase === 'legen') {
      this.umzugZeit -= dt;
      if (this.umzugZeit <= 0) {
        this.umzugZeit = rand(16, 24);
        if (this.szene.idle > 3) this.umziehen();
      }
    }
    // Überraschung: die Katze schleicht vorbei
    this.katzeZeit -= dt;
    if (this.katzeZeit <= 0) {
      this.katzeZeit = rand(45, 70);
      if (this.szene.idle > 4 && (this.phase === 'legen' || this.phase === 'schlaf')) this.katzeKommt();
    }
  }

  hinweise() {
    switch (this.phase) {
      case 'schlaf':
        return [this.hahn];
      case 'suchen':
        return [this.stroh];
      case 'brueten': {
        if (this.brutEi && !this.brutEi.destroyed) return [this.brutEi];
        // das Küken schlüpft gerade: auf das jüngste Küken (antippen: es piept), sonst auf die Henne
        const k = this.familie[this.familie.length - 1];
        if (k && !k.destroyed) return [k];
        const h = this.brutHenne && !this.brutHenne.destroyed ? this.brutHenne : this.hennen.find((x) => !x.destroyed);
        return h ? [h] : [this.hahn];
      }
      case 'legen': {
        const liste = [];
        const eier = [...this.nester.map((s) => s.ei), ...this.versteckte]
          .filter((e) => e && !e.destroyed && e.visible && e.eventMode !== 'none');
        if (eier.length && !this.korbUnterwegs) liste.push({ von: eier[0], nach: this.korb });
        const henne = this.hennen.find((h) => !h.destroyed && !h.slot.ei && !h.slot.kueken);
        if (henne) liste.push(henne);
        if (!liste.length && this.hennen[0]) liste.push(this.hennen[0]);
        return liste;
      }
      default: {
        // kurze Übergänge (Korb fährt weg, Abend): auf eine Henne zeigen statt schon auf den Weg zur nächsten Seite
        const h = this.hennen.find((x) => !x.destroyed);
        return h ? [h] : [];
      }
    }
  }
}
