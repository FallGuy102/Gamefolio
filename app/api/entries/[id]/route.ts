import { hydrateEntries } from "@/app/lib/data";
import { cleanText, currentUserEmail, rawDatabase, unauthorized, uploadsBucket } from "@/app/lib/server";
import type { EntryInput } from "@/app/lib/types";
import { replaceSectionsAndTags } from "../route";

export const dynamic = "force-dynamic";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const email = await currentUserEmail(request);
  if (!email) return unauthorized();
  const { id } = await context.params;
  const result = await rawDatabase()
    .prepare("SELECT * FROM entries WHERE id = ? AND owner_email = ?")
    .bind(id, email)
    .all();
  const [entry] = await hydrateEntries(result.results as never[], email);
  if (!entry) return Response.json({ error: "条目不存在" }, { status: 404 });
  return Response.json({ entry });
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const email = await currentUserEmail(request);
  if (!email) return unauthorized();
  const { id } = await context.params;
  const input = (await request.json()) as Partial<EntryInput>;
  const db = rawDatabase();
  const existing = await db
    .prepare("SELECT version FROM entries WHERE id = ? AND owner_email = ?")
    .bind(id, email)
    .first<{ version: number }>();
  if (!existing) return Response.json({ error: "条目不存在" }, { status: 404 });
  if (input.version && Number(input.version) !== Number(existing.version)) {
    const result = await db
      .prepare("SELECT * FROM entries WHERE id = ? AND owner_email = ?")
      .bind(id, email)
      .all();
    const [serverEntry] = await hydrateEntries(result.results as never[], email);
    return Response.json(
      { error: "这条内容已在另一台设备上更新", conflict: true, serverEntry },
      { status: 409 },
    );
  }

  const now = new Date().toISOString();
  await db
    .prepare(
      `UPDATE entries SET type = ?, title = ?, body = ?, game_id = ?, design_theme = ?,
       status = ?, favorite = ?, version = version + 1, updated_at = ?
       WHERE id = ? AND owner_email = ?`,
    )
    .bind(
      input.type === "review" ? "review" : "idea",
      cleanText(input.title, 160) || "未命名灵感",
      cleanText(input.body, 30000),
      input.gameId || null,
      cleanText(input.designTheme, 80) || null,
      input.status === "complete" ? "complete" : "draft",
      input.favorite ? 1 : 0,
      now,
      id,
      email,
    )
    .run();
  await replaceSectionsAndTags(id, email, input.sections ?? [], input.tags ?? []);
  const result = await db
    .prepare("SELECT * FROM entries WHERE id = ? AND owner_email = ?")
    .bind(id, email)
    .all();
  const [entry] = await hydrateEntries(result.results as never[], email);
  return Response.json({ entry });
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const email = await currentUserEmail(request);
  if (!email) return unauthorized();
  const { id } = await context.params;
  const db = rawDatabase();
  const images = await db
    .prepare("SELECT storage_key FROM entry_images WHERE entry_id = ? AND owner_email = ?")
    .bind(id, email)
    .all<{ storage_key: string }>();
  await Promise.all(
    images.results.map((image: { storage_key: string }) =>
      uploadsBucket().delete(image.storage_key),
    ),
  );
  const result = await db
    .prepare("DELETE FROM entries WHERE id = ? AND owner_email = ?")
    .bind(id, email)
    .run();
  if (!result.meta.changes) return Response.json({ error: "条目不存在" }, { status: 404 });
  return new Response(null, { status: 204 });
}
