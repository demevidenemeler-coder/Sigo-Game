// Seite 2: Die Blumenwiese.
// Sieben geschlossene Blumen. Antippen → sie öffnet sich weich und klingt (jede Blume ein Ton der Fünftonleiter,
// von links tief nach rechts hoch); nochmal tippen → sie wiegt sich und klingt wieder. Schmetterlinge und die Biene
// fliegen ruhig zu offenen Blumen; antippen → sie flattern auf. Sind alle offen: ein Regenbogen erscheint weich,
// die Töne erklingen nacheinander, Sticker; danach schließen sich die Blumen langsam nacheinander.

import { tap, sfx, voice, note, fx, spr, rand, pick, killTweensOf, PIXI } from '../../engine/index.js';
import { Seite } from '../../gemeinsam/seiten.js';
import { belohne } from '../../gemeinsam/sticker.js';
import { Flieger, wolken } from './helfer.js';

// von links nach rechts: Farbe und Ton (C-Dur-Fünftonleiter: C D E G A C D)
const FARBEN = ['rot', 'orange', 'gelb', 'weiss', 'blau', 'lila', 'rosa'];
const TÖNE = [72, 74, 76, 79, 81, 84, 86];
const HÖHE_HINTEN = 370;   // Blumen der hinteren Reihe (kleiner, weiter weg)
const HÖHE_VORN = 450;     // Blumen der vorderen Reihe
const FLIEGER_Z = 1600;    // Schmetterlinge und Biene liegen über beiden Blumenreihen (sitzen sichtbar auf der Blüte)
const HÖCHSTENS_IN_DER_LUFT = 2;   // Ruhe-Regel: höchstens zwei fliegen gleichzeitig, die anderen sitzen
// Plätze im Gras zwischen den Blumen, auf denen ein Flieger ausruhen kann
const GRAS = [[-1000, 1270], [-160, 1060], [430, 1010], [1000, 1260], [290, 1440], [-820, 1450]];

export class Wiese extends Seite {
  static hg = 'garten/hg_wiese';

  aufbau() {
    this.feier = false;
    this.baueBlumen();

    // Regenbogen (erst unsichtbar) hinter allem, aber vor dem Himmel
    this.regenbogen = spr('common/regenbogen', { anchor: 0.5, x: 0, y: 470, parent: this.hinten, z: -950 });
    this.regenbogen.scale.set(1.3);
    this.regenbogen.alpha = 0;
    this.regenbogen.visible = false;

    this.wolken = wolken(this.hinten, [
      { id: 'common/wolke3', x: -620, y: 250, breite: 230, tempo: 7 },
      { id: 'common/wolke2', x: 420, y: 215, breite: 360, tempo: 5 },
    ]);

    // Flieger: drei Schmetterlinge und die Biene – über den Blumen, damit man sie auf den Blüten sieht
    const wähle = (f) => this.blumenZiel(f);
    const z = FLIEGER_Z;
    this.gras = GRAS.map(([x, y]) => ({ x, y, gras: true }));
    this.flieger = [
      new Flieger(this, 'garten/schmetterling_blau', { x: -700, y: 500, maß: 130, tempo: 85, z, wähleZiel: wähle }),
      new Flieger(this, 'garten/schmetterling_gelb', { x: 200, y: 420, maß: 120, tempo: 80, z, wähleZiel: wähle }),
      new Flieger(this, 'garten/schmetterling_rosa', { x: 800, y: 560, maß: 125, tempo: 80, z, wähleZiel: wähle }),
      new Flieger(this, 'garten/biene', { x: -100, y: 650, maß: 120, art: 'biene', tempo: 75, z, wähleZiel: wähle }),
    ];
    // Zu Beginn ruhen zwei im Gras (Ruhe-Regel: höchstens zwei in der Luft)
    this.flieger[0].setzeSitzend(this.gras[0].x, this.gras[0].y, rand(4, 7), this.gras[0]);
    this.flieger[3].setzeSitzend(this.gras[2].x, this.gras[2].y, rand(7, 10), this.gras[2]);
  }

