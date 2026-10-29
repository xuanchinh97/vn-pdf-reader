// ============================================================================
// VN PDF Reader — E-Reader Experience (Kindle / Kobo / Boox Style)
// Frontend Application Logic
// ============================================================================

const DEFAULT_MOCK_TOC = [
  { level: 1, title: "Lời giới thiệu: Hà Nội trong ký ức", page: 1 },
  { level: 1, title: "Chương I: Phố cổ Hà Nội và nếp sống xưa", page: 3 },
  { level: 2, title: "1.1 Những mái ngói thâm nâu", page: 5 },
  { level: 2, title: "1.2 Phố Hàng Đào, Hàng Ngang ngày hội", page: 10 },
  { level: 1, title: "Chương II: Quà Hà Nội & Hương Vị Cốm Mới", page: 15 },
  { level: 2, title: "2.1 Thức quà của đồng lúa làng Vòng", page: 16 },
  { level: 2, title: "2.2 Hồng cốm tốt đôi mùa thu", page: 22 },
  { level: 1, title: "Chương III: Bún chả và phở gánh rong đêm", page: 32 },
  { level: 2, title: "3.1 Hương phở bò gánh bên bờ hồ", page: 35 },
  { level: 2, title: "3.2 Khói chả quạt than hoa ngõ nhỏ", page: 44 },
  { level: 1, title: "Chương IV: Thạch chè và những thức quà mùa hạ", page: 56 },
  { level: 1, title: "Chương V: Tiếng rao đêm trên ngõ vắng", page: 88 },
];

const state = {
  docId: "demo_hanoi",
  filename: "Hà Nội Ba Mươi Sáu Phố Phường — Thạch Lam",
  totalPages: 120,
  currentPage: 15,
  sentences: [],
  cleanText: "",
  currentSentenceIndex: -1,
  isPlaying: false,
  isPaused: false,
  zoomPercent: 100,
  fontSizePx: 19,
  readingFont: "newsreader", // newsreader | merriweather | literata | inter
  lineHeight: "1.85",        // 1.5 | 1.85 | 2.1
  pageWidth: "680px",        // 680px | 880px | 100%
  isJustified: true,
  hasIndent: true,
  isBookFlow: true,          // true: book paragraphs, false: list mode
  isZenMode: false,
  themeIndex: 0,             // 0: sepia, 1: dark, 2: eink, 3: light
  themes: ["sepia", "dark", "eink", "light"],
  speed: 1.0,
  toc: DEFAULT_MOCK_TOC,
  pagesOverview: [],
  bookmarks: [],
  highlights: [],
  sleepTimerMode: 0,
  sleepTimerEndTimestamp: null,
  sleepTimerInterval: null,
  sleepStopOnPageEnd: false,
  isSeeking: false,
  audioBlobCache: new Map(),      // key: `${voice}|${text}` -> blobUrl
  inFlightAudioPromises: new Map(), // key: `${voice}|${text}` -> Promise<blobUrl>
  ocrWorker: null,
  isOcrRunning: false,
  ocrSessionId: 0,
  playSessionId: 0,
};

// DOM Elements
const els = {
  homeScreen: document.getElementById("homeScreen"),
  readerScreen: document.getElementById("readerScreen"),
  capsulePlayer: document.getElementById("capsulePlayer"),
  backToHomeBtn: document.getElementById("backToHomeBtn"),
  sampleBookCard: document.getElementById("sampleBookCard"),
  themeBtn: document.getElementById("themeBtn"),
  homeSettingsBtn: document.getElementById("homeSettingsBtn"),
  recentSection: document.getElementById("recentSection"),
  recentBooksGrid: document.getElementById("recentBooksGrid"),
  pdfFileInput: document.getElementById("pdfFileInput"),
  prevPageBtn: document.getElementById("prevPageBtn"),
  nextPageBtn: document.getElementById("nextPageBtn"),
  pageInput: document.getElementById("pageInput"),
  totalPagesLabel: document.getElementById("totalPagesLabel"),
  prevChapterBtn: document.getElementById("prevChapterBtn"),
  nextChapterBtn: document.getElementById("nextChapterBtn"),
  prevSentenceBtn: document.getElementById("prevSentenceBtn"),
  playPauseBtn: document.getElementById("playPauseBtn"),
  stopBtn: document.getElementById("stopBtn"),
  nextSentenceBtn: document.getElementById("nextSentenceBtn"),
  skipBackBtn: document.getElementById("skipBackBtn"),
  skipForwardBtn: document.getElementById("skipForwardBtn"),
  speedDecBtn: document.getElementById("speedDecBtn"),
  speedIncBtn: document.getElementById("speedIncBtn"),
  speedValLabel: document.getElementById("speedValLabel"),
  speedPillBtn: document.getElementById("speedPillBtn"),
  speedPopover: document.getElementById("speedPopover"),
  speedRangeInput: document.getElementById("speedRangeInput"),
  speedRangeValLabel: document.getElementById("speedRangeValLabel"),
  speedPresetGrid: document.getElementById("speedPresetGrid"),
  sleepTimerBtn: document.getElementById("sleepTimerBtn"),
  sleepTimerIcon: document.getElementById("sleepTimerIcon"),
  sleepTimerPopover: document.getElementById("sleepTimerPopover"),
  sleepCountdownLabel: document.getElementById("sleepCountdownLabel"),
  sleepTimeRemaining: document.getElementById("sleepTimeRemaining"),
  voicePill: document.getElementById("voicePill"),
  voiceCurrentLabel: document.getElementById("voiceCurrentLabel"),
  voicePopover: document.getElementById("voicePopover"),
  voicePopoverList: document.getElementById("voicePopoverList"),
  voiceSelect: document.getElementById("voiceSelect"),
  speedSelect: document.getElementById("speedSelect"),
  downloadMp3Btn: document.getElementById("downloadMp3Btn"),
  appleToast: document.getElementById("appleToast"),
  appleToastIcon: document.getElementById("appleToastIcon"),
  appleToastText: document.getElementById("appleToastText"),
  readingSettingsBtn: document.getElementById("readingSettingsBtn"),
  readingSettingsPopover: document.getElementById("readingSettingsPopover"),
  moreOptionsBtn: document.getElementById("moreOptionsBtn"),
  moreOptionsPopover: document.getElementById("moreOptionsPopover"),
  waveformBars: document.getElementById("waveformBars"),
  drawerToggleBtn: document.getElementById("drawerToggleBtn"),
  tocDrawer: document.getElementById("tocDrawer"),
  closeDrawerBtn: document.getElementById("closeDrawerBtn"),
  drawerBackdrop: document.getElementById("drawerBackdrop"),
  tabBtnToc: document.getElementById("tabBtnToc"),
  tabBtnBookmarks: document.getElementById("tabBtnBookmarks"),
  tabBtnHighlights: document.getElementById("tabBtnHighlights"),
  drawerTabToc: document.getElementById("drawerTabToc"),
  drawerTabBookmarks: document.getElementById("drawerTabBookmarks"),
  drawerTabHighlights: document.getElementById("drawerTabHighlights"),
  tocList: document.getElementById("tocList"),
  bookmarksList: document.getElementById("bookmarksList"),
  highlightsList: document.getElementById("highlightsList"),
  bookmarkCount: document.getElementById("bookmarkCount"),
  highlightCount: document.getElementById("highlightCount"),
  bookmarkRibbonBtn: document.getElementById("bookmarkRibbonBtn"),
  headerBookmarkBtn: document.getElementById("headerBookmarkBtn"),
  headerBookmarkIcon: document.getElementById("headerBookmarkIcon"),
  drawerAddBookmarkActionBtn: document.getElementById("drawerAddBookmarkActionBtn"),
  audioScrubberBar: document.getElementById("audioScrubberBar"),
  audioScrubber: document.getElementById("audioScrubber"),
  audioCurrentTime: document.getElementById("audioCurrentTime"),
  audioDuration: document.getElementById("audioDuration"),
  floatingSelectionBar: document.getElementById("floatingSelectionBar"),
  floatHighlightBtn: document.getElementById("floatHighlightBtn"),
  floatLookupBtn: document.getElementById("floatLookupBtn"),
  floatSpeakBtn: document.getElementById("floatSpeakBtn"),
  floatCopyBtn: document.getElementById("floatCopyBtn"),
  dictModal: document.getElementById("dictModal"),
  closeDictBtn: document.getElementById("closeDictBtn"),
  closeDictFooterBtn: document.getElementById("closeDictFooterBtn"),
  dictSearchInput: document.getElementById("dictSearchInput"),
  dictSearchBtn: document.getElementById("dictSearchBtn"),
  dictResults: document.getElementById("dictResults"),
  shortcutsBtn: document.getElementById("shortcutsBtn"),
  shortcutsModal: document.getElementById("shortcutsModal"),
  closeShortcutsBtn: document.getElementById("closeShortcutsBtn"),
  closeShortcutsFooterBtn: document.getElementById("closeShortcutsFooterBtn"),
  readerPane: document.getElementById("readerPane"),
  zenModeBtn: document.getElementById("zenModeBtn"),
  exitZenBtn: document.getElementById("exitZenBtn"),
  themeToggleBtn: document.getElementById("themeToggleBtn"),
  settingsBtn: document.getElementById("settingsBtn"),
  docTitleLabel: document.getElementById("docTitleLabel"),
  chapterHeader: document.getElementById("chapterHeader"),
  chapterNum: document.getElementById("chapterNum"),
  chapterTitle: document.getElementById("chapterTitle"),
  statusBadge: document.getElementById("statusBadge"),
  statusReasonLabel: document.getElementById("statusReasonLabel"),
  autoNextPageCheckbox: document.getElementById("autoNextPageCheckbox"),
  autoOcrCheckbox: document.getElementById("autoOcrCheckbox"),
  encodingModeSelect: document.getElementById("encodingModeSelect"),
  ocrPageBtn: document.getElementById("ocrPageBtn"),
  editModeBtn: document.getElementById("editModeBtn"),
  homeDropZone: document.getElementById("homeDropZone"),
  dropZone: document.getElementById("dropZone") || document.getElementById("homeDropZone"),
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

  // Nạp 8 câu mẫu Thạch Lam ban đầu nếu chưa mở PDF để UI luôn sống động chuẩn Prototype
  const initialItems = document.querySelectorAll("#sentencesContainer .sentence-item");
  if (initialItems.length > 0 && state.sentences.length === 0) {
    state.sentences = Array.from(initialItems).map((el) => el.textContent.trim());
    state.cleanText = state.sentences.join(" ");
    state.currentSentenceIndex = 0;
    if (els.playPauseBtn) els.playPauseBtn.disabled = false;
    if (els.prevSentenceBtn) els.prevSentenceBtn.disabled = false;
    if (els.nextSentenceBtn) els.nextSentenceBtn.disabled = false;
    if (els.skipBackBtn) els.skipBackBtn.disabled = false;
    if (els.skipForwardBtn) els.skipForwardBtn.disabled = false;

    initialItems.forEach((item) => {
      item.addEventListener("click", () => {
        const idx = parseInt(item.getAttribute("data-index"), 10);
        playFromSentence(idx);
      });
    });
  }

  bindEvents();
  setupAudioScrubber();
  setupSelectionListener();
  setupMediaSession();
  updateThemeButton();

  // Khởi tạo Mục lục, Dấu trang & Điểm nhấn ban đầu
  renderTocList();
  await loadAnnotations();
  updateBookmarkRibbonState();

  // Khởi động ở màn hình Home chuẩn Thư Viện Apple
  showScreen("home");
}

function showScreen(screenName) {
  if (screenName === "home") {
    if (els.homeScreen) {
      els.homeScreen.removeAttribute("hidden");
      els.homeScreen.hidden = false;
    }
    if (els.readerScreen) {
      els.readerScreen.setAttribute("hidden", "");
      els.readerScreen.hidden = true;
    }
    if (els.capsulePlayer) {
      els.capsulePlayer.setAttribute("hidden", "");
      els.capsulePlayer.hidden = true;
    }
    renderRecentBooks();
  } else {
    if (els.homeScreen) {
      els.homeScreen.setAttribute("hidden", "");
      els.homeScreen.hidden = true;
    }
    if (els.readerScreen) {
      els.readerScreen.removeAttribute("hidden");
      els.readerScreen.hidden = false;
    }
    if (els.capsulePlayer) {
      els.capsulePlayer.removeAttribute("hidden");
      els.capsulePlayer.hidden = false;
    }
  }
}

window.showScreen = showScreen;
window.openDrawer = openDrawer;
window.closeDrawer = closeDrawer;

