CREATE TABLE `atlas_maps` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`name` text NOT NULL,
	`payload` text NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `atlas_maps_owner` ON `atlas_maps` (`owner`);--> statement-breakpoint
CREATE TABLE `atlas_sessions` (
	`hash` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`email` text NOT NULL,
	`name` text NOT NULL,
	`expires` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `atlas_sessions_expires` ON `atlas_sessions` (`expires`);