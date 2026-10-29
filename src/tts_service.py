import asyncio
import concurrent.futures
import gc
import hashlib
import json
import os
import re
import sys
import threading
import time
import urllib.parse
from pathlib import Path
from typing import Any, Dict, List, Optional

import edge_tts
import httpx
import soundfile as sf

try:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

TTS_CACHE_DIR = Path.home() / ".vn_pdf_reader" / "tts_cache"
TTS_CACHE_DIR.mkdir(parents=True, exist_ok=True)

CONFIG_PATH = Path.home() / ".vn_pdf_reader" / "tts_config.json"

DEFAULT_CONFIG = {
    "fpt_api_key": "cuRd26HHCfSXMMIAOCSQenwd72jUkKI7",
    "http_proxy": "http://10.10.101.208:3128",
}


def load_config() -> dict:
    if CONFIG_PATH.exists():
        try:
            return json.loads(CONFIG_PATH.read_text(encoding="utf-8"))
        except Exception:
            pass
    return dict(DEFAULT_CONFIG)


def save_config(cfg: dict) -> None:
    try:
        CONFIG_PATH.write_text(json.dumps(cfg, indent=2, ensure_ascii=False), encoding="utf-8")
    except Exception as exc:
        print(f"[TTS] Lỗi lưu config: {exc}")


def speed_to_edge_rate(speed: float) -> str:
    pct = int(round((speed - 1.0) * 100))
    if pct >= 0:
        return f"+{pct}%"
    return f"{pct}%"


def compute_hardware_profile(cpu_cores: Optional[int] = None) -> Dict[str, Any]:
    """
    Tự động phân tầng cấu hình phần cứng (Adaptive Hardware Scaling):
    - Máy yếu (<= 4 luồng): Chạy tuần tự 1 worker, chừa 1 nhân cho OS/Browser để không đơ máy.
    - Máy tầm trung (5 - 8 luồng): Tối đa 6 intra-op threads, 2 workers pipeline.
    - Máy mạnh (> 8 luồng): Tối đa 8 intra-op threads (điểm ngọt của ONNX OpenMP), 2 workers pipeline.
    """
    cores = max(1, int(cpu_cores if cpu_cores is not None else (os.cpu_count() or 4)))
    if cores <= 4:
        return {
            "cpu_cores": cores,
            "tier": "low",
            "intra_op_threads": max(1, cores - 1),
            "max_workers": 1,
        }
    if cores <= 8:
        return {
            "cpu_cores": cores,
            "tier": "medium",
            "intra_op_threads": min(6, cores - 1),
            "max_workers": 2,
        }
    return {
        "cpu_cores": cores,
        "tier": "high",
        "intra_op_threads": 8,
        "max_workers": 2,
    }


def _make_cache_key(clean_text: str, voice: str, speed: float) -> str:
    if abs(speed - 1.0) > 0.01:
        return hashlib.md5(f"{voice}|speed_{speed:.2f}|{clean_text}".encode("utf-8")).hexdigest()
    return hashlib.md5(f"{voice}|{clean_text}".encode("utf-8")).hexdigest()


def _strip_mp3_xing_header(raw_mp3: bytes) -> bytes:
    """Loại bỏ Xing/Info VBR header frame ở đầu file MP3 để ghép nối nhiều đoạn mượt mà."""
    if len(raw_mp3) > 256 and (b"Xing" in raw_mp3[:220] or b"Info" in raw_mp3[:220]):
        next_frame = raw_mp3.find(b"\xff\xf3", 4)
        if next_frame == -1:
            next_frame = raw_mp3.find(b"\xff\xfb", 4)
        if 0 < next_frame <= 512:
            return raw_mp3[next_frame:]
    return raw_mp3


