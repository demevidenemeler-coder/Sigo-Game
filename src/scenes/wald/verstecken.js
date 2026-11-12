// Seite 1 – Verstecken auf der Lichtung.
// Fünf Verstecke (Büsche, Stamm, Stumpf, Farn, Stein); hinter drei sitzt je ein Tierkind. Ab und zu raschelt ein
// Versteck oder Ohren schauen kurz hervor. Rechts warten die Mamas und schauen suchend umher.
// Antippen: Versteck wackelt; Kind dahinter hüpft heraus, läuft zur Mama, beide freuen sich. Leer: Blätter oder
// ein Schmetterling fliegen auf. Alle gefunden → Sticker, die Familien gehen, neue Runde mit neuen Verstecken.

import { spr, tex, sfx, voice, tap, fx, rand, pick, shuffle, killTweensOf, PIXI } from '../../engine/index.js';
import { Seite } from '../../gemeinsam/seiten.js';
import { belohne } from '../../gemeinsam/sticker.js';
import { Kind, mamaFuer, jubel, laut, geheZu, blase, tiefe, Schmetterling } from './deko.js';

const VERSTECKE = ['busch_gross', 'busch_beeren', 'baumstamm_hohl', 'baumstumpf_hoehle', 'farn', 'stein_gross'];
// Wie hoch das Versteck in der Mitte dicht ist (Anteil der Bildhöhe) – der Stamm ist dort viel niedriger als sein Ast
const DECKUNG = { busch_gross: 0.9, busch_beeren: 0.9, baumstamm_hohl: 0.6, baumstumpf_hoehle: 0.88, farn: 0.72, stein_gross: 0.85 };
const ARTEN = ['fuchs', 'hase', 'eule', 'igel', 'baer', 'eichhoernchen', 'reh'];
const KINDER_PRO_RUNDE = 3;
const VERSTECK_BREITE = 430;   // Breite eines Verstecks in Einheiten (vorn etwas größer)
const KIND_HOEHE = 235;        // Höhe eines Tierkinds (vorn)
const MAMA_HOEHE = 350;        // Höhe einer Mama
const SCHNITT = 14;            // so weit über dem Boden des Verstecks endet das Sichtfenster des Kinds
// Verstecke: Tiefe (y) aus den Punkten versteck1…5 des Hintergrunds (abwechselnd hinten/vorn), die x-Stellen enger
// nach links gerückt – rechts brauchen die drei Mamas mit ihren Kindern Platz. Das linke Versteck bleibt fast ganz im
// Kernbereich (x ≥ −1066).
const VERSTECK_X = [-900, -665, -430, -195, 40];
// Mamas (Szenen-Koordinaten): weit genug auseinander, dass jedes Kind vor seiner eigenen Mama Platz hat; frei vom
// Pfeil rechts (bis y 910) und von der Ecke unten rechts (ab x 1040, y 1360)
const MAMA_ORTE = [{ x: 375, y: 1235 }, { x: 650, y: 1255 }, { x: 925, y: 1240 }];
// Wo das Kind bei seiner Mama sitzt: vorn links von ihr (zu den Verstecken hin), ein wenig vor ihr
const BEI_MAMA = { dx: -75, dy: 95 };
// Nest auf dem Ast des linken Baums (Bild hg_lichtung: Ast bei etwa 570/160) – rechts neben der Ecke des
// Karten-Knopfs. Die Tippfläche reicht nur bis 70 Einheiten unter den oberen Rand (Systemgesten) und dafür nach unten.
const NEST = { x: -845, y: 156, skala: 0.36, oben: 75, unten: 310, halb: 150 };
const RASCHEL_PAUSE = 700;     // ms: so lange klingt ein Rascheln mindestens allein
const BLAETTER_PAUSE = 600;    // ms: Blätter-Teilchen höchstens so oft je Versteck
const STICKER_ART =(art) => (art === 'reh' ? 'wald_reh' : 'tier_' + art);

export class Verstecken extends Seite {
  static hg = 'wald/hg_lichtung';

