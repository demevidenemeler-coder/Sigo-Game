// Kleine lebendige Nebensachen im Atelier (auf jeder Seite gleich, weil alle Seiten vor hg_atelier spielen):
//   - zwei Wölkchen ziehen langsam hinter der rechten oberen Fensterscheibe vorbei
//   - ab und zu fliegt ein kleiner Vogel durchs Fenster (Fenster antippen: er kommt gleich, piept leise)
//   - ein Schmetterling flattert ruhig um die Blumen am Fenster (Blumen antippen: er setzt sich darauf)
//   - eine Katze schläft vor dem Regal (antippen: wacht auf, miaut, freut sich, schläft wieder ein)
//   - das Farbregal rechts klingt beim Antippen (leise Glöckchen-Töne)
// Alles ruhig: langsame Bewegungen, höchstens zwei auffällige gleichzeitig (Vogel und Schmetterling sind klein).

import { tex, note, sfx, tap, Actor, fx, rand, pick, clamp, PIXI } from '../../engine/index.js';

// Hintergrund hg_atelier ist 2829 breit → Bildpunkt x minus 1414,5 = Szenen-x (y gleich)
const BX = (x) => x - 1414.5;

// rechte obere Fensterscheibe (Bildpunkte, mit Bogen oben rechts)
const SCHEIBE = [
  [232, 102], [272, 98], [322, 116], [372, 148], [412, 194], [440, 250], [455, 312], [455, 436], [232, 436],
];
const BLUMEN = { x: BX(185), y: 790 };      // Mitte des Blumenstraußes auf dem Hocker
const PENTA = [72, 74, 76, 79, 81, 84];      // passt immer zusammen

