# Biệt thự Bê tông 3D

Website khám phá ngôi nhà 3 tầng bằng Three.js: xem ngoài, đi bộ trong nhà, mở cửa, dùng đồ vật,
cắt tầng xem mặt bằng, ngày / hoàng hôn. Mô hình dựng bằng code hoặc tải từ GLB xuất từ Blender.
Chi tiết thiết kế và quy trình Blender: [THIET_KE.md](THIET_KE.md).

## Chạy trên máy

```bash
node server.js
```

Mở http://localhost:5174 — không cần `npm install`. Three.js, GSAP và three-mesh-bvh tải từ CDN jsdelivr qua importmap trong `index.html`.

Đã tối ưu cho điện thoại / máy không card rời (gộp hình, pool đèn, mức chất lượng tự động) — xem mục 6.5 trong [THIET_KE.md](THIET_KE.md).

## Đưa lên GitHub Pages

Web là trang tĩnh (HTML + ES module + GLB), **không cần bước build**: GitHub Pages phục vụ nguyên thư mục này.

1. Tạo repository trống trên GitHub (vd. `nha-hien-dai`).
2. Đẩy code lên (thư mục này đã là repo git):

   ```bash
   git remote add origin https://github.com/<tên-bạn>/nha-hien-dai.git
   git push -u origin load_blender
   ```

3. Trên GitHub: **Settings › Pages › Build and deployment** → *Source*: **Deploy from a branch** → chọn nhánh `load_blender` (hoặc `master` sau khi merge) và thư mục **/ (root)** → **Save**.
4. Đợi 1–2 phút, web chạy ở `https://<tên-bạn>.github.io/nha-hien-dai/`.

Mỗi lần `git push` lên nhánh đó, Pages tự cập nhật.

### Những điểm đã chuẩn bị cho GitHub Pages

- Mọi đường dẫn là **tương đối** (`models/nha.glb`, `src/main.js`…) nên chạy được dưới đường dẫn con `/nha-hien-dai/`.
- `assets.json` liệt kê file có sẵn (`glb`, danh sách tầng có `lightmaps`), web không phải dò file → không có lỗi 404 trên console.
  Bake bằng `dung_nha.py --bake … --bake-dir nha-hien-dai/lightmaps` sẽ tự thêm tầng vào `assets.json`.
  Muốn web dựng nhà bằng code thay vì GLB: đặt `"glb": null` (hoặc mở trang với `?glb=0`).
- `.nojekyll`: tắt Jekyll, Pages phục vụ file y nguyên.
- `server.js` chỉ dùng khi chạy trên máy, GitHub Pages bỏ qua.

### Dung lượng

- `models/nha.glb` ~2.3 MB (đã nén Draco), `blender/nha_hien_dai.blend` ~1.4 MB — dưới giới hạn 100 MB/file của GitHub.
- `*.blend1` (bản sao lưu tự động của Blender) và `lightmaps/*.exr` đã được bỏ qua trong `.gitignore`.
  File `blender/nha_hien_dai.blend1` đã lỡ được commit, gỡ khỏi repo (giữ file trên máy) bằng:

  ```bash
  git rm --cached blender/nha_hien_dai.blend1
  ```
