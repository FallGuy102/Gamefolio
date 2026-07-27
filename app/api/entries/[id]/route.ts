import { hydrateEntries } from "@/app/lib/data";
import { cleanText, requireUser } from "@/app/lib/server";
import type { EntryInput } from "@/app/lib/types";
import { replaceSectionsAndTags } from "../route";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { supabase, user, response } = await requireUser();
  if (response || !user) return response;
  const { id } = await context.params;
  const result = await supabase.from("entries").select("*").eq("id", id).maybeSingle();
  if (result.error) return Response.json({ error: "读取条目失败" }, { status: 500 });
  if (!result.data) return Response.json({ error: "条目不存在" }, { status: 404 });
  const [entry] = await hydrateEntries(supabase, [result.data]);
  return Response.json({ entry });
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { supabase, user, response } = await requireUser();
  if (response || !user) return response;
  const { id } = await context.params;
  const input = (await request.json()) as Partial<EntryInput>;
  const existing = await supabase
    .from("entries")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!existing.data) return Response.json({ error: "条目不存在" }, { status: 404 });
  if (input.version && Number(input.version) !== Number(existing.data.version)) {
    const [serverEntry] = await hydrateEntries(supabase, [existing.data]);
    return Response.json(
      { error: "这条内容已在另一台设备上更新", conflict: true, serverEntry },
      { status: 409 },
    );
  }

  const updated = await supabase
    .from("entries")
    .update({
      type: input.type === "review" ? "review" : "idea",
      title: cleanText(input.title, 160) || "未命名灵感",
      body: cleanText(input.body, 30000),
      game_id: input.gameId || null,
      design_theme: cleanText(input.designTheme, 80) || null,
      status: input.status === "complete" ? "complete" : "draft",
      favorite: Boolean(input.favorite),
      version: Number(existing.data.version) + 1,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("version", existing.data.version)
    .select("*")
    .maybeSingle();
  if (!updated.data) {
    return Response.json({ error: "保存冲突，请刷新后重试", conflict: true }, { status: 409 });
  }
  await replaceSectionsAndTags(supabase, user.id, id, input.sections ?? [], input.tags ?? []);
  const [entry] = await hydrateEntries(supabase, [updated.data]);
  return Response.json({ entry });
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { supabase, user, response } = await requireUser();
  if (response || !user) return response;
  const { id } = await context.params;
  const images = await supabase
    .from("entry_images")
    .select("storage_path")
    .eq("entry_id", id);
  const paths = (images.data ?? []).map((image) => image.storage_path);
  if (paths.length) await supabase.storage.from("entry-images").remove(paths);
  const result = await supabase.from("entries").delete().eq("id", id).select("id");
  if (!result.data?.length) return Response.json({ error: "条目不存在" }, { status: 404 });
  return new Response(null, { status: 204 });
}
