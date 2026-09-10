import { NextRequest, NextResponse } from "next/server";
import { hasSiteSessionRequest } from "@/lib/site-auth";
import { CALCULATION_VERSION, iso } from "@/lib/schedule-engine";
import { drinkWorkMinutes, scheduleDb } from "@/lib/schedule-store";

type RecalculationOrder = {
  orderId?: string;
  remainingMinutes?: number;
  foodReadyAt?: number | null;
  drinkReadyAt?: number | null;
  foodCallNumber?: number | null;
  drinkCallNumber?: number | null;
};

type ScheduleRow = {
  orderId: string;
  requestId: string;
  originalFoodReadyAt: number | null;
  foodReadyAt: number | null;
  originalDrinkReadyAt: number | null;
  drinkReadyAt: number | null;
  servingMode: string;
  createdAt: number;
};

const ORDER_ID = /^[A-Za-z0-9_-]{3,100}$/;

export async function POST(request: NextRequest) {
  if (!await hasSiteSessionRequest(request)) return NextResponse.json({ error: "LOGIN_REQUIRED" }, { status: 401 });
  const body = await request.json().catch(() => null) as { orders?: RecalculationOrder[]; reason?: string } | null;
  if (!Array.isArray(body?.orders) || !body.orders.length || body.orders.length > 50) return NextResponse.json({ error: "INVALID_RECALCULATION" }, { status: 400 });

  const db = await scheduleDb(), now = Date.now(), drinkMinutes = await drinkWorkMinutes(), results: Record<string, unknown>[] = [];
  for (const input of body.orders) {
    const orderId = String(input.orderId ?? "").trim();
    if (!ORDER_ID.test(orderId)) continue;
    const remainingMinutes = Math.max(1, Math.min(120, Math.ceil(Number(input.remainingMinutes) || 1)));
    const candidateReadyAt = now + remainingMinutes * 60_000;
    const existing = await db.prepare(`SELECT order_id AS orderId,request_id AS requestId,original_food_ready_at AS originalFoodReadyAt,food_ready_at AS foodReadyAt,original_drink_ready_at AS originalDrinkReadyAt,drink_ready_at AS drinkReadyAt,serving_mode AS servingMode,created_at AS createdAt FROM order_schedules WHERE order_id=?`).bind(orderId).first<ScheduleRow>();
    const suppliedFood = finiteTimestamp(input.foodReadyAt), suppliedDrink = finiteTimestamp(input.drinkReadyAt);
    const hasFood = existing?.foodReadyAt != null || suppliedFood != null, hasDrink = existing?.drinkReadyAt != null || suppliedDrink != null;
    if (!hasFood && !hasDrink) continue;

    const currentFood = existing?.foodReadyAt ?? suppliedFood, currentDrink = existing?.drinkReadyAt ?? suppliedDrink;
    const foodReadyAt = hasFood ? Math.max(currentFood ?? 0, candidateReadyAt) : null;
    const servingMode = existing?.servingMode ?? (hasFood && hasDrink ? "WITH_FOOD" : "AS_SOON_AS_POSSIBLE");
    const drinkCandidate = servingMode === "WITH_FOOD" && foodReadyAt ? foodReadyAt : candidateReadyAt;
    const drinkReadyAt = hasDrink ? Math.max(currentDrink ?? 0, drinkCandidate) : null;
    const drinkStartAt = drinkReadyAt == null ? null : Math.max(now, drinkReadyAt - drinkMinutes * 60_000);
    const changed = !existing || foodReadyAt !== currentFood || drinkReadyAt !== currentDrink;
    if (!changed) {
      results.push({ orderId, changed: false, foodReadyAt: iso(foodReadyAt), drinkReadyAt: iso(drinkReadyAt) });
      continue;
    }

    const reason = String(body.reason ?? "工程進捗による自動再計算").slice(0, 120), version = `${CALCULATION_VERSION}-progress`, requestId = existing?.requestId ?? `kitchen-progress-${orderId}`;
    const originalFood = existing?.originalFoodReadyAt ?? suppliedFood ?? foodReadyAt, originalDrink = existing?.originalDrinkReadyAt ?? suppliedDrink ?? drinkReadyAt;
    const foodEstimatedMinutes = foodReadyAt == null ? null : Math.max(1, Math.ceil((foodReadyAt - now) / 60_000));
    await db.batch([
      db.prepare(`INSERT INTO order_schedules(order_id,request_id,status,calculated_at,original_food_ready_at,food_ready_at,food_estimated_minutes,original_drink_ready_at,drink_start_at,drink_ready_at,drink_work_minutes,serving_mode,food_call_number,drink_call_number,update_reason,update_mode,calculation_version,payload_json,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(order_id) DO UPDATE SET calculated_at=excluded.calculated_at,food_ready_at=excluded.food_ready_at,food_estimated_minutes=excluded.food_estimated_minutes,drink_start_at=excluded.drink_start_at,drink_ready_at=excluded.drink_ready_at,food_call_number=COALESCE(excluded.food_call_number,order_schedules.food_call_number),drink_call_number=COALESCE(excluded.drink_call_number,order_schedules.drink_call_number),update_reason=excluded.update_reason,update_mode=excluded.update_mode,calculation_version=excluded.calculation_version,updated_at=excluded.updated_at`).bind(orderId,requestId,"CONFIRMED",now,originalFood,foodReadyAt,foodEstimatedMinutes,originalDrink,drinkStartAt,drinkReadyAt,drinkMinutes,servingMode,input.foodCallNumber ?? null,input.drinkCallNumber ?? null,reason,"AUTOMATIC",version,"{}",existing?.createdAt ?? now,now),
      db.prepare("INSERT INTO schedule_history(id,order_id,calculated_at,food_ready_at,drink_start_at,drink_ready_at,update_reason,update_mode,calculation_version) VALUES(?,?,?,?,?,?,?,?,?)").bind(crypto.randomUUID(),orderId,now,foodReadyAt,drinkStartAt,drinkReadyAt,reason,"AUTOMATIC",version),
      db.prepare("INSERT INTO schedule_events(id,order_id,event_type,payload_json,created_at) VALUES(?,?,?,?,?)").bind(crypto.randomUUID(),orderId,"SCHEDULE_UPDATED",JSON.stringify({ orderId, foodReadyAt: iso(foodReadyAt), drinkReadyAt: iso(drinkReadyAt), reason, mode: "AUTOMATIC" }),now),
    ]);
    results.push({ orderId, changed: true, foodReadyAt: iso(foodReadyAt), drinkReadyAt: iso(drinkReadyAt), remainingMinutes });
  }
  return NextResponse.json({ ok: true, recalculatedAt: new Date(now).toISOString(), orders: results }, { headers: { "Cache-Control": "no-store" } });
}

function finiteTimestamp(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}
