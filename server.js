import "dotenv/config";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import multer from "multer";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";
import { promises as fs } from "fs";
import { nanoid } from "nanoid";

import {
  AUDIO_DIR,
  listRecordings,
  getRecording,
  createRecording,
  updateRecording,
  deleteRecording,
  updateRecordingInternal,
  getRecordingInternal,
} from "./lib/store.js";
import { uploadAudio, startTranscription, waitForTranscript } from "./lib/transcribe.js";
import { generateMinutes, generateMindmap } from "./lib/generate.js";
import { minutesToDocx, minutesToPdf } from "./lib/export.js";
import { ffmpegAvailable, decodeToPcm } from "./lib/audio.js";
import { embeddingFromSamples } from "./lib/voiceprint.js";
import {
  listProfiles,
  createProfile,
  deleteProfile,
  matchEmbedding,
} from "./lib/speakerProfiles.js";
import { findUserByEmail, findUserById, createUser } from "./lib/users.js";
import {
  hashPassword,
  verifyPassword,
  signToken,
  setAuthCookie,
  clearAuthCookie,
  requireAuth,
} from "./lib/auth.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;

await ensureSessionSecret();

const app = express();
app.use(cors());
app.use(cookieParser());
app.use(express.json({ limit: "2mb" }));
app.use(express.static(path.join(__dirname, "public")));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 1024 * 1024 * 1024 }, // 1 GB
});

app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    assemblyaiConfigured: Boolean(process.env.ASSEMBLYAI_API_KEY),
    anthropicConfigured: Boolean(process.env.ANTHROPIC_API_KEY),
    voiceProfilesAvailable: ffmpegAvailable(),
  });
});

// ---- Accounts ----

app.post("/api/auth/register", async (req, res, next) => {
  try {
    const email = String(req.body.email || "").trim();
    const password = String(req.body.password || "");
    const name = String(req.body.name || "").trim();

    if (!email || !email.includes("@")) {
      return res.status(400).json({ error: "Vul een geldig e-mailadres in." });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: "Wachtwoord moet minstens 8 tekens zijn." });
    }
    const existing = await findUserByEmail(email);
    if (existing) {
      return res.status(400).json({ error: "Er bestaat al een account met dit e-mailadres." });
    }
    const passwordHash = await hashPassword(password);
    const user = await createUser(email, passwordHash, name);
    const token = signToken(user);
    setAuthCookie(res, token);
    res.status(201).json({ id: user.id, email: user.email, name: user.name });
  } catch (err) {
    next(err);
  }
});

app.post("/api/auth/login", async (req, res, next) => {
  try {
    const email = String(req.body.email || "").trim();
    const password = String(req.body.password || "");
    const user = await findUserByEmail(email);
    if (!user) {
      return res.status(401).json({ error: "E-mailadres of wachtwoord is onjuist." });
    }
    const ok = await verifyPassword(password, user.passwordHash);
    if (!ok) {
      return res.status(401).json({ error: "E-mailadres of wachtwoord is onjuist." });
    }
    const token = signToken(user);
    setAuthCookie(res, token);
    res.json({ id: user.id, email: user.email, name: user.name });
  } catch (err) {
    next(err);
  }
});

app.post("/api/auth/logout", (req, res) => {
  clearAuthCookie(res);
  res.json({ ok: true });
});

app.get("/api/auth/me", requireAuth, async (req, res, next) => {
  try {
    const user = await findUserById(req.userId);
    if (!user) return res.status(401).json({ error: "Niet ingelogd." });
    res.json({ id: user.id, email: user.email, name: user.name });
  } catch (err) {
    next(err);
  }
});

// Alles hieronder vereist een ingelogde gebruiker.
app.use("/api/recordings", requireAuth);
app.use("/api/speaker-profiles", requireAuth);
app.use("/audio", requireAuthForAudio, express.static(AUDIO_DIR));

app.get("/api/recordings", async (req, res, next) => {
  try {
    const recordings = await listRecordings(req.userId);
    res.json(recordings);
  } catch (err) {
    next(err);
  }
});

app.get("/api/recordings/:id", async (req, res, next) => {
  try {
    const recording = await getRecording(req.params.id, req.userId);
    if (!recording) return res.status(404).json({ error: "Opname niet gevonden" });
    res.json(recording);
  } catch (err) {
    next(err);
  }
});

