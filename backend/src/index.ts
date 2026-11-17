import "dotenv/config";
import express from "express";
import { pool } from "./db";
import { authRouter } from "./routes/auth";
import { requireAuth } from "./middleware/auth";

const app = express();
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

app.get("/me", requireAuth, async (_req, res) => {
  const { rows } = await pool.query(
    "select id, email, created_at from users where id = $1",
    [res.locals.userId]
  );
  res.json(rows[0]);
});

const port = Number(process.env.PORT) || 3001;
app.listen(port, () => console.log(`API running on http://localhost:${port}`));