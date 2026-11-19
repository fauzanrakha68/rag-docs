import { beforeEach, describe, expect, it, vi } from "vitest";

const { clientQuery, release, poolQuery } = vi.hoisted(() => ({
  clientQuery: vi.fn(),
  release: vi.fn(),
  poolQuery: vi.fn(),
}));

vi.mock("../src/db", () => ({
  pool: {
    connect: vi.fn().mockResolvedValue({ query: clientQuery, release }),
    query: poolQuery,
  },
}));

import { deleteDocument, renameDocument } from "../src/lib/documents";

beforeEach(() => {
  clientQuery.mockReset();
  release.mockReset();
  poolQuery.mockReset();
});

describe("deleteDocument", () => {
  it("tidak menghapus apa pun kalau dokumen milik user lain", async () => {
    clientQuery.mockResolvedValue({ rows: [] });

    const result = await deleteDocument("user-a", "doc-milik-b");

    expect(result).toBeNull();
    const sqls = clientQuery.mock.calls.map((c) => String(c[0]));
    expect(sqls.some((s) => s.startsWith("delete"))).toBe(false);
    expect(sqls).toContain("rollback");
    expect(release).toHaveBeenCalledTimes(1);
  });

  it("memeriksa kepemilikan dengan user_id dan menghapus dalam satu transaksi", async () => {
    clientQuery.mockImplementation(async (sql: string) =>
      sql.startsWith("select") ? { rows: [{ file_path: "uploads/a.pdf" }] } : { rows: [] }
    );

    const result = await deleteDocument("user-a", "doc-1");

    expect(result).toBe("uploads/a.pdf");
    const [selectSql, selectParams] = clientQuery.mock.calls[1];
    expect(selectSql).toContain("user_id = $2");
    expect(selectParams).toEqual(["doc-1", "user-a"]);
    const sqls = clientQuery.mock.calls.map((c) => String(c[0]));
    expect(sqls[0]).toBe("begin");
    expect(sqls[sqls.length - 1]).toBe("commit");
    expect(sqls.some((s) => s.includes("delete from conversations"))).toBe(true);
    expect(release).toHaveBeenCalledTimes(1);
  });

  it("rollback dan melempar ulang error kalau query gagal", async () => {
    clientQuery.mockImplementation(async (sql: string) => {
      if (sql.startsWith("select")) return { rows: [{ file_path: "x" }] };
      if (sql.startsWith("delete from conversations")) throw new Error("db error");
      return { rows: [] };
    });

    await expect(deleteDocument("user-a", "doc-1")).rejects.toThrow("db error");
    expect(clientQuery.mock.calls.map((c) => c[0])).toContain("rollback");
    expect(release).toHaveBeenCalledTimes(1);
  });
});

describe("renameDocument", () => {
  it("mengembalikan null kalau dokumen bukan milik user", async () => {
    poolQuery.mockResolvedValue({ rows: [] });
    expect(await renameDocument("user-a", "doc-milik-b", "Baru")).toBeNull();
    expect(poolQuery.mock.calls[0][1]).toEqual(["doc-milik-b", "user-a", "Baru"]);
  });

  it("mengembalikan dokumen yang sudah diganti judulnya", async () => {
    poolQuery.mockResolvedValue({ rows: [{ id: "doc-1", title: "Baru" }] });
    expect(await renameDocument("user-a", "doc-1", "Baru")).toEqual({ id: "doc-1", title: "Baru" });
  });
});