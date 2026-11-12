# Gemeinsame Bausteine: Seiten, Futter, Sticker

Import aus einer Szene (`src/scenes/<id>/index.js`):

```js
import { Seite, SeitenSzene, hgPunkt, setzeHintergrund } from '../../gemeinsam/seiten.js';
import { MAG, mag, wunsch, fuettere, futterAuswahl, futterFuer } from '../../gemeinsam/futter.js';
import { STICKER, belohne, gesammelt, stickerFuerOrt, stickerPakete, hatBild } from '../../gemeinsam/sticker.js';
```

Vollständiges Beispiel: `src/scenes/seitentest/index.js` (`?szene=seitentest&test=1`).

## 1. Seiten (`seiten.js`)

Ein Ort mit mehreren Bilderbuch-Seiten. Links/rechts am Rand je ein großer Pfeil (am ersten/letzten Blatt fehlt
er, kein Rundlauf), unten in der Mitte kleine Seiten-Punkte. Blättern: alte Seite gleitet in 0,7 s hinaus, neue
herein (sineInOut, leises `common/wusch`); währenddessen keine Eingabe auf den Seiten, laufendes Ziehen endet sauber.

```js
class Futterplatz extends Seite {
  static hg = 'bauernhof/hg_futter';    // Hintergrund: mittig, Höhe 1600, automatisch eingesetzt (this.hg)

  aufbau() {                             // EINMAL, beim ersten Besuch (darf async sein, sollte schnell sein)
    this.kuh = new Actor('kuh', { x: -500, y: this.boden, scale: 0.55, parent: this.welt });
    const trog = this.punkt('trog');     // Punkt aus pack.json → Seiten-Koordinaten
    this.leiste = this.tray({ items: […], targets: () => […], onDrop: … });
  }
  betreten() { this.kuh.bubble(wunsch('kuh')); }  // JEDES Mal, wenn die Seite fertig hereingeglitten ist
  verlassen() { this.rauch?.stop(); }               // JEDES Mal, wenn das Wegblättern beginnt (auch beim Szenenende)
  update(dt, t) { … }                    // nur solange die Seite sichtbar ist; t = Sichtbar-Zeit der Seite
  hinweise() { return [this.kuh]; }      // Ziele der Zeige-Hand (wie Scene.hints)
  resize(W, H) { … }                     // optional: Bildschirmbreite hat sich geändert
}

export default class Bauernhof extends SeitenSzene {
  static id = 'bauernhof';
  static packs = ['bauernhof', 'tiere'];  // alle Pakete der Hintergründe/Figuren eintragen ('tiere' auch!)
  static music = 'musik/wiese';
  static seiten = [Futterplatz, Hühner, Melken, Waschen];

  vorbereiten(params) { ui.albumKnopf(this); }  // optional, einmal vor der ersten Seite
  jedesBild(dt, t) { … }                         // optional, jedes Bild (Szene)
  seiteGewechselt(neu, alt) { … }                // optional, nach jedem Wechsel
}
```
Wer `enter/update/exit/resize/hints` der SeitenSzene doch selbst überschreibt, ruft `super.…` auf.

### Was eine Seite hat

