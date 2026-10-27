@echo off
chcp 65001 >nul
title VN PDF Reader - Đọc PDF Tiếng Việt Tự Nhiên
cd /d "%~dp0"

if not exist ".venv\Scripts\python.exe" (
    echo [1/2] Đang khởi tạo môi trường Python lần đầu...
    python -m venv .venv
    .venv\Scripts\pip.exe install -r requirements.txt
)

echo ================================================================
echo   VN PDF READER - CÔNG CỤ ĐỌC PDF TIẾNG VIỆT TỰ NHIÊN
echo   Địa chỉ Web Local: http://127.0.0.1:8788
echo   (Giữ cửa sổ này khi đang nghe, đóng cửa sổ để tắt công cụ)
echo ================================================================

REM Tự động mở trình duyệt sau 1.5 giây
start "" cmd /c "timeout /t 2 >nul & start http://127.0.0.1:8788"

.venv\Scripts\python.exe -m uvicorn src.main:app --host 127.0.0.1 --port 8788 --reload
