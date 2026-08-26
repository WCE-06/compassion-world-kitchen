import { NextRequest, NextResponse } from "next/server";
import { hasSiteSessionRequest } from "@/lib/site-auth";
import { createSmaregiProduct, getSmaregiCatalog, type SmaregiProductInput } from "@/lib/smaregi";
import { getSharedCatalog } from "@/lib/shared-catalog";
import { matchCatalogProduct } from "@/lib/catalog-match";
import { isKitchenInStoreBarcode } from "@/lib/menu-category";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  if (!await hasSiteSessionRequest(request)) return NextResponse.json({ error: "LOGIN_REQUIRED" }, { status: 401 });
  try {
    const shared = await getSharedCatalog();
    const smaregi = await getSmaregiCatalog();
    if (smaregi.environment === "production" && smaregi.products.length > 0) {
      const sharedProducts=shared?.products??[];
      const matchedProducts=smaregi.products.filter(product=>isKitchenInStoreBarcode(product.productCode)).map(product=>({product,shared:matchCatalogProduct(product,sharedProducts)})).filter(row=>Boolean(row.shared));
      const kitchenProducts = matchedProducts.map(row=>row.product);
      const kitchenCategoryIds = new Set(kitchenProducts.map((product) => product.categoryId));
      return NextResponse.json({
        ...smaregi,
        products: matchedProducts.map(({product,shared}) => ({ ...product, ...shared, productCode:product.productCode, categoryId: product.categoryId, soldOut:Boolean(shared?.soldOut)||product.displayFlag==="0" })),
        categories: smaregi.categories.filter((category) => kitchenCategoryIds.has(category.categoryId)),
        source: "smaregi-production",
        readOnly: false,
        syncedAt: shared?.syncedAt ?? null,
      }, { headers: { "Cache-Control": "no-store" } });
    }
    if (shared) return NextResponse.json(shared, { headers: { "Cache-Control": "no-store" } });
    return NextResponse.json(smaregi, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "SMAREGI_ERROR" }, { status: 502 });
  }
}

export async function POST(request: NextRequest) {
  if (!await hasSiteSessionRequest(request)) return NextResponse.json({ error: "LOGIN_REQUIRED" }, { status: 401 });
  const body = await request.json().catch(() => null) as SmaregiProductInput | null;
  if (!body) return NextResponse.json({ error: "INVALID_BODY" }, { status: 400 });
  try {
    return NextResponse.json({ product: await createSmaregiProduct(body) }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "SMAREGI_ERROR" }, { status: 502 });
  }
}
