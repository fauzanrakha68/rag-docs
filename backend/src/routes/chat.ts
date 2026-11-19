import { Router } from "express";
import { z } from "zod";
import { pool } from "../db";
import { requireAuth } from "../middleware/auth";
import { retrieve } from "../lib/retrieve";
import { chat } from "../lib/llm";

export const chatRouter = Router();

const bodySchema = z.object({
  question: z.string().min(3).max(1000),
  conversationId: z.string().uuid().optional(),
});

const MIN_SCORE = Number(process.env.MIN_SCORE) || 0.3;
const NOT_FOUND_ANSWER = "Saya tidak menemukan informasi tersebut di dokumen ini.";

const SYSTEM_PROMPT = `Kamu adalah asisten yang menjawab pertanyaan HANYA berdasarkan kutipan dokumen yang diberikan.
Aturan:
- Jawab langsung ke inti pertanyaan dengan 2 sampai 5 kalimat lengkap, gunakan detail dari kutipan (definisi, contoh, langkah).
- Jangan menulis frasa seperti "disebut dalam konteks" atau "berdasarkan konteks"; langsung jelaskan isinya.
- Abaikan bagian kutipan yang hanya berisi nama penulis, kontak, atau nomor halaman.
- Setiap pernyataan harus diikuti penanda sumber seperti [1] atau [2], sesuai nomor kutipan.
- Jika jawabannya tidak ada di kutipan, katakan bahwa informasinya tidak ditemukan di dokumen.
- Jangan menambahkan informasi dari luar kutipan.
- Jawab dalam bahasa yang sama dengan pertanyaan.`;

chatRouter.post("/:id/ask", requireAuth, async (req, res) => {
  const docId = z.string().uuid().safeParse(req.params.id);
  const parsed = bodySchema.safeParse(req.body);
  if (!docId.success || !parsed.success) {
    return res.status(400).json({ error: "Input tidak valid" });
  }
  const userId = res.locals.userId as string;
  const { question } = parsed.data;

  const doc = await pool.query(
    "select status from documents where id = $1 and user_id = $2",
    [docId.data, userId]
  );
  if (!doc.rows[0]) {
    return res.status(404).json({ error: "Dokumen tidak ditemukan" });
  }
  if (doc.rows[0].status !== "ready") {
    return res.status(409).json({ error: "Dokumen belum selesai diproses" });
  }

  let conversationId = parsed.data.conversationId;
  if (conversationId) {
    const own = await pool.query(
      "select 1 from conversations where id = $1 and user_id = $2 and document_id = $3",
      [conversationId, userId, docId.data]
    );
    if (!own.rows[0]) {
      return res.status(404).json({ error: "Percakapan tidak ditemukan" });
    }
  } else {
    const created = await pool.query(
      "insert into conversations (user_id, document_id) values ($1, $2) returning id",
      [userId, docId.data]
    );
    conversationId = created.rows[0].id as string;
  }

  await pool.query(
    "insert into messages (conversation_id, role, content) values ($1, 'user', $2)",
    [conversationId, question]
  );

  try {
    const found = await retrieve(docId.data, userId, question, 3);
    const relevant = found.filter((s) => s.score >= MIN_SCORE);

    let answer = NOT_FOUND_ANSWER;
    if (relevant.length > 0) {
      const context = relevant
        .map((s, i) => `[${i + 1}] (halaman ${s.page})\n${s.content}`)
        .join("\n\n");
      answer = await chat([
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: `Kutipan Dokumen: \n${context}\n\nPertanyaan: ${question}` },
      ]);
    }

    const saved = await pool.query(
      "insert into messages (conversation_id, role, content) values ($1, 'assistant', $2) returning id",
      [conversationId, answer]
    );
    for (const s of relevant) {
      await pool.query(
        "insert into message_sources (message_id, chunk_id, score) values ($1, $2, $3)",
        [saved.rows[0].id, s.chunkId, s.score]
      );
    }

    res.json({
      conversationId,
      answer,
      sources: relevant.map((s, i) => ({
        n: i + 1,
        page: s.page,
        snippet: s.content.slice(0, 200),
        score: Number(s.score.toFixed(3)),
      })),
      debugTopScores: found.map((s) => Number(s.score.toFixed(3))),
    });
  } catch (err) {
    res.status(502).json({ error: (err as Error).message });
  }

  chatRouter.get("/:id/history", requireAuth, async (req, res) => {
    const docId = z.string().uuid().safeParse(req.params.id);
    if (!docId.success) {
      return res.status(400).json({ error: "ID tidak valid" });
    }
    const userId = res.locals.userId as string;
  
    const conv = await pool.query(
      `select id from conversations
       where document_id = $1 and user_id = $2
       order by created_at desc
       limit 1`,
      [docId.data, userId]
    );
    if (!conv.rows[0]) {
      return res.json({ conversationId: null, messages: [] });
    }
  
    const { rows } = await pool.query(
      `select m.id, m.role, m.content,
              coalesce(
                json_agg(
                  json_build_object('n', s.n, 'page', s.page_number,
                                    'snippet', left(s.content, 200), 'score', s.score)
                  order by s.n
                ) filter (where s.n is not null),
                '[]'
              ) as sources
       from messages m
       left join (
         select ms.message_id, c.page_number, c.content,
                round(ms.score::numeric, 3) as score,
                row_number() over (partition by ms.message_id order by ms.score desc) as n
         from message_sources ms
         join chunks c on c.id = ms.chunk_id
       ) s on s.message_id = m.id
       where m.conversation_id = $1
       group by m.id
       order by m.created_at, m.id`,
      [conv.rows[0].id]
    );
  
    res.json({
      conversationId: conv.rows[0].id,
      messages: rows.map((r) => ({ role: r.role, text: r.content, sources: r.sources })),
    });
  });

});