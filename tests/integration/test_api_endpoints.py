"""
Integration tests cho các REST API Endpoints của FastAPI (src/main.py)
Sử dụng starlette.testclient.TestClient
"""

import io
from pathlib import Path
import unittest
from starlette.testclient import TestClient

from src.main import app
from tests.fixtures.generate_synthetic_pdfs import FIXTURES_DIR, generate_all_fixtures


class TestAPIEndpoints(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        generate_all_fixtures()
        cls.client = TestClient(app)
        cls.standard_pdf_path = FIXTURES_DIR / "standard_unicode.pdf"
        cls.tcvn3_pdf_path = FIXTURES_DIR / "tcvn3_document.pdf"
        cls.scanned_pdf_path = FIXTURES_DIR / "scanned_image.pdf"

    def test_get_voices(self):
        resp = self.client.get("/api/voices")
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertIn("voices", data)
        self.assertGreater(len(data["voices"]), 0)

    def test_upload_valid_pdf(self):
        with open(self.standard_pdf_path, "rb") as f:
            resp = self.client.post(
                "/api/upload",
                files={"file": ("standard_unicode.pdf", f, "application/pdf")},
            )
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertIn("doc_id", data)
        self.assertEqual(data["filename"], "standard_unicode.pdf")
        self.assertEqual(data["page_count"], 3)

    def test_upload_invalid_file_extension(self):
        fake_content = b"This is a text file, not PDF."
        resp = self.client.post(
            "/api/upload",
            files={"file": ("test.txt", fake_content, "text/plain")},
        )
        self.assertEqual(resp.status_code, 400)
        self.assertIn("Vui lòng chọn file có định dạng .pdf", resp.json()["detail"])

    def test_upload_empty_pdf(self):
        resp = self.client.post(
            "/api/upload",
            files={"file": ("empty.pdf", b"", "application/pdf")},
        )
        self.assertEqual(resp.status_code, 400)

    def test_get_page_text(self):
        # 1. Upload
        with open(self.standard_pdf_path, "rb") as f:
            up_resp = self.client.post(
                "/api/upload",
                files={"file": ("standard_unicode.pdf", f, "application/pdf")},
            )
        doc_id = up_resp.json()["doc_id"]

        # 2. Lấy trang 1
        resp = self.client.get(f"/api/doc/{doc_id}/page/1")
        self.assertEqual(resp.status_code, 200)
        page_data = resp.json()
        self.assertEqual(page_data["page_number"], 1)
        self.assertFalse(page_data["needs_ocr"])
        self.assertIn("Tp. Hồ Chí Minh", page_data["text"])
        self.assertGreater(len(page_data["sentences"]), 0)

    def test_get_page_text_invalid_page(self):
        with open(self.standard_pdf_path, "rb") as f:
            up_resp = self.client.post(
                "/api/upload",
                files={"file": ("standard.pdf", f, "application/pdf")},
            )
        doc_id = up_resp.json()["doc_id"]

        # Trang 0
        resp = self.client.get(f"/api/doc/{doc_id}/page/0")
        self.assertEqual(resp.status_code, 400)

        # Trang vượt quá số trang (3)
        resp = self.client.get(f"/api/doc/{doc_id}/page/99")
        self.assertEqual(resp.status_code, 400)

    def test_get_page_image(self):
        with open(self.standard_pdf_path, "rb") as f:
            up_resp = self.client.post(
                "/api/upload",
                files={"file": ("standard.pdf", f, "application/pdf")},
            )
        doc_id = up_resp.json()["doc_id"]

        resp = self.client.get(f"/api/doc/{doc_id}/page/1/image?dpi=120")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.headers["content-type"], "image/png")
        self.assertTrue(resp.content.startswith(b"\x89PNG\r\n\x1a\n"))

    def test_clean_text_endpoint(self):
        payload = {
            "text": "Ngµy 22 th¸ng 10 n¨m 2026, t¹i Hµ Néi.\nBan chØ ®¹o th«ng b¸o míi.",
            "force_mode": "tcvn3",
        }
        resp = self.client.post("/api/clean-text", json=payload)
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertIn("Ngày 22 tháng 10 năm 2026, tại Hà Nội.", data["text"])
        self.assertIn("Ban chỉ đạo thông báo mới.", data["text"])
        self.assertEqual(len(data["sentences"]), 2)

    def test_tts_endpoint(self):
        payload = {
            "text": "Xin chào, đây là câu thử nghiệm API giọng đọc.",
            "voice": "google-vi-female",
            "speed": 1.0,
        }
        resp = self.client.post("/api/tts", json=payload)
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.headers["content-type"], "audio/mpeg")
        self.assertGreater(len(resp.content), 1000)

    def test_tts_endpoint_empty_text(self):
        payload = {
            "text": "   ",
            "voice": "google-vi-female",
        }
        resp = self.client.post("/api/tts", json=payload)
        self.assertEqual(resp.status_code, 400)

    def test_get_doc_toc_endpoint(self):
        with open(self.standard_pdf_path, "rb") as f:
            up_resp = self.client.post(
                "/api/upload",
                files={"file": ("standard_unicode.pdf", f, "application/pdf")},
            )
        doc_id = up_resp.json()["doc_id"]
        # Upload response phải có sẵn toc
        self.assertIn("toc", up_resp.json())

        # Gọi endpoint GET /api/doc/{doc_id}/toc
        resp = self.client.get(f"/api/doc/{doc_id}/toc")
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data["doc_id"], doc_id)
        self.assertIsInstance(data["toc"], list)
        self.assertGreater(len(data["toc"]), 0)

    def test_get_doc_toc_nonexistent(self):
        resp = self.client.get("/api/doc/nonexistent_id/toc")
        self.assertEqual(resp.status_code, 404)

    def test_annotations_endpoints(self):
        with open(self.standard_pdf_path, "rb") as f:
            up_resp = self.client.post(
                "/api/upload",
                files={"file": ("standard_unicode.pdf", f, "application/pdf")},
            )
        doc_id = up_resp.json()["doc_id"]

        # 1. GET ban đầu
        get_resp = self.client.get(f"/api/doc/{doc_id}/annotations")
        self.assertEqual(get_resp.status_code, 200)
        data = get_resp.json()
        self.assertIn("bookmarks", data)
        self.assertIn("highlights", data)

        # 2. POST lưu mới
        payload = {
            "bookmarks": [{"id": "b1", "page": 1, "title": "Dấu trang 1"}],
            "highlights": [{"id": "h1", "page": 1, "text": "Đoạn hay", "color": "yellow"}],
        }
        post_resp = self.client.post(f"/api/doc/{doc_id}/annotations", json=payload)
        self.assertEqual(post_resp.status_code, 200)
        self.assertEqual(post_resp.json()["status"], "ok")

        # 3. GET kiểm tra lại
        get_resp2 = self.client.get(f"/api/doc/{doc_id}/annotations")
        self.assertEqual(len(get_resp2.json()["bookmarks"]), 1)
        self.assertEqual(len(get_resp2.json()["highlights"]), 1)
        self.assertEqual(get_resp2.json()["bookmarks"][0]["title"], "Dấu trang 1")

    def test_dictionary_lookup_offline_success(self):
        resp = self.client.get("/api/dictionary/lookup?word=s%C3%A1ch")
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data["word"], "sách")
        self.assertTrue(data["found"])
        self.assertGreater(len(data["meanings"]), 0)
        self.assertEqual(data["meanings"][0]["pos"], "Danh từ")

    def test_dictionary_lookup_missing_param(self):
        resp = self.client.get("/api/dictionary/lookup?word=")
        self.assertEqual(resp.status_code, 400)

    def test_dictionary_lookup_unknown_word(self):
        resp = self.client.get("/api/dictionary/lookup?word=tutuongkhongtontai12345")
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertFalse(data["found"])
        self.assertIn("meanings", data)


if __name__ == "__main__":
    unittest.main()
