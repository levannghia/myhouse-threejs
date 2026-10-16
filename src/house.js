// Ngôi nhà: 3 tầng, khối bê tông mái dốc bên trái + khối hộp lam gỗ bên phải.
// Gốc toạ độ: giữa mặt tiền, x ∈ [-6, 6] (rộng 12m), z = 0 là mặt tiền tầng 2, nhà sâu tới z = -18.
// Mặt bằng chi tiết xem THIET_KE.md.
import * as THREE from 'three';
import { boxGeo } from './builder.js';
import { makeRng } from './rand.js';

export const H = {
  L2: 3.9, // cao độ sàn tầng 2
  L3: 7.2, // cao độ sàn tầng 3
  ROOF: 10.4, // đáy mái bằng khối phải
  EAVE: 7.5, // mép mái dốc bên trái (x = -6)
  PEAK: 11.6, // đỉnh mái dốc (x = 1.5)
};
const K = (H.PEAK - H.EAVE) / 7.5;
export const roofY = (x) => H.EAVE + (x + 6) * K;

const TE = 0.25; // tường ngoài
const TI = 0.12; // tường trong
const V = (x, y, z) => new THREE.Vector3(x, y, z);

export function buildHouse(b, M) {
  ground(b, M);
  level2(b, M);
  level3(b, M);
  roof(b, M);
}

// ---------------------------------------------------------------- helpers ---
function slidingGlass(b, name, id, axis, c, a0, a1, y0, y1, slide, open = false) {
  const g = new THREE.Group();
  g.name = 'DOOR_' + id;
  b.current.add(g);
  b.glassPane(axis, c, a0, a1, y0, y1, { parent: g });
  const mid = (a0 + a1) / 2;
  const center = axis === 'x' ? V(mid, y0, c) : V(c, y0, mid);
  const move = axis === 'x' ? V(slide, 0, 0) : V(0, 0, slide);
  return b.door(name, center, [{ obj: g, move }], open);
}

function gableShape(y0, holes = []) {
  const s = new THREE.Shape();
  s.moveTo(-6.125, y0);
  s.lineTo(1.5, y0);
  s.lineTo(1.5, H.PEAK);
  s.lineTo(-6.125, roofY(-6.125));
  s.closePath();
  for (const [x0, y0h, x1, y1] of holes) {
    const p = new THREE.Path();
    p.moveTo(x0, y0h);
    p.lineTo(x1, y0h);
    p.lineTo(x1, y1);
    p.lineTo(x0, y1);
    p.closePath();
    s.holes.push(p);
  }
  return s;
}

function gable(b, M, zFront, y0, holes) {
  const geo = new THREE.ExtrudeGeometry(gableShape(y0, holes), { depth: 0.3, bevelEnabled: false });
  const m = b.mesh(geo, M.concrete);
  m.position.z = zFront - 0.3;
  for (const [x0, yy0, x1, yy1] of holes) b.glassPane('x', zFront - 0.15, x0, x1, yy0, yy1);
  return m;
}

function railing(b, M, axis, c, a0, a1, y0, h = 1.05) {
  // lan can kính + tay vịn thép
  if (axis === 'x') {
    b.box(M.glass, a0, y0, c - 0.01, a1, y0 + h, c + 0.01, { cast: false });
    b.box(M.steel, a0, y0 + h, c - 0.03, a1, y0 + h + 0.04, c + 0.03, { collide: false });
  } else {
    b.box(M.glass, c - 0.01, y0, a0, c + 0.01, y0 + h, a1, { cast: false });
    b.box(M.steel, c - 0.03, y0 + h, a0, c + 0.03, y0 + h + 0.04, a1, { collide: false });
  }
}

function stairs(b, M, x0, x1, zStart, zEnd, yStart, yEnd, risers) {
  const dz = (zEnd - zStart) / risers, dy = (yEnd - yStart) / risers;
  for (let i = 0; i < risers; i++) {
    const top = yStart + (i + 1) * dy;
    b.box(M.oak, x0, top - 0.06, zStart + i * dz, x1, top, zStart + (i + 1) * dz, { floor: true, collide: false });
  }
}

