import { cleanText } from "@/app/lib/server";
import { createClient } from "@/app/lib/supabase/server";

function safeNext(value: unknown) {
  return typeof value === "string" && value.startsWith("/") && !value.startsWith("//")
    ? value
    : "/";
}

export async function POST(request: Request) {
  const input = (await request.json()) as {
    email?: string;
    password?: string;
    next?: string;
  };
  const email = cleanText(input.email, 254).toLowerCase();
  const password = typeof input.password === "string" ? input.password.slice(0, 256) : "";
  if (!email || !email.includes("@") || !password) {
    return Response.json({ error: "请输入邮箱和密码" }, { status: 400 });
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    console.warn("Password login rejected:", error.code);
    return Response.json({ error: "邮箱或密码不正确" }, { status: 401 });
  }
  return Response.json({ ok: true, next: safeNext(input.next) });
}
