# Builds the Dugout Hub ballplayer in Blender from free assets and exports one GLB.
#   Body + skeleton + skin weights: MakeHuman hm08 base mesh, default skeleton and weights (CC0)
#   Kid shape: MakeHuman "caucasian-male-child" target (CC0)
#   Motion: CMU Graphics Lab Motion Capture Database, BVH conversion by Bruce Hahne (free for all uses)
#     124_07 baseball swing, 124_01 baseball pitch, 127_06 run
import bpy, json, math, sys
from mathutils import Vector, Matrix, Quaternion

MH = '/tmp/mh'; MOCAP = '/tmp/mocap'; OUT = sys.argv[-1] if sys.argv[-1].endswith('.glb') else '/tmp/build/player.glb'
bpy.ops.wm.read_factory_settings(use_empty=True)
scn = bpy.context.scene; scn.render.fps = 60

# ---------- 1. read the MakeHuman base mesh ----------
V, VT, F = [], [], []
grp = None
for line in open(MH + '/base.obj'):
    if line.startswith('v '): V.append([float(x) for x in line.split()[1:4]])
    elif line.startswith('vt '): VT.append([float(x) for x in line.split()[1:3]])
    elif line.startswith('g '): grp = line.split()[1]
    elif line.startswith('f '):
        pts = []
        for p in line.split()[1:]:
            a = p.split('/'); pts.append((int(a[0]) - 1, int(a[1]) - 1 if len(a) > 1 and a[1] else -1))
        F.append((grp, pts))
# ---------- 2. make him a kid ----------
for line in open(MH + '/caucasian-male-child.target'):
    if not line.strip() or line[0] == '#': continue
    i, dx, dy, dz = line.split(); i = int(i)
    V[i][0] += float(dx); V[i][1] += float(dy); V[i][2] += float(dz)
S = 0.1   # MakeHuman units are decimeters
cv = lambda p: Vector((p[0] * S, -p[2] * S, p[1] * S))   # y-up/+z-forward -> Blender z-up/-y-forward

# ---------- 3. skeleton ----------
skel = json.load(open(MH + '/default.mhskel'))
J = {name: sum((cv(V[i]) for i in idx), Vector()) / len(idx) for name, idx in skel['joints'].items()}
arm_data = bpy.data.armatures.new('Rig'); rig = bpy.data.objects.new('Rig', arm_data); scn.collection.objects.link(rig)
bpy.context.view_layer.objects.active = rig; bpy.ops.object.mode_set(mode='EDIT')
bones = skel['bones']
for name, b in bones.items():
    eb = arm_data.edit_bones.new(name); eb.head = J[b['head']]; eb.tail = J[b['tail']]
    if (eb.tail - eb.head).length < 1e-4: eb.tail = eb.head + Vector((0, 0, 0.01))
for name, b in bones.items():
    if b['parent']: arm_data.edit_bones[name].parent = arm_data.edit_bones[b['parent']]
bpy.ops.object.mode_set(mode='OBJECT')

# ---------- 4. mesh: body + eyes ----------
keep = {'body', 'helper-l-eye', 'helper-r-eye'}
used = sorted({i for g, pts in F if g in keep for i, _ in pts}); remap = {o: n for n, o in enumerate(used)}
me = bpy.data.meshes.new('Body'); faces = [[remap[i] for i, _ in pts] for g, pts in F if g in keep]
me.from_pydata([cv(V[i]) for i in used], [], faces); me.update()
uv = me.uv_layers.new(name='UVMap'); k = 0
for g, pts in F:
    if g not in keep: continue
    for i, t in pts:
        if t >= 0: uv.data[k].uv = VT[t]
        k += 1
fgroups = [g for g, pts in F if g in keep]
body = bpy.data.objects.new('Body', me); scn.collection.objects.link(body)
# skin weights
W = json.load(open(MH + '/default_weights.mhw'))['weights']
for bname, lst in W.items():
    vg = body.vertex_groups.new(name=bname)
    for vi, w in lst:
        if vi in remap: vg.add([remap[vi]], w, 'REPLACE')
