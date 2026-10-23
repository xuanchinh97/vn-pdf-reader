// ============================================================================
// VN PDF Reader — Frontend Application Logic
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
  themeIndex: 0, // 0: dark, 1: sepia, 2: light
  themes: ["dark", "sepia", "light"],
  audioBlobCache: new Map(), // key: `${voice}|${speed}|${text}` -> blobUrl
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
  themeToggleBtn: document.getElementById("themeToggleBtn"),
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
  fontDecBtn: document.getElementById("fontDecBtn"),
  fontIncBtn: document.getElementById("fontIncBtn"),
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
  pasteTextDemoBtn: document.getElementById("pasteTextDemoBtn"),
  ttsAudio: document.getElementById("ttsAudio"),
  settingsBtn: document.getElementById("settingsBtn"),
  settingsModal: document.getElementById("settingsModal"),
  closeSettingsBtn: document.getElementById("closeSettingsBtn"),
  cancelSettingsBtn: document.getElementById("cancelSettingsBtn"),
  saveSettingsBtn: document.getElementById("saveSettingsBtn"),
  fptApiKeyInput: document.getElementById("fptApiKeyInput"),
  proxyInput: document.getElementById("proxyInput"),
};

// ============================================================================
// 1. KHỞI TẠO & SỰ KIỆN GIAO DIỆN
// ============================================================================
async function initApp() {
  await loadVoices();
  bindEvents();
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

function bindEvents() {
  // Chọn file PDF
  els.pdfFileInput.addEventListener("change", (e) => {
    const file = e.target.files?.[0];
    if (file) handlePdfUpload(file);
  });

  // Kéo thả file PDF vào bất kỳ đâu trong workspace
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

  // Điều hướng trang
  els.prevPageBtn.addEventListener("click", () => {
    if (state.currentPage > 1) goToPage(state.currentPage - 1, false);
  });

  els.nextPageBtn.addEventListener("click", () => {
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

  // Điều khiển phát TTS
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

  // Chế độ bảng mã & OCR
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

  // Chỉnh sửa văn bản thủ công / Dán văn bản trực tiếp
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

  // Zoom ảnh PDF & Cỡ chữ đọc
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

  els.fontIncBtn.addEventListener("click", () => {
    state.fontSizePx = Math.min(28, state.fontSizePx + 2);
    els.sentencesContainer.style.fontSize = `${state.fontSizePx}px`;
  });

  els.fontDecBtn.addEventListener("click", () => {
    state.fontSizePx = Math.max(14, state.fontSizePx - 2);
    els.sentencesContainer.style.fontSize = `${state.fontSizePx}px`;
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

  // Cài đặt giọng đọc FPT.AI / Proxy
  els.settingsBtn?.addEventListener("click", openSettingsModal);
  els.closeSettingsBtn?.addEventListener("click", closeSettingsModal);
  els.cancelSettingsBtn?.addEventListener("click", closeSettingsModal);
  els.saveSettingsBtn?.addEventListener("click", saveSettings);
  els.settingsModal?.addEventListener("click", (e) => {
    if (e.target === els.settingsModal) closeSettingsModal();
  });

  // Đổi giao diện Sáng / Tối / Sepia
  els.themeToggleBtn.addEventListener("click", () => {
    state.themeIndex = (state.themeIndex + 1) % state.themes.length;
    const theme = state.themes[state.themeIndex];
    document.documentElement.setAttribute("data-theme", theme);
    els.themeToggleBtn.textContent = theme === "dark" ? "🌙" : theme === "sepia" ? "📜" : "☀️";
  });

  // Phím tắt bàn phím
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
    }
  });
}

// ============================================================================
// 2. XỬ LÝ FILE PDF & HIỂN THỊ TRANG
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

async function goToPage(pageNumber, autoPlayAfterLoad = false) {
  if (!state.docId) return;
  stopReading();

  state.currentPage = pageNumber;
  els.pageInput.value = pageNumber;
  els.prevPageBtn.disabled = pageNumber <= 1;
  els.nextPageBtn.disabled = pageNumber >= state.totalPages;

  // Cập nhật ảnh trang PDF bên trái
  els.pdfPageImage.src = `/api/doc/${state.docId}/page/${pageNumber}/image?dpi=170`;

  // Trích xuất và sửa lỗi văn bản Tiếng Việt bên phải
  const mode = els.encodingModeSelect.value || "auto";
  els.sentencesContainer.innerHTML = `<div class="empty-page-notice"><p>⏳ Đang trích xuất và chuẩn hóa văn bản Tiếng Việt trang ${pageNumber}...</p></div>`;

  try {
    const res = await fetch(`/api/doc/${state.docId}/page/${pageNumber}?mode=${mode}`);
    if (!res.ok) throw new Error("Không thể trích xuất trang PDF");
    const data = await res.json();

    applyPageData(data);

    // Nếu phát hiện trang bị lỗi font nặng hoặc là ảnh scan và bật Tự động OCR
    if (data.needs_ocr && els.autoOcrCheckbox.checked) {
      await runBrowserVietnameseOcr(autoPlayAfterLoad);
    } else if (autoPlayAfterLoad && state.sentences.length > 0) {
      playFromSentence(0);
    }
  } catch (err) {
    els.sentencesContainer.innerHTML = `<div class="empty-page-notice"><p>❌ Lỗi: ${err.message}</p></div>`;
  }
}

function applyPageData(data) {
  state.cleanText = data.text || "";
  state.sentences = data.sentences || [];
  state.currentSentenceIndex = -1;

  // Cập nhật badge trạng thái
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
    els.statusBadge.textContent = "✨ Đã sửa lỗi mã UTF-8";
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
    return;
  }

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

  // Click vào câu nào đọc ngay từ câu đó
  els.sentencesContainer.querySelectorAll(".sentence-item").forEach((item) => {
    item.addEventListener("click", () => {
      const idx = parseInt(item.getAttribute("data-index"), 10);
      playFromSentence(idx);
    });
  });
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
// 4. BỘ PHÁT GIỌNG ĐỌC AI (LOOKAHEAD PRE-FETCH & HIGHLIGHT TỪNG CÂU)
// ============================================================================
function togglePlayPause() {
  if (state.sentences.length === 0) return;

  if (state.isPlaying && !state.isPaused) {
    // Tạm dừng
    state.isPaused = true;
    els.ttsAudio.pause();
    els.playPauseBtn.textContent = "▶ Đọc tiếp";
  } else if (state.isPlaying && state.isPaused) {
    // Tiếp tục
    state.isPaused = false;
    els.ttsAudio.play();
    els.playPauseBtn.textContent = "⏸ Tạm dừng";
  } else {
    // Bắt đầu đọc từ câu hiện tại hoặc câu đầu tiên
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
  // Tải trước lần lượt từng câu tiếp theo trong nền (tránh gửi dồn dập nhiều request cùng lúc)
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

  // Dừng ngay audio hiện tại để lập tức ngắt giọng cũ
  els.ttsAudio.pause();
  els.ttsAudio.currentTime = 0;
  els.playPauseBtn.textContent = "⏳ Đang đổi giọng...";
  highlightSentence(index);

  try {
    const audioUrl = await fetchSentenceAudioUrl(state.sentences[index]);
    if (sessionId !== state.playSessionId) return; // Đã chuyển câu khác hoặc đổi giọng khác

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
        // Tự động lật sang trang tiếp theo và đọc tiếp
        goToPage(state.currentPage + 1, true);
      } else {
        stopReading();
      }
    };

    await els.ttsAudio.play();

    // Tải trước câu tiếp theo SAU KHI câu hiện tại đã bắt đầu phát (tránh nghẽn mạng)
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
