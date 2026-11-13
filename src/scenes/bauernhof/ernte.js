// Seite 5 – Ernte und Hofladen. Zwei Abläufe hintereinander, jede Runde etwas anders:
//   Ernte:    1. Den Baum antippen → eine Frucht nach der anderen fällt ins Gras (Äpfel, Birnen oder Pflaumen –
//                nie zweimal hintereinander dieselben; manchmal fliegt dabei ein Vogel auf)
//             2. Früchte antippen oder ziehen → sie hüpfen in die Kiste (manchmal hilft ein Igel und trägt eine
//                Frucht auf dem Rücken hinein)
//             3. Die volle Kiste auf den Anhänger ziehen
//             4. Den Traktor antippen → er tuckert mit dem Anhänger zum Hofladen
//             5. Die Kiste antippen → die Früchte hüpfen auf die Ladentheke (Sticker); der Traktor fährt zurück
//   Hofladen: 1. Die Glocke läuten → ein Gast kommt (jede Runde andere Gäste)
//             2. Der Gast denkt an etwas aus dem Laden (zuerst an die frischen Früchte)
//             3. Das Gewünschte zum Gast ziehen (oder antippen) → er freut sich und geht
//             4. Drei Gäste, dann ein Fähnchen mehr an der Girlande des Ladens (bleibt gespeichert) und Sticker;
//                am Baum wachsen neue Früchte
// Nichts kann falsch gemacht werden: Der Gast freut sich über alles, was er bekommt – über das Gedachte nur ein
// paar Funkelsterne mehr. Nichts wird abgelehnt, niemand schüttelt den Kopf.

import { Actor, voice, fx, meta, tex, tap, drag, rand, pick, shuffle, clamp, store, sfxSchleife, PIXI } from '../../engine/index.js';
import { Seite } from '../../gemeinsam/seiten.js';
import { belohne, gesammelt, sticker as stickerVon } from '../../gemeinsam/sticker.js';
import { ton, laut, bogenFlug, Wolken, Vogel, wackelDing, engeTippflaeche } from './hilfen.js';

// Früchte (eine Sorte je Runde)
const FRUECHTE = ['common/futter_apfel', 'bauernhof/birne', 'bauernhof/pflaume'];
const FRUCHT_HOEHE = 115;          // Höhe einer Frucht im Baum und im Gras (Bühnen-Einheiten)
const KISTE_FRUCHT = 0.88;         // Größe in der Kiste (Anteil)
// Baum (links), Kiste davor, Gespann (Anhänger + Traktor) in der Mitte, Hofladen rechts
const BAUM = { x: -600, y: 1245, hoehe: 900 };
const KISTE = { x: -420, y: 1500, breite: 300 };
const KISTE_AUF_ANHAENGER = 0.86;      // Größe der Kiste auf dem Anhänger
const GESPANN = { x: -250, y: 1392 };    // Mitte des Anhängers am Boden (Parkplatz)
const ANHAENGER_BREITE = 460;
const TRAKTOR_BREITE = 400;
const STOPP_X = 245;                      // so weit fährt das Gespann zum Laden (Mitte des Anhängers)
const LADEN = { x: 760, y: 1272, hoehe: 760 };
const GAST = { x: 560, y: 1482 };         // hier steht ein Gast vor dem Laden
const GAST_HOEHE = 380;
const GAST_START = { x: 1420, y: 1482 };
// Wo die Früchte im Gras landen (links und rechts vom Stamm, hinter der Kiste)
const GRAS = [
  { x: -950, y: 1300 }, { x: -860, y: 1355 }, { x: -790, y: 1285 }, { x: -700, y: 1365 }, { x: -540, y: 1290 },
  { x: -920, y: 1235 }, { x: -620, y: 1330 }, { x: -760, y: 1420 },
];
// Plätze im Baum (Anteile der Krone: -1…1 um ihre Mitte)
const KRONE_PLAETZE = [
  [-0.62, -0.05], [-0.3, -0.45], [0.05, -0.62], [0.42, -0.4], [0.66, 0.02], [0.36, 0.3],
  [-0.05, 0.12], [-0.42, 0.34], [0.12, -0.2],
];
// Gäste des Hofladens
const GAESTE = ['hase', 'ente', 'maus', 'igel', 'eichhoernchen', 'katze', 'hund', 'huhn', 'schaf'];
// Waren neben dem Obst (jede Runde zwei davon, nie dieselben wie in der Runde davor)
const WAREN = ['bauernhof/ei', 'common/futter_milch', 'common/futter_kaese', 'bauernhof/wolle_ballen', 'common/futter_honig', 'common/futter_brot'];
const WARE_HOEHE = 115;
// Theke von links nach rechts: Glocke, Obst-Haufen, eine Ware. Jede Gruppe hat ihren eigenen Streifen von mindestens
// 200 Einheiten – die Tippflächen überdecken sich nur dort, wo die vordere (höherer zIndex) gewinnen soll.
const OBST_ABSTAND = 62;
const OBST_X = 160;                // Obst-Haufen beginnt so weit rechts vom Theken-Anfang (links steht die Glocke)
const WARE_X = 470;                // Mitte der Ware, vom Theken-Anfang aus
const WAREN_JE_RUNDE = 1;          // eine Ware neben dem Obst (mehr passt nicht mit großen Tippflächen auf die Theke)
const GAESTE_JE_RUNDE = 3;
const FAHNEN_KEY = 'bauernhof.fahnen';
const FAHNEN_MAX = 9;
const FAHNEN_FARBEN = [0xe8534a, 0xf2b33d, 0x5bb0e0, 0x7cc35a, 0xf08cb6, 0xa98ee6];
const GLEICHZEITIG = 2;            // Ruhe-Regel: höchstens zwei Dinge fliegen/laufen gleichzeitig
const FLUG_TEMPO = 700;

const skalaFuer = (id, hoehe) => hoehe / (meta(id)?.h || 400);

export class Ernte extends Seite {
  static hg = 'bauernhof/hg_feld';

