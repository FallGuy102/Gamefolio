import { hydrateEntries } from "@/app/lib/data";
import { isUuid, sha256 } from "@/app/lib/server";
import { createAdminClient } from "@/app/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params;
  const admin = createAdminClient();
  let shareQuery = admin
    .from("share_links")
    .select("entry_id")
    .is("revoked_at", null);
  shareQuery = isUuid(token)
    ? shareQuery.eq("id", token)
    : shareQuery.eq("token_hash", await sha256(token));
  const share = await shareQuery.maybeSingle();
  if (share.error) {
    console.error("Public share lookup failed", share.error);
    return Response.json({ error: "读取分享失败，请稍后重试" }, { status: 500 });
  }
  if (!share.data) {
    return Response.json({ error: "分享不存在或已撤销" }, { status: 404 });
  }
  const result = await admin
    .from("entries")
    .select("*")
    .eq("id", share.data.entry_id)
    .maybeSingle();
  if (result.error) {
    console.error("Shared entry lookup failed", result.error);
    return Response.json({ error: "读取分享失败，请稍后重试" }, { status: 500 });
  }
  if (!result.data) {
    return Response.json({ error: "分享不存在或已撤销" }, { status: 404 });
  }
  const [entry] = await hydrateEntries(admin, [result.data], token);
  return Response.json({ entry });
}
