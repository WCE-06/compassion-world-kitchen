import { NextRequest, NextResponse } from "next/server";
import { hasSiteSessionRequest } from "@/lib/site-auth";
import { getMenuOptionGroups, replaceMenuOptionGroups, type MenuOptionGroup } from "@/lib/menu-options";

export const dynamic = "force-dynamic";
const validCode = (value: unknown): value is string => typeof value === "string" && /^[A-Za-z0-9._:-]{1,80}$/.test(value);

export async function GET(request: NextRequest) {
  if (!await hasSiteSessionRequest(request)) return NextResponse.json({ error:"LOGIN_REQUIRED" }, { status:401 });
  const productCode = request.nextUrl.searchParams.get("productCode");
  if (!validCode(productCode)) return NextResponse.json({ error:"INVALID_PRODUCT_CODE" }, { status:400 });
  return NextResponse.json({ productCode, optionGroups:await getMenuOptionGroups(productCode, true) }, { headers:{ "Cache-Control":"no-store" } });
}

export async function PUT(request: NextRequest) {
  if (!await hasSiteSessionRequest(request)) return NextResponse.json({ error:"LOGIN_REQUIRED" }, { status:401 });
  const body = await request.json().catch(() => null) as { productCode?:unknown; optionGroups?:unknown } | null;
  if (!body || !validCode(body.productCode) || !Array.isArray(body.optionGroups) || body.optionGroups.length > 12) return NextResponse.json({ error:"INVALID_OPTIONS" }, { status:400 });
  const groups = body.optionGroups as MenuOptionGroup[];
  const invalid = groups.some((g) => !validCode(g.id) || typeof g.name !== "string" || !g.name.trim() || !["single","multiple"].includes(g.type) || !Array.isArray(g.choices) || g.choices.length > 30 || g.choices.some((c) => !validCode(c.id) || typeof c.name !== "string" || !c.name.trim() || !Number.isInteger(c.priceDelta) || c.priceDelta < 0 || c.priceDelta > 100000 || !Number.isInteger(c.preparationMinutesDelta) || c.preparationMinutesDelta < 0 || c.preparationMinutesDelta > 120));
  if (invalid) return NextResponse.json({ error:"INVALID_OPTIONS" }, { status:400 });
  const normalized = groups.map((g, index) => ({ ...g, name:g.name.trim(), required:Boolean(g.required), minChoices:Math.max(0,Math.min(Number(g.minChoices)||0,g.choices.length)), maxChoices:Math.max(1,Math.min(Number(g.maxChoices)||1,Math.max(1,g.choices.length))), displaySequence:(index+1)*10, enabled:g.enabled !== false, choices:g.choices.map((c, choiceIndex) => ({ ...c, name:c.name.trim(), displaySequence:(choiceIndex+1)*10, enabled:c.enabled !== false })) }));
  return NextResponse.json({ productCode:body.productCode, optionGroups:await replaceMenuOptionGroups(body.productCode, normalized) });
}
