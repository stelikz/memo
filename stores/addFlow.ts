import { create } from "zustand";
import type { AICardResponse } from "../lib/ai";

interface AddFlowState {
  word: string;
  sentence: string;
  aiResult: AICardResponse | null;
  existingSenseIds: string[];

  setInput: (word: string, sentence: string) => void;
  setResult: (aiResult: AICardResponse, existingSenseIds?: string[]) => void;
  reset: () => void;
}

export const useAddFlowStore = create<AddFlowState>((set) => ({
  word: "",
  sentence: "",
  aiResult: null,
  existingSenseIds: [],

  setInput: (word, sentence) => set({ word, sentence }),
  setResult: (aiResult, existingSenseIds = []) =>
    set({ aiResult, existingSenseIds }),
  reset: () =>
    set({ word: "", sentence: "", aiResult: null, existingSenseIds: [] }),
}));
