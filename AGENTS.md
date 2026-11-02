# AGENTS.md — VN PDF Reader

Vietnamese PDF reader + multi-engine TTS web app. FastAPI backend, vanilla JS frontend, single-page app served on `http://127.0.0.1:8788`.

## Quick start

```powershell
# Windows one-click (creates .venv, installs deps, starts server, opens browser)
run.bat

# Manual
python -m venv .venv
.venv\Scripts\pip.exe install -r requirements.txt
.venv\Scripts\python.exe -m uvicorn src.main:app --host 127.0.0.1 --port 8788 --reload
```

`kokoro_vietnamese` (local offline TTS) is **not** in `requirements.txt` — install separately if using `kokoro-*` voices. Without it, those voices silently fall back to Edge-TTS.

## Architecture

| File | Role |
|---|---|
| `src/main.py` | FastAPI app, all `/api/*` endpoints, mounts `src/static/` at `/` (mount is at the **end** of the file — new API routes must be added before it) |
| `src/db_service.py` | SQLite database service: central dictionary storage and FTS5 full-text search indexing (`unicode61 remove_diacritics 2`) |
| `src/cache_manager.py` | Disk cache manager for TTS audio (2GB limit, LRU pruning, cache stats and cleanup APIs) |
| `src/dictionary_seed.py` | Built-in Vietnamese dictionary seed data (37 core entries) for SQLite seeding |
| `src/pdf_service.py` | PyMuPDF extraction, 2-tier TOC (metadata → heuristic regex), header/footer filtering, page image render, LRU page cache (`collections.OrderedDict`), FTS5 search integration |
| `src/vn_text_processor.py` | TCVN3/VNI/Mojibake → Unicode NFC, detached diacritic fix, line unwrapping, Vietnamese sentence splitting (abbreviation-aware) |
| `src/tts_service.py` | Multi-engine TTS orchestrator: Kokoro (local) → Edge-TTS → Google fallback, with circuit breakers and disk cache |
| `src/static/{index.html,styles.css,app.js,js/*}` | Frontend (Native ES Modules, zero build step, no framework). `app.js` orchestrates modular components (`reader-core`, `audio-controller`, `annotation-mgr`, `toc-viewer`, `search-drawer`, `ui-utils`, `state`). |

## Storage (user home, not in repo)

- `~/.vn_pdf_reader/docs/{md5}.pdf` — uploaded PDFs (keyed by first 12 chars of MD5)
- `~/.vn_pdf_reader/annotations/{doc_id}.json` — bookmarks + highlights
- `~/.vn_pdf_reader/tts_cache/{md5}.mp3` — TTS audio cache (key includes voice + speed, managed by LRU)
- `~/.vn_pdf_reader/app.db` — SQLite database (offline dictionary & FTS5 search index)
- `~/.vn_pdf_reader/tts_config.json` — HTTP proxy config

## Testing

```powershell
# Run all 68 tests (pytest discovers unittest.TestCase classes)
.venv\Scripts\python.exe -m pytest -v

# Master runner — also generates TEST_REPORT.md
.venv\Scripts\python.exe tests\run_all_tests.py
```

- `pytest.ini` sets `pythonpath = .` and `asyncio_mode = auto` (but tests use `unittest.TestCase`, not pytest-asyncio).
- `tests/fixtures/generate_synthetic_pdfs.py` auto-generates 6 sample PDFs on first run (standard, TCVN3, VNI, detached accents, scanned, broken font). Requires `C:/Windows/Fonts/arial.ttf` on Windows; falls back silently if missing.
- `tests/test_vn_text_processor.py` (root of `tests/`) is a **legacy duplicate** of `tests/unit/test_vn_text_processor_extended.py` — ignore it.
- E2E tests hit real TTS engines (Edge/FPT/Google) — they will fail offline or behind firewalls without the corporate proxy.

## Conventions & gotchas

- **Default voice**: `kokoro-thanh_dat` (Thành Đạt). Change in `src/tts_service.py` `AVAILABLE_VOICES` and `src/main.py` `TTSRequest` default.
- **Hardcoded corporate proxy**: `http://10.10.101.208:3128` in `src/tts_service.py:29` and `src/main.py:756`. Override via `/api/config` POST or edit `~/.vn_pdf_reader/tts_config.json`.
- **Hardcoded FPT.AI key**: `src/tts_service.py:28` — replace with your own or override via `/api/config`.
- **Frontend demo mode**: `src/static/app.js` initializes `state.docId = "demo_hanoi"` with mock TOC — real upload replaces it.
- **OCR race condition guard**: `state.ocrSessionId` in `app.js` cancels stale Tesseract.js results on page flip. Don't remove.
- **Header/footer filter**: `src/pdf_service.py` strips blocks in top 4% / bottom 96% of page only if they look like page numbers or known watermarks (`vnthuquan`, `tạo ebook`). Don't widen the margin without checking — it will cut real content.
- **Sentence splitter**: `split_into_sentences` in `vn_text_processor.py` protects abbreviations (`Tp.`, `TS.`, `GS.`, `BS.`, etc.) and numbered list prefixes (`1.`, `2.`) from being split. Add new abbreviations to the `abbrevs` list.
- **Edge-TTS quirk**: text must end with `.`, `!`, `?`, or `:` or it returns `NoAudioReceived`. `tts_service.py` auto-appends `.` if missing.
- **CORS**: `allow_origins=["*"]` in `main.py` — fine for local dev, tighten before any public deploy.
- **No lint/format/typecheck config** — no `pyproject.toml`, `ruff`, `mypy`, or pre-commit hooks. Follow existing style (type hints, `pathlib`, f-strings).

## Subagent roles

`.agents/AGENTS.md` defines 5 specialized subagents (uiux-designer, backend-data, frontend-ui, qa-test, code-reviewer) with file ownership boundaries. Read it before multi-agent work to avoid stepping on another agent's files.
