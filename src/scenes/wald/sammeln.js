// Seite 3 – Sammeln auf dem Waldboden.
// An acht Stellen wachsen Pilze, Beeren, Zapfen, Eicheln, Kastanien und bunte Blätter. Antippen → hüpft in den
// Sammelkorb auf dem Baumstumpf. Das Eichhörnchen kommt und wünscht sich Nüsse (Eichel/Kastanie in der
// Denkblase) – vom Boden oder aus dem Korb zu ihm ziehen → frisst, freut sich. Neues wächst weich nach.
// Wer in den Korb greift, holt ein Ding in voller Größe heraus (am liebsten die gewünschte Nuss); losgelassen ohne
// Ziel hüpft es wieder hinein. Specht am Baum antippen → klopft. Korb voll → Sticker, Hase und Igel holen sich
// etwas, der Korb ist wieder leer. Ein Blatt, das vom Baum segelt, kann man auch antippen – es fliegt in den Korb.

import { spr, tex, meta, sfx, voice, tap, drag, Actor, fx, rand, pick, shuffle, killTweensOf, PIXI } from '../../engine/index.js';
import { Seite } from '../../gemeinsam/seiten.js';
import { belohne } from '../../gemeinsam/sticker.js';
import { jubel, laut, geheZu, blase, tiefe, Schmetterling } from './deko.js';

const DINGE = ['pilz_rot', 'pilz_braun', 'himbeere', 'blaubeere_zweig', 'tannenzapfen', 'eichel', 'kastanie', 'blatt_bunt'];
const NUESSE = ['eichel', 'kastanie'];
const DING_HOEHE = 215;        // Höhe eines Fundstücks vorn (Einheiten)
// Größe je Sorte, damit Nüsse und Beeren nicht so groß wie Pilze wirken (Tippfläche bleibt dank pad ≥ 200)
const SORTE_GROESSE = { kastanie: 0.8, eichel: 0.88, himbeere: 0.85, tannenzapfen: 0.95 };
const KORB_SKALA = 0.62;
const KORB_VOLL = 6;
const IM_KORB = 0.5;           // Größe im Korb relativ zur Bodengröße
// Plätze im Korb (relativ zum Fußpunkt des Korbs): stecken hinter dem Korb, schauen oben heraus
const KORB_PLAETZE = [[-62, -150], [58, -152], [-5, -162], [-95, -138], [95, -140], [30, -170], [-40, -172], [5, -146]];
// Eichhörnchen: Schwanz bleibt im Kernbereich (x ≤ 1066), Füße über der freien Ecke unten rechts
const HOERNCHEN_ORT = { x: 930, y: 1320 };
const HOERNCHEN_HOEHE = 330;
// Gäste beim Ausleeren: hinter der Reihe der Fundplätze, in Lücken zwischen ihnen (nichts wird verdeckt)
const GAESTE = [{ art: 'hase', x: -150, y: 935 }, { art: 'igel', x: 445, y: 965 }];
const GAST_HOEHE = 250;
// Specht: links am Stamm des Baums rechts der Mitte (Bild: Krallen rechts → Stamm rechts vom Vogel)
const SPECHT = { x: 545, y: 430, hoehe: 290 };
// fund6 (785/1100) liegt sonst genau unter der Denkblase des Eichhörnchens – nach vorn auf die freie Wiese
// links vor das Eichhörnchen (ein Tipp bringt es trotzdem in den Korb, nicht zum Eichhörnchen)
const FUND_KORREKTUR = { fund6: { dx: -95, dy: 265 } };
// Bis zu dieser Strecke (Einheiten) gilt Berühren + Loslassen als Tipp (kleine Finger wackeln)
const TIPP_WEG = 90;
const RASCHEL_PAUSE = 700;     // ms
// Flüge im Bogen: höchstens so schnell (Einheiten/s) – vom Boden rechts bis zum Korb oben links dauert es dann gut 2 s
// statt 0,7 s, aus der Nähe etwa 1 s (Ruhe-Regel: nichts rast quer über das Bild)
const FLUG_SPITZE = 1300;
// So lange ruhig, bevor das Eichhörnchen seinen Wunsch zeigt bzw. die Stimme ihn sagt (Sekunden)
const RUHE_FUER_WUNSCH = 2.5;

