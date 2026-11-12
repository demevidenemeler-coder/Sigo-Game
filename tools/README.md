# Hilfsprogramme für Sigo 2

Alle Befehle aus dem Projektordner starten. Ergebnisse kommen als eine JSON-Zeile auf stdout,
Warnungen (abgeschnittenes Motiv, kein Alpha, …) auf stderr. Jeder Unterbefehl hat `-h` mit Beispiel.

Einmalig für `shot.mjs` und `ladezeit.mjs`: `cd tools && npm install` (puppeteer-core, pixi.js zum Nachschlagen).

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
| `verkleinern <assets/paket> [--max 600] [--qualitaet 92] [--nur name,…]` | verkleinert zu große Bilder (Lanczos, fast verlustfrei) auf höchstens `--max` Bildpunkte an der längeren Seite. Die alte Größe bleibt als `einheiten` in `punkte.json`: pack.json behält `w`/`h` in Einheiten und bekommt `res` (Bildpunkte je Einheit) – Szenen merken nichts. Punkte (`pts`, `--pt`) gelten danach weiter in Einheiten (= Bildpunkte des alten Bildes; `raster` zeigt Bildpunkte der kleinen Datei – durch `res` teilen). Ein zweiter Lauf ändert nichts |

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
Textdateien (.js, .json, .html …) werden mit LF gerechnet, so wie Git sie speichert und GitHub Pages sie ausliefert
(im Arbeitsordner unter Windows stehen sie oft mit CRLF). `sw.js` vergleicht beim Installieren den Inhalt jeder
Datei mit dieser Prüfsumme.
Vor jedem Veröffentlichen laufen lassen (oder mit `--pruefen` kontrollieren).

## ladezeit.mjs – Ladezeiten wie auf dem Tablet messen

```
node tools/ladezeit.mjs --cpu 4 --netz 30 --wdh 3 --out shots/ladezeit_cpu4.json      # alle Fälle, Median aus 3
node tools/ladezeit.mjs --cpu 6 --netz 8 --faelle a,b --wdh 3                          # langsames WLAN
node tools/ladezeit.mjs --cpu 4 --faelle c --orte bauernhof,teich --ohne-zweiten --wdh 1   # schnell ein paar Orte
node tools/ladezeit.mjs --bausteine --cpu 4 --wdh 3                                    # Einzelkosten
```
- Eigener Dateiserver wie GitHub Pages: Unterpfad `/Sigo-Game/`, HTTP/2 über https (Zertifikat erzeugt `openssl`
  bei jedem Lauf neu; ohne openssl oder mit `--http1` HTTP/1.1), `ETag`, `Cache-Control: max-age=600`, 304 bei
  `If-None-Match`, gzip für Text, Textdateien mit LF (wie aus Git). Alle Antworten – Spiel **und** Service Worker –
  teilen sich **eine** gedrosselte Leitung (`--netz` Mbit/s, `--latenz` ms je Anfrage), wie im echten WLAN. Die Seite
  läuft mit `?sw=1` (ohne `test=1`), damit sich der Service Worker wie am Tablet einrichtet.
- Dem Zertifikat vertraut Chrome über seinen Fingerabdruck (`--ignore-certificate-errors-spki-list`) wie einem
  echten: Nur so legt Chrome Antworten in den Browser-Speicher, und es gibt 304-Antworten wie am Tablet (mit
  `--ignore-certificate-errors` gab es nie eine).
- Chrome ohne Fenster, 1280×800 CSS-Pixel × 2 = 2560×1600 Gerätepixel, `Emulation.setCPUThrottlingRate` (`--cpu`),
  8 Kerne gemeldet. Die Drosselung wirkt nur auf den Hauptthread der Seite – Worker, Service Worker, Browser-Prozess
  (Offline-Speicher) und Grafikkarte laufen mit voller Rechner-Geschwindigkeit (das Tablet ist dort langsamer).
- Fälle (`--faelle`): `a` erster Besuch (leeres Profil; Startbild bedienbar, dann „Los“ bis Karte bedienbar),
  `e` gleich danach in derselben ersten Sitzung: Orte (`--orte-erst`, Standard Bauernhof, Feuerwehr, Teich) 0,1 s nach
  dem Erscheinen der Karte antippen, 0,5 s nach dem Ort zurück – der Offline-Speicher lädt noch, die Bilder kommen
  übers Netz (`offline_dateien_beim_tipp`), `b` späterer Start (neuer Tab, Service Worker angehalten und alles im
  Offline-Speicher), `c` **nach fertigem Offline-Speicher**: Karte → jeder der 13 Orte (echter Tipp auf den Ort) →
  Karten-Knopf → Karte, dazu Bahnhof → Fahrt, danach jeder Ort ein zweites Mal, `d` Umblättern (Bauernhof, Garten),
  Stickerbuch aus einem Ort und zurück, Stickerbuch von der Karte.
  Für b–d wartet das Werkzeug, bis der Offline-Speicher fertig ist (`--sw-warten`), und schreibt dabei alle 5 s den
  Stand mit (`serviceWorker.verlauf`: Sekunden, Dateien im Speicher, Zustand, Anfragen).
- `verteilung` (JSON und zweite Tabelle): je Gruppe über **alle** Besuche aller Wiederholungen Median, P90 und
  Höchstwert (ab Tipp und ab Wechsel-Beginn) sowie der Anteil der Besuche, die hinter der geschlossenen Blende noch
  laden (`laden` > 100 ms). Die Mediane je Fall (`median`) verdecken Ausreißer; Werte, die fehlen, lässt der Median
  still weg (`ohne_wert` zählt sie).
