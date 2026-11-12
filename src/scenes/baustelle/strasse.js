// Seite 3 – Straße (hg_strasse).
// Auf der Straße liegt eine holprige Erd-Decke. Fährt der Finger über die Straße, folgt ihm die Walze weich und
// walzt die Decke weg → glatter Asphalt. Ist alles glatt, kommt das Markierwägelchen und zieht weiße Striche,
// wo der Finger entlangfährt (nach einer Weile ohne Finger fährt es von selbst). Danach fahren ein Mischer und
// der Kipper mit Tieren hupend darüber, und nach einer Weile kommt eine neue Holperdecke.

import { stage, spr, meta, voice, fx, tap, PIXI, clamp } from '../../engine/index.js';
import { Seite } from '../../gemeinsam/seiten.js';
import { Fahrzeug } from '../../gemeinsam/zug.js';
import { belohne } from '../../gemeinsam/sticker.js';
import { Decke } from './decke.js';
import { Wolken, Schmetterling, Spatz, helmTier, freuen, ton } from './deko.js';

const WALZE_S = 0.52;
const WALZE_Y = [1185, 1390];     // Standlinie der Walze (vorn/hinten auf der Straße)
const WALZE_TEMPO = 1100;         // höchstens so schnell folgt sie dem Finger
const PINSEL = { rx: 115, ry: 150 };
const FERTIG_AB = 0.9;            // Anteil der gezählten Fläche (nur der Kernbereich zählt, siehe zaehlen)
const ZAEHL_X = 1000;             // gezählt wird x -1000 … +1000 (auf jedem Bildschirm sichtbar)
const TROMMEL_X = 1235;           // so weit nach außen kommt die Trommel (deckt auch die Bildränder ab)
const LINIE_Y = 1240;             // Mitte der Straße: hier kommen die weißen Striche hin
const STRICHE = 10;
const STRICH_LANG = 120;
const STRICH_X = 1000;            // Striche zwischen -1000 und +1000 (Kernbereich)
const STRICH_FERTIG = 0.4;        // ab diesem Anteil gilt ein Strich als gemalt
const FINGER_VERGESSEN = 3;       // s ohne Bewegung: der Finger gilt als losgelassen (falls ein pointerup verloren ging)
const ROLLE_S = 0.55;
const SPUR = 1395;                // Standlinie der Fahrzeuge, die am Ende darüberfahren

export class Strasse extends Seite {
  static hg = 'baustelle/hg_strasse';

  aufbau() {
    this.wolken = new Wolken(this, { anzahl: 2, y: [100, 260] });
    this.schmetterling = new Schmetterling(this, { bereich: { x: -450, y: 600, w: 900, h: 240 }, farbe: 0x8fc8f0 });
    this.spatz = new Spatz(this, { x: 520, y: 842, z: 4 });

    const oben = this.punkt('strasse_oben', { x: 0, y: 1055 }).y;
    const unten = this.punkt('strasse_unten', { x: 0, y: 1425 }).y;
    this.decke = new Decke(this.welt, {
      x: -1420, y: oben - 18, w: 2840, h: unten - oben + 36,
      zaehlen: { x0: -ZAEHL_X, x1: ZAEHL_X, y0: oben + 10, y1: unten - 10 },
    });

    this.baueStriche();
    this.baueWalze();
    this.baueRolle();
    this.baueKolonne();
    this.baueFlaeche(oben, unten);

    this.phase = 'walzen';     // 'walzen' | 'wechsel' | 'malen' | 'fahrt'
    this.finger = null;        // pointerId des steuernden Fingers (der jüngste Finger auf der Straße steuert)
    this.fingerRuht = 0;       // Sekunden seit der letzten Bewegung des Fingers
    this.ziel = null;          // wohin der Finger zeigt (Seiten-Koordinaten)
    this._vorher = { x: 0, y: 0 };
    this._jetzt = { x: 0, y: 0 };
    this.ohneFinger = 0;       // Sekunden ohne Finger (für das Markierwägelchen)
    this.walzTon = 0;
  }

