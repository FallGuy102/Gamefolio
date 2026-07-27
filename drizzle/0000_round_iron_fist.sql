CREATE TABLE `entries` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_email` text NOT NULL,
	`type` text NOT NULL,
	`title` text NOT NULL,
	`body` text DEFAULT '' NOT NULL,
	`game_id` text,
	`design_theme` text,
	`status` text DEFAULT 'draft' NOT NULL,
	`favorite` integer DEFAULT false NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`game_id`) REFERENCES `games`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `entries_owner_updated_idx` ON `entries` (`owner_email`,`updated_at`);--> statement-breakpoint
CREATE INDEX `entries_owner_type_idx` ON `entries` (`owner_email`,`type`);--> statement-breakpoint
CREATE INDEX `entries_game_idx` ON `entries` (`game_id`);--> statement-breakpoint
CREATE TABLE `entry_images` (
	`id` text PRIMARY KEY NOT NULL,
	`entry_id` text NOT NULL,
	`owner_email` text NOT NULL,
	`storage_key` text NOT NULL,
	`file_name` text NOT NULL,
	`content_type` text NOT NULL,
	`size` integer NOT NULL,
	`width` integer,
	`height` integer,
	`caption` text DEFAULT '' NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`entry_id`) REFERENCES `entries`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `images_entry_idx` ON `entry_images` (`entry_id`,`position`);--> statement-breakpoint
CREATE TABLE `entry_sections` (
	`id` text PRIMARY KEY NOT NULL,
	`entry_id` text NOT NULL,
	`owner_email` text NOT NULL,
	`kind` text NOT NULL,
	`content` text DEFAULT '' NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`entry_id`) REFERENCES `entries`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `sections_entry_idx` ON `entry_sections` (`entry_id`,`position`);--> statement-breakpoint
CREATE TABLE `entry_tags` (
	`entry_id` text NOT NULL,
	`tag_id` text NOT NULL,
	FOREIGN KEY (`entry_id`) REFERENCES `entries`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`tag_id`) REFERENCES `tags`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `entry_tags_unique_idx` ON `entry_tags` (`entry_id`,`tag_id`);--> statement-breakpoint
CREATE TABLE `games` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_email` text NOT NULL,
	`igdb_id` integer,
	`name` text NOT NULL,
	`cover_url` text,
	`genres_json` text DEFAULT '[]' NOT NULL,
	`platforms_json` text DEFAULT '[]' NOT NULL,
	`developer` text,
	`is_manual` integer DEFAULT false NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `games_owner_idx` ON `games` (`owner_email`);--> statement-breakpoint
CREATE UNIQUE INDEX `games_owner_igdb_idx` ON `games` (`owner_email`,`igdb_id`);--> statement-breakpoint
CREATE TABLE `profiles` (
	`email` text PRIMARY KEY NOT NULL,
	`display_name` text,
	`theme` text DEFAULT 'system' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `share_links` (
	`id` text PRIMARY KEY NOT NULL,
	`entry_id` text NOT NULL,
	`owner_email` text NOT NULL,
	`token_hash` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`revoked_at` text,
	FOREIGN KEY (`entry_id`) REFERENCES `entries`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `share_links_token_hash_unique` ON `share_links` (`token_hash`);--> statement-breakpoint
CREATE INDEX `shares_entry_idx` ON `share_links` (`entry_id`);--> statement-breakpoint
CREATE TABLE `tags` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_email` text NOT NULL,
	`name` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tags_owner_name_idx` ON `tags` (`owner_email`,`name`);