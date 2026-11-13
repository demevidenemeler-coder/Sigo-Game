// Abfahrts-Vorbereitung: der Haupt-Ablauf am Bahnhof – eine Runde je Besuch.
//
//   1. Zwei Fahrgäste kommen nacheinander aus dem Bahnhofshaus und halten ihre Fahrkarte hoch.
//      Fahrkarte (oder Gast) antippen → der Schaffner knipst, der Gast freut sich.            (tippen)
//   2. Jeder Gast zeigt in seiner Denkblase seinen Wagen. Gast in den Zug ziehen → er steigt in genau diesen Wagen
//      (gibt es ihn noch nicht, rollt er heran). Egal, wo das Kind ihn ablegt.                  (ziehen)
//   3. Die Gepäckkarre mit dem Gepäck der Gäste zum Zug schieben (oder zweimal antippen) → sie rollt weiter, das
//      Gepäck hüpft in die Wagen der Gäste.                                                    (schieben)
//   4. Lok-Pflege, jede Runde eine andere:
//        wasser: Wassereimer auf die Lok ziehen → sie trinkt                                   (ziehen)
//        putzen: Staub von der Lok wischen → sie glänzt                                         (wischen)
//        dampf:  Lok festhalten → sie macht Dampf (Antippen geht auch, dauert nur länger)       (halten)
//   5. Signal antippen → es wird weich grün.                                                    (tippen)
//   6. Grüne Kelle antippen → Schaffner hebt die Kelle und pfeift, der Zug fährt ab (index.js). (tippen)
//
// Abwechslung: jede Runde ein anderer Ausflug (Gäste + Gepäck, nie zweimal derselbe hintereinander), eine andere
// Lok-Pflege, die Wagen-Wünsche richten sich nach dem Zug; in jeder zweiten Runde ist etwas liegen geblieben
// (Fundstück); nach dem Einsteigen kommt das Tier fürs Wartehäuschen (Nachzügler, index.js).
// Was wächst: Für jede ganz vorbereitete Abfahrt kommt ein Wimpel an die Girlande zwischen Uhrturm und Baum.
//
// Langer Zug: Der Ablauf hängt höchstens bis zu 3 Wagen an; bei 4 Wagen (vom Kind gebaut) hält der Zug weiter links
// (index.js halteX), damit die Lok nie vor der Gepäckkarre steht. Wartende Gäste suchen sich eine Lücke zwischen
// Fahrgästen und Ladung; alles auf dem Bahnsteig hat einen Griff über dem Zug (griff()), damit der Finger es greift.
//
// Nichts kann schiefgehen: Alles geht in jeder Reihenfolge, Falsches gleitet freundlich zurück. Die Zeige-Hand
// (hinweise()) und die Denkblase des Schaffners zeigen immer den nächsten Schritt.

import {
  spr, sfx, voice, note, tap, drag, wipe, onInput, Actor, fx, store, killTweensOf, pick, shuffle, clamp, lerp, ease,
  PIXI,
} from '../../engine/index.js';
import { GAESTE_MENSCHEN, WAGEN_MIT_LADUNG } from '../../gemeinsam/zug.js';

const { Container, Graphics, Sprite, Texture, Rectangle } = PIXI;

const MENSCHEN = new Set(GAESTE_MENSCHEN);
// Der Ablauf selbst hängt höchstens bis zu 3 Wagen an (Wunsch-Wagen, Flachwagen fürs Gepäck); einen vierten baut nur
// das Kind selbst. Ist der Zug voll, steigt der Gast in einen besetzten Wagen (der bisherige Fahrgast geht ins Haus).
const ABLAUF_WAGEN = 3;
// Ebenen in world: der Zug liegt bei 5. Was auf dem Bahnsteig hinter den Wagen steht (Gäste, Karre, Eimer, Schaffner),
// bekommt einen unsichtbaren Griff über dem Zug (GRIFF_Z) – Fahrgäste und Ladung, die über den Wagenrand ragen,
// schnappen dem Kind den Finger dann nicht weg. Was schwebt (Fahrkarte, Fundstück in der Hand), liegt ganz vorn.
const GRIFF_Z = 5.8;
const VORN_Z = 5.9;
const OFFENE = ['wagen_offen_rot', 'wagen_offen_blau', 'wagen_offen_gelb', 'wagen_offen_gruen', 'wagen_offen_lila', 'wagen_offen_orange'];

// Orte auf dem Bahnsteig (Szenen-Koordinaten; links von der Lok, die immer rechts der Mitte steht)
const TUER_X = -490;              // Tür des gemalten Bahnhofshauses
const SCHAFFNER_X = -250;
const PLAETZE = [-445, -665];     // hier warten die zwei Gäste am liebsten (der erste nah beim Schaffner)
const PLATZ_LINKS = -1010;        // linkes Ende des Bahnsteigs, auf dem Gäste warten (Mitte des Gasts)
const EIMER_X = -105;
// Fundstück: Der Schaffner hält es in der Hand (über den Wagen, damit kein Fahrgast es verdeckt)
const FUND_X = SCHAFFNER_X - 48;
const FUND_HOEHE = 118;   // über dem Bahnsteig
const KARRE_X = 950;              // Heimplatz der Gepäckkarre (ganz rechts auf dem Bahnsteig)
const SIGNAL_X = 1120;
const SIGNAL_Y = 1214;            // Fuß des Signals: Graskante zwischen Bahnsteig und Schotter
const MAX_WIMPEL = 10;
const DAMPF_ZEIT = 2.4;           // so lange (Sekunden) die Lok festhalten, bis genug Dampf da ist

// Ausflüge: wer mitfährt und was mitkommt (zwei Gäste und zwei Gepäckstücke werden gezogen)
const AUSFLUEGE = [
  { id: 'hof', gaeste: ['schaf', 'schwein', 'pferd', 'huhn'], gepaeck: ['ladung_heuballen', 'ladung_milchkanne', 'ladung_fass'] },
  { id: 'zoo', gaeste: ['affe', 'elefant', 'giraffe', 'loewe'], gepaeck: ['ladung_apfelkorb', 'ladung_kiste', 'ladung_fass'] },
  { id: 'fest', gaeste: ['kind_m', 'oma', 'kind_j'], gepaeck: ['ladung_geschenk', 'ladung_teddy', 'ladung_ball'] },
  { id: 'reise', gaeste: ['papa', 'oma', 'hund'], gepaeck: ['ladung_koffer', 'ladung_kiste'] },
  { id: 'wald', gaeste: ['fuchs', 'igel', 'eichhoernchen', 'eule', 'baer'], gepaeck: ['ladung_apfelkorb', 'ladung_fass'] },
  { id: 'teich', gaeste: ['ente', 'frosch', 'pinguin'], gepaeck: ['ladung_ball', 'ladung_kiste'] },
  { id: 'spiel', gaeste: ['hase', 'maus', 'katze', 'kind_j'], gepaeck: ['ladung_bausteine', 'ladung_teddy', 'ladung_ball'] },
];
// falls alle Gäste eines Ausflugs schon im Zug sitzen
const ERSATZ_GAESTE = ['hund', 'katze', 'hase', 'schaf', 'ente', 'fuchs', 'kind_m', 'oma'];
const FUNDSACHEN = ['ladung_teddy', 'ladung_ball', 'ladung_geschenk', 'ladung_koffer'];
const PFLEGE = ['wasser', 'putzen', 'dampf'];

