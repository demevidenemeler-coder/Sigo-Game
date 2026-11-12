"""Bild-Werkzeuge für Sigo 2 (nur Pillow + Standardbibliothek).

Aufruf:  python tools/bild.py <unterbefehl> ...   (Hilfe: python tools/bild.py <unterbefehl> -h)

Unterbefehle: holen, sprite, hintergrund, nahtlos, raster, bogen, pack, anker.
Ergebnisse werden als eine JSON-Zeile auf stdout ausgegeben, Warnungen gehen nach stderr.
"""

import argparse
import json
import os
import sys
import tempfile
import time
import urllib.parse
import urllib.request
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ALPHA_SCHWELLE = 8          # Alpha darunter gilt als unsichtbar
BILD_ENDUNGEN = ('.webp', '.png')
TON_ENDUNGEN = ('.mp3', '.ogg', '.m4a')


# ---------------------------------------------------------------------------
# Kleine Helfer
# ---------------------------------------------------------------------------

def ausgabe(daten):
    """Ergebnis als eine JSON-Zeile ausgeben (Umlaute bleiben lesbar)."""
    print(json.dumps(daten, ensure_ascii=False))


def warnung(text):
    print(f'WARNUNG: {text}', file=sys.stderr)


def abbruch(text):
    print(f'FEHLER: {text}', file=sys.stderr)
    sys.exit(1)


def pfad_text(pfad):
    return str(pfad).replace('\\', '/')


def oeffne_bild(pfad):
    try:
        im = Image.open(pfad)
        im.load()
        return im
    except FileNotFoundError:
        abbruch(f'Datei nicht gefunden: {pfad}')
    except OSError as e:
        abbruch(f'Kein lesbares Bild: {pfad} ({e})')


def hat_alpha(im):
    return im.mode in ('RGBA', 'LA', 'PA') or (im.mode == 'P' and 'transparency' in im.info)


def ordner_fuer(ziel):
    Path(ziel).parent.mkdir(parents=True, exist_ok=True)


def schrift(groesse, fett=False):
    """Eine gut lesbare Windows-Schrift laden, sonst die eingebaute."""
    namen = ['segoeuib.ttf', 'arialbd.ttf'] if fett else ['segoeui.ttf', 'arial.ttf']
    for name in namen + ['DejaVuSans.ttf']:
        for ordner in ('C:/Windows/Fonts', '/usr/share/fonts/truetype/dejavu', ''):
            try:
                return ImageFont.truetype(os.path.join(ordner, name) if ordner else name, groesse)
            except OSError:
                continue
    return ImageFont.load_default(size=groesse)