  betreten() {
    // Hinweis kurz nach dem Hereingleiten anbieten (der Kern sagt ihn höchstens einmal am Tag) – nur, wenn das Kind
    // auf dieser Seite noch keine Blume angetippt hat, noch eine geschlossen ist und die Seite noch zu sehen ist
    this.blumeHier = false;
    this._hinweis?.kill();
    const passt = () => this.aktiv && !this.blumeHier && this.blumen.some((b) => !b.offen);
    this._hinweis = this.after(2.5, () => { if (passt()) voice('garten_blumen', { nurWenn: passt }); });
  }

  verlassen() {
    this._hinweis?.kill();
    this._hinweis = null;
  }

  // ---------------------------------------------------------------- Blumen

  baueBlumen() {
    const ersatz = [[-814, 1130], [-264, 1130], [286, 1130], [836, 1130], [-544, 1420], [6, 1420], [556, 1420]];
    const punkte = ersatz.map(([x, y], i) => this.punkt('blume' + (i + 1), { x, y }));
    punkte.sort((a, b) => a.x - b.x);
    this.blumen = punkte.map((p, i) => {
      const vorn = p.y > 1300;
      const höhe = vorn ? HÖHE_VORN : HÖHE_HINTEN;
      const c = new PIXI.Container({ label: 'blume:' + FARBEN[i] });
      c.position.set(p.x, p.y);
      c.zIndex = Math.round(p.y);
      const zu = spr(`garten/blume_${FARBEN[i]}_zu`, { parent: c });
      const auf = spr(`garten/blume_${FARBEN[i]}_auf`, { parent: c });
      const s = höhe / 420;
      zu.scale.set(s);
      auf.scale.set(s);
      auf.alpha = 0;
      // weicher Schatten am Boden
      const schatten = new PIXI.Graphics().ellipse(0, 0, 70 * s, 16 * s).fill({ color: 0x2d4a14, alpha: 0.18 });
      c.addChildAt(schatten, 0);
      this.welt.addChild(c);
      const blume = {
        i, c, zu, auf, s, höhe, offen: false, ton: TÖNE[i], phase: rand(0, 6), wiegt: false,
        kopf: { x: p.x, y: p.y - höhe * 0.82 },
      };
      tap(c, () => this.tippeBlume(blume), {
        sound: null, squash: false, hitArea: new PIXI.Rectangle(-150, -höhe - 30, 300, höhe + 60),
      });
      return blume;
    });
  }

  tippeBlume(b) {
    this.blumeHier = true;
    if (!b.offen) this.öffne(b);
    else this.wiege(b);
  }

  klinge(b) {
    note('xylo', b.ton, { vol: 0.75 });
    this.burst('noten', b.kopf.x, b.kopf.y - 60, { count: 1 });
  }

  öffne(b) {
    b.offen = true;
    killTweensOf(b.zu, ['alpha']);
    killTweensOf(b.auf, ['alpha']);
    // Die offene Blüte liegt oben: erst sie einblenden, dann die Knospe darunter ausblenden –
    // so scheint unterwegs nie die Wiese durch die Blume.
    this.tween(b.auf, { alpha: 1 }, 0.7, { ease: 'sineInOut' });
    this.tween(b.zu, { alpha: 0 }, 0.35, { ease: 'sineInOut', delay: 0.55 });
    fx.pop(b.c, 0.08);
    this.klinge(b);
    if (!this.feier && this.blumen.every((x) => x.offen)) this.feiern();
  }

  wiege(b) {
    this.klinge(b);
    if (b.wiegt) return;
    b.wiegt = true;
    const proxy = { p: 0 };
    this.tween(proxy, { p: 1 }, 1.6, {
      ease: 'linear',
      onUpdate: () => { b.c.rotation = Math.sin(proxy.p * Math.PI * 3) * 0.1 * (1 - proxy.p); },
    }).then(() => {
      b.c.rotation = 0;
      b.wiegt = false;
    });
  }

  schließe(b) {
    b.offen = false;
    killTweensOf(b.zu, ['alpha']);
    killTweensOf(b.auf, ['alpha']);
    this.tween(b.zu, { alpha: 1 }, 0.5, { ease: 'sineInOut' });
    this.tween(b.auf, { alpha: 0 }, 1.2, { ease: 'sineInOut', delay: 0.3 });
  }

