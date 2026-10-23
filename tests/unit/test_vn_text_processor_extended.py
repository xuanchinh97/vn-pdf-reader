"""
Unit tests chi tiết cho vn_text_processor.py
Kiểm tra từng khía cạnh: TCVN3, VNI, Mojibake, Dấu thanh tách rời, Nối dòng, Tách câu, Đánh giá chất lượng
"""

import unittest
from src.vn_text_processor import (
    clean_and_unwrap_lines,
    convert_tcvn3_to_unicode,
    convert_vni_to_unicode,
    evaluate_text_quality,
    fix_detached_diacritics,
    fix_mojibake,
    is_likely_tcvn3,
    is_likely_vni,
    process_vietnamese_pdf_text,
    split_into_sentences,
)


class TestTCVN3Conversion(unittest.TestCase):
    def test_full_tcvn3_vowel_matrix(self):
        # Kiểm tra các nguyên âm có dấu đặc trưng TCVN3
        sample_tcvn3 = "Céng hoµ x· héi chñ nghÜa ViÖt Nam - §éc lËp Tù do H¹nh phóc"
        converted = convert_tcvn3_to_unicode(sample_tcvn3)
        self.assertIn("Cộng hoà xã hội chủ nghĩa Việt Nam", converted)
        self.assertIn("ộc lập Tự do Hạnh phúc", converted)

    def test_tcvn3_detection_positive(self):
        sample = "Th«ng b¸o míi cña Ban ChØ ®¹o"
        self.assertTrue(is_likely_tcvn3(sample))

    def test_tcvn3_detection_negative_on_unicode(self):
        sample = "Thông báo mới của Ban Chỉ đạo phòng chống lụt bão"
        self.assertFalse(is_likely_tcvn3(sample))

    def test_tcvn3_preserves_numbers_and_punctuation(self):
        sample = "Ngµy 22/10/2026, t¹i Hµ Néi: tæng sè 100 ng\xadêi!"
        converted = convert_tcvn3_to_unicode(sample)
        self.assertIn("22/10/2026", converted)
        self.assertIn("Hà Nội:", converted)
        self.assertIn("tổng số 100 người!", converted)


class TestVNIConversion(unittest.TestCase):
    def test_vni_standard_words(self):
        vni_str = "Co65ng hoa2 xa4 ho65i chu3 nghi4a Vie65t Nam d9o65c la65p tu75 do ha5nh phu1c"
        converted = convert_vni_to_unicode(vni_str)
        self.assertEqual(
            converted,
            "Cộng hoà xã hội chủ nghĩa Việt Nam độc lập tự do hạnh phúc",
        )

    def test_vni_compound_vowels(self):
        # ươ, ưa, âu, ây, êu
        vni_str = "ngu7o7i2 thu7o7ng ye6u d9a61u"
        converted = convert_vni_to_unicode(vni_str)
        self.assertIn("người", converted)
        self.assertIn("thương", converted)
        self.assertIn("yêu", converted)

    def test_vni_preserves_technical_codes(self):
        # Không được đổi các mã như MP3, B52, A4
        vni_str = "File a6m thanh MP3, may1 bay B52 va2 gia61y A4"
        converted = convert_vni_to_unicode(vni_str)
        self.assertIn("MP3", converted)
        self.assertIn("B52", converted)
        self.assertIn("A4", converted)
        self.assertIn("âm", converted)
        self.assertIn("máy", converted)
        self.assertIn("giấy", converted)

    def test_vni_detection(self):
        self.assertTrue(is_likely_vni("chu1ng to6i ye6u Vie65t Nam"))
        self.assertFalse(is_likely_vni("chúng tôi yêu Việt Nam"))


class TestDetachedDiacriticsAndMojibake(unittest.TestCase):
    def test_detached_combining_diacritics(self):
        # Nguyên âm có dấu kết hợp U+0300..U+036F bị tách khoảng trắng
        detached = "Viê\u0323t Nam đất nươ\u0301c ta"
        fixed = fix_detached_diacritics(detached)
        self.assertEqual(fixed, "Việt Nam đất nước ta")

    def test_spacing_accents(self):
        # Ký tự dấu rời (acute ´) sau nguyên âm
        raw = "tiê\u00b4ng viê\u0323t"
        fixed = fix_detached_diacritics(raw)
        self.assertIn("tiếng", fixed)

    def test_zero_width_chars_removal(self):
        text_with_zw = "Vi\u200bệt \ufeffNam\u200d"
        fixed = fix_detached_diacritics(text_with_zw)
        self.assertEqual(fixed, "Việt Nam")

    def test_mojibake_recovery(self):
        # UTF-8 tiếng Việt bị đọc nhầm Latin-1
        original = "Tiếng Việt thân yêu"
        mojibake = original.encode("utf-8").decode("latin1")
        recovered, was_fixed = fix_mojibake(mojibake)
        self.assertTrue(was_fixed)
        self.assertEqual(recovered, original)


