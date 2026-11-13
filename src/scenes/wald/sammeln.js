// Seite 3 – Picknick im Wald. Sammeln auf dem Waldboden und den Tisch für die Tiere decken.
//
// Eine Runde:
//   1. Decke ausrollen – die zusammengerollte Decke nach rechts ziehen (oder antippen): sie rollt sich aus.
//   2. Gäste – drei Tiere kommen nacheinander und setzen sich hinter die Decke. Vor jedem steht ein Holzteller; ein
//      blasses Bild auf dem Teller (und die Denkblase) zeigt, was es gern möchte. Die meisten wünschen sich zwei
//      Dinge (der Bär immer – er hat großen Hunger): das zweite zeigt es, sobald das erste auf dem Teller liegt.
//   3. Sammeln – links wachsen Pilze, Beeren, Zapfen, Eicheln, Kastanien, Blätter. Antippen → hüpft in den Korb
//      auf dem Baumstumpf. Die Zeige-Hand führt so: erst das Gewünschte in den Korb tippen, dann
//   4. Tisch decken – aus dem Korb (hineingreifen – es kommt heraus, worauf die Hand zeigt) auf den Teller ziehen.
//      Vom Boden direkt geht auch. Passt es, liegt es auf dem Teller und das Tier freut sich. Passt es nicht, schaut
//      das Tier es freundlich an, zeigt noch einmal seinen Wunsch, und das Ding hüpft zurück.
//   5. Guten Appetit – sind alle Teller voll, warten die Gäste: ein Tipp auf einen Gast (oder seinen Teller), und er
//      isst. Haben alle gegessen, wird geteilt, was im Korb ist. Der Specht trommelt, es gibt einen Sticker, und an
//      der Wimpelkette oben kommt ein Wimpel dazu (bleibt gespeichert).
//   6. Aufräumen – die Gäste gehen nacheinander, die Decke rollt sich ein. Nächste Runde: andere Gäste, andere Wünsche.
// Wie bisher: Specht antippen → klopft; ein buntes Blatt segelt ab und zu vom Baum (antippen → in den Korb);
// ein Schmetterling gaukelt herum. Ein Eichhörnchen als Gast wünscht sich immer eine Nuss.
// Runde 3: Auch Eule und Reh kommen zum Picknick (3 von 7 Gästen, am längsten nicht dran).

import { spr, tex, meta, sfx, voice, note, tap, drag, Actor, fx, store, rand, pick, shuffle, clamp, killTweensOf, PIXI } from '../../engine/index.js';
import { Seite } from '../../gemeinsam/seiten.js';
import { belohne } from '../../gemeinsam/sticker.js';
import { jubel, laut, geheZu, blase, tiefe, bogen, flugDauer, Schmetterling, waehleArten, waehleSticker, mamaFuer } from './deko.js';

const DINGE = ['pilz_rot', 'pilz_braun', 'himbeere', 'blaubeere_zweig', 'tannenzapfen', 'eichel', 'kastanie', 'blatt_bunt'];
const NUESSE = ['eichel', 'kastanie'];
const DING_HOEHE = 215;        // Höhe eines Fundstücks vorn (Einheiten)
const SORTE_GROESSE = { kastanie: 0.8, eichel: 0.88, himbeere: 0.85, tannenzapfen: 0.95 };
// Fundplätze links auf der Wiese (rechts liegt die Decke)
// zwei Reihen mit viel Abstand: die Tippflächen überdecken sich nicht
const FUND_ORTE = [
  { x: -900, y: 1095 }, { x: -630, y: 1080 }, { x: -360, y: 1095 }, { x: -115, y: 1070 },
  { x: -790, y: 1440 }, { x: -510, y: 1445 }, { x: -230, y: 1440 },
];
const KORB_SKALA = 0.62;
const KORB_MAX = 8;            // mehr passt nicht in den Korb (ein weiteres Ding wackelt und bleibt liegen)
const IM_KORB = 0.5;
const KORB_PLAETZE = [[-62, -150], [58, -152], [-5, -162], [-95, -138], [95, -140], [30, -170], [-40, -172], [5, -146]];
const TIPP_WEG = 90;
const RASCHEL_PAUSE = 700;     // ms
const RUHE_FUER_WUNSCH = 2.5;
// Picknickdecke (Mitte, Breite) und die zusammengerollte Decke
const DECKE = { x: 420, y: 1240, breite: 960 };
const ROLLE_BREITE = 300;
const ROLLE_START = 150;          // so weit rechts vom linken Deckenrand liegt die Rolle (Abstand zu den Fundstücken)
// Gäste: Sitzplätze hinter der Decke; Teller vorn auf der Decke
const SITZE = [{ x: 130, y: 1132 }, { x: 420, y: 1118 }, { x: 710, y: 1132 }];
const TELLER_Y = 1262;
const TELLER_BREITE = 215;
const TELLER_DX = 50;          // zwei Dinge auf einem Teller: so weit links/rechts der Mitte
const GAST_TEMPO = 380;
const RAND_DRAUSSEN = 1460;    // ab hier ist ein gehender Gast aus dem Bild (Tablet: sichtbar bis 1280)
const GAESTE_SPEICHER = 'wald.zuletzt.picknick';
const GAESTE = {
  hase: { hoehe: 290, mag: ['himbeere', 'blaubeere_zweig', 'pilz_braun'] },
  igel: { hoehe: 235, mag: ['pilz_rot', 'pilz_braun', 'blaubeere_zweig'] },
  eichhoernchen: { hoehe: 270, mag: ['eichel', 'kastanie'] },
  fuchs: { hoehe: 290, mag: ['himbeere', 'blaubeere_zweig', 'pilz_rot'] },
  baer: { hoehe: 335, mag: ['himbeere', 'blaubeere_zweig', 'tannenzapfen'] },
  // Runde 3: mehr Gäste
  eule: { hoehe: 270, mag: ['blaubeere_zweig', 'himbeere', 'eichel'] },
  reh: { hoehe: 330, mag: ['himbeere', 'blaubeere_zweig', 'pilz_braun'] },
};
const SPECHT = { x: 545, y: 430, hoehe: 290 };
// Wimpelkette oben: wächst mit jedem Picknick um einen Wimpel (gespeichert)
const WIMPEL_SPEICHER = 'wald.wimpel';
const WIMPEL_MAX = 14;
const WIMPEL_FARBEN = [0xe8574b, 0xf2b33d, 0x6cb86a, 0x4f9bd9, 0xb07cc6, 0xf28fb0];
const KETTE = { x0: -860, x1: 860, y: 62, durchhang: 70 };