  async feiern() {
    this.feier = true;
    await this.wait(0.9);
    // Regenbogen erscheint weich, die Blumen singen ihre Töne nacheinander
    const rb = this.regenbogen;
    rb.visible = true;
    killTweensOf(rb, ['alpha']);
    this.tween(rb, { alpha: 0.95 }, 2.5, { ease: 'sineInOut' });
    this.blumen.forEach((b, i) => this.after(0.4 + i * 0.28, () => {
      note('glocke', b.ton, { vol: 0.35 });
      fx.pop(b.c, 0.05);
    }));
    await this.wait(2.8);
    await belohne(this, 'garten_blume', 0, 560);
    await this.wait(4);
    // Die Blumen schließen sich langsam nacheinander
    for (const b of this.blumen) {
      if (b.offen) this.schließe(b);
      await this.wait(0.9);
    }
    this.tween(rb, { alpha: 0 }, 3, { ease: 'sineInOut' }).then(() => { if (rb.alpha < 0.01) rb.visible = false; });
    await this.wait(2);
    this.feier = false;
    // Hat das Kind inzwischen alle wieder geöffnet? Dann gleich noch einmal
    if (this.blumen.every((x) => x.offen)) this.feiern();
  }

  // Ziel für Schmetterlinge/Biene: eine offene Blume, auf der noch niemand sitzt – sonst ein Stück Himmel.
  // Sind schon zwei andere in der Luft, fliegt dieses nur zu einem nahen Sitzplatz (Blume oder Gras) und ruht dort.
  blumenZiel(f) {
    const besetzt = (d) => this.flieger?.some((o) => o !== f && o.ding === d);
    const frei = this.blumen.filter((b) => b.offen && !besetzt(b));
    const inDerLuft = (this.flieger || []).filter((o) => o !== f && o.fliegt).length;
    const aufBlume = (b) => ({ x: b.kopf.x + rand(-10, 10), y: b.kopf.y - 22, sitzen: true, dauer: rand(5, 9), ding: b });
    if (inDerLuft >= HÖCHSTENS_IN_DER_LUFT) {
      if (frei.length && Math.random() < 0.7) return aufBlume(this.nächstes(frei, f));
      const gras = this.nächstes(this.gras.filter((g) => !besetzt(g)), f);
      if (gras) return { x: gras.x, y: gras.y, sitzen: true, dauer: rand(6, 10), ding: gras };
    }
    if (frei.length && Math.random() < 0.75) return aufBlume(pick(frei));
    if (Math.random() < 0.35) {
      const gras = pick(this.gras.filter((g) => !besetzt(g)));
      if (gras) return { x: gras.x, y: gras.y, sitzen: true, dauer: rand(4, 8), ding: gras };
    }
    return { x: rand(-950, 950), y: rand(380, 880), sitzen: false };
  }

  // das dem Flieger nächste Ding einer Liste (oder null)
  nächstes(liste, f) {
    let bestes = null;
    let d = Infinity;
    for (const o of liste) {
      const p = o.kopf || o;
      const e = Math.hypot(p.x - f.c.x, p.y - f.c.y);
      if (e < d) { d = e; bestes = o; }
    }
    return bestes;
  }

  // ---------------------------------------------------------------- Ablauf

  update(dt, t) {
    this.wolken.update(dt);
    for (const f of this.flieger) {
      // Blume wiegt sich: auffliegen; Blume hat sich geschlossen: ruhig weiter zum nächsten Platz
      const b = f.ding;
      if (b && !b.gras && f.sitzt > 0) {
        if (b.wiegt) f.aufflattern();
        else if (!b.offen) { f.sitzt = 0; f._neuesZiel(); }
      }
      // Ruhe-Regel: Wäre es gleich mit dem Sitzen fertig, während schon zwei fliegen, bleibt es noch ein wenig
      if (f.sitzt > 0 && f.sitzt <= dt * 1.5 &&
        this.flieger.filter((o) => o !== f && o.fliegt).length >= HÖCHSTENS_IN_DER_LUFT) {
        f.sitzt += rand(1.5, 3);
      }
      f.update(dt);
    }
    // Blumen wiegen sich ganz leicht im Wind
    for (const b of this.blumen) {
      const w = 0.02 * Math.sin(t * 0.9 + b.phase);
      b.zu.skew.x = w;
      b.auf.skew.x = w;
    }
  }

  hinweise() {
    const zu = this.blumen.filter((b) => !b.offen);
    if (zu.length) return zu.slice(0, 2).map((b) => b.c);
    return [this.flieger[0].c, this.blumen[3].c];
  }
}