  betreten() {
    // Hinweis bei jedem Betreten anmelden (der Kern sagt ihn höchstens einmal am Tag) – nur, solange die Seite zu
    // sehen ist und noch gewalzt wird (die Zeitgeber laufen beim Wegblättern weiter)
    this._hinweis?.kill();
    this._hinweis = null;
    if (this.phase !== 'walzen') return;
    const passt = () => this.aktiv && this.phase === 'walzen';
    this._hinweis = this.after(1.2, () => { if (passt()) voice('baustelle_walze', { nurWenn: passt }); });
  }

  verlassen() {
    this._hinweis?.kill();
    this._hinweis = null;
    this.finger = null;
    this.ziel = null;
  }

  // ---------------------------------------------------------------- Eingabe: Finger auf der Straße

  baueFlaeche(oben, unten) {
    const f = new PIXI.Container({ label: 'strassenFlaeche' });
    f.zIndex = 1;
    // Straße samt Bordstein; unten rechts bleibt die Ecke (240 × 240) frei
    f.hitArea = {
      contains: (x, y) => x > -1420 && x < 1420 && y > oben - 70 && y < unten + 40 &&
        !(x > stage.W / 2 - 250 && y > stage.H - 250),
    };
    f.eventMode = 'static';
    this.welt.addChild(f);
    this._zielPunkt = new PIXI.Point();
    this._g = new PIXI.Point();
    f.on('pointerdown', (e) => {
      if (!this.aktiv) return;
      // Walze oder Wägelchen getroffen? → kleine Antwort (auch für einen zweiten Finger)
      if (this.walze.visible && this.walze.getBounds().rectangle.contains(e.global.x, e.global.y)) this.walzeHupt();
      else if (this.rolle.visible && this.rolle.getBounds().rectangle.contains(e.global.x, e.global.y)) {
        if (ton('common/klingel', { abstand: 0.6, vol: 0.5 })) fx.wobble(this.rolle, 0.05);
      }
      e.stopPropagation();
      if (this.phase !== 'walzen' && this.phase !== 'malen') {
        // während des Wechsels und der Fahrt steuert der Finger nichts (sonst fährt die Walze später dorthin)
        if (ton('common/tipp', { abstand: 0.2, vol: 0.6 })) {
          const p = this.welt.toLocal(e.global);
          this.burst('staub', p.x, p.y, { count: 2 });
        }
        return;
      }
      // der neue Finger übernimmt (ein verlorener alter Finger kann so nie etwas blockieren)
      this.finger = e.pointerId;
      this.fingerRuht = 0;
      this.ziel = this.welt.toLocal(e.global, undefined, this._zielPunkt);
      this.ohneFinger = 0;
      if (this.phase === 'walzen') ton('common/walze', { abstand: 2.6, vol: 0.55 });
      else ton('common/pinsel', { abstand: 0.6, vol: 0.6 });
    });
    // Bewegen und Loslassen direkt am Fenster (wie der Spielkern) – Abbau in aufraeumen() beim Verlassen der Szene
    this._bewegt = (ev) => {
      if (ev.pointerId !== this.finger || !this.aktiv || this.welt.destroyed) return;
      stage.app.renderer.events.mapPositionToPoint(this._g, ev.clientX, ev.clientY);
      this.ziel = this.welt.toLocal(this._g, undefined, this._zielPunkt);
      this.fingerRuht = 0;
    };
    this._los = (ev) => {
      if (ev.pointerId === this.finger) this.finger = null;
    };
    // Fenster verliert den Fokus (Systemgeste, anderes Programm): kein pointerup mehr – Finger loslassen
    this._alleLos = () => { this.finger = null; };
    window.addEventListener('pointermove', this._bewegt, { passive: true });
    window.addEventListener('pointerup', this._los, { passive: true });
    window.addEventListener('pointercancel', this._los, { passive: true });
    window.addEventListener('blur', this._alleLos);
    this.flaeche = f;
  }

  // ---------------------------------------------------------------- Walze

