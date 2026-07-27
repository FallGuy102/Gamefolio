import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

test("build contains the complete Gamefolio application shell", async () => {
  const [source] = await Promise.all([
    readFile(new URL("../app/StudioApp.tsx", import.meta.url), "utf8"),
    access(new URL("../dist/server/index.js", import.meta.url)),
  ]);
  assert.match(source, /Gamefolio/);
  assert.match(source, /游戏设计灵感库/);
  assert.match(source, /今天捕捉到了什么/);
  assert.doesNotMatch(source, /codex-preview|Your site is taking shape/);
});

test("ships the requested PWA and dynamic routes", async () => {
  const [manifest, serviceWorker, source] = await Promise.all([
    readFile(new URL("../app/manifest.ts", import.meta.url), "utf8"),
    readFile(new URL("../public/sw.js", import.meta.url), "utf8"),
    readFile(new URL("../app/StudioApp.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(manifest, /display:\s*"standalone"/);
  assert.match(serviceWorker, /gamefolio-v1/);
  assert.match(source, /IndexedDB|saveOfflineDraft/);
  assert.match(source, /只读分享链接/);
  assert.match(source, /导出 ZIP/);
});
