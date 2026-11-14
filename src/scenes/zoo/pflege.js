// Seite 2: Tierpflege im Pflegehof. Von Runde zu Runde abwechselnd (nie zweimal dasselbe hintereinander):
//   Elefant waschen – 1. Matsch wegschrubben (Bürste), 2. einseifen (Seife), 3. abspülen (Gießkanne),
//                     4. der Elefant prustet zurück, 5. abtrocknen (Handtuch).
//   Löwe hübsch machen – 1. Blätter aus der Mähne zupfen, 2. Mähne kämmen, 3. Schmuck aussuchen (Blume, Schleife
//                     oder Krone), 4. zum Spiegel – der Löwe bewundert sich.
//   Bär ins Bett – 1. drei Bündel Stroh ins Bett im Stall tragen, 2. das Bett aufschütteln, 3. das Kissen
//                     hineinlegen, 4. der Bär legt sich hin, 5. zudecken, 6. die Spieluhr spielt ein Schlaflied.
// Jedes Werkzeug kann man greifen und über das Tier reiben – oder direkt mit dem Finger über das Tier reiben
// (das Werkzeug folgt dann dem Finger), und ein einzelner Tipp hilft auch weiter. Nichts kann schiefgehen.

import { tap, drag, sfx, voice, note, fx, Actor, spr, meta, rand, pick, clamp, killTweensOf, PIXI } from '../../engine/index.js';
import { Seite } from '../../gemeinsam/seiten.js';
import { belohne } from '../../gemeinsam/sticker.js';
import { umhängen, bogen, gleitDauer, wähleNeu, gemischt, tonEinmal, kurz, reibeFläche } from './helfer.js';

// ---------------------------------------------------------------- Maße (Seiten-Koordinaten)
const PLATZ = { x: -40, y: 1430 };                 // dort steht das Tier
const KOMMT_VON = -1600;
const WERKZEUG = { x: -760, y: 1360 };             // Werkzeugplatz links auf den Fliesen
const BETT = { x: 835, y: 1075, s: 0.72 };         // Strohbett im Stall
const SPIEGEL = { x: 560, y: 1440, s: 0.62 };
const SPIELUHR = { x: 420, y: 1380 };
const ARTEN = ['waschen', 'kaemmen', 'bett'];

const GRÖSSE = { elefant: 0.74, loewe: 0.7, baer: 0.68 };
const TIER_ZU_ART = { waschen: 'elefant', kaemmen: 'loewe', bett: 'baer' };

// Matsch-Stellen am Elefanten (im Bild der Figur, Einheiten relativ zum Anker)
const MATSCH_STELLEN = [[-290, -560], [230, -600], [-60, -660], [10, -300], [-200, -170], [200, -160], [-110, -430], [150, -420]];
// Blätter in der Mähne des Löwen
const BLATT_STELLEN = [[-250, -720], [230, -760], [-280, -470], [270, -500], [0, -860], [-150, -820], [160, -380]];
const SCHMUCK = ['zoo/blume', 'zoo/schleife', 'zoo/krone'];
const DECKEN_FARBEN = [0xffffff, 0xffe0e8, 0xe4f4dc, 0xfff0c8];
// Schlaflied (Glöckchen, ruhig)
const LIED = [72, 76, 79, 76, 74, 77, 76, 72];

export class Pflege extends Seite {
  static hg = 'zoo/hg_pflege';

  aufbau() {
    this.uhr = 0;
    this.r = null;
    this.verlauf = [];
    this.baueWerkzeug();
    this.baueStall();
    this.reib = reibeFläche(this, {
      x: PLATZ.x, y: PLATZ.y - 340, w: 720, h: 700, z: 2000,
      onReib: (x, y, d) => this.reibe(x, y, d),
      onTipp: (x, y) => this.tippAufsTier(x, y),
      onEnde: () => this.werkzeugHeim(),
    });
    this.neueRunde({ erste: true });
  }

  betreten() {
    this._hinweis?.kill();
    this._hinweis = this.after(2.4, () => this.sageHinweis());
  }

  verlassen() {
    this._hinweis?.kill();
    this._hinweis = null;
  }

  sageHinweis() {
    const r = this.r;
    if (!this.aktiv || !r?.da) return;
    const ids = { schrubben: 'zoo_schrubben', seife: 'zoo_seife', spuelen: 'zoo_spuelen', kaemmen: 'zoo_kaemmen', stroh: 'zoo_stroh' };
    const id = ids[r.schritt];
    const schritt = r.schritt;
    if (id) voice(id, { nurWenn: () => this.aktiv && this.r === r && r.schritt === schritt });
  }

  // ---------------------------------------------------------------- Werkzeug (eins zur Zeit)

  baueWerkzeug() {
    this.werkzeug = null;      // {sp, id, zug}
  }