export class Sammeln extends Seite {
  static hg = 'wald/hg_sammeln';

  aufbau() {
    this.orte = FUND_ORTE;
    this.funde = new Array(this.orte.length).fill(null);
    this.imKorb = [];
    this.gaeste = [];
    this.phase = 'decke';      // 'decke' | 'ausrollen' | 'gaeste' | 'decken' | 'appetit' | 'essen' | 'aufraeumen'
    this.blasenFrei = 0;       // ab wann (s, performance.now) die nächste Wunsch-Blase dran ist
    this.runden = 0;
    this.letztesRascheln = -1e9;

    // Korb auf dem Baumstumpf. Berühren = hineingreifen: ein Ding kommt heraus und hängt am Finger.
    const stumpf = this.punkt('stumpf', { x: -905, y: 590 });
    this.korb = spr('wald/sammelkorb', { x: stumpf.x + 10, y: stumpf.y + 35, scale: KORB_SKALA, parent: this.welt, z: 700 });
    tap(this.korb, (e) => this.korbGriff(e), { sound: null, squash: false, pad: 30 });

    this.baueDecke();
    const start = shuffle(DINGE);
    if (!start.slice(0, this.orte.length).some((d) => NUESSE.includes(d))) start[0] = 'eichel';
    this.orte.forEach((_, i) => this.wachse(i, start[i % start.length], true));

    this.baueSpecht();
    this.baueKette();
    this.schmetterling = new Schmetterling(this, {
      x: -300, y: 760, bereich: { x0: -800, x1: 800, y0: 620, y1: 860 }, parent: this.welt,
    });
    this.blatt = null;
    this.every(13, () => { if (this.aktiv) this.blattFaellt(); });
    this.every(17, () => { if (this.aktiv && Math.random() < 0.5) this.klopfen(true); });
    this.every(9, () => { if (this.aktiv) this.erinnern(); });
  }

  betreten() {
    if (this.besuche === 1) {
      this.after(1, () => voice('wald_decke', { nurWenn: () => this.aktiv && this.phase === 'decke' }));
    }
  }

  raschel(vol) {
    const jetzt = performance.now();
    if (jetzt - this.letztesRascheln < RASCHEL_PAUSE) return;
    this.letztesRascheln = jetzt;
    sfx('common/rascheln', { vol });
  }

  // ---------------------------------------------------------------- Decke

  baueDecke() {
    const t = tex('wald/picknickdecke');
    const skala = DECKE.breite / (t.width || 981);
    this.decke = spr('wald/picknickdecke', { anchor: 0.5, x: DECKE.x, y: DECKE.y, scale: skala, parent: this.welt, z: 1000 });
    this.decke.eventMode = 'none';
    const h = t.height * skala;
    this.deckeH = h;
    this.x0 = DECKE.x - DECKE.breite / 2;
    this.x1 = DECKE.x + DECKE.breite / 2;
    // Maske: ein Rechteck, das von links nach rechts breiter wird (nur skaliert, nie neu gezeichnet)
    this.deckeMaske = new PIXI.Graphics().rect(0, -h / 2 - 20, DECKE.breite + 10, h + 40).fill(0xffffff);
    this.deckeMaske.position.set(this.x0 - 5, DECKE.y);
    this.welt.addChild(this.deckeMaske);
    this.decke.mask = this.deckeMaske;
    this.deckeAuf = 0;

    const tr = tex('wald/picknickdecke_rolle');
    this.rolleSkala = ROLLE_BREITE / (tr.width || 600);
    this.rolleY = DECKE.y + h / 2 + 12;
    this.rolle = spr('wald/picknickdecke_rolle', { x: this.x0 + ROLLE_START, y: this.rolleY, scale: this.rolleSkala, parent: this.welt, z: 1500 });
    this.rolle.zieh = drag(this.rolle, {
      pad: 70,
      lift: 1.05,
      sound: null,
      targets: [],
      onStart: () => {
        if (this.phase !== 'decke') return;
        this.raschel(0.4);
      },
      onMove: (_, ctx) => {
        if (this.phase !== 'decke') { this.rolle.y = this.rolleY; return; }
        // nur waagrecht – und nur nach rechts: die Decke rollt mit dem Finger aus
        const k = clamp((ctx.x - (this.x0 + ROLLE_START)) / (DECKE.breite - ROLLE_START), 0, 1);
        this.setzeDecke(Math.max(this.deckeAuf, k));
      },
      onDrop: (_, ctx) => {
        ctx.erledigt = true;
        this.rolle.zIndex = 1500;
        if (this.phase === 'decke') this.ausrollen();
      },
    });
    this.setzeDecke(0);
  }

  // k = 0 (eingerollt) … 1 (ganz ausgebreitet)
  setzeDecke(k) {
    this.deckeAuf = k;
    this.deckeMaske.scale.x = Math.max(0.001, k);   // die Decke bleibt sichtbar – sonst zeichnet sich die Maske selbst
    this.rolle.x = this.x0 + ROLLE_START + k * (DECKE.breite - ROLLE_START);
    this.rolle.y = this.rolleY;
    const s = this.rolleSkala * (1 - 0.45 * k);
    this.rolle.scale.set(s);
  }

  async ausrollen() {
    if (this.phase !== 'decke') return;
    this.phase = 'ausrollen';
    this.rolle.eventMode = 'none';
    sfx('common/wusch', { vol: 0.35 });
    const p = { k: this.deckeAuf };
    await this.tween(p, { k: 1 }, 0.4 + (1 - p.k) * 1.2, { ease: 'sineInOut', onUpdate: () => this.setzeDecke(p.k) });
    await this.tween(this.rolle, { alpha: 0 }, 0.5, { ease: 'sineInOut' });
    this.rolle.visible = false;
    this.raschel(0.4);
    this.gaesteKommen();
  }

