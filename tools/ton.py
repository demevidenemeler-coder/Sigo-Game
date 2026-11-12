"""Ton-Werkzeuge für Sigo 2 (ruft ffmpeg/ffprobe auf).

Aufruf:  python tools/ton.py holen <url|datei> <ziel.mp3> [--kuerzen] [--laut -16] [--max sek] [--ausblenden sek]
         python tools/ton.py info <datei>
Ergebnisse als eine JSON-Zeile auf stdout, Warnungen nach stderr.
"""

import argparse
import json
import math
import os
import re
import shutil
import subprocess
import sys
import tempfile
import urllib.parse
import urllib.request
from pathlib import Path

SPITZE_ZIEL = -1.5          # True Peak in dBTP, darf nicht überschritten werden
STILLE_SCHWELLE = '-50dB'   # leiser gilt beim Kürzen als Stille


def ausgabe(daten):
    print(json.dumps(daten, ensure_ascii=False))


def warnung(text):
    print(f'WARNUNG: {text}', file=sys.stderr)


def abbruch(text):
    print(f'FEHLER: {text}', file=sys.stderr)
    sys.exit(1)


def programm(name):
    pfad = shutil.which(name)
    if not pfad:
        abbruch(f'{name} wurde nicht gefunden (muss im PATH liegen).')
    return pfad


def ffmpeg(*argumente):
    """ffmpeg ausführen; gibt stderr zurück (dort stehen die Messwerte)."""
    lauf = subprocess.run([programm('ffmpeg'), '-hide_banner', '-nostdin', *argumente],
                          capture_output=True, text=True, encoding='utf-8', errors='replace')
    if lauf.returncode != 0:
        abbruch('ffmpeg ist fehlgeschlagen:\n' + lauf.stderr[-2000:])
    return lauf.stderr


def probe(datei):
    lauf = subprocess.run([programm('ffprobe'), '-v', 'error', '-print_format', 'json',
                           '-show_format', '-show_streams', '-select_streams', 'a:0', str(datei)],
                          capture_output=True, text=True, encoding='utf-8', errors='replace')
    if lauf.returncode != 0:
        abbruch(f'Keine lesbare Tondatei: {datei}\n{lauf.stderr.strip()}')
    daten = json.loads(lauf.stdout)
    if not daten.get('streams'):
        abbruch(f'Keine Tonspur in {datei}')
    strom = daten['streams'][0]
    return {'sek': float(daten['format'].get('duration') or strom.get('duration') or 0),
            'kanaele': int(strom.get('channels', 1)),
            'rate': int(strom.get('sample_rate', 44100)),
            'codec': strom.get('codec_name')}


def lautheit(datei):
    """Integrierte Lautheit (LUFS) und True Peak (dBTP) über loudnorm messen.

    Bei sehr kurzen Tönen (< 0,4 s) liefert die Messung -inf; dann gilt None.
    """
    text = ffmpeg('-i', str(datei), '-af', 'loudnorm=print_format=json', '-f', 'null', '-')
    treffer = re.search(r'\{[^{}]*"input_i"[^{}]*\}', text, re.S)
    if not treffer:
        return None, None
    werte = json.loads(treffer.group(0))

    def zahl(schluessel):
        try:
            wert = float(werte[schluessel])
        except (KeyError, ValueError):
            return None
        return wert if math.isfinite(wert) and wert > -70 else None

    return zahl('input_i'), zahl('input_tp')


def lautstaerke(datei):
    """Mittlere und höchste Lautstärke in dB (volumedetect)."""
    text = ffmpeg('-i', str(datei), '-af', 'volumedetect', '-f', 'null', '-')
    mittel = re.search(r'mean_volume:\s*(-?[\d.]+|-inf) dB', text)
    spitze = re.search(r'max_volume:\s*(-?[\d.]+|-inf) dB', text)
    return (float(mittel.group(1)) if mittel else None, float(spitze.group(1)) if spitze else None)


