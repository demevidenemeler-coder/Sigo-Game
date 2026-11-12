// Seite 1 – Verstecken auf der Lichtung: Spuren suchen, Tierkind finden, zur Mama bringen, Familienfoto.
//
// Eine Runde: Drei Mamas kommen und vermissen ihr Kind (Denkblase). Für jede Familie ein kleiner Ablauf:
//   1. Mama antippen – sie schnuppert, eine Spur aus Abdrücken beginnt (Pfote, Tatze, Huf, Vogelfüße … je Tier).
//   2. Spur folgen – der nächste Abdruck leuchtet sanft; antippen → Ton, die Mama geht hin, der nächste erscheint.
//   3. Am Versteck: jedes Versteck öffnet sich mit seiner eigenen Geste – Busch, Farn, Stamm, Stumpf: zweimal
//      antippen (erst schauen die Ohren heraus); Stein: zur Seite schieben; Laubhaufen: wegwischen.
//   4. Das Kind hüpft heraus – zur Mama ziehen (oder antippen, dann läuft es selbst). Wiedersehen mit Herzen.
//   5. Die Familie stellt sich auf ihren Platz rechts.
// Sind alle drei Familien zusammen: 6. Kamera antippen → Familienfoto. Das Foto hängt sich an die Leine oben
// (sie füllt sich über die Runden und bleibt gespeichert), es gibt einen Sticker, die Familien gehen, neue Runde.
// Abwechslung: andere Tiere, Verstecke, Spurwege jede Runde; leere Verstecke rascheln, lassen Blätter oder einen
// Schmetterling auffliegen, manchmal liegt ein kleiner Fund darin. Nichts kann falsch gehen: Jedes Versteck mit
// Kind darf man auch ohne Spur öffnen, jedes Kind findet zu seiner Mama.

import { stage, spr, tex, sfx, note, animal, voice, tap, drag, wipe, fx, store, rand, pick, shuffle, killTweensOf, PIXI } from '../../engine/index.js';
import { Seite } from '../../gemeinsam/seiten.js';
import { belohne } from '../../gemeinsam/sticker.js';
import { Kind, mamaFuer, jubel, laut, geheZu, blase, tiefe, Schmetterling, bogen, figurFlaeche, spurSchritt, waehleArten, waehleSticker } from './deko.js';

// Versteck-Bilder und wie sie sich öffnen
const VERSTECKE = {
  busch_gross: 'tippen', busch_beeren: 'tippen', farn: 'tippen', baumstamm_hohl: 'tippen',
  baumstumpf_hoehle: 'tippen', stein_gross: 'schieben', laubhaufen: 'wischen',
};
// Wie hoch das Versteck in der Mitte dicht ist (Anteil der Bildhöhe) – der Stamm ist dort viel niedriger als sein Ast
const DECKUNG = { busch_gross: 0.9, busch_beeren: 0.9, baumstamm_hohl: 0.6, baumstumpf_hoehle: 0.88, farn: 0.72, stein_gross: 0.85, laubhaufen: 0.86 };
const BREITE_FAKTOR = { laubhaufen: 1.12 };   // der Laubhaufen ist flach – etwas breiter, damit ein Kind hineinpasst
const ARTEN = ['fuchs', 'hase', 'eule', 'igel', 'baer', 'eichhoernchen', 'reh'];
const KINDER_PRO_RUNDE = 3;
const VERSTECK_BREITE = 430;   // Breite eines Verstecks in Einheiten (vorn etwas größer)
const KIND_HOEHE = 235;        // Höhe eines Tierkinds (vorn)
const MAMA_HOEHE = 350;        // Höhe einer Mama
const SCHNITT = 14;            // so weit über dem Boden des Verstecks endet das Sichtfenster des Kinds
// Verstecke: Tiefe (y) aus den Punkten versteck1…5 des Hintergrunds, x-Stellen nach links gerückt – rechts stehen
// die drei Mamas mit ihren Kindern.
const VERSTECK_X = [-900, -665, -430, -195, 40];
// Mamas (Szenen-Koordinaten): frei vom Pfeil rechts (bis y 910) und von der Ecke unten rechts (ab x 1040, y 1360)
const MAMA_ORTE = [{ x: 375, y: 1235 }, { x: 650, y: 1255 }, { x: 925, y: 1240 }];
const BEI_MAMA = { dx: -75, dy: 95 };   // wo das Kind bei seiner Mama sitzt
// so weit rechts darf ein Kind höchstens aus seinem Versteck hüpfen (links vom Kind der ersten Familie, mit Abstand)
const KIND_RAUS_MAX_X = MAMA_ORTE[0].x + BEI_MAMA.dx - 240;
// Nest auf dem Ast des linken Baums (Bild hg_lichtung: Ast bei etwa 570/160)
const NEST = { x: -845, y: 156, skala: 0.36, oben: 75, unten: 310, halb: 150 };
// Spur: Abstand der Schritte, Tippfläche, tiefste Stelle
const SPUR_ABSTAND = 265;
const SPUR_TIPP = 125;         // Radius der Tippfläche eines Abdrucks (250 breit)
const SPUR_UNTEN = 1495;
const SPUR_TOENE = [72, 74, 76, 79, 81, 84];   // aufsteigend, je Schritt ein Ton
// Fotoleine oben zwischen den Bäumen (frei von Karten- und Album-Knopf)
const LEINE = { x0: -600, x1: 620, y: 168, durchhang: 70 };
const FOTO_PLAETZE = 5;
const FOTO_SPEICHER = 'wald.fotos';
const KAMERA = { x: -250, y: 760 };
const RASCHEL_PAUSE = 700;     // ms: so lange klingt ein Rascheln mindestens allein
const BLAETTER_PAUSE = 600;    // ms: Blätter-Teilchen höchstens so oft je Versteck
const FUNDE = ['eichel', 'pilz_rot', 'tannenzapfen', 'kastanie', 'pilz_braun'];
const STICKER_ART = (art) => (art === 'reh' ? 'wald_reh' : 'tier_' + art);
const ARTEN_SPEICHER = 'wald.zuletzt.verstecken';   // wann welche Art zuletzt dran war (Abwechslung)
const RAND_DRAUSSEN = 1460;    // ab hier ist eine gehende Figur aus dem Bild (Tablet: sichtbar bis 1280) – dann geht das nächste Paar

export class Verstecken extends Seite {
  static hg = 'wald/hg_lichtung';

