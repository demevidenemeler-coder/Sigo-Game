// Teich, Seite 1: Am Teich (hg_teich)
// - Fünf Seerosenblätter (zwei mit Blüte) an blatt1…blatt5; der Frosch sitzt auf einem. Tipp auf ein anderes
//   Blatt → der Frosch springt im Bogen hin (Blatt wippt, Wellenring, leises Platschen). Tipp auf den Frosch → quakt.
// - Zwei Entenfamilien ziehen langsam übers hintere Wasser (hinter den Seerosen), jede in ihrer Teichhälfte –
//   so verknäueln sie sich nie. Am Ufer liegt Brot: Krümel herausziehen und aufs Wasser oder auf eine Ente
//   legen – oder das Brot antippen (ein Krümel fliegt zu einer Ente). Krümel, die vorn landen, treiben sanft
//   nach hinten zu den Enten; die Ente der Teichhälfte schwimmt hin und frisst.
// - Tipp aufs Wasser → Wellenring; Libelle (schwebt oder sitzt still auf einem Blatt), Papierboot (antippen →
//   treibt weiter), Schilf wiegt sich, Schmetterling (sitzt meist still), Vogel (selten), Wolken.
// - Sticker: alle 4 gefütterten Krümel einer (tier_ente, dann teich_seerose), alle 6 vom Kind ausgelösten
//   Froschsprünge tier_frosch. Der Sticker erscheint frei im Himmel.
// - Haupttätigkeit (nest.js): Die linke Entenmama baut am Grasufer ein Nest, brütet Eier aus und bringt die Küken
//   heim – die Familien wachsen von Runde zu Runde (gespeichert in 'teich.kueken').
// - Ab und zu ein Gast (gast.js): Schwan oder Schildkröte möchte Krümel; jeder verabschiedet sich anders.

import { Actor, spr, tap, drag, fx, sfx, voice, note, store, killTweensOf, rand, pick, clamp, PIXI } from '../../engine/index.js';
import { Seite } from '../../gemeinsam/seiten.js';
import { belohne } from '../../gemeinsam/sticker.js';
import { ton, laut, freue, naechsterSticker, flugDauer, Ringe, Vogel, Schmetterling, Wolken } from './deko.js';
import { NestAblauf } from './nest.js';
import { Gast } from './gast.js';

const WASSER_OBEN = 615;                 // hinteres Ufer (Szenen-y)
const STICKER_ORT = { x: 0, y: 400 };   // dort erscheint ein neuer Sticker (freier Himmel über den Hügeln)
// Enten bleiben hinter den Seerosen (y-Band) und jede Familie in ihrer Hälfte (Revier)
const ENTE_Y = [705, 900];
const REVIER = [[-940, -170], [170, 830]];   // rechts Platz für den Blätter-Pfeil
const KRUEMEL_RAND = 110;                // Krümel liegen so weit innerhalb des Reviers (Ente schwimmt von der Seite an)
const HOLT_MAX = 6;                      // Rettung: so lange höchstens „holt" eine Ente, dann frisst sie trotzdem
// Wasser als Vieleck (Szenen-Koordinaten); links unten liegt das Grasufer
// (rechts unten bleibt eine Ecke von 240×240 frei: x > 1040, y > 1360 am Tablet)
const WASSER = [-1420, WASSER_OBEN, 1420, WASSER_OBEN, 1420, 1350, 1030, 1350, 1030, 1530, -470, 1530, -640, 1420,
  -760, 1362, -1000, 1292, -1150, 1252, -1250, 1112, -1420, 1092];
const UFER = [-1420, 1092, -1250, 1112, -1150, 1252, -1000, 1292, -760, 1362, -640, 1420, -470, 1530, -1420, 1530];
const WASSER_POLY = new PIXI.Polygon(WASSER);

const FROSCH_ANTEIL = 0.44;            // Frosch-Größe im Verhältnis zum Blatt
const KRUEMEL_MAX = 5;
const KRUEMEL_RUNDE = 4;                 // so viele Krümel = eine Runde (Sticker)
const SPRUENGE_RUNDE = 6;

// Größe nach Tiefe (weiter hinten = kleiner)
const tiefe = (y) => 0.34 + (y - 700) * 0.00042;

export class AmTeich extends Seite {
  static hg = 'teich/hg_teich';

  aufbau() {
    this.gefuettert = 0;
    this.spruenge = 0;
    this.kruemel = [];          // Krümel auf dem Wasser: {s, x, y, ente, t}
    this.ringe = new Ringe(this, this.welt, { n: 10, z: 4 });

    this.baueWasser();
    this.baueBlaetter();
    this.baueFrosch();
    this.baueEnten();
    this.baueBrot();
    this.baueDeko();
    this.nest = new NestAblauf(this, WASSER_POLY);
    this.gast = new Gast(this);

    // Ab und zu hüpft der Frosch von selbst (zeigt, was geht) – nur wenn gerade niemand spielt
    // (zählt nicht für den Frosch-Sticker – den verdient nur das Kind)
    this.every(17, () => {
      if (!this.aktiv || this.szene.idle < 9 || this.springt) return;
      const andere = this.blaetter.map((_, i) => i).filter((i) => i !== this.froschBlatt);
      this.springe(pick(andere), { auto: true });
    });
  }

