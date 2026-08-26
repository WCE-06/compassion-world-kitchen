import test from "node:test";
import assert from "node:assert/strict";
import { matchCatalogProduct } from "../lib/catalog-match.ts";

const shared=[{productId:"101",productCode:"OLD-001",productName:"角煮丼",menuCategory:"food-don"},{productId:"202",productCode:"OLD-002",productName:"アイスコーヒー",menuCategory:"soft-cafe"}];

test("商品コード変更後も商品IDで元のジャンルへ紐付ける",()=>{
  assert.equal(matchCatalogProduct({productId:"101",productCode:"NEW-999",productName:"角煮丼"},shared)?.menuCategory,"food-don");
});

test("商品IDが取得できない場合も商品名でジャンルを復元する",()=>{
  assert.equal(matchCatalogProduct({productCode:"NEW-888",productName:"アイスコーヒー"},shared)?.menuCategory,"soft-cafe");
});