  aufbau() {
    this.orte = [1, 2, 3, 4, 5].map((i) => {
      const p = this.punkt('versteck' + i, { x: 0, y: 1200 });
      return { x: VERSTECK_X[i - 1], y: p.y };
    });
    this.plaetze = [];
    this.familien = [];      // {art, ort, mama, kind, platz, schritt, spur}
    this.letzteBilder = [];
    this.wechselt = true;
    this.gucken = false;     // gerade schaut ein Kind hervor oder ein Versteck raschelt
    this.spurFam = null;     // Familie, deren Spur gerade läuft
    this.fund = null;        // kleiner Fund vor einem leeren Versteck
    this.kamera = null;
    this.letztesRascheln = -1e9;
    this.schmetterlinge = [
      new Schmetterling(this, { x: -300, y: 760, bereich: { x0: -700, x1: 450, y0: 600, y1: 880 }, parent: this.welt }),
    ];
    this.baueLeine();
    this.neueRunde(true);

    // Vogelnest auf dem Ast des linken Baums: antippen → wackelt, es piept leise
    this.nest = spr('wald/nest_voegel', { x: NEST.x, y: NEST.y, scale: NEST.skala, parent: this.welt, z: 40 });
    this.nestPiep = 0;
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
    if (this.besuche === 1) voice('wald_hallo');
  }

  // ---------------------------------------------------------------- Runde

  neueRunde(sofort = false) {
    this.wechselt = true;
    this.spurFam = null;
    for (const p of this.plaetze) {
      const c = p.c;
      c.eventMode = 'none';
      p.wisch?.off();
      p.schieb?.off();
      this.tween(c, { alpha: 0, scale: 0.85 }, 0.5, { ease: 'sineInOut' }).then(() => { if (!c.destroyed) c.destroy({ children: true }); });
    }
    this.plaetze = [];

    // neue Arten: die, die am längsten nicht dran waren (so kommt jedes Tier regelmäßig)
    const arten = waehleArten(ARTEN, KINDER_PRO_RUNDE, ARTEN_SPEICHER);
    // Verstecke: fünf verschiedene; jede Runde mindestens eines mit eigener Geste (Stein oder Laubhaufen) mit Kind
    const alle = Object.keys(VERSTECKE);
    const besonders = shuffle(['stein_gross', 'laubhaufen']);
    let bilder = shuffle(alle.filter((b) => !besonders.includes(b))).slice(0, 3);
    bilder = shuffle([...bilder, ...besonders]);
    // nicht dieselben Bilder an denselben Stellen wie zuletzt
    if (bilder.every((b, i) => this.letzteBilder[i] === b)) bilder.reverse();
    this.letzteBilder = bilder;
    const besondersIdx = bilder.findIndex((b) => VERSTECKE[b] !== 'tippen');
    const rest = shuffle(this.orte.map((_, i) => i).filter((i) => i !== besondersIdx));
    const mitKind = shuffle([besondersIdx, ...rest.slice(0, KINDER_PRO_RUNDE - 1)]);

    this.familien = arten.map((art, i) => ({ art, ort: MAMA_ORTE[i], mama: null, kind: null, platz: null, schritt: 'wartet', spur: null }));
    this.orte.forEach((ort, i) => {
      const fam = this.familien[mitKind.indexOf(i)] || null;
      const p = this.bauePlatz(ort, bilder[i], fam);
      this.plaetze.push(p);
      const c = p.c;
      c.alpha = 0;
      c.scale.set(0.85);
      const verz = sofort ? 0 : 0.6 + i * 0.18;
      this.tween(c, { alpha: 1 }, 0.5, { ease: 'sineInOut', delay: verz });
      this.tween(c, { scale: 1 }, 0.6, { ease: 'backOut', delay: verz });
    });
    if (!sofort) this.after(0.7, () => sfx('common/plopp', { vol: 0.5 }));

    // Mamas kommen von rechts und stellen sich hin – höchstens zwei laufen zugleich: die erste (weitester Weg) geht
    // los, die zweite kurz danach, die dritte erst, wenn die erste angekommen ist
    const ankunft = [];
    this.familien.forEach((fam, i) => {
      const f = tiefe(fam.ort.y, { y0: 1175, y1: 1330, f0: 0.92, f1: 1 });
      const mama = mamaFuer(fam.art, { x: sofort ? fam.ort.x : 1500 + i * 120, y: fam.ort.y, parent: this.welt });
      mama.scale.set((MAMA_HOEHE * f) / (mama.sprite.texture.height || 900));
      mama.zIndex = fam.ort.y;
      mama.flip = true; // schaut nach links zu den Verstecken
      fam.mama = mama;
      mama.onTap(() => this.tippMama(fam));
      if (sofort) { ankunft[i] = Promise.resolve(true); return; }
      mama.geht = true;
      ankunft[i] = (async () => {
        await this.wait(0.8);
        if (i === 1) await this.wait(1.3);
        if (i >= 2) { await ankunft[i - 2]; await this.wait(0.2); }
        const ok = await geheZu(this, mama, fam.ort.x, fam.ort.y, { tempo: 300 });
        if (ok && !mama.destroyed && fam.schritt === 'wartet') mama.lookAt(mama.x - 100);
        return ok;
      })();
    });
    // los geht es, sobald die erste Mama steht: sie zeigt, wen sie vermisst
    ankunft[0].then(() => this.wait(sofort ? 0.3 : 0.2)).then(() => {
      this.wechselt = false;
      const erste = this.naechsteFamilie();
      if (erste && this.aktiv) this.denkt(erste, 2.6);
    });
  }

