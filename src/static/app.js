// ============================================================================
// VN PDF Reader — E-Reader Experience (Kindle / Kobo / Boox Style)
// Frontend Application Logic
// ============================================================================

const state = {
  docId: null,
  filename: "",
  totalPages: 0,
  currentPage: 1,
  sentences: [],
  cleanText: "",
  currentSentenceIndex: -1,
  isPlaying: false,
  isPaused: false,
  zoomPercent: 100,
  fontSizePx: 18,
  readingFont: "merriweather", // merriweather | literata | inter | georgia
  lineHeight: "1.8",          // 1.5 | 1.8 | 2.1
  pageWidth: "720px",         // 720px | 880px | 100%
  isJustified: true,
  hasIndent: true,
  isBookFlow: true,           // true: book paragraphs, false: list mode
  isZenMode: false,
  themeIndex: 0,              // 0: sepia, 1: dark, 2: eink, 3: light
  themes: ["sepia", "dark", "eink", "light"],
  audioBlobCache: new Map(),  // key: `${voice}|${speed}|${text}` -> blobUrl
  ocrWorker: null,
  isOcrRunning: false,
  playSessionId: 0,
};

// DOM Elements
const els = {
  pdfFileInput: document.getElementById("pdfFileInput"),
  prevPageBtn: document.getElementById("prevPageBtn"),
  nextPageBtn: document.getElementById("nextPageBtn"),
  pageInput: document.getElementById("pageInput"),
  totalPagesLabel: document.getElementById("totalPagesLabel"),
  prevSentenceBtn: document.getElementById("prevSentenceBtn"),
  playPauseBtn: document.getElementById("playPauseBtn"),
  stopBtn: document.getElementById("stopBtn"),
  nextSentenceBtn: document.getElementById("nextSentenceBtn"),
  voiceSelect: document.getElementById("voiceSelect"),
  speedSelect: document.getElementById("speedSelect"),
  downloadMp3Btn: document.getElementById("downloadMp3Btn"),
  readingSettingsBtn: document.getElementById("readingSettingsBtn"),
  readingSettingsPopover: document.getElementById("readingSettingsPopover"),
  zenModeBtn: document.getElementById("zenModeBtn"),
  exitZenBtn: document.getElementById("exitZenBtn"),
  themeToggleBtn: document.getElementById("themeToggleBtn"),
  settingsBtn: document.getElementById("settingsBtn"),
  docTitleLabel: document.getElementById("docTitleLabel"),
  statusBadge: document.getElementById("statusBadge"),
  statusReasonLabel: document.getElementById("statusReasonLabel"),
  autoNextPageCheckbox: document.getElementById("autoNextPageCheckbox"),
  autoOcrCheckbox: document.getElementById("autoOcrCheckbox"),
  encodingModeSelect: document.getElementById("encodingModeSelect"),
  ocrPageBtn: document.getElementById("ocrPageBtn"),
  editModeBtn: document.getElementById("editModeBtn"),
  dropZone: document.getElementById("dropZone"),
  emptyState: document.getElementById("emptyState"),
  splitContainer: document.getElementById("splitContainer"),
  pdfPane: document.getElementById("pdfPane"),
  pdfPageImage: document.getElementById("pdfPageImage"),
  zoomOutBtn: document.getElementById("zoomOutBtn"),
  zoomInBtn: document.getElementById("zoomInBtn"),
  zoomLabel: document.getElementById("zoomLabel"),
  togglePdfPaneBtn: document.getElementById("togglePdfPaneBtn"),
  showPdfPaneBtn: document.getElementById("showPdfPaneBtn"),
  copyCleanTextBtn: document.getElementById("copyCleanTextBtn"),
  ocrProgressBox: document.getElementById("ocrProgressBox"),
  ocrProgressText: document.getElementById("ocrProgressText"),
  ocrProgressPercent: document.getElementById("ocrProgressPercent"),
  ocrProgressBar: document.getElementById("ocrProgressBar"),
  editorBox: document.getElementById("editorBox"),
  manualTextArea: document.getElementById("manualTextArea"),
  applyManualTextBtn: document.getElementById("applyManualTextBtn"),
  cancelManualTextBtn: document.getElementById("cancelManualTextBtn"),
  sentencesContainer: document.getElementById("sentencesContainer"),
  bookPageCanvas: document.getElementById("bookPageCanvas"),
  bookPrevPageBtn: document.getElementById("bookPrevPageBtn"),
  bookNextPageBtn: document.getElementById("bookNextPageBtn"),
  bookFooterBar: document.getElementById("bookFooterBar"),
  bookFooterTitle: document.getElementById("bookFooterTitle"),
  bookEstTime: document.getElementById("bookEstTime"),
  bookProgressFill: document.getElementById("bookProgressFill"),
  bookPageIndicator: document.getElementById("bookPageIndicator"),
  bookPercentBadge: document.getElementById("bookPercentBadge"),
  pasteTextDemoBtn: document.getElementById("pasteTextDemoBtn"),
  ttsAudio: document.getElementById("ttsAudio"),
  settingsModal: document.getElementById("settingsModal"),
  closeSettingsBtn: document.getElementById("closeSettingsBtn"),
  cancelSettingsBtn: document.getElementById("cancelSettingsBtn"),
  saveSettingsBtn: document.getElementById("saveSettingsBtn"),
  fptApiKeyInput: document.getElementById("fptApiKeyInput"),
  proxyInput: document.getElementById("proxyInput"),
  fontFamilyChips: document.getElementById("fontFamilyChips"),
  lineHeightChips: document.getElementById("lineHeightChips"),
  pageWidthChips: document.getElementById("pageWidthChips"),
  justifyToggle: document.getElementById("justifyToggle"),
  indentToggle: document.getElementById("indentToggle"),
  bookFlowToggle: document.getElementById("bookFlowToggle"),
  fontDecPopoverBtn: document.getElementById("fontDecPopoverBtn"),
  fontIncPopoverBtn: document.getElementById("fontIncPopoverBtn"),
  fontSizePopoverLabel: document.getElementById("fontSizePopoverLabel"),
};

