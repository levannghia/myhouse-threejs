// Danh sách phòng (tên, vùng x/z, điểm xuất hiện [x, z, hướng nhìn]) — dùng chung cho nhà dựng bằng code và nhà tải từ GLB.
export function addRooms(b) {
  b.level('site', 0);
  b.room('Hồ bơi & sân vườn', -7.5, -18, 7.5, -27, [3.5, -19, 0.7]);
  b.level('g', 0);
  b.room('Gara / sân trước', -6, 7, 6, -4, [0.5, 6, 0]);
  b.room('Sảnh vào', 1.5, -4, 6, -7, [3.4, -4.8, 0]);
  b.room('Phòng khách', -6, -4, 1.5, -10, [0.6, -9.4, 2.3]);
  b.room('Phòng ăn', -6, -10, 1.5, -14, [0.8, -11.5, 1.6]);
  b.room('Bếp', -6, -14, 6, -18, [3.8, -14.4, 0.6]);
  b.room('WC khách', 1.5, -7, 3.2, -10);
  b.room('Kho', 1.5, -10, 3.2, -13);
  b.room('Hành lang / cầu thang', 3.2, -7, 6, -14);
  b.level('l2', 3.9);
  b.room('Sân hiên tầng 2', 1.5, 0.35, 5.6, -3, [3.5, -2.4, Math.PI]);
  b.room('Phòng ngủ master', -6, 0, 1.5, -8, [0.8, -6.8, 1.0]);
  b.room('Phòng sinh hoạt tầng 2', 1.5, -3, 6, -7, [2.5, -6.2, 3.4]);
  b.room('Tủ đồ (walk-in)', -1.5, -8, 1.5, -13);
  b.room('Phòng tắm master', -6, -8, -1.5, -13, [-2.2, -10, 1.57]);
  b.room('Hành lang tầng 2', 1.5, -7, 3.2, -14);
  b.room('Phòng ngủ 2', -6, -13, -0.5, -18, [-1.1, -14, 0.9]);
  b.room('Phòng tắm 2', -0.5, -14, 3.2, -18);
  b.room('Phòng giặt', 3.2, -14, 6, -18);
  b.room('Sảnh cầu thang tầng 2', 3.2, -12.6, 6, -14);
  b.level('l3', 7.2);
  b.room('Phòng ngủ tầng 3', 1.5, -1.2, 5.6, -5, [3.0, -4.6, 2.85]);
  b.room('Ban công tầng 3', 1.5, 0.3, 5.6, -1.2, [2.5, -1.0, Math.PI]);
  b.room('Phòng tắm tầng 3', -1.5, -0.3, 1.5, -5);
  b.room('Hành lang tầng 3', -1.5, -5, 6, -7, [4.9, -6.2, 0]);
  b.room('Thư viện', -1.5, -7, 3.2, -14, [2.5, -12.5, 2.4]);
  b.room('Phòng gia đình tầng 3', -1.5, -14, 1.5, -18, [1, -14.4, 0.4]);
  b.room('Sân thượng', 1.5, -14, 6, -18, [4.5, -14.6, 0.4]);
  b.room('Gác mái (kho)', -6, 0, -1.5, -18);
}
