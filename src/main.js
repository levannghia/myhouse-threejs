import * as THREE from 'three';
import { gsap } from 'gsap';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Sky } from 'three/addons/objects/Sky.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { Builder, applyDoor } from './builder.js';
import { createMaterials } from './materials.js';
import { buildHouse } from './house.js';
import { buildSite } from './site.js';
import { furnish } from './furniture.js';
import { Walker } from './walker.js';
import { addRooms } from './rooms.js';
import { fileExists, loadGlbHouse } from './glbHouse.js';
import { createInteractions } from './interact.js';

const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: false });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.05, 500);
// đăng ký sớm: trong lúc chờ tải GLB cửa sổ có thể đổi kích thước
function resize() {
  camera.aspect = innerWidth / Math.max(1, innerHeight);
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
}
addEventListener('resize', resize);

const M = createMaterials(renderer);
const b = new Builder(scene, M);

// assets.json liệt kê file có sẵn (GLB, lightmap) để khỏi dò file — trên host tĩnh như GitHub Pages,
// dò một file không tồn tại sẽ hiện lỗi 404 trên console. Không có assets.json thì mới dò (server.js trả 204).
let assets = null;
try {
  const r = await fetch('assets.json', { cache: 'no-store' });
  if (r.ok) assets = await r.json();
} catch {}
// Nguồn mô hình: ?glb=1 bắt buộc dùng GLB, ?glb=0 bắt buộc dựng bằng code, không có thì theo assets.json / tự dò
const GLB_URL = assets?.glb || 'models/nha.glb';
const glbParam = new URLSearchParams(location.search).get('glb');
const hasGlb = assets ? !!assets.glb : await fileExists(GLB_URL);
let source = 'code';
if (glbParam === '1' || (glbParam !== '0' && hasGlb)) {
  try {
    await loadGlbHouse(b, M, GLB_URL, assets ? assets.lightmaps || [] : null);
    source = 'glb';
  } catch (err) {
    console.warn('Không tải được ' + GLB_URL + ', dựng nhà bằng code.', err);
    for (const g of Object.values(b.levels)) g.removeFromParent();
    Object.assign(b, { levels: {}, colliders: [], floors: [], doors: [], lamps: [], counts: {} });
  }
}
if (source === 'code') {
  buildSite(b, M);
  buildHouse(b, M);
  furnish(b, M);
}
addRooms(b);
resize();
scene.updateMatrixWorld(true); // raycast va chạm cần ma trận ngay cả trước khung hình đầu
document.getElementById('source').textContent = source === 'glb' ? 'Mô hình: GLB từ Blender' : 'Mô hình: dựng bằng code';

// ---------------------------------------------------------------- ánh sáng ---
const sun = new THREE.DirectionalLight(0xffffff, 3);
sun.castShadow = true;
sun.shadow.mapSize.set(4096, 4096);
Object.assign(sun.shadow.camera, { left: -26, right: 26, top: 26, bottom: -26, near: 1, far: 120 });
sun.shadow.bias = -0.0004;
sun.shadow.normalBias = 0.03;
sun.target.position.set(0, 4, -9);
scene.add(sun, sun.target);
const hemi = new THREE.HemisphereLight(0xcfe3ff, 0x4a4036, 1);
scene.add(hemi);

const sky = new Sky();
sky.scale.setScalar(100);
const skyScene = new THREE.Scene();
skyScene.add(sky);
const pmrem = new THREE.PMREMGenerator(renderer);
let envRT = null;

