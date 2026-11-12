// Futter: Wer mag was? Und der gemeinsame Ablauf „Futter fliegt zum Maul, Tier probiert, freut sich – oder
// schüttelt freundlich den Kopf und das Futter hüpft zurück".
//
//   import { MAG, mag, wunsch, fuettere, futterAuswahl } from '../../gemeinsam/futter.js';
//   mag('kuh', 'common/futter_heu')      → true
//   wunsch('hund')                       → 'common/futter_knochen' (zufällig aus den Lieblingen)
//   await fuettere(this, kuh, sprite)    → true (gemocht) / false
//
// Bilder: assets/common/futter_<name>.webp. Nichts kann falsch sein: Nicht Gemochtes ist nur ein lustiger Moment.

import { sfx, hasTex, pick, shuffle, killTweensOf } from '../engine/index.js';

/** Alle Futter-Bilder (ids ohne Paket) */
export const FUTTER = [
  'futter_apfel', 'futter_banane', 'futter_blatt', 'futter_brot', 'futter_erdbeere', 'futter_fisch',
  'futter_heu', 'futter_honig', 'futter_kaese', 'futter_karotte', 'futter_knochen', 'futter_koerner',
  'futter_milch', 'futter_nuss', 'futter_salat', 'futter_wurm',
];

/** Was jedes Tier mag (2–4 Dinge, das Wichtigste zuerst) */
export const MAG = {
  affe: ['futter_banane', 'futter_apfel', 'futter_nuss'],
  baer: ['futter_honig', 'futter_fisch', 'futter_erdbeere'],
  eichhoernchen: ['futter_nuss', 'futter_apfel', 'futter_koerner'],
  elefant: ['futter_banane', 'futter_heu', 'futter_apfel'],
  ente: ['futter_brot', 'futter_koerner', 'futter_salat'],
  eule: ['futter_wurm', 'futter_koerner'],
  frosch: ['futter_wurm', 'futter_blatt'],
  fuchs: ['futter_kaese', 'futter_knochen', 'futter_apfel'],
  giraffe: ['futter_blatt', 'futter_apfel', 'futter_salat'],
  hahn: ['futter_koerner', 'futter_wurm', 'futter_brot'],
  hase: ['futter_karotte', 'futter_salat', 'futter_blatt'],
  huhn: ['futter_koerner', 'futter_wurm', 'futter_brot'],
  hund: ['futter_knochen', 'futter_brot'],
  igel: ['futter_wurm', 'futter_apfel', 'futter_erdbeere'],
  katze: ['futter_fisch', 'futter_milch'],
  kuh: ['futter_heu', 'futter_apfel', 'futter_salat'],
  loewe: ['futter_knochen', 'futter_fisch'],
  maus: ['futter_kaese', 'futter_nuss', 'futter_koerner'],
  pferd: ['futter_heu', 'futter_karotte', 'futter_apfel'],
  pinguin: ['futter_fisch', 'futter_wurm'],
  schaf: ['futter_heu', 'futter_salat', 'futter_apfel'],
  schwein: ['futter_apfel', 'futter_karotte', 'futter_brot', 'futter_salat'],
};

const PAKET = 'common/';

// 'futter_apfel' | 'common/futter_apfel' | 'apfel' | 'trayKopie:common/futter_apfel' → 'futter_apfel' (oder null)
function kurz(id) {
  if (!id || typeof id !== 'string') return null;
  const treffer = id.match(/futter_[a-z]+/);
  if (treffer) return treffer[0];
  const name = id.includes('/') ? id.slice(id.lastIndexOf('/') + 1) : id;
  return FUTTER.includes('futter_' + name) ? 'futter_' + name : null;
}

/** Mag das Tier dieses Futter? Akzeptiert 'futter_apfel', 'common/futter_apfel' (und kurz 'apfel'). */
export function mag(tier, futterId) {
  const k = kurz(futterId);
  return !!k && (MAG[tier] || []).includes(k);
}

/** Lieblingsfutter eines Tiers als Bild-ids ('common/futter_x'), nur vorhandene Bilder */
export function futterFuer(tier) {
  const alle = (MAG[tier] || []).map((k) => PAKET + k);
  const da = alle.filter((id) => hasTex(id));
  return da.length ? da : alle;
}

/** Zufälliges Lieblingsfutter (für die Denkblase): 'common/futter_x'. Unbekanntes Tier: irgendein Futter. */
export function wunsch(tier) {
  const liste = futterFuer(tier);
  return liste.length ? pick(liste) : PAKET + pick(FUTTER);
}

/**
 * n Futter für eine Leiste, so dass jedes der Tiere mindestens eines davon mag (soweit n reicht); der Rest ist
 * zufällig (auch mal etwas, das keiner mag – lustig). → ['common/futter_x', …]
 */
export function futterAuswahl(tiere, n = 3) {
  const gewaehlt = [];
  for (const tier of shuffle([...tiere])) {
    if (gewaehlt.length >= n) break;
    if (gewaehlt.some((id) => mag(tier, id))) continue;
    const frei = futterFuer(tier).filter((id) => !gewaehlt.includes(id));
    if (frei.length) gewaehlt.push(pick(frei));
  }
  const rest = shuffle(FUTTER.map((k) => PAKET + k).filter((id) => !gewaehlt.includes(id) && hasTex(id)));
  while (gewaehlt.length < n && rest.length) gewaehlt.push(rest.pop());
  return shuffle(gewaehlt);
}

