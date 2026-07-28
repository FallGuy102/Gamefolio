import type { User } from "@supabase/supabase-js";
import { createClient } from "@/app/lib/supabase/server";

export async function authenticatedUser(): Promise<
  | { supabase: Awaited<ReturnType<typeof createClient>>; user: User }
  | { supabase: Awaited<ReturnType<typeof createClient>>; user: null }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

export function unauthorized() {
  return Response.json({ error: "请先登录后继续" }, { status: 401 });
}

export async function requireUser() {
  const result = await authenticatedUser();
  if (!result.user) return { ...result, response: unauthorized() };
  return { ...result, response: null };
}

export async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

export async function shareToken(shareId: string): Promise<string> {
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!secret) throw new Error("缺少 SUPABASE_SECRET_KEY");
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(`gamefolio-share:${shareId}`),
  );
  return Buffer.from(signature).toString("base64url");
}

export function cleanText(value: unknown, max = 10000): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export function databaseError(error: { message?: string } | null, fallback = "操作失败") {
  if (!error) return null;
  console.error(error);
  return Response.json({ error: fallback }, { status: 500 });
}
