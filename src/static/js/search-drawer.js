// ============================================================================
// VN PDF Reader — In-Book Full-Text Search Drawer & Highlights
// ============================================================================

import { state, els, escapeHtml, escapeRegex } from "./state.js";
import { goToPage } from "./reader-core.js";

export let searchDebounceTimer = null;

export function setSearchDebounceTimer(timer) {
  searchDebounceTimer = timer;
}

// ============================================================================
// 1. Search Bar Controls
// ============================================================================

export function openSearchBar(initialQuery = "") {
  if (!els.inBookSearchBar) return;
  els.inBookSearchBar.removeAttribute("hidden");
  els.inBookSearchBar.hidden = false;
  if (els.inBookSearchInput) {
    if (initialQuery) els.inBookSearchInput.value = initialQuery;
    els.inBookSearchInput.focus();
    els.inBookSearchInput.select();
  }
}

export function closeSearchBar() {
  if (els.inBookSearchBar) {
    els.inBookSearchBar.setAttribute("hidden", "");
    els.inBookSearchBar.hidden = true;
  }
  clearSentenceSearchHighlights();
  state.searchCurrentIndex = -1;
  if (els.searchMatchCount) els.searchMatchCount.textContent = "0 kết quả";
}

export function toggleSearchBar() {
  if (els.inBookSearchBar && !els.inBookSearchBar.hidden) {
    closeSearchBar();
  } else {
    openSearchBar();
  }
}

export function clearSentenceSearchHighlights() {
  if (!els.sentencesContainer) return;
  els.sentencesContainer.querySelectorAll(".search-target-sentence").forEach((el) => {
    el.classList.remove("search-target-sentence");
  });
  els.sentencesContainer.querySelectorAll(".search-match-highlight").forEach((mark) => {
    const parent = mark.parentNode;
    if (parent) {
      parent.replaceChild(document.createTextNode(mark.textContent), mark);
      parent.normalize();
    }
  });
}

// ============================================================================
// 2. Search Execution & Match Navigation
// ============================================================================

export async function executeInBookSearch(query) {
  const cleanQ = (query || "").trim();
  state.searchQuery = cleanQ;

  if (cleanQ.length < 2) {
    state.searchResults = [];
    state.searchResultsByPage = [];
    state.searchCurrentIndex = -1;
    if (els.searchMatchCount) els.searchMatchCount.textContent = "Nhập ít nhất 2 ký tự";
    if (els.searchDrawerCount) els.searchDrawerCount.textContent = "0";
    if (els.searchPrevMatchBtn) els.searchPrevMatchBtn.disabled = true;
    if (els.searchNextMatchBtn) els.searchNextMatchBtn.disabled = true;
    renderDrawerSearchResults();
    clearSentenceSearchHighlights();
    return;
  }

  if (els.searchMatchCount) els.searchMatchCount.textContent = "Đang tìm...";
  state.isSearching = true;

  try {
    const res = await fetch(`/api/doc/${state.docId}/search?q=${encodeURIComponent(cleanQ)}`);
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.detail || "Không thể tìm kiếm trong tài liệu");
    }
    const data = await res.json();
    state.searchResults = data.results || [];
    state.searchResultsByPage = data.results_by_page || [];
    state.searchCurrentIndex = state.searchResults.length > 0 ? 0 : -1;

    const count = state.searchResults.length;
    if (els.searchDrawerCount) els.searchDrawerCount.textContent = count;
    if (els.searchPrevMatchBtn) els.searchPrevMatchBtn.disabled = count === 0;
    if (els.searchNextMatchBtn) els.searchNextMatchBtn.disabled = count === 0;

    if (count > 0) {
      if (els.searchMatchCount) els.searchMatchCount.textContent = `1 / ${count}${data.is_truncated ? '+' : ''}`;
      renderDrawerSearchResults();
      goToSearchMatch(0);
    } else {
      if (els.searchMatchCount) els.searchMatchCount.textContent = "0 kết quả";
      renderDrawerSearchResults();
      clearSentenceSearchHighlights();
    }
  } catch (err) {
    console.error("[Search] Lỗi tìm kiếm:", err);
    if (els.searchMatchCount) els.searchMatchCount.textContent = "Lỗi tìm kiếm";
    renderDrawerSearchResults();
  } finally {
    state.isSearching = false;
  }
}

export async function goToSearchMatch(index) {
  if (!state.searchResults || state.searchResults.length === 0) return;
  const count = state.searchResults.length;
  const safeIdx = (index + count) % count;
  state.searchCurrentIndex = safeIdx;

  if (els.searchMatchCount) {
    els.searchMatchCount.textContent = `${safeIdx + 1} / ${count}`;
  }

  const match = state.searchResults[safeIdx];
  if (!match) return;

  // Cập nhật trạng thái active trong Drawer
  if (els.searchResultsList) {
    els.searchResultsList.querySelectorAll(".search-result-item").forEach((it, i) => {
      it.classList.toggle("active", i === safeIdx);
    });
  }

  // Nếu match nằm ở trang khác, chuyển trang
  if (match.page !== state.currentPage) {
    await goToPage(match.page, false);
  }

  // Highlight kết quả trên trang hiện tại
  highlightSearchMatchOnPage(match);
}