  bauePlatz(ort, bild, fam) {
    const f = tiefe(ort.y);
    const c = new PIXI.Container({ label: 'versteck:' + bild });
    c.position.set(ort.x, ort.y);
    c.zIndex = ort.y;
    this.welt.addChild(c);

    const id = 'wald/' + bild;
    const t = tex(id);
    const skala = (VERSTECK_BREITE * f * (BREITE_FAKTOR[bild] ?? 1)) / (t.width || 700);
    const art = VERSTECKE[bild];
    const p = { c, ort, bild, art, f, fam, kind: null, maske: null, s: null, hv: t.height * skala, tipps: 0, offen: false };

    if (fam) {
      // Sichtfenster: alles oberhalb der Unterkante des Verstecks – darunter bleibt das Kind unsichtbar
      const maske = new PIXI.Graphics().rect(-600, -1600, 1200, 1600 - SCHNITT).fill(0xffffff);
      c.addChild(maske);
      p.maske = maske;
      const kind = new Kind(fam.art, { x: rand(-30, 30), y: 0, parent: c });
      const hk = KIND_HOEHE * f;
      kind.scale.set(hk / (kind.sprite.texture.height || 420));
      kind.mask = maske;
      kind.schatten.visible = false;
      const dicht = (DECKUNG[bild] ?? 0.8) * p.hv;
      kind.yVersteckt = hk - dicht + 0.28 * p.hv;   // Kopf gut unter der Oberkante
      if (bild === 'laubhaufen') kind.yVersteckt = hk - dicht + 0.12 * p.hv;   // sitzt im Laub (wird freigewischt)
      kind.yGucken = hk - dicht - 60 * f;           // Ohren/Stirn schauen heraus
      kind.y = kind.yVersteckt;
      p.kind = kind;
      fam.kind = kind;
      fam.platz = p;
    }

    const s = spr(id, { parent: c, scale: skala });
    if (bild !== 'baumstumpf_hoehle' && Math.random() < 0.5) s.scale.x *= -1;
    p.s = s;
    // Tippfläche: Ellipse um das Bild (passt zu den runden Formen; Ecken bleiben für Nachbarn frei)
    const rand_ = 45 / skala;
    const flaeche = new PIXI.Ellipse((0.5 - s.anchor.x) * t.width, (0.5 - s.anchor.y) * t.height,
      t.width / 2 + rand_, Math.max(t.height / 2 + rand_, 125 / skala));

    if (art === 'wischen') {
      p.wisch = wipe(s, {
        radius: 125,
        doneAt: 0.72,
        hitArea: flaeche,
        onProgress: (q) => this.wischt(p, q),
        onDone: () => this.freigewischt(p),
      });
    } else if (art === 'schieben') {
      p.schieb = drag(s, {
        hitArea: flaeche,
        lift: 1.04,
        sound: null,
        onStart: () => { this.raschel(0.4); this.tippVersteck(p, { nurGucken: true }); },
        onMove: (_, ctx) => {
          s.y = ctx.startY;                                   // nur waagrecht
          s.x = Math.max(ctx.startX - 300, Math.min(ctx.startX + 300, s.x));
        },
        onDrop: (_, ctx) => this.losgelassenStein(p, ctx),
      });
    } else {
      tap(s, (e) => this.tippVersteck(this.umleiten(p, e)), { sound: null, squash: false, hitArea: flaeche });
    }
    return p;
  }

  // ---------------------------------------------------------------- Familien

  // die nächste Familie, die noch wartet (die Hand zeigt auf ihre Mama)
  naechsteFamilie() {
    return this.familien.find((f) => f.schritt === 'wartet' && f.mama && !f.mama.destroyed) || null;
  }

  tippMama(fam) {
    const mama = fam.mama;
    if (!mama || mama.destroyed) return;
    if (fam.schritt === 'fertig' || fam.schritt === 'zusammen') {
      jubel(this, mama);
      return;
    }
    fx.wobble(mama, 0.05);
    laut(mama);
    if (fam.schritt === 'wartet' && !this.spurFam && !this.wechselt && !mama.geht) {
      this.starteSpur(fam);
      return;
    }
    if (!mama.geht) this.denkt(fam, 2.2);
  }

  // Eine Mama denkt an ihr Kind. Immer nur eine Denkblase zur Zeit – die Mamas stehen eng.
  denkt(fam, sek) {
    for (const f of this.familien) {
      const b = f.mama?._blase;
      if (f === fam || !b || b.destroyed) continue;
      killTweensOf(b, ['alpha', 'scale', 'scaleX', 'scaleY']);
      this.tween(b, { alpha: 0 }, 0.25, { ease: 'sineInOut' }).then(() => { if (!b.destroyed) b.destroy({ children: true }); });
    }
    blase(fam.mama, 'wald/baby_' + fam.art, sek);
  }

  // ---------------------------------------------------------------- Spur

  // Weg der Spur: vorn links vor der Mama bis vorn rechts vor das Versteck, als weicher Bogen über den Boden
  spurPunkte(fam) {
    const ziel = fam.platz.ort;
    const a = { x: fam.mama.x - 150, y: Math.min(SPUR_UNTEN, fam.ort.y + 150) };
    const b = { x: ziel.x + 165, y: Math.min(SPUR_UNTEN, ziel.y + 85) };
    const k = { x: (a.x + b.x) / 2 + rand(-120, 120), y: Math.max(a.y, b.y) + rand(20, 110) };
    const laenge = Math.hypot(b.x - a.x, b.y - a.y) + 60;
    const n = Math.max(3, Math.min(6, Math.round(laenge / SPUR_ABSTAND)));
    const punkte = [];
    for (let i = 0; i < n; i++) {
      const t = n === 1 ? 1 : i / (n - 1);
      let x = (1 - t) * (1 - t) * a.x + 2 * (1 - t) * t * k.x + t * t * b.x;
      let y = (1 - t) * (1 - t) * a.y + 2 * (1 - t) * t * k.y + t * t * b.y;
      // nie hinter oder in einem Versteck: vor jedem Versteck in der Nähe bleiben
      for (const o of this.orte) {
        if (Math.abs(x - o.x) < 260) y = Math.max(y, o.y + 85);
      }
      y = Math.min(SPUR_UNTEN, y);
      x = Math.max(-1000, Math.min(980, x));
      punkte.push({ x, y });
    }
    return punkte;
  }

  starteSpur(fam) {
    if (!fam.platz || fam.platz.offen) return;
    this.spurFam = fam;
    fam.schritt = 'spur';
    const mama = fam.mama;
    mama.nod();
    const punkte = this.spurPunkte(fam);
    fam.spur = punkte.map((p, i) => {
      const nach = punkte[i + 1] || { x: fam.platz.ort.x, y: fam.platz.ort.y + 40 };
      const vor = punkte[i - 1] || { x: mama.x, y: mama.y };
      const w = i < punkte.length - 1 ? Math.atan2(nach.y - p.y, nach.x - p.x) : Math.atan2(p.y - vor.y, p.x - vor.x);
      const s = spurSchritt(fam.art, w, tiefe(p.y, { y0: 1170, y1: 1480, f0: 1.7, f1: 2.1 }));
      s.position.set(p.x, p.y);
      s.zIndex = p.y - 40;   // flach auf dem Boden: Figuren, die darauf stehen, liegen davor
      s.alpha = 0;
      s.eventMode = 'none';
      s.nr = i;
      this.welt.addChild(s);
      tap(s, () => this.tippSpur(fam, s), { sound: null, squash: false, hitArea: new PIXI.Circle(0, 0, SPUR_TIPP) });
      s.eventMode = 'none';
      return s;
    });
    fam.spurNr = 0;
    sfx('common/rascheln', { vol: 0.3 });
    this.after(0.4, () => this.zeigeSpur(fam, 0));
    voice('wald_spur', { nurWenn: () => this.aktiv && this.spurFam === fam && fam.spurNr === 0 });
  }

