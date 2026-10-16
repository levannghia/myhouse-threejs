# Biệt thự Bê tông – Hồ sơ thiết kế 3D

Mô phỏng theo ảnh tham khảo: khối bê tông ván khuôn mái dốc một mái bên trái, khối hộp lam gỗ bên phải,
bồn cây rủ chạy suốt mặt tiền tầng 2, gara mở dưới sàn đua, hàng rào nan gỗ sẫm trên trụ đá.

**Chạy thử:** `node nha-hien-dai/server.js` rồi mở http://localhost:5174

| Thao tác | Phím / chuột |
|---|---|
| Xem ngoài | kéo chuột xoay, lăn chuột zoom, click vào cửa/cổng để mở |
| Đi bộ | `W A S D`, `Shift` chạy, chuột nhìn, `E` mở/đóng cửa, `Esc` nhả chuột |
| Cắt tầng | nút T1 / T2 / T3 (ẩn các tầng phía trên để xem mặt bằng) |
| Đi tới phòng | menu "Đi tới phòng" |
| Sang Blender | nút "Xuất GLB" → Blender: File › Import › glTF 2.0 |

---

## 1. Kích thước tổng thể

Toạ độ trong code: **x** trái→phải, **y** lên trên, **z** hướng ra đường. Gốc nằm giữa mặt tiền tầng 2.

| Hạng mục | Giá trị |
|---|---|
| Khu đất | 15 × 34 m (x −7.5 → 7.5, z +7.2 → −27) |
| Nhà | 12 × 18 m (x −6 → 6, z 0 → −18) |
| Cao độ sàn | T1 = 0.00 · T2 = +3.90 · T3 = +7.20 |
| Mái | mái bằng khối phải +10.40 · mái dốc trái từ +7.50 (x = −6) lên +11.60 (x = 1.5), dốc ≈ 28.7° |
| Lam bê tông đứng bên phải | x 5.6 → 6.0, cao tới +11.30 |
| Sàn đua (mái gara) | đua ra tới z = +1.05, đỡ bởi 2 cột thép Ø220 |

## 2. Mặt đứng chính (từ trái sang phải)

- **Khối trái (x −6 → 1.5):** tường bê tông ván khuôn đặc từ +3.9 lên tới mái dốc, không có cửa sổ mặt tiền (lấy sáng từ hông trái và mặt sau). Mái đua 0.6 m về bên trái.
- **Khối phải (x 1.5 → 6):** T2 lùi vào 3 m làm sân hiên có trần ấm; T3 là hộp phòng ngủ, ban công có 5 lam gỗ xoay + lan can thanh đứng, đỉnh hộp có dải lam thép ngang.
- **Dải bồn cây T2:** chạy suốt x −4.6 → 6, cao 0.85 m, cây rủ xuống viền sàn đua, lan can thép mảnh phía sau.
- **Tầng trệt (lùi vào z = −4):** kính phòng khách (trái) · tường bê tông điểm nhấn có đèn hắt chân · vách lam gỗ đứng có cửa chính xoay trục cao 3.6 m · ốp gỗ sẫm.
- **Hàng rào:** nan gỗ ngang sẫm trên chân đá, trụ granite, cổng trượt 2 cánh (mặc định mở như ảnh).

## 3. Mặt bằng các tầng

### Tầng 1 (±0.00, trần 3.60)
| Phòng | Vị trí (x; z) | Ghi chú |
|---|---|---|
| Gara / sân trước | −6→6; +7.2→−4 | lát gạch xám, 1 xe, đèn âm trần |
| Sảnh vào | 1.5→6; −4→−7 | tủ giày, tranh, cửa chính xoay |
| Phòng khách | −6→1.5; −4→−10 | TV trên mặt trong tường bê tông, sofa, kính hông trái |
| Phòng ăn | −6→1.5; −10→−14 | bàn 6 ghế, 3 đèn thả |
| Bếp | −6→6; −14→−18 | tủ bếp tường phải, đảo bếp, kính trượt ra hồ bơi |
| WC khách, kho | 1.5→3.2; −7→−13 | |
| Cầu thang | 4.65→5.9; −7→−12.6 | 20 bậc gỗ công-xôn, cao bậc 195 mm, lan can kính |
| Sân sau | z −18→−27 | thềm đá, hồ bơi 8 × 4 m, cỏ, ghế tắm nắng |