  async einrollen() {
    this.rolle.visible = true;
    this.rolle.alpha = 0;
    this.setzeDecke(1);
    await this.tween(this.rolle, { alpha: 1 }, 0.5, { ease: 'sineInOut' });
    sfx('common/wusch', { vol: 0.3 });
    const p = { k: 1 };
    await this.tween(p, { k: 0 }, 1.5, { ease: 'sineInOut', onUpdate: () => this.setzeDecke(p.k) });
    this.setzeDecke(0);
    this.rolle.eventMode = 'static';
    this.phase = 'decke';
  }

  // ---------------------------------------------------------------- Gäste

  gaesteKommen() {
    this.phase = 'gaeste';
    // die Gäste, die am längsten nicht da waren
    const arten = waehleArten(Object.keys(GAESTE), SITZE.length, GAESTE_SPEICHER);
    // wie viele Wünsche: der Bär immer zwei; meist hat ein anderer Gast nur einen (5 oder 6 Dinge je Runde)
    const anzahl = arten.map(() => 2);
    const andere = arten.map((a, i) => i).filter((i) => arten[i] !== 'baer');
    if (andere.length && Math.random() < 0.67) anzahl[pick(andere)] = 1;
    // Wünsche: je Gast verschieden, über die Gäste möglichst verschieden; lieber etwas, das schon da ist
    const vergeben = new Set();
    const wuensche = arten.map((art, i) => {
      const liste = [];
      for (let k = 0; k < anzahl[i]; k++) {
        const mag = GAESTE[art].mag.filter((w) => !liste.includes(w));
        const neu = mag.filter((w) => !vergeben.has(w));
        const auswahl = neu.length ? neu : mag;
        const da = auswahl.filter((w) => this.verfuegbar(w));
        const w = pick(da.length && k === 0 ? da : auswahl);
        liste.push(w);
        vergeben.add(w);
      }
      return liste;
    });
    // Sitze von links nach rechts: wer am weitesten gehen muss, kommt zuerst (niemand läuft durch einen anderen).
    // Höchstens zwei Gäste laufen zugleich: der dritte geht erst los, wenn der erste sitzt.
    const ankunft = [];
    this.gaeste = arten.map((art, i) => {
      const warten = i === 0 ? Promise.resolve() : i === 1 ? this.wait(1.4) : ankunft[i - 2].then(() => this.wait(0.2));
      const g = this.gastKommt(art, wuensche[i], SITZE[i], warten);
      ankunft.push(g.angekommen);
      return g;
    });
    for (const g of this.gaeste) this.sorgeFuer(g.wunsch);
  }

  gastKommt(art, wuensche, sitz, warten) {
    const def = GAESTE[art];
    const g = mamaFuer(art, { x: 1450, y: sitz.y, parent: this.welt, z: sitz.y });   // das Reh kommt aus dem Wald-Paket
    g.scale.set(def.hoehe / 900);
    g.art = art;
    g.hoehe = def.hoehe;
    g.wuensche = wuensche;
    g.nr = 0;                  // so viele Wünsche liegen schon auf dem Teller
    g.wunsch = wuensche[0];    // der jetzige Wunsch (null = Teller voll)
    g.teile = [];              // Dinge auf dem Teller
    g.sitz = sitz;
    g.da = false;
    g.bedient = false;         // Teller voll
    g.gegessen = false;
    g.onTap(() => this.gastGetippt(g));
    // Teller (zuerst unsichtbar) mit blassem Bild des Wunsches
    const tt = tex('wald/holzteller');
    const ts = TELLER_BREITE / (tt.width || 360);
    g.teller = spr('wald/holzteller', { anchor: 0.5, x: sitz.x, y: TELLER_Y, scale: ts, parent: this.welt, z: 1300 });
    g.teller.alpha = 0;
    tap(g.teller, () => this.gastGetippt(g), { sound: null, squash: false, hitArea: new PIXI.Rectangle(-0.5 * tt.width - 30 / ts, -0.5 * tt.height - 70 / ts, tt.width + 60 / ts, tt.height + 140 / ts) });
    g.geist = null;
    g.angekommen = (async () => {
      await warten;
      if (g.destroyed) return false;
      const ok = await geheZu(this, g, sitz.x, sitz.y, { tempo: GAST_TEMPO });
      if (!ok || g.destroyed) return false;
      g.da = true;
      g.lookAt(-1000);
      g.zIndex = sitz.y;
      this.tween(g.teller, { alpha: 1 }, 0.6, { ease: 'sineInOut' });
      this.zeigeGeist(g, 0.3);
      sfx('common/klack', { vol: 0.3 });
      this.wunschBlase(g, 2.8, 0.5);
      if (this.gaeste.every((x) => x.da) && this.phase === 'gaeste') {
        this.phase = 'decken';
        if (this.runden === 0) this.after(1.6, () => voice('wald_teller', { nurWenn: () => this.aktiv && this.phase === 'decken' && !this.gaeste.some((x) => x.nr > 0) }));
      }
      return true;
    })();
    return g;
  }

  // Platz Nr. i auf dem Teller eines Gasts (ein Wunsch: Mitte; zwei: links und rechts)
  tellerPlatz(g, i) {
    const dx = g.wuensche.length < 2 ? 0 : (i === 0 ? -TELLER_DX : TELLER_DX);
    return { x: g.teller.x + dx, y: TELLER_Y };
  }

  // Blasses Bild des jetzigen Wunschs auf seinem Platz des Tellers (weich)
  zeigeGeist(g, verz = 0) {
    if (!g.wunsch) return;
    const wid = 'wald/' + g.wunsch;
    const wt = tex(wid);
    const f = g.wuensche.length < 2 ? 0.62 : 0.5;
    const p = this.tellerPlatz(g, g.nr);
    const geist = spr(wid, { x: p.x, y: p.y + 18, scale: (DING_HOEHE * f) / Math.max(wt.width, wt.height, 1), parent: this.welt, z: 1301 });
    geist.alpha = 0;
    geist.eventMode = 'none';
    g.geist = geist;
    this.tween(geist, { alpha: 0.38 }, 0.8, { ease: 'sineInOut', delay: verz });
  }