class TestLineUnwrappingAndHeaders(unittest.TestCase):
    def test_page_number_removal(self):
        raw = (
            "Trang 1 / 15\n"
            "Nội dung chính của trang sách này.\n"
            "- 1 -"
        )
        cleaned = clean_and_unwrap_lines(raw)
        self.assertNotIn("Trang 1 / 15", cleaned)
        self.assertNotIn("- 1 -", cleaned)
        self.assertIn("Nội dung chính của trang sách này.", cleaned)

    def test_line_unwrapping_mid_sentence(self):
        raw = (
            "Hệ thống chuyển đổi giọng nói tiếng Việt được phát\n"
            "triển để hỗ trợ người dùng đọc các tài liệu bị lỗi font."
        )
        cleaned = clean_and_unwrap_lines(raw)
        self.assertEqual(
            cleaned,
            "Hệ thống chuyển đổi giọng nói tiếng Việt được phát triển để hỗ trợ người dùng đọc các tài liệu bị lỗi font.",
        )

    def test_hyphenated_line_break(self):
        raw = (
            "Dự án tập trung nâng cao khả năng tương-\n"
            "tác giữa người và máy."
        )
        cleaned = clean_and_unwrap_lines(raw)
        self.assertEqual(
            cleaned,
            "Dự án tập trung nâng cao khả năng tươngtác giữa người và máy.",
        )

    def test_preserves_bullets_and_paragraphs(self):
        raw = (
            "Danh sách các mục cần làm:\n"
            "• Mục 1: Kiểm thử hệ thống.\n"
            "• Mục 2: Báo cáo kết quả."
        )
        cleaned = clean_and_unwrap_lines(raw)
        self.assertIn("• Mục 1: Kiểm thử hệ thống.", cleaned)
        self.assertIn("• Mục 2: Báo cáo kết quả.", cleaned)


class TestSentenceSplitting(unittest.TestCase):
    def test_abbreviation_preservation(self):
        text = "UBND Tp. Hồ Chí Minh đã tiếp đón GS. TS. Nguyễn Văn A cùng BS. Trần Thị B vào hôm nay."
        sentences = split_into_sentences(text)
        self.assertEqual(len(sentences), 1)
        self.assertIn("Tp. Hồ Chí Minh", sentences[0])
        self.assertIn("GS. TS. Nguyễn Văn A", sentences[0])
        self.assertIn("BS. Trần Thị B", sentences[0])

    def test_multiple_sentences(self):
        text = "Hôm nay trời rất đẹp. Bạn có muốn đi dạo không? Hãy chuẩn bị nhé!"
        sentences = split_into_sentences(text)
        self.assertEqual(len(sentences), 3)
        self.assertEqual(sentences[0], "Hôm nay trời rất đẹp.")
        self.assertEqual(sentences[1], "Bạn có muốn đi dạo không?")
        self.assertEqual(sentences[2], "Hãy chuẩn bị nhé!")

    def test_long_sentence_subdivision(self):
        # Câu cực dài có dấu phẩy sẽ được chia nhỏ để TTS đọc tự nhiên
        long_s = "Một câu văn rất dài, " * 15 + "kết thúc câu ở đây."
        sentences = split_into_sentences(long_s, max_len=120)
        self.assertGreater(len(sentences), 1)
        for s in sentences:
            self.assertLessEqual(len(s), 140)


class TestQualityEvaluation(unittest.TestCase):
    def test_scanned_or_empty_text(self):
        res = evaluate_text_quality("")
        self.assertTrue(res["needs_ocr"])
        self.assertEqual(res["quality_score"], 0.0)

    def test_broken_font_replacement_chars(self):
        bad_text = "Th\ufffdng b\ufffd\ufffd v\ufffd vi\ufffdc h\ufffdng font ch\ufffd n\ufffdng"
        res = evaluate_text_quality(bad_text)
        self.assertTrue(res["needs_ocr"])
        self.assertLess(res["quality_score"], 0.8)

    def test_clean_vietnamese_text(self):
        clean_text = "Cộng hòa Xã hội Chủ nghĩa Việt Nam - Độc lập Tự do Hạnh phúc"
        res = evaluate_text_quality(clean_text)
        self.assertFalse(res["needs_ocr"])
        self.assertGreaterEqual(res["quality_score"], 0.9)


class TestOverallPipeline(unittest.TestCase):
    def test_pipeline_auto_tcvn3(self):
        raw = "Céng hoµ x· héi chñ nghÜa ViÖt Nam\n§éc lËp Tù do H¹nh phóc\nTrang 1"
        res = process_vietnamese_pdf_text(raw, force_mode="auto")
        self.assertEqual(res["encoding_detected"], "tcvn3")
        self.assertFalse(res["needs_ocr"])
        self.assertIn("Cộng hoà xã hội chủ nghĩa Việt Nam", res["text"])

    def test_pipeline_empty(self):
        res = process_vietnamese_pdf_text("")
        self.assertTrue(res["needs_ocr"])
        self.assertEqual(res["encoding_detected"], "empty")
        self.assertEqual(len(res["sentences"]), 0)


if __name__ == "__main__":
    unittest.main()
