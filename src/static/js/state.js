// ============================================================================
// VN PDF Reader — Central Application State & Shared Constants
// ============================================================================

export const DEFAULT_MOCK_TOC = [
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

export const state = {
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
  searchQuery: "",
  searchResults: [],
  searchResultsByPage: [],
  searchCurrentIndex: -1,
  isSearching: false,
  origPageDpi: 170,
  origPageZoom: 100,
  isSplitView: false,
  splitPageZoom: 100,
  splitPageDpi: 170,
};

// DOM Elements Registry
export const els = {};

export function initElements() {
  const elementsMap = {
    homeScreen: "homeScreen",
    readerScreen: "readerScreen",
    capsulePlayer: "capsulePlayer",
    backToHomeBtn: "backToHomeBtn",
    sampleBookCard: "sampleBookCard",
    themeBtn: "themeBtn",
    homeSettingsBtn: "homeSettingsBtn",
    recentSection: "recentSection",
    recentBooksGrid: "recentBooksGrid",
    pdfFileInput: "pdfFileInput",
    prevPageBtn: "prevPageBtn",
    nextPageBtn: "nextPageBtn",
    pageInput: "pageInput",
    totalPagesLabel: "totalPagesLabel",
    prevChapterBtn: "prevChapterBtn",
    nextChapterBtn: "nextChapterBtn",
    prevSentenceBtn: "prevSentenceBtn",
    playPauseBtn: "playPauseBtn",
    stopBtn: "stopBtn",
    nextSentenceBtn: "nextSentenceBtn",
    skipBackBtn: "skipBackBtn",
    skipForwardBtn: "skipForwardBtn",
    speedDecBtn: "speedDecBtn",
    speedIncBtn: "speedIncBtn",
    speedValLabel: "speedValLabel",
    speedPillBtn: "speedPillBtn",
    speedPopover: "speedPopover",
    speedRangeInput: "speedRangeInput",
    speedRangeValLabel: "speedRangeValLabel",
    speedPresetGrid: "speedPresetGrid",
    sleepTimerBtn: "sleepTimerBtn",
    sleepTimerIcon: "sleepTimerIcon",
    sleepTimerPopover: "sleepTimerPopover",
    sleepCountdownLabel: "sleepCountdownLabel",
    sleepTimeRemaining: "sleepTimeRemaining",
    voicePill: "voicePill",
    voiceCurrentLabel: "voiceCurrentLabel",
    voicePopover: "voicePopover",
    voicePopoverList: "voicePopoverList",
    voiceSelect: "voiceSelect",
    speedSelect: "speedSelect",
    downloadMp3Btn: "downloadMp3Btn",
    appleToast: "appleToast",
    appleToastIcon: "appleToastIcon",
    appleToastText: "appleToastText",
    readingSettingsBtn: "readingSettingsBtn",
    readingSettingsPopover: "readingSettingsPopover",
    moreOptionsBtn: "moreOptionsBtn",
    moreOptionsPopover: "moreOptionsPopover",
    waveformBars: "waveformBars",
    drawerToggleBtn: "drawerToggleBtn",
    tocDrawer: "tocDrawer",
    closeDrawerBtn: "closeDrawerBtn",
    drawerBackdrop: "drawerBackdrop",
    tabBtnToc: "tabBtnToc",
    tabBtnBookmarks: "tabBtnBookmarks",
    tabBtnHighlights: "tabBtnHighlights",
    drawerTabToc: "drawerTabToc",
    drawerTabBookmarks: "drawerTabBookmarks",
    drawerTabHighlights: "drawerTabHighlights",
    tocList: "tocList",
    bookmarksList: "bookmarksList",
    highlightsList: "highlightsList",
    bookmarkCount: "bookmarkCount",
    highlightCount: "highlightCount",
    bookmarkRibbonBtn: "bookmarkRibbonBtn",
    headerBookmarkBtn: "headerBookmarkBtn",
    headerBookmarkIcon: "headerBookmarkIcon",
    drawerAddBookmarkActionBtn: "drawerAddBookmarkActionBtn",
    audioScrubberBar: "audioScrubberBar",
    audioScrubber: "audioScrubber",
    audioCurrentTime: "audioCurrentTime",
    audioDuration: "audioDuration",
    floatingSelectionBar: "floatingSelectionBar",
    floatHighlightBtn: "floatHighlightBtn",
    floatLookupBtn: "floatLookupBtn",
    floatSpeakBtn: "floatSpeakBtn",
    floatCopyBtn: "floatCopyBtn",
    dictModal: "dictModal",
    closeDictBtn: "closeDictBtn",
    closeDictFooterBtn: "closeDictFooterBtn",
    dictSearchInput: "dictSearchInput",
    dictSearchBtn: "dictSearchBtn",
    dictResults: "dictResults",
    shortcutsBtn: "shortcutsBtn",
    shortcutsModal: "shortcutsModal",
    closeShortcutsBtn: "closeShortcutsBtn",
    closeShortcutsFooterBtn: "closeShortcutsFooterBtn",
    readerPane: "readerPane",
    zenModeBtn: "zenModeBtn",
    exitZenBtn: "exitZenBtn",
    themeToggleBtn: "themeToggleBtn",
    settingsBtn: "settingsBtn",
    docTitleLabel: "docTitleLabel",
    chapterHeader: "chapterHeader",
    chapterNum: "chapterNum",
    chapterTitle: "chapterTitle",
    statusBadge: "statusBadge",
    statusReasonLabel: "statusReasonLabel",
    autoNextPageCheckbox: "autoNextPageCheckbox",
    autoOcrCheckbox: "autoOcrCheckbox",
    encodingModeSelect: "encodingModeSelect",
    ocrPageBtn: "ocrPageBtn",
    editModeBtn: "editModeBtn",
    homeDropZone: "homeDropZone",
    emptyState: "emptyState",
    splitContainer: "splitContainer",
    pdfPane: "pdfPane",
    pdfPageImage: "pdfPageImage",
    zoomOutBtn: "zoomOutBtn",
    zoomInBtn: "zoomInBtn",
    zoomLabel: "zoomLabel",
    togglePdfPaneBtn: "togglePdfPaneBtn",
    showPdfPaneBtn: "showPdfPaneBtn",
    copyCleanTextBtn: "copyCleanTextBtn",
    ocrProgressBox: "ocrProgressBox",
    ocrProgressText: "ocrProgressText",
    ocrProgressPercent: "ocrProgressPercent",
    ocrProgressBar: "ocrProgressBar",
    editorBox: "editorBox",
    manualTextArea: "manualTextArea",
    applyManualTextBtn: "applyManualTextBtn",
    cancelManualTextBtn: "cancelManualTextBtn",
    searchToggleBtn: "searchToggleBtn",
    inBookSearchBar: "inBookSearchBar",
    inBookSearchInput: "inBookSearchInput",
    searchMatchCount: "searchMatchCount",
    searchPrevMatchBtn: "searchPrevMatchBtn",
    searchNextMatchBtn: "searchNextMatchBtn",
    searchOpenDrawerBtn: "searchOpenDrawerBtn",
    searchCloseBtn: "searchCloseBtn",
    tabBtnSearch: "tabBtnSearch",
    searchDrawerCount: "searchDrawerCount",
    drawerTabSearch: "drawerTabSearch",
    searchDrawerSummary: "searchDrawerSummary",
    searchResultsList: "searchResultsList",
    originalPageToggleBtn: "originalPageToggleBtn",
    originalPageModal: "originalPageModal",
    originalPageModalTitle: "originalPageModalTitle",
    origPrevPageBtn: "origPrevPageBtn",
    origNextPageBtn: "origNextPageBtn",
    origPageIndicator: "origPageIndicator",
    origDpi170Btn: "origDpi170Btn",
    origDpi300Btn: "origDpi300Btn",
    origZoomOutBtn: "origZoomOutBtn",
    origZoomLevelLabel: "origZoomLevelLabel",
    origZoomInBtn: "origZoomInBtn",
    origZoomFitBtn: "origZoomFitBtn",
    origToggleSplitBtn: "origToggleSplitBtn",
    origSplitBtnText: "origSplitBtnText",
    origDownloadBtn: "origDownloadBtn",
    closeOriginalPageBtn: "closeOriginalPageBtn",
    origLoadingSpinner: "origLoadingSpinner",
    originalPageLightboxImg: "originalPageLightboxImg",
    origPageViewport: "origPageViewport",
    origImgContainer: "origImgContainer",
    splitPaneToolbar: ".split-pane-toolbar",
    splitPanePageLabel: "splitPanePageLabel",
    splitDpi170Btn: "splitDpi170Btn",
    splitDpi300Btn: "splitDpi300Btn",
    splitZoomOutBtn: "splitZoomOutBtn",
    splitZoomLevelLabel: "splitZoomLevelLabel",
    splitZoomInBtn: "splitZoomInBtn",
    splitCloseBtn: "splitCloseBtn",
    splitImgScroll: "splitImgScroll",
    sentencesContainer: "sentencesContainer",
    bookPageCanvas: "bookPageCanvas",
    bookPrevPageBtn: "bookPrevPageBtn",
    bookNextPageBtn: "bookNextPageBtn",
    bookFooterBar: "bookFooterBar",
    bookFooterTitle: "bookFooterTitle",
    bookEstTime: "bookEstTime",
    bookProgressFill: "bookProgressFill",
    bookPageIndicator: "bookPageIndicator",
    bookPercentBadge: "bookPercentBadge",
    pasteTextDemoBtn: "pasteTextDemoBtn",
    ttsAudio: "ttsAudio",
    settingsModal: "settingsModal",
    closeSettingsBtn: "closeSettingsBtn",
    cancelSettingsBtn: "cancelSettingsBtn",
    saveSettingsBtn: "saveSettingsBtn",
    proxyInput: "proxyInput",
    passwordModal: "passwordModal",
    passwordDocName: "passwordDocName",
    pdfPasswordInput: "pdfPasswordInput",
    togglePasswordVisibilityBtn: "togglePasswordVisibilityBtn",
    passwordErrorMsg: "passwordErrorMsg",
    cancelPasswordBtn: "cancelPasswordBtn",
    unlockPdfBtn: "unlockPdfBtn",
    closePasswordModalBtn: "closePasswordModalBtn",
    unlockBtnText: "unlockBtnText",
    fontFamilyChips: "fontFamilyChips",
    lineHeightChips: "lineHeightChips",
    pageWidthChips: "pageWidthChips",
    justifyToggle: "justifyToggle",
    indentToggle: "indentToggle",
    bookFlowToggle: "bookFlowToggle",
    fontDecPopoverBtn: "fontDecPopoverBtn",
    fontIncPopoverBtn: "fontIncPopoverBtn",
    fontSizePopoverLabel: "fontSizePopoverLabel",
  };

  for (const [key, selector] of Object.entries(elementsMap)) {
    if (selector.startsWith(".")) {
      els[key] = document.querySelector(selector);
    } else {
      els[key] = document.getElementById(selector);
    }
  }

  els.dropZone = document.getElementById("dropZone") || els.homeDropZone;
}

// Initial populate if DOM is already ready
if (typeof document !== "undefined" && document.readyState !== "loading") {
  initElements();
}

// ============================================================================
// Shared Utility Helpers
// ============================================================================

let appleToastTimer = null;

export function showAppleToast(message, icon = "🎧", durationMs = 4500) {
  if (!els.appleToast || !els.appleToastText) return;
  if (els.appleToastIcon) els.appleToastIcon.textContent = icon;
  els.appleToastText.textContent = message;
  els.appleToast.hidden = false;
  if (appleToastTimer) clearTimeout(appleToastTimer);
  appleToastTimer = setTimeout(() => {
    if (els.appleToast) els.appleToast.hidden = true;
  }, durationMs);
}

export function formatTime(sec) {
  if (isNaN(sec) || sec < 0) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s < 10 ? "0" : ""}${s}`;
}

export function escapeHtml(str) {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function escapeRegex(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function getFileTypeLabel(filename) {
  if (!filename) return "PDF";
  const ext = filename.split(".").pop().toLowerCase();
  if (ext === "epub") return "EPUB";
  if (ext === "txt") return "TXT";
  return "PDF";
}

export function formatShortVoiceLabel(name) {
  return name.replace(/\(.*?\)/g, "").trim();
}

export function formatSpeedLabel(val) {
  return `${Number(val).toFixed(2)}x`;
}
