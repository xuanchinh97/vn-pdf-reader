from functools import lru_cache
from pathlib import Path
from typing import Any, Dict, List, Optional
import urllib.parse

import httpx
from fastapi import FastAPI, File, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, Response
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from src.cache_manager import cache_manager
from src.db_service import db_service
from src.pdf_service import pdf_service
from src.tts_service import tts_service
from src.vn_text_processor import process_vietnamese_pdf_text

app = FastAPI(
    title="VN PDF Reader & Natural TTS",
    description="Công cụ đọc PDF Tiếng Việt thông minh (Sửa lỗi font TCVN3/VNI, Quét OCR & Giọng đọc AI tự nhiên)",
    version="1.9.1",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def disable_static_cache(request, call_next):
    response = await call_next(request)
    path = request.url.path
    if path == "/" or path.endswith((".html", ".js", ".css")):
        response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
        response.headers["Pragma"] = "no-cache"
        response.headers["Expires"] = "0"
    return response


class CleanTextRequest(BaseModel):
    text: str
    force_mode: str = "unicode"


class GeminiOCRRequest(BaseModel):
    api_key: str


class TTSRequest(BaseModel):
    text: str
    voice: str = "kokoro-thanh_dat"
    speed: float = 1.0
    sentences: Optional[List[str]] = None


class ConfigUpdateRequest(BaseModel):
    http_proxy: Optional[str] = None


class AnnotationsPayload(BaseModel):
    bookmarks: Optional[List[Any]] = []
    highlights: Optional[List[Any]] = []


class UnlockPayload(BaseModel):
    password: str


@app.get("/api/config")
async def get_config_endpoint():
    return {
        **tts_service.config,
        "hardware_profile": tts_service.get_hardware_profile(),
    }


@app.post("/api/config")
async def update_config_endpoint(req: ConfigUpdateRequest):
    if req.http_proxy is not None:
        tts_service.config["http_proxy"] = req.http_proxy.strip()
        tts_service._proxy = req.http_proxy.strip()
    return {"status": "ok", "config": tts_service.config}


@app.get("/api/voices")
async def get_voices():
    return {"voices": tts_service.get_voices()}


@app.post("/api/upload")
async def upload_pdf(file: UploadFile = File(...)):
    filename = file.filename or ""
    ext = Path(filename).suffix.lower()
    if ext not in (".pdf", ".epub", ".txt"):
        raise HTTPException(
            status_code=400,
            detail="Vui lòng chọn file có định dạng hỗ trợ: .pdf, .epub, hoặc .txt",
        )
    try:
        content = await file.read()
        if not content:
            raise HTTPException(status_code=400, detail="Tài liệu tải lên đang rỗng.")
        info = pdf_service.register_pdf(filename, content)
        return info
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Không thể đọc tài liệu: {exc}")


@app.post("/api/doc/{doc_id}/unlock")
async def unlock_document_endpoint(doc_id: str, payload: UnlockPayload):
    """Mở khóa tài liệu PDF được bảo vệ bằng mật khẩu."""
    if not payload.password:
        raise HTTPException(status_code=400, detail="Vui lòng cung cấp mật khẩu mở tài liệu.")
    try:
        return pdf_service.unlock_document(doc_id, payload.password)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Lỗi mở khóa tài liệu: {exc}")


@app.get("/api/doc/{doc_id}/page/{page_number}")
async def get_page_text(
    doc_id: str,
    page_number: int,
    mode: str = Query("auto", description="auto | tcvn3 | vni | unicode"),
):
    try:
        return pdf_service.extract_page_text(doc_id, page_number, force_mode=mode)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc))
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Lỗi trích xuất văn bản: {exc}")


@app.get("/api/doc/{doc_id}/page/{page_number}/image")
async def get_page_image(
    doc_id: str,
    page_number: int,
    dpi: int = Query(170, ge=36, le=300),
    enhance: bool = Query(False),
):
    try:
        png_bytes = pdf_service.render_page_image(
            doc_id, page_number, dpi=dpi, enhance_for_ocr=enhance
        )
        return Response(content=png_bytes, media_type="image/png")
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Lỗi tạo ảnh trang PDF: {exc}")


@app.post("/api/clean-text")
async def clean_text_endpoint(req: CleanTextRequest):
    """Xử lý, chuẩn hóa dấu, nối câu và tách câu cho văn bản từ OCR hoặc người dùng chỉnh sửa."""
    result = process_vietnamese_pdf_text(req.text, force_mode=req.force_mode)
    return result


