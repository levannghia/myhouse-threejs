// Tối ưu hiệu năng cho điện thoại / máy không có card rời:
//  1) gộp hình theo vật liệu (tầng, từng đồ vật, từng cánh cửa) + sách thành InstancedMesh + BVH cho raycast
//  2) mức chất lượng Thấp / Trung bình / Cao (độ phân giải, khử răng cưa, bóng đổ, số đèn)
//  3) "pool" đèn: chỉ vài đèn gần camera được tính, thay vì cả 19 đèn trên mọi pixel
//  4) tự hạ chất lượng khi FPS thấp (chế độ Tự động)
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { computeBoundsTree, disposeBoundsTree, acceleratedRaycast } from 'three-mesh-bvh';

THREE.BufferGeometry.prototype.computeBoundsTree = computeBoundsTree;
THREE.BufferGeometry.prototype.disposeBoundsTree = disposeBoundsTree;
THREE.Mesh.prototype.raycast = acceleratedRaycast;

export const QUALITY = {
  low: { label: 'Thấp', dpr: 1, aa: false, shadows: false, shadowSize: 0, lights: 3, spots: false },
  medium: { label: 'Trung bình', dpr: 1.5, aa: true, shadows: true, shadowSize: 2048, lights: 6, spots: true },
  high: { label: 'Cao', dpr: 2, aa: true, shadows: true, shadowSize: 4096, lights: Infinity, spots: true },
};
export const ORDER = ['low', 'medium', 'high'];
const KEY = 'nha3d.quality';

export function savedQuality() {
  try {
    return localStorage.getItem(KEY) || 'auto';
  } catch {
    return 'auto';
  }
}
export function saveQuality(q) {
  try {
    localStorage.setItem(KEY, q);
  } catch {}
}

// Đoán sức máy trước khi tạo renderer (khử răng cưa chỉ đặt được lúc tạo context)
export function detectQuality() {
  const mobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && Math.min(screen.width, screen.height) < 820);
  let gpu = '';
  try {
    const gl = document.createElement('canvas').getContext('webgl2') || document.createElement('canvas').getContext('webgl');
    const ext = gl && gl.getExtension('WEBGL_debug_renderer_info');
    gpu = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl ? gl.getParameter(gl.RENDERER) : '';
    gl?.getExtension('WEBGL_lose_context')?.loseContext();
  } catch {}
  const software = /SwiftShader|llvmpipe|Basic Render|Software|Mesa Offscreen/i.test(gpu);
  const weak = /Intel|UHD|Iris|HD Graphics|Mali|Adreno \(TM\) [1-5]\d\d|PowerVR|Apple GPU/i.test(gpu);
  const quality = software || mobile ? 'low' : weak ? 'medium' : 'high';
  return { quality, gpu, mobile, software };
}

// ------------------------------------------------------------ gộp hình ---
// Mảnh cần giữ riêng vì có chuyển động riêng (tìm theo tên <nhóm>_<k> trong interact.js). 'all' = không gộp.
const SEPARATE = { Tu: [0], TuQuanAo: [0], GheNam: [2], BonCau: [1], Sen: [2], Giuong: [1, 2], Sofa: [5, 6, 7], Thung: 'all' };

