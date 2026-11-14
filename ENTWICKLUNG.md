# Sigo 2 – Bau-Regeln (für alle, die am Spiel arbeiten)

Sigo 2 ist ein Bilderbuch-Spiel für ein Kind von 3–4 Jahren auf einem Huawei MatePad 11
(2560×1600 Bildpunkte, 120 Hz, Snapdragon 865, Browser auf Chromium-Basis, als Web-App installiert).
Eine Landkarte führt zu vielen Orten; an jedem Ort wird in gemalten Szenen von der Seite gespielt.

Der alte 3D-Code (`js/`, `css/`, `models/`, `tools/blender/`, `vendor/three*`) ist tot und wird später gelöscht.
**Nicht lesen, nicht benutzen, nicht verändern.** Das neue Spiel liegt in `src/`, `assets/`, `tools/`.

## 1. Oberste Regeln

### Ruhe-Regeln (Wunsch der Eltern, nicht verhandelbar)
- Kein Blitzen, kein Stroboskop, kein schnelles Blinken. Helligkeit oder Farbe ändern sich nur weich (Übergang ≥ 0,5 s).
  Das gilt auch für Blaulicht, Feuerwerk, Belohnungen, Blitze bei Gewitter (gibt es nicht).
- Keine Bildschirm-Wackler, keine schnellen Kamerafahrten, kein Zoom-Gezappel. Kamera bewegt sich weich und langsam.
- Wenige, langsame Partikel (höchstens ~40 pro Effekt, ~150 gleichzeitig). Sie schweben, sie schießen nicht.
- Höchstens zwei Dinge bewegen sich gleichzeitig auffällig. Im Ruhezustand nur sanftes Atmen/Wiegen.
- Töne weich und nicht schrill; nichts überlagert sich zu Lärm. Musik ruhig und fröhlich.
- Belohnung = ein freundlicher Moment (Tier freut sich, ein paar Herzen/Sterne, ein Ton), kein Feuerwerk aus Reizen.

### Regeln für kleine Hände
- Kein Text zum Lesen im Spiel (nur im Eltern-Bereich). Alles über Bilder, Töne, wenige gesprochene Worte.
- Nur Tippen, Ziehen, Wischen, Halten. Keine Doppeltipps, kein langes Drücken als Pflicht, keine Zwei-Finger-Gesten.
- Reaktion sofort beim Berühren (`pointerdown`), nicht erst beim Loslassen.
- Ziele groß: Tippflächen mindestens 200 Einheiten (siehe Bühne), lieber 260+. Beim Ziehen großzügig einrasten.
- Nichts kann falsch gemacht werden: kein Scheitern, keine Punkte, keine Zeit, keine Strafe. „Falsch" = lustiger Hinweis.
- Alles Sichtbare reagiert beim Antippen (mindestens Wackeln + Ton). Nichts ist tot.
- Jede Tätigkeit ist eine kurze Schleife und geht endlos weiter (setzt sich sanft zurück). Nie eine Sackgasse.
- Mehrere Finger gleichzeitig dürfen nichts kaputt machen (jeder Finger zählt einzeln).
- Oben und unten 70 Einheiten Rand ohne wichtige Ziele (Systemgesten).
- Passiert 6 s nichts, zeigt eine Zeige-Hand, was man tun kann.
- Wenig reden: jeder Satz einmal am Tag, danach Geräusche. Sprache: Deutsch, mit echten Umlauten.

## 2. Technik

- Reines HTML + ES-Module, **kein Build-Schritt**. Grafik: PixiJS 8 (`vendor/pixi.min.mjs`, Import-Map-Name `pixi`).
  Typen und Doku zum Nachschlagen: `tools/node_modules/pixi.js/dist/pixi.js.d.ts` bzw. `…/lib/**/*.d.ts`.
  Renderer **WebGL** erzwingen (`preference: 'webgl'`), kein WebGPU.
- Ton: Web Audio API (eigener kleiner Kern, keine Bibliothek).
- Speicher: `localStorage` (Schlüssel beginnen mit `sigo2.`).
- Läuft offline (Service Worker `sw.js`), installierbar (`manifest.webmanifest`).
- Zum Ausprobieren: `python -m http.server 8000` im Projektordner, dann `http://localhost:8000/`.

### Ordner
```
index.html                Einstieg (Import-Map, Canvas, Start)
src/main.js               Start: Engine hochfahren, Szenen anmelden, erste Szene
src/engine/*.js           Spielkern (siehe Abschnitt 3) – index.js exportiert alles
src/scenes/<id>/index.js  eine Szene = ein Ort; darf weitere Dateien im selben Ordner haben
src/scenes/<id>/texte.js  export default { '<id>_hallo': 'Gesprochener Satz', … }  (für die Stimme)
assets/<pack>/pack.json   Bilder- und Ton-Liste eines Pakets (siehe Abschnitt 4)
assets/<pack>/*.webp|mp3  fertige Spieldateien
art/<pack>/…              Rohbilder aus Higgsfield (nicht in Git)
tools/                    Hilfsprogramme (bild.py, ton.py, shot.mjs)
shots/                    Testfotos (nicht in Git)
```

### Bühne und Maße
- Die Bühne ist immer **1600 Einheiten hoch**. Die Breite folgt dem Bildschirm: 2560 am Tablet (16:10).
  `stage.W`, `stage.H` (=1600), `stage.cx`, `stage.cy`.
- Alles Wichtige liegt im **Kernbereich**: 2133×1600 in der Mitte (x von `cx-1066` bis `cx+1066`). Der ist auf jedem
  Bildschirm zu sehen. Hintergründe sind mindestens 2840 breit, damit auch breite Bildschirme gefüllt sind.
- Szenen rechnen in „Szenen-Koordinaten": Ursprung = Mitte unten ist unpraktisch – wir nehmen **x=0 in der Bildmitte,
  y=0 oben, y=1600 unten**. `scene.world` ist so verschoben, dass x=0 die Bildschirmmitte ist. Am Tablet reicht der
  sichtbare Bereich also von x=-1280 bis x=+1280.
- Auflösung: echte Gerätepixel (bis 2560×1600). Ein Wächter senkt sie stufenweise, wenn Bilder zu lange dauern,
  und hebt sie wieder an, wenn es 20 s lang flott läuft.
