# Sigo – Züge bauen, schmücken und fahren lassen

Ein 3D-Tablet-Spiel für kleine Kinder (ab ca. 3 Jahren): eigenen Zug zusammenbauen,
anmalen, schmücken, beladen – dann mit dem Finger eine Strecke malen und losfahren.

Ohne Punkte, ohne Zeitdruck, ohne Werbung, ohne Internet – und mit eingebautem Ende.

## Die drei Bereiche (Knöpfe oben links)

### 🛠️ Werkstatt
Unten: oben eine Reihe Fächer (mit Beschriftung), darunter große Karten – mit ◀ ▶ blättern (oder wischen).

| Fach | Inhalt |
|---|---|
| 🚂 Loks | Dampflok, Diesellok, E-Lok, Schnellzug |
| 🚃 Wagen | Personen-, Güter-, Tier-, Flach-, Zirkus-, Schluss-, Tank-, Holz-, Kohle-, Kranwagen, Autotransporter (max. 6) |
| 🎨 Farben | 10 Farben – Topf wählen, dann ein Teil antippen (Kessel, Dach, Räder …) oder den Topf auf den Zug ziehen |
| ⭐ Schmuck | Gesicht, Stern, Herz, Blume, Lampe, Lichterkette, Glocke, Fähnchen, Luftballon, Regenbogen |
| 🐄 Tiere | Kuh, Schwein, Schaf, Pferd, Hund, Katze, Huhn, Hahn, Ente, Hase, Frosch, Löwe, Elefant, Giraffe, Pinguin |
| 🧸 Mitfahrer | Kind, Papa, Oma, Teddy, Ball, Kiste, Geschenk, Milchkanne, Apfel |

**Ziehen:** Beim Ziehen leuchtet ein Ring unter dem Wagen, auf dem es landen wird – man muss nicht genau treffen.
**Wegnehmen:** Mitfahrer, Schmuck oder Wagen vom Zug **in die Leiste ziehen** → weg. Auf einen anderen Wagen ziehen → umsetzen.
**Antippen am Zug** ist immer harmlos: Tiere machen ihr (echtes) Geräusch und werden benannt, der Lokführer winkt und pfeift,
der Kran schwenkt, die Glocke läutet, die Spielzeugautos hupen.
**Zeige-Hand:** Passiert eine Weile nichts, zeigt eine Hand, wie man etwas auf den Zug zieht.

### 🛤️ Strecke bauen
- Großes Spielfeld (Holzzaun). **Ein Finger verschiebt die Ansicht, zwei Finger zoomen** (am Computer: Mausrad).
- **✏️ Stift** antippen, dann mit dem Finger eine Linie malen → Schienen. Der Kreis schließt sich von selbst.
  Danach schaltet der Stift wieder ab – so wird die Strecke nicht aus Versehen überschrieben.
- In der Leiste: **Bahnhof, Tunnel, Brücke, Waschanlage, Tankstelle, Bahnübergang**.
  Antippen → setzt sich an eine freie Stelle. Ziehen → rastet an der Strecke ein.
  Gesetzte Dinge lassen sich entlang der Strecke verschieben; in die Leiste ziehen = weg.

### 🚂 Fahren
- ▶ = losfahren / ⏸ anhalten · 📯 = pfeifen · 🎥 = Kamera fährt mit · unten links: 🌞/🌙 Tag & Nacht, 🌤️/🌧️/❄️ Wetter – die Knöpfe zeigen immer den aktuellen Zustand
- **Bahnhof:** Der Zug hält von selbst („Bahnhof! Wer steigt ein?“). Wartende antippen → hüpfen in den Zug.
  Mitfahrer im Zug antippen → steigen aus. ▶ blinkt = weiterfahren.
- **Tankstelle:** Steht eine an der Strecke, brauchen Dampflok (Kohle 🪨 + Wasser 💧) und Diesellok (Diesel ⛽) Vorräte – Anzeige oben links.
  Ist etwas knapp, hält der Zug dort. Wasserturm, Kohlebunker oder Zapfsäule antippen → füllt auf. Leer = der Zug schleicht nur noch.
  E-Lok und Schnellzug brauchen nichts (fahren mit Strom).
