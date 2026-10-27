import asyncio
import hashlib
import json
import os
import re
import sys
import time
import urllib.parse
from pathlib import Path
from typing import Dict, List, Optional

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


AVAILABLE_VOICES: List[Dict[str, str]] = [
    # 1. Nhóm giọng đọc AI Offline Kokoro (Chất lượng cao, Tự nhiên, Trầm ấm, Không lo mạng/proxy)
    {
        "id": "kokoro-thanh_dat",
        "name": "Thành Đạt (Nam Truyền Cảm - Kokoro AI ⭐)",
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
        "name": "Diễm Trinh (Nữ Dịu Dàng - Kokoro AI ⭐)",
        "provider": "kokoro",
        "lang": "vi",
        "gender": "Female",
    },
    {
        "id": "kokoro-mai_linh",
        "name": "Mai Linh (Nữ Trong Trẻo - Kokoro AI ⭐)",
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

    def get_voices(self) -> List[Dict[str, str]]:
        return AVAILABLE_VOICES

    def update_fpt_api_key(self, api_key: str) -> None:
        self.config["fpt_api_key"] = api_key.strip()
        self._fpt_blocked_until = 0.0
        save_config(self.config)

    async def synthesize_speech(
        self, text: str, voice: str = "vi-VN-HoaiMyNeural", speed: float = 1.0
    ) -> Path:
        clean = text.strip()
        if not clean:
            raise ValueError("Văn bản cần đọc không được để trống.")

        if abs(speed - 1.0) > 0.01:
            cache_key = hashlib.md5(f"{voice}|speed_{speed:.2f}|{clean}".encode("utf-8")).hexdigest()
        else:
            cache_key = hashlib.md5(f"{voice}|{clean}".encode("utf-8")).hexdigest()
        mp3_path = TTS_CACHE_DIR / f"{cache_key}.mp3"

        if mp3_path.exists() and mp3_path.stat().st_size > 128:
            return mp3_path

        # 1. Nếu chọn giọng Kokoro AI (Chạy hoàn toàn cục bộ trên CPU)
        if voice.startswith("kokoro-"):
            kokoro_voice = voice.replace("kokoro-", "")
            try:
                content = await asyncio.to_thread(self._synthesize_kokoro, clean, kokoro_voice)
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

    def _synthesize_kokoro(self, text: str, voice_name: str) -> bytes:
        """Tổng hợp giọng đọc bằng mô hình AI cục bộ Kokoro-Vietnamese."""
        os.environ["HF_HUB_OFFLINE"] = "1"
        from kokoro_vietnamese import KokoroVietnamese
        import io

        if voice_name not in self._kokoro_instances:
            self._kokoro_instances[voice_name] = KokoroVietnamese(device="cpu", voice=voice_name)

        tts = self._kokoro_instances[voice_name]
        audio, _ = tts.synthesize(text)
        
        # Ghi sang định dạng MP3 (hoặc WAV nếu MP3 không hỗ trợ)
        buf = io.BytesIO()
        try:
            sf.write(buf, audio, 24000, format="MP3")
        except Exception:
            buf = io.BytesIO()
            sf.write(buf, audio, 24000, format="WAV")
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
        proxy_mounts = {"http://": self._proxy, "https://": self._proxy} if self._proxy else None

        with httpx.Client(proxy=self._proxy, timeout=10.0) as client:
            for chunk in chunks:
                encoded_q = urllib.parse.quote(chunk)
                url = (
                    f"https://translate.google.com/translate_tts?ie=UTF-8"
                    f"&tl={lang}&client=tw-ob&q={encoded_q}"
                )
                headers = {
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
                }
                resp = client.get(url, headers=headers)
                if resp.status_code == 200:
                    audio_bytes.extend(resp.content)

        output_path.write_bytes(bytes(audio_bytes))


tts_service = TTSService()