  aufbau() {
    this.phase = 'ernte';   // 'ernte' | 'voll' | 'fahren' | 'unterwegs' | 'abladen' | 'glocke' | 'gast' | 'fertig'
    this.runde = 0;
    this.fruchtId = null;
    this.imBaum = [];        // Früchte, die noch hängen
    this.imGras = [];        // Früchte im Gras (greifbar)
    this.inKiste = 0;        // vergebene Plätze in der Kiste
    this.gelandet = 0;
    this.ziel = 6;           // so viele Früchte passen diese Runde in die Kiste
    this.theke = [];         // Waren auf der Theke {art, sprite, platz}
    this.obstAufTheke = [];
    this.gast = null;
    this.gaesteRunde = [];
    this.gaesteDa = 0;
    this.letzteGaeste = [];
    this.igelZuletzt = -3;
    this._gaenge = [];
    this._laufend = 0;
    this.fahrt = 0;          // > 0: Traktor fährt (für das Ruckeln)
    this.rauchZeit = 0;

    this.wolken = new Wolken(this.hinten, { anzahl: 2, yVon: 80, yBis: 220 });
    this.baueBaum();
    this.baueKiste();
    this.baueGespann();
    this.baueLaden();
    this.vogel = new Vogel(this, this.vogelSitz, { skala: 0.62, z: 12 });
    this.motor = sfxSchleife('common/motor', { vol: 0.22, ein: 0.4, aus: 0.6 });

    this.legeWaren();
    this.neueErnte(true);
  }

  betreten() {
    this._hinweis?.kill();
    this._hinweis = this.after(2.2, () => this.hinweisAnbieten());
  }

  verlassen() {
    this._hinweis?.kill();
    this._hinweis = null;
    this.motor?.aus(0.3);
  }

  // Ein Satz je Schritt – nur, solange die Seite zu sehen ist und der Schritt noch dran ist
  hinweisAnbieten() {
    if (!this.aktiv) return;
    const satz = {
      ernte: this.imGras.length ? 'bauernhof_kiste' : 'bauernhof_baum',
      voll: 'bauernhof_anhaenger',
      fahren: 'bauernhof_traktor',
      glocke: 'bauernhof_glocke',
      gast: 'bauernhof_laden',
    }[this.phase];
    if (!satz) return;
    const phase = this.phase;
    voice(satz, { nurWenn: () => this.aktiv && this.phase === phase });
  }

  // nach jedem neuen Schritt den passenden Satz anbieten (der Kern sagt jeden höchstens einmal am Tag)
  schritt(phase) {
    this.phase = phase;
    this._hinweis?.kill();
    if (this.aktiv) this._hinweis = this.after(1.6, () => this.hinweisAnbieten());
  }

  // ---------------------------------------------------------------- Bewegungen (höchstens zwei gleichzeitig)

  gang(fn) {
    return new Promise((fertig) => {
      this._gaenge.push({ fn, fertig });
      this.naechsterGang();
    });
  }

  naechsterGang() {
    while (this._laufend < GLEICHZEITIG && this._gaenge.length) {
      const { fn, fertig } = this._gaenge.shift();
      this._laufend++;
      let frei = false;
      const ende = (v) => {
        if (frei) return;
        frei = true;
        this._laufend--;
        fertig(v);
        this.naechsterGang();
      };
      Promise.resolve().then(fn).then(ende, () => ende(false));
      this.after(12, () => ende(false));   // Notbremse
    }
  }

  // ---------------------------------------------------------------- Bauteile

  sprite(id, x, y, skala, z, eltern = this.welt) {
    const s = new PIXI.Sprite(tex(id));
    const m = meta(id);
    s.anchor.set(m.ax ?? 0.5, m.ay ?? 0.5);
    s.scale.set(skala);
    s.position.set(x, y);
    s.zIndex = z;
    s.label = id;
    eltern.addChild(s);
    return s;
  }

  // Punkt eines Bildes (pts aus pack.json, in Bildpunkten) relativ zum Anker, mal Skala
  bildPunkt(id, name, ersatz) {
    const m = meta(id);
    const p = m?.pts?.[name] || ersatz;
    return { x: (p[0] - (m.ax ?? 0.5) * m.w), y: (p[1] - (m.ay ?? 0.5) * m.h) };
  }

  baueBaum() {
    const id = 'bauernhof/apfelbaum';
    const s = skalaFuer(id, BAUM.hoehe);
    this.baumSkala = s;
    // Baum in einem Container: er wiegt sich beim Schütteln an seinem Fuß
    const c = new PIXI.Container({ label: 'baum' });
    c.position.set(BAUM.x, BAUM.y);
    c.zIndex = 10;
    this.welt.addChild(c);
    this.baum = c;
    this.baumBild = this.sprite(id, 0, 0, s, 0, c);
    const m = meta(id);
    const kr = m.pts?.krone || [m.w * 0.5, m.h * 0.38];
    const radius = m.pts?.radius?.[0] || m.w * 0.4;
    this.krone = { x: (kr[0] - m.ax * m.w) * s, y: (kr[1] - m.ay * m.h) * s, r: radius * s };
    this.fruechteC = new PIXI.Container({ label: 'baumFruechte' });
    c.addChild(this.fruechteC);
    // Tippfläche: die ganze Krone (Früchte darin sind nicht einzeln zu treffen – der Baum gibt eine nach der anderen)
    const k = this.krone;
    tap(c, () => this.schuetteln(), {
      sound: null, squash: false,
      hitArea: new PIXI.Rectangle(k.x - k.r * 1.05, k.y - k.r * 1.0, k.r * 2.1, -k.y + k.r * 1.0 + 20),
    });
    this.vogelSitz = { x: BAUM.x + k.x + k.r * 0.45, y: BAUM.y + k.y - k.r * 0.86 };
    this.kronenMitte = { x: BAUM.x + k.x, y: BAUM.y + k.y };
  }