  aufbau() {
    this.orte = [1, 2, 3, 4, 5].map((i) => {
      const p = this.punkt('versteck' + i, { x: 0, y: 1200 });
      return { x: VERSTECK_X[i - 1], y: p.y };
    });
    this.plaetze = [];
    this.familien = [];      // {mama, kind, art, ort, gefunden}
    this.letzteArten = [];
    this.wechselt = true;
    this.gucken = false;     // gerade schaut ein Kind hervor oder ein Versteck raschelt
    this.versteckeGetippt = 0; // wie oft das Kind schon ein Versteck angetippt hat (dann braucht es keinen Hinweis)
    this.schmetterlinge = [
      new Schmetterling(this, { x: -300, y: 760, bereich: { x0: -700, x1: 450, y0: 600, y1: 880 }, parent: this.welt }),
    ];
    this.neueRunde(true);

    // Vogelnest auf dem Ast des linken Baums: antippen → wackelt, es piept leise
    this.nest = spr('wald/nest_voegel', { x: NEST.x, y: NEST.y, scale: NEST.skala, parent: this.welt, z: 40 });
    this.nestPiep = 0;
    this.letztesRascheln = -1e9;
    const k = NEST.skala;
    const nestFlaeche = new PIXI.Rectangle(-NEST.halb / k, (NEST.oben - NEST.y) / k, (2 * NEST.halb) / k, (NEST.unten - NEST.oben) / k);
    tap(this.nest, () => {
      fx.wobble(this.nest, 0.06);
      const jetzt = performance.now();
      if (jetzt - this.nestPiep > 900) {
        this.nestPiep = jetzt;
        sfx('common/kueken', { vol: 0.45 });
      }
    }, { sound: null, squash: false, hitArea: nestFlaeche });

    // Lebenszeichen der Versteckten und suchende Mamas – nur, solange die Seite zu sehen ist
    this.every(4.5, () => { if (this.aktiv && !this.wechselt) this.lebenszeichen(); });
    this.every(6.5, () => { if (this.aktiv && !this.wechselt) this.mamasSuchen(); });
  }

  betreten() {
    if (this.besuche === 1) {
      voice('wald_hallo');
      // Der Hinweis „Tipp auf die Büsche" nur, wenn das Kind noch kein Versteck angetippt hat – auch nicht, wenn er
      // erst später an die Reihe kommt (nurWenn wird dann noch einmal gefragt)
      const nochNicht = () => this.aktiv && this.versteckeGetippt === 0;
      this.after(5, () => { if (nochNicht()) voice('wald_verstecken', { nurWenn: nochNicht }); });
    }
  }

  // ---------------------------------------------------------------- Runde

  neueRunde(sofort = false) {
    this.wechselt = true;
    // alte Verstecke weich weg
    for (const p of this.plaetze) {
      const c = p.c;
      c.eventMode = 'none';
      this.tween(c, { alpha: 0, scale: 0.85 }, 0.5, { ease: 'sineInOut' }).then(() => { if (!c.destroyed) c.destroy({ children: true }); });
    }
    this.plaetze = [];

    // neue Arten (möglichst andere als in der letzten Runde)
    const frisch = shuffle(ARTEN.filter((a) => !this.letzteArten.includes(a)));
    const arten = [...frisch, ...shuffle(this.letzteArten)].slice(0, KINDER_PRO_RUNDE);
    this.letzteArten = arten;
    const bilder = shuffle(VERSTECKE).slice(0, this.orte.length);
    const mitKind = shuffle(this.orte.map((_, i) => i)).slice(0, KINDER_PRO_RUNDE);

    this.familien = arten.map((art, i) => ({ art, ort: MAMA_ORTE[i], mama: null, kind: null, gefunden: false }));
    this.orte.forEach((ort, i) => {
      const fam = this.familien[mitKind.indexOf(i)] || null;
      const p = this.bauePlatz(ort, bilder[i], fam);
      this.plaetze.push(p);
      const c = p.c;
      const s = c.scale.x;
      c.alpha = 0;
      c.scale.set(s * 0.85);
      const verz = sofort ? 0 : 0.6 + i * 0.18;
      this.tween(c, { alpha: 1 }, 0.5, { ease: 'sineInOut', delay: verz });
      this.tween(c, { scale: s }, 0.6, { ease: 'backOut', delay: verz });
    });
    if (!sofort) this.after(0.7, () => sfx('common/plopp', { vol: 0.5 }));

    // Mamas kommen von rechts und stellen sich hin
    this.familien.forEach((fam, i) => {
      const f = tiefe(fam.ort.y, { y0: 1175, y1: 1330, f0: 0.92, f1: 1 });
      const mama = mamaFuer(fam.art, { x: sofort ? fam.ort.x : 1500 + i * 120, y: fam.ort.y, parent: this.welt });
      mama.scale.set((MAMA_HOEHE * f) / (mama.sprite.texture.height || 900));
      mama.zIndex = fam.ort.y;
      mama.flip = true; // schaut nach links zu den Verstecken
      fam.mama = mama;
      mama.onTap(() => this.tippMama(fam));
      if (!sofort) {
        mama.geht = true; // schon beim Warten auf den Start: Tippen lässt sie nur wackeln, nicht hüpfen
        this.after(1 + i * 0.5, () => geheZu(this, mama, fam.ort.x, fam.ort.y, { tempo: 280 })
          .then((ok) => { if (ok && !mama.destroyed && !fam.gefunden) mama.lookAt(mama.x - 100); }));
      }
    });
    this.after(sofort ? 0.3 : 2.5, () => { this.wechselt = false; });
  }

