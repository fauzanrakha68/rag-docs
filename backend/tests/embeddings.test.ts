import { afterEach, describe, expect, it, vi } from "vitest";
import { embedTexts, toVectorLiteral } from "../src/lib/embeddings";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("toVectorLiteral", () => {
  it("mengubah array angka menjadi literal vektor pgvector", () => {
    expect(toVectorLiteral([0.1, -2, 3])).toBe("[0.1,-2,3]");
  });
});

describe("embedTexts", () => {
  it("mengirim teks ke Ollama dan mengembalikan vektornya", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ embeddings: [[1, 2], [3, 4]] }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await embedTexts(["a", "b"]);

    expect(result).toEqual([[1, 2], [3, 4]]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("/api/embed");
    expect(JSON.parse(init.body).input).toEqual(["a", "b"]);
  });

  it("melempar error yang jelas saat Ollama membalas gagal", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        text: async () => "model not found",
      })
    );

    await expect(embedTexts(["a"])).rejects.toThrow("Embedding gagal (500)");
  });
});