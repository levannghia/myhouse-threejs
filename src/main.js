import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Sky } from 'three/addons/objects/Sky.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { Builder, applyDoor } from './builder.js';
import { createMaterials } from './materials.js';
import { buildHouse } from './house.js';
import { buildSite } from './site.js';
import { furnish } from './furniture.js';
import { Walker } from './walker.js';

const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: false });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.05, 500);

const M = createMaterials(renderer);
const b = new Builder(scene, M);
buildSite(b, M);
buildHouse(b, M);
furnish(b, M);
scene.updateMatrixWorld(true); // raycast va chạm cần ma trận ngay cả trước khung hình đầu

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
let timeMode = 'dusk';
function setTime(mode) {
  timeMode = mode;
  const t = TIMES[mode];
  const u = sky.material.uniforms;
  u.turbidity.value = t.turb;
  u.rayleigh.value = t.ray;
  u.mieCoefficient.value = 0.004;
  u.mieDirectionalG.value = 0.8;
  const phi = THREE.MathUtils.degToRad(90 - t.elev), theta = THREE.MathUtils.degToRad(t.azim);
  const dir = new THREE.Vector3().setFromSphericalCoords(1, phi, theta);
  u.sunPosition.value.copy(dir);
  if (envRT) envRT.dispose();
  envRT = pmrem.fromScene(skyScene, 0, 0.1, 1000);
  scene.background = envRT.texture;
  scene.environment = envRT.texture;
  scene.environmentIntensity = t.env;
  sun.position.copy(sun.target.position).addScaledVector(dir.clone().setY(Math.max(dir.y, 0.25)).normalize(), 60);
  sun.intensity = t.sun;
  sun.color.set(t.sunColor);
  hemi.intensity = t.hemi;
  renderer.toneMappingExposure = t.exp;
  for (const l of b.lamps) l.light.intensity = l.base * t.lamps;
  M.lightWarm.emissiveIntensity = t.glow;
  document.querySelectorAll('[data-time]').forEach((el) => el.classList.toggle('on', el.dataset.time === mode));
}

// ---------------------------------------------------------------- điều khiển ---
const orbit = new OrbitControls(camera, canvas);
orbit.enableDamping = true;
orbit.maxPolarAngle = Math.PI * 0.495;
orbit.minDistance = 2;
orbit.maxDistance = 90;
function homeView() {
  camera.position.set(0.8, 2.4, 19.5);
  orbit.target.set(0.3, 5.9, -3);
  orbit.update();
}
homeView();

const walker = new Walker(camera, canvas, b);
let mode = 'orbit';
const $ = (s) => document.querySelector(s);
const hint = $('#hint'), roomEl = $('#room'), lockCard = $('#lock');

function setMode(m) {
  mode = m;
  walker.enabled = m === 'walk';
  orbit.enabled = m === 'orbit';
  document.querySelectorAll('[data-mode]').forEach((el) => el.classList.toggle('on', el.dataset.mode === m));
  document.body.classList.toggle('walking', m === 'walk');
  if (m === 'walk') {
    showFloor('all');
    if (!walker.feet.lengthSq()) walker.place(0.5, 0, 6.5, 0);
    else walker.place(walker.feet.x, walker.feet.y, walker.feet.z, camera.rotation.y);
    lockCard.hidden = false;
  } else {
    walker.controls.unlock();
    lockCard.hidden = true;
    homeView();
  }
}
lockCard.addEventListener('click', () => walker.controls.lock());
walker.controls.addEventListener('lock', () => (lockCard.hidden = true));
walker.controls.addEventListener('unlock', () => { if (mode === 'walk') lockCard.hidden = false; });

// Cắt tầng để xem mặt bằng
const ORDER = ['g', 'l2', 'l3', 'roof'];
function showFloor(f) {
  const idx = f === 'all' ? 99 : ORDER.indexOf(f);
  ORDER.forEach((name, i) => (b.levels[name].visible = i <= idx));
  document.querySelectorAll('[data-floor]').forEach((el) => el.classList.toggle('on', el.dataset.floor === f));
  if (f !== 'all' && mode === 'orbit') {
    const y = { g: 0, l2: 3.9, l3: 7.2 }[f];
    camera.position.set(-2, y + 20, 5);
    orbit.target.set(0, y, -9.5);
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
  if (!r) return;
  if (mode !== 'walk') setMode('walk');
  walker.place(r.spawn[0], r.y, r.spawn[1], r.spawn[2]);
  sel.value = '';
  canvas.focus();
});

// Cửa: E khi đi bộ, click khi xem ngoài
function nearestDoor() {
  let best = null, bd = 2.6;
  for (const d of b.doors) {
    if (Math.abs(d.center.y - walker.feet.y) > 1.5) continue;
    const dist = Math.hypot(d.center.x - walker.feet.x, d.center.z - walker.feet.z);
    if (dist < bd) { bd = dist; best = d; }
  }
  return best;
}
addEventListener('keydown', (e) => {
  if (e.code === 'KeyE' && mode === 'walk') {
    const d = nearestDoor();
    if (d) d.open = !d.open;
  }
});
const pick = new THREE.Raycaster(), ndc = new THREE.Vector2();
let downAt = null;
canvas.addEventListener('pointerdown', (e) => (downAt = [e.clientX, e.clientY]));
canvas.addEventListener('pointerup', (e) => {
  if (mode !== 'orbit' || !downAt || Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) > 4) return;
  ndc.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
  pick.setFromCamera(ndc, camera);
  const hit = pick.intersectObjects(scene.children, true).find((h) => h.object.visible && h.object.userData.door);
  if (hit) hit.object.userData.door.open = !hit.object.userData.door.open;
});

function currentRoom() {
  const p = walker.feet;
  return b.rooms.find((r) => p.x >= r.x0 && p.x <= r.x1 && p.z >= r.z0 && p.z <= r.z1 && Math.abs(p.y - r.y) < 1.6);
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

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

setTime('dusk');
showFloor('all');
setMode('orbit');

// ---------------------------------------------------------------- vòng lặp ---
const clock = new THREE.Clock();
renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.05);
  for (const d of b.doors) {
    const target = d.open ? 1 : 0;
    if (d.t !== target) {
      d.t = THREE.MathUtils.clamp(d.t + Math.sign(target - d.t) * dt * 0.9, 0, 1);
      applyDoor(d);
    }
  }
  if (mode === 'walk') {
    walker.update(dt);
    const r = currentRoom();
    roomEl.textContent = r ? r.name : 'Ngoài trời';
    const d = nearestDoor();
    hint.textContent = d ? `E: ${d.open ? 'đóng' : 'mở'} ${d.name}` : '';
  } else {
    orbit.update();
    roomEl.textContent = '';
    hint.textContent = 'Kéo chuột để xoay · Lăn để zoom · Click vào cửa/cổng để mở';
  }
  renderer.render(scene, camera);
});

window.__app = { scene, camera, orbit, b, walker, setMode, setTime, showFloor, renderer };