  baueWalze() {
    const w = new PIXI.Container({ label: 'walze' });
    const mw = meta('baustelle/walze');
    const trommelPunkt = { x: mw.pts.trommel[0] - mw.ax * mw.w, y: mw.pts.trommel[1] - mw.ay * mw.h };
    // Trommel hinter dem Körper (im leeren Bogen vorn sichtbar), dreht sich beim Fahren
    const tr = spr('baustelle/walze_trommel', { anchor: 0.5, parent: w });
    tr.scale.set(0.72);
    tr.position.set(trommelPunkt.x, trommelPunkt.y);
    this.koerperW = new PIXI.Container();
    w.addChild(this.koerperW);
    spr('baustelle/walze', { parent: this.koerperW });
    w.scale.set(WALZE_S);
    w.position.set(-700, 1300);
    w.zIndex = 20;
    this.welt.addChild(w);
    this.walze = w;
    this.trommel = tr;
    this.trommelPunkt = trommelPunkt;
    this.trommelR = 150;   // Bildpunkte der Walze
    this.walzeT = 0;
    // Antippen der Walze (Hupe, kleiner Hüpfer) macht die Straßen-Fläche mit – so steuert der Finger auch dann,
    // wenn er direkt auf der Walze landet.
  }

  walzeHupt() {
    if (!ton('common/hupe', { abstand: 0.8, vol: 0.7 })) return;
    this.tween(this.koerperW, { y: -30 }, 0.15, { ease: 'quadOut' })
      .then(() => this.tween(this.koerperW, { y: 0 }, 0.2, { ease: 'quadIn' }));
  }

  // Ort, an dem die Trommel den Boden berührt (Seiten-Koordinaten) – in `aus` geschrieben (kein neues Objekt je Bild)
  walzOrt(aus = { x: 0, y: 0 }) {
    const w = this.walze;
    aus.x = w.x + this.trommelPunkt.x * w.scale.x;
    aus.y = w.y - 30;
    return aus;
  }

  bewegeWalze(dt) {
    const w = this.walze;
    // fährt auch nach dem Loslassen noch weich bis zur letzten Fingerstelle
    if (this.phase !== 'walzen' || !this.ziel) return;
    const s0 = w.scale.x;
    // nahe am Bildrand etwas weiter nach außen, damit auch die Ecken der Straße glatt werden
    const trommelZiel = clamp(this.ziel.x * 1.1, -TROMMEL_X, TROMMEL_X);
    const tx = trommelZiel - this.trommelPunkt.x * s0;
    const ty = clamp(this.ziel.y + 60, WALZE_Y[0], WALZE_Y[1]);
    const k = 1 - Math.exp(-dt * 5);
    let dx = (tx - w.x) * k;
    let dy = (ty - w.y) * k;
    const d = Math.hypot(dx, dy);
    const max = WALZE_TEMPO * dt;
    if (d > max) { dx *= max / d; dy *= max / d; }
    if (d < 0.3) {
      if (this.finger === null) this.ziel = null;
      return;
    }
    const vorher = this.walzOrt(this._vorher);
    w.x += dx;
    w.y += dy;
    // weiter vorn = etwas größer
    const tief = (w.y - WALZE_Y[0]) / (WALZE_Y[1] - WALZE_Y[0]);
    w.scale.set(WALZE_S * (0.94 + 0.1 * tief));
    w.zIndex = 20 + tief;
    this.trommel.rotation += dx / (this.trommelR * w.scale.x);
    const jetzt = this.walzOrt(this._jetzt);
    const anteil = this.decke.walze(vorher.x, vorher.y, jetzt.x, jetzt.y, PINSEL.rx, PINSEL.ry);
    ton('common/walze', { abstand: 2.6, vol: 0.55 });
    if (anteil >= FERTIG_AB) this.glatt();
  }

