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
  assert.match(source, /history\.back\(\)/);
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
  assert.match(styles, /@media \(max-width: 767px\)/);
  assert.match(styles, /@media \(min-width: 1100px\)/);
  assert.match(entryPage, /initialView="detail"/);
  assert.match(packageJson, /"lucide-react"/);
  assert.match(packageJson, /"motion"/);
});

test("ships Supabase auth, RLS migration, PWA, and offline drafts", async () => {
  const [manifest, serviceWorker, source, migration, proxy] = await Promise.all([
    readFile(new URL("../app/manifest.ts", import.meta.url), "utf8"),
    readFile(new URL("../public/sw.js", import.meta.url), "utf8"),
    readFile(new URL("../app/StudioApp.tsx", import.meta.url), "utf8"),
    readFile(
      new URL("../supabase/migrations/20260728000000_initial_schema.sql", import.meta.url),
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
