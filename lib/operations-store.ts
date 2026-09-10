import { env } from "cloudflare:workers";
import { scheduleSchema } from "@/db/schema";

let ready: Promise<typeof env.DB> | null = null;

export function operationsDb() {
  if (!ready) ready = (async () => {
    const db = env.DB;
    for (const statement of scheduleSchema) await db.prepare(statement).run();
    await db.prepare("PRAGMA optimize").run();
    return db;
  })().catch((error) => { ready = null; throw error; });
  return ready;
}

export type TaskProgressRow = {
  taskId: string;
  title: string;
  callsJson: string;
  completed: number;
  completedAt: number | null;
  updatedAt: number;
  updatedByDevice: string;
};

export type SyncAuditRow = {
  transactionId: string;
  transactionAt: number;
  terminalId: string | null;
  total: number | null;
  status: string;
  orderId: string | null;
  error: string | null;
  attemptCount: number;
  firstSeenAt: number;
  lastAttemptAt: number;
  updatedAt: number;
};