// Skalierung der Gäste auf dem Bahnsteig (Tierbilder sind alle 900 hoch, Menschen 800)
const MASS = { maus: 0.15, frosch: 0.16, igel: 0.16, ente: 0.17, huhn: 0.17, eichhoernchen: 0.17, hase: 0.18,
  eule: 0.18, pinguin: 0.18, elefant: 0.23, giraffe: 0.24, pferd: 0.22 };
const skalaVon = (id) => (MENSCHEN.has(id) ? 0.24 : MASS[id] ?? 0.2);

// Was der Schaffner in seiner Denkblase zeigt (nächster Schritt)
const BLASE = {
  karte: 'bahnhof/fahrkarte', gepaeck: 'bahnhof/karre_leer', wasser: 'common/eimer_wasser',
  putzen: 'common/schwamm', dampf: 'common/p_rauch', signal: 'zug/signal_gruen', los: 'bahnhof/fahne_gruen',
};
const STIMME = {
  karte: 'bahnhof_karte', einsteigen: 'bahnhof_tiere', gepaeck: 'bahnhof_gepaeck', wasser: 'bahnhof_wasser',
  putzen: 'bahnhof_putzen', dampf: 'bahnhof_dampf', signal: 'bahnhof_signal', los: 'bahnhof_los',
};
const WIMPEL_FARBEN = [0xe8564a, 0xf6c445, 0x4f9bd9, 0x6cc15a, 0xf2903a, 0xa77bd6];

// Staub auf der Lok: weiche bräunliche Flecken (einmal je Modul gezeichnet und wiederverwendet)
let staubTex = null;
function staubTextur() {
  if (staubTex) return staubTex;
  const c = document.createElement('canvas');
  c.width = 400;
  c.height = 260;
  const g = c.getContext('2d');
  // deutlich sichtbare graubraune Staubwolken (ein Kind soll sofort sehen: Die Lok ist schmutzig)
  const flecken = [[80, 78, 78], [196, 66, 74], [316, 86, 80], [120, 176, 78], [246, 170, 84], [346, 192, 58],
    [52, 196, 50], [196, 122, 70]];
  for (const [x, y, r] of flecken) {
    const v = g.createRadialGradient(x, y, 0, x, y, r);
    v.addColorStop(0, 'rgba(112,90,68,0.92)');
    v.addColorStop(0.62, 'rgba(118,96,72,0.82)');
    v.addColorStop(1, 'rgba(118,96,72,0)');
    g.fillStyle = v;
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
  }
  // ein paar dunklere Krümel obendrauf
  g.fillStyle = 'rgba(84,66,50,0.85)';
  const kruemel = [[70, 64, 9], [150, 96, 7], [226, 54, 8], [292, 118, 10], [338, 70, 7], [108, 196, 8], [262, 196, 9], [200, 150, 6]];
  for (const [x, y, r] of kruemel) {
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
  }
  staubTex = Texture.from(c);
  return staubTex;
}

export class Abfahrt {
  constructor(szene) {
    this.s = szene;
    this.B = szene.boden;
    this.gestartet = false;
    this.aus = false;             // der Zug fährt ab: nichts Neues mehr
    this.gepaeckFertig = false;
    this.pflegeFertig = false;
    this.pflegeAktiv = false;
    this.signalGruen = false;
    this.schrittName = 'warten';
    this.ruhe = 0;                // Sekunden seit der letzten Berührung
    this.erinnert = 0;            // Sekunden seit der letzten Erinnerung (Denkblase)
    this.dampf = 0;               // Dampf-Fortschritt in Sekunden (fertig bei DAMPF_ZEIT)
    this.dampfFinger = false;
    this.dampfTakt = 0;
    this.karreFaehrt = false;
    this.fund = null;
    this.eimer = null;
    this.staub = null;
    this.wisch = null;
    this._zeit = 0;
    this._platzTakt = 0;
    this.griffe = [];             // { c, ding } – unsichtbare Griffe über dem Zug (siehe GRIFF_Z)
    this.waehleRunde();
    this.baueSchaffner();
    this.baueKarre();
    this.baueSignal();
    this.baueGirlande();
    this._abInput = onInput(() => { this.ruhe = 0; });
  }

  // ---------------------------------------------------------------- Runde auswählen

  waehleRunde() {
    const letzter = store.get('bahnhof.ausflug', null);
    this.ausflug = pick(AUSFLUEGE.filter((a) => a.id !== letzter));
    store.set('bahnhof.ausflug', this.ausflug.id);
    const imZug = new Set(this.s.zug.wagen.map((w) => w.gastId).filter(Boolean));
    let wahl = shuffle(this.ausflug.gaeste).filter((id) => !imZug.has(id));
    if (wahl.length < 2) wahl = wahl.concat(shuffle(ERSATZ_GAESTE).filter((id) => !imZug.has(id) && !wahl.includes(id)));
    const gepaeck = shuffle(this.ausflug.gepaeck).slice(0, 2);
    this.gaeste = [0, 1].map((i) => ({
      nr: i, id: wahl[i], platzX: PLAETZE[i], gepaeck: gepaeck[i], actor: null, karte: null, hoehe: 180,
      da: false, geknipst: false, drin: false, gezogen: false, wunschW: null, wunschNeu: null, wunschTyp: null,
    }));
    this.gepaeck = gepaeck;
    const letztePflege = store.get('bahnhof.pflege', null);
    this.pflege = pick(PFLEGE.filter((p) => p !== letztePflege));
    store.set('bahnhof.pflege', this.pflege);
    const rest = FUNDSACHEN.filter((id) => !gepaeck.includes(id));
    this.fundId = Math.random() < 0.5 ? pick(rest) : null;
  }

  /** Der Zug steht: die Gäste kommen. */
  start() {
    if (this.gestartet) return;
    this.gestartet = true;
    this.s.after(0.8, () => this.kommGast(this.gaeste[0]));
    this.s.after(2.8, () => this.kommGast(this.gaeste[1]));
  }

  // ---------------------------------------------------------------- Schaffner

  baueSchaffner() {
    const a = new Actor('schaffner', { pack: 'bahnhof', x: SCHAFFNER_X, y: this.B, scale: 0.5, parent: this.s.world, z: 3 });
    a.flip = true;   // schaut zu den Gästen (nach links)
    this.schaffner = a;
    this._schaffnerTon = -9;
    a.onTap(() => {
      if (this.aus) return;
      a.hop(40);
      if (this._zeit - this._schaffnerTon > 1.5) {
        this._schaffnerTon = this._zeit;
        sfx('common/pfiff', { vol: 0.3, rate: 1.45 });
      }
      this.zeigeNaechstes();
    }, { pad: 60 });
    this.griffFuerFigur(a, 200);
  }

  // ---------------------------------------------------------------- Griffe über dem Zug

