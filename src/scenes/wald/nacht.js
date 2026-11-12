// Seite 2 – Waldnacht: Gute Nacht im Wald. Ruhig und friedlich, nie gruselig.
// Der Finger ist eine Taschenlampe: ein weicher, warmer Lichtkreis folgt ihm träge (ein Tipp an eine ferne Stelle:
// das Licht gleitet ruhig hinüber, es saust nicht).
//
// Eine Runde:
//   1. Finden – drei müde Tiere sitzen noch wach im Dunkeln. Ruht das Licht auf einem (oder tippt man es an),
//      gähnt es und zeigt in einer Denkblase sein Bett.
//   2. Ins Bett – das Tier zu einem Bett ziehen (Laubhaufen, Baumhöhle, hohler Stamm, Farn) oder antippen, dann
//      tapst es selbst hin.
//   3. Zudecken – ein großes Blatt segelt vom Baum neben das Bett; aufs Tier ziehen (oder antippen) → es legt sich hin.
//   4. Gute Nacht – das zugedeckte Tier antippen: ein leises Schlaflied, ein Herz, es schläft (zzz).
//   5. Glühwürmchen – schlafen alle, hängt ein Glas am Ast. Mit dem Licht die Glühwürmchen zum Glas führen
//      (Finger aufs Glas): eins nach dem anderen fliegt hinein, das Glas leuchtet immer heller.
//   6. Freilassen – volles Glas antippen: die Glühwürmchen steigen langsam in den Himmel und werden zu Sternen.
//      Der Himmel füllt sich über die Runden (bleibt gespeichert). Sticker, dann die nächste Nacht mit anderen Tieren.
// Wie bisher: Schlafende Tiere blinzeln kurz, wenn das Licht auf ihnen ruht; die Eule auf dem Ast freut sich beim
// Antippen; Grillen zirpen leise, selten zieht eine Sternschnuppe vorbei.

import { stage, spr, tex, sfx, voice, note, tap, drag, Actor, fx, store, rand, pick, shuffle, clamp, killTweensOf, PIXI } from '../../engine/index.js';
import { Seite } from '../../gemeinsam/seiten.js';
import { belohne } from '../../gemeinsam/sticker.js';
import { jubel, laut, geheZu, blase, dunkelTextur, schweifTextur, bogen, figurFlaeche, waehleArten, waehleSticker } from './deko.js';

const TIERE = ['fuchs', 'hase', 'igel', 'baer', 'eichhoernchen'];
const TIERE_PRO_RUNDE = 3;
// Betten: Bild, Breite (Einheiten, vorn) und wo das Tier darin liegt (Anteil von Breite/Höhe des Bildes)
const BETTEN = {
  laubhaufen: { bild: 'wald/laubhaufen', breite: 400, dx: 0, dy: -0.32, z: 1, groesse: 0.95 },
  hoehle: { bild: 'wald/baumstumpf_hoehle', breite: 400, dx: 0.02, dy: -0.04, z: 1, groesse: 0.85 },
  stamm: { bild: 'wald/baumstamm_hohl', breite: 440, dx: 0.3, dy: -0.03, z: 1, groesse: 0.85 },
  farn: { bild: 'wald/farn', breite: 400, dx: 0, dy: 0.06, z: 1, groesse: 0.95 },
};
// Bettplätze (Punkte schlafplatz2…4 des Bildes) und Verstecke im Dunkeln, wo die müden Tiere anfangs sitzen
const BETT_PLAETZE = ['schlafplatz2', 'schlafplatz3', 'schlafplatz4'];
const VERSTECKE = [{ x: -930, y: 1170 }, { x: 900, y: 1160 }, { x: -280, y: 1060 }, { x: 300, y: 1050 }];
// Decken: große Blätter
const DECKEN = ['wald/blatt_bunt', 'common/p_blatt', 'common/p_blatt_herbst'];
const LICHT_RADIUS = 330;         // sichtbarer heller Kreis (Einheiten)
const SCHLEIER_ALPHA = 0.5;       // wie dunkel es außerhalb des Lichts ist
const WECK_ABSTAND = 210;         // so nah muss das Licht der Mitte eines Tiers kommen
const WECK_ZEIT = 0.45;           // so lange muss es dort ruhen (s)
const WACH_ZEIT = 4.2;            // so lange bleibt ein geblinzeltes Tier wach (s)
const WIEDER_SPERRE = 2.5;        // danach schläft es mindestens so lange
// Tempo der Lampe (siehe bewegeLampe)
const LAMPE_TEMPO = 800;
const LAMPE_TEMPO_FINGER = 2400;
const LAMPE_ANFAHREN = 1600;
const LAMPE_NAH = 4.5;
const RUHE_TEMPO = 300;           // nur ein (fast) ruhendes Licht findet/weckt ein Tier – vorbeigleitendes nicht
const GLUEH_ANZAHL = 9;
const GLAS_VOLL = 6;
const GLAS_NAH = 290;             // so nah muss das Licht am Glas sein, damit Glühwürmchen hineinfliegen
const GLUEH_BEREICH = { x0: -1050, x1: 1050, y0: 560, y1: 1250 };
// eigene Plätze, wo ein Punkt des Bildes sichtbar nicht passt (Wurzeln, Pfeile)
const PLATZ_KORREKTUR = { schlafplatz1: { dx: 110, dy: 40 }, schlafplatz5: { dx: -60, dy: 30 } };
// Sterne am Himmel (über die Runden mehr; gespeichert)
const STERNE_SPEICHER = 'wald.sterne';
const STERNE_MAX = 36;
// freie Himmelsstücke zwischen den Baumkronen (Eule, Ast und Glas bleiben frei)
const HIMMEL = [
  { x0: -560, x1: -220, y0: 200, y1: 420, n: 16 },
  { x0: -100, x1: 160, y0: 45, y1: 140, n: 8 },
  { x0: 470, x1: 640, y0: 190, y1: 400, n: 12 },
];
const SCHLAFLIED = [72, 76, 79, 76];
const ARTEN_SPEICHER = 'wald.zuletzt.nacht';   // wann welches Tier zuletzt dran war (Abwechslung)
const SCHEIN_ALPHA = 0.32;        // warmer Schein der Lampe
// Schein des Glases: wächst mit jedem Glühwürmchen weich bis GLAS_SCHEIN_MAX (nicht grell – zusammen mit dem
// Lampenschein lief das Glas sonst ins Weiße)
const GLAS_SCHEIN_MAX = 0.42;

