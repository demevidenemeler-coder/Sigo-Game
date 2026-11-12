// Bilder fürs Sticker-Album: Sticker-Bilder laden (auch aus Paketen, die gerade nicht geladen sind),
// weiße Sticker-Ränder (gestanzte Silhouette) erzeugen und die kleinen gemalten Nebenfiguren
// (Schmetterling, Marienkäfer).
//
// Warum ein eigener Lader: Die Sticker stammen aus fast allen Paketen. Alle Pakete ganz zu laden hieße, dutzende
// große Hintergründe zu entpacken. Hier wird je Sticker nur das eine Bild geladen – unter einem eigenen Namen
// ('album~pack/bild'), damit es sich nicht mit den Paketen des Kerns in die Quere kommt – und in exit() wieder
// freigegeben (gibAlleFrei).

import { PIXI, hasTex, tex } from '../../engine/index.js';

const { Assets, Texture, Container, Graphics } = PIXI;
const PRAEFIX = 'album~';

// pack.json je Paket (klein, darf über Besuche hinweg gemerkt werden)
const packJson = new Map();

function holePack(pack) {
  if (!packJson.has(pack)) {
    packJson.set(pack, fetch(`assets/${pack}/pack.json`, { cache: 'no-cache' })
      .then((a) => (a.ok ? a.json() : null))
      .catch(() => null));
  }
  return packJson.get(pack);
}

/**
 * Lädt die Bilder der Sticker. → Map(stickerId → Texture) – nur die, die es wirklich gibt.
 * geladen: Array, in das die eigenen Namen kommen (zum Freigeben).
 */
export async function ladeStickerBilder(liste, geladen) {
  const ergebnis = new Map();
  await Promise.all(liste.map(async (s) => {
    if (hasTex(s.tex)) {
      ergebnis.set(s.id, tex(s.tex));
      return;
    }
    const [pack, name] = s.tex.split('/');
    const json = await holePack(pack);
    const datei = json?.images?.[name]?.file;
    if (!datei) return; // kein Bild → Sticker wird übersprungen
    const alias = PRAEFIX + s.tex;
    try {
      const t = Assets.resolver.hasKey(alias)
        ? await Assets.load(alias)
        : await Assets.load({ alias, src: `assets/${pack}/${datei}`, data: { autoGenerateMipmaps: true } });
      if (t && !t.destroyed) {
        if (!geladen.includes(alias)) geladen.push(alias);
        ergebnis.set(s.id, t);
      }
    } catch (e) {
      console.warn(`[album] Bild für Sticker '${s.id}' nicht ladbar:`, e?.message || e);
    }
  }));
  return ergebnis;
}

/** Eigene Sticker-Bilder wieder freigeben (nach dem Zerstören der Sprites). */
export function gibFrei(geladen) {
  if (!geladen.length) return;
  const liste = geladen.splice(0);
  Assets.unload(liste).catch(() => {});
}

// ---------------------------------------------------------------- weißer Sticker-Rand

const RAND_PX = 13;            // Breite des weißen Rands in Bildpunkten der Leinwand
export const BILD_PX = 256;    // längste Seite des Bildes auf der Leinwand (≈ Größe im Spiel, nicht mehr)
const klein = document.createElement('canvas'); // Zwischenleinwand (wird wiederverwendet)

// Fertige Ränder je Bild-id – einmal gemalt, über alle Album-Besuche hinweg wiederverwendet (ENTWICKLUNG.md:
// Texturen aus Canvas einmal pro Modul anlegen). Der Kern zerstört beim Verlassen nur Sprites, nicht ihre Texturen.
// Höchstens ein Rand je Sticker-Bild (~54 Stück, je ≈ 290×290 Bildpunkte).
const randSpeicher = new Map();

/** Weißer Sticker-Rand zum Bild `id` (aus dem Speicher oder frisch gemalt). → { textur, k } | null */
export function stickerRandFuer(id, textur) {
  const da = randSpeicher.get(id);
  if (da && !da.textur.destroyed) return da;
  const neu = stickerRand(textur);
  if (neu) randSpeicher.set(id, neu);
  return neu;
}

/** Ist der Rand zu diesem Bild schon gemalt? */
export function hatRand(id) {
  const da = randSpeicher.get(id);
  return !!da && !da.textur.destroyed;
}

/**
 * Weiße, etwas größere Silhouette eines Bildes (wie ein ausgestanzter Sticker).
 * → { textur, k } ; k = Maßstab Bildpunkte des Originals → Leinwand. Nur über stickerRandFuer() benutzen (Speicher).
 */