  betreten() {
    if (this.besuche === 1) voice('teich_hallo');
    // Die beiden Hinweise bei jedem Betreten anbieten (der Kern sagt jeden höchstens einmal am Tag) – aber nur,
    // solange die Seite zu sehen ist und das Kind das Betreffende auf dieser Seite noch nicht selbst tut.
    // nurWenn wird auch gefragt, wenn ein Satz erst nach einem anderen an die Reihe kommt.
    this.froschHier = false;
    this.brotHier = false;
    for (const h of this._hinweise || []) h.kill();
    const frosch = () => this.aktiv && !this.froschHier && !this.springt;
    const enten = () => this.aktiv && !this.brotHier;
    const erst = this.besuche === 1;
    this._hinweise = [
      this.after(erst ? 5 : 2.5, () => { if (frosch()) voice('teich_frosch', { nurWenn: frosch }); }),
      this.after(erst ? 14 : 11, () => { if (enten()) voice('teich_enten', { nurWenn: enten }); }),
    ];
  }

  verlassen() {
    for (const h of this._hinweise || []) h.kill();
    this._hinweise = null;
  }

  // ---------------------------------------------------------------- Wasser und Ufer

  baueWasser() {
    const wasser = new PIXI.Container({ label: 'wasser' });
    wasser.zIndex = -100;
    this.welt.addChild(wasser);
    tap(wasser, (e) => {
      this.ringe.ring(e.x, e.y, 200 + tiefe(e.y) * 260);
      ton('common/platsch', { vol: 0.3, rate: rand(0.95, 1.1) }, 0.4);
    }, { sound: null, squash: false, hitArea: WASSER_POLY });

    const ufer = new PIXI.Container({ label: 'ufer' });
    ufer.zIndex = -100;
    this.welt.addChild(ufer);
    tap(ufer, (e) => {
      this.burst('blaetter', e.x, e.y - 20, { count: 3 });
      ton('common/rascheln', { vol: 0.45 }, 0.5);
    }, { sound: null, squash: false, hitArea: new PIXI.Polygon(UFER) });
  }

  // ---------------------------------------------------------------- Seerosenblätter

  baueBlaetter() {
    const mitBluete = [1, 3];
    this.blaetter = ['blatt1', 'blatt2', 'blatt3', 'blatt4', 'blatt5'].map((name, i) => {
      const p = this.punkt(name);
      const c = new PIXI.Container({ label: 'seerose:' + name });
      const s = tiefe(p.y) * 1.3;
      const blatt = spr('teich/seerosenblatt', { parent: c, anchor: 0.5 });
      blatt.scale.set(s);
      blatt.rotation = rand(-0.08, 0.08);
      if (mitBluete.includes(i)) {
        const b = spr('teich/seerose_bluete', { parent: c, anchor: 0.5, x: -110 * s, y: -38 * s });
        b.scale.set(s * 0.85);
        b.label = 'bluete';
        c.bluete = b;
      }
      c.position.set(p.x, p.y);
      c.zIndex = p.y - 60;
      c.basis = { x: p.x, y: p.y };
      c.skala = s;
      c.dip = { y: 0 };
      c.phase = rand(0, Math.PI * 2);
      this.welt.addChild(c);
      tap(c, () => this.blattGetippt(i), {
        sound: null, squash: false,
        hitArea: new PIXI.Ellipse(0, 0, 230 * s + 30, 150 * s + 40),
      });
      return c;
    });
  }

  blattGetippt(i) {
    this.froschHier = true;
    const c = this.blaetter[i];
    this.wippe(c);
    if (c.bluete) fx.wobble(c.bluete, 0.1);
    // Während des Sprungs: Wunsch merken, der Frosch springt nach der Landung gleich dorthin weiter
    if (this.springt) { this.wunschBlatt = i; return; }
    if (i === this.froschBlatt) this.froschGetippt();
    else this.springe(i);
  }

  wippe(c, tief = 14) {
    killTweensOf(c.dip);
    this.tween(c.dip, { y: tief }, 0.14, { ease: 'quadOut' })
      .then((ok) => { if (ok) this.tween(c.dip, { y: 0 }, 0.7, { ease: 'elasticOut' }); });
  }

  // ---------------------------------------------------------------- Frosch

  baueFrosch() {
    this.froschBlatt = 2;
    const b = this.blaetter[this.froschBlatt];
    this.frosch = new Actor('frosch', {
      x: this.sitzX(b), y: this.sitzY(b), scale: b.skala * FROSCH_ANTEIL, parent: this.welt,
    });
    this.frosch.zIndex = b.zIndex + 10;
    this.frosch.onTap(() => this.froschGetippt(), { pad: 50 });
    this.springt = false;
    this.wunschBlatt = -1;
  }

  // Auf einem Blatt mit Blüte sitzt der Frosch etwas rechts davon (verdeckt die Blüte nicht)
  sitzX(b) {
    return b.basis.x + (b.bluete ? 45 * b.skala : 0);
  }

  sitzY(b) {
    return b.y + b.dip.y + 30 * b.skala;
  }

  froschGetippt() {
    this.froschHier = true;
    if (this.springt) { laut('frosch'); return; }
    freue(this, this.frosch);
    const b = this.blaetter[this.froschBlatt];
    this.wippe(b, 10);
  }