// ============================================================================
// 1. KHỞI TẠO & SỰ KIỆN GIAO DIỆN MÁY ĐỌC SÁCH
// ============================================================================
async function initApp() {
  loadReadingPreferences();
  applyReadingPreferences();
  await loadVoices();
  bindEvents();
  updateThemeButton();
}

async function loadVoices() {
  try {
    const res = await fetch("/api/voices");
    if (!res.ok) return;
    const data = await res.json();
    if (data.voices && data.voices.length > 0) {
      els.voiceSelect.innerHTML = data.voices
        .map((v) => `<option value="${v.id}">🎙️ ${v.name}</option>`)
        .join("");
    }
  } catch (err) {
    console.warn("Không tải được danh sách giọng đọc, giữ mặc định:", err);
  }
}

function loadReadingPreferences() {
  try {
    const raw = localStorage.getItem("vn_reader_prefs");
    if (raw) {
      const p = JSON.parse(raw);
      if (p.font) state.readingFont = p.font;
      if (p.fontSize) state.fontSizePx = p.fontSize;
      if (p.lineHeight) state.lineHeight = p.lineHeight;
      if (p.pageWidth) state.pageWidth = p.pageWidth;
      if (p.isJustified !== undefined) state.isJustified = p.isJustified;
      if (p.hasIndent !== undefined) state.hasIndent = p.hasIndent;
      if (p.isBookFlow !== undefined) state.isBookFlow = p.isBookFlow;
      if (p.themeIndex !== undefined) state.themeIndex = p.themeIndex;
    }
  } catch (_) {}
}

function applyReadingPreferences() {
  const root = document.documentElement;
  root.style.setProperty("--font-reading", `var(--font-${state.readingFont})`);
  root.style.setProperty("--font-size", `${state.fontSizePx}px`);
  root.style.setProperty("--line-height", state.lineHeight);
  root.style.setProperty("--reading-max-width", state.pageWidth);
  root.style.setProperty("--para-indent", state.hasIndent ? "1.6em" : "0");
  root.style.setProperty("--text-align", state.isJustified ? "justify" : "left");

  const currentTheme = state.themes[state.themeIndex] || "sepia";
  root.setAttribute("data-theme", currentTheme);

  if (els.fontSizePopoverLabel) {
    els.fontSizePopoverLabel.textContent = `${state.fontSizePx}px`;
  }
  if (els.justifyToggle) els.justifyToggle.checked = state.isJustified;
  if (els.indentToggle) els.indentToggle.checked = state.hasIndent;
  if (els.bookFlowToggle) els.bookFlowToggle.checked = state.isBookFlow;

  // Cập nhật trạng thái active của các chip trong menu Aa
  updateChipActiveState(els.fontFamilyChips, "data-font", state.readingFont);
  updateChipActiveState(els.lineHeightChips, "data-lh", state.lineHeight);
  updateChipActiveState(els.pageWidthChips, "data-width", state.pageWidth);

  try {
    localStorage.setItem(
      "vn_reader_prefs",
      JSON.stringify({
        font: state.readingFont,
        fontSize: state.fontSizePx,
        lineHeight: state.lineHeight,
        pageWidth: state.pageWidth,
        isJustified: state.isJustified,
        hasIndent: state.hasIndent,
        isBookFlow: state.isBookFlow,
        themeIndex: state.themeIndex,
      })
    );
  } catch (_) {}
}

function updateChipActiveState(container, attr, value) {
  if (!container) return;
  container.querySelectorAll(".chip").forEach((chip) => {
    if (chip.getAttribute(attr) === value) {
      chip.classList.add("active");
    } else {
      chip.classList.remove("active");
    }
  });
}

function updateThemeButton() {
  const theme = state.themes[state.themeIndex];
  if (els.themeToggleBtn) {
    els.themeToggleBtn.textContent =
      theme === "sepia"
        ? "📜"
        : theme === "dark"
        ? "🌙"
        : theme === "eink"
        ? "📱"
        : "☀️";
    els.themeToggleBtn.title = `Chủ đề hiện tại: ${
      theme === "sepia"
        ? "Giấy ngà (Sepia)"
        : theme === "dark"
        ? "Đêm sâu (OLED Dark)"
        : theme === "eink"
        ? "Mực điện tử (E-Ink)"
        : "Sáng dịu (Daylight)"
    }`;
  }
}

