/**
 * Test script for card CRUD operations.
 *
 * Run with: npx tsx scripts/test-card-queries.ts
 *
 * Uses better-sqlite3 (in-memory) so it works outside Expo.
 */

import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "../db/schema";
import {
  createCard,
  getCardById,
  getCardsByLemma,
  getDueCards,
  updateCardAfterReview,
  suspendCard,
  deleteCard,
  bulkSuspend,
  bulkResetProgress,
  bulkDelete,
  type NewCard,
} from "../db/queries";

// ── Setup ────────────────────────────────────────────────────────────────────

const sqlite = new Database(":memory:");
const db = drizzle(sqlite, { schema });

// Create tables manually (no migrations needed for test)
sqlite.exec(`
  CREATE TABLE cards (
    id TEXT PRIMARY KEY,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    target_language TEXT NOT NULL,
    lemma TEXT NOT NULL,
    sense_id TEXT NOT NULL UNIQUE,
    encountered_form TEXT NOT NULL,
    part_of_speech TEXT NOT NULL,
    pronunciation_ipa TEXT NOT NULL,
    grammar_json TEXT NOT NULL,
    primary_definition_target TEXT NOT NULL,
    primary_definition_native TEXT NOT NULL,
    user_sentence TEXT,
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
    last_review INTEGER
  );
  CREATE INDEX idx_cards_due ON cards (state, due);
  CREATE INDEX idx_cards_lemma ON cards (lemma);
`);

// ── Helpers ──────────────────────────────────────────────────────────────────

const now = Math.floor(Date.now() / 1000);

function makeCard(overrides: Partial<NewCard> = {}): NewCard {
  return {
    id: crypto.randomUUID(),
    targetLanguage: "fr",
    lemma: "louer",
    senseId: "louer_to_rent",
    encounteredForm: "loue",
    partOfSpeech: "verb",
    pronunciationIpa: "lwe",
    grammarJson: JSON.stringify({ verb_auxiliary: "avoir", is_pronominal: false }),
    primaryDefinitionTarget: "Prendre en location",
    primaryDefinitionNative: "To rent",
    userSentence: "Je loue un appartement.",
    exampleSentence: "Je loue un appartement dans le centre-ville.",
    totalCommonMeanings: 2,
    otherMeaningsJson: JSON.stringify([
      {
        definition_target: "Faire l'éloge de",
        definition_native: "To praise",
        example_sentence: "Il faut louer ses efforts.",
      },
    ]),
    synonymsJson: JSON.stringify([
      { word: "affermer", register: "soutenu" },
      { word: "prendre à bail", register: "courant" },
    ]),
    antonym: null,
    irregularForms: null,
    due: now,
    stability: 0,
    difficulty: 0,
    elapsedDays: 0,
    scheduledDays: 0,
    reps: 0,
    lapses: 0,
    state: 0,
    lastReview: null,
    ...overrides,
  };
}

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`  ✓ ${message}`);
    passed++;
  } else {
    console.error(`  ✗ ${message}`);
    failed++;
  }
}

// ── Tests ────────────────────────────────────────────────────────────────────

console.log("\n1. Create a card");
const card1 = makeCard();
createCard(db, card1);
const fetched1 = getCardById(db, card1.id);
assert(fetched1 !== undefined, "Card exists after insert");
assert(fetched1?.lemma === "louer", `Lemma is "louer"`);
assert(fetched1?.senseId === "louer_to_rent", `Sense ID is "louer_to_rent"`);
assert(fetched1?.createdAt > 0, "createdAt was set");

console.log("\n2. Create a second card — same lemma, different sense (polysemy)");
const card2 = makeCard({
  id: crypto.randomUUID(),
  senseId: "louer_to_praise",
  encounteredForm: "louons",
  primaryDefinitionTarget: "Faire l'éloge de",
  primaryDefinitionNative: "To praise",
  userSentence: "Nous louons son courage.",
  exampleSentence: "Nous louons son courage et sa détermination.",
  otherMeaningsJson: JSON.stringify([
    {
      definition_target: "Prendre en location",
      definition_native: "To rent",
      example_sentence: "Je loue un appartement.",
    },
  ]),
  synonymsJson: JSON.stringify([
    { word: "féliciter", register: "courant" },
    { word: "vanter", register: "courant" },
  ]),
});
createCard(db, card2);
const fetched2 = getCardById(db, card2.id);
assert(fetched2 !== undefined, "Second card exists");
assert(fetched2?.primaryDefinitionNative === "To praise", "Second card has different meaning");

