import { create } from "zustand";
import type { getDueCards } from "../db/queries";

type ReviewCard = ReturnType<typeof getDueCards>[number];

interface ReviewState {
  cards: ReviewCard[];
  currentIndex: number;
  isFlipped: boolean;

  againCount: number;
  hardCount: number;
  goodCount: number;
  easyCount: number;

  startSession: (cards: ReviewCard[]) => void;
  flipCard: () => void;
  rateAndAdvance: (rating: "again" | "hard" | "good" | "easy") => void;
  reset: () => void;
}

export const useReviewStore = create<ReviewState>((set, get) => ({
  cards: [],
  currentIndex: 0,
  isFlipped: false,

  againCount: 0,
  hardCount: 0,
  goodCount: 0,
  easyCount: 0,

  startSession: (cards) =>
    set({
      cards,
      currentIndex: 0,
      isFlipped: false,
      againCount: 0,
      hardCount: 0,
      goodCount: 0,
      easyCount: 0,
    }),

  flipCard: () => set({ isFlipped: true }),

  rateAndAdvance: (rating) => {
    const countKey = `${rating}Count` as const;
    set((s) => ({
      [countKey]: s[countKey] + 1,
      currentIndex: s.currentIndex + 1,
      isFlipped: false,
    }));
  },

  reset: () =>
    set({
      cards: [],
      currentIndex: 0,
      isFlipped: false,
      againCount: 0,
      hardCount: 0,
      goodCount: 0,
      easyCount: 0,
    }),
}));