function stickerRand(textur) {
  const quelle = textur?.source?.resource;
  if (!quelle) return null;
  const f = textur.frame;
  // frame ist in Einheiten; verkleinert geladene Bilder (Tiere: source.resolution < 1) haben weniger Bildpunkte –
  // zum Abmalen aus der Quelle also in echte Bildpunkte umrechnen, sonst sitzt der Rand verrutscht und zu klein
  const res = textur.source.resolution || 1;
  const k = BILD_PX / Math.max(f.width, f.height);
  const w = Math.max(1, Math.round(f.width * k));
  const h = Math.max(1, Math.round(f.height * k));
  const rand = RAND_PX + 3;
  const c = document.createElement('canvas');
  c.width = w + 2 * rand;
  c.height = h + 2 * rand;
  const g = c.getContext('2d');
  try {
    // Bild einmal klein malen (schneller als jedes Mal das große Bild zu verkleinern) …
    klein.width = w;
    klein.height = h;
    const gk = klein.getContext('2d');
    gk.clearRect(0, 0, w, h);
    gk.drawImage(quelle, f.x * res, f.y * res, f.width * res, f.height * res, 0, 0, w, h);
    // … ringsum verschoben aufmalen → aufgedickte Form; dann alles weiß färben
    for (const r of [RAND_PX, RAND_PX * 0.55]) {
      const n = r === RAND_PX ? 24 : 12;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        g.drawImage(klein, rand + Math.cos(a) * r, rand + Math.sin(a) * r);
      }
    }
    g.drawImage(klein, rand, rand);
    g.globalCompositeOperation = 'source-in';
    g.fillStyle = '#ffffff';
    g.fillRect(0, 0, c.width, c.height);
  } catch (e) {
    console.warn('[album] Sticker-Rand ließ sich nicht malen:', e?.message || e);
    return null;
  }
  return { textur: Texture.from(c), k };
}

// ---------------------------------------------------------------- Schmetterling

/** Schmetterling von oben, Flügel einzeln (zum Schlagen). → Container mit .fluegel = [links, rechts] */
export function baueSchmetterling() {
  const c = new Container({ label: 'schmetterling' });
  const fluegel = [-1, 1].map((seite) => {
    const f = new Container();
    const g = new Graphics();
    // Oberflügel (groß, rund) und Unterflügel (kleiner), weiche Pastellfarben
    g.ellipse(seite * 34, -22, 36, 30).fill(0xf6a8c4).stroke({ width: 4, color: 0xd9799f });
    g.ellipse(seite * 26, 22, 24, 21).fill(0xffd27a).stroke({ width: 4, color: 0xe2a94c });
    g.circle(seite * 38, -24, 10).fill(0xfff4e0);
    g.circle(seite * 26, 22, 7).fill(0xfff4e0);
    f.addChild(g);
    c.addChild(f);
    return f;
  });
  const koerper = new Graphics();
  koerper.roundRect(-7, -32, 14, 64, 7).fill(0x6b4f3a);
  koerper.circle(0, -38, 10).fill(0x6b4f3a);
  koerper.moveTo(-3, -45).quadraticCurveTo(-12, -62, -18, -64).stroke({ width: 3, color: 0x6b4f3a, cap: 'round' });
  koerper.moveTo(3, -45).quadraticCurveTo(12, -62, 18, -64).stroke({ width: 3, color: 0x6b4f3a, cap: 'round' });
  koerper.circle(-18, -64, 4).fill(0x6b4f3a);
  koerper.circle(18, -64, 4).fill(0x6b4f3a);
  c.addChild(koerper);
  c.fluegel = fluegel;
  return c;
}

// ---------------------------------------------------------------- Marienkäfer

/** Marienkäfer von oben, Kopf nach rechts. → Container mit .beine (Graphics, wackeln beim Laufen) */
export function baueMarienkaefer() {
  const c = new Container({ label: 'marienkaefer' });
  const beine = new Graphics();
  for (const x of [-14, 4, 20]) {
    beine.moveTo(x, -20).lineTo(x - 6, -34).stroke({ width: 5, color: 0x3a2f2a, cap: 'round' });
    beine.moveTo(x, 20).lineTo(x - 6, 34).stroke({ width: 5, color: 0x3a2f2a, cap: 'round' });
  }
  c.addChild(beine);
  const g = new Graphics();
  g.ellipse(4, 3, 40, 32).fill({ color: 0x5a4630, alpha: 0.18 }); // weicher Schatten
  g.circle(34, 0, 15).fill(0x3a2f2a);                              // Kopf
  g.circle(40, -6, 4).fill(0xffffff);
  g.circle(40, 6, 4).fill(0xffffff);
  g.ellipse(0, 0, 38, 30).fill(0xe0483e).stroke({ width: 4, color: 0xb8352e });
  g.moveTo(-38, 0).lineTo(30, 0).stroke({ width: 3, color: 0x3a2f2a });
  for (const [x, y, r] of [[-16, -13, 7], [-16, 13, 7], [8, -16, 6], [8, 16, 6], [-28, 0, 5]]) {
    g.circle(x, y, r).fill(0x3a2f2a);
  }
  g.ellipse(-6, -14, 10, 5).fill({ color: 0xffffff, alpha: 0.35 }); // Glanz
  c.addChild(g);
  c.beine = beine;
  return c;
}
