const validCategories=new Set(["soft-simple","soft-cafe","soft-mocktail","alcohol-cocktail","alcohol-main","food-side","food-don","food-udon","food-pasta","food-tsukemen","dessert"]);

export function isKitchenInStoreBarcode(code:string){return /^29\d{11}$/.test(code.trim())}

export function normalizedMenuCategory(name:string,current?:string){
  const text=name.trim().toLocaleLowerCase("ja-JP"),existing=current??"";
  if(/かき氷|アイスクリーム|ソフトクリーム|パフェ|ケーキ|プリン|ゼリー|デザート|わたあめ/.test(text))return"dessert";
  if(/モクテル/.test(text))return"soft-mocktail";
  if(/カクテル/.test(text))return"alcohol-cocktail";
  if(/ビール|ハイボール|サワー|焼酎|日本酒|ワイン|梅酒|アルコール/.test(text))return"alcohol-main";
  if(/コーヒー|カフェラテ|カフェオレ|エスプレッソ|紅茶|ココア|ティー/.test(text))return"soft-cafe";
  if(/ファンタ|スプライト|ジンジャーエール|カルピス|コーラ|ジュース|ソーダ|ラムネ|サイダー|ウーロン|緑茶|ほうじ茶|麦茶|ミルク|ドリンク|ウォーター|お茶/.test(text))return"soft-simple";
  if(/つけ麺/.test(text))return"food-tsukemen";
  if(/うどん|ほうとう/.test(text))return"food-udon";
  if(/パスタ|スパゲッティ/.test(text))return"food-pasta";
  if(/丼|ご飯|ライス/.test(text))return"food-don";
  return validCategories.has(existing)?existing:"food-side";
}
