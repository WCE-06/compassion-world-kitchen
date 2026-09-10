import { NextRequest, NextResponse } from "next/server";
import { hasSiteSessionRequest } from "@/lib/site-auth";
import { operationsDb, type SyncAuditRow } from "@/lib/operations-store";
import { syncPaygateTransactions } from "@/lib/paygate-sync";

export async function GET(request: NextRequest) {
  if (!await hasSiteSessionRequest(request)) return NextResponse.json({ error: "LOGIN_REQUIRED" }, { status: 401 });
  return health();
}

export async function POST(request: NextRequest) {
  if (!await hasSiteSessionRequest(request)) return NextResponse.json({ error: "LOGIN_REQUIRED" }, { status: 401 });
  await syncPaygateTransactions(true);
  return health();
}

async function health() {
  const db = await operationsDb(), now = Date.now();
  const rows = await db.prepare(
    "SELECT transaction_id AS transactionId,transaction_at AS transactionAt,terminal_id AS terminalId,total,status,order_id AS orderId,error,attempt_count AS attemptCount,first_seen_at AS firstSeenAt,last_attempt_at AS lastAttemptAt,updated_at AS updatedAt FROM paygate_sync_audits WHERE status='ERROR' AND updated_at>=? ORDER BY first_seen_at ASC LIMIT 20",
  ).bind(now - 24 * 60 * 60_000).all<SyncAuditRow>();
  const settings = await db.prepare("SELECT setting_key AS key,setting_value AS value FROM kitchen_settings WHERE setting_key LIKE 'paygate_sync_%'").all<{ key: string; value: string }>();
  const values = Object.fromEntries(settings.results.map((row) => [row.key, row.value]));
  return NextResponse.json({
    ok: rows.results.length === 0 && !values.paygate_sync_last_error,
    delayedCount: rows.results.filter((row) => now - row.firstSeenAt >= 30_000).length,
    issues: rows.results,
    lastAttemptAt: Number(values.paygate_sync_last_attempt_at || 0) || null,
    lastSuccessAt: Number(values.paygate_sync_last_success_at || 0) || null,
    lastError: values.paygate_sync_last_error || null,
  }, { headers: { "Cache-Control": "no-store" } });
}