// feste, aber verstreute Stelle für Stern Nr. i (immer dieselbe – der Himmel sieht bei jedem Besuch gleich aus)
function sternOrt(i) {
  const z = (k) => { const v = Math.sin((i + 1) * 12.9898 + k * 78.233) * 43758.5453; return v - Math.floor(v); };
  // Stern i liegt in einem der Stücke (nach Anteil verteilt)
  let k = i % 36;
  let h = HIMMEL[0];
  for (const st of HIMMEL) { if (k < st.n) { h = st; break; } k -= st.n; }
  const r = [0, 2, 1][i % 3];
  h = HIMMEL[(HIMMEL.indexOf(h) + r) % HIMMEL.length];
  return { x: h.x0 + z(1) * (h.x1 - h.x0), y: h.y0 + z(2) * (h.y1 - h.y0), g: 0.13 + z(3) * 0.07 };
}

export class Nacht extends Seite {
  static hg = 'wald/hg_nacht';

  aufbau() {
    // Das Licht ruht anfangs auf freiem Boden zwischen den Tieren
    this.lampe = { x: 240, y: 1010 };
    this.lampenZiel = { x: 240, y: 1010 };
    this.lampenV = { x: 0, y: 0 };
    this.fingerTempo = 0;
    this.letzteBewegung = null;
    this.lampenFinger = null;
    this.gesammelt = 0;           // Glühwürmchen sammeln sich (0…1)
    this.sammelBis = 0;
    this.letzterGlockenTon = 0;
    this.tiere = [];
    this.betten = [];
    this.phase = 'tiere';         // 'tiere' | 'gluehen' | 'voll' | 'frei' | 'wechsel'
    this.imGlas = 0;
    this.zumGlas = 0;             // Glühwürmchen gerade auf dem Weg ins Glas
    this.naechsterFlug = 0;

    // Berührung irgendwo: Licht dorthin, Glühwürmchen kommen (liegt ganz hinten, Tiere haben Vorrang)
    const fang = new PIXI.Container({ label: 'nachtFlaeche' });
    fang.zIndex = -100;
    this.welt.addChild(fang);
    tap(fang, (e) => this.beruehrt(e), {
      sound: null, squash: false, hitArea: new PIXI.Rectangle(-1500, 0, 3000, 1600),
    });

    this.baueSterne();
    this.baueEule();
    this.baueGlas();
    this.baueLicht();
    this.baueGluehwuermchen();
    this.neueRunde(true);

    // leises zzz von einem schlafenden Tier
    this.every(2.6, () => { if (this.aktiv) this.zzz(); });
    // selten eine Sternschnuppe
    this.every(9, () => { if (this.aktiv && Math.random() < 0.3) this.sternschnuppe(); });
    // Eule schaut sich ab und zu um; ein müdes Tier gähnt
    this.every(7, () => {
      if (!this.aktiv || this.eule.destroyed) return;
      this.eule.lookAt(this.eule.x + (this.eule.flip ? 100 : -100));
    });
    this.every(5.5, () => { if (this.aktiv) this.gaehnen(); });

    this._bewegt = (ev) => this.fingerBewegt(ev);
    this._los = (ev) => this.fingerLos(ev);
  }

  betreten() {
    window.addEventListener('pointermove', this._bewegt, { passive: true });
    window.addEventListener('pointerup', this._los, { passive: true });
    window.addEventListener('pointercancel', this._los, { passive: true });
    this.grillenStart();
    if (this.besuche === 1) {
      const passt = () => this.aktiv && this.phase === 'tiere' && this.tiere.some((a) => a.schritt === 'wach');
      this.after(1.2, () => voice('wald_bett', { nurWenn: passt }));
    }
  }

  verlassen() {
    window.removeEventListener('pointermove', this._bewegt);
    window.removeEventListener('pointerup', this._los);
    window.removeEventListener('pointercancel', this._los);
    this.lampenFinger = null;
    this.sammelBis = 0;
    this.grillenMarke = (this.grillenMarke || 0) + 1; // Grillen-Schleife endet nach dem laufenden Zirpen
  }

  // ---------------------------------------------------------------- Aufbau

  baueEule() {
    const ast = this.punkt('ast', { x: 235, y: 430 });
    this.ast = ast;
    this.eule = new Actor('eule', { x: ast.x, y: ast.y + 12, scale: 0.3, parent: this.welt, z: 50 });
    this.eule.schatten.visible = false;
    this.eule.onTap((e) => {
      this.beruehrt(e, this.eule);
      jubel(this, this.eule, { herzen: 3 });
    });
  }

  // Einmachglas hängt am Ast links neben der Eule – zuerst unsichtbar, es kommt, wenn alle schlafen
  baueGlas() {
    const t = tex('wald/laterne_glas');
    const hoehe = 250;
    const x = this.ast.x - 270;
    this.glas = spr('wald/laterne_glas', { x, y: this.ast.y - 5 + hoehe, scale: hoehe / (t.height || 520), parent: this.welt, z: 60 });
    this.glas.alpha = 0;
    this.glas.visible = false;
    this.glasSkala = Math.abs(this.glas.scale.y);
    this.glasMitte = { x, y: this.ast.y - 5 + hoehe * 0.55 };
    // Schein des Glases (über dem Nachtschleier – das Glas leuchtet)
    this.glasSchein = spr('wald/mondschein', { anchor: 0.5, x: this.glasMitte.x, y: this.glasMitte.y, parent: this.welt, z: 5003 });
    this.glasSchein.tint = 0xf2ffb0;
    this.glasSchein.blendMode = 'add';
    this.glasSchein.alpha = 0;
    this.glasSchein.scale.set(0.55);
    this.glasSchein.eventMode = 'none';
    const s = this.glas.scale.x;
    tap(this.glas, (e) => this.tippGlas(e), {
      sound: null, squash: false,
      hitArea: new PIXI.Rectangle(-130 / s - 0.5 * t.width, -t.height - 20 / s, t.width + 260 / s, t.height + 60 / s),
    });
  }

