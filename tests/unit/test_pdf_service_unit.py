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

    def test_nonexistent_doc_id_raises_file_not_found(self):
        with self.assertRaises(FileNotFoundError):
            pdf_service.extract_page_text("non_existent_hash", 1)


if __name__ == "__main__":
    unittest.main()