// ---------------------------------------------------------------- tầng 1 ---
function ground(b, M) {
  b.level('g', 0);
  const h = 3.6; // trần tầng 1 (đáy sàn tầng 2)
  b.tag('San');

  b.slab(-6, -4, 6, -18, 0, 0.3, M.marble, M.concrete, { collide: false });

  // Mặt tiền tầng trệt (lùi vào z = -4)
  b.tag('MatTien');
  b.glassPane('x', -4, -6, -3.9, 0, h);
  b.box(M.concrete, -3.9, 0, -4.15, 1.3, h, -3.85); // tường bê tông điểm nhấn
  b.box(M.timberV, 4.6, 0, -4.15, 6, h, -3.85); // ốp gỗ sẫm

  // Vách lam gỗ đứng + cửa chính xoay trục
  b.tag('VachLam');
  for (let x = 1.3; x < 4.6; x += 0.11) {
    if (x > 1.55 && x < 2.72) continue;
    b.box(M.timber, x, 0, -3.92, x + 0.06, h, -3.8);
  }
  b.glassPane('x', -4.2, 2.72, 4.6, 0, h);
  b.tag('CuaChinh');
  const door = new THREE.Group();
  door.name = 'DOOR_CuaChinh';
  door.position.set(1.6, 0, -3.95);
  b.current.add(door);
  b.box(M.timberV, 1.6, 0, -3.98, 2.7, h - 0.05, -3.92, { parent: door });
  for (let x = 1.62; x < 2.66; x += 0.11) b.box(M.timber, x, 0.02, -3.92, x + 0.06, h - 0.07, -3.84, { parent: door });
  b.box(M.steel, 2.45, 0.9, -3.84, 2.48, 2.1, -3.78, { parent: door, collide: false });
  b.door('Cửa chính', V(2.15, 0, -4), [{ obj: door, rot: Math.PI / 2 * 0.92 }]);
  b.box(M.timberV, 1.3, 0, -4.15, 1.6, h, -3.85); // khung cửa

  // Tường hông và sau
  b.tag('TuongNgoai');
  b.wall(null, 'z', -6, -4, -18, 0, h, TE, [{ a0: -5, a1: -12, glass: true }], { outer: M.concrete, out: -1 });
  b.wall(null, 'z', 6, -4, -18, 0, h, TE, [], { outer: M.concrete, out: 1 });
  b.glassPane('x', -18, -6, -1, 0, h);
  b.glassPane('x', -18, 1.6, 6, 0, h);
  slidingGlass(b, 'Cửa kính ra hồ bơi', 'CuaHoBoi', 'x', -17.92, -1, 1.6, 0, h, -2.4);

  // WC khách + kho
  b.tag('WC');
  const P = M.plaster;
  b.wall(P, 'z', 1.5, -7, -13, 0, h, TI);
  b.wall(P, 'z', 3.2, -7, -13, 0, h, TI, [{ a0: -7.8, a1: -8.7, y1: 2.2 }, { a0: -11, a1: -11.9, y1: 2.2 }]);
  b.wall(P, 'x', -7, 1.5, 3.2, 0, h, TI);
  b.wall(P, 'x', -10, 1.5, 3.2, 0, h, TI);
  b.wall(P, 'x', -13, 1.5, 3.2, 0, h, TI);

  // Cầu thang tầng 1 → 2 (bậc gỗ công-xôn từ tường phải)
  b.tag('CauThang');
  stairs(b, M, 4.65, 5.88, -7, -12.6, 0, H.L2, 20);
  b.sloped(M.glass, 4.59, 4.61, -7, 0, -12.6, H.L2, 1.0, { cast: false });
  b.sloped(M.steel, 4.57, 4.63, -7, 1.0, -12.6, H.L2 + 1.0, 0.04, { collide: false });

  // Gara: cột thép tròn, mái sảnh thấp bên trái, đèn âm trần
  b.tag('Gara');
  for (const x of [-4.6, 5.3]) {
    const c = b.mesh(new THREE.CylinderGeometry(0.11, 0.11, h, 16), M.steel);
    c.position.set(x, h / 2, 0.6);
  }
  b.box(M.soffit, -7.2, 3.2, 1.0, -4.6, 3.36, -4, { collide: false });
  for (const x of [-3, -0.5, 2, 4.5]) for (const z of [0.2, -2.4]) b.downlight(x, h - 0.01, z);
  b.downlight(-6.4, 3.19, -1.5);
  b.downlight(-6.4, 3.19, -3.2);

  // Đèn hắt chân tường bê tông (như ảnh)
  for (const x of [-2.6, 0.2]) {
    const s = new THREE.SpotLight(0xffc690, 18, 6, 0.5, 0.6, 2);
    s.name = b.nextName('DenHat');
    s.position.set(x, 0.05, -3.55);
    s.target.position.set(x, 3.5, -4);
    b.current.add(s, s.target);
    b.lamps.push({ light: s, base: 18 });
  }

  b.lamp(-1, 3.2, -1.2, 14, 9);
  b.lamp(3.5, 3.2, -1.2, 10, 8);
  b.lamp(-2.5, 3.2, -7, 16, 10);
  b.lamp(-2.5, 3.2, -12, 12, 9);
  b.lamp(0, 3.2, -16, 14, 10);
  b.lamp(3.6, 3.2, -5.5, 8, 6);
}

