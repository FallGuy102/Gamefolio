import { cleanText, requireUser } from "@/app/lib/server";

export const dynamic = "force-dynamic";

const fallbackGames = [
  { igdbId: null, name: "塞尔达传说：王国之泪", genres: ["冒险", "动作"], platforms: ["Nintendo Switch"] },
  { igdbId: null, name: "艾尔登法环", genres: ["动作角色扮演"], platforms: ["PC", "PlayStation", "Xbox"] },
  { igdbId: null, name: "空洞骑士", genres: ["类银河战士恶魔城"], platforms: ["PC", "主机"] },
  { igdbId: null, name: "极乐迪斯科", genres: ["角色扮演", "叙事"], platforms: ["PC", "主机"] },
];

export async function GET(request: Request) {
  const { user, response } = await requireUser();
  if (response || !user) return response;
  const query = cleanText(new URL(request.url).searchParams.get("q"), 80);
  if (!query) return Response.json({ games: [] });

  const clientId = process.env.IGDB_CLIENT_ID;
  const clientSecret = process.env.IGDB_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return Response.json({
      games: fallbackGames.filter((game) => game.name.toLowerCase().includes(query.toLowerCase())),
      source: "fallback",
    });
  }

  try {
    const tokenResponse = await fetch(
      `https://id.twitch.tv/oauth2/token?client_id=${encodeURIComponent(clientId)}&client_secret=${encodeURIComponent(clientSecret)}&grant_type=client_credentials`,
      { method: "POST" },
    );
    if (!tokenResponse.ok) throw new Error("IGDB token request failed");
    const token = (await tokenResponse.json()) as { access_token: string };
    const response = await fetch("https://api.igdb.com/v4/games", {
      method: "POST",
      headers: {
        "Client-ID": clientId,
        Authorization: `Bearer ${token.access_token}`,
        "Content-Type": "text/plain",
      },
      body: `search "${query.replaceAll('"', "")}"; fields name,cover.image_id,genres.name,platforms.name,involved_companies.company.name,involved_companies.developer; limit 8;`,
    });
    if (!response.ok) throw new Error("IGDB search failed");
    const records = (await response.json()) as Array<Record<string, unknown>>;
    const games = records.map((record) => {
      const cover = record.cover as { image_id?: string } | undefined;
      const companies = (record.involved_companies ?? []) as Array<{ developer?: boolean; company?: { name?: string } }>;
      return {
        igdbId: Number(record.id),
        name: String(record.name),
        coverUrl: cover?.image_id ? `https://images.igdb.com/igdb/image/upload/t_cover_big/${cover.image_id}.jpg` : null,
        genres: ((record.genres ?? []) as Array<{ name?: string }>).map((item) => item.name).filter(Boolean),
        platforms: ((record.platforms ?? []) as Array<{ name?: string }>).map((item) => item.name).filter(Boolean),
        developer: companies.find((item) => item.developer)?.company?.name ?? null,
      };
    });
    return Response.json({ games, source: "igdb" });
  } catch {
    return Response.json({ games: [], source: "unavailable" });
  }
}
