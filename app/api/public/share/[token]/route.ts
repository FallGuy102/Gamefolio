import { hydrateEntries } from "@/app/lib/data";
import { rawDatabase, sha256 } from "@/app/lib/server";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params;
  const tokenHash = await sha256(token);
  const db = rawDatabase();
  const result = await db
    .prepare(
      `SELECT e.* FROM entries e JOIN share_links sl ON sl.entry_id = e.id
       WHERE sl.token_hash = ? AND sl.revoked_at IS NULL LIMIT 1`,
    )
    .bind(tokenHash)
    .all();
  const [entry] = await hydrateEntries(result.results as never[]);
  if (!entry) return Response.json({ error: "分享不存在或已撤销" }, { status: 404 });
  entry.images = entry.images.map((image) => ({
    ...image,
    url: `/api/images/${image.id}?share=${encodeURIComponent(token)}`,
  }));
  return Response.json({ entry });
}