  // Denkblase mit dem Wunsch – immer nur eine zur Zeit (sie kommen nacheinander), außer das Kind tippt den Gast an
  wunschBlase(g, sek, verz = 0, sofort = false) {
    const jetzt = performance.now() / 1000;
    const start = sofort ? jetzt + verz : Math.max(jetzt + verz, this.blasenFrei);
    this.blasenFrei = start + sek + 0.7;
    this.after(start - jetzt, () => {
      if (g.destroyed || !g.wunsch || !this.aktiv) return;
      if (sofort) {
        for (const x of this.gaeste) {
          const b = x._blase;
          if (x === g || !b || b.destroyed) continue;
          killTweensOf(b, ['alpha', 'scale', 'scaleX', 'scaleY']);
          this.tween(b, { alpha: 0 }, 0.25, { ease: 'sineInOut' }).then(() => { if (!b.destroyed) b.destroy({ children: true }); });
        }
      }
      blase(g, 'wald/' + g.wunsch, sek, 2000);
    });
  }

  gastGetippt(g) {
    if (g.destroyed) return;
    if (!g.da) { fx.wobble(g, 0.05); return; }
    if (this.phase === 'appetit' && g.bedient && !g.gegessen) { this.gastIsst(g); return; }
    if (g.bedient || this.phase === 'essen') { jubel(this, g, { herzen: 2 }); return; }
    fx.wobble(g, 0.05);
    laut(g);
    this.wunschBlase(g, 2.4, 0, true);
  }

  // Unbediente Gäste zeigen in einer ruhigen Pause noch einmal ihren Wunsch; beim Guten Appetit nickt ein Gast,
  // der noch wartet
  erinnern() {
    if (this.szene.idle < RUHE_FUER_WUNSCH || this.ziehtGerade()) return;
    if (this.phase === 'appetit') {
      const wartet = this.gaeste.filter((g) => !g.destroyed && g.bedient && !g.gegessen);
      if (wartet.length) { const g = pick(wartet); g.nod(); laut(g, 2); }
      return;
    }
    if (this.phase !== 'decken') return;
    const offen = this.gaeste.filter((g) => !g.destroyed && g.da && !g.bedient);
    if (!offen.length) return;
    const g = pick(offen);
    this.wunschBlase(g, 2.6);
    if (g.art === 'eichhoernchen' && NUESSE.includes(g.wunsch)) {
      voice('wald_nuss', { nurWenn: () => this.aktiv && this.phase === 'decken' && !g.bedient && this.szene.idle >= RUHE_FUER_WUNSCH });
    }
  }

  // Gibt es dieses Ding gerade am Boden oder im Korb (und nicht schon auf einem Teller)?
  verfuegbar(art) {
    return [...this.funde, ...this.imKorb].some((d) => d && !d.destroyed && d.art === art && !d.serviert);
  }

  // Sicherstellen, dass ein gewünschtes Ding zu finden ist: auf einem freien Platz wachsen lassen oder ein
  // nicht gewünschtes Ding weich gegen das gewünschte tauschen
  sorgeFuer(art) {
    if (this.verfuegbar(art)) return;
    const frei = this.funde.findIndex((d) => !d || d.destroyed);
    if (frei >= 0) { this.wachse(frei, art); return; }
    const gewuenscht = new Set(this.gaeste.flatMap((g) => (g.wuensche || []).slice(g.nr)));
    const i = this.funde.findIndex((d) => d && !d.destroyed && !d.unterwegs && !gewuenscht.has(d.art));
    if (i < 0) return;
    const alt = this.funde[i];
    this.funde[i] = null;
    alt.eventMode = 'none';
    this.tween(alt, { alpha: 0 }, 0.5, { ease: 'sineInOut' }).then(() => {
      if (!alt.destroyed) alt.destroy();
      this.wachse(i, art);
    });
  }

  // ---------------------------------------------------------------- Fundstücke

  wachse(i, art = null, sofort = false) {
    if (this.funde[i] && !this.funde[i].destroyed) return;
    const ort = this.orte[i];
    if (!art) {
      // zuerst, was ein Gast noch braucht; sonst Abwechslung
      const braucht = this.gaeste.filter((g) => !g.destroyed && !g.bedient && !this.verfuegbar(g.wunsch)).map((g) => g.wunsch);
      const amBoden = new Set(this.funde.filter((d) => d && !d.destroyed).map((d) => d.art));
      const frisch = DINGE.filter((d) => !amBoden.has(d));
      art = braucht.length ? pick(braucht) : pick(frisch.length ? frisch : DINGE);
    }
    const f = tiefe(ort.y, { y0: 1050, y1: 1420, f0: 0.86, f1: 1.08 });
    const id = 'wald/' + art;
    const skala = (DING_HOEHE * f * (SORTE_GROESSE[art] ?? 1)) / Math.max(tex(id).width, tex(id).height, 1);
    const s = spr(id, { x: ort.x, y: ort.y, parent: this.welt, z: ort.y, scale: skala });
    this.machSammelbar(s, art, i, skala);
    this.funde[i] = s;
    if (!sofort) {
      s.scale.set(0.01);
      s.alpha = 0;
      sfx('common/wachsen', { vol: 0.4 });
      this.tween(s, { alpha: 1 }, 0.5, { ease: 'sineInOut' });
      this.tween(s, { scale: skala }, 0.9, { ease: 'backOut' });
    }
  }

  machSammelbar(s, art, platz, skala) {
    s.art = art;
    s.platz = platz;
    s.ruheSkala = skala;
    s.inKorb = false;
    s.unterwegs = false;
    s.zieh = drag(s, {
      pad: 55,
      lift: 1.12,
      sound: null,
      targets: () => this.ziele(s),
      onStart: () => {
        s.unterwegs = true;
        if (!s.inKorb) sfx('common/tipp', { vol: 0.7 });
      },
      onDrop: (ziel, ctx) => this.losgelassen(s, ziel, ctx),
    });
  }

