import { Document, Packer, Paragraph, HeadingLevel } from "docx";
import PDFDocument from "pdfkit";
import { parseMinutesMarkdown } from "./markdown.js";

/**
 * Zet notulen-markdown om in een Word-document (.docx) als Buffer.
 */
export async function minutesToDocx(markdown, title) {
  const blocks = parseMinutesMarkdown(markdown);
  const children = [];

  for (const b of blocks) {
    if (b.type === "h1") {
      children.push(new Paragraph({ text: b.text, heading: HeadingLevel.HEADING_1 }));
    } else if (b.type === "h2") {
      children.push(new Paragraph({ text: b.text, heading: HeadingLevel.HEADING_2, spacing: { before: 200 } }));
    } else if (b.type === "h3") {
      children.push(new Paragraph({ text: b.text, heading: HeadingLevel.HEADING_3, spacing: { before: 150 } }));
    } else if (b.type === "checkbox") {
      children.push(new Paragraph({ text: `${b.checked ? "[x]" : "[ ]"} ${b.text}`, bullet: { level: 0 } }));
    } else if (b.type === "li") {
      children.push(new Paragraph({ text: b.text, bullet: { level: 0 } }));
    } else {
      children.push(new Paragraph({ text: b.text, spacing: { after: 100 } }));
    }
  }

  if (children.length === 0) {
    children.push(new Paragraph({ text: title || "Notulen" }));
  }

  const doc = new Document({
    title: title || "Notulen",
    sections: [{ children }],
  });
  return Packer.toBuffer(doc);
}

/**
 * Zet notulen-markdown om in een PDF-bestand als Buffer.
 */
export function minutesToPdf(markdown, title) {
  return new Promise((resolve, reject) => {
    const blocks = parseMinutesMarkdown(markdown);
    const doc = new PDFDocument({ margin: 56 });
    const chunks = [];
    doc.on("data", (c) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    if (title) {
      doc.info.Title = title;
    }

    for (const b of blocks) {
      if (b.type === "h1") {
        doc.moveDown(0.3).font("Helvetica-Bold").fontSize(20).text(b.text);
        doc.moveDown(0.4);
      } else if (b.type === "h2") {
        doc.moveDown(0.5).font("Helvetica-Bold").fontSize(14).text(b.text);
        doc.moveDown(0.2);
      } else if (b.type === "h3") {
        doc.moveDown(0.3).font("Helvetica-Bold").fontSize(12).text(b.text);
        doc.moveDown(0.1);
      } else if (b.type === "checkbox") {
        doc.font("Helvetica").fontSize(11).text(`${b.checked ? "[x]" : "[ ]"} ${b.text}`, { indent: 14 });
      } else if (b.type === "li") {
        doc.font("Helvetica").fontSize(11).text(`-  ${b.text}`, { indent: 14 });
      } else {
        doc.font("Helvetica").fontSize(11).text(b.text);
        doc.moveDown(0.15);
      }
    }

    doc.end();
  });
}
