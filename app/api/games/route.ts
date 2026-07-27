import { mapGame } from "@/app/lib/data";
import { cleanText, currentUserEmail, rawDatabase, unauthorized } from "@/app/lib/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const email = await currentUserEmail(request);
  if (!email) return unauthorized();
  const result = await rawDatabase()
    .prepare("SELECT * FROM games WHERE owner_email = ? ORDER BY updated_at DESC")
    .bind(email)
    .all();
  return Response.json({
    games: result.results.map((game: unknown) =>
      mapGame(game as Record<string, unknown>),
    ),
  });
}

export async function POST(request: Request) {
  const email = await currentUserEmail(request);
  if (!email) return unauthorized();
  const input = (await request.json()) as Record<string, unknown>;
  const name = cleanText(input.name, 160);
  if (!name) return Response.json({ error: "游戏名称不能为空" }, { status: 400 });
  const db = rawDatabase();
  const igdbId = input.igdbId == null ? null : Number(input.igdbId);
  if (igdbId) {
    const existing = await db
      .prepare("SELECT * FROM games WHERE owner_email = ? AND igdb_id = ?")
      .bind(email, igdbId)
      .first<Record<string, unknown>>();
    if (existing) return Response.json({ game: mapGame(existing) });
  }
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await db
    .prepare(
      `INSERT INTO games
       (id, owner_email, igdb_id, name, cover_url, genres_json, platforms_json, developer, is_manual, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      id,
      email,
      igdbId,
      name,
      cleanText(input.coverUrl, 500) || null,
      JSON.stringify(Array.isArray(input.genres) ? input.genres.slice(0, 12) : []),
      JSON.stringify(Array.isArray(input.platforms) ? input.platforms.slice(0, 12) : []),
      cleanText(input.developer, 160) || null,
      input.isManual === false ? 0 : 1,
      now,
      now,
    )
    .run();
  const game = await db.prepare("SELECT * FROM games WHERE id = ?").bind(id).first<Record<string, unknown>>();
  return Response.json({ game: game ? mapGame(game) : null }, { status: 201 });
}
