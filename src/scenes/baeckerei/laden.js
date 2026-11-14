// Seite 3: der Laden – Gäste kaufen ein, oder das Lieferrad wird beladen.
//
// Gast-Runde (meistens):
//   1. Ein Tier kommt zur Tür herein (die Türglocke klingt leise) und denkt an etwas Gebackenes (Denkblase).
//   2. Packen: das Gewünschte aus der Auslage in die Tüte ziehen oder antippen – ein, zwei oder drei Sachen.
//      Jedes Gebäck ist willkommen; passt es zum Wunsch, nickt der Gast. Die Auslage füllt sich gleich wieder.
//   3. Zufalten: die Tüte antippen – sie faltet sich zu (mit Herz-Siegel).
//   4. Geben: die Tüte zum Gast ziehen (oder antippen) – er nimmt sie und legt eine Münze auf die Theke.
//   5. Kasse: die Kasse antippen – die Münze hüpft hinein, die Kasse klingt leise. Der Gast winkt und geht.
// Lieferrad-Runde (jede dritte):
//   1. Ein Bote schiebt das Lieferrad herein. 2. Drei Sachen aus der Auslage in die Kiste (ziehen oder tippen).
//   3. Die Fahrradklingel antippen – der Bote fährt ganz langsam los.
// Was wächst: Das Wandregal zeigt alles, was in der Backstube (Seite 1) schon gebacken wurde (gespeichert).
// Jede Runde ändern sich Gast, Wünsche (Sorte und Anzahl) und Bote.

import { tap, drag, sfx, voice, note, fx, Actor, spr, meta, pick, killTweensOf, PIXI } from '../../engine/index.js';
import { Seite } from '../../gemeinsam/seiten.js';
import { belohne } from '../../gemeinsam/sticker.js';
import { umhängen, bogen, gleitDauer, wähleNeu, kurz, skalaFür, gebacken } from './helfer.js';

// ---------------------------------------------------------------- Maße
const THEKE_Y = 930;                 // hier steht alles auf der Theke
const BODEN_Y = 1565;                // Fußboden vor der Theke
const WAREN = {
  brezel: { bild: 'baeckerei/brezel', breite: 165 },
  broetchen: { bild: 'baeckerei/broetchen', breite: 140 },
  hoernchen: { bild: 'baeckerei/hoernchen', breite: 165 },
  brot: { bild: 'baeckerei/brot', breite: 200 },
  keks: { bild: 'baeckerei/keks_herz', breite: 120 },
};
const AUSLAGE_X = { brezel: -540, broetchen: -360, hoernchen: -180, brot: 20, keks: 210 };
const TÜTE = { x: 470, s: 0.82 };
const KASSE = { x: 860, s: 0.72 };
const GAST = { x: -830, s: 0.6 };
const GAST_VON = -1560;
const GÄSTE = ['kuh', 'pferd', 'schaf', 'schwein', 'katze', 'hase', 'igel', 'ente', 'elefant', 'giraffe', 'affe',
  'baer', 'maus', 'eichhoernchen', 'huhn', 'frosch', 'pinguin', 'loewe'];
const BOTEN = ['hund', 'fuchs', 'affe', 'schwein'];
const GAST_SKALA = { maus: 0.5, igel: 0.52, ente: 0.54, frosch: 0.52, huhn: 0.54, giraffe: 0.52, elefant: 0.56 };
const RAD = { x: 260, s: 1.15 };
const BOTE_SKALA = 0.5;
const RAD_KISTE = [[395, 112], [470, 104], [548, 112]];   // Plätze in der Kiste (Bildpunkte des Rads)
const BOTE_X = -240;
// Wandregal: Oberkanten der drei Bretter, Breite (oben rechts bleibt die Album-Ecke frei)
const REGAL = [
  { y: 222, von: -470, bis: 760 },
  { y: 414, von: -470, bis: 1170 },
  { y: 606, von: -470, bis: 1170 },
];
const REGAL_BREITE = 118;

export class Laden extends Seite {
  static hg = 'baeckerei/hg_laden';

