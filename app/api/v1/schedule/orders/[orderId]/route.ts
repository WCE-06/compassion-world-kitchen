import { NextRequest, NextResponse } from "next/server";
import { requireScheduleToken } from "@/lib/schedule-auth";
import { calculateSchedule, CALCULATION_VERSION, iso, type EstimateInput } from "@/lib/schedule-engine";
import { drinkWorkMinutes, liveFoodOrderCount, scheduleDb } from "@/lib/schedule-store";

type Context = { params: Promise<{ orderId: string }> };
type UpdateBody = EstimateInput & { reason?: string; mode?: "AUTOMATIC" | "MANUAL"; foodReadyAt?: string; drinkReadyAt?: string; foodCallNumber?: number; drinkCallNumber?: number };

export async function GET(request: NextRequest, context: Context) {
  if (!await requireScheduleToken(request)) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const { orderId } = await context.params, db = await scheduleDb();
  const row = await db.prepare("SELECT * FROM order_schedules WHERE order_id=?").bind(orderId).first<Record<string, string | number | null>>();
  if (!row) return NextResponse.json({ error: "SCHEDULE_NOT_FOUND", fallback: "AS_SOON_AS_POSSIBLE" }, { status: 404 });
  const history = await db.prepare("SELECT calculated_at AS calculatedAt,food_ready_at AS foodReadyAt,drink_start_at AS drinkStartAt,drink_ready_at AS drinkReadyAt,update_reason AS reason,update_mode AS mode,calculation_version AS calculationVersion FROM schedule_history WHERE order_id=? ORDER BY calculated_at DESC LIMIT 20").bind(orderId).all<Record<string, string | number | null>>();
  return NextResponse.json(format(row, history.results));
}

export async function PUT(request: NextRequest, context: Context) {
  if (!await requireScheduleToken(request)) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const { orderId } = await context.params; if (!/^[A-Za-z0-9_-]{3,100}$/.test(orderId)) return NextResponse.json({ error: "INVALID_ORDER_ID" }, { status: 400 });
  const body = await request.json().catch(() => null) as UpdateBody | null;
  if (!body?.requestId || !Array.isArray(body.items) || !body.items.length) return NextResponse.json({ error: "INVALID_REQUEST" }, { status: 400 });
  const mode = body.mode ?? "AUTOMATIC", now = Date.now(), calculated = calculateSchedule(body, await drinkWorkMinutes(), await liveFoodOrderCount());
  const manualFood = mode === "MANUAL" && body.foodReadyAt ? Date.parse(body.foodReadyAt) : null, manualDrink = mode === "MANUAL" && body.drinkReadyAt ? Date.parse(body.drinkReadyAt) : null;
  const foodReadyAt = Number.isFinite(manualFood) ? manualFood : calculated.foodReadyAt;
  const drinkReadyAt = Number.isFinite(manualDrink) ? manualDrink : calculated.drinkReadyAt;
  const drinkStartAt = drinkReadyAt == null ? null : Math.max(now, drinkReadyAt - calculated.drinkWorkMinutes * 60_000);
  const db = await scheduleDb(), existing = await db.prepare("SELECT original_food_ready_at AS originalFoodReadyAt,original_drink_ready_at AS originalDrinkReadyAt,created_at AS createdAt FROM order_schedules WHERE order_id=?").bind(orderId).first<{ originalFoodReadyAt: number | null; originalDrinkReadyAt: number | null; createdAt: number }>();
  const originalFood = existing?.originalFoodReadyAt ?? foodReadyAt, originalDrink = existing?.originalDrinkReadyAt ?? drinkReadyAt;
  const payload = JSON.stringify(body), reason = body.reason ?? (existing ? "混雑状況による再計算" : "決済完了時の確定計算");
  await db.batch([
    db.prepare(`INSERT INTO order_schedules(order_id,request_id,status,calculated_at,original_food_ready_at,food_ready_at,food_estimated_minutes,original_drink_ready_at,drink_start_at,drink_ready_at,drink_work_minutes,serving_mode,food_call_number,drink_call_number,update_reason,update_mode,calculation_version,payload_json,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(order_id) DO UPDATE SET request_id=excluded.request_id,status=excluded.status,calculated_at=excluded.calculated_at,food_ready_at=excluded.food_ready_at,food_estimated_minutes=excluded.food_estimated_minutes,drink_start_at=excluded.drink_start_at,drink_ready_at=excluded.drink_ready_at,drink_work_minutes=excluded.drink_work_minutes,serving_mode=excluded.serving_mode,food_call_number=COALESCE(excluded.food_call_number,order_schedules.food_call_number),drink_call_number=COALESCE(excluded.drink_call_number,order_schedules.drink_call_number),update_reason=excluded.update_reason,update_mode=excluded.update_mode,calculation_version=excluded.calculation_version,payload_json=excluded.payload_json,updated_at=excluded.updated_at`).bind(orderId,body.requestId,"CONFIRMED",now,originalFood,foodReadyAt,calculated.foodEstimatedMinutes,originalDrink,drinkStartAt,drinkReadyAt,calculated.drinkWorkMinutes,calculated.servingMode,body.foodCallNumber ?? null,body.drinkCallNumber ?? null,reason,mode,CALCULATION_VERSION,payload,existing?.createdAt ?? now,now),
    db.prepare("INSERT INTO schedule_history(id,order_id,calculated_at,food_ready_at,drink_start_at,drink_ready_at,update_reason,update_mode,calculation_version) VALUES(?,?,?,?,?,?,?,?,?)").bind(crypto.randomUUID(),orderId,now,foodReadyAt,drinkStartAt,drinkReadyAt,reason,mode,CALCULATION_VERSION),
    db.prepare("INSERT INTO schedule_events(id,order_id,event_type,payload_json,created_at) VALUES(?,?,?,?,?)").bind(crypto.randomUUID(),orderId,existing ? "SCHEDULE_UPDATED" : "SCHEDULE_CONFIRMED",JSON.stringify({ orderId, foodReadyAt: iso(foodReadyAt), drinkReadyAt: iso(drinkReadyAt), reason, mode }),now),
  ]);
  const row = await db.prepare("SELECT * FROM order_schedules WHERE order_id=?").bind(orderId).first<Record<string, string | number | null>>();
  return NextResponse.json(format(row!, []), { status: existing ? 200 : 201 });
}

function format(row: Record<string, string | number | null>, history: Record<string, string | number | null>[]) {
  const value = (key: string) => row[key] as number | null;
  return { orderId: row.order_id, requestId: row.request_id, calculatedAt: iso(value("calculated_at")), status: row.status, food: value("food_ready_at") ? { estimatedMinutes: value("food_estimated_minutes"), originalReadyAt: iso(value("original_food_ready_at")), readyAt: iso(value("food_ready_at")), callNumber: row.food_call_number } : null, drink: value("drink_ready_at") ? { workMinutes: value("drink_work_minutes"), originalReadyAt: iso(value("original_drink_ready_at")), startAt: iso(value("drink_start_at")), readyAt: iso(value("drink_ready_at")), servingMode: row.serving_mode, callNumber: row.drink_call_number } : null, updatedAt: iso(value("updated_at")), updateReason: row.update_reason, updateMode: row.update_mode, calculationVersion: row.calculation_version, history: history.map((entry) => ({ ...entry, calculatedAt: iso(entry.calculatedAt as number), foodReadyAt: iso(entry.foodReadyAt as number | null), drinkStartAt: iso(entry.drinkStartAt as number | null), drinkReadyAt: iso(entry.drinkReadyAt as number | null) })) };
}
