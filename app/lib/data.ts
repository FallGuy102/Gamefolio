import type { Entry, EntryImage, Game, ReviewSection } from "./types";
import { jsonArray, rawDatabase } from "./server";

type RawEntry = {
  id: string;
  type: "idea" | "review";
  title: string;
  body: string;
  game_id: string | null;
  design_theme: string | null;
  status: "draft" | "complete";
  favorite: number;
  version: number;
  created_at: string;
  updated_at: string;
};

export async function hydrateEntries(rows: RawEntry[], ownerEmail?: string): Promise<Entry[]> {
  if (!rows.length) return [];
  const db = rawDatabase();
  const ids = rows.map((row) => row.id);
  const placeholders = ids.map(() => "?").join(",");
  const ownerClause = ownerEmail ? " AND owner_email = ?" : "";
  const binds = ownerEmail ? [...ids, ownerEmail] : ids;

  const [sectionResult, tagResult, imageResult, gameResult] = await Promise.all([
    db
      .prepare(
        `SELECT id, entry_id, kind, content, position FROM entry_sections
         WHERE entry_id IN (${placeholders})${ownerClause} ORDER BY position`,
      )
      .bind(...binds)
      .all(),
    db
      .prepare(
        `SELECT et.entry_id, t.name FROM entry_tags et
         JOIN tags t ON t.id = et.tag_id
         WHERE et.entry_id IN (${placeholders}) ORDER BY t.name`,
      )
      .bind(...ids)
      .all(),
    db
      .prepare(
        `SELECT id, entry_id, file_name, content_type, size, caption, position
         FROM entry_images WHERE entry_id IN (${placeholders})${ownerClause} ORDER BY position`,
      )
      .bind(...binds)
      .all(),
    db
      .prepare(
        `SELECT DISTINCT g.* FROM games g JOIN entries e ON e.game_id = g.id
         WHERE e.id IN (${placeholders})`,
      )
      .bind(...ids)
      .all(),
  ]);

  const sections = sectionResult.results as unknown as Array<{
    id: string; entry_id: string; kind: string; content: string; position: number;
  }>;
  const tagRows = tagResult.results as unknown as Array<{ entry_id: string; name: string }>;
  const images = imageResult.results as unknown as Array<{
    id: string; entry_id: string; file_name: string; content_type: string; size: number; caption: string; position: number;
  }>;
  const games = new Map(
    (gameResult.results as unknown as Array<Record<string, unknown>>).map((game) => [
      String(game.id),
      mapGame(game),
    ]),
  );

  return rows.map((row) => ({
    id: row.id,
    type: row.type,
    title: row.title,
    body: row.body,
    gameId: row.game_id,
    game: row.game_id ? games.get(row.game_id) ?? null : null,
    designTheme: row.design_theme,
    status: row.status,
    favorite: Boolean(row.favorite),
    version: row.version,
    tags: tagRows.filter((tag) => tag.entry_id === row.id).map((tag) => tag.name),
    sections: sections
      .filter((section) => section.entry_id === row.id)
      .map((section): ReviewSection => ({
        id: section.id,
        kind: section.kind,
        content: section.content,
        position: section.position,
      })),
    images: images
      .filter((image) => image.entry_id === row.id)
      .map((image): EntryImage => ({
        id: image.id,
        entryId: image.entry_id,
        fileName: image.file_name,
        contentType: image.content_type,
        size: image.size,
        caption: image.caption,
        position: image.position,
        url: `/api/images/${image.id}`,
      })),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

export function mapGame(game: Record<string, unknown>): Game {
  return {
    id: String(game.id),
    igdbId: game.igdb_id == null ? null : Number(game.igdb_id),
    name: String(game.name),
    coverUrl: game.cover_url ? String(game.cover_url) : null,
    genres: jsonArray(game.genres_json),
    platforms: jsonArray(game.platforms_json),
    developer: game.developer ? String(game.developer) : null,
    isManual: Boolean(game.is_manual),
  };
}
