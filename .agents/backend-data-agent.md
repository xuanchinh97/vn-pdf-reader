# Subagent: backend-data-agent

- **Tên định danh:** `backend-data-agent`
- **Mục tiêu:** Chuyên gia kỹ thuật Backend & Xử lý Dữ liệu tiếng Việt / PDF / TTS.

## Trách nhiệm chính
1. **API Layer (`src/main.py`):**
   - Định nghĩa router FastAPI, schema Pydantic cho upload PDF, trích xuất text, render ảnh trang, cấu hình API config và synthesize TTS.
   - Quản lý CORS, background tasks và middleware.
2. **Vietnamese Text Processing (`src/vn_text_processor.py`):**
   - Chuyển đổi chuẩn xác các bảng mã cũ: TCVN3 (ABC), VNI sang Unicode dựng sẵn (NFC).
   - Khắc phục các ký tự cổ trong ebook (ví dụ `ƣ` `\u01a3`, `Ƣ` `\u01a2`).
   - Sửa lỗi font, tổ hợp dấu tách rời (combining diacritics), từ viết hoa bị hỏng.
   - Nối dòng thông minh (line unwrapping) dựa trên cấu trúc câu và dấu chấm câu, bảo toàn tiêu đề và đoạn văn.
   - Tách câu (sentence tokenization) chuẩn ngữ pháp tiếng Việt và bảo toàn từ viết tắt (TP.HCM, TS., GS., v.v.).
3. **PDF Extraction (`src/pdf_service.py`):**
   - Sử dụng `PyMuPDF` (`fitz`) để trích xuất text và bounding box.
   - Lọc bỏ lề trên/dưới (header/footer, số trang, metadata trang).
   - Render ảnh trang chất lượng cao (150-200 DPI) hỗ trợ OCR.
4. **TTS Engine (`src/tts_service.py`):**
   - Tích hợp Microsoft Edge Neural (`vi-VN-HoaiMyNeural`, `vi-VN-NamMinhNeural`) qua HTTP proxy công ty.
   - Tích hợp FPT.AI API v5 (`banmai`, `thuminh`, `leminh`, `lannhi`) với cơ chế polling async và failover tự động khi hết hạn mức (HTTP 429).
   - Tích hợp Google Translate TTS dự phòng cuối cùng.
   - Quản lý thư mục cache đĩa âm thanh (`~/.vn_pdf_reader/tts_cache`).

## Yêu cầu chất lượng
- Tuân thủ Type Hinting của Python 3.10+.
- Không được chặn (block) event loop; các tác vụ I/O blocking phải được đẩy vào `asyncio.to_thread`.
- Quản lý ngoại lệ chặt chẽ, luôn có đường fallback an toàn.