  async glatt() {
    if (this.phase !== 'walzen') return;
    this.phase = 'wechsel';
    this.finger = null;
    this.ziel = null;
    ton('common/funkeln', { abstand: 0.5 });
    for (let i = 0; i < 3; i++) this.burst('funkeln', -700 + i * 700, LINIE_Y, { count: 5 });
    await this.tween(this.decke.sprite, { alpha: 0 }, 0.8, { ease: 'sineInOut' });
    this.decke.leere();
    this.decke.sprite.alpha = 1;
    // Walze fährt rechts hinaus, das Markierwägelchen rollt von links herein
    ton('common/motor', { abstand: 3, vol: 0.5 });
    this.tween(this.walze, { x: 1750 }, 2.2, {
      ease: 'quadIn',
      onUpdate: () => { this.trommel.rotation += 0.04; },
    });
    await this.wait(0.8);
    voice('baustelle_linie', { nurWenn: () => this.aktiv });
    this.rolle.visible = true;
    this.rolle.x = -1650;
    // hält mit der Düse knapp links vom ersten Strich
    await this.tween(this.rolle, { x: this.striche[0].a - 40 - this.duese.x }, 1.6, { ease: 'sineOut' });
    this.phase = 'malen';
    this.ohneFinger = -1.5;   // beim ersten Mal etwas länger auf den Finger warten (≈ 4 s), dann fährt es selbst
  }

  // ---------------------------------------------------------------- Striche und Markierwägelchen

  baueStriche() {
    this.striche = [];
    const abstand = (2 * STRICH_X) / STRICHE;
    for (let i = 0; i < STRICHE; i++) {
      const mitte = -STRICH_X + abstand * (i + 0.5);
      const s = new PIXI.Sprite(PIXI.Texture.WHITE);
      s.tint = 0xfbf7ec;
      s.height = 20;
      s.anchor.set(0, 0.5);
      s.position.set(mitte - STRICH_LANG / 2, LINIE_Y);
      s.width = 0;
      s.zIndex = 3;
      s.eventMode = 'none';
      this.welt.addChild(s);
      this.striche.push({ s, a: mitte - STRICH_LANG / 2, b: mitte + STRICH_LANG / 2, von: null, bis: null, fertig: false });
    }
  }

  baueRolle() {
    const r = spr('baustelle/linienrolle', { parent: this.welt });
    r.scale.set(ROLLE_S);
    const m = meta('baustelle/linienrolle');
    this.duese = { x: (m.pts.duese[0] - m.ax * m.w) * ROLLE_S, y: (m.pts.duese[1] - m.ay * m.h) * ROLLE_S };
    r.position.set(-1650, LINIE_Y - this.duese.y);
    r.zIndex = 25;
    r.visible = false;
    this.rolle = r;
    // Antippen (Klingel) übernimmt die Straßen-Fläche – wer das Wägelchen greift, steuert es gleich
  }

  bewegeRolle(dt) {
    if (this.phase !== 'malen') return;
    const r = this.rolle;
    let tx = null;
    if (this.finger !== null) this.ohneFinger = 0;
    else this.ohneFinger += dt;
    // mit Finger (und kurz nach dem Loslassen) fährt es zur Fingerstelle
    const folgt = !!this.ziel && this.ohneFinger < 1.5;
    if (folgt) {
      tx = this.ziel.x - this.duese.x;
      this.autoStrich = null;
    } else {
      // nach einer Weile ohne Finger fährt es von selbst zum nächsten leeren Strich
      if (this.ohneFinger > 2.5) {
        const n = this.naechsterStrich();
        if (n) {
          // Richtung einmal je Strich festlegen (sonst pendelt es um die Mitte)
          if (this.autoStrich !== n) {
            this.autoStrich = n;
            const d = r.x + this.duese.x;
            this.autoZiel = d < (n.a + n.b) / 2 ? n.b + 10 : n.a - 10;
          }
          tx = this.autoZiel - this.duese.x;
        }
      }
    }
    if (tx === null) return;
    tx = clamp(tx, -1150 - this.duese.x, 1150 - this.duese.x);
    // mit Finger: weich hinterher; von selbst: gemächlich mit gleichem Tempo
    const k = folgt ? 1 - Math.exp(-dt * 5) : 1;
    let dx = (tx - r.x) * k;
    const max = (folgt ? 1000 : 380) * dt;
    dx = clamp(dx, -max, max);
    if (Math.abs(dx) < 0.2) return;
    const a = r.x + this.duese.x;
    r.x += dx;
    const b = r.x + this.duese.x;
    r.rotation = Math.sin(this.t * 14) * 0.01;
    this.male(Math.min(a, b), Math.max(a, b));
  }