app.post("/api/recordings", upload.single("audio"), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "Geen audiobestand ontvangen (veld 'audio')." });
    }
    const id = nanoid(12);
    const ext = guessExtension(req.file.mimetype, req.file.originalname);
    const fileName = `${id}${ext}`;
    await fs.mkdir(AUDIO_DIR, { recursive: true });
    await fs.writeFile(path.join(AUDIO_DIR, fileName), req.file.buffer);

    const title = (req.body.title && String(req.body.title).trim()) || defaultTitle();
    const language = req.body.language === "auto" ? null : req.body.language || "nl";

    const record = {
      id,
      userId: req.userId,
      title,
      createdAt: new Date().toISOString(),
      status: "uploading",
      audioFile: fileName,
      mimeType: req.file.mimetype,
      language,
      transcript: null,
      speakerNames: {},
      minutes: null,
      mindmap: null,
      error: null,
    };
    await createRecording(record);
    res.status(201).json(record);

    // Verwerking gebeurt op de achtergrond; de client pollt de status.
    processRecording(id, req.userId, req.file.buffer, language, fileName).catch((err) => {
      console.error(`Verwerking van opname ${id} mislukt:`, err);
      updateRecordingInternal(id, { status: "error", error: err.message }).catch(() => {});
    });
  } catch (err) {
    next(err);
  }
});

