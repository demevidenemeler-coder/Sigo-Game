// Sammelbilder fürs Album.
//
//   import { belohne, STICKER, gesammelt, stickerFuerOrt } from '../../gemeinsam/sticker.js';
//   await belohne(this, 'tier_kuh', x, y);   // neu → Stern fliegt zum Album-Knopf; schon da → ein paar Funkel
//
// Zusammenspiel mit dem Kern:
//   store.sticker(id)  legt den Sticker ins Album (true = war neu) – Liste unter 'sigo2.sticker'.
//   fx.stern(x, y)     Stern fliegt im Bogen zu ui.albumPos() und ruft dort ui.albumPlus() (Sterne-Zähler +1,
//                      Knopf hüpft, Glöckchen). Damit der Stern ein sichtbares Ziel hat, setzt die Szene in enter
//                      (bzw. SeitenSzene.vorbereiten) ui.albumKnopf(this).
// tex verweist auf vorhandene Bilder; Pakete, deren pack.json noch fehlt, liefern erst später echte Bilder.
// Ob ein Sticker gezeigt werden kann, entscheidet zur Laufzeit hasTex(tex) (Paket muss geladen sein).

import { store, sfx, fx, hasTex, tex, spr, warnOnce } from '../engine/index.js';

const t = (name, ort) => ({ id: 'tier_' + name, tex: `tiere/${name}_happy`, ort });
const ding = (ort, bild, name = bild.slice(bild.lastIndexOf('/') + 1)) => ({ id: `${ort}_${name}`, tex: bild, ort });

