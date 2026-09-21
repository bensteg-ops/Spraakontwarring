const state = {
  recordings: [],
  currentId: null,
  pollTimer: null,
};

// ---------- Opnemen in de browser ----------
let mediaRecorder = null;
let recordedChunks = [];
let recordStartTime = null;
let timerInterval = null;

const recordBtn = document.getElementById("recordBtn");
const recordLabel = document.getElementById("recordLabel");
const timerEl = document.getElementById("timer");
const fileInput = document.getElementById("fileInput");
const titleInput = document.getElementById("titleInput");
const langSelect = document.getElementById("langSelect");
const minutesLangSelect = document.getElementById("minutesLangSelect");

recordBtn.addEventListener("click", async () => {
  if (mediaRecorder && mediaRecorder.state === "recording") {
    mediaRecorder.stop();
    return;
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    recordedChunks = [];
    mediaRecorder = new MediaRecorder(stream);
    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) recordedChunks.push(e.data);
    };
    mediaRecorder.onstop = () => {
      stream.getTracks().forEach((t) => t.stop());
      clearInterval(timerInterval);
      timerEl.textContent = "00:00";
      recordBtn.classList.remove("recording");
      recordLabel.textContent = "Opname starten";
      const blob = new Blob(recordedChunks, { type: "audio/webm" });
      uploadRecording(blob, "opname.webm");
    };
    mediaRecorder.start();
    recordStartTime = Date.now();
    timerInterval = setInterval(updateTimer, 1000);
    recordBtn.classList.add("recording");
    recordLabel.textContent = "Stop opname";
  } catch (err) {
    alert("Kon microfoon niet gebruiken: " + err.message);
  }
});

function updateTimer() {
  const secs = Math.floor((Date.now() - recordStartTime) / 1000);
  const m = String(Math.floor(secs / 60)).padStart(2, "0");
  const s = String(secs % 60).padStart(2, "0");
  timerEl.textContent = `${m}:${s}`;
}

fileInput.addEventListener("change", () => {
  const file = fileInput.files[0];
  if (file) uploadRecording(file, file.name);
  fileInput.value = "";
});

async function uploadRecording(blob, filename) {
  const form = new FormData();
  form.append("audio", blob, filename);
  if (titleInput.value.trim()) form.append("title", titleInput.value.trim());
  form.append("language", langSelect.value);
  form.append("minutesLanguage", minutesLangSelect.value);

  try {
    const res = await fetch("/api/recordings", { method: "POST", body: form });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || "Upload mislukt");
    }
    const record = await res.json();
    titleInput.value = "";
    await refreshList();
    selectRecording(record.id);
  } catch (err) {
    alert("Er ging iets mis bij het uploaden: " + err.message);
  }
}

// ---------- Lijst met opnames ----------
async function refreshList() {
  const res = await fetch("/api/recordings");
  if (res.status === 401) return showAuthScreen();
  state.recordings = await res.json();
  renderList();
}

function renderList() {
  const listEl = document.getElementById("recordingList");
  listEl.innerHTML = "";
  for (const r of state.recordings) {
    const li = document.createElement("li");
    li.className = "recording-item" + (r.id === state.currentId ? " active" : "");
    li.innerHTML = `
      <div class="r-title">${escapeHtml(r.title)}</div>
      <div class="r-meta">
        <span>${new Date(r.createdAt).toLocaleString("nl-NL")}</span>
        <span>${statusLabel(r.status)}</span>
      </div>
    `;
    li.addEventListener("click", () => selectRecording(r.id));
    listEl.appendChild(li);
  }
}

function statusLabel(status) {
  const base = (status || "").split(":")[0];
  const map = {
    uploading: "Uploaden…",
    transcribing: "Transcriberen…",
    transcribed: "Transcript klaar",
    generating: "Notulen maken…",
    done: "Klaar",
    error: "Fout",
  };
  return map[base] || status;
}

function isBusy(status) {
  const base = (status || "").split(":")[0];
  return ["uploading", "transcribing", "generating"].includes(base);
}

// ---------- Detailweergave ----------
const emptyState = document.getElementById("emptyState");
const detailEl = document.getElementById("detail");
const detailTitle = document.getElementById("detailTitle");
const statusBadge = document.getElementById("statusBadge");
const player = document.getElementById("player");
const deleteBtn = document.getElementById("deleteBtn");
const regenerateBtn = document.getElementById("regenerateBtn");
const copyMinutesBtn = document.getElementById("copyMinutesBtn");

