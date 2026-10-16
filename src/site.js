// Khu đất 15 x 34m: đường, vỉa hè, hàng rào nan gỗ + cổng trượt, sân sau có hồ bơi, cây xanh, nhà lân cận.
import * as THREE from 'three';
import { makeRng } from './rand.js';

let rnd;

export function buildSite(b, M) {
  b.level('site', 0);
  rnd = makeRng(1);
  b.tag('Nen');
  const nc = { collide: false };

  b.box(M.grass, -70, -0.25, 60, 70, -0.05, -70, { floor: true, collide: false, cast: false });
  b.box(M.asphalt, -70, -0.2, 16, 70, -0.04, 8.7, { floor: true, collide: false, cast: false });
  b.box(M.render, -70, -0.2, 8.7, 70, 0.1, 7.6, { floor: true, collide: false, cast: false }); // vỉa hè
  b.box(M.asphalt, -4.3, -0.2, 8.7, 3.6, 0.0, 7.4, { floor: true, collide: false, cast: false }); // dốc vào cổng
  // vạch kẻ đường
  for (let x = -68; x < 70; x += 6) b.box(M.render, x, -0.04, 12.45, x + 3, -0.03, 12.25, { collide: false, cast: false });

  // Sân trước lát gạch (gara) + lối bên hông
  b.box(M.paving, -6, -0.3, 7.4, 6, 0, -4, { floor: true, collide: false, cast: false });
  b.box(M.paving, 6, -0.3, 7.4, 7.5, 0, -18, { floor: true, collide: false, cast: false });

  // Hàng rào mặt tiền: trụ đá, nan gỗ ngang
  b.tag('HangRao');
  const zf = 7.2, fh = 1.75;
  b.box(M.stone, -7.5, 0, zf - 0.25, -6.95, 1.95, zf + 0.25);
  b.box(M.stone, 6.75, 0, zf - 0.25, 7.5, 1.95, zf + 0.25);
  b.box(M.stone, 3.4, 0, zf - 0.2, 3.65, fh + 0.05, zf + 0.2);
  b.box(M.stone, -4.55, 0, zf - 0.2, -4.3, fh + 0.05, zf + 0.2);
  b.box(M.timberH, -6.95, 0.1, zf - 0.06, -4.55, fh, zf + 0.06);
  b.box(M.timberH, 3.65, 0.1, zf - 0.06, 6.75, fh, zf + 0.06);
  // Cổng trượt 2 cánh (mặc định mở, như ảnh)
  const leafL = new THREE.Group(), leafR = new THREE.Group();
  leafL.name = 'DOOR_Cong_Trai';
  leafR.name = 'DOOR_Cong_Phai';
  b.current.add(leafL, leafR);
  b.box(M.timberH, -4.3, 0.06, zf + 0.12, -0.35, fh - 0.05, zf + 0.22, { parent: leafL });
  b.box(M.timberH, -0.35, 0.06, zf + 0.12, 3.4, fh - 0.05, zf + 0.22, { parent: leafR });
  b.door('Cổng', new THREE.Vector3(-0.35, 0, zf), [
    { obj: leafL, move: new THREE.Vector3(-3.6, 0, 0) },
    { obj: leafR, move: new THREE.Vector3(3.3, 0, 0) },
  ], true);

  // Tường rào hông và sau
  const wh = 2.0;
  b.box(M.render, -7.6, 0, 7.0, -7.4, wh, -27);
  b.box(M.render, 7.4, 0, 7.0, 7.6, wh, -27);
  b.box(M.render, -7.6, 0, -26.9, 7.6, wh, -27.1);

  // Sân sau: thềm đá, hồ bơi, cỏ
  b.tag('HoBoi');
  b.box(M.stone, -6, -0.3, -18, 6, 0, -19.6, { floor: true, collide: false, cast: false });
  const px0 = -5, px1 = 3, pz0 = -20.5, pz1 = -24.5, c = 0.35;
  b.box(M.stone, px0 - c, -0.3, pz0 + c, px1 + c, 0.03, pz0, { floor: true, collide: false });
  b.box(M.stone, px0 - c, -0.3, pz1, px1 + c, 0.03, pz1 - c, { floor: true, collide: false });
  b.box(M.stone, px0 - c, -0.3, pz0, px0, 0.03, pz1, { floor: true, collide: false });
  b.box(M.stone, px1, -0.3, pz0, px1 + c, 0.03, pz1, { floor: true, collide: false });
  b.box(M.poolTile, px0, -1.4, pz0, px1, -1.3, pz1, nc);
  b.box(M.poolTile, px0, -1.4, pz0, px1, 0, pz0 - 0.02, nc);
  b.box(M.poolTile, px0, -1.4, pz1 + 0.02, px1, 0, pz1, nc);
  b.box(M.poolTile, px0, -1.4, pz0, px0 + 0.02, 0, pz1, nc);
  b.box(M.poolTile, px1 - 0.02, -1.4, pz0, px1, 0, pz1, nc);
  const water = b.box(M.water, px0, -0.14, pz0, px1, -0.12, pz1, { collide: false, cast: false });
  water.receiveShadow = false;
  b.box(M.invisible, px0, -0.3, pz0, px1, 1.2, pz1, { cast: false }); // không cho rơi xuống hồ

  // Ghế tắm nắng bên hồ
  for (const x of [4.2, 5.4]) {
    b.box(M.whiteGloss, x - 0.32, 0.25, -20.8, x + 0.32, 0.35, -22.8);
    const back = b.box(M.whiteGloss, -0.32, -0.05, -0.4, 0.32, 0.05, 0.4);
    back.position.set(x, 0.52, -20.95);
    back.rotation.x = -0.9;
  }

  // Cây xanh
  const trees = [
    [-10.5, 2.5, 1.25], [-9.2, -5, 1.1], [-11, -14, 1.3], [9.8, 5.2, 1.15],
    [-5.6, -25.5, 0.9], [5.8, -25.6, 0.85], [-6.8, 4.8, 0.55], [-6.8, -21, 0.6],
  ];
  for (const [x, z, s] of trees) tree(b, M, x, z, s);
  for (let z = -5; z > -17; z -= 1.4) shrub(b, M, -6.8, z, 0.45);
  for (let x = -6.5; x < 7; x += 1.3) shrub(b, M, x, -26.4, 0.55);

  // Nhà lân cận (khối đơn giản, mái ngói đỏ) & toà nhà cao phía xa
  b.tag('NhaBen');
  b.box(M.render, 8.2, 0, 4, 21, 6.6, -14);
  b.box(M.frame, 8.1, 3.3, 4.05, 21, 3.45, -14);
  for (let x = 9.2; x < 20; x += 2.4) {
    b.box(M.glass, x, 4.2, 4.02, x + 1.4, 5.9, 4.05, { collide: false, cast: false });
    b.box(M.glass, x, 1.0, 4.02, x + 1.4, 2.6, 4.05, { collide: false, cast: false });
  }
  const hip = b.mesh(new THREE.ConeGeometry(1, 1, 4, 1), M.roofTile);
  hip.rotation.y = Math.PI / 4;
  hip.scale.set(9.8, 2.6, 13.6);
  hip.position.set(14.6, 6.6 + 1.3, -5);
  b.box(M.roofTile, 7.6, 3.5, 4.8, 21, 3.7, 3.4, { collide: false });
  b.box(M.render, -48, 0, -25, -34, 34, -45);
  b.box(M.render, 26, 0, -30, 40, 22, -44);
}

function tree(b, M, x, z, s) {
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.12 * s, 0.2 * s, 3.2 * s, 8), M.trunk);
  trunk.position.y = 1.6 * s;
  g.add(trunk);
  const ico = new THREE.IcosahedronGeometry(1, 1);
  for (let i = 0; i < 9; i++) {
    const m = new THREE.Mesh(ico, i % 3 ? M.leaf : M.leaf2);
    const a = (i / 9) * Math.PI * 2;
    const r = i === 0 ? 0 : 1.1 + rnd() * 0.6;
    m.position.set(Math.cos(a) * r * s, (3.6 + rnd() * 1.4) * s, Math.sin(a) * r * s);
    m.scale.setScalar((1.0 + rnd() * 0.6) * s);
    m.userData.noCollide = true;
    g.add(m);
  }
  g.position.set(x, 0, z);
  b.add(g, { type: 'Cay' });
}

function shrub(b, M, x, z, s) {
  const m = new THREE.Mesh(new THREE.IcosahedronGeometry(s, 1), rnd() > 0.5 ? M.leaf : M.leaf2);
  m.position.set(x, s * 0.7, z);
  m.scale.y = 0.8;
  b.add(m, { collide: false, type: 'Bui' });
}