/** Alle Sticker: {id, tex: 'pack/bild', ort} */
export const STICKER = [
  // Tiere – Ort = wo man sie trifft (Zoo-Tiere reisen im Tierwagen am Bahnhof)
  t('kuh', 'bauernhof'), t('schaf', 'bauernhof'), t('schwein', 'bauernhof'), t('pferd', 'bauernhof'),
  t('huhn', 'bauernhof'), t('hahn', 'bauernhof'), t('hund', 'bauernhof'), t('katze', 'bauernhof'),
  t('ente', 'teich'), t('frosch', 'teich'), t('pinguin', 'teich'),
  t('eichhoernchen', 'wald'), t('eule', 'wald'), t('fuchs', 'wald'), t('igel', 'wald'), t('hase', 'wald'),
  t('baer', 'wald'),
  t('maus', 'garten'),
  t('affe', 'bahnhof'), t('elefant', 'bahnhof'), t('giraffe', 'bahnhof'), t('loewe', 'bahnhof'),

  // die vier Loks
  { id: 'lok_dampf', tex: 'zug/lok_dampf', ort: 'bahnhof' },
  { id: 'lok_diesel', tex: 'zug/lok_diesel', ort: 'bahnhof' },
  { id: 'lok_gruen', tex: 'zug/lok_gruen', ort: 'bahnhof' },
  { id: 'lok_schnell', tex: 'zug/lok_schnell', ort: 'bahnhof' },

  // Dinge der Orte (Reihenfolge = Reihenfolge im Album; neue Sticker eines Ortes stehen bei ihren Geschwistern)
  ding('bahnhof', 'bahnhof/bahnhofsglocke'), ding('bahnhof', 'zug/bahnhofsuhr'),
  ding('bahnhof', 'bahnhof/lokschuppen'), ding('bahnhof', 'bahnhof/kran'), ding('bahnhof', 'bahnhof/ladung_staemme', 'baumstaemme'),
  ding('fahrt', 'fahrt/muehle_turm'), ding('fahrt', 'fahrt/baum_apfel'),
  ding('fahrt', 'fahrt/bruecke'), ding('fahrt', 'fahrt/berg_tunnel', 'tunnel'),
  ding('fahrt', 'fahrt/holzstapel'), ding('fahrt', 'fahrt/marktstand'), ding('fahrt', 'fahrt/wasserturm'),
  ding('bauernhof', 'bauernhof/traktor'), ding('bauernhof', 'bauernhof/eierkorb'),
  ding('bauernhof', 'bauernhof/anhaenger'), ding('bauernhof', 'bauernhof/hofladen'),
  ding('feuerwehr', 'feuerwehr/feuerwehrauto'), ding('feuerwehr', 'feuerwehr/helm'),
  ding('feuerwehr', 'feuerwehr/schlauchrolle'),
  ding('feuerwehr', 'feuerwehr/leiterkorb'), ding('feuerwehr', 'feuerwehr/laterne'), ding('feuerwehr', 'feuerwehr/blumenkuebel'),
  ding('baustelle', 'baustelle/kipper'), ding('baustelle', 'baustelle/kran'), ding('baustelle', 'baustelle/walze_ganz', 'walze'),
  ding('baustelle', 'baustelle/hammer'), ding('baustelle', 'baustelle/zapfsaeule'),
  // Sonnenblume: die große lächelnde Blume (die Knospe sonnenblume_2 erkennt ein Kind nicht als Sonnenblume)
  ding('garten', 'garten/sonnenblume_3', 'sonnenblume'), ding('garten', 'garten/blume_rot_auf', 'blume'),
  ding('garten', 'garten/schale_suppe', 'suppe'), ding('garten', 'garten/glas_voll', 'marmelade'),
  ding('teich', 'teich/seerose_bluete', 'seerose'), ding('teich', 'teich/fisch_orange', 'fisch'),
  ding('teich', 'teich/kaulquappe'), ding('teich', 'teich/libelle'), ding('teich', 'teich/schildkroete'),
  ding('musik', 'musik/trommel'), ding('musik', 'musik/trompete'),
  ding('musik', 'musik/rassel'), ding('musik', 'musik/glockenspiel_glocke', 'glocke'),
  ding('malhaus', 'common/icon_stift', 'stift'), ding('malhaus', 'common/regenbogen'),
  ding('malhaus', 'malhaus/icon_stempel', 'stempel'), ding('malhaus', 'malhaus/knete_schnecke', 'knete'), ding('malhaus', 'malhaus/perlenkette', 'kette'),
  ding('eisdiele', 'eisdiele/becher', 'eisbecher'), ding('eisdiele', 'eisdiele/waffel'),
  ding('eisdiele', 'eisdiele/eismaschine'), ding('eisdiele', 'eisdiele/stieleis'), ding('eisdiele', 'eisdiele/kasse'),
  ding('spielplatz', 'spielplatz/ballon_rot', 'ballon'), ding('spielplatz', 'spielplatz/karussell'),
  ding('spielplatz', 'spielplatz/rutsche'), ding('spielplatz', 'spielplatz/schatz_krone', 'schatz'),
  ding('spielplatz', 'spielplatz/wasserrad'), ding('spielplatz', 'spielplatz/matschkueche'),
  ding('wald', 'wald/reh_idle', 'reh'), ding('wald', 'wald/busch_beeren', 'beeren'),
  ding('wald', 'wald/vogel_meise', 'meise'), ding('wald', 'wald/vogel_rotkehlchen', 'rotkehlchen'), ding('wald', 'wald/baeumchen'),
  ding('waschanlage', 'common/schwamm'), ding('waschanlage', 'common/buerste'),
  ding('waschanlage', 'waschanlage/zapfsaeule'), ding('waschanlage', 'waschanlage/kakao_becher', 'kakao'),
  ding('flughafen', 'flughafen/koffer'), ding('flughafen', 'flughafen/flugzeug'), ding('flughafen', 'flughafen/ballon'), ding('flughafen', 'flughafen/postkarte'),
  ding('baeckerei', 'baeckerei/brezel'), ding('baeckerei', 'baeckerei/keks_herz', 'keks'), ding('baeckerei', 'baeckerei/torte'), ding('baeckerei', 'baeckerei/tuete_zu', 'tuete'),
  ding('zoo', 'zoo/futterwagen'), ding('zoo', 'zoo/kamm'), ding('zoo', 'zoo/tor'), ding('zoo', 'zoo/fotowand'),
  ding('schlafen', 'schlafen/kuscheltier_hase', 'kuschelhase'), ding('schlafen', 'schlafen/schlafmond', 'mond'),
];