  // Ein Werkzeug auf den Platz legen (das alte gleitet weg)
  legeWerkzeug(id, breite) {
    this.nimmWerkzeugWeg();
    const sp = spr(id, { anchor: 0.5, x: WERKZEUG.x, y: WERKZEUG.y, parent: this.welt, z: 2100 });
    const m = meta(id);
    const s = breite / Math.max(1, m.w || 400);
    sp.scale.set(s * 0.3);
    sp.alpha = 0;
    this.tween(sp, { alpha: 1 }, 0.35, { ease: 'sineInOut' });
    this.tween(sp, { scale: s }, 0.5, { ease: 'backOut' });
    note('glocke', 84, { vol: 0.18 });
    sp.hitArea = new PIXI.Circle(0, 0, 150 / s);
    const w = { sp, id, s };
    w.zug = drag(sp, {
      lift: 1.1,
      back: true,
      heim: { x: WERKZEUG.x, y: WERKZEUG.y },
      onMove: () => {
        // über dem Tier: reiben (leicht wackelnd)
        if (!this.überTier(sp.x, sp.y)) return;
        const d = Math.hypot(sp.x - (w.lx ?? sp.x), sp.y - (w.ly ?? sp.y));
        w.lx = sp.x;
        w.ly = sp.y;
        sp.rotation = Math.sin(this.uhr * 9) * 0.12;
        if (d > 2) this.reibe(sp.x, sp.y, d);
      },
      onDrop: (z, ctx) => {
        w.lx = undefined;
        w.ly = undefined;
        this.tween(sp, { rotation: 0 }, 0.3, { ease: 'sineInOut' });
        // nur getippt: ein Stück Arbeit von selbst
        if (kurz(ctx)) this.tippAufsTier(PLATZ.x, PLATZ.y - 300);
      },
    });
    this.werkzeug = w;
    this.reib.an(null);
    this.after(0.6, () => { if (this.aktiv && this.werkzeug === w) fx.pulse(sp); });
    return w;
  }

  nimmWerkzeugWeg() {
    const w = this.werkzeug;
    if (!w) return;
    this.werkzeug = null;
    w.zug?.off();
    w.sp.eventMode = 'none';
    killTweensOf(w.sp);
    this.tween(w.sp, { alpha: 0, y: w.sp.y + 40 }, 0.4, { ease: 'sineInOut' }).then(() => { if (!w.sp.destroyed) w.sp.destroy(); });
  }

  // Reibt der Finger direkt über das Tier, folgt ihm das Werkzeug; danach gleitet es heim
  werkzeugHeim() {
    const w = this.werkzeug;
    if (!w || w.sp.destroyed || w.zug?.isDragging?.()) return;
    killTweensOf(w.sp, ['x', 'y', 'rotation']);
    this.tween(w.sp, { x: WERKZEUG.x, y: WERKZEUG.y, rotation: 0 }, gleitDauer(WERKZEUG.x - w.sp.x, WERKZEUG.y - w.sp.y, 0.35), { ease: 'sineInOut' });
  }

  überTier(x, y) {
    return Math.abs(x - PLATZ.x) < 370 && y > PLATZ.y - 700 && y < PLATZ.y + 20;
  }

  // ---------------------------------------------------------------- Stall (Strohbett, Kissen, Spieluhr)

  baueStall() {
    this.bett = spr('zoo/strohbett', { x: BETT.x, y: BETT.y, parent: this.welt, z: 900 });
    this.bett.scale.set(BETT.s);
    this.bett.alpha = 0;
    this.bettStufe = 0;
    tap(this.bett, () => this.bettAngetippt(), {
      sound: null, squash: false,
      hitArea: new PIXI.Rectangle(-330, -330, 660, 380),
    });
    this.bett.eventMode = 'none';
  }

  // ---------------------------------------------------------------- Runde

  neueRunde({ erste = false } = {}) {
    let art = wähleNeu(ARTEN, this.verlauf, 1);
    if (erste) {
      const fest = testWunsch('pflege');
      if (fest && ARTEN.includes(fest)) { art = fest; this.verlauf[this.verlauf.length - 1] = fest; }
    }
    const tier = TIER_ZU_ART[art];
    const r = { art, tier, schritt: 'kommt', da: false, a: null, flecken: [], schaum: [], blätter: [], fertig: false, weg: 0 };
    this.r = r;
    this.kommt(r, erste);
  }

  async kommt(r, erste) {
    const a = new Actor(r.tier, { x: erste ? PLATZ.x : KOMMT_VON, y: PLATZ.y, scale: GRÖSSE[r.tier], parent: this.welt, z: 1400 });
    r.a = a;
    a.onTap(() => {
      const rr = this.r;
      if (rr?.a === a && rr.da && (rr.schritt === 'blätter' || rr.schritt === 'spiegel')) {
        this.tippAufsTier(a.x, a.y - 300);
        return;
      }
      fx.wobble(a, 0.04);
      a.sound();
    });
    // Ausgangslage je Art
    if (r.art === 'waschen') this.matschDrauf(r);
    if (r.art === 'kaemmen') this.blätterDrauf(r);
    if (!erste) {
      sfx('common/hupf', { vol: 0.35 });
      await a.walkTo(PLATZ.x, PLATZ.y, { tempo: 280 });
    }
    if (this.r !== r || a.destroyed) return;
    a.lookAt(PLATZ.x + 400);
    r.da = true;
    if (r.art === 'waschen') this.schritt(r, 'schrubben');
    else if (r.art === 'kaemmen') this.schritt(r, 'blätter');
    else this.schritt(r, 'stroh');
  }

