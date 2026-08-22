import { NextRequest, NextResponse } from "next/server";
import { requireScheduleToken } from "@/lib/schedule-auth";
import { drinkWorkMinutes, scheduleDb } from "@/lib/schedule-store";

export async function GET(request: NextRequest) { if (!await requireScheduleToken(request)) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 }); return NextResponse.json({ drinkWorkMinutes: await drinkWorkMinutes() }); }
export async function PATCH(request: NextRequest) {
  if (!await requireScheduleToken(request)) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const body = await request.json().catch(() => null) as { drinkWorkMinutes?: number } | null;
  if (!Number.isInteger(body?.drinkWorkMinutes) || body!.drinkWorkMinutes! < 1 || body!.drinkWorkMinutes! > 30) return NextResponse.json({ error: "INVALID_SETTING" }, { status: 400 });
  await (await scheduleDb()).prepare("INSERT INTO kitchen_settings(setting_key,setting_value,updated_at) VALUES('drink_work_minutes',?,?) ON CONFLICT(setting_key) DO UPDATE SET setting_value=excluded.setting_value,updated_at=excluded.updated_at").bind(String(body!.drinkWorkMinutes),Date.now()).run();
  return NextResponse.json({ drinkWorkMinutes: body!.drinkWorkMinutes });
}
