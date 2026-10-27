"""
Unit tests cho tts_service.py
Kiểm tra:
- Danh sách voice
- Tốc độ đọc (speed_to_edge_rate)
- Phân đoạn văn bản dài (>190 ký tự) cho Google TTS
- Bộ nhớ đệm (Cache) trên đĩa
- Xử lý văn bản rỗng / bất thường
"""

import asyncio
import time
from pathlib import Path
import unittest
from unittest.mock import patch, MagicMock

from src.tts_service import (
    TTSService,
    speed_to_edge_rate,
    AVAILABLE_VOICES,
    TTS_CACHE_DIR,
)


class TestTTSService(unittest.TestCase):
    def setUp(self):
        self.tts = TTSService()

    def test_voice_list(self):
        voices = self.tts.get_voices()
        self.assertIsInstance(voices, list)
        self.assertGreater(len(voices), 0)
        voice_ids = [v["id"] for v in voices]
        self.assertIn("google-vi-female", voice_ids)
        self.assertIn("vi-VN-HoaiMyNeural", voice_ids)
        self.assertIn("vi-VN-NamMinhNeural", voice_ids)

    def test_speed_to_edge_rate(self):
        self.assertEqual(speed_to_edge_rate(1.0), "+0%")
        self.assertEqual(speed_to_edge_rate(1.25), "+25%")
        self.assertEqual(speed_to_edge_rate(1.5), "+50%")
        self.assertEqual(speed_to_edge_rate(0.85), "-15%")

    def test_empty_text_raises_value_error(self):
        with self.assertRaises(ValueError):
            asyncio.run(self.tts.synthesize_speech("   "))

    def test_caching_behavior(self):
        # Tổng hợp 1 câu ngắn
        test_sentence = "Thử nghiệm bộ nhớ đệm âm thanh."
        # Lần 1: sinh file mp3
        p1 = asyncio.run(self.tts.synthesize_speech(test_sentence, "google-vi-female"))
        self.assertTrue(p1.exists())
        self.assertGreater(p1.stat().st_size, 1000)
        mtime1 = p1.stat().st_mtime

        # Lần 2: gọi lại cùng câu -> phải trả về file đệm ngay lập tức mà không ghi lại
        p2 = asyncio.run(self.tts.synthesize_speech(test_sentence, "google-vi-female"))
        self.assertEqual(p1, p2)
        self.assertEqual(mtime1, p2.stat().st_mtime)

    def test_long_text_chunking_google_tts(self):
        # Văn bản dài hơn 190 ký tự (giới hạn an toàn của Google TTS client endpoint)
        long_paragraph = (
            "Dự án công cụ đọc PDF tiếng Việt này hỗ trợ trích xuất văn bản một cách thông minh, "
            "tự động nối các dòng bị ngắt giữa chừng, khắc phục triệt để các lỗi font chữ phổ biến như TCVN3 hay VNI, "
            "đồng thời cung cấp giao diện nghe trực quan với tính năng tô sáng từng câu đang đọc."
        )
        self.assertGreater(len(long_paragraph), 190)

        # Chạy tổng hợp
        mp3_path = asyncio.run(self.tts.synthesize_speech(long_paragraph, "google-vi-female"))
        self.assertTrue(mp3_path.exists())
        # File ghép của nhiều đoạn phải có dung lượng lớn tương ứng (> 10KB)
        self.assertGreater(mp3_path.stat().st_size, 10000)

    def test_edge_tts_fallback_on_network_timeout(self):
        # Mô phỏng tình huống Edge-TTS timeout -> kích hoạt circuit breaker và fallback sang Google TTS
        dynamic_text = f"Kiểm thử cơ chế circuit breaker khi Edge TTS bị timeout {time.time()}."
        with patch("src.tts_service.edge_tts.Communicate.save", side_effect=asyncio.TimeoutError):
            mp3_path = asyncio.run(
                self.tts.synthesize_speech(
                    dynamic_text,
                    "vi-VN-HoaiMyNeural",
                )
            )
            self.assertTrue(mp3_path.exists())
            self.assertGreater(mp3_path.stat().st_size, 1000)
            # Circuit breaker phải được kích hoạt (thời gian chặn > 0)
            self.assertGreater(self.tts._edge_blocked_until, 0)

    def test_speed_cache_key_differentiation(self):
        import hashlib
        text = "Kiểm thử mã hóa tốc độ vào khóa bộ nhớ đệm."
        voice = "google-vi-female"

        p_default = asyncio.run(self.tts.synthesize_speech(text, voice, speed=1.0))
        p_fast = asyncio.run(self.tts.synthesize_speech(text, voice, speed=1.25))

        expected_hash_default = hashlib.md5(f"{voice}|{text}".encode("utf-8")).hexdigest()
        expected_hash_fast = hashlib.md5(f"{voice}|speed_1.25|{text}".encode("utf-8")).hexdigest()

        self.assertEqual(p_default.name, f"{expected_hash_default}.mp3")
        self.assertEqual(p_fast.name, f"{expected_hash_fast}.mp3")
        self.assertNotEqual(p_default, p_fast)

    def test_phonemize_vietnamese_smart_numbers_symbols_and_do(self):
        # Kiểm tra số 1999, 15%, 100$ được đọc thành chữ và chữ 'do' phát âm tiếng Việt (zˈɔ) thay vì tiếng Anh (dˈuː)
        ps = self.tts.phonemize_vietnamese_smart("Năm 1999, do tăng trưởng 15% nên đạt 100$.")
        self.assertNotIn("999", ps)
        self.assertNotIn("%", ps)
        self.assertNotIn("$", ps)
        self.assertNotIn("dˈuː", ps)
        self.assertIn("zˈɔ", ps)


if __name__ == "__main__":
    unittest.main()
