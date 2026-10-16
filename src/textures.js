// Texture sinh bằng canvas — không cần file ảnh ngoài.
// Mỗi hàm trả về canvas; `toTexture(canvas, meters)` cho biết canvas phủ bao nhiêu mét thực.
import * as THREE from 'three';

function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function cv(size) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  return [c, c.getContext('2d')];
}

function grain(g, size, amount, r) {
  const img = g.getImageData(0, 0, size, size);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (r() - 0.5) * amount;
    d[i] += n;
    d[i + 1] += n;
    d[i + 2] += n;
  }
  g.putImageData(img, 0, 0);
}

function blotches(g, size, n, r, dark = 0.06) {
  for (let i = 0; i < n; i++) {
    const x = r() * size, y = r() * size, rad = size * (0.03 + r() * 0.12);
    const grd = g.createRadialGradient(x, y, 0, x, y, rad);
    const v = r() > 0.5 ? '0,0,0' : '255,255,255';
    grd.addColorStop(0, `rgba(${v},${dark * r()})`);
    grd.addColorStop(1, `rgba(${v},0)`);
    g.fillStyle = grd;
    g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  }
}

export function toTexture(canvas, meters, aniso = 8) {
  const t = new THREE.CanvasTexture(canvas);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.repeat.set(1 / meters, 1 / meters);
  t.anisotropy = aniso;
  return t;
}

// Bê tông ván khuôn (board-formed) — 1024px = 2.4m, ván rộng 15cm, lỗ ty mỗi 60cm.
export function boardConcrete(size = 1024) {
  const [c, g] = cv(size);
  const r = rng(7);
  g.fillStyle = '#c4c3be';
  g.fillRect(0, 0, size, size);
  const n = 16, bw = size / n;
  for (let i = 0; i < n; i++) {
    const v = (r() - 0.5) * 2;
    g.fillStyle = v > 0 ? `rgba(255,255,255,${v * 0.07})` : `rgba(0,0,0,${-v * 0.07})`;
    g.fillRect(i * bw, 0, bw, size);
    for (let k = 0; k < 7; k++) {
      g.strokeStyle = `rgba(70,70,70,${0.03 + r() * 0.06})`;
      g.lineWidth = 1 + r() * 2;
      const x = i * bw + r() * bw;
      g.beginPath();
      g.moveTo(x, 0);
      g.lineTo(x + (r() - 0.5) * 6, size);
      g.stroke();
    }
  }
  blotches(g, size, 60, r, 0.08);
  g.fillStyle = 'rgba(55,55,55,0.35)';
  for (let i = 0; i < n; i++) g.fillRect(i * bw, 0, 2, size);
  g.fillStyle = 'rgba(55,55,55,0.22)';
  g.fillRect(0, 0, size, 2);
  g.fillRect(0, size / 2, size, 2);
  g.fillStyle = 'rgba(45,45,45,0.55)';
  for (let x = 0; x < 4; x++)
    for (const y of [0.125, 0.375, 0.625, 0.875]) {
      g.beginPath();
      g.arc(x * (size / 4) + bw * 2, y * size, size / 230, 0, Math.PI * 2);
      g.fill();
    }
  grain(g, size, 16, r);
  return c;
}

// Nan gỗ sẫm (hàng rào, vách) — 512px = 1m, nan 10cm khe 1.2cm.
export function timberSlats(size = 512, vertical = false) {
  const [c, g] = cv(size);
  const r = rng(11);
  g.fillStyle = '#1e120d';
  g.fillRect(0, 0, size, size);
  const pitch = size / 10, gap = 6;
  for (let i = 0; i < 10; i++) {
    const base = [88 + r() * 18, 50 + r() * 10, 36 + r() * 8].map(Math.round);
    const p = i * pitch;
    g.fillStyle = `rgb(${base})`;
    if (vertical) g.fillRect(p, 0, pitch - gap, size);
    else g.fillRect(0, p, size, pitch - gap);
    for (let k = 0; k < 14; k++) {
      g.strokeStyle = `rgba(30,15,8,${0.1 + r() * 0.15})`;
      g.lineWidth = 1;
      g.beginPath();
      const o = p + r() * (pitch - gap);
      if (vertical) { g.moveTo(o, 0); g.lineTo(o + (r() - 0.5) * 3, size); }
      else { g.moveTo(0, o); g.lineTo(size, o + (r() - 0.5) * 3); }
      g.stroke();
    }
  }
  grain(g, size, 10, r);
  return c;
}

