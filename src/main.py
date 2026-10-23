from pathlib import Path
from typing import Optional

from fastapi import FastAPI, File, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, Response
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from src.pdf_service import pdf_service
from src.tts_service import tts_service
from src.vn_text_processor import process_vietnamese_pdf_text

app = FastAPI(
    title="VN PDF Reader & Natural TTS",
    description="Công cụ đọc PDF Tiếng Việt thông minh (Sửa lỗi font TCVN3/VNI, Quét OCR & Giọng đọc AI tự nhiên)",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class CleanTextRequest(BaseModel):
    text: str
    force_mode: str = "unicode"


class GeminiOCRRequest(BaseModel):
    api_key: str


class TTSRequest(BaseModel):
    text: str
    voice: str = "vi-VN-HoaiMyNeural"
    speed: float = 1.0


class ConfigUpdateRequest(BaseModel):
    fpt_api_key: Optional[str] = None
    http_proxy: Optional[str] = None


@app.get("/api/config")
async def get_config_endpoint():
    return tts_service.config


@app.post("/api/config")
async def update_config_endpoint(req: ConfigUpdateRequest):
    if req.fpt_api_key is not None:
        tts_service.update_fpt_api_key(req.fpt_api_key)
    if req.http_proxy is not None:
        tts_service.config["http_proxy"] = req.http_proxy.strip()
        tts_service._proxy = req.http_proxy.strip()
    return {"status": "ok", "config": tts_service.config}


@app.get("/api/voices")
async def get_voices():
    return {"voices": tts_service.get_voices()}


@app.post("/api/upload")
async def upload_pdf(file: UploadFile = File(...)):
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Vui lòng chọn file có định dạng .pdf")
    try:
        content = await file.read()
        if not content:
            raise HTTPException(status_code=400, detail="File PDF rỗng.")
        info = pdf_service.register_pdf(file.filename, content)
        return info
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Không thể đọc file PDF: {exc}")


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
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Lỗi trích xuất văn bản: {exc}")


@app.get("/api/doc/{doc_id}/page/{page_number}/image")
async def get_page_image(
    doc_id: str,
    page_number: int,
    dpi: int = Query(170, ge=72, le=300),
    enhance: bool = Query(False),
):
    try:
        png_bytes = pdf_service.render_page_image(
            doc_id, page_number, dpi=dpi, enhance_for_ocr=enhance
        )
        return Response(content=png_bytes, media_type="image/png")
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
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
            text=req.text, voice=req.voice, speed=req.speed
        )
        return FileResponse(
            path=str(mp3_path),
            media_type="audio/mpeg",
            filename="vn_pdf_speech.mp3",
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Lỗi tạo giọng đọc TTS: {exc}")


STATIC_DIR = Path(__file__).parent / "static"
STATIC_DIR.mkdir(parents=True, exist_ok=True)

app.mount("/", StaticFiles(directory=str(STATIC_DIR), html=True), name="static")