@app.post("/api/doc/{doc_id}/page/{page_number}/gemini-ocr")
async def gemini_ocr_endpoint(doc_id: str, page_number: int, req: GeminiOCRRequest):
    if not req.api_key or not req.api_key.strip():
        raise HTTPException(status_code=400, detail="Vui lòng nhập Gemini API Key.")
    try:
        return await pdf_service.ocr_page_with_gemini(doc_id, page_number, req.api_key.strip())
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@app.post("/api/tts")
async def synthesize_tts(req: TTSRequest):
    if not req.text or not req.text.strip():
        raise HTTPException(status_code=400, detail="Nội dung cần đọc đang trống.")
    try:
        mp3_path = await tts_service.synthesize_speech(
            text=req.text,
            voice=req.voice,
            speed=req.speed,
            sentences=req.sentences,
        )
        return FileResponse(
            path=str(mp3_path),
            media_type="audio/mpeg",
            filename="vn_pdf_speech.mp3",
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Lỗi tạo giọng đọc TTS: {exc}")


@app.get("/api/doc/{doc_id}/toc")
async def get_doc_toc(doc_id: str):
    try:
        toc = pdf_service.extract_toc(doc_id)
        return {"doc_id": doc_id, "toc": toc}
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Lỗi trích xuất mục lục: {exc}")


@app.get("/api/doc/{doc_id}/pages")
async def get_doc_pages_overview(doc_id: str):
    try:
        pages = pdf_service.get_pages_overview(doc_id)
        return {"doc_id": doc_id, "pages": pages, "total": len(pages)}
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Lỗi đọc danh sách trang: {exc}")


@app.get("/api/doc/{doc_id}/search")
async def search_document_endpoint(
    doc_id: str,
    q: str = Query(..., description="Từ hoặc cụm từ cần tìm trong sách"),
    max_results: int = Query(200, ge=1, le=500),
):
    clean_q = q.strip()
    if len(clean_q) < 2:
        raise HTTPException(status_code=400, detail="Từ khóa tìm kiếm phải có độ dài ít nhất 2 ký tự.")
    try:
        return pdf_service.search_document(doc_id, clean_q, max_results=max_results)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc))
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Lỗi tìm kiếm văn bản trong tài liệu: {exc}")


@app.get("/api/doc/{doc_id}/annotations")
async def get_annotations_endpoint(doc_id: str):
    try:
        return pdf_service.get_annotations(doc_id)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Lỗi đọc ghi chú/dấu trang: {exc}")


@app.post("/api/doc/{doc_id}/annotations")
async def save_annotations_endpoint(doc_id: str, payload: AnnotationsPayload):
    try:
        data = payload.model_dump() if hasattr(payload, "model_dump") else payload.dict()
        saved = pdf_service.save_annotations(doc_id, data)
        return {"status": "ok", "annotations": saved}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Lỗi lưu ghi chú/dấu trang: {exc}")


# Từ điển được chuyển sang quản lý tập trung bằng SQLite (REC-03)
# Duy trì biến OFFLINE_DICTIONARY qua SQLite để tương thích 100% với mã nguồn cũ
class _OfflineDictionaryProxy(dict):
    """Proxy từ điển tự động đồng bộ và tra cứu qua SQLite database."""
    def __getitem__(self, key):
        res = db_service.lookup_word(key)
        if res:
            return res
        return super().__getitem__(key)

    def __contains__(self, key):
        return db_service.lookup_word(key) is not None

    def get(self, key, default=None):
        res = db_service.lookup_word(key)
        return res if res is not None else default

OFFLINE_DICTIONARY = _OfflineDictionaryProxy(db_service.get_all_words())

IGNORED_WIKTIONARY_HEADERS = {
    "từ nguyên", "dịch", "dịch nghĩa", "tham khảo", "xem thêm",
    "mã ký tự", "chú thích", "liên kết ngoài", "ghi chú", "thành ngữ",
    "từ liên quan", "chú thích nguồn",
}


