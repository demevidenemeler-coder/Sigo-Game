// Seite 2: der Einsatz.
// Das Feuerwehrauto kommt mit Blaulicht angefahren. In zwei, drei Fenstern sitzen kleine freundliche Flämmchen.
// Der Finger lenkt den Wasserstrahl (von der Düse im Bogen zum Finger); trifft er ein Flämmchen, wird es weich
// kleiner und geht zischend aus (Dampfwölkchen). Schon Antippen genügt (je Tipp ein Schwall), Halten und Ziehen
// geht auch. Alle aus → die Tür geht auf, der Hase schaut heraus und jubelt, danach schwebt ein Orden zum Auto
// und bleibt an der Tür, zuletzt der Sticker (gestaffelt, nie alles auf einmal).
// Danach sitzt eine Katze auf dem Ast: Leiter (liegt auf dem Dach) antippen → sie richtet sich weich auf bis zum
// Ast, die Katze klettert hinunter und freut sich. Kurze Pause, neue Runde mit anderen Fenstern.

import { sfx, voice, tap, Actor, fx, rand, shuffle, clamp, spr, stage, pointerCount, PIXI } from '../../engine/index.js';
import { Seite } from '../../gemeinsam/seiten.js';
import { belohne } from '../../gemeinsam/sticker.js';
import { FeuerAuto, freue, feuerSticker, LEITER_SPITZE } from './auto.js';
import { Wasserstrahl } from './strahl.js';
import { TonSchleife } from './schleife.js';
import { Vogel, Schmetterling, Wolken, tippStelle, entprellt } from './deko.js';

const AUTO_SKALA = 0.75;
const FLAMME_SKALA = 0.46;
const TREFFER = 165;          // so nah muss der Strahl an der Mitte eines Flämmchens sein
const LOESCHZEIT = 0.6;       // Sekunden Dauer-Wasser, bis ein Flämmchen aus ist (Halten)
const SCHWALL = 0.45;         // so viel löscht schon der erste Schwall eines einzelnen Fingerdrucks (Tippen)
const MIN_SPRITZEN = 0.5;     // so lange spritzt der Strahl mindestens – auch wenn nur kurz getippt wurde
const FINGER_RUHE = 3;        // Sekunden ganz ohne Bewegung des lenkenden Fingers: Strahl pausiert (Sicherheitsnetz)
const ORDEN_SKALA = 0.5;    // Orden an der Fahrertür (Faktor auf das Bild, im Auto)
// Türöffnung des Hauses im Hintergrund (Seiten-Koordinaten, aus dem Bild abgelesen): Rundbogen + gerade Seiten
const TUER = { links: 242, rechts: 450, bogenY: 908, unten: 1118 };

export class Einsatz extends Seite {
  static hg = 'feuerwehr/hg_einsatz';

  aufbau() {
    this.zustand = 'start';   // 'start' | 'feuer' | 'jubel' | 'katze' | 'leiter' | 'pause'
    this.runden = 0;
    this.zisch = entprellt(0.9);
    this.klack = entprellt(0.5);
    this.kicher = entprellt(2.5);
    this.spritz = entprellt(1.2);
    this.zeit = 0;
    this.wasserTon = new TonSchleife('common/wasserstrahl', { vol: 0.55 });

    this.wolken = new Wolken({
      parent: this.hinten,
      liste: [
        { tex: 'common/wolke1', x: -200, y: 150, scale: 0.26, v: 6 },
        { tex: 'common/wolke2', x: 1000, y: 260, scale: 0.3, v: 9 },
      ],
    });

    // Auto am Straßenrand links
    const a = this.punkt('auto', { x: -714, y: 1430 });
    this.autoPlatz = { x: a.x + 24, y: a.y + 10 };
    this.auto = new FeuerAuto({ x: this.autoPlatz.x, y: this.autoPlatz.y, scale: AUTO_SKALA, parent: this.welt, z: 10, fahrer: 'fuchs' });
    tap(this.auto.f.koerper, (e) => this.autoAngetippt(e), { sound: null, pad: 40 });
    // Leiter: großzügige Tippfläche um die liegende Leiter (lokale Bildpunkte, Leiter ist klein skaliert)
    tap(this.auto.leiter, () => this.leiterAngetippt(), {
      sound: null, squash: false, hitArea: new PIXI.Rectangle(-200, -420, 1250, 760),
    });

    this.baueFlammen();
    this.baueHaus();
    this.baueKatze();
    this.baueStrahl();

    this.vogel = new Vogel(this, {
      parent: this.welt,
      scale: 0.85,
      plaetze: [{ x: 478, y: 205 }, { x: 160, y: 300, flip: true }, { x: -330, y: 125 }],
    });
    this.falter = new Schmetterling(this, { x: 870, y: 930, parent: this.welt, farbe: 0xffd27a, weite: 110 });
    tippStelle(this.welt, -400, 380, 250, () => {
      sfx('common/rascheln', { vol: 0.6 });
      this.burst('blaetter', rand(-640, -300), 420, { count: 4 });
    }, { label: 'baumkrone', z: 2 });
  }