// Gộp `meshes` thành vài mesh (mỗi vật liệu + cờ một mesh) đặt trong `parent`.
// recenter: đưa gốc mesh gộp về tâm của nó (để phóng to/thu nhỏ quanh chính nó).
function mergeInto(parent, meshes, ctx, { recenter = false, name = parent.name, extra = null } = {}) {
  if (meshes.length < 2 && !recenter) return 0;
  parent.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(parent.matrixWorld).invert();
  const buckets = new Map();
  for (const m of meshes) {
    const mats = Array.isArray(m.material) ? m.material : [m.material];
    const coll = ctx.colliders.has(m), flo = ctx.floors.has(m), cast = m.castShadow;
    const local = new THREE.Matrix4().multiplyMatrices(inv, m.matrixWorld);
    // hộp nhiều vật liệu (6 mặt khác nhau): tách theo nhóm
    const groups = Array.isArray(m.material) && m.geometry.groups.length ? m.geometry.groups : [{ start: 0, count: Infinity, materialIndex: 0 }];
    for (const g of groups) {
      const mat = mats[g.materialIndex] ?? mats[0];
      let geo = m.geometry;
      if (geo.index && Array.isArray(m.material)) {
        geo = geo.clone();
        geo.setIndex(new THREE.BufferAttribute(geo.index.array.slice(g.start, Math.min(g.start + g.count, geo.index.count)), 1));
        geo.clearGroups();
      }
      geo = (geo.index ? geo.toNonIndexed() : geo.clone()).applyMatrix4(local);
      for (const n of Object.keys(geo.attributes)) if (!['position', 'normal', 'uv', 'uv1', 'color'].includes(n)) geo.deleteAttribute(n);
      geo.morphAttributes = {};
      const sig = Object.keys(geo.attributes).sort().map((n) => n + geo.attributes[n].itemSize).join(',');
      const key = `${mat.uuid}|${coll}|${flo}|${cast}|${sig}`;
      if (!buckets.has(key)) buckets.set(key, { mat, coll, flo, cast, geos: [] });
      buckets.get(key).geos.push(geo);
    }
  }
  for (const m of meshes) {
    m.removeFromParent();
    ctx.colliders.delete(m);
    ctx.floors.delete(m);
  }
  let n = 0;
  for (const bk of buckets.values()) {
    const geo = bk.geos.length === 1 ? bk.geos[0] : mergeGeometries(bk.geos, false);
    if (!geo) continue;
    const mesh = new THREE.Mesh(geo, bk.mat);
    if (recenter) {
      geo.computeBoundingBox();
      const c = geo.boundingBox.getCenter(new THREE.Vector3());
      geo.translate(-c.x, -c.y, -c.z);
      mesh.position.copy(c);
    }
    geo.computeBoundingSphere();
    mesh.name = `${name}_gop_${bk.mat.name || 'mat'}`;
    mesh.castShadow = bk.cast;
    mesh.receiveShadow = true;
    if (extra) Object.assign(mesh.userData, extra);
    parent.add(mesh);
    if (bk.coll) ctx.colliders.add(mesh);
    if (bk.flo) ctx.floors.add(mesh);
    n++;
  }
  return n;
}

// Sách trên kệ -> 1 InstancedMesh / kệ (interact.js rút sách bằng cách sửa ma trận của một instance)
function instanceBooks(root) {
  const books = [];
  root.traverse((m) => { if (m.isMesh && m.material?.name?.startsWith('book_')) books.push(m); });
  if (!books.length) return 0;
  root.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const mat = new THREE.MeshStandardMaterial({ roughness: 0.8 });
  mat.name = 'book_inst';
  const im = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), mat, books.length);
  const size = new THREE.Vector3(), center = new THREE.Vector3(), mtx = new THREE.Matrix4();
  books.forEach((m, i) => {
    m.geometry.computeBoundingBox();
    m.geometry.boundingBox.getSize(size);
    m.geometry.boundingBox.getCenter(center);
    mtx.multiplyMatrices(inv, m.matrixWorld).multiply(new THREE.Matrix4().makeTranslation(center.x, center.y, center.z)).scale(size);
    im.setMatrixAt(i, mtx);
    im.setColorAt(i, m.material.color);
    m.removeFromParent();
  });
  im.name = `${root.name}_sach`;
  im.userData.books = true;
  im.castShadow = im.receiveShadow = true;
  im.computeBoundingSphere();
  root.add(im);
  return books.length;
}

// itemType(root) -> loại đồ vật (Sofa, Ghe…) hoặc null; doorRoots: các group cửa (b.doors[].parts[].obj)
export function mergeStatic(b, itemType) {
  const ctx = { colliders: new Set(b.colliders), floors: new Set(b.floors) };
  const count = () => { let n = 0; for (const l of Object.values(b.levels)) l.traverse((o) => { if (o.isMesh) n++; }); return n; };
  const before = count();
  const doorRoots = new Set(b.doors.flatMap((d) => d.parts.map((p) => p.obj)));
  const itemRoots = [];
  for (const level of Object.values(b.levels)) level.traverse((o) => { if (itemType(o)) itemRoots.push(o); });
  const special = new Set([...doorRoots, ...itemRoots]);
  const under = (m, set) => { for (let p = m; p; p = p.parent) if (set.has(p)) return p; return null; };

  // 1) đồ vật: gộp theo vật liệu trong từng đồ vật (giữ riêng các mảnh có chuyển động riêng)
  for (const root of itemRoots) {
    const type = itemType(root);
    if (root.isMesh) continue; // bụi cây: bản thân đã là 1 mesh
    if (type === 'KeSach') instanceBooks(root);
    const sep = SEPARATE[type];
    if (sep === 'all') continue;
    const keepNames = new Set((sep || []).map((k) => `${root.name}_${k}`));
    const list = [];
    root.traverse((m) => {
      if (!m.isMesh || m.isInstancedMesh) return;
      for (let p = m; p && p !== root; p = p.parent) if (keepNames.has(p.name)) return;
      list.push(m);
    });
    mergeInto(root, list, ctx, { recenter: true });
  }
  // 2) cửa: gộp trong từng cánh (cả cánh trượt/xoay cùng nhau)
  for (const d of b.doors) {
    for (const p of d.parts) {
      const list = [];
      p.obj.traverse((m) => { if (m.isMesh) list.push(m); });
      mergeInto(p.obj, list, ctx, { extra: { door: d } });
    }
  }
  // 3) phần tĩnh còn lại của từng tầng
  for (const level of Object.values(b.levels)) {
    const list = [];
    level.traverse((m) => {
      if (!m.isMesh || m.isInstancedMesh || m.isSkinnedMesh || under(m, special)) return;
      list.push(m);
    });
    mergeInto(level, list, ctx);
  }
  // BVH cho mọi mesh va chạm / sàn: raycast của walker.js nhanh dù mesh gộp rất lớn
  for (const m of [...ctx.colliders, ...ctx.floors]) if (!m.geometry.boundsTree) m.geometry.computeBoundsTree();
  b.colliders.length = 0;
  b.colliders.push(...ctx.colliders);
  b.floors.length = 0;
  b.floors.push(...ctx.floors);
  return { before, after: count() };
}