console.log("\n3. Polysemy lookup — get cards by lemma");
const polysemyResults = getCardsByLemma(db, "louer");
assert(polysemyResults.length === 2, `Found 2 cards for lemma "louer"`);
const senses = polysemyResults.map((c: any) => c.senseId).sort();
assert(
  senses[0] === "louer_to_praise" && senses[1] === "louer_to_rent",
  "Both senses present"
);

console.log("\n4. Query due cards");
const dueCards = getDueCards(db, now + 1);
assert(dueCards.length === 2, "Both cards are due (new cards, due = now)");

console.log("\n5. Update card after review (FSRS fields)");
const futureTimestamp = now + 86400; // 1 day from now
updateCardAfterReview(db, card1.id, {
  due: futureTimestamp,
  stability: 4.93,
  difficulty: 6.81,
  elapsedDays: 0,
  scheduledDays: 1,
  reps: 1,
  lapses: 0,
  state: 1, // Learning
  lastReview: now,
});
const reviewed = getCardById(db, card1.id);
assert(reviewed?.stability === 4.93, "Stability updated to 4.93");
assert(reviewed?.difficulty === 6.81, "Difficulty updated to 6.81");
assert(reviewed?.reps === 1, "Reps incremented to 1");
assert(reviewed?.state === 1, "State changed to Learning (1)");
assert(reviewed?.due === futureTimestamp, "Due date moved to tomorrow");

console.log("\n6. Due cards after review — only card2 should be due");
const dueAfterReview = getDueCards(db, now + 1);
assert(dueAfterReview.length === 1, "Only 1 card still due");
assert(dueAfterReview[0]?.id === card2.id, "It's the unreviewed card");

console.log("\n7. Suspend a card");
suspendCard(db, card2.id);
const suspended = getCardById(db, card2.id);
assert(suspended?.state === 4, "Card state is 4 (suspended)");
const dueAfterSuspend = getDueCards(db, now + 1);
assert(dueAfterSuspend.length === 0, "No cards due (one reviewed, one suspended)");

console.log("\n8. Delete a card");
deleteCard(db, card2.id);
const deleted = getCardById(db, card2.id);
assert(deleted === undefined, "Card no longer exists after delete");
const remainingByLemma = getCardsByLemma(db, "louer");
assert(remainingByLemma.length === 1, "Only 1 card remains for lemma");

console.log("\n9. Bulk operations");
// Create 3 more cards for bulk tests
const bulkCards = [
  makeCard({ id: crypto.randomUUID(), senseId: "aller_to_go", lemma: "aller" }),
  makeCard({ id: crypto.randomUUID(), senseId: "venir_to_come", lemma: "venir" }),
  makeCard({ id: crypto.randomUUID(), senseId: "faire_to_do", lemma: "faire" }),
];
for (const c of bulkCards) createCard(db, c);

const bulkIds = bulkCards.map((c) => c.id);

console.log("  9a. Bulk suspend");
bulkSuspend(db, bulkIds);
for (const id of bulkIds) {
  const c = getCardById(db, id);
  assert(c?.state === 4, `Card ${id.slice(0, 8)}… is suspended`);
}

console.log("  9b. Bulk reset progress");
bulkResetProgress(db, bulkIds);
for (const id of bulkIds) {
  const c = getCardById(db, id);
  assert(c?.state === 0, `Card ${id.slice(0, 8)}… reset to New`);
  assert(c?.reps === 0, `Card ${id.slice(0, 8)}… reps = 0`);
}

console.log("  9c. Bulk delete");
bulkDelete(db, bulkIds);
for (const id of bulkIds) {
  const c = getCardById(db, id);
  assert(c === undefined, `Card ${id.slice(0, 8)}… deleted`);
}

// ── Summary ──────────────────────────────────────────────────────────────────

console.log(`\n${"═".repeat(50)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
console.log(`${"═".repeat(50)}\n`);

process.exit(failed > 0 ? 1 : 0);
