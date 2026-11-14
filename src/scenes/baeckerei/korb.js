// Korb mit Inhalt (wie im Garten): Das Korbbild liegt zweimal übereinander – hinten ganz, vorn nur der vordere
// Rand und der Bauch (Maske). Dazwischen liegt der Inhalt; so liegt das Gebackene wirklich im Korb.

import { spr, meta, PIXI } from '../../engine/index.js';

// Oberkante des vorderen Randes von common/icon_korb (Bildpunkte, von links nach rechts)
export const KORB_RAND = [[0, 196], [60, 214], [178, 232], [296, 214], [356, 196]];

/** bauKorb(seite, {x, y, scale, z, parent}) → {c, inhalt, lokal(px, py)}; (x, y) = Anker (unten Mitte) */
export function bauKorb(seite, { x, y, scale, z = 60, parent, id = 'common/icon_korb', rand = KORB_RAND }) {
  const m = meta(id);
  const c = new PIXI.Container({ label: 'korb' });
  c.position.set(x, y);
  c.zIndex = z;
  const hinten = spr(id, { parent: c });
  hinten.scale.set(scale);
  const inhalt = new PIXI.Container({ label: 'inhalt', sortableChildren: true });
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
  c.hitArea = new PIXI.Rectangle(-m.ax * breite - 30, -m.ay * höhe - 30, breite + 60, höhe + 60);
  (parent || seite.welt).addChild(c);
  return {
    c,
    inhalt,
    breite,
    höhe,
    /** Punkt im Korbbild (Bildpunkte) → Koordinaten von inhalt */
    lokal(px, py) {
      return { x: (px - m.ax * m.w) * scale, y: (py - m.ay * m.h) * scale };
    },
  };
}
