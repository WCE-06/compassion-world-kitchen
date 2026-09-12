import { NextRequest, NextResponse } from "next/server";
import { requireScheduleToken } from "@/lib/schedule-auth";
import { getMenuOptionGroups } from "@/lib/menu-options";

export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) {
  if (!await requireScheduleToken(request)) return NextResponse.json({ error:"UNAUTHORIZED" }, { status:401 });
  const productCode = request.nextUrl.searchParams.get("productCode") ?? undefined;
  if (productCode && !/^[A-Za-z0-9._:-]{1,80}$/.test(productCode)) return NextResponse.json({ error:"INVALID_PRODUCT_CODE" }, { status:400 });
  const groups = await getMenuOptionGroups(productCode);
  const sanitized = (items:typeof groups) => items.map((group) => ({ id:group.id, name:group.name, type:group.type, required:group.required, minChoices:group.minChoices, maxChoices:group.maxChoices, displaySequence:group.displaySequence, choices:group.choices.filter((choice) => choice.enabled).map((choice) => ({ id:choice.id, name:choice.name, priceDelta:choice.priceDelta, preparationMinutesDelta:choice.preparationMinutesDelta, displaySequence:choice.displaySequence })) }));
  if (productCode) return NextResponse.json({ productCode, optionGroups:sanitized(groups) }, { headers:{ "Cache-Control":"no-store" } });
  const codes = [...new Set(groups.map((group) => group.productCode))];
  return NextResponse.json({ products:codes.map((code) => ({ productCode:code, optionGroups:sanitized(groups.filter((group) => group.productCode === code)) })) }, { headers:{ "Cache-Control":"no-store" } });
}