  // Der nächste Schritt beginnt: passendes Werkzeug, Hinweis
  schritt(r, name) {
    if (this.r !== r) return;
    r.schritt = name;
    r.weg = 0;
    const a = r.a;
    switch (name) {
      case 'schrubben': this.legeWerkzeug('common/buerste', 340); this.reib.an(this.werkzeug.sp); a.bubble('zoo/matschfleck', 2); break;
      case 'seife': this.legeWerkzeug('zoo/seife', 190); this.reib.an(this.werkzeug.sp); break;
      case 'spuelen': this.legeWerkzeug('common/giesskanne', 330); this.reib.an(this.werkzeug.sp); break;
      case 'trocknen': this.legeWerkzeug('common/handtuch', 320); this.reib.an(this.werkzeug.sp); break;
      case 'blätter': this.nimmWerkzeugWeg(); this.reib.aus(); break;
      case 'kaemmen': this.legeWerkzeug('zoo/kamm', 340); this.reib.an(this.werkzeug.sp); break;
      case 'schmuck': this.nimmWerkzeugWeg(); this.reib.aus(); this.legeSchmuck(r); break;
      case 'spiegel': this.stelleSpiegel(r); break;
      case 'stroh': this.nimmWerkzeugWeg(); this.reib.aus(); a.bubble('zoo/strohbett', 2.4); this.legeStroh(r); break;
      default: break;
    }
    if (this.aktiv) {
      const passt = () => this.aktiv && this.r === r && r.schritt === name;
      this.after(1.0, () => { if (passt()) this.sageHinweis(); });
    }
  }

  // ---------------------------------------------------------------- Reiben

  reibe(x, y, d) {
    const r = this.r;
    if (!r?.da || r.fertig) return;
    switch (r.schritt) {
      case 'schrubben': this.schrubbe(r, x, y, d); break;
      case 'seife': this.seife(r, x, y, d); break;
      case 'spuelen': this.spüle(r, x, y, d); break;
      case 'trocknen': this.trockne(r, x, y, d); break;
      case 'kaemmen': this.kämme(r, x, y, d); break;
      default: break;
    }
  }

  // Ein einzelner Tipp auf das Tier: ein Stück Arbeit von selbst (in der Nähe des Fingers)
  tippAufsTier(x, y) {
    const r = this.r;
    if (!r?.da || r.fertig) return;
    const a = r.a;
    fx.wobble(a, 0.04);
    if (['schrubben', 'seife', 'spuelen', 'trocknen', 'kaemmen'].includes(r.schritt)) {
      // ein paar kleine Reibe-Bewegungen um die nächste Stelle
      let ziel = { x, y };
      if (r.schritt === 'schrubben') ziel = this.nächste(r.flecken.map((f) => this.stelle(f)), x, y) || ziel;
      if (r.schritt === 'spuelen') ziel = this.nächste(r.schaum.map((f) => this.stelle(f)), x, y) || ziel;
      for (let k = 0; k < 6; k++) this.reibe(ziel.x + rand(-60, 60), ziel.y + rand(-40, 40), 70);
      const w = this.werkzeug;
      if (w && !w.sp.destroyed && !w.zug?.isDragging?.()) {
        killTweensOf(w.sp, ['x', 'y']);
        w.sp.position.set(ziel.x, ziel.y);
        fx.wobble(w.sp, 0.1);
        this.after(0.35, () => this.werkzeugHeim());
      }
    } else if (r.schritt === 'blätter') {
      const b = r.blätter.find((x) => !x.weg);
      if (b) this.zupfe(r, b);
    } else if (r.schritt === 'spiegel') {
      this.zumSpiegel(r);
    } else a.sound();
  }

  // Ort eines Kindes des Tier-Bildes in Seiten-Koordinaten
  stelle(sp) {
    if (sp.destroyed) return null;
    const g = sp.getGlobalPosition();
    return this.welt.toLocal(g);
  }

  nächste(liste, x, y) {
    let best = null;
    let bd = Infinity;
    for (const p of liste) {
      if (!p) continue;
      const d = Math.hypot(p.x - x, p.y - y);
      if (d < bd) { bd = d; best = p; }
    }
    return best;
  }

  // ---------------------------------------------------------------- Elefant waschen

  matschDrauf(r) {
    const n = pick([4, 5, 5, 6]);
    for (const [lx, ly] of gemischt(MATSCH_STELLEN).slice(0, n)) {
      const f = spr('zoo/matschfleck', { anchor: 0.5, x: lx + rand(-30, 30), y: ly + rand(-30, 30), parent: r.a.sprite });
      f.scale.set(rand(0.9, 1.2));
      f.rotation = rand(-0.5, 0.5);
      f.eventMode = 'none';
      f.dreck = 1;
      r.flecken.push(f);
    }
  }

