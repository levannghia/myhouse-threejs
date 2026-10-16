// Bộ công cụ dựng hình theo toạ độ mét thực (x: trái→phải, y: lên, z: hướng ra đường).
import * as THREE from 'three';

// BoxGeometry có UV tính theo mét để texture lặp đều trên mọi kích thước.
export function boxGeo(w, h, d) {
  const g = new THREE.BoxGeometry(w, h, d);
  const uv = g.attributes.uv;
  const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]]; // +x -x +y -y +z -z
  for (let f = 0; f < 6; f++)
    for (let i = 0; i < 4; i++) {
      const k = f * 4 + i;
      uv.setXY(k, uv.getX(k) * dims[f][0], uv.getY(k) * dims[f][1]);
    }
  return g;
}

export class Builder {
  constructor(scene, M) {
    this.scene = scene;
    this.M = M;
    this.levels = {};
    this.current = null;
    this.ffl = 0;
    this.colliders = []; // chặn di chuyển ngang
    this.floors = []; // mặt để đứng
    this.doors = [];
    this.lamps = [];
    this.rooms = [];
    this.counts = {};
    this.tagName = 'Chung';
  }

  // Quy tắc đặt tên (giống hệt script Blender): <tầng>_<nhóm>_<số thứ tự 2 chữ số>
  tag(t) {
    this.tagName = t;
  }
  nextName(prefix) {
    const key = `${this.current.name}_${prefix}`;
    const n = (this.counts[key] = (this.counts[key] || 0) + 1);
    return `${key}_${String(n).padStart(2, '0')}`;
  }

  level(name, ffl = 0) {
    if (!this.levels[name]) {
      const g = new THREE.Group();
      g.name = name;
      this.scene.add(g);
      this.levels[name] = g;
    }
    this.current = this.levels[name];
    this.ffl = ffl;
    this.tagName = 'Chung';
    return this.current;
  }

  _reg(m, o) {
    m.castShadow = o.cast ?? true;
    m.receiveShadow = o.receive ?? true;
    m.name = o.name || this.nextName(this.tagName);
    (o.parent || this.current).add(m);
    if (o.collide ?? true) this.colliders.push(m);
    if (o.floor) this.floors.push(m);
    return m;
  }

  // Hộp theo 2 góc đối diện (toạ độ thế giới). mat có thể là mảng 6 vật liệu (+x -x +y -y +z -z).
  box(mat, x0, y0, z0, x1, y1, z1, o = {}) {
    const ax = Math.min(x0, x1), bx = Math.max(x0, x1);
    const ay = Math.min(y0, y1), by = Math.max(y0, y1);
    const az = Math.min(z0, z1), bz = Math.max(z0, z1);
    const m = new THREE.Mesh(boxGeo(bx - ax, by - ay, bz - az), mat);
    m.position.set((ax + bx) / 2, (ay + by) / 2, (az + bz) / 2);
    if (o.parent) m.position.sub(o.parent.position);
    return this._reg(m, o);
  }

  mesh(geo, mat, o = {}) {
    return this._reg(new THREE.Mesh(geo, mat), o);
  }

  // Sàn: mặt trên = top, mặt dưới = bottom (trần tầng dưới)
  slab(x0, z0, x1, z1, yTop, thick, top, bottom, o = {}) {
    const e = this.M.concrete;
    return this.box([e, e, top, bottom, e, e], x0, yTop - thick, z0, x1, yTop, z1, { floor: true, ...o });
  }

  // Tường thẳng trục. axis 'x': chạy dọc x tại z=c; axis 'z': chạy dọc z tại x=c.
  // openings: [{a0, a1, y0, y1, glass}] — a theo toạ độ tuyệt đối dọc tường, y tương đối so với chân tường.
  // o.outer / o.inner + o.out (+1/-1): vật liệu 2 mặt cho tường ngoài.
  wall(mat, axis, c, a0, a1, y0, y1, t, openings = [], o = {}) {
    let material = mat;
    if (o.outer) {
      const out = o.outer, inn = o.inner || this.M.plaster, edge = o.outer;
      const pos = o.out > 0 ? out : inn, neg = o.out > 0 ? inn : out;
      material = axis === 'x' ? [edge, edge, edge, edge, pos, neg] : [pos, neg, edge, edge, edge, edge];
    }
    const lo = Math.min(a0, a1), hi = Math.max(a0, a1);
    const ops = openings
      .map((p) => ({
        a0: Math.min(p.a0, p.a1), a1: Math.max(p.a0, p.a1),
        b0: y0 + (p.y0 ?? 0), b1: y0 + (p.y1 ?? y1 - y0), glass: p.glass,
      }))
      .sort((p, q) => p.a0 - q.a0);
    const seg = (s0, s1, yy0, yy1) => {
      if (s1 - s0 < 1e-3 || yy1 - yy0 < 1e-3) return;
      if (axis === 'x') this.box(material, s0, yy0, c - t / 2, s1, yy1, c + t / 2, o);
      else this.box(material, c - t / 2, yy0, s0, c + t / 2, yy1, s1, o);
    };
    let cur = lo;
    for (const p of ops) {
      seg(cur, p.a0, y0, y1);
      seg(p.a0, p.a1, y0, p.b0);
      seg(p.a0, p.a1, p.b1, y1);
      if (p.glass) this.glassPane(axis, c, p.a0, p.a1, p.b0, p.b1);
      cur = p.a1;
    }
    seg(cur, hi, y0, y1);
  }

