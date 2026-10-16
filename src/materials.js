import * as THREE from 'three';
import * as T from './textures.js';

export function createMaterials(renderer) {
  const an = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const tx = (canvas, meters) => T.toTexture(canvas, meters, an);
  const std = (o) => new THREE.MeshStandardMaterial(o);

  const concreteMap = tx(T.boardConcrete(), 2.4);
  const timberH = tx(T.timberSlats(512, false), 1);
  const timberV = tx(T.timberSlats(512, true), 1);

  const M = {
    concrete: std({ map: concreteMap, bumpMap: concreteMap, bumpScale: 0.6, roughness: 0.92 }),
    plaster: std({ color: 0xefebe4, roughness: 0.95 }),
    ceiling: std({ color: 0xf6f4ef, roughness: 1 }),
    render: std({ color: 0xe8e4dc, roughness: 0.95 }), // tường trát sơn (nhà bên, tường rào)
    frame: std({ color: 0x5f6366, roughness: 0.6, metalness: 0.3 }), // khung/viền xám
    soffit: std({ color: 0x4d5054, roughness: 0.8 }),
    steel: std({ color: 0x2c2f33, roughness: 0.45, metalness: 0.7 }),
    timberH: std({ map: timberH, roughness: 0.7 }),
    timberV: std({ map: timberV, roughness: 0.7 }),
    timber: std({ color: 0x5a3324, roughness: 0.65 }),
    woodFloor: std({ map: tx(T.woodFloor(), 2.4), roughness: 0.55 }),
    marble: std({ map: tx(T.marble(), 1.6), roughness: 0.25 }),
    paving: std({ map: tx(T.tiles(512, 6, '#8d8e8b', '#5b5c5a', 14, 3), 1.2), roughness: 0.85 }),
    deck: std({ map: tx(T.timberSlats(512, true), 1), roughness: 0.8, color: 0xc89a78 }),
    bathTile: std({ map: tx(T.tiles(512, 2, '#cfcac1', '#9d988f', 6, 9), 1.2), roughness: 0.3 }),
    poolTile: std({ map: tx(T.tiles(512, 8, '#3e8fb0', '#e8f2f5', 10, 4), 1), roughness: 0.3 }),
    stone: std({ map: tx(T.darkStone(), 1), roughness: 0.55 }),
    grass: std({ map: tx(T.grass(), 2), roughness: 1 }),
    asphalt: std({ map: tx(T.asphalt(), 3), roughness: 0.95 }),
    roofMetal: std({ map: tx(T.roofMetal(), 2), roughness: 0.5, metalness: 0.4 }),
    roofTile: std({ color: 0xa5482f, roughness: 0.8 }),
    glass: new THREE.MeshPhysicalMaterial({
      color: 0xa9c2c8, roughness: 0.04, metalness: 0, transparent: true, opacity: 0.22,
      envMapIntensity: 1.6, side: THREE.DoubleSide, depthWrite: false,
    }),
    water: new THREE.MeshPhysicalMaterial({
      color: 0x2f9ec4, roughness: 0.03, transparent: true, opacity: 0.75, envMapIntensity: 1.5,
    }),
    // vật liệu tự phát sáng (đèn) — cường độ đổi theo ngày/tối
    lightWarm: std({ color: 0xfff3dc, emissive: 0xffc98a, emissiveIntensity: 2 }),
    // nội thất
    fabricLight: std({ color: 0xd8d0c2, roughness: 0.95 }),
    fabricDark: std({ color: 0x4b4f55, roughness: 0.95 }),
    fabricAccent: std({ color: 0x9c6b4e, roughness: 0.95 }),
    bedding: std({ color: 0xf1ede6, roughness: 1 }),
    walnut: std({ color: 0x5b3a29, roughness: 0.55 }),
    oak: std({ color: 0xb48a62, roughness: 0.55 }),
    whiteGloss: std({ color: 0xf4f4f2, roughness: 0.2 }),
    black: std({ color: 0x1b1c1e, roughness: 0.4, metalness: 0.4 }),
    screen: std({ color: 0x0b0c10, roughness: 0.15, metalness: 0.2 }),
    leaf: std({ color: 0x3f7a35, roughness: 0.85, flatShading: true }),
    leaf2: std({ color: 0x5c8f3a, roughness: 0.85, flatShading: true }),
    trunk: std({ color: 0x5a4636, roughness: 0.9 }),
    pot: std({ color: 0xcfc8bc, roughness: 0.8 }),
    carPaint: std({ color: 0x1f2a36, roughness: 0.25, metalness: 0.6 }),
    rubber: std({ color: 0x151515, roughness: 0.9 }),
    art1: std({ color: 0xc8643c, roughness: 0.9 }),
    art2: std({ color: 0x2f5d73, roughness: 0.9 }),
    book: std({ vertexColors: true, roughness: 0.8 }),
    invisible: new THREE.MeshBasicMaterial({ visible: false }),
  };
  for (const [k, mat] of Object.entries(M)) mat.name = k; // trùng tên vật liệu trong Blender
  return M;
}
