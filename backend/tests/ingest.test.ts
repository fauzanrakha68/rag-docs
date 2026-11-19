import { describe, expect, it, vi } from "vitest";

vi.mock("pdf-parse/lib/pdf-parse.js", () => ({ default: vi.fn() }));

import { chunkText } from "../src/lib/ingest";

describe("chunkText", () => {
  it("mengembalikan array kosong untuk teks yang terlalu pendek", () => {
    expect(chunkText("")).toEqual([]);
    expect(chunkText("   pendek   ")).toEqual([]);
  });

  it("merapikan spasi dan baris baru menjadi satu spasi", () => {
    const text = "satu   dua\n\ntiga empat lima enam tujuh delapan sembilan sepuluh";
    expect(chunkText(text)).toEqual([
      "satu dua tiga empat lima enam tujuh delapan sembilan sepuluh",
    ]);
  });

  it("menghasilkan satu chunk jika teks muat dalam ukuran chunk", () => {
    const chunks = chunkText("a".repeat(500));
    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toHaveLength(500);
  });

  it("memotong teks panjang dengan overlap antar chunk", () => {
    const text = Array.from({ length: 80 }, (_, i) => `w${i}`).join(" ");
    const chunks = chunkText(text, 50, 10);

    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      expect(chunk.length).toBeLessThanOrEqual(50);
    }
    for (let i = 0; i < chunks.length - 1; i++) {
      expect(chunks[i].slice(-10)).toBe(chunks[i + 1].slice(0, 10));
    }
    expect(text.endsWith(chunks[chunks.length - 1])).toBe(true);
  });
});