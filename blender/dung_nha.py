# -*- coding: utf-8 -*-
"""
Biệt thự Bê tông — dựng lại ngôi nhà của website Three.js (nha-hien-dai/) trong Blender 5.x.

Cách dùng
  • Trong Blender: tab Scripting > Open file này > Run Script (Alt+P).
    Script tạo Scene mới "NhaHienDai" (không đụng tới scene khác). Chạy lại sẽ dựng lại từ đầu.
  • Dòng lệnh (không mở giao diện):
      blender -b --python dung_nha.py -- --save nha.blend --render preview.png --samples 64

Cùng toạ độ, cùng tên với web
  • Mọi toạ độ trong file viết theo hệ Three.js (x phải, y lên, z ra đường) rồi đổi sang Blender bằng
    ma trận C: Blender (X, Y, Z) = (x, -z, y). Đây cũng là cách glTF importer/exporter đổi trục,
    nên export GLB từ Blender sẽ khớp vị trí với web.
  • Tên object: <tầng>_<nhóm>_<NN> (vd. g_MatTien_03, l2_KhoiPhai_12), cửa: DOOR_<tên>,
    nội thất: <tầng>_<loại>_<NN> (Empty) và các mảnh <tên nhóm>_<k>. Đèn: <tầng>_Den_<NN>.
    Collection: g (tầng 1), l2, l3, roof, site — đúng tên các group trong Three.js.
  • Vật liệu cùng tên với key trong src/materials.js (concrete, timberV, glass...).
  • Số ngẫu nhiên (cây, sách, dây leo) dùng chung thuật toán LCG + seed với src/rand.js.

Bake ánh sáng: xem mục "Bake lightmap" trong THIET_KE.md. Bật TAO_UV_LIGHTMAP = True để script tạo
sẵn UV thứ hai "Lightmap" (Smart UV Project) cho mọi mesh.
"""
import bpy
import bmesh
import math
import sys
import colorsys
from mathutils import Matrix, Vector

SCENE_NAME = "NhaHienDai"
THOI_GIAN = "hoang_hon"  # "hoang_hon" (giống ảnh) hoặc "ban_ngay"
TAO_UV_LIGHTMAP = False  # True: thêm UV "Lightmap" cho bake (chậm hơn vài giây)
PI = math.pi

# ------------------------------------------------------------ hệ trục ---
C = Matrix(((1, 0, 0, 0), (0, 0, -1, 0), (0, 1, 0, 0), (0, 0, 0, 1)))  # three -> blender
CI = C.inverted()


def conv(m):
    return C @ m @ CI


def trs(pos=(0, 0, 0), rot=(0, 0, 0), scl=(1, 1, 1)):
    """Ma trận theo quy ước three.js (Euler 'XYZ' = Rx·Ry·Rz), toạ độ three."""
    R = Matrix.Rotation(rot[0], 4, 'X') @ Matrix.Rotation(rot[1], 4, 'Y') @ Matrix.Rotation(rot[2], 4, 'Z')
    return Matrix.Translation(Vector(pos)) @ R @ Matrix.Diagonal((scl[0], scl[1], scl[2], 1))


def blender_vec(x, y, z):
    return Vector((x, -z, y))


def make_rng(seed):
    """Giống hệt src/rand.js"""
    s = [seed & 0xFFFFFFFF]

    def r():
        s[0] = (s[0] * 1664525 + 1013904223) & 0xFFFFFFFF
        return s[0] / 4294967296
    return r


def js_round(x):
    return math.floor(x + 0.5)


def srgb_to_lin(c):
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def hexcol(h, alpha=1.0):
    h = h.lstrip('#')
    return tuple(srgb_to_lin(int(h[i:i + 2], 16) / 255) for i in (0, 2, 4)) + (alpha,)


# ------------------------------------------------------------ vật liệu ---
def _bsdf(m):
    for n in m.node_tree.nodes:
        if n.type == 'BSDF_PRINCIPLED':
            return n


def _set(node, names, val):
    for nm in (names if isinstance(names, (list, tuple)) else [names]):
        if nm in node.inputs:
            node.inputs[nm].default_value = val
            return


def new_mat(name, hexc='#cccccc', rough=0.6, metal=0.0):
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    if bpy.app.version < (5, 0, 0):
        m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    out.location = (400, 0)
    b = nt.nodes.new('ShaderNodeBsdfPrincipled')
    nt.links.new(b.outputs[0], out.inputs['Surface'])
    _set(b, 'Base Color', hexcol(hexc))
    _set(b, 'Roughness', rough)
    _set(b, 'Metallic', metal)
    m.diffuse_color = hexcol(hexc)
    return m


def grid_mat(name, base, line, pu=0.0, pv=0.0, width=0.01, rough=0.8, metal=0.0, noise=0.15, bump=0.3):
    """Màu + đường ron/khe theo UV mét (UV giống web: 1 đơn vị = 1m). pu/pv: chu kỳ theo u/v (0 = không)."""
    m = new_mat(name, base, rough, metal)
    nt = m.node_tree
    N, L = nt.nodes, nt.links
    b = _bsdf(m)
    tc = N.new('ShaderNodeTexCoord')
    sep = N.new('ShaderNodeSeparateXYZ')
    L.new(tc.outputs['UV'], sep.inputs[0])

    def mnode(op, a, bval):
        n = N.new('ShaderNodeMath')
        n.operation = op
        if isinstance(a, float):
            n.inputs[0].default_value = a
        else:
            L.new(a, n.inputs[0])
        if isinstance(bval, float):
            n.inputs[1].default_value = bval
        else:
            L.new(bval, n.inputs[1])
        return n

    mask = None
    for axis, per in (('X', pu), ('Y', pv)):
        if per <= 0:
            continue
        d = mnode('DIVIDE', sep.outputs[axis], float(per))
        fr = mnode('FRACT', d.outputs[0], 0.0)
        lt = mnode('LESS_THAN', fr.outputs[0], float(width / per))
        mask = lt if mask is None else mnode('MAXIMUM', mask.outputs[0], lt.outputs[0])

    # biến thiên màu bằng noise
    nz = N.new('ShaderNodeTexNoise')
    _set(nz, 'Scale', 3.0)
    L.new(tc.outputs['Object'], nz.inputs['Vector'])
    var = N.new('ShaderNodeMix')
    var.data_type = 'RGBA'
    var.inputs[6].default_value = hexcol(base)
    c2 = Vector(hexcol(base)[:3]) * (1 - noise)
    var.inputs[7].default_value = (c2.x, c2.y, c2.z, 1)
    L.new(nz.outputs['Fac'], var.inputs[0])
    col_out = var.outputs[2]
    if mask is not None:
        mix = N.new('ShaderNodeMix')
        mix.data_type = 'RGBA'
        L.new(var.outputs[2], mix.inputs[6])
        mix.inputs[7].default_value = hexcol(line)
        L.new(mask.outputs[0], mix.inputs[0])
        col_out = mix.outputs[2]
        if bump > 0:
            bn = N.new('ShaderNodeBump')
            _set(bn, 'Strength', bump)
            inv = mnode('SUBTRACT', 1.0, mask.outputs[0])
            L.new(inv.outputs[0], bn.inputs['Height'])
            L.new(bn.outputs['Normal'], b.inputs['Normal'])
    L.new(col_out, b.inputs['Base Color'])
    return m


def glass_mat(name, hexc, rough=0.03, alpha=1.0):
    m = new_mat(name, hexc, rough)
    b = _bsdf(m)
    _set(b, ['Transmission Weight', 'Transmission'], 1.0)
    _set(b, 'IOR', 1.45)
    if alpha < 1:
        _set(b, 'Alpha', alpha)
    for attr, val in (('surface_render_method', 'DITHERED'), ('use_screen_refraction', True)):
        try:
            setattr(m, attr, val)
        except Exception:
            pass
    return m


def emit_mat(name, base, emit, strength):
    m = new_mat(name, base, 0.5)
    b = _bsdf(m)
    _set(b, ['Emission Color', 'Emission'], hexcol(emit))
    _set(b, 'Emission Strength', strength)
    return m


def vcol_mat(name, rough=0.8):
    m = new_mat(name, '#ffffff', rough)
    nt = m.node_tree
    a = nt.nodes.new('ShaderNodeVertexColor')
    a.layer_name = 'Col'
    nt.links.new(a.outputs['Color'], _bsdf(m).inputs['Base Color'])
    return m


def create_materials():
    M = {
        'concrete': grid_mat('concrete', '#c4c3be', '#86857f', pu=0.15, pv=1.2, width=0.004, rough=0.92, noise=0.12, bump=0.15),
        'plaster': new_mat('plaster', '#efebe4', 0.95),
        'ceiling': new_mat('ceiling', '#f6f4ef', 1.0),
        'render': new_mat('render', '#e8e4dc', 0.95),
        'frame': new_mat('frame', '#5f6366', 0.6, 0.3),
        'soffit': new_mat('soffit', '#4d5054', 0.8),
        'steel': new_mat('steel', '#2c2f33', 0.45, 0.7),
        'timberH': grid_mat('timberH', '#5e3829', '#1e120d', pv=0.1, width=0.012, rough=0.7, noise=0.2),
        'timberV': grid_mat('timberV', '#5e3829', '#1e120d', pu=0.1, width=0.012, rough=0.7, noise=0.2),
        'timber': new_mat('timber', '#5a3324', 0.65),
        'woodFloor': grid_mat('woodFloor', '#b08560', '#5a3a20', pv=0.2, width=0.003, rough=0.55, noise=0.18, bump=0.1),
        'marble': grid_mat('marble', '#e9e6e0', '#a8a39d', pu=0.8, pv=0.8, width=0.003, rough=0.25, noise=0.06, bump=0.05),
        'paving': grid_mat('paving', '#8d8e8b', '#5b5c5a', pu=0.2, pv=0.2, width=0.008, rough=0.85, noise=0.12),
        'deck': grid_mat('deck', '#8a5e45', '#3a2418', pu=0.1, width=0.01, rough=0.8, noise=0.2),
        'bathTile': grid_mat('bathTile', '#cfcac1', '#9d988f', pu=0.6, pv=0.6, width=0.006, rough=0.3, noise=0.04),
        'poolTile': grid_mat('poolTile', '#3e8fb0', '#e8f2f5', pu=0.125, pv=0.125, width=0.006, rough=0.3, noise=0.05),
        'stone': grid_mat('stone', '#3d3f42', '#3d3f42', rough=0.55, noise=0.35),
        'grass': grid_mat('grass', '#4f7a35', '#4f7a35', rough=1.0, noise=0.35),
        'asphalt': grid_mat('asphalt', '#3a3b3d', '#3a3b3d', rough=0.95, noise=0.3),
        'roofMetal': grid_mat('roofMetal', '#4a4d51', '#1e1f21', pv=0.4, width=0.012, rough=0.5, metal=0.4, noise=0.05),
        'roofTile': new_mat('roofTile', '#a5482f', 0.8),
        'glass': glass_mat('glass', '#e6f0f2'),
        'water': glass_mat('water', '#2f9ec4', 0.03),
        'lightWarm': emit_mat('lightWarm', '#fff3dc', '#ffc98a', 2.6),
        'fabricLight': new_mat('fabricLight', '#d8d0c2', 0.95),
        'fabricDark': new_mat('fabricDark', '#4b4f55', 0.95),
        'fabricAccent': new_mat('fabricAccent', '#9c6b4e', 0.95),
        'bedding': new_mat('bedding', '#f1ede6', 1.0),
        'walnut': new_mat('walnut', '#5b3a29', 0.55),
        'oak': new_mat('oak', '#b48a62', 0.55),
        'whiteGloss': new_mat('whiteGloss', '#f4f4f2', 0.2),
        'black': new_mat('black', '#1b1c1e', 0.4, 0.4),
        'screen': new_mat('screen', '#0b0c10', 0.15, 0.2),
        'leaf': new_mat('leaf', '#3f7a35', 0.85),
        'leaf2': new_mat('leaf2', '#5c8f3a', 0.85),
        'trunk': new_mat('trunk', '#5a4636', 0.9),
        'pot': new_mat('pot', '#cfc8bc', 0.8),
        'carPaint': new_mat('carPaint', '#1f2a36', 0.25, 0.6),
        'rubber': new_mat('rubber', '#151515', 0.9),
        'art1': new_mat('art1', '#c8643c', 0.9),
        'art2': new_mat('art2', '#2f5d73', 0.9),
        'invisible': new_mat('invisible', '#ff00ff', 1.0),
        'leafInstanced': vcol_mat('leafInstanced'),
    }
    for i, h in enumerate(['#8c3b2e', '#2f5d73', '#d9c7a3', '#3d4a3a', '#6b4a7a', '#c69c3a']):
        M['book_%d' % i] = new_mat('book_%d' % i, h, 0.8)
    return M


