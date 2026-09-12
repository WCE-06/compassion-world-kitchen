CREATE TABLE `menu_option_choices` (
	`id` text PRIMARY KEY NOT NULL,
	`group_id` text NOT NULL,
	`name` text NOT NULL,
	`price_delta` integer DEFAULT 0 NOT NULL,
	`preparation_minutes_delta` integer DEFAULT 0 NOT NULL,
	`display_sequence` integer DEFAULT 0 NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_menu_option_choices_group_order` ON `menu_option_choices` (`group_id`,`display_sequence`);--> statement-breakpoint
CREATE TABLE `menu_option_groups` (
	`id` text PRIMARY KEY NOT NULL,
	`product_code` text NOT NULL,
	`name` text NOT NULL,
	`selection_type` text NOT NULL,
	`required` integer DEFAULT false NOT NULL,
	`min_choices` integer DEFAULT 0 NOT NULL,
	`max_choices` integer DEFAULT 1 NOT NULL,
	`display_sequence` integer DEFAULT 0 NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_menu_option_groups_product_order` ON `menu_option_groups` (`product_code`,`display_sequence`);