  baueLicht() {
    // dunkler Schleier mit weichem Loch – folgt der Lampe
    this.schleier = new PIXI.Sprite(dunkelTextur());
    this.schleier.anchor.set(0.5);
    const breite = LICHT_RADIUS / 0.06;
    this.schleier.width = breite;
    this.schleier.height = breite;
    this.schleier.alpha = SCHLEIER_ALPHA;
    this.schleier.zIndex = 5000;
    this.schleier.eventMode = 'none';
    this.welt.addChild(this.schleier);
    // warmer Schein in der Mitte
    this.schein = spr('wald/mondschein', { anchor: 0.5, parent: this.welt, z: 5001 });
    this.schein.tint = 0xffd9a0;
    this.schein.blendMode = 'add';
    this.schein.alpha = SCHEIN_ALPHA;
    this.schein.scale.set((LICHT_RADIUS * 2.3) / 700);
    this.schein.eventMode = 'none';
    this.setzeLicht();
  }

  baueGluehwuermchen() {
    this.glueh = [];
    const b = GLUEH_BEREICH;
    for (let i = 0; i < GLUEH_ANZAHL; i++) {
      const s = spr('wald/gluehwuermchen', { anchor: 0.5, parent: this.welt, z: 6000 + i });
      s.blendMode = 'add';
      s.eventMode = 'none';
      const g = rand(0.5, 0.8);
      s.scale.set(g);
      const heim = { x: rand(b.x0, b.x1), y: rand(b.y0, b.y1) };
      s.position.set(heim.x, heim.y);
      this.glueh.push({
        s, heim, g, phase: rand(0, 20), tx: rand(0.15, 0.3), ty: rand(0.12, 0.25), puls: rand(3, 5),
        ring: (i / GLUEH_ANZAHL) * Math.PI * 2, zustand: 'frei', hell: 1,
      });
    }
  }

  baueSterne() {
    this.sterne = new PIXI.Container({ label: 'sterne' });
    this.sterne.zIndex = 5002;       // über dem Schleier: Sterne leuchten
    this.sterne.eventMode = 'none';
    this.welt.addChild(this.sterne);
    let n = Number(store.get(STERNE_SPEICHER, 0)) || 0;
    n = Math.max(0, Math.min(STERNE_MAX, Math.floor(n)));
    for (let i = 0; i < n; i++) this.neuerStern(i, false);
    this.sternZahl = n;
  }

  neuerStern(i, weich) {
    const o = sternOrt(i);
    const s = spr('common/stern_himmel', { anchor: 0.5, x: o.x, y: o.y, scale: o.g, parent: this.sterne });
    s.eventMode = 'none';
    s.ruhe = 0.75 + (i % 3) * 0.08;
    s.alpha = weich ? 0 : s.ruhe;
    return s;
  }

  // ---------------------------------------------------------------- Runde

  neueRunde(sofort = false) {
    this.phase = 'tiere';
    this.imGlas = 0;
    this.zumGlas = 0;
    // die Tiere, die am längsten nicht dran waren
    const arten = waehleArten(TIERE, TIERE_PRO_RUNDE, ARTEN_SPEICHER);
    const bettArten = shuffle(Object.keys(BETTEN)).slice(0, TIERE_PRO_RUNDE);
    const deckenListe = shuffle(DECKEN);
    this.betten = BETT_PLAETZE.map((name, i) => this.baueBett(name, bettArten[i], sofort ? 0 : 0.3 + i * 0.25));
    const verstecke = shuffle(VERSTECKE).slice(0, TIERE_PRO_RUNDE);
    this.tiere = arten.map((art, i) => this.baueTier(art, verstecke[i], deckenListe[i % deckenListe.length], sofort ? 0 : 1 + i * 0.4));
  }

  baueBett(name, art, verz) {
    const k = PLATZ_KORREKTUR[name] || { dx: 0, dy: 0 };
    const p0 = this.punkt(name, { x: 0, y: 1260 });
    const p = { x: p0.x + k.dx, y: p0.y + k.dy };
    const def = BETTEN[art];
    const f = 0.88 + ((p.y - 1110) / 280) * 0.2;
    const t = tex(def.bild);
    const skala = (def.breite * f) / (t.width || 700);
    const s = spr(def.bild, { x: p.x, y: p.y, scale: skala, parent: this.welt, z: p.y - 30 });
    if (art !== 'hoehle' && art !== 'stamm' && Math.random() < 0.5) s.scale.x *= -1;
    const bett = { art, def, s, x: p.x, y: p.y, f, w: t.width * skala, h: t.height * skala, tier: null };
    // Wo das Tier darin liegt (beim gespiegelten Stamm die Öffnung auf der anderen Seite)
    bett.platz = { x: p.x + def.dx * bett.w * Math.sign(s.scale.x), y: p.y + def.dy * bett.h };
    tap(s, () => {
      fx.wobble(s, 0.04);
      sfx('common/rascheln', { vol: 0.25 });
    }, { sound: null, squash: false, hitArea: new PIXI.Ellipse((0.5 - s.anchor.x) * t.width, (0.5 - s.anchor.y) * t.height, t.width / 2 + 40 / skala, Math.max(t.height / 2 + 40 / skala, 125 / skala)) });
    s.alpha = 0;
    this.tween(s, { alpha: 1 }, 0.8, { ease: 'sineInOut', delay: verz });
    return bett;
  }

  baueTier(art, ort, decke, verz) {
    const skala = 0.3 + ((ort.y - 1110) / 280) * 0.09;
    const a = new Actor(art, { x: ort.x, y: ort.y, scale: skala, parent: this.welt, z: ort.y });
    a.art = art;
    a.schritt = 'wach';      // 'wach' (müde im Dunkeln) → 'gefunden' → 'imBett' → 'zugedeckt' → 'schlaeft'
    a.ruhe = 0;
    a.wachZeit = 0;
    a.sperre = 0;
    a.geblinzelt = false;
    a.hoehe = 760 * skala;
    a.grundSkala = skala;
    a.deckeBild = decke;
    a.lookAt(0);
    a.alpha = 0;
    this.tween(a, { alpha: 1 }, 0.8, { ease: 'sineInOut', delay: verz });
    a.onTap((e) => this.tippTier(a, e));
    return a;
  }

