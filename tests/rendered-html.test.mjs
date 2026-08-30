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
  assert.match(source,/decodeAudioData/);
  assert.match(source,/新しい注文が入りました。注文内容を確認してください/);
  assert.match(source,/audioQueue\.current\.catch/);
  assert.match(source,/ANNOUNCEMENT_GAIN = 1\.2/);
  assert.match(source,/announcementActiveRef\.current/);
  assert.match(source,/setBgmVolume\(0\)/);
  assert.match(source,/source\.onended/);
});

test("呼出専用画面は管理画面と同じ2列カードで番号を重ねない",async()=>{
  const css=await readFile(new URL("../app/globals.css",import.meta.url),"utf8");
  assert.match(css,/呼出専用画面：管理画面の呼出モニターと同じ左右2列レイアウト/);
  assert.match(css,/\.display-only \.call-status-board\{[^}]*grid-template-columns:minmax\(0,\.9fr\) minmax\(0,1\.1fr\)/);
  assert.match(css,/\.display-only \.call-number-list,[^{]+\{[^}]*grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(css,/overflow-y:auto/);
});

test("呼出モニターは部門名を画面表示せず番号を中央表示する",async()=>{
  const source=await readFile(new URL("../app/kitchen-board.tsx",import.meta.url),"utf8");
  const css=await readFile(new URL("../app/globals.css",import.meta.url),"utf8");
  assert.doesNotMatch(source,/>F・フード</);
  assert.doesNotMatch(source,/>D・ドリンク</);
  assert.match(source,/aria-label=\{`\$\{item\.department/);
  assert.match(css,/\.display-only \.call-number-list>div\{[^}]*justify-content:center/);
});

test("PAYGATE POSの確定取引を共通注文へ同期する",async()=>{
  const smaregi=await readFile(new URL("../lib/smaregi.ts",import.meta.url),"utf8");
  const sync=await readFile(new URL("../lib/paygate-sync.ts",import.meta.url),"utf8");
  const units=await readFile(new URL("../app/api/v1/kitchen/units/route.ts",import.meta.url),"utf8");
  assert.match(smaregi,/pos\.transactions:read/);
  assert.match(smaregi,/with_details: "summary"/);
  assert.match(sync,/api\/v1\/kitchen\/pos-transactions/);
  assert.match(sync,/POLL_INTERVAL_MS = 8_000/);
  assert.match(units,/syncPaygateTransactions/);
});

test("決済完了後の確定計算では対象注文自身を混雑から除外する",async()=>{
  const route=await readFile(new URL("../app/api/v1/schedule/orders/[orderId]/route.ts",import.meta.url),"utf8");
  const store=await readFile(new URL("../lib/schedule-store.ts",import.meta.url),"utf8");
  assert.match(route,/liveKitchenLoad\(orderId\)/);
  assert.match(store,/unit\.orderId!==excludeOrderId/);
});

test("フライヤー標準を200℃4分で統一する",async()=>{
  const [board,master]=await Promise.all([
    readFile(new URL("../app/kitchen-board.tsx",import.meta.url),"utf8"),
    readFile(new URL("../app/cooking-master.tsx",import.meta.url),"utf8"),
  ]);
  assert.match(board,/200℃に到達/);
  assert.match(board,/200℃で4分/);
  assert.match(master,/揚げ物基本 200℃・4分/);
  assert.doesNotMatch(master,/180℃/);
});
