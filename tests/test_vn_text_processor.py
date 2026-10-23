import unittest
from src.vn_text_processor import (
    clean_and_unwrap_lines,
    convert_tcvn3_to_unicode,
    convert_vni_to_unicode,
    fix_detached_diacritics,
    process_vietnamese_pdf_text,
)


class TestVietnameseTextProcessor(unittest.TestCase):
    def test_tcvn3_conversion(self):
        # "Céng hoµ x· héi chñ nghÜa ViÖt Nam" in TCVN3
        raw_tcvn3 = "Céng hoµ x· héi chñ nghÜa ViÖt Nam - §éc lËp Tù do H¹nh phóc"
        res = process_vietnamese_pdf_text(raw_tcvn3, force_mode="auto")
        self.assertEqual(res["encoding_detected"], "tcvn3")
        self.assertIn("Cộng hoà xã hội chủ nghĩa Việt Nam", res["text"])
        self.assertIn("ộc lập Tự do Hạnh phúc", res["text"])

    def test_vni_conversion(self):
        raw_vni = "Co65ng hoa2 xa4 ho65i chu3 nghi4a Vie65t Nam d9o65c la65p tu75 do"
        res = process_vietnamese_pdf_text(raw_vni, force_mode="auto")
        self.assertEqual(res["encoding_detected"], "vni")
        self.assertEqual(
            res["text"],
            "Cộng hoà xã hội chủ nghĩa Việt Nam độc lập tự do",
        )

    def test_detached_diacritics_and_line_unwrapping(self):
        raw_pdf = (
            "Trang 12\n"
            "Công cụ này giúp xử lý các tài liệu tiếng Viê\u0323t bị lỗi\n"
            "ngắt dòng giữa chừng và dấu rời rạc trong file PDF.\n"
            "Nhờ đó giọng đọc AI phát âm trôi chảy hơn.\n"
            "- 12 -"
        )
        res = process_vietnamese_pdf_text(raw_pdf)
        self.assertFalse(res["needs_ocr"])
        self.assertEqual(len(res["sentences"]), 2)
        self.assertIn(
            "Công cụ này giúp xử lý các tài liệu tiếng Việt bị lỗi ngắt dòng giữa chừng và dấu rời rạc trong file PDF.",
            res["sentences"][0],
        )


if __name__ == "__main__":
    unittest.main()
