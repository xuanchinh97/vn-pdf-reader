// ============================================================================
// VN PDF Reader — Reader Core (Document & Page Rendering, Preferences, OCR & Lightbox)
// ============================================================================

import {
  state,
  els,
  escapeHtml,
  getFileTypeLabel,
  showAppleToast,
} from "./state.js";
import {
  stopReading,
  playFromSentence,
  prewarmFirstSentenceOnPage,
} from "./audio-controller.js";
import {
  loadAnnotations,
  updateBookmarkRibbonState,
  renderHighlightsOnPage,
} from "./annotation-mgr.js";
import {
  renderTocList,
  updateChapterHeaderForCurrentPage,
  updateHighlightActiveTocItem,
} from "./toc-viewer.js";
import { highlightSearchMatchOnPage } from "./search-drawer.js";
import { openPasswordModal } from "./ui-utils.js";

// ============================================================================
// 1. Screen Switching & Format UI
// ============================================================================

export function showScreen(screenName) {
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

export function adjustPageInputWidth() {
  if (!els.pageInput) return;
  const valStr = String(els.pageInput.value || "1");
  const charWidth = 9.5;
  const padding = 18;
  const targetW = Math.max(34, Math.round(valStr.length * charWidth + padding));
  els.pageInput.style.width = `${targetW}px`;
}

export function updateFormatUI() {
  const isPdf = !state.fileType || state.fileType === "pdf";
  if (els.originalPageToggleBtn) {
    els.originalPageToggleBtn.style.display = isPdf ? "" : "none";
  }
}

// ============================================================================
// 2. Reading History (Recent Books)
// ============================================================================

export function saveRecentBook(docId, title, totalPages, currentPage = 1) {
  try {
    let recents = JSON.parse(localStorage.getItem("vn_recent_books") || "[]");
    const existing = recents.find((b) => b.id === docId || b.title === title);
    recents = recents.filter((b) => b.id !== docId && b.title !== title);
    const ext = title ? title.substring(title.lastIndexOf(".")).toLowerCase() : ".pdf";
    const fileType = ext === ".epub" ? "epub" : ext === ".txt" ? "txt" : "pdf";
    recents.unshift({
      id: docId,
      title: title,
      fileType: fileType,
      totalPages: totalPages || existing?.totalPages || 1,
      currentPage: currentPage || existing?.currentPage || 1,
      timestamp: Date.now(),
    });
    localStorage.setItem("vn_recent_books", JSON.stringify(recents.slice(0, 8)));
  } catch (_) {}
}

export function renderRecentBooks() {
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
          <div class="cover-author">${getFileTypeLabel(book.title)}</div>
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
        state.fileType = book.fileType || getFileTypeLabel(book.title).toLowerCase();
        updateFormatUI();
        els.docTitleLabel.textContent = book.title;
        els.totalPagesLabel.textContent = book.totalPages;
        els.pageInput.max = book.totalPages;
        els.pageInput.value = state.currentPage;
        adjustPageInputWidth();

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

// ============================================================================
// 3. Reading Preferences, Typography & Themes
// ============================================================================

export function loadReadingPreferences() {
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

export function applyReadingPreferences() {
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

export function updateChipActiveState(container, attr, value) {
  if (!container) return;
  container.querySelectorAll(".chip").forEach((chip) => {
    if (chip.getAttribute(attr) === value) {
      chip.classList.add("active");
    } else {
      chip.classList.remove("active");
    }
  });
}

export function updateThemeButton() {
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

export function toggleZenMode() {
  state.isZenMode = !state.isZenMode;
  document.body.classList.toggle("zen-mode", state.isZenMode);
  if (els.exitZenBtn) els.exitZenBtn.hidden = !state.isZenMode;
  if (state.isZenMode && els.readingSettingsPopover) {
    els.readingSettingsPopover.hidden = true;
  }
}

export function updateZoom(delta) {
  state.zoomPercent = Math.max(50, Math.min(220, state.zoomPercent + delta));
  if (els.zoomLabel) els.zoomLabel.textContent = `${state.zoomPercent}%`;
  if (els.pdfPageImage) {
    els.pdfPageImage.style.maxWidth = state.zoomPercent === 100 ? "100%" : "none";
    els.pdfPageImage.style.width = `${state.zoomPercent}%`;
  }
}

// ============================================================================
// 4. File Upload & Page Navigation
// ============================================================================

export async function handlePdfUpload(file) {
  stopReading();
  if (els.docTitleLabel) els.docTitleLabel.textContent = `Đang tải: ${file.name}...`;

  const formData = new FormData();
  formData.append("file", file);

  try {
    const res = await fetch("/api/upload", {
      method: "POST",
      body: formData,
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || "Lỗi tải file");
    }
    const info = await res.json();

    if (info.needs_password) {
      if (els.docTitleLabel) els.docTitleLabel.textContent = `Tài liệu bị khóa: ${info.filename}`;
      openPasswordModal(
        info,
        async (unlockedInfo) => {
          await setupDocumentAfterUpload(unlockedInfo);
          showAppleToast("Đã mở khóa tài liệu thành công!", "success");
        },
        () => {
          if (els.docTitleLabel) els.docTitleLabel.textContent = "Đã hủy mở khóa tài liệu";
          showScreen("home");
        }
      );
      return;
    }

    await setupDocumentAfterUpload(info);
  } catch (err) {
    alert(`Không thể mở tài liệu: ${err.message}`);
    if (els.docTitleLabel) els.docTitleLabel.textContent = "Lỗi mở tài liệu";
  }
}

export async function setupDocumentAfterUpload(info) {
  state.docId = info.doc_id;
  state.filename = info.filename;
  state.fileType = info.file_type || getFileTypeLabel(info.filename).toLowerCase();
  state.totalPages = info.page_count;
  state.currentPage = 1;
  state.toc = info.toc || [];
  updateFormatUI();

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
  if (els.emptyState) els.emptyState.hidden = true;
  if (els.splitContainer) {
    els.splitContainer.hidden = false;
    els.splitContainer.classList.add("single-pane");
  }
  if (els.pdfPane) els.pdfPane.hidden = true;
  if (els.showPdfPaneBtn) els.showPdfPaneBtn.hidden = true;

  if (els.docTitleLabel) els.docTitleLabel.textContent = info.filename;
  if (els.totalPagesLabel) els.totalPagesLabel.textContent = info.page_count;
  if (els.pageInput) {
    els.pageInput.max = info.page_count;
    els.pageInput.disabled = false;
  }
  if (els.encodingModeSelect) els.encodingModeSelect.disabled = false;

  await goToPage(1, false);
}

export async function goToPrevChapter() {
  if (!state.docId) state.docId = "demo_hanoi";

  if (state.toc && state.toc.length > 0) {
    const prevChapters = state.toc
      .filter((item) => Number(item.page) < state.currentPage)
      .sort((a, b) => Number(b.page) - Number(a.page));

    if (prevChapters.length > 0) {
      await goToPage(Number(prevChapters[0].page), false);
      return;
    }
  }

  if (state.currentPage > 1) {
    await goToPage(state.currentPage - 1, false);
  }
}

export async function goToNextChapter() {
  if (!state.docId) state.docId = "demo_hanoi";

  if (state.toc && state.toc.length > 0) {
    const nextChapters = state.toc
      .filter((item) => Number(item.page) > state.currentPage)
      .sort((a, b) => Number(a.page) - Number(b.page));

    if (nextChapters.length > 0) {
      await goToPage(Number(nextChapters[0].page), false);
      return;
    }
  }

  if (state.currentPage < state.totalPages) {
    await goToPage(state.currentPage + 1, false);
  }
}

export async function goToPage(pageNumber, autoPlay = false) {
  if (!state.docId) state.docId = "demo_hanoi";
  stopReading();

  state.currentPage = pageNumber;
  state.ocrSessionId = (state.ocrSessionId || 0) + 1;
  state.isOcrRunning = false;
  if (els.ocrProgressBox) els.ocrProgressBox.hidden = true;
  window.scrollTo({ top: 0, behavior: "smooth" });
  saveRecentBook(state.docId, state.filename, state.totalPages, pageNumber);
  if (els.pageInput) els.pageInput.value = pageNumber;
  adjustPageInputWidth();
  if (els.prevPageBtn) els.prevPageBtn.disabled = pageNumber <= 1;
  if (els.nextPageBtn) els.nextPageBtn.disabled = pageNumber >= state.totalPages;
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
  if (els.pdfPageImage) {
    els.pdfPageImage.src = `/api/doc/${state.docId}/page/${pageNumber}/image?dpi=170`;
  }

  // Tải văn bản trang đã được sửa lỗi font
  const mode = els.encodingModeSelect?.value || "auto";
  try {
    const res = await fetch(`/api/doc/${state.docId}/page/${pageNumber}?mode=${mode}`);
    if (!res.ok) throw new Error("Không thể trích xuất văn bản trang này");
    const data = await res.json();
    applyPageData(data);
    updateBookmarkRibbonState();
    updateHighlightActiveTocItem();
    renderHighlightsOnPage();

    // Đồng bộ ảnh trang PDF gốc nếu modal Lightbox hoặc Split View đang mở
    if (els.originalPageModal && !els.originalPageModal.hidden) {
      loadOriginalPageImage(pageNumber, state.origPageDpi);
    }
    if (state.isSplitView) {
      updateSplitPaneView();
    }

    // Nếu đang tìm kiếm và có kết quả trên trang này, tự động highlight
    if (state.searchResults.length > 0 && state.searchCurrentIndex >= 0) {
      const curMatch = state.searchResults[state.searchCurrentIndex];
      if (curMatch && curMatch.page === pageNumber) {
        highlightSearchMatchOnPage(curMatch);
      }
    }

    // Tự động quét OCR nếu trang bị lỗi font hoặc là ảnh scan
    if (data.needs_ocr && els.autoOcrCheckbox?.checked) {
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

export function applyPageData(data) {
  state.cleanText = data.text || "";
  state.sentences = data.sentences || [];
  state.currentSentenceIndex = -1;

  // Cập nhật tiêu đề chương nếu trang này trùng với một mục trong Mục lục (TOC)
  updateChapterHeaderForCurrentPage();

  if (els.statusBadge) els.statusBadge.hidden = false;
  if (els.statusReasonLabel) els.statusReasonLabel.textContent = data.reason || "";

  if (els.statusBadge) {
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
  }

  renderSentences();
}

export function renderSentences() {
  const hasSentences = state.sentences.length > 0;
  if (els.playPauseBtn) els.playPauseBtn.disabled = !hasSentences;
  if (els.stopBtn) els.stopBtn.disabled = !hasSentences;
  if (els.prevSentenceBtn) els.prevSentenceBtn.disabled = !hasSentences;
  if (els.nextSentenceBtn) els.nextSentenceBtn.disabled = !hasSentences;
  if (els.downloadMp3Btn) els.downloadMp3Btn.disabled = !(state.docId || hasSentences);
  if (els.skipBackBtn) els.skipBackBtn.disabled = !hasSentences;
  if (els.skipForwardBtn) els.skipForwardBtn.disabled = !hasSentences;

  if (!els.sentencesContainer) return;

  if (!hasSentences) {
    els.sentencesContainer.innerHTML = `
      <div class="empty-page-notice">
        <p>Trang này chưa có văn bản đọc được (hoặc là trang ảnh scan / lỗi font nặng).</p>
        <button class="btn btn-accent" id="emptyOcrTriggerBtn">
          🔍 Bấm để Quét OCR Tiếng Việt cho trang này
        </button>
      </div>
    `;
    document.getElementById("emptyOcrTriggerBtn")?.addEventListener("click", () => {
      runBrowserVietnameseOcr(false);
    });
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

export function groupSentencesIntoParagraphs(cleanText, sentences) {
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

      if (accumulated.length >= rawP.length - 8 || sentIdx === sentences.length) {
        break;
      }
    }

    if (currentGroup.length > 0) {
      result.push(currentGroup);
    }
  }

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

export function updateBookFooter() {
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
  const wordCount = state.cleanText ? state.cleanText.trim().split(/\s+/).length : 0;
  const mins = Math.max(1, Math.ceil(wordCount / 220));
  if (els.bookEstTime) {
    els.bookEstTime.textContent = wordCount > 0 ? `~${mins} phút đọc` : "~0 phút";
  }
}

// ============================================================================
// 5. Browser Vietnamese OCR (Tesseract.js)
// ============================================================================

export async function runBrowserVietnameseOcr(autoPlayAfter = false) {
  if (!state.docId || state.isOcrRunning) return;
  const targetDocId = state.docId;
  const targetPage = state.currentPage;
  const myOcrSession = ++state.ocrSessionId;
  state.isOcrRunning = true;
  if (els.ocrProgressBox) els.ocrProgressBox.hidden = false;
  if (els.ocrProgressText) els.ocrProgressText.textContent = "Đang khởi tạo bộ nhận diện chữ Tiếng Việt (OCR)...";
  if (els.ocrProgressPercent) els.ocrProgressPercent.textContent = "0%";
  if (els.ocrProgressBar) els.ocrProgressBar.style.width = "0%";

  try {
    const imageUrl = `/api/doc/${targetDocId}/page/${targetPage}/image?dpi=220&enhance=true`;

    if (!state.ocrWorker) {
      /* global Tesseract */
      state.ocrWorker = await Tesseract.createWorker("vie", 1, {
        logger: (m) => {
          if (myOcrSession !== state.ocrSessionId) return;
          if (m.status === "recognizing text" && typeof m.progress === "number") {
            const pct = Math.round(m.progress * 100);
            if (els.ocrProgressText) els.ocrProgressText.textContent = "Đang quét mặt chữ Tiếng Việt trên trang PDF...";
            if (els.ocrProgressPercent) els.ocrProgressPercent.textContent = `${pct}%`;
            if (els.ocrProgressBar) els.ocrProgressBar.style.width = `${pct}%`;
          } else if (m.status && els.ocrProgressText) {
            els.ocrProgressText.textContent = `OCR: ${m.status}...`;
          }
        },
      });
    }

    const {
      data: { text },
    } = await state.ocrWorker.recognize(imageUrl);

    // Nếu người dùng đã chuyển sang trang khác trong lúc chờ OCR, HỦY kết quả cũ!
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
      if (els.ocrProgressBox) els.ocrProgressBox.hidden = true;
    }
  }
}

export async function processRawTextFromClient(rawText, customReason, badgeType = "unicode") {
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
// 6. Original Page Lightbox & Split View
// ============================================================================

export function openOriginalPageModal(pageNumber = state.currentPage) {
  if (!els.originalPageModal) return;
  els.originalPageModal.removeAttribute("hidden");
  els.originalPageModal.hidden = false;
  state.origPageZoom = 100;
  loadOriginalPageImage(pageNumber, state.origPageDpi);
}

export function closeOriginalPageModal() {
  if (!els.originalPageModal) return;
  els.originalPageModal.setAttribute("hidden", "");
  els.originalPageModal.hidden = true;
}

export function toggleOriginalPageModal() {
  if (els.originalPageModal && !els.originalPageModal.hidden) {
    closeOriginalPageModal();
  } else {
    openOriginalPageModal(state.currentPage);
  }
}

export function loadOriginalPageImage(pageNumber, dpi = 170) {
  if (!state.docId || !els.originalPageLightboxImg) return;
  const safePage = Math.max(1, Math.min(state.totalPages, pageNumber));

  if (els.originalPageModalTitle) {
    els.originalPageModalTitle.textContent = `Trang ${safePage} / ${state.totalPages}`;
  }
  if (els.origPageIndicator) {
    els.origPageIndicator.textContent = `${safePage} / ${state.totalPages}`;
  }
  if (els.origPrevPageBtn) els.origPrevPageBtn.disabled = safePage <= 1;
  if (els.origNextPageBtn) els.origNextPageBtn.disabled = safePage >= state.totalPages;

  if (els.origDownloadBtn) {
    els.origDownloadBtn.href = `/api/doc/${state.docId}/page/${safePage}/image?dpi=300`;
    els.origDownloadBtn.download = `${state.filename || 'doc'}_trang_${safePage}.png`;
  }

  if (els.origLoadingSpinner) els.origLoadingSpinner.hidden = false;

  const img = new Image();
  const url = `/api/doc/${state.docId}/page/${safePage}/image?dpi=${dpi}&t=${Date.now()}`;
  img.onload = () => {
    els.originalPageLightboxImg.src = url;
    if (els.origLoadingSpinner) els.origLoadingSpinner.hidden = true;
  };
  img.onerror = () => {
    if (els.origLoadingSpinner) els.origLoadingSpinner.hidden = true;
    console.error("[OriginalPage] Không thể tải trang PDF gốc");
  };
  img.src = url;

  applyOrigZoom();
}

export function updateOrigZoom(delta) {
  if (delta === "fit") {
    state.origPageZoom = 100;
  } else {
    state.origPageZoom = Math.max(40, Math.min(260, state.origPageZoom + delta));
  }
  applyOrigZoom();
}

export function applyOrigZoom() {
  if (!els.originalPageLightboxImg) return;
  els.originalPageLightboxImg.style.transform = "none";
  if (state.origPageZoom === 100) {
    els.originalPageLightboxImg.style.maxWidth = "100%";
    els.originalPageLightboxImg.style.width = "auto";
    els.originalPageLightboxImg.style.height = "auto";
  } else {
    const baseW = Math.max(380, els.origPageViewport ? els.origPageViewport.clientWidth - 48 : 720);
    const targetW = Math.round(baseW * (state.origPageZoom / 100));
    els.originalPageLightboxImg.style.maxWidth = "none";
    els.originalPageLightboxImg.style.width = `${targetW}px`;
    els.originalPageLightboxImg.style.height = "auto";
  }
  if (els.origZoomLevelLabel) {
    els.origZoomLevelLabel.textContent = `${state.origPageZoom}%`;
  }
}

export function setOrigDpi(dpi) {
  state.origPageDpi = dpi;
  if (els.origDpi170Btn) els.origDpi170Btn.classList.toggle("active", dpi === 170);
  if (els.origDpi300Btn) els.origDpi300Btn.classList.toggle("active", dpi === 300);
  loadOriginalPageImage(state.currentPage, dpi);
}

export function toggleSplitView() {
  if (window.innerWidth < 768 && !state.isSplitView) {
    showAppleToast("Chế độ chia đôi chỉ hỗ trợ màn hình máy tính / tablet ngang (>= 768px)", "⚠️", 3500);
    return;
  }

  state.isSplitView = !state.isSplitView;
  document.body.classList.toggle("split-view-active", state.isSplitView);

  if (els.originalPageToggleBtn) {
    els.originalPageToggleBtn.classList.toggle("active", state.isSplitView);
  }
  if (els.origSplitBtnText) {
    els.origSplitBtnText.textContent = state.isSplitView ? "Tắt chia đôi" : "Chia đôi";
  }
  if (els.origToggleSplitBtn) {
    els.origToggleSplitBtn.classList.toggle("active", state.isSplitView);
  }

  if (state.isSplitView) {
    if (els.pdfPane) els.pdfPane.hidden = false;
    if (els.splitContainer) els.splitContainer.classList.remove("single-pane");
    closeOriginalPageModal();
    updateSplitPaneView();
    showAppleToast("Đã bật Chế độ chia đôi màn hình (Văn bản & Trang PDF gốc)", "📖", 3500);
  } else {
    if (els.pdfPane) els.pdfPane.hidden = true;
    if (els.splitContainer) els.splitContainer.classList.add("single-pane");
    showAppleToast("Đã chuyển về Chế độ đọc tập trung 1 cột", "📖", 3000);
  }
}

export function updateSplitPaneView() {
  if (!state.isSplitView || !els.pdfPageImage || !state.docId) return;
  const safePage = Math.max(1, Math.min(state.totalPages, state.currentPage));
  if (els.splitPanePageLabel) {
    els.splitPanePageLabel.textContent = `Trang ${safePage} / ${state.totalPages}`;
  }
  const url = `/api/doc/${state.docId}/page/${safePage}/image?dpi=${state.splitPageDpi}&t=${Date.now()}`;
  els.pdfPageImage.src = url;
  applySplitZoom();
}

export function updateSplitZoom(delta) {
  if (delta === "fit") {
    state.splitPageZoom = 100;
  } else {
    state.splitPageZoom = Math.max(50, Math.min(250, state.splitPageZoom + delta));
  }
  applySplitZoom();
}

export function applySplitZoom() {
  if (!els.pdfPageImage) return;
  if (state.splitPageZoom === 100) {
    els.pdfPageImage.style.width = "100%";
    els.pdfPageImage.style.maxWidth = "100%";
  } else {
    els.pdfPageImage.style.maxWidth = "none";
    els.pdfPageImage.style.width = `${state.splitPageZoom}%`;
  }
  if (els.splitZoomLevelLabel) {
    els.splitZoomLevelLabel.textContent = `${state.splitPageZoom}%`;
  }
}

export function setSplitDpi(dpi) {
  state.splitPageDpi = dpi;
  if (els.splitDpi170Btn) els.splitDpi170Btn.classList.toggle("active", dpi === 170);
  if (els.splitDpi300Btn) els.splitDpi300Btn.classList.toggle("active", dpi === 300);
  updateSplitPaneView();
}