  ziele(s) {
    const liste = [];
    if (!s.inKorb) liste.push({ id: 'korb', obj: this.korb, radius: 320 });
    if (this.phase === 'decken' || this.phase === 'gaeste') {
      for (const g of this.gaeste) {
        if (g.destroyed || !g.da || g.bedient) continue;
        liste.push({ id: 'gast', gast: g, x: g.teller.x, y: g.teller.y - 40, radius: 235 });
        liste.push({ id: 'gast', gast: g, x: g.x, y: g.y - g.hoehe * 0.5, radius: 190 });
      }
    }
    return liste;
  }

  losgelassen(s, ziel, ctx) {
    ctx.erledigt = true;
    const weg = Math.hypot(ctx.x - ctx.startX, ctx.y - ctx.startY);
    if (weg >= TIPP_WEG && ziel?.id === 'gast') { this.anbieten(s, ziel.gast); return; }
    if (s.inKorb) { this.zurueckInDenKorb(s); return; }
    if (weg < TIPP_WEG || ziel?.id === 'korb') {
      if (this.imKorb.length >= KORB_MAX) {
        // Korb ist voll: kurz wackeln, bleibt liegen
        fx.wobble(this.korb, 0.05);
        this.heim(s);
        return;
      }
      this.inDenKorb(s);
      return;
    }
    ctx.back(0.4).then(() => { if (!s.destroyed && !s.inKorb) s.unterwegs = false; });
  }

  nachVorn(s) {
    s.zIndex = 5000;
    this.after(0.55, () => { if (!s.destroyed && s.unterwegs) s.zIndex = 5000; });
  }

  async inDenKorb(s) {
    s.eventMode = 'none';
    s.unterwegs = true;
    killTweensOf(s, ['x', 'y', 'scale', 'scaleX', 'scaleY', 'alpha', 'rotation']);
    this.freierPlatz(s);
    s.inKorb = true;
    this.nachVorn(s);
    const ziel = this.korbPlatz(this.imKorb.length);
    this.imKorb.push(s);
    sfx('common/hupf', { vol: 0.6 });
    if (s.rotation) this.tween(s, { rotation: 0 }, 0.6, { ease: 'sineInOut' });
    await bogen(this, s, ziel, { dauer: 0.7, hoehe: 260, skala: s.ruheSkala * IM_KORB });
    if (s.destroyed) return;
    this.imKorbAblegen(s);
    sfx('common/plopp', { vol: 0.5 });
    fx.pop(this.korb, 0.05);
  }

  // Fundplatz wird frei: dort wächst bald etwas Neues
  freierPlatz(s) {
    const platz = s.platz;
    if (platz >= 0 && this.funde[platz] === s) {
      this.funde[platz] = null;
      this.after(rand(2.5, 4.5), () => this.wachse(platz));
    }
    s.platz = -1;
  }

  async zurueckInDenKorb(s) {
    s.unterwegs = true;
    killTweensOf(s, ['x', 'y', 'scale', 'scaleX', 'scaleY', 'alpha']);
    this.nachVorn(s);
    let i = this.imKorb.indexOf(s);
    if (i < 0) i = this.imKorb.push(s) - 1;
    sfx('common/hupf', { vol: 0.45 });
    await bogen(this, s, this.korbPlatz(i), { dauer: 0.6, hoehe: 180, skala: s.ruheSkala * IM_KORB });
    if (s.destroyed) return;
    this.imKorbAblegen(s);
    sfx('common/plopp', { vol: 0.4 });
    fx.pop(this.korb, 0.04);
  }

  imKorbAblegen(s) {
    s.inKorb = true;
    s.unterwegs = false;
    s.eventMode = 'none';
    s.zIndex = this.korb.zIndex - 1;
    this.after(0.6, () => { if (!s.destroyed && s.inKorb && !s.unterwegs) s.zIndex = this.korb.zIndex - 1; });
  }

  korbPlatz(n) {
    const [dx, dy] = KORB_PLAETZE[n % KORB_PLAETZE.length];
    return { x: this.korb.x + dx, y: this.korb.y + dy };
  }

  // In den Korb greifen: am liebsten kommt etwas heraus, das ein Gast sich wünscht
  korbGriff(e) {
    this.raschel(0.35);
    fx.wobble(this.korb, 0.05);
    if (this.phase === 'essen') return;
    const frei = this.imKorb.filter((d) => !d.destroyed && !d.unterwegs);
    if (!frei.length) return;
    // heraus kommt, worauf die Zeige-Hand zeigt (erster Hinweis vom Korb zu einem Teller) – sonst etwas Gewünschtes
    const hand = this.handZiele().find((z) => z.von && z.von.inKorb && frei.includes(z.von));
    const wuensche = this.gaeste.filter((g) => !g.destroyed && !g.bedient).map((g) => g.wunsch);
    const d = hand?.von || frei.find((x) => wuensche.includes(x.art)) || frei[frei.length - 1];
    killTweensOf(d, ['x', 'y', 'scale', 'scaleX', 'scaleY', 'alpha']);
    d.scale.set(d.ruheSkala);
    d.position.set(e.x, e.y + d.texture.height * d.ruheSkala * 0.5);
    d.zIndex = 5000;
    sfx('common/plopp', { vol: 0.4 });
    const g = this.welt.toGlobal({ x: e.x, y: e.y });
    d.emit('pointerdown', { pointerId: e.pointerId, global: new PIXI.Point(g.x, g.y), stopPropagation() {} });
    if (!d.zieh.isDragging()) this.zurueckInDenKorb(d);
  }

  ausDemKorb(s) {
    const i = this.imKorb.indexOf(s);
    if (i >= 0) this.imKorb.splice(i, 1);
    this.imKorb.forEach((d, n) => {
      if (d.destroyed || d.unterwegs) return;
      const p = this.korbPlatz(n);
      this.tween(d, { x: p.x, y: p.y }, 0.4, { ease: 'sineInOut' });
    });
  }