  aufbau() {
    this.uhr = 0;
    this.tonBis = {};
    this.runde = 0;
    this.r = null;
    this.gastVerlauf = [];
    this.botenVerlauf = [];
    this.auslage = {};
    for (const sorte of Object.keys(WAREN)) this.legeAus(sorte, false);
    this.baueTüte();
    this.baueKasse();
    this.baueDeko();
    this.regalTeile = [];
    this.füllRegal(false);
    this.neueRunde({ erste: true });
  }

  betreten() {
    this._hinweis?.kill();
    this.füllRegal(true);
    this._hinweis = this.after(2.4, () => this.sageHinweis());
    if (this.r?.gast && this.r.art === 'gast') this.after(1.0, () => { if (this.aktiv) this.zeigeWunsch(); });
  }

  verlassen() {
    this._hinweis?.kill();
    this._hinweis = null;
  }

  tonEinmal(id, sek, opt) {
    if (this.uhr < (this.tonBis[id] || 0)) return;
    this.tonBis[id] = this.uhr + sek;
    sfx(id, opt);
  }

  sageHinweis() {
    const r = this.r;
    if (!this.aktiv || !r) return;
    if (r.art === 'rad' && r.phase === 'laden') voice('baeckerei_rad', { nurWenn: () => this.aktiv && this.r === r && r.phase === 'laden' });
    if (r.art === 'gast' && r.phase === 'packen') voice('baeckerei_laden', { nurWenn: () => this.aktiv && this.r === r && r.phase === 'packen' });
  }

  // ---------------------------------------------------------------- Auslage

  legeAus(sorte, weich = true) {
    const w = WAREN[sorte];
    const s = skalaFür(w.bild, w.breite, w.breite);
    const m = meta(w.bild);
    const y = THEKE_Y - (1 - (m.ay ?? 0.5)) * (m.h || 200) * s;
    const sp = spr(w.bild, { anchor: 0.5, parent: this.welt, x: AUSLAGE_X[sorte], y, z: 400 });
    sp.scale.set(s);
    sp.hitArea = fläche260(sp, s);
    const ware = { sorte, sp, s, heim: { x: AUSLAGE_X[sorte], y }, weg: false };
    this.auslage[sorte] = ware;
    if (weich) {
      sp.alpha = 0;
      sp.scale.set(s * 0.3);
      this.tween(sp, { alpha: 1 }, 0.5, { ease: 'sineInOut' });
      this.tween(sp.scale, { x: s, y: s }, 0.55, { ease: 'backOut' });
    }
    ware.zug = drag(sp, {
      back: false, lift: 1.1,
      targets: () => {
        const r = this.r;
        if (r?.art === 'gast' && r.phase === 'packen') return [{ id: 'tüte', x: TÜTE.x, y: THEKE_Y - 140, radius: 260 }];
        if (r?.art === 'rad' && r.phase === 'laden' && r.rad) return [{ id: 'rad', x: r.rad.x + 80, y: BODEN_Y - 300, radius: 320 }];
        return [];
      },
      onDrop: (ziel, ctx) => this.wareLosgelassen(ware, ziel, ctx),
    });
    return ware;
  }

  wareLosgelassen(ware, ziel, ctx) {
    const r = this.r;
    const tipp = kurz(ctx);
    if (r?.art === 'gast' && r.phase === 'packen' && (ziel || tipp)) { this.packe(ware); return; }
    if (r?.art === 'rad' && r.phase === 'laden' && (ziel || tipp)) { this.ladeAufsRad(ware); return; }
    const sp = ware.sp;
    sp.zIndex = 400;
    this.tween(sp, ware.heim, gleitDauer(ware.heim.x - sp.x, ware.heim.y - sp.y, 0.3, 3), { ease: 'cubicOut' });
    if (tipp) {
      fx.wobble(sp, 0.06);
      note('xylo', pick([72, 74, 76, 79]), { vol: 0.25 });
    }
  }

