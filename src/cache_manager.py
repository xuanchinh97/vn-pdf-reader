import os
import shutil
import threading
import time
from pathlib import Path
from typing import Any, Dict, List, Optional

TTS_CACHE_DIR = Path.home() / ".vn_pdf_reader" / "tts_cache"
TTS_CACHE_DIR.mkdir(parents=True, exist_ok=True)

# Giới hạn dung lượng cache mặc định: 2GB (REC-02)
DEFAULT_MAX_DISK_CACHE_BYTES = 2 * 1024 * 1024 * 1024  # 2 GB
DEFAULT_PRUNE_TARGET_RATIO = 0.8  # Khi đầy, dọn về 80% (1.6GB) để tránh dọn liên tục


class CacheManager:
    """
    Quản lý bộ nhớ đệm đĩa (TTS MP3 Cache) theo cơ chế LRU (Least Recently Used) và TTL.
    Bảo vệ ổ đĩa máy tính người dùng khỏi bị đầy bởi các file audio giọng đọc AI.
    """

    def __init__(
        self,
        cache_dir: Optional[Path] = None,
        max_size_bytes: int = DEFAULT_MAX_DISK_CACHE_BYTES,
    ):
        self.cache_dir = cache_dir or TTS_CACHE_DIR
        self.max_size_bytes = max_size_bytes
        self._lock = threading.Lock()

    def get_stats(self) -> Dict[str, Any]:
        """Tính toán tổng dung lượng và số lượng file audio trong cache."""
        total_files = 0
        total_size = 0

        try:
            if self.cache_dir.exists():
                for entry in os.scandir(self.cache_dir):
                    if entry.is_file() and entry.name.endswith(".mp3"):
                        total_files += 1
                        total_size += entry.stat().st_size
        except Exception as exc:
            print(f"[CacheManager] Lỗi đọc thư mục cache: {exc}")

        total_mb = round(total_size / (1024 * 1024), 2)
        max_mb = round(self.max_size_bytes / (1024 * 1024), 2)
        usage_pct = round((total_size / self.max_size_bytes) * 100, 1) if self.max_size_bytes > 0 else 0.0

        return {
            "cache_dir": str(self.cache_dir),
            "total_files": total_files,
            "total_size_bytes": total_size,
            "total_size_mb": total_mb,
            "max_size_bytes": self.max_size_bytes,
            "max_size_mb": max_mb,
            "usage_percent": usage_pct,
        }

    def touch_file(self, file_path: Path) -> None:
        """Cập nhật thời gian truy cập (atime) để phục vụ thuật toán LRU, giữ nguyên mtime."""
        try:
            if file_path.exists():
                st = file_path.stat()
                os.utime(file_path, (time.time(), st.st_mtime))
        except Exception:
            pass

    def prune_lru(
        self,
        max_size_bytes: Optional[int] = None,
        target_ratio: float = DEFAULT_PRUNE_TARGET_RATIO,
    ) -> Dict[str, Any]:
        """
        Dọn dẹp cache theo giải thuật LRU (Least Recently Used).
        Xóa các file audio ít được nghe nhất cho đến khi dung lượng hạ xuống mức an toàn.
        """
        limit = max_size_bytes if max_size_bytes is not None else self.max_size_bytes
        target_size = int(limit * target_ratio)

        with self._lock:
            if not self.cache_dir.exists():
                return {"freed_bytes": 0, "freed_files": 0, "current_size_bytes": 0, "status": "ok"}

            file_list: List[Dict[str, Any]] = []
            total_size = 0

            for entry in os.scandir(self.cache_dir):
                if entry.is_file() and entry.name.endswith(".mp3"):
                    try:
                        st = entry.stat()
                        # Dùng atime nếu hệ điều hành hỗ trợ, nếu không dùng mtime
                        access_time = max(st.st_atime, st.st_mtime)
                        file_list.append({
                            "path": Path(entry.path),
                            "size": st.st_size,
                            "access_time": access_time,
                        })
                        total_size += st.st_size
                    except OSError:
                        continue

            if total_size <= limit:
                return {
                    "freed_bytes": 0,
                    "freed_files": 0,
                    "current_size_bytes": total_size,
                    "status": "within_limit",
                }

            # Sắp xếp file theo access_time tăng dần (file cũ nhất, ít dùng nhất lên đầu)
            file_list.sort(key=lambda x: x["access_time"])

            freed_bytes = 0
            freed_files = 0
            current_size = total_size

            for item in file_list:
                if current_size <= target_size:
                    break
                try:
                    item["path"].unlink(missing_ok=True)
                    current_size -= item["size"]
                    freed_bytes += item["size"]
                    freed_files += 1
                except OSError:
                    continue

            return {
                "freed_bytes": freed_bytes,
                "freed_files": freed_files,
                "freed_mb": round(freed_bytes / (1024 * 1024), 2),
                "current_size_bytes": current_size,
                "current_size_mb": round(current_size / (1024 * 1024), 2),
                "status": "pruned",
            }

    def prune_if_needed(self) -> None:
        """Kiểm tra nhanh và tự động dọn dẹp nếu dung lượng vượt ngưỡng."""
        stats = self.get_stats()
        if stats["total_size_bytes"] > self.max_size_bytes:
            self.prune_lru()

    def clean_all(self) -> Dict[str, Any]:
        """Xóa toàn bộ file audio MP3 trong thư mục cache (khi người dùng chủ động yêu cầu)."""
        with self._lock:
            freed_bytes = 0
            freed_files = 0
            if self.cache_dir.exists():
                for entry in os.scandir(self.cache_dir):
                    if entry.is_file() and entry.name.endswith(".mp3"):
                        try:
                            size = entry.stat().st_size
                            os.unlink(entry.path)
                            freed_bytes += size
                            freed_files += 1
                        except OSError:
                            continue

            return {
                "freed_bytes": freed_bytes,
                "freed_files": freed_files,
                "freed_mb": round(freed_bytes / (1024 * 1024), 2),
                "status": "cleared",
            }


# Singleton CacheManager instance
cache_manager = CacheManager()
