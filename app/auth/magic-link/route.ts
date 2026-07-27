import { cleanText } from "@/app/lib/server";
import { createClient } from "@/app/lib/supabase/server";

export async function POST(request: Request) {
  const input = (await request.json()) as { email?: string; next?: string };
  const email = cleanText(input.email, 254).toLowerCase();
  if (!email || !email.includes("@")) {
    return Response.json({ error: "请输入有效邮箱" }, { status: 400 });
  }
  const next = input.next?.startsWith("/") && !input.next.startsWith("//") ? input.next : "/";
  const callback = new URL("/auth/confirm", request.url);
  callback.searchParams.set("next", next);
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: callback.toString(),
      shouldCreateUser: false,
    },
  });
  if (error) console.warn("Magic link request rejected:", error.message);

  // Return the same response for known and unknown emails to avoid account discovery.
  return Response.json({ ok: true });
}