  /**
   * Unsichtbare Tippfläche über dem Zug für ein Ding auf dem Bahnsteig (Kind von world). Ein Finger darauf wirkt
   * genau wie ein Finger auf dem Ding selbst: dessen tap()/drag() bekommt das pointerdown. flaeche in world-Einheiten,
   * bezogen auf den Ort des Dings.
   */
  griff(ding, flaeche) {
    const c = new Container({ label: 'griff:' + (ding.label || ding.tierId || 'ding') });
    c.zIndex = GRIFF_Z;
    c.hitArea = flaeche;
    c.eventMode = 'static';
    c.position.set(ding.x, ding.y);
    c.on('pointerdown', (e) => {
      if (ding.destroyed || !ding.parent || ding.eventMode === 'none' || !ding.visible || ding.alpha < 0.3) return;
      ding.emit('pointerdown', e);
    });
    this.s.world.addChild(c);
    this.griffe.push({ c, ding });
    return c;
  }

  /** Griff für eine stehende Figur (Fußpunkt = Ort), hoehe in world-Einheiten. */
  griffFuerFigur(a, hoehe) {
    if (!a || a.destroyed) return null;
    const breite = Math.max(150, (a.sprite?.texture?.width || 500) * Math.abs(a.scale.x) * 0.8);
    return this.griff(a, new Rectangle(-breite / 2 - 40, -hoehe - 50, breite + 80, hoehe + 70));
  }

  // Griffe folgen ihren Dingen; fertige (zerstörte) verschwinden
  stelleGriffe() {
    for (let i = this.griffe.length - 1; i >= 0; i--) {
      const { c, ding } = this.griffe[i];
      if (ding.destroyed || !ding.parent) {
        if (!c.destroyed) c.destroy();
        this.griffe.splice(i, 1);
        continue;
      }
      c.position.set(ding.x, ding.y);
      const an = !this.aus && ding.eventMode !== 'none' && ding.visible && ding.alpha >= 0.3;
      c.eventMode = an ? 'static' : 'none';
    }
  }

  /** Grün, während die Fahrgäste noch ankommen: Der Schaffner schaut zur Tür, die Gäste freuen sich, gleich geht's los. */
  zeigeAnkunft() {
    if (this.aus) return;
    const a = this.schaffner;
    a.lookAt(TUER_X - 200);
    a.hop(30);
    this.s.after(1.4, () => { if (!a.destroyed && !this.aus) a.lookAt(SCHAFFNER_X - 200); });
    for (const g of this.gaeste) if (g.actor && !g.actor.destroyed && !g.drin) fx.wobble(g.actor, 0.04);
  }

  // Denkblase mit dem nächsten Schritt (beim Schaffner; beim Einsteigen zeigen die Gäste ihren Wagen)
  zeigeNaechstes() {
    if (this.aus) return;
    const n = this.schrittName;
    this.erinnert = 0;
    if (n === 'einsteigen') {
      for (const g of this.gaeste) if (g.da && !g.drin && g.actor) this.zeigeWunsch(g);
      return;
    }
    const bild = BLASE[n === 'pflege' ? this.pflege : n];
    if (bild) this.schaffner.bubble(bild, 2.6, { seite: 'rechts' });
  }

  // ---------------------------------------------------------------- Gäste

  kommGast(g) {
    if (this.aus || g.actor) return;
    const s = this.s;
    const mensch = MENSCHEN.has(g.id);
    const skala = skalaVon(g.id);
    const a = new Actor(g.id, { pack: mensch ? 'zug' : 'tiere', x: TUER_X, y: this.B, scale: skala, parent: s.world, z: 3 });
    g.actor = a;
    g.hoehe = (mensch ? 800 : 900) * skala * 0.97;
    g.breite = Math.max(110, (a.sprite?.texture?.width || 500) * skala * 0.8);
    g.platzX = this.platzFuer(g);
    a.alpha = 0;
    s.tween(a, { alpha: 1 }, 0.5, { ease: 'sineInOut' });
    s.ton('common/tuer', 1, { vol: 0.45 });

    // Fahrkarte: schwebt neben dem Kopf, ein wenig auf und ab
    const k = new Container({ label: 'fahrkarte' });
    spr('bahnhof/fahrkarte', { anchor: 0.5, scale: 0.55, parent: k });
    k.zIndex = VORN_Z;   // schwebt: liegt vor dem Zug (kein Fahrgast verdeckt sie)
    k.alpha = 0;
    k._phase = g.nr * 1.7;
    s.world.addChild(k);
    s.tween(k, { alpha: 1 }, 0.5, { ease: 'sineInOut', delay: 0.3 });
    g.karte = k;
    this.stelleKarte(g);
    tap(k, () => this.knipsen(g), { sound: null, squash: false, hitArea: new Rectangle(-120, -100, 240, 200) });

    a.walkTo(g.platzX, this.B, { tempo: 190 }).then((ok) => {
      if (!ok || a.destroyed) return;
      g.da = true;
      a.lookAt(SCHAFFNER_X);
    });
    a.onTap(() => this.gastTipp(g), { pad: 70 });
    this.griffFuerFigur(a, g.hoehe);
    drag(a, {
      lift: 1.08,
      pad: 70,
      heim: () => ({ x: g.platzX, y: this.B }),
      targets: () => (s.modus === 'steht' && !this.aus ? s.zugZiele() : []),
      onStart: () => {
        g.gezogen = true;
        g.da = true;
      },
      onDrop: (ziel, ctx) => {
        g.gezogen = false;
        // Nur angetippt (kaum bewegt): kein Einsteigen – das Antippen knipst bzw. zeigt den Wunsch-Wagen
        if (Math.hypot(ctx.x - ctx.startX, ctx.y - ctx.startY) < 40) return false;
        // auch zwischen zwei Wagen oder auf der Kupplung losgelassen: steigt ein
        if (!ziel && !s.ueberZug(a.x, a.y)) {
          s.after(0.5, () => { if (!a.destroyed && !g.drin) a.lookAt(SCHAFFNER_X); });
          return false;
        }
        return this.einsteigen(g);
      },
    });
  }

  // x-Bereiche (world, Paare von/bis) dessen, was im Zug über den Wagenrand ragt: Fahrgäste und Ladung.
  // dx: so weit rückt der Zug noch (beim Hereinrollen/Rangieren zählt schon sein Halteplatz).
  hoheDinge(dx) {
    const s = this.s;
    const liste = this._hohe || (this._hohe = []);
    liste.length = 0;
    for (const w of s.zug.wagen) {
      for (const d of [w.gast, w.ladung]) {
        if (!d || d.destroyed || !d.visible) continue;
        const b = d.getBounds();
        const p0 = s.world.toLocal({ x: b.x, y: b.y });
        const p1 = s.world.toLocal({ x: b.x + b.width, y: b.y });
        liste.push(p0.x + dx, p1.x + dx);
      }
    }
    return liste;
  }

  // Wie stark ein Gast an der Stelle x verdeckt wäre (Breite der Überdeckung in Einheiten)
  verdeckt(x, halb, hohe) {
    let summe = 0;
    for (let i = 0; i < hohe.length; i += 2) summe += Math.max(0, Math.min(x + halb, hohe[i + 1]) - Math.max(x - halb, hohe[i]));
    return summe;
  }

