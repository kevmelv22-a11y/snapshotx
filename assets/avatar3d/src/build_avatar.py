"""
Snapshot X 3D avatar builder (Blender 4.2, headless):
  blender -b -P assets/avatar3d/src/build_avatar.py -- --out assets/avatar3d/avatar.glb [--render out.png --look hoodie]
Builds a stylized, soft 3D character procedurally (no third-party assets): armature + modular meshes
(body, hair styles, clothing modules, expression variants), each parented to a bone so poses are bone rotations.
Every module is a separately named node so the app toggles visibility and recolours materials by name.
Original work of the Snapshot X project (no external assets).
"""
import bpy, bmesh, math, sys, random
from mathutils import Vector, Matrix, Euler

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
def arg(name, default=None):
    return argv[argv.index(name) + 1] if name in argv else default
OUT = arg('--out', 'avatar.glb'); RENDER = arg('--render'); LOOK = arg('--look', 'hoodie'); HAIR = arg('--hair', 'curly')
POSE = arg('--pose', 'stand'); SAMPLES = int(arg('--samples', '48'))

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
random.seed(7)

# ---------------------------------------------------------------- materials
MATS = {}
def mat(name, color, rough=0.6, sss=0.0, sheen=0.0, spec=0.5, coat=0.0):
    m = bpy.data.materials.new(name); m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    c = tuple(int(color[i:i + 2], 16) / 255 for i in (1, 3, 5))
    b.inputs['Base Color'].default_value = (*[x ** 2.2 for x in c], 1)
    b.inputs['Roughness'].default_value = rough
    b.inputs['Specular IOR Level'].default_value = spec
    if sss:
        b.inputs['Subsurface Weight'].default_value = sss
        b.inputs['Subsurface Radius'].default_value = (1.0, 0.35, 0.2)
        b.inputs['Subsurface Scale'].default_value = 0.03
    if sheen: b.inputs['Sheen Weight'].default_value = sheen
    if coat: b.inputs['Coat Weight'].default_value = coat
    MATS[name] = m
    return m
mat('Skin', '#D99A72', 0.5, sss=0.25, spec=0.35)
mat('Lip', '#B8665A', 0.45, sss=0.2)
mat('Mouth', '#5A2422', 0.6)
mat('Teeth', '#F4F1EA', 0.35)
mat('EyeWhite', '#F7F5F2', 0.15, coat=1.0)
mat('Iris', '#5A3A22', 0.2, coat=1.0)
mat('Pupil', '#0B0908', 0.1, coat=1.0)
mat('Highlight', '#FFFFFF', 0.1)
mat('Lash', '#1A1210', 0.6)
mat('Hair', '#3A2418', 0.55, sheen=0.3, spec=0.6)
mat('Brow', '#2A1A12', 0.7)
mat('Top', '#F5F5F7', 0.85, sheen=0.4, spec=0.25)
mat('Outer', '#1B1B1E', 0.88, sheen=0.5, spec=0.25)
mat('OuterTrim', '#2A2A2E', 0.8, sheen=0.3, spec=0.25)
mat('String', '#E8E8EA', 0.7)
mat('Bottom', '#6E7178', 0.8, sheen=0.2, spec=0.25)
mat('BottomSeam', '#8D9096', 0.8)
mat('Shoe', '#F4F4F6', 0.55)
mat('ShoeAccent', '#1C1C1E', 0.5)
mat('Sole', '#F7F7F7', 0.6)

def smooth(obj):
    for p in obj.data.polygons: p.use_smooth = True

def link(obj):
    if obj.name not in scene.collection.objects: scene.collection.objects.link(obj)
    return obj

def mesh_from_bm(name, bm, material):
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    ob = bpy.data.objects.new(name, me); link(ob)
    me.materials.append(MATS[material]); smooth(ob)
    return ob

def sphere(name, loc, scale, material, seg=32, rings=16, rot=(0, 0, 0)):
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=seg, v_segments=rings, radius=1.0)
    bmesh.ops.transform(bm, matrix=Matrix.Translation(loc) @ Euler(rot).to_matrix().to_4x4() @ Matrix.Diagonal((*scale, 1)), verts=bm.verts)
    return mesh_from_bm(name, bm, material)

def subsurf(ob, levels=2):
    m = ob.modifiers.new('sub', 'SUBSURF'); m.levels = levels; m.render_levels = levels
    return ob

def solidify(ob, t=0.01):
    m = ob.modifiers.new('sol', 'SOLIDIFY'); m.thickness = t; m.offset = 1.0
    return ob

def tube(name, p0, p1, profile, material, seg=20, flat=1.0, gap=None, caps=False, front_axis=None):
    """Lathe-like tube from p0 to p1. profile: [(t, r), ...]; flat scales the depth axis; gap=(centerAngle, halfWidth) radians skips faces (open front)."""
    p0, p1 = Vector(p0), Vector(p1)
    axis = (p1 - p0); L = axis.length; axis.normalize()
    ref = Vector((0, -1, 0)) if front_axis is None else Vector(front_axis)
    x = ref.cross(axis); x = Vector((1, 0, 0)) if x.length < 1e-4 else x.normalized()
    yv = axis.cross(x).normalized()  # roughly front(-Y) or back
    bm = bmesh.new(); rings = []
    for t, r in profile:
        ring = []
        for i in range(seg):
            a = 2 * math.pi * i / seg
            off = x * (math.cos(a) * r) + yv * (math.sin(a) * r * flat)
            ring.append(bm.verts.new(p0 + axis * (t * L) + off))
        rings.append(ring)
    def skip(i):
        if not gap: return False
        a = 2 * math.pi * (i + 0.5) / seg
        d = math.atan2(math.sin(a - gap[0]), math.cos(a - gap[0]))
        return abs(d) < gap[1]
    for k in range(len(rings) - 1):
        for i in range(seg):
            if skip(i): continue
            j = (i + 1) % seg
            bm.faces.new((rings[k][i], rings[k][j], rings[k + 1][j], rings[k + 1][i]))
    if caps:
        bm.faces.new(list(reversed(rings[0]))); bm.faces.new(rings[-1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return mesh_from_bm(name, bm, material)

def meta(name, elems, material, res=0.012):
    mb = bpy.data.metaballs.new(name + 'MB'); mb.resolution = res; mb.render_resolution = res; mb.threshold = 0.6
    for e in elems:
        el = mb.elements.new(); el.type = e.get('type', 'ELLIPSOID'); el.co = e['co']; el.radius = e.get('r', 1.0)
        s = e.get('s', (1, 1, 1)); el.size_x, el.size_y, el.size_z = s
        el.stiffness = e.get('stiff', 2.0)
        if 'rot' in e: el.rotation = Euler(e['rot']).to_quaternion()
        if e.get('neg'): el.use_negative = True
    tmp = bpy.data.objects.new(name + 'Tmp', mb); link(tmp)
    bpy.context.view_layer.update()
    dg = bpy.context.evaluated_depsgraph_get()
    me = bpy.data.meshes.new_from_object(tmp.evaluated_get(dg))
    bpy.data.objects.remove(tmp); bpy.data.metaballs.remove(mb)
    ob = bpy.data.objects.new(name, me); link(ob)
    me.materials.clear(); me.materials.append(MATS[material]); smooth(ob)
    return ob

def curve_tube(name, pts, radius, material, taper=None):
    cu = bpy.data.curves.new(name + 'C', 'CURVE'); cu.dimensions = '3D'; cu.bevel_depth = radius; cu.bevel_resolution = 4; cu.resolution_u = 12
    sp = cu.splines.new('BEZIER'); sp.bezier_points.add(len(pts) - 1)
    for bp, p in zip(sp.bezier_points, pts):
        bp.co = p; bp.handle_left_type = bp.handle_right_type = 'AUTO'
    if taper:
        for bp, r in zip(sp.bezier_points, taper): bp.radius = r
    cu.use_fill_caps = True
    tmp = bpy.data.objects.new(name + 'Tmp', cu); link(tmp)
    bpy.context.view_layer.update(); dg = bpy.context.evaluated_depsgraph_get()
    me = bpy.data.meshes.new_from_object(tmp.evaluated_get(dg)); bpy.data.objects.remove(tmp)
    ob = bpy.data.objects.new(name, me); link(ob); me.materials.clear(); me.materials.append(MATS[material]); smooth(ob)
    return ob

# ---------------------------------------------------------------- skeleton (Z up, character faces -Y)
J = {
    'hips': (0, 0, 0.92), 'spine': (0, 0, 1.10), 'chest': (0, 0, 1.30), 'neck': (0, 0, 1.38), 'head': (0, 0, 1.46), 'headTop': (0, 0, 1.86),
}
for s, sx in (('L', 1), ('R', -1)):
    J['shoulder' + s] = (0.19 * sx, 0, 1.29); J['elbow' + s] = (0.265 * sx, 0.015, 1.05); J['wrist' + s] = (0.30 * sx, -0.005, 0.83); J['handEnd' + s] = (0.31 * sx, -0.015, 0.72)
    J['hip' + s] = (0.095 * sx, 0, 0.90); J['knee' + s] = (0.10 * sx, -0.005, 0.50); J['ankle' + s] = (0.105 * sx, 0.01, 0.10); J['toe' + s] = (0.11 * sx, -0.14, 0.03)
BONES = [('root', (0, 0, 0), (0, 0, 0.3), None), ('hips', J['hips'], J['spine'], 'root'), ('spine', J['spine'], J['chest'], 'hips'),
         ('chest', J['chest'], J['neck'], 'spine'), ('neck', J['neck'], J['head'], 'chest'), ('head', J['head'], J['headTop'], 'neck')]
for s in 'LR':
    BONES += [('upperArm' + s, J['shoulder' + s], J['elbow' + s], 'chest'), ('forearm' + s, J['elbow' + s], J['wrist' + s], 'upperArm' + s),
              ('hand' + s, J['wrist' + s], J['handEnd' + s], 'forearm' + s), ('thigh' + s, J['hip' + s], J['knee' + s], 'hips'),
              ('shin' + s, J['knee' + s], J['ankle' + s], 'thigh' + s), ('foot' + s, J['ankle' + s], J['toe' + s], 'shin' + s)]
arm_data = bpy.data.armatures.new('Rig'); rig = bpy.data.objects.new('Rig', arm_data); link(rig)
bpy.context.view_layer.objects.active = rig; bpy.ops.object.mode_set(mode='EDIT')
for n, h, t, p in BONES:
    b = arm_data.edit_bones.new(n); b.head = h; b.tail = t; b.roll = 0
    if p: b.parent = arm_data.edit_bones[p]
bpy.ops.object.mode_set(mode='OBJECT')

SEGS = {n: (Vector(h), Vector(t)) for n, h, t, p in BONES}
def _armature(ob):
    ob.parent = rig
    if not any(m.type == 'ARMATURE' for m in ob.modifiers):
        m = ob.modifiers.new('rig', 'ARMATURE'); m.object = rig
    # keep the armature modifier last so solidify/subsurf are evaluated before deformation
    while ob.modifiers[-1].type != 'ARMATURE':
        bpy.context.view_layer.objects.active = ob
        with bpy.context.temp_override(object=ob, active_object=ob): bpy.ops.object.modifier_move_down(modifier='rig')

def bind(ob, bone):
    """Rigid skin: every vertex fully weighted to one bone."""
    g = ob.vertex_groups.new(name=bone); g.add(list(range(len(ob.data.vertices))), 1.0, 'REPLACE')
    _armature(ob); return ob

def _seg_dist(p, a, b):
    ab = b - a; t = max(0.0, min(1.0, (p - a).dot(ab) / max(ab.length_squared, 1e-9)))
    return (p - (a + ab * t)).length

def soft(ob, bones, power=6.0):
    """Smooth skin: weights from distance to the candidate bone segments (smooth sleeves / legs / torso)."""
    groups = {b: ob.vertex_groups.new(name=b) for b in bones}
    for v in ob.data.vertices:
        ws = {b: 1.0 / (_seg_dist(v.co, *SEGS[b]) + 0.012) ** power for b in bones}
        tot = sum(ws.values())
        for b, w in ws.items():
            if w / tot > 0.01: groups[b].add([v.index], w / tot, 'REPLACE')
    _armature(ob); return ob

def tube_path(name, pts, radii, material, seg=22, flat=1.0, front=(0, -1, 0), sub=5):
    """Smooth tube through control points (Catmull-Rom), radius per control point."""
    P = [Vector(p) for p in pts]; R = list(radii)
    ext = [P[0] * 2 - P[1]] + P + [P[-1] * 2 - P[-2]]
    dense, dr = [], []
    for i in range(len(P) - 1):
        p0, p1, p2, p3 = ext[i], ext[i + 1], ext[i + 2], ext[i + 3]
        for k in range(sub):
            t = k / sub; t2, t3 = t * t, t * t * t
            dense.append(0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3))
            dr.append(R[i] + (R[i + 1] - R[i]) * (3 * t2 - 2 * t3))
    dense.append(P[-1]); dr.append(R[-1])
    bm = bmesh.new(); rings = []; F = Vector(front)
    for i, c in enumerate(dense):
        tg = (dense[min(i + 1, len(dense) - 1)] - dense[max(i - 1, 0)]).normalized()
        x = F.cross(tg); x = Vector((1, 0, 0)) if x.length < 1e-4 else x.normalized(); y = tg.cross(x).normalized()
        rings.append([bm.verts.new(c + x * (math.cos(2 * math.pi * j / seg) * dr[i]) + y * (math.sin(2 * math.pi * j / seg) * dr[i] * flat)) for j in range(seg)])
    for k in range(len(rings) - 1):
        for j in range(seg):
            bm.faces.new((rings[k][j], rings[k][(j + 1) % seg], rings[k + 1][(j + 1) % seg], rings[k + 1][j]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return mesh_from_bm(name, bm, material)

def V(*a): return Vector(a)
HC = V(0, -0.005, 1.63)  # head centre (before head scaling)
HS = 1.42                 # stylised big head: every head-bound module is scaled around HC
HEAD_OBJS = []
def hbind(ob):
    HEAD_OBJS.append(ob); return ob

# ---------------------------------------------------------------- head & face
head = meta('Head', [
    {'co': HC + V(0, 0, 0.02), 's': (0.172, 0.175, 0.178), 'r': 1.0},          # cranium
    {'co': HC + V(0, -0.035, -0.055), 's': (0.155, 0.14, 0.105), 'r': 1.0},      # cheeks / jaw
    {'co': HC + V(0, -0.07, -0.104), 's': (0.088, 0.07, 0.046), 'r': 1.0},      # chin
    {'co': HC + V(0, -0.162, -0.042), 's': (0.026, 0.026, 0.025), 'r': 1.0, 'stiff': 3},  # nose
    {'co': HC + V(0, -0.158, -0.012), 's': (0.014, 0.02, 0.032), 'r': 1.0, 'stiff': 2},  # nose bridge
    {'co': HC + V(0.145, 0.012, -0.022), 's': (0.02, 0.028, 0.038), 'r': 1.0, 'stiff': 3},  # ears
    {'co': HC + V(-0.145, 0.012, -0.022), 's': (0.02, 0.028, 0.038), 'r': 1.0, 'stiff': 3},
    # eye sockets (negative) give the brow ridge / cheek shape
    {'co': HC + V(0.068, -0.19, 0.012), 's': (0.042, 0.03, 0.035), 'r': 1.0, 'neg': True, 'stiff': 1.0},
    {'co': HC + V(-0.068, -0.19, 0.012), 's': (0.042, 0.03, 0.035), 'r': 1.0, 'neg': True, 'stiff': 1.0},
], 'Skin', 0.008)
hbind(head)

EY = HC + V(0, -0.128, -0.004)
for s, sx in (('L', 1), ('R', -1)):
    c = EY + V(0.07 * sx, 0, 0)
    hbind(sphere('EyeWhite' + s, c, (0.034, 0.028, 0.034), 'EyeWhite'))
    lb = bmesh.new(); bmesh.ops.create_uvsphere(lb, u_segments=28, v_segments=16, radius=1)
    bmesh.ops.delete(lb, geom=[v for v in lb.verts if v.co.z < 0.46 or (v.co.y > 0.55)], context='VERTS')
    bmesh.ops.transform(lb, matrix=Matrix.Translation(c + V(0, -0.002, 0)) @ Euler((math.radians(-9), 0, 0)).to_matrix().to_4x4() @ Matrix.Diagonal((0.0375, 0.032, 0.0375, 1)), verts=lb.verts)
    lu = mesh_from_bm('LidUpper' + s, lb, 'Skin'); solidify(lu, 0.003); hbind(lu)
    
    hbind(sphere('Iris' + s, c + V(0, -0.018, -0.003), (0.024, 0.012, 0.026), 'Iris'))
    hbind(sphere('Pupil' + s, c + V(0, -0.027, -0.003), (0.012, 0.005, 0.013), 'Pupil'))
    hbind(sphere('Glint' + s, c + V(0.008 * sx - 0.004, -0.03, 0.01), (0.006, 0.003, 0.006), 'Highlight', 12, 8))
    # upper lid / lash line arching over the eye
    lash = curve_tube('Lash' + s, [c + V(-0.038 * sx, -0.012, 0.01), c + V(-0.013 * sx, -0.029, 0.018), c + V(0.018 * sx, -0.028, 0.018), c + V(0.042 * sx, -0.01, 0.012)], 0.0042, 'Lash', taper=[0.5, 1.0, 1.0, 0.6])
    hbind(lash)
    # closed lid (wink) variant: skin cap over the eye
    lid = sphere('LidClosed' + s, c + V(0, -0.004, 0.0), (0.047, 0.037, 0.05), 'Skin'); hbind(lid)
    lidl = curve_tube('LidLine' + s, [c + V(-0.042 * sx, -0.03, -0.0), c + V(0, -0.044, -0.012), c + V(0.042 * sx, -0.03, -0.0)], 0.004, 'Lash'); hbind(lidl)
    brow = curve_tube('Brow' + s, [EY + V(0.03 * sx, -0.042, 0.072), EY + V(0.07 * sx, -0.045, 0.085), EY + V(0.108 * sx, -0.025, 0.07)], 0.0105, 'Brow', taper=[1.0, 1.0, 0.55])
    hbind(brow)

M0 = HC + V(0, -0.158, -0.088)
# smile (closed, soft)
hbind(curve_tube('MouthSmile', [M0 + V(-0.036, 0.012, 0.01), M0 + V(0, -0.004, -0.006), M0 + V(0.036, 0.012, 0.01)], 0.006, 'Lip', taper=[0.6, 1, 0.6]))
hbind(curve_tube('MouthNeutral', [M0 + V(-0.03, 0.006, 0.0), M0 + V(0, -0.002, -0.002), M0 + V(0.03, 0.006, 0.0)], 0.005, 'Lip', taper=[0.6, 1, 0.6]))
# laugh (open): dark mouth + teeth strip
om = sphere('MouthLaugh', M0 + V(0, 0.0, -0.006), (0.045, 0.02, 0.026), 'Mouth', rot=(0, 0, 0)); hbind(om)
hbind(sphere('MouthLaughTeeth', M0 + V(0, -0.006, 0.006), (0.036, 0.014, 0.01), 'Teeth'))
hbind(sphere('MouthSurprised', M0 + V(0, 0.0, -0.01), (0.02, 0.016, 0.026), 'Mouth'))

# ---------------------------------------------------------------- hair modules
def scalp_dir(theta, phi):
    return V(math.sin(phi) * math.cos(theta), math.sin(phi) * math.sin(theta), math.cos(phi))

def curls(name, count, rmin, rmax, extent, offset, puff=1.0, front_cut=0.32, seed=3, back_low=0.0):
    """Ringlet hair: many short helices growing out of the scalp + a dark under-cap, merged into one mesh."""
    rnd = random.Random(seed)
    golden = math.pi * (3 - math.sqrt(5)); pts = []
    for i in range(int(count * 2.6)):
        z = 1 - (i + 0.5) / (count * 2.6) * 2; r = math.sqrt(1 - z * z); th = golden * i
        d = V(r * math.cos(th), r * math.sin(th), z)
        if d.z < extent: continue
        front = -d.y
        if front > 0.25 and d.z < front_cut + rnd.uniform(-0.05, 0.06): continue
        if d.z < extent + 0.3 and abs(d.x) > 0.75 and d.y < 0.15: continue  # ears clear
        pts.append(d)
    pts = pts[::max(1, len(pts) // count)]
    cu = bpy.data.curves.new(name + 'C', 'CURVE'); cu.dimensions = '3D'; cu.bevel_depth = 1.0; cu.bevel_resolution = 1; cu.use_fill_caps = True
    for d in pts:
        rad = rnd.uniform(rmin, rmax)
        base = HC + V(0, 0.01, 0.03) + V(d.x * 0.168 * puff, d.y * 0.178 * puff, d.z * 0.19 * puff) + d * offset
        axis = (d * 0.55 + V(0, 0, -0.45) + V(rnd.uniform(-.35, .35), rnd.uniform(-.35, .35), rnd.uniform(-.2, .2))).normalized()
        if -d.y > 0.3: axis = (axis + V(0, -0.2, -0.9)).normalized()  # fringe curls fall onto the forehead
        x = axis.cross(V(0.3, 0.2, 1)).normalized(); y = axis.cross(x)
        turns = rnd.uniform(1.4, 2.1); n = int(turns * 8); ph = rnd.random() * 6.28
        sp = cu.splines.new('POLY'); sp.points.add(n - 1)
        for k in range(n):
            t = k / (n - 1); a = ph + t * turns * 2 * math.pi
            rr = rad * (0.8 - 0.2 * t)
            c = base + x * (math.cos(a) * rr) + y * (math.sin(a) * rr) + axis * (t * rad * 2.6)
            sp.points[k].co = (*c, 1); sp.points[k].radius = rad * (0.92 - 0.6 * t)
    tmp = bpy.data.objects.new(name + 'Tmp', cu); link(tmp)
    bpy.context.view_layer.update(); dg = bpy.context.evaluated_depsgraph_get()
    me = bpy.data.meshes.new_from_object(tmp.evaluated_get(dg)); bpy.data.objects.remove(tmp)
    ob = bpy.data.objects.new(name, me); link(ob); me.materials.clear(); me.materials.append(MATS['Hair']); smooth(ob)
    # under-cap so no scalp shows between the curls
    capob = cap(name + 'Cap', extent + 0.12, 0.012 + offset * 0.6, front_cut + 0.08, back_drop=0.3, seed=seed)
    capob.modifiers.clear()
    bm = bmesh.new(); bm.from_mesh(me); bm.from_mesh(capob.data); bm.to_mesh(me); bm.free()
    bpy.data.objects.remove(capob)
    return ob

def cap(name, top_extent, thick, front_line, material='Hair', back_drop=0.0, bumps=0.0, seed=1, side_drop=0.0):
    """Hair 'helmet' shell over the cranium; front_line is the fringe height (z of unit dir) on the face side."""
    rnd = random.Random(seed); bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=48, v_segments=28, radius=1.0)
    kill = []
    for v in bm.verts:
        d = v.co.copy()
        front = max(0.0, -d.y)
        limit = top_extent - back_drop * max(0, d.y) - side_drop * abs(d.x) * (1 - front)
        limit = max(limit, front_line * front ** 0.6 + limit * (1 - front ** 0.6)) if front > 0 else limit
        if d.z < limit: kill.append(v); continue
        bump = 1 + bumps * math.sin(d.x * 23 + seed) * math.sin(d.y * 19) * math.sin(d.z * 17 + seed)
        v.co = HC + V(0, 0.008, 0.03) + V(d.x * (0.168 + thick), d.y * (0.178 + thick), d.z * (0.19 + thick)) * bump
    bmesh.ops.delete(bm, geom=kill, context='VERTS')
    ob = mesh_from_bm(name, bm, material); solidify(ob, -0.012); subsurf(ob, 1)
    return ob

hair = {}
hair['curly'] = curls('Hair_curly', 300, 0.021, 0.028, 0.0, 0.006, 0.93, front_cut=0.46, seed=3)
hair['afro'] = curls('Hair_afro', 360, 0.024, 0.032, -0.12, 0.06, 1.12, front_cut=0.52, seed=5)
hair['short'] = cap('Hair_short', 0.05, 0.016, 0.55, bumps=0.025, seed=2, back_drop=0.5)
hair['buzz'] = cap('Hair_buzz', 0.0, 0.004, 0.6, bumps=0.0, seed=4, back_drop=0.5)
w = cap('Hair_wavy', -0.15, 0.03, 0.45, bumps=0.06, seed=6, back_drop=0.6, side_drop=0.2); hair['wavy'] = w
lg = cap('Hair_long', -0.3, 0.026, 0.5, bumps=0.03, seed=8, back_drop=0.4)
# long: back curtain down to shoulders
back = tube('Hair_longBack', HC + V(0, 0.02, -0.02), HC + V(0, 0.05, -0.33), [(0, 0.17), (0.5, 0.165), (1, 0.15)], 'Hair', seg=28, flat=0.75, gap=(math.pi / 2, 1.15))
solidify(back, 0.02); subsurf(back, 2)
hair['long'] = lg
bun = cap('Hair_bun', -0.1, 0.012, 0.55, bumps=0.01, seed=9, back_drop=0.4)
bunball = sphere('Hair_bunTop', HC + V(0, 0.05, 0.24), (0.075, 0.07, 0.065), 'Hair'); bunball.modifiers.new('d', 'SUBSURF')
hair['bun'] = bun
for ob in (*hair.values(), back, bunball): hbind(ob)

HEAD_LIFT = V(0, 0, 0.0)
for ob in HEAD_OBJS:
    for v in ob.data.vertices: v.co = HC + (v.co - HC) * HS + HEAD_LIFT
    bind(ob, 'head')
neck = tube('Neck', (0, 0.01, 1.33), (0, 0.01, 1.52), [(0, 0.062), (1, 0.058)], 'Skin', seg=20, flat=0.95, caps=True); subsurf(neck, 1); soft(neck, ['chest', 'neck', 'head'])

# ---------------------------------------------------------------- hands & arm skin
for s, sx in (('L', 1), ('R', -1)):
    wr = Vector(J['wrist' + s])
    el = [{'co': wr + V(0.004 * sx, -0.004, -0.04), 's': (0.026, 0.038, 0.045), 'r': 1}]
    for k, (fx, fz) in enumerate(((-0.012, -0.095), (-0.0, -0.1), (0.012, -0.096), (0.022, -0.088))):
        el.append({'type': 'CAPSULE', 'co': wr + V((0.004 + fx * 0.6) * sx, -0.026 + k * 0.016, fz + 0.02), 's': (0.012, 1, 1), 'r': 0.0085, 'rot': (0, math.radians(90), 0)})
    el.append({'type': 'CAPSULE', 'co': wr + V(-0.006 * sx, -0.04, -0.04), 's': (0.014, 1, 1), 'r': 0.0095, 'rot': (0, math.radians(70), math.radians(-60 * sx))})
    hand = meta('Hand' + s, el, 'Skin', 0.006)
    for v in hand.data.vertices: v.co = wr + (v.co - wr) * 2.0 + V(0, 0, 0.045)
    bind(hand, 'hand' + s)
    a_, b_, c_ = Vector(J['shoulder' + s]), Vector(J['elbow' + s]), Vector(J['wrist' + s])
    arm = tube_path('ArmSkin' + s, [a_ + V(-0.03 * sx, 0, 0.0), a_, (a_ + b_) / 2, b_, (b_ + c_) / 2, c_ + (c_ - b_).normalized() * 0.03], [0.04, 0.045, 0.043, 0.037, 0.034, 0.029], 'Skin', seg=16)
    soft(arm, ['chest', 'upperArm' + s, 'forearm' + s, 'hand' + s])

# ---------------------------------------------------------------- clothing modules
TORSO = [(0.0, 0.19), (0.15, 0.188), (0.55, 0.19), (0.78, 0.195), (0.88, 0.18), (0.95, 0.14), (1.0, 0.08)]
def torso(name, z0, z1, material, puff=0.0, gap=None, flat=0.66, prof=TORSO):
    ob = tube(name, (0, 0.0, z0), (0, 0.0, z1), [(t, r + puff) for t, r in prof], material, seg=40, flat=flat, gap=gap)
    solidify(ob, 0.012); subsurf(ob, 1); return ob

def sleeve(name, s, material, length, r_up, r_lo, puff=0.0, cuff=None):
    sx = 1 if s == 'L' else -1
    a, b, c = Vector(J['shoulder' + s]), Vector(J['elbow' + s]), Vector(J['wrist' + s])
    start = a + V(-0.07 * sx, 0, 0.035)
    if length > 0.5:
        end = b + (c - b) * min(1.0, (length - 0.5) * 2)
        pts = [start, a + V(0.012 * sx, 0, -0.01), (a + b) / 2, b, (b + end) / 2, end]
        rad = [r_up * 0.9, r_up + 0.008, r_up, r_lo + 0.004, r_lo * 0.97, r_lo * 0.9]
    else:
        end = a + (b - a) * 0.55
        pts = [start, a + V(0.012 * sx, 0, -0.01), end]; rad = [r_up * 0.9, r_up + 0.008, r_up * 1.02]
    pts = [p + V(0, 0, 0) for p in pts]; rad = [r + puff for r in rad]
    t = tube_path(name + 'Sleeve' + s, pts, rad, material, seg=26)
    solidify(t, 0.008); soft(t, ['chest', 'upperArm' + s, 'forearm' + s])
    parts = [t]
    if cuff and length > 0.5:
        d = (end - b).normalized()
        cf = tube_path(name + 'Cuff' + s, [end - d * 0.045, end + d * 0.006], [r_lo * 0.86 + puff, r_lo * 0.82 + puff], cuff, seg=22, sub=2)
        solidify(cf, 0.01); subsurf(cf, 1); bind(cf, 'forearm' + s); parts.append(cf)
    return parts

def group(name, objs):
    e = bpy.data.objects.new(name, None); link(e); e.location = (0, 0, 0)
    for o in objs: o['module'] = name
    return e

modules = {}
# tee (short sleeves) — also the inner layer of jackets
t = torso('Top_teeTorso', 0.84, 1.40, 'Top'); soft(t, ['hips', 'spine', 'chest'])
modules['top_tee'] = [t] + sleeve('Top_tee', 'L', 'Top', 0.4, 0.06, 0.055) + sleeve('Top_tee', 'R', 'Top', 0.4, 0.06, 0.055)
neck_rib = tube('Top_teeCollar', (0, 0.012, 1.375), (0, 0.012, 1.395), [(0, 0.072), (1, 0.07)], 'Top', seg=28, flat=0.85); solidify(neck_rib, 0.008); subsurf(neck_rib, 2); bind(neck_rib, 'chest'); modules['top_tee'].append(neck_rib)
# long sleeve variant reuses the tee torso
modules['top_long'] = sleeve('Top_long', 'L', 'Top', 1.0, 0.058, 0.05, cuff='Top') + sleeve('Top_long', 'R', 'Top', 1.0, 0.058, 0.05, cuff='Top')

# hoodie (pullover) — the reference look
HOOD_PROF = [(0.0, 0.2), (0.06, 0.207), (0.2, 0.21), (0.6, 0.208), (0.78, 0.21), (0.87, 0.195), (0.94, 0.155), (1.0, 0.09)]
h = torso('Outer_hoodieTorso', 0.80, 1.41, 'Outer', puff=0.012, prof=HOOD_PROF, flat=0.68); soft(h, ['hips', 'spine', 'chest'])
band = tube('Outer_hoodieBand', (0, 0, 0.79), (0, 0, 0.84), [(0, 0.218), (1, 0.226)], 'OuterTrim', seg=36, flat=0.7); solidify(band, 0.012); subsurf(band, 1); bind(band, 'hips')
ring = [V(math.sin(a) * 0.118, math.cos(a) * 0.1 + 0.01, 1.395 + 0.05 * max(0, math.cos(a)) ** 1.5) for a in [i * 2 * math.pi / 16 for i in range(17)]]
cu = bpy.data.curves.new('HoodC', 'CURVE'); cu.dimensions = '3D'; cu.bevel_depth = 0.036; cu.bevel_resolution = 4; cu.resolution_u = 6
sp = cu.splines.new('BEZIER'); sp.bezier_points.add(15); sp.use_cyclic_u = True
for bp, p_ in zip(sp.bezier_points, ring[:16]):
    bp.co = p_; bp.handle_left_type = bp.handle_right_type = 'AUTO'
for k, bp in enumerate(sp.bezier_points):
    bp.radius = 0.75 + 0.6 * max(0, math.cos(k * 2 * math.pi / 16))
tmp = bpy.data.objects.new('HoodTmp', cu); link(tmp); bpy.context.view_layer.update()
me = bpy.data.meshes.new_from_object(tmp.evaluated_get(bpy.context.evaluated_depsgraph_get())); bpy.data.objects.remove(tmp)
hoodrim = bpy.data.objects.new('Outer_hoodieRim', me); link(hoodrim); me.materials.append(MATS['Outer']); smooth(hoodrim); soft(hoodrim, ['chest', 'neck'])
hoodob = sphere('Outer_hoodieHood', V(0, 0.105, 1.36), (0.135, 0.075, 0.11), 'Outer', 32, 16); soft(hoodob, ['chest', 'neck'])
pocket = tube('Outer_hoodiePocket', (0, -0.13, 0.86), (0, -0.13, 1.0), [(0, 0.15), (0.6, 0.14), (1, 0.11)], 'OuterTrim', seg=36, flat=0.3, gap=(-math.pi / 2, 1.9))
solidify(pocket, 0.006); subsurf(pocket, 1); bind(pocket, 'spine')
strings = []
for sx in (1, -1):
    st = curve_tube('Outer_hoodieString' + ('L' if sx > 0 else 'R'), [V(0.035 * sx, -0.138, 1.37), V(0.04 * sx, -0.155, 1.28), V(0.042 * sx, -0.158, 1.19)], 0.0055, 'String')
    tip = sphere(st.name + 'Tip', V(0.042 * sx, -0.158, 1.185), (0.008, 0.008, 0.014), 'String', 10, 8)
    bind(st, 'chest'); bind(tip, 'chest'); strings += [st, tip]
modules['outer_hoodie'] = [h, band, hoodob, hoodrim, pocket] + strings + sleeve('Outer_hoodie', 'L', 'Outer', 1.0, 0.07, 0.06, puff=0.004, cuff='OuterTrim') + sleeve('Outer_hoodie', 'R', 'Outer', 1.0, 0.07, 0.06, puff=0.004, cuff='OuterTrim')

# open jacket (overshirt / coach / denim / work jacket)
JK = [(0.0, 0.205), (0.15, 0.206), (0.6, 0.21), (0.78, 0.212), (0.87, 0.197), (0.94, 0.157), (1.0, 0.095)]
jk = torso('Outer_jacketTorso', 0.79, 1.41, 'Outer', puff=0.016, gap=(math.pi / 2, 0.36), prof=JK, flat=0.7); soft(jk, ['hips', 'spine', 'chest'])
collar = []
for sx in (1, -1):
    c = curve_tube('Outer_jacketCollar' + ('L' if sx > 0 else 'R'), [V(0.02 * sx, 0.07, 1.43), V(0.09 * sx, 0.0, 1.42), V(0.085 * sx, -0.11, 1.36), V(0.055 * sx, -0.155, 1.24)], 0.02, 'Outer', taper=[0.8, 1.2, 1.1, 0.4])
    pk = sphere('Outer_jacketPocket' + ('L' if sx > 0 else 'R'), V(0.12 * sx, -0.148, 1.17), (0.052, 0.012, 0.045), 'OuterTrim', 20, 10)
    bind(c, 'chest'); bind(pk, 'chest'); collar += [c, pk]
backcol = tube('Outer_jacketCollarBack', (0, 0.03, 1.39), (0, 0.035, 1.44), [(0, 0.1), (1, 0.095)], 'Outer', seg=28, flat=0.9, gap=(math.pi / 2, 0.9)); solidify(backcol, 0.01); subsurf(backcol, 2); bind(backcol, 'chest')
modules['outer_jacket'] = [jk, backcol] + collar + sleeve('Outer_jacket', 'L', 'Outer', 1.0, 0.072, 0.062, puff=0.006, cuff='OuterTrim') + sleeve('Outer_jacket', 'R', 'Outer', 1.0, 0.072, 0.062, puff=0.006, cuff='OuterTrim')

# trousers: straight/baggy (jeans, cargo) and tapered joggers
def legs(prefix, r_th, r_kn, r_an, cuff=None, length=1.0):
    parts = []
    pel = tube(prefix + 'Pelvis', (0, 0, 0.78), (0, 0, 0.98), [(0, 0.19), (0.4, 0.2), (0.75, 0.205), (1, 0.2)], 'Bottom', seg=36, flat=0.7)
    solidify(pel, 0.01); subsurf(pel, 1); soft(pel, ['hips', 'thighL', 'thighR']); parts.append(pel)
    for s in 'LR':
        sx = 1 if s == 'L' else -1
        a, k, an = Vector(J['hip' + s]), Vector(J['knee' + s]), Vector(J['ankle' + s])
        endp = an + V(0, 0, 0.03 if cuff else 0.012)
        pts = [a + V(-0.02 * sx, 0, 0.07), a + V(0.006 * sx, 0, -0.08), (a + k) / 2, k, (k + an) / 2, endp]
        rad = [r_th, r_th + 0.004, (r_th + r_kn) / 2 + 0.004, r_kn, (r_kn + r_an) / 2, r_an * (0.85 if cuff else 1.06)]
        lg = tube_path(prefix + 'Leg' + s, pts, rad, 'Bottom', seg=28, flat=0.95)
        solidify(lg, 0.01); soft(lg, ['hips', 'thigh' + s, 'shin' + s]); parts.append(lg)
        if cuff:
            cf = tube_path(prefix + 'Cuff' + s, [endp + V(0, 0, 0.05), endp + V(0, 0, -0.004)], [r_an * 0.9, r_an * 0.86], 'BottomSeam', seg=24, sub=2)
            solidify(cf, 0.01); subsurf(cf, 1); bind(cf, 'shin' + s); parts.append(cf)
        else:
            hem = tube_path(prefix + 'Hem' + s, [endp + V(0, 0, 0.03), endp + V(0, 0, -0.002)], [r_an * 1.06 + 0.002, r_an * 1.08 + 0.002], 'BottomSeam', seg=24, sub=2)
            solidify(hem, 0.006); subsurf(hem, 1); bind(hem, 'shin' + s); parts.append(hem)
    return parts
modules['bottom_straight'] = legs('Bottom_straight', 0.102, 0.094, 0.092)
modules['bottom_joggers'] = legs('Bottom_joggers', 0.1, 0.082, 0.06, cuff=True)

def sneakers(prefix):
    """Low-top sneaker: thick cupsole, rounded upper, heel counter + toe cap overlays (accent colour). No logos."""
    parts = []
    for s, sx in (('L', 1), ('R', -1)):
        an = Vector(J['ankle' + s]); F = V(an.x, an.y - 0.04, 0.0)
        so = tube(prefix + 'Sole' + s, F + V(0, 0.135, 0.024), F + V(0, -0.175, 0.024),
                  [(0, 0.0), (0.03, 0.04), (0.1, 0.058), (0.5, 0.064), (0.85, 0.062), (0.95, 0.045), (1, 0.0)], 'Sole', seg=28, flat=0.36, front_axis=(0, 0, 1))
        subsurf(so, 1)
        def blobs(name, els, material):
            bm = bmesh.new()
            for co, sc in els:
                t = bmesh.new(); bmesh.ops.create_uvsphere(t, u_segments=28, v_segments=16, radius=1)
                bmesh.ops.transform(t, matrix=Matrix.Translation(F + V(*co)) @ Matrix.Diagonal((*sc, 1)), verts=t.verts)
                me = bpy.data.meshes.new('t'); t.to_mesh(me); t.free(); bm.from_mesh(me); bpy.data.meshes.remove(me)
            return mesh_from_bm(name, bm, material)
        up = blobs(prefix + 'Upper' + s, [((0, 0.06, 0.085), (0.056, 0.075, 0.06)), ((0, -0.03, 0.068), (0.06, 0.1, 0.046)), ((0, -0.11, 0.05), (0.057, 0.075, 0.032))], 'Shoe')
        acc = blobs(prefix + 'Accent' + s, [((0, 0.085, 0.07), (0.059, 0.055, 0.045)), ((0, -0.14, 0.04), (0.058, 0.045, 0.024)), ((0, 0.05, 0.125), (0.052, 0.045, 0.022))], 'ShoeAccent')
        lace = curve_tube(prefix + 'Tongue' + s, [F + V(0, -0.085, 0.09), F + V(0, -0.03, 0.112), F + V(0, 0.02, 0.135)], 0.028, 'Shoe', taper=[0.7, 1, 1])
        for o in (up, so, acc, lace):
            for v in o.data.vertices: v.co = F + (v.co - F) * 1.22
            bind(o, 'shin' + s)
        parts += [up, so, acc, lace]
    return parts
modules['shoes_sneaker'] = sneakers('Shoes_sneaker')

for ob in bpy.data.objects:
    if ob.type == 'MESH':
        ob['modstate'] = 1

# ---------------------------------------------------------------- export glTF
bpy.context.view_layer.update()
bpy.ops.export_scene.gltf(filepath=OUT, export_format='GLB', export_apply=True, export_yup=True, export_skins=True,
                          export_animations=False, use_selection=False, export_extras=True, export_materials='EXPORT')
print('EXPORTED', OUT)

# ---------------------------------------------------------------- optional Cycles preview render
if RENDER:
    visible = {'Head', 'HandL', 'HandR', 'MouthSmile'}
    show_prefix = ['EyeWhite', 'Iris', 'Pupil', 'Glint', 'Lash', 'Brow', 'ArmSkin', 'ElbowSkin', 'Hair_' + HAIR]
    looks = {'hoodie': ['outer_hoodie', 'bottom_straight', 'shoes_sneaker'], 'jacket': ['top_tee', 'outer_jacket', 'bottom_straight', 'shoes_sneaker']}
    mods = looks.get(LOOK, looks['hoodie'])
    keep = set()
    for m in mods: keep |= {o.name for o in modules[m]}
    for ob in bpy.data.objects:
        if ob.type != 'MESH': continue
        on = ob.name in visible or ob.name in keep or any(ob.name.startswith(p) and not ob.name.startswith('Hair_longBack') for p in show_prefix)
        if HAIR == 'long' and ob.name == 'Hair_longBack': on = True
        if HAIR == 'bun' and ob.name == 'Hair_bunTop': on = True
        ob.hide_render = not on
    MATS['Bottom'].node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = (0.12, 0.125, 0.135, 1)
    # simple pose: right hand to chin in 'think'
    pb = rig.pose.bones
    if POSE == 'think':
        pb['upperArmR'].rotation_mode = 'XYZ'; pb['upperArmR'].rotation_euler = (math.radians(-60), 0, math.radians(-10))
        pb['forearmR'].rotation_mode = 'XYZ'; pb['forearmR'].rotation_euler = (math.radians(-125), 0, 0)
    scene.render.engine = 'CYCLES'; scene.cycles.samples = SAMPLES; scene.cycles.use_denoising = True; scene.cycles.device = 'CPU'
    scene.render.resolution_x = 720; scene.render.resolution_y = 1000
    scene.view_settings.view_transform = 'Standard'; scene.render.film_transparent = True
    world = bpy.data.worlds.new('W'); scene.world = world; world.use_nodes = True
    world.node_tree.nodes['Background'].inputs['Color'].default_value = (1.0, 0.85, 0.3, 1); world.node_tree.nodes['Background'].inputs['Strength'].default_value = 0.35
    cam = bpy.data.objects.new('Cam', bpy.data.cameras.new('Cam')); link(cam); scene.camera = cam
    focus = float(arg('--focus', '0.97')); dist = float(arg('--dist', '6.6'))
    cam.data.lens = 85; cam.location = (0.35, -dist, focus + 0.2); 
    d = Vector((0, 0, focus)) - cam.location; cam.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
    def area(name, loc, energy, size, color=(1, 1, 1)):
        l = bpy.data.objects.new(name, bpy.data.lights.new(name, 'AREA')); link(l); l.location = loc; l.data.energy = energy; l.data.size = size; l.data.color = color
        dd = Vector((0, 0, 1.2)) - Vector(loc); l.rotation_euler = dd.to_track_quat('-Z', 'Y').to_euler()
    area('Key', (-1.8, -2.6, 2.8), 300, 2.5, (1, 0.97, 0.93)); area('Fill', (2.2, -2.2, 1.4), 110, 3.0, (1, 0.96, 0.88)); area('Rim', (0.9, 2.4, 2.6), 220, 1.5, (1, 0.93, 0.75))
    # yellow floor catching a soft shadow
    bpy.ops.mesh.primitive_plane_add(size=20); fl = bpy.context.active_object; m = bpy.data.materials.new('Floor'); m.use_nodes = True
    m.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = (1.0, 0.72, 0.0, 1); m.node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value = 0.9; fl.data.materials.append(m); fl.is_shadow_catcher = True
    scene.render.filepath = RENDER; bpy.ops.render.render(write_still=True); print('RENDERED', RENDER)
