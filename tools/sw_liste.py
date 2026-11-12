"""Schreibt sw-dateien.js: die Liste aller Spieldateien für den Offline-Speicher (Service Worker), zu jeder Datei
eine kurze Prüfsumme ihres Inhalts und einen Versions-Stempel. Nach jeder Änderung an Spieldateien (Code, Bilder,
Töne) einmal laufen lassen – spätestens vor dem Veröffentlichen:

    python tools/sw_liste.py            # neu schreiben (nur wenn sich etwas geändert hat)
    python tools/sw_liste.py --pruefen  # nur prüfen: Exit-Code 1, wenn sw-dateien.js nicht mehr zum Spiel passt

Der Stempel ändert sich nur, wenn sich Dateien geändert haben (Datum + Prüfsumme über Namen und Inhalte).
Dann holt das Tablet beim nächsten Start mit Internet die GEÄNDERTEN Dateien (unveränderte übernimmt der Service
Worker anhand der Prüfsummen aus dem alten Speicher) und räumt den alten Speicher weg.
Ohne neuen Stempel bekommt ein Tablet Änderungen NIE (der Service Worker liefert streng aus seinem Speicher).
"""

import argparse
import hashlib
import json
import sys
from datetime import date
from pathlib import Path

WURZEL = Path(__file__).resolve().parent.parent
ZIEL = WURZEL / 'sw-dateien.js'

# was zum Spiel gehört (Ordner → erlaubte Endungen)
ORDNER = {
    'src': {'.js', '.mjs', '.json'},
    'assets': {'.webp', '.png', '.jpg', '.jpeg', '.json', '.mp3', '.ogg', '.m4a', '.wav'},
    'sounds': {'.mp3', '.ogg', '.m4a', '.wav'},
    'icons': {'.png', '.webp', '.svg'},
}
EINZELN = ['index.html', 'manifest.webmanifest', 'vendor/pixi.min.mjs']
AUSSER = {'punkte.json'}   # nur für die Werkzeuge, nicht fürs Spiel


def dateien():
    liste = []
    for ordner, endungen in ORDNER.items():
        basis = WURZEL / ordner
        if not basis.is_dir():
            continue
        for p in sorted(basis.rglob('*')):
            if p.is_file() and p.suffix.lower() in endungen and p.name not in AUSSER:
                liste.append(p.relative_to(WURZEL).as_posix())
    for name in EINZELN:
        if (WURZEL / name).is_file():
            liste.append(name)
    return sorted(set(liste))


# Textdateien: Git speichert sie mit LF (core.autocrlf), im Arbeitsordner unter Windows stehen sie oft mit CRLF.
# Veröffentlicht (GitHub Pages) wird der Stand aus Git – die Prüfsumme muss zu DEM Inhalt passen, denn sw.js
# vergleicht sie beim Installieren mit dem, was der Server wirklich liefert.
TEXT = {'.js', '.mjs', '.json', '.html', '.webmanifest', '.css', '.svg', '.txt', '.md'}


def inhalt_wie_veroeffentlicht(name):
    inhalt = (WURZEL / name).read_bytes()
    if Path(name).suffix.lower() in TEXT:
        inhalt = inhalt.replace(b'\r\n', b'\n')
    return inhalt


def berechne():
    """→ (liste, stempel, prüfsummen je Datei, Bytes gesamt)"""
    liste = dateien()
    pruef = hashlib.sha256()
    je_datei = {}
    bytes_gesamt = 0
    for name in liste:
        inhalt = inhalt_wie_veroeffentlicht(name)
        bytes_gesamt += len(inhalt)
        h = hashlib.sha256(inhalt).digest()
        je_datei[name] = h.hex()[:12]
        pruef.update(name.encode('utf-8'))
        pruef.update(h)
    return liste, pruef.hexdigest()[:10], je_datei, bytes_gesamt


def main():
    ap = argparse.ArgumentParser(description='Offline-Liste sw-dateien.js schreiben oder prüfen.')
    ap.add_argument('--pruefen', action='store_true',
                    help='nur prüfen, ob sw-dateien.js zum Spiel passt (Exit-Code 1, wenn nicht)')
    arg = ap.parse_args()

    liste, stempel, je_datei, bytes_gesamt = berechne()
    alt = ZIEL.read_text(encoding='utf-8') if ZIEL.exists() else ''
    passt = f"-{stempel}'" in alt and 'self.SIGO_PRUEF' in alt

    if arg.pruefen:
        print(json.dumps({'datei': 'sw-dateien.js', 'passt': passt, 'stempel': stempel, 'dateien': len(liste)}))
        if not passt:
            print('sw-dateien.js ist veraltet – bitte "python tools/sw_liste.py" laufen lassen, '
                  'sonst bekommt das Tablet die Änderungen nicht.', file=sys.stderr)
        return 0 if passt else 1

    # Datum nur erneuern, wenn sich wirklich etwas geändert hat
    if passt:
        print(json.dumps({'datei': 'sw-dateien.js', 'gleich_geblieben': True, 'dateien': len(liste)}))
        return 0
    version = f'{date.today().isoformat()}-{stempel}'

    zeilen = [
        '// Erzeugt von tools/sw_liste.py – nicht von Hand ändern. Nach Änderungen am Spiel neu erzeugen:',
        '//   python tools/sw_liste.py',
        f"self.SIGO_VERSION = '{version}';",
        'self.SIGO_DATEIEN = [',
        "  './',",
    ]
    zeilen += [f"  '{name}'," for name in liste]
    zeilen.append('];')
    # Prüfsummen: unveränderte Dateien übernimmt der Service Worker beim Update aus dem alten Speicher
    zeilen.append('self.SIGO_PRUEF = {')
    if 'index.html' in je_datei:
        zeilen.append(f"  './': '{je_datei['index.html']}',")
    zeilen += [f"  '{name}': '{je_datei[name]}'," for name in liste]
    zeilen.append('};')
    ZIEL.write_text('\n'.join(zeilen) + '\n', encoding='utf-8', newline='\n')
    print(json.dumps({'datei': 'sw-dateien.js', 'version': version, 'dateien': len(liste),
                      'megabyte': round(bytes_gesamt / 1e6, 1)}))
    return 0


if __name__ == '__main__':
    sys.exit(main())