  // Wo wartet ein Gast? Auf dem Bahnsteig links der Lok, möglichst in einer Lücke zwischen Fahrgästen und Ladung im
  // Zug (sonst sähe man von kleinen Tieren nur den Kopf), nicht vor dem Schaffner und nicht beim anderen Gast –
  // und lieber nah an seinem gewohnten Platz.
  platzFuer(g) {
    const s = this.s;
    const z = s.zug;
    const dx = s.modus === 'faehrt' ? 0 : s.halteX() - z.x;
    const halb = (g.breite || 160) / 2;
    const hohe = this.hoheDinge(dx);
    const rechts = s.lokLinks() + dx - halb - 30;
    const links = PLATZ_LINKS + halb;
    let best = PLAETZE[g.nr];
    let bestWert = Infinity;
    for (let x = links; x <= rechts; x += 15) {
      let wert = this.verdeckt(x, halb, hohe) * 3 + Math.abs(x - PLAETZE[g.nr]) * 0.35;
      if (Math.abs(x - SCHAFFNER_X) < halb + 70) wert += 900;
      for (const o of this.gaeste) {
        if (o === g || !o.actor || o.drin || o.actor.destroyed) continue;
        if (Math.abs(x - o.platzX) < halb + (o.breite || 160) / 2 + 20) wert += 900;
      }
      if (wert < bestWert) {
        bestWert = wert;
        best = x;
      }
    }
    return Math.round(best);
  }

  // Ab und zu (und wenn sich der Zug verändert hat): Steht ein wartender Gast hinter Fahrgästen oder Ladung, geht er
  // ein paar Schritte zu einer freieren Stelle.
  pruefePlaetze() {
    const s = this.s;
    if (s.modus !== 'steht') return;
    const hohe = this.hoheDinge(s.halteX() - s.zug.x);
    for (const g of this.gaeste) {
      const a = g.actor;
      if (!a || a.destroyed || g.drin || g.gezogen || !g.da || a._laeuft) continue;
      const halb = g.breite / 2;
      const jetzt = this.verdeckt(g.platzX, halb, hohe);
      const rechts = s.lokLinks() - halb - 20;
      if (jetzt < 30 && g.platzX < rechts) continue;
      const neu = this.platzFuer(g);
      if (Math.abs(neu - g.platzX) < 40 || (this.verdeckt(neu, halb, hohe) > jetzt - 30 && g.platzX < rechts)) continue;
      g.platzX = neu;
      a._laeuft = true;
      a.walkTo(neu, this.B, { tempo: 170 }).then((ok) => {
        a._laeuft = false;
        if (ok && !a.destroyed && !g.drin) a.lookAt(SCHAFFNER_X);
      });
    }
  }

  stelleKarte(g) {
    const k = g.karte;
    const a = g.actor;
    if (!k || k.destroyed || !a || a.destroyed || k._fliegt) return;
    k.x = a.x + 92;
    k.y = a.y - g.hoehe - 6 + Math.sin(this._zeit * 1.6 + k._phase) * 7;
  }

  gastTipp(g) {
    if (!g.geknipst && g.karte && !g.karte.destroyed) {
      this.knipsen(g);
      return;
    }
    this.freuen(g.actor);
    if (!g.drin) this.s.after(0.6, () => this.zeigeWunsch(g));
  }

  freuen(a) {
    if (!a || a.destroyed) return;
    if (MENSCHEN.has(a.tierId)) {
      a.pose('happy');
      a.hop(50);
      this.s.ton('common/landen', 0.3, { vol: 0.6 });
      this.s.after(1.2, () => { if (!a.destroyed) a.pose('idle'); });
    } else {
      a.cheer();
    }
  }

  knipsen(g) {
    const k = g.karte;
    if (!k || k.destroyed || k._fliegt) return;
    if (g.geknipst) {
      fx.wobble(k, 0.04);
      return;
    }
    const s = this.s;
    g.geknipst = true;
    s.ton('common/klack', 0.12, { vol: 0.85 });
    this.schaffner.lookAt(g.actor?.x ?? SCHAFFNER_X - 100);
    this.schaffner.nod();
    // Loch in der Karte
    const loch = new Graphics().circle(0, 0, 13).fill({ color: 0x6b4a30, alpha: 0.85 });
    loch.position.set(38, -28);
    k.addChild(loch);
    fx.pop(k, 0.14);
    s.after(0.7, () => {
      if (k.destroyed || g.drin) return;
      k._fliegt = true;
      k.eventMode = 'none';
      const a = g.actor;
      const ziel = a && !a.destroyed ? { x: a.x, y: a.y - g.hoehe * 0.45 } : { x: k.x, y: k.y + 60 };
      s.tween(k, { x: ziel.x, y: ziel.y, scale: 0.35, alpha: 0 }, 0.5, { ease: 'sineInOut' })
        .then(() => { if (!k.destroyed) k.destroy({ children: true }); });
      this.freuen(a);
      this.pruefeSchritt();
      s.after(1.3, () => this.zeigeWunsch(g));
    });
  }

  // In welchen Wagen möchte der Gast? Ein freier Sitz-Wagen (nicht der Wunsch des anderen Gasts); gibt es keinen,
  // ein neuer offener Wagen in einer Farbe, die der Zug noch nicht hat. erzeugen = jetzt wirklich (zum Einsteigen).
  wunschWagen(g, erzeugen = false) {
    const s = this.s;
    const z = s.zug;
    const andere = this.gaeste.filter((x) => x !== g && !x.drin).map((x) => x.wunschW).filter(Boolean);
    const frei = (w) => z.wagen.includes(w) && w.platz?.art === 'sitz' && !w.gast;
    if (g.wunschW && frei(g.wunschW) && !andere.includes(g.wunschW)) return g.wunschW;
    g.wunschW = z.wagen.find((w) => frei(w) && !andere.includes(w)) || null;
    if (g.wunschW) {
      g.wunschTyp = g.wunschW.typ;
      return g.wunschW;
    }
    if (z.wagen.length >= ABLAUF_WAGEN) {
      // genug Wagen: ein Sitz-Wagen, in dem keiner unserer Gäste sitzt (der bisherige Gast geht ins Bahnhofshaus)
      const w = z.wagen.find((x) => x.platz?.art === 'sitz' && !andere.includes(x) && !this.gaeste.some((y) => y.id === x.gastId));
      if (w) {
        g.wunschW = w;
        g.wunschTyp = w.typ;
        return w;
      }
    }
    if (!g.wunschNeu || z.wagen.some((w) => w.typ === g.wunschNeu)) {
      const farben = OFFENE.filter((t) => !z.wagen.some((w) => w.typ === t) && !this.gaeste.some((x) => x !== g && x.wunschNeu === t));
      g.wunschNeu = pick(farben.length ? farben : OFFENE);
    }
    g.wunschTyp = g.wunschNeu;
    if (!erzeugen) return null;
    const w = s.wagenDazu(g.wunschNeu);
    if (w) g.wunschW = w;
    return w || null;
  }

  zeigeWunsch(g) {
    if (this.aus || g.drin || !g.actor || g.actor.destroyed || g.gezogen) return;
    this.wunschWagen(g, false);
    if (g.wunschTyp) g.actor.bubble('zug/' + g.wunschTyp, 2.8);
  }

