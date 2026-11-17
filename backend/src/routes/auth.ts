import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { pool } from "../db";

export const authRouter = Router();

const credentials = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

function signToken(userId: string) {
  return jwt.sign({ sub: userId }, process.env.JWT_SECRET as string, {
    expiresIn: "7d",
  });
}

authRouter.post("/register", async (req, res) => {
  const parsed = credentials.safeParse(req.body);
  if (!parsed.success) {
    return res
      .status(400)
      .json({ error: "Email tidak valid atau password kurang dari 8 karakter" });
  }
  const { email, password } = parsed.data;
  const hash = await bcrypt.hash(password, 10);

  try {
    const { rows } = await pool.query(
      "insert into users (email, password_hash) values ($1, $2) returning id, email",
      [email.toLowerCase(), hash]
    );
    res.status(201).json({ user: rows[0], token: signToken(rows[0].id) });
  } catch (err: any) {
    if (err.code === "23505") {
      return res.status(409).json({ error: "Email sudah terdaftar" });
    }
    res.status(500).json({ error: "Server error" });
  }
});

authRouter.post("/login", async (req, res) => {
  const parsed = credentials.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Data tidak valid" });
  }
  const { email, password } = parsed.data;

  const { rows } = await pool.query(
    "select id, email, password_hash from users where email = $1",
    [email.toLowerCase()]
  );
  const user = rows[0];
  const valid = user && (await bcrypt.compare(password, user.password_hash));
  if (!valid) {
    return res.status(401).json({ error: "Email atau password salah" });
  }
  res.json({
    user: { id: user.id, email: user.email },
    token: signToken(user.id),
  });
});