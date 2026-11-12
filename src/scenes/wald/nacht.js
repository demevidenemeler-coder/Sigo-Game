// Seite 2 – Waldnacht. Ruhig und friedlich, nie gruselig.
// Fünf Tiere schlafen (leise zzz), die Eule sitzt wach auf dem Ast. Der Finger ist eine Taschenlampe: ein weicher,
// warmer Lichtkreis folgt ihm träge (Tipp an eine ferne Stelle: das Licht gleitet ruhig hinüber, es saust nicht).
// Ruht das Licht auf einem schlafenden Tier, blinzelt es, hebt den Kopf,
// macht leise seinen Laut und schläft nach ein paar Sekunden wieder ein. Glühwürmchen treiben langsam; beim
// Berühren sammeln sie sich um das Licht und schweben danach wieder auseinander. Grillen zirpen leise,
// selten zieht langsam eine Sternschnuppe vorbei.

import { stage, spr, sfx, voice, note, tap, Actor, fx, rand, pick, shuffle, PIXI } from '../../engine/index.js';
import { Seite } from '../../gemeinsam/seiten.js';
import { belohne } from '../../gemeinsam/sticker.js';
import { jubel, dunkelTextur, schweifTextur } from './deko.js';

const SCHLAEFER = ['fuchs', 'hase', 'igel', 'baer', 'eichhoernchen'];
const LICHT_RADIUS = 330;         // sichtbarer heller Kreis (Einheiten)
const SCHLEIER_ALPHA = 0.5;       // wie dunkel es außerhalb des Lichts ist
const WECK_ABSTAND = 210;         // so nah muss das Licht der Mitte eines Tiers kommen
const WECK_ZEIT = 0.45;           // so lange muss es dort ruhen (s)
const WACH_ZEIT = 4.2;            // so lange bleibt ein Tier wach (s)
const WIEDER_SPERRE = 2.5;        // danach schläft es mindestens so lange
// Tempo der Lampe: Springt das Ziel (Tipp an eine andere Stelle), gleitet das Licht ruhig hinüber – höchstens
// LAMPE_TEMPO Einheiten/s, weich anfahren und weich bremsen (LAMPE_ANFAHREN Einheiten/s²). Zieht der Finger
// selbst schneller, darf das Licht ihm bis LAMPE_TEMPO_FINGER folgen (das Kind bestimmt das Tempo).
const LAMPE_TEMPO = 800;
const LAMPE_TEMPO_FINGER = 2400;
const LAMPE_ANFAHREN = 1600;
const LAMPE_NAH = 4.5;            // nah am Ziel: Rest-Abstand × LAMPE_NAH = Tempo (wie das frühere träge Folgen)
const RUHE_TEMPO = 300;           // nur ein (fast) ruhendes Licht weckt ein Tier – vorbeigleitendes nicht
const GLUEH_ANZAHL = 9;
// Glühwürmchen schweben in diesem Bereich (Szenen-Koordinaten)
const GLUEH_BEREICH = { x0: -1050, x1: 1050, y0: 560, y1: 1250 };
// eigene Schlafplätze, wo ein Punkt des Bildes sichtbar nicht passt (Wurzeln, Pfeile)
const SCHLAF_KORREKTUR = { schlafplatz1: { dx: 110, dy: 40 }, schlafplatz5: { dx: -60, dy: 30 } };

export class Nacht extends Seite {
  static hg = 'wald/hg_nacht';

  aufbau() {
    // Das Licht ruht anfangs auf freiem Boden zwischen den Tieren
    this.lampe = { x: 240, y: 1010 };
    this.lampenZiel = { x: 240, y: 1010 };
    this.lampenV = { x: 0, y: 0 };  // Geschwindigkeit der Lampe (Einheiten/s)
    this.fingerTempo = 0;           // wie schnell der Finger gerade zieht (klingt ab)
    this.letzteBewegung = null;     // { x, y, t } der letzten Fingerbewegung
    this.lampenFinger = null;
    this.gesammelt = 0;           // Glühwürmchen sammeln sich (0…1)
    this.sammelBis = 0;
    this.geweckt = new Set();
    this.letzterGlockenTon = 0;

    // Berührung irgendwo: Licht dorthin, Glühwürmchen kommen (liegt ganz hinten, Tiere haben Vorrang)
    const fang = new PIXI.Container({ label: 'nachtFlaeche' });
    fang.zIndex = -100;
    this.welt.addChild(fang);
    tap(fang, (e) => this.beruehrt(e), {
      sound: null, squash: false, hitArea: new PIXI.Rectangle(-1500, 0, 3000, 1600),
    });

    this.baueSchlaefer();
    this.baueEule();
    this.baueLicht();
    this.baueGluehwuermchen();

    // leises zzz von einem schlafenden Tier
    this.every(2.6, () => { if (this.aktiv) this.zzz(); });
    // selten eine Sternschnuppe
    this.every(9, () => { if (this.aktiv && Math.random() < 0.3) this.sternschnuppe(); });
    // Eule schaut sich ab und zu um
    this.every(7, () => {
      if (!this.aktiv || this.eule.destroyed) return;
      this.eule.lookAt(this.eule.x + (this.eule.flip ? 100 : -100));
    });

    this._bewegt = (ev) => this.fingerBewegt(ev);
    this._los = (ev) => this.fingerLos(ev);
  }