  bauePlatz(ort, bild, fam) {
    const f = tiefe(ort.y);
    const c = new PIXI.Container({ label: 'versteck:' + bild });
    c.position.set(ort.x, ort.y);
    c.zIndex = ort.y;
    this.welt.addChild(c);

    const id = 'wald/' + bild;
    const t = tex(id);
    const skala = (VERSTECK_BREITE * f) / (t.width || 700);
    const p = { c, ort, bild, f, fam, kind: null, maske: null, s: null, hv: t.height * skala };

    if (fam) {
      // Sichtfenster: alles oberhalb der Unterkante des Verstecks – darunter bleibt das Kind unsichtbar
      const maske = new PIXI.Graphics().rect(-600, -1600, 1200, 1600 - SCHNITT).fill(0xffffff);
      c.addChild(maske);
      const kind = new Kind(fam.art, { x: rand(-30, 30), y: 0, parent: c });
      const hk = KIND_HOEHE * f;
      kind.scale.set(hk / (kind.sprite.texture.height || 420));
      kind.mask = maske;
      kind.schatten.visible = false;
      const dicht = (DECKUNG[bild] ?? 0.8) * p.hv;
      kind.yVersteckt = hk - dicht + 0.28 * p.hv;   // Kopf gut unter der Oberkante
      kind.yGucken = hk - dicht - 60 * f;           // Ohren/Stirn schauen heraus
      kind.y = kind.yVersteckt;
      p.kind = kind;
      p.maske = maske;
      fam.kind = kind;
      fam.platz = p;
    }

    const s = spr(id, { parent: c, scale: skala });
    if (bild !== 'baumstumpf_hoehle' && Math.random() < 0.5) s.scale.x *= -1;
    p.s = s;
    // Tippfläche: Ellipse um das Bild (passt zu den runden Formen; Ecken bleiben für Nachbarn frei)
    const m = { ax: s.anchor.x, ay: s.anchor.y };
    const rand_ = 45 / skala;
    const flaeche = new PIXI.Ellipse((0.5 - m.ax) * t.width, (0.5 - m.ay) * t.height,
      t.width / 2 + rand_, t.height / 2 + rand_);
    tap(s, () => this.tippVersteck(p), { sound: null, squash: false, hitArea: flaeche });
    return p;
  }

  // ---------------------------------------------------------------- Antippen

  // Rascheln mit eigenem Entprellen: das Geräusch ist fast 2 s lang – schnelles Tippen soll kein Rauschen stapeln
  raschel(vol) {
    const jetzt = performance.now();
    if (jetzt - this.letztesRascheln < RASCHEL_PAUSE) return false;
    this.letztesRascheln = jetzt;
    sfx('common/rascheln', { vol });
    return true;
  }

