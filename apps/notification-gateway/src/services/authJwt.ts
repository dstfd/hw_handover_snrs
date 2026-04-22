import jwt, { type SignOptions } from "jsonwebtoken";
import type { JwtPayload, UserRole } from "../types.js";
import type { NotifGwConfig } from "./config.js";

export function signToken(
  config: NotifGwConfig,
  user_id: string,
  role: UserRole
): string {
  return jwt.sign({ user_id, role }, config.jwtSecret, {
    expiresIn: config.jwtExpiry,
  } as SignOptions);
}

export function verifyToken(
  config: NotifGwConfig,
  token: string
): JwtPayload {
  const decoded = jwt.verify(token, config.jwtSecret);
  if (typeof decoded !== "object" || decoded === null) {
    throw new Error("Invalid token payload");
  }
  const o = decoded as Record<string, unknown>;
  const user_id = o["user_id"];
  const role = o["role"];
  if (typeof user_id !== "string" || (role !== "user" && role !== "admin")) {
    throw new Error("Invalid token claims");
  }
  return decoded as JwtPayload;
}