function saveRecentBook(docId, title, totalPages, currentPage = 1) {
  try {
    let recents = JSON.parse(localStorage.getItem("vn_recent_books") || "[]");
    const existing = recents.find((b) => b.id === docId || b.title === title);
    recents = recents.filter((b) => b.id !== docId && b.title !== title);
    recents.unshift({
      id: docId,
      title: title,
      totalPages: totalPages || existing?.totalPages || 1,
      currentPage: currentPage || existing?.currentPage || 1,
      timestamp: Date.now(),
    });
    localStorage.setItem("vn_recent_books", JSON.stringify(recents.slice(0, 8)));
  } catch (_) {}
}

function renderRecentBooks() {
  if (!els.recentBooksGrid) return;
  let recents = [];
  try {
    recents = JSON.parse(localStorage.getItem("vn_recent_books") || "[]");
  } catch (_) {}

  // Chỉ hiển thị khu vực "Đang đọc dở" nếu người dùng thực sự có sách đã nạp/đang đọc
  if (recents.length === 0) {
    if (els.recentSection) els.recentSection.hidden = true;
    els.recentBooksGrid.innerHTML = "";
    return;
  }

  if (els.recentSection) els.recentSection.hidden = false;

  const coverGradients = [
    "linear-gradient(135deg, #1C3B5E 0%, #0D1C2E 100%)",
    "linear-gradient(135deg, #2D4A3E 0%, #15261F 100%)",
    "linear-gradient(135deg, #5E2638 0%, #2E131C 100%)",
    "linear-gradient(135deg, #6B4226 0%, #361F0F 100%)",
    "linear-gradient(135deg, #4A3E2D 0%, #261F15 100%)",
  ];

  let html = "";
  recents.forEach((book, i) => {
    const bg = coverGradients[i % coverGradients.length];
    const cur = book.currentPage || 1;
    const total = book.totalPages || 1;
    const pct = Math.min(100, Math.round((cur / total) * 100));
    html += `
      <article class="book-card recent-book-item" data-doc-id="${book.id}">
        <div class="book-cover" style="background: ${bg};">
          <div class="cover-title">${escapeHtml(book.title)}</div>
          <div class="cover-author">PDF</div>
        </div>
        <div class="book-info">
          <div>
            <h4 class="book-card-title">${escapeHtml(book.title)}</h4>
            <p class="book-card-meta">${total} trang</p>
          </div>
          <div class="book-card-progress">
            <div class="progress-track">
              <div class="progress-fill" style="width: ${pct}%;"></div>
            </div>
            <div class="progress-label">
              <span>Trang ${cur} / ${total}</span>
              <span>${pct}%</span>
            </div>
          </div>
        </div>
      </article>
    `;
  });

  els.recentBooksGrid.innerHTML = html;

  // Re-bind click event cho từng thẻ sách đang đọc dở
  document.querySelectorAll(".recent-book-item").forEach((card) => {
    card.addEventListener("click", async () => {
      const docId = card.getAttribute("data-doc-id");
      const book = recents.find((b) => b.id === docId);
      if (book) {
        state.docId = book.id;
        state.filename = book.title;
        state.totalPages = book.totalPages;
        state.currentPage = book.currentPage || 1;
        els.docTitleLabel.textContent = book.title;
        els.totalPagesLabel.textContent = book.totalPages;
        els.pageInput.max = book.totalPages;
        els.pageInput.value = state.currentPage;
        
        // Tải lại TOC, Pages Overview và Annotations của cuốn sách này
        try {
          const [tocRes, pagesRes] = await Promise.all([
            fetch(`/api/doc/${book.id}/toc`),
            fetch(`/api/doc/${book.id}/pages`),
          ]);
          if (tocRes.ok) {
            const tocData = await tocRes.json();
            state.toc = tocData.toc || [];
          }
          if (pagesRes.ok) {
            const pagesData = await pagesRes.json();
            state.pagesOverview = pagesData.pages || [];
          }
          renderTocList();
        } catch (_) {}
        await loadAnnotations();

        // Đảm bảo ẩn PDF Pane và chỉ hiện Single-pane Reader
        els.emptyState.hidden = true;
        els.splitContainer.hidden = false;
        els.pdfPane.hidden = true;
        els.splitContainer.classList.add("single-pane");

        showScreen("reader");
        await goToPage(state.currentPage, false);
      }
    });
  });
}

async function loadVoices() {
  try {
    const res = await fetch("/api/voices");
    if (!res.ok) return;
    const data = await res.json();
    if (data.voices && data.voices.length > 0) {
      // Đưa giọng Thành Đạt lên đầu danh sách, làm giọng mặc định và bỏ chữ "Đề xuất" ở giọng Tuấn Ngọc
      const voices = [...data.voices]
        .map((v) => {
          if (v.id === "kokoro-tuan_ngoc") {
            return { ...v, name: v.name.replace(/\s*Đề xuất/gi, "").replace(/\s+\)/g, ")") };
          }
          return v;
        })
        .sort((a, b) => {
          if (a.id === "kokoro-thanh_dat") return -1;
          if (b.id === "kokoro-thanh_dat") return 1;
          return 0;
        });
      state.voicesList = voices;
      const defaultVoice = voices.find((v) => v.id === "kokoro-thanh_dat") || voices[0];
      const curVoiceId = els.voiceSelect?.value || defaultVoice.id;
      if (els.voiceSelect) {
        els.voiceSelect.innerHTML = voices
          .map((v) => `<option value="${v.id}" ${v.id === curVoiceId ? "selected" : ""}>${escapeHtml(v.name)}</option>`)
          .join("");
      }
      renderVoicePopoverList(curVoiceId);
    }
  } catch (err) {
    console.warn("Không tải được danh sách giọng đọc, giữ mặc định:", err);
  }
}

function formatShortVoiceLabel(name) {
  if (!name) return "Giọng AI";
  return name.replace(/\s*-\s*(Kokoro AI|Microsoft Edge|FPT\.AI).*$/i, ")").replace(/\(\)/g, "").trim();
}

function renderVoicePopoverList(selectedId) {
  const voices = state.voicesList || [];
  if (!voices.length) return;
  const activeVoice = voices.find((v) => v.id === selectedId) || voices[0];
  if (els.voiceCurrentLabel && activeVoice) {
    els.voiceCurrentLabel.textContent = formatShortVoiceLabel(activeVoice.name);
  }
  if (!els.voicePopoverList) return;
  els.voicePopoverList.innerHTML = voices
    .map((v) => {
      const isAct = v.id === activeVoice.id;
      return `
        <button class="chip ${isAct ? "active" : ""}" data-voice-id="${escapeHtml(v.id)}">
          <span>🎙️ ${escapeHtml(v.name)}</span>
          ${isAct ? '<span class="check-mark">✓</span>' : ""}
        </button>
      `;
    })
    .join("");
}

