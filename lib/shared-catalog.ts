import { env } from "cloudflare:workers";

type Runtime = { SELF_REGISTER_CATALOG_URL?: string };
type SharedProduct = {
  productId: string | number;
  code?: string;
  name: string;
  price: number;
  section?: string;
  menuCategory?: string;
  imageUrl?: string;
  description?: string;
  soldOut?: boolean;
};

const categoryNames: Record<string, string> = {
  "soft-simple": "ソフトドリンク",
  "soft-cafe": "カフェ",
  "soft-mocktail": "モクテル",
  "alcohol-cocktail": "カクテル",
  "alcohol-main": "アルコール",
  "food-side": "サイドメニュー",
  "food-don": "丼",
  "food-udon": "うどん",
  "food-pasta": "パスタ",
  "food-tsukemen": "つけ麺",
  dessert: "デザート",
};

export async function getSharedCatalog() {
  const url = (env as unknown as Runtime).SELF_REGISTER_CATALOG_URL;
  if (!url) return null;
  const response = await fetch(url, { headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error(`SHARED_CATALOG_ERROR:${response.status}`);
  const body = await response.json() as {
    ok?: boolean;
    result?: { products?: SharedProduct[]; sync?: { completedAt?: string; storedCount?: number } };
  };
  if (!body.ok || !Array.isArray(body.result?.products)) throw new Error("SHARED_CATALOG_INVALID");
  const products = body.result.products.filter((product) => product.section === "kitchen" && product.menuCategory);
  const categoryIds = [...new Set(products.map((product) => product.menuCategory as string))];
  return {
    products: products.map((product) => ({
      productId: String(product.productId),
      categoryId: product.menuCategory,
      productCode: product.code ?? "",
      productName: product.name,
      price: String(product.price),
      imageUrl: product.imageUrl ?? "",
      description: product.description ?? "",
      soldOut: Boolean(product.soldOut),
    })),
    categories: categoryIds.map((categoryId) => ({ categoryId, categoryName: categoryNames[categoryId] ?? categoryId })),
    environment: "production",
    source: "shared-catalog",
    readOnly: true,
    syncedAt: body.result.sync?.completedAt ?? null,
  };
}
