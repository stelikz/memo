import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "../../db/schema";

export function createTestDb() {
  const sqlite = new Database(":memory:");
  sqlite.exec(`
    CREATE TABLE cards (
      id TEXT PRIMARY KEY,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'complete',
      target_language TEXT NOT NULL,
      lemma TEXT NOT NULL,
      sense_id TEXT NOT NULL UNIQUE,
      encountered_form TEXT NOT NULL,
      part_of_speech TEXT NOT NULL,
      pronunciation_ipa TEXT NOT NULL,
      grammar_json TEXT NOT NULL,
      primary_definition_target TEXT NOT NULL,
      primary_definition_native TEXT NOT NULL,
      user_sentences_json TEXT NOT NULL DEFAULT '[]',
      example_sentence TEXT NOT NULL,
      total_common_meanings INTEGER NOT NULL,
      other_meanings_json TEXT NOT NULL,
      synonyms_json TEXT NOT NULL,
      antonym TEXT,
      irregular_forms TEXT,
      due INTEGER NOT NULL,
      stability REAL NOT NULL,
      difficulty REAL NOT NULL,
      elapsed_days INTEGER NOT NULL,
      scheduled_days INTEGER NOT NULL,
      reps INTEGER NOT NULL,
      lapses INTEGER NOT NULL,
      state INTEGER NOT NULL,
      last_review INTEGER,
      learning_steps INTEGER NOT NULL DEFAULT 0,
      is_suspended INTEGER NOT NULL DEFAULT 0
    );

    CREATE INDEX idx_cards_due ON cards(state, due);
    CREATE INDEX idx_cards_lemma ON cards(lemma);

    CREATE TABLE app_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  const db = drizzle(sqlite, { schema });
  return { db, sqlite };
}