  betreten() {
    window.addEventListener('pointermove', this._bewegt, { passive: true });
    window.addEventListener('pointerup', this._los, { passive: true });
    window.addEventListener('pointercancel', this._los, { passive: true });
    this.grillenStart();
    if (this.besuche === 1) voice('wald_nacht');
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

  baueSchlaefer() {
    const arten = shuffle(SCHLAEFER);
    this.schlaefer = arten.map((art, i) => {
      const name = 'schlafplatz' + (i + 1);
      const k = SCHLAF_KORREKTUR[name] || { dx: 0, dy: 0 };
      const p0 = this.punkt(name, { x: -900 + i * 450, y: 1200 });
      const p = { x: p0.x + k.dx, y: p0.y + k.dy };
      // weiter vorn (größeres y) etwas größer
      const skala = 0.3 + ((p.y - 1110) / 280) * 0.09;
      const a = new Actor(art, { x: p.x, y: p.y, scale: skala, parent: this.welt, z: p.y });
      a.pose('sleep');
      a.wach = false;
      a.ruhe = 0;          // wie lange das Licht schon auf dem Tier liegt
      a.wachZeit = 0;
      a.sperre = 0;
      a.hoehe = 760 * skala;
      a.onTap((e) => {
        this.beruehrt(e, a);
        if (!a.wach) this.wecke(a);
        else { a.sound(); fx.wobble(a, 0.04); }
      });
      return a;
    });
  }

  baueEule() {
    const ast = this.punkt('ast', { x: 235, y: 430 });
    this.eule = new Actor('eule', { x: ast.x, y: ast.y + 12, scale: 0.3, parent: this.welt, z: 50 });
    this.eule.schatten.visible = false;
    this.eule.onTap((e) => {
      this.beruehrt(e, this.eule);
      jubel(this, this.eule, { herzen: 3 });
    });
  }

  baueLicht() {
    // dunkler Schleier mit weichem Loch – folgt der Lampe
    this.schleier = new PIXI.Sprite(dunkelTextur());
    this.schleier.anchor.set(0.5);
    // Verlauf des Lochs: klar bis 7 %, halb bei ~12 %, ganz dunkel ab 18 % der halben Breite.
    // Halb dunkel genau bei LICHT_RADIUS → Breite = LICHT_RADIUS / 0.06 (≈ 5500, deckt jeden Bildschirm)
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
    this.schein.alpha = 0.32;
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
      this.glueh.push({ s, heim, g, phase: rand(0, 20), tx: rand(0.15, 0.3), ty: rand(0.12, 0.25), puls: rand(3, 5), ring: (i / GLUEH_ANZAHL) * Math.PI * 2 });
    }
  }

  // ---------------------------------------------------------------- Finger = Taschenlampe

  beruehrt(e, tier = null) {
    if (e && e.pointerId !== undefined) this.lampenFinger = e.pointerId;
    const p = tier ? { x: tier.x, y: tier.y - (tier.hoehe || 200) * 0.5 } : { x: e.x, y: e.y };
    // neues Ziel – das Licht gleitet ruhig hin (Tempo begrenzt in update), es springt nicht
    this.lampenZiel = { x: p.x, y: p.y };
    this.fingerTempo = 0;
    this.letzteBewegung = null;
    // Glühwürmchen kommen mit dem Licht (sie sammeln sich um die Lampe, nicht um das Ziel – so sausen sie nicht)
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
    const p = this.ortVon(ev);
    // Fingertempo messen: so schnell darf das Licht beim Ziehen mitkommen
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
    this.sammelBis = this.t + 2; // gleich schweben sie wieder auseinander
  }

  setzeLicht() {
    this.schleier.position.set(this.lampe.x, this.lampe.y);
    this.schein.position.set(this.lampe.x, this.lampe.y);
  }

  // ---------------------------------------------------------------- Tiere

  wecke(a) {
    if (a.wach || a.destroyed) return;
    a.wach = true;
    a.wachZeit = 0;
    a.ruhe = 0;
    a.pose('idle');            // hebt den Kopf (kurzes Stauchen wirkt wie Blinzeln)
    this.after(0.35, () => { if (!a.destroyed) a.sound(); });
    this.after(0.6, () => { if (!a.destroyed) a.nod(); });
    this.geweckt.add(a);
    if (this.geweckt.size >= this.schlaefer.length) {
      this.geweckt.clear();
      this.after(1.2, () => belohne(this, pick(['tier_eule', 'tier_igel', 'tier_fuchs']), this.eule.x, this.eule.y - 160));
    }
  }

