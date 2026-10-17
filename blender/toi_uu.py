# -*- coding: utf-8 -*-
"""
Tối ưu nhà cho web rồi bake ánh sáng + xuất GLB — chạy trên file .blend bạn đang làm (scene "NhaHienDai").

  • Trong Blender: mở nha_hien_dai.blend (đã chỉnh vật liệu…), tab Scripting > Open file này > Run Script.
  • Dòng lệnh:
      blender -b nha_hien_dai.blend --python toi_uu.py
      blender -b nha_hien_dai.blend --python toi_uu.py -- --size 2048 --samples 512 --no-bake

Các bước (file gốc KHÔNG bị ghi đè — kết quả lưu thành <tên>_toiuu.blend):
  1. Gộp mesh (Ctrl+J bằng script): phần tĩnh mỗi tầng gộp theo cờ floor/collide/cast; các mảnh trong từng đồ vật và
     từng cánh cửa gộp lại, NHƯNG giữ riêng mảnh có chuyển động riêng (giống SEPARATE trong src/perf.js) và giữ tên
     Empty đồ vật / DOOR_* để web vẫn tương tác được. 1760 object -> vài trăm => bake nhanh, GLB nhẹ hơn.
  2. Tạo UV "Lightmap" cho từng tầng (Smart UV Project, mỗi tầng một atlas).
  3. Bake ánh sáng ĐÈN TRONG NHÀ (tầng g, l2, l3) bằng GPU nếu có -> nha-hien-dai/lightmaps/LM_<tầng>.png (+ .exr),
     tự ghi vào nha-hien-dai/assets.json. Web tắt đèn realtime của tầng đã bake -> nhẹ máy, bầu trời/mặt trời vẫn realtime.
  4. Lưu <tên>_toiuu.blend và xuất nha-hien-dai/models/nha.glb.
"""
import bpy
import os
import re
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__)) if '__file__' in globals() and os.path.exists(__file__) \
    else os.path.dirname(bpy.data.filepath)
sys.path.insert(0, HERE)
import dung_nha as dn  # noqa: E402  (không chạy main nhờ __name__)
import xuat_glb  # noqa: E402

SCENE_NAME = 'NhaHienDai'
ROOT = os.path.dirname(HERE)  # thư mục nha-hien-dai
ITEM_RE = re.compile(r'^(site|g|l2|l3)_([A-Za-z]+)_\d+$')
ITEM_TYPES = {'Sofa', 'Ghe', 'GheDon', 'GheNam', 'Giuong', 'DenSan', 'DenTha', 'TV', 'Tu', 'TuQuanAo', 'KeSach',
              'Tranh', 'Chau', 'Cay', 'Bui', 'Xe', 'BonTam', 'Lavabo', 'BonCau', 'Sen', 'Thung'}
# mảnh giữ riêng vì có chuyển động riêng (src/interact.js tìm theo tên <nhóm>_<k>) — trùng với src/perf.js
SEPARATE = {'Tu': [0], 'TuQuanAo': [0], 'GheNam': [2], 'BonCau': [1], 'Sen': [2], 'Giuong': [1, 2],
            'Sofa': [5, 6, 7], 'Thung': 'all'}


def item_type(name):
    m = ITEM_RE.match(name)
    return m.group(2) if m and m.group(2) in ITEM_TYPES else None


def flags_key(o):
    mats = tuple(sorted(m.name for m in o.data.materials if m))
    is_books = bool(mats) and all(n.startswith('book_') for n in mats)
    return (bool(o.get('floor', False)), bool(o.get('collide', True)), bool(o.get('cast', True)),
            o.hide_render, o.visible_shadow, is_books, len(o.data.color_attributes) > 0)


