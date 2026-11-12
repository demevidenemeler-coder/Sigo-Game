# Hilfsprogramme für Sigo 2

Alle Befehle aus dem Projektordner starten. Ergebnisse kommen als eine JSON-Zeile auf stdout,
Warnungen (abgeschnittenes Motiv, kein Alpha, …) auf stderr. Jeder Unterbefehl hat `-h` mit Beispiel.

Einmalig für `shot.mjs`: `cd tools && npm install` (puppeteer-core, pixi.js zum Nachschlagen).

## bild.py – Bilder (Python + Pillow)

| Befehl | Wofür |
|---|---|
| `holen <url> <ziel>` | Datei per HTTPS laden (nur https), Ordner werden angelegt |
| `sprite <roh.png> <ziel.webp> [--max 1024] [--rand 6] [--anker unten\|mitte] [--eintragen --desc ".."]` | Freigestelltes Bild zuschneiden, verkleinern, als WebP mit Alpha speichern; gibt Anker `ax/ay` aus. `--eintragen` schreibt den Anker gleich in `punkte.json` des Zielordners |
| `hintergrund <roh.png> <ziel.webp> [--hoehe 1600] [--qualitaet 88]` | Hintergrund auf Höhe bringen, WebP ohne Alpha |
| `nahtlos <roh.png> <ziel.webp> [--hoehe N] [--überlappung 0.12]` | Waagrecht kachelbar machen; Ergebnis wird um die Überlappung schmaler. `--anteil` ist dasselbe wie `--überlappung` |
| `raster <bild> <ziel.jpg> [--schritt 100] [--breite 1100]` | Bild mit Koordinaten-Gitter in Bildpunkten des Quellbilds – zum Ablesen von Punkten (Maul, Radmitte) |
| `bogen <ordner\|dateien…> <ziel.jpg> [--spalten 6] [--kachel 360]` | Übersichtsblatt zum Prüfen vieler Bilder (karierter Grund = durchsichtig) |
| `pack <assets/paket>` | baut `pack.json` aus allen Bildern/Tönen im Ordner und `punkte.json` |
| `anker <assets/paket> <name> [--ax ..] [--ay ..] [--pt name=x,y …] [--desc ".."] [--ton]` | trägt Anker, Punkte, Beschreibung in `punkte.json` ein (sicher, auch wenn mehrere gleichzeitig schreiben) |

Üblicher Ablauf für ein Sprite:
```
python tools/bild.py holen https://…/kuh.png art/tiere/kuh_idle.png
python tools/bild.py sprite art/tiere/kuh_idle.png assets/tiere/kuh_idle.webp --max 900 --eintragen --desc "Kuh steht"
python tools/bild.py raster assets/tiere/kuh_idle.webp art/raster/kuh_idle.jpg --schritt 50   # Punkte ablesen
python tools/bild.py anker assets/tiere kuh_idle --pt mouth=420,380
python tools/bild.py bogen assets/tiere art/bogen/tiere.jpg                                    # ansehen!
python tools/bild.py pack assets/tiere
```
`punkte.json` ist die Quelle für Anker/Punkte/Beschreibungen und wird von `pack` nur gelesen.
`pack.json` nie von Hand ändern – es wird neu gebaut.

## ton.py – Töne (ruft ffmpeg/ffprobe auf)

```
python tools/ton.py holen <url|datei> <ziel.mp3> [--kuerzen] [--laut -16] [--max sek] [--bitrate 128k] [--ausblenden sek]
python tools/ton.py info <datei>
```
`holen` schneidet mit `--kuerzen` Stille (unter -50 dB) vorn und hinten weg, gleicht auf `--laut` LUFS an
(feste Verstärkung, Spitzen über -1,5 dBTP fängt ein weicher Begrenzer ab), kürzt auf `--max`, blendet am Ende aus
und speichert MP3 mit den Kanälen der Quelle (höchstens Stereo, 44,1 kHz). Töne unter 0,4 s lassen sich nicht in
LUFS messen; sie werden über die Spitze angeglichen (`lufs` ist dann `null`).

## shot.mjs – Testfotos mit echtem Chrome

```
node tools/shot.mjs --szene bauernhof --out shots/hof.png --warte 2 \
     --aktionen '[["tap",1280,900],["drag",600,1200,1500,900],["foto","hof_nach_ziehen"]]'
node tools/shot.mjs --url art/werkzeugtest/testseite.html --out shots/test.jpg     # beliebige Seite
```
- Startet einen eigenen Dateiserver (freier Port, ohne Zwischenspeicher) und Chrome ohne Fenster
  (Grafikkarte, sonst SwiftShader; der benutzte Renderer steht im Ergebnis). Mehrere Läufe gleichzeitig gehen.
- Öffnet `/?szene=<id>&test=1` (+ `--param a=b`), wartet auf `window.__sigo.ready`, dann `--warte` Sekunden.
- Aktionen in Bühnen-Einheiten (x 0…2560, y 0…1600): `["tap",x,y]`, `["drag",x1,y1,x2,y2,sek?]`,
  `["halten",x,y,sek]`, `["warte",sek]`, `["foto","name"]` (→ `shots/name.jpg`), `["js","ausdruck"]`.
  Lange Listen als Datei: `--aktionen @shots/ablauf.json`.
- `--gross` = Fotos in 2560×1600, `--touch` = Finger statt Maus, `--ohne-ready` für Seiten ohne `__sigo`,
  `--swiftshader` ohne Grafikkarte, `--zeitlimit` Notbremse (Standard 180 s). Chrome-Pfad: Umgebungsvariable `CHROME`.
- Ergebnis: JSON `{ok, fehler, warnungen, fotos, renderer, ergebnisse, fps?}`. Fehlende Töne (404) sind nur
  Warnungen, alles andere (Seitenfehler, `console.error`, fehlende Dateien) sind Fehler → Exit-Code 1.
  Auch nach einem Abbruch wird noch ein Foto gemacht.

## sw_liste.py – Offline-Liste für den Service Worker

```
python tools/sw_liste.py            # sw-dateien.js neu schreiben (nur wenn sich Spieldateien geändert haben)
python tools/sw_liste.py --pruefen  # nur prüfen: Exit-Code 1, wenn sw-dateien.js nicht mehr zum Spiel passt
```
Schreibt die Liste aller Spieldateien, je Datei eine kurze Prüfsumme und den Versions-Stempel. Ohne neuen Stempel
bekommt ein installiertes Tablet keine Änderungen; mit Prüfsummen holt es beim Update nur geänderte Dateien.
Vor jedem Veröffentlichen laufen lassen (oder mit `--pruefen` kontrollieren).

## Test mit einem älteren Chrome (wie auf dem Tablet)

Der Chrome auf dem Rechner ist neuer als der Browser auf dem Tablet. Vor dem Veröffentlichen einmal mit einer älteren
Fassung prüfen, ob das Spiel startet:

```
npx @puppeteer/browsers install chrome@114 --path <ordner>
CHROME=<ordner>/chrome/win64-114…/chrome-win64/chrome.exe node tools/alt_chrome.mjs <projektordner> "index.html?szene=karte&test=1" 9
```

Ausgabe: `{stand: {laden, bereit, szene, sigoFehler, meldung}, fehler: […]}`. `laden: true` heißt: Das Spiel hängt bei
den drei Punkten. So fiel am 12.11.2026 auf, dass die Import-Karte in index.html vor `modulepreload` stehen muss.