const TIMES = {
  day: { elev: 40, azim: 215, turb: 2, ray: 1.0, sun: 2.4, hemi: 0.55, exp: 0.5, lamps: 0.15, glow: 0.4, sunColor: 0xfff4e6, env: 0.9 },
  dusk: { elev: 1.2, azim: 245, turb: 6, ray: 2.2, sun: 0.6, hemi: 0.7, exp: 1.0, lamps: 1, glow: 2.6, sunColor: 0xffb27a, env: 0.55 },
};
for (const l of b.lamps) l.user ??= 1; // hệ số bật/tắt của người dùng (interact.js)
// trạng thái ánh sáng hiện tại — GSAP nội suy giữa ngày và hoàng hôn
const timeState = { ...TIMES.dusk, color: new THREE.Color(TIMES.dusk.sunColor) };
let interactions = null;
let lastEnv = 0;
function applyTime(forceEnv) {
  const t = timeState;
  const u = sky.material.uniforms;
  u.turbidity.value = t.turb;
  u.rayleigh.value = t.ray;
  u.mieCoefficient.value = 0.004;
  u.mieDirectionalG.value = 0.8;
  const phi = THREE.MathUtils.degToRad(90 - t.elev), theta = THREE.MathUtils.degToRad(t.azim);
  const dir = new THREE.Vector3().setFromSphericalCoords(1, phi, theta);
  u.sunPosition.value.copy(dir);
  // PMREM tốn ~vài ms: trong lúc chuyển chỉ tính lại mỗi 120ms
  const now = performance.now();
  if (forceEnv || now - lastEnv > 120) {
    lastEnv = now;
    const old = envRT;
    envRT = pmrem.fromScene(skyScene, 0, 0.1, 1000);
    scene.background = envRT.texture;
    scene.environment = envRT.texture;
    old?.dispose();
  }
  scene.environmentIntensity = t.env;
  sun.position.copy(sun.target.position).addScaledVector(dir.clone().setY(Math.max(dir.y, 0.25)).normalize(), 60);
  sun.intensity = t.sun;
  sun.color.copy(t.color);
  hemi.intensity = t.hemi;
  renderer.toneMappingExposure = t.exp;
  for (const l of b.lamps) l.light.intensity = l.base * t.lamps * l.user;
  M.lightWarm.emissiveIntensity = t.glow;
  interactions?.updateGlow();
}
function setTime(mode, instant = false) {
  const to = TIMES[mode];
  document.querySelectorAll('[data-time]').forEach((el) => el.classList.toggle('on', el.dataset.time === mode));
  gsap.killTweensOf(timeState);
  gsap.killTweensOf(timeState.color);
  const nums = Object.fromEntries(Object.entries(to).filter(([k]) => k !== 'sunColor'));
  if (instant) {
    Object.assign(timeState, nums);
    timeState.color.set(to.sunColor);
    return applyTime(true);
  }
  const c = new THREE.Color(to.sunColor);
  gsap.to(timeState.color, { r: c.r, g: c.g, b: c.b, duration: 2.6, ease: 'sine.inOut' });
  gsap.to(timeState, { ...nums, duration: 2.6, ease: 'sine.inOut', onUpdate: () => applyTime(false), onComplete: () => applyTime(true) });
}

// ---------------------------------------------------------------- điều khiển ---
const orbit = new OrbitControls(camera, canvas);
orbit.enableDamping = true;
orbit.maxPolarAngle = Math.PI * 0.495;
orbit.minDistance = 2;
orbit.maxDistance = 90;
const HOME = { pos: new THREE.Vector3(0.8, 2.4, 19.5), target: new THREE.Vector3(0.3, 5.9, -3) };
// bay camera mượt tới vị trí + điểm nhìn mới
function flyTo(pos, target, duration = 1.6, ease = 'power3.inOut') {
  gsap.killTweensOf(camera.position);
  gsap.killTweensOf(orbit.target);
  gsap.to(camera.position, { x: pos.x, y: pos.y, z: pos.z, duration, ease });
  gsap.to(orbit.target, { x: target.x, y: target.y, z: target.z, duration, ease, onUpdate: () => orbit.update() });
}
const homeView = (d) => flyTo(HOME.pos, HOME.target, d);
camera.position.set(-38, 26, 58); // điểm bắt đầu của cảnh mở màn
orbit.target.copy(HOME.target);
orbit.update();

