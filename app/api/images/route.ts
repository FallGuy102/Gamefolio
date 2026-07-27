import { currentUserEmail, rawDatabase, unauthorized, uploadsBucket } from "@/app/lib/server";

export const dynamic = "force-dynamic";

const MAX_IMAGE_BYTES = 15 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif", "image/heic", "image/heif"]);

export async function POST(request: Request) {
  const email = await currentUserEmail(request);
  if (!email) return unauthorized();
  const form = await request.formData();
  const file = form.get("file");
  const entryId = String(form.get("entryId") ?? "");
  if (!(file instanceof File) || !entryId) {
    return Response.json({ error: "缺少图片或条目" }, { status: 400 });
  }
  if (!ALLOWED_TYPES.has(file.type) || file.size > MAX_IMAGE_BYTES) {
    return Response.json({ error: "仅支持 15 MB 以内的常见图片格式" }, { status: 400 });
  }
  const db = rawDatabase();
  const owner = await db
    .prepare("SELECT id FROM entries WHERE id = ? AND owner_email = ?")
    .bind(entryId, email)
    .first();
  if (!owner) return Response.json({ error: "条目不存在" }, { status: 404 });
  const count = await db
    .prepare("SELECT COUNT(*) AS count FROM entry_images WHERE entry_id = ?")
    .bind(entryId)
    .first<{ count: number }>();
  if (Number(count?.count ?? 0) >= 10) {
    return Response.json({ error: "每个条目最多添加 10 张图片" }, { status: 400 });
  }

  const id = crypto.randomUUID();
  const safeName = file.name.replace(/[^\w.\-]+/g, "-").slice(-120) || "image";
  const storageKey = `${encodeURIComponent(email)}/${entryId}/${id}-${safeName}`;
  await uploadsBucket().put(storageKey, await file.arrayBuffer(), {
    httpMetadata: { contentType: file.type },
    customMetadata: { owner: email, entryId },
  });
  await db
    .prepare(
      `INSERT INTO entry_images
       (id, entry_id, owner_email, storage_key, file_name, content_type, size, caption, position)
       VALUES (?, ?, ?, ?, ?, ?, ?, '', ?)`,
    )
    .bind(id, entryId, email, storageKey, file.name, file.type, file.size, Number(count?.count ?? 0))
    .run();
  return Response.json(
    {
      image: {
        id,
        entryId,
        fileName: file.name,
        contentType: file.type,
        size: file.size,
        caption: "",
        position: Number(count?.count ?? 0),
        url: `/api/images/${id}`,
      },
    },
    { status: 201 },
  );
}