function bindEvents() {
  // 1. Chọn file PDF
  els.pdfFileInput.addEventListener("change", (e) => {
    const file = e.target.files?.[0];
    if (file) handlePdfUpload(file);
  });

  // Kéo thả file PDF vào workspace
  window.addEventListener("dragover", (e) => {
    e.preventDefault();
    els.dropZone.classList.add("drag-over");
  });

  window.addEventListener("dragleave", (e) => {
    if (e.target === els.dropZone || e.clientX <= 0 || e.clientY <= 0) {
      els.dropZone.classList.remove("drag-over");
    }
  });

  window.addEventListener("drop", (e) => {
    e.preventDefault();
    els.dropZone.classList.remove("drag-over");
    const file = e.dataTransfer?.files?.[0];
    if (file && file.name.toLowerCase().endsWith(".pdf")) {
      handlePdfUpload(file);
    } else if (file) {
      alert("Vui lòng kéo thả file có định dạng .pdf");
    }
  });

  // 2. Điều hướng trang
  els.prevPageBtn.addEventListener("click", () => {
    if (state.currentPage > 1) goToPage(state.currentPage - 1, false);
  });
  els.nextPageBtn.addEventListener("click", () => {
    if (state.currentPage < state.totalPages) goToPage(state.currentPage + 1, false);
  });

  // Mũi tên lật trang nổi kiểu máy đọc sách (Kindle Oasis style)
  els.bookPrevPageBtn?.addEventListener("click", () => {
    if (state.currentPage > 1) goToPage(state.currentPage - 1, false);
  });
  els.bookNextPageBtn?.addEventListener("click", () => {
    if (state.currentPage < state.totalPages) goToPage(state.currentPage + 1, false);
  });

  els.pageInput.addEventListener("change", () => {
    let target = parseInt(els.pageInput.value, 10);
    if (isNaN(target)) target = state.currentPage;
    target = Math.max(1, Math.min(state.totalPages, target));
    els.pageInput.value = target;
    if (target !== state.currentPage) {
      goToPage(target, false);
    }
  });

  // 3. Điều khiển giọng đọc TTS
  els.playPauseBtn.addEventListener("click", togglePlayPause);
  els.stopBtn.addEventListener("click", stopReading);

  els.prevSentenceBtn.addEventListener("click", () => {
    if (state.sentences.length === 0) return;
    const prevIdx = Math.max(0, state.currentSentenceIndex - 1);
    playFromSentence(prevIdx);
  });

  els.nextSentenceBtn.addEventListener("click", () => {
    if (state.sentences.length === 0) return;
    const nextIdx = Math.min(state.sentences.length - 1, state.currentSentenceIndex + 1);
    playFromSentence(nextIdx);
  });

  // Khi đổi giọng: DỪNG NGAY LẬP TỨC giọng cũ (0ms latency)
  els.voiceSelect.addEventListener("change", () => {
    if (state.isPlaying) {
      els.ttsAudio.pause();
      state.playSessionId++;
      playFromSentence(Math.max(0, state.currentSentenceIndex));
    }
  });

  els.speedSelect.addEventListener("change", () => {
    const speed = parseFloat(els.speedSelect.value || "1.0");
    els.ttsAudio.playbackRate = speed;
  });

  // 4. Menu Aa (Kindle / Kobo Popover)
  els.readingSettingsBtn?.addEventListener("click", (e) => {
    e.stopPropagation();
    if (els.readingSettingsPopover) {
      els.readingSettingsPopover.hidden = !els.readingSettingsPopover.hidden;
    }
  });

  document.addEventListener("click", (e) => {
    if (
      els.readingSettingsPopover &&
      !els.readingSettingsPopover.hidden &&
      !els.readingSettingsPopover.contains(e.target) &&
      e.target !== els.readingSettingsBtn
    ) {
      els.readingSettingsPopover.hidden = true;
    }
  });

  // Chọn phông chữ
  els.fontFamilyChips?.addEventListener("click", (e) => {
    const btn = e.target.closest(".chip");
    if (!btn) return;
    state.readingFont = btn.getAttribute("data-font");
    applyReadingPreferences();
  });

  // Tăng / giảm cỡ chữ trong popover
  els.fontIncPopoverBtn?.addEventListener("click", () => {
    state.fontSizePx = Math.min(32, state.fontSizePx + 1);
    applyReadingPreferences();
  });

  els.fontDecPopoverBtn?.addEventListener("click", () => {
    state.fontSizePx = Math.max(13, state.fontSizePx - 1);
    applyReadingPreferences();
  });

  // Chọn giãn dòng
  els.lineHeightChips?.addEventListener("click", (e) => {
    const btn = e.target.closest(".chip");
    if (!btn) return;
    state.lineHeight = btn.getAttribute("data-lh");
    applyReadingPreferences();
  });

  // Chọn độ rộng trang sách
  els.pageWidthChips?.addEventListener("click", (e) => {
    const btn = e.target.closest(".chip");
    if (!btn) return;
    state.pageWidth = btn.getAttribute("data-width");
    applyReadingPreferences();
  });

  // Tùy chọn căn lề, thụt đầu dòng, kiểu sách
  els.justifyToggle?.addEventListener("change", () => {
    state.isJustified = els.justifyToggle.checked;
    applyReadingPreferences();
  });

  els.indentToggle?.addEventListener("change", () => {
    state.hasIndent = els.indentToggle.checked;
    applyReadingPreferences();
  });

  els.bookFlowToggle?.addEventListener("change", () => {
    state.isBookFlow = els.bookFlowToggle.checked;
    applyReadingPreferences();
    renderSentences();
  });

  // 5. Chế độ đọc tập trung (Zen / Focus Mode)
  els.zenModeBtn?.addEventListener("click", toggleZenMode);
  els.exitZenBtn?.addEventListener("click", toggleZenMode);

  // 6. Đổi chủ đề màu (Sepia -> Dark -> E-Ink -> Light)
  els.themeToggleBtn.addEventListener("click", () => {
    state.themeIndex = (state.themeIndex + 1) % state.themes.length;
    applyReadingPreferences();
    updateThemeButton();
  });

  // 7. Cài đặt FPT.AI / Proxy modal
  els.settingsBtn?.addEventListener("click", openSettingsModal);
  els.closeSettingsBtn?.addEventListener("click", closeSettingsModal);
  els.cancelSettingsBtn?.addEventListener("click", closeSettingsModal);
  els.saveSettingsBtn?.addEventListener("click", saveSettings);
  els.settingsModal?.addEventListener("click", (e) => {
    if (e.target === els.settingsModal) closeSettingsModal();
  });

  // 8. Chế độ bảng mã & OCR
  els.encodingModeSelect.addEventListener("change", () => {
    if (state.docId) {
      goToPage(state.currentPage, false);
    }
  });

  els.ocrPageBtn.addEventListener("click", () => {
    if (state.docId && !state.isOcrRunning) {
      runBrowserVietnameseOcr(false);
    }
  });

  // 9. Chỉnh sửa văn bản thủ công
  els.editModeBtn.addEventListener("click", () => {
    els.manualTextArea.value = state.cleanText;
    els.editorBox.hidden = !els.editorBox.hidden;
  });

  els.pasteTextDemoBtn.addEventListener("click", () => {
    els.emptyState.hidden = true;
    els.splitContainer.hidden = false;
    els.pdfPane.hidden = true;
    els.splitContainer.classList.add("single-pane");
    els.showPdfPaneBtn.hidden = true;
    els.docTitleLabel.textContent = "Chế độ đọc văn bản tự do";
    els.editModeBtn.disabled = false;
    els.editorBox.hidden = false;
    els.manualTextArea.focus();
  });

  els.applyManualTextBtn.addEventListener("click", async () => {
    const raw = els.manualTextArea.value.trim();
    if (!raw) return;
    stopReading();
    await processRawTextFromClient(raw, "Đã áp dụng văn bản chỉnh sửa thủ công.");
    els.editorBox.hidden = true;
  });

  els.cancelManualTextBtn.addEventListener("click", () => {
    els.editorBox.hidden = true;
  });

  // 10. Zoom PDF & Toggle Cột PDF
  els.zoomInBtn.addEventListener("click", () => updateZoom(15));
  els.zoomOutBtn.addEventListener("click", () => updateZoom(-15));

  els.togglePdfPaneBtn.addEventListener("click", () => {
    els.pdfPane.hidden = true;
    els.splitContainer.classList.add("single-pane");
    els.showPdfPaneBtn.hidden = false;
  });

  els.showPdfPaneBtn.addEventListener("click", () => {
    els.pdfPane.hidden = false;
    els.splitContainer.classList.remove("single-pane");
    els.showPdfPaneBtn.hidden = true;
  });

  els.copyCleanTextBtn.addEventListener("click", async () => {
    if (!state.cleanText) return;
    await navigator.clipboard.writeText(state.cleanText);
    const oldText = els.copyCleanTextBtn.textContent;
    els.copyCleanTextBtn.textContent = "✅ Đã copy!";
    setTimeout(() => (els.copyCleanTextBtn.textContent = oldText), 1500);
  });

  // Tải MP3 toàn trang
  els.downloadMp3Btn.addEventListener("click", downloadFullPageMp3);

  // 11. Phím tắt bàn phím
  window.addEventListener("keydown", (e) => {
    const tag = document.activeElement?.tagName?.toLowerCase();
    if (tag === "input" || tag === "textarea" || tag === "select") return;

    if (e.code === "Space" && state.sentences.length > 0) {
      e.preventDefault();
      togglePlayPause();
    } else if (e.code === "ArrowLeft" && state.docId && state.currentPage > 1) {
      e.preventDefault();
      goToPage(state.currentPage - 1, false);
    } else if (e.code === "ArrowRight" && state.docId && state.currentPage < state.totalPages) {
      e.preventDefault();
      goToPage(state.currentPage + 1, false);
    } else if (e.code === "KeyF") {
      e.preventDefault();
      toggleZenMode();
    } else if (e.code === "Escape") {
      if (state.isZenMode) toggleZenMode();
      if (els.readingSettingsPopover && !els.readingSettingsPopover.hidden) {
        els.readingSettingsPopover.hidden = true;
      }
    }
  });
}