  tippVersteck(p) {
    this.versteckeGetippt++;
    this.raschel(0.65);
    fx.wobble(p.s, 0.07);
    if (p.kind && !p.kind.raus) {
      this.kindRaus(p);
      return;
    }
    // leer: Blätter fliegen auf, manchmal ein Schmetterling – bei schnellem Tippen nur Wackeln
    const jetzt = performance.now();
    if (jetzt - (p.letzteBlaetter || -1e9) < BLAETTER_PAUSE) return;
    p.letzteBlaetter = jetzt;
    const oben = { x: p.ort.x, y: p.ort.y - p.hv * 0.75 };
    const flatterer = this.schmetterlinge.filter((s) => !s.destroyed);
    if (Math.random() < 0.45 && flatterer.length < 3) {
      const s = new Schmetterling(this, { x: oben.x, y: oben.y + 30, bereich: { x0: -700, x1: 450, y0: 600, y1: 880 }, parent: this.welt, groesse: 0.9 });
      s.fliegDavon(Math.random() < 0.5 ? -1 : 1);
      this.schmetterlinge.push(s);
      sfx('common/wusch', { vol: 0.25 });
    } else {
      this.burst('blaetter', oben.x, oben.y, { count: 5 });
    }
  }

  async kindRaus(p) {
    const kind = p.kind;
    const fam = p.fam;
    kind.raus = true;
    killTweensOf(kind, ['y']);
    // 1. hinter dem Versteck hoch (noch im Sichtfenster)
    await this.tween(kind, { y: -p.hv * 0.45 }, 0.26, { ease: 'quadOut' });
    if (kind.destroyed) return;
    // 2. aus dem Versteck heraus: in die Welt umhängen, dann nach vorn hüpfen
    const g = p.c.toGlobal(kind.position);
    const l = this.welt.toLocal(g);
    kind.mask = null;
    p.maske?.destroy();
    p.maske = null;
    this.welt.addChild(kind);
    kind.position.set(l.x, l.y);
    kind.zIndex = p.c.zIndex - 1;
    kind.sound();
    const vorn = { x: p.ort.x + rand(-40, 40), y: p.ort.y + 45 };
    this.after(0.3, () => { if (!kind.destroyed) { kind.zIndex = vorn.y; kind.schatten.visible = true; } });
    await kind.hopTo(vorn.x, vorn.y, { hoehe: 110, dauer: 0.55 });
    if (kind.destroyed) return;
    kind.schatten.visible = true;
    kind.zIndex = vorn.y;
    await kind.hop(50);
    // 3. zur Mama laufen (geheZu: kommt sicher an, auch wenn unterwegs etwas dazwischenkommt)
    const mama = fam.mama;
    const ziel = { x: fam.ort.x + BEI_MAMA.dx, y: fam.ort.y + BEI_MAMA.dy }; // vorn links vor der eigenen Mama
    if (mama && !mama.destroyed) mama.lookAt(kind.x);
    kind.laeuft = true;
    await geheZu(this, kind, ziel.x, ziel.y, { tempo: 330 });
    kind.laeuft = false;
    if (kind.destroyed) return;
    kind.zIndex = kind.y;
    // einander anschauen
    kind.lookAt(fam.ort.x);
    if (mama && !mama.destroyed) mama.lookAt(kind.x);
    // 4. Wiedersehen
    fam.gefunden = true;
    kind.onTap(() => jubel(this, kind));
    jubel(this, mama, { herzen: 6 });
    this.after(0.35, () => jubel(this, kind, { herzen: 0, laut: false }));
    if (this.familien.every((f) => f.gefunden)) this.rundeFertig();
  }

  tippMama(fam) {
    const mama = fam.mama;
    if (fam.gefunden) {
      jubel(this, mama);
      return;
    }
    fx.wobble(mama, 0.05);
    laut(mama);
    if (!mama.geht) this.denkt(fam, 2.2);
  }

  // Eine Mama denkt an ihr Kind. Immer nur eine Denkblase zur Zeit – die Mamas stehen eng, Blasen würden sich decken.
  denkt(fam, sek) {
    for (const f of this.familien) {
      const b = f.mama?._blase;
      if (f === fam || !b || b.destroyed) continue;
      killTweensOf(b, ['alpha', 'scale', 'scaleX', 'scaleY']);
      this.tween(b, { alpha: 0 }, 0.25, { ease: 'sineInOut' }).then(() => { if (!b.destroyed) b.destroy({ children: true }); });
    }
    blase(fam.mama, 'wald/baby_' + fam.art, sek);
  }


