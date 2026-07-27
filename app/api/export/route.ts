import { hydrateEntries, mapGame } from "@/app/lib/data";
import { currentUserEmail, rawDatabase, unauthorized } from "@/app/lib/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const email = await currentUserEmail(request);
  if (!email) return unauthorized();
  const db = rawDatabase();
  const [entryResult, gameResult] = await Promise.all([
    db.prepare("SELECT * FROM entries WHERE owner_email = ? ORDER BY updated_at DESC").bind(email).all(),
    db.prepare("SELECT * FROM games WHERE owner_email = ? ORDER BY name").bind(email).all(),
  ]);
  const entries = await hydrateEntries(entryResult.results as never[], email);
  const games = gameResult.results.map((game: unknown) =>
    mapGame(game as Record<string, unknown>),
  );
  return Response.json({
    formatVersion: 1,
    exportedAt: new Date().toISOString(),
    entries,
    games,
  });
}
