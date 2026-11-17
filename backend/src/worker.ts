import { Worker } from "bullmq";
import fs from "fs/promises";
import { pool } from "./db";
import { redisConnection } from "./queue";
import { extractPages, chunkText } from "./lib/ingest";
import { embedTexts, toVectorLiteral } from "./lib/embeddings";

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

      const items: { page: number; content: string }[] = [];
      for (let p = 0; p < pages.length; p++) {
        for (const content of chunkText(pages[p])) {
          items.push({ page: p + 1, content });
        }
      }
      
      const BATCH = 16;
      for (let i = 0; i < items.length; i += BATCH) {
        const batch = items.slice(i, i + BATCH);
        const vectors = await embedTexts(batch.map((b) => b.content));
        for (let j = 0; j < batch.length; j++) {
          await pool.query(
            "insert into chunks (document_id, page_number, chunk_index, content, embedding) values ($1, $2, $3, $4, $5::vector)",
            [documentId, batch[j].page, i + j, batch[j].content, toVectorLiteral(vectors[j])]
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