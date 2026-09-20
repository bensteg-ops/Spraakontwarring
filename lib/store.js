import { promises as fs } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "..", "data");
const DB_FILE = path.join(DATA_DIR, "db.json");
export const AUDIO_DIR = path.join(DATA_DIR, "audio");

let queue = Promise.resolve();

async function ensureDb() {
  await fs.mkdir(AUDIO_DIR, { recursive: true });
  try {
    await fs.access(DB_FILE);
  } catch {
    await fs.writeFile(DB_FILE, JSON.stringify({ recordings: {} }, null, 2));
  }
}

async function readDb() {
  await ensureDb();
  const raw = await fs.readFile(DB_FILE, "utf-8");
  return JSON.parse(raw);
}

async function writeDb(db) {
  await fs.writeFile(DB_FILE, JSON.stringify(db, null, 2));
}

// Alle schrijfacties lopen via deze queue zodat gelijktijdige updates
// elkaar niet overschrijven (het is maar 1 klein proces, dus dit volstaat).
function withLock(fn) {
  const result = queue.then(() => fn());
  queue = result.then(
    () => {},
    () => {}
  );
  return result;
}

// Alle functies hieronder nemen een userId en geven/wijzigen alleen opnames
// van die gebruiker, zodat ieders opnames privé blijven.

export async function listRecordings(userId) {
  const db = await readDb();
  return Object.values(db.recordings)
    .filter((r) => r.userId === userId)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

export async function getRecording(id, userId) {
  const db = await readDb();
  const record = db.recordings[id];
  if (!record) return null;
  if (userId && record.userId !== userId) return null;
  return record;
}

export async function createRecording(record) {
  return withLock(async () => {
    const db = await readDb();
    db.recordings[record.id] = record;
    await writeDb(db);
    return record;
  });
}

export async function updateRecording(id, userId, patch) {
  return withLock(async () => {
    const db = await readDb();
    const existing = db.recordings[id];
    if (!existing) return null;
    if (userId && existing.userId !== userId) return null;
    const updated = { ...existing, ...patch, updatedAt: new Date().toISOString() };
    db.recordings[id] = updated;
    await writeDb(db);
    return updated;
  });
}

export async function deleteRecording(id, userId) {
  return withLock(async () => {
    const db = await readDb();
    const existing = db.recordings[id];
    if (!existing) return false;
    if (userId && existing.userId !== userId) return false;
    delete db.recordings[id];
    await writeDb(db);
    if (existing.audioFile) {
      const p = path.join(AUDIO_DIR, existing.audioFile);
      await fs.unlink(p).catch(() => {});
    }
    return true;
  });
}

/**
 * Interne variant zonder eigenaarscontrole, alleen voor gebruik door de
 * achtergrondverwerking (die zelf al weet bij welke gebruiker de opname
 * hoort en het resultaat terugschrijft ongeacht wie er op dat moment
 * ingelogd is).
 */
export async function updateRecordingInternal(id, patch) {
  return withLock(async () => {
    const db = await readDb();
    const existing = db.recordings[id];
    if (!existing) return null;
    const updated = { ...existing, ...patch, updatedAt: new Date().toISOString() };
    db.recordings[id] = updated;
    await writeDb(db);
    return updated;
  });
}

export async function getRecordingInternal(id) {
  const db = await readDb();
  return db.recordings[id] || null;
}