export class Sammeln extends Seite {
  static hg = 'wald/hg_sammeln';

  aufbau() {
    this.orte = [1, 2, 3, 4, 5, 6, 7, 8].map((i) => {
      const p = this.punkt('fund' + i, { x: -800 + i * 200, y: 1150 });
      const k = FUND_KORREKTUR['fund' + i] || { dx: 0, dy: 0 };
      return { x: p.x + k.dx, y: p.y + k.dy };
    });
    this.funde = new Array(this.orte.length).fill(null);
    this.imKorb = [];
    this.leert = false;
    this.hoernchen = null;
    this.wunschBild = null;
    this.nussOffen = false;   // Satz „wald_nuss" kam ungelegen und wartet auf einen ruhigen Augenblick
    this.letztesRascheln = -1e9;

    // Korb auf dem Baumstumpf. Berühren = hineingreifen: ein Ding kommt heraus und hängt am Finger.
    const stumpf = this.punkt('stumpf', { x: -905, y: 590 });
    this.korb = spr('wald/sammelkorb', { x: stumpf.x + 10, y: stumpf.y + 35, scale: KORB_SKALA, parent: this.welt, z: 700 });
    tap(this.korb, (e) => this.korbGriff(e), { sound: null, squash: false, pad: 30 });

    // erste Fundstücke: von jeder Sorte höchstens eines, mindestens eine Nuss
    const start = shuffle(DINGE);
    if (!start.slice(0, this.orte.length).some((d) => NUESSE.includes(d))) start[0] = 'eichel';
    this.orte.forEach((_, i) => this.wachse(i, start[i % start.length], true));

    this.baueSpecht();
    this.schmetterling = new Schmetterling(this, {
      x: 300, y: 760, bereich: { x0: -350, x1: 800, y0: 620, y1: 900 }, parent: this.welt,
    });
    this.blatt = null;
    this.every(13, () => { if (this.aktiv) this.blattFaellt(); });
    this.every(17, () => { if (this.aktiv && Math.random() < 0.5) this.klopfen(true); });
    this.every(9, () => { if (this.aktiv) this.wuenschen(); });
  }

  betreten() {
    if (this.besuche === 1) voice('wald_sammeln');
    if (!this.hoernchen) this.after(2.5, () => { if (this.aktiv) this.hoernchenKommt(); });
  }

  raschel(vol) {
    const jetzt = performance.now();
    if (jetzt - this.letztesRascheln < RASCHEL_PAUSE) return;
    this.letztesRascheln = jetzt;
    sfx('common/rascheln', { vol });
  }

  // ---------------------------------------------------------------- Fundstücke