  schrubbe(r, x, y, d) {
    tonEinmal(this, 'common/schrubben', 0.5, { vol: 0.4 });
    for (const f of r.flecken) {
      if (f.destroyed || f.dreck <= 0) continue;
      const p = this.stelle(f);
      if (!p || Math.hypot(p.x - x, p.y - y) > 170) continue;
      f.dreck -= d / 380;
      f.alpha = clamp(f.dreck, 0, 1);
      if (f.dreck <= 0) {
        this.burst('staub', p.x, p.y, { count: 2 });
        this.tween(f, { alpha: 0 }, 0.3).then(() => { if (!f.destroyed) f.destroy(); });
      }
    }
    if (Math.random() < 0.05) this.burst('staub', x, y, { count: 1 });
    if (r.flecken.every((f) => f.destroyed || f.dreck <= 0)) {
      r.flecken = [];
      this.geschafft(r, () => this.schritt(r, 'seife'));
    }
  }

  seife(r, x, y, d) {
    r.weg += d;
    tonEinmal(this, 'common/schrubben', 0.5, { vol: 0.35 });
    if (r.weg < 90) return;
    r.weg = 0;
    // ein Schaum-Klecks dort, wo gerieben wird (im Bild des Elefanten, damit er mitatmet)
    const l = r.a.sprite.toLocal(this.welt.toGlobal(new PIXI.Point(x, y)));
    const s = spr('common/p_schaum', { anchor: 0.5, x: l.x, y: l.y, parent: r.a.sprite });
    s.scale.set(0.3);
    s.eventMode = 'none';
    this.tween(s.scale, { x: rand(2.0, 2.6), y: rand(1.7, 2.2) }, 0.4, { ease: 'backOut' });
    r.schaum.push(s);
    if (Math.random() < 0.4) this.burst('blasen', x, y - 20, { count: 1 });
    if (r.schaum.length >= 8) this.geschafft(r, () => this.schritt(r, 'spuelen'));
  }

  spüle(r, x, y, d) {
    // Tropfen aus der Gießkanne (ruhig, wenige)
    if (this.uhr > (r.tropfenBis || 0)) {
      r.tropfenBis = this.uhr + 0.25;
      this.burst('tropfen', x + 20, y - 40, { count: 1 });
    }
    tonEinmal(this, 'common/giessen', 0.9, { vol: 0.3 });
    for (const s of r.schaum) {
      if (s.destroyed || s.weg) continue;
      const p = this.stelle(s);
      if (!p || Math.hypot(p.x - x, p.y - y) > 180) continue;
      s.nass = (s.nass || 0) + d / 260;
      if (s.nass >= 1) {
        s.weg = true;
        this.tween(s, { alpha: 0, y: s.y + 60 }, 0.5, { ease: 'sineInOut' }).then(() => { if (!s.destroyed) s.destroy(); });
      }
    }
    if (r.schaum.every((s) => s.weg || s.destroyed)) {
      r.schaum = [];
      this.geschafft(r, () => this.prusten(r));
    }
  }

  // Der Elefant prustet fröhlich eine kleine Fontäne zurück
  async prusten(r) {
    r.schritt = 'prusten';
    this.nimmWerkzeugWeg();
    this.reib.aus();
    const a = r.a;
    await this.wait(0.4);
    if (this.r !== r || a.destroyed) return;
    a.pose('happy');
    a.sound();
    const m = a.point('mouth');
    sfx('common/spritz', { vol: 0.45 });
    this.burst('tropfen', m.x + 20, m.y - 160, { count: 9 });
    this.after(0.6, () => this.burst('tropfen', m.x + 80, m.y - 200, { count: 6 }));
    await this.wait(1.6);
    if (this.r !== r || a.destroyed) return;
    a.pose('idle');
    this.schritt(r, 'trocknen');
  }

  trockne(r, x, y, d) {
    r.weg += d;
    tonEinmal(this, 'common/wisch', 0.5, { vol: 0.35 });
    if (Math.random() < 0.04) this.burst('funkeln', x, y, { count: 1 });
    if (r.weg >= 1100) this.fertig(r);
  }

  // ---------------------------------------------------------------- Löwe hübsch machen

  blätterDrauf(r) {
    const n = pick([3, 4, 4, 5]);
    const bild = pick(['common/p_blatt', 'common/p_blatt_herbst']);
    for (const [lx, ly] of gemischt(BLATT_STELLEN).slice(0, n)) {
      const b = spr(Math.random() < 0.7 ? bild : 'common/p_blatt', { anchor: 0.5, x: lx, y: ly, parent: r.a.sprite });
      b.scale.set(rand(0.95, 1.15));
      b.rotation = rand(-0.8, 0.8);
      // Tippfläche gut 240 Einheiten (Blätter sind klein)
      const s = b.scale.x * GRÖSSE.loewe;
      b.hitArea = new PIXI.Circle(0, 0, 125 / s);
      const eintrag = { sp: b, weg: false };
      tap(b, () => this.zupfe(r, eintrag), { sound: null, squash: false });
      r.blätter.push(eintrag);
    }
  }

