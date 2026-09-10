import { env } from "cloudflare:workers";
import { NextRequest, NextResponse } from "next/server";
import { hasSiteSessionRequest } from "@/lib/site-auth";
import { syncPaygateTransactions } from "@/lib/paygate-sync";
import { scheduleDb } from "@/lib/schedule-store";

type Runtime = { KITCHEN_API_TOKEN?: string; MEMBERS_API_BASE_URL?: string };
type Unit = { orderId?: string; department?: "FOOD" | "DRINK"; estimatedReadyAt?: number | null };
type Schedule = { orderId: string; foodReadyAt: number | null; drinkReadyAt: number | null };

async function forward(request: NextRequest) {
  if (!await hasSiteSessionRequest(request)) return NextResponse.json({ error: "LOGIN_REQUIRED" }, { status: 401 });
  const runtime = env as unknown as Runtime;
  if (!runtime.KITCHEN_API_TOKEN) return NextResponse.json({ error: "KITCHEN_API_NOT_CONFIGURED" }, { status: 503 });
  const query = request.nextUrl.search, base = runtime.MEMBERS_API_BASE_URL ?? "https://compassion-world-members-card.combetter27.chatgpt.site";
  try {
    const paygate = request.method === "GET" ? await syncPaygateTransactions() : null;
    const response = await fetch(`${base}/api/v1/kitchen/units${query}`, {
      method: request.method,
      headers: { Authorization: `Bearer ${runtime.KITCHEN_API_TOKEN}`, ...(request.method === "PATCH" ? { "Content-Type": "application/json" } : {}) },
      body: request.method === "PATCH" ? await request.text() : undefined,
    });
    let responseText = await response.text();
    if (request.method === "GET" && response.ok) responseText = await enrichWithKitchenSchedule(responseText);
    return new NextResponse(responseText, { status: response.status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store", "X-Paygate-Sync": paygate?.status ?? "NOT_RUN" } });
  } catch {
    return NextResponse.json({ error: "KITCHEN_API_UNAVAILABLE" }, { status: 502 });
  }
}

async function enrichWithKitchenSchedule(text: string) {
  try {
    const body = JSON.parse(text) as { units?: Unit[] };
    if (!Array.isArray(body.units) || !body.units.length) return text;
    const orderIds = [...new Set(body.units.map(unit => unit.orderId).filter((value): value is string => Boolean(value)))].slice(0, 100);
    const db = await scheduleDb();
    const rows = await Promise.all(orderIds.map(orderId => db.prepare("SELECT order_id AS orderId,food_ready_at AS foodReadyAt,drink_ready_at AS drinkReadyAt FROM order_schedules WHERE order_id=?").bind(orderId).first<Schedule>()));
    const schedules = new Map(rows.filter((row): row is Schedule => Boolean(row)).map(row => [row.orderId, row]));
    body.units = body.units.map(unit => {
      const schedule = unit.orderId ? schedules.get(unit.orderId) : null;
      const readyAt = unit.department === "DRINK" ? schedule?.drinkReadyAt : schedule?.foodReadyAt;
      return readyAt ? { ...unit, estimatedReadyAt: readyAt } : unit;
    });
    return JSON.stringify(body);
  } catch {
    return text;
  }
}

export function GET(request: NextRequest) { return forward(request); }
export function PATCH(request: NextRequest) { return forward(request); }
