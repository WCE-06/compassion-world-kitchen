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
] as const;
