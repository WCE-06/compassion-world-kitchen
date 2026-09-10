CREATE TABLE `kitchen_task_events` (
	`id` text PRIMARY KEY NOT NULL,
	`task_id` text NOT NULL,
	`title` text NOT NULL,
	`calls_json` text DEFAULT '[]' NOT NULL,
	`equipment` text NOT NULL,
	`expected_seconds` integer DEFAULT 0 NOT NULL,
	`action` text NOT NULL,
	`created_at` integer NOT NULL,
	`device_id` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_kitchen_task_events_created` ON `kitchen_task_events` (`created_at`);