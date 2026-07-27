import { env } from "cloudflare:workers";
import { headers } from "next/headers";
import { getDb } from "@/db";

type Bucket = R2Bucket;

export function database() {
  return getDb();
}

export function rawDatabase(): D1Database {
  if (!env.DB) throw new Error("Database binding DB is unavailable");
  return env.DB;
}

export function uploadsBucket(): Bucket {
  const bucket = (env as unknown as { UPLOADS?: Bucket }).UPLOADS;
  if (!bucket) throw new Error("Object storage binding UPLOADS is unavailable");
  return bucket;
}

export async function currentUserEmail(request?: Request): Promise<string | null> {
  const requestHeaders = request ? request.headers : await headers();
  const email = requestHeaders.get("oai-authenticated-user-email");
  if (email) return email.toLowerCase();

  const host = requestHeaders.get("host") ?? "";
  if (
    process.env.NODE_ENV === "development" ||
    host.startsWith("localhost") ||
    host.startsWith("127.0.0.1")
  ) {
    return "local@design-vault.invalid";
  }
  return null;
}

export function unauthorized() {
  return Response.json({ error: "请先登录后继续" }, { status: 401 });
}

export function jsonArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  if (typeof value !== "string") return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map(String).filter(Boolean) : [];
  } catch {
    return [];
  }
}

export async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function cleanText(value: unknown, max = 10000): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}
