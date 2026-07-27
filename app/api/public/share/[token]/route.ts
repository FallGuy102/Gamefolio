import { hydrateEntries } from "@/app/lib/data";
import { sha256 } from "@/app/lib/server";
import { createAdminClient } from "@/app/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params;
  const admin = createAdminClient();
  const share = await admin
    .from("share_links")
    .select("entry_id")
    .eq("token_hash", await sha256(token))
    .is("revoked_at", null)
    .maybeSingle();
  if (!share.data) {
    return Response.json({ error: "分享不存在或已撤销" }, { status: 404 });
  }
  const result = await admin
    .from("entries")
    .select("*")
    .eq("id", share.data.entry_id)
    .maybeSingle();
  if (!result.data) {
    return Response.json({ error: "分享不存在或已撤销" }, { status: 404 });
  }
  const [entry] = await hydrateEntries(admin, [result.data], token);
  return Response.json({ entry });
}
