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
  refreshList();
});

regenerateBtn.addEventListener("click", async () => {
  if (!currentRecord) return;
  await fetch(`/api/recordings/${currentRecord.id}/generate`, { method: "POST" });
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
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);

  const colors = ["#5b5bf0", "#e07a3f", "#2fa06f", "#c94f7c", "#3f9fc9", "#a05bcf"];

  const nodes = [];
  const edges = [];

  nodes.push({ x: cx, y: cy, label: root.title || "Vergadering", level: 0, color: "#1d1d2b" });

  const children = root.children || [];
  const n = Math.max(children.length, 1);
  const r1 = 190;
  children.forEach((child, i) => {
    const angle = (2 * Math.PI * i) / n - Math.PI / 2;
    const x = cx + r1 * Math.cos(angle);
    const y = cy + r1 * Math.sin(angle);
    const color = colors[i % colors.length];
    nodes.push({ x, y, label: child.title, level: 1, color });
    edges.push({ x1: cx, y1: cy, x2: x, y2: y, color });

    const grandchildren = child.children || [];
    const spread = Math.PI / 3.2;
    const m = grandchildren.length;
    grandchildren.forEach((gc, j) => {
      const offset = m > 1 ? -spread / 2 + (spread * j) / (m - 1) : 0;
      const gAngle = angle + offset;
      const r2 = r1 + 130;
      const gx = cx + r2 * Math.cos(gAngle);
      const gy = cy + r2 * Math.sin(gAngle);
      nodes.push({ x: gx, y: gy, label: gc.title, level: 2, color });
      edges.push({ x1: x, y1: y, x2: gx, y2: gy, color });
    });
  });

  for (const e of edges) {
    const line = document.createElementNS(svgNS, "line");
    line.setAttribute("x1", e.x1);
    line.setAttribute("y1", e.y1);
    line.setAttribute("x2", e.x2);
    line.setAttribute("y2", e.y2);
    line.setAttribute("stroke", e.color);
    line.setAttribute("stroke-width", "1.5");
    line.setAttribute("opacity", "0.5");
    svg.appendChild(line);
  }

  for (const node of nodes) {
    const g = document.createElementNS(svgNS, "g");
    g.setAttribute("class", "mindmap-node");

    const paddingX = node.level === 0 ? 16 : 10;
    const fontSize = node.level === 0 ? 15 : node.level === 1 ? 13 : 11.5;
    const textWidth = Math.min(160, Math.max(40, node.label.length * fontSize * 0.55));
    const boxW = textWidth + paddingX * 2;
    const boxH = node.level === 0 ? 40 : 28;

    const rect = document.createElementNS(svgNS, "rect");
    rect.setAttribute("x", node.x - boxW / 2);
    rect.setAttribute("y", node.y - boxH / 2);
    rect.setAttribute("width", boxW);
    rect.setAttribute("height", boxH);
    rect.setAttribute("rx", boxH / 2);
    rect.setAttribute("fill", node.level === 0 ? node.color : "white");
    rect.setAttribute("stroke", node.color);
    rect.setAttribute("stroke-width", node.level === 0 ? "0" : "1.5");
    g.appendChild(rect);

    const text = document.createElementNS(svgNS, "text");
    text.setAttribute("x", node.x);
    text.setAttribute("y", node.y + 4);
    text.setAttribute("text-anchor", "middle");
    text.setAttribute("font-size", fontSize);
    text.setAttribute("font-weight", node.level === 0 ? "700" : node.level === 1 ? "600" : "400");
    text.setAttribute("fill", node.level === 0 ? "white" : "#1d1d2b");
    text.textContent = truncate(node.label, node.level === 0 ? 30 : 26);
    g.appendChild(text);

    svg.appendChild(g);
  }

  return svg;
}

function truncate(str, max) {
  if (!str) return "";
  return str.length > max ? str.slice(0, max - 1) + "…" : str;
}

function escapeHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ---------- Stemprofielen ----------
let profileFfmpegAvailable = true;
let profileMediaRecorder = null;
let profileChunks = [];

const profileList = document.getElementById("profileList");
const profilesHint = document.getElementById("profilesHint");
const profileNameInput = document.getElementById("profileNameInput");
const profileRecordBtn = document.getElementById("profileRecordBtn");
const profileFileInput = document.getElementById("profileFileInput");
const profileRecordStatus = document.getElementById("profileRecordStatus");

async function loadProfiles() {
  try {
    const res = await fetch("/api/speaker-profiles");
    if (res.status === 401) return showAuthScreen();
    const data = await res.json();
    profileFfmpegAvailable = data.ffmpegAvailable;
    renderProfiles(data.profiles);
    if (!profileFfmpegAvailable) {
      profilesHint.textContent = "ffmpeg ontbreekt op de server";
      profileRecordBtn.disabled = true;
      profileFileInput.disabled = true;
    } else {
      profilesHint.textContent = "";
    }
  } catch (err) {
    profilesHint.textContent = "Kon profielen niet laden";
  }
}

function renderProfiles(profiles) {
  profileList.innerHTML = "";
  if (!profiles.length) {
    const li = document.createElement("li");
    li.className = "p-empty";
    li.textContent = "Nog geen stemprofielen. Neem een stem van ~15 sec op om iemand automatisch te laten herkennen.";
    li.style.border = "none";
    li.style.background = "transparent";
    profileList.appendChild(li);
    return;
  }
  for (const p of profiles) {
    const li = document.createElement("li");
    const span = document.createElement("span");
    span.textContent = p.name;
    const del = document.createElement("button");
    del.className = "p-delete";
    del.textContent = "✕";
    del.title = "Profiel verwijderen";
    del.addEventListener("click", () => deleteProfile(p.id));
    li.appendChild(span);
    li.appendChild(del);
    profileList.appendChild(li);
  }
}