### Tầng 2 (+3.90, trần 3.00)
| Phòng | Vị trí (x; z) | Ghi chú |
|---|---|---|
| Phòng ngủ master | −6→1.5; 0→−8 | giường king, cửa kính trượt ra sân hiên |
| Tủ đồ walk-in | −1.5→1.5; −8→−13 | |
| Phòng tắm master | −6→−1.5; −8→−13 | bồn tắm, lavabo đôi, vòi sen kính |
| Sân hiên + sinh hoạt | 1.5→6; +0.35→−7 | ghế nằm, sofa, kính trượt |
| Hành lang | 1.5→3.2; −7→−14 | dọc lỗ thang, lan can kính |
| Phòng ngủ 2 | −6→−0.5; −13→−18 | |
| Phòng tắm 2, phòng giặt | −0.5→6; −14→−18 | |
| Cầu thang lên T3 | 3.25→4.5; −12.6→−7 | 17 bậc, đi ngược chiều thang dưới |

### Tầng 3 (+7.20)
| Phòng | Vị trí (x; z) | Ghi chú |
|---|---|---|
| Phòng ngủ T3 + ban công | 1.5→5.6; +0.3→−5 | hộp lam gỗ ở mặt tiền |
| Phòng tắm T3 | −1.5→1.5; −0.3→−5 | dưới mái dốc |
| Thư viện | −1.5→3.2; −7→−14 | kệ sách dài 5.6 m dọc tường lửng |
| Phòng gia đình | −1.5→1.5; −14→−18 | cửa kính ra sân thượng |
| Sân thượng | 1.5→6; −14→−18 | sàn gỗ, ghế nằm, lan can kính |
| Gác mái (kho) | −6→−1.5 | phần thấp dưới mái dốc, sau tường lửng |

## 4. Vật liệu

| Vật liệu | Dùng ở | Gợi ý PBR khi làm bằng Blender |
|---|---|---|
| Bê tông ván khuôn (ván 15 cm, lỗ ty 60 cm) | khối trái, lam, tường điểm nhấn | Color + Normal + Roughness 0.9 |
| Gỗ nan sẫm (walnut/teak) | hàng rào, vách lam, cửa, lam xoay | Color + Normal, Roughness 0.65 |
| Thép sơn xám than | cột, lan can, lam đỉnh hộp | Metallic 0.7, Roughness 0.45 |
| Kính hộp | toàn bộ cửa | Transmission (Blender) → trong Three.js dùng opacity/Physical |
| Sàn gỗ sồi / marble / gạch xám | T2–T3 / T1 / sân | tiled texture 2K |
| Bồn cây rủ | T2 | Blender: hair/particle hoặc mesh lá có alpha |

---

## 5. Có cần làm bằng Blender không?

**Ngắn gọn:** không bắt buộc để *có* một website khám phá nhà – bản Three.js trong thư mục này đã đi lại được
trong nhà. Nhưng **nên dùng Blender** nếu muốn đẹp gần như ảnh chụp.

| | Dựng bằng code Three.js (hiện tại) | Dựng bằng Blender → GLB |
|---|---|---|
| Hình khối kiến trúc (tường, sàn, cầu thang) | ✅ tốt, sửa kích thước bằng số rất nhanh | ✅ tốt |
| Nội thất chi tiết (sofa bo cong, đèn, cây) | ❌ chỉ là khối hộp | ✅ dựng hoặc tải sẵn (Poly Haven, Sketchfab) |
| Ánh sáng/bóng mềm, ánh sáng phản xạ | ⚠️ realtime, hơi "phẳng" | ✅ **bake lightmap** → web chạy nhẹ mà trông như render |
| Texture PBR có UV chuẩn | ⚠️ texture sinh bằng canvas | ✅ UV unwrap, texture 2K/4K |
| Va chạm, logic cửa, giao diện | ✅ viết trong JS | vẫn phải viết trong JS |

