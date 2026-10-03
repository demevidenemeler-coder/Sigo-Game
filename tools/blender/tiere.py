# Alle Tiere (und der Teddy) im gleichen Spielzeug-Stil: weich verschmolzene Körper (Voxel-Remesh)
# plus scharf abgesetzte Einzelteile (Augen, Schnauzen, Ohren, Flecken …). Ein Mesh mit Eckfarben pro Tier.
#
# Aufruf:  python3 tools/blender/tiere.py            → alle
#          python3 tools/blender/tiere.py kuh hund   → nur diese
#
# Koordinaten (Blender): x = vorne (Blickrichtung), y = Seite (−y zeigt zur Kamera), z = oben. Boden: z = 0.
# Größen wie die alten Figuren (passen in die Wagen): meist 0,5–0,9 hoch, Pferd ~1,05, Giraffe ~1,45.
import sys, os, math
sys.path.insert(0, os.path.dirname(__file__))
from common import *

E = (0, 0, 0)
DARK = '#26262a'
OUT = os.path.join(os.path.dirname(__file__), '..', '..', 'models')


# ---------- Baukasten ----------

def eyes(x, spread, z, size=0.034, white=False, side_tilt=0.0):
    """Große, freundliche Augen mit Glanzpunkt. white=True: weißes Auge mit Pupille (für dunkle Köpfe)."""
    out = []
    for s in (1, -1):
        y = s * spread
        if white:
            out.append(prim('sphere', (x, y, z), (size * 0.9, size * 0.9, size * 1.15), color='#ffffff', seg=14))
            out.append(prim('sphere', (x + size * 0.45, y + s * size * 0.25, z), (size * 0.55, size * 0.55, size * 0.7), color=DARK, seg=12))
            out.append(prim('sphere', (x + size * 0.8, y + s * size * 0.4, z + size * 0.3), (size * 0.2,) * 3, color='#ffffff', seg=8))
        else:
            out.append(prim('sphere', (x, y, z), (size, size, size * 1.18), color=DARK, seg=14))
            out.append(prim('sphere', (x + size * 0.7, y + s * size * 0.45, z + size * 0.45), (size * 0.36,) * 3, color='#ffffff', seg=8))
    return out


def legs(xs, ys, h, r, z0=0.0):
    """Beine als Teile des weichen Körpers (shape-Liste für blob)."""
    return [('cyl', (x, y, z0 + h / 2), (r, r, h), E) for x in xs for y in ys]


def hooves(xs, ys, r, color, h=0.055):
    return [prim('cyl', (x, y, h / 2), (r * 1.08, r * 1.08, h), color=color, seg=14) for x in xs for y in ys]


def body(name, shapes, color, **kw):
    b = blob(name, shapes, **kw)
    paint(b, lambda p, n: color)
    return b


def dots(points, r, color, seg=10):
    return [prim('sphere', p, (r, r, r), color=color, seg=seg) for p in points]


# ---------- Tiere ----------

def kuh():
    W, PINK, HORN, HOOF = '#fbfaf6', '#f4a9b8', '#f1e4c2', '#4a4448'
    xs, ys = (0.17, -0.17), (0.09, -0.09)
    parts = [body('kuh', [
        ('sphere', (0, 0, 0.47), (0.32, 0.18, 0.17), E),
        ('sphere', (0.22, 0, 0.53), (0.13, 0.13, 0.13), E),
        ('sphere', (0.35, 0, 0.66), (0.155, 0.14, 0.145), E),
        *legs(xs, ys, 0.3, 0.062, 0.01),
    ], W)]
    parts.append(prim('sphere', (0.47, 0, 0.6), (0.09, 0.12, 0.085), color=PINK, seg=24))
    for s in (1, -1):
        parts.append(prim('sphere', (0.548, s * 0.045, 0.61), (0.014, 0.022, 0.018), color='#8a4250', seg=10))
    parts.append(prim('sphere', (-0.08, 0, 0.33), (0.07, 0.075, 0.055), color=PINK, seg=16))
    parts += hooves(xs, ys, 0.064, HOOF, 0.06)
    for (x, z, sx, sz, side) in [(0.06, 0.52, 0.09, 0.075, 1), (-0.17, 0.44, 0.07, 0.06, 1), (-0.02, 0.4, 0.05, 0.04, 1),
                                 (-0.05, 0.5, 0.1, 0.08, -1), (0.15, 0.42, 0.06, 0.05, -1)]:
        parts.append(prim('sphere', (x, side * 0.155, z), (sx, 0.04, sz), color=DARK, seg=16))
    parts.append(prim('sphere', (0.33, 0.115, 0.74), (0.06, 0.04, 0.05), rot=(0.5, 0, 0), color=DARK, seg=16))
    parts += eyes(0.465, 0.085, 0.71)
    for s in (1, -1):
        parts.append(prim('cone', (0.33, s * 0.095, 0.84), (0.034, 0.034, 0.11), rot=(-s * 0.5, 0, 0), color=HORN, seg=10))
        parts.append(prim('sphere', (0.31, s * 0.19, 0.74), (0.04, 0.085, 0.024), rot=(s * 0.4, 0, 0.15), color=W, seg=14))
        parts.append(prim('sphere', (0.318, s * 0.2, 0.745), (0.022, 0.06, 0.012), rot=(s * 0.4, 0, 0.15), color=PINK, seg=10))
    parts.append(prim('cyl', (-0.36, 0, 0.45), (0.016, 0.016, 0.27), rot=(0, 0.4, 0), color=W, seg=8))
    parts.append(prim('sphere', (-0.41, 0, 0.32), (0.035, 0.035, 0.055), color=DARK, seg=12))
    return parts