function toggleZenMode() {
  state.isZenMode = !state.isZenMode;
  document.body.classList.toggle("zen-mode", state.isZenMode);
  if (els.exitZenBtn) els.exitZenBtn.hidden = !state.isZenMode;
  if (state.isZenMode && els.readingSettingsPopover) {
    els.readingSettingsPopover.hidden = true;
  }
}

// ============================================================================
// 2. XỬ LÝ FILE PDF & HIỂN THỊ TRANG SÁCH
// ============================================================================
async function handlePdfUpload(file) {
  stopReading();
  els.docTitleLabel.textContent = `Đang tải: ${file.name}...`;

  const formData = new FormData();
  formData.append("file", file);

  try {
    const res = await fetch("/api/upload", {
      method: "POST",
      body: formData,
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || "Lỗi tải file PDF");
    }
    const info = await res.json();
    state.docId = info.doc_id;
    state.filename = info.filename;
    state.totalPages = info.page_count;
    state.currentPage = 1;

    // Cập nhật UI
    els.emptyState.hidden = true;
    els.splitContainer.hidden = false;
    els.pdfPane.hidden = false;
    els.splitContainer.classList.remove("single-pane");
    els.showPdfPaneBtn.hidden = true;

    els.docTitleLabel.textContent = info.filename;
    els.totalPagesLabel.textContent = info.page_count;
    els.pageInput.max = info.page_count;
    els.pageInput.disabled = false;
    els.encodingModeSelect.disabled = false;
    els.ocrPageBtn.disabled = false;
    els.editModeBtn.disabled = false;

    await goToPage(1, false);
  } catch (err) {
    alert(`Không thể mở file PDF: ${err.message}`);
    els.docTitleLabel.textContent = "Lỗi mở tài liệu";
  }
}