function selectVoiceById(voiceId) {
  if (!voiceId) return;
  if (els.voiceSelect) {
    els.voiceSelect.value = voiceId;
  }
  renderVoicePopoverList(voiceId);
  if (els.voicePopover) els.voicePopover.hidden = true;
  if (state.isPlaying) {
    els.ttsAudio.pause();
    state.playSessionId++;
    playFromSentence(Math.max(0, state.currentSentenceIndex));
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
  const fontMap = {
    newsreader: '"Newsreader", "Georgia", serif',
    merriweather: '"Merriweather", "Georgia", serif',
    literata: '"Literata", "Georgia", serif',
    inter: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Inter", sans-serif',
  };
  const selectedFont = fontMap[state.readingFont] || fontMap.newsreader;

  // Set CSS variables trên :root cho toàn hệ thống
  root.style.setProperty("--font-book", selectedFont);
  root.style.setProperty("--font-reading", selectedFont);
  root.style.setProperty("--font-size-base", `${state.fontSizePx}px`);
  root.style.setProperty("--font-size", `${state.fontSizePx}px`);
  root.style.setProperty("--line-height-base", state.lineHeight || "1.85");
  root.style.setProperty("--line-height", state.lineHeight || "1.85");
  root.style.setProperty("--book-width", state.pageWidth || "680px");
  root.style.setProperty("--para-indent", state.hasIndent ? "1.8em" : "0");
  root.style.setProperty("--text-align", state.isJustified ? "justify" : "left");

  // Áp dụng trực tiếp inline style lên canvas trang sách để cập nhật tức thì
  const bookContainer = document.querySelector(".book-container");
  if (bookContainer) {
    bookContainer.style.fontFamily = selectedFont;
    bookContainer.style.fontSize = `${state.fontSizePx}px`;
    bookContainer.style.lineHeight = state.lineHeight || "1.85";
    bookContainer.style.maxWidth = state.pageWidth || "680px";
  }
  document.querySelectorAll(".book-paragraph").forEach((p) => {
    p.style.fontFamily = selectedFont;
    p.style.fontSize = `${state.fontSizePx}px`;
    p.style.lineHeight = state.lineHeight || "1.85";
    p.style.textAlign = state.isJustified ? "justify" : "left";
    p.style.textIndent = state.hasIndent ? "1.8em" : "0";
  });

  const currentTheme = state.themes[state.themeIndex] || "sepia";
  root.setAttribute("data-theme", currentTheme);

  // Đồng bộ theme circle trong Aa popover
  document.querySelectorAll(".theme-circle").forEach((tc) => {
    const val = tc.getAttribute("data-theme-val");
    const isAct = (val === currentTheme) || 
                  (val === "white" && currentTheme === "light") ||
                  (val === "midnight" && currentTheme === "dark") ||
                  (val === "slate" && currentTheme === "eink");
    tc.classList.toggle("active", isAct);
  });

  document.querySelectorAll(".theme-chip").forEach((chip) => {
    chip.classList.toggle("active", chip.getAttribute("data-theme-name") === currentTheme);
  });

  if (els.fontSizePopoverLabel) {
    els.fontSizePopoverLabel.textContent = `${state.fontSizePx}px`;
  }
  if (els.justifyToggle) els.justifyToggle.checked = state.isJustified;
  if (els.indentToggle) els.indentToggle.checked = state.hasIndent;
  if (els.bookFlowToggle) els.bookFlowToggle.checked = state.isBookFlow;

  // Cập nhật checkmark cho font options trong Aa popover
  document.querySelectorAll(".font-option").forEach((fo) => {
    const fKey = fo.getAttribute("data-font");
    const isAct = fKey === state.readingFont;
    fo.classList.toggle("active", isAct);
    let check = fo.querySelector(".check-mark");
    if (isAct) {
      if (!check) {
        check = document.createElement("span");
        check.className = "check-mark";
        check.textContent = "✓";
        fo.appendChild(check);
      }
    } else {
      if (check) check.remove();
    }
  });

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
  // Nút quay lại màn hình Home (Thư viện)
  els.backToHomeBtn?.addEventListener("click", () => {
    stopReading();
    showScreen("home");
  });

  // Nút đổi theme trên thanh Home topbar
  els.themeBtn?.addEventListener("click", () => {
    state.themeIndex = (state.themeIndex + 1) % state.themes.length;
    applyReadingPreferences();
    updateThemeButton();
  });

  // Nút cài đặt trên Home
  els.homeSettingsBtn?.addEventListener("click", openSettingsModal);

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

  // Chuyển chương trước / chương sau
  els.prevChapterBtn?.addEventListener("click", goToPrevChapter);
  els.nextChapterBtn?.addEventListener("click", goToNextChapter);

  els.prevSentenceBtn?.addEventListener("click", () => {
    if (state.sentences.length === 0) return;
    const prevIdx = Math.max(0, state.currentSentenceIndex - 1);
    playFromSentence(prevIdx);
  });

  els.nextSentenceBtn?.addEventListener("click", () => {
    if (state.sentences.length === 0) return;
    const nextIdx = Math.min(state.sentences.length - 1, state.currentSentenceIndex + 1);
    playFromSentence(nextIdx);
  });

  // Tua câu ⏪ 5s và ⏩ 10s (hỗ trợ tràn sang câu liền kề)
  els.skipBackBtn?.addEventListener("click", () => seekAudioRelative(-5));
  els.skipForwardBtn?.addEventListener("click", () => seekAudioRelative(10));

  // Tăng giảm tốc độ đọc với Stepper [-] [1.0x] [+] bước nhảy 0.1x
  els.speedDecBtn?.addEventListener("click", () => updateSpeed(-0.1));
  els.speedIncBtn?.addEventListener("click", () => updateSpeed(0.1));

  // Hẹn giờ tắt đọc sách (Sleep Timer)
  els.sleepTimerBtn?.addEventListener("click", (e) => {
    e.stopPropagation();
    if (els.voicePopover) els.voicePopover.hidden = true;
    if (els.speedPopover) els.speedPopover.hidden = true;
    if (els.sleepTimerPopover) {
      els.sleepTimerPopover.hidden = !els.sleepTimerPopover.hidden;
    }
  });

  els.sleepTimerPopover?.addEventListener("click", (e) => {
    const chip = e.target.closest(".chip");
    if (!chip) return;
    const sleepVal = chip.getAttribute("data-sleep");
    setSleepTimer(sleepVal);
  });

  // Chọn giọng đọc qua Popover kiểu Apple Books
  els.voicePill?.addEventListener("click", (e) => {
    e.stopPropagation();
    if (els.sleepTimerPopover) els.sleepTimerPopover.hidden = true;
    if (els.speedPopover) els.speedPopover.hidden = true;
    if (els.voicePopover) {
      els.voicePopover.hidden = !els.voicePopover.hidden;
    }
  });

  els.voicePopoverList?.addEventListener("click", (e) => {
    const chip = e.target.closest(".chip[data-voice-id]");
    if (!chip) return;
    const voiceId = chip.getAttribute("data-voice-id");
    selectVoiceById(voiceId);
  });

  // Khi đổi giọng: DỪNG NGAY LẬP TỨC giọng cũ (0ms latency)
  els.voiceSelect?.addEventListener("change", () => {
    renderVoicePopoverList(els.voiceSelect.value);
    if (state.isPlaying) {
      els.ttsAudio.pause();
      state.playSessionId++;
      playFromSentence(Math.max(0, state.currentSentenceIndex));
    }
  });

  els.speedSelect?.addEventListener("change", () => {
    const speed = parseFloat(els.speedSelect.value || "1.0");
    setReadingSpeed(speed);
  });

  els.ttsAudio.addEventListener("play", () => {
    els.ttsAudio.defaultPlaybackRate = state.speed;
    els.ttsAudio.playbackRate = state.speed;
    els.waveformBars?.classList.add("playing");
    updateMediaSessionPlaybackState("playing");
    updateMediaSessionPosition();
  });

  els.ttsAudio.addEventListener("pause", () => {
    els.waveformBars?.classList.remove("playing");
    if (state.isPaused) {
      updateMediaSessionPlaybackState("paused");
    } else if (!state.isPlaying) {
      updateMediaSessionPlaybackState("none");
    }
    updateMediaSessionPosition();
  });

  els.ttsAudio.addEventListener("ended", () => {
    els.waveformBars?.classList.remove("playing");
  });

  els.ttsAudio.addEventListener("loadedmetadata", () => {
    updateMediaSessionPosition();
  });

  // 4. Menu Aa (Apple Books Popover)
  els.readingSettingsBtn?.addEventListener("click", (e) => {
    e.stopPropagation();
    if (els.moreOptionsPopover) els.moreOptionsPopover.hidden = true;
    if (els.readingSettingsPopover) {
      els.readingSettingsPopover.hidden = !els.readingSettingsPopover.hidden;
    }
  });

  // 4b. Menu [⋯] More Options Popover
  els.moreOptionsBtn?.addEventListener("click", (e) => {
    e.stopPropagation();
    if (els.readingSettingsPopover) els.readingSettingsPopover.hidden = true;
    if (els.moreOptionsPopover) {
      els.moreOptionsPopover.hidden = !els.moreOptionsPopover.hidden;
    }
  });

  // Chọn Theme theo 4 vòng tròn màu kiểu Apple Books
  document.querySelectorAll(".theme-circle, .theme-chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      document.querySelectorAll(".theme-circle, .theme-chip").forEach((c) => c.classList.remove("active"));
      chip.classList.add("active");
      const themeVal = chip.getAttribute("data-theme-val") || chip.getAttribute("data-theme-name") || "sepia";
      const mapped = themeVal === "white" ? "light" : (themeVal === "midnight" ? "dark" : (themeVal === "slate" ? "eink" : themeVal));
      const idx = state.themes.indexOf(mapped);
      if (idx !== -1) {
        state.themeIndex = idx;
      }
      document.documentElement.setAttribute("data-theme", themeVal);
      applyReadingPreferences();
      updateThemeButton();
    });
  });

  // Chọn phông chữ kiểu danh sách Apple Books
  document.querySelectorAll(".font-option, .chip[data-font]").forEach((opt) => {
    opt.addEventListener("click", () => {
      document.querySelectorAll(".font-option, .chip[data-font]").forEach((o) => {
        o.classList.remove("active");
        const check = o.querySelector(".check-mark");
        if (check) check.remove();
      });
      opt.classList.add("active");
      const span = document.createElement("span");
      span.className = "check-mark";
      span.textContent = "✓";
      opt.appendChild(span);
      state.readingFont = opt.getAttribute("data-font");
      applyReadingPreferences();
    });
  });

  // Bấm vào Speed Pill để mở Popover chọn mức tốc độ hoặc kéo thanh trượt custom
  els.speedPillBtn?.addEventListener("click", (e) => {
    e.stopPropagation();
    if (els.voicePopover) els.voicePopover.hidden = true;
    if (els.sleepTimerPopover) els.sleepTimerPopover.hidden = true;
    if (els.speedPopover) {
      els.speedPopover.hidden = !els.speedPopover.hidden;
    }
  });

  els.speedRangeInput?.addEventListener("input", () => {
    const val = parseFloat(els.speedRangeInput.value || "1.0");
    setReadingSpeed(val);
  });

  els.speedPresetGrid?.addEventListener("click", (e) => {
    const chip = e.target.closest(".chip[data-speed]");
    if (!chip) return;
    const val = parseFloat(chip.getAttribute("data-speed") || "1.0");
    setReadingSpeed(val);
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
    if (
      els.moreOptionsPopover &&
      !els.moreOptionsPopover.hidden &&
      !els.moreOptionsPopover.contains(e.target) &&
      e.target !== els.moreOptionsBtn
    ) {
      els.moreOptionsPopover.hidden = true;
    }
    if (
      els.sleepTimerPopover &&
      !els.sleepTimerPopover.hidden &&
      !els.sleepTimerPopover.contains(e.target) &&
      !els.sleepTimerBtn?.contains(e.target)
    ) {
      els.sleepTimerPopover.hidden = true;
    }
    if (
      els.voicePopover &&
      !els.voicePopover.hidden &&
      !els.voicePopover.contains(e.target) &&
      !els.voicePill?.contains(e.target)
    ) {
      els.voicePopover.hidden = true;
    }
    if (
      els.speedPopover &&
      !els.speedPopover.hidden &&
      !els.speedPopover.contains(e.target) &&
      !els.speedPillBtn?.contains(e.target)
    ) {
      els.speedPopover.hidden = true;
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

  els.togglePdfPaneBtn?.addEventListener("click", () => {
    const isHidden = els.pdfPane.hidden;
    els.pdfPane.hidden = !isHidden;
    const txt = document.getElementById("togglePdfText");
    if (txt) {
      txt.textContent = els.pdfPane.hidden ? "Hiện trang PDF gốc" : "Ẩn trang PDF gốc";
    }
    if (els.pdfPane.hidden) {
      els.splitContainer.classList.add("single-pane");
    } else {
      els.splitContainer.classList.remove("single-pane");
    }
  });

  els.showPdfPaneBtn?.addEventListener("click", () => {
    els.pdfPane.hidden = false;
    els.splitContainer.classList.remove("single-pane");
    const txt = document.getElementById("togglePdfText");
    if (txt) txt.textContent = "Ẩn trang PDF gốc";
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

  // 11. Mục lục, Dấu trang & Highlights (Drawer)
  els.drawerToggleBtn?.addEventListener("click", toggleDrawer);
  els.closeDrawerBtn?.addEventListener("click", closeDrawer);
  els.drawerBackdrop?.addEventListener("click", closeDrawer);
  els.tabBtnToc?.addEventListener("click", () => switchDrawerTab("toc"));
  els.tabBtnBookmarks?.addEventListener("click", () => switchDrawerTab("bookmarks"));
  els.tabBtnHighlights?.addEventListener("click", () => switchDrawerTab("highlights"));
  els.bookmarkRibbonBtn?.addEventListener("click", toggleBookmarkCurrentPage);
  els.headerBookmarkBtn?.addEventListener("click", toggleBookmarkCurrentPage);
  els.drawerAddBookmarkActionBtn?.addEventListener("click", toggleBookmarkCurrentPage);

  // 12. Modal Phím tắt
  els.shortcutsBtn?.addEventListener("click", openShortcutsModal);
  els.closeShortcutsBtn?.addEventListener("click", closeShortcutsModal);
  els.closeShortcutsFooterBtn?.addEventListener("click", closeShortcutsModal);
  els.shortcutsModal?.addEventListener("click", (e) => {
    if (e.target === els.shortcutsModal) closeShortcutsModal();
  });

  // 13. Modal Tra từ điển Tiếng Việt
  els.closeDictBtn?.addEventListener("click", closeDictModal);
  els.closeDictFooterBtn?.addEventListener("click", closeDictModal);
  els.dictModal?.addEventListener("click", (e) => {
    if (e.target === els.dictModal) closeDictModal();
  });
  els.dictSearchBtn?.addEventListener("click", () => lookupWord());
  els.dictSearchInput?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") lookupWord();
  });

  // 14. Floating Selection Action Bar
  els.floatHighlightBtn?.addEventListener("click", (e) => {
    e.stopPropagation();
    applyHighlight("yellow");
  });

  els.floatingSelectionBar?.querySelectorAll(".hl-color-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const color = btn.getAttribute("data-color");
      applyHighlight(color);
    });
  });

  els.floatLookupBtn?.addEventListener("click", (e) => {
    e.stopPropagation();
    if (currentSelectedText) {
      openDictModal(currentSelectedText);
    }
    if (els.floatingSelectionBar) els.floatingSelectionBar.hidden = true;
  });

  els.floatSpeakBtn?.addEventListener("click", (e) => {
    e.stopPropagation();
    if (currentSelectedText) {
      const q = currentSelectedText.trim();
      let idx = state.sentences.findIndex((s) => s.includes(q) || q.includes(s));
      if (idx < 0) {
        const firstWords = q.split(/\s+/).slice(0, 3).join(" ");
        if (firstWords.length >= 3) {
          idx = state.sentences.findIndex((s) => s.includes(firstWords));
        }
      }
      if (idx >= 0) playFromSentence(idx);
    }
    if (els.floatingSelectionBar) els.floatingSelectionBar.hidden = true;
  });

  els.floatCopyBtn?.addEventListener("click", async (e) => {
    e.stopPropagation();
    if (currentSelectedText) {
      await navigator.clipboard.writeText(currentSelectedText);
    }
    if (els.floatingSelectionBar) els.floatingSelectionBar.hidden = true;
  });

  // 15. Phím tắt bàn phím E-Reader
  window.addEventListener("keydown", (e) => {
    const tag = document.activeElement?.tagName?.toLowerCase();
    if (tag === "input" || tag === "textarea" || tag === "select") return;

    if (e.code === "Space" && state.sentences.length > 0) {
      e.preventDefault();
      togglePlayPause();
    } else if (e.key === "j" || e.key === "J") {
      e.preventDefault();
      goToPrevChapter();
    } else if (e.key === "k" || e.key === "K") {
      e.preventDefault();
      goToNextChapter();
    } else if (e.code === "ArrowLeft" && state.docId && state.currentPage > 1) {
      e.preventDefault();
      goToPage(state.currentPage - 1, false);
    } else if (e.code === "ArrowRight" && state.docId && state.currentPage < state.totalPages) {
      e.preventDefault();
      goToPage(state.currentPage + 1, false);
    } else if (e.code === "KeyB") {
      e.preventDefault();
      toggleBookmarkCurrentPage();
    } else if (e.code === "KeyM") {
      e.preventDefault();
      toggleDrawer();
    } else if (e.code === "KeyF") {
      e.preventDefault();
      toggleZenMode();
    } else if (e.key === "?" || (e.shiftKey && e.code === "Slash")) {
      e.preventDefault();
      openShortcutsModal();
    } else if (e.code === "Escape") {
      if (state.isZenMode) toggleZenMode();
      if (els.readingSettingsPopover && !els.readingSettingsPopover.hidden) {
        els.readingSettingsPopover.hidden = true;
      }
      if (els.sleepTimerPopover && !els.sleepTimerPopover.hidden) {
        els.sleepTimerPopover.hidden = true;
      }
      if (els.voicePopover && !els.voicePopover.hidden) {
        els.voicePopover.hidden = true;
      }
      if (els.speedPopover && !els.speedPopover.hidden) {
        els.speedPopover.hidden = true;
      }
      if (els.floatingSelectionBar && !els.floatingSelectionBar.hidden) {
        els.floatingSelectionBar.hidden = true;
      }
      closeDrawer();
      closeDictModal();
      closeShortcutsModal();
      closeSettingsModal();
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
    state.toc = info.toc || [];

    // Tải danh sách overview tất cả các trang
    try {
      const pagesRes = await fetch(`/api/doc/${info.doc_id}/pages`);
      if (pagesRes.ok) {
        const pagesData = await pagesRes.json();
        state.pagesOverview = pagesData.pages || [];
      }
    } catch (_) {}

    renderTocList();
    await loadAnnotations();

    saveRecentBook(info.doc_id, info.filename, info.page_count);
    showScreen("reader");

    // Cập nhật UI: Đọc sách Single-pane tối giản kiểu Apple Books (chỉ hiện chữ, ẩn file PDF gốc)
    els.emptyState.hidden = true;
    els.splitContainer.hidden = false;
    els.pdfPane.hidden = true;
    els.splitContainer.classList.add("single-pane");
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

async function goToPrevChapter() {
  if (!state.docId) state.docId = "demo_hanoi";

  // 1. Nếu có mục lục hợp lệ
  if (state.toc && state.toc.length > 0) {
    const prevChapters = state.toc
      .filter((item) => Number(item.page) < state.currentPage)
      .sort((a, b) => Number(b.page) - Number(a.page));

    if (prevChapters.length > 0) {
      await goToPage(Number(prevChapters[0].page), false);
      return;
    }
  }

  // 2. Nếu không có chương nào trước đó hoặc tài liệu không có mục lục:
  // Lùi về trang trước (như hành vi đọc sách tiêu chuẩn)
  if (state.currentPage > 1) {
    await goToPage(state.currentPage - 1, false);
  }
}

async function goToNextChapter() {
  if (!state.docId) state.docId = "demo_hanoi";

  // 1. Nếu có mục lục hợp lệ
  if (state.toc && state.toc.length > 0) {
    const nextChapters = state.toc
      .filter((item) => Number(item.page) > state.currentPage)
      .sort((a, b) => Number(a.page) - Number(b.page));

    if (nextChapters.length > 0) {
      await goToPage(Number(nextChapters[0].page), false);
      return;
    }
  }

  // 2. Nếu không còn chương nào tiếp theo hoặc tài liệu không có mục lục:
  // Chuyển sang trang tiếp theo (tiến từng trang một, không bao giờ nhảy vụt về cuối sách)
  if (state.currentPage < state.totalPages) {
    await goToPage(state.currentPage + 1, false);
  }
}

async function goToPage(pageNumber, autoPlay = false) {
  if (!state.docId) state.docId = "demo_hanoi";
  stopReading();

  state.currentPage = pageNumber;
  state.ocrSessionId = (state.ocrSessionId || 0) + 1;
  state.isOcrRunning = false;
  if (els.ocrProgressBox) els.ocrProgressBox.hidden = true;
  if (els.ocrPageBtn) els.ocrPageBtn.disabled = false;
  window.scrollTo({ top: 0, behavior: "smooth" });
  saveRecentBook(state.docId, state.filename, state.totalPages, pageNumber);
  els.pageInput.value = pageNumber;
  els.prevPageBtn.disabled = pageNumber <= 1;
  els.nextPageBtn.disabled = pageNumber >= state.totalPages;
  if (els.bookPrevPageBtn) els.bookPrevPageBtn.disabled = pageNumber <= 1;
  if (els.bookNextPageBtn) els.bookNextPageBtn.disabled = pageNumber >= state.totalPages;

  // Cập nhật trạng thái ribbon bookmark cho trang hiện tại
  updateBookmarkRibbonState();
  updateHighlightActiveTocItem();
  renderHighlightsOnPage();

  if (state.docId === "demo_hanoi") {
    // Sách demo prototype: cập nhật tiêu đề chương theo trang
    const ch = (state.toc || []).find((item) => item.page === pageNumber);
    if (ch && els.chapterTitle) {
      els.chapterTitle.textContent = ch.title;
    }
    return;
  }

  // Hiển thị ảnh trang PDF gốc
  els.pdfPageImage.src = `/api/doc/${state.docId}/page/${pageNumber}/image?dpi=170`;

  // Tải văn bản trang đã được sửa lỗi font
  const mode = els.encodingModeSelect.value || "auto";
  try {
    const res = await fetch(`/api/doc/${state.docId}/page/${pageNumber}?mode=${mode}`);
    if (!res.ok) throw new Error("Không thể trích xuất văn bản trang này");
    const data = await res.json();
    applyPageData(data);
    updateBookmarkRibbonState();
    updateHighlightActiveTocItem();
    renderHighlightsOnPage();

    // Tự động quét OCR nếu trang bị lỗi font hoặc là ảnh scan
    if (data.needs_ocr && els.autoOcrCheckbox.checked) {
      console.log(`[OCR] Trang ${pageNumber} cần OCR, đang kích hoạt Tesseract.js...`);
      runBrowserVietnameseOcr(autoPlay);
      return;
    }

    if (autoPlay && state.sentences.length > 0) {
      playFromSentence(0);
    } else if (!autoPlay && state.sentences.length > 0) {
      prewarmFirstSentenceOnPage();
    }
  } catch (err) {
    console.error("Lỗi tải trang:", err);
  }
}

function applyPageData(data) {
  state.cleanText = data.text || "";
  state.sentences = data.sentences || [];
  state.currentSentenceIndex = -1;

  // Cập nhật tiêu đề chương nếu trang này trùng với một mục trong Mục lục (TOC)
  updateChapterHeaderForCurrentPage();

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
  els.downloadMp3Btn.disabled = !(state.docId || hasSentences);
  if (els.skipBackBtn) els.skipBackBtn.disabled = !hasSentences;
  if (els.skipForwardBtn) els.skipForwardBtn.disabled = !hasSentences;

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
        // Nhận diện tiêu đề chương/mục thực sự (không coi câu hội thoại ngắn như "Anh ấy nói:" là heading)
        const isHeading =
          para.length === 1 &&
          fullText.length < 65 &&
          !fullText.endsWith(".") &&
          !fullText.endsWith(":") &&
          !fullText.endsWith("?") &&
          !fullText.endsWith("!");
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

  renderHighlightsOnPage();
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
  const targetDocId = state.docId;
  const targetPage = state.currentPage;
  const myOcrSession = ++state.ocrSessionId;
  state.isOcrRunning = true;
  els.ocrPageBtn.disabled = true;
  els.ocrProgressBox.hidden = false;
  els.ocrProgressText.textContent = "Đang khởi tạo bộ nhận diện chữ Tiếng Việt (OCR)...";
  els.ocrProgressPercent.textContent = "0%";
  els.ocrProgressBar.style.width = "0%";

  try {
    const imageUrl = `/api/doc/${targetDocId}/page/${targetPage}/image?dpi=220&enhance=true`;

    if (!state.ocrWorker) {
      state.ocrWorker = await Tesseract.createWorker("vie", 1, {
        logger: (m) => {
          if (myOcrSession !== state.ocrSessionId) return;
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

    // Nếu người dùng đã chuyển sang trang khác hoặc tài liệu khác trong lúc chờ OCR, HỦY kết quả cũ!
    if (
      myOcrSession !== state.ocrSessionId ||
      state.docId !== targetDocId ||
      state.currentPage !== targetPage
    ) {
      return;
    }

    await processRawTextFromClient(
      text,
      "Đã quét OCR Tiếng Việt từ ảnh trang PDF và nối câu hoàn chỉnh.",
      "ocr_vi"
    );

    if (autoPlayAfter && state.sentences.length > 0 && myOcrSession === state.ocrSessionId) {
      playFromSentence(0);
    }
  } catch (err) {
    if (myOcrSession === state.ocrSessionId) {
      console.error("OCR Error:", err);
      alert(`Lỗi khi quét OCR: ${err.message}`);
    }
  } finally {
    if (myOcrSession === state.ocrSessionId) {
      state.isOcrRunning = false;
      els.ocrPageBtn.disabled = false;
      els.ocrProgressBox.hidden = true;
    }
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
function setPlayButtonVisual(stateName) {
  if (stateName === "playing") {
    if (els.playPauseBtn) els.playPauseBtn.title = "Tạm dừng (Phím Space)";
    els.waveformBars?.classList.remove("loading");
    els.waveformBars?.classList.add("playing");
    updateMediaSessionPlaybackState("playing");
  } else if (stateName === "loading") {
    if (els.playPauseBtn) els.playPauseBtn.title = "Đang tải âm thanh...";
    els.waveformBars?.classList.remove("playing");
    els.waveformBars?.classList.add("loading");
  } else if (stateName === "paused") {
    if (els.playPauseBtn) els.playPauseBtn.title = "Tiếp tục đọc (Phím Space)";
    els.waveformBars?.classList.remove("playing", "loading");
    updateMediaSessionPlaybackState("paused");
  } else {
    if (els.playPauseBtn) els.playPauseBtn.title = "Đọc ngay (Phím Space)";
    els.waveformBars?.classList.remove("playing", "loading");
    updateMediaSessionPlaybackState("none");
  }
}

function togglePlayPause() {
  if (state.sentences.length === 0) return;

  if (state.isPlaying && !state.isPaused) {
    state.isPaused = true;
    els.ttsAudio.pause();
    setPlayButtonVisual("paused");
  } else if (state.isPlaying && state.isPaused) {
    state.isPaused = false;
    els.ttsAudio.play();
    setPlayButtonVisual("playing");
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
  setPlayButtonVisual("stopped");
  highlightSentence(-1);
  updateMediaSessionPlaybackState("none");
}

async function fetchSentenceAudioUrl(sentenceText) {
  const voice = els.voiceSelect.value;
  // Luôn gửi speed: 1.0 lên server để tối đa hóa cache hit và triệt tiêu lỗi nhân đôi tốc độ
  const cacheKey = `${voice}|${sentenceText}`;

  if (state.audioBlobCache.has(cacheKey)) {
    return state.audioBlobCache.get(cacheKey);
  }

  // Nếu câu này đang được prefetch (pending trên mạng), tái sử dụng ngay Promise đó
  // thay vì bắn thêm request thứ 2 vào /api/tts gây nghẽn hàng đợi!
  if (state.inFlightAudioPromises.has(cacheKey)) {
    return state.inFlightAudioPromises.get(cacheKey);
  }

  const fetchPromise = (async () => {
    try {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: sentenceText,
          voice,
          speed: 1.0,
        }),
      });

      if (!res.ok) {
        throw new Error("Không tạo được âm thanh TTS từ server");
      }

      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      state.audioBlobCache.set(cacheKey, blobUrl);
      return blobUrl;
    } finally {
      state.inFlightAudioPromises.delete(cacheKey);
    }
  })();

  state.inFlightAudioPromises.set(cacheKey, fetchPromise);
  return fetchPromise;
}

async function prefetchUpcomingSentences(fromIndex, expectedSessionId = state.playSessionId) {
  for (let offset = 1; offset <= 4; offset++) {
    // Nếu người dùng đã bấm dừng hoặc nhảy sang câu/trang khác, dừng ngay vòng lặp prefetch cũ
    if (expectedSessionId !== state.playSessionId || !state.isPlaying) {
      break;
    }
    const idx = fromIndex + offset;
    if (idx < state.sentences.length) {
      try {
        await fetchSentenceAudioUrl(state.sentences[idx]);
      } catch (_) {}
    }
  }
}

function prewarmFirstSentenceOnPage() {
  if (!state.sentences || state.sentences.length === 0 || state.isPlaying) return;
  const firstSentence = state.sentences[0];
  if (firstSentence && firstSentence.trim().length > 1) {
    fetchSentenceAudioUrl(firstSentence).catch(() => {});
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
  setPlayButtonVisual("loading");
  highlightSentence(index);

  try {
    const audioUrl = await fetchSentenceAudioUrl(state.sentences[index]);
    if (sessionId !== state.playSessionId) return;

    els.ttsAudio.src = audioUrl;
    els.ttsAudio.defaultPlaybackRate = state.speed;
    els.ttsAudio.playbackRate = state.speed;
    setPlayButtonVisual("playing");
    updateMediaSession(index);

    els.ttsAudio.onended = () => {
      if (sessionId !== state.playSessionId) return;
      const nextIdx = index + 1;
      if (nextIdx < state.sentences.length) {
        playFromSentence(nextIdx);
      } else if (state.sleepStopOnPageEnd) {
        stopReading();
        cancelSleepTimer();
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
    prefetchUpcomingSentences(index, sessionId);
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
  utter.rate = state.speed;
  setPlayButtonVisual("playing");

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

let bookExportAbortController = null;
let bookExportSavePartialRequested = false;
let appleToastTimer = null;

function showAppleToast(message, icon = "🎧", durationMs = 4500) {
  if (!els.appleToast || !els.appleToastText) return;
  if (els.appleToastIcon) els.appleToastIcon.textContent = icon;
  els.appleToastText.textContent = message;
  els.appleToast.hidden = false;
  if (appleToastTimer) clearTimeout(appleToastTimer);
  appleToastTimer = setTimeout(() => {
    if (els.appleToast) els.appleToast.hidden = true;
  }, durationMs);
}

function stripMp3XingHeader(arrayBuffer) {
  const bytes = new Uint8Array(arrayBuffer);
  if (bytes.length < 256) return arrayBuffer;
  // Kiểm tra chữ ký 'Xing' hoặc 'Info' trong 220 bytes đầu tiên (khiến trình phát nhạc chỉ đọc thời lượng trang 1)
  let hasXing = false;
  const limit = Math.min(220, bytes.length - 4);
  for (let i = 0; i < limit; i++) {
    if (
      (bytes[i] === 0x58 && bytes[i + 1] === 0x69 && bytes[i + 2] === 0x6e && bytes[i + 3] === 0x67) || // 'Xing'
      (bytes[i] === 0x49 && bytes[i + 1] === 0x6e && bytes[i + 2] === 0x66 && bytes[i + 3] === 0x6f)    // 'Info'
    ) {
      hasXing = true;
      break;
    }
  }
  if (!hasXing) return arrayBuffer;
  // Tìm frame MP3 kế tiếp (0xFF 0xF3 hoặc 0xFF 0xFB)
  for (let j = 4; j < Math.min(512, bytes.length - 1); j++) {
    if (bytes[j] === 0xff && (bytes[j + 1] === 0xf3 || bytes[j + 1] === 0xfb)) {
      return arrayBuffer.slice(j);
    }
  }
  return arrayBuffer;
}

function triggerAudioFileDownload(buffers, fileName) {
  if (!buffers || buffers.length === 0) return;
  const cleanBuffers = buffers.map((b) => stripMp3XingHeader(b));
  const mergedBlob = new Blob(cleanBuffers, { type: "audio/mpeg" });
  const url = URL.createObjectURL(mergedBlob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

function setDownloadMenuText(label, icon = "🎧") {
  if (!els.downloadMp3Btn) return;
  const iconEl = els.downloadMp3Btn.querySelector(".menu-icon");
  const textEl = els.downloadMp3Btn.querySelector(".menu-text");
  if (iconEl && textEl) {
    iconEl.textContent = icon;
    textEl.textContent = label;
  } else {
    els.downloadMp3Btn.textContent = `${icon} ${label}`;
  }
}

async function downloadFullPageMp3() {
  if (!state.docId && !state.cleanText) return;

  // Nếu đang chạy ngầm mà người dùng bấm lại vào nút này trong menu ⋯ -> Lưu ngay phần đã xong!
  if (bookExportAbortController) {
    bookExportSavePartialRequested = true;
    bookExportAbortController.abort();
    if (els.moreOptionsPopover) els.moreOptionsPopover.hidden = true;
    return;
  }

  if (els.moreOptionsPopover) els.moreOptionsPopover.hidden = true;

  const voice = els.voiceSelect?.value || "kokoro-thanh_dat";
  const speed = state.speed || 1.0;
  const baseName = state.filename ? state.filename.replace(/\.pdf$/i, "") : "Sach_Noi_VN_PDF";

  // Trường hợp văn bản dán trực tiếp hoặc sách mẫu không có docId thật trên server
  if (!state.docId || state.docId === "demo_hanoi" || (state.totalPages || 1) <= 1) {
    if (!state.cleanText) return;
    showAppleToast("Đang tạo Sách Nói MP3 chạy ngầm...", "🎧", 4000);
    setDownloadMenuText("Đang tạo MP3 ngầm...", "⏳");
    try {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: state.cleanText,
          voice,
          speed,
          sentences: state.sentences || [],
        }),
      });
      if (!res.ok) throw new Error("Không thể xuất file MP3");
      const buf = await res.arrayBuffer();
      triggerAudioFileDownload([buf], `${baseName}_Full_Audiobook.mp3`);
      showAppleToast("Đã tạo xong Sách Nói MP3! Đang tải file về máy.", "✅", 5000);
    } catch (err) {
      showAppleToast(`Lỗi tải MP3: ${err.message}`, "⚠️", 5000);
    } finally {
      setDownloadMenuText("Tải MP3 toàn bộ sách", "🎧");
    }
    return;
  }

  // Trường hợp Xuất Sách Nói chạy ngầm cho TOÀN BỘ SÁCH PDF (1 -> totalPages)
  const total = state.totalPages;
  const pageAudioSlot = new Array(total + 1).fill(null);
  let completedCount = 0;
  let lastCompletedPage = 0;

  bookExportAbortController = new AbortController();
  bookExportSavePartialRequested = false;

  // Tự động co giãn theo phần cứng máy: Máy <= 4 luồng chạy tuần tự (1 worker), máy > 4 luồng chạy pipeline (2 workers)
  const hwCores = Number(navigator.hardwareConcurrency) || 4;
  const maxPageWorkers = hwCores <= 4 ? 1 : 2;

  showAppleToast(
    `Đang tạo Sách Nói MP3 ngầm (${total} trang)... Sẽ thông báo khi hoàn tất!`,
    "🎧",
    4500
  );
  setDownloadMenuText(`Đang tạo ngầm (1/${total}) • Bấm để lưu ngay`, "⏳");

  const collectOrderedBuffers = () => {
    const out = [];
    let maxPage = 0;
    for (let idx = 1; idx <= total; idx++) {
      if (pageAudioSlot[idx]) {
        if (pageAudioSlot[idx].byteLength > 128) {
          out.push(pageAudioSlot[idx]);
        }
        maxPage = idx;
      }
    }
    if (maxPage > lastCompletedPage) lastCompletedPage = maxPage;
    return out;
  };

  try {
    const encodingMode = els.encodingModeSelect?.value || "auto";
    const pageTextPromises = new Map();

    const fetchPageContent = (pageNum) => {
      if (pageNum < 1 || pageNum > total) return Promise.resolve({ text: "", sentences: [] });
      if (pageNum === state.currentPage && state.cleanText) {
        return Promise.resolve({
          text: state.cleanText.trim(),
          sentences: Array.isArray(state.sentences) ? state.sentences : [],
        });
      }
      if (pageTextPromises.has(pageNum)) {
        return pageTextPromises.get(pageNum);
      }
      const pPromise = fetch(
        `/api/doc/${state.docId}/page/${pageNum}?mode=${encodeURIComponent(encodingMode)}`,
        { signal: bookExportAbortController.signal }
      )
        .then(async (res) => {
          if (!res.ok) return { text: "", sentences: [] };
          const data = await res.json();
          return {
            text: (data.text || data.clean_text || "").trim(),
            sentences: Array.isArray(data.sentences) ? data.sentences : [],
          };
        })
        .catch((err) => {
          if (err.name === "AbortError") throw err;
          return { text: "", sentences: [] };
        });
      pageTextPromises.set(pageNum, pPromise);
      return pPromise;
    };

    // Khởi động đọc trước văn bản của 2 trang đầu tiên
    fetchPageContent(1).catch(() => {});
    if (total >= 2) fetchPageContent(2).catch(() => {});

    let nextPageCursor = 1;

    const runExportWorker = async () => {
      while (nextPageCursor <= total && !bookExportAbortController.signal.aborted) {
        const p = nextPageCursor++;
        // Đọc trước (Prefetch) văn bản của trang kế tiếp trong lúc tổng hợp âm thanh
        if (p + 1 <= total) fetchPageContent(p + 1).catch(() => {});

        // Nhường ưu tiên CPU/TTS cho người dùng nếu đang bật nghe trực tiếp (Live Reading)
        while (state.isPlaying && !state.isPaused && !bookExportAbortController.signal.aborted) {
          setDownloadMenuText(`Tạm nhường ưu tiên đọc trực tiếp (${completedCount}/${total})`, "⏸️");
          await new Promise((r) => setTimeout(r, 800));
        }
        if (bookExportAbortController.signal.aborted) break;

        setDownloadMenuText(
          `Đang tạo ngầm (Trang ${Math.min(total, completedCount + 1)}/${total}) • Bấm để lưu ngay`,
          "⏳"
        );

        const { text: pageCleanText, sentences: pageSentences } = await fetchPageContent(p);
        pageTextPromises.delete(p);

        if (!pageCleanText || pageCleanText.length < 2) {
          pageAudioSlot[p] = new ArrayBuffer(0);
          completedCount++;
          lastCompletedPage = Math.max(lastCompletedPage, p);
          continue;
        }

        // Nếu toàn bộ các câu của trang đã nằm sẵn trong bộ nhớ trình duyệt (state.audioBlobCache),
        // ghép trực tiếp trong < 2ms mà không cần gọi lại API!
        const speedSuffix = Math.abs(speed - 1.0) > 0.01 ? `|speed_${speed.toFixed(2)}` : "";
        let assembledFromMemCache = false;
        if (pageSentences.length > 0) {
          const allInMem = pageSentences.every((s) =>
            state.audioBlobCache.has(`${voice}${speedSuffix}|${s.trim()}`)
          );
          if (allInMem) {
            try {
              const partBuffers = await Promise.all(
                pageSentences.map(async (s) => {
                  const blobUrl = state.audioBlobCache.get(`${voice}${speedSuffix}|${s.trim()}`);
                  const r = await fetch(blobUrl);
                  const ab = await r.arrayBuffer();
                  return stripMp3XingHeader(ab);
                })
              );
              const mergedPageBlob = new Blob(partBuffers, { type: "audio/mpeg" });
              const mergedAb = await mergedPageBlob.arrayBuffer();
              if (mergedAb && mergedAb.byteLength > 128) {
                pageAudioSlot[p] = mergedAb;
                completedCount++;
                lastCompletedPage = Math.max(lastCompletedPage, p);
                assembledFromMemCache = true;
              }
            } catch (_) {}
          }
        }
        if (assembledFromMemCache) continue;

        const ttsRes = await fetch("/api/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: pageCleanText,
            voice,
            speed,
            sentences: pageSentences,
          }),
          signal: bookExportAbortController.signal,
        });

        if (ttsRes.ok) {
          const buf = await ttsRes.arrayBuffer();
          if (buf && buf.byteLength > 128) {
            pageAudioSlot[p] = buf;
            completedCount++;
            lastCompletedPage = Math.max(lastCompletedPage, p);
          }
        }
      }
    };

    const workers = [];
    for (let w = 0; w < Math.min(maxPageWorkers, total); w++) {
      workers.push(runExportWorker());
    }
    await Promise.all(workers);

    const audioBuffers = collectOrderedBuffers();

    if (bookExportSavePartialRequested && audioBuffers.length > 0) {
      triggerAudioFileDownload(
        audioBuffers,
        `${baseName}_Trang_1-${lastCompletedPage}_Audiobook.mp3`
      );
      showAppleToast(
        `Đã lưu Sách Nói MP3 (Trang 1–${lastCompletedPage}) thành công!`,
        "✅",
        5000
      );
    } else if (!bookExportAbortController.signal.aborted && audioBuffers.length > 0) {
      triggerAudioFileDownload(audioBuffers, `${baseName}_Full_Audiobook.mp3`);
      showAppleToast(
        `Đã tạo xong Sách Nói MP3 toàn bộ sách (${total} trang)! Đang tải về máy.`,
        "✅",
        6000
      );
    }
  } catch (err) {
    const audioBuffers = collectOrderedBuffers();
    if (err.name === "AbortError") {
      if (bookExportSavePartialRequested && audioBuffers.length > 0) {
        triggerAudioFileDownload(
          audioBuffers,
          `${baseName}_Trang_1-${lastCompletedPage}_Audiobook.mp3`
        );
        showAppleToast(
          `Đã lưu Sách Nói MP3 (Trang 1–${lastCompletedPage}) thành công!`,
          "✅",
          5000
        );
      } else {
        showAppleToast("Đã hủy tiến trình tạo Sách Nói MP3.", "ℹ️", 3500);
      }
    } else {
      showAppleToast(`Lỗi xuất Sách Nói MP3: ${err.message}`, "⚠️", 5000);
    }
  } finally {
    bookExportAbortController = null;
    bookExportSavePartialRequested = false;
    setDownloadMenuText("Tải MP3 toàn bộ sách", "🎧");
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

// ============================================================================
// 6. TIỆN ÍCH E-READER MỚI (DRAWER, BOOKMARKS, HIGHLIGHTS, DICT, AUDIO SCRUBBER)
// ============================================================================

function seekAudioRelative(delta) {
  if (!els.ttsAudio) return;
  if (state.sentences.length === 0) return;

  // Nếu chưa phát, bắt đầu phát từ câu hiện tại (hoặc câu 0)
  if (!state.isPlaying || state.currentSentenceIndex < 0) {
    const startIdx = state.currentSentenceIndex >= 0 ? state.currentSentenceIndex : 0;
    playFromSentence(startIdx);
    return;
  }

  const duration = els.ttsAudio.duration;
  const currentTime = els.ttsAudio.currentTime || 0;

  if (isNaN(duration) || duration <= 0) {
    // Audio chưa load xong metadata
    if (delta < 0 && state.currentSentenceIndex > 0) {
      playFromSentence(state.currentSentenceIndex - 1);
    } else if (delta > 0 && state.currentSentenceIndex + 1 < state.sentences.length) {
      playFromSentence(state.currentSentenceIndex + 1);
    }
    return;
  }

  const newTime = currentTime + delta;
  if (newTime < 0) {
    if (state.currentSentenceIndex > 0) {
      playFromSentence(state.currentSentenceIndex - 1);
    } else {
      els.ttsAudio.currentTime = 0;
    }
  } else if (newTime >= duration) {
    if (state.currentSentenceIndex + 1 < state.sentences.length) {
      playFromSentence(state.currentSentenceIndex + 1);
    } else {
      // Câu cuối cùng của trang: kích hoạt onended để tự lật trang hoặc dừng đọc
      if (typeof els.ttsAudio.onended === "function") {
        els.ttsAudio.onended();
      } else {
        stopReading();
      }
    }
  } else {
    els.ttsAudio.currentTime = Math.max(0, Math.min(duration, newTime));
    updateMediaSessionPosition();
  }
}

function formatSpeedLabel(val) {
  const num = Number(val);
  if (Number.isInteger(num)) return `${num.toFixed(1)}x`;
  return `${parseFloat(num.toFixed(2))}x`;
}

function setReadingSpeed(val) {
  const clamped = Math.max(0.5, Math.min(2.5, +(parseFloat(val) || 1.0).toFixed(2)));
  state.speed = clamped;
  const formatted = formatSpeedLabel(clamped);
  if (els.speedValLabel) els.speedValLabel.textContent = formatted;
  if (els.speedRangeValLabel) els.speedRangeValLabel.textContent = formatted;
  if (els.speedRangeInput) els.speedRangeInput.value = String(clamped);
  if (els.speedSelect) els.speedSelect.value = String(clamped);
  if (els.ttsAudio) {
    els.ttsAudio.defaultPlaybackRate = clamped;
    els.ttsAudio.playbackRate = clamped;
    updateMediaSessionPosition();
  }

  // Cập nhật trạng thái active trên các preset chips
  els.speedPresetGrid?.querySelectorAll(".chip[data-speed]").forEach((chip) => {
    const presetVal = parseFloat(chip.getAttribute("data-speed") || "0");
    const isAct = Math.abs(presetVal - clamped) < 0.01;
    chip.classList.toggle("active", isAct);
    let check = chip.querySelector(".check-mark");
    if (isAct) {
      if (!check) {
        check = document.createElement("span");
        check.className = "check-mark";
        check.textContent = "✓";
        chip.appendChild(check);
      }
    } else if (check) {
      check.remove();
    }
  });
}

function updateSpeed(delta) {
  setReadingSpeed(state.speed + delta);
}

function updateSleepButtonIcon(isActive) {
  const iconEl = els.sleepTimerIcon || els.sleepTimerBtn;
  if (!iconEl) return;
  iconEl.textContent = isActive ? "⏳" : "🌙";
}

function setSleepTimer(val) {
  cancelSleepTimer();
  state.sleepTimerMode = val;

  els.sleepTimerPopover?.querySelectorAll(".chip").forEach((c) => {
    c.classList.toggle("active", c.getAttribute("data-sleep") === String(val));
  });

  if (val === 0 || val === "0") {
    if (els.sleepCountdownLabel) els.sleepCountdownLabel.hidden = true;
    if (els.sleepTimerBtn) {
      els.sleepTimerBtn.classList.remove("active");
      els.sleepTimerBtn.title = "Hẹn giờ ngủ (Sleep Timer)";
    }
    updateSleepButtonIcon(false);
    return;
  }

  if (els.sleepTimerBtn) els.sleepTimerBtn.classList.add("active");
  updateSleepButtonIcon(true);

  if (val === "page") {
    if (els.sleepCountdownLabel) {
      els.sleepCountdownLabel.hidden = false;
      els.sleepTimeRemaining.textContent = "Hết trang này";
    }
    if (els.sleepTimerBtn) els.sleepTimerBtn.title = "Hẹn giờ: Dừng khi đọc hết trang";
    state.sleepStopOnPageEnd = true;
    return;
  }

  const minutes = parseInt(val, 10);
  state.sleepTimerEndTimestamp = Date.now() + minutes * 60 * 1000;
  if (els.sleepCountdownLabel) els.sleepCountdownLabel.hidden = false;
  updateSleepTimerDisplay();

  state.sleepTimerInterval = setInterval(() => {
    updateSleepTimerDisplay();
  }, 1000);
}

function updateSleepTimerDisplay() {
  if (!state.sleepTimerEndTimestamp) return;
  const remainingSec = Math.max(0, Math.round((state.sleepTimerEndTimestamp - Date.now()) / 1000));
  if (els.sleepTimeRemaining) els.sleepTimeRemaining.textContent = formatTime(remainingSec);
  if (els.sleepTimerBtn) els.sleepTimerBtn.title = `Hẹn giờ ngủ: còn ${formatTime(remainingSec)}`;

  // Hiệu ứng fade-out âm lượng 10s cuối
  if (remainingSec <= 10 && remainingSec > 0) {
    els.ttsAudio.volume = Math.max(0, remainingSec / 10.0);
  } else if (remainingSec === 0) {
    stopReading();
    cancelSleepTimer();
    els.ttsAudio.volume = 1.0;
  }
}

function cancelSleepTimer() {
  if (state.sleepTimerInterval) {
    clearInterval(state.sleepTimerInterval);
    state.sleepTimerInterval = null;
  }
  state.sleepTimerEndTimestamp = null;
  state.sleepStopOnPageEnd = false;
  if (els.ttsAudio) els.ttsAudio.volume = 1.0;
  if (els.sleepTimerBtn) els.sleepTimerBtn.classList.remove("active");
  updateSleepButtonIcon(false);
}

function formatTime(sec) {
  if (!sec || isNaN(sec) || sec < 0) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s < 10 ? "0" : ""}${s}`;
}

function updateMediaSessionPlaybackState(playbackState) {
  if (!("mediaSession" in navigator)) return;
  try {
    navigator.mediaSession.playbackState = playbackState;
  } catch (_) {}
}

function updateMediaSessionPosition() {
  if (!("mediaSession" in navigator) || !("setPositionState" in navigator.mediaSession)) return;
  const dur = els.ttsAudio?.duration;
  if (dur && !isNaN(dur) && dur > 0 && isFinite(dur)) {
    try {
      const cur = Math.min(Math.max(0, els.ttsAudio.currentTime || 0), dur);
      navigator.mediaSession.setPositionState({
        duration: dur,
        playbackRate: state.speed || 1.0,
        position: cur,
      });
    } catch (_) {}
  }
}

function setupAudioScrubber() {
  els.ttsAudio.addEventListener("timeupdate", () => {
    if (state.isSeeking) return;
    const cur = els.ttsAudio.currentTime || 0;
    const dur = els.ttsAudio.duration || 0;
    if (els.audioCurrentTime) els.audioCurrentTime.textContent = formatTime(cur);
    if (els.audioDuration) els.audioDuration.textContent = formatTime(dur);
    if (dur > 0 && els.audioScrubber) {
      els.audioScrubber.value = (cur / dur) * 100;
    }
    updateMediaSessionPosition();
  });

  els.audioScrubber?.addEventListener("input", () => {
    state.isSeeking = true;
    const dur = els.ttsAudio.duration || 0;
    const target = (els.audioScrubber.value / 100) * dur;
    if (els.audioCurrentTime) els.audioCurrentTime.textContent = formatTime(target);
  });

  els.audioScrubber?.addEventListener("change", () => {
    const dur = els.ttsAudio.duration || 0;
    els.ttsAudio.currentTime = (els.audioScrubber.value / 100) * dur;
    state.isSeeking = false;
    updateMediaSessionPosition();
  });
}

function setupMediaSession() {
  if (!("mediaSession" in navigator)) return;

  const safeSetAction = (action, handler) => {
    try {
      navigator.mediaSession.setActionHandler(action, handler);
    } catch (_) {}
  };

  safeSetAction("play", () => {
    if (state.isPaused) {
      togglePlayPause();
    } else if (!state.isPlaying) {
      const startIdx = state.currentSentenceIndex >= 0 ? state.currentSentenceIndex : 0;
      playFromSentence(startIdx);
    }
  });

  safeSetAction("pause", () => {
    if (state.isPlaying && !state.isPaused) {
      togglePlayPause();
    }
  });

  safeSetAction("stop", () => {
    stopReading();
  });

  safeSetAction("previoustrack", () => {
    if (state.currentSentenceIndex > 0) {
      playFromSentence(state.currentSentenceIndex - 1);
    } else if (state.currentPage > 1) {
      goToPage(state.currentPage - 1, true);
    } else {
      seekAudioRelative(-999);
    }
  });

  safeSetAction("nexttrack", () => {
    if (state.currentSentenceIndex + 1 < state.sentences.length) {
      playFromSentence(state.currentSentenceIndex + 1);
    } else if (state.docId && state.currentPage < state.totalPages) {
      goToPage(state.currentPage + 1, true);
    } else {
      stopReading();
    }
  });

  safeSetAction("seekbackward", (details) => {
    const offset = details && details.seekOffset ? -details.seekOffset : -5;
    seekAudioRelative(offset);
  });

  safeSetAction("seekforward", (details) => {
    const offset = details && details.seekOffset ? details.seekOffset : 10;
    seekAudioRelative(offset);
  });

  safeSetAction("seekto", (details) => {
    if (details && details.seekTime !== undefined && els.ttsAudio && els.ttsAudio.duration) {
      els.ttsAudio.currentTime = Math.min(Math.max(0, details.seekTime), els.ttsAudio.duration);
      updateMediaSessionPosition();
    }
  });
}

function updateMediaSession(index) {
  if (!("mediaSession" in navigator)) return;

  const sentence = (state.sentences && state.sentences[index]) ? state.sentences[index].trim() : "";
  const title = sentence
    ? (sentence.length > 120 ? sentence.slice(0, 117).trim() + "..." : sentence)
    : "Đọc sách PDF Tiếng Việt";

  const bookTitle = state.filename || els.docTitleLabel?.textContent?.trim() || "VN PDF Reader";
  const chapterText = els.chapterTitle?.textContent?.trim() || "";
  const artist = chapterText && !chapterText.startsWith("—") ? `${chapterText} • ${bookTitle}` : bookTitle;

  const voiceLabel = els.voiceCurrentLabel?.textContent?.trim() || "Giọng đọc AI";
  const album = `Trang ${state.currentPage} / ${state.totalPages || 1} • ${voiceLabel}`;

  const artwork = [
    { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
    { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
  ];

  if (state.docId && state.docId !== "demo_hanoi") {
    artwork.unshift({
      src: `/api/doc/${state.docId}/page/${state.currentPage}/image?dpi=100`,
      sizes: "300x420",
      type: "image/png",
    });
  }

  try {
    navigator.mediaSession.metadata = new MediaMetadata({
      title,
      artist,
      album,
      artwork,
    });
  } catch (_) {}

  updateMediaSessionPlaybackState("playing");
  updateMediaSessionPosition();
}

async function loadAnnotations() {
  if (!state.docId) state.docId = "demo_hanoi";
  try {
    // Ưu tiên đọc từ localStorage cho tốc độ tức thì
    const local = localStorage.getItem(`vn_annotations_${state.docId}`);
    if (local) {
      const data = JSON.parse(local);
      state.bookmarks = data.bookmarks || [];
      state.highlights = data.highlights || [];
    }
    if (state.docId !== "demo_hanoi") {
      const res = await fetch(`/api/doc/${state.docId}/annotations`);
      if (res.ok) {
        const data = await res.json();
        if (data.bookmarks && data.bookmarks.length > 0) state.bookmarks = data.bookmarks;
        if (data.highlights && data.highlights.length > 0) state.highlights = data.highlights;
      }
    }
    updateBookmarkCount();
    updateHighlightCount();
    renderBookmarksList();
    renderHighlightsList();
    updateBookmarkRibbonState();
    renderHighlightsOnPage();
  } catch (err) {
    console.warn("Lỗi tải annotations:", err);
  }
}

async function saveAnnotations() {
  if (!state.docId) state.docId = "demo_hanoi";
  try {
    localStorage.setItem(
      `vn_annotations_${state.docId}`,
      JSON.stringify({
        bookmarks: state.bookmarks,
        highlights: state.highlights,
      })
    );
    if (state.docId !== "demo_hanoi") {
      await fetch(`/api/doc/${state.docId}/annotations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookmarks: state.bookmarks,
          highlights: state.highlights,
        }),
      });
    }
  } catch (err) {
    console.warn("Lỗi lưu annotations:", err);
  }
}

function toggleBookmarkCurrentPage() {
  if (!state.docId) state.docId = "demo_hanoi";
  const existingIdx = state.bookmarks.findIndex((b) => b.page === state.currentPage);
  if (existingIdx >= 0) {
    state.bookmarks.splice(existingIdx, 1);
  } else {
    const preview = state.sentences[0] 
      ? (state.sentences[0].slice(0, 45) + "...") 
      : (document.querySelector(".sentence-item")?.textContent.slice(0, 45) + "..." || `Trang ${state.currentPage}`);
    state.bookmarks.push({
      id: "bm_" + Date.now(),
      page: state.currentPage,
      title: `Trang ${state.currentPage} • ${preview}`,
      created_at: Date.now(),
    });
  }
  updateBookmarkRibbonState();
  updateBookmarkCount();
  renderBookmarksList();
  saveAnnotations();
}

function updateBookmarkRibbonState() {
  const isBookmarked = state.bookmarks.some((b) => b.page === state.currentPage);
  if (els.bookmarkRibbonBtn) {
    els.bookmarkRibbonBtn.classList.toggle("active", isBookmarked);
    els.bookmarkRibbonBtn.title = isBookmarked
      ? "Đã ghim trang này (Bấm để bỏ ghim - Phím B)"
      : "Ghim dấu trang này (Phím B)";
  }
  const hBtn = document.getElementById("headerBookmarkBtn");
  if (hBtn) {
    hBtn.classList.toggle("active", isBookmarked);
    hBtn.style.color = isBookmarked ? "var(--accent)" : "";
  }
}

function updateBookmarkCount() {
  if (els.bookmarkCount) {
    els.bookmarkCount.textContent = state.bookmarks.length;
  }
}

function updateHighlightCount() {
  if (els.highlightCount) {
    els.highlightCount.textContent = state.highlights.length;
  }
}

function updateChapterHeaderForCurrentPage() {
  if (!els.chapterHeader) return;
  
  // Tìm xem trang hiện tại có ứng với mục nào trong TOC không
  const currentChapter = (state.toc || []).find((item) => item.page === state.currentPage);
  
  if (currentChapter && currentChapter.title) {
    els.chapterHeader.hidden = false;
    const parts = currentChapter.title.split(/[:\-–—]\s*/);
    if (parts.length > 1) {
      if (els.chapterNum) {
        els.chapterNum.textContent = parts[0].trim();
        els.chapterNum.hidden = false;
      }
      if (els.chapterTitle) els.chapterTitle.textContent = parts.slice(1).join(" - ").trim();
    } else {
      if (els.chapterNum) els.chapterNum.hidden = true;
      if (els.chapterTitle) els.chapterTitle.textContent = currentChapter.title.trim();
    }
  } else {
    // Nếu trang không phải là đầu chương, ẩn header giả định
    els.chapterHeader.hidden = true;
  }
}

function updateHighlightActiveTocItem() {
  if (!els.tocList) return;
  els.tocList.querySelectorAll(".pdf-thumb-item, .pdf-outline-row").forEach((el) => {
    const page = parseInt(el.getAttribute("data-page"), 10);
    const isCur = page === state.currentPage;
    el.classList.toggle("active", isCur);
  });

  // Tự động cuộn tới thumbnail hoặc outline đang active
  const activeThumb = els.tocList.querySelector(".pdf-thumb-item.active");
  if (activeThumb && !activeThumb.closest("[hidden]")) {
    activeThumb.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }
}

function buildOutlineTree(flatToc) {
  const root = [];
  const stack = [];
  (flatToc || []).forEach((item, idx) => {
    const node = {
      id: `outline_${idx}`,
      level: item.level || 1,
      title: item.title || `Mục ${idx + 1}`,
      page: item.page || 1,
      children: [],
    };
    while (stack.length > 0 && stack[stack.length - 1].level >= node.level) {
      stack.pop();
    }
    if (stack.length === 0) {
      root.push(node);
    } else {
      stack[stack.length - 1].children.push(node);
    }
    stack.push(node);
  });
  return root;
}

function renderOutlineNodesHtml(nodes) {
  if (!nodes || nodes.length === 0) return "";
  return nodes
    .map((node) => {
      const hasChildren = node.children && node.children.length > 0;
      const isCur = node.page === state.currentPage;
      return `
        <div class="pdf-outline-node" data-node-id="${node.id}">
          <div class="pdf-outline-row ${isCur ? "active" : ""}" data-page="${node.page}">
            <span class="pdf-outline-caret ${hasChildren ? "expanded" : "empty"}" data-toggle-node="${node.id}">▸</span>
            <span class="pdf-outline-title" title="${escapeHtml(node.title)}">${escapeHtml(node.title)}</span>
            <span class="pdf-outline-page">${node.page}</span>
          </div>
          ${
            hasChildren
              ? `<div class="pdf-outline-children" id="children_${node.id}">
                  ${renderOutlineNodesHtml(node.children)}
                </div>`
              : ""
          }
        </div>
      `;
    })
    .join("");
}

function renderTocList() {
  if (!els.tocList) return;
  const total = state.totalPages || (state.pagesOverview ? state.pagesOverview.length : 120) || 1;
  const currentMode = state.tocViewMode || "thumbnails"; // "thumbnails" | "outline"
  const isDemo = !state.docId || state.docId === "demo_hanoi";

  // Bản đồ chương từ state.toc cho trang sách mẫu
  const chapterMap = {};
  (state.toc || []).forEach((c) => {
    if (c.page && !chapterMap[c.page]) chapterMap[c.page] = c.title;
  });

  // 1. Tạo HTML danh sách Hình thu nhỏ của từng trang (Page Thumbnails giống Chrome PDF Viewer)
  const thumbsList = [];
  for (let p = 1; p <= total; p++) {
    const isCur = p === state.currentPage;
    let thumbInner = "";
    if (!isDemo) {
      thumbInner = `<img class="pdf-thumb-img" src="/api/doc/${encodeURIComponent(state.docId)}/page/${p}/image?dpi=60" loading="lazy" alt="Trang ${p}" />`;
    } else {
      const ch = chapterMap[p] || `Hà Nội 36 Phố Phường`;
      const sampleBody =
        p === 15
          ? "Cốm là thức quà riêng biệt của đất nước, là thức dâng của những cánh đồng lúa bát ngát xanh, mang trong hương vị tất cả cái mộc mạc, giản dị và thanh khiết..."
          : `Nội dung trang ${p} — Văn chương Thạch Lam nhẹ nhàng, tinh tế khắc họa vẻ đẹp phố cổ Hà Nội xưa với những thức quà bình dị...`;
      thumbInner = `
        <div class="pdf-thumb-mock-sheet">
          <div class="mock-sheet-chapter">${escapeHtml(ch)}</div>
          <div class="mock-sheet-lines">${escapeHtml(sampleBody)}</div>
        </div>
      `;
    }

    thumbsList.push(`
      <div class="pdf-thumb-item drawer-item ${isCur ? "active" : ""}" data-page="${p}" title="Chuyển đến Trang ${p}">
        <div class="pdf-thumb-frame">
          ${thumbInner}
        </div>
        <div class="pdf-thumb-page-num">${p}</div>
      </div>
    `);
  }

  // 2. Tạo HTML Cây mục lục (Document Outline Tree giống Chrome PDF Viewer)
  const treeNodes = buildOutlineTree(state.toc || []);
  const outlineHtml =
    treeNodes.length > 0
      ? renderOutlineNodesHtml(treeNodes)
      : `<div class="pdf-outline-empty">Tài liệu này không có đề mục chương.<br/>Sử dụng chế độ Hình thu nhỏ trang ở thanh bên trái để duyệt nhanh các trang.</div>`;

  els.tocList.innerHTML = `
    <div class="pdf-viewer-sidebar">
      <div class="pdf-sidebar-rail">
        <button class="pdf-rail-btn ${currentMode === "thumbnails" ? "active" : ""}" id="btnPdfViewThumbnails" title="Hình thu nhỏ của trang (Page Thumbnails)">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="3" width="7" height="9" rx="1"></rect>
            <rect x="14" y="3" width="7" height="9" rx="1"></rect>
            <rect x="3" y="15" width="7" height="6" rx="1"></rect>
            <rect x="14" y="15" width="7" height="6" rx="1"></rect>
          </svg>
        </button>
        <button class="pdf-rail-btn ${currentMode === "outline" ? "active" : ""}" id="btnPdfViewOutline" title="Đề mục tài liệu (Document Outline)">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="8" y1="6" x2="21" y2="6"></line>
            <line x1="8" y1="12" x2="21" y2="12"></line>
            <line x1="8" y1="18" x2="21" y2="18"></line>
            <line x1="3" y1="6" x2="3.01" y2="6"></line>
            <line x1="3" y1="12" x2="3.01" y2="12"></line>
            <line x1="3" y1="18" x2="3.01" y2="18"></line>
          </svg>
        </button>
      </div>

      <div class="pdf-sidebar-viewport">
        <div class="pdf-thumbnails-view" id="pdfThumbnailsView" ${currentMode === "thumbnails" ? "" : "hidden"}>
          ${thumbsList.join("")}
        </div>
        <div class="pdf-outline-view" id="pdfOutlineView" ${currentMode === "outline" ? "" : "hidden"}>
          ${outlineHtml}
        </div>
      </div>
    </div>
  `;

  // Sự kiện chuyển đổi giữa Hình thu nhỏ trang và Đề mục tài liệu trên thanh Icon Rail
  const btnThumbs = els.tocList.querySelector("#btnPdfViewThumbnails");
  const btnOutline = els.tocList.querySelector("#btnPdfViewOutline");
  const thumbsView = els.tocList.querySelector("#pdfThumbnailsView");
  const outlineView = els.tocList.querySelector("#pdfOutlineView");

  btnThumbs?.addEventListener("click", (e) => {
    e.stopPropagation();
    state.tocViewMode = "thumbnails";
    btnThumbs.classList.add("active");
    btnOutline?.classList.remove("active");
    if (thumbsView) thumbsView.hidden = false;
    if (outlineView) outlineView.hidden = true;
    const curThumb = thumbsView?.querySelector(".pdf-thumb-item.active");
    if (curThumb) curThumb.scrollIntoView({ block: "nearest" });
  });

  btnOutline?.addEventListener("click", (e) => {
    e.stopPropagation();
    state.tocViewMode = "outline";
    btnOutline.classList.add("active");
    btnThumbs?.classList.remove("active");
    if (outlineView) outlineView.hidden = false;
    if (thumbsView) thumbsView.hidden = true;
    const curRow = outlineView?.querySelector(".pdf-outline-row.active");
    if (curRow) curRow.scrollIntoView({ block: "nearest" });
  });

  // Sự kiện click vào hình thu nhỏ trang để chuyển trang
  els.tocList.querySelectorAll(".pdf-thumb-item").forEach((el) => {
    el.addEventListener("click", () => {
      const page = parseInt(el.getAttribute("data-page"), 10);
      goToPage(page, false);
      closeDrawer();
    });
  });

  // Sự kiện đóng/mở mũi tên nhánh con và click vào đề mục trong Outline Tree
  els.tocList.querySelectorAll(".pdf-outline-caret[data-toggle-node]").forEach((caret) => {
    caret.addEventListener("click", (e) => {
      e.stopPropagation();
      const nodeId = caret.getAttribute("data-toggle-node");
      const childrenContainer = els.tocList.querySelector(`#children_${nodeId}`);
      if (!childrenContainer) return;
      const isHidden = childrenContainer.hidden;
      childrenContainer.hidden = !isHidden;
      caret.classList.toggle("expanded", isHidden);
    });
  });

  els.tocList.querySelectorAll(".pdf-outline-row").forEach((row) => {
    row.addEventListener("click", (e) => {
      if (e.target.closest(".pdf-outline-caret:not(.empty)")) return;
      const page = parseInt(row.getAttribute("data-page"), 10);
      goToPage(page, false);
      closeDrawer();
    });
  });

  // Tự động cuộn đến trang đang đọc
  setTimeout(() => {
    const activeSelector =
      currentMode === "thumbnails" ? ".pdf-thumb-item.active" : ".pdf-outline-row.active";
    const curEl = els.tocList.querySelector(activeSelector);
    if (curEl) curEl.scrollIntoView({ block: "nearest" });
  }, 60);
}

function renderBookmarksList() {
  if (!els.bookmarksList) return;
  if (!state.bookmarks || state.bookmarks.length === 0) {
    els.bookmarksList.innerHTML = `<div class="drawer-empty-hint">Chưa có dấu trang nào. Bấm 🔖 ở góc trên trang sách hoặc nhấn phím B để ghim.</div>`;
    return;
  }
  const sorted = [...state.bookmarks].sort((a, b) => a.page - b.page);
  els.bookmarksList.innerHTML = sorted
    .map(
      (b) => `
      <div class="drawer-item" data-id="${b.id}" data-page="${b.page}">
        <span class="drawer-item-title">${escapeHtml(b.title)}</span>
        <span class="drawer-item-page">Trang ${b.page}</span>
        <button class="drawer-item-del-btn" title="Xóa dấu trang" data-del-bm="${b.id}">✕</button>
      </div>
    `
    )
    .join("");

  els.bookmarksList.querySelectorAll(".drawer-item").forEach((el) => {
    el.addEventListener("click", (e) => {
      if (e.target.closest(".drawer-item-del-btn")) return;
      const page = parseInt(el.getAttribute("data-page"), 10);
      goToPage(page, false);
      closeDrawer();
    });
  });

  els.bookmarksList.querySelectorAll("[data-del-bm]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const id = btn.getAttribute("data-del-bm");
      state.bookmarks = state.bookmarks.filter((b) => b.id !== id);
      updateBookmarkCount();
      renderBookmarksList();
      updateBookmarkRibbonState();
      saveAnnotations();
    });
  });
}