body.parent = rig; mod = body.modifiers.new('Armature', 'ARMATURE'); mod.object = rig


import bmesh
# ---------- 5. uniform: which part of the body each face belongs to ----------
vgname = {vg.index: vg.name for vg in body.vertex_groups}
dom = {}
for v in me.vertices:
    best = max(v.groups, key=lambda g: g.weight, default=None)
    dom[v.index] = vgname[best.group] if best else None
hipz = J[bones['root']['head']].z
head_v = [v.co.copy() for v in me.vertices if dom[v.index] == 'head']
hc = sum(head_v, Vector()) / len(head_v); hr = max((p - hc).length for p in head_v)
print('hip height', round(hipz, 3), 'head centre', [round(x, 3) for x in hc], 'head radius', round(hr, 3))
sh_z0 = J[bones['upperarm01.L']['head']].z
def region(b, co):
    if b is None: return 'skin'
    if b.startswith(('foot', 'toe')): return 'shoes'
    if b.startswith('lowerleg02'): return 'socks'
    if b.startswith(('lowerleg01', 'upperleg', 'pelvis')) or b == 'root': return 'pants'
    if b.startswith(('lowerarm', 'upperarm02')): return 'sleeve'
    if b.startswith(('spine', 'clavicle', 'shoulder', 'breast', 'upperarm01')):
        return 'pants' if co.z < hipz + 0.06 else 'jersey'
    if b.startswith('neck') and co.z < sh_z0 + 0.035: return 'jersey'
    if b.startswith(('orbicularis03', 'orbicularis04')): return 'brow'
    if b.startswith('oris'): return 'lip'
    if b == 'head' and co.y > hc.y - 0.01 and co.z > hc.z - 0.085: return 'hair'
    return 'skin'
ORDER = ['skin', 'jersey', 'sleeve', 'pants', 'socks', 'shoes', 'belt', 'brow', 'lip', 'eye', 'hair']
COL = {'skin': ((0.85, 0.62, 0.48), 0.55), 'jersey': ((0.93, 0.45, 0.1), 0.85), 'sleeve': ((0.07, 0.33, 0.17), 0.8), 'pants': ((0.93, 0.92, 0.88), 0.9),
       'socks': ((0.07, 0.33, 0.17), 0.9), 'shoes': ((0.03, 0.03, 0.03), 0.35), 'belt': ((0.07, 0.33, 0.17), 0.5), 'brow': ((0.18, 0.11, 0.06), 0.9),
       'lip': ((0.72, 0.42, 0.38), 0.5), 'eye': ((1, 1, 1), 0.2), 'hair': ((0.2, 0.12, 0.06), 0.95)}
def newmat(name, rgb, rough):
    m = bpy.data.materials.new(name); m.use_nodes = True; bs = m.node_tree.nodes['Principled BSDF']
    bs.inputs['Base Color'].default_value = (*rgb, 1); bs.inputs['Roughness'].default_value = rough; return m
for n in ORDER: me.materials.append(newmat(n, *COL[n]))
MI = {n: i for i, n in enumerate(ORDER)}
for p, g in zip(me.polygons, fgroups):
    if g != 'body': p.material_index = MI['eye']; continue
    cs = [me.vertices[i].co for i in p.vertices]
    regs = [region(dom[i], me.vertices[i].co) for i in p.vertices]; r = max(set(regs), key=regs.count)
    cz = sum(c.z for c in cs) / len(cs)
    if r in ('jersey', 'pants') and hipz + 0.045 < cz < hipz + 0.095: r = 'belt'
    p.material_index = MI[r]
# smooth the cloth (no muscles or chest showing through a jersey), then sit it on top of the skin
vreg = {}
for p in me.polygons:
    for i in p.vertices: vreg.setdefault(i, set()).add(ORDER[p.material_index])