/** Deko für eine Seite bauen. → { update(dt), betreten(), verlassen(), schmetterling, katze } */
export function baueDeko(seite) {
  const welt = seite.welt;
  const d = { seite };

  // ---------------------------------------------------------------- Fenster: Wolken und Vogel
  const fenster = new PIXI.Container({ label: 'fenster' });
  fenster.zIndex = 1;
  fenster.eventMode = 'none';
  const maske = new PIXI.Graphics()
    .poly(SCHEIBE.flatMap(([x, y]) => [BX(x), y]))
    .fill(0xffffff);
  fenster.addChild(maske);
  fenster.mask = maske;
  welt.addChild(fenster);

  const wolken = [0, 1].map((i) => {
    const w = new PIXI.Sprite(tex(i ? 'common/wolke3' : 'common/wolke1'));
    w.anchor.set(0.5);
    w.scale.set(i ? 0.11 : 0.12);
    w.alpha = 0.92;
    w.position.set(BX(232) + (i ? 170 : 40), i ? 215 : 330);
    w._v = i ? 7 : 5; // Einheiten pro Sekunde – sehr gemächlich
    fenster.addChild(w);
    return w;
  });

  const vogel = zeichneVogel();
  vogel.visible = false;
  fenster.addChild(vogel);
  d.vogelFlug = null;
  d.vogelPause = rand(8, 16);

  const fliegeVogel = (piepen) => {
    if (d.vogelFlug) {
      if (piepen) piep();
      return;
    }
    const nachRechts = Math.random() < 0.6;
    const y = rand(250, 330);
    d.vogelFlug = { t: 0, dauer: 4.2, x0: nachRechts ? BX(215) : BX(475), x1: nachRechts ? BX(475) : BX(215), y };
    vogel.scale.set(nachRechts ? 1 : -1, 1);
    vogel.visible = true;
    if (piepen) seite.after(0.6, piep);
  };
  const piep = () => {
    if (d.piepRuhe > 0) return;
    d.piepRuhe = 0.8;
    note('floete', 91, { vol: 0.16 });
    seite.after(0.13, () => note('floete', 95, { vol: 0.14 }));
  };
  d.piepRuhe = 0;

  // Tippfläche Fenster (ohne die Ecke oben links und ohne den Pfeil)
  zone(welt, -1280, 270, 270, 410, () => {
    fliegeVogel(true);
  });

  // ---------------------------------------------------------------- Schmetterling
  const sm = zeichneSchmetterling(pick([[0xffb3d1, 0xff7fae], [0xffe07a, 0xffb93f], [0xa9d8ff, 0x6fb1f0]]));
  sm.position.set(BLUMEN.x + 60, BLUMEN.y - 160);
  sm.zIndex = 40;
  welt.addChild(sm);
  d.schmetterling = sm;
  d.sm = { ziel: null, ruhe: rand(2, 4), sitzt: false, phase: rand(0, 6), tempo: 55 };

  const linkerPfeil = seite.index > 0;
  const neuesZiel = (zuBlumen = false) => {
    const s = d.sm;
    if (linkerPfeil) {
      // Auf Seiten mit Pfeil links (Kreis um x −1105, y 800, Halbmesser 100) sitzt er nur auf dem linken Teil des
      // Straußes und fliegt links am Pfeil vorbei nach oben oder unten – nie dahinter
      if (zuBlumen || Math.random() < 0.35) {
        s.ziel = { x: -1252 + rand(-6, 6), y: 765 + rand(-15, 10), setzen: true };
      } else {
        const oben = Math.random() < 0.5;
        s.ziel = { x: rand(-1255, -1215), y: oben ? rand(430, 640) : rand(960, 1100), setzen: false };
      }
    } else if (zuBlumen || Math.random() < 0.35) {
      s.ziel = { x: BLUMEN.x + rand(-70, 70), y: BLUMEN.y + rand(-50, 10), setzen: true };
    } else {
      s.ziel = { x: rand(-1255, -1130), y: rand(420, 1000), setzen: false };
    }
    s.sitzt = false;
  };
  neuesZiel(true);

  // Blumen, Vase und Hocker (unter dem Fenster; der Pfeil links und die Wunschblase des Besuchs liegen darüber und
  // haben Vorrang – über der Blase bleibt der Strauß selbst antippbar)
  zone(welt, -1280, 680, 270, 610, () => {
    neuesZiel(true);
    d.sm.tempo = 110;
    sfx('common/rascheln', { vol: 0.35 });
    seite.burst('funkeln', BLUMEN.x, BLUMEN.y, { count: 4 });
  });
  // der Schmetterling selbst: antippen → flattert auf
  tap(sm, () => {
    neuesZiel(false);
    d.sm.tempo = 120;
    note('glocke', pick(PENTA) + 12, { vol: 0.18 });
  }, { sound: null, squash: false, hitArea: new PIXI.Circle(0, 0, 92) });

  // ---------------------------------------------------------------- Katze vor dem Regal
  // rechts unter dem Pfeil auf dem Boden – über der freien Ecke unten rechts, neben dem Rahmen-Knopf
  const katze = new Actor('katze', { x: 1168, y: 1322, scale: 0.26, flip: true, parent: welt, z: 20 });
  katze.pose('sleep');
  d.katze = katze;
  d.katzeWach = 0;
  d.zzz = rand(2, 4);
  katze.onTap(() => {
    if (d.katzeWach <= 0) {
      katze.pose('idle');
      d.katzeWach = 6;
      katze.cheer();
    } else {
      d.katzeWach = Math.max(d.katzeWach, 4);
      fx.wobble(katze, 0.05);
      katze.sound();
    }
  }, { pad: 18 });

  // ---------------------------------------------------------------- Farbregal rechts (klingt)
  const regal = (e) => {
    if (d.regalRuhe > 0) return;
    d.regalRuhe = 0.18;
    note('glocke', pick(PENTA), { vol: 0.22 });
    seite.burst('funkeln', e.x, e.y, { count: 2 });
  };
  zone(welt, 1010, 270, 270, 410, regal);   // obere Fächer (über dem Pfeil)
  zone(welt, 1010, 925, 270, 205, regal);   // unteres Fach mit Rollen und Korb (unter dem Pfeil, über der Katze)
  d.regalRuhe = 0;

  // ---------------------------------------------------------------- jedes Bild
  d.update = (dt, t) => {
    // Wolken: langsam nach rechts, hinten wieder herein
    for (const w of wolken) {
      w.x += w._v * dt;
      if (w.x > BX(455) + 70) w.x = BX(232) - 70;
    }
    // Vogel
    d.piepRuhe -= dt;
    d.regalRuhe -= dt;
    if (d.vogelFlug) {
      const f = d.vogelFlug;
      f.t += dt;
      const k = clamp(f.t / f.dauer, 0, 1);
      vogel.x = f.x0 + (f.x1 - f.x0) * k;
      vogel.y = f.y + Math.sin(k * Math.PI * 3) * 12;
      vogel.fluegel.scale.y = 0.45 + 0.55 * Math.abs(Math.sin(t * 9));
      if (k >= 1) {
        d.vogelFlug = null;
        vogel.visible = false;
        d.vogelPause = rand(18, 30);
      }
    } else {
      d.vogelPause -= dt;
      if (d.vogelPause <= 0) fliegeVogel(false);
    }
    // Schmetterling: ruhig auf ein Ziel zu, leicht schwankend; auf den Blumen ruht er und klappt langsam
    const s = d.sm;
    s.phase += dt;
    const flatter = s.sitzt ? 1.4 : 7.5;
    const k = Math.abs(Math.cos(s.phase * flatter));
    sm.fluegelL.scale.x = 0.3 + 0.7 * k;
    sm.fluegelR.scale.x = 0.3 + 0.7 * k;
    if (s.sitzt) {
      s.ruhe -= dt;
      if (s.ruhe <= 0) neuesZiel(false);
    } else if (s.ziel) {
      const dx = s.ziel.x - sm.x;
      const dy = s.ziel.y - sm.y;
      const ab = Math.hypot(dx, dy);
      s.tempo += (55 - s.tempo) * Math.min(1, dt * 0.6);
      if (ab < 6) {
        if (s.ziel.setzen) {
          s.sitzt = true;
          s.ruhe = rand(4, 8);
        } else {
          neuesZiel();
        }
      } else {
        const v = Math.min(ab, s.tempo * dt);
        sm.x += (dx / ab) * v;
        sm.y += (dy / ab) * v + Math.sin(s.phase * 2.3) * 14 * dt;
        sm.rotation = clamp(dx / 400, -0.25, 0.25);
      }
    }
    // Katze: schläft wieder ein; im Schlaf ab und zu ein leises Z
    if (d.katzeWach > 0) {
      d.katzeWach -= dt;
      if (d.katzeWach <= 0) katze.pose('sleep');
    } else if (seite.aktiv) {
      d.zzz -= dt;
      if (d.zzz <= 0) {
        d.zzz = rand(4.5, 6.5);
        seite.burst('zzz', katze.x - 60, katze.y - 150, { count: 1 });
      }
    }
  };

  return d;
}

