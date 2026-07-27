import { requireUser } from "@/app/lib/server";

export const dynamic = "force-dynamic";

const MAX_IMAGE_BYTES = 15 * 1024 * 1024;
const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/heic",
  "image/heif",
]);

export async function POST(request: Request) {
  const { supabase, user, response } = await requireUser();
  if (response || !user) return response;
  const form = await request.formData();
  const file = form.get("file");
  const entryId = String(form.get("entryId") ?? "");
  if (!(file instanceof File) || !entryId) {
    return Response.json({ error: "缺少图片或条目" }, { status: 400 });
  }
  if (!ALLOWED_TYPES.has(file.type) || file.size > MAX_IMAGE_BYTES) {
    return Response.json({ error: "仅支持 15 MB 以内的常见图片格式" }, { status: 400 });
  }
  const entry = await supabase.from("entries").select("id").eq("id", entryId).maybeSingle();
  if (!entry.data) return Response.json({ error: "条目不存在" }, { status: 404 });
  const count = await supabase
    .from("entry_images")
    .select("id", { count: "exact", head: true })
    .eq("entry_id", entryId);
  if ((count.count ?? 0) >= 10) {
    return Response.json({ error: "每个条目最多添加 10 张图片" }, { status: 400 });
  }

  const id = crypto.randomUUID();
  const safeName = file.name.replace(/[^\w.\-]+/g, "-").slice(-120) || "image";
  const storagePath = `${user.id}/${entryId}/${id}-${safeName}`;
  const upload = await supabase.storage
    .from("entry-images")
    .upload(storagePath, file, { contentType: file.type, upsert: false });
  if (upload.error) return Response.json({ error: "图片上传失败" }, { status: 500 });
  const inserted = await supabase.from("entry_images").insert({
    id,
    entry_id: entryId,
    user_id: user.id,
    storage_path: storagePath,
    file_name: file.name,
    content_type: file.type,
    size: file.size,
    caption: "",
    position: count.count ?? 0,
  });
  if (inserted.error) {
    await supabase.storage.from("entry-images").remove([storagePath]);
    return Response.json({ error: "图片信息保存失败" }, { status: 500 });
  }
  return Response.json(
    {
      image: {
        id,
        entryId,
        fileName: file.name,
        contentType: file.type,
        size: file.size,
        caption: "",
        position: count.count ?? 0,
        url: `/api/images/${id}`,
      },
    },
    { status: 201 },
  );
}
