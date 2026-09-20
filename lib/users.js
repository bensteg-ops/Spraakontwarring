import { promises as fs } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { nanoid } from "nanoid";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "..", "data");
const FILE = path.join(DATA_DIR, "users.json");

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
    return { users: [] };
  }
}

async function writeAll(data) {
  await fs.writeFile(FILE, JSON.stringify(data, null, 2));
}

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

export async function findUserByEmail(email) {
  const data = await readAll();
  const normalized = normalizeEmail(email);
  return data.users.find((u) => u.email === normalized) || null;
}

export async function findUserById(id) {
  const data = await readAll();
  return data.users.find((u) => u.id === id) || null;
}

export async function createUser(email, passwordHash, name) {
  return withLock(async () => {
    const data = await readAll();
    const normalized = normalizeEmail(email);
    if (data.users.some((u) => u.email === normalized)) {
      throw new Error("Er bestaat al een account met dit e-mailadres.");
    }
    const user = {
      id: nanoid(12),
      email: normalized,
      name: (name || "").trim() || normalized.split("@")[0],
      passwordHash,
      createdAt: new Date().toISOString(),
    };
    data.users.push(user);
    await writeAll(data);
    return user;
  });
}