  // Schritt n der Spur erscheint und leuchtet sanft (atmet langsam – kein Blinken)
  zeigeSpur(fam, n) {
    const s = fam.spur?.[n];
    if (!s || s.destroyed) return;
    s.eventMode = 'static';
    // der leuchtende Abdruck liegt obenauf: steht eine Figur darauf, geht der Tipp trotzdem an die Spur
    s.zIndex = 3000;
    this.tween(s, { alpha: 1 }, 0.6, { ease: 'sineInOut' });
    s.schein.alpha = 0;
    s.leuchten = this.tween(s.schein, { alpha: 0.75 }, 0.9, { ease: 'sineInOut', yoyo: true, repeat: -1 });
  }

  tippSpur(fam, s) {
    if (this.spurFam !== fam || s.nr !== fam.spurNr || s.getaucht) return;
    s.getaucht = true;
    s.eventMode = 'none';
    s.zIndex = s.y - 40;
    s.leuchten?.kill();
    this.tween(s.schein, { alpha: 0 }, 0.5, { ease: 'sineInOut' });
    fx.pop(s, 0.15);
    note('xylo', SPUR_TOENE[Math.min(s.nr, SPUR_TOENE.length - 1)], { vol: 0.45 });
    fam.spurNr++;
    const letzte = fam.spurNr >= fam.spur.length;
    // Die Mama geht der Spur nach – aber nicht ganz bis ans Versteck (das Kind soll noch ein Stück zu ihr kommen)
    const ziel = fam.platz.ort;
    const mama = fam.mama;
    if (Math.hypot(s.x - ziel.x, s.y - ziel.y) > 400 && mama && !mama.destroyed) {
      geheZu(this, mama, s.x + 40, s.y - 10, { tempo: 300 }).then((ok) => {
        if (ok && !mama.destroyed && fam.schritt !== 'zusammen') mama.lookAt(ziel.x);
      });
    }
    if (!letzte) {
      this.after(0.3, () => this.zeigeSpur(fam, fam.spurNr));
      return;
    }
    // Spur zu Ende: das Versteck raschelt, das Kind schaut ein wenig heraus
    this.spurFertig(fam);
  }

  spurFertig(fam) {
    if (fam.schritt !== 'spur') return;
    fam.schritt = 'versteck';
    this.spurFam = null;
    const p = fam.platz;
    this.after(0.35, () => {
      if (p.offen || p.kind?.raus) return;
      this.raschel(0.5);
      fx.wobble(p.s, 0.05);
      this.guckt(p, true);
      if (p.art === 'tippen') {
        voice('wald_verstecken', { nurWenn: () => this.aktiv && !p.offen && !p.kind?.raus });
      }
    });
  }

  // übrige Abdrücke einer Spur verblassen (Kind auf anderem Weg gefunden, neue Runde)
  spurWeg(fam, sofort = false) {
    for (const s of fam.spur || []) {
      if (s.destroyed) continue;
      s.eventMode = 'none';
      s.leuchten?.kill();
      this.tween(s, { alpha: 0 }, sofort ? 0.4 : 1.2, { ease: 'sineInOut', delay: sofort ? 0 : 1.5 })
        .then(() => { if (!s.destroyed) s.destroy({ children: true }); });
    }
    fam.spur = null;
    if (this.spurFam === fam) this.spurFam = null;
  }

  // ---------------------------------------------------------------- Verstecke öffnen

  // Rascheln mit eigenem Entprellen: das Geräusch ist fast 2 s lang – schnelles Tippen soll kein Rauschen stapeln
  raschel(vol) {
    const jetzt = performance.now();
    if (jetzt - this.letztesRascheln < RASCHEL_PAUSE) return false;
    this.letztesRascheln = jetzt;
    sfx('common/rascheln', { vol });
    return true;
  }

  // Ein Kind schaut aus seinem Versteck (bleiben = schaut weiter heraus, bis es herauskommt)
  guckt(p, bleiben) {
    const kind = p.kind;
    if (!kind || kind.raus || kind.destroyed) return;
    kind.guckt = bleiben;
    killTweensOf(kind, ['y']);
    this.tween(kind, { y: kind.yGucken }, 0.45, { ease: 'sineInOut' });
  }

  // Verstecke überlappen sich (hinten/vorn). Trifft ein Tipp auch das Versteck, an dem die Spur gerade endet,
  // gilt er diesem – dorthin zeigt auch die Hand.
  umleiten(p, e) {
    if (!e || p.fam?.schritt === 'versteck') return p;
    const q = this.plaetze.find((x) => x !== p && x.art === 'tippen' && x.fam?.schritt === 'versteck' && !x.offen &&
      Math.abs(e.x - x.ort.x) <= Math.abs(x.s.width) / 2 + 40 && e.y >= x.ort.y - x.hv - 50 && e.y <= x.ort.y + 20);
    return q || p;
  }

  tippVersteck(p, { nurGucken = false } = {}) {
    this.raschel(0.65);
    fx.wobble(p.s, 0.07);
    if (this.wechselt) {
      // Übergang oder Foto: das Versteck reagiert (Wackeln, Rascheln, ein paar Blätter), öffnet sich aber nicht
      const jetzt = performance.now();
      if (!nurGucken && jetzt - (p.letzteBlaetter || -1e9) > BLAETTER_PAUSE) {
        p.letzteBlaetter = jetzt;
        this.burst('blaetter', p.ort.x, p.ort.y - p.hv * 0.75, { count: 3 });
      }
      return;
    }
    if (p.kind && !p.kind.raus && !p.offen) {
      if (nurGucken || p.art !== 'tippen') {
        // Stein/Laub: ein Antippen lässt das Kind kurz gucken – geöffnet wird mit Schieben/Wischen
        this.guckt(p, p.fam?.schritt === 'versteck');
        if (p.fam?.schritt !== 'versteck') this.after(1.4, () => this.zurueckDucken(p));
        return;
      }
      p.tipps++;
      const oben = { x: p.ort.x, y: p.ort.y - p.hv * 0.75 };
      if (p.tipps === 1) {
        // erst schauen die Ohren heraus, ein paar Blätter fliegen
        this.burst('blaetter', oben.x, oben.y, { count: 4 });
        this.guckt(p, true);
        return;
      }
      this.kindRaus(p);
      return;
    }
    if (nurGucken) return;
    this.leerGetippt(p);
  }