def schwein():
    P, P2 = '#f6adbf', '#ee8fa6'
    xs, ys = (0.15, -0.15), (0.1, -0.1)
    parts = [body('schwein', [
        ('sphere', (0, 0, 0.36), (0.31, 0.22, 0.21), E),
        ('sphere', (0.29, 0, 0.45), (0.17, 0.16, 0.16), E),
        *legs(xs, ys, 0.2, 0.06, 0.0),
    ], P)]
    parts.append(prim('cyl', (0.465, 0, 0.42), (0.085, 0.09, 0.07), rot=(0, math.pi / 2, 0), color=P2, seg=20))
    for s in (1, -1):
        parts.append(prim('sphere', (0.502, s * 0.035, 0.425), (0.012, 0.018, 0.024), color='#8a3b50', seg=10))
        # Schlappohren nach vorne gekippt
        parts.append(prim('cone', (0.33, s * 0.1, 0.6), (0.06, 0.035, 0.1), rot=(-s * 0.35, 0.55, 0), color=P2, seg=12))
    parts += eyes(0.42, 0.075, 0.51, 0.03)
    parts += hooves(xs, ys, 0.062, '#c9708a', 0.045)
    parts.append(prim('torus', (-0.33, 0, 0.44), (0.04, 0.04, 0.04), rot=(math.pi / 2, 0, 0), color=P2, seg=16, minor=0.3, arc=math.pi * 1.7))
    # rosige Bäckchen
    for s in (1, -1):
        parts.append(prim('sphere', (0.38, s * 0.12, 0.42), (0.03, 0.012, 0.022), color='#f07a96', seg=10))
    return parts


def schaf():
    WOOL, FACE = '#f8f5ee', '#3d3a38'
    wool = [('sphere', (x, y, z), (r, r, r), E) for (x, y, z, r) in [
        (0, 0, 0.45, 0.19), (0.14, 0.06, 0.47, 0.15), (0.14, -0.06, 0.47, 0.15), (-0.15, 0.07, 0.46, 0.16),
        (-0.15, -0.07, 0.46, 0.16), (0, 0.09, 0.58, 0.14), (0, -0.09, 0.58, 0.14), (0.04, 0, 0.35, 0.15),
        (-0.06, 0.11, 0.38, 0.13), (-0.06, -0.11, 0.38, 0.13), (0.1, 0, 0.6, 0.13), (-0.12, 0, 0.6, 0.13)]]
    parts = [body('schaf', wool, WOOL, smooth_iter=4, smooth_factor=0.4)]
    parts.append(prim('sphere', (0.3, 0, 0.58), (0.11, 0.095, 0.12), rot=(0, 0.35, 0), color=FACE, seg=20))
    parts.append(prim('sphere', (0.25, 0, 0.69), (0.09, 0.09, 0.07), color=WOOL, seg=16))
    parts += eyes(0.37, 0.055, 0.62, 0.028, white=True)
    for s in (1, -1):
        parts.append(prim('sphere', (0.26, s * 0.12, 0.62), (0.03, 0.065, 0.02), rot=(s * 0.3, 0, 0), color=FACE, seg=12))
        parts.append(prim('sphere', (0.39, s * 0.025, 0.54), (0.008, 0.012, 0.01), color='#151515', seg=8))
    for x in (0.13, -0.13):
        for y in (0.08, -0.08):
            parts.append(prim('cyl', (x, y, 0.16), (0.035, 0.035, 0.32), color=FACE, seg=10))
    parts.append(prim('sphere', (-0.29, 0, 0.5), (0.06, 0.06, 0.06), color=WOOL, seg=12))
    return parts


def hund():
    F, LIGHT, EAR = '#c98b4f', '#efd2aa', '#8a5a33'
    xs, ys = (0.14, -0.14), (0.075, -0.075)
    parts = [body('hund', [
        ('sphere', (0, 0, 0.37), (0.24, 0.13, 0.13), E),
        ('sphere', (0.2, 0, 0.45), (0.1, 0.1, 0.1), E),
        ('sphere', (0.28, 0, 0.56), (0.15, 0.14, 0.14), E),
        *legs(xs, ys, 0.3, 0.048, 0.0),
    ], F)]
    parts.append(prim('sphere', (0.41, 0, 0.52), (0.09, 0.085, 0.07), color=LIGHT, seg=20))
    parts.append(prim('sphere', (0.495, 0, 0.55), (0.032, 0.04, 0.03), color=DARK, seg=12))
    parts.append(prim('sphere', (0.2, 0, 0.4), (0.07, 0.09, 0.09), color=LIGHT, seg=14))  # weiße Brust
    parts += eyes(0.39, 0.065, 0.6, 0.03)
    for s in (1, -1):
        parts.append(prim('sphere', (0.25, s * 0.14, 0.53), (0.045, 0.03, 0.1), rot=(s * 0.25, 0.15, 0), color=EAR, seg=14))
        parts.append(prim('sphere', (0.14, s * 0.11, 0.025), (0.06, 0.04, 0.03), color=LIGHT, seg=10))  # Pfoten vorne
        parts.append(prim('sphere', (-0.14, s * 0.075, 0.025), (0.055, 0.04, 0.03), color=LIGHT, seg=10))
    parts.append(prim('cyl', (-0.27, 0, 0.5), (0.024, 0.024, 0.2), rot=(0, -0.7, 0), color=F, seg=8))
    parts.append(prim('sphere', (-0.33, 0, 0.58), (0.032, 0.032, 0.04), color=LIGHT, seg=10))
    parts.append(prim('torus', (0.2, 0, 0.47), (0.1, 0.1, 0.1), rot=(0, math.pi / 2 - 0.5, 0), color='#e5484d', seg=24, minor=0.12))  # Halsband
    return parts


