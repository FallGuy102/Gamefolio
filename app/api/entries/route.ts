import { hydrateEntries } from "@/app/lib/data";
import { cleanText, requireUser } from "@/app/lib/server";
import type { EntryInput, ReviewSection } from "@/app/lib/types";
import type { SupabaseClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { supabase, user, response } = await requireUser();
  if (response || !user) return response;
  const url = new URL(request.url);
  const query = cleanText(url.searchParams.get("q"), 120);

  let builder = supabase
    .from("entries")
    .select("*")
    .order("updated_at", { ascending: false })
    .limit(200);
  const type = url.searchParams.get("type");
  if (type === "idea" || type === "review") builder = builder.eq("type", type);
  if (url.searchParams.get("favorite") === "true") builder = builder.eq("favorite", true);
  const gameId = url.searchParams.get("gameId");
  if (gameId) builder = builder.eq("game_id", gameId);
  if (query) {
    const safe = query.replaceAll(",", " ");
    builder = builder.or(
      `title.ilike.%${safe}%,body.ilike.%${safe}%,design_theme.ilike.%${safe}%`,
    );
  }
  const { data, error } = await builder;
  if (error) return Response.json({ error: "读取条目失败" }, { status: 500 });
  return Response.json({ entries: await hydrateEntries(supabase, data ?? []) });
}

export async function POST(request: Request) {
  const { supabase, user, response } = await requireUser();
  if (response || !user) return response;
  const input = (await request.json()) as Partial<EntryInput>;
  const title = cleanText(input.title, 160);
  const body = cleanText(input.body, 30000);
  if (!title && !body) {
    return Response.json({ error: "请至少填写标题或正文" }, { status: 400 });
  }

  const id = crypto.randomUUID();
  const { error } = await supabase.from("entries").insert({
    id,
    user_id: user.id,
    type: input.type === "review" ? "review" : "idea",
    title: title || body.slice(0, 28) || "未命名灵感",
    body,
    game_id: input.gameId || null,
    design_theme: cleanText(input.designTheme, 80) || null,
    status: input.status === "complete" ? "complete" : "draft",
    favorite: Boolean(input.favorite),
    version: 1,
  });
  if (error) return Response.json({ error: "创建条目失败" }, { status: 500 });

  await replaceSectionsAndTags(supabase, user.id, id, input.sections ?? [], input.tags ?? []);
  const result = await supabase.from("entries").select("*").eq("id", id).single();
  if (result.error) return Response.json({ error: "读取新条目失败" }, { status: 500 });
  const [entry] = await hydrateEntries(supabase, [result.data]);
  return Response.json({ entry }, { status: 201 });
}

export async function replaceSectionsAndTags(
  supabase: SupabaseClient,
  userId: string,
  entryId: string,
  sections: ReviewSection[],
  tags: string[],
) {
  await Promise.all([
    supabase.from("entry_sections").delete().eq("entry_id", entryId),
    supabase.from("entry_tags").delete().eq("entry_id", entryId),
  ]);

  const sectionRows = sections
    .filter((section) => cleanText(section.content))
    .map((section, position) => ({
      id: crypto.randomUUID(),
      entry_id: entryId,
      user_id: userId,
      kind: cleanText(section.kind, 40) || "note",
      content: cleanText(section.content, 15000),
      position,
    }));
  if (sectionRows.length) {
    const { error } = await supabase.from("entry_sections").insert(sectionRows);
    if (error) throw error;
  }

  for (const rawTag of tags.slice(0, 20)) {
    const name = cleanText(rawTag, 32).replace(/^#/, "");
    if (!name) continue;
    let tagResult = await supabase
      .from("tags")
      .select("id")
      .eq("name", name)
      .maybeSingle();
    if (!tagResult.data) {
      tagResult = await supabase
        .from("tags")
        .insert({ id: crypto.randomUUID(), user_id: userId, name })
        .select("id")
        .single();
    }
    if (tagResult.error || !tagResult.data) {
      throw tagResult.error ?? new Error("标签保存失败");
    }
    const { error: linkError } = await supabase
      .from("entry_tags")
      .upsert(
        { entry_id: entryId, tag_id: tagResult.data.id, user_id: userId },
        { onConflict: "entry_id,tag_id" },
      );
    if (linkError) throw linkError;
  }
}