- Bewegung immer mit `dt` (Sekunden) rechnen, nie pro Bild – das Tablet läuft mit 120 Bildern pro Sekunde.

## 3. Spielkern (`src/engine/`) – Schnittstelle

Szenen importieren nur aus `../../engine/index.js`. Die Schnittstelle unten ist verbindlich; wer mehr braucht,
baut es im eigenen Szenen-Ordner oder meldet den Wunsch – der Kern wird nicht nebenbei von Szenen geändert.

```js
import { Scene, stage, spr, tex, meta, hasTex, tween, ease, sfx, sfxSchleife, music, voice, note, animal,
         tap, drag, wipe, hold, Actor, fx, ui, store, ambient, Parallax, rand, pick, clamp, lerp,
         PIXI } from '../../engine/index.js';
```

### Szene
```js
export default class Bauernhof extends Scene {
  static id = 'bauernhof';
  static packs = ['bauernhof', 'tiere'];   // 'common' ist immer geladen
  static tiere = ['kuh', 'schwein'];        // nur diese Tiere aus 'tiere' laden (siehe „Pakete“)
  static music = 'common/musik_wiese';      // optional
  async enter(params) { … }                 // Aufbau. Ebenen: this.bg, this.world, this.front, this.hud
  update(dt, t) { … }                       // dt Sekunden (höchstens 0.05), t Sekunden seit enter
  exit() { … }                              // optional; Aufräumen macht der Kern
  hints() { return [obj, …]; }              // optional: worauf die Zeige-Hand zeigen darf (erstes sichtbares)
}
```
- Ebenen (Pixi-Container, alle mit x=0 in der Bildmitte außer `hud`): `bg` (Himmel/Hintergrund), `world` (Spiel),
  `front` (Vordergrund, Effekte), `hud` (Knöpfe; Koordinaten 0…stage.W / 0…stage.H).
- An die Szene gebunden (endet automatisch beim Verlassen): `this.tween(obj, props, dauer, opt)`, `this.wait(sek)`
  (Promise), `this.after(sek, fn)`, `this.every(sek, fn)`, `this.go(id, params)` (Szenenwechsel mit weicher Blende:
  eine cremefarbene Wolkendecke zieht in 0,7 s zu und in 0,7 s wieder auf, Helligkeit ändert sich fast gleichmäßig –
  die Ruhe-Regel verlangt mindestens 0,5 s, gemessen von 10 % bis 90 % Deckkraft sind es ≈ 0,52 s). Geladen wird
  schon ab dem Tipp, während die Blende zuzieht; hinter der geschlossenen Blende schiebt der Kern die Bilder der neuen
  Szene noch zur Grafikkarte (höchstens 0,8 s), damit beim Aufziehen nichts ruckelt. Bleibt das Laden länger,
  erscheinen nach 0,8 s die ruhigen Lade-Punkte.
- Zwischen dem Abbau der alten Szene und `enter()` der neuen wartet der Kern eine eigene Aufgabe ab: Was die alte
  Szene in `exit()` mit `setTimeout(…, 0)` angesetzt hat (z. B. eigene Bilder freigeben), ist dann erledigt – auch
  wenn dieselbe Szene sofort neu startet (Album → Album).
- Sicherheitsnetz beim Zeichnen: Wirft Pixi beim Zeichnen (z. B. ein Sprite mit schon zerstörter Textur), ersetzt
  der Kern kaputte Texturen durch leere, meldet den Fehler (`__sigo.errors`) und zeichnet weiter. Ohne das bliebe der
  Ticker stehen und das Spiel hinter der geschlossenen Blende hängen.
- `SceneManager.onWechsel((an) => …)` meldet Beginn (true) und Ende (false) jedes Wechsels (z. B. damit der
  Service Worker dann nicht lädt); `SceneManager.phase` sagt nur zum Messen, wo der Wechsel gerade steht.
- Kern-Haken am `SceneManager`: `onEnter(cb)`, `onExit(cb)`, `onIdle(cb, {after})` und `onLeave(cb)` – `onLeave`
  kommt, sobald ein Wechsel beginnt (die alte Szene ist noch zu sehen, die Blende zieht gerade zu). Solange die
  Blende schließt, ist `SceneManager.schliesst` true: Dann beginnt nichts Neues mehr (z. B. kein Satz der Stimme).
  Nach `await this.wait()/tween()` läuft Code nach dem Verlassen **nicht** weiter (das Promise bleibt offen).
  Im laufenden Spiel bleibt dagegen nie etwas hängen: Wird eine Bewegung durch eine neue auf denselben Feldern
  ersetzt (das Kind tippt an und es staucht, ein Finger greift, `hop` unterbricht `walkTo` …), erfüllt sich ihr
  Promise sofort mit `false`; erreicht sie ihr Ziel, mit `true`.
- Der Kern setzt in jede Szene (außer `karte`) oben links den Karten-Knopf – sobald eine Szene `karte` angemeldet
  ist. Szenen bauen keinen eigenen.
- Fehlt eine Szene oder scheitert ihr Aufbau, geht es zur Karte, sonst zur vorigen Szene (die Probe nur mit `test=1`).
- Aufräumen: Beim Verlassen zerstört der Kern alle Ebenen samt Graphics-Zeichendaten (sofort unsichtbar und ohne
  Eingabe, zerstört erst einen Augenblick später – so stolpert Code, der gerade noch nach einem `await` weiterläuft,
  nicht über halb abgebaute Dinge). Darum keinen `GraphicsContext`
  auf Modulebene über Szenen hinweg teilen. Texturen aus `Texture.from(canvas)` nie in `enter()`/pro Aufruf
  erzeugen (Pixi behält sie für immer): einmal pro Modul anlegen und wiederverwenden – oder in `exit()` selbst
  `destroy(true)`.

### Bilder
- `tex('pack/name')` → Textur; `hasTex(id)`; `meta(id)` → `{w,h,ax,ay,pts}` aus pack.json.
- `spr('pack/name', {x, y, scale, alpha, rotation, flip, anchor, parent, z})` → Sprite. Anker kommt aus pack.json
  (Standard: Mitte; Figuren und Dinge, die stehen: unten Mitte).

