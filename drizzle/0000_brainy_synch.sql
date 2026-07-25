CREATE TABLE `site_users` (
	`email` text PRIMARY KEY NOT NULL,
	`role` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`created_by` text NOT NULL
);
--> statement-breakpoint
INSERT INTO `site_users` (`email`, `role`, `created_by`)
VALUES ('jamesmachen@gmail.com', 'admin', 'initial site setup');