  // Kính có khung + đố đứng
  glassPane(axis, c, a0, a1, y0, y1, o = {}) {
    const f = 0.05, M = this.M;
    const put = (mat, s0, s1, yy0, yy1, t, extra) => {
      if (axis === 'x') return this.box(mat, s0, yy0, c - t / 2, s1, yy1, c + t / 2, { ...o, ...extra });
      return this.box(mat, c - t / 2, yy0, s0, c + t / 2, yy1, s1, { ...o, ...extra });
    };
    put(M.glass, a0, a1, y0, y1, 0.02, { cast: false });
    const fr = { collide: false };
    put(M.frame, a0, a1, y0, y0 + f, 0.07, fr);
    put(M.frame, a0, a1, y1 - f, y1, 0.07, fr);
    put(M.frame, a0, a0 + f, y0, y1, 0.07, fr);
    put(M.frame, a1 - f, a1, y0, y1, 0.07, fr);
    const n = Math.ceil((a1 - a0) / 1.5);
    for (let i = 1; i < n; i++) {
      const a = a0 + ((a1 - a0) * i) / n;
      put(M.frame, a - f / 2, a + f / 2, y0, y1, 0.07, fr);
    }
  }

  // Tấm nghiêng dọc trục z (lan can cầu thang): từ (zA,yA) tới (zB,yB), cao h phía trên đường đó.
  sloped(mat, x0, x1, zA, yA, zB, yB, h, o = {}) {
    if (zB < zA) [zA, yA, zB, yB] = [zB, yB, zA, yA];
    const len = Math.hypot(zB - zA, yB - yA);
    const m = new THREE.Mesh(boxGeo(x1 - x0, h, len), mat);
    const ang = Math.atan2(yB - yA, zB - zA);
    m.rotation.x = -ang;
    // trục y cục bộ sau khi xoay = (0, cos, -sin)
    m.position.set((x0 + x1) / 2, (yA + yB) / 2 + (h / 2) * Math.cos(ang), (zA + zB) / 2 - (h / 2) * Math.sin(ang));
    return this._reg(m, o);
  }

  // Thêm cả group (nội thất…) vào tầng hiện tại
  // Tên nhóm: <tầng>_<loại>_NN, các mảnh bên trong: <tên nhóm>_<k> theo thứ tự tạo
  add(group, o = {}) {
    group.name = this.nextName(o.type || group.userData.type || 'Nhom');
    if (!group.isMesh) {
      let k = 0;
      group.traverse((m) => { if (m.isMesh) m.name = `${group.name}_${k++}`; });
    }
    this.current.add(group);
    group.traverse((m) => {
      if (!m.isMesh) return;
      m.castShadow = o.cast ?? true;
      m.receiveShadow = true;
      if ((o.collide ?? true) && !m.userData.noCollide) this.colliders.push(m);
      if (m.userData.floor) this.floors.push(m);
    });
    return group;
  }

  lamp(x, y, z, intensity, distance = 10, color = 0xffd2a0) {
    const l = new THREE.PointLight(color, intensity, distance, 2);
    l.position.set(x, y, z);
    l.name = this.nextName('Den');
    this.current.add(l);
    this.lamps.push({ light: l, base: intensity });
    return l;
  }

  // Đèn downlight âm trần: đĩa phát sáng
  downlight(x, y, z) {
    this.box(this.M.lightWarm, x - 0.06, y - 0.02, z - 0.06, x + 0.06, y, z + 0.06, { collide: false, cast: false });
  }

  room(name, x0, z0, x1, z1, spawn) {
    this.rooms.push({
      name, level: this.current.name, y: this.ffl,
      x0: Math.min(x0, x1), x1: Math.max(x0, x1), z0: Math.min(z0, z1), z1: Math.max(z0, z1),
      spawn: spawn || [(x0 + x1) / 2, (z0 + z1) / 2, 0],
    });
  }

  // Cửa tương tác. parts: [{obj, move: Vector3?, rot: number?}]
  door(name, center, parts, open = false) {
    const d = { name, center, parts, open, t: open ? 1 : 0 };
    for (const p of parts) {
      p.basePos = p.obj.position.clone();
      p.baseRot = p.obj.rotation.y;
      p.obj.traverse((m) => { if (m.isMesh) m.userData.door = d; });
    }
    this.doors.push(d);
    applyDoor(d);
    return d;
  }
}

export function applyDoor(d) {
  const e = d.t * d.t * (3 - 2 * d.t);
  for (const p of d.parts) {
    if (p.move) p.obj.position.copy(p.basePos).addScaledVector(p.move, e);
    if (p.rot) p.obj.rotation.y = p.baseRot + p.rot * e;
  }
}
