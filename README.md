# VN PDF Reader & Natural TTS 📖🎧

Công cụ **Web App Local** chuyên xử lý và đọc thành tiếng các tài liệu **PDF Tiếng Việt** bị lỗi font, lỗi bảng mã (TCVN3, VNI), dấu rời rạc, ngắt dòng giữa câu, hoặc PDF dạng ảnh scan.

---

## ✨ Tính năng nổi bật

1. **Tự động sửa lỗi văn bản PDF Tiếng Việt (`vn_text_processor.py`):**
   - **Tự động phát hiện & chuyển mã:** Chuyển đổi văn bản từ bảng mã cũ **TCVN3 (ABC)** và **VNI-Windows** sang **Unicode dựng sẵn (`NFC`)**.
   - **Khôi phục lỗi giải mã UTF-8 (Mojibake)** và gom các **dấu thanh bị tách rời** (combining diacritics).
   - **Nối câu thông minh:** Xóa dấu ngắt dòng cứng lưng chừng câu trong PDF và loại bỏ số trang/header/footer lặp lại ở mép giấy để giọng đọc liền mạch, không bị vấp.
2. **Tích hợp Quét OCR Tiếng Việt (`Tesseract.js vie`):**
   - Tự động phát hiện trang PDF bị hỏng bảng mã `ToUnicode CMap` hoặc PDF scan ảnh không có lớp chữ, và quét lại mặt chữ Tiếng Việt trực tiếp từ ảnh trang PDF độ phân giải cao.
3. **Giọng đọc AI tự nhiên (`edge-tts` + Google TTS fallback):**
   - Tích hợp giọng **Hoài My (Nữ - Miền Nam)** và **Nam Minh (Nam - Miền Bắc)** của Microsoft Edge Neural TTS.
   - **Tải trước âm thanh (Lookahead Pre-fetch):** Tự động tải trước 2 câu tiếp theo khi đang đọc giúp chuyển câu mượt mà, không bị trễ.
   - **Tô sáng (Highlight) từng câu đang đọc:** Click chuột vào bất kỳ câu nào để đọc ngay từ câu đó.
   - **Xuất file MP3:** Tải toàn bộ trang đang đọc thành file `.mp3` chỉ với 1 cú click.

---

## 🚀 Cách khởi động và sử dụng

### Cách 1: Click đúp file chạy nhanh (Khuyên dùng)
Chỉ cần nhấp đúp chuột vào file:
```
d:\workspace\tools\vn-pdf-reader\run.bat
```
Công cụ sẽ tự động bật Server tại máy của bạn và mở trình duyệt tới địa chỉ `http://127.0.0.1:8788`.

### Cách 2: Chạy bằng dòng lệnh (Terminal)
```powershell
cd d:\workspace\tools\vn-pdf-reader
.\.venv\Scripts\python.exe -m uvicorn src.main:app --host 127.0.0.1 --port 8788
```

---

## ⌨️ Phím tắt tiện lợi trên giao diện Web
- **`Space` (Phím cách):** Phát / Tạm dừng đọc.
- **`◀` / `▶` (Mũi tên Trái / Phải):** Lật sang trang trước / trang sau.
- **Click chuột vào câu bất kỳ:** Nhảy tới và đọc ngay từ câu đó.
