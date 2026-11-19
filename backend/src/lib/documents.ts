import { pool } from "../db";

export type RenamedDoc = { id: string; title: string };

/**
 * Hapus dokumen milik user. Mengembalikan file_path (untuk dihapus dari disk)
 * atau null kalau dokumen tidak ada / bukan milik user.
 * Percakapan dihapus dulu karena conversations.document_id tidak punya ON DELETE CASCADE;
 * messages dan message_sources ikut terhapus lewat cascade, chunks ikut terhapus
 * saat dokumennya dihapus.
 */
export async function deleteDocument(userId: string, docId: string): Promise<string | null> {
  const client = await pool.connect();
  try {
    await client.query("begin");
    const owned = await client.query(
      "select file_path from documents where id = $1 and user_id = $2 for update",
      [docId, userId]
    );
    if (!owned.rows[0]) {
      await client.query("rollback");
      return null;
    }
    await client.query("delete from conversations where document_id = $1", [docId]);
    await client.query("delete from documents where id = $1 and user_id = $2", [docId, userId]);
    await client.query("commit");
    return owned.rows[0].file_path as string;
  } catch (err) {
    await client.query("rollback").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

/** Ganti judul dokumen milik user. Mengembalikan null kalau bukan miliknya. */
export async function renameDocument(
  userId: string,
  docId: string,
  title: string
): Promise<RenamedDoc | null> {
  const { rows } = await pool.query(
    "update documents set title = $3 where id = $1 and user_id = $2 returning id, title",
    [docId, userId, title]
  );
  return rows[0] ?? null;
}