  // ---------------------------------------------------------------- Tiere

  tippTier(a, e) {
    if (a.destroyed || this.phase === 'wechsel') return;
    this.beruehrt(e, a);
    if (a.schritt === 'wach') { this.gefunden(a); return; }
    if (a.schritt === 'gefunden') { this.insBett(a, a.wunschBett); return; }
    if (a.schritt === 'imBett') {
      laut(a);
      fx.wobble(a, 0.04);
      if (a.decke && !a.decke.destroyed && !a.decke.unterwegs) this.zudecken(a);
      return;
    }
    if (a.schritt === 'zugedeckt') { this.guteNacht(a); return; }
    // schläft: kurz blinzeln (wie früher), dann schläft es weiter
    if (!a.geblinzelt) this.blinzeln(a);
    else { a.sound(); fx.wobble(a, 0.04); }
  }

  freiesBett(a) {
    const frei = this.betten.filter((b) => !b.tier || b.tier === a);
    if (!frei.length) return null;
    frei.sort((p, q) => Math.hypot(p.x - a.x, p.y - a.y) - Math.hypot(q.x - a.x, q.y - a.y));
    return frei[0];
  }

  // Schritt 1: gefunden – gähnt, zeigt sein Bett
  gefunden(a) {
    if (a.schritt !== 'wach') return;
    a.schritt = 'gefunden';
    a.ruhe = 0;
    a.wunschBett = this.freiesBett(a);
    a.pose('happy');
    this.after(0.25, () => { if (!a.destroyed) a.sound(); });
    a.hop(40).then(() => { if (!a.destroyed && a.schritt === 'gefunden') a.pose('idle'); });
    if (a.wunschBett) this.after(0.6, () => { if (a.schritt === 'gefunden') blase(a, a.wunschBett.def.bild, 2.6, 640); });
    // Ziehen erst nach einem Moment – sonst schickt das Loslassen des Find-Tipps das Tier gleich los
    this.after(0.35, () => this.bettZiehen(a));
  }

  bettZiehen(a) {
    if (a.destroyed || a.schritt !== 'gefunden' || a.zieh) return;
    a._tap?.off();
    a.zieh = drag(a, {
      hitArea: figurFlaeche(a, 55),
      lift: 1.08,
      sound: null,
      targets: () => this.betten.filter((b) => !b.tier || b.tier === a).map((b) => ({ id: 'bett', bett: b, x: b.platz.x, y: b.platz.y - 60, radius: 300 })),
      onStart: () => {
        a._gehMarke = (a._gehMarke || 0) + 1;
        this.beruehrt(null, a);
        laut(a, 1.2);
      },
      onDrop: (ziel, ctx) => {
        ctx.erledigt = true;
        a.zIndex = a.y;
        const weg = Math.hypot(ctx.x - ctx.startX, ctx.y - ctx.startY);
        if (weg < 40 && a.schritt === 'gefunden') { this.insBett(a, a.wunschBett); return; }
        this.insBett(a, ziel?.bett || this.freiesBett(a), !!ziel);
      },
    });
  }

  // Schritt 2: ins Bett (direkt = schon am Bett abgelegt)
  async insBett(a, bett, direkt = false) {
    if (a.destroyed || a.schritt !== 'gefunden') return;
    if (!bett || (bett.tier && bett.tier !== a)) bett = this.freiesBett(a);
    if (!bett) return;
    bett.tier = a;          // reserviert
    a.wunschBett = bett;
    const ziel = bett.platz;
    a.laeuft = true;
    const ok = direkt ? await a.hopTo(ziel.x, ziel.y, { hoehe: 60, dauer: 0.45 }) : await geheZu(this, a, ziel.x, ziel.y, { tempo: 300 });
    a.laeuft = false;
    if (!ok || a.destroyed || a.schritt !== 'gefunden') {
      if (!a.destroyed && a.schritt === 'gefunden' && bett.tier === a) bett.tier = null;   // wieder gegriffen
      return;
    }
    a.schritt = 'imBett';
    a.zieh?.off();
    a.zieh = null;
    a.zIndex = bett.s.zIndex + bett.def.z;
    a.onTap((e) => this.tippTier(a, e));
    a.lookAt(0);
    fx.wobble(bett.s, 0.04);
    sfx('common/rascheln', { vol: 0.35 });
    // gähnt im Bett – und ein großes Blatt segelt vom Baum herab: die Decke
    this.after(0.4, () => { if (!a.destroyed) a.sound(); });
    this.after(0.8, () => this.deckeKommt(a, bett));
  }