// Sàn gỗ sồi — 1024px = 2.4m, ván rộng 20cm.
export function woodFloor(size = 1024) {
  const [c, g] = cv(size);
  const r = rng(23);
  const rows = 12, rh = size / rows;
  for (let j = 0; j < rows; j++) {
    let x = -r() * 400;
    while (x < size) {
      const len = 300 + r() * 420;
      const b = [168 + r() * 26, 124 + r() * 20, 84 + r() * 16].map(Math.round);
      g.fillStyle = `rgb(${b})`;
      g.fillRect(x, j * rh, len, rh);
      for (let k = 0; k < 10; k++) {
        g.strokeStyle = `rgba(90,55,30,${0.06 + r() * 0.1})`;
        g.beginPath();
        const y = j * rh + r() * rh;
        g.moveTo(x, y);
        g.bezierCurveTo(x + len * 0.3, y + (r() - 0.5) * 6, x + len * 0.6, y + (r() - 0.5) * 6, x + len, y);
        g.stroke();
      }
      g.fillStyle = 'rgba(60,35,20,0.5)';
      g.fillRect(x, j * rh, 2, rh);
      x += len;
    }
    g.fillStyle = 'rgba(60,35,20,0.45)';
    g.fillRect(0, j * rh, size, 2);
  }
  grain(g, size, 8, r);
  return c;
}

// Gạch lát (ô vuông + ron) — dùng cho sân, phòng tắm.
export function tiles(size, count, color, grout, vary = 10, seed = 3) {
  const [c, g] = cv(size);
  const r = rng(seed);
  g.fillStyle = grout;
  g.fillRect(0, 0, size, size);
  const s = size / count;
  const base = new THREE.Color(color);
  for (let i = 0; i < count; i++)
    for (let j = 0; j < count; j++) {
      const v = (r() - 0.5) * vary / 255;
      g.fillStyle = `rgb(${[base.r + v, base.g + v, base.b + v].map((x) => Math.round(Math.min(1, Math.max(0, x)) * 255))})`;
      g.fillRect(i * s + 2, j * s + 2, s - 4, s - 4);
    }
  grain(g, size, 12, r);
  return c;
}

// Đá granite sẫm (trụ cổng, chân tường).
export function darkStone(size = 512) {
  const [c, g] = cv(size);
  const r = rng(5);
  g.fillStyle = '#3d3f42';
  g.fillRect(0, 0, size, size);
  for (let i = 0; i < 5000; i++) {
    const v = r();
    g.fillStyle = v > 0.7 ? 'rgba(200,200,200,0.35)' : 'rgba(10,10,10,0.4)';
    g.fillRect(r() * size, r() * size, 1 + r() * 2, 1 + r() * 2);
  }
  grain(g, size, 20, r);
  return c;
}

// Đá marble trắng cho sàn tầng trệt — 1024px = 1.6m (2x2 tấm 80cm).
export function marble(size = 1024) {
  const [c, g] = cv(size);
  const r = rng(31);
  g.fillStyle = '#e9e6e0';
  g.fillRect(0, 0, size, size);
  for (let i = 0; i < 26; i++) {
    g.strokeStyle = `rgba(120,115,110,${0.05 + r() * 0.12})`;
    g.lineWidth = 0.5 + r() * 1.8;
    g.beginPath();
    let x = r() * size, y = r() * size;
    g.moveTo(x, y);
    for (let k = 0; k < 8; k++) {
      x += (r() - 0.3) * 160;
      y += (r() - 0.5) * 120;
      g.lineTo(x, y);
    }
    g.stroke();
  }
  g.fillStyle = 'rgba(150,145,140,0.5)';
  g.fillRect(0, 0, size, 2);
  g.fillRect(0, size / 2, size, 2);
  g.fillRect(0, 0, 2, size);
  g.fillRect(size / 2, 0, 2, size);
  grain(g, size, 5, r);
  return c;
}

export function grass(size = 512) {
  const [c, g] = cv(size);
  const r = rng(13);
  g.fillStyle = '#4f7a35';
  g.fillRect(0, 0, size, size);
  for (let i = 0; i < 9000; i++) {
    const v = r();
    g.fillStyle = v > 0.5 ? 'rgba(120,160,70,0.35)' : 'rgba(30,60,20,0.35)';
    g.fillRect(r() * size, r() * size, 1, 2 + r() * 4);
  }
  blotches(g, size, 30, r, 0.1);
  return c;
}

export function asphalt(size = 512) {
  const [c, g] = cv(size);
  const r = rng(17);
  g.fillStyle = '#3a3b3d';
  g.fillRect(0, 0, size, size);
  grain(g, size, 40, r);
  blotches(g, size, 20, r, 0.12);
  return c;
}

// Mái tôn sóng đứng (standing seam) — 512px = 2m, seam mỗi 40cm.
export function roofMetal(size = 512) {
  const [c, g] = cv(size);
  const r = rng(19);
  g.fillStyle = '#4a4d51';
  g.fillRect(0, 0, size, size);
  for (let i = 0; i < 5; i++) {
    g.fillStyle = 'rgba(20,20,20,0.6)';
    g.fillRect(0, i * size / 5, size, 4);
    g.fillStyle = 'rgba(255,255,255,0.12)';
    g.fillRect(0, i * size / 5 + 4, size, 2);
  }
  grain(g, size, 8, r);
  return c;
}