def katze():
    F, LIGHT, STRIPE, PINK = '#f2a24e', '#fff3e6', '#d9822f', '#f2a0b0'
    xs, ys = (0.11, -0.11), (0.06, -0.06)
    parts = [body('katze', [
        ('sphere', (0, 0, 0.3), (0.2, 0.11, 0.11), E),
        ('sphere', (0.22, 0, 0.47), (0.15, 0.14, 0.13), E),
        ('sphere', (0.13, 0, 0.38), (0.09, 0.09, 0.09), E),
        *legs(xs, ys, 0.24, 0.036, 0.0),
    ], F)]
    for s in (1, -1):
        parts.append(prim('sphere', (0.33, s * 0.035, 0.43), (0.045, 0.05, 0.04), color=LIGHT, seg=14))
        parts.append(prim('cone', (0.2, s * 0.075, 0.62), (0.055, 0.04, 0.085), rot=(-s * 0.3, 0, 0), color=F, seg=10))
        parts.append(prim('cone', (0.215, s * 0.075, 0.615), (0.032, 0.02, 0.06), rot=(-s * 0.3, 0, 0), color=PINK, seg=8))
        for k in (-1, 1):  # Schnurrhaare
            parts.append(prim('cyl', (0.36, s * 0.09, 0.44 + k * 0.012), (0.003, 0.003, 0.1), rot=(math.pi / 2 + s * k * 0.15, 0, 0), color='#ffffff', seg=4))
    parts.append(prim('sphere', (0.365, 0, 0.465), (0.016, 0.022, 0.014), color=PINK, seg=10))
    parts += eyes(0.33, 0.06, 0.5, 0.03)
    for x in (-0.1, 0.0, 0.09):
        for s in (1, -1):
            parts.append(prim('sphere', (x, s * 0.1, 0.36), (0.022, 0.025, 0.06), color=STRIPE, seg=10))
    # Schwanz: Bogen nach oben
    parts.append(prim('torus', (-0.22, 0, 0.44), (0.16, 0.16, 0.16), rot=(math.pi / 2, 0, -0.2), color=F, seg=14, minor=0.15, arc=math.pi * 0.9))
    parts.append(prim('sphere', (-0.36, 0, 0.47), (0.026, 0.026, 0.03), color=LIGHT, seg=10))
    return parts


def ente():
    Y, Y2, BILL = '#f8d63e', '#eec52e', '#f08c2b'
    parts = [body('ente', [
        ('sphere', (0, 0, 0.22), (0.26, 0.19, 0.17), E),
        ('sphere', (0.17, 0, 0.32), (0.09, 0.09, 0.1), E),
        ('sphere', (0.19, 0, 0.45), (0.13, 0.12, 0.12), E),
        ('cone', (-0.25, 0, 0.3), (0.08, 0.09, 0.16), (0, -1.0, 0)),
    ], Y)]
    parts.append(prim('sphere', (0.33, 0, 0.42), (0.085, 0.07, 0.03), color=BILL, seg=18))
    parts.append(prim('sphere', (0.33, 0, 0.395), (0.075, 0.06, 0.022), color='#d8731f', seg=16))
    parts += eyes(0.28, 0.065, 0.5, 0.028)
    for s in (1, -1):
        parts.append(prim('sphere', (-0.02, s * 0.175, 0.25), (0.13, 0.04, 0.08), rot=(s * 0.2, 0.25, 0), color=Y2, seg=16))
        parts.append(prim('sphere', (0.05, s * 0.07, 0.015), (0.07, 0.045, 0.015), color=BILL, seg=10))
    parts.append(prim('sphere', (0.17, 0, 0.58), (0.03, 0.02, 0.04), rot=(0, -0.4, 0), color=Y2, seg=8))  # Federlocke
    return parts


def pferd():
    F, MANE, MUZ, HOOF = '#a5693a', '#3d2a1c', '#d2a074', '#3d3d3d'
    xs, ys = (0.21, -0.21), (0.09, -0.09)
    parts = [body('pferd', [
        ('sphere', (0, 0, 0.6), (0.34, 0.17, 0.17), E),
        ('cyl', (0.3, 0, 0.8), (0.085, 0.085, 0.36), (0, 0.55, 0)),
        ('sphere', (0.43, 0, 0.95), (0.12, 0.1, 0.1), E),
        ('sphere', (0.56, 0, 0.9), (0.09, 0.08, 0.075), E),
        *legs(xs, ys, 0.5, 0.048, 0.0),
    ], F, voxel=0.011)]
    parts.append(prim('sphere', (0.6, 0, 0.885), (0.06, 0.075, 0.062), color=MUZ, seg=18))
    for s in (1, -1):
        parts.append(prim('sphere', (0.655, s * 0.032, 0.9), (0.01, 0.015, 0.014), color='#5a3a28', seg=8))
        parts.append(prim('cone', (0.4, s * 0.05, 1.07), (0.03, 0.022, 0.08), rot=(-s * 0.25, -0.15, 0), color=F, seg=10))
    parts += eyes(0.51, 0.07, 0.98, 0.03)
    parts.append(prim('sphere', (0.53, 0, 1.0), (0.03, 0.01, 0.02), color='#ffffff', seg=8))  # Blesse
    for i in range(6):  # Mähne
        t = i / 5
        parts.append(prim('sphere', (0.2 + t * 0.22, 0, 0.82 + t * 0.24), (0.045, 0.035, 0.06), rot=(0, -0.6, 0), color=MANE, seg=12))
    parts.append(prim('sphere', (0.47, 0, 1.06), (0.05, 0.03, 0.03), color=MANE, seg=10))  # Stirnlocke
    parts.append(prim('cone', (-0.38, 0, 0.5), (0.06, 0.05, 0.3), rot=(0, 0.35, 0), color=MANE, seg=12))
    parts += hooves(xs, ys, 0.05, HOOF, 0.07)
    return parts


