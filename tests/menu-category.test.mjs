import test from "node:test";
import assert from "node:assert/strict";
import { normalizedMenuCategory } from "../lib/menu-category.ts";

test("フードへ紛れたドリンクを商品名から戻す",()=>{
  assert.equal(normalizedMenuCategory("アイスコーヒー","food-side"),"soft-cafe");
  assert.equal(normalizedMenuCategory("オレンジジュース","food-don"),"soft-simple");
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
