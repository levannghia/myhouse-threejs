// Điều khiển cảm ứng cho chế độ đi bộ: chạm nửa trái màn hình hiện joystick để đi,
// vuốt nửa phải để nhìn, nút "Dùng" (= phím E) và nút "Chạy" (bật/tắt, = giữ Shift).
import * as THREE from 'three';
import { gsap } from 'gsap';

const LOOK = 0.0045; // rad mỗi px vuốt
const PITCH = Math.PI / 2 - 0.1; // giới hạn ngước / cúi
const R = 50; // bán kính joystick (px)
const DEAD = 0.12;

// Máy dùng cảm ứng là chính (điện thoại, máy tính bảng). Laptop màn cảm ứng có chuột vẫn dùng pointer lock,
// nhưng chuyển sang điều khiển cảm ứng ngay lần đầu chạm màn hình.
export function isTouchFirst() {
  return matchMedia('(pointer: coarse)').matches || (navigator.maxTouchPoints > 0 && !matchMedia('(any-pointer: fine)').matches);
}

export class TouchControls {
  constructor({ walker, camera, canvas, onUse, onActivate }) {
    this.walker = walker;
    this.camera = camera;
    this.onUse = onUse;
    this.onActivate = onActivate;
    this.active = isTouchFirst();
    this.shown = false;
    this.root = document.getElementById('touch');
    this.base = document.getElementById('joy');
    this.knob = document.getElementById('knob');
    this.useBtn = document.getElementById('tUse');
    this.runBtn = document.getElementById('tRun');
    this.joy = null; // { id, ox, oy } tâm joystick
    this.look = null; // { id, x, y }
    this.euler = new THREE.Euler(0, 0, 0, 'YXZ');

    canvas.addEventListener('pointerdown', (e) => this.down(e));
    addEventListener('pointermove', (e) => this.moveEv(e));
    addEventListener('pointerup', (e) => this.up(e));
    addEventListener('pointercancel', (e) => this.up(e));
    this.useBtn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      gsap.fromTo(this.useBtn, { scale: 0.85 }, { scale: 1, duration: 0.4, ease: 'back.out(3)' });
      this.onUse();
    });
    this.runBtn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      walker.run = !walker.run;
      this.runBtn.classList.toggle('on', walker.run);
      gsap.fromTo(this.runBtn, { scale: 0.85 }, { scale: 1, duration: 0.4, ease: 'back.out(3)' });
    });
    for (const el of [this.useBtn, this.runBtn]) el.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  activate() {
    if (this.active) return;
    this.active = true;
    this.onActivate?.();
  }

  show() {
    if (this.shown || !this.active) return;
    this.shown = true;
    document.body.classList.add('touch-walk');
    gsap.killTweensOf([this.root, this.base, this.useBtn, this.runBtn]);
    gsap.set(this.root, { autoAlpha: 1 });
    gsap.fromTo(this.base, { autoAlpha: 0, scale: 0.6 }, { autoAlpha: 1, scale: 1, duration: 0.5, ease: 'back.out(1.8)', delay: 0.3 });
    gsap.fromTo([this.runBtn, this.useBtn], { autoAlpha: 0, y: 30 }, { autoAlpha: 1, y: 0, duration: 0.45, stagger: 0.08, ease: 'back.out(2)', delay: 0.35 });
  }

  hide() {
    if (!this.shown) return;
    this.shown = false;
    gsap.killTweensOf([this.base, this.useBtn, this.runBtn]);
    this.release();
    this.look = null;
    document.body.classList.remove('touch-walk');
    gsap.to(this.base, { autoAlpha: 0, scale: 0.6, duration: 0.25, ease: 'power2.in' });
    gsap.to([this.runBtn, this.useBtn], { autoAlpha: 0, y: 20, duration: 0.25, ease: 'power2.in' });
    gsap.to(this.root, { autoAlpha: 0, duration: 0.3, delay: 0.1 });
  }

  // tâm mặc định của joystick (góc trái dưới)
  home() {
    const r = this.base.getBoundingClientRect();
    const x = Number(gsap.getProperty(this.base, 'x')), y = Number(gsap.getProperty(this.base, 'y'));
    return [r.left + r.width / 2 - x, r.top + r.height / 2 - y];
  }

  down(e) {
    if (e.pointerType !== 'touch') return;
    this.activate();
    if (!this.shown) return;
    if (e.clientX < innerWidth / 2 && !this.joy) {
      // joystick nổi: tâm đặt ngay chỗ ngón tay chạm
      const [hx, hy] = this.home();
      this.joy = { id: e.pointerId, ox: e.clientX, oy: e.clientY };
      gsap.to(this.base, { x: e.clientX - hx, y: e.clientY - hy, duration: 0.12, ease: 'power2.out', overwrite: 'auto' });
    } else if (e.clientX >= innerWidth / 2 && !this.look) {
      this.look = { id: e.pointerId, x: e.clientX, y: e.clientY };
    }
  }

  moveEv(e) {
    if (this.joy && e.pointerId === this.joy.id) {
      let vx = (e.clientX - this.joy.ox) / R, vy = (e.clientY - this.joy.oy) / R;
      const len = Math.hypot(vx, vy);
      if (len > 1) { vx /= len; vy /= len; }
      gsap.set(this.knob, { x: vx * R, y: vy * R });
      const m = Math.min(1, len);
      const k = m < DEAD ? 0 : (m - DEAD) / (1 - DEAD) / (m || 1);
      this.walker.move.x = vx * k;
      this.walker.move.y = -vy * k;
    } else if (this.look && e.pointerId === this.look.id) {
      const dx = e.clientX - this.look.x, dy = e.clientY - this.look.y;
      this.look.x = e.clientX;
      this.look.y = e.clientY;
      if (this.walker.frozen) return; // đang ngồi xuống / dịch chuyển: GSAP điều khiển camera
      this.euler.setFromQuaternion(this.camera.quaternion);
      this.euler.y -= dx * LOOK;
      this.euler.x = THREE.MathUtils.clamp(this.euler.x - dy * LOOK, -PITCH, PITCH);
      this.camera.quaternion.setFromEuler(this.euler);
    }
  }

  up(e) {
    if (this.joy && e.pointerId === this.joy.id) this.release();
    if (this.look && e.pointerId === this.look.id) this.look = null;
  }

  release() {
    this.joy = null;
    this.walker.move.x = this.walker.move.y = 0;
    gsap.to(this.knob, { x: 0, y: 0, duration: 0.3, ease: 'back.out(2)', overwrite: 'auto' });
    gsap.to(this.base, { x: 0, y: 0, duration: 0.35, ease: 'power3.out', overwrite: 'auto' });
  }
}
