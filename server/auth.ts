import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "./auth-schema";

function getConnectionString(): string {
  return (
    process.env["DATABASE_URL"] ??
    "postgresql://open3dcalc:open3dcalc@localhost:5432/open3dcalc"
  );
}

const sql = postgres(getConnectionString());
const db = drizzle(sql, { schema });

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: "pg" }),
  emailAndPassword: {
    enabled: true,
  },
  trustedOrigins: process.env["TRUSTED_ORIGINS"]
    ? process.env["TRUSTED_ORIGINS"].split(",")
    : ["http://localhost:3003"],
});

export type Session = typeof auth.$Infer.Session.session;
export type User = typeof auth.$Infer.Session.user;