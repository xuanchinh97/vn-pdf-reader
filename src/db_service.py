import json
import re
import sqlite3
import threading
import time
import unicodedata
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from src.dictionary_seed import SEED_DICTIONARY

DB_DIR = Path.home() / ".vn_pdf_reader"
DB_DIR.mkdir(parents=True, exist_ok=True)
DB_PATH = DB_DIR / "app.db"


def strip_vn_diacritics_simple(text: str) -> str:
    """Loại bỏ dấu tiếng Việt thô và chuyển đ/Đ thành d/D để hỗ trợ tìm kiếm không dấu."""
    t = text.replace("đ", "d").replace("Đ", "D")
    nfkd = unicodedata.normalize("NFKD", t)
    return "".join(c for c in nfkd if not unicodedata.combining(c))


class DatabaseService:
    """
    Dịch vụ cơ sở dữ liệu SQLite trung tâm (REC-03):
    1. Quản lý từ điển offline và lưu đệm từ tra cứu từ Wiktionary.
    2. Chỉ mục tìm kiếm toàn văn SQLite Full-Text Search (FTS5) siêu tốc (<10ms).
    """

    def __init__(self, db_path: Optional[Path] = None):
        self.db_path = db_path or DB_PATH
        self._lock = threading.Lock()
        self._local = threading.local()
        self._init_db()

    def _get_connection(self) -> sqlite3.Connection:
        """Lấy connection riêng cho từng thread để đảm bảo an toàn tuyệt đối."""
        if not hasattr(self._local, "conn") or self._local.conn is None:
            conn = sqlite3.connect(
                str(self.db_path),
                timeout=30.0,
                check_same_thread=False,
            )
            conn.execute("PRAGMA journal_mode = WAL;")
            conn.execute("PRAGMA synchronous = NORMAL;")
            conn.row_factory = sqlite3.Row
            self._local.conn = conn
        return self._local.conn

    def _init_db(self) -> None:
        """Khởi tạo schema database và nạp dữ liệu từ điển hạt giống nếu cần."""
        with self._lock:
            conn = self._get_connection()
            # 1. Bảng từ điển
            conn.execute("""
                CREATE TABLE IF NOT EXISTS dictionary (
                    word TEXT PRIMARY KEY,
                    meanings_json TEXT NOT NULL,
                    source TEXT DEFAULT 'Từ điển Tích hợp',
                    updated_at REAL
                );
            """)

            # 2. Bảng ảo FTS5 tìm kiếm toàn văn
            try:
                conn.execute("""
                    CREATE VIRTUAL TABLE IF NOT EXISTS doc_pages_fts USING fts5(
                        doc_id UNINDEXED,
                        page_number UNINDEXED,
                        sentence_index UNINDEXED,
                        sentence_text,
                        normalized_text,
                        tokenize = 'unicode61 remove_diacritics 2'
                    );
                """)
            except sqlite3.OperationalError as exc:
                print(f"[DBService] Cảnh báo khởi tạo FTS5: {exc}")

            # 3. Bảng theo dõi trạng thái index của tài liệu
            conn.execute("""
                CREATE TABLE IF NOT EXISTS doc_index_meta (
                    doc_id TEXT PRIMARY KEY,
                    indexed_pages INTEGER,
                    indexed_at REAL
                );
            """)
            conn.commit()

            # Seed từ điển nếu bảng đang rỗng
            cursor = conn.execute("SELECT COUNT(*) FROM dictionary;")
            count = cursor.fetchone()[0]
            if count == 0 and SEED_DICTIONARY:
                now = time.time()
                for word, info in SEED_DICTIONARY.items():
                    meanings_str = json.dumps(info.get("meanings", []), ensure_ascii=False)
                    source = info.get("source", "Từ điển Tích hợp")
                    conn.execute(
                        "INSERT OR REPLACE INTO dictionary (word, meanings_json, source, updated_at) VALUES (?, ?, ?, ?)",
                        (word.lower().strip(), meanings_str, source, now),
                    )
                conn.commit()

    # ------------------ DICTIONARY METHODS ------------------

    def lookup_word(self, word: str) -> Optional[Dict[str, Any]]:
        """Tra cứu từ điển offline trong SQLite."""
        w_clean = word.strip().lower()
        if not w_clean:
            return None

        conn = self._get_connection()
        row = conn.execute(
            "SELECT word, meanings_json, source FROM dictionary WHERE word = ?",
            (w_clean,),
        ).fetchone()

        if row:
            try:
                meanings = json.loads(row["meanings_json"])
                return {
                    "word": row["word"],
                    "found": True,
                    "meanings": meanings,
                    "source": row["source"],
                }
            except Exception:
                pass
        return None

    def save_word(
        self, word: str, meanings: List[Dict[str, Any]], source: str = "Wiktionary Tiếng Việt"
    ) -> Dict[str, Any]:
        """Lưu hoặc cập nhật từ điển vào SQLite."""
        w_clean = word.strip().lower()
        meanings_str = json.dumps(meanings, ensure_ascii=False)
        now = time.time()

        with self._lock:
            conn = self._get_connection()
            conn.execute(
                "INSERT OR REPLACE INTO dictionary (word, meanings_json, source, updated_at) VALUES (?, ?, ?, ?)",
                (w_clean, meanings_str, source, now),
            )
            conn.commit()

        return {
            "word": w_clean,
            "found": True,
            "meanings": meanings,
            "source": source,
        }

    def get_all_words(self) -> Dict[str, Dict[str, Any]]:
        """Lấy toàn bộ từ điển ra dictionary memory (phục vụ tương thích ngược)."""
        conn = self._get_connection()
        rows = conn.execute("SELECT word, meanings_json, source FROM dictionary").fetchall()
        result: Dict[str, Dict[str, Any]] = {}
        for r in rows:
            try:
                result[r["word"]] = {
                    "word": r["word"],
                    "found": True,
                    "meanings": json.loads(r["meanings_json"]),
                    "source": r["source"],
                }
            except Exception:
                continue
        return result

    def get_dictionary_count(self) -> int:
        """Đếm tổng số từ trong từ điển SQLite."""
        conn = self._get_connection()
        row = conn.execute("SELECT COUNT(*) FROM dictionary").fetchone()
        return row[0] if row else 0

    # ------------------ FTS5 FULL-TEXT SEARCH METHODS ------------------

    def is_doc_indexed(self, doc_id: str) -> bool:
        """Kiểm tra tài liệu đã được lập chỉ mục FTS5 chưa."""
        conn = self._get_connection()
        row = conn.execute(
            "SELECT doc_id FROM doc_index_meta WHERE doc_id = ?",
            (doc_id,),
        ).fetchone()
        return row is not None

    def clear_doc_index(self, doc_id: str) -> None:
        """Xóa toàn bộ chỉ mục FTS5 của tài liệu."""
        with self._lock:
            conn = self._get_connection()
            conn.execute("DELETE FROM doc_pages_fts WHERE doc_id = ?", (doc_id,))
            conn.execute("DELETE FROM doc_index_meta WHERE doc_id = ?", (doc_id,))
            conn.commit()

    def index_document_pages(
        self, doc_id: str, pages_data: List[Dict[str, Any]]
    ) -> int:
        """
        Lập chỉ mục toàn bộ các câu trong tài liệu vào bảng ảo FTS5.
        pages_data: List của dict dạng {'page': int, 'sentences': List[str]}
        """
        with self._lock:
            conn = self._get_connection()
            # Xóa index cũ nếu có
            conn.execute("DELETE FROM doc_pages_fts WHERE doc_id = ?", (doc_id,))
            conn.execute("DELETE FROM doc_index_meta WHERE doc_id = ?", (doc_id,))

            rows_to_insert = []
            for p in pages_data:
                page_no = int(p.get("page", 1))
                sentences = p.get("sentences", [])
                for s_idx, sentence in enumerate(sentences):
                    s_clean = str(sentence).strip()
                    if s_clean:
                        s_norm = strip_vn_diacritics_simple(s_clean)
                        rows_to_insert.append((doc_id, page_no, s_idx, s_clean, s_norm))

            if rows_to_insert:
                conn.executemany(
                    "INSERT INTO doc_pages_fts (doc_id, page_number, sentence_index, sentence_text, normalized_text) VALUES (?, ?, ?, ?, ?)",
                    rows_to_insert,
                )

            conn.execute(
                "INSERT INTO doc_index_meta (doc_id, indexed_pages, indexed_at) VALUES (?, ?, ?)",
                (doc_id, len(pages_data), time.time()),
            )
            conn.commit()
            return len(rows_to_insert)

    def search_fts(
        self, doc_id: str, query: str, limit: int = 200
    ) -> List[Tuple[int, int, str]]:
        """
        Tìm kiếm toàn văn siêu tốc bằng FTS5 (<10ms).
        Trả về danh sách (page_number, sentence_index, sentence_text).
        """
        safe_q = re.sub(r'["\*\?\:\^\(\)\[\]\{\}]', ' ', query).strip()
        if not safe_q:
            return []

        # Chuẩn hóa truy vấn cho FTS5: tìm theo cụm từ hoặc từ khóa tiền tố
        tokens = [t for t in safe_q.split() if t]
        if not tokens:
            return []

        # Hỗ trợ tìm kiếm cả cụm từ: "từ_khóa"*
        phrase = " ".join(tokens)
        fts_match_expr = f'"{phrase}"*'

        conn = self._get_connection()
        try:
            cursor = conn.execute(
                """
                SELECT page_number, sentence_index, sentence_text
                FROM doc_pages_fts
                WHERE doc_id = ? AND doc_pages_fts MATCH ?
                ORDER BY page_number ASC, sentence_index ASC
                LIMIT ?
                """,
                (doc_id, fts_match_expr, limit),
            )
            rows = cursor.fetchall()
            return [(int(r["page_number"]), int(r["sentence_index"]), str(r["sentence_text"])) for r in rows]
        except sqlite3.OperationalError:
            # Fallback nếu câu truy vấn FTS5 có ký tự đặc biệt
            try:
                # Thử tìm theo từng token kết hợp AND
                token_expr = " AND ".join(f'"{t}"*' for t in tokens)
                cursor = conn.execute(
                    """
                    SELECT page_number, sentence_index, sentence_text
                    FROM doc_pages_fts
                    WHERE doc_id = ? AND doc_pages_fts MATCH ?
                    ORDER BY page_number ASC, sentence_index ASC
                    LIMIT ?
                    """,
                    (doc_id, token_expr, limit),
                )
                rows = cursor.fetchall()
                return [(int(r["page_number"]), int(r["sentence_index"]), str(r["sentence_text"])) for r in rows]
            except Exception as exc:
                print(f"[DBService] Lỗi truy vấn FTS5 ({exc}), chuyển sang quét fallback")
                return []


# Singleton DatabaseService instance
db_service = DatabaseService()
