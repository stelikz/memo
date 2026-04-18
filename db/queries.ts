import { eq, and, lte, inArray } from "drizzle-orm";
import { cards } from "./schema";

type DB = Parameters<typeof cards._.columns.id.mapFromDriverValue> extends never
  ? any
  : any;

// Accept any Drizzle database instance so the module works with both
// expo-sqlite (app) and better-sqlite3 (tests).
type DrizzleDB = {
  insert: (...args: any[]) => any;
  select: (...args: any[]) => any;
  update: (...args: any[]) => any;
  delete: (...args: any[]) => any;
};

// ── Types ────────────────────────────────────────────────────────────────────

export interface NewCard {
  id: string;
  targetLanguage: string;
  lemma: string;
  senseId: string;
  encounteredForm: string;
  partOfSpeech: string;
  pronunciationIpa: string;
  grammarJson: string;
  primaryDefinitionTarget: string;
  primaryDefinitionNative: string;
  userSentence: string | null;
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
    createdAt: now,
    updatedAt: now,
  }).run();
}

export function createCards(db: DrizzleDB, newCards: NewCard[]) {
  const now = Math.floor(Date.now() / 1000);
  return db.insert(cards).values(
    newCards.map((c) => ({ ...c, createdAt: now, updatedAt: now }))
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
 * Get cards that are due for review: due timestamp <= now and not suspended (state !== 4).
 * Cards in states 0 (New), 1 (Learning), 2 (Review), 3 (Relearning) are included.
 */
export function getDueCards(db: DrizzleDB, now?: number) {
  const timestamp = now ?? Math.floor(Date.now() / 1000);
  return db
    .select()
    .from(cards)
    .where(and(lte(cards.due, timestamp), lte(cards.state, 3)))
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

// ── Suspend / Unsuspend ──────────────────────────────────────────────────────
// Suspend uses state = 4 (outside the standard FSRS 0-3 range).

const SUSPENDED_STATE = 4;

export function suspendCard(db: DrizzleDB, id: string) {
  return db
    .update(cards)
    .set({ state: SUSPENDED_STATE, updatedAt: Math.floor(Date.now() / 1000) })
    .where(eq(cards.id, id))
    .run();
}

export function unsuspendCard(db: DrizzleDB, id: string, restoreState = 0) {
  return db
    .update(cards)
    .set({ state: restoreState, updatedAt: Math.floor(Date.now() / 1000) })
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
    .set({ state: SUSPENDED_STATE, updatedAt: Math.floor(Date.now() / 1000) })
    .where(inArray(cards.id, ids))
    .run();
}

export function bulkUnsuspend(db: DrizzleDB, ids: string[], restoreState = 0) {
  return db
    .update(cards)
    .set({ state: restoreState, updatedAt: Math.floor(Date.now() / 1000) })
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
      updatedAt: now,
    })
    .where(inArray(cards.id, ids))
    .run();
}