const walker = new Walker(camera, canvas, b);
let mode = 'orbit';
const $ = (s) => document.querySelector(s);
const hint = $('#hint'), roomEl = $('#room'), lockCard = $('#lock'), fade = $('#fade'), tip = $('#tip'), toastEl = $('#toast');

const ui = {
  toast(msg) {
    toastEl.textContent = msg;
    gsap.killTweensOf(toastEl);
    gsap.timeline()
      .fromTo(toastEl, { autoAlpha: 0, y: 14 }, { autoAlpha: 1, y: 0, duration: 0.35, ease: 'back.out(2)' })
      .to(toastEl, { autoAlpha: 0, y: -8, duration: 0.4, ease: 'power2.in' }, '+=1.8');
  },
};

function setMode(m, placeFn) {
  mode = m;
  walker.enabled = false; // bật lại khi màn đen che xong, tránh thấy camera nhảy
  orbit.enabled = m === 'orbit';
  document.querySelectorAll('[data-mode]').forEach((el) => el.classList.toggle('on', el.dataset.mode === m));
  document.body.classList.toggle('walking', m === 'walk');
  hideTip();
  interactions?.highlight(null);
  if (m === 'walk') {
    gsap.killTweensOf(camera.position);
    gsap.killTweensOf(orbit.target);
    showFloor('all', true);
    const start = () => {
      if (placeFn) placeFn();
      else if (!walker.feet.lengthSq()) walker.place(0.5, 0, 6.5, 0);
      else walker.place(walker.feet.x, walker.feet.y, walker.feet.z, camera.rotation.y);
      walker.enabled = mode === 'walk';
    };
    transition(start);
    lockCard.hidden = false;
    gsap.fromTo('#lock .card', { scale: 0.92, autoAlpha: 0 }, { scale: 1, autoAlpha: 1, duration: 0.4, ease: 'back.out(1.6)' });
  } else {
    walker.controls.unlock();
    lockCard.hidden = true;
    homeView();
  }
}
lockCard.addEventListener('click', () => walker.controls.lock());
walker.controls.addEventListener('lock', () => (lockCard.hidden = true));
walker.controls.addEventListener('unlock', () => { if (mode === 'walk') lockCard.hidden = false; });

// màn đen ngắn khi chuyển chỗ (đổi chế độ, dịch chuyển tới phòng)
function transition(cb) {
  gsap.killTweensOf(fade);
  gsap.timeline()
    .to(fade, { autoAlpha: 1, duration: 0.3, ease: 'power1.in' })
    .call(cb)
    .to(fade, { autoAlpha: 0, duration: 0.55, ease: 'power1.out' }, '+=0.05');
}

// Cắt tầng: tầng phía trên bay lên rồi ẩn đi, hiện lại thì hạ xuống
const ORDER = ['g', 'l2', 'l3', 'roof'];
function showFloor(f, instant = false) {
  const idx = f === 'all' ? 99 : ORDER.indexOf(f);
  ORDER.forEach((name, i) => {
    const g = b.levels[name];
    const show = i <= idx;
    gsap.killTweensOf(g.position);
    if (instant) {
      g.position.y = 0;
      g.visible = show;
      return;
    }
    if (show && !g.visible) {
      g.visible = true;
      gsap.fromTo(g.position, { y: 9 }, { y: 0, duration: 0.9, ease: 'power3.out', delay: 0.05 + i * 0.09 });
    } else if (show) {
      gsap.to(g.position, { y: 0, duration: 0.5 });
    } else if (g.visible) {
      gsap.to(g.position, { y: 9 + i * 1.5, duration: 0.7, ease: 'power2.in', delay: (i - idx) * 0.07, onComplete: () => { g.visible = false; g.position.y = 0; } });
    }
  });
  document.querySelectorAll('[data-floor]').forEach((el) => el.classList.toggle('on', el.dataset.floor === f));
  if (mode === 'orbit' && !instant) {
    if (f === 'all') homeView(1.4);
    else {
      const y = { g: 0, l2: 3.9, l3: 7.2 }[f];
      flyTo(new THREE.Vector3(-2, y + 20, 5), new THREE.Vector3(0, y, -9.5), 1.4);
    }
  }
}