  baueKiste() {
    const id = 'bauernhof/kiste';
    const m = meta(id);
    const s = KISTE.breite / (m.w || 400);
    this.kisteSkala = s;
    const c = new PIXI.Container({ label: 'kiste' });
    c.position.set(KISTE.x, KISTE.y);
    c.zIndex = 40;
    this.welt.addChild(c);
    this.kiste = c;
    this.kisteBild = this.sprite(id, 0, 0, s, 0, c);
    // Früchte in der Kiste: hinter dem vorderen Rand (Maske schneidet unten ab)
    const rand = this.bildPunkt(id, 'rand', [m.w * 0.5, m.h * 0.4]);
    this.kisteRandY = rand.y * s;
    this.kisteOben = this.bildPunkt(id, 'oben', [m.w * 0.5, m.h * 0.1]).y * s;
    this.kisteInhalt = new PIXI.Container({ label: 'kisteInhalt' });
    this.kisteInhalt.sortableChildren = true;
    c.addChild(this.kisteInhalt);
    const maske = new PIXI.Graphics().rect(-KISTE.breite, this.kisteRandY - 400, KISTE.breite * 2, 400).fill(0xffffff);
    c.addChild(maske);
    this.kisteInhalt.mask = maske;
    this.kisteHeim = { x: KISTE.x, y: KISTE.y };
    this.kisteZiehen = drag(c, {
      pad: 30,
      lift: 1.05,
      back: true,
      hitArea: new PIXI.Rectangle(-KISTE.breite / 2 - 10, this.kisteOben - 70, KISTE.breite + 20, -this.kisteOben + 90),
      heim: () => (this.kisteAufAnhaenger ? { x: this.ladePunkt.x, y: this.ladePunkt.y + 6 } : this.kisteHeim),
      targets: () => (this.phase === 'voll' ? [{ id: 'anhaenger', ...this.ladeflaeche(), radius: 360 }] : []),
      onStart: () => {
        if (this.phase !== 'voll') { ton('common/klack', { vol: 0.5 }); fx.wobble(c, 0.05); }
      },
      onDrop: (ziel, ctx) => {
        if (this.phase === 'voll' && (ziel || this.tippNah(ctx))) { this.aufladen(); return; }
        if (this.phase === 'abladen' && this.kisteAufAnhaenger) { this.abladen(); return; }
        ctx.back(0.4);
      },
    });
  }

  tippNah(ctx) {
    return Math.hypot(this.kiste.x - ctx.startX, this.kiste.y - ctx.startY) < 25;
  }

  // Mitte der Ladefläche des Anhängers (Welt-Koordinaten)
  ladeflaeche() {
    return { x: this.gespann.x + this.ladePunkt.x, y: this.gespann.y + this.ladePunkt.y };
  }

  baueGespann() {
    const c = new PIXI.Container({ label: 'gespann' });
    c.position.set(GESPANN.x, GESPANN.y);
    c.zIndex = 30;
    c.sortableChildren = true;
    this.welt.addChild(c);
    this.gespann = c;
    const aId = 'bauernhof/anhaenger';
    const am = meta(aId);
    const as = ANHAENGER_BREITE / (am.w || 600);
    this.anhaenger = this.sprite(aId, 0, 0, as, 1, c);
    const lade = this.bildPunkt(aId, 'ladeflaeche', [am.w * 0.45, am.h * 0.45]);
    this.ladePunkt = { x: lade.x * as, y: lade.y * as };
    const deichsel = this.bildPunkt(aId, 'deichsel', [am.w * 0.98, am.h * 0.6]);
    const tId = 'bauernhof/traktor';
    const tm = meta(tId);
    const ts = TRAKTOR_BREITE / (tm.w || 900);
    // Traktor rechts vor dem Anhänger: sein Heck sitzt an der Deichsel
    const tx = deichsel.x * as + (tm.ax ?? 0.5) * tm.w * ts - 40;
    this.traktorWrap = new PIXI.Container({ label: 'traktor' });
    this.traktorWrap.position.set(tx, 0);
    this.traktorWrap.zIndex = 2;
    c.addChild(this.traktorWrap);
    this.traktor = this.sprite(tId, 0, 0, ts, 0, this.traktorWrap);
    this.traktorSkala = ts;
    tap(this.traktorWrap, () => this.traktorGetippt(), {
      sound: null, squash: false,
      hitArea: new PIXI.Rectangle(-tm.w * ts * 0.5, -tm.h * ts, tm.w * ts, tm.h * ts + 20),
    });
    wackelDing(this.anhaenger, {
      ton: 'common/klack', vol: 0.45, abstand: 0.5, pad: 20,
      dazu: () => { if (this.phase === 'abladen') this.abladen(); },
    });
  }

  baueLaden() {
    const id = 'bauernhof/hofladen';
    const m = meta(id);
    const s = skalaFuer(id, LADEN.hoehe);
    const c = new PIXI.Container({ label: 'hofladen' });
    c.position.set(LADEN.x, LADEN.y);
    c.zIndex = 8;
    c.sortableChildren = true;
    this.welt.addChild(c);
    this.laden = c;
    this.ladenBild = this.sprite(id, 0, 0, s, 0, c);
    wackelDing(this.ladenBild, { ton: 'common/klack', vol: 0.4, abstand: 0.5, pad: 0 });
    // Theke: Waren stehen auf dieser Linie (pts 'theke_l', 'theke_r')
    const l = this.bildPunkt(id, 'theke_l', [m.w * 0.18, m.h * 0.6]);
    const r = this.bildPunkt(id, 'theke_r', [m.w * 0.82, m.h * 0.6]);
    this.theken = { x0: LADEN.x + l.x * s, x1: LADEN.x + r.x * s, y: LADEN.y + l.y * s };
    // Girlande unter dem Dach (pts 'dach_l', 'dach_r')
    const dl = this.bildPunkt(id, 'dach_l', [m.w * 0.1, m.h * 0.3]);
    const dr = this.bildPunkt(id, 'dach_r', [m.w * 0.9, m.h * 0.3]);
    this.dach = { x0: LADEN.x + dl.x * s, x1: LADEN.x + dr.x * s, y: LADEN.y + dl.y * s };
    this.girlande = new PIXI.Container({ label: 'girlande' });
    this.girlande.zIndex = 9;
    this.welt.addChild(this.girlande);
    const schnur = new PIXI.Graphics();
    const d = this.dach;
    schnur.moveTo(d.x0, d.y).quadraticCurveTo((d.x0 + d.x1) / 2, d.y + 70, d.x1, d.y).stroke({ width: 5, color: 0x8a5a33 });
    this.girlande.addChild(schnur);
    this.fahnen = [];
    const n = clamp(Number(store.get(FAHNEN_KEY, 0)) || 0, 0, 999);
    for (let i = 0; i < Math.min(n, FAHNEN_MAX); i++) this.fahne(i, n > FAHNEN_MAX ? n - FAHNEN_MAX + i : i, true);
    this.fahnenZahl = n;
    wackelDing(this.girlande, {
      ton: null, pad: 30,
      hitArea: new PIXI.Rectangle(d.x0, d.y - 60, d.x1 - d.x0, 210),
      dazu: () => { ton('common/rascheln', { vol: 0.4, abstand: 0.6 }); for (const f of this.fahnen) fx.wobble(f, 0.12); },
    });

    // Glocke links auf der Theke
    const gId = 'bauernhof/glocke';
    this.glocke = this.sprite(gId, this.theken.x0 + 42, this.theken.y + 4, skalaFuer(gId, 140), 60);   // liegt über den Waren (deren Tippflächen sind breit)
    const gs = this.glocke.scale.x;
    tap(this.glocke, () => this.glockeGetippt(), {
      // etwas nach links versetzt: rechts daneben beginnt gleich der Obst-Haufen
      sound: null, squash: true, hitArea: new PIXI.Rectangle(-118 / gs, -200 / gs, 200 / gs, 230 / gs),
    });
  }