async function deleteProfile(id) {
  await fetch(`/api/speaker-profiles/${id}`, { method: "DELETE" });
  loadProfiles();
}

profileRecordBtn.addEventListener("click", async () => {
  if (!profileFfmpegAvailable) return;
  if (profileMediaRecorder && profileMediaRecorder.state === "recording") {
    profileMediaRecorder.stop();
    return;
  }
  const name = profileNameInput.value.trim();
  if (!name) {
    alert("Vul eerst een naam in voor deze spreker.");
    return;
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    profileChunks = [];
    profileMediaRecorder = new MediaRecorder(stream);
    profileMediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) profileChunks.push(e.data);
    };
    profileMediaRecorder.onstop = async () => {
      stream.getTracks().forEach((t) => t.stop());
      profileRecordBtn.classList.remove("recording");
      profileRecordBtn.textContent = "🎙️ Opnemen";
      profileRecordStatus.textContent = "Verwerken…";
      const blob = new Blob(profileChunks, { type: "audio/webm" });
      await uploadProfile(name, blob, "stemprofiel.webm");
    };
    profileMediaRecorder.start();
    profileRecordBtn.classList.add("recording");
    profileRecordBtn.textContent = "⏹ Stop";
    profileRecordStatus.textContent = "Aan het opnemen — laat de persoon ~15-20 sec spreken, klik dan op stop.";
  } catch (err) {
    alert("Kon microfoon niet gebruiken: " + err.message);
  }
});

profileFileInput.addEventListener("change", async () => {
  const file = profileFileInput.files[0];
  if (!file) return;
  const name = profileNameInput.value.trim();
  if (!name) {
    alert("Vul eerst een naam in voor deze spreker.");
    profileFileInput.value = "";
    return;
  }
  profileRecordStatus.textContent = "Verwerken…";
  await uploadProfile(name, file, file.name);
  profileFileInput.value = "";
});

async function uploadProfile(name, blob, filename) {
  const form = new FormData();
  form.append("audio", blob, filename);
  form.append("name", name);
  try {
    const res = await fetch("/api/speaker-profiles", { method: "POST", body: form });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Opslaan van stemprofiel mislukt");
    profileNameInput.value = "";
    profileRecordStatus.textContent = `Stemprofiel "${data.name}" opgeslagen.`;
    setTimeout(() => (profileRecordStatus.textContent = ""), 3000);
    loadProfiles();
  } catch (err) {
    profileRecordStatus.textContent = "";
    alert("Kon stemprofiel niet opslaan: " + err.message);
  }
}

// ---------- Inloggen / registreren ----------
const authScreen = document.getElementById("authScreen");
const appEl = document.getElementById("app");
const authTabLogin = document.getElementById("authTabLogin");
const authTabRegister = document.getElementById("authTabRegister");
const loginForm = document.getElementById("loginForm");
const registerForm = document.getElementById("registerForm");
const authError = document.getElementById("authError");
const userNameLabel = document.getElementById("userNameLabel");
const logoutBtn = document.getElementById("logoutBtn");

authTabLogin.addEventListener("click", () => switchAuthTab("login"));
authTabRegister.addEventListener("click", () => switchAuthTab("register"));

function switchAuthTab(tab) {
  authError.textContent = "";
  const isLogin = tab === "login";
  authTabLogin.classList.toggle("active", isLogin);
  authTabRegister.classList.toggle("active", !isLogin);
  loginForm.classList.toggle("hidden", !isLogin);
  registerForm.classList.toggle("hidden", isLogin);
}

loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  authError.textContent = "";
  const email = document.getElementById("loginEmail").value.trim();
  const password = document.getElementById("loginPassword").value;
  try {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Inloggen mislukt");
    onAuthenticated(data);
  } catch (err) {
    authError.textContent = err.message;
  }
});

registerForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  authError.textContent = "";
  const name = document.getElementById("registerName").value.trim();
  const email = document.getElementById("registerEmail").value.trim();
  const password = document.getElementById("registerPassword").value;
  try {
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name, email, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Account aanmaken mislukt");
    onAuthenticated(data);
  } catch (err) {
    authError.textContent = err.message;
  }
});

logoutBtn.addEventListener("click", async () => {
  await fetch("/api/auth/logout", { method: "POST" });
  clearInterval(state.pollTimer);
  state.currentId = null;
  currentRecord = null;
  showAuthScreen();
});

function onAuthenticated(user) {
  userNameLabel.textContent = user.name || user.email;
  authScreen.classList.add("hidden");
  appEl.classList.remove("hidden");
  refreshList();
  loadProfiles();
}

function showAuthScreen() {
  appEl.classList.add("hidden");
  authScreen.classList.remove("hidden");
  loginForm.reset();
  registerForm.reset();
  switchAuthTab("login");
}

// ---------- Init ----------
(async function init() {
  try {
    const res = await fetch("/api/auth/me");
    if (res.ok) {
      const user = await res.json();
      onAuthenticated(user);
    } else {
      showAuthScreen();
    }
  } catch {
    showAuthScreen();
  }
})();