  einschlafen(a) {
    if (a.destroyed) return;
    a.wach = false;
    a.sperre = WIEDER_SPERRE;
    a.wegErst = true; // das Licht muss erst weiterziehen, bevor es dieses Tier wieder weckt
    a.pose('sleep');
    const k = a.point('kopf');
    this.burst('zzz', k.x + 30, k.y + 50);
  }

  zzz() {
    const schlafend = this.schlaefer.filter((a) => !a.wach && !a.destroyed);
    if (!schlafend.length) return;
    const a = pick(schlafend);
    const k = a.point('kopf');
    this.burst('zzz', k.x + 40, k.y + 50);
    if (Math.random() < 0.2) sfx('common/schnarchen', { vol: 0.18 });
  }

  // ---------------------------------------------------------------- Stimmung

  grillenStart() {
    const marke = (this.grillenMarke = (this.grillenMarke || 0) + 1);
    const zirpe = () => {
      if (marke !== this.grillenMarke || !this.aktiv) return;
      sfx('common/grillen', { vol: 0.22, streu: 0 }).then((klang) => {
        // fehlt der Ton, nicht in einer engen Schleife fragen
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
    // Wunschtempo: höchstens vmax, so dass weiches Bremsen bis zum Ziel reicht, ganz nah wie früher träge
    const wunsch = d < 0.5 ? 0 : Math.min(vmax, Math.sqrt(2 * anfahren * d), d * LAMPE_NAH);
    const wx = d < 0.5 ? 0 : (dx / d) * wunsch;
    const wy = d < 0.5 ? 0 : (dy / d) * wunsch;
    // Geschwindigkeit ändert sich höchstens um anfahren·dt (kein Ruck)
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
    const tempo = this.bewegeLampe(dt, fingerDa);
    this.setzeLicht();

    // Tiere: Licht ruht auf einem schlafenden → aufwachen; wache schlafen nach einer Weile wieder ein
    for (const a of this.schlaefer) {
      if (a.destroyed) continue;
      if (a.wach) {
        a.wachZeit += dt;
        const naheLicht = Math.hypot(this.lampe.x - a.x, this.lampe.y - (a.y - a.hoehe * 0.45)) < WECK_ABSTAND;
        // solange das Licht drauf liegt und der Finger noch da ist, bleibt es etwas länger wach
        if (a.wachZeit > WACH_ZEIT + (naheLicht && fingerDa ? 2 : 0)) this.einschlafen(a);
        continue;
      }
      a.sperre = Math.max(0, a.sperre - dt);
      const d = Math.hypot(this.lampe.x - a.x, this.lampe.y - (a.y - a.hoehe * 0.45));
      if (a.wegErst && d > WECK_ABSTAND * 1.3) a.wegErst = false;
      if (d < WECK_ABSTAND && a.sperre <= 0 && !a.wegErst && tempo < RUHE_TEMPO) {
        a.ruhe += dt;
        if (a.ruhe >= WECK_ZEIT) this.wecke(a);
      } else {
        a.ruhe = 0;
      }
    }

    // Glühwürmchen: schweben langsam um ihr Zuhause oder sammeln sich gemächlich um das Licht
    const sammeln = fingerDa || t < this.sammelBis;
    this.gesammelt += ((sammeln ? 1 : 0) - this.gesammelt) * (1 - Math.exp(-dt * 1.2));
    for (const g of this.glueh) {
      g.phase += dt;
      const fx_ = g.heim.x + Math.sin(g.phase * g.tx) * 140;
      const fy = g.heim.y + Math.cos(g.phase * g.ty) * 70;
      const w = g.ring + g.phase * 0.35;
      const r = 120 + 50 * Math.sin(g.phase * 0.5 + g.ring);
      const sx = this.lampe.x + Math.cos(w) * r;
      const sy = this.lampe.y + Math.sin(w) * r * 0.7;
      const zx = fx_ + (sx - fx_) * this.gesammelt;
      const zy = fy + (sy - fy) * this.gesammelt;
      const kk = 1 - Math.exp(-dt * 1.4);
      g.s.x += (zx - g.s.x) * kk;
      g.s.y += (zy - g.s.y) * kk;
      // sanftes Glühen (Periode mehrere Sekunden – kein Blinken)
      g.s.alpha = 0.65 + 0.35 * Math.sin((g.phase / g.puls) * Math.PI * 2);
    }
  }

  hinweise() {
    const schlafend = this.schlaefer.filter((a) => !a.wach && !a.destroyed);
    return [...schlafend.slice(0, 2), this.eule];
  }
}
