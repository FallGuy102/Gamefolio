import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

const timestamps = {
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
};

export const profiles = sqliteTable("profiles", {
  email: text("email").primaryKey(),
  displayName: text("display_name"),
  theme: text("theme").notNull().default("system"),
  ...timestamps,
});

export const games = sqliteTable(
  "games",
  {
    id: text("id").primaryKey(),
    ownerEmail: text("owner_email").notNull(),
    igdbId: integer("igdb_id"),
    name: text("name").notNull(),
    coverUrl: text("cover_url"),
    genresJson: text("genres_json").notNull().default("[]"),
    platformsJson: text("platforms_json").notNull().default("[]"),
    developer: text("developer"),
    isManual: integer("is_manual", { mode: "boolean" }).notNull().default(false),
    ...timestamps,
  },
  (table) => [
    index("games_owner_idx").on(table.ownerEmail),
    uniqueIndex("games_owner_igdb_idx").on(table.ownerEmail, table.igdbId),
  ],
);

export const entries = sqliteTable(
  "entries",
  {
    id: text("id").primaryKey(),
    ownerEmail: text("owner_email").notNull(),
    type: text("type", { enum: ["idea", "review"] }).notNull(),
    title: text("title").notNull(),
    body: text("body").notNull().default(""),
    gameId: text("game_id").references(() => games.id, { onDelete: "set null" }),
    designTheme: text("design_theme"),
    status: text("status", { enum: ["draft", "complete"] }).notNull().default("draft"),
    favorite: integer("favorite", { mode: "boolean" }).notNull().default(false),
    version: integer("version").notNull().default(1),
    ...timestamps,
  },
  (table) => [
    index("entries_owner_updated_idx").on(table.ownerEmail, table.updatedAt),
    index("entries_owner_type_idx").on(table.ownerEmail, table.type),
    index("entries_game_idx").on(table.gameId),
  ],
);

export const entrySections = sqliteTable(
  "entry_sections",
  {
    id: text("id").primaryKey(),
    entryId: text("entry_id").notNull().references(() => entries.id, { onDelete: "cascade" }),
    ownerEmail: text("owner_email").notNull(),
    kind: text("kind").notNull(),
    content: text("content").notNull().default(""),
    position: integer("position").notNull().default(0),
  },
  (table) => [index("sections_entry_idx").on(table.entryId, table.position)],
);

export const tags = sqliteTable(
  "tags",
  {
    id: text("id").primaryKey(),
    ownerEmail: text("owner_email").notNull(),
    name: text("name").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [uniqueIndex("tags_owner_name_idx").on(table.ownerEmail, table.name)],
);

export const entryTags = sqliteTable(
  "entry_tags",
  {
    entryId: text("entry_id").notNull().references(() => entries.id, { onDelete: "cascade" }),
    tagId: text("tag_id").notNull().references(() => tags.id, { onDelete: "cascade" }),
  },
  (table) => [uniqueIndex("entry_tags_unique_idx").on(table.entryId, table.tagId)],
);

export const entryImages = sqliteTable(
  "entry_images",
  {
    id: text("id").primaryKey(),
    entryId: text("entry_id").notNull().references(() => entries.id, { onDelete: "cascade" }),
    ownerEmail: text("owner_email").notNull(),
    storageKey: text("storage_key").notNull(),
    fileName: text("file_name").notNull(),
    contentType: text("content_type").notNull(),
    size: integer("size").notNull(),
    width: integer("width"),
    height: integer("height"),
    caption: text("caption").notNull().default(""),
    position: integer("position").notNull().default(0),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [index("images_entry_idx").on(table.entryId, table.position)],
);

export const shareLinks = sqliteTable(
  "share_links",
  {
    id: text("id").primaryKey(),
    entryId: text("entry_id").notNull().references(() => entries.id, { onDelete: "cascade" }),
    ownerEmail: text("owner_email").notNull(),
    tokenHash: text("token_hash").notNull().unique(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    revokedAt: text("revoked_at"),
  },
  (table) => [index("shares_entry_idx").on(table.entryId)],
);