AVAILABLE_VOICES: List[Dict[str, str]] = [
    # 1. Nhóm giọng đọc AI Offline Kokoro (14 giọng đọc Sách & Kể chuyện tự nhiên, chạy Offline 100%)
    {
        "id": "kokoro-thanh_dat",
        "name": "Thành Đạt (Nam Truyền Cảm - Kokoro AI ⭐)",
        "provider": "kokoro",
        "lang": "vi",
        "gender": "Male",
    },
    {
        "id": "kokoro-storyvert",
        "name": "Storyvert (Nam Kể Chuyện Sách Đêm Khuya - Kokoro AI ⭐)",
        "provider": "kokoro",
        "lang": "vi",
        "gender": "Male",
    },
    {
        "id": "kokoro-manh_dung",
        "name": "Mạnh Dũng (Nam Trầm Chững Chạc - Kokoro AI ⭐)",
        "provider": "kokoro",
        "lang": "vi",
        "gender": "Male",
    },
    {
        "id": "kokoro-hung_thinh",
        "name": "Hưng Thịnh (Nam Điềm Đạm Đọc Sách - Kokoro AI ⭐)",
        "provider": "kokoro",
        "lang": "vi",
        "gender": "Male",
    },
    {
        "id": "kokoro-phat_tai",
        "name": "Phát Tài (Nam Tự Nhiên Ấm Áp - Kokoro AI ⭐)",
        "provider": "kokoro",
        "lang": "vi",
        "gender": "Male",
    },
    {
        "id": "kokoro-duc_an",
        "name": "Đức An (Nam Nhẹ Nhàng Sâu Lắng - Kokoro AI ⭐)",
        "provider": "kokoro",
        "lang": "vi",
        "gender": "Male",
    },
    {
        "id": "kokoro-duc_duy",
        "name": "Đức Duy (Nam Trẻ Trung Rõ Ràng - Kokoro AI ⭐)",
        "provider": "kokoro",
        "lang": "vi",
        "gender": "Male",
    },
    {
        "id": "kokoro-tuan_ngoc",
        "name": "Tuấn Ngọc (Nam Trầm Ấm - Kokoro AI ⭐)",
        "provider": "kokoro",
        "lang": "vi",
        "gender": "Male",
    },
    {
        "id": "kokoro-diem_trinh",
        "name": "Diễm Trinh (Nữ Dịu Dàng Kể Chuyện - Kokoro AI ⭐)",
        "provider": "kokoro",
        "lang": "vi",
        "gender": "Female",
    },
    {
        "id": "kokoro-ngoc_huyen",
        "name": "Ngọc Huyền (Nữ Truyền Cảm Sâu Lắng - Kokoro AI ⭐)",
        "provider": "kokoro",
        "lang": "vi",
        "gender": "Female",
    },
    {
        "id": "kokoro-mai_linh",
        "name": "Mai Linh (Nữ Trong Trẻo Tự Nhiên - Kokoro AI ⭐)",
        "provider": "kokoro",
        "lang": "vi",
        "gender": "Female",
    },
    {
        "id": "kokoro-my_yen",
        "name": "Mỹ Yến (Nữ Nhẹ Nhàng Êm Ái - Kokoro AI ⭐)",
        "provider": "kokoro",
        "lang": "vi",
        "gender": "Female",
    },
    {
        "id": "kokoro-thuc_trinh",
        "name": "Thục Trinh (Nữ Thanh Lịch Đọc Sách - Kokoro AI ⭐)",
        "provider": "kokoro",
        "lang": "vi",
        "gender": "Female",
    },
    {
        "id": "kokoro-mai_loan",
        "name": "Mai Loan (Nữ Đằm Thắm Cổ Điển - Kokoro AI ⭐)",
        "provider": "kokoro",
        "lang": "vi",
        "gender": "Female",
    },
    # 2. Nhóm giọng đọc Microsoft Edge Neural
    {
        "id": "vi-VN-HoaiMyNeural",
        "name": "Hoài My (Nữ Nam Bộ - Microsoft Edge)",
        "provider": "edge",
        "lang": "vi",
        "gender": "Female",
    },
    {
        "id": "vi-VN-NamMinhNeural",
        "name": "Nam Minh (Nam Bắc Bộ - Microsoft Edge)",
        "provider": "edge",
        "lang": "vi",
        "gender": "Male",
    },
    # Nhóm giọng đọc FPT.AI
    {
        "id": "fpt-banmai",
        "name": "Ban Mai (Nữ Bắc - FPT.AI Truyền Cảm)",
        "provider": "fpt",
        "lang": "vi",
        "gender": "Female",
    },
    {
        "id": "fpt-thuminh",
        "name": "Thu Minh (Nữ Bắc - FPT.AI Dịu Dàng)",
        "provider": "fpt",
        "lang": "vi",
        "gender": "Female",
    },
    {
        "id": "fpt-leminh",
        "name": "Lê Minh (Nam Bắc - FPT.AI Trầm Ấm)",
        "provider": "fpt",
        "lang": "vi",
        "gender": "Male",
    },
    {
        "id": "fpt-lannhi",
        "name": "Lan Nhi (Nữ Nam - FPT.AI Tự Nhiên)",
        "provider": "fpt",
        "lang": "vi",
        "gender": "Female",
    },
    {
        "id": "fpt-myan",
        "name": "Mỹ An (Nữ Trung - FPT.AI)",
        "provider": "fpt",
        "lang": "vi",
        "gender": "Female",
    },
    {
        "id": "fpt-giahuy",
        "name": "Gia Huy (Nam Trung - FPT.AI)",
        "provider": "fpt",
        "lang": "vi",
        "gender": "Male",
    },
    {
        "id": "google-vi-female",
        "name": "Chị Google (Dự phòng)",
        "provider": "google",
        "lang": "vi",
        "gender": "Female",
    },
]