  male(lo, hi) {
    let neu = false;
    for (const q of this.striche) {
      if (q.fertig || hi < q.a || lo > q.b) continue;
      const v = Math.max(q.a, lo);
      const b = Math.min(q.b, hi);
      q.von = q.von === null ? v : Math.min(q.von, v);
      q.bis = q.bis === null ? b : Math.max(q.bis, b);
      neu = true;
      if (q.bis - q.von >= STRICH_LANG * STRICH_FERTIG) {
        // ab knapp der Hälfte gilt der Strich als gemalt und wächst weich zu voller Länge
        q.fertig = true;
        q.s.x = q.von;
        q.s.width = q.bis - q.von;
        this.tween(q.s, { x: q.a, width: STRICH_LANG }, 0.3, { ease: 'sineInOut' });
        ton('common/pinsel', { abstand: 0.35, vol: 0.55 });
        continue;
      }
      q.s.x = q.von;
      q.s.width = q.bis - q.von;
    }
    if (neu && !this.naechsterStrich()) this.allesGemalt();
  }

  // erster noch nicht gemalter Strich (oder null)
  naechsterStrich() {
    for (const q of this.striche) if (!q.fertig) return q;
    return null;
  }

  async allesGemalt() {
    if (this.phase !== 'malen') return;
    this.phase = 'fahrt';
    this.finger = null;
    this.ziel = null;
    ton('common/funkeln', { abstand: 0.5 });
    this.burst('funkeln', 0, LINIE_Y - 30, { count: 8 });
    belohne(this, 'baustelle_walze', 0, LINIE_Y - 260);
    await this.tween(this.rolle, { x: 1700 }, 2, { ease: 'quadIn' });
    this.rolle.visible = false;
    await this.fahrtUeberDieStrasse();
    await this.wait(2);
    await this.neueDecke();
  }

  // ---------------------------------------------------------------- Mischer und Kipper mit Tieren

  baueKolonne() {
    const mischer = new PIXI.Container({ label: 'mischer' });
    this.mischerBild = spr('baustelle/mischer', { parent: mischer });
    mischer.scale.set(0.55);
    mischer.position.set(-1900, SPUR);
    mischer.zIndex = 30;
    mischer.visible = false;
    this.welt.addChild(mischer);
    this.mischer = mischer;
    tap(mischer, () => {
      ton('common/hupe', { abstand: 0.6 });
      fx.wobble(this.mischerBild, 0.03);
    }, { sound: null, pad: 30, squash: false });

    const k = new Fahrzeug({
      koerper: 'baustelle/kipper',
      raeder: [{ tex: 'baustelle/rad_lkw', punkt: 'rad1' }, { tex: 'baustelle/rad_lkw', punkt: 'rad2' }],
      x: -1900, y: SPUR, scale: 0.5, parent: this.welt, z: 31,
    });
    k.visible = false;
    // zwei Tiere mit Helm sitzen in der Mulde (hinter dem Körper: nur der obere Teil schaut heraus)
    const mk = meta('baustelle/kipper');
    const muldeY = 330 - mk.ay * mk.h;
    this.gaeste = [
      helmTier('hund', { x: 160 - mk.ax * mk.w, y: muldeY, scale: 0.42 }),
      helmTier('ente', { x: 400 - mk.ax * mk.w, y: muldeY, scale: 0.4 }),
    ];
    for (const g of this.gaeste) k.rumpf.addChildAt(g, 0);
    this.kipper = k;
    tap(k, () => {
      ton('common/hupe', { abstand: 0.6 });
      for (const g of this.gaeste) freuen(this, g, { herzen: 3 });
    }, { sound: null, hitArea: new PIXI.Rectangle(-560, -900, 1040, 940) });
  }

