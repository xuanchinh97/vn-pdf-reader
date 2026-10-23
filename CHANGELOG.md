# Nhật Ký Thay Đổi (Changelog)

Toàn bộ các thay đổi, tính năng mới và cải tiến của dự án **VN PDF Reader** được ghi nhận và theo dõi tại tệp này theo định dạng chuẩn [Keep a Changelog](https://keepachangelog.com/vi/1.0.0/) và tuân thủ [Semantic Versioning](https://semver.org/).

---

## [1.2.0] - 2026-10-23

### Added
- **Nâng Cấp Giao Diện Toàn Diện Theo Phong Cách Máy Đọc Sách (Kindle / Kobo / Boox):**
  - **Menu "Aa" Đặc Trưng Của E-Reader:** Popup tùy chỉnh toàn diện:
    - 4 Phông chữ chuẩn xuất bản: *Merriweather* (Sách serif truyền thống), *Literata* (Google Play Books E-Reader), *Inter* (Hiện đại không chân), *Georgia* (Cổ điển).
    - Tăng/giảm cỡ chữ trực quan từng pixel.
    - Chỉnh khoảng cách dòng: Gọn (1.5), Chuẩn (1.8), Thoáng (2.1).
    - Chỉnh độ rộng trang sách: Chuẩn máy đọc sách (720px), Vừa (880px), Tràn lề (100%).
    - Tùy chọn căn đều 2 lề (Justify) & thụt đầu dòng (Paragraph indent 1.6em) chuẩn sách in.
  - **4 Bộ Màu Chủ Đề E-Reader:**
    - 📜 **Giấy ngà (Sepia - Mặc định):** Màu giấy sách thật vàng ấm `#fcf6e8` với mực than dịu mắt, chống mỏi mắt khi đọc lâu.
    - 🌙 **Đêm sâu (OLED Dark):** Nền than tối dịu, chữ sáng ấm, không gây lóa khi đọc đêm.
    - 📱 **Mực điện tử (E-Ink Monochrome):** Đơn sắc tối giản siêu nét mô phỏng màn hình mực điện tử Kindle/Boox.
    - ☀️ **Sáng dịu (Daylight Soft):** Nền trắng sứ trang nhã, tương phản cao ban ngày.
  - **Bố Cục Đoạn Văn Sách (Book Flow):** Tự động gom các câu thành các đoạn văn sách tự nhiên, loại bỏ các nhãn số `#1`, `#2` thô cứng để tạo trải nghiệm đọc như cầm cuốn sách thật.
  - **Tô Sáng Bút Dạ Quang Sách (Whispersync Highlighter):** Câu đang đọc được highlight mềm mại kiểu bút dạ quang sách (màu vàng hổ phách dịu), êm mắt và tự động cuộn nhẹ nhàng.
  - **Chân Trang Tiến Độ Đọc Sách (E-Reader Footer):** Hiển thị tên sách, ước tính thời gian đọc còn lại (WPM), thanh tiến độ phần trăm % mượt mà và số trang `Trang X / Y`.
  - **Mũi Tên Lật Trang Nổi (Kindle Oasis Navigators):** Hai nút lật trang mỏng tinh tế ở 2 mép màn hình, bấm hoặc dùng phím mũi tên để lật trang tức thì.
  - **Chế Độ Đọc Tập Trung (Zen / Focus Mode - Phím F):** Ẩn toàn bộ thanh công cụ thừa, đưa trang sách vào chính giữa toàn màn hình để người đọc chìm đắm hoàn toàn vào nội dung.

---

## [1.1.0] - 2026-10-23

### Added
- **5 Subagents Chuyên Biệt (`.agents/`):**
  - `uiux-designer-agent`: Thiết kế UI/UX, Typography, Design System và tối ưu trải nghiệm đọc sách số.
  - `backend-data-agent`: Xử lý API FastAPI, chuẩn hóa font tiếng Việt, trích xuất PDF PyMuPDF và tích hợp TTS engines.
  - `frontend-ui-agent`: Lập trình giao diện Vanilla JS, Audio Player đồng bộ highlight và hiệu năng tương tác.
  - `qa-test-agent`: Thiết kế và thực thi kiểm thử tự động Pytest (55+ test cases), kiểm thử ca biên và lập báo cáo QA.
  - `code-reviewer-agent`: Phản biện mã nguồn độc lập, rà soát bảo mật, rò rỉ bộ nhớ và đánh giá kiến trúc.
- **Tài liệu Subagents:** Bổ sung `.agents/AGENTS.md` mô tả quy trình cộng tác 5 bước và các tệp đặc tả chi tiết cho từng agent.
- **Tệp theo dõi:** Bổ sung `CHANGELOG.md` để ghi vết thay đổi và `.gitignore` chuẩn cho dự án Python + Web.

### Changed
- **Tối ưu thứ tự giọng đọc:** Đưa Microsoft Edge Neural (`vi-VN-HoaiMyNeural`, `vi-VN-NamMinhNeural`) lên đầu danh sách khuyên dùng vì tốc độ nhanh (1–2s), tự nhiên và không bị giới hạn hạn mức.
- **Tải trước tuần tự (Sequential Prefetching):** Chỉ tải ngầm câu tiếp theo sau khi câu hiện tại đã bắt đầu phát thành công, giải quyết triệt để vấn đề 3 request cùng lúc gây nghẽn băng thông mạng.

### Fixed
- **Độ trễ khi chuyển đổi giọng đọc (Voice Switching Lag):**
  - Ngắt ngay lập tức âm thanh của giọng cũ (`0ms latency`) khi người dùng bấm chọn giọng mới, hiển thị trạng thái `⏳ Đang đổi giọng...`.
  - Khắc phục tình trạng giọng cũ vẫn tiếp tục đọc đè lên trong khi giọng mới đang tải.
- **Tự động xử lý lỗi FPT.AI 429 (Rate Limit / Quota Exceeded):**
  - Tự động phát hiện khi tài khoản FPT.AI hết quota miễn phí để chuyển thẳng sang Microsoft Edge Neural mà không phải chờ thử lại, loại bỏ 2.5 giây độ trễ dư thừa.

---

## [1.0.0] - 2026-10-22

### Added
- **Bộ xử lý văn bản tiếng Việt toàn diện (`src/vn_text_processor.py`):**
  - Hỗ trợ chuyển đổi tự động các bảng mã cổ TCVN3 (ABC), VNI sang Unicode dựng sẵn (NFC).
  - Sửa lỗi ký tự cổ thường gặp trong ebook PDF scan/vnthuquan: `ƣ` (`\u01a3`) thành `ư`, `Ƣ` (`\u01a2`) thành `Ư`.
  - Chuẩn hóa tổ hợp dấu tách rời (combining diacritics), sửa lỗi font nhảy chữ hoa/thường.
  - Thuật toán nối dòng thông minh (smart line unwrapping) bảo toàn cấu trúc đoạn văn, không làm gãy câu giữa chừng.
  - Tách câu tiếng Việt chuẩn ngữ pháp, nhận diện và giữ nguyên các từ viết tắt phổ biến (TP.HCM, TS., GS., v.v.).
- **Dịch vụ trích xuất PDF thông minh (`src/pdf_service.py`):**
  - Trích xuất văn bản có nhận diện tọa độ khối (block layout coordinates).
  - Tự động lọc bỏ phần lề thừa (header, footer, số trang, metadata trang).
  - Xuất ảnh trang PDF độ phân giải cao phục vụ OCR khi phát hiện trang scan hoặc font bị mã hóa lỗi nặng.
- **Tích hợp đa giọng đọc Text-to-Speech (TTS) (`src/tts_service.py`):**
  - Microsoft Edge Neural TTS: Giọng Hoài My (Nữ Nam Bộ) và Nam Minh (Nam Bắc Bộ) qua HTTP proxy công ty (`http://10.10.101.208:3128`).
  - FPT.AI API v5: Giọng Ban Mai, Thu Minh, Minh Quang, Lê Minh, Lan Nhi, Mỹ An, Gia Huy.
  - Google Translate TTS: Giọng đọc dự phòng cuối cùng.
  - Cơ chế đệm âm thanh trên đĩa (`~/.vn_pdf_reader/tts_cache`) giúp nghe lại tức thì và tiết kiệm quota ký tự.
- **Giao diện Web tương tác hiện đại (`src/static/`):**
  - Bố cục Split-Pane: Xem ảnh chụp trang PDF gốc song song với danh sách câu văn bản sạch.
  - Đồng bộ âm thanh & văn bản: Tự động highlight câu đang đọc và cuộn mượt mà theo tiến độ.
  - Hỗ trợ 3 bộ chủ đề màu sắc: Tối (Dark), Sáng (Light) và Giấy ngà (Sepia).
  - Thanh công cụ điều khiển: Play, Pause, chuyển câu, chọn tốc độ phát (0.85x - 2.0x), tải MP3 toàn trang.
  - Tích hợp quét OCR tiếng Việt trên trình duyệt bằng thư viện `Tesseract.js`.
  - Hộp thoại Cài đặt (Settings Modal): Cho phép cấu hình FPT.AI API key và HTTP proxy trực tiếp trên web.
- **Bộ kiểm thử tự động toàn diện (`tests/`):**
  - 55 test cases hoàn chỉnh (Unit, Integration, E2E) đạt tỉ lệ Pass 100%.
  - Tự động sinh dữ liệu PDF giả lập kiểm thử bảng mã và trang scan.
  - Kịch bản chạy nhanh: `run.bat` và `run_silent.vbs`.
