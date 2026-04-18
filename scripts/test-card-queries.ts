/**
 * Test script for card CRUD operations.
 *
 * Run with: npx tsx scripts/test-card-queries.ts
 *
 * Uses better-sqlite3 (in-memory) so it works outside Expo.
 */

import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as fs from "fs";
import * as path from "path";
import * as schema from "../db/schema";
import {
  createCard,
  getCardById,
  getCardsByLemma,
  getDueCards,
  countDueCards,
  countAllCards,
  getPendingCards,
  updateCardAfterReview,
  addUserSentence,
  suspendCard,
  unsuspendCard,
  deleteCard,
  bulkSuspend,
  bulkUnsuspend,
  bulkResetProgress,
  bulkDelete,
  type NewCard,
} from "../db/queries";

// ── Setup ────────────────────────────────────────────────────────────────────

const sqlite = new Database(":memory:");
const db = drizzle(sqlite, { schema });

// Read the migration SQL to keep test in sync with schema
const migrationDir = path.join(__dirname, "..", "drizzle");
const journalPath = path.join(migrationDir, "meta", "_journal.json");
const journal = JSON.parse(fs.readFileSync(journalPath, "utf-8"));
const migrationFiles: string[] = journal.entries.map(
  (e: { tag: string }) => e.tag
);

for (const tag of migrationFiles) {
  const sql = fs.readFileSync(path.join(migrationDir, `${tag}.sql`), "utf-8");
  // Drizzle migrations use "--> statement-breakpoint" as a delimiter
  const statements = sql
    .split("--> statement-breakpoint")
    .map((s) => s.trim())
    .filter(Boolean);
  for (const stmt of statements) {
    sqlite.exec(stmt);
  }
}

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
    userSentencesJson: JSON.stringify(["Je loue un appartement."]),
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
    learningSteps: 0,
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
assert(fetched1?.status === "complete", "Status defaults to complete");
assert(fetched1?.isSuspended === 0, "isSuspended defaults to 0");
assert(fetched1?.learningSteps === 0, "learningSteps defaults to 0");

console.log("\n2. Create a second card — same lemma, different sense (polysemy)");
const card2 = makeCard({
  id: crypto.randomUUID(),
  senseId: "louer_to_praise",
  encounteredForm: "louons",
  primaryDefinitionTarget: "Faire l'éloge de",
  primaryDefinitionNative: "To praise",
  userSentencesJson: JSON.stringify(["Nous louons son courage."]),
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

console.log("\n4. Query due cards (ordered by due date)");
const dueCards = getDueCards(db, now + 1);
assert(dueCards.length === 2, "Both cards are due (new cards, due = now)");

console.log("\n5. Count queries");
const dueCount = countDueCards(db, now + 1);
assert(dueCount === 2, "countDueCards returns 2");
const allCount = countAllCards(db);
assert(allCount === 2, "countAllCards returns 2");

console.log("\n6. Update card after review (FSRS fields)");
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
  learningSteps: 1,
});
const reviewed = getCardById(db, card1.id);
assert(reviewed?.stability === 4.93, "Stability updated to 4.93");
assert(reviewed?.difficulty === 6.81, "Difficulty updated to 6.81");
assert(reviewed?.reps === 1, "Reps incremented to 1");
assert(reviewed?.state === 1, "State changed to Learning (1)");
assert(reviewed?.due === futureTimestamp, "Due date moved to tomorrow");
assert(reviewed?.learningSteps === 1, "learningSteps updated to 1");

console.log("\n7. Due cards after review — only card2 should be due");
const dueAfterReview = getDueCards(db, now + 1);
assert(dueAfterReview.length === 1, "Only 1 card still due");
assert(dueAfterReview[0]?.id === card2.id, "It's the unreviewed card");

console.log("\n8. Suspend a card (preserves FSRS state)");
suspendCard(db, card2.id);
const suspended = getCardById(db, card2.id);
assert(suspended?.isSuspended === 1, "Card is suspended");
assert(suspended?.state === 0, "FSRS state preserved (still New)");
const dueAfterSuspend = getDueCards(db, now + 1);
assert(dueAfterSuspend.length === 0, "No cards due (one reviewed, one suspended)");