function renderHighlightsList() {
  if (!els.highlightsList) return;
  if (!state.highlights || state.highlights.length === 0) {
    els.highlightsList.innerHTML = `<div class="drawer-empty-hint">Chưa có highlight nào. Bôi đen văn bản trong sách để tô màu.</div>`;
    return;
  }
  const sorted = [...state.highlights].sort((a, b) => a.page - b.page);
  const colorMap = {
    yellow: "#ffd54f",
    green: "#81c784",
    pink: "#f48fb1",
    blue: "#90caf9",
  };
  els.highlightsList.innerHTML = sorted
    .map(
      (hl) => `
      <div class="drawer-item" data-id="${hl.id}" data-page="${hl.page}">
        <span class="hl-color-dot" style="background-color: ${colorMap[hl.color] || '#ffd54f'};"></span>
        <span class="drawer-item-title">"${escapeHtml(hl.text)}"</span>
        <span class="drawer-item-page">Trang ${hl.page}</span>
        <button class="drawer-item-del-btn" title="Xóa highlight" data-del-hl="${hl.id}">✕</button>
      </div>
    `
    )
    .join("");

  els.highlightsList.querySelectorAll(".drawer-item").forEach((el) => {
    el.addEventListener("click", (e) => {
      if (e.target.closest(".drawer-item-del-btn")) return;
      const page = parseInt(el.getAttribute("data-page"), 10);
      goToPage(page, false);
      closeDrawer();
    });
  });

  els.highlightsList.querySelectorAll("[data-del-hl]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const id = btn.getAttribute("data-del-hl");
      state.highlights = state.highlights.filter((h) => h.id !== id);
      updateHighlightCount();
      renderHighlightsList();
      renderSentences(); // Tái tạo DOM sạch, gỡ bỏ hoàn toàn thẻ mark đã xóa
      saveAnnotations();
    });
  });
}