  async fahrtUeberDieStrasse() {
    const m = this.mischer;
    const k = this.kipper;
    m.visible = true;
    k.visible = true;
    m.x = -1900;
    k.x = -2500;
    ton('common/motor', { abstand: 3, vol: 0.6 });
    this.after(1.4, () => ton('common/hupe', { abstand: 0.6 }));
    // (die Tiere jubeln, wenn der Kipper schon gut im Bild ist – sonst entstehen die Herzen am Rand)
    this.after(4.3, () => {
      ton('common/hupe', { abstand: 0.6 });
      for (const g of this.gaeste) freuen(this, g, { herzen: 3 });
    });
    this.tween(m, { x: 1950 }, 7.5, { ease: 'sineInOut' });
    await k.fahreZu(1950, 8.6, { ease: 'sineInOut' });
    m.visible = false;
    k.visible = false;
  }

  async neueDecke() {
    this.autoStrich = null;
    this.decke.fuelle();
    this.decke.sprite.alpha = 0;
    this.tween(this.decke.sprite, { alpha: 1 }, 1.6, { ease: 'sineInOut' });
    for (const q of this.striche) {
      this.tween(q.s, { alpha: 0 }, 1.2, { ease: 'sineInOut' }).then(() => {
        q.s.width = 0;
        q.s.alpha = 1;
        q.von = null;
        q.bis = null;
        q.fertig = false;
      });
    }
    // Walze kommt von links zurück
    const w = this.walze;
    w.position.set(-1750, 1300);
    w.scale.set(WALZE_S);
    ton('common/motor', { abstand: 3, vol: 0.5 });
    await this.tween(w, { x: -700 }, 2.2, {
      ease: 'quadOut',
      onUpdate: () => { this.trommel.rotation += 0.03; },
    });
    this.finger = null;
    this.ziel = null;
    this.phase = 'walzen';
  }

  // ---------------------------------------------------------------- Takt und Hinweise

  update(dt, t) {
    this.t = t;
    // Finger liegt still oder sein pointerup ging verloren: nach einer Weile gilt er als losgelassen
    if (this.finger !== null && (this.fingerRuht += dt) > FINGER_VERGESSEN) this.finger = null;
    this.wolken.update(dt);
    this.schmetterling.update(dt);
    this.bewegeWalze(dt);
    this.bewegeRolle(dt);
    this.kipper.update(dt);
    // der Mischer federt beim Fahren ganz leicht
    if (this.mischer.visible) this.mischerBild.y = Math.sin(t * 7) * 3;
  }

  hinweise() {
    if (this.phase === 'walzen') {
      // von der Walze zum nächsten Rest der Holperdecke
      const p = this.walzOrt();
      const d = this.decke;
      let best = null;
      let bestAbstand = Infinity;
      for (const z of d.zellen) {
        if (z.weg) continue;
        const a = Math.hypot(z.x + d.x - p.x, z.y + d.y - p.y);
        if (a < bestAbstand) { bestAbstand = a; best = z; }
      }
      if (!best) return [{ von: this.trommel, nach: { x: p.x < 0 ? p.x + 700 : p.x - 700, y: p.y } }];
      const nach = { x: best.x + d.x, y: clamp(best.y + d.y, 1150, 1360) };
      // liegt der Rest fast unter der Walze: ein Stück weiter hinüber zeigen (sonst sieht man keine Bewegung)
      if (bestAbstand < 250) nach.x += nach.x < p.x ? -250 : 250;
      nach.x = clamp(nach.x, -1000, 1000);
      return [{ von: this.trommel, nach }];
    }
    if (this.phase === 'malen') {
      const q = this.naechsterStrich();
      const ziel = q ? q.b : this.rolle.x + 700;
      return [{ von: this.rolle, nach: { x: clamp(ziel, -1000, 1000), y: LINIE_Y } }];
    }
    // Wechsel und Fahrt über die Straße: auf den Spatz, der still sitzt. Nicht auf Kipper oder Mischer – die Hand
    // merkt sich ihr Ziel beim Erscheinen und tippt dann auf die leere Straße hinter dem längst weitergefahrenen Auto.
    return [this.spatz.c];
  }

  /** Von der Szene in exit() gerufen: RenderTexture freigeben. */
  aufraeumen() {
    window.removeEventListener('pointermove', this._bewegt);
    window.removeEventListener('pointerup', this._los);
    window.removeEventListener('pointercancel', this._los);
    window.removeEventListener('blur', this._alleLos);
    this.decke?.zerstoere();
  }
}
