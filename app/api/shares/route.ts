import { requireUser, sha256 } from "@/app/lib/server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const { supabase, user, response } = await requireUser();
  if (response || !user) return response;
  const input = (await request.json()) as { entryId?: string };
  if (!input.entryId) return Response.json({ error: "缺少条目" }, { status: 400 });
  const entry = await supabase.from("entries").select("id").eq("id", input.entryId).maybeSingle();
  if (!entry.data) return Response.json({ error: "条目不存在" }, { status: 404 });

  const active = await supabase
    .from("share_links")
    .select("id")
    .eq("entry_id", input.entryId)
    .is("revoked_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (active.error) {
    console.error(active.error);
    return Response.json({ error: "读取分享链接失败" }, { status: 500 });
  }
  if (active.data) {
    return Response.json(
      { token: active.data.id, path: `/s/${active.data.id}` },
      { status: 200 },
    );
  }

  const id = crypto.randomUUID();
  const result = await supabase.from("share_links").insert({
    id,
    entry_id: input.entryId,
    user_id: user.id,
    token_hash: await sha256(id),
  });
  if (result.error) return Response.json({ error: "创建分享链接失败" }, { status: 500 });
  return Response.json({ token: id, path: `/s/${id}` }, { status: 201 });
}

export async function DELETE(request: Request) {
  const { supabase, user, response } = await requireUser();
  if (response || !user) return response;
  const entryId = new URL(request.url).searchParams.get("entryId");
  if (!entryId) return Response.json({ error: "缺少条目" }, { status: 400 });
  await supabase
    .from("share_links")
    .update({ revoked_at: new Date().toISOString() })
    .eq("entry_id", entryId)
    .is("revoked_at", null);
  return Response.json({ ok: true });
}