function renderHighlightsOnPage() {
  if (!els.sentencesContainer) return;
  const pageHighlights = state.highlights.filter((h) => h.page === state.currentPage);
  if (pageHighlights.length === 0) return;

  els.sentencesContainer.querySelectorAll(".sentence-item").forEach((sentEl) => {
    const idx = parseInt(sentEl.getAttribute("data-index"), 10);
    const sentText = (state.sentences[idx] || sentEl.textContent || "").trim();
    if (!sentText) return;
    let html = sentEl.innerHTML;

    pageHighlights.forEach((hl) => {
      if (!hl.text) return;
      const targetText = hl.text.trim();
      let matchPart = "";

      // 1. Khớp nguyên văn trong câu
      if (sentText.includes(targetText)) {
        matchPart = targetText;
      }
      // 2. Câu nằm trọn trong đoạn bôi đen dài nhiều câu
      else if (targetText.includes(sentText) && sentText.length > 5) {
        matchPart = sentText;
      }
      // 3. Khớp phần đầu hoặc đuôi câu (khi bôi đen vắt ngang qua 2 câu)
      else {
        // Tìm overlap lớn nhất (ít nhất 4 ký tự)
        const maxLen = Math.min(targetText.length, sentText.length);
        for (let len = maxLen; len >= 4; len--) {
          const targetPrefix = targetText.slice(0, len);
          const targetSuffix = targetText.slice(-len);
          if (sentText.endsWith(targetPrefix)) {
            matchPart = targetPrefix;
            break;
          } else if (sentText.startsWith(targetSuffix)) {
            matchPart = targetSuffix;
            break;
          }
        }
      }

      if (matchPart) {
        const escaped = escapeHtml(matchPart);
        if (!html.includes(`class="user-highlight highlight-${hl.color}"`)) {
          html = html.replace(
            escaped,
            `<mark class="user-highlight highlight-${hl.color}" title="Highlight đã lưu">${escaped}</mark>`
          );
        }
      }
    });
    sentEl.innerHTML = html;
  });
}