  // Schritt 3: die Decke (ein großes Blatt) segelt neben das Bett
  deckeKommt(a, bett) {
    if (a.destroyed || a.schritt !== 'imBett') return;
    const id = a.deckeBild;
    const t = tex(id);
    const breite = 250;
    const skala = breite / Math.max(t.width, t.height, 1);
    // landet vor dem Bett, etwas zur Mitte hin (dort ist frei; nie in der Ecke unten rechts)
    const seite = bett.x > 200 ? -1 : 1;
    const ziel = { x: bett.x + seite * 140, y: Math.min(1480, bett.y + 160) };
    const d = spr(id, { anchor: 0.5, x: ziel.x - seite * 60, y: 380, scale: skala, parent: this.welt, z: 5004 });
    d.rotation = -0.4;
    d.ruheSkala = skala;
    d.unterwegs = true;
    a.decke = d;
    sfx('common/wusch', { vol: 0.3 });
    // sanft herabsegeln (pendelnd), dann liegen
    const p = { k: 0 };
    const x0 = d.x;
    const y0 = d.y;
    this.tween(p, { k: 1 }, 2.2, {
      ease: 'sineInOut',
      onUpdate: () => {
        if (d.destroyed) return;
        d.x = x0 + (ziel.x - x0) * p.k + Math.sin(p.k * Math.PI * 3) * 50 * (1 - p.k);
        d.y = y0 + (ziel.y - y0) * p.k;
        d.rotation = Math.sin(p.k * Math.PI * 3) * 0.35 * (1 - p.k) - 0.15;
      },
    }).then((ok) => {
      if (!ok || d.destroyed) return;
      d.unterwegs = false;
      d.zIndex = 4000;   // liegt über Betten und Tieren, gut zu greifen
      d.zieh = drag(d, {
        hitArea: new PIXI.Circle(0, 0, 135 / skala),
        lift: 1.1,
        sound: null,
        targets: () => (a.destroyed ? [] : [{ id: 'tier', x: a.x, y: a.y - a.hoehe * 0.35, radius: 300 }]),
        onStart: () => { sfx('common/rascheln', { vol: 0.3 }); this.beruehrt(null, a); },
        onDrop: (z, ctx) => {
          const weg = Math.hypot(ctx.x - ctx.startX, ctx.y - ctx.startY);
          if (z || weg < 40) { ctx.erledigt = true; this.zudecken(a); return; }
          ctx.back(0.45);
        },
      });
    });
  }

  // Blatt legt sich über das Tier, es legt sich hin
  async zudecken(a) {
    const d = a.decke;
    if (!d || d.destroyed || a.schritt !== 'imBett' || d.legt) return;
    d.legt = true;
    d.zieh?.off();
    d.eventMode = 'none';
    killTweensOf(d);
    a.pose('sleep');
    await this.wait(0.15);
    if (a.destroyed || d.destroyed) return;
    const b = a.koerper.getBounds();
    const o = this.welt.toLocal({ x: b.x + b.width / 2, y: b.y + b.height * 0.72 });
    const breite = Math.max(160, (b.width / this.welt.worldTransform.a) * 0.85);
    const s = breite / Math.max(d.texture.width, d.texture.height, 1);
    d.zIndex = a.zIndex + 1;
    sfx('common/wusch', { vol: 0.3 });
    this.tween(d, { rotation: rand(-0.12, 0.12) }, 0.5, { ease: 'sineInOut' });
    await bogen(this, d, o, { dauer: 0.55, hoehe: 90, skala: s });
    if (a.destroyed || d.destroyed) return;
    d.scale.y *= 0.8;   // flach über das Tier gelegt
    sfx('common/landen', { vol: 0.35 });
    a.schritt = 'zugedeckt';
    // Decke antippen = Tier antippen
    tap(d, (e) => this.tippTier(a, e), { sound: null, squash: false, hitArea: new PIXI.Circle(0, 0, 125 / Math.abs(d.scale.x)) });
  }

  // Schritt 4: Gute-Nacht – leises Schlaflied, ein Herz, zzz
  guteNacht(a) {
    if (a.schritt !== 'zugedeckt') return;
    a.schritt = 'schlaeft';
    a.geblinzelt = false;
    SCHLAFLIED.forEach((n, i) => this.after(i * 0.32, () => note('glocke', n, { vol: 0.16 })));
    const k = a.point('kopf');
    this.burst('herzen', k.x, k.y + 30, { count: 2 });
    this.after(1.2, () => { if (!a.destroyed) { const q = a.point('kopf'); this.burst('zzz', q.x + 30, q.y + 50); } });
    fx.pop(a, 0.06);
    if (this.tiere.every((t) => t.schritt === 'schlaeft')) this.after(1.8, () => this.alleSchlafen());
  }

  // schlafendes Tier blinzelt kurz (Licht oder Antippen), schläft dann weiter
  blinzeln(a) {
    if (a.destroyed || a.geblinzelt || a.schritt !== 'schlaeft') return;
    a.geblinzelt = true;
    a.wachZeit = 0;
    a.ruhe = 0;
    a.pose('idle');
    this.after(0.35, () => { if (!a.destroyed) a.sound(); });
    this.after(0.6, () => { if (!a.destroyed) a.nod(); });
  }

  einschlafen(a) {
    if (a.destroyed) return;
    a.geblinzelt = false;
    a.sperre = WIEDER_SPERRE;
    a.wegErst = true; // das Licht muss erst weiterziehen, bevor es dieses Tier wieder weckt
    a.pose('sleep');
    const k = a.point('kopf');
    this.burst('zzz', k.x + 30, k.y + 50);
  }

  zzz() {
    const schlafend = this.tiere.filter((a) => a.schritt === 'schlaeft' && !a.geblinzelt && !a.destroyed);
    if (!schlafend.length) return;
    const a = pick(schlafend);
    const k = a.point('kopf');
    this.burst('zzz', k.x + 40, k.y + 50);
    if (Math.random() < 0.2) sfx('common/schnarchen', { vol: 0.18 });
  }

  // ein müdes, noch nicht gefundenes Tier gähnt (Ton + kleines Stauchen) – so findet man es im Dunkeln
  gaehnen() {
    if (this.phase !== 'tiere') return;
    const wach = this.tiere.filter((a) => a.schritt === 'wach' && !a.destroyed);
    if (!wach.length) return;
    const a = pick(wach);
    fx.pop(a, 0.05);
    if (Math.random() < 0.5) laut(a, 2);
  }

  // ---------------------------------------------------------------- Glühwürmchen ins Glas

  alleSchlafen() {
    if (this.phase !== 'tiere') return;
    this.phase = 'gluehen';
    voice('wald_nacht');
    this.glas.visible = true;
    this.glas.alpha = 0;
    const s = this.glasSkala;
    this.glas.scale.set(s * 0.9);
    this.tween(this.glas, { alpha: 1 }, 0.8, { ease: 'sineInOut' });
    this.tween(this.glas, { scale: s }, 0.8, { ease: 'backOut' });
    sfx('common/klack', { vol: 0.35 });
    // die Glühwürmchen leuchten etwas heller (weich)
    for (const g of this.glueh) g.hell = 1.15;
    this.after(6, () => voice('wald_glas', { nurWenn: () => this.aktiv && this.phase === 'gluehen' && this.imGlas === 0 }));
  }

