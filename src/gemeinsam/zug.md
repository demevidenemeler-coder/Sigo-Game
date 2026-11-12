# Baustein „Zug und Fahrzeuge" (`src/gemeinsam/zug.js`)

Für alle Szenen, in denen etwas rollt. Die Pakete `zug` und `tiere` sind immer geladen.
Ausprobieren: `http://localhost:8000/?szene=zugtest` (Testszene `src/scenes/zugtest/`).

```js
import { Zug, Fahrzeug, legeGleis, ladeZug, speichereZug, STANDARD_ZUG,
         LOKS, WAGEN, WAGEN_MIT_SITZ, WAGEN_MIT_LADUNG, GAESTE_TIERE, GAESTE_MENSCHEN, LADUNGEN,
       } from '../../gemeinsam/zug.js';
```

## Zug

```js
async enter() {
  this.gleis = legeGleis(this.world, { y: 1150, scale: 0.5, z: 1 });          // y = Lauffläche
  this.zug = new Zug({ konfig: ladeZug(), x: 0, y: 1150, scale: 0.5, parent: this.world, szene: this, z: 5 });
  tap(this.zug.lok, () => this.zug.pfeife(), { sound: null });
  for (const w of this.zug.wagen) tap(w.koerper, () => this.zug.gaesteJubeln());
  this.zug.on('wagen', (w) => tap(w.koerper, () => this.zug.gaesteJubeln()));   // später angekuppelte
}
update(dt) {
  this.zug.update(dt);              // Pflicht: Räder, Federn, Dampf, Ankuppeln
  this.gleis.rolle(this.zug.dx);    // Schiene wandert unter dem stehenden Zug
}
```

| Option | Bedeutung |
|---|---|
| `konfig` | `{ lok: 'lok_dampf', wagen: [{ typ: 'wagen_offen_rot', gast: 'kuh' \| 'kind_m' \| null, ladung: 'ladung_ball' \| null }] }` (höchstens 4 Wagen; Ungültiges → Standardzug) |
| `x, y` | `y` = Schienenhöhe (Unterkante aller Räder). `x` = Mitte des Zugs (`bezug: 'mitte'`, Standard) oder Vorderkante der Lok (`bezug: 'lok'`) |
| `scale` | 0.5 passt gut: Lok ≈ 470 breit, Zug mit 4 Wagen ≈ 2100 (Kernbereich) |
| `bewegt` | `false` (Standard): Zug steht, nur die Räder drehen – Landschaft um `zug.dx` verschieben. `true`: `zug.x` ändert sich mit der Geschwindigkeit |
| `szene` | für die Effekt-Ebene (`szene.front`) |

Fahren: `zug.fahre(220)` / `zug.halte()` – weich über ≈1,5 s. `zug.geschwindigkeit` (Einheiten/s, setzen = sofort),
`zug.zielGeschwindigkeit`, `zug.faehrt`, `zug.dx` (Strecke im letzten `update`).

Aufbau ändern (alles weich, mit Ton):
- `zug.setzeLok(id)` – Lok tauschen (Hüpfer). → true/false
- `zug.wagenDazu(typ)` – rollt heran, kuppelt mit Hüpfer + `common/kupplung` an. → Wagen-Objekt oder `false` (schon 4)
- `zug.wagenWeg(index?)` – ohne index der letzte; rollt nach hinten weg und verblasst. → true/false
- `zug.setzeGast(index, id | null)` – Gast hüpft hinein (Tierlaut) bzw. heraus. Nur Wagen aus `WAGEN_MIT_SITZ`. → true/false
- `zug.setzeLadung(index, id | null)` – plumpst hinein (`common/klack`). Nur `WAGEN_MIT_LADUNG`. Gast + Ladung im
  selben Wagen geht: Gast links, Ladung rechts.
- `zug.freierPlatz()` – Index des ersten Sitz-Wagens ohne Gast, sonst -1.
- `zug.gaesteJubeln(index?)` – Gäste (oder nur einer) freuen sich: Pose `happy`, kleiner Hüpfer, 3 Herzen, ein Laut.
  Bremst sich selbst: Ein Gast freut sich höchstens alle 0,6 s neu, der Jubel-Ton kommt höchstens alle 0,6 s
  (Dauertippen stapelt nichts). → true, wenn sich gerade (oder eben noch) ein Gast freut.
- `zug.pfeife()` – `common/pfiff` + Dampfwolke (höchstens alle 0,8 s).
- `zug.konfig` – aktuelle Konfiguration (zum Speichern), `zug.laenge` (Eltern-Einheiten), `zug.punktLok('schornstein' | 'gesicht' | …)`.