  async springe(i, { auto = false } = {}) {
    if (this.springt) return;
    const f = this.frosch;
    const ziel = this.blaetter[i];
    this.springt = true;
    this.wunschBlatt = -1;
    if (this.libelle.blatt === i) this.libelleWeiter();   // sitzt die Libelle dort, fliegt sie auf
    const vorher = this.blaetter[this.froschBlatt];
    this.froschBlatt = -1;
    this.wippe(vorher, 8);
    f.zIndex = 2500;
    ton('common/hupf', { vol: 0.5 });
    const groesse = ziel.skala * FROSCH_ANTEIL;
    // weite Sprünge dauern länger (Ruhe-Regel: nichts rast quer übers Bild)
    const dauer = flugDauer(this.sitzX(ziel) - f.x, this.sitzY(ziel) - f.y, { hoehe: 230, ease: 'sine', min: 0.75, v: 1050 });
    this.tween(f, { scale: groesse }, dauer, { ease: 'sineInOut' });
    const ok = await f.hopTo(this.sitzX(ziel), this.sitzY(ziel), { hoehe: 230, dauer, staub: false });
    this.springt = false;
    this.froschBlatt = i;
    f.zIndex = ziel.zIndex + 10;
    if (!ok && !f.destroyed) f.position.set(this.sitzX(ziel), this.sitzY(ziel));
    // Landung: Blatt wippt, Wellenring, leises Platschen
    this.wippe(ziel, 16);
    this.ringe.ring(ziel.x, ziel.y + 20, 420 * ziel.skala, { z: ziel.zIndex - 1 });
    ton('common/platsch', { vol: 0.35 }, 0.3);
    if (!auto) this.spruenge++;
    const wunsch = this.wunschBlatt;
    this.wunschBlatt = -1;
    if (wunsch >= 0 && wunsch !== i) {
      // das Kind hat während des Sprungs schon das nächste Blatt angetippt
      this.after(0.25, () => { if (!this.springt && this.froschBlatt !== wunsch) this.springe(wunsch); });
    } else if (!auto && this.spruenge % SPRUENGE_RUNDE === 0) {
      this.after(0.4, () => {
        freue(this, f);
        belohne(this, 'tier_frosch', STICKER_ORT.x, STICKER_ORT.y);
      });
    } else if (Math.random() < 0.35) {
      this.after(0.35, () => laut('frosch'));
    }
  }

  // ---------------------------------------------------------------- Enten

  baueEnten() {
    // Die Familien wachsen mit jeder Nest-Runde (gespeichert); anfangs 3 und 2 Küken
    const zahl = store.get('teich.kueken', [3, 2]);
    const n = (i, def) => clamp(Math.round(Number(Array.isArray(zahl) ? zahl[i] : def) || def), 1, 5);
    this.enten = [
      this.neueEnte(0, -560, 760, n(0, 3), 1),
      this.neueEnte(1, 520, 860, n(1, 2), -1),
    ];
  }

  neueEnte(familie, x, y, kuekenZahl, richtung) {
    const e = this.schwimmer('teich/ente_schwimmt', x, y, 1, richtung);
    e.familie = familie;
    e.revier = REVIER[familie];
    e.ziel = { x, y };
    e.pause = rand(1, 3);
    e.modus = 'schwimmt';   // 'schwimmt' | 'holt' | 'frisst'
    e.kruemel = null;
    e.holt = 0;             // Sekunden im Zustand 'holt' (Rettung gegen Hängenbleiben)
    e.v = { x: 0, y: 0 };
    e.kueken = [];
    for (let i = 0; i < kuekenZahl; i++) {
      const k = this.schwimmer('teich/kueken_schwimmt', x - richtung * (110 + i * 80), y + 4, 0.92, richtung);
      k.mutter = e;
      e.kueken.push(k);
    }
    // Antippen: Ente quakt und wackelt, Küken piepen und hüpfen
    tap(e.c, () => {
      if (this.nest?.enteGetippt(e)) return;
      laut('ente');
      fx.wobble(e.c, 0.08);
      this.ringe.ring(e.x, e.y, 300 * e.s);
    }, { sound: null, squash: false, hitArea: new PIXI.Rectangle(-170, -300, 340, 340) });
    for (const k of e.kueken) this.kuekenTippbar(k);
    return e;
  }

  // Küken piept und hüpft beim Antippen
  kuekenTippbar(k) {
    tap(k.c, () => {
      ton('common/kueken', { vol: 0.6 }, 0.3);
      this.huepfer(k, 40);
    }, { sound: null, squash: false, hitArea: new PIXI.Rectangle(-140, -230, 280, 290) });
  }

  huepfer(w, h) {
    killTweensOf(w.hops);
    this.tween(w.hops, { y: -h }, 0.18, { ease: 'quadOut' })
      .then((ok) => { if (ok) this.tween(w.hops, { y: 0 }, 0.4, { ease: 'bounceOut' }); });
  }

  /** Größe eines Schwimmers (faktor 1) bei Tiefe y – für Übergänge an Land/Wasser (nest.js) */
  schwimmGroesse(y) {
    return tiefe(y) * 1.15;
  }

  /** neues Küken (Schwimmer) im Wasser bei (x, y), schaut wie die Mama (nest.js) */
  neuesKueken(e, x, y) {
    const k = this.schwimmer('teich/kueken_schwimmt', x, y, 0.92, e.blick);
    k.mutter = e;
    this.kuekenTippbar(k);
    return k;
  }

  /** Ein großes Küken schwimmt hinaus ins Weite (links aus dem Bild) und ist dann weg */
  kuekenZiehtWeg(k) {
    k.c.zIndex = 650;
    k.bild.scale.x = -Math.abs(k.bild.scale.x);
    this.tween(k.c, { x: -1450, y: 700 }, 9, { ease: 'sineInOut' });
    this.tween(k.c, { alpha: 0 }, 2.5, { ease: 'sineInOut', delay: 6.5 }).then(() => { if (!k.c.destroyed) k.c.destroy({ children: true }); });
  }

  /** Mama und Küken freuen sich (Herzen, Quaken, alle hüpfen) */
  freueFamilie(e) {
    const kopfX = e.x + e.blick * 60 * e.s;
    const kopfY = e.y - 380 * e.s;
    this.burst('herzen', kopfX, kopfY - 40, { count: 5 });
    laut('ente');
    this.huepfer(e, 26);
    for (const kk of e.kueken) this.after(rand(0.1, 0.6), () => this.huepfer(kk, 22));
    ton('common/kueken', { vol: 0.45 }, 0.6);
  }

