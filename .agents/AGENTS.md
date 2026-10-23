# ĐỘI NGŨ SUBAGENTS CHUYÊN BIỆT — DỰ ÁN VN PDF READER

Dự án được phân chia trách nhiệm rõ ràng cho **5 Subagents chuyên biệt**, khép kín toàn bộ chu trình từ thiết kế trải nghiệm, phát triển fullstack, kiểm thử tự động đến thẩm định mã nguồn:

```
                               ┌────────────────────────┐
                               │    Orchestrator Agent  │
                               └───────────┬────────────┘
                                           │
         ┌───────────────────┬─────────────┴─────────────┬───────────────────┐
         ▼                   ▼                           ▼                   ▼
┌──────────────────┐┌──────────────────┐   ┌──────────────────┐┌──────────────────┐
│uiux-designer-agent│backend-data-agent│   │frontend-ui-agent ││  qa-test-agent   │
│  UX, Typography  ││ FastAPI, Python  │   │  HTML, CSS, JS   ││  Pytest, E2E     │
│  Design Tokens   ││ Text & TTS Core  │   │  Audio & Web UX  ││  Quality Checks  │
└────────┬─────────┘└────────┬─────────┘   └────────┬─────────┘└────────┬─────────┘
         │                   │                      │                   │
         └───────────────────┴──────────┬───────────┴───────────────────┘
                                        ▼
                            ┌───────────────────────┐
                            │  code-reviewer-agent  │
                            │  Audit, Security, QA  │
                            └───────────────────────┘
```

---

## 1. Danh sách 5 Subagents

| Tên Subagent | Vai trò chính | Phạm vi tệp phụ trách |
| :--- | :--- | :--- |
| **`uiux-designer-agent`** | Thiết kế UI/UX & Design System | Nghiên cứu trải nghiệm đọc, Typography, bảng màu (Dark/Light/Sepia), CSS design tokens, trạng thái audio player, bố cục split-pane |
| **`backend-data-agent`** | Xử lý dữ liệu & API Backend | `src/main.py`, `src/pdf_service.py`, `src/vn_text_processor.py`, `src/tts_service.py` |
| **`frontend-ui-agent`** | Hiện thực Giao diện & Tương tác Web | `src/static/index.html`, `src/static/styles.css`, `src/static/app.js` |
| **`qa-test-agent`** | Tự động hóa kiểm thử & Báo cáo QA | `tests/`, `pytest.ini`, `TEST_REPORT.md` |
| **`code-reviewer-agent`** | Thẩm định kỹ thuật & Review mã nguồn | Toàn bộ codebase (Python & Frontend), kiểm tra bảo mật, hiệu năng, chuẩn kiến trúc |

---

## 2. Quy trình cộng tác chuẩn (Workflow 5 bước)

1. **Bước 1 — Định hình Trải nghiệm (UI/UX Design):**
   - `uiux-designer-agent` định nghĩa cấu trúc màn hình, tương tác micro-interaction, chọn bảng màu, kích cỡ chữ và cung cấp design specs.
2. **Bước 2 — Phát triển Song song Backend & Frontend:**
   - `backend-data-agent` xây dựng/tối ưu API FastAPI, xử lý font tiếng Việt, trích xuất PDF và tích hợp engine giọng đọc TTS.
   - `frontend-ui-agent` lập trình giao diện HTML/CSS/JS theo đúng design specs từ `uiux-designer-agent`.
3. **Bước 3 — Kiểm thử Tự động (QA Testing):**
   - `qa-test-agent` viết test cases kiểm tra các luồng thành công, luồng lỗi, ca biên (edge cases) và chạy toàn bộ test suite `pytest -v`.
4. **Bước 4 — Thẩm định & Phản biện Mã nguồn (Code Review):**
   - `code-reviewer-agent` tiến hành rà soát mã nguồn độc lập (adversarial review), kiểm tra memory leak, race condition, timeout và bảo mật trước khi xuất xưởng.