- **Waschanlage:** Der Zug wird beim Fahren schmutzig (bei Regen schneller). In der Waschanlage drehen sich die Bürsten, es schäumt – blitzsauber.
- **Tunnel:** drinnen wird es dunkel, die Lampen gehen an, die Pfeife hallt.
- **Brücke:** über einen Fluss (manchmal springt ein Fisch); die Schienenstöße klingen hohl.
- **Bahnübergang:** Schranke geht zu, Licht blinkt, Glocke bimmelt, die Autos warten. Autos antippen → hupen.
- Tiere auf der Weide antippen → sie rufen; Bäume und Häuser wackeln.
- Jede Lok fährt anders schnell (Schnellzug am schnellsten).

**Tiergeräusche** sind echte Aufnahmen (gemeinfrei, CC0 – Quellen in `sounds/QUELLEN.md`) für Kuh, Schwein, Schaf,
Hund, Katze, Huhn, Hahn und Frosch. Ente, Pferd, Löwe, Elefant und Pinguin sind nachgebaut (keine freien Aufnahmen erreichbar).

Leise Xylophon-Musik läuft im Hintergrund (im Eltern-Bereich abschaltbar).
Zug, Strecke und alles an der Strecke bleiben gespeichert.

## Eltern-Bereich

**Zahnrad oben rechts 3 Sekunden gedrückt halten.**

| Einstellung | Standard |
|---|---|
| Sprache (Deutsch / English) | Deutsch |
| Spielzeit (10 / 15 / 20 / 30 Min. / unbegrenzt) | 15 Min. |
| Pause danach | 30 Min. |
| Stimme / Sprechtempo / Geräusche | an / normal / an |
| Musik / Musik-Lautstärke | an / mittel |
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
js/audio.js                Geräusche, Zuggeräusche + Sprachausgabe
js/music.js                Xylophon-Hintergrundmusik (live erzeugt)
js/settings.js             Speichern auf dem Gerät
js/game/game.js            3D-Kern: Kamera, Bildschleife, Eingabe
js/game/trainModel.js      3D-Modelle von Loks und Wagen, Schmuck
js/game/figures.js         3D-Tiere, Menschen, Ladung
js/game/textures.js        Per Code gezeichnete Texturen (Holz, Gras, Schotter, Wasser)
js/game/train.js           Zug anordnen / auf Strecke setzen
js/game/track.js           Aus Fingerstrich wird Schienenstrecke
js/game/world.js           Werkstatt und Landschaft
js/game/trackObjects.js    Bahnhof, Tunnel, Brücke, Waschanlage, Tankstelle, Bahnübergang
js/game/environment.js     Tag/Nacht, Regen, Schnee, Tunnel-Dunkelheit
js/game/lamps.js           Lampen, die nachts heller leuchten
sounds/                    Tiergeräusche (MP3, CC0) + QUELLEN.md
js/game/modes/*.js         Werkstatt, Strecke bauen, Fahren
js/game/tray.js            Leiste unten (Fächer + Karten mit Blätter-Pfeilen)
sw.js                      Offline-Speicher (neue Dateien in ASSETS eintragen)
```

- **Neuer Wagen:** Eintrag in `WAGONS` (`catalog.js`), Bau-Funktion in `trainModel.js` (`BUILDERS`), Name in `i18n.js`.
- **Neue Ladung / neuer Schmuck:** Eintrag in `CARGO` bzw. `DECOR` + Name in `i18n.js`.
- **Neue Sprache:** Block in `LANGUAGES` (`i18n.js`).

## Ehrliche Grenzen

- Tierlaute kommen aus der Sprachausgabe („Muuh“) und klingen künstlich.
- Die Grafik ist auf neuere Tablets ausgelegt; ruckelt es, senkt die App automatisch die Auflösung.
- Selbstkreuzende Strecken (Acht) sind erlaubt, aber es gibt keine Brücke – der Zug fährt „durch“ die Kreuzung.

## Ideen für später
- Lieferaufträge mit Kran (Kisten am Bauernhof abholen)
- Landschaft selbst gestalten (Bäume, Häuser, Tiere setzen)
- Eigene Fotos als Fahrgäste, selbst eingesprochene Laute
- Weichen / zwei Züge (eher für ältere Kinder)