  // ---------------------------------------------------------------- Flammen

  baueFlammen() {
    const art = ['flamme1', 'flamme2', 'flamme3'];
    this.flammen = ['fenster1', 'fenster2', 'fenster3'].map((name, i) => {
      const p = this.punkt(name, { x: 342 + i * 260, y: 603 });
      const s = spr('feuerwehr/' + art[i], { x: p.x, y: p.y + 58, parent: this.welt, z: 20 });
      s.scale.set(0);
      s.visible = false;
      s.eventMode = 'none';
      return { s, mitte: { x: p.x, y: p.y }, an: false, leben: 1, groesse: 0, rauch: null, phase: rand(0, 6), dampf: 0 };
    });
  }

  flammeAn(f, verz) {
    f.an = true;
    f.leben = 1;
    f.s.visible = true;
    f.s.alpha = 0;
    f.groesse = 0;
    this.tween(f, { groesse: 1 }, 1.2, { ease: 'sineOut', delay: verz });
    this.tween(f.s, { alpha: 1 }, 0.8, { ease: 'sineInOut', delay: verz });
    this.after(verz + 0.6, () => this.rauchAn(f));
  }

  rauchAn(f) {
    if (!f.an || f.rauch || !this.aktiv) return;
    f.rauch = this.emitter('rauch', { x: f.mitte.x, y: f.mitte.y - 90, rate: 0.45, groesse: 0.75 });
  }

  rauchAus(f) {
    f.rauch?.stop();
    f.rauch = null;
  }

  flammeAus(f) {
    f.an = false;
    this.rauchAus(f);
    this.zisch('common/zisch', { vol: 0.8 });
    this.burst('rauch', f.mitte.x, f.mitte.y - 20, { count: 5, groesse: 0.9 });
    this.tween(f, { groesse: 0 }, 0.7, { ease: 'sineIn' });
    this.tween(f.s, { alpha: 0 }, 0.7, { ease: 'sineInOut' }).then(() => { if (!f.an) f.s.visible = false; });
    if (this.flammen.every((x) => !x.an) && this.zustand === 'feuer') this.alleAus();
  }

  runde() {
    this.zustand = 'feuer';
    this.runden++;
    const anzahl = this.runden === 1 ? 2 : (Math.random() < 0.5 ? 2 : 3);
    const wahl = shuffle(this.flammen.slice()).slice(0, anzahl);
    wahl.forEach((f, i) => this.flammeAn(f, 0.2 + i * 0.5));
  }

  // ---------------------------------------------------------------- Haus, Hase, Orden

