import { mapGame } from "@/app/lib/data";
import { cleanText, requireUser } from "@/app/lib/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const { supabase, user, response } = await requireUser();
  if (response || !user) return response;
  const result = await supabase.from("games").select("*").order("updated_at", { ascending: false });
  if (result.error) return Response.json({ error: "读取游戏资料失败" }, { status: 500 });
  return Response.json({ games: (result.data ?? []).map(mapGame) });
}

export async function POST(request: Request) {
  const { supabase, user, response } = await requireUser();
  if (response || !user) return response;
  const input = (await request.json()) as Record<string, unknown>;
  const name = cleanText(input.name, 160);
  if (!name) return Response.json({ error: "游戏名称不能为空" }, { status: 400 });
  const igdbId = input.igdbId == null ? null : Number(input.igdbId);
  if (igdbId) {
    const existing = await supabase
      .from("games")
      .select("*")
      .eq("igdb_id", igdbId)
      .maybeSingle();
    if (existing.data) return Response.json({ game: mapGame(existing.data) });
  }
  const result = await supabase
    .from("games")
    .insert({
      id: crypto.randomUUID(),
      user_id: user.id,
      igdb_id: igdbId,
      name,
      cover_url: cleanText(input.coverUrl, 500) || null,
      genres: Array.isArray(input.genres) ? input.genres.slice(0, 12).map(String) : [],
      platforms: Array.isArray(input.platforms)
        ? input.platforms.slice(0, 12).map(String)
        : [],
      developer: cleanText(input.developer, 160) || null,
      is_manual: input.isManual !== false,
    })
    .select("*")
    .single();
  if (result.error) return Response.json({ error: "保存游戏资料失败" }, { status: 500 });
  return Response.json({ game: mapGame(result.data) }, { status: 201 });
}
