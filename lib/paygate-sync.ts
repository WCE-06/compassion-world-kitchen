import { env } from "cloudflare:workers";
import { getSmaregiTransactions, type SmaregiTransaction } from "@/lib/smaregi";
import { operationsDb } from "@/lib/operations-store";

type Runtime = { KITCHEN_API_TOKEN?: string; MEMBERS_API_BASE_URL?: string; SMAREGI_ENV?: string };
type SyncResult = { status: "SYNCED" | "SKIPPED" | "UNAVAILABLE"; checked: number; imported: number; failed?: number; message?: string };
type ImportResult = { imported?: boolean; ignored?: boolean; idempotentReplay?: boolean; cancelled?: boolean; orderId?: string; error?: string };

const POLL_INTERVAL_MS = 8_000;
const INITIAL_LOOKBACK_MS = 30 * 60_000;
const OVERLAP_MS = 2 * 60_000;
let lastAttemptAt = 0;
let lastCursorAt = 0;
let inFlight: Promise<SyncResult> | null = null;

function membersTarget() {
  const runtime = env as unknown as Runtime;
  return {
    base: (runtime.MEMBERS_API_BASE_URL ?? "https://compassion-world-members-card.combetter27.chatgpt.site").replace(/\/$/, ""),
    token: runtime.KITCHEN_API_TOKEN ?? "",
    production: runtime.SMAREGI_ENV === "production",
  };
}

async function forwardTransaction(transaction: SmaregiTransaction, base: string, token: string) {
  const response = await fetch(`${base}/api/v1/kitchen/pos-transactions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(transaction),
    signal: AbortSignal.timeout(7_000),
  });
  const result = await response.json().catch(() => ({})) as ImportResult;
  if (!response.ok) throw new Error(result.error ?? `MEMBERS_POS_IMPORT_${response.status}`);
  return result;
}

async function setting(key: string, value: string | null) {
  const db = await operationsDb(), now = Date.now();
  if (value === null) await db.prepare("DELETE FROM kitchen_settings WHERE setting_key=?").bind(key).run();
  else await db.prepare("INSERT INTO kitchen_settings(setting_key,setting_value,updated_at) VALUES(?,?,?) ON CONFLICT(setting_key) DO UPDATE SET setting_value=excluded.setting_value,updated_at=excluded.updated_at").bind(key, value, now).run();
}

async function audit(transaction: SmaregiTransaction, status: string, result?: ImportResult, error?: unknown) {
  const now = Date.now(), transactionAt = Date.parse(transaction.transactionDateTime) || now;
  const message = error instanceof Error ? error.message.slice(0, 300) : error ? String(error).slice(0, 300) : null;
  await (await operationsDb()).prepare(
    `INSERT INTO paygate_sync_audits(transaction_id,transaction_at,terminal_id,total,status,order_id,error,attempt_count,first_seen_at,last_attempt_at,updated_at)
     VALUES(?,?,?,?,?,?,?,?,?,?,?)
     ON CONFLICT(transaction_id) DO UPDATE SET transaction_at=excluded.transaction_at,terminal_id=excluded.terminal_id,total=excluded.total,status=excluded.status,order_id=COALESCE(excluded.order_id,paygate_sync_audits.order_id),error=excluded.error,attempt_count=paygate_sync_audits.attempt_count+1,last_attempt_at=excluded.last_attempt_at,updated_at=excluded.updated_at`,
  ).bind(transaction.transactionHeadId, transactionAt, transaction.terminalId ?? null, Number.isFinite(Number(transaction.total)) ? Math.round(Number(transaction.total)) : null, status, result?.orderId ?? null, message, 1, now, now, now).run();
}

async function runSync(force = false): Promise<SyncResult> {
  const now = Date.now(), target = membersTarget();
  if (!target.production || !target.token) return { status: "SKIPPED", checked: 0, imported: 0 };
  await setting("paygate_sync_last_attempt_at", String(now));
  const from = new Date(force ? now - INITIAL_LOOKBACK_MS : Math.max(lastCursorAt ? lastCursorAt - OVERLAP_MS : now - INITIAL_LOOKBACK_MS, now - INITIAL_LOOKBACK_MS));
  const to = new Date(now + 1_000);
  try {
    const transactions = await getSmaregiTransactions(from, to);
    let imported = 0, failed = 0;
    for (const transaction of transactions) {
      try {
        const result = await forwardTransaction(transaction, target.base, target.token);
        if (result.imported) imported += 1;
        const status = result.cancelled ? "CANCELLED" : result.ignored ? "IGNORED" : result.imported ? "IMPORTED" : "CONFIRMED";
        await audit(transaction, status, result);
      } catch (error) {
        failed += 1;
        await audit(transaction, "ERROR", undefined, error);
      }
    }
    const newest = transactions.reduce((latest, transaction) => Math.max(latest, Date.parse(transaction.updDateTime || transaction.transactionDateTime) || 0), 0);
    lastCursorAt = Math.max(lastCursorAt, newest, now);
    if (failed) {
      const message = `${failed}件の取引を注文へ反映できませんでした`;
      await setting("paygate_sync_last_error", message);
      return { status: "UNAVAILABLE", checked: transactions.length, imported, failed, message };
    }
    await setting("paygate_sync_last_success_at", String(Date.now()));
    await setting("paygate_sync_last_error", null);
    return { status: "SYNCED", checked: transactions.length, imported, failed: 0 };
  } catch (error) {
    const message = error instanceof Error ? error.message : "PAYGATE_SYNC_FAILED";
    await setting("paygate_sync_last_error", message.slice(0, 300)).catch(() => undefined);
    return { status: "UNAVAILABLE", checked: 0, imported: 0, failed: 0, message };
  }
}

export function syncPaygateTransactions(force = false) {
  const now = Date.now();
  if (inFlight) return inFlight;
  if (!force && now - lastAttemptAt < POLL_INTERVAL_MS) return Promise.resolve<SyncResult>({ status: "SKIPPED", checked: 0, imported: 0 });
  lastAttemptAt = now;
  inFlight = runSync(force).finally(() => { inFlight = null; });
  return inFlight;
}