  async zupfe(r, b) {
    if (b.weg || r.schritt !== 'blätter') return;
    b.weg = true;
    const sp = b.sp;
    sp.eventMode = 'none';
    sfx('common/rupf', { vol: 0.45 });
    umhängen(sp, this.welt);
    sp.zIndex = 2050;
    sp.scale.set(Math.abs(r.a.scale.x) * sp.scale.x);
    const zielX = sp.x + rand(-160, 160);
    this.tween(sp, { rotation: sp.rotation + rand(2, 4) }, 1.1, { ease: 'sineInOut' });
    await this.tween(sp, { x: zielX, y: PLATZ.y + 20 }, 1.1, { ease: 'sineInOut' });
    await this.tween(sp, { alpha: 0 }, 0.4);
    if (!sp.destroyed) sp.destroy();
    if (this.r !== r) return;
    if (r.blätter.every((x) => x.weg) && r.schritt === 'blätter') {
      r.schritt = 'zwischen';
      this.geschafft(r, () => this.schritt(r, 'kaemmen'));
    }
  }

  kämme(r, x, y, d) {
    r.weg += d;
    tonEinmal(this, 'common/wisch', 0.45, { vol: 0.35 });
    // die Mähne wird flauschig: alle 300 Einheiten ein kleiner Ruck und ein Funkeln
    if (Math.floor(r.weg / 300) > Math.floor((r.weg - d) / 300)) {
      fx.pop(r.a, 0.04);
      this.burst('funkeln', x, y, { count: 1 });
    }
    if (r.weg >= 1200) {
      r.schritt = 'zwischen';
      r.a.sound();
      this.geschafft(r, () => this.schritt(r, 'schmuck'));
    }
  }

  legeSchmuck(r) {
    r.schmuck = [];
    gemischt(SCHMUCK).forEach((id, i) => {
      const x = WERKZEUG.x - 150 + i * 200;
      const y = WERKZEUG.y + (i === 1 ? -40 : 0);
      const sp = spr(id, { anchor: 0.5, x, y, parent: this.welt, z: 2100 });
      const s = 150 / Math.max(meta(id).w || 200, meta(id).h || 200);
      // nur sanft einblenden (die Größe steht sofort – so ist die Tippfläche gleich voll da)
      sp.scale.set(s);
      sp.alpha = 0;
      this.tween(sp, { alpha: 1 }, 0.5, { ease: 'sineInOut', delay: i * 0.2 });
      sp.hitArea = new PIXI.Circle(0, 0, 105 / s);
      const e = { sp, id, s, heim: { x, y } };
      e.zug = drag(sp, {
        lift: 1.12,
        back: true,
        heim: { x, y },
        targets: () => [{ id: 'kopf', ...this.kopf(r), radius: 330 }],
        onDrop: (z, ctx) => { if (z || kurz(ctx)) this.schmücke(r, e); },
      });
      r.schmuck.push(e);
    });
    r.a.bubble(pick(SCHMUCK), 2.2);
  }

  kopf(r) {
    const p = r.a.point('kopf');
    return { x: p.x, y: p.y + 40 };
  }

  async schmücke(r, e) {
    if (r.schritt !== 'schmuck') return;
    r.schritt = 'zwischen';
    for (const o of r.schmuck) {
      o.zug?.off();
      o.sp.eventMode = 'none';
      if (o !== e) this.tween(o.sp, { alpha: 0 }, 0.4, { ease: 'sineInOut' }).then(() => { if (!o.sp.destroyed) o.sp.destroy(); });
    }
    const sp = e.sp;
    killTweensOf(sp);
    const k = this.kopf(r);
    // auf die Mähne, ein bisschen schräg
    const ziel = { x: k.x + 70, y: k.y + 30 };
    await bogen(this, sp, ziel.x, ziel.y, { dauer: 0.6, höhe: 120, dreh: 0.25 - sp.rotation });
    if (sp.destroyed || this.r !== r) return;
    umhängen(sp, r.a.sprite);
    sp.scale.set(e.s / GRÖSSE.loewe * 1.05);
    sfx('common/funkeln', { vol: 0.4 });
    this.burst('funkeln', ziel.x, ziel.y, { count: 3 });
    r.a.nod();
    await this.wait(0.8);
    if (this.r !== r) return;
    this.schritt(r, 'spiegel');
  }

  stelleSpiegel(r) {
    const sp = spr('zoo/spiegel', { x: SPIEGEL.x, y: SPIEGEL.y, parent: this.welt, z: 1350 });
    sp.scale.set(SPIEGEL.s * 0.4);
    sp.alpha = 0;
    this.tween(sp, { alpha: 1 }, 0.4, { ease: 'sineInOut' });
    this.tween(sp, { scale: SPIEGEL.s }, 0.6, { ease: 'backOut' });
    sfx('common/plopp', { vol: 0.4 });
    r.spiegel = sp;
    tap(sp, () => this.zumSpiegel(r), { sound: null, squash: false, hitArea: new PIXI.Rectangle(-260, -620, 520, 640) });
    this.after(0.8, () => { if (this.aktiv && r.schritt === 'spiegel') fx.pulse(sp); });
  }

  async zumSpiegel(r) {
    if (r.schritt !== 'spiegel') return;
    r.schritt = 'zwischen';
    const a = r.a;
    await a.walkTo(SPIEGEL.x - 300, PLATZ.y, { tempo: 240 });
    if (this.r !== r || a.destroyed) return;
    a.lookAt(SPIEGEL.x + 100);
    sfx('common/funkeln', { vol: 0.4 });
    this.burst('funkeln', SPIEGEL.x, SPIEGEL.y - 260, { count: 3 });
    await this.wait(0.6);
    if (this.r !== r) return;
    this.fertig(r);
  }

