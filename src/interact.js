// Tương tác với đồ vật trong nhà (dùng GSAP cho chuyển động).
// Nhận diện đồ vật theo tên nhóm <tầng>_<Loại>_NN — giống nhau ở bản dựng bằng code và bản GLB từ Blender,
// các mảnh con tên <nhóm>_<k> (tìm theo tên, không theo thứ tự con vì GLB có thể đổi thứ tự).
import * as THREE from 'three';
import { gsap } from 'gsap';

const NAME_RE = /^(site|g|l2|l3)_([A-Za-z]+)_\d+$/;
const TYPES = {
  Sofa: ['Sofa', 'ngồi xuống'],
  Ghe: ['Ghế', 'kéo ghế'],
  GheDon: ['Ghế quầy bar', 'xoay ghế'],
  GheNam: ['Ghế nằm', 'ngả lưng ghế'],
  Giuong: ['Giường', 'gấp / trải chăn'],
  DenSan: ['Đèn cây', 'bật / tắt đèn'],
  DenTha: ['Đèn thả', 'bật / tắt đèn'],
  TV: ['Tivi', 'bật / tắt TV'],
  Tu: ['Tủ', 'mở / đóng cánh tủ'],
  TuQuanAo: ['Tủ quần áo', 'mở / đóng cánh tủ'],
  KeSach: ['Kệ sách', 'rút một cuốn sách'],
  Tranh: ['Tranh treo tường', 'chỉnh lại tranh'],
  Chau: ['Chậu cây', 'tưới cây'],
  Cay: ['Cây xanh', 'lay cành'],
  Bui: ['Bụi cây', 'lay cành'],
  Xe: ['Ô tô', 'lái xe ra / vào'],
  BonTam: ['Bồn tắm', 'xả / tháo nước'],
  Lavabo: ['Lavabo', 'mở vòi nước'],
  BonCau: ['Bồn cầu', 'xả nước'],
  Sen: ['Vòi sen', 'bật / tắt vòi sen'],
  Thung: ['Thùng đồ', 'xếp lại thùng'],
};
const X = new THREE.Vector3(1, 0, 0), Y = new THREE.Vector3(0, 1, 0), Z = new THREE.Vector3(0, 0, 1);
const tmpQ = new THREE.Quaternion();

// tư thế gốc của một vật (lưu lần đầu): mọi hiệu ứng đi về/đi từ đây nên bấm nhanh liên tục không bị lệch
function home(o) {
  return (o.userData.home ??= { p: o.position.clone(), q: o.quaternion.clone(), s: o.scale.clone() });
}
// quay mượt tới quaternion đích
function slerpTo(o, q, vars) {
  const q0 = o.quaternion.clone(), k = { t: 0 };
  gsap.killTweensOf(o.userData.slerp ??= {});
  o.userData.slerp = k;
  return gsap.to(k, { t: 1, ...vars, onUpdate: () => o.quaternion.slerpQuaternions(q0, q, k.t) });
}

function wobble(obj, axis, amp, dur = 1.4) {
  // luôn rung quanh tư thế gốc, bấm liên tục không bị lệch dần
  const base = home(obj).q, p = { a: amp };
  gsap.killTweensOf(obj.userData.wob ??= {});
  p.a = amp;
  obj.userData.wob = p;
  return gsap.fromTo(p, { a: amp }, {
    a: 0, duration: dur, ease: 'elastic.out(1.1, 0.25)',
    onUpdate: () => obj.quaternion.copy(base).multiply(tmpQ.setFromAxisAngle(axis, p.a)),
  });
}