  einsteigen(g) {
    const s = this.s;
    if (s.modus !== 'steht' || this.aus || g.drin) return false;
    const w = this.wunschWagen(g, true);
    const f = s.gastRein(g.id, w);
    if (!f) return false;
    g.drin = true;
    g.geknipst = true;
    const a = g.actor;
    a.eventMode = 'none';
    s.tween(a, { alpha: 0, scale: a.scale.x * 0.7 }, 0.25, { ease: 'sineInOut' })
      .then(() => { if (!a.destroyed) a.destroy({ children: true }); });
    const k = g.karte;
    if (k && !k.destroyed) {
      k._fliegt = true;
      k.eventMode = 'none';
      s.tween(k, { alpha: 0 }, 0.3, { ease: 'sineInOut' }).then(() => { if (!k.destroyed) k.destroy({ children: true }); });
    }
    this.pruefeSchritt();
    if (this.gaeste.every((x) => x.drin)) {
      // Überraschungen: etwas ist liegen geblieben, und bald wartet noch ein Tier im Häuschen
      if (this.fundId) s.after(2.5, () => this.zeigeFund());
      s.neuerWartegast(this.fundId ? 9 : 5);
    }
    return true;
  }

  // ---------------------------------------------------------------- Fundstück (Überraschung)

  zeigeFund() {
    if (this.aus || this.fund || !this.fundId) return;
    const s = this.s;
    const id = this.fundId;
    const besitzer = pick(this.gaeste);
    const f = spr('zug/' + id, { x: FUND_X, y: this.B - FUND_HOEHE, anchor: 0.5, scale: 0.3, parent: s.world, z: VORN_Z });
    f.alpha = 0;
    this.fund = f;
    s.tween(f, { alpha: 1 }, 0.6, { ease: 'sineInOut' });
    fx.burst('funkeln', FUND_X, this.B - FUND_HOEHE - 30, { count: 3, parent: s.world });
    this.schaffner.lookAt(FUND_X - 200);
    // Der Besitzer im Zug denkt daran
    s.after(0.8, () => {
      const w = s.zug.wagen.find((x) => x.gastId === besitzer.id);
      if (w?.gast && !this.aus && this.fund === f) w.gast.bubble('zug/' + id, 3);
    });
    const laden = () => {
      if (this.aus || f.destroyed || f._weg || s.modus !== 'steht') return false;
      f._weg = true;
      f.eventMode = 'none';
      const w = s.zug.wagen.find((x) => x.gastId === besitzer.id);
      s.tween(f, { alpha: 0, scale: 0.18 }, 0.3, { ease: 'sineInOut' }).then(() => { if (!f.destroyed) f.destroy(); });
      s.ladungRein(id, this.ladeWagen(w));
      if (w) s.after(0.7, () => { if (s.zug.wagen.includes(w)) s.jubeln(w.index); });
      this.fund = null;
      return true;
    };
    drag(f, {
      pad: 70,
      heim: { x: FUND_X, y: this.B - FUND_HOEHE },
      targets: () => (s.modus === 'steht' && !this.aus ? s.zugZiele() : []),
      onDrop: (ziel, ctx) => {
        // nur angetippt: hüpft von selbst in den Zug
        if (!ziel && Math.hypot(ctx.x - ctx.startX, ctx.y - ctx.startY) < 30) return laden();
        if (!ziel) return false;
        return laden();
      },
    });
  }

  // ---------------------------------------------------------------- Gepäckkarre

  baueKarre() {
    const s = this.s;
    const k = new Container({ label: 'karre' });
    k.position.set(KARRE_X, this.B + 4);
    k.zIndex = 2;
    s.world.addChild(k);
    this.karre = k;
    this.karreBild = spr('bahnhof/karre_leer', { scale: 0.5, parent: k });
    // Gepäck auf der Ladefläche (lade_l … lade_r): oben auf, nebeneinander
    this.koffer = this.gepaeck.map((id, i) => {
      const t = spr('zug/' + id, { parent: k });
      t.scale.set(Math.min(82 / t.texture.height, 92 / t.texture.width));
      t.position.set(i === 0 ? -22 : 62, -76);
      t.ladungId = id;
      return t;
    });
    tap(k, (e) => this.karreTipp(e), { sound: null, hitArea: new Rectangle(-150, -205, 300, 215) });
    this.griff(k, new Rectangle(-150, -205, 300, 215));
  }

  // In welchen Wagen kommt ein Gepäckstück? Der bevorzugte (der Wagen seines Gasts), sonst ein leerer Ladewagen.
  // Gibt es keinen, hängt ladungRein() einen Flachwagen an – aber nur, solange der Zug höchstens 2 Wagen hat;
  // sonst tauscht das Gepäck die Ladung im Wagen seines Gasts (bzw. im ersten Ladewagen).
  ladeWagen(bevorzugt) {
    const z = this.s.zug;
    const kann = (w) => !!w && z.wagen.includes(w) && WAGEN_MIT_LADUNG.includes(w.typ);
    if (kann(bevorzugt) && !bevorzugt.ladung) return bevorzugt;
    const leer = z.wagen.find((w) => kann(w) && !w.ladung);
    if (leer) return leer;
    if (z.wagen.length < ABLAUF_WAGEN) return null;
    if (kann(bevorzugt)) return bevorzugt;
    return z.wagen.find(kann) || null;
  }

  // Wohin die Karre rollt: hinter den Wagen des ersten Gasts (sonst den ersten Ladewagen)
  ladeX() {
    const z = this.s.zug;
    const w = this.zielWagen(0) || z.wagen.find((x) => WAGEN_MIT_LADUNG.includes(x.typ)) || z.wagen[0];
    let x = z.x - 150;
    if (w && !w.fahrzeug.destroyed) x = this.s.world.toLocal(w.fahrzeug.getGlobalPosition()).x;
    return clamp(x, -940, KARRE_X - 230);
  }

  zielWagen(i) {
    const g = this.gaeste[i];
    const w = this.s.zug.wagen.find((x) => x.gastId === g?.id);
    return w && WAGEN_MIT_LADUNG.includes(w.typ) && !w.ladung ? w : null;
  }

  karreTipp(e) {
    const s = this.s;
    const k = this.karre;
    if (this.karreFaehrt || this.aus) {
      fx.wobble(this.karreBild, 0.02);
      return;
    }
    if (this.gepaeckFertig || s.modus !== 'steht') {
      // leer: hüpft wie früher
      killTweensOf(k, ['y']);
      const y0 = this.B + 4;
      s.tween(k, { y: y0 - 26 }, 0.16, { ease: 'quadOut' }).then((ok) => {
        if (ok && !k.destroyed) s.tween(k, { y: y0 }, 0.22, { ease: 'quadIn' }).then((ok2) => { if (ok2) s.ton('common/landen', 0.3); });
      });
      return;
    }
    fx.wobble(this.karreBild, 0.02);
    s.ton('common/klack', 0.3, { vol: 0.5 });
    const x0 = k.x;
    const ziel = this.ladeX();
    killTweensOf(k, ['x']);
    s.verfolge(k, e, {
      bewegt: (dx) => {
        if (this.karreFaehrt || k.destroyed) return true;
        k.x = clamp(x0 + dx, ziel, KARRE_X);
        if (KARRE_X - k.x > 170) {
          this.karreLos();
          return true;
        }
        return false;
      },
      ende: () => {
        if (this.karreFaehrt || k.destroyed) return;
        // nur angetippt: ein Stück weiterschieben; nach zwei Stückchen rollt sie von selbst
        const nach = Math.max(ziel, k.x - 95);
        s.tween(k, { x: nach }, 0.5, { ease: 'sineOut' }).then((ok) => {
          if (ok && KARRE_X - k.x > 170) this.karreLos();
        });
      },
    });
  }

