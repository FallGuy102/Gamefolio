import { createAdminClient } from "@/app/lib/supabase/admin";
import { cleanText, requireUser, sha256 } from "@/app/lib/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const shareToken = new URL(request.url).searchParams.get("share");
  if (shareToken) {
    const admin = createAdminClient();
    const image = await admin.from("entry_images").select("*").eq("id", id).maybeSingle();
    if (!image.data) return new Response("Not found", { status: 404 });
    const share = await admin
      .from("share_links")
      .select("id")
      .eq("entry_id", image.data.entry_id)
      .eq("token_hash", await sha256(shareToken))
      .is("revoked_at", null)
      .maybeSingle();
    if (!share.data) return new Response("Forbidden", { status: 403 });
    return downloadImage(admin, image.data, true);
  }

  const { supabase, user } = await requireUser();
  if (!user) return new Response("Forbidden", { status: 403 });
  const image = await supabase.from("entry_images").select("*").eq("id", id).maybeSingle();
  if (!image.data) return new Response("Not found", { status: 404 });
  return downloadImage(supabase, image.data, false);
}

async function downloadImage(
  supabase: ReturnType<typeof createAdminClient>,
  image: Record<string, unknown>,
  shared: boolean,
) {
  const result = await supabase.storage
    .from("entry-images")
    .download(String(image.storage_path));
  if (result.error || !result.data) return new Response("Not found", { status: 404 });
  return new Response(result.data, {
    headers: {
      "Content-Type": String(image.content_type),
      "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(String(image.file_name))}`,
      "Cache-Control": shared ? "public, max-age=3600" : "private, max-age=300",
    },
  });
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { supabase, user, response } = await requireUser();
  if (response || !user) return response;
  const { id } = await context.params;
  const input = (await request.json()) as { caption?: string; position?: number };
  const result = await supabase
    .from("entry_images")
    .update({
      caption: cleanText(input.caption, 500),
      position: Math.max(0, Number(input.position ?? 0)),
    })
    .eq("id", id)
    .select("id");
  if (!result.data?.length) return Response.json({ error: "图片不存在" }, { status: 404 });
  return Response.json({ ok: true });
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { supabase, user, response } = await requireUser();
  if (response || !user) return response;
  const { id } = await context.params;
  const image = await supabase
    .from("entry_images")
    .select("storage_path")
    .eq("id", id)
    .maybeSingle();
  if (!image.data) return Response.json({ error: "图片不存在" }, { status: 404 });
  await supabase.storage.from("entry-images").remove([image.data.storage_path]);
  await supabase.from("entry_images").delete().eq("id", id);
  return new Response(null, { status: 204 });
}