  // Ware verlässt die Auslage; ein Stück später liegt eine neue da
  nimmWare(ware) {
    ware.weg = true;
    ware.zug?.off();
    const sp = ware.sp;
    sp.eventMode = 'none';
    killTweensOf(sp);
    sp.zIndex = 1600;
    this.after(0.9, () => { if (this.auslage[ware.sorte] === ware) this.legeAus(ware.sorte); });
    return sp;
  }

  // ---------------------------------------------------------------- Tüte, Kasse, Deko

  baueTüte() {
    const c = new PIXI.Container({ label: 'tuete', sortableChildren: true });
    c.position.set(TÜTE.x, THEKE_Y);
    c.zIndex = 500;
    this.welt.addChild(c);
    const inhalt = new PIXI.Container({ label: 'tueteninhalt' });
    inhalt.zIndex = 1;
    c.addChild(inhalt);
    const offen = spr('baeckerei/tuete_offen', { parent: c, z: 2 });
    offen.scale.set(TÜTE.s);
    const zu = spr('baeckerei/tuete_zu', { parent: c, z: 3 });
    zu.scale.set(TÜTE.s);
    zu.alpha = 0;
    const m = meta('baeckerei/tuete_offen');
    c.hitArea = new PIXI.Rectangle(-150, -m.h * TÜTE.s - 40, 300, m.h * TÜTE.s + 60);
    this.tüte = { c, inhalt, offen, zu, n: 0, oben: -(m.ay * m.h - 70) * TÜTE.s };
    this.tüteZug = drag(c, {
      back: false, lift: 1.06,
      targets: () => {
        const r = this.r;
        return r?.art === 'gast' && r.phase === 'geben' && r.gast && !r.gast.destroyed
          ? [{ id: 'gast', x: r.gast.x, y: r.gast.y - 220, radius: 320 }] : [];
      },
      onDrop: (ziel, ctx) => this.tüteLosgelassen(ziel, ctx),
    });
  }

  tüteLosgelassen(ziel, ctx) {
    const r = this.r;
    const c = this.tüte.c;
    const tipp = kurz(ctx);
    if (r?.art === 'gast' && r.phase === 'geben' && (ziel || tipp)) { this.gibTüte(); return; }
    c.zIndex = 500;
    this.tween(c, { x: TÜTE.x, y: THEKE_Y }, gleitDauer(TÜTE.x - c.x, THEKE_Y - c.y, 0.3, 3), { ease: 'cubicOut' });
    if (!tipp) return;
    if (r?.art === 'gast' && r.phase === 'zufalten') { this.falteZu(); return; }
    if (r?.art === 'gast' && r.phase === 'packen') { this.packe(this.wunschWare()); return; }
    fx.wobble(c, 0.04);
    this.tonEinmal('common/rascheln', 0.5, { vol: 0.3 });
  }

  // eine neue, leere, offene Tüte
  neueTüte() {
    const t = this.tüte;
    t.inhalt.removeChildren().forEach((x) => x.destroy());
    t.n = 0;
    t.c.position.set(TÜTE.x, THEKE_Y);
    t.c.alpha = 0;
    t.c.scale.set(0.5);
    t.c.eventMode = 'static';
    t.zu.alpha = 0;
    t.offen.alpha = 1;
    t.c.zIndex = 500;
    this.tween(t.c, { alpha: 1 }, 0.4, { ease: 'sineInOut' });
    this.tween(t.c.scale, { x: 1, y: 1 }, 0.5, { ease: 'backOut' });
  }

  baueKasse() {
    const k = spr('baeckerei/kasse', { parent: this.welt, x: KASSE.x, y: THEKE_Y + 4, z: 450 });
    k.scale.set(KASSE.s);
    const m = meta('baeckerei/kasse');
    k.hitArea = new PIXI.Rectangle(-m.ax * m.w - 40, -m.ay * m.h - 40, m.w + 80, m.h + 80);
    tap(k, () => this.kasseAngetippt(), { sound: null, squash: false });
    this.kasse = k;
  }

  kasseAngetippt() {
    const r = this.r;
    if (r?.art === 'gast' && r.phase === 'kasse') { this.kassiere(); return; }
    fx.wobble(this.kasse, 0.03);
    if (this.uhr > (this.kasseTon || 0)) {
      this.kasseTon = this.uhr + 0.5;
      note('glocke', pick([84, 88]), { vol: 0.22 });
    }
  }

