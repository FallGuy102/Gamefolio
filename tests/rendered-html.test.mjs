import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

test("build contains the complete Gamefolio application shell", async () => {
  const [source] = await Promise.all([
    readFile(new URL("../app/StudioApp.tsx", import.meta.url), "utf8"),
    access(new URL("../.next/BUILD_ID", import.meta.url)),
  ]);
  assert.match(source, /Gamefolio/);
  assert.match(source, /游戏设计灵感库/);
  assert.match(source, /今天捕捉到了什么/);
  assert.match(source, /type View = "home" \| "library" \| "detail" \| "editor"/);
  assert.match(source, /ComposeSheet/);
  assert.match(source, /PwaEdgeBack/);
  assert.match(source, /const returnToLibrary = \(\) =>/);
  assert.match(
    source,
    /navigate\("library", \{[\s\S]{0,180}direction:\s*-1,[\s\S]{0,100}transition:\s*"stack"/,
  );
  assert.doesNotMatch(source, /codex-preview|Your site is taking shape/);
});

test("ships the adaptive Apple visual system and accessible fallbacks", async () => {
  const [styles, entryPage, packageJson] = await Promise.all([
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../app/entries/[id]/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
  ]);
  assert.match(styles, /--accent:\s*#007aff/i);
  assert.match(styles, /prefers-reduced-transparency/);
  assert.match(styles, /prefers-contrast:\s*more/);
  assert.match(styles, /scrollbar-gutter:\s*stable/);
  assert.match(styles, /\.view-stage[\s\S]*overflow-x:\s*clip/);
  assert.match(styles, /@media \(max-width: 767px\)/);
  assert.match(styles, /@media \(min-width: 1100px\)/);
  assert.match(entryPage, /initialView="detail"/);
  assert.match(packageJson, /"lucide-react"/);
  assert.match(packageJson, /"motion"/);
  assert.match(
    await readFile(new URL("../app/StudioApp.tsx", import.meta.url), "utf8"),
    /custom=\{viewTransition\}/,
  );
  assert.match(
    await readFile(new URL("../app/StudioApp.tsx", import.meta.url), "utf8"),
    /viewTransitionVariants/,
  );
  assert.match(
    await readFile(new URL("../app/StudioApp.tsx", import.meta.url), "utf8"),
    /x:\s*"100%"/,
  );
  assert.match(
    await readFile(new URL("../app/StudioApp.tsx", import.meta.url), "utf8"),
    /transition:\s*"stack"/,
  );
  assert.match(
    await readFile(new URL("../app/StudioApp.tsx", import.meta.url), "utf8"),
    /key=\{editorSessionKey\}/,
  );
  assert.match(
    await readFile(new URL("../app/StudioApp.tsx", import.meta.url), "utf8"),
    /\? "entry-workspace"/,
  );
  assert.match(
    await readFile(new URL("../app/StudioApp.tsx", import.meta.url), "utf8"),
    /className="detail-content-stage"[\s\S]{0,120}key=\{editorSessionKey\}/,
  );
  assert.match(
    await readFile(new URL("../app/StudioApp.tsx", import.meta.url), "utf8"),
    /editorSessionKey !== "new"/,
  );
  assert.match(styles, /\.library-workspace\.has-collection/);
  assert.match(
    styles,
    /\.detail-pane \.editor-header[\s\S]{0,260}border-radius:\s*14px/,
  );
});

test("ships Supabase auth, RLS migration, PWA, and offline drafts", async () => {
  const [
    manifest,
    serviceWorker,
    source,
    migration,
    serviceGrant,
    starterMigration,
    proxy,
  ] = await Promise.all([
    readFile(new URL("../app/manifest.ts", import.meta.url), "utf8"),
    readFile(new URL("../public/sw.js", import.meta.url), "utf8"),
    readFile(new URL("../app/StudioApp.tsx", import.meta.url), "utf8"),
    readFile(
      new URL("../supabase/migrations/20260728000000_initial_schema.sql", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL(
        "../supabase/migrations/20260729010000_grant_service_role_reads.sql",
        import.meta.url,
      ),
      "utf8",
    ),
    readFile(
      new URL(
        "../supabase/migrations/20260729020000_seed_starter_entries.sql",
        import.meta.url,
      ),
      "utf8",
    ),
    readFile(new URL("../proxy.ts", import.meta.url), "utf8"),
  ]);
  assert.match(manifest, /display:\s*"standalone"/);
  assert.match(serviceWorker, /gamefolio-v1/);
  assert.match(source, /IndexedDB|saveOfflineDraft/);
  assert.match(source, /saveQueueRef/);
  assert.match(migration, /enable row level security/i);
  assert.match(migration, /entry-images/);
  assert.match(migration, /to service_role/i);
  assert.match(serviceGrant, /public\.share_links/);
  assert.match(serviceGrant, /public\.entry_images/);
  assert.match(starterMigration, /starter_content_seeded_at/);
  assert.match(starterMigration, /让失败成为地图的一部分/);
  assert.match(starterMigration, /《空洞骑士》的探索节奏/);
  assert.match(starterMigration, /perform public\.seed_gamefolio_starter_content/);
  assert.match(starterMigration, /starter_tag_id uuid/);
  assert.doesNotMatch(starterMigration, /^\s+tag_id uuid;/m);
  assert.doesNotMatch(source, /sampleEntries|sample-/);
  assert.match(source, /setEntries\(entryData\.entries\)/);
  assert.match(proxy, /updateSession/);
});

test("reuses active share links until the user explicitly revokes them", async () => {
  const [shareRoute, publicRoute, imageRoute, server, source] = await Promise.all([
    readFile(new URL("../app/api/shares/route.ts", import.meta.url), "utf8"),
    readFile(
      new URL("../app/api/public/share/[token]/route.ts", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL("../app/api/images/[id]/route.ts", import.meta.url),
      "utf8",
    ),
    readFile(new URL("../app/lib/server.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/StudioApp.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(shareRoute, /if \(active\.data\)/);
  assert.match(shareRoute, /status:\s*200/);
  assert.match(shareRoute, /path:\s*`\/s\/\$\{active\.data\.id\}`/);
  assert.match(publicRoute, /isUuid\(token\)/);
  assert.match(publicRoute, /token_hash/);
  assert.match(imageRoute, /isUuid\(shareToken\)/);
  assert.match(server, /export function isUuid/);
  assert.match(source, /重新生成链接/);
});

test("keeps entry versions synchronized and stops repeated conflict saves", async () => {
  const source = await readFile(
    new URL("../app/StudioApp.tsx", import.meta.url),
    "utf8",
  );
  assert.match(source, /item\.id === result\.entry\.id \? result\.entry : item/);
  assert.match(source, /draft\.key\.startsWith\("conflict:"\)/);
  assert.match(source, /conflictRef\.current = true/);
  assert.match(source, /if \(conflictRef\.current\)/);
});

test("uses dark-mode-safe classification controls instead of a native theme select", async () => {
  const [source, styles] = await Promise.all([
    readFile(new URL("../app/StudioApp.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

  assert.match(source, /className="classification-panel"/);
  assert.match(source, /designThemes\.map/);
  assert.match(source, /aria-pressed=\{draft\.designTheme === theme\}/);
  assert.doesNotMatch(source, /value=\{draft\.designTheme/);
  assert.match(styles, /\.classification-panel/);
  assert.match(styles, /\.theme-option\.selected/);
});

test("defaults new entries to complete and keeps library quick filters functional", async () => {
  const [source, styles] = await Promise.all([
    readFile(new URL("../app/StudioApp.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

  assert.match(
    source,
    /const emptyInput[\s\S]{0,400}status:\s*"complete"/,
  );
  assert.match(source, /`\/library\?filter=\$\{filter\}`/);
  assert.match(source, /navigate\("library", \{ filter: "idea"/);
  assert.match(source, /navigate\("library", \{ filter: "review"/);
  assert.match(source, /filter:\s*"favorite"/);
  assert.match(source, /className="status-slider"/);
  assert.match(source, /layoutId="entry-status-slider"/);
  assert.match(
    source,
    /status === "complete"[\s\S]{0,900}已完成[\s\S]{0,900}status === "draft"/,
  );
  assert.doesNotMatch(source, /value=\{draft\.status\}/);
  assert.match(styles, /\.status-slider-thumb/);
  assert.match(styles, /\.status-slider button\.selected/);
  assert.match(styles, /\.sidebar-section button\.selected/);
});
