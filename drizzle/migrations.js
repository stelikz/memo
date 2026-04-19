// This file is required for Expo/React Native SQLite migrations - https://orm.drizzle.team/quick-sqlite/expo

import journal from './meta/_journal.json';

const m0000 = `CREATE TABLE \`app_settings\` (
\t\`key\` text PRIMARY KEY NOT NULL,
\t\`value\` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE \`cards\` (
\t\`id\` text PRIMARY KEY NOT NULL,
\t\`created_at\` integer NOT NULL,
\t\`updated_at\` integer NOT NULL,
\t\`status\` text NOT NULL,
\t\`target_language\` text NOT NULL,
\t\`lemma\` text NOT NULL,
\t\`sense_id\` text NOT NULL,
\t\`encountered_form\` text NOT NULL,
\t\`part_of_speech\` text NOT NULL,
\t\`pronunciation_ipa\` text NOT NULL,
\t\`grammar_json\` text NOT NULL,
\t\`primary_definition_target\` text NOT NULL,
\t\`primary_definition_native\` text NOT NULL,
\t\`user_sentences_json\` text NOT NULL,
\t\`example_sentence\` text NOT NULL,
\t\`total_common_meanings\` integer NOT NULL,
\t\`other_meanings_json\` text NOT NULL,
\t\`synonyms_json\` text NOT NULL,
\t\`antonym\` text,
\t\`irregular_forms\` text,
\t\`due\` integer NOT NULL,
\t\`stability\` real NOT NULL,
\t\`difficulty\` real NOT NULL,
\t\`elapsed_days\` integer NOT NULL,
\t\`scheduled_days\` integer NOT NULL,
\t\`reps\` integer NOT NULL,
\t\`lapses\` integer NOT NULL,
\t\`state\` integer NOT NULL,
\t\`last_review\` integer,
\t\`learning_steps\` integer NOT NULL,
\t\`is_suspended\` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX \`cards_sense_id_unique\` ON \`cards\` (\`sense_id\`);--> statement-breakpoint
CREATE INDEX \`idx_cards_due\` ON \`cards\` (\`state\`,\`due\`);--> statement-breakpoint
CREATE INDEX \`idx_cards_lemma\` ON \`cards\` (\`lemma\`);`;

export default {
  journal,
  migrations: {
    m0000
  }
}