async function selectRecording(id) {
  state.currentId = id;
  renderList();
  emptyState.classList.add("hidden");
  detailEl.classList.remove("hidden");
  document.getElementById("app").classList.add("mobile-detail");
  await loadDetail(id);
  clearInterval(state.pollTimer);
  state.pollTimer = setInterval(async () => {
    if (state.currentId !== id) return;
    const r = await loadDetail(id, { silent: true });
    if (r && !isBusy(r.status)) clearInterval(state.pollTimer);
  }, 2500);
}

let currentRecord = null;

async function loadDetail(id, { silent = false } = {}) {
  const res = await fetch(`/api/recordings/${id}`);
  if (res.status === 401) {
    showAuthScreen();
    return null;
  }
  if (!res.ok) return null;
  const record = await res.json();
  currentRecord = record;
  renderDetail(record);
  if (!silent) renderList();
  else updateListItemStatus(record);
  return record;
}

function updateListItemStatus(record) {
  const idx = state.recordings.findIndex((r) => r.id === record.id);
  if (idx >= 0) state.recordings[idx] = record;
  renderList();
}

function renderDetail(record) {
  if (document.activeElement !== detailTitle) {
    detailTitle.value = record.title;
  }
  const baseStatus = (record.status || "").split(":")[0];
  statusBadge.textContent = statusLabel(record.status);
  statusBadge.className = "status-badge " +
    (baseStatus === "done" ? "status-done" : baseStatus === "error" ? "status-error" : isBusy(record.status) ? "status-busy" : "");

  if (record.audioFile) {
    player.src = `/audio/${record.audioFile}`;
  }

  const minutesLangRegenSelect = document.getElementById("minutesLangRegenSelect");
  if (minutesLangRegenSelect && document.activeElement !== minutesLangRegenSelect) {
    minutesLangRegenSelect.value = record.minutesLanguage || "auto";
  }

  renderSpeakerEditor(record);
  renderTranscript(record);
  renderMinutes(record);
  renderMindmap(record);

  if (record.status === "error" && record.error) {
    statusBadge.title = record.error;
  }
}

detailTitle.addEventListener("change", async () => {
  if (!currentRecord) return;
  await fetch(`/api/recordings/${currentRecord.id}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ title: detailTitle.value }),
  });
  refreshList();
});

deleteBtn.addEventListener("click", async () => {
  if (!currentRecord) return;
  if (!confirm(`Opname "${currentRecord.title}" verwijderen?`)) return;
  await fetch(`/api/recordings/${currentRecord.id}`, { method: "DELETE" });
  currentRecord = null;
  state.currentId = null;
  detailEl.classList.add("hidden");
  emptyState.classList.remove("hidden");
  document.getElementById("app").classList.remove("mobile-detail");
  refreshList();
});

regenerateBtn.addEventListener("click", async () => {
  if (!currentRecord) return;
  const minutesLanguage = document.getElementById("minutesLangRegenSelect").value;
  await fetch(`/api/recordings/${currentRecord.id}/generate`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ minutesLanguage }),
  });
  loadDetail(currentRecord.id);
  clearInterval(state.pollTimer);
  state.pollTimer = setInterval(async () => {
    const r = await loadDetail(currentRecord.id, { silent: true });
    if (r && !isBusy(r.status)) clearInterval(state.pollTimer);
  }, 2500);
});

copyMinutesBtn.addEventListener("click", async () => {
  if (!currentRecord || !currentRecord.minutes) return;
  await navigator.clipboard.writeText(currentRecord.minutes);
  copyMinutesBtn.textContent = "✅ Gekopieerd";
  setTimeout(() => (copyMinutesBtn.textContent = "📋 Kopiëren"), 1500);
});

document.getElementById("exportDocxBtn").addEventListener("click", () => {
  if (!currentRecord || !currentRecord.minutes) return;
  window.location.href = `/api/recordings/${currentRecord.id}/export/docx`;
});

document.getElementById("exportPdfBtn").addEventListener("click", () => {
  if (!currentRecord || !currentRecord.minutes) return;
  window.location.href = `/api/recordings/${currentRecord.id}/export/pdf`;
});

document.getElementById("downloadMindmapBtn").addEventListener("click", () => {
  const svg = document.querySelector("#mindmapView svg");
  if (!svg) return;
  const source = new XMLSerializer().serializeToString(svg);
  const blob = new Blob([source], { type: "image/svg+xml" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${(currentRecord?.title || "mindmap").replace(/[^\w-]+/g, "_")}.svg`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
});

// ---------- Tabs ----------
document.querySelectorAll(".tab-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
    document.querySelectorAll(".tab-panel").forEach((p) => p.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById(`tab-${btn.dataset.tab}`).classList.add("active");
  });
});

