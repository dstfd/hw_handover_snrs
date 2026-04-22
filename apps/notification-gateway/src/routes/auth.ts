import type { Database } from "better-sqlite3";
import type { FastifyPluginAsync } from "fastify";
import bcrypt from "bcryptjs";
import type { NotifGwConfig } from "../services/config.js";
import { signToken } from "../services/authJwt.js";
import { findUserByEmail, rowToPublic } from "../services/userQueries.js";

export const authPlugin: FastifyPluginAsync<{
  db: Database;
  config: NotifGwConfig;
}> = async (app, opts) => {
  const { db, config } = opts;

  app.post<{
    Body: { email?: string; password?: string };
  }>("/auth/login", async (request, reply) => {
    const email = request.body.email;
    const password = request.body.password;
    if (
      typeof email !== "string" ||
      typeof password !== "string" ||
      email.trim() === "" ||
      password === ""
    ) {
      return reply.status(400).send({ error: "email and password required" });
    }
    const row = findUserByEmail(db, email.trim());
    if (!row) {
      return reply.status(401).send({ error: "invalid credentials" });
    }
    if (!bcrypt.compareSync(password, row.password_hash)) {
      return reply.status(401).send({ error: "invalid credentials" });
    }
    const role = row.role === "admin" ? "admin" : "user";
    const token = signToken(config, row.user_id, role);
    const user = rowToPublic(row);
    return {
      token,
      user: {
        user_id: user.user_id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    };
  });
};
