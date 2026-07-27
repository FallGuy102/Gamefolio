import { cleanText, currentUserEmail, rawDatabase, sha256, unauthorized, uploadsBucket } from "@/app/lib/server";

export const dynamic = "force-dynamic";

type ImageRow = {
  id: string;
  entry_id: string;
  owner_email: string;
  storage_key: string;
  file_name: string;
  content_type: string;
  caption: string;
  position: number;
};

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const db = rawDatabase();
  const image = await db.prepare("SELECT * FROM entry_images WHERE id = ?").bind(id).first<ImageRow>();
  if (!image) return new Response("Not found", { status: 404 });

  const shareToken = new URL(request.url).searchParams.get("share");
  let allowed = false;
  if (shareToken) {
    const tokenHash = await sha256(shareToken);
    const share = await db
      .prepare(
        `SELECT sl.id FROM share_links sl
         WHERE sl.entry_id = ? AND sl.token_hash = ? AND sl.revoked_at IS NULL`,
      )
      .bind(image.entry_id, tokenHash)
      .first();
    allowed = Boolean(share);
  } else {
    const email = await currentUserEmail(request);
    allowed = Boolean(email && email === image.owner_email);
  }
  if (!allowed) return new Response("Forbidden", { status: 403 });

  const object = await uploadsBucket().get(image.storage_key);
  if (!object) return new Response("Not found", { status: 404 });
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("Cache-Control", shareToken ? "public, max-age=3600" : "private, max-age=300");
  headers.set("Content-Disposition", `inline; filename*=UTF-8''${encodeURIComponent(image.file_name)}`);
  return new Response(object.body, { headers });
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const email = await currentUserEmail(request);
  if (!email) return unauthorized();
  const { id } = await context.params;
  const input = (await request.json()) as { caption?: string; position?: number };
  const result = await rawDatabase()
    .prepare(
      `UPDATE entry_images SET caption = ?, position = ?
       WHERE id = ? AND owner_email = ?`,
    )
    .bind(cleanText(input.caption, 500), Math.max(0, Number(input.position ?? 0)), id, email)
    .run();
  if (!result.meta.changes) return Response.json({ error: "图片不存在" }, { status: 404 });
  return Response.json({ ok: true });
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const email = await currentUserEmail(request);
  if (!email) return unauthorized();
  const { id } = await context.params;
  const image = await rawDatabase()
    .prepare("SELECT storage_key FROM entry_images WHERE id = ? AND owner_email = ?")
    .bind(id, email)
    .first<{ storage_key: string }>();
  if (!image) return Response.json({ error: "图片不存在" }, { status: 404 });
  await uploadsBucket().delete(image.storage_key);
  await rawDatabase()
    .prepare("DELETE FROM entry_images WHERE id = ? AND owner_email = ?")
    .bind(id, email)
    .run();
  return new Response(null, { status: 204 });
}