- Nach jeder Wiederholung wird der Zwischenstand in die Ausgabedatei geschrieben (`teilweise`); bricht eine
  Wiederholung ab, fehlt nur sie (Fehler in `laeufe[n].info.fehler`).
- Gemessen wird nur lesend: ein Beobachter (vor dem Spiel eingesetzt) liest `window.__sigo` und die schon geladenen
  Kern-Module (`SceneManager`, `assets.js`, `input.js` – dieselben Adressen, also dieselben Objekte) alle 4 ms und
  in jedem Bild; dazu CPU-Profil (CDP `Profiler`), lange Aufgaben, Bildabstände und das Protokoll des Servers.
- Phasen je Wechsel (ms): `weg_spiel` (Tipp → Wechsel beginnt, z. B. Zugfahrt auf der Karte – so gewollt),
  `blende_zu`, `laden` (alte Szene abbauen, Szenen-Modul, Pakete: Netz/Speicher, Entpacken, und der gleichzeitige
  Teil von `enter()`), `aufbau` (der Teil von `enter()`, auf den danach noch gewartet wird, höchstens 1,2 s),
  `blende_auf`, `gesamt` (Tipp → Blende offen und Eingabe frei). `zeitachse`: wann welche Pakete geladen waren.
- `cpu_ms`: Hauptthread-Zeit im Fenster nach Art (`hochladen` = texImage2D/Mipmaps, `szene_code`, `kern_code`,
  `zeichnen`, `pixi_sonst`, `gc`, `browser_intern` = Arbeit des Browsers ohne JavaScript, `leer` = Warten).
  Unter CPU-Drosselung sind alle Hauptthread-Zeiten entsprechend gestreckt.
- `netz`: Anfragen und MB, die wirklich über die Leitung gingen (`spiel`, `serviceWorker` getrennt; was der
  Service Worker aus dem Speicher beantwortet, taucht hier nicht auf). `bildbedarf`: sichtbare Bilder, ihre
  Bildpunkte gegenüber den gezeigten, Texturen und MB auf der Grafikkarte.
- `--spur`: zusätzlich eine Chrome-Spur beim Start und beim ersten Ort – Eigenzeit je Thread (auch Browser-Prozess,
  Grafikkarte, Entpack-Threads). `--fotos`: nach jedem Wechsel `shots/lz_<fall>.jpg` (nur erste Wiederholung).
- `--bausteine`: Einzelkosten in der Seite – Suche im Offline-Speicher (so wie `sw.js` sucht, mit `ignoreSearch`,
  und genau), Tierbilder entpacken mit und ohne Verkleinern, Hintergründe entpacken und mit/ohne Mipmaps hochladen.
- Ausgabe: Tabelle (Mediane) auf stdout, Fortschritt auf stderr, alles in der JSON-Datei (`median` je Fall und alle
  `laeufe`). Höchstens zwei Läufe gleichzeitig starten; der Rechner ist laut – Mediane aus mehreren Wiederholungen.
- `--variante ohne-vorrat|ohne-voraus` (auch mehrere, mit Komma): Gegenprobe – der Mess-Server liefert `scene.js` im
  Speicher abgeändert aus (kein Vorrat zuletzt besuchter Orte bzw. kein Vorausladen), die Dateien im Projekt bleiben
  unverändert. Die früheren Gegenproben `sw-genau`, `ohne-verkleinern` und `rahmen-bleibt` sind seit dem Umbau
  fest eingebaut und entfallen.
- Meldet der Kern `SceneManager.phase`, teilt das Werkzeug die Wechsel nach diesen Phasen auf (`laden` bis zum
  Szenenaufbau, `aufbau`, `hochladen` = Bilder hinter der geschlossenen Blende zur Grafikkarte). Seit das Laden schon
  beim Tipp beginnt, fällt ein Teil des Ladens in `blende_zu`.
- Ausgangswerte vom 12.11.2026: `shots/ladezeit_vorher.json` (Zusammenfassung, Rohdaten in `shots/lz_*.json`),
  nach dem Umbau für schnelleres Laden: `shots/ladezeit_nachher.json`, nach der Nachprüfung (Laden ab dem Tipp,
  schneller erster Start, Blende 0,7 s): `shots/ladezeit_schluss.json`.
- Grenzen: Ein älteres Chrome (114) lässt sich mit puppeteer-core 25 nicht starten (Zeitüberschreitung beim Start);
  für einzelne Proben dort rohes CDP benutzen wie `alt_chrome.mjs`.

## Test mit einem älteren Chrome (wie auf dem Tablet)

Der Chrome auf dem Rechner ist neuer als der Browser auf dem Tablet. Vor dem Veröffentlichen einmal mit einer älteren
Fassung prüfen, ob das Spiel startet:

```
npx @puppeteer/browsers install chrome@114 --path <ordner>
CHROME=<ordner>/chrome/win64-114…/chrome-win64/chrome.exe node tools/alt_chrome.mjs <projektordner> "index.html?szene=karte&test=1" 9
```

Ausgabe: `{stand: {laden, bereit, szene, sigoFehler, meldung}, fehler: […]}`. `laden: true` heißt: Das Spiel hängt bei
den drei Punkten. So fiel am 12.11.2026 auf, dass die Import-Karte in index.html vor `modulepreload` stehen muss.