app.patch("/api/recordings/:id", async (req, res, next) => {
  try {
    const patch = {};
    if (typeof req.body.title === "string") patch.title = req.body.title;
    if (req.body.speakerNames && typeof req.body.speakerNames === "object") {
      patch.speakerNames = req.body.speakerNames;
    }
    const updated = await updateRecording(req.params.id, req.userId, patch);
    if (!updated) return res.status(404).json({ error: "Opname niet gevonden" });
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// Notulen en mindmap opnieuw genereren, bv. nadat sprekersnamen zijn aangepast.
app.post("/api/recordings/:id/generate", async (req, res, next) => {
  try {
    const recording = await getRecording(req.params.id, req.userId);
    if (!recording) return res.status(404).json({ error: "Opname niet gevonden" });
    if (!recording.transcript) {
      return res.status(400).json({ error: "Nog geen transcript beschikbaar voor deze opname." });
    }
    await updateRecording(recording.id, req.userId, { status: "generating", error: null });
    res.json({ ok: true, status: "generating" });

    runGeneration(recording.id).catch((err) => {
      console.error(`Genereren voor opname ${recording.id} mislukt:`, err);
      updateRecordingInternal(recording.id, { status: "error", error: err.message }).catch(() => {});
    });
  } catch (err) {
    next(err);
  }
});

app.delete("/api/recordings/:id", async (req, res, next) => {
  try {
    const ok = await deleteRecording(req.params.id, req.userId);
    if (!ok) return res.status(404).json({ error: "Opname niet gevonden" });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// ---- Notulen exporteren ----

app.get("/api/recordings/:id/export/docx", async (req, res, next) => {
  try {
    const recording = await getRecording(req.params.id, req.userId);
    if (!recording) return res.status(404).json({ error: "Opname niet gevonden" });
    if (!recording.minutes) return res.status(400).json({ error: "Nog geen notulen beschikbaar." });
    const buffer = await minutesToDocx(recording.minutes, recording.title);
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    );
    res.setHeader("Content-Disposition", `attachment; filename="${sanitizeFilename(recording.title)}.docx"`);
    res.send(buffer);
  } catch (err) {
    next(err);
  }
});

app.get("/api/recordings/:id/export/pdf", async (req, res, next) => {
  try {
    const recording = await getRecording(req.params.id, req.userId);
    if (!recording) return res.status(404).json({ error: "Opname niet gevonden" });
    if (!recording.minutes) return res.status(400).json({ error: "Nog geen notulen beschikbaar." });
    const buffer = await minutesToPdf(recording.minutes, recording.title);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${sanitizeFilename(recording.title)}.pdf"`);
    res.send(buffer);
  } catch (err) {
    next(err);
  }
});

// ---- Stemprofielen ----

app.get("/api/speaker-profiles", async (req, res, next) => {
  try {
    const profiles = await listProfiles(req.userId);
    res.json({
      ffmpegAvailable: ffmpegAvailable(),
      profiles: profiles.map((p) => ({ id: p.id, name: p.name, createdAt: p.createdAt })),
    });
  } catch (err) {
    next(err);
  }
});

app.post("/api/speaker-profiles", upload.single("audio"), async (req, res, next) => {
  try {
    if (!ffmpegAvailable()) {
      return res.status(400).json({
        error: "ffmpeg is niet geïnstalleerd op deze server; stemprofielen zijn niet beschikbaar.",
      });
    }
    if (!req.file) {
      return res.status(400).json({ error: "Geen audiofragment ontvangen (veld 'audio')." });
    }
    const name = (req.body.name || "").trim();
    if (!name) {
      return res.status(400).json({ error: "Geef een naam op voor dit stemprofiel." });
    }
    const { samples } = await decodeToPcm({ buffer: req.file.buffer });
    const embedding = embeddingFromSamples(samples);
    const profile = await createProfile(req.userId, name, embedding);
    res.status(201).json({ id: profile.id, name: profile.name, createdAt: profile.createdAt });
  } catch (err) {
    next(err);
  }
});

app.delete("/api/speaker-profiles/:id", async (req, res, next) => {
  try {
    const ok = await deleteProfile(req.params.id, req.userId);
    if (!ok) return res.status(404).json({ error: "Profiel niet gevonden" });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: err.message || "Onbekende serverfout" });
});

app.listen(PORT, () => {
  console.log(`Spraakontwarring draait op http://localhost:${PORT}`);
  if (!process.env.ASSEMBLYAI_API_KEY) {
    console.warn("Let op: ASSEMBLYAI_API_KEY is niet ingesteld (nodig voor transcriptie).");
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    console.warn("Let op: ANTHROPIC_API_KEY is niet ingesteld (nodig voor notulen/mindmap).");
  }
});

// ---- Toegang tot audiobestanden ----
// /audio/<bestandsnaam> staat los van /api/recordings, dus hier checken we
// zelf dat de ingelogde gebruiker ook echt de eigenaar is van de opname die
// bij dit bestand hoort, voordat express.static het bestand serveert.
async function requireAuthForAudio(req, res, next) {
  requireAuth(req, res, async (err) => {
    if (err) return next(err);
    try {
      const fileName = decodeURIComponent(req.path.replace(/^\/+/, ""));
      const recordings = await listRecordings(req.userId);
      const owns = recordings.some((r) => r.audioFile === fileName);
      if (!owns) return res.status(404).end();
      next();
    } catch (e) {
      next(e);
    }
  });
}

// ---- Opstarten ----

async function ensureSessionSecret() {
  if (process.env.SESSION_SECRET) return;
  const secret = crypto.randomBytes(48).toString("hex");
  process.env.SESSION_SECRET = secret;
  const envPath = path.join(__dirname, ".env");
  try {
    let contents = "";
    try {
      contents = await fs.readFile(envPath, "utf-8");
    } catch {
      // .env bestaat nog niet; dat is prima, we maken het aan.
    }
    const lineRegex = /^SESSION_SECRET=.*$/m;
    if (lineRegex.test(contents)) {
      // Regel bestaat al (mogelijk leeg) — vul 'm met de nieuwe waarde.
      contents = contents.replace(lineRegex, `SESSION_SECRET=${secret}`);
    } else {
      contents += `${contents.endsWith("\n") || !contents ? "" : "\n"}SESSION_SECRET=${secret}\n`;
    }
    await fs.writeFile(envPath, contents);
    console.warn("Geen SESSION_SECRET gevonden; er is automatisch een nieuwe aangemaakt en opgeslagen in .env.");
  } catch {
    console.warn(
      "Geen SESSION_SECRET gevonden en kon deze niet opslaan in .env; iedereen wordt uitgelogd bij een herstart van de server."
    );
  }
}

// ---- Achtergrondverwerking ----

async function processRecording(id, userId, buffer, language, fileName) {
  await updateRecordingInternal(id, { status: "uploading" });
  const uploadUrl = await uploadAudio(buffer);

  await updateRecordingInternal(id, { status: "transcribing" });
  const transcriptId = await startTranscription(uploadUrl, { language });
  const transcript = await waitForTranscript(transcriptId, {
    onProgress: (status) => {
      updateRecordingInternal(id, { status: `transcribing:${status}` }).catch(() => {});
    },
  });

  const utterances = (transcript.utterances || []).map((u) => ({
    speaker: u.speaker,
    text: u.text,
    start: u.start,
    end: u.end,
  }));

  const speakers = [...new Set(utterances.map((u) => u.speaker))];
  const speakerNames = Object.fromEntries(speakers.map((s) => [s, `Spreker ${s}`]));

  await tryAutoRecognizeSpeakers(userId, fileName, utterances, speakers, speakerNames);

  await updateRecordingInternal(id, {
    status: "transcribed",
    transcript: {
      text: transcript.text,
      utterances,
      languageCode: transcript.language_code,
      audioDurationSec: transcript.audio_duration,
    },
    speakerNames,
  });

  await runGeneration(id);
}

async function runGeneration(id) {
  const recording = await getRecordingInternal(id);
  if (!recording || !recording.transcript) return;

  await updateRecordingInternal(id, { status: "generating" });

  const [minutes, mindmap] = await Promise.all([
    generateMinutes(recording.transcript.utterances, recording.speakerNames, recording.title),
    generateMindmap(recording.transcript.utterances, recording.speakerNames, recording.title),
  ]);

  await updateRecordingInternal(id, { status: "done", minutes, mindmap, error: null });
}

// Probeert sprekers automatisch een naam te geven op basis van eerder
// opgeslagen stemprofielen van dezelfde gebruiker. Werkt alleen als ffmpeg
// beschikbaar is en er al minstens één profiel is aangemaakt; faalt stil
// (blijft "Spreker A" etc.) als er te weinig bruikbare audio is of niets
// matcht.
async function tryAutoRecognizeSpeakers(userId, fileName, utterances, speakers, speakerNames) {
  if (!fileName || !ffmpegAvailable()) return;
  try {
    const profiles = await listProfiles(userId);
    if (profiles.length === 0) return;
    const audioPath = path.join(AUDIO_DIR, fileName);

    for (const key of speakers) {
      try {
        const speakerUtterances = utterances.filter((u) => u.speaker === key);
        const embedding = await computeSpeakerEmbeddingFromFile(audioPath, speakerUtterances);
        const match = matchEmbedding(embedding, profiles);
        if (match) {
          speakerNames[key] = match.profile.name;
        }
      } catch (err) {
        console.warn(`Kon spreker ${key} niet automatisch herkennen: ${err.message}`);
      }
    }
  } catch (err) {
    console.warn("Automatische sprekerherkenning overgeslagen:", err.message);
  }
}

// Bouwt een stem-embedding voor één spreker door tot ~20 seconden van diens
// langste spreekfragmenten uit het opnamebestand te knippen en samen te voegen.
async function computeSpeakerEmbeddingFromFile(audioPath, speakerUtterances) {
  const sorted = [...speakerUtterances].sort((a, b) => (b.end - b.start) - (a.end - a.start));
  const picks = [];
  let totalMs = 0;
  for (const u of sorted) {
    if (totalMs >= 20000) break;
    picks.push(u);
    totalMs += u.end - u.start;
  }
  if (picks.length === 0) {
    throw new Error("geen spreekfragmenten gevonden");
  }

  const segments = [];
  for (const u of picks) {
    const { samples } = await decodeToPcm({
      filePath: audioPath,
      startSec: u.start / 1000,
      durationSec: Math.max(0.3, (u.end - u.start) / 1000),
    });
    segments.push(samples);
  }

  const totalLength = segments.reduce((n, s) => n + s.length, 0);
  const merged = new Float32Array(totalLength);
  let offset = 0;
  for (const s of segments) {
    merged.set(s, offset);
    offset += s.length;
  }

  return embeddingFromSamples(merged);
}

function sanitizeFilename(name) {
  return (name || "notulen")
    .normalize("NFKD")
    .replace(/[^\w\-.\s]/g, "")
    .trim()
    .replace(/\s+/g, "_")
    .slice(0, 100) || "notulen";
}

function guessExtension(mimetype, originalName) {
  const fromName = path.extname(originalName || "");
  if (fromName) return fromName;
  const map = {
    "audio/webm": ".webm",
    "audio/ogg": ".ogg",
    "audio/mpeg": ".mp3",
    "audio/mp4": ".m4a",
    "audio/wav": ".wav",
    "audio/x-wav": ".wav",
  };
  return map[mimetype] || ".webm";
}

function defaultTitle() {
  const now = new Date();
  const d = now.toLocaleDateString("nl-NL");
  const t = now.toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" });
  return `Vergadering ${d} ${t}`;
}