  // Ein Schwimmer: Container (Ort, z), darin Wellen-Ellipse und das Bild (Blickrichtung = scale.x)
  schwimmer(id, x, y, faktor, richtung) {
    const c = new PIXI.Container({ label: 'schwimmer:' + id });
    const welle = spr('teich/wasserring', { parent: c, anchor: 0.5 });
    welle.alpha = 0.35;
    const bild = spr(id, { parent: c });
    c.position.set(x, y);
    this.welt.addChild(c);
    const w = { c, bild, welle, x, y, faktor, blick: richtung, sx: richtung, phase: rand(0, 6), hops: { y: 0 } };
    this.setzeSchwimmer(w, 0);
    return w;
  }

  setzeSchwimmer(w, t) {
    w.s = tiefe(w.y) * 1.15 * w.faktor;
    const breite = w.bild.texture.width * w.s;
    w.c.position.set(w.x, w.y);
    w.c.zIndex = w.y;
    w.bild.scale.set(w.s * w.sx, w.s);
    w.bild.y = Math.sin(t * 1.7 + w.phase) * 3 + w.hops.y;
    w.bild.rotation = Math.sin(t * 1.1 + w.phase) * 0.03 + (w.neigen || 0) * Math.sign(w.sx || 1);
    w.welle.scale.set((breite * 1.15) / 400, (breite * 0.42) / 149);
    w.welle.y = -2;
  }

  // Blickrichtung weich drehen (durch 0 hindurch, wie ein Umdrehen)
  dreheSchwimmer(w, vx, dt) {
    if (Math.abs(vx) > 6) w.blick = Math.sign(vx);
    w.sx += (w.blick - w.sx) * (1 - Math.exp(-dt * 7));
  }

  // Wohin die Ente zum Fressen schwimmt: seitlich neben den Krümel (Schnabel am Krümel), im Revier und im Band
  setzeHolZiel(e, q) {
    const richtung = Math.sign(q.x - e.x) || e.blick;
    const halb = e.bild.texture.width * e.s * 0.42;
    e.ziel.x = clamp(q.x - richtung * halb, e.revier[0], e.revier[1]);
    e.ziel.y = clamp(q.y + 2, ENTE_Y[0], ENTE_Y[1]);
  }

  updateEnten(dt, t) {
    for (const e of this.enten) {
      if (e.modus === 'nest') continue;   // die Nest-Mama und ihre großen Küken führt nest.js
      let tempo = 38;
      if (e.modus === 'holt') {
        const q = e.kruemel;
        e.holt += dt;
        if (!q || q.weg) { e.modus = 'schwimmt'; e.kruemel = null; e.pause = 0.5; e.ziel.x = e.x; e.ziel.y = e.y; }
        else {
          this.setzeHolZiel(e, q);
          tempo = 95;
        }
      }
      const dx = e.ziel.x - e.x;
      const dy = e.ziel.y - e.y;
      const d = Math.hypot(dx, dy);
      let vzx = 0;
      let vzy = 0;
      if (e.modus === 'holt' && ((d < 14 && !e.kruemel.treibt) || e.holt > HOLT_MAX)) {
        this.frissKruemel(e);
      } else if (e.modus !== 'frisst') {
        if (d < 14) {
          if (e.modus === 'schwimmt') {
            e.pause -= dt;
            if (e.pause <= 0) {
              // ruhig: kurze Strecken im eigenen Revier, dazwischen lange treiben lassen
              e.ziel.x = clamp(e.x + rand(-420, 420), e.revier[0], e.revier[1]);
              e.ziel.y = rand(ENTE_Y[0], ENTE_Y[1]);
              e.pause = rand(4, 8);
            }
          }
        } else {
          const v = tempo * clamp(d / 60, 0.3, 1);
          vzx = (dx / d) * v;
          vzy = (dy / d) * v * 0.7;
        }
      }
      const k = 1 - Math.exp(-dt * 2.2);
      e.v.x += (vzx - e.v.x) * k;
      e.v.y += (vzy - e.v.y) * k;
      e.x += e.v.x * dt;
      e.y = clamp(e.y + e.v.y * dt, ENTE_Y[0], ENTE_Y[1]);

      // Sicherheitsnetz: die Mütter halten Abstand (nur wer gerade frisst, bleibt stehen)
      if (e.modus !== 'frisst') {
        for (const andere of this.enten) {
          if (andere === e) continue;
          const ax = e.x - andere.x;
          const ay = (e.y - andere.y) * 1.6;
          const ab = Math.hypot(ax, ay) || 1;
          const min = 320;
          if (ab < min) {
            const schub = (min - ab) * Math.min(1, dt * 2.5);
            e.x += (ax / ab) * schub;
            e.y = clamp(e.y + (ay / ab) * schub * 0.4, ENTE_Y[0], ENTE_Y[1]);
          }
        }
      }
      this.dreheSchwimmer(e, e.v.x, dt);
      this.setzeSchwimmer(e, t);

      // Küken schwimmen in einer Reihe hinter der Mutter. Dreht sie um, schwimmen sie in einem kleinen Bogen
      // um sie herum (nie durch sie hindurch) und reihen sich wieder hinten ein.
      let vor = e;
      const breit = 150 * (e.s / 0.45);
      for (const kk of e.kueken) {
        const abstand = (vor === e ? 125 : 85) * (e.s / 0.45);
        let zx = vor.x - e.blick * abstand;
        let zy = vor.y + 4;
        const vorne = (kk.x - e.x) * e.blick > -abstand * 0.4;   // noch auf der falschen Seite der Mutter?
        if (vorne && Math.abs(kk.x - e.x) < breit) {
          if (!kk.umweg) kk.umweg = e.y < (ENTE_Y[0] + ENTE_Y[1]) / 2 ? 80 : -80;
          zy = e.y + kk.umweg;
        } else {
          kk.umweg = 0;
        }
        const dx = zx - kk.x;
        const dy = zy - kk.y;
        const d = Math.hypot(dx, dy);
        let vx = 0;
        if (d > 1) {
          const v = Math.min(115, d * 2.6);
          vx = (dx / d) * v;
          kk.x += vx * dt;
          kk.y += (dy / d) * v * dt;
        }
        this.kuekenAbstand(kk, e, dt);
        kk.y = clamp(kk.y, ENTE_Y[0], ENTE_Y[1]);
        this.dreheSchwimmer(kk, vx, dt);
        this.setzeSchwimmer(kk, t);
        vor = kk;
      }
    }
  }

