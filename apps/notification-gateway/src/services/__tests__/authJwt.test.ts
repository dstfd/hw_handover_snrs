import { describe, expect, it } from "vitest";
import { signToken, verifyToken } from "../authJwt.js";
import type { NotifGwConfig } from "../config.js";

const cfg: NotifGwConfig = {
  port: 4103,
  selfBaseUrl: "http://127.0.0.1:4103",
  redisUrl: "redis://localhost:6379",
  intelBaseUrl: "http://localhost:4102",
  datascoutBaseUrl: "http://localhost:4101",
  magicballBaseUrl: "http://localhost:4100",
  jwtSecret: "test-secret",
  jwtExpiry: "1h",
};

describe("authJwt", () => {
  it("round-trips user and admin role", () => {
    const tUser = signToken(cfg, "u1", "user");
    const pUser = verifyToken(cfg, tUser);
    expect(pUser.user_id).toBe("u1");
    expect(pUser.role).toBe("user");

    const tAdmin = signToken(cfg, "a1", "admin");
    const pAdmin = verifyToken(cfg, tAdmin);
    expect(pAdmin.role).toBe("admin");
  });
});