  async heim(s) {
    s.eventMode = 'none';
    if (s.inKorb) return this.zurueckInDenKorb(s);
    const ort = this.orte[s.platz] || { x: s.x, y: s.y };
    await bogen(this, s, ort, { dauer: 0.6, hoehe: 160, skala: s.ruheSkala });
    if (s.destroyed) return;
    s.unterwegs = false;
    s.eventMode = 'static';
    s.zIndex = s.y;
  }

  // Zum Gast gebracht: passt es, kommt es auf den Teller; sonst schaut der Gast es an und es hüpft zurück
  async anbieten(s, g) {
    s.unterwegs = true;
    killTweensOf(s, ['x', 'y', 'scale', 'scaleX', 'scaleY', 'alpha']);
    if (!g || g.destroyed || g.bedient || s.art !== g.wunsch) {
      this.nachVorn(s);
      if (g && !g.destroyed) {
        g.lookAt(s.x);
        fx.wobble(g, 0.04);
        if (!g.bedient) this.wunschBlase(g, 2.4, 0.3, true);
        this.after(1.2, () => { if (!g.destroyed && g.da) g.lookAt(-1000); });
      }
      await this.wait(0.25);
      await this.heim(s);
      return;
    }
    // passt!
    const platz = g.nr;
    const zweiDinge = g.wuensche.length > 1;
    g.teile.push(s);
    g.nr++;
    g.wunsch = g.wuensche[g.nr] || null;
    g.bedient = !g.wunsch;
    s.serviert = true;
    s.eventMode = 'none';
    s.zieh?.off();
    if (s.inKorb) { this.ausDemKorb(s); s.inKorb = false; } else this.freierPlatz(s);
    this.nachVorn(s);
    const skala = s.ruheSkala * (zweiDinge ? 0.62 : 0.78);
    const ort = this.tellerPlatz(g, platz);
    const geist = g.geist;
    g.geist = null;
    await bogen(this, s, { x: ort.x, y: ort.y + 22 }, { dauer: 0.5, hoehe: 90, skala });
    if (s.destroyed || g.destroyed) return;
    s.unterwegs = false;
    s.zIndex = g.teller.zIndex + 2 + platz;
    if (geist && !geist.destroyed) this.tween(geist, { alpha: 0 }, 0.5, { ease: 'sineInOut' }).then(() => { if (!geist.destroyed) geist.destroy(); });
    sfx('common/plopp', { vol: 0.45 });
    const n = this.gaeste.reduce((summe, x) => summe + x.nr, 0);
    note('xylo', [72, 74, 76, 79, 81, 84][Math.min(5, n - 1)], { vol: 0.35 });
    jubel(this, g, { herzen: 3 });
    if (!g.bedient) {
      // der nächste Wunsch: blasses Bild auf dem zweiten Platz, Denkblase, und er ist sicher zu finden
      this.zeigeGeist(g, 0.6);
      this.wunschBlase(g, 2.6, 1.2, true);
      this.sorgeFuer(g.wunsch);
      return;
    }
    if (this.gaeste.every((x) => x.bedient) && this.phase === 'decken') {
      this.phase = 'appetit';
      // alle schauen zum Kind: Guten Appetit? (ein Tipp auf einen Gast – er isst)
      this.after(1.4, () => {
        for (const x of this.gaeste) if (!x.destroyed) x.lookAt(x.x - 100);
      });
    }
  }

  // Guten Appetit: ein Gast isst, was auf seinem Teller liegt
  async gastIsst(g) {
    if (g.gegessen || g.destroyed) return;
    g.gegessen = true;
    g.pose('eat');
    sfx('common/mampf', { vol: 0.6 });
    g.teile.forEach((d, i) => this.after(i * 0.35, () => {
      if (d.destroyed) return;
      const s0 = Math.abs(d.scale.y);
      this.tween(d, { scale: s0 * 0.2, alpha: 0 }, 0.8, { ease: 'quadIn' }).then(() => { if (!d.destroyed) d.destroy(); });
    }));
    g.teile = [];
    await this.wait(1.3);
    if (g.destroyed) return;
    g.pose('idle');
    jubel(this, g, { herzen: 3 });
    if (this.phase === 'appetit' && this.gaeste.every((x) => x.destroyed || x.gegessen)) {
      this.phase = 'essen';
      this.after(1.4, () => this.essen());
    }
  }

  // ---------------------------------------------------------------- Picknick

  async essen() {
    const gaeste = this.gaeste.filter((g) => !g.destroyed);
    // was im Korb ist, wird geteilt (nie mehr als zwei Dinge fliegen zugleich)
    const gegessen = new Set();
    const fluege = await this.verteilen(gaeste, gegessen);
    if (fluege.length) await Promise.all(fluege);
    for (const g of gaeste) if (!g.destroyed) g.pose('idle');
    // freuen: nacheinander, höchstens zwei zugleich
    gaeste.forEach((g, i) => this.after(i * 0.75, () => jubel(this, g, { herzen: 4 })));
    this.klopfen();
    await this.wait(1.4);
    belohne(this, waehleSticker(['wald_beeren', ...gaeste.map((g) => (g.art === 'reh' ? 'wald_reh' : 'tier_' + g.art))]), DECKE.x, 820);
    this.runden++;
    this.after(1.2, () => this.neuerWimpel());
    await this.wait(3.6);
    this.aufraeumen();
  }

