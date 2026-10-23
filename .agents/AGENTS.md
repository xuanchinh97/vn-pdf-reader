# ĐỘI NGŨ SUBAGENTS CHUYÊN BIỆT — DỰ ÁN VN PDF READER

Dự án được phân chia trách nhiệm rõ ràng cho **4 Subagents chuyên biệt**, phục vụ việc phát triển, kiểm thử và thẩm định mã nguồn chất lượng cao:

```
                      ┌────────────────────────┐
                      │    Orchestrator Agent  │
                      └───────────┬────────────┘
                                  │
         ┌────────────────────────┼────────────────────────┐
         ▼                        ▼                        ▼
┌──────────────────┐    ┌──────────────────┐    ┌──────────────────┐
│backend-data-agent│    │frontend-ui-agent │    │  qa-test-agent   │
│  FastAPI, Python │    │  HTML, CSS, JS   │    │  Pytest, E2E     │
│  Text & TTS Core │    │  Audio & Web UX  │    │  Quality Checks  │
└────────┬─────────┘    └────────┬─────────┘    └────────┬─────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 ▼
                     ┌───────────────────────┐
                     │  code-reviewer-agent  │
                     │  Audit, Security, QA  │
                     └───────────────────────┘
```

---

## 1. Danh sách 4 Subagents

| Tên Subagent | Vai trò chính | Phạm vi tệp phụ trách |
| :--- | :--- | :--- |
| **`backend-data-agent`** | Xử lý dữ liệu & API Backend | `src/main.py`, `src/pdf_service.py`, `src/vn_text_processor.py`, `src/tts_service.py` |
| **`frontend-ui-agent`** | Giao diện & Trải nghiệm Người dùng | `src/static/index.html`, `src/static/styles.css`, `src/static/app.js` |
| **`qa-test-agent`** | Tự động hóa kiểm thử & Báo cáo QA | `tests/`, `pytest.ini`, `TEST_REPORT.md` |
| **`code-reviewer-agent`** | Thẩm định kỹ thuật & Review mã nguồn | Toàn bộ codebase (Python & Frontend), kiểm tra bảo mật, hiệu năng |

---

## 2. Quy trình cộng tác chuẩn (Workflow)

1. **Phát triển tính năng mới:**
   - `backend-data-agent` xây dựng/sửa đổi API, thuật toán xử lý font/PDF hoặc tích hợp giọng đọc.
   - `frontend-ui-agent` thiết kế giao diện tương tác, đồng bộ luồng phát audio, phím tắt và hiển thị.
2. **Kiểm thử tự động:**
   - `qa-test-agent` viết test cases kiểm tra các luồng thành công, luồng lỗi, ca biên (edge cases) và chạy toàn bộ test suite `pytest -v`.
3. **Thẩm định & Nghiệm thu:**
   - `code-reviewer-agent` tiến hành rà soát mã nguồn độc lập (adversarial review), kiểm tra memory leak, race condition, timeout và bảo mật trước khi xuất xưởng.