  // Küken schieben sich sanft von der fremden Mutter und deren Küken weg (Abstand ≈ 150)
  kuekenAbstand(kk, mutter, dt) {
    for (const andere of this.enten) {
      if (andere === mutter) continue;
      this.stossAb(kk, andere, 190, dt);
      for (const fremd of andere.kueken) this.stossAb(kk, fremd, 150, dt);
    }
  }

  stossAb(a, b, min, dt) {
    const ax = a.x - b.x;
    const ay = (a.y - b.y) * 1.6;
    const ab = Math.hypot(ax, ay) || 1;
    if (ab >= min) return;
    const schub = (min - ab) * Math.min(1, dt * 3);
    a.x += (ax / ab) * schub;
    a.y += (ay / ab) * schub * 0.4;
  }

  // ---------------------------------------------------------------- Brot und Krümel

  baueBrot() {
    // etwas rechts vom Ufer-Punkt: links daneben steht das Nest (nest.js)
    const p = this.punkt('ufer', { x: -695, y: 1420 });
    this.brot = spr('teich/brot', { parent: this.welt, x: p.x, y: p.y + 68 });
    this.brot.scale.set(0.55);
    this.brot.rotation = -0.12;
    this.brot.zIndex = p.y;
    tap(this.brot, (e) => this.nimmKruemel(e), { sound: null, pad: 55 });
  }

  // Beim Berühren des Brots entsteht ein Krümel am Finger, der gleich weitergezogen wird
  nimmKruemel(e) {
    this.brotHier = true;
    ton('common/rupf', { vol: 0.45 }, 0.15);
    const k = spr('teich/kruemel', { parent: this.welt, x: e.x, y: e.y + 30 });
    k.scale.set(0.42);
    k.zIndex = 5000;
    drag(k, {
      lift: 1.15,
      hitArea: new PIXI.Rectangle(-310, -480, 620, 620),   // ≈ 260 Einheiten (Bild ist auf 0,42 verkleinert)
      back: false,
      onDrop: (_, ctx) => this.kruemelLos(k, ctx),
    });
    const global = this.welt.toGlobal({ x: e.x, y: e.y });
    k.emit('pointerdown', { pointerId: e.pointerId, global, stopPropagation() {} });
    // Der Krümel hängt jetzt am Finger; seine Tippfläche soll keinen zweiten Finger auf dem Brot schlucken
    k.eventMode = 'none';
  }

  // In welche Teichhälfte (Familie) gehört eine Stelle?
  familieBei(x) {
    return x < 0 ? 0 : 1;
  }

  // Ente (oder Küken) unter dem Punkt? → die Ente (Mutter), sonst null
  enteBei(x, y) {
    for (const e of this.enten) {
      if (e.modus === 'nest') continue;
      for (const w of [e, ...e.kueken]) {
        const r = 300 * w.s;
        if (Math.abs(x - w.x) < r && y > w.y - 560 * w.s && y < w.y + 60) return e;
      }
    }
    return null;
  }

  kruemelLos(k, ctx) {
    k.eventMode = 'none';
    if (ctx.cancelled) { this.kruemelWeg(k); return; }
    const bewegt = Math.hypot(ctx.x - ctx.startX, ctx.y - ctx.startY);
    if (bewegt < 40) { this.wirfKruemel(k); return; }
    const x = k.x;
    const y = k.y;
    // haben die Küken im Nest Hunger (nest.js), bekommen sie den Krümel
    if (this.nest.kruemelFuerKueken(k, x, y, false)) return;
    // ein wartender Gast (Schwan, Schildkröte) bekommt, was man ihm bringt
    if (this.gast.nimmKruemel(k, x, y)) return;
    // Direkt auf eine Ente (oder ihr Küken) gelegt: der Krümel plumpst vor ihren Schnabel
    const ente = this.enteBei(x, y);
    if (ente) {
      const z = this.vorDerEnte(ente);
      this.tween(k, { x: z.x, y: z.y }, 0.3, { ease: 'quadIn' })
        .then((ok) => { if (ok && !k.destroyed) this.kruemelAufsWasser(k, z.x, z.y, ente); });
      return;
    }
    if (WASSER_POLY.contains(x, y)) { this.kruemelAufsWasser(k, x, y); return; }
    // Über dem hinteren Wasser (am fernen Ufer, im Himmel) losgelassen: er fällt hinten ins Wasser
    if (y < WASSER_OBEN + 100 && x > -1250 && x < 1250) {
      const zy = ENTE_Y[0] + 20;
      this.tween(k, { y: zy }, 0.35, { ease: 'quadIn' })
        .then((ok) => { if (ok && !k.destroyed) this.kruemelAufsWasser(k, x, zy); });
      return;
    }
    // auf dem Ufer losgelassen: zurück zum Brot und weg
    this.tween(k, { x: this.brot.x, y: this.brot.y - 60 }, 0.4, { ease: 'sineInOut' }).then(() => this.kruemelWeg(k));
  }