  async verteilen(gaeste, gegessen) {
    const fluege = [];
    let n = 0;
    const hier = gaeste.filter((g) => !g.destroyed);
    if (!hier.length) return fluege;
    for (;;) {
      const d = this.imKorb.find((x) => !x.destroyed && !x.unterwegs);
      if (!d) break;
      // Nüsse am liebsten zum Eichhörnchen
      const tier = (NUESSE.includes(d.art) && hier.find((g) => g.art === 'eichhoernchen')) || hier[n++ % hier.length];
      d.unterwegs = true;
      d.eventMode = 'none';
      this.ausDemKorb(d);
      d.zIndex = 5000;
      sfx('common/hupf', { vol: 0.45 });
      gegessen.add(tier);
      const s0 = Math.abs(d.scale.y);
      const m = tier.point('mouth');
      const ziel = { x: m.x, y: m.y + d.texture.height * s0 * 0.45 };
      const dauer = flugDauer(d, ziel, 0.6, 220);
      fluege.push((async () => {
        await bogen(this, d, ziel, { dauer: 0.6, hoehe: 220, skala: s0 });
        if (d.destroyed) return;
        if (tier.destroyed) { d.destroy(); return; }
        tier.pose('eat');
        sfx('common/mampf', { vol: 0.5 });
        await this.tween(d, { scale: s0 * 0.15, alpha: 0 }, 0.35, { ease: 'quadIn' });
        if (!d.destroyed) d.destroy();
      })());
      await this.wait(Math.max(0.5, dauer * 0.55));
    }
    return fluege;
  }

  async aufraeumen() {
    this.phase = 'aufraeumen';
    const gaeste = this.gaeste;
    for (const g of gaeste) {
      if (g.destroyed) continue;
      for (const o of [g.teller, g.geist, ...g.teile]) {
        if (!o || o.destroyed) continue;
        o.eventMode = 'none';
        this.tween(o, { alpha: 0 }, 0.6, { ease: 'sineInOut' }).then(() => { if (!o.destroyed) o.destroy(); });
      }
    }
    // von rechts nach links gehen sie (niemand läuft durch einen anderen); höchstens zwei laufen zugleich: der
    // dritte geht erst, wenn der erste draußen ist
    const reihe = gaeste.filter((g) => !g.destroyed).sort((a, b) => b.x - a.x);
    const draussen = (g) => g.destroyed || g.x > RAND_DRAUSSEN;
    for (let i = 0; i < reihe.length; i++) {
      const g = reihe[i];
      if (i > 0) await this.wait(1.2);
      for (let k = 0; i >= 2 && k < 40 && !draussen(reihe[i - 2]); k++) await this.wait(0.2);
      if (g.destroyed) continue;
      g.da = false;
      g.lookAt(1600);
      geheZu(this, g, 1600, g.y, { tempo: GAST_TEMPO }).then((ok) => {
        if (g.destroyed) return;
        if (ok) g.destroy({ children: true });
        else this.tween(g, { alpha: 0 }, 0.6, { ease: 'sineInOut' }).then(() => { if (!g.destroyed) g.destroy({ children: true }); });
      });
    }
    for (let k = 0; k < 40 && !reihe.every(draussen); k++) await this.wait(0.2);
    await this.wait(0.6);
    this.gaeste = [];
    await this.einrollen();
  }

  // ---------------------------------------------------------------- Wimpelkette

  baueKette() {
    this.kette = new PIXI.Container({ label: 'wimpel' });
    this.kette.zIndex = 250;
    this.kette.eventMode = 'none';
    this.welt.addChild(this.kette);
    let n = Number(store.get(WIMPEL_SPEICHER, 0)) || 0;
    n = clamp(Math.floor(n), 0, WIMPEL_MAX);
    this.wimpelZahl = n;
    this.schnur = new PIXI.Graphics();
    this.kette.addChild(this.schnur);
    this.zeichneSchnur();
    for (let i = 0; i < n; i++) this.wimpel(i);
  }

  ketteOrt(t) {
    return { x: KETTE.x0 + (KETTE.x1 - KETTE.x0) * t, y: KETTE.y + 4 * KETTE.durchhang * t * (1 - t) };
  }

  zeichneSchnur() {
    const g = this.schnur;
    g.clear();
    if (!this.wimpelZahl) return;
    const a = this.ketteOrt(0);
    g.moveTo(a.x, a.y);
    for (let i = 1; i <= 24; i++) { const p = this.ketteOrt(i / 24); g.lineTo(p.x, p.y); }
    g.stroke({ width: 5, color: 0x8a6a45, alpha: 0.9 });
  }

  wimpel(i) {
    // Plätze von der Mitte nach außen abwechselnd
    const k = Math.floor((i + 1) / 2);
    const t = 0.5 + (i % 2 ? -1 : 1) * k * (0.5 / (WIMPEL_MAX / 2 + 0.5)) - (i === 0 ? 0 : 0);
    const p = this.ketteOrt(clamp(t, 0.03, 0.97));
    const w = new PIXI.Graphics()
      .moveTo(-34, 0).lineTo(34, 0).lineTo(0, 84).closePath()
      .fill(WIMPEL_FARBEN[i % WIMPEL_FARBEN.length])
      .moveTo(-34, 0).lineTo(34, 0).lineTo(0, 84).closePath()
      .stroke({ width: 3, color: 0xffffff, alpha: 0.5 });
    w.position.set(p.x, p.y - 2);
    w.rotation = (t - 0.5) * -0.35;
    this.kette.addChild(w);
    return w;
  }

  neuerWimpel() {
    if (this.wimpelZahl >= WIMPEL_MAX) {
      // Kette voll: ein Wimpel wackelt fröhlich
      const w = this.kette.children[1 + Math.floor(rand(0, this.wimpelZahl))];
      if (w) fx.wobble(w, 0.1);
      return;
    }
    const erste = this.wimpelZahl === 0;
    this.wimpelZahl++;
    store.set(WIMPEL_SPEICHER, this.wimpelZahl);
    if (erste) {
      this.zeichneSchnur();
      this.schnur.alpha = 0;
      this.tween(this.schnur, { alpha: 1 }, 0.8, { ease: 'sineInOut' });
    }
    const w = this.wimpel(this.wimpelZahl - 1);
    w.alpha = 0;
    const y = w.y;
    w.y = y - 30;
    this.tween(w, { alpha: 1, y }, 0.9, { ease: 'sineOut' });
    note('glocke', 84, { vol: 0.15 });
  }

  // ---------------------------------------------------------------- Specht

