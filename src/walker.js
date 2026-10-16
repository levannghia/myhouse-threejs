// Đi bộ góc nhìn thứ nhất: va chạm tường bằng raycast ngang, bám sàn/bậc thang bằng raycast xuống.
import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';

const EYE = 1.62, RADIUS = 0.28, STEP = 0.45;
const down = new THREE.Vector3(0, -1, 0);

export class Walker {
  constructor(camera, dom, b) {
    this.camera = camera;
    this.b = b;
    this.controls = new PointerLockControls(camera, dom);
    this.feet = new THREE.Vector3();
    this.vy = 0;
    this.keys = {};
    this.enabled = false;
    this.ray = new THREE.Raycaster();
    this.ray.firstHitOnly = true;
    addEventListener('keydown', (e) => (this.keys[e.code] = true));
    addEventListener('keyup', (e) => (this.keys[e.code] = false));
    addEventListener('blur', () => (this.keys = {}));
  }

  place(x, y, z, yaw = 0) {
    this.feet.set(x, y, z);
    this.vy = 0;
    this.camera.rotation.set(0, yaw, 0, 'YXZ');
    this.eyeY = y + EYE;
    this.camera.position.set(x, this.eyeY, z);
  }

  blocked(dx, dz, dist) {
    const dir = new THREE.Vector3(dx, 0, dz);
    for (const h of [0.35, 1.2]) {
      this.ray.set(new THREE.Vector3(this.feet.x, this.feet.y + h, this.feet.z), dir);
      this.ray.far = dist + RADIUS;
      if (this.ray.intersectObjects(this.b.colliders, false).length) return true;
    }
    return false;
  }

  floorAt(x, y, z) {
    this.ray.set(new THREE.Vector3(x, y + STEP, z), down);
    this.ray.far = 60;
    const hit = this.ray.intersectObjects(this.b.floors, false)[0];
    return hit ? hit.point.y : -10;
  }

  update(dt) {
    if (!this.enabled) return;
    const k = this.keys;
    const f = (k.KeyW || k.ArrowUp ? 1 : 0) - (k.KeyS || k.ArrowDown ? 1 : 0);
    const s = (k.KeyD || k.ArrowRight ? 1 : 0) - (k.KeyA || k.ArrowLeft ? 1 : 0);
    if (f || s) {
      const yaw = new THREE.Euler().setFromQuaternion(this.camera.quaternion, 'YXZ').y;
      const fx = -Math.sin(yaw), fz = -Math.cos(yaw);
      // hướng phải của camera = (cos yaw, 0, -sin yaw)
      let mx = fx * f + Math.cos(yaw) * s;
      let mz = fz * f - Math.sin(yaw) * s;
      const len = Math.hypot(mx, mz);
      const speed = (k.ShiftLeft || k.ShiftRight ? 4.2 : 2.0) * dt;
      mx = (mx / len) * speed;
      mz = (mz / len) * speed;
      if (mx && !this.blocked(Math.sign(mx), 0, Math.abs(mx))) this.feet.x += mx;
      if (mz && !this.blocked(0, Math.sign(mz), Math.abs(mz))) this.feet.z += mz;
    }
    const fy = this.floorAt(this.feet.x, this.feet.y, this.feet.z);
    if (fy > this.feet.y - 0.05) {
      this.feet.y = fy; // bám bậc ngay; chỉ làm mượt camera
      this.vy = 0;
    } else {
      this.vy -= 9.8 * dt;
      this.feet.y = Math.max(fy, this.feet.y + this.vy * dt);
    }
    this.eyeY += (this.feet.y + EYE - this.eyeY) * Math.min(1, dt * 12);
    this.camera.position.set(this.feet.x, this.eyeY, this.feet.z);
  }
}