const NACH_ID = new Map(STICKER.map((s) => [s.id, s]));

/** Sticker zu einer id (oder null) */
export function sticker(id) {
  return NACH_ID.get(id) || null;
}

/** Kann der Sticker gerade gezeigt werden (Bild geladen)? */
export function hatBild(s) {
  const e = typeof s === 'string' ? sticker(s) : s;
  return !!e && hasTex(e.tex);
}

/** ids aller gesammelten Sticker (in der Reihenfolge des Sammelns) */
export function gesammelt() {
  return store.stickers().filter((id) => NACH_ID.has(id));
}

/** Sticker eines Ortes. {nurVorhandene: true} überspringt die, deren Bild (noch) fehlt bzw. nicht geladen ist. */
export function stickerFuerOrt(ort, { nurVorhandene = false } = {}) {
  return STICKER.filter((s) => s.ort === ort && (!nurVorhandene || hasTex(s.tex)));
}

/** Pakete, die geladen sein müssen, um alle Sticker zu zeigen (z. B. für das Album) */
export function stickerPakete() {
  return [...new Set(STICKER.map((s) => s.tex.split('/')[0]))];
}

/**
 * Belohnen: Ist der Sticker neu, erscheint sein Bild kurz bei (x, y), ein Stern fliegt zum Album-Knopf
 * (fx.stern) und es erklingt common/freude → true. Schon gesammelt: nur ein paar leise Funkel → false.
 * szene = Szene oder Seite; (x, y) in Szenen-Koordinaten (world/front – bzw. der Seite).
 * → Promise<boolean> (löst aus, wenn der Stern angekommen ist)
 */
export async function belohne(szene, stickerId, x, y) {
  const s = szene?.szene ?? szene;           // Seite → ihre Szene
  const ebene = szene?.vorn ?? s?.front;      // in diesen Koordinaten kommen x, y
  // Der Moment liegt ganz oben (über Knöpfen) – bei einer Seite in ihrem hud, damit er beim Blättern mitgleitet
  const oben = szene?.vorn ? szene.hud : s?.hud;
  if (!s || !s.alive || !ebene || !oben) return false;
  const p = oben.toLocal(ebene.toGlobal({ x, y }));
  const e = sticker(stickerId);
  if (!e) {
    warnOnce(`belohne: unbekannter Sticker '${stickerId}'.`);
    fx.burst('funkeln', p.x, p.y, { count: 4, parent: oben, z: 9400 });
    return false;
  }
  if (!store.sticker(e.id)) {
    // schon im Album: ein ruhiger kleiner Gruß
    fx.burst('funkeln', p.x, p.y, { count: 5, parent: oben, z: 9400 });
    sfx('common/funkeln', { vol: 0.35 });
    return false;
  }

  sfx('common/freude', { vol: 0.7 });
  // Das Bild des Stickers erscheint kurz (nur wenn es da ist – ein Platzhalter wäre verwirrend)
  let bild = null;
  if (hasTex(e.tex)) {
    bild = spr(e.tex, { anchor: 0.5, x: p.x, y: p.y, parent: oben, z: 9400 });
    const ziel = 260 / Math.max(1, tex(e.tex).width, tex(e.tex).height);
    bild.scale.set(ziel * 0.4);
    bild.alpha = 0;
    bild.eventMode = 'none';
    s.tween(bild, { alpha: 1 }, 0.35, { ease: 'sineInOut' });
    await s.tween(bild, { scale: ziel }, 0.5, { ease: 'backOut' });
    await s.wait(0.5);
    s.tween(bild, { alpha: 0, scale: ziel * 0.6 }, 0.5, { ease: 'sineInOut' })
      .then(() => { if (!bild.destroyed) bild.destroy(); });
  }
  await fx.stern(p.x, p.y, { parent: oben });
  return true;
}