  tippGlas(e) {
    if (this.phase === 'gluehen') {
      // das Licht gleitet zum Glas, die Glühwürmchen kommen mit
      this.beruehrt(e, { x: this.glasMitte.x, y: this.glasMitte.y + 120, hoehe: 0 });
      this.sammelBis = this.t + 5;
      fx.wobble(this.glas, 0.04);
      return;
    }
    if (this.phase === 'voll') {
      this.freilassen();
      return;
    }
    fx.wobble(this.glas, 0.05);
    note('glocke', pick([84, 88]), { vol: 0.14 });
  }

  // ein Glühwürmchen fliegt ins Glas (gemächlich; update führt es)
  insGlas(g) {
    g.zustand = 'zumGlas';
    this.zumGlas++;
    g.platz = { dx: rand(-55, 55), dy: rand(-40, 55), ph: rand(0, 10) };
  }

  angekommenImGlas(g) {
    g.zustand = 'imGlas';
    this.zumGlas = Math.max(0, this.zumGlas - 1);
    this.imGlas++;
    note('pling', 76 + this.imGlas * 2, { vol: 0.3 });
    const k = Math.min(1, this.imGlas / GLAS_VOLL);
    this.tween(this.glasSchein, { alpha: 0.1 + (GLAS_SCHEIN_MAX - 0.1) * k }, 0.8, { ease: 'sineInOut' });
    this.tween(this.glasSchein.scale, { x: 0.5 + 0.18 * k, y: 0.5 + 0.18 * k }, 0.8, { ease: 'sineInOut' });
    if (this.imGlas >= GLAS_VOLL && this.phase === 'gluehen') {
      this.phase = 'voll';
      this.after(0.8, () => {
        sfx('common/funkeln', { vol: 0.4 });
        this.glasPuls = fx.pulse(this.glas, { staerke: 0.04, periode: 1.8 });
        jubel(this, this.eule, { herzen: 2 });
      });
    }
  }

  // Schritt 6: Glühwürmchen steigen in den Himmel und werden Sterne
  async freilassen() {
    if (this.phase !== 'voll') return;
    this.phase = 'frei';
    this.glasPuls?.stop();
    this.glasPuls = null;
    fx.wobble(this.glas, 0.06);
    sfx('common/wusch', { vol: 0.3 });
    const drin = this.glueh.filter((g) => g.zustand === 'imGlas');
    for (let i = 0; i < drin.length; i++) {
      const g = drin[i];
      this.after(i * 1.1, () => this.zumStern(g));
    }
    await this.wait(drin.length * 1.1 + 2.6);
    this.tween(this.glasSchein, { alpha: 0 }, 1.2, { ease: 'sineInOut' });
    store.set(STERNE_SPEICHER, this.sternZahl);
    jubel(this, this.eule, { herzen: 4 });
    belohne(this, waehleSticker([...this.tiere.map((a) => 'tier_' + a.art), 'tier_eule']), this.eule.x, this.eule.y - 160);
    await this.wait(3.5);
    this.rundeWechseln();
  }

  zumStern(g) {
    g.zustand = 'steigt';
    const i = this.sternZahl;
    const neu = i < STERNE_MAX;
    const ort = neu ? sternOrt(i) : sternOrt(Math.floor(rand(0, STERNE_MAX)));
    if (neu) this.sternZahl++;
    note('glocke', pick([84, 86, 88, 91]), { vol: 0.12 });
    const s = g.s;
    bogen(this, s, { x: ort.x, y: ort.y }, { dauer: 2.2, hoehe: 60 }).then((ok) => {
      if (!ok || s.destroyed) return;
      const stern = neu ? this.neuerStern(i, true) : null;
      if (stern) this.tween(stern, { alpha: stern.ruhe }, 0.9, { ease: 'sineInOut' });
      this.tween(s, { alpha: 0 }, 0.9, { ease: 'sineInOut' }).then(() => {
        // das Glühwürmchen kommt später wieder an seinem Platz (weich)
        g.zustand = 'weg';
        s.position.set(g.heim.x, g.heim.y);
      });
    });
  }

  rundeWechseln() {
    this.phase = 'wechsel';
    // Schlafende Tiere, Betten und Decken verblassen langsam (die Nacht geht weiter), dann kommt die nächste Runde
    const weg = [...this.tiere, ...this.tiere.map((a) => a.decke), ...this.betten.map((b) => b.s)].filter((o) => o && !o.destroyed);
    for (const o of weg) {
      o.eventMode = 'none';
      this.tween(o, { alpha: 0 }, 1.6, { ease: 'sineInOut' }).then(() => { if (!o.destroyed) o.destroy({ children: true }); });
    }
    this.tween(this.glas, { alpha: 0 }, 1.2, { ease: 'sineInOut' }).then(() => { this.glas.visible = false; });
    this.after(2.2, () => {
      for (const g of this.glueh) {
        g.hell = 1;
        if (g.zustand === 'weg' || g.zustand === 'steigt') continue;   // kommen von selbst weich zurück
        g.zustand = 'frei';
      }
      this.neueRunde();
    });
  }

  // ---------------------------------------------------------------- Finger = Taschenlampe

  beruehrt(e, tier = null) {
    if (e && e.pointerId !== undefined) this.lampenFinger = e.pointerId;
    const p = tier ? { x: tier.x, y: tier.y - (tier.hoehe || 200) * 0.5 } : { x: e.x, y: e.y };
    this.lampenZiel = { x: p.x, y: p.y };
    this.fingerTempo = 0;
    this.letzteBewegung = null;
    this.sammelBis = Infinity;
    const jetzt = performance.now();
    if (jetzt - this.letzterGlockenTon > 900) {
      this.letzterGlockenTon = jetzt;
      note('glocke', pick([84, 88, 91, 96]), { vol: 0.14 });
    }
  }

  // Fenster-Koordinaten → Seiten-Koordinaten
  ortVon(ev) {
    const p = new PIXI.Point();
    stage.app.renderer.events.mapPositionToPoint(p, ev.clientX, ev.clientY);
    return this.welt.toLocal(p);
  }

