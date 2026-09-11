CREATE TABLE `kitchen_audio_events` (
	`event_key` text PRIMARY KEY NOT NULL,
	`event_type` text NOT NULL,
	`device_id` text NOT NULL,
	`played_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_kitchen_audio_events_played` ON `kitchen_audio_events` (`played_at`);