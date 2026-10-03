# Kuh im Spielzeug-Stil: weich verschmolzener Körper (Rumpf, Hals, Kopf, Beine) + scharf abgesetzte Teile
# (Flecken, Schnauze, Hufe, Augen, Hörner, Ohren, Schwanz). Alles mit Eckfarben → ein Mesh, ein Material.
# Aufruf: python3 tools/blender/kuh.py [vorschau.png]
import sys, os, math
sys.path.insert(0, os.path.dirname(__file__))
from common import *

reset()
W, PINK, DARK, HORN, HOOF = '#fbfaf6', '#f4a9b8', '#26262a', '#f1e4c2', '#4a4448'
E = (0, 0, 0)

body = blob('kuh', [
    ('sphere', (0, 0, 0.47), (0.32, 0.18, 0.17), E),                      # Rumpf
    ('sphere', (0.22, 0, 0.53), (0.13, 0.13, 0.13), E),                   # Hals
    ('sphere', (0.35, 0, 0.66), (0.155, 0.14, 0.145), E),                 # Kopf (groß: Kindchenschema)
    *[('cyl', (x, y, 0.19), (0.064, 0.064, 0.3), E) for x in (0.18, -0.18) for y in (0.095, -0.095)],  # Beine
])
paint(body, lambda p, n: W)
parts = [body]

# Schnauze: eigenes rosa Teil, steckt halb im Kopf → klare Kante
parts.append(prim('sphere', (0.47, 0, 0.6), (0.09, 0.12, 0.085), color=PINK, seg=24))
for s in (1, -1):
    parts.append(prim('sphere', (0.548, s * 0.045, 0.61), (0.014, 0.022, 0.018), color='#8a4250', seg=10))
# Euter
parts.append(prim('sphere', (-0.08, 0, 0.33), (0.07, 0.075, 0.055), color=PINK, seg=16))
# Hufe: dunkle Ringe unten an den Beinen
for x in (0.18, -0.18):
    for y in (0.095, -0.095):
        parts.append(prim('cyl', (x, y, 0.03), (0.068, 0.068, 0.06), color=HOOF, seg=16))
# Flecken: flache dunkle Linsen, die knapp aus dem Rumpf ragen (Rumpf-Oberfläche liegt bei y ≈ ±0.18)
for (x, z, sx, sz, side) in [(0.06, 0.52, 0.09, 0.075, 1), (-0.17, 0.44, 0.07, 0.06, 1), (-0.02, 0.4, 0.05, 0.04, 1),
                             (-0.05, 0.5, 0.1, 0.08, -1), (0.15, 0.42, 0.06, 0.05, -1)]:
    parts.append(prim('sphere', (x, side * 0.155, z), (sx, 0.04, sz), color=DARK, seg=16))
# Fleck am Kopf, eine Seite
parts.append(prim('sphere', (0.33, 0.115, 0.74), (0.06, 0.04, 0.05), rot=(0.5, 0, 0), color=DARK, seg=16))

for s in (1, -1):
    # Augen: groß, mit Glanzpunkt
    parts.append(prim('sphere', (0.465, s * 0.085, 0.71), (0.034, 0.034, 0.04), color=DARK))
    parts.append(prim('sphere', (0.49, s * 0.1, 0.725), (0.012, 0.012, 0.012), color='#ffffff', seg=8))
    # Hörner
    parts.append(prim('cone', (0.33, s * 0.095, 0.84), (0.034, 0.034, 0.11), rot=(-s * 0.5, 0, 0), color=HORN, seg=10))
    # Ohren: flach, seitlich abstehend, innen rosa
    parts.append(prim('sphere', (0.31, s * 0.19, 0.74), (0.04, 0.085, 0.024), rot=(s * 0.4, 0, 0.15), color=W, seg=14))
    parts.append(prim('sphere', (0.318, s * 0.2, 0.745), (0.022, 0.06, 0.012), rot=(s * 0.4, 0, 0.15), color=PINK, seg=10))
# Schwanz mit Quaste
parts.append(prim('cyl', (-0.36, 0.0, 0.45), (0.016, 0.016, 0.27), rot=(0, 0.4, 0), color=W, seg=8))
parts.append(prim('sphere', (-0.41, 0.0, 0.32), (0.035, 0.035, 0.055), color=DARK, seg=12))

cow = join(parts, 'kuh')
here = os.path.dirname(__file__)
export_sigm(cow, os.path.join(here, '..', '..', 'models', 'kuh.sigm'))
if len(sys.argv) > 1:
    render_preview(cow, sys.argv[1])
