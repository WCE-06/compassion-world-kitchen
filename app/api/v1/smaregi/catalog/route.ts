import { NextRequest, NextResponse } from "next/server";
import { getChatGPTUser } from "@/app/chatgpt-auth";
import { createSmaregiProduct, getSmaregiCatalog, type SmaregiProductInput } from "@/lib/smaregi";
import { getSharedCatalog } from "@/lib/shared-catalog";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!await getChatGPTUser()) return NextResponse.json({ error: "LOGIN_REQUIRED" }, { status: 401 });
  try {
    const shared = await getSharedCatalog();
    const smaregi = await getSmaregiCatalog();
    if (smaregi.environment === "production" && smaregi.products.length > 0) {
      const sharedByCode = new Map(shared?.products.map((product) => [product.productCode, product]) ?? []);
      return NextResponse.json({
        ...smaregi,
        products: smaregi.products.map((product) => ({ ...product, ...sharedByCode.get(product.productCode), categoryId: product.categoryId })),
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
  if (!await getChatGPTUser()) return NextResponse.json({ error: "LOGIN_REQUIRED" }, { status: 401 });
  const body = await request.json().catch(() => null) as SmaregiProductInput | null;
  if (!body) return NextResponse.json({ error: "INVALID_BODY" }, { status: 400 });
  try {
    return NextResponse.json({ product: await createSmaregiProduct(body) }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "SMAREGI_ERROR" }, { status: 502 });
  }
}
