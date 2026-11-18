import "dotenv/config";
import express from "express";
import { pool } from "./db";
import { authRouter } from "./routes/auth";
import { requireAuth } from "./middleware/auth";
import { Request, Response, NextFunction } from "express";
import { documentsRouter } from "./routes/documents";
import "./worker";
import { chatRouter } from "./routes/chat";
import cors from "cors";

const app = express();

app.use(cors({ origin: process.env.FRONTEND_URL || "http://localhost:3000" }));

app.use(express.json());

app.get("/health", async (_req, res) => {
  try {
    const { rows } = await pool.query(
      "select now() as time, (select extname from pg_extension where extname = 'vector') as vector"
    );
    res.json({ status: "ok", db: rows[0] });
  } catch (err) {
    res.status(500).json({ status: "error", message: (err as Error).message });
  }
});

app.use("/auth", authRouter);
app.use("/documents", documentsRouter);
app.use("/documents", chatRouter);

app.get("/me", requireAuth, async (_req, res) => {
  const { rows } = await pool.query(
    "select id, email, created_at from users where id = $1",
    [res.locals.userId]
  );
  res.json(rows[0]);
});

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  res.status(400).json({ error: err.message });
});

const port = Number(process.env.PORT) || 3001;
app.listen(port, () => console.log(`API running on http://localhost:${port}`));