  baueDeko() {
    const zone = (x, y, w, h, fn) => {
      const c = new PIXI.Container({ label: 'deko' });
      c.position.set(x, y);
      c.hitArea = new PIXI.Rectangle(-w / 2, -h / 2, w, h);
      c.zIndex = 5;
      this.welt.addChild(c);
      tap(c, fn, { sound: null, squash: false });
    };
    // Türglocke
    zone(-880, 250, 280, 280, () => this.türglocke());
    // Markise
    let ton = 0;
    zone(0, 90, 1900, 200, () => {
      note('pling', [76, 79, 81, 84, 86][ton++ % 5], { vol: 0.22 });
    });
    // Tür und Garten draußen
    zone(-1000, 800, 420, 700, () => {
      this.tonEinmal('common/wusch', 0.6, { vol: 0.22 });
      this.burst('blaetter', -960, 700, { count: 2 });
    });
    // Thekenfront klopft leise
    zone(350, 1100, 1900, 300, () => this.tonEinmal('common/klack', 0.3, { vol: 0.25 }));
  }

  türglocke() {
    if (this.uhr < (this.glockeBis || 0)) return;
    this.glockeBis = this.uhr + 0.8;
    note('glocke', 88, { vol: 0.25 });
    this.after(0.22, () => note('glocke', 84, { vol: 0.22 }));
    this.burst('funkeln', -876, 300, { count: 2 });
  }

  // ---------------------------------------------------------------- Wandregal (wächst)

  // Platz des i-ten Gebäcks im Regal: unten beginnend
  regalPlatz(i) {
    let rest = i;
    for (let b = REGAL.length - 1; b >= 0; b--) {
      const brett = REGAL[b];
      const n = Math.floor((brett.bis - brett.von) / (REGAL_BREITE + 40)) + 1;
      if (rest < n) return { x: brett.von + rest * (REGAL_BREITE + 40), y: brett.y };
      rest -= n;
    }
    return null;
  }

  füllRegal(weich) {
    const liste = gebacken();
    // schon richtig? Dann bleibt alles stehen
    const gleich = this.regalTeile.length === liste.length && this.regalTeile.every((t, i) => t.sorte === liste[i]);
    if (gleich) return;
    // neu aufbauen: die ersten, die schon stimmen, bleiben, der Rest kommt weich dazu
    let gleichBis = 0;
    while (gleichBis < this.regalTeile.length && gleichBis < liste.length && this.regalTeile[gleichBis].sorte === liste[gleichBis]) gleichBis++;
    for (const t of this.regalTeile.splice(gleichBis)) t.sp.destroy();
    for (let i = gleichBis; i < liste.length; i++) {
      const p = this.regalPlatz(i);
      if (!p) break;
      const sorte = liste[i];
      const w = WAREN[sorte] || WAREN.brezel;
      const s = skalaFür(w.bild, REGAL_BREITE, REGAL_BREITE * 0.9);
      const m = meta(w.bild);
      const y = p.y - (1 - (m.ay ?? 0.5)) * (m.h || 200) * s + 6;
      const sp = spr(w.bild, { anchor: 0.5, parent: this.welt, x: p.x, y, z: 100 + i });
      sp.scale.set(s);
      sp.hitArea = fläche260(sp, s, 200);
      tap(sp, () => {
        fx.wobble(sp, 0.06);
        note('xylo', [72, 74, 76, 79, 81, 84][i % 6], { vol: 0.25 });
      }, { sound: null, squash: false });
      // Nur die neuesten (höchstens drei) erscheinen weich – rückt ein volles Regal weiter, stehen die
      // übrigen still an ihrem Platz (kein Gewimmel aus vielen Sprüngen)
      const ab = Math.max(gleichBis, liste.length - 3);
      if (weich && i >= ab) {
        sp.alpha = 0;
        sp.scale.set(s * 0.3);
        const verz = 0.4 + (i - ab) * 0.25;
        this.tween(sp, { alpha: 1 }, 0.5, { ease: 'sineInOut', delay: verz });
        this.tween(sp.scale, { x: s, y: s }, 0.55, { ease: 'backOut', delay: verz });
        if (i === ab) this.after(verz, () => sfx('common/funkeln', { vol: 0.3 }));
      }
      this.regalTeile.push({ sorte, sp });
    }
  }