def _parse_wiktionary_extract(word: str, extract: str) -> Optional[dict]:
    lines = extract.split("\n")
    meanings = []
    current_pos = "Nghĩa từ"
    current_defs = []
    skip_current_section = False

    for line in lines:
        s = line.strip()
        if not s:
            continue
        if s.startswith("===") and s.endswith("==="):
            header = s.strip("=").strip()
            if current_defs and not skip_current_section:
                meanings.append({"pos": current_pos, "definitions": current_defs})
                current_defs = []
            current_pos = header
            skip_current_section = header.lower() in IGNORED_WIKTIONARY_HEADERS
        elif not skip_current_section:
            if s.startswith("#") or s.startswith("*") or s.startswith("-"):
                clean_def = s.lstrip("#*- ").strip()
                if clean_def and len(clean_def) > 3 and not clean_def.startswith("="):
                    current_defs.append(clean_def)
            elif len(s) > 10 and not s.startswith("=="):
                current_defs.append(s)

    if current_defs and not skip_current_section:
        meanings.append({"pos": current_pos, "definitions": current_defs})

    if meanings:
        return {
            "word": word,
            "found": True,
            "meanings": meanings,
            "source": "Wiktionary Tiếng Việt",
        }
    return None


@lru_cache(maxsize=1024)
def _lookup_word_cached(word: str) -> dict:
    w_clean = word.strip().lower()
    # 1. Kiểm tra từ điển SQLite (REC-03)
    db_result = db_service.lookup_word(w_clean)
    if db_result:
        return db_result

    # 2. Thử gọi Wiktionary Tiếng Việt qua proxy công ty hoặc trực tiếp
    proxy = tts_service._proxy
    encoded_word = urllib.parse.quote(w_clean)
    url = f"https://vi.wiktionary.org/w/api.php?action=query&prop=extracts&explaintext=true&format=json&titles={encoded_word}"

    for p in [proxy, None]:
        try:
            with httpx.Client(proxy=p, timeout=2.5) as client:
                resp = client.get(url, headers={"User-Agent": "VN-PDF-Reader/1.3.0"})
                if resp.status_code == 200:
                    data = resp.json()
                    pages = data.get("query", {}).get("pages", {})
                    for page_id, page_info in pages.items():
                        if page_id != "-1" and "extract" in page_info:
                            parsed = _parse_wiktionary_extract(word, page_info["extract"])
                            if parsed:
                                db_service.save_word(word, parsed["meanings"], parsed.get("source", "Wiktionary Tiếng Việt"))
                                return parsed
        except Exception:
            continue

    # 3. Trả về cấu trúc chuẩn khi không tìm thấy
    return {
        "word": word,
        "found": False,
        "message": f"Chưa tìm thấy định nghĩa chi tiết cho từ '{word}'.",
        "meanings": [
            {
                "pos": "Gợi ý",
                "definitions": [
                    f"Từ '{word}' chưa có trong từ điển mẫu hoặc không thể kết nối tới Wiktionary trực tuyến.",
                    "Bạn có thể dùng tính năng đọc AI để nghe phát âm chính xác của từ này."
                ]
            }
        ],
        "source": "VN PDF Reader"
    }


@app.get("/api/dictionary/lookup")
async def dictionary_lookup_endpoint(word: str = Query(..., description="Từ tiếng Việt cần tra cứu")):
    cleaned = word.strip()
    if not cleaned:
        raise HTTPException(status_code=400, detail="Vui lòng cung cấp từ cần tra cứu.")
    return _lookup_word_cached(cleaned)



@app.get("/api/cache/stats")
async def cache_stats_endpoint():
    """Lấy thống kê dung lượng bộ nhớ đệm TTS và RAM (REC-02)."""
    return {
        "status": "ok",
        "disk_cache": cache_manager.get_stats(),
        "page_cache": {
            "cached_pages": len(pdf_service._page_text_cache),
            "max_cached_pages": pdf_service._max_page_cache_size,
        },
    }


@app.post("/api/cache/clean")
async def cache_clean_endpoint(all: bool = False):
    """
    Dọn dẹp bộ nhớ đệm audio TTS (REC-02).
    Nếu all=True: xóa sạch toàn bộ cache MP3.
    Nếu all=False: dọn dẹp theo giải thuật LRU xuống mức an toàn.
    """
    try:
        if all:
            res = cache_manager.clean_all()
        else:
            res = cache_manager.prune_lru(target_ratio=0.8)
        return {"status": "ok", "result": res}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Lỗi dọn dẹp cache: {exc}")


STATIC_DIR = Path(__file__).parent / "static"
STATIC_DIR.mkdir(parents=True, exist_ok=True)

app.mount("/", StaticFiles(directory=str(STATIC_DIR), html=True), name="static")
