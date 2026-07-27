import { currentUserEmail, rawDatabase, sha256, unauthorized } from "@/app/lib/server";

export const dynamic = "force-dynamic";

function randomToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes)).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

export async function POST(request: Request) {
  const email = await currentUserEmail(request);
  if (!email) return unauthorized();
  const input = (await request.json()) as { entryId?: string };
  if (!input.entryId) return Response.json({ error: "缺少条目" }, { status: 400 });
  const db = rawDatabase();
  const entry = await db
    .prepare("SELECT id FROM entries WHERE id = ? AND owner_email = ?")
    .bind(input.entryId, email)
    .first();
  if (!entry) return Response.json({ error: "条目不存在" }, { status: 404 });
  await db
    .prepare("UPDATE share_links SET revoked_at = ? WHERE entry_id = ? AND owner_email = ? AND revoked_at IS NULL")
    .bind(new Date().toISOString(), input.entryId, email)
    .run();
  const token = randomToken();
  await db
    .prepare(
      "INSERT INTO share_links (id, entry_id, owner_email, token_hash, created_at) VALUES (?, ?, ?, ?, ?)",
    )
    .bind(crypto.randomUUID(), input.entryId, email, await sha256(token), new Date().toISOString())
    .run();
  return Response.json({ token, path: `/s/${token}` }, { status: 201 });
}

export async function DELETE(request: Request) {
  const email = await currentUserEmail(request);
  if (!email) return unauthorized();
  const entryId = new URL(request.url).searchParams.get("entryId");
  if (!entryId) return Response.json({ error: "缺少条目" }, { status: 400 });
  await rawDatabase()
    .prepare("UPDATE share_links SET revoked_at = ? WHERE entry_id = ? AND owner_email = ? AND revoked_at IS NULL")
    .bind(new Date().toISOString(), entryId, email)
    .run();
  return Response.json({ ok: true });
}