  // Fähnchen Nr. i an der Girlande (Farbe nach der Gesamtzahl k, damit sich die Farben weiterdrehen)
  fahne(i, k, sofort) {
    const d = this.dach;
    const t = (i + 0.5) / FAHNEN_MAX;
    const x = d.x0 + (d.x1 - d.x0) * t;
    const y = d.y + 70 * 4 * t * (1 - t) * 0.5 + 2;
    const g = new PIXI.Graphics()
      // so breit wie ein Platz an der Schnur und gut lang, damit man die Fähnchen unter dem Dach auch sieht
      .poly([-30, 0, 30, 0, 0, 86]).fill(FAHNEN_FARBEN[k % FAHNEN_FARBEN.length])
      .poly([-15, 6, 15, 6, 0, 38]).fill({ color: 0xffffff, alpha: 0.25 });
    g.position.set(x, y);
    g.eventMode = 'none';
    this.girlande.addChild(g);
    this.fahnen[i] = g;
    if (!sofort) {
      g.scale.set(0);
      this.tween(g, { scale: 1 }, 0.6, { ease: 'backOut' });
    }
    return g;
  }

  neueFahne() {
    const n = ++this.fahnenZahl;
    store.set(FAHNEN_KEY, n);
    if (n <= FAHNEN_MAX) {
      const g = this.fahne(n - 1, n - 1, false);
      ton('common/plopp', { vol: 0.6 });
      this.burst('funkeln', g.x, g.y + 20, { count: 4 });
      return;
    }
    // Girlande voll: alle Fähnchen rücken einen Platz weiter, vorn kommt ein neues (die Farben wandern weiter)
    const alt = this.fahnen.shift();
    this.tween(alt, { alpha: 0 }, 0.6, { ease: 'sineInOut' }).then(() => { if (!alt.destroyed) alt.destroy(); });
    this.fahnen.forEach((f, i) => {
      const t = (i + 0.5) / FAHNEN_MAX;
      const d = this.dach;
      this.tween(f, { x: d.x0 + (d.x1 - d.x0) * t, y: d.y + 70 * 4 * t * (1 - t) * 0.5 + 2 }, 0.8, { ease: 'sineInOut' });
    });
    this.fahnen.length = FAHNEN_MAX - 1;
    const g = this.fahne(FAHNEN_MAX - 1, n - 1, false);
    ton('common/plopp', { vol: 0.6 });
    this.burst('funkeln', g.x, g.y + 20, { count: 4 });
  }

  // ---------------------------------------------------------------- Ernte

  neueErnte(erste = false) {
    this.runde++;
    // eine andere Frucht als zuletzt
    const vorher = this.fruchtId;
    this.fruchtId = erste ? 'common/futter_apfel' : pick(FRUECHTE.filter((f) => f !== vorher));
    this.ziel = erste ? 5 : pick([5, 6, 6]);
    this.inKiste = 0;
    this.gelandet = 0;
    this.igelDieseRunde = !erste && this.runde - this.igelZuletzt >= 2 && Math.random() < 0.45;
    if (this.igelDieseRunde) this.igelZuletzt = this.runde;
    const k = this.krone;
    const plaetze = shuffle([...KRONE_PLAETZE]).slice(0, this.ziel);
    const s = skalaFuer(this.fruchtId, FRUCHT_HOEHE);
    this.imBaum = plaetze.map(([px, py], i) => {
      const f = this.sprite(this.fruchtId, k.x + px * k.r * 0.78, k.y + py * k.r * 0.72, erste ? s : 0, 5, this.fruechteC);
      f.anchor.set(0.5, 0.15);    // hängt am Stiel
      f.rotation = rand(-0.15, 0.15);
      f.ruhe = s;
      f.eventMode = 'none';
      if (!erste) {
        this.after(i * 0.25, () => {
          if (f.destroyed) return;
          ton('common/wachsen', { vol: 0.45, abstand: 0.2 });
          this.tween(f, { scale: s }, 0.7, { ease: 'backOut' });
        });
      }
      return f;
    });
    this.grasFrei = shuffle([...GRAS]);
    this.schritt('ernte');
  }

  schuetteln() {
    // sanft wiegen + rascheln, ein paar Blätter
    this.tween(this.baumBild, { rotation: 0.025 }, 0.18, { ease: 'sineInOut', yoyo: true, repeat: 1 });
    this.tween(this.fruechteC, { rotation: 0.025 }, 0.18, { ease: 'sineInOut', yoyo: true, repeat: 1 });
    ton('common/rascheln', { vol: 0.6, abstand: 0.5 });
    if (this.vogel.zustand === 'sitzt' && Math.random() < 0.5) this.vogel.antippen();
    if (this.phase !== 'ernte' || !this.imBaum.length || this._laufend >= GLEICHZEITIG) {
      this.burst('blaetter', this.kronenMitte.x + rand(-120, 120), this.kronenMitte.y + 40, { count: 2 });
      return;
    }
    this.burst('blaetter', this.kronenMitte.x, this.kronenMitte.y + 40, { count: 3 });
    // die unterste Frucht fällt zuerst
    this.imBaum.sort((a, b) => b.y - a.y);
    const f = this.imBaum.shift();
    this.fallen(f);
  }

