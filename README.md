# Sigo – Züge bauen, schmücken und fahren lassen

Ein 3D-Tablet-Spiel für kleine Kinder (ab ca. 3 Jahren): eigenen Zug zusammenbauen,
anmalen, schmücken, beladen – dann mit dem Finger eine Strecke malen und losfahren.

Ohne Punkte, ohne Zeitdruck, ohne Werbung, ohne Internet – und mit eingebautem Ende.

## Die drei Bereiche (Knöpfe oben links)

### 🛠️ Werkstatt
Unten ist eine Leiste mit vier Fächern:

| Fach | Was passiert |
|---|---|
| 🚃 Teile | Lok antippen → Lok wird getauscht. Wagen antippen → wird hinten angehängt (max. 5). Wagen **am Zug** antippen → wird abgekoppelt. Lok am Zug antippen → pfeift. |
| 🎨 Farben | Farbtopf wählen, dann ein Teil des Zugs antippen (Kessel, Dach, Räder …) – oder den Topf direkt auf den Zug ziehen. |
| ⭐ Schmuck | Stern, Herz, Blume, Lampe, Fähnchen, Luftballon – antippen oder auf einen Wagen ziehen. Schmuck am Zug antippen → weg. |
| 🐄 Ladung | Tiere, Kinder, Oma, Teddy, Kisten … – antippen (steigt in den nächsten freien Wagen) oder auf einen Wagen ziehen. Mitfahrer antippen → steigt aus. |

Alles wird laut benannt („Tierwagen“, „Lila“, „Kuh … Muuh“). Der Tankwagen nimmt keine Ladung –
er hüpft nur kurz (Fehlerkontrolle ohne Fehlerton).

### ✏️ Strecke malen
Mit dem Finger eine Linie auf die Wiese malen. Daraus werden automatisch Schienen:
- Der Kreis schließt sich von selbst.
- Zu kleine Kreise werden vergrößert, damit der Zug passt; ein gerader Strich wird zum Oval.
- Bäume und Häuser, die im Weg stehen, verschwinden.

### 🚂 Fahren
- Großer grüner Knopf ▶ = losfahren / ⏸ anhalten
- 📯 = pfeifen/hupen (auch: Zug antippen)
- 🎥 = Kamera fährt neben dem Zug mit
- Bäume und Häuser antippen → sie wackeln

Zug und Strecke bleiben gespeichert – beim nächsten Mal ist alles wieder da.

## Eltern-Bereich

**Zahnrad oben rechts 3 Sekunden gedrückt halten.**

| Einstellung | Standard |
|---|---|
| Sprache (Deutsch / English) | Deutsch |
| Spielzeit (10 / 15 / 20 / 30 Min. / unbegrenzt) | 15 Min. |
| Pause danach | 30 Min. |
| Stimme / Sprechtempo / Geräusche | an / normal / an |
| Zug zurücksetzen, Strecke zurücksetzen | – |

Ist die Spielzeit um, sagt die App „Der Zug ist müde …“ und der Zug schläft (Mond-Bildschirm).
Erst nach der Pause – oder über den Eltern-Bereich – geht es weiter.

## Auf das Android-Tablet bringen

Die App ist eine Web-App (PWA) und braucht für Installation und Offline-Betrieb eine **https-Adresse**.

**GitHub Pages (kostenlos):**
1. Den Branch in `main` mergen.
2. Auf GitHub: *Settings → Pages → Source: Deploy from a branch → `main` / `(root)`* → Speichern.
   (Bei privaten Repos braucht Pages ein kostenpflichtiges GitHub-Konto. Alternativ das Repo öffentlich machen – es enthält keine privaten Daten.)
3. Nach ca. 1 Minute: `https://<benutzername>.github.io/<repo-name>/`
4. Auf dem Tablet in **Chrome** öffnen → Menü ⋮ → **„App installieren“ / „Zum Startbildschirm hinzufügen“**.
5. Einmal mit Internet öffnen – danach läuft sie offline. Updates kommen automatisch, sobald wieder Internet da ist.

**Zum Ausprobieren am Computer:**
```bash
python3 -m http.server 8000
# dann http://localhost:8000 öffnen
```

### Wichtige Tablet-Einstellungen
- **Deutsche Stimme:** *Einstellungen → System → Sprachen → Sprachausgabe* → Google Sprachausgabe, Deutsch installieren.
  Im Eltern-Bereich steht, ob eine Stimme gefunden wurde.
- **App fixieren** (damit das Kind nicht herauskommt): *Einstellungen → Sicherheit → App-Fixierung*.
- **Lautstärke** vorher auf ein ruhiges Maß stellen.

## Technik (zum Erweitern)

Reines HTML/JavaScript mit [three.js](https://threejs.org) (liegt in `vendor/`, MIT-Lizenz). Kein Build-Schritt.
Alle Modelle sind aus einfachen Formen gebaut, alle Geräusche werden live erzeugt – keine Bild- oder Sounddateien.

```
index.html                 Einstiegsseite
css/style.css              Aussehen der Knöpfe und Leisten
js/app.js                  Start, Spielzeit/Pause, Eltern-Bereich
js/catalog.js              Loks, Wagen, Farben, Schmuck, Ladung
js/i18n.js                 Alle Texte und Namen je Sprache
js/audio.js                Geräusche + Sprachausgabe
js/settings.js             Speichern auf dem Gerät
js/game/game.js            3D-Kern: Kamera, Bildschleife, Eingabe
js/game/trainModel.js      3D-Modelle von Loks, Wagen, Schmuck, Ladung
js/game/train.js           Zug anordnen / auf Strecke setzen
js/game/track.js           Aus Fingerstrich wird Schienenstrecke
js/game/world.js           Werkstatt und Landschaft
js/game/modes/*.js         Werkstatt, Malen, Fahren
sw.js                      Offline-Speicher (neue Dateien in ASSETS eintragen)
```

- **Neuer Wagen:** Eintrag in `WAGONS` (`catalog.js`), Bau-Funktion in `trainModel.js` (`BUILDERS`), Name in `i18n.js`.
- **Neue Ladung / neuer Schmuck:** Eintrag in `CARGO` bzw. `DECOR` + Name in `i18n.js`.
- **Neue Sprache:** Block in `LANGUAGES` (`i18n.js`).

## Ehrliche Grenzen

- Die Grafik ist für Tablets der letzten ~5 Jahre gedacht. Auf sehr alten Geräten kann es ruckeln.
- Tierlaute kommen aus der Sprachausgabe („Muuh“) und klingen künstlich.
- Selbstkreuzende Strecken (Acht) sind erlaubt, aber es gibt keine Brücke – der Zug fährt „durch“ die Kreuzung.

## Ideen für später
- Bahnhof: Zug hält an, Fahrgäste steigen ein/aus
- Tunnel und Brücke zum Hinsetzen
- Weichen / zwei Züge
- Eigene Fotos als Fahrgäste, selbst eingesprochene Tierlaute
