# Gemeinsame Helfer für die Blender-Skripte (ohne Oberfläche: python3 tools/blender/kuh.py)
# Koordinaten in Blender: x = vorne (Blickrichtung des Tiers), y = Seite, z = oben.
# Export im eigenen kleinen Format (.sigm), das js/game/models.js lädt:
#   "SIGM" | uint32 Ecken | uint32 Indizes | float32 xyz | int8 Normale xyz | uint8 Farbe rgb | (Füllbyte) | uint16 Indizes
import bpy, bmesh, struct, math
from mathutils import Vector, noise

def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)

def hexcol(h):
    h = h.lstrip('#')
    return tuple(int(h[i:i + 2], 16) / 255 for i in (0, 2, 4))

def metaball(name, elements, resolution=0.018, threshold=0.6):
    """elements: dicts mit type (BALL/ELLIPSOID/CAPSULE), co, radius, size, rot (Euler)"""
    mb = bpy.data.metaballs.new(name)
    mb.resolution = resolution
    mb.render_resolution = resolution
    mb.threshold = threshold
    for e in elements:
        el = mb.elements.new(type=e.get('type', 'BALL'))
        el.co = e['co']
        el.radius = e.get('radius', 0.1)
        el.stiffness = e.get('stiffness', 2.0)
        if 'size' in e:
            el.size_x, el.size_y, el.size_z = e['size']
        if 'rot' in e:
            from mathutils import Euler
            el.rotation = Euler(e['rot']).to_quaternion()
    obj = bpy.data.objects.new(name, mb)
    bpy.context.scene.collection.objects.link(obj)
    dg = bpy.context.evaluated_depsgraph_get()
    me = bpy.data.meshes.new_from_object(obj.evaluated_get(dg))
    bpy.data.objects.remove(obj)
    out = bpy.data.objects.new(name + '_mesh', me)
    bpy.context.scene.collection.objects.link(out)
    return out

def decimate(obj, ratio):
    m = obj.modifiers.new('dec', 'DECIMATE')
    m.ratio = ratio
    apply_mods(obj)

def smooth(obj, iterations=4, factor=0.5):
    m = obj.modifiers.new('sm', 'SMOOTH')
    m.iterations = iterations
    m.factor = factor
    apply_mods(obj)

def apply_mods(obj):
    dg = bpy.context.evaluated_depsgraph_get()
    me = bpy.data.meshes.new_from_object(obj.evaluated_get(dg))
    obj.modifiers.clear()
    old = obj.data
    obj.data = me
    bpy.data.meshes.remove(old)

