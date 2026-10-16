// Số ngẫu nhiên có seed (LCG) — script Blender dùng đúng công thức này để ra cùng vị trí, cùng số lượng.
export function makeRng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}
