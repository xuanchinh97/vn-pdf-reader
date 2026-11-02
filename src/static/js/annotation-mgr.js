// ============================================================================
// VN PDF Reader — Annotation Manager (Bookmarks & Highlights)
// ============================================================================

import { state, els, escapeHtml } from "./state.js";
import { goToPage, renderSentences } from "./reader-core.js";
import { closeDrawer } from "./toc-viewer.js";

export let currentSelectedText = "";

export function setCurrentSelectedText(val) {
  currentSelectedText = val;
}

// ============================================================================
// 1. Persistence (LocalStorage & API Sync)
// ============================================================================

export async function loadAnnotations() {
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

export async function saveAnnotations() {
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

// ============================================================================
// 2. Bookmarks
// ============================================================================

export function toggleBookmarkCurrentPage() {
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

export function updateBookmarkRibbonState() {
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

export function updateBookmarkCount() {
  if (els.bookmarkCount) {
    els.bookmarkCount.textContent = state.bookmarks.length;
  }
}

export function renderBookmarksList() {
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

// ============================================================================
// 3. Highlights
// ============================================================================

export function updateHighlightCount() {
  if (els.highlightCount) {
    els.highlightCount.textContent = state.highlights.length;
  }
}

export function renderHighlightsList() {
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

export function renderHighlightsOnPage() {
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

export function applyHighlight(color = "yellow") {
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

export function setupSelectionListener() {
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
