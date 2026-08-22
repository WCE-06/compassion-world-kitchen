import { NextRequest, NextResponse } from "next/server";
import { hasSiteSessionRequest } from "@/lib/site-auth";
import { updateSmaregiDisplaySequence } from "@/lib/smaregi";

export const dynamic = "force-dynamic";

export async function PATCH(request: NextRequest) {
  if (!await hasSiteSessionRequest(request)) return NextResponse.json({ error: "LOGIN_REQUIRED" }, { status: 401 });
  const body = await request.json().catch(() => null) as { productIds?: string[] } | null;
  const productIds = body?.productIds;
  if (!Array.isArray(productIds) || productIds.length === 0 || productIds.length > 250 || new Set(productIds).size !== productIds.length) {
    return NextResponse.json({ error: "INVALID_ORDER" }, { status: 400 });
  }
  try {
    for (let index = 0; index < productIds.length; index += 5) {
      await Promise.all(productIds.slice(index, index + 5).map((productId, offset) => updateSmaregiDisplaySequence(productId, (index + offset + 1) * 10)));
    }
    return NextResponse.json({ ok: true, updated: productIds.length });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "SMAREGI_ERROR" }, { status: 502 });
  }
}
