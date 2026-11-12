// Korb mit Inhalt: Das Bild liegt zweimal übereinander – hinten ganz, vorn nur der vordere Rand und der
// Bauch (Maske). Dazwischen liegt der Inhalt, so sieht es aus, als läge das Obst wirklich im Korb.

import { spr, meta, tap, fx, sfx, killTweensOf, PIXI } from '../../engine/index.js';

/**
 * bauKorb(seite, 'garten/korb_rot', {x, y, scale, z, rand}) → {c, inhalt, s, breite, höhe, oben, liste}
 * rand = Oberkante des vorderen Randes in Bildpunkten, von links nach rechts ([[x, y], …]).
 * (x, y) = Ort des Ankers aus pack.json. Antippen: Korb wackelt, der Inhalt hüpft ein wenig.
 */
export function bauKorb(seite, id, { x, y, scale, z = 60, rand, parent }) {
  const m = meta(id);
  const c = new PIXI.Container({ label: 'korb:' + id });
  c.position.set(x, y);
  c.zIndex = z;
  // Drehpunkt unten in der Mitte (Wackeln um den Boden)
  const unten = (1 - m.ay) * m.h * scale;
  c.pivot.set(0, unten);
  c.y += unten;

  const hinten = spr(id, { parent: c });
  hinten.scale.set(scale);
  const inhalt = new PIXI.Container({ label: 'inhalt' });
  c.addChild(inhalt);
  const vorn = spr(id, { parent: c });
  vorn.scale.set(scale);
  const maske = new PIXI.Graphics();
  const pts = [];
  for (const [px, py] of rand) pts.push(px - m.ax * m.w, py - m.ay * m.h);
  pts.push((1 - m.ax) * m.w + 2, (1 - m.ay) * m.h + 2, -m.ax * m.w - 2, (1 - m.ay) * m.h + 2);
  maske.poly(pts).fill(0xffffff);
  vorn.addChild(maske);
  vorn.mask = maske;

  const breite = m.w * scale;
  const höhe = m.h * scale;
  // Tippfläche: das ganze Bild und etwas mehr
  c.hitArea = new PIXI.Rectangle(-m.ax * breite - 30, -m.ay * höhe - 30, breite + 60, höhe + 60);
  (parent || seite.welt).addChild(c);

  const korb = {
    c,
    inhalt,
    s: scale,
    breite,
    höhe,
    liste: [],
    /** Punkt im Korb (Bildpunkte des Korb-Bilds) → Koordinaten von korb.inhalt */
    lokal(px, py) {
      return { x: (px - m.ax * m.w) * scale, y: (py - m.ay * m.h) * scale };
    },
    /** Mitte der Öffnung in Koordinaten des Eltern-Containers (Ziel zum Hineinlegen) */
    öffnung(px = m.w / 2, py = m.h * 0.3) {
      return { x: x + (px - m.ax * m.w) * scale, y: y + (py - m.ay * m.h) * scale };
    },
  };
  tap(c, () => {
    fx.wobble(c, 0.05);
    sfx('common/klack', { vol: 0.4 });
    korb.liste.forEach((d, i) => {
      if (d.destroyed || d.ruheY === undefined) return;
      const y0 = d.ruheY;
      killTweensOf(d, ['y']);
      seite.tween(d, { y: y0 - 18 }, 0.14, { ease: 'quadOut', delay: i * 0.05 })
        .then(() => !d.destroyed && seite.tween(d, { y: y0 }, 0.3, { ease: 'bounceOut' }));
    });
  }, { sound: null, squash: false });
  return korb;
}