  async fallen(f) {
    const ziel = this.grasFrei.shift() || { x: rand(-980, -480), y: rand(1260, 1360) };
    // vom Baum in die Welt umziehen
    const g = this.welt.toLocal(f.getGlobalPosition());
    this.welt.addChild(f);
    f.position.set(g.x, g.y);
    f.scale.set(f.ruhe);
    f.anchor.set(0.5, 0.9);
    f.zIndex = Math.round(ziel.y / 10);
    f.grasPlatz = ziel;
    const ok = await this.gang(async () => {
      const dauer = clamp(Math.sqrt(Math.abs(ziel.y - f.y)) / 26, 0.6, 1.1);
      const fall = this.tween(f, { y: ziel.y }, dauer, { ease: 'quadIn' });
      this.tween(f, { x: ziel.x, rotation: rand(-0.3, 0.3) }, dauer, { ease: 'sineOut' });
      if (!(await fall) || f.destroyed) return false;
      ton('common/landen', { vol: 0.55, abstand: 0.15 });
      // kleiner Hüpfer im Gras
      await this.tween(f, { y: ziel.y - 30 }, 0.16, { ease: 'quadOut' });
      await this.tween(f, { y: ziel.y }, 0.16, { ease: 'quadIn' });
      return !f.destroyed;
    });
    if (!ok || f.destroyed) return;
    f.heim = { x: ziel.x, y: ziel.y };
    this.imGras.push(f);
    this.machGreifbar(f);
    // die erste Frucht liegt im Gras: jetzt passt der Satz „Sammle das Obst in die Kiste."
    if (this.imGras.length === 1 && this.gelandet === 0 && this.phase === 'ernte') this.schritt('ernte');
    // Überraschung: ein Igel kommt und hilft
    if (this.igelDieseRunde && !this.igel && this.imGras.length >= 2 && this.phase === 'ernte') this.igelHilft();
  }

  machGreifbar(f) {
    f.eventMode = 'static';
    f.ziehen = drag(f, {
      back: false,
      lift: 1.15,
      hitArea: new PIXI.Circle(0, -FRUCHT_HOEHE * 0.4 / f.ruhe, 135 / f.ruhe),
      onDrop: () => this.inDieKiste(f),   // auch ein kurzer Tipp schickt die Frucht in die Kiste
    });
  }

  async inDieKiste(f) {
    if (f.destroyed || f.reserviert) return;
    f.ziehen?.off();
    f.eventMode = 'none';
    f.zIndex = 300;
    this.imGras = this.imGras.filter((x) => x !== f);
    const n = this.inKiste++;
    fx.pop(f, 0.06);
    await this.gang(async () => {
      const lokal = this.kistenPlatz(n);
      const zielG = this.welt.toLocal(this.kiste.toGlobal(lokal));
      ton('common/hupf', { vol: 0.55, abstand: 0.15 });
      return bogenFlug(this, f, zielG.x, zielG.y, { dauer: 0.6, hoehe: 180, skala: f.ruhe * KISTE_FRUCHT, tempo: FLUG_TEMPO });
    });
    if (f.destroyed) return;
    this.legeInKiste(f, n);
  }

  legeInKiste(f, n) {
    const lokal = this.kistenPlatz(n);
    this.kisteInhalt.addChild(f);
    f.position.set(lokal.x, lokal.y);
    f.scale.set(f.ruhe * KISTE_FRUCHT);
    f.rotation = rand(-0.2, 0.2);
    f.zIndex = n < 3 ? 1 : 2;
    ton('common/landen', { vol: 0.55, abstand: 0.15 });
    fx.pop(this.kiste, 0.04);
    this.gelandet++;
    if (this.gelandet >= this.ziel && this.phase === 'ernte') this.kisteVoll();
  }

  // Platz Nr. n in der Kiste (Kisten-Koordinaten): hinten drei, vorn drei; Fuß der Frucht knapp unter dem Rand
  kistenPlatz(n) {
    const b = KISTE.breite * 0.74;
    const reihe = n < 3 ? 0 : 1;
    const i = n % 3;
    return { x: -b / 2 + (i + 0.5) * (b / 3) + (reihe ? 18 : -8), y: this.kisteRandY + (reihe ? 42 : 12) };
  }

  async kisteVoll() {
    this.schritt('voll');
    ton('common/funkeln', { vol: 0.5, abstand: 1 });
    this.burst('funkeln', this.kiste.x, this.kiste.y + this.kisteOben, { count: 5 });
    await this.wait(0.6);
    if (this.phase === 'voll' && !this.puls) this.puls = fx.pulse(this.kiste, { staerke: 0.03, periode: 1.6 });
  }

  // Die volle Kiste springt auf den Anhänger
  async aufladen() {
    if (this.phase !== 'voll') return;
    this.phase = 'aufladen';
    this.puls?.stop();
    this.puls = null;
    const k = this.kiste;
    k.eventMode = 'none';
    const ziel = this.ladeflaeche();
    const lokal = { x: this.ladePunkt.x, y: this.ladePunkt.y + 6 };
    await bogenFlug(this, k, ziel.x, ziel.y + 6, { dauer: 0.5, hoehe: 90, tempo: 600, skala: KISTE_AUF_ANHAENGER });
    if (k.destroyed) return;
    // auf der Ladefläche: hinter der vorderen Bordwand
    this.gespann.addChild(k);
    k.position.set(lokal.x, lokal.y);
    k.scale.set(KISTE_AUF_ANHAENGER);
    k.zIndex = 0;
    this.kisteAufAnhaenger = true;
    ton('common/kupplung', { vol: 0.6 });
    fx.pop(this.anhaenger, 0.04);
    k.eventMode = 'static';
    await this.wait(0.4);
    this.schritt('fahren');
    this.traktorPuls = fx.pulse(this.traktorWrap, { staerke: 0.03, periode: 1.6 });
  }

