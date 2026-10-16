// Tải nhà từ GLB xuất bằng Blender (blender/xuat_glb.py) và nối vào cùng logic với nhà dựng bằng code:
// b.levels (cắt tầng), b.colliders / b.floors (walker.js), b.doors (mở cửa), b.lamps (ngày/hoàng hôn).
// Dữ liệu đi kèm từ Blender nằm ở glTF extras -> object.userData: level, floor, collide, cast, door, move_three,
// rot_three_y, is_open, cd, dist, penumbra (xem dung_nha.py).
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';

const LEVELS = { site: 0, g: 0, l2: 3.9, l3: 7.2, roof: 10.4 };
const DOOR_NAMES = {
  CuaChinh: 'Cửa chính',
  CuaHoBoi: 'Cửa kính ra hồ bơi',
  CuaSinhHoatT2: 'Cửa kính phòng sinh hoạt',
  CuaMasterT2: 'Cửa kính phòng ngủ master',
  CuaBanCongT3: 'Cửa kính ban công tầng 3',
  CuaSanThuong: 'Cửa ra sân thượng',
  CuaGiaDinhT3: 'Cửa kính phòng gia đình',
  Cong: 'Cổng',
};
// luôn dùng vật liệu của web: kính/nước (transmission của Blender rất nặng trên web), collider ẩn,
// đèn phát sáng (để nút ngày/hoàng hôn điều khiển được)
const WEB_ALWAYS = new Set(['glass', 'water', 'invisible', 'lightWarm']);

// HEAD tới server.js: 200 = có file, 204 = không có (không sinh lỗi 404 trên console)
export async function fileExists(url) {
  try {
    const r = await fetch(url, { method: 'HEAD', cache: 'no-store' });
    return r.status === 200;
  } catch {
    return false;
  }
}

function inherited(o, stop) {
  const f = { floor: false, collide: true, cast: true };
  for (let p = o; p && p !== stop; p = p.parent) {
    if (p.userData.floor) f.floor = true;
    if (p.userData.collide === false) f.collide = false;
    if (p.userData.cast === false) f.cast = false;
  }
  return f;
}

// lightmapLevels: danh sách tầng có lightmap (từ assets.json); null = tự dò từng file (chỉ nên dùng với server.js)
export async function loadGlbHouse(b, M, url, lightmapLevels = null) {
  const draco = new DRACOLoader();
  draco.setDecoderPath('https://cdn.jsdelivr.net/npm/three@0.169.0/examples/jsm/libs/draco/gltf/');
  const loader = new GLTFLoader();
  loader.setDRACOLoader(draco);
  const gltf = await loader.loadAsync(url);
  draco.dispose();

  // 1) gom object gốc vào group tầng theo userData.level
  for (const [lv, ffl] of Object.entries(LEVELS)) b.level(lv, ffl);
  for (const o of [...gltf.scene.children]) {
    const lv = o.userData.level;
    if (lv && b.levels[lv]) b.levels[lv].add(o);
  }
  b.scene.updateMatrixWorld(true);

  // 2) lightmap đã bake (lightmaps/LM_<tầng>.png, UV thứ 2 "Lightmap" -> uv1)
  const lightmaps = {};
  const texLoader = new THREE.TextureLoader();
  for (const lv of Object.keys(LEVELS)) {
    const path = `lightmaps/LM_${lv}.png`;
    if (lightmapLevels ? !lightmapLevels.includes(lv) : !(await fileExists(path))) continue;
    const t = await texLoader.loadAsync(path);
    t.flipY = false; // UV glTF đã lật v
    t.colorSpace = THREE.SRGBColorSpace;
    t.channel = 1;
    lightmaps[lv] = t;
  }
  const lmCache = new Map();

  // 3) vật liệu, bóng đổ, cờ va chạm/sàn
  for (const [lv, group] of Object.entries(b.levels)) {
    group.traverse((m) => {
      if (!m.isMesh) return;
      const f = inherited(m, group);
      m.castShadow = f.cast;
      m.receiveShadow = true;
      if (f.collide) b.colliders.push(m);
      if (f.floor) b.floors.push(m);

      const src = m.material;
      const web = M[src.name];
      // vật liệu procedural của Blender không xuất được texture -> dùng texture canvas của web (UV mét giống nhau);
      // vật liệu có ảnh thật (map) từ Blender thì giữ nguyên
      if (web && (WEB_ALWAYS.has(src.name) || !src.map)) m.material = web;
      const lm = lightmaps[lv];
      if (lm && m.geometry.attributes.uv1 && !WEB_ALWAYS.has(m.material.name)) {
        const key = m.material.uuid + lv;
        if (!lmCache.has(key)) {
          const c = m.material.clone();
          c.lightMap = lm;
          c.lightMapIntensity = 1;
          lmCache.set(key, c);
        }
        m.material = lmCache.get(key);
      }
    });
  }

  // 4) đèn: dùng cường độ gốc của web (candela) thay cho giá trị đã quy đổi qua W
  const remove = [];
  for (const group of Object.values(b.levels)) {
    group.traverse((l) => {
      if (!l.isLight) return;
      if (l.isDirectionalLight) return remove.push(l); // mặt trời của Blender, web có sun riêng
      const cd = l.userData.cd ?? l.intensity;
      l.intensity = cd;
      l.distance = l.userData.dist ?? 0;
      l.decay = 2;
      l.castShadow = false;
      if (l.isSpotLight && l.userData.penumbra != null) l.penumbra = l.userData.penumbra;
      b.lamps.push({ light: l, base: cd });
    });
  }
  for (const l of remove) l.removeFromParent();

  // 5) cửa: node DOOR_<id> (cổng 2 cánh DOOR_Cong_Trai/Phai gộp thành 1 cửa)
  const groups = new Map();
  for (const group of Object.values(b.levels)) {
    group.traverse((o) => {
      if (!o.name.startsWith('DOOR_') || typeof o.userData.door !== 'string') return;
      const id = o.name.slice(5).split('_')[0];
      if (!groups.has(id)) groups.set(id, []);
      groups.get(id).push(o);
    });
  }
  for (const [id, objs] of groups) {
    let open = false;
    const parts = objs.map((o) => {
      const u = o.userData;
      const part = { obj: o };
      if (u.door === 'slide') part.move = new THREE.Vector3().fromArray(u.move_three);
      if (u.door === 'pivot') part.rot = u.rot_three_y;
      if (u.is_open) {
        // Blender lưu ở trạng thái mở -> đưa về vị trí đóng làm gốc
        if (part.move) o.position.sub(part.move);
        if (part.rot) o.rotation.y -= part.rot;
        open = true;
      }
      return part;
    });
    b.scene.updateMatrixWorld(true);
    const box = new THREE.Box3();
    for (const o of objs) box.expandByObject(o);
    const c = box.getCenter(new THREE.Vector3());
    b.door(DOOR_NAMES[id] || id, new THREE.Vector3(c.x, box.min.y, c.z), parts, open);
  }
  b.scene.updateMatrixWorld(true);
  return gltf;
}