  // ---------------------------------------------------------------- Runden

  async neueRunde({ erste = false } = {}) {
    this.runde++;
    const art = this.runde % 3 === 0 ? 'rad' : 'gast';
    const r = { art, phase: 'kommt', gast: null, fertig: false };
    this.r = r;
    if (art === 'gast') await this.gastKommt(r, erste);
    else await this.radKommt(r);
  }

  async gastKommt(r, erste) {
    const tier = wähleNeu(GÄSTE, this.gastVerlauf, 4);
    const s = GAST_SKALA[tier] ?? GAST.s;
    r.wünsche = [];
    const n = pick([1, 2, 2, 3]);
    for (let i = 0; i < n; i++) r.wünsche.push(pick(Object.keys(WAREN)));
    r.gepackt = 0;
    this.neueTüte();
    const a = new Actor(tier, { x: erste ? GAST.x : GAST_VON, y: BODEN_Y, scale: s, parent: this.welt, z: 1500 });
    a.onTap(() => this.gastAngetippt(a), { pad: 30 });
    r.gast = a;
    if (!erste) {
      this.türglocke();
      await a.walkTo(GAST.x, BODEN_Y, { tempo: 330 });
      if (this.r !== r || a.destroyed) return;
    }
    a.lookAt(TÜTE.x);
    r.phase = 'packen';
    if (this.aktiv) this.after(0.3, () => this.zeigeWunsch());
    this.after(0.8, () => { if (this.r === r && r.phase === 'packen') this.sageHinweis(); });
  }

  wunschWare() {
    const r = this.r;
    const sorte = r?.wünsche?.[r.gepackt] || 'brezel';
    return this.auslage[sorte];
  }

  zeigeWunsch() {
    const r = this.r;
    const a = r?.gast;
    if (!a || a.destroyed || r.art !== 'gast') return;
    if (r.phase === 'packen') a.bubble(WAREN[r.wünsche[r.gepackt]].bild, 2.6, { seite: 'rechts' });
    else if (r.phase === 'kasse' || r.phase === 'geben' || r.phase === 'zufalten') a.bubble('baeckerei/tuete_zu', 2.0, { seite: 'rechts' });
  }

  gastAngetippt(a) {
    const r = this.r;
    fx.wobble(a, 0.06);
    if (this.uhr > (this.gastLaut || 0)) { this.gastLaut = this.uhr + 1.2; a.sound(); }
    if (!r || r.gast !== a) return;
    if (r.phase === 'geben') { this.gibTüte(); return; }
    this.zeigeWunsch();
  }

  // Ware fliegt in die Tüte (jede ist willkommen)
  async packe(ware) {
    const r = this.r;
    if (!ware || ware.weg || r?.art !== 'gast' || r.phase !== 'packen' || r.gepackt >= r.wünsche.length) return;
    const passt = ware.sorte === r.wünsche[r.gepackt];
    r.gepackt++;
    const fertig = r.gepackt >= r.wünsche.length;
    if (fertig) r.phase = 'warten';
    const sp = this.nimmWare(ware);
    const t = this.tüte;
    const i = t.n++;
    const ziel = { x: t.c.x + [-40, 40, 0][i % 3], y: t.c.y + t.oben - 10 };
    await bogen(this, sp, ziel.x, ziel.y - 40, { dauer: 0.5, höhe: 110, skala: ware.s * 0.8 });
    if (sp.destroyed) return;
    umhängen(sp, t.inhalt);
    await this.tween(sp, { y: sp.y + 40 }, 0.18, { ease: 'quadIn' });
    this.tonEinmal('common/rascheln', 0.3, { vol: 0.4 });
    fx.pop(t.c, 0.05);
    const a = r.gast;
    if (a && !a.destroyed) {
      if (passt) { a.nod?.(); note('glocke', [79, 84, 88][i % 3], { vol: 0.22 }); }
      else a.hop(40);
    }
    if (this.r !== r) return;
    if (!fertig) {
      this.after(0.4, () => { if (this.aktiv && this.r === r && r.phase === 'packen') this.zeigeWunsch(); });
      return;
    }
    await this.wait(0.4);
    if (this.r !== r) return;
    r.phase = 'zufalten';
    if (this.aktiv) fx.pop(t.c, 0.06);
  }