export function createInteractions({ scene, camera, b, M, walker, toggleDoor, timeState, getMode, ui }) {
  const items = [];
  const glowMats = []; // vật liệu đèn đã clone: {mat, k}
  const meshToItem = new Map();

  for (const level of Object.values(b.levels)) {
    level.traverse((o) => {
      const m = NAME_RE.exec(o.name);
      if (!m || !TYPES[m[2]]) return;
      const item = { root: o, type: m[2], level: m[1], label: TYPES[m[2]][0], verb: TYPES[m[2]][1], state: {} };
      items.push(item);
      o.traverse((c) => { if (c.isMesh) meshToItem.set(c, item); });
    });
  }
  const part = (item, k) => item.root.getObjectByName(`${item.root.name}_${k}`);
  const meshes = (item, pred) => {
    const out = [];
    item.root.traverse((c) => { if (c.isMesh && pred(c)) out.push(c); });
    return out;
  };
  const worldPos = (o) => o.getWorldPosition(new THREE.Vector3());
  const localDir = (o, x, y, z) => new THREE.Vector3(x, y, z).applyQuaternion(o.quaternion);

  // ------------------------------------------------------------ đèn ---
  function lampMats(item) {
    if (!item.state.glow) {
      const g = { mat: M.lightWarm.clone(), k: 1 };
      g.mat.emissiveIntensity = timeState.glow;
      for (const m of meshes(item, (c) => c.material.name === 'lightWarm')) m.material = g.mat;
      glowMats.push(g);
      item.state.glow = g;
      // đèn phòng gần nhất cùng tầng: tắt đèn đồ vật thì phòng tối bớt
      const p = worldPos(item.root);
      let best = null, bd = 4.5;
      for (const l of b.lamps) {
        if (b.levels[item.level] && !isInside(l.light, b.levels[item.level])) continue;
        const d = worldPos(l.light).distanceTo(p);
        if (d < bd) { bd = d; best = l; }
      }
      item.state.room = best;
    }
    return item.state.glow;
  }
  function toggleLamp(item) {
    const g = lampMats(item);
    const on = g.k < 0.5;
    gsap.to(g, { k: on ? 1 : 0.04, duration: 0.6, ease: on ? 'power2.out' : 'power2.in', onUpdate: () => (g.mat.emissiveIntensity = timeState.glow * g.k) });
    const room = item.state.room;
    if (room) gsap.to(room, { user: on ? 1 : 0.3, duration: 0.8, onUpdate: () => (room.light.intensity = room.base * timeState.lamps * room.user) });
    return on ? 'Đã bật đèn' : 'Đã tắt đèn';
  }

  // ------------------------------------------------------------ hành động ---
  const ACT = {
    DenSan: toggleLamp,
    DenTha: toggleLamp,
    TV(item) {
      const scr = meshes(item, (c) => c.material.name === 'screen' || c.userData.tvScreen)[0];
      if (!scr) return '';
      if (!item.state.mat) {
        item.state.mat = scr.material.clone();
        item.state.mat.emissive = new THREE.Color(0xffffff);
        item.state.mat.emissiveMap = tvTexture(scr);
        item.state.mat.emissiveIntensity = 0;
        scr.material = item.state.mat;
        scr.userData.tvScreen = true;
      }
      const mat = item.state.mat;
      item.state.on = !item.state.on;
      if (item.state.on) {
        // "chương trình" trôi ngang + đổi tông màu chậm
        const tex = mat.emissiveMap, hsl = { h: Math.random(), x: tex.offset.x };
        item.state.loop = gsap.to(hsl, {
          h: hsl.h + 1, x: hsl.x + tex.repeat.x, duration: 9, repeat: -1, ease: 'none',
          onUpdate: () => { mat.emissive.setHSL(hsl.h % 1, 0.35, 0.75); tex.offset.x = hsl.x; },
        });
        mat.emissiveIntensity = 0;
        gsap.to(mat, { emissiveIntensity: 1.1, duration: 0.5, ease: "power3.out" });
        return 'TV đã bật';
      }
      gsap.to(mat, { emissiveIntensity: 0, duration: 0.35, onComplete: () => item.state.loop?.kill() });
      return 'TV đã tắt';
    },
    Ghe(item) {
      const r = item.root, s = item.state;
      if (!s.home) {
        // nhớ vị trí gốc + vị trí kéo ra, đi qua lại giữa 2 điểm cố định (bấm nhanh không bị lệch)
        s.home = { p: r.position.clone(), q: r.quaternion.clone() };
        s.away = {
          p: r.position.clone().add(localDir(r, 0, 0, -0.38)),
          q: r.quaternion.clone().multiply(new THREE.Quaternion().setFromAxisAngle(Y, 0.18)),
        };
      }
      s.out = !s.out;
      const to = s.out ? s.away : s.home, q0 = r.quaternion.clone(), k = { t: 0 };
      gsap.killTweensOf(r.position);
      gsap.to(r.position, { x: to.p.x, z: to.p.z, duration: 0.6, ease: 'power2.out' });
      gsap.to(k, { t: 1, duration: 0.6, ease: 'power2.out', onUpdate: () => r.quaternion.slerpQuaternions(q0, to.q, k.t) });
      return s.out ? 'Đã kéo ghế ra' : 'Đã đẩy ghế vào';
    },
    GheDon(item) {
      const r = item.root, h = home(r), p = { a: 0 };
      gsap.killTweensOf(r.userData.spin ??= {});
      r.userData.spin = p;
      gsap.to(p, { a: Math.PI * 2, duration: 1.3, ease: 'power3.out', onUpdate: () => r.quaternion.copy(h.q).multiply(tmpQ.setFromAxisAngle(Y, p.a)) });
      gsap.killTweensOf(r.position);
      gsap.fromTo(r.position, { y: h.p.y }, { y: h.p.y + 0.06, duration: 0.3, yoyo: true, repeat: 1, ease: 'sine.inOut' });
      return 'Vèo!';
    },
    GheNam(item) {
      const back = part(item, 2);
      if (!back) return '';
      const h = home(back);
      item.state.flat = !item.state.flat;
      const q = item.state.flat ? h.q.clone().multiply(new THREE.Quaternion().setFromAxisAngle(X, 0.55)) : h.q;
      slerpTo(back, q, { duration: 0.9, ease: 'power2.inOut' });
      return item.state.flat ? 'Ngả lưng ghế' : 'Dựng lưng ghế';
    },
    Sofa(item) {
      for (const k of [5, 6, 7]) {
        const c = part(item, k);
        if (c) gsap.fromTo(c.scale, { y: 1 }, { y: 0.8, duration: 0.18, yoyo: true, repeat: 1, ease: 'sine.inOut', delay: (k - 5) * 0.06 });
      }
      if (getMode() === 'walk') return sit(item);
      return 'Gối được vỗ cho phồng lên';
    },
    Giuong(item, hit) {
      if (hit && hit.material.name === 'lightWarm') return toggleLamp(item);
      const mattress = part(item, 1), blanket = part(item, 2);
      if (mattress) gsap.fromTo(mattress.scale, { y: 1 }, { y: 0.9, duration: 0.15, yoyo: true, repeat: 1 });
      if (!blanket) return '';
      item.state.folded = !item.state.folded;
      const f = item.state.folded;
      const h = home(blanket);
      gsap.to(blanket.position, { z: h.p.z + (f ? 0.3 : 0), y: h.p.y + (f ? 0.04 : 0), duration: 0.7, ease: 'power2.inOut' });
      gsap.to(blanket.scale, { z: h.s.z * (f ? 0.45 : 1), y: h.s.y * (f ? 2.2 : 1), duration: 0.7, ease: 'power2.inOut' });
      return f ? 'Đã gấp chăn' : 'Đã trải chăn';
    },
    Tu: cabinetDoor,
    TuQuanAo: cabinetDoor,
    KeSach(item) {
      const books = meshes(item, (c) => c.material.name.startsWith('book_'));
      if (!books.length) return 'Kệ trống';
      const bk = books[(Math.random() * books.length) | 0], h = home(bk);
      gsap.killTweensOf(bk.position);
      gsap.timeline()
        .to(bk.position, { z: h.p.z + 0.2, y: h.p.y + 0.02, duration: 0.45, ease: 'power2.out' })
        .to(bk.position, { z: h.p.z, y: h.p.y, duration: 0.5, ease: 'power2.in' }, '+=1.6');
      return 'Rút một cuốn sách…';
    },
    Tranh(item) {
      wobble(item.root, Z, 0.16, 1.8);
      return 'Tranh đã ngay ngắn';
    },
    Chau(item) {
      wobble(item.root, X, 0.12, 1.5);
      for (const c of meshes(item, (m) => m.material.name.startsWith('leaf'))) {
        const h = home(c);
        gsap.killTweensOf(c.scale);
        gsap.fromTo(c.scale, { x: h.s.x, y: h.s.y, z: h.s.z }, { x: h.s.x * 1.15, y: h.s.y * 1.15, z: h.s.z * 1.15, duration: 0.4, yoyo: true, repeat: 1, ease: 'sine.inOut' });
      }
      return 'Đã tưới cây';
    },
    Cay(item) {
      wobble(item.root, Z, 0.05, 2.2);
      return 'Lá cây xào xạc';
    },
    Bui(item) {
      wobble(item.root, X, 0.15, 1.4);
      return 'Lá cây xào xạc';
    },
    Xe(item) {
      if (item.state.busy) return 'Xe đang chạy…';
      const gate = b.doors.find((d) => d.name === 'Cổng');
      const lights = meshes(item, (c) => c.material.name === 'lightWarm');
      if (!item.state.mat) {
        item.state.mat = M.lightWarm.clone();
        for (const l of lights) l.material = item.state.mat;
      }
      const head = item.state.mat;
      const out = !item.state.out;
      item.state.busy = true;
      const d = localDir(item.root, 0, 0, out ? 8.8 : -8.8);
      const tl = gsap.timeline({ onComplete: () => { item.state.busy = false; item.state.out = out; } });
      if (out && gate && !gate.open) {
        toggleDoor(gate);
        tl.to({}, { duration: 1.3 });
      }
      tl.to(head, { emissiveIntensity: 7, duration: 0.25, yoyo: true, repeat: 1 })
        .to(head, { emissiveIntensity: 5, duration: 0.2 })
        .to(item.root.position, { y: '+=0.03', duration: 0.12, yoyo: true, repeat: 3 }, '<')
        .to(item.root.position, { x: `+=${d.x}`, z: `+=${d.z}`, duration: 3.2, ease: 'power2.inOut' })
        .to(head, { emissiveIntensity: timeState.glow, duration: 0.5 });
      return out ? 'Xe chạy ra đường' : 'Xe về gara';
    },
    BonTam(item) {
      const w = meshes(item, (c) => c.material.name === 'water')[0];
      if (!w) return '';
      item.state.empty = !item.state.empty;
      gsap.to(w.scale, { y: item.state.empty ? 0.05 : 1, duration: 2, ease: 'sine.inOut' });
      return item.state.empty ? 'Đang tháo nước' : 'Đang xả nước vào bồn';
    },
    Lavabo(item) {
      stream(item, 0.012, 0.012, 0.16, 0, 0.98, -0.12, 2.5);
      return 'Mở vòi nước';
    },
    Sen(item) {
      const head = part(item, 2);
      const p = head ? head.position : new THREE.Vector3(0, 2.1, -0.3);
      if (item.state.water) {
        const w = item.state.water;
        gsap.to(w.scale, { y: 0.001, duration: 0.4, onComplete: () => w.removeFromParent() });
        item.state.water = null;
        return 'Tắt vòi sen';
      }
      item.state.water = stream(item, 0.1, 0.3, 2.05, p.x, 1.06, p.z, 0, 0.22);
      return 'Bật vòi sen';
    },
    BonCau(item) {
      const tank = part(item, 1);
      if (tank) {
        const h = home(tank);
        gsap.killTweensOf(tank.position);
        gsap.fromTo(tank.position, { y: h.p.y }, { y: h.p.y + 0.02, duration: 0.08, yoyo: true, repeat: 5 });
      }
      return 'Rè rè… đã xả nước';
    },
    Thung(item) {
      const kids = meshes(item, () => true), hs = kids.map(home), pos = kids.map((m) => m.position);
      gsap.killTweensOf(pos);
      gsap.fromTo(pos, { y: (i) => hs[i].p.y }, { y: (i) => hs[i].p.y + 0.3, duration: 0.25, yoyo: true, repeat: 1, ease: 'power2.out', stagger: 0.07 });
      return 'Đã xếp lại thùng';
    },
  };

  function cabinetDoor(item) {
    const body = part(item, 0);
    if (!body) return '';
    if (!item.state.door) {
      // cánh tủ giả: tấm mỏng phủ mặt trước + lòng tủ tối phía sau, bản lề ở mép trái
      body.geometry.computeBoundingBox();
      const bb = body.geometry.boundingBox, c = body.position;
      const w = bb.max.x - bb.min.x, h = bb.max.y - bb.min.y, d = bb.max.z - bb.min.z;
      const pw = Math.min(0.6, w / 2);
      const x0 = c.x - w / 2, zf = c.z + d / 2;
      const inner = new THREE.Mesh(new THREE.PlaneGeometry(pw - 0.04, h - 0.06), new THREE.MeshStandardMaterial({ color: 0x1a1512, roughness: 1 }));
      inner.position.set(x0 + pw / 2, c.y, zf + 0.003);
      const hinge = new THREE.Group();
      hinge.position.set(x0, c.y, zf + 0.012);
      const leaf = new THREE.Mesh(new THREE.BoxGeometry(pw, h - 0.02, 0.02), body.material);
      leaf.position.x = pw / 2;
      leaf.castShadow = true;
      const knob = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.18, 0.025), M.steel);
      knob.position.set(pw - 0.05, 0, 0.02);
      hinge.add(leaf, knob);
      item.root.add(inner, hinge);
      for (const m of [leaf, knob]) meshToItem.set(m, item);
      item.state.door = hinge;
    }
    item.state.open = !item.state.open;
    const hinge = item.state.door, p = { a: hinge.userData.a || 0 };
    gsap.to(p, {
      a: item.state.open ? -1.9 : 0, duration: 0.9, ease: item.state.open ? 'back.out(1.4)' : 'power2.inOut',
      onUpdate: () => { hinge.userData.a = p.a; hinge.rotation.y = p.a; },
    });
    return item.state.open ? 'Mở cánh tủ' : 'Đóng cánh tủ';
  }

  function stream(item, rt, rb, h, x, yCenter, z, autoOff = 0, opacity = 0.55) {
    const mat = new THREE.MeshPhysicalMaterial({ color: 0xbfe6f5, roughness: 0.05, transparent: true, opacity, depthWrite: false });
    const geo = new THREE.CylinderGeometry(rt, rb, h, 16, 1, true).translate(0, -h / 2, 0);
    const w = new THREE.Mesh(geo, mat);
    w.position.set(x, yCenter + h / 2, z);
    w.scale.y = 0.001;
    item.root.add(w);
    gsap.to(w.scale, { y: 1, duration: 0.35, ease: 'power2.in' });
    gsap.to(mat, { opacity: opacity * 0.6, duration: 0.25, yoyo: true, repeat: -1, ease: 'sine.inOut' });
    if (autoOff) gsap.to(w.scale, { y: 0.001, duration: 0.4, delay: autoOff, onComplete: () => { gsap.killTweensOf(mat); w.removeFromParent(); } });
    return w;
  }

  function sit(item) {
    const fwd = new THREE.Vector3(0, 0, 1).applyQuaternion(item.root.getWorldQuaternion(new THREE.Quaternion())).setY(0).normalize();
    const p = worldPos(item.root).addScaledVector(fwd, 0.05);
    if (p.distanceTo(walker.feet) > 3.2) return 'Lại gần hơn để ngồi';
    const yaw0 = new THREE.Euler().setFromQuaternion(camera.quaternion, 'YXZ').y;
    let yaw1 = Math.atan2(-fwd.x, -fwd.z);
    yaw1 = yaw0 + Math.atan2(Math.sin(yaw1 - yaw0), Math.cos(yaw1 - yaw0)); // quay đường ngắn nhất
    const r = { yaw: yaw0, pitch: 0 };
    walker.frozen = true;
    gsap.timeline({ onComplete: () => { walker.frozen = false; walker.seated = true; } })
      .to(walker.feet, { x: p.x, z: p.z, duration: 0.9, ease: 'power2.inOut' }, 0)
      .to(walker, { eyeOffset: -0.6, duration: 0.9, ease: 'power2.inOut' }, 0)
      .to(r, { yaw: yaw1, duration: 0.9, ease: 'power2.inOut', onUpdate: () => camera.rotation.set(0, r.yaw, 0, 'YXZ') }, 0);
    walker.onStand = () => {
      walker.seated = false;
      gsap.to(walker, { eyeOffset: 0, duration: 0.5, ease: 'power2.out' });
    };
    return 'Ngồi xuống sofa (đi để đứng dậy)';
  }

  // ------------------------------------------------------------ chọn ---
  const ray = new THREE.Raycaster();
  const pickList = [];
  scene.traverse((o) => { if (o.isMesh && !o.isInstancedMesh) pickList.push(o); });
  function shown(o) {
    if (o.material && o.material.visible === false) return false;
    for (let p = o; p; p = p.parent) if (!p.visible) return false;
    return true;
  }
  function itemOf(o) {
    for (let p = o; p; p = p.parent) if (meshToItem.has(p)) return meshToItem.get(p);
    return null;
  }
  // tia từ camera: trả về {item, mesh} hoặc {door} của vật đầu tiên trúng
  function pick(ndc, far = Infinity) {
    ray.setFromCamera(ndc, camera);
    ray.far = far;
    for (const h of ray.intersectObjects(pickList, false)) {
      if (!shown(h.object)) continue;
      const item = itemOf(h.object);
      if (item) return { item, mesh: h.object, point: h.point };
      if (h.object.userData.door?.parts) return { door: h.object.userData.door, point: h.point };
      return null;
    }
    return null;
  }

  // khung sáng quanh vật đang trỏ
  const box = new THREE.Box3();
  const helper = new THREE.Box3Helper(box, 0xffc98a);
  helper.material.transparent = true;
  helper.material.opacity = 0;
  helper.material.depthTest = false;
  helper.renderOrder = 10;
  scene.add(helper);
  let current = null;
  function highlight(item) {
    if (item === current) return;
    current = item;
    gsap.killTweensOf(helper.material);
    if (item) {
      box.setFromObject(item.root).expandByScalar(0.03);
      gsap.fromTo(helper.material, { opacity: 0 }, { opacity: 0.9, duration: 0.25 });
    } else {
      gsap.to(helper.material, { opacity: 0, duration: 0.2 });
    }
  }

  function act(item, mesh) {
    const msg = ACT[item.type]?.(item, mesh);
    if (current === item) box.setFromObject(item.root).expandByScalar(0.03);
    if (msg) ui.toast(`${item.label}: ${msg}`);
  }

  // khi đổi ngày/hoàng hôn: cập nhật các đèn đã clone
  function updateGlow() {
    for (const g of glowMats) g.mat.emissiveIntensity = timeState.glow * g.k;
  }

  // khung sáng bám theo vật đang chuyển động (xe chạy, ghế kéo…)
  function refresh() {
    if (current && helper.material.opacity > 0) box.setFromObject(current.root).expandByScalar(0.03);
  }

  return { items, pick, highlight, act, updateGlow, refresh, verbOf: (item, mesh) => (item.type === 'Giuong' && mesh?.material.name === 'lightWarm' ? 'bật / tắt đèn ngủ' : item.verb) };
}

