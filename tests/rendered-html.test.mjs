import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(new Request("http://localhost/", { headers: { accept: "text/html" } }), {
    ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) },
  }, { waitUntil() {}, passThroughOnException() {} });
}

test("キッチンモニターをサーバーレンダリングする", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /Kitchen Monitor \| COMPASSION WORLD/);
  assert.match(html, /AOZORA KITCHEN/);
  assert.match(html, /認証を確認しています/);
  assert.doesNotMatch(html, /codex-preview/);
  assert.doesNotMatch(html, /react-loading-skeleton/);
});

test("ちょこっとライスを150gとして調理指示する",async()=>{
  const source=await readFile(new URL("../app/kitchen-board.tsx",import.meta.url),"utf8");
  assert.match(source,/ちょこっとライス\|少なめ\|150g/);
  assert.match(source,/riceGrams\(names\(unit\),unit\.items\[0\]\?\.options\)/);
});