  async falteZu() {
    const r = this.r;
    if (r?.phase !== 'zufalten') return;
    r.phase = 'warten';
    const t = this.tüte;
    sfx('common/rascheln', { vol: 0.5 });
    this.tween(t.zu, { alpha: 1 }, 0.5, { ease: 'sineInOut' });
    this.tween(t.inhalt, { alpha: 0 }, 0.4, { ease: 'sineInOut' });
    await this.tween(t.offen, { alpha: 0 }, 0.5, { ease: 'sineInOut' });
    fx.pop(t.c, 0.06);
    this.burst('herzen', t.c.x, t.c.y - 200, { count: 1 });
    t.inhalt.alpha = 1;
    t.inhalt.removeChildren().forEach((x) => x.destroy());
    if (this.r !== r) return;
    r.phase = 'geben';
    this.after(0.3, () => { if (this.aktiv && this.r === r && r.phase === 'geben') this.zeigeWunsch(); });
  }

  async gibTüte() {
    const r = this.r;
    if (r?.phase !== 'geben') return;
    const a = r.gast;
    if (!a || a.destroyed) return;
    r.phase = 'warten';
    const c = this.tüte.c;
    c.eventMode = 'none';
    killTweensOf(c);
    c.zIndex = 1600;
    await bogen(this, c, a.x + 130, a.y - 40, { dauer: 0.6, höhe: 120, skala: 0.62 });
    if (a.destroyed || c.destroyed || this.r !== r) return;
    sfx('common/rascheln', { vol: 0.4 });
    r.tasche = c;
    a.cheer({ parent: this.vorn });
    // Der Gast legt eine Münze auf die Theke (gezeichnet)
    await this.wait(0.6);
    if (this.r !== r || a.destroyed) return;
    const m = new PIXI.Graphics();
    m.circle(0, 0, 30).fill(0xf6c94a).stroke({ width: 5, color: 0xc98f22 });
    m.circle(0, 0, 18).stroke({ width: 3, color: 0xe0a832 });
    m.circle(-9, -9, 6).fill({ color: 0xffffff, alpha: 0.6 });
    m.position.set(a.x + 60, a.y - 260);
    m.zIndex = 1700;
    m.eventMode = 'none';
    this.welt.addChild(m);
    r.münze = m;
    await bogen(this, m, KASSE.x - 230, THEKE_Y - 26, { dauer: 0.6, höhe: 140 });
    if (this.r !== r) return;
    note('glocke', 91, { vol: 0.2 });
    r.phase = 'kasse';
    if (this.aktiv) fx.pop(this.kasse, 0.04);
  }

  async kassiere() {
    const r = this.r;
    if (r?.phase !== 'kasse') return;
    r.phase = 'warten';
    const m = r.münze;
    const k = this.kasse;
    if (m && !m.destroyed) {
      await bogen(this, m, KASSE.x, THEKE_Y - 180, { dauer: 0.45, höhe: 80, skala: 0.6 });
      if (!m.destroyed) m.destroy();
    }
    // Die Kasse klingt leise: zwei helle Töne, die Lade hüpft
    note('glocke', 84, { vol: 0.28 });
    this.after(0.25, () => note('glocke', 91, { vol: 0.24 }));
    fx.pop(k, 0.05);
    this.burst('funkeln', KASSE.x, THEKE_Y - 300, { count: 2 });
    await this.wait(0.6);
    if (this.r !== r) return;
    await this.rundeGeschafft(r);
  }

  // ---------------------------------------------------------------- Lieferrad