async function goToPage(pageNumber, autoPlay = false) {
  if (!state.docId) return;
  stopReading();

  state.currentPage = pageNumber;
  els.pageInput.value = pageNumber;
  els.prevPageBtn.disabled = pageNumber <= 1;
  els.nextPageBtn.disabled = pageNumber >= state.totalPages;
  if (els.bookPrevPageBtn) els.bookPrevPageBtn.disabled = pageNumber <= 1;
  if (els.bookNextPageBtn) els.bookNextPageBtn.disabled = pageNumber >= state.totalPages;

  // Hiển thị ảnh trang PDF gốc
  els.pdfPageImage.src = `/api/doc/${state.docId}/page/${pageNumber}/image?dpi=170`;

  // Tải văn bản trang đã được sửa lỗi font
  const mode = els.encodingModeSelect.value || "auto";
  try {
    const res = await fetch(`/api/doc/${state.docId}/page/${pageNumber}?mode=${mode}`);
    if (!res.ok) throw new Error("Không thể trích xuất văn bản trang này");
    const data = await res.json();
    applyPageData(data);

    // Tự động quét OCR nếu trang bị lỗi font hoặc là ảnh scan
    if (data.needs_ocr && els.autoOcrCheckbox.checked) {
      console.log(`[OCR] Trang ${pageNumber} cần OCR, đang kích hoạt Tesseract.js...`);
      runBrowserVietnameseOcr(autoPlay);
      return;
    }

    if (autoPlay && state.sentences.length > 0) {
      playFromSentence(0);
    }
  } catch (err) {
    console.error("Lỗi tải trang:", err);
  }
}

function applyPageData(data) {
  state.cleanText = data.text || "";
  state.sentences = data.sentences || [];
  state.currentSentenceIndex = -1;

  els.statusBadge.hidden = false;
  els.statusReasonLabel.textContent = data.reason || "";

  if (data.needs_ocr) {
    els.statusBadge.className = "status-badge warn";
    els.statusBadge.textContent = "⚠️ Cần quét OCR";
  } else if (data.encoding_detected === "tcvn3") {
    els.statusBadge.className = "status-badge fixed";
    els.statusBadge.textContent = "✨ Đã sửa TCVN3 → Unicode";
  } else if (data.encoding_detected === "vni") {
    els.statusBadge.className = "status-badge fixed";
    els.statusBadge.textContent = "✨ Đã sửa VNI → Unicode";
  } else if (data.encoding_detected === "mojibake") {
    els.statusBadge.className = "status-badge fixed";
    els.statusBadge.textContent = "✨ Đã sửa lỗi UTF-8";
  } else if (data.encoding_detected === "ocr_vi") {
    els.statusBadge.className = "status-badge fixed";
    els.statusBadge.textContent = "🔍 Đã quét OCR Tiếng Việt";
  } else {
    els.statusBadge.className = "status-badge";
    els.statusBadge.textContent = "✅ Chuẩn Unicode";
  }

  renderSentences();
}