// ------------------------------------------------------------ pool đèn ---
// Đèn gốc bị ẩn; `size` đèn thật được đặt vào vị trí các đèn gốc gần camera nhất (cùng tầng đang hiện).
// Số đèn cố định nên shader không phải biên dịch lại khi di chuyển.
export class LightPool {
  constructor(scene, lamps, size) {
    this.lamps = lamps.filter((l) => l.light.isPointLight);
    this.scene = scene;
    this.slots = [];
    this.timer = 0;
    this.setSize(size);
  }
  setSize(size) {
    const n = Math.min(size, this.lamps.length);
    this.active = n < this.lamps.length;
    for (const l of this.lamps) l.light.visible = !this.active;
    for (const s of this.slots) s.light.removeFromParent();
    this.slots = [];
    if (!this.active) return;
    for (let i = 0; i < n; i++) {
      const light = new THREE.PointLight(0xffffff, 0, 10, 2);
      light.name = 'pool_' + i;
      this.scene.add(light);
      this.slots.push({ light, lamp: null, k: 0 });
    }
    this.timer = 1e9;
  }
  update(camera, dt) {
    if (!this.active) return;
    this.timer += dt;
    const p = camera.position;
    if (this.timer > 0.25) {
      this.timer = 0;
      const shown = (o) => { for (let q = o.parent; q; q = q.parent) if (!q.visible) return false; return true; };
      const v = new THREE.Vector3();
      const ranked = this.lamps
        .filter((l) => shown(l.light) && l.light.intensity > 0.01)
        .map((l) => ({ l, d: l.light.getWorldPosition(v).distanceToSquared(p) }))
        .sort((x, y) => x.d - y.d)
        .slice(0, this.slots.length)
        .map((x) => x.l);
      // giữ ô đèn đang dùng nếu vẫn trong top, ô trống nhận đèn mới (bắt đầu từ tối -> sáng dần)
      const free = this.slots.filter((s) => !ranked.includes(s.lamp));
      for (const l of ranked) {
        if (this.slots.some((s) => s.lamp === l)) continue;
        const s = free.shift();
        if (!s) break;
        s.lamp = l;
        s.k = 0;
        l.light.getWorldPosition(s.light.position);
        s.light.color.copy(l.light.color);
        s.light.distance = l.light.distance;
        s.light.decay = l.light.decay;
      }
      for (const s of free) s.lamp = null;
    }
    const f = Math.min(1, dt * 6);
    for (const s of this.slots) {
      s.k += ((s.lamp ? 1 : 0) - s.k) * f;
      s.light.intensity = s.lamp ? s.lamp.light.intensity * s.k : s.light.intensity * (1 - f);
    }
  }
}

// ------------------------------------------------------------ FPS ---
// Chế độ Tự động: FPS trung bình < 30 trong ~2.5 giây -> hạ một mức
export class FpsGovernor {
  constructor(onDrop) {
    this.onDrop = onDrop;
    this.acc = 0;
    this.frames = 0;
    this.cool = 3; // bỏ qua mấy giây đầu (đang tải, biên dịch shader)
    this.enabled = true;
  }
  tick(dt) {
    if (!this.enabled || document.hidden) return;
    if (this.cool > 0) return void (this.cool -= dt);
    this.acc += dt;
    this.frames++;
    if (this.acc < 2.5) return;
    const fps = this.frames / this.acc;
    this.acc = 0;
    this.frames = 0;
    if (fps < 30) {
      this.cool = 3;
      this.onDrop(fps);
    }
  }
}
