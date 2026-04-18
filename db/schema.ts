import { sqliteTable, text, integer, real, index } from "drizzle-orm/sqlite-core";

export const cards = sqliteTable(
  "cards",
  {
    id: text("id").primaryKey(),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),

    // Card status: "complete" = fully generated, "pending" = awaiting AI processing (offline queue)
    status: text("status").notNull().$default(() => "complete"),

    // Language
    targetLanguage: text("target_language").notNull(),

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

    // Context — user_sentences_json is a JSON array of sentences the user provided
    userSentencesJson: text("user_sentences_json").notNull().$default(() => "[]"),
    exampleSentence: text("example_sentence").notNull(),

    // Polysemy
    totalCommonMeanings: integer("total_common_meanings").notNull(),
    otherMeaningsJson: text("other_meanings_json").notNull(),

    // Related words
    synonymsJson: text("synonyms_json").notNull(),
    antonym: text("antonym"),

    // Irregular forms
    irregularForms: text("irregular_forms"),

    // FSRS scheduling fields
    due: integer("due").notNull(),
    stability: real("stability").notNull(),
    difficulty: real("difficulty").notNull(),
    elapsedDays: integer("elapsed_days").notNull(),
    scheduledDays: integer("scheduled_days").notNull(),
    reps: integer("reps").notNull(),
    lapses: integer("lapses").notNull(),
    state: integer("state").notNull(),
    lastReview: integer("last_review"),
    learningSteps: integer("learning_steps").notNull().$default(() => 0),

    // Suspension — independent of FSRS state, so suspend/unsuspend preserves scheduling data
    isSuspended: integer("is_suspended").notNull().$default(() => 0),
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