  baueHaus() {
    // offene Tür: dunkle Türöffnung (liegt über der gemalten Tür, nur sichtbar, solange der Hase herausschaut)
    const { links, rechts, bogenY, unten } = TUER;
    const r = (rechts - links) / 2;
    const mx = links + r;
    const tor = (g, inset, farbe, alpha) => g
      .moveTo(links + inset, unten)
      .lineTo(links + inset, bogenY)
      .arc(mx, bogenY, r - inset, Math.PI, 0)
      .lineTo(rechts - inset, unten)
      .closePath()
      .fill({ color: farbe, alpha });
    const oeffnung = new PIXI.Graphics();
    tor(oeffnung, 0, 0x4a2c1c, 1);
    tor(oeffnung, 16, 0x6e4529, 0.6);
    oeffnung.rect(links + 6, unten - 40, rechts - links - 12, 40).fill({ color: 0x8a5a36, alpha: 0.55 });
    // die aufgeschwungene Tür als schmaler Streifen am rechten Rand
    oeffnung.roundRect(rechts - 34, bogenY - 70, 30, unten - bogenY + 66, 8).fill(0xb8692f);
    oeffnung.roundRect(rechts - 28, bogenY - 60, 6, unten - bogenY + 50, 3).fill({ color: 0x8c4a1e, alpha: 0.6 });
    oeffnung.zIndex = 21;
    oeffnung.alpha = 0;
    oeffnung.visible = false;
    oeffnung.eventMode = 'none';
    this.welt.addChild(oeffnung);
    this.oeffnung = oeffnung;

    this.hase = new Actor('hase', { x: mx + 4, y: unten + 2, scale: 0.3, parent: this.welt, z: 22 });
    this.hase.visible = false;
    this.hase.schatten.visible = false;
    this.hase.onTap(() => freue(this, this.hase, { herzen: 3 }), { pad: 50 });
    // Tür selbst: klopfen
    this.tuer = tippStelle(this.welt, mx, (bogenY + unten) / 2, 140, () => {
      if (this.hase.visible) return;
      this.klack('common/klack', { vol: 0.6 });
      this.after(0.25, () => sfx('common/klack', { vol: 0.5 }));
    }, { label: 'tuer', z: 3 });

    this.orden = spr('feuerwehr/stern_orden', { x: mx, y: 640, scale: 0, parent: this.vorn, z: 50 });
    this.orden.anchor.set(0.5, 0.08);
    this.orden.visible = false;
    this.orden.eventMode = 'none';
  }

  async tuerAuf() {
    const o = this.oeffnung;
    o.visible = true;
    sfx('common/klack', { vol: 0.5 });
    await this.tween(o, { alpha: 1 }, 0.5, { ease: 'sineInOut' });
  }

  async tuerZu() {
    const h = this.hase;
    if (h.visible) {
      await this.tween(h, { alpha: 0 }, 0.6, { ease: 'sineInOut' });
      h.visible = false;
    }
    await this.tween(this.oeffnung, { alpha: 0 }, 0.6, { ease: 'sineInOut' });
    this.oeffnung.visible = false;
  }

  // Alle aus: gestaffelt, damit nie mehr als zwei Dinge gleichzeitig auffallen und sich keine Töne stapeln –
  // erst der Hase mit Herzen, dann der Orden, wenn er am Auto hängt der Sticker.
  async alleAus() {
    this.zustand = 'jubel';
    await this.wait(0.8);
    await this.tuerAuf();
    const h = this.hase;
    h.visible = true;
    h.alpha = 0;
    h.pose('idle');
    this.tween(h, { alpha: 1 }, 0.4, { ease: 'sineInOut' });
    await h.hop(40);
    await freue(this, h, { herzen: 5 });
    await this.wait(0.6);
    await this.ordenZumAuto();
    freue(this, this.auto.fahrer, { herzen: 3, laut: false });
    await this.wait(0.7);
    belohne(this, feuerSticker('feuerwehr_feuerwehrauto'), 20, 560);
    await this.wait(2.8);
    this.katzeKommt();
  }

