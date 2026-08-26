import test from "node:test";
import assert from "node:assert/strict";
import { isKitchenInStoreBarcode, normalizedMenuCategory } from "../lib/menu-category.ts";

test("フードへ紛れたドリンクを商品名から戻す",()=>{
  assert.equal(normalizedMenuCategory("アイスコーヒー","food-side"),"soft-cafe");
  assert.equal(normalizedMenuCategory("オレンジジュース","food-don"),"soft-simple");
  assert.equal(normalizedMenuCategory("ファンタ メロン","food-side"),"soft-simple");
});

test("29から始まるインストア商品コードだけを採用する",()=>{
  assert.equal(isKitchenInStoreBarcode("2901234567890"),true);
  assert.equal(isKitchenInStoreBarcode("290123"),true);
  assert.equal(isKitchenInStoreBarcode("4901234567890"),false);
});

test("デザートへ紛れたドリンクを戻す",()=>{
  assert.equal(normalizedMenuCategory("生ビール","dessert"),"alcohol-main");
  assert.equal(normalizedMenuCategory("カフェラテ","dessert"),"soft-cafe");
});

test("ドリンクへ紛れたかき氷はデザートへ戻す",()=>{
  assert.equal(normalizedMenuCategory("かき氷 いちご","soft-simple"),"dessert");
});

test("明確な料理名がない商品は既存の正しいカテゴリーを維持する",()=>{
  assert.equal(normalizedMenuCategory("フライドチキン","food-side"),"food-side");
});