// ---------------------------------------------------------------- tầng 2 ---
function level2(b, M) {
  const y = H.L2, top = H.L3 - 0.3, h = top - y;
  b.level('l2', y);
  const P = M.plaster;

  // Sàn tầng 2 (chừa lỗ cầu thang x 3.2..5.9, z -7..-12.6). Phần đua ra là mái gara.
  b.tag('San');
  b.slab(-6, 1.05, 6, -7, y, 0.3, M.woodFloor, M.soffit);
  b.slab(-6, -7, 3.2, -12.6, y, 0.3, M.woodFloor, M.ceiling);
  b.slab(-6, -12.6, 6, -18, y, 0.3, M.woodFloor, M.ceiling);
  b.box(M.frame, -6, y - 0.32, 1.05, 6, y, 1.08, { collide: false }); // viền mép sàn

  // Bồn cây chạy suốt mặt tiền + cây rủ
  b.tag('BonCay');
  b.box(M.frame, -4.6, y, 0.35, 6, y + 0.85, 1.05);
  b.box(M.trunk, -4.55, y + 0.85, 0.4, 5.95, y + 0.82, 1.0, { collide: false });
  planterGreens(b, M, -4.55, 5.95, 1.07, y + 0.85);
  for (let x = -4.6; x <= 6; x += 1.325) b.box(M.steel, x, y + 0.85, 0.27, x + 0.03, y + 1.15, 0.3, { collide: false });
  b.box(M.steel, -4.6, y + 1.12, 0.26, 6, y + 1.15, 0.31);

  // Khối bê tông trái: tường mặt tiền đặc (đúng như ảnh)
  b.tag('KhoiTrai');
  b.box(M.concrete, -6.125, y, -0.3, 1.5, top, 0);
  b.wall(null, 'z', -6, -0.3, -18, y, top + 0.3, TE,
    [
      { a0: -1.5, a1: -6, y0: 0.4, y1: 2.9, glass: true },
      { a0: -9, a1: -11, y0: 1.6, y1: 2.6, glass: true },
      { a0: -14.5, a1: -17, y0: 0.8, y1: 2.8, glass: true },
    ],
    { outer: M.concrete, out: -1 });
  b.wall(null, 'x', -17.85, -6, 1.5, y, top + 0.3, TE,
    [{ a0: -4.8, a1: -1.8, y0: 0.7, y1: 2.7, glass: true }, { a0: 0, a1: 1.2, y0: 1.6, y1: 2.5, glass: true }],
    { outer: M.concrete, out: -1 });

  // Khối phải: sân hiên, kính lùi vào z = -3, lam bê tông cao bên phải
  b.tag('KhoiPhai');
  b.box(M.deck, 1.5, y, 0.35, 5.6, y + 0.03, -3, { floor: true, collide: false });
  b.box(M.concrete, 5.6, y, 0.3, 6.0, 11.3, -5);
  b.glassPane('x', -3, 3.6, 5.6, y, top);
  slidingGlass(b, 'Cửa kính phòng sinh hoạt', 'CuaSinhHoatT2', 'x', -2.92, 1.6, 3.6, y, top, 1.9);
  b.glassPane('z', 1.5, -1.6, -3, y, top);
  slidingGlass(b, 'Cửa kính phòng ngủ master', 'CuaMasterT2', 'z', 1.42, -0.2, -1.6, y, top, -1.3);
  b.wall(null, 'z', 6, -5, -18, y, top + 0.3, TE, [], { outer: M.concrete, out: 1 });
  b.wall(null, 'x', -17.85, 1.5, 6, y, top + 0.3, TE,
    [{ a0: 2, a1: 3, y0: 1.5, y1: 2.5, glass: true }, { a0: 4, a1: 5.5, y0: 1, y1: 2.4, glass: true }],
    { outer: M.concrete, out: -1 });
  for (const x of [2.5, 4.5]) for (const z of [-0.7, -2.2]) b.downlight(x, top - 0.01, z);

  // Vách trong
  b.tag('VachTrong');
  b.wall(P, 'z', 1.5, -3, -8, y, top, TI, [{ a0: -5.4, a1: -6.3, y1: 2.2 }]);
  b.wall(P, 'z', 1.5, -8, -13, y, top, TI);
  b.wall(P, 'x', -8, -6, 1.5, y, top, TI, [{ a0: -0.6, a1: 0.3, y1: 2.2 }]);
  b.wall(P, 'z', -1.5, -8, -13, y, top, TI, [{ a0: -9.6, a1: -10.5, y1: 2.2 }]);
  b.wall(P, 'x', -13, -6, 1.5, y, top, TI);
  b.wall(P, 'z', -0.5, -13, -18, y, top, TI, [{ a0: -13.08, a1: -13.95, y1: 2.2 }]);
  b.wall(P, 'x', -14, -0.5, 6, y, top, TI, [{ a0: 0.6, a1: 1.5, y1: 2.2 }, { a0: 4.2, a1: 5.1, y1: 2.2 }]);
  b.wall(P, 'z', 3.2, -14, -18, y, top, TI);
  b.box(M.bathTile, -6, y, -8, -1.5, y + 0.01, -13, { floor: true, collide: false });
  b.box(M.bathTile, -0.5, y, -14, 3.2, y + 0.01, -18, { floor: true, collide: false });

  // Lỗ cầu thang: lan can kính, thang lên tầng 3
  b.tag('CauThang');
  railing(b, M, 'z', 3.2, -7, -12.6, y);
  railing(b, M, 'x', -7, 3.2, 5.9, y);
  stairs(b, M, 3.25, 4.5, -12.6, -7, y, H.L3, 17);
  b.sloped(M.glass, 4.49, 4.51, -12.6, y, -7, H.L3, 1.0, { cast: false });
  b.sloped(M.steel, 4.47, 4.53, -12.6, y + 1.0, -7, H.L3 + 1.0, 0.04, { collide: false });

  b.lamp(-2.5, top - 0.3, -4, 12, 9);
  b.lamp(3.8, top - 0.3, -5, 10, 7);
  b.lamp(3.5, top - 0.3, -1.4, 10, 7);
  b.lamp(-3, top - 0.3, -15.5, 9, 7);
  b.lamp(-3.5, top - 0.3, -10.5, 6, 6);
}