function renderSentences() {
  const hasSentences = state.sentences.length > 0;
  els.playPauseBtn.disabled = !hasSentences;
  els.stopBtn.disabled = !hasSentences;
  els.prevSentenceBtn.disabled = !hasSentences;
  els.nextSentenceBtn.disabled = !hasSentences;
  els.downloadMp3Btn.disabled = !hasSentences;

  if (!hasSentences) {
    els.sentencesContainer.innerHTML = `
      <div class="empty-page-notice">
        <p>Trang này chưa có văn bản đọc được (hoặc là trang ảnh scan / lỗi font nặng).</p>
        <button class="btn btn-accent" onclick="runBrowserVietnameseOcr(false)">
          🔍 Bấm để Quét OCR Tiếng Việt cho trang này
        </button>
      </div>
    `;
    updateBookFooter();
    return;
  }

  if (state.isBookFlow) {
    // CHẾ ĐỘ ĐOẠN VĂN SÁCH (KINDLE / E-READER BOOK FLOW)
    els.sentencesContainer.classList.remove("list-mode");
    const paragraphs = groupSentencesIntoParagraphs(state.cleanText, state.sentences);

    els.sentencesContainer.innerHTML = paragraphs
      .map((para) => {
        const fullText = para.map((item) => item.text).join(" ").trim();
        // Nhận diện tiêu đề sách (dưới 65 ký tự và không kết thúc bằng dấu chấm)
        const isHeading = para.length === 1 && fullText.length < 65 && !fullText.endsWith(".");
        const tagClass = isHeading ? "book-heading" : "book-paragraph";

        const spans = para
          .map(
            (item) => `
            <span class="sentence-item" id="sentence-${item.index}" data-index="${item.index}">
              ${escapeHtml(item.text)} 
            </span>
          `
          )
          .join("");

        return `<div class="${tagClass}">${spans}</div>`;
      })
      .join("");
  } else {
    // CHẾ ĐỘ DANH SÁCH TỪNG CÂU
    els.sentencesContainer.classList.add("list-mode");
    els.sentencesContainer.innerHTML = state.sentences
      .map(
        (sentence, idx) => `
        <div class="sentence-item" id="sentence-${idx}" data-index="${idx}">
          <span class="sentence-index">#${idx + 1}</span>
          <span class="sentence-text">${escapeHtml(sentence)}</span>
        </div>
      `
      )
      .join("");
  }

  // Click vào câu nào đọc ngay từ câu đó
  els.sentencesContainer.querySelectorAll(".sentence-item").forEach((item) => {
    item.addEventListener("click", () => {
      const idx = parseInt(item.getAttribute("data-index"), 10);
      playFromSentence(idx);
    });
  });

  updateBookFooter();
}

function groupSentencesIntoParagraphs(cleanText, sentences) {
  if (!cleanText || !sentences || sentences.length === 0) {
    return [sentences.map((text, index) => ({ text, index }))];
  }

  const rawParagraphs = cleanText.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  if (rawParagraphs.length <= 1) {
    return [sentences.map((text, index) => ({ text, index }))];
  }

  const result = [];
  let sentIdx = 0;

  for (const rawP of rawParagraphs) {
    const currentGroup = [];
    let accumulated = "";

    while (sentIdx < sentences.length) {
      const sent = sentences[sentIdx];
      currentGroup.push({ text: sent, index: sentIdx });
      sentIdx++;
      accumulated = (accumulated + " " + sent).trim();

      // Kiểm tra xem đoạn văn này đã đủ câu chưa
      if (accumulated.length >= rawP.length - 8 || sentIdx === sentences.length) {
        break;
      }
    }

    if (currentGroup.length > 0) {
      result.push(currentGroup);
    }
  }

  // Nếu còn sót câu nào chưa vào nhóm
  if (sentIdx < sentences.length) {
    const lastGroup = [];
    while (sentIdx < sentences.length) {
      lastGroup.push({ text: sentences[sentIdx], index: sentIdx });
      sentIdx++;
    }
    result.push(lastGroup);
  }

  return result;
}

function updateBookFooter() {
  if (els.bookFooterTitle) {
    els.bookFooterTitle.textContent = state.filename || "Sách điện tử";
  }
  if (els.bookPageIndicator) {
    els.bookPageIndicator.textContent = `Trang ${state.currentPage} / ${state.totalPages || 0}`;
  }
  const pct = state.totalPages > 0 ? Math.round((state.currentPage / state.totalPages) * 100) : 0;
  if (els.bookPercentBadge) {
    els.bookPercentBadge.textContent = `${pct}%`;
  }
  if (els.bookProgressFill) {
    els.bookProgressFill.style.width = `${pct}%`;
  }
  // Ước tính thời gian đọc: ~220 từ/phút
  const wordCount = state.cleanText ? state.cleanText.trim().split(/\s+/).length : 0;
  const mins = Math.max(1, Math.ceil(wordCount / 220));
  if (els.bookEstTime) {
    els.bookEstTime.textContent = wordCount > 0 ? `~${mins} phút đọc` : "~0 phút";
  }
}