console.log("\n9. Unsuspend a card (FSRS state intact)");
unsuspendCard(db, card2.id);
const unsuspended = getCardById(db, card2.id);
assert(unsuspended?.isSuspended === 0, "Card is unsuspended");
assert(unsuspended?.state === 0, "FSRS state still intact (New)");
const dueAfterUnsuspend = getDueCards(db, now + 1);
assert(dueAfterUnsuspend.length === 1, "Card is due again after unsuspend");

console.log("\n10. Add user sentence to existing card");
addUserSentence(db, card1.id, "On loue souvent des voitures en vacances.");
const withSentence = getCardById(db, card1.id);
const sentences: string[] = JSON.parse(withSentence!.userSentencesJson);
assert(sentences.length === 2, "Now has 2 user sentences");
assert(
  sentences[1] === "On loue souvent des voitures en vacances.",
  "New sentence was appended"
);

console.log("\n11. Pending cards (offline queue)");
const pendingCard = makeCard({
  id: crypto.randomUUID(),
  senseId: "pending_test",
  status: "pending",
  // Pending cards have placeholder AI fields
  primaryDefinitionTarget: "",
  primaryDefinitionNative: "",
  exampleSentence: "",
  grammarJson: "{}",
  totalCommonMeanings: 0,
  otherMeaningsJson: "[]",
  synonymsJson: "[]",
});
createCard(db, pendingCard);
const pendingResults = getPendingCards(db);
assert(pendingResults.length === 1, "Found 1 pending card");
assert(pendingResults[0]?.id === pendingCard.id, "It's the pending card");
// Pending cards should NOT appear in due cards
const dueWithPending = getDueCards(db, now + 1);
assert(
  !dueWithPending.some((c: any) => c.id === pendingCard.id),
  "Pending card excluded from due cards"
);
// Pending cards should NOT be counted
const countWithPending = countAllCards(db);
assert(countWithPending === 2, "Pending card excluded from total count");
// Clean up
deleteCard(db, pendingCard.id);

console.log("\n12. Delete a card");
deleteCard(db, card2.id);
const deleted = getCardById(db, card2.id);
assert(deleted === undefined, "Card no longer exists after delete");
const remainingByLemma = getCardsByLemma(db, "louer");
assert(remainingByLemma.length === 1, "Only 1 card remains for lemma");

console.log("\n13. Bulk operations");
// Create 3 more cards for bulk tests
const bulkCards = [
  makeCard({ id: crypto.randomUUID(), senseId: "aller_to_go", lemma: "aller" }),
  makeCard({ id: crypto.randomUUID(), senseId: "venir_to_come", lemma: "venir" }),
  makeCard({ id: crypto.randomUUID(), senseId: "faire_to_do", lemma: "faire" }),
];
for (const c of bulkCards) createCard(db, c);

const bulkIds = bulkCards.map((c) => c.id);

console.log("  13a. Bulk suspend");
bulkSuspend(db, bulkIds);
for (const id of bulkIds) {
  const c = getCardById(db, id);
  assert(c?.isSuspended === 1, `Card ${id.slice(0, 8)}… is suspended`);
  assert(c?.state === 0, `Card ${id.slice(0, 8)}… FSRS state preserved`);
}

console.log("  13b. Bulk unsuspend");
bulkUnsuspend(db, bulkIds);
for (const id of bulkIds) {
  const c = getCardById(db, id);
  assert(c?.isSuspended === 0, `Card ${id.slice(0, 8)}… is unsuspended`);
}

console.log("  13c. Bulk reset progress");
bulkResetProgress(db, bulkIds);
for (const id of bulkIds) {
  const c = getCardById(db, id);
  assert(c?.state === 0, `Card ${id.slice(0, 8)}… reset to New`);
  assert(c?.reps === 0, `Card ${id.slice(0, 8)}… reps = 0`);
  assert(c?.learningSteps === 0, `Card ${id.slice(0, 8)}… learningSteps = 0`);
}

console.log("  13d. Bulk delete");
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