  fingerBewegt(ev) {
    if (!this.aktiv || ev.pointerId !== this.lampenFinger) return;
    // zieht der Finger gerade ein Tier oder eine Decke, folgt das Licht dem Ding (über beruehrt beim Greifen)
    const p = this.ortVon(ev);
    const jetzt = performance.now();
    const l = this.letzteBewegung;
    if (l && jetzt - l.t > 4) {
      const v = Math.hypot(p.x - l.x, p.y - l.y) / ((jetzt - l.t) / 1000);
      this.fingerTempo = Math.max(this.fingerTempo, Math.min(v, LAMPE_TEMPO_FINGER));
    }
    if (!l || jetzt - l.t > 4) this.letzteBewegung = { x: p.x, y: p.y, t: jetzt };
    this.lampenZiel = { x: p.x, y: p.y };
  }

  fingerLos(ev) {
    if (ev.pointerId !== this.lampenFinger) return;
    this.lampenFinger = null;
    this.sammelBis = Math.max(this.phase === 'gluehen' ? this.sammelBis : 0, this.t + 2);
    if (this.sammelBis === Infinity) this.sammelBis = this.t + 2;
  }

  setzeLicht() {
    this.schleier.position.set(this.lampe.x, this.lampe.y);
    this.schein.position.set(this.lampe.x, this.lampe.y);
  }

  // ---------------------------------------------------------------- Stimmung

  grillenStart() {
    const marke = (this.grillenMarke = (this.grillenMarke || 0) + 1);
    const zirpe = () => {
      if (marke !== this.grillenMarke || !this.aktiv) return;
      sfx('common/grillen', { vol: 0.22, streu: 0 }).then((klang) => {
        this.after(klang ? rand(0.5, 2) : 8, zirpe);
      });
    };
    this.after(0.8, zirpe);
  }

  sternschnuppe() {
    if (this.schnuppe && !this.schnuppe.destroyed) return;
    const s = new PIXI.Sprite(schweifTextur());
    s.anchor.set(1, 0.5);
    s.eventMode = 'none';
    s.blendMode = 'add';
    s.scale.set(0.85, 0.55);
    const von = { x: rand(-520, -300), y: rand(90, 150) };
    const nach = { x: von.x + rand(420, 560), y: von.y + rand(150, 200) };
    s.rotation = Math.atan2(nach.y - von.y, nach.x - von.x);
    s.position.set(von.x, von.y);
    s.alpha = 0;
    s.zIndex = -50;
    this.welt.addChild(s);
    this.schnuppe = s;
    this.tween(s, { alpha: 0.8 }, 0.6, { ease: 'sineInOut' });
    this.tween(s, { x: nach.x, y: nach.y }, 2.6, { ease: 'sineInOut' });
    this.after(1.9, () => {
      this.tween(s, { alpha: 0 }, 0.7, { ease: 'sineInOut' }).then(() => { if (!s.destroyed) s.destroy(); });
    });
  }

  // ---------------------------------------------------------------- Ablauf

  // Lampe gleitet zum Ziel: weich anfahren, höchstens LAMPE_TEMPO (beim Ziehen bis zum Fingertempo, solange das
  // Licht nah am Finger ist), weich bremsen. Gibt das jetzige Tempo zurück.
  bewegeLampe(dt, fingerDa) {
    this.fingerTempo *= Math.exp(-dt * 2.5);
    const dx = this.lampenZiel.x - this.lampe.x;
    const dy = this.lampenZiel.y - this.lampe.y;
    const d = Math.hypot(dx, dy);
    const nahAmFinger = fingerDa && d < LICHT_RADIUS * 1.5;
    const vmax = nahAmFinger ? Math.max(LAMPE_TEMPO, this.fingerTempo * 1.15) : LAMPE_TEMPO;
    const anfahren = LAMPE_ANFAHREN * (vmax / LAMPE_TEMPO);
    const wunsch = d < 0.5 ? 0 : Math.min(vmax, Math.sqrt(2 * anfahren * d), d * LAMPE_NAH);
    const wx = d < 0.5 ? 0 : (dx / d) * wunsch;
    const wy = d < 0.5 ? 0 : (dy / d) * wunsch;
    const v = this.lampenV;
    const ax = wx - v.x;
    const ay = wy - v.y;
    const da = Math.hypot(ax, ay);
    const maxDv = anfahren * dt;
    if (da > maxDv) { v.x += (ax / da) * maxDv; v.y += (ay / da) * maxDv; } else { v.x = wx; v.y = wy; }
    this.lampe.x += v.x * dt;
    this.lampe.y += v.y * dt;
    return Math.hypot(v.x, v.y);
  }