// unsichtbare Tippfläche (Szenen-Koordinaten links oben + Größe)
function zone(welt, x, y, w, h, fn) {
  const z = new PIXI.Container({ label: 'zone' });
  z.zIndex = 0;
  welt.addChild(z);
  tap(z, fn, { sound: null, squash: false, hitArea: new PIXI.Rectangle(x, y, w, h) });
  return z;
}

// ---------------------------------------------------------------- gezeichnete Tierchen (weiche runde Formen)

function zeichneVogel() {
  const v = new PIXI.Container({ label: 'vogel' });
  const koerper = new PIXI.Graphics()
    .ellipse(0, 0, 22, 17).fill(0x5fa8e8)
    .ellipse(4, 6, 13, 9).fill(0xcfe8ff)
    .circle(15, -9, 12).fill(0x5fa8e8)
    .circle(19, -11, 3.2).fill(0x2a2a3a)
    .circle(20, -12, 1.1).fill(0xffffff)
    .poly([26, -8, 36, -5, 26, -2]).fill(0xffb347)
    .poly([-20, -2, -34, -10, -32, 4]).fill(0x4a8fd0);
  const fluegel = new PIXI.Graphics().ellipse(0, -8, 15, 11).fill(0x3f86cc);
  fluegel.position.set(-2, -4);
  v.addChild(koerper, fluegel);
  v.fluegel = fluegel;
  return v;
}

function zeichneSchmetterling([hell, dunkel]) {
  const s = new PIXI.Container({ label: 'schmetterling' });
  const fluegel = (seite) => {
    const g = new PIXI.Graphics()
      .ellipse(seite * 26, -16, 28, 24).fill(hell).stroke({ width: 3, color: dunkel, alpha: 0.8 })
      .ellipse(seite * 20, 16, 19, 16).fill(hell).stroke({ width: 3, color: dunkel, alpha: 0.8 })
      .circle(seite * 30, -18, 8).fill({ color: dunkel, alpha: 0.85 })
      .circle(seite * 20, 17, 5).fill({ color: 0xffffff, alpha: 0.8 });
    return g;
  };
  s.fluegelL = fluegel(-1);
  s.fluegelR = fluegel(1);
  const koerper = new PIXI.Graphics()
    .roundRect(-5, -22, 10, 46, 5).fill(0x6b4a3a)
    .circle(0, -26, 7).fill(0x6b4a3a)
    .moveTo(-2, -31).quadraticCurveTo(-10, -46, -15, -48).stroke({ width: 2.5, color: 0x6b4a3a })
    .moveTo(2, -31).quadraticCurveTo(10, -46, 15, -48).stroke({ width: 2.5, color: 0x6b4a3a })
    .circle(-15, -48, 3).fill(0x6b4a3a)
    .circle(15, -48, 3).fill(0x6b4a3a);
  s.addChild(s.fluegelL, s.fluegelR, koerper);
  s.scale.set(1.15);
  return s;
}