  // Orden erscheint über dem Hasen, schaukelt kurz und schwebt dann an die Fahrertür (bleibt dort)
  async ordenZumAuto() {
    const o = this.orden;
    const alt = this.ordenAmAuto;
    if (alt) {
      this.ordenAmAuto = null;
      this.tween(alt, { alpha: 0 }, 0.5, { ease: 'sineInOut' }).then(() => alt.destroy());
    }
    o.visible = true;
    o.alpha = 0;
    o.scale.set(0.2);
    o.rotation = 0;
    o.position.set(TUER.links + 104, 600);
    this.tween(o, { alpha: 1, y: 640 }, 0.6, { ease: 'sineOut' });
    await this.tween(o, { scale: 0.55 }, 0.6, { ease: 'backOut' });
    sfx('common/funkeln', { vol: 0.5 });
    await this.tween(o, { rotation: 0.08 }, 0.6, { ease: 'sineInOut', yoyo: true, repeat: 1 });
    // im weichen Bogen zur Tür des Autos (Ziel jedes Bild neu: das Auto federt oder fährt vielleicht gerade)
    const ziel = new PIXI.Point();
    const von = { x: o.x, y: o.y };
    const p = { t: 0 };
    const skalaZiel = ORDEN_SKALA * Math.abs(this.auto.f.worldTransform.a / this.vorn.worldTransform.a);
    this.tween(o, { scale: skalaZiel }, 1.4, { ease: 'sineInOut' });
    await this.tween(p, { t: 1 }, 1.4, {
      ease: 'sineInOut',
      onUpdate: () => {
        this.auto.punkt('orden', this.vorn, ziel);
        o.x = von.x + (ziel.x - von.x) * p.t;
        o.y = von.y + (ziel.y - von.y) * p.t - Math.sin(Math.PI * p.t) * 160;
      },
    });
    // an der Tür festmachen: eine Kopie hängt im Auto (fährt mit), der fliegende Orden verschwindet
    const am = spr('feuerwehr/stern_orden', { parent: this.auto.f.innen, z: 5 });
    am.anchor.set(0.5, 0.08);
    const l = this.auto.lokal('orden');
    am.position.set(l.x, l.y);
    am.scale.set(ORDEN_SKALA);
    am.eventMode = 'none';
    this.ordenAmAuto = am;
    o.visible = false;
    sfx('common/plopp', { vol: 0.5 });
    fx.pop(am, 0.15);
    this.burst('funkeln', ziel.x, ziel.y, { count: 4 });
  }

  // ---------------------------------------------------------------- Katze auf dem Ast

  baueKatze() {
    const ast = this.punkt('ast', { x: -854, y: 738 });
    this.ast = { x: ast.x + 10, y: ast.y + 14 };
    this.katze = new Actor('katze', { x: this.ast.x, y: this.ast.y, scale: 0.24, parent: this.welt, z: 25 });
    this.katze.visible = false;
    this.katze.schatten.visible = false;
    this.katze.onTap(() => {
      if (this.zustand === 'katze') {
        // die Katze ruft – und die Leiter kommt (Antippen der Katze ist genauso gut wie Antippen der Leiter)
        fx.wobble(this.katze);
        this.katze.sound();
        this.leiterAngetippt();
      } else freue(this, this.katze, { herzen: 3 });
    }, { pad: 70 });
  }

  katzeKommt() {
    const k = this.katze;
    k.stop();
    k.pose('idle');
    k.flip = false;
    k.position.set(this.ast.x - 30, this.ast.y);
    k.visible = true;
    k.alpha = 0;
    k.schatten.visible = false;
    this.tween(k, { alpha: 1 }, 0.5, { ease: 'sineInOut' });
    k.hopTo(this.ast.x, this.ast.y, { hoehe: 40, dauer: 0.5, staub: false }).then(() => k.sound());
    this.zustand = 'katze';
    this.katzeHinweis(1.5);
  }

  // Hinweise anmelden (der Kern sagt jeden höchstens einmal am Tag) – nur, solange die Seite zu sehen ist und das
  // Kind das noch nicht selbst getan hat; nurWenn wird noch einmal gefragt, wenn der Satz warten muss.
  spritzHinweis(verz) {
    this._hinweis?.kill();
    const passt = () => this.aktiv && this.zustand === 'feuer' && !this.gespritzt;
    this._hinweis = this.after(verz, () => { if (passt()) voice('feuerwehr_spritzen', { nurWenn: passt }); });
  }

  katzeHinweis(verz) {
    this._hinweis?.kill();
    const passt = () => this.aktiv && this.zustand === 'katze';
    this._hinweis = this.after(verz, () => { if (passt()) voice('feuerwehr_leiter', { nurWenn: passt }); });
  }

  autoAngetippt(e) {
    // e.x in Koordinaten des Rumpfs (= Körper-Bild relativ zum Anker): hintere Hälfte = Leiter
    if (e.x < -60 && e.y < -200) {
      this.leiterAngetippt();
      return;
    }
    this.auto.tatue(this, 3);
    fx.pop(this.auto.fahrer, 0.08);
  }

  leiterAngetippt() {
    // Während das Auto noch heranrollt, stimmen Winkel und Länge zum Ast nicht: erst nach der Ankunft aufrichten
    if (this.zustand === 'katze' && !this.ankunftLaeuft) this.leiterHoch();
    else if (this.zustand !== 'leiter') this.leiterWackelt();
  }