  async radKommt(r) {
    const tier = wähleNeu(BOTEN, this.botenVerlauf, 1);
    const rad = new PIXI.Container({ label: 'lastenrad', sortableChildren: true });
    rad.position.set(GAST_VON - 400, BODEN_Y);
    rad.zIndex = 1450;
    this.welt.addChild(rad);
    const kiste = new PIXI.Container({ label: 'kiste' });
    kiste.zIndex = 1;
    rad.addChild(kiste);
    const bild = spr('baeckerei/lastenrad', { parent: rad, z: 2 });
    bild.scale.set(RAD.s);
    const m = meta('baeckerei/lastenrad');
    rad.hitArea = new PIXI.Rectangle(-m.ax * m.w * RAD.s - 20, -m.ay * m.h * RAD.s - 40, m.w * RAD.s + 40, m.h * RAD.s + 60);
    tap(rad, () => this.radAngetippt(), { sound: null, squash: false });
    const punkt = (px, py) => ({ x: (px - m.ax * m.w) * RAD.s, y: (py - m.ay * m.h) * RAD.s });
    r.rad = rad;
    r.kiste = kiste;
    r.radPunkt = punkt;
    r.klingel = punkt(333, 28);
    r.geladen = 0;
    const a = new Actor(tier, { x: GAST_VON, y: BODEN_Y, scale: BOTE_SKALA, parent: this.welt, z: 1500 });
    a.onTap(() => this.gastAngetippt(a), { pad: 30 });
    r.gast = a;
    this.türglocke();
    // Rad und Bote kommen gemeinsam herein
    const dauer = (RAD.x - rad.x) / 420;
    this.tween(rad, { x: RAD.x }, dauer, { ease: 'linear' });
    await a.walkTo(BOTE_X, BODEN_Y, { tempo: (BOTE_X - GAST_VON) / dauer });
    if (this.r !== r || a.destroyed) return;
    a.lookAt(RAD.x);
    this.tonEinmal('common/klack', 0.3, { vol: 0.3 });
    r.phase = 'laden';
    this.after(0.6, () => { if (this.r === r && r.phase === 'laden') this.sageHinweis(); });
  }

  async ladeAufsRad(ware) {
    const r = this.r;
    if (!ware || ware.weg || r?.art !== 'rad' || r.phase !== 'laden' || r.geladen >= RAD_KISTE.length) return;
    const i = r.geladen++;
    if (r.geladen >= RAD_KISTE.length) r.phase = 'warten';
    const sp = this.nimmWare(ware);
    const p = r.radPunkt(...RAD_KISTE[i]);
    await bogen(this, sp, r.rad.x + p.x, r.rad.y + p.y - 40, { dauer: 0.55, höhe: 130, skala: ware.s * 0.75 });
    if (sp.destroyed || r.rad.destroyed) return;
    umhängen(sp, r.kiste);
    await this.tween(sp, { y: sp.y + 40 }, 0.18, { ease: 'quadIn' });
    sfx('common/landen', { vol: 0.35 });
    note('glocke', [79, 84, 88][i], { vol: 0.2 });
    fx.pop(r.rad, 0.03);
    if (this.r !== r) return;
    if (r.geladen >= RAD_KISTE.length) {
      await this.wait(0.4);
      if (this.r !== r) return;
      r.phase = 'klingeln';
      if (r.gast && !r.gast.destroyed) r.gast.cheer({ parent: this.vorn });
      if (this.aktiv) fx.pop(r.rad, 0.04);
    }
  }

  radAngetippt() {
    const r = this.r;
    if (!r?.rad) return;
    // Die Klingel klingt immer (leise, nicht gestapelt)
    if (this.uhr > (this.klingelBis || 0)) {
      this.klingelBis = this.uhr + 0.7;
      note('glocke', 93, { vol: 0.22 });
      this.after(0.16, () => note('glocke', 93, { vol: 0.18 }));
    }
    if (r.phase === 'klingeln') { this.radFährt(); return; }
    if (r.phase === 'laden') {
      const w = Object.values(this.auslage).find((x) => !x.weg);
      if (w) this.ladeAufsRad(w);
      return;
    }
    fx.wobble(r.rad, 0.02);
  }

