import base64
import hashlib
import io
import json
import re
from pathlib import Path
from typing import Any, Dict, List, Optional

import pymupdf as fitz  # PyMuPDF 2.0+
import httpx
from PIL import Image, ImageEnhance, ImageOps

from src.vn_text_processor import (
    process_vietnamese_pdf_text,
    convert_tcvn3_to_unicode,
    is_likely_tcvn3,
    convert_vni_to_unicode,
    is_likely_vni,
    fix_detached_diacritics,
)

STORAGE_DIR = Path.home() / ".vn_pdf_reader" / "docs"
STORAGE_DIR.mkdir(parents=True, exist_ok=True)

ANNOTATIONS_DIR = Path.home() / ".vn_pdf_reader" / "annotations"
ANNOTATIONS_DIR.mkdir(parents=True, exist_ok=True)


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

        toc = self.extract_toc(doc_hash)

        return {
            "doc_id": doc_hash,
            "filename": filename,
            "title": title,
            "page_count": page_count,
            "toc": toc,
        }

    def _get_pdf_path(self, doc_id: str) -> Path:
        safe_id = re.sub(r'[^a-zA-Z0-9_\-]', '', doc_id)
        if safe_id in self._docs and self._docs[safe_id].exists():
            return self._docs[safe_id]
        candidate = STORAGE_DIR / f"{safe_id}.pdf"
        if candidate.exists():
            self._docs[safe_id] = candidate
            return candidate
        raise FileNotFoundError(f"Không tìm thấy tài liệu PDF với ID: {doc_id}")

    def extract_toc(self, doc_id: str) -> List[Dict[str, Any]]:
        """
        Trích xuất mục lục tài liệu theo 2 tầng:
        - Tầng 1: Lấy mục lục có sẵn của PDF (doc.get_toc(simple=True)).
        - Tầng 2: Nếu rỗng, heuristic regex quét tiêu đề chương/phần/bài gắn với số trang,
                  hỗ trợ tài liệu mã TCVN3/VNI, mục lục in (dot leaders) và tiêu đề 2 dòng.
        """
        pdf_path = self._get_pdf_path(doc_id)
        with fitz.open(pdf_path) as doc:
            # Tầng 1: doc.get_toc(simple=True)
            raw_toc = doc.get_toc(simple=True)
            if raw_toc:
                toc = []
                for item in raw_toc:
                    if len(item) >= 3:
                        lvl, title, pno = item[0], item[1], item[2]
                        clean_title = re.sub(r'\s+', ' ', str(title)).strip()
                        if clean_title:
                            try:
                                page_int = int(pno)
                            except (ValueError, TypeError):
                                page_int = 1
                            try:
                                lvl_int = int(lvl)
                            except (ValueError, TypeError):
                                lvl_int = 1
                            toc.append({
                                "level": lvl_int,
                                "title": clean_title,
                                "page": max(1, min(page_int, len(doc))),
                            })
                if toc:
                    return toc

            # Tầng 2: Heuristic regex quét các tiêu đề chương/phần/bài
            chapter_pattern = re.compile(
                r'^\s*(Chương\s+[0-9IVXLCDMivxlcdm]+|Phần\s+[0-9IVXLCDMivxlcdm]+|Bài\s+[0-9IVXLCDMivxlcdm0-9]+|Hồi\s+[0-9IVXLCDMivxlcdm0-9]+|Mục\s+[0-9IVXLCDMivxlcdm0-9]+|Quyển\s+[0-9IVXLCDMivxlcdm0-9]+|Chapter\s+[0-9IVXLCDMivxlcdm]+|Part\s+[0-9IVXLCDMivxlcdm]+|Lời nói đầu|Lời mở đầu|Mở đầu|Kết luận|Lời bạt|Phụ lục(?:\s+[0-9IVXLCDMivxlcdm]+)?)(?:\s*[:.\-–—]\s*(.*)|\s+(.*))?$',
                re.IGNORECASE
            )
            toc = []
            for page_idx in range(len(doc)):
                pno = page_idx + 1
                page = doc[page_idx]
                raw_text = page.get_text("text")
                if not raw_text:
                    continue

                # Tách từng dòng văn bản gốc trước để giữ nguyên ranh giới dòng của tiêu đề chương
                raw_lines = [re.sub(r'[\s\xa0]+', ' ', line).strip() for line in raw_text.split("\n") if line.strip()]
                lines = []
                for l in raw_lines:
                    if is_likely_tcvn3(l):
                        l = convert_tcvn3_to_unicode(l)
                    elif is_likely_vni(l):
                        l = convert_vni_to_unicode(l)
                    l = fix_detached_diacritics(l)
                    lines.append(l)
                for i, line in enumerate(lines):
                    if len(line) > 120:
                        continue
                    m = chapter_pattern.match(line)
                    if m:
                        clean_line = line.strip(" :.-–—")
                        # Kiểm tra xem có phải dòng mục lục in có số trang ở cuối (... 15)
                        p_match = re.search(r'[\.\-–—\s]{2,}\s*(\d+)\s*$', clean_line)
                        target_pno = pno
                        if p_match:
                            try:
                                matched_p = int(p_match.group(1))
                                if 1 <= matched_p <= len(doc):
                                    target_pno = matched_p
                                    clean_line = clean_line[:p_match.start()].strip(" :.-–—")
                            except Exception:
                                pass

                        # Nếu dòng chỉ có "Chương 1" mà chưa có tên chương, và dòng sau là tiêu đề ngắn
                        if not m.group(2) and not m.group(3) and not p_match and i + 1 < len(lines):
                            next_line = lines[i + 1]
                            if (
                                0 < len(next_line) <= 80
                                and not chapter_pattern.match(next_line)
                                and not next_line.endswith((".", ",", ";"))
                            ):
                                clean_line = f"{clean_line}: {next_line}"

                        if not any(item["page"] == target_pno and item["title"].lower() == clean_line.lower() for item in toc):
                            toc.append({
                                "level": 1,
                                "title": clean_line,
                                "page": target_pno,
                            })
            return toc

    def get_annotations(self, doc_id: str) -> Dict[str, Any]:
        """Lấy danh sách bookmarks và highlights đã lưu của tài liệu."""
        safe_id = re.sub(r'[^a-zA-Z0-9_\-]', '', doc_id)
        ann_file = ANNOTATIONS_DIR / f"{safe_id}.json"
        if ann_file.exists():
            try:
                data = json.loads(ann_file.read_text(encoding="utf-8"))
                return {
                    "bookmarks": data.get("bookmarks") or [],
                    "highlights": data.get("highlights") or [],
                }
            except Exception:
                pass
        return {"bookmarks": [], "highlights": []}

    def save_annotations(self, doc_id: str, data: Dict[str, Any]) -> Dict[str, Any]:
        """Lưu danh sách bookmarks và highlights của tài liệu vào file JSON."""
        safe_id = re.sub(r'[^a-zA-Z0-9_\-]', '', doc_id)
        ann_file = ANNOTATIONS_DIR / f"{safe_id}.json"
        clean_data = {
            "bookmarks": data.get("bookmarks") or [],
            "highlights": data.get("highlights") or [],
        }
        ann_file.write_text(json.dumps(clean_data, indent=2, ensure_ascii=False), encoding="utf-8")
        return clean_data

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
