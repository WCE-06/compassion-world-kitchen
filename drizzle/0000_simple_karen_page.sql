CREATE TABLE `kitchen_audio_master` (
	`singleton_id` integer PRIMARY KEY NOT NULL,
	`device_id` text NOT NULL,
	`device_name` text NOT NULL,
	`lease_until` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `kitchen_task_progress` (
	`task_id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`calls_json` text DEFAULT '[]' NOT NULL,
	`completed` integer DEFAULT false NOT NULL,
	`completed_at` integer,
	`updated_at` integer NOT NULL,
	`updated_by_device` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_kitchen_task_progress_completed` ON `kitchen_task_progress` (`completed`,`completed_at`);--> statement-breakpoint
CREATE TABLE `paygate_sync_audits` (
	`transaction_id` text PRIMARY KEY NOT NULL,
	`transaction_at` integer NOT NULL,
	`terminal_id` text,
	`total` integer,
	`status` text NOT NULL,
	`order_id` text,
	`error` text,
	`attempt_count` integer DEFAULT 0 NOT NULL,
	`first_seen_at` integer NOT NULL,
	`last_attempt_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_paygate_sync_audits_status_time` ON `paygate_sync_audits` (`status`,`updated_at`);