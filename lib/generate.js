const API_URL = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-sonnet-5";

function headers() {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    throw new Error(
      "ANTHROPIC_API_KEY ontbreekt. Zet je sleutel in het .env-bestand."
    );
  }
  return {
    "content-type": "application/json",
    "x-api-key": key,
    "anthropic-version": "2023-06-01",
  };
}

function transcriptToPlainText(utterances, speakerNames = {}) {
  return utterances
    .map((u) => `${speakerNames[u.speaker] || `Spreker ${u.speaker}`}: ${u.text}`)
    .join("\n");
}

async function callClaude(systemPrompt, userPrompt, maxTokens = 4000) {
  const res = await fetch(API_URL, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({
      model: MODEL,
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    }),
  });
  if (!res.ok) {
    throw new Error(`Claude API-fout (${res.status}): ${await res.text()}`);
  }
  const json = await res.json();
  const text = json.content?.map((c) => c.text || "").join("") || "";
  return text;
}

function extractJson(text) {
  // Claude antwoordt soms met ```json ... ``` eromheen; haal dat eruit.
  const match = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = match ? match[1] : text;
  return JSON.parse(raw.trim());
}

/**
 * Genereert Nederlandstalige notulen (markdown) uit een transcript.
 */
export async function generateMinutes(utterances, speakerNames, meetingTitle) {
  const transcriptText = transcriptToPlainText(utterances, speakerNames);
  const system =
    "Je bent een ervaren notulist. Je schrijft heldere, beknopte Nederlandse notulen " +
    "op basis van een ruwe, automatisch gegenereerde transcriptie van een vergadering. " +
    "De transcriptie kan spelfouten of foutief herkende woorden bevatten; interpreteer " +
    "zo goed mogelijk. Verzin geen informatie die niet in het transcript staat.";
  const user = `Titel van de vergadering: ${meetingTitle || "(geen titel)"}

Transcript:
"""
${transcriptText}
"""

Schrijf notulen in het Nederlands, in markdown, met deze structuur:
# ${meetingTitle || "Notulen"}
## Aanwezigen
(lijst van sprekers zoals genoemd in het transcript)
## Samenvatting
(kort, 3-6 zinnen)
## Besproken onderwerpen
(bulletpoints per onderwerp, met wie wat inbracht indien relevant)
## Besluiten
(bulletpoints, of "Geen expliciete besluiten genomen" als van toepassing)
## Actiepunten
(bulletpoints in de vorm "- [ ] Actie — wie — indien genoemd: deadline")

Geef alleen de markdown terug, zonder verdere uitleg.`;
  return callClaude(system, user, 3000);
}

/**
 * Genereert een mindmap-structuur (boom van onderwerpen) uit een transcript.
 * Resultaat: { title, children: [{ title, children: [...] }, ...] }
 */
export async function generateMindmap(utterances, speakerNames, meetingTitle) {
  const transcriptText = transcriptToPlainText(utterances, speakerNames);
  const system =
    "Je haalt de kernstructuur van onderwerpen uit een vergadertranscript en zet " +
    "die om in een mindmap-boomstructuur. Antwoord uitsluitend met geldige JSON, " +
    "zonder uitleg of markdown-codeblok eromheen.";
  const user = `Titel van de vergadering: ${meetingTitle || "(geen titel)"}

Transcript:
"""
${transcriptText}
"""

Geef een JSON-object terug met exact deze vorm:
{
  "title": "korte titel van de vergadering",
  "children": [
    {
      "title": "hoofdonderwerp",
      "children": [
        { "title": "subonderwerp of belangrijk punt", "children": [] }
      ]
    }
  ]
}

Regels:
- Maximaal 6 hoofdonderwerpen.
- Elk hoofdonderwerp mag 0 tot 5 subonderwerpen hebben, "children" mag leeg zijn.
- Gebruik korte, duidelijke labels (max ~8 woorden).
- Geef alleen het JSON-object terug, niets anders.`;
  const text = await callClaude(system, user, 2000);
  return extractJson(text);
}