  async karreLos() {
    if (this.karreFaehrt || this.gepaeckFertig) return;
    const s = this.s;
    const k = this.karre;
    this.karreFaehrt = true;
    s.ton('common/wusch', 0.5, { vol: 0.35 });
    const ziel = this.ladeX();
    killTweensOf(k, ['x']);
    await s.tween(k, { x: ziel }, clamp(Math.abs(k.x - ziel) / 380, 0.5, 4.5), { ease: 'sineInOut' });
    for (let i = 0; i < this.koffer.length; i++) {
      await s.wait(i === 0 ? 0.2 : 0.55);
      this.einladen(i);
    }
    await s.wait(1.1);
    this.gepaeckFertig = true;
    this.pruefeSchritt();
    await s.tween(k, { x: KARRE_X }, clamp(Math.abs(KARRE_X - k.x) / 320, 0.6, 5), { ease: 'sineInOut' });
    this.karreFaehrt = false;
  }

  // Ein Gepäckstück hüpft im Bogen von der Karre in den Wagen seines Gasts
  einladen(i) {
    const s = this.s;
    const t = this.koffer[i];
    if (!t || t.destroyed) return;
    const id = t.ladungId;
    const w = this.ladeWagen(s.zug.wagen.find((x) => x.gastId === this.gaeste[i]?.id));
    const p = s.world.toLocal(t.getGlobalPosition());
    const skala = Math.abs(t.scale.y);
    s.world.addChild(t);
    t.position.set(p.x, p.y);
    t.zIndex = 6;
    let zx = p.x;
    let zy = this.B + 40;
    if (w && !w.fahrzeug.destroyed) {
      const b = w.fahrzeug.getBounds();
      const m = s.world.toLocal({ x: b.x + b.width / 2, y: b.y });
      zx = m.x;
      zy = m.y - 40;
    }
    s.ton('common/hupf', 0.2, { vol: 0.6 });
    const x0 = p.x;
    const y0 = p.y;
    const q = { t: 0 };
    // weite Würfe dauern länger (Ruhe-Regel: höchstens etwa 1000–1300 Einheiten/s)
    const dauer = clamp(0.55 + Math.hypot(zx - x0, zy - y0) / 900, 0.65, 1.1);
    s.tween(q, { t: 1 }, dauer, {
      ease: 'linear',
      onUpdate: () => {
        if (t.destroyed) return;
        const e = ease.sineInOut(q.t);
        t.x = lerp(x0, zx, e);
        t.y = lerp(y0, zy, e) - 200 * 4 * q.t * (1 - q.t);
      },
    }).then(() => {
      if (t.destroyed) return;
      s.tween(t, { alpha: 0, scale: skala * 0.8 }, 0.15, { ease: 'sineInOut' }).then(() => { if (!t.destroyed) t.destroy(); });
      if (s.modus === 'steht' && !this.aus) s.ladungRein(id, w && s.zug.wagen.includes(w) ? w : null);
    });
  }

  // ---------------------------------------------------------------- Lok-Pflege

  startePflege() {
    if (this.pflegeAktiv || this.pflegeFertig || this.aus) return;
    this.pflegeAktiv = true;
    if (this.pflege === 'wasser') this.baueEimer();
    else if (this.pflege === 'putzen') this.staubAuf(this.s.zug.lok);
  }

  baueEimer() {
    const s = this.s;
    const e = spr('common/eimer_wasser', { x: EIMER_X, y: this.B + 4, anchor: [0.5, 0.96], scale: 0.34, parent: s.world, z: 3.1 });
    e.alpha = 0;
    this.eimer = e;
    this.griff(e, new Rectangle(-130, -190, 260, 210));
    s.tween(e, { alpha: 1 }, 0.6, { ease: 'sineInOut' });
    drag(e, {
      pad: 60,
      heim: { x: EIMER_X, y: this.B + 4 },
      targets: () => (s.modus === 'steht' && !this.aus ? [{ id: 'lok', obj: s.zug.lok.koerper, radius: 340 }] : []),
      onDrop: (ziel) => {
        if (!ziel) return false;
        this.giessen();
        return true;
      },
    });
  }

  async giessen() {
    const s = this.s;
    const e = this.eimer;
    if (!e || e.destroyed || e._giesst) return;
    e._giesst = true;
    e.eventMode = 'none';
    e.zIndex = 6;
    const p = s.zug.punktLok('schornstein') || { x: s.zug.x, y: 900 };
    killTweensOf(e, ['x', 'y', 'rotation']);
    await s.tween(e, { x: p.x - 80, y: p.y - 20 }, 0.35, { ease: 'sineOut' });
    await s.tween(e, { rotation: 0.95 }, 0.45, { ease: 'sineInOut' });
    s.ton('common/giessen', 1, { vol: 0.6 });
    fx.burst('tropfen', p.x, p.y - 30, { count: 5, parent: s.world });
    await s.wait(0.6);
    fx.burst('tropfen', p.x, p.y - 30, { count: 4, parent: s.world });
    await s.wait(0.7);
    s.tween(e, { rotation: 0, alpha: 0 }, 0.6, { ease: 'sineInOut' }).then(() => { if (!e.destroyed) e.destroy(); });
    this.eimer = null;
    this.lokFroh();
  }

  // Staub auf die Lok legen (auch nach einem Lok-Tausch neu)
  staubAuf(lok) {
    if (!lok || lok.destroyed) return;
    this.wisch?.off();
    this.wisch = null;
    if (this.staub && !this.staub.destroyed) this.staub.parent?.destroy({ children: true });
    const t = lok.koerper.texture;
    const ax = lok.koerper.anchor.x;
    const ay = lok.koerper.anchor.y;
    const huelle = new Container({ label: 'staub' });
    const st = new Sprite(staubTextur());
    st.anchor.set(0.5);
    st.width = t.width * 0.8;
    st.height = t.height * 0.62;
    huelle.position.set((0.5 - ax) * t.width, (0.52 - ay) * t.height);
    huelle.addChild(st);
    huelle.alpha = 0;
    lok.rumpf.addChild(huelle);
    this.staub = st;
    this.s.tween(huelle, { alpha: 1 }, 0.6, { ease: 'sineInOut' });
    this.wisch = wipe(st, {
      radius: 110,
      doneAt: 0.75,   // kleine Finger: drei, vier Striche reichen
      sound: 'common/wisch',
      onDone: () => {
        this.wisch = null;
        this.staub = null;
        this.s.after(0.8, () => { if (!huelle.destroyed) huelle.destroy({ children: true }); });
        if (!lok.destroyed) {
          const b = lok.getBounds();
          const q = this.s.world.toLocal({ x: b.x + b.width / 2, y: b.y + b.height * 0.4 });
          fx.burst('funkeln', q.x, q.y, { count: 6, parent: this.s.world });
        }
        sfx('common/funkeln', { vol: 0.5 });
        this.lokFroh();
      },
    });
  }