  async radFährt() {
    const r = this.r;
    if (r.phase !== 'klingeln') return;
    r.phase = 'warten';
    const a = r.gast;
    await this.wait(0.5);
    if (this.r !== r) return;
    // ganz langsam los nach rechts, der Bote läuft mit
    const ziel = 1900;
    const tempo = 380;
    const dauer = (ziel - r.rad.x) / tempo;
    this.tween(r.rad, { x: ziel }, dauer, { ease: 'linear' });
    if (a && !a.destroyed) a.walkTo(ziel - (RAD.x - BOTE_X), BODEN_Y, { tempo: (ziel - r.rad.x) / dauer });
    await this.wait(1.2);
    if (this.r !== r) return;
    await this.rundeGeschafft(r, dauer - 1.2);
  }

  // ---------------------------------------------------------------- Ende der Runde

  async rundeGeschafft(r, nochWarten = 0) {
    if (r.fertig) return;
    r.fertig = true;
    r.phase = 'fertig';
    await belohne(this, 'baeckerei_tuete', r.art === 'rad' ? 300 : -300, 520);
    if (this.r !== r) return;
    if (r.art === 'gast') {
      const a = r.gast;
      if (a && !a.destroyed) {
        // die Tüte geht mit
        if (r.tasche && !r.tasche.destroyed) {
          umhängen(r.tasche, a);
          r.tasche.scale.set(r.tasche.scale.x / Math.max(0.1, Math.abs(a.scale.x)));
          r.tasche.zIndex = 5;
        }
        a.bubble('common/p_herz', 1.2, { seite: 'rechts' });
        await this.wait(1.3);
        if (!a.destroyed) await a.walkTo(GAST_VON, BODEN_Y, { tempo: 330 });
      }
      if (r.tasche && !r.tasche.destroyed) {
        // die Tüte hing am Gast; für die nächste Runde zurück an ihren Platz
        umhängen(r.tasche, this.welt);
      }
      if (a && !a.destroyed) a.destroy({ children: true });
    } else {
      await this.wait(Math.max(0, nochWarten));
      if (r.rad && !r.rad.destroyed) r.rad.destroy({ children: true });
      if (r.gast && !r.gast.destroyed) r.gast.destroy({ children: true });
    }
    await this.wait(0.6);
    if (this.r !== r) return;
    this.neueRunde();
  }

  // ---------------------------------------------------------------- Ablauf

  update(dt) {
    this.uhr += dt;
  }

  hinweise() {
    const r = this.r;
    if (!r) return [];
    const ware = (sorte) => {
      const w = this.auslage[sorte];
      return w && !w.weg ? w : Object.values(this.auslage).find((x) => !x.weg);
    };
    switch (r.phase) {
      case 'packen': {
        const w = ware(r.wünsche[r.gepackt]);
        return w ? [{ von: w.sp, nach: { x: TÜTE.x, y: THEKE_Y - 160 } }] : [];
      }
      case 'zufalten': return [this.tüte.c];
      case 'geben': return r.gast && !r.gast.destroyed ? [{ von: this.tüte.c, nach: { x: r.gast.x, y: r.gast.y - 220 } }] : [];
      case 'kasse': return [this.kasse];
      case 'laden': {
        const w = ware('brezel');
        return w && r.rad ? [{ von: w.sp, nach: { x: r.rad.x + 80, y: BODEN_Y - 280 } }] : [];
      }
      case 'klingeln': return r.rad ? [{ x: r.rad.x + r.klingel.x, y: r.rad.y + r.klingel.y }] : [];
      default: return [];
    }
  }
}

// Tippfläche: mindestens `min` Einheiten groß (Rechteck um das Bild)
function fläche260(sp, s, min = 260) {
  const w = Math.max(sp.texture.width, min / s);
  const h = Math.max(sp.texture.height, min / s);
  return new PIXI.Rectangle(-sp.anchor.x * sp.texture.width - (w - sp.texture.width) / 2,
    -sp.anchor.y * sp.texture.height - (h - sp.texture.height) / 2, w, h);
}