/**
 * Gemeinsamer Fütter-Ablauf. szene = Szene oder Seite (wegen tween/wait, die mit der Szene enden).
 * futter = Sprite (beliebiger Container; seine Position ist der Startpunkt).
 * opt: {futter: id (sonst aus futter.futterId bzw. dem Namen des Sprites), heim: {x, y} (wohin es bei
 *       „mag nicht" hüpft, Standard: wo es gerade liegt), behalten: false (gemocht → Sprite wird nur versteckt
 *       statt zerstört)}
 * Ablauf: Futter fliegt im kleinen Bogen zum Maul (actor.point('mouth')), Pose 'eat', Ton mampf.
 *   gemocht   → Futter verschwindet im Maul, actor.cheer()                      → true
 *   sonst     → freundliches Kopfschütteln + common/nein, Futter hüpft zurück   → false
 * Isst das Tier schon, hüpft das neue Futter gleich zurück (→ false).
 */
export async function fuettere(szene, actor, futter, opt = {}) {
  if (!futter || futter.destroyed || !futter.parent || !actor || actor.destroyed || !actor.parent) return false;
  const id = kurz(opt.futter) || kurz(futter.futterId) || kurz(futter.label);
  const gemocht = !!id && mag(actor.tierId, id);
  const eltern = futter.parent;
  const start = opt.heim || { x: futter.x, y: futter.y };
  const ruhe = { x: futter.scale.x, y: futter.scale.y };
  const ruheAlpha = futter.alpha;
  const vorherModus = futter.eventMode;
  killTweensOf(futter, ['x', 'y', 'scale', 'scaleX', 'scaleY', 'alpha', 'rotation']);
  futter.eventMode = 'none'; // unterwegs nicht greifbar

  // Tier ist noch beschäftigt: freundlich zurück, ohne Kopfschütteln
  if (actor._isst) {
    await huepfeZurueck(szene, futter, start, ruhe);
    if (!futter.destroyed) futter.eventMode = vorherModus;
    return false;
  }
  actor._isst = true;
  try {
    // 1. Im kleinen Bogen zum Maul
    const maul = maulIn(actor, eltern);
    await bogen(szene, futter, maul, { dauer: 0.45, hoehe: 70, skala: 0.85, ruhe });
    if (futter.destroyed || actor.destroyed) return false;

    // 2. Probieren
    actor.pose('eat');
    sfx('common/mampf', { vol: gemocht ? 0.9 : 0.6 });

    if (gemocht) {
      // 3a. Futter verschwindet im Maul, dann freut sich das Tier
      await szene.tween(futter, { scaleX: ruhe.x * 0.15, scaleY: ruhe.y * 0.15, alpha: 0 }, 0.4, { ease: 'quadIn' });
      if (opt.behalten) {
        futter.visible = false;
        futter.scale.set(ruhe.x, ruhe.y);
        futter.alpha = ruheAlpha;
        futter.eventMode = vorherModus;
      } else if (!futter.destroyed) {
        futter.destroy();
      }
      await szene.wait(0.35);
      await actor.cheer();
      return true;
    }

    // 3b. Mag nicht: kurz probieren, freundlich Kopf schütteln, Futter hüpft zurück
    await szene.wait(0.45);
    actor.pose('idle');
    sfx('common/nein', { vol: 0.8 });
    actor.shake();
    await szene.wait(0.25);
    await huepfeZurueck(szene, futter, start, ruhe);
    if (!futter.destroyed) futter.eventMode = vorherModus;
    return false;
  } finally {
    actor._isst = false;
  }
}

// ---------------------------------------------------------------- Hilfen

// Maul des Tiers in Koordinaten des Containers `ziel`
function maulIn(actor, ziel) {
  const p = actor.point('mouth');
  return ziel.toLocal(actor.parent.toGlobal(p));
}

// Flug im Bogen nach `nach` (Koordinaten des Eltern-Containers); skala = Endgröße relativ zur Ruhe-Größe
// `dauer` ist die kürzeste Flugzeit: Ein weiter Weg dauert länger (im Mittel höchstens FLUG_TEMPO Einheiten/s),
// damit nichts quer über das Bild rast (Ruhe-Regel).
const FLUG_TEMPO = 1300;
function bogen(szene, obj, nach, { dauer, hoehe, skala = 1, ruhe }) {
  const von = { x: obj.x, y: obj.y };
  dauer = Math.max(dauer, Math.hypot(nach.x - von.x, nach.y - von.y) / FLUG_TEMPO);
  const s0 = { x: obj.scale.x, y: obj.scale.y };
  const proxy = { p: 0 };
  return szene.tween(proxy, { p: 1 }, dauer, {
    ease: 'sineInOut',
    onUpdate: () => {
      if (obj.destroyed) return;
      const p = proxy.p;
      obj.x = von.x + (nach.x - von.x) * p;
      obj.y = von.y + (nach.y - von.y) * p - hoehe * 4 * p * (1 - p);
      obj.scale.set(s0.x + (ruhe.x * skala - s0.x) * p, s0.y + (ruhe.y * skala - s0.y) * p);
    },
  });
}

// Zurück zum Start: ein Hüpfer im Bogen, dann ein kleiner Nachhüpfer
async function huepfeZurueck(szene, futter, start, ruhe) {
  if (futter.destroyed) return;
  await bogen(szene, futter, start, { dauer: 0.6, hoehe: 160, skala: 1, ruhe });
  if (futter.destroyed) return;
  await szene.tween(futter, { y: start.y - 30 }, 0.16, { ease: 'quadOut' });
  await szene.tween(futter, { y: start.y }, 0.3, { ease: 'bounceOut' });
}