# ------------------------------------------------------------ hình học ---
FACE_UV = [  # theo mặt +x -x +y -y +z -z của BoxGeometry
    lambda v, w, h, d: (d / 2 - v.z, v.y + h / 2),
    lambda v, w, h, d: (v.z + d / 2, v.y + h / 2),
    lambda v, w, h, d: (v.x + w / 2, d / 2 - v.z),
    lambda v, w, h, d: (v.x + w / 2, v.z + d / 2),
    lambda v, w, h, d: (v.x + w / 2, v.y + h / 2),
    lambda v, w, h, d: (w / 2 - v.x, v.y + h / 2),
]


def _face_index(n):
    ax = max(range(3), key=lambda i: abs(n[i]))
    return ax * 2 + (0 if n[ax] > 0 else 1)


def _finish(name, bm, mats, face_mat=None):
    """bm đang ở hệ three -> đổi sang Blender, gán vật liệu."""
    bm.transform(C)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    if not me.uv_layers:
        me.uv_layers.new(name='UVMap')
    uniq = []
    for m in (mats if isinstance(mats, list) else [mats]):
        if m not in uniq:
            uniq.append(m)
    for m in uniq:
        me.materials.append(m)
    if isinstance(mats, list) and len(uniq) > 1 and face_mat is not None:
        for poly, fi in zip(me.polygons, face_mat):
            poly.material_index = uniq.index(mats[fi])
    return me


def mesh_box(name, w, h, d, mats):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    for v in bm.verts:
        v.co = Vector((v.co.x * w, v.co.y * h, v.co.z * d))
    bm.normal_update()
    uv = bm.loops.layers.uv.new('UVMap')
    fmat = []
    for f in bm.faces:
        fi = _face_index(f.normal)
        fmat.append(fi)
        for lp in f.loops:
            lp[uv].uv = FACE_UV[fi](lp.vert.co, w, h, d)
    return _finish(name, bm, mats, fmat)


def mesh_cyl(name, rt, rb, h, seg, mat):
    bm = bmesh.new()
    bm.loops.layers.uv.new('UVMap')  # calc_uvs cần sẵn lớp UV
    bmesh.ops.create_cone(bm, cap_ends=True, segments=seg, radius1=rb, radius2=rt, depth=h, calc_uvs=True,
                          matrix=Matrix.Rotation(-PI / 2, 4, 'X'))
    return _finish(name, bm, mat)


def mesh_ico(name, r, mat):
    bm = bmesh.new()
    bm.loops.layers.uv.new('UVMap')  # calc_uvs cần sẵn lớp UV
    bmesh.ops.create_icosphere(bm, subdivisions=2, radius=r, calc_uvs=True)
    return _finish(name, bm, mat)


def mesh_sphere(name, r, mat):
    bm = bmesh.new()
    bm.loops.layers.uv.new('UVMap')  # calc_uvs cần sẵn lớp UV
    bmesh.ops.create_uvsphere(bm, u_segments=20, v_segments=12, radius=r, calc_uvs=True)
    return _finish(name, bm, mat)


