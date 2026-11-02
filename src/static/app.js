// ============================================================================
// VN PDF Reader — E-Reader Experience (Kindle / Apple Books Style)
// Main Application Entry Point (ES Modules Orchestrator)
// ============================================================================

import { state, els, initElements, showAppleToast } from "./js/state.js";
import {
  openSettingsModal,
  closeSettingsModal,
  saveSettings,
  openShortcutsModal,
  closeShortcutsModal,
  openDictModal,
  closeDictModal,
  lookupWord,
  closePasswordModal,
  submitPasswordUnlock,
  togglePasswordVisibility,
} from "./js/ui-utils.js";
import {
  loadAnnotations,
  toggleBookmarkCurrentPage,
  updateBookmarkRibbonState,
  renderHighlightsOnPage,
  applyHighlight,
  setupSelectionListener,
  currentSelectedText,
} from "./js/annotation-mgr.js";
import {
  openDrawer,
  closeDrawer,
  toggleDrawer,
  switchDrawerTab,
  renderTocList,
} from "./js/toc-viewer.js";
import {
  openSearchBar,
  closeSearchBar,
  toggleSearchBar,
  executeInBookSearch,
  goToSearchMatch,
  searchDebounceTimer,
  setSearchDebounceTimer,
} from "./js/search-drawer.js";
import {
  loadVoices,
  renderVoicePopoverList,
  selectVoiceById,
  setReadingSpeed,
  updateSpeed,
  togglePlayPause,
  stopReading,
  playFromSentence,
  seekAudioRelative,
  setupAudioScrubber,
  setupMediaSession,
  setSleepTimer,
  downloadFullPageMp3,
  updateMediaSessionPlaybackState,
  updateMediaSessionPosition,
} from "./js/audio-controller.js";
import {
  showScreen,
  adjustPageInputWidth,
  loadReadingPreferences,
  applyReadingPreferences,
  updateThemeButton,
  toggleZenMode,
  updateZoom,
  handlePdfUpload,
  goToPrevChapter,
  goToNextChapter,
  goToPage,
  renderSentences,
  runBrowserVietnameseOcr,
  processRawTextFromClient,
  openOriginalPageModal,
  closeOriginalPageModal,
  toggleOriginalPageModal,
  loadOriginalPageImage,
  updateOrigZoom,
  setOrigDpi,
  toggleSplitView,
  updateSplitZoom,
  setSplitDpi,
} from "./js/reader-core.js";

// ============================================================================
// Event Listeners Binding
// ============================================================================

