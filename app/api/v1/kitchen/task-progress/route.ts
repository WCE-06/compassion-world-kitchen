import { NextRequest, NextResponse } from "next/server";
import { hasSiteSessionRequest } from "@/lib/site-auth";
import { operationsDb, type TaskProgressRow } from "@/lib/operations-store";

const DEVICE_ID = /^[A-Za-z0-9_-]{8,80}$/;
function calls(value:string){try{const parsed=JSON.parse(value);return Array.isArray(parsed)?parsed.map(String):[]}catch{return[]}}

export async function GET(request: NextRequest) {
  if (!await hasSiteSessionRequest(request)) return NextResponse.json({ error: "LOGIN_REQUIRED" }, { status: 401 });
  const cutoff = Date.now() - 48 * 60 * 60_000;
  const rows = await (await operationsDb()).prepare(
    "SELECT task_id AS taskId,title,calls_json AS callsJson,completed,completed_at AS completedAt,updated_at AS updatedAt,updated_by_device AS updatedByDevice FROM kitchen_task_progress WHERE updated_at>=? ORDER BY COALESCE(completed_at,updated_at) ASC",
  ).bind(cutoff).all<TaskProgressRow>();
  return NextResponse.json({
    progress: rows.results.map((row) => ({ ...row, completed: Boolean(row.completed), calls: calls(row.callsJson) })),
  }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: NextRequest) {
  if (!await hasSiteSessionRequest(request)) return NextResponse.json({ error: "LOGIN_REQUIRED" }, { status: 401 });
  const body = await request.json().catch(() => null) as { taskId?:string; deviceId?:string } | null;
  const taskId=body?.taskId?.trim()??"",deviceId=body?.deviceId?.trim()??"";
  if(!taskId||taskId.length>2_000||!DEVICE_ID.test(deviceId))return NextResponse.json({error:"INVALID_TASK_START"},{status:400});
  const now=Date.now(),db=await operationsDb();
  await db.prepare("INSERT OR IGNORE INTO kitchen_task_starts(task_id,started_at,device_id) VALUES(?,?,?)").bind(taskId,now,deviceId).run();
  const start=await db.prepare("SELECT started_at AS startedAt FROM kitchen_task_starts WHERE task_id=?").bind(taskId).first<{startedAt:number}>();
  await db.prepare("DELETE FROM kitchen_task_starts WHERE started_at<?").bind(now-7*24*60*60_000).run();
  return NextResponse.json({ok:true,taskId,startedAt:start?.startedAt??now},{headers:{"Cache-Control":"no-store"}});
}

export async function PATCH(request: NextRequest) {
  if (!await hasSiteSessionRequest(request)) return NextResponse.json({ error: "LOGIN_REQUIRED" }, { status: 401 });
  const body = await request.json().catch(() => null) as { taskId?: string; title?: string; calls?: unknown; equipment?:string; expectedMinutes?:number; completed?: boolean; deviceId?: string } | null;
  const taskId = body?.taskId?.trim() ?? "", deviceId = body?.deviceId?.trim() ?? "";
  if (!taskId || taskId.length > 2_000 || !DEVICE_ID.test(deviceId) || typeof body?.completed !== "boolean") {
    return NextResponse.json({ error: "INVALID_TASK_PROGRESS" }, { status: 400 });
  }
  const title = String(body.title ?? "工程").slice(0, 180);
  const calls = Array.isArray(body.calls) ? body.calls.map(String).slice(0, 100) : [];
  const now = Date.now(), completedAt = body.completed ? now : null, db = await operationsDb();
  const result=await db.prepare(
    `INSERT INTO kitchen_task_progress(task_id,title,calls_json,completed,completed_at,updated_at,updated_by_device)
     VALUES(?,?,?,?,?,?,?)
     ON CONFLICT(task_id) DO UPDATE SET title=excluded.title,calls_json=excluded.calls_json,completed=excluded.completed,completed_at=excluded.completed_at,updated_at=excluded.updated_at,updated_by_device=excluded.updated_by_device
     WHERE kitchen_task_progress.completed!=excluded.completed`,
  ).bind(taskId, title, JSON.stringify(calls), body.completed ? 1 : 0, completedAt, now, deviceId).run();
  if(result.meta.changes){
    const equipment=String(body.equipment??"その他").slice(0,80),expectedSeconds=Math.max(0,Math.min(6*60*60,Math.round(Number(body.expectedMinutes??0)*60)||0));
    await db.prepare("INSERT INTO kitchen_task_events(id,task_id,title,calls_json,equipment,expected_seconds,action,created_at,device_id) VALUES(?,?,?,?,?,?,?,?,?)").bind(crypto.randomUUID(),taskId,title,JSON.stringify(calls),equipment,expectedSeconds,body.completed?"COMPLETE":"UNDO",now,deviceId).run();
    if(!body.completed)await db.prepare("DELETE FROM kitchen_task_starts WHERE task_id=?").bind(taskId).run();
  }
  await db.prepare("DELETE FROM kitchen_task_progress WHERE updated_at<?").bind(now - 7 * 24 * 60 * 60_000).run();
  return NextResponse.json({ ok: true, taskId, completed: body.completed, completedAt, updatedAt: now });
}