  baueSpecht() {
    const id = 'wald/specht';
    const t = tex(id);
    this.specht = spr(id, { x: SPECHT.x, y: SPECHT.y, anchor: [0.78, 0.62], scale: SPECHT.hoehe / (t.height || 400), parent: this.welt, z: 300 });
    this.specht.x += (0.78 - 0.5) * t.width * this.specht.scale.x;
    this.specht.y += (0.62 - 0.5) * t.height * this.specht.scale.y;
    const s = this.specht.scale.x;
    tap(this.specht, () => this.klopfen(), {
      sound: null,
      squash: false,
      hitArea: new PIXI.Rectangle(-0.78 * t.width - 50 / s, -0.62 * t.height - 30 / s, t.width + 100 / s, t.height + 60 / s),
    });
  }

  async klopfen(leise = false) {
    if (this.klopft) return;
    this.klopft = true;
    const sp = this.specht;
    sfx('common/specht', { vol: leise ? 0.35 : 0.8 });
    for (let i = 0; i < 3; i++) {
      if (!(await this.tween(sp, { rotation: 0.2 }, 0.1, { ease: 'quadIn' }))) break;
      if (i === 0) {
        const p = this.welt.toLocal(sp.toGlobal({ x: 35, y: -160 }));
        this.burst('staub', p.x + 20, p.y, { count: 3 });
      }
      if (!(await this.tween(sp, { rotation: 0 }, 0.16, { ease: 'sineOut' }))) break;
    }
    sp.rotation = 0;
    this.klopft = false;
  }

  // ---------------------------------------------------------------- Blatt segelt herab

  blattFaellt() {
    if (this.blatt && !this.blatt.destroyed) return;
    const x0 = rand(-700, -150);
    const skala = 0.3;
    const b = spr('wald/blatt_bunt', { anchor: 0.5, x: x0, y: -60, scale: skala, parent: this.welt, z: 4500 });
    this.blatt = b;
    b.weg = rand(0, 10);
    b.boden = rand(930, 990);
    b.fang = tap(b, () => this.blattFangen(b), { sound: null, squash: false, hitArea: new PIXI.Circle(0, 0, 130 / skala) });
  }

  blattFangen(b) {
    if (b.destroyed || b.gefangen) return;
    b.gefangen = true;
    b.fang.off();
    this.blatt = null;
    killTweensOf(b, ['alpha']);
    b.alpha = 1;
    if (this.imKorb.length >= KORB_MAX) {
      fx.wobble(this.korb, 0.05);
      this.tween(b, { alpha: 0 }, 0.6, { ease: 'sineInOut' }).then(() => { if (!b.destroyed) b.destroy(); });
      return;
    }
    const m = meta('wald/blatt_bunt');
    const ay = m?.ay ?? 0.986;
    const ax = m?.ax ?? 0.5;
    b.x += (ax - 0.5) * b.texture.width * b.scale.x;
    b.y += (ay - 0.5) * b.texture.height * b.scale.y;
    b.anchor.set(ax, ay);
    sfx('common/tipp', { vol: 0.6 });
    const t = tex('wald/blatt_bunt');
    this.machSammelbar(b, 'blatt_bunt', -1, (DING_HOEHE * 0.95) / Math.max(t.width, t.height, 1));
    this.inDenKorb(b);
  }

  // ---------------------------------------------------------------- Ablauf

  ziehtGerade() {
    return this.welt.children.some((c) => !c.destroyed && c.zieh?.isDragging?.());
  }

  update(dt) {
    this.schmetterling.update(dt);
    const b = this.blatt;
    if (b && !b.destroyed && !b.liegt) {
      b.weg += dt;
      b.y += 95 * dt;
      b.x += Math.sin(b.weg * 1.3) * 70 * dt;
      b.rotation = Math.sin(b.weg * 1.3) * 0.5;
      if (b.y >= b.boden) {
        b.liegt = true;
        b.zIndex = b.y;
        this.after(5, () => {
          if (!b.destroyed && !b.gefangen) {
            this.tween(b, { alpha: 0 }, 1, { ease: 'sineInOut' }).then((ok) => { if (ok && !b.destroyed && !b.gefangen) b.destroy(); });
          }
        });
      }
    }
  }

  // Wohin die Zeige-Hand beim Tischdecken zeigt – je Gast (von links): liegt sein Wunsch im Korb: vom Korb zum
  // Teller; liegt er am Boden: antippen (hüpft in den Korb) – ist der Korb voll, direkt zum Teller; sonst der Gast.
  handZiele() {
    const liste = [];
    const korbVoll = this.imKorb.length >= KORB_MAX;
    for (const g of this.gaeste) {
      if (g.destroyed || !g.da || g.bedient) continue;
      const frei = (d) => d && !d.destroyed && d.art === g.wunsch && !d.unterwegs && !d.serviert;
      // im Korb – oder gerade auf dem Weg hinein (dann zeigt die Hand schon vom Korb zum Teller)
      const imKorb = this.imKorb.find((d) => d && !d.destroyed && d.art === g.wunsch && !d.serviert && d.inKorb);
      if (imKorb) { liste.push({ von: imKorb, nach: g.teller }); continue; }
      const amBoden = this.funde.find((d) => frei(d) && d.eventMode !== 'none');
      if (amBoden) { liste.push(korbVoll ? { von: amBoden, nach: g.teller } : amBoden); continue; }
      liste.push(g);
    }
    return liste;
  }

  hinweise() {
    if (this.phase === 'decke') return [{ von: this.rolle, nach: { x: this.x1 - 80, y: this.rolleY - 60 } }];
    if (this.phase === 'decken' || this.phase === 'gaeste') {
      const liste = this.handZiele();
      if (liste.length) return liste;
    }
    if (this.phase === 'appetit') {
      const wartet = this.gaeste.filter((g) => !g.destroyed && g.bedient && !g.gegessen);
      if (wartet.length) return wartet;
    }
    if (this.phase === 'gaeste' || this.phase === 'ausrollen') {
      const boden = this.funde.find((d) => d && !d.destroyed && d.eventMode !== 'none');
      return boden ? [boden] : [this.korb];
    }
    return [this.specht];
  }
}
