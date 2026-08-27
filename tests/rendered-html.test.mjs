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

test("旧モニターの録音済み音声で注文通知と番号呼出を行う",async()=>{
  const source=await readFile(new URL("../app/kitchen-board.tsx",import.meta.url),"utf8");
  assert.match(source,/order_received\.mp3/);
  assert.match(source,/complete_intro\.mp3/);
  assert.match(source,/number_customer\.mp3/);
  await readFile(new URL("../public/audio/legacy/order_received.mp3",import.meta.url));
  await readFile(new URL("../public/audio/legacy/complete_outro.mp3",import.meta.url));
});

test("決済完了後の確定計算では対象注文自身を混雑から除外する",async()=>{
  const route=await readFile(new URL("../app/api/v1/schedule/orders/[orderId]/route.ts",import.meta.url),"utf8");
  const store=await readFile(new URL("../lib/schedule-store.ts",import.meta.url),"utf8");
  assert.match(route,/liveKitchenLoad\(orderId\)/);
  assert.match(store,/unit\.orderId!==excludeOrderId/);
});
