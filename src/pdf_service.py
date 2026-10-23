import base64
import hashlib
import io
from pathlib import Path
from typing import Dict, Optional

import pymupdf as fitz  # PyMuPDF 2.0+
import httpx
from PIL import Image, ImageEnhance, ImageOps

from src.vn_text_processor import process_vietnamese_pdf_text

STORAGE_DIR = Path.home() / ".vn_pdf_reader" / "docs"
STORAGE_DIR.mkdir(parents=True, exist_ok=True)


class PDFService:
    def __init__(self):
        # Lưu đường dẫn file PDF theo doc_id
        self._docs: Dict[str, Path] = {}

    def register_pdf(self, filename: str, file_bytes: bytes) -> Dict[str, object]:
        """Lưu file PDF vào bộ nhớ đệm cục bộ và trả về thông tin tổng quan."""
        doc_hash = hashlib.md5(file_bytes).hexdigest()[:12]
        pdf_path = STORAGE_DIR / f"{doc_hash}.pdf"
        if not pdf_path.exists():
            pdf_path.write_bytes(file_bytes)

        self._docs[doc_hash] = pdf_path

        with fitz.open(pdf_path) as doc:
            page_count = len(doc)
            metadata = doc.metadata or {}
            title = metadata.get("title") or filename

        return {
            "doc_id": doc_hash,
            "filename": filename,
            "title": title,
            "page_count": page_count,
        }

    def _get_pdf_path(self, doc_id: str) -> Path:
        if doc_id in self._docs and self._docs[doc_id].exists():
            return self._docs[doc_id]
        candidate = STORAGE_DIR / f"{doc_id}.pdf"
        if candidate.exists():
            self._docs[doc_id] = candidate
            return candidate
        raise FileNotFoundError(f"Không tìm thấy tài liệu PDF với ID: {doc_id}")

    def extract_page_text(
        self, doc_id: str, page_number: int, force_mode: str = "auto"
    ) -> Dict[str, object]:
        """
        Trích xuất văn bản từ trang PDF (1-indexed), sắp xếp theo thứ tự đọc tự nhiên,
        loại bỏ vùng header/footer sát mép giấy và chạy bộ xử lý Tiếng Việt.
        """
        pdf_path = self._get_pdf_path(doc_id)
        with fitz.open(pdf_path) as doc:
            if page_number < 1 or page_number > len(doc):
                raise ValueError(f"Số trang không hợp lệ: {page_number}")

            page = doc[page_number - 1]
            rect = page.rect
            page_height = rect.height

            # Lấy danh sách các text blocks: (x0, y0, x1, y1, "lines", block_no, block_type)
            blocks = page.get_text("blocks", sort=True)
            valid_blocks = []

            for b in blocks:
                if len(b) >= 7 and b[6] != 0:  # Chỉ lấy text block (block_type == 0)
                    continue
                x0, y0, x1, y1, text_content = b[0], b[1], b[2], b[3], b[4]
                stripped_block = text_content.strip()
                if not stripped_block:
                    continue

                # Bỏ qua số trang hoặc dòng chú thích ngắn nằm sát mép trên (< 6%) hoặc mép dưới (> 93%)
                # hoặc các dòng lặp lại như header ebook / nguồn truyện vnthuquan
                if (y1 < page_height * 0.06 or y0 > page_height * 0.93) and (
                    len(stripped_block) < 80
                    or "vnthuquan" in stripped_block.lower()
                    or "tạo ebook" in stripped_block.lower()
                    or "nguồn truyện" in stripped_block.lower()
                ):
                    continue

                valid_blocks.append(b)

            if not valid_blocks:
                raw_text = ""
            else:
                raw_parts = []
                for i, b in enumerate(valid_blocks):
                    if i > 0:
                        prev_y1 = valid_blocks[i - 1][3]
                        curr_y0 = b[1]
                        gap = curr_y0 - prev_y1
                        # Nếu khoảng cách dòng lớn (> 18pt), xem như đoạn văn mới (\n\n)
                        # Nếu khoảng cách dòng bình thường (<= 18pt), xem như ngắt dòng trong cùng đoạn văn (\n)
                        if gap > 18.0:
                            raw_parts.append("\n\n")
                        else:
                            raw_parts.append("\n")
                    raw_parts.append(b[4].strip())
                raw_text = "".join(raw_parts)

        processed = process_vietnamese_pdf_text(raw_text, force_mode=force_mode)
        processed["doc_id"] = doc_id
        processed["page_number"] = page_number
        processed["raw_text"] = raw_text
        return processed

    def render_page_image(
        self, doc_id: str, page_number: int, dpi: int = 180, enhance_for_ocr: bool = False
    ) -> bytes:
        """Render 1 trang PDF thành ảnh PNG sắc nét (phục vụ hiển thị hoặc quét OCR)."""
        pdf_path = self._get_pdf_path(doc_id)
        with fitz.open(pdf_path) as doc:
            if page_number < 1 or page_number > len(doc):
                raise ValueError(f"Số trang không hợp lệ: {page_number}")

            page = doc[page_number - 1]
            zoom = dpi / 72.0
            mat = fitz.Matrix(zoom, zoom)
            pix = page.get_pixmap(matrix=mat, alpha=False)
            png_bytes = pix.tobytes("png")

        if not enhance_for_ocr:
            return png_bytes

        # Tiền xử lý ảnh giúp OCR Tiếng Việt (dấu sắc, huyền, hỏi, ngã, nặng) rõ nét nhất
        img = Image.open(io.BytesIO(png_bytes)).convert("L")
        img = ImageOps.autocontrast(img)
        img = ImageEnhance.Contrast(img).enhance(1.35)
        img = ImageEnhance.Sharpness(img).enhance(1.5)
        out = io.BytesIO()
        img.save(out, format="PNG")
        return out.getvalue()

    async def ocr_page_with_gemini(
        self, doc_id: str, page_number: int, api_key: str
    ) -> Dict[str, object]:
        """
        Sử dụng Gemini Flash Vision API để đọc trang PDF bị lỗi font nặng / ảnh scan mờ.
        """
        img_bytes = self.render_page_image(doc_id, page_number, dpi=220, enhance_for_ocr=False)
        b64_img = base64.b64encode(img_bytes).decode("utf-8")

        url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={api_key}"
        prompt = (
            "Hãy trích xuất chính xác toàn bộ nội dung văn bản tiếng Việt trong trang tài liệu này. "
            "Yêu cầu:\n"
            "1. Giữ nguyên chính tả tiếng Việt chuẩn Unicode, nối các dòng bị ngắt giữa câu thành đoạn văn hoàn chỉnh.\n"
            "2. Bỏ qua số trang, header/footer lặp lại ở mép trên/dưới.\n"
            "3. Chỉ trả về đúng nội dung văn bản để đọc thành tiếng, không thêm lời bình luận hay giải thích."
        )

        payload = {
            "contents": [
                {
                    "parts": [
                        {"text": prompt},
                        {"inline_data": {"mime_type": "image/png", "data": b64_img}},
                    ]
                }
            ],
            "generationConfig": {"temperature": 0.1},
        }

        async with httpx.AsyncClient(timeout=40.0) as client:
            resp = await client.post(url, json=payload)
            if resp.status_code != 200:
                raise RuntimeError(f"Gemini API trả về lỗi ({resp.status_code}): {resp.text}")
            data = resp.json()

        extracted = ""
        try:
            candidates = data.get("candidates", [])
            if candidates:
                parts = candidates[0].get("content", {}).get("parts", [])
                extracted = "\n".join(p.get("text", "") for p in parts).strip()
        except Exception as exc:
            raise RuntimeError(f"Không thể phân tích phản hồi từ Gemini: {exc}")

        processed = process_vietnamese_pdf_text(extracted, force_mode="unicode")
        processed["doc_id"] = doc_id
        processed["page_number"] = page_number
        processed["encoding_detected"] = "gemini_ocr"
        processed["needs_ocr"] = False
        processed["quality_score"] = 1.0
        processed["reason"] = "Đã quét OCR chuẩn xác bằng Gemini AI Vision."
        return processed


pdf_service = PDFService()
