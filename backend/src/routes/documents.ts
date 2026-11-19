import { Router } from "express";
import multer from "multer";
import fs from "fs";
import path from "path";
import { z } from "zod";
import { pool } from "../db";
import { requireAuth } from "../middleware/auth";
import { ingestQueue } from "../queue";
import { deleteDocument, renameDocument } from "../lib/documents";

export const documentsRouter = Router();

fs.mkdirSync("uploads", { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: "uploads",
    filename: (_req, file, cb) =>
      cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname)}`),
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype !== "application/pdf") {
      return cb(new Error("Hanya file PDF yang diperbolehkan"));
    }
    cb(null, true);
  },
});

documentsRouter.post("/", requireAuth, upload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "File PDF wajib diunggah" });

  const { rows } = await pool.query(
    "insert into documents (user_id, title, file_path) values ($1, $2, $3) returning id, title, status",
    [res.locals.userId, req.file.originalname, req.file.path]
  );
  await ingestQueue.add("ingest", { documentId: rows[0].id });
  res.status(202).json(rows[0]);
});

documentsRouter.get("/", requireAuth, async (_req, res) => {
  const { rows } = await pool.query(
    "select id, title, status, page_count, created_at from documents where user_id = $1 order by created_at desc",
    [res.locals.userId]
  );
  res.json(rows);
});

documentsRouter.get("/:id", requireAuth, async (req, res) => {
  if (!z.string().uuid().safeParse(req.params.id).success) {
    return res.status(400).json({ error: "ID tidak valid" });
  }
  const { rows } = await pool.query(
    `select d.id, d.title, d.status, d.page_count, d.created_at,
            (select count(*) from chunks c where c.document_id = d.id)::int as chunk_count
     from documents d where d.id = $1 and d.user_id = $2`,
    [req.params.id, res.locals.userId]
  );
  if (!rows[0]) return res.status(404).json({ error: "Dokumen tidak ditemukan" });
  res.json(rows[0]);
});

const renameSchema = z.object({ title: z.string().trim().min(1).max(200) });

documentsRouter.patch("/:id", requireAuth, async (req, res) => {
  const id = z.string().uuid().safeParse(req.params.id);
  const body = renameSchema.safeParse(req.body);
  if (!id.success || !body.success) {
    return res.status(400).json({ error: "Judul harus diisi (maksimal 200 karakter)" });
  }
  const doc = await renameDocument(res.locals.userId, id.data, body.data.title);
  if (!doc) return res.status(404).json({ error: "Dokumen tidak ditemukan" });
  res.json(doc);
});

documentsRouter.delete("/:id", requireAuth, async (req, res) => {
  const id = z.string().uuid().safeParse(req.params.id);
  if (!id.success) return res.status(400).json({ error: "ID tidak valid" });
  const filePath = await deleteDocument(res.locals.userId, id.data);
  if (!filePath) return res.status(404).json({ error: "Dokumen tidak ditemukan" });
  await fs.promises.unlink(filePath).catch(() => {});
  res.status(204).end();
});