  // Stelle knapp vor dem Schnabel einer Ente (im Revier, im Band)
  vorDerEnte(e) {
    const r = e.revier;
    return {
      x: clamp(e.x + e.blick * rand(150, 220), r[0] + KRUEMEL_RAND, r[1] - KRUEMEL_RAND),
      y: clamp(e.y + rand(0, 30), ENTE_Y[0] + 10, ENTE_Y[1] - 10),
    };
  }

  // Brot nur angetippt: der Krümel fliegt im Bogen vor die Ente, die am längsten nichts bekam
  wirfKruemel(k) {
    if (this.nest.kruemelFuerKueken(k, k.x, k.y, true)) return;
    if (this.gast.wirfZu(k)) return;
    const frei = this.enten.filter((e) => e.modus === 'schwimmt');
    const liste = frei.length ? frei : this.enten;
    const ente = liste.reduce((a, b) => ((a.zuletzt || 0) <= (b.zuletzt || 0) ? a : b));
    ente.zuletzt = performance.now();
    const z = this.vorDerEnte(ente);
    const x0 = k.x;
    const y0 = k.y;
    const p = { t: 0 };
    ton('common/wusch', { vol: 0.3 }, 0.3);
    this.tween(p, { t: 1 }, flugDauer(z.x - x0, z.y - y0, { hoehe: 260, min: 0.8, v: 1050 }), {
      ease: 'linear',
      onUpdate: () => {
        if (k.destroyed) return;
        k.x = x0 + (z.x - x0) * p.t;
        k.y = y0 + (z.y - y0) * p.t - 260 * 4 * p.t * (1 - p.t);
        k.rotation = p.t * 2;
      },
    }).then((ok) => { if (ok && !k.destroyed) this.kruemelAufsWasser(k, z.x, z.y, ente); });
  }

  // Krümel landet auf dem Wasser. Liegt er nicht im Entenband seiner Teichhälfte (vorn, zwischen den Blättern,
  // in der Mitte), treibt er sanft dorthin – die Enten bleiben so immer hinter den Seerosen.
  // ente: wem der Krümel zugeworfen wurde
  kruemelAufsWasser(k, x, y, ente = null) {
    if (k.destroyed) return;
    killTweensOf(k);
    k.position.set(x, y);
    k.rotation = 0;
    k.zIndex = y - 1;
    this.ringe.ring(x, y, 220 * (tiefe(y) / 0.5));
    ton('common/plopp', { vol: 0.45 }, 0.2);
    const familie = ente ? ente.familie : this.familieBei(x);
    const r = REVIER[familie];
    const zx = clamp(x, r[0] + KRUEMEL_RAND, r[1] - KRUEMEL_RAND);
    const zy = clamp(y, ENTE_Y[0] + 10, ENTE_Y[1] - 10);
    // beim Treiben liegt er schon auf der Ebene seines Ziels: er gleitet unter Blättern, Frosch und Boot hindurch
    const eintrag = { s: k, x, y, z: zy - 1, familie, ente: null, t: 0, weg: false, treibt: false };
    this.kruemel.push(eintrag);
    const weit = Math.hypot(zx - x, zy - y);
    if (weit > 4) {
      eintrag.treibt = true;
      this.tween(eintrag, { x: zx, y: zy }, clamp(weit / 200, 0.8, 3), { ease: 'sineInOut' }).then(() => {
        eintrag.treibt = false;
      });
    }
    // zu viele Krümel: der älteste, den noch keine Ente holt, löst sich auf
    if (this.kruemel.length > KRUEMEL_MAX) {
      const alt = this.kruemel.find((q) => !q.ente);
      if (alt) this.kruemelVerschwindet(alt);
    }
    this.verteileKruemel();
  }

  // Jede freie Ente holt den nächsten freien Krümel ihrer Teichhälfte
  verteileKruemel() {
    for (const e of this.enten) {
      if (e.modus !== 'schwimmt') continue;
      let beste = null;
      let bd = Infinity;
      for (const q of this.kruemel) {
        if (q.ente || q.weg || q.familie !== e.familie) continue;
        const d = Math.hypot(e.x - q.x, e.y - q.y);
        if (d < bd) { bd = d; beste = q; }
      }
      if (!beste) continue;
      beste.ente = e;
      e.modus = 'holt';
      e.holt = 0;
      e.kruemel = beste;
    }
  }

  frissKruemel(e) {
    const q = e.kruemel;
    e.modus = 'frisst';
    e.v.x = 0;
    e.v.y = 0;
    const neig = { n: 0 };
    e.neigen = 0;
    sfx('common/mampf', { vol: 0.7 });
    this.tween(neig, { n: 0.22 }, 0.2, { ease: 'sineInOut', onUpdate: () => { e.neigen = neig.n; } })
      .then(() => this.tween(neig, { n: 0 }, 0.45, { ease: 'backOut', onUpdate: () => { e.neigen = neig.n; } }));
    if (q) {
      q.weg = true;
      killTweensOf(q);
      this.tween(q.s, { alpha: 0, scale: q.s.scale.x * 0.3 }, 0.35, { ease: 'sineInOut' })
        .then(() => this.kruemelWeg(q.s));
      this.kruemel = this.kruemel.filter((x) => x !== q);
    }
    this.after(0.55, () => {
      const kopfX = e.x + e.blick * 60 * e.s;
      const kopfY = e.y - 380 * e.s;
      this.burst('herzen', kopfX, kopfY - 40, { count: 4 });
      laut('ente');
      killTweensOf(e.hops);
      this.tween(e.hops, { y: -26 }, 0.2, { ease: 'quadOut' })
        .then((ok) => { if (ok) this.tween(e.hops, { y: 0 }, 0.45, { ease: 'bounceOut' }); });
      for (const kk of e.kueken) {
        this.after(rand(0.1, 0.5), () => {
          killTweensOf(kk.hops);
          this.tween(kk.hops, { y: -22 }, 0.18, { ease: 'quadOut' })
            .then((ok) => { if (ok) this.tween(kk.hops, { y: 0 }, 0.4, { ease: 'bounceOut' }); });
        });
      }
      ton('common/kueken', { vol: 0.4 }, 0.6);
      this.gefuettert++;
      if (this.gefuettert % KRUEMEL_RUNDE === 0) {
        const id = naechsterSticker('tier_ente', ['tier_ente', 'teich_seerose']);
        belohne(this, id, STICKER_ORT.x, STICKER_ORT.y);
      }
    });
    this.after(1.4, () => {
      e.modus = 'schwimmt';
      e.kruemel = null;
      e.pause = rand(1.5, 3);
      e.ziel.x = e.x;
      e.ziel.y = e.y;
      this.verteileKruemel();
    });
  }

