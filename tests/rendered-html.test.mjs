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
  assert.doesNotMatch(source, /codex-preview|Your site is taking shape/);
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
