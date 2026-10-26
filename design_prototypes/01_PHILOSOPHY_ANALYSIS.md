# TRIẾT LÝ THIẾT KẾ STEVE JOBS CHO VN PDF READER
> *"Simplicity is not the lack of clutter, that's a consequence of simplicity. Simplicity is somehow essentially describing the purpose and place of an object and product."* — **Jony Ive & Steve Jobs**

---

## 1. Thực trạng & "Căn bệnh" của phiên bản hiện tại
Phiên bản hiện tại đáp ứng rất tốt về mặt kỹ thuật và tính năng (giọng đọc Kokoro AI, sửa mã font TCVN3/VNI, OCR, cache), tuy nhiên về mặt giao diện người dùng (UI/UX) đang mắc phải những vấn đề điển hình của phần mềm kỹ thuật:

1. **Quá tải nhận thức (Cognitive Overload):**
   - Có đến **hơn 28 nút bấm, ô chọn, thanh gạt** cùng hiển thị đồng thời trên màn hình (`topbar` và `subbar`).
   - Mọi "ruột gan" kỹ thuật đều bị phơi bày ra trước mắt người dùng: *Chế độ mã chữ, Ép chuyển mã TCVN3, Tự động OCR, API Key, Proxy, DPI, Enhance OCR...*
2. **Nội dung bị lấn át bởi công cụ:**
   - Mục đích thiêng liêng nhất của một người mở ứng dụng đọc sách là: **Được đắm chìm vào trang sách và lắng nghe giọng kể.**
   - Nhưng các thanh công cụ chiếm tới 15-20% diện tích chiều dọc, tạo cảm giác như đang mở một phần mềm dựng video hoặc bảng điều khiển kỹ thuật chứ không phải một cuốn sách.
3. **Thiếu tính liền mạch và cảm xúc:**
   - Các biểu tượng emoji trộn lẫn (`📖`, `📑`, `📂`, `⏮`, `⏸`, `🌙`, `⚙️`, `🔍`, `✏️`) khiến giao diện bị vụn, thiếu đi sự sang trọng, thanh lịch và tĩnh tại mà một sản phẩm đọc sách chuẩn mực cần có.

---

## 2. Áp dụng 5 Triết lý kinh điển của Steve Jobs & Apple

### Triết lý 1: "It Just Works" (Nó tự khắc hoạt động hoàn hảo)
* **Ý tưởng của Jobs:** Người dùng không cần biết và không quan tâm bên dưới là TCVN3, VNI hay OCR. Họ chỉ cần biết: họ ném một cuốn sách vào, sách hiển thị tiếng Việt chuẩn đẹp và đọc bằng giọng truyền cảm.
* **Thay đổi:** 
  - Khai tử toàn bộ hàng thanh công cụ thứ 2 (`subbar`).
  - Hệ thống tự động phân tích: Nếu lỗi font -> tự sửa; nếu scan mờ -> tự tối ưu; nếu thiếu dấu -> tự khôi phục.
  - Loại bỏ hoàn toàn các nút kỹ thuật khỏi mắt người dùng. Chỉ giữ một icon tinh tế trong menu phụ nếu người dùng chuyên sâu muốn can thiệp.

### Triết lý 2: "Content First - The Interface Disappears" (Giao diện vô hình)
* **Ý tưởng của Jobs:** Giống như Safari Reader hay Apple Books, chiếc máy đọc sách tuyệt vời nhất là chiếc máy mà bạn **quên mất sự tồn tại của phần mềm**, chỉ còn lại chữ và âm thanh.
* **Thay đổi:**
  - **Header siêu mỏng (Translucent / Frosted Glass):** Mờ nhẹ khi cuộn trang, tự động ẩn khi người dùng bắt đầu đọc say sưa, chỉ hiện lại khi di chuột lên mép trên.
  - Không gian đọc sách chiếm **90%+ diện tích màn hình**, lề sách thoáng đãng, kiểu chữ Serif tôn vinh văn chương (như font New York / Bookerly của Apple Books).

### Triết lý 3: "The Floating Capsule Player" (Viên thuốc âm thanh nổi)
* **Lấy cảm hứng từ:** Dynamic Island của iPhone & Now Playing widget của iOS / macOS.
* **Thay đổi:**
  - Gom toàn bộ cụm điều khiển phát âm thanh rải rác (6 nút bấm thô kệch) thành **một thanh Floating Pill (Viên thuốc nổi) duy nhất** nằm nhẹ nhàng ở cạnh dưới màn hình.
  - Nút Play/Pause chính giữa tròn thanh thoát, có hiệu ứng sóng âm (Waveform pulse) sống động khi đang đọc.
  - Tua câu, đổi giọng đọc, chỉnh tốc độ được tích hợp thành cụm tương tác một chạm (One-touch popover) vô cùng thanh lịch.

### Triết lý 4: "Typography & Materials as Art" (Nghệ thuật con chữ & Chất liệu)
* Chữ là yếu tố duy nhất người dùng nhìn hàng giờ liền.
* Bộ phông được tinh tuyển khắt khe: Font New York Serif cho cảm xúc văn học sâu lắng, San Francisco cho giao diện sắc nét.
* **4 chất liệu không gian đọc được thiết kế tỉ mỉ:**
  - 📜 **Warm Cream (Giấy ngà ấm):** Giảm ánh sáng xanh, êm dịu cho mắt khi đọc lâu.
  - 📄 **Pure Chalk (Trắng phấn):** Thanh sạch, hiện đại, độ tương phản cao.
  - 🩶 **Titanium Slate (Xám Titan mờ):** Tĩnh lặng, êm ái cho mắt vào buổi chiều tối.
  - 🖤 **Midnight OLED (Đen tuyền):** Đen sâu thẳm, chống lóa tuyệt đối trong phòng tối, tiết kiệm pin.

### Triết lý 5: "Saying No to 1,000 Things" (Nghệ thuật khước từ tính năng thừa)
* Steve Jobs từng nói: *"Tập trung không phải là nói CÓ với điều bạn muốn làm, mà là nói KHÔNG với hàng trăm ý tưởng tốt khác để dồn sức cho điều cốt lõi."*
* Ta dũng cảm lược bỏ những nút bấm ít dùng, dồn chúng vào đúng **1 nút menu 3 chấm hoặc nút Aa tinh tế**. 
* Mọi hành động thừa được thay bằng phím tắt tự nhiên (Space để Đọc/Dừng, Mũi tên để lật trang, J/K để nhảy câu).
