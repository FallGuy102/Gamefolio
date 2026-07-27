import type { SupabaseClient } from "@supabase/supabase-js";
import type { Entry, EntryImage, Game, ReviewSection } from "./types";

type Row = Record<string, unknown>;

export function mapGame(game: Row): Game {
  return {
    id: String(game.id),
    igdbId: game.igdb_id == null ? null : Number(game.igdb_id),
    name: String(game.name),
    coverUrl: game.cover_url ? String(game.cover_url) : null,
    genres: Array.isArray(game.genres) ? game.genres.map(String) : [],
    platforms: Array.isArray(game.platforms) ? game.platforms.map(String) : [],
    developer: game.developer ? String(game.developer) : null,
    isManual: Boolean(game.is_manual),
  };
}

export async function hydrateEntries(
  supabase: SupabaseClient,
  rows: Row[],
  shareToken?: string,
): Promise<Entry[]> {
  if (!rows.length) return [];
  const ids = rows.map((row) => String(row.id));
  const gameIds = rows.map((row) => row.game_id).filter(Boolean).map(String);
  const [sectionsResult, tagsResult, imagesResult, gamesResult] = await Promise.all([
    supabase.from("entry_sections").select("*").in("entry_id", ids).order("position"),
    supabase
      .from("entry_tags")
      .select("entry_id, tag:tags(name)")
      .in("entry_id", ids),
    supabase.from("entry_images").select("*").in("entry_id", ids).order("position"),
    gameIds.length
      ? supabase.from("games").select("*").in("id", gameIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  const firstError =
    sectionsResult.error || tagsResult.error || imagesResult.error || gamesResult.error;
  if (firstError) throw firstError;

  const sections = (sectionsResult.data ?? []) as Row[];
  const tagRows = (tagsResult.data ?? []) as Array<Row & { tag?: { name?: string } | null }>;
  const images = (imagesResult.data ?? []) as Row[];
  const games = new Map(
    ((gamesResult.data ?? []) as Row[]).map((game) => [String(game.id), mapGame(game)]),
  );

  return rows.map((row) => ({
    id: String(row.id),
    type: row.type === "review" ? "review" : "idea",
    title: String(row.title ?? ""),
    body: String(row.body ?? ""),
    gameId: row.game_id ? String(row.game_id) : null,
    game: row.game_id ? games.get(String(row.game_id)) ?? null : null,
    designTheme: row.design_theme ? String(row.design_theme) : null,
    status: row.status === "complete" ? "complete" : "draft",
    favorite: Boolean(row.favorite),
    version: Number(row.version ?? 1),
    tags: tagRows
      .filter((tag) => String(tag.entry_id) === String(row.id))
      .map((tag) => tag.tag?.name)
      .filter((name): name is string => Boolean(name)),
    sections: sections
      .filter((section) => String(section.entry_id) === String(row.id))
      .map(
        (section): ReviewSection => ({
          id: String(section.id),
          kind: String(section.kind),
          content: String(section.content ?? ""),
          position: Number(section.position ?? 0),
        }),
      ),
    images: images
      .filter((image) => String(image.entry_id) === String(row.id))
      .map(
        (image): EntryImage => ({
          id: String(image.id),
          entryId: String(image.entry_id),
          fileName: String(image.file_name),
          contentType: String(image.content_type),
          size: Number(image.size),
          caption: String(image.caption ?? ""),
          position: Number(image.position ?? 0),
          url: `/api/images/${image.id}${shareToken ? `?share=${encodeURIComponent(shareToken)}` : ""}`,
        }),
      ),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  }));
}