function applyHighlight(color = "yellow") {
  if (!currentSelectedText) return;
  if (!state.docId) state.docId = "demo_hanoi";

  // Thêm highlight vào state
  state.highlights.push({
    id: "hl_" + Date.now(),
    page: state.currentPage,
    text: currentSelectedText,
    color: color,
    created_at: Date.now(),
  });

  // Tô màu ngay lập tức lên đoạn văn đang hiển thị trên DOM
  document.querySelectorAll(".sentence-item").forEach((s) => {
    if (s.textContent.includes(currentSelectedText)) {
      s.classList.add("highlighted");
      s.style.backgroundColor = "#FFE8A3";
    }
  });

  saveAnnotations();
  updateHighlightCount();
  renderHighlightsList();
  renderHighlightsOnPage();

  if (els.floatingSelectionBar) els.floatingSelectionBar.hidden = true;
  window.getSelection()?.removeAllRanges();
}

let currentSelectedText = "";

function setupSelectionListener() {
  document.addEventListener("selectionchange", () => {
    const sel = window.getSelection();
    const text = sel ? sel.toString().trim() : "";
    if (!text || text.length < 2) {
      if (els.floatingSelectionBar && !els.floatingSelectionBar.matches(":hover")) {
        els.floatingSelectionBar.hidden = true;
      }
      return;
    }

    try {
      const range = sel.getRangeAt(0);
      if (!els.readerPane.contains(range.commonAncestorContainer)) {
        if (els.floatingSelectionBar) els.floatingSelectionBar.hidden = true;
        return;
      }

      currentSelectedText = text;
      const rect = range.getBoundingClientRect();
      if (els.floatingSelectionBar) {
        els.floatingSelectionBar.style.left = `${rect.left + rect.width / 2}px`;
        els.floatingSelectionBar.style.top = `${rect.top}px`;
        els.floatingSelectionBar.hidden = false;
      }
    } catch (_) {}
  });
}