### Bewegung
- `tween(obj, {x, y, scale, scaleX, scaleY, rotation, alpha, skewX, …}, dauer, {ease, delay, yoyo, repeat, onUpdate})`
  → thenable (`true` = am Ziel, `false` = ersetzt) mit `.kill()` (abbrechen, Promise bleibt offen) und `.stop()`
  (anhalten, Promise mit `false`). In Szenen `this.tween` benutzen.
- Rückmeldungen des Kerns (Stauchen beim Antippen, Anheben beim Ziehen, `fx.pop/pulse`) merken sich gemeinsam die
  Ruhe-Größe eines Dings; läuft gerade ein Größen-Tween der Szene, gilt dessen Ziel. Nichts bleibt verzerrt.
- `ease`: `linear, quadIn, quadOut, quadInOut, cubicOut, cubicInOut, sineInOut, backOut, backIn, elasticOut, bounceOut`.
- Helfer: `rand(a,b)`, `pick(array)`, `clamp`, `lerp`.

### Eingabe
- `tap(obj, fn, {pad=30, sound='common/tipp', squash=true})` – löst beim Berühren aus. Mit `test=1` warnt der Kern
  in der Konsole, wenn eine Tippfläche schmaler als 200 Einheiten ist (nicht geprüft werden Dinge mit
  `eventMode = 'none'` und die Leisten-Kopien `trayKopie:…`). Je Ding entprellt: ein zweites Antippen innerhalb von
  120 ms zählt nicht (auch nicht mit einem zweiten Finger) – wer schnelles Trommeln braucht, merkt das.
- `drag(obj, {targets:[{obj, id, radius}], onStart, onMove, onDrop(target|null, ctx), back=true, lift=1.1})`
  – Ziehen mit großzügigem Einrasten; ohne Treffer gleitet das Ding zurück. `ctx.snapTo(target)` hilft beim Ablegen.
  Zurück geht es zum Heimplatz `ctx.heimX/heimY`: `opt.heim` ({x, y} oder Funktion), sonst der Ort beim Greifen –
  wird das Ding gepackt, während es noch heimgleitet, bleibt der alte Heimplatz (es wandert nicht davon).
  `ctx.startX/startY` ist immer der Ort beim Greifen (zum Messen, ob nur getippt wurde).
  Wird das Ding neu gegriffen, wirken `snapTo`/`back` eines älteren `ctx` nicht mehr. Eine Figur (Actor) hört beim
  Greifen auf zu laufen/hüpfen. Am Finger liegt das Ding ganz vorn (`zIndex` 100000); 0,5 s nach dem Loslassen
  bekommt es seinen alten `zIndex` zurück – **außer `onDrop` setzt selbst einen `zIndex`: der bleibt dann**.
- Treffertest: Eine `hitArea` auf einem **Container** gilt für ihn und alle Kinder – was außerhalb liegt, ist für
  Pixi nicht getroffen, auch wenn ein Kind dort eigene Tippflächen hat. Tippbare Kinder also in die Fläche legen
  oder dem Container keine `hitArea` geben.
- `globalpointermove` ist abgeschaltet (Kern: `features.globalMove = false`, spart Rechenzeit). Wer einem Finger
  außerhalb von `drag`/`hold`/`wipe` folgen will, hängt eigene Listener ans Fenster
  (`window.addEventListener('pointermove', …)`) und baut sie in `exit()` wieder ab.
- `wipe(obj, {radius=110, onProgress(p), onDone, sound})` – Wegwischen (Matsch, Schaum, Wolle): `obj` ist ein Sprite,
  das dort verschwindet, wo gewischt wird. `p` = Anteil 0…1; bei ~0.85 gilt es als fertig. Das Wischen folgt dem
  Finger: Ein Strich, der neben einem Fleck oder auf dem Fahrzeug beginnt, wischt jeden Fleck, über den er fährt
  (auch mehrere Flecken mit einem Strich). Kommt ein Finger so herein, bekommt das Ding ein `pointerdown` mit
  `hereingewischt: true` (wie beim Aufsetzen). Ein Finger, der etwas zieht (`drag`), wischt nicht nebenbei.
- `hold(obj, {onStart, onTick(dt), onEnd})` – solange der Finger drauf ist.
- `pointerCount({gross})` – wie viele Finger gerade aufliegen; mit `{gross: true}` zählt eine große Berührfläche
  (Handballen) wie viele. „Genau ein kleiner Finger" = `pointerCount({gross: true}) === 1` (Eltern-Zahnrad).
- Alle geben ein Objekt mit `.off()` zurück.

### Figuren
```js
const kuh = new Actor('kuh', {x, y, scale, flip, parent: this.world});   // Bilder tiere/kuh_<pose>
kuh.pose('idle' | 'happy' | 'eat' | 'sleep' | 'seite');   // fehlt eine Pose, bleibt 'idle'
await kuh.hop(); await kuh.hopTo(x, y); await kuh.walkTo(x, y); kuh.nod(); kuh.shake();
kuh.hopTo(x, y, {drehen: false});   // auch walkTo: Blickrichtung bleibt (z. B. ein Stück rückwärts)
kuh.stop();             // jede Bewegung anhalten (Promises der Bewegungen erfüllen sich mit false)
kuh.cheer();            // freut sich: Pose happy, Hüpfer, ein paar Herzen, Tierlaut (erneut innerhalb von 1,2 s:
                        // nur der Laut, kein neuer Sprung – Dauertippen zappelt nicht, auch nicht mit drag())
kuh.cheer({parent: seite.vorn});    // Herzen in diesem Container (gleiten mit der Seite), sonst in front
kuh.bubble('pack/bild', sek);       // Denkblase mit Bild (Wunsch zeigen); steht rechts vom Kopf, am rechten
                                    // Bildrand von selbst links (zur Mitte hin)
kuh.bubble('pack/bild', sek, {seite: 'links'});   // Seite fest wählen: 'links' | 'rechts'
kuh.sound();            // Tierlaut
kuh.point('mouth');     // Punkt aus pack.json (pts) in world-Koordinaten
```
Figuren atmen von selbst leicht und haben einen weichen Schatten. Bewegungen geben `Promise<boolean>` zurück
(`false` = von einer neueren Bewegung abgelöst). `hop()` während eines Hüpfers setzt nicht neu an.
Wird eine Figur abgebaut (`destroy`), während sie läuft oder hüpft, endet die Bewegung still mit `false`; Aufrufe
an einer abgebauten Figur tun nichts (`false`). `bubble()` mit einem unbekannten Bild warnt in der Konsole und zeigt
keine Blase (`false`).