def quelle_holen(quelle, ordner):
    """https-Adresse in den Zwischenordner laden oder lokale Datei unverändert nehmen."""
    teile = urllib.parse.urlparse(quelle)
    if teile.scheme in ('http', 'ftp'):
        abbruch('Nur https-Adressen sind erlaubt.')
    if teile.scheme != 'https':
        pfad = Path(quelle)
        if not pfad.is_file():
            abbruch(f'Datei nicht gefunden: {quelle}')
        return pfad
    endung = Path(teile.path).suffix or '.bin'
    ziel = Path(ordner) / ('quelle' + endung)
    anfrage = urllib.request.Request(quelle, headers={'User-Agent': 'sigo-werkzeug/1.0'})
    try:
        with urllib.request.urlopen(anfrage, timeout=120) as antwort, open(ziel, 'wb') as datei:
            shutil.copyfileobj(antwort, datei)
    except Exception as e:
        abbruch(f'Laden fehlgeschlagen: {e}')
    return ziel


def befehl_holen(args):
    if not args.ziel.lower().endswith('.mp3'):
        abbruch('Ziel muss eine .mp3-Datei sein.')
    with tempfile.TemporaryDirectory(prefix='sigo-ton-') as zwischen:
        quelle = quelle_holen(args.quelle, zwischen)
        info = probe(quelle)
        kanaele = min(info['kanaele'], 2)

        # Schritt 1: Stille wegschneiden und kürzen, als WAV zwischenspeichern
        filter_ = []
        if args.kuerzen:
            stille = f'start_periods=1:start_threshold={STILLE_SCHWELLE}:start_silence=0.02'
            filter_ += [f'silenceremove={stille}', 'areverse', f'silenceremove={stille}', 'areverse']
        if args.max:
            filter_.append(f'atrim=0:{args.max}')
        roh = Path(zwischen) / 'roh.wav'
        ffmpeg('-y', '-i', str(quelle), *(['-af', ','.join(filter_)] if filter_ else []),
               '-ac', str(kanaele), '-ar', '44100', '-c:a', 'pcm_s16le', str(roh))
        dauer = probe(roh)['sek']
        if dauer < 0.02:
            abbruch('Nach dem Kürzen ist nichts übrig – ist die Datei still?')

        # Schritt 2: Lautheit messen und eine feste Verstärkung bestimmen (wie loudnorm im linearen Modus)
        lufs, spitze = lautheit(roh)
        if lufs is None:
            # Zu kurz für eine Lautheitsmessung: nach der Spitze richten (kurze Geräusche wirken leiser)
            _, max_db = lautstaerke(roh)
            verstaerkung = (args.laut + 13) - (max_db if max_db is not None else -20)
            warnung('Ton ist zu kurz für eine Lautheitsmessung – angeglichen über die Spitze.')
            spitze = max_db
        else:
            verstaerkung = args.laut - lufs

        # Würde die Spitze zu laut, fängt ein weicher Begrenzer sie ab (statt alles leiser zu machen)
        filter_ = [f'volume={verstaerkung:.2f}dB']
        if spitze is not None and spitze + verstaerkung > SPITZE_ZIEL:
            grenze = 10 ** ((SPITZE_ZIEL - 0.5) / 20)          # etwas Luft für Zwischenwerte (True Peak)
            filter_.append(f'alimiter=limit={grenze:.4f}:attack=5:release=60:level=0')

        # Weiche Ränder: kurzes Einblenden nach dem Kürzen, Ausblenden am Ende (gegen Knackser)
        if args.kuerzen:
            filter_.append('afade=t=in:st=0:d=0.01')
        ausblenden = args.ausblenden if args.ausblenden else (0.03 if args.max and info['sek'] > args.max else 0)
        if ausblenden:
            ausblenden = min(ausblenden, dauer / 2)
            filter_.append(f'afade=t=out:st={max(0.0, dauer - ausblenden):.3f}:d={ausblenden:.3f}')

        Path(args.ziel).parent.mkdir(parents=True, exist_ok=True)
        ffmpeg('-y', '-i', str(roh), '-af', ','.join(filter_), '-ac', str(kanaele), '-ar', '44100',
               '-c:a', 'libmp3lame', '-b:a', args.bitrate, '-map_metadata', '-1', str(args.ziel))

    ergebnis = probe(args.ziel)
    lufs_neu, spitze_neu = lautheit(args.ziel)
    if lufs_neu is not None and abs(lufs_neu - args.laut) > 2:
        warnung(f'Lautheit {lufs_neu:.1f} LUFS weicht vom Ziel {args.laut} ab (Begrenzer hat stark gearbeitet?).')
    if spitze_neu is not None and spitze_neu > SPITZE_ZIEL + 0.5:
        warnung(f'True Peak {spitze_neu:.1f} dBTP liegt über {SPITZE_ZIEL}.')
    ausgabe({'file': str(args.ziel).replace('\\', '/'), 'sek': round(ergebnis['sek'], 2),
             'lufs': round(lufs_neu, 1) if lufs_neu is not None else None,
             'kanaele': ergebnis['kanaele']})