### Quy trình đề xuất (kết hợp cả hai)

1. **Blockout = bản web.** Chốt kích thước, mặt bằng, luồng đi lại ngay trên web.
2. **Dựng trong Blender bằng script** `blender/dung_nha.py` (mục 6) — cùng toạ độ, cùng tên object với web.
3. Trong Blender: làm vật liệu PBR thật, thay nội thất khối hộp bằng model thật (giữ tên Empty cha).
4. **Bake lightmap** cho phần tĩnh (mục 6.3).
5. Export `File › Export › glTF 2.0 (.glb)`, bật **Draco**, nhớ tick *UVs* để giữ UV thứ hai (TEXCOORD_1).
6. Trên web: tải GLB bằng `GLTFLoader` + `DRACOLoader`, gán `material.lightMap` = ảnh LM_<tầng>, lấy lại cửa theo tên `DOOR_*`, giữ `walker.js` cho va chạm.

## 6. Làm trong Blender

### 6.1 Chạy script

- **Giao diện:** Blender 5.x › tab *Scripting* › *Open* `blender/dung_nha.py` › *Run Script* (Alt+P).
  Script tạo scene mới **NhaHienDai** (không đụng scene khác); chạy lại là dựng lại từ đầu.
- **Dòng lệnh** (không mở giao diện, ~3 giây):

```bash
D:/Blender/blender.exe -b --python nha-hien-dai/blender/dung_nha.py -- --save nha.blend
```

| Tham số sau `--` | Ý nghĩa |
|---|---|
| `--save nha.blend` | lưu file .blend |
| `--render anh.png --samples 64 --res 1600x1200 --camera Cam_GocTrai` | render thử |
| `--time ban_ngay` | ánh sáng ban ngày (mặc định `hoang_hon` giống ảnh) |
| `--lightmap` | tạo UV thứ hai `Lightmap` |
| `--bake 2048 --bake-samples 256 --bake-levels g,l2 --bake-dir D:/lightmaps` | tạo UV + bake ra `LM_<tầng>.exr` |
| `--names danh_sach.txt` | ghi tên + vị trí mọi object (để đối chiếu với web) |

Camera có sẵn: `Cam_MatTien` (góc giống ảnh), `Cam_GocTrai`, `Cam_PhongKhach`, `Cam_TrenCao`.

### 6.2 Quy tắc "cùng toạ độ, cùng tên"

- **Trục:** code viết theo hệ Three.js rồi đổi sang Blender: `Blender (X, Y, Z) = (x, −z, y)` — đúng cách glTF đổi trục, nên GLB xuất từ Blender khớp vị trí với web. Mặt tiền nhìn về **−Y** (view *Front* của Blender).
- **Tên object:** `<tầng>_<nhóm>_<NN>` — vd. `g_MatTien_03`, `l2_KhoiPhai_12`, `l3_HopPhongNgu_07`.
  Nhóm theo từng khối: `San`, `MatTien`, `VachLam`, `CuaChinh`, `TuongNgoai`, `WC`, `CauThang`, `Gara`, `BonCay`, `KhoiTrai`, `KhoiPhai`, `VachTrong`, `DauHoi`, `HopPhongNgu`, `Tuong`, `SanThuong`, `MaiDoc`, `MaiBang`, `Nen`, `HangRao`, `HoBoi`, `NhaBen`.