  zurueckDucken(p) {
    const kind = p.kind;
    if (!kind || kind.raus || kind.destroyed || kind.guckt || p.offen) return;
    this.tween(kind, { y: kind.yVersteckt }, 0.6, { ease: 'sineInOut' });
  }

  // leer: Blätter fliegen auf, manchmal ein Schmetterling oder ein kleiner Fund – bei schnellem Tippen nur Wackeln
  leerGetippt(p) {
    const jetzt = performance.now();
    if (jetzt - (p.letzteBlaetter || -1e9) < BLAETTER_PAUSE) return;
    p.letzteBlaetter = jetzt;
    const oben = { x: p.ort.x, y: p.ort.y - p.hv * 0.75 };
    const flatterer = this.schmetterlinge.filter((s) => !s.destroyed);
    const z = Math.random();
    if (z < 0.4 && flatterer.length < 3) {
      const s = new Schmetterling(this, { x: oben.x, y: oben.y + 30, bereich: { x0: -700, x1: 450, y0: 600, y1: 880 }, parent: this.welt, groesse: 0.9 });
      s.fliegDavon(Math.random() < 0.5 ? -1 : 1);
      this.schmetterlinge.push(s);
      sfx('common/wusch', { vol: 0.25 });
    } else if (z < 0.62 && !this.fund) {
      this.fundHuepft(p);
    } else {
      this.burst('blaetter', oben.x, oben.y, { count: 5 });
    }
  }

  // Überraschung: ein kleiner Fund (Eichel, Pilz, Zapfen …) hüpft aus dem leeren Versteck
  fundHuepft(p) {
    const art = pick(FUNDE);
    const id = 'wald/' + art;
    const t = tex(id);
    const skala = 115 / Math.max(t.width, t.height, 1);
    const s = spr(id, { x: p.ort.x + rand(-40, 40), y: p.ort.y - p.hv * 0.4, scale: skala, parent: this.welt, z: p.ort.y + 60 });
    this.fund = s;
    sfx('common/plopp', { vol: 0.5 });
    // landet vor den Verstecken (sonst läge er hinter einem vorderen Versteck verdeckt)
    const ziel = this.freiVorn(s.x + rand(-60, 60), p.ort.y + 70);
    this.after(0.3, () => { if (!s.destroyed) s.zIndex = ziel.y + 1; });
    bogen(this, s, ziel, { dauer: 0.55, hoehe: 120 }).then(() => {
      if (s.destroyed) return;
      s.zIndex = s.y;
      tap(s, () => this.fundTipp(s), { sound: null, pad: 60 });
    });
    this.after(9, () => this.fundWeg(s));
  }

  fundTipp(s) {
    if (s.destroyed || s.weg) return;
    note('pling', pick([79, 84, 88]), { vol: 0.35 });
    this.burst('funkeln', s.x, s.y - 50, { count: 4 });
    this.tween(s, { y: s.y - 30 }, 0.2, { ease: 'quadOut', yoyo: true });
  }

  fundWeg(s) {
    if (s.destroyed || s.weg) return;
    s.weg = true;
    s.eventMode = 'none';
    this.tween(s, { alpha: 0 }, 0.8, { ease: 'sineInOut' }).then(() => {
      if (!s.destroyed) s.destroy();
      if (this.fund === s) this.fund = null;
    });
  }

  // Laubhaufen wird weggewischt
  wischt(p, q) {
    this.raschel(0.45);
    const jetzt = performance.now();
    if (jetzt - (p.letzteBlaetter || -1e9) > BLAETTER_PAUSE) {
      p.letzteBlaetter = jetzt;
      this.burst('blaetter', p.ort.x + rand(-80, 80), p.ort.y - p.hv * 0.6, { count: 3 });
    }
    if (p.kind && !p.kind.raus && q > 0.15) this.guckt(p, true);
  }

  freigewischt(p) {
    p.offen = true;
    if (p.kind && !p.kind.raus) {
      this.after(0.25, () => this.kindRaus(p));
      // der Laubhaufen wächst danach weich wieder zusammen
      this.after(4, () => { if (!p.c.destroyed) p.wisch?.reset({ fade: 1.2 }); });
    } else {
      if (!this.fund && Math.random() < 0.5) this.fundHuepft(p);
      this.after(2.5, () => {
        if (p.c.destroyed) return;
        p.wisch?.reset({ fade: 1.2 });
        p.offen = false;
      });
    }
  }

  // Stein losgelassen: weit genug geschoben → er rollt zur Seite und gibt frei; sonst gleitet er zurück
  losgelassenStein(p, ctx) {
    const s = p.s;
    const weg = s.x - ctx.startX;
    if (Math.abs(weg) < 120 || p.offen) {
      ctx.back(0.4);
      return;
    }
    ctx.erledigt = true;
    p.offen = true;
    const seite = weg > 0 ? 1 : -1;
    sfx('common/landen', { vol: 0.5 });
    this.tween(s, { x: ctx.startX + seite * 270 }, 0.45, { ease: 'cubicOut' });
    this.tween(s, { rotation: seite * 0.12 }, 0.45, { ease: 'sineInOut' });
    if (p.kind && !p.kind.raus) {
      this.after(0.35, () => this.kindRaus(p));
      // ist das Kind vorn, rollt der Stein zurück – sonst läge er vor dem Nachbar-Versteck
      this.after(2.8, () => {
        if (s.destroyed) return;
        this.tween(s, { x: ctx.startX, rotation: 0 }, 0.8, { ease: 'sineInOut' });
      });
      return;
    }
    if (!this.fund && Math.random() < 0.5) this.after(0.3, () => this.fundHuepft(p));
    // leer: der Stein rollt nach einer Weile zurück
    this.after(2.6, () => {
      if (s.destroyed) return;
      this.tween(s, { x: ctx.startX, rotation: 0 }, 0.7, { ease: 'sineInOut' }).then(() => { p.offen = false; });
    });
  }

