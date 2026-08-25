import { NextRequest, NextResponse } from "next/server";
import { requireScheduleToken } from "@/lib/schedule-auth";
import { calculateSchedule, CALCULATION_VERSION, iso, type EstimateInput } from "@/lib/schedule-engine";
import { drinkWorkMinutes, liveKitchenLoad } from "@/lib/schedule-store";

export async function POST(request: NextRequest) {
  if (!await requireScheduleToken(request)) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const body = await request.json().catch(() => null) as EstimateInput | null;
  if (!body?.requestId || !Array.isArray(body.items) || !body.items.length || body.items.some((item) => !Number.isInteger(item.quantity) || item.quantity < 1)) return NextResponse.json({ error: "INVALID_REQUEST" }, { status: 400 });
  const load=await liveKitchenLoad(),result = calculateSchedule(body, await drinkWorkMinutes(), load.activeFoodOrders,load.activeMicrowaveSeconds);
  return NextResponse.json({ requestId: body.requestId, orderId: body.orderId ?? null, calculatedAt: iso(result.calculatedAt), status: "ESTIMATED", food: result.foodReadyAt ? { estimatedMinutes: result.foodEstimatedMinutes, readyAt: iso(result.foodReadyAt) } : null, drink: result.drinkReadyAt ? { workMinutes: result.drinkWorkMinutes, startAt: iso(result.drinkStartAt), readyAt: iso(result.drinkReadyAt), servingMode: result.servingMode } : null, calculationVersion: CALCULATION_VERSION, calculationInputs: result.inputs }, { headers: { "Cache-Control": "no-store" } });
}
