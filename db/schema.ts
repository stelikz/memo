import { sqliteTable, text, integer, real, index, uniqueIndex } from "drizzle-orm/sqlite-core";

export const cards = sqliteTable(
  "cards",
  {
    id: text("id").primaryKey(), // UUID
    createdAt: integer("created_at").notNull(), // unix timestamp
    updatedAt: integer("updated_at").notNull(), // unix timestamp

    // Language
    targetLanguage: text("target_language").notNull(), // "fr", "de", "es", "ja", etc.

    // Word identity
    lemma: text("lemma").notNull(),
    senseId: text("sense_id").notNull().unique(),
    encounteredForm: text("encountered_form").notNull(),
    partOfSpeech: text("part_of_speech").notNull(),
    pronunciationIpa: text("pronunciation_ipa").notNull(),

    // Grammar metadata — language-specific, stored as JSON string
    grammarJson: text("grammar_json").notNull(),

    // Definitions
    primaryDefinitionTarget: text("primary_definition_target").notNull(),
    primaryDefinitionNative: text("primary_definition_native").notNull(),

    // Context
    userSentence: text("user_sentence"),
    exampleSentence: text("example_sentence").notNull(),

    // Polysemy
    totalCommonMeanings: integer("total_common_meanings").notNull(),
    otherMeaningsJson: text("other_meanings_json").notNull(), // JSON string

    // Related words
    synonymsJson: text("synonyms_json").notNull(), // JSON string
    antonym: text("antonym"),

    // Irregular forms
    irregularForms: text("irregular_forms"),

    // FSRS scheduling fields
    due: integer("due").notNull(), // unix timestamp
    stability: real("stability").notNull(),
    difficulty: real("difficulty").notNull(),
    elapsedDays: integer("elapsed_days").notNull(),
    scheduledDays: integer("scheduled_days").notNull(),
    reps: integer("reps").notNull(),
    lapses: integer("lapses").notNull(),
    state: integer("state").notNull(), // 0=New, 1=Learning, 2=Review, 3=Relearning
    lastReview: integer("last_review"), // unix timestamp, nullable
  },
  (table) => [
    index("idx_cards_due").on(table.state, table.due),
    index("idx_cards_lemma").on(table.lemma),
  ]
);

export const appSettings = sqliteTable("app_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});