def prim(kind, co, scale=(1, 1, 1), rot=(0, 0, 0), color='#ffffff', seg=16, **kw):
    """Kleines Einzelteil (Auge, Horn, Ohr …) mit einer Farbe."""
    bm = bmesh.new()
    if kind == 'sphere':
        bmesh.ops.create_uvsphere(bm, u_segments=seg, v_segments=max(6, seg * 2 // 3), radius=1)
    elif kind == 'cone':
        bmesh.ops.create_cone(bm, cap_ends=True, segments=seg, radius1=1, radius2=kw.get('r2', 0), depth=1)
    elif kind == 'cyl':
        bmesh.ops.create_cone(bm, cap_ends=True, segments=seg, radius1=1, radius2=1, depth=1)
    elif kind == 'torus':
        # Ring in der xy-Ebene (Radius 1, Dicke kw['minor']), optional nur ein Bogen (kw['arc'] in Bogenmaß)
        minor = kw.get('minor', 0.25)
        arc = kw.get('arc', math.tau)
        start = kw.get('start', 0.0)
        ring = seg
        tube = 8
        verts = []
        for i in range(ring + 1):
            a = start + arc * i / ring
            row = []
            for j in range(tube):
                b = math.tau * j / tube
                r = 1 + minor * math.cos(b)
                row.append(bm.verts.new((r * math.cos(a), r * math.sin(a), minor * math.sin(b))))
            verts.append(row)
        for i in range(ring):
            for j in range(tube):
                bm.faces.new((verts[i][j], verts[i + 1][j], verts[i + 1][(j + 1) % tube], verts[i][(j + 1) % tube]))
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(kind)
    bm.to_mesh(me)
    bm.free()
    for p in me.polygons:
        p.use_smooth = True
    obj = bpy.data.objects.new(kind, me)
    bpy.context.scene.collection.objects.link(obj)
    obj.location = co
    obj.scale = scale
    from mathutils import Euler
    obj.rotation_euler = Euler(rot)
    paint(obj, lambda p, n: color)
    return obj

def paint(obj, fn):
    """fn(position, normal) → Farbe (#hex oder rgb-Tupel) je Ecke, in Weltkoordinaten."""
    me = obj.data
    if 'col' not in me.color_attributes:
        me.color_attributes.new('col', 'BYTE_COLOR', 'CORNER')
    attr = me.color_attributes['col']
    mw = obj.matrix_world
    nm = mw.to_3x3().inverted().transposed()
    for poly in me.polygons:
        for li in poly.loop_indices:
            v = me.vertices[me.loops[li].vertex_index]
            c = fn(mw @ v.co, (nm @ v.normal).normalized())
            if isinstance(c, str):
                c = hexcol(c)
            attr.data[li].color = (*c, 1)
    me.color_attributes.active_color = attr

def join(objs, name):
    for o in bpy.context.scene.objects:
        o.select_set(False)
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.join()
    obj = bpy.context.view_layer.objects.active
    obj.name = name
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    return obj

def export_sigm(obj, path):
    """Dreiecke mit eigener Normale + Farbe je Ecke; gleiche Ecken werden geteilt. Blender z-oben → Spiel y-oben."""
    me = obj.data
    me.calc_loop_triangles()
    col = me.color_attributes['col']
    normals = me.corner_normals
    verts, index, lookup = [], [], {}
    for tri in me.loop_triangles:
        for li in tri.loops:
            vi = me.loops[li].vertex_index
            p = me.vertices[vi].co
            n = normals[li].vector
            c = col.data[li].color
            key = (vi, round(n.x, 2), round(n.y, 2), round(n.z, 2), round(c[0], 2), round(c[1], 2), round(c[2], 2))
            if key not in lookup:
                lookup[key] = len(verts)
                # Spiel: x = x, y = z (oben), z = -y
                verts.append(((p.x, p.z, -p.y), (n.x, n.z, -n.y), c))
            index.append(lookup[key])
    assert len(verts) < 65536
    out = bytearray(b'SIGM')
    out += struct.pack('<II', len(verts), len(index))
    for (p, _, _) in verts:
        out += struct.pack('<3f', *p)
    for (_, n, _) in verts:
        out += struct.pack('<3b', *(max(-127, min(127, round(x * 127))) for x in n))
    for (_, _, c) in verts:
        # Blender speichert BYTE_COLOR in sRGB; three.js erwartet lineare Werte → im Loader umgerechnet
        out += struct.pack('<3B', *(max(0, min(255, round(x * 255))) for x in c[:3]))
    if len(out) % 2:
        out += b'\0'
    out += struct.pack(f'<{len(index)}H', *index)
    with open(path, 'wb') as f:
        f.write(out)
    print(f'{path}: {len(verts)} Ecken, {len(index) // 3} Dreiecke, {len(out) / 1024:.1f} KB')

def render_preview(obj, path, size=512):
    """Schnelle Vorschau (Cycles, CPU) zum Kontrollieren ohne Spiel."""
    scene = bpy.context.scene
    scene.render.engine = 'CYCLES'
    scene.cycles.samples = 24
    scene.cycles.device = 'CPU'
    scene.render.resolution_x = size
    scene.render.resolution_y = size
    scene.render.film_transparent = False
    world = bpy.data.worlds.new('w')
    world.use_nodes = True
    world.node_tree.nodes['Background'].inputs[0].default_value = (0.75, 0.85, 0.95, 1)
    world.node_tree.nodes['Background'].inputs[1].default_value = 0.8
    scene.world = world
    mat = bpy.data.materials.new('m')
    mat.use_nodes = True
    nt = mat.node_tree
    bsdf = nt.nodes['Principled BSDF']
    bsdf.inputs['Roughness'].default_value = 0.6
    attr = nt.nodes.new('ShaderNodeVertexColor')
    attr.layer_name = 'col'
    nt.links.new(attr.outputs['Color'], bsdf.inputs['Base Color'])
    obj.data.materials.clear()
    obj.data.materials.append(mat)
    sun = bpy.data.objects.new('sun', bpy.data.lights.new('sun', 'SUN'))
    sun.data.energy = 3.5
    sun.rotation_euler = (math.radians(40), math.radians(10), math.radians(30))
    scene.collection.objects.link(sun)
    cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam'))
    scene.collection.objects.link(cam)
    scene.camera = cam
    cam.location = (1.0, -1.7, 0.95)
    target = Vector((0.05, 0, 0.42))
    cam.rotation_euler = (target - cam.location).to_track_quat('-Z', 'Y').to_euler()
    cam.data.lens = 50
    scene.render.filepath = path
    bpy.ops.render.render(write_still=True)

def blob(name, shapes, voxel=0.012, smooth_iter=12, smooth_factor=0.6, ratio=0.18):
    """Weich verschmolzener Körper: Grundformen vereinen (Voxel-Remesh), Übergänge glätten, ausdünnen.
    shapes: ('sphere'|'cyl'|'cone', Mitte, Skalierung, Drehung)"""
    objs = [prim(k, co, sc, rot) for (k, co, sc, rot) in shapes]
    obj = join(objs, name)
    m = obj.modifiers.new('re', 'REMESH')
    m.mode = 'VOXEL'
    m.voxel_size = voxel
    m.use_smooth_shade = True
    apply_mods(obj)
    m = obj.modifiers.new('cs', 'LAPLACIANSMOOTH')
    m.iterations = smooth_iter
    m.lambda_factor = smooth_factor
    m.use_volume_preserve = True
    apply_mods(obj)
    decimate(obj, ratio)
    for p in obj.data.polygons:
        p.use_smooth = True
    return obj
