import pdfParse from "pdf-parse/lib/pdf-parse.js";

export async function extractPages(buffer: Buffer): Promise<string[]> {
  const pages: string[] = [];
  await pdfParse(buffer, {
    pagerender: async (pageData: any) => {
      const content = await pageData.getTextContent({
        normalizeWhitespace: true,
      });
      const text = content.items.map((i: any) => i.str).join(" ");
      pages.push(text);
      return text;
    },
  });
  return pages;
}

export function chunkText(text: string, size = 1200, overlap = 200): string[] {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length < 30) return [];
  const chunks: string[] = [];
  for (let start = 0; start < clean.length; start += size - overlap) {
    chunks.push(clean.slice(start, start + size));
    if (start + size >= clean.length) break;
  }
  return chunks;
}