// Nội thất dựng bằng khối cơ bản. Mỗi món dựng theo toạ độ cục bộ (mặt trước hướng +z) rồi đặt vào phòng.
// Khi làm bản đẹp: thay từng hàm bằng model GLB từ Blender cùng tên (xem THIET_KE.md).
import * as THREE from 'three';
import { boxGeo } from './builder.js';
import { makeRng } from './rand.js';

let M, rnd;
const bookMats = [];
function grp(type) {
  const g = new THREE.Group();
  g.userData.type = type; // tên nhóm: <tầng>_<type>_NN
  return g;
}
function part(g, mat, x0, y0, z0, x1, y1, z1, opt = {}) {
  const m = new THREE.Mesh(boxGeo(Math.abs(x1 - x0), Math.abs(y1 - y0), Math.abs(z1 - z0)), mat);
  m.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  if (opt.noCollide) m.userData.noCollide = true;
  g.add(m);
  return m;
}
function cyl(g, mat, r, h, x, y, z, seg = 20) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, seg), mat);
  m.position.set(x, y + h / 2, z);
  g.add(m);
  return m;
}
function place(b, g, x, y, z, rot = 0, o) {
  g.position.set(x, y, z);
  g.rotation.y = rot;
  return b.add(g, o);
}

// ------------------------------------------------------------- món đồ ---
function sofa(w = 2.6, d = 0.95, mat = M.fabricLight) {
  const g = grp('Sofa');
  part(g, M.walnut, -w / 2, 0, -d / 2, w / 2, 0.12, d / 2);
  part(g, mat, -w / 2, 0.12, -d / 2, w / 2, 0.45, d / 2);
  part(g, mat, -w / 2, 0.45, -d / 2, w / 2, 0.85, -d / 2 + 0.22);
  part(g, mat, -w / 2, 0.45, -d / 2, -w / 2 + 0.2, 0.65, d / 2);
  part(g, mat, w / 2 - 0.2, 0.45, -d / 2, w / 2, 0.65, d / 2);
  for (let i = 0; i < 3; i++) {
    const x = -w / 2 + 0.45 + i * ((w - 0.9) / 2);
    part(g, M.fabricAccent, x - 0.22, 0.45, -d / 2 + 0.22, x + 0.22, 0.85, -d / 2 + 0.36, { noCollide: true });
  }
  return g;
}
function table(w, d, h, top = M.walnut, leg = M.black) {
  const g = grp('Ban');
  part(g, top, -w / 2, h - 0.05, -d / 2, w / 2, h, d / 2);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) part(g, leg, sx * (w / 2 - 0.08) - 0.025, 0, sz * (d / 2 - 0.08) - 0.025, sx * (w / 2 - 0.08) + 0.025, h - 0.05, sz * (d / 2 - 0.08) + 0.025, { noCollide: true });
  return g;
}
function chair(mat = M.oak) {
  const g = grp('Ghe');
  part(g, mat, -0.22, 0.44, -0.22, 0.22, 0.48, 0.22);
  part(g, mat, -0.22, 0.48, -0.22, 0.22, 0.9, -0.18);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) part(g, M.black, sx * 0.19 - 0.015, 0, sz * 0.19 - 0.015, sx * 0.19 + 0.015, 0.44, sz * 0.19 + 0.015);
  return g;
}
function bed(w = 1.9, l = 2.1) {
  const g = grp('Giuong');
  part(g, M.walnut, -w / 2 - 0.05, 0, -l / 2, w / 2 + 0.05, 0.3, l / 2);
  part(g, M.bedding, -w / 2, 0.3, -l / 2 + 0.05, w / 2, 0.55, l / 2);
  part(g, M.fabricAccent, -w / 2 - 0.02, 0.5, l / 2 - 0.65, w / 2 + 0.02, 0.58, l / 2 - 0.2, { noCollide: true });
  part(g, M.fabricDark, -w / 2 - 0.2, 0, -l / 2 - 0.08, w / 2 + 0.2, 1.15, -l / 2); // đầu giường
  for (const sx of [-1, 1]) part(g, M.whiteGloss, sx * w / 4 - 0.3, 0.55, -l / 2 + 0.1, sx * w / 4 + 0.3, 0.68, -l / 2 + 0.5, { noCollide: true });
  for (const sx of [-1, 1]) {
    part(g, M.walnut, sx * (w / 2 + 0.55) - 0.25, 0, -l / 2, sx * (w / 2 + 0.55) + 0.25, 0.5, -l / 2 + 0.42);
    lampOn(g, sx * (w / 2 + 0.55), 0.5, -l / 2 + 0.2);
  }
  return g;
}
function lampOn(g, x, y, z) {
  cyl(g, M.black, 0.015, 0.3, x, y, z);
  const shade = cyl(g, M.lightWarm, 0.12, 0.18, x, y + 0.3, z);
  shade.userData.noCollide = true;
}
function floorLamp() {
  const g = grp('DenSan');
  cyl(g, M.black, 0.15, 0.03, 0, 0, 0);
  cyl(g, M.black, 0.015, 1.5, 0, 0, 0);
  cyl(g, M.lightWarm, 0.2, 0.28, 0, 1.45, 0);
  return g;
}
function cabinet(w, h, d, mat = M.walnut, top = null) {
  const g = grp('Tu');
  part(g, mat, -w / 2, 0, -d / 2, w / 2, h, d / 2);
  if (top) part(g, top, -w / 2 - 0.02, h, -d / 2 - 0.02, w / 2 + 0.02, h + 0.04, d / 2 + 0.02);
  const n = Math.max(1, Math.round(w / 0.6));
  for (let i = 1; i < n; i++) part(g, M.black, -w / 2 + (w * i) / n - 0.004, 0.05, d / 2, -w / 2 + (w * i) / n + 0.004, h - 0.05, d / 2 + 0.005, { noCollide: true });
  return g;
}
function tv(w = 1.6) {
  const g = grp('TV');
  part(g, M.screen, -w / 2, 0, -0.03, w / 2, w * 0.5625, 0.03);
  return g;
}
function plant(s = 1) {
  const g = grp('Chau');
  cyl(g, M.pot, 0.22 * s, 0.45 * s, 0, 0, 0);
  const ico = new THREE.IcosahedronGeometry(1, 1);
  for (let i = 0; i < 5; i++) {
    const m = new THREE.Mesh(ico, i % 2 ? M.leaf : M.leaf2);
    m.position.set((rnd() - 0.5) * 0.4 * s, (0.75 + rnd() * 0.6) * s, (rnd() - 0.5) * 0.4 * s);
    m.scale.setScalar((0.22 + rnd() * 0.12) * s);
    m.userData.noCollide = true;
    g.add(m);
  }
  return g;
}
function rug(w, d, mat = M.fabricDark) {
  const g = grp('Tham');
  part(g, mat, -w / 2, 0, -d / 2, w / 2, 0.015, d / 2);
  return g;
}
function shelf(w, h, d = 0.35, books = true) {
  const g = grp('KeSach');
  part(g, M.oak, -w / 2, 0, -d / 2, w / 2, h, -d / 2 + 0.02);
  part(g, M.oak, -w / 2, 0, -d / 2, -w / 2 + 0.03, h, d / 2);
  part(g, M.oak, w / 2 - 0.03, 0, -d / 2, w / 2, h, d / 2);
  const rows = Math.floor(h / 0.38);
  const colors = [0x8c3b2e, 0x2f5d73, 0xd9c7a3, 0x3d4a3a, 0x6b4a7a, 0xc69c3a];
  for (let r = 0; r <= rows; r++) {
    const y = r * (h / rows);
    part(g, M.oak, -w / 2, y, -d / 2, w / 2, y + 0.025, d / 2, { noCollide: true });
    if (!books || r === rows) continue;
    let x = -w / 2 + 0.05;
    while (x < w / 2 - 0.1) {
      const bw = 0.025 + rnd() * 0.03, bh = 0.2 + rnd() * 0.1;
      const ci = (rnd() * colors.length) | 0;
      const mat = (bookMats[ci] ??= Object.assign(new THREE.MeshStandardMaterial({ color: colors[ci], roughness: 0.8 }), { name: 'book_' + ci }));
      part(g, mat, x, y + 0.025, -d / 2 + 0.04, x + bw, y + 0.025 + bh, d / 2 - 0.05, { noCollide: true });
      x += bw + 0.004 + (rnd() < 0.08 ? 0.12 : 0);
    }
  }
  return g;
}
function toilet() {
  const g = grp('BonCau');
  part(g, M.whiteGloss, -0.19, 0, -0.35, 0.19, 0.4, 0.3);
  part(g, M.whiteGloss, -0.2, 0.4, -0.35, 0.2, 0.8, -0.2);
  return g;
}
function vanity(w = 1.2) {
  const g = grp('Lavabo');
  part(g, M.walnut, -w / 2, 0.35, -0.25, w / 2, 0.82, 0.25);
  part(g, M.marble, -w / 2, 0.82, -0.26, w / 2, 0.86, 0.26);
  part(g, M.whiteGloss, -0.2, 0.86, -0.15, 0.2, 0.92, 0.15, { noCollide: true });
  part(g, M.screen, -w / 2, 1.1, -0.27, w / 2, 1.9, -0.25, { noCollide: true });
  return g;
}
function tub() {
  const g = grp('BonTam');
  part(g, M.whiteGloss, -0.85, 0, -0.4, 0.85, 0.55, 0.4);
  part(g, M.water, -0.75, 0.4, -0.3, 0.75, 0.56, 0.3, { noCollide: true });
  return g;
}
function shower(w = 1.0, d = 1.0) {
  const g = grp('Sen');
  part(g, M.stone, -w / 2, 0, -d / 2, w / 2, 0.02, d / 2, { noCollide: true });
  part(g, M.glass, -w / 2, 0, d / 2 - 0.01, w / 2 - 0.4, 2.0, d / 2 + 0.01);
  cyl(g, M.steel, 0.12, 0.02, 0, 2.1, -d / 2 + 0.2);
  return g;
}
function car() {
  const g = grp('Xe');
  part(g, M.carPaint, -0.9, 0.3, -2.35, 0.9, 0.85, 2.35);
  part(g, M.carPaint, -0.82, 0.85, -1.2, 0.82, 1.38, 1.0);
  part(g, M.screen, -0.83, 0.92, 1.0, 0.83, 1.3, 1.05, { noCollide: true });
  part(g, M.screen, -0.84, 0.92, -1.1, 0.84, 1.3, 0.9, { noCollide: true });
  part(g, M.lightWarm, -0.8, 0.6, 2.35, -0.5, 0.7, 2.37, { noCollide: true });
  part(g, M.lightWarm, 0.5, 0.6, 2.35, 0.8, 0.7, 2.37, { noCollide: true });
  for (const sx of [-1, 1]) for (const sz of [-1.45, 1.45]) {
    const w = new THREE.Mesh(new THREE.CylinderGeometry(0.33, 0.33, 0.24, 20), M.rubber);
    w.rotation.z = Math.PI / 2;
    w.position.set(sx * 0.82, 0.33, sz);
    w.userData.noCollide = true;
    g.add(w);
  }
  return g;
}
function lounger() {
  const g = grp('GheNam');
  part(g, M.oak, -0.33, 0.2, -0.95, 0.33, 0.3, 0.95);
  part(g, M.fabricLight, -0.3, 0.3, -0.4, 0.3, 0.38, 0.92);
  const back = part(g, M.fabricLight, -0.3, -0.04, -0.3, 0.3, 0.04, 0.3);
  back.position.set(0, 0.55, -0.7);
  back.rotation.x = -0.9;
  return g;
}
function pendant(drop = 0.9) {
  const g = grp('DenTha');
  cyl(g, M.black, 0.005, drop, 0, -drop, 0);
  const s = new THREE.Mesh(new THREE.SphereGeometry(0.14, 20, 12), M.lightWarm);
  s.position.y = -drop - 0.1;
  g.add(s);
  return g;
}
function art(w, h, mat) {
  const g = grp('Tranh');
  part(g, M.black, -w / 2 - 0.03, -0.03, -0.02, w / 2 + 0.03, h + 0.03, 0);
  part(g, mat, -w / 2, 0, 0, w / 2, h, 0.01);
  return g;
}
function wardrobe(w, h = 2.4) {
  const g = cabinet(w, h, 0.6, M.oak);
  g.userData.type = 'TuQuanAo';
  return g;
}
function boxes() {
  const g = grp('Thung');
  for (let i = 0; i < 6; i++) {
    const s = 0.35 + rnd() * 0.25;
    part(g, M.oak, -s / 2 + i * 0.6 - 1.5, 0, -s / 2, s / 2 + i * 0.6 - 1.5, s, s / 2);
  }
  return g;
}