function planterGreens(b, M, x0, x1, z, yTop) {
  const rnd = makeRng(2);
  const n = 900;
  const geo = new THREE.BoxGeometry(0.012, 1, 0.05).translate(0, -0.5, 0);
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8 });
  mat.name = 'leafInstanced';
  const im = new THREE.InstancedMesh(geo, mat, n);
  im.name = 'l2_CayRu';
  const o = new THREE.Object3D(), c = new THREE.Color();
  for (let i = 0; i < n; i++) {
    o.position.set(x0 + rnd() * (x1 - x0), yTop + 0.05, z + rnd() * 0.06);
    o.rotation.set((rnd() - 0.5) * 0.25, rnd() * Math.PI, (rnd() - 0.5) * 0.2);
    o.scale.set(1, 0.15 + rnd() ** 2 * 0.75, 1);
    o.updateMatrix();
    im.setMatrixAt(i, o.matrix);
    im.setColorAt(i, c.setHSL(0.22 + rnd() * 0.06, 0.45, 0.28 + rnd() * 0.14));
  }
  im.castShadow = true;
  b.current.add(im);

  const bush = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), mat, 240);
  bush.name = 'l2_BuiCay';
  for (let i = 0; i < 240; i++) {
    o.position.set(x0 + rnd() * (x1 - x0), yTop + 0.02, 0.4 + rnd() * 0.6);
    o.rotation.set(0, rnd() * 6, 0);
    const s = 0.12 + rnd() * 0.12;
    o.scale.set(s, s * 0.8, s);
    o.updateMatrix();
    bush.setMatrixAt(i, o.matrix);
    bush.setColorAt(i, c.setHSL(0.23 + rnd() * 0.05, 0.5, 0.25 + rnd() * 0.12));
  }
  bush.castShadow = true;
  b.current.add(bush);
}

