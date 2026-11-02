import os
import shutil
import tempfile
import time
import unittest
from pathlib import Path

from src.cache_manager import CacheManager


class TestCacheManager(unittest.TestCase):
    def setUp(self):
        self.temp_dir = Path(tempfile.mkdtemp())
        self.manager = CacheManager(cache_dir=self.temp_dir, max_size_bytes=10 * 1024)  # 10 KB limit

    def tearDown(self):
        shutil.rmtree(self.temp_dir, ignore_errors=True)

    def test_cache_stats_empty(self):
        stats = self.manager.get_stats()
        self.assertEqual(stats["total_files"], 0)
        self.assertEqual(stats["total_size_bytes"], 0)
        self.assertEqual(stats["max_size_bytes"], 10 * 1024)
        self.assertEqual(stats["usage_percent"], 0.0)

    def test_cache_stats_with_files(self):
        # Tạo 3 file mp3 giả lập (mỗi file 2KB)
        for i in range(3):
            p = self.temp_dir / f"test_{i}.mp3"
            p.write_bytes(b"x" * 2048)

        stats = self.manager.get_stats()
        self.assertEqual(stats["total_files"], 3)
        self.assertEqual(stats["total_size_bytes"], 3 * 2048)
        self.assertAlmostEqual(stats["usage_percent"], 60.0, delta=1.0)

    def test_prune_lru_evicts_oldest_files(self):
        # Tạo 4 file mp3 (mỗi file 3KB -> tổng 12KB > giới hạn 10KB)
        files = []
        for i in range(4):
            p = self.temp_dir / f"audio_{i}.mp3"
            p.write_bytes(b"a" * 3072)
            # Giả lập thời gian truy cập khác nhau (file 0 cũ nhất)
            os.utime(p, (1000 + i * 100, 1000 + i * 100))
            files.append(p)

        stats_before = self.manager.get_stats()
        self.assertEqual(stats_before["total_files"], 4)
        self.assertGreater(stats_before["total_size_bytes"], self.manager.max_size_bytes)

        # Dọn dẹp với target_ratio = 0.5 (dọn về <= 5KB)
        result = self.manager.prune_lru(target_ratio=0.5)
        self.assertEqual(result["status"], "pruned")
        self.assertGreater(result["freed_bytes"], 0)
        self.assertGreaterEqual(result["freed_files"], 2)

        # File 0 và File 1 cũ nhất phải bị xóa trước
        self.assertFalse(files[0].exists())
        self.assertFalse(files[1].exists())
        # File 3 mới nhất phải còn tồn tại
        self.assertTrue(files[3].exists())

    def test_clean_all(self):
        for i in range(5):
            p = self.temp_dir / f"clip_{i}.mp3"
            p.write_bytes(b"dummy_audio")

        res = self.manager.clean_all()
        self.assertEqual(res["status"], "cleared")
        self.assertEqual(res["freed_files"], 5)
        stats = self.manager.get_stats()
        self.assertEqual(stats["total_files"], 0)


if __name__ == "__main__":
    unittest.main()