  // Leiter ruckelt kurz (es gibt gerade nichts zu holen)
  leiterWackelt() {
    if (this.zustand === 'leiter') return;
    this.klack('common/klack', { vol: 0.5 });
    const l = this.auto.leiter;
    this.tween(l, { rotation: -0.08 }, 0.15, { ease: 'sineOut' })
      .then((ok) => { if (ok) this.tween(l, { rotation: 0 }, 0.35, { ease: 'bounceOut' }); });
  }

  async leiterHoch() {
    this.zustand = 'leiter';
    const a = this.auto;
    const l = a.leiter;
    const fuss = a.punkt('leiter', this.welt);
    const ziel = { x: this.ast.x + 120, y: this.ast.y + 16 };
    const winkel = Math.atan2(ziel.y - fuss.y, ziel.x - fuss.x);
    const skala = Math.abs(a.f.worldTransform.a / this.welt.worldTransform.a);
    const laenge = Math.hypot(ziel.x - fuss.x, ziel.y - fuss.y) / skala / LEITER_SPITZE.x;
    const liegt = { rotation: 0, sx: l.scale.x };
    this.leiterLiegt = liegt;
    l.rotation = 0;
    sfx('common/kran', { vol: 0.55 });
    const p = { t: 0 };
    await this.tween(p, { t: 1 }, 2.6, {
      ease: 'sineInOut',
      onUpdate: () => {
        // erst aufrichten, dann ausfahren
        l.rotation = winkel * clamp(p.t / 0.6, 0, 1);
        l.scale.x = liegt.sx + (laenge - liegt.sx) * clamp((p.t - 0.4) / 0.6, 0, 1);
      },
    });
    await this.katzeKlettert();
  }

  // Punkt auf der Leiter (0 = Fuß, 1 = Spitze) in Seiten-Koordinaten (oben auf dem Holm)
  leiterPunkt(f) {
    return this.welt.toLocal(this.auto.leiter.toGlobal({ x: LEITER_SPITZE.x * f, y: -30 }));
  }

  // Wo der Anker der Katze stehen muss, damit ihr Körper (nicht nur der Bild-Anker) auf dem Punkt sitzt:
  // der Anker von katze_idle liegt links der Bildmitte (ax 0,368), gespiegelt wandert der Körper zur anderen Seite.
  // hopTo dreht die Katze in Sprungrichtung – darum die Blickrichtung nach dem Sprung vorhersagen.
  katzeAuf(p) {
    const k = this.katze;
    const t = k.sprite.texture;
    const mitte = (0.5 - k.sprite.anchor.x) * t.width * Math.abs(k.sprite.worldTransform.a / this.welt.worldTransform.a);
    const gespiegelt = Math.abs(p.x - k.x) > 5 ? p.x < k.x : k.flip;
    return { x: p.x - (gespiegelt ? -mitte : mitte), y: p.y };
  }

  async katzeKlettert() {
    const k = this.katze;
    // vom Ast auf die Leiterspitze, dann Sprosse für Sprosse hinunter
    for (const f of [0.95, 0.72, 0.5, 0.28]) {
      const p = this.katzeAuf(this.leiterPunkt(f));
      await k.hopTo(p.x, p.y, { hoehe: f > 0.9 ? 50 : 26, dauer: 0.5, staub: false });
      sfx('common/klack', { vol: 0.35 });
    }
    // vom Dach auf die Straße vor dem Auto
    const unten = { x: this.auto.f.x + 430, y: 1480 };
    k.schatten.visible = true;
    await k.hopTo(unten.x, unten.y, { hoehe: 150, dauer: 0.8 });
    k.lookAt(unten.x - 100);
    freue(this, k, { herzen: 6 });
    this.leiterRunter();
    await this.wait(2.4);
    // die Katze läuft zum Hasen und geht mit ihm ins Haus
    const tuerX = (TUER.links + TUER.rechts) / 2;
    await k.walkTo(tuerX - 60, 1300, { tempo: 380 });
    await k.hopTo(tuerX - 20, TUER.unten + 4, { hoehe: 50, dauer: 0.5, staub: false });
    k.schatten.visible = false;
    if (this.hase.visible) freue(this, this.hase, { herzen: 3, laut: false });
    this.zustand = 'pause';
    await this.wait(1.0);
    this.tween(k, { alpha: 0 }, 0.6, { ease: 'sineInOut' });
    await this.tuerZu();
    k.visible = false;
    k.alpha = 1;
    await this.wait(1.0);
    this.runde();
  }