  // ---------------------------------------------------------------- Bär ins Bett

  legeStroh(r) {
    r.stroh = [];
    for (let i = 0; i < 3; i++) {
      const x = WERKZEUG.x - 210 + i * 210;
      const y = WERKZEUG.y + (i === 1 ? -60 : 10);
      const sp = spr('common/futter_heu', { anchor: 0.5, x, y, parent: this.welt, z: 2100 + i });
      const s = 250 / (meta('common/futter_heu').w || 420);
      sp.scale.set(s);
      sp.alpha = 0;
      sp.rotation = rand(-0.15, 0.15);
      this.tween(sp, { alpha: 1 }, 0.5, { ease: 'sineInOut', delay: i * 0.2 });
      sp.hitArea = new PIXI.Circle(0, 0, 125 / s);
      const e = { sp, s, heim: { x, y }, drin: false };
      e.zug = drag(sp, {
        lift: 1.1,
        back: true,
        heim: { x, y },
        targets: () => [{ id: 'bett', x: BETT.x, y: BETT.y - 100, radius: 380 }],
        onDrop: (z, ctx) => { if (z || kurz(ctx)) this.strohInsBett(r, e); },
      });
      r.stroh.push(e);
    }
  }

  async strohInsBett(r, e) {
    if (e.drin || r.schritt !== 'stroh') return;
    e.drin = true;
    e.zug?.off();
    e.sp.eventMode = 'none';
    killTweensOf(e.sp);
    await bogen(this, e.sp, BETT.x + rand(-80, 80), BETT.y - 80, { dauer: 0.6, höhe: 160 });
    if (e.sp.destroyed || this.r !== r) return;
    sfx('common/rascheln', { vol: 0.5 });
    this.burst('staub', BETT.x, BETT.y - 60, { count: 3 });
    this.tween(e.sp, { alpha: 0, scale: e.s * 0.6 }, 0.35).then(() => { if (!e.sp.destroyed) e.sp.destroy(); });
    // das Bett wächst
    this.bettStufe++;
    const k = this.bettStufe / 3;
    killTweensOf(this.bett);
    this.tween(this.bett, { alpha: Math.min(1, 0.45 + k * 0.55) }, 0.4, { ease: 'sineInOut' });
    this.bett.scale.set(BETT.s * (0.55 + 0.45 * k), BETT.s * (0.35 + 0.65 * k));
    fx.pop(this.bett, 0.06);
    if (r.stroh.every((x) => x.drin)) {
      this.geschafft(r, () => {
        r.schritt = 'schütteln';
        r.schüttler = 0;
        this.bett.eventMode = 'static';
        if (this.aktiv) fx.pulse(this.bett);
      });
    }
  }

  bettAngetippt() {
    const r = this.r;
    fx.wobble(this.bett, 0.05);
    sfx('common/rascheln', { vol: 0.4 });
    if (!r) return;
    if (r.schritt === 'schütteln') {
      r.schüttler++;
      this.burst('staub', BETT.x + rand(-120, 120), BETT.y - 60, { count: 2 });
      fx.pop(this.bett, 0.08);
      if (r.schüttler >= 3) {
        r.schritt = 'zwischen';
        this.geschafft(r, () => this.legeKissen(r));
      }
    } else if (r.schritt === 'kissen' && r.kissen) this.kissenRein(r);
    else if (r.schritt === 'zudecken' && r.decke) this.zudecken(r);
  }

  legeKissen(r) {
    r.schritt = 'kissen';
    const sp = spr('zoo/kissen', { anchor: 0.5, x: WERKZEUG.x, y: WERKZEUG.y, parent: this.welt, z: 2100 });
    const s = 250 / (meta('zoo/kissen').w || 260);
    sp.scale.set(s * 0.3);
    this.tween(sp, { scale: s }, 0.5, { ease: 'backOut' });
    note('glocke', 84, { vol: 0.18 });
    sp.hitArea = new PIXI.Circle(0, 0, 125 / s);
    r.kissen = { sp, s };
    r.kissen.zug = drag(sp, {
      lift: 1.1, back: true, heim: { x: WERKZEUG.x, y: WERKZEUG.y },
      targets: () => [{ id: 'bett', x: BETT.x, y: BETT.y - 100, radius: 380 }],
      onDrop: (z, ctx) => { if (z || kurz(ctx)) this.kissenRein(r); },
    });
    this.after(0.6, () => { if (this.aktiv && r.schritt === 'kissen') fx.pulse(sp); });
  }

