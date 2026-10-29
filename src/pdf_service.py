import base64
import hashlib
import io
import json
import re
import unicodedata
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

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
        # Bộ nhớ đệm văn bản trang đã xử lý (doc_id, page_no, mode) -> Dict
        self._page_text_cache: Dict[Tuple[str, int, str], Dict[str, Any]] = {}

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

            # Tầng 2: Heuristic regex quét các tiêu đề chương/phần/bài & mục con (1.1, 1.2...)
            chapter_pattern = re.compile(
                r'^\s*(Chương\s+[0-9IVXLCDMivxlcdm]+|Phần\s+[0-9IVXLCDMivxlcdm]+|Bài\s+[0-9IVXLCDMivxlcdm0-9]+|Hồi\s+[0-9IVXLCDMivxlcdm0-9]+|Mục\s+[0-9IVXLCDMivxlcdm0-9]+|Quyển\s+[0-9IVXLCDMivxlcdm0-9]+|Chapter\s+[0-9IVXLCDMivxlcdm]+|Part\s+[0-9IVXLCDMivxlcdm]+|Giới thiệu|Lời nói đầu|Lời mở đầu|Mở đầu|Kết luận|Lời bạt|Tài liệu tham khảo|Phụ lục(?:\s+[0-9IVXLCDMivxlcdm]+)?)(?:\s*[:.\-–—]\s*(.*)|\s+(.*))?$',
                re.IGNORECASE
            )
            sub_section_pattern = re.compile(
                r'^\s*(\d+\.\d+(?:\.\d+)?)\s+([A-ZÀÁẢÃẠĂẮẰẲẴẶÂẤẦẨẪẬĐÈÉẺẼẸÊẾỀỂỄỆÌÍỈĨỊÒÓỎÕỌÔỐỒỔỖỘƠỚỜỞỠỢÙÚỦŨỤƯỨỪỬỮỰỲÝỶỸỴ][^\n]{2,90})$'
            )
            numbered_caps_pattern = re.compile(
                r'^\s*(\d{1,2})\s+([A-ZÀÁẢÃẠĂẮẰẲẴẶÂẤẦẨẪẬĐÈÉẺẼẸÊẾỀỂỄỆÌÍỈĨỊÒÓỎÕỌÔỐỒỔỖỘƠỚỜỞỠỢÙÚỦŨỤƯỨỪỬỮỰỲÝỶỸỴ0-9\s,\-–—:?!”“\'’]{6,90})$'
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
                        continue

                    # Kiểm tra mục con dạng 1.1, 1.2, 1.2.1
                    sm = sub_section_pattern.match(line)
                    if sm:
                        sec_num = sm.group(1)
                        sec_title = sm.group(2).strip(" :.-–—")
                        lvl = min(3, sec_num.count(".") + 1)
                        full_sub = f"{sec_num} {sec_title}"
                        if not any(item["page"] == pno and item["title"].lower() == full_sub.lower() for item in toc):
                            toc.append({
                                "level": lvl,
                                "title": full_sub,
                                "page": pno,
                            })
                        continue

                    # Kiểm tra tiêu đề chương dạng số đứng đầu trang + chữ IN HOA (VD: "9 GIÀU CÓ THỰC SỰ...")
                    if i <= 2:
                        nm = numbered_caps_pattern.match(line)
                        if nm and line == line.upper():
                            full_cap = f"Chương {nm.group(1)}: {nm.group(2).title()}"
                            if not any(item["page"] == pno for item in toc):
                                toc.append({
                                    "level": 1,
                                    "title": full_cap,
                                    "page": pno,
                                })
            if toc:
                return toc

            # Tầng 3: Nếu PDF không có chương mục rõ ràng, trả về danh sách rỗng để Outline báo "Tài liệu không có đề mục chương"
            # trong khi tab Hình thu nhỏ trang (Page Thumbnails) vẫn hiển thị đầy đủ hình ảnh từ trang 1 đến N.
            return []

    def get_pages_overview(self, doc_id: str) -> List[Dict[str, Any]]:
        """
        Lấy danh sách tất cả các trang PDF (từ 1 đến N) kèm trích đoạn và tiêu đề chương (nếu có)
        để người dùng dễ dàng nhìn tổng quan và chuyển trang nhanh chóng như một trình đọc PDF tiêu chuẩn.
        """
        pdf_path = self._get_pdf_path(doc_id)
        toc = self.extract_toc(doc_id)
        chapter_map = {}
        for item in toc:
            p = item.get("page", 1)
            if p not in chapter_map:
                chapter_map[p] = item.get("title", "")

        pages = []
        with fitz.open(pdf_path) as doc:
            for page_idx in range(len(doc)):
                pno = page_idx + 1
                page = doc[page_idx]
                raw = page.get_text("text").strip()
                preview = ""
                if raw:
                    lines = [re.sub(r'[\s\xa0]+', ' ', l).strip() for l in raw.split("\n") if l.strip()]
                    if lines:
                        preview = " ".join(lines[:2])
                        if len(preview) > 90:
                            preview = preview[:87] + "..."
                if not preview:
                    preview = "Trang PDF (Ảnh scan / Không có văn bản thô)"

                ch_title = chapter_map.get(pno, "")
                pages.append({
                    "page": pno,
                    "preview": preview,
                    "chapter": ch_title,
                })
        return pages

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
        cache_key = (doc_id, page_number, force_mode)
        if cache_key in self._page_text_cache:
            return self._page_text_cache[cache_key]

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

                # Bỏ qua số trang hoặc dòng chú thích ngắn nằm sát mép trên (< 4%) hoặc mép dưới (> 96%)
                # hoặc các dòng lặp lại như header ebook / nguồn truyện vnthuquan
                is_page_num_only = bool(re.match(r"^\s*(?:[-–—]?\s*\d{1,4}\s*[-–—]?|(?:trang|page)\s+\d{1,4})\s*$", stripped_block, re.IGNORECASE))
                is_ebook_watermark = any(w in stripped_block.lower() for w in ("vnthuquan", "tạo ebook", "nguồn truyện"))
                if (y1 < page_height * 0.04 or y0 > page_height * 0.96) and (is_page_num_only or is_ebook_watermark):
                    continue
                if is_ebook_watermark and len(stripped_block) < 120:
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
                        # Mỗi text block riêng biệt trong PDF (cách nhau > 4pt) là một đoạn văn độc lập (\n\n)
                        if gap > 4.0:
                            raw_parts.append("\n\n")
                        else:
                            raw_parts.append("\n")
                    raw_parts.append(b[4].strip())
                raw_text = "".join(raw_parts)

        processed = process_vietnamese_pdf_text(raw_text, force_mode=force_mode)
        processed["doc_id"] = doc_id
        processed["page_number"] = page_number
        processed["raw_text"] = raw_text

        # Giới hạn kích thước cache trang (tối đa 500 trang gần nhất)
        if len(self._page_text_cache) > 500:
            self._page_text_cache.clear()
        self._page_text_cache[cache_key] = processed
        return processed

    def search_document(
        self, doc_id: str, query: str, max_results: int = 200
    ) -> Dict[str, Any]:
        """
        Tìm kiếm toàn văn trong tài liệu PDF (hỗ trợ tiếng Việt có dấu, không phân biệt hoa thường,
        và tự động sửa lỗi mã phông chữ TCVN3/VNI).
        Trả về danh sách kết quả kèm số trang, vị trí câu, và trích đoạn văn bản (snippet).
        """
        safe_query = query.strip()
        if len(safe_query) < 2:
            raise ValueError("Từ khóa tìm kiếm phải có độ dài ít nhất 2 ký tự.")

        pdf_path = self._get_pdf_path(doc_id)
        q_norm = unicodedata.normalize("NFC", safe_query)
        pattern = re.compile(re.escape(q_norm), re.IGNORECASE)

        results: List[Dict[str, Any]] = []
        results_by_page: Dict[int, List[Dict[str, Any]]] = {}
        total_matches = 0
        is_truncated = False

        with fitz.open(pdf_path) as doc:
            page_count = len(doc)
            for page_idx in range(page_count):
                page_no = page_idx + 1
                page_data = self.extract_page_text(doc_id, page_no)
                page_text = unicodedata.normalize("NFC", str(page_data.get("text", "")))
                sentences = page_data.get("sentences", [])

                if not page_text:
                    continue

                page_matches: List[Dict[str, Any]] = []

                # 1. Quét theo từng câu để có sentence_index chính xác
                for s_idx, sentence in enumerate(sentences):
                    s_norm = unicodedata.normalize("NFC", str(sentence))
                    for match in pattern.finditer(s_norm):
                        m_start, m_end = match.span()
                        ctx_start = max(0, m_start - 35)
                        ctx_end = min(len(s_norm), m_end + 35)
                        prefix = "..." if ctx_start > 0 else ""
                        suffix = "..." if ctx_end < len(s_norm) else ""
                        snippet = f"{prefix}{s_norm[ctx_start:ctx_end].strip()}{suffix}"

                        match_item = {
                            "page": page_no,
                            "sentence_index": s_idx,
                            "match_text": match.group(0),
                            "snippet": snippet,
                            "start_char": m_start,
                            "end_char": m_end,
                        }
                        results.append(match_item)
                        page_matches.append(match_item)
                        total_matches += 1

                        if total_matches >= max_results:
                            is_truncated = True
                            break
                    if is_truncated:
                        break

                # 2. Dự phòng: Nếu văn bản trang có match nhưng chưa được gom vào sentences
                if not page_matches and pattern.search(page_text):
                    for match in pattern.finditer(page_text):
                        m_start, m_end = match.span()
                        ctx_start = max(0, m_start - 40)
                        ctx_end = min(len(page_text), m_end + 40)
                        prefix = "..." if ctx_start > 0 else ""
                        suffix = "..." if ctx_end < len(page_text) else ""
                        clean_snip = re.sub(r'\s+', ' ', page_text[ctx_start:ctx_end]).strip()
                        snippet = f"{prefix}{clean_snip}{suffix}"

                        match_item = {
                            "page": page_no,
                            "sentence_index": 0,
                            "match_text": match.group(0),
                            "snippet": snippet,
                            "start_char": m_start,
                            "end_char": m_end,
                        }
                        results.append(match_item)
                        page_matches.append(match_item)
                        total_matches += 1

                        if total_matches >= max_results:
                            is_truncated = True
                            break

                if page_matches:
                    results_by_page[page_no] = page_matches

                if is_truncated:
                    break

        return {
            "doc_id": doc_id,
            "query": safe_query,
            "total_matches": total_matches,
            "page_count": page_count,
            "is_truncated": is_truncated,
            "results": results,
            "results_by_page": [
                {
                    "page": p,
                    "count": len(items),
                    "matches": items,
                }
                for p, items in sorted(results_by_page.items())
            ],
        }

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
