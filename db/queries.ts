import { eq, and, lte, inArray, asc, count, sql } from "drizzle-orm";
import { BaseSQLiteDatabase } from "drizzle-orm/sqlite-core";
import { cards } from "./schema";

// Works with both expo-sqlite and better-sqlite3 drizzle instances
type DrizzleDB = BaseSQLiteDatabase<"sync", any, any>;

// ── Types ────────────────────────────────────────────────────────────────────

export interface NewCard {
  id: string;
  status?: string; // "complete" (default) or "pending"
  targetLanguage: string;
  lemma: string;
  senseId: string;
  encounteredForm: string;
  partOfSpeech: string;
  pronunciationIpa: string;
  grammarJson: string;
  primaryDefinitionTarget: string;
  primaryDefinitionNative: string;
  userSentencesJson: string; // JSON array of strings
  exampleSentence: string;
  totalCommonMeanings: number;
  otherMeaningsJson: string;
  synonymsJson: string;
  antonym: string | null;
  irregularForms: string | null;
  // FSRS fields
  due: number;
  stability: number;
  difficulty: number;
  elapsedDays: number;
  scheduledDays: number;
  reps: number;
  lapses: number;
  state: number;
  lastReview: number | null;
  learningSteps: number;
  isSuspended?: number; // 0 (default) or 1
}

export type Card = NewCard & {
  createdAt: number;
  updatedAt: number;
};

// ── Create ───────────────────────────────────────────────────────────────────

export function createCard(db: DrizzleDB, card: NewCard) {
  const now = Math.floor(Date.now() / 1000);
  return db.insert(cards).values({
    ...card,
    status: card.status ?? "complete",
    isSuspended: card.isSuspended ?? 0,
    createdAt: now,
    updatedAt: now,
  }).run();
}

export function createCards(db: DrizzleDB, newCards: NewCard[]) {
  const now = Math.floor(Date.now() / 1000);
  return db.insert(cards).values(
    newCards.map((c) => ({
      ...c,
      status: c.status ?? "complete",
      isSuspended: c.isSuspended ?? 0,
      createdAt: now,
      updatedAt: now,
    }))
  ).run();
}

// ── Read ─────────────────────────────────────────────────────────────────────

export function getCardById(db: DrizzleDB, id: string) {
  return db.select().from(cards).where(eq(cards.id, id)).get();
}

export function getCardsByLemma(db: DrizzleDB, lemma: string) {
  return db.select().from(cards).where(eq(cards.lemma, lemma)).all();
}

/**
 * Get cards that are due for review.
 * Filters: due <= now, not suspended, status is complete.
 * Ordered by due date ascending so learning/relearning cards come back first.
 */
export function getDueCards(db: DrizzleDB, now?: number) {
  const timestamp = now ?? Math.floor(Date.now() / 1000);
  return db
    .select()
    .from(cards)
    .where(
      and(
        lte(cards.due, timestamp),
        eq(cards.isSuspended, 0),
        eq(cards.status, "complete"),
      )
    )
    .orderBy(asc(cards.due))
    .all();
}

/**
 * Count cards due for review.
 */
export function countDueCards(db: DrizzleDB, now?: number) {
  const timestamp = now ?? Math.floor(Date.now() / 1000);
  const result = db
    .select({ count: count() })
    .from(cards)
    .where(
      and(
        lte(cards.due, timestamp),
        eq(cards.isSuspended, 0),
        eq(cards.status, "complete"),
      )
    )
    .get();
  return result?.count ?? 0;
}

/**
 * Count all cards (excluding pending).
 */
export function countAllCards(db: DrizzleDB) {
  const result = db
    .select({ count: count() })
    .from(cards)
    .where(eq(cards.status, "complete"))
    .get();
  return result?.count ?? 0;
}

/**
 * Get cards awaiting AI processing (offline queue).
 */
export function getPendingCards(db: DrizzleDB) {
  return db
    .select()
    .from(cards)
    .where(eq(cards.status, "pending"))
    .orderBy(asc(cards.createdAt))
    .all();
}

// ── Update ───────────────────────────────────────────────────────────────────

export interface ReviewUpdate {
  due: number;
  stability: number;
  difficulty: number;
  elapsedDays: number;
  scheduledDays: number;
  reps: number;
  lapses: number;
  state: number;
  lastReview: number;
  learningSteps: number;
}

export function updateCardAfterReview(
  db: DrizzleDB,
  id: string,
  update: ReviewUpdate
) {
  return db
    .update(cards)
    .set({ ...update, updatedAt: Math.floor(Date.now() / 1000) })
    .where(eq(cards.id, id))
    .run();
}

export function updateCard(
  db: DrizzleDB,
  id: string,
  fields: Partial<Omit<Card, "id" | "createdAt">>
) {
  return db
    .update(cards)
    .set({ ...fields, updatedAt: Math.floor(Date.now() / 1000) })
    .where(eq(cards.id, id))
    .run();
}

/**
 * Append a user sentence to an existing card's userSentencesJson array.
 */
export function addUserSentence(db: DrizzleDB, id: string, sentence: string) {
  const card = getCardById(db, id);
  if (!card) return;
  const sentences: string[] = JSON.parse(card.userSentencesJson);
  sentences.push(sentence);
  return db
    .update(cards)
    .set({
      userSentencesJson: JSON.stringify(sentences),
      updatedAt: Math.floor(Date.now() / 1000),
    })
    .where(eq(cards.id, id))
    .run();
}

// ── Suspend / Unsuspend ──────────────────────────────────────────────────────
// Uses a separate is_suspended flag so FSRS state is never touched.

export function suspendCard(db: DrizzleDB, id: string) {
  return db
    .update(cards)
    .set({ isSuspended: 1, updatedAt: Math.floor(Date.now() / 1000) })
    .where(eq(cards.id, id))
    .run();
}

export function unsuspendCard(db: DrizzleDB, id: string) {
  return db
    .update(cards)
    .set({ isSuspended: 0, updatedAt: Math.floor(Date.now() / 1000) })
    .where(eq(cards.id, id))
    .run();
}

// ── Delete ───────────────────────────────────────────────────────────────────

export function deleteCard(db: DrizzleDB, id: string) {
  return db.delete(cards).where(eq(cards.id, id)).run();
}

// ── Bulk operations (mass edit) ──────────────────────────────────────────────

export function bulkSuspend(db: DrizzleDB, ids: string[]) {
  return db
    .update(cards)
    .set({ isSuspended: 1, updatedAt: Math.floor(Date.now() / 1000) })
    .where(inArray(cards.id, ids))
    .run();
}

export function bulkUnsuspend(db: DrizzleDB, ids: string[]) {
  return db
    .update(cards)
    .set({ isSuspended: 0, updatedAt: Math.floor(Date.now() / 1000) })
    .where(inArray(cards.id, ids))
    .run();
}

export function bulkDelete(db: DrizzleDB, ids: string[]) {
  return db.delete(cards).where(inArray(cards.id, ids)).run();
}

/**
 * Reset FSRS progress for selected cards — sets them back to New state
 * with default FSRS values and due = now.
 */
export function bulkResetProgress(db: DrizzleDB, ids: string[]) {
  const now = Math.floor(Date.now() / 1000);
  return db
    .update(cards)
    .set({
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
      updatedAt: now,
    })
    .where(inArray(cards.id, ids))
    .run();
}