  async kissenRein(r) {
    if (r.schritt !== 'kissen') return;
    r.schritt = 'zwischen';
    const k = r.kissen;
    k.zug?.off();
    k.sp.eventMode = 'none';
    killTweensOf(k.sp);
    await bogen(this, k.sp, BETT.x + 150, BETT.y - 120, { dauer: 0.6, höhe: 150, skala: k.s * 0.9 });
    if (this.r !== r) return;
    k.sp.zIndex = 901;   // unter dem Kopf des Bären
    sfx('common/plopp', { vol: 0.45 });
    // der Bär gähnt, tapst in den Stall und legt sich hin
    const a = r.a;
    a.bubble('common/p_zzz', 1.4);
    await this.wait(0.9);
    if (this.r !== r || a.destroyed) return;
    a.zIndex = 902;
    this.tween(a.scale, { x: 0.42, y: 0.42 }, 1.6, { ease: 'sineInOut' });
    await a.walkTo(BETT.x - 20, BETT.y - 30, { tempo: 260 });
    if (this.r !== r || a.destroyed) return;
    a.lookAt(BETT.x + 200);
    a.pose('sleep');
    sfx('common/rascheln', { vol: 0.4 });
    await this.wait(0.6);
    if (this.r !== r) return;
    this.legeDecke(r);
  }

  legeDecke(r) {
    r.schritt = 'zudecken';
    const sp = spr('zoo/decke', { anchor: 0.5, x: WERKZEUG.x, y: WERKZEUG.y - 20, parent: this.welt, z: 2100 });
    const s = 330 / (meta('zoo/decke').w || 500);
    sp.scale.set(s * 0.3);
    sp.tint = pick(DECKEN_FARBEN);
    this.tween(sp, { scale: s }, 0.5, { ease: 'backOut' });
    note('glocke', 86, { vol: 0.18 });
    sp.hitArea = new PIXI.Rectangle(-170 / s, -140 / s, 340 / s, 280 / s);
    r.decke = { sp, s };
    r.decke.zug = drag(sp, {
      lift: 1.08, back: true, heim: { x: WERKZEUG.x, y: WERKZEUG.y - 20 },
      targets: () => [{ id: 'baer', x: r.a.x, y: r.a.y - 120, radius: 380 }],
      onDrop: (z, ctx) => { if (z || kurz(ctx)) this.zudecken(r); },
    });
    this.after(0.6, () => { if (this.aktiv && r.schritt === 'zudecken') fx.pulse(sp); });
  }

  async zudecken(r) {
    if (r.schritt !== 'zudecken') return;
    r.schritt = 'zwischen';
    const d = r.decke;
    d.zug?.off();
    d.sp.eventMode = 'none';
    killTweensOf(d.sp);
    const a = r.a;
    // die Decke legt sich über den Bauch des Bären
    await bogen(this, d.sp, a.x + 30, a.y - 70, { dauer: 0.7, höhe: 160 });
    if (this.r !== r) return;
    d.sp.zIndex = 903;
    this.tween(d.sp.scale, { x: d.s * 1.15, y: d.s * 0.62 }, 0.4, { ease: 'sineInOut' });
    sfx('common/rascheln', { vol: 0.4 });
    await this.wait(0.6);
    if (this.r !== r) return;
    this.zeigeSpieluhr(r);
  }

  zeigeSpieluhr(r) {
    r.schritt = 'spieluhr';
    const sp = spr('zoo/spieluhr', { anchor: 0.5, x: SPIELUHR.x, y: SPIELUHR.y, parent: this.welt, z: 1300 });
    const s = 210 / (meta('zoo/spieluhr').w || 260);
    sp.scale.set(s * 0.3);
    this.tween(sp, { scale: s }, 0.5, { ease: 'backOut' });
    sp.hitArea = new PIXI.Circle(0, 0, 135 / s);
    r.uhr = { sp, s };
    tap(sp, () => this.spielLied(r), { sound: null, squash: true });
    this.after(0.7, () => { if (this.aktiv && r.schritt === 'spieluhr') fx.pulse(sp); });
  }

  async spielLied(r) {
    const sp = r.uhr?.sp;
    if (r.schritt !== 'spieluhr') {
      if (sp) note('glocke', pick(LIED), { vol: 0.2 });
      return;
    }
    r.schritt = 'lied';
    const a = r.a;
    for (let i = 0; i < LIED.length; i++) {
      this.after(i * 0.5, () => {
        if (this.r !== r) return;
        note('glocke', LIED[i], { vol: 0.28 });
        if (sp && !sp.destroyed) {
          this.tween(sp, { rotation: i % 2 ? -0.06 : 0.06 }, 0.25, { ease: 'sineInOut' });
          if (i % 2 === 0) this.burst('noten', sp.x, sp.y - 80, { count: 1 });
        }
      });
    }
    this.after(1.2, () => { if (this.r === r && !a.destroyed) this.burst('zzz', a.x + 80, a.y - 220, { count: 2 }); });
    this.after(3.0, () => { if (this.r === r && !a.destroyed) this.burst('zzz', a.x + 80, a.y - 220, { count: 2 }); });
    await this.wait(LIED.length * 0.5 + 0.6);
    if (this.r !== r) return;
    if (sp && !sp.destroyed) this.tween(sp, { rotation: 0 }, 0.3);
    sfx('common/schnarchen', { vol: 0.35 });
    await this.wait(1.2);
    if (this.r !== r) return;
    this.fertig(r);
  }

  // ---------------------------------------------------------------- Zwischenschritte, Ende

