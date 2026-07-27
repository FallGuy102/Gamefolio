import { hydrateEntries, mapGame } from "@/app/lib/data";
import { requireUser } from "@/app/lib/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const { supabase, user, response } = await requireUser();
  if (response || !user) return response;
  const [entryResult, gameResult] = await Promise.all([
    supabase.from("entries").select("*").order("updated_at", { ascending: false }),
    supabase.from("games").select("*").order("name"),
  ]);
  if (entryResult.error || gameResult.error) {
    return Response.json({ error: "导出数据失败" }, { status: 500 });
  }
  return Response.json({
    formatVersion: 1,
    exportedAt: new Date().toISOString(),
    entries: await hydrateEntries(supabase, entryResult.data ?? []),
    games: (gameResult.data ?? []).map(mapGame),
  });
}
