import { beforeAll, describe, expect, it, vi } from "vitest";
import jwt from "jsonwebtoken";
import { requireAuth } from "../src/middleware/auth";

const SECRET = "test-secret";

beforeAll(() => {
  process.env.JWT_SECRET = SECRET;
});

function run(authorization?: string) {
  const req = { headers: authorization ? { authorization } : {} };
  const res = {
    locals: {} as Record<string, unknown>,
    status: vi.fn(),
    json: vi.fn(),
  };
  res.status.mockReturnValue(res);
  const next = vi.fn();
  requireAuth(req as never, res as never, next);
  return { res, next };
}

describe("requireAuth", () => {
  it("menolak permintaan tanpa header Authorization", () => {
    const { res, next } = run();
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("menolak token yang bukan JWT valid", () => {
    const { res, next } = run("Bearer bukan-token");
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("menolak token yang ditandatangani dengan secret lain", () => {
    const token = jwt.sign({ sub: "user-1" }, "secret-lain");
    const { res, next } = run(`Bearer ${token}`);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("menolak token yang sudah kedaluwarsa", () => {
    const token = jwt.sign(
      { sub: "user-1", exp: Math.floor(Date.now() / 1000) - 60 },
      SECRET
    );
    const { res, next } = run(`Bearer ${token}`);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("meloloskan token valid dan menyimpan userId", () => {
    const token = jwt.sign({ sub: "user-1" }, SECRET, { expiresIn: "1h" });
    const { res, next } = run(`Bearer ${token}`);
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.locals.userId).toBe("user-1");
    expect(res.status).not.toHaveBeenCalled();
  });
});