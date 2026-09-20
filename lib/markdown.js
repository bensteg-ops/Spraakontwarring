/**
 * Zet de eenvoudige markdown die Claude voor de notulen genereert om in een
 * lijst van structuurblokken, zodat zowel de Word- als de PDF-export
 * dezelfde inhoud consistent kunnen weergeven.
 *
 * Bloktypen: "h1" | "h2" | "h3" | "li" | "checkbox" | "p"
 */
export function parseMinutesMarkdown(markdown) {
  const blocks = [];
  const lines = (markdown || "").split("\n");
  for (let raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith("### ")) {
      blocks.push({ type: "h3", text: stripEmphasis(line.slice(4)) });
    } else if (line.startsWith("## ")) {
      blocks.push({ type: "h2", text: stripEmphasis(line.slice(3)) });
    } else if (line.startsWith("# ")) {
      blocks.push({ type: "h1", text: stripEmphasis(line.slice(2)) });
    } else if (/^[-*]\s*\[[ xX]\]\s+/.test(line)) {
      const checked = /\[[xX]\]/.test(line);
      const text = line.replace(/^[-*]\s*\[[ xX]\]\s+/, "");
      blocks.push({ type: "checkbox", text: stripEmphasis(text), checked });
    } else if (/^[-*]\s+/.test(line)) {
      blocks.push({ type: "li", text: stripEmphasis(line.replace(/^[-*]\s+/, "")) });
    } else {
      blocks.push({ type: "p", text: stripEmphasis(line) });
    }
  }
  return blocks;
}

function stripEmphasis(text) {
  return text.replace(/\*\*(.+?)\*\*/g, "$1").replace(/\*(.+?)\*/g, "$1");
}