cloth = {'jersey', 'pants', 'belt', 'sleeve'}
bm = bmesh.new(); bm.from_mesh(me); bm.verts.ensure_lookup_table()
sm = [bm.verts[i] for i, rs in vreg.items() if rs <= cloth and not bm.verts[i].is_boundary]
for _ in range(8): bmesh.ops.smooth_vert(bm, verts=sm, factor=0.5, use_axis_x=True, use_axis_y=True, use_axis_z=True)
bm.to_mesh(me); bm.free(); me.update()
push = {'jersey': 0.016, 'sleeve': 0.008, 'pants': 0.012, 'socks': 0.004, 'shoes': 0.012, 'belt': 0.017, 'hair': 0.005}
for v in me.vertices:
    amt = max([push.get(r, 0) for r in vreg.get(v.index, ())] or [0])
    if amt: v.co += v.normal * amt
me.update()
for p in me.polygons: p.use_smooth = True
img = bpy.data.images.new('eye', 256, 256); px = []
for y in range(256):
    for x in range(256):
        d = math.hypot(x - 128, y - 128) / 128
        c = (0.04, 0.03, 0.02) if d < 0.18 else (0.33, 0.2, 0.1) if d < 0.42 else (0.22, 0.13, 0.06) if d < 0.46 else (0.95, 0.94, 0.92)
        px += [*c, 1]
img.pixels = px; img.pack()
em = me.materials[MI['eye']]; nt = em.node_tree; tx = nt.nodes.new('ShaderNodeTexImage'); tx.image = img; nt.links.new(tx.outputs['Color'], nt.nodes['Principled BSDF'].inputs['Base Color'])

# ---------- 5b. lettering patches: number on the back, team script on the chest (skinned copies of those faces) ----------
def patch(name, test, box, off):
    sel = [p for p in me.polygons if ORDER[p.material_index] == 'jersey' and test(p)]
    vids = sorted({i for p in sel for i in p.vertices}); rm = {o: n for n, o in enumerate(vids)}
    pm = bpy.data.meshes.new(name)
    pm.from_pydata([me.vertices[i].co + me.vertices[i].normal * off for i in vids], [], [[rm[i] for i in p.vertices] for p in sel]); pm.update()
    uvl = pm.uv_layers.new(name='UVMap'); x0, x1, z0, z1 = box
    for poly in pm.polygons:
        for li in poly.loop_indices:
            co = pm.vertices[pm.loops[li].vertex_index].co; uvl.data[li].uv = ((co.x - x0) / (x1 - x0), (co.z - z0) / (z1 - z0))
    for p in pm.polygons: p.use_smooth = True
    ob = bpy.data.objects.new(name, pm); scn.collection.objects.link(ob)
    for vg in body.vertex_groups: ob.vertex_groups.new(name=vg.name)
    for i in vids:
        for g in me.vertices[i].groups: ob.vertex_groups[g.group].add([rm[i]], g.weight, 'REPLACE')
    ob.parent = rig; md = ob.modifiers.new('Armature', 'ARMATURE'); md.object = rig
    m = newmat(name.lower(), (1, 1, 1), 0.85); pm.materials.append(m)
    print('patch', name, len(sel), 'faces'); return ob
sh_z = J[bones['upperarm01.L']['head']].z
NB = (-0.15, 0.15, hipz + 0.16, sh_z - 0.02)
patch('BackNumber', lambda p: p.normal.y > 0.35 and NB[0] < p.center.x < NB[1] and NB[2] < p.center.z < NB[3], NB, 0.003)
FS = (-0.15, 0.15, sh_z - 0.17, sh_z - 0.05)
patch('ChestScript', lambda p: p.normal.y < -0.3 and FS[0] < p.center.x < FS[1] and FS[2] < p.center.z < FS[3], FS, 0.003)

