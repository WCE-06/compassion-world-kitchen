CREATE TABLE `kitchen_task_starts` (
	`task_id` text PRIMARY KEY NOT NULL,
	`started_at` integer NOT NULL,
	`device_id` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_kitchen_task_starts_started` ON `kitchen_task_starts` (`started_at`);