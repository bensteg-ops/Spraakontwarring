import { promises as fs } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { nanoid } from "nanoid";
import { cosineSimilarity } from "./voiceprint.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "..", "data");
const FILE = path.join(DATA_DIR, "speakers.json");

let queue = Promise.resolve();
function withLock(fn) {
  const result = queue.then(() => fn());
  queue = result.then(
    () => {},
    () => {}
  );
  return result;
}

async function readAll() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    const raw = await fs.readFile(FILE, "utf-8");
    return JSON.parse(raw);
  } catch {
    return { profiles: [] };
  }
}

async function writeAll(data) {
  await fs.writeFile(FILE, JSON.stringify(data, null, 2));
}

export async function listProfiles(userId) {
  const data = await readAll();
  return data.profiles.filter((p) => p.userId === userId);
}

export async function createProfile(userId, name, embedding) {
  return withLock(async () => {
    const data = await readAll();
    const profile = {
      id: nanoid(10),
      userId,
      name,
      embedding,
      createdAt: new Date().toISOString(),
    };
    data.profiles.push(profile);
    await writeAll(data);
    return profile;
  });
}

export async function deleteProfile(id, userId) {
  return withLock(async () => {
    const data = await readAll();
    const idx = data.profiles.findIndex((p) => p.id === id && p.userId === userId);
    if (idx === -1) return false;
    data.profiles.splice(idx, 1);
    await writeAll(data);
    return true;
  });
}

/**
 * Vindt het best passende opgeslagen stemprofiel voor een gegeven embedding.
 * Geeft null terug als niets boven de drempelwaarde scoort.
 */
export function matchEmbedding(embedding, profiles, threshold = 0.86) {
  let best = null;
  for (const profile of profiles) {
    const score = cosineSimilarity(embedding, profile.embedding);
    if (score >= threshold && (!best || score > best.score)) {
      best = { profile, score };
    }
  }
  return best;
}
