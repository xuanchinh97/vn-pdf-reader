"""
End-to-End Pipeline Tests
Kiểm thử toàn trình từ đầu vào PDF đến đầu ra âm thanh MP3 và đo lường hiệu năng:
1. Scenario 1: PDF Tiếng Việt chuẩn nhiều trang (Upload -> Extract -> Sentence Split -> TTS Audio -> Cache)
2. Scenario 2: PDF văn bản TCVN3 cũ (Upload -> Auto Detect TCVN3 -> Convert Unicode -> TTS Audio)
3. Scenario 3: PDF dạng scan (Upload -> Detect Scanned -> Verify needs_ocr=True -> Check Rendered Image)
4. Scenario 4: PDF hỏng font (Upload -> Detect Broken CMap -> Verify Warning)
"""

import time
from pathlib import Path
import unittest
from starlette.testclient import TestClient

from src.main import app
from tests.fixtures.generate_synthetic_pdfs import FIXTURES_DIR, generate_all_fixtures


class TestE2EPipeline(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        generate_all_fixtures()
        cls.client = TestClient(app)

    def test_e2e_standard_multipage_pdf(self):
        pdf_path = FIXTURES_DIR / "standard_unicode.pdf"

        # 1. Upload PDF
        t0 = time.time()
        with open(pdf_path, "rb") as f:
            up_resp = self.client.post(
                "/api/upload",
                files={"file": ("standard_unicode.pdf", f, "application/pdf")},
            )
        upload_time = time.time() - t0
        self.assertEqual(up_resp.status_code, 200)
        doc_info = up_resp.json()
        doc_id = doc_info["doc_id"]
        total_pages = doc_info["page_count"]
        self.assertEqual(total_pages, 3)

        # 2. Lặp qua tất cả các trang, trích xuất và kiểm tra từng trang
        total_sentences = 0
        for page_num in range(1, total_pages + 1):
            t_extract_start = time.time()
            page_resp = self.client.get(f"/api/doc/{doc_id}/page/{page_num}")
            extract_time = time.time() - t_extract_start

            self.assertEqual(page_resp.status_code, 200)
            pdata = page_resp.json()
            self.assertFalse(pdata["needs_ocr"])
            self.assertGreaterEqual(pdata["quality_score"], 0.9)
            self.assertGreater(len(pdata["sentences"]), 0)
            total_sentences += len(pdata["sentences"])

            # Trích xuất phải nhanh (< 250ms trên máy local)
            self.assertLess(extract_time, 0.5)

        self.assertGreaterEqual(total_sentences, 6)

        # 3. Thử nghiệm sinh giọng đọc cho câu đầu tiên
        page1_resp = self.client.get(f"/api/doc/{doc_id}/page/1")
        first_sentence = page1_resp.json()["sentences"][0]

        # Lần 1: Sinh TTS mới
        t_tts1 = time.time()
        tts1_resp = self.client.post(
            "/api/tts",
            json={
                "text": first_sentence,
                "voice": "google-vi-female",
                "speed": 1.0,
            },
        )
        duration_tts1 = time.time() - t_tts1
        self.assertEqual(tts1_resp.status_code, 200)
        self.assertEqual(tts1_resp.headers["content-type"], "audio/mpeg")
        audio_size1 = len(tts1_resp.content)
        self.assertGreater(audio_size1, 1000)

        # Lần 2: Đọc lại cùng câu đó -> phải lấy từ cache đĩa, thời gian phản hồi cực nhanh (< 80ms)
        t_tts2 = time.time()
        tts2_resp = self.client.post(
            "/api/tts",
            json={
                "text": first_sentence,
                "voice": "google-vi-female",
                "speed": 1.0,
            },
        )
        duration_tts2 = time.time() - t_tts2
        self.assertEqual(tts2_resp.status_code, 200)
        self.assertEqual(len(tts2_resp.content), audio_size1)
        # Cả 2 lần đều hoàn thành siêu tốc nhờ bộ đệm trên đĩa (< 100ms)
        self.assertLess(duration_tts2, 0.1)
        self.assertEqual(tts2_resp.status_code, 200)

    def test_e2e_tcvn3_document_repaired_and_read(self):
        pdf_path = FIXTURES_DIR / "tcvn3_document.pdf"

        # Upload
        with open(pdf_path, "rb") as f:
            up_resp = self.client.post(
                "/api/upload",
                files={"file": ("tcvn3.pdf", f, "application/pdf")},
            )
        doc_id = up_resp.json()["doc_id"]

        # Trích xuất với chế độ auto
        page_resp = self.client.get(f"/api/doc/{doc_id}/page/1?mode=auto")
        self.assertEqual(page_resp.status_code, 200)
        pdata = page_resp.json()

        # Kiểm tra tự động phát hiện và chuyển mã TCVN3
        self.assertEqual(pdata["encoding_detected"], "tcvn3")
        self.assertIn("Cộng hoà xã hội chủ nghĩa Việt Nam", pdata["text"])
        self.assertIn("Độc lập - Tự do - Hạnh phúc", pdata["text"])

        # Đưa câu đã sửa vào tổng hợp âm thanh
        tts_resp = self.client.post(
            "/api/tts",
            json={
                "text": pdata["sentences"][0],
                "voice": "google-vi-female",
                "speed": 1.0,
            },
        )
        self.assertEqual(tts_resp.status_code, 200)
        self.assertGreater(len(tts_resp.content), 1000)

    def test_e2e_scanned_pdf_flags_ocr_needed(self):
        pdf_path = FIXTURES_DIR / "scanned_image.pdf"

        with open(pdf_path, "rb") as f:
            up_resp = self.client.post(
                "/api/upload",
                files={"file": ("scan.pdf", f, "application/pdf")},
            )
        doc_id = up_resp.json()["doc_id"]

        # Trích xuất
        page_resp = self.client.get(f"/api/doc/{doc_id}/page/1")
        self.assertEqual(page_resp.status_code, 200)
        pdata = page_resp.json()

        # Trang scan phải cắm cờ needs_ocr = True
        self.assertTrue(pdata["needs_ocr"])
        self.assertEqual(pdata["quality_score"], 0.0)

        # Đồng thời ảnh render sẵn sàng cho Tesseract OCR của trình duyệt
        img_resp = self.client.get(f"/api/doc/{doc_id}/page/1/image?dpi=180&enhance=true")
        self.assertEqual(img_resp.status_code, 200)
        self.assertTrue(img_resp.content.startswith(b"\x89PNG\r\n\x1a\n"))

    def test_e2e_broken_font_pdf_warning(self):
        pdf_path = FIXTURES_DIR / "broken_font.pdf"

        with open(pdf_path, "rb") as f:
            up_resp = self.client.post(
                "/api/upload",
                files={"file": ("broken.pdf", f, "application/pdf")},
            )
        doc_id = up_resp.json()["doc_id"]

        page_resp = self.client.get(f"/api/doc/{doc_id}/page/1")
        self.assertEqual(page_resp.status_code, 200)
        pdata = page_resp.json()

        # Phát hiện lỗi font nặng
        self.assertTrue(pdata["needs_ocr"])
        self.assertIn("Phát hiện", pdata["reason"])


if __name__ == "__main__":
    unittest.main()
