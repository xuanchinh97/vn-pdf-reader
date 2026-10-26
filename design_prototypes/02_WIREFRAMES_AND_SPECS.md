# ĐẶC TẢ THIẾT KẾ & WIREFRAME GIAO DIỆN TỐI GIẢN (APPLE STYLE)

---

## 1. Sơ đồ bố cục tổng thể (Master Layout)

```text
┌────────────────────────────────────────────────────────────────────────┐
│ [☰ Mục lục]         Tên Cuốn Sách — Trang 12 / 148          [Aa] [⋯]   │  <- Frosted Header
├────────────────────────────────────────────────────────────────────────┤
│                                                                        │
│                      CHƯƠNG III: MÙA THU HÀ NỘI                        │
│                                                                        │
│     Mùa thu Hà Nội không chỉ là một mùa trong năm, mà nó là            │
│     cả một miền ký ức sâu lắng trong tâm khảm của những người          │
│     con xa quê.                                                        │
│                                                                        │
│   ┌────────────────────────────────────────────────────────────┐       │
│   │ Gió heo may chớm lạnh mang theo hương hoa sữa nồng nàn     │       │  <- Đang đọc (Active Highlight)
│   │ len lỏi qua từng con ngõ nhỏ của phố cổ.                  │       │     (Dịu dàng, không chói gắt)
│   └────────────────────────────────────────────────────────────┘       │
│                                                                        │
│     Những gánh hàng hoa rong rêu, những nụ cười bình dị bên            │
│     ly cà phê sáng sớm bên hồ Gươm...                                  │
│                                                                        │
│                                                                        │
│                 ┌───────────────────────────────────┐                  │
│                 │  ⏮   ⏪   ( ▶ )   ⏩   ⏭   1.0x 🎙️ │                  │  <- Floating Capsule Player
│                 └───────────────────────────────────┘                  │     (Kính mờ, bo tròn mượt)
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Chi tiết các thành phần chính

### A. The Frosted Top Header (Thanh đỉnh kính mờ tối giản)
* **Chiều cao:** Chỉ 48px (giảm 60% so với trước).
* **Hiệu ứng:** Kính mờ siêu thực `backdrop-filter: blur(20px) saturate(180%)`.
* **Cấu trúc 3 cụm duy nhất:**
  1. **Bên trái:** Nút `[☰]` mở Mục lục / Dấu trang (Drawer trượt mượt mà từ cạnh trái).
  2. **Chính giữa:** Tên sách + Vị trí trang mờ tinh tế (`Trang 12 / 148`). Bấm vào đây có thể lật trang nhanh hoặc nhảy trang.
  3. **Bên phải:** 
     - Nút `[Aa]`: Mở bảng tùy chỉnh trải nghiệm đọc (Cỡ chữ, Phông chữ, Màu nền, Khoảng cách dòng).
     - Nút `[⋯]`: Menu tùy chọn nâng cao (Mở file khác, Tải MP3, Quét OCR thủ công, Hẹn giờ ngủ, Phím tắt).

### B. The Reading Canvas (Không gian đọc trung tâm)
* **Tỷ lệ vàng:** Độ rộng dòng chữ cố định từ 650px – 720px (độ rộng tối ưu theo khoa học đọc sách mắt người không bị mỏi khi quét qua lại).
* **Typography:**
  - Tiêu đề: *Literata / New York Serif* thanh nhã.
  - Nội dung: *Merriweather / Georgia Serif* với khoảng cách dòng $1.8 \times$ cực thoáng.
* **Highlight thông minh:** Khi AI đọc đến câu nào, câu đó được làm nổi bật với một dải màu vàng nhạt ấm áp (warm golden glow) bo góc mềm 6px, các câu còn lại giảm độ tương phản 15% để mắt hoàn toàn tập trung vào dòng đang nghe.

### C. The Floating Capsule Player (Viên thuốc âm thanh nổi)
* Vị trí: Nổi cách mép dưới 28px, căn giữa màn hình.
* Kích thước: Bo tròn tuyệt đối (`border-radius: 9999px`), phủ bóng mờ nhiều tầng tinh tế của Apple (`box-shadow: 0 10px 30px rgba(0,0,0,0.12)`).
* **Các nút bấm trên viên thuốc:**
  - `[⏮] [⏭]`: Lùi / Nhảy câu trước & sau.
  - `[⏪ 5s] [⏩ 10s]`: Tua nhanh tinh tế.
  - **Nút Play/Pause trung tâm:** Đường kính 44px, nổi bật với màu thương hiệu (Accent Color), có vòng sáng nhịp nhàng theo giọng đọc.
  - `[1.0x]`: Nút bấm chuyển nhanh tốc độ đọc (0.8x -> 1.0x -> 1.2x -> 1.5x -> 2.0x).
  - `[🎙️ Giọng đọc]`: Bấm vào mở popover chọn nhanh giọng AI (Tuấn Ngọc, Thành Đạt, Diễm Trinh...) với nhãn phân biệt nam/nữ rõ ràng.

### D. Bảng điều khiển kiểu Apple ("Sheet" & "Popover")
Thay vì trải dài các ô chọn lên màn hình:
1. **Drawer Mục lục (Left Sheet):** Trượt nhẹ nhàng từ cạnh trái sang với danh sách chương sách, đánh dấu trang và trích đoạn yêu thích.
2. **Popover [Aa]:** Lấy cảm hứng 100% từ Apple Books:
   - Thanh trượt chỉnh độ sáng & cỡ chữ A- / A+.
   - 4 ô tròn chọn màu nền (Trắng, Giấy ngà, Xám Titan, Đêm đen).
   - Danh sách phông chữ tinh tế (Sách cổ điển, Hiện đại, Không chân).