export function highlightSearchMatchOnPage(match) {
  clearSentenceSearchHighlights();
  if (!match || !state.searchQuery || !els.sentencesContainer) return;

  // 1. Tìm thẻ sentence mục tiêu theo sentence_index
  const sentenceEl = els.sentencesContainer.querySelector(`#sentence-${match.sentence_index}`) ||
                     els.sentencesContainer.querySelector(`[data-index="${match.sentence_index}"]`);

  if (sentenceEl) {
    sentenceEl.classList.add("search-target-sentence");
    const textNodeContainer = sentenceEl.querySelector(".sentence-text") || sentenceEl;
    highlightMatchesInElement(textNodeContainer, state.searchQuery);

    setTimeout(() => {
      sentenceEl.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 80);
  } else {
    // Fallback: Tìm thẻ câu chứa đoạn text
    const allSentences = els.sentencesContainer.querySelectorAll(".sentence-item");
    for (const el of allSentences) {
      if (el.textContent.toLowerCase().includes(state.searchQuery.toLowerCase())) {
        el.classList.add("search-target-sentence");
        highlightMatchesInElement(el.querySelector(".sentence-text") || el, state.searchQuery);
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        break;
      }
    }
  }
}

export function highlightMatchesInElement(element, query) {
  if (!element || !query) return;
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, null, false);
  const textNodes = [];
  while (walker.nextNode()) {
    textNodes.push(walker.currentNode);
  }

  const regex = new RegExp(`(${escapeRegex(query)})`, "gi");

  textNodes.forEach((node) => {
    const parent = node.parentNode;
    if (!parent || parent.nodeName === "MARK" || parent.classList.contains("search-match-highlight")) return;

    const val = node.nodeValue;
    if (regex.test(val)) {
      regex.lastIndex = 0;
      const frag = document.createDocumentFragment();
      let lastIndex = 0;
      let m;

      while ((m = regex.exec(val)) !== null) {
        if (m.index > lastIndex) {
          frag.appendChild(document.createTextNode(val.substring(lastIndex, m.index)));
        }
        const mark = document.createElement("mark");
        mark.className = "search-match-highlight search-match-active";
        mark.textContent = m[0];
        frag.appendChild(mark);
        lastIndex = regex.lastIndex;
      }
      if (lastIndex < val.length) {
        frag.appendChild(document.createTextNode(val.substring(lastIndex)));
      }
      parent.replaceChild(frag, node);
    }
  });
}

// ============================================================================
// 3. Search Results Drawer Tab
// ============================================================================

export function renderDrawerSearchResults() {
  if (!els.searchResultsList) return;
  if (!state.searchResults || state.searchResults.length === 0) {
    if (els.searchDrawerSummary) {
      els.searchDrawerSummary.textContent = state.searchQuery
        ? `Không tìm thấy kết quả nào cho "${state.searchQuery}".`
        : "Nhập từ khóa ở thanh tìm kiếm (Ctrl+F) để xem kết quả toàn văn.";
    }
    els.searchResultsList.innerHTML = `<div class="drawer-empty-hint">Không có kết quả tìm kiếm nào.</div>`;
    return;
  }

  if (els.searchDrawerSummary) {
    els.searchDrawerSummary.textContent = `Tìm thấy ${state.searchResults.length} kết quả cho "${state.searchQuery}":`;
  }

  let html = "";
  state.searchResults.forEach((item, globalIdx) => {
    const isActive = globalIdx === state.searchCurrentIndex;
    const cleanSnippet = escapeHtml(item.snippet || "");
    const highlightedSnippet = cleanSnippet.replace(
      new RegExp(`(${escapeRegex(state.searchQuery)})`, "gi"),
      "<mark>$1</mark>"
    );

    html += `
      <div class="search-result-item ${isActive ? 'active' : ''}" data-global-index="${globalIdx}">
        <div class="search-result-top">
          <span class="search-result-page-badge">Trang ${item.page}</span>
          <span style="font-size:11px; color:var(--text-tertiary);">#${globalIdx + 1}</span>
        </div>
        <div class="search-result-snippet">${highlightedSnippet}</div>
      </div>
    `;
  });

  els.searchResultsList.innerHTML = html;

  els.searchResultsList.querySelectorAll(".search-result-item").forEach((itemEl) => {
    itemEl.addEventListener("click", () => {
      const idx = parseInt(itemEl.getAttribute("data-global-index"), 10);
      goToSearchMatch(idx);
    });
  });
}