  // Kleiner Lob-Moment zwischen zwei Schritten, dann weiter
  geschafft(r, weiter) {
    if (r.zwischen) return;
    r.zwischen = true;
    const vorher = r.schritt;
    r.schritt = 'zwischen';
    sfx('common/funkeln', { vol: 0.35 });
    const a = r.a;
    if (!a.destroyed) {
      const k = a.point('kopf');
      this.burst('sterne', k.x, k.y + 40, { count: 3 });
      a.nod();
    }
    this.after(0.9, () => {
      r.zwischen = false;
      if (this.r !== r) return;
      if (r.schritt === 'zwischen' || r.schritt === vorher) weiter();
    });
  }

  async fertig(r) {
    if (r.fertig) return;
    r.fertig = true;
    r.schritt = 'fertig';
    this.nimmWerkzeugWeg();
    this.reib.aus();
    const a = r.a;
    if (r.art === 'bett') {
      // erst schläft er ein bisschen, dann wacht er ausgeschlafen auf
      await belohne(this, 'zoo_kamm', -200, 700);
      await this.wait(1.5);
      if (this.r !== r || a.destroyed) return;
      a.pose('idle');
      a.sound();
      await this.wait(0.5);
      if (r.decke?.sp && !r.decke.sp.destroyed) this.tween(r.decke.sp, { alpha: 0 }, 0.5);
      await a.cheer({ parent: this.vorn });
    } else {
      await a.cheer({ parent: this.vorn });
      await this.wait(0.3);
      await belohne(this, 'zoo_kamm', -200, 700);
    }
    await this.wait(1.0);
    if (this.r !== r || a.destroyed) return;
    a.bubble('common/p_herz', 1.2);
    await this.wait(1.2);
    if (this.r !== r || a.destroyed) return;
    // aufräumen: Spiegel, Bett, Kissen, Spieluhr blenden aus; das Tier geht
    const weg = (sp) => { if (sp && !sp.destroyed) this.tween(sp, { alpha: 0 }, 0.6).then(() => { if (!sp.destroyed) sp.destroy(); }); };
    weg(r.spiegel);
    weg(r.kissen?.sp);
    weg(r.uhr?.sp);
    weg(r.decke?.sp);
    if (r.art === 'bett') {
      this.tween(this.bett, { alpha: 0 }, 1.0, { ease: 'sineInOut', delay: 1.2 });
      this.bettStufe = 0;
      this.bett.eventMode = 'none';
      this.tween(a.scale, { x: GRÖSSE.baer, y: GRÖSSE.baer }, 1.2, { ease: 'sineInOut' });
    }
    a.zIndex = 1400;
    await a.walkTo(1600, PLATZ.y, { tempo: 300 });
    if (!a.destroyed) a.destroy({ children: true });
    await this.wait(0.5);
    if (this.r !== r) return;
    this.neueRunde();
  }

  // ---------------------------------------------------------------- Ablauf, Hand

  update(dt) {
    this.uhr += dt;
  }

  hinweise() {
    const r = this.r;
    if (!r?.da) return [];
    const mitte = { x: PLATZ.x, y: PLATZ.y - 300 };
    const w = this.werkzeug;
    switch (r.schritt) {
      case 'schrubben': {
        const f = this.nächste(r.flecken.filter((x) => !x.destroyed && x.dreck > 0).map((x) => this.stelle(x)), mitte.x, mitte.y);
        return w ? [{ von: w.sp, nach: f || mitte }] : [];
      }
      case 'seife': case 'trocknen': case 'kaemmen':
        return w ? [{ von: w.sp, nach: r.schritt === 'kaemmen' ? this.kopf(r) : mitte }] : [];
      case 'spuelen': {
        const s = this.nächste(r.schaum.filter((x) => !x.destroyed && !x.weg).map((x) => this.stelle(x)), mitte.x, mitte.y);
        return w ? [{ von: w.sp, nach: s || mitte }] : [];
      }
      case 'blätter': {
        const b = r.blätter.find((x) => !x.weg && !x.sp.destroyed);
        return b ? [b.sp] : [];
      }
      case 'schmuck': {
        const e = r.schmuck?.find((x) => !x.sp.destroyed);
        return e ? [{ von: e.sp, nach: this.kopf(r) }] : [];
      }
      case 'spiegel': return r.spiegel ? [r.spiegel] : [];
      case 'stroh': {
        const e = r.stroh?.find((x) => !x.drin && !x.sp.destroyed);
        return e ? [{ von: e.sp, nach: { x: BETT.x, y: BETT.y - 100 } }] : [];
      }
      case 'schütteln': return [this.bett];
      case 'kissen': return r.kissen ? [{ von: r.kissen.sp, nach: { x: BETT.x, y: BETT.y - 100 } }] : [];
      case 'zudecken': return r.decke ? [{ von: r.decke.sp, nach: { x: r.a.x, y: r.a.y - 100 } }] : [];
      case 'spieluhr': return r.uhr ? [r.uhr.sp] : [];
      // dazwischen: auf das Tier – sonst zeigte die Hand auf den Blätter-Pfeil
      default: return r.a && !r.a.destroyed ? [r.a] : [];
    }
  }
}

// Testhilfe: Wert aus der Adresse (nur mit test=1), sonst null
function testWunsch(name) {
  try {
    const q = new URLSearchParams(location.search);
    return q.get('test') === '1' ? q.get(name) : null;
  } catch { return null; }
}
