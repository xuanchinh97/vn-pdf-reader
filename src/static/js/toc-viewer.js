// ============================================================================
// VN PDF Reader — TOC Viewer (Thumbnails & Outline Tree) & Drawer Management
// ============================================================================

import { state, els, escapeHtml } from "./state.js";
import { goToPage } from "./reader-core.js";

// ============================================================================
// 1. Drawer Opening, Closing & Tabs
// ============================================================================

export function openDrawer(tabName = "toc") {
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

export function closeDrawer() {
  if (els.tocDrawer) {
    els.tocDrawer.setAttribute("hidden", "");
    els.tocDrawer.hidden = true;
    els.drawerBackdrop.setAttribute("hidden", "");
    els.drawerBackdrop.hidden = true;
  }
}

export function toggleDrawer() {
  if (els.tocDrawer && !els.tocDrawer.hidden) {
    closeDrawer();
  } else {
    openDrawer("toc");
  }
}

export function switchDrawerTab(tabName) {
  const tabs = [
    { name: "toc", btn: els.tabBtnToc, pane: els.drawerTabToc },
    { name: "bookmarks", btn: els.tabBtnBookmarks, pane: els.drawerTabBookmarks },
    { name: "highlights", btn: els.tabBtnHighlights, pane: els.drawerTabHighlights },
    { name: "search", btn: els.tabBtnSearch, pane: els.drawerTabSearch },
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

// ============================================================================
// 2. Dynamic Chapter Header & Highlight Active TOC Item
// ============================================================================

export function updateChapterHeaderForCurrentPage() {
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

export function updateHighlightActiveTocItem() {
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

// ============================================================================
// 3. Document Outline Tree (Hierarchical)
// ============================================================================

export function buildOutlineTree(flatToc) {
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

export function renderOutlineNodesHtml(nodes) {
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

// ============================================================================
// 4. Dual-Mode TOC (Thumbnails + Outline)
// ============================================================================

export function renderTocList() {
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
