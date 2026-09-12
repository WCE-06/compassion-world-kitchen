import { NextRequest, NextResponse } from "next/server";
import { hasSiteSessionRequest } from "@/lib/site-auth";
import { createSmaregiProduct, getSmaregiCatalog, type SmaregiProductInput } from "@/lib/smaregi";
import { getSharedCatalog } from "@/lib/shared-catalog";
import { matchCatalogProduct } from "@/lib/catalog-match";
import { isKitchenInStoreBarcode } from "@/lib/menu-category";
import { getMenuOptionGroups } from "@/lib/menu-options";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  if (!await hasSiteSessionRequest(request)) return NextResponse.json({ error: "LOGIN_REQUIRED" }, { status: 401 });
  try {
    const shared = await getSharedCatalog();
    const smaregi = await getSmaregiCatalog();
    if (smaregi.environment === "production" && smaregi.products.length > 0) {
      const localOptions = await getMenuOptionGroups(undefined, true);
      const optionsByCode = new Map<string, typeof localOptions>();
      for (const group of localOptions) optionsByCode.set(group.productCode, [...(optionsByCode.get(group.productCode) ?? []), group]);
      const sharedProducts=shared?.products??[];
      const matchedProducts=smaregi.products.filter(product=>isKitchenInStoreBarcode(product.productCode)).map(product=>({product,shared:matchCatalogProduct(product,sharedProducts)})).filter(row=>Boolean(row.shared));
      const kitchenProducts = matchedProducts.map(row=>row.product);
      const kitchenCategoryIds = new Set(kitchenProducts.map((product) => product.categoryId));
      return NextResponse.json({
        ...smaregi,
        products: matchedProducts.map(({product,shared}) => ({ ...product, ...shared, productCode:product.productCode, categoryId: product.categoryId, soldOut:Boolean(shared?.soldOut)||product.displayFlag==="0", optionGroups:optionsByCode.get(product.productCode) ?? shared?.optionGroups ?? [] })),
        categories: smaregi.categories.filter((category) => kitchenCategoryIds.has(category.categoryId)),
        source: "smaregi-production",
        readOnly: false,
        syncedAt: shared?.syncedAt ?? null,
      }, { headers: { "Cache-Control": "no-store" } });
    }
    if (shared) {
      const localOptions = await getMenuOptionGroups(undefined, true);
      const optionsByCode = new Map<string, typeof localOptions>();
      for (const group of localOptions) optionsByCode.set(group.productCode, [...(optionsByCode.get(group.productCode) ?? []), group]);
      return NextResponse.json({ ...shared, products:shared.products.map((product) => ({ ...product, optionGroups:optionsByCode.get(product.productCode) ?? product.optionGroups ?? [] })) }, { headers: { "Cache-Control": "no-store" } });
    }
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