  async kindRaus(p) {
    const kind = p.kind;
    const fam = p.fam;
    if (!kind || kind.raus || kind.destroyed) return;
    kind.raus = true;
    p.offen = true;
    if (fam.spur) this.spurWeg(fam, true);
    if (fam.schritt === 'wartet' || fam.schritt === 'spur' || fam.schritt === 'versteck') fam.schritt = 'raus';
    killTweensOf(kind, ['y']);
    this.raschel(0.6);
    // 1. hinter dem Versteck hoch (noch im Sichtfenster)
    await this.tween(kind, { y: -p.hv * 0.45 }, 0.3, { ease: 'quadOut' });
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
    // nicht zu weit rechts: dort sitzen die Familien (ein Kind dort würde vom anderen verdeckt)
    const vorn = this.freiVorn(Math.min(KIND_RAUS_MAX_X, p.ort.x + rand(40, 90)), p.ort.y + 60);
    this.after(0.3, () => { if (!kind.destroyed) { kind.zIndex = vorn.y; kind.schatten.visible = true; } });
    await kind.hopTo(vorn.x, vorn.y, { hoehe: 110, dauer: 0.6 });
    if (kind.destroyed) return;
    kind.schatten.visible = true;
    kind.zIndex = vorn.y;
    kind.pose('happy');
    await kind.hop(50);
    if (kind.destroyed) return;
    kind.pose('idle');
    const mama = fam.mama;
    if (mama && !mama.destroyed) {
      mama.lookAt(kind.x);
      kind.lookAt(mama.x);
      laut(mama);
    }
    // 3. Das Kind wartet darauf, zur Mama gebracht zu werden: ziehen – oder antippen, dann läuft es selbst
    fam.schritt = 'draussen';
    kind.zieh = drag(kind, {
      hitArea: figurFlaeche(kind, 60),
      lift: 1.08,
      sound: null,
      targets: () => (mama && !mama.destroyed ? [{ id: 'mama', obj: mama, radius: 330 }] : []),
      onStart: () => {
        kind._gehMarke = (kind._gehMarke || 0) + 1;   // ein laufendes geheZu endet
        kind.laeuft = false;
        laut(kind, 1);
      },
      onDrop: (ziel, ctx) => {
        ctx.erledigt = true;
        kind.zIndex = kind.y;
        this.zurMama(fam, ziel?.id === 'mama');
      },
    });
  }

  // freier Platz vor den Verstecken (nichts verdeckt das Kind, es ist gut zu greifen)
  freiVorn(x, y) {
    for (const o of this.orte) {
      if (Math.abs(x - o.x) < 280) y = Math.max(y, o.y + 95);
    }
    return { x, y: Math.min(SPUR_UNTEN, y) };
  }

  // Das Kind kommt zur Mama (bei = schon bei ihr abgelegt)
  async zurMama(fam, bei) {
    const kind = fam.kind;
    const mama = fam.mama;
    if (!kind || kind.destroyed || fam.schritt !== 'draussen') return;
    if (!mama || mama.destroyed) return;
    const dort = { x: mama.x + (kind.x < mama.x ? -95 : 95), y: mama.y + 60 };
    kind.laeuft = true;
    const ok = bei ? await kind.hopTo(dort.x, dort.y, { hoehe: 50, dauer: 0.4 }) : await geheZu(this, kind, dort.x, dort.y, { tempo: 340 });
    kind.laeuft = false;
    if (!ok || kind.destroyed || fam.schritt !== 'draussen') return;   // wieder gegriffen: zählt der neue Griff
    fam.schritt = 'zusammen';
    kind.zieh?.off();
    kind.zieh = null;
    kind.zIndex = kind.y;
    kind.lookAt(mama.x);
    mama.lookAt(kind.x);
    kind.onTap(() => jubel(this, kind));
    // 4. Wiedersehen
    jubel(this, mama, { herzen: 6 });
    this.after(0.35, () => jubel(this, kind, { herzen: 0, laut: false }));
    await this.wait(1.8);
    // 5. zusammen auf den Familienplatz
    if (mama.destroyed || kind.destroyed) return;
    const platz = fam.ort;
    const zielKind = { x: platz.x + BEI_MAMA.dx, y: platz.y + BEI_MAMA.dy };
    kind.laeuft = true;
    mama.laeuft = true;
    await Promise.all([
      geheZu(this, mama, platz.x, platz.y, { tempo: 300 }),
      this.wait(0.3).then(() => geheZu(this, kind, zielKind.x, zielKind.y, { tempo: 300 })),
    ]);
    kind.laeuft = false;
    mama.laeuft = false;
    if (mama.destroyed || kind.destroyed) return;
    kind.zIndex = kind.y;
    mama.zIndex = mama.y;
    mama.lookAt(mama.x - 100);
    kind.lookAt(kind.x - 100);
    fam.schritt = 'fertig';
    if (this.familien.every((f) => f.schritt === 'fertig')) {
      this.zeigeKamera();
      return;
    }
    // die nächste Mama denkt an ihr Kind
    const naechste = this.naechsteFamilie();
    if (naechste && !this.spurFam) this.after(0.6, () => { if (naechste.schritt === 'wartet') this.denkt(naechste, 2.6); });
  }

  // ---------------------------------------------------------------- Familienfoto

  zeigeKamera() {
    if (this.kamera) return;
    this.wechselt = true;
    const k = this.knopf('common/icon_kamera', {
      x: stage.W / 2 + KAMERA.x, y: KAMERA.y, size: 250, sound: null,
      onTap: () => this.foto(),
    });
    k.alpha = 0;
    this.kamera = k;
    const s = k.scale.x;
    k.scale.set(s * 0.5);
    this.tween(k, { alpha: 1 }, 0.5, { ease: 'sineInOut' });
    this.tween(k, { scale: s }, 0.6, { ease: 'backOut' });
    sfx('common/plopp', { vol: 0.45 });
    this.after(0.8, () => voice('wald_foto', { nurWenn: () => this.aktiv && this.kamera && !this.kamera.geklickt }));
  }