// ============================================================================
// 3. QUÉT OCR TIẾNG VIỆT TRỰC TIẾP TRÊN TRÌNH DUYỆT (TESSERACT.JS VIE)
// ============================================================================
async function runBrowserVietnameseOcr(autoPlayAfter = false) {
  if (!state.docId || state.isOcrRunning) return;
  state.isOcrRunning = true;
  els.ocrPageBtn.disabled = true;
  els.ocrProgressBox.hidden = false;
  els.ocrProgressText.textContent = "Đang khởi tạo bộ nhận diện chữ Tiếng Việt (OCR)...";
  els.ocrProgressPercent.textContent = "0%";
  els.ocrProgressBar.style.width = "0%";

  try {
    const imageUrl = `/api/doc/${state.docId}/page/${state.currentPage}/image?dpi=220&enhance=true`;

    if (!state.ocrWorker) {
      state.ocrWorker = await Tesseract.createWorker("vie", 1, {
        logger: (m) => {
          if (m.status === "recognizing text" && typeof m.progress === "number") {
            const pct = Math.round(m.progress * 100);
            els.ocrProgressText.textContent = "Đang quét mặt chữ Tiếng Việt trên trang PDF...";
            els.ocrProgressPercent.textContent = `${pct}%`;
            els.ocrProgressBar.style.width = `${pct}%`;
          } else if (m.status) {
            els.ocrProgressText.textContent = `OCR: ${m.status}...`;
          }
        },
      });
    }

    const {
      data: { text },
    } = await state.ocrWorker.recognize(imageUrl);

    await processRawTextFromClient(
      text,
      "Đã quét OCR Tiếng Việt từ ảnh trang PDF và nối câu hoàn chỉnh.",
      "ocr_vi"
    );

    if (autoPlayAfter && state.sentences.length > 0) {
      playFromSentence(0);
    }
  } catch (err) {
    console.error("OCR Error:", err);
    alert(`Lỗi khi quét OCR: ${err.message}`);
  } finally {
    state.isOcrRunning = false;
    els.ocrPageBtn.disabled = false;
    els.ocrProgressBox.hidden = true;
  }
}

async function processRawTextFromClient(rawText, customReason, badgeType = "unicode") {
  const res = await fetch("/api/clean-text", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: rawText, force_mode: "unicode" }),
  });
  if (!res.ok) throw new Error("Lỗi làm sạch văn bản");
  const data = await res.json();
  data.encoding_detected = badgeType;
  data.needs_ocr = false;
  if (customReason) data.reason = customReason;
  applyPageData(data);
}

// ============================================================================
// 4. BỘ PHÁT GIỌNG ĐỌC AI & TÔ SÁNG TỪNG CÂU (WHISPERSYNC STYLE)
// ============================================================================
function togglePlayPause() {
  if (state.sentences.length === 0) return;

  if (state.isPlaying && !state.isPaused) {
    state.isPaused = true;
    els.ttsAudio.pause();
    els.playPauseBtn.textContent = "▶ Đọc tiếp";
  } else if (state.isPlaying && state.isPaused) {
    state.isPaused = false;
    els.ttsAudio.play();
    els.playPauseBtn.textContent = "⏸ Tạm dừng";
  } else {
    const startIdx = state.currentSentenceIndex >= 0 ? state.currentSentenceIndex : 0;
    playFromSentence(startIdx);
  }
}

function stopReading() {
  state.playSessionId++;
  state.isPlaying = false;
  state.isPaused = false;
  els.ttsAudio.pause();
  els.ttsAudio.currentTime = 0;
  els.playPauseBtn.textContent = "▶ Đọc ngay";
  highlightSentence(-1);
}

async function fetchSentenceAudioUrl(sentenceText) {
  const voice = els.voiceSelect.value;
  const speed = parseFloat(els.speedSelect.value || "1.0");
  const cacheKey = `${voice}|${sentenceText}`;

  if (state.audioBlobCache.has(cacheKey)) {
    return state.audioBlobCache.get(cacheKey);
  }

  const res = await fetch("/api/tts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      text: sentenceText,
      voice,
      speed,
    }),
  });

  if (!res.ok) {
    throw new Error("Không tạo được âm thanh TTS từ server");
  }

  const blob = await res.blob();
  const blobUrl = URL.createObjectURL(blob);
  state.audioBlobCache.set(cacheKey, blobUrl);
  return blobUrl;
}

async function prefetchUpcomingSentences(fromIndex) {
  for (let offset = 1; offset <= 2; offset++) {
    const idx = fromIndex + offset;
    if (idx < state.sentences.length) {
      try {
        await fetchSentenceAudioUrl(state.sentences[idx]);
      } catch (_) {}
    }
  }
}