// ---------------------------------------------------------------- tầng 3 ---
function level3(b, M) {
  const y = H.L3, top = H.ROOF, h = top - y;
  b.level('l3', y);
  const P = M.plaster;
  const knee = roofY(-1.5);
  b.tag('San');

  b.slab(-6, -0.3, 1.5, -7, y, 0.3, M.woodFloor, M.ceiling);
  b.slab(1.5, 0.3, 6, -7, y, 0.3, M.woodFloor, M.ceiling);
  b.slab(-6, -7, 3.2, -12.6, y, 0.3, M.woodFloor, M.ceiling);
  b.slab(-6, -12.6, 6, -18, y, 0.3, M.woodFloor, M.ceiling);
  b.box(M.frame, 1.5, y - 0.35, 0.3, 5.6, y + 0.05, 0.36, { collide: false });

  // Đầu hồi phía trên (mặt tiền và mặt sau)
  b.tag('DauHoi');
  gable(b, M, 0, y - 0.3, []);
  gable(b, M, -17.7, y - 0.3, [[-1.1, 7.6, 1.1, 9.8]]);
  b.box(M.concrete, -6.125, y, -0.3, -5.875, roofY(-6), -17.7);

  // Hộp phòng ngủ tầng 3: ban công, lam gỗ xoay, lan can
  b.tag('HopPhongNgu');
  b.box(M.deck, 1.5, y, 0.3, 5.6, y + 0.03, -1.2, { floor: true, collide: false });
  for (let i = 0; i < 5; i++) {
    const fin = b.box(M.timberV, -0.13, 0, -0.025, 0.13, 2.65, 0.025);
    fin.position.set(1.85 + i * 0.32, y + 0.05 + 1.325, 0.15);
    fin.rotation.y = 0.95;
  }
  for (let x = 3.4; x < 5.6; x += 0.12) b.box(M.steel, x, y, 0.14, x + 0.02, y + 1.1, 0.16, { collide: false });
  b.box(M.steel, 3.35, y + 1.08, 0.12, 5.6, y + 1.12, 0.18, { collide: false });
  b.box(M.invisible, 1.5, y, 0.1, 5.6, y + 1.1, 0.2, { cast: false });
  b.box(M.frame, 1.5, top - 0.5, 0, 5.6, top + 0.3, 0.3);
  b.wall(null, 'z', 1.5, 0.3, -1.2, y, top, TE, [], { outer: M.concrete, out: 1 });
  b.glassPane('x', -1.2, 1.5, 3.6, y, top - 0.5);
  slidingGlass(b, 'Cửa kính ban công tầng 3', 'CuaBanCongT3', 'x', -1.12, 3.6, 5.6, y, top - 0.5, -1.9);
  b.box(M.frame, 1.5, top - 0.5, -1.25, 5.6, top, -1.15);

  // Tường ngoài phải + vách trong
  b.tag('Tuong');
  b.wall(null, 'z', 6, -5, -14, y, top, TE, [{ a0: -8, a1: -10, y0: 1.0, y1: 2.4, glass: true }], { outer: M.concrete, out: 1 });
  b.wall(P, 'z', -1.5, -0.3, -17.7, y, knee, TI); // tường lửng giáp gác mái
  b.wall(P, 'z', 1.5, -1.2, -5, y, top, TI, [{ a0: -3.6, a1: -4.5, y1: 2.2 }]);
  b.wall(P, 'x', -5, -1.5, 5.6, y, top, TI, [{ a0: 3.6, a1: 4.5, y1: 2.2 }]);
  b.wall(P, 'x', -7, -1.5, 3.2, y, top, TI, [{ a0: 1.0, a1: 1.9, y1: 2.2 }]);
  b.wall(P, 'z', 3.2, -7, -14, y, top, TI, [{ a0: -12.8, a1: -13.7, y1: 2.2 }]);
  b.box(M.bathTile, -1.5, y, -0.3, 1.5, y + 0.01, -5, { floor: true, collide: false });

  // Lỗ thang & lan can
  b.tag('CauThang');
  railing(b, M, 'x', -7, 4.5, 5.9, y);
  railing(b, M, 'x', -12.6, 3.2, 5.9, y);

  // Ra sân thượng phía sau
  b.tag('SanThuong');
  b.glassPane('x', -14, 1.5, 3.6, y, top);
  slidingGlass(b, 'Cửa ra sân thượng', 'CuaSanThuong', 'x', -13.92, 3.6, 5.4, y, top, -1.8);
  b.box(M.glass, 5.4, y, -14.01, 6, top, -13.99, { cast: false });
  b.wall(null, 'z', 1.5, -14, -18, y, H.PEAK, TE, [{ a0: -15, a1: -16.6, y1: 2.6 }], { outer: M.concrete, out: 1 });
  slidingGlass(b, 'Cửa kính phòng gia đình', 'CuaGiaDinhT3', 'z', 1.5, -15, -16.6, y, y + 2.6, 1.4);
  b.box(M.deck, 1.6, y, -14, 6, y + 0.03, -18, { floor: true, collide: false });
  railing(b, M, 'x', -18, 1.6, 6, y);
  railing(b, M, 'z', 6, -14, -18, y);

  b.lamp(3.6, top - 0.3, -3, 10, 7);
  b.lamp(0.2, top - 0.3, -10.5, 10, 8);
  b.lamp(0, 9.5, -16, 8, 7);
  b.lamp(0, 9.4, -2.5, 6, 5);
}