// Dịch chuyển nhanh tới phòng
const sel = $('#teleport');
b.rooms.filter((r) => r.spawn).forEach((r, i) => {
  const o = document.createElement('option');
  o.value = i;
  o.textContent = `${{ g: 'T1', l2: 'T2', l3: 'T3', site: 'Sân' }[r.level]} · ${r.name}`;
  sel.append(o);
});
const spawnRooms = b.rooms.filter((r) => r.spawn);
sel.addEventListener('change', () => {
  const r = spawnRooms[sel.value];
  sel.value = '';
  canvas.focus();
  if (!r) return;
  const go = () => walker.place(r.spawn[0], r.y, r.spawn[1], r.spawn[2]);
  if (mode !== 'walk') setMode('walk', go);
  else transition(go);
});

// Cửa: tween GSAP thay cho nội suy tuyến tính
function toggleDoor(d) {
  d.open = !d.open;
  gsap.killTweensOf(d);
  gsap.to(d, { t: d.open ? 1 : 0, duration: 1.3, ease: 'power2.inOut', onUpdate: () => applyDoor(d) });
}
function nearestDoor() {
  let best = null, bd = 2.6;
  for (const d of b.doors) {
    if (Math.abs(d.center.y - walker.feet.y) > 1.5) continue;
    const dist = Math.hypot(d.center.x - walker.feet.x, d.center.z - walker.feet.z);
    if (dist < bd) { bd = dist; best = d; }
  }
  return best;
}

interactions = createInteractions({ scene, camera, b, M, walker, toggleDoor, timeState, getMode: () => mode, ui });

// Khi đi bộ: thứ ở giữa tầm nhìn (≤ 2.8m)
const CENTER = new THREE.Vector2(0, 0);
let aim = null, aimAt = 0;
function walkTarget() {
  const now = performance.now();
  if (now - aimAt > 120) {
    aimAt = now;
    aim = interactions.pick(CENTER, 2.8);
    interactions.highlight(aim?.item || null);
  }
  return aim;
}
function useWalkTarget() {
  const t = walkTarget();
  if (t?.item) return interactions.act(t.item, t.mesh);
  const d = t?.door || nearestDoor();
  if (d) toggleDoor(d);
}
addEventListener('keydown', (e) => {
  if (e.code === 'KeyE' && mode === 'walk' && !e.repeat) useWalkTarget();
});
canvas.addEventListener('mousedown', (e) => {
  if (mode === 'walk' && walker.controls.isLocked && e.button === 0) useWalkTarget();
});

// Khi xem ngoài: rê chuột để thấy đồ vật, click để tương tác / mở cửa
const ndc = new THREE.Vector2();
let downAt = null, hoverAt = 0, hover = null;
function hideTip() {
  gsap.to(tip, { autoAlpha: 0, duration: 0.15 });
  canvas.style.cursor = '';
}
canvas.addEventListener('pointerdown', (e) => (downAt = [e.clientX, e.clientY]));
canvas.addEventListener('pointermove', (e) => {
  if (mode !== 'orbit' || e.buttons) return;
  const now = performance.now();
  if (now - hoverAt < 70) return;
  hoverAt = now;
  ndc.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
  hover = interactions.pick(ndc);
  interactions.highlight(hover?.item || null);
  if (!hover) return hideTip();
  canvas.style.cursor = 'pointer';
  tip.textContent = hover.item ? `${hover.item.label} · click: ${interactions.verbOf(hover.item, hover.mesh)}` : `${hover.door.name} · click: ${hover.door.open ? 'đóng' : 'mở'}`;
  gsap.to(tip, { autoAlpha: 1, x: e.clientX + 14, y: e.clientY + 16, duration: 0.18, ease: 'power2.out' });
});
canvas.addEventListener('pointerleave', () => { interactions.highlight(null); hideTip(); });
canvas.addEventListener('pointerup', (e) => {
  if (mode !== 'orbit' || !downAt || Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) > 4) return;
  ndc.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
  const hit = interactions.pick(ndc);
  if (hit?.item) interactions.act(hit.item, hit.mesh);
  else if (hit?.door) toggleDoor(hit.door);
});

