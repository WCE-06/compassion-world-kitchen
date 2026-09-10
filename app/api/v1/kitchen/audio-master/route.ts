import { NextRequest, NextResponse } from "next/server";
import { hasSiteSessionRequest } from "@/lib/site-auth";
import { operationsDb } from "@/lib/operations-store";

const DEVICE_ID = /^[A-Za-z0-9_-]{8,80}$/;
const LEASE_MS = 35_000;
type MasterRow = { deviceId: string; deviceName: string; leaseUntil: number; updatedAt: number };

async function currentMaster() {
  return (await operationsDb()).prepare(
    "SELECT device_id AS deviceId,device_name AS deviceName,lease_until AS leaseUntil,updated_at AS updatedAt FROM kitchen_audio_master WHERE singleton_id=1",
  ).first<MasterRow>();
}

export async function GET(request: NextRequest) {
  if (!await hasSiteSessionRequest(request)) return NextResponse.json({ error: "LOGIN_REQUIRED" }, { status: 401 });
  const now = Date.now(), master = await currentMaster();
  return NextResponse.json({ master: master && master.leaseUntil > now ? master : null, serverTime: now }, { headers: { "Cache-Control": "no-store" } });
}

export async function PUT(request: NextRequest) {
  if (!await hasSiteSessionRequest(request)) return NextResponse.json({ error: "LOGIN_REQUIRED" }, { status: 401 });
  const body = await request.json().catch(() => null) as { action?: "CLAIM" | "HEARTBEAT" | "RELEASE"; deviceId?: string; deviceName?: string; force?: boolean } | null;
  const action = body?.action, deviceId = body?.deviceId?.trim() ?? "", deviceName = String(body?.deviceName ?? "厨房モニター").trim().slice(0, 60);
  if (!action || !DEVICE_ID.test(deviceId) || !deviceName) return NextResponse.json({ error: "INVALID_AUDIO_DEVICE" }, { status: 400 });
  const db = await operationsDb(), now = Date.now();
  if (action === "RELEASE") {
    await db.prepare("DELETE FROM kitchen_audio_master WHERE singleton_id=1 AND device_id=?").bind(deviceId).run();
    return NextResponse.json({ ok: true, master: null });
  }
  if (action === "HEARTBEAT") {
    const result = await db.prepare("UPDATE kitchen_audio_master SET lease_until=?,updated_at=? WHERE singleton_id=1 AND device_id=?").bind(now + LEASE_MS, now, deviceId).run();
    if (!result.meta.changes) return NextResponse.json({ error: "AUDIO_MASTER_LOST", master: await currentMaster() }, { status: 409 });
    return NextResponse.json({ ok: true, master: await currentMaster() });
  }
  const result = await db.prepare(
    `INSERT INTO kitchen_audio_master(singleton_id,device_id,device_name,lease_until,updated_at) VALUES(1,?,?,?,?)
     ON CONFLICT(singleton_id) DO UPDATE SET device_id=excluded.device_id,device_name=excluded.device_name,lease_until=excluded.lease_until,updated_at=excluded.updated_at
     WHERE kitchen_audio_master.lease_until<=? OR kitchen_audio_master.device_id=? OR ?=1`,
  ).bind(deviceId, deviceName, now + LEASE_MS, now, now, deviceId, body.force ? 1 : 0).run();
  if (!result.meta.changes) return NextResponse.json({ error: "AUDIO_MASTER_IN_USE", master: await currentMaster() }, { status: 409 });
  return NextResponse.json({ ok: true, master: await currentMaster() });
}