### Effekte (`fx`) – alle ruhig
`fx.burst(art, x, y, {count, parent})` mit `art`: `'herzen' | 'sterne' | 'funkeln' | 'konfetti' | 'staub' |
'blasen' | 'tropfen' | 'blaetter' | 'rauch' | 'noten' | 'zzz'`; `fx.emitter(art, {x, y, rate, parent})` → `.stop()`;
`fx.pop(obj)`, `fx.wobble(obj)` (erneutes Wackeln geht weich aus dem jetzigen Ausschlag hervor; ein
Dreh-Tween der Szene auf dasselbe Ding beendet das Wackeln), `fx.pulse(obj)` (sanftes Größer/Kleiner als Hinweis), `fx.stern(x, y)` (Belohnungsstern
fliegt zum Album-Knopf). Höchstens 150 Teilchen gleichzeitig, Wetter eingerechnet; wird es eng, blenden die ältesten
weich aus, sonst entstehen keine neuen.

### Ton
- `sfx('pack/name', {vol, rate})`, `music('pack/name' | null)` (weiches Überblenden), `animal('kuh')`.
- `voice('<id>', {force, nurWenn})` spielt `assets/stimme/<id>.mp3` (ein eigenes Paket ist nicht nötig; Text dazu
  in `texte.js`; Musik wird leiser). Jeder Satz erklingt **einmal am Tag** (gezählt wird, was wirklich erklungen
  ist); mit der Eltern-Einstellung „bei jedem Besuch" einmal je Besuch der Szene; `force`: immer. Nur ein Satz
  gleichzeitig, 1,2 s Pause dazwischen. Fällt ein Satz in die Pause, wird er vorgemerkt (der neueste zählt) und
  danach gesagt – wenn das höchstens 6 s her ist und noch dieselbe Szene läuft; `nurWenn()` wird dann noch einmal
  gefragt. Das Promise erfüllt sich erst, wenn der Satz zu Ende ist (oder mit false, wenn er entfällt).
  Hinweis-Wiederholung: Ein Hinweis ist jeder Satz außer `*_hallo`, der nicht innerhalb von 1,5 s nach einer echten
  Berührung kommt (der Szenenstart zählt nicht als Berührung; auch ein Satz, der heute schon dran war, merkt sich
  als Hinweis). Sind seit der letzten Berührung **und** seit der Hinweis erklang (bzw. fällig war) je 25 s
  vergangen und die Szene hat etwas zu zeigen, kommt er einmal je Besuch wieder. „Etwas zu zeigen" fragt der Kern
  über den freiwilligen Haken `hinweisWiederholbar()` der Szene, sonst über `hints()`. Szenen sagen ihre Hinweise
  also ruhig bei jedem Besuch an – der Kern entscheidet, ob er erklingt.
  Ein Satz gehört seiner Szene (und Seite): Beginnt ein Szenenwechsel, beginnt kein neuer Satz mehr, und der
  laufende wird in 0,3 s weich ausgeblendet (er zählt dann nicht als gesagt). Beim Blättern ruft `SeitenSzene`
  `pruefeStimme()`: Ein Satz der alten Seite (oder einer, dessen `nurWenn()` jetzt false ist) blendet weich aus;
  Begrüßungen (`*_hallo`) laufen weiter.
- Ton-Bremse beim Tippen (im Kern, Szenen tun nichts): Töne, die direkt aus einer Berührung kommen, sind begrenzt –
  derselbe Ton (bzw. dasselbe Instrument und dieselbe Note) höchstens alle 0,2 s, neue Klänge mindestens 0,16 s
  auseinander und höchstens 5 je Sekunde (was innerhalb von 25 ms zusammen erklingt, zählt als ein Klang, höchstens
  3 Teile). Ein langer Ton (ab 0,4 s) legt sich nicht über sich selbst: innerhalb von 0,6 s entfällt er, danach
  blendet der alte kurz aus. Gleichzeitig laufen höchstens 6 Geräusche und 6 Instrumententöne. Die sichtbare Reaktion bleibt
  sofort. Töne, die eine Szene zeitversetzt plant (`after`, Takt der Band), zählen nicht zur Bremse.