  leiterRunter() {
    const l = this.auto.leiter;
    const liegt = this.leiterLiegt;
    sfx('common/kran', { vol: 0.45 });
    const von = { rotation: l.rotation, sx: l.scale.x };
    const p = { t: 0 };
    this.tween(p, { t: 1 }, 2.4, {
      ease: 'sineInOut',
      onUpdate: () => {
        l.scale.x = von.sx + (liegt.sx - von.sx) * clamp(p.t / 0.5, 0, 1);
        l.rotation = von.rotation * (1 - clamp((p.t - 0.35) / 0.65, 0, 1));
      },
    });
  }

  // ---------------------------------------------------------------- Wasserstrahl

  // Der Finger lenkt den Strahl. Ein kurzes Antippen genügt: Der Strahl spritzt dann mindestens MIN_SPRITZEN
  // Sekunden zum Fingerpunkt, und sobald er dort ankommt, löscht ein „Schwall" schon ein gutes Stück des
  // getroffenen Flämmchens (zwei, drei Tipps je Flamme). Festhalten und Ziehen löscht fortlaufend.
  // Bewegen und Loslassen hören direkt am Fenster zu (Pixis globalpointermove ist im Kern abgeschaltet, und Ziele
  // über dem Fänger würden ein pointermove am Fänger abfangen). Ein neuer Finger übernimmt immer – so kann ein
  // verlorener alter Finger (Systemgeste, Handballen, Fenster verliert den Fokus) den Strahl nie festhalten.
  baueStrahl() {
    this.strahl = new Wasserstrahl({ parent: this.welt, z: 35, dicke: 64 });
    this.spritzt = null;            // { id, ruhe } des Fingers, der gerade lenkt (null = kein Finger)
    this.ruhendeId = null;          // Finger, der zu lange stillstand: regt er sich wieder, lenkt er weiter
    this.zielPunkt = new PIXI.Point();   // wohin der Strahl soll (bleibt nach dem Loslassen stehen)
    this.duese = new PIXI.Point();
    this._g = new PIXI.Point();
    this.spritzBis = 0;             // bis zu dieser Seiten-Zeit spritzt es mindestens
    this.schwall = false;           // wartet ein Schwall eines Fingerdrucks darauf, anzukommen?
    this.schwallBis = 0;
    this.tropfenUhr = 0;
    // Fänger hinter allem: wo kein anderes Ding getroffen wird, lenkt der Finger den Strahl
    const f = new PIXI.Container({ label: 'strahlFaenger' });
    f.zIndex = -50;
    f.eventMode = 'static';
    f.hitArea = new PIXI.Rectangle(-1500, 0, 3000, 1600);
    this.welt.addChild(f);
    this.faenger = f;
    f.on('pointerdown', (e) => {
      if (!this.aktiv || this.ankunftLaeuft || this.szene.gleitet) return;
      this.welt.toLocal(e.global, undefined, this.zielPunkt);
      this.fingerLenkt(e.pointerId, true);
    });
    // Fenster-Hörer: angelegt in betreten(), abgebaut in verlassen() (läuft auch beim Verlassen der Szene)
    this._bewegt = (ev) => {
      if (!this.aktiv || this.welt.destroyed) return;
      const id = ev.pointerId;
      if (this.spritzt?.id !== id) {
        // ein Finger, der nur zu lange stillstand und noch aufliegt, lenkt weiter, sobald er sich regt
        if (id !== this.ruhendeId || !ev.buttons || this.ankunftLaeuft || this.szene.gleitet) return;
      }
      stage.app.renderer.events.mapPositionToPoint(this._g, ev.clientX, ev.clientY);
      this.welt.toLocal(this._g, undefined, this.zielPunkt);
      if (this.spritzt?.id === id) this.spritzt.ruhe = 0;
      else this.fingerLenkt(id, false);
    };
    this._los = (ev) => {
      if (ev.pointerId === this.ruhendeId) this.ruhendeId = null;
      if (this.spritzt && ev.pointerId === this.spritzt.id) this.spritzt = null;   // Strahl endet im Takt
    };
    this._alleLos = () => {
      this.spritzt = null;
      this.ruhendeId = null;
    };
    this._versteckt = () => { if (document.hidden) this._alleLos(); };
    this.lauschtAmFenster = false;
  }

