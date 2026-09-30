# Sigo – ruhige Lernspiele für Kleinkinder

Ein Tablet-Spiel für ein 3-jähriges Kind, **inspiriert** von Montessori:
ruhig, ohne Punkte, ohne Zeitdruck, ohne Werbung, ohne Internet – und mit eingebautem Ende.

## Aktivität 1: Aufräumen

Tiere, Fahrzeuge und Musikinstrumente liegen durcheinander und kommen in ihren Korb.

- **Antippen** → das Ding wird benannt („Kuh“) und macht sein Geräusch („Muuh“, Tatütata, Trommel …)
- **In den richtigen Korb ziehen** → es springt hinein und bleibt dort sichtbar
- **Falscher Korb** → es rutscht sanft zurück. Kein Fehlerton, kein rotes X
  (Montessori: die Fehlerkontrolle steckt im Material)
- **Korb antippen** → die Kategorie wird genannt („Tiere“)
- Das blasse Bild im Korb zeigt, was hinein gehört
- Nach jeder Runde entscheidet das Kind selbst mit ▶, ob es weitergeht
- Die Punkte oben zeigen, wie viele Runden es noch gibt
- Nach der letzten Runde schläft der Bär ein: „Fertig für heute“. Danach ist Pause.

## Eltern-Bereich

**Zahnrad oben rechts 3 Sekunden gedrückt halten.** Einstellbar sind:

| Einstellung | Standard |
|---|---|
| Sprache (Deutsch / English) | Deutsch |
| Themen (Tiere, Fahrzeuge, Musik) | Tiere + Fahrzeuge |
| Körbe pro Runde | 2 |
| Dinge pro Runde | 4 |
| Runden pro Spielzeit | 5 |
| Pause danach | 30 Min. |
| Stimme / Geräusche / Sprechtempo | an / an / normal |

Empfehlung: klein anfangen (2 Körbe, 3–4 Dinge) und erst steigern, wenn es zu leicht wird.
Einstellungen bleiben nur auf dem Tablet gespeichert.

## Auf das Android-Tablet bringen

Die App ist eine Web-App (PWA). Für Installation und Offline-Betrieb braucht sie eine **https-Adresse**.

**Weg 1 – GitHub Pages (kostenlos):**
1. Den Branch in `main` mergen.
2. Auf GitHub: *Settings → Pages → Source: Deploy from a branch → `main` / `(root)`* → Speichern.
   (Bei privaten Repos braucht Pages ein kostenpflichtiges GitHub-Konto. Alternativ das Repo öffentlich machen – es enthält keine privaten Daten.)
3. Nach ca. 1 Minute ist die App unter `https://<benutzername>.github.io/<repo-name>/` erreichbar.
4. Auf dem Tablet in **Chrome** öffnen → Menü ⋮ → **„Zum Startbildschirm hinzufügen“ / „App installieren“**.
5. Einmal öffnen, solange Internet da ist – danach läuft sie offline.

**Weg 2 – nur zum Ausprobieren am Computer:**
```bash
python3 -m http.server 8000
# dann http://localhost:8000 im Browser öffnen
```

### Wichtige Tablet-Einstellungen

- **Deutsche Stimme:** *Einstellungen → System → Sprachen → Sprachausgabe* → Google Sprachausgabe,
  Deutsch installieren. Im Eltern-Bereich steht, ob eine Stimme gefunden wurde.
- **App fixieren** (damit das Kind nicht aus der App kommt): *Einstellungen → Sicherheit → App-Fixierung* einschalten,
  dann in der App-Übersicht auf das App-Symbol → „Fixieren“.
- **Lautstärke** vorher auf ein ruhiges Maß stellen.

## Aufbau (zum Erweitern)

```
index.html              Einstiegsseite
css/style.css           Aussehen (Farben ganz oben)
js/app.js               Ablauf: Start, Runden, Pause, Eltern-Bereich
js/audio.js             Geräusche (live erzeugt) + Sprachausgabe
js/i18n.js              Alle Texte je Sprache
js/items.js             Kategorien und Dinge (Emoji, Name, Lautwort, Geräusch)
js/settings.js          Einstellungen speichern
js/activities/          Eine Datei pro Aktivität
sw.js                   Offline-Speicher
```

- **Neues Tier/Fahrzeug/Instrument:** eine Zeile in `ITEMS` und Namen in `NAMES` (`js/items.js`).
- **Neue Sprache:** Block in `LANGUAGES` (`js/i18n.js`) + Namen in `NAMES`.
- **Neue Aktivität:** Datei in `js/activities/` mit `{ id, icon, titleKey, play(stage, ctx) }`, in `activities/index.js` eintragen.
- **Nach jeder Änderung** in `sw.js` die `VERSION` erhöhen (und neue Dateien in `ASSETS` eintragen), sonst zeigt das Tablet die alte Fassung.

## Ehrliche Grenzen

- Die Bilder sind Emojis (Platzhalter). Montessori bevorzugt **realistische Bilder** – ein nächster Schritt wären echte Fotos, gern eure eigenen.
- Die Tierlaute spricht die Sprachausgabe („Muuh“) – das klingt künstlich. Echte Aufnahmen (selbst eingesprochen!) wären schöner.
- Ein Bildschirm ersetzt keine echten Gegenstände. Am besten spielt ihr parallel echtes Sortieren: Spielzeugtiere und -autos in zwei Kisten.

## Ideen für die nächsten Aktivitäten

1. Geräusche-Rätsel: Ein Geräusch ertönt – welches Tier/Fahrzeug war es? (2 Auswahlbilder)
2. Groß und klein: Dinge der Größe nach ordnen (wie der Rosa Turm)
3. Farben sortieren: rote Dinge zu Rot, blaue zu Blau
4. Musik machen: Instrumente antippen, einfache Melodie