async function playFromSentence(index) {
  if (index < 0 || index >= state.sentences.length) {
    stopReading();
    return;
  }

  const sessionId = ++state.playSessionId;
  state.isPlaying = true;
  state.isPaused = false;
  state.currentSentenceIndex = index;

  // Dừng ngay audio hiện tại để ngắt giọng cũ ngay tức khắc
  els.ttsAudio.pause();
  els.ttsAudio.currentTime = 0;
  els.playPauseBtn.textContent = "⏳ Đang đổi giọng...";
  highlightSentence(index);

  try {
    const audioUrl = await fetchSentenceAudioUrl(state.sentences[index]);
    if (sessionId !== state.playSessionId) return;

    els.ttsAudio.src = audioUrl;
    els.ttsAudio.playbackRate = parseFloat(els.speedSelect.value || "1.0");
    els.playPauseBtn.textContent = "⏸ Tạm dừng";

    els.ttsAudio.onended = () => {
      if (sessionId !== state.playSessionId) return;
      const nextIdx = index + 1;
      if (nextIdx < state.sentences.length) {
        playFromSentence(nextIdx);
      } else if (
        els.autoNextPageCheckbox.checked &&
        state.docId &&
        state.currentPage < state.totalPages
      ) {
        goToPage(state.currentPage + 1, true);
      } else {
        stopReading();
      }
    };

    await els.ttsAudio.play();

    // Chỉ tải ngầm câu tiếp theo sau khi câu hiện tại đã bắt đầu phát thành công
    prefetchUpcomingSentences(index);
  } catch (err) {
    console.warn("Lỗi tải âm thanh TTS, chuyển sang Web Speech API dự phòng:", err);
    speakWithBrowserFallback(state.sentences[index], index, sessionId);
  }
}

function speakWithBrowserFallback(text, index, sessionId) {
  if (!("speechSynthesis" in window)) {
    stopReading();
    return;
  }
  window.speechSynthesis.cancel();
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = "vi-VN";
  utter.rate = parseFloat(els.speedSelect.value || "1.0");
  els.playPauseBtn.textContent = "⏸ Tạm dừng";

  utter.onend = () => {
    if (sessionId !== state.playSessionId) return;
    const nextIdx = index + 1;
    if (nextIdx < state.sentences.length) {
      playFromSentence(nextIdx);
    } else {
      stopReading();
    }
  };
  window.speechSynthesis.speak(utter);
}

function highlightSentence(index) {
  els.sentencesContainer.querySelectorAll(".sentence-item").forEach((el) => {
    el.classList.remove("active");
  });

  if (index >= 0) {
    const activeEl = document.getElementById(`sentence-${index}`);
    if (activeEl) {
      activeEl.classList.add("active");
      activeEl.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }
}

// ============================================================================
// 5. CÀI ĐẶT FPT.AI / PROXY & TẢI MP3
// ============================================================================
async function openSettingsModal() {
  try {
    const res = await fetch("/api/config");
    if (res.ok) {
      const cfg = await res.json();
      if (els.fptApiKeyInput) els.fptApiKeyInput.value = cfg.fpt_api_key || "";
      if (els.proxyInput) els.proxyInput.value = cfg.http_proxy || "";
    }
  } catch (err) {
    console.warn("Không đọc được cấu hình:", err);
  }
  if (els.settingsModal) els.settingsModal.hidden = false;
}

function closeSettingsModal() {
  if (els.settingsModal) els.settingsModal.hidden = true;
}

async function saveSettings() {
  const fptKey = els.fptApiKeyInput?.value?.trim() || "";
  const proxy = els.proxyInput?.value?.trim() || "";
  try {
    const res = await fetch("/api/config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fpt_api_key: fptKey, http_proxy: proxy }),
    });
    if (!res.ok) throw new Error("Lỗi lưu cấu hình");
    await loadVoices();
    closeSettingsModal();
    alert("Đã lưu cài đặt giọng đọc thành công!");
  } catch (err) {
    alert("Không thể lưu cấu hình: " + err.message);
  }
}

async function downloadFullPageMp3() {
  if (!state.cleanText) return;
  const oldLabel = els.downloadMp3Btn.textContent;
  els.downloadMp3Btn.disabled = true;
  els.downloadMp3Btn.textContent = "⏳ Đang tạo MP3...";

  try {
    const voice = els.voiceSelect.value;
    const speed = parseFloat(els.speedSelect.value || "1.0");

    const res = await fetch("/api/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: state.cleanText,
        voice,
        speed,
      }),
    });

    if (!res.ok) throw new Error("Không thể xuất file MP3");
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const baseName = state.filename ? state.filename.replace(/\.pdf$/i, "") : "van_ban";
    a.download = `${baseName}_trang_${state.currentPage}.mp3`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  } catch (err) {
    alert(`Lỗi tải MP3: ${err.message}`);
  } finally {
    els.downloadMp3Btn.disabled = false;
    els.downloadMp3Btn.textContent = oldLabel;
  }
}

function updateZoom(delta) {
  state.zoomPercent = Math.max(50, Math.min(220, state.zoomPercent + delta));
  els.zoomLabel.textContent = `${state.zoomPercent}%`;
  els.pdfPageImage.style.maxWidth = state.zoomPercent === 100 ? "100%" : "none";
  els.pdfPageImage.style.width = `${state.zoomPercent}%`;
}

function escapeHtml(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Khởi chạy ứng dụng
initApp();
