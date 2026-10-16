# -*- coding: utf-8 -*-
"""
Xuất scene "NhaHienDai" ra GLB cho website (nha-hien-dai/models/nha.glb).

  • Trong Blender: mở file .blend đã làm vật liệu/bake, tab Scripting > Open file này > Run Script.
  • Dòng lệnh:
      blender -b nha_hien_dai.blend --python xuat_glb.py -- D:/blender_hoc/nha-hien-dai/models/nha.glb

Tuỳ chọn export (giống khi chọn tay ở File > Export > glTF 2.0):
  +Y Up · Include: Custom Properties (cờ floor/collide/cast, level, door, cd đèn) · Punctual Lights
  · Apply Modifiers (giữ Bevel…) · UVs (cả UV "Lightmap" -> TEXCOORD_1) · Draco.
"""
import bpy
import os
import sys

SCENE_NAME = "NhaHienDai"
DEFAULT_OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "models", "nha.glb")


def export_glb(path, draco=True):
    scene = bpy.data.scenes.get(SCENE_NAME)
    if scene is None:
        raise RuntimeError('Không thấy scene "%s" — chạy dung_nha.py trước.' % SCENE_NAME)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    vl = scene.view_layers[0]
    ctx = dict(scene=scene, view_layer=vl)
    if bpy.context.window:
        ctx['window'] = bpy.context.window
    with bpy.context.temp_override(**ctx):
        bpy.ops.export_scene.gltf(
            filepath=path,
            export_format='GLB',
            use_active_scene=True,
            export_yup=True,
            export_extras=True,
            export_apply=True,
            export_texcoords=True,
            export_lights=True,
            export_cameras=False,
            export_draco_mesh_compression_enable=draco,
        )
    print('Đã xuất GLB: %s (%.1f MB)' % (path, os.path.getsize(path) / 1e6))


def _arg_path():
    if '--' in sys.argv:
        rest = [a for a in sys.argv[sys.argv.index('--') + 1:] if not a.startswith('--')]
        if rest:
            return rest[0]
    return DEFAULT_OUT


export_glb(_arg_path(), draco='--no-draco' not in sys.argv)
