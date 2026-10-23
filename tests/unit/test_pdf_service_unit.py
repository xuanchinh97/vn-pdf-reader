"""
Unit tests cho pdf_service.py
Kiểm tra:
- Đăng ký và lưu trữ PDF
- Trích xuất văn bản từng trang với sắp xếp block và lọc lề header/footer
- Render ảnh trang PNG với các mức DPI và bộ lọc tăng cường cho OCR
- Bắt lỗi khi trang hoặc doc_id không tồn tại
"""

import io
from pathlib import Path
import unittest
from PIL import Image

from src.pdf_service import pdf_service, PDFService
from tests.fixtures.generate_synthetic_pdfs import FIXTURES_DIR, generate_all_fixtures


class TestPDFService(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        # Đảm bảo fixtures có sẵn
        generate_all_fixtures()
        cls.standard_pdf_bytes = (FIXTURES_DIR / "standard_unicode.pdf").read_bytes()
        cls.scanned_pdf_bytes = (FIXTURES_DIR / "scanned_image.pdf").read_bytes()
        cls.tcvn3_pdf_bytes = (FIXTURES_DIR / "tcvn3_document.pdf").read_bytes()

    def test_register_pdf(self):
        info = pdf_service.register_pdf("test_standard.pdf", self.standard_pdf_bytes)
        self.assertIn("doc_id", info)
        self.assertEqual(info["filename"], "test_standard.pdf")
        self.assertEqual(info["page_count"], 3)
        self.assertTrue(len(info["doc_id"]) > 0)

    def test_extract_page_text_filters_margins_and_preserves_content(self):
        info = pdf_service.register_pdf("test_standard.pdf", self.standard_pdf_bytes)
        doc_id = info["doc_id"]

        page1 = pdf_service.extract_page_text(doc_id, 1)
        self.assertEqual(page1["page_number"], 1)
        self.assertFalse(page1["needs_ocr"])
        self.assertGreaterEqual(page1["quality_score"], 0.9)

        # Kiểm tra nội dung chính được giữ nguyên
        self.assertIn("Tp. Hồ Chí Minh", page1["text"])
        self.assertIn("GS. TS. Nguyễn Văn A", page1["text"])
        self.assertIn("BS. Trần Thị B", page1["text"])

        # Kiểm tra footer số trang sát mép dưới đã được lọc bỏ
        self.assertNotIn("Trang 1 / 3", page1["text"])

        # Danh sách câu tách hợp lý
        self.assertGreater(len(page1["sentences"]), 0)

    def test_extract_page_tcvn3_auto_repaired(self):
        info = pdf_service.register_pdf("test_tcvn3.pdf", self.tcvn3_pdf_bytes)
        doc_id = info["doc_id"]

        page1 = pdf_service.extract_page_text(doc_id, 1, force_mode="auto")
        self.assertEqual(page1["encoding_detected"], "tcvn3")
        self.assertIn("Cộng hoà xã hội chủ nghĩa Việt Nam", page1["text"])
        self.assertIn("quy định của pháp luật", page1["text"])

    def test_extract_scanned_pdf_flags_needs_ocr(self):
        info = pdf_service.register_pdf("test_scan.pdf", self.scanned_pdf_bytes)
        doc_id = info["doc_id"]

        page1 = pdf_service.extract_page_text(doc_id, 1)
        # Trang scan không có text layer nên phải cắm cờ needs_ocr = True
        self.assertTrue(page1["needs_ocr"])
        self.assertEqual(page1["quality_score"], 0.0)

    def test_render_page_image_standard(self):
        info = pdf_service.register_pdf("test_standard.pdf", self.standard_pdf_bytes)
        doc_id = info["doc_id"]

        png_bytes = pdf_service.render_page_image(doc_id, 1, dpi=100, enhance_for_ocr=False)
        self.assertTrue(png_bytes.startswith(b"\x89PNG\r\n\x1a\n"))

        # Xác thực ảnh mở được bằng PIL
        img = Image.open(io.BytesIO(png_bytes))
        self.assertEqual(img.format, "PNG")
        self.assertGreater(img.width, 300)
        self.assertGreater(img.height, 400)

    def test_render_page_image_enhanced_for_ocr(self):
        info = pdf_service.register_pdf("test_standard.pdf", self.standard_pdf_bytes)
        doc_id = info["doc_id"]

        enhanced_png = pdf_service.render_page_image(doc_id, 1, dpi=150, enhance_for_ocr=True)
        img = Image.open(io.BytesIO(enhanced_png))
        # Ảnh tăng cường phải chuyển sang Grayscale "L"
        self.assertEqual(img.mode, "L")

    def test_invalid_page_number_raises_value_error(self):
        info = pdf_service.register_pdf("test_standard.pdf", self.standard_pdf_bytes)
        doc_id = info["doc_id"]

        with self.assertRaises(ValueError):
            pdf_service.extract_page_text(doc_id, 0)

        with self.assertRaises(ValueError):
            pdf_service.extract_page_text(doc_id, 999)

    def test_extract_toc_tier2_heuristic(self):
        # standard_unicode.pdf không có TOC metadata, tầng 2 heuristic regex sẽ phát hiện các tiêu đề CHƯƠNG 1, 2, 3
        info = pdf_service.register_pdf("test_standard.pdf", self.standard_pdf_bytes)
        doc_id = info["doc_id"]

        toc = pdf_service.extract_toc(doc_id)
        self.assertIsInstance(toc, list)
        self.assertGreaterEqual(len(toc), 1)
        # Các mục trong TOC phải có level, title, page
        first = toc[0]
        self.assertIn("level", first)
        self.assertIn("title", first)
        self.assertIn("page", first)
        self.assertIn("CHƯƠNG 1", first["title"].upper())

    def test_extract_toc_tier1_metadata(self):
        # Tạo PDF có sẵn outline metadata
        import pymupdf as fitz
        doc = fitz.open()
        p1 = doc.new_page()
        p1.insert_text((50, 100), "Trang 1")
        p2 = doc.new_page()
        p2.insert_text((50, 100), "Trang 2")
        doc.set_toc([
            [1, "Mục lục gốc 1", 1],
            [1, "Mục lục gốc 2", 2],
        ])
        pdf_bytes = doc.tobytes()
        doc.close()

        info = pdf_service.register_pdf("test_toc_tier1.pdf", pdf_bytes)
        doc_id = info["doc_id"]
        self.assertIn("toc", info)
        self.assertEqual(len(info["toc"]), 2)
        self.assertEqual(info["toc"][0]["title"], "Mục lục gốc 1")
        self.assertEqual(info["toc"][0]["page"], 1)
        self.assertEqual(info["toc"][1]["title"], "Mục lục gốc 2")
        self.assertEqual(info["toc"][1]["page"], 2)

    def test_annotations_crud(self):
        info = pdf_service.register_pdf("test_standard.pdf", self.standard_pdf_bytes)
        doc_id = info["doc_id"]

        # 1. Ban đầu rỗng
        initial = pdf_service.get_annotations(doc_id)
        self.assertEqual(initial, {"bookmarks": [], "highlights": []})

        # 2. Lưu bookmark và highlight
        test_data = {
            "bookmarks": [{"id": "bm1", "page": 2, "title": "Trang 2", "created_at": 1729650000}],
            "highlights": [{"id": "hl1", "page": 1, "text": "Hệ thống chuyển đổi", "color": "yellow"}],
        }
        saved = pdf_service.save_annotations(doc_id, test_data)
        self.assertEqual(len(saved["bookmarks"]), 1)
        self.assertEqual(len(saved["highlights"]), 1)

        # 3. Đọc lại
        retrieved = pdf_service.get_annotations(doc_id)
        self.assertEqual(retrieved["bookmarks"][0]["id"], "bm1")
        self.assertEqual(retrieved["highlights"][0]["color"], "yellow")

    def test_nonexistent_doc_id_raises_file_not_found(self):
        with self.assertRaises(FileNotFoundError):
            pdf_service.extract_page_text("non_existent_hash", 1)

    def test_extract_toc_multi_line_and_printed_dot_leaders(self):
        import pymupdf as fitz
        fontfile = "C:/Windows/Fonts/arial.ttf" if Path("C:/Windows/Fonts/arial.ttf").exists() else None
        fontname = "arial" if fontfile else None
        doc = fitz.open()
        p1 = doc.new_page()
        # Mô phỏng trang mục lục in có số trang ở cuối
        p1.insert_textbox(
            fitz.Rect(50, 50, 500, 200),
            "Chương 1: Bình minh ............ 2\nChương 2: Hoàng hôn ............ 3",
            fontfile=fontfile,
            fontname=fontname,
        )
        p2 = doc.new_page()
        # Mô phỏng tiêu đề 2 dòng: dòng 1 là Chương 1, dòng 2 là tiêu đề
        p2.insert_textbox(
            fitz.Rect(50, 50, 500, 200),
            "Chương 1\nTiếng gọi nơi hoang dã\nNội dung chương một...",
            fontfile=fontfile,
            fontname=fontname,
        )
        p3 = doc.new_page()
        p3.insert_textbox(
            fitz.Rect(50, 50, 500, 200),
            "Chương 2: Khởi đầu mới\nNội dung chương hai...",
            fontfile=fontfile,
            fontname=fontname,
        )
        pdf_bytes = doc.tobytes()
        doc.close()

        info = pdf_service.register_pdf("test_toc_advanced.pdf", pdf_bytes)
        doc_id = info["doc_id"]
        toc = pdf_service.extract_toc(doc_id)
        self.assertIsInstance(toc, list)
        self.assertGreaterEqual(len(toc), 2)
        # Kiểm tra mục lục in bóc tách chính xác số trang đích
        first_item = toc[0]
        self.assertIn("Chương 1: Bình minh", first_item["title"])
        self.assertEqual(first_item["page"], 2)

    def test_annotations_null_safety(self):
        info = pdf_service.register_pdf("test_standard.pdf", self.standard_pdf_bytes)
        doc_id = info["doc_id"]
        # Lưu payload chứa None
        saved = pdf_service.save_annotations(doc_id, {"bookmarks": None, "highlights": None})
        self.assertEqual(saved["bookmarks"], [])
        self.assertEqual(saved["highlights"], [])
        retrieved = pdf_service.get_annotations(doc_id)
        self.assertEqual(retrieved["bookmarks"], [])
        self.assertEqual(retrieved["highlights"], [])

    def test_path_traversal_sanitization(self):
        # Kiểm tra doc_id có chứa ký tự path traversal không làm hỏng hoặc lộ thư mục
        res = pdf_service.get_annotations("../../etc/passwd")
        self.assertEqual(res, {"bookmarks": [], "highlights": []})


if __name__ == "__main__":
    unittest.main()
