import {
  fsrs,
  Rating,
  State,
  type FSRS,
  type Card as FSRSCard,
  type Grade,
} from "ts-fsrs";
import type { ReviewUpdate, getDueCards } from "../db/queries";

type DbCard = ReturnType<typeof getDueCards>[number];

// Singleton — use default params per SPEC ("don't customize until 100+ reviews")
const f: FSRS = fsrs();

// ── Conversions ─────────────────────────────────────────────────────────────

function toFSRSCard(card: DbCard): FSRSCard {
  return {
    due: new Date(card.due * 1000),
    stability: card.stability,
    difficulty: card.difficulty,
    elapsed_days: card.elapsedDays,
    scheduled_days: card.scheduledDays,
    reps: card.reps,
    lapses: card.lapses,
    state: card.state as State,
    last_review: card.lastReview ? new Date(card.lastReview * 1000) : undefined,
    learning_steps: card.learningSteps,
  };
}

function toReviewUpdate(fsrsCard: FSRSCard, now: Date): ReviewUpdate {
  return {
    due: Math.floor(fsrsCard.due.getTime() / 1000),
    stability: fsrsCard.stability,
    difficulty: fsrsCard.difficulty,
    elapsedDays: fsrsCard.elapsed_days,
    scheduledDays: fsrsCard.scheduled_days,
    reps: fsrsCard.reps,
    lapses: fsrsCard.lapses,
    state: fsrsCard.state as number,
    lastReview: Math.floor(now.getTime() / 1000),
    learningSteps: fsrsCard.learning_steps,
  };
}

// ── Interval formatting ─────────────────────────────────────────────────────

function formatInterval(dueDate: Date, now: Date): string {
  const diffMs = dueDate.getTime() - now.getTime();
  const diffMin = Math.round(diffMs / 60_000);

  if (diffMin < 1) return "<1m";
  if (diffMin < 60) return `${diffMin}m`;

  const diffHours = Math.round(diffMs / 3_600_000);
  if (diffHours < 24) return `${diffHours}h`;

  const diffDays = Math.round(diffMs / 86_400_000);
  if (diffDays < 30) return `${diffDays}d`;

  const diffMonths = Math.round(diffDays / 30);
  return `${diffMonths}mo`;
}

// ── Public API ──────────────────────────────────────────────────────────────

export interface SchedulingPreview {
  reviewUpdate: ReviewUpdate;
  intervalLabel: string;
}

const GRADES: Grade[] = [Rating.Again, Rating.Hard, Rating.Good, Rating.Easy];

export function getSchedulingPreview(
  card: DbCard,
  now: Date = new Date(),
): Record<Grade, SchedulingPreview> {
  const fsrsCard = toFSRSCard(card);
  const preview = f.repeat(fsrsCard, now);

  const result = {} as Record<Grade, SchedulingPreview>;
  for (const grade of GRADES) {
    const item = preview[grade];
    result[grade] = {
      reviewUpdate: toReviewUpdate(item.card, now),
      intervalLabel: formatInterval(item.card.due, now),
    };
  }
  return result;
}

export function applyRating(
  card: DbCard,
  grade: Grade,
  now: Date = new Date(),
): ReviewUpdate {
  const fsrsCard = toFSRSCard(card);
  const result = f.next(fsrsCard, now, grade);
  return toReviewUpdate(result.card, now);
}

export { Rating, type Grade };