  traktorGetippt() {
    if (this.phase === 'fahren') { this.losfahren(); return; }
    fx.wobble(this.traktorWrap, 0.04);
    ton('common/traktor', { vol: 0.5, abstand: 2.8 });
    this.rauch(3);
  }

  rauch(n = 2) {
    const g = this.welt.toLocal(this.traktorWrap.toGlobal({ x: this.auspuffLokal().x, y: this.auspuffLokal().y }));
    this.burst('rauch', g.x, g.y, { count: n });
  }

  auspuffLokal() {
    // Auspuff im Bild traktor: etwa 264 rechts, 600 über dem Anker (wie auf Seite 1)
    const ts = this.traktorSkala;
    return { x: 264 * ts, y: -600 * ts };
  }

  async fahre(nachX, tempo, rueckwaerts = false) {
    const d = Math.abs(nachX - this.gespann.x);
    this.fahrt++;
    this.motor?.an(0.4);
    const ok = await this.tween(this.gespann, { x: nachX }, Math.max(0.8, d / tempo), { ease: 'sineInOut' });
    this.fahrt--;
    if (this.fahrt <= 0) this.motor?.aus(0.6);
    this.traktor.y = 0;
    this.anhaenger.y = 0;
    return ok;
  }

  async losfahren() {
    if (this.phase !== 'fahren') return;
    this.phase = 'unterwegs';
    this.traktorPuls?.stop();
    this.traktorPuls = null;
    this.kiste.eventMode = 'none';
    ton('common/traktor', { vol: 0.6, abstand: 1 });
    this.rauch(3);
    await this.wait(0.5);
    await this.fahre(STOPP_X, 230);
    ton('common/klack', { vol: 0.4 });
    this.kiste.eventMode = 'static';
    this.schritt('abladen');
  }

  // Die Früchte hüpfen eine nach der anderen aus der Kiste auf die Theke
  async abladen() {
    if (this.phase !== 'abladen') return;
    this.phase = 'ladeAus';
    // altes Obst vom letzten Mal geht weich weg
    for (const w of this.obstAufTheke) this.wareWeg(w);
    this.obstAufTheke = [];
    const fruechte = [...this.kisteInhalt.children].filter((c) => c instanceof PIXI.Sprite);
    const plaetze = this.obstPlaetze(fruechte.length);
    for (let i = 0; i < fruechte.length; i++) {
      const f = fruechte[i];
      const g = this.welt.toLocal(f.getGlobalPosition());
      this.welt.addChild(f);
      f.position.set(g.x, g.y);
      f.scale.set(f.ruhe * KISTE_FRUCHT);
      f.zIndex = 300;
      const p = plaetze[i];
      this.gang(() => bogenFlug(this, f, p.x, p.y, { dauer: 0.6, hoehe: 160, skala: f.ruhe, tempo: FLUG_TEMPO })).then(() => {
        if (f.destroyed) return;
        f.zIndex = 20 + i;
        f.rotation = 0;
        ton('common/landen', { vol: 0.5, abstand: 0.12 });
        const w = { art: 'obst', sprite: f, platz: p };
        this.obstAufTheke.push(w);
        this.machWare(w);
      });
      await this.wait(0.35);
    }
    for (let i = 0; i < 40 && (this._laufend > 0 || this._gaenge.length); i++) await this.wait(0.25);
    belohne(this, 'bauernhof_anhaenger', this.ladeflaeche().x, this.ladeflaeche().y - 300);
    await this.wait(0.8);
    this.neueLadenrunde();
    // Traktor fährt (rückwärts) zurück, die leere Kiste springt wieder unter den Baum
    this.zurueckZumBaum();
  }

  async zurueckZumBaum() {
    await this.wait(0.6);
    await this.fahre(GESPANN.x, 170, true);
    const k = this.kiste;
    const g = this.welt.toLocal(k.getGlobalPosition());
    this.welt.addChild(k);
    k.position.set(g.x, g.y);
    k.zIndex = 40;
    this.kisteAufAnhaenger = false;
    await bogenFlug(this, k, KISTE.x, KISTE.y, { dauer: 0.5, hoehe: 80, tempo: 600, skala: 1 });
    if (k.destroyed) return;
    ton('common/landen', { vol: 0.5 });
    k.eventMode = 'static';
    this.kisteBereit = true;
    if (this.wartetAufKiste) {
      this.wartetAufKiste = false;
      this.neueErnte();
    }
  }

  // Obst liegt links auf der Theke als kleiner Haufen
  obstPlaetze(n) {
    const t = this.theken;
    const x0 = t.x0 + OBST_X;
    const plaetze = [];
    for (let i = 0; i < n; i++) {
      // unten drei nebeneinander, darauf zwei, ganz oben eine
      if (i < 3) plaetze.push({ x: x0 + i * OBST_ABSTAND, y: t.y });
      else if (i < 5) plaetze.push({ x: x0 + OBST_ABSTAND / 2 + (i - 3) * OBST_ABSTAND, y: t.y - 58 });
      else plaetze.push({ x: x0 + OBST_ABSTAND, y: t.y - 112 });
    }
    return plaetze;
  }

  // ---------------------------------------------------------------- Hofladen

  neueLadenrunde() {
    this.legeWaren();
    // Gäste dieser Runde: drei verschiedene, möglichst andere als zuletzt
    const frei = GAESTE.filter((g) => !this.letzteGaeste.includes(g));
    this.gaesteRunde = shuffle(frei).slice(0, GAESTE_JE_RUNDE);
    this.letzteGaeste = this.gaesteRunde;
    this.gaesteDa = 0;
    this.letzterWunsch = null;
    this.schritt('glocke');
    this.after(0.8, () => {
      if (this.phase === 'glocke' && !this.glockePuls) this.glockePuls = fx.pulse(this.glocke, { staerke: 0.05, periode: 1.6 });
    });
  }