- **Cửa:** Empty `DOOR_<tên>` (vd. `DOOR_CuaChinh`, `DOOR_CuaHoBoi`, `DOOR_Cong_Trai`), có custom property `door` = `slide`/`pivot` và độ dịch/góc mở.
- **Nội thất, cây:** Empty `<tầng>_<loại>_<NN>` (`g_Sofa_01`, `l2_Giuong_02`, `site_Cay_05`…), mảnh con `<tên>_<k>`.
- **Đèn:** `<tầng>_Den_<NN>`, đèn hắt `g_DenHat_<NN>`; công suất đổi từ candela của web: `W = cd · 4π / 683 · 1000`.
- **Collection:** `g`, `l2`, `l3`, `roof`, `site` — trùng tên group trên web. Vật liệu trùng tên key trong `src/materials.js`.
- **Ngẫu nhiên:** cây, sách, dây leo dùng chung LCG + seed (`src/rand.js`), nên số lượng và vị trí như nhau.
- **Đã kiểm tra:** cả 1755 object có tên giống hệt nhau giữa web và Blender, vị trí lệch tối đa 0.08 mm (cửa ở trạng thái đóng, cổng mở).
- ⚠️ Nếu file .blend đã có object trùng tên (vd. bạn đã import GLB của web vào scene khác), Blender sẽ thêm đuôi `.001` — script in cảnh báo. Hãy chạy trong file trống hoặc xoá bản import cũ.
- Sửa kích thước thì sửa **cả** `src/house.js` và `blender/dung_nha.py` (cấu trúc 2 file giống nhau từng dòng).

### 6.3 Bake lightmap

1. Tạo UV thứ hai: bật `TAO_UV_LIGHTMAP = True` ở đầu script (hoặc chạy với `--lightmap`). Mỗi tầng dùng chung một atlas 0..1; kính, nước, dây leo, collider bị bỏ qua.
2. Chỉnh vật liệu xong mới bake. Kiểm tra ánh sáng bằng render (`Cam_PhongKhach`…), chỉnh đèn `*_Den_*`.
3. Bake: `--bake 2048 --bake-samples 256` (hoặc gọi `bake_lightmaps(scene, 'D:/lightmaps')` trong console Python).
   Script bake kiểu **Diffuse, chỉ Direct + Indirect** (không lẫn màu vật liệu) vào node ảnh `LM_BAKE` của từng vật liệu → lưu `LM_g.exr`, `LM_l2.exr`…
   Ảnh 2048 / 256 sample cho tầng 1 mất khoảng vài phút với CPU; bật GPU trong *Preferences › System* để nhanh hơn.
4. Khử nhiễu: mở ảnh trong *Compositor* › node *Denoise*, hoặc tăng sample.
5. Trên web: `mat.lightMap = tex; mat.lightMap.channel = 1; mat.lightMapIntensity = 1` (three r169) cho các mesh của tầng đó, rồi giảm/tắt bớt đèn realtime.

> Lưu ý: vật liệu dùng chung giữa nhiều tầng, nên node `LM_BAKE` trỏ vào ảnh của tầng bake **gần nhất**. Node này không nối vào shader nên không ảnh hưởng render.

## 7. Cấu trúc code

```
nha-hien-dai/
  index.html        giao diện + importmap three@0.169
  server.js         server tĩnh (node server.js, cổng 5174)
  src/main.js       renderer, bầu trời/ánh sáng ngày–hoàng hôn, chế độ xem, cắt tầng, xuất GLB
  src/house.js      kiến trúc 3 tầng + mái (mọi kích thước ở đây)
  src/furniture.js  nội thất (mỗi món là 1 hàm → dễ thay bằng GLB)
  src/site.js       đường, hàng rào, cổng, hồ bơi, cây, nhà bên
  src/builder.js    hàm dựng tường có lỗ cửa, sàn, kính, cửa tương tác
  src/walker.js     đi bộ góc nhìn thứ nhất, va chạm, leo cầu thang
  src/textures.js   texture sinh bằng canvas (bê tông, gỗ, gạch…)
  src/rand.js       số ngẫu nhiên có seed (chung thuật toán với script Blender)
  blender/dung_nha.py  dựng lại nhà trong Blender: cùng toạ độ + tên, UV lightmap, bake
```