  async foto() {
    const k = this.kamera;
    if (!k || k.geklickt) return;
    k.geklickt = true;
    k.eventMode = 'none';
    sfx('common/klick', { vol: 0.8 });
    // alle schauen her und freuen sich (höchstens zwei hüpfen zugleich)
    const tiere = this.familien.flatMap((f) => [f.mama, f.kind]).filter((t) => t && !t.destroyed);
    tiere.forEach((t, i) => this.after(0.25 + Math.floor(i / 2) * 0.45, () => jubel(this, t, { herzen: i % 2 ? 0 : 3, laut: i % 2 === 0 })));
    // weicher Bilderrahmen um die Familien (blendet langsam ein – kein Blitz)
    const rahmen = new PIXI.Graphics()
      .roundRect(-420, -270, 840, 540, 40).stroke({ width: 22, color: 0xfffaf0, alpha: 0.95 })
      .roundRect(-420, -270, 840, 540, 40).stroke({ width: 4, color: 0xd9c9a8, alpha: 0.9 });
    rahmen.position.set(640, 1150);
    rahmen.alpha = 0;
    rahmen.zIndex = 4900;
    rahmen.eventMode = 'none';
    this.welt.addChild(rahmen);
    this.tween(rahmen, { alpha: 1 }, 0.6, { ease: 'sineInOut' });
    this.tween(k, { alpha: 0 }, 0.6, { ease: 'sineInOut', delay: 0.4 });
    await this.wait(1.9);
    // Das Foto entsteht im Rahmen und fliegt an die Leine
    const arten = this.familien.map((f) => f.art);
    const karte = this.fotoKarte(arten);
    karte.position.set(rahmen.x, rahmen.y);
    karte.scale.set(2.6);
    karte.alpha = 0;
    karte.zIndex = 4950;
    this.welt.addChild(karte);
    this.tween(karte, { alpha: 1 }, 0.5, { ease: 'sineInOut' });
    this.tween(rahmen, { alpha: 0 }, 0.6, { ease: 'sineInOut' }).then(() => { if (!rahmen.destroyed) rahmen.destroy(); });
    await this.wait(0.8);
    belohne(this, waehleSticker(arten.map(STICKER_ART)), 0, 640);
    await this.haengeFoto(karte, arten);
    if (!k.destroyed) k.destroy({ children: true });
    this.kamera = null;
    voice('wald_gefunden');
    await this.wait(1.2);
    this.familienGehen();
  }

  // Polaroid mit den drei Tierkindern (nur vorhandene Bilder, keine neuen Texturen)
  fotoKarte(arten) {
    const c = new PIXI.Container({ label: 'foto' });
    const g = new PIXI.Graphics()
      .roundRect(-82, -64, 164, 150, 12).fill({ color: 0x5a4630, alpha: 0.18 })
      .roundRect(-85, -70, 170, 150, 12).fill(0xfffaf0).stroke({ width: 3, color: 0xe2d4b8 })
      .roundRect(-72, -58, 144, 104, 8).fill(0xcfe6b0)
      .rect(-72, 22, 144, 24).fill(0xa9d08a);
    c.addChild(g);
    arten.forEach((art, i) => {
      const s = spr('wald/baby_' + art, { parent: c });
      s.scale.set(62 / (s.texture.height || 420));
      s.position.set(-46 + i * 46, 44 - (i === 1 ? 4 : 0));
    });
    // Wäscheklammer
    c.addChild(new PIXI.Graphics().roundRect(-9, -84, 18, 30, 5).fill(0xc98b55).stroke({ width: 2, color: 0x9a6438 }));
    return c;
  }

  // ---------------------------------------------------------------- Fotoleine

  leineY(x) {
    const t = (x - LEINE.x0) / (LEINE.x1 - LEINE.x0);
    return LEINE.y + LEINE.durchhang * 4 * t * (1 - t);
  }

  fotoOrt(i) {
    const x = LEINE.x0 + ((LEINE.x1 - LEINE.x0) * (i + 1)) / (FOTO_PLAETZE + 1);
    return { x, y: this.leineY(x) + 70 };
  }

  baueLeine() {
    const g = new PIXI.Graphics();
    g.moveTo(LEINE.x0, LEINE.y);
    for (let i = 1; i <= 24; i++) {
      const x = LEINE.x0 + ((LEINE.x1 - LEINE.x0) * i) / 24;
      g.lineTo(x, this.leineY(x));
    }
    g.stroke({ width: 5, color: 0x8a6a48, alpha: 0.9 });
    // kleine Knoten an den Enden (an den Ästen festgebunden)
    g.circle(LEINE.x0, LEINE.y, 8).fill(0x8a6a48).circle(LEINE.x1, LEINE.y, 8).fill(0x8a6a48);
    g.zIndex = 30;
    g.eventMode = 'none';
    this.welt.addChild(g);
    this.fotos = [];
    let gespeichert = store.get(FOTO_SPEICHER, []);
    if (!Array.isArray(gespeichert)) gespeichert = [];
    gespeichert = gespeichert.filter((a) => Array.isArray(a) && a.length === 3 && a.every((x) => ARTEN.includes(x)));
    gespeichert.slice(-FOTO_PLAETZE).forEach((arten) => {
      const k = this.fotoKarte(arten);
      this.fotoAnLeine(k, arten, this.fotos.length);
    });
  }

  fotoAnLeine(k, arten, i) {
    const o = this.fotoOrt(i);
    k.position.set(o.x, o.y);
    k.scale.set(1);
    k.rotation = rand(-0.06, 0.06);
    k.zIndex = 31;
    k.arten = arten;
    if (!k.parent) this.welt.addChild(k);
    tap(k, () => {
      fx.wobble(k, 0.08);
      const jetzt = performance.now();
      if (jetzt - (k.lautZeit || -1e9) > 900) {
        k.lautZeit = jetzt;
        animal(pick(arten));
      }
    }, { sound: null, squash: false, hitArea: new PIXI.Rectangle(-105, -95, 210, 205) });
    this.fotos.push(k);
  }

  async haengeFoto(karte, arten) {
    // Leine voll: das älteste Foto verblasst, die anderen rücken einen Platz nach links
    if (this.fotos.length >= FOTO_PLAETZE) {
      const alt = this.fotos.shift();
      alt.eventMode = 'none';
      this.tween(alt, { alpha: 0, y: alt.y + 40 }, 0.8, { ease: 'sineInOut' }).then(() => { if (!alt.destroyed) alt.destroy({ children: true }); });
      this.fotos.forEach((f, i) => {
        const o = this.fotoOrt(i);
        this.tween(f, { x: o.x, y: o.y }, 0.8, { ease: 'sineInOut', delay: 0.3 });
      });
    }
    const ziel = this.fotoOrt(this.fotos.length);
    sfx('common/wusch', { vol: 0.35 });
    await bogen(this, karte, ziel, { dauer: 1.1, hoehe: 120, skala: 1 });
    if (karte.destroyed) return;
    sfx('common/klack', { vol: 0.45 });
    this.fotoAnLeine(karte, arten, this.fotos.length);
    fx.wobble(karte, 0.1);
    store.set(FOTO_SPEICHER, this.fotos.map((f) => f.arten));
  }

