import test from "node:test";
import assert from "node:assert/strict";
import { calculateSchedule, microwaveSeconds, SHARED_CARBONARA_SAUCE_600W_SECONDS, FRYER_PREHEAT_MINUTES } from "../lib/schedule-engine.ts";

const combo={requestId:"carbonara-tsukemen",orderedAt:"2026-08-26T12:00:00+09:00",items:[
  {name:"カルボナーラパスタ",department:"FOOD",quantity:1,preparationMinutes:9},
  {name:"濃厚魚介つけ麺",department:"FOOD",quantity:1,preparationMinutes:10},
]};

test("カルボナーラ麺と共通ソースを別々のレンジ工程として計上する",()=>{
  assert.equal(SHARED_CARBONARA_SAUCE_600W_SECONDS,50);
  assert.equal(microwaveSeconds(combo.items[0]),190+50);
});

test("カルボナーラパスタと濃厚魚介つけ麺を完全並列にしない",()=>{
  const result=calculateSchedule(combo,5,0,0);
  assert.equal(result.inputs.requestedMicrowaveSeconds,460);
  assert.ok(result.foodEstimatedMinutes>=12);
  assert.notEqual(result.foodEstimatedMinutes,9);
  assert.notEqual(result.foodEstimatedMinutes,10);
});

test("受付済み注文のレンジ占有時間を加算する",()=>{
  const clear=calculateSchedule(combo,5,0,0);
  const occupied=calculateSchedule(combo,5,0,240);
  assert.ok((occupied.foodEstimatedMinutes??0)>(clear.foodEstimatedMinutes??0));
  assert.equal(occupied.inputs.activeMicrowaveSeconds,240);
});

test("角煮丼は天かすを載せた状態で1000W 40秒として計上する",()=>{
  assert.equal(microwaveSeconds({name:"角煮丼",department:"FOOD",quantity:1}),40);
});

test("停止中のフライヤー商品には予熱10分を加算する",()=>{
  const input={requestId:"fried-cold",orderedAt:"2026-08-26T12:00:00+09:00",items:[{name:"フリフリポテト",department:"FOOD",quantity:1,preparationMinutes:6}]};
  const cold=calculateSchedule(input,5,0,0,false),hot=calculateSchedule(input,5,0,0,true);
  assert.equal(FRYER_PREHEAT_MINUTES,10);
  assert.equal(cold.inputs.fryerPreheatMinutes,10);
  assert.equal(hot.inputs.fryerPreheatMinutes,0);
  assert.equal((cold.foodEstimatedMinutes??0)-(hot.foodEstimatedMinutes??0),10);
});

test("フライヤー予熱はレンジ商品へ一律加算せず並行計算する",()=>{
  const input={requestId:"parallel-preheat",orderedAt:"2026-08-26T12:00:00+09:00",items:[{name:"フリフリポテト",department:"FOOD",quantity:1,preparationMinutes:6},{name:"ほうとう",department:"FOOD",quantity:1,preparationMinutes:15}]};
  const result=calculateSchedule(input,5,0,0,false);
  assert.equal(result.inputs.fryerPathMinutes,16);
  assert.ok((result.foodEstimatedMinutes??0)<27);
});

test("揚げ物の標準を200℃4分・仕上げ込み6分として計算する",()=>{
  const result=calculateSchedule({requestId:"fried-200c",orderedAt:"2026-08-26T12:00:00+09:00",items:[{name:"にんにくからあげ丼",department:"FOOD",quantity:1}]},5,0,0,true);
  assert.equal(result.foodEstimatedMinutes,6);
});

test("かき氷は受信区分がDRINKでもフード提供時間として計算する",()=>{
  const result=calculateSchedule({requestId:"kakigori",orderedAt:"2026-08-26T12:00:00+09:00",items:[{name:"かき氷 いちご",department:"DRINK",quantity:1}]},5,0,0);
  assert.ok(result.foodReadyAt);
  assert.equal(result.drinkReadyAt,null);
});
