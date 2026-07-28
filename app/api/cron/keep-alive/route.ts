import type { NextRequest } from "next/server";
import { createAdminClient } from "@/app/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const authorization = request.headers.get("authorization");

  if (!cronSecret || authorization !== `Bearer ${cronSecret}`) {
    return Response.json(
      { ok: false, error: "Unauthorized" },
      {
        status: 401,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }

  try {
    const supabase = createAdminClient();
    const { error } = await supabase
      .from("profiles")
      .select("id", { count: "exact", head: true });

    if (error) {
      console.error("Supabase keep-alive failed:", error);
      return Response.json(
        { ok: false, error: "Database health check failed" },
        {
          status: 503,
          headers: { "Cache-Control": "no-store" },
        },
      );
    }

    return Response.json(
      {
        ok: true,
        database: "reachable",
        checkedAt: new Date().toISOString(),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("Supabase keep-alive failed:", error);
    return Response.json(
      { ok: false, error: "Database health check failed" },
      {
        status: 503,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }
}