  // ---------------------------------------------------------------- Runde geschafft

  async familienGehen() {
    // Familien gehen nach rechts aus dem Bild – eine nach der anderen (Mama und Kind als Paar; höchstens zwei
    // Figuren laufen zugleich). Das nächste Paar geht erst los, wenn das vorige fast draußen ist. Die vorderste
    // Familie (rechts) geht zuerst, so läuft niemand durch eine andere hindurch. Tippt das Kind ein gehendes Tier
    // an, wackelt es nur und geht weiter; verschwinden darf es erst, wenn es wirklich draußen ist.
    const reihe = [...this.familien].sort((a, b) => b.ort.x - a.ort.x);
    for (const fam of reihe) {
      const paar = [fam.mama, fam.kind].filter((t) => t && !t.destroyed);
      paar.forEach((t, j) => {
        t.laeuft = true;
        this.after(j * 0.15, () => geheZu(this, t, 1650 - j * 120, t.y, { tempo: 340 }).then((ok) => {
          if (t.destroyed) return;
          if (ok) t.destroy({ children: true });
          else this.tween(t, { alpha: 0 }, 0.6, { ease: 'sineInOut' }).then(() => { if (!t.destroyed) t.destroy({ children: true }); });
        }));
      });
      // warten, bis das Paar (fast) aus dem Bild ist – höchstens 7 s
      for (let i = 0; i < 35; i++) {
        if (paar.every((t) => t.destroyed || t.x > RAND_DRAUSSEN)) break;
        await this.wait(0.2);
      }
    }
    await this.wait(1.2);
    this.neueRunde();
  }

  // ---------------------------------------------------------------- kleine Lebenszeichen

  lebenszeichen() {
    if (this.gucken) return;
    const versteckt = this.plaetze.filter((p) => p.kind && !p.kind.raus && !p.kind.destroyed && !p.kind.guckt && !p.offen);
    if (!versteckt.length) return;
    const p = pick(versteckt);
    this.gucken = true;
    if (Math.random() < 0.5 || p.bild === 'laubhaufen') {
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
        if (ok !== false && !kind.raus && !kind.destroyed && !kind.guckt) return this.tween(kind, { y: kind.yVersteckt }, 0.6, { ease: 'sineInOut' });
        return false;
      })
      .then(() => { this.gucken = false; });
  }

  mamasSuchen() {
    const wartend = this.familien.filter((f) => f.schritt === 'wartet' && f.mama && !f.mama.destroyed && !f.mama.geht);
    wartend.forEach((fam, i) => {
      const mama = fam.mama;
      this.after(i * 0.7, () => {
        if (mama.destroyed || fam.schritt !== 'wartet' || mama.geht) return;
        mama.lookAt(mama.x + (mama.flip ? 100 : -100));
        this.after(1.4, () => { if (!mama.destroyed && fam.schritt === 'wartet' && !mama.geht) mama.lookAt(mama.x - 100); });
      });
    });
    // die nächste Mama denkt an ihr Kind (nicht, solange eine Spur läuft – dann zählt die Spur)
    const naechste = this.naechsteFamilie();
    if (naechste && !this.spurFam && !naechste.mama.geht && Math.random() < 0.6) {
      if (!this.familien.some((f) => f.mama?._blase && !f.mama._blase.destroyed)) this.denkt(naechste, 2.4);
    }
  }

  // ---------------------------------------------------------------- Ablauf

  update(dt) {
    // (ohne neue Listen pro Bild)
    const sl = this.schmetterlinge;
    for (let i = sl.length - 1; i >= 0; i--) {
      if (!sl[i].destroyed) sl[i].update(dt);
      if (sl[i].destroyed) sl.splice(i, 1);
    }
    // gehende Tiere: vorne/hinten passend zur Tiefe
    for (const fam of this.familien) {
      this.tiefeNachfuehren(fam.kind);
      this.tiefeNachfuehren(fam.mama);
    }
  }

  tiefeNachfuehren(t) {
    if (t && !t.destroyed && t.parent === this.welt && (t.laeuft || t.geht) && !t.zieh?.isDragging?.()) t.zIndex = t.y;
  }

  hinweise() {
    if (this.kamera && !this.kamera.geklickt) return [this.kamera];
    // im Übergang (Familien kommen oder gehen): auf eine Familie zeigen, sonst auf das neueste Foto an der Leine
    // (Tierlaut) – nicht auf den Blätter-Pfeil
    if (this.wechselt) {
      const m = this.familien.find((f) => f.mama && !f.mama.destroyed && !f.mama.geht);
      if (m) return [m.mama];
      const foto = this.fotos[this.fotos.length - 1];
      return foto && !foto.destroyed ? [foto] : [];
    }
    const liste = [];
    // ein Kind wartet darauf, zur Mama zu kommen
    for (const f of this.familien) {
      if (f.schritt === 'draussen' && f.kind && !f.kind.destroyed && f.mama) liste.push({ von: f.kind, nach: f.mama });
    }
    // die laufende Spur: der nächste Abdruck
    const sf = this.spurFam;
    if (sf?.spur) {
      const s = sf.spur[sf.spurNr];
      if (s && !s.destroyed) liste.push(s);
    }
    // ein Versteck am Ende einer Spur: mit seiner Geste
    for (const f of this.familien) {
      if (f.schritt !== 'versteck' || !f.platz) continue;
      const p = f.platz;
      if (p.art === 'schieben') liste.push({ von: p.s, nach: { x: p.ort.x + 280, y: p.ort.y - p.hv * 0.45 } });
      else if (p.art === 'wischen') liste.push({ von: this.wischAnker(p), nach: { x: p.ort.x + 170, y: p.ort.y - p.hv * 0.35 } });
      else liste.push(p.s);
    }
    if (!liste.length) {
      const n = this.naechsteFamilie();
      if (n && !this.spurFam) liste.push(n.mama);
    }
    return liste;
  }

  // unsichtbarer Punkt links auf dem Laubhaufen: dort beginnt die Wisch-Bewegung der Zeige-Hand
  wischAnker(p) {
    if (!p.anker || p.anker.destroyed) {
      p.anker = new PIXI.Graphics().circle(0, 0, 20).fill({ color: 0xffffff, alpha: 0 });
      p.anker.eventMode = 'none';
      p.anker.position.set(-170, -p.hv * 0.4);
      p.c.addChild(p.anker);
    }
    return p.anker;
  }
}