  // Finger `id` lenkt ab jetzt den Strahl (ein neuer Finger übernimmt immer); `druck` = frisch aufgesetzt (Schwall)
  fingerLenkt(id, druck) {
    this.gespritzt = true;   // (für den Hinweis „Zeig mit dem Finger, wohin das Wasser spritzt")
    this.spritzt = { id, ruhe: 0 };
    this.ruhendeId = null;
    this.spritzBis = Math.max(this.spritzBis, this.zeit + MIN_SPRITZEN);
    if (druck) {
      this.schwall = true;
      this.schwallBis = this.zeit + 0.8;
    }
    if (!this.strahl.an) {
      this.auto.punkt('duese', this.welt, this.duese);
      this.strahl.start.x = this.duese.x;
      this.strahl.start.y = this.duese.y;
      this.strahl.setze(true);
      this.wasserTon.an();
      this.spritz('common/spritz', { vol: 0.35 });
    }
  }

  fensterLauschen(an) {
    if (an === this.lauschtAmFenster) return;
    this.lauschtAmFenster = an;
    const w = an ? window.addEventListener : window.removeEventListener;
    w.call(window, 'pointermove', this._bewegt, { passive: true });
    w.call(window, 'pointerup', this._los, { passive: true });
    w.call(window, 'pointercancel', this._los, { passive: true });
    w.call(window, 'blur', this._alleLos);
    (an ? document.addEventListener : document.removeEventListener).call(document, 'visibilitychange', this._versteckt);
  }

  spritzeAus() {
    this.spritzt = null;
    this.schwall = false;
    this.strahl.setze(false);
    this.wasserTon.aus();
  }

  // Sicherheitsnetz, falls doch einmal kein Loslassen ankommt: Liegt kein Finger mehr auf, endet das Lenken.
  // Steht der lenkende Finger lange ganz still, hört der Strahl auf – regt er sich wieder, spritzt es weiter.
  fingerNachsehen(dt) {
    const s = this.spritzt;
    if (!s) return;
    if (pointerCount() === 0) {
      this.spritzt = null;
      return;
    }
    s.ruhe += dt;
    if (s.ruhe > FINGER_RUHE) {
      this.ruhendeId = s.id;
      this.spritzt = null;
    }
  }

  // Ein Flämmchen bekommt Wasser ab: dt Sekunden Dauerstrahl, dazu evtl. der Schwall eines Fingerdrucks
  wasserAuf(f, dt, schwall) {
    f.leben -= dt / LOESCHZEIT + (schwall ? SCHWALL : 0);
    f.dampf -= schwall ? 1 : dt;
    if (f.dampf <= 0) {
      f.dampf = 0.35;
      this.zisch('common/zisch', { vol: 0.45 });
      this.burst('rauch', f.mitte.x + rand(-30, 30), f.mitte.y - 30, { count: schwall ? 2 : 1, groesse: 0.7 });
    }
    if (f.leben <= 0) this.flammeAus(f);
  }

