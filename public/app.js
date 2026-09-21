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