def huhn(hahn=False):
    W, RED, BEAK, LEG = '#f8f5ee', '#e5484d', '#f0a030', '#f0a030'
    parts = [body('hahn' if hahn else 'huhn', [
        ('sphere', (0, 0, 0.28), (0.2, 0.15, 0.16), E),
        ('sphere', (0.13, 0, 0.42), (0.1, 0.09, 0.1), E),
        ('cone', (-0.19, 0, 0.36), (0.09, 0.07, 0.16), (0, -0.7, 0)),
    ], W)]
    parts.append(prim('cone', (0.245, 0, 0.43), (0.03, 0.025, 0.07), rot=(0, math.pi / 2, 0), color=BEAK, seg=10))
    parts.append(prim('sphere', (0.21, 0, 0.37), (0.022, 0.018, 0.035), color=RED, seg=10))  # Kehllappen
    combs = [(0.1, 0.53, 0.035), (0.15, 0.545, 0.03)] if not hahn else [(0.07, 0.54, 0.04), (0.12, 0.57, 0.045), (0.17, 0.55, 0.035)]
    for (x, z, r) in combs:
        parts.append(prim('sphere', (x, 0, z), (r, r * 0.6, r * 1.1), color=RED, seg=12))
    parts += eyes(0.19, 0.06, 0.45, 0.024)
    for s in (1, -1):
        parts.append(prim('sphere', (-0.02, s * 0.14, 0.29), (0.1, 0.035, 0.065), rot=(s * 0.15, 0.25, 0), color='#ece6d8', seg=14))
        parts.append(prim('cyl', (0.02, s * 0.05, 0.06), (0.012, 0.012, 0.12), color=LEG, seg=6))
        parts.append(prim('sphere', (0.05, s * 0.05, 0.01), (0.04, 0.025, 0.01), color=LEG, seg=8))
    if hahn:
        for (ang, col) in [(0.3, '#3d6b4a'), (0.65, '#d9822f'), (1.0, '#2f5c9e'), (-0.05, '#3d6b4a')]:
            parts.append(prim('torus', (-0.2, 0, 0.42), (0.13, 0.13, 0.13), rot=(math.pi / 2, 0, ang + 1.3), color=col, seg=10, minor=0.18, arc=math.pi * 0.7))
    return parts


def hase():
    F, LIGHT, PINK = '#dccfbd', '#ffffff', '#f2b0bd'
    parts = [body('hase', [
        ('sphere', (0, 0, 0.21), (0.19, 0.15, 0.17), E),
        ('sphere', (0.15, 0, 0.39), (0.12, 0.115, 0.11), E),
        ('sphere', (0.12, 0.08, 0.06), (0.09, 0.05, 0.05), E),
        ('sphere', (0.12, -0.08, 0.06), (0.09, 0.05, 0.05), E),
    ], F)]
    for s in (1, -1):
        parts.append(prim('sphere', (0.11, s * 0.05, 0.6), (0.035, 0.03, 0.14), rot=(-s * 0.2, -0.15, 0), color=F, seg=14))
        parts.append(prim('sphere', (0.12, s * 0.058, 0.6), (0.02, 0.02, 0.11), rot=(-s * 0.2, -0.15, 0), color=PINK, seg=10))
        parts.append(prim('sphere', (0.25, s * 0.03, 0.36), (0.035, 0.035, 0.03), color=LIGHT, seg=12))  # Bäckchen
    parts.append(prim('sphere', (0.27, 0, 0.385), (0.015, 0.02, 0.013), color='#e5738a', seg=10))
    parts += eyes(0.23, 0.06, 0.43, 0.026)
    parts.append(prim('sphere', (-0.19, 0, 0.24), (0.055, 0.055, 0.055), color=LIGHT, seg=14))
    parts.append(prim('sphere', (0.12, 0, 0.18), (0.08, 0.1, 0.1), color=LIGHT, seg=14))  # Bauch
    return parts


