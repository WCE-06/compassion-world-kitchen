import { NextRequest, NextResponse } from "next/server";
import { requireScheduleToken } from "@/lib/schedule-auth";
import { scheduleDb } from "@/lib/schedule-store";

export async function GET(request: NextRequest) {
  if (!await requireScheduleToken(request)) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const after = Number(request.nextUrl.searchParams.get("after") ?? 0), db = await scheduleDb();
  const result = await db.prepare("SELECT id,order_id AS orderId,event_type AS eventType,payload_json AS payload,created_at AS createdAt FROM schedule_events WHERE created_at>? ORDER BY created_at LIMIT 100").bind(Number.isFinite(after) ? after : 0).all<{ id: string; orderId: string; eventType: string; payload: string; createdAt: number }>();
  return NextResponse.json({ events: result.results.map((event) => ({ ...event, payload: JSON.parse(event.payload), createdAt: new Date(event.createdAt).toISOString() })) }, { headers: { "Cache-Control": "no-store" } });
}