function currentRoom() {
  const p = walker.feet;
  return b.rooms.find((r) => p.x >= r.x0 && p.x <= r.x1 && p.z >= r.z0 && p.z <= r.z1 && Math.abs(p.y - r.y) < 1.6);
}
let roomName = '';
function setRoomLabel(name) {
  if (name === roomName) return;
  roomName = name;
  roomEl.textContent = name;
  if (name) gsap.fromTo(roomEl, { autoAlpha: 0, y: -10 }, { autoAlpha: 1, y: 0, duration: 0.45, ease: 'power3.out' });
}

// Xuất GLB để mở trong Blender làm tiếp
$('#export').addEventListener('click', () => {
  new GLTFExporter().parse(
    ORDER.concat('site').map((n) => b.levels[n]),
    (glb) => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([glb], { type: 'model/gltf-binary' }));
      a.download = 'nha-hien-dai.glb';
      a.click();
    },
    (err) => alert('Xuất GLB lỗi: ' + err.message),
    { binary: true, onlyVisible: false },
  );
});

document.querySelectorAll('[data-mode]').forEach((el) => el.addEventListener('click', () => setMode(el.dataset.mode)));
document.querySelectorAll('[data-time]').forEach((el) => el.addEventListener('click', () => setTime(el.dataset.time)));
document.querySelectorAll('[data-floor]').forEach((el) => el.addEventListener('click', () => showFloor(el.dataset.floor)));
// nút bấm nảy nhẹ
document.querySelectorAll('#panel button').forEach((el) => el.addEventListener('click', () => gsap.fromTo(el, { scale: 0.92 }, { scale: 1, duration: 0.35, ease: 'back.out(3)' })));

setTime('dusk', true);
showFloor('all', true);
setMode('orbit');

// Cảnh mở màn: bảng điều khiển trượt vào, camera bay từ xa tới mặt tiền
gsap.from('#panel', { x: -40, autoAlpha: 0, duration: 0.9, ease: 'power3.out', delay: 0.2 });
gsap.from('#panel .row', { y: 10, autoAlpha: 0, duration: 0.5, stagger: 0.07, ease: 'power2.out', delay: 0.45 });
homeView(3.2);

// ---------------------------------------------------------------- vòng lặp ---
const clock = new THREE.Clock();
renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.05);
  if (mode === 'walk') {
    walker.update(dt);
    const r = currentRoom();
    setRoomLabel(r ? r.name : 'Ngoài trời');
    const t = walkTarget();
    const d = t?.door || (!t?.item && nearestDoor());
    hint.textContent = t?.item
      ? `E / click: ${interactions.verbOf(t.item, t.mesh)} (${t.item.label})`
      : d ? `E: ${d.open ? 'đóng' : 'mở'} ${d.name}` : '';
  } else {
    orbit.update();
    setRoomLabel('');
    hint.textContent = 'Kéo chuột để xoay · Lăn để zoom · Rê chuột vào đồ vật / cửa rồi click để tương tác';
  }
  interactions.refresh();
  renderer.render(scene, camera);
});

window.__app = { scene, camera, orbit, b, walker, setMode, setTime, showFloor, renderer, source, interactions, toggleDoor, gsap };
