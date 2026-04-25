import { eq, and, lte, inArray, asc, desc, count, sql, like, or } from "drizzle-orm";
import { cards } from "./schema";
import { type DrizzleDB, type CardStatus, CardState, nowUnix } from "./types";

// ── Types ────────────────────────────────────────────────────────────────────

export interface NewCard {
  id: string;
  status?: CardStatus;
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
  const now = nowUnix();
  return db.insert(cards).values({
    ...card,
    status: card.status ?? "complete",
    isSuspended: card.isSuspended ?? 0,
    createdAt: now,
    updatedAt: now,
  }).run();
}

export function createCards(db: DrizzleDB, newCards: NewCard[]) {
  const now = nowUnix();
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
export function getDueCards(db: DrizzleDB, now?: number, limit?: number) {
  const timestamp = now ?? nowUnix();
  const query = db
    .select()
    .from(cards)
    .where(
      and(
        lte(cards.due, timestamp),
        eq(cards.isSuspended, 0),
        eq(cards.status, "complete"),
      )
    )
    .orderBy(asc(cards.due));
  if (limit && limit > 0) {
    return query.limit(limit).all();
  }
  return query.all();
}

/**
 * Count cards due for review.
 */
export function countDueCards(db: DrizzleDB, now?: number) {
  const timestamp = now ?? nowUnix();
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
 * Get recently added cards, ordered by creation date descending.
 */
export function getRecentCards(db: DrizzleDB, limit: number = 10) {
  return db
    .select()
    .from(cards)
    .where(eq(cards.status, "complete"))
    .orderBy(desc(cards.createdAt))
    .limit(limit)
    .all();
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

// ── Library ─────────────────────────────────────────────────────────────────

export type LibraryFilter = "all" | "noun" | "verb" | "adjective" | "due";
export type LibrarySort = "newest" | "alphabetical" | "due_date";

export function getLibraryCards(
  db: DrizzleDB,
  options: {
    search?: string;
    filter?: LibraryFilter;
    sort?: LibrarySort;
  } = {}
) {
  const { search, filter = "all", sort = "newest" } = options;
  const now = nowUnix();

  const conditions = [eq(cards.status, "complete")];

  // Filter by part of speech or due status
  if (filter === "noun") {
    conditions.push(eq(cards.partOfSpeech, "noun"));
  } else if (filter === "verb") {
    conditions.push(eq(cards.partOfSpeech, "verb"));
  } else if (filter === "adjective") {
    conditions.push(eq(cards.partOfSpeech, "adjective"));
  } else if (filter === "due") {
    conditions.push(lte(cards.due, now));
    conditions.push(eq(cards.isSuspended, 0));
  }

  // Search by lemma or definition
  if (search && search.trim()) {
    const term = `%${search.trim()}%`;
    conditions.push(
      or(
        like(cards.lemma, term),
        like(cards.primaryDefinitionTarget, term),
        like(cards.primaryDefinitionNative, term),
      )!
    );
  }

  // Sort
  const orderBy =
    sort === "alphabetical"
      ? [asc(cards.lemma)]
      : sort === "due_date"
        ? [asc(cards.due)]
        : [desc(cards.createdAt)];

  return db
    .select()
    .from(cards)
    .where(and(...conditions))
    .orderBy(...orderBy)
    .all();
}

/**
 * Count mature cards (FSRS state = Review).
 */
export function countMatureCards(db: DrizzleDB) {
  const result = db
    .select({ count: count() })
    .from(cards)
    .where(
      and(
        eq(cards.status, "complete"),
        eq(cards.state, CardState.Review),
      )
    )
    .get();
  return result?.count ?? 0;
}

/**
 * Get all complete cards for export.
 */
export function getAllCardsForExport(db: DrizzleDB) {
  return db
    .select()
    .from(cards)
    .where(eq(cards.status, "complete"))
    .orderBy(asc(cards.createdAt))
    .all();
}

/**
 * Reset FSRS progress for ALL cards.
 */
export function resetAllProgress(db: DrizzleDB) {
  const now = nowUnix();
  return db
    .update(cards)
    .set(fsrsResetFields(now))
    .where(eq(cards.status, "complete"))
    .run();
}

// ── Shared helpers ──────────────────────────────────────────────────────────

function fsrsResetFields(now: number) {
  return {
    due: now,
    stability: 0,
    difficulty: 0,
    elapsedDays: 0,
    scheduledDays: 0,
    reps: 0,
    lapses: 0,
    state: CardState.New,
    lastReview: null,
    learningSteps: 0,
    updatedAt: now,
  };
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
    .set({ ...update, updatedAt: nowUnix() })
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
    .set({ ...fields, updatedAt: nowUnix() })
    .where(eq(cards.id, id))
    .run();
}

/**
 * Append a user sentence to an existing card's userSentencesJson array.
 * Uses SQLite json_insert to avoid a SELECT round-trip.
 */
export function addUserSentence(db: DrizzleDB, id: string, sentence: string) {
  return db
    .update(cards)
    .set({
      userSentencesJson: sql`json_insert(${cards.userSentencesJson}, '$[#]', ${sentence})`,
      updatedAt: nowUnix(),
    })
    .where(eq(cards.id, id))
    .run();
}

// ── Suspend / Unsuspend ──────────────────────────────────────────────────────
// Uses a separate is_suspended flag so FSRS state is never touched.

export function suspendCard(db: DrizzleDB, id: string) {
  return db
    .update(cards)
    .set({ isSuspended: 1, updatedAt: nowUnix() })
    .where(eq(cards.id, id))
    .run();
}

export function unsuspendCard(db: DrizzleDB, id: string) {
  return db
    .update(cards)
    .set({ isSuspended: 0, updatedAt: nowUnix() })
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
    .set({ isSuspended: 1, updatedAt: nowUnix() })
    .where(inArray(cards.id, ids))
    .run();
}

export function bulkUnsuspend(db: DrizzleDB, ids: string[]) {
  return db
    .update(cards)
    .set({ isSuspended: 0, updatedAt: nowUnix() })
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
  const now = nowUnix();
  return db
    .update(cards)
    .set(fsrsResetFields(now))
    .where(inArray(cards.id, ids))
    .run();
}
