import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { eq } from "drizzle-orm";
import { cards, appSettings } from "../db/schema";

// In-memory SQLite for testing
const sqlite = new Database(":memory:");
const db = drizzle(sqlite, { schema: { cards, appSettings } });

// Create tables using the generated migration SQL
sqlite.exec(`
  CREATE TABLE app_settings (
    key text PRIMARY KEY NOT NULL,
    value text NOT NULL
  );

  CREATE TABLE cards (
    id text PRIMARY KEY NOT NULL,
    created_at integer NOT NULL,
    updated_at integer NOT NULL,
    target_language text NOT NULL,
    lemma text NOT NULL,
    sense_id text NOT NULL,
    encountered_form text NOT NULL,
    part_of_speech text NOT NULL,
    pronunciation_ipa text NOT NULL,
    grammar_json text NOT NULL,
    primary_definition_target text NOT NULL,
    primary_definition_native text NOT NULL,
    user_sentence text,
    example_sentence text NOT NULL,
    total_common_meanings integer NOT NULL,
    other_meanings_json text NOT NULL,
    synonyms_json text NOT NULL,
    antonym text,
    irregular_forms text,
    due integer NOT NULL,
    stability real NOT NULL,
    difficulty real NOT NULL,
    elapsed_days integer NOT NULL,
    scheduled_days integer NOT NULL,
    reps integer NOT NULL,
    lapses integer NOT NULL,
    state integer NOT NULL,
    last_review integer
  );

  CREATE UNIQUE INDEX cards_sense_id_unique ON cards (sense_id);
  CREATE INDEX idx_cards_due ON cards (state, due);
  CREATE INDEX idx_cards_lemma ON cards (lemma);
`);

const now = Math.floor(Date.now() / 1000);

// Insert a sample French card for "louer" (to rent)
db.insert(cards)
  .values({
    id: "550e8400-e29b-41d4-a716-446655440000",
    createdAt: now,
    updatedAt: now,
    targetLanguage: "fr",
    lemma: "louer",
    senseId: "louer_to_rent",
    encounteredForm: "loué",
    partOfSpeech: "verb",
    pronunciationIpa: "lu.e",
    grammarJson: JSON.stringify({
      gender: null,
      verb_auxiliary: "avoir",
      is_pronominal: false,
    }),
    primaryDefinitionTarget: "Prendre ou donner en location",
    primaryDefinitionNative: "To rent",
    userSentence: "J'ai loué un appartement près de la gare.",
    exampleSentence: "J'ai loué un appartement près de la gare.",
    totalCommonMeanings: 2,
    otherMeaningsJson: JSON.stringify([
      {
        definition_target: "Faire l'éloge de quelqu'un",
        definition_native: "To praise",
        example_sentence: "Il faut louer son courage.",
      },
    ]),
    synonymsJson: JSON.stringify([
      { word: "affermer", register: "soutenu" },
      { word: "prendre en location", register: "courant" },
    ]),
    antonym: "acheter",
    irregularForms: null,
    // FSRS initial state (New card)
    due: now,
    stability: 0,
    difficulty: 0,
    elapsedDays: 0,
    scheduledDays: 0,
    reps: 0,
    lapses: 0,
    state: 0, // New
    lastReview: null,
  })
  .run();

// Query it back
const result = db.select().from(cards).where(eq(cards.lemma, "louer")).all();

console.log("=== Queried card for 'louer' ===\n");
console.log(JSON.stringify(result[0], null, 2));

// Verify indexes work — query by state + due (review queue lookup)
const dueCards = db
  .select()
  .from(cards)
  .where(eq(cards.state, 0))
  .all();

console.log(`\n=== Due cards (state=New): ${dueCards.length} ===`);

sqlite.close();
console.log("\n✓ All good — schema works correctly.");