- Vor der ersten Berührung ist der Ton gesperrt (Browser-Regel). Ein `voice()` in dieser Zeit wird vorgemerkt (der
  letzte zählt) und kurz nach der ersten Berührung gesagt – wenn das höchstens 20 s her ist, noch dieselbe Szene
  läuft und kein Szenenwechsel begonnen hat. Szenen brauchen dafür nichts zu tun (und sollen den Satz nicht
  selbst „nachholen", sonst käme er doppelt).
- `sfxSchleife('pack/name', {vol=0.6, rate=1, ein=0.3, aus=0.4})` → `{an(sek), aus(sek), stop(), aktiv}` – ein
  Geräusch als Schleife (Wasserstrahl, Motor), weich ein- und ausgeblendet, über den Geräusche-Regler. `aus()` lässt
  sich mit `an()` wieder starten, `stop()` ist endgültig; mit der Szene endet sie von selbst. Höchstens eine
  Schleife je Tätigkeit, und sie klingt nur, solange wirklich etwas passiert (Ruhe-Regel: Töne nicht stapeln).
  (Feuerwehr und Waschanlage haben noch eigene, ältere Schleifen-Helfer – die bleiben, wie sie sind.)
- `note(instr, midi, {vol})` – erzeugte Instrumente: `'xylo' | 'klavier' | 'glocke' | 'trommel' | 'floete' | 'pling'`.
- Fehlt ein Ton, bleibt es still (Warnung in der Konsole) – Szenen dürfen Töne benutzen, die erst später kommen.

### Oberfläche (`ui`)
`ui.button('pack/icon', {x, y, size=220, onTap, parent})`, `ui.tray(scene, {items:[{id, tex}], y, onPick})` (Leiste
unten mit großen Dingen zum Ziehen/Tippen), `ui.counter('pack/icon', {x, y})` → `.set(n)`, `ui.hand(obj|{x,y})`.

`ui.albumKnopf(this)` – Album-Knopf oben rechts (Ziel der Belohnungs-Sterne). Ein Tipp öffnet das Album mit Rückweg:
`go('album', {von: '<id der Szene>', zurück: {...scene.params, ...scene.rückkehr()}})`. `rückkehr()` ist ein
freiwilliger Haken der Szene und liefert ihren jetzigen Stand als Startwerte; `SeitenSzene` liefert `{seite: nr}`
(beim Gleiten schon die Ziel-Seite). Der Zurück-Knopf des Albums startet die Szene mit `zurück` neu – Seiten-Orte
also auf derselben Seite, auch beim allerersten Öffnen. Ohne `von` oder mit `von` = `karte`/`start` gibt es keinen
Zurück-Knopf, nur den Karten-Knopf. (`params.seite` des Albums ist dagegen seine eigene Start-Doppelseite.)

### Pakete
- `common`, `tiere`, `zug` und `rahmen` werden beim Szenenwechsel nie ganz entladen. Alle anderen Pakete der alten
  Szene werden entladen – außer einem kleinen **Vorrat**: Die zuletzt besuchten Orte (höchstens 2, zusammen höchstens
  45 Megapixel) bleiben im Speicher, damit „zurück zum Ort“ fast nur noch die Blende kostet.
- **Tiere einzeln:** `static tiere = ['kuh', 'hase']` lädt aus dem Paket `tiere` nur diese Tiere (alle Posen; ein Eintrag
  mit Pose wie `'kuh_happy'` nur dieses eine Bild). `'tiere'` bleibt trotzdem in `static packs`. Ohne `static tiere`
  wird wie früher das ganze Paket geladen. **Jedes Tier, das die Szene zeigen kann, gehört in die Liste** – auch
  zufällig gewählte, Sticker-Bilder und Tiere aus gemeinsamen Bausteinen. Gemeinsame Bausteine melden ihre Tiere
  selbst an: `tierBedarf((Klasse) => [...])` (so macht es `zug.js` mit den Gästen der Wagen).
- Später nachladen: `await ladeTiere(['fuchs'])`. Wird ein Tier gebraucht, das nicht geladen ist, stürzt nichts ab:
  `tex()` gibt ein durchsichtiges Warte-Bild in der richtigen Größe, das sich von selbst in das echte Bild verwandelt,
  sobald es (gleich danach) geladen ist; ein `Actor` behält so lange seine bisherige Pose. Mit `test=1` steht dann eine
  Warnung „Bild … war nicht geladen“ in der Konsole (`shot.mjs` meldet sie) – das Tier in `static tiere` eintragen.
  Nicht mehr gebrauchte Tierbilder bleiben bis zu 30 Stück im Speicher (zuletzt benutzt).
- **Vorausladen:** `SceneManager.danach({ start: ['karte'], bahnhof: ['fahrt'], '*': ['karte'] })` (in `main.js`)
  sagt, was wahrscheinlich als Nächstes kommt; 1,2 s nach dem Öffnen der Blende lädt der Kern das still im Hintergrund
  (`SceneManager.vorausladen(id)`, je Bild ein Häppchen, zwei gleichzeitig, Pause bei Wechsel, Ruckeln oder
  verstecktem Tab). Auf der Karte wird nur der Code aller Orte geholt (die Bilder aller Orte passen nicht in den
  Speicher). Die erste Szene lädt schon, während die Grafik hochfährt.
- **Laden ab dem Tipp:** Tippt das Kind ein Ding mit `label` `'ort:<id>'` an (so baut die Karte ihre Orte), fordert
  `main.js` sofort die Bilder dieses Ortes an (`onTap` aus `input.js`, dann `vorausladen(id, {sofort: true})`) – die
  Zugfahrt auf der Karte (1–2 s) läuft derweil. Nur der erste Ort je Kartenbesuch.
- **Schneller erster Start:** `SceneManager.ersteBilder('start', liste, merke)` (in `main.js`): Beim allerersten
  Wechsel wartet der Kern nur auf die Bilder der Liste (was die Start-Szene beim Aufbau anfasst; gemerkt in
  `sigo2.erstebilder.start`, beim allerersten Besuch `START_BILDER`), alle anderen Bilder ihrer Pakete laden danach
  leise. Fasst die Szene beim Aufbau doch ein noch nicht geladenes Bild an (`tex`/`hasTex`), baut der Kern sie
  unsichtbar hinter der Blende mit allen Bildern noch einmal auf (Konsole: „Schneller Start: … fehlten“).
- `onLaden(cb)` (aus `assets.js`) meldet, ob gerade Bilder mit voller Kraft laden (nicht das leise Vorausladen).
- Bildgröße: Die Auflösung einer Textur rechnet der Kern aus der echten Größe der Datei und `w`/`h` aus pack.json.
  Passen pack.json und Bilddatei nicht zur selben Fassung (Zwischenspeicher), stimmt die Größe im Spiel trotzdem.
- `loadPack(id, { nur: ['kuh', 'hase_happy'], leise: true })` lädt nur Teile eines Pakets (`leise` = im Hintergrund).
- `loadPackAudio(id)` meldet nur die Töne eines Pakets an (ohne Bilder), z. B. die Musik für alle Orte.
- Bilder lädt der Kern selbst (`fetch` → `createImageBitmap` → Pixi-Textur), nicht über `Assets.load`: So teilen sich
  zwei Pakete nie dieselbe Textur, und Entladen trifft nur das eigene Paket. Große Hintergründe (ab 2000×1400) bekommen
  keine Mipmaps (spart Rechenzeit und ein Drittel Grafikspeicher; sie werden nie stark verkleinert gezeigt).
- Service Worker (`sw.js`): sucht im Offline-Speicher nur genau (ohne `ignoreSearch` – das kostete am Tablet je Datei
  über eine halbe Sekunde), meldet sich beim ersten Besuch erst an, wenn das erste Bild steht und das Kind einmal
  getippt hat (+2 s; spätestens 30 s nach dem ersten Bild), holt die Dateien in einer sinnvollen Reihenfolge (Kern,
  Start, Karte, Orte, Töne, Musik zuletzt) und pausiert, solange das Spiel selbst lädt (Szenenwechsel oder Bilder mit
  voller Kraft). Jede Datei hat ein Zeitlimit (90 s, dann neuer Versuch); ihr Inhalt wird gegen die Prüfsumme aus
  `sw-dateien.js` geprüft (passt er nicht, ein frischer Versuch; gespeichert wird immer mit der Prüfsumme des echten
  Inhalts). Scheitert die Installation (langsames WLAN, Chrome bricht nach etwa 5 min ab), versucht `main.js` es in
  derselben Sitzung wieder (nach 30, 60, 120, dann alle 240 s) – schon Gespeichertes bleibt, es kommt nur der Rest.
  Scheitert schon die erste Installation, ist der nächste Versuch eine neue Anmeldung; `anmelden()` hängt sich jedes
  Mal neu an (sonst bliebe ein zweiter Fehlschlag unbemerkt). Jeder Arbeiter wird nur einmal beobachtet.

### Sonstiges
- `store.get(key, def)`, `store.set(key, val)`; `store.sticker(id)` → true, wenn neu im Album.
- Sticker: Liste und `belohne(szene, id, x, y)` in `src/gemeinsam/sticker.js`. Jeder Ort hat mindestens zwei, die
  meisten drei oder vier Sticker; das Album richtet Seitenzahl und Raster (18 je Doppelseite) nach der Liste.
  Der Platz eines Stickers folgt seiner Stelle in `STICKER` (je 18 eine Doppelseite). Hat die letzte Doppelseite
  weniger (heute 6), sitzen ihre Sticker ruhig in der Mitte jeder Buchseite (bis 4 je Buchseite etwas größer).
- Speicher-Schutz für Gezeichnetes (`stage.js`): Pixi gibt die Zeichendaten eines `Graphics` bei
  `destroy({children: true})` von sich aus nicht frei. Der Kern ergänzt darum für alle `context: true`, sobald die
  Zeichendaten dem `Graphics` allein gehören. Folge: `Graphics.clone()` ohne `true` nicht benutzen (die Kopie teilt
  die Zeichendaten mit dem Original) – lieber zweimal zeichnen oder `clone(true)`.
- Zug-Baustein: `zug.gaesteJubeln()` bremst sich selbst – ein Gast freut sich höchstens alle 0,6 s neu, der
  Jubel-Ton kommt höchstens alle 0,6 s (Anleitung: `src/gemeinsam/zug.md`).
- `ambient.set({zeit: 'tag'|'abend'|'nacht', wetter: 'klar'|'regen'|'schnee'})` – weiche Tönung + ruhige Partikel
  (je Wetter höchstens 40, Regen fällt gemächlich; schnelles Umschalten baut nichts doppelt).
- `new Parallax(scene, {layers:[{tex, depth, y, tile}], tempo=600, …})` für lange, rollende Landschaften. Die Kamera
  (`kamera.ziel`) fährt weich an, höchstens `tempo` Einheiten/s, und bremst weich; große Sprünge mit `springe(x)`.
- Seiten-Orte (`SeitenSzene`, `src/gemeinsam/seiten.js`): Umblättern gleitet in 1,0 s (sineInOut). Pfeil-Tipps
  während des Gleitens und 0,3 s danach zählen nicht (der Pfeil staucht trotzdem) – Dauertippen blättert also nur
  eine Seite weiter. Zeige-Hand: bis 30 s Ruhe zeigt sie auf die Ziele der Seite, ab 30 s auf den Pfeil zur
  nächsten Seite (höchstens 4 Hände bis zur nächsten Berührung, wenn es einen Pfeil gibt; Haken `hinweisHaende`).
  Die Stimme wiederholt einen Seiten-Hinweis nur vor dem Pfeil-Wechsel – kommt ein Hinweis erst spät (nach mehr
  als 5 s Ruhe), wiederholt ihn auf Seiten mit Pfeil die Hand, nicht die Stimme (Haken `hinweisWiederholbar`).
- Landkarte mit zwei Seiten (`src/scenes/karte/`, Liste `SEITEN`): Seite 1 = `rahmen/karte` mit den 13 ersten Orten,
  Seite 2 „das Land hinter dem Hügel" = `karte2/karte2` (eigenes Paket, 0,9 MB) mit Zoo, Flughafen und Bäckerei
  und viel freier Wiese für spätere Orte. Je Seite stehen Orte, Tiere und Pfeil in Bildpunkten des Kartenbilds;
  beide Bilder haben dasselbe Holzgleis (`GLEIS`). Ein neuer Ort bekommt eine Zeile in `ORTE_2` (Umriss, Tippkreis,
  Halteplatz des Zugs, Ring) und seine id in `ORTE` in `main.js`. Umblättern mit großem Pfeil (260; rechts auf
  Seite 1 unter dem Spielplatz zwischen Schlafhaus und Gleis, links auf Seite 2), Gleiten 1,0 s wie in den Seiten-Orten; während des
  Gleitens oder der Zugfahrt lassen Tipps die Orte nur wackeln – nichts startet zweimal. Die Karte öffnet
  sich auf der Seite des Orts in `karte.zug` (zurück aus dem Stickerbuch, ohne dass seitdem ein Ort besucht wurde:
  auf der Seite, die beim Verlassen zu sehen war – gemerkt nur in der Sitzung); steht der Zug auf der anderen Seite, fährt er beim Tipp auf einen Ort
  vom Rand herein. Ladezeit: `static packs`/`static tiere` der Karte sind Getter – `karte2` und die Tiere der
  zweiten Seite laden nur dann vor dem Öffnen mit, wenn die Karte dort aufgeht, sonst 1,5 s nach dem Öffnen still
  im Hintergrund (Pfeil-Tipp vorher: mit voller Kraft, geblättert wird erst, wenn das Bild steht). Start und
  „zurück zur Karte" bleiben so gleich schnell (gemessen 14.11.2026: zurück 1,41 s wie vorher). Einmal geladen, bleibt
  `karte2` im Speicher (steht in `BLEIBEN` in `scene.js`) und nimmt den Orten keinen Platz im Vorrat weg. Solange die zweite
  Seite nie gesehen wurde (`karte.seite2gesehen`), atmet hinter dem Pfeil ein weicher Schein; sind auf der
  sichtbaren Seite alle Orte besucht und drüben nicht, zeigt die Hand auf den Pfeil. Testen: `--param seite=1`.
- Eltern-Bereich (`src/gemeinsam/eltern.js`): Zahnrad unten rechts 3 s mit genau einem kleinen Finger halten (liegt
  ein zweiter Finger auf, zeigt ein rötlicher Ring, warum nichts passiert), dann zwei verschiedene Zahlen in fester
  Reihenfolge antippen („Tippe erst auf die Zahl 3, dann auf die Zahl 7."; die Zahlen wechseln). Ein falscher Tipp schließt den Bereich
  und sperrt das Zahnrad 1 min, beim nächsten Fehler 5 min, dann 15 min (Stand in `sigo2.eltern.sperre`, nach 6 h
  vergessen; die richtige Lösung hebt die Sperre auf). Gesperrt wackelt das Zahnrad nur. Schleier und Karte blenden
  in 0,9 s weich ein und aus. Rückmeldungen (z. B. „Noch 10 Minuten Spielzeit.") stehen direkt unter dem Knopf-Bereich,
  der sie ausgelöst hat, und werden ins Bild gerollt.
- Bildschirm wach: Ab der ersten Berührung hält das Spiel den Bildschirm wach. Nach 300 s ohne Berührung (im
  Ruhe-Bild „Schluss für heute" nach 75 s) gibt es die Sperre frei – dann schaltet das Tablet nach seiner eigenen
  Zeit ab; die nächste Berührung fordert sie wieder an.

### Testen ohne Tablet
- `http://localhost:8000/?szene=<id>` startet direkt in einer Szene; `&test=1` schaltet Spielzeit-Begrenzung aus und
  legt `window.__sigo` an (`ready`, `go(id)`, `errors`, `scene`).
- Vor dem Veröffentlichen: `python tools/sw_liste.py` (Offline-Liste), Kontrolle mit `--pruefen`.
- `node tools/shot.mjs --szene <id> --out shots/<name>.png [--warte 2] [--aktionen '<json>']` macht ein Testfoto mit
  echtem Chrome (ohne Fenster) und meldet Fehler aus der Konsole. Aktionen: `[["tap",x,y],["drag",x1,y1,x2,y2],
  ["warte",sek],["foto","name"]]` – Koordinaten in Bühnen-Einheiten (0…2560 / 0…1600).
- Ladezeiten wie am Tablet (CPU- und Netz-Drosselung, Service Worker, 2560×1600): `node tools/ladezeit.mjs`
  (siehe `tools/README.md`); Ausgangswerte in `shots/ladezeit_vorher.json`, nach dem Umbau für schnelleres Laden
  in `shots/ladezeit_nachher.json`, nach der Nachprüfung in `shots/ladezeit_schluss.json`.
- Jede Szene muss mit `--aktionen` einmal durchgespielt und die Fotos angesehen werden, bevor sie als fertig gilt.
- Seiten-Orte starten mit `--param seite=N` direkt auf einer Seite (Zählung ab 0).
- Nach jedem Szenenwechsel ist die Eingabe gesperrt, bis die Blende ganz offen ist (`isInputLocked()` aus
  `src/engine/input.js`). Ein Test, der gleich nach `_shown` tippt, verpufft absichtlich – erst warten, bis
  `!isInputLocked()`, dann tippen.
- Die ganze Reise (Start → Karte → Orte → Bahnhof → Fahrt → Spielzeit-Ende → Gute-Nacht) testet man ohne
  `--szene` mit `--url index.html --param test=1 --param spielzeit=150`: `spielzeit=<sek>` setzt eine kurze
  Test-Grenze, danach wechselt das Spiel beim nächsten ruhigen Moment (3 s ohne Berührung, spätestens 60 s) ins
  Gute-Nacht-Bild. In Git Bash nicht `--url "/"` schreiben – das wird zu einem Windows-Pfad umgebogen.
- Stand der Schluss-Abnahme (12.11.2026): alle 17 Szenen und alle 29 Seiten starten fehlerfrei, jede Haupttätigkeit
  ist bis zum Sticker durchgespielt, die ganze Reise läuft ohne Konsolenfehler. Schöne Fotos in voller Größe liegen
  unter `shots/abnahme/`.
- Schlusskontrolle nach dem Feinschliff (12.11.2026, `shots/sk_alle.sh`, `shots/sk_album.sh`,
  `node shots/sk_lauf.mjs reise`, Fotos unter `shots/sk/`): alle 17 Szenen, alle 29 Seiten und alle 4 Album-Doppelseiten
  (leer und voll beklebt) mit Finger (`--touch`) gestartet, getippt, gezogen und das Ziel der Zeige-Hand gespielt –
  ohne Fehler und ohne Warnungen. Die ganze Reise (Start → Karte → Bauernhof, Teich, Musik → Garten Seite 2 →
  Stickerbuch → zurück auf Seite 2 → Bahnhof → Fahrt → Spielzeit-Ende → Gute-Nacht → Ruhe-Bild) läuft mit leerer
  Konsole. Umlaut-Kontrolle ohne Fund (übrig sind nur Bezeichner und Schlüssel im Code). Die Offline-Liste
  `sw-dateien.js` ist neu geschrieben, die Kontrolle von `tools/sw_liste.py` meldet „passt".
- Stand nach Runde 3 „Orte vertiefen" (13.11.2026): 17 Szenen, 41 Seiten in den 12 Seiten-Orten, 93 Sticker auf
  6 Album-Doppelseiten. `shots/sk_alle.sh` und `shots/sk_album.sh` (alle 51 Starts und alle 6 Doppelseiten) ohne
  Fehler und Warnungen; jede Szene und Seite startet im älteren Chrome 114; ein Langlauf (4 Runden durch alle Orte
  und Seiten mit Tippen) zeigt keinen wachsenden Grafikspeicher und keinen Fehler; Ladezeiten wie vorher (Karte →
  Ort rund 2,6 s samt Zugfahrt, zurück 1,4 s, späterer Start 1,4 s). Alle Sätze der Stimme sind aufgenommen.
- Stand nach Runde 4 „neue Orte" (14.11.2026): Zoo, Flughafen und Bäckerei (je 3 Seiten) auf der zweiten
  Kartenseite – 20 Szenen, 50 Seiten in 15 Seiten-Orten, 105 Sticker. `shots/sk_alle.sh` (61 Starts) ohne Fehler und
  Warnungen, alle 61 Starts auch im älteren Chrome 114, Ladezeiten unverändert (Karte → Ort rund 2,5 s samt
  Zugfahrt, zurück 1,4 s, späterer Start 1,3 s); die neuen Pakete sind je 2,0–2,3 MB klein. Alle Sätze der Stimme
  sind aufgenommen. `tools/ladezeit.mjs` kennt die Orte der zweiten Kartenseite noch nicht (Fall c mit `--orte zoo`
  meldet „nicht auf der Karte gefunden").
- Nur am echten Tablet prüfbar bleiben: Gefühl der Finger und Mehrfinger-Berührung (auch das Eltern-Zahnrad mit „genau
  einem kleinen Finger" und Handballen), Leistung bei 120 Hz und der Auflösungs-Wächter, Lautstärke und Mischung der
  Töne samt Stimme (Pausen, Ton-Bremse), Vollbild, Bildschirm-wach-halten, Installation und Offline-Betrieb über https
  (Update mit neuem Stempel), Systemgesten am Rand, echte 30 Minuten Spielzeit und Tageswechsel (Satz einmal am Tag).

## 4. Bilder und Töne (Higgsfield)

### Stil-Bibel
Alles sieht aus wie `art/stil/look-a.png`: hochwertiger 3D-Animationsfilm, weiche matte Knete-/Vinyl-/Holzspielzeug-
Materialien, sehr runde Formen, große freundliche dunkle Augen mit Glanzpunkt, rote Bäckchen, warmes Hauptlicht von
oben links, satte aber harmonische Farben. Freundlich, ruhig, nie gruselig, nie grell.

Fester Stil-Satz für jeden Prompt (englisch, wörtlich anhängen):
> Same art style as the reference image: high-end 3D animated family film render, soft matte clay and vinyl toy
> materials, very rounded chunky shapes, warm key light from the upper left, rich but harmonious colors, friendly and calm.

- Modell `gpt_image_2_6`; **immer** die Stil-Referenz mitgeben:
  `medias: [{ value: "faf95e88-9eb6-43be-b20c-258baa37003a", role: "image_references" }]`.
  Für weitere Posen derselben Figur zusätzlich die Job-ID des ersten Bildes der Figur als zweite Referenz.
- **Sprites** (Figuren, Dinge): `background: "transparent"`, `resolution: "1k"`, `quality: "medium"` (Figuren, Fahrzeuge,
  wichtige Dinge; 0,5 Credits) oder `"low"` (kleine Dinge; 0,25). Prompt beginnt mit
  „Single game sprite on a fully transparent background: …" und endet mit „No ground, no floor shadow, no background,
  no text. Fully inside the frame with a clear margin on all sides."
- **Hintergründe**: `aspect_ratio: "16:9"`, `resolution: "2k"`, `quality: "high"` (2,75 Credits), undurchsichtig.
  „No text, no letters, no UI, no characters" – Figuren kommen als Sprites dazu. Die untere Bildhälfte ruhig halten
  (dort wird gespielt). Wird auf 1600 Höhe gebracht (≈2830 breit).
- Nie Text/Buchstaben/Zahlen im Bild. Keine Marken, keine bekannten Figuren.
- Kosten im Blick: jedes Paket hat ein Budget. Vor dem Start `balance` lesen; unter 150 Credits Rest: aufhören und melden.
- Werkzeuge (genaue Optionen: `python tools/bild.py -h`):
  `holen` (URL → art/), `sprite` (zuschneiden + WebP), `hintergrund`, `nahtlos` (kachelbar machen), `raster`
  (Bild mit Koordinaten-Gitter zum Ablesen von Punkten), `bogen` (Übersichtsblatt zum Prüfen), `pack` (pack.json bauen).
- Jedes Bild nach dem Erzeugen ansehen (Übersichtsblatt). Durchgefallen = abgeschnitten, falscher Stil, Text im Bild,
  gruselig, Hintergrund nicht durchsichtig. Höchstens zwei neue Versuche pro Bild.

### pack.json
```json
{ "id": "bauernhof",
  "images": { "kuh_idle": { "file": "kuh_idle.webp", "w": 812, "h": 900, "ax": 0.5, "ay": 0.97,
                            "pts": { "mouth": [420, 380] }, "desc": "Kuh sitzt, schaut nach vorn" } },
  "audio":  { "muh": { "file": "muh.mp3", "desc": "Kuh muht" } } }
```
`ax, ay` = Anker (0…1), `pts` = benannte Punkte in Bildpunkten des fertigen Bildes, `desc` = kurze Beschreibung, damit
die Szenen-Bauer wissen, was es gibt. `pack.json` wird von `tools/bild.py pack` aus den Dateien und `punkte.json` gebaut.

**Bildgrößen (Ladezeit!):** Jedes Bild nur so groß, wie es am Tablet höchstens gezeigt wird – jedes Megapixel kostet
beim Laden am Tablet spürbar Zeit (Entpacken und Hochladen zur Grafikkarte) und Speicher. Hintergründe 1600 hoch;
Figuren und Dinge nach ihrer größten Darstellung (Tiere: 600 Bildpunkte an der längeren Seite reichen, sie werden
höchstens ~560 hoch gezeigt). Ist ein Bild zu groß, verkleinert `python tools/bild.py verkleinern <ordner> --max 600`
die Dateien (fast verlustfrei, WebP-Qualität 92) und merkt sich die alte Größe als `einheiten` in `punkte.json`:
`w`/`h` in pack.json bleiben dann die alte Größe in **Einheiten**, `res` (< 1) sagt, wie viele Bildpunkte je Einheit
die Datei hat, und `pts` bleiben in diesen Einheiten. Für die Szenen ändert sich nichts (gleiche Größe auf dem Bildschirm);
wer Bildpunkte einer Textur liest, rechnet mit `texture.source.resolution`.

### Töne
- Geräusche: Modell `mirelo_text_to_audio` (0,5 Credits, `duration` in Sekunden). Musik: `elevenlabs_music_v2_5`
  (`force_instrumental: true`). Umwandeln/Angleichen: `python tools/ton.py`.
- Stimme (von den Eltern ausgesucht): Modell `elevenlabs_v4`, Stimme „Willow",
  `dialogue: [{ text, voice_type: "preset", voice_id: "f878bf3f-115b-5842-8934-c789c7947733" }]` (ca. 0,5 Credits je Satz).
  Sätze kurz, warm, in einfachen Worten; fertige Dateien nach `assets/stimme/<id>.mp3`.
- Echte Tierlaute liegen schon in `sounds/` (Quellen in `sounds/QUELLEN.md`) und bleiben.