function openDrawer(tabName = "toc") {
  if (els.tocDrawer) {
    els.tocDrawer.removeAttribute("hidden");
    els.tocDrawer.hidden = false;
    els.drawerBackdrop.removeAttribute("hidden");
    els.drawerBackdrop.hidden = false;
    switchDrawerTab(tabName);
    setTimeout(() => {
      const curEl = els.tocList?.querySelector(".pdf-thumb-item.active, .pdf-outline-row.active");
      if (curEl) curEl.scrollIntoView({ block: "center" });
    }, 50);
  }
}

function closeDrawer() {
  if (els.tocDrawer) {
    els.tocDrawer.setAttribute("hidden", "");
    els.tocDrawer.hidden = true;
    els.drawerBackdrop.setAttribute("hidden", "");
    els.drawerBackdrop.hidden = true;
  }
}

function toggleDrawer() {
  if (els.tocDrawer && !els.tocDrawer.hidden) {
    closeDrawer();
  } else {
    openDrawer("toc");
  }
}

function switchDrawerTab(tabName) {
  const tabs = [
    { name: "toc", btn: els.tabBtnToc, pane: els.drawerTabToc },
    { name: "bookmarks", btn: els.tabBtnBookmarks, pane: els.drawerTabBookmarks },
    { name: "highlights", btn: els.tabBtnHighlights, pane: els.drawerTabHighlights },
  ];
  tabs.forEach((t) => {
    const active = t.name === tabName;
    t.btn?.classList.toggle("active", active);
    if (t.pane) {
      if (active) {
        t.pane.removeAttribute("hidden");
        t.pane.hidden = false;
      } else {
        t.pane.setAttribute("hidden", "");
        t.pane.hidden = true;
      }
    }
  });
}

