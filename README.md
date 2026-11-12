# Sigo – ein ruhiges Bilderbuch-Spiel

Sigo ist ein Spiel für Kinder von etwa 3–4 Jahren, gemacht für ein Tablet im Querformat (Huawei MatePad 11).
Ein kleiner Zug fährt über eine Landkarte zu vielen Orten – Bauernhof, Bahnhof, Feuerwehr, Baustelle, Garten,
Teich, Wald, Spielplatz, Malhaus, Eisdiele, Musik, Waschanlage und zum Schluss ins Schlafzimmer. Überall wird in
gemalten Bildern gespielt: antippen, ziehen, wischen, halten.

- Kein Text zum Lesen, keine Punkte, keine Zeit, kein Scheitern, keine Werbung, kein Internet nötig.
- Alles ist ruhig: kein Blinken, kein Blitzen, leise Musik, wenige gesprochene Sätze.
- Gesammelte Sticker landen im Album (Knopf oben rechts). Die Landkarte erreicht man immer oben links.
- **Schlafenszeit:** Im Schlafzimmer bringt das Kind vier müde Tiere ins Bett, deckt sie zu und macht das Licht aus.
  Danach kommt ein ruhiges Nachtbild mit schlafendem Mond.

## Für Eltern

### Eltern-Bereich
Unten rechts auf dem Startbild, auf der Landkarte und im Nachtbild sitzt ein kleines, blasses **Zahnrad**.
**3 Sekunden mit einem Finger darauf halten** (ein Ring füllt sich) – kurzes Tippen lässt es nur wackeln; liegt
dabei eine ganze Hand oder ein zweiter Finger auf dem Bildschirm, beginnt der Ring von vorn. Danach kommt eine
kleine Aufgabe für Erwachsene („Tippe auf die Zahl sieben"). Ein falscher Tipp, ein Tipp neben das Fenster oder
30 Sekunden Warten führen zurück ins Spiel. Solange der Bereich offen ist, steht das Spiel still; nach 3 Minuten
ohne Berührung schließt er sich von selbst. Dort lässt sich einstellen:

| | |
|---|---|
| Lautstärke | Musik, Geräusche und Stimme getrennt; „Stimme erklärt bei jedem Besuch" (sonst erklärt sie jeden Ort einmal am Tag; hat das Kind nach einem Hinweis lange nichts getan, kommt er einmal wieder) |
| Spielzeit pro Tag | Aus, 15, 20, 30 (Standard), 45 oder 60 Minuten; Anzeige „heute gespielt". Ausschalten oder Erhöhen mit Nachfrage |
| Noch 10 Minuten | verlängert die heutige Spielzeit (mit Nachfrage) |
| Spielzeit zurücksetzen | heute wieder bei 0 beginnen (mit Nachfrage) |
| Sätze wieder sprechen | die Stimme erklärt alles wieder wie beim ersten Mal |
| Sticker-Album leeren, Zug zurücksetzen | mit Nachfrage |
| Vollbild | an/aus |

### Wie die Spielzeit funktioniert
Gezählt wird nur, solange das Spiel sichtbar ist und das Kind in der letzten Minute etwas berührt hat.
Ist die Zeit um, wird nicht mitten im Spiel abgebrochen: Beim nächsten ruhigen Moment (spätestens nach einer
Minute) geht es ins Schlafzimmer – „Sigo ist müde. Bringen wir alle ins Bett." Nach dem Gute-Nacht-Ritual bleibt
das Nachtbild stehen. Jeder Neustart an diesem Tag führt direkt dorthin, bis Sie im Eltern-Bereich
„Noch 10 Minuten" oder „Spielzeit zurücksetzen" wählen. Am nächsten Tag beginnt die Zeit von vorn.

### Auf das Tablet bringen
Sigo ist eine Web-App und braucht für Installation und Offline-Betrieb eine **https-Adresse**, z. B. GitHub Pages:

1. Auf GitHub: *Settings → Pages → Source: Deploy from a branch → `main` / `(root)`* → Speichern.
2. Nach etwa einer Minute ist das Spiel unter `https://<benutzername>.github.io/<repo-name>/` erreichbar.
3. Auf dem Tablet in **Chrome** öffnen → Menü ⋮ → **„App installieren"** bzw. **„Zum Startbildschirm hinzufügen"**.
4. Einmal mit Internet starten und kurz warten – danach läuft Sigo auch ohne Internet (im Eltern-Bereich steht
   unten „offline spielbar"). Neue Fassungen lädt das Tablet still im Hintergrund, sobald Internet da ist; sie
   gelten erst, wenn Sigo neu startet oder im Hintergrund lag – nie mitten im Spiel. Bricht das Laden ab
   (wackliges WLAN), bleibt die alte, vollständige Fassung, und es wird beim nächsten Start erneut versucht.

Tipps: Lautstärke des Tablets vorher auf ein ruhiges Maß stellen. Mit der **App-Fixierung** des Tablets
(*Einstellungen → Sicherheit → App-Fixierung*) kommt das Kind nicht aus dem Spiel heraus.

## Für Entwickler

Reines HTML + JavaScript-Module mit [PixiJS 8](https://pixijs.com) (`vendor/pixi.min.mjs`, MIT-Lizenz), **kein
Build-Schritt**. Die Bau-Regeln stehen in [`ENTWICKLUNG.md`](ENTWICKLUNG.md), die Hilfsprogramme in
[`tools/README.md`](tools/README.md).

**Starten am Rechner:**
```bash
python -m http.server 8000
# dann http://localhost:8000/ öffnen
```
Auf `localhost` ist der Offline-Speicher absichtlich aus (man sieht immer die frischen Dateien); mit `?sw=1`
lässt er sich zum Ausprobieren einschalten.

**Testen:**
- `http://localhost:8000/?szene=schlafen&test=1` startet direkt in einem Ort; `test=1` schaltet die
  Spielzeit-Begrenzung aus und legt `window.__sigo` zum Fernsteuern an.
- `&spielzeit=20` setzt im Testbetrieb eine Grenze von 20 Sekunden; `?szene=schlafen&ende=1` bzw. `&ruhe=1`
  zeigt das Schlafzimmer nach Ablauf der Spielzeit bzw. gleich das Nachtbild.
- Testfotos mit echtem Chrome: `node tools/shot.mjs --szene schlafen --out shots/x.jpg --aktionen '…'`
  (einmalig vorher `cd tools && npm install`).

**Veröffentlichen:** Nach jeder Änderung an Code, Bildern oder Tönen einmal
```bash
python tools/sw_liste.py            # schreibt sw-dateien.js neu
python tools/sw_liste.py --pruefen  # Kontrolle vor dem Push: Exit-Code 1, wenn sw-dateien.js veraltet ist
```
laufen lassen. Das Skript schreibt `sw-dateien.js` neu (Liste aller Spieldateien mit Prüfsummen und ein
Versions-Stempel). Nur wenn sich dieser Stempel ändert, bekommt das Tablet die neue Fassung – ohne neuen Stempel
**nie**. Dabei holt es nur die geänderten Dateien aus dem Netz, unveränderte übernimmt es aus dem alten Speicher.
Danach wie gewohnt committen und auf `main` pushen.