// ---------------------------------------------------------------- mái ---
function roof(b, M) {
  b.level('roof', H.ROOF);
  // Mái dốc khối trái, đua 0.6m ra phía trái và 0.3m trước/sau
  b.tag('MaiDoc');
  const x0 = -6.6, y0 = roofY(-6.6), x1 = 1.5, y1 = H.PEAK, t = 0.3;
  const len = Math.hypot(x1 - x0, y1 - y0), ang = Math.atan2(y1 - y0, x1 - x0);
  const c = M.concrete;
  const r = b.mesh(boxGeo(len, t, 18.6), [c, c, M.roofMetal, M.ceiling, c, c]);
  r.rotation.z = ang;
  r.position.set((x0 + x1) / 2 - Math.sin(ang) * t / 2, (y0 + y1) / 2 + Math.cos(ang) * t / 2, -9);
  b.box(M.soffit, -6.75, y0 - 0.35, 0.3, -6.6, y0 + 0.2, -18.3, { collide: false });

  // Mái bằng khối phải + lam che đỉnh
  b.tag('MaiBang');
  b.box([c, c, M.concrete, M.ceiling, c, c], 1.5, H.ROOF, 0.3, 6, H.ROOF + 0.3, -14);
  for (let i = 0; i < 4; i++) {
    const yy = H.ROOF + 0.38 + i * 0.12;
    b.box(M.steel, 1.5, yy, 0.22, 5.6, yy + 0.05, 0.3, { collide: false });
  }
  b.box(M.concrete, 1.2, H.ROOF, 0.3, 1.5, H.PEAK, -14);
  b.box(M.frame, 1.5, H.ROOF + 0.3, -14, 6, H.ROOF + 0.85, -13.9);
}