  // zwei Waren neben dem Obst (jede Runde andere Auswahl)
  legeWaren() {
    const vorher = this.theke.map((w) => w.art);
    const auswahl = shuffle(WAREN.filter((w) => !vorher.includes(w))).slice(0, WAREN_JE_RUNDE);
    for (const w of this.theke) this.wareWeg(w);
    const t = this.theken;
    this.theke = auswahl.map((art, i) => {
      const p = { x: t.x0 + WARE_X + i * 240, y: t.y };
      const w = { art, platz: p };
      this.neueWare(w, i * 0.2);
      return w;
    });
  }

  neueWare(w, delay = 0) {
    const s = this.sprite(w.art, w.platz.x, w.platz.y, 0, 30);   // vor dem Obst (zIndex 20…25): gewinnt am Rand
    s.anchor.set(0.5, 0.95);
    w.sprite = s;
    w.ruhe = skalaFuer(w.art, WARE_HOEHE * (w.art === 'common/futter_milch' ? 1.15 : 1));
    this.after(delay, () => {
      if (s.destroyed) return;
      ton('common/plopp', { vol: 0.45, abstand: 0.12 });
      this.tween(s, { scale: w.ruhe }, 0.5, { ease: 'backOut' }).then(() => { if (!s.destroyed) this.machWare(w); });
    });
  }

  wareWeg(w) {
    const s = w.sprite;
    if (!s || s.destroyed) return;
    w.ziehen?.off();
    s.eventMode = 'none';
    this.tween(s, { alpha: 0, scale: s.scale.x * 0.6 }, 0.4, { ease: 'sineInOut' }).then(() => { if (!s.destroyed) s.destroy(); });
  }

  machWare(w) {
    const s = w.sprite;
    if (!w.ruhe) w.ruhe = s.scale.x;
    s.eventMode = 'static';
    const sk = w.ruhe || 1;
    w.ziehen = drag(s, {
      hitArea: new PIXI.Rectangle(-120 / sk, -(WARE_HOEHE + 80) / sk, 240 / sk, (WARE_HOEHE + 120) / sk),
      lift: 1.12,
      back: true,
      heim: () => w.platz,
      targets: () => (this.gast?.bereit ? [{ id: 'gast', ...this.gastMitte(), radius: 300 }] : []),
      onDrop: (ziel, ctx) => {
        const getippt = Math.hypot(s.x - ctx.startX, s.y - ctx.startY) < 25;
        // Gast wartet: gezogen zum Gast oder einfach angetippt – er bekommt die Ware (jede ist ihm recht)
        if (this.gast?.bereit && (ziel || getippt)) { this.geben(w); return; }
        if (getippt) { fx.wobble(s, 0.06); ton('common/plopp', { vol: 0.4, abstand: 0.3 }); }
        ctx.back(0.4);
      },
    });
  }

  gastMitte() {
    const g = this.gast;
    return { x: g.x, y: g.y - GAST_HOEHE * 0.5 };
  }

  glockeGetippt() {
    ton('common/klingel', { vol: 0.55, abstand: 0.9 });
    fx.wobble(this.glocke, 0.08);
    if (this.phase !== 'glocke') return;
    this.glockePuls?.stop();
    this.glockePuls = null;
    this.gastKommt();
  }

  async gastKommt() {
    this.phase = 'gastKommt';
    const id = this.gaesteRunde[this.gaesteDa] || pick(GAESTE);
    const skala = (GAST_HOEHE * (id === 'maus' ? 0.85 : id === 'schaf' ? 1.1 : 1)) / (meta(`tiere/${id}_idle`).h || 900);
    const g = new Actor(id, { x: GAST_START.x, y: GAST_START.y, scale: skala, parent: this.welt, z: 200 });
    g.alpha = 0;
    g.flip = true;   // schaut nach links
    this.gast = g;
    g.onTap(() => {
      if (g.bereit && g.wunsch && !g._blase) { laut(id); g.bubble(g.wunsch, 2.6, { seite: 'links' }); return; }
      fx.wobble(g, 0.05);
      laut(id);
    });
    engeTippflaeche(g, { breite: 1.0, oben: 0.02, unten: 30 });
    this.tween(g, { alpha: 1 }, 0.5, { ease: 'sineInOut' });
    laut(id, 0.5);
    await this.gang(() => g.walkTo(GAST.x, GAST.y, { tempo: 260 }));
    if (g.destroyed) return;
    g.position.set(GAST.x, GAST.y);
    await g.lookAt(GAST.x + 999);   // schaut zum Laden
    g.wunsch = this.waehleWunsch();
    this.letzterWunsch = g.wunsch;
    g.bereit = true;
    this.schritt('gast');
    g.bubble(g.wunsch, 3.0, { seite: 'links' });
  }

  // Was möchte der Gast? Zuerst die frischen Früchte, dann etwas anderes von der Theke (nicht zweimal dasselbe)
  waehleWunsch() {
    const obst = this.obstAufTheke.filter((w) => w.sprite && !w.sprite.destroyed && !w.weg);
    if (this.gaesteDa === 0 && obst.length) return this.fruchtId;
    const alle = [...this.theke.map((w) => w.art), ...(obst.length ? [this.fruchtId] : [])];
    const arten = alle.filter((a) => a !== this.letzterWunsch);
    return pick(arten.length ? arten : alle);
  }

  async geben(w) {
    const g = this.gast;
    if (!g || !g.bereit) return;
    const art = w.art === 'obst' ? this.fruchtVon(w) : w.art;
    const s = w.sprite;
    // Jede Ware ist dem Gast recht (kein „falsch"); das Gedachte bringt nur ein paar Funkelsterne mehr
    const gedacht = art === g.wunsch;
    g.bereit = false;
    w.ziehen?.off();
    s.eventMode = 'none';
    s.zIndex = 400;
    const m = g.point('mouth');
    await bogenFlug(this, s, m.x, m.y + 40, { dauer: 0.5, hoehe: 90, tempo: FLUG_TEMPO });
    ton('common/plopp', { vol: 0.5 });
    await this.tween(s, { scale: s.scale.x * 0.2, alpha: 0 }, 0.35, { ease: 'quadIn' });
    if (!s.destroyed) s.destroy();
    // Ware nachlegen (Obst nicht – der Haufen wird kleiner)
    if (w.art === 'obst') {
      w.weg = true;
      this.obstAufTheke = this.obstAufTheke.filter((x) => x !== w);
    } else {
      this.neueWare(w, 0.6);
    }
    if (gedacht && !g.destroyed) this.burst('funkeln', g.x, g.y - GAST_HOEHE * 0.85, { count: 3 });
    await g.cheer();
    this.gaesteDa++;
    const letzter = this.gaesteDa >= GAESTE_JE_RUNDE;
    // Gast geht (rechts hinaus) – die nächste Glocke darf schon läuten
    if (letzter) this.ladenFertig();
    else this.schritt('glocke');
    this.gast = null;
    await this.gang(() => {
      this.tween(g, { alpha: 0 }, 0.6, { ease: 'sineInOut', delay: 1.6 });
      return g.walkTo(GAST_START.x - 200, GAST.y, { tempo: 280 });
    });
    if (!g.destroyed) g.destroy({ children: true });
  }

