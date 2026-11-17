import "dotenv/config";
import express from "express";
import { pool } from "./db";

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

const port = Number(process.env.PORT) || 3001;
app.listen(port, () => console.log(`API running on http://localhost:${port}`));