import { env } from "cloudflare:workers";
import { getSmaregiTransactions, type SmaregiTransaction } from "@/lib/smaregi";

type Runtime = { KITCHEN_API_TOKEN?: string; MEMBERS_API_BASE_URL?: string; SMAREGI_ENV?: string };
type SyncResult = { status: "SYNCED" | "SKIPPED" | "UNAVAILABLE"; checked: number; imported: number; message?: string };

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
  const result = await response.json().catch(() => ({})) as { imported?: boolean; error?: string };
  if (!response.ok) throw new Error(result.error ?? `MEMBERS_POS_IMPORT_${response.status}`);
  return Boolean(result.imported);
}

async function runSync(): Promise<SyncResult> {
  const now = Date.now(), target = membersTarget();
  if (!target.production || !target.token) return { status: "SKIPPED", checked: 0, imported: 0 };
  const from = new Date(Math.max(lastCursorAt ? lastCursorAt - OVERLAP_MS : now - INITIAL_LOOKBACK_MS, now - INITIAL_LOOKBACK_MS));
  const to = new Date(now + 1_000);
  try {
    const transactions = await getSmaregiTransactions(from, to);
    let imported = 0;
    for (const transaction of transactions) if (await forwardTransaction(transaction, target.base, target.token)) imported += 1;
    const newest = transactions.reduce((latest, transaction) => Math.max(latest, Date.parse(transaction.updDateTime || transaction.transactionDateTime) || 0), 0);
    lastCursorAt = Math.max(lastCursorAt, newest, now);
    return { status: "SYNCED", checked: transactions.length, imported };
  } catch (error) {
    return { status: "UNAVAILABLE", checked: 0, imported: 0, message: error instanceof Error ? error.message : "PAYGATE_SYNC_FAILED" };
  }
}

export function syncPaygateTransactions() {
  const now = Date.now();
  if (inFlight) return inFlight;
  if (now - lastAttemptAt < POLL_INTERVAL_MS) return Promise.resolve<SyncResult>({ status: "SKIPPED", checked: 0, imported: 0 });
  lastAttemptAt = now;
  inFlight = runSync().finally(() => { inFlight = null; });
  return inFlight;
}