class TTSService:
    def __init__(self):
        self.config = load_config()
        self._proxy = self.config.get("http_proxy") or "http://10.10.101.208:3128"
        self._edge_blocked_until: float = 0.0
        self._fpt_blocked_until: float = 0.0
        self._edge_lock = asyncio.Lock()
        self._kokoro_instances: Dict[str, object] = {}
        self._kokoro_lock = asyncio.Lock()
        self._kokoro_thread_lock = threading.Lock()
        self._phonemizer_lock = threading.Lock()
        self._hw_profile = compute_hardware_profile()
        self._onnx_semaphore = threading.Semaphore(self._hw_profile["max_workers"])
        self._onnx_executor = concurrent.futures.ThreadPoolExecutor(
            max_workers=self._hw_profile["max_workers"]
        )
        self._onnx_session = None
        self._onnx_config: Optional[dict] = None
        self._onnx_voicepacks: Dict[str, object] = {}
        self._vn_normalizer = None
        self._vn_g2p = None
        self._word_phoneme_cache: Dict[str, str] = {}
        self._inflight_tasks: Dict[str, asyncio.Task] = {}
        self._inflight_lock = asyncio.Lock()

    def get_hardware_profile(self) -> Dict[str, Any]:
        return dict(self._hw_profile)

    def get_voices(self) -> List[Dict[str, str]]:
        return AVAILABLE_VOICES

    def update_fpt_api_key(self, api_key: str) -> None:
        self.config["fpt_api_key"] = api_key.strip()
        self._fpt_blocked_until = 0.0
        save_config(self.config)

    async def synthesize_speech(
        self,
        text: str,
        voice: str = "vi-VN-HoaiMyNeural",
        speed: float = 1.0,
        sentences: Optional[List[str]] = None,
    ) -> Path:
        clean = text.strip()
        if not clean:
            raise ValueError("Văn bản cần đọc không được để trống.")

        cache_key = _make_cache_key(clean, voice, speed)
        mp3_path = TTS_CACHE_DIR / f"{cache_key}.mp3"

        if mp3_path.exists() and mp3_path.stat().st_size > 128:
            return mp3_path

        # Chống trùng lặp request (In-Flight Deduplication ở Backend):
        # Nếu cùng một câu + giọng đang được tổng hợp bởi một request khác (ví dụ prefetch),
        # chờ và tái sử dụng ngay kết quả của task đó thay vì xếp hàng chạy lại lần 2!
        async with self._inflight_lock:
            existing_task = self._inflight_tasks.get(cache_key)
            if existing_task is None or existing_task.done():
                existing_task = asyncio.create_task(
                    self._do_synthesize_speech(clean, voice, speed, mp3_path, sentences=sentences)
                )
                self._inflight_tasks[cache_key] = existing_task

        try:
            return await asyncio.shield(existing_task)
        finally:
            if existing_task.done():
                async with self._inflight_lock:
                    if self._inflight_tasks.get(cache_key) is existing_task:
                        self._inflight_tasks.pop(cache_key, None)

    async def _do_synthesize_speech(
        self,
        clean: str,
        voice: str,
        speed: float,
        mp3_path: Path,
        sentences: Optional[List[str]] = None,
    ) -> Path:
        if mp3_path.exists() and mp3_path.stat().st_size > 128:
            return mp3_path

        # Tái sử dụng Cache cấp độ câu (Sentence-Level Cache Reuse):
        # Khi người dùng đã nghe qua một số câu (hoặc cả trang) trên giao diện đọc trực tiếp,
        # các câu đó đã có sẵn file MP3 trong TTS_CACHE_DIR -> ghép trực tiếp không cần chạy lại AI!
        if sentences:
            valid_sents = [s.strip() for s in sentences if s and s.strip()]
            if valid_sents:
                sent_entries = []
                cached_count = 0
                for s in valid_sents:
                    s_key = _make_cache_key(s, voice, speed)
                    s_path = TTS_CACHE_DIR / f"{s_key}.mp3"
                    if s_path.exists() and s_path.stat().st_size > 128:
                        sent_entries.append(("cached", s_path))
                        cached_count += 1
                    else:
                        sent_entries.append(("uncached", s))

                if cached_count > 0:
                    merged_bytes = bytearray()
                    uncached_buf: List[str] = []

                    async def flush_uncached() -> None:
                        if not uncached_buf:
                            return
                        block_text = " ".join(uncached_buf)
                        uncached_buf.clear()
                        sub_key = _make_cache_key(block_text, voice, speed)
                        sub_path = TTS_CACHE_DIR / f"{sub_key}.mp3"
                        await self._synthesize_single_block(block_text, voice, speed, sub_path)
                        if sub_path.exists() and sub_path.stat().st_size > 128:
                            merged_bytes.extend(_strip_mp3_xing_header(sub_path.read_bytes()))

                    for kind, payload in sent_entries:
                        if kind == "cached":
                            await flush_uncached()
                            merged_bytes.extend(_strip_mp3_xing_header(payload.read_bytes()))
                        else:
                            uncached_buf.append(payload)
                    await flush_uncached()

                    if len(merged_bytes) > 128:
                        mp3_path.write_bytes(bytes(merged_bytes))
                        return mp3_path

        return await self._synthesize_single_block(clean, voice, speed, mp3_path)

    async def _synthesize_single_block(
        self, clean: str, voice: str, speed: float, mp3_path: Path
    ) -> Path:
        if mp3_path.exists() and mp3_path.stat().st_size > 128:
            return mp3_path

        # 1. Nếu chọn giọng Kokoro AI (Chạy hoàn toàn cục bộ trên CPU)
        if voice.startswith("kokoro-"):
            kokoro_voice = voice.replace("kokoro-", "")
            try:
                content = await asyncio.to_thread(self._synthesize_kokoro, clean, kokoro_voice, speed)
                if content and len(content) > 1000:
                    mp3_path.write_bytes(content)
                    return mp3_path
            except Exception as exc:
                print(f"[TTS] Kokoro AI gặp lỗi ({exc}), chuyển sang Microsoft Edge Neural...")

        # 2. Nếu chọn giọng FPT.AI
        if voice.startswith("fpt-"):
            if time.time() >= self._fpt_blocked_until:
                fpt_voice_name = voice.replace("fpt-", "")
                fpt_key = self.config.get("fpt_api_key") or DEFAULT_CONFIG["fpt_api_key"]
                try:
                    content = await asyncio.to_thread(self._synthesize_fpt, clean, fpt_voice_name, fpt_key)
                    if content and len(content) > 1000:
                        mp3_path.write_bytes(content)
                        return mp3_path
                except Exception as exc:
                    print(f"[TTS] FPT.AI gặp lỗi ({exc}), tạm khóa FPT 120s và chuyển sang Microsoft Edge Neural...")
                    self._fpt_blocked_until = time.time() + 120.0
            else:
                print(f"[TTS] FPT.AI đang tạm khóa do chạm trần quota, chuyển thẳng sang Microsoft Edge...")

        # 2. Nếu chọn giọng Microsoft Edge hoặc fallback từ FPT
        edge_voice = (
            voice
            if voice.startswith("vi-VN-")
            else "vi-VN-HoaiMyNeural"
        )
        if time.time() >= self._edge_blocked_until:
            try:
                # Tiền xử lý text cho Edge-TTS:
                # 1. Loại bỏ các ký tự dấu câu ngắt dòng ở cuối (, ; - – — . …)
                edge_text = re.sub(r"[\s,;\-–—\.…]+$", "", clean).strip()
                # 2. Nếu câu sau khi strip vẫn có ký tự chữ/số, thêm dấu chấm "." ở cuối
                # Microsoft Speech Neural bắt buộc câu có dấu ngắt hoàn chỉnh (. ? !) để tổng hợp âm thanh,
                # nếu kết thúc bằng dấu phẩy, lửng lơ hoặc không có dấu ngắt, Edge-TTS sẽ trả lỗi NoAudioReceived
                if re.search(r"[\w\d]", edge_text):
                    if not edge_text.endswith((".", "!", "?", ":")):
                        edge_text += "."
                else:
                    edge_text = clean

                rate_str = speed_to_edge_rate(speed)
                # Dùng lock để tuần tự hóa các cuộc gọi Edge-TTS (kể cả prefetch ngầm)
                # Microsoft WebSocket server sẽ chặn NoAudioReceived nếu gửi đồng thời nhiều kết nối cùng IP
                async with self._edge_lock:
                    communicate = edge_tts.Communicate(
                        text=edge_text,
                        voice=edge_voice,
                        rate=rate_str,
                        proxy=self._proxy,
                    )
                    await asyncio.wait_for(communicate.save(str(mp3_path)), timeout=18.0)
                if mp3_path.exists() and mp3_path.stat().st_size > 128:
                    return mp3_path
            except edge_tts.exceptions.NoAudioReceived:
                # Nếu chỉ là do nội dung câu đặc thù không sinh được audio trên Edge,
                # chuyển sang Google fallback cho RIÊNG câu này, TUYỆT ĐỐI KHÔNG block _edge_blocked_until
                print(f"[TTS] Edge-TTS không nhận audio cho câu này ('{clean[:30]}...'), dùng Google fallback cho riêng câu này.")
            except Exception as exc:
                print(f"[TTS] Edge-TTS gặp lỗi mạng ({type(exc).__name__}: {exc}), tạm khóa 5s và chuyển sang Google fallback...")
                self._edge_blocked_until = time.time() + 5.0

        # 3. Fallback cuối cùng: Google Translate TTS
        lang = "vi"
        await asyncio.to_thread(self._google_tts_download, clean, lang, mp3_path)
        return mp3_path

    def _ensure_vn_phonemizer(self) -> None:
        if self._vn_normalizer is None or self._vn_g2p is None:
            from sea_g2p import Normalizer, G2P

            self._vn_normalizer = Normalizer("vi")
            self._vn_g2p = G2P("vi")

    def phonemize_vietnamese_smart(self, text: str) -> str:
        """
        Chuẩn hóa số (1999 -> một nghìn chín trăm chín mươi chín), ngày tháng, % và ký tự đặc biệt
        trên toàn câu trước khi phiên âm; đồng thời neo ngữ cảnh tiếng Việt ('ạ ') cho từng từ
        không dấu (do, to, so, no, may, ban...) để tránh bị sea_g2p đọc nhầm sang tiếng Anh ('do' -> 'đu').
        """
        with self._phonemizer_lock:
            self._ensure_vn_phonemizer()
            from vig2p.core import fix_phonemes, WORD_RE

            cleaned = text
            cleaned = re.sub(r"(\d)\s*\$", r"\1 đô la", cleaned)
            cleaned = re.sub(r"\$\s*(\d)", r"\1 đô la", cleaned)
            cleaned = re.sub(r"(\d)\s*€", r"\1 ơ rô", cleaned)
            cleaned = re.sub(r"(\d)\s*¥", r"\1 yên", cleaned)
            cleaned = cleaned.replace("&", " và ")
            cleaned = cleaned.replace("°C", " độ xê ")
            cleaned = cleaned.replace("°F", " độ ép ")
            cleaned = cleaned.replace("km/h", " ki lô mét trên giờ ")
            cleaned = cleaned.replace("m²", " mét vuông ").replace("m2", " mét vuông ")
            cleaned = cleaned.replace("m³", " mét khối ").replace("m3", " mét khối ")

            normalized = self._vn_normalizer.normalize(cleaned)

            digit_map = {
                "0": " không ",
                "1": " một ",
                "2": " hai ",
                "3": " ba ",
                "4": " bốn ",
                "5": " năm ",
                "6": " sáu ",
                "7": " bảy ",
                "8": " tám ",
                "9": " chín ",
            }
            normalized = re.sub(r"\d", lambda m: digit_map.get(m.group(0), " "), normalized)

            en_block_re = re.compile(r"(<en>.*?</en>)", re.IGNORECASE | re.DOTALL)
            token_re = re.compile(r"[A-Za-zÀ-ỹĐđ]+(?:[-'][A-Za-zÀ-ỹĐđ]+)*|\s+|.", re.UNICODE)

            out: List[str] = []
            for part in en_block_re.split(normalized):
                if not part:
                    continue
                if part.lower().startswith("<en>") and part.lower().endswith("</en>"):
                    raw_en = self._vn_g2p.convert(part)
                    out.append(fix_phonemes(raw_en))
                    continue

                for tok in token_re.findall(part):
                    if tok.isspace():
                        out.append(" ")
                    elif WORD_RE.match(tok):
                        cached_ph = self._word_phoneme_cache.get(tok)
                        if cached_ph is None:
                            raw_vi = self._vn_g2p.convert("ạ " + tok)
                            vi_phoneme = raw_vi.split(" ", 1)[1] if " " in raw_vi else raw_vi
                            cached_ph = fix_phonemes(vi_phoneme, source_text=tok)
                            if len(self._word_phoneme_cache) > 16384:
                                self._word_phoneme_cache.clear()
                            self._word_phoneme_cache[tok] = cached_ph
                        out.append(cached_ph)
                    elif tok in ".,!?;:—…\"()[]":
                        out.append(fix_phonemes(tok))

            return re.sub(r"\s+", " ", "".join(out)).strip()

    def _ensure_onnx_engine(self, voice_name: str):
        """Khởi tạo phiên chạy ONNX Runtime siêu nhẹ (~390MB RAM, không cần nạp PyTorch vào RAM)."""
        import numpy as np
        import onnxruntime as ort
        from kokoro_vietnamese.core import (
            DEFAULT_CONFIG_FILE,
            DEFAULT_HF_REPO_ID,
            DEFAULT_ONNX_FILE,
            _download_or_resolve,
            resolve_voicepack_filename,
        )
        from kokoro_vietnamese.onnx_utils import load_config

        with self._kokoro_thread_lock:
            if self._onnx_session is None or self._onnx_config is None:
                os.environ["HF_HUB_OFFLINE"] = "1"
                try:
                    onnx_path = _download_or_resolve(DEFAULT_HF_REPO_ID, DEFAULT_ONNX_FILE, None)
                    config_path = _download_or_resolve(DEFAULT_HF_REPO_ID, DEFAULT_CONFIG_FILE, None)
                except Exception:
                    os.environ.pop("HF_HUB_OFFLINE", None)
                    if self._proxy:
                        os.environ["HTTP_PROXY"] = self._proxy
                        os.environ["HTTPS_PROXY"] = self._proxy
                    onnx_path = _download_or_resolve(DEFAULT_HF_REPO_ID, DEFAULT_ONNX_FILE, None)
                    config_path = _download_or_resolve(DEFAULT_HF_REPO_ID, DEFAULT_CONFIG_FILE, None)
                    os.environ["HF_HUB_OFFLINE"] = "1"

                self._onnx_config = load_config(config_path)
                sess_opts = ort.SessionOptions()
                sess_opts.intra_op_num_threads = self._hw_profile["intra_op_threads"]
                sess_opts.inter_op_num_threads = 1
                sess_opts.enable_cpu_mem_arena = True
                sess_opts.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_ALL
                self._onnx_session = ort.InferenceSession(
                    str(onnx_path),
                    sess_options=sess_opts,
                    providers=["CPUExecutionProvider"],
                )

            if voice_name not in self._onnx_voicepacks:
                npy_dir = Path.home() / ".vn_pdf_reader" / "voicepacks"
                npy_dir.mkdir(parents=True, exist_ok=True)
                npy_path = npy_dir / f"{voice_name}.npy"
                if not npy_path.exists():
                    import torch

                    vp_rel = resolve_voicepack_filename(voice_name, None)
                    pt_path = _download_or_resolve(DEFAULT_HF_REPO_ID, vp_rel, vp_rel)
                    tensor = torch.load(pt_path, map_location="cpu", weights_only=True)
                    arr = tensor.detach().cpu().numpy().astype(np.float32)
                    np.save(npy_path, arr)
                    del tensor

                if len(self._onnx_voicepacks) >= 4:
                    oldest_key = next(iter(self._onnx_voicepacks))
                    self._onnx_voicepacks.pop(oldest_key, None)
                self._onnx_voicepacks[voice_name] = np.load(npy_path)

            return self._onnx_session, self._onnx_config, self._onnx_voicepacks[voice_name]

    def pack_phoneme_segments(self, text: str, max_packed_len: int = 400) -> List[str]:
        """
        Phiên âm từng câu và gộp (pack) các câu ngắn liên tiếp thành từng cụm tối ưu (~400 phonemes).
        Giúp giảm ~75% số lần gọi ONNX session.run() trên mỗi trang sách mà vẫn giữ nguyên ngắt nghỉ dấu câu.
        """
        from kokoro_vietnamese.core import split_text

        raw_segments: List[str] = []
        for text_chunk in split_text(text):
            ps = self.phonemize_vietnamese_smart(text_chunk)
            if not ps:
                continue
            if len(ps) <= 460:
                raw_segments.append(ps)
            else:
                words = ps.split(" ")
                cur = ""
                for w in words:
                    if len(cur) + len(w) + 1 <= 460:
                        cur = f"{cur} {w}".strip() if cur else w
                    else:
                        if cur:
                            raw_segments.append(cur)
                        cur = w
                if cur:
                    raw_segments.append(cur)

        packed: List[str] = []
        cur_pack = ""
        for seg in raw_segments:
            if not cur_pack:
                cur_pack = seg
            elif len(cur_pack) + len(seg) + 1 <= max_packed_len:
                cur_pack = f"{cur_pack} {seg}"
            else:
                packed.append(cur_pack)
                cur_pack = seg
        if cur_pack:
            packed.append(cur_pack)
        return packed

    def _synthesize_kokoro(self, text: str, voice_name: str, speed: float = 1.0) -> bytes:
        """Tổng hợp giọng đọc bằng mô hình Kokoro-Vietnamese ONNX Runtime + Smart Phonemizer + Adaptive Scaling."""
        import io
        import numpy as np
        from kokoro_vietnamese.core import (
            DEFAULT_CROSSFADE_MS,
            SAMPLE_RATE,
            merge_audio_chunks,
        )
        from kokoro_vietnamese.onnx_utils import (
            phonemes_to_input_ids,
            select_voice_style,
            speed_input,
        )

        session, config, voicepack = self._ensure_onnx_engine(voice_name)
        vocab = config["vocab"]
        context_length = config["plbert"]["max_position_embeddings"]
        speed_val = speed_input(max(0.5, min(2.5, float(speed or 1.0))))

        packed_segments = self.pack_phoneme_segments(text, max_packed_len=420)
        if not packed_segments:
            return b""

        audio_chunks: List[np.ndarray] = []
        for seg in packed_segments:
            input_ids = phonemes_to_input_ids(seg, vocab, context_length=context_length)
            if input_ids.shape[1] <= 2:
                continue
            ref_s = select_voice_style(voicepack, len(seg))
            # Khóa từng bước session.run() để tránh tranh chấp OpenMP/BFCArena giữa các luồng,
            # đồng thời cho phép câu đọc trực tiếp (Live Reading) chen ngang ngay giữa các cụm 420 phonemes!
            with self._kokoro_thread_lock:
                waveform, _ = session.run(
                    None,
                    {
                        "input_ids": input_ids,
                        "ref_s": ref_s,
                        "speed": speed_val,
                    },
                )
            audio_chunks.append(np.asarray(waveform, dtype=np.float32).reshape(-1))

        if not audio_chunks:
            return b""

        crossfade_samples = round(SAMPLE_RATE * int(DEFAULT_CROSSFADE_MS) / 1000)
        audio = merge_audio_chunks(audio_chunks, crossfade_samples)

        buf = io.BytesIO()
        try:
            sf.write(buf, audio, SAMPLE_RATE, format="MP3")
            return _strip_mp3_xing_header(buf.getvalue())
        except Exception:
            buf = io.BytesIO()
            sf.write(buf, audio, SAMPLE_RATE, format="WAV")
            return buf.getvalue()

    def _synthesize_fpt(self, text: str, voice_name: str, api_key: str) -> bytes:
        """Gọi FPT.AI API v5 để sinh giọng đọc chất lượng cao."""
        url = "https://api.fpt.ai/hmi/tts/v5"
        headers = {
            "api-key": api_key,
            "api_key": api_key,
            "voice": voice_name,
            "speed": "0",
        }

        # Gọi request tạo âm thanh (thử tối đa 2 lần nếu gặp rate limit tạm thời)
        async_url = None
        for attempt in range(2):
            try:
                with httpx.Client(proxy=self._proxy, timeout=12.0) as client:
                    resp = client.post(url, headers=headers, content=text.encode("utf-8"))
                    data = resp.json()
                    if data.get("error") == 0 and "async" in data:
                        async_url = data["async"]
                        break
                    elif resp.status_code == 429 or "rate limit" in str(data).lower():
                        raise RuntimeError("Hạn mức FPT.AI bị giới hạn (Rate limit hoặc hết quota tài khoản Free)")
                    else:
                        raise RuntimeError(f"FPT.AI lỗi: {data.get('message')}")
            except Exception as e:
                if attempt == 1 or "Hạn mức" in str(e):
                    raise e
                time.sleep(1.0)

        if not async_url:
            raise RuntimeError("FPT.AI không trả về link âm thanh.")

        # Polling để tải file MP3 khi FPT.AI tổng hợp xong (thường 0.6s - 2s)
        for _ in range(12):
            time.sleep(0.6)
            try:
                with httpx.Client(proxy=self._proxy, timeout=8.0) as dl_client:
                    dl_resp = dl_client.get(async_url)
                    if dl_resp.status_code == 200 and len(dl_resp.content) > 1000:
                        return dl_resp.content
            except Exception:
                continue

        raise TimeoutError("Quá thời gian chờ FPT.AI tạo file âm thanh.")

    def _google_tts_download(self, text: str, lang: str, output_path: Path) -> None:
        words = text.split()
        chunks: List[str] = []
        current = ""
        for w in words:
            if len(current) + len(w) + 1 <= 190:
                current = f"{current} {w}".strip() if current else w
            else:
                if current:
                    chunks.append(current)
                current = w
        if current:
            chunks.append(current)

        audio_bytes = bytearray()
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
        }

        with httpx.Client(proxy=self._proxy, timeout=10.0) as client:
            if len(chunks) <= 1:
                for chunk in chunks:
                    encoded_q = urllib.parse.quote(chunk)
                    url = (
                        f"https://translate.google.com/translate_tts?ie=UTF-8"
                        f"&tl={lang}&client=tw-ob&q={encoded_q}"
                    )
                    resp = client.get(url, headers=headers)
                    if resp.status_code == 200:
                        audio_bytes.extend(resp.content)
            else:
                def _fetch_chunk(chunk_str: str) -> bytes:
                    encoded_q = urllib.parse.quote(chunk_str)
                    url = (
                        f"https://translate.google.com/translate_tts?ie=UTF-8"
                        f"&tl={lang}&client=tw-ob&q={encoded_q}"
                    )
                    resp = client.get(url, headers=headers)
                    return resp.content if resp.status_code == 200 else b""

                with concurrent.futures.ThreadPoolExecutor(max_workers=min(4, len(chunks))) as pool:
                    for part_bytes in pool.map(_fetch_chunk, chunks):
                        if part_bytes:
                            audio_bytes.extend(part_bytes)

        output_path.write_bytes(bytes(audio_bytes))


tts_service = TTSService()