def frosch():
    G, LIGHT, DARKG = '#62b25c', '#c7e59a', '#3f8a3a'
    parts = [body('frosch', [
        ('sphere', (0, 0, 0.16), (0.2, 0.18, 0.13), E),
        ('sphere', (0.08, 0.09, 0.28), (0.07, 0.07, 0.07), E),
        ('sphere', (0.08, -0.09, 0.28), (0.07, 0.07, 0.07), E),
        ('sphere', (-0.1, 0.16, 0.08), (0.11, 0.06, 0.06), E),
        ('sphere', (-0.1, -0.16, 0.08), (0.11, 0.06, 0.06), E),
    ], G)]
    parts.append(prim('sphere', (0.06, 0, 0.12), (0.15, 0.13, 0.09), color=LIGHT, seg=18))
    for s in (1, -1):
        parts.append(prim('sphere', (0.12, s * 0.09, 0.31), (0.045, 0.045, 0.045), color='#ffffff', seg=14))
        parts.append(prim('sphere', (0.155, s * 0.095, 0.315), (0.024, 0.024, 0.028), color=DARK, seg=12))
        parts.append(prim('sphere', (0.168, s * 0.1, 0.33), (0.008, 0.008, 0.008), color='#ffffff', seg=6))
        parts.append(prim('sphere', (0.16, s * 0.12, 0.02), (0.06, 0.035, 0.012), color=G, seg=10))
        for k in range(3):
            parts.append(prim('sphere', (-0.02 + k * 0.08, s * 0.155, 0.22 + (k % 2) * 0.02), (0.015, 0.008, 0.015), color=DARKG, seg=8))
    # Lächeln: Bogen vorne
    parts.append(prim('torus', (0.185, 0, 0.2), (0.075, 0.075, 0.075), rot=(0, math.pi / 2, 0), color=DARKG, seg=14, minor=0.13, arc=math.pi * 0.6, start=-math.pi * 0.3))
    return parts


def loewe():
    F, MANE, MUZ = '#ebb44f', '#c26a2a', '#f8dca0'
    xs, ys = (0.16, -0.16), (0.09, -0.09)
    parts = [body('loewe', [
        ('sphere', (0, 0, 0.42), (0.27, 0.15, 0.15), E),
        ('sphere', (0.35, 0, 0.6), (0.14, 0.13, 0.13), E),
        *legs(xs, ys, 0.32, 0.055, 0.0),
    ], F)]
    mane = [('sphere', (0.3 + math.cos(a) * 0.02, math.sin(a) * 0.15, 0.6 + math.cos(a) * 0.15), (0.075, 0.075, 0.075), E)
            for a in [i * math.tau / 11 for i in range(11)]]
    mane.append(('sphere', (0.26, 0, 0.6), (0.14, 0.16, 0.17), E))
    m = blob('maehne', mane, smooth_iter=4, smooth_factor=0.4)
    paint(m, lambda p, n: MANE)
    parts.append(m)
    parts.append(prim('sphere', (0.47, 0, 0.56), (0.07, 0.085, 0.06), color=MUZ, seg=18))
    parts.append(prim('sphere', (0.535, 0, 0.59), (0.026, 0.034, 0.022), color='#4a2c1c', seg=12))
    parts += eyes(0.45, 0.07, 0.66, 0.03)
    for s in (1, -1):
        parts.append(prim('sphere', (0.34, s * 0.12, 0.76), (0.04, 0.025, 0.04), color=F, seg=12))
        parts.append(prim('sphere', (0.35, s * 0.115, 0.76), (0.022, 0.012, 0.022), color=MANE, seg=8))
    parts.append(prim('cyl', (-0.32, 0, 0.42), (0.02, 0.02, 0.3), rot=(0, 0.75, 0), color=F, seg=8))
    parts.append(prim('sphere', (-0.43, 0, 0.32), (0.045, 0.045, 0.06), color=MANE, seg=12))
    for x in xs:
        for y in ys:
            parts.append(prim('sphere', (x + 0.02, y, 0.025), (0.065, 0.06, 0.03), color=MUZ, seg=10))
    return parts


def elefant():
    G, G2, PINK, TUSK = '#a3adb8', '#8e98a3', '#f0b6c2', '#faf6ee'
    xs, ys = (0.19, -0.19), (0.12, -0.12)
    trunk = [('sphere', (0.5 + 0.06 * math.sin(t * 1.4), 0, 0.55 - t * 0.33), (0.065 - t * 0.022,) * 3, E) for t in [i / 7 for i in range(8)]]
    parts = [body('elefant', [
        ('sphere', (0, 0, 0.5), (0.36, 0.27, 0.27), E),
        ('sphere', (0.36, 0, 0.62), (0.2, 0.19, 0.19), E),
        *trunk,
        *legs(xs, ys, 0.32, 0.085, 0.0),
    ], G)]
    for s in (1, -1):
        parts.append(prim('sphere', (0.3, s * 0.21, 0.62), (0.14, 0.03, 0.17), rot=(0, 0, s * 0.25), color=G2, seg=20))
        parts.append(prim('sphere', (0.31, s * 0.225, 0.62), (0.1, 0.02, 0.125), rot=(0, 0, s * 0.25), color=PINK, seg=16))
        parts.append(prim('cone', (0.5, s * 0.1, 0.42), (0.025, 0.025, 0.1), rot=(0, 2.2, 0), color=TUSK, seg=10))
    parts += eyes(0.5, 0.11, 0.7, 0.032)
    for x in xs:
        for y in ys:
            for k in (-1, 0, 1):
                parts.append(prim('sphere', (x + 0.08, y + k * 0.035, 0.03), (0.018, 0.016, 0.02), color=TUSK, seg=8))
    parts.append(prim('cyl', (-0.38, 0, 0.45), (0.015, 0.015, 0.2), rot=(0, 0.35, 0), color=G, seg=8))
    parts.append(prim('sphere', (-0.415, 0, 0.36), (0.022, 0.022, 0.03), color='#5a626b', seg=8))
    return parts


