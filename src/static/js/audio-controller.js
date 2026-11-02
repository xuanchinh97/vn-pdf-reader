// ============================================================================
// VN PDF Reader — Audio Controller (Multi-Engine AI TTS, Playback & Export)
// ============================================================================

import {
  state,
  els,
  escapeHtml,
  formatTime,
  formatShortVoiceLabel,
  formatSpeedLabel,
  showAppleToast,
} from "./state.js";
import { goToPage } from "./reader-core.js";

export let bookExportAbortController = null;
export let bookExportSavePartialRequested = false;

// ============================================================================
// 1. Voice Management & Selection
// ============================================================================

export async function loadVoices() {
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

export function renderVoicePopoverList(selectedId) {
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

export function selectVoiceById(voiceId) {
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

// ============================================================================
// 2. Speed Control & Presets
// ============================================================================

export function setReadingSpeed(val) {
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

export function updateSpeed(delta) {
  setReadingSpeed(state.speed + delta);
}

// ============================================================================
// 3. Audio Playback Engine & Sentence Prefetch
// ============================================================================

export function setPlayButtonVisual(stateName) {
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

export function togglePlayPause() {
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

export function stopReading() {
  state.playSessionId++;
  state.isPlaying = false;
  state.isPaused = false;
  els.ttsAudio.pause();
  els.ttsAudio.currentTime = 0;
  setPlayButtonVisual("stopped");
  highlightSentence(-1);
  updateMediaSessionPlaybackState("none");
}

export async function fetchSentenceAudioUrl(sentenceText) {
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

export async function prefetchUpcomingSentences(fromIndex, expectedSessionId = state.playSessionId) {
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

export function prewarmFirstSentenceOnPage() {
  if (!state.sentences || state.sentences.length === 0 || state.isPlaying) return;
  const firstSentence = state.sentences[0];
  if (firstSentence && firstSentence.trim().length > 1) {
    fetchSentenceAudioUrl(firstSentence).catch(() => {});
  }
}

export async function playFromSentence(index) {
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
        els.autoNextPageCheckbox?.checked &&
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

export function speakWithBrowserFallback(text, index, sessionId) {
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

export function highlightSentence(index) {
  if (!els.sentencesContainer) return;
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
// 4. Scrubber & MediaSession API
// ============================================================================

export function seekAudioRelative(delta) {
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

export function updateMediaSessionPlaybackState(playbackState) {
  if (!("mediaSession" in navigator)) return;
  try {
    navigator.mediaSession.playbackState = playbackState;
  } catch (_) {}
}

export function updateMediaSessionPosition() {
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

export function setupAudioScrubber() {
  if (!els.ttsAudio) return;
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

export function setupMediaSession() {
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

export function updateMediaSession(index) {
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

// ============================================================================
// 5. Sleep Timer
// ============================================================================

export function updateSleepButtonIcon(isActive) {
  const iconEl = els.sleepTimerIcon || els.sleepTimerBtn;
  if (!iconEl) return;
  iconEl.textContent = isActive ? "⏳" : "🌙";
}

export function setSleepTimer(val) {
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

export function updateSleepTimerDisplay() {
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

export function cancelSleepTimer() {
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

// ============================================================================
// 6. MP3 Audiobook Export
// ============================================================================

export function stripMp3XingHeader(arrayBuffer) {
  const bytes = new Uint8Array(arrayBuffer);
  if (bytes.length < 256) return arrayBuffer;
  // Kiểm tra chữ ký 'Xing' hoặc 'Info' trong 220 bytes đầu tiên
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

export function triggerAudioFileDownload(buffers, fileName) {
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

export function setDownloadMenuText(label, icon = "🎧") {
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

export async function downloadFullPageMp3() {
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

    fetchPageContent(1).catch(() => {});
    if (total >= 2) fetchPageContent(2).catch(() => {});

    let nextPageCursor = 1;

    const runExportWorker = async () => {
      while (nextPageCursor <= total && !bookExportAbortController.signal.aborted) {
        const p = nextPageCursor++;
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