// ---------- Sprekers hernoemen ----------
function renderSpeakerEditor(record) {
  const el = document.getElementById("speakerEditor");
  el.innerHTML = "";
  if (!record.transcript) return;
  const speakers = Object.keys(record.speakerNames || {});
  for (const key of speakers) {
    const chip = document.createElement("div");
    chip.className = "speaker-chip";
    chip.innerHTML = `<span>🗣️</span>`;
    const input = document.createElement("input");
    input.value = record.speakerNames[key];
    input.dataset.speakerKey = key;
    let debounceTimer;
    input.addEventListener("input", () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => saveSpeakerName(record.id, key, input.value), 600);
    });
    chip.appendChild(input);
    el.appendChild(chip);
  }
}

async function saveSpeakerName(id, key, value) {
  const record = currentRecord;
  if (!record) return;
  const speakerNames = { ...record.speakerNames, [key]: value };
  const res = await fetch(`/api/recordings/${id}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ speakerNames }),
  });
  currentRecord = await res.json();
  renderTranscript(currentRecord);
}

// ---------- Transcript ----------
function renderTranscript(record) {
  const el = document.getElementById("transcriptView");
  if (!record.transcript) {
    el.innerHTML = `<div class="placeholder">Nog geen transcript. Status: ${statusLabel(record.status)}</div>`;
    return;
  }
  el.innerHTML = "";
  for (const u of record.transcript.utterances) {
    const row = document.createElement("div");
    row.className = "utterance";
    const name = (record.speakerNames && record.speakerNames[u.speaker]) || `Spreker ${u.speaker}`;
    row.innerHTML = `
      <div class="u-time">${formatTime(u.start)}</div>
      <div class="speaker-name">${escapeHtml(name)}</div>
      <div class="u-text">${escapeHtml(u.text)}</div>
    `;
    el.appendChild(row);
  }
}

function formatTime(ms) {
  const totalSec = Math.floor((ms || 0) / 1000);
  const m = String(Math.floor(totalSec / 60)).padStart(2, "0");
  const s = String(totalSec % 60).padStart(2, "0");
  return `${m}:${s}`;
}

// ---------- Notulen (eenvoudige markdown-weergave) ----------
function renderMinutes(record) {
  const el = document.getElementById("minutesView");
  if (!record.minutes) {
    el.innerHTML = `<div class="placeholder">Nog geen notulen. Status: ${statusLabel(record.status)}</div>`;
    return;
  }
  el.innerHTML = simpleMarkdownToHtml(record.minutes);
}

function simpleMarkdownToHtml(md) {
  const lines = md.split("\n");
  let html = "";
  let inList = false;
  for (let line of lines) {
    line = line.trim();
    if (!line) {
      if (inList) { html += "</ul>"; inList = false; }
      continue;
    }
    if (line.startsWith("# ")) {
      closeList();
      html += `<h1>${inline(line.slice(2))}</h1>`;
    } else if (line.startsWith("## ")) {
      closeList();
      html += `<h2>${inline(line.slice(3))}</h2>`;
    } else if (line.startsWith("### ")) {
      closeList();
      html += `<h3>${inline(line.slice(4))}</h3>`;
    } else if (/^[-*]\s*\[[ xX]\]\s+/.test(line)) {
      if (!inList) { html += "<ul>"; inList = true; }
      const checked = /\[[xX]\]/.test(line);
      const text = line.replace(/^[-*]\s*\[[ xX]\]\s+/, "");
      html += `<li><input type="checkbox" disabled ${checked ? "checked" : ""}/> ${inline(text)}</li>`;
    } else if (/^[-*]\s+/.test(line)) {
      if (!inList) { html += "<ul>"; inList = true; }
      html += `<li>${inline(line.replace(/^[-*]\s+/, ""))}</li>`;
    } else {
      closeList();
      html += `<p>${inline(line)}</p>`;
    }
  }
  closeList();
  return html;

  function closeList() {
    if (inList) { html += "</ul>"; inList = false; }
  }
  function inline(text) {
    return escapeHtml(text)
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/\*(.+?)\*/g, "<em>$1</em>");
  }
}

// ---------- Mindmap (radiale SVG-weergave) ----------
function renderMindmap(record) {
  const el = document.getElementById("mindmapView");
  if (!record.mindmap) {
    el.innerHTML = `<div class="placeholder">Nog geen mindmap. Status: ${statusLabel(record.status)}</div>`;
    return;
  }
  el.innerHTML = "";
  const svg = buildMindmapSvg(record.mindmap);
  el.appendChild(svg);
}

function buildMindmapSvg(root) {
  const width = 900;
  const height = 640;
  const cx = width / 2;
  const cy = height / 2;

  const svgNS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(svgNS, "svg");
  svg.setAttribute("width", width);
  svg.setAttribute("height", height);
  svg.setAttribute("viewBox", `0 0 ${width}