def befehl_info(args):
    if not Path(args.datei).is_file():
        abbruch(f'Datei nicht gefunden: {args.datei}')
    info = probe(args.datei)
    mittel, spitze = lautstaerke(args.datei)
    lufs, true_peak = lautheit(args.datei)
    ausgabe({'file': str(args.datei).replace('\\', '/'), 'sek': round(info['sek'], 2),
             'kanaele': info['kanaele'], 'rate': info['rate'], 'codec': info['codec'],
             'mittel_db': mittel, 'spitze_db': spitze,
             'lufs': round(lufs, 1) if lufs is not None else None,
             'true_peak': round(true_peak, 1) if true_peak is not None else None})


def main():
    haupt = argparse.ArgumentParser(prog='ton.py', description='Ton-Werkzeuge für Sigo 2 (braucht ffmpeg).')
    unter = haupt.add_subparsers(dest='befehl', required=True, metavar='unterbefehl')

    p = unter.add_parser(
        'holen', help='Ton laden/umwandeln, Stille kürzen, Lautheit angleichen, als MP3 speichern.',
        description='Lädt eine https-Adresse oder nimmt eine lokale Datei und speichert sie als angeglichene MP3 '
                    '(Kanäle wie die Quelle, höchstens Stereo, 44,1 kHz).',
        epilog='Beispiele:\n'
               '  python tools/ton.py holen https://example.com/muh.wav assets/tiere/muh.mp3 --kuerzen\n'
               '  python tools/ton.py holen sounds/kuh.mp3 assets/tiere/kuh.mp3 --kuerzen --max 2.5 --ausblenden 0.3',
        formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument('quelle', help='https-Adresse oder lokale Datei')
    p.add_argument('ziel', help='Ziel-MP3')
    p.add_argument('--kuerzen', action='store_true', help='Stille vorn und hinten wegschneiden')
    p.add_argument('--laut', type=float, default=-16, help='Ziel-Lautheit in LUFS (Standard -16)')
    p.add_argument('--max', type=float, default=0, help='höchstens so viele Sekunden behalten')
    p.add_argument('--bitrate', default='128k', help='MP3-Bitrate (Standard 128k)')
    p.add_argument('--ausblenden', type=float, default=0, help='am Ende so viele Sekunden ausblenden')
    p.set_defaults(fn=befehl_holen)

    p = unter.add_parser('info', help='Dauer, Kanäle und Lautstärke einer Tondatei zeigen.',
                         epilog='Beispiel:\n  python tools/ton.py info sounds/kuh.mp3',
                         formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument('datei')
    p.set_defaults(fn=befehl_info)

    args = haupt.parse_args()
    args.fn(args)


if __name__ == '__main__':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
        sys.stderr.reconfigure(encoding='utf-8')
    except AttributeError:
        pass
    main()