def mesh_prism(name, pts, depth, mat):
    """Đa giác (x, y) đùn theo +z từ 0 tới depth (giống ExtrudeGeometry)."""
    bm = bmesh.new()
    front = [bm.verts.new((x, y, depth)) for x, y in pts]
    back = [bm.verts.new((x, y, 0)) for x, y in pts]
    bm.faces.new(front)
    bm.faces.new(list(reversed(back)))
    n = len(pts)
    for i in range(n):
        j = (i + 1) % n
        bm.faces.new((back[i], back[j], front[j], front[i]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    uv = bm.loops.layers.uv.new('UVMap')
    for f in bm.faces:
        for lp in f.loops:
            co = lp.vert.co
            lp[uv].uv = (co.x, co.y) if abs(f.normal.z) > 0.5 else (co.z + co.x, co.y)
    return _finish(name, bm, mat)


# ------------------------------------------------------------ builder ---
class Builder:
    def __init__(self, scene, root, M):
        self.scene = scene
        self.root = root
        self.p3 = {}  # vị trí (hệ three) của các Empty, để đặt con theo toạ độ thế giới như web
        self.M = M
        self.levels = {}
        self.cur = None
        self.lvl = None
        self.counts = {}
        self.tag_name = 'Chung'
        self.lamps = []

    def level(self, name):
        if name not in self.levels:
            col = bpy.data.collections.new(name)
            self.root.children.link(col)
            self.levels[name] = col
        self.cur = self.levels[name]
        self.lvl = name
        self.tag_name = 'Chung'

    def tag(self, t):
        self.tag_name = t

    def next_name(self, prefix):
        key = '%s_%s' % (self.lvl, prefix)
        self.counts[key] = self.counts.get(key, 0) + 1
        return '%s_%02d' % (key, self.counts[key])

    def link(self, ob, matrix3=None, parent=None):
        self.cur.objects.link(ob)
        if parent is not None:
            ob.parent = parent
        else:
            ob['level'] = self.lvl  # glTF không có collection: web gom object theo thuộc tính này
        if matrix3 is not None:
            ob.matrix_basis = conv(matrix3)
        return ob

    def _post(self, ob, mats):
        ms = mats if isinstance(mats, list) else [mats]
        if self.M['invisible'] in ms:
            ob.hide_render = True
            ob.display_type = 'WIRE'
            ob['collider'] = True
        if self.M['glass'] in ms or self.M['water'] in ms:
            try:
                ob.visible_shadow = False
            except Exception:
                pass

    @staticmethod
    def flags(ob, floor=False, collide=True, cast=True):
        """Cờ giống builder.js (xuất ra glTF extras -> userData trên web). Chỉ ghi giá trị khác mặc định."""
        if floor:
            ob['floor'] = True
        if not collide:
            ob['collide'] = False
        if not cast:
            ob['cast'] = False

    def obj(self, name, me, mats, matrix3, parent=None, **fl):
        ob = bpy.data.objects.new(name, me)
        self.link(ob, matrix3, parent)
        self._post(ob, mats)
        self.flags(ob, **fl)
        return ob

    def box(self, mat, x0, y0, z0, x1, y1, z1, parent=None, name=None, **fl):
        ax, bx = min(x0, x1), max(x0, x1)
        ay, by = min(y0, y1), max(y0, y1)
        az, bz = min(z0, z1), max(z0, z1)
        name = name or self.next_name(self.tag_name)
        pos = Vector(((ax + bx) / 2, (ay + by) / 2, (az + bz) / 2))
        if parent is not None:
            pos -= self.p3[parent.name]
        me = mesh_box(name, bx - ax, by - ay, bz - az, mat)
        return self.obj(name, me, mat, trs(pos), parent, **fl)

    def empty(self, name, pos=(0, 0, 0), rot=(0, 0, 0)):
        ob = bpy.data.objects.new(name, None)
        ob.empty_display_type = 'PLAIN_AXES'
        ob.empty_display_size = 0.4
        self.p3[name] = Vector(pos)
        return self.link(ob, trs(pos, rot))

    def slab(self, x0, z0, x1, z1, y_top, thick, top, bottom, collide=True):
        e = self.M['concrete']
        return self.box([e, e, top, bottom, e, e], x0, y_top - thick, z0, x1, y_top, z1, floor=True, collide=collide)

    def wall(self, mat, axis, c, a0, a1, y0, y1, t, openings=(), outer=None, inner=None, out=1):
        material = mat
        if outer is not None:
            inn = inner or self.M['plaster']
            pos, neg = (outer, inn) if out > 0 else (inn, outer)
            material = [outer, outer, outer, outer, pos, neg] if axis == 'x' else [pos, neg, outer, outer, outer, outer]
        lo, hi = min(a0, a1), max(a0, a1)
        ops = []
        for p in openings:
            ops.append(dict(a0=min(p['a0'], p['a1']), a1=max(p['a0'], p['a1']),
                            b0=y0 + p.get('y0', 0), b1=y0 + p.get('y1', y1 - y0), glass=p.get('glass', False)))
        ops.sort(key=lambda p: p['a0'])

        def seg(s0, s1, yy0, yy1):
            if s1 - s0 < 1e-3 or yy1 - yy0 < 1e-3:
                return
            if axis == 'x':
                self.box(material, s0, yy0, c - t / 2, s1, yy1, c + t / 2)
            else:
                self.box(material, c - t / 2, yy0, s0, c + t / 2, yy1, s1)

        cur = lo
        for p in ops:
            seg(cur, p['a0'], y0, y1)
            seg(p['a0'], p['a1'], y0, p['b0'])
            seg(p['a0'], p['a1'], p['b1'], y1)
            if p['glass']:
                self.glass_pane(axis, c, p['a0'], p['a1'], p['b0'], p['b1'])
            cur = p['a1']
        seg(cur, hi, y0, y1)

    def glass_pane(self, axis, c, a0, a1, y0, y1, parent=None):
        f, M = 0.05, self.M

        def put(mat, s0, s1, yy0, yy1, t, **fl):
            if axis == 'x':
                return self.box(mat, s0, yy0, c - t / 2, s1, yy1, c + t / 2, parent, **fl)
            return self.box(mat, c - t / 2, yy0, s0, c + t / 2, yy1, s1, parent, **fl)

        put(M['glass'], a0, a1, y0, y1, 0.02, cast=False)
        put(M['frame'], a0, a1, y0, y0 + f, 0.07, collide=False)
        put(M['frame'], a0, a1, y1 - f, y1, 0.07, collide=False)
        put(M['frame'], a0, a0 + f, y0, y1, 0.07, collide=False)
        put(M['frame'], a1 - f, a1, y0, y1, 0.07, collide=False)
        n = math.ceil((a1 - a0) / 1.5)
        for i in range(1, n):
            a = a0 + ((a1 - a0) * i) / n
            put(M['frame'], a - f / 2, a + f / 2, y0, y1, 0.07, collide=False)

    def sloped(self, mat, x0, x1, zA, yA, zB, yB, h, **fl):
        if zB < zA:
            zA, yA, zB, yB = zB, yB, zA, yA
        ln = math.hypot(zB - zA, yB - yA)
        ang = math.atan2(yB - yA, zB - zA)
        name = self.next_name(self.tag_name)
        me = mesh_box(name, x1 - x0, h, ln, mat)
        pos = ((x0 + x1) / 2, (yA + yB) / 2 + (h / 2) * math.cos(ang), (zA + zB) / 2 - (h / 2) * math.sin(ang))
        return self.obj(name, me, mat, trs(pos, (-ang, 0, 0)), **fl)

    def downlight(self, x, y, z):
        self.box(self.M['lightWarm'], x - 0.06, y - 0.02, z - 0.06, x + 0.06, y, z + 0.06, collide=False, cast=False)

    def door(self, ob, kind, **props):
        ob['door'] = kind
        for k, v in props.items():
            ob[k] = v

    # đèn: cường độ three (candela) -> W của Blender (theo quy đổi glTF: W = cd·4π/683·1000)
    def lamp(self, x, y, z, cd, dist=10, color='#ffd2a0'):
        name = self.next_name('Den')
        ld = bpy.data.lights.new(name, 'POINT')
        ld.energy = cd * 4 * PI / 683 * 1000
        ld.color = hexcol(color)[:3]
        ld.shadow_soft_size = 0.08
        try:
            ld.use_custom_distance = True
            ld.cutoff_distance = dist
        except Exception:
            pass
        ob = bpy.data.objects.new(name, ld)
        self.link(ob, trs((x, y, z)))
        ob['cd'], ob['dist'] = cd, dist  # cường độ gốc trên web (candela) + tầm chiếu
        self.lamps.append(ob)
        return ob

    def spot(self, pos, target, cd, angle, penumbra, color='#ffc690', dist=6):
        name = self.next_name('DenHat')
        ld = bpy.data.lights.new(name, 'SPOT')
        ld.energy = cd * 4 * PI / 683 * 1000
        ld.color = hexcol(color)[:3]
        ld.spot_size = angle * 2
        ld.spot_blend = penumbra
        ld.shadow_soft_size = 0.05
        ob = bpy.data.objects.new(name, ld)
        self.cur.objects.link(ob)
        ob['level'], ob['cd'], ob['dist'] = self.lvl, cd, dist
        ob['angle'], ob['penumbra'] = angle, penumbra
        ob['target'] = target  # điểm chiếu (hệ three)
        p, t = blender_vec(*pos), blender_vec(*target)
        ob.location = p
        ob.rotation_mode = 'QUATERNION'
        ob.rotation_quaternion = (t - p).to_track_quat('-Z', 'Y')
        self.lamps.append(ob)
        return ob

    # ---- nhóm (nội thất, cây): Empty <tầng>_<loại>_NN, mảnh con <tên>_<k>
    def add_group(self, g, pos, rot_y=0.0, typ=None, collide=True, cast=True):
        name = self.next_name(typ or g.type)
        e = self.empty(name, pos, (0, rot_y, 0))
        e.empty_display_size = 0.25
        for k, rec in enumerate(g.parts):
            ob = self._make_part('%s_%d' % (name, k), rec, e)
            self.flags(ob, collide=collide and rec['collide'], cast=cast)
        return e

    def _make_part(self, name, rec, parent):
        kind, mat = rec['kind'], rec['mat']
        if kind == 'box':
            me = mesh_box(name, *rec['dims'], mat)
        elif kind == 'cyl':
            me = mesh_cyl(name, rec['rt'], rec['rb'], rec['h'], rec['seg'], mat)
        elif kind == 'ico':
            me = mesh_ico(name, rec['r'], mat)
        else:
            me = mesh_sphere(name, rec['r'], mat)
        ob = bpy.data.objects.new(name, me)
        self.cur.objects.link(ob)
        ob.parent = parent
        ob.matrix_basis = conv(trs(rec['pos'], rec['rot'], rec['scl']))
        self._post(ob, mat)
        return ob


class Grp:
    """Tương đương THREE.Group trong furniture.js"""

    def __init__(self, typ):
        self.type = typ
        self.parts = []

    def _rec(self, **kw):
        rec = dict(rot=(0, 0, 0), scl=(1, 1, 1), collide=True)
        rec.update(kw)
        self.parts.append(rec)
        return rec

    def part(self, mat, x0, y0, z0, x1, y1, z1, noCollide=False):
        return self._rec(kind='box', mat=mat, dims=(abs(x1 - x0), abs(y1 - y0), abs(z1 - z0)),
                         pos=((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2), collide=not noCollide)

    def cyl(self, mat, r, h, x, y, z, seg=20, rb=None, noCollide=False):
        return self._rec(kind='cyl', mat=mat, rt=r, rb=r if rb is None else rb, h=h, seg=seg, pos=(x, y + h / 2, z),
                         collide=not noCollide)

    def ico(self, mat, r=1.0, noCollide=False):
        return self._rec(kind='ico', mat=mat, r=r, pos=(0, 0, 0), collide=not noCollide)

    def sphere(self, mat, r):
        return self._rec(kind='sphere', mat=mat, r=r, pos=(0, 0, 0))


# ================================================================ NHÀ ===
L2, L3, ROOF, EAVE, PEAK = 3.9, 7.2, 10.4, 7.5, 11.6
K = (PEAK - EAVE) / 7.5
TE, TI = 0.25, 0.12


def roofY(x):
    return EAVE + (x + 6) * K


def sliding_glass(b, door_id, axis, c, a0, a1, y0, y1, slide):
    g = b.empty('DOOR_' + door_id)
    b.glass_pane(axis, c, a0, a1, y0, y1, parent=g)
    move = (slide, 0, 0) if axis == 'x' else (0, 0, slide)
    b.door(g, 'slide', move_three=move)
    return g


def gable(b, M, z_front, y0, holes):
    pts = [(-6.125, y0), (1.5, y0), (1.5, PEAK), (-6.125, roofY(-6.125))]
    name = b.next_name(b.tag_name)
    me = mesh_prism(name, pts, 0.3, M['concrete'])
    ob = b.obj(name, me, M['concrete'], trs((0, 0, z_front - 0.3)))
    for (x0, yy0, x1, yy1) in holes:  # khoét lỗ cửa sổ bằng Boolean rồi áp dụng
        cut = bpy.data.objects.new('_cut', mesh_box('_cut', x1 - x0, yy1 - yy0, 1.0, M['concrete']))
        b.cur.objects.link(cut)
        cut.matrix_basis = conv(trs(((x0 + x1) / 2, (yy0 + yy1) / 2, z_front - 0.15)))
        mod = ob.modifiers.new('cut', 'BOOLEAN')
        mod.operation = 'DIFFERENCE'
        mod.object = cut
        dg = b.scene.view_layers[0].depsgraph
        dg.update()
        new = bpy.data.meshes.new_from_object(ob.evaluated_get(dg))
        old = ob.data
        ob.modifiers.clear()
        ob.data = new
        new.name = name
        bpy.data.meshes.remove(old)
        cm = cut.data
        bpy.data.objects.remove(cut)
        bpy.data.meshes.remove(cm)
    for (x0, yy0, x1, yy1) in holes:
        b.glass_pane('x', z_front - 0.15, x0, x1, yy0, yy1)
    return ob


def railing(b, M, axis, c, a0, a1, y0, h=1.05):
    if axis == 'x':
        b.box(M['glass'], a0, y0, c - 0.01, a1, y0 + h, c + 0.01, cast=False)
        b.box(M['steel'], a0, y0 + h, c - 0.03, a1, y0 + h + 0.04, c + 0.03, collide=False)
    else:
        b.box(M['glass'], c - 0.01, y0, a0, c + 0.01, y0 + h, a1, cast=False)
        b.box(M['steel'], c - 0.03, y0 + h, a0, c + 0.03, y0 + h + 0.04, a1, collide=False)


def stairs(b, M, x0, x1, z_start, z_end, y_start, y_end, risers):
    dz, dy = (z_end - z_start) / risers, (y_end - y_start) / risers
    for i in range(risers):
        top = y_start + (i + 1) * dy
        b.box(M['oak'], x0, top - 0.06, z_start + i * dz, x1, top, z_start + (i + 1) * dz, floor=True, collide=False)


def ground(b, M):
    b.level('g')
    h = 3.6
    b.tag('San')
    b.slab(-6, -4, 6, -18, 0, 0.3, M['marble'], M['concrete'], collide=False)

    b.tag('MatTien')
    b.glass_pane('x', -4, -6, -3.9, 0, h)
    b.box(M['concrete'], -3.9, 0, -4.15, 1.3, h, -3.85)
    b.box(M['timberV'], 4.6, 0, -4.15, 6, h, -3.85)

    b.tag('VachLam')
    x = 1.3
    while x < 4.6:
        if not (1.55 < x < 2.72):
            b.box(M['timber'], x, 0, -3.92, x + 0.06, h, -3.8)
        x += 0.11
    b.glass_pane('x', -4.2, 2.72, 4.6, 0, h)

    b.tag('CuaChinh')
    door = b.empty('DOOR_CuaChinh', (1.6, 0, -3.95))
    b.box(M['timberV'], 1.6, 0, -3.98, 2.7, h - 0.05, -3.92, parent=door)
    x = 1.62
    while x < 2.66:
        b.box(M['timber'], x, 0.02, -3.92, x + 0.06, h - 0.07, -3.84, parent=door)
        x += 0.11
    b.box(M['steel'], 2.45, 0.9, -3.84, 2.48, 2.1, -3.78, parent=door, collide=False)
    b.door(door, 'pivot', rot_three_y=PI / 2 * 0.92)
    b.box(M['timberV'], 1.3, 0, -4.15, 1.6, h, -3.85)

    b.tag('TuongNgoai')
    b.wall(None, 'z', -6, -4, -18, 0, h, TE, [dict(a0=-5, a1=-12, glass=True)], outer=M['concrete'], out=-1)
    b.wall(None, 'z', 6, -4, -18, 0, h, TE, [], outer=M['concrete'], out=1)
    b.glass_pane('x', -18, -6, -1, 0, h)
    b.glass_pane('x', -18, 1.6, 6, 0, h)
    sliding_glass(b, 'CuaHoBoi', 'x', -17.92, -1, 1.6, 0, h, -2.4)

    b.tag('WC')
    P = M['plaster']
    b.wall(P, 'z', 1.5, -7, -13, 0, h, TI)
    b.wall(P, 'z', 3.2, -7, -13, 0, h, TI, [dict(a0=-7.8, a1=-8.7, y1=2.2), dict(a0=-11, a1=-11.9, y1=2.2)])
    b.wall(P, 'x', -7, 1.5, 3.2, 0, h, TI)
    b.wall(P, 'x', -10, 1.5, 3.2, 0, h, TI)
    b.wall(P, 'x', -13, 1.5, 3.2, 0, h, TI)

    b.tag('CauThang')
    stairs(b, M, 4.65, 5.88, -7, -12.6, 0, L2, 20)
    b.sloped(M['glass'], 4.59, 4.61, -7, 0, -12.6, L2, 1.0, cast=False)
    b.sloped(M['steel'], 4.57, 4.63, -7, 1.0, -12.6, L2 + 1.0, 0.04, collide=False)

    b.tag('Gara')
    for x in (-4.6, 5.3):
        name = b.next_name(b.tag_name)
        b.obj(name, mesh_cyl(name, 0.11, 0.11, h, 16, M['steel']), M['steel'], trs((x, h / 2, 0.6)))
    b.box(M['soffit'], -7.2, 3.2, 1.0, -4.6, 3.36, -4, collide=False)
    for x in (-3, -0.5, 2, 4.5):
        for z in (0.2, -2.4):
            b.downlight(x, h - 0.01, z)
    b.downlight(-6.4, 3.19, -1.5)
    b.downlight(-6.4, 3.19, -3.2)

    for x in (-2.6, 0.2):
        b.spot((x, 0.05, -3.55), (x, 3.5, -4), 18, 0.5, 0.6)

    b.lamp(-1, 3.2, -1.2, 14, 9)
    b.lamp(3.5, 3.2, -1.2, 10, 8)
    b.lamp(-2.5, 3.2, -7, 16, 10)
    b.lamp(-2.5, 3.2, -12, 12, 9)
    b.lamp(0, 3.2, -16, 14, 10)
    b.lamp(3.6, 3.2, -5.5, 8, 6)


def planter_greens(b, M, x0, x1, z, y_top):
    rnd = make_rng(2)
    mat = M['leafInstanced']

    def build(name, count, make):
        bm = bmesh.new()
        col = bm.loops.layers.float_color.new('Col')
        for i in range(count):
            mtx, rgb = make(i)
            if name.endswith('CayRu'):
                res = bmesh.ops.create_cube(bm, size=1.0, matrix=mtx @ Matrix.Translation((0, -0.5, 0)) @ Matrix.Diagonal((0.012, 1, 0.05, 1)))
            else:
                res = bmesh.ops.create_icosphere(bm, subdivisions=2, radius=1.0, matrix=mtx)
            faces = {f for v in res['verts'] for f in v.link_faces}
            for f in faces:
                for lp in f.loops:
                    lp[col] = rgb
        ob = b.obj(name, _finish(name, bm, mat), mat, Matrix.Identity(4), collide=False)
        return ob

    def hsl(hh, s, l):
        r, g, bb = colorsys.hls_to_rgb(hh, l, s)
        return (srgb_to_lin(r), srgb_to_lin(g), srgb_to_lin(bb), 1.0)

    def vine(i):
        pos = (x0 + rnd() * (x1 - x0), y_top + 0.05, z + rnd() * 0.06)
        rot = ((rnd() - 0.5) * 0.25, rnd() * PI, (rnd() - 0.5) * 0.2)
        sy = 0.15 + rnd() ** 2 * 0.75
        hh = 0.22 + rnd() * 0.06
        l = 0.28 + rnd() * 0.14
        return trs(pos, rot, (1, sy, 1)), hsl(hh, 0.45, l)

    def bush(i):
        pos = (x0 + rnd() * (x1 - x0), y_top + 0.02, 0.4 + rnd() * 0.6)
        rot = (0, rnd() * 6, 0)
        s = 0.12 + rnd() * 0.12
        hh = 0.23 + rnd() * 0.05
        l = 0.25 + rnd() * 0.12
        return trs(pos, rot, (s, s * 0.8, s)), hsl(hh, 0.5, l)

    build('l2_CayRu', 900, vine)
    build('l2_BuiCay', 240, bush)


def level2(b, M):
    y, top = L2, L3 - 0.3
    b.level('l2')
    P = M['plaster']

    b.tag('San')
    b.slab(-6, 1.05, 6, -7, y, 0.3, M['woodFloor'], M['soffit'])
    b.slab(-6, -7, 3.2, -12.6, y, 0.3, M['woodFloor'], M['ceiling'])
    b.slab(-6, -12.6, 6, -18, y, 0.3, M['woodFloor'], M['ceiling'])
    b.box(M['frame'], -6, y - 0.32, 1.05, 6, y, 1.08, collide=False)

    b.tag('BonCay')
    b.box(M['frame'], -4.6, y, 0.35, 6, y + 0.85, 1.05)
    b.box(M['trunk'], -4.55, y + 0.85, 0.4, 5.95, y + 0.82, 1.0, collide=False)
    planter_greens(b, M, -4.55, 5.95, 1.07, y + 0.85)
    x = -4.6
    while x <= 6:
        b.box(M['steel'], x, y + 0.85, 0.27, x + 0.03, y + 1.15, 0.3, collide=False)
        x += 1.325
    b.box(M['steel'], -4.6, y + 1.12, 0.26, 6, y + 1.15, 0.31)

    b.tag('KhoiTrai')
    b.box(M['concrete'], -6.125, y, -0.3, 1.5, top, 0)
    b.wall(None, 'z', -6, -0.3, -18, y, top + 0.3, TE,
           [dict(a0=-1.5, a1=-6, y0=0.4, y1=2.9, glass=True),
            dict(a0=-9, a1=-11, y0=1.6, y1=2.6, glass=True),
            dict(a0=-14.5, a1=-17, y0=0.8, y1=2.8, glass=True)],
           outer=M['concrete'], out=-1)
    b.wall(None, 'x', -17.85, -6, 1.5, y, top + 0.3, TE,
           [dict(a0=-4.8, a1=-1.8, y0=0.7, y1=2.7, glass=True), dict(a0=0, a1=1.2, y0=1.6, y1=2.5, glass=True)],
           outer=M['concrete'], out=-1)

    b.tag('KhoiPhai')
    b.box(M['deck'], 1.5, y, 0.35, 5.6, y + 0.03, -3, floor=True, collide=False)
    b.box(M['concrete'], 5.6, y, 0.3, 6.0, 11.3, -5)
    b.glass_pane('x', -3, 3.6, 5.6, y, top)
    sliding_glass(b, 'CuaSinhHoatT2', 'x', -2.92, 1.6, 3.6, y, top, 1.9)
    b.glass_pane('z', 1.5, -1.6, -3, y, top)
    sliding_glass(b, 'CuaMasterT2', 'z', 1.42, -0.2, -1.6, y, top, -1.3)
    b.wall(None, 'z', 6, -5, -18, y, top + 0.3, TE, [], outer=M['concrete'], out=1)
    b.wall(None, 'x', -17.85, 1.5, 6, y, top + 0.3, TE,
           [dict(a0=2, a1=3, y0=1.5, y1=2.5, glass=True), dict(a0=4, a1=5.5, y0=1, y1=2.4, glass=True)],
           outer=M['concrete'], out=-1)
    for x in (2.5, 4.5):
        for z in (-0.7, -2.2):
            b.downlight(x, top - 0.01, z)

    b.tag('VachTrong')
    b.wall(P, 'z', 1.5, -3, -8, y, top, TI, [dict(a0=-5.4, a1=-6.3, y1=2.2)])
    b.wall(P, 'z', 1.5, -8, -13, y, top, TI)
    b.wall(P, 'x', -8, -6, 1.5, y, top, TI, [dict(a0=-0.6, a1=0.3, y1=2.2)])
    b.wall(P, 'z', -1.5, -8, -13, y, top, TI, [dict(a0=-9.6, a1=-10.5, y1=2.2)])
    b.wall(P, 'x', -13, -6, 1.5, y, top, TI)
    b.wall(P, 'z', -0.5, -13, -18, y, top, TI, [dict(a0=-13.08, a1=-13.95, y1=2.2)])
    b.wall(P, 'x', -14, -0.5, 6, y, top, TI, [dict(a0=0.6, a1=1.5, y1=2.2), dict(a0=4.2, a1=5.1, y1=2.2)])
    b.wall(P, 'z', 3.2, -14, -18, y, top, TI)
    b.box(M['bathTile'], -6, y, -8, -1.5, y + 0.01, -13, floor=True, collide=False)
    b.box(M['bathTile'], -0.5, y, -14, 3.2, y + 0.01, -18, floor=True, collide=False)

    b.tag('CauThang')
    railing(b, M, 'z', 3.2, -7, -12.6, y)
    railing(b, M, 'x', -7, 3.2, 5.9, y)
    stairs(b, M, 3.25, 4.5, -12.6, -7, y, L3, 17)
    b.sloped(M['glass'], 4.49, 4.51, -12.6, y, -7, L3, 1.0, cast=False)
    b.sloped(M['steel'], 4.47, 4.53, -12.6, y + 1.0, -7, L3 + 1.0, 0.04, collide=False)

    b.lamp(-2.5, top - 0.3, -4, 12, 9)
    b.lamp(3.8, top - 0.3, -5, 10, 7)
    b.lamp(3.5, top - 0.3, -1.4, 10, 7)
    b.lamp(-3, top - 0.3, -15.5, 9, 7)
    b.lamp(-3.5, top - 0.3, -10.5, 6, 6)


def level3(b, M):
    y, top = L3, ROOF
    b.level('l3')
    P = M['plaster']
    knee = roofY(-1.5)

    b.tag('San')
    b.slab(-6, -0.3, 1.5, -7, y, 0.3, M['woodFloor'], M['ceiling'])
    b.slab(1.5, 0.3, 6, -7, y, 0.3, M['woodFloor'], M['ceiling'])
    b.slab(-6, -7, 3.2, -12.6, y, 0.3, M['woodFloor'], M['ceiling'])
    b.slab(-6, -12.6, 6, -18, y, 0.3, M['woodFloor'], M['ceiling'])
    b.box(M['frame'], 1.5, y - 0.35, 0.3, 5.6, y + 0.05, 0.36, collide=False)

    b.tag('DauHoi')
    gable(b, M, 0, y - 0.3, [])
    gable(b, M, -17.7, y - 0.3, [(-1.1, 7.6, 1.1, 9.8)])
    b.box(M['concrete'], -6.125, y, -0.3, -5.875, roofY(-6), -17.7)

    b.tag('HopPhongNgu')
    b.box(M['deck'], 1.5, y, 0.3, 5.6, y + 0.03, -1.2, floor=True, collide=False)
    for i in range(5):
        fin = b.box(M['timberV'], -0.13, 0, -0.025, 0.13, 2.65, 0.025)
        fin.matrix_basis = conv(trs((1.85 + i * 0.32, y + 0.05 + 1.325, 0.15), (0, 0.95, 0)))
    x = 3.4
    while x < 5.6:
        b.box(M['steel'], x, y, 0.14, x + 0.02, y + 1.1, 0.16, collide=False)
        x += 0.12
    b.box(M['steel'], 3.35, y + 1.08, 0.12, 5.6, y + 1.12, 0.18, collide=False)
    b.box(M['invisible'], 1.5, y, 0.1, 5.6, y + 1.1, 0.2, cast=False)
    b.box(M['frame'], 1.5, top - 0.5, 0, 5.6, top + 0.3, 0.3)
    b.wall(None, 'z', 1.5, 0.3, -1.2, y, top, TE, [], outer=M['concrete'], out=1)
    b.glass_pane('x', -1.2, 1.5, 3.6, y, top - 0.5)
    sliding_glass(b, 'CuaBanCongT3', 'x', -1.12, 3.6, 5.6, y, top - 0.5, -1.9)
    b.box(M['frame'], 1.5, top - 0.5, -1.25, 5.6, top, -1.15)

    b.tag('Tuong')
    b.wall(None, 'z', 6, -5, -14, y, top, TE, [dict(a0=-8, a1=-10, y0=1.0, y1=2.4, glass=True)], outer=M['concrete'], out=1)
    b.wall(P, 'z', -1.5, -0.3, -17.7, y, knee, TI)
    b.wall(P, 'z', 1.5, -1.2, -5, y, top, TI, [dict(a0=-3.6, a1=-4.5, y1=2.2)])
    b.wall(P, 'x', -5, -1.5, 5.6, y, top, TI, [dict(a0=3.6, a1=4.5, y1=2.2)])
    b.wall(P, 'x', -7, -1.5, 3.2, y, top, TI, [dict(a0=1.0, a1=1.9, y1=2.2)])
    b.wall(P, 'z', 3.2, -7, -14, y, top, TI, [dict(a0=-12.8, a1=-13.7, y1=2.2)])
    b.box(M['bathTile'], -1.5, y, -0.3, 1.5, y + 0.01, -5, floor=True, collide=False)

    b.tag('CauThang')
    railing(b, M, 'x', -7, 4.5, 5.9, y)
    railing(b, M, 'x', -12.6, 3.2, 5.9, y)

    b.tag('SanThuong')
    b.glass_pane('x', -14, 1.5, 3.6, y, top)
    sliding_glass(b, 'CuaSanThuong', 'x', -13.92, 3.6, 5.4, y, top, -1.8)
    b.box(M['glass'], 5.4, y, -14.01, 6, top, -13.99, cast=False)
    b.wall(None, 'z', 1.5, -14, -18, y, PEAK, TE, [dict(a0=-15, a1=-16.6, y1=2.6)], outer=M['concrete'], out=1)
    sliding_glass(b, 'CuaGiaDinhT3', 'z', 1.5, -15, -16.6, y, y + 2.6, 1.4)
    b.box(M['deck'], 1.6, y, -14, 6, y + 0.03, -18, floor=True, collide=False)
    railing(b, M, 'x', -18, 1.6, 6, y)
    railing(b, M, 'z', 6, -14, -18, y)

    b.lamp(3.6, top - 0.3, -3, 10, 7)
    b.lamp(0.2, top - 0.3, -10.5, 10, 8)
    b.lamp(0, 9.5, -16, 8, 7)
    b.lamp(0, 9.4, -2.5, 6, 5)


def roof(b, M):
    b.level('roof')
    b.tag('MaiDoc')
    x0, y0, x1, y1, t = -6.6, roofY(-6.6), 1.5, PEAK, 0.3
    ln, ang = math.hypot(x1 - x0, y1 - y0), math.atan2(y1 - y0, x1 - x0)
    c = M['concrete']
    mats = [c, c, M['roofMetal'], M['ceiling'], c, c]
    name = b.next_name(b.tag_name)
    pos = ((x0 + x1) / 2 - math.sin(ang) * t / 2, (y0 + y1) / 2 + math.cos(ang) * t / 2, -9)
    b.obj(name, mesh_box(name, ln, t, 18.6, mats), mats, trs(pos, (0, 0, ang)))
    b.box(M['soffit'], -6.75, y0 - 0.35, 0.3, -6.6, y0 + 0.2, -18.3, collide=False)

    b.tag('MaiBang')
    b.box([c, c, M['concrete'], M['ceiling'], c, c], 1.5, ROOF, 0.3, 6, ROOF + 0.3, -14)
    for i in range(4):
        yy = ROOF + 0.38 + i * 0.12
        b.box(M['steel'], 1.5, yy, 0.22, 5.6, yy + 0.05, 0.3, collide=False)
    b.box(M['concrete'], 1.2, ROOF, 0.3, 1.5, PEAK, -14)
    b.box(M['frame'], 1.5, ROOF + 0.3, -14, 6, ROOF + 0.85, -13.9)


# ================================================================ SÂN ===
def build_site(b, M):
    b.level('site')
    rnd = make_rng(1)
    b.tag('Nen')
    b.box(M['grass'], -70, -0.25, 60, 70, -0.05, -70, floor=True, collide=False, cast=False)
    b.box(M['asphalt'], -70, -0.2, 16, 70, -0.04, 8.7, floor=True, collide=False, cast=False)
    b.box(M['render'], -70, -0.2, 8.7, 70, 0.1, 7.6, floor=True, collide=False, cast=False)
    b.box(M['asphalt'], -4.3, -0.2, 8.7, 3.6, 0.0, 7.4, floor=True, collide=False, cast=False)
    x = -68
    while x < 70:
        b.box(M['render'], x, -0.04, 12.45, x + 3, -0.03, 12.25, collide=False, cast=False)
        x += 6
    b.box(M['paving'], -6, -0.3, 7.4, 6, 0, -4, floor=True, collide=False, cast=False)
    b.box(M['paving'], 6, -0.3, 7.4, 7.5, 0, -18, floor=True, collide=False, cast=False)

    b.tag('HangRao')
    zf, fh = 7.2, 1.75
    b.box(M['stone'], -7.5, 0, zf - 0.25, -6.95, 1.95, zf + 0.25)
    b.box(M['stone'], 6.75, 0, zf - 0.25, 7.5, 1.95, zf + 0.25)
    b.box(M['stone'], 3.4, 0, zf - 0.2, 3.65, fh + 0.05, zf + 0.2)
    b.box(M['stone'], -4.55, 0, zf - 0.2, -4.3, fh + 0.05, zf + 0.2)
    b.box(M['timberH'], -6.95, 0.1, zf - 0.06, -4.55, fh, zf + 0.06)
    b.box(M['timberH'], 3.65, 0.1, zf - 0.06, 6.75, fh, zf + 0.06)
    leafL = b.empty('DOOR_Cong_Trai')
    leafR = b.empty('DOOR_Cong_Phai')
    b.box(M['timberH'], -4.3, 0.06, zf + 0.12, -0.35, fh - 0.05, zf + 0.22, parent=leafL)
    b.box(M['timberH'], -0.35, 0.06, zf + 0.12, 3.4, fh - 0.05, zf + 0.22, parent=leafR)
    b.door(leafL, 'slide', move_three=(-3.6, 0, 0))
    b.door(leafR, 'slide', move_three=(3.3, 0, 0))
    # cổng mặc định mở như ảnh và như web
    leafL.location += blender_vec(-3.6, 0, 0)
    leafR.location += blender_vec(3.3, 0, 0)
    leafL['is_open'] = leafR['is_open'] = True  # web: vị trí đóng = vị trí hiện tại - move_three
    wh = 2.0
    b.box(M['render'], -7.6, 0, 7.0, -7.4, wh, -27)
    b.box(M['render'], 7.4, 0, 7.0, 7.6, wh, -27)
    b.box(M['render'], -7.6, 0, -26.9, 7.6, wh, -27.1)

    b.tag('HoBoi')
    b.box(M['stone'], -6, -0.3, -18, 6, 0, -19.6, floor=True, collide=False, cast=False)
    px0, px1, pz0, pz1, c = -5, 3, -20.5, -24.5, 0.35
    b.box(M['stone'], px0 - c, -0.3, pz0 + c, px1 + c, 0.03, pz0, floor=True, collide=False)
    b.box(M['stone'], px0 - c, -0.3, pz1, px1 + c, 0.03, pz1 - c, floor=True, collide=False)
    b.box(M['stone'], px0 - c, -0.3, pz0, px0, 0.03, pz1, floor=True, collide=False)
    b.box(M['stone'], px1, -0.3, pz0, px1 + c, 0.03, pz1, floor=True, collide=False)
    b.box(M['poolTile'], px0, -1.4, pz0, px1, -1.3, pz1, collide=False)
    b.box(M['poolTile'], px0, -1.4, pz0, px1, 0, pz0 - 0.02, collide=False)
    b.box(M['poolTile'], px0, -1.4, pz1 + 0.02, px1, 0, pz1, collide=False)
    b.box(M['poolTile'], px0, -1.4, pz0, px0 + 0.02, 0, pz1, collide=False)
    b.box(M['poolTile'], px1 - 0.02, -1.4, pz0, px1, 0, pz1, collide=False)
    b.box(M['water'], px0, -0.14, pz0, px1, -0.12, pz1, collide=False, cast=False)
    b.box(M['invisible'], px0, -0.3, pz0, px1, 1.2, pz1, cast=False)
    for x in (4.2, 5.4):
        b.box(M['whiteGloss'], x - 0.32, 0.25, -20.8, x + 0.32, 0.35, -22.8)
        back = b.box(M['whiteGloss'], -0.32, -0.05, -0.4, 0.32, 0.05, 0.4)
        back.matrix_basis = conv(trs((x, 0.52, -20.95), (-0.9, 0, 0)))

    trees = [(-10.5, 2.5, 1.25), (-9.2, -5, 1.1), (-11, -14, 1.3), (9.8, 5.2, 1.15),
             (-5.6, -25.5, 0.9), (5.8, -25.6, 0.85), (-6.8, 4.8, 0.55), (-6.8, -21, 0.6)]
    for (x, z, s) in trees:
        g = Grp('Cay')
        g.cyl(M['trunk'], 0.12 * s, 3.2 * s, 0, 0, 0, seg=8, rb=0.2 * s)
        for i in range(9):
            a = (i / 9) * PI * 2
            r = 0 if i == 0 else 1.1 + rnd() * 0.6
            py = (3.6 + rnd() * 1.4) * s
            sc = (1.0 + rnd() * 0.6) * s
            rec = g.ico(M['leaf2'] if i % 3 == 0 else M['leaf'], noCollide=True)
            rec['pos'] = (math.cos(a) * r * s, py, math.sin(a) * r * s)
            rec['scl'] = (sc, sc, sc)
        b.add_group(g, (x, 0, z))

    def shrub(x, z, s):
        mat = M['leaf'] if rnd() > 0.5 else M['leaf2']
        name = b.next_name('Bui')
        b.obj(name, mesh_ico(name, s, mat), mat, trs((x, s * 0.7, z), (0, 0, 0), (1, 0.8, 1)), collide=False)

    z = -5
    while z > -17:
        shrub(-6.8, z, 0.45)
        z -= 1.4
    x = -6.5
    while x < 7:
        shrub(x, -26.4, 0.55)
        x += 1.3

    b.tag('NhaBen')
    b.box(M['render'], 8.2, 0, 4, 21, 6.6, -14)
    b.box(M['frame'], 8.1, 3.3, 4.05, 21, 3.45, -14)
    x = 9.2
    while x < 20:
        b.box(M['glass'], x, 4.2, 4.02, x + 1.4, 5.9, 4.05, collide=False, cast=False)
        b.box(M['glass'], x, 1.0, 4.02, x + 1.4, 2.6, 4.05, collide=False, cast=False)
        x += 2.4
    name = b.next_name(b.tag_name)
    me = mesh_cyl(name, 0.0, 1.0, 1.0, 4, M['roofTile'])
    b.obj(name, me, M['roofTile'], trs((14.6, 6.6 + 1.3, -5), (0, PI / 4, 0), (9.8, 2.6, 13.6)))
    b.box(M['roofTile'], 7.6, 3.5, 4.8, 21, 3.7, 3.4, collide=False)
    b.box(M['render'], -48, 0, -25, -34, 34, -45)
    b.box(M['render'], 26, 0, -30, 40, 22, -44)


# ============================================================ NỘI THẤT ===
def furnish(b, M):
    rnd = make_rng(3)
    P = PI

    def place(g, x, y, z, rot=0.0, collide=True, cast=True):
        return b.add_group(g, (x, y, z), rot, collide=collide, cast=cast)

    def sofa(w=2.6, d=0.95, mat=None):
        mat = mat or M['fabricLight']
        g = Grp('Sofa')
        g.part(M['walnut'], -w / 2, 0, -d / 2, w / 2, 0.12, d / 2)
        g.part(mat, -w / 2, 0.12, -d / 2, w / 2, 0.45, d / 2)
        g.part(mat, -w / 2, 0.45, -d / 2, w / 2, 0.85, -d / 2 + 0.22)
        g.part(mat, -w / 2, 0.45, -d / 2, -w / 2 + 0.2, 0.65, d / 2)
        g.part(mat, w / 2 - 0.2, 0.45, -d / 2, w / 2, 0.65, d / 2)
        for i in range(3):
            x = -w / 2 + 0.45 + i * ((w - 0.9) / 2)
            g.part(M['fabricAccent'], x - 0.22, 0.45, -d / 2 + 0.22, x + 0.22, 0.85, -d / 2 + 0.36, noCollide=True)
        return g

    def table(w, d, h, top=None, leg=None):
        top, leg = top or M['walnut'], leg or M['black']
        g = Grp('Ban')
        g.part(top, -w / 2, h - 0.05, -d / 2, w / 2, h, d / 2)
        for sx in (-1, 1):
            for sz in (-1, 1):
                g.part(leg, sx * (w / 2 - 0.08) - 0.025, 0, sz * (d / 2 - 0.08) - 0.025,
                       sx * (w / 2 - 0.08) + 0.025, h - 0.05, sz * (d / 2 - 0.08) + 0.025, noCollide=True)
        return g

    def chair(mat=None):
        mat = mat or M['oak']
        g = Grp('Ghe')
        g.part(mat, -0.22, 0.44, -0.22, 0.22, 0.48, 0.22)
        g.part(mat, -0.22, 0.48, -0.22, 0.22, 0.9, -0.18)
        for sx in (-1, 1):
            for sz in (-1, 1):
                g.part(M['black'], sx * 0.19 - 0.015, 0, sz * 0.19 - 0.015, sx * 0.19 + 0.015, 0.44, sz * 0.19 + 0.015)
        return g

    def lamp_on(g, x, y, z):
        g.cyl(M['black'], 0.015, 0.3, x, y, z)
        g.cyl(M['lightWarm'], 0.12, 0.18, x, y + 0.3, z, noCollide=True)

    def bed(w=1.9, l=2.1):
        g = Grp('Giuong')
        g.part(M['walnut'], -w / 2 - 0.05, 0, -l / 2, w / 2 + 0.05, 0.3, l / 2)
        g.part(M['bedding'], -w / 2, 0.3, -l / 2 + 0.05, w / 2, 0.55, l / 2)
        g.part(M['fabricAccent'], -w / 2 - 0.02, 0.5, l / 2 - 0.65, w / 2 + 0.02, 0.58, l / 2 - 0.2, noCollide=True)
        g.part(M['fabricDark'], -w / 2 - 0.2, 0, -l / 2 - 0.08, w / 2 + 0.2, 1.15, -l / 2)
        for sx in (-1, 1):
            g.part(M['whiteGloss'], sx * w / 4 - 0.3, 0.55, -l / 2 + 0.1, sx * w / 4 + 0.3, 0.68, -l / 2 + 0.5, noCollide=True)
        for sx in (-1, 1):
            g.part(M['walnut'], sx * (w / 2 + 0.55) - 0.25, 0, -l / 2, sx * (w / 2 + 0.55) + 0.25, 0.5, -l / 2 + 0.42)
            lamp_on(g, sx * (w / 2 + 0.55), 0.5, -l / 2 + 0.2)
        return g

    def floor_lamp():
        g = Grp('DenSan')
        g.cyl(M['black'], 0.15, 0.03, 0, 0, 0)
        g.cyl(M['black'], 0.015, 1.5, 0, 0, 0)
        g.cyl(M['lightWarm'], 0.2, 0.28, 0, 1.45, 0)
        return g

    def cabinet(w, h, d, mat=None, top=None, typ='Tu'):
        mat = mat or M['walnut']
        g = Grp(typ)
        g.part(mat, -w / 2, 0, -d / 2, w / 2, h, d / 2)
        if top:
            g.part(top, -w / 2 - 0.02, h, -d / 2 - 0.02, w / 2 + 0.02, h + 0.04, d / 2 + 0.02)
        n = max(1, js_round(w / 0.6))
        for i in range(1, n):
            g.part(M['black'], -w / 2 + (w * i) / n - 0.004, 0.05, d / 2, -w / 2 + (w * i) / n + 0.004, h - 0.05, d / 2 + 0.005, noCollide=True)
        return g

    def tv(w=1.6):
        g = Grp('TV')
        g.part(M['screen'], -w / 2, 0, -0.03, w / 2, w * 0.5625, 0.03)
        return g

    def plant(s=1.0):
        g = Grp('Chau')
        g.cyl(M['pot'], 0.22 * s, 0.45 * s, 0, 0, 0)
        for i in range(5):
            rec = g.ico(M['leaf'] if i % 2 else M['leaf2'], noCollide=True)
            px = (rnd() - 0.5) * 0.4 * s
            py = (0.75 + rnd() * 0.6) * s
            pz = (rnd() - 0.5) * 0.4 * s
            sc = (0.22 + rnd() * 0.12) * s
            rec['pos'] = (px, py, pz)
            rec['scl'] = (sc, sc, sc)
        return g

    def rug(w, d, mat=None):
        g = Grp('Tham')
        g.part(mat or M['fabricDark'], -w / 2, 0, -d / 2, w / 2, 0.015, d / 2)
        return g

    def shelf(w, h, d=0.35, books=True):
        g = Grp('KeSach')
        g.part(M['oak'], -w / 2, 0, -d / 2, w / 2, h, -d / 2 + 0.02)
        g.part(M['oak'], -w / 2, 0, -d / 2, -w / 2 + 0.03, h, d / 2)
        g.part(M['oak'], w / 2 - 0.03, 0, -d / 2, w / 2, h, d / 2)
        rows = math.floor(h / 0.38)
        for r in range(rows + 1):
            y = r * (h / rows)
            g.part(M['oak'], -w / 2, y, -d / 2, w / 2, y + 0.025, d / 2, noCollide=True)
            if not books or r == rows:
                continue
            x = -w / 2 + 0.05
            while x < w / 2 - 0.1:
                bw = 0.025 + rnd() * 0.03
                bh = 0.2 + rnd() * 0.1
                ci = int(rnd() * 6)
                g.part(M['book_%d' % ci], x, y + 0.025, -d / 2 + 0.04, x + bw, y + 0.025 + bh, d / 2 - 0.05, noCollide=True)
                x += bw + 0.004 + (0.12 if rnd() < 0.08 else 0)
        return g

    def toilet():
        g = Grp('BonCau')
        g.part(M['whiteGloss'], -0.19, 0, -0.35, 0.19, 0.4, 0.3)
        g.part(M['whiteGloss'], -0.2, 0.4, -0.35, 0.2, 0.8, -0.2)
        return g

    def vanity(w=1.2):
        g = Grp('Lavabo')
        g.part(M['walnut'], -w / 2, 0.35, -0.25, w / 2, 0.82, 0.25)
        g.part(M['marble'], -w / 2, 0.82, -0.26, w / 2, 0.86, 0.26)
        g.part(M['whiteGloss'], -0.2, 0.86, -0.15, 0.2, 0.92, 0.15, noCollide=True)
        g.part(M['screen'], -w / 2, 1.1, -0.27, w / 2, 1.9, -0.25, noCollide=True)
        return g

    def tub():
        g = Grp('BonTam')
        g.part(M['whiteGloss'], -0.85, 0, -0.4, 0.85, 0.55, 0.4)
        g.part(M['water'], -0.75, 0.4, -0.3, 0.75, 0.56, 0.3, noCollide=True)
        return g

    def shower(w=1.0, d=1.0):
        g = Grp('Sen')
        g.part(M['stone'], -w / 2, 0, -d / 2, w / 2, 0.02, d / 2, noCollide=True)
        g.part(M['glass'], -w / 2, 0, d / 2 - 0.01, w / 2 - 0.4, 2.0, d / 2 + 0.01)
        g.cyl(M['steel'], 0.12, 0.02, 0, 2.1, -d / 2 + 0.2)
        return g

    def car():
        g = Grp('Xe')
        g.part(M['carPaint'], -0.9, 0.3, -2.35, 0.9, 0.85, 2.35)
        g.part(M['carPaint'], -0.82, 0.85, -1.2, 0.82, 1.38, 1.0)
        g.part(M['screen'], -0.83, 0.92, 1.0, 0.83, 1.3, 1.05, noCollide=True)
        g.part(M['screen'], -0.84, 0.92, -1.1, 0.84, 1.3, 0.9, noCollide=True)
        g.part(M['lightWarm'], -0.8, 0.6, 2.35, -0.5, 0.7, 2.37, noCollide=True)
        g.part(M['lightWarm'], 0.5, 0.6, 2.35, 0.8, 0.7, 2.37, noCollide=True)
        for sx in (-1, 1):
            for sz in (-1.45, 1.45):
                rec = g.cyl(M['rubber'], 0.33, 0.24, 0, 0, 0, noCollide=True)
                rec['pos'] = (sx * 0.82, 0.33, sz)
                rec['rot'] = (0, 0, PI / 2)
        return g

    def lounger():
        g = Grp('GheNam')
        g.part(M['oak'], -0.33, 0.2, -0.95, 0.33, 0.3, 0.95)
        g.part(M['fabricLight'], -0.3, 0.3, -0.4, 0.3, 0.38, 0.92)
        back = g.part(M['fabricLight'], -0.3, -0.04, -0.3, 0.3, 0.04, 0.3)
        back['pos'] = (0, 0.55, -0.7)
        back['rot'] = (-0.9, 0, 0)
        return g

    def pendant(drop=0.9):
        g = Grp('DenTha')
        g.cyl(M['black'], 0.005, drop, 0, -drop, 0)
        s = g.sphere(M['lightWarm'], 0.14)
        s['pos'] = (0, -drop - 0.1, 0)
        return g

    def art(w, h, mat):
        g = Grp('Tranh')
        g.part(M['black'], -w / 2 - 0.03, -0.03, -0.02, w / 2 + 0.03, h + 0.03, 0)
        g.part(mat, -w / 2, 0, 0, w / 2, h, 0.01)
        return g

    def wardrobe(w, h=2.4):
        return cabinet(w, h, 0.6, M['oak'], typ='TuQuanAo')

    def boxes():
        g = Grp('Thung')
        for i in range(6):
            s = 0.35 + rnd() * 0.25
            g.part(M['oak'], -s / 2 + i * 0.6 - 1.5, 0, -s / 2, s / 2 + i * 0.6 - 1.5, s, s / 2)
        return g

    # TẦNG 1
    b.level('g')
    place(car(), -0.6, 0, 1.7, 0)
    place(cabinet(2.6, 0.45, 0.42, M['walnut']), -1.3, 0, -4.4)
    place(tv(1.9), -1.3, 1.05, -4.2)
    place(rug(3.4, 2.4), -1.6, 0, -6.6, 0, collide=False)
    place(sofa(2.9), -1.4, 0, -8.2, 0)
    place(sofa(1.8, 0.9, M['fabricDark']), -4.6, 0, -6.6, P / 2)
    place(table(1.2, 0.6, 0.38), -1.4, 0, -6.5)
    place(floor_lamp(), 0.6, 0, -8.6)
    place(plant(1.3), -5.4, 0, -4.6)
    place(plant(1), 0.9, 0, -4.6)
    place(table(2.2, 1.0, 0.76, M['oak']), -2.6, 0, -12)
    for dx in (-0.7, 0, 0.7):
        place(chair(), -2.6 + dx, 0, -12.75, 0)
        place(chair(), -2.6 + dx, 0, -11.25, P)
    for dx in (-0.6, 0, 0.6):
        place(pendant(1.4), -2.6 + dx, 3.6, -12, 0, collide=False, cast=False)
    place(cabinet(2.4, 0.85, 0.45, M['walnut'], M['marble']), -5.7, 0, -12, P / 2)
    place(art(1.4, 0.9, M['art1']), -5.85, 1.5, -12, P / 2, collide=False)
    place(cabinet(3.6, 0.88, 0.6, M['whiteGloss'], M['marble']), 5.6, 0, -16, -P / 2)
    place(cabinet(3.6, 0.7, 0.35, M['whiteGloss']), 5.75, 1.5, -16, -P / 2)
    place(cabinet(0.9, 2.2, 0.65, M['black']), 5.55, 0, -14.4, -P / 2)
    place(cabinet(2.6, 0.9, 1.0, M['walnut'], M['marble']), 1.8, 0, -15.8)
    for dx in (-0.8, 0, 0.8):
        s = Grp('GheDon')
        s.cyl(M['black'], 0.02, 0.62, 0, 0, 0)
        s.cyl(M['fabricDark'], 0.19, 0.06, 0, 0.62, 0)
        place(s, 1.8 + dx, 0, -15.0)
    for dx in (-0.7, 0.7):
        place(pendant(1.1), 1.8 + dx, 3.6, -15.8, 0, collide=False, cast=False)
    place(table(1.6, 0.9, 0.74, M['oak']), -3.5, 0, -16.2)
    for dx in (-0.45, 0.45):
        place(chair(), -3.5 + dx, 0, -16.9, 0)
        place(chair(), -3.5 + dx, 0, -15.5, P)
    place(cabinet(1.6, 0.9, 0.38, M['oak']), 3.9, 0, -6.75, 0)
    place(art(0.9, 1.2, M['art2']), 3.9, 1.3, -6.92, 0, collide=False)
    place(plant(0.9), 5.6, 0, -4.5)
    place(toilet(), 2.35, 0, -9.55, 0)
    place(vanity(0.8), 1.85, 0, -8.3, P / 2)
    place(shelf(1.2, 2.2, 0.45, False), 2.35, 0, -12.7, 0)

    # TẦNG 2
    y2 = 3.9
    b.level('l2')
    place(bed(1.9, 2.1), -3.3, y2, -6.85, 0)
    place(rug(3.2, 2.2), -3.3, y2, -5.3, 0, collide=False)
    place(cabinet(2.2, 0.5, 0.4, M['walnut']), -3.3, y2, -0.55, P)
    place(tv(1.5), -3.3, y2 + 1.0, -0.38, P)
    place(sofa(1.0, 0.85, M['fabricAccent']), 0.6, y2, -2.4, -P / 2)
    place(plant(1.1), 0.9, y2, -0.6)
    place(art(1.6, 1.0, M['art1']), -5.85, y2 + 1.3, -6.5, P / 2, collide=False)
    place(wardrobe(4.6), -1.15, y2, -10.5, P / 2)
    place(wardrobe(4.6), 1.15, y2, -10.5, -P / 2)
    place(tub(), -4.6, y2, -12.4, 0)
    place(vanity(1.8), -5.65, y2, -9.8, P / 2)
    place(shower(1.1, 1.1), -2.2, y2, -8.7, P)
    place(toilet(), -2.1, y2, -12.55, 0)
    place(sofa(2.4, 0.9, M['fabricDark']), 3.7, y2, -6.4, 0)
    place(table(0.9, 0.5, 0.4), 3.7, y2, -5.2)
    place(lounger(), 2.4, y2, -1.4, 0)
    place(lounger(), 3.4, y2, -1.4, 0)
    place(plant(1.2), 5.1, y2, -0.1)
    place(art(1.0, 1.4, M['art2']), 1.58, y2 + 1.1, -10.5, P / 2, collide=False)
    place(bed(1.6, 2.0), -3.4, y2, -16.7, 0)
    place(table(1.2, 0.6, 0.75, M['oak']), -5.6, y2, -16.6, P / 2)
    place(chair(), -5.0, y2, -16.6, -P / 2)
    place(wardrobe(2.0), -1.0, y2, -16.6, -P / 2)
    place(vanity(1.0), 0.2, y2, -17.6, 0)
    place(toilet(), 1.4, y2, -17.55, 0)
    place(shower(1.1, 1.2), 2.55, y2, -17.3, 0)
    place(cabinet(1.3, 0.88, 0.6, M['whiteGloss'], M['marble']), 4.6, y2, -17.6, 0)
    place(cabinet(0.6, 0.85, 0.6, M['whiteGloss']), 5.6, y2, -15.5, -P / 2)

    # TẦNG 3
    y3 = 7.2
    b.level('l3')
    place(bed(1.8, 2.1), 4.45, y3, -3.0, -P / 2)
    place(rug(2.6, 1.6), 3.3, y3, -3.0, P / 2, collide=False)
    place(chair(M['walnut']), 2.2, y3, -0.6, 0)
    place(chair(M['walnut']), 3.0, y3, -0.6, 0)
    place(table(0.5, 0.5, 0.45), 2.6, y3, -0.65)
    place(tub(), 0, y3, -0.8, P)
    place(vanity(1.4), -1.25, y3, -3.2, P / 2)
    place(toilet(), 0.9, y3, -4.55, 0)
    place(shelf(5.6, 2.3), -1.25, y3, -10.3, P / 2)
    place(table(1.6, 0.8, 0.75, M['walnut']), 1.4, y3, -9.5)
    place(chair(M['walnut']), 1.4, y3, -10.2, 0)
    place(sofa(1.0, 0.85, M['fabricAccent']), 2.5, y3, -12.3, -P / 2)
    place(floor_lamp(), 2.7, y3, -11.3)
    place(sofa(2.4), 0, y3, -17.3, 0)
    place(rug(2.6, 1.8, M['fabricAccent']), 0, y3, -15.9, 0, collide=False)
    place(table(1.0, 0.6, 0.38), 0, y3, -15.9)
    place(lounger(), 3.0, y3, -16.6, P)
    place(lounger(), 4.2, y3, -16.6, P)
    place(plant(1.3), 5.5, y3, -17.4)
    place(plant(1.0), 2.0, y3, -17.5)
    place(boxes(), -4, y3, -9, P / 2)


# =========================================================== MÔI TRƯỜNG ===
TIMES = {
    'ban_ngay': dict(elev=40, azim=215, sun=3.0, sky=0.35, lamps=0.15, glow=0.4, exposure=0.0),
    'hoang_hon': dict(elev=1.2, azim=245, sun=1.2, sky=0.6, lamps=1.0, glow=2.6, exposure=0.6),
}


def setup_world(scene, b, M, mode):
    t = TIMES[mode]
    phi, theta = math.radians(90 - t['elev']), math.radians(t['azim'])
    d3 = (math.sin(phi) * math.sin(theta), math.cos(phi), math.sin(phi) * math.cos(theta))
    dB = blender_vec(*d3)  # hướng tới mặt trời (Blender)

    world = bpy.data.worlds.get(SCENE_NAME) or bpy.data.worlds.new(SCENE_NAME)
    if bpy.app.version < (5, 0, 0):
        world.use_nodes = True
    nt = world.node_tree
    nt.nodes.clear()
    out = nt.nodes.new('ShaderNodeOutputWorld')
    bg = nt.nodes.new('ShaderNodeBackground')
    sky = nt.nodes.new('ShaderNodeTexSky')
    for st in ('MULTIPLE_SCATTERING', 'SINGLE_SCATTERING', 'NISHITA'):
        try:
            sky.sky_type = st
            break
        except Exception:
            pass
    for attr, val in (('sun_elevation', math.radians(t['elev'])),
                      ('sun_rotation', math.atan2(dB.x, dB.y) % (2 * PI)),
                      ('sun_disc', True)):
        try:
            setattr(sky, attr, val)
        except Exception:
            pass
    bg.inputs['Strength'].default_value = t['sky']
    nt.links.new(sky.outputs[0], bg.inputs[0])
    nt.links.new(bg.outputs[0], out.inputs[0])
    scene.world = world

    sd = bpy.data.lights.get('MatTroi') or bpy.data.lights.new('MatTroi', 'SUN')
    sd.energy = t['sun']
    sd.color = hexcol('#ffb27a' if mode == 'hoang_hon' else '#fff4e6')[:3]
    sd.angle = math.radians(1.0)
    sun = bpy.data.objects.new('MatTroi', sd)
    b.root.objects.link(sun)
    dsun = Vector((dB.x, dB.y, max(dB.z, 0.25))).normalized()
    sun.rotation_mode = 'QUATERNION'
    sun.rotation_quaternion = (-dsun).to_track_quat('-Z', 'Y')

    for ob in b.lamps:
        ob.data.energy *= t['lamps']
    _set(_bsdf(M['lightWarm']), 'Emission Strength', t['glow'])
    scene.view_settings.exposure = t['exposure']


def add_cameras(b, scene):
    def cam(name, pos3, target3, lens=32):
        cd = bpy.data.cameras.new(name)
        cd.lens = lens
        cd.clip_start = 0.05
        cd.clip_end = 500
        ob = bpy.data.objects.new(name, cd)
        b.root.objects.link(ob)
        p, t = blender_vec(*pos3), blender_vec(*target3)
        ob.location = p
        ob.rotation_mode = 'QUATERNION'
        ob.rotation_quaternion = (t - p).to_track_quat('-Z', 'Y')
        return ob
    main = cam('Cam_MatTien', (0.8, 2.4, 19.5), (0.3, 5.9, -3), 30)
    cam('Cam_GocTrai', (-14, 5, 20), (0, 5, -6), 30)
    cam('Cam_PhongKhach', (-0.3, 1.6, -9.7), (-3, 1.2, -5), 20)
    cam('Cam_TrenCao', (-2, 24, 5), (0, 3.9, -9.5), 28)
    scene.camera = main


# ================================================================ CHẠY ===
def clear_previous():
    old = bpy.data.scenes.get(SCENE_NAME)
    if not old:
        return
    def walk(col):
        for ob in list(col.objects):
            bpy.data.objects.remove(ob, do_unlink=True)
        for ch in list(col.children):
            walk(ch)
            bpy.data.collections.remove(ch)
    walk(old.collection)
    bpy.data.scenes.remove(old)
    for coll in (bpy.data.meshes, bpy.data.lights, bpy.data.cameras):
        for d in list(coll):
            if d.users == 0:
                coll.remove(d)


LEVELS = ('g', 'l2', 'l3', 'roof', 'site')
NO_LIGHTMAP = {'glass', 'water', 'invisible', 'leafInstanced'}  # kính/nước/dây leo: không cần lightmap


def level_col(scene, lv):
    # tên có thể bị Blender thêm đuôi .001 nếu file đã có collection trùng tên
    for c in scene.collection.children_recursive:
        if c.name.split('.')[0] == lv:
            return c


def lightmap_meshes(col):
    if col is None:
        return []
    out = []
    for o in col.all_objects:
        if o.type != 'MESH' or o.hide_render:
            continue
        names = {m.name for m in o.data.materials if m}
        if names and names <= NO_LIGHTMAP:
            continue
        out.append(o)
    return out


def _ops_context(scene, meshes):
    vl = scene.view_layers[0]
    for o in vl.objects:
        o.select_set(False, view_layer=vl)
    for o in meshes:
        o.select_set(True, view_layer=vl)
    vl.objects.active = meshes[0]
    ctx = dict(scene=scene, view_layer=vl, active_object=meshes[0], object=meshes[0],
               selected_objects=meshes, selected_editable_objects=meshes)
    if bpy.context.window:
        ctx['window'] = bpy.context.window
    return ctx


def make_lightmap_uv(scene, levels=LEVELS):
    """UV thứ hai 'Lightmap': mỗi tầng (collection) dùng chung một atlas 0..1."""
    for lv in levels:
        meshes = lightmap_meshes(level_col(scene, lv))
        if not meshes:
            continue
        for o in meshes:
            uvs = o.data.uv_layers
            if 'Lightmap' not in uvs:
                uvs.new(name='Lightmap')
            uvs['Lightmap'].active = True
            uvs['UVMap'].active_render = True
        with bpy.context.temp_override(**_ops_context(scene, meshes)):
            bpy.ops.object.mode_set(mode='EDIT')
            bpy.ops.mesh.select_all(action='SELECT')
            bpy.ops.uv.smart_project(angle_limit=math.radians(66), island_margin=0.003, scale_to_bounds=False)
            bpy.ops.object.mode_set(mode='OBJECT')
        for o in meshes:
            o.data.uv_layers['UVMap'].active = True
        print('UV lightmap: %s (%d mesh)' % (lv, len(meshes)))


def bake_lightmaps(scene, out_dir, size=2048, samples=128, levels=LEVELS):
    """Bake ánh sáng (trực tiếp + gián tiếp, không màu vật liệu) ra LM_<tầng>.png — dùng làm lightMap (uv1) trên web."""
    import os
    os.makedirs(out_dir, exist_ok=True)
    scene.render.engine = 'CYCLES'
    scene.cycles.samples = samples
    bk = scene.render.bake
    bk.use_pass_direct, bk.use_pass_indirect, bk.use_pass_color = True, True, False
    bk.margin = 4
    for lv in levels:
        meshes = [o for o in lightmap_meshes(level_col(scene, lv)) if 'Lightmap' in o.data.uv_layers]
        if not meshes:
            continue
        img = bpy.data.images.get('LM_' + lv) or bpy.data.images.new('LM_' + lv, size, size, float_buffer=True)
        img.scale(size, size)
        for m in {m for o in meshes for m in o.data.materials if m}:
            nodes = m.node_tree.nodes
            n = nodes.get('LM_BAKE') or nodes.new('ShaderNodeTexImage')
            n.name = n.label = 'LM_BAKE'
            n.location = (-600, -400)
            n.image = img
            nodes.active = n
        for o in meshes:
            o.data.uv_layers['Lightmap'].active = True
        with bpy.context.temp_override(**_ops_context(scene, meshes)):
            bpy.ops.object.bake(type='DIFFUSE', pass_filter={'DIRECT', 'INDIRECT'}, use_clear=True, margin=4)
        for o in meshes:
            o.data.uv_layers['UVMap'].active = True
        img.filepath_raw = os.path.join(out_dir, 'LM_%s.exr' % lv)
        img.file_format = 'OPEN_EXR'
        img.save()
        # bản PNG (sRGB 8-bit) cho web: nha-hien-dai/lightmaps/LM_<tầng>.png
        png = os.path.join(out_dir, 'LM_%s.png' % lv)
        vs, fmt = scene.view_settings, scene.render.image_settings
        old = (vs.view_transform, vs.look, vs.exposure, fmt.file_format)
        vs.view_transform, vs.look, vs.exposure, fmt.file_format = 'Standard', 'None', 0.0, 'PNG'
        img.save_render(png, scene=scene)
        vs.view_transform, vs.look, vs.exposure, fmt.file_format = old
        print('Đã bake %s -> %s' % (lv, img.filepath_raw))


def main(argv):
    clear_previous()
    scene = bpy.data.scenes.new(SCENE_NAME)
    if bpy.context.window:
        bpy.context.window.scene = scene
    root = bpy.data.collections.new(SCENE_NAME)
    scene.collection.children.link(root)
    M = create_materials()
    b = Builder(scene, root, M)

    # cùng thứ tự với main.js: sân → nhà → nội thất
    build_site(b, M)
    ground(b, M)
    level2(b, M)
    level3(b, M)
    roof(b, M)
    furnish(b, M)

    mode = argv.get('time', THOI_GIAN)
    setup_world(scene, b, M, mode)
    add_cameras(b, scene)

    scene.render.engine = 'CYCLES'
    scene.cycles.samples = int(argv.get('samples', 128))
    scene.cycles.use_denoising = True
    scene.render.resolution_x, scene.render.resolution_y = 1600, 1200
    try:
        scene.view_settings.view_transform = 'AgX'
    except Exception:
        pass

    if TAO_UV_LIGHTMAP or 'lightmap' in argv or 'bake' in argv:
        make_lightmap_uv(scene)
    if 'bake' in argv:  # --bake 2048 --bake-samples 128 --bake-dir D:/lightmaps --bake-levels g,l2
        levels = tuple(argv['bake-levels'].split(',')) if 'bake-levels' in argv else LEVELS
        bake_lightmaps(scene, argv.get('bake-dir', bpy.path.abspath('//lightmaps') if bpy.data.filepath else 'lightmaps'),
                       int(argv['bake']) if argv['bake'] is not True else 2048, int(argv.get('bake-samples', 128)), levels)

    n = sum(1 for o in root.all_objects)
    print('Đã dựng %d object trong scene %s' % (n, SCENE_NAME))
    dup = [o.name for o in root.all_objects if '.' in o.name]
    if dup:
        print('CHÚ Ý: %d object bị đổi tên (trùng tên ở scene khác), vd. %s' % (len(dup), dup[:3]))

    if 'names' in argv:
        scene.view_layers[0].update()
        with open(argv['names'], 'w', encoding='utf-8') as f:
            for o in sorted(root.all_objects, key=lambda o: o.name):
                if o.name in ('MatTroi',) or o.name.startswith('Cam_'):
                    continue
                p = o.matrix_world.translation  # kèm vị trí theo hệ three để so với web
                f.write('%s\t%.4f\t%.4f\t%.4f\n' % (o.name, p.x, p.z, -p.y))
    if 'save' in argv:
        bpy.ops.wm.save_as_mainfile(filepath=argv['save'])
    if 'render' in argv:
        scene.render.filepath = argv['render']
        if 'res' in argv:
            w, h = argv['res'].split('x')
            scene.render.resolution_x, scene.render.resolution_y = int(w), int(h)
        if 'camera' in argv:
            scene.camera = bpy.data.objects[argv['camera']]
        bpy.ops.render.render(write_still=True, scene=scene.name)


def parse_args():
    if '--' not in sys.argv:
        return {}
    a, out = sys.argv[sys.argv.index('--') + 1:], {}
    i = 0
    while i < len(a):
        k = a[i].lstrip('-')
        if i + 1 < len(a) and not a[i + 1].startswith('--'):
            out[k] = a[i + 1]
            i += 2
        else:
            out[k] = True
            i += 1
    return out


main(parse_args())