def join(scene, objs, name):
    """Ctrl+J: gộp objs vào objs[0], đặt tên mới. Trả về object kết quả."""
    if not objs:
        return None
    target = objs[0]
    if len(objs) > 1:
        ctx = dn._ops_context(scene, objs)
        ctx['active_object'] = ctx['object'] = target
        with bpy.context.temp_override(**ctx):
            bpy.ops.object.join()
    target.name = name
    target.data.name = name
    return target


def group_join(scene, objs, base):
    groups = {}
    for o in objs:
        groups.setdefault(flags_key(o), []).append(o)
    out = []
    for i, (key, lst) in enumerate(sorted(groups.items(), key=lambda kv: str(kv[0]))):
        if key[5]:  # sách: giữ từng cuốn (web gom thành InstancedMesh)
            out += lst
            continue
        out.append(join(scene, lst, '%s_%02d' % (base, i + 1) if len(lst) > 1 else lst[0].name))
    return out


def optimize(scene):
    t0 = time.time()
    before = sum(1 for _ in scene.collection.all_objects)
    for lv in dn.LEVELS:
        col = dn.level_col(scene, lv)
        if col is None:
            continue
        # (lấy lại danh sách sau mỗi bước: join xoá object cũ)
        # 1) đồ vật: gộp mảnh con (trừ mảnh có chuyển động riêng)
        for root in [o for o in col.all_objects if o.type == 'EMPTY' and item_type(o.name)]:
            sep = SEPARATE.get(item_type(root.name))
            if sep == 'all':
                continue
            keep = {'%s_%d' % (root.name, k) for k in (sep or [])}
            parts = [c for c in root.children if c.type == 'MESH' and c.name not in keep]
            group_join(scene, parts, root.name + '_gop')
        # 2) cửa: gộp các mảnh trong từng cánh
        for door in [o for o in col.all_objects if o.type == 'EMPTY' and o.name.startswith('DOOR_')]:
            group_join(scene, [c for c in door.children if c.type == 'MESH'], door.name + '_gop')
        # 3) phần tĩnh: mesh gốc (không cha) không phải đồ vật
        static = [o for o in col.all_objects if o.type == 'MESH' and o.parent is None and not item_type(o.name)]
        group_join(scene, static, lv + '_Gop')
    after = sum(1 for _ in scene.collection.all_objects)
    print('Gộp mesh: %d -> %d object (%.1fs)' % (before, after, time.time() - t0))
    return before, after


def args():
    a = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    opt = {'size': 2048, 'samples': 512, 'bake': True}
    for i, k in enumerate(a):
        if k == '--size':
            opt['size'] = int(a[i + 1])
        elif k == '--samples':
            opt['samples'] = int(a[i + 1])
        elif k == '--no-bake':
            opt['bake'] = False
        elif k == '--levels':
            opt['levels'] = tuple(a[i + 1].split(','))
    return opt


def run():
    opt = args()
    scene = bpy.data.scenes.get(SCENE_NAME)
    if scene is None:
        raise RuntimeError('Không thấy scene "%s" — chạy dung_nha.py trước.' % SCENE_NAME)
    if bpy.context.window:
        bpy.context.window.scene = scene
    src = bpy.data.filepath or os.path.join(HERE, 'nha_hien_dai.blend')
    out_blend = os.path.splitext(src)[0].replace('_toiuu', '') + '_toiuu.blend'

    optimize(scene)
    dn.make_lightmap_uv(scene)
    if opt['bake']:
        t0 = time.time()
        dn.bake_lightmaps(scene, os.path.join(ROOT, 'lightmaps'), opt['size'], opt['samples'], opt.get('levels', dn.BAKE_LEVELS))
        print('Bake xong (%.0fs)' % (time.time() - t0))
    bpy.ops.wm.save_as_mainfile(filepath=out_blend, copy=True)  # copy: file đang mở vẫn là file gốc
    print('Đã lưu', out_blend)
    xuat_glb.export_glb(os.path.join(ROOT, 'models', 'nha.glb'))


if __name__ == '__main__':
    run()
