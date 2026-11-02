// ============================================================================
// VN PDF Reader — UI Utilities, Dialogs & Modals
// ============================================================================

import { state, els, escapeHtml } from "./state.js";
import { loadVoices, fetchSentenceAudioUrl } from "./audio-controller.js";

// ============================================================================
// 1. Settings & Proxy Modal
// ============================================================================

export async function openSettingsModal() {
  try {
    const res = await fetch("/api/config");
    if (res.ok) {
      const cfg = await res.json();
      if (els.proxyInput) els.proxyInput.value = cfg.http_proxy || "";
    }
  } catch (err) {
    console.warn("Không đọc được cấu hình:", err);
  }
  if (els.settingsModal) els.settingsModal.hidden = false;
}

export function closeSettingsModal() {
  if (els.settingsModal) els.settingsModal.hidden = true;
}

export async function saveSettings() {
  const proxy = els.proxyInput?.value?.trim() || "";
  try {
    const res = await fetch("/api/config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ http_proxy: proxy }),
    });
    if (!res.ok) throw new Error("Lỗi lưu cấu hình");
    await loadVoices();
    closeSettingsModal();
    alert("Đã lưu cài đặt mạng & proxy thành công!");
  } catch (err) {
    alert("Không thể lưu cấu hình: " + err.message);
  }
}

// ============================================================================
// 2. Keyboard Shortcuts Modal
// ============================================================================

export function openShortcutsModal() {
  if (els.shortcutsModal) els.shortcutsModal.hidden = false;
}

export function closeShortcutsModal() {
  if (els.shortcutsModal) els.shortcutsModal.hidden = true;
}

// ============================================================================
// 3. Vietnamese Dictionary Modal (Wiktionary + Offline Cache)
// ============================================================================

export async function openDictModal(initialWord = "") {
  if (els.dictModal) els.dictModal.hidden = false;
  if (initialWord) {
    if (els.dictSearchInput) els.dictSearchInput.value = initialWord;
    await lookupWord(initialWord);
  } else if (els.dictSearchInput) {
    els.dictSearchInput.focus();
  }
}

export function closeDictModal() {
  if (els.dictModal) els.dictModal.hidden = true;
}

export async function lookupWord(word) {
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

export function renderDictResults(data) {
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

// ============================================================================
// 4. Password Protection Modal
// ============================================================================

let currentPasswordDoc = null;

export function openPasswordModal(docInfo, onUnlocked, onCancelled) {
  currentPasswordDoc = { docInfo, onUnlocked, onCancelled };
  if (els.passwordDocName) {
    els.passwordDocName.textContent = docInfo.filename || "tài liệu PDF";
  }
  if (els.pdfPasswordInput) {
    els.pdfPasswordInput.value = "";
    els.pdfPasswordInput.type = "password";
  }
  if (els.passwordErrorMsg) {
    els.passwordErrorMsg.hidden = true;
  }
  if (els.passwordModal) {
    els.passwordModal.hidden = false;
  }
  setTimeout(() => els.pdfPasswordInput?.focus(), 80);
}

export function closePasswordModal() {
  if (els.passwordModal) {
    els.passwordModal.hidden = true;
  }
  if (currentPasswordDoc && currentPasswordDoc.onCancelled) {
    currentPasswordDoc.onCancelled();
  }
  currentPasswordDoc = null;
}

export async function submitPasswordUnlock() {
  if (!currentPasswordDoc) return;
  const password = els.pdfPasswordInput?.value || "";
  if (!password) {
    if (els.passwordErrorMsg) {
      els.passwordErrorMsg.textContent = "Vui lòng nhập mật khẩu mở tài liệu.";
      els.passwordErrorMsg.hidden = false;
    }
    els.pdfPasswordInput?.focus();
    return;
  }

  if (els.unlockPdfBtn) els.unlockPdfBtn.disabled = true;
  if (els.unlockBtnText) els.unlockBtnText.textContent = "Đang mở khóa...";
  if (els.passwordErrorMsg) els.passwordErrorMsg.hidden = true;

  try {
    const res = await fetch(`/api/doc/${encodeURIComponent(currentPasswordDoc.docInfo.doc_id)}/unlock`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || "Mật khẩu không chính xác. Vui lòng thử lại.");
    }

    const unlockedInfo = await res.json();
    const callback = currentPasswordDoc.onUnlocked;
    currentPasswordDoc = null;
    if (els.passwordModal) els.passwordModal.hidden = true;
    if (callback) await callback(unlockedInfo);
  } catch (err) {
    if (els.passwordErrorMsg) {
      els.passwordErrorMsg.textContent = err.message;
      els.passwordErrorMsg.hidden = false;
    }
    if (els.pdfPasswordInput) {
      els.pdfPasswordInput.select();
      els.pdfPasswordInput.focus();
    }
  } finally {
    if (els.unlockPdfBtn) els.unlockPdfBtn.disabled = false;
    if (els.unlockBtnText) els.unlockBtnText.textContent = "Mở khóa";
  }
}

export function togglePasswordVisibility() {
  if (!els.pdfPasswordInput) return;
  const isPass = els.pdfPasswordInput.type === "password";
  els.pdfPasswordInput.type = isPass ? "text" : "password";
}