  /** Neue Lok angekuppelt (Lok-Tausch): Der Staub kommt mit, damit das Putzen weitergeht. */
  lokNeu(lok) {
    if (!(this.pflegeAktiv && !this.pflegeFertig && this.pflege === 'putzen')) return;
    this.s.after(0.35, () => {
      if (!this.pflegeFertig && !this.aus && this.s.zug.lok === lok) this.staubAuf(lok);
    });
  }

  /** Die Szene meldet: ein Finger liegt auf der Lok. → true, wenn das hier zum Dampf-Machen gehört */
  lokGedrueckt(e) {
    if (!(this.pflegeAktiv && this.pflege === 'dampf' && !this.pflegeFertig) || this.aus) return false;
    this.dampfFinger = true;
    this.dampf += 0.35;   // auch kurzes Antippen bringt etwas
    this.dampfTakt = 0;
    this.s.ton('common/dampf', 1.2, { vol: 0.5 });
    this.s.verfolge(this.s.zug.lok, e, { bewegt: () => false, ende: () => { this.dampfFinger = false; } });
    return true;
  }

  lokFroh() {
    if (this.pflegeFertig) return;
    this.pflegeFertig = true;
    this.dampfFinger = false;
    const z = this.s.zug;
    z.pfeife();
    fx.pop(z.lok.rumpf, 0.06);
    this.pruefeSchritt();
  }

  // ---------------------------------------------------------------- Signal

  baueSignal() {
    const s = this.s;
    const c = new Container({ label: 'signal' });
    c.position.set(SIGNAL_X, SIGNAL_Y);
    c.zIndex = 4.5;
    s.world.addChild(c);
    this.signal = c;
    this.sigRot = spr('zug/signal_rot', { scale: 0.5, parent: c });
    this.sigGruen = spr('zug/signal_gruen', { scale: 0.5, parent: c, alpha: 0 });
    tap(c, () => this.signalTipp(), { sound: null, hitArea: new Rectangle(-110, -320, 220, 330) });
  }

  signalTipp() {
    if (this.signalGruen) {
      fx.wobble(this.signal, 0.02);
      this.s.ton('common/klick', 0.5, { vol: 0.4 });
      return;
    }
    this.stelleSignal();
  }

  stelleSignal() {
    if (this.signalGruen) return;
    const s = this.s;
    this.signalGruen = true;
    s.ton('common/klick', 0.3, { vol: 0.7 });
    fx.wobble(this.signal, 0.02);
    s.tween(this.sigRot, { alpha: 0 }, 0.7, { ease: 'sineInOut' });
    s.tween(this.sigGruen, { alpha: 1 }, 0.7, { ease: 'sineInOut' });
    s.after(0.6, () => note('glocke', 79, { vol: 0.25 }));
    this.pruefeSchritt();
  }

  // ---------------------------------------------------------------- Girlande (wächst über die Runden)

  baueGirlande() {
    const c = new Container({ label: 'girlande' });
    c.zIndex = -650;
    this.s.bg.addChild(c);
    this.girlande = c;
    this.schnur = new Graphics();
    c.addChild(this.schnur);
    this.wimpel = [];
    const n = clamp(store.get('bahnhof.wimpel', 0) | 0, 0, MAX_WIMPEL);
    for (let i = 0; i < n; i++) this.neuerWimpel(i, false);
    this.zeichneSchnur(n > 0);
  }

  // Punkt auf der Schnur (t 0…1): an der rechten Wand des Uhrturms (gleich unter dem Turmdach) festgemacht, hängt
  // vor dem Hausdach durch bis in die Krone des Baums rechts (Punkte mit tools/bild.py raster am Hintergrund
  // abgelesen: Turmwand Bildpunkt x≈1078, Kronen-Rand x≈1600 bei y≈590; world-x = Bildpunkt − 1414; das rechte
  // Ende steckt ein Stück im Laub)
  schnurPunkt(t) {
    const a = { x: -338, y: 418 };
    const c = { x: -40, y: 720 };
    const b = { x: 226, y: 584 };
    const u = 1 - t;
    return { x: u * u * a.x + 2 * u * t * c.x + t * t * b.x, y: u * u * a.y + 2 * u * t * c.y + t * t * b.y };
  }

  zeichneSchnur(sichtbar) {
    const g = this.schnur;
    g.clear();
    if (!sichtbar) return;
    const p0 = this.schnurPunkt(0);
    g.moveTo(p0.x, p0.y);
    for (let i = 1; i <= 24; i++) {
      const p = this.schnurPunkt(i / 24);
      g.lineTo(p.x, p.y);
    }
    g.stroke({ width: 5, color: 0x8a5a36, alpha: 0.9 });
  }

  neuerWimpel(i, neu) {
    const t = 0.1 + (0.82 * (i + 0.5)) / MAX_WIMPEL;
    const p = this.schnurPunkt(t);
    const w = new Container({ label: 'wimpel' });
    const farbe = WIMPEL_FARBEN[i % WIMPEL_FARBEN.length];
    const g = new Graphics()
      .poly([-26, 0, 26, 0, 0, 62]).fill(farbe).stroke({ width: 4, color: 0x000000, alpha: 0.12, join: 'round' })
      .poly([-16, 6, -2, 6, -11, 26]).fill({ color: 0xffffff, alpha: 0.3 });
    w.addChild(g);
    w.position.set(p.x, p.y - 2);
    w._phase = i * 1.3;
    this.girlande.addChild(w);
    this.wimpel.push(w);
    tap(w, () => {
      fx.wobble(w, 0.12);
      if (this._zeit - (this._wimpelTon ?? -9) > 0.3) {
        this._wimpelTon = this._zeit;
        note('glocke', 72 + (i % 8) * 2, { vol: 0.22 });
      }
    }, { sound: null, squash: false, hitArea: new Rectangle(-100, -40, 200, 200) });
    if (neu) {
      w.scale.set(0.2);
      w.alpha = 0;
      this.s.tween(w, { alpha: 1 }, 0.5, { ease: 'sineInOut' });
      this.s.tween(w, { scale: 1 }, 0.7, { ease: 'backOut' });
      fx.burst('funkeln', p.x, p.y + 30, { count: 4, parent: this.s.front });
    }
    return w;
  }

  /** Eine ganz vorbereitete Abfahrt: ein Wimpel mehr (bis die Girlande voll ist). */
  wimpelDazu() {
    const n = clamp(store.get('bahnhof.wimpel', 0) | 0, 0, MAX_WIMPEL);
    if (n >= MAX_WIMPEL) {
      for (const w of this.wimpel) fx.wobble(w, 0.1);
      return;
    }
    store.set('bahnhof.wimpel', n + 1);
    this.zeichneSchnur(true);
    this.neuerWimpel(n, true);
    note('glocke', 84, { vol: 0.3 });
  }

  // ---------------------------------------------------------------- Ablauf

  get fertig() {
    return this.schrittName === 'los';
  }

