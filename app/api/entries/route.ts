import { hydrateEntries } from "@/app/lib/data";
import { cleanText, currentUserEmail, rawDatabase, unauthorized } from "@/app/lib/server";
import type { EntryInput, ReviewSection } from "@/app/lib/types";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const email = await currentUserEmail(request);
  if (!email) return unauthorized();

  const url = new URL(request.url);
  const query = cleanText(url.searchParams.get("q"), 120);
  const type = url.searchParams.get("type");
  const favorite = url.searchParams.get("favorite");
  const gameId = url.searchParams.get("gameId");
  const where = ["e.owner_email = ?"];
  const values: unknown[] = [email];

  if (query) {
    where.push("(e.title LIKE ? OR e.body LIKE ? OR e.design_theme LIKE ?)");
    const like = `%${query}%`;
    values.push(like, like, like);
  }
  if (type === "idea" || type === "review") {
    where.push("e.type = ?");
    values.push(type);
  }
  if (favorite === "true") {
    where.push("e.favorite = 1");
  }
  if (gameId) {
    where.push("e.game_id = ?");
    values.push(gameId);
  }

  const result = await rawDatabase()
    .prepare(
      `SELECT e.* FROM entries e WHERE ${where.join(" AND ")}
       ORDER BY e.updated_at DESC LIMIT 200`,
    )
    .bind(...values)
    .all();
  const entries = await hydrateEntries(result.results as never[], email);
  return Response.json({ entries });
}

export async function POST(request: Request) {
  const email = await currentUserEmail(request);
  if (!email) return unauthorized();
  const input = (await request.json()) as Partial<EntryInput>;
  const title = cleanText(input.title, 160);
  const body = cleanText(input.body, 30000);
  const type = input.type === "review" ? "review" : "idea";
  if (!title && !body) {
    return Response.json({ error: "请至少填写标题或正文" }, { status: 400 });
  }

  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const db = rawDatabase();
  await db
    .prepare(
      `INSERT INTO entries
       (id, owner_email, type, title, body, game_id, design_theme, status, favorite, version, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
    )
    .bind(
      id,
      email,
      type,
      title || body.slice(0, 28) || "未命名灵感",
      body,
      input.gameId || null,
      cleanText(input.designTheme, 80) || null,
      input.status === "complete" ? "complete" : "draft",
      input.favorite ? 1 : 0,
      now,
      now,
    )
    .run();

  await replaceSectionsAndTags(id, email, input.sections ?? [], input.tags ?? []);
  const result = await db
    .prepare("SELECT * FROM entries WHERE id = ? AND owner_email = ?")
    .bind(id, email)
    .all();
  const [entry] = await hydrateEntries(result.results as never[], email);
  return Response.json({ entry }, { status: 201 });
}

export async function replaceSectionsAndTags(
  entryId: string,
  email: string,
  sections: ReviewSection[],
  tags: string[],
) {
  const db = rawDatabase();
  await db.batch([
    db.prepare("DELETE FROM entry_sections WHERE entry_id = ? AND owner_email = ?").bind(entryId, email),
    db.prepare("DELETE FROM entry_tags WHERE entry_id = ?").bind(entryId),
  ]);

  const sectionStatements = sections
    .filter((section) => cleanText(section.content))
    .map((section, index) =>
      db
        .prepare(
          "INSERT INTO entry_sections (id, entry_id, owner_email, kind, content, position) VALUES (?, ?, ?, ?, ?, ?)",
        )
        .bind(
          crypto.randomUUID(),
          entryId,
          email,
          cleanText(section.kind, 40) || "note",
          cleanText(section.content, 15000),
          index,
        ),
    );
  if (sectionStatements.length) await db.batch(sectionStatements);

  for (const rawTag of tags.slice(0, 20)) {
    const name = cleanText(rawTag, 32).replace(/^#/, "");
    if (!name) continue;
    await db
      .prepare("INSERT OR IGNORE INTO tags (id, owner_email, name) VALUES (?, ?, ?)")
      .bind(crypto.randomUUID(), email, name)
      .run();
    const tag = await db
      .prepare("SELECT id FROM tags WHERE owner_email = ? AND name = ?")
      .bind(email, name)
      .first<{ id: string }>();
    if (tag) {
      await db
        .prepare("INSERT OR IGNORE INTO entry_tags (entry_id, tag_id) VALUES (?, ?)")
        .bind(entryId, tag.id)
        .run();
    }
  }
}
