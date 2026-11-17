import { Worker } from "bullmq";
import fs from "fs/promises";
import { pool } from "./db";
import { redisConnection } from "./queue";
import { extractPages, chunkText } from "./lib/ingest";

export const ingestWorker = new Worker(
  "ingest",
  async (job) => {
    const { documentId } = job.data as { documentId: string };

    await pool.query("update documents set status = 'processing' where id = $1", [documentId]);

    try {
      const { rows } = await pool.query("select file_path from documents where id = $1", [documentId]);
      const buffer = await fs.readFile(rows[0].file_path);
      const pages = await extractPages(buffer);

      await pool.query("delete from chunks where document_id = $1", [documentId]);

      let index = 0;
      for (let p = 0; p < pages.length; p++) {
        for (const content of chunkText(pages[p])) {
          await pool.query(
            "insert into chunks (document_id, page_number, chunk_index, content) values ($1, $2, $3, $4)",
            [documentId, p + 1, index++, content]
          );
        }
      }

      await pool.query(
        "update documents set status = 'ready', page_count = $2 where id = $1",
        [documentId, pages.length]
      );
    } catch (err) {
      await pool.query("update documents set status = 'failed' where id = $1", [documentId]);
      throw err;
    }
  },
  { connection: redisConnection }
);

ingestWorker.on("failed", (job, err) => {
  console.error(`Ingest job ${job?.id} failed:`, err.message);
});