  // Der nächste Schritt (in fester Reihenfolge; Getanes zählt, egal wann es geschah)
  berechneSchritt() {
    if (!this.gestartet) return 'warten';
    let unterwegs = false;
    for (const g of this.gaeste) {
      if (g.drin) continue;
      if (!g.actor) unterwegs = true;
      else if (!g.geknipst) return 'karte';
    }
    for (const g of this.gaeste) if (!g.drin && g.actor && g.da) return 'einsteigen';
    if (unterwegs) return 'warten';
    for (const g of this.gaeste) if (!g.drin) return 'warten';   // läuft noch zu seinem Platz
    if (!this.gepaeckFertig) return 'gepaeck';
    if (!this.pflegeFertig) return 'pflege';
    if (!this.signalGruen) return 'signal';
    return 'los';
  }

  pruefeSchritt() {
    if (this.aus) return;
    const neu = this.berechneSchritt();
    if (neu === this.schrittName) return;
    this.schrittName = neu;
    if (neu === 'warten') return;
    if (neu === 'pflege') this.startePflege();
    // Denkblase (gleich), Stimme (nur, solange das Kind noch nicht weiter ist)
    this.s.after(neu === 'einsteigen' ? 1.6 : 0.6, () => { if (this.schrittName === neu) this.zeigeNaechstes(); });
    let satz = STIMME[neu === 'pflege' ? this.pflege : neu];
    // „Zieh ein Tier in einen Wagen" passt nur, wenn wirklich Tiere warten (bei Oma, Papa, Kindern sagen die
    // Denkblasen und die Hand, wohin es geht)
    if (neu === 'einsteigen' && this.gaeste.some((g) => !g.drin && MENSCHEN.has(g.id))) satz = null;
    if (satz) {
      // (nur auf dem Bahnsteig – nicht, während das Kind im Güterbahnhof spielt)
      const passt = () => this.schrittName === neu && !this.aus && this.s.modus === 'steht' && this.s.nr === 0 && !this.s.gleitet;
      this.s.after(neu === 'karte' ? 2.2 : 2.8, () => { if (passt()) voice(satz, { nurWenn: passt }); });
    }
    if (neu === 'los') fx.pulse(this.s.losKnopf);
  }

  /** Der Zug fährt ab: alles Laufende endet weich, wartende Gäste winken. → true, wenn alles vorbereitet war */
  abfahrt() {
    const ganz = this.fertig;
    this.aus = true;
    this.dampfFinger = false;
    if (!this.signalGruen) this.stelleSignal();
    this.schaffner.stop();
    // Die Denkblase („Kelle heben") hat sich erledigt: sanft ausblenden
    const blase = this.schaffner._blase;
    if (blase && !blase.destroyed) this.s.tween(blase, { alpha: 0 }, 0.5, { ease: 'sineInOut' });
    // ein liegen gebliebenes Fundstück nimmt der Schaffner mit (blendet sanft aus)
    const f = this.fund;
    if (f && !f.destroyed && !f._weg) {
      f._weg = true;
      f.eventMode = 'none';
      this.s.tween(f, { alpha: 0 }, 0.8, { ease: 'sineInOut' });
    }
    this.schaffner.lookAt(SCHAFFNER_X + 300);
    this.schaffner.pose('happy');
    this.s.after(0.35, () => sfx('common/pfiff', { vol: 0.5, rate: 1.4 }));
    this.s.after(2.4, () => { if (!this.schaffner.destroyed) this.schaffner.pose('idle'); });
    for (const g of this.gaeste) {
      if (g.drin || !g.actor || g.actor.destroyed) continue;
      g.actor.eventMode = 'none';
      this.s.after(0.5 + g.nr * 0.4, () => this.freuen(g.actor));
    }
    if (ganz) this.s.after(0.8, () => this.wimpelDazu());
    return ganz;
  }

  update(dt) {
    this._zeit += dt;
    this.ruhe += dt;
    for (const g of this.gaeste) this.stelleKarte(g);
    this.stelleGriffe();
    for (let i = 0; i < this.wimpel.length; i++) {
      const w = this.wimpel[i];
      if (!w.destroyed) w.rotation = Math.sin(this._zeit * 0.9 + w._phase) * 0.06;
    }
    if (this.aus) return;
    this.pruefeSchritt();
    this._platzTakt -= dt;
    if (this._platzTakt <= 0) {
      this._platzTakt = 1.2;
      this.pruefePlaetze();
    }

    // Dampf machen: solange ein Finger auf der Lok liegt, steigt gemütlich Dampf auf
    if (this.dampfFinger && !this.pflegeFertig) {
      this.dampf += dt;
      this.dampfTakt -= dt;
      if (this.dampfTakt <= 0) {
        this.dampfTakt = 0.5;
        const z = this.s.zug;
        const p = z.punktLok('schornstein');
        if (p) fx.burst('rauch', p.x, p.y - 10, { count: 1, parent: this.s.world });
        z.lok.wackel(0.008);
      }
      if (this.dampf >= DAMPF_ZEIT) this.lokFroh();
    }

    // Wartet das Kind, zeigt der Schaffner (bzw. der Gast) den nächsten Schritt noch einmal
    this.erinnert += dt;
    if (this.schrittName !== 'warten' && this.ruhe > 9 && this.erinnert > 11 && this.s.modus === 'steht' && this.s.nr === 0) this.zeigeNaechstes();
  }

  /** Ziele der Zeige-Hand für den aktuellen Schritt (das wichtigste zuerst). */
  hinweise() {
    const s = this.s;
    const z = s.zug;
    const liste = [];
    switch (this.schrittName) {
      case 'karte':
        for (const g of this.gaeste) {
          if (!g.drin && !g.geknipst && g.karte && !g.karte.destroyed) {
            liste.push(g.karte);
            break;
          }
        }
        break;
      case 'einsteigen':
        for (const g of this.gaeste) {
          if (g.drin || !g.actor || g.actor.destroyed) continue;
          const w = this.wunschWagen(g, false);
          const nach = w ? w.fahrzeug.koerper : (z.wagen[z.wagen.length - 1]?.fahrzeug.koerper || z.lok.koerper);
          liste.push({ von: g.actor, nach });
          break;
        }
        break;
      case 'gepaeck':
        if (!this.karreFaehrt) liste.push({ von: this.karreBild, nach: { x: this.ladeX(), y: this.B - 60 } });
        break;
      case 'pflege':
        if (this.pflege === 'wasser' && this.eimer && !this.eimer.destroyed) liste.push({ von: this.eimer, nach: z.lok.koerper });
        else if (this.pflege === 'putzen' && this.staub && !this.staub.destroyed) {
          // Wisch-Bewegung über die Lok: von ihrer Mitte nach rechts (von ist die Lok selbst – ohne Geist-Bild)
          const b = z.lok.getBounds();
          const r = s.world.toLocal({ x: b.x + b.width * 0.85, y: b.y + b.height * 0.5 });
          liste.push({ von: z.lok, nach: { x: r.x, y: r.y } });
        } else if (this.pflege === 'dampf') liste.push(z.lok.koerper);
        break;
      case 'signal':
        liste.push(this.sigRot);
        break;
      case 'los':
        liste.push(s.losKnopf);
        break;
      default:
        break;
    }
    if (this.fund && !this.fund.destroyed && !this.fund._weg) liste.push(this.fund);
    return liste;
  }

  exit() {
    this._abInput?.();
    this._abInput = null;
  }
}