# ---------- 6. gear built from the head's own shape: batting helmet with ear flap, ball cap, catcher's mitt ----------
def shell(name, keep, off, thick, matname, rgb, rough):
    hv = [v for v in me.vertices if dom[v.index] in ('head', 'neck03') or (dom[v.index] or '').startswith(('temporalis', 'levator', 'orbicularis', 'special', 'jaw', 'risorius'))]
    ids = [v.index for v in hv if keep(v.co)]; idset = set(ids)
    faces = [p for p in me.polygons if all(i in idset for i in p.vertices) and fgroups[p.index] == 'body']
    vids = sorted({i for p in faces for i in p.vertices}); rm = {o: n for n, o in enumerate(vids)}
    gm = bpy.data.meshes.new(name)
    gm.from_pydata([hc + (me.vertices[i].co - hc) * 1.0 + me.vertices[i].normal * off for i in vids], [], [[rm[i] for i in p.vertices] for p in faces]); gm.update()
    ob = bpy.data.objects.new(name, gm); scn.collection.objects.link(ob)
    bm = bmesh.new(); bm.from_mesh(gm)
    for _ in range(6): bmesh.ops.smooth_vert(bm, verts=[v for v in bm.verts if not v.is_boundary], factor=0.6, use_axis_x=True, use_axis_y=True, use_axis_z=True)
    bm.to_mesh(gm); bm.free()
    so = ob.modifiers.new('Solid', 'SOLIDIFY'); so.thickness = thick; so.offset = 1
    bpy.context.view_layer.objects.active = ob; bpy.ops.object.modifier_apply(modifier='Solid')
    for p in gm.polygons: p.use_smooth = True
    gm.materials.append(newmat(matname, rgb, rough))
    mw = ob.matrix_world.copy(); ob.parent = rig; ob.parent_type = 'BONE'; ob.parent_bone = 'head'; ob.matrix_world = mw
    return ob
brow_z = hc.z + 0.005
# helmet: whole crown down to the brow in front; covers the left ear (faces the pitcher for a right-handed hitter)
helmet = shell('Helmet', lambda c: c.z > brow_z + 0.012 or (c.y > hc.y - 0.02 and c.z > hc.z - 0.05) or (c.x > 0.02 and c.y > hc.y - 0.06 and c.z > hc.z - 0.075), 0.022, 0.006, 'helmet', (0.07, 0.33, 0.17), 0.18)
cap = shell('Cap', lambda c: c.z > brow_z + 0.02 or (c.y > hc.y + 0.02 and c.z > hc.z - 0.02), 0.009, 0.003, 'cap', (0.12, 0.25, 0.48), 0.85)
def brim(name, matname, w, d, z, tilt, parent_mat):
    bpy.ops.mesh.primitive_cylinder_add(vertices=40, radius=1, depth=0.008, location=(0, 0, 0), end_fill_type='TRIFAN')
    ob = bpy.context.active_object; ob.name = name
    bm = bmesh.new(); bm.from_mesh(ob.data); bmesh.ops.delete(bm, geom=[v for v in bm.verts if v.co.y > 0.05], context='VERTS'); bm.to_mesh(ob.data); bm.free()
    ob.scale = (w, d, 1); ob.location = (hc.x, hc.y - hr * 0.78, z); ob.rotation_euler = (tilt, 0, 0)
    ob.data.materials.append(bpy.data.materials[parent_mat]); bpy.context.view_layer.update()
    mw = ob.matrix_world.copy(); ob.parent = rig; ob.parent_type = 'BONE'; ob.parent_bone = 'head'; ob.matrix_world = mw; return ob
brim('HelmetBrim', 'helmet', hr * 0.78, hr * 0.62, brow_z + 0.018, math.radians(10), 'helmet')
brim('CapBrim', 'cap', hr * 0.72, hr * 0.78, brow_z + 0.022, math.radians(6), 'cap')
bpy.ops.mesh.primitive_uv_sphere_add(segments=28, ring_count=18, radius=0.085, location=rig.matrix_world @ arm_data.bones['wrist.L'].tail_local)
glove = bpy.context.active_object; glove.name = 'Glove'; glove.scale = (0.55, 1.0, 1.2); glove.data.materials.append(newmat('glove', (0.42, 0.22, 0.09), 0.55))
for p in glove.data.polygons: p.use_smooth = True
bpy.context.view_layer.update(); mw = glove.matrix_world.copy(); glove.parent = rig; glove.parent_type = 'BONE'; glove.parent_bone = 'wrist.L'; glove.matrix_world = mw

