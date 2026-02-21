CREATE TABLE `analysis_results` (
	`id` int AUTO_INCREMENT NOT NULL,
	`session_id` varchar(64) NOT NULL,
	`equity_score` int,
	`score_interpretation` varchar(50),
	`results_json` text NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `analysis_results_id` PRIMARY KEY(`id`),
	CONSTRAINT `analysis_results_session_id_unique` UNIQUE(`session_id`)
);
--> statement-breakpoint
CREATE TABLE `analysis_sessions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`session_id` varchar(64) NOT NULL,
	`status` enum('uploading','validating','analyzing','completed','error') NOT NULL DEFAULT 'uploading',
	`total_records` int,
	`valid_records` int,
	`excluded_records` int,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `analysis_sessions_id` PRIMARY KEY(`id`),
	CONSTRAINT `analysis_sessions_session_id_unique` UNIQUE(`session_id`)
);
--> statement-breakpoint
CREATE TABLE `employee_data` (
	`id` int AUTO_INCREMENT NOT NULL,
	`session_id` varchar(64) NOT NULL,
	`employee_id` varchar(255) NOT NULL,
	`gender` varchar(50) NOT NULL,
	`race` varchar(50) NOT NULL,
	`job_title` varchar(255) NOT NULL,
	`location` varchar(255) NOT NULL,
	`years_experience` int NOT NULL,
	`years_in_role` int NOT NULL,
	`performance_rating` varchar(50) NOT NULL,
	`base_salary` int NOT NULL,
	`is_excluded` int NOT NULL DEFAULT 0,
	`exclusion_reason` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `employee_data_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `analysis_sessions` ADD CONSTRAINT `analysis_sessions_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;