export function bindEvents() {
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

  // Modal mở khóa mật khẩu tài liệu PDF
  els.closePasswordModalBtn?.addEventListener("click", closePasswordModal);
  els.cancelPasswordBtn?.addEventListener("click", closePasswordModal);
  els.unlockPdfBtn?.addEventListener("click", submitPasswordUnlock);
  els.togglePasswordVisibilityBtn?.addEventListener("click", togglePasswordVisibility);
  els.pdfPasswordInput?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      submitPasswordUnlock();
    } else if (e.key === "Escape") {
      e.preventDefault();
      closePasswordModal();
    }
  });

  // 1. Chọn file PDF / EPUB / TXT
  els.pdfFileInput?.addEventListener("change", (e) => {
    const file = e.target.files?.[0];
    if (file) handlePdfUpload(file);
  });

  // Kéo thả file PDF vào workspace
  window.addEventListener("dragover", (e) => {
    e.preventDefault();
    if (els.dropZone) els.dropZone.classList.add("drag-over");
  });

  window.addEventListener("dragleave", (e) => {
    if (e.target === els.dropZone || e.clientX <= 0 || e.clientY <= 0) {
      if (els.dropZone) els.dropZone.classList.remove("drag-over");
    }
  });

  window.addEventListener("drop", (e) => {
    e.preventDefault();
    if (els.dropZone) els.dropZone.classList.remove("drag-over");
    const file = e.dataTransfer?.files?.[0];
    const validExts = [".pdf", ".epub", ".txt"];
    const ext = file ? file.name.substring(file.name.lastIndexOf(".")).toLowerCase() : "";
    if (file && validExts.includes(ext)) {
      handlePdfUpload(file);
    } else if (file) {
      alert("Vui lòng kéo thả file có định dạng .pdf, .epub hoặc .txt");
    }
  });

  // 2. Điều hướng trang
  els.prevPageBtn?.addEventListener("click", () => {
    if (state.currentPage > 1) goToPage(state.currentPage - 1, false);
  });
  els.nextPageBtn?.addEventListener("click", () => {
    if (state.currentPage < state.totalPages) goToPage(state.currentPage + 1, false);
  });

  // Mũi tên lật trang nổi kiểu máy đọc sách (Kindle Oasis style)
  els.bookPrevPageBtn?.addEventListener("click", () => {
    if (state.currentPage > 1) goToPage(state.currentPage - 1, false);
  });
  els.bookNextPageBtn?.addEventListener("click", () => {
    if (state.currentPage < state.totalPages) goToPage(state.currentPage + 1, false);
  });

  els.pageInput?.addEventListener("focus", () => {
    els.pageInput.select();
  });

  els.pageInput?.addEventListener("input", () => {
    const cleaned = els.pageInput.value.replace(/[^0-9]/g, "");
    if (els.pageInput.value !== cleaned) {
      els.pageInput.value = cleaned;
    }
    adjustPageInputWidth();
  });

  els.pageInput?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      els.pageInput.blur();
    } else if (e.key === "Escape") {
      els.pageInput.value = state.currentPage;
      adjustPageInputWidth();
      els.pageInput.blur();
    }
  });

  els.pageInput?.addEventListener("change", () => {
    let target = parseInt(els.pageInput.value, 10);
    if (isNaN(target)) target = state.currentPage;
    target = Math.max(1, Math.min(state.totalPages, target));
    els.pageInput.value = target;
    adjustPageInputWidth();
    if (target !== state.currentPage) {
      goToPage(target, false);
    }
  });

  // 3. Điều khiển giọng đọc TTS
  els.playPauseBtn?.addEventListener("click", togglePlayPause);
  els.stopBtn?.addEventListener("click", stopReading);

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

  if (els.ttsAudio) {
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
  }

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
  els.themeToggleBtn?.addEventListener("click", () => {
    state.themeIndex = (state.themeIndex + 1) % state.themes.length;
    applyReadingPreferences();
    updateThemeButton();
  });

  // 7. Cài đặt Mạng / Proxy modal
  els.settingsBtn?.addEventListener("click", openSettingsModal);
  els.closeSettingsBtn?.addEventListener("click", closeSettingsModal);
  els.cancelSettingsBtn?.addEventListener("click", closeSettingsModal);
  els.saveSettingsBtn?.addEventListener("click", saveSettings);
  els.settingsModal?.addEventListener("click", (e) => {
    if (e.target === els.settingsModal) closeSettingsModal();
  });

  // 8. Chế độ bảng mã & OCR
  els.encodingModeSelect?.addEventListener("change", () => {
    if (state.docId) {
      goToPage(state.currentPage, false);
    }
  });

  els.ocrPageBtn?.addEventListener("click", () => {
    if (state.docId && !state.isOcrRunning) {
      runBrowserVietnameseOcr(false);
    }
  });

  // 9. Chỉnh sửa văn bản thủ công
  els.editModeBtn?.addEventListener("click", () => {
    if (els.manualTextArea) els.manualTextArea.value = state.cleanText;
    if (els.editorBox) els.editorBox.hidden = !els.editorBox.hidden;
  });

  els.pasteTextDemoBtn?.addEventListener("click", () => {
    if (els.emptyState) els.emptyState.hidden = true;
    if (els.splitContainer) {
      els.splitContainer.hidden = false;
      els.splitContainer.classList.add("single-pane");
    }
    if (els.pdfPane) els.pdfPane.hidden = true;
    if (els.showPdfPaneBtn) els.showPdfPaneBtn.hidden = true;
    if (els.docTitleLabel) els.docTitleLabel.textContent = "Chế độ đọc văn bản tự do";
    if (els.editModeBtn) els.editModeBtn.disabled = false;
    if (els.editorBox) els.editorBox.hidden = false;
    els.manualTextArea?.focus();
  });

  els.applyManualTextBtn?.addEventListener("click", async () => {
    const raw = els.manualTextArea?.value?.trim();
    if (!raw) return;
    stopReading();
    await processRawTextFromClient(raw, "Đã áp dụng văn bản chỉnh sửa thủ công.");
    if (els.editorBox) els.editorBox.hidden = true;
  });

  els.cancelManualTextBtn?.addEventListener("click", () => {
    if (els.editorBox) els.editorBox.hidden = true;
  });

  // 10. Zoom PDF & Toggle Cột PDF
  els.zoomInBtn?.addEventListener("click", () => updateZoom(15));
  els.zoomOutBtn?.addEventListener("click", () => updateZoom(-15));

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

  els.copyCleanTextBtn?.addEventListener("click", async () => {
    if (!state.cleanText) return;
    await navigator.clipboard.writeText(state.cleanText);
    const oldText = els.copyCleanTextBtn.textContent;
    els.copyCleanTextBtn.textContent = "✅ Đã copy!";
    setTimeout(() => (els.copyCleanTextBtn.textContent = oldText), 1500);
  });

  // Tải MP3 toàn trang
  els.downloadMp3Btn?.addEventListener("click", downloadFullPageMp3);

  // 11. Mục lục, Dấu trang & Highlights (Drawer)
  els.drawerToggleBtn?.addEventListener("click", toggleDrawer);
  els.docTitleLabel?.addEventListener("click", toggleDrawer);
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

  // 15. Tìm kiếm toàn văn trong sách (In-Book Search)
  els.searchToggleBtn?.addEventListener("click", toggleSearchBar);
  els.searchCloseBtn?.addEventListener("click", closeSearchBar);
  els.searchPrevMatchBtn?.addEventListener("click", () => {
    goToSearchMatch(state.searchCurrentIndex - 1);
  });
  els.searchNextMatchBtn?.addEventListener("click", () => {
    goToSearchMatch(state.searchCurrentIndex + 1);
  });
  els.searchOpenDrawerBtn?.addEventListener("click", () => {
    openDrawer("search");
  });
  els.tabBtnSearch?.addEventListener("click", () => switchDrawerTab("search"));

  els.inBookSearchInput?.addEventListener("input", (e) => {
    clearTimeout(searchDebounceTimer);
    const timer = setTimeout(() => {
      executeInBookSearch(e.target.value);
    }, 280);
    setSearchDebounceTimer(timer);
  });

  els.inBookSearchInput?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (e.shiftKey) {
        goToSearchMatch(state.searchCurrentIndex - 1);
      } else if (state.searchResults.length > 0) {
        goToSearchMatch(state.searchCurrentIndex + 1);
      } else {
        executeInBookSearch(e.target.value);
      }
    } else if (e.key === "Escape") {
      closeSearchBar();
    }
  });

  // 16. Xem ảnh trang PDF gốc (Original Page Lightbox & Split View)
  els.originalPageToggleBtn?.addEventListener("click", toggleOriginalPageModal);
  els.closeOriginalPageBtn?.addEventListener("click", closeOriginalPageModal);
  els.originalPageModal?.addEventListener("click", (e) => {
    if (e.target === els.originalPageModal) closeOriginalPageModal();
  });

  els.origPrevPageBtn?.addEventListener("click", () => {
    if (state.currentPage > 1) {
      goToPage(state.currentPage - 1, false);
      loadOriginalPageImage(state.currentPage, state.origPageDpi);
    }
  });
  els.origNextPageBtn?.addEventListener("click", () => {
    if (state.currentPage < state.totalPages) {
      goToPage(state.currentPage + 1, false);
      loadOriginalPageImage(state.currentPage, state.origPageDpi);
    }
  });

  els.origDpi170Btn?.addEventListener("click", () => setOrigDpi(170));
  els.origDpi300Btn?.addEventListener("click", () => setOrigDpi(300));
  els.origZoomInBtn?.addEventListener("click", () => updateOrigZoom(20));
  els.origZoomOutBtn?.addEventListener("click", () => updateOrigZoom(-20));
  els.origZoomFitBtn?.addEventListener("click", () => updateOrigZoom("fit"));
  els.origToggleSplitBtn?.addEventListener("click", toggleSplitView);

  // Split View Toolbar bindings
  els.splitCloseBtn?.addEventListener("click", () => {
    if (state.isSplitView) toggleSplitView();
  });
  els.splitDpi170Btn?.addEventListener("click", () => setSplitDpi(170));
  els.splitDpi300Btn?.addEventListener("click", () => setSplitDpi(300));
  els.splitZoomInBtn?.addEventListener("click", () => updateSplitZoom(20));
  els.splitZoomOutBtn?.addEventListener("click", () => updateSplitZoom(-20));

  // Lightbox Pan & Drag
  let isOrigPanning = false;
  let origStartX = 0;
  let origStartY = 0;
  let origScrollLeft = 0;
  let origScrollTop = 0;

  els.origPageViewport?.addEventListener("mousedown", (e) => {
    if (e.button !== 0) return;
    isOrigPanning = true;
    els.origPageViewport.classList.add("is-panning");
    origStartX = e.pageX - els.origPageViewport.offsetLeft;
    origStartY = e.pageY - els.origPageViewport.offsetTop;
    origScrollLeft = els.origPageViewport.scrollLeft;
    origScrollTop = els.origPageViewport.scrollTop;
  });

  window.addEventListener("mouseup", () => {
    if (isOrigPanning) {
      isOrigPanning = false;
      els.origPageViewport?.classList.remove("is-panning");
    }
  });

  els.origPageViewport?.addEventListener("mousemove", (e) => {
    if (!isOrigPanning) return;
    e.preventDefault();
    const x = e.pageX - els.origPageViewport.offsetLeft;
    const y = e.pageY - els.origPageViewport.offsetTop;
    els.origPageViewport.scrollLeft = origScrollLeft - (x - origStartX);
    els.origPageViewport.scrollTop = origScrollTop - (y - origStartY);
  });

  els.origPageViewport?.addEventListener(
    "wheel",
    (e) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        if (e.deltaY < 0) updateOrigZoom(15);
        else updateOrigZoom(-15);
      }
    },
    { passive: false }
  );

  // 17. Phím tắt bàn phím E-Reader
  window.addEventListener("keydown", (e) => {
    // Phím Ctrl+F hoặc Cmd+F mở thanh tìm kiếm ở bất kỳ đâu
    if ((e.ctrlKey || e.metaKey) && (e.key === "f" || e.key === "F")) {
      e.preventDefault();
      openSearchBar();
      return;
    }

    const tag = document.activeElement?.tagName?.toLowerCase();
    if (tag === "input" || tag === "textarea" || tag === "select") {
      if (e.key === "Escape") {
        closeSearchBar();
        closeOriginalPageModal();
      }
      return;
    }

    if (e.key === "/") {
      e.preventDefault();
      openSearchBar();
      return;
    } else if (e.key === "o" || e.key === "O") {
      e.preventDefault();
      toggleOriginalPageModal();
      return;
    }

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
      closeSearchBar();
      closeOriginalPageModal();
      closeDrawer();
      closeDictModal();
      closeShortcutsModal();
      closeSettingsModal();
      closePasswordModal();
    }
  });
}

// ============================================================================
// Application Bootstrapper
// ============================================================================

export async function initApp() {
  initElements();
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
  adjustPageInputWidth();

  // Khởi động ở màn hình Home chuẩn Thư Viện Apple
  showScreen("home");
}

// Gắn các hàm thông dụng vào window để duy trì tương thích console / tiện ích gỡ lỗi
if (typeof window !== "undefined") {
  window.showScreen = showScreen;
  window.openDrawer = openDrawer;
  window.closeDrawer = closeDrawer;

  window.addEventListener("resize", () => {
    if (state.isSplitView && window.innerWidth < 768) {
      toggleSplitView();
      showAppleToast("Màn hình hẹp: Đã tự động tắt chế độ chia đôi", "ℹ️", 3000);
    }
  });
}

// Khởi chạy ứng dụng
if (typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initApp);
  } else {
    initApp();
  }
}