// ------------------------------------------------------------- bố trí ---
export function furnish(b, mats) {
  M = mats;
  rnd = makeRng(3);
  const P = Math.PI;

  // TẦNG 1 (cao độ 0)
  b.level('g', 0);
  place(b, car(), -0.6, 0, 1.7, 0);
  // Phòng khách: TV trên mặt trong tường bê tông, sofa quay về phía TV
  place(b, cabinet(2.6, 0.45, 0.42, M.walnut), -1.3, 0, -4.4);
  place(b, tv(1.9), -1.3, 1.05, -4.2);
  place(b, rug(3.4, 2.4), -1.6, 0, -6.6, 0, { collide: false });
  place(b, sofa(2.9), -1.4, 0, -8.2, 0);
  place(b, sofa(1.8, 0.9, M.fabricDark), -4.6, 0, -6.6, P / 2);
  place(b, table(1.2, 0.6, 0.38), -1.4, 0, -6.5);
  place(b, floorLamp(), 0.6, 0, -8.6);
  place(b, plant(1.3), -5.4, 0, -4.6);
  place(b, plant(1), 0.9, 0, -4.6);
  // Phòng ăn
  place(b, table(2.2, 1.0, 0.76, M.oak), -2.6, 0, -12);
  for (const dx of [-0.7, 0, 0.7]) {
    place(b, chair(), -2.6 + dx, 0, -12.75, 0);
    place(b, chair(), -2.6 + dx, 0, -11.25, P);
  }
  for (const dx of [-0.6, 0, 0.6]) place(b, pendant(1.4), -2.6 + dx, 3.6, -12, 0, { collide: false, cast: false });
  place(b, cabinet(2.4, 0.85, 0.45, M.walnut, M.marble), -5.7, 0, -12, P / 2);
  place(b, art(1.4, 0.9, M.art1), -5.85, 1.5, -12, P / 2, { collide: false });
  // Bếp: tủ bếp dọc tường phải + đảo bếp
  place(b, cabinet(3.6, 0.88, 0.6, M.whiteGloss, M.marble), 5.6, 0, -16, -P / 2);
  place(b, cabinet(3.6, 0.7, 0.35, M.whiteGloss), 5.75, 1.5, -16, -P / 2);
  place(b, cabinet(0.9, 2.2, 0.65, M.black), 5.55, 0, -14.4, -P / 2);
  place(b, cabinet(2.6, 0.9, 1.0, M.walnut, M.marble), 1.8, 0, -15.8);
  for (const dx of [-0.8, 0, 0.8]) {
    const s = grp('GheDon');
    cyl(s, M.black, 0.02, 0.62, 0, 0, 0);
    cyl(s, M.fabricDark, 0.19, 0.06, 0, 0.62, 0);
    place(b, s, 1.8 + dx, 0, -15.0);
  }
  for (const dx of [-0.7, 0.7]) place(b, pendant(1.1), 1.8 + dx, 3.6, -15.8, 0, { collide: false, cast: false });
  place(b, table(1.6, 0.9, 0.74, M.oak), -3.5, 0, -16.2);
  for (const dx of [-0.45, 0.45]) {
    place(b, chair(), -3.5 + dx, 0, -16.9, 0);
    place(b, chair(), -3.5 + dx, 0, -15.5, P);
  }
  // Sảnh, WC khách, kho
  place(b, cabinet(1.6, 0.9, 0.38, M.oak), 3.9, 0, -6.75, 0);
  place(b, art(0.9, 1.2, M.art2), 3.9, 1.3, -6.92, 0, { collide: false });
  place(b, plant(0.9), 5.6, 0, -4.5);
  place(b, toilet(), 2.35, 0, -9.55, 0);
  place(b, vanity(0.8), 1.85, 0, -8.3, P / 2);
  place(b, shelf(1.2, 2.2, 0.45, false), 2.35, 0, -12.7, 0);

  // TẦNG 2 (3.9)
  const y2 = 3.9;
  b.level('l2', y2);
  place(b, bed(1.9, 2.1), -3.3, y2, -6.85, 0);
  place(b, rug(3.2, 2.2), -3.3, y2, -5.3, 0, { collide: false });
  place(b, cabinet(2.2, 0.5, 0.4, M.walnut), -3.3, y2, -0.55, P);
  place(b, tv(1.5), -3.3, y2 + 1.0, -0.38, P);
  place(b, sofa(1.0, 0.85, M.fabricAccent), 0.6, y2, -2.4, -P / 2);
  place(b, plant(1.1), 0.9, y2, -0.6);
  place(b, art(1.6, 1.0, M.art1), -5.85, y2 + 1.3, -6.5, P / 2, { collide: false });
  // Tủ đồ
  place(b, wardrobe(4.6), -1.15, y2, -10.5, P / 2);
  place(b, wardrobe(4.6), 1.15, y2, -10.5, -P / 2);
  // Phòng tắm master
  place(b, tub(), -4.6, y2, -12.4, 0);
  place(b, vanity(1.8), -5.65, y2, -9.8, P / 2);
  place(b, shower(1.1, 1.1), -2.2, y2, -8.7, P);
  place(b, toilet(), -2.1, y2, -12.55, 0);
  // Sinh hoạt tầng 2 + sân hiên
  place(b, sofa(2.4, 0.9, M.fabricDark), 3.7, y2, -6.4, 0);
  place(b, table(0.9, 0.5, 0.4), 3.7, y2, -5.2);
  place(b, lounger(), 2.4, y2, -1.4, 0);
  place(b, lounger(), 3.4, y2, -1.4, 0);
  place(b, plant(1.2), 5.1, y2, -0.1);
  // Hành lang
  place(b, art(1.0, 1.4, M.art2), 1.58, y2 + 1.1, -10.5, P / 2, { collide: false });
  // Phòng ngủ 2
  place(b, bed(1.6, 2.0), -3.4, y2, -16.7, 0);
  place(b, table(1.2, 0.6, 0.75, M.oak), -5.6, y2, -16.6, P / 2);
  place(b, chair(), -5.0, y2, -16.6, -P / 2);
  place(b, wardrobe(2.0), -1.0, y2, -16.6, -P / 2);
  // Phòng tắm 2, phòng giặt
  place(b, vanity(1.0), 0.2, y2, -17.6, 0);
  place(b, toilet(), 1.4, y2, -17.55, 0);
  place(b, shower(1.1, 1.2), 2.55, y2, -17.3, 0);
  place(b, cabinet(1.3, 0.88, 0.6, M.whiteGloss, M.marble), 4.6, y2, -17.6, 0);
  place(b, cabinet(0.6, 0.85, 0.6, M.whiteGloss), 5.6, y2, -15.5, -P / 2);

  // TẦNG 3 (7.2)
  const y3 = 7.2;
  b.level('l3', y3);
  place(b, bed(1.8, 2.1), 4.45, y3, -3.0, -P / 2);
  place(b, rug(2.6, 1.6), 3.3, y3, -3.0, P / 2, { collide: false });
  place(b, chair(M.walnut), 2.2, y3, -0.6, 0);
  place(b, chair(M.walnut), 3.0, y3, -0.6, 0);
  place(b, table(0.5, 0.5, 0.45), 2.6, y3, -0.65);
  // Phòng tắm tầng 3 (dưới mái dốc)
  place(b, tub(), 0, y3, -0.8, P);
  place(b, vanity(1.4), -1.25, y3, -3.2, P / 2);
  place(b, toilet(), 0.9, y3, -4.55, 0);
  // Thư viện
  place(b, shelf(5.6, 2.3), -1.25, y3, -10.3, P / 2);
  place(b, table(1.6, 0.8, 0.75, M.walnut), 1.4, y3, -9.5);
  place(b, chair(M.walnut), 1.4, y3, -10.2, 0);
  place(b, sofa(1.0, 0.85, M.fabricAccent), 2.5, y3, -12.3, -P / 2);
  place(b, floorLamp(), 2.7, y3, -11.3);
  // Phòng gia đình + sân thượng
  place(b, sofa(2.4), 0, y3, -17.3, 0);
  place(b, rug(2.6, 1.8, M.fabricAccent), 0, y3, -15.9, 0, { collide: false });
  place(b, table(1.0, 0.6, 0.38), 0, y3, -15.9);
  place(b, lounger(), 3.0, y3, -16.6, P);
  place(b, lounger(), 4.2, y3, -16.6, P);
  place(b, plant(1.3), 5.5, y3, -17.4);
  place(b, plant(1.0), 2.0, y3, -17.5);
  // Gác mái
  place(b, boxes(), -4, y3, -9, P / 2);
}
