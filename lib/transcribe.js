const BASE_URL = "https://api.assemblyai.com";

function headers() {
  const key = process.env.ASSEMBLYAI_API_KEY;
  if (!key) {
    throw new Error(
      "ASSEMBLYAI_API_KEY ontbreekt. Zet je sleutel in het .env-bestand."
    );
  }
  return { authorization: key };
}

/**
 * Upload een lokaal audiobestand naar AssemblyAI en geef de upload_url terug.
 */
export async function uploadAudio(buffer) {
  const res = await fetch(`${BASE_URL}/v2/upload`, {
    method: "POST",
    headers: headers(),
    body: buffer,
  });
  if (!res.ok) {
    throw new Error(`Upload naar AssemblyAI mislukt (${res.status}): ${await res.text()}`);
  }
  const json = await res.json();
  return json.upload_url;
}

/**
 * Start een transcriptiejob met sprekerherkenning.
 * language: "nl" voor Nederlands, of laat leeg voor automatische taaldetectie.
 */
export async function startTranscription(audioUrl, { language = "nl" } = {}) {
  const body = {
    audio_url: audioUrl,
    speaker_labels: true,
  };
  if (language) {
    body.language_code = language;
  } else {
    body.language_detection = true;
  }

  const res = await fetch(`${BASE_URL}/v2/transcript`, {
    method: "POST",
    headers: { ...headers(), "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`Starten van transcriptie mislukt (${res.status}): ${await res.text()}`);
  }
  const json = await res.json();
  return json.id;
}

export async function getTranscript(transcriptId) {
  const res = await fetch(`${BASE_URL}/v2/transcript/${transcriptId}`, {
    headers: headers(),
  });
  if (!res.ok) {
    throw new Error(`Ophalen van transcript mislukt (${res.status}): ${await res.text()}`);
  }
  return res.json();
}

/**
 * Poll de transcriptie tot deze klaar of mislukt is.
 * onProgress(status) wordt aangeroepen bij elke poll-stap.
 */
export async function waitForTranscript(transcriptId, { onProgress, intervalMs = 3000, timeoutMs = 30 * 60 * 1000 } = {}) {
  const start = Date.now();
  while (true) {
    const transcript = await getTranscript(transcriptId);
    if (onProgress) onProgress(transcript.status);
    if (transcript.status === "completed") return transcript;
    if (transcript.status === "error") {
      throw new Error(`Transcriptie mislukt: ${transcript.error}`);
    }
    if (Date.now() - start > timeoutMs) {
      throw new Error("Transcriptie duurde te lang (time-out).");
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
}