  wachse(i, art = null, sofort = false) {
    if (this.funde[i] && !this.funde[i].destroyed) return;
    const ort = this.orte[i];
    if (!art) {
      // Nüsse sollen immer da sein, wenn das Eichhörnchen welche möchte
      const nussDa = [...this.funde, ...this.imKorb].some((d) => d && !d.destroyed && NUESSE.includes(d.art));
      // sonst Abwechslung: möglichst etwas, das gerade nicht am Boden liegt
      const amBoden = new Set(this.funde.filter((d) => d && !d.destroyed).map((d) => d.art));
      const frisch = DINGE.filter((d) => !amBoden.has(d));
      art = !nussDa ? pick(NUESSE) : pick(frisch.length ? frisch : DINGE);
    }
    const f = tiefe(ort.y, { y0: 1050, y1: 1420, f0: 0.86, f1: 1.08 });
    const id = 'wald/' + art;
    const skala = (DING_HOEHE * f * (SORTE_GROESSE[art] ?? 1)) / Math.max(tex(id).width, tex(id).height, 1); // breite Dinge (Kastanie) nicht zu groß
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

  // Ein Ding greifbar machen (Fundstück am Boden oder heruntergesegeltes Blatt)
  machSammelbar(s, art, platz, skala) {
    s.art = art;
    s.platz = platz;          // Fundplatz (−1: kein Platz am Boden)
    s.ruheSkala = skala;      // Größe am Boden / am Finger
    s.inKorb = false;
    s.unterwegs = false;      // fliegt gerade oder hängt am Finger
    s.zieh = drag(s, {
      pad: 55,
      lift: 1.12,
      sound: null,            // eigener Ton in onStart – sonst klingt es beim Greifen UND beim Loslassen
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
    const h = this.hoernchen;
    if (h && !h.destroyed && h.da) {
      const m = h.point('mouth');
      liste.push({ id: 'hoernchen', x: m.x, y: m.y, radius: 300 });
    }
    return liste;
  }

  losgelassen(s, ziel, ctx) {
    ctx.erledigt = true; // wohin es geht, entscheidet allein diese Seite
    const weg = Math.hypot(ctx.x - ctx.startX, ctx.y - ctx.startY);
    // Erst den Tipp erkennen: Antippen bringt ein Ding immer in den Korb – auch wenn das Eichhörnchen daneben sitzt
    if (weg >= TIPP_WEG && ziel?.id === 'hoernchen') {
      this.fuettern(s);
      return;
    }
    if (s.inKorb) {
      this.zurueckInDenKorb(s);
      return;
    }
    if (weg < TIPP_WEG || ziel?.id === 'korb') {
      this.inDenKorb(s);
      return;
    }
    // irgendwo hingezogen: weich zurück an seinen Platz
    ctx.back(0.4).then(() => { if (!s.destroyed && !s.inKorb) s.unterwegs = false; });
  }

  // vor allem anderen fliegen – auch nachdem drag() seinen gemerkten zIndex zurückgesetzt hat
  nachVorn(s) {
    s.zIndex = 5000;
    this.after(0.55, () => { if (!s.destroyed && s.unterwegs) s.zIndex = 5000; });
  }

  async inDenKorb(s) {
    s.eventMode = 'none';
    s.unterwegs = true;
    killTweensOf(s, ['x', 'y', 'scale', 'scaleX', 'scaleY', 'alpha', 'rotation']);
    const platz = s.platz;
    if (platz >= 0) {
      this.funde[platz] = null;
      this.after(rand(2.5, 4.5), () => this.wachse(platz));
    }
    s.inKorb = true;
    this.nachVorn(s);
    const ziel = this.korbPlatz(this.imKorb.length);
    this.imKorb.push(s);
    sfx('common/hupf', { vol: 0.6 });
    if (s.rotation) this.tween(s, { rotation: 0 }, 0.6, { ease: 'sineInOut' });
    await this.bogen(s, ziel, { dauer: 0.7, hoehe: 260, skala: s.ruheSkala * IM_KORB });
    if (s.destroyed) return;
    this.imKorbAblegen(s);
    sfx('common/plopp', { vol: 0.5 });
    fx.pop(this.korb, 0.05);
    if (this.imKorb.length >= KORB_VOLL && !this.leert) this.korbVoll();
  }

  // Ein herausgenommenes Ding hüpft wieder an seinen Platz im Korb
  async zurueckInDenKorb(s) {
    s.unterwegs = true;
    killTweensOf(s, ['x', 'y', 'scale', 'scaleX', 'scaleY', 'alpha']);
    this.nachVorn(s);
    let i = this.imKorb.indexOf(s);
    if (i < 0) i = this.imKorb.push(s) - 1;
    sfx('common/hupf', { vol: 0.45 });
    await this.bogen(s, this.korbPlatz(i), { dauer: 0.6, hoehe: 180, skala: s.ruheSkala * IM_KORB });
    if (s.destroyed) return;
    this.imKorbAblegen(s);
    sfx('common/plopp', { vol: 0.4 });
    fx.pop(this.korb, 0.04);
  }

  // liegt jetzt im Korb: steckt hinter dem Korb; gegriffen wird es über den Korb (korbGriff)
  imKorbAblegen(s) {
    s.inKorb = true;
    s.unterwegs = false;
    s.eventMode = 'none';
    s.zIndex = this.korb.zIndex - 1;
    // drag() setzt seinen gemerkten zIndex kurz nach dem Loslassen zurück – danach noch einmal richtig legen
    this.after(0.6, () => { if (!s.destroyed && s.inKorb && !s.unterwegs) s.zIndex = this.korb.zIndex - 1; });
  }

  korbPlatz(n) {
    const [dx, dy] = KORB_PLAETZE[n % KORB_PLAETZE.length];
    return { x: this.korb.x + dx, y: this.korb.y + dy };
  }

  // Flugdauer: `min` Sekunden oder mehr – so lang, dass das Ding auf seinem Bogen (wie in bogen(), sineInOut) nirgends
  // schneller als FLUG_SPITZE Einheiten/s fliegt. Der Bogen nach oben macht die erste Hälfte eines Flugs nach oben
  // schneller als die zweite, darum wird die Geschwindigkeit entlang des ganzen Bogens geprüft.
  flugDauer(von, nach, min, hoehe = 0) {
    const dx = nach.x - von.x;
    const dy = nach.y - von.y;
    let spitze = 0; // größte Geschwindigkeit bei Flugdauer 1 s
    for (let i = 1; i < 32; i++) {
      const k = i / 32;
      const v = Math.hypot(dx, dy - hoehe * 4 * (1 - 2 * k)) * (Math.PI / 2) * Math.sin(Math.PI * k);
      if (v > spitze) spitze = v;
    }
    return Math.max(min, spitze / FLUG_SPITZE);
  }

  // Flug im Bogen nach `nach`; Größe gleitet zu `skala`. `dauer` ist die kürzeste Flugzeit, weite Flüge dauern länger.
  bogen(obj, nach, { dauer, hoehe, skala }) {
    const von = { x: obj.x, y: obj.y };
    const s0 = Math.abs(obj.scale.y);
    const p = { k: 0 };
    return this.tween(p, { k: 1 }, this.flugDauer(von, nach, dauer, hoehe), {
      ease: 'sineInOut',
      onUpdate: () => {
        if (obj.destroyed) return;
        const k = p.k;
        obj.x = von.x + (nach.x - von.x) * k;
        obj.y = von.y + (nach.y - von.y) * k - hoehe * 4 * k * (1 - k);
        obj.scale.set(s0 + (skala - s0) * k);
      },
    });
  }

  // Zielpunkt, damit die MITTE des Dings (Anker unten) am Maul des Tiers liegt
  amMaul(s, tier, skala) {
    const m = tier.point('mouth');
    return { x: m.x, y: m.y + s.texture.height * skala * 0.45 };
  }

  // In den Korb greifen: das passendste Ding kommt in voller Größe heraus und hängt sofort am Finger
  korbGriff(e) {
    this.raschel(0.35);
    fx.wobble(this.korb, 0.05);
    if (this.leert) return;
    const frei = this.imKorb.filter((d) => !d.destroyed && !d.unterwegs);
    if (!frei.length) return;
    const wunsch = this.wunschBild ? this.wunschBild.replace('wald/', '') : null;
    const d = (wunsch && frei.find((x) => x.art === wunsch)) ||
      (this.hoernchen?.da && frei.find((x) => NUESSE.includes(x.art))) ||
      frei[frei.length - 1];
    killTweensOf(d, ['x', 'y', 'scale', 'scaleX', 'scaleY', 'alpha']);
    d.scale.set(d.ruheSkala);
    d.position.set(e.x, e.y + d.texture.height * d.ruheSkala * 0.5); // Mitte des Dings unter dem Finger
    d.zIndex = 5000;
    sfx('common/plopp', { vol: 0.4 });
    // die Berührung an das Ding weiterreichen (wie bei der Leiste des Kerns)
    const g = this.welt.toGlobal({ x: e.x, y: e.y });
    d.emit('pointerdown', { pointerId: e.pointerId, global: new PIXI.Point(g.x, g.y), stopPropagation() {} });
    if (!d.zieh.isDragging()) this.zurueckInDenKorb(d); // hat nicht geklappt: gleich wieder hinein
  }

  // aus dem Korb nehmen (gefressen, verschenkt)
  ausDemKorb(s) {
    const i = this.imKorb.indexOf(s);
    if (i >= 0) this.imKorb.splice(i, 1);
    // übrige rutschen auf freie Plätze
    this.imKorb.forEach((d, n) => {
      if (d.destroyed || d.unterwegs) return;
      const p = this.korbPlatz(n);
      this.tween(d, { x: p.x, y: p.y }, 0.4, { ease: 'sineInOut' });
    });
  }

  // ---------------------------------------------------------------- Eichhörnchen

  async hoernchenKommt() {
    if (this.hoernchen) return;
    const h = new Actor('eichhoernchen', { x: 1500, y: HOERNCHEN_ORT.y, parent: this.welt, z: HOERNCHEN_ORT.y });
    h.scale.set(HOERNCHEN_HOEHE / 900);
    this.hoernchen = h;
    h.da = false;
    h.onTap(() => {
      if (h.isst) return;
      if (!h.da) { fx.wobble(h, 0.05); laut(h); return; } // kommt gerade: nur wackeln, weiterlaufen
      if (this.wunschBild) { fx.wobble(h, 0.05); laut(h); blase(h, this.wunschBild, 2.4); } else jubel(this, h);
    });
    // geheZu: kommt sicher an seinem Platz an, auch wenn unterwegs etwas dazwischenkommt
    const ok = await geheZu(this, h, HOERNCHEN_ORT.x, HOERNCHEN_ORT.y, { tempo: 320 });
    if (!ok || h.destroyed) return;
    h.da = true;
    h.flip = true; // schaut nach links zu den Fundstücken
    this.wuenschen(true);
  }

  wuenschen(sofort = false) {
    const h = this.hoernchen;
    if (!h || !h.da || h.isst || this.leert) return;
    if (!sofort && this.szene.idle < RUHE_FUER_WUNSCH) return; // nicht dazwischenreden, wenn gerade gespielt wird
    // was gerade da ist, zeigen
    const da = [...this.funde, ...this.imKorb].filter((d) => d && !d.destroyed && NUESSE.includes(d.art));
    this.wunschBild = 'wald/' + (da.length ? pick(da).art : pick(NUESSE));
    blase(h, this.wunschBild, 3);
    // der Satz kam beim letzten Mal ungelegen: beim nächsten ruhigen Wunsch noch einmal versuchen
    if (sofort || this.nussOffen) this.after(1.5, () => this.sageNuss());
  }

  // „Das Eichhörnchen hat Hunger …" nur, wenn das Kind gerade nichts tut (sonst widerspricht der Satz dem, was es
  // gerade tut) und die Seite noch zu sehen ist. Passt es nicht, bleibt der Satz offen (nussOffen) und kommt mit dem
  // nächsten ruhigen Wunsch. War er heute schon dran, fragt der Kern nurWenn() gar nicht erst – dann bleibt nichts offen.
  sageNuss() {
    this.nussOffen = false;
    voice('wald_nuss', {
      nurWenn: () => {
        const passt = this.nussPasst();
        if (!passt) this.nussOffen = true;
        return passt;
      },
    });
  }

  nussPasst() {
    const h = this.hoernchen;
    return this.aktiv && !this.szene.gleitet && !this.leert && !!h && !h.destroyed && h.da && !h.isst &&
      this.szene.idle >= RUHE_FUER_WUNSCH && !this.ziehtGerade();
  }

  // hängt gerade ein Ding dieser Seite am Finger?
  ziehtGerade() {
    return this.welt.children.some((c) => !c.destroyed && c.zieh?.isDragging?.());
  }

  // Ding wieder hinlegen, wo es herkam (Korb oder Fundplatz)
  async heim(s) {
    if (s.inKorb) return this.zurueckInDenKorb(s);
    const ort = this.orte[s.platz] || { x: s.x, y: s.y };
    await this.bogen(s, ort, { dauer: 0.6, hoehe: 160, skala: s.ruheSkala });
    if (s.destroyed) return;
    s.unterwegs = false;
    s.eventMode = 'static';
    s.zIndex = s.y;
  }

  async fuettern(s) {
    const h = this.hoernchen;
    s.eventMode = 'none';
    s.unterwegs = true;
    killTweensOf(s, ['x', 'y', 'scale', 'scaleX', 'scaleY', 'alpha']);
    this.nachVorn(s);   // vor dem Eichhörnchen fliegen (sonst verschwindet es hinter ihm)
    if (!h || h.destroyed || h.isst) {
      await this.heim(s);
      return;
    }
    h.isst = true;
    const klein = s.ruheSkala * 0.6;
    await this.bogen(s, this.amMaul(s, h, klein), { dauer: 0.45, hoehe: 70, skala: klein });
    if (s.destroyed || h.destroyed) return;
    h.pose('eat');
    sfx('common/mampf', { vol: 0.8 });
    if (NUESSE.includes(s.art)) {
      // lecker: Nuss verschwindet im Maul
      if (s.inKorb) this.ausDemKorb(s);
      else if (s.platz >= 0) {
        this.funde[s.platz] = null;
        const platz = s.platz;
        this.after(rand(2.5, 4), () => this.wachse(platz));
      }
      await this.tween(s, { scale: klein * 0.25, alpha: 0 }, 0.4, { ease: 'quadIn' });
      if (!s.destroyed) s.destroy();
      await this.wait(0.35);
      this.wunschBild = null;
      h.isst = false;
      await jubel(this, h, { herzen: 6 });
      this.after(3, () => this.wuenschen(true));
      return;
    }
    // keine Nuss: freundlich Kopf schütteln, das Ding hüpft zurück
    await this.wait(0.45);
    h.pose('idle');
    sfx('common/nein', { vol: 0.7 });
    h.shake();
    await this.wait(0.25);
    await this.heim(s);
    h.isst = false;
    // der Wunsch kann sich inzwischen erfüllt haben (wunschBild = null) – erst beim Zeigen nachsehen
    this.after(0.6, () => {
      if (this.wunschBild && !h.destroyed && !h.isst && !this.leert) blase(h, this.wunschBild, 2.4);
    });
  }

  // ---------------------------------------------------------------- Korb voll

  async korbVoll() {
    this.leert = true;
    await this.wait(0.6);
    belohne(this, pick(['wald_beeren', 'tier_eichhoernchen']), this.korb.x + 330, this.korb.y - 260);
    // Hase und Igel kommen schon, während der Sticker gezeigt wird
    const gaeste = GAESTE.map((g, i) => {
      const a = new Actor(g.art, { x: 1400 + i * 140, y: g.y, parent: this.welt, z: g.y });
      a.scale.set(GAST_HOEHE / 900);
      a.onTap(() => jubel(this, a));
      a.geht = true;
      a.ankunft = geheZu(this, a, g.x, g.y, { tempo: 420 }).then((ok) => {
        if (ok && !a.destroyed) a.lookAt(this.korb.x);
        return ok;
      });
      return a;
    });
    await Promise.race([Promise.all(gaeste.map((a) => a.ankunft)), this.wait(5)]);
    await this.wait(0.4);
    const hier = gaeste.filter((a) => !a.destroyed);
    // Was beim Leeren noch in den Korb hüpft, bekommen die Gäste auch: Sie gehen erst, wenn der Korb leer ist
    // (sonst bliebe er voll stehen, bis das Kind wieder etwas hineinlegt)
    for (;;) {
      // auf Dinge warten, die gerade noch in den Korb fliegen (nicht auf eines am Finger), höchstens 3 s
      for (let w = 0; w < 12 && this.imKorb.some((d) => !d.destroyed && d.unterwegs && !d.zieh?.isDragging()); w++) {
        await this.wait(0.25);
      }
      const gegessen = new Set();
      const fluege = await this.verteilen(hier, gegessen);
      if (!fluege.length) break;
      await Promise.all(fluege);
      await this.wait(0.5);
      // jedes Tier, das etwas bekommen hat, freut sich einmal – nacheinander, nie mehr als zwei hüpfen zugleich
      let k = 0;
      for (const tier of gegessen) {
        this.after(k++ * 0.75, () => jubel(this, tier, { herzen: 3 }));
      }
      await this.wait(0.75 * Math.max(0, k - 1) + 1.3);
    }
    // Gäste gehen wieder
    for (const a of hier) {
      if (a.destroyed) continue;
      geheZu(this, a, 1600, a.y, { tempo: 360 }).then((ok) => {
        if (a.destroyed) return;
        if (ok) a.destroy({ children: true });
        else this.tween(a, { alpha: 0 }, 0.6, { ease: 'sineInOut' }).then(() => { if (!a.destroyed) a.destroy({ children: true }); });
      });
      await this.wait(0.4);
    }
    this.wunschBild = null;
    this.leert = false;
    // Ist der Korb in den letzten Augenblicken schon wieder voll geworden, gleich noch einmal (beim Ablegen wird
    // nur geprüft, solange nicht geleert wird)
    if (this.imKorb.length >= KORB_VOLL) {
      this.korbVoll();
      return;
    }
    this.after(2, () => this.wuenschen(true));
  }

  // Den Korb an die Tiere verteilen: Nüsse zum Eichhörnchen, alles andere zu Hase und Igel. Nacheinander, ohne auf
  // jedes Ende zu warten – aber höchstens zwei Dinge fliegen zugleich. Nimmt auch, was währenddessen hineinkommt.
  // → Liste der Flüge (Promises; erfüllt, wenn das Ding gefressen ist)
  async verteilen(hier, gegessen) {
    const h = this.hoernchen;
    const fluege = [];
    let n = 0;
    for (;;) {
      const d = this.imKorb.find((x) => !x.destroyed && !x.unterwegs);
      if (!d) break;
      const nuss = NUESSE.includes(d.art) && h && !h.destroyed && h.da && !h.isst;
      const tier = nuss ? h : hier[n++ % Math.max(1, hier.length)];
      if (!tier || tier.destroyed) break; // niemand da: bleibt im Korb (nach dem Leeren wird neu geprüft)
      d.unterwegs = true;
      d.eventMode = 'none';
      this.ausDemKorb(d);
      d.zIndex = 5000;
      sfx('common/hupf', { vol: 0.45 });
      gegessen.add(tier);
      const s0 = Math.abs(d.scale.y);
      const ziel = this.amMaul(d, tier, s0);
      const dauer = this.flugDauer(d, ziel, 0.6, 220);
      fluege.push((async () => {
        await this.bogen(d, ziel, { dauer: 0.6, hoehe: 220, skala: s0 });
        if (d.destroyed) return;
        if (tier.destroyed) { d.destroy(); return; }
        tier.pose('eat');
        sfx('common/mampf', { vol: 0.6 });
        await this.tween(d, { scale: s0 * 0.15, alpha: 0 }, 0.35, { ease: 'quadIn' });
        if (!d.destroyed) d.destroy();
      })());
      await this.wait(Math.max(0.5, dauer * 0.55));
    }
    return fluege;
  }

  // ---------------------------------------------------------------- Specht

  baueSpecht() {
    const id = 'wald/specht';
    const t = tex(id);
    // Drehpunkt an den Krallen (rechts unten), damit er sich zum Stamm neigt
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
        const p = this.welt.toLocal(sp.toGlobal({ x: 35, y: -160 })); // Schnabelspitze
        this.burst('staub', p.x + 20, p.y, { count: 3 });
      }
      if (!(await this.tween(sp, { rotation: 0 }, 0.16, { ease: 'sineOut' }))) break;
    }
    sp.rotation = 0;
    this.klopft = false;
  }

  // ---------------------------------------------------------------- Blatt segelt herab

  // Ein buntes Blatt segelt vom Baum. Es ist ein echtes Blatt zum Sammeln: Antippen → es fliegt in den Korb.
  blattFaellt() {
    if (this.blatt && !this.blatt.destroyed) return;
    const x0 = rand(-500, 650);
    const skala = 0.3;
    const b = spr('wald/blatt_bunt', { anchor: 0.5, x: x0, y: -60, scale: skala, parent: this.welt, z: 4500 });
    this.blatt = b;
    b.weg = rand(0, 10);
    b.boden = rand(940, 1000); // landet hinter der Reihe der Fundstücke, nicht zwischen ihnen
    b.fang = tap(b, () => this.blattFangen(b), { sound: null, squash: false, hitArea: new PIXI.Circle(0, 0, 130 / skala) });
  }

  blattFangen(b) {
    if (b.destroyed || b.gefangen) return;
    b.gefangen = true;
    b.fang.off();
    this.blatt = null;
    killTweensOf(b, ['alpha']);
    b.alpha = 1;
    // Anker wie bei den Fundstücken (unten), ohne dass das Blatt springt
    const m = meta('wald/blatt_bunt');
    const ay = m?.ay ?? 0.986;
    const ax = m?.ax ?? 0.5;
    b.x += (ax - 0.5) * b.texture.width * b.scale.x;
    b.y += (ay - 0.5) * b.texture.height * b.scale.y;
    b.anchor.set(ax, ay);
    sfx('common/tipp', { vol: 0.6 });
    // im Korb und am Finger so groß wie ein Blatt vom Boden
    const t = tex('wald/blatt_bunt');
    this.machSammelbar(b, 'blatt_bunt', -1, (DING_HOEHE * 0.95) / Math.max(t.width, t.height, 1));
    this.inDenKorb(b);
  }

  // ---------------------------------------------------------------- Ablauf

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
        b.zIndex = b.y; // liegt jetzt am Boden: Fundstücke weiter vorn bleiben vor ihm (und werden zuerst getroffen)
        this.after(5, () => {
          if (!b.destroyed && !b.gefangen) {
            this.tween(b, { alpha: 0 }, 1, { ease: 'sineInOut' }).then((ok) => { if (ok && !b.destroyed && !b.gefangen) b.destroy(); });
          }
        });
      }
    }
    // gezogene Dinge kommen ohnehin nach vorn; liegende ordnen sich nach Tiefe
  }

  hinweise() {
    const h = this.hoernchen;
    const liste = [];
    if (h && h.da && !h.isst && !this.leert) {
      // lieber eine Nuss vom Boden (gut zu sehen); sonst eine aus dem Korb (Griff in den Korb holt sie heraus)
      const frei = (d) => d && !d.destroyed && NUESSE.includes(d.art) && !d.unterwegs;
      const nuss = this.funde.find((d) => frei(d) && d.eventMode !== 'none') || this.imKorb.find(frei);
      if (nuss) liste.push({ von: nuss, nach: h });
    }
    const boden = this.funde.filter((d) => d && !d.destroyed && d.eventMode !== 'none');
    if (boden.length) liste.push(boden[0]);
    liste.push(this.specht);
    return liste;
  }
}
