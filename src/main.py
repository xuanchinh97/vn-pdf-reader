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

from src.pdf_service import pdf_service
from src.tts_service import tts_service
from src.vn_text_processor import process_vietnamese_pdf_text

app = FastAPI(
    title="VN PDF Reader & Natural TTS",
    description="Công cụ đọc PDF Tiếng Việt thông minh (Sửa lỗi font TCVN3/VNI, Quét OCR & Giọng đọc AI tự nhiên)",
    version="1.3.0",
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


class ConfigUpdateRequest(BaseModel):
    fpt_api_key: Optional[str] = None
    http_proxy: Optional[str] = None


class AnnotationsPayload(BaseModel):
    bookmarks: Optional[List[Any]] = []
    highlights: Optional[List[Any]] = []


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


@app.get("/api/doc/{doc_id}/toc")
async def get_doc_toc(doc_id: str):
    try:
        toc = pdf_service.extract_toc(doc_id)
        return {"doc_id": doc_id, "toc": toc}
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Lỗi trích xuất mục lục: {exc}")


@app.get("/api/doc/{doc_id}/pages")
async def get_doc_pages_overview(doc_id: str):
    try:
        pages = pdf_service.get_pages_overview(doc_id)
        return {"doc_id": doc_id, "pages": pages, "total": len(pages)}
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Lỗi đọc danh sách trang: {exc}")


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


OFFLINE_DICTIONARY = {
    "sách": {
        "word": "sách",
        "found": True,
        "meanings": [
            {
                "pos": "Danh từ",
                "definitions": [
                    "Tập hợp một số lượng nhất định những tờ giấy có chữ in hay viết, được đóng gộp lại thành quyển.",
                    "Công trình trước tác hoặc dịch thuật ghi chép tri thức, nghệ thuật."
                ]
            }
        ],
        "source": "Từ điển Tiếng Việt"
    },
    "đọc": {
        "word": "đọc",
        "found": True,
        "meanings": [
            {
                "pos": "Động từ",
                "definitions": [
                    "Phát âm thành tiếng hoặc nhận biết và hiểu nội dung của những chữ viết, câu văn.",
                    "Theo dõi và tiếp nhận thông tin từ tài liệu, ấn phẩm."
                ]
            }
        ],
        "source": "Từ điển Tiếng Việt"
    },
    "học": {
        "word": "học",
        "found": True,
        "meanings": [
            {
                "pos": "Động từ",
                "definitions": [
                    "Tiếp thu kiến thức, rèn luyện kỹ năng do người khác truyền lại hoặc tự mình rút ra.",
                    "Luyện tập để hiểu biết và làm được việc gì đó."
                ]
            }
        ],
        "source": "Từ điển Tiếng Việt"
    },
    "tri thức": {
        "word": "tri thức",
        "found": True,
        "meanings": [
            {
                "pos": "Danh từ",
                "definitions": [
                    "Những hiểu biết, kiến thức mà con người tích lũy được qua học tập, nghiên cứu và thực tiễn.",
                    "Hệ thống các thông tin, kỹ năng và quy luật về thế giới tự nhiên, xã hội."
                ]
            }
        ],
        "source": "Từ điển Tiếng Việt"
    },
    "trí tuệ": {
        "word": "trí tuệ",
        "found": True,
        "meanings": [
            {
                "pos": "Danh từ",
                "definitions": [
                    "Khả năng nhận thức, tư duy trừu tượng, phán đoán và giải quyết vấn đề của con người.",
                    "Năng lực hiểu biết sâu sắc và sáng tạo."
                ]
            }
        ],
        "source": "Từ điển Tiếng Việt"
    },
    "thời gian": {
        "word": "thời gian",
        "found": True,
        "meanings": [
            {
                "pos": "Danh từ",
                "definitions": [
                    "Hình thức tồn tại cơ bản của vật chất biểu hiện độ dài kế tiếp nhau của các sự kiện, quá trình.",
                    "Khoảng tiếp diễn từ quá khứ, hiện tại đến tương lai."
                ]
            }
        ],
        "source": "Từ điển Tiếng Việt"
    },
    "hạnh phúc": {
        "word": "hạnh phúc",
        "found": True,
        "meanings": [
            {
                "pos": "Danh từ / Tính từ",
                "definitions": [
                    "Trạng thái sung sướng, toại nguyện sâu sắc khi đạt được những mong muốn, khát vọng.",
                    "Cảm giác vui vẻ, ấm êm và bình yên trong tâm hồn."
                ]
            }
        ],
        "source": "Từ điển Tiếng Việt"
    },
    "công nghệ": {
        "word": "công nghệ",
        "found": True,
        "meanings": [
            {
                "pos": "Danh từ",
                "definitions": [
                    "Tập hợp các phương pháp, quy trình, kỹ năng và công cụ dùng để sản xuất hoặc giải quyết công việc.",
                    "Khoa học ứng dụng các thành tựu kỹ thuật vào thực tiễn đời sống."
                ]
            }
        ],
        "source": "Từ điển Tiếng Việt"
    },
    "người": {
        "word": "người",
        "found": True,
        "meanings": [
            {
                "pos": "Danh từ",
                "definitions": [
                    "Sinh vật bậc cao nhất có tư duy, ngôn ngữ và khả năng chế tạo, sử dụng công cụ lao động.",
                    "Cá nhân trong cộng đồng xã hội loài người."
                ]
            }
        ],
        "source": "Từ điển Tiếng Việt"
    },
    "ý nghĩa": {
        "word": "ý nghĩa",
        "found": True,
        "meanings": [
            {
                "pos": "Danh từ",
                "definitions": [
                    "Nội dung, tư tưởng hàm chứa trong một lời nói, cử chỉ, hiện tượng hoặc tác phẩm.",
                    "Giá trị, tác dụng tích cực của sự vật, hành động đối với đời sống."
                ]
            }
        ],
        "source": "Từ điển Tiếng Việt"
    },
    "cuộc sống": {
        "word": "cuộc sống",
        "found": True,
        "meanings": [
            {
                "pos": "Danh từ",
                "definitions": [
                    "Toàn bộ những hoạt động, trải nghiệm trong quá trình tồn tại và phát triển của con người.",
                    "Sinh hoạt xã hội và cá nhân thường nhật."
                ]
            }
        ],
        "source": "Từ điển Tiếng Việt"
    },
    "tình yêu": {
        "word": "tình yêu",
        "found": True,
        "meanings": [
            {
                "pos": "Danh từ",
                "definitions": [
                    "Tình cảm gắn bó tha thiết, sâu sắc giữa người với người.",
                    "Cảm xúc yêu thương, quý trọng đặc biệt."
                ]
            }
        ],
        "source": "Từ điển Tiếng Việt"
    },
    "bạn bè": {
        "word": "bạn bè",
        "found": True,
        "meanings": [
            {
                "pos": "Danh từ",
                "definitions": [
                    "Những người có quan hệ gắn bó, thân thiết, có sự đồng cảm và tin cậy lẫn nhau.",
                    "Mối quan hệ bạn bè thân thiết."
                ]
            }
        ],
        "source": "Từ điển Tiếng Việt"
    },
    "việt nam": {
        "word": "việt nam",
        "found": True,
        "meanings": [
            {
                "pos": "Danh từ riêng",
                "definitions": [
                    "Quốc gia độc lập, có chủ quyền nằm ở bán đảo Đông Dương thuộc khu vực Đông Nam Á, thủ đô là Hà Nội."
                ]
            }
        ],
        "source": "Từ điển Tiếng Việt"
    },
    "ngôn ngữ": {
        "word": "ngôn ngữ",
        "found": True,
        "meanings": [
            {
                "pos": "Danh từ",
                "definitions": [
                    "Hệ thống các ký hiệu âm thanh và chữ viết làm phương tiện giao tiếp và tư duy của con người."
                ]
            }
        ],
        "source": "Từ điển Tiếng Việt"
    },
    "tự do": {
        "word": "tự do",
        "found": True,
        "meanings": [
            {
                "pos": "Danh từ / Tính từ",
                "definitions": [
                    "Trạng thái không bị ràng buộc, kiềm chế, được tự quyết định hành vi theo ý chí của mình trong khuôn khổ đạo đức và pháp luật."
                ]
            }
        ],
        "source": "Từ điển Tiếng Việt"
    },
    "hòa bình": {
        "word": "hòa bình",
        "found": True,
        "meanings": [
            {
                "pos": "Danh từ",
                "definitions": [
                    "Tình trạng không có chiến tranh, xung đột vũ trang; trạng thái yên ổn, hữu nghị giữa các quốc gia, dân tộc."
                ]
            }
        ],
        "source": "Từ điển Tiếng Việt"
    },
    "thành công": {
        "word": "thành công",
        "found": True,
        "meanings": [
            {
                "pos": "Động từ / Danh từ",
                "definitions": [
                    "Đạt được kết quả tốt đẹp, như ý muốn sau quá trình nỗ lực, cố gắng."
                ]
            }
        ],
        "source": "Từ điển Tiếng Việt"
    },
    "khoa học": {
        "word": "khoa học",
        "found": True,
        "meanings": [
            {
                "pos": "Danh từ",
                "definitions": [
                    "Hệ thống tri thức về các quy luật của tự nhiên, xã hội và tư duy, được hình thành và tích lũy qua thực tiễn lịch sử."
                ]
            }
        ],
        "source": "Từ điển Tiếng Việt"
    },
    "văn hóa": {
        "word": "văn hóa",
        "found": True,
        "meanings": [
            {
                "pos": "Danh từ",
                "definitions": [
                    "Tổng thể các giá trị vật chất và tinh thần do con người sáng tạo ra trong quá trình lịch sử."
                ]
            }
        ],
        "source": "Từ điển Tiếng Việt"
    },
    "tâm hồn": {
        "word": "tâm hồn",
        "found": True,
        "meanings": [
            {
                "pos": "Danh từ",
                "definitions": [
                    "Đời sống nội tâm, tình cảm và cảm xúc sâu kín của con người.",
                    "Thế giới tinh thần và phẩm chất đạo đức bên trong mỗi cá nhân."
                ]
            }
        ],
        "source": "Từ điển Tiếng Việt"
    },
    "gia đình": {
        "word": "gia đình",
        "found": True,
        "meanings": [
            {
                "pos": "Danh từ",
                "definitions": [
                    "Tập hợp những người gắn bó với nhau do quan hệ hôn nhân, huyết thống hoặc nuôi dưỡng.",
                    "Tổ ấm và tế bào cơ bản của xã hội."
                ]
            }
        ],
        "source": "Từ điển Tiếng Việt"
    },
    "xã hội": {
        "word": "xã hội",
        "found": True,
        "meanings": [
            {
                "pos": "Danh từ",
                "definitions": [
                    "Cộng đồng người cùng chung sống và quan hệ với nhau trong những điều kiện lịch sử nhất định.",
                    "Toàn bộ các mối quan hệ giữa người với người trong một tổ chức cộng đồng."
                ]
            }
        ],
        "source": "Từ điển Tiếng Việt"
    },
    "tương lai": {
        "word": "tương lai",
        "found": True,
        "meanings": [
            {
                "pos": "Danh từ",
                "definitions": [
                    "Khoảng thời gian về sau, những gì sẽ xảy ra tiếp theo trong cuộc đời hoặc lịch sử.",
                    "Triển vọng tốt đẹp phía trước."
                ]
            }
        ],
        "source": "Từ điển Tiếng Việt"
    },
    "quá khứ": {
        "word": "quá khứ",
        "found": True,
        "meanings": [
            {
                "pos": "Danh từ",
                "definitions": [
                    "Khoảng thời gian đã qua đi, những sự việc, biến cố đã diễn ra trước hiện tại."
                ]
            }
        ],
        "source": "Từ điển Tiếng Việt"
    },
    "hiện tại": {
        "word": "hiện tại",
        "found": True,
        "meanings": [
            {
                "pos": "Danh từ",
                "definitions": [
                    "Khoảng thời gian đang diễn ra ngay lúc này, đối lập với quá khứ và tương lai."
                ]
            }
        ],
        "source": "Từ điển Tiếng Việt"
    },
    "lý tưởng": {
        "word": "lý tưởng",
        "found": True,
        "meanings": [
            {
                "pos": "Danh từ / Tính từ",
                "definitions": [
                    "Mục đích cao đẹp, hoàn mỹ mà con người hướng tới và phấn đấu đạt được.",
                    "Đạt đến mức độ mẫu mực, hoàn hảo nhất."
                ]
            }
        ],
        "source": "Từ điển Tiếng Việt"
    },
    "ước mơ": {
        "word": "ước mơ",
        "found": True,
        "meanings": [
            {
                "pos": "Danh từ / Động từ",
                "definitions": [
                    "Khát khao, mong muốn tha thiết về những điều tốt đẹp trong tương lai."
                ]
            }
        ],
        "source": "Từ điển Tiếng Việt"
    },
    "hy vọng": {
        "word": "hy vọng",
        "found": True,
        "meanings": [
            {
                "pos": "Động từ / Danh từ",
                "definitions": [
                    "Niềm tin và sự mong đợi vào những điều may mắn, tốt lành sẽ đến."
                ]
            }
        ],
        "source": "Từ điển Tiếng Việt"
    },
    "niềm tin": {
        "word": "niềm tin",
        "found": True,
        "meanings": [
            {
                "pos": "Danh từ",
                "definitions": [
                    "Sự tin tưởng vững chắc vào một chân lý, giá trị hay vào chính bản thân mình."
                ]
            }
        ],
        "source": "Từ điển Tiếng Việt"
    },
    "đạo đức": {
        "word": "đạo đức",
        "found": True,
        "meanings": [
            {
                "pos": "Danh từ",
                "definitions": [
                    "Hệ thống các quy tắc, chuẩn mực hành vi điều chỉnh mối quan hệ giữa người với người và với xã hội."
                ]
            }
        ],
        "source": "Từ điển Tiếng Việt"
    },
    "sáng tạo": {
        "word": "sáng tạo",
        "found": True,
        "meanings": [
            {
                "pos": "Động từ / Tính từ",
                "definitions": [
                    "Khả năng tìm ra cái mới, độc đáo và có giá trị thiết thực trong nhận thức hoặc hành động."
                ]
            }
        ],
        "source": "Từ điển Tiếng Việt"
    },
    "bình yên": {
        "word": "bình yên",
        "found": True,
        "meanings": [
            {
                "pos": "Tính từ",
                "definitions": [
                    "Trạng thái thanh thản, tĩnh lặng trong tâm hồn, không gặp phải sóng gió, hoạn nạn hay lo âu."
                ]
            }
        ],
        "source": "Từ điển Tiếng Việt"
    },
    "chân lý": {
        "word": "chân lý",
        "found": True,
        "meanings": [
            {
                "pos": "Danh từ",
                "definitions": [
                    "Những nhận thức đúng đắn, phản ánh chính xác thực tại khách quan và được thực tiễn kiểm nghiệm."
                ]
            }
        ],
        "source": "Từ điển Tiếng Việt"
    },
    "dũng cảm": {
        "word": "dũng cảm",
        "found": True,
        "meanings": [
            {
                "pos": "Tính từ",
                "definitions": [
                    "Khí phách dám đối mặt với khó khăn, hiểm nguy để bảo vệ lẽ phải và làm điều đúng đắn."
                ]
            }
        ],
        "source": "Từ điển Tiếng Việt"
    },
    "kiên trì": {
        "word": "kiên trì",
        "found": True,
        "meanings": [
            {
                "pos": "Tính từ / Động từ",
                "definitions": [
                    "Bền bỉ, nhẫn nại tiếp tục hành động theo mục tiêu đã định dù gặp nhiều trở ngại."
                ]
            }
        ],
        "source": "Từ điển Tiếng Việt"
    },
    "yêu thương": {
        "word": "yêu thương",
        "found": True,
        "meanings": [
            {
                "pos": "Động từ / Danh từ",
                "definitions": [
                    "Tình cảm gắn bó thiết tha, luôn quan tâm, chăm sóc và mong muốn điều tốt đẹp nhất cho người khác."
                ]
            }
        ],
        "source": "Từ điển Tiếng Việt"
    },
}

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
    # 1. Kiểm tra từ điển có sẵn trong bộ nhớ
    if w_clean in OFFLINE_DICTIONARY:
        return OFFLINE_DICTIONARY[w_clean]

    # 2. Thử gọi Wiktionary Tiếng Việt qua proxy công ty hoặc trực tiếp
    proxy = tts_service._proxy or "http://10.101.101.208:3128"
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


STATIC_DIR = Path(__file__).parent / "static"
STATIC_DIR.mkdir(parents=True, exist_ok=True)

app.mount("/", StaticFiles(directory=str(STATIC_DIR), html=True), name="static")