def giraffe():
    F, SPOT, HOOF, MANE = '#f4c65c', '#b0723f', '#5c3b22', '#a0602e'
    xs, ys = (0.13, -0.13), (0.07, -0.07)
    parts = [body('giraffe', [
        ('sphere', (0, 0, 0.66), (0.23, 0.13, 0.14), E),
        ('cyl', (0.2, 0, 0.98), (0.065, 0.065, 0.62), (0, 0.32, 0)),
        ('sphere', (0.32, 0, 1.3), (0.1, 0.08, 0.08), E),
        ('sphere', (0.41, 0, 1.28), (0.07, 0.065, 0.06), E),
        *legs(xs, ys, 0.56, 0.032, 0.0),
    ], F, voxel=0.01)]
    for s in (1, -1):
        parts.append(prim('cyl', (0.28, s * 0.04, 1.42), (0.012, 0.012, 0.1), color=SPOT, seg=8))
        parts.append(prim('sphere', (0.28, s * 0.04, 1.475), (0.022, 0.022, 0.022), color=HOOF, seg=10))
        parts.append(prim('sphere', (0.25, s * 0.08, 1.37), (0.03, 0.045, 0.018), rot=(s * 0.6, 0, 0), color=F, seg=10))
        parts.append(prim('sphere', (0.465, s * 0.025, 1.29), (0.008, 0.012, 0.01), color='#5a3a28', seg=8))
    parts += eyes(0.37, 0.065, 1.34, 0.026)
    spots = [(0.08, 0.7, 0.13, 0.05), (-0.1, 0.62, 0.13, 0.05), (-0.04, 0.75, 0.12, 0.04), (0.12, 0.6, 0.12, 0.035),
             (0.08, 0.68, -0.13, 0.05), (-0.12, 0.66, -0.13, 0.045), (0.0, 0.58, -0.13, 0.035),
             (0.19, 0.93, 0.062, 0.03), (0.24, 1.08, -0.062, 0.028), (0.16, 0.86, -0.062, 0.03), (0.26, 1.15, 0.06, 0.025)]
    for (x, z, y, r) in spots:
        parts.append(prim('sphere', (x, y, z), (r, 0.02, r * 0.85), color=SPOT, seg=12))
    for i in range(7):  # kurze Mähne
        t = i / 6
        parts.append(prim('sphere', (0.1 + t * 0.2, 0, 0.8 + t * 0.48), (0.02, 0.018, 0.035), rot=(0, 0.32, 0), color=MANE, seg=8))
    parts += hooves(xs, ys, 0.034, HOOF, 0.05)
    parts.append(prim('cyl', (-0.24, 0, 0.62), (0.012, 0.012, 0.2), rot=(0, 0.3, 0), color=F, seg=6))
    parts.append(prim('sphere', (-0.27, 0, 0.52), (0.02, 0.02, 0.035), color=HOOF, seg=8))
    return parts


def pinguin():
    BLK, W, ORANGE = '#2b2f36', '#ffffff', '#f2a02f'
    parts = [body('pinguin', [
        ('sphere', (0, 0, 0.29), (0.17, 0.17, 0.25), E),
        ('sphere', (0.02, 0, 0.5), (0.13, 0.13, 0.12), E),
    ], BLK)]
    parts.append(prim('sphere', (0.06, 0, 0.27), (0.13, 0.13, 0.2), color=W, seg=24))  # Bauch
    parts.append(prim('sphere', (0.08, 0, 0.5), (0.085, 0.1, 0.075), color=W, seg=18))  # Gesicht
    parts.append(prim('cone', (0.165, 0, 0.47), (0.03, 0.03, 0.07), rot=(0, math.pi / 2, 0), color=ORANGE, seg=10))
    parts += eyes(0.145, 0.045, 0.53, 0.022)
    for s in (1, -1):
        parts.append(prim('sphere', (0, s * 0.17, 0.32), (0.05, 0.025, 0.13), rot=(s * 0.35, 0, 0), color=BLK, seg=14))
        parts.append(prim('sphere', (0.06, s * 0.06, 0.015), (0.065, 0.04, 0.015), color=ORANGE, seg=10))
        parts.append(prim('sphere', (0.13, s * 0.09, 0.46), (0.02, 0.012, 0.014), color='#f6a5b5', seg=8))  # Bäckchen
    return parts


