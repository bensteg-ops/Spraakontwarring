import { spawn, spawnSync } from "child_process";

let cachedAvailable = null;

/**
 * Controleert (met caching) of ffmpeg op deze server geïnstalleerd is.
 * ffmpeg is alleen nodig voor stemprofielen/-herkenning, niet voor de
 * basisfunctionaliteit van de app.
 */
export function ffmpegAvailable() {
  if (cachedAvailable !== null) return cachedAvailable;
  try {
    const result = spawnSync("ffmpeg", ["-version"]);
    cachedAvailable = result.status === 0;
  } catch {
    cachedAvailable = false;
  }
  return cachedAvailable;
}

/**
 * Decodeert (een fragment van) een audiobestand of -buffer naar mono PCM
 * op 16kHz, als Float32-samples tussen -1 en 1.
 *
 * Opties: filePath OF buffer (één van beide), startSec, durationSec.
 */
export function decodeToPcm({ filePath, buffer, startSec, durationSec, sampleRate = 16000 } = {}) {
  return new Promise((resolve, reject) => {
    if (!filePath && !buffer) {
      return reject(new Error("decodeToPcm heeft filePath of buffer nodig"));
    }
    const args = ["-y", "-i", buffer ? "pipe:0" : filePath];
    if (startSec != null) args.push("-ss", String(Math.max(0, startSec)));
    if (durationSec != null) args.push("-t", String(Math.max(0.1, durationSec)));
    args.push("-ac", "1", "-ar", String(sampleRate), "-f", "s16le", "pipe:1");

    const proc = spawn("ffmpeg", args);
    const chunks = [];
    let stderr = "";
    proc.stdout.on("data", (d) => chunks.push(d));
    proc.stderr.on("data", (d) => (stderr += d));
    proc.on("error", (err) => reject(new Error(`ffmpeg kon niet gestart worden: ${err.message}`)));
    proc.on("close", () => {
      const out = Buffer.concat(chunks);
      if (out.length === 0) {
        return reject(new Error("ffmpeg leverde geen audiodata op: " + stderr.slice(-500)));
      }
      const samples = new Float32Array(Math.floor(out.length / 2));
      for (let i = 0; i < samples.length; i++) {
        samples[i] = out.readInt16LE(i * 2) / 32768;
      }
      resolve({ samples, sampleRate });
    });

    if (buffer) {
      proc.stdin.write(buffer);
      proc.stdin.end();
    }
  });
}
