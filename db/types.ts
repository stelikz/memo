import { BaseSQLiteDatabase } from "drizzle-orm/sqlite-core";

// Works with both expo-sqlite and better-sqlite3 drizzle instances
export type DrizzleDB = BaseSQLiteDatabase<"sync", any, any>;

export const nowUnix = () => Math.floor(Date.now() / 1000);

// Card status
export type CardStatus = "complete" | "pending";

// FSRS scheduling states
export const CardState = {
  New: 0,
  Learning: 1,
  Review: 2,
  Relearning: 3,
} as const;
