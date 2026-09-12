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

test("商品ごとのトッピングを共通メニューとして編集・配信する",async()=>{
  const [view,management,publicApi,schema,catalog]=await Promise.all([
    readFile(new URL("../app/menu-manager.tsx",import.meta.url),"utf8"),
    readFile(new URL("../app/api/v1/kitchen/menu-options/route.ts",import.meta.url),"utf8"),
    readFile(new URL("../app/api/v1/menu/options/route.ts",import.meta.url),"utf8"),
    readFile(new URL("../db/schema.ts",import.meta.url),"utf8"),
    readFile(new URL("../app/api/v1/smaregi/catalog/route.ts",import.meta.url),"utf8"),
  ]);
  assert.match(view,/トッピング・オプション/);
  assert.match(view,/追加料金（税込）/);
  assert.match(view,/最大選択数/);
  assert.match(view,/preparationMinutesDelta/);
  assert.match(management,/replaceMenuOptionGroups/);
  assert.match(publicApi,/requireScheduleToken/);
  assert.match(schema,/menu_option_groups/);
  assert.match(schema,/menu_option_choices/);
  assert.match(catalog,/optionsByCode/);
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

test("呼出ボタンを押した瞬間に音声を準備して5秒後の放送へ引き継ぐ",async()=>{
  const board=await readFile(new URL("../app/kitchen-board.tsx",import.meta.url),"utf8");
  assert.match(board,/async function prepareCallAudio/);
  assert.match(board,/await getLegacyVoiceContext\(\);warmUpLegacyVoice\(\)/);
  assert.match(board,/action==="CALL"\?prepareCallAudio\(\):Promise\.resolve\(\)/);
  assert.match(board,/audioPreparation\.then\(\(\)=>act\(item,action\)\)/);
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
  assert.match(smaregi,/replace\(\/\\\.\\d\{3\}Z\$\/, "\+00:00"\)/);
  assert.match(sync,/api\/v1\/kitchen\/pos-transactions/);
  assert.match(sync,/POLL_INTERVAL_MS = 8_000/);
  assert.match(sync,/paygate_sync_audits/);
  assert.match(sync,/status, result/);
  assert.match(sync,/runSync\(force\)/);
  assert.match(units,/syncPaygateTransactions/);
});

test("最短工程の完了状態を共通DBへ保存して全端末で復元する",async()=>{
  const [board,route,schema]=await Promise.all([
    readFile(new URL("../app/kitchen-board.tsx",import.meta.url),"utf8"),
    readFile(new URL("../app/api/v1/kitchen/task-progress/route.ts",import.meta.url),"utf8"),
    readFile(new URL("../db/schema.ts",import.meta.url),"utf8"),
  ]);
  assert.match(board,/api\/v1\/kitchen\/task-progress/);
  assert.match(board,/工程の完了状況と実作業時間は全端末で共有/);
  assert.match(route,/hasSiteSessionRequest/);
  assert.match(route,/ON CONFLICT\(task_id\) DO UPDATE/);
  assert.match(schema,/kitchen_task_progress/);
});

test("工程完了ログから当日の遅延工程を確認できる",async()=>{
  const [board,progress,analytics,schema]=await Promise.all([
    readFile(new URL("../app/kitchen-board.tsx",import.meta.url),"utf8"),
    readFile(new URL("../app/api/v1/kitchen/task-progress/route.ts",import.meta.url),"utf8"),
    readFile(new URL("../app/api/v1/kitchen/task-analytics/route.ts",import.meta.url),"utf8"),
    readFile(new URL("../db/schema.ts",import.meta.url),"utf8"),
  ]);
  assert.match(board,/工程実績/);
  assert.match(progress,/kitchen_task_events/);
  assert.match(progress,/expectedMinutes/);
  assert.match(analytics,/overrunSeconds/);
  assert.match(analytics,/startOfTodayJst/);
  assert.match(schema,/idx_kitchen_task_events_created/);
});

test("同じ工程の実績を集計して調理時間の見直し候補を出す",async()=>{
  const [view,analytics,styles]=await Promise.all([
    readFile(new URL("../app/task-analytics.tsx",import.meta.url),"utf8"),
    readFile(new URL("../app/api/v1/kitchen/task-analytics/route.ts",import.meta.url),"utf8"),
    readFile(new URL("../app/globals.css",import.meta.url),"utf8"),
  ]);
  assert.match(analytics,/bottlenecks/);
  assert.match(analytics,/suggestedMinutes/);
  assert.match(analytics,/directSamples>=3/);
  assert.match(view,/時間がかかりやすい工程/);
  assert.match(view,/見積りへ＋.*分を反映/);
  assert.match(view,/直接計測3回以上の候補/);
  assert.match(styles,/bottleneck-board/);
});

test("直接計測3回以上の改善候補を確認後に安全余裕へ反映する",async()=>{
  const [board,view,analytics,settings,estimate,engine,schema]=await Promise.all([
    readFile(new URL("../app/kitchen-board.tsx",import.meta.url),"utf8"),
    readFile(new URL("../app/task-analytics.tsx",import.meta.url),"utf8"),
    readFile(new URL("../app/api/v1/kitchen/task-analytics/route.ts",import.meta.url),"utf8"),
    readFile(new URL("../app/api/v1/kitchen/timing-adjustments/route.ts",import.meta.url),"utf8"),
    readFile(new URL("../app/api/v1/schedule/estimate/route.ts",import.meta.url),"utf8"),
    readFile(new URL("../lib/schedule-engine.ts",import.meta.url),"utf8"),
    readFile(new URL("../db/schema.ts",import.meta.url),"utf8"),
  ]);
  assert.match(view,/window\.confirm/);
  assert.match(view,/直接計測3回で反映可能/);
  assert.match(settings,/sampleCount<3/);
  assert.match(settings,/ON CONFLICT\(adjustment_key\)/);
  assert.match(analytics,/suggestedBufferMinutes/);
  assert.match(estimate,/timingAdjustmentBuffers/);
  assert.match(engine,/timingBuffers/);
  assert.match(board,/applyTimingBuffers/);
  assert.match(board,/実績に基づく安全余裕/);
  assert.match(schema,/kitchen_timing_adjustments/);
});

test("いまやる作業の表示から完了までを直接計測する",async()=>{
  const [board,progress,analytics,schema]=await Promise.all([
    readFile(new URL("../app/kitchen-board.tsx",import.meta.url),"utf8"),
    readFile(new URL("../app/api/v1/kitchen/task-progress/route.ts",import.meta.url),"utf8"),
    readFile(new URL("../app/api/v1/kitchen/task-analytics/route.ts",import.meta.url),"utf8"),
    readFile(new URL("../db/schema.ts",import.meta.url),"utf8"),
  ]);
  assert.match(board,/method:\"POST\"/);
  assert.match(board,/時間計測中/);
  assert.match(progress,/INSERT OR IGNORE INTO kitchen_task_starts/);
  assert.match(progress,/DELETE FROM kitchen_task_starts WHERE task_id=/);
  assert.match(analytics,/durationSeconds/);
  assert.match(analytics,/measurementSource/);
  assert.match(schema,/idx_kitchen_task_starts_started/);
});

test("最終工程の完了時に商品を自動で完成へ進め、予定時刻前でも呼び出せる",async()=>{
  const source=await readFile(new URL("../app/kitchen-board.tsx",import.meta.url),"utf8");
  assert.match(source,/markFinishedUnitsReady/);
  assert.match(source,/tasks\.every\(task=>completedIds\.has\(task\.id\)\)/);
  assert.match(source,/action:"STEP",totalSteps:1/);
  assert.match(source,/提供予定時刻を待たずに呼び出せます/);
  assert.doesNotMatch(source,/Date\.now\(\).*action:"CALL"/);
});

test("提供予定の接近と超過を警告して最短工程へ反映する",async()=>{
  const [board,styles]=await Promise.all([
    readFile(new URL("../app/kitchen-board.tsx",import.meta.url),"utf8"),
    readFile(new URL("../app/globals.css",import.meta.url),"utf8"),
  ]);
  assert.match(board,/提供予定アラート/);
  assert.match(board,/scheduleRisk/);
  assert.match(board,/priorityCall/);
  assert.match(board,/最優先/);
  assert.match(styles,/schedule-alert-board/);
  assert.match(styles,/order-card\.risk-overdue/);
});

test("工程完了後に残作業から提供予定を安全側へ再計算する",async()=>{
  const [board,recalculate,units]=await Promise.all([
    readFile(new URL("../app/kitchen-board.tsx",import.meta.url),"utf8"),
    readFile(new URL("../app/api/v1/kitchen/schedule-recalculate/route.ts",import.meta.url),"utf8"),
    readFile(new URL("../app/api/v1/kitchen/units/route.ts",import.meta.url),"utf8"),
  ]);
  assert.match(board,/recalculateAfterProgress/);
  assert.match(board,/schedule-recalculate/);
  assert.match(board,/!fryerPreheated\?10:0/);
  assert.match(recalculate,/Math\.max\(currentFood \?\? 0, candidateReadyAt\)/);
  assert.match(recalculate,/工程進捗による自動再計算/);
  assert.match(recalculate,/SCHEDULE_UPDATED/);
  assert.match(units,/enrichWithKitchenSchedule/);
  assert.match(units,/estimatedReadyAt: readyAt/);
});

test("注文カードから理由付き延長と直前予定への復元ができる",async()=>{
  const [board,adjust,styles]=await Promise.all([
    readFile(new URL("../app/kitchen-board.tsx",import.meta.url),"utf8"),
    readFile(new URL("../app/api/v1/kitchen/schedule-adjust/route.ts",import.meta.url),"utf8"),
    readFile(new URL("../app/globals.css",import.meta.url),"utf8"),
  ]);
  assert.match(board,/注文全体の予定変更/);
  assert.match(board,/＋5分/);
  assert.match(board,/直前へ戻す/);
  assert.match(board,/schedule-adjust/);
  assert.match(adjust,/ADJUSTMENT_REASON_REQUIRED/);
  assert.match(adjust,/直前の予定変更を取り消し/);
  assert.match(adjust,/update_mode='MANUAL'/);
  assert.match(styles,/schedule-dialog-backdrop/);
});

test("注文ごとの提供予定変更履歴を確認できる",async()=>{
  const [board,adjust,styles]=await Promise.all([
    readFile(new URL("../app/kitchen-board.tsx",import.meta.url),"utf8"),
    readFile(new URL("../app/api/v1/kitchen/schedule-adjust/route.ts",import.meta.url),"utf8"),
    readFile(new URL("../app/globals.css",import.meta.url),"utf8"),
  ]);
  assert.match(board,/変更履歴/);
  assert.match(board,/action:\"HISTORY\"/);
  assert.match(board,/当初予定/);
  assert.match(board,/現在予定/);
  assert.match(adjust,/export async function GET/);
  assert.match(adjust,/ORDER BY calculated_at DESC LIMIT 30/);
  assert.match(adjust,/Cache-Control/);
  assert.match(styles,/schedule-history-list/);
});

test("音声担当を1端末に限定し安全に切り替える",async()=>{
  const [board,route,eventRoute,schema]=await Promise.all([
    readFile(new URL("../app/kitchen-board.tsx",import.meta.url),"utf8"),
    readFile(new URL("../app/api/v1/kitchen/audio-master/route.ts",import.meta.url),"utf8"),
    readFile(new URL("../app/api/v1/kitchen/audio-events/route.ts",import.meta.url),"utf8"),
    readFile(new URL("../db/schema.ts",import.meta.url),"utf8"),
  ]);
  assert.match(board,/この端末が音声担当/);
  assert.match(board,/HEARTBEAT/);
  assert.match(board,/window\.confirm/);
  assert.match(route,/LEASE_MS = 35_000/);
  assert.match(route,/AUDIO_MASTER_IN_USE/);
  assert.match(route,/kitchen_audio_master\.lease_until<=/);
  assert.match(board,/sessionStorage\.getItem\("aozora-kitchen-audio-device-id"\)/);
  assert.match(board,/claimAudioEvent/);
  assert.match(eventRoute,/INSERT OR IGNORE INTO kitchen_audio_events/);
  assert.match(schema,/kitchen_audio_events/);
});

test("6つの運用保護を注文管理へ組み込む",async()=>{
  const [board,sync,smaregi,readme]=await Promise.all([
    readFile(new URL("../app/kitchen-board.tsx",import.meta.url),"utf8"),
    readFile(new URL("../lib/paygate-sync.ts",import.meta.url),"utf8"),
    readFile(new URL("../lib/smaregi.ts",import.meta.url),"utf8"),
    readFile(new URL("../README.md",import.meta.url),"utf8"),
  ]);
  assert.match(sync,/INITIAL_LOOKBACK_MS = 24 \* 60 \* 60_000/);
  assert.match(sync,/paygate_sync_cursor_at/);
  assert.match(sync,/if \(failed\)/);
  assert.match(sync,/MAX_PAGES/);
  assert.match(smaregi,/page: String/);
  assert.match(board,/task-progress/);
  assert.match(board,/visibilitychange/);
  assert.match(board,/window\.addEventListener\("online"/);
  assert.match(board,/5秒後に反映します/);
  assert.match(board,/cancelPendingAction/);
  assert.match(readme,/受渡確認3分/);
});

test("決済済み注文の未反映を表示して手動再取得できる",async()=>{
  const [board,route]=await Promise.all([
    readFile(new URL("../app/kitchen-board.tsx",import.meta.url),"utf8"),
    readFile(new URL("../app/api/v1/kitchen/sync-health/route.ts",import.meta.url),"utf8"),
  ]);
  assert.match(board,/決済済み注文の未反映/);
  assert.match(board,/今すぐ再取得/);
  assert.match(route,/syncPaygateTransactions\(true\)/);
  assert.match(route,/status='ERROR'/);
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

test("完成品を画面上部から予定時刻前でも呼び出せる",async()=>{
  const [board,styles]=await Promise.all([
    readFile(new URL("../app/kitchen-board.tsx",import.meta.url),"utf8"),
    readFile(new URL("../app/globals.css",import.meta.url),"utf8"),
  ]);
  assert.match(board,/readyToCall/);
  assert.match(board,/related\.every\(task=>optimizerDone\.has\(task\.id\)\)/);
  assert.match(board,/callCompletedItem/);
  assert.match(board,/body\.current\?\.status!=="READY"/);
  assert.match(board,/完成しました。できた商品から呼び出してください/);
  assert.match(board,/予定時刻前でも呼出可能/);
  assert.match(board,/queueAct\(item,"CALL"\)/);
  assert.match(styles,/\.ready-call-board/);
});

test("営業時間画面から共通ジャンル別提供時間を管理する",async()=>{
  const [manager,proxy,styles]=await Promise.all([
    readFile(new URL("../app/business-hours-manager.tsx",import.meta.url),"utf8"),
    readFile(new URL("../app/api/v1/kitchen/menu-availability/route.ts",import.meta.url),"utf8"),
    readFile(new URL("../app/globals.css",import.meta.url),"utf8"),
  ]);
  assert.match(manager,/ジャンル別の提供曜日・時間/);
  assert.match(manager,/平日のご飯ものを停止/);
  assert.match(manager,/\/api\/v1\/kitchen\/menu-availability/);
  assert.match(proxy,/category-schedules/);
  assert.match(proxy,/KITCHEN_API_TOKEN/);
  assert.match(styles,/\.category-availability/);
});