async function openDictModal(initialWord = "") {
  if (els.dictModal) els.dictModal.hidden = false;
  if (initialWord) {
    if (els.dictSearchInput) els.dictSearchInput.value = initialWord;
    await lookupWord(initialWord);
  } else if (els.dictSearchInput) {
    els.dictSearchInput.focus();
  }
}

function closeDictModal() {
  if (els.dictModal) els.dictModal.hidden = true;
}

async function lookupWord(word) {
  const query = (word || (els.dictSearchInput ? els.dictSearchInput.value : "")).trim();
  if (!query) return;

  if (els.dictResults) {
    els.dictResults.innerHTML = `<div class="drawer-empty-hint">⏳ Đang tra từ điển: <strong>${escapeHtml(query)}</strong>...</div>`;
  }
  try {
    const res = await fetch(`/api/dictionary/lookup?word=${encodeURIComponent(query)}`);
    if (!res.ok) throw new Error("Lỗi kết nối từ điển");
    const data = await res.json();
    renderDictResults(data);
  } catch (err) {
    if (els.dictResults) {
      els.dictResults.innerHTML = `<div class="drawer-empty-hint" style="color: #d9381e;">⚠️ Lỗi: ${escapeHtml(err.message)}</div>`;
    }
  }
}

function renderDictResults(data) {
  if (!els.dictResults) return;
  if (!data.found && (!data.meanings || data.meanings.length === 0)) {
    els.dictResults.innerHTML = `
      <div class="drawer-empty-hint">
        Không tìm thấy định nghĩa cho từ "<strong>${escapeHtml(data.word)}</strong>".
      </div>
    `;
    return;
  }

  let html = `
    <div class="dict-word-title">
      <span>${escapeHtml(data.word)}</span>
      <button class="btn btn-xs btn-outline" id="dictSpeakWordBtn" title="Phát âm từ này">🔊 Nghe</button>
    </div>
  `;

  if (data.meanings) {
    data.meanings.forEach((m) => {
      html += `<div class="dict-pos-tag">${escapeHtml(m.pos)}</div>`;
      if (m.definitions && m.definitions.length > 0) {
        html += `<ol class="dict-defs-list">`;
        m.definitions.forEach((d) => {
          html += `<li>${escapeHtml(d)}</li>`;
        });
        html += `</ol>`;
      }
    });
  }

  if (data.source) {
    html += `<div class="dict-source-label">Nguồn: ${escapeHtml(data.source)}</div>`;
  }

  els.dictResults.innerHTML = html;

  document.getElementById("dictSpeakWordBtn")?.addEventListener("click", async () => {
    try {
      const audioUrl = await fetchSentenceAudioUrl(data.word);
      const audio = new Audio(audioUrl);
      audio.playbackRate = state.speed;
      audio.play();
    } catch (_) {
      if ("speechSynthesis" in window) {
        const u = new SpeechSynthesisUtterance(data.word);
        u.lang = "vi-VN";
        window.speechSynthesis.speak(u);
      }
    }
  });
}

function openShortcutsModal() {
  if (els.shortcutsModal) els.shortcutsModal.hidden = false;
}

function closeShortcutsModal() {
  if (els.shortcutsModal) els.shortcutsModal.hidden = true;
}

// Khởi chạy ứng dụng
initApp();