Teile zum Antippen: `zug.lok` (Fahrzeug), `zug.wagen[i]` = `{ typ, index, koerper, fahrzeug, gast, gastId, ladung, ladungId, platz }`.
`koerper` ist das ganze Wagen-Fahrzeug (inkl. Vorderwand) – darauf `tap()` legen. `gast` ist ein `Actor`
(`w.gast.onTap(fn, { pad: 100 })` – Gäste sind klein, großzügig polstern; `cheer()` nur bei Tieren, Menschen haben keinen Laut).
`index` stimmt immer (nach `wagenWeg` neu gezählt). Ereignisse für Neues: `zug.on('lok' | 'wagen' | 'gast' | 'ladung', fn)`.

## Speicher

```js
const k = ladeZug();          // Kopie von store 'zug'; kaputt/unbekannt → STANDARD_ZUG (rote Dampflok, 2 offene Wagen, Kuh)
speichereZug(zug.konfig);     // → false, wenn ungültig
```

## Listen für Auswahl-Leisten
`LOKS` (4), `WAGEN` (13), `WAGEN_MIT_SITZ` (offene Wagen + Tierwagen), `WAGEN_MIT_LADUNG`, `GAESTE_TIERE` (21, ohne Hahn),
`GAESTE_MENSCHEN` (`kind_m, kind_j, oma, papa`), `LADUNGEN` (10). Bilder: Loks/Wagen/Ladung `zug/<id>`,
Tiere `tiere/<id>_idle`, Menschen `zug/<id>_idle` – gut als Knopf-Bilder.

## Fahrzeug (allgemein: Feuerwehrauto, Kipper, Traktor, Auto …)

```js
const auto = new Fahrzeug({
  koerper: 'feuerwehr/auto',                                   // Körper-Bild ohne Räder, Punkte rad1, rad2 …
  raeder: [{ tex: 'zug/rad_klein', punkt: 'rad1' }, { tex: 'zug/rad_klein', punkt: 'rad2', durchmesser: 160 }],
  x: -600, y: 1200, scale: 0.6, parent: this.world, flip: false,
  // vorn: 'pack/bild_vorn' (Standard: <koerper>_vorn, wenn es das gibt), stange: { tex, von, bis } (Kuppelstange)
});
update(dt) { auto.update(dt); }          // leichtes Federn (ohne update steht es starr – geht auch)
await auto.fahreZu(300, 2, { ease: 'sineInOut' });   // weich anfahren und bremsen, Räder drehen mit
auto.hupf(); auto.wackel(); auto.rolle(dx); auto.punkt('leiter');   // Punkt in Eltern-Koordinaten
```
- `y` = Boden: Die Unterkante des tiefsten Rads liegt auf `y`. Rad-Mitte sitzt auf dem Punkt.
- Radgröße: wird am Körper-Bild gemessen (Höhe und Breite des Radbogens über dem Punkt, Rad ≈ 97 % davon).
  Liegt der Punkt nicht in einer Lücke des Bildes, gibt es eine Schätzung → dann `durchmesser` (Bildpunkte des Körpers) angeben.
  Unterschiedliche Durchmesser: das kleinere Rad hängt dann etwas über dem Boden.
- Räder liegen hinter dem Körper (in den Radkästen sichtbar). `fahrzeug.innen` = Ebene zwischen Körper und Vorderwand
  (Koordinaten = Bildpunkte des Körpers relativ zum Anker) für eigene Insassen/Ladung.
- `rolle(dx)` dreht nur die Räder (dx in Eltern-Einheiten, + = nach rechts), bewegt nichts.

## Gleis
`legeGleis(parent, { y, von = -1420, bis = 1420, z, scale = 0.5 })` → `{ sprite, y, rolle(dx) }`.
`y` ist die Lauffläche: Im Bild `zug/schiene` liegt die Oberkante der Holzschiene in Zeile 1; als Lauffläche gilt Zeile 3
(`SCHIENE_LAUFFLAECHE`), damit die weichen Räder sichtbar aufstehen. `rolle(dx)` verschiebt die Kachel um dx nach links.

## Gut zu wissen
- Gäste sitzen zwischen Wagenbild und Vorderwand (`*_vorn`); eine Maske schneidet sie am Wagenboden ab.
  Größe je Tier in `GAST_GROESSE` (Maus klein, Elefant groß).
- Die Kupplungsknäufe der Bilder sitzen unterschiedlich hoch; ein kleiner Messingbügel hinter den Knäufen verbindet sie.
- Dampfwölkchen gibt es nur bei `lok_dampf` und `lok_gruen` (auch die Kuppelstange). Bei `bewegt: false` steigen sie
  senkrecht auf (sie bleiben nicht hinter dem Zug zurück).