  // ---------------------------------------------------------------- Runde geschafft

  async rundeFertig() {
    if (this.wechselt) return;
    this.wechselt = true;
    await this.wait(1.3);
    voice('wald_gefunden');
    // Sticker: zuerst einer, den es noch nicht gibt (belohne entscheidet selbst, ob er neu ist)
    const arten = this.familien.map((f) => f.art);
    belohne(this, STICKER_ART(pick(arten)), 0, 640);
    await this.wait(3.2);
    // Familien gehen nach rechts aus dem Bild (nacheinander, ruhig). Tippt das Kind ein gehendes Tier an, wackelt
    // es nur und geht weiter; verschwinden darf es erst, wenn es wirklich draußen ist.
    const gehen = this.familien.map((fam, i) => (async () => {
      await this.wait(i * 0.45);
      const ziel = 1650 + i * 80;
      for (const t of [fam.mama, fam.kind]) {
        if (!t || t.destroyed) continue;
        geheZu(this, t, ziel + (t === fam.kind ? -120 : 0), t.y, { tempo: 300 }).then((ok) => {
          if (t.destroyed) return;
          if (ok) t.destroy({ children: true });
          else this.tween(t, { alpha: 0 }, 0.6, { ease: 'sineInOut' }).then(() => { if (!t.destroyed) t.destroy({ children: true }); });
        });
      }
    })());
    await Promise.all(gehen);
    await this.wait(1.2);
    this.neueRunde();
  }

  // ---------------------------------------------------------------- kleine Lebenszeichen

  lebenszeichen() {
    if (this.gucken) return;
    const versteckt = this.plaetze.filter((p) => p.kind && !p.kind.raus && !p.kind.destroyed);
    if (!versteckt.length) return;
    const p = pick(versteckt);
    this.gucken = true;
    if (Math.random() < 0.5) {
      // Versteck raschelt leise
      this.raschel(0.35);
      fx.wobble(p.s, 0.035);
      this.after(1, () => { this.gucken = false; });
      return;
    }
    // Ohren schauen kurz hervor
    const kind = p.kind;
    this.raschel(0.25);
    this.tween(kind, { y: kind.yGucken }, 0.55, { ease: 'sineInOut' })
      .then((ok) => (ok ? this.wait(1.3) : false))
      .then((ok) => {
        if (ok !== false && !kind.raus && !kind.destroyed) return this.tween(kind, { y: kind.yVersteckt }, 0.6, { ease: 'sineInOut' });
        return false;
      })
      .then(() => { this.gucken = false; });
  }

  mamasSuchen() {
    const wartend = this.familien.filter((f) => !f.gefunden && f.mama && !f.mama.destroyed && !f.mama.geht);
    wartend.forEach((fam, i) => {
      const mama = fam.mama;
      this.after(i * 0.7, () => {
        if (mama.destroyed || fam.gefunden || mama.geht) return;
        // mal hierhin, mal dorthin schauen
        mama.lookAt(mama.x + (mama.flip ? 100 : -100));
        this.after(1.4, () => { if (!mama.destroyed && !fam.gefunden && !mama.geht) mama.lookAt(mama.x - 100); });
      });
    });
    // eine Mama denkt an ihr Kind
    if (wartend.length && Math.random() < 0.5) {
      const fam = pick(wartend);
      if (!this.familien.some((f) => f.mama?._blase && !f.mama._blase.destroyed)) this.denkt(fam, 2.4);
    }
  }

  // ---------------------------------------------------------------- Ablauf

  update(dt) {
    for (const s of this.schmetterlinge) s.update(dt);
    if (this.schmetterlinge.some((s) => s.destroyed)) this.schmetterlinge = this.schmetterlinge.filter((s) => !s.destroyed);
    // laufende Kinder: vorne/hinten passend zur Tiefe
    for (const fam of this.familien) {
      if (fam.kind?.laeuft && !fam.kind.destroyed) fam.kind.zIndex = fam.kind.y;
    }
  }

  hinweise() {
    const versteckt = this.plaetze.filter((p) => p.kind && !p.kind.raus).map((p) => p.s);
    const mamas = this.familien.filter((f) => !f.gefunden && f.mama).map((f) => f.mama);
    return [...versteckt, ...mamas];
  }
}