  strahlTakt(dt) {
    const s = this.strahl;
    if (!s.sichtbar) return;
    this.auto.punkt('duese', this.welt, this.duese);
    s.start.x = this.duese.x;
    s.start.y = this.duese.y;
    if (s.an) {
      // Ziel folgt dem Finger weich (kein Zappeln); ganz am Anfang springt es gleich hin
      const k = s.vorn < 0.1 ? 1 : 1 - Math.exp(-dt * 14);
      s.ziel.x += (this.zielPunkt.x - s.ziel.x) * k;
      s.ziel.y += (this.zielPunkt.y - s.ziel.y) * k;
      // Finger weg und Mindestzeit um: Strahl aus
      if (!this.spritzt && this.zeit >= this.spritzBis) {
        this.spritzeAus();
      }
    }
    s.update(dt);
    if (!s.trifft) return;
    this.tropfenUhr -= dt;
    if (this.tropfenUhr <= 0) {
      this.tropfenUhr = 0.3;
      this.burst('tropfen', s.ziel.x, s.ziel.y, { count: 2 });
    }
    // Schwall eines neuen Fingerdrucks: wirkt, sobald der Strahl am Fingerpunkt angekommen ist
    let schwall = false;
    if (this.schwall && (s.nahe(this.zielPunkt) || this.zeit > this.schwallBis)) {
      this.schwall = false;
      schwall = true;
    }
    for (const f of this.flammen) {
      if (!f.an || f.groesse < 0.6) continue;
      if (Math.hypot(s.ziel.x - f.mitte.x, s.ziel.y - (f.mitte.y + 10)) > TREFFER) continue;
      this.wasserAuf(f, dt, schwall);
    }
    // ein paar Spritzer auf den Hasen in der Tür: er kichert und hüpft
    const h = this.hase;
    if (h.visible && h.alpha > 0.9 && Math.hypot(s.ziel.x - h.x, s.ziel.y - (h.y - 150)) < 150) {
      if (this.kicher('common/platsch', { vol: 0.4 })) freue(this, h, { herzen: 2 });
    }
  }

  // ---------------------------------------------------------------- Ablauf

  async ankunft() {
    this.ankunftLaeuft = true;
    const a = this.auto;
    a.f.position.set(-1800, this.autoPlatz.y);
    a.tatue(this, 3.4);
    await a.fahre(this, { x: this.autoPlatz.x }, 2.6, 'sineOut');
    this.ankunftLaeuft = false;
  }

  betreten() {
    this.fensterLauschen(true);
    const kommt = this.besuche === 1 || this.szene.autoKommt;
    this.szene.autoKommt = false;
    if (kommt && this.zustand !== 'leiter') {
      this.ankunft().then(() => {
        if (this.zustand === 'start') {
          this.runde();
          // erst kurz nach dem Aufflammen: Spritzt das Kind gleich los, braucht es den Hinweis nicht
          if (this.aktiv) this.spritzHinweis(2.5);
        }
      });
    } else if (this.zustand === 'start') {
      this.runde();
    }
    // bei jedem Betreten anbieten, was gerade zu tun ist (nicht während das Auto noch heranrollt)
    if (!this.ankunftLaeuft) {
      if (this.zustand === 'feuer') this.spritzHinweis(2.5);
      else if (this.zustand === 'katze') this.katzeHinweis(1.5);
    }
    for (const f of this.flammen) if (f.an) this.rauchAn(f);
  }

  verlassen() {
    this._hinweis?.kill();
    this._hinweis = null;
    this.fensterLauschen(false);
    this.ruhendeId = null;
    this.spritzeAus();
    this.wasserTon.weg();
    for (const f of this.flammen) this.rauchAus(f);
  }

  update(dt) {
    this.zeit += dt;
    this.auto.update(dt);
    this.wolken.update(dt);
    this.vogel.update(dt);
    this.falter.update(dt);
    // Flämmchen wiegen sich sanft
    for (const f of this.flammen) {
      if (!f.s.visible) continue;
      f.phase += dt;
      const g = FLAMME_SKALA * f.groesse * (0.55 + 0.45 * clamp(f.leben, 0, 1));
      f.s.scale.set(g * (1 - 0.03 * Math.sin(f.phase * 2.1)), g * (1 + 0.05 * Math.sin(f.phase * 2.1)));
      f.s.skew.x = Math.sin(f.phase * 1.3) * 0.07;
    }
    this.fingerNachsehen(dt);
    this.strahlTakt(dt);
  }

  hinweise() {
    if (this.zustand === 'feuer') return this.flammen.filter((f) => f.an && f.groesse > 0.5).map((f) => f.s);
    if (this.zustand === 'katze') return [this.auto.leiter, this.katze];
    if (this.zustand === 'leiter') return [this.katze];
    if (this.zustand === 'pause') return this.hase.visible ? [this.hase] : [this.auto.f.koerper];
    // 'start' (das Auto rollt gerade an) und 'jubel': aufs Auto zeigen, nie zum Pfeil der nächsten Seite
    return [this.auto.f.koerper];
  }
}