  kruemelVerschwindet(q) {
    q.weg = true;
    killTweensOf(q);
    this.kruemel = this.kruemel.filter((x) => x !== q);
    this.tween(q.s, { alpha: 0 }, 0.8, { ease: 'sineInOut' }).then(() => this.kruemelWeg(q.s));
  }

  kruemelWeg(k) {
    if (k && !k.destroyed) k.destroy();
  }

  updateKruemel(dt, t) {
    for (const q of this.kruemel) {
      q.t += dt;
      if (!q.s.destroyed) {
        q.s.x = q.x;
        q.s.y = q.y + Math.sin(q.t * 2) * 2.5;
        q.s.rotation = Math.sin(q.t * 1.3) * 0.06;
        q.s.zIndex = q.treibt ? q.z : q.y - 1;
      }
    }
  }

  // ---------------------------------------------------------------- Nebensachen

  baueDeko() {
    // Schilf: links unten am Ufer und rechts hinten am Rand
    this.schilf = [
      { x: -470, y: 1525, s: 0.62 },
      { x: 1210, y: 668, s: 0.42 },
      { x: -1200, y: 1230, s: 0.5 },
    ].map(({ x, y, s }, i) => {
      const sch = spr('teich/schilf', { parent: this.welt, x, y });
      sch.scale.set(s);
      sch.zIndex = y;
      sch.phase = i * 1.7;
      sch.extra = { w: 0 };
      tap(sch, (e) => {
        // Nest-Runde: aus dem Schilf entsteht ein Halm am Finger (nest.js)
        if (this.nest?.halmVomSchilf(e)) { sch.extra.w = 0.08; this.tween(sch.extra, { w: 0 }, 1.2, { ease: 'sineInOut' }); return; }
        ton('common/rascheln', { vol: 0.5 }, 0.4);
        killTweensOf(sch.extra);
        sch.extra.w = 0.12;
        this.tween(sch.extra, { w: 0 }, 1.6, { ease: 'sineInOut' });
      }, {
        // nur der untere Teil (≈ 230 breit/hoch): die Rohrkolben oben verdecken sonst das Seerosenblatt dahinter
        sound: null, squash: false,
        hitArea: new PIXI.Rectangle(-Math.max(420, 230 / s) / 2, -Math.max(380, 230 / s) + 10,
          Math.max(420, 230 / s), Math.max(380, 230 / s)),
      });
      return sch;
    });

    // Libelle: schwebt ruhig hoch über dem hinteren Wasser oder sitzt lange still auf einem freien Seerosenblatt
    this.libelle = {
      s: spr('teich/libelle', { parent: this.welt, anchor: 0.5 }),
      h: { x: 250, y: 570 },     // Schwebe-Mitte bzw. Flugort
      modus: 'schwebt',          // 'schwebt' | 'fliegt' | 'sitzt'
      blatt: -1,
      t: 0,
      dauer: rand(5, 8),
      blick: 1,
      lx: 250,
    };
    this.libelle.s.scale.set(0.42);
    this.libelle.s.zIndex = 2800;
    tap(this.libelle.s, () => {
      note('pling', pick([84, 86, 88]), { vol: 0.35 });
      const l = this.libelle;
      // Sitzt sie auf einem Blatt, gilt der Tipp auch dem Blatt (der Frosch springt hin, sie fliegt auf)
      const b = l.modus === 'sitzt' ? l.blatt : -1;
      this.libelleWeiter();
      if (b >= 0) this.blattGetippt(b);
    }, { sound: null, squash: false, hitArea: new PIXI.Circle(0, 0, 150 / 0.42) }); // ≈ 300 breit

    // Papierboot treibt vorn langsam nach rechts
    this.boot = this.schwimmer('teich/papierboot', -300, 1335, 0.85, 1);
    this.boot.schub = 0;
    tap(this.boot.c, () => {
      this.boot.schub = 120;
      this.ringe.ring(this.boot.x - 90, this.boot.y, 260);
      ton('common/platsch', { vol: 0.25, rate: 1.2 }, 0.4);
    }, { sound: null, squash: false, hitArea: new PIXI.Rectangle(-170, -170, 340, 220) });

    this.vogel = new Vogel(this, this.welt, { yBereich: [150, 330] });
    // Schmetterling sitzt auf den Blumen am fernen Ufer – links unten am Nest stört er die Nest-Runde nicht
    this.schmetterling = new Schmetterling(this, this.welt, [
      { x: -845, y: 470 }, { x: -70, y: 455 }, { x: 860, y: 445 },
    ]);
    // Trauerweide (im Hintergrund) antippen: Blätter rieseln; in der Nest-Runde mit Blättern segelt ein Zweig herab
    const weide = new PIXI.Container({ label: 'weide' });
    weide.zIndex = -90;
    this.welt.addChild(weide);
    tap(weide, (e) => {
      const zweig = this.nest?.blattVomBaum(e);
      this.burst('blaetter', e.x, e.y + 40, { count: zweig ? 2 : 4 });
      if (!zweig) ton('common/rascheln', { vol: 0.45 }, 0.5);
    }, { sound: null, squash: false, hitArea: new PIXI.Ellipse(-745, 290, 250, 175) });
    this.wolken = new Wolken(this, this.hinten, [
      { id: 'common/wolke2', x: -350, y: 160, breite: 380, tempo: 7 },
      { id: 'common/wolke1', x: 520, y: 200, breite: 230, tempo: 5 },
    ]);
  }