| | |
|---|---|
| `this.szene`, `this.index` | die SeitenSzene, Nummer der Seite (0 = erste) |
| `this.welt` | Container in `szene.world` – hier spielt die Seite (x=0 Bildmitte, y 0…1600) |
| `this.vorn` | Container in `szene.front` (Vordergrund) |
| `this.hud` | Container in `szene.hud` (Knöpfe, Leisten; Koordinaten 0…stage.W) |
| `this.hinten` | Container in `szene.bg`, darin `this.hg` (Sprite des Hintergrunds, `this.hgId` = Bild-id) |
| `this.punkt(name, ersatz)` | benannter Punkt des Hintergrunds (pts aus pack.json) in Seiten-Koordinaten; fehlt er: `ersatz` bzw. `null` (+ Warnung) |
| `this.boden` | y des Punkts `boden`, sonst 1300 |
| `this.aktiv` | true zwischen `betreten()` und `verlassen()` |
| `this.besuche` | wie oft betreten (beim ersten `betreten()` = 1) |
| `this.tween/wait/after/every` | wie in der Szene (siehe „Zeit") |
| `this.burst(art, x, y, opt)`, `this.emitter(art, opt)` | `fx.burst/emitter` mit `parent: this.vorn` (gleitet mit) |
| `this.knopf(tex, opt)` | `ui.button` in `this.hud` |
| `this.tray(opt)` | `ui.tray`, die Leiste liegt in `this.hud` |

Ruht eine Seite, liegen alle ihre Container bei x=0: **Seiten-Koordinaten = Szenen-Koordinaten**. Beim Blättern
werden `hinten`, `welt`, `vorn` und `hud` der beiden Seiten gemeinsam verschoben. Nur die sichtbare Seite (beim
Gleiten die zwei beteiligten) ist im Baum sichtbar – alle anderen sind unsichtbar, bekommen keine Eingabe und kein
`update()`. Eine Seite wird erst beim ersten Besuch gebaut und behält danach ihren Zustand.

**Was nicht mitgleitet:** Dinge, die direkt in `szene.world/front/hud` liegen (statt in `this.welt/vorn/hud`), und
Teilchen mit Standard-Ebene (`fx.burst(...)` ohne `parent`, Herzen von `actor.cheer()` – mit
`actor.cheer({ parent: this.vorn })` gleiten sie mit). Die schweben kurz weiter und verblassen – ruhig. Dauer-Effekte (Emitter) mit `this.emitter` anlegen oder in `verlassen()` stoppen.
`ui.button(...)` ohne `parent` landet im hud der Szene (immer sichtbar) – für Seiten-Knöpfe `this.knopf()` nehmen.

### Zeit

`this.tween/wait/after/every` einer Seite gehören der **Szene**: Sie enden beim Verlassen der Szene, laufen aber beim
Wegblättern **weiter** (die Seite ist dann nur unsichtbar). Wer z. B. alle 10 s etwas tun will, aber nur auf der
sichtbaren Seite: `this.every(10, () => { if (this.aktiv) … })` oder den Zeitgeber in `verlassen()` mit `.kill()`
beenden und in `betreten()` neu starten. `update(dt, t)` läuft dagegen nur, solange die Seite sichtbar ist.

### Steuern und Testen

- `szene.zeigeSeite(n, {sofort})` → Promise (wenn die Seite steht); `szene.blaettern(+1 | -1)`;
  `szene.nr`, `szene.seite`, `szene.anzahl`, `szene.gleitet`. Während eines Wechsels werden weitere Wünsche ignoriert.
- Start-Seite: `params.seite` (z. B. `this.go('bauernhof', { seite: 2 })`), sonst `?seite=2` in der Adresse
  (nur wenn die Szene über `?szene=<id>` gestartet wurde), sonst 0.
- Test: `node tools/shot.mjs --szene bauernhof --param seite=2 …`, Fernsteuern mit
  `["js","__sigo.scene.zeigeSeite(1)"]`. Pfeile liegen bei (175, 800) und (stage.W−175, 800).
- Zeige-Hand: `hints()` der Szene liefert `hinweise()` der sichtbaren Seite. Hat die Seite keine Hinweise oder ist
  20 s nichts passiert (dritter Hinweis), zeigt die Hand auf den Pfeil zur nächsten (am Ende: vorigen) Seite.

### Freie Hilfen (auch ohne Seiten)

```js
const hg = setzeHintergrund(this, 'feuerwehr/hg_wache');   // in this.bg, mittig, Höhe 1600 → Sprite
const p = hgPunkt(hg, 'feuerwehr/hg_wache', 'garage');      // → {x, y} im Eltern-Container des Sprites (oder null)
const q = hgPunkt(hg, 'garage');                            // kurz: id = sprite.label (setzt spr())
```
`hgPunkt` rechnet Anker, Größe, Ort und Drehung des Sprites ein – funktioniert für jedes Bild mit `pts`.

## 2. Futter (`futter.js`)

`MAG` – für alle 22 Tiere 2–4 Lieblingsfutter (`'futter_heu'` …, Bilder `common/futter_*`), z. B.
Kuh Heu/Apfel/Salat, Hund Knochen/Brot, Katze Fisch/Milch, Maus Käse/Nuss/Körner, Affe Banane/Apfel/Nuss,
Bär Honig/Fisch/Erdbeere, Pinguin Fisch/Wurm, Huhn und Hahn Körner/Wurm/Brot, Hase Karotte/Salat/Blatt.

```js
mag('kuh', 'common/futter_heu');       // true – nimmt auch 'futter_heu' und 'heu'
wunsch('hund');                         // 'common/futter_knochen' (zufälliges Lieblingsfutter, z. B. für bubble)
futterFuer('katze');                    // ['common/futter_fisch', 'common/futter_milch']
futterAuswahl(['kuh', 'hund'], 3);      // 3 Futter für eine Leiste; jedes Tier mag mindestens eines
const gemocht = await fuettere(this, kuh, sprite, { futter: 'common/futter_heu', heim: { x, y } });
```

`fuettere(szene|seite, actor, futterSprite, opt)` → `Promise<boolean>`: Das Futter fliegt im kleinen Bogen zum Maul
(`actor.point('mouth')`), Pose `eat`, Ton `common/mampf`.
- gemocht: Futter verschwindet im Maul (Sprite wird zerstört; mit `behalten: true` nur versteckt), dann `actor.cheer()` → `true`
- sonst: freundliches Kopfschütteln + `common/nein`, das Futter hüpft nach `opt.heim` (Standard: wo es lag) → `false`
- Isst das Tier gerade, hüpft neues Futter gleich heim (→ `false`). Das Sprite ist unterwegs nicht greifbar.
- Welches Futter: `opt.futter`, sonst `sprite.futterId`, sonst der Name des Sprites (`spr()`/Leisten-Kopien enthalten ihn).

Mit der Leiste (die Kopie behalten, damit `fuettere` sie fliegen lassen kann):
```js
this.leiste = this.tray({
  items: futterAuswahl(['kuh', 'hund']).map((id) => ({ id, tex: id })),
  targets: () => [this.kuh, this.hund].map((t) => ({ tier: t, ...t.point('mouth'), radius: 300 })),
  onDrop: (item, ziel, kopie, ctx) => {
    ctx.behalten();
    fuettere(this, ziel.tier, kopie, { futter: item.id, heim: { x: ctx.startX, y: ctx.startY } })
      .then((ok) => { if (!ok && !kopie.destroyed) this.tween(kopie, { alpha: 0 }, 0.35).then(() => kopie.destroy()); });
  },
});
```

## 3. Sticker (`sticker.js`)

`STICKER` – 60 Sammelbilder `{id, tex, ort}` aus vorhandenen Bildern: alle 22 Tiere (`tier_kuh` → `tiere/kuh_happy`),
die 4 Loks (`lok_dampf` …) und 2–4 Dinge für jeden Ort (`bauernhof_traktor`, `feuerwehr_helm`, `teich_seerose`,
`fahrt_bruecke`, `fahrt_tunnel`, `spielplatz_rutsche`, `spielplatz_schatz`, `baustelle_walze`,
`feuerwehr_schlauchrolle` …). Ob ein Sticker gezeigt werden kann, entscheidet `hasTex(tex)` zur Laufzeit (sein Paket
muss geladen sein). Das Album richtet Seitenzahl und Raster (18 je Doppelseite) von selbst nach der Liste.

```js
await belohne(this, 'feuerwehr_helm', x, y);   // x, y in Szenen-/Seiten-Koordinaten → true, wenn neu
gesammelt();                                    // ['feuerwehr_helm', …] (Reihenfolge des Sammelns)
stickerFuerOrt('bauernhof');                    // alle Sticker des Ortes; {nurVorhandene: true} nur mit Bild
stickerPakete();                                // Pakete, die ein Album laden muss
hatBild('tier_kuh');                            // Bild geladen?
```

`belohne(szene|seite, id, x, y)`: Ist der Sticker neu (`store.sticker(id)`), erscheint sein Bild kurz bei (x, y), ein
Stern fliegt zum Album-Knopf (`fx.stern` → `ui.albumPlus()`: Sterne-Zähler +1, Knopf hüpft, Glöckchen) und es klingt
`common/freude` → `true` (wenn der Stern angekommen ist). Schon gesammelt: nur ein paar leise Funkel → `false`.
Der Moment liegt über den Knöpfen (bei einer Seite in ihrem hud, gleitet also mit). Damit der Stern ein sichtbares
Ziel hat, setzt die Szene `ui.albumKnopf(this)` (bei SeitenSzene in `vorbereiten()`).
