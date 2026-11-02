import shutil
import tempfile
import unittest
from pathlib import Path

from src.db_service import DatabaseService, strip_vn_diacritics_simple


class TestDatabaseService(unittest.TestCase):
    def setUp(self):
        self.temp_dir = Path(tempfile.mkdtemp())
        self.db_path = self.temp_dir / "test_app.db"
        self.db = DatabaseService(db_path=self.db_path)

    def tearDown(self):
        shutil.rmtree(self.temp_dir, ignore_errors=True)

    def test_seed_dictionary_loaded(self):
        count = self.db.get_dictionary_count()
        self.assertGreaterEqual(count, 35)

        sach = self.db.lookup_word("sách")
        self.assertIsNotNone(sach)
        self.assertEqual(sach["word"], "sách")
        self.assertTrue(sach["found"])
        self.assertGreater(len(sach["meanings"]), 0)

    def test_lookup_case_insensitive_and_stripped(self):
        res1 = self.db.lookup_word("  SÁCH  ")
        self.assertIsNotNone(res1)
        self.assertEqual(res1["word"], "sách")

    def test_save_and_retrieve_word(self):
        meanings = [
            {"pos": "Danh từ", "definitions": ["Trí tuệ nhân tạo (Artificial Intelligence)"]}
        ]
        saved = self.db.save_word("ai", meanings, source="Test Source")
        self.assertEqual(saved["word"], "ai")

        looked_up = self.db.lookup_word("AI")
        self.assertIsNotNone(looked_up)
        self.assertEqual(looked_up["source"], "Test Source")
        self.assertEqual(looked_up["meanings"][0]["definitions"][0], "Trí tuệ nhân tạo (Artificial Intelligence)")

    def test_fts5_indexing_and_search(self):
        doc_id = "test_doc_01"
        pages_data = [
            {
                "page": 1,
                "sentences": [
                    "Việt Nam là một quốc gia nằm ở khu vực Đông Nam Á.",
                    "Thủ đô của Việt Nam là Hà Nội, thành phố ngàn năm văn hiến."
                ]
            },
            {
                "page": 2,
                "sentences": [
                    "Sách là nguồn tri thức vô giá của nhân loại.",
                    "Đọc sách mỗi ngày giúp mở mang trí tuệ và bình yên tâm hồn."
                ]
            }
        ]

        inserted = self.db.index_document_pages(doc_id, pages_data)
        self.assertEqual(inserted, 4)
        self.assertTrue(self.db.is_doc_indexed(doc_id))

        # 1. Tìm từ khóa có dấu
        matches = self.db.search_fts(doc_id, "Hà Nội")
        self.assertEqual(len(matches), 1)
        self.assertEqual(matches[0][0], 1)  # page 1
        self.assertIn("Hà Nội", matches[0][2])

        # 2. Tìm từ khóa không dấu (Accent-Insensitive)
        matches_unaccented = self.db.search_fts(doc_id, "ha noi")
        self.assertEqual(len(matches_unaccented), 1)
        self.assertEqual(matches_unaccented[0][0], 1)

        # 3. Tìm trang 2
        matches_sach = self.db.search_fts(doc_id, "tri thức")
        self.assertEqual(len(matches_sach), 1)
        self.assertEqual(matches_sach[0][0], 2)  # page 2

        # 4. Xóa chỉ mục
        self.db.clear_doc_index(doc_id)
        self.assertFalse(self.db.is_doc_indexed(doc_id))
        self.assertEqual(len(self.db.search_fts(doc_id, "Hà Nội")), 0)

    def test_strip_vn_diacritics_simple(self):
        s = "Đất nước Việt Nam mến yêu"
        clean = strip_vn_diacritics_simple(s)
        self.assertIn("Dat", clean)
        self.assertIn("Viet Nam", clean)


if __name__ == "__main__":
    unittest.main()