  // Sitzplatz der Libelle auf Blatt i (neben der Blüte, wippt mit dem Blatt)
  libellenSitz(i) {
    const b = this.blaetter[i];
    return { x: b.x + 70 * b.skala, y: b.y - 50 * b.skala };
  }

  // Libelle fliegt weiter: vom Schweben auf ein freies Blatt, vom Blatt (oder wenn gestört) hoch zum Schweben
  libelleWeiter() {
    const l = this.libelle;
    const aufsBlatt = l.modus === 'schwebt' && Math.random() < 0.8;
    let ziel;
    l.blatt = -1;
    if (aufsBlatt) {
      const frei = this.blaetter.map((_, i) => i).filter((i) => i !== this.froschBlatt && i !== this.wunschBlatt);
      l.blatt = pick(frei);
      ziel = this.libellenSitz(l.blatt);
    } else {
      ziel = { x: rand(-700, 700), y: rand(530, 600) };
    }
    l.h.x = l.s.x;
    l.h.y = l.s.y;
    l.modus = 'fliegt';
    l.s.zIndex = 2800;
    killTweensOf(l.h);
    this.tween(l.h, ziel, 2.6, { ease: 'sineInOut' }).then((ok) => {
      if (!ok) return;
      l.modus = l.blatt >= 0 ? 'sitzt' : 'schwebt';
      l.dauer = l.modus === 'sitzt' ? rand(10, 16) : rand(5, 8);
      l.t = 0;
      if (l.modus === 'sitzt') l.s.zIndex = this.blaetter[l.blatt].zIndex + 5;
    });
  }

  updateLibelle(dt) {
    const l = this.libelle;
    l.t += dt;
    let x = l.h.x;
    let y = l.h.y;
    if (l.modus === 'schwebt') {
      // sanftes Schweben (rampt beim Ankommen weich hoch, kein Ruck)
      const a = Math.min(1, l.t / 2);
      x += Math.sin(l.t * 0.5) * 90 * a;
      y += Math.sin(l.t * 0.9) * 16 * a;
    } else if (l.modus === 'sitzt') {
      const p = this.libellenSitz(l.blatt);
      x = p.x;
      y = p.y;
    }
    if (l.modus !== 'fliegt') {
      l.dauer -= dt;
      if (l.dauer <= 0) this.libelleWeiter();
    }
    const vx = (x - l.lx) / Math.max(dt, 0.001);
    l.lx = x;
    if (Math.abs(vx) > 8) l.blick = Math.sign(vx);
    l.s.position.set(x, y);
    const zielX = 0.42 * l.blick;
    l.s.scale.x += (zielX - l.s.scale.x) * (1 - Math.exp(-dt * 5));
  }

  updateDeko(dt, t) {
    for (const sch of this.schilf) {
      sch.skew.x = Math.sin(t * 0.9 + sch.phase) * 0.05 + Math.sin(t * 6) * sch.extra.w;
    }
    this.updateLibelle(dt);

    // Boot: gemütlich nach rechts; am Ende weich aus- und links wieder einblenden
    const b = this.boot;
    b.schub *= Math.exp(-dt * 0.8);
    b.x += (18 + b.schub) * dt;
    if (b.x > 860 && !b.geht) {
      b.geht = true;
      this.tween(b.c, { alpha: 0 }, 1.5, { ease: 'sineInOut' }).then(() => {
        b.x = -420;
        b.geht = false;
        this.tween(b.c, { alpha: 1 }, 1.5, { ease: 'sineInOut' });
      });
    }
    this.setzeSchwimmer(b, t);

    this.vogel.update(dt);
    this.schmetterling.update(dt);
    this.wolken.update(dt);
  }

  // ---------------------------------------------------------------- Ablauf

  update(dt, t) {
    for (const b of this.blaetter) {
      b.y = b.basis.y + Math.sin(t * 0.8 + b.phase) * 3 + b.dip.y;
      b.rotation = Math.sin(t * 0.6 + b.phase) * 0.015;
    }
    if (!this.springt && this.froschBlatt >= 0) {
      const b = this.blaetter[this.froschBlatt];
      this.frosch.y = this.sitzY(b);
    }
    this.updateEnten(dt, t);
    this.nest.update(dt, t);
    this.gast.update(dt, t);
    this.updateKruemel(dt, t);
    this.updateDeko(dt, t);
  }

  hinweise() {
    const andere = this.blaetter.filter((_, i) => i !== this.froschBlatt);
    const frei = this.enten.filter((e) => e.modus !== 'nest');
    const ente = (frei.length ? frei : this.enten).reduce((a, e) => (Math.hypot(e.x - this.brot.x, e.y - this.brot.y) <
      Math.hypot(a.x - this.brot.x, a.y - this.brot.y) ? e : a));
    const nest = this.nest.hinweis();
    // läuft eine Nest-Runde, zeigt die Hand zuerst (zweimal) den nächsten Schritt
    if (nest) return [nest, nest, andere[0], { von: this.brot, nach: ente.c }];
    // ein Gast wartet auf Krümel
    const gast = this.gast.hinweis();
    if (gast) return [gast, andere[0], gast, this.frosch];
    return [andere[0], { von: this.brot, nach: ente.c }, this.frosch];
  }
}