# ---------- 7. motion ----------
MAP = {'Hips': 'root', 'LowerBack': 'spine05', 'Spine': 'spine03', 'Spine1': 'spine01', 'Neck': 'neck01', 'Neck1': 'neck02', 'Head': 'head',
       'LHipJoint': 'pelvis.L', 'LeftUpLeg': 'upperleg01.L', 'LeftLeg': 'lowerleg01.L', 'LeftFoot': 'foot.L',
       'RHipJoint': 'pelvis.R', 'RightUpLeg': 'upperleg01.R', 'RightLeg': 'lowerleg01.R', 'RightFoot': 'foot.R',
       'LeftShoulder': 'clavicle.L', 'LeftArm': 'upperarm01.L', 'LeftForeArm': 'lowerarm01.L', 'LeftHand': 'wrist.L',
       'RightShoulder': 'clavicle.R', 'RightArm': 'upperarm01.R', 'RightForeArm': 'lowerarm01.R', 'RightHand': 'wrist.R'}
INV = {t: s for s, t in MAP.items()}
order = []
def walk(b):
    order.append(b.name)
    for c in b.children: walk(c)
walk(arm_data.bones['root'])
TR = {b.name: b.matrix_local.copy() for b in arm_data.bones}
for pb in rig.pose.bones: pb.rotation_mode = 'QUATERNION'
# curled fingers (a grip): each finger joint bends toward the palm
def bdir(n): return (TR[n].to_3x3() @ Vector((0, 1, 0))).normalized()
CURL = {}
for side, palm in (('L', Vector((-1, 0, 0))), ('R', Vector((1, 0, 0)))):
    for b in arm_data.bones:
        nm = b.name
        if not nm.startswith('finger') or not nm.endswith('.' + side): continue
        f, j = nm[6], nm[8]  # finger<f>-<j>.L
        ang = {'1': 1.45, '2': 1.55, '3': 1.1}[j] if f != '1' else {'1': 0.15, '2': 0.6, '3': 0.7}[j]
        if ang == 0: continue
        d = bdir(nm); ax = d.cross(palm)
        if ax.length < 1e-3: continue
        ax.normalize(); loc = TR[nm].to_3x3().transposed() @ ax
        CURL[nm] = Quaternion(loc, ang)

print('curled finger joints', len(CURL))
def keyall(act, frame, P_local):
    for tname, (q, loc) in P_local.items():
        pb = rig.pose.bones[tname]; pb.rotation_quaternion = q; pb.keyframe_insert('rotation_quaternion', frame=frame)
        if tname == 'root': pb.location = loc; pb.keyframe_insert('location', frame=frame)

def solve(frame_world):
    """frame_world(tname, base) -> world matrix or None for bones that just follow their parent."""
    P, out = {}, {}
    for tname in order:
        bone = arm_data.bones[tname]; par = bone.parent
        base = (P[par.name] @ TR[par.name].inverted() @ TR[tname]) if par else TR[tname].copy()
        M = frame_world(tname, base)
        if M is None and tname in CURL: M = base @ CURL[tname].to_matrix().to_4x4()
        if M is None: M = base
        P[tname] = M
        L = base.inverted() @ M
        if tname in INV or tname in CURL or M is not base: out[tname] = (L.to_quaternion(), L.translation.copy())
    return P, out