def teddy():
    # Teddy schaut zur Kamera: vorne = −y
    F, LIGHT, BOW = '#ad7442', '#e0b081', '#e5484d'
    parts = [body('teddy', [
        ('sphere', (0, 0, 0.25), (0.18, 0.15, 0.21), E),
        ('sphere', (0, 0, 0.56), (0.165, 0.15, 0.15), E),
        ('sphere', (0.2, -0.02, 0.3), (0.065, 0.065, 0.12), (0, -0.4, 0)),
        ('sphere', (-0.2, -0.02, 0.3), (0.065, 0.065, 0.12), (0, 0.4, 0)),
        ('sphere', (0.1, -0.08, 0.07), (0.075, 0.1, 0.07), E),
        ('sphere', (-0.1, -0.08, 0.07), (0.075, 0.1, 0.07), E),
    ], F)]
    parts.append(prim('sphere', (0, -0.11, 0.24), (0.11, 0.06, 0.13), color=LIGHT, seg=18))  # Bauch
    parts.append(prim('sphere', (0, -0.13, 0.51), (0.075, 0.06, 0.06), color=LIGHT, seg=18))  # Schnauze
    parts.append(prim('sphere', (0, -0.185, 0.535), (0.03, 0.02, 0.022), color='#2b1d12', seg=12))
    for s in (1, -1):
        parts.append(prim('sphere', (s * 0.13, 0, 0.69), (0.06, 0.04, 0.06), color=F, seg=14))
        parts.append(prim('sphere', (s * 0.13, -0.025, 0.69), (0.035, 0.02, 0.035), color=LIGHT, seg=10))
        parts.append(prim('sphere', (s * 0.06, -0.135, 0.6), (0.026, 0.026, 0.03), color=DARK, seg=12))
        parts.append(prim('sphere', (s * 0.055 - s * 0.008, -0.158, 0.612), (0.009,) * 3, color='#ffffff', seg=6))
        parts.append(prim('sphere', (s * 0.1, -0.17, 0.055), (0.05, 0.02, 0.05), color=LIGHT, seg=12))  # Fußsohlen
        parts.append(prim('sphere', (s * 0.05, -0.12, 0.42), (0.045, 0.03, 0.03), rot=(0, s * 0.3, 0), color=BOW, seg=12))  # Schleife
    parts.append(prim('sphere', (0, -0.125, 0.42), (0.022, 0.022, 0.022), color=BOW, seg=10))
    return parts


ANIMALS = {
    'kuh': kuh, 'schwein': schwein, 'schaf': schaf, 'hund': hund, 'katze': katze, 'ente': ente, 'pferd': pferd,
    'huhn': huhn, 'hahn': lambda: huhn(True), 'hase': hase, 'frosch': frosch, 'loewe': loewe, 'elefant': elefant,
    'giraffe': giraffe, 'pinguin': pinguin, 'teddy': teddy,
}


# ---------- Menschen (schauen zur Kamera: vorne = −y). Der Winke-Arm fehlt hier – er bleibt im Spiel beweglich. ----------

SKIN = '#f3c9a5'


def face(z, r, hair, mouth_z, cheeks=True, smile=True):
    """Kopf-Details vorne: Augen mit Glanz, rosige Wangen, Lächeln."""
    out = []
    for s in (1, -1):
        out.append(prim('sphere', (s * r * 0.36, -r * 0.9, z + r * 0.05), (r * 0.17, r * 0.12, r * 0.21), color=DARK, seg=12))
        out.append(prim('sphere', (s * r * 0.36 - s * r * 0.05, -r * 0.99, z + r * 0.13), (r * 0.06,) * 3, color='#ffffff', seg=6))
        if cheeks:
            out.append(prim('sphere', (s * r * 0.58, -r * 0.78, z - r * 0.25), (r * 0.16, r * 0.06, r * 0.11), color='#f5a3a3', seg=10))
    if smile:
        out.append(prim('torus', (0, -r * 0.93, mouth_z + r * 0.12), (r * 0.22, r * 0.22, r * 0.22), rot=(math.pi / 2, 0, 0), color='#8a3b3b',
                        seg=12, minor=0.2, arc=math.pi * 0.8, start=-math.pi / 2 - math.pi * 0.4))
    out.append(prim('sphere', (0, -r * 0.98, z - r * 0.08), (r * 0.1, r * 0.08, r * 0.09), color='#e8b08a', seg=10))  # Näschen
    return out


def kind():
    SHIRT, PANTS, SHOE, HAIR = '#e5484d', '#3b6fb5', '#3a3a3a', '#6b4226'
    parts = [body('kind_k', [
        ('cyl', (0.06, 0, 0.13), (0.048, 0.048, 0.24), E),
        ('cyl', (-0.06, 0, 0.13), (0.048, 0.048, 0.24), E),
    ], PANTS)]
    parts.append(body('kind_t', [('sphere', (0, 0, 0.37), (0.135, 0.095, 0.16), E)], SHIRT))
    for s in (1, -1):
        parts.append(prim('sphere', (s * 0.06, -0.02, 0.03), (0.05, 0.07, 0.035), color=SHOE, seg=12))
    # linker Arm (hängt), der rechte winkt im Spiel
    parts.append(prim('cyl', (0.17, 0, 0.38), (0.036, 0.036, 0.2), rot=(0, 0.25, 0), color=SHIRT, seg=10))
    parts.append(prim('sphere', (0.2, 0, 0.27), (0.042,) * 3, color=SKIN, seg=10))
    parts.append(prim('sphere', (0, 0, 0.64), (0.15, 0.145, 0.15), color=SKIN, seg=24))
    parts.append(prim('sphere', (0, 0.02, 0.68), (0.158, 0.15, 0.13), color=HAIR, seg=22))
    parts.append(prim('sphere', (0, -0.07, 0.74), (0.12, 0.08, 0.05), rot=(0.4, 0, 0), color=HAIR, seg=16))  # Pony
    for s in (1, -1):
        parts.append(prim('sphere', (s * 0.15, 0, 0.62), (0.025, 0.03, 0.035), color=SKIN, seg=8))  # Ohren
    parts += face(0.64, 0.15, HAIR, 0.595)
    return parts