// ảnh màn hình TV vẽ bằng canvas: nền gradient + vài mảng sáng, lặp ngang được
function tvTexture(screen) {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 256;
  const g = c.getContext('2d');
  const grd = g.createLinearGradient(0, 0, 0, 256);
  grd.addColorStop(0, '#2a3f6b');
  grd.addColorStop(1, '#0d1220');
  g.fillStyle = grd;
  g.fillRect(0, 0, 512, 256);
  for (let i = 0; i < 14; i++) {
    const x = (i * 37) % 512, y = 40 + ((i * 53) % 170), r = 20 + ((i * 29) % 50);
    const rg = g.createRadialGradient(x, y, 0, x, y, r);
    rg.addColorStop(0, `rgba(255,${180 + ((i * 13) % 70)},${120 + ((i * 31) % 120)},0.85)`);
    rg.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = rg;
    for (const dx of [-512, 0, 512]) g.fillRect(x - r + dx, y - r, r * 2, r * 2);
  }
  g.fillStyle = 'rgba(255,255,255,0.85)';
  g.fillRect(24, 214, 150, 10);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  // UV của mặt TV tính theo mét -> co ảnh cho vừa đúng một màn hình
  screen.geometry.computeBoundingBox();
  const bb = screen.geometry.boundingBox;
  tex.repeat.set(1 / (bb.max.x - bb.min.x), 1 / (bb.max.y - bb.min.y));
  return tex;
}

function isInside(o, root) {
  for (let p = o; p; p = p.parent) if (p === root) return true;
  return false;
}
