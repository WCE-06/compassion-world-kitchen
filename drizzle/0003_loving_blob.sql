CREATE TABLE `kitchen_timing_adjustments` (
	`adjustment_key` text PRIMARY KEY NOT NULL,
	`label` text NOT NULL,
	`buffer_minutes` integer NOT NULL,
	`source_title` text NOT NULL,
	`sample_count` integer NOT NULL,
	`updated_at` integer NOT NULL
);
