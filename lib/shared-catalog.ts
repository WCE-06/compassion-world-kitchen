import { env } from "cloudflare:workers";
import { isKitchenInStoreBarcode, normalizedMenuCategory } from "@/lib/menu-category";

type Runtime = { SELF_REGISTER_CATALOG_URL?: string; MEMBERS_API_BASE_URL?: string; KITCHEN_API_TOKEN?: string };
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
  displaySequence?: number;
  showOnSelfRegister?: boolean;
  showOnMobileOrder?: boolean;
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
  const runtime = env as unknown as Runtime;
  const url = runtime.SELF_REGISTER_CATALOG_URL;
  if (!url) return null;
  const response = await fetch(url, { headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error(`SHARED_CATALOG_ERROR:${response.status}`);
  const body = await response.json() as {
    ok?: boolean;
    result?: { products?: SharedProduct[]; sync?: { completedAt?: string; storedCount?: number } };
  };
  if (!body.ok || !Array.isArray(body.result?.products)) throw new Error("SHARED_CATALOG_INVALID");
  let publication = new Map<string, { displaySequence: number; showOnSelfRegister: boolean; showOnMobileOrder: boolean }>();
  if (runtime.KITCHEN_API_TOKEN) {
    try {
      const publicationResponse = await fetch(`${runtime.MEMBERS_API_BASE_URL ?? "https://compassion-world-members-card.combetter27.chatgpt.site"}/api/v1/kitchen/catalog-publication`, { headers: { Authorization: `Bearer ${runtime.KITCHEN_API_TOKEN}` }, cache: "no-store" });
      const publicationBody = await publicationResponse.json() as { products?: { productCode: string; displaySequence: number; showOnSelfRegister: boolean; showOnMobileOrder: boolean }[] };
      if (publicationResponse.ok) publication = new Map((publicationBody.products ?? []).map((item) => [item.productCode, item]));
    } catch { /* Keep the catalog usable during a temporary publication API outage. */ }
  }
  const products = body.result.products.filter((product) => product.section === "kitchen" && product.menuCategory && isKitchenInStoreBarcode(product.code ?? "")).map(product=>({...product,...publication.get(product.code ?? ""),menuCategory:normalizedMenuCategory(product.name,product.menuCategory)}));
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
      menuCategory: product.menuCategory,
      displaySequence: Number(product.displaySequence ?? 999999999),
      showOnSelfRegister: product.showOnSelfRegister ?? true,
      showOnMobileOrder: product.showOnMobileOrder ?? true,
    })),
    categories: categoryIds.map((categoryId) => ({ categoryId, categoryName: categoryNames[categoryId] ?? categoryId })),
    environment: "production",
    source: "shared-catalog",
    readOnly: true,
    syncedAt: body.result.sync?.completedAt ?? null,
  };
}