  update(dt, t) {
    const fingerDa = this.lampenFinger !== null;
    // Ein gezogenes Tier / eine gezogene Decke: das Licht folgt ihm (Schleife ohne neue Listen pro Bild)
    let gezogen = null;
    for (const a of this.tiere) {
      if (gezogen) break;
      if (!a.destroyed && a.zieh?.isDragging?.()) gezogen = a;
      else if (a.decke && !a.decke.destroyed && a.decke.zieh?.isDragging?.()) gezogen = a.decke;
    }
    if (gezogen) {
      this.lampenZiel.x = gezogen.x;
      this.lampenZiel.y = gezogen.y - (gezogen.hoehe || 0) * 0.5;
    }
    const tempo = this.bewegeLampe(dt, fingerDa);
    this.setzeLicht();
    // Steht das Licht am leuchtenden Glas, wird sein warmer Schein weich schwächer – sonst liefe beides ins Weiße
    const glasAnteil = clamp(this.glasSchein.alpha / GLAS_SCHEIN_MAX, 0, 1);
    const dGlas = Math.hypot(this.lampe.x - this.glasMitte.x, this.lampe.y - this.glasMitte.y);
    const nah = clamp(1 - (dGlas - 160) / 360, 0, 1);
    const scheinZiel = SCHEIN_ALPHA * (1 - 0.7 * nah * glasAnteil);
    this.schein.alpha += (scheinZiel - this.schein.alpha) * (1 - Math.exp(-dt * 2));

    for (const a of this.tiere) {
      if (a.destroyed) continue;
      if (a.laeuft || a.zieh?.isDragging?.()) a.zIndex = a.y;
      const d = Math.hypot(this.lampe.x - a.x, this.lampe.y - (a.y - a.hoehe * 0.45));
      if (a.schritt === 'wach') {
        // Licht ruht auf einem müden Tier → gefunden
        if (d < WECK_ABSTAND && tempo < RUHE_TEMPO) {
          a.ruhe += dt;
          if (a.ruhe >= WECK_ZEIT) this.gefunden(a);
        } else a.ruhe = 0;
        continue;
      }
      if (a.schritt !== 'schlaeft') continue;
      // schlafende Tiere blinzeln kurz, wenn das Licht auf ihnen ruht
      if (a.geblinzelt) {
        a.wachZeit += dt;
        if (a.wachZeit > WACH_ZEIT + (d < WECK_ABSTAND && fingerDa ? 2 : 0)) this.einschlafen(a);
        continue;
      }
      a.sperre = Math.max(0, a.sperre - dt);
      if (a.wegErst && d > WECK_ABSTAND * 1.3) a.wegErst = false;
      if (d < WECK_ABSTAND && a.sperre <= 0 && !a.wegErst && tempo < RUHE_TEMPO) {
        a.ruhe += dt;
        if (a.ruhe >= WECK_ZEIT) this.blinzeln(a);
      } else a.ruhe = 0;
    }

    // Glühwürmchen: schweben um ihr Zuhause, sammeln sich gemächlich um das Licht, fliegen ins Glas
    const sammeln = fingerDa || t < this.sammelBis;
    this.gesammelt += ((sammeln ? 1 : 0) - this.gesammelt) * (1 - Math.exp(-dt * 1.2));
    const amGlas = this.phase === 'gluehen' && Math.hypot(this.lampe.x - this.glasMitte.x, this.lampe.y - this.glasMitte.y) < GLAS_NAH;
    if (amGlas && this.gesammelt > 0.45 && t >= this.naechsterFlug && this.imGlas + this.zumGlas < GLAS_VOLL) {
      // das freie Glühwürmchen, das dem Licht am nächsten ist
      let naechstes = null;
      let best = Infinity;
      for (const g of this.glueh) {
        if (g.zustand !== 'frei') continue;
        const d = Math.hypot(g.s.x - this.lampe.x, g.s.y - this.lampe.y);
        if (d < best) { best = d; naechstes = g; }
      }
      if (naechstes) {
        this.insGlas(naechstes);
        this.naechsterFlug = t + 0.6;
      }
    }
    const kk = 1 - Math.exp(-dt * 1.4);
    for (const g of this.glueh) {
      g.phase += dt;
      const s = g.s;
      if (g.zustand === 'steigt') continue;
      if (g.zustand === 'weg') {
        // nach dem Freilassen leise wieder da (über einige Sekunden, kein Aufblitzen)
        s.alpha = Math.min(0.7, s.alpha + dt * 0.25);
        if (this.phase !== 'frei' && s.alpha >= 0.7) g.zustand = 'frei';
        continue;
      }
      let zx;
      let zy;
      if (g.zustand === 'zumGlas' || g.zustand === 'imGlas') {
        zx = this.glasMitte.x + g.platz.dx + Math.sin(g.phase * 0.7 + g.platz.ph) * 12;
        zy = this.glasMitte.y + g.platz.dy + Math.cos(g.phase * 0.6 + g.platz.ph) * 10;
        const k2 = 1 - Math.exp(-dt * (g.zustand === 'zumGlas' ? 1.6 : 3));
        s.x += (zx - s.x) * k2;
        s.y += (zy - s.y) * k2;
        if (g.zustand === 'zumGlas' && Math.hypot(zx - s.x, zy - s.y) < 30) this.angekommenImGlas(g);
      } else {
        const fx_ = g.heim.x + Math.sin(g.phase * g.tx) * 140;
        const fy = g.heim.y + Math.cos(g.phase * g.ty) * 70;
        const w = g.ring + g.phase * 0.35;
        const r = 120 + 50 * Math.sin(g.phase * 0.5 + g.ring);
        const sx = this.lampe.x + Math.cos(w) * r;
        const sy = this.lampe.y + Math.sin(w) * r * 0.7;
        zx = fx_ + (sx - fx_) * this.gesammelt;
        zy = fy + (sy - fy) * this.gesammelt;
        s.x += (zx - s.x) * kk;
        s.y += (zy - s.y) * kk;
      }
      // sanftes Glühen (Periode mehrere Sekunden – kein Blinken)
      const hell = Math.min(1, (0.65 + 0.35 * Math.sin((g.phase / g.puls) * Math.PI * 2)) * g.hell);
      s.alpha += (hell - s.alpha) * Math.min(1, dt * 2.5);   // weich nachführen – nie ein Sprung
    }

  }

  hinweise() {
    if (this.phase === 'voll') return [this.glas];
    if (this.phase === 'gluehen') {
      const g = this.glueh.find((x) => x.zustand === 'frei');
      return g ? [{ von: g.s, nach: this.glas }, this.glas] : [this.glas];
    }
    // Glühwürmchen steigen auf, die Nacht wechselt: zuschauen – die Hand zeigt höchstens auf die Eule (sie freut sich)
    if (this.phase !== 'tiere') return [this.eule];
    const liste = [];
    for (const a of this.tiere) {
      if (a.destroyed) continue;
      if (a.schritt === 'gefunden' && a.wunschBett) liste.push({ von: a, nach: { x: a.wunschBett.platz.x, y: a.wunschBett.platz.y - 80 } });
      else if (a.schritt === 'imBett' && a.decke && !a.decke.destroyed && !a.decke.unterwegs) liste.push({ von: a.decke, nach: a });
      else if (a.schritt === 'zugedeckt') liste.push(a);
    }
    if (!liste.length) {
      const wach = this.tiere.find((a) => a.schritt === 'wach' && !a.destroyed);
      if (wach) liste.push(wach);
    }
    return liste.length ? liste : [this.eule];
  }
}