  fruchtVon(w) {
    return w.sprite?.label || this.fruchtId;
  }

  async ladenFertig() {
    this.phase = 'fertig';
    await this.wait(0.8);
    this.neueFahne();
    const neu = ['bauernhof_hofladen', ...this.gaesteRunde.map((id) => 'tier_' + id)]
      .filter((id) => stickerVon(id) && !gesammelt().includes(id));
    belohne(this, neu[0] || 'bauernhof_hofladen', this.dach.x0 + 160, this.dach.y + 140);
    await this.wait(2.4);
    // neue Früchte wachsen – sobald die Kiste wieder unter dem Baum steht
    if (this.kisteAufAnhaenger) this.wartetAufKiste = true;
    else this.neueErnte();
  }

  // ---------------------------------------------------------------- Igel (Überraschung)

  async igelHilft() {
    const f = this.imGras[this.imGras.length - 1];
    if (!f || f.destroyed) return;
    const skala = 230 / (meta('tiere/igel_idle').h || 900);
    const igel = new Actor('igel', { x: -1380, y: f.heim.y + 10, scale: skala, parent: this.welt, z: 160 });
    this.igel = igel;
    igel.onTap(() => { fx.wobble(igel, 0.05); laut('igel', 1.2); });
    f.reserviert = true;
    f.ziehen?.off();
    f.eventMode = 'none';
    this.imGras = this.imGras.filter((x) => x !== f);
    const n = this.inKiste++;
    laut('igel', 0.5);
    await this.gang(() => igel.walkTo(f.heim.x - 40, f.heim.y + 10, { tempo: 200 }));
    if (igel.destroyed || f.destroyed) return;
    // die Frucht hüpft auf den Rücken
    const ruecken = () => ({ x: igel.x + (igel.flip ? 12 : -12), y: igel.y - 118 });
    f.zIndex = 170;
    await bogenFlug(this, f, ruecken().x, ruecken().y, { dauer: 0.45, hoehe: 60 });
    igel.hop(30);
    // Mit der Frucht zur Kiste: die Frucht reitet mit
    const ziel = { x: this.kiste.x - KISTE.breite / 2 - 60, y: this.kiste.y - 10 };
    const mit = this.every(0, () => {
      if (f.destroyed || igel.destroyed || f.abgesetzt) return;
      const r = ruecken();
      f.position.set(r.x, r.y + igel.koerper.y);
    });
    await this.gang(() => igel.walkTo(ziel.x, ziel.y, { tempo: 200 }));
    mit?.kill?.();
    f.abgesetzt = true;
    if (igel.destroyed || f.destroyed) return;
    const lokal = this.kistenPlatz(n);
    const zielG = this.welt.toLocal(this.kiste.toGlobal(lokal));
    f.zIndex = 300;
    await bogenFlug(this, f, zielG.x, zielG.y, { dauer: 0.55, hoehe: 120, skala: f.ruhe * KISTE_FRUCHT });
    if (!f.destroyed) this.legeInKiste(f, n);
    igel.cheer();
    await this.wait(1.4);
    await this.gang(() => {
      this.tween(igel, { alpha: 0 }, 0.6, { ease: 'sineInOut', delay: 1.2 });
      return igel.walkTo(-1380, igel.y, { tempo: 220 });
    });
    if (!igel.destroyed) igel.destroy({ children: true });
    this.igel = null;
  }

  // ---------------------------------------------------------------- Ablauf

  update(dt, t) {
    this.wolken.update(dt);
    this.vogel.update(dt);
    if (this.fahrt > 0) {
      // der Traktor ruckelt leicht, ab und zu ein Rauchwölkchen
      this.traktor.y = Math.sin(t * 13) * 2.5;
      this.anhaenger.y = Math.sin(t * 13 + 1.3) * 1.5;
      this.rauchZeit -= dt;
      if (this.rauchZeit <= 0) {
        this.rauchZeit = 0.7;
        this.rauch(1);
      }
    }
    if (this.gast && !this.gast.destroyed) this.gast.zIndex = 200;
  }

  // Ziele der Zeige-Hand: immer der nächste Schritt (nie leer)
  hinweise() {
    const da = (x) => x && !x.destroyed;
    switch (this.phase) {
      case 'ernte': {
        const f = this.imGras.find((x) => da(x) && x.eventMode === 'static');
        if (f) return [{ von: f, nach: this.kiste }];
        if (this.imBaum.length) return [this.kronenMitte];
        return [this.kiste];
      }
      case 'voll':
        return [{ von: this.kiste, nach: this.anhaenger }];
      case 'aufladen':
      case 'fahren':
      case 'unterwegs':
        return [this.traktorWrap];
      case 'abladen':
      case 'ladeAus':
        return [this.kiste];
      case 'glocke':
        return [this.glocke];
      case 'gastKommt':
        return da(this.gast) ? [this.gast] : [this.glocke];
      case 'gast': {
        const g = this.gast;
        if (!da(g)) return [this.glocke];
        const w = [...this.theke, ...this.obstAufTheke].find((x) => da(x.sprite) && (x.art === 'obst' ? this.fruchtVon(x) : x.art) === g.wunsch);
        return w ? [{ von: w.sprite, nach: g }, g] : [g];
      }
      default:
        return [this.kronenMitte];
    }
  }
}
