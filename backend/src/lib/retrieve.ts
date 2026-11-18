import { pool } from "../db";
import { embedTexts, toVectorLiteral } from "./embeddings";

export type Source = {
  chunkId: string;
  page: number;
  content: string;
  score: number;
};

export async function retrieve(
  documentId: string,
  userId: string,
  question: string,
  k = 5
): Promise<Source[]> {
  const [vec] = await embedTexts([question]);
  const { rows } = await pool.query(
    `select c.id, c.page_number, c.content,
            1 - (c.embedding <=> $1::vector) as score
     from chunks c
     join documents d on d.id = c.document_id
     where c.document_id = $2 and d.user_id = $3 and c.embedding is not null
     order by c.embedding <=> $1::vector
     limit $4`,
    [toVectorLiteral(vec), documentId, userId, k]
  );
  return rows.map((r) => ({
    chunkId: r.id,
    page: r.page_number,
    content: r.content,
    score: Number(r.score),
  }));
}