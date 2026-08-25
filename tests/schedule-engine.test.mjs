import test from "node:test";
import assert from "node:assert/strict";
import { calculateSchedule, microwaveSeconds, SHARED_CARBONARA_SAUCE_600W_SECONDS } from "../lib/schedule-engine.ts";

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
