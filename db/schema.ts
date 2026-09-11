import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const kitchenTaskProgress = sqliteTable("kitchen_task_progress", {
  taskId: text("task_id").primaryKey(),
  title: text("title").notNull(),
  callsJson: text("calls_json").notNull().default("[]"),
  completed: integer("completed", { mode: "boolean" }).notNull().default(false),
  completedAt: integer("completed_at"),
  updatedAt: integer("updated_at").notNull(),
  updatedByDevice: text("updated_by_device").notNull(),
}, (table) => [index("idx_kitchen_task_progress_completed").on(table.completed, table.completedAt)]);

export const kitchenTaskStarts = sqliteTable("kitchen_task_starts", {
  taskId: text("task_id").primaryKey(),
  startedAt: integer("started_at").notNull(),
  deviceId: text("device_id").notNull(),
}, (table) => [index("idx_kitchen_task_starts_started").on(table.startedAt)]);

export const kitchenTimingAdjustments = sqliteTable("kitchen_timing_adjustments", {
  adjustmentKey: text("adjustment_key").primaryKey(),
  label: text("label").notNull(),
  bufferMinutes: integer("buffer_minutes").notNull(),
  sourceTitle: text("source_title").notNull(),
  sampleCount: integer("sample_count").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

export const paygateSyncAudits = sqliteTable("paygate_sync_audits", {
  transactionId: text("transaction_id").primaryKey(),
  transactionAt: integer("transaction_at").notNull(),
  terminalId: text("terminal_id"),
  total: integer("total"),
  status: text("status").notNull(),
  orderId: text("order_id"),
  error: text("error"),
  attemptCount: integer("attempt_count").notNull().default(0),
  firstSeenAt: integer("first_seen_at").notNull(),
  lastAttemptAt: integer("last_attempt_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
}, (table) => [index("idx_paygate_sync_audits_status_time").on(table.status, table.updatedAt)]);

export const kitchenAudioMaster = sqliteTable("kitchen_audio_master", {
  singletonId: integer("singleton_id").primaryKey(),
  deviceId: text("device_id").notNull(),
  deviceName: text("device_name").notNull(),
  leaseUntil: integer("lease_until").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

export const kitchenTaskEvents = sqliteTable("kitchen_task_events", {
  id: text("id").primaryKey(),
  taskId: text("task_id").notNull(),
  title: text("title").notNull(),
  callsJson: text("calls_json").notNull().default("[]"),
  equipment: text("equipment").notNull(),
  expectedSeconds: integer("expected_seconds").notNull().default(0),
  action: text("action").notNull(),
  createdAt: integer("created_at").notNull(),
  deviceId: text("device_id").notNull(),
}, (table) => [index("idx_kitchen_task_events_created").on(table.createdAt)]);

export const scheduleSchema = [
  `CREATE TABLE IF NOT EXISTS order_schedules (
    order_id TEXT PRIMARY KEY,
    request_id TEXT NOT NULL,
    status TEXT NOT NULL,
    calculated_at INTEGER NOT NULL,
    original_food_ready_at INTEGER,
    food_ready_at INTEGER,
    food_estimated_minutes INTEGER,
    original_drink_ready_at INTEGER,
    drink_start_at INTEGER,
    drink_ready_at INTEGER,
    drink_work_minutes INTEGER NOT NULL DEFAULT 5,
    serving_mode TEXT NOT NULL,
    food_call_number INTEGER,
    drink_call_number INTEGER,
    update_reason TEXT,
    update_mode TEXT NOT NULL,
    calculation_version TEXT NOT NULL,
    payload_json TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS schedule_history (
    id TEXT PRIMARY KEY,
    order_id TEXT NOT NULL,
    calculated_at INTEGER NOT NULL,
    food_ready_at INTEGER,
    drink_start_at INTEGER,
    drink_ready_at INTEGER,
    update_reason TEXT,
    update_mode TEXT NOT NULL,
    calculation_version TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_schedule_history_order_time ON schedule_history(order_id, calculated_at DESC)`,
  `CREATE TABLE IF NOT EXISTS schedule_events (
    id TEXT PRIMARY KEY,
    order_id TEXT NOT NULL,
    event_type TEXT NOT NULL,
    payload_json TEXT NOT NULL,
    created_at INTEGER NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_schedule_events_created ON schedule_events(created_at)`,
  `CREATE TABLE IF NOT EXISTS kitchen_settings (
    setting_key TEXT PRIMARY KEY,
    setting_value TEXT NOT NULL,
    updated_at INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS kitchen_task_progress (
    task_id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    calls_json TEXT NOT NULL DEFAULT '[]',
    completed INTEGER NOT NULL DEFAULT 0,
    completed_at INTEGER,
    updated_at INTEGER NOT NULL,
    updated_by_device TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_kitchen_task_progress_completed ON kitchen_task_progress(completed, completed_at)`,
  `CREATE TABLE IF NOT EXISTS kitchen_task_starts (
    task_id TEXT PRIMARY KEY,
    started_at INTEGER NOT NULL,
    device_id TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_kitchen_task_starts_started ON kitchen_task_starts(started_at)`,
  `CREATE TABLE IF NOT EXISTS kitchen_timing_adjustments (
    adjustment_key TEXT PRIMARY KEY,
    label TEXT NOT NULL,
    buffer_minutes INTEGER NOT NULL,
    source_title TEXT NOT NULL,
    sample_count INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS paygate_sync_audits (
    transaction_id TEXT PRIMARY KEY,
    transaction_at INTEGER NOT NULL,
    terminal_id TEXT,
    total INTEGER,
    status TEXT NOT NULL,
    order_id TEXT,
    error TEXT,
    attempt_count INTEGER NOT NULL DEFAULT 0,
    first_seen_at INTEGER NOT NULL,
    last_attempt_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_paygate_sync_audits_status_time ON paygate_sync_audits(status, updated_at)`,
  `CREATE TABLE IF NOT EXISTS kitchen_audio_master (
    singleton_id INTEGER PRIMARY KEY CHECK(singleton_id = 1),
    device_id TEXT NOT NULL,
    device_name TEXT NOT NULL,
    lease_until INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS kitchen_task_events (
    id TEXT PRIMARY KEY,
    task_id TEXT NOT NULL,
    title TEXT NOT NULL,
    calls_json TEXT NOT NULL DEFAULT '[]',
    equipment TEXT NOT NULL,
    expected_seconds INTEGER NOT NULL DEFAULT 0,
    action TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    device_id TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_kitchen_task_events_created ON kitchen_task_events(created_at)`,
] as const;
