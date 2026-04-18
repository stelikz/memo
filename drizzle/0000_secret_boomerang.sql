CREATE TABLE `app_settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `cards` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`target_language` text NOT NULL,
	`lemma` text NOT NULL,
	`sense_id` text NOT NULL,
	`encountered_form` text NOT NULL,
	`part_of_speech` text NOT NULL,
	`pronunciation_ipa` text NOT NULL,
	`grammar_json` text NOT NULL,
	`primary_definition_target` text NOT NULL,
	`primary_definition_native` text NOT NULL,
	`user_sentence` text,
	`example_sentence` text NOT NULL,
	`total_common_meanings` integer NOT NULL,
	`other_meanings_json` text NOT NULL,
	`synonyms_json` text NOT NULL,
	`antonym` text,
	`irregular_forms` text,
	`due` integer NOT NULL,
	`stability` real NOT NULL,
	`difficulty` real NOT NULL,
	`elapsed_days` integer NOT NULL,
	`scheduled_days` integer NOT NULL,
	`reps` integer NOT NULL,
	`lapses` integer NOT NULL,
	`state` integer NOT NULL,
	`last_review` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `cards_sense_id_unique` ON `cards` (`sense_id`);--> statement-breakpoint
CREATE INDEX `idx_cards_due` ON `cards` (`state`,`due`);--> statement-breakpoint
CREATE INDEX `idx_cards_lemma` ON `cards` (`lemma`);