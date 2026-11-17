import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  try {
    const payload = jwt.verify(
      header.slice(7),
      process.env.JWT_SECRET as string
    ) as jwt.JwtPayload;
    res.locals.userId = payload.sub;
    next();
  } catch {
    res.status(401).json({ error: "Token tidak valid atau kedaluwarsa" });
  }
}