def retarget(bvh, f0, f1, step, name):
    bpy.ops.import_anim.bvh(filepath=f'{MOCAP}/{bvh}.bvh', axis_forward='-Z', axis_up='Y', rotate_mode='NATIVE')
    src = bpy.context.active_object; sarm = src.data; mw = src.matrix_world
    SR = {b.name: (mw @ b.matrix_local).copy() for b in sarm.bones}
    C = {}
    for s, t in MAP.items():
        sb = sarm.bones[s]; d_s = mw.to_3x3() @ (sb.tail_local - sb.head_local); d_t = bdir(t)
        C[t] = d_t.rotation_difference(d_s.normalized()).to_matrix() if d_s.length > 1e-3 and s not in ('Hips', 'LHipJoint', 'RHipJoint') else Matrix.Identity(3)
    src_leg = (mw @ sarm.bones['LeftUpLeg'].head_local - mw @ sarm.bones['LeftLeg'].head_local).length + (mw @ sarm.bones['LeftLeg'].head_local - mw @ sarm.bones['LeftFoot'].head_local).length
    tgt_leg = (TR['upperleg01.L'].translation - TR['lowerleg01.L'].translation).length + (TR['lowerleg01.L'].translation - TR['foot.L'].translation).length
    scl = tgt_leg / src_leg
    act = bpy.data.actions.new(name); act.use_fake_user = True; rig.animation_data_create(); rig.animation_data.action = act
    sc0 = [None]; frame = 1
    for f in range(f0, f1 + 1, step):
        scn.frame_set(f)
        def fw(tname, base):
            s = INV.get(tname)
            if not s: return None
            Ms = mw @ src.pose.bones[s].matrix
            M = (Ms.to_3x3() @ SR[s].to_3x3().inverted() @ C[tname] @ TR[tname].to_3x3()).to_4x4(); M.translation = base.translation
            if tname == 'root':
                hp = Ms.translation * scl
                if sc0[0] is None: sc0[0] = Vector((hp.x, hp.y, 0))
                M.translation = Vector((hp.x - sc0[0].x, hp.y - sc0[0].y, hp.z))
            return M
        P, out = solve(fw); keyall(act, frame, out); frame += 1
    bpy.data.objects.remove(src, do_unlink=True)
    for a in list(bpy.data.actions):
        if a is not act and not a.use_fake_user: bpy.data.actions.remove(a)
    print('retargeted', name, frame - 1, 'frames, scale', round(scl, 4)); return act

# held poses built from where each body part should point (facing -y, up +z, the player's left is +x)
def static_pose(name, dirs, drop):
    act = bpy.data.actions.new(name); act.use_fake_user = True; rig.animation_data_create(); rig.animation_data.action = act
    def fw(tname, base):
        if tname == 'root':
            M = base.copy(); M.translation = base.translation + Vector((0, 0, -drop)); return M
        want = dirs.get(tname)
        if want is None: return None
        cur = (base.to_3x3() @ Vector((0, 1, 0))).normalized()
        R = cur.rotation_difference(Vector(want).normalized()).to_matrix()
        M = (R @ base.to_3x3()).to_4x4(); M.translation = base.translation; return M
    P, out = solve(fw)
    for fr in (1, 2): keyall(act, fr, out)
    feet = min((P[n] @ Vector((0, arm_data.bones[n].length, 0))).z for n in ('foot.L', 'foot.R', 'toe1-1.L', 'toe1-1.R') if n in P)
    print('pose', name, 'lowest foot point', round(feet, 3)); return act
def S(*v): return v
spine_lean = lambda k: {n: S(0, -k, 1) for n in ('spine05', 'spine04', 'spine03', 'spine02', 'spine01')}
def legs(th, sh, ft=(0, -1, -0.25)):
    d = {}
    for sx, sd in ((1, 'L'), (-1, 'R')):
        d['upperleg01.' + sd] = S(sx * th[0], th[1], th[2]); d['lowerleg01.' + sd] = S(sx * sh[0], sh[1], sh[2]); d['foot.' + sd] = S(sx * ft[0], ft[1], ft[2])
    return d
def arms(ua, la, uaR=None, laR=None):
    uaR, laR = uaR or ua, laR or la
    return {'upperarm01.L': S(*ua), 'lowerarm01.L': S(*la), 'upperarm01.R': S(-uaR[0], uaR[1], uaR[2]), 'lowerarm01.R': S(-laR[0], laR[1], laR[2])}
ready = dict(spine_lean(0.5), **legs((0.28, -0.45, -0.85), (0.05, 0.35, -0.94)), **arms((0.32, -0.55, -0.77), (0.12, -0.85, -0.5)), neck01=S(0, -0.3, 1), head=S(0, -0.1, 1))
crouch = dict(spine_lean(0.45), **legs((0.55, -0.83, -0.05), (0.1, 0.62, -0.78), (0.2, -0.9, -0.35)), **arms((0.2, -0.85, -0.45), (0.0, -0.95, 0.3), (0.3, -0.25, -0.92), (0.1, -0.7, -0.7)), neck01=S(0, -0.25, 1), head=S(0, -0.05, 1))
ump = dict(spine_lean(0.75), **legs((0.35, -0.6, -0.72), (0.08, 0.45, -0.89)), **arms((0.3, -0.45, -0.84), (0.05, -0.55, -0.83)), neck01=S(0, -0.5, 1), head=S(0, -0.15, 1))
catch = dict(spine_lean(0.2), **legs((0.2, -0.2, -0.96), (0.05, 0.2, -0.98)), **arms((0.35, -0.35, 0.87), (0.1, -0.3, 0.95), (0.3, -0.2, -0.93), (0.15, -0.5, -0.85)), neck01=S(0, -0.1, 1), head=S(0, 0.1, 1))

slide = dict({n: S(0, 0.9, 0.42) for n in ('spine05', 'spine04', 'spine03', 'spine02', 'spine01')},
             **{'upperleg01.L': S(0.12, -0.96, -0.22), 'lowerleg01.L': S(0.1, -0.97, -0.2), 'foot.L': S(0.1, -0.5, 0.86),
                'upperleg01.R': S(-0.25, -0.75, -0.6), 'lowerleg01.R': S(-0.1, 0.85, -0.5), 'foot.R': S(-0.1, -0.3, -0.95)},
             **arms((0.55, 0.1, 0.83), (0.3, -0.2, 0.93)), neck01=S(0, -0.2, 1), head=S(0, -0.45, 0.9))
dive = dict({n: S(0, -0.97, 0.22) for n in ('spine05', 'spine04', 'spine03', 'spine02', 'spine01')},
            **legs((0.12, 0.97, 0.15), (0.08, 0.95, 0.3), (0, 0.5, 0.86)),
            **arms((0.22, -0.97, 0.05), (0.12, -0.99, -0.02), (0.3, -0.9, 0.3), (0.2, -0.95, 0.2)), neck01=S(0, -0.9, 0.45), head=S(0, -0.6, 0.8))
clips = [('124_07', 240, 430, 2, 'swing'), ('124_01', 300, 530, 2, 'pitch'), ('127_06', 20, 170, 2, 'run')]
acts = [retarget(*c) for c in clips]
leg_len = (TR['upperleg01.L'].translation - TR['foot.L'].translation).length
acts += [static_pose('ready', ready, 0.16), static_pose('crouch', crouch, 0.42), static_pose('ump', ump, 0.22), static_pose('catch', catch, 0.02), static_pose('slide', slide, 0.5), static_pose('dive', dive, 0.6)]
rig.animation_data.action = None
for pb in rig.pose.bones: pb.rotation_quaternion = Quaternion(); pb.location = Vector()
for a in acts:
    tr = rig.animation_data.nla_tracks.new(); tr.name = a.name; tr.strips.new(a.name, 1, a); tr.mute = True

# ---------- 8. export ----------
bpy.ops.object.select_all(action='SELECT')
bpy.ops.export_scene.gltf(filepath=OUT, export_format='GLB', export_animations=True, export_animation_mode='NLA_TRACKS', export_skins=True, export_yup=True, export_apply=False, use_selection=False)
print('exported', OUT)
