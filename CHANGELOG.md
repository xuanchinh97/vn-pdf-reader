# Nhật Ký Thay Đổi (Changelog)

Toàn bộ các thay đổi, tính năng mới và cải tiến của dự án **VN PDF Reader** được ghi nhận và theo dõi tại tệp này theo định dạng chuẩn [Keep a Changelog](https://keepachangelog.com/vi/1.0.0/) và tuân thủ [Semantic Versioning](https://semver.org/).

---

## [1.9.2] - 2026-11-02

### Removed & Refactored
- **Tinh gọn giao diện đọc sách (Reader Clean-up):**
  - **Loại bỏ 3 tính năng dư thừa khỏi menu tùy chọn đọc sách (`moreOptionsPopover`):**
    1. `⚙️ Cài đặt Mạng & HTTP Proxy` (`#settingsBtn`): Chuyển quyền cấu hình mạng và proxy về duy nhất nút bánh răng trên thanh Header trang chủ (Home Settings), loại bỏ sự phân tâm kỹ thuật trong không gian đọc sách.
    2. `🔍 Quét lại OCR trang này` (`#ocrPageBtn`): Loại bỏ nút kích hoạt quét Tesseract.js thủ công trên thanh menu; ứng dụng tập trung vào luồng trích xuất text bản ngữ tự động và tối ưu từ backend.
    3. `✏️ Sửa trực tiếp chữ trong trang` (`#editModeBtn`): Loại bỏ tính năng sửa text thủ công trong trang đọc (vốn không phù hợp với định vị ứng dụng e-reader/audio-reader).
  - **Dọn dẹp mã nguồn Frontend:** Xóa các event listener và reference liên quan trong `src/static/app.js`, `src/static/js/reader-core.js`, `src/static/js/state.js`, đảm bảo menu tinh gọn chuẩn phong cách Apple Books và 100% test suite đạt chuẩn.

---

## [1.9.1] - 2026-11-02

### Fixed & Added
- **Khắc phục lỗi Crash (HTTP 500) khi tải lên PDF có mật khẩu (Password-Protected PDF):**
  - **Nhận diện bảo vệ thông minh (`PDFService.register_pdf`):** Kiểm tra cờ `doc.needs_pass` ngay khi nạp tệp; không tự động gọi `extract_toc()` gây văng `ValueError: cannot initialize - document still encrypted`, trả về trạng thái nghiệp vụ `is_encrypted: true` và `needs_password: true`.
  - **API Mở Khóa Tài Liệu (`POST /api/doc/{doc_id}/unlock`):** Xác thực mật khẩu qua `doc.authenticate()`. Mở khóa thành công sẽ tự động giải mã và lưu lại bản sạch (`PDF_ENCRYPT_NONE`) để người dùng chỉ cần nhập mật khẩu **1 lần duy nhất**; sai mật khẩu trả về HTTP 400 kèm thông báo tiếng Việt.
  - **Chốt chặn phân quyền tại các Endpoint đọc sách:** Tự động chặn và trả mã `HTTP 403 Forbidden` khi cố tình đọc trang (`extract_page_text`, `render_page_image`, `extract_toc`, `search_document`) của tài liệu đang bị khóa.
  - **Hộp thoại nhập mật khẩu Apple Style (Password Modal):** Bổ sung modal mở khóa hiện đại trong giao diện web với icon khóa bảo vệ, input mật khẩu có nút mắt ẩn/hiện (`eye toggle`), phím tắt `Enter` để mở khóa và `Escape` để hủy.

---

## [1.9.0] - 2026-11-02

### Added & Optimized
- **Quản Lý Cache LRU/TTL & Bảo Vệ Ổ Đĩa (REC-02):**
  - **Module `CacheManager` (`src/cache_manager.py`):** Giới hạn dung lượng bộ nhớ đệm TTS trên ổ đĩa (mặc định 2GB, có thể cấu hình).
  - **Thuật toán dọn dẹp LRU:** Tự động theo dõi thời gian truy cập (`atime`) của từng file MP3 và dọn dẹp các tệp cũ nhất về mức 80% (1.6GB) khi dung lượng đầy; giữ nguyên `mtime` để tương thích toàn diện với kiểm thử.
  - **Dọn dẹp RAM trang đọc (`PDFService`):** Nâng cấp bộ nhớ đệm `_page_text_cache` sang `collections.OrderedDict`, triển khai giải thuật LRU đẩy phần tử cũ nhất ra khỏi RAM (`popitem(last=False)`) thay vì xóa trắng toàn bộ 500 trang như trước.
  - **API Quản lý Cache:** Bổ sung endpoint `GET /api/cache/stats` (thống kê dung lượng ổ đĩa, số file, RAM cache) và `POST /api/cache/clean` (dọn dẹp thủ công).

- **Tách Từ Điển & Tìm Kiếm Toàn Văn SQLite FTS5 (REC-03):**
  - **Bóc tách từ điển khỏi `src/main.py`:** Tách hơn 500 dòng từ điển tĩnh thô ra tệp hạt giống `src/dictionary_seed.py` và lưu trữ trong cơ sở dữ liệu SQLite trung tâm (`~/.vn_pdf_reader/app.db`).
  - **Tương thích ngược 100%:** Xây dựng `_OfflineDictionaryProxy` duy trì biến `OFFLINE_DICTIONARY` trong `main.py`, truy vấn trực tiếp qua SQLite mà không gây breaking change cho bất kỳ mã nguồn nào.
  - **Tự động lưu đệm Wiktionary:** Khi người dùng tra từ mới thành công từ Wiktionary, hệ thống tự động ghi nhớ vào SQLite để phục vụ chế độ offline lần sau.
  - **Lập chỉ mục tìm kiếm FTS5 siêu tốc (<10ms):** Xây dựng bảng ảo `doc_pages_fts` sử dụng tokenizer `unicode61 remove_diacritics 2`, hỗ trợ tìm kiếm không dấu lẫn có dấu cho tiếng Việt (kể cả ký tự đặc thù `đ/Đ` $\rightarrow$ `d/D`), tự động fallback sang quét tuần tự nếu cần.

---

## [1.8.0] - 2026-11-02

### Changed & Refactored
- **Tái Cấu Trúc Frontend Thành Kiến Trúc Native ES Modules (REC-04):**
  - **Phân rã tệp nguyên khối (Monolith Splitting):** Chia tách tệp `app.js` đơn khối gần 4.000 dòng thành 7 modules chuyên trách độc lập nằm trong thư mục `src/static/js/`, không phụ thuộc build tool/bundler (Zero Build Step, Native ESM):
    - **`js/state.js`:** Quản lý trạng thái trung tâm duy nhất (`state`), ánh xạ DOM Elements (`els`), bảng dữ liệu mục lục mẫu và các hàm tiện ích dùng chung (`showAppleToast`, `formatTime`, `escapeHtml`, `escapeRegex`).
    - **`js/reader-core.js` (`ReaderCore`):** Quản lý vòng đời trang sách, tải file đa định dạng (PDF/EPUB/TXT), nhóm câu thành đoạn văn (`groupSentencesIntoParagraphs`), tùy biến typography (`Aa`), chế độ đọc tập trung (`Zen Mode`), quét OCR phía client và Lightbox/Split View trang gốc.
    - **`js/audio-controller.js` (`AudioController`):** Điều phối bộ phát âm thanh đa nguồn (Kokoro, Edge, Google), tải trước câu ngầm (`prefetchUpcomingSentences`), tô sáng câu đọc (Whispersync), Audio Scrubber, Sleep Timer, MediaSession API và bộ xuất sách nói MP3 đa luồng.
    - **`js/annotation-mgr.js` (`AnnotationManager`):** Quản lý Dấu trang (`Bookmarks`), Điểm nhấn dạ quang 4 màu (`Highlights`), đồng bộ dữ liệu hai chiều (`localStorage` và `/api/doc/{id}/annotations`).
    - **`js/toc-viewer.js` (`TOCViewer`):** Quản lý ngăn kéo đa tab (`Drawer`), cây mục lục phân cấp (`Document Outline`) và ảnh thu nhỏ trang tải lười (`Page Thumbnails`).
    - **`js/search-drawer.js` (`SearchDrawer`):** Thanh tìm kiếm nổi toàn văn trong sách (In-book Search), bộ đếm kết quả, nhảy câu và highlight từ khóa tức thì trên trang.
    - **`js/ui-utils.js` (`UIUtils`):** Modal cài đặt HTTP Proxy, modal phím tắt trợ giúp và modal tra cứu từ điển tiếng Việt (Wiktionary + Offline fallback).
    - **`app.js`:** Tệp khởi tạo trung tâm đóng vai trò điều phối (`Orchestrator`), gán toàn bộ sự kiện (`bindEvents`) và khởi động ứng dụng (`initApp`).
  - **Tối ưu hóa thẻ nạp kịch bản (`index.html`):** Chuyển sang `<script type="module" src="/app.js?v=esm1.0"></script>`.

---

## [1.7.0] - 2026-10-30

### Added
- **Hỗ Trợ Đa Định Dạng Sách Điện Tử (EPUB & TXT - FNC-01):**
  - **Lõi Xử Lý Đa Định Dạng (PyMuPDF Unified Engine):** Tận dụng trực tiếp khả năng đọc định dạng native của PyMuPDF 2.0+ để mở và phân tích tệp `.epub` và `.txt` mà không phát sinh thêm thư viện ngoài.
  - **Sách Điện Tử EPUB (Reflowable Layout):** Trích xuất văn bản tiếng Việt trơn tru từ các file EPUB, tự động đọc cây mục lục (TOC), loại bỏ hoàn toàn các lỗi ngắt dòng cứng của file PDF và tăng gấp đôi độ mượt mà của giọng đọc AI TTS.
  - **Tệp Văn Bản TXT & Tự Động Chuẩn Hóa Bảng Mã:** Tự động phát hiện và chuyển đổi bảng mã cũ (TCVN3, VNI, CP1258, Windows-1252) sang Unicode dựng sẵn (NFC); tự động phân trang theo khối văn bản đọc tự nhiên.
  - **Mở Rộng API Upload (`POST /api/upload`):** Chấp nhận tệp `.pdf`, `.epub`, `.txt`; tự động trả về trường metadata `file_type`.
  - **Cải Tiến Giao Diện Thư Viện & Dropzone:** Khu vực kéo thả mở rộng nhận diện đa định dạng; danh sách sách gần đây gắn nhãn định dạng (`PDF`, `EPUB`, `TXT`) trên từng bìa sách.
  - **Điều Khiển Giao Diện Theo Định Dạng (Contextual UI):** Tự động ẩn nút "Xem ảnh trang gốc" và "Quét lại OCR" khi đọc tệp số nguyên bản (EPUB/TXT).

---

## [1.6.1] - 2026-10-30

### Security & Removed
- **Loại Bỏ Hoàn Toàn Tích Hợp FPT.AI TTS:**
  - Gỡ bỏ 6 giọng đọc FPT.AI (`fpt-banmai`, `fpt-thuminh`, `fpt-leminh`, `fpt-lannhi`, `fpt-myan`, `fpt-giahuy`) khỏi danh mục giọng đọc khả dụng.
  - Xóa bỏ triệt để việc hardcode `fpt_api_key` trong `DEFAULT_CONFIG` và tự động loại bỏ khóa này khỏi tệp cấu hình đĩa `tts_config.json`.
  - Loại bỏ hoàn toàn logic gọi API HTTP polling v5 (`_synthesize_fpt`) và biến khóa mạch `_fpt_blocked_until` trong `TTSService`.
  - Tinh gọn API `/api/config`: Loại bỏ trường `fpt_api_key` trong `ConfigUpdateRequest` và giao diện cấu hình.
  - Cập nhật Modal Cài đặt trên giao diện người dùng thành *"Cài đặt Mạng & HTTP Proxy"*, loại bỏ ô nhập FPT API Key.
  - Tăng cường an toàn kết nối: Proxy HTTP chuyển sang lấy từ biến môi trường `HTTP_PROXY`, cơ chế tải Google TTS fallback có cơ chế tự động thử kết nối trực tiếp nếu proxy không phản hồi.

---

## [1.6.0] - 2026-10-29

### Added
- **Tìm Kiếm Toàn Văn Trong Sách (In-Book Full-Text Search / `Ctrl+F` & `/`):**
  - **Backend API (`GET /api/doc/{doc_id}/search`):** Tìm kiếm không phân biệt hoa thường, chuẩn hóa Unicode NFC, tự động quét và sửa lỗi phông chữ TCVN3/VNI, hỗ trợ phân trang kết quả kèm số trang, vị trí câu (`sentence_index`) và trích đoạn ngữ cảnh (`snippet`).
  - **Bộ Nhớ Đệm Văn Bản Trang (`_page_text_cache`):** Tối ưu tốc độ tìm kiếm và lật trang PDF xuống dưới 1-3ms cho mỗi trang.
  - **Thanh Tìm Kiếm Nổi (`#inBookSearchBar`):** Giao diện kính mờ bo tròn (Apple Glassmorphism), hiển thị bộ đếm kết quả thực thời (`1 / 15`), nút lật kết quả trước/sau (`▲`/`▼` hoặc Enter/Shift+Enter).
  - **Tab Tìm Kiếm trong Drawer (`#tabBtnSearch`):** Hiển thị toàn bộ danh sách kết quả theo trang, gắn huy hiệu số trang và bôi đậm từ khóa, cho phép bấm để nhảy ngay tới đoạn văn tương ứng.
  - **Highlight Kết Quả Tức Thì trong Trang Sách:** Tự động cuộn mượt (`scrollIntoView`) tới câu đích, bọc từ khóa bằng `<mark class="search-match-highlight search-match-active">` với hiệu ứng màu cam nổi bật và viền nhấp nháy `.search-target-sentence`.
  - **Phím Tắt:** Kích hoạt tức thì bằng `Ctrl+F`, `Cmd+F` hoặc phím `/` khi đang đọc; đóng bằng phím `Esc`.

- **Xem Ảnh Trang PDF Gốc (Original Page Lightbox & Chế Độ Chia Đôi):**
  - **Nút Bật/Tắt Trang Gốc Trên Header (`#originalPageToggleBtn` / Phím `O`):** Mở cửa sổ Lightbox độ nét cao của trang hiện hành để đối chiếu ảnh minh họa, sơ đồ, biểu đồ kỹ thuật.
  - **Cửa Sổ Phóng To Trang Gốc (`#originalPageModal`):**
    - Bộ chuyển đổi DPI sắc nét: Tùy chọn `170 DPI` chuẩn hoặc `300 DPI` siêu nét.
    - Bộ công cụ Zoom linh hoạt: `[-]`, `[100%]`, `[+]`, và `[Fit]` vừa khung màn hình.
    - Lật trang trực tiếp trong Lightbox với đồng bộ 2 chiều về giao diện đọc chính.
    - Nút 1-click tải ảnh PNG trang PDF về máy (`#origDownloadBtn`).
  - **Chế Độ Chia Đôi Màn Hình (Split View):** Cho phép bật chế độ 2 cột song song (bên trái chữ sách sạch với giọng đọc AI, bên phải ảnh trang PDF gốc) trên màn hình máy tính/tablet rộng.

---

## [1.5.0] - 2026-10-27

### Added
- **Mục Lục Chuẩn Trình Duyệt PDF (Chrome PDF Viewer Sidebar):**
  - Bổ sung thanh điều hướng dọc (`.pdf-sidebar-rail`) chuyển đổi linh hoạt giữa 2 chế độ:
    - **Hình thu nhỏ trang (Page Thumbnails):** Render ảnh thu nhỏ thực tế của từng trang PDF (`/api/doc/{doc_id}/page/{p}/image?dpi=60` với `loading="lazy"`), viền xanh `#8AB4F8` đánh dấu trang đang đọc và tự động cuộn tới trang hiện hành khi mở Drawer.
    - **Đề mục tài liệu (Document Outline Tree):** Cây mục lục phân cấp hỗ trợ đóng/mở nhánh con (`▸`) và nhảy trang tức thì.
  - Mở rộng bộ quét `extract_toc` trong `src/pdf_service.py` để nhận diện đề mục đánh số phân cấp (`1.1`, `1.2`...) và tiêu đề chương in hoa đầu trang.
- **Tối Ưu Hóa Thanh Điều Khiển Âm Thanh Nổi (Floating Capsule Player) & Header:**
  - **Nút Play/Pause tích hợp Sóng Âm (`.capsule-play-waveform`):** Thay biểu tượng tam giác truyền thống bằng 4 thanh sóng âm động ngay trong nút tròn trung tâm và loại bỏ cụm sóng âm thừa ở cuối thanh điều khiển.
  - **Popover Chọn Giọng Đọc (`#voicePopover`):** Thiết kế đồng bộ dạng kính mờ rộng `450px`, căn lề trái (`text-align: left`) thẳng hàng, chống rớt dòng và bỏ biểu tượng micro bị lặp đôi trên nút `#voicePill`.
  - **Popover Tốc Độ Đọc (`#speedPopover`):** Kết hợp danh sách mức tốc độ dựng sẵn (`0.75x` – `2.0x`) và thanh trượt tùy chỉnh mượt mà (`0.5x` – `2.5x`, bước `0.05x`).
  - **Trạng thái Hẹn Giờ Tắt (`#sleepTimerBtn`):** Tự động chuyển biểu tượng từ mặt trăng `🌙` sang đồng hồ cát đếm ngược `⏳` kèm hiệu ứng nhịp thở khi đang hẹn giờ, và quay lại `🌙` khi hủy hẹn giờ.
- **Tối Ưu Giao Diện Di Động (Mobile Responsive):**
  - Bổ sung hệ thống `@media (max-width: 768px)` và `@media (max-width: 380px)`.
  - Tinh gọn Header trên Mobile (nút Back chỉ hiển thị icon `<`, ẩn nhãn `"Trang chủ"` để nhường không gian cho tiêu đề chương).
  - Thu gọn kích thước nút và khoảng cách trong `floating-capsule` để hiển thị trọn vẹn trên màn hình `375px` mà không bị tràn lề; các Popover và Drawer tự động co giãn vừa khít màn hình di động.

### Changed
- **Chế Độ Đọc Tập Trung 1 Cột (Single-Pane Clean Reader):** Loại bỏ khung hiển thị ảnh PDF gốc song song trên màn hình chính, chỉ hiển thị trang sách văn bản sạch để tối ưu không gian đọc.
- **Giọng Đọc Mặc Định:** Chuyển giọng mặc định sang **Thành Đạt (`kokoro-thanh_dat`)** trên toàn bộ hệ thống (Frontend & Backend).
- **Điều Hướng Header:** Đổi nhãn nút quay lại từ `< Thư viện` thành `< Trang chủ` và lược bỏ nút Bookmark thừa trên thanh Header.

### Fixed
- **Khắc phục lỗi mất/dính đoạn văn và đè nội dung OCR khi lật trang nhanh:**
  - Giảm ngưỡng tách đoạn dọc giữa các khối văn bản PDF trong `src/pdf_service.py` từ `18.0pt` xuống `4.0pt` để bảo toàn cấu trúc đoạn văn.
  - Thu hẹp vùng lọc header/footer (`4%` mép trên / `96%` mép dưới) chỉ lọc khi thực sự là số trang đứng lẻ hoặc watermark, tránh cắt nhầm dòng văn bản đầu/cuối trang.
  - Bảo vệ số thứ tự đầu dòng (`1.`, `2.`...) trong `split_into_sentences` (`src/vn_text_processor.py`) để không tách rời số thứ tự thành câu riêng.
  - Bổ sung `state.ocrSessionId` trong `src/static/app.js` để hủy kết quả Tesseract OCR chạy ngầm của trang cũ khi người dùng đã chuyển sang trang mới.
  - Căn chỉnh lại khoảng đệm `.reader-viewport`, đưa dải ruy-băng đánh dấu trang (`#bookmarkRibbonBtn`) ra mép phải trang sách và tự động cuộn lên đầu trang khi chuyển trang.

---

## [1.4.0] - 2026-10-26

### Added
- **Triết Lý Thiết Kế Tối Giản Apple Books (Steve Jobs Philosophy):**
  - **Tách biệt 2 màn hình liền mạch:** Màn hình Home (Thư viện) và Màn hình Đọc Sách (Reader View).
  - **Thư Viện Home Tối Giản:**
    - Khối nạp sách trung tâm dạng Hero Card lớn với hiệu ứng kéo thả tập tin PDF nhẹ nhàng.
    - Khu vực "Đang đọc dở" thông minh: Chỉ xuất hiện khi người dùng thực sự có sách trong lịch sử đọc, tự động lưu tiến độ trang và % vào `localStorage`.
  - **Màn Hình Đọc Sách Chuyên Sâu (Reader View):**
    - Header kính mờ (frosted glass) 52px tinh gọn, tích hợp nút `‹ Thư viện` quay về Home tức thì.
    - Tiêu đề chương động (`.book-chapter-header`) đồng bộ tự động theo số trang và danh mục TOC.
    - **Thanh Điều Khiển Âm Thanh Nổi (Floating Capsule Player):** Thiết kế bo tròn 44px nổi trên đáy màn hình, hiệu ứng sóng âm `waveform` động khi phát giọng đọc AI.
    - Hỗ trợ chuyển chương trước (`⏮` / Phím `J`) và chương sau (`⏭` / Phím `K`), tự động tìm chương gần nhất trong TOC hoặc lật từng trang mượt mà nếu không có TOC.
    - Bảng trượt Mục Lục & Dấu Trang (Slide-over Drawer) với hiệu ứng kính mờ `backdrop-filter: blur(32px)` và 3 tab riêng biệt: *Mục lục, Dấu trang, Highlight*.
    - Bảng tùy chỉnh Typography `Aa` và menu mở rộng `⋯`.

### Changed
- Cập nhật phiên bản CSS/JS cache-busting sang `apple3.4`.
- Loại bỏ các câu trích dẫn triết lý tĩnh thừa thãi trên màn hình đọc và chân trang.
- Tinh giản Capsule Player: Loại bỏ nút tua câu `-5s`/`+10s` để thanh điều khiển gọn gàng, chuyển trọng tâm sang điều hướng chương.

---

## [1.3.0] - 2026-10-23

### Added
- **Mục Lục 2 Tầng (2-Tier Table of Contents):**
  - **Tầng 1 (Metadata Outline):** Trích xuất TOC có sẵn trong file PDF thông qua PyMuPDF `doc.get_toc(simple=True)`.
  - **Tầng 2 (Heuristic Regex Scanner):** Tự động quét heuristic nhận diện cấu trúc chương, phần, mục (`Chương/Phần/Bài/Mục/Hồi/Tiết/Kỳ/Tập`) cho các tài liệu PDF scan hoặc tài liệu không nhúng sẵn metadata outline.
  - API endpoint: `GET /api/doc/{doc_id}/toc` và tích hợp sẵn trong response `POST /api/upload`.
  - Hỗ trợ nhảy trực tiếp đến trang và câu đầu tiên của chương khi bấm vào mục lục trong Drawer.
- **Hệ Thống Đánh Dấu (Annotations - Bookmarks & Highlights):**
  - API endpoints: `GET /api/doc/{doc_id}/annotations` và `POST /api/doc/{doc_id}/annotations` lưu trữ bền vững tại `~/.vn_pdf_reader/annotations/{doc_id}.json`.
  - **Dấu trang (Bookmark Ribbon):** Nút dải ruy-băng ở góc trên bên phải trang sách (`🔖`), hỗ trợ phím tắt `B`, hiển thị visual ribbon khi trang được đánh dấu.
  - **Tô màu ghi nhớ (Highlights):** Hỗ trợ 4 màu dạ quang chuẩn (Vàng ấm, Lục ngọc, Lam nhạt, Hồng đào), tự động áp dụng khi mở lại sách.
- **Thanh Công Cụ Bôi Đen Nổi (Floating Selection Action Bar):**
  - Tự động xuất hiện ngay trên vùng văn bản được người dùng bôi đen.
  - Tích hợp 4 nút tô màu Highlight nhanh, Tra từ điển (`📖 Tra từ`), Đọc từ đây (`🔊 Đọc từ đây`), và Sao chép văn bản (`📋 Sao chép`).
- **Tra Từ Điển Tiếng Việt (Vietnamese Dictionary Lookup):**
  - API endpoint: `GET /api/dictionary/lookup?word=...` tích hợp Wiktionary tiếng Việt, cache bộ nhớ LRU và kho từ vựng dự phòng phong phú khi ngoại tuyến.
  - Hỗ trợ corporate proxy tự động `http://10.101.101.208:3128`.
  - Modal tra cứu từ vựng với định nghĩa nghĩa từ, từ loại, ví dụ câu và liên kết nguồn mở rộng.
- **Bảng Ngăn Kéo Bên Hông (TOC & Annotations Drawer):**
  - Ngăn kéo trượt mượt mà với 3 tab: `📑 Mục lục`, `🔖 Dấu trang`, `✨ Đã lưu (Highlights)`.
  - Cho phép quản lý nhanh, xóa dấu trang, xóa highlight, và nhảy trang tức thì.
- **Thanh Điều Khiển Phát Nâng Cao (Audio Scrubber & Controls):**
  - **Thanh trượt thời gian âm thanh (Scrubber):** Hiển thị thời gian thực tế `0:00 / 0:12` và thanh tiến độ âm thanh câu hiện tại, cho phép tua tùy ý.
  - **Nút tua nhanh / lùi (Skip buttons):** Tua lùi `⏪ 5s` và tua tiến `⏩ 10s`, tự động chuyển mượt mà giữa các câu lân cận khi vượt giới hạn độ dài câu.
  - **Bộ điều chỉnh tốc độ dạng Stepper (`[-] [1.0x] [+]`):** Tăng/giảm tốc độ chính xác từng nấc `0.1x` (từ 0.5x đến 2.0x), bấm trực tiếp vào số tốc độ để reset về 1.0x.
  - **Hẹn Giờ Tắt (Sleep Timer `🌙`):** Hỗ trợ hẹn giờ 15 phút, 30 phút, 45 phút hoặc hết trang hiện tại, hiển thị huy hiệu đếm ngược và tự động giảm âm dần (fade-out 10s) trước khi dừng phát.
  - **Tích Hợp Media Session (`navigator.mediaSession`):** Hỗ trợ điều khiển phát/dừng, tua trước/sau thông qua phím cứng bàn phím, tai nghe bluetooth và thanh thông báo OS.
  - **Bảng Hướng Dẫn Phím Tắt Modal (`?`):** Hiển thị danh mục phím tắt chi tiết (Space, J/K, Left/Right, B, F, ?, Esc).

### Changed
- **Tối Ưu Hóa Tách Biệt Tốc Độ Đọc (TTS Speed Decoupling & Server Cache Hit):**
  - Client luôn gửi yêu cầu phát âm thanh từng câu ở tốc độ `speed: 1.0` để tối đa hóa tỷ lệ trúng cache (`audioBlobCache` và backend TTS cache) giữa các người dùng và các lần điều chỉnh tốc độ.
  - Trình duyệt điều khiển tốc độ thực tế bằng `audio.playbackRate = state.speed`, loại bỏ hoàn toàn lỗi x2 tốc độ (double-speed bug).
  - Tải file MP3 trọn trang (`downloadFullPageMp3`) mã hóa riêng biệt tốc độ vào khóa cache `md5(f"{voice}|speed_{speed:.2f}|{clean}")` để đảm bảo file MP3 tải về có đúng tốc độ mong muốn.

---

## [1.2.0] - 2026-10-23

### Added
- **Nâng Cấp Giao Diện Toàn Diện Theo Phong Cách Máy Đọc Sách (Kindle / Kobo / Boox):**
  - **Menu "Aa" Đặc Trưng Của E-Reader:** Popup tùy chỉnh toàn diện:
    - 4 Phông chữ chuẩn xuất bản: *Merriweather* (Sách serif truyền thống), *Literata* (Google Play Books E-Reader), *Inter* (Hiện đại không chân), *Georgia* (Cổ điển).
    - Tăng/giảm cỡ chữ trực quan từng pixel.
    - Chỉnh khoảng cách dòng: Gọn (1.5), Chuẩn (1.8), Thoáng (2.1).
    - Chỉnh độ rộng trang sách: Chuẩn máy đọc sách (720px), Vừa (880px), Tràn lề (100%).
    - Tùy chọn căn đều 2 lề (Justify) & thụt đầu dòng (Paragraph indent 1.6em) chuẩn sách in.
  - **4 Bộ Màu Chủ Đề E-Reader:**
    - 📜 **Giấy ngà (Sepia - Mặc định):** Màu giấy sách thật vàng ấm `#fcf6e8` với mực than dịu mắt, chống mỏi mắt khi đọc lâu.
    - 🌙 **Đêm sâu (OLED Dark):** Nền than tối dịu, chữ sáng ấm, không gây lóa khi đọc đêm.
    - 📱 **Mực điện tử (E-Ink Monochrome):** Đơn sắc tối giản siêu nét mô phỏng màn hình mực điện tử Kindle/Boox.
    - ☀️ **Sáng dịu (Daylight Soft):** Nền trắng sứ trang nhã, tương phản cao ban ngày.
  - **Bố Cục Đoạn Văn Sách (Book Flow):** Tự động gom các câu thành các đoạn văn sách tự nhiên, loại bỏ các nhãn số `#1`, `#2` thô cứng để tạo trải nghiệm đọc như cầm cuốn sách thật.
  - **Tô Sáng Bút Dạ Quang Sách (Whispersync Highlighter):** Câu đang đọc được highlight mềm mại kiểu bút dạ quang sách (màu vàng hổ phách dịu), êm mắt và tự động cuộn nhẹ nhàng.
  - **Chân Trang Tiến Độ Đọc Sách (E-Reader Footer):** Hiển thị tên sách, ước tính thời gian đọc còn lại (WPM), thanh tiến độ phần trăm % mượt mà và số trang `Trang X / Y`.
  - **Mũi Tên Lật Trang Nổi (Kindle Oasis Navigators):** Hai nút lật trang mỏng tinh tế ở 2 mép màn hình, bấm hoặc dùng phím mũi tên để lật trang tức thì.
  - **Chế Độ Đọc Tập Trung (Zen / Focus Mode - Phím F):** Ẩn toàn bộ thanh công cụ thừa, đưa trang sách vào chính giữa toàn màn hình để người đọc chìm đắm hoàn toàn vào nội dung.

---

## [1.1.0] - 2026-10-23

### Added
- **5 Subagents Chuyên Biệt (`.agents/`):**
  - `uiux-designer-agent`: Thiết kế UI/UX, Typography, Design System và tối ưu trải nghiệm đọc sách số.
  - `backend-data-agent`: Xử lý API FastAPI, chuẩn hóa font tiếng Việt, trích xuất PDF PyMuPDF và tích hợp TTS engines.
  - `frontend-ui-agent`: Lập trình giao diện Vanilla JS, Audio Player đồng bộ highlight và hiệu năng tương tác.
  - `qa-test-agent`: Thiết kế và thực thi kiểm thử tự động Pytest (55+ test cases), kiểm thử ca biên và lập báo cáo QA.
  - `code-reviewer-agent`: Phản biện mã nguồn độc lập, rà soát bảo mật, rò rỉ bộ nhớ và đánh giá kiến trúc.
- **Tài liệu Subagents:** Bổ sung `.agents/AGENTS.md` mô tả quy trình cộng tác 5 bước và các tệp đặc tả chi tiết cho từng agent.
- **Tệp theo dõi:** Bổ sung `CHANGELOG.md` để ghi vết thay đổi và `.gitignore` chuẩn cho dự án Python + Web.

### Changed
- **Tối ưu thứ tự giọng đọc:** Đưa Microsoft Edge Neural (`vi-VN-HoaiMyNeural`, `vi-VN-NamMinhNeural`) lên đầu danh sách khuyên dùng vì tốc độ nhanh (1–2s), tự nhiên và không bị giới hạn hạn mức.
- **Tải trước tuần tự (Sequential Prefetching):** Chỉ tải ngầm câu tiếp theo sau khi câu hiện tại đã bắt đầu phát thành công, giải quyết triệt để vấn đề 3 request cùng lúc gây nghẽn băng thông mạng.

### Fixed
- **Độ trễ khi chuyển đổi giọng đọc (Voice Switching Lag):**
  - Ngắt ngay lập tức âm thanh của giọng cũ (`0ms latency`) khi người dùng bấm chọn giọng mới, hiển thị trạng thái `⏳ Đang đổi giọng...`.
  - Khắc phục tình trạng giọng cũ vẫn tiếp tục đọc đè lên trong khi giọng mới đang tải.
- **Tự động xử lý lỗi FPT.AI 429 (Rate Limit / Quota Exceeded):**
  - Tự động phát hiện khi tài khoản FPT.AI hết quota miễn phí để chuyển thẳng sang Microsoft Edge Neural mà không phải chờ thử lại, loại bỏ 2.5 giây độ trễ dư thừa.

---

## [1.0.0] - 2026-10-22

### Added
- **Bộ xử lý văn bản tiếng Việt toàn diện (`src/vn_text_processor.py`):**
  - Hỗ trợ chuyển đổi tự động các bảng mã cổ TCVN3 (ABC), VNI sang Unicode dựng sẵn (NFC).
  - Sửa lỗi ký tự cổ thường gặp trong ebook PDF scan/vnthuquan: `ƣ` (`\u01a3`) thành `ư`, `Ƣ` (`\u01a2`) thành `Ư`.
  - Chuẩn hóa tổ hợp dấu tách rời (combining diacritics), sửa lỗi font nhảy chữ hoa/thường.
  - Thuật toán nối dòng thông minh (smart line unwrapping) bảo toàn cấu trúc đoạn văn, không làm gãy câu giữa chừng.
  - Tách câu tiếng Việt chuẩn ngữ pháp, nhận diện và giữ nguyên các từ viết tắt phổ biến (TP.HCM, TS., GS., v.v.).
- **Dịch vụ trích xuất PDF thông minh (`src/pdf_service.py`):**
  - Trích xuất văn bản có nhận diện tọa độ khối (block layout coordinates).
  - Tự động lọc bỏ phần lề thừa (header, footer, số trang, metadata trang).
  - Xuất ảnh trang PDF độ phân giải cao phục vụ OCR khi phát hiện trang scan hoặc font bị mã hóa lỗi nặng.
- **Tích hợp đa giọng đọc Text-to-Speech (TTS) (`src/tts_service.py`):**
  - Microsoft Edge Neural TTS: Giọng Hoài My (Nữ Nam Bộ) và Nam Minh (Nam Bắc Bộ) qua HTTP proxy công ty (`http://10.10.101.208:3128`).
  - FPT.AI API v5: Giọng Ban Mai, Thu Minh, Minh Quang, Lê Minh, Lan Nhi, Mỹ An, Gia Huy.
  - Google Translate TTS: Giọng đọc dự phòng cuối cùng.
  - Cơ chế đệm âm thanh trên đĩa (`~/.vn_pdf_reader/tts_cache`) giúp nghe lại tức thì và tiết kiệm quota ký tự.
- **Giao diện Web tương tác hiện đại (`src/static/`):**
  - Bố cục Split-Pane: Xem ảnh chụp trang PDF gốc song song với danh sách câu văn bản sạch.
  - Đồng bộ âm thanh & văn bản: Tự động highlight câu đang đọc và cuộn mượt mà theo tiến độ.
  - Hỗ trợ 3 bộ chủ đề màu sắc: Tối (Dark), Sáng (Light) và Giấy ngà (Sepia).
  - Thanh công cụ điều khiển: Play, Pause, chuyển câu, chọn tốc độ phát (0.85x - 2.0x), tải MP3 toàn trang.
  - Tích hợp quét OCR tiếng Việt trên trình duyệt bằng thư viện `Tesseract.js`.
  - Hộp thoại Cài đặt (Settings Modal): Cho phép cấu hình FPT.AI API key và HTTP proxy trực tiếp trên web.
- **Bộ kiểm thử tự động toàn diện (`tests/`):**
  - 55 test cases hoàn chỉnh (Unit, Integration, E2E) đạt tỉ lệ Pass 100%.
  - Tự động sinh dữ liệu PDF giả lập kiểm thử bảng mã và trang scan.
  - Kịch bản chạy nhanh: `run.bat` và `run_silent.vbs`.