def oma():
    DRESS, TOP, HAIR = '#8b5bb5', '#b58ad6', '#dcdcdc'
    parts = [prim('cone', (0, 0, 0.21), (0.2, 0.17, 0.42), color=DRESS, seg=24, r2=0.6)]
    parts.append(body('oma_t', [('sphere', (0, 0, 0.46), (0.135, 0.095, 0.13), E)], TOP))
    for s in (1, -1):
        parts.append(prim('cyl', (s * 0.15, -0.02, 0.4), (0.034, 0.034, 0.21), rot=(0, -s * 0.2, 0), color=TOP, seg=10))
        parts.append(prim('sphere', (s * 0.17, -0.04, 0.29), (0.04,) * 3, color=SKIN, seg=10))
        parts.append(prim('sphere', (s * 0.06, -0.03, 0.02), (0.045, 0.06, 0.03), color='#5c3b22', seg=10))
    parts.append(prim('sphere', (0, 0, 0.67), (0.14, 0.135, 0.14), color=SKIN, seg=24))
    parts.append(prim('sphere', (0, 0.02, 0.71), (0.148, 0.14, 0.11), color=HAIR, seg=22))
    parts.append(prim('sphere', (0, 0.06, 0.81), (0.07, 0.07, 0.065), color=HAIR, seg=14))  # Dutt
    parts += face(0.67, 0.14, HAIR, 0.62)
    for s in (1, -1):  # Brille
        parts.append(prim('torus', (s * 0.05, -0.135, 0.68), (0.035, 0.035, 0.035), rot=(math.pi / 2, 0, 0), color='#6b5a4a', seg=16, minor=0.18))
    parts.append(prim('cyl', (0, -0.138, 0.68), (0.006, 0.006, 0.03), rot=(0, math.pi / 2, 0), color='#6b5a4a', seg=6))
    parts.append(prim('sphere', (0, -0.1, 0.52), (0.05, 0.02, 0.03), color='#f5c53a', seg=10))  # Brosche
    return parts


def papa():
    SHIRT, PANTS, SHOE, HAIR = '#4fa65a', '#3a3a3a', '#5c3b22', '#3d2a1c'
    parts = [body('papa_b', [
        ('cyl', (0.07, 0, 0.17), (0.054, 0.054, 0.32), E),
        ('cyl', (-0.07, 0, 0.17), (0.054, 0.054, 0.32), E),
    ], PANTS)]
    parts.append(body('papa_t', [('sphere', (0, 0, 0.5), (0.155, 0.105, 0.19), E)], SHIRT))
    for s in (1, -1):
        parts.append(prim('sphere', (s * 0.07, -0.025, 0.03), (0.055, 0.08, 0.035), color=SHOE, seg=12))
        parts.append(prim('cyl', (s * 0.19, 0, 0.48), (0.042, 0.042, 0.28), rot=(0, -s * 0.15, 0), color=SHIRT, seg=10))
        parts.append(prim('sphere', (s * 0.21, 0, 0.33), (0.047,) * 3, color=SKIN, seg=10))
    parts.append(prim('sphere', (0, 0, 0.83), (0.16, 0.155, 0.16), color=SKIN, seg=24))
    parts.append(prim('sphere', (0, 0.02, 0.88), (0.166, 0.158, 0.12), color=HAIR, seg=22))
    parts.append(prim('sphere', (0, -0.06, 0.75), (0.13, 0.09, 0.08), color=HAIR, seg=18))  # Bart
    parts += face(0.84, 0.16, HAIR, 0.765, cheeks=False, smile=False)
    return parts


def fahrer():
    # Lokführer schaut nach vorne (+x) aus dem Führerhaus; der Winke-Arm bleibt im Spiel beweglich
    BLUE, BLUE2 = '#2f5c9e', '#1f3f70'
    parts = [body('fahrer_t', [('sphere', (0, 0, 0.3), (0.115, 0.13, 0.15), E)], BLUE)]
    parts.append(prim('sphere', (0, 0, 0.56), (0.14, 0.14, 0.14), color=SKIN, seg=24))
    parts.append(prim('cyl', (0, 0, 0.665), (0.15, 0.15, 0.08), color=BLUE, seg=22))
    parts.append(prim('sphere', (0.01, 0, 0.7), (0.15, 0.15, 0.05), color=BLUE, seg=22))
    parts.append(prim('sphere', (0.13, 0, 0.635), (0.08, 0.12, 0.012), color=BLUE2, seg=16))  # Schirm
    parts.append(prim('sphere', (0.1, 0, 0.47), (0.06, 0.1, 0.06), color='#ffffff', seg=14))  # Bart
    for s in (1, -1):
        parts.append(prim('sphere', (0.12, s * 0.05, 0.585), (0.022, 0.018, 0.026), color=DARK, seg=10))
        parts.append(prim('sphere', (0.138, s * 0.055, 0.594), (0.007,) * 3, color='#ffffff', seg=6))
        parts.append(prim('sphere', (0.11, s * 0.09, 0.53), (0.015, 0.025, 0.018), color='#f5a3a3', seg=8))
    parts.append(prim('sphere', (0.14, 0, 0.55), (0.018, 0.016, 0.016), color='#e8b08a', seg=8))
    parts.append(prim('sphere', (0.1, 0, 0.36), (0.02, 0.02, 0.02), color='#f2c832', seg=8))  # Knopf
    return parts


ANIMALS.update({'kind': kind, 'oma': oma, 'papa': papa, 'fahrer': fahrer})

if __name__ == '__main__':
    want = sys.argv[1:] or list(ANIMALS)
    for name in want:
        reset()
        obj = join(ANIMALS[name](), name)
        export_sigm(obj, os.path.join(OUT, f'{name}.sigm'))