def kariert(breite, hoehe, feld=16):
    """Hellgrau-weißes Schachbrett als Grund für durchsichtige Bilder."""
    grund = Image.new('RGB', (breite, hoehe), (255, 255, 255))
    zeichner = ImageDraw.Draw(grund)
    for y in range(0, hoehe, feld):
        for x in range((y // feld) % 2 * feld, breite, feld * 2):
            zeichner.rectangle([x, y, x + feld - 1, y + feld - 1], fill=(214, 214, 214))
    return grund


def auf_kariert(im):
    """Bild (mit oder ohne Alpha) auf kariertem Grund als RGB."""
    rgba = im.convert('RGBA')
    grund = kariert(*rgba.size).convert('RGBA')
    grund.alpha_composite(rgba)
    return grund.convert('RGB')


def webp_speichern(im, ziel, qualitaet):
    ordner_fuer(ziel)
    im.save(ziel, 'WEBP', quality=qualitaet, method=6, alpha_quality=100)


# ---------------------------------------------------------------------------
# holen
# ---------------------------------------------------------------------------

def befehl_holen(args):
    teile = urllib.parse.urlparse(args.url)
    if teile.scheme != 'https':
        abbruch('Nur https-Adressen sind erlaubt.')
    ordner_fuer(args.ziel)
    anfrage = urllib.request.Request(args.url, headers={'User-Agent': 'sigo-werkzeug/1.0'})
    zwischen = Path(str(args.ziel) + '.teil')
    try:
        with urllib.request.urlopen(anfrage, timeout=120) as antwort, open(zwischen, 'wb') as datei:
            while True:
                stueck = antwort.read(1 << 16)
                if not stueck:
                    break
                datei.write(stueck)
        os.replace(zwischen, args.ziel)
    except Exception as e:
        zwischen.unlink(missing_ok=True)
        abbruch(f'Laden fehlgeschlagen: {e}')
    ausgabe({'file': pfad_text(args.ziel), 'bytes': os.path.getsize(args.ziel)})


# ---------------------------------------------------------------------------
# sprite
# ---------------------------------------------------------------------------

def befehl_sprite(args):
    roh = oeffne_bild(args.roh)
    if not hat_alpha(roh):
        warnung(f'{args.roh}: Bild hat keinen Alpha-Kanal – Hintergrund ist nicht durchsichtig.')
    im = roh.convert('RGBA')
    alpha = im.getchannel('A')
    if alpha.getextrema()[0] >= 255 - ALPHA_SCHWELLE:
        warnung(f'{args.roh}: Alpha ist überall voll – kein echtes Alpha (Hintergrund nicht durchsichtig?).')

    # Sehr schwaches Alpha ganz weg (Dunst, Rauschen des Freistellers)
    alpha = alpha.point(lambda v: 0 if v < ALPHA_SCHWELLE else v)
    im.putalpha(alpha)
    kasten = alpha.getbbox()
    if not kasten:
        abbruch(f'{args.roh}: Bild ist vollständig durchsichtig.')

    links, oben, rechts, unten = kasten
    beruehrt = [name for name, ja in (('links', links == 0), ('oben', oben == 0),
                                      ('rechts', rechts == im.width), ('unten', unten == im.height)) if ja]
    if beruehrt:
        warnung(f'{args.roh}: Motiv berührt den Bildrand ({", ".join(beruehrt)}) – vermutlich abgeschnitten.')

    # Zuschneiden und rundum durchsichtigen Rand anfügen (auch wenn das Rohbild dort zu Ende ist)
    motiv = im.crop(kasten)
    rand = max(0, args.rand)
    bild = Image.new('RGBA', (motiv.width + 2 * rand, motiv.height + 2 * rand), (0, 0, 0, 0))
    bild.paste(motiv, (rand, rand))

    # Verkleinern (nie vergrößern). Pillow rechnet bei RGBA mit vormultipliziertem Alpha.
    faktor = 1.0
    laengste = max(bild.size)
    if laengste > args.max:
        faktor = args.max / laengste
        neu = (max(1, round(bild.width * faktor)), max(1, round(bild.height * faktor)))
        bild = bild.resize(neu, Image.LANCZOS)
        bild.putalpha(bild.getchannel('A').point(lambda v: 0 if v < ALPHA_SCHWELLE else v))

    ax, ay = anker_berechnen(bild, args.anker)
    webp_speichern(bild, args.ziel, 90)
    if args.eintragen:
        punkte_eintragen(Path(args.ziel).parent, 'images', Path(args.ziel).stem, ax=ax, ay=ay, desc=args.desc)
    ausgabe({'file': pfad_text(args.ziel), 'w': bild.width, 'h': bild.height, 'ax': ax, 'ay': ay,
             'schnitt': [links, oben, rechts, unten], 'faktor': round(faktor, 4)})


def anker_berechnen(bild, art):
    if art == 'mitte':
        return 0.5, 0.5
    # "unten": waagrecht die Mitte dessen, was in den untersten 8 % des Motivs sichtbar ist (Füße, Räder),
    # senkrecht knapp über der Unterkante, damit die Figur etwas in den Boden „einsinkt".
    alpha = bild.getchannel('A')
    l, o, r, u = alpha.getbbox()
    streifen_hoehe = max(1, round((u - o) * 0.08))
    streifen = alpha.crop((0, u - streifen_hoehe, bild.width, u)).getbbox()
    mitte_x = (streifen[0] + streifen[2]) / 2 if streifen else (l + r) / 2
    fuss_y = u - (u - o) * 0.01
    return round(mitte_x / bild.width, 3), round(fuss_y / bild.height, 3)


# ---------------------------------------------------------------------------
# hintergrund
# ---------------------------------------------------------------------------

def befehl_hintergrund(args):
    roh = oeffne_bild(args.roh)
    im = roh.convert('RGB')
    if args.hoehe > im.height * 1.15:
        warnung(f'{args.roh}: wird vergrößert ({im.height} → {args.hoehe} Höhe), das wird unscharf.')
    breite = round(im.width * args.hoehe / im.height)
    im = im.resize((breite, args.hoehe), Image.LANCZOS)
    if args.hoehe == 1600 and breite < 2820:
        warnung(f'Breite {breite} ist schmaler als die geforderten ~2840 – breite Bildschirme zeigen Ränder.')
    webp_speichern(im, args.ziel, args.qualitaet)
    ausgabe({'file': pfad_text(args.ziel), 'w': im.width, 'h': im.height})


# ---------------------------------------------------------------------------
# nahtlos
# ---------------------------------------------------------------------------

def befehl_nahtlos(args):
    roh = oeffne_bild(args.roh)
    mit_alpha = hat_alpha(roh)
    im = roh.convert('RGBA' if mit_alpha else 'RGB')
    if args.hoehe:
        im = im.resize((round(im.width * args.hoehe / im.height), args.hoehe), Image.LANCZOS)
    if not 0 < args.anteil < 0.5:
        abbruch('Der Überlappungs-Anteil muss zwischen 0 und 0.5 liegen.')

    b, h = im.size
    streifen = max(2, round(b * args.anteil))
    neu_breite = b - streifen

    # Ergebnis = Bild ohne den rechten Streifen; der linke Streifen wird weich vom rechten Streifen
    # zum Original übergeblendet. So schließt die letzte Spalte nahtlos an die erste an.
    rechts = im.crop((b - streifen, 0, b, h))
    links = im.crop((0, 0, streifen, h))
    rampe = Image.new('L', (streifen, 1))
    for x in range(streifen):
        t = x / (streifen - 1)
        rampe.putpixel((x, 0), round(255 * t * t * (3 - 2 * t)))   # weiche S-Kurve
    maske = rampe.resize((streifen, h), Image.NEAREST)
    gemischt = Image.composite(links, rechts, maske)

    ergebnis = im.crop((0, 0, neu_breite, h))
    ergebnis.paste(gemischt, (0, 0))
    webp_speichern(ergebnis, args.ziel, args.qualitaet)
    ausgabe({'file': pfad_text(args.ziel), 'w': ergebnis.width, 'h': ergebnis.height,
             'streifen': streifen, 'alpha': mit_alpha})


# ---------------------------------------------------------------------------
# raster
# ---------------------------------------------------------------------------

def text_mit_rand(zeichner, xy, text, font, farbe=(20, 20, 20), rand=(255, 255, 255), anker='la'):
    zeichner.text(xy, text, font=font, fill=farbe, stroke_width=3, stroke_fill=rand, anchor=anker)


def befehl_raster(args):
    quelle = oeffne_bild(args.bild)
    qb, qh = quelle.size
    massstab = args.breite / qb
    bb, bh = args.breite, max(1, round(qh * massstab))
    bild = (auf_kariert(quelle) if hat_alpha(quelle) else quelle.convert('RGB')).resize((bb, bh), Image.LANCZOS)

    rand_l, rand_o, rand_r, rand_u = 64, 58, 64, 36
    blatt = Image.new('RGB', (bb + rand_l + rand_r, bh + rand_o + rand_u), (250, 248, 240))
    blatt.paste(bild, (rand_l, rand_o))

    # Linien halbdurchsichtig auf eigener Ebene, damit das Bild darunter erkennbar bleibt
    ebene = Image.new('RGBA', blatt.size, (0, 0, 0, 0))
    z = ImageDraw.Draw(ebene)
    schritt = args.schritt
    for wert in range(0, max(qb, qh) + 1, schritt):
        stark = wert % (schritt * 5) == 0
        farbe = (230, 0, 60, 210) if stark else (230, 0, 60, 120)
        dicke = 2 if stark else 1
        if wert <= qb:
            x = rand_l + wert * massstab
            z.line([(x, rand_o), (x, rand_o + bh)], fill=farbe, width=dicke)
        if wert <= qh:
            y = rand_o + wert * massstab
            z.line([(rand_l, y), (rand_l + bb, y)], fill=farbe, width=dicke)
    blatt = Image.alpha_composite(blatt.convert('RGBA'), ebene).convert('RGB')

    # Beschriftung: Zahlen an allen vier Rändern, dazu „x,y" an Kreuzungen im Bild
    z = ImageDraw.Draw(blatt)
    rand_font = schrift(16, fett=True)
    innen_font = schrift(13, fett=True)
    for x_wert in range(0, qb + 1, schritt):
        x = rand_l + x_wert * massstab
        z.text((x, rand_o - 6), str(x_wert), font=rand_font, fill=(150, 0, 40), anchor='ms')
        z.text((x, rand_o + bh + 6), str(x_wert), font=rand_font, fill=(150, 0, 40), anchor='mt')
    for y_wert in range(0, qh + 1, schritt):
        y = rand_o + y_wert * massstab
        z.text((rand_l - 6, y), str(y_wert), font=rand_font, fill=(150, 0, 40), anchor='rm')
        z.text((rand_l + bb + 6, y), str(y_wert), font=rand_font, fill=(150, 0, 40), anchor='lm')

    # Im Bild nur so dicht beschriften, dass sich die Zahlen nicht drängeln (≥ ~170 Punkte Abstand)
    jede = max(1, round(170 / (schritt * massstab)))
    for j, y_wert in enumerate(range(schritt, qh, schritt)):
        if j % jede:
            continue
        for i, x_wert in enumerate(range(schritt, qb, schritt)):
            if i % jede:
                continue
            x = rand_l + x_wert * massstab
            y = rand_o + y_wert * massstab
            text = f'{x_wert},{y_wert}'
            if x + 8 + z.textlength(text, font=innen_font) > rand_l + bb or y + 20 > rand_o + bh:
                continue   # ragt sonst über den Bildrand in die Randzahlen
            text_mit_rand(z, (x + 4, y + 3), text, innen_font, farbe=(150, 0, 40))

    z.text((rand_l, 6), f'{Path(args.bild).name}  {qb}×{qh}  Gitter {schritt}', font=schrift(14), fill=(60, 60, 60))
    ordner_fuer(args.ziel)
    blatt.save(args.ziel, quality=88)
    ausgabe({'file': pfad_text(args.ziel), 'w': blatt.width, 'h': blatt.height, 'quelle': [qb, qh],
             'massstab': round(massstab, 4)})


# ---------------------------------------------------------------------------
# bogen
# ---------------------------------------------------------------------------

def bilddateien_sammeln(eingaben):
    dateien = []
    for eingabe in eingaben:
        p = Path(eingabe)
        if p.is_dir():
            dateien += sorted(f for f in p.iterdir()
                              if f.suffix.lower() in ('.png', '.webp', '.jpg', '.jpeg'))
        elif p.exists():
            dateien.append(p)
        else:
            warnung(f'nicht gefunden: {eingabe}')
    return dateien


def befehl_bogen(args):
    dateien = bilddateien_sammeln(args.eingaben)
    if not dateien:
        abbruch('Keine Bilder gefunden.')
    kachel = args.kachel
    text_hoehe = 44
    spalten = max(1, min(args.spalten, len(dateien)))
    zeilen = (len(dateien) + spalten - 1) // spalten
    abstand = 10
    blatt = Image.new('RGB', (spalten * (kachel + abstand) + abstand,
                              zeilen * (kachel + text_hoehe + abstand) + abstand), (250, 248, 240))
    z = ImageDraw.Draw(blatt)
    name_font = schrift(15, fett=True)
    mass_font = schrift(13)
    for nummer, datei in enumerate(dateien):
        x = abstand + (nummer % spalten) * (kachel + abstand)
        y = abstand + (nummer // spalten) * (kachel + text_hoehe + abstand)
        try:
            im = Image.open(datei)
            im.load()
        except OSError:
            warnung(f'kein Bild: {datei}')
            continue
        groesse = im.size
        alpha = hat_alpha(im)
        im = im.convert('RGBA')
        im.thumbnail((kachel, kachel), Image.LANCZOS)
        feld = kariert(kachel, kachel).convert('RGBA')
        feld.alpha_composite(im, ((kachel - im.width) // 2, (kachel - im.height) // 2))
        blatt.paste(feld.convert('RGB'), (x, y))
        z.rectangle([x - 1, y - 1, x + kachel, y + kachel], outline=(180, 180, 180))
        name = datei.name
        while z.textlength(name, font=name_font) > kachel and len(name) > 4:
            name = name[:-4] + '…'
        z.text((x, y + kachel + 4), name, font=name_font, fill=(30, 30, 30))
        z.text((x, y + kachel + 23), f'{groesse[0]}×{groesse[1]}' + ('  Alpha' if alpha else ''),
               font=mass_font, fill=(90, 90, 90))
    ordner_fuer(args.ziel)
    blatt.save(args.ziel, quality=85)
    ausgabe({'file': pfad_text(args.ziel), 'w': blatt.width, 'h': blatt.height, 'bilder': len(dateien)})


# ---------------------------------------------------------------------------
# pack und anker
# ---------------------------------------------------------------------------

def punkte_lesen(ordner):
    pfad = Path(ordner) / 'punkte.json'
    if not pfad.exists():
        return {'images': {}, 'audio': {}}
    try:
        daten = json.loads(pfad.read_text(encoding='utf-8'))
    except json.JSONDecodeError as e:
        abbruch(f'{pfad} ist kein gültiges JSON: {e}')
    daten.setdefault('images', {})
    daten.setdefault('audio', {})
    return daten


def json_schreiben_atomar(pfad, daten, text=None):
    """Erst in eine Zwischendatei schreiben, dann in einem Zug ersetzen."""
    pfad = Path(pfad)
    inhalt = text if text is not None else json.dumps(daten, ensure_ascii=False, indent=2) + '\n'
    griff, zwischen = tempfile.mkstemp(prefix=pfad.name + '.', suffix='.tmp', dir=pfad.parent)
    try:
        with os.fdopen(griff, 'w', encoding='utf-8', newline='\n') as datei:
            datei.write(inhalt)
        for versuch in range(20):        # Windows: Ziel kann kurz von einem Leser offen sein
            try:
                os.replace(zwischen, pfad)
                break
            except PermissionError:
                if versuch == 19:
                    raise
                time.sleep(0.05)
    finally:
        if os.path.exists(zwischen):
            os.unlink(zwischen)


def pack_text(daten):
    """pack.json gut lesbar: ein Eintrag pro Zeile."""
    zeilen = ['{', f'  "id": {json.dumps(daten["id"], ensure_ascii=False)},']
    for teil in ('images', 'audio'):
        eintraege = daten[teil]
        zeilen.append(f'  "{teil}": {{')
        for i, (name, wert) in enumerate(eintraege.items()):
            komma = ',' if i < len(eintraege) - 1 else ''
            zeilen.append(f'    {json.dumps(name, ensure_ascii=False)}: '
                          f'{json.dumps(wert, ensure_ascii=False, separators=(", ", ": "))}{komma}')
        zeilen.append('  }' + (',' if teil == 'images' else ''))
    zeilen.append('}')
    return '\n'.join(zeilen) + '\n'


def befehl_pack(args):
    ordner = Path(args.ordner)
    if not ordner.is_dir():
        abbruch(f'Ordner nicht gefunden: {ordner}')
    punkte = punkte_lesen(ordner)
    bilder, toene = {}, {}

    # .webp vor .png sortieren, damit bei doppelten Namen das WebP gewinnt
    dateien = sorted((f for f in ordner.iterdir() if f.is_file()),
                     key=lambda f: (f.stem, f.suffix.lower() != '.webp', f.suffix.lower()))
    for datei in dateien:
        endung = datei.suffix.lower()
        name = datei.stem
        if endung in BILD_ENDUNGEN:
            if name in bilder:
                warnung(f'{name}: mehrere Bilddateien – nehme {bilder[name]["file"]}')
                continue
            with Image.open(datei) as im:
                w, h = im.size
            extra = punkte['images'].get(name, {})
            bilder[name] = {'file': datei.name, 'w': w, 'h': h,
                            'ax': extra.get('ax', 0.5), 'ay': extra.get('ay', 0.5),
                            'pts': extra.get('pts', {}), 'desc': extra.get('desc', '')}
        elif endung in TON_ENDUNGEN:
            if name in toene:
                warnung(f'{name}: mehrere Tondateien – nehme {toene[name]["file"]}')
                continue
            toene[name] = {'file': datei.name, 'desc': punkte['audio'].get(name, {}).get('desc', '')}

    for name in punkte['images']:
        if name not in bilder:
            warnung(f'punkte.json nennt Bild „{name}", aber es gibt keine Datei dazu.')
    for name in punkte['audio']:
        if name not in toene:
            warnung(f'punkte.json nennt Ton „{name}", aber es gibt keine Datei dazu.')

    daten = {'id': ordner.resolve().name, 'images': bilder, 'audio': toene}
    ziel = ordner / 'pack.json'
    json_schreiben_atomar(ziel, None, text=pack_text(daten))
    ausgabe({'file': pfad_text(ziel), 'id': daten['id'], 'images': len(bilder), 'audio': len(toene)})


class Dateisperre:
    """Einfache Sperre über eine Sperrdatei (funktioniert unter Windows und Linux)."""

    def __init__(self, pfad, zeitlimit=20.0):
        self.pfad = str(pfad)
        self.zeitlimit = zeitlimit

    def __enter__(self):
        start = time.time()
        while True:
            try:
                griff = os.open(self.pfad, os.O_CREAT | os.O_EXCL | os.O_WRONLY)
                os.write(griff, str(os.getpid()).encode())
                os.close(griff)
                return self
            except FileExistsError:
                try:   # liegengebliebene Sperre (abgestürzter Lauf) nach 30 s entfernen
                    if time.time() - os.path.getmtime(self.pfad) > 30:
                        os.unlink(self.pfad)
                        continue
                except OSError:
                    pass
                if time.time() - start > self.zeitlimit:
                    abbruch(f'Sperre {self.pfad} wird nicht frei.')
                time.sleep(0.02)

    def __exit__(self, *fehler):
        try:
            os.unlink(self.pfad)
        except OSError:
            pass


def befehl_anker(args):
    ordner = Path(args.ordner)
    if not ordner.is_dir():
        abbruch(f'Ordner nicht gefunden: {ordner}')
    teil = 'audio' if args.ton else 'images'
    if args.ton and (args.ax is not None or args.ay is not None or args.pt):
        abbruch('Bei --ton gibt es nur --desc.')
    for wert, name in ((args.ax, 'ax'), (args.ay, 'ay')):
        if wert is not None and not 0 <= wert <= 1:
            warnung(f'{name}={wert} liegt außerhalb von 0…1.')

    punkte_neu = {}
    for angabe in args.pt or []:
        try:
            pname, xy = angabe.split('=', 1)
            x, y = (float(v) for v in xy.split(','))
        except ValueError:
            abbruch(f'--pt erwartet name=x,y (z. B. mouth=420,380), nicht „{angabe}"')
        punkte_neu[pname.strip()] = [int(x) if x.is_integer() else x, int(y) if y.is_integer() else y]

    endungen = TON_ENDUNGEN if args.ton else BILD_ENDUNGEN
    if not any((ordner / (args.name + e)).exists() for e in endungen):
        warnung(f'Im Ordner gibt es (noch) keine Datei „{args.name}" mit {"/".join(endungen)}.')

    eintrag = punkte_eintragen(ordner, teil, args.name, ax=args.ax, ay=args.ay, pts=punkte_neu, desc=args.desc)
    ausgabe({'file': pfad_text(ordner / 'punkte.json'), teil: {args.name: eintrag}})


def punkte_eintragen(ordner, teil, name, ax=None, ay=None, pts=None, desc=None):
    """Einen Eintrag in punkte.json ergänzen – gesperrt gelesen, geändert und geschrieben."""
    ordner = Path(ordner)
    with Dateisperre(ordner / 'punkte.json.lock'):
        daten = punkte_lesen(ordner)
        eintrag = daten[teil].setdefault(name, {})
        if ax is not None:
            eintrag['ax'] = ax
        if ay is not None:
            eintrag['ay'] = ay
        if pts:
            eintrag.setdefault('pts', {}).update(pts)
        if desc is not None:
            eintrag['desc'] = desc
        json_schreiben_atomar(ordner / 'punkte.json', daten)
    return eintrag


# ---------------------------------------------------------------------------
# Befehlszeile
# ---------------------------------------------------------------------------

def main():
    haupt = argparse.ArgumentParser(
        prog='bild.py', description='Bild-Werkzeuge für Sigo 2.',
        epilog='Hilfe zu einem Unterbefehl: python tools/bild.py sprite -h')
    unter = haupt.add_subparsers(dest='befehl', required=True, metavar='unterbefehl')

    def neu(name, hilfe, beispiel):
        return unter.add_parser(name, help=hilfe, description=hilfe,
                                epilog=f'Beispiel:\n  {beispiel}',
                                formatter_class=argparse.RawDescriptionHelpFormatter)

    p = neu('holen', 'Datei per HTTPS laden (legt Ordner an).',
            'python tools/bild.py holen https://example.com/kuh.png art/bauernhof/kuh_idle.png')
    p.add_argument('url')
    p.add_argument('ziel')
    p.set_defaults(fn=befehl_holen)

    p = neu('sprite', 'Sprite zuschneiden, verkleinern und als WebP mit Alpha speichern.',
            'python tools/bild.py sprite art/tiere/kuh_idle.png assets/tiere/kuh_idle.webp --max 900 '
            '--eintragen --desc "Kuh steht, schaut nach vorn"')
    p.add_argument('roh')
    p.add_argument('ziel')
    p.add_argument('--max', type=int, default=1024, help='längste Seite höchstens (Standard 1024)')
    p.add_argument('--rand', type=int, default=6, help='durchsichtiger Rand in Bildpunkten (Standard 6)')
    p.add_argument('--anker', choices=['unten', 'mitte'], default='unten',
                   help='unten = steht auf dem Boden (Standard), mitte = Bildmitte')
    p.add_argument('--eintragen', action='store_true',
                   help='Anker gleich in punkte.json im Zielordner eintragen (wie „anker")')
    p.add_argument('--desc', help='mit --eintragen: kurze Beschreibung dazuschreiben')
    p.set_defaults(fn=befehl_sprite)

    p = neu('hintergrund', 'Hintergrund auf Höhe bringen und als WebP ohne Alpha speichern.',
            'python tools/bild.py hintergrund art/bauernhof/hof.png assets/bauernhof/hof.webp')
    p.add_argument('roh')
    p.add_argument('ziel')
    p.add_argument('--hoehe', type=int, default=1600)
    p.add_argument('--qualitaet', type=int, default=88)
    p.set_defaults(fn=befehl_hintergrund)

    p = neu('nahtlos', 'Bild waagrecht kachelbar machen (rechter Rand weich über den linken).',
            'python tools/bild.py nahtlos art/strasse/huegel.png assets/strasse/huegel.webp --hoehe 800 --anteil 0.1')
    p.add_argument('roh')
    p.add_argument('ziel')
    p.add_argument('--hoehe', type=int, default=0, help='vorher auf diese Höhe skalieren')
    p.add_argument('--überlappung', '--anteil', dest='anteil', type=float, default=0.12,
                   help='Anteil der Breite, der überblendet wird (Standard 0.12); das Ergebnis wird so viel schmaler')
    p.add_argument('--qualitaet', type=int, default=88)
    p.set_defaults(fn=befehl_nahtlos)

    p = neu('raster', 'Bild mit Koordinaten-Gitter (in Bildpunkten des Quellbilds) zum Ablesen von Punkten.',
            'python tools/bild.py raster assets/tiere/kuh_idle.webp art/raster/kuh.jpg --schritt 50')
    p.add_argument('bild')
    p.add_argument('ziel')
    p.add_argument('--schritt', type=int, default=100, help='Linienabstand in Quell-Bildpunkten')
    p.add_argument('--breite', type=int, default=1100, help='Breite des Bildes im Ergebnis')
    p.set_defaults(fn=befehl_raster)

    p = neu('bogen', 'Übersichtsblatt vieler Bilder mit Namen und Maßen.',
            'python tools/bild.py bogen assets/tiere art/bogen/tiere.jpg --spalten 5')
    p.add_argument('eingaben', nargs='+', metavar='ordner|datei')
    p.add_argument('ziel')
    p.add_argument('--spalten', type=int, default=6)
    p.add_argument('--kachel', type=int, default=360)
    p.set_defaults(fn=befehl_bogen)

    p = neu('pack', 'pack.json eines Pakets aus den Dateien und punkte.json bauen.',
            'python tools/bild.py pack assets/bauernhof')
    p.add_argument('ordner')
    p.set_defaults(fn=befehl_pack)

    p = neu('anker', 'Anker, Punkte und Beschreibung in punkte.json eintragen.',
            'python tools/bild.py anker assets/tiere kuh_idle --ax 0.5 --ay 0.97 --pt mouth=420,380 '
            '--desc "Kuh steht, schaut nach vorn"\n'
            '  python tools/bild.py anker assets/tiere muh --ton --desc "Kuh muht"')
    p.add_argument('ordner')
    p.add_argument('name', help='Dateiname ohne Endung')
    p.add_argument('--ax', type=float)
    p.add_argument('--ay', type=float)
    p.add_argument('--pt', action='append', metavar='name=x,y', help='benannter Punkt (mehrfach möglich)')
    p.add_argument('--desc', help='kurze Beschreibung')
    p.add_argument('--ton', action='store_true', help='Eintrag gehört zu einem Ton (nur --desc)')
    p.set_defaults(fn=befehl_anker)

    args = haupt.parse_args()
    args.fn(args)


if __name__ == '__main__':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
        sys.stderr.reconfigure(encoding='utf-8')
    except AttributeError:
        